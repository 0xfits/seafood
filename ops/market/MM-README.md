# MM-README — 方案 C 外部做市机器人（运行手册）

外部做市（Market Maker, MM）方案：MM 是一个**普通平台账户**（独立 EVM 钱包），通过公开 API
在 BTTC/$ 币对双边挂限价单，让任何第三方（taker）挂价格交叉的对手单后都能成交。
平台撮合口径见下文「撮合与费用」；本方案**不改撮合引擎、零新路由**。

## 文件清单

| 文件 | 作用 |
| --- | --- |
| `backend-ts/scripts/market-mm-quotes.mjs` | 纯函数决策核（零 IO）：报价/撤旧挂新/库存护栏/create_key |
| `backend-ts/scripts/market-mm-quotes.test.mjs` | node:test 单测（**37 例**） |
| `backend-ts/scripts/market-mm-kill.mjs` | **kill switch**：登录 → `DELETE /api/order` 全撤；`--dry-run` 只列不撤；成功写 `mm-kill.flag`（0600）⇒ bot 只撤不挂，删 flag 自动恢复 |
| `backend-ts/scripts/market-mm-bot.mjs` | 长跑 bot：每轮 拉行情→决策→撤旧挂新；`--once` 单轮 |
| `backend-ts/scripts/market-mm-setup.ts` | 一次性初始化：建 MM users 行 + mint 库存（幂等） |
| `backend-ts/scripts/market-mm-taker-probe.ts` | 验收探针：临时第三方账号 挂交叉买单 + M3 撮合吃 MM 卖单 |
| `ops/market/readings/` | 运行读数（setup / bot 轮次 / 探针 / DB 对账 / orderbook） |

## 前置事实（两库 cid 不同）

- quote 恒为 `$`（平台积分，`cid=1`）；base = 平台币 BTTC（`name='BTTC'`，dev `cid=399` / 生产 `cid=4`）。
- **MM_BASE_CID 必须按库设置**：dev 库跑 bot/探针用 `MM_BASE_CID=399`，生产用 `4`。
- MM 私钥在 `~/.config/seafood/mm.env`（`0600`，`MM_PRIVATE_KEY=0x…`）；**值 [REDACTED]、不入库、不打印**。
- bot 本地 state 在 `~/.config/seafood/mm-state.json`（`0600`，仅记 last_ref_price 等，可删可重建）。

## 运行方式

```bash
# 0) 单测（零依赖，node:test）
cd backend-ts && node --test scripts/market-mm-quotes.test.mjs

# 1) 初始化 MM 账户 + 注库存（幂等：同幂等键重跑 = 重放不重复 mint）
cd backend-ts && ./node_modules/.bin/ts-node --transpile-only scripts/market-mm-setup.ts
#    覆盖项：MM_MINT_USD（默认 1000000）/ MM_MINT_BASE（默认 10000）/ MM_SETUP_KEY_EPOCH（默认 1）

# 2) bot 单轮（dev 验收口径）
MM_API_BASE=http://localhost:5788 MM_BASE_CID=399 \
  node backend-ts/scripts/market-mm-bot.mjs --once

# 3) bot 长跑（cron/pm2/systemd 拉起；缺省死循环 + 出错指数退避）
MM_API_BASE=<api> MM_BASE_CID=<按库> node backend-ts/scripts/market-mm-bot.mjs

# 4) 验收探针（临时第三方账号：mint 测试资金 → API 挂交叉买单 → M3 撮合 → 读回成交）
cd backend-ts && ./node_modules/.bin/ts-node --transpile-only scripts/market-mm-taker-probe.ts
#    覆盖项：MM_TAKER_API_BASE / MM_TAKER_MINT_USD（默认 50000）/ MM_TAKER_BUY_AMOUNT（默认 2）
#    临时钱包私钥落 ~/.config/seafood/mm-taker.env（0600），同钱包重跑 = 挂单/资金幂等重放
```

dev 后端起法：`cd backend-ts && PORT=5788 ./node_modules/.bin/ts-node --transpile-only src/index.ts`
（先 `curl /api/health` 确认 `ok:true`）。

## env 清单（bot + setup + 探针；`[REDACTED]` = 机密，只存在于 mm.env）

