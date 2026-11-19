/**
 * 「从常用里删除一只股票」必须删干净：
 *   - watchlist、notes、history、last 里的痕迹都要清
 *   - 重开面板不能从 last 把它复活
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { createStateStore } from '../lib/state.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const quiet = { info() {}, warn() {}, error() {} }

const result = (code, scale = '1m') => ({
  code, name: code, scale,
  asOf: '2026-11-19 15:00:00',
  futureTimestamps: ['2026-11-19 15:01:00'],
  close: { q05: [1], q25: [1], q50: [1], q75: [1], q95: [1] },
  bands: {}, history: [], stats: { retMedian: 0.01 },
})

test('forget() 清掉 watchlist / notes / history / last', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-forget-'))
  try {
    const store = createStateStore(dir, quiet)
    store.remember(result('600519.SH'))
    store.remember(result('300750.SZ'))

    const before = store.read()
    assert.equal(before.watchlist.length, 2)
    assert.ok(before.notes['600519.SH'])
    assert.equal(before.history.length, 2)
    assert.equal(before.last.result.code, '300750.SZ')

    const after = store.forget('600519.SH')
    assert.equal(after.watchlist.some((w) => w.code === '600519.SH'), false, 'watchlist 应移除')
    assert.equal('600519.SH' in after.notes, false, 'notes 应清除')
    assert.equal(after.history.some((h) => h.code === '600519.SH'), false, '历史预测应清除')
    // last 指向的是另一只，应保留
    assert.equal(after.last.result.code, '300750.SZ')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('forget() 删除「上次预测」那只时同时清掉 last', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-forget-'))
  try {
    const store = createStateStore(dir, quiet)
    store.remember(result('600519.SH'))
    const after = store.forget('600519.SH')
    assert.equal(after.last, null, 'last 必须清空，否则重开会复活')
    assert.deepEqual(after.watchlist, [])
    assert.deepEqual(after.history, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('只提交 watchlist 时也会顺手清理已移除股票的 notes 与 last', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-forget-'))
  try {
    const store = createStateStore(dir, quiet)
    store.remember(result('600519.SH'))
    store.remember(result('300750.SZ'))
    // 模拟旧客户端：只发 watchlist
    const after = store.patch({
      watchlist: store.read().watchlist.filter((w) => w.code !== '600519.SH'),
    })
    assert.equal('600519.SH' in after.notes, false)
    // last 是 300750，不在被移除之列，保留
    assert.equal(after.last.result.code, '300750.SZ')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('删除后重新载入（模拟重开面板）不会复活', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-forget-'))
  try {
    createStateStore(dir, quiet).remember(result('600519.SH'))
    createStateStore(dir, quiet).forget('600519.SH')
    // 重新 new 一个 store（相当于插件重启 / 面板重开）
    const reopened = createStateStore(dir, quiet).read()
    assert.deepEqual(reopened.watchlist, [])
    assert.equal(reopened.last, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('客户端只恢复仍在常用列表里的 last', () => {
  const panel = readFileSync(join(root, 'src', 'client', 'Panel.jsx'), 'utf8')
  assert.match(panel, /remembered/, '恢复 last 前必须校验它还在 watchlist 里')
})
