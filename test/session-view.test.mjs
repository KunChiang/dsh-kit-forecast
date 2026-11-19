/**
 * 默认视窗：必须能看到「最近一个完整交易日」。
 * 之前固定只看 60 根，1m 周期下只有 1 小时，上午的数据完全看不见。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sameView, sessionView } from '../src/client/view.js'

/** 造第 day 天、共 n 根的分钟线。 */
function day(dayText, n, prefix = '') {
  const out = []
  for (let i = 0; i < n; i += 1) {
    const h = 9 + Math.floor((30 + i) / 60)
    const m = (30 + i) % 60
    out.push({ t: `${dayText} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`, c: 10 + i * 0.01 })
  }
  return prefix ? out : out
}

test('1m：一整天 240 根能完整显示（含预测）', () => {
  const history = day('2026-11-19', 240)
  const view = sessionView(history, 120, '1m')
  // 240 + 120 = 360 根，全部放得下就返回「全部」
  assert.deepEqual(view, { start: 0, count: 0 })
})

test('1m：跨两天的历史里，默认只看最近一天 + 20 根上下文', () => {
  const history = [...day('2026-11-18', 240), ...day('2026-11-19', 240)]
  const view = sessionView(history, 120, '1m')
  assert.ok(view.count > 0, '应该是一个受限视窗')
  // 期望：今天 240 + 上下文 20 + 预测 120 = 380
  assert.equal(view.count, 380)
  assert.equal(view.start + view.count, history.length + 120, '视窗必须贴住最新一端')
})

test('早盘只有几根时，自动把上一交易日并进来', () => {
  // 三天历史 + 今天只有 3 根，视窗必然受限
  const history = [...day('2026-11-17', 240), ...day('2026-11-18', 240), ...day('2026-11-19', 3)]
  const nPred = 120
  const total = history.length + nPred
  const view = sessionView(history, nPred, '1m')

  assert.ok(view.count > 0 && view.count < total, '应是一个受限视窗')
  assert.equal(view.start + view.count, total, '必须贴住最新一端')
  // 今天这几根当然要在窗口里
  const todayStart = history.length - 3
  assert.ok(view.start <= todayStart, '今天的 bar 必须全部可见')
  // 只有 3 根时，窗口应延伸到上一个交易日
  assert.ok(view.count > 3 + nPred + 200, `应把上一交易日并进来，实际 ${view.count}`)
})

test('日线：默认看最近 60 个交易日 + 预测', () => {
  const history = Array.from({ length: 400 }, (_, i) => ({ t: `2025-${String((i % 12) + 1).padStart(2, '0')}-01 15:00:00`, c: 10 + i }))
  const view = sessionView(history, 20, '1d')
  assert.equal(view.count, 80)
  assert.equal(view.start, 400 - 60)
})

test('空数据不炸', () => {
  assert.deepEqual(sessionView([], 20, '1m'), { start: 0, count: 0 })
  assert.deepEqual(sessionView(null, 20, '1d'), { start: 0, count: 0 })
})

test('sameView 用来判断用户是否手动缩放过', () => {
  assert.equal(sameView({ start: 0, count: 0 }, { start: 0, count: 0 }), true)
  assert.equal(sameView(null, { start: 0, count: 0 }), true)
  assert.equal(sameView({ start: 1, count: 2 }, { start: 1, count: 2 }), true)
  assert.equal(sameView({ start: 1, count: 2 }, { start: 1, count: 3 }), false)
})
