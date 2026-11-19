import React from 'react'
import { KitForecastPanel, PanelIcon } from './Panel.jsx'
import { STYLES } from './styles.js'
import { NS, zh, en } from './i18n.js'

const PLUGIN_ID = 'kit-forecast'
const PANEL_ID = 'kit-forecast'
const STYLE_ID = `${PLUGIN_ID}/styles`

let stylesInstalled = false

function installStyles() {
  if (stylesInstalled || typeof document === 'undefined') return
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing !== null) {
    stylesInstalled = true
    return
  }
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = STYLES
  document.head.appendChild(tag)
  stylesInstalled = true
}

let appCtx = null

function openPanel() {
  try {
    appCtx?.get('layout')?.selectPanel(PANEL_ID)
  } catch (error) {
    console.warn('[kit-forecast] 无法打开面板', error)
  }
}

function ComposerButton({ t }) {
  return (
    <button
      type="button"
      className="kfc-composerBtn"
      title={t('subtitle')}
      onClick={openPanel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 9px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      <PanelIcon size={13} />
      {t('nav')}
    </button>
  )
}

export const name = 'kit-forecast'
export const inject = ['slots', 'locale']

export function apply(ctx) {
  appCtx = ctx
  installStyles()

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'kit-forecast: dictionaries')

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
  }, (props) => <KitForecastPanel ctx={ctx} />))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 66,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
  }, (props) => <PanelIcon size={props.size ?? 18} active={props.active === true} />))

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: PANEL_ID,
    order: 46,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
  }, ComposerButton))
}