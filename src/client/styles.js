/** KiT 走势预测 —— 面板样式。只使用 --dsw-alias-* 主题令牌，浅色/深色自动跟随。 */

export const STYLES = `
.kfc-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  container-type: inline-size;
  container-name: kfc;
}
.kfc-root *, .kfc-root *::before, .kfc-root *::after { box-sizing: border-box; }

/* 头部 ------------------------------------------------------------------ */
.kfc-header {
  position: sticky;
  top: 0;
  z-index: 6;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent);
  backdrop-filter: blur(8px);
}
.kfc-mark {
  display: grid;
  place-items: center;
  width: 34px; height: 34px;
  flex: none;
  border-radius: 10px;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.kfc-headCopy { min-width: 0; flex: 1; }
.kfc-title {
  display: flex; align-items: baseline; gap: 8px;
  margin: 0;
  font-size: 15px; font-weight: 600; letter-spacing: .01em;
}
.kfc-title small {
  font-size: 11px; font-weight: 500;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .04em;
}
.kfc-sub {
  margin: 2px 0 0;
  font-size: 12px; line-height: 1.4;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.kfc-headActions { display: flex; align-items: center; gap: 8px; flex: none; }
.kfc-ghost.ok { color: var(--dsw-alias-state-success-primary); }
.kfc-ghost.warn { color: var(--dsw-alias-state-warn-primary); }

/* 按钮 ------------------------------------------------------------------ */
.kfc-root button { font: inherit; }
.kfc-ghost, .kfc-primary, .kfc-run, .kfc-scale, .kfc-suggestItem {
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.kfc-ghost {
  padding: 5px 10px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-ghost:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.kfc-primary {
  padding: 7px 14px;
  font-size: 13px; font-weight: 600;
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: #fff;
}
.kfc-primary:hover { filter: brightness(1.05); }
.kfc-run {
  padding: 7px 16px;
  font-size: 13px; font-weight: 600;
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: #fff;
}
.kfc-run:disabled { opacity: .6; cursor: progress; }

/* 初始化 ---------------------------------------------------------------- */
.kfc-setup {
  margin: 14px 20px 0;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-setupTitle { font-size: 13px; font-weight: 600; }
.kfc-setupBody {
  margin-top: 6px;
  font-size: 12px; line-height: 1.65;
  color: var(--dsw-alias-label-secondary);
}
.kfc-setupFacts {
  display: flex; flex-wrap: wrap; gap: 6px 14px;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-setupActions { display: flex; gap: 8px; margin-top: 12px; }
.kfc-logPane { padding: 12px 16px; }
.kfc-log {
  margin: 8px 0 0;
  max-height: 160px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* 工具条 ---------------------------------------------------------------- */
.kfc-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  flex-wrap: wrap;
}
.kfc-searchWrap { position: relative; flex: 1 1 220px; min-width: 180px; }
.kfc-search {
  width: 100%;
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px;
  outline: none;
}
.kfc-search:focus { border-color: var(--dsw-alias-brand-primary); }
.kfc-suggest {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0; right: 0;
  max-height: 240px; overflow: auto;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 10px 28px rgba(0,0,0,.14);
}
.kfc-suggestItem {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%;
  padding: 6px 9px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 13px;
}
.kfc-suggestItem:hover { background: var(--dsw-alias-bg-layer-2); }
.kfc-suggestCode { font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }

.kfc-scales {
  display: inline-flex;
  padding: 2px;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-scale {
  padding: 5px 9px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.kfc-scale:hover { color: var(--dsw-alias-label-primary); }
.kfc-scale.active {
  background: var(--dsw-alias-brand-primary);
  color: #fff;
}
.kfc-selectScale { min-width: 168px; font-variant-numeric: tabular-nums; }
.kfc-select {
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12.5px;
}
.kfc-check {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  user-select: none;
}

/* 行情条 ---------------------------------------------------------------- */
.kfc-quote {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 4px 20px 10px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.kfc-quoteName { display: flex; align-items: baseline; gap: 8px; font-size: 14px; }
.kfc-quoteName b { font-weight: 600; }
.kfc-quoteName span { font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.kfc-quotePrice {
  font-size: 20px; font-weight: 650;
  font-variant-numeric: tabular-nums;
  display: flex; align-items: baseline; gap: 8px;
}
.kfc-quotePrice span { font-size: 12.5px; font-weight: 500; }
.kfc-quotePrice.up, .kfc-statValue.up { color: #e04a4a; }
.kfc-quotePrice.down, .kfc-statValue.down { color: #22a06b; }
.kfc-quoteMeta {
  display: flex; flex-wrap: wrap; gap: 4px 12px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.kfc-quoteSpacer { flex: 1 1 0; }
.kfc-chip {
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  font-size: 11px;
}
.kfc-chip.warn { color: var(--dsw-alias-state-warn-primary); }

/* 主体 ------------------------------------------------------------------ */
.kfc-main { flex: 1; min-height: 0; padding: 12px 20px 6px; display: flex; flex-direction: column; gap: 12px; }

.kfc-progressPane {
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-progressHead { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.kfc-progressHead b { font-weight: 600; }
.kfc-elapsed { margin-left: auto; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; font-size: 12px; }
.kfc-spinner {
  width: 12px; height: 12px; flex: none;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: kfc-spin .8s linear infinite;
}
@keyframes kfc-spin { to { transform: rotate(360deg); } }
.kfc-bar {
  margin-top: 12px;
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  overflow: hidden;
}
.kfc-bar i {
  display: block; height: 100%;
  border-radius: 999px;
  background: var(--dsw-alias-brand-primary);
  transition: width .25s ease;
}
.kfc-progressHint {
  margin-top: 8px;
  font-size: 11.5px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}

.kfc-errorPane {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  font-size: 12.5px;
  display: flex; flex-direction: column; gap: 8px;
}
.kfc-errorPane b { color: var(--dsw-alias-state-error-primary); }
.kfc-errorPane button { align-self: flex-start; }

.kfc-chart {
  position: relative;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  padding: 6px 4px 2px;
  overflow: hidden;
}
.kfc-chart canvas { display: block; width: 100%; }
.kfc-tip {
  position: absolute;
  /* 位置由 JS 跟着鼠标算，这里只兜底 */
  top: 38px; right: 74px;
  min-width: 116px;
  padding: 7px 9px;
  z-index: 5;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 92%, transparent);
  backdrop-filter: blur(6px);
  font-size: 11px;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}
.kfc-tipLabel { margin-bottom: 3px; color: var(--dsw-alias-label-secondary); }
.kfc-tipRow { display: flex; justify-content: space-between; gap: 12px; line-height: 1.55; }
.kfc-tipRow b { font-weight: 600; }

.kfc-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 10px;
}
.kfc-statCard {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.kfc-statLabel { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.kfc-statValue {
  margin-top: 4px;
  font-size: 16px; font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: .01em;
}
.kfc-statHint {
  margin-top: 3px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}

.kfc-empty {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.kfc-emptyTitle { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.kfc-emptyBody { max-width: 460px; font-size: 12.5px; line-height: 1.7; }

.kfc-footNote {
  padding: 4px 0 14px;
  font-size: 11px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}

@container kfc (max-width: 620px) {
  .kfc-toolbar { padding: 10px 14px; }
  .kfc-header { padding: 11px 14px; }
  .kfc-main { padding: 10px 14px 6px; }
  .kfc-quote { padding: 2px 14px 8px; }
  .kfc-sub { display: none; }
  .kfc-stats { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
}

/* 加载态 --------------------------------------------------------------- */
.kfc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  font-size: 13px;
  color: var(--dsw-alias-label-secondary);
}

/* 常用股票 chips -------------------------------------------------------- */
.kfc-chips {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 20px 10px;
  flex-wrap: wrap;
}
.kfc-chipsLabel {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .04em;
  margin-right: 2px;
}
.kfc-chipItem {
  display: inline-flex;
  align-items: stretch;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
  max-width: 230px;
}
.kfc-chipItem.active {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.kfc-chipMain {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 9px;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  min-width: 0;
}
.kfc-chipMain b {
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kfc-chipMain span {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  font-size: 10.5px;
}
.kfc-chipMain svg { flex: none; color: var(--dsw-alias-label-secondary); }
.kfc-chipItem.active .kfc-chipMain svg { color: var(--dsw-alias-brand-primary); }
.kfc-chipItem:hover { background: var(--dsw-alias-bg-layer-2); }
.kfc-chipDrop {
  padding: 0 6px;
  border: none;
  border-left: 1px solid var(--dsw-alias-border-l1);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.kfc-chipDrop:hover { color: var(--dsw-alias-state-error-primary); }

/* 收藏按钮 ------------------------------------------------------------- */
.kfc-iconBtn {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: color .15s ease, background .15s ease, border-color .15s ease;
}
.kfc-iconBtn:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.kfc-iconBtn.on {
  color: var(--dsw-alias-brand-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.kfc-iconBtn:disabled { opacity: .45; cursor: default; }

/* 刷新中的轻提示 -------------------------------------------------------- */
.kfc-livePill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.kfc-spinner.sm {
  width: 9px;
  height: 9px;
  border-width: 1.5px;
}

/* 结果区：刷新时保留旧图，只加一条细进度 ------------------------------- */
.kfc-resultPane { position: relative; display: flex; flex-direction: column; gap: 12px; }
.kfc-resultPane.refreshing { opacity: .96; }
.kfc-refreshBar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  border-radius: 2px;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
  z-index: 3;
}
.kfc-refreshBar i {
  display: block;
  height: 100%;
  background: var(--dsw-alias-brand-primary);
  transition: width .3s ease;
}
.kfc-statCard.stale .kfc-statValue { opacity: .55; }

/* 非阻断提示条 --------------------------------------------------------- */
.kfc-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 35%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent);
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
}
.kfc-notice span { flex: 1; min-width: 0; }

.kfc-emptyHint {
  margin-top: 4px;
  max-width: 460px;
  font-size: 11.5px;
  line-height: 1.65;
  opacity: .8;
}

/* 跟随中标记 ------------------------------------------------------------ */
.kfc-chip.live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dsw-alias-brand-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, transparent);
}
.kfc-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: kfc-pulse 1.6s ease-in-out infinite;
}
@keyframes kfc-pulse {
  0%, 100% { opacity: .35; }
  50% { opacity: 1; }
}

/* 对比历史 ------------------------------------------------------------- */
.kfc-check.on { color: var(--dsw-alias-brand-primary); }

.kfc-compare {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  font-size: 11.5px;
}
.kfc-compareLabel {
  color: var(--dsw-alias-label-secondary);
  letter-spacing: .03em;
}
.kfc-compareItem {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  font-variant-numeric: tabular-nums;
}
.kfc-compareItem i {
  font-style: normal;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-compareItem b { font-weight: 600; color: #f0a44a; }
.kfc-compareItem span { color: var(--dsw-alias-label-primary); }
.kfc-compareItem em {
  font-style: normal;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
  opacity: .8;
}
.kfc-compareItem.hit { border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 35%, transparent); }
.kfc-compareItem.miss { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 35%, transparent); }
.kfc-compareNote {
  margin-left: auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
}

/* 现价标记 ------------------------------------------------------------- */
.kfc-liveDot {
  display: inline-block;
  width: 7px; height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background: #6ec1ff;
  box-shadow: 0 0 0 0 rgba(110,193,255,.7);
  animation: kfc-liveRing 1.8s ease-out infinite;
  vertical-align: middle;
}
@keyframes kfc-liveRing {
  0% { box-shadow: 0 0 0 0 rgba(110,193,255,.55); }
  70% { box-shadow: 0 0 0 7px rgba(110,193,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(110,193,255,0); }
}
.kfc-tickAge { opacity: .75; }

/* 图表工具条与缩放 ----------------------------------------------------- */
.kfc-chart { cursor: crosshair; }
.kfc-chart.dragging { cursor: grabbing; }
.kfc-chartTools {
  position: absolute;
  top: 8px; right: 74px;
  z-index: 4;
  display: flex;
  gap: 4px;
}
.kfc-chartTools button {
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 88%, transparent);
  backdrop-filter: blur(6px);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  line-height: 1;
  cursor: pointer;
  transition: color .15s ease, border-color .15s ease;
}
.kfc-chartTools button:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l2);
}
.kfc-chartTools button.wide { padding: 0 9px; }
.kfc-zoomHint {
  position: absolute;
  left: 10px;
  bottom: 24px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 80%, transparent);
  padding: 2px 7px;
  border-radius: 999px;
}

/* 悬停浮层：更清楚的数值面板 ------------------------------------------- */
.kfc-tip {
  min-width: 152px;
  padding: 8px 10px;
  font-size: 11.5px;
}
.kfc-tipHead {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.kfc-tipKind {
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 15px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.kfc-tip.kind-pred .kfc-tipKind {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
}
.kfc-tipLabel {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}
.kfc-tipRow { line-height: 1.7; }
.kfc-tipRow span { color: var(--dsw-alias-label-secondary); }
.kfc-tipRow b { font-weight: 600; font-variant-numeric: tabular-nums; }
.kfc-tipRow b.up { color: #e04a4a; }
.kfc-tipRow b.down { color: #22a06b; }

/* 行情预览 / 预测过期 --------------------------------------------------- */
.kfc-previewBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px dashed var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.kfc-previewBar span { flex: 1; min-width: 0; }
.kfc-previewBar button { flex: none; padding: 5px 14px; }

.kfc-staleBar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent);
  font-size: 11.5px;
  color: var(--dsw-alias-label-primary);
}
.kfc-staleBar .kfc-dot { color: var(--dsw-alias-brand-primary); background: currentColor; }
.kfc-staleBar span:nth-child(2) { flex: 1; min-width: 0; }
.kfc-staleBar button { padding: 3px 10px; }

/* 预测进度覆盖层 ------------------------------------------------------- */
.kfc-canvasArea { position: relative; display: flex; flex-direction: column; gap: 12px; min-height: 0; }

.kfc-overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  border-radius: 12px;
  /* 只轻微压暗，让图表仍然清晰可读（之前 42% 太黑，图像糊成一片） */
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 18%, transparent);
  animation: kfc-fadeIn .18s ease;
}
@keyframes kfc-fadeIn { from { opacity: 0 } to { opacity: 1 } }

.kfc-overlayCard {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  min-width: 320px;
  border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 96%, transparent);
  box-shadow: 0 12px 34px rgba(0, 0, 0, .28);
}

.kfc-ring {
  position: relative;
  flex: none;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  color: var(--dsw-alias-brand-primary);
}
.kfc-ring svg { position: absolute; inset: 0; }
.kfc-ringText {
  position: relative;
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  letter-spacing: .01em;
}

.kfc-overlayText {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.kfc-overlayText b {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kfc-overlayText span {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}

.kfc-overlayCancel { flex: none; padding: 5px 11px; }

@container kfc (max-width: 560px) {
  .kfc-overlayCard { min-width: 0; width: calc(100% - 32px); gap: 10px; padding: 12px 14px; }
  .kfc-overlayCancel { padding: 4px 8px; }
}
`