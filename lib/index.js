/**
 * KiT A 股实时走势预测 —— Host 半。
 *
 * 职责：
 * 1. 行情层：从新浪 / 腾讯实时抓取 A 股多周期 K 线与盘口（见 datasource.js）；
 * 2. 推理层：拉起常驻 Python worker（runtime/engine.py）加载 KiT-284M 做条件扩散采样；
 * 3. 接口层：通过 connection.fetch 的 /api/kit-forecast/* 路由把进度以 SSE 推给浏览器半。
 *
 * 本文件不写任何用户数据；模型权重按需下载到 dataDir（默认 $DSH_HOME/kit-forecast）。
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDEXES, SCALES, MarketData, isIndex, normalizeCode } from './datasource.js'
import { KitEngine } from './engine.js'
import { InsightService } from './insight.js'
import { NewsFeed } from './news.js'
import { createStateStore } from './state.js'

export const name = 'kit-forecast'

const ROUTE_BASE = '/api/kit-forecast'

/** 各周期的默认采样预算（越小越快，越大分布越稳）。 */
const DEFAULT_BUDGET = {
  // 序列越长单步越贵：路径数 × 步数 ≈ 单次预测的 forward 次数，
  // 下面的预算在 M4 GPU 上各周期的耗时大致都在 20 秒上下。
  '1m': { paths: 4, steps: 8 },
  '5m': { paths: 6, steps: 10 },
  '15m': { paths: 6, steps: 10 },
  '30m': { paths: 8, steps: 12 },
  '1h': { paths: 8, steps: 14 },
  '2h': { paths: 8, steps: 14 },
  '1d': { paths: 12, steps: 16 },
}

