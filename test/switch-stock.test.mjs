/**
 * 切换股票 / 周期的契约：
 *   - 预测结果只属于「当前选中的股票 + 周期」，否则不能拿来画图
 *   - 切股票要清掉旧结果
 *   - 联想不能被一次无关的重渲染打断（曾经的无限请求循环）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const panel = readFileSync(join(root, 'src', 'client', 'Panel.jsx'), 'utf8')

test('图表数据必须校验结果属于当前股票与周期', () => {
  // 曾经是 `result ?? previewData`，切换股票后旧结果优先级更高，图就卡住不动
  assert.equal(/const chartData = result \?\? previewData/.test(panel), false,
    'chartData 不能无条件优先用 result')
  assert.match(panel, /const chartData = \(resultMatches \? result : null\) \?\? previewData/)
  assert.match(panel, /result\.code === resultTarget/)
  assert.match(panel, /result\.scale === scale/)
})

test('resultMatches 声明在任何引用它的 effect 之前（避免 TDZ）', () => {
  const decl = panel.indexOf('  const resultMatches = Boolean(')
  assert.ok(decl > 0, '找不到 resultMatches 的声明')
  // 逐个 effect 检查：截取它自己的括号范围（而不是固定窗口，避免误判），
  // 凡是正文里用到 resultMatches 的，都必须排在声明之后
  const uses = []
  let cursor = 0
  for (;;) {
    const start = panel.indexOf('React.useEffect(', cursor)
    if (start < 0) break
    let depth = 0
    let end = start
    for (let i = start + 'React.useEffect'.length; i < panel.length; i += 1) {
      if (panel[i] === '(') depth += 1
      else if (panel[i] === ')') {
        depth -= 1
        if (depth === 0) { end = i; break }
      }
    }
    const body = panel.slice(start, end + 1)
    if (body.includes('resultMatches')) uses.push(start)
    cursor = end + 1
  }
  assert.ok(uses.length > 0, '应至少有一个 effect 用到 resultMatches')
  for (const start of uses) {
    assert.ok(start > decl, `第 ${start} 字符处的 effect 在声明之前就引用了 resultMatches`)
  }
})

test('切股票会清掉不属于它的预测结果', () => {
  const block = /const pick = \(item[\s\S]{0,900}?loadPreview\(item\.code, valid\)/.exec(panel)
  assert.ok(block, '找不到 pick 的实现')
  assert.match(block[0], /setResult\(null\)/, '换股票必须清掉旧结果')
  assert.match(block[0], /result\.code !== item\.code \|\| result\.scale !== valid/)
})

test('overlay 补拉不会因为依赖 overlays 而无限循环', () => {
  const block = /const historyFetchRef = React\.useRef\(''\)[\s\S]{0,1200}?\}, \[([^\]]+)\]\)/.exec(panel)
  assert.ok(block, '找不到 overlay 补拉 effect')
  const deps = block[1].split(',').map((s) => s.trim())
  // overlays 仍在依赖里是可以的，但必须有 ref 去重，否则会死循环
  assert.match(panel, /historyFetchRef\.current === target/, '必须有去重标记')
})

test('联想有令牌守卫，避免旧请求覆盖新输入', () => {
  assert.match(panel, /searchTokenRef\.current !== token/, '联想结果要用令牌校验')
})
