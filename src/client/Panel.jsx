import React from 'react'
import { fetchBars, fetchHistory, fetchState, fetchStatus, fetchTick, forgetStock, patchState, runForecast, runSetup, searchStocks } from './api.js'
import { ForecastChart } from './Chart.jsx'
import { NS } from './i18n.js'
import { inTradingSession, relativeTime, sortWatchlist, togglePin, touchWatchlist, visibleWatchlist } from './store.js'

const QUALITY = [
  { key: 'fast', paths: 0.5, steps: 0.6 },
  { key: 'standard', paths: 1, steps: 1 },
  { key: 'fine', paths: 2, steps: 1.5 },
]

const SCALE_ORDER = ['1m', '5m', '15m', '30m', '1h', '2h', '1d']

function pct(value, digits = 2) {
  if (!Number.isFinite(value)) return '-'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`
}

function priceStr(value) {
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(2)
}

function numStr(value) {
  if (!Number.isFinite(value)) return '-'
  return value >= 1e8 ? `${(value / 1e8).toFixed(2)} 亿`
    : value >= 1e4 ? `${(value / 1e4).toFixed(1)} 万` : value.toFixed(0)
}

function quoteTime(raw) {
  const text = String(raw ?? '')
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(text)
  return m ? `${m[2]}-${m[3]} ${m[4]}:${m[5]}` : text
}

/** 把用户输入解析成 {code} —— 只信任 6 位代码 + 交易所后缀/前缀。 */
function parseCode(input) {
  const upper = String(input ?? '').trim().toUpperCase()
  let m = /^(\d{6})\.(SH|SZ|BJ)$/.exec(upper)
  if (m) return { code: `${m[1]}.${m[2]}` }
  m = /^(SH|SZ|BJ)(\d{6})$/.exec(upper)
  if (m) return { code: `${m[2]}.${m[1]}` }
  m = /^(\d{6})$/.exec(upper)
  if (m) return { code: m[1] }
  return null
}

function StatCard({ label, value, hint, tone, stale }) {
  return (
    <div className={`kfc-statCard ${stale ? 'stale' : ''}`}>
      <div className="kfc-statLabel">{label}</div>
      <div className={`kfc-statValue ${tone ?? ''}`}>{value}</div>
      {hint ? <div className="kfc-statHint">{hint}</div> : null}
    </div>
  )
}

/** 时钟图标：表示「最近用过」而不是收藏。 */
function RecentIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" opacity=".7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function StarIcon({ filled }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="M12 3.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function KitForecastPanel({ ctx }) {
  const t = ctx.locale.bind(NS)
  const [, setLocaleTick] = React.useState(0)
  React.useEffect(() => ctx.locale.subscribe(() => setLocaleTick((v) => v + 1)), [ctx])

  const [status, setStatus] = React.useState(null)
  const [setup, setSetup] = React.useState({ running: false, logs: [], error: null })
  const [hydrated, setHydrated] = React.useState(false)

  const [keyword, setKeyword] = React.useState('')
  const [suggestions, setSuggestions] = React.useState([])
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [selected, setSelected] = React.useState(null)
  const [scale, setScale] = React.useState('1m')
  const [quality, setQuality] = React.useState('fine')
  const [applyLimit, setApplyLimit] = React.useState(true)
  // 默认不自动重算：进入面板只显示行情/上次的图，点「开始预测」才跑模型
  const [autoRefresh, setAutoRefresh] = React.useState(false)
  const [comparePast, setComparePast] = React.useState(true)   // 图上叠加历史预测
  const [incremental, setIncremental] = React.useState(false)  // 增量延续（热启动）
  const [overlays, setOverlays] = React.useState(null)
  const [watchlist, setWatchlist] = React.useState([])
  const [notes, setNotes] = React.useState({})

  const [phase, setPhase] = React.useState('idle') // idle | running | done | error
  const [refreshing, setRefreshing] = React.useState(false)
  const [stage, setStage] = React.useState('')
  const [progress, setProgress] = React.useState({ step: 0, total: 0 })
  const [result, setResult] = React.useState(null)
  const [resultAt, setResultAt] = React.useState(0)
  const [error, setError] = React.useState(null)
  const [notice, setNotice] = React.useState('')
  const [elapsed, setElapsed] = React.useState(0)
  const [now, setNow] = React.useState(Date.now())
  const [marketOpen, setMarketOpen] = React.useState(() => inTradingSession())

  const abortRef = React.useRef(null)
  const runningRef = React.useRef(false)
  const resultRef = React.useRef(null)
  const loadPreviewRef = React.useRef(null)
  const autoRefreshRef = React.useRef(false)
  const startedRef = React.useRef(0)
  const saveTimerRef = React.useRef(null)
  // 联想请求的令牌：只接受最后一次输入的结果
  const searchTokenRef = React.useRef(0)
  // 行情预览已经加载到哪一根（心跳据此判断要不要重载）
  const previewAsOfRef = React.useRef('')

  const running = phase === 'running'
  runningRef.current = running
  resultRef.current = result
  autoRefreshRef.current = autoRefresh

  // 「这份预测结果是不是当前这一只、这个周期」——多处 effect 与渲染都依赖它，
  // 必须声明在所有 effect 之前（const 在模块/函数体里是 TDZ，用时未初始化会直接报错）。
  const resultTarget = selected?.code ?? null
  const resultMatches = Boolean(
    result && result.code && (!resultTarget || result.code === resultTarget) && result.scale === scale,
  )

  // 秒级时钟：用于「x 分钟前」「下次刷新」这类轻量显示
  React.useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      setMarketOpen(inTradingSession())
    }, 5000)
    return () => clearInterval(id)
  }, [])

  // 「只看行情」用的历史 K 线（不跑模型）。进入面板时若没有可用的预测，就只画这个。
  const [previewBars, setPreviewBars] = React.useState(null)
  const loadPreview = React.useCallback(async (code, scale) => {
    try {
      const data = await fetchBars(code, scale, 400)
      const bars = data.bars ?? []
      previewAsOfRef.current = bars.at(-1)?.t ?? ''
      setPreviewBars({ code: data.code, scale, bars, source: data.source })
      return data
    } catch {
      setPreviewBars(null)
      return null
    }
  }, [])
  // 心跳闭包里要用最新的 loadPreview（它自己依赖稳定，但显式持有更清楚）
  loadPreviewRef.current = loadPreview

  const refreshStatus = React.useCallback(async () => {
    try {
      const data = await fetchStatus()
      setStatus(data)
      return data
    } catch (err) {
      setStatus({ ready: false, error: err.message, scales: [] })
      return null
    }
  }, [])

  /** 把偏好写回 Host（合并式）。 */
  const persist = React.useCallback((patch) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      patchState(patch).catch(() => {})
    }, 400)
  }, [])

  // 首次挂载：恢复上次的股票、周期、参数与预测结果
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      let statusData = null
      let state = null
      try {
        statusData = await refreshStatus()
        try {
          state = (await fetchState()).state
        } catch {
          state = null
        }
      } finally {
        // 无论恢复成功与否都必须落地 hydrated，
        // 否则任何一次请求异常都会让面板永远停在「正在恢复…」
        if (!cancelled) setHydrated(true)
      }
      if (cancelled) return
      if (state) {
        setWatchlist(Array.isArray(state.watchlist) ? state.watchlist : [])
        if (state.notes && typeof state.notes === 'object') setNotes(state.notes)
        const prefs = state.prefs ?? {}
        if (SCALE_ORDER.includes(prefs.scale)) setScale(prefs.scale)
        if (QUALITY.some((item) => item.key === prefs.quality)) setQuality(prefs.quality)
        if (typeof prefs.applyLimit === 'boolean') setApplyLimit(prefs.applyLimit)
        if (typeof prefs.autoRefresh === 'boolean') setAutoRefresh(prefs.autoRefresh)
        if (typeof prefs.comparePast === 'boolean') setComparePast(prefs.comparePast)
        if (typeof prefs.incremental === 'boolean') setIncremental(prefs.incremental)
        const last = state.last
        // 只恢复「仍在常用列表里」的股票：用户删掉之后不该又被 last 复活
        const remembered = Array.isArray(state.watchlist)
          && state.watchlist.some((w) => w.code === last?.result?.code)
        if (last?.result?.code && (remembered || !state.watchlist?.length)) {
          setResult(last.result)
          setResultAt(last.at ?? Date.now())
          setPhase('done')
          setSelected({ code: last.result.code, name: last.result.name ?? last.result.code })
          setKeyword(`${last.result.name ?? ''} ${last.result.code}`.trim())
          if (SCALE_ORDER.includes(last.result.scale)) setScale(last.result.scale)
        }
      }
      if (!statusData) setPhase((prev) => (prev === 'running' ? prev : 'idle'))
      // 没有可恢复的预测时，只拉行情画 K 线，不跑模型
      if (!state?.last?.result?.code && statusData) {
        const code = (state?.watchlist?.[0]?.code)
          ?? (state?.prefs?.lastCode)
        if (code) {
          const scaleFor = state?.prefs?.scale ?? scale
          setSelected({ code, name: state?.watchlist?.[0]?.name ?? code })
          setKeyword(state?.watchlist?.[0]?.name ? `${state.watchlist[0].name} ${code}` : code)
          loadPreview(code, scaleFor)
        }
      }
    })()
    return () => {
      cancelled = true
      abortRef.current?.abort()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [refreshStatus])

  // 运行计时
  React.useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 200)
    return () => clearInterval(id)
  }, [running])

  // 搜索联想（防抖）
  // 只有输入框内容仍等于「选中股票的名字+代码」时才不联想；
  // 之前用 `selected !== null` 判断，预测后 selected 会被重置，导致联想永久失效。
  React.useEffect(() => {
    const text = keyword.trim()
    const selectedText = selected ? `${selected.name ?? ''} ${selected.code}`.trim() : ''
    if (text === '' || (selectedText !== '' && text === selectedText)) {
      setSuggestions([])
      return undefined
    }
    // 用递增令牌 + 不受重渲染影响的定时器：
    // 之前 cleanup 里的 clearTimeout 会被无关的 state 变化（例如预测结果到达）清掉，
    // 表现为「输完字没有联想结果」。
    const token = ++searchTokenRef.current
    const id = setTimeout(async () => {
      try {
        const data = await searchStocks(text)
        if (searchTokenRef.current !== token) return // 已经有更新的输入
        setSuggestions(data.items ?? [])
        setSearchOpen(true)
      } catch {
        if (searchTokenRef.current === token) setSuggestions([])
      }
    }, 200)
    return () => clearTimeout(id)
  }, [keyword, selected])

  const startSetup = React.useCallback(async () => {
    setSetup({ running: true, logs: [], error: null })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await runSetup({}, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.t === 'stage') {
            setSetup((prev) => ({ ...prev, logs: [...prev.logs.slice(-60), `▸ ${event.message}`] }))
          } else if (event.t === 'log') {
            setSetup((prev) => ({ ...prev, logs: [...prev.logs.slice(-60), event.line] }))
          } else if (event.t === 'fail') {
            setSetup((prev) => ({ ...prev, error: event.message }))
          }
        },
      })
      setSetup((prev) => ({ ...prev, running: false, logs: [...prev.logs, '✓ 完成'] }))
      abortRef.current = null
      await refreshStatus()
    } catch (err) {
      setSetup((prev) => ({ ...prev, running: false, error: err.message }))
    }
  }, [refreshStatus])

  /**
   * 发起一次预测。
   *
   * quiet=true（实时跟随、或已有结果时手动刷新）时**保留当前图表**：
   * 旧结果一直显示，只在右上角显示细进度；新结果到了再替换。
   * 失败也不再把图表换成错误面板，而是顶部一条提示，旧结果继续可用。
   */
  const run = React.useCallback(async ({ code, name, scale: scaleOverride, silent = false } = {}) => {
    const target = code ?? selected?.code
    if (!target) {
      setError(t('needStock'))
      setPhase('error')
      return
    }
    if (status && status.ready === false) {
      setError(t('needSetup'))
      setPhase('error')
      return
    }
    // 显式传入的 scale 优先：切换股票时不能读旧闭包里的 scale，否则会按错周期算
    const targetScale = scaleOverride ?? scale
    const budget = (status?.scales ?? []).find((item) => item.key === targetScale)
    const factor = QUALITY.find((item) => item.key === quality) ?? QUALITY[1]
    const nPaths = Math.max(1, Math.round((budget?.defaultPaths ?? 12) * factor.paths))
    const steps = Math.max(1, Math.round((budget?.defaultSteps ?? 20) * factor.steps))

    // 同股票同周期才做「静默刷新」，换股票/换周期必须清空旧图，避免张冠李戴
    const sameTarget = result?.code === target && result?.scale === targetScale
    const keepChart = sameTarget && silent

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setNotice('')
    setPhase('running')
    setRefreshing(keepChart)
    if (!keepChart) setResult(null)
    setStage(t('preparing'))
    setProgress({ step: 0, total: 0 })
    startedRef.current = Date.now()
    setElapsed(0)

    let failed = false
    let fresh = null
    try {
      await runForecast({ code: target, scale: targetScale, nPaths, steps, applyLimit, quality, warm: incremental }, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.t === 'stage') {
            setStage(event.message)
          } else if (event.t === 'progress') {
            setProgress({ step: event.step, total: event.total })
            if (event.message) setStage(event.message)
          } else if (event.t === 'log') {
            setStage(event.line)
          } else if (event.t === 'result') {
            fresh = event.data
            setPreviewBars(null)
            setResult(event.data)
            setOverlays(Array.isArray(event.data.overlays) ? event.data.overlays : [])
            setResultAt(Date.now())
            setStage('')
          } else if (event.t === 'fail') {
            failed = true
            if (keepChart) {
              // 静默刷新失败：保留旧图，只提示
              setNotice(event.message)
              setPhase('done')
            } else {
              setError(event.message)
              setPhase('error')
            }
          }
        },
      })
      if (!failed) {
        setPhase('done')
        if (fresh) {
          setWatchlist((prev) => {
            const next = touchWatchlist(prev, { code: fresh.code, name: fresh.name })
            persist({ watchlist: next, notes: { [fresh.code]: fresh.scale } })
            return next
          })
          setNotes((prev) => ({ ...prev, [fresh.code]: fresh.scale }))
          // 用 Host 侧的权威状态再对齐一次（别的窗口可能也改过）
          fetchState()
            .then((data) => {
              if (Array.isArray(data?.state?.watchlist)) setWatchlist(data.state.watchlist)
            })
            .catch(() => {})
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setPhase(result ? 'done' : 'idle')
        setNotice('')
      } else if (keepChart) {
        setNotice(err.message)
        setPhase('done')
      } else {
        setError(err.message)
        setPhase('error')
      }
    } finally {
      setRefreshing(false)
      abortRef.current = null
    }
  }, [selected, scale, quality, status, applyLimit, result, persist, t, notes])

  const runRef = React.useRef(run)
  runRef.current = run

  /**
   * 对比开关打开、但当前结果里没有对比数据时（例如刚从 state.json 恢复），补拉一次。
   *
   * 注意不要把 overlays 放进依赖：请求返回空数组时 setOverlays([]) 会产生新引用，
   * 再次触发本 effect → 无限请求循环，把主线程拖垮（搜索联想跟着失效）。
   * 用「已经拉过哪个目标」的 ref 做去重。
   */
  const historyFetchRef = React.useRef('')
  React.useEffect(() => {
    if (!comparePast || !result?.code || !resultMatches) return undefined
    const target = `${result.code}|${result.scale}|${result.asOf}`
    if (historyFetchRef.current === target) return undefined
    if (Array.isArray(overlays) && overlays.length > 0) return undefined
    historyFetchRef.current = target
    let cancelled = false
    fetchHistory(result.code, result.scale, result.asOf)
      .then((data) => {
        if (!cancelled) setOverlays(Array.isArray(data.overlays) ? data.overlays : [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [comparePast, result?.code, result?.scale, result?.asOf, resultMatches, overlays])

  /**
   * 实时跟随：轮询「最后一根已收盘 K 线」，只有它变了才重算。
   *
   * 之前是按固定间隔无差别重跑，问题是：30m 一档要 60~80 秒，
   * 而间隔只有 70 秒，等于一直在重算同一根 bar，既占满 GPU 又毫无新信息。
   * 现在心跳只读行情（复用 20 秒缓存，几乎零成本），
   * 真正触发的条件是新 bar 收盘、或当前股票/周期刚切过来。
   */
  const [tickAt, setTickAt] = React.useState(0)
  const [tickState, setTickState] = React.useState('idle') // idle | ok | fail
  // 心跳拿到的实时盘口：独立于预测结果，盘中每分钟都会更新
  const [liveQuote, setLiveQuote] = React.useState(null)
  // 未收盘那根 K 线：用于图上画一根会长的动态蜡烛
  const [liveCandle, setLiveCandle] = React.useState(null)
  // 心跳看到的最新已收盘 bar：与 result.asOf 比对，判断上次预测是否已过期
  const [latestBar, setLatestBar] = React.useState(null)
  const lastRunAnchorRef = React.useRef(null)

  /**
   * 心跳分两件事，不要混为一谈：
   *
   *   A. 行情刷新（很轻，每 15–60 秒一次，一直跑）
   *      —— 盘口价格/涨跌幅/成交量/涨停价，以及「最后一根已收盘 K 线」是什么
   *
   *   B. 模型重算（很重，20–80 秒，只在必要时）
   *      —— 只有出现新的已收盘 bar 才重算；否则同一根 bar 反复算毫无新信息
   *
   * 之前把这两件事绑在一起，导致日线一整天都不刷新价格，看起来像「数据不实时」。
   */
  React.useEffect(() => {
    // 行情刷新始终开启：它只是读盘口（几 KB），和「要不要重算模型」是两回事。
    // autoRefresh 只控制 B 段（模型重算）。
    if (!hydrated) return undefined
    const code = selected?.code ?? result?.code
    if (!code) return undefined
    // 行情刷新频率：盘中 15–20 秒（保证价格是活的），休市降到 5 分钟（价格不会变）
    const open = inTradingSession()
    // 盘中：短周期 10 秒、长周期 15 秒；休市 2 分钟（价格不会变，但保持轻量探测）
    const quoteInterval = !open ? 120000 : (scale === '1m' || scale === '5m' ? 10000 : 15000)
    let cancelled = false

    const beat = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const data = await fetchTick(code, scale)
        if (cancelled) return
        setTickAt(Date.now())
        setTickState('ok')
        if (data?.quote) setLiveQuote({ ...data.quote, code })
        setLiveCandle(data?.forming ?? null)
        if (data?.asOf) setLatestBar(data.asOf)

        // 预览态（没有预测结果）下，图上的 K 线只在选股/换周期时加载过一次，
        // 之后即使有新 bar 收盘也不会追加，看起来就像「行情不刷新」。
        // 这里检测到新的收盘 bar 就重载一次行情（只请求 bars，很轻）。
        if (data?.asOf && data.asOf !== previewAsOfRef.current) {
          previewAsOfRef.current = data.asOf
          // 无论有没有预测结果都重载行情：
          //   预览态 → 图上的 K 线要跟着长；
          //   预测态 → 需要这些真实 bar 贴到预测窗口上做对照。
          loadPreviewRef.current?.(code, scale)
        }
        // B. 默认不动模型。只有用户显式打开「实时跟随」、且出现新的收盘 bar 时才重算。
        const latest = data?.asOf
        const prevResult = resultRef.current
        const newBar = Boolean(latest && prevResult?.asOf && latest !== prevResult.asOf)
        if (autoRefreshRef.current && newBar && !runningRef.current && lastRunAnchorRef.current !== latest) {
          lastRunAnchorRef.current = latest
          runRef.current({ silent: true })
        }
      } catch {
        if (!cancelled) setTickState('fail')
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') beat()
    }
    // 从后台切回来、或窗口重新获得焦点时立刻补一次，
    // 不用等下一个间隔（这也是「看起来要手动刷新」的常见来源）
    const onFocus = () => beat()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    beat()
    const id = setInterval(beat, quoteInterval)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
    // 依赖里刻意不放 result?.asOf / latestBar 这类「每次 tick 都会变」的状态：
    // 否则定时器会被不断重建，节奏被打乱（实测 40 秒只发了 2 次心跳）。
    // 需要的最新值一律从 ref 读。
  }, [autoRefresh, hydrated, scale, selected?.code, result?.code])

  // 周期/参数变化时记住偏好
  React.useEffect(() => {
    if (!hydrated) return
    persist({ prefs: { scale, quality, applyLimit, autoRefresh, comparePast, incremental } })
  }, [hydrated, scale, quality, applyLimit, autoRefresh, comparePast, incremental, persist])

  const pick = (item, { runNow = false } = {}) => {
    // 每只股票记住自己上次看的周期（来自 Host 的 notes），切回来还是那个粒度
    const preferred = item.scale ?? notes[item.code] ?? scale
    const valid = SCALE_ORDER.includes(preferred) ? preferred : scale
    setSelected(item)
    setKeyword(`${item.name} ${item.code}`)
    setSuggestions([])
    setSearchOpen(false)
    setScale(valid)
    // 换了股票：旧预测属于另一只股票，必须清掉，否则图表还停在上一只
    if (result && (result.code !== item.code || result.scale !== valid)) {
      setResult(null)
      setOverlays([])
      setPhase('idle')
      setError(null)
      setNotice('')
    }
    setPreviewBars(null)
    loadPreview(item.code, valid)
    // 默认只画行情；只有调用方明确要求时才预测（例如从联想里回车）
    if (runNow) run({ code: item.code, name: item.name, scale: valid })
  }

  const onKeywordKey = (event) => {
    if (event.key !== 'Enter') return
    if (suggestions.length > 0) {
      pick(suggestions[0])
      return
    }
    const parsed = parseCode(keyword)
    if (parsed) {
      setSelected(null)
      run({ code: parsed.code })
    }
  }

  const starCurrent = () => {
    const code = selected?.code ?? result?.code
    if (!code) return
    const name = selected?.name ?? result?.name ?? code
    setWatchlist((prev) => {
      const { list, pinned } = togglePin(prev, code, name)
      setNotice(pinned ? t('pinnedNotice') : t('unpinnedNotice'))
      persist({ watchlist: list })
      return list
    })
  }

  /**
   * 从「常用」里移除一只股票。
   *
   * 注意不能只改 watchlist：last（上次预测）、notes（记住的周期）、history（对比用）
   * 里都还留着它，重开面板就会把这只股票又恢复出来。所以这里走 forgetStock，
   * 由 Host 一次性清干净。
   */
  const removeFromWatchlist = (code) => {
    setWatchlist((prev) => prev.filter((entry) => entry.code !== code))
    setNotes((prev) => {
      if (!(code in prev)) return prev
      const next = { ...prev }
      delete next[code]
      return next
    })
    forgetStock(code).catch(() => {})

    // 正在看的就是这只股票：把画面也一起清掉，否则它还会留在图上
    if (result?.code === code) {
      setResult(null)
      setOverlays([])
      setResultAt(0)
      setPhase('idle')
      setPreviewBars(null)
    }
    if (selected?.code === code) {
      setSelected(null)
      setKeyword('')
    }
  }

  /**
   * 只有行情、还没预测时的图表数据。
   * 结构与预测结果一致，但 pathMedian / bands 为空 —— 图表会自动不画预测层。
   */
  const previewData = React.useMemo(() => {
    if (!previewBars || previewBars.bars.length === 0) return null
    const bars = previewBars.bars.slice(-400)
    return {
      code: previewBars.code,
      scale: previewBars.scale,
      asOf: bars.at(-1)?.t ?? null,
      lastClose: bars.at(-1)?.c ?? null,
      history: bars,
      pathMedian: [],
      futureTimestamps: [],
      bands: {},
      stats: null,
      nPaths: 0,
      steps: 0,
      Lh: 0,
      source: previewBars.source,
    }
  }, [previewBars])

  // 预测 anchor 之后已经真实走出来的 bar（用于贴在预测窗口上对照）
  const realizedBars = React.useMemo(() => {
    if (!resultMatches || !previewBars) return null
    const bars = previewBars.bars ?? []
    const anchor = result?.asOf
    if (!anchor) return null
    return bars.filter((bar) => bar.t > anchor)
  }, [resultMatches, previewBars, result?.asOf])

  // 真实的最新一根（用于「最新已收盘」标签，预测态下也要往前走）
  const latestRealized = realizedBars?.length ? realizedBars.at(-1).t : null

  // 显示用数据：只有结果属于当前目标时才用它，否则退回行情预览。
  // 之前是 `result ?? previewData`，换股票后旧结果优先级更高，图表就卡住不动了。
  const chartData = (resultMatches ? result : null) ?? previewData
  const isPreview = !resultMatches && Boolean(previewData)

  const scales = status?.scales?.length
    ? status.scales
    : SCALE_ORDER.map((key) => ({ key, label: key, Lc: 0, Lh: 0 }))
  const ready = status?.ready === true
  const setupVisible = !ready && status !== null && !setup.running
  // 优先显示心跳拿到的最新盘口；预测结果里附带的报价只在没有心跳时兜底
  const quote = (liveQuote && (!result || liveQuote.code === result.code) ? liveQuote : result?.quote) ?? null
  const quoteUp = (quote?.changePercent ?? 0) >= 0
  const stale = Boolean(result?.asOf && latestBar && latestBar !== result.asOf)
  const activeCode = selected?.code ?? result?.code ?? null
  const activeName = selected?.name ?? result?.name ?? ''
  const pinned = Boolean(watchlist.find((entry) => entry.code === activeCode)?.pinned)
  const chips = visibleWatchlist(watchlist)
  const showProgressPane = running && !refreshing
  const progressPct = progress.total > 0 ? Math.round((progress.step / progress.total) * 100) : 6

  if (!hydrated) {
    return (
      <div className="kfc-root kfc-loading">
        <span className="kfc-spinner" />
        <span>{t('restoring')}</span>
      </div>
    )
  }

  return (
    <div className="kfc-root">
      <header className="kfc-header">
        <div className="kfc-mark"><PanelIcon size={18} /></div>
        <div className="kfc-headCopy">
          <h1 className="kfc-title">{t('title')}<small>{t('titleTag')}</small></h1>
          <p className="kfc-sub">{t('subtitle')}</p>
        </div>
        <div className="kfc-headActions">
          {running && refreshing && (
            <span className="kfc-livePill" title={stage || t('working')}>
              <span className="kfc-spinner sm" />
              {t('updating')} {progress.total > 0 ? `${progress.step}/${progress.total}` : ''}
            </span>
          )}
          <button
            type="button"
            className={`kfc-ghost ${ready ? 'ok' : 'warn'}`}
            onClick={refreshStatus}
            title={t('recheck')}
          >
            {ready ? t('envReady') : t('envMissing')}
          </button>
        </div>
      </header>

      {setupVisible && (
        <section className="kfc-setup">
          <div className="kfc-setupTitle">{t('setupTitle')}</div>
          <div className="kfc-setupBody">{t('setupBody')}</div>
          <div className="kfc-setupFacts">
            <span>Python：{status.python}</span>
            <span>PyTorch：{status.env?.ok ? status.env.torch : '未安装'}</span>
            <span>模型：{status.modelReady ? '已下载' : '未下载（1.1 GB）'}</span>
          </div>
          <div className="kfc-setupActions">
            <button type="button" className="kfc-primary" onClick={startSetup}>{t('setupStart')}</button>
            <button type="button" className="kfc-ghost" onClick={refreshStatus}>{t('recheck')}</button>
          </div>
        </section>
      )}

      {(setup.running || setup.logs.length > 0) && (
        <section className="kfc-setup kfc-logPane">
          <div className="kfc-setupTitle">
            {setup.error ? t('setupFailed') : setup.running ? t('setupRunning') : t('setupDone')}
          </div>
          <pre className="kfc-log">{setup.logs.join('\n') || '…'}</pre>
          {setup.error ? <div className="kfc-error">{setup.error}</div> : null}
        </section>
      )}

      <section className="kfc-toolbar">
        <div className="kfc-searchWrap">
          <input
            className="kfc-search"
            value={keyword}
            placeholder={t('searchPlaceholder')}
            spellCheck={false}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onChange={(event) => {
              setKeyword(event.target.value)
              setSelected(null)
              setSearchOpen(true)
            }}
            onKeyDown={onKeywordKey}
          />
          {searchOpen && suggestions.length > 0 && (
            <div className="kfc-suggest">
              {suggestions.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className="kfc-suggestItem"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(item)}
                >
                  <span className="kfc-suggestName">{item.name}</span>
                  <span className="kfc-suggestCode">{item.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <select
          className="kfc-select kfc-selectScale"
          value={scale}
          title={t('scaleHint')}
          onChange={(event) => {
            // 换了周期，旧图就属于另一个尺度了：有选中的股票就直接重算，
            // 否则只记下周期，等用户点「开始预测」
            const next = event.target.value
            setScale(next)
            const code = selected?.code ?? result?.code
            if (code) {
              // 旧预测属于上一个周期，比例尺完全不同，必须清掉再退回「只看行情」
              setResult(null)
              setOverlays([])
              setPreviewBars(null)
              setPhase('idle')
              loadPreview(code, next)
            }
          }}
        >
          {scales.map((item) => (
            <option key={item.key} value={item.key}>
              {`${item.key} · ${item.label}（${item.Lc}/${item.Lh}）`}
            </option>
          ))}
        </select>

        <select
          className="kfc-select"
          value={quality}
          title={t('qualityHint')}
          onChange={(event) => setQuality(event.target.value)}
        >
          {QUALITY.map((item) => (
            <option key={item.key} value={item.key}>{t(`quality.${item.key}`)}</option>
          ))}
        </select>

        <button
          type="button"
          className={`kfc-iconBtn ${pinned ? 'on' : ''}`}
          onClick={starCurrent}
          disabled={!activeCode}
          title={pinned ? t('unpinHint') : t('pinHint')}
        >
          <StarIcon filled={pinned} />
        </button>

        <label className="kfc-check" title={t('autoHint')}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => setAutoRefresh(event.target.checked)}
          />
          {t('auto')}
        </label>

        <label className="kfc-check" title={t('limitHint')}>
          <input
            type="checkbox"
            checked={applyLimit}
            onChange={(event) => setApplyLimit(event.target.checked)}
          />
          {t('limit')}
        </label>

        <label className="kfc-check" title={t('compareHint')}>
          <input
            type="checkbox"
            checked={comparePast}
            onChange={(event) => setComparePast(event.target.checked)}
          />
          {t('compare')}
        </label>

        <label className={`kfc-check ${incremental ? 'on' : ''}`} title={t('incrementalHint')}>
          <input
            type="checkbox"
            checked={incremental}
            onChange={(event) => setIncremental(event.target.checked)}
          />
          {t('incremental')}
        </label>

        <button
          type="button"
          className="kfc-run"
          disabled={running}
          onClick={() => run({ silent: Boolean(result) })}
        >
          {running ? t('running') : result ? t('rerun') : t('runForecast')}
        </button>
      </section>

      {chips.length > 0 && (
        <section className="kfc-chips">
          <span className="kfc-chipsLabel">{t('watchlist')}</span>
          {chips.map((item) => {
            const active = item.code === activeCode
            return (
              <span key={item.code} className={`kfc-chipItem ${active ? 'active' : ''}`}>
                <button
                  type="button"
                  className="kfc-chipMain"
                  title={item.code}
                  onClick={() => pick({ code: item.code, name: item.name })}
                >
                  {item.pinned ? <StarIcon filled /> : <RecentIcon />}
                  <b>{item.name}</b>
                  <span>{item.code}</span>
                </button>
                <button
                  type="button"
                  className="kfc-chipDrop"
                  title={t('removeHint')}
                  onClick={() => removeFromWatchlist(item.code)}
                >
                  ×
                </button>
              </span>
            )
          })}
        </section>
      )}

      {(activeCode || result) && (
        <section className="kfc-quote">
          <div className="kfc-quoteName">
            <b>{activeName}</b>
            <span>{activeCode}</span>
          </div>
          {quote && (
            <>
              <div className={`kfc-quotePrice ${quoteUp ? 'up' : 'down'}`}>
                {tickState === 'ok' && liveQuote ? <span className="kfc-liveDot" title={t('livePriceHint')} /> : null}
                {priceStr(quote.price)}
                <span>{pct((quote.changePercent ?? 0) / 100)}</span>
              </div>
              <div className="kfc-quoteMeta">
                <span>开 {priceStr(quote.open)}</span>
                <span>高 {priceStr(quote.high)}</span>
                <span>低 {priceStr(quote.low)}</span>
                <span>量 {numStr(quote.volume)}</span>
                <span>{quoteTime(quote.time)}</span>
                {tickAt > 0 ? (
                  <span className="kfc-tickAge">
                    {t('quoteUpdated')} {relativeTime(new Date(tickAt).toISOString(), now)}
                  </span>
                ) : null}
                {!marketOpen ? <span className="kfc-chip">{t('marketClosed')}</span> : null}
              </div>
            </>
          )}
          <div className="kfc-quoteSpacer" />
          {chartData && (
            <div className="kfc-quoteMeta">
              <span>{t('lastBar')} {latestRealized ?? chartData.asOf}</span>
              {chartData.Lh > 0 ? <span>{t('horizon')} {chartData.Lh} 根</span> : null}
              {chartData.source ? <span className="kfc-chip">{chartData.source}</span> : null}
              {chartData.adjustmentApplied ? <span className="kfc-chip">{t('adj')}</span> : null}
              {chartData.nPad > 0 ? <span className="kfc-chip warn">填充 {chartData.nPad}</span> : null}
              {resultAt > 0 ? (
                <span className="kfc-chip">{t('updated')} {relativeTime(new Date(resultAt).toISOString(), now)}</span>
              ) : null}
              {result?.droppedForming ? <span className="kfc-chip warn">{t('formingDropped')}</span> : null}
              {tickState !== 'idle' && !running ? (
                <span
                  className={`kfc-chip live ${tickState === 'fail' ? 'warn' : ''}`}
                  title={tickState === 'fail' ? t('watchFail') : (autoRefresh ? t('watchHint') : t('quoteOnlyHint'))}
                >
                  <span className="kfc-dot" />
                  {tickState === 'fail' ? t('watchRetry') : (autoRefresh ? t('watching') : t('quoteOnly'))}
                </span>
              ) : null}
            </div>
          )}
        </section>
      )}

      <section className="kfc-main">
        {stale && !running ? (
          <div className="kfc-staleBar">
            <span className="kfc-dot" />
            <span>
              {t('staleResult')} {latestBar}
            </span>
            <button type="button" className="kfc-ghost" onClick={() => run({ silent: true })}>
              {t('refreshNow')}
            </button>
          </div>
        ) : null}

        {notice ? (
          <div className="kfc-notice">
            <span>{notice}</span>
            <button type="button" className="kfc-ghost" onClick={() => setNotice('')}>{t('dismiss')}</button>
          </div>
        ) : null}

        {showProgressPane && (
          <div className="kfc-progressPane">
            <div className="kfc-progressHead">
              <span className="kfc-spinner" />
              <b>{stage || t('working')}</b>
              <span className="kfc-elapsed">{elapsed.toFixed(1)}s</span>
            </div>
            <div className="kfc-bar">
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <div className="kfc-progressHint">{t('progressHint')}</div>
            <div className="kfc-setupActions">
              <button type="button" className="kfc-ghost" onClick={() => abortRef.current?.abort()}>
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {error && !running && (
          <div className="kfc-errorPane">
            <b>{t('failed')}</b>
            <div>{error}</div>
            <button type="button" className="kfc-ghost" onClick={() => setError(null)}>{t('dismiss')}</button>
          </div>
        )}

        {chartData && (
          <div className={`kfc-resultPane ${refreshing ? 'refreshing' : ''}`}>
            {refreshing && (
              <div className="kfc-refreshBar">
                <i style={{ width: `${progressPct}%` }} />
              </div>
            )}
            <ForecastChart
              data={chartData}
              height={340}
              overlays={comparePast ? overlays : null}
              livePrice={Number.isFinite(quote?.price) ? quote.price : null}
              liveCandle={liveCandle}
              realizedBars={realizedBars}
            />
            {isPreview ? (
              <div className="kfc-previewBar">
                <span>{t('previewOnly')}</span>
                <button type="button" className="kfc-primary" onClick={() => run()}>
                  {t('runForecast')}
                </button>
              </div>
            ) : null}
            {!isPreview && comparePast && overlays && overlays.some((item) => item.verify) ? (
              <div className="kfc-compare">
                <span className="kfc-compareLabel">{t('compareTitle')}</span>
                {overlays.filter((item) => item.verify).slice(0, 3).map((item) => {
                  const v = item.verify
                  const hit = v.insideBand === true
                  return (
                    <span
                      key={item.id}
                      className={`kfc-compareItem ${hit ? 'hit' : 'miss'}`}
                      title={`${t('comparePred')} ${pct(v.predRet)} / ${t('compareActual')} ${pct(v.actualRet)}`}
                    >
                      <i>{item.asOf?.slice(5, 10)}</i>
                      <b>{pct(v.predRet)}</b>
                      <span>→ {pct(v.actualRet)}</span>
                      <em>{v.complete ? '' : `${v.realizedBars}/${v.totalBars}`}</em>
                    </span>
                  )
                })}
                <span className="kfc-compareNote">{t('compareNote')}</span>
              </div>
            ) : null}
            {!isPreview ? <div className="kfc-stats">
              <StatCard
                label={t('stat.median')}
                value={pct(result.stats.retMedian)}
                tone={result.stats.retMedian >= 0 ? 'up' : 'down'}
                hint={`${t('stat.target')} ${priceStr(result.stats.targetMedian)}`}
                stale={refreshing}
              />
              <StatCard
                label={t('stat.upProb')}
                value={`${(result.stats.upProb * 100).toFixed(0)}%`}
                tone={result.stats.upProb >= 0.5 ? 'up' : 'down'}
                hint={`${t('stat.q05q95')} ${pct(result.stats.retQ05)} ~ ${pct(result.stats.retQ95)}`}
                stale={refreshing}
              />
              <StatCard
                label={t('stat.range')}
                value={`${priceStr(result.stats.targetQ05)} ~ ${priceStr(result.stats.targetQ95)}`}
                hint={t('stat.rangeHint')}
                stale={refreshing}
              />
              <StatCard
                label={t('stat.vol')}
                value={pct(result.stats.volMedian)}
                hint={`${t('stat.drawdown')} ${pct(result.stats.maxDdMedian)}`}
                stale={refreshing}
              />
              <StatCard
                label={t('stat.paths')}
                value={`${result.nPaths} × ${result.steps}`}
                hint={`${result.device} · ${result.sampleSeconds}s`}
                stale={refreshing}
              />
            </div> : null}
          </div>
        )}

        {!chartData && !running && !error && (
          <div className="kfc-empty">
            <PanelIcon size={32} />
            <div className="kfc-emptyTitle">{t('emptyTitle')}</div>
            <div className="kfc-emptyBody">{t('emptyBody')}</div>
            {chips.length === 0 ? <div className="kfc-emptyHint">{t('emptyHint')}</div> : null}
          </div>
        )}

        <div className="kfc-footNote">{ready || !status ? t('footNote') : t('footModelMissing')}</div>
      </section>
    </div>
  )
}

export function PanelIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".5" />
      <path d="M4.5 15.5l4-5 3.4 3.2 3.1-6.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 11.5h5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="2 2" />
      <circle cx="20.5" cy="11.5" r="1.6" fill="currentColor" />
    </svg>
  )
}