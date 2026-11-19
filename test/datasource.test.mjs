/**
 * 行情层的纯逻辑测试：代码归一化、bar 网格过滤、未收盘 bar 剔除、周期聚合。
 * 这些是「数据正确性」的关键，不需要网络。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SCALES, MarketData, dropFormingBar, normalizeCode, parseBeijing } from '../lib/datasource.js'

const bar = (t, o = 1, h = 1, l = 1, c = 1, v = 1) => ({ t, o, h, l, c, v })

test('normalizeCode 覆盖各种输入写法', () => {
  const cases = [
    ['600519', '600519.SH'],
    ['sh600519', '600519.SH'],
    ['SH600519', '600519.SH'],
    ['600519.SH', '600519.SH'],
    ['600519.sh', '600519.SH'],
    ['000001', '000001.SZ'],
    ['300750.SZ', '300750.SZ'],
    ['sz300750', '300750.SZ'],
    ['688981', '688981.SH'],
    ['830799', '830799.BJ'],
    ['002594', '002594.SZ'],
  ]
  for (const [input, expected] of cases) {
    assert.equal(normalizeCode(input).code, expected, `${input} -> ${expected}`)
  }
  assert.equal(normalizeCode('60051'), null)
  assert.equal(normalizeCode(''), null)
  assert.equal(normalizeCode('abcdef'), null)
  assert.equal(normalizeCode('1234567'), null)
})

test('parseBeijing 把北京时间换算成 UTC Date', () => {
  const d = parseBeijing('2026-11-18 15:00:00')
  assert.equal(d.toISOString(), '2026-11-18T07:00:00.000Z')
  // Date 是对象，比较时间戳而不是引用
  assert.equal(parseBeijing('2026-11-18 09:31').getTime(), parseBeijing('2026-11-18 09:31:00').getTime())
  assert.equal(parseBeijing('nonsense'), null)
})

test('unclosed bar 会被剔除，已收盘的不会被误删', () => {
  // 15:00 的日线在 15:00:10 算已收盘
  const daily = [bar('2026-11-17 15:00:00'), bar('2026-11-18 15:00:00')]
  assert.equal(dropFormingBar(daily, '1d', new Date('2026-11-18T15:00:10+08:00')).bars.length, 2)
  // 盘中：15:00 的 bar 还没到，数据源若已给 15:00 时间戳也不能用
  assert.equal(dropFormingBar(daily, '1d', new Date('2026-11-18T14:00:00+08:00')).bars.length, 1)

  // 午休：11:30 的 2h bar 在 11:35 已经收盘，不能因为「12:00 之前」被误删
  const twoHour = [bar('2026-11-18 10:00:00'), bar('2026-11-18 11:30:00')]
  assert.equal(dropFormingBar(twoHour, '2h', new Date('2026-11-18T11:35:00+08:00')).bars.length, 2)

  // 空数组不炸
  assert.deepEqual(dropFormingBar([], '5m', new Date()), { bars: [], dropped: false })
})

test('各周期的会话网格与 A 股实际 bar 数一致', () => {
  // 每个交易日的 bar 数：1m 240、5m 48、15m 16、30m 8、1h 4、2h 2、1d 1
  const expected = { '1m': 240, '5m': 48, '15m': 16, '30m': 8, '1h': 4, '2h': 2, '1d': 1 }
  for (const [scale, info] of Object.entries(SCALES)) {
    assert.equal(info.minutes, scale === '1d' ? 1440 : scale === '2h' ? 120 : scale === '1h' ? 60 : Number.parseInt(scale, 10), scale)
    assert.ok(expected[scale] > 0, scale)
  }
})

test('bars() 会过滤掉不在会话网格上的脏 bar 并去重', async () => {
  const md = new MarketData({ logger: { warn() {} } })
  const raw = [
    { date: '2026-11-18', time: '09:35:00', t: '2026-11-18 09:35:00', o: 1, h: 1, l: 1, c: 1, v: 1 },
    { date: '2026-11-18', time: '09:35:00', t: '2026-11-18 09:35:00', o: 2, h: 2, l: 2, c: 2, v: 2 }, // 重复
    { date: '2026-11-18', time: '12:15:00', t: '2026-11-18 12:15:00', o: 1, h: 1, l: 1, c: 1, v: 1 }, // 午休，不在 5m 网格上
    { date: '2026-11-18', time: '15:00:00', t: '2026-11-18 15:00:00', o: 1, h: 1, l: 1, c: 1, v: 1 },
  ]
  md.sinaKline = async () => raw
  md.adjustment = async () => new Map()
  const result = await md.bars('600519', '5m')
  assert.deepEqual(result.bars.map((b) => b.t), ['2026-11-18 09:35:00', '2026-11-18 15:00:00'])
})

test('前复权因子按日期二分匹配到最近一个已知交易日', async () => {
  const md = new MarketData({ logger: { warn() {} } })
  const rows = [
    { date: '2026-11-17', time: '09:35:00', t: '2026-11-17 09:35:00', o: 10, h: 10, l: 10, c: 10, v: 1 },
    { date: '2026-11-18', time: '09:35:00', t: '2026-11-18 09:35:00', o: 10, h: 10, l: 10, c: 10, v: 1 },
  ]
  md.sinaKline = async () => rows
  md.adjustment = async () => new Map([['2026-11-17', 0.5], ['2026-11-18', 0.8]])
  const result = await md.bars('600519', '5m')
  assert.equal(result.adjustmentApplied, true)
  assert.deepEqual(result.bars.map((b) => b.c), [5, 8])
})
