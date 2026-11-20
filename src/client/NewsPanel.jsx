/**
 * 公告 / 新闻面板。
 *
 * 放在图表下方、默认收起一条摘要（「3 条公告 · 6 条新闻」），点开才展开列表，
 * 不抢主视图的空间。展开后两个分栏可以切换，条目点击跳原文。
 */
import React from 'react'
import { NS } from './i18n.js'

const h = React.createElement

/** 北京时间 → 相对时间（今天/昨天/MM-DD）。now 可以是 Date 或毫秒数。 */
function shortDate(text, now = Date.now()) {
  const raw = String(text ?? '')
  if (raw.length < 10) return raw
  const date = raw.slice(0, 10)
  const base = now instanceof Date ? now : new Date(now)
  const offset = base.getTimezoneOffset()
  const today = new Date(base.getTime() + (offset + 480) * 60000).toISOString().slice(0, 10)
  if (date === today) return raw.slice(11, 16) || '今天'
  const yesterday = new Date(base.getTime() + (offset + 480) * 60000 - 86400000)
    .toISOString().slice(0, 10)
  if (date === yesterday) return '昨天'
  return date.slice(5)
}

export function NewsPanel({ data, loading, error, tab, onTab, t, now }) {
  const announcements = data?.announcements ?? []
  const news = data?.news ?? []
  const items = tab === 'news' ? news : announcements
  const total = announcements.length + news.length

  return h('div', { className: 'kfc-news' },
    h('div', { className: 'kfc-newsBar' },
      h('span', { className: 'kfc-newsTitle' }, t('newsTitle')),
      h('button', {
        type: 'button',
        className: `kfc-newsTab ${tab === 'notice' ? 'active' : ''}`,
        onClick: () => onTab('notice'),
      }, `${t('newsNotices')} ${announcements.length || ''}`.trim()),
      h('button', {
        type: 'button',
        className: `kfc-newsTab ${tab === 'news' ? 'active' : ''}`,
        onClick: () => onTab('news'),
      }, `${t('newsItems')} ${news.length || ''}`.trim()),
      loading ? h('span', { className: 'kfc-newsLoading' }, t('newsLoading')) : null,
      error ? h('span', { className: 'kfc-newsError', title: error }, t('newsFailed')) : null),

    items.length === 0
      ? h('div', { className: 'kfc-newsEmpty' }, loading ? t('newsLoading') : t('newsEmpty'))
      : h('ul', { className: 'kfc-newsList' },
        items.map((item, index) => h('li', { key: `${item.id}-${index}`, className: 'kfc-newsItem' },
          h('span', { className: 'kfc-newsDate' }, shortDate(item.time || item.date, now)),
          item.category
            ? h('span', { className: 'kfc-newsTag' }, item.category)
            : null,
          item.url
            ? h('a', {
              className: 'kfc-newsLink',
              href: item.url,
              target: '_blank',
              rel: 'noreferrer noopener',
              title: item.title,
            }, item.title)
            : h('span', { className: 'kfc-newsLink', title: item.title }, item.title))))
  )
}