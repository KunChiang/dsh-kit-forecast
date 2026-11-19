/**
 * 客户端半的契约测试：在 Node 里模拟浏览器的 window.__ModuleLoader__，
 * 检查 lib/client.js 能被加载、注册了正确的 slot 与文案，并且 apply 不抛错。
 *
 *   node --test test/
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const code = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/** React 不在本包依赖里（由浏览器的模块表提供），测试时从环境变量或本地 node_modules 找一份。 */
function resolveReact() {
  const candidates = [
    process.env.DSH_TEST_REACT,
    join(root, 'node_modules', 'react'),
    '/tmp/reacttest/node_modules/react',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      return createRequire(import.meta.url)(candidate)
    } catch {
      // 试下一个
    }
  }
  throw new Error('测试需要一份 react：设置 DSH_TEST_REACT 或 npm i react')
}

function ReactJsx() {
  const candidates = [
    process.env.DSH_TEST_REACT && join(process.env.DSH_TEST_REACT, 'jsx-runtime'),
    join(root, 'node_modules', 'react', 'jsx-runtime'),
    '/tmp/reacttest/node_modules/react/jsx-runtime',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      return createRequire(import.meta.url)(candidate)
    } catch {
      // 试下一个
    }
  }
  throw new Error('测试需要 react/jsx-runtime')
}

function loadClient() {
  let loaded = null
  const registered = { slots: [], locales: {}, effects: [] }
  const document = {
    head: { appendChild() {} },
    querySelector: () => null,
    createElement: () => ({ dataset: {}, style: {}, textContent: '' }),
  }
  const window = {
    __ModuleLoader__: {
      load: (spec) => {
        loaded = spec
      },
    },
  }
  const require = createRequire(import.meta.url)
  // 用 vm 执行 bundle，提供最小的 window/document
  const vm = require('node:vm')
  vm.runInNewContext(code, { window, document, console, setTimeout, clearTimeout, TextDecoder, fetch: () => Promise.reject(new Error('no network in test')) })
  return { spec: loaded, registered, document, window }
}

test('client bundle 注册了正确的 id 与 slot', () => {
  const { spec } = loadClient()
  assert.ok(spec, 'bundle 必须调用 window.__ModuleLoader__.load')
  assert.equal(spec.id, 'dsh-kit-forecast')
  assert.equal(typeof spec.factory, 'function')

  const exports = spec.factory((id) => {
    if (id === 'react') return {}
    if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'fragment' }
    throw new Error(`unexpected require: ${id}`)
  })
  assert.equal(exports.name, 'kit-forecast')
  // 来自 vm sandbox，数组原型与宿主不同，转成普通数组再比较
  assert.deepEqual([...exports.inject], ['slots', 'locale'])
  assert.equal(typeof exports.apply, 'function')
})

test('apply 只注册主面板与侧栏入口（输入框左侧不再挂按钮）', () => {
  const { spec } = loadClient()
  const React = resolveReact()
  const exports = spec.factory((id) => {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return ReactJsx()
    throw new Error(`unexpected require: ${id}`)
  })

  const registrations = []
  const locales = []
  const ctx = {
    locale: {
      register: (ns, dict) => {
        locales.push({ ns, dict })
        return () => {}
      },
      bind: (ns) => (key) => `${ns}:${key}`,
      subscribe: () => () => {},
    },
    slots: {
      inject: (name, run) => run(),
      register: (spec2, render) => {
        registrations.push({ spec: spec2, render })
        return () => {}
      },
    },
    effect: (fn) => { fn(); return () => {} },
    get: () => undefined,
  }
  exports.apply(ctx)

  assert.equal(locales.length, 1)
  assert.equal(locales[0].ns, 'kit-forecast')
  assert.ok(locales[0].dict.zh.nav)
  assert.ok(locales[0].dict.en.nav)

  const names = registrations.map((r) => r.spec.name)
  // 用户反馈：输入框下方不该出现插件图标，所以不再注册 conversation.input.left
  assert.deepEqual([...names], ['main', 'sidebar.panellist'])
  assert.equal(names.includes('conversation.input.left'), false)
  const main = registrations[0].spec
  assert.equal(main.key, 'kit-forecast')
  for (const r of registrations) assert.equal(typeof r.render, 'function')
  // 每个 slot 都能渲染成 React 元素而不抛错
  for (const r of registrations) {
    const el = r.render({ size: 18, active: false, t: (k) => k })
    assert.ok(React.isValidElement(el), `${r.spec.name} 应返回 React 元素`)
  }
})
