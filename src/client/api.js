/** 面板与 Host 之间唯一的通道：connection 的 /api/kit-forecast 路由。 */

const BASE = 'api/kit-forecast'

async function postJson(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error?.message ?? `请求失败（HTTP ${response.status}）`)
  }
  return data
}

export function fetchStatus() {
  return postJson('/status', {})
}

export function searchStocks(keyword) {
  return postJson('/search', { keyword })
}

export function fetchQuote(code) {
  return postJson('/quote', { code })
}

export function fetchBars(code, scale, limit = 120) {
  return postJson('/bars', { code, scale, limit })
}

export function warmModel() {
  return postJson('/warm', {})
}

/** 轻量心跳：最后一根已收盘 K 线 + 盘口，用来判断要不要重算。 */
export function fetchTick(code, scale) {
  return postJson('/tick', { code, scale })
}

/** 大盘概览：主要指数报价 + 涨跌家数。 */
export function fetchMarket() {
  return postJson('/market', {})
}

/** 公告 + 新闻。任何一路失败都不影响另一路。 */
export function fetchNews(code, notices = 10, news = 10, { force = false } = {}) {
  return postJson('/news', { code, notices, news, force })
}

/** 取历史预测与真实走势的对比数据（不给 asOf 则不过滤当前 anchor）。 */
export function fetchHistory(code, scale, excludeAsOf, limit = 3) {
  return postJson('/history', { code, scale, excludeAsOf, limit })
}

/** 读取面板持久化状态（常用股票、上次预测、偏好）。 */
export function fetchState() {
  return postJson('/state', {})
}

/** 合并式写入面板状态；只需传要改的字段。 */
export function patchState(patch) {
  return postJson('/state', patch ?? {})
}

/** 彻底移除一只股票：常用列表、备注、它的历史预测、上次预测一起清。 */
export function forgetStock(code) {
  return postJson('/state', { forget: code })
}

/**
 * 消费一个 SSE 流。
 * @param {string} path
 * @param {object} body
 * @param {{signal?: AbortSignal, onEvent: (event: object) => void}} options
 */
async function consume(path, body, { signal, onEvent }) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body ?? {}),
    signal,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message ?? `请求失败（HTTP ${response.status}）`)
  }
  if (response.body === null) throw new Error('当前浏览器不支持流式响应。')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false
  while (!finished) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let separator = buffer.indexOf('\n\n')
    while (separator >= 0) {
      const block = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (raw === '' || raw === '[DONE]') continue
        let event
        try {
          event = JSON.parse(raw)
        } catch {
          continue
        }
        onEvent(event)
        if (event?.t === 'done') finished = true
      }
      separator = buffer.indexOf('\n\n')
    }
  }
  try {
    await reader.cancel()
  } catch {
    // 已经关闭
  }
}

/**
 * AI 解读：SSE 流式。
 * payload 可带 { code, scale, market, stock, forecast, news }
 */
export function runInsight(payload, options) {
  return consume('/insight', payload, options)
}

export function runForecast(payload, options) {
  return consume('/forecast', payload, options)
}

export function runSetup(payload, options) {
  return consume('/setup', payload, options)
}
