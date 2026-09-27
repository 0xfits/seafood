# 海鲜市场（Seafood）总体工作计划

> 版本 v0.2 · Zang · 状态：**口径已冻结（D1–D8 全部拍板）** · Round 1 已派单
> 本文件是**唯一进度真源**（living plan）。每期开工前由 Jing 出 `docs/*.spec.md` 冻结口径，本文件只记阶段/派单/验收，不记实现细节。

---

## 0. 一句话定位

【海鲜市场】= 以社区积分 **`$`** 为基石的 **社区交易 + 招工 + 积分交易所 + 终身多级返佣** 平台。
UI 仿闲鱼（goofish.com）：黄黑高对比；提供 **PC 横屏** 与 **手机竖屏** 两种浏览形态。

---

## 1. 现状盘点（全部为本次实测）

| 项 | 实测结果 | 证据 |
|---|---|---|
| 代码基线 | `seafood/` 是 `jinli/` 的**逐字副本**。差异仅 3 处：`frontend/src/components/reward/RewardCard.jsx`、`frontend/src/components/ui/DashJ.jsx` 内容不同；`jinli` 多一个 `test/unit/reward-card.test.jsx` | `diff -rq jinli seafood` |
| 前端 | React 18 + Vite + react-router-dom 6 + Tailwind 4；路由 `/:lang?/*`，多语言 zh/en/hk/vn；开发端口 **5777**（`/api` 代理 → 5778） | `frontend/{package.json,vite.config.js,App.jsx}` |
| 后端 | Express 4 + TypeScript；`@neondatabase/serverless@0.6`（**HTTP 单语句驱动**）；**50 条路由**；`database.ts` 3078 行 + `index.ts` 1086 行；**无后端测试框架** | `backend-ts/package.json`、`grep -c "app\.(get\|post…)"` |
| 数据库 | 新库连通正常。PostgreSQL **18.6**；`public` schema **0 张表**、0 列；仅存在 `neon_auth` 的 9 张 Neon Auth 系统表 ⇒ **真·空库，无存量数据迁移** | psycopg2 只读探针（本次实测） |
| 仓库 | `origin = github.com/0xfits/seafood.git`，分支 `main`，工作区干净 | `git remote -v`、`git status --porcelain` |
| 面板 | seafood **尚未在 ctrl 面板注册**，且与 jinli 抢占 5777/5778 | `ctrl/index.js` |
| 凭据 | `seafood/` 下**无任何 `.env*`**，新库连接串尚未落盘 | `ls seafood/**/.env*` |

### 三条红色预警（P0 必须解决，否则后续全部返工）

1. **零事务（最高危）** — 全后端用 `neon()` HTTP 驱动，逐条 SELECT/INSERT，**没有任何 `.transaction()` / Pool / BEGIN**。而本项目的金额、托管、撮合、返佣**全部是跨多表写入**。现有写法必然产生「扣了钱没发货」「发了佣金没扣钱」「超发积分」。**金融内核必须先建事务层，再动业务。**
2. **端口冲突** — 5777/5778 已被 jinli 占用。seafood 必须分配独立端口并注册面板（默认 5787/5788）。
3. **旧模型是单币种** — `asset.points` 是单一数值，`shard(bID, uID)` 把「商品」与「积分类型」混在同一个 `bID` 维度里。新需求要求**任意多币种流通**。这是**方向性重构**，不是加字段。

---

## 2. 术语冻结（先冻结，防全站口径分叉）

| 术语 | 含义 |
|---|---|
| **`$`** | 平台基础积分 / 系统币。一切计价、手续费、保证金的记账单位。符号 = 字母 S + 竖划线 |
| **社区积分 / 自建单位** | 用户自建的流通单位（如 `dashJ`），可在交易所与 `$` 兑换。上市需缴保证金，创建/上市消耗平台积分 |
| **招工** | 雇主发布的工作单，酬金以某单位计价 |
| **打工** | 接单并交付、领取酬金的行为（**触发平台手续费与返佣的唯一场景**） |
| **商品 / 挂单** | 卖家发布商品并以任意单位标价 |
| **交易所** | 以 `$` 为计价基础货币的多单位订单簿 + 汇率走势 |

> 命名口径：中文界面统一用「积分」，**符号只用一个 `$`**；`dashJ` 是「用户自建单位」的示例，不再作为系统币名。

---

## 3. 领域模型（拆解草案 · 正式口径由 Jing 落 spec）

用 **3 个核心抽象**替换旧模型的混杂结构。

### 3.1 多币种账本（Ledger）

- `currency` — `cID, symbol, name, icon_url, owner_uID(0=平台系统币), decimals, total_supply, status(draft|listed|frozen|delisted), deposit_amount, deposit_cID, listed_at`
- `account` — 唯一键 `(uID, cID)`；`balance`（可用）+ `frozen`（挂单/托管冻结）
- `ledger_entry` — **只追加（append-only）**：`txID, uID, cID, delta, balance_after, kind, ref_type, ref_id, idempotency_key UNIQUE, time_created`
  - `kind` 枚举：`mint / transfer / job_escrow / job_payout / job_fee / purchase / sale / trade / trade_fee / listing_deposit / refund / commission`
- **铁律**：任何余额变动 = **同事务内**写 `ledger_entry` + 更新 `account`；`sum(delta) == account.balance` 必须能随时重算校验（对账脚本）。
- **幂等**：所有写接口必须带 `idempotency_key`（防重复提交/防重试双扣）。

### 3.2 订单 / 挂单

| 新实体 | 承接旧实体 | 说明 |
|---|---|---|
| `job` + `job_order` | `task` + `task_progress` | 招工 + 打工单。状态机：`open → taken → submitted → accepted → paid`（并联 `rejected / expired / disputed`） |
| `listing` + `listing_order` | `prize` + `prize_item`（含 `chest` 开箱） | 商品 + 成交单。需库存/退款/争议 |
| `market_order` + `market_trade` | 同名旧表 | 扩为 `base_cID + quote_cID` 币对 |
| `candle` **（新增）** | — | `(base_cID, quote_cID, period, bucket) → o/h/l/c/v`，供汇率走势图 |

### 3.3 返佣（终身 · 10 级）

- `referral_edge(inviter_uID, invitee_uID, time_bound)` — 终身唯一绑定
- `referral_closure(ancestor_uID, descendant_uID, level)` — 物化闭包 ⇒ O(1) 查 10 级祖先链
- `commission_payout(source_txID, beneficiary_uID, level, cID, amount, weight_applied, time_created)` — 每笔佣金落一行，**可审计可回溯**
- **权重矩阵存 `app_config`**（后台可配）；「随时间的推移变化」= 按 `time_bound` 起算的**账龄分档**（如 T+0 档 / T+30 档 / T+365 档各一套 10 级权重）

---

## 4. 旧 → 新 模块对照（保留 / 改造 / 重构 / 废弃）

| 旧模块 | 处置 | 新形态 |
|---|---|---|
| `frontend` 骨架（Header/Footer/Layout/路由/i18n/Toast/Modal/Form/Table…） | **保留改造** | 结构复用，视觉层按 goofish 重做 |
| `components/ui/*`（含 `DashJ.jsx`） | **保留备用** | `DashJ` 泛化为 `CurrencyGlyph`（任意单位符号渲染，`$` 为系统单位） |
| `task` / `task_progress` / `TaskPage` / `TaskCard` | 改造 | 招工 / 打工 |
| `prize` / `prize_item` / `chest open` / `RewardPage` / `RewardCard` | 改造 | 商品 / 商品订单 |
| `market_order` / `market_trade` | 改造 | 交易所（多币种 + K 线） |
| `shard` / `shard_transfer` / `ShardPage` | **重构并入** | 通用 `account` / `ledger_entry` |
| `admin/*`（TasksManagement / RewardsManagement 发布） | **废弃** | 平台运营后台（费率 / 保证金 / 返佣权重 / 合规审核 / 用户） |
| `permission_group` / `app_config` | 保留 | 权限分组 + 系统设置 |
| `auth.ts` / `WalletAuthPanel`（EVM 钱包签名登录） | **待定 D3** | — |
| 多语言 zh/en/hk/vn | **待定 D4** | — |

---

## 5. 决策点

