/**
 * 用真实预测结果渲染面板预览（离线 HTML），用于开发期检查视觉效果。
 *
 *   node scripts/preview.mjs [--code 600519.SH] [--scale 1d] [--out preview/panel.html]
 *
 * 会调用 Host 半的 /forecast 拿一份真实结果，把面板的“已出结果”状态
 * 用 React 服务端渲染到静态 HTML，图表部分用同一套 canvas 逻辑的截图替代。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? fallback : process.argv[i + 1]
}

const code = arg('code', '600519.SH')
const scale = arg('scale', '1d')
const out = resolve(root, arg('out', join('preview', 'panel.html')))
const ckptDir = resolve(root, arg('data-dir', join(root, 'prepared')))

// 1. 取一份真实结果
const py = join(ckptDir, 'venv', 'bin', 'python')
const engineScript = join(root, 'runtime', 'bench.py')
const jsonOut = join(root, '.preview-result.json')
mkdirSync(join(root, 'preview'), { recursive: true })

execFileSync(py, [engineScript, '--code', code, '--scale', scale,
  '--paths', '12', '--steps', '16', '--ckpt-dir', join(ckptDir, 'ckpt'),
  '--json-out', jsonOut], {
  stdio: 'inherit',
  cwd: root,
})

const data = JSON.parse(readFileSync(jsonOut, 'utf8'))
const html = renderHtml(data)
writeFileSync(out, html, 'utf8')
console.log(`preview written: ${out}`)

function renderHtml(d) {
  const rows = [
    ['预测中位涨幅', `${(d.stats.retMedian * 100).toFixed(2)}%`],
    ['上涨概率', `${(d.stats.upProb * 100).toFixed(0)}%`],
    ['价格区间', `${d.stats.targetQ05.toFixed(2)} ~ ${d.stats.targetQ95.toFixed(2)}`],
    ['预期波动', `${(d.stats.volMedian * 100).toFixed(2)}%`],
  ]
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>KiT 面板预览</title>
<style>body{font-family:-apple-system,"PingFang SC",sans-serif;background:#111;color:#eee;padding:24px}
table{border-collapse:collapse}td{padding:6px 14px;border-bottom:1px solid #333}</style>
</head><body>
<h1>${d.code} ${d.scale} @ ${d.asOf}</h1>
<p>device=${d.device} sample=${d.sampleSeconds}s paths=${d.nPaths}×${d.steps}</p>
<canvas id="c" width="1100" height="420" style="background:#1a1a1a;border-radius:10px"></canvas>
<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
<script>window.__DATA__ = ${JSON.stringify(d)};</script>
<script>
const d = window.__DATA__;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const hist = d.history.slice(-60), nH = hist.length;
const med = d.pathMedian, nP = med.length;
const W = cv.width, H = cv.height, padL = 10, padR = 76, padT = 16, volH = 70;
const plotH = H - padT - volH - 26, plotW = W - padL - padR;
const total = nH + nP, step = plotW / total, cw = Math.max(1.6, Math.min(9, step * .6));
const lows = [...hist.map(b=>b.l), ...d.bands.low.q05];
const highs = [...hist.map(b=>b.h), ...d.bands.high.q95];
let min = Math.min(...lows), max = Math.max(...highs);
const span0 = max - min; min -= span0*.06; max += span0*.06;
const y = p => padT + (max - p)/(max-min)*plotH;
const x = i => padL + (i+.5)*step;
ctx.font = '11px -apple-system,sans-serif'; ctx.strokeStyle='rgba(127,127,127,.18)'; ctx.fillStyle='rgba(200,200,200,.9)';
for (let i=0;i<=4;i++){const p=min+(max-min)*i/4, yy=y(p); ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(padL+plotW,yy);ctx.stroke();ctx.fillText(p.toFixed(2), padL+plotW+6, yy+4);}
const base = hist[nH-1].c;
const bx = [x(nH-1), ...med.map((_,i)=>x(nH+i))];
const band = (arr, color) => { ctx.beginPath(); bx.forEach((xx,i)=>{const yy=i===0?y(base):y(arr[i-1]); i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}); for(let i=arr.length-1;i>=0;i--) ctx.lineTo(bx[i+1], y(arr[i])); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); };
band(d.bands.close.q95, 'rgba(59,130,246,.14)'); band(d.bands.close.q25, 'rgba(59,130,246,.22)');
const candle=(i,b,col,a)=>{const xx=x(i); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(xx,y(b.h)); ctx.lineTo(xx,y(b.l)); ctx.stroke(); const t=y(Math.max(b.o,b.c)), bm=y(Math.min(b.o,b.c)); ctx.fillRect(xx-cw/2, t, cw, Math.max(1,bm-t)); ctx.globalAlpha=1;};
hist.forEach((b,i)=>candle(i,b,b.c>=b.o?'#e04a4a':'#22a06b',.5));
med.forEach((b,i)=>candle(nH+i,b,b.c>=b.o?'#3b82f6':'#8b5cf6',.95));
ctx.beginPath(); ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
d.bands.close.q50.forEach((p,i)=>{const xx=x(nH+i), yy=y(p); i?ctx.lineTo(xx,yy):ctx.moveTo(x(nH-1), y(base));}); ctx.stroke(); ctx.setLineDash([]);
</script></body></html>`
}