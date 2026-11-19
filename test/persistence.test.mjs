/**
 * 数据持久化的关键约束：
 *   - 收藏（pinned）不能因为「对同一只股票跑预测」而丢失
 *   - 历史预测有上限与过期策略
 *   - 主文件损坏能从 .bak 回滚
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createStateStore } from '../lib/state.js'

const quiet = { info() {}, warn() {}, error() {} }
const result = (code, extra = {}) => ({
  code,
  name: code,
  scale: '1m',
  asOf: '2026-11-19 15:00:00',
  futureTimestamps: ['2026-11-19 15:01:00'],
  close: { q05: [1], q25: [1], q50: [1], q75: [1], q95: [1] },
  bands: {},
  history: [],
  stats: { retMedian: 0.01 },
  ...extra,
})

test('对已置顶的股票跑预测，置顶状态不会丢', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-persist-'))
  try {
    const store = createStateStore(dir, quiet)
    store.patch({ watchlist: [{ code: '688981.SH', name: '中芯国际', pinned: true, at: 1 }] })
    store.remember(result('688981.SH'))
    const entry = store.read().watchlist.find((item) => item.code === '688981.SH')
    assert.equal(entry.pinned, true, '置顶必须保留')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('未置顶的股票预测后仍是未置顶', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-persist-'))
  try {
    const store = createStateStore(dir, quiet)
    store.remember(result('600519.SH'))
    assert.equal(store.read().watchlist[0].pinned, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('历史预测超过单目标上限会被丢弃', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-persist-'))
  try {
    const store = createStateStore(dir, quiet)
    for (let i = 0; i < 20; i += 1) {
      store.remember(result('600519.SH', { asOf: `2026-11-19 15:${String(i).padStart(2, '0')}:00` }))
    }
    const history = store.read().history
    assert.equal(history.length, 12, '单目标最多留 12 条')
    // 留下的是最新的
    assert.equal(history.at(-1).asOf, '2026-11-19 15:19:00')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('同一 anchor 重复预测只保留一条', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-persist-'))
  try {
    const store = createStateStore(dir, quiet)
    store.remember(result('600519.SH'))
    store.remember(result('600519.SH'))
    store.remember(result('600519.SH'))
    assert.equal(store.read().history.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('超过 30 天的历史预测会被清掉', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-persist-'))
  try {
    const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
    writeFileSync(join(dir, 'state.json'), JSON.stringify({
      version: 2, watchlist: [], last: null, prefs: {}, notes: {},
      history: [
        { code: 'A.SH', scale: '1m', asOf: 'x', generatedAt: old, future: [] },
        { code: 'B.SH', scale: '1m', asOf: 'y', generatedAt: new Date().toISOString(), future: [] },
      ],
    }))
    const store = createStateStore(dir, quiet)
    const history = store.read().history
    assert.equal(history.length, 1, '40 天前的应被清理')
    assert.equal(history[0].code, 'B.SH')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('主文件损坏时能从 .bak 回滚', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-persist-'))
  try {
    const store = createStateStore(dir, quiet)
    store.patch({ watchlist: [{ code: '600519.SH', name: '贵州茅台', pinned: true, at: 1 }] })
    store.patch({ prefs: { scale: '30m' } }) // 第二次写入会产生 .bak
    assert.ok(existsSync(join(dir, 'state.json.bak')), '应生成 .bak')

    // 模拟主文件被写坏
    writeFileSync(join(dir, 'state.json'), '{ broken', 'utf8')
    const recovered = createStateStore(dir, quiet).read()
    assert.equal(recovered.watchlist.length, 1, '应从备份恢复收藏')
    assert.equal(recovered.watchlist[0].pinned, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('statePath 可覆盖文件位置（开发脚本隔离用）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-persist-'))
  try {
    const custom = join(dir, 'nested', 'my-state.json')
    const store = createStateStore(dir, quiet, custom)
    store.patch({ prefs: { scale: '1d' } })
    assert.ok(existsSync(custom))
    assert.equal(JSON.parse(readFileSync(custom, 'utf8')).prefs.scale, '1d')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