| # | 决策 | 冻结口径（Kevin 拍板 2026-09-27） |
|---|---|---|
| **D1** | 数据访问层 / 事务 | **保留 Express + Vercel serverless**，仅把 `neon()` HTTP 驱动换成支持事务的连接池。⚠️ 连带约束：`neon()` 的 `transaction()` 只支持「语句预先已知的一次性批量」，而撮合与分佣需要**读后写**（读挂单→算成交→按结果分佣）⇒ **必须升级为 `Pool` over WebSocket**（`ws` + `neonConfig.webSocketConstructor`）或 `pg` 连接池，才能拿到交互式事务。 |
| **D2** | 端口与面板 | 前端 **5787** / 后端 **5788**，ctrl 面板 group `seafood`（与 jinli 的 5777/5778 解耦） |
| **D3** | 登录方式 | **保留 EVM 钱包签名登录**（延续 jinli `auth.ts` / `WalletAuthPanel`）。⚠️ 连带约束：邀请码不能走「手机号表单」，改为**邀请链接 / URL query（`?ref=<code>`）在首次连接钱包时绑定**；`uID` 沿用现有 EVM 派生逻辑；无手机号 ⇒ 账号找回与客服路径需另行设计（P6）。 |
| **D4** | 多语言 | **先只做 zh**，保留 i18n 框架与挂点，不删 |
| **D5** | 招工验收人 | **雇主自审 + 平台仲裁兜底**（管理员不再发布、也不逐单审核） |
| **D6** | 手续费 ↔ 返佣 关系 | 酬金的 1%–5% 平台扣留 → **全额进佣金池**，按 10 级权重分给邀请链；**平台不从中抽成**。平台收入 = **交易所成交费** + **上市保证金**。 |
| **D7** | 保证金性质 | ⚠️**v0.3 更正**：上市保证金 = **消耗（不可退）**，依据 Kevin 原文「用户自定义的社区积分如需上市，**需要消耗**一定的积分作为保证金」⇒ 它是**平台收入项**（与 D6 自洽）。v0.2 曾写作「冻结可退」，那是 Zang 自行发挥、与原文冲突，**撤回**。交易所挂单另行冻结的是**挂单标的资产**，与保证金无关。交易手续费 = 消耗 `$`。 |
| **D8** | 路线图先行顺序 | **P0 地基 → 视觉骨架预演（1 轮，定风格）→ 账本内核 → 业务模块**（视觉风格不定死，后续所有页面都会返工） |
| **D9** | 视觉主题 | **一整套主题体系、两个外观档**（Kevin 2026-09-27 更正）：**日间模式 = 变体 A「码头大牌」**（高饱和黄 #FDE815 主导 + 白卡 + 黑描边 + 黑硬投影）；**夜间模式 = 变体 B「夜市行情板」**（底 #0B0C0E + 卡 #141619 + 黄只打价格与主按钮）。变体 C 弃用。**不是两套设计**——两档必须共用同一套组件与 token 语法，差异只收敛到 token 值层（含形状 token）。详见 **§5.3**（已撤回 v0.4 的「形状统一取 A」旧裁决）。 |
| **D10** | 账本写路径形态 | ⭐ **Kevin 2026-09-27 拍板：变体 B —— 把记账压进 DB 函数**。一次往返完成「校验 + 幂等占位 + 加锁 + 分录 + 余额/冻结更新 + 配对不变式」：`SELECT ledger_post_event($1::jsonb) RETURNS jsonb`。TS 侧退化为**参数组装 + 错误映射**，记账核心逻辑落进 PL/pgSQL（新增 migration，不得改 0001/0002）。依据：单笔请求往返次数 = 语句数，而本机↔Neon RTT 190–290ms ⇒ 语义上「**一个业务事件 = 一次原子调用**」既是性能解、也是账本最该有的形态（spec §7 事务清单本就按事件组织）。<br>**连带收益（消除 D1 的残留风险）**：写路径不再需要**交互式事务**⇒ 不再需要 `Pool` over WebSocket（`ws`）⇒ **D1 里「`ws` 在 Vercel 上是否可用」这个未验证风险被结构性消除**（单语句 HTTP 查询在 Vercel Edge/Node 两种 runtime 都成立）。**Vercel 真实部署验证仍值得做，但它已从「可能推翻 D1 的闸门」降级为「上线前的常规确认」。**<br>**连带约束（必须一并进 brief）**：① **错误必须机读且能一一映射到 spec §14.1 关闭集**（PL/pgSQL 用自定义 SQLSTATE + `MESSAGE`/`DETAIL` 传结构化错误，TS 侧 `normalizeLedgerError` 负责映射；**不得出现无法归类的 500**）；② 函数须在同一语句内完成，**行锁持有时间 = 该语句执行时间**（同区域部署下亚毫秒级），`lock_timeout` 与语句数的耦合随之消失；③ 写入路径的读-改-写竞态由 DB 内 `SELECT ... FOR UPDATE` + 全序保证（沿用 R79）；④ PL/pgSQL 也必须有测试——质检探针**直接调函数**，不经 TS 服务层。 |
| **D11** | 身份表命名 | ⭐ **Kevin 2026-09-27 拍板：`user` 表重命名为 `users`**。依据：`user` 是 PostgreSQL **保留字**，`SELECT ... FROM user` **不报错**、而是静默退化成 `current_user` 并返回错误结果（实测：裸 `user` = 1 行 / `"user"` = 0 行）⇒ 是**静默给错答案**类陷阱。**趁 0 行时改**（成本 = 一条 migration + 改引用）；数据涨起来后就是停机迁移 + 全量查询审计，且可能藏在未覆盖分支里。<br>**连带**：① 走**新增 migration**（`0001`/`0002` 不可改，checksum）；② 改表名 + 关联对象名（PK/索引/序列/约束），**并核查是否有 FK 指向它**；③ 全仓引用（`"user"` 17 处 / `'user'` / 裸 `user`）逐一改，**先出引用清单再动**；④ `docs/**` 内的引用由 Jing 另轮同步（含 spec 与主计划）；⑤ 改完必须实测「改名后原陷阱写法已不可能命中」（裸 `user` 不再指向任何业务表）。<br>**排期**：⏳ 原排在 P1e 之后；**实测后重排为「P1i 修复单（0005）之后」⇒ 本单迁移号 = `0006`**（同一文件同时只有一个写者；且质检期不得改 schema，否则探针读数作废）。 **✅ 已于 2026-09-27 执行完毕（migration `0006`，checksum `4aa19b148700`）—— 见 §5.14。** |

---

### 5.1 Zang 裁定（对 Jing `docs/ledger.spec.md` §15 待拍板清单）

| 条目 | 裁定 | 依据 |
|---|---|---|
| **R31** 保证金 vs 平台收入 | **上市保证金 = 消耗（不可退），计入平台收入**；另设 `listing_fee` / `currency_create_fee` 承载上市手续费。**不存在「可退保证金」概念**，因此有 D7 的更正。 | Kevin 原文用「消耗」；且须与 D6 的平台收入结构自洽 |
| **R15** `ledger_entry` 双字段 | **采纳**（`delta` 可用变动 + `frozen_delta` 冻结变动）。单一 `delta` 无法记录「冻结资金直接支付给对方」。 | 记账完备性 |
| **R74** DB 层守卫触发器 | **采纳**，但 P0 必须实测「同事务内先插分录对后续 `account` 更新可见」这一假设；若不成立，改为应用层守卫 + 对账脚本兜底。 | 这是唯一能在 DB 层拦住「扣了钱没落流水」的手段 |
| **R21** 新增 `ledger_owner` 辅助表 | **采纳**（平台账户需要 FK 目标）。legacy `"user"."uID"` 类型收敛（text→bigint）**推迟到 P0 单独评估**，不阻塞账本设计。 | 见 §5.2 |
| **R22** 命名 | **采纳 snake_case 无引号**（新表一律 `uid/cid/delta`），外部 API 仍出 camelCase。 | 旧库带引号驼峰已造成 `"uID"` 引用地狱 |
| **R48** 幂等键作用域 | **采纳全局唯一 `UNIQUE(idempotency_key)` + 强制业务前缀**（`biz:` / `cm:` / `cli:` / `ops:`）。 | 复合唯一会被「同 key 跨业务」绕过 |
| **R56** 事务走 UNPOOLED | **采纳**（事务/锁走直连，只读走 pooler），但 P0 必须实测三件事：① `Pool` over WebSocket 的交互式事务可用性 ② `pg_advisory_xact_lock` 经 Neon pooler 是否可用 ③ 直连上限与 Vercel serverless 并发是否匹配。**这三项是 P3/P5 的可实现性前置。** | 未实测 |
| **R103** 平台收入账户能否提取 | **在明确批准 `platform_withdraw` 之前，平台收入账户只进不出**，后台不得出现提取按钮。 | 安全默认 |
| **R36** 不新增 `frozen_breakdown` | **采纳**（`frozen` 为聚合投影，归属真源在业务表，由对账判据 5 兜底）。 | 避免双真源 |
| **R79** 加锁全序 | **采纳** `currency(cid↑) → account(uid↑) → 业务行(主键↑)`。10 级佣金最多涉 13 个账户，是死锁高发点。 | 一致性 |

### 5.2 新发现（Zang 实测，优先级最高）

1. **仓库 DDL 只有 9 张表，旧库有 16 张。** 缺失清单：`user`、`asset`、`task`、`chest`、`shard_order`、`shard_trade`、`user_chest_stats`。
   `ensureSupportSchema()` 只 `CREATE` 那 9 张，对其余只做 `ALTER TABLE IF EXISTS`（**在空库上是空操作**）。
   ⇒ **在全新空库上按现有代码启动，应用当场崩溃。这是 P0 的硬缺口。**
2. **旧库 schema 不可当蓝图。** 只读实测旧 jinli 库：`user`（**无主键**，`uID`/`EVM` 全 `text`）、`task`（无主键、全 `text`）、`task_progress`（全 `text`）、`prize_item`（全 `text`）—— 处于**半迁移退化态**；而 `asset`/`shard`/`market_order` 是正常强类型且带序列与 CHECK 约束。
   ⇒ 新库核心表**必须重新设计**：既不照搬旧库，也不照搬仓库里那 9 张。
3. 旧库数据量极小（`user` 14 / `asset` 14 / `shard` 17 / `prize` 5 / `task` 4 行）⇒ 将来若要搬旧数据量级可忽略；**当前计划是不搬，全新开始**。
4. Jing 指出 D3 措辞与代码不符：`auth.ts` 登录只返回 `{ evm }`，`uID` 由 `src/database.ts:410` 的 `MAX(BTRIM("uID")::int)+1` 分配，**不是「EVM 派生」**。⇒ D3 措辞更正为「**uID 沿用现有分配逻辑**」。

---

### 5.3 主题体系裁决（D9 的连带影响）

Kevin 口径（2026-09-27 更正）：**「不是双主题，单一主题就可以；A 做日间模式，B 做夜间模式，综合 A 和 B 形成一整套主题。」**
⇒ 即：**一套主题体系、两个外观档**。不是两套设计，也不是在两个变体里各挑零件拼装。

1. **同构优先**：日/夜共用同一套组件与 token 语法 —— DOM 结构、元素顺序、信息层级、列数、间距栅格、交互全部一致；两档的差异**只允许收敛到 token 值层**。
2. **形状也进 token 层**（⚠️ 撤回 v0.4 的「形状语言统一取 A」裁决）：圆角 / 描边 / 投影随主题切换 —— 日间＝A 的 `13px 圆角 + 1.5px 描边 + 3px 硬投影`，夜间＝B 的 `2px 圆角 + 零投影`。
   **但同一主题内全站必须一致**：禁止同一主题里混用两种形状语言。
3. **数字排版统一取 B**：价格、汇率、余额一律 `tabular-nums` + 等宽，两主题共用。（交易所站点数字不对齐不能接受。）
4. **必须有语义化 design token 层**，禁止在组件里散落色值/圆角/阴影值。主题切换 = 换一组 token。
5. **Tailwind 4 的暗色要用 class 策略**（`@custom-variant dark (&:where(.dark, .dark *))`），不用默认的 `prefers-color-scheme` 媒体查询策略——否则用户手动切换无法覆盖。
6. **它是一个用户可见功能**：需要主题切换入口、持久化（localStorage）、首次访问跟随系统。
7. **P7 可判负 AC（更正版）**：切换主题前后，对同一批元素取 `getBoundingClientRect()`，**位置与尺寸（x/y/width/height）必须逐值相等**；允许变化的是 `border-radius` / `box-shadow` / 颜色（它们是形状 token），**但不得因此造成任何元素位移或横向溢出**。
   ⚠️ 工程约束：描边宽度若两档不同，**必须用 `box-shadow` / `outline` 模拟**（或 `box-sizing: border-box` 下尺寸不变），否则会因边框宽度差引起 1px 级布局位移。
8. **商品图在深底下的可见性**：图片位必须有描边或底衬，避免浅色商品图在夜间模式下糊成一片。

---

### 5.4 Zang 裁定（对 `docs/design/design-system.spec.md` 的 N1–N17 待定项）

