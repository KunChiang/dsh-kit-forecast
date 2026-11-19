# KiT A 股走势预测（dsh-kit-forecast）

给 DeepSeek Harness 加一个常驻面板：**输入任意 A 股代码，用 KiT 扩散 Transformer 基座模型预测接下来的 K 线走势**。
输出不是一句"涨/跌"，而是若干条采样路径构成的**概率分布**——方向、幅度、区间和不确定性一次看全。

- 模型：[Luciferbobo/KiT](https://github.com/Luciferbobo/KiT)（KiT-L 284M，arXiv:2609.34507），本地推理，不上传你的查询
- 数据：新浪 + 腾讯的实时行情与前复权 K 线，**7 个周期**（1m / 5m / 15m / 30m / 1h / 2h / 日线）
- 形态：侧栏常驻面板，Canvas 画历史 K 线 + 预测分位带 + 中位路径，可开"实时跟随"定时重跑

> 仅用于研究与学习，不构成任何投资建议。

![KiT 走势预测面板](preview/panel-dark-result.png)

## 怎么用

1. 侧栏点「KiT 走势预测」（或输入框左侧的同名按钮）。
2. 首次使用（在别的机器上）点「初始化运行环境」：插件会建 venv、装 PyTorch、下载 1.1 GB 权重（断点续传，只需一次）。
   本机已经预置好，按钮显示「环境就绪」，可以直接预测。
3. 搜索框输入代码或名称（`600519`、`贵州茅台`、`sh601318`、`300750.SZ` 都行），从联想里选一只。
4. 选周期（`1d` 最快，`1m` 最慢也最细），点「开始预测」。
5. 想让它跟着盘面自己刷新，勾上「实时跟随」（交易时段每分钟重跑一次）。

### 面板读法

| 元素 | 含义 |
| --- | --- |
| 灰色蜡烛 | 最近 60 根**已收盘**的历史 K 线 |
| 蓝色/紫色蜡烛 | 中位路径对应的预测 K 线 |
| 蓝色虚线 | 预测收盘价中位数 |
| 深蓝色带 | q25–q75 分位区间（一半路径落在这里） |
| 浅蓝色带 | q05–q95 分位区间（90% 路径落在这里） |
| 预测中位涨幅 | 预测窗口末端的累计对数收益中位数 |
| 上涨概率 | 采样路径里末端收益 > 0 的比例 |
| 价格区间 | q05 ~ q95 对应的目标价 |
| 预期波动 / 中位回撤 | 单根 bar 对数收益的标准差中位数 / 最大回撤中位数 |

## 数据源

插件在运行时直接向公开行情接口取数，**不需要任何 token 或账号**，并按下面的顺序自动降级：

| 用途 | 主源 | 备源 | 说明 |
| --- | --- | --- | --- |
| 实时盘口（含涨跌停价） | `qt.gtimg.cn`（腾讯） | `hq.sinajs.cn`（新浪） | 2.5 秒缓存，用于行情条与涨跌停约束 |
| 1m/5m/15m/30m/60m K 线 | `quotes.sina.cn` | `money.finance.sina.com.cn` | 单次最多 1500 根，足够覆盖模型窗口 |
| 2h K 线 | 由 60m 聚合 | — | A 股 2h 网格是 11:30 / 15:00 各一根 |
| 日线（前复权） | `web.ifzq.gtimg.cn` qfq | 新浪日线 | 前复权口径与 KiT 训练数据一致 |
| 复权因子 | 腾讯 qfq 日线 ÷ 新浪原始日线 | — | 把分钟线也拉到前复权口径，避免除权跳空污染特征 |
| 交易日历 | 上证指数日线 | — | 用于生成未来 bar 的时间戳 |

几个刻意的处理：

- **只用已收盘的 bar**：正在走的最后一根会被丢弃（否则模型看到的是残缺 OHLC）。
- **时间戳用收盘时刻**并对齐 KiT 的会话网格（9:31–11:30 / 13:01–15:00），脏数据会被过滤。
- **涨跌停投影**：用盘口给出的真实涨停价反推幅度（主板 10%、创业板/科创板 20%、北交所 30%、ST 5%），把采样路径夹回当日可交易区间。

## 模型与服务

- 权重：`step_market_284M.pt`（KiT-L，283.7M 参数，EMA 权重），从 `hf-mirror.com`（默认镜像）下载到 `dataDir/ckpt`。
- 推理：`runtime/engine.py` 是常驻 worker，JSON Lines 协议；模型加载一次后常驻，Host 半通过 stdin 派发任务。
- 采样：rectified-flow 欧拉积分，`K` 条路径 × `N` 步；默认预算按周期不同（日线 16×24，1m 6×12），面板上可选「快速/标准/精细」。
- 设备：自动选 `cuda → mps → cpu`。没有 GPU 的机器也能跑，只是慢；面板会显示实际耗时。

实测（Apple M4 / 16 GB，`device=mps`，首次加载权重约 4–5 秒）：

| 周期 | 默认采样（路径 × 步数） | 单次耗时 | 主要开销 |
| --- | --- | --- | --- |
| 1d | 12 × 16 | 10–25 s | 序列 270 token，最便宜 |
| 2h / 1h | 8 × 14 | 18–28 s | 序列 380 / 420 token |
| 30m | 8 × 12 | 20–30 s | 序列 680 token |
| 15m | 6 × 10 | 18–26 s | 序列 864 token |
| 5m | 6 × 10 | 22–32 s | 序列 1056 token |
| 1m | 4 × 8 | 18–25 s | 序列 1320 token，注意力最重 |

耗时约等于「路径数 × 步数 × 单序列前向」；面板上的「快速 / 标准 / 精细」按 0.5× / 1× / 2× 放大采样预算。
CPU-only 的机器约慢 3–8 倍，可以先用日线。

各周期的模型窗口（KiT 固定，不能改）：

| 周期 | 1m | 5m | 15m | 30m | 1h | 2h | 1d |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 历史 Lc | 1200 | 960 | 800 | 640 | 400 | 360 | 250 |
| 预测 Lh | 120 | 96 | 64 | 40 | 20 | 20 | 20 |

## 安装

```bash
# 在 DSH 里安装本地目录（会链接这个 checkout，改动后重装即可生效）
dsh plugin --profile desktop add /abs/path/to/dsh-kit-forecast
```

或者在 Plugin Manager 里安装同目录下打包出的 `.tgz`。安装后 `cordis.patch.yml` 会插入一行：

```yaml
- insert:
    - id: kit-forecast
      name: 'dsh-kit-forecast'
```

### 配置

在那一行下加 `config`（没有声明 Schema，取值都会做范围收敛）：

```yaml
- insert:
    - id: kit-forecast
      name: 'dsh-kit-forecast'
      config:
        dataDir: /path/to/runtime     # venv + 权重目录，默认 $DSH_HOME/kit-forecast
        python: /path/to/python3      # 已有 torch 环境的解释器，默认 dataDir/venv/bin/python
        device: auto                  # auto | cpu | mps | cuda
        indexUrl: https://pypi.tuna.tsinghua.edu.cn/simple   # pip 镜像（可选）
        hfHost: https://hf-mirror.com # 权重镜像（可选）
        maxPaths: 32                  # 单次采样路径上限
        maxSteps: 48                  # 单次扩散步数上限
        timeoutMs: 900000             # 单次预测超时
```

## 接口

面板用的都是 `connection.fetch` 下注册的 `/api/kit-forecast/*` 路由（同源 + 凭据校验，不走外网端口）：

| 路由 | 作用 |
| --- | --- |
| `POST /status` | 运行环境：Python / torch / 权重是否就绪、各周期默认预算 |
| `POST /search` | 代码或名称联想 |
| `POST /quote` | 实时盘口 |
| `POST /bars` | 指定周期的历史 K 线（不跑模型，画图用） |
| `POST /forecast` | SSE：`stage` → `progress` → `result`，最后 `done` |
| `POST /setup` | SSE：初始化环境（建 venv / 装依赖 / 下载权重），逐行回显日志 |

## 目录结构

```
src/host/index.js       路由、SSE、初始化流程、涨跌停规则
src/host/datasource.js  行情抓取、复权、周期聚合、已收盘 bar 过滤
src/host/engine.js      Python worker 生命周期与 JSON Lines 调度
src/client/             面板、Canvas 图表、样式、文案
runtime/engine.py       推理 worker（构造窗口 → 采样 → 反归一化 → 汇总）
runtime/kit_v1/         KiT 官方模型代码（AGPL-3.0，原样引入，见 runtime/KIT_LICENSE）
scripts/fetch-model.mjs 多连接分段下载权重
scripts/build.mjs       esbuild 打包 client + 复制 host 到 lib/
```

## 正确性说明

- **和官方参考对齐**：用官方 demo 数据（`300591.SZ` 5m，anchor 2026-01-23）跑同一套窗口构造与采样，
  得到的末端收益中位数 −4.8%（官方发布结果 −5.6%，差异来自随机种子），随后 96 根真实 bar 的实际值 −5.8%，
  说明特征、规范化、日历特征与采样器与论文实现一致。
- **测试覆盖**（`npm test`，17 项，约 8 秒）：代码归一化、会话网格过滤、未收盘 bar 剔除、前复权因子匹配、
  `/forecast` 的 SSE 事件顺序、种子可复现性、涨跌停幅度推断、K 线不足与非法输入的报错路径；
  最后一项会用真实权重跑两次预测，断言两条结果逐位相同。

## 已知限制

- 权重 1.1 GB，首次初始化受网络影响较慢；已支持断点续传，中断后重新点初始化即可继续。
- 无 GPU 时 1m/5m 这种长窗口会比较慢，建议先用日线。
- 1m 周期只能用 1500 根不到的分钟数据（约 6 个交易日），体积 EMA 的预热不完整，越靠前的 bar 影响越大；模型窗口要求的下限是 1200 根。
- 分钟线只做了**按日前复权**（用复权因子缩放时，同一交易日内所有 bar 用同一因子），跨除权日的形态与严格前复权略有差异。
- 模型是"研究用"基座：它给的是条件分布采样，不保证方向准确，也不含任何基本面/新闻信息。

## 本机已安装状态（2026-11-18）

| 项 | 值 |
| --- | --- |
| 插件 | `dsh-kit-forecast@1.0.6`，已装进 `desktop` profile（Plugin Manager 安装，立即生效） |
| 运行时目录 | `~/Library/Application Support/dsh-desktop/harness/kit-forecast` |
| 虚拟环境 | `…/kit-forecast/venv`（Python 3.12 + torch 2.15.0 + numpy 2.2.6 + pandas 2.3.3） |
| 权重 | `…/kit-forecast/ckpt/step_market_284M.pt`（1.07 GiB，官方 KiT-L） |
| 推理设备 | Apple M4 / `mps`，fp32；首次加载权重约 4–5 秒 |
| 自检 | `npm test` 17 项全过（含真实权重的确定性对比）；`npm run check` 走通 status/search/quote/bars/forecast |

浏览器半是随插件加载的模块，需要 **重启一次 Harness**（或重开桌面窗口）让它进入新的模块代，
侧栏才会出现「KiT 走势预测」；Host 半的路由已经随安装即时生效。

## 许可

KiT 模型与 `runtime/kit_v1` 源码来自 [Luciferbobo/KiT](https://github.com/Luciferbobo/KiT)，以 **AGPL-3.0** 发布；本插件因为引入并链接了该代码，同样以 **AGPL-3.0** 发布（见 `runtime/KIT_LICENSE`）。
行情数据版权归各数据源（新浪财经、腾讯财经）所有，仅供个人研究使用。
