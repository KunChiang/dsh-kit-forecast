/**
 * 解读 + 消息面的布局契约：
 *   - 两者放在同一个网格里（宽屏并排、窄屏堆叠）
 *   - 两栏标题栏等高，并排时基线一致
 *   - 卡片是 flex 列，内容区自己滚动，不撑破网格
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const panel = readFileSync(join(root, 'src', 'client', 'Panel.jsx'), 'utf8')
const style = readFileSync(join(root, 'src', 'client', 'styles.js'), 'utf8')

test('解读与消息面被同一个网格容器包住', () => {
  const start = panel.indexOf('className="kfc-infoGrid"')
  assert.ok(start > 0, '找不到 kfc-infoGrid 容器')
  const insight = panel.indexOf('<InsightPanel', start)
  const news = panel.indexOf('<NewsPanel', start)
  assert.ok(insight > start, '网格里应包含解读')
  assert.ok(news > insight, '网格里应包含消息面，且排在解读之后')
  // 两者必须在同一个容器关闭之前
  const close = panel.indexOf('</div>', news)
  assert.ok(close > news)
})

test('宽屏两栏，窄屏回落成单栏（容器查询）', () => {
  const block = /\.kfc-infoGrid \{[\s\S]*?\}/.exec(style)
  assert.ok(block)
  assert.match(block[0], /grid-template-columns:\s*minmax\(0, 1\.2fr\)\s+minmax\(0, 1fr\)/)
  const narrow = /@container kfc \(max-width: 900px\) \{[\s\S]*?\.kfc-infoGrid \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/
  assert.match(style, narrow, '窄容器应回落成单栏')
})

test('只显示一栏时占满整行（未选股票）', () => {
  assert.match(style, /\.kfc-infoGrid > :only-child \{[^}]*grid-column: 1 \/ -1/)
})

test('两栏标题栏固定同高，并排时基线对齐', () => {
  for (const cls of ['.kfc-insightBar', '.kfc-newsBar']) {
    const block = new RegExp(`\\${cls} \\{[\\s\\S]*?\\}`).exec(style)
    assert.ok(block, `找不到 ${cls}`)
    assert.match(block[0], /height:\s*46px/, `${cls} 应固定 46px`)
  }
})

test('卡片是 flex 列，内容区独立滚动', () => {
  assert.match(style, /\.kfc-insight \{[^}]*display: flex[^}]*flex-direction: column/)
  assert.match(style, /\.kfc-news \{[^}]*display: flex[^}]*flex-direction: column/)
  assert.match(style, /\.kfc-insightText \{[^}]*overflow: auto/)
  assert.match(style, /\.kfc-newsList \{[^}]*overflow: auto/)
})

test('空态提示垂直居中，避免被拉高后上方大片空白', () => {
  const hint = /\.kfc-insightHint \{[\s\S]*?\}/.exec(style)
  assert.ok(hint)
  assert.match(hint[0], /display: flex/)
  assert.match(hint[0], /justify-content: center/)
  assert.match(hint[0], /flex: 1 1 auto/)
})
