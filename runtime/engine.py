#!/usr/bin/env python3
"""KiT 预测引擎（常驻 worker）。

由 DSH 插件 Host 半以子进程方式启动，通过 stdin/stdout 的 JSON Lines 协议通信：

    -> {"id": 1, "op": "status"}
    <- {"id": 1, "type": "result", "data": {...}}
    -> {"id": 2, "op": "predict", "payload": {"code": "600519.SH", "scale": "1d", "bars": [...]}}
    <- {"id": 2, "type": "progress", "stage": "sample", "step": 3, "total": 16}
    <- {"id": 2, "type": "result", "data": {...}}

模型只在第一次真正需要时加载，之后常驻内存。所有推理都在本进程内完成，
不写任何文件（除控制台日志走 stderr）。

权重与配置来自 KiT 官方发布（AGPL-3.0，见同目录 KIT_LICENSE）：
https://github.com/Luciferbobo/KiT  ·  https://huggingface.co/Lucifer744/KiT_model
"""

from __future__ import annotations

import json
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

MARKET = "ashare"

# 各周期的采样预算：在“能跑完”和“概率分布有意义”之间取平衡。
# 这些默认值可被请求覆盖，Host 半会按尺度给出建议值。
SCALE_INFO = {
    "1m": {"Lc": 1200, "Lh": 120, "label": "1 分钟"},
    "5m": {"Lc": 960, "Lh": 96, "label": "5 分钟"},
    "15m": {"Lc": 800, "Lh": 64, "label": "15 分钟"},
    "30m": {"Lc": 640, "Lh": 40, "label": "30 分钟"},
    "1h": {"Lc": 400, "Lh": 20, "label": "60 分钟"},
    "2h": {"Lc": 360, "Lh": 20, "label": "120 分钟"},
    "1d": {"Lc": 250, "Lh": 20, "label": "日线"},
}


def log(message: str) -> None:
    print(f"[engine] {message}", file=sys.stderr, flush=True)


def emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def pick_device(requested: str, torch) -> str:
    if requested and requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


