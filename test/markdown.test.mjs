/**
 * AI 解读的 Markdown 渲染：
 *   - 必须产出真实结构（标题/列表/表格/引用），而不是把源码原样显示
 *   - 不得使用 innerHTML（模型输出不可信）
 *   - 链接只放行安全协议
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const md = readFileSync(join(root, 'src', 'client', 'Markdown.jsx'), 'utf8')
const panel = readFileSync(join(root, 'src', 'client', 'InsightPanel.jsx'), 'utf8')
const style = readFileSync(join(root, 'src', 'client', 'styles.js'), 'utf8')

test('解读面板使用 Markdown 组件渲染，而不是纯文本', () => {
  assert.match(panel, /import \{ Markdown \} from '\.\/Markdown\.jsx'/)
  assert.match(panel, /h\(Markdown, \{ text \}\)/, '应把 AI 输出交给 Markdown 渲染')
  assert.equal(/whiteSpace: 'pre-wrap'/.test(panel), false)
})

test('样式里不再用 pre-wrap 当纯文本显示', () => {
  const block = /\.kfc-insightText \{[\s\S]*?\}/.exec(style)
  assert.ok(block, '找不到 .kfc-insightText 样式')
  assert.equal(/white-space:\s*pre-wrap/.test(block[0]), false, 'pre-wrap 会让 Markdown 标记原样显示')
})

test('渲染器不使用 innerHTML / dangerouslySetInnerHTML', () => {
  assert.equal(/dangerouslySetInnerHTML/.test(md), false, '不能用 innerHTML 注入模型输出')
  assert.equal(/innerHTML\s*=/.test(md), false)
})

test('链接协议白名单，挡掉 javascript:', () => {
  assert.match(md, /function safeHref/)
  assert.equal(/\^https\?:\\\/\\\//.test(md), true, '应校验 http(s)')
  assert.match(md, /return null/, '不安全协议应返回 null 而不是原样透传')
  assert.match(md, /href === null/, '不安全链接应退化成正文本')
})

test('实现了 AI 输出常见的语法结构', () => {
  for (const token of ['kfc-mdHeading', 'kfc-mdList', 'kfc-mdTable', 'kfc-mdQuote', 'kfc-mdPre', 'kfc-mdCode']) {
    assert.ok(md.includes(token), `缺少 ${token}`)
    assert.ok(style.includes(`.${token}`), `样式缺少 .${token}`)
  }
  // 粗体/斜体
  assert.match(md, /h\('strong'/)
  assert.match(md, /h\('em'/)
})

test('表格需要表头分隔行才识别，避免误判普通竖线文本', () => {
  assert.match(md, /function isTableSeparator/)
  assert.match(md, /isTableSeparator\(lines\[i \+ 1\]\)/, '应检查下一行是否为分隔行')
})

test('涨跌幅在 Markdown 内上色（A 股习惯：红涨绿跌）', () => {
  assert.match(md, /kfc-mdUp/)
  assert.match(md, /kfc-mdDown/)
  assert.match(style, /\.kfc-mdUp \{ color: var\(--dsw-alias-state-danger-primary\)/)
  assert.match(style, /\.kfc-mdDown \{ color: var\(--dsw-alias-state-success-primary\)/)
})

test('渲染器是零依赖的（不引入 remark/marked 之类）', () => {
  const imports = [...md.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
  assert.deepEqual(imports, ['react'], `不应引入额外依赖，实际: ${imports.join(', ')}`)
})