const MAX_PATHS = 48
const MAX_STEPS = 64

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function noStoreJson(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function failure(code, message, status = 400) {
  return noStoreJson({ ok: false, error: { code, message } }, status)
}

function errorText(error) {
  if (error instanceof Error) return error.message || error.name
  return String(error)
}

function asString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function asInt(value, fallback, min, max) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function sseResponse(run) {
  const encoder = new TextEncoder()
  let closed = false
  let doneSent = false
  let controllerRef = null
  const stream = new ReadableStream({
    async start(controller) {
      controllerRef = controller
      const send = (event) => {
        if (closed) return
        if (event?.t === 'done') doneSent = true
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          closed = true
        }
      }
      try {
        await run(send)
      } catch (error) {
        send({ t: 'fail', message: errorText(error) })
      } finally {
        if (!closed) {
          if (!doneSent) send({ t: 'done' })
          closed = true
          try {
            controller.close()
          } catch {
            // 已关闭
          }
        }
      }
    },
    cancel() {
      closed = true
      try {
        controllerRef?.close()
      } catch {
        // 已关闭
      }
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}

// ---------------------------------------------------------------------------
// 运行环境（Python / 模型目录）
// ---------------------------------------------------------------------------

function findPluginRoot(start) {
  let dir = start
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'runtime', 'engine.py'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return start
}

const PLUGIN_ROOT = findPluginRoot(dirname(fileURLToPath(import.meta.url)))

function venvPythonOf(dir) {
  return process.platform === 'win32'
    ? join(dir, 'venv', 'Scripts', 'python.exe')
    : join(dir, 'venv', 'bin', 'python')
}

/**
 * 运行时目录。优先用配置/环境变量指定的 dataDir；
 * 若它还没初始化，而某个 seed 目录（例如开发目录里已准备好的 runtime）已经就绪，
 * 就直接把那个目录当 dataDir 用，省掉一次 1.1 GB 下载。
 */
function resolvePaths(config) {
  const configured = asString(config.dataDir) ?? process.env.DSH_KIT_FORECAST_HOME
  const dataDir = resolve(configured ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'kit-forecast'))

  const seedDirs = [
    ...(Array.isArray(config.seedDirs) ? config.seedDirs : []),
    ...(asString(process.env.DSH_KIT_FORECAST_SEED) ? String(process.env.DSH_KIT_FORECAST_SEED).split(delimiter) : []),
    join(PLUGIN_ROOT, 'prepared'),
  ]
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .map((item) => resolve(item))
    .filter((item) => item !== dataDir)

  const usable = (dir) => modelFilesReady(join(dir, 'ckpt')) && existsSync(venvPythonOf(dir))
  let effective = dataDir
  if (configured === undefined && !usable(dataDir)) {
    const seed = seedDirs.find(usable)
    if (seed) effective = seed
  }

  const ckptDir = join(effective, 'ckpt')
  const venvPython = venvPythonOf(effective)
  const python = asString(config.python)
    ?? (existsSync(venvPython) ? venvPython : (existsSync('/opt/homebrew/bin/python3') ? '/opt/homebrew/bin/python3' : 'python3'))
  return {
    dataDir: effective,
    requestedDataDir: dataDir,
    seedDirs,
    ckptDir,
    venvDir: join(effective, 'venv'),
    venvPython,
    python,
    enginePath: join(PLUGIN_ROOT, 'runtime', 'engine.py'),
    fetchScript: join(PLUGIN_ROOT, 'scripts', 'fetch-model.mjs'),
  }
}

function modelFilesReady(ckptDir) {
  const need = ['step_market_284M.pt', 'stats.json', 'instruments.json']
  return need.every((file) => existsSync(join(ckptDir, file)))
}

/** 判断某个 python 能不能 import torch（结果短时缓存）。 */
function createPythonProbe() {
  const cache = new Map()
  return function probe(python) {
    const hit = cache.get(python)
    if (hit && Date.now() - hit.at < 60 * 1000) return Promise.resolve(hit.value)
    return new Promise((resolveProbe) => {
      const child = spawn(python, ['-c', 'import torch,sys;print(torch.__version__);print(1 if torch.backends.mps.is_available() else 0)'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let out = ''
      let err = ''
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // 忽略
        }
      }, 20000)
      child.stdout.on('data', (chunk) => { out += chunk })
      child.stderr.on('data', (chunk) => { err += chunk })
      child.on('error', (error) => {
        clearTimeout(timer)
        const value = { ok: false, error: errorText(error) }
        cache.set(python, { at: Date.now(), value })
        resolveProbe(value)
      })
      child.on('exit', (code) => {
        clearTimeout(timer)
        const lines = out.trim().split('\n')
        const value = code === 0 && lines.length >= 1
          ? { ok: true, torch: lines[0], mps: lines[1] === '1' }
          : { ok: false, error: err.trim().split('\n').slice(-1)[0] ?? `退出码 ${code}` }
        cache.set(python, { at: Date.now(), value })
        resolveProbe(value)
      })
    })
  }
}

/** 顺序执行命令并把输出行转成进度事件。 */
function runStreaming(command, args, { cwd, env, onLine, timeoutMs = 1800000 } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill('SIGKILL')
      } catch {
        // 忽略
      }
      rejectRun(new Error(`命令超时：${command} ${args.join(' ')}`))
    }, timeoutMs)

    const pump = (stream) => {
      stream.setEncoding('utf8')
      let buffer = ''
      stream.on('data', (chunk) => {
        buffer += chunk
        let index = buffer.indexOf('\n')
        while (index >= 0) {
          const line = buffer.slice(0, index).replace(/\r/g, '').trim()
          buffer = buffer.slice(index + 1)
          if (line !== '') onLine?.(line)
          index = buffer.indexOf('\n')
        }
        // 下载脚本用 \r 刷新进度，这里也顺手转一下
        const tail = buffer.replace(/\r/g, '').trim()
        if (tail !== '' && buffer.includes('\r')) onLine?.(tail)
      })
    }
    pump(child.stdout)
    pump(child.stderr)
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      rejectRun(error)
    })
    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) resolveRun()
      else rejectRun(new Error(`命令失败（code=${code}）：${command} ${args.join(' ')}`))
    })
  })
}

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------


/**
 * 把一条历史预测与「后来真实走出来的 K 线」对齐，算出它当时准不准。
 *
 * 对齐规则：历史预测的窗口是 asOf 之后的 Lh 根；只取已经收盘的那些 bar
 * （当前 bars 里 t > asOf 的部分），没走完的部分留空。
 */
