/**
 * 状态持久化与常用股票的纯逻辑测试：
 *   - Host 侧 state.json 的读写、合并、原子写入、损坏恢复
 *   - Client 侧 watchlist 的置顶/去重/排序/上限
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createStateStore } from '../lib/state.js'
import { togglePin, touchWatchlist, visibleWatchlist, sortWatchlist, relativeTime } from '../src/client/store.js'

const quiet = { info() {}, warn() {}, error() {} }

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'kit-state-'))
}

test('空目录读到空状态，写入后可读回', () => {
  const dir = tempDir()
  try {
    const store = createStateStore(dir, quiet)
    assert.deepEqual(store.read().watchlist, [])
    store.patch({ prefs: { scale: '30m' } })
    const again = createStateStore(dir, quiet).read()
    assert.equal(again.prefs.scale, '30m')
    assert.ok(existsSync(join(dir, 'state.json')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('remember() 把股票推到常用并记录周期，同一只不重复', () => {
  const dir = tempDir()
  try {
    const store = createStateStore(dir, quiet)
    const base = { lastClose: 10, stats: {}, bands: {}, pathMedian: [], history: [] }
    store.remember({ ...base, code: '600519.SH', name: '贵州茅台', scale: '1d' })
    store.remember({ ...base, code: '300750.SZ', name: '宁德时代', scale: '30m' })
    store.remember({ ...base, code: '600519.SH', name: '贵州茅台', scale: '5m' })

    const state = store.read()
    assert.equal(state.watchlist.length, 2, '重复股票不应产生第二条')
    assert.equal(state.watchlist[0].code, '600519.SH', '最近使用的排最前')
    assert.equal(state.notes['600519.SH'], '5m', '记录该股票最后用的周期')
    assert.equal(state.last.result.code, '600519.SH')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('remember() 会裁剪冗余字段，避免状态文件膨胀', () => {
  const dir = tempDir()
  try {
    const store = createStateStore(dir, quiet)
    const history = Array.from({ length: 600 }, (_, i) => ({ t: `t${i}`, o: 1, h: 1, l: 1, c: 1, v: 1 }))
    store.remember({
      code: '600519.SH', name: '贵州茅台', scale: '1d',
      history, bands: { close: { q50: [1, 2] } }, pathMedian: [{ t: 'x', o: 1, h: 1, l: 1, c: 1, v: 1 }],
      pathBull: Array(50).fill({ t: 'bull' }), pathBear: Array(50).fill({ t: 'bear' }),
      stats: { retMedian: 0.01 }, quote: { price: 10 },
    })
    const saved = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'))
    // 1m 一个交易日 240 根，所以要留够完整交易日的量（400 根）
    assert.equal(saved.last.result.history.length, 400, '历史保留最近 400 根')
    assert.equal(saved.last.result.pathBull, undefined, '冗余路径不落盘')
    assert.deepEqual(saved.last.result.pathMedian, [{ t: 'x', o: 1, h: 1, l: 1, c: 1, v: 1 }])
    assert.equal(saved.last.result.stats.retMedian, 0.01)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('prefs 里 undefined 不会覆盖已有值', () => {
  const dir = tempDir()
  try {
    const store = createStateStore(dir, quiet)
    store.patch({ prefs: { scale: '1h', quality: 'fine' } })
    store.patch({ prefs: { scale: undefined, applyLimit: false } })
    const prefs = store.read().prefs
    assert.equal(prefs.scale, '1h', 'undefined 不应清掉原值')
    assert.equal(prefs.quality, 'fine')
    assert.equal(prefs.applyLimit, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('state.json 损坏时回落到空状态而不是抛错', () => {
  const dir = tempDir()
  try {
    writeFileSync(join(dir, 'state.json'), '{ not json', 'utf8')
    const store = createStateStore(dir, quiet)
    assert.deepEqual(store.read().watchlist, [])
    store.patch({ prefs: { scale: '1d' } })
    assert.equal(store.read().prefs.scale, '1d', '损坏后仍可正常写回')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('watchlist：置顶优先，其次按最近使用，且有上限', () => {
  const list = []
  let now = 1000
  for (const [code, name] of [['A', '甲'], ['B', '乙'], ['C', '丙']]) {
    now += 1000
    list.splice(0, list.length, ...touchWatchlist(list, { code, name }, now))
  }
  const sorted = sortWatchlist(list)
  assert.deepEqual(sorted.map((x) => x.code), ['C', 'B', 'A'])

  const pinned = togglePin(list, 'A', '甲')
  assert.equal(pinned.pinned, true)
  const after = sortWatchlist(pinned.list)
  assert.equal(after[0].code, 'A', '置顶的排最前')

  const unpinned = togglePin(pinned.list, 'A', '甲')
  assert.equal(unpinned.pinned, false)
  assert.equal(sortWatchlist(unpinned.list)[0].code, 'C', '取消置顶后回到时间序')

  // 上限：收藏最多 12、最近最多 10
  const many = Array.from({ length: 40 }, (_, i) => ({ code: `S${i}`, name: `股${i}`, pinned: i < 20, at: i }))
  const visible = visibleWatchlist(many)
  assert.equal(visible.length, 22)
  assert.equal(visible.filter((x) => x.pinned).length, 12)
})

test('touchWatchlist 重复命中会更新时间且保留置顶状态', () => {
  const list = [{ code: 'A', name: '甲', pinned: true, at: 1 }]
  const next = touchWatchlist(list, { code: 'A', name: '甲' }, 99)
  assert.equal(next.length, 1)
  assert.equal(next[0].at, 99)
  assert.equal(next[0].pinned, true)
})

test('relativeTime 输出人类可读的相对时间', () => {
  const iso = '2026-11-19T10:00:00.000Z'
  const now = Date.parse(iso) + 90 * 1000
  assert.equal(relativeTime(iso, now), '2 分钟前')
  assert.equal(relativeTime('', now), '')
  assert.equal(relativeTime('bad', now), '')
})
