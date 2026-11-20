/**
 * A 股实时行情与多周期 K 线数据层。
 *
 * 数据源策略（按优先级自动降级，全部为公开免费接口，不需要任何账号或 token）：
 *   1. 新浪  quotes.sina.cn / money.finance.sina.com.cn  —— 1m/5m/15m/30m/60m/日线，单次最多 1500 根
 *   2. 腾讯  qt.gtimg.cn（实时盘口 + 涨跌停价）、web.ifzq.gtimg.cn（前复权日线，用于复权因子）
 *   3. 东方财富 push2his —— 作为补充源（部分网络环境会拒绝连接，故只做兜底）
 *
 * 输出统一成 KiT 的 A 股 bar 语义：
 *   - 时间戳是「该 K 线的收盘时刻」，落在 KiT 的会话网格上（9:31..11:30 / 13:01..15:00）
 *   - 日线时间戳为当日 15:00
 *   - 价格统一乘以前复权因子，和 KiT 训练数据（前复权）口径一致
 */

const SINA_KLINE = [
  'https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData',
  'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketDataService.getKLineData',
]
const SINA_QUOTE = 'https://hq.sinajs.cn/list='
const TX_QUOTE = 'https://qt.gtimg.cn/q='
const TX_DAY = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param='
const SINA_SUGGEST = 'https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key='
const EM_KLINE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
const EM_ULIST = 'https://push2.eastmoney.com/api/qt/ulist.np/get'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

/** KiT 的 A 股会话模板（分钟）：9:30-11:30、13:00-15:00。 */
const SESSIONS = [[570, 690], [780, 900]]

export const SCALES = {
  '1m': { minutes: 1, sina: 1, Lc: 1200, Lh: 120, label: '1 分钟' },
  '5m': { minutes: 5, sina: 5, Lc: 960, Lh: 96, label: '5 分钟' },
  '15m': { minutes: 15, sina: 15, Lc: 800, Lh: 64, label: '15 分钟' },
  '30m': { minutes: 30, sina: 30, Lc: 640, Lh: 40, label: '30 分钟' },
  '1h': { minutes: 60, sina: 60, Lc: 400, Lh: 20, label: '60 分钟' },
  '2h': { minutes: 120, sina: null, Lc: 360, Lh: 20, label: '120 分钟' },
  '1d': { minutes: 1440, sina: 240, Lc: 250, Lh: 20, label: '日线' },
}

/** 每个周期的 bar 收盘分钟网格，用来校验/过滤脏数据。 */
function closeMinuteGrid(scale) {
  const { minutes } = SCALES[scale]
  if (minutes >= 1440) return [[900]]
  const out = []
  for (const [start, end] of SESSIONS) {
    let m = start + minutes
    while (m < end) {
      out.push(m)
      m += minutes
    }
    out.push(end)
  }
  return out.map((m) => [m])
}

