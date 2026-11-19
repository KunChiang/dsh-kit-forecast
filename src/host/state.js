/**
 * 面板状态持久化（Host 半）。
 *
 * 存在 dataDir/state.json，包含：
 *   - watchlist：常用/自选股票（有序，最多 24 只）
 *   - last：最近一次预测（股票、周期、参数、完整结果），用于重开面板秒开
 *   - prefs：周期、质量档、涨跌停约束、实时跟随开关
 *   - notes：每只股票上次的周期（切股票时恢复自己习惯的粒度）
 *
 * 为什么放在 Host 而不是浏览器 localStorage：
 *   1. 关掉面板（组件卸载）后状态还在，重开即恢复；
 *   2. 换窗口、换机器上的同一 profile 都能读到；
 *   3. 结果里有 100 KB 级别的时间序列，放服务端不挤占浏览器配额。
 *
 * 写入用「临时文件 + rename」，避免进程在写一半时被杀导致 JSON 损坏。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MAX_WATCHLIST = 24
/** 每只股票+周期保留多少条历史预测用于回看对比。 */
const MAX_HISTORY_PER_TARGET = 12
/** 全局最多保留多少条（防止状态文件无限增长）。 */
const MAX_HISTORY_TOTAL = 120
const STATE_VERSION = 2

function emptyState() {
  return {
    version: STATE_VERSION,
    watchlist: [],
    last: null,
    prefs: {},
    notes: {},
    // 历史预测：用于在图上和真实走势对比
    // [{ code, scale, asOf, generatedAt, futureTimestamp 列表, close 分位, 中位收盘, 参数 }]
    history: [],
  }
}

/** 去掉 undefined 的键，避免前端把未传的偏好覆盖成 undefined。 */
function definedOnly(source) {
  const out = {}
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value !== undefined) out[key] = value
  }
  return out
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 只保留画图与展示需要的字段，避免把 pathBull/pathBear 这类冗余也存下来。 */
function trimResult(result) {
  if (!isRecord(result)) return null
  return {
    code: result.code,
    name: result.name,
    scale: result.scale,
    asOf: result.asOf,
    lastClose: result.lastClose,
    Lc: result.Lc,
    Lh: result.Lh,
    nPad: result.nPad,
    nPaths: result.nPaths,
    steps: result.steps,
    device: result.device,
    precision: result.precision,
    sampleSeconds: result.sampleSeconds,
    limitRate: result.limitRate,
    seed: result.seed,
    source: result.source,
    adjustmentApplied: result.adjustmentApplied,
    droppedForming: result.droppedForming,
    barsAvailable: result.barsAvailable,
    elapsedMs: result.elapsedMs,
    generatedAt: result.generatedAt,
    quote: result.quote ?? null,
    stats: result.stats,
    // 画图要看完整交易日（1m 一天 240 根），所以保留 400 根
    history: Array.isArray(result.history) ? result.history.slice(-400) : [],
    futureTimestamps: result.futureTimestamps ?? [],
    bands: result.bands ?? {},
    pathMedian: result.pathMedian ?? [],
  }
}

/**
 * 历史预测的存档形态：只留对比要用的东西（asOf、未来时间轴、收盘分位、参数），
 * 完整 OHLCV 路径不存，画图时只需要收盘分位带。
 */
function trimHistoryEntry(result) {
  if (!isRecord(result) || !Array.isArray(result.futureTimestamps)) return null
  const close = result.bands?.close ?? {}
  return {
    code: result.code,
    name: result.name,
    scale: result.scale,
    asOf: result.asOf,
    generatedAt: result.generatedAt ?? new Date().toISOString(),
    lastClose: result.lastClose,
    Lh: result.Lh,
    nPaths: result.nPaths,
    steps: result.steps,
    future: result.futureTimestamps,
    close: {
      q05: close.q05 ?? [],
      q25: close.q25 ?? [],
      q50: close.q50 ?? [],
      q75: close.q75 ?? [],
      q95: close.q95 ?? [],
    },
    stats: isRecord(result.stats) ? {
      retMedian: result.stats.retMedian,
      upProb: result.stats.upProb,
      targetMedian: result.stats.targetMedian,
    } : {},
    warm: result.warm ?? null,
  }
}

