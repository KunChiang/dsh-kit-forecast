export const NS = 'kit-forecast'

export const zh = {
  nav: 'KiT 走势预测',
  title: 'KiT 走势预测',
  titleTag: 'A 股 · 实时',
  subtitle: '用 KiT 扩散模型对任意 A 股做多周期概率预测：不是单一涨跌，而是一族未来路径',

  searchPlaceholder: '股票代码或名称，如 600519 / 贵州茅台',
  recheck: '重新检测环境',
  envReady: '环境就绪',
  envMissing: '需初始化',

  setupTitle: '第一次使用需要准备运行环境',
  setupBody:
    '会做三件事：创建 Python 虚拟环境、安装 PyTorch 等依赖、下载 KiT-284M 权重（1.1 GB）。'
    + '下载支持断点续传，初始化完成后不需要再来一次；也可以自己准备后在插件配置里指定 dataDir / python。',
  setupStart: '初始化运行环境',
  setupRunning: '正在初始化…',
  setupDone: '初始化完成',
  setupFailed: '初始化失败',

  qualityHint: '采样路径数与扩散步数的档位：越精细越慢',
  'quality.fast': '快速',
  'quality.standard': '标准',
  'quality.fine': '精细',
  auto: '实时跟随',
  autoHint: '盯着最后一根已收盘 K 线：只有出现新 bar 才重算，刷新时旧图保留不闪',
  watching: '跟随中',
  watchHint: '正在轮询最新收盘 K 线；有新 bar 时自动重算',
  watchFail: '上一次心跳失败，会自动重试',
  watchRetry: '跟随重试中',
  limit: '涨跌停约束',
  limitHint: '把预测路径投影到当日涨跌停区间内',

  watchlist: '常用',
  pinHint: '把当前股票加入常用（置顶）',
  unpinHint: '取消置顶',
  removeHint: '从常用里移除',
  pinnedNotice: '已加入常用',
  unpinnedNotice: '已取消置顶',

  restoring: '正在恢复上次的股票与预测…',
  updating: '刷新中',
  updated: '更新于',
  needStock: '请先输入股票代码或名称，并从联想列表里选一只股票',
  needSetup: '运行环境还没准备好，请先完成初始化',
  preparing: '准备中…',

  run: '开始预测',
  rerun: '重新预测',
  running: '预测中…',
  cancel: '取消',
  working: '推理中…',
  progressHint: '首次运行会先加载 1.1 GB 权重到内存；扩散采样按步推进，可以随时取消。',
  failed: '预测失败',
  dismiss: '知道了',

  lastBar: '最新已收盘 K 线',
  horizon: '预测区间',
  adj: '前复权',
  'stat.median': '预测中位涨幅',
  'stat.target': '目标价中位',
  'stat.upProb': '上涨概率',
  'stat.q05q95': 'q05~q95',
  'stat.range': '价格区间',
  'stat.rangeHint': 'q05 ~ q95 分位',
  'stat.vol': '预期波动',
  'stat.drawdown': '中位回撤',
  'stat.paths': '采样规模',

  emptyTitle: '输入代码，看未来怎么走',
  emptyBody: '支持任意 A 股（沪深京），1 分钟到日线共 7 个周期。模型输出多条采样路径的分布，用来判断方向、幅度和不确定性。',
  emptyHint: '用过的股票会自动出现在「常用」里，也可以点 ☆ 固定置顶；下次打开面板会直接回到上次的股票与结果。',

  footNote:
    '数据：新浪 / 腾讯行情（实时盘口 + 前复权 K 线）；模型：KiT-284M（AGPL-3.0，Luciferbobo/KiT）。'
    + ' 仅用于研究与学习，不构成投资建议。',
  footModelMissing: '模型尚未下载，完成初始化后即可预测。',
}

export const en = {
  nav: 'KiT Forecast',
  title: 'KiT Forecast',
  titleTag: 'A-shares · live',
  subtitle: 'Probabilistic multi-horizon forecasts for any A-share with the KiT diffusion model',

  searchPlaceholder: 'Ticker or name, e.g. 600519 / Kweichow Moutai',
  recheck: 'Re-check environment',
  envReady: 'Ready',
  envMissing: 'Setup needed',

  setupTitle: 'First run needs a Python runtime',
  setupBody:
    'The plugin creates a venv, installs PyTorch, and downloads the KiT-284M weights (1.1 GB, resumable). '
    + 'You can also point dataDir / python at an existing setup in the plugin config.',
  setupStart: 'Set up runtime',
  setupRunning: 'Setting up…',
  setupDone: 'Setup finished',
  setupFailed: 'Setup failed',

  qualityHint: 'Sampling budget: more paths / steps = slower but better',
  'quality.fast': 'Fast',
  'quality.standard': 'Standard',
  'quality.fine': 'Fine',
  auto: 'Auto',
  autoHint: 'Watches the last closed bar and only recomputes when a new one appears; the old chart never blinks',
  watching: 'Following',
  watchHint: 'Polling the latest closed bar; recomputes when a new bar closes',
  watchFail: 'Last heartbeat failed; will retry automatically',
  watchRetry: 'Retrying',
  limit: 'Price-limit clamp',
  limitHint: 'Project sampled paths into the daily price-limit band',

  watchlist: 'Watchlist',
  pinHint: 'Pin this stock to the watchlist',
  unpinHint: 'Unpin',
  removeHint: 'Remove from watchlist',
  pinnedNotice: 'Pinned to watchlist',
  unpinnedNotice: 'Unpinned',

  restoring: 'Restoring your last stock and forecast…',
  updating: 'Updating',
  updated: 'Updated',
  needStock: 'Pick a stock from the search suggestions first',
  needSetup: 'Runtime is not ready yet; finish setup first',
  preparing: 'Preparing…',

  run: 'Forecast',
  rerun: 'Forecast again',
  running: 'Forecasting…',
  cancel: 'Cancel',
  working: 'Sampling…',
  progressHint: 'The first run loads 1.1 GB of weights; sampling proceeds step by step and can be cancelled.',
  failed: 'Forecast failed',
  dismiss: 'Dismiss',

  lastBar: 'Last closed bar',
  horizon: 'Horizon',
  adj: 'adjusted',
  'stat.median': 'Median return',
  'stat.target': 'Median target',
  'stat.upProb': 'P(up)',
  'stat.q05q95': 'q05~q95',
  'stat.range': 'Price range',
  'stat.rangeHint': 'q05 ~ q95 quantiles',
  'stat.vol': 'Expected vol',
  'stat.drawdown': 'Median drawdown',
  'stat.paths': 'Sampling',

  emptyTitle: 'Type a ticker to see the path distribution',
  emptyBody: 'Any A-share (SSE/SZSE/BSE), seven horizons from 1m to 1d. The model returns a distribution over future bars.',
  emptyHint: 'Stocks you use land in the watchlist automatically; pin favourites with ☆. Reopening the panel restores your last stock and result.',

  footNote:
    'Data: Sina / Tencent live quotes and adjusted bars. Model: KiT-284M (AGPL-3.0, Luciferbobo/KiT). '
    + 'Research use only, not investment advice.',
  footModelMissing: 'Model weights are not downloaded yet; finish setup to forecast.',
}