function gridSet(scale) {
  return new Set(closeMinuteGrid(scale).flat())
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function decodeGbk(buffer) {
  try {
    return new TextDecoder('gbk').decode(buffer)
  } catch {
    return Buffer.from(buffer).toString('utf8')
  }
}

async function httpText(url, { timeout = 12000, headers = {}, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          accept: '*/*',
          ...headers,
        },
        signal: controller.signal,
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = new Uint8Array(await res.arrayBuffer())
      return { text: decodeGbk(buf), bytes: buf }
    } catch (error) {
      if (attempt === retries) throw error
      await sleep(300 * (attempt + 1))
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('unreachable')
}

// ---------------------------------------------------------------------------
// 代码归一化
// ---------------------------------------------------------------------------

/**
 * A 股主要指数。
 *
 * 指数代码和个股会撞号（000001 既是上证指数也是平安银行），所以内部一律带交易所后缀，
 * 并且在解析时优先按「指数表」匹配，避免 000001 被推断成深市股票。
 */
export const INDEXES = [
  { code: '000001.SH', name: '上证指数', short: '上证', group: '综合' },
  { code: '399001.SZ', name: '深证成指', short: '深成', group: '综合' },
  { code: '399006.SZ', name: '创业板指', short: '创业板', group: '成长' },
  { code: '000688.SH', name: '科创50', short: '科创50', group: '成长' },
  { code: '000300.SH', name: '沪深300', short: '沪深300', group: '宽基' },
  { code: '000905.SH', name: '中证500', short: '中证500', group: '宽基' },
  { code: '000852.SH', name: '中证1000', short: '中证1000', group: '宽基' },
  { code: '899050.BJ', name: '北证50', short: '北证50', group: '北交所' },
]

const INDEX_BY_CODE = new Map(INDEXES.map((item) => [item.code, item]))
/** 指数没有涨跌停、也不需要复权。 */
export function isIndex(code) {
  return INDEX_BY_CODE.has(String(code ?? '').toUpperCase())
}
export function indexMeta(code) {
  return INDEX_BY_CODE.get(String(code ?? '').toUpperCase()) ?? null
}

const MARKET_OF_PREFIX = [
  [/^(60|68|69|50|51|52|56|58|11|90)/, 'SH'],
  [/^(00|30|31|12|15|16|18|20)/, 'SZ'],
  [/^(43|83|87|88|92)/, 'BJ'],
]

export function inferMarket(digits) {
  for (const [re, market] of MARKET_OF_PREFIX) if (re.test(digits)) return market
  return null
}

/** '600519' / 'sh600519' / '600519.SH' / 'SH600519' -> {code:'600519.SH', symbol:'sh600519'} */
export function normalizeCode(input) {
  const raw = String(input ?? '').trim()
  if (raw === '') return null
  const upper = raw.toUpperCase()

  let market = null
  let digits = null

  // 指数：必须带后缀才认得出来（000001.SH 上证 vs 000001.SZ 平安银行）
  if (INDEX_BY_CODE.has(upper)) {
    const [d, mk] = upper.split('.')
    return { code: upper, symbol: `${mk.toLowerCase()}${d}`, digits: d, market: mk, isIndex: true }
  }

  let m = /^(\d{6})\.(SH|SZ|BJ)$/.exec(upper)
  if (m) {
    market = m[2]
    digits = m[1]
  }
  if (!m) {
    m = /^(SH|SZ|BJ)(\d{6})$/.exec(upper)
    if (m) {
      market = m[1]
      digits = m[2]
    }
  }
  if (!m) {
    m = /^(\d{6})$/.exec(upper)
    if (m) {
      digits = m[1]
      market = inferMarket(digits)
    }
  }
  if (!digits || !market) return null
  return { code: `${digits}.${market}`, symbol: `${market.toLowerCase()}${digits}`, digits, market }
}

// ---------------------------------------------------------------------------
// 数据层
// ---------------------------------------------------------------------------

export class MarketData {
  constructor({ logger = console } = {}) {
    this.logger = logger
    this.barsCache = new Map()
    this.quoteCache = new Map()
    this.adjustCache = new Map()
    this.dayCache = new Map()
    this.tradingDayCache = { at: 0, days: [] }
    this.breadthCache = null
  }

  async search(keyword) {
    const key = String(keyword ?? '').trim()
    if (key === '') return []
    const direct = normalizeCode(key)
    if (direct) {
      const quote = await this.quote(direct.code).catch(() => null)
      return [{
        code: direct.code,
        symbol: direct.symbol,
        name: quote?.name ?? direct.digits,
        market: direct.market,
      }]
    }
    const { text } = await httpText(`${SINA_SUGGEST}${encodeURIComponent(key)}`, {
      headers: { referer: 'https://finance.sina.com.cn' },
    })
    const body = /"([^"]*)"/.exec(text)?.[1] ?? ''
    const out = []
    const SYMBOL_RE = /^(sh|sz|bj)\d{6}$/i
    for (const row of body.split(';')) {
      const parts = row.split(',').map((part) => part.trim())
      // 新浪的返回格式不固定：搜代码时第 1 列是 "sh600519"，搜名称时第 1 列是中文名
      const symbol = parts.find((part) => SYMBOL_RE.test(part))
      if (!symbol) continue
      const name = parts.find((part) => part !== '' && !SYMBOL_RE.test(part) && !/^\d{6}$/.test(part)) ?? symbol
      const norm = normalizeCode(symbol)
      if (!norm) continue
      if (!/^(SH|SZ|BJ)$/.test(norm.market)) continue
      if (out.some((item) => item.code === norm.code)) continue
      out.push({ code: norm.code, symbol: norm.symbol, name, market: norm.market })
      if (out.length >= 12) break
    }
    return out
  }

  async quote(code) {
    const norm = normalizeCode(code)
    if (!norm) throw new Error(`无法识别的股票代码：${code}`)
    const hit = this.quoteCache.get(norm.code)
    if (hit && Date.now() - hit.at < 2500) return hit.value

    let value = null
    try {
      const { text } = await httpText(`${TX_QUOTE}${norm.symbol}`, { timeout: 8000 })
      value = parseTencentQuote(text, norm)
    } catch (error) {
      this.logger.warn?.(`[kit-forecast] 腾讯行情失败：${error.message}`)
    }
    if (!value) {
      try {
        const { text } = await httpText(`${SINA_QUOTE}${norm.symbol}`, {
          timeout: 8000,
          headers: { referer: 'https://finance.sina.com.cn' },
        })
        value = parseSinaQuote(text, norm)
      } catch (error) {
        this.logger.warn?.(`[kit-forecast] 新浪行情失败：${error.message}`)
      }
    }
    if (!value) throw new Error(`${norm.code} 实时行情不可用（腾讯/新浪均失败）`)
    this.quoteCache.set(norm.code, { at: Date.now(), value })
    return value
  }

  /**
   * 批量行情：一次网络请求取多只（大盘概览用）。
   * 腾讯接口支持逗号分隔，比逐个 quote 快一个数量级。
   */
  async quotes(codes) {
    const norms = codes.map((code) => normalizeCode(code)).filter(Boolean)
    if (norms.length === 0) return []
    const key = `multi|${norms.map((n) => n.code).join(',')}`
    const hit = this.quoteCache.get(key)
    if (hit && Date.now() - hit.at < 2500) return hit.value

    const url = `${TX_QUOTE}${norms.map((n) => n.symbol).join(',')}`
    const { text } = await httpText(url, { timeout: 9000 })
    const out = []
    // 返回形如 v_sh000001="...";v_sz399001="...";
    const re = /v_([a-z]{2}\d{6})="([^"]*)"/g
    let m
    while ((m = re.exec(text)) !== null) {
      const symbol = m[1]
      const norm = norms.find((n) => n.symbol === symbol)
      if (!norm) continue
      const parsed = parseTencentQuote(`v_${symbol}="${m[2]}"`, norm)
      if (parsed) out.push(parsed)
    }
    this.quoteCache.set(key, { at: Date.now(), value: out })
    return out
  }

  /**
   * 市场宽度：涨跌家数 + 成交额。
   *
   * 用东财的 ulist 接口，直接返回每个指数的上涨/下跌/平盘家数（f104/f105/f106），
   * 比自己统计 5000 多只个股便宜得多。
   */
  async breadth() {
    const hit = this.breadthCache
    if (hit && Date.now() - hit.at < 30 * 1000) return hit.value

    const secids = '1.000001,0.399001'
    const fields = 'f2,f3,f4,f12,f14,f104,f105,f106,f124'
    const { text } = await httpText(`${EM_ULIST}?fltt=2&secids=${secids}&fields=${fields}`, {
      timeout: 9000,
      headers: { referer: 'https://quote.eastmoney.com/' },
    })
    const diff = JSON.parse(text)?.data?.diff ?? []
    const value = diff.map((row) => ({
      code: row.f12 === '000001' ? '000001.SH' : '399001.SZ',
      up: Number(row.f104) || 0,
      down: Number(row.f105) || 0,
      flat: Number(row.f106) || 0,
      at: Number(row.f124) ? Number(row.f124) * 1000 : Date.now(),
    }))
    this.breadthCache = { at: Date.now(), value }
    return value
  }

  /** 前复权因子：交易日 -> 前复权收盘 / 不复权收盘。 */
  async adjustment(code) {
    const norm = normalizeCode(code)
    const hit = this.adjustCache.get(norm.code)
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.value

    const [qfq, raw] = await Promise.all([
      this.tencentDaily(norm.symbol).catch(() => null),
      this.sinaDaily(norm).catch(() => null),
    ])
    const map = new Map()
    if (qfq && raw) {
      for (const [date, row] of raw) {
        const q = qfq.get(date)
        if (q && q.close > 0 && row.close > 0) map.set(date, q.close / row.close)
      }
    }
    const value = map
    this.adjustCache.set(norm.code, { at: Date.now(), value })
    return value
  }

  async tencentDaily(symbol) {
    const hit = this.dayCache.get(`tx:${symbol}`)
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value
    const { text } = await httpText(`${TX_DAY}${symbol},day,,,1000,qfq`, { timeout: 12000 })
    const data = JSON.parse(text)?.data?.[symbol] ?? {}
    const rows = data.qfqday ?? data.day ?? []
    const map = new Map()
    for (const row of rows) {
      // [date, open, close, high, low, volume]
      map.set(String(row[0]), {
        open: Number(row[1]),
        close: Number(row[2]),
        high: Number(row[3]),
        low: Number(row[4]),
        volume: Number(row[5]),
      })
    }
    this.dayCache.set(`tx:${symbol}`, { at: Date.now(), value: map })
    return map
  }

  async sinaDaily(norm) {
    const hit = this.dayCache.get(`sina:${norm.symbol}`)
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value
    const rows = await this.sinaKline(norm.symbol, 240, 1500)
    const map = new Map()
    for (const row of rows) {
      map.set(row.date, { open: row.o, close: row.c, high: row.h, low: row.l, volume: row.v })
    }
    this.dayCache.set(`sina:${norm.symbol}`, { at: Date.now(), value: map })
    return map
  }

  async sinaKline(symbol, scaleMinutes, count) {
    let lastError = null
    for (const base of SINA_KLINE) {
      try {
        const url = `${base}?symbol=${symbol}&scale=${scaleMinutes}&ma=no&datalen=${count}`
        const { text } = await httpText(url, {
          timeout: 15000,
          headers: { referer: 'https://finance.sina.com.cn' },
        })
        const arr = JSON.parse(text)
        if (!Array.isArray(arr)) throw new Error('返回不是数组')
        return arr
          .map((row) => {
            const date = String(row.day ?? '')
            const [d, t = '00:00:00'] = date.split(' ')
            return {
              date: d,
              time: t,
              t: t === '00:00:00' ? `${d} 15:00:00` : `${d} ${t}`,
              o: Number(row.open),
              h: Number(row.high),
              l: Number(row.low),
              c: Number(row.close),
              v: Number(row.volume),
            }
          })
          .filter((row) => Number.isFinite(row.o) && row.o > 0 && Number.isFinite(row.c) && row.c > 0)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError ?? new Error('新浪 K 线请求失败')
  }

  /**
   * 取指定周期的历史 K 线（升序）。返回 { bars, source, adjustmentApplied, droppedForming }
   */
  async bars(code, scale) {
    const norm = normalizeCode(code)
    if (!norm) throw new Error(`无法识别的股票代码：${code}`)
    if (!SCALES[scale]) throw new Error(`未知周期：${scale}`)
    const cacheKey = `${norm.code}|${scale}`
    const hit = this.barsCache.get(cacheKey)
    if (hit && Date.now() - hit.at < 20 * 1000) return hit.value

    let bars
    let source
    if (scale === '2h') {
      const hourly = await this.sinaKline(norm.symbol, 60, 1500)
      bars = aggregate(hourly, 2, 120)
      source = 'sina:60m→2h'
    } else if (scale === '1d') {
      const tx = await this.tencentDaily(norm.symbol).catch(() => null)
      if (tx && tx.size > 40) {
        bars = [...tx.entries()]
          .map(([date, row]) => ({ date, t: `${date} 15:00:00`, o: row.open, h: row.high, l: row.low, c: row.close, v: row.volume }))
          .sort((a, b) => (a.date < b.date ? -1 : 1))
        source = 'tencent:qfq-day'
      } else {
        const rows = await this.sinaKline(norm.symbol, 240, 1500)
        bars = rows.map((row) => ({ date: row.date, t: `${row.date} 15:00:00`, o: row.o, h: row.h, l: row.l, c: row.c, v: row.v }))
        source = 'sina:day'
      }
    } else {
      const rows = await this.sinaKline(norm.symbol, SCALES[scale].sina, 1500)
      bars = rows.map((row) => ({ ...row }))
      source = 'sina'
    }

    // 只保留落在 KiT 会话网格上的 bar（并去重）
    const grid = scale === '1d' ? null : gridSet(scale)
    const seen = new Set()
    bars = bars
      .filter((bar) => {
        if (seen.has(bar.t)) return false
        seen.add(bar.t)
        if (!grid) return true
        const [hh, mm] = bar.t.slice(11, 16).split(':').map(Number)
        return grid.has(hh * 60 + mm)
      })
      .sort((a, b) => (a.t < b.t ? -1 : 1))

    let adjustmentApplied = false
    // 指数没有除权，跳过复权因子（也省两次请求）
    if (scale !== '1d' && bars.length > 0 && !isIndex(norm.code)) {
      const map = await this.adjustment(norm.code).catch(() => new Map())
      if (map.size > 0) {
        const dates = [...map.keys()].sort()
        const factorFor = (date) => {
          if (map.has(date)) return map.get(date)
          let lo = 0
          let hi = dates.length - 1
          let best = null
          while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (dates[mid] <= date) {
              best = dates[mid]
              lo = mid + 1
            } else hi = mid - 1
          }
          return best ? map.get(best) : 1
        }
        bars = bars.map((bar) => {
          const f = factorFor(bar.date)
          if (f === 1) return bar
          return { ...bar, o: bar.o * f, h: bar.h * f, l: bar.l * f, c: bar.c * f }
        })
        adjustmentApplied = true
      }
    }

    const { bars: completed, dropped } = dropFormingBar(bars, scale, new Date())
    // 正在形成的那根（尚未收盘）单独留着：tick 会把它画成动态蜡烛
    const forming = dropped ? bars[bars.length - 1] : null
    const value = {
      code: norm.code,
      name: indexMeta(norm.code)?.name,
      isIndex: isIndex(norm.code),
      symbol: norm.symbol, scale,
      bars: completed, forming, source, adjustmentApplied, droppedForming: dropped,
    }
    this.barsCache.set(cacheKey, { at: Date.now(), value })
    return value
  }

  async tradingDays() {
    if (Date.now() - this.tradingDayCache.at < 6 * 60 * 60 * 1000 && this.tradingDayCache.days.length) {
      return this.tradingDayCache.days
    }
    const rows = await this.sinaKline('sh000001', 240, 1500)
    const days = rows.map((row) => row.date).sort()
    this.tradingDayCache = { at: Date.now(), days }
    return days
  }
}

