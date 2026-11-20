/**
 * 开发期 UI 预览：把真实的 Panel 组件 + 真实的 Host 路由挂到一个独立页面上，
 * 用无头 Chrome 截图，检查布局、配色、交互（不依赖 DSH 的登录 cookie）。
 *
 *   node scripts/ui-preview.mjs [--shot preview/panel.png] [--theme dark|light]
 *
 * 需要本机装有 Google Chrome（channel=chrome）以及 playwright 的 Python 包；
 * 这只服务于开发验证，不参与插件打包。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
/** 默认运行时目录：与插件一致（$DSH_HOME/kit-forecast），可用 --data-dir 覆盖。 */
const defaultDataDir = () => {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'kit-forecast')
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? fallback : process.argv[i + 1]
}

const shot = resolve(root, arg('shot', join('preview', 'panel.png')))
const theme = arg('theme', 'dark')
const port = Number(arg('port', '7799'))
mkdirSync(dirname(shot), { recursive: true })

// 1. 用 esbuild 把 Panel + api 打成一个浏览器 bundle，fetch 指向本地 http 服务的真实路由
const appEntry = join(root, '.preview', 'app.jsx')
mkdirSync(dirname(appEntry), { recursive: true })
writeFileSync(appEntry, `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { KitForecastPanel } from '../src/client/Panel.jsx'
import { STYLES } from '../src/client/styles.js'
import { zh } from '../src/client/i18n.js'

const ctx = {
  locale: {
    bind: () => (key) => zh[key] ?? key,
    register: () => () => {},
    subscribe: () => () => {},
  },
}
const style = document.createElement('style')
style.textContent = STYLES
document.head.appendChild(style)
createRoot(document.getElementById('root')).render(React.createElement(KitForecastPanel, { ctx }))
`)

function findEsbuild() {
  const direct = [
    process.env.ESBUILD_BIN,
    join(root, 'node_modules', '.bin', 'esbuild'),
  ].find((candidate) => candidate && existsSync(candidate))
  if (direct) return direct
  const npxRoot = join(homedir(), '.npm', '_npx')
  if (existsSync(npxRoot)) {
    for (const entry of readdirSync(npxRoot)) {
      const binary = join(npxRoot, entry, 'node_modules', 'esbuild', 'bin', 'esbuild')
      if (existsSync(binary)) return binary
    }
  }
  return 'esbuild'
}
const esbuild = findEsbuild()
execFileSync(esbuild, [
  appEntry,
  '--bundle',
  '--format=iife',
  '--target=es2020',
  '--jsx=automatic',
  `--outfile=${join(root, '.preview', 'app.js')}`,
  '--log-level=warning',
], { stdio: 'inherit', cwd: root })

