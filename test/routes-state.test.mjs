/**
 * /state 与 /tick 路由的契约测试：
 *   - /state 空 body 读取、带 body 合并写入
 *   - /tick 只回元信息（不跑模型），非法参数被拒绝
 *   - /forecast 成功后会写 last 与 watchlist
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createServer, normalizeConfig, resolvePaths } from '../lib/index.js'

const quiet = { info() {}, warn() {}, error() {} }

function fakeBars(count = 300) {
  const bars = []
  const end = Date.parse('2026-11-19T07:00:00Z') // 15:00 北京
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = new Date(end - i * 86400000)
    const iso = t.toISOString().slice(0, 10)
    bars.push({ t: `${iso} 15:00:00`, o: 10, h: 10.2, l: 9.9, c: 10.1, v: 1000 })
  }
  return bars
}

function harness(dataDir) {
  const market = {
    quote: async () => ({ name: '测试股', price: 10.1, prevClose: 10, changePercent: 1, limitUp: 11, limitDown: 9 }),
    bars: async (code, scale) => ({ code, scale, bars: fakeBars(), source: 'fake', adjustmentApplied: true, droppedForming: false }),
    tradingDays: async () => ['2026-11-18', '2026-11-19'],
  }
  const engine = {
    alive: true,
    stop() {},
    async start() { return { ok: true } },
    async request(op, payload) {
      return {
        code: payload.code, scale: payload.scale, asOf: payload.bars.at(-1).t, lastClose: 10.1,
        Lc: 100, Lh: 20, nPad: 0, nPaths: payload.nPaths, steps: payload.steps,
        device: 'cpu', precision: 'fp32', sampleSeconds: 0.1, limitRate: payload.limitRate,
        history: payload.bars.slice(-5), futureTimestamps: [],
        bands: { close: { q50: [1, 2] } }, pathMedian: [{ t: 'x' }], pathBull: [], pathBear: [],
        stats: { retMedian: 0.01, targetMedian: 10.2 },
      }
    },
  }
  const server = createServer({ logger: quiet }, normalizeConfig({}), resolvePaths({ dataDir }), { market, engine })
  return server
}

async function post(handler, body) {
  const response = await handler(new Request('http://x/api/kit-forecast/x', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
  }))
  return { status: response.status, data: await response.json() }
}

test('/state 读取空状态、合并写入、再读回', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-routes-'))
  try {
    const server = harness(dir)
    const empty = await post(server.handleState, {})
    assert.equal(empty.status, 200)
    assert.deepEqual(empty.data.state.watchlist, [])

    await post(server.handleState, { prefs: { scale: '15m' }, watchlist: [{ code: '600519.SH', name: '贵州茅台', pinned: true, at: 1 }] })
    const again = await post(server.handleState, {})
    assert.equal(again.data.state.prefs.scale, '15m')
    assert.equal(again.data.state.watchlist[0].pinned, true)
    assert.equal(again.data.state.watchlist[0].name, '贵州茅台')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('/tick 只回最后一根收盘 bar 与盘口，不触发推理', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-routes-'))
  try {
    const server = harness(dir)
    let called = 0
    server.engine.request = async () => { called += 1; return {} }
    const tick = await post(server.handleTick, { code: '600519', scale: '1d' })
    assert.equal(tick.status, 200)
    assert.equal(tick.data.asOf, '2026-11-19 15:00:00')
    assert.equal(tick.data.quote.name, '测试股')
    assert.equal(tick.data.scale, '1d')
    assert.equal(called, 0, 'tick 不应调用引擎')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('/tick 拒绝非法参数', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-routes-'))
  try {
    const server = harness(dir)
    const noCode = await post(server.handleTick, { scale: '1d' })
    assert.equal(noCode.status, 400)
    const badScale = await post(server.handleTick, { code: '600519', scale: '7m' })
    assert.equal(badScale.status, 400)
    assert.match(badScale.data.error.message, /不支持的周期/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('/forecast 成功后把结果写进 last 与 watchlist', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-routes-'))
  try {
    const server = harness(dir)
    const response = await server.handleForecast(new Request('http://x/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '600519', scale: '1d', nPaths: 2, steps: 2 }),
    }))
    await response.text()

    const state = (await post(server.handleState, {})).data.state
    assert.equal(state.last.result.code, '600519.SH')
    assert.equal(state.last.result.scale, '1d')
    assert.equal(state.watchlist[0].code, '600519.SH')
    assert.equal(state.notes['600519.SH'], '1d')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
