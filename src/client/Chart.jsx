import React from 'react'
import { indexAtX, normalizeView, panView, sameView, sessionView, tailView, visibleCount, zoomView } from './view.js'

const h = React.createElement

/**
 * K 线预测图（Canvas 绘制）。
 *
 * 左半是已收盘的历史 K 线，右半是 KiT 采样的预测：
 *   - 深色带：q25–q75 分位区间
 *   - 浅色带：q05–q95 分位区间
 *   - 虚线：预测收盘中位数
 *   - 蜡烛：中位数路径的单根 OHLC
 *
 * 交互：
 *   - 滚轮缩放（以光标下的那根 bar 为锚点）
 *   - 拖拽平移 / 悬停看数值
 *   - 右上角有放大 / 缩小 / 复位 / 跳到预测起点四个按钮
 */

const UP = '#e04a4a'
const DOWN = '#22a06b'
const PRED = '#3b82f6'
const PAST = '#f0a44a'      // 历史预测（对比用）
const ACTUAL = '#e8e8e8'    // 已实现的真实收盘
const GRID = 'rgba(127,127,127,0.16)'
const TEXT = 'rgba(127,127,127,0.95)'

function fmtPrice(value) {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) >= 1000) return value.toFixed(1)
  if (Math.abs(value) >= 100) return value.toFixed(2)
  return value.toFixed(3)
}

function fmtTime(label) {
  if (!label) return ''
  // '2026-11-18 15:00:00' -> '11-18 15:00' 或日线 '11-18'
  const date = label.slice(5, 10)
  const time = label.slice(11, 16)
  return time === '15:00' && label.length > 10 ? date : `${date} ${time}`
}

function fmtTimeFull(label) {
  if (!label) return ''
  const date = label.slice(5, 10)
  const time = label.slice(11, 16)
  return time === '15:00' && label.length > 10 ? date : `${date} ${time}`
}

