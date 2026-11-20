/**
 * 轻量下拉选择器。
 *
 * 原生 <select> 在 macOS/Electron 下是系统控件，样式不可控（圆角、字体、
 * 展开面板都很「系统」，和面板整体风格不搭）。这里自绘一个：
 *   - 触发按钮沿用面板的 token 样式
 *   - 弹出层带勾选态、hover 高亮、键盘上下/回车/Esc
 *   - 点外部关闭
 */
import React from 'react'

const h = React.createElement

export function Select({
  value, options, onChange, title, className = '', align = 'left', width,
}) {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const rootRef = React.useRef(null)
  const listRef = React.useRef(null)

  const current = options.find((item) => item.value === value)

  React.useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // 打开时高亮当前项
  React.useEffect(() => {
    if (!open) return
    const index = options.findIndex((item) => item.value === value)
    setActive(index >= 0 ? index : 0)
    // 让高亮项滚进可视区
    requestAnimationFrame(() => {
      const node = listRef.current?.children?.[index]
      node?.scrollIntoView?.({ block: 'nearest' })
    })
  }, [open, options, value])

  const pick = (item) => {
    setOpen(false)
    if (item && item.value !== value) onChange(item.value)
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((prev) => Math.max(0, Math.min(options.length - 1, prev + delta)))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      pick(options[active])
    }
  }

  return h('div', {
    className: `kfc-dd ${open ? 'open' : ''} ${className}`,
    ref: rootRef,
    style: width ? { width } : undefined,
  },
  h('button', {
    type: 'button',
    className: 'kfc-ddTrigger',
    title,
    onClick: () => setOpen((prev) => !prev),
    onKeyDown,
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
  },
  h('span', { className: 'kfc-ddValue' }, current?.label ?? value),
  h('svg', { className: 'kfc-ddCaret', width: 10, height: 10, viewBox: '0 0 10 10', 'aria-hidden': 'true' },
    h('path', { d: 'M2 3.6L5 6.6L8 3.6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }))),

  open
    ? h('div', {
      className: `kfc-ddList ${align === 'right' ? 'right' : ''}`,
      ref: listRef,
      role: 'listbox',
    },
    options.map((item, index) => h('button', {
      key: item.value,
      type: 'button',
      role: 'option',
      'aria-selected': item.value === value,
      className: `kfc-ddItem ${item.value === value ? 'selected' : ''} ${index === active ? 'active' : ''}`,
      onMouseEnter: () => setActive(index),
      onClick: () => pick(item),
    },
    h('span', { className: 'kfc-ddItemLabel' }, item.label),
    item.hint ? h('span', { className: 'kfc-ddItemHint' }, item.hint) : null,
    item.value === value
      ? h('svg', { className: 'kfc-ddCheck', width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true' },
        h('path', { d: 'M2.5 6.4L4.8 8.7L9.5 3.6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }))
      : null)))
    : null)
}