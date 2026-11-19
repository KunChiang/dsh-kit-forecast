import React from 'react'

const h = React.createElement

/**
 * K 线预测图（Canvas 绘制）。
 *
 * 左半是已收盘的历史 K 线，右半是 KiT 采样的预测：
 *   - 深色带：q25–q75 分位区间
 *   - 浅色带：q05–q95 分位区间
 *   - 虚线：预测收盘中位数
 *   - 蜡烛：中位数路径的单根 OHLC
 */

const UP = '#e04a4a'
const DOWN = '#22a06b'
const PRED = '#3b82f6'
const GRID = 'rgba(127,127,127,0.16)'
const TEXT = 'rgba(127,127,127,0.95)'

function fmtPrice(value) {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) >= 1000) return value.toFixed(0)
  if (Math.abs(value) >= 100) return value.toFixed(1)
  return value.toFixed(2)
}

function fmtTime(label) {
  if (!label) return ''
  // '2026-11-18 15:00:00' -> '11-18 15:00' 或日线 '11-18'
  const date = label.slice(5, 10)
  const time = label.slice(11, 16)
  return time === '15:00' && label.length > 10 ? date : `${date} ${time}`
}

export function ForecastChart({ data, height = 320 }) {
  const canvasRef = React.useRef(null)
  const wrapRef = React.useRef(null)
  const [hover, setHover] = React.useState(null)
  const [hoverPos, setHoverPos] = React.useState({ x: 0, y: 0 })

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
    const nHist = Math.min(history.length, 60)
    const hist = history.slice(-nHist)
    const nPred = median.length
    if (nHist === 0 || nPred === 0) return

    const padLeft = 8
    const padRight = 62
    const padTop = 12
    const volH = Math.round(heightPx * 0.16)
    const axisH = 18
    const plotH = heightPx - padTop - volH - axisH - 6
    const plotW = width - padLeft - padRight
    const total = nHist + nPred
    const step = plotW / total
    const candleW = Math.max(1.4, Math.min(9, step * 0.62))

    // 价格范围
    const lows = [...hist.map((b) => b.l), ...(data.bands?.low?.q05 ?? [])]
    const highs = [...hist.map((b) => b.h), ...(data.bands?.high?.q95 ?? [])]
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
    const xOf = (index) => padLeft + (index + 0.5) * step

    // 网格 + 价格轴
    ctx.font = '10px ui-sans-serif, -apple-system, "PingFang SC", sans-serif'
    ctx.fillStyle = TEXT
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    const ticks = 4
    for (let i = 0; i <= ticks; i += 1) {
      const price = min + ((max - min) * i) / ticks
      const y = yOf(price)
      ctx.beginPath()
      ctx.moveTo(padLeft, y)
      ctx.lineTo(padLeft + plotW, y)
      ctx.stroke()
      ctx.fillText(fmtPrice(price), padLeft + plotW + 6, y + 3)
    }

    // 预测区间（用 close 分位；区域从上一根历史收盘连起，视觉更连贯）
    const basePrice = hist[hist.length - 1].c
    const bandX = [xOf(nHist - 1), ...median.map((_, i) => xOf(nHist + i))]
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

    // 历史蜡烛
    const drawCandle = (index, bar, color, alpha = 1) => {
      const x = xOf(index)
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, yOf(bar.h))
      ctx.lineTo(x, yOf(bar.l))
      ctx.stroke()
      const top = yOf(Math.max(bar.o, bar.c))
      const bottom = yOf(Math.min(bar.o, bar.c))
      const hgt = Math.max(1, bottom - top)
      ctx.fillRect(x - candleW / 2, top, candleW, hgt)
      ctx.globalAlpha = 1
    }

    hist.forEach((bar, i) => {
      const up = bar.c >= bar.o
      drawCandle(i, bar, up ? UP : DOWN, 0.45)
    })

    // 预测蜡烛（中位数路径）
    median.forEach((bar, i) => {
      const up = bar.c >= bar.o
      drawCandle(nHist + i, bar, up ? PRED : '#8b5cf6', 0.9)
    })

    // 中位收盘虚线
    if (close) {
      ctx.beginPath()
      ctx.strokeStyle = PRED
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 3])
      close.q50.forEach((price, i) => {
        const x = xOf(nHist + i)
        const y = yOf(price)
        if (i === 0) ctx.moveTo(xOf(nHist - 1), yOf(basePrice))
        ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 分界线
    const divideX = padLeft + nHist * step
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(127,127,127,0.55)'
    ctx.setLineDash([3, 3])
    ctx.moveTo(divideX, padTop)
    ctx.lineTo(divideX, padTop + plotH)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = TEXT
    ctx.fillText('预测', divideX + 4, padTop + 10)

    // 成交量
    const volTop = padTop + plotH + 8
    const vHist = hist.map((b) => b.v)
    const vPred = (data.bands?.volume?.q50 ?? []).slice(0, nPred)
    const vMax = Math.max(...vHist, ...vPred.map((v) => v * 1.1), 1)
    const vBarW = Math.max(1, candleW * 0.8)
    hist.forEach((bar, i) => {
      const x = xOf(i)
      const hgt = (bar.v / vMax) * volH
      ctx.fillStyle = bar.c >= bar.o ? 'rgba(224,74,74,0.35)' : 'rgba(34,160,107,0.35)'
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt)
    })
    vPred.forEach((v, i) => {
      const x = xOf(nHist + i)
      const hgt = (v / vMax) * volH
      ctx.fillStyle = 'rgba(59,130,246,0.55)'
      ctx.fillRect(x - vBarW / 2, volTop + volH - hgt, vBarW, hgt)
    })

    // 时间轴
    const labels = [...hist.map((b) => b.t), ...median.map((b) => b.t)]
    const labelCount = Math.max(2, Math.min(6, Math.floor(plotW / 78)))
    ctx.fillStyle = TEXT
    for (let i = 0; i < labelCount; i += 1) {
      const index = Math.round((i * (total - 1)) / (labelCount - 1))
      const text = fmtTime(labels[index])
      const x = xOf(index)
      const w = ctx.measureText(text).width
      ctx.fillText(text, Math.min(Math.max(x - w / 2, padLeft), padLeft + plotW - w), heightPx - 5)
    }

    // 悬浮十字线
    if (hover !== null) {
      const index = Math.max(0, Math.min(total - 1, Math.round((hoverPos.x - padLeft) / step - 0.5)))
      const x = xOf(index)
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(127,127,127,0.5)'
      ctx.setLineDash([2, 2])
      ctx.moveTo(x, padTop)
      ctx.lineTo(x, volTop + volH)
      ctx.stroke()
      ctx.setLineDash([])
      const price = min + ((max - min) * (1 - (hoverPos.y - padTop) / plotH))
      if (hoverPos.y >= padTop && hoverPos.y <= padTop + plotH) {
        ctx.fillStyle = 'rgba(127,127,127,0.9)'
        ctx.fillRect(padLeft + plotW + 2, hoverPos.y - 8, padRight - 4, 16)
        ctx.fillStyle = '#fff'
        ctx.fillText(fmtPrice(price), padLeft + plotW + 6, hoverPos.y + 3)
      }
      canvas.dataset.index = String(index)
    }
  }, [data, height, hover, hoverPos])

  React.useEffect(() => {
    draw()
    const wrap = wrapRef.current
    if (!wrap) return undefined
    const observer = new ResizeObserver(() => draw())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [draw])

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    if (hover === null) setHover(0)
  }

  const onLeave = () => setHover(null)

  // 悬浮信息
  let tip = null
  if (hover !== null && data) {
    const index = Number(canvasRef.current?.dataset.index ?? 0)
    const nHist = Math.min(data.history?.length ?? 0, 60)
    if (index < nHist) {
      const bar = data.history.slice(-nHist)[index]
      if (bar) {
        tip = { label: bar.t, rows: [['开', bar.o], ['高', bar.h], ['低', bar.l], ['收', bar.c]] }
      }
    } else {
      const i = index - nHist
      const bar = data.pathMedian?.[i]
      if (bar) {
        const q = data.bands?.close
        tip = {
          label: bar.t,
          rows: [
            ['中位', q?.q50?.[i]],
            ['q25', q?.q25?.[i]],
            ['q75', q?.q75?.[i]],
            ['q05', q?.q05?.[i]],
            ['q95', q?.q95?.[i]],
          ],
        }
      }
    }
  }

  return h('div', { className: 'kfc-chart', ref: wrapRef },
    h('canvas', {
      ref: canvasRef,
      onMouseMove: onMove,
      onMouseLeave: onLeave,
    }),
    tip
      ? h('div', { className: 'kfc-tip' },
        h('div', { className: 'kfc-tipLabel' }, tip.label),
        tip.rows.map(([label, value], i) => h('div', { className: 'kfc-tipRow', key: i },
          h('span', null, label),
          h('b', null, fmtPrice(value)))))
      : null)
}