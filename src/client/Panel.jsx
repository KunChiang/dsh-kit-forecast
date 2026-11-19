import React from 'react'
import { fetchState, fetchStatus, fetchTick, patchState, runForecast, runSetup, searchStocks } from './api.js'
import { ForecastChart } from './Chart.jsx'
import { NS } from './i18n.js'
import { relativeTime, sortWatchlist, togglePin, touchWatchlist, visibleWatchlist } from './store.js'

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
  const [scale, setScale] = React.useState('1d')
  const [quality, setQuality] = React.useState('standard')
  const [applyLimit, setApplyLimit] = React.useState(true)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
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

  const abortRef = React.useRef(null)
  const runningRef = React.useRef(false)
  const startedRef = React.useRef(0)
  const saveTimerRef = React.useRef(null)

  const running = phase === 'running'
  runningRef.current = running

  // 秒级时钟：用于「x 分钟前」「下次刷新」这类轻量显示
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

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
      const statusData = await refreshStatus()
      let state = null
      try {
        state = (await fetchState()).state
      } catch {
        state = null
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
        const last = state.last
        if (last?.result?.code) {
          setResult(last.result)
          setResultAt(last.at ?? Date.now())
          setPhase('done')
          setSelected({ code: last.result.code, name: last.result.name ?? last.result.code })
          setKeyword(`${last.result.name ?? ''} ${last.result.code}`.trim())
          if (SCALE_ORDER.includes(last.result.scale)) setScale(last.result.scale)
        }
      }
      setHydrated(true)
      if (!statusData) setPhase((prev) => (prev === 'running' ? prev : 'idle'))
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
  React.useEffect(() => {
    const text = keyword.trim()
    if (text === '' || selected !== null) {
      setSuggestions([])
      return undefined
    }
    const id = setTimeout(async () => {
      try {
        const data = await searchStocks(text)
        setSuggestions(data.items ?? [])
      } catch {
        setSuggestions([])
      }
    }, 240)
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
      await runForecast({ code: target, scale: targetScale, nPaths, steps, applyLimit, quality }, {
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
            setResult(event.data)
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
   * 实时跟随：轮询「最后一根已收盘 K 线」，只有它变了才重算。
   *
   * 之前是按固定间隔无差别重跑，问题是：30m 一档要 60~80 秒，
   * 而间隔只有 70 秒，等于一直在重算同一根 bar，既占满 GPU 又毫无新信息。
   * 现在心跳只读行情（复用 20 秒缓存，几乎零成本），
   * 真正触发的条件是新 bar 收盘、或当前股票/周期刚切过来。
   */
  const [tickAt, setTickAt] = React.useState(0)
  const [tickState, setTickState] = React.useState('idle') // idle | ok | fail
  React.useEffect(() => {
    if (!autoRefresh || !hydrated) return undefined
    const code = selected?.code ?? result?.code
    if (!code) return undefined
    const interval = scale === '1m' ? 15000 : scale === '1d' ? 60000 : 30000
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      if (runningRef.current) return
      try {
        const data = await fetchTick(code, scale)
        setTickAt(Date.now())
        setTickState('ok')
        const latest = data?.asOf
        const current = result?.asOf
        // 换股票/换周期（result 对不上）时也补一次，避免停在旧目标上
        const stale = result?.code !== code || result?.scale !== scale
        if ((latest && latest !== current) || stale) {
          runRef.current({ silent: true })
        }
      } catch {
        // 心跳失败不打扰用户，下一轮再试
        setTickState('fail')
      }
    }, interval)
    return () => clearInterval(id)
  }, [autoRefresh, hydrated, scale, selected?.code, result?.code, result?.asOf])

  // 周期/参数变化时记住偏好
  React.useEffect(() => {
    if (!hydrated) return
    persist({ prefs: { scale, quality, applyLimit, autoRefresh } })
  }, [hydrated, scale, quality, applyLimit, autoRefresh, persist])

  const pick = (item, { runNow = true } = {}) => {
    // 每只股票记住自己上次看的周期（来自 Host 的 notes），切回来还是那个粒度
    const preferred = item.scale ?? notes[item.code] ?? scale
    const valid = SCALE_ORDER.includes(preferred) ? preferred : scale
    setSelected(item)
    setKeyword(`${item.name} ${item.code}`)
    setSuggestions([])
    setSearchOpen(false)
    setScale(valid)
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

  const removeFromWatchlist = (code) => {
    setWatchlist((prev) => {
      const next = prev.filter((entry) => entry.code !== code)
      persist({ watchlist: next })
      return next
    })
  }

  const scales = status?.scales?.length
    ? status.scales
    : SCALE_ORDER.map((key) => ({ key, label: key, Lc: 0, Lh: 0 }))
  const ready = status?.ready === true
  const setupVisible = !ready && status !== null && !setup.running
  const quote = result?.quote ?? null
  const quoteUp = (quote?.changePercent ?? 0) >= 0
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

        <div className="kfc-scales">
          {scales.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`kfc-scale ${scale === item.key ? 'active' : ''}`}
              title={`${item.label} · 历史 ${item.Lc} 根 / 预测 ${item.Lh} 根`}
              onClick={() => setScale(item.key)}
            >
              {item.key}
            </button>
          ))}
        </div>

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

        <button
          type="button"
          className="kfc-run"
          disabled={running}
          onClick={() => run({ silent: Boolean(result) })}
        >
          {running ? t('running') : result ? t('rerun') : t('run')}
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
                {priceStr(quote.price)}
                <span>{pct((quote.changePercent ?? 0) / 100)}</span>
              </div>
              <div className="kfc-quoteMeta">
                <span>开 {priceStr(quote.open)}</span>
                <span>高 {priceStr(quote.high)}</span>
                <span>低 {priceStr(quote.low)}</span>
                <span>量 {numStr(quote.volume)}</span>
                <span>{quoteTime(quote.time)}</span>
              </div>
            </>
          )}
          <div className="kfc-quoteSpacer" />
          {result && (
            <div className="kfc-quoteMeta">
              <span>{t('lastBar')} {result.asOf}</span>
              <span>{t('horizon')} {result.Lh} 根</span>
              <span className="kfc-chip">{result.source}</span>
              {result.adjustmentApplied ? <span className="kfc-chip">{t('adj')}</span> : null}
              {result.nPad > 0 ? <span className="kfc-chip warn">填充 {result.nPad}</span> : null}
              {resultAt > 0 ? (
                <span className="kfc-chip">{t('updated')} {relativeTime(new Date(resultAt).toISOString(), now)}</span>
              ) : null}
              {autoRefresh && !running ? (
                <span
                  className={`kfc-chip live ${tickState === 'fail' ? 'warn' : ''}`}
                  title={tickState === 'fail' ? t('watchFail') : t('watchHint')}
                >
                  <span className="kfc-dot" />
                  {tickState === 'fail' ? t('watchRetry') : t('watching')}
                </span>
              ) : null}
            </div>
          )}
        </section>
      )}

      <section className="kfc-main">
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

        {result && (
          <div className={`kfc-resultPane ${refreshing ? 'refreshing' : ''}`}>
            {refreshing && (
              <div className="kfc-refreshBar">
                <i style={{ width: `${progressPct}%` }} />
              </div>
            )}
            <ForecastChart data={result} height={340} />
            <div className="kfc-stats">
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
            </div>
          </div>
        )}

        {!result && !running && !error && (
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