window.__ModuleLoader__.load({
  id: "dsh-kit-forecast",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react10 = __toESM(require("react"), 1);

// src/client/Panel.jsx
var import_react9 = __toESM(require("react"), 1);

// src/client/api.js
var BASE = "api/kit-forecast";
async function postJson(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error?.message ?? `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
  }
  return data;
}
function fetchStatus() {
  return postJson("/status", {});
}
function searchStocks(keyword) {
  return postJson("/search", { keyword });
}
function fetchBars(code, scale, limit = 120) {
  return postJson("/bars", { code, scale, limit });
}
function fetchTick(code, scale) {
  return postJson("/tick", { code, scale });
}
function fetchModels() {
  return postJson("/models", {});
}
function fetchMarket() {
  return postJson("/market", {});
}
function fetchNews(code, notices = 10, news = 10, { force = false } = {}) {
  return postJson("/news", { code, notices, news, force });
}
function fetchHistory(code, scale, excludeAsOf, limit = 3) {
  return postJson("/history", { code, scale, excludeAsOf, limit });
}
function fetchState() {
  return postJson("/state", {});
}
function patchState(patch) {
  return postJson("/state", patch ?? {});
}
function forgetStock(code) {
  return postJson("/state", { forget: code });
}
async function consume(path, body, { signal, onEvent }) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body ?? {}),
    signal
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message ?? `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
  }
  if (response.body === null) throw new Error("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u6D41\u5F0F\u54CD\u5E94\u3002");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (raw === "" || raw === "[DONE]") continue;
        let event;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }
        onEvent(event);
        if (event?.t === "done") finished = true;
      }
      separator = buffer.indexOf("\n\n");
    }
  }
  try {
    await reader.cancel();
  } catch {
  }
}
function runInsight(payload, options) {
  return consume("/insight", payload, options);
}
function refineForecast(payload) {
  return postJson("/refine", payload);
}
function runForecast(payload, options) {
  return consume("/forecast", payload, options);
}
function runSetup(payload, options) {
  return consume("/setup", payload, options);
}

// src/client/Chart.jsx
var import_react = __toESM(require("react"), 1);

// src/client/view.js
var MIN_VISIBLE = 8;
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
function normalizeView(view, total) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 };
  if (!view || !view.count || view.count >= total) return { start: 0, count: 0 };
  const count = Math.max(MIN_VISIBLE, Math.min(total, Math.round(view.count)));
  const start = Math.max(0, Math.min(total - count, Math.round(view.start)));
  return { start, count };
}
function visibleCount(view, total) {
  const normalized = normalizeView(view, total);
  return normalized.count || total;
}
function zoomView(view, total, factor, pivotIndex) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 };
  const current = normalizeView(view, total);
  const currentCount = current.count || total;
  const next = clamp(Math.round(currentCount * factor), MIN_VISIBLE, total);
  if (next === currentCount) return current;
  if (next >= total) return { start: 0, count: 0 };
  const anchor = Number.isFinite(pivotIndex) ? clamp(pivotIndex, current.start, current.start + currentCount - 1) : current.start + currentCount / 2;
  const ratio = (anchor - current.start) / currentCount;
  const start = Math.round(anchor - ratio * next);
  return { start: Math.max(0, Math.min(total - next, start)), count: next };
}
function panView(view, total, deltaBars) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 };
  const current = normalizeView(view, total);
  if (!current.count) return current;
  const start = Math.max(0, Math.min(total - current.count, Math.round(current.start + deltaBars)));
  return { start, count: current.count };
}
function tailView(total, count) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 };
  const size = clamp(Math.round(count), MIN_VISIBLE, total);
  if (size >= total) return { start: 0, count: 0 };
  return { start: total - size, count: size };
}
function indexAtX(geom, x) {
  const { plotLeft = 0, step = 1, viewStart = 0, viewCount = 1 } = geom ?? {};
  if (!Number.isFinite(x)) return viewStart;
  const raw = viewStart + (x - plotLeft) / Math.max(1e-6, step) - 0.5;
  return clamp(raw, viewStart, viewStart + viewCount - 1);
}
function sessionView(history, nPred, scale, { dailyBars = 60, contextBars = 20 } = {}) {
  const nHist = Array.isArray(history) ? history.length : 0;
  const total = nHist + (Number.isFinite(nPred) ? nPred : 0);
  if (nHist === 0) return { start: 0, count: 0 };
  let historyShow;
  if (scale === "1d") {
    historyShow = Math.min(nHist, dailyBars);
  } else {
    const lastDay = String(history[nHist - 1].t ?? "").slice(0, 10);
    let todayBars = 0;
    for (let i = nHist - 1; i >= 0; i -= 1) {
      if (String(history[i].t ?? "").slice(0, 10) !== lastDay) break;
      todayBars += 1;
    }
    if (todayBars < 30 && todayBars < nHist) {
      let prevDay = null;
      for (let i = nHist - todayBars - 1; i >= 0; i -= 1) {
        const day = String(history[i].t ?? "").slice(0, 10);
        if (prevDay === null) prevDay = day;
        if (day !== prevDay) break;
        todayBars += 1;
      }
    }
    historyShow = Math.min(nHist, todayBars + contextBars);
  }
  const count = Math.min(total, historyShow + (Number.isFinite(nPred) ? nPred : 0));
  if (count >= total) return { start: 0, count: 0 };
  return { start: total - count, count };
}
function sameView(a, b) {
  const left = a ?? { start: 0, count: 0 };
  const right = b ?? { start: 0, count: 0 };
  return left.start === right.start && left.count === right.count;
}

// src/client/Chart.jsx
var h = import_react.default.createElement;
var UP = "#e04a4a";
var DOWN = "#22a06b";
var PRED = "#3b82f6";
var GRID = "rgba(127,127,127,0.16)";
var TEXT = "rgba(127,127,127,0.95)";
function fmtPrice(value) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1e3) return value.toFixed(1);
  if (Math.abs(value) >= 100) return value.toFixed(2);
  return value.toFixed(3);
}
function fmtTime(label) {
  if (!label) return "";
  const date = label.slice(5, 10);
  const time = label.slice(11, 16);
  return time === "15:00" && label.length > 10 ? date : `${date} ${time}`;
}
function fmtTimeFull(label) {
  if (!label) return "";
  const date = label.slice(5, 10);
  const time = label.slice(11, 16);
  return time === "15:00" && label.length > 10 ? date : `${date} ${time}`;
}
function fmtVolume(value) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}\u4EBF`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)}\u4E07`;
  return value.toFixed(0);
}
function ForecastChart({
  data,
  height = 320,
  overlays = null,
  livePrice = null,
  liveCandle = null,
  // 预测发出后真实走出来的 bar（按时间戳对齐到预测窗口上）
  realizedBars = null,
  // AI 修正后的路径（虚线，按时间戳对齐）
  refined = null
}) {
  const canvasRef = import_react.default.useRef(null);
  const wrapRef = import_react.default.useRef(null);
  const [hover, setHover] = import_react.default.useState(null);
  const [hoverPos, setHoverPos] = import_react.default.useState({ x: 0, y: 0 });
  const [drag, setDrag] = import_react.default.useState(null);
  const [view, setView] = import_react.default.useState({ start: 0, count: 0 });
  const geomRef = import_react.default.useRef({ step: 1, plotLeft: 0, plotWidth: 0, viewStart: 0, viewCount: 1, total: 1 });
  const resetKey = [
    data?.code ?? "",
    data?.scale ?? "",
    // 只有预测结果才带 nPaths>0；预览数据不参与，避免每次刷新都复位
    (data?.nPaths ?? 0) > 0 ? data?.asOf ?? "" : ""
  ].join("|");
  import_react.default.useEffect(() => {
    setView(sessionView(data?.history ?? [], data?.pathMedian?.length ?? 0, data?.scale));
  }, [resetKey]);
  const draw = import_react.default.useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !data) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const width = wrap.clientWidth;
    const heightPx = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(heightPx * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${heightPx}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, heightPx);
    const history = data.history ?? [];
    const close = data.bands?.close;
    const median = data.pathMedian ?? [];
    const nHist = history.length;
    const hist = history;
    const nPred = median.length;
    if (nHist === 0) return;
    const predTimes = data.futureTimestamps?.length === nPred ? data.futureTimestamps : median.map((bar) => bar.t);
    const realizedByTime = /* @__PURE__ */ new Map();
    for (const bar of realizedBars ?? []) realizedByTime.set(bar.t, bar);
    const labels = [...hist.map((b) => b.t), ...predTimes];
    const total2 = nHist + nPred;
    const normalized = normalizeView(view, total2);
    const viewCount = normalized.count || total2;
    const viewStart = normalized.start;
    const padLeft = 8;
    const padRight = 66;
    const padTop = 12;
    const volH = Math.round(heightPx * 0.16);
    const axisH = 18;
    const plotH = heightPx - padTop - volH - axisH - 6;
    const plotW = width - padLeft - padRight;
    const step = plotW / viewCount;
    const candleW = Math.max(1.2, Math.min(9, step * 0.62));
    const inView = (i) => i >= viewStart - 0.5 && i <= viewStart + viewCount - 0.5;
    const xOf = (index) => padLeft + (index - viewStart + 0.5) * step;
    geomRef.current = { step, plotLeft: padLeft, plotWidth: plotW, viewStart, viewCount, total: total2 };
    const lows = [];
    const highs = [];
    hist.forEach((bar, i) => {
      if (!inView(i)) return;
      lows.push(bar.l);
      highs.push(bar.h);
    });
    for (let i = 0; i < nPred; i += 1) {
      if (!inView(nHist + i)) continue;
      const lo = data.bands?.low?.q05?.[i];
      const hi = data.bands?.high?.q95?.[i];
      if (Number.isFinite(lo)) lows.push(lo);
      if (Number.isFinite(hi)) highs.push(hi);
      const real = realizedByTime.get(predTimes[i]);
      if (real) {
        lows.push(real.l);
        highs.push(real.h);
      }
    }
    for (const overlay of overlays ?? []) {
      for (const point of overlay.points ?? []) {
        const idx = labels.indexOf(point.t);
        if (idx < 0 || !inView(idx)) continue;
        for (const key of ["q05", "q95", "q50"]) {
          if (Number.isFinite(point[key])) {
            lows.push(point[key]);
            highs.push(point[key]);
          }
        }
        if (Number.isFinite(point.actual)) {
          lows.push(point.actual);
          highs.push(point.actual);
        }
      }
    }
    if (Number.isFinite(livePrice)) {
      lows.push(livePrice);
      highs.push(livePrice);
    }
    if (liveCandle) {
      for (const key of ["o", "h", "l", "c"]) {
        if (Number.isFinite(liveCandle[key])) {
          lows.push(liveCandle[key]);
          highs.push(liveCandle[key]);
        }
      }
    }
    let min = Math.min(...lows);
    let max = Math.max(...highs);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      min = (min || 1) * 0.98;
      max = (max || 1) * 1.02;
    }
    const span = max - min;
    min -= span * 0.06;
    max += span * 0.06;
    const yOf = (price) => padTop + (max - price) / (max - min) * plotH;
    ctx.font = '10px ui-sans-serif, -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = TEXT;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const price = min + (max - min) * i / 4;
      const y = yOf(price);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.fillText(fmtPrice(price), padLeft + plotW + 6, y + 3);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();
    const basePrice = hist[hist.length - 1].c;
    const bandIndexes = [];
    for (let i = 0; i < nPred; i += 1) bandIndexes.push(nHist + i);
    const bandX = [xOf(nHist - 1), ...bandIndexes.map((i) => xOf(i))];
    const bandY = (arr) => [yOf(basePrice), ...arr.map((v) => yOf(v))];
    const paintBand = (upper, lower, color) => {
      ctx.beginPath();
      bandX.forEach((x, i) => i === 0 ? ctx.moveTo(x, bandY(upper)[i]) : ctx.lineTo(x, bandY(upper)[i]));
      for (let i = lower.length; i >= 0; i -= 1) ctx.lineTo(bandX[i], bandY(lower)[i]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    if (close) {
      paintBand(close.q95, close.q05, "rgba(59,130,246,0.13)");
      paintBand(close.q75, close.q25, "rgba(59,130,246,0.20)");
    }
    const dense = step < 2.2;
    const drawCandle = (index, bar, color, alpha = 1, dx = 0, widthScale = 1) => {
      const x = xOf(index) + dx;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, yOf(bar.h));
      ctx.lineTo(x, yOf(bar.l));
      ctx.stroke();
      const top = yOf(Math.max(bar.o, bar.c));
      const bottom = yOf(Math.min(bar.o, bar.c));
      const w = Math.max(1, candleW * widthScale);
      ctx.fillRect(x - w / 2, top, w, Math.max(1, bottom - top));
      ctx.globalAlpha = 1;
    };
    if (dense) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(150,150,150,0.85)";
      ctx.lineWidth = 1;
      let started = false;
      hist.forEach((bar, i) => {
        if (!inView(i)) return;
        const x = xOf(i);
        const y = yOf(bar.c);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      hist.forEach((bar, i) => {
        if (!inView(i)) return;
        drawCandle(i, bar, bar.c >= bar.o ? UP : DOWN, 0.45);
      });
    }
    const paired = realizedByTime.size > 0 && candleW >= 3;
    const pairOffset = paired ? candleW * 0.26 : 0;
    median.forEach((bar, i) => {
      if (!inView(nHist + i)) return;
      drawCandle(
        nHist + i,
        bar,
        bar.c >= bar.o ? PRED : "#8b5cf6",
        0.9,
        paired ? -pairOffset : 0,
        paired ? 0.62 : 1
      );
    });
    if (Array.isArray(refined) && refined.length > 0 && nPred > 0) {
      const byTime = new Map(refined.map((p) => [p.t, p.c]));
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "rgba(245,158,11,0.95)";
      ctx.lineWidth = 1.6;
      let started = false;
      for (let i = 0; i < nPred; i += 1) {
        const value = byTime.get(predTimes[i]);
        if (!Number.isFinite(value) || !inView(nHist + i)) continue;
        const x = xOf(nHist + i);
        const y = yOf(value);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (realizedByTime.size > 0) {
      for (let i = 0; i < nPred; i += 1) {
        const real = realizedByTime.get(predTimes[i]);
        if (!real || !inView(nHist + i)) continue;
        drawCandle(
          nHist + i,
          real,
          real.c >= real.o ? UP : DOWN,
          0.95,
          paired ? pairOffset : 0,
          paired ? 0.62 : 0.9
        );
      }
    }
    if (close) {
      ctx.beginPath();
      ctx.strokeStyle = PRED;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      let started = false;
      for (let i = 0; i < nPred; i += 1) {
        const idx = nHist + i;
        if (!inView(idx)) continue;
        const x = xOf(idx);
        const y = yOf(close.q50[i]);
        if (!started) {
          ctx.moveTo(started ? x : xOf(nHist - 1), started ? y : yOf(basePrice));
          if (!started) ctx.lineTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (liveCandle && Number.isFinite(liveCandle.c)) {
      const x = xOf(nHist - 1) + step * 0.5;
      const color = liveCandle.c >= liveCandle.o ? UP : DOWN;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yOf(liveCandle.h));
      ctx.lineTo(x, yOf(liveCandle.l));
      ctx.stroke();
      const top = yOf(Math.max(liveCandle.o, liveCandle.c));
      const bottom = yOf(Math.min(liveCandle.o, liveCandle.c));
      const w = Math.max(2, candleW * 0.7);
      ctx.fillRect(x - w / 2, top, w, Math.max(1, bottom - top));
      ctx.restore();
      ctx.save();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = "rgba(127,127,127,0.35)";
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();
      ctx.restore();
    }
    if (Number.isFinite(livePrice)) {
      const y = yOf(livePrice);
      if (y >= padTop && y <= padTop + plotH) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(120,200,255,0.55)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + plotW, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (overlays && overlays.length > 0) {
      const timeToIndex = /* @__PURE__ */ new Map();
      labels.forEach((t, i) => timeToIndex.set(t, i));
      overlays.slice(0, 3).forEach((overlay, oi) => {
        const alpha = 0.85 - oi * 0.22;
        const pts = (overlay.points ?? []).map((point) => ({ ...point, x: timeToIndex.get(point.t) })).filter((point) => point.x !== void 0 && inView(point.x));
        if (pts.length === 0) return;
        const realizedRatio = overlay.verify ? overlay.verify.realizedBars / overlay.verify.totalBars : 0;
        const band = oi === 0 && realizedRatio >= 0.25 ? pts.filter((point) => Number.isFinite(point.q05) && Number.isFinite(point.q95)) : [];
        if (band.length > 1) {
          ctx.beginPath();
          band.forEach((point, i) => i === 0 ? ctx.moveTo(xOf(point.x), yOf(point.q95)) : ctx.lineTo(xOf(point.x), yOf(point.q95)));
          for (let i = band.length - 1; i >= 0; i -= 1) ctx.lineTo(xOf(band[i].x), yOf(band[i].q05));
          ctx.closePath();
          ctx.fillStyle = `rgba(240,164,74,${0.06 * (1 - oi * 0.3)})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.strokeStyle = `rgba(240,164,74,${alpha})`;
        ctx.lineWidth = oi === 0 ? 1.4 : 1;
        ctx.setLineDash(oi === 0 ? [5, 3] : [3, 3]);
        let started = false;
        for (const point of pts) {
          if (!Number.isFinite(point.q50)) continue;
          const x = xOf(point.x);
          const y = yOf(point.q50);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        for (const point of pts) {
          if (!Number.isFinite(point.actual)) continue;
          ctx.beginPath();
          ctx.arc(xOf(point.x), yOf(point.actual), Math.min(2.4, Math.max(1.4, step * 0.18)), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(232,232,232,${0.55 + 0.3 * (1 - oi * 0.3)})`;
          ctx.fill();
        }
      });
    }
    ctx.restore();
    if (nPred > 0 && (inView(nHist) || inView(nHist - 1))) {
      const divideX = padLeft + (nHist - viewStart) * step;
      if (divideX > padLeft && divideX < padLeft + plotW) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(127,127,127,0.55)";
        ctx.setLineDash([3, 3]);
        ctx.moveTo(divideX, padTop);
        ctx.lineTo(divideX, padTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = TEXT;
        ctx.fillText("\u9884\u6D4B", divideX + 4, padTop + 10);
      }
    }
    if (Number.isFinite(livePrice)) {
      const y = yOf(livePrice);
      if (y >= padTop && y <= padTop + plotH) {
        ctx.fillStyle = "rgba(120,200,255,0.95)";
        ctx.fillRect(padLeft + plotW + 2, y - 8, padRight - 6, 16);
        ctx.fillStyle = "#0b1220";
        ctx.fillText(fmtPrice(livePrice), padLeft + plotW + 6, y + 3);
      }
    }
    const volTop = padTop + plotH + 8;
    const vMax = Math.max(
      1,
      ...hist.map((b) => inView(hist.indexOf(b)) ? b.v : 0),
      ...(data.bands?.volume?.q50 ?? []).map((v) => v * 1.1)
    );
    const vBarW = Math.max(1, candleW * 0.8);
    hist.forEach((bar, i) => {
      if (!inView(i)) return;
      const x = xOf(i);
      const hgt = bar.v / vMax * volH;
      ctx.fillStyle = bar.c >= bar.o ? "rgba(224,74,74,0.35)" : "rgba(34,160,107,0.35)";
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt);
    });
    (data.bands?.volume?.q50 ?? []).forEach((v, i) => {
      if (!inView(nHist + i)) return;
      const real = realizedByTime.get(predTimes[i]);
      const x = xOf(nHist + i);
      const value = real ? real.v : v;
      const hgt = value / vMax * volH;
      ctx.fillStyle = real ? real.c >= real.o ? "rgba(224,74,74,0.5)" : "rgba(34,160,107,0.5)" : "rgba(59,130,246,0.55)";
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt);
    });
    const labelCount = Math.max(2, Math.min(7, Math.floor(plotW / 84)));
    ctx.fillStyle = TEXT;
    for (let i = 0; i < labelCount; i += 1) {
      const index = viewStart + Math.round(i * (viewCount - 1) / (labelCount - 1));
      const text = fmtTime(labels[index]);
      const x = xOf(index);
      const w = ctx.measureText(text).width;
      ctx.fillText(text, Math.min(Math.max(x - w / 2, padLeft), padLeft + plotW - w), heightPx - 5);
    }
    if (hover !== null) {
      const index = Math.round(indexAtX({ plotLeft: padLeft, step, viewStart, viewCount }, hoverPos.x));
      const x = xOf(index);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(127,127,127,0.5)";
      ctx.setLineDash([2, 2]);
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, volTop + volH);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hoverPos.y >= padTop && hoverPos.y <= padTop + plotH) {
        ctx.beginPath();
        ctx.moveTo(padLeft, hoverPos.y);
        ctx.lineTo(padLeft + plotW, hoverPos.y);
        ctx.stroke();
        const price = min + (max - min) * (1 - (hoverPos.y - padTop) / plotH);
        ctx.fillStyle = "rgba(127,127,127,0.9)";
        ctx.fillRect(padLeft + plotW + 2, hoverPos.y - 8, padRight - 6, 16);
        ctx.fillStyle = "#fff";
        ctx.fillText(fmtPrice(price), padLeft + plotW + 6, hoverPos.y + 3);
      }
    }
  }, [data, height, hover, hoverPos, overlays, livePrice, liveCandle, realizedBars, refined, view]);
  import_react.default.useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return void 0;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);
  const zoomBy = (factor) => {
    const { total: total2 } = geomRef.current;
    setView((current) => zoomView(current, total2, factor));
  };
  const resetView = () => setView({ start: 0, count: 0 });
  const focusPrediction = () => {
    const { total: total2 } = geomRef.current;
    const nPred = (data?.pathMedian ?? []).length;
    setView(tailView(total2, Math.max(nPred * 2, 40)));
  };
  const onWheel = (event) => {
    if (!data) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const geom = geomRef.current;
    const cursorIndex = indexAtX(geom, event.clientX - rect.left);
    const factor = event.deltaY < 0 ? 0.82 : 1.22;
    setView((current) => zoomView(current, geom.total, factor, cursorIndex));
  };
  const dragRef = import_react.default.useRef(null);
  dragRef.current = drag;
  const onMouseDown = (event) => {
    if (event.button !== 0) return;
    const { viewStart, viewCount, step } = geomRef.current;
    if (!viewCount || viewCount >= geomRef.current.total) return;
    event.preventDefault();
    setDrag({ x: event.clientX, start: viewStart, step, moved: false });
  };
  import_react.default.useEffect(() => {
    if (!drag) return void 0;
    const move = (event) => {
      const state = dragRef.current;
      if (!state) return;
      const { total: total2, viewCount, step } = geomRef.current;
      const dx = event.clientX - state.x;
      if (!state.moved && Math.abs(dx) < 3) return;
      if (!state.moved) state.moved = true;
      const shift = Math.round(-dx / Math.max(0.5, step));
      setView({
        start: panView({ start: state.start, count: viewCount }, total2, shift).start,
        count: viewCount
      });
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag]);
  const onMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (hover === null) setHover(0);
  };
  const onLeave = () => setHover(null);
  let tip = null;
  if (hover !== null && data) {
    const index = Math.round(indexAtX(geomRef.current, hoverPos.x));
    const nHist = data.history?.length ?? 0;
    const hist = data.history ?? [];
    if (index < nHist) {
      const bar = hist[index];
      const prev = index > 0 ? hist[index - 1] : null;
      if (bar) {
        const change = prev && prev.c > 0 ? bar.c / prev.c - 1 : null;
        tip = {
          kind: "\u5386\u53F2",
          label: fmtTimeFull(bar.t),
          rows: [
            ["\u5F00", fmtPrice(bar.o)],
            ["\u9AD8", fmtPrice(bar.h)],
            ["\u4F4E", fmtPrice(bar.l)],
            ["\u6536", fmtPrice(bar.c)],
            ["\u6DA8\u8DCC", change === null ? "-" : `${change >= 0 ? "+" : ""}${(change * 100).toFixed(2)}%`, change === null ? null : change >= 0 ? "up" : "down"],
            ["\u91CF", fmtVolume(bar.v)]
          ]
        };
      }
    } else {
      const i = index - nHist;
      const bar = data.pathMedian?.[i];
      const q = data.bands?.close;
      if (bar) {
        const base = hist[hist.length - 1]?.c;
        const rel = base ? bar.c / base - 1 : null;
        tip = {
          kind: "\u9884\u6D4B",
          label: fmtTimeFull(bar.t),
          rows: [
            ["\u4E2D\u4F4D", fmtPrice(q?.q50?.[i])],
            ["\u76F8\u5BF9\u73B0\u4EF7", rel === null ? "-" : `${rel >= 0 ? "+" : ""}${(rel * 100).toFixed(2)}%`, rel === null ? null : rel >= 0 ? "up" : "down"],
            ["q05", fmtPrice(q?.q05?.[i])],
            ["q25", fmtPrice(q?.q25?.[i])],
            ["q75", fmtPrice(q?.q75?.[i])],
            ["q95", fmtPrice(q?.q95?.[i])]
          ]
        };
      }
    }
  }
  const total = (data?.history?.length ?? 0) + (data?.pathMedian?.length ?? 0);
  const shown = visibleCount(view, total);
  const auto = sessionView(data?.history ?? [], data?.pathMedian?.length ?? 0, data?.scale);
  const zoomed = !sameView(view, auto);
  const wrapWidth = wrapRef.current?.clientWidth ?? 600;
  const tipLeft = tip ? hoverPos.x + 180 > wrapWidth ? Math.max(8, hoverPos.x - 172) : hoverPos.x + 16 : 0;
  const tipTop = tip ? Math.max(8, Math.min(hoverPos.y - 10, height - 172)) : 0;
  return h(
    "div",
    { className: `kfc-chart ${drag ? "dragging" : ""}`, ref: wrapRef },
    h(
      "div",
      { className: "kfc-chartTools" },
      h("button", { type: "button", title: "\u653E\u5927\uFF08\u4E5F\u53EF\u4EE5\u6EDA\u8F6E\uFF09", onClick: () => zoomBy(0.7) }, "+"),
      h("button", { type: "button", title: "\u7F29\u5C0F\uFF08\u4E5F\u53EF\u4EE5\u6EDA\u8F6E\uFF09", onClick: () => zoomBy(1.4) }, "\u2212"),
      h("button", { type: "button", title: "\u770B\u9884\u6D4B\u533A\u95F4", onClick: focusPrediction, className: "wide" }, "\u9884\u6D4B"),
      h("button", { type: "button", title: "\u590D\u4F4D", onClick: resetView, className: "wide" }, "\u5168\u89C8")
    ),
    h("canvas", {
      ref: canvasRef,
      onMouseMove,
      onMouseDown,
      onMouseLeave: onLeave,
      onWheel
    }),
    tip ? h(
      "div",
      {
        className: `kfc-tip kind-${tip.kind === "\u9884\u6D4B" ? "pred" : "hist"}`,
        style: { left: `${tipLeft}px`, top: `${tipTop}px`, right: "auto" }
      },
      h(
        "div",
        { className: "kfc-tipHead" },
        h("span", { className: "kfc-tipKind" }, tip.kind),
        h("span", { className: "kfc-tipLabel" }, tip.label)
      ),
      tip.rows.map(([label, value, tone], i) => h(
        "div",
        { className: "kfc-tipRow", key: i },
        h("span", null, label),
        h("b", { className: tone ?? "" }, value)
      ))
    ) : null,
    zoomed ? h("div", { className: "kfc-zoomHint" }, `\u5DF2\u653E\u5927\uFF1A\u663E\u793A ${shown}/${total} \u6839 \xB7 \u6EDA\u8F6E\u7F29\u653E \xB7 \u62D6\u62FD\u5E73\u79FB`) : null
  );
}

