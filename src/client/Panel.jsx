import React from 'react'
import { fetchStatus, runForecast, runSetup, searchStocks } from './api.js'
import { ForecastChart } from './Chart.jsx'
import { NS } from './i18n.js'

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

function StatCard({ label, value, hint, tone }) {
  return (
    <div className="kfc-statCard">
      <div className="kfc-statLabel">{label}</div>
      <div className={`kfc-statValue ${tone ?? ''}`}>{value}</div>
      {hint ? <div className="kfc-statHint">{hint}</div> : null}
    </div>
  )
}

export function KitForecastPanel({ ctx }) {
  const t = ctx.locale.bind(NS)
  const [, setLocaleTick] = React.useState(0)
  React.useEffect(() => ctx.locale.subscribe(() => setLocaleTick((v) => v + 1)), [ctx])

  const [status, setStatus] = React.useState(null)
  const [setup, setSetup] = React.useState({ running: false, logs: [], error: null })

  const [keyword, setKeyword] = React.useState('')
  const [suggestions, setSuggestions] = React.useState([])
  const [selected, setSelected] = React.useState(null)
  const [scale, setScale] = React.useState('1d')
  const [quality, setQuality] = React.useState('standard')
  const [applyLimit, setApplyLimit] = React.useState(true)
  const [autoRefresh, setAutoRefresh] = React.useState(false)

  const [phase, setPhase] = React.useState('idle') // idle | running | done | error
  const [stage, setStage] = React.useState('')
  const [progress, setProgress] = React.useState({ step: 0, total: 0 })
  const [result, setResult] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [elapsed, setElapsed] = React.useState(0)

  const abortRef = React.useRef(null)
  const runningRef = React.useRef(false)
  const startedRef = React.useRef(0)

  const running = phase === 'running'
  runningRef.current = running

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

  React.useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  // 运行计时
  React.useEffect(() => {
    if (phase !== 'running') return undefined
    const id = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 200)
    return () => clearInterval(id)
  }, [phase])

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
    }, 260)
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

  const run = React.useCallback(async (codeOverride) => {
    const code = codeOverride ?? selected?.code
    if (!code) {
      setError('请先输入股票代码或名称，并从联想列表里选一只股票')
      setPhase('error')
      return
    }
    if (status && status.ready === false) {
      setError('运行环境还没准备好，请先完成初始化')
      setPhase('error')
      return
    }
    const budget = (status?.scales ?? []).find((item) => item.key === scale)
    const factor = QUALITY.find((item) => item.key === quality) ?? QUALITY[1]
    const nPaths = Math.max(1, Math.round((budget?.defaultPaths ?? 12) * factor.paths))
    const steps = Math.max(1, Math.round((budget?.defaultSteps ?? 20) * factor.steps))

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('running')
    setError(null)
    setResult(null)
    setStage('准备中…')
    setProgress({ step: 0, total: 0 })
    startedRef.current = Date.now()
    setElapsed(0)

    let failed = false
    try {
      await runForecast({ code, scale, nPaths, steps, applyLimit }, {
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
            setResult(event.data)
            setStage('')
          } else if (event.t === 'fail') {
            failed = true
            setError(event.message)
            setPhase('error')
          }
        },
      })
      if (!failed) setPhase('done')
    } catch (err) {
      if (err.name === 'AbortError') {
        setPhase('idle')
        setStage('')
      } else {
        setError(err.message)
        setPhase('error')
      }
    } finally {
      abortRef.current = null
    }
  }, [selected, scale, quality, status, applyLimit])

  // 实时跟随
  React.useEffect(() => {
    if (!autoRefresh) return undefined
    const interval = scale === '1d' ? 120000 : 60000
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && !runningRef.current) run()
    }, interval)
    return () => clearInterval(id)
  }, [autoRefresh, scale, run])

  const pick = (item) => {
    setSelected(item)
    setKeyword(`${item.name} ${item.code}`)
    setSuggestions([])
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
      run(parsed.code)
    }
  }

  const scales = status?.scales?.length
    ? status.scales
    : SCALE_ORDER.map((key) => ({ key, label: key, Lc: 0, Lh: 0 }))
  const ready = status?.ready === true
  const setupVisible = !ready && status !== null && !setup.running
  const quote = result?.quote ?? null
  const quoteUp = (quote?.changePercent ?? 0) >= 0

  return (
    <div className="kfc-root">
      <header className="kfc-header">
        <div className="kfc-mark"><PanelIcon size={18} /></div>
        <div className="kfc-headCopy">
          <h1 className="kfc-title">{t('title')}<small>{t('titleTag')}</small></h1>
          <p className="kfc-sub">{t('subtitle')}</p>
        </div>
        <div className="kfc-headActions">
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
            onChange={(event) => {
              setKeyword(event.target.value)
              setSelected(null)
            }}
            onKeyDown={onKeywordKey}
          />
          {suggestions.length > 0 && (
            <div className="kfc-suggest">
              {suggestions.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className="kfc-suggestItem"
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

        <button type="button" className="kfc-run" disabled={running} onClick={() => run()}>
          {running ? t('running') : result ? t('rerun') : t('run')}
        </button>
      </section>

      {(quote || selected) && (
        <section className="kfc-quote">
          <div className="kfc-quoteName">
            <b>{result?.name ?? selected?.name ?? ''}</b>
            <span>{result?.code ?? selected?.code ?? ''}</span>
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
            </div>
          )}
        </section>
      )}

      <section className="kfc-main">
        {running && (
          <div className="kfc-progressPane">
            <div className="kfc-progressHead">
              <span className="kfc-spinner" />
              <b>{stage || t('working')}</b>
              <span className="kfc-elapsed">{elapsed.toFixed(1)}s</span>
            </div>
            <div className="kfc-bar">
              <i style={{ width: `${progress.total > 0 ? Math.round((progress.step / progress.total) * 100) : 6}%` }} />
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
          <>
            <ForecastChart data={result} height={340} />
            <div className="kfc-stats">
              <StatCard
                label={t('stat.median')}
                value={pct(result.stats.retMedian)}
                tone={result.stats.retMedian >= 0 ? 'up' : 'down'}
                hint={`${t('stat.target')} ${priceStr(result.stats.targetMedian)}`}
              />
              <StatCard
                label={t('stat.upProb')}
                value={`${(result.stats.upProb * 100).toFixed(0)}%`}
                tone={result.stats.upProb >= 0.5 ? 'up' : 'down'}
                hint={`${t('stat.q05q95')} ${pct(result.stats.retQ05)} ~ ${pct(result.stats.retQ95)}`}
              />
              <StatCard
                label={t('stat.range')}
                value={`${priceStr(result.stats.targetQ05)} ~ ${priceStr(result.stats.targetQ95)}`}
                hint={t('stat.rangeHint')}
              />
              <StatCard
                label={t('stat.vol')}
                value={pct(result.stats.volMedian)}
                hint={`${t('stat.drawdown')} ${pct(result.stats.maxDdMedian)}`}
              />
              <StatCard
                label={t('stat.paths')}
                value={`${result.nPaths} × ${result.steps}`}
                hint={`${result.device} · ${result.sampleSeconds}s`}
              />
            </div>
          </>
        )}

        {!result && !running && !error && (
          <div className="kfc-empty">
            <PanelIcon size={32} />
            <div className="kfc-emptyTitle">{t('emptyTitle')}</div>
            <div className="kfc-emptyBody">{t('emptyBody')}</div>
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