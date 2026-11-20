/**
 * 设置弹窗。
 *
 * 目前只放「AI 解读用哪个模型」——它是唯一需要用户关心的配置项（其余开关都在工具栏上，
 * 直接可见更好）。模型列表由 Host 的 /models 返回；没配置模型时给出引导文案而不是空白。
 */
import React from 'react'

const h = React.createElement

export function SettingsDialog({
  open, onClose, models, loading, selected, onSelect, onRefresh, error, t,
}) {
  React.useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const current = models.find((m) => m.provider === selected?.provider && m.model === selected?.model)

  return h('div', { className: 'kfc-modalMask', onClick: onClose },
    h('div', {
      className: 'kfc-modal',
      onClick: (event) => event.stopPropagation(),
      role: 'dialog',
      'aria-modal': 'true',
    },
    h('div', { className: 'kfc-modalHead' },
      h('b', null, t('settingsTitle')),
      h('button', { type: 'button', className: 'kfc-ghost kfc-modalClose', onClick: onClose }, '✕')),

    h('div', { className: 'kfc-modalBody' },
      h('div', { className: 'kfc-field' },
        h('div', { className: 'kfc-fieldLabel' }, t('settingsModel')),
        h('div', { className: 'kfc-fieldHint' }, t('settingsModelHint')),

        loading
          ? h('div', { className: 'kfc-modalHint' }, t('newsLoading'))
          : null,

        !loading && models.length === 0
          ? h('div', { className: 'kfc-modalEmpty' }, t('settingsNoModel'))
          : null,

        !loading && models.length > 0
          ? h('div', { className: 'kfc-modelList' },
            // 「跟随默认」永远是第一项
            h('button', {
              type: 'button',
              className: `kfc-modelItem ${!selected?.provider ? 'active' : ''}`,
              onClick: () => onSelect(null),
            },
            h('span', { className: 'kfc-modelName' }, t('settingsFollowDefault')),
            h('span', { className: 'kfc-modelHint' }, t('settingsFollowHint')),
            !selected?.provider ? h('span', { className: 'kfc-modelCheck' }, '✓') : null),
            models.map((item) => {
              const active = current && item.provider === current.provider && item.model === current.model
              return h('button', {
                key: `${item.provider}/${item.model}`,
                type: 'button',
                className: `kfc-modelItem ${active ? 'active' : ''}`,
                onClick: () => onSelect({ provider: item.provider, model: item.model }),
              },
              h('span', { className: 'kfc-modelName' }, item.name ?? item.model),
              h('span', { className: 'kfc-modelHint' }, item.provider),
              active ? h('span', { className: 'kfc-modelCheck' }, '✓') : null)
            }))
          : null,

        error ? h('div', { className: 'kfc-modalError' }, error) : null,

        h('div', { className: 'kfc-modalActions' },
          h('button', { type: 'button', className: 'kfc-ghost', onClick: onRefresh, disabled: loading },
            t('settingsRefresh')),
          h('button', { type: 'button', className: 'kfc-primary', onClick: onClose }, t('settingsDone')))))))
}