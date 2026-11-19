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

export const name = 'kit-forecast'
export const inject = ['slots', 'locale']

export function apply(ctx) {
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

}