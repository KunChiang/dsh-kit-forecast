/**
 * 历史预测对比（overlay）的契约测试：
 *   - 与真实 bar 按时间戳对齐，只统计已实现的那些
 *   - 评分字段：预测收益 / 实际收益 / 是否落在 q05–q95 / 方向是否命中
 *   - /forecast 结果里会自动带上同类历史预测
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createServer, normalizeConfig, resolvePaths } from '../lib/index.js'

const quiet = { info() {}, warn() {}, error() {} }

/** 造 n 根日线，收盘价按 step 递增。 */
function makeBars(n, start = 100, step = 1) {
  const bars = []
  const base = Date.parse('2026-01-01T07:00:00Z')
  for (let i = 0; i < n; i += 1) {
    const d = new Date(base + i * 86400000)
    const iso = d.toISOString().slice(0, 10)
    const close = start + i * step
    bars.push({ t: `${iso} 15:00:00`, o: close, h: close + 1, l: close - 1, c: close, v: 1000 })
  }
  return bars
}

function seedHistory(dataDir, bars, { scale = '1d', code = '600519.SH', anchorIndex = 10, Lh = 5 } = {}) {
  const anchor = bars[anchorIndex]
  // 预测时就会写下完整的未来时间轴（日历投影），不依赖后来是否真的产生了 bar；
  // 未收盘的部分在对比时留空即可。
  const future = Array.from({ length: Lh }, (_, i) => {
    const d = new Date(Date.parse(anchor.t.replace(' ', 'T') + 'Z') + (i + 1) * 86400000)
    return `${d.toISOString().slice(0, 10)} 15:00:00`
  })
  // 预测：每天 +2%；分位带宽 ±3%
  const q50 = future.map((_, i) => anchor.c * Math.pow(1.02, i + 1))
  const band = (k) => future.map((_, i) => anchor.c * Math.pow(1.02, i + 1) * (1 + k * Math.sqrt((i + 1) / Lh)))
  const entry = {
    code, name: '测试股', scale, asOf: anchor.t, generatedAt: '2026-01-01T00:00:00.000Z',
    lastClose: anchor.c, Lh, nPaths: 8, steps: 6, future,
    close: { q05: band(-0.03), q25: band(-0.015), q50, q75: band(0.015), q95: band(0.03) },
    stats: { retMedian: Math.log(q50.at(-1) / anchor.c), upProb: 0.6, targetMedian: q50.at(-1) },
    warm: null,
  }
  writeFileSync(join(dataDir, 'state.json'), JSON.stringify({ version: 2, watchlist: [], last: null, prefs: {}, notes: {}, history: [entry] }))
  return entry
}

function harness(dataDir, bars) {
  const market = {
    quote: async () => ({ name: '测试股', price: bars.at(-1).c, prevClose: bars.at(-2).c, changePercent: 1 }),
    // 真实 MarketData 会把代码归一化成 600519.SH，这里保持一致
    bars: async (code, scale) => ({ code: code.includes('.') ? code : `${code}.SH`, scale, bars, source: 'fake', adjustmentApplied: false, droppedForming: false }),
    tradingDays: async () => bars.map((bar) => bar.t.slice(0, 10)),
  }
  const engine = {
    alive: true,
    stop() {},
    async start() { return { ok: true } },
    async request(op, payload) {
      return {
        code: payload.code, scale: payload.scale, asOf: payload.bars.at(-1).t, lastClose: payload.bars.at(-1).c,
        Lc: 5, Lh: 5, nPad: 0, nPaths: payload.nPaths, steps: payload.steps,
        device: 'cpu', precision: 'fp32', sampleSeconds: 0.1, limitRate: payload.limitRate,
        history: payload.bars.slice(-5), futureTimestamps: ['x'], bands: { close: { q50: [1] } },
        pathMedian: [{ t: 'x' }], pathBull: [], pathBear: [], stats: { retMedian: 0, upProb: 0.5 },
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
  return response.json()
}

test('overlay 按时间戳对齐真实 bar，并算出评分', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-hist-'))
  try {
    const bars = makeBars(30, 100, 1)      // 收盘 100..129
    const entry = seedHistory(dir, bars)   // anchor 在第 11 根（收盘 110），预测 +2%/天
    const server = harness(dir, bars)
    const data = await post(server.handleHistory, { code: '600519', scale: '1d' })

    assert.equal(data.overlays.length, 1)
    const o = data.overlays[0]
    assert.equal(o.asOf, entry.asOf)
    assert.equal(o.points.length, 5, 'Lh=5')
    assert.equal(o.verify.realizedBars, 5, '五根都已收盘')
    assert.equal(o.verify.complete, true)

    // 实际每天只涨 1 块（110→115），预测每天 +2%，所以预测收益大于实际
    assert.ok(o.verify.predRet > o.verify.actualRet)
    assert.ok(Math.abs(o.verify.error - (o.verify.actualRet - o.verify.predRet)) < 1e-12)
    // 实际收盘 115 vs 预测 110*1.02^5≈121.4，落在 q05 之下 → 区间未命中
    assert.equal(o.verify.insideBand, false)
    assert.equal(o.verify.directionHit, true, '两边都是上涨')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('overlay 只统计已实现的 bar，未走完的部分留空', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-hist-'))
  try {
    const bars = makeBars(30, 100, 1)
    seedHistory(dir, bars, { anchorIndex: 27, Lh: 5 })   // 只剩 2 根真实 bar
    const server = harness(dir, bars)
    const data = await post(server.handleHistory, { code: '600519', scale: '1d' })
    const o = data.overlays[0]
    assert.equal(o.points.length, 5)
    assert.equal(o.verify.realizedBars, 2)
    assert.equal(o.verify.complete, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('excludeAsOf 用来排除当前 anchor，避免和自己比', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-hist-'))
  try {
    const bars = makeBars(30, 100, 1)
    const entry = seedHistory(dir, bars)
    const server = harness(dir, bars)
    const same = await post(server.handleHistory, { code: '600519', scale: '1d', excludeAsOf: entry.asOf })
    assert.equal(same.overlays.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('/forecast 的结果里带上同类历史预测', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-hist-'))
  try {
    // 日线要求 250 根历史，这里给足
    const bars = makeBars(300, 100, 1)
    seedHistory(dir, bars)
    const server = harness(dir, bars)
    const response = await server.handleForecast(new Request('http://x/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '600519', scale: '1d', nPaths: 2, steps: 2 }),
    }))
    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean).map((block) => {
      const line = block.split('\n').find((l) => l.startsWith('data:'))
      return line ? JSON.parse(line.slice(5).trim()) : null
    }).filter(Boolean)
    const result = events.find((e) => e.t === 'result').data
    assert.equal(result.overlays.length, 1, '应带上之前那条预测')
    assert.ok(result.overlays[0].verify, '带评分')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