| 条目 | 裁定 | 理由 |
|---|---|---|
| **N9 / T30** 列数 vs 字号（最关键的一条） | **列数是布局维度，必须跨档稳定 ⇒ 统一取 A 的 PC 4 列 / 手机 2 列**；卡片内价格字号随之取 A 档（**放弃 B 的 26/30/52px 卡片内超大数字**）。<br>**但 B 的大字等宽数字不全废**：**行情条与交易所行情表是全宽元素，不受卡片列数约束 ⇒ 在这些位置保留 B 的大字等宽数字**（仍 `tabular-nums`）。 | 列数若随主题变，响应式测试面翻倍、切换主题时整个网格会重排；而 B 的「行情板」性格主要由**行情区**的数字尺度承载，不必牺牲卡片密度去换。 |
| **N8 / T20** 6 个无出处 token | **批准**（`--sea-surface-hover` / `-disabled` / `-skeleton` / `focus-ring` / `-border-strong` / `-border-media`）。值取自比选稿已有色值 + 本册指派用途，**须在规范里标注「本册指派」**。 | 原稿是「比选稿」不是「完整设计稿」，本册的职责正是把它补成可用 token 层 |
| **N1** `1.5px` 描边在 DPR=1 实测为 1px | **知悉，采纳 T23「描边零占位」硬规则**（描边不得影响布局尺寸）；token 值仍忠于原稿写 `1.5px`。 | 设备相关差异不能当口径；用「不占位」把风险从口径层消掉 |
| **N10** 日档数字字形改用等宽（偏离 A 原观感） | **接受**。§5.3.3 已定「两档共用等宽数字」。 | 交易站数字不对齐不可接受 |
| **N14** 日档涨跌色在白底对比度仅 1.78–3.91:1 | **采纳 T63**：日档涨跌必须坐在**深色底衬**上（胶囊）。 | 可达性硬性项，不是审美偏好 |
| **N16** `--sea-glyph` 占位字是否算内容 | **裁定为装饰**，不纳入 3:1 阈值。 | 它不承载任何信息，是图片位的视觉占位 |
| **N17** §7 只覆盖 12 类组件 | **接受**。P7 开工前由 Jing 补一份附录（表格 / 图表 / 对话框 / 长表单），沿用本册 token 语法与 §9 反例清单。 | 覆盖缺口已知即可，不必现在补 |
| **§8.3 的 9 条强制改动** | 其中**可达性必要的 5 条直接落地**（不需 Kevin 逐条拍板）；其余 4 条进规范正文并标「一句话可改」。 | 可达性是硬门槛，不是可选项 |

---

### 5.5 关键性能发现：单笔转账 3.3–4.4 秒（**P1b 实测，架构级**）

**实测读数**（`docs/qa/p1-ledger-concurrency.md` §0.3，无任何并发争抢）：

```
transfer 单笔 3873 / 3322 / 4363 ms      mint 单笔 2464 / 2120 / 3104 ms
BEGIN…COMMIT 单独 2250 / 1377 / 1478 ms
```

**根因**：本机 ↔ Neon（ap-southeast-1 新加坡）**每语句 RTT 190–290 ms**，而一笔 `transfer` 需要 **~10–14 条语句**（`BEGIN` + `2×SET LOCAL` + 读币种 + `2×加锁` + `2×(INSERT+UPDATE)` + `COMMIT`）⇒ 延迟 = 语句数 × RTT。

**直接后果**：`lock_timeout = 3s`（`db.ts:85-89`）只能容纳「再等 1 个持有者」⇒ **同一行上的有效并发上限 ≈ 2**，第 3 个及以后的同账户请求以 `503 LEDGER_LOCK_TIMEOUT` 失败；超过事务池 `max`（默认 4）的请求在**拿连接**阶段 10s 超时。

**性质判定**：这是**结构性成本**（语句数 × 地理 RTT），不是账本逻辑缺陷。但必须显式处置，否则 P3/P5 的本地开发与生产热账户并发都会踩。

**待 Kevin 拍板的三条路**（见 §5.6）。

### 5.5.1 变体 B 落地后的实测追加（P1e · **Zang 亲跑**，非采信自报）

- **单笔 transfer**：多语句 + 交互式事务 **4181 ms**（中位）→ 单条 `SELECT ledger_post_event($1::jsonb)` **171 ms**（中位；样本 187/171/161）⇒ **约 24x**。（实现方自报 278 ms，亲跑更低。）
- **同环境 `BEGIN…COMMIT` 基线仍 1301 ms** ⇒ 改后单笔写已**低于一次空事务**，实证「一个业务事件 = 一次往返」。旧结论「每语句 RTT 190–290 ms」对**多语句读路径**仍成立，对写路径**已失效**。
- **R79 / `lock_timeout` 语义随之改变**：行锁持有时长 = **一条语句的执行时间**（同区域部署下亚毫秒），不再被「语句数 × RTT」放大 ⇒ P1b 的「同一行有效并发 ≈ 2」**必须按新形态重测**（已派 R3-P1h）。
- before 读数**无法用现脚本复现**（旧实现副本已删）；但 P1b 曾**独立量得** 3322–4363 ms，与 P1e 报的 3462–4549 ms 吻合 ⇒ **两条独立测量互证**。before 的可复现路径 = `git show 6a3841c:backend-ts/src/ledger.ts`。
- **错误投影契约**：custom SQLSTATE `LD001..LD033` ↔ spec §14.1 关闭集；`MESSAGE` = §14.1 码名、`DETAIL` = §14.4 details JSON。亲跑核验：映射表**恰好 33 条、码名唯一 33**。

### 5.8 P1e 独立质检裁定与缺陷台账（**Zang 终审 · 2026-09-27**）

> 质检单 R3-P1h（Neng）总判定：**不通过（3 条真缺陷，1 高危）**。**三条缺陷我（Zang）已逐条亲跑复现，无一虚报，也无一误报** —— 故予以确认，**P1e（`5aa8bbe`）暂不予验收**。

| 编号 | 级别 | 缺陷 | 我的亲跑复现 | 处置 |
|---|---|---|---|---|
| **D-01** | 🔴 高 | **幂等派生键碰撞**：派生键为 `<key>#<i+1>`，而调用方键不禁止 `#`；重放族查询会命中**他人事件的派生键**，且派生行指纹恒为 NULL ⇒ 指纹校验被短路 ⇒ **无关业务事件被静默丢弃却返回成功** | ✅ 公开 API 可达：A `…api:a` → ok/replay=false/txid1652；B `…api:a#2` → **ok:true / replay:true / txid:1653**（拿到 A 那条分录的 txid） | 修复单 R3-P1i **必修** |
| **D-02** | 🟠 中高 | **未映射 SQLSTATE 面**：函数 `BEGIN…EXCEPTION` 只包住 C6 写入段，C0–C5 无兜底 ⇒ `22003`（bigint 越界）/`22P02`（`::boolean` 非法）原样逃出 ⇒ **调用方可构造 500**（本应 400） | ✅ `22003` 44 次、`22P02` 9 次；M01 判 `ts_status=500 / in_closed_set=false / unmapped_escape=true` | 修复单 **必修** |
| **D-03** | 🟡 中 | **三条 503 投影（LD025/026/027）全是死代码**，且 `set_config(statement_timeout,10000)` 对**自身语句无效** ⇒ R82 的 10s 上限是**空的**，最坏单语句可持锁 ≈16 账户 × 3s ≈ **48s** | ✅ 机制隔离：同语句 `set_config(1500,true)`+`sleep(4)` = **4218ms 未被取消**；独立语句 `SET 1500` = **1674ms 被取消（57014）** | 修复单 **必修** |
| **D-04** | 🟡 中 | 函数 C6 `WHEN OTHERS` 把**基础设施错误**（`XX000`/`53300`/`53200`）吞成 `LD024` → **500 类**。**与 P1c 已修好的「池过载应归 503」是同一类问题的新形态** | 采信（N=128/160 各命中） | 修复单 **必修** |
| **D-05** | 🔵 低 | 3 例畸形载荷**被静默接受**：`cid` 传 JSON number、`from_uid` 带前后空格（btrim 后照收）、`memo` 传深层嵌套对象 | 采信 | 收紧 **或** 明确裁定允许并列入清单 |
| **D-06** | ⚪ 信息 | `LD027` 码名 `RETRY_EXHAUSTED` **与事实不符**（DB 层 0 次重试） | 采信 | 改名/改语义，或让 DB 层真重试 |

**站得住的部分（修复不得退回，修完必须仍成立）**：并发上限**下界 ≥64**（同一行不同键 N=1..64 每档 `success=N / failure=0 / 0 次锁超时`）**⇒ P1b 的「同一行有效并发 ≈2」正式作废**（N≥96 的失败全是 Neon 端连接上限 `max_connections=112`，与账本锁无关）；守恒/不变式/非负/不超发/不双扣（含真 `40P01` 与真 `55P03` 后重试）；R79 加锁全序由 `meta.lock_trace` 逐条取证；6 个 op 全通；`0001→0004` 在**干净 schema 从零重演**成功；`neon` 驱动闭包不破（pool 221/203ms vs neon 196/191ms，同数量级）；判负能力成立（注入孤儿分录令判据 1/8 三路同时变红，回滚后全绿且行指纹逐字恢复）；基座 sha256 与平台账户逐字未动。

**裁定**：**变体 B 的架构方向（D10）本身正确**（单笔 4181→171ms 已亲证），**缺陷全在实现层** ⇒ 不推翻 D10，只修实现。

### 5.9 既有遗留裁定：cid=1（`$`）发行量对账基线不平

**现象**：质检**开工基线**（未写任何数据前）读数即 `total_supply=10400` vs `Σmint=4800`（差 5600），跑完未变；cid=1 有 128 条流水，平台账户 `0/0` 未动。

**裁定（Zang）**：属 **P0/P1a 探针造数遗留**（当时直接写 `total_supply` 或绕过 `mint` kind 造数），**不是账本缺陷**。**验收口径**：测试数据一次性清零时，**cid=1 必须被恢复为自洽态**（`total_supply == Σmint` / `Σdelta`）——清零后若仍不平，则升级为真缺陷另立单。该口径并入 R3-P1g 验收项。

### 5.10 P1e 缺陷修复（R3-P1i）中途状态 + 新增发现 + 两项裁定

**R3-P1i 被 max_iterations 截断，是半成品**（已核实，非采信自报）：
- ✅ `backend-ts/migrations/0005_ledger_event_root_key.sql` 已落盘（**1288 行 / 70818 B**）：加列 `ledger_entry.event_root_key` + 索引 + 结构性守卫 CHECK（`event_root_key = split_part(idempotency_key,'#',1)`）；预算助手 `ledger_stmt_budget_ms()=10000` / `ledger_arm_lock_timeout()` / `ledger_check_budget()`；**全定义域归类纯函数** `ledger_error_for_sqlstate(state,constraint)`（永不 NULL）；形态闸与加固版 `ledger_int_amount`。
- ❌ **未应用**（我核实 `/health` 的 `schema_version` 仍 `0004`）⇒ **未登记 checksum，可自由改**。
- ❌ **TS 侧四处改动一处未动**（我核实 `src/ledger.ts` / `src/ledger-errors.ts` 无 diff）。
- ❌ **修后对照与全套验收一条未跑**。
⇒ 已派**收口单 R3-P1i-b**（`deleg_f4750626`）。

**修复中发现的新缺陷（由它自己的基线探针挖出）**：