export function createStateStore(dataDir, logger = console) {
  const file = join(dataDir, 'state.json')
  let cache = null
  let cachedMtime = 0
  let lastWrite = 0

  function read() {
    // 文件被外部改过（另一个窗口/进程写了状态）时丢掉缓存重新读，
    // 否则本进程会一直用旧快照。
    const mtime = currentMtime()
    if (cache && mtime === cachedMtime) return cache
    try {
      if (!existsSync(file)) {
        cache = emptyState()
        cachedMtime = 0
        return cache
      }
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      cache = normalize(parsed)
      cachedMtime = mtime
    } catch (error) {
      logger.warn?.(`[kit-forecast] state.json 读取失败，按空状态处理：${error.message}`)
      cache = emptyState()
      cachedMtime = 0
    }
    return cache
  }

  function currentMtime() {
    try {
      return existsSync(file) ? statSync(file).mtimeMs : 0
    } catch {
      return 0
    }
  }

  function normalize(raw) {
    const base = emptyState()
    if (!isRecord(raw)) return base
    if (Array.isArray(raw.watchlist)) {
      base.watchlist = raw.watchlist
        .filter((item) => isRecord(item) && typeof item.code === 'string' && item.code !== '')
        .map((item) => ({
          code: String(item.code),
          name: typeof item.name === 'string' ? item.name : String(item.code),
          pinned: item.pinned === true,
          at: Number.isFinite(item.at) ? item.at : 0,
        }))
        .slice(0, MAX_WATCHLIST)
    }
    base.last = isRecord(raw.last) && isRecord(raw.last.result) ? raw.last : null
    base.prefs = isRecord(raw.prefs) ? raw.prefs : {}
    base.notes = isRecord(raw.notes) ? raw.notes : {}
    if (Array.isArray(raw.history)) {
      base.history = raw.history
        .filter((entry) => isRecord(entry) && typeof entry.code === 'string' && Array.isArray(entry.future))
        .slice(-MAX_HISTORY_TOTAL)
    }
    return base
  }

  function write(next) {
    cache = next
    cachedMtime = currentMtime()
    try {
      mkdirSync(dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      writeFileSync(tmp, JSON.stringify(next), 'utf8')
      renameSync(tmp, file)
      lastWrite = Date.now()
      cachedMtime = currentMtime()
    } catch (error) {
      logger.warn?.(`[kit-forecast] state.json 写入失败：${error.message}`)
    }
    return next
  }

  return {
    file,
    read,
    /** 合并式更新：只覆盖传入的字段。 */
    patch(partial) {
      const current = read()
      const next = { ...current }
      if (Array.isArray(partial.watchlist)) next.watchlist = partial.watchlist.slice(0, MAX_WATCHLIST)
      if ('last' in partial) next.last = partial.last === null ? null : { ...partial.last, result: trimResult(partial.last?.result) }
      if (isRecord(partial.prefs)) next.prefs = { ...current.prefs, ...definedOnly(partial.prefs) }
      if (isRecord(partial.notes)) next.notes = { ...current.notes, ...definedOnly(partial.notes) }
      if (Array.isArray(partial.history)) next.history = partial.history.slice(-MAX_HISTORY_TOTAL)
      next.version = STATE_VERSION
      return write(next)
    },
    /** 记录一次预测：更新 last、把股票推进 watchlist（不改变 pinned 的置顶顺序语义）。 */
    remember(result, prefs = {}) {
      const current = read()
      const code = result?.code
      const name = result?.name
      const now = Date.now()
      let watchlist = current.watchlist.filter((item) => item.code !== code)
      if (code) {
        watchlist = [{ code, name: name ?? String(code), pinned: false, at: now }, ...watchlist]
        const pinned = watchlist.filter((item) => item.pinned)
        const rest = watchlist.filter((item) => !item.pinned)
        watchlist = [...pinned, ...rest]
          .sort((a, b) => (a.pinned === b.pinned ? b.at - a.at : Number(b.pinned) - Number(a.pinned)))
          .slice(0, MAX_WATCHLIST)
      }
      const notes = { ...current.notes }
      if (code && result?.scale) notes[code] = result.scale

      // 历史预测：同一 anchor（同一根收盘 bar）只留最新一条，
      // 否则重复点「重新预测」会把列表刷满同一天的记录。
      const entry = trimHistoryEntry(result)
      let history = current.history ?? []
      if (entry) {
        const anchor = `${entry.code}|${entry.scale}|${entry.asOf}`
        history = history.filter((item) => `${item.code}|${item.scale}|${item.asOf}` !== anchor)
        history.push(entry)
        // 每个目标只留最近 N 条
        const sameTarget = history.filter((item) => item.code === entry.code && item.scale === entry.scale)
        if (sameTarget.length > MAX_HISTORY_PER_TARGET) {
          const drop = new Set(sameTarget.slice(0, sameTarget.length - MAX_HISTORY_PER_TARGET))
          history = history.filter((item) => !drop.has(item))
        }
        history = history.slice(-MAX_HISTORY_TOTAL)
      }

      return write({
        ...current,
        watchlist,
        notes,
        history,
        prefs: { ...current.prefs, ...definedOnly(prefs) },
        last: { at: now, result: trimResult(result) },
        version: STATE_VERSION,
      })
    },
    invalidate() {
      cache = null
      cachedMtime = 0
    },
    get lastWrite() {
      return lastWrite
    },
    get mtimeMs() {
      try {
        return existsSync(file) ? statSync(file).mtimeMs : 0
      } catch {
        return 0
      }
    },
  }
}