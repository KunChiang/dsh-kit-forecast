/**
 * /forecast 路由的契约测试：用假的行情层 + 假的推理引擎，
 * 检查 SSE 事件顺序、种子可复现、涨跌停幅度推断、错误分支与 K 线不足的提示。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createServer, normalizeConfig, resolvePaths } from '../lib/index.js'

const quiet = { info() {}, warn() {}, error() {} }

function fakeBars(scale, count, end = '2026-11-18 15:00:00') {
  const stepMin = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '2h': 120, '1d': 1440 }[scale]
  const base = Date.parse(`${end.replace(' ', 'T')}+08:00`)
  const bars = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = new Date(base - i * stepMin * 60000)
    const iso = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
    const hm = t.toISOString().slice(11, 16)
    bars.push({ t: `${iso} ${hm}:00`, o: 10, h: 10.2, l: 9.9, c: 10.1, v: 1000 })
  }
  return bars
}

function harness({ bars, quote, needOk = true, failBars = false }) {
  const market = {
    quote: async () => {
      if (!quote) throw new Error('no quote')
      return quote
    },
    bars: async (code, scale) => {
      const list = failBars ? fakeBars(scale, 5) : (bars ?? fakeBars(scale, 1500))
      return { code, scale, bars: list, source: 'fake', adjustmentApplied: true, droppedForming: false }
    },
    tradingDays: async () => ['2026-11-17', '2026-11-18'],
  }
  const seen = []
  const engine = {
    alive: false,
    python: 'fake',
    stop() {},
    async start() {
      this.alive = true
      return { ok: true }
    },
    async request(op, payload, onProgress) {
      seen.push(payload)
      onProgress?.({ stage: 'sample', step: 1, total: 3, message: '采样 1/3' })
      onProgress?.({ stage: 'sample', step: 3, total: 3, message: '采样完成' })
      return {
        code: payload.code, scale: payload.scale, asOf: payload.bars.at(-1).t,
        lastClose: 10.1, Lc: 100, Lh: 20, nPad: 0, nPaths: payload.nPaths, steps: payload.steps,
        device: 'cpu', precision: 'fp32', sampleSeconds: 0.1, limitRate: payload.limitRate,
        history: payload.bars.slice(-5), futureTimestamps: [], bands: {}, pathMedian: [], pathBull: [], pathBear: [],
        stats: { retMedian: 0, upProb: 0.5 },
      }
    },
  }
  const paths = resolvePaths({ dataDir: '/tmp/kit-forecast-test' })
  const server = createServer({ logger: quiet }, normalizeConfig({}), paths, { market, engine })
  return { server, seen }
}

async function collect(handlerPromise) {
  const response = await handlerPromise
  const text = await response.text()
  return text.split('\n\n').filter(Boolean).map((block) => {
    const line = block.split('\n').find((l) => l.startsWith('data:'))
    return JSON.parse(line.slice(5).trim())
  })
}

const req = (body) => new Request('http://x/api/kit-forecast/forecast', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

test('/forecast 按 stage → progress → result 顺序推送', async () => {
  const { server } = harness({ quote: { name: '贵州茅台', price: 10, prevClose: 10, changePercent: 1, limitUp: 11, limitDown: 9 } })
  const events = await collect(server.handleForecast(req({ code: '600519', scale: '1d', nPaths: 4, steps: 3 })))
  const types = events.map((e) => e.t)
  assert.ok(types.indexOf('stage') < types.indexOf('progress'))
  assert.ok(types.indexOf('progress') < types.indexOf('result'))
  assert.equal(types.at(-1), 'done')
  const result = events.find((e) => e.t === 'result').data
  assert.equal(result.name, '贵州茅台')
  assert.equal(result.code, '600519.SH')
  assert.equal(result.source, 'fake')
  assert.equal(result.adjustmentApplied, true)
})

test('同一根 bar 默认用同一个种子，结果可复现', async () => {
  const { server, seen } = harness({ quote: null })
  await collect(server.handleForecast(req({ code: '600519', scale: '1d' })))
  await collect(server.handleForecast(req({ code: '600519', scale: '1d' })))
  assert.equal(seen.length, 2)
  assert.equal(seen[0].seed, seen[1].seed)
  assert.equal(seen[0].nPaths, 12, '日线默认预算')
})

test('显式 seed 会被透传', async () => {
  const { server, seen } = harness({ quote: null })
  await collect(server.handleForecast(req({ code: '600519', scale: '1d', seed: 42 })))
  assert.equal(seen[0].seed, 42)
})

test('涨跌停幅度按板块与盘口推断', async () => {
  const cases = [
    // 盘口给出的涨停价优先
    [{ name: 'X', prevClose: 10, limitUp: 11 }, '600519', 0.1],
    // 创业板 20%
    [{ name: 'X', prevClose: 10, limitUp: null }, '300750', 0.2],
    // 科创板 20%
    [{ name: 'X', prevClose: 10, limitUp: null }, '688981', 0.2],
    // 北交所 30%
    [{ name: 'X', prevClose: 10, limitUp: null }, '830799', 0.3],
    // 主板 ST 5%
    [{ name: '*ST某某', prevClose: 10, limitUp: null }, '600123', 0.05],
    // 主板普通 10%
    [{ name: '普通股', prevClose: 10, limitUp: null }, '600123', 0.1],
  ]
  for (const [quote, code, expected] of cases) {
    const { server, seen } = harness({ quote })
    await collect(server.handleForecast(req({ code, scale: '1d', nPaths: 2, steps: 2 })))
    assert.ok(Math.abs(seen[0].limitRate - expected) < 1e-9, `${code} ${quote.name} -> ${seen[0].limitRate}`)
  }
})

test('关掉涨跌停约束时不传 limitRate', async () => {
  const { server, seen } = harness({ quote: { name: 'X', prevClose: 10, limitUp: 11 } })
  await collect(server.handleForecast(req({ code: '600519', scale: '1d', applyLimit: false })))
  assert.equal(seen[0].limitRate, null)
})

test('K 线不足时给出可读的 fail，而不是调用引擎', async () => {
  const { server, seen } = harness({ quote: null, failBars: true })
  const events = await collect(server.handleForecast(req({ code: '600519', scale: '1m' })))
  const fail = events.find((e) => e.t === 'fail')
  assert.ok(fail, '应推送 fail')
  assert.match(fail.message, /需要 1200 根历史 K 线/)
  assert.equal(seen.length, 0)
})

test('未知周期与非法代码被拒绝', async () => {
  const { server } = harness({ quote: null })
  const badScale = await server.handleForecast(req({ code: '600519', scale: '3m' }))
  assert.equal(badScale.status, 400)
  assert.match((await badScale.json()).error.message, /不支持的周期/)

  const badCode = await server.handleForecast(req({ code: 'hello', scale: '1d' }))
  assert.equal(badCode.status, 400)
  assert.match((await badCode.json()).error.message, /无法识别的股票代码/)
})

test('行情失败不影响预测，只是没有盘口信息', async () => {
  const { server } = harness({ quote: null })
  const events = await collect(server.handleForecast(req({ code: '600519', scale: '1d' })))
  const result = events.find((e) => e.t === 'result')
  assert.ok(result, '仍应出结果')
  assert.equal(result.data.quote, null)
  assert.equal(result.data.name, '600519')
})