// src/client/ProgressOverlay.jsx
var import_react2 = __toESM(require("react"), 1);
var h2 = import_react2.default.createElement;
var RING = 56;
var STROKE = 4;
var RADIUS = (RING - STROKE) / 2;
var CIRCUMFERENCE = 2 * Math.PI * RADIUS;
function ProgressOverlay({ steps, total, stage, elapsed, onCancel, labels }) {
  const raw = total > 0 ? Math.min(1, steps / total) : 0;
  const percent = total > 0 ? Math.round(raw * 100) : 0;
  const hasSteps = total > 0;
  const dash = Math.max(0.08, raw) * CIRCUMFERENCE;
  const shownPercent = hasSteps ? percent : 0;
  return h2(
    "div",
    { className: "kfc-overlay" },
    h2(
      "div",
      { className: "kfc-overlayCard" },
      h2(
        "div",
        { className: "kfc-ring" },
        h2(
          "svg",
          { width: RING, height: RING, viewBox: `0 0 ${RING} ${RING}`, "aria-hidden": "true" },
          h2("circle", {
            cx: RING / 2,
            cy: RING / 2,
            r: RADIUS,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: STROKE,
            opacity: 0.18
          }),
          h2("circle", {
            cx: RING / 2,
            cy: RING / 2,
            r: RADIUS,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: STROKE,
            strokeLinecap: "round",
            strokeDasharray: `${dash} ${CIRCUMFERENCE}`,
            transform: `rotate(-90 ${RING / 2} ${RING / 2})`,
            style: { transition: "stroke-dasharray .3s ease" }
          })
        ),
        h2("span", { className: "kfc-ringText" }, hasSteps ? `${shownPercent}%` : "\xB7\xB7\xB7")
      ),
      h2(
        "div",
        { className: "kfc-overlayText" },
        h2("b", null, stage || labels.working),
        h2("span", null, hasSteps ? `${labels.stepsUnit} ${steps}/${total} \xB7 ${elapsed.toFixed(1)}s` : `${elapsed.toFixed(1)}s`)
      ),
      h2(
        "button",
        { type: "button", className: "kfc-ghost kfc-overlayCancel", onClick: onCancel },
        labels.cancel
      )
    )
  );
}

// src/client/InsightPanel.jsx
var import_react4 = __toESM(require("react"), 1);

