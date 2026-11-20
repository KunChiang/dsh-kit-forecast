/**
 * 大盘概览条。
 *
 * 一行放 8 个主要指数，每个是一个可点的小块：点它就切到「用指数当标的」看 K 线/预测。
 * 右侧显示涨跌家数（市场宽度），用红绿比例条直观看出今天是普涨还是普跌。
 * 数据 20 秒轮询，和个股行情同一节奏。
 */
import React from 'react'

const h = React.createElement

function fmtIndex(value) {
  if (!Number.isFinite(value)) return '—'
  return value >= 10000 ? value.toFixed(0) : value.toFixed(2)
}

/** 涨跌家数比例条：红涨 / 绿跌 / 灰平。 */
function BreadthBar({ up, down, flat, t }) {
  const total = Math.max(1, up + down + flat)
  const ratio = (value) => `${(value / total) * 100}%`
  return h('div', { className: 'kfc-breadth' },
    h('div', { className: 'kfc-breadthBar', title: `${t('breadthUp')} ${up} / ${t('breadthDown')} ${down} / ${t('breadthFlat')} ${flat}` },
      h('i', { className: 'up', style: { width: ratio(up) } }),
      h('i', { className: 'flat', style: { width: ratio(flat) } }),
      h('i', { className: 'down', style: { width: ratio(down) } })),
    h('div', { className: 'kfc-breadthText' },
      h('span', { className: 'up' }, `${t('breadthUp')} ${up}`),
      h('span', { className: 'down' }, `${t('breadthDown')} ${down}`)))
}

export function MarketBar({ data, loading, activeCode, onPick, t }) {
  const indices = data?.indices ?? []
  // 滚动到 header 之下时给吸顶条加分隔线
  const ref = React.useRef(null)
  const [stuck, setStuck] = React.useState(false)
  React.useEffect(() => {
    const node = ref.current
    const root = node?.closest('.kfc-root')
    if (!root || !node) return undefined

    // 吸顶偏移必须按 header 实测高度算：写死 55px 会被 header 压住
    // （header 高度随字体/缩放/是否显示副标题变化）。
    const sync = () => {
      const header = root.querySelector('.kfc-header')
      const offset = header ? Math.round(header.getBoundingClientRect().height) : 0
      node.style.setProperty('--kfc-market-top', `${offset}px`)
      setStuck(root.scrollTop > offset - 12)
    }
    const onScroll = () => setStuck(root.scrollTop > (ref.current?.offsetTop ?? 0) - 12)

    sync()
    root.addEventListener('scroll', onScroll, { passive: true })
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null
    const header = root.querySelector('.kfc-header')
    if (observer && header) observer.observe(header)
    return () => {
      root.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [])

  return h('section', { className: `kfc-market ${stuck ? 'stuck' : ''}`, ref },
    h('div', { className: 'kfc-marketRow' },
      indices.map((item) => {
        const up = (item.changePercent ?? 0) >= 0
        const active = item.code === activeCode
        const chg = Number.isFinite(item.changePercent)
          ? `${up ? '+' : ''}${item.changePercent.toFixed(2)}%`
          : '—'
        return h('button', {
          key: item.code,
          type: 'button',
          className: `kfc-index ${active ? 'active' : ''} ${up ? 'up' : 'down'}`,
          title: `${item.name} · ${t('indexHint')}`,
          onClick: () => onPick(item),
        },
        h('span', { className: 'kfc-indexName' }, item.short ?? item.name),
        h('span', { className: 'kfc-indexPrice' }, fmtIndex(item.price)),
        h('span', { className: 'kfc-indexChg' }, chg))
      }),
      loading && indices.length === 0
        ? h('span', { className: 'kfc-marketLoading' }, t('loadingShort'))
        : null),
    data?.breadth
      ? h(BreadthBar, { ...data.breadth, t })
      : null)
}