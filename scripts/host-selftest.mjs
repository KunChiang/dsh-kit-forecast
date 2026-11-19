/**
 * Host 半自检：用最小 ctx 桩挂载插件，逐个调用 /api/kit-forecast/* 路由。
 * 只用于开发验证，不参与打包。
 *
 *   node scripts/host-selftest.mjs [--data-dir <dir>] [--forecast 600519.SH:1d]
 */
import { pathToFileURL } from 'node:url'
import { homedir, tmpdir } from 'node:os'
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

const routes = new Map()
const logger = {
  info: (msg) => console.log('INFO ', msg),
  warn: (msg) => console.log('WARN ', msg),
  error: (msg) => console.log('ERROR', msg),
}

let disposed = false
function makeCtx() {
  const ctx = {
    logger,
    effect: (fn) => {
      const dispose = fn()
      return () => dispose?.()
    },
    inject: (deps, run) => run(ctx),
    get: () => undefined,
    on: () => {},
    emit: () => {},
    set: () => {},
  }
  return ctx
}

const mod = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)

const ctx = makeCtx()
// 用一个最小的 connection.fetch 注册表
ctx.inject = (deps, run) => {
  const scoped = { ...ctx, get: (name) => (name === 'connection' ? {
    fetch: {
      register: (spec) => {
        routes.set(`${spec.methods[0]} ${spec.path}`, spec.fetch)
        return () => routes.delete(`${spec.methods[0]} ${spec.path}`)
      },
    },
  } : undefined), logger }
  run(scoped)
}
mod.// 状态文件一律放临时目录：预览/自检绝不能写用户真实的 watchlist 与历史预测
apply(ctx, {
  dataDir: arg('data-dir', defaultDataDir()),
  statePath: arg('state-path', join(tmpdir(), 'kit-forecast-dev-state.json')),
})
console.log('routes:', [...routes.keys()].join(', '))

async function call(path, body = {}, { stream = false } = {}) {
  const handler = routes.get(`POST /api/kit-forecast${path}`)
  if (!handler) throw new Error(`route not found: ${path}`)
  const request = new Request(`http://127.0.0.1/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const response = await handler(request)
  if (!stream) {
    const data = await response.json()
    return { status: response.status, data }
  }
  const text = await response.text()
  return { status: response.status, events: text.split('\n\n').filter(Boolean).map((block) => {
    const line = block.split('\n').find((l) => l.startsWith('data:'))
    return line ? JSON.parse(line.slice(5).trim()) : null
  }).filter(Boolean) }
}

const status = await call('/status')
console.log('status:', JSON.stringify({ ready: status.data.ready, python: status.data.python, env: status.data.env, modelReady: status.data.modelReady }))

const search = await call('/search', { keyword: '茅台' })
console.log('search:', JSON.stringify(search.data.items))

const code = arg('forecast', '600519.SH:1d')
const [stock, scale] = code.split(':')
const quote = await call('/quote', { code: stock })
console.log('quote:', quote.data.quote.name, quote.data.quote.price)
const bars = await call('/bars', { code: stock, scale: scale ?? '1d', limit: 30 })
console.log('bars:', bars.data.total, bars.data.source, 'tail:', bars.data.bars.at(-1).t)

if (arg('skip-forecast') === undefined) {
  console.log('forecast...')
  let result = null
  const out = await call('/forecast', { code: stock, scale: scale ?? '1d', nPaths: 4, steps: 6 }, { stream: true })
  for (const event of out.events) {
    if (event.t === 'stage') console.log('  stage:', event.message)
    else if (event.t === 'progress') process.stdout.write(`  progress ${event.step}/${event.total}\r`)
    else if (event.t === 'result') result = event.data
    else if (event.t === 'fail') console.log('  FAIL:', event.message)
  }
  if (result) {
    console.log('\nresult:', JSON.stringify({
      name: result.name, scale: result.scale, asOf: result.asOf, Lh: result.Lh,
      median: result.stats.retMedian, upProb: result.stats.upProb,
      device: result.device, sampleSeconds: result.sampleSeconds, elapsedMs: result.elapsedMs,
      historyBars: result.history.length, paths: result.pathMedian.length,
    }))
  }
}
process.exit(0)
