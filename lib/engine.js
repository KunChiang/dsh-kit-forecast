/**
 * Python 推理进程管理：常驻 worker + JSON Lines 协议 + 串行队列。
 *
 * worker 启动后会一直驻留（模型只加载一次），Host 半通过 stdin 发送请求、
 * 逐行读取 stdout 的 result/progress。进程空闲超时或插件卸载时退出。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const IDLE_STOP_MS = 30 * 60 * 1000

export class KitEngine {
  constructor({ python, enginePath, ckptDir, device = 'auto', logger = console, timeoutMs = 900000 }) {
    this.python = python
    this.enginePath = enginePath
    this.ckptDir = ckptDir
    this.device = device
    this.logger = logger
    this.timeoutMs = timeoutMs
    this.child = null
    this.pending = new Map()
    this.nextId = 1
    this.buffer = ''
    this.chain = Promise.resolve()
    this.lastUsed = Date.now()
    this.idleTimer = null
    this.lastError = null
  }

  get alive() {
    return this.child !== null && this.child.exitCode === null && !this.child.killed
  }

  async start() {
    if (this.alive) return
    if (!existsSync(this.enginePath)) throw new Error(`推理脚本不存在：${this.enginePath}`)
    if (!existsSync(this.python)) throw new Error(`Python 解释器不存在：${this.python}`)

    this.logger.info?.(`[kit-forecast] 启动推理进程 ${this.python} ${this.enginePath}`)
    const child = spawn(this.python, [this.enginePath, '--ckpt-dir', this.ckptDir, '--device', this.device], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
    })
    this.child = child
    this.buffer = ''

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => this.onData(chunk))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (line.trim() !== '') this.logger.info?.(`[kit-engine] ${line.trim()}`)
      }
    })
    child.on('error', (error) => {
      this.lastError = error.message
      this.failAll(new Error(`推理进程启动失败：${error.message}`))
    })
    child.on('exit', (code, signal) => {
      this.logger.warn?.(`[kit-forecast] 推理进程退出 code=${code} signal=${signal}`)
      this.child = null
      this.failAll(new Error(`推理进程已退出（code=${code}）`))
    })

    // 握手：确认 Python 侧就绪（不加载模型）
    const status = await this.request('status', null, null, 30000)
    if (!status.ok) throw new Error(status.error ?? 'PyTorch 环境不可用')
    this.lastError = null
    this.scheduleIdleStop()
    return status
  }

  onData(chunk) {
    this.buffer += chunk
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (line !== '') this.onLine(line)
      index = this.buffer.indexOf('\n')
    }
  }

  onLine(line) {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      this.logger.warn?.(`[kit-engine] 非 JSON 输出：${line.slice(0, 200)}`)
      return
    }
    const entry = this.pending.get(message.id)
    if (!entry) return
    if (message.type === 'progress') {
      entry.onProgress?.(message)
      return
    }
    clearTimeout(entry.timer)
    this.pending.delete(message.id)
    if (message.type === 'error') entry.reject(new Error(message.message ?? '推理失败'))
    else entry.resolve(message.data)
  }

  failAll(error) {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    this.pending.clear()
  }

  /** 串行执行：同一时刻只跑一个推理任务，避免显存/内存争抢。 */
  request(op, payload, onProgress, timeoutOverride) {
    const run = () => this.dispatch(op, payload, onProgress, timeoutOverride)
    const result = this.chain.then(run, run)
    this.chain = result.catch(() => {})
    return result
  }

  dispatch(op, payload, onProgress, timeoutOverride) {
    if (!this.alive) return Promise.reject(new Error('推理进程未启动'))
    const id = this.nextId++
    this.lastUsed = Date.now()
    this.clearIdleStop()
    const timeout = timeoutOverride ?? this.timeoutMs
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`推理超时（${Math.round(timeout / 1000)}s）`))
      }, timeout)
      this.pending.set(id, { resolve, reject, onProgress, timer })
      try {
        this.child.stdin.write(`${JSON.stringify({ id, op, payload })}\n`)
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error)
      }
    }).finally(() => this.scheduleIdleStop())
  }

  scheduleIdleStop() {
    this.clearIdleStop()
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0 && Date.now() - this.lastUsed >= IDLE_STOP_MS) this.stop()
    }, IDLE_STOP_MS)
    this.idleTimer.unref?.()
  }

  clearIdleStop() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  stop() {
    this.clearIdleStop()
    const child = this.child
    this.child = null
    if (!child) return
    try {
      child.stdin.write(`${JSON.stringify({ id: 0, op: 'shutdown' })}\n`)
    } catch {
      // 忽略
    }
    setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {
        // 已退出
      }
    }, 1500).unref?.()
  }
}