function buildOverlay(entry, bars) {
  const index = new Map(bars.map((bar, i) => [bar.t, i]))
  const anchorIndex = index.get(entry.asOf)
  if (anchorIndex === undefined) return null

  const points = []
  for (let i = 0; i < entry.future.length; i += 1) {
    const t = entry.future[i]
    const actual = bars[index.get(t)]
    points.push({
      t,
      q05: entry.close.q05?.[i] ?? null,
      q25: entry.close.q25?.[i] ?? null,
      q50: entry.close.q50?.[i] ?? null,
      q75: entry.close.q75?.[i] ?? null,
      q95: entry.close.q95?.[i] ?? null,
      actual: actual ? actual.c : null,
    })
  }

  const realized = points.filter((point) => point.actual !== null)
  const anchorClose = bars[anchorIndex].c
  let verify = null
  if (realized.length > 0) {
    const last = realized[realized.length - 1]
    const predRet = entry.close.q50?.length ? Math.log((entry.close.q50[realized.length - 1] ?? anchorClose) / anchorClose) : 0
    const actualRet = Math.log(last.actual / anchorClose)
    const insideBand = last.q05 !== null && last.q95 !== null
      ? last.actual >= last.q05 && last.actual <= last.q95
      : null
    const inInterquartile = last.q25 !== null && last.q75 !== null
      ? last.actual >= last.q25 && last.actual <= last.q75
      : null
    verify = {
      realizedBars: realized.length,
      totalBars: entry.future.length,
      complete: realized.length >= entry.future.length,
      predRet,
      actualRet,
      error: actualRet - predRet,
      insideBand,
      inInterquartile,
      directionHit: Math.sign(predRet) === Math.sign(actualRet),
    }
  }

  return {
    id: `${entry.code}|${entry.scale}|${entry.asOf}`,
    code: entry.code,
    scale: entry.scale,
    asOf: entry.asOf,
    generatedAt: entry.generatedAt,
    lastClose: entry.lastClose,
    nPaths: entry.nPaths,
    steps: entry.steps,
    warm: entry.warm ?? null,
    points,
    verify,
  }
}

/** 取最近若干条历史预测（排除当前这根 anchor，避免和自己比）。 */
function overlaysFor(store, code, scale, bars, excludeAsOf, limit) {
  const entries = (store.read().history ?? [])
    .filter((entry) => entry.code === code && entry.scale === scale && entry.asOf !== excludeAsOf)
    .slice(-limit)
  return entries.map((entry) => buildOverlay(entry, bars)).filter(Boolean)
}

