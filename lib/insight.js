/**
 * AI 解读：把大盘、个股预测、公告新闻交给 DSH 里已配置的模型，生成一段中文解读。
 *
 * - 模型选择：优先会话默认模型（ctx.get('agentDefaultModel')），否则用第一个可用对话模型
 * - 通过 SSE 流式回传，前端边收边显示
 * - 只把「已经拿到的数据」写进提示词，缺什么就明确说缺什么，不让模型编
 */

const SYSTEM = [
  '你是 A 股行情分析助手，正在为一位使用 KiT 模型做 K 线预测的用户解读当前情况。',
  '',
  '写作要求：',
  '1. 用简体中文，结论先行，分 3~5 点，每点一两句话，不要长篇大论。',
  '2. 只说数据支持的内容。数据里没有的（比如资金流向、机构观点、政策预期）不要编。',
  '3. 明确区分三类信息：事实（行情/公告原文）、模型输出（概率与区间）、你的推断。',
  '4. 提到预测时务必说明它是「概率分布」，不要写成确定结论；并提醒不确定性。',
  '5. 不要给买卖建议，不要预测具体点位必然到达。',
  '6. 结尾用一句话总结当前最值得注意的风险点。',
].join('\n')

/** 非对话模型，列进来只会选错。 */
const NON_CHAT = /(embedding|rerank|moderation|tts|whisper|speech|transcri|image-generation|dall-e|stable-diffusion|ocr)/i

function pct(value, digits = 2) {
  if (!Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`
}

function num(value) {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

/** 把结构化数据整理成提示词。所有字段都可能缺失，缺了就不写。 */
export function buildPrompt({ market, stock, forecast, news, scale }) {
  const parts = []

  if (market?.indices?.length) {
    const lines = market.indices.map((item) => {
      const chg = Number.isFinite(item.changePercent)
        ? `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`
        : '—'
      return `- ${item.name}：${num(item.price)}（${chg}）`
    })
    parts.push(`# 大盘（同一天）\n${lines.join('\n')}`)
    if (market.breadth) {
      const { up, down, flat } = market.breadth
      parts.push(`# 涨跌家数\n上涨 ${up} 家，下跌 ${down} 家，平盘 ${flat} 家。`)
    }
  }

  if (stock) {
    const chg = Number.isFinite(stock.changePercent) ? `${stock.changePercent.toFixed(2)}%` : '—'
    parts.push(`# 个股行情\n${stock.name ?? stock.code}（${stock.code}）：现价 ${num(stock.price)}，涨跌 ${chg}`
      + `，今开 ${num(stock.open)}，最高 ${num(stock.high)}，最低 ${num(stock.low)}`)
  }

  if (forecast?.stats) {
    const s = forecast.stats
    const horizon = forecast.Lh ? `${forecast.Lh} 根 ${scale ?? forecast.scale} K 线` : '未来若干根 K 线'
    parts.push([
      '# KiT 模型预测（条件扩散采样得到的概率分布，不是确定结论）',
      `- 预测窗口：${horizon}，锚点为 ${forecast.asOf ?? '—'} 收盘`,
      `- 末端累计收益中位数：${pct(s.retMedian)}`,
      `- 上涨概率（采样路径末端收益 > 0 的比例）：${Math.round((s.upProb ?? 0) * 100)}%`,
      `- 收益分位：q05 ${pct(s.retQ05)}，q95 ${pct(s.retQ95)}`,
      `- 目标价区间（q05~q95）：${num(s.targetQ05)} ~ ${num(s.targetQ95)}`,
      `- 单根 K 线对数收益标准差（中位）：${pct(s.volMedian)}；最大回撤中位：${pct(s.maxDdMedian)}`,
    ].join('\n'))
  }

  if (news?.announcements?.length) {
    const lines = news.announcements.slice(0, 6).map((item) => `- ${item.date}（${item.category}）${item.title}`)
    parts.push(`# 近期公告\n${lines.join('\n')}`)
  }
  if (news?.news?.length) {
    const lines = news.news.slice(0, 6).map((item) => `- ${item.time}｜${item.title}`)
    parts.push(`# 近期新闻标题\n${lines.join('\n')}`)
  }

  if (parts.length === 0) return null
  parts.push('# 请输出\n按上面的要求写一段解读。')
  return parts.join('\n\n')
}

export class InsightService {
  constructor(ctx, logger = console) {
    this.ctx = ctx
    this.logger = logger
    this.modelCache = null
    this.modelCacheAt = 0
  }

  /** 挑一个能用的对话模型：会话默认优先，否则目录里第一个。 */
  async resolveModel() {
    if (this.modelCache && Date.now() - this.modelCacheAt < 60 * 1000) return this.modelCache

    const llm = this.ctx?.llm
    if (!llm?.listProviders) throw new Error('当前部署没有可用的模型服务（ctx.llm）')

    let preferred = null
    try {
      const current = this.ctx.get('agentDefaultModel')?.currentSelection?.()
      if (current?.provider && current?.model) preferred = { provider: current.provider, model: current.model }
    } catch {
      // 拿不到就用目录里第一个
    }

    const providers = llm.listProviders() ?? []
    const candidates = []
    for (const provider of providers) {
      const providerId = provider?.id
      if (!providerId) continue
      let models = []
      try {
        models = (await llm.listModels(providerId)) ?? []
      } catch {
        continue
      }
      for (const model of models) {
        if (!model?.id) continue
        if (NON_CHAT.test(String(model.id)) || NON_CHAT.test(String(model.name ?? ''))) continue
        candidates.push({ provider: providerId, model: String(model.id), name: String(model.name ?? model.id) })
      }
    }
    if (candidates.length === 0) throw new Error('没有可用的对话模型，请先在设置里配置一个 provider')

    const chosen = (preferred && candidates.find((c) => c.provider === preferred.provider && c.model === preferred.model))
      || candidates[0]
    this.modelCache = chosen
    this.modelCacheAt = Date.now()
    return chosen
  }

  /**
   * 流式生成解读。
   * @param {object} payload { market, stock, forecast, news, scale }
   * @param {(text: string) => void} onDelta
   * @param {AbortSignal} signal
   */
  async stream(payload, onDelta, signal) {
    const model = await this.resolveModel()
    const prompt = buildPrompt(payload)
    if (prompt === null) throw new Error('没有可解读的数据（先选一只股票或加载大盘）')

    const stream = this.ctx.llm.stream({
      provider: model.provider,
      model: model.model,
      system: SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      maxTokens: 900,
      signal,
    })

    let text = ''
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') {
        if (chunk.text) {
          text += chunk.text
          onDelta(chunk.text)
        }
        continue
      }
      if (chunk.type === 'finish') {
        const reason = chunk.reason ?? {}
        if (reason.kind === 'error') throw new Error(reason.failure?.message ?? '模型返回错误')
        if (reason.kind === 'aborted') throw new Error('已取消')
      }
    }
    return { text, model: `${model.provider}/${model.model}`, modelName: model.name }
  }
}