| 编号 | 级别 | 内容 |
|---|---|---|
| **D-07** | 🔵 低-中 | `amount=1000000000000001`（**超 R66 单笔上限**）被**静默接受 200** |
| **D-08** | 🔵 低-中 | `amount='1e5'`（科学计数法字符串）**漏闸**被接受 |
| **D-09** | 🔴 高（F1 的另一面） | `#` 键在**修前 7 种 op 形状全部被静默接受**（`mint/transfer/hold/hold_release/entries` 均 `ok:true`）⇒ 修后必须全 400 |

**裁定 A（Zang）· 规范 §14.3 与实现的分歧**：`cid`/`uid` **形状非法**，规范写 `404`、实现一律 `400`。**维持实现口径（400）**。依据：**形状非法 = 参数校验失败 = 400**；**形状合法但不存在 = 404**。规范由 Jing 改。

**裁定 B（Zang）· R82 超时口径改写**：函数内 `set_config(statement_timeout,10000)` **对自身语句无效**（实测已证）⇒ 删除该假声明。另实测事实：**pooler 端点拒绝 `options` 启动参数（`08P01` unsupported startup parameter）** ⇒ 连接级 `statement_timeout` 在**池化路径不可用**。⇒ 采用**函数内自证预算**：等锁前把 `lock_timeout` 压到 `min(3s, 剩余预算)`，取锁后查 deadline，预算耗尽直接 `LD026` ⇒ **单语句等待上界 ≤10s**（原最坏 16×3s≈48s）。`57014` 仍可能由会话级 `statement_timeout` 产生，须写进声明。

### 5.11 R3-P1i-b 结果 + **数据库中间态（已派恢复单）** + 两条新裁定

**R3-P1i-b（又被截断，但成果实质）**：

| 项 | 结果 |
|---|---|
| TS 侧四处改动 | ✅ **全部落笔，tsc 0 error**：`normalizeIdempotencyKey` 禁 `#`+控制字符（顺序 `TOO_LONG→PREFIX_REQUIRED→RESERVED_SEPARATOR→CONTROL_CHARACTER`，与 DB 同序同码）；`RETRYABLE_SQLSTATES=Set(['40001','40P01','LD027'])`；`findByKey` 改 `event_root_key` 精确归属（删前缀算术）；`ledger-errors.ts` 新增 `infraSqlstateReason()` → 基础设施类 `LEDGER_TX_TIMEOUT` **503**（显式排除 `08P01`→500 `protocol_violation`、`57014`→LD026） |
| F1 修后 | ✅ **14/14 全绿**：方向① B 得 `LD005/RESERVED_SEPARATOR/400`（假 replay 消失、B 事件不再被吞）；方向② 合法事件不再被误判 409；legacy 撞键得 `LD024 derived_key_collision` 而**非伪 409**；`wrong_root_rows=0`；**7/7 种 op 形状 `#` 键全 400**（含 `#` 藏在 `entries[].idempotency_key` 里、修前被静默忽略的第 7 种） |
| F2 修后 | ✅ `unmapped_escape=0 / status_500=0 / not_in_closed_set=0`（52 例）；只剩 1 条 verdict 红，且**是探针公式过严**（把 `integrity` 一律钉成 400，与 §14.1 冻结的 404/409 冲突） |
| D-07 / D-08 | ✅ 修法：新增 §D2 覆盖 `ledger_payload_amount` —— `amount`/`amount_units` **二选一**，同时出现 ⇒ 400 `AMBIGUOUS_AMOUNT`（消灭「被静默忽略的金额字段」整类）；`ledger_parse_user_amount` 封死指数形式 ⇒ 400 `EXPONENT_NOT_ALLOWED` |
| 冒烟 | ✅ `ledger-smoke.ts` **29/0**、`ledger-smoke-db.ts` **11/0** |
| 基座/面板 | ✅ 0001–0004 sha256 与开工基线逐字一致；面板 16/16 |
| F3 | ❌ **完全未做**（`p1f-03-f3-timeouts.ts` 未编写未运行）⇒ 5 项读数全缺 |

> ⚠️ **数据库中间态（危险，已派 R3-P1i-c 恢复）**：上一轮应用了 `0005` **首版**（checksum `37307f9e4541…`）后，发现 **`0005` 自身自相矛盾**——§C 把 `23514` 三条守卫（`account_bal_guard`/`account_frz_guard`/`ledger_after_guard`）标成 `bucket='integrity'`，但它们返回的是 **500 类码** `LEDGER_NEGATIVE_BALANCE_GUARD`，违反 §C 抬头「integrity 绝不返回 500 类码」。它**改了 `0005` 文本**，又用一次性工具 `scripts/p1i-forget-migration.ts` **删掉了 `schema_migration` 里 0005 那行** ⇒ **库处于「注册表记 `0004`、实际对象是首版 `0005`」的撒谎态**。任何后续读数在此状态下都不可信，必须先恢复。

**✅ 撒谎态已消除（R3-P1i-c，已核实）**：重新应用修正版 `0005` ⇒ `applied`（checksum **`4de12361cf7d…`**）、再跑一次 **0001–0005 全 `skipped`+checksum match** ⇒ 幂等成立；`/health` 两次读数均为 **`schema_version=0005`**；**文件 sha256 与注册表 checksum 5/5 逐字对齐**（`0001 4f902d3c…` / `0002 688b1935…` / `0003 f268e030…` / `0004 55fd1ce8…` / `0005 4de12361…`）。

### 5.12 P1e 验收裁定（**Zang · 2026-09-27**）：有条件通过

| 缺陷 | 状态 | 我的独立验证 |
|---|---|---|
| **D-01**【高】幂等派生键碰撞 | ✅ **关闭** | **同一探针修前/修后对照**（我本人跑的 `qa-p1e-02b-api-collision.ts`）：修前 B 得 `ok:true/replay:true/txid=1653` ⇒ **修后 B 抛 `LEDGER_IDEMPOTENCY_KEY_INVALID/400/RESERVED_SEPARATOR`**、`B_acknowledged_ok=false`、`B_event_rows_in_ledger=0`、`silently_dropped=false` |
| **D-02**【中高】调用方可构造 500 | ✅ **关闭** | 亲跑 `p1f-02 --assert` ⇒ **pass=true / 23 verdicts 全 true / failures=[]**；`unmapped_escape=0 / status_500=0 / not_in_closed_set=0` |
| **D-04** 基础设施错误误吞 500 | ✅ **关闭** | 基础设施类改归 503（`infraSqlstateReason()`），端到端读数由 F3 单补取 |
| **D-07 / D-08** 静默接受金额 | ✅ **关闭** | `amount`/`amount_units` 二选一（⇒ 400 `AMBIGUOUS_AMOUNT`）+ 封死指数形式（⇒ 400 `EXPONENT_NOT_ALLOWED`） |
| **D-09** `#` 键 7 种 op 全被接受 | ✅ **关闭** | 亲跑 `p1f-01 --assert` ⇒ **pass=true / 14 verdicts 全 true**；7/7 全 400 |
| **D-03** 超时投影死代码 + `statement_timeout` 空转 | ⏳ **机制已落盘，待 F3 实测** | 删除假声明，改函数内自证预算（等锁前压 `lock_timeout` 到 `min(3s,剩余)`，理论上界 ≤10s）；**「实测生效」未取读数 ⇒ 不计入已验收** |
| **D-05 / D-06** | ✅ 已裁定 | D-05：`uid` 前后空格 vs btrim 后照收=**唯一豁免**，其余类型闸全收紧；D-06：`LD027` 不改码名（关闭集不动），DETAIL 明写 `retries_performed=0 / retry_owner=caller`，建议 Jing 改语义注释 |

**其他亲验读数**：`ledger-smoke.ts` **29/0**、`ledger-smoke-db.ts` **11/0**、`tsc` **0 error**；**§11 判据 1 = 0 行**、**判据 8 两口径（归属列优先 / 纯键前缀）= 0 行**；**R79 `lock_trace`** = `mint: [currency:85, account:943001:85]`、`entries 乱序传入: [943001, 943002, 943003]`（按 uid 升序，与传入序无关）；**平台账户 `0/-1/-2/-3` 在 cid=1 全 `balance=0 frozen=0`**；面板 **16/16**。

⇒ **裁定**：**D-01/D-02/D-04/D-07/D-08/D-09 关闭；P1e 有条件通过，唯一未闭合项 = D-03（待 R3-P1i-d 的 F3 实测）**。F3 回来后若实测成立 ⇒ **P1e 全量验收通过**，方可进入 P2（返佣）与 D11 改名单（`0006`）。

**裁定 C（Zang）· bucket ↔ §14.1 状态类对应关系冻结**：
`input ⇒ 400 类` / `integrity ⇒ 该约束对应的 400|404|409（绝不 500）` / `retryable|infra ⇒ 503` / `defect ⇒ 500`。
⇒ 由此得一条**可机读判据**：**「500 类码只可能来自 `bucket='defect'`」**（已要求加进探针）。三条 `23514` 守卫归 `defect`（能走到该层 CHECK = 函数内前置判定漏了 = 实现缺陷）；`currency_supply_guard` 归 `integrity`；`ledger_kind_enum` 与其余 `23514` 归 `input`。

**裁定 D（Zang）· 迁移注册表一次性工具**：`p1i-forget-migration.ts` **允许保留**（开发期「已应用的迁移需就地修正」是真需求，且有 0001–0004 硬拒闸），但**必须**：① 加醒目头注释写明「只能用于**尚未交付**的迁移；任何已 push 的迁移不得使用」；② 加显式 `--force` 闸；③ **除恢复场景外一律禁用**。并且：**修改已应用迁移文件的 checksum 与注册表必须同步对齐**（本次恢复单的验收项）。

### 5.13 **P1e 全量验收通过**（Zang · 2026-09-27）

**D-03 关闭**。F3 专项（R3-P1i-d）读数**由我亲跑复核**：

| 读数 | 我亲跑结果 |
|---|---|
| `55P03 → LD025` | ✅ `locktimeout = LD025`（原始 55P03 不逃出，只在 DETAIL 留 `pg_code` 溯源） |
| `40P01 → LD027` | ✅ `deadlock_db = LD027`，DETAIL `retries_performed=0 / retry_owner=caller` |
| **公开 API 死锁重试** | ✅ `{ok:true, ms:4265, retried:true}` ⇒ `RETRYABLE_SQLSTATES += LD027` 真把 R60 救回，且不双扣（debit 恰一次） |
| 预算耗尽 → `LD026` | ✅ `{code:LD026, detail:{reason:statement_budget_exhausted, remaining_ms:-1001}}` |
| **预算钳位真生效** | ✅ `{tight:"999ms", ample:"3s"}` = `min(3s, 剩余预算)`，三分支（封顶/逐 ms 派生/逾期直抛）均有独立读数 |
| 6 持锁链总等待 | ✅ `db_ms=10142`、`clamped=true`（对照：naive 未被钳 15600ms、修前 15583ms、旧宣称最坏 48000ms） |
| 基础设施 → 503 | ✅ DB 分类器 + **TS `normalizeLedgerError` 直接读数**：`53300/XX000/25006/53100/53200/57P01/57P02/57P03/58030/3D000` → 503 `pg_infra_class`；`57014` 走 SQLSTATE 表分支 → 503；`08P01` → 500 `protocol_violation`（刻意排除）；`28P01` → 500 |
| bucket↔status 纪律（裁定 C） | ✅ `all_bucket_status_ok=true`；唯一「不符」项是探针自造的假约束名 `other_unique`（探针输入，非产品缺陷） |
| `forget` 工具三道闸（裁定 D） | ✅ 无 `--force` → **exit 3**、`db_connections_opened=0`、`rows_deleted=0` |

