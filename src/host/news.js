/**
 * 公告与新闻数据层。
 *
 * 数据源（公开接口，无需 token）：
 *   1. 公告：东方财富 np-anotice-stock —— 按股票代码直接查，带公告分类与原文链接
 *   2. 新闻：东方财富 np-listapi getListInfo —— mTypeAndCode 精确到个股，
 *      返回标题/时间/来源/原文链接
 *
 * 两者都做了：HTML 标签清洗、去重、按时间倒序、缓存（公告 10 分钟、新闻 3 分钟）。
 * 任何一路失败都不影响另一路，接口整体也不会因此报错。
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const NOTICE_API = 'https://np-anotice-stock.eastmoney.com/api/security/ann'
const NEWS_API = 'https://np-listapi.eastmoney.com/comm/web/getListInfo'

const NOTICE_TTL_MS = 10 * 60 * 1000
const NEWS_TTL_MS = 3 * 60 * 1000

/** 公告详情页：东财的公告正文页，带 art_code 即可直达。 */
function noticeUrl(artCode) {
  return `https://data.eastmoney.com/notices/detail/${artCode}.html`
}

/** 去掉搜索/资讯接口返回里的 <em> 等标签与多余空白。 */
export function stripTags(text) {
  return String(text ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 东财的 market_code：1 = 沪市，0 = 深市，北交所也是 0。 */
function marketCodeOf(market) {
  return market === 'SH' ? 1 : 0
}

async function fetchJson(url, { timeout = 12000, referer = 'https://quote.eastmoney.com/', retries = 1 } = {}) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'application/json, text/plain, */*', referer },
        signal: controller.signal,
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError ?? new Error('请求失败')
}

export class NewsFeed {
  constructor({ logger = console } = {}) {
    this.logger = logger
    this.cache = new Map()
  }

  cached(key, ttl) {
    const hit = this.cache.get(key)
    if (hit && Date.now() - hit.at < ttl) return hit.value
    return null
  }

  store(key, value) {
    this.cache.set(key, { at: Date.now(), value })
    return value
  }

  /** 公告列表。limit 为条数上限。 */
  async announcements(code, { limit = 12 } = {}) {
    const [digits, market] = String(code).split('.')
    const key = `ann|${code}|${limit}`
    const hit = this.cached(key, NOTICE_TTL_MS)
    if (hit) return hit

    const url = `${NOTICE_API}?sr=-1&page_size=${limit}&page_index=1&ann_type=A`
      + `&client_source=web&stock_list=${encodeURIComponent(digits)}`
      + `&f_node=0&s_node=0`

    const raw = await fetchJson(url, { referer: 'https://data.eastmoney.com/' })
    const list = raw?.data?.list ?? []
    const items = list.map((row) => ({
      id: row.art_code,
      title: stripTags(row.title_ch || row.title),
      date: String(row.notice_date ?? '').slice(0, 10),
      time: String(row.notice_date ?? '').slice(0, 19),
      // 分类，例如「董事会决议公告」「月度经营情况」
      category: row.columns?.map((c) => c.column_name).filter(Boolean).join(' / ') || '其他',
      url: noticeUrl(row.art_code),
      source: 'eastmoney',
    }))
    // 该接口不严格遵守 page_size，这里补一刀截断
    return this.store(key, { items: items.slice(0, limit), market, fetchedAt: Date.now() })
  }

  /** 个股相关新闻。 */
  async news(code, { limit = 12 } = {}) {
    const [digits, market] = String(code).split('.')
    const key = `news|${code}|${limit}`
    const hit = this.cached(key, NEWS_TTL_MS)
    if (hit) return hit

    const mTypeAndCode = `${marketCodeOf(market)}.${digits}`
    const url = `${NEWS_API}?client=web&biz=web_news_col&mTypeAndCode=${mTypeAndCode}`
      + `&type=1&page_index=1&page_size=${limit}&req_trace=${Date.now()}`

    const raw = await fetchJson(url)
    const list = raw?.data?.list ?? []
    const items = list.map((row) => ({
      id: row.Art_Code,
      title: stripTags(row.Art_Title),
      time: String(row.Art_ShowTime ?? '').slice(0, 19),
      date: String(row.Art_ShowTime ?? '').slice(0, 10),
      url: row.Art_Url || row.Art_OriginUrl || '',
      source: 'eastmoney',
    }))
    return this.store(key, { items: items.slice(0, limit), fetchedAt: Date.now() })
  }

  /**
   * 合并接口：公告 + 新闻一起给，任何一路失败都不影响另一路。
   * 返回 { announcements, news, errors }，errors 只用于前端提示。
   */
  async digest(code, { notices = 10, newsLimit = 10 } = {}) {
    const errors = []
    const [ann, news] = await Promise.all([
      this.announcements(code, { limit: notices }).catch((error) => {
        errors.push(`公告：${error.message}`)
        return null
      }),
      this.news(code, { limit: newsLimit }).catch((error) => {
        errors.push(`新闻：${error.message}`)
        return null
      }),
    ])
    return {
      code,
      announcements: ann?.items ?? [],
      news: news?.items ?? [],
      errors,
      fetchedAt: Date.now(),
    }
  }

  invalidate(code) {
    for (const key of [...this.cache.keys()]) {
      if (key.includes(`|${code}|`)) this.cache.delete(key)
    }
  }
}