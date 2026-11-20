/**
 * 防止「加了 props 却忘了进 useCallback 依赖」这类回归：
 * 之前 overlays 和 livePrice 都漏了，导致画布不重绘、看起来像数据不实时。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const chart = readFileSync(join(root, 'src', 'client', 'Chart.jsx'), 'utf8')

test('draw 的依赖数组覆盖所有影响绘制的 prop', () => {
  const match = /const draw = React\.useCallback\(\(\) => \{[\s\S]*?\n  \}, \[([^\]]+)\]\)/.exec(chart)
  assert.ok(match, '应能找到 draw 的 useCallback 依赖数组')
  const deps = match[1].split(',').map((item) => item.trim()).filter(Boolean)
  for (const prop of ['data', 'height', 'overlays', 'livePrice', 'liveCandle', 'realizedBars']) {
    assert.ok(deps.includes(prop), `依赖数组缺少 ${prop}：画布不会因它变化而重绘`)
  }
})

test('组件的解构参数与依赖数组一致', () => {
  const props = /export function ForecastChart\(\{([^}]+)\}\)/.exec(chart)[1]
    .replace(/\/\/[^\n]*/g, '')           // 去掉行内注释
    .split(',')
    .map((item) => item.split('=')[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
  const match = /const draw = React\.useCallback\(\(\) => \{[\s\S]*?\n  \}, \[([^\]]+)\]\)/.exec(chart)
  const deps = match[1].split(',').map((item) => item.trim())
  for (const prop of props) {
    if (prop === 'height') continue
    assert.ok(deps.includes(prop), `${prop} 是绘制 prop，应在依赖数组里`)
  }
})
