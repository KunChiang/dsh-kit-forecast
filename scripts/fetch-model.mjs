#!/usr/bin/env node
/**
 * 下载 KiT 权重与元数据（多连接分段并行、按偏移写入、可断点续传）。
 *
 *   node scripts/fetch-model.mjs [--dir <目录>] [--bundle step_market_284M|step_market_284M_train260410]
 *
 * 默认从 hf-mirror.com 拉取（huggingface.co 在部分地区不可直连）。
 * 目标目录里已存在且大小正确的文件会跳过；中断后重新执行会从已写入的字节继续。
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const HOST = process.env.KIT_HF_HOST ?? 'https://hf-mirror.com'
const REPO = process.env.KIT_HF_REPO ?? 'Lucifer744/KiT_model'
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.KIT_DL_CONCURRENCY ?? '6', 10))
const CHUNK = Math.max(1024 * 1024, Number.parseInt(process.env.KIT_DL_CHUNK ?? String(16 * 1024 * 1024), 10))

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  return process.argv[i + 1] ?? fallback
}

const dir = resolve(arg('dir', join(import.meta.dirname, '..', 'runtime', 'ckpt')))
mkdirSync(dir, { recursive: true })

const FILES = [
  { remote: `${bundleDir()}/step_market_${suffix()}.pt`, local: 'step_market_284M.pt' },
  { remote: `${bundleDir()}/instruments.json`, local: 'instruments.json' },
  { remote: `${bundleDir()}/stats.json`, local: 'stats.json' },
]

function bundleName() {
  return arg('bundle', 'step_market_284M')
}
function bundleDir() {
  return bundleName()
}
function suffix() {
  return bundleName().includes('train260410') ? '284M_train260410' : '284M'
}

function target(remote) {
  return `${HOST}/${REPO}/resolve/main/${remote}`
}

/**
 * 取远端文件大小。优先 HEAD，失败时退回 Range: bytes=0-0 + Content-Range，
 * 两者都不行再换 huggingface.co 直连（镜像偶尔缺小文件）。
 */
async function head(remote) {
  const hosts = [HOST, 'https://huggingface.co']
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const host = hosts[attempt % hosts.length]
    const url = `${host}/${REPO}/resolve/main/${remote}`
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      })
      const size = Number.parseInt(res.headers.get('content-length') ?? '0', 10)
      if (size > 0) return size
      const ranged = await fetch(url, {
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      })
      const range = ranged.headers.get('content-range') ?? ''
      const total = Number.parseInt(range.split('/').pop() ?? '0', 10)
      if (total > 0) return total
    } catch {
      // 换下一个 host 重试
    }
    await sleep(800 * (attempt + 1))
  }
  throw new Error(`无法获取 ${remote} 的大小（镜像与直连均失败）`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchChunk(remote, start, end, attempt = 0) {
  try {
    const res = await fetch(target(remote), {
      headers: { Range: `bytes=${start}-${end}` },
      redirect: 'follow',
      signal: AbortSignal.timeout(90000),
    })
    if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length !== end - start + 1) throw new Error(`分段长度不足：${buf.length} < ${end - start + 1}`)
    return buf
  } catch (error) {
    if (attempt >= 5) throw error
    await sleep(700 * (attempt + 1))
    return fetchChunk(remote, start, end, attempt + 1)
  }
}

function human(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 一个分段任务：写 <dest>.<index>.part，完成后记录在 <dest>.parts 清单里。 */
async function download(remote, local) {
  const dest = join(dir, local)
  let size
  try {
    size = await head(remote)
  } catch (error) {
    if (existsSync(dest)) {
      console.log(`[skip] ${local} 已存在（无法校验大小：${error.message}）`)
      return dest
    }
    throw error
  }
  if (size <= 0) throw new Error(`无法获取 ${remote} 的大小`)
  if (existsSync(dest) && statSync(dest).size === size) {
    console.log(`[skip] ${local} 已存在（${human(size)}）`)
    return dest
  }
  const ranges = []
  for (let s = 0; s < size; s += CHUNK) ranges.push([s, Math.min(s + CHUNK - 1, size - 1)])
  console.log(`[dl] ${local} ${human(size)}，${ranges.length} 段，并发 ${CONCURRENCY}`)

  const total = ranges.length
  let next = 0
  let doneBytes = 0
  const started = Date.now()

  await new Promise((resolveAll, rejectAll) => {
    let active = 0
    let failed = false
    const pump = () => {
      if (failed) return
      if (next >= total) {
        if (active === 0) resolveAll()
        return
      }
      const index = next
      const [s, e] = ranges[next]
      next += 1
      active += 1
      const partPath = `${dest}.${index}.part`
      const existed = existsSync(partPath) && statSync(partPath).size === e - s + 1
      if (existed) {
        doneBytes += e - s + 1
        active -= 1
        pump()
        return
      }
      fetchChunk(remote, s, e)
        .then((buf) => {
          writeFileSync(partPath, buf)
          doneBytes += buf.length
          const pct = ((doneBytes / size) * 100).toFixed(1)
          const speed = doneBytes / ((Date.now() - started) / 1000) / 1024 / 1024
          process.stdout.write(`\r[dl] ${pct}% ${human(doneBytes)}/${human(size)} ${speed.toFixed(2)} MB/s (${active} 连接)   `)
        })
        .catch((error) => {
          failed = true
          rejectAll(error)
        })
        .finally(() => {
          active -= 1
          pump()
        })
      pump()
    }
    for (let i = 0; i < CONCURRENCY; i += 1) pump()
  })
  process.stdout.write('\n')

  // 按顺序拼装
  const out = createWriteStream(dest)
  for (let i = 0; i < total; i += 1) {
    const partPath = `${dest}.${i}.part`
    out.write(readFileSync(partPath))
    unlinkSync(partPath)
  }
  await new Promise((r) => out.end(r))
  if (statSync(dest).size !== size) throw new Error(`${local} 大小不匹配：期望 ${size}`)
  console.log(`[ok] ${dest}`)
  return dest
}

for (const file of FILES) await download(file.remote, file.local)
console.log('[done] 模型已就绪：', dir)
