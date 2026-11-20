/**
 * 「进入面板不预测」的契约：
 *   - 默认 autoRefresh 关闭
 *   - 未显式请求时不会自动触发 forecast
 *   - 只有行情（无预测）时图表仍能画（由 Chart 的 nPred=0 分支保证）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const panel = readFileSync(join(root, 'src', 'client', 'Panel.jsx'), 'utf8')
const chart = readFileSync(join(root, 'src', 'client', 'Chart.jsx'), 'utf8')

test('实时跟随默认关闭', () => {
  assert.match(panel, /const \[autoRefresh, setAutoRefresh\] = React\.useState\(false\)/,
    'autoRefresh 应默认 false，否则一进面板就会重算')
})

test('选股票默认只加载行情，不预跑模型', () => {
  assert.match(panel, /const pick = \(item, \{ runNow = false \} = \{\}\) => \{/)
})

test('换周期会清掉旧周期的预测', () => {
  // 周期切换现在是自绘 Select 的 onChange(next)，不再是原生 select 的 event.target.value
  const block = /onChange=\{\(next\) => \{[\s\S]{0,600}?loadPreview\(code, next\)/.exec(panel)
  assert.ok(block, '找不到换周期的处理块')
  assert.match(block[0], /setResult\(null\)/, '换周期必须清掉旧结果，避免比例尺对不上')
  assert.match(block[0], /loadPreview\(/, '换周期应改为只加载行情')
})

test('心跳只在「实时跟随开启 + 出现新 bar」时才重算', () => {
  // 现在通过 ref 读开关（依赖数组里放易变状态会让定时器被反复重建）
  const block = /if \(autoRefreshRef\.current && newBar && !runningRef\.current/.exec(panel)
  assert.ok(block, '重算条件必须是 autoRefreshRef.current && newBar')
  // 不能因为换了股票/周期就顺手重算
  assert.equal(/if \(autoRefresh && \(newBar \|\| stale\)/.test(panel), false)
})

test('图表允许没有预测（nPred = 0）', () => {
  assert.match(chart, /if \(nHist === 0\) return/, '不能因为 nPred=0 就整体不画')
  assert.equal(/if \(nHist === 0 \|\| nPred === 0\) return/.test(chart), false)
  // 没有预测时不画「预测」分界线
  assert.match(chart, /if \(nPred > 0 && \(inView\(nHist\)/)
})

test('恢复失败也必须落地 hydrated，不能卡在「正在恢复」', () => {
  assert.match(panel, /\} finally \{[\s\S]{0,240}?setHydrated\(true\)/,
    'hydrated 必须在 finally 里设置')
})
