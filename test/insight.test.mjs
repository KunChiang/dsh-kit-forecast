/**
 * AI 解读：
 *   - 提示词只写已有的数据，缺什么不编（不出现 undefined/NaN）
 *   - 没有任何数据时明确拒绝
 *   - 模型选择跳过非对话模型
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildPrompt } from '../lib/insight.js'

test('没有数据时返回 null（让调用方报错而不是瞎编）', () => {
  assert.equal(buildPrompt({}), null)
  assert.equal(buildPrompt({ market: null, stock: null, forecast: null, news: null }), null)
})

test('提示词包含大盘、预测与公告，且不出现 undefined', () => {
  const prompt = buildPrompt({
    market: {
      indices: [{ name: '上证指数', price: 3533.79, changePercent: -1.23 }],
      breadth: { up: 301, down: 4961, flat: 31 },
    },
    stock: { code: '600519.SH', name: '贵州茅台', price: 1485.75, changePercent: 1.75, open: 1450, high: 1489, low: 1423 },
    forecast: {
      asOf: '2026-11-20 15:00:00',
      Lh: 120,
      scale: '30m',
      stats: { retMedian: -0.0181, upProb: 0.25, retQ05: -0.0295, retQ95: 0.0064, targetQ05: 2147.78, targetQ95: 2226.31, volMedian: 0.004, maxDdMedian: -0.02 },
    },
    news: {
      announcements: [{ date: '2026-11-03', category: '其他', title: '关于召开业绩说明会的公告' }],
      news: [{ time: '2026-11-20 08:01:52', title: '茅台集团召开战略研讨会' }],
    },
    scale: '30m',
  })
  assert.ok(prompt.includes('上证指数'))
  assert.ok(prompt.includes('301'))
  assert.ok(prompt.includes('-1.81%'), '收益率应转成百分比')
  assert.ok(prompt.includes('25%'), '上涨概率应转成百分比')
  assert.ok(prompt.includes('贵州茅台'))
  assert.ok(prompt.includes('关于召开业绩说明会的公告'))
  assert.ok(prompt.includes('茅台集团召开战略研讨会'))
  assert.ok(prompt.includes('概率分布'), '必须说明这是概率而不是结论')
  assert.equal(/undefined|NaN/.test(prompt), false, '不能出现 undefined / NaN')
})

test('只有大盘也能生成提示词（不要求选中股票）', () => {
  const prompt = buildPrompt({ market: { indices: [{ name: '上证指数', price: 3533, changePercent: -1.2 }] } })
  assert.ok(prompt && prompt.includes('上证指数'))
})

test('模型选择跳过 embedding / rerank 等非对话模型', async () => {
  const { InsightService } = await import('../lib/insight.js')
  const ctx = {
    get: () => undefined,
    llm: {
      listProviders: () => [{ id: 'p1' }],
      listModels: async () => [
        { id: 'text-embedding-3', name: 'embedding' },
        { id: 'rerank-v1', name: 'rerank' },
        { id: 'chat-a', name: 'Chat A' },
      ],
    },
  }
  const service = new InsightService(ctx, { warn() {} })
  const model = await service.resolveModel()
  assert.equal(model.model, 'chat-a')
})

test('没有可用 provider 时给出明确错误', async () => {
  const { InsightService } = await import('../lib/insight.js')
  const service = new InsightService({ get: () => undefined, llm: { listProviders: () => [], listModels: async () => [] } }, { warn() {} })
  await assert.rejects(() => service.resolveModel(), /没有可用的对话模型|没有可用的模型服务/)
})