| 键 | 缺省 | 说明 |
| --- | --- | --- |
| `MM_PRIVATE_KEY` | 无（必填，setup 生成） | MM 钱包私钥，**[REDACTED]**，`mm.env` 0600 |
| `MM_API_BASE` | `https://0xseafood.com` | 平台 API；dev 用 `http://localhost:5788` |
| `MM_BASE_CID` | `4`（生产 BTTC） | **按库设置**：dev `399` |
| `MM_QUOTE_CID` | `1` | quote = $ 平台积分（服务端恒 1，仅决策/对账用） |
| `MM_SPREAD_PCT` | `1` | 全跨 %，双边各摊一半（买 floor / 卖 ceil） |
| `MM_ORDER_SIZE_BASE` | `100` | 单笔目标挂量（BTTC 个数） |
| `MM_REF_PRICE` | `1000` | 无成交时的参考价（ref 1000 · 全跨 1% ⇒ 买 **995** / 卖 **1005**）；显式置空（`''`/`0`）= 不给 env 价 |
| `MM_INTERVAL_S` | `60` | 轮间隔秒 + create_key 时间窗宽 |
| `MM_MAX_INVENTORY_PCT` | `50` | 单笔名义额 ≤ 库存总值的 % |
| `MM_MAX_NOTIONAL_USD` | `500000` | 单边挂单名义额硬上限（$） |
| `MM_MAX_INVENTORY_SKEW_PCT` | `90` | 买卖两侧库存偏离上限（%），超限则该侧不挂 |
| `MM_MAX_CONSEC_FAIL` | `5` | 连续 N 轮报价失败 ⇒ 自动降级「只撤不挂」 |
| `MM_METRICS_LIMIT` | `100` | `mm-metrics.json` 滚动保留轮数 |
| `MM_KILL_FLAG` | `<env 同目录>/mm-kill.flag` | kill flag 路径（存在 ⇒ 只撤不挂） |
| `MM_HEALTH_PORT` | 空（不启用） | 设端口则暴露 `GET /healthz` |
| `MM_STATUS_MAX_AGE_S` | `300` | `--status` 判 stale 的阈值（超龄退出码 2） |
| `MM_STATE_FILE` | `<mm.env 同目录>/mm-state.json` | state 路径 |
| `MM_MINT_USD` / `MM_MINT_BASE` / `MM_SETUP_KEY_EPOCH` | `1000000` / `10000` / `1` | 仅 setup |
| `MM_TAKER_API_BASE` / `MM_TAKER_MINT_USD` / `MM_TAKER_BUY_AMOUNT` | `http://localhost:5788` / `50000` / `2` | 仅探针 |

ref 价格来源链：**最近成交价 → env → state → 无**（无来源 ⇒ 只撤不挂 + 告警）。

## 常驻与开机自启（生产现状 · 2026-10-22）

```bash
pm2 start backend-ts/scripts/market-mm-bot.mjs --name seafood-mm -- --env ~/.config/seafood/mm-prod.env
pm2 save                     # 固化进程表到 ~/.pm2/dump.pm2（已执行）
# 登录级自启（已安装，无需密码）：~/Library/LaunchAgents/com.kevin.pm2-resurrect.plist
launchctl load  ~/Library/LaunchAgents/com.kevin.pm2-resurrect.plist
launchctl list | grep pm2    # 应见 com.kevin.pm2-resurrect
# 开机未登录也要拉起（需管理员密码，二选一）：
sudo env PATH=$PATH:/usr/local/bin /Users/kevin/.nvm/versions/node/v20.20.2/lib/node_modules/pm2/bin/pm2 startup launchd -u kevin --hp /Users/kevin
```

- 现状：`pm2 save` 已执行；**登录后自动 resurrect**（LaunchAgent）。机器重启但未登录 → 不启动（用户级限制）。
- 停做市：`pm2 stop seafood-mm`；彻底移除：`pm2 delete seafood-mm && pm2 save`。

## 运维速查（P1 · 2026-10-22）

```bash
# 健康快照（离线读 state/metrics；stale ⇒ 退出码 2）
node backend-ts/scripts/market-mm-bot.mjs --env ~/.config/seafood/mm-prod.env --status

# 一键停做市并全撤（写 kill flag ⇒ bot 只撤不挂；删 flag 自动恢复）
node backend-ts/scripts/market-mm-kill.mjs --env ~/.config/seafood/mm-prod.env
node backend-ts/scripts/market-mm-kill.mjs --env ~/.config/seafood/mm-prod.env --dry-run  # 只列不撤
rm ~/.config/seafood/mm-kill.flag                                                      # 恢复报价

# 每轮指标：MM_ENV 同目录 mm-metrics.json（滚动 100 轮：ts/ref/quotes/placed/cancelled/errors）
```

容器化（未部署）：`ops/market/docker/{Dockerfile,fly.toml,package.json}` —— Fly 最小配置（shared-cpu-1x/256MB、`min_machines_running=1`、`/data` 卷、私钥走 secrets）。

## 撮合与费用（平台现口径，勿凭直觉假设）

