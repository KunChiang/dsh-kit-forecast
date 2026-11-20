/**
 * AI 解读面板。
 *
 * 把大盘、当前个股行情、预测分布、公告新闻一起交给 DSH 已配置的模型，
 * 流式输出一段解读。默认收起，点「解读」才请求（不浪费 token）。
 */
import React from 'react'
import { Markdown } from './Markdown.jsx'

const h = React.createElement

export function InsightPanel({
  state, text, model, error, onRun, onStop, onClear, t,
  refine, onRefine, canRefine,
}) {
  const running = state === 'running'
  const hasText = text !== ''

  return h('div', { className: `kfc-insight ${running ? 'running' : ''}` },
    h('div', { className: 'kfc-insightBar' },
      h('span', { className: 'kfc-insightTitle' }, t('insightTitle')),
      model ? h('span', { className: 'kfc-insightModel', title: model }, model) : null,
      h('span', { className: 'kfc-insightSpacer' }),
      running
        ? h('button', { type: 'button', className: 'kfc-ghost', onClick: onStop }, t('cancel'))
        : h('button', {
          type: 'button',
          className: hasText ? 'kfc-ghost' : 'kfc-primary kfc-insightRun',
          onClick: onRun,
        }, hasText ? t('insightRedo') : t('insightRun')),
      hasText && !running
        ? h('button', { type: 'button', className: 'kfc-ghost', onClick: onClear }, t('insightClear'))
        : null,
      canRefine
        ? h('button', {
          type: 'button',
          className: refine?.state === 'done' ? 'kfc-ghost' : 'kfc-primary',
          disabled: refine?.state === 'running',
          title: t('refineHint'),
          onClick: onRefine,
        }, refine?.state === 'running' ? t('refining') : (refine?.state === 'done' ? t('refineRedo') : t('refineRun')))
        : null),

    // 修正结果
    refine?.state === 'error'
      ? h('div', { className: 'kfc-insightError' }, refine.error)
      : null,
    refine?.state === 'done'
      ? h('div', { className: 'kfc-refineBox' },
        h('div', { className: 'kfc-refineHead' },
          h('span', { className: 'kfc-refineLabel' }, t('refineTitle')),
          Number.isFinite(refine.originalRet) && Number.isFinite(refine.ret)
            ? h('span', { className: 'kfc-refineDelta' },
              `${(refine.originalRet * 100).toFixed(2)}% → `,
              h('b', null, `${(refine.ret * 100).toFixed(2)}%`))
            : null,
          Number.isFinite(refine.confidence)
            ? h('span', { className: 'kfc-refineConf' }, `${t('refineConfidence')} ${Math.round(refine.confidence * 100)}%`)
            : null,
          refine.model ? h('span', { className: 'kfc-insightModel' }, refine.model) : null),
        refine.reasons?.length
          ? h('ul', { className: 'kfc-refineReasons' },
            refine.reasons.map((reason, index) => h('li', { key: index }, reason)))
          : null,
        h('div', { className: 'kfc-refineNote' },
          refine.outOfBand
            ? `${t('refineClamped')}${Number.isFinite(refine.rawRet) ? `（原始 ${(refine.rawRet * 100).toFixed(2)}%）` : ''}`
            : t('refineNote')))
      : null,

    error
      ? h('div', { className: 'kfc-insightError' }, error)
      : null,

    hasText
      ? h('div', { className: 'kfc-insightText' },
        h(Markdown, { text }),
        running ? h('span', { className: 'kfc-caret' }) : null)
      : (running
        ? h('div', { className: 'kfc-insightHint' }, t('insightWorking'))
        : h('div', { className: 'kfc-insightHint' }, t('insightHint'))))
}