/** 把 N 根 1h bar 聚合成一根 2h（A 股：11:30 与 15:00 各一根）。 */
function aggregate(rows, groupSize, minutes) {
  const byDate = new Map()
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, [])
    byDate.get(row.date).push(row)
  }
  const out = []
  for (const [date, list] of byDate) {
    list.sort((a, b) => (a.time < b.time ? -1 : 1))
    for (let i = 0; i < list.length; i += groupSize) {
      const group = list.slice(i, i + groupSize)
      if (group.length < groupSize) continue
      out.push({
        date,
        time: group[group.length - 1].time,
        t: `${date} ${group[group.length - 1].time}`,
        o: group[0].o,
        h: Math.max(...group.map((g) => g.h)),
        l: Math.min(...group.map((g) => g.l)),
        c: group[group.length - 1].c,
        v: group.reduce((sum, g) => sum + (Number.isFinite(g.v) ? g.v : 0), 0),
      })
    }
  }
  return out.sort((a, b) => (a.t < b.t ? -1 : 1))
}

/** 收盘后的宽限期：避免在收盘瞬间拿到还没定稿的数值。 */
const CLOSE_GRACE_MS = 5000

/**
 * 丢掉还没走完的 K 线：模型只吃「已收盘」的 bar。
 *
 * 数据源会用「本区间的收盘时刻」给还没走完的 bar 打时间戳，所以判据是
 * 收盘时刻是否已经过去（+几秒宽限）。不能简单地用「当前时间 < 收盘时刻 + 一个周期」——
 * 午休（11:30 → 13:00）和 2h 周期的间隔比周期本身长，那样会把已收盘的 bar 误删。
 */
