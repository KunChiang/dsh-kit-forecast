/**
 * DSH 依赖声明：没在模块顶层声明 inject，访问 ctx.llm 会抛
 * `cannot get property "llm" without inject`（这是 DSH 的机制，不是配置问题）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { inject, name } from '../lib/index.js'

test('模块顶层声明了 llm 依赖', () => {
  assert.equal(name, 'kit-forecast')
  const list = Array.isArray(inject)
    ? inject
    : [...(inject?.required ?? []), ...(inject?.optional ?? [])]
  assert.ok(list.includes('llm'), '必须声明 llm，否则解读/修正拿不到模型')
})

test('llm 是可选依赖：没配模型时其它功能仍可用', () => {
  if (Array.isArray(inject)) return // 简单数组等于全部必填，这里不断言
  assert.ok(!(inject.required ?? []).includes('llm'), 'llm 不应是必填，否则没配模型时插件整个加载失败')
  assert.ok((inject.optional ?? []).includes('llm'))
})

test('/models 在 llm 不可用时返回空列表而不是报错', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createServer, normalizeConfig, resolvePaths } = await import('../lib/index.js')

  const dir = mkdtempSync(join(tmpdir(), 'kit-models-'))
  try {
    const server = createServer({ logger: { info() {}, warn() {}, error() {} } }, normalizeConfig({}), resolvePaths({ dataDir: dir }), {})
    const data = await (await server.handleModels()).json()
    assert.equal(data.ok, true)
    assert.deepEqual(data.items, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('/models 列出模型并过滤非对话模型', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createServer, normalizeConfig, resolvePaths } = await import('../lib/index.js')
  const { InsightService } = await import('../lib/insight.js')

  const ctx = {
    get: () => undefined,
    llm: {
      listProviders: () => [{ id: 'openai', name: 'OpenAI' }],
      listModels: async () => [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'text-embedding-3', name: 'embedding' },
      ],
    },
  }
  const dir = mkdtempSync(join(tmpdir(), 'kit-models-'))
  try {
    const server = createServer({ logger: { info() {}, warn() {}, error() {} } }, normalizeConfig({}), resolvePaths({ dataDir: dir }), {
      insight: new InsightService(ctx, { warn() {} }),
    })
    const data = await (await server.handleModels()).json()
    assert.equal(data.items.length, 1)
    assert.equal(data.items[0].model, 'gpt-4o')
    assert.equal(data.items[0].provider, 'openai')
    assert.equal(data.items[0].label, 'OpenAI · GPT-4o')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('用户指定的模型优先于会话默认', async () => {
  const { InsightService } = await import('../lib/insight.js')
  const ctx = {
    get: (key) => (key === 'agentDefaultModel'
      ? { currentSelection: () => ({ provider: 'p1', model: 'default-model' }) }
      : undefined),
    llm: {
      listProviders: () => [{ id: 'p1' }, { id: 'p2' }],
      listModels: async (id) => (id === 'p1'
        ? [{ id: 'default-model' }, { id: 'other-model' }]
        : [{ id: 'chosen-model' }]),
    },
  }
  const service = new InsightService(ctx, { warn() {} })
  assert.equal((await service.resolveModel()).model, 'default-model', '不指定时跟随会话默认')
  assert.equal((await service.resolveModel({ provider: 'p2', model: 'chosen-model' })).model, 'chosen-model', '指定时用指定的')
})