// 2. 起一个本地服务器：静态页 + /api/kit-forecast/* 转发到 Host 半
const { apply } = await import(resolve(root, 'lib/index.js'))
const routes = new Map()
const logger = { info: () => {}, warn: () => {}, error: () => {} }
const ctx = {
  logger,
  effect: (fn) => fn(),
  on: () => {},
  inject: (deps, run) => run({
    ...ctx,
    get: (n) => {
      if (n === 'connection') {
        return { fetch: { register: (spec) => { routes.set(`${spec.path}`, spec.fetch); return () => {} } } }
      }
      if (n === 'agentDefaultModel') return { currentSelection: () => null }
      return undefined
    },
    // 预览用的假模型：验证「AI 解读」的流式链路（真实部署里由 DSH 注入 ctx.llm）
    llm: {
      listProviders: () => [{ id: 'preview', name: 'Preview' }, { id: 'preview2', name: 'Preview 2' }],
      listModels: async (id) => (id === 'preview'
        ? [{ id: 'preview-model', name: 'preview-model' }, { id: 'text-embedding-3', name: 'embedding' }]
        : [{ id: 'preview-big', name: 'preview-big' }]),
      stream: (opts) => (async function* () {
        // 修正请求要回 JSON，解读请求回文字
        const isRefine = /只输出一个 JSON 对象/.test(String(opts?.messages?.[0]?.content?.[0]?.text ?? ''))
        const text = isRefine
          ? '{"ret": -0.0065, "confidence": 0.62, "reasons": ["大盘普跌压制弹性", "消息面偏中性", "近期预测偏高估"]}'
          : [
            '## 结论',
            '今日**普跌**，上证 -1.23%，创业板 -3.54%，市场宽度极差（301 涨 / 4961 跌）。',
            '',
            '### 关键数据',
            '| 指标 | 数值 | 判断 |',
            '| --- | --- | --- |',
            '| 预测中位 | -2.19% | 偏空 |',
            '| 上涨概率 | 0% | 极弱 |',
            '| q05~q95 | -4.47% ~ -1.15% | 全负 |',
            '',
            '**模型预测**：`4 × 7` 条采样路径，全部落在负收益区间。',
            '**历史复盘**：',
            '1. 11-19 预测 +1.20%，实际 -0.40%（方向错误）',
            '2. 11-18 预测 -0.80%，实际 -1.10%（方向正确）',
            '',
            '> 注意：以上是概率分布，不是确定结论。',
            '',
            '风险点：量能萎缩下的继续调整，见 [公告原文](https://data.eastmoney.com/notices/detail/AN123.html)。',
          ].join('\n')
        for (const ch of text) {
          await new Promise((r) => setTimeout(r, 4))
          yield { type: 'text-delta', text: ch }
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })(),
    },
    logger,
  }),
}
// 状态文件一律放临时目录：预览/自检绝不能写用户真实的 watchlist 与历史预测
apply(ctx, {
  dataDir: arg('data-dir', defaultDataDir()),
  statePath: arg('state-path', join(tmpdir(), 'kit-forecast-dev-state.json')),
})

const html = `<!doctype html><html lang="zh-CN" data-theme="${theme}"><head><meta charset="utf-8">
<title>KiT 面板预览</title>
<style>
:root[data-theme="dark"] {
  --dsw-alias-bg-base:#111318; --dsw-alias-bg-layer-1:#191c22; --dsw-alias-bg-layer-2:#23272f;
  --dsw-alias-label-primary:#e8eaed; --dsw-alias-label-secondary:#9aa0a6;
  --dsw-alias-border-l1:#2c313a; --dsw-alias-border-l2:#3a404b;
  --dsw-alias-brand-primary:#4c8dff;
  --dsw-alias-state-success-primary:#2fbf71; --dsw-alias-state-warn-primary:#e8a33d;
  --dsw-alias-state-error-primary:#f0564a; --dsw-alias-state-idle-primary:#8b93a1;
}
:root[data-theme="light"] {
  --dsw-alias-bg-base:#ffffff; --dsw-alias-bg-layer-1:#f6f7f9; --dsw-alias-bg-layer-2:#eceef2;
  --dsw-alias-label-primary:#1c1f24; --dsw-alias-label-secondary:#5c6370;
  --dsw-alias-border-l1:#e2e5ea; --dsw-alias-border-l2:#d3d8e0;
  --dsw-alias-brand-primary:#2f6fed;
  --dsw-alias-state-success-primary:#1d9e57; --dsw-alias-state-warn-primary:#c47b12;
  --dsw-alias-state-error-primary:#d93b2b; --dsw-alias-state-idle-primary:#6b7280;
}
html,body{margin:0;height:100%;background:var(--dsw-alias-bg-base)}
#root{height:100%}
</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && routes.has(req.url)) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString('utf8')
    const request = new Request(`http://127.0.0.1${req.url}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: body || '{}',
    })
    try {
      const response = await routes.get(req.url)(request)
      res.writeHead(response.status, Object.fromEntries(response.headers))
      // 必须边读边转：SSE 一旦被 await text() 缓冲，浏览器就看不到中间进度
      const reader = response.body?.getReader()
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
        res.end()
      } else {
        res.end(await response.text())
      }
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: { message: String(error) } }))
    }
    return
  }
  if (req.url === '/app.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end(await import('node:fs').then((fs) => fs.readFileSync(join(root, '.preview', 'app.js'))))
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html)
})
await new Promise((r) => server.listen(port, '127.0.0.1', r))
console.log(`preview server on http://127.0.0.1:${port}`)

// --serve：只起服务，不截图（方便手工/脚本从外部驱动交互测试）
if (process.argv.includes('--serve')) {
  console.log('serving; press Ctrl+C to stop')
  await new Promise(() => {})
}

const script = join(root, '.preview', 'shot.py')
writeFileSync(script, `
from playwright.sync_api import sync_playwright
import sys
url = "http://127.0.0.1:${port}"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chrome")
    page = b.new_context(viewport={"width": 1180, "height": 1400}, device_scale_factor=2).new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text[:300]}"))
    page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(1500)
    page.screenshot(path="${shot}", full_page=True)
    page.fill(".kfc-search", "600519")
    page.wait_for_timeout(1200)
    page.screenshot(path="${shot.replace('.png', '-suggest.png')}", full_page=True)
    if page.locator(".kfc-suggestItem").count() > 0:
        page.locator(".kfc-suggestItem").first.click()
        page.wait_for_timeout(400)
    page.click(".kfc-run")
    page.wait_for_timeout(2500)
    page.screenshot(path="${shot.replace('.png', '-running.png')}", full_page=True)
    for _ in range(120):
        if page.locator(".kfc-statCard").count() > 0:
            break
        page.wait_for_timeout(1000)
    page.wait_for_timeout(600)
    page.screenshot(path="${shot.replace('.png', '-result.png')}", full_page=True)
    if page.locator(".kfc-chart").count() > 0:
        page.locator(".kfc-chart").screenshot(path="${shot.replace('.png', '-chart.png')}")
    print("stat cards:", page.locator(".kfc-statCard").count())
    print("errors:", [l for l in logs if l.startswith(("error", "pageerror"))][:6])
    b.close()
`)
// 注意：必须用异步 spawn —— execFileSync 会阻塞事件循环，本地 HTTP 服务将无法响应截图请求
const { spawn } = await import('node:child_process')
try {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn('python3', [script], { stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolveRun() : rejectRun(new Error(`截图失败（code=${code}）`))))
    child.on('error', rejectRun)
  })
} finally {
  server.close()
}