function createServer(ctx, config, paths, overrides = {}) {
  const logger = ctx.logger ?? console
  const market = overrides.market ?? new MarketData({ logger })
  const engine = overrides.engine ?? new KitEngine({
    python: paths.python,
    enginePath: paths.enginePath,
    ckptDir: paths.ckptDir,
    device: config.device,
    logger,
    timeoutMs: config.timeoutMs,
  })
  const probePython = createPythonProbe()
  // statePath 可显式指定：开发脚本让它指向临时目录，避免污染用户真实收藏
  const store = createStateStore(paths.dataDir, logger, config.statePath)
  const feed = overrides.feed ?? new NewsFeed({ logger })
  const insight = overrides.insight ?? new InsightService(ctx, logger)
  let setupRunning = false

  async function handleState(request) {
    const body = await request.json().catch(() => ({}))
    // 传了内容就是写入（合并式），空 body 就是读取
    const hasPatch = Object.keys(body ?? {}).length > 0
    if (hasPatch) {
      // 显式「彻底删除某只股票」：连 last / notes / history 一起清
      const forgetCode = asString(body.forget)
      if (forgetCode) {
        const next = store.forget(forgetCode)
        return noStoreJson({ ok: true, state: next })
      }
      const next = store.patch({
        ...(Array.isArray(body.watchlist) ? { watchlist: body.watchlist } : {}),
        ...('last' in body ? { last: body.last } : {}),
        ...(body.prefs && typeof body.prefs === 'object' ? { prefs: body.prefs } : {}),
        ...(body.notes && typeof body.notes === 'object' ? { notes: body.notes } : {}),
      })
      return noStoreJson({ ok: true, state: next })
    }
    return noStoreJson({ ok: true, state: store.read() })
  }

  /** 把一次预测结果记进 watchlist 与 last，供下次打开面板秒恢复。 */
  function rememberResult(result, prefs) {
    try {
      store.remember(result, prefs)
    } catch (error) {
      logger.warn?.(`[kit-forecast] 记录预测状态失败：${errorText(error)}`)
    }
  }

  async function handleStatus() {
    const python = await probePython(paths.python)
    const ready = modelFilesReady(paths.ckptDir)
    return noStoreJson({
      ok: true,
      dataDir: paths.dataDir,
      ckptDir: paths.ckptDir,
      python: paths.python,
      pythonPath: paths.python,
      venvPython: paths.venvPython,
      env: python,
      modelReady: ready,
      engineAlive: engine.alive,
      scales: Object.entries(SCALES).map(([key, value]) => ({
        key,
        label: value.label,
        Lc: value.Lc,
        Lh: value.Lh,
        defaultPaths: DEFAULT_BUDGET[key].paths,
        defaultSteps: DEFAULT_BUDGET[key].steps,
      })),
      store: {
        file: store.file,
        exists: existsSync(store.file),
        bytes: (() => {
          try {
            return existsSync(store.file) ? statSync(store.file).size : 0
          } catch {
            return 0
          }
        })(),
        watchlist: store.read().watchlist.length,
        history: (store.read().history ?? []).length,
      },
      ready: python.ok && ready,
    })
  }

  async function handleSearch(request) {
    const body = await request.json().catch(() => ({}))
    const keyword = asString(body.keyword) ?? ''
    if (keyword === '') return failure('kit-forecast/search', '请输入代码或名称')
    const items = await market.search(keyword)
    return noStoreJson({ ok: true, items })
  }

  async function handleQuote(request) {
    const body = await request.json().catch(() => ({}))
    const code = asString(body.code)
    if (!code) return failure('kit-forecast/quote', '缺少股票代码')
    const quote = await market.quote(code)
    return noStoreJson({ ok: true, quote })
  }

  /**
   * 轻量「心跳」：只回答「最后一根已收盘 K 线是哪根」+ 当前盘口。
   * 前端拿它判断要不要重算，避免定时器无条件重跑一次 20~80 秒的采样。
   */
  async function handleTick(request) {
    const body = await request.json().catch(() => ({}))
    const code = asString(body.code)
    const scale = asString(body.scale) ?? '1d'
    if (!code) return failure('kit-forecast/tick', '缺少股票代码')
    if (!SCALES[scale]) return failure('kit-forecast/tick', `不支持的周期：${scale}`)
    const norm = normalizeCode(code)
    if (!norm) return failure('kit-forecast/tick', `无法识别的股票代码：${code}`)
    // 两个来源互相独立：行情挂了也要能回答 asOf，bars 挂了也要能回答盘口，
    // 否则一次网络抖动就会让面板的「实时」停摆。
    const [barsResult, quoteResult] = await Promise.allSettled([
      market.bars(code, scale),
      market.quote(code),
    ])
    const data = barsResult.status === 'fulfilled' ? barsResult.value : null
    const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null
    if (!data && !quote) {
      return failure('kit-forecast/tick', `行情与 K 线都取不到（${norm.code}）`, 503)
    }
    return noStoreJson({
      ok: true,
      code: data?.code ?? norm.code,
      scale,
      asOf: data?.bars?.at(-1)?.t ?? null,
      bars: data?.bars?.length ?? null,
      droppedForming: data?.droppedForming ?? null,
      // 未收盘的那根：前端画成动态蜡烛，盘中能直接看到它长出来
      forming: data?.forming ?? null,
      source: data?.source ?? null,
      quote,
      quoteError: quoteResult.status === 'rejected' ? errorText(quoteResult.reason) : null,
      barsError: barsResult.status === 'rejected' ? errorText(barsResult.reason) : null,
    })
  }

  /** 历史预测对比：给前端画「上次怎么说的、实际怎么走的」。 */
  async function handleHistory(request) {
    const body = await request.json().catch(() => ({}))
    const codeInput = asString(body.code)
    const scale = asString(body.scale) ?? '1d'
    if (!codeInput) return failure('kit-forecast/history', '缺少股票代码')
    const norm = normalizeCode(codeInput)
    if (!norm) return failure('kit-forecast/history', `无法识别的股票代码：${codeInput}`)
    const limit = asInt(body.limit, 3, 1, 12)
    const data = await market.bars(norm.code, scale)
    // 统一用归一化后的代码匹配，避免 600519 / 600519.SH 这类写法对不上
    const overlays = overlaysFor(store, norm.code, scale, data.bars, asString(body.excludeAsOf), limit)
    return noStoreJson({ ok: true, overlays })
  }

  /**
   * 大盘概览：主要指数的实时报价 + 涨跌家数。
   * 一次批量请求拿 8 个指数；宽度数据单独一路，失败不影响指数列表。
   */
  async function handleMarket() {
    const [quotes, breadth] = await Promise.all([
      market.quotes(INDEXES.map((item) => item.code)).catch((error) => {
        logger.warn?.(`[kit-forecast] 指数报价失败：${errorText(error)}`)
        return []
      }),
      market.breadth().catch(() => null),
    ])
    const byCode = new Map(quotes.map((q) => [q.code, q]))
    const items = INDEXES.map((meta) => {
      const quote = byCode.get(meta.code) ?? null
      return {
        code: meta.code,
        name: meta.name,
        short: meta.short,
        group: meta.group,
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
        open: quote?.open ?? null,
        high: quote?.high ?? null,
        low: quote?.low ?? null,
        prevClose: quote?.prevClose ?? null,
        amount: quote?.amount ?? null,
        time: quote?.time ?? null,
      }
    })
    const totalUp = (breadth ?? []).reduce((sum, item) => sum + item.up, 0)
    const totalDown = (breadth ?? []).reduce((sum, item) => sum + item.down, 0)
    const totalFlat = (breadth ?? []).reduce((sum, item) => sum + item.flat, 0)
    return noStoreJson({
      ok: true,
      indices: items,
      breadth: breadth
        ? { up: totalUp, down: totalDown, flat: totalFlat, parts: breadth }
        : null,
      fetchedAt: Date.now(),
    })
  }

  /**
   * AI 解读：把大盘 / 个股 / 预测 / 公告新闻交给模型，SSE 流式返回。
   * 前端可以只传自己手上已有的数据；缺的部分这里现取。
   */
  async function handleInsight(request) {
    const body = await request.json().catch(() => ({}))
    const codeInput = asString(body.code)

    return sseResponse(async (send) => {
      const abort = new AbortController()
      const onAbort = () => abort.abort(new Error('客户端已断开'))
      if (request.signal.aborted) onAbort()
      else request.signal.addEventListener('abort', onAbort, { once: true })

      try {
        send({ t: 'stage', message: '收集数据' })

        // 大盘概览：前端没传就现取（注意这是路由返回的普通对象，不是 MarketData 实例）
        let marketOverview = body.market ?? null
        if (!marketOverview) {
          const res = await handleMarket()
          marketOverview = await res.json().catch(() => null)
        }

        let stock = body.stock ?? null
        let news = body.news ?? null
        let forecast = body.forecast ?? null
        if (codeInput) {
          const norm = normalizeCode(codeInput)
          if (!norm) throw new Error(`无法识别的股票代码：${codeInput}`)
          // 个股行情走数据实例，而不是概览对象
          if (!stock) stock = await market.quote(norm.code).catch(() => null)
          if (!news) news = await feed.digest(norm.code, { notices: 8, newsLimit: 8 }).catch(() => null)
        }

        send({ t: 'stage', message: '生成解读' })
        const result = await insight.stream(
          { market: marketOverview, stock, forecast, news, scale: body.scale },
          (delta) => send({ t: 'delta', text: delta }),
          abort.signal,
        )
        send({ t: 'result', model: result.model, modelName: result.modelName, chars: result.text.length })
      } finally {
        request.signal.removeEventListener('abort', onAbort)
      }
    })
  }

  /** 公告 + 新闻。任何一路失败都不影响另一路。 */
  async function handleNews(request) {
    const body = await request.json().catch(() => ({}))
    const codeInput = asString(body.code)
    if (!codeInput) return failure('kit-forecast/news', '缺少股票代码')
    const norm = normalizeCode(codeInput)
    if (!norm) return failure('kit-forecast/news', `无法识别的股票代码：${codeInput}`)
    const notices = asInt(body.notices, 10, 1, 30)
    const newsLimit = asInt(body.news, 10, 1, 30)
    const digest = await feed.digest(norm.code, { notices, newsLimit, force: body.force === true })
    return noStoreJson({ ok: true, ...digest })
  }

  async function handleBars(request) {
    const body = await request.json().catch(() => ({}))
    const code = asString(body.code)
    const scale = asString(body.scale) ?? '1d'
    if (!code) return failure('kit-forecast/bars', '缺少股票代码')
    const result = await market.bars(code, scale)
    const tail = result.bars.slice(-Math.max(1, Math.min(300, Number(body.limit ?? 120))))
    return noStoreJson({
      ok: true,
      code: result.code,
      scale,
      source: result.source,
      adjustmentApplied: result.adjustmentApplied,
      droppedForming: result.droppedForming,
      bars: tail,
      total: result.bars.length,
    })
  }

  async function handleSetup(request) {
    if (setupRunning) return failure('kit-forecast/setup', '初始化已在进行中', 409)
    const body = await request.json().catch(() => ({}))
    const skipPip = body.skipPip === true
    const skipModel = body.skipModel === true

    return sseResponse(async (send) => {
      setupRunning = true
      try {
        mkdirSync(paths.dataDir, { recursive: true })
        mkdirSync(paths.ckptDir, { recursive: true })

        send({ t: 'stage', stage: 'python', message: '检查 Python 解释器' })
        const probe = await probePython(paths.python)
        send({ t: 'log', line: `python=${paths.python} torch=${probe.ok ? probe.torch : '未安装'}` })
        send({ t: 'log', line: `运行时目录 ${paths.dataDir}` })

        if (probe.ok && modelFilesReady(paths.ckptDir)) {
          send({ t: 'log', line: '依赖与权重都已就绪，无需重新安装。' })
        }
        if (!probe.ok && !skipPip) {
          send({ t: 'stage', stage: 'venv', message: `创建虚拟环境 ${paths.venvDir}` })
          mkdirSync(paths.dataDir, { recursive: true })
          const uv = findBinary('uv')
          if (uv) {
            await runStreaming(uv, ['venv', paths.venvDir, '--python', paths.python === 'python3' ? '3.12' : paths.python], {
              onLine: (line) => send({ t: 'log', line }),
            })
          } else {
            await runStreaming(paths.python, ['-m', 'venv', paths.venvDir], {
              onLine: (line) => send({ t: 'log', line }),
            })
          }
          if (!existsSync(paths.venvPython)) throw new Error('虚拟环境创建失败：找不到 ' + paths.venvPython)

          send({ t: 'stage', stage: 'pip', message: '安装依赖（numpy / pandas / torch，约 300 MB）' })
          const indexArgs = config.indexUrl ? ['--index-url', config.indexUrl] : []
          if (uv) {
            await runStreaming(uv, ['pip', 'install', '--python', paths.venvPython, ...indexArgs, 'numpy<2.3', 'pandas<3', 'torch>=2.4'], {
              onLine: (line) => send({ t: 'log', line }),
            })
          } else {
            await runStreaming(paths.venvPython, ['-m', 'pip', 'install', ...indexArgs, 'numpy<2.3', 'pandas<3', 'torch>=2.4'], {
              onLine: (line) => send({ t: 'log', line }),
            })
          }
          paths.python = paths.venvPython
          engine.python = paths.venvPython
          const after = await probePython(paths.venvPython)
          if (!after.ok) throw new Error(`依赖安装完成，但 import torch 失败：${after.error}`)
        }

        if (!modelFilesReady(paths.ckptDir) && !skipModel) {
          send({ t: 'stage', stage: 'model', message: '下载 KiT 权重（1.1 GB，支持断点续传）' })
          // 注意：Electron 里 process.execPath 是 App 本体，不能直接当 node 用
          await runStreaming(nodeBinary(), [paths.fetchScript, '--dir', paths.ckptDir], {
            onLine: (line) => send({ t: 'log', line }),
            env: { KIT_HF_HOST: config.hfHost ?? 'https://hf-mirror.com' },
          })
        }

        if (!modelFilesReady(paths.ckptDir)) throw new Error('模型文件不完整')
        send({ t: 'stage', stage: 'done', message: '初始化完成' })
      } finally {
        setupRunning = false
      }
    })
  }

  async function handleForecast(request) {
    const body = await request.json().catch(() => ({}))
    const codeInput = asString(body.code)
    const scale = asString(body.scale) ?? '1d'
    if (!codeInput) return failure('kit-forecast/forecast', '请输入股票代码')
    if (!SCALES[scale]) return failure('kit-forecast/forecast', `不支持的周期：${scale}`)

    const norm = normalizeCode(codeInput)
    if (!norm) return failure('kit-forecast/forecast', `无法识别的股票代码：${codeInput}`)
    const budget = DEFAULT_BUDGET[scale]
    const nPaths = asInt(body.nPaths, budget.paths, 1, Math.min(MAX_PATHS, config.maxPaths))
    const steps = asInt(body.steps, budget.steps, 1, Math.min(MAX_STEPS, config.maxSteps))
    // 同一只股票 + 同一周期固定用同一个种子（与 anchor 无关）：
    //   1) 同一根 bar 重复预测结果完全一致；
    //   2) 换到下一根 bar 时噪声不变，两条预测可以直接叠起来对比；
    //   3) 「增量延续」能复用上一次的路径（噪声序列相同才有意义）。
    const seed = body.seed === undefined || body.seed === null
      ? null
      : asInt(body.seed, 0, 0, 2 ** 31 - 1)
    const applyLimit = body.applyLimit !== false

    return sseResponse(async (send) => {
      const started = Date.now()
      try {
        send({ t: 'stage', stage: 'quote', message: `读取 ${norm.code} 实时行情` })
        const quote = await market.quote(norm.code).catch((error) => {
          send({ t: 'log', line: `行情获取失败：${errorText(error)}` })
          return null
        })

        send({ t: 'stage', stage: 'bars', message: `拉取 ${SCALES[scale].label} K 线` })
        const data = await market.bars(norm.code, scale)
        const need = SCALES[scale].Lc
        if (data.bars.length < need) {
          send({
            t: 'fail',
            message: `${SCALES[scale].label}需要 ${need} 根历史 K 线，当前数据源只提供 ${data.bars.length} 根。请换更长的周期，或稍后再试。`,
          })
          return
        }
        const tradingDays = await market.tradingDays().catch(() => null)
        send({
          t: 'stage',
          stage: 'data',
          message: `${data.bars.length} 根 K 线（${data.bars[0].t} → ${data.bars.at(-1).t}）`,
          meta: {
            source: data.source,
            adjustmentApplied: data.adjustmentApplied,
            droppedForming: data.droppedForming,
            bars: data.bars.length,
            need,
          },
        })

        if (!engine.alive) {
          send({ t: 'stage', stage: 'engine', message: '启动推理进程（首次会加载 1.1 GB 权重）' })
        }
        await engine.start()

        const limitRate = applyLimit ? limitRateOf(norm, quote) : null
        const effectiveSeed = seed ?? stableSeed(`${norm.code}|${scale}`)
        // 增量延续时自动把步数砍半：热启动从 tStart 起积分，不需要走满全程。
        // 实测 1d「8 路径 × 12 步」11.5s → 「8 × 6 步」5.2s，中位数几乎不变。
        const warm = body.warm === true
        const effectiveSteps = warm ? Math.max(2, Math.round(steps / 2)) : steps
        send({
          t: 'stage',
          stage: 'sample',
          message: warm
            ? `增量延续采样：${nPaths} 条路径 × ${effectiveSteps} 步（复用上一轮路径）`
            : `开始扩散采样：${nPaths} 条路径 × ${effectiveSteps} 步`,
        })

        const result = await engine.request('predict', {
          code: norm.code,
          scale,
          bars: data.bars,
          nPaths,
          steps: effectiveSteps,
          seed: effectiveSeed,
          tradingDays,
          limitRate,
          warm,
          tStart: body.tStart ?? 0.6,
        }, (event) => {
          if (event.stage === 'sample') {
            send({ t: 'progress', stage: 'sample', step: event.step, total: event.total, message: event.message })
          } else if (event.message) {
            send({ t: 'stage', stage: event.stage, message: event.message })
          }
        })

        const payload = {
          ...result,
          name: quote?.name ?? norm.digits,
          code: norm.code,
          scale,
          quote,
          seed: effectiveSeed,
          source: data.source,
          adjustmentApplied: data.adjustmentApplied,
          droppedForming: data.droppedForming,
          barsAvailable: data.bars.length,
          elapsedMs: Date.now() - started,
          generatedAt: new Date().toISOString(),
        }
        rememberResult(payload, { scale, quality: body.quality, applyLimit, autoRefresh: body.autoRefresh })
        // 顺手把历史预测的对比数据带上，前端拿到就能直接画
        payload.overlays = overlaysFor(store, payload.code, scale, data.bars, payload.asOf, 3)
        send({ t: 'result', data: payload })
      } finally {
        // 兜底：确保 done 一定发出
      }
    })
  }

  async function handleWarm() {
    if (!modelFilesReady(paths.ckptDir)) return failure('kit-forecast/warm', '模型尚未下载完成')
    const status = await engine.start()
    return noStoreJson({ ok: true, status })
  }

  return {
    handleStatus, handleSearch, handleQuote, handleBars, handleSetup,
    handleForecast, handleWarm, handleState, handleTick, handleHistory, handleNews,
    handleMarket, handleInsight, insight,
    store, engine, market, feed,
  }
}