- **挂单即撮合（2026-10-22 起）**：`POST /api/order` 建单后自动执行 taker 循环撮合
  （`matchTakerOrderLoop` → M3 `matchMarketOrders`）；响应加性 `matches[]` / `remaining`；
  replay（同 `create_key` 重投）不补撮合。
- 成交口径：对手方**服务端选择**（价格交叉 + 非自身优先）、定价**恒 = 买单限价**（DL85）、
  幂等键 `biz:market:trade:<taker_order_id>:<fill_no>`；单笔失败（含自成交）终止循环保留已完成部分。
- **自成交**：同一账号的买卖单永不互相成交（编排排除 + 账本 `v_from = v_to` 双闸）⇒ MM 自己的
  两单互不撮合，但任何第三方单都能吃到 MM 的报价。
- taker 流程：挂价格交叉的单（买价 ≥ 最优卖价）⇒ 下单响应即带成交明细。
- **手费 = taker 付**，恒 `$`(cid 1)、是消耗不是冻结（撤单不退）：`fee = (qty × 买单限价 × fee_rate_bp + 5000) / 10000`
  （半进位），费率真源 `commission_policy.fee_rate_bp`。**maker（MM）不付手续费**。
  dev 实测费率 `1000bp`（10%）：2 ₿ @ 10050 成交收 taker $2,010（trade_id 9）。

## 护栏（决策核内置，单测覆盖）

- **自成交双闸**：同价目标双边 `buy < sell` 结构性隔离（零跨也强制 `sell = buy + 1`）；平台侧
  `resolveMarketCounterparty` 非自身优先 + 自成交响亮拒绝兜底。
- **单边挂量** = `min(MM_ORDER_SIZE_BASE, 库存名义额 × MM_MAX_INVENTORY_PCT/100 折 base, 可冻资金/买价 或 base 余额)`；
  一侧挂不出 ⇒ 降级小单 + 告警；两侧都挂不出且无在价工作单 ⇒ `cancel_only`（只撤不挂）。
- **撤旧挂新**：已在目标价的单保留（同价不重挂、不重放），偏离才撤；模糊失败由 create_key 幂等兜底。
- **create_key 幂等**：`biz:mm:<base>:<quote>:<side>:<price>:w<seq>`（seq = 时间窗）——同窗重试同键
  （服务端幂等重放安全）、换窗/换价/换向新键；前缀闭集 `biz:`（平台只认 `biz:/cm:/cli:/ops:`）。
- config fail-loud：任何 env 键非法即拒绝起跑。

## 停止方法

```bash
# ① 停 bot（无队列、无内部状态机，state 仅参考价，随时 kill 安全）
pkill -f market-mm-bot.mjs

# ② 撤 MM 全部挂单（平台全撤端点；需 MM 私钥登录拿 token）：
cd backend-ts && node --input-type=module -e "
import { Wallet } from 'ethers';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(process.env.HOME + '/.config/seafood/mm.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const w = new Wallet(env.MM_PRIVATE_KEY);
const api = process.env.MM_API_BASE || 'http://localhost:5788';
const post = (p, b) => fetch(api + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
const ch = (await post('/api/auth/challenge', { evm_address: w.address.toLowerCase() })).data;
const sig = await w.signMessage(ch.message);
const tok = (await post('/api/auth/verify', { evm_address: w.address.toLowerCase(), signature: sig, challenge_token: ch.challenge_token })).data.token;
const del = await fetch(api + '/api/order', { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());
console.log('cancelled:', JSON.stringify(del).slice(0, 200));
"
# ③ 验证盘面：curl $MM_API_BASE/api/market/<MM_BASE_CID>/orderbook ⇒ data 应为 []
```

## dev 验收记录（2026-10-22，PORT=5788，schema 0072）

- 单测 **37/37** 绿（`node --test scripts/market-mm-quotes.test.mjs`）。
- setup 幂等重跑：两 mint 均 `idempotent_replay: true`（键 `ops:mm:setup:mint:{usd,base}:e1`）；
  MM = uid 971229，库存 $1,000,000 + ₿10,000。
- bot `--once` 保单轮：双边 9950/10050 已在目标价 ⇒ keeps 两单、零撤零挂、`mode: normal`。
- 探针成交链：taker（临时钱包 uid 971230）买 2 @ 10050 → M3 撮合 × MM 卖单 28 →
  `market_trade` trade_id 9（价 10050 × 2，taker fee 2010 @1000bp）；买单 29 `filled`、
  MM 卖单 28 `partial` 余 98、MM 买单 27 原封；orderbook 仍双边（9950×100 / 10050×98）。
- 对账：MM $ +20,100（maker 不付费）；taker $ −20,100 −2,010 费、+2 ₿。读数见 `ops/market/readings/`。
