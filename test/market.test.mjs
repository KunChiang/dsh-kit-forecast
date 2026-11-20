/**
 * 大盘与指数：
 *   - 指数代码不会被误判成同号的个股（000001.SH 上证 vs 000001.SZ 平安银行）
 *   - 指数不做复权、不受涨跌停约束
 *   - /market 返回 8 个主要指数
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { INDEXES, isIndex, normalizeCode } from '../lib/datasource.js'
import { createServer, normalizeConfig, resolvePaths } from '../lib/index.js'

const quiet = { info() {}, warn() {}, error() {} }

test('指数与个股同号时能区分', () => {
  assert.equal(normalizeCode('000001.SH').code, '000001.SH', '上证指数')
  assert.equal(normalizeCode('000001.SH').isIndex, true)
  assert.equal(normalizeCode('000001').code, '000001.SZ', '不带后缀默认深市个股（平安银行）')
  assert.equal(normalizeCode('000001').isIndex, undefined)
  assert.equal(normalizeCode('600519').code, '600519.SH')
})

test('指数表示里 symbol 带 sh/sz 前缀', () => {
  assert.equal(normalizeCode('000001.SH').symbol, 'sh000001')
  assert.equal(normalizeCode('399006.SZ').symbol, 'sz399006')
  assert.equal(isIndex('399006.SZ'), true)
  assert.equal(isIndex('000001.SZ'), false)
})

test('指数列表覆盖沪深主板/创业板/科创/北交所', () => {
  assert.ok(INDEXES.length >= 8)
  const codes = INDEXES.map((i) => i.code)
  for (const code of ['000001.SH', '399001.SZ', '399006.SZ', '000688.SH', '000300.SH']) {
    assert.ok(codes.includes(code), `缺少 ${code}`)
  }
  // 每个都要有可读名字，否则界面上会缺口
  for (const item of INDEXES) {
    assert.ok(item.name && item.short, `${item.code} 缺少名称`)
  }
})

test('/market 返回指数与涨跌家数（用桩数据）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-market-'))
  try {
    const market = {
      quotes: async (codes) => codes.map((code) => ({
        code, price: 100, changePercent: -1.2, open: 101, high: 102, low: 99,
      })),
      breadth: async () => [{ code: '000001.SH', up: 300, down: 4000, flat: 20 }],
    }
    const server = createServer({ logger: quiet }, normalizeConfig({}), resolvePaths({ dataDir: dir }), { market })
    const data = await (await server.handleMarket()).json()
    assert.equal(data.ok, true)
    assert.equal(data.indices.length, INDEXES.length)
    assert.equal(data.indices[0].price, 100)
    assert.equal(data.breadth.up, 300)
    assert.equal(data.breadth.down, 4000)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('/market 在某一路失败时仍然返回结构', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-market-'))
  try {
    const market = {
      quotes: async () => { throw new Error('quote down') },
      breadth: async () => { throw new Error('breadth down') },
    }
    const server = createServer({ logger: quiet }, normalizeConfig({}), resolvePaths({ dataDir: dir }), { market })
    const data = await (await server.handleMarket()).json()
    assert.equal(data.ok, true, '整体不应失败')
    assert.equal(data.indices.length, INDEXES.length, '结构仍然完整')
    assert.equal(data.indices[0].price, null, '缺数据时为 null')
    assert.equal(data.breadth, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
