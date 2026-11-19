/**
 * 端到端确定性：同一只股票 + 同一周期 + 同一根收盘 bar，两次预测的结果应当逐位相同。
 * 需要本机已就绪的运行时（venv + 权重），没有就跳过，避免在 CI 上误报。
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { test } from 'node:test'

const root = join(homedir(), 'Library', 'Application Support', 'dsh-desktop', 'harness', 'kit-forecast')
const hasRuntime = existsSync(join(root, 'ckpt', 'step_market_284M.pt'))
  && existsSync(join(root, 'venv', 'bin', 'python'))

test('同一根 bar 的两次预测结果一致', { skip: !hasRuntime, timeout: 600000 }, async () => {
  process.env.DSH_KIT_FORECAST_HOME = root
  const pkg = await import('../lib/index.js')
  const routes = new Map()
  const disposers = []
  const logger = { info() {}, warn() {}, error() {} }
  const ctx = {
    logger,
    // 记下 cleanup（插件会用它关闭常驻的推理子进程），否则测试进程会被子进程句柄挂住
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    on() {},
    inject: (deps, run) => run({
      ...ctx,
      logger,
      get: (name) => (name === 'connection'
        ? { fetch: { register: (spec) => { routes.set(spec.path, spec.fetch); return () => {} } } }
        : undefined),
    }),
  }
  pkg.apply(ctx, {})

  const run = async () => {
    const response = await routes.get('/api/kit-forecast/forecast')(new Request('http://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '600519.SH', scale: '1d', nPaths: 3, steps: 4 }),
    }))
    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean).map((block) => {
      const line = block.split('\n').find((l) => l.startsWith('data:'))
      return line ? JSON.parse(line.slice(5).trim()) : null
    }).filter(Boolean)
    const fail = events.find((e) => e.t === 'fail')
    assert.equal(fail, undefined, fail?.message)
    return events.find((e) => e.t === 'result').data
  }

  try {
    const first = await run()
    const second = await run()
    assert.equal(first.seed, second.seed)
    assert.equal(first.stats.retMedian, second.stats.retMedian)
    assert.equal(first.stats.targetMedian, second.stats.targetMedian)
    assert.deepEqual(first.bands.close.q50, second.bands.close.q50)
  } finally {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        // 忽略清理失败
      }
    }
  }
})
