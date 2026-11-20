/**
 * 预测进行中的覆盖层。
 *
 * 之前是一个占满整行的大卡片，插在图表上方，把图表往下挤、又很空。
 * 现在改成盖在图表（或空态）上的半透明层：图表本身还在，中间一个圆环进度 +
 * 一行阶段说明 + 一行「第 n/N 步 · 耗时」，不改变页面布局。
 */
import React from 'react'

const h = React.createElement

const RING = 56
const STROKE = 4
const RADIUS = (RING - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ProgressOverlay({ steps, total, stage, elapsed, onCancel, labels }) {
  // 计算进度：至少留 2% 的弧，0% 时环上也能看到起点
  const raw = total > 0 ? Math.min(1, steps / total) : 0
  const percent = total > 0 ? Math.round(raw * 100) : 0
  const hasSteps = total > 0
  const dash = Math.max(0.08, raw) * CIRCUMFERENCE
  // 文案里的百分比跟随真实进度，不被「起点最小弧」影响
  const shownPercent = hasSteps ? percent : 0

  return h('div', { className: 'kfc-overlay' },
    h('div', { className: 'kfc-overlayCard' },
      h('div', { className: 'kfc-ring' },
        h('svg', { width: RING, height: RING, viewBox: `0 0 ${RING} ${RING}`, 'aria-hidden': 'true' },
          h('circle', {
            cx: RING / 2, cy: RING / 2, r: RADIUS,
            fill: 'none', stroke: 'currentColor', strokeWidth: STROKE, opacity: 0.18,
          }),
          h('circle', {
            cx: RING / 2, cy: RING / 2, r: RADIUS,
            fill: 'none', stroke: 'currentColor', strokeWidth: STROKE,
            strokeLinecap: 'round',
            strokeDasharray: `${dash} ${CIRCUMFERENCE}`,
            transform: `rotate(-90 ${RING / 2} ${RING / 2})`,
            style: { transition: 'stroke-dasharray .3s ease' },
          })),
        h('span', { className: 'kfc-ringText' }, hasSteps ? `${shownPercent}%` : '···')),

      h('div', { className: 'kfc-overlayText' },
        h('b', null, stage || labels.working),
        h('span', null, hasSteps
          ? `${labels.stepsUnit} ${steps}/${total} · ${elapsed.toFixed(1)}s`
          : `${elapsed.toFixed(1)}s`)),

      h('button', { type: 'button', className: 'kfc-ghost kfc-overlayCancel', onClick: onCancel },
        labels.cancel))
  )
}