**两条必须留档的诚实口径（不掩饰）**：
1. **预算钳的是「语句级」≤10s，端到端不是**：DB 侧实测 `10142ms`，客户端总耗时 `11283ms`（客户端开销 +0.8~1.3s）。spec 不得写成「端到端 ≤10s」。
2. **`57014` 不可能在函数内转码**：`statement_timeout` **绕过** plpgsql 的 `EXCEPTION` 处理器（实测 `stmt_timeout_catchable_by_plpgsql=false`、5/5 逃逸矩阵一致；`lock_timeout` 则**可**接住）。⇒ **`LD026` 的唯一产生源是 §B 预算助手**，spec 须写明，不得写成「§E 处理器接住 57014」。

**⇒ 裁定：P1e（`5aa8bbe`）随 `8677e65`/`0005` **全量验收通过**。账本内核（P1）闭环。** 后续 P2（十级返佣）等业务模块的写路径入口 = `ledger_post_event` 的 `op=entries`。

### 5.14 **D11 执行完毕 —— `user` → `users`**（migration `0006`，checksum `4aa19b148700`）

| 核验项 | 读数 |
|---|---|
| `public` 表 | `account, currency, ledger_entry, ledger_owner, schema_migration, **users**`（`user` 已消失） |
| 关联对象 | `users_pk` / `users_evm_uniq` / `users_evm_fmt` / `users_uid_positive` / 6× `NOT NULL` / `idx_users_evm_lower` / `users_uid_seq`；旧前缀零残留 |
| 列 | **一字未改**（`uid`/`evm`/`bio`/`is_admin`/`time_reg`/`time_login_last`）；真实列名 `uid`（`bigint`），legacy `"uID"` 报 `42703` |
| 指向它的 FK | **0 条**（裸扫出的 4 条指向 `neon_auth."user"` —— **另一张表**，未触碰） |
| PL/pgSQL 函数体引用 | **0 条** ⇒ 0004/0005 **无需** `CREATE OR REPLACE` |
| 代码引用面 | **18 处**真表引用已改（`database.ts` **17** 处 —— **修正我预查的 11 处**；`purge-test-data.ts`/`inspect-schema.ts` 各 1）；`/api/user*` 路由与 `localStorage` 键 `'user'` **一律保留**（同名不同物，改了才是破坏） |
| `grep` 真表引用残留 | **0**（作用域 = `src/**` + 非冻结 `scripts/**` + `frontend/**`）；冻结质检资产 4 文件 5 行按纪律保留 |

**⚠️ 陷阱的诚实口径**：改名**不能**消除 `user` 关键字的行为 —— 我实测改后 `count(*) FROM "users"` = **0**、而 `count(*) FROM user`（裸）**仍静默返回 1**；`FROM "user"` 现在报 `42P01`。本单消除的是**事故类别**：项目正确的那名字（`users`）不再是保留字，写对时无歧义；写错时**没有同名表可被碰对**。**不是「陷阱已被消除」。**

**测试数据一次性清零**（前缀集扩到 10 个大小写不敏感项；判负机制保留：dry-run `exit 3` / `--apply` 拒绝 `exit 4`）：

| 表 | 清零前 → 后 |
|---|---|
| `ledger_entry` | 1643 → **0** |
~~| `account` | 201 → **4**（仅平台 `-3/-2/-1/0`，全 `0/0`） |~~
| **硬1′**（**v0.18 取代硬1**） | **业务身份表 = `public.users`**（D11 已于 migration `0006` 改名）。裸 `FROM user` **仍**被解析成 `current_user` 并静默返回 1 行 —— **这个行为名字改了也不会消失**；但它现在**碰不对任何业务表**，写错会立刻暴露。⇒ 纪律：① 提到身份表一律写 `users`、**不写 `user`**；② 见到从 jinli 拷来的 `FROM user` 习惯写法**当作缺陷修**；③ 不得把这条描述成「陷阱已消除」。 |
| `currency` | 90 → **1**（仅 `$` / cid=1） |
| `ledger_owner` / `schema_migration` / `users` | 4→4 / 6→6 / 0→0（未触碰） |

**`cid=1` 自洽恢复**（执行裁定 §5.9）：`total_supply` **14000 → 0**（只改这一个字段），与残留 `Σ(mint)−Σ(burn)=0` 自洽。**事实陈述**：平台系统币 `$` 当前 **`total_supply=0`、无流通量**。成因确证：P1c 清零删了 cid=1 流水却未同步计数器（差额恒为 **+5600**，两轮读数一致）。

**清零后复核（我亲跑）**：§11 判据 1 = **0 行**、判据 8 两口径 = **0 行**；平台账户 4 行全 `0/0`；触发器全 `'O'`；零停机重载 5788（`pid 45756`）→ `/health` **200** 且 `schema_version=0006`；面板 **16/16**。

**顺带挖出的既有缺陷（与 D11 无关，记录待修）**：
1. **`/api/user/asset/:uID` 实测 HTTP 500**（`index.ts:364`）—— 它查 `FROM asset AS a`（`database.ts:1227/1244/1259`），而 **`asset` 表在新库根本不存在**。属主计划已记录的「缺 `asset`/`task`/`chest` 等核心表 DDL」P0 缺口，**必须重设计、不能照搬**。响应体无 `42P01` 文本，已隔离确认与 D11 无关。
2. **`ensureSupportSchema()` 既存失配**：仍用 legacy 列名 `"uID"`/`"EVM"`（真实为 `uid`/`evm`），且其 `CREATE INDEX … ON asset ("uID")` 引用的表不存在 ⇒ **该函数在本库本来就会失败**。本轮按派单只改表名、未改列名。


### 5.15 Jing 顶回的 7 条不一致 —— **Zang 逐条裁定**（2026-09-27）

> Jing 在同步 spec v0.4 时**拒绝转抄、拒绝擅自二选一**，逐条上报了 7 项不一致。**这种行为应予肯定**——本轮就有 **3 条的成因是我自己**（派单方转抄/预查出错），1 条是流程缺陷、1 条是真缺口。

| # | 不一致 | 裁定 |
|---|---|---|
| **F-1** | `p1f03-f3-readings.json` 盘上是 `run=H262V`（mtime 15:04），而报告声称读数出自 `run=GT4OR`（06:56–06:57Z）；逐项差异：chain 客户端 `10897↔11283`、DB `10106↔10142`、终局码 `LD025↔LD026` | ⚠️ **成因是我本人**：我亲跑 F3 探针核验时，探针把读数写到**写死的固定路径**，**覆盖了实施方那轮原件**。⇒ **不是造假，这是我的流程缺陷**。处置：探针改 **run-tagged 输出**；验证运行前先拷原件（已写进治理技能）。**两轮读数都有效，无需二选一**。 |
| **F-1b** | chain 用例终局码两轮不同 | ✅ **非确定性是合法的**：终局取决于「最后一次等锁先撞 3s `lock_timeout`」还是「10s 预算先耗尽」——**两者都被钳住**。⇒ **断言必须针对「等待有界」，不得钉死某一个码**；spec 不得强制其一。 |
| **F-2** | 报告写 `lock_timeout_lockwait_raw_55P03_when_no_handler=true`，落盘 json 实为 `false` | **以 json 为准**（我亲跑也读得 `false`）⇒ 报告该格更正为 `false`。 |
| **F-3** | 派单称 `0005` = 1288 行，实测 **1407 行** | ✅ 以 **1407** 为准 —— 中间两轮改过它，**我转抄了过期读数**（我的错）。 |
| **F-4** | 「删除 spec 里 `set_config(statement_timeout)` 假声明」—— spec v0.3 里**根本没这句**（`grep set_config` 0 命中） | ✅ **我的前提错**（与之前「`ALTER TYPE` vs CHECK 约束」同类的转抄错）。该声明实际在 master-plan / QA 报告 / `0004` 注释里。**Jing 改为「新增显式否证行」是对的。** |
| **F-5** | master-plan `:112/:123/:325` 也应改；且该文件在同窗口被另一写者更新 | ✅ Jing 的**边界遵守正确**（我只授权 spec + 快照 + QA 加注）；`:325` 的硬1 **已由我在 v0.18 作成废并新增硬1′**，无需再动。 |
| **F-6** | **真缺口**：`src/ledger.ts:toCid` 对 `cid<=0` 抛 `LEDGER_CURRENCY_NOT_FOUND(404)`，**未走 400 形状闸**，与裁定 A（形状非法=400）不符 | 🟡 **须改** —— 已派窄单 R3-P1m 收敛为 400（DB 侧已是 400，TS 侧单边偏差）。 |
| **F-7** | `M31b` 的 `DETAIL.value` 是换算后最小单位值（非入参原值）；F3 测试分区标签 `944xxx`/`GT4OR` 混记 | ⓘ 信息项 ⇒ 报告标注即可。 |

**另两条我的既有判断被证实**：`57014` 不可在函数内转码（spec 已落位显式否证行）；端到端 10s **未实现**（机读上限是**语句级** 10000ms）。spec §16 未实测清单由 5 项扩到 **11 项**。


### 5.6 延迟问题的三个处置变体（**已拍板：变体 B**，见 D10）

| 变体 | 做法 | 本地单笔预期 | 代价 |
|---|---|---|---|
| **A（推荐）** | **账本事件改走 HTTP 驱动的批量事务**：`neon().transaction([...])`。理由——账本事件的**分录结构是预先已知的**（transfer=2 条、hold=2 条、settle=2 条），正合该接口「语句预先已知」的覆盖面；错误路径靠**已被实测验证的 DB 守卫**（`account_bal_guard` 负余额 CHECK、`trg_account_guard`）抛错中止整个批量事务。WS 池保留给**真需要读后写**的编排（撮合决策、分佣链解析） | ~0.3s（1–2 次往返） | 需重写 `ledger.ts` 的提交路径；`neon()` 与 `Pool` 两套驱动并存 |
| **B** | **把记账压进 DB 函数** `SELECT ledger_post_event(jsonb)`：连编排也一次往返 | ~0.2s | 记账核心逻辑落进 PL/pgSQL，可维护性与可测性下移 |
| **C** | **只调参数**：`lock_timeout` 3s → 30s + 应用层按账户排队限流 | 仍 3.3–4.4s | 治标：本地开发体验不改善，并发靠排队而非提速 |

