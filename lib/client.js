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
var import_react3 = __toESM(require("react"), 1);

// src/client/Panel.jsx
var import_react2 = __toESM(require("react"), 1);

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
function fetchTick(code, scale) {
  return postJson("/tick", { code, scale });
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
function runForecast(payload, options) {
  return consume("/forecast", payload, options);
}
function runSetup(payload, options) {
  return consume("/setup", payload, options);
}

// src/client/Chart.jsx
var import_react = __toESM(require("react"), 1);
var h = import_react.default.createElement;
var UP = "#e04a4a";
var DOWN = "#22a06b";
var PRED = "#3b82f6";
var GRID = "rgba(127,127,127,0.16)";
var TEXT = "rgba(127,127,127,0.95)";
function fmtPrice(value) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1e3) return value.toFixed(0);
  if (Math.abs(value) >= 100) return value.toFixed(1);
  return value.toFixed(2);
}
function fmtTime(label) {
  if (!label) return "";
  const date = label.slice(5, 10);
  const time = label.slice(11, 16);
  return time === "15:00" && label.length > 10 ? date : `${date} ${time}`;
}
function ForecastChart({ data, height = 320, overlays = null, livePrice = null, liveCandle = null }) {
  const canvasRef = import_react.default.useRef(null);
  const wrapRef = import_react.default.useRef(null);
  const [hover, setHover] = import_react.default.useState(null);
  const [hoverPos, setHoverPos] = import_react.default.useState({ x: 0, y: 0 });
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
    const nHist = Math.min(history.length, 60);
    const hist = history.slice(-nHist);
    const nPred = median.length;
    if (nHist === 0 || nPred === 0) return;
    const labels = [...hist.map((b) => b.t), ...median.map((b) => b.t)];
    const padLeft = 8;
    const padRight = 62;
    const padTop = 12;
    const volH = Math.round(heightPx * 0.16);
    const axisH = 18;
    const plotH = heightPx - padTop - volH - axisH - 6;
    const plotW = width - padLeft - padRight;
    const total = nHist + nPred;
    const step = plotW / total;
    const candleW = Math.max(1.4, Math.min(9, step * 0.62));
    const lows = [...hist.map((b) => b.l), ...data.bands?.low?.q05 ?? []];
    const highs = [...hist.map((b) => b.h), ...data.bands?.high?.q95 ?? []];
    for (const overlay of overlays ?? []) {
      for (const point of overlay.points ?? []) {
        for (const key of ["q05", "q95", "q50"]) {
          const value = point[key];
          if (Number.isFinite(value)) {
            lows.push(value);
            highs.push(value);
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
    const xOf = (index) => padLeft + (index + 0.5) * step;
    ctx.font = '10px ui-sans-serif, -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = TEXT;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    const ticks = 4;
    for (let i = 0; i <= ticks; i += 1) {
      const price = min + (max - min) * i / ticks;
      const y = yOf(price);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.fillText(fmtPrice(price), padLeft + plotW + 6, y + 3);
    }
    const basePrice = hist[hist.length - 1].c;
    const bandX = [xOf(nHist - 1), ...median.map((_, i) => xOf(nHist + i))];
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
    const drawCandle = (index, bar, color, alpha = 1) => {
      const x = xOf(index);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, yOf(bar.h));
      ctx.lineTo(x, yOf(bar.l));
      ctx.stroke();
      const top = yOf(Math.max(bar.o, bar.c));
      const bottom = yOf(Math.min(bar.o, bar.c));
      const hgt = Math.max(1, bottom - top);
      ctx.fillRect(x - candleW / 2, top, candleW, hgt);
      ctx.globalAlpha = 1;
    };
    hist.forEach((bar, i) => {
      const up = bar.c >= bar.o;
      drawCandle(i, bar, up ? UP : DOWN, 0.45);
    });
    median.forEach((bar, i) => {
      const up = bar.c >= bar.o;
      drawCandle(nHist + i, bar, up ? PRED : "#8b5cf6", 0.9);
    });
    if (close) {
      ctx.beginPath();
      ctx.strokeStyle = PRED;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      close.q50.forEach((price, i) => {
        const x = xOf(nHist + i);
        const y = yOf(price);
        if (i === 0) ctx.moveTo(xOf(nHist - 1), yOf(basePrice));
        ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (liveCandle && Number.isFinite(liveCandle.c)) {
      const x = xOf(nHist - 1) + step * 0.5;
      const up = liveCandle.c >= liveCandle.o;
      const color = up ? UP : DOWN;
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
        ctx.fillStyle = "rgba(120,200,255,0.95)";
        ctx.fillRect(padLeft + plotW + 2, y - 8, padRight - 4, 16);
        ctx.fillStyle = "#0b1220";
        ctx.fillText(fmtPrice(livePrice), padLeft + plotW + 6, y + 3);
      }
    }
    if (overlays && overlays.length > 0) {
      const timeToIndex = /* @__PURE__ */ new Map();
      labels.forEach((t, i) => timeToIndex.set(t, i));
      overlays.slice(0, 3).forEach((overlay, oi) => {
        const alpha = 0.85 - oi * 0.22;
        const pts = (overlay.points ?? []).map((point) => ({ ...point, x: timeToIndex.get(point.t) })).filter((point) => point.x !== void 0);
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
          ctx.arc(xOf(point.x), yOf(point.actual), 1.9, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(232,232,232,${0.55 + 0.3 * (1 - oi * 0.3)})`;
          ctx.fill();
        }
      });
    }
    const divideX = padLeft + nHist * step;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(127,127,127,0.55)";
    ctx.setLineDash([3, 3]);
    ctx.moveTo(divideX, padTop);
    ctx.lineTo(divideX, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = TEXT;
    ctx.fillText("\u9884\u6D4B", divideX + 4, padTop + 10);
    const volTop = padTop + plotH + 8;
    const vHist = hist.map((b) => b.v);
    const vPred = (data.bands?.volume?.q50 ?? []).slice(0, nPred);
    const vMax = Math.max(...vHist, ...vPred.map((v) => v * 1.1), 1);
    const vBarW = Math.max(1, candleW * 0.8);
    hist.forEach((bar, i) => {
      const x = xOf(i);
      const hgt = bar.v / vMax * volH;
      ctx.fillStyle = bar.c >= bar.o ? "rgba(224,74,74,0.35)" : "rgba(34,160,107,0.35)";
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt);
    });
    vPred.forEach((v, i) => {
      const x = xOf(nHist + i);
      const hgt = v / vMax * volH;
      ctx.fillStyle = "rgba(59,130,246,0.55)";
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt);
    });
    const labelCount = Math.max(2, Math.min(6, Math.floor(plotW / 78)));
    ctx.fillStyle = TEXT;
    for (let i = 0; i < labelCount; i += 1) {
      const index = Math.round(i * (total - 1) / (labelCount - 1));
      const text = fmtTime(labels[index]);
      const x = xOf(index);
      const w = ctx.measureText(text).width;
      ctx.fillText(text, Math.min(Math.max(x - w / 2, padLeft), padLeft + plotW - w), heightPx - 5);
    }
    if (hover !== null) {
      const index = Math.max(0, Math.min(total - 1, Math.round((hoverPos.x - padLeft) / step - 0.5)));
      const x = xOf(index);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(127,127,127,0.5)";
      ctx.setLineDash([2, 2]);
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, volTop + volH);
      ctx.stroke();
      ctx.setLineDash([]);
      const price = min + (max - min) * (1 - (hoverPos.y - padTop) / plotH);
      if (hoverPos.y >= padTop && hoverPos.y <= padTop + plotH) {
        ctx.fillStyle = "rgba(127,127,127,0.9)";
        ctx.fillRect(padLeft + plotW + 2, hoverPos.y - 8, padRight - 4, 16);
        ctx.fillStyle = "#fff";
        ctx.fillText(fmtPrice(price), padLeft + plotW + 6, hoverPos.y + 3);
      }
      canvas.dataset.index = String(index);
    }
  }, [data, height, hover, hoverPos, overlays, livePrice, liveCandle]);
  import_react.default.useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return void 0;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);
  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (hover === null) setHover(0);
  };
  const onLeave = () => setHover(null);
  let tip = null;
  if (hover !== null && data) {
    const index = Number(canvasRef.current?.dataset.index ?? 0);
    const nHist = Math.min(data.history?.length ?? 0, 60);
    if (index < nHist) {
      const bar = data.history.slice(-nHist)[index];
      if (bar) {
        tip = { label: bar.t, rows: [["\u5F00", bar.o], ["\u9AD8", bar.h], ["\u4F4E", bar.l], ["\u6536", bar.c]] };
      }
    } else {
      const i = index - nHist;
      const bar = data.pathMedian?.[i];
      if (bar) {
        const q = data.bands?.close;
        tip = {
          label: bar.t,
          rows: [
            ["\u4E2D\u4F4D", q?.q50?.[i]],
            ["q25", q?.q25?.[i]],
            ["q75", q?.q75?.[i]],
            ["q05", q?.q05?.[i]],
            ["q95", q?.q95?.[i]]
          ]
        };
      }
    }
  }
  return h(
    "div",
    { className: "kfc-chart", ref: wrapRef },
    h("canvas", {
      ref: canvasRef,
      onMouseMove: onMove,
      onMouseLeave: onLeave
    }),
    tip ? h(
      "div",
      { className: "kfc-tip" },
      h("div", { className: "kfc-tipLabel" }, tip.label),
      tip.rows.map(([label, value], i) => h(
        "div",
        { className: "kfc-tipRow", key: i },
        h("span", null, label),
        h("b", null, fmtPrice(value))
      ))
    ) : null
  );
}

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
  run: "\u5F00\u59CB\u9884\u6D4B",
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
  run: "Forecast",
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
  const [, setLocaleTick] = import_react2.default.useState(0);
  import_react2.default.useEffect(() => ctx.locale.subscribe(() => setLocaleTick((v) => v + 1)), [ctx]);
  const [status, setStatus] = import_react2.default.useState(null);
  const [setup, setSetup] = import_react2.default.useState({ running: false, logs: [], error: null });
  const [hydrated, setHydrated] = import_react2.default.useState(false);
  const [keyword, setKeyword] = import_react2.default.useState("");
  const [suggestions, setSuggestions] = import_react2.default.useState([]);
  const [searchOpen, setSearchOpen] = import_react2.default.useState(false);
  const [selected, setSelected] = import_react2.default.useState(null);
  const [scale, setScale] = import_react2.default.useState("1m");
  const [quality, setQuality] = import_react2.default.useState("fine");
  const [applyLimit, setApplyLimit] = import_react2.default.useState(true);
  const [autoRefresh, setAutoRefresh] = import_react2.default.useState(true);
  const [comparePast, setComparePast] = import_react2.default.useState(true);
  const [incremental, setIncremental] = import_react2.default.useState(false);
  const [overlays, setOverlays] = import_react2.default.useState(null);
  const [watchlist, setWatchlist] = import_react2.default.useState([]);
  const [notes, setNotes] = import_react2.default.useState({});
  const [phase, setPhase] = import_react2.default.useState("idle");
  const [refreshing, setRefreshing] = import_react2.default.useState(false);
  const [stage, setStage] = import_react2.default.useState("");
  const [progress, setProgress] = import_react2.default.useState({ step: 0, total: 0 });
  const [result, setResult] = import_react2.default.useState(null);
  const [resultAt, setResultAt] = import_react2.default.useState(0);
  const [error, setError] = import_react2.default.useState(null);
  const [notice, setNotice] = import_react2.default.useState("");
  const [elapsed, setElapsed] = import_react2.default.useState(0);
  const [now, setNow] = import_react2.default.useState(Date.now());
  const [marketOpen, setMarketOpen] = import_react2.default.useState(() => inTradingSession());
  const abortRef = import_react2.default.useRef(null);
  const runningRef = import_react2.default.useRef(false);
  const startedRef = import_react2.default.useRef(0);
  const saveTimerRef = import_react2.default.useRef(null);
  const running = phase === "running";
  runningRef.current = running;
  import_react2.default.useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setMarketOpen(inTradingSession());
    }, 5e3);
    return () => clearInterval(id);
  }, []);
  const refreshStatus = import_react2.default.useCallback(async () => {
    try {
      const data = await fetchStatus();
      setStatus(data);
      return data;
    } catch (err) {
      setStatus({ ready: false, error: err.message, scales: [] });
      return null;
    }
  }, []);
  const persist = import_react2.default.useCallback((patch) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      patchState(patch).catch(() => {
      });
    }, 400);
  }, []);
  import_react2.default.useEffect(() => {
    let cancelled = false;
    (async () => {
      const statusData = await refreshStatus();
      let state = null;
      try {
        state = (await fetchState()).state;
      } catch {
        state = null;
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
        const last = state.last;
        if (last?.result?.code) {
          setResult(last.result);
          setResultAt(last.at ?? Date.now());
          setPhase("done");
          setSelected({ code: last.result.code, name: last.result.name ?? last.result.code });
          setKeyword(`${last.result.name ?? ""} ${last.result.code}`.trim());
          if (SCALE_ORDER.includes(last.result.scale)) setScale(last.result.scale);
        }
      }
      setHydrated(true);
      if (!statusData) setPhase((prev) => prev === "running" ? prev : "idle");
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [refreshStatus]);
  import_react2.default.useEffect(() => {
    if (!running) return void 0;
    const id = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1e3), 200);
    return () => clearInterval(id);
  }, [running]);
  import_react2.default.useEffect(() => {
    const text = keyword.trim();
    if (text === "" || selected !== null) {
      setSuggestions([]);
      return void 0;
    }
    const id = setTimeout(async () => {
      try {
        const data = await searchStocks(text);
        setSuggestions(data.items ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 240);
    return () => clearTimeout(id);
  }, [keyword, selected]);
  const startSetup = import_react2.default.useCallback(async () => {
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
  const run = import_react2.default.useCallback(async ({ code, name: name2, scale: scaleOverride, silent = false } = {}) => {
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
  const runRef = import_react2.default.useRef(run);
  runRef.current = run;
  import_react2.default.useEffect(() => {
    if (!comparePast || !result?.code) return void 0;
    if (Array.isArray(overlays) && overlays.length > 0) return void 0;
    let cancelled = false;
    fetchHistory(result.code, result.scale, result.asOf).then((data) => {
      if (!cancelled) setOverlays(Array.isArray(data.overlays) ? data.overlays : []);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [comparePast, result?.code, result?.scale, result?.asOf, overlays]);
  const [tickAt, setTickAt] = import_react2.default.useState(0);
  const [tickState, setTickState] = import_react2.default.useState("idle");
  const [liveQuote, setLiveQuote] = import_react2.default.useState(null);
  const [liveCandle, setLiveCandle] = import_react2.default.useState(null);
  const lastRunAnchorRef = import_react2.default.useRef(null);
  import_react2.default.useEffect(() => {
    if (!hydrated) return void 0;
    const code = selected?.code ?? result?.code;
    if (!code) return void 0;
    const open = inTradingSession();
    const quoteInterval = !open ? 3e5 : scale === "1m" || scale === "5m" ? 15e3 : 2e4;
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
        const latest = data?.asOf;
        const stale = result?.code !== code || result?.scale !== scale;
        const newBar = latest && latest !== result?.asOf;
        if (autoRefresh && (newBar || stale) && !runningRef.current && lastRunAnchorRef.current !== latest) {
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
    document.addEventListener("visibilitychange", onVisible);
    beat();
    const id = setInterval(beat, quoteInterval);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [autoRefresh, hydrated, scale, selected?.code, result?.code, result?.scale, result?.asOf]);
  import_react2.default.useEffect(() => {
    if (!hydrated) return;
    persist({ prefs: { scale, quality, applyLimit, autoRefresh, comparePast, incremental } });
  }, [hydrated, scale, quality, applyLimit, autoRefresh, comparePast, incremental, persist]);
  const pick = (item, { runNow = true } = {}) => {
    const preferred = item.scale ?? notes[item.code] ?? scale;
    const valid = SCALE_ORDER.includes(preferred) ? preferred : scale;
    setSelected(item);
    setKeyword(`${item.name} ${item.code}`);
    setSuggestions([]);
    setSearchOpen(false);
    setScale(valid);
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
    setWatchlist((prev) => {
      const next = prev.filter((entry) => entry.code !== code);
      persist({ watchlist: next });
      return next;
    });
  };
  const scales = status?.scales?.length ? status.scales : SCALE_ORDER.map((key) => ({ key, label: key, Lc: 0, Lh: 0 }));
  const ready = status?.ready === true;
  const setupVisible = !ready && status !== null && !setup.running;
  const quote = (liveQuote && (!result || liveQuote.code === result.code) ? liveQuote : result?.quote) ?? null;
  const quoteUp = (quote?.changePercent ?? 0) >= 0;
  const activeCode = selected?.code ?? result?.code ?? null;
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
        )
      ] })
    ] }),
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
        "select",
        {
          className: "kfc-select kfc-selectScale",
          value: scale,
          title: t("scaleHint"),
          onChange: (event) => {
            const next = event.target.value;
            setScale(next);
            const code = selected?.code ?? result?.code;
            if (code) run({ code, scale: next });
          },
          children: scales.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: item.key, children: `${item.key} \xB7 ${item.label}\uFF08${item.Lc}/${item.Lh}\uFF09` }, item.key))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "select",
        {
          className: "kfc-select",
          value: quality,
          title: t("qualityHint"),
          onChange: (event) => setQuality(event.target.value),
          children: QUALITY.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: item.key, children: t(`quality.${item.key}`) }, item.key))
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
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "kfc-run",
          disabled: running,
          onClick: () => run({ silent: Boolean(result) }),
          children: running ? t("running") : result ? t("rerun") : t("run")
        }
      )
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
    (activeCode || result) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-quote", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-quoteName", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: activeName }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeCode })
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
      result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-quoteMeta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          t("lastBar"),
          " ",
          result.asOf
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          t("horizon"),
          " ",
          result.Lh,
          " \u6839"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-chip", children: result.source }),
        result.adjustmentApplied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-chip", children: t("adj") }) : null,
        result.nPad > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kfc-chip warn", children: [
          "\u586B\u5145 ",
          result.nPad
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-main", children: [
      notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-notice", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: notice }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => setNotice(""), children: t("dismiss") })
      ] }) : null,
      showProgressPane && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-progressPane", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-progressHead", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-spinner" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: stage || t("working") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kfc-elapsed", children: [
            elapsed.toFixed(1),
            "s"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-bar", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${progressPct}%` } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-progressHint", children: t("progressHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-setupActions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => abortRef.current?.abort(), children: t("cancel") }) })
      ] }),
      error && !running && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-errorPane", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: t("failed") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => setError(null), children: t("dismiss") })
      ] }),
      result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `kfc-resultPane ${refreshing ? "refreshing" : ""}`, children: [
        refreshing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-refreshBar", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${progressPct}%` } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ForecastChart,
          {
            data: result,
            height: 340,
            overlays: comparePast ? overlays : null,
            livePrice: Number.isFinite(quote?.price) ? quote.price : null,
            liveCandle
          }
        ),
        comparePast && overlays && overlays.some((item) => item.verify) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-compare", children: [
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-stats", children: [
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
        ] })
      ] }),
      !result && !running && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelIcon, { size: 32 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyTitle", children: t("emptyTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyBody", children: t("emptyBody") }),
        chips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyHint", children: t("emptyHint") }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-footNote", children: ready || !status ? t("footNote") : t("footModelMissing") })
    ] })
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
  align-items: baseline;
  gap: 14px;
  padding: 4px 20px 10px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
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
  top: 10px; right: 78px;
  min-width: 116px;
  padding: 7px 9px;
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
