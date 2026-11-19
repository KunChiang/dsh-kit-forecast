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
function ForecastChart({ data, height = 320 }) {
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
    const labels = [...hist.map((b) => b.t), ...median.map((b) => b.t)];
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
  }, [data, height, hover, hoverPos]);
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
  "quality.fast": "\u5FEB\u901F",
  "quality.standard": "\u6807\u51C6",
  "quality.fine": "\u7CBE\u7EC6",
  auto: "\u5B9E\u65F6\u8DDF\u968F",
  autoHint: "\u5728\u4EA4\u6613\u65F6\u6BB5\u5185\u6309\u56FA\u5B9A\u95F4\u9694\u81EA\u52A8\u91CD\u65B0\u9884\u6D4B",
  limit: "\u6DA8\u8DCC\u505C\u7EA6\u675F",
  limitHint: "\u628A\u9884\u6D4B\u8DEF\u5F84\u6295\u5F71\u5230\u5F53\u65E5\u6DA8\u8DCC\u505C\u533A\u95F4\u5185",
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
  "quality.fast": "Fast",
  "quality.standard": "Standard",
  "quality.fine": "Fine",
  auto: "Auto",
  autoHint: "Re-run on a fixed interval during trading hours",
  limit: "Price-limit clamp",
  limitHint: "Project sampled paths into the daily price-limit band",
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
  footNote: "Data: Sina / Tencent live quotes and adjusted bars. Model: KiT-284M (AGPL-3.0, Luciferbobo/KiT). Research use only, not investment advice.",
  footModelMissing: "Model weights are not downloaded yet; finish setup to forecast."
};

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
function StatCard({ label, value, hint, tone }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-statCard", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-statLabel", children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `kfc-statValue ${tone ?? ""}`, children: value }),
    hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-statHint", children: hint }) : null
  ] });
}
function KitForecastPanel({ ctx }) {
  const t = ctx.locale.bind(NS);
  const [, setLocaleTick] = import_react2.default.useState(0);
  import_react2.default.useEffect(() => ctx.locale.subscribe(() => setLocaleTick((v) => v + 1)), [ctx]);
  const [status, setStatus] = import_react2.default.useState(null);
  const [setup, setSetup] = import_react2.default.useState({ running: false, logs: [], error: null });
  const [keyword, setKeyword] = import_react2.default.useState("");
  const [suggestions, setSuggestions] = import_react2.default.useState([]);
  const [selected, setSelected] = import_react2.default.useState(null);
  const [scale, setScale] = import_react2.default.useState("1d");
  const [quality, setQuality] = import_react2.default.useState("standard");
  const [applyLimit, setApplyLimit] = import_react2.default.useState(true);
  const [autoRefresh, setAutoRefresh] = import_react2.default.useState(false);
  const [phase, setPhase] = import_react2.default.useState("idle");
  const [stage, setStage] = import_react2.default.useState("");
  const [progress, setProgress] = import_react2.default.useState({ step: 0, total: 0 });
  const [result, setResult] = import_react2.default.useState(null);
  const [error, setError] = import_react2.default.useState(null);
  const [elapsed, setElapsed] = import_react2.default.useState(0);
  const abortRef = import_react2.default.useRef(null);
  const runningRef = import_react2.default.useRef(false);
  const startedRef = import_react2.default.useRef(0);
  const running = phase === "running";
  runningRef.current = running;
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
  import_react2.default.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);
  import_react2.default.useEffect(() => {
    if (phase !== "running") return void 0;
    const id = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1e3), 200);
    return () => clearInterval(id);
  }, [phase]);
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
    }, 260);
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
  const run = import_react2.default.useCallback(async (codeOverride) => {
    const code = codeOverride ?? selected?.code;
    if (!code) {
      setError("\u8BF7\u5148\u8F93\u5165\u80A1\u7968\u4EE3\u7801\u6216\u540D\u79F0\uFF0C\u5E76\u4ECE\u8054\u60F3\u5217\u8868\u91CC\u9009\u4E00\u53EA\u80A1\u7968");
      setPhase("error");
      return;
    }
    if (status && status.ready === false) {
      setError("\u8FD0\u884C\u73AF\u5883\u8FD8\u6CA1\u51C6\u5907\u597D\uFF0C\u8BF7\u5148\u5B8C\u6210\u521D\u59CB\u5316");
      setPhase("error");
      return;
    }
    const budget = (status?.scales ?? []).find((item) => item.key === scale);
    const factor = QUALITY.find((item) => item.key === quality) ?? QUALITY[1];
    const nPaths = Math.max(1, Math.round((budget?.defaultPaths ?? 12) * factor.paths));
    const steps = Math.max(1, Math.round((budget?.defaultSteps ?? 20) * factor.steps));
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("running");
    setError(null);
    setResult(null);
    setStage("\u51C6\u5907\u4E2D\u2026");
    setProgress({ step: 0, total: 0 });
    startedRef.current = Date.now();
    setElapsed(0);
    let failed = false;
    try {
      await runForecast({ code, scale, nPaths, steps, applyLimit }, {
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
            setResult(event.data);
            setStage("");
          } else if (event.t === "fail") {
            failed = true;
            setError(event.message);
            setPhase("error");
          }
        }
      });
      if (!failed) setPhase("done");
    } catch (err) {
      if (err.name === "AbortError") {
        setPhase("idle");
        setStage("");
      } else {
        setError(err.message);
        setPhase("error");
      }
    } finally {
      abortRef.current = null;
    }
  }, [selected, scale, quality, status, applyLimit]);
  import_react2.default.useEffect(() => {
    if (!autoRefresh) return void 0;
    const interval = scale === "1d" ? 12e4 : 6e4;
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !runningRef.current) run();
    }, interval);
    return () => clearInterval(id);
  }, [autoRefresh, scale, run]);
  const pick = (item) => {
    setSelected(item);
    setKeyword(`${item.name} ${item.code}`);
    setSuggestions([]);
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
      run(parsed.code);
    }
  };
  const scales = status?.scales?.length ? status.scales : SCALE_ORDER.map((key) => ({ key, label: key, Lc: 0, Lh: 0 }));
  const ready = status?.ready === true;
  const setupVisible = !ready && status !== null && !setup.running;
  const quote = result?.quote ?? null;
  const quoteUp = (quote?.changePercent ?? 0) >= 0;
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
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-headActions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: `kfc-ghost ${ready ? "ok" : "warn"}`,
          onClick: refreshStatus,
          title: t("recheck"),
          children: ready ? t("envReady") : t("envMissing")
        }
      ) })
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
            onChange: (event) => {
              setKeyword(event.target.value);
              setSelected(null);
            },
            onKeyDown: onKeywordKey
          }
        ),
        suggestions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-suggest", children: suggestions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            className: "kfc-suggestItem",
            onClick: () => pick(item),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-suggestName", children: item.name }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-suggestCode", children: item.code })
            ]
          },
          item.code
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-scales", children: scales.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: `kfc-scale ${scale === item.key ? "active" : ""}`,
          title: `${item.label} \xB7 \u5386\u53F2 ${item.Lc} \u6839 / \u9884\u6D4B ${item.Lh} \u6839`,
          onClick: () => setScale(item.key),
          children: item.key
        },
        item.key
      )) }),
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
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-run", disabled: running, onClick: () => run(), children: running ? t("running") : result ? t("rerun") : t("run") })
    ] }),
    (quote || selected) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-quote", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-quoteName", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: result?.name ?? selected?.name ?? "" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: result?.code ?? selected?.code ?? "" })
      ] }),
      quote && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `kfc-quotePrice ${quoteUp ? "up" : "down"}`, children: [
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
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: quoteTime(quote.time) })
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
        ] }) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "kfc-main", children: [
      running && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-progressPane", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-progressHead", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kfc-spinner" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: stage || t("working") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kfc-elapsed", children: [
            elapsed.toFixed(1),
            "s"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-bar", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${progress.total > 0 ? Math.round(progress.step / progress.total * 100) : 6}%` } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-progressHint", children: t("progressHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-setupActions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => abortRef.current?.abort(), children: t("cancel") }) })
      ] }),
      error && !running && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-errorPane", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: t("failed") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "kfc-ghost", onClick: () => setError(null), children: t("dismiss") })
      ] }),
      result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ForecastChart, { data: result, height: 340 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-stats", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            StatCard,
            {
              label: t("stat.median"),
              value: pct(result.stats.retMedian),
              tone: result.stats.retMedian >= 0 ? "up" : "down",
              hint: `${t("stat.target")} ${priceStr(result.stats.targetMedian)}`
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            StatCard,
            {
              label: t("stat.upProb"),
              value: `${(result.stats.upProb * 100).toFixed(0)}%`,
              tone: result.stats.upProb >= 0.5 ? "up" : "down",
              hint: `${t("stat.q05q95")} ${pct(result.stats.retQ05)} ~ ${pct(result.stats.retQ95)}`
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            StatCard,
            {
              label: t("stat.range"),
              value: `${priceStr(result.stats.targetQ05)} ~ ${priceStr(result.stats.targetQ95)}`,
              hint: t("stat.rangeHint")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            StatCard,
            {
              label: t("stat.vol"),
              value: pct(result.stats.volMedian),
              hint: `${t("stat.drawdown")} ${pct(result.stats.maxDdMedian)}`
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            StatCard,
            {
              label: t("stat.paths"),
              value: `${result.nPaths} \xD7 ${result.steps}`,
              hint: `${result.device} \xB7 ${result.sampleSeconds}s`
            }
          )
        ] })
      ] }),
      !result && !running && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kfc-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelIcon, { size: 32 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyTitle", children: t("emptyTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kfc-emptyBody", children: t("emptyBody") })
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
var appCtx = null;
function openPanel() {
  try {
    appCtx?.get("layout")?.selectPanel(PANEL_ID);
  } catch (error) {
    console.warn("[kit-forecast] \u65E0\u6CD5\u6253\u5F00\u9762\u677F", error);
  }
}
function ComposerButton({ t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      className: "kfc-composerBtn",
      title: t("subtitle"),
      onClick: openPanel,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 8,
        border: "1px solid var(--dsw-alias-border-l1)",
        background: "var(--dsw-alias-bg-layer-1)",
        color: "var(--dsw-alias-label-secondary)",
        font: "inherit",
        fontSize: 12,
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PanelIcon, { size: 13 }),
        t("nav")
      ]
    }
  );
}
var name = "kit-forecast";
var inject = ["slots", "locale"];
function apply(ctx) {
  appCtx = ctx;
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
  ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
    name: "conversation.input.left",
    id: PANEL_ID,
    order: 46,
    label: () => ctx.locale.bind(NS)("nav"),
    locale: NS
  }, ComposerButton));
}

    return module.exports;
  },
});