class Engine:
    def __init__(self, ckpt_dir: Path, device: str = "auto", precision: str = "auto") -> None:
        self.ckpt_dir = Path(ckpt_dir)
        self.requested_device = device
        self.requested_precision = precision
        self.model = None
        self.cfg = None
        self.torch = None
        self.device = "cpu"
        self.precision = "fp32"
        self.stats: Dict[str, float] = {}
        self.instruments: Dict[str, Dict[str, Any]] = {}
        self.load_seconds: Optional[float] = None
        # 上一次采样得到的归一化路径，用于「增量延续」（SDEdit 式热启动）
        # key: "code|scale" -> {"asOf": Timestamp, "future": [ts...], "z": np.ndarray[K,Lh,F]}
        self.last_paths: Dict[str, Dict[str, Any]] = {}

    # -- 资源 -------------------------------------------------------------
    def ckpt_path(self) -> Path:
        candidate = self.ckpt_dir / "step_market_284M.pt"
        if candidate.is_file():
            return candidate
        for path in self.ckpt_dir.glob("*.pt"):
            return path
        raise FileNotFoundError(f"没有找到 checkpoint：{self.ckpt_dir / 'step_market_284M.pt'}")

    def load_metadata(self) -> None:
        stats_path = self.ckpt_dir / "stats.json"
        inst_path = self.ckpt_dir / "instruments.json"
        if not stats_path.is_file():
            raise FileNotFoundError(f"缺少 stats.json：{stats_path}")
        self.stats = {str(k): float(v) for k, v in json.loads(stats_path.read_text(encoding="utf-8")).items()}
        if inst_path.is_file():
            self.instruments = json.loads(inst_path.read_text(encoding="utf-8"))
        missing = [s for s in SCALE_INFO if f"{MARKET}|{s}|r_body" not in self.stats]
        if missing:
            raise RuntimeError(f"stats.json 缺少 A 股 {', '.join(missing)} 的归一化统计量")

    def ensure_model(self, progress=None) -> None:
        if self.model is not None:
            return
        started = time.time()
        if progress:
            progress("load", 0, 1, "加载 PyTorch")
        import torch  # noqa: PLC0415  (延迟导入，status 查询不需要它)

        self.torch = torch
        self.device = pick_device(self.requested_device, torch)
        precision = self.requested_precision
        if precision == "auto":
            precision = "fp32"
        self.precision = precision

        if progress:
            progress("load", 0, 1, "读取 checkpoint（约 1.1 GB，首次较慢）")
        self.load_metadata()
        from kit_v1.infer import load_model_and_config  # noqa: PLC0415

        # kit_v1 的 loader 会往 stdout 打日志，而 stdout 是我们的协议通道，统一改道 stderr
        import contextlib  # noqa: PLC0415
        with contextlib.redirect_stdout(sys.stderr):
            model, cfg = load_model_and_config(str(self.ckpt_path()), "tiny", 0)
        model.to(self.device).eval()
        self.model = model
        self.cfg = cfg
        self.load_seconds = time.time() - started
        log(f"模型就绪 device={self.device} precision={self.precision} 用时 {self.load_seconds:.1f}s")

    # -- 推理 -------------------------------------------------------------
    def scale_window(self, scale: str) -> tuple[int, int]:
        """优先用 checkpoint 自带的窗口表，缺失时回落到 README 的固定窗口。"""
        if self.cfg is not None:
            Lc, Lh = self.cfg.data.window_for(scale)
            if Lc > 0 and Lh > 0:
                return int(Lc), int(Lh)
        info = SCALE_INFO[scale]
        return info["Lc"], info["Lh"]

    def predict(self, payload: Dict[str, Any], progress) -> Dict[str, Any]:
        import numpy as np
        import pandas as pd

        scale = str(payload.get("scale", "1d"))
        if scale not in SCALE_INFO:
            raise ValueError(f"未知周期 {scale!r}，可选：{', '.join(SCALE_INFO)}")
        code = str(payload.get("code", "")).strip()
        bars = payload.get("bars") or []
        if len(bars) < 30:
            raise ValueError("K 线数量不足，至少需要 30 根")

        n_paths = max(1, min(64, int(payload.get("nPaths", 8))))
        steps = max(1, min(64, int(payload.get("steps", 12))))
        seed = int(payload.get("seed", 0))
        cfg_w = float(payload.get("cfgW", 1.0) or 1.0)
        limit_rate = payload.get("limitRate")

        self.ensure_model(progress)

        Lc, Lh = self.scale_window(scale)
        if len(bars) < Lc:
            raise ValueError(
                f"该周期需要 {Lc} 根历史 K 线，当前只有 {len(bars)} 根；请换更大的周期或等待更多数据")

        progress("prepare", 0, 1, "构造模型输入")
        df = pd.DataFrame(
            {
                "datetime": pd.to_datetime([b["t"] for b in bars]),
                "open": [float(b["o"]) for b in bars],
                "high": [float(b["h"]) for b in bars],
                "low": [float(b["l"]) for b in bars],
                "close": [float(b["c"]) for b in bars],
                "volume": [float(b["v"]) for b in bars],
            }
        )

        trading_days = None
        days = payload.get("tradingDays")
        if days:
            arr = np.sort(pd.to_datetime(list(days), errors="coerce").dropna().to_numpy().astype("datetime64[D]"))
            if len(arr):
                trading_days = arr

        inst = self.instruments.get(code) or {}
        from kit_v1.infer import (apply_limit_projection, denormalize_paths,
                                  paths_to_ohlcv, prepare_inference_window)

        window = prepare_inference_window(
            df,
            MARKET,
            scale,
            Lc=Lc,
            Lh=Lh,
            stats=self.stats,
            soft_clip_c=float(getattr(self.cfg.data, "soft_clip_c", 6.0)),
            half_life_days=float(getattr(self.cfg.data, "vol_ema_half_life_days", 5.0)),
            sector_id=int(inst.get("sector", 0) or 0),
            inst_id=int(inst.get("vocab_index", 0) or 0),
            trading_days=trading_days,
        )

        torch = self.torch
        generator = torch.Generator().manual_seed(seed)

        # 增量延续：若上一轮预测的窗口正好落在这次 anchor 的前一根，
        # 就把上一次的路径整体左移一格、末尾补噪声，从 t_start 而不是 t=1 开始积分。
        init = None
        t_start = 1.0
        warm_info = None
        if payload.get("warm") is True:
            prev = self.last_paths.get(f"{code}|{scale}")
            cur_future = [pd.Timestamp(t) for t in window["future_timestamps"]]
            if prev is not None and len(prev["future"]) > 1 and len(cur_future) > 0 \
                    and cur_future[0] == prev["future"][1]:
                init = self._shift_paths(prev["z"], n_paths, generator)
                t_start = float(np.clip(float(payload.get("tStart", 0.4)), 0.05, 0.95))
                warm_info = {"mode": "incremental", "fromAsOf": str(prev["asOf"]), "tStart": t_start}
            else:
                warm_info = {"mode": "fresh", "reason": "上一轮窗口与本轮不连续"}

        started = time.time()
        paths = self.sample(
            window["x_ctx"], window["cond"], Lh=Lh, steps=steps, n_paths=n_paths,
            cfg_w=cfg_w, generator=generator, progress=progress,
            init=init, t_start=t_start,
        )
        sample_seconds = time.time() - started
        self.last_paths[f"{code}|{scale}"] = {
            "asOf": pd.Timestamp(window["ctx_timestamps"][-1]),
            "future": [pd.Timestamp(t) for t in window["future_timestamps"]],
            # sample() 返回 [B,K,Lh,F]，B 恒为 1，这里只存 [K,Lh,F]
            "z": (paths.detach().to("cpu").numpy() if hasattr(paths, "detach") else np.asarray(paths))[0],
        }

        progress("post", 0, 1, "反归一化与重建 K 线")
        feats = denormalize_paths(paths, MARKET, scale, self.stats,
                                  c=float(getattr(self.cfg.data, "soft_clip_c", 6.0)))[0]
        pred = paths_to_ohlcv(feats, window["prev_close"], window["prev_ema"], window["half_life_bars"])
        if limit_rate is not None:
            pred = apply_limit_projection(pred, window["prev_close"], float(limit_rate))

        return self.summarize(
            code=code, scale=scale, pred=pred, window=window, Lc=Lc, Lh=Lh,
            n_paths=n_paths, steps=steps, sample_seconds=sample_seconds,
            # 给前端留够「一整个交易日 + 一点上下文」的历史：
            # 1m 一天 240 根，5m 48 根……统一取 400 根，序列大的周期也不会缺
            history=df.tail(int(payload.get("historyBars", 400))), limit_rate=limit_rate, warm=warm_info,
        )

    def _shift_paths(self, prev_z, n_paths: int, generator):
        """把上一轮 [K,Lh,F] 路径左移一格（丢掉已实现的那根），末尾补噪声。

        新 anchor 到来时，上一轮预测窗口里除最后一根外都已变成真实数据，
        对应的路径样本可以直接平移作为热启动的起点。
        """
        import numpy as np

        torch = self.torch
        prev = np.asarray(prev_z, dtype=np.float32)
        if prev.ndim == 4:
            prev = prev[0]
        _, Lh, F = prev.shape
        keep = min(n_paths, prev.shape[0])

        z = torch.empty((n_paths, Lh, F), dtype=torch.float32)
        z[:keep, :-1] = torch.from_numpy(prev[:keep, 1:].copy())
        # 新出现的那根 bar 没有历史可平移，用同分布噪声补
        z[:keep, -1] = torch.randn(keep, F, generator=generator)
        if n_paths > keep:
            z[keep:] = torch.randn(n_paths - keep, Lh, F, generator=generator)
        return z

    def sample(self, x_ctx, cond, Lh: int, steps: int, n_paths: int, cfg_w: float,
               generator, progress=None, init=None, t_start: float = 1.0):
        """Rectified-flow 采样（与 kit_v1.infer.sampler.flow_sample 同构，加了进度与分批）。

        原文：https://github.com/Luciferbobo/KiT · AGPL-3.0
        """
        torch = self.torch
        device = torch.device(self.device)
        B, Lc, F = x_ctx.shape
        K = int(n_paths)
        BK = B * K
        L = Lc + Lh
        cond_keys = ("clock", "sess", "dow", "event", "month", "yday",
                     "market", "sector", "inst", "scale", "pad_mask")

        x_ctx_rep = x_ctx.to(device).repeat_interleave(K, dim=0)
        cond_rep = {}
        for key in cond_keys:
            val = cond.get(key)
            if val is None:
                continue
            cond_rep[key] = val.to(device).repeat_interleave(K, dim=0)

        use_id_cfg = float(cfg_w) != 1.0
        if use_id_cfg:
            null_keys = ("market", "sector", "inst", "scale")
            cond_noid = {k: (torch.zeros_like(v) if k in null_keys else v) for k, v in cond_rep.items()}
        chunk = self.chunk_size()

        def forward(z_tgt, t_val):
            z_full = torch.cat([x_ctx_rep, z_tgt], dim=1)
            t_vec = torch.full((BK,), float(t_val), device=device, dtype=x_ctx_rep.dtype)
            outs = []
            for s in range(0, BK, chunk):
                e = min(s + chunk, BK)
                sub = {k: v[s:e] for k, v in cond_rep.items()}
                if use_id_cfg:
                    sub2 = {k: v[s:e] for k, v in cond_noid.items()}
                    z2 = torch.cat([z_full[s:e], z_full[s:e]], dim=0)
                    sub_cat = {k: torch.cat([sub[k], sub2[k]], dim=0) for k in sub}
                    v_all = self.model(z2, t_vec[s:e].repeat(2), sub_cat, Lh)
                    parts = v_all.chunk(2, dim=0)
                    outs.append(parts[0] + (cfg_w - 1.0) * (parts[0] - parts[1]))
                else:
                    outs.append(self.model(z_full[s:e], t_vec[s:e], sub, Lh))
            return torch.cat(outs, dim=0).float()

        if init is not None and init.shape[0] == BK:
            z_tgt = init.to(device=device, dtype=x_ctx_rep.dtype)
        else:
            z_tgt = torch.randn(BK, Lh, F, generator=generator, device="cpu",
                                dtype=x_ctx_rep.dtype).to(device)

        with torch.no_grad():
            # 积分方向：t 从 t_start 单调降到 0（t_start=1 就是常规的「从纯噪声开始」）
            origin = float(t_start)
            for i in range(steps):
                t_cur = origin * (1.0 - i / steps)
                t_next = origin * (1.0 - (i + 1) / steps)
                dt = t_cur - t_next
                if progress:
                    # 步数由前端进度环展示，这里只给阶段名，避免标题和副标题重复
                    progress("sample", i, steps, "扩散采样")
                v1 = forward(z_tgt, t_cur)
                z_tgt = z_tgt - dt * v1
                del v1

        if progress:
            progress("sample", steps, steps, "采样完成")
        return z_tgt.view(B, K, Lh, F)

    def chunk_size(self) -> int:
        # 每批序列数：太大爆内存，太小浪费算力
        if self.device == "mps":
            return 4
        if self.device == "cuda":
            return 8
        return 2

    # -- 汇总 -------------------------------------------------------------
    def summarize(self, code, scale, pred, window, Lc, Lh, n_paths, steps,
                  sample_seconds, history, limit_rate, warm=None) -> Dict[str, Any]:
        import numpy as np
        import pandas as pd

        prev_close = float(window["prev_close"])
        close = np.asarray(pred["close"], dtype=np.float64)          # [K,Lh]
        r = np.empty_like(close)
        r[:, 0] = np.log(close[:, 0] / prev_close)
        if Lh > 1:
            r[:, 1:] = np.diff(np.log(close), axis=1)
        terminal = r.sum(axis=1)

        cum = np.cumsum(r, axis=1)
        run_max = np.maximum.accumulate(np.maximum(cum, 0.0), axis=1)
        max_dd = (run_max - cum).max(axis=1)
        vol = r.std(axis=1, ddof=1) if Lh > 1 else np.zeros(r.shape[0])

        qs = (0.05, 0.25, 0.5, 0.75, 0.95)
        def band(arr):
            q = np.quantile(arr, qs, axis=0)
            return {k: [float(x) for x in q[i]] for i, k in enumerate(("q05", "q25", "q50", "q75", "q95"))}

        fut_ts = [pd.Timestamp(t).strftime("%Y-%m-%d %H:%M:%S") for t in window["future_timestamps"]]
        k_rep = int(np.argsort(terminal)[len(terminal) // 2])
        k_bull = int(np.argsort(terminal)[-1])
        k_bear = int(np.argsort(terminal)[0])

        def ohlcv_path(k):
            return [
                {
                    "t": fut_ts[i],
                    "o": float(pred["open"][k][i]),
                    "h": float(pred["high"][k][i]),
                    "l": float(pred["low"][k][i]),
                    "c": float(pred["close"][k][i]),
                    "v": float(pred["volume"][k][i]),
                }
                for i in range(Lh)
            ]

        hist = []
        for row in history.itertuples(index=False):
            hist.append({
                "t": pd.Timestamp(row.datetime).strftime("%Y-%m-%d %H:%M:%S"),
                "o": float(row.open), "h": float(row.high),
                "l": float(row.low), "c": float(row.close), "v": float(row.volume),
            })

        tq = np.quantile(terminal, qs)
        return {
            "code": code,
            "scale": scale,
            "asOf": hist[-1]["t"] if hist else None,
            "lastClose": prev_close,
            "Lc": Lc,
            "Lh": Lh,
            "nPad": int(window["n_pad"]),
            "nPaths": n_paths,
            "steps": steps,
            "device": self.device,
            "precision": self.precision,
            "sampleSeconds": round(sample_seconds, 2),
            "limitRate": limit_rate,
            "warm": warm,
            "history": hist,
            "futureTimestamps": fut_ts,
            "bands": {
                "close": band(close),
                "high": band(np.asarray(pred["high"], dtype=np.float64)),
                "low": band(np.asarray(pred["low"], dtype=np.float64)),
                "volume": band(np.asarray(pred["volume"], dtype=np.float64)),
            },
            "pathMedian": ohlcv_path(k_rep),
            "pathBull": ohlcv_path(k_bull),
            "pathBear": ohlcv_path(k_bear),
            "stats": {
                "retMean": float(terminal.mean()),
                "retMedian": float(tq[2]),
                "retQ05": float(tq[0]),
                "retQ25": float(tq[1]),
                "retQ75": float(tq[3]),
                "retQ95": float(tq[4]),
                "upProb": float((terminal > 0).mean()),
                "volMedian": float(np.median(vol)),
                "maxDdMedian": float(np.median(max_dd)),
                "targetMedian": float(prev_close * np.exp(float(tq[2]))),
                "targetQ05": float(prev_close * np.exp(float(tq[0]))),
                "targetQ95": float(prev_close * np.exp(float(tq[4]))),
            },
        }

    def status(self) -> Dict[str, Any]:
        ready = self.model is not None
        try:
            import torch  # noqa: PLC0415
            torch_version = torch.__version__
            cuda = torch.cuda.is_available()
            mps = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
        except Exception as error:  # noqa: BLE001
            return {"ok": False, "ready": False, "error": f"PyTorch 不可用：{error}"}
        ckpt_ok = (self.ckpt_dir / "step_market_284M.pt").is_file()
        return {
            "ok": True,
            "ready": ready,
            "device": self.device,
            "torch": torch_version,
            "cuda": cuda,
            "mps": mps,
            "ckpt": ckpt_ok,
            "ckptDir": str(self.ckpt_dir),
            "loadSeconds": self.load_seconds,
        }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt-dir", default=str(HERE / "ckpt"))
    parser.add_argument("--device", default=os.environ.get("KIT_DEVICE", "auto"))
    parser.add_argument("--precision", default=os.environ.get("KIT_PRECISION", "auto"))
    parser.add_argument("--warm", action="store_true", help="启动时立即加载模型")
    args = parser.parse_args()

    engine = Engine(Path(args.ckpt_dir), device=args.device, precision=args.precision)
    if args.warm:
        try:
            engine.ensure_model()
        except Exception as error:  # noqa: BLE001
            log(f"预热失败：{error}")

    log("worker 已启动，等待请求")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as error:
            emit({"type": "error", "message": f"请求不是合法 JSON：{error}"})
            continue
        req_id = request.get("id")
        op = request.get("op")
        try:
            if op == "status":
                emit({"id": req_id, "type": "result", "data": engine.status()})
            elif op == "warm":
                engine.ensure_model()
                emit({"id": req_id, "type": "result", "data": engine.status()})
            elif op == "predict":
                def progress(stage, step, total, message=""):
                    emit({"id": req_id, "type": "progress", "stage": stage,
                          "step": step, "total": total, "message": message})
                data = engine.predict(request.get("payload") or {}, progress)
                emit({"id": req_id, "type": "result", "data": data})
            elif op == "shutdown":
                emit({"id": req_id, "type": "result", "data": {"bye": True}})
                break
            else:
                emit({"id": req_id, "type": "error", "message": f"未知操作 {op!r}"})
        except Exception as error:  # noqa: BLE001
            log(traceback.format_exc())
            emit({"id": req_id, "type": "error", "message": str(error)})


if __name__ == "__main__":
    main()