// src/client/Markdown.jsx
var import_react3 = __toESM(require("react"), 1);
var h3 = import_react3.default.createElement;
function safeHref(raw) {
  const url = String(raw ?? "").trim();
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
  return null;
}
function parseInline(text, keyPrefix = "i") {
  const nodes = [];
  const source = String(text ?? "");
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)）]+)/g;
  let last = 0;
  let match;
  let index = 0;
  const pushText = (chunk, emphasizeSigned) => {
    if (chunk === "") return;
    if (!emphasizeSigned) {
      nodes.push(chunk);
      return;
    }
    const re = /([+-]\d+(?:\.\d+)?%)/g;
    let cursor = 0;
    let m;
    while ((m = re.exec(chunk)) !== null) {
      if (m.index > cursor) nodes.push(chunk.slice(cursor, m.index));
      nodes.push(h3("span", {
        key: `${keyPrefix}-s${index++}`,
        className: m[1].startsWith("+") ? "kfc-mdUp" : "kfc-mdDown"
      }, m[1]));
      cursor = m.index + m[1].length;
    }
    if (cursor < chunk.length) nodes.push(chunk.slice(cursor));
  };
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) pushText(source.slice(last, match.index), true);
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("`")) {
      nodes.push(h3("code", { key, className: "kfc-mdCode" }, token.slice(1, -1)));
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(h3("strong", { key }, parseInline(token.slice(2, -2), `${key}-b`)));
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push(h3("em", { key }, parseInline(token.slice(1, -1), `${key}-i`)));
    } else if (token.startsWith("[")) {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = safeHref(token.slice(close + 2, -1));
      nodes.push(href === null ? h3("span", { key }, label) : h3("a", { key, href, target: "_blank", rel: "noreferrer noopener" }, parseInline(label, `${key}-a`)));
    } else {
      const href = safeHref(token);
      nodes.push(h3("a", { key, href: href ?? void 0, target: "_blank", rel: "noreferrer noopener" }, token));
    }
    last = match.index + token.length;
  }
  if (last < source.length) pushText(source.slice(last), true);
  return nodes;
}
function isTableSeparator(line) {
  return /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-");
}
function splitRow(line) {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
}
function Markdown({ text, className = "" }) {
  const blocks = [];
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    if (/^```/.test(line.trim())) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(h3("pre", { key: key++, className: "kfc-mdPre" }, h3("code", null, body.join("\n"))));
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(h3("hr", { key: key++, className: "kfc-mdHr" }));
      i += 1;
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      blocks.push(h3(
        `h${Math.min(6, level + 2)}`,
        { key: key++, className: "kfc-mdHeading" },
        parseInline(heading[2], `h${key}`)
      ));
      i += 1;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(h3(
        "blockquote",
        { key: key++, className: "kfc-mdQuote" },
        h3(Markdown, { text: body.join("\n") })
      ));
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push(h3(
        "div",
        { key: key++, className: "kfc-mdTableWrap" },
        h3(
          "table",
          { className: "kfc-mdTable" },
          h3("thead", null, h3("tr", null, head.map((cell, ci) => h3("th", { key: ci }, parseInline(cell, `th${ci}`))))),
          h3("tbody", null, rows.map((row, ri) => h3(
            "tr",
            { key: ri },
            row.map((cell, ci) => h3("td", { key: ci }, parseInline(cell, `td${ri}-${ci}`)))
          )))
        )
      ));
      continue;
    }
    const listMatch = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2]);
      const items = [];
      let depth = 0;
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) {
          if (items.length > 0 && /^\s{2,}\S/.test(lines[i])) {
            items[items.length - 1].text += ` ${lines[i].trim()}`;
            i += 1;
            continue;
          }
          break;
        }
        depth = Math.max(depth, Math.floor(m[1].length / 2));
        items.push({ ordered: /\d/.test(m[2]), text: m[3], indent: Math.floor(m[1].length / 2) });
        i += 1;
      }
      const build = (list) => {
        const tag = list[0]?.ordered ? "ol" : "ul";
        return h3(
          tag,
          { key: key++, className: "kfc-mdList" },
          list.map((item, ii) => h3("li", { key: ii }, parseInline(item.text, `li${ii}`)))
        );
      };
      blocks.push(build(items));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i].trim()) && !/^\s{0,3}#{1,6}\s/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i])) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length > 0) {
      blocks.push(h3("p", { key: key++, className: "kfc-mdP" }, parseInline(para.join("\n"), "p")));
    } else {
      i += 1;
    }
  }
  return h3("div", { className: `kfc-md ${className}` }, blocks);
}

// src/client/InsightPanel.jsx
var h4 = import_react4.default.createElement;
function InsightPanel({
  state,
  text,
  model,
  error,
  onRun,
  onStop,
  onClear,
  t,
  refine,
  onRefine,
  canRefine
}) {
  const running = state === "running";
  const hasText = text !== "";
  return h4(
    "div",
    { className: `kfc-insight ${running ? "running" : ""}` },
    h4(
      "div",
      { className: "kfc-insightBar" },
      h4("span", { className: "kfc-insightTitle" }, t("insightTitle")),
      model ? h4("span", { className: "kfc-insightModel", title: model }, model) : null,
      h4("span", { className: "kfc-insightSpacer" }),
      running ? h4("button", { type: "button", className: "kfc-ghost", onClick: onStop }, t("cancel")) : h4("button", {
        type: "button",
        className: hasText ? "kfc-ghost" : "kfc-primary kfc-insightRun",
        onClick: onRun
      }, hasText ? t("insightRedo") : t("insightRun")),
      hasText && !running ? h4("button", { type: "button", className: "kfc-ghost", onClick: onClear }, t("insightClear")) : null,
      canRefine ? h4("button", {
        type: "button",
        className: refine?.state === "done" ? "kfc-ghost" : "kfc-primary",
        disabled: refine?.state === "running",
        title: t("refineHint"),
        onClick: onRefine
      }, refine?.state === "running" ? t("refining") : refine?.state === "done" ? t("refineRedo") : t("refineRun")) : null
    ),
    // 修正结果
    refine?.state === "error" ? h4("div", { className: "kfc-insightError" }, refine.error) : null,
    refine?.state === "done" ? h4(
      "div",
      { className: "kfc-refineBox" },
      h4(
        "div",
        { className: "kfc-refineHead" },
        h4("span", { className: "kfc-refineLabel" }, t("refineTitle")),
        Number.isFinite(refine.originalRet) && Number.isFinite(refine.ret) ? h4(
          "span",
          { className: "kfc-refineDelta" },
          `${(refine.originalRet * 100).toFixed(2)}% \u2192 `,
          h4("b", null, `${(refine.ret * 100).toFixed(2)}%`)
        ) : null,
        Number.isFinite(refine.confidence) ? h4("span", { className: "kfc-refineConf" }, `${t("refineConfidence")} ${Math.round(refine.confidence * 100)}%`) : null,
        refine.model ? h4("span", { className: "kfc-insightModel" }, refine.model) : null
      ),
      refine.reasons?.length ? h4(
        "ul",
        { className: "kfc-refineReasons" },
        refine.reasons.map((reason, index) => h4("li", { key: index }, reason))
      ) : null,
      h4(
        "div",
        { className: "kfc-refineNote" },
        refine.outOfBand ? `${t("refineClamped")}${Number.isFinite(refine.rawRet) ? `\uFF08\u539F\u59CB ${(refine.rawRet * 100).toFixed(2)}%\uFF09` : ""}` : t("refineNote")
      )
    ) : null,
    error ? h4("div", { className: "kfc-insightError" }, error) : null,
    hasText ? h4(
      "div",
      { className: "kfc-insightText" },
      h4(Markdown, { text }),
      running ? h4("span", { className: "kfc-caret" }) : null
    ) : running ? h4("div", { className: "kfc-insightHint" }, t("insightWorking")) : h4("div", { className: "kfc-insightHint" }, t("insightHint"))
  );
}

// src/client/MarketBar.jsx
var import_react5 = __toESM(require("react"), 1);
var h5 = import_react5.default.createElement;
function fmtIndex(value) {
  if (!Number.isFinite(value)) return "\u2014";
  return value >= 1e4 ? value.toFixed(0) : value.toFixed(2);
}
function BreadthBar({ up, down, flat, t }) {
  const total = Math.max(1, up + down + flat);
  const ratio = (value) => `${value / total * 100}%`;
  return h5(
    "div",
    { className: "kfc-breadth" },
    h5(
      "div",
      { className: "kfc-breadthBar", title: `${t("breadthUp")} ${up} / ${t("breadthDown")} ${down} / ${t("breadthFlat")} ${flat}` },
      h5("i", { className: "up", style: { width: ratio(up) } }),
      h5("i", { className: "flat", style: { width: ratio(flat) } }),
      h5("i", { className: "down", style: { width: ratio(down) } })
    ),
    h5(
      "div",
      { className: "kfc-breadthText" },
      h5("span", { className: "up" }, `${t("breadthUp")} ${up}`),
      h5("span", { className: "down" }, `${t("breadthDown")} ${down}`)
    )
  );
}
function MarketBar({ data, loading, activeCode, onPick, t }) {
  const indices = data?.indices ?? [];
  const ref = import_react5.default.useRef(null);
  const [stuck, setStuck] = import_react5.default.useState(false);
  import_react5.default.useEffect(() => {
    const node = ref.current;
    const root = node?.closest(".kfc-root");
    if (!root || !node) return void 0;
    const sync = () => {
      const header2 = root.querySelector(".kfc-header");
      const offset = header2 ? Math.round(header2.getBoundingClientRect().height) : 0;
      node.style.setProperty("--kfc-market-top", `${offset}px`);
      setStuck(root.scrollTop > offset - 12);
    };
    const onScroll = () => setStuck(root.scrollTop > (ref.current?.offsetTop ?? 0) - 12);
    sync();
    root.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
    const header = root.querySelector(".kfc-header");
    if (observer && header) observer.observe(header);
    return () => {
      root.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, []);
  return h5(
    "section",
    { className: `kfc-market ${stuck ? "stuck" : ""}`, ref },
    h5(
      "div",
      { className: "kfc-marketRow" },
      indices.map((item) => {
        const up = (item.changePercent ?? 0) >= 0;
        const active = item.code === activeCode;
        const chg = Number.isFinite(item.changePercent) ? `${up ? "+" : ""}${item.changePercent.toFixed(2)}%` : "\u2014";
        return h5(
          "button",
          {
            key: item.code,
            type: "button",
            className: `kfc-index ${active ? "active" : ""} ${up ? "up" : "down"}`,
            title: `${item.name} \xB7 ${t("indexHint")}`,
            onClick: () => onPick(item)
          },
          h5("span", { className: "kfc-indexName" }, item.short ?? item.name),
          h5("span", { className: "kfc-indexPrice" }, fmtIndex(item.price)),
          h5("span", { className: "kfc-indexChg" }, chg)
        );
      }),
      loading && indices.length === 0 ? h5("span", { className: "kfc-marketLoading" }, t("loadingShort")) : null
    ),
    data?.breadth ? h5(BreadthBar, { ...data.breadth, t }) : null
  );
}

// src/client/SettingsDialog.jsx
var import_react6 = __toESM(require("react"), 1);
var h6 = import_react6.default.createElement;
function SettingsDialog({
  open,
  onClose,
  models,
  loading,
  selected,
  onSelect,
  onRefresh,
  error,
  t
}) {
  import_react6.default.useEffect(() => {
    if (!open) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const current = models.find((m) => m.provider === selected?.provider && m.model === selected?.model);
  return h6(
    "div",
    { className: "kfc-modalMask", onClick: onClose },
    h6(
      "div",
      {
        className: "kfc-modal",
        onClick: (event) => event.stopPropagation(),
        role: "dialog",
        "aria-modal": "true"
      },
      h6(
        "div",
        { className: "kfc-modalHead" },
        h6("b", null, t("settingsTitle")),
        h6("button", { type: "button", className: "kfc-ghost kfc-modalClose", onClick: onClose }, "\u2715")
      ),
      h6(
        "div",
        { className: "kfc-modalBody" },
        h6(
          "div",
          { className: "kfc-field" },
          h6("div", { className: "kfc-fieldLabel" }, t("settingsModel")),
          h6("div", { className: "kfc-fieldHint" }, t("settingsModelHint")),
          loading ? h6("div", { className: "kfc-modalHint" }, t("newsLoading")) : null,
          !loading && models.length === 0 ? h6("div", { className: "kfc-modalEmpty" }, t("settingsNoModel")) : null,
          !loading && models.length > 0 ? h6(
            "div",
            { className: "kfc-modelList" },
            // 「跟随默认」永远是第一项
            h6(
              "button",
              {
                type: "button",
                className: `kfc-modelItem ${!selected?.provider ? "active" : ""}`,
                onClick: () => onSelect(null)
              },
              h6("span", { className: "kfc-modelName" }, t("settingsFollowDefault")),
              h6("span", { className: "kfc-modelHint" }, t("settingsFollowHint")),
              !selected?.provider ? h6("span", { className: "kfc-modelCheck" }, "\u2713") : null
            ),
            models.map((item) => {
              const active = current && item.provider === current.provider && item.model === current.model;
              return h6(
                "button",
                {
                  key: `${item.provider}/${item.model}`,
                  type: "button",
                  className: `kfc-modelItem ${active ? "active" : ""}`,
                  onClick: () => onSelect({ provider: item.provider, model: item.model })
                },
                h6("span", { className: "kfc-modelName" }, item.name ?? item.model),
                h6("span", { className: "kfc-modelHint" }, item.provider),
                active ? h6("span", { className: "kfc-modelCheck" }, "\u2713") : null
              );
            })
          ) : null,
          error ? h6("div", { className: "kfc-modalError" }, error) : null,
          h6(
            "div",
            { className: "kfc-modalActions" },
            h6(
              "button",
              { type: "button", className: "kfc-ghost", onClick: onRefresh, disabled: loading },
              t("settingsRefresh")
            ),
            h6("button", { type: "button", className: "kfc-primary", onClick: onClose }, t("settingsDone"))
          )
        )
      )
    )
  );
}

// src/client/NewsPanel.jsx
var import_react7 = __toESM(require("react"), 1);

// src/client/i18n.js
var NS = "kit-forecast";
var zh = {
  nav: "KiT \u8D70\u52BF\u9884\u6D4B",
  title: "KiT \u8D70\u52BF\u9884\u6D4B",
  titleTag: "A \u80A1 \xB7 \u5B9E\u65F6",
  subtitle: "\u7528 KiT \u6269\u6563\u6A21\u578B\u5BF9\u4EFB\u610F A \u80A1\u505A\u591A\u5468\u671F\u6982\u7387\u9884\u6D4B\uFF1A\u4E0D\u662F\u5355\u4E00\u6DA8\u8DCC\uFF0C\u800C\u662F\u4E00\u65CF\u672A\u6765\u8DEF\u5F84",
  searchPlaceholder: "\u80A1\u7968\u4EE3\u7801\u6216\u540D\u79F0\uFF0C\u5982 600519 / \u8D35\u5DDE\u8305\u53F0",
  recheck: "\u91CD\u65B0\u68C0\u6D4B\u73AF\u5883",
  envReady: "\u73AF\u5883\u5C31\u7EEA",
  envMissing: "\u9700\u521D\u59CB\u5316",
  setupTitle: "\u7B2C\u4E00\u6B21\u4F7F\u7528\u9700\u8981\u51C6\u5907\u8FD0\u884C\u73AF\u5883",
  setupBody: "\u4F1A\u505A\u4E09\u4EF6\u4E8B\uFF1A\u521B\u5EFA Python \u865A\u62DF\u73AF\u5883\u3001\u5B89\u88C5 PyTorch \u7B49\u4F9D\u8D56\u3001\u4E0B\u8F7D KiT-284M \u6743\u91CD\uFF081.1 GB\uFF09\u3002\u4E0B\u8F7D\u652F\u6301\u65AD\u70B9\u7EED\u4F20\uFF0C\u521D\u59CB\u5316\u5B8C\u6210\u540E\u4E0D\u9700\u8981\u518D\u6765\u4E00\u6B21\uFF1B\u4E5F\u53EF\u4EE5\u81EA\u5DF1\u51C6\u5907\u540E\u5728\u63D2\u4EF6\u914D\u7F6E\u91CC\u6307\u5B9A dataDir / python\u3002",
  setupStart: "\u521D\u59CB\u5316\u8FD0\u884C\u73AF\u5883",
  setupRunning: "\u6B63\u5728\u521D\u59CB\u5316\u2026",
  setupDone: "\u521D\u59CB\u5316\u5B8C\u6210",
  setupFailed: "\u521D\u59CB\u5316\u5931\u8D25",
  qualityHint: "\u91C7\u6837\u8DEF\u5F84\u6570\u4E0E\u6269\u6563\u6B65\u6570\u7684\u6863\u4F4D\uFF1A\u8D8A\u7CBE\u7EC6\u8D8A\u6162",
  scaleHint: "K \u7EBF\u5468\u671F\uFF08\u62EC\u53F7\u91CC\u662F\u300C\u5386\u53F2\u6839\u6570 / \u9884\u6D4B\u6839\u6570\u300D\uFF09",
  "quality.fast": "\u5FEB\u901F",
  "quality.standard": "\u6807\u51C6",
  "quality.fine": "\u7CBE\u7EC6",
  auto: "\u5B9E\u65F6\u8DDF\u968F",
  autoHint: "\u76EF\u7740\u6700\u540E\u4E00\u6839\u5DF2\u6536\u76D8 K \u7EBF\uFF1A\u53EA\u6709\u51FA\u73B0\u65B0 bar \u624D\u91CD\u7B97\uFF0C\u5237\u65B0\u65F6\u65E7\u56FE\u4FDD\u7559\u4E0D\u95EA",
  watching: "\u8DDF\u968F\u4E2D",
  watchHint: "\u884C\u60C5\u5B9E\u65F6\u5237\u65B0\uFF1B\u51FA\u73B0\u65B0\u6536\u76D8 K \u7EBF\u65F6\u81EA\u52A8\u91CD\u7B97",
  quoteOnly: "\u884C\u60C5\u5237\u65B0\u4E2D",
  quoteOnlyHint: "\u884C\u60C5\u6BCF\u5206\u949F\u5237\u65B0\uFF1B\u6253\u5F00\u300C\u5B9E\u65F6\u8DDF\u968F\u300D\u624D\u4F1A\u5728\u65B0 K \u7EBF\u6536\u76D8\u65F6\u81EA\u52A8\u91CD\u7B97",
  watchFail: "\u4E0A\u4E00\u6B21\u5FC3\u8DF3\u5931\u8D25\uFF0C\u4F1A\u81EA\u52A8\u91CD\u8BD5",
  watchRetry: "\u8DDF\u968F\u91CD\u8BD5\u4E2D",
  limit: "\u6DA8\u8DCC\u505C\u7EA6\u675F",
  limitHint: "\u628A\u9884\u6D4B\u8DEF\u5F84\u6295\u5F71\u5230\u5F53\u65E5\u6DA8\u8DCC\u505C\u533A\u95F4\u5185",
  compare: "\u5BF9\u6BD4\u5386\u53F2",
  compareHint: "\u5728\u540C\u4E00\u5F20\u56FE\u4E0A\u53E0\u52A0\u8FC7\u53BB\u7684\u9884\u6D4B\uFF0C\u548C\u771F\u5B9E\u8D70\u51FA\u6765\u7684 K \u7EBF\u5BF9\u6BD4",
  compareTitle: "\u5386\u53F2\u9884\u6D4B",
  comparePred: "\u5F53\u65F6\u9884\u6D4B",
  compareActual: "\u5B9E\u9645\u8D70\u51FA",
  compareNote: "\u6A59\u7EBF\uFF1D\u5F53\u65F6\u7684\u9884\u6D4B\u4E2D\u4F4D\uFF0C\u767D\u70B9\uFF1D\u771F\u5B9E\u6536\u76D8",
  incremental: "\u589E\u91CF\u5EF6\u7EED",
  incrementalHint: "\u590D\u7528\u4E0A\u4E00\u6B21\u7684\u91C7\u6837\u8DEF\u5F84\u505A\u70ED\u542F\u52A8\uFF08SDEdit \u5F0F\uFF09\uFF0C\u6B65\u6570\u66F4\u5C11\u3001\u66F4\u5FEB\uFF0C\u4F46\u5206\u5E03\u6709\u8F7B\u5FAE\u504F\u7F6E\uFF0C\u9002\u5408\u76D8\u4E2D\u5FEB\u901F\u5237\u65B0",
  watchlist: "\u5E38\u7528",
  pinHint: "\u628A\u5F53\u524D\u80A1\u7968\u52A0\u5165\u5E38\u7528\uFF08\u7F6E\u9876\uFF09",
  unpinHint: "\u53D6\u6D88\u7F6E\u9876",
  removeHint: "\u4ECE\u5E38\u7528\u91CC\u79FB\u9664",
  pinnedNotice: "\u5DF2\u52A0\u5165\u5E38\u7528",
  unpinnedNotice: "\u5DF2\u53D6\u6D88\u7F6E\u9876",
  restoring: "\u6B63\u5728\u6062\u590D\u4E0A\u6B21\u7684\u80A1\u7968\u4E0E\u9884\u6D4B\u2026",
  updating: "\u5237\u65B0\u4E2D",
  updated: "\u66F4\u65B0\u4E8E",
  quoteUpdated: "\u884C\u60C5",
  livePriceHint: "\u76D8\u4E2D\u5B9E\u65F6\u6210\u4EA4\u4EF7\uFF0C\u865A\u7EBF\u662F\u5B83\u5728\u56FE\u4E0A\u7684\u4F4D\u7F6E",
  formingDropped: "\u5DF2\u5254\u9664\u672A\u6536\u76D8 bar",
  marketClosed: "\u4F11\u5E02",
  needStock: "\u8BF7\u5148\u8F93\u5165\u80A1\u7968\u4EE3\u7801\u6216\u540D\u79F0\uFF0C\u5E76\u4ECE\u8054\u60F3\u5217\u8868\u91CC\u9009\u4E00\u53EA\u80A1\u7968",
  needSetup: "\u8FD0\u884C\u73AF\u5883\u8FD8\u6CA1\u51C6\u5907\u597D\uFF0C\u8BF7\u5148\u5B8C\u6210\u521D\u59CB\u5316",
  preparing: "\u51C6\u5907\u4E2D\u2026",
  stepsUnit: "\u6B65",
  noStock: "\u672A\u9009\u62E9\u80A1\u7968",
  indexHint: "\u70B9\u51FB\u7528\u8BE5\u6307\u6570\u505A K \u7EBF\u9884\u6D4B",
  breadthUp: "\u6DA8",
  breadthDown: "\u8DCC",
  breadthFlat: "\u5E73",
  loadingShort: "\u52A0\u8F7D\u4E2D\u2026",
  insightTitle: "AI \u89E3\u8BFB",
  insightRun: "\u89E3\u8BFB",
  insightRedo: "\u91CD\u65B0\u89E3\u8BFB",
  insightClear: "\u6E05\u9664",
  insightWorking: "\u6B63\u5728\u9605\u8BFB\u5927\u76D8\u3001\u9884\u6D4B\u4E0E\u6D88\u606F\u9762\u2026",
  insightHint: "\u628A\u5927\u76D8\u3001\u5F53\u524D\u80A1\u7968\u7684\u9884\u6D4B\u5206\u5E03\u548C\u516C\u544A\u65B0\u95FB\u4EA4\u7ED9\u6A21\u578B\uFF0C\u751F\u6210\u4E00\u6BB5\u89E3\u8BFB\u3002",
  settingsOpen: "\u8BBE\u7F6E",
  settingsTitle: "\u8BBE\u7F6E",
  settingsModel: "AI \u89E3\u8BFB\u4E0E\u4FEE\u6B63\u4F7F\u7528\u7684\u6A21\u578B",
  settingsModelHint: "\u89E3\u8BFB\u3001\u4FEE\u6B63\u8FD9\u7C7B\u8C03\u7528\u4F1A\u4F7F\u7528\u8FD9\u4E2A\u6A21\u578B\uFF1B\u4E0D\u9009\u5219\u8DDF\u968F DSH \u7684\u4F1A\u8BDD\u9ED8\u8BA4\u6A21\u578B\u3002",
  settingsFollowDefault: "\u8DDF\u968F\u4F1A\u8BDD\u9ED8\u8BA4\u6A21\u578B",
  settingsFollowHint: "\u7531 DSH \u51B3\u5B9A",
  settingsNoModel: "\u6CA1\u6709\u68C0\u6D4B\u5230\u53EF\u7528\u6A21\u578B\u3002\u8BF7\u5148\u5728 DSH \u8BBE\u7F6E\u91CC\u914D\u7F6E\u4E00\u4E2A\u6A21\u578B\u670D\u52A1\u5546\uFF0C\u518D\u56DE\u6765\u5237\u65B0\u3002",
  settingsRefresh: "\u5237\u65B0\u5217\u8868",
  settingsDone: "\u5B8C\u6210",
  refineRun: "AI \u4FEE\u6B63",
  refineRedo: "\u91CD\u65B0\u4FEE\u6B63",
  refining: "\u4FEE\u6B63\u4E2D\u2026",
  refineHint: "\u8BA9\u6A21\u578B\u7ED3\u5408\u5927\u76D8\u3001\u6D88\u606F\u9762\u4FEE\u6B63\u8FD9\u6B21\u7684\u9884\u6D4B\u672B\u7AEF\u6536\u76CA\uFF0C\u5E76\u7ED9\u51FA\u4FEE\u6B63\u8DEF\u5F84",
  refineTitle: "\u4FEE\u6B63\u540E\u672B\u7AEF\u6536\u76CA",
  refineConfidence: "\u4FE1\u5FC3",
  refineNote: "\u4FEE\u6B63\u8DEF\u5F84\u6309\u539F\u9884\u6D4B\u5F62\u6001\u6574\u4F53\u5E73\u79FB\uFF0C\u56FE\u4E0A\u4E3A\u6A59\u8272\u865A\u7EBF\u3002\u4EC5\u4F9B\u53C2\u8003\u3002",
  refineClamped: "\u6A21\u578B\u7684\u4FEE\u6B63\u8D8A\u51FA\u4E86 KiT \u7684 q05~q95 \u533A\u95F4\uFF0C\u5DF2\u5939\u56DE\u533A\u95F4\u8FB9\u754C\u3002",
  newsTitle: "\u6D88\u606F\u9762",
  newsNotices: "\u516C\u544A",
  newsItems: "\u65B0\u95FB",
  newsLoading: "\u52A0\u8F7D\u4E2D\u2026",
  newsFailed: "\u90E8\u5206\u6765\u6E90\u5931\u8D25",
  newsEmpty: "\u6682\u65E0\u76F8\u5173\u516C\u544A\u6216\u65B0\u95FB",
  newsRefresh: "\u5237\u65B0",
  newsRefreshHint: "\u7ACB\u5373\u91CD\u65B0\u62C9\u53D6\u516C\u544A\u4E0E\u65B0\u95FB\uFF08\u6700\u77ED\u95F4\u9694 20 \u79D2\uFF09",
  newsCooling: "\u521A\u5237\u65B0\u8FC7\uFF0C\u7A0D\u5019\u518D\u8BD5",
  runHint: "\u7528 KiT \u6A21\u578B\u9884\u6D4B\u8FD9\u53EA\u80A1\u7968\u7684\u4E0B\u4E00\u4E2A\u7A97\u53E3",
  run: "\u5F00\u59CB\u9884\u6D4B",
  runForecast: "\u9884\u6D4B",
  previewOnly: "\u5F53\u524D\u53EA\u663E\u793A\u884C\u60C5 K \u7EBF\uFF0C\u70B9\u300C\u9884\u6D4B\u300D\u624D\u4F1A\u8DD1\u6A21\u578B\uFF08\u7EA6 20\u201370 \u79D2\uFF09\u3002",
  staleResult: "\u884C\u60C5\u5DF2\u66F4\u65B0\u5230",
  rerun: "\u91CD\u65B0\u9884\u6D4B",
  running: "\u9884\u6D4B\u4E2D\u2026",
  cancel: "\u53D6\u6D88",
  working: "\u63A8\u7406\u4E2D\u2026",
  progressHint: "\u9996\u6B21\u8FD0\u884C\u4F1A\u5148\u52A0\u8F7D 1.1 GB \u6743\u91CD\u5230\u5185\u5B58\uFF1B\u6269\u6563\u91C7\u6837\u6309\u6B65\u63A8\u8FDB\uFF0C\u53EF\u4EE5\u968F\u65F6\u53D6\u6D88\u3002",
  failed: "\u9884\u6D4B\u5931\u8D25",
  dismiss: "\u77E5\u9053\u4E86",
  lastBar: "\u6700\u65B0\u5DF2\u6536\u76D8 K \u7EBF",
  horizon: "\u9884\u6D4B\u533A\u95F4",
  adj: "\u524D\u590D\u6743",
  "stat.median": "\u9884\u6D4B\u4E2D\u4F4D\u6DA8\u5E45",
  "stat.target": "\u76EE\u6807\u4EF7\u4E2D\u4F4D",
  "stat.upProb": "\u4E0A\u6DA8\u6982\u7387",
  "stat.q05q95": "q05~q95",
  "stat.range": "\u4EF7\u683C\u533A\u95F4",
  "stat.rangeHint": "q05 ~ q95 \u5206\u4F4D",
  "stat.vol": "\u9884\u671F\u6CE2\u52A8",
  "stat.drawdown": "\u4E2D\u4F4D\u56DE\u64A4",
  "stat.paths": "\u91C7\u6837\u89C4\u6A21",
  emptyTitle: "\u8F93\u5165\u4EE3\u7801\uFF0C\u770B\u672A\u6765\u600E\u4E48\u8D70",
  emptyBody: "\u652F\u6301\u4EFB\u610F A \u80A1\uFF08\u6CAA\u6DF1\u4EAC\uFF09\uFF0C1 \u5206\u949F\u5230\u65E5\u7EBF\u5171 7 \u4E2A\u5468\u671F\u3002\u6A21\u578B\u8F93\u51FA\u591A\u6761\u91C7\u6837\u8DEF\u5F84\u7684\u5206\u5E03\uFF0C\u7528\u6765\u5224\u65AD\u65B9\u5411\u3001\u5E45\u5EA6\u548C\u4E0D\u786E\u5B9A\u6027\u3002",
  emptyHint: "\u7528\u8FC7\u7684\u80A1\u7968\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u300C\u5E38\u7528\u300D\u91CC\uFF0C\u4E5F\u53EF\u4EE5\u70B9 \u2606 \u56FA\u5B9A\u7F6E\u9876\uFF1B\u4E0B\u6B21\u6253\u5F00\u9762\u677F\u4F1A\u76F4\u63A5\u56DE\u5230\u4E0A\u6B21\u7684\u80A1\u7968\u4E0E\u7ED3\u679C\u3002",
  footNote: "\u6570\u636E\uFF1A\u65B0\u6D6A / \u817E\u8BAF\u884C\u60C5\uFF08\u5B9E\u65F6\u76D8\u53E3 + \u524D\u590D\u6743 K \u7EBF\uFF09\uFF1B\u6A21\u578B\uFF1AKiT-284M\uFF08AGPL-3.0\uFF0CLuciferbobo/KiT\uFF09\u3002 \u4EC5\u7528\u4E8E\u7814\u7A76\u4E0E\u5B66\u4E60\uFF0C\u4E0D\u6784\u6210\u6295\u8D44\u5EFA\u8BAE\u3002",
  footModelMissing: "\u6A21\u578B\u5C1A\u672A\u4E0B\u8F7D\uFF0C\u5B8C\u6210\u521D\u59CB\u5316\u540E\u5373\u53EF\u9884\u6D4B\u3002"
};
var en = {
  nav: "KiT Forecast",
  title: "KiT Forecast",
  titleTag: "A-shares \xB7 live",
  subtitle: "Probabilistic multi-horizon forecasts for any A-share with the KiT diffusion model",
  searchPlaceholder: "Ticker or name, e.g. 600519 / Kweichow Moutai",
  recheck: "Re-check environment",
  envReady: "Ready",
  envMissing: "Setup needed",
  setupTitle: "First run needs a Python runtime",
  setupBody: "The plugin creates a venv, installs PyTorch, and downloads the KiT-284M weights (1.1 GB, resumable). You can also point dataDir / python at an existing setup in the plugin config.",
  setupStart: "Set up runtime",
  setupRunning: "Setting up\u2026",
  setupDone: "Setup finished",
  setupFailed: "Setup failed",
  qualityHint: "Sampling budget: more paths / steps = slower but better",
  scaleHint: "Bar interval (parentheses: history bars / forecast bars)",
  "quality.fast": "Fast",
  "quality.standard": "Standard",
  "quality.fine": "Fine",
  auto: "Auto",
  autoHint: "Watches the last closed bar and only recomputes when a new one appears; the old chart never blinks",
  watching: "Following",
  watchHint: "Quotes refresh live; recomputes when a new bar closes",
  quoteOnly: "Quotes live",
  quoteOnlyHint: "Quotes refresh every minute; turn on Auto to recompute when a new bar closes",
  watchFail: "Last heartbeat failed; will retry automatically",
  watchRetry: "Retrying",
  limit: "Price-limit clamp",
  limitHint: "Project sampled paths into the daily price-limit band",
  compare: "Compare",
  compareHint: "Overlay earlier forecasts on the same chart against what actually happened",
  compareTitle: "Past forecasts",
  comparePred: "predicted",
  compareActual: "actual",
  compareNote: "orange = predicted median then, dots = realized closes",
  incremental: "Incremental",
  incrementalHint: "Warm-start sampling from the previous paths (SDEdit-like): fewer steps and faster, with a slight distribution bias",
  watchlist: "Watchlist",
  pinHint: "Pin this stock to the watchlist",
  unpinHint: "Unpin",
  removeHint: "Remove from watchlist",
  pinnedNotice: "Pinned to watchlist",
  unpinnedNotice: "Unpinned",
  restoring: "Restoring your last stock and forecast\u2026",
  updating: "Updating",
  updated: "Updated",
  quoteUpdated: "Quote",
  livePriceHint: "Live traded price; the dashed line is where it sits on the chart",
  formingDropped: "forming bar dropped",
  marketClosed: "Market closed",
  needStock: "Pick a stock from the search suggestions first",
  needSetup: "Runtime is not ready yet; finish setup first",
  preparing: "Preparing\u2026",
  stepsUnit: "steps",
  noStock: "No stock selected",
  indexHint: "Click to chart and forecast this index",
  breadthUp: "Up",
  breadthDown: "Down",
  breadthFlat: "Flat",
  loadingShort: "Loading\u2026",
  insightTitle: "AI read",
  insightRun: "Read",
  insightRedo: "Re-read",
  insightClear: "Clear",
  insightWorking: "Reading market, forecast and news\u2026",
  insightHint: "Send the market, forecast distribution and filings to the model for a written read.",
  settingsOpen: "Settings",
  settingsTitle: "Settings",
  settingsModel: "Model for AI read & adjustment",
  settingsModelHint: "Used by the read and adjustment calls. Leave unset to follow the DSH session default.",
  settingsFollowDefault: "Follow session default",
  settingsFollowHint: "decided by DSH",
  settingsNoModel: "No model available. Configure a provider in DSH settings, then refresh here.",
  settingsRefresh: "Refresh list",
  settingsDone: "Done",
  refineRun: "AI adjust",
  refineRedo: "Re-adjust",
  refining: "Adjusting\u2026",
  refineHint: "Let the model revise the forecast return using market and news, and draw the adjusted path",
  refineTitle: "Adjusted return",
  refineConfidence: "confidence",
  refineNote: "Adjusted path shifts the original shape; shown as an orange dashed line. For reference only.",
  refineClamped: "The model went outside KiT's q05~q95 range and was clamped to the boundary.",
  newsTitle: "News & filings",
  newsNotices: "Filings",
  newsItems: "News",
  newsLoading: "Loading\u2026",
  newsFailed: "Some sources failed",
  newsEmpty: "No filings or news yet",
  newsRefresh: "Refresh",
  newsRefreshHint: "Fetch filings and news now (min 20s apart)",
  newsCooling: "Just refreshed, please wait",
  runHint: "Run the KiT model on this stock",
  run: "Forecast",
  runForecast: "Predict",
  previewOnly: "Showing price bars only. Click Predict to run the model (20\u201370s).",
  staleResult: "Price data advanced to",
  rerun: "Forecast again",
  running: "Forecasting\u2026",
  cancel: "Cancel",
  working: "Sampling\u2026",
  progressHint: "The first run loads 1.1 GB of weights; sampling proceeds step by step and can be cancelled.",
  failed: "Forecast failed",
  dismiss: "Dismiss",
  lastBar: "Last closed bar",
  horizon: "Horizon",
  adj: "adjusted",
  "stat.median": "Median return",
  "stat.target": "Median target",
  "stat.upProb": "P(up)",
  "stat.q05q95": "q05~q95",
  "stat.range": "Price range",
  "stat.rangeHint": "q05 ~ q95 quantiles",
  "stat.vol": "Expected vol",
  "stat.drawdown": "Median drawdown",
  "stat.paths": "Sampling",
  emptyTitle: "Type a ticker to see the path distribution",
  emptyBody: "Any A-share (SSE/SZSE/BSE), seven horizons from 1m to 1d. The model returns a distribution over future bars.",
  emptyHint: "Stocks you use land in the watchlist automatically; pin favourites with \u2606. Reopening the panel restores your last stock and result.",
  footNote: "Data: Sina / Tencent live quotes and adjusted bars. Model: KiT-284M (AGPL-3.0, Luciferbobo/KiT). Research use only, not investment advice.",
  footModelMissing: "Model weights are not downloaded yet; finish setup to forecast."
};

// src/client/NewsPanel.jsx
var h7 = import_react7.default.createElement;
function shortDate(text, now = Date.now()) {
  const raw = String(text ?? "");
  if (raw.length < 10) return raw;
  const date = raw.slice(0, 10);
  const base = now instanceof Date ? now : new Date(now);
  const offset = base.getTimezoneOffset();
  const today = new Date(base.getTime() + (offset + 480) * 6e4).toISOString().slice(0, 10);
  if (date === today) return raw.slice(11, 16) || "\u4ECA\u5929";
  const yesterday = new Date(base.getTime() + (offset + 480) * 6e4 - 864e5).toISOString().slice(0, 10);
  if (date === yesterday) return "\u6628\u5929";
  return date.slice(5);
}
function NewsPanel({ data, loading, error, tab, onTab, onRefresh, cooldown, t, now }) {
  const cooling = (cooldown ?? 0) > 0;
  const announcements = data?.announcements ?? [];
  const news = data?.news ?? [];
  const items = tab === "news" ? news : announcements;
  const total = announcements.length + news.length;
  return h7(
    "div",
    { className: "kfc-news" },
    h7(
      "div",
      { className: "kfc-newsBar" },
      h7("span", { className: "kfc-newsTitle" }, t("newsTitle")),
      h7("button", {
        type: "button",
        className: `kfc-newsTab ${tab === "notice" ? "active" : ""}`,
        onClick: () => onTab("notice")
      }, `${t("newsNotices")} ${announcements.length || ""}`.trim()),
      h7("button", {
        type: "button",
        className: `kfc-newsTab ${tab === "news" ? "active" : ""}`,
        onClick: () => onTab("news")
      }, `${t("newsItems")} ${news.length || ""}`.trim()),
      loading ? h7("span", { className: "kfc-newsLoading" }, t("newsLoading")) : null,
      error ? h7("span", { className: "kfc-newsError", title: error }, t("newsFailed")) : null,
      h7("span", { className: "kfc-insightSpacer" }),
      h7("button", {
        type: "button",
        className: "kfc-ghost kfc-newsRefresh",
        disabled: loading || cooling,
        title: cooling ? t("newsCooling") : t("newsRefreshHint"),
        onClick: onRefresh
      }, cooling ? `${Math.ceil(cooldown / 1e3)}s` : t("newsRefresh"))
    ),
    items.length === 0 ? h7("div", { className: "kfc-newsEmpty" }, loading ? t("newsLoading") : t("newsEmpty")) : h7(
      "ul",
      { className: "kfc-newsList" },
      items.map((item, index) => h7(
        "li",
        { key: `${item.id}-${index}`, className: "kfc-newsItem" },
        h7("span", { className: "kfc-newsDate" }, shortDate(item.time || item.date, now)),
        item.category ? h7("span", { className: "kfc-newsTag" }, item.category) : null,
        item.url ? h7("a", {
          className: "kfc-newsLink",
          href: item.url,
          target: "_blank",
          rel: "noreferrer noopener",
          title: item.title
        }, item.title) : h7("span", { className: "kfc-newsLink", title: item.title }, item.title)
      ))
    )
  );
}

// src/client/Select.jsx
var import_react8 = __toESM(require("react"), 1);
var h8 = import_react8.default.createElement;
function Select({
  value,
  options,
  onChange,
  title,
  className = "",
  align = "left",
  width
}) {
  const [open, setOpen] = import_react8.default.useState(false);
  const [active, setActive] = import_react8.default.useState(-1);
  const rootRef = import_react8.default.useRef(null);
  const listRef = import_react8.default.useRef(null);
  const current = options.find((item) => item.value === value);
  import_react8.default.useEffect(() => {
    if (!open) return void 0;
    const onDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  import_react8.default.useEffect(() => {
    if (!open) return;
    const index = options.findIndex((item) => item.value === value);
    setActive(index >= 0 ? index : 0);
    requestAnimationFrame(() => {
      const node = listRef.current?.children?.[index];
      node?.scrollIntoView?.({ block: "nearest" });
    });
  }, [open, options, value]);
  const pick = (item) => {
    setOpen(false);
    if (item && item.value !== value) onChange(item.value);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((prev) => Math.max(0, Math.min(options.length - 1, prev + delta)));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      pick(options[active]);
    }
  };
  return h8(
    "div",
    {
      className: `kfc-dd ${open ? "open" : ""} ${className}`,
      ref: rootRef,
      style: width ? { width } : void 0
    },
    h8(
      "button",
      {
        type: "button",
        className: "kfc-ddTrigger",
        title,
        onClick: () => setOpen((prev) => !prev),
        onKeyDown,
        "aria-haspopup": "listbox",
        "aria-expanded": open
      },
      h8("span", { className: "kfc-ddValue" }, current?.label ?? value),
      h8(
        "svg",
        { className: "kfc-ddCaret", width: 10, height: 10, viewBox: "0 0 10 10", "aria-hidden": "true" },
        h8("path", { d: "M2 3.6L5 6.6L8 3.6", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" })
      )
    ),
    open ? h8(
      "div",
      {
        className: `kfc-ddList ${align === "right" ? "right" : ""}`,
        ref: listRef,
        role: "listbox"
      },
      options.map((item, index) => h8(
        "button",
        {
          key: item.value,
          type: "button",
          role: "option",
          "aria-selected": item.value === value,
          className: `kfc-ddItem ${item.value === value ? "selected" : ""} ${index === active ? "active" : ""}`,
          onMouseEnter: () => setActive(index),
          onClick: () => pick(item)
        },
        h8("span", { className: "kfc-ddItemLabel" }, item.label),
        item.hint ? h8("span", { className: "kfc-ddItemHint" }, item.hint) : null,
        item.value === value ? h8(
          "svg",
          { className: "kfc-ddCheck", width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": "true" },
          h8("path", { d: "M2.5 6.4L4.8 8.7L9.5 3.6", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })
        ) : null
      ))
    ) : null
  );
}

// src/client/store.js
var MAX_FAVORITES = 12;
var MAX_RECENT = 10;
function touchWatchlist(list, item, now = Date.now()) {
  const code = item?.code;
  if (!code) return list;
  const rest = list.filter((entry) => entry.code !== code);
  const previous = list.find((entry) => entry.code === code);
  const next = {
    code,
    name: item.name ?? previous?.name ?? code,
    pinned: previous?.pinned === true,
    at: now
  };
  return [next, ...rest];
}
function togglePin(list, code, name2) {
  const exists = list.find((entry) => entry.code === code);
  if (!exists) {
    return { list: [{ code, name: name2 ?? code, pinned: true, at: Date.now() }, ...list], pinned: true };
  }
  const next = list.map((entry) => entry.code === code ? { ...entry, pinned: !entry.pinned } : entry);
  return { list: next, pinned: !exists.pinned };
}
function sortWatchlist(list) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.at ?? 0) - (a.at ?? 0);
  });
}
function visibleWatchlist(list, { favorites = MAX_FAVORITES, recent = MAX_RECENT } = {}) {
  const sorted = sortWatchlist(list);
  const pinned = sorted.filter((entry) => entry.pinned).slice(0, favorites);
  const others = sorted.filter((entry) => !entry.pinned).slice(0, recent);
  return [...pinned, ...others];
}
function relativeTime(iso, now = Date.now()) {
  const raw = String(iso ?? "").trim();
  if (raw === "") return "";
  const normalized = raw.includes("T") || raw.includes(" ") ? raw.replace(" ", "T") : raw;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const ts = Date.parse(hasZone ? normalized : `${normalized}+08:00`);
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, now - ts);
  const sec = Math.round(diff / 1e3);
  if (sec < 60) return `${sec} \u79D2\u524D`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} \u5206\u949F\u524D`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} \u5C0F\u65F6\u524D`;
  return `${Math.round(hour / 24)} \u5929\u524D`;
}
function inTradingSession(date = /* @__PURE__ */ new Date()) {
  const bj = new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 6e4);
  const day = bj.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = bj.getHours() * 60 + bj.getMinutes();
  return minutes >= 570 && minutes <= 690 || minutes >= 780 && minutes <= 900;
}

// src/client/Panel.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var QUALITY = [
  { key: "fast", paths: 0.5, steps: 0.6 },
  { key: "standard", paths: 1, steps: 1 },
  { key: "fine", paths: 2, steps: 1.5 }
];
var SCALE_ORDER = ["1m", "5m", "15m", "30m", "1h", "2h", "1d"];
function pct(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}
function priceStr(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(2);
}
function numStr(value) {
  if (!Number.isFinite(value)) return "-";
  return value >= 1e8 ? `${(value / 1e8).toFixed(2)} \u4EBF` : value >= 1e4 ? `${(value / 1e4).toFixed(1)} \u4E07` : value.toFixed(0);
}
function quoteTime(raw) {
  const text = String(raw ?? "");
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(text);
  return m ? `${m[2]}-${m[3]} ${m[4]}:${m[5]}` : text;
}
function parseCode(input) {
  const upper = String(input ?? "").trim().toUpperCase();
  let m = /^(\d{6})\.(SH|SZ|BJ)$/.exec(upper);
  if (m) return { code: `${m[1]}.${m[2]}` };
  m = /^(SH|SZ|BJ)(\d{6})$/.exec(upper);
  if (m) return { code: `${m[2]}.${m[1]}` };
  m = /^(\d{6})$/.exec(upper);
  if (m) return { code: m[1] };
  return null;
}
function StatCard({ label, value, hint, tone, stale }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `kfc-statCard ${stale ? "stale" : ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-statLabel", children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `kfc-statValue ${tone ?? ""}`, children: value }),
    hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-statHint", children: hint }) : null
  ] });
}
function SettingsIcon({ onClick, active, label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      className: `kfc-iconBtn ${active ? "on" : ""}`,
      title: label,
      "aria-label": label,
      onClick,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "3.2", stroke: "currentColor", strokeWidth: "1.6" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: "M19.1 13.9a7.7 7.7 0 000-3.8l1.6-1.2-1.9-3.2-1.9.8a7.6 7.6 0 00-3.3-1.9L13.3 2.5h-3.6l-.3 2.1a7.6 7.6 0 00-3.3 1.9l-1.9-.8L2.3 8.9l1.6 1.2a7.7 7.7 0 000 3.8l-1.6 1.2 1.9 3.2 1.9-.8a7.6 7.6 0 003.3 1.9l.3 2.1h3.6l.3-2.1a7.6 7.6 0 003.3-1.9l1.9.8 1.9-3.2-1.6-1.2z",
            stroke: "currentColor",
            strokeWidth: "1.3",
            strokeLinejoin: "round"
          }
        )
      ] })
    }
  );
}
function RecentIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "11", height: "11", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "8.5", stroke: "currentColor", strokeWidth: "1.8", opacity: ".7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 7.5V12l3 2", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" })
  ] });
}
function StarIcon({ filled }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: filled ? "currentColor" : "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M12 3.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7z",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }
  ) });
}
function KitForecastPanel({ ctx }) {
  const t = ctx.locale.bind(NS);
  const [, setLocaleTick] = import_react9.default.useState(0);
  import_react9.default.useEffect(() => ctx.locale.subscribe(() => setLocaleTick((v) => v + 1)), [ctx]);
  const [status, setStatus] = import_react9.default.useState(null);
  const [setup, setSetup] = import_react9.default.useState({ running: false, logs: [], error: null });
  const [hydrated, setHydrated] = import_react9.default.useState(false);
  const [keyword, setKeyword] = import_react9.default.useState("");
  const [suggestions, setSuggestions] = import_react9.default.useState([]);
  const [searchOpen, setSearchOpen] = import_react9.default.useState(false);
  const [selected, setSelected] = import_react9.default.useState(null);
  const [scale, setScale] = import_react9.default.useState("1m");
  const [quality, setQuality] = import_react9.default.useState("fine");
  const [applyLimit, setApplyLimit] = import_react9.default.useState(true);
  const [autoRefresh, setAutoRefresh] = import_react9.default.useState(false);
  const [comparePast, setComparePast] = import_react9.default.useState(true);
  const [incremental, setIncremental] = import_react9.default.useState(false);
  const [overlays, setOverlays] = import_react9.default.useState(null);
  const [watchlist, setWatchlist] = import_react9.default.useState([]);
  const [notes, setNotes] = import_react9.default.useState({});
  const [phase, setPhase] = import_react9.default.useState("idle");
  const [refreshing, setRefreshing] = import_react9.default.useState(false);
  const [stage, setStage] = import_react9.default.useState("");
  const [progress, setProgress] = import_react9.default.useState({ step: 0, total: 0 });
  const [result, setResult] = import_react9.default.useState(null);
  const [resultAt, setResultAt] = import_react9.default.useState(0);
  const [error, setError] = import_react9.default.useState(null);
  const [notice, setNotice] = import_react9.default.useState("");
  const [elapsed, setElapsed] = import_react9.default.useState(0);
  const [now, setNow] = import_react9.default.useState(Date.now());
  const [tickAt, setTickAt] = import_react9.default.useState(0);
  const [tickState, setTickState] = import_react9.default.useState("idle");
  const [liveQuote, setLiveQuote] = import_react9.default.useState(null);
  const [liveCandle, setLiveCandle] = import_react9.default.useState(null);
  const [news, setNews] = import_react9.default.useState(null);
  const [newsLoading, setNewsLoading] = import_react9.default.useState(false);
  const [newsError, setNewsError] = import_react9.default.useState(null);
  const [newsTab, setNewsTab] = import_react9.default.useState("news");
  const [newsCooldown, setNewsCooldown] = import_react9.default.useState(0);
  const [market, setMarket] = import_react9.default.useState(null);
  const [marketLoading, setMarketLoading] = import_react9.default.useState(false);
  const [insight, setInsight] = import_react9.default.useState({ state: "idle", text: "", model: "", error: null });
  const [settingsOpen, setSettingsOpen] = import_react9.default.useState(false);
  const [models, setModels] = import_react9.default.useState([]);
  const [modelsLoading, setModelsLoading] = import_react9.default.useState(false);
  const [modelsError, setModelsError] = import_react9.default.useState(null);
  const [modelChoice, setModelChoice] = import_react9.default.useState(null);
  const [refine, setRefine] = import_react9.default.useState({ state: "idle", path: null, ret: null, originalRet: null, confidence: null, reasons: [], model: "", error: null });
  const [latestBar, setLatestBar] = import_react9.default.useState(null);
  const lastRunAnchorRef = import_react9.default.useRef(null);
  const [marketOpen, setMarketOpen] = import_react9.default.useState(() => inTradingSession());
  const abortRef = import_react9.default.useRef(null);
  const runningRef = import_react9.default.useRef(false);
  const resultRef = import_react9.default.useRef(null);
  const loadPreviewRef = import_react9.default.useRef(null);
  const autoRefreshRef = import_react9.default.useRef(false);
  const activeCodeRef = import_react9.default.useRef(null);
  const startedRef = import_react9.default.useRef(0);
  const saveTimerRef = import_react9.default.useRef(null);
  const searchTokenRef = import_react9.default.useRef(0);
  const previewAsOfRef = import_react9.default.useRef("");
  const running = phase === "running";
  runningRef.current = running;
  resultRef.current = result;
  autoRefreshRef.current = autoRefresh;
  const resultTarget = selected?.code ?? null;
  const resultMatches = Boolean(
    result && result.code && (!resultTarget || result.code === resultTarget) && result.scale === scale
  );
  import_react9.default.useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setMarketOpen(inTradingSession());
    }, 5e3);
    return () => clearInterval(id);
  }, []);
  const [previewBars, setPreviewBars] = import_react9.default.useState(null);
  const loadPreview = import_react9.default.useCallback(async (code, scale2) => {
    try {
      const data = await fetchBars(code, scale2, 400);
      const bars = data.bars ?? [];
      previewAsOfRef.current = bars.at(-1)?.t ?? "";
      setPreviewBars({ code: data.code, scale: scale2, bars, source: data.source });
      return data;
    } catch {
      setPreviewBars(null);
      return null;
    }
  }, []);
  loadPreviewRef.current = loadPreview;
  const newsCacheRef = import_react9.default.useRef({ code: "", at: 0 });
  const loadNews = import_react9.default.useCallback(async (code, { force = false } = {}) => {
    if (!code) return;
    const fresh = newsCacheRef.current.code === code && Date.now() - newsCacheRef.current.at < 3 * 60 * 1e3;
    if (!force && fresh) return;
    setNewsLoading(true);
    setNewsError(null);
    try {
      const data = await fetchNews(code, 12, 12, { force });
      newsCacheRef.current = { code, at: Date.now() };
      setNews({ announcements: data.announcements ?? [], news: data.news ?? [] });
      const throttled = data.throttled ?? 0;
      setNewsCooldown(Math.max(data.cooldown ?? 0, throttled));
      if (data.errors?.length) setNewsError(data.errors.join("\uFF1B"));
      else if (throttled > 0) setNewsError(null);
      else setNewsError(null);
    } catch (err) {
      setNewsError(err.message);
    } finally {
      setNewsLoading(false);
    }
  }, []);
  const loadMarket = import_react9.default.useCallback(async () => {
    setMarketLoading(true);
    try {
      const data = await fetchMarket();
      if (data?.ok) setMarket({ indices: data.indices ?? [], breadth: data.breadth ?? null });
    } catch {
    } finally {
      setMarketLoading(false);
    }
  }, []);
  import_react9.default.useEffect(() => {
    if (newsCooldown <= 0) return void 0;
    const id = setInterval(() => {
      setNewsCooldown((prev) => Math.max(0, prev - 1e3));
    }, 1e3);
    return () => clearInterval(id);
  }, [newsCooldown > 0]);
  import_react9.default.useEffect(() => {
    loadMarket();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadMarket();
    }, 2e4);
    return () => clearInterval(id);
  }, [loadMarket]);
  const insightAbortRef = import_react9.default.useRef(null);
  const runInsightNow = import_react9.default.useCallback(async () => {
    insightAbortRef.current?.abort();
    const controller = new AbortController();
    insightAbortRef.current = controller;
    setInsight({ state: "running", text: "", model: "", error: null });
    let acc = "";
    try {
      await runInsight({
        code: activeCodeRef.current ?? void 0,
        scale,
        market,
        forecast: resultRef.current,
        news,
        overlays,
        model: modelChoice
      }, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.t === "delta") {
            acc += event.text;
            setInsight((prev) => ({ ...prev, text: acc }));
          } else if (event.t === "result") {
            setInsight((prev) => ({ ...prev, state: "done", model: event.modelName ?? event.model ?? "" }));
          } else if (event.t === "fail") {
            setInsight({ state: "error", text: acc, model: "", error: event.message });
          }
        }
      });
      setInsight((prev) => prev.state === "running" ? { ...prev, state: "done" } : prev);
    } catch (err) {
      if (err.name === "AbortError") {
        setInsight((prev) => ({ ...prev, state: prev.text ? "done" : "idle" }));
      } else {
        setInsight({ state: "error", text: acc, model: "", error: err.message });
      }
    } finally {
      insightAbortRef.current = null;
    }
  }, [scale, market, news, overlays, modelChoice]);
  const runRefine = import_react9.default.useCallback(async () => {
    const forecast = resultRef.current;
    if (!forecast) return;
    setRefine({ state: "running", path: null, ret: null, originalRet: null, confidence: null, reasons: [], model: "", error: null });
    try {
      const data = await refineForecast({
        code: forecast.code,
        market,
        stock: liveQuote ?? null,
        forecast,
        news,
        overlays,
        model: modelChoice
      });
      setRefine({
        state: "done",
        path: data.path ?? null,
        ret: data.clampedRet ?? data.ret ?? null,
        rawRet: data.ret ?? null,
        originalRet: data.originalRet ?? null,
        confidence: data.confidence ?? null,
        reasons: data.reasons ?? [],
        model: data.modelName ?? data.model ?? "",
        outOfBand: data.outOfBand === true,
        error: null
      });
    } catch (err) {
      setRefine({ state: "error", path: null, ret: null, originalRet: null, confidence: null, reasons: [], model: "", error: err.message });
    }
  }, [market, liveQuote, news, overlays, modelChoice]);
  const loadModels = import_react9.default.useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchModels();
      setModels(data.items ?? []);
    } catch (err) {
      setModelsError(err.message);
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);
  import_react9.default.useEffect(() => {
    if (settingsOpen) loadModels();
  }, [settingsOpen, loadModels]);
  const refreshStatus = import_react9.default.useCallback(async () => {
    try {
      const data = await fetchStatus();
      setStatus(data);
      return data;
    } catch (err) {
      setStatus({ ready: false, error: err.message, scales: [] });
      return null;
    }
  }, []);
  const persist = import_react9.default.useCallback((patch) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      patchState(patch).catch(() => {
      });
    }, 400);
  }, []);
  const chooseModel = import_react9.default.useCallback((choice) => {
    setModelChoice(choice);
    persist({ prefs: { model: choice } });
  }, [persist]);
  import_react9.default.useEffect(() => {
    let cancelled = false;
    (async () => {
      let statusData = null;
      let state = null;
      try {
        statusData = await refreshStatus();
        try {
          state = (await fetchState()).state;
        } catch {
          state = null;
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
      if (cancelled) return;
      if (state) {
        setWatchlist(Array.isArray(state.watchlist) ? state.watchlist : []);
        if (state.notes && typeof state.notes === "object") setNotes(state.notes);
        const prefs = state.prefs ?? {};
        if (SCALE_ORDER.includes(prefs.scale)) setScale(prefs.scale);
        if (QUALITY.some((item) => item.key === prefs.quality)) setQuality(prefs.quality);
        if (typeof prefs.applyLimit === "boolean") setApplyLimit(prefs.applyLimit);
        if (typeof prefs.autoRefresh === "boolean") setAutoRefresh(prefs.autoRefresh);
        if (typeof prefs.comparePast === "boolean") setComparePast(prefs.comparePast);
        if (typeof prefs.incremental === "boolean") setIncremental(prefs.incremental);
        if (prefs.model && typeof prefs.model === "object" && typeof prefs.model.provider === "string" && typeof prefs.model.model === "string") {
          setModelChoice({ provider: prefs.model.provider, model: prefs.model.model });
        }
        const last = state.last;
        const remembered = Array.isArray(state.watchlist) && state.watchlist.some((w) => w.code === last?.result?.code);
        if (last?.result?.code && (remembered || !state.watchlist?.length)) {
          setResult(last.result);
          setResultAt(last.at ?? Date.now());
          setPhase("done");
          setSelected({ code: last.result.code, name: last.result.name ?? last.result.code });
          setKeyword(`${last.result.name ?? ""} ${last.result.code}`.trim());
          if (SCALE_ORDER.includes(last.result.scale)) setScale(last.result.scale);
        }
      }
      if (!statusData) setPhase((prev) => prev === "running" ? prev : "idle");
      if (!state?.last?.result?.code && statusData) {
        const code = state?.watchlist?.[0]?.code ?? state?.prefs?.lastCode;
        if (code) {
          const scaleFor = state?.prefs?.scale ?? scale;
          setSelected({ code, name: state?.watchlist?.[0]?.name ?? code });
          setKeyword(state?.watchlist?.[0]?.name ? `${state.watchlist[0].name} ${code}` : code);
          loadPreview(code, scaleFor);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [refreshStatus]);
  import_react9.default.useEffect(() => {
    if (!running) return void 0;
    const id = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1e3), 200);
    return () => clearInterval(id);
  }, [running]);
  import_react9.default.useEffect(() => {
    const text = keyword.trim();
    const selectedText = selected ? `${selected.name ?? ""} ${selected.code}`.trim() : "";
    if (text === "" || selectedText !== "" && text === selectedText) {
      setSuggestions([]);
      return void 0;
    }
    const token = ++searchTokenRef.current;
    const id = setTimeout(async () => {
      try {
        const data = await searchStocks(text);
        if (searchTokenRef.current !== token) return;
        setSuggestions(data.items ?? []);
        setSearchOpen(true);
      } catch {
        if (searchTokenRef.current === token) setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [keyword, selected]);
  const startSetup = import_react9.default.useCallback(async () => {
    setSetup({ running: true, logs: [], error: null });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runSetup({}, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.t === "stage") {
            setSetup((prev) => ({ ...prev, logs: [...prev.logs.slice(-60), `\u25B8 ${event.message}`] }));
          } else if (event.t === "log") {
            setSetup((prev) => ({ ...prev, logs: [...prev.logs.slice(-60), event.line] }));
          } else if (event.t === "fail") {
            setSetup((prev) => ({ ...prev, error: event.message }));
          }
        }
      });
      setSetup((prev) => ({ ...prev, running: false, logs: [...prev.logs, "\u2713 \u5B8C\u6210"] }));
      abortRef.current = null;
      await refreshStatus();
    } catch (err) {
      setSetup((prev) => ({ ...prev, running: false, error: err.message }));
    }
  }, [refreshStatus]);
  const run = import_react9.default.useCallback(async ({ code, name: name2, scale: scaleOverride, silent = false } = {}) => {
    const target = code ?? selected?.code;
    if (!target) {
      setError(t("needStock"));
      setPhase("error");
      return;
    }
    if (status && status.ready === false) {
      setError(t("needSetup"));
      setPhase("error");
      return;
    }
    const targetScale = scaleOverride ?? scale;
    const budget = (status?.scales ?? []).find((item) => item.key === targetScale);
    const factor = QUALITY.find((item) => item.key === quality) ?? QUALITY[1];
    const nPaths = Math.max(1, Math.round((budget?.defaultPaths ?? 12) * factor.paths));
    const steps = Math.max(1, Math.round((budget?.defaultSteps ?? 20) * factor.steps));
    const sameTarget = result?.code === target && result?.scale === targetScale;
    const keepChart = sameTarget && silent;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setNotice("");
    setPhase("running");
    setRefreshing(keepChart);
    if (!keepChart) setResult(null);
    setStage(t("preparing"));
    setProgress({ step: 0, total: 0 });
    startedRef.current = Date.now();
    setElapsed(0);
    let failed = false;
    let fresh = null;
    try {
      await runForecast({ code: target, scale: targetScale, nPaths, steps, applyLimit, quality, warm: incremental }, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.t === "stage") {
            setStage(event.message);
          } else if (event.t === "progress") {
            setProgress({ step: event.step, total: event.total });
            if (event.message) setStage(event.message);
          } else if (event.t === "log") {
            setStage(event.line);
          } else if (event.t === "result") {
            fresh = event.data;
            setPreviewBars(null);
            setResult(event.data);
            setOverlays(Array.isArray(event.data.overlays) ? event.data.overlays : []);
            setResultAt(Date.now());
            setStage("");
          } else if (event.t === "fail") {
            failed = true;
            if (keepChart) {
              setNotice(event.message);
              setPhase("done");
            } else {
              setError(event.message);
              setPhase("error");
            }
          }
        }
      });
      if (!failed) {
        setPhase("done");
        if (fresh) {
          setWatchlist((prev) => {
            const next = touchWatchlist(prev, { code: fresh.code, name: fresh.name });
            persist({ watchlist: next, notes: { [fresh.code]: fresh.scale } });
            return next;
          });
          setNotes((prev) => ({ ...prev, [fresh.code]: fresh.scale }));
          fetchState().then((data) => {
            if (Array.isArray(data?.state?.watchlist)) setWatchlist(data.state.watchlist);
          }).catch(() => {
          });
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setPhase(result ? "done" : "idle");
        setNotice("");
      } else if (keepChart) {
        setNotice(err.message);
        setPhase("done");
      } else {
        setError(err.message);
        setPhase("error");
      }
    } finally {
      setRefreshing(false);
      abortRef.current = null;
    }
  }, [selected, scale, quality, status, applyLimit, result, persist, t, notes]);
  const runRef = import_react9.default.useRef(run);
  runRef.current = run;
  const historyFetchRef = import_react9.default.useRef("");
  import_react9.default.useEffect(() => {
    if (!comparePast || !result?.code || !resultMatches) return void 0;
    const target = `${result.code}|${result.scale}|${result.asOf}`;
    if (historyFetchRef.current === target) return void 0;
    if (Array.isArray(overlays) && overlays.length > 0) return void 0;
    historyFetchRef.current = target;
    let cancelled = false;
    fetchHistory(result.code, result.scale, result.asOf).then((data) => {
      if (!cancelled) setOverlays(Array.isArray(data.overlays) ? data.overlays : []);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [comparePast, result?.code, result?.scale, result?.asOf, resultMatches, overlays]);
  import_react9.default.useEffect(() => {
    if (!hydrated) return void 0;
    const code = selected?.code ?? result?.code;
    if (!code) return void 0;
    const open = inTradingSession();
    const quoteInterval = !open ? 12e4 : scale === "1m" || scale === "5m" ? 1e4 : 15e3;
    let cancelled = false;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await fetchTick(code, scale);
        if (cancelled) return;
        setTickAt(Date.now());
        setTickState("ok");
        if (data?.quote) setLiveQuote({ ...data.quote, code });
        setLiveCandle(data?.forming ?? null);
        if (data?.asOf) setLatestBar(data.asOf);
        if (data?.asOf && data.asOf !== previewAsOfRef.current) {
          previewAsOfRef.current = data.asOf;
          loadPreviewRef.current?.(code, scale);
        }
        const latest = data?.asOf;
        const prevResult = resultRef.current;
        const newBar = Boolean(latest && prevResult?.asOf && latest !== prevResult.asOf);
        if (autoRefreshRef.current && newBar && !runningRef.current && lastRunAnchorRef.current !== latest) {
          lastRunAnchorRef.current = latest;
          runRef.current({ silent: true });
        }
      } catch {
        if (!cancelled) setTickState("fail");
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    const onFocus = () => beat();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    beat();
    const id = setInterval(beat, quoteInterval);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [autoRefresh, hydrated, scale, selected?.code, result?.code]);
  import_react9.default.useEffect(() => {
    if (!hydrated) return;
    persist({ prefs: { scale, quality, applyLimit, autoRefresh, comparePast, incremental } });
  }, [hydrated, scale, quality, applyLimit, autoRefresh, comparePast, incremental, persist]);
  const pick = (item, { runNow = false } = {}) => {
    const preferred = item.scale ?? notes[item.code] ?? scale;
    const valid = SCALE_ORDER.includes(preferred) ? preferred : scale;
    setSelected(item);
    setKeyword(`${item.name} ${item.code}`);
    setSuggestions([]);
    setSearchOpen(false);
    setScale(valid);
    if (result && (result.code !== item.code || result.scale !== valid)) {
      setResult(null);
      setRefine({ state: "idle", path: null, ret: null, originalRet: null, confidence: null, reasons: [], model: "", error: null });
      setOverlays([]);
      setPhase("idle");
      setError(null);
      setNotice("");
    }
    setPreviewBars(null);
    loadPreview(item.code, valid);
    loadNews(item.code);
    if (runNow) run({ code: item.code, name: item.name, scale: valid });
  };
  const onKeywordKey = (event) => {
    if (event.key !== "Enter") return;
    if (suggestions.length > 0) {
      pick(suggestions[0]);
      return;
    }
    const parsed = parseCode(keyword);
    if (parsed) {
      setSelected(null);
      run({ code: parsed.code });
    }
  };
  const starCurrent = () => {
    const code = selected?.code ?? result?.code;
    if (!code) return;
    const name2 = selected?.name ?? result?.name ?? code;
    setWatchlist((prev) => {
      const { list, pinned: pinned2 } = togglePin(prev, code, name2);
      setNotice(pinned2 ? t("pinnedNotice") : t("unpinnedNotice"));
      persist({ watchlist: list });
      return list;
    });
  };
  const removeFromWatchlist = (code) => {
    setWatchlist((prev) => prev.filter((entry) => entry.code !== code));
    setNotes((prev) => {
      if (!(code in prev)) return prev;
      const next = { ...prev };
      delete next[code];
      return next;
    });
    forgetStock(code).catch(() => {
    });
    if (result?.code === code) {
      setResult(null);
      setOverlays([]);
      setResultAt(0);
      setPhase("idle");
      setPreviewBars(null);
    }
    if (selected?.code === code) {
      setSelected(null);
      setKeyword("");
    }
  };
  const previewData = import_react9.default.useMemo(() => {
    if (!previewBars || previewBars.bars.length === 0) return null;
    const bars = previewBars.bars.slice(-400);
    return {
      code: previewBars.code,
      scale: previewBars.scale,
      asOf: bars.at(-1)?.t ?? null,
      lastClose: bars.at(-1)?.c ?? null,
      history: bars,
      pathMedian: [],
      futureTimestamps: [],
      bands: {},
      stats: null,
      nPaths: 0,
      steps: 0,
      Lh: 0,
      source: previewBars.source
    };
  }, [previewBars]);
  const realizedBars = import_react9.default.useMemo(() => {
    if (!resultMatches || !previewBars) return null;
    const bars = previewBars.bars ?? [];
    const anchor = result?.asOf;
    if (!anchor) return null;
    return bars.filter((bar) => bar.t > anchor);
  }, [resultMatches, previewBars, result?.asOf]);
  const latestRealized = realizedBars?.length ? realizedBars.at(-1).t : null;
  const chartData = (resultMatches ? result : null) ?? previewData;
  const isPreview = !resultMatches && Boolean(previewData);
  const scales = status?.scales?.length ? status.scales : SCALE_ORDER.map((key) => ({ key, label: key, Lc: 0, Lh: 0 }));
  const ready = status?.ready === true;
  const setupVisible = !ready && status !== null && !setup.running;
  const quote = (liveQuote && (!result || liveQuote.code === result.code) ? liveQuote : result?.quote) ?? null;
  const quoteUp = (quote?.changePercent ?? 0) >= 0;
  const stale = Boolean(result?.asOf && latestBar && latestBar !== result.asOf);
  const activeCode = selected?.code ?? result?.code ?? null;
  activeCodeRef.current = activeCode;
  const activeName = selected?.name ?? result?.name ?? "";
  const pinned = Boolean(watchlist.find((entry) => entry.code === activeCode)?.pinned);
  const chips = visibleWatchlist(watchlist);
  const showProgressPane = running && !refreshing;
  const progressPct = progress.total > 0 ? Math.round(progress.step / progress.total * 100) : 6;
  if (!hydrated) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-root kfc-loading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-spinner" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("restoring") })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "kfc-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-mark", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelIcon, { size: 18 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-headCopy", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", { className: "kfc-title", children: [
          t("title"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t("titleTag") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "kfc-sub", children: t("subtitle") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-headActions", children: [
        running && refreshing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kfc-livePill", title: stage || t("working"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-spinner sm" }),
          t("updating"),
          " ",
          progress.total > 0 ? `${progress.step}/${progress.total}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: `kfc-ghost ${ready ? "ok" : "warn"}`,
            onClick: refreshStatus,
            title: t("recheck"),
            children: ready ? t("envReady") : t("envMissing")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          SettingsIcon,
          {
            onClick: () => setSettingsOpen(true),
            active: Boolean(modelChoice),
            label: t("settingsOpen")
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      MarketBar,
      {
        data: market,
        loading: marketLoading,
        activeCode,
        t,
        onPick: (item) => {
          const picked = { code: item.code, name: item.name };
          setSelected(picked);
          setKeyword(`${item.name} ${item.code}`);
          setResult(null);
          setOverlays([]);
          setPreviewBars(null);
          setPhase("idle");
          loadPreview(item.code, scale);
        }
      }
    ),
    setupVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-setup", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-setupTitle", children: t("setupTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-setupBody", children: t("setupBody") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-setupFacts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "Python\uFF1A",
          status.python
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "PyTorch\uFF1A",
          status.env?.ok ? status.env.torch : "\u672A\u5B89\u88C5"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u6A21\u578B\uFF1A",
          status.modelReady ? "\u5DF2\u4E0B\u8F7D" : "\u672A\u4E0B\u8F7D\uFF081.1 GB\uFF09"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-setupActions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-primary", onClick: startSetup, children: t("setupStart") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: refreshStatus, children: t("recheck") })
      ] })
    ] }),
    (setup.running || setup.logs.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-setup kfc-logPane", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-setupTitle", children: setup.error ? t("setupFailed") : setup.running ? t("setupRunning") : t("setupDone") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "kfc-log", children: setup.logs.join("\n") || "\u2026" }),
      setup.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-error", children: setup.error }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-searchWrap", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            className: "kfc-search",
            value: keyword,
            placeholder: t("searchPlaceholder"),
            spellCheck: false,
            onFocus: () => setSearchOpen(true),
            onBlur: () => setTimeout(() => setSearchOpen(false), 150),
            onChange: (event) => {
              setKeyword(event.target.value);
              setSelected(null);
              setSearchOpen(true);
            },
            onKeyDown: onKeywordKey
          }
        ),
        searchOpen && suggestions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-suggest", children: suggestions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            className: "kfc-suggestItem",
            onMouseDown: (event) => event.preventDefault(),
            onClick: () => pick(item),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-suggestName", children: item.name }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-suggestCode", children: item.code })
            ]
          },
          item.code
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Select,
        {
          className: "kfc-ddScale",
          value: scale,
          title: t("scaleHint"),
          width: 188,
          options: scales.map((item) => ({
            value: item.key,
            label: `${item.key} \xB7 ${item.label}`,
            hint: `${item.Lc}/${item.Lh}`
          })),
          onChange: (next) => {
            setScale(next);
            const code = selected?.code ?? result?.code;
            if (code) {
              setResult(null);
              setOverlays([]);
              setPreviewBars(null);
              setPhase("idle");
              setRefine({ state: "idle", path: null, ret: null, originalRet: null, confidence: null, reasons: [], model: "", error: null });
              loadPreview(code, next);
            }
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Select,
        {
          className: "kfc-ddQuality",
          value: quality,
          title: t("qualityHint"),
          width: 104,
          align: "right",
          options: QUALITY.map((item) => ({ value: item.key, label: t(`quality.${item.key}`) })),
          onChange: setQuality
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: `kfc-iconBtn ${pinned ? "on" : ""}`,
          onClick: starCurrent,
          disabled: !activeCode,
          title: pinned ? t("unpinHint") : t("pinHint"),
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StarIcon, { filled: pinned })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kfc-check", title: t("autoHint"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: autoRefresh,
            onChange: (event) => setAutoRefresh(event.target.checked)
          }
        ),
        t("auto")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kfc-check", title: t("limitHint"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: applyLimit,
            onChange: (event) => setApplyLimit(event.target.checked)
          }
        ),
        t("limit")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kfc-check", title: t("compareHint"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: comparePast,
            onChange: (event) => setComparePast(event.target.checked)
          }
        ),
        t("compare")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: `kfc-check ${incremental ? "on" : ""}`, title: t("incrementalHint"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: incremental,
            onChange: (event) => setIncremental(event.target.checked)
          }
        ),
        t("incremental")
      ] })
    ] }),
    chips.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-chips", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-chipsLabel", children: t("watchlist") }),
      chips.map((item) => {
        const active = item.code === activeCode;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `kfc-chipItem ${active ? "active" : ""}`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              className: "kfc-chipMain",
              title: item.code,
              onClick: () => pick({ code: item.code, name: item.name }),
              children: [
                item.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StarIcon, { filled: true }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecentIcon, {}),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: item.name }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.code })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "kfc-chipDrop",
              title: t("removeHint"),
              onClick: () => removeFromWatchlist(item.code),
              children: "\xD7"
            }
          )
        ] }, item.code);
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: `kfc-quote ${activeCode ? "" : "empty"}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-quoteMain", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-quoteName", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: activeName || t("noStock") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeCode ?? "" })
        ] }),
        quote && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `kfc-quotePrice ${quoteUp ? "up" : "down"}`, children: [
            tickState === "ok" && liveQuote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-liveDot", title: t("livePriceHint") }) : null,
            priceStr(quote.price),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: pct((quote.changePercent ?? 0) / 100) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-quoteMeta", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              "\u5F00 ",
              priceStr(quote.open)
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              "\u9AD8 ",
              priceStr(quote.high)
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              "\u4F4E ",
              priceStr(quote.low)
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              "\u91CF ",
              numStr(quote.volume)
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: quoteTime(quote.time) }),
            tickAt > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kfc-tickAge", children: [
              t("quoteUpdated"),
              " ",
              relativeTime(new Date(tickAt).toISOString(), now)
            ] }) : null,
            !marketOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-chip", children: t("marketClosed") }) : null
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-quoteSpacer" }),
        chartData && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-quoteMeta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            t("lastBar"),
            " ",
            latestRealized ?? chartData.asOf
          ] }),
          chartData.Lh > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            t("horizon"),
            " ",
            chartData.Lh,
            " \u6839"
          ] }) : null,
          chartData.source ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-chip", children: chartData.source }) : null,
          chartData.adjustmentApplied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-chip", children: t("adj") }) : null,
          chartData.nPad > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kfc-chip warn", children: [
            "\u586B\u5145 ",
            chartData.nPad
          ] }) : null,
          resultAt > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kfc-chip", children: [
            t("updated"),
            " ",
            relativeTime(new Date(resultAt).toISOString(), now)
          ] }) : null,
          result?.droppedForming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-chip warn", children: t("formingDropped") }) : null,
          tickState !== "idle" && !running ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "span",
            {
              className: `kfc-chip live ${tickState === "fail" ? "warn" : ""}`,
              title: tickState === "fail" ? t("watchFail") : autoRefresh ? t("watchHint") : t("quoteOnlyHint"),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-dot" }),
                tickState === "fail" ? t("watchRetry") : autoRefresh ? t("watching") : t("quoteOnly")
              ]
            }
          ) : null
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "kfc-run kfc-runInline",
          disabled: running || !activeCode,
          title: activeCode ? t("runHint") : t("needStock"),
          onClick: () => run({ silent: Boolean(result) }),
          children: running ? t("running") : result ? t("rerun") : t("runForecast")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-main", children: [
      stale && !running ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-staleBar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-dot" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          t("staleResult"),
          " ",
          latestBar
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => run({ silent: true }), children: t("refreshNow") })
      ] }) : null,
      notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-notice", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: notice }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => setNotice(""), children: t("dismiss") })
      ] }) : null,
      error && !running && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-errorPane", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: t("failed") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => setError(null), children: t("dismiss") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-canvasArea", children: [
        chartData && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `kfc-resultPane ${refreshing ? "refreshing" : ""}`, children: [
          refreshing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-refreshBar", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${progressPct}%` } }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ForecastChart,
            {
              data: chartData,
              height: 340,
              overlays: comparePast ? overlays : null,
              livePrice: Number.isFinite(quote?.price) ? quote.price : null,
              liveCandle,
              realizedBars,
              refined: refine.path
            }
          ),
          isPreview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-previewBar", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("previewOnly") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-primary", onClick: () => run(), children: t("runForecast") })
          ] }) : null,
          !isPreview && comparePast && overlays && overlays.some((item) => item.verify) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-compare", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-compareLabel", children: t("compareTitle") }),
            overlays.filter((item) => item.verify).slice(0, 3).map((item) => {
              const v = item.verify;
              const hit = v.insideBand === true;
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "span",
                {
                  className: `kfc-compareItem ${hit ? "hit" : "miss"}`,
                  title: `${t("comparePred")} ${pct(v.predRet)} / ${t("compareActual")} ${pct(v.actualRet)}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: item.asOf?.slice(5, 10) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: pct(v.predRet) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                      "\u2192 ",
                      pct(v.actualRet)
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: v.complete ? "" : `${v.realizedBars}/${v.totalBars}` })
                  ]
                },
                item.id
              );
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-compareNote", children: t("compareNote") })
          ] }) : null,
          !isPreview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-stats", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              StatCard,
              {
                label: t("stat.median"),
                value: pct(result.stats.retMedian),
                tone: result.stats.retMedian >= 0 ? "up" : "down",
                hint: `${t("stat.target")} ${priceStr(result.stats.targetMedian)}`,
                stale: refreshing
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              StatCard,
              {
                label: t("stat.upProb"),
                value: `${(result.stats.upProb * 100).toFixed(0)}%`,
                tone: result.stats.upProb >= 0.5 ? "up" : "down",
                hint: `${t("stat.q05q95")} ${pct(result.stats.retQ05)} ~ ${pct(result.stats.retQ95)}`,
                stale: refreshing
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              StatCard,
              {
                label: t("stat.range"),
                value: `${priceStr(result.stats.targetQ05)} ~ ${priceStr(result.stats.targetQ95)}`,
                hint: t("stat.rangeHint"),
                stale: refreshing
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              StatCard,
              {
                label: t("stat.vol"),
                value: pct(result.stats.volMedian),
                hint: `${t("stat.drawdown")} ${pct(result.stats.maxDdMedian)}`,
                stale: refreshing
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              StatCard,
              {
                label: t("stat.paths"),
                value: `${result.nPaths} \xD7 ${result.steps}`,
                hint: `${result.device} \xB7 ${result.sampleSeconds}s`,
                stale: refreshing
              }
            )
          ] }) : null
        ] }),
        !chartData && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelIcon, { size: 32 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyTitle", children: t("emptyTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyBody", children: t("emptyBody") }),
          chips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyHint", children: t("emptyHint") }) : null
        ] }),
        showProgressPane && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ProgressOverlay,
          {
            steps: progress.step,
            total: progress.total,
            stage,
            elapsed,
            onCancel: () => abortRef.current?.abort(),
            labels: { working: t("working"), cancel: t("cancel"), stepsUnit: t("stepsUnit") }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-infoGrid", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          InsightPanel,
          {
            state: insight.state,
            text: insight.text,
            model: insight.model,
            error: insight.error,
            onRun: runInsightNow,
            onStop: () => insightAbortRef.current?.abort(),
            onClear: () => setInsight({ state: "idle", text: "", model: "", error: null }),
            refine,
            onRefine: runRefine,
            canRefine: Boolean(result),
            t
          }
        ),
        activeCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          NewsPanel,
          {
            data: news,
            loading: newsLoading,
            error: newsError,
            tab: newsTab,
            onTab: setNewsTab,
            onRefresh: () => loadNews(activeCode, { force: true }),
            cooldown: newsCooldown,
            t,
            now
          }
        ) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-footNote", children: ready || !status ? t("footNote") : t("footModelMissing") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SettingsDialog,
      {
        open: settingsOpen,
        onClose: () => setSettingsOpen(false),
        models,
        loading: modelsLoading,
        error: modelsError,
        selected: modelChoice,
        onSelect: chooseModel,
        onRefresh: loadModels,
        t
      }
    )
  ] });
}
function PanelIcon({ size = 18 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 20h18", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", opacity: ".5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.5 15.5l4-5 3.4 3.2 3.1-6.2", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 11.5h5.5", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeDasharray: "2 2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "20.5", cy: "11.5", r: "1.6", fill: "currentColor" })
  ] });
}

// src/client/styles.js
var STYLES = `
.kfc-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  container-type: inline-size;
  container-name: kfc;
}
.kfc-root *, .kfc-root *::before, .kfc-root *::after { box-sizing: border-box; }

/* \u5934\u90E8 ------------------------------------------------------------------ */
.kfc-header {
  position: sticky;
  top: 0;
  z-index: 6;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent);
  backdrop-filter: blur(8px);
}
.kfc-mark {
  display: grid;
  place-items: center;
  width: 34px; height: 34px;
  flex: none;
  border-radius: 10px;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.kfc-headCopy { min-width: 0; flex: 1; }
.kfc-title {
  display: flex; align-items: baseline; gap: 8px;
  margin: 0;
  font-size: 15px; font-weight: 600; letter-spacing: .01em;
}
.kfc-title small {
  font-size: 11px; font-weight: 500;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .04em;
}
.kfc-sub {
  margin: 2px 0 0;
  font-size: 12px; line-height: 1.4;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.kfc-headActions { display: flex; align-items: center; gap: 8px; flex: none; }
.kfc-ghost.ok { color: var(--dsw-alias-state-success-primary); }
.kfc-ghost.warn { color: var(--dsw-alias-state-warn-primary); }

/* \u6309\u94AE ------------------------------------------------------------------ */
.kfc-root button { font: inherit; }
.kfc-ghost, .kfc-primary, .kfc-run, .kfc-scale, .kfc-suggestItem {
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.kfc-ghost {
  padding: 5px 10px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-ghost:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.kfc-primary {
  padding: 7px 14px;
  font-size: 13px; font-weight: 600;
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: #fff;
}
.kfc-primary:hover { filter: brightness(1.05); }
.kfc-run {
  padding: 7px 16px;
  font-size: 13px; font-weight: 600;
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: #fff;
}
.kfc-run:disabled { opacity: .6; cursor: progress; }

/* \u521D\u59CB\u5316 ---------------------------------------------------------------- */
.kfc-setup {
  margin: 14px 20px 0;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-setupTitle { font-size: 13px; font-weight: 600; }
.kfc-setupBody {
  margin-top: 6px;
  font-size: 12px; line-height: 1.65;
  color: var(--dsw-alias-label-secondary);
}
.kfc-setupFacts {
  display: flex; flex-wrap: wrap; gap: 6px 14px;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-setupActions { display: flex; gap: 8px; margin-top: 12px; }
.kfc-logPane { padding: 12px 16px; }
.kfc-log {
  margin: 8px 0 0;
  max-height: 160px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* \u5DE5\u5177\u6761 ---------------------------------------------------------------- */
.kfc-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  flex-wrap: wrap;
}
.kfc-searchWrap { position: relative; flex: 1 1 220px; min-width: 180px; }
.kfc-search {
  width: 100%;
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px;
  outline: none;
}
.kfc-search:focus { border-color: var(--dsw-alias-brand-primary); }
.kfc-suggest {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0; right: 0;
  max-height: 240px; overflow: auto;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 10px 28px rgba(0,0,0,.14);
}
.kfc-suggestItem {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%;
  padding: 6px 9px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 13px;
}
.kfc-suggestItem:hover { background: var(--dsw-alias-bg-layer-2); }
.kfc-suggestCode { font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }

.kfc-scales {
  display: inline-flex;
  padding: 2px;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-scale {
  padding: 5px 9px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.kfc-scale:hover { color: var(--dsw-alias-label-primary); }
.kfc-scale.active {
  background: var(--dsw-alias-brand-primary);
  color: #fff;
}
.kfc-selectScale { min-width: 168px; font-variant-numeric: tabular-nums; }
.kfc-select {
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12.5px;
}
.kfc-check {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  user-select: none;
}

/* \u884C\u60C5\u6761 ---------------------------------------------------------------- */
.kfc-quote {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 20px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
/* \u5DE6\u4FA7\u5185\u5BB9\u81EA\u5DF1\u6362\u884C\uFF0C\u4E3B\u6309\u94AE\u6C38\u8FDC\u8D34\u5728\u53F3\u8FB9\u3001\u4E0D\u4F1A\u6389\u5230\u4E0B\u4E00\u884C */
.kfc-quoteMain {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px 14px;
  flex-wrap: wrap;
}
.kfc-quoteSpacer { flex: 1 1 0; }
.kfc-quoteName { display: flex; align-items: baseline; gap: 8px; font-size: 14px; }
.kfc-quoteName b { font-weight: 600; }
.kfc-quoteName span { font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.kfc-quotePrice {
  font-size: 20px; font-weight: 650;
  font-variant-numeric: tabular-nums;
  display: flex; align-items: baseline; gap: 8px;
}
.kfc-quotePrice span { font-size: 12.5px; font-weight: 500; }
.kfc-quotePrice.up, .kfc-statValue.up { color: #e04a4a; }
.kfc-quotePrice.down, .kfc-statValue.down { color: #22a06b; }
.kfc-quoteMeta {
  display: flex; flex-wrap: wrap; gap: 4px 12px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.kfc-quoteSpacer { flex: 1 1 0; }
.kfc-chip {
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  font-size: 11px;
}
.kfc-chip.warn { color: var(--dsw-alias-state-warn-primary); }

/* \u4E3B\u4F53 ------------------------------------------------------------------ */
.kfc-main { flex: 1; min-height: 0; padding: 12px 20px 6px; display: flex; flex-direction: column; gap: 12px; }

.kfc-progressPane {
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-progressHead { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.kfc-progressHead b { font-weight: 600; }
.kfc-elapsed { margin-left: auto; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; font-size: 12px; }
.kfc-spinner {
  width: 12px; height: 12px; flex: none;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: kfc-spin .8s linear infinite;
}
@keyframes kfc-spin { to { transform: rotate(360deg); } }
.kfc-bar {
  margin-top: 12px;
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  overflow: hidden;
}
.kfc-bar i {
  display: block; height: 100%;
  border-radius: 999px;
  background: var(--dsw-alias-brand-primary);
  transition: width .25s ease;
}
.kfc-progressHint {
  margin-top: 8px;
  font-size: 11.5px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}

.kfc-errorPane {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  font-size: 12.5px;
  display: flex; flex-direction: column; gap: 8px;
}
.kfc-errorPane b { color: var(--dsw-alias-state-error-primary); }
.kfc-errorPane button { align-self: flex-start; }

.kfc-chart {
  position: relative;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  padding: 6px 4px 2px;
  overflow: hidden;
}
.kfc-chart canvas { display: block; width: 100%; }
.kfc-tip {
  position: absolute;
  /* \u4F4D\u7F6E\u7531 JS \u8DDF\u7740\u9F20\u6807\u7B97\uFF0C\u8FD9\u91CC\u53EA\u515C\u5E95 */
  top: 38px; right: 74px;
  min-width: 116px;
  padding: 7px 9px;
  z-index: 5;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 92%, transparent);
  backdrop-filter: blur(6px);
  font-size: 11px;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}
.kfc-tipLabel { margin-bottom: 3px; color: var(--dsw-alias-label-secondary); }
.kfc-tipRow { display: flex; justify-content: space-between; gap: 12px; line-height: 1.55; }
.kfc-tipRow b { font-weight: 600; }

.kfc-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 10px;
}
.kfc-statCard {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-statLabel { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.kfc-statValue {
  margin-top: 4px;
  font-size: 16px; font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: .01em;
}
.kfc-statHint {
  margin-top: 3px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}

.kfc-empty {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.kfc-emptyTitle { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.kfc-emptyBody { max-width: 460px; font-size: 12.5px; line-height: 1.7; }

.kfc-footNote {
  padding: 4px 0 14px;
  font-size: 11px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}

@container kfc (max-width: 620px) {
  .kfc-toolbar { padding: 10px 14px; }
  .kfc-header { padding: 11px 14px; }
  .kfc-main { padding: 10px 14px 6px; }
  .kfc-quote { padding: 2px 14px 8px; }
  .kfc-sub { display: none; }
  .kfc-stats { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
}

/* \u52A0\u8F7D\u6001 --------------------------------------------------------------- */
.kfc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  font-size: 13px;
  color: var(--dsw-alias-label-secondary);
}

/* \u5E38\u7528\u80A1\u7968 chips -------------------------------------------------------- */
.kfc-chips {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 20px 10px;
  flex-wrap: wrap;
}
.kfc-chipsLabel {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .04em;
  margin-right: 2px;
}
.kfc-chipItem {
  display: inline-flex;
  align-items: stretch;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
  max-width: 230px;
}
.kfc-chipItem.active {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.kfc-chipMain {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 9px;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  min-width: 0;
}
.kfc-chipMain b {
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kfc-chipMain span {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  font-size: 10.5px;
}
.kfc-chipMain svg { flex: none; color: var(--dsw-alias-label-secondary); }
.kfc-chipItem.active .kfc-chipMain svg { color: var(--dsw-alias-brand-primary); }
.kfc-chipItem:hover { background: var(--dsw-alias-bg-layer-2); }
.kfc-chipDrop {
  padding: 0 6px;
  border: none;
  border-left: 1px solid var(--dsw-alias-border-l1);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.kfc-chipDrop:hover { color: var(--dsw-alias-state-error-primary); }

/* \u6536\u85CF\u6309\u94AE ------------------------------------------------------------- */
.kfc-iconBtn {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: color .15s ease, background .15s ease, border-color .15s ease;
}
.kfc-iconBtn:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.kfc-iconBtn.on {
  color: var(--dsw-alias-brand-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.kfc-iconBtn:disabled { opacity: .45; cursor: default; }

/* \u5237\u65B0\u4E2D\u7684\u8F7B\u63D0\u793A -------------------------------------------------------- */
.kfc-livePill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.kfc-spinner.sm {
  width: 9px;
  height: 9px;
  border-width: 1.5px;
}

/* \u7ED3\u679C\u533A\uFF1A\u5237\u65B0\u65F6\u4FDD\u7559\u65E7\u56FE\uFF0C\u53EA\u52A0\u4E00\u6761\u7EC6\u8FDB\u5EA6 ------------------------------- */
.kfc-resultPane { position: relative; display: flex; flex-direction: column; gap: 12px; }
.kfc-resultPane.refreshing { opacity: .96; }
.kfc-refreshBar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  border-radius: 2px;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
  z-index: 3;
}
.kfc-refreshBar i {
  display: block;
  height: 100%;
  background: var(--dsw-alias-brand-primary);
  transition: width .3s ease;
}
.kfc-statCard.stale .kfc-statValue { opacity: .55; }

/* \u975E\u963B\u65AD\u63D0\u793A\u6761 --------------------------------------------------------- */
.kfc-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 35%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent);
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
}
.kfc-notice span { flex: 1; min-width: 0; }

.kfc-emptyHint {
  margin-top: 4px;
  max-width: 460px;
  font-size: 11.5px;
  line-height: 1.65;
  opacity: .8;
}

/* \u8DDF\u968F\u4E2D\u6807\u8BB0 ------------------------------------------------------------ */
.kfc-chip.live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dsw-alias-brand-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, transparent);
}
.kfc-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: kfc-pulse 1.6s ease-in-out infinite;
}
@keyframes kfc-pulse {
  0%, 100% { opacity: .35; }
  50% { opacity: 1; }
}

/* \u5BF9\u6BD4\u5386\u53F2 ------------------------------------------------------------- */
.kfc-check.on { color: var(--dsw-alias-brand-primary); }

.kfc-compare {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  font-size: 11.5px;
}
.kfc-compareLabel {
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .03em;
}
.kfc-compareItem {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  font-variant-numeric: tabular-nums;
}
.kfc-compareItem i {
  font-style: normal;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-compareItem b { font-weight: 600; color: #f0a44a; }
.kfc-compareItem span { color: var(--dsw-alias-label-primary); }
.kfc-compareItem em {
  font-style: normal;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
  opacity: .8;
}
.kfc-compareItem.hit { border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 35%, transparent); }
.kfc-compareItem.miss { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 35%, transparent); }
.kfc-compareNote {
  margin-left: auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
}

/* \u73B0\u4EF7\u6807\u8BB0 ------------------------------------------------------------- */
.kfc-liveDot {
  display: inline-block;
  width: 7px; height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background: #6ec1ff;
  box-shadow: 0 0 0 0 rgba(110,193,255,.7);
  animation: kfc-liveRing 1.8s ease-out infinite;
  vertical-align: middle;
}
@keyframes kfc-liveRing {
  0% { box-shadow: 0 0 0 0 rgba(110,193,255,.55); }
  70% { box-shadow: 0 0 0 7px rgba(110,193,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(110,193,255,0); }
}
.kfc-tickAge { opacity: .75; }

/* \u56FE\u8868\u5DE5\u5177\u6761\u4E0E\u7F29\u653E ----------------------------------------------------- */
.kfc-chart { cursor: crosshair; }
.kfc-chart.dragging { cursor: grabbing; }
.kfc-chartTools {
  position: absolute;
  top: 8px; right: 74px;
  z-index: 4;
  display: flex;
  gap: 4px;
}
.kfc-chartTools button {
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 88%, transparent);
  backdrop-filter: blur(6px);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  line-height: 1;
  cursor: pointer;
  transition: color .15s ease, border-color .15s ease;
}
.kfc-chartTools button:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l2);
}
.kfc-chartTools button.wide { padding: 0 9px; }
.kfc-zoomHint {
  position: absolute;
  left: 10px;
  bottom: 24px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 80%, transparent);
  padding: 2px 7px;
  border-radius: 999px;
}

/* \u60AC\u505C\u6D6E\u5C42\uFF1A\u66F4\u6E05\u695A\u7684\u6570\u503C\u9762\u677F ------------------------------------------- */
.kfc-tip {
  min-width: 152px;
  padding: 8px 10px;
  font-size: 11.5px;
}
.kfc-tipHead {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.kfc-tipKind {
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 15px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.kfc-tip.kind-pred .kfc-tipKind {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
}
.kfc-tipLabel {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}
.kfc-tipRow { line-height: 1.7; }
.kfc-tipRow span { color: var(--dsw-alias-label-secondary); }
.kfc-tipRow b { font-weight: 600; font-variant-numeric: tabular-nums; }
.kfc-tipRow b.up { color: #e04a4a; }
.kfc-tipRow b.down { color: #22a06b; }

/* \u884C\u60C5\u9884\u89C8 / \u9884\u6D4B\u8FC7\u671F --------------------------------------------------- */
.kfc-previewBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px dashed var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-previewBar span { flex: 1; min-width: 0; }
.kfc-previewBar button { flex: none; padding: 5px 14px; }

.kfc-staleBar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent);
  font-size: 11.5px;
  color: var(--dsw-alias-label-primary);
}
.kfc-staleBar .kfc-dot { color: var(--dsw-alias-brand-primary); background: currentColor; }
.kfc-staleBar span:nth-child(2) { flex: 1; min-width: 0; }
.kfc-staleBar button { padding: 3px 10px; }

/* \u9884\u6D4B\u8FDB\u5EA6\u8986\u76D6\u5C42 ------------------------------------------------------- */
.kfc-canvasArea {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* \u5173\u952E\uFF1Aflex \u5B50\u9879\u9ED8\u8BA4 min-height:auto \u4F1A\u8BA9\u5BB9\u5668\u584C\u9677\uFF0C\u800C\u7ED3\u679C\u9762\u677F\u6BD4\u5BB9\u5668\u9AD8\uFF0C
     \u6EA2\u51FA\u90E8\u5206\u5C31\u538B\u5728\u4E0B\u9762\u7684 AI \u89E3\u8BFB\u9762\u677F\u4E0A\u3001\u6321\u4F4F\u5B83\u7684\u6309\u94AE\uFF08\u70B9\u4E0D\u5230\uFF09\u3002
     \u8FD9\u91CC\u8BA9\u5BB9\u5668\u9AD8\u5EA6\u7531\u5185\u5BB9\u6491\u5F00\u3002 */
  min-height: auto;
  isolation: isolate;
}
.kfc-canvasArea > .kfc-resultPane,
.kfc-canvasArea > .kfc-empty,
.kfc-canvasArea > .kfc-previewBar { flex: none; }

.kfc-overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  border-radius: 12px;
  /* \u53EA\u8F7B\u5FAE\u538B\u6697\uFF0C\u8BA9\u56FE\u8868\u4ECD\u7136\u6E05\u6670\u53EF\u8BFB\uFF08\u4E4B\u524D 42% \u592A\u9ED1\uFF0C\u56FE\u50CF\u7CCA\u6210\u4E00\u7247\uFF09 */
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 18%, transparent);
  animation: kfc-fadeIn .18s ease;
}
@keyframes kfc-fadeIn { from { opacity: 0 } to { opacity: 1 } }

.kfc-overlayCard {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  min-width: 320px;
  border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 96%, transparent);
  box-shadow: 0 12px 34px rgba(0, 0, 0, .28);
}

.kfc-ring {
  position: relative;
  flex: none;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  color: var(--dsw-alias-brand-primary);
}
.kfc-ring svg { position: absolute; inset: 0; }
.kfc-ringText {
  position: relative;
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  letter-spacing: .01em;
}

.kfc-overlayText {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.kfc-overlayText b {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kfc-overlayText span {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}

.kfc-overlayCancel { flex: none; padding: 5px 11px; }

@container kfc (max-width: 560px) {
  .kfc-overlayCard { min-width: 0; width: calc(100% - 32px); gap: 10px; padding: 12px 14px; }
  .kfc-overlayCancel { padding: 4px 8px; }
}

/* \u81EA\u7ED8\u4E0B\u62C9\u6846 ----------------------------------------------------------- */
.kfc-dd { position: relative; flex: none; }
.kfc-ddTrigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 9px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}
.kfc-ddTrigger:hover { border-color: var(--dsw-alias-border-l2); }
.kfc-dd.open .kfc-ddTrigger {
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-bg-layer-2);
}
.kfc-ddValue {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.kfc-ddCaret {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  transition: transform .16s ease;
}
.kfc-dd.open .kfc-ddCaret { transform: rotate(180deg); }

.kfc-ddList {
  position: absolute;
  z-index: 30;
  top: calc(100% + 5px);
  left: 0;
  min-width: 100%;
  max-height: 288px;
  overflow: auto;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 14px 34px rgba(0, 0, 0, .3);
  animation: kfc-ddIn .12s ease;
}
.kfc-ddList.right { left: auto; right: 0; }
@keyframes kfc-ddIn {
  from { opacity: 0; transform: translateY(-3px); }
  to { opacity: 1; transform: none; }
}
.kfc-ddItem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.kfc-ddItem.active { background: var(--dsw-alias-bg-layer-2); }
.kfc-ddItem.selected { color: var(--dsw-alias-brand-primary); }
.kfc-ddItemLabel { flex: 1; min-width: 0; white-space: nowrap; }
.kfc-ddItemHint {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.kfc-ddCheck { flex: none; }

/* \u884C\u60C5\u6761\u91CC\u7684\u4E3B\u6309\u94AE ----------------------------------------------------- */
.kfc-quote.empty .kfc-quoteName b { color: var(--dsw-alias-label-secondary); font-weight: 500; }
.kfc-runInline {
  flex: none;
  margin-left: 4px;
  padding: 7px 18px;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent);
}
.kfc-runInline:disabled { box-shadow: none; }

/* \u5DE5\u5177\u680F\u91CC\u53BB\u6389\u4E3B\u6309\u94AE\u540E\uFF0C\u8BA9\u5B83\u81EA\u7136\u6536\u5C3E */
.kfc-toolbar { padding-bottom: 10px; }

/* \u516C\u544A / \u65B0\u95FB ---------------------------------------------------------- */
.kfc-news {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.kfc-newsBar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 46px;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.kfc-newsTitle {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .04em;
  margin-right: 4px;
}
.kfc-newsTab {
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: color .15s ease, background .15s ease;
}
.kfc-newsTab:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.kfc-newsTab.active {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.kfc-newsRefresh { padding: 2px 9px; font-size: 11px; }
.kfc-newsRefresh:disabled { opacity: .55; cursor: default; }
.kfc-newsLoading, .kfc-newsError {
  margin-left: auto;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-newsError { color: var(--dsw-alias-state-warn-primary); }

.kfc-newsList {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  overflow: auto;
}
.kfc-newsItem {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 12px;
  font-size: 12px;
  line-height: 1.5;
}
.kfc-newsItem:hover { background: var(--dsw-alias-bg-layer-2); }
.kfc-newsDate {
  flex: none;
  width: 44px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.kfc-newsTag {
  flex: none;
  max-width: 116px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  line-height: 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kfc-newsLink {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
a.kfc-newsLink:hover { color: var(--dsw-alias-brand-primary); text-decoration: underline; }
.kfc-newsEmpty {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 12px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  text-align: center;
}

/* \u5927\u76D8\u6982\u89C8 ------------------------------------------------------------- */
.kfc-market {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  /* \u5DE6\u53F3\u5185\u8FB9\u8DDD\u62B5\u6D88\u7B2C\u4E00\u4E2A/\u6700\u540E\u4E00\u4E2A\u6307\u6570\u5757\u7684\u5185\u8FB9\u8DDD\uFF0C\u6587\u5B57\u4E0E\u641C\u7D22\u6846\u5BF9\u9F50 */
  padding: 0 10px 9px;
  /* \u5438\u9876\u5728 header \u4E0B\u65B9\uFF1A\u504F\u79FB\u7531\u811A\u672C\u6309 header \u5B9E\u6D4B\u9AD8\u5EA6\u6CE8\u5165\uFF0C\u907F\u514D\u88AB header \u538B\u4F4F */
  position: sticky;
  top: var(--kfc-market-top, 0px);
  z-index: 5;
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid transparent;
  transition: border-color .18s ease, box-shadow .18s ease;
}
/* \u6EDA\u52A8\u540E\u52A0\u4E00\u6761\u5206\u9694\u7EBF\uFF0C\u907F\u514D\u6307\u6570\u6587\u5B57\u548C\u4E0B\u9762\u5185\u5BB9\u7CCA\u5728\u4E00\u8D77 */
.kfc-market.stuck {
  border-bottom-color: var(--dsw-alias-border-l1);
  box-shadow: 0 6px 14px -10px rgba(0, 0, 0, .5);
}
.kfc-marketRow {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.kfc-marketRow::-webkit-scrollbar { display: none; }
.kfc-index {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 5px 9px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  font: inherit;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}
.kfc-index:hover { background: var(--dsw-alias-bg-layer-1); }
.kfc-index.active {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent);
}
.kfc-indexName {
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
  line-height: 14px;
  white-space: nowrap;
}
.kfc-indexPrice {
  font-size: 13px;
  font-weight: 600;
  line-height: 17px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.kfc-indexChg {
  font-size: 10.5px;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
.kfc-index.up .kfc-indexPrice, .kfc-index.up .kfc-indexChg { color: var(--dsw-alias-state-danger-primary); }
.kfc-index.down .kfc-indexPrice, .kfc-index.down .kfc-indexChg { color: var(--dsw-alias-state-success-primary); }
.kfc-marketLoading {
  align-self: center;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  padding: 0 8px;
}

.kfc-breadth {
  flex: none;
  width: 168px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kfc-breadthBar {
  display: flex;
  height: 5px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-2);
}
.kfc-breadthBar i { display: block; height: 100%; }
.kfc-breadthBar .up { background: var(--dsw-alias-state-danger-primary); }
.kfc-breadthBar .down { background: var(--dsw-alias-state-success-primary); }
.kfc-breadthBar .flat { background: var(--dsw-alias-label-secondary); opacity: .4; }
.kfc-breadthText {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
.kfc-breadthText .up { color: var(--dsw-alias-state-danger-primary); }
.kfc-breadthText .down { color: var(--dsw-alias-state-success-primary); }

/* AI \u89E3\u8BFB -------------------------------------------------------------- */
.kfc-insight {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.kfc-insight.running { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); }
.kfc-insightBar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  height: 46px;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.kfc-insightTitle {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .04em;
}
.kfc-insightModel {
  max-width: 220px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kfc-insightSpacer { flex: 1; }
.kfc-insightBar button {
  padding: 5px 12px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 7px;
}
.kfc-insightBar .kfc-insightRun { padding: 5px 14px; }
.kfc-insightText {
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.72;
  word-break: break-word;
  overflow: auto;
  color: var(--dsw-alias-label-primary);
}
.kfc-insightHint {
  /* \u4E0E\u6D88\u606F\u9762\u5E76\u6392\u65F6\u672A\u751F\u6210\u89E3\u8BFB\u7684\u5361\u7247\u4F1A\u88AB\u62C9\u5230\u540C\u9AD8\uFF0C
     \u8FD9\u91CC\u6491\u6EE1\u5E76\u5782\u76F4\u5C45\u4E2D\uFF0C\u907F\u514D\u4E0A\u65B9\u4E00\u5927\u7247\u7A7A\u767D\u50CF\u52A0\u8F7D\u5931\u8D25 */
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 14px 20px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--dsw-alias-label-secondary);
}
.kfc-insightError {
  margin: 10px 12px 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  color: var(--dsw-alias-state-warn-primary);
  font-size: 11.5px;
}
.kfc-caret {
  display: inline-block;
  width: 6px;
  height: 14px;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--dsw-alias-brand-primary);
  animation: kfc-blink 1s steps(2) infinite;
}
@keyframes kfc-blink { 50% { opacity: 0 } }

/* AI \u4FEE\u6B63\u7ED3\u679C --------------------------------------------------------- */
.kfc-refineBox {
  margin: 10px 12px 12px;
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px dashed color-mix(in srgb, #f59e0b 42%, transparent);
  background: color-mix(in srgb, #f59e0b 7%, transparent);
}
.kfc-refineHead {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.kfc-refineLabel { font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.kfc-refineDelta {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.kfc-refineDelta b { color: #f59e0b; }
.kfc-refineConf { font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.kfc-refineReasons {
  margin: 7px 0 0;
  padding-left: 16px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--dsw-alias-label-primary);
}
.kfc-refineNote {
  margin-top: 7px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
}

/* \u5927\u76D8\u5438\u9876 ------------------------------------------------------------- */
.kfc-marketSticky {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--dsw-alias-bg-base);
  padding-top: 4px;
  margin-bottom: 2px;
}

/* \u8BBE\u7F6E\u6309\u94AE\u4E0E\u5F39\u7A97 -------------------------------------------------------- */
.kfc-iconBtn {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: color .15s ease, border-color .15s ease;
}
.kfc-iconBtn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.kfc-iconBtn.on { color: var(--dsw-alias-brand-primary); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); }

.kfc-modalMask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, .42);
  animation: kfc-fadeIn .14s ease;
}
.kfc-modal {
  width: min(460px, 100%);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 22px 56px rgba(0, 0, 0, .34);
  overflow: hidden;
}
.kfc-modalHead {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.kfc-modalHead b { flex: 1; font-size: 13.5px; }
.kfc-modalClose { padding: 2px 8px; }
.kfc-modalBody { padding: 14px 16px 16px; overflow: auto; }

.kfc-field { display: flex; flex-direction: column; gap: 5px; }
.kfc-fieldLabel { font-size: 12.5px; font-weight: 600; }
.kfc-fieldHint { font-size: 11.5px; line-height: 1.55; color: var(--dsw-alias-label-secondary); }
.kfc-modalHint, .kfc-modalEmpty {
  margin-top: 10px;
  padding: 12px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}
.kfc-modalError {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--dsw-alias-state-warn-primary);
}

.kfc-modelList {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 300px;
  overflow: auto;
}
.kfc-modelItem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.kfc-modelItem:hover { background: var(--dsw-alias-bg-layer-2); }
.kfc-modelItem.active {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
}
.kfc-modelName { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kfc-modelHint { font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.kfc-modelCheck { color: var(--dsw-alias-brand-primary); font-size: 12px; }

.kfc-modalActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* Markdown \u6392\u7248\uFF08AI \u89E3\u8BFB\uFF09--------------------------------------------- */
.kfc-md > *:first-child { margin-top: 0; }
.kfc-md > *:last-child { margin-bottom: 0; }

.kfc-mdP {
  margin: 0 0 8px;
  white-space: normal;
}
.kfc-mdHeading {
  margin: 14px 0 7px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
.kfc-mdList {
  margin: 0 0 8px;
  padding-left: 20px;
}
.kfc-mdList li { margin: 3px 0; }
.kfc-mdList li::marker { color: var(--dsw-alias-label-secondary); }

.kfc-mdCode {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
}
.kfc-mdPre {
  margin: 0 0 8px;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  overflow: auto;
}
.kfc-mdPre code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre;
}

.kfc-mdQuote {
  margin: 0 0 8px;
  padding: 2px 0 2px 10px;
  border-left: 2px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
}
.kfc-mdHr {
  margin: 12px 0;
  border: none;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

.kfc-md a {
  color: var(--dsw-alias-brand-primary);
  text-decoration: none;
}
.kfc-md a:hover { text-decoration: underline; }

.kfc-mdTableWrap { margin: 0 0 8px; overflow-x: auto; }
.kfc-mdTable {
  border-collapse: collapse;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
.kfc-mdTable th, .kfc-mdTable td {
  padding: 4px 9px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  text-align: left;
  white-space: nowrap;
}
.kfc-mdTable th {
  color: var(--dsw-alias-label-secondary);
  font-weight: 600;
}

/* \u6DA8\u8DCC\u5E45\u914D\u8272\uFF08\u4EC5 Markdown \u5185\uFF09 */
.kfc-mdUp { color: var(--dsw-alias-state-danger-primary); }
.kfc-mdDown { color: var(--dsw-alias-state-success-primary); }

/* \u89E3\u8BFB + \u6D88\u606F\u9762 \u5E76\u6392 --------------------------------------------------- */
.kfc-infoGrid {
  flex: none;
  display: grid;
  /* \u89E3\u8BFB\u5185\u5BB9\u66F4\u957F\uFF0C\u7ED9\u591A\u4E00\u70B9\u5BBD\u5EA6\uFF1B\u6D88\u606F\u9762\u6761\u76EE\u77ED\uFF0C\u7A84\u4E00\u70B9\u591F\u7528 */
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  /* \u4E24\u680F\u540C\u9AD8\uFF0C\u907F\u514D\u4E00\u957F\u4E00\u77ED\u770B\u8D77\u6765\u677E\u6563 */
  max-height: 460px;
  min-height: 168px;
}
.kfc-infoGrid > * { min-height: 0; }

/* \u53EA\u663E\u793A\u4E86\u5176\u4E2D\u4E00\u680F\u65F6\uFF08\u672A\u9009\u80A1\u7968\uFF09\uFF0C\u8BA9\u5B83\u5360\u6EE1\u6574\u884C */
.kfc-infoGrid > :only-child { grid-column: 1 / -1; max-height: 320px; }

@container kfc (max-width: 900px) {
  .kfc-infoGrid {
    grid-template-columns: minmax(0, 1fr);
    max-height: none;
  }
  .kfc-infoGrid > .kfc-insight { max-height: 320px; }
  .kfc-infoGrid > .kfc-news { max-height: 300px; }
}
`;

// src/client/index.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var PLUGIN_ID = "kit-forecast";
var PANEL_ID = "kit-forecast";
var STYLE_ID = `${PLUGIN_ID}/styles`;
var stylesInstalled = false;
function installStyles() {
  if (stylesInstalled || typeof document === "undefined") return;
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`);
  if (existing !== null) {
    stylesInstalled = true;
    return;
  }
  const tag = document.createElement("style");
  tag.dataset.plugin = PLUGIN_ID;
  tag.dataset.pluginCss = STYLE_ID;
  tag.textContent = STYLES;
  document.head.appendChild(tag);
  stylesInstalled = true;
}
var name = "kit-forecast";
var inject = ["slots", "locale"];
function apply(ctx) {
  installStyles();
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "kit-forecast: dictionaries");
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID,
    locale: NS
  }, (props) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KitForecastPanel, { ctx })));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 66,
    label: () => ctx.locale.bind(NS)("nav"),
    locale: NS
  }, (props) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PanelIcon, { size: props.size ?? 18, active: props.active === true })));
}

    return module.exports;
  },
});
