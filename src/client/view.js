/**
 * 图表的视窗（缩放/平移）算术。抽成纯函数，方便单测。
 *
 * 视窗用「第几根 bar 到第几根」表示，与像素无关：
 *   { start: 起点下标, count: 显示根数 }
 * count = 0 是特殊值，表示「全部显示」。
 */

/** 最少显示多少根 bar。 */
export const MIN_VISIBLE = 8

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

/** 把任意视窗收敛到合法范围。 */
export function normalizeView(view, total) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 }
  if (!view || !view.count || view.count >= total) return { start: 0, count: 0 }
  const count = Math.max(MIN_VISIBLE, Math.min(total, Math.round(view.count)))
  const start = Math.max(0, Math.min(total - count, Math.round(view.start)))
  return { start, count }
}

/** 视窗真正显示的根数（count=0 表示全览）。 */
export function visibleCount(view, total) {
  const normalized = normalizeView(view, total)
  return normalized.count || total
}

/**
 * 以 pivotIndex 为锚点缩放。
 * pivotIndex 是光标下的那根 bar；缩放后它应尽量停在原来的横向位置。
 *
 * @param {{start:number,count:number}} view
 * @param {number} total
 * @param {number} factor  <1 放大，>1 缩小
 * @param {number} [pivotIndex] 缺省用视窗中心
 */
export function zoomView(view, total, factor, pivotIndex) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 }
  const current = normalizeView(view, total)
  const currentCount = current.count || total
  const next = clamp(Math.round(currentCount * factor), MIN_VISIBLE, total)
  if (next === currentCount) return current
  if (next >= total) return { start: 0, count: 0 }

  const anchor = Number.isFinite(pivotIndex)
    ? clamp(pivotIndex, current.start, current.start + currentCount - 1)
    : current.start + currentCount / 2
  // 锚点在视窗内的相对位置，缩放后保持不变
  const ratio = (anchor - current.start) / currentCount
  const start = Math.round(anchor - ratio * next)
  return { start: Math.max(0, Math.min(total - next, start)), count: next }
}

/** 平移。deltaBars 为正向表示向后（未来的 bar 方向）移动。 */
export function panView(view, total, deltaBars) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 }
  const current = normalizeView(view, total)
  if (!current.count) return current // 全览状态不需要平移
  const start = Math.max(0, Math.min(total - current.count, Math.round(current.start + deltaBars)))
  return { start, count: current.count }
}

/** 视窗填满「最近 count 根」。 */
export function tailView(total, count) {
  if (!Number.isFinite(total) || total <= 0) return { start: 0, count: 0 }
  const size = clamp(Math.round(count), MIN_VISIBLE, total)
  if (size >= total) return { start: 0, count: 0 }
  return { start: total - size, count: size }
}

/**
 * 像素 → bar 下标。
 * @param {{plotLeft:number, step:number, viewStart:number, viewCount:number}} geom
 * @param {number} x 相对画布左边缘的像素
 * @returns {number} 浮点下标（未取整），越界会被夹到视窗边缘
 */
export function indexAtX(geom, x) {
  const { plotLeft = 0, step = 1, viewStart = 0, viewCount = 1 } = geom ?? {}
  if (!Number.isFinite(x)) return viewStart
  const raw = viewStart + (x - plotLeft) / Math.max(1e-6, step) - 0.5
  return clamp(raw, viewStart, viewStart + viewCount - 1)
}
/**
 * 默认视窗：让图上能看到「最近一个交易日」的完整走势。
 *
 * 1m 一天 240 根、5m 48 根、日线 1 根，所以不能固定写死根数：
 *   - 日线：看最近 60 个交易日
 *   - 分钟级：最近一个交易日 + 前面 20 根做上下文（避免开盘就断了）
 * 早盘刚开、今天只有几根时，会自动把上一个交易日也算进来。
 *
 * @param {Array<{t:string}>} history 历史 bar（按时间升序，最后一个是 anchor）
 * @param {number} nPred 预测根数
 * @param {string} scale 周期
 * @returns {{start:number,count:number}} 视窗；count=0 表示全部
 */
export function sessionView(history, nPred, scale, { dailyBars = 60, contextBars = 20 } = {}) {
  const nHist = Array.isArray(history) ? history.length : 0
  const total = nHist + (Number.isFinite(nPred) ? nPred : 0)
  if (nHist === 0) return { start: 0, count: 0 }

  let historyShow
  if (scale === '1d') {
    historyShow = Math.min(nHist, dailyBars)
  } else {
    // 数出「最后一个交易日」有多少根
    const lastDay = String(history[nHist - 1].t ?? '').slice(0, 10)
    let todayBars = 0
    for (let i = nHist - 1; i >= 0; i -= 1) {
      if (String(history[i].t ?? '').slice(0, 10) !== lastDay) break
      todayBars += 1
    }
    // 今天太短（刚开盘）就把上一交易日并进来
    if (todayBars < 30 && todayBars < nHist) {
      let prevDay = null
      for (let i = nHist - todayBars - 1; i >= 0; i -= 1) {
        const day = String(history[i].t ?? '').slice(0, 10)
        if (prevDay === null) prevDay = day
        if (day !== prevDay) break
        todayBars += 1
      }
    }
    historyShow = Math.min(nHist, todayBars + contextBars)
  }

  const count = Math.min(total, historyShow + (Number.isFinite(nPred) ? nPred : 0))
  if (count >= total) return { start: 0, count: 0 }
  return { start: total - count, count }
}

/** 两个视窗是否等价（用于判断用户有没有手动缩放过）。 */
export function sameView(a, b) {
  const left = a ?? { start: 0, count: 0 }
  const right = b ?? { start: 0, count: 0 }
  return left.start === right.start && left.count === right.count
}
