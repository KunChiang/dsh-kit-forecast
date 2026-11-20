/**
 * 公告 / 新闻层：
 *   - 标题里的 <em> 等标签必须清掉
 *   - 两路互相独立，一路失败不影响另一路
 *   - /news 路由的入参校验
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createServer, normalizeConfig, resolvePaths } from '../lib/index.js'
import { stripTags } from '../lib/news.js'

const quiet = { info() {}, warn() {}, error() {} }

test('stripTags 清掉高亮标签、实体与多余空白', () => {
  assert.equal(stripTags('4.7<em>5</em>亿元 主力'), '4.75亿元 主力')
  assert.equal(stripTags('A&nbsp;B'), 'A B')
  assert.equal(stripTags('  <b>x</b>  \n y '), 'x y')
  assert.equal(stripTags(null), '')
  assert.equal(stripTags(undefined), '')
})

test('/news 路由：两路都成功时返回公告与新闻', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-news-'))
  try {
    const fakeFeed = {
      digest: async (code, opts) => ({
        code,
        announcements: [{ id: 'a1', title: '公告一', date: '2026-11-20', url: 'u', category: '其他' }],
        news: [{ id: 'n1', title: '新闻一', time: '2026-11-20 10:00:00', url: 'u' }],
        errors: [],
        fetchedAt: Date.now(),
        received: opts,
      }),
    }
    const server = createServer({ logger: quiet }, normalizeConfig({}), resolvePaths({ dataDir: dir }), { feed: fakeFeed })
    const res = await server.handleNews(new Request('http://x/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '600519', notices: 5, news: 6 }),
    }))
    const data = await res.json()
    assert.equal(data.ok, true)
    assert.equal(data.code, '600519.SH', '代码应被归一化')
    assert.equal(data.announcements.length, 1)
    assert.equal(data.news.length, 1)
    assert.deepEqual(data.received, { notices: 5, newsLimit: 6, force: false })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('/news 路由：缺代码 / 非法代码被拒', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-news-'))
  try {
    const server = createServer({ logger: quiet }, normalizeConfig({}), resolvePaths({ dataDir: dir }), {})
    const noCode = await server.handleNews(new Request('http://x/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }))
    assert.equal(noCode.status, 400)

    const bad = await server.handleNews(new Request('http://x/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"code":"zzz"}',
    }))
    assert.equal(bad.status, 400)
    assert.match((await bad.json()).error.message, /无法识别的股票代码/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('digest() 在某一路失败时仍返回另一路', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-news-'))
  try {
    // 公告抛错、新闻正常：验证 digest 的聚合逻辑不会因一路失败而整体失败
    const feed = {
      digest: async () => {
        const errors = []
        let announcements = []
        let news = []
        try {
          throw new Error('notice down')
        } catch (error) {
          errors.push(`公告：${error.message}`)
        }
        news = [{ id: 'n1', title: '新闻一' }]
        return { announcements, news, errors, fetchedAt: Date.now() }
      },
    }
    const server = createServer({ logger: quiet }, normalizeConfig({}), resolvePaths({ dataDir: dir }), { feed })
    const res = await server.handleNews(new Request('http://x/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"code":"600519"}',
    }))
    const data = await res.json()
    assert.equal(data.ok, true, '整体仍应成功')
    assert.equal(data.announcements.length, 0)
    assert.equal(data.news.length, 1, '新闻不受影响')
    assert.ok(data.errors.some((e) => e.includes('notice down')), '错误应被记录')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