export function dropFormingBar(bars, scale, now = new Date()) {
  if (bars.length === 0) return { bars: [], dropped: false }
  const kept = bars.filter((bar) => {
    const closeAt = parseBeijing(bar.t)
    return closeAt !== null && now.getTime() >= closeAt.getTime() + CLOSE_GRACE_MS
  })
  return { bars: kept, dropped: kept.length !== bars.length }
}

/** 'YYYY-MM-DD HH:mm:ss'（北京时间）-> Date */
export function parseBeijing(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(text))
  if (!m) return null
  const [, y, mo, d, h, mi, s = '0'] = m
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - 8, Number(mi), Number(s)))
}

function parseTencentQuote(text, norm) {
  const m = /v_[a-z]{2}\d{6}="([^"]*)"/.exec(text)
  if (!m) return null
  const f = m[1].split('~')
  if (f.length < 40) return null
  const num = (i) => {
    const v = Number(f[i])
    return Number.isFinite(v) ? v : null
  }
  return {
    code: norm.code,
    name: f[1] || norm.digits,
    price: num(3),
    prevClose: num(4),
    open: num(5),
    high: num(33),
    low: num(34),
    volume: num(36),
    amount: num(37),
    changePercent: num(32),
    time: f[30] ?? null,
    limitUp: num(47),
    limitDown: num(48),
    source: 'tencent',
  }
}

function parseSinaQuote(text, norm) {
  const m = /"([^"]*)"/.exec(text)
  if (!m) return null
  const f = m[1].split(',')
  if (f.length < 32) return null
  const num = (i) => {
    const v = Number(f[i])
    return Number.isFinite(v) ? v : null
  }
  return {
    code: norm.code,
    name: f[0] || norm.digits,
    open: num(1),
    prevClose: num(2),
    price: num(3),
    high: num(4),
    low: num(5),
    volume: num(8),
    amount: num(9),
    changePercent: num(2) && num(3) ? ((num(3) - num(2)) / num(2)) * 100 : null,
    time: `${f[30]} ${f[31]}`,
    limitUp: null,
    limitDown: null,
    source: 'sina',
  }
}