function fmtVolume(value) {
  if (!Number.isFinite(value)) return '-'
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`
  return value.toFixed(0)
}

export function ForecastChart({
  data, height = 320, overlays = null, livePrice = null, liveCandle = null,
  // 预测发出后真实走出来的 bar（按时间戳对齐到预测窗口上）
  realizedBars = null,
  // AI 修正后的路径（虚线，按时间戳对齐）
  refined = null,
}) {
  const canvasRef = React.useRef(null)
  const wrapRef = React.useRef(null)
  const [hover, setHover] = React.useState(null)
  const [hoverPos, setHoverPos] = React.useState({ x: 0, y: 0 })
  const [drag, setDrag] = React.useState(null)

  // 视窗：{ start, count }。count=0 表示「全部显示」（默认）
  const [view, setView] = React.useState({ start: 0, count: 0 })

  // 绘制时把几何信息记下来，供滚轮/拖拽把像素换算成 bar 下标
  const geomRef = React.useRef({ step: 1, plotLeft: 0, plotWidth: 0, viewStart: 0, viewCount: 1, total: 1 })

  // 换股票 / 换周期 / 出新预测时，把视窗重置成「最近一个交易日」。
  //
  // 注意：不能依赖 data.asOf —— 预览态每 10~15 秒重载一次行情、asOf 就会变，
  // 视窗会被反复重置回默认位置，用户拖拽/缩放的结果立刻被吃掉
  //（表现为「能放大但不能拖动」）。
  // 所以只在「股票或周期变了」或「来了一份新的预测结果」时复位。
  const resetKey = [
    data?.code ?? '',
    data?.scale ?? '',
    // 只有预测结果才带 nPaths>0；预览数据不参与，避免每次刷新都复位
    (data?.nPaths ?? 0) > 0 ? data?.asOf ?? '' : '',
  ].join('|')
  React.useEffect(() => {
    setView(sessionView(data?.history ?? [], data?.pathMedian?.length ?? 0, data?.scale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !data) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    const width = wrap.clientWidth
    const heightPx = height
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(heightPx * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${heightPx}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, heightPx)

    const history = data.history ?? []
    const close = data.bands?.close
    const median = data.pathMedian ?? []
    // 不在这里截断：Host 已按周期给足「一整个交易日」的历史
    const nHist = history.length
    const hist = history
    const nPred = median.length
    // nPred 可以是 0：那是「只画行情、还没预测」的预览态
    if (nHist === 0) return
    // 预测窗口的时间轴优先用 futureTimestamps（与 K 线同一套时钟）
    const predTimes = (data.futureTimestamps?.length === nPred)
      ? data.futureTimestamps
      : median.map((bar) => bar.t)
    // 预判发出后已经走出来的真实 K 线：按时间戳贴到预测窗口的格子上，
    // 这样图表会随着行情推进一根根长出来，而不是冻结在预测那一刻。
    const realizedByTime = new Map()
    for (const bar of realizedBars ?? []) realizedByTime.set(bar.t, bar)
    const labels = [...hist.map((b) => b.t), ...predTimes]
    const total = nHist + nPred

    // ---- 视窗换算 --------------------------------------------------------
    const normalized = normalizeView(view, total)
    const viewCount = normalized.count || total
    const viewStart = normalized.start

    const padLeft = 8
    const padRight = 66
    const padTop = 12
    const volH = Math.round(heightPx * 0.16)
    const axisH = 18
    const plotH = heightPx - padTop - volH - axisH - 6
    const plotW = width - padLeft - padRight
    const step = plotW / viewCount
    const candleW = Math.max(1.2, Math.min(9, step * 0.62))

    // 只在视窗内的下标参与绘制
    const inView = (i) => i >= viewStart - 0.5 && i <= viewStart + viewCount - 0.5
    const xOf = (index) => padLeft + (index - viewStart + 0.5) * step

    geomRef.current = { step, plotLeft: padLeft, plotWidth: plotW, viewStart, viewCount, total }

    // ---- 价格范围（只按视窗内的数据算，放大后纵向也跟着放大）--------------
    const lows = []
    const highs = []
    hist.forEach((bar, i) => {
      if (!inView(i)) return
      lows.push(bar.l)
      highs.push(bar.h)
    })
    for (let i = 0; i < nPred; i += 1) {
      if (!inView(nHist + i)) continue
      const lo = data.bands?.low?.q05?.[i]
      const hi = data.bands?.high?.q95?.[i]
      if (Number.isFinite(lo)) lows.push(lo)
      if (Number.isFinite(hi)) highs.push(hi)
      const real = realizedByTime.get(predTimes[i])
      if (real) { lows.push(real.l); highs.push(real.h) }
    }
    for (const overlay of overlays ?? []) {
      for (const point of overlay.points ?? []) {
        const idx = labels.indexOf(point.t)
        if (idx < 0 || !inView(idx)) continue
        for (const key of ['q05', 'q95', 'q50']) {
          if (Number.isFinite(point[key])) { lows.push(point[key]); highs.push(point[key]) }
        }
        if (Number.isFinite(point.actual)) { lows.push(point.actual); highs.push(point.actual) }
      }
    }
    if (Number.isFinite(livePrice)) { lows.push(livePrice); highs.push(livePrice) }
    if (liveCandle) {
      for (const key of ['o', 'h', 'l', 'c']) {
        if (Number.isFinite(liveCandle[key])) { lows.push(liveCandle[key]); highs.push(liveCandle[key]) }
      }
    }
    let min = Math.min(...lows)
    let max = Math.max(...highs)
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      min = (min || 1) * 0.98
      max = (max || 1) * 1.02
    }
    const span = max - min
    min -= span * 0.06
    max += span * 0.06
    const yOf = (price) => padTop + ((max - price) / (max - min)) * plotH

    // ---- 网格 + 价格轴 ---------------------------------------------------
    ctx.font = '10px ui-sans-serif, -apple-system, "PingFang SC", sans-serif'
    ctx.fillStyle = TEXT
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i += 1) {
      const price = min + ((max - min) * i) / 4
      const y = yOf(price)
      ctx.beginPath()
      ctx.moveTo(padLeft, y)
      ctx.lineTo(padLeft + plotW, y)
      ctx.stroke()
      ctx.fillText(fmtPrice(price), padLeft + plotW + 6, y + 3)
    }

    // 以下绘制都裁剪到绘图区内，放大后不会溢出到坐标轴
    ctx.save()
    ctx.beginPath()
    ctx.rect(padLeft, padTop, plotW, plotH)
    ctx.clip()

    // ---- 预测分位带 ------------------------------------------------------
    const basePrice = hist[hist.length - 1].c
    const bandIndexes = []
    for (let i = 0; i < nPred; i += 1) bandIndexes.push(nHist + i)
    const bandX = [xOf(nHist - 1), ...bandIndexes.map((i) => xOf(i))]
    const bandY = (arr) => [yOf(basePrice), ...arr.map((v) => yOf(v))]

    const paintBand = (upper, lower, color) => {
      ctx.beginPath()
      bandX.forEach((x, i) => (i === 0 ? ctx.moveTo(x, bandY(upper)[i]) : ctx.lineTo(x, bandY(upper)[i])))
      for (let i = lower.length; i >= 0; i -= 1) ctx.lineTo(bandX[i], bandY(lower)[i])
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }
    if (close) {
      paintBand(close.q95, close.q05, 'rgba(59,130,246,0.13)')
      paintBand(close.q75, close.q25, 'rgba(59,130,246,0.20)')
    }

    // ---- 蜡烛 ------------------------------------------------------------
    // 每根不足 2.2px 才退化成收盘价折线：再密蜡烛就糊成一片了。
    // 完整一天（240 根）在常规窗口宽度下约 2.8px/根，仍然画蜡烛。
    const dense = step < 2.2

    const drawCandle = (index, bar, color, alpha = 1, dx = 0, widthScale = 1) => {
      const x = xOf(index) + dx
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, yOf(bar.h))
      ctx.lineTo(x, yOf(bar.l))
      ctx.stroke()
      const top = yOf(Math.max(bar.o, bar.c))
      const bottom = yOf(Math.min(bar.o, bar.c))
      const w = Math.max(1, candleW * widthScale)
      ctx.fillRect(x - w / 2, top, w, Math.max(1, bottom - top))
      ctx.globalAlpha = 1
    }

    if (dense) {
      // 收盘价折线：密集时反而比蜡烛更能看清一天的形状
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(150,150,150,0.85)'
      ctx.lineWidth = 1
      let started = false
      hist.forEach((bar, i) => {
        if (!inView(i)) return
        const x = xOf(i)
        const y = yOf(bar.c)
        if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else {
      hist.forEach((bar, i) => {
        if (!inView(i)) return
        drawCandle(i, bar, bar.c >= bar.o ? UP : DOWN, 0.45)
      })
    }
    // 有真实 bar 时，预测蜡烛缩窄左移、真实蜡烛右移，两个并排才看得出差异
    const paired = realizedByTime.size > 0 && candleW >= 3
    const pairOffset = paired ? candleW * 0.26 : 0
    median.forEach((bar, i) => {
      if (!inView(nHist + i)) return
      drawCandle(nHist + i, bar, bar.c >= bar.o ? PRED : '#8b5cf6', 0.9,
        paired ? -pairOffset : 0, paired ? 0.62 : 1)
    })

    // AI 修正路径：虚线叠在预测中位线上
    if (Array.isArray(refined) && refined.length > 0 && nPred > 0) {
      const byTime = new Map(refined.map((p) => [p.t, p.c]))
      ctx.save()
      ctx.beginPath()
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = 'rgba(245,158,11,0.95)'
      ctx.lineWidth = 1.6
      let started = false
      for (let i = 0; i < nPred; i += 1) {
        const value = byTime.get(predTimes[i])
        if (!Number.isFinite(value) || !inView(nHist + i)) continue
        const x = xOf(nHist + i)
        const y = yOf(value)
        if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()
    }

    // 已实现的真实 K 线
    if (realizedByTime.size > 0) {
      for (let i = 0; i < nPred; i += 1) {
        const real = realizedByTime.get(predTimes[i])
        if (!real || !inView(nHist + i)) continue
        drawCandle(nHist + i, real, real.c >= real.o ? UP : DOWN, 0.95,
          paired ? pairOffset : 0, paired ? 0.62 : 0.9)
      }
    }

    // ---- 中位收盘虚线 ----------------------------------------------------
    if (close) {
      ctx.beginPath()
      ctx.strokeStyle = PRED
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 3])
      let started = false
      for (let i = 0; i < nPred; i += 1) {
        const idx = nHist + i
        if (!inView(idx)) continue
        const x = xOf(idx)
        const y = yOf(close.q50[i])
        if (!started) {
          ctx.moveTo(started ? x : xOf(nHist - 1), started ? y : yOf(basePrice))
          if (!started) ctx.lineTo(x, y)
          started = true
        } else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ---- 未收盘的那根 K 线 ----------------------------------------------
    if (liveCandle && Number.isFinite(liveCandle.c)) {
      const x = xOf(nHist - 1) + step * 0.5
      const color = liveCandle.c >= liveCandle.o ? UP : DOWN
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, yOf(liveCandle.h))
      ctx.lineTo(x, yOf(liveCandle.l))
      ctx.stroke()
      const top = yOf(Math.max(liveCandle.o, liveCandle.c))
      const bottom = yOf(Math.min(liveCandle.o, liveCandle.c))
      const w = Math.max(2, candleW * 0.7)
      ctx.fillRect(x - w / 2, top, w, Math.max(1, bottom - top))
      ctx.restore()
      ctx.save()
      ctx.setLineDash([2, 2])
      ctx.strokeStyle = 'rgba(127,127,127,0.35)'
      ctx.beginPath()
      ctx.moveTo(x, padTop)
      ctx.lineTo(x, padTop + plotH)
      ctx.stroke()
      ctx.restore()
    }

    // ---- 现价线 ----------------------------------------------------------
    if (Number.isFinite(livePrice)) {
      const y = yOf(livePrice)
      if (y >= padTop && y <= padTop + plotH) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(120,200,255,0.55)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.moveTo(padLeft, y)
        ctx.lineTo(padLeft + plotW, y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // ---- 历史预测对比 ----------------------------------------------------
    if (overlays && overlays.length > 0) {
      const timeToIndex = new Map()
      labels.forEach((t, i) => timeToIndex.set(t, i))
      overlays.slice(0, 3).forEach((overlay, oi) => {
        const alpha = 0.85 - oi * 0.22
        const pts = (overlay.points ?? [])
          .map((point) => ({ ...point, x: timeToIndex.get(point.t) }))
          .filter((point) => point.x !== undefined && inView(point.x))
        if (pts.length === 0) return

        const realizedRatio = overlay.verify ? overlay.verify.realizedBars / overlay.verify.totalBars : 0
        const band = oi === 0 && realizedRatio >= 0.25
          ? pts.filter((point) => Number.isFinite(point.q05) && Number.isFinite(point.q95))
          : []
        if (band.length > 1) {
          ctx.beginPath()
          band.forEach((point, i) => (i === 0 ? ctx.moveTo(xOf(point.x), yOf(point.q95)) : ctx.lineTo(xOf(point.x), yOf(point.q95))))
          for (let i = band.length - 1; i >= 0; i -= 1) ctx.lineTo(xOf(band[i].x), yOf(band[i].q05))
          ctx.closePath()
          ctx.fillStyle = `rgba(240,164,74,${0.06 * (1 - oi * 0.3)})`
          ctx.fill()
        }

        ctx.beginPath()
        ctx.strokeStyle = `rgba(240,164,74,${alpha})`
        ctx.lineWidth = oi === 0 ? 1.4 : 1
        ctx.setLineDash(oi === 0 ? [5, 3] : [3, 3])
        let started = false
        for (const point of pts) {
          if (!Number.isFinite(point.q50)) continue
          const x = xOf(point.x)
          const y = yOf(point.q50)
          if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])

        for (const point of pts) {
          if (!Number.isFinite(point.actual)) continue
          ctx.beginPath()
          ctx.arc(xOf(point.x), yOf(point.actual), Math.min(2.4, Math.max(1.4, step * 0.18)), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(232,232,232,${0.55 + 0.3 * (1 - oi * 0.3)})`
          ctx.fill()
        }
      })
    }
    ctx.restore()

    // ---- 分界线与轴标签（画在裁剪之外，避免被切）------------------------
    if (nPred > 0 && (inView(nHist) || inView(nHist - 1))) {
      const divideX = padLeft + (nHist - viewStart) * step
      if (divideX > padLeft && divideX < padLeft + plotW) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(127,127,127,0.55)'
        ctx.setLineDash([3, 3])
        ctx.moveTo(divideX, padTop)
        ctx.lineTo(divideX, padTop + plotH)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = TEXT
        ctx.fillText('预测', divideX + 4, padTop + 10)
      }
    }

    // 现价标签（在轴外侧，不被裁剪）
    if (Number.isFinite(livePrice)) {
      const y = yOf(livePrice)
      if (y >= padTop && y <= padTop + plotH) {
        ctx.fillStyle = 'rgba(120,200,255,0.95)'
        ctx.fillRect(padLeft + plotW + 2, y - 8, padRight - 6, 16)
        ctx.fillStyle = '#0b1220'
        ctx.fillText(fmtPrice(livePrice), padLeft + plotW + 6, y + 3)
      }
    }

    // ---- 成交量 ----------------------------------------------------------
    const volTop = padTop + plotH + 8
    const vMax = Math.max(
      1,
      ...hist.map((b) => (inView(hist.indexOf(b)) ? b.v : 0)),
      ...(data.bands?.volume?.q50 ?? []).map((v) => v * 1.1),
    )
    const vBarW = Math.max(1, candleW * 0.8)
    hist.forEach((bar, i) => {
      if (!inView(i)) return
      const x = xOf(i)
      const hgt = (bar.v / vMax) * volH
      ctx.fillStyle = bar.c >= bar.o ? 'rgba(224,74,74,0.35)' : 'rgba(34,160,107,0.35)'
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt)
    })
    ;(data.bands?.volume?.q50 ?? []).forEach((v, i) => {
      if (!inView(nHist + i)) return
      const real = realizedByTime.get(predTimes[i])
      const x = xOf(nHist + i)
      const value = real ? real.v : v
      const hgt = (value / vMax) * volH
      ctx.fillStyle = real
        ? (real.c >= real.o ? 'rgba(224,74,74,0.5)' : 'rgba(34,160,107,0.5)')
        : 'rgba(59,130,246,0.55)'
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt)
    })

    // ---- 时间轴 ----------------------------------------------------------
    const labelCount = Math.max(2, Math.min(7, Math.floor(plotW / 84)))
    ctx.fillStyle = TEXT
    for (let i = 0; i < labelCount; i += 1) {
      const index = viewStart + Math.round((i * (viewCount - 1)) / (labelCount - 1))
      const text = fmtTime(labels[index])
      const x = xOf(index)
      const w = ctx.measureText(text).width
      ctx.fillText(text, Math.min(Math.max(x - w / 2, padLeft), padLeft + plotW - w), heightPx - 5)
    }

    // ---- 悬浮十字线 ------------------------------------------------------
    if (hover !== null) {
      const index = Math.round(indexAtX({ plotLeft: padLeft, step, viewStart, viewCount }, hoverPos.x))
      const x = xOf(index)
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(127,127,127,0.5)'
      ctx.setLineDash([2, 2])
      ctx.moveTo(x, padTop)
      ctx.lineTo(x, volTop + volH)
      ctx.stroke()
      ctx.setLineDash([])
      if (hoverPos.y >= padTop && hoverPos.y <= padTop + plotH) {
        ctx.beginPath()
        ctx.moveTo(padLeft, hoverPos.y)
        ctx.lineTo(padLeft + plotW, hoverPos.y)
        ctx.stroke()
        const price = min + ((max - min) * (1 - (hoverPos.y - padTop) / plotH))
        ctx.fillStyle = 'rgba(127,127,127,0.9)'
        ctx.fillRect(padLeft + plotW + 2, hoverPos.y - 8, padRight - 6, 16)
        ctx.fillStyle = '#fff'
        ctx.fillText(fmtPrice(price), padLeft + plotW + 6, hoverPos.y + 3)
      }
    }
    // 注意：livePrice / overlays / liveCandle / view 都必须进依赖，否则画布不重绘
  }, [data, height, hover, hoverPos, overlays, livePrice, liveCandle, realizedBars, refined, view])

  React.useEffect(() => {
    draw()
    const wrap = wrapRef.current
    if (!wrap) return undefined
    const observer = new ResizeObserver(() => draw())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [draw])

  // ---- 缩放 --------------------------------------------------------------

  const zoomBy = (factor) => {
    const { total } = geomRef.current
    setView((current) => zoomView(current, total, factor))
  }

  const resetView = () => setView({ start: 0, count: 0 })

  const focusPrediction = () => {
    const { total } = geomRef.current
    const nPred = (data?.pathMedian ?? []).length
    setView(tailView(total, Math.max(nPred * 2, 40)))
  }

  const onWheel = (event) => {
    if (!data) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const geom = geomRef.current
    const cursorIndex = indexAtX(geom, event.clientX - rect.left)
    const factor = event.deltaY < 0 ? 0.82 : 1.22
    setView((current) => zoomView(current, geom.total, factor, cursorIndex))
  }

  // ---- 拖拽平移 ----------------------------------------------------------
  // 拖动过程中指针很容易移出 canvas（甚至移出面板），所以 mousemove / mouseup
  // 挂在 window 上。之前只挂在 canvas 上，指针一出界就丢掉 drag 状态，
  // 表现为「拖一下就停、几乎划不动」。
  const dragRef = React.useRef(null)
  dragRef.current = drag

  const onMouseDown = (event) => {
    if (event.button !== 0) return
    const { viewStart, viewCount, step } = geomRef.current
    // 全览状态没有可平移的空间，直接不进入拖拽（避免误判为「拖不动」）
    if (!viewCount || viewCount >= geomRef.current.total) return
    event.preventDefault()
    setDrag({ x: event.clientX, start: viewStart, step, moved: false })
  }

  React.useEffect(() => {
    if (!drag) return undefined
    const move = (event) => {
      const state = dragRef.current
      if (!state) return
      const { total, viewCount, step } = geomRef.current
      const dx = event.clientX - state.x
      if (!state.moved && Math.abs(dx) < 3) return
      if (!state.moved) state.moved = true
      const shift = Math.round(-dx / Math.max(0.5, step))
      setView({
        start: panView({ start: state.start, count: viewCount }, total, shift).start,
        count: viewCount,
      })
    }
    const up = () => setDrag(null)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [drag])

  const onMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    if (hover === null) setHover(0)
  }

  const onLeave = () => setHover(null)

  // ---- 悬停信息 ----------------------------------------------------------
  // 悬停下标直接从当前几何推算：之前读 canvas.dataset.index 会滞后一帧，
  // 悬停面板显示的是「上一个鼠标位置」的数据。
  let tip = null
  if (hover !== null && data) {
    const index = Math.round(indexAtX(geomRef.current, hoverPos.x))
    const nHist = data.history?.length ?? 0
    const hist = data.history ?? []
    if (index < nHist) {
      const bar = hist[index]
      const prev = index > 0 ? hist[index - 1] : null
      if (bar) {
        const change = prev && prev.c > 0 ? (bar.c / prev.c - 1) : null
        tip = {
          kind: '历史',
          label: fmtTimeFull(bar.t),
          rows: [
            ['开', fmtPrice(bar.o)],
            ['高', fmtPrice(bar.h)],
            ['低', fmtPrice(bar.l)],
            ['收', fmtPrice(bar.c)],
            ['涨跌', change === null ? '-' : `${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%`, change === null ? null : change >= 0 ? 'up' : 'down'],
            ['量', fmtVolume(bar.v)],
          ],
        }
      }
    } else {
      const i = index - nHist
      const bar = data.pathMedian?.[i]
      const q = data.bands?.close
      if (bar) {
        const base = hist[hist.length - 1]?.c
        const rel = base ? (bar.c / base - 1) : null
        tip = {
          kind: '预测',
          label: fmtTimeFull(bar.t),
          rows: [
            ['中位', fmtPrice(q?.q50?.[i])],
            ['相对现价', rel === null ? '-' : `${rel >= 0 ? '+' : ''}${(rel * 100).toFixed(2)}%`, rel === null ? null : rel >= 0 ? 'up' : 'down'],
            ['q05', fmtPrice(q?.q05?.[i])],
            ['q25', fmtPrice(q?.q25?.[i])],
            ['q75', fmtPrice(q?.q75?.[i])],
            ['q95', fmtPrice(q?.q95?.[i])],
          ],
        }
      }
    }
  }

  const total = (data?.history?.length ?? 0) + (data?.pathMedian?.length ?? 0)
  const shown = visibleCount(view, total)
  const auto = sessionView(data?.history ?? [], data?.pathMedian?.length ?? 0, data?.scale)
  const zoomed = !sameView(view, auto)

  // 浮层跟着鼠标走，但要翻转到不越界的一侧
  const wrapWidth = wrapRef.current?.clientWidth ?? 600
  const tipLeft = tip
    ? (hoverPos.x + 180 > wrapWidth ? Math.max(8, hoverPos.x - 172) : hoverPos.x + 16)
    : 0
  const tipTop = tip ? Math.max(8, Math.min(hoverPos.y - 10, height - 172)) : 0

  return h('div', { className: `kfc-chart ${drag ? 'dragging' : ''}`, ref: wrapRef },
    h('div', { className: 'kfc-chartTools' },
      h('button', { type: 'button', title: '放大（也可以滚轮）', onClick: () => zoomBy(0.7) }, '+'),
      h('button', { type: 'button', title: '缩小（也可以滚轮）', onClick: () => zoomBy(1.4) }, '−'),
      h('button', { type: 'button', title: '看预测区间', onClick: focusPrediction, className: 'wide' }, '预测'),
      h('button', { type: 'button', title: '复位', onClick: resetView, className: 'wide' }, '全览')),
    h('canvas', {
      ref: canvasRef,
      onMouseMove,
      onMouseDown,
      onMouseLeave: onLeave,
      onWheel,
    }),
    tip
      ? h('div', {
        className: `kfc-tip kind-${tip.kind === '预测' ? 'pred' : 'hist'}`,
        style: { left: `${tipLeft}px`, top: `${tipTop}px`, right: 'auto' },
      },
        h('div', { className: 'kfc-tipHead' },
          h('span', { className: 'kfc-tipKind' }, tip.kind),
          h('span', { className: 'kfc-tipLabel' }, tip.label)),
        tip.rows.map(([label, value, tone], i) => h('div', { className: 'kfc-tipRow', key: i },
          h('span', null, label),
          h('b', { className: tone ?? '' }, value))))
      : null,
    zoomed
      ? h('div', { className: 'kfc-zoomHint' }, `已放大：显示 ${shown}/${total} 根 · 滚轮缩放 · 拖拽平移`)
      : null)
}
