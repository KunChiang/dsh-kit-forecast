/**
 * 面板状态的浏览器侧辅助：常用股票列表的增删改、偏好合并、格式化。
 *
 * 真正的落盘在 Host（dataDir/state.json），这样关掉面板、换窗口都能恢复；
 * 这里只做纯函数处理，方便单测。
 */

export const MAX_FAVORITES = 12
export const MAX_RECENT = 10

/** 把一只股票推进常用列表：已有的置顶刷新时间，新的插到最前面。 */
export function touchWatchlist(list, item, now = Date.now()) {
  const code = item?.code
  if (!code) return list
  const rest = list.filter((entry) => entry.code !== code)
  const previous = list.find((entry) => entry.code === code)
  const next = {
    code,
    name: item.name ?? previous?.name ?? code,
    pinned: previous?.pinned === true,
    at: now,
  }
  return [next, ...rest]
}

/** 收藏/取消收藏（置顶）。返回新数组与是否已收藏。 */
export function togglePin(list, code, name) {
  const exists = list.find((entry) => entry.code === code)
  if (!exists) {
    return { list: [{ code, name: name ?? code, pinned: true, at: Date.now() }, ...list], pinned: true }
  }
  const next = list.map((entry) => (entry.code === code ? { ...entry, pinned: !entry.pinned } : entry))
  return { list: next, pinned: !exists.pinned }
}

/** 排序：收藏优先，其次按最近使用时间。 */
export function sortWatchlist(list) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return (b.at ?? 0) - (a.at ?? 0)
  })
}

/** 面板里「常用」那一排实际要显示的条目：收藏的全显示，最近的补到上限。 */
export function visibleWatchlist(list, { favorites = MAX_FAVORITES, recent = MAX_RECENT } = {}) {
  const sorted = sortWatchlist(list)
  const pinned = sorted.filter((entry) => entry.pinned).slice(0, favorites)
  const others = sorted.filter((entry) => !entry.pinned).slice(0, recent)
  return [...pinned, ...others]
}

/**
 * 'YYYY-MM-DD HH:mm:ss'（北京时间，无时区）或带 Z/偏移的 ISO 串 → 相对时间描述。
 * 无时区的裸时间按北京时间解释；已经带时区的原样解析，不能再拼 +08:00。
 */
export function relativeTime(iso, now = Date.now()) {
  const raw = String(iso ?? '').trim()
  if (raw === '') return ''
  const normalized = raw.includes('T') || raw.includes(' ') ? raw.replace(' ', 'T') : raw
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  const ts = Date.parse(hasZone ? normalized : `${normalized}+08:00`)
  if (!Number.isFinite(ts)) return ''
  const diff = Math.max(0, now - ts)
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec} 秒前`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.round(min / 60)
  if (hour < 24) return `${hour} 小时前`
  return `${Math.round(hour / 24)} 天前`
}

/** 交易时段判断（北京时间）：9:30-11:30、13:00-15:00，周末与午休不算。 */
export function inTradingSession(date = new Date()) {
  // 换算成北京时间的星期与分钟数
  const bj = new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 60000)
  const day = bj.getDay()
  if (day === 0 || day === 6) return false
  const minutes = bj.getHours() * 60 + bj.getMinutes()
  return (minutes >= 570 && minutes <= 690) || (minutes >= 780 && minutes <= 900)
}