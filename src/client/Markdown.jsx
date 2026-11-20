/**
 * 极简 Markdown 渲染器（零依赖、无 innerHTML）。
 *
 * 为什么自己写：DSH 的对话渲染器没有作为可复用组件导出给插件，
 * 而引入 remark 之类的依赖会让客户端包体积翻倍。这里只实现 AI 解读
 * 实际会用到的子集：
 *
 *   标题、无序/有序列表、引用、代码块、行内代码、粗体、斜体、
 *   链接、分隔线、表格（GFM 简单表）、段落、软换行
 *
 * 安全性：全部产出 React 元素，绝不拼 HTML 字符串，所以模型输出里的
 * `<script>` 之类只会被当作文本显示。链接只允许 http/https/mailto。
 */
import React from 'react'

const h = React.createElement

/** 只放行安全的协议，避免 javascript: 之类的链接。 */
function safeHref(raw) {
  const url = String(raw ?? '').trim()
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url
  return null
}

/** 行内解析：`code`、**粗体**、*斜体*、[文本](链接)、裸链接。 */
function parseInline(text, keyPrefix = 'i') {
  const nodes = []
  const source = String(text ?? '')
  // 用一次扫描按优先级切分，避免多次替换导致嵌套错乱
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)）]+)/g
  let last = 0
  let match
  let index = 0

  const pushText = (chunk, emphasizeSigned) => {
    if (chunk === '') return
    if (!emphasizeSigned) {
      nodes.push(chunk)
      return
    }
    // 涨跌幅上色：+1.2% 偏红，-1.2% 偏绿（A 股习惯）
    const re = /([+-]\d+(?:\.\d+)?%)/g
    let cursor = 0
    let m
    while ((m = re.exec(chunk)) !== null) {
      if (m.index > cursor) nodes.push(chunk.slice(cursor, m.index))
      nodes.push(h('span', {
        key: `${keyPrefix}-s${index++}`,
        className: m[1].startsWith('+') ? 'kfc-mdUp' : 'kfc-mdDown',
      }, m[1]))
      cursor = m.index + m[1].length
    }
    if (cursor < chunk.length) nodes.push(chunk.slice(cursor))
  }

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) pushText(source.slice(last, match.index), true)
    const token = match[0]
    const key = `${keyPrefix}-${index++}`
    if (token.startsWith('`')) {
      nodes.push(h('code', { key, className: 'kfc-mdCode' }, token.slice(1, -1)))
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(h('strong', { key }, parseInline(token.slice(2, -2), `${key}-b`)))
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(h('em', { key }, parseInline(token.slice(1, -1), `${key}-i`)))
    } else if (token.startsWith('[')) {
      const close = token.indexOf('](')
      const label = token.slice(1, close)
      const href = safeHref(token.slice(close + 2, -1))
      nodes.push(href === null
        ? h('span', { key }, label)
        : h('a', { key, href, target: '_blank', rel: 'noreferrer noopener' }, parseInline(label, `${key}-a`)))
    } else {
      const href = safeHref(token)
      nodes.push(h('a', { key, href: href ?? undefined, target: '_blank', rel: 'noreferrer noopener' }, token))
    }
    last = match.index + token.length
  }
  if (last < source.length) pushText(source.slice(last), true)
  return nodes
}

/** 表格：表头 + 分隔行 + 数据行。 */
function isTableSeparator(line) {
  return /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-')
}

function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim())
}

export function Markdown({ text, className = '' }) {
  const blocks = []
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // 空行
    if (line.trim() === '') { i += 1; continue }

    // 代码块
    if (/^```/.test(line.trim())) {
      const body = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i].trim())) { body.push(lines[i]); i += 1 }
      i += 1
      blocks.push(h('pre', { key: key++, className: 'kfc-mdPre' }, h('code', null, body.join('\n'))))
      continue
    }

    // 分隔线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(h('hr', { key: key++, className: 'kfc-mdHr' }))
      i += 1
      continue
    }

    // 标题
    const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = Math.min(6, heading[1].length)
      blocks.push(h(`h${Math.min(6, level + 2)}`, { key: key++, className: 'kfc-mdHeading' },
        parseInline(heading[2], `h${key}`)))
      i += 1
      continue
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const body = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      blocks.push(h('blockquote', { key: key++, className: 'kfc-mdQuote' },
        h(Markdown, { text: body.join('\n') })))
      continue
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const head = splitRow(line)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]))
        i += 1
      }
      blocks.push(h('div', { key: key++, className: 'kfc-mdTableWrap' },
        h('table', { className: 'kfc-mdTable' },
          h('thead', null, h('tr', null, head.map((cell, ci) => h('th', { key: ci }, parseInline(cell, `th${ci}`))))),
          h('tbody', null, rows.map((row, ri) => h('tr', { key: ri },
            row.map((cell, ci) => h('td', { key: ci }, parseInline(cell, `td${ri}-${ci}`)))))))))
      continue
    }

    // 列表（支持一层缩进）
    const listMatch = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2])
      const items = []
      let depth = 0
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
        if (!m) {
          // 续行（缩进的纯文本）并入上一项
          if (items.length > 0 && /^\s{2,}\S/.test(lines[i])) {
            items[items.length - 1].text += ` ${lines[i].trim()}`
            i += 1
            continue
          }
          break
        }
        depth = Math.max(depth, Math.floor(m[1].length / 2))
        items.push({ ordered: /\d/.test(m[2]), text: m[3], indent: Math.floor(m[1].length / 2) })
        i += 1
      }
      const build = (list) => {
        const tag = list[0]?.ordered ? 'ol' : 'ul'
        return h(tag, { key: key++, className: 'kfc-mdList' },
          list.map((item, ii) => h('li', { key: ii }, parseInline(item.text, `li${ii}`))))
      }
      blocks.push(build(items))
      continue
    }

    // 段落：连续非空行合并
    const para = []
    while (i < lines.length && lines[i].trim() !== ''
      && !/^```/.test(lines[i].trim())
      && !/^\s{0,3}#{1,6}\s/.test(lines[i])
      && !/^\s*>\s?/.test(lines[i])
      && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i])) {
      para.push(lines[i].trim())
      i += 1
    }
    if (para.length > 0) {
      blocks.push(h('p', { key: key++, className: 'kfc-mdP' }, parseInline(para.join('\n'), 'p')))
    } else {
      i += 1
    }
  }

  return h('div', { className: `kfc-md ${className}` }, blocks)
}