/** 找一个能跑脚本的 node：优先 PATH 里的 node，其次桌面版附带的 .desktop-bin/node。 */
function nodeBinary() {
  if (asString(process.env.DSH_NODE_BIN)) return asString(process.env.DSH_NODE_BIN)
  const bundled = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), '.desktop-bin', 'node')
  if (existsSync(bundled)) return bundled
  return 'node'
}

function findBinary(name) {
  const candidates = [
    process.env[`DSH_${name.toUpperCase()}_BIN`],
    join(homedir(), '.local', 'bin', name),
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    name,
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (candidate === name) return candidate
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** 把字符串散列成稳定的 31 位种子（FNV-1a）。 */
function stableSeed(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash) % 100000
}

/** 涨跌停幅度：优先用盘口给出的涨跌停价反推，其次按板块规则。 */
function limitRateOf(norm, quote) {
  // 指数没有涨跌停
  if (norm.isIndex || isIndex(norm.code)) return null
  if (quote?.limitUp && quote?.prevClose) {
    const rate = Math.round((quote.limitUp / quote.prevClose - 1) * 1000) / 1000
    if (Number.isFinite(rate) && rate > 0 && rate <= 0.4) return rate
  }
  const digits = norm.digits
  if (norm.market === 'BJ') return 0.3
  if (/^(300|301|688|689)/.test(digits)) return 0.2
  if (quote?.name && /ST/i.test(quote.name)) return 0.05
  return 0.1
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

function normalizeConfig(raw) {
  const config = raw && typeof raw === 'object' ? raw : {}
  return {
    dataDir: asString(config.dataDir),
    statePath: asString(config.statePath),
    python: asString(config.python),
    indexUrl: asString(config.indexUrl),
    hfHost: asString(config.hfHost),
    device: asString(config.device) ?? 'auto',
    maxPaths: asInt(config.maxPaths, 32, 1, MAX_PATHS),
    maxSteps: asInt(config.maxSteps, 48, 1, MAX_STEPS),
    timeoutMs: asInt(config.timeoutMs, 900000, 60000, 3600000),
  }
}

export { createServer, resolvePaths, normalizeConfig }

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)
  const paths = resolvePaths(config)
  const server = createServer(ctx, config, paths)

  ctx.logger?.info?.(`[kit-forecast] 插件已加载，模型目录 ${paths.ckptDir}`)

  ctx.effect(() => () => server.engine.stop(), 'kit-forecast: engine cleanup')

  ctx.inject(['connection'], (scoped) => {
    // llm 是注入依赖：原始 ctx 上拿不到，必须用注入后的 scoped ctx 重建解读服务
    if (server.insight && typeof server.insight === 'object' && 'ctx' in server.insight) {
      server.insight.ctx = scoped
      server.insight.modelCache = null
    }
    const connection = scoped.get('connection')
    const register = connection?.fetch?.register?.bind(connection.fetch)
    if (typeof register !== 'function') {
      scoped.logger?.warn?.('[kit-forecast] 当前部署没有 connection.fetch，插件不会出现在界面上。')
      return
    }
    const route = (path, handler, methods = ['POST']) => {
      scoped.effect(
        () => register({
          path: `${ROUTE_BASE}${path}`,
          methods,
          requestBody: 'buffered',
          fetch: (request) => handler(request).catch((error) => {
            scoped.logger?.warn?.(`[kit-forecast] ${path} 失败：${errorText(error)}`)
            return failure('kit-forecast/error', errorText(error), 500)
          }),
        }),
        `kit-forecast: ${path}`,
      )
    }
    route('/status', server.handleStatus)
    route('/search', server.handleSearch)
    route('/quote', server.handleQuote)
    route('/bars', server.handleBars)
    route('/forecast', server.handleForecast)
    route('/setup', server.handleSetup)
    route('/warm', server.handleWarm)
    route('/state', server.handleState)
    route('/tick', server.handleTick)
    route('/history', server.handleHistory)
    route('/news', server.handleNews)
    route('/market', server.handleMarket)
    route('/insight', server.handleInsight)
  })
}