**Zang 倾向 A**：语句数 × RTT 是结构性成本，只有**减少往返**才能同时救本地开发与生产并发；而「一个业务事件 = 一次原子调用」本来也是账本最该有的形态（§7 事务清单本就是按事件组织的）。

> ✅ **Kevin 2026-09-27 拍板：选变体 B**（把记账压进 DB 函数）。已冻结为 **D10**，连带收益与连带约束见 §5「决策点」表 D10 行。另确认前提：**本地慢是地理必然，接受**；生产与 Neon 同区域部署（Vercel `region=sin1`）。
> **排期**：P1c（进行中，动 `ledger.ts`）交回后，立即排 **P1e = 变体 B 改造**（同一文件同时只有一个写者，不得并行）。


### 5.7 跨轮硬口径（**必须逐字进每一份 brief**）

| # | 口径 | 依据（实测） |
|---|---|---|
| **硬1** | **引用 `user` 表必须写成 `"user"`（双引号）** | `user` 是 PostgreSQL **保留字**：`SELECT count(*) FROM user` **不报错**，而是被解析成 `current_user`、**静默返回 1 行**。实测同一时刻不加引号=1、加引号=`public."user"`=**0**（真值）。⇒ 任何出现在 `FROM`/`JOIN`/`UPDATE`/`INSERT INTO`/建表位置的裸 `user` 都是**静默错答案**。现状：`backend-ts/src` **零命中裸写法**、17 处正确加引号 ⇒ **新增代码与质检探针一律加引号**。 |
| **硬2** | **禁 `pkill -f` / `killall`；清进程只按精确 PID** | 本机多会话共用；跨项目同名启动命令（`jinli/backend-ts` 与本项目**同为 `ts-node src/index.ts`**）已造成误停 Kevin 活站点的事故。 |
| **硬3** | **派单里的「运行时真值」必须当场现取**，不得从文档转抄；brief 须逐字写明「若与运行时真源冲突，以真源为准并上报该冲突」 | 文档可能停在中间态：已出过 `xiai/web` → `xiai/yinsuo` → `xiai/yinyuan` 三态、而我把中间态当"真值"下达的事故。 |
| **硬4** | 测试数据 **uid 固定 ≥ 900000**、自建币 **symbol 前缀固定**（跑完清理） | 本轮已按此完成清理（308 流水 / 27 账户 / 8 币种，判据 1 与判据 8 归零）。 |

## 6. 分期路线图

每期格式：**目标 / 交付物 / 验收 AC / 主责**

### P0 · 地基与口径冻结
- **目标**：项目能独立跑起来，口径冻结，遗留清理完毕。
- **交付物**：端口 5787/5788 + ctrl 面板注册；DB 访问层换为支持**交互式事务**的连接池（D1）；**补齐核心表 DDL**（见 §5.2 —— 现有仓库缺 `user`/`asset`/`task` 等 7 张表的建表语句，空库上会直接崩）；版本化 migration 目录 + schema 版本表；摘除 jinli 遗留（站点名、文案、废弃 admin 发布模块）。
- **P0 必须实测的三项可实现性前置**（Jing §16 未实测项，直接决定 P3/P5 能不能做）：
  1. `@neondatabase/serverless` 的 **`Pool` over WebSocket 是否提供交互式事务**（0.6.0 偏旧，可能需要升级）
  2. **`pg_advisory_xact_lock` 经 Neon pooler（PgBouncer transaction 模式）是否可用**
  3. 直连（UNPOOLED）连接数上限与 Vercel serverless 并发是否匹配
- **验收 AC**：空库执行 migration 后 `public` 表数量与 spec 一致；`npm run dev` 起在 5787/5788；`/health` 返回 DB 版本与 schema 版本；后端 `tsc --noEmit` 0 error；上述三项前置**各有可复现的实测读数**（不是"应该可以"）；ctrl 面板可单独重启该服务。
- **主责**：Kong（实现）→ Neng 质检

### P1 · 账本内核
- **目标**：多币种账本可用、可审计、可幂等、能扛并发。
- **交付物**：`currency` / `account` / `ledger_entry`；铸币、转账、冻结/解冻；`idempotency_key` 机制；对账脚本（`sum(delta) == balance`）。
- **验收 AC**：并发 100 笔转账后**总额守恒**；同一 `idempotency_key` 重复提交只生效一次；对账脚本在人为注入脏数据时**能报错**（判负能力验证）；事务回滚不留半成品。
- **主责**：Kong → Neng

### P2 · 身份与返佣骨架
- **目标**：注册即终身绑定；10 级祖先链 O(1) 可查。
- **交付物**：`referral_edge` / `referral_closure`；注册邀请码链路；10 级查询 API；后台可配权重矩阵（`app_config`，支持账龄分档）。
- **验收 AC**：A1→…→A10 链上注册后，A1 能查到 A10 且 level=9；权重矩阵改动后新佣金按新权重计算、**历史佣金不变**。
- **主责**：Kong → Neng

### P3 · 招工 / 打工（闭环第一块钱）
- **目标**：发单 → 接单 → 交付 → 放款 → 扣手续费 → 发返佣，全链路原子。
- **交付物**：`job` / `job_order`；酬金托管（escrow）；平台手续费（1%–5%，后台可配）；佣金按 10 级权重分发并落 `commission_payout`。
- **验收 AC**：一笔酬金 100 `$`、费率 5%、10 级链齐全时，**雇主支出 == 打工者收入 + 平台 + 各级佣金**（分文不差）；中途失败（DB 断连 / 重复提交）不产生半成品与双扣；争议/拒绝路径可回滚托管。
- **主责**：Kong → Neng

### P4 · 商品
- **目标**：发布商品、以任意单位标价、支付成交。
- **交付物**：`listing` / `listing_order`；库存；退款/争议；图片上传。
- **验收 AC**：买家余额不足时**不产生任何落库**；卖家收款与平台费分流正确；并发抢购不超卖。
- **主责**：Kong → Neng

### P5 · 交易所
- **目标**：以 `$` 为基础货币的多单位订单簿 + 实时走势。
- **交付物**：`market_order`（币对）/ `market_trade` / `candle`；撮合引擎；自建单位**上市保证金**；成交手续费（收 `$`）；走势图接口。
- **验收 AC**：限价单撮合价格正确、无自成交漏洞；撤单解冻准确；保证金冻结/退还/罚没三态可验；K 线由成交聚合且与 `market_trade` 对得上账。
- **主责**：Kong → Neng

### P6 · 平台运营后台
- **目标**：管理员从「发内容」转为「搭平台」。
- **交付物**：费率配置、返佣权重矩阵、上市保证金规则、自建单位审核、商品/招工合规审核、用户与权限、资产与流水审计台、`app_config` 管理。
- **验收 AC**：每一项配置改动能被业务层真实读取生效（非只在后台显示）；审计台数据与 `ledger_entry` 逐条对得上。
- **主责**：Kong → Neng

### P7 · goofish 视觉 + 横竖双形态
- **目标**：达到可上线观感与可用性。
- **交付物**：设计 token（黄黑主色、字阶、间距）；首页/分类/详情/发布/我的 全量页面；**PC 横屏布局** 与 **手机竖屏布局** 两套断点规范；空/loading/错误三态。
- **验收 AC**：双形态在真实视口下无横向溢出、无遮挡、可点可拖（按可操作性断言验收，不按 DOM 读数）；关键页首屏可达；对比度不达标即判负。
- **主责**：Kong → Neng

### P8 · 上线
- **目标**：可访问、可观测、可回滚。
- **交付物**：Vercel 部署 + 环境变量、域名、面板注册、健康检查与日志、备份/回滚 SOP、种子与冷启动内容策略。
- **验收 AC**：生产库写入前有备份；回滚演练一次通过。
- **主责**：Kong + Neng + Zang 裁决

---

## 7. 角色与流程

```
Jing 冻结 spec（裁定书 R1..Rn）
      ↓
Kong 实现 ──→ Neng 立即闭环质检 ──→ 过 → Jing 更新规范 → Zang 汇总
                   └─ 不过 → 退回 Kong 重改
```

- **Zang**：需求拆解、派单、仲裁、汇总、上线裁决。（不写代码 / 不写规范 / 不跑质检）
- **Jing**：制度员。每期开工前出 spec 并冻结裁定书；**裁定书逐字进每一份 brief**。
- **Kong**：实现。交付口径 = 代码 + 关键链路最小自测，未被要求真源 `--apply`。
- **Neng**：质检。每个 Kong 交付后**立即**闭环；同一缺陷第 2 轮起换独立复验方。

---

## 8. 风险清单

| # | 风险 | 影响 | 处置 |
|---|---|---|---|
| R1 | **无事务的金融写入** | 资金不守恒、超发、双扣 | P0 换事务层；P1 起对账脚本常驻 |
| R2 | **并发**（抢单 / 撮合 / 返佣链） | 超卖、重复发佣 | 行锁 + `idempotency_key` + 并发用例进 AC |
| R3 | **用户可自建资产** | 滥发、操纵、双重支付 | 总供给上限、上市审核、保证金、成交限额 |
| R4 | **10 级 × 时间权重** 会计复杂 | 无法审计、无法回溯 | 每笔佣金落 `commission_payout`，权重快照留存 |
| R5 | 管理员不再发布内容 | 冷启动空站 | 种子数据 + 运营策略（P8） |
| R6 | 横屏 web + 竖屏手机是**两套布局** | 后期返工 | P7 先定断点规范再写页面 |
| R7 | 旧库 4000+ 行单文件、零后端测试 | 改一处崩一片 | 新内核**独立目录 + 全新测试**，不在旧文件上原地改造 |

---

## 9. 派单记录

| 轮次 | 角色 | 交付物 | 状态 |
|---|---|---|---|
| R1-J | Jing | `docs/ledger.spec.md` — 多币种账本口径冻结裁定书 | ✅ **已验收**（Zang 实测：962 行 / 131,972 B / 20 章节 / 108 条规则 R1..R108 / sha256 `c56421aa…60ead` 与自报一致） |
| R1-K | Kong | `docs/design/style-preview.html` — goofish 风格 3 版视觉变体 | ✅ **已验收**（Zang 实测：936 行 / 72,809 B / 外链资源 0 / 3 个变体锚点齐全 / console 错误 0 / 375 与 1440 均无横向溢出；computed-style 复核确认三版是**结构性差异**而非换色：A 13px 圆角+黑描边+3px 硬投影/4 列，B 2px 圆角+深色卡+零投影/3 列，C 18px 圆角+柔和投影/4 列） |
| R2-D（主题规范） | Jing | `docs/design/design-system.spec.md` — 一整套主题体系（日=A / 夜=B）token 契约 | ✅ **已验收**（Zang 实测：788 行 / 99,944 B / 13 章节 / **74 条规则 T1..T74** / sha256 `bd60b053…4d8af` 与自报一致；色值已在比选稿中逐一比对命中、223 处选择器证据 ⇒ **确认是提取而非发明**） |
| R2-P0（地基） | Kong | 事务化 DB 层 + 版本化 migration + 新账本表 + `/health` + 端口迁移 | ✅ **已验收并入库**（提交 `cbb40d1`）。真库实测：`schema_migration` 已登记 0001/0002 + checksum；`currency`/`account`/`ledger_entry`/`ledger_owner`/`user` 五表已建、种子数据已入。⚠️ 过程中**误停 jinli**（`pkill -f` 撞同名启动命令），已由面板 API 复原并经 Zang 独立复核 14/14 ✅ |
| R2-QA（P0 质检） | Neng | `docs/qa/p0-acceptance.md` — 8 项 AC 独立复验 + 3 项附加 | ✅ **已验收**（Zang 复核：726 行 / 38 KB / 40 处 PASS；**8/8 PASS，0 个 P0 阻断缺陷**）。关键证据链：**真实 clone 到 `/tmp` 验证迁移 SQL 确已入库**（且在副本里删掉例外规则复现了「`*.sql` 吞掉迁移」⇒ 证明修复必需）、**判负对照**（autocommit 裸写与「漏 ROLLBACK 反而 COMMIT」两种失误写法**均留下残留** ⇒ 探针能区分）、**6 表 oid/relfilenode 逐值比对证未重建**、**`/health` 两实例差分**（DB 不可达→503/`unknown`）证非硬编码。 |
| R2-P0 收口单 | Kong | 修 `readQuery` 只读误走直连池 + 启用死代码 `resolveReadUrl`、`/health` 加 `no-store`、代理改 `127.0.0.1`、清 `Jinli` 文案、gitignore 例外通用化 | ✅ **已验收并入库**（`ca3c2e3`）。Zang 独立复核：`tsc --noEmit` **exit 0**（自己跑的）；`/health` **实 HTTP 头 `Cache-Control: no-store`**；根路由实测返回 `Seafood TypeScript Backend`；`grep Jinli backend-ts/src/{index,auth,database}.ts` **零命中**；gitignore **双向实测**（`some/dir/migrations/*.sql` 放行 / `backend-ts/backups/dump.sql` 仍忽略）。只读池取证：把 `DATABASE_URL_UNPOOLED` 指向不可达主机后 `readQuery` 仍成功（修复前会失败）⇒ 只读确实不再依赖直连。 |
| R2-E（面板注册） | **Zang 亲做** | `ctrl/index.js` 服务表 +2（`seafood-api` 5788 / `seafood` 5787）+ 重启 + 全量拉起 | ✅ **已完成**。备份 `versions/index.js.pre-seafood.bak`（md5 `0114d3e6…`，`cmp` 逐字节一致）；服务表 **14 → 16**，diff 恰 **+18 行 / 0 删除**；`node --check` 通过；`pm2 restart bistro-ctrl`（**不带 `--update-env`**）→ `startAll` → **16/16 running & portOpen**。真实监听：5788 `*:5788`、5787 **`[::1]:5787`**；健康码：`5788/health` 200、`5787/` 200、jinli 5777/5778 复测 200；代理链路 `5787/api/test/data` 与直连 5788 **响应体一致**。⚠️ **打开方式必须是 `http://localhost:5787`**（vite 只绑 IPv6，`127.0.0.1` 连不上）。 |
| R2-P（端口册） | Jing | `ctrl/PORTS.md` v1.17 + `PORTS.v1.16.md` 快照登记 | 🔄 跑中 |
| R3-P1a（账本服务层） | Kong | `backend-ts/src/ledger.ts` — 账户读写 + 原子分录写入器 + `mint`/`transfer`/`freeze`/`unfreeze`/`settleFrozen` + 幂等全链路 + 负余额禁令 + spec §14 错误码 | 🔄 跑中 |
| R3-P1b（并发质检） | Neng | `docs/qa/p1-ledger-concurrency.md` — §10 R85 五条并发用例 + 判负对抗 + 并发真实性 | ✅ **已验收**（749 行；**报告被 max_iterations 截断，但结论自洽且证据链完整**）。五条用例**安全侧全部成立**：100 并发后总额守恒（drift=0 双向互证）、同键 100 并发**只落 2 条流水**（1 首次 + 8 重放，`distinct_txids=[184]`）、并发无负余额（`min(balance)>=0`）、并发 mint **恰好 1 成功**（`total_supply` 0→1 == cap）、**真实死锁 40P01 已构造**（`pg_stat_database.deadlocks` 0→1→15→17，重试后 `total_supply` 仅 +3、该键恰好 3 条 ⇒ **重试不双铸**）。**判负能力成立**：3 个注入全部被判据当场判红、3 个被 DB 守卫 `P0001` 拒绝，回滚后 6/6 回绿。并发真实性：`distinct_pids=32 / max_simultaneous_tx=32`（池=1 负例降到 1）。 |
| R3-P1b 缺陷① | — | 连接池过载被误报为 **500 类**「实现缺陷」码 | 🔴 **真缺陷**：WS 池 `connectionTimeoutMillis=10000` 超时抛**无 `code` 的裸 `Error`**，被 `ledger-errors.ts:197` 兜底分支改写成 `LEDGER_TRANSACTION_REQUIRED`（**500**，`cause='non_pg_error'`）⇒ 过载（应 503）污染 R108 的「500 必须告警」规则、线上无法区分。已派 P1c 修。 |
| R3-P1b 待裁定② | — | 「100 并发全部成功」字面口径 vs 实测单笔 `transfer` **3.3–4.4s** | ⚠️ **架构问题，已升级给 Kevin**（见 §5.5 延迟分析）。实测：本地↔Neon 每语句 RTT **190–290ms**，一笔 transfer 需 ~10–14 条语句 ⇒ 单笔 3.3–4.4s、连 `BEGIN…COMMIT` 都 1.4–2.3s；而 `lock_timeout=3s` 只能容纳「再等 1 个持有者」⇒ **同一行有效并发上限 ≈ 2**。 |
| R3-P1c（P1 收口） | Kong | 修连接池过载错误分类 + kind 关闭集 22→20 + 真库测试数据清理 | ✅ **已验收**（提交待入）。Zang 独立复核：`tsc --noEmit` **0 error**；migrate **幂等**（0001/0002/0003 全 `skipped`，`schema_version=0003`）；**真库已归零**（`ledger_entry=0` / `account=4` 仅平台账户 `-1,-2,-3,0` / `currency=1` 仅 `$` / `ledger_owner=4`）；`kind` 白名单 **20 值**且两删值均不存在；**7 个触发器全部 `tgenabled='O'`**；归类矩阵自检 `any_bare_error_in_500_class=false`、`fallback_rows_missing_reason=[]`。**错误分类可判负**：改前 62/62 与 93/93 落 `LEDGER_TRANSACTION_REQUIRED`(500) ⇒ 改后 75/75 与 92/93 落 `LEDGER_TX_TIMEOUT`(**503**, `reason=pool_connection_timeout`)，**500 类归零**。清理脚本**自带判负**（`PURGE_FALSIFY_FLOOR=-99` ⇒ exit 3 中止并列红线命中；加 `--apply` ⇒ exit 4 拒绝）。⚠️ 它**推翻了派单的一个错误前提**：本库 `kind` 是 **`text` + 同名 CHECK 约束**、**不存在** PG enum 类型 ⇒ 按真实 schema 做约束替换（我误信了 spec 措辞，它的处理是对的）。 |
| R3-P1d | — | P1c 的独立质检 | ⏭️ **Zang 决定跳过独立轮**：P1c 的三项产物里，**写路径很快会被 P1e 整体重写**，而 P1c 自带的判负取证（含脚本自证）已足够；Zang 已亲跑 tsc/migrate/真库盘点/归类矩阵四组读数。分类映射逻辑在 P1e 后仍存活 ⇒ **其独立复验并入 P1e 的质检单**。 |
| R3-P1e（**变体 B 改造**） | Kong | 记账压进 DB 函数 `ledger_post_event(jsonb)`（D10） | 🔄 跑中 |
| R3-P1f（spec 同步） | Jing | `docs/ledger.spec.md` v0.3：kind 22→20 + 非 PG 错误归类 + 清理登记（19 行清单） | 🔄 跑中 |
| R3-P1e（**变体 B 改造**） | Kong | `ledger_post_event(jsonb)` 单语句记账 + 错误投影 + 对外 API 零破坏 | ✅ 交付 `5aa8bbe`（Zang 亲跑核验通过：tsc 0 / migrate 幂等 / 11-11 + 29-29 冒烟 / transfer 171ms / 判据 1·8 归零） |
| R3-P1f（spec v0.3） | Jing | kind 21→20 落位 19 条 + 非 PG 错误归类 + `ledger_kind_enum` 事实更正 | ✅ 交付 `5aa8bbe`（1129 行 / md5 `6b0a852c…`；快照 v0.2 md5 `1a63a2f4…` 字节相同） |
| R3-P1h（**P1e 独立质检**） | Neng | 并发上限重测 / 幂等派生键碰撞攻击 / 未映射 SQLSTATE 面 / 真实死锁超时 / neon 驱动 A/B / 判负 | ✅ 交付（**判定不通过：3 真缺陷**，见 §5.8；报告正文文件因 max_iterations 未落盘，由 R3-P1j 补落） |
| R3-P1j（**质检报告落盘**） | Jing | 从实况日志忠实转写 `docs/qa/p1e-db-function.md`（九章节，数字逐字保留） | 🔄 跑中 |
| R3-P1i（**缺陷修复**） | Kong | D-01 幂等派生键碰撞 / D-02 未映射 SQLSTATE / D-03 超时投影死代码+statement_timeout 空转 / D-04 基础设施错误误吞 | ⚠️ **半成品（max_iterations 截断）**：`0005` 已写（1288 行）**未应用**、TS 侧未动、修后对照未跑 ⇒ 见 §5.10 |
| R3-P1i-b（**修复收口单**） | Kong | 应用并收尾 `0005`（可改）+ TS 侧四处改动 + 修 D-07/D-08 + 全套修后验收 | ⚠️ **截断但成果实质**：TS 四处全落笔、F1 14/14、F2 三硬判据归零、M31/M43 修完、冒烟 29/0+11/0；**F3 全未做**；并留下**撒谎态中间库**（见 §5.11） |
| R3-P1i-c（**恢复单**） | Kong | 重新应用修正版 `0005`（校验 sha 与注册表对齐、`/health` 报 0005）+ 修 p1f-02 公式 + 在新闻本上重跑 F1/F2/冒烟 + 取 §11 判据 1·8 / R79 / 平台账户 + 回填验收报告 | ✅ 交付（**未被截断**；撒谎态已消除、checksum 5/5 对齐、F1 14-14、F2 23-23、冒烟 29-0+11-0、判据 1·8 两口径归零、R79/平台账户/面板全绿） |
| R3-P1i-d（**F3 专项单**） | Kong | `p1f-03-f3-timeouts.ts`（新写）：6 持锁链总等待是否钳到 ≤10s、`55P03→LD025`、`40P01→LD027`、`53300/XX000→503` 端到端、预算钳位实测 | ✅ 交付（截断但读数齐备；Zang 亲跑复核通过；报告回填 630 行、placeholder 清零） |
| R3-P1g（**表改名 + 测试数据清零**） | Kong | `user` → `users`（D11）：新增 migration **0006** + 关联对象改名 + 全仓引用改 + 陷阱消灭验证；**并**一次性清零全部测试数据（uid≥900000 与 qa1b*/smk*/p1e*/p1f*/qae* 币）且**恢复 cid=1 自洽**（见 §5.9） | 🔄 **跑中**（P1 已验收 ⇒ 解锁） **✅ 已交付（55 calls 未被截断；Zang 亲验通过）** |
| R3-P1k（**spec v0.4**） | Jing | `docs/ledger.spec.md` v0.3→v0.4：P1e/P1i/F3 契约逐条落位 + 两条诚实口径 + 改名行 + 快照只加注 | 🔄 **跑中** **✅ 已交付（50 calls 未被截断）** |
| R3-P1m（**契约偏差收口**） | Kong | F-6 `toCid` 404→400 + F3 探针改 run-tagged 输出 + 修正报告误格 + 登记 chain 用例非确定性 | 🔄 **跑中** |

**并行前端投入**：`frontend/node_modules` 缺失已补（`npm install`，548 包，vite 5.4.20）。

**QA 待裁定项的裁决**：`cbb40d1` 一并改了 `docs/seafood.master-plan.md` —— 那是 **Zang 自己的合并提交**（把实现产物与计划文档并入同一次提交），**不属实现方越界**。实现方的 git 边界纪律执行正确（只 add 自己路径、未 commit、未 push）。

**QA 登记的 4 条非阻断项**（已全部进收口单）：①【P2】`readQuery` 只读仍走 UNPOOLED 直连（Vercel 高并发有耗尽风险）②【P3】gitignore 例外只覆盖直接子文件 ③【裁定项，已裁决如上】④【P3】`/health` 无缓存头。

**R1/R2 副作用与新发现**：
- P0 硬缺口（§5.2）：仓库缺 7 张核心表 DDL，空库按现有代码启动会崩；旧库 schema 为半迁移退化态，不可当蓝图。
- **静默缺陷（Zang 亲查）**：根 `.gitignore` 的 `*.sql`（属「Database backups」段）把 `backend-ts/migrations/*.sql` 一并吞掉 ⇒ **库里有表、仓库里没 SQL，clone 无法重建 schema**。已修（`!migrations/*.sql` 例外）并列入 QA 对抗测试项。
- 设备级红线（§5.2 #5）：子代理跨项目同名启动命令 + `pkill -f` = 误停他人站点；**该禁令必须逐字进每一份 brief**（已写入 `bistro-ctrl-panel` 技能）。

**下一步（等 P0 质检收单）**：
P0 小修 → **P1 账本内核**（铸币/转账/冻结/幂等/对账，并发守恒进 AC）→ P2 返佣骨架 → P3 招工闭环 → …
**并行可开**：ctrl 面板注册 seafood（前端 5787 / 后端 5788）——会停全部站点约 1 分钟，**需 Kevin 点头**。

### 地基补充（Zang 已做，非开发）
- `backend-ts/.env.local` — 新 Neon 库连接串已落盘（`.gitignore` 已覆盖，不入库）
- `frontend/public/brand/logo.svg` — 用户提供 Logo 已入库（md5 `e4ce9fa1374ea042a82e082f3d1b0dfc`）

---

## 10. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1 | 2026-09-27 | 首版：现状盘点、领域模型草案、决策点 D1–D8、路线图 P0–P8、风险清单 |
| v0.2 | 2026-09-27 | D1–D8 全部冻结（含 D1/D3 的连带约束）；新增 §9 派单记录；R1 派单（Jing 账本 spec + Kong 视觉 3 变体） |
| v0.3 | 2026-09-27 | R1 双单验收通过（Zang 实测复核）；新增 §5.1 Zang 裁定（10 条）与 §5.2 新发现（仓库缺 7 张核心表 DDL / 旧库为半迁移退化态）；**更正 D7**（上市保证金 = 消耗，非冻结可退，依据 Kevin 原文）；P0 补入三项事务前置实测与 DDL 补齐 |
| v0.4 | 2026-09-27 | **D9 主题体系**（Kevin 更正：一整套主题、两个外观档，日=A / 夜=B），新增 §5.3 主题体系裁决（含撤回 v0.4 早前的「形状统一取 A」） |
| v0.5 | 2026-09-27 | P0 地基完成并入库（`cbb40d1`）；新增 §5.4 Zang 裁定（N1–N17，含**列数跨档统一取 A / B 大字数字仅保留在全宽行情区**）；记录 `*.sql` 被 gitignore 吞掉的静默缺陷与修复、`pkill -f` 误停 jinli 事故与复原；派单记录补 R2 四单 |
| v0.6 | 2026-09-27 | **P0 质检 8/8 PASS**（`docs/qa/p0-acceptance.md`，Zang 复核证据链）；裁决「master-plan 被同提交修改」为 Zang 合并提交而非越界；4 条非阻断项派 P0 收口单 |
| v0.7 | 2026-09-27 | **P0 全部收口**：收口单入库（`ca3c2e3`）、**ctrl 面板注册 seafood 完成 16/16**、`frontend/node_modules` 补装；派 R3-P1a（账本服务层）与 R3-P1b（账本质检） |
| v0.8 | 2026-09-27 | **P1a 入库（`66995d3`）+ P1b 并发质检 8/8 安全侧通过**；新增 **§5.5 单笔转账 3.3–4.4s 架构级发现**与 **§5.6 三个处置变体（待 Kevin 拍板）**；查出连接池过载被误报为 500 类错误（真缺陷）；提出 spec 三项错误修正并落地（v0.2） |
| v0.9 | 2026-09-27 | **D10 冻结**：Kevin 拍板**变体 B —— 记账压进 DB 函数 `ledger_post_event(jsonb)`**，一个业务事件一次往返。连带收益：写路径不再需要交互式事务 ⇒ **D1 的 `ws`/Vercel 残留风险被结构性消除**（Vercel 验证降级为上线前常规确认）。§5.6 标记已拍板；P1c 交回后排 P1e 改造 |
| v0.10 | 2026-09-27 | **P1c 收口完成**（错误分类 500→503、kind 22→20、真库测试数据清零）；新增 **§5.7 跨轮硬口径**（含新发现的 **`user` 保留字静默错答案**陷阱）；决定跳过 P1d 独立轮（理由见派单记录）；排入 P1e（变体 B）与 P1f（spec v0.3） |
| v0.19 | 2026-09-27 | **spec v0.4 落位**（P1e/P1i/F3 契约 + 改名 + 两条诚实口径；快照 v0.3 逐字节相同）；新增 **§5.15 —— Jing 顶回的 7 条不一致逐条裁定**（其中 **3 条成因在我**：转抄过期行数、错前提、**亲跑覆盖了实施方取证文件**）；确立「验证运行不得覆盖原始取证」纪律；派 R3-P1m 收口 F-6 |
| v0.18 | 2026-09-27 | **D11 执行完毕**（§5.14）：`user`→`users`（`0006`）+ 测试数据一次性清零 + `cid=1` 自洽恢复（`$` 流通量归 0）；**§5.7 硬1 作废、新增硬1′**（名称改了、关键字的陷阱行为也不消失 ⇒ 纪律改为「一律写 `users`」）；顺带挖出两个既有缺陷（`/api/user/asset` 因缺 `asset` 表报 500；`ensureSupportSchema()` legacy 列名失配）；派 Jing 同步 spec v0.4 |
| v0.17 | 2026-09-27 | **P1e 全量验收通过**（§5.13）：F3 五路读数由 Zang 亲跑复核；**D-03 关闭**；留档两条诚实口径（预算只钳语句级、端到端 11283ms；`57014` 绕过 plpgsql 处理器 ⇒ `LD026` 唯一来源为预算助手）；**P1 账本内核闭环**；派 R3-P1g（`0006` 改名 + 测试数据清零） |
| v0.16 | 2026-09-27 | **撒谎态消除**（0005 重应用、checksum 5/5 对齐、/health=0005、幂等成立）；提交 `8677e65`；新增 **§5.12 P1e 验收裁定：有条件通过**（D-01/02/04/07/08/09 关闭且均经 Zang 亲跑或同一探针修前修后对照；唯一未闭合 = D-03 待 F3 实测）；派 R3-P1i-d |
| v0.15 | 2026-09-27 | **R3-P1i-b 截断但成果实质**（TS 四处落笔 / F1 14-14 / F2 三硬判据归零 / M31·M43 修完 / 冒烟 29-0+11-0）；新增 **§5.11** 记录**数据库撒谎态**（0005 首版已装但注册表行被删）与 **0005 自身自相矛盾**（23514 bucket）；**裁定 C**（bucket↔status 冻结 ⇒「500 只出自 defect 桶」可机读判据）、**裁定 D**（`p1i-forget-migration.ts` 保留但加 force 闸 + 头注释）；派恢复单 R3-P1i-c 与 F3 专项单 R3-P1i-d |
| v0.14 | 2026-09-27 | **R3-P1i 半成品截断**（已核实：0005 落盘未应用 / TS 侧未动 / 修后对照未跑）⇒ 派收口单 R3-P1i-b；新增 **§5.10**：新发现 D-07（超 R66 上限静默接受）/ D-08（`'1e5'` 漏闸）/ D-09（`#` 键 7 种 op 全被接受）+ **裁定 A**（形状非法=400，规范改）/ **裁定 B**（删 statement_timeout 假声明，改函数内预算钳位；pooler 拒 `options` ⇒ 08P01） |
| v0.13 | 2026-09-27 | **P1e 质检不通过**：新增 **§5.8 缺陷台账**（D-01 高位幂等派生键碰撞 / D-02 未映射 SQLSTATE / D-03 超时投影死代码+statement_timeout 空转 / D-04 基础设施错误误吞）——**三条我逐条亲跑复现**；新增 **§5.9** 裁定 cid=1 基线不平属造数遗留并入清零验收。裁定「**D10 架构方向正确、缺陷在实现层**」；派 R3-P1i 修复（0005）+ R3-P1j 报告落盘；D11 改名重排为 0006 |
| v0.12 | 2026-09-27 | **P1e/P1f 交付并亲跑核验**（`5aa8bbe`）：记账压进 DB 函数，单笔 transfer 4181→**171 ms**；新增 **§5.5.1** 记录架构级新数字与「P1b 并发上限结论作废、须重测」；派 R3-P1h 独立质检（含幂等派生键碰撞与未映射 SQLSTATE 两个高危面）；D11 改名仍排在质检之后 |
| v0.11 | 2026-09-27 | **D11 冻结**：Kevin 拍板 **`user` 表改名 `users`**（铲除保留字静默错答案陷阱，趁 0 行低成本）；R3-P1g 排入队列（等 P1e 交回）。§5.7 硬1 的「必须加引号」纪律保留但降级为「改名前的过渡期纪律」 |
