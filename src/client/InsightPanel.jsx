/**
 * AI 解读面板。
 *
 * 把大盘、当前个股行情、预测分布、公告新闻一起交给 DSH 已配置的模型，
 * 流式输出一段解读。默认收起，点「解读」才请求（不浪费 token）。
 */
import React from 'react'

const h = React.createElement

export function InsightPanel({
  state, text, model, error, onRun, onStop, onClear, t,
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
        : null),

    error
      ? h('div', { className: 'kfc-insightError' }, error)
      : null,

    hasText
      ? h('div', { className: 'kfc-insightText' }, text, running ? h('span', { className: 'kfc-caret' }) : null)
      : (running
        ? h('div', { className: 'kfc-insightHint' }, t('insightWorking'))
        : h('div', { className: 'kfc-insightHint' }, t('insightHint'))))
}