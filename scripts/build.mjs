/**
 * 构建脚本：
 * 1. 用 esbuild 把 src/client 打成单文件 CJS（react 保持 external，由浏览器模块表提供）；
 * 2. 包进 DSH 的 window.__ModuleLoader__.load 协议；
 * 3. 把 host 半与 datasource/engine 复制到 lib/（ESM，直接由 Node 加载）。
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const id = packageJson.name
const libDir = join(root, 'lib')
const tempDir = join(root, '.build')
const clientEntry = join(root, 'src', 'client', 'index.jsx')
const clientBundle = join(tempDir, 'client.cjs')

function findEsbuild() {
  const candidates = [
    process.env.ESBUILD_BIN,
    join(root, 'node_modules', '.bin', 'esbuild'),
    join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  ].filter((candidate) => typeof candidate === 'string' && candidate !== '')
  for (const candidate of candidates) if (existsSync(candidate)) return candidate

  const npxRoot = join(homedir(), '.npm', '_npx')
  if (existsSync(npxRoot)) {
    for (const entry of readdirSync(npxRoot)) {
      const binary = join(npxRoot, entry, 'node_modules', 'esbuild', 'bin', 'esbuild')
      if (existsSync(binary)) return binary
    }
  }
  return 'esbuild'
}

const esbuild = findEsbuild()

rmSync(tempDir, { recursive: true, force: true })
mkdirSync(tempDir, { recursive: true })
mkdirSync(libDir, { recursive: true })

console.log(`[kit-forecast] bundling client with ${esbuild}`)
execFileSync(esbuild, [
  clientEntry,
  '--bundle',
  '--format=cjs',
  '--platform=browser',
  '--target=es2020',
  '--jsx=automatic',
  '--external:react',
  '--external:react-dom',
  '--external:react/jsx-runtime',
  `--outfile=${clientBundle}`,
  '--log-level=warning',
], { stdio: 'inherit' })

const body = readFileSync(clientBundle, 'utf8')
const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(id)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body}
    return module.exports;
  },
});
`
writeFileSync(join(libDir, 'client.js'), wrapped, 'utf8')

for (const file of ['index.js', 'datasource.js', 'engine.js', 'state.js']) {
  copyFileSync(join(root, 'src', 'host', file), join(libDir, file))
}

// 平台字段：Cellix/DSH 运行时只加载 commonjs 包装后的 client
rmSync(tempDir, { recursive: true, force: true })

console.log(`[kit-forecast] wrote lib/client.js (${(wrapped.length / 1024).toFixed(1)} kB) and lib/*.js`)
