#!/usr/bin/env python3
"""离屏推理基准：不依赖 Host，直接跑一次 KiT 预测，用来验证运行时与测速。

用法：
    python runtime/bench.py --code 600519.SH --scale 1d --paths 8 --steps 16
    python runtime/bench.py --bars-json /tmp/bars.json   # 由 Host 导出的 bars

数据走与插件相同的抓取逻辑的 Python 等价实现（新浪 + 腾讯），
仅作为自检工具，Host 实际使用的是 src/host/datasource.js。
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent


def curl(url: str, referer: str | None = None) -> str:
    cmd = ["curl", "-s", "-m", "25", "-H", "User-Agent: Mozilla/5.0"]
    if referer:
        cmd += ["-H", f"Referer: {referer}"]
    cmd.append(url)
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def sina_bars(symbol: str, scale_minutes: int, count: int = 1500):
    url = (
        "https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData"
        f"?symbol={symbol}&scale={scale_minutes}&ma=no&datalen={count}"
    )
    rows = json.loads(curl(url, "https://finance.sina.com.cn"))
    out = []
    for row in rows:
        date = row["day"]
        day, _, clock = date.partition(" ")
        out.append(
            {
                "t": date if clock else f"{day} 15:00:00",
                "o": float(row["open"]),
                "h": float(row["high"]),
                "l": float(row["low"]),
                "c": float(row["close"]),
                "v": float(row["volume"]),
            }
        )
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--code", default="600519.SH")
    parser.add_argument("--scale", default="1d", choices=["1m", "5m", "15m", "30m", "1h", "2h", "1d"])
    parser.add_argument("--paths", type=int, default=8)
    parser.add_argument("--steps", type=int, default=16)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--ckpt-dir", default=str(HERE / "ckpt"), help="权重目录；插件的默认位置是 $DSH_HOME/kit-forecast/ckpt")
    parser.add_argument("--bars-json", default="")
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()

    if args.bars_json:
        bars = json.loads(Path(args.bars_json).read_text(encoding="utf-8"))
        if isinstance(bars, dict):
            bars = bars["bars"]
    else:
        digits, _, market = args.code.replace(".", " ").partition(" ")
        market = (market or "SH").lower()
        symbol = f"{market}{digits}"
        if args.scale == "1d":
            url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},day,,,600,qfq"
            data = json.loads(curl(url))["data"][symbol]
            rows = data.get("qfqday") or data.get("day") or []
            bars = [
                {"t": f"{r[0]} 15:00:00", "o": float(r[1]), "h": float(r[3]), "l": float(r[4]),
                 "c": float(r[2]), "v": float(r[5])}
                for r in rows
            ]
        else:
            scale_minutes = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60}[args.scale]
            bars = sina_bars(symbol, scale_minutes)

    print(f"bars={len(bars)} {bars[0]['t']} .. {bars[-1]['t']}", flush=True)

    from engine import Engine  # noqa: PLC0415

    engine = Engine(Path(args.ckpt_dir), device=args.device)
    t0 = time.time()
    engine.ensure_model()
    print(f"load {time.time() - t0:.1f}s device={engine.device}", flush=True)

    def progress(stage, step, total, message=""):
        if stage == "sample":
            print(f"  sample {step}/{total}", flush=True)

    t1 = time.time()
    result = engine.predict(
        {"code": args.code, "scale": args.scale, "bars": bars,
         "nPaths": args.paths, "steps": args.steps, "seed": 7, "limitRate": 0.1},
        progress,
    )
    total = time.time() - t1
    print(
        f"predict {total:.1f}s  median={result['stats']['retMedian']:+.2%}  "
        f"up={result['stats']['upProb']:.0%}  q05={result['stats']['retQ05']:+.2%}  "
        f"q95={result['stats']['retQ95']:+.2%}",
        flush=True,
    )
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        print(f"wrote {args.json_out}", flush=True)


if __name__ == "__main__":
    sys.exit(main())