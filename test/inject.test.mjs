/**
 * DSH/cordis 的依赖声明规则（踩过坑，用测试锁住）：
 *
 *   - cordis 的 `inject` 只接受「字符串数组」或「服务名 → 拦截配置」的对象，
 *     没有 `{ required, optional }` 这种形状。写成那样会被当成两个服务
 *     `required` / `optional`，插件永久 pending → DSH 判定启动失败。
 *   - 因此 llm 不能用模块级 inject（那会让整个插件等模型就绪），
 *     只能用嵌套 ctx.inject(['llm'], ...) 绑定。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = readFileSync(join(root, 'src', 'host', 'index.js'), 'utf8')

test('不能用模块级 inject 声明 llm', () => {
  assert.equal(/export const inject\s*=/.test(source), false,
    '模块级 inject 会让插件等 llm 就绪；没配模型的 profile 会启动失败')
})

test('不能用 required/optional 形状（cordis 不认，会被当成服务名）', () => {
  assert.equal(/required\s*:/.test(source), false, 'inject 里出现 required 形状')
  assert.equal(/optional\s*:\s*\[/.test(source), false, 'inject 里出现 optional 形状')
})

test('llm 通过嵌套 ctx.inject 绑定到解读服务', () => {
  assert.match(source, /ctx\.inject\(\['llm'\],/, '应使用嵌套注入绑定 llm')
  assert.match(source, /server\.insight\.ctx\s*=\s*llmCtx/, '应把注入后的 ctx 交给解读服务')
})

test('模块仍然导出 name 与 apply', async () => {
  const mod = await import('../lib/index.js')
  assert.equal(mod.name, 'kit-forecast')
  assert.equal(typeof mod.apply, 'function')
  assert.equal(mod.inject, undefined, '不应再有模块级 inject 导出')
})

test('没绑 llm 时 /models 与 /insight 优雅降级', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { createServer, normalizeConfig, resolvePaths } = await import('../lib/index.js')

  const dir = mkdtempSync(join(tmpdir(), 'kit-inject-'))
  try {
    // 模拟「插件已激活但 llm 尚未注入」：ctx 上没有 llm
    const server = createServer(
      { logger: { info() {}, warn() {}, error() {} }, get: () => undefined },
      normalizeConfig({}),
      resolvePaths({ dataDir: dir }),
      {},
    )
    const models = await (await server.handleModels()).json()
    assert.equal(models.ok, true)
    assert.deepEqual(models.items, [], '没模型时列表为空，不应抛错')

    // 解读应当给出可读错误，而不是崩溃
    const res = await server.handleInsight(new Request('http://x/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"code":"600519"}',
    }))
    assert.equal(res.status, 200, 'SSE 通道本身应建立成功')
    const text = await res.text()
    assert.match(text, /fail/, '应回传一条失败事件')
    assert.match(text, /模型服务|没有可用的模型/, '错误信息应说明缺少模型服务')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
