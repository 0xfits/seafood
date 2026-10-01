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
| **D12** | 权重「随时间变化」语义 | ⭐ **后台可改 + 按生效时间版本化**（事件用当时生效的权重，不追溯重算）。**用户未表态，默认冻结，可一句话改** |
| **D13** | 佣金池分不完时归属 | ⭐ **按已有层级权重比例再分配**（D6「平台不抽成」的自然延伸）。**同上，可一句话改** |
| **D14** | 1–5% 手续费承担方 | ⭐ **从打工者酬金里扣**（到手减少、雇主支出不变）。**同上，可一句话改** |
| **D15** | 返佣计费事件范围 | ⭐ **只做招工酬金**（严格按用户原文）。商品/交易所留到各自阶段。**同上，可一句话改** |
| **D16** | 站点标题口径 | ⭐ **写死在源码（locale 文件）+ 四语输出 + 后台不可改**；完整句只给浏览器标签，头部用短版 `siteBrand`；不加 `og:` meta。用户 2026-09-27 逐项点选，四语逐字表见 §5.24 |
| **D17** | 幂等前置闸的定位 | ⭐ **只读重放前置闸 = R51 的「重放快路径」，不取代 `ON CONFLICT` 探针的并发权威性**；`extra` **非契约字段**（重放 `{}` 合规，不开 `0013`）。详见 §5.25 |

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


### 5.16 **重新裁定：`cid <= 0` ⇒ 404** —— 我裁错，且我的错前提被照做进了产品代码

**事故链条（四棒传递，一棒都没人拦住）**：
1. 我裁定「形状非法 = 400 / 形状合法但不存在 = 404」，**但没枚举 `cid <= 0` 归哪一类**；
2. Jing 把该裁定落位进 spec v0.4，**同样没枚举**（歧义原样保留）；
3. Jing 的 F-6 上报里带了「**DB 侧已是 400**」这个**推断**（不是实测），我当**既有事实**转手写进了派单；
4. 实现方照做，把 TS 侧 `toCid` 从 `404` 改成 `400`。

⇒ 结果：**改之前两侧本来就一致（都是 404），被我这一轮人为造出了一个不一致。**

**实测真值（我亲跑，非转抄）**：

| 输入 | DB 侧 `ledger_cid_arg` | TS 侧（被改错后） |
|---|---|---|
| `'0'` / `'-5'` | **`LD007 / LEDGER_CURRENCY_NOT_FOUND / 404`** | `LEDGER_AMOUNT_NOT_POSITIVE / 400` ❌ 人造不一致 |
| `'abc'` / `''` | `LD016 / LEDGER_AMOUNT_INVALID / 400`（`reason=NOT_DECIMAL_INTEGER`） | 同 ✅ |
| `'999999999999'` | OK（形状合法，存在性另查） | 同 ✅ |

**新裁定（枚举到边界值，不留歧义空间）**：
- **形状非法**（非十进制整数 / 空 / 超 `bigint` / 缺失）⇒ **400** `LEDGER_AMOUNT_INVALID` + `details.reason ∈ {NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}` + `details.field`；
- **形状合法但该行不存在 ⇒ 404**（`LEDGER_CURRENCY_NOT_FOUND` / `LEDGER_ACCOUNT_NOT_FOUND`）；**`cid <= 0` 与负数属此列** —— 依据：`currency.cid` 是**正整数序列**，非正值构造上不存在，是「查不到」而非「写错了」；
- `LEDGER_AMOUNT_INVALID` 是**历史码名**，兼作「参数形状非法」码，靠 `details.field` 区分参数字段；**不新增错误码**（关闭集不变）。

**处置**：TS 侧回退 404（R3-P1n）；spec 枚举修正 → v0.5（R3-P1l）；**DB 侧从来是对的，明确禁止改动**。

**教训（立为纪律）**：
1. **裁定必须枚举到边界值。** 「形状非法」这类抽象分类，在 `<= 0` / 空串 / 负数 / 缺失 处**必然**有歧义；不枚举＝把歧义留给下游猜。
2. 🔴 **派单里引用「现有行为」必须现场实测后再写，或显式标注「推断，待核实」。** F-6 那句「DB 侧已是 400」是推断，我当事实转抄了 ⇒ 直接导致改错产品代码。**这是本轮第 4 条我的转抄/前提错误**（前三条：转抄过期行数 1288、错前提「spec 里有 set_config 声明」、亲跑覆盖实施方取证文件）。


### 5.17 **读路径逃逸类闭合 —— P1 的错误闭环这一刻才真正闭上**（R3-P1o，已核）

| 判据 | 修前 | 修后 |
|---|---|---|
| `raw_sqlstate_escapes_zero` | ❌ **33 格**（`22003`×30 / `22P02`×2 / `23503`×1） | ✅ **0** |
| `unmapped_zero` | ❌ 33 | ✅ **0** |
| `missing_status_zero` | ✅ 0 | ✅ 0 |
| `expectation_mismatches` | ❌ **154** | ✅ **0** |
| `valid_shape_false_reject` | ✅ 0 | ✅ 0 |

604 格（实跑 590 + 按数据纪律跳过 14）；`ledger_entry` 166 → 166（**一行都没写**，自证）。母缺陷同一格现为：`LEDGER_AMOUNT_INVALID / 400 / mapped=true / reason=OUT_OF_BIGINT_RANGE / field=cid`。

**「按类修」的功效 —— 数字本身就是论据**：我们**发现的只是 1 格**（`getCurrency` 超 `bigint`），按类扫出 **33 格、分布在 6 个入口点**（`E-R1/R2/R3/W7/W8/W9` + `limit` 非数值的 `22P02`）+ 154 格期望不符。**点修会漏掉另外 32 格。**

**收敛方式**：枚举 **17 个**接收外部 `cid`/`uid`/金额的入口点，闸位**全部前移到「碰 PG 之前」**，且共用同一个 `toAmount`（`toCid`/`toUid`/`assertUserUid`/`entryToPayload`/`normalizeRef`/`amountToPayload` 都经它）⇒ **结构性收敛，非点补**。附带修掉两格：`getOrCreateAccount(bigint 上限)` 裸 `23503` ⇒ 404；`listEntriesByAccount(limit=NaN/'abc')` 裸 `22P02` ⇒ 取默认值。

**法证方法值得记一笔**：修前基线由**同一份终版脚本**产出（临时 `git checkout -- src/ledger.ts` 回 HEAD → 跑 → 还原修复版并核 md5）⇒ 修前/修后可对撞，不是两套脚本各说各话。

#### 我的三条裁定（Kong 交回的待裁项）

| # | 事项 | 裁定 |
|---|---|---|
| **R-1** | `cid` 以 **JSON number** 传入（含 `0`/负数）：实测两轮均 `404`，TS 未归入 `NOT_STRING` | ✅ **保持 404**。**数字是 JSON 里标识符的自然表示，不是类型错误** ⇒ 属「形状合法」。只有**非十进制字符串**与**非数字类型（对象/布尔/数组）**才 `NOT_STRING`/400。**spec §14.3 (B) 的括号「数字」需更正。** |
| **R-2** | 三处 **reason 名**分歧（DB `OVER_MAX_SINGLE_AMOUNT` ↔ TS `OUT_OF_BIGINT_RANGE`；TS `NOT_DECIMAL_STRING` ↔ DB `EXPONENT_NOT_ALLOWED`；已修的历史 `BAD_TYPE`） | ✅ **维持现状** —— 三处**同码、同 status，仅名不同**。**立规则：调用方只准按 `code` 分支，不得按 `reason` 分支**（`reason` 是诊断信息，不是契约）。靠改 DB 判序求名对齐要动 `0005` ⇒ 不值。 |
| **R-3** | R-2 与更早那个「`cid` 形状错误借用 `LEDGER_AMOUNT_INVALID`」是**同一根因** | ✅ 合并为工作项 **「错误码命名整理」**，排 **P2/P3 边界一次做完**（四条清单：① 标识符形状错误借用金额码；② DB `ledger_int_amount` 对标识符套用金额长度帽；③ TS `BAD_TYPE` 拆分（已修）；④ R-2 三处名分歧）。根因一句话：**关闭集词汇是「金额中心」的，却被长期用于标识符**。 |

**事实陈述（不是事故，但必须留档）**：测试数据清零基线（`ledger_entry=0` / `cid=1 total_supply=0`）**已不复存在** —— 回归套件会**真实写入 cid=1**，现读数 `ledger_entry=166`、`cid=1 total_supply=3600`（三个冒烟账户 1348+730+322 + smoke-db）。**平台账户 `0/-1/-2/-3` 仍全 `0/0` 未动。**


### 5.18 **`append-only` 不变式的真实边界**（我实测，口径必须诚实）

| 事实 | 读数 |
|---|---|
| 触发器函数体 | `RAISE EXCEPTION 'ledger_entry is append-only: % forbidden (txid=%)'` —— **无条件**，不看出处、不看会话变量 |
| `DELETE` 实测（回滚事务） | ✅ **被拦死**：`P0001 ledger_entry is append-only: DELETE forbidden (txid=2209)` |
| 触发器覆盖位 | `tgtype=27` = ROW + BEFORE + **DELETE + UPDATE** |
| **`TRUNCATE` 触发器** | ⚠️ **0 个** ⇒ `TRUNCATE ledger_entry` **可静默清空全表**（PG11+ 需要 `BEFORE TRUNCATE` 语句级触发器才拦得住） |
| 管理员旁路 | `purge-test-data.ts` 走 **暂时 `DISABLE TRIGGER` → `DELETE` → 重新 `ENABLE`** 这条通道（D11 清零就是这么做的） |
| 运行时代码会不会 TRUNCATE | ❌ 不会（`src/**` 内 `TRUNCATE` 零命中）⇒ **缺口是理论性的，不是现实风险** |

⇒ **口径钉死：`append-only` 是「防应用层事故」的护栏，不是「防管理员的绝对约束」。** 此前我们把它当绝对不变式在报告里陈述过 —— **那句话过强，以此节为准。**

**处置**：TRUNCATE 缺口**不在 P1 修**（无运行时代码会 TRUNCATE），登记进 **「错误码命名整理」同批的后续小迁移**（一条 `BEFORE TRUNCATE` 触发器即可，可与命名整理合并为一次迁移）；在修好之前，任何「append-only 已绝对保证」的表述一律作废。

**顺带结掉 Jing 标的那条「未核对」**：扫描读数 `ledger_entry` 修前 240 / 修后 166 的**下降**，成因**未追到具体命令**，但**已排除应用路径**（`DELETE` 实测被 `P0001` 拦死；两个 phase 的自证 `wrote_no_ledger_rows=true` 均成立）⇒ 诚实说法是「**期间存在管理员级清理动作，非应用层删行**」。Jing 拒绝替它编一个成因，是对的。


### 5.19 **P2 拆解：十级返佣**（2026-09-27 立项）

**⚠️ D12–D15 是用户未表态时按推荐项冻结的默认（clarify 表单超时）—— 每档都能「一句话改」，改一个字的成本很低，不值得卡住主线。**

**领域模型（三件东西，一条链）**：
1. **邀请图 `referral`**：`child_uid`(PK) / `parent_uid` / `depth` / `bound_at`。**终身绑定、不可变**（INSERT-only + 不可变触发器）。**防环靠构造**：`depth = 父的 depth + 1`（父无行则 1）⇒ **环在数学上不可能形成**，不靠事后检测。 ⛔ **【v0.24 更正：这句话是错的 —— 防环靠构造不成立，见 §5.20 #1。2-环反例已实测成立。】**
2. **佣金政策 `commission_policy`（版本化）**：`fee_rate_bp`(100–500) / `levels`(≤10) / `weights_bp[]` / `effective_from` / `created_by`。INSERT-only；取「≤ 事件时刻的最大 `effective_from`」那一版。守卫：`Σweights_bp <= 10000`。
3. **一次原子事件**（`op=entries`，一个幂等键）：`job_payout`（解冻入打工者可用）→ `job_fee`（手续费入平台佣金账户）→ **N× `commission`**（佣金账户 → 各级祖先）。全在一次 `ledger_post_event` 调用内 ⇒ 原子 + 幂等 + 全部走既有 R79 锁全序。

**必须由 spec 钉死的硬项**（这些是 P2 的真风险点，不是实现细节）：
- **取整**：全程整数最小单位；**最大余数法**；**Σ实付必须 == 池子金额（逐分不差）**；任何残余给**最深一层**（确定性规则）。
- **重归一化**：链上不足 `levels` 层时按**已存在层级的权重**重新归一（D13）；重归一后某层算得 0 ⇒ 不建分录，其份额并入余数池再分。
- **零/极小额**：池子为 0 ⇒ 不产生任何 `commission` 分录，且不应因此报错。
- **无邀请人**：打工者无 `parent` ⇒ 整块佣金不存在；**此时手续费归谁必须明确**（倾向：手续费仍收、留在平台佣金账户 ⇒ 需 spec 明写并给判据）。
- **平台白名单**：`commission` 出账方是平台佣金账户 ⇒ 必须进 `PLATFORM_KIND_WHITELIST`；**不得新增错误码**（关闭集 33 不动）。
- **幂等/并发**：同一笔结算并发重放 ⇒ 不双扣、不双发（复用既有派生键 + 唯一约束机制）。
- **可证伪判据**：Σ=池子逐分相等；打工者净额 = 酬金 − 手续费；平台佣金账户在该事件上净额为 0；10 级链全深度可结；无邀请人/短链/零额三条边界各一例；并发重放不双发；政策改版后历史事件读数不变。

**派单序列**：`R3-P2a`（Jing 出 `docs/commission.spec.md`）→ 我核 → `R3-P2b`（Kong 实现 `0007` 迁移 + TS 层）→ Neng 质检 → 我验收。


### 5.20 **P2 spec 交回的 16 项待裁 —— Zang 逐条裁定**（2026-09-27）

> Jing 的 P2 spec（1245 行 / CR 规则 77 条）**顶回了 16 项**，其中 **#1 直接推翻了我自己的设计**。**这是本轮最有价值的一次顶回 —— 在写第一行实现之前就拦住了。**

| # | 事项 | 裁定 |
| **#1** | 「防环靠构造」 | ⛔ **我错了，spec 对。** `depth = 父.depth+1` 只校验**新边**，**既有边会被追溯破坏**（先 A→B 再 B→A：插入时等式成立、环已形成）。**修正口径**：绑定时必须断言「**新父 P 不是 C 的后代**」（从 P 向上走、遇 C 即拒），**且绑定必须串行化**（两条反向绑定并发时单靠约束拦不住）。`depth` 保留（遍历上界 + 审计），**但不再是防环机制**。⇒ `0007` 必须同时给：自指禁令 + 祖先检查 + 串行化，**且必须有一条「2-环反例」判负用例**。 |
| **#2** | R45「差额留池」⟷ D13「按比例再分配」 | ✅ **D13 胜**（用户原文「1–5% 全额进佣金池分 10 级」+ 判据 M3「−2 净额 0」自洽）。`ledger.spec` 出 **v0.8** 对 R45 就地增补（留痕 v0.7 原文，标「已由 D13 取代」）。 |
| **#3** | 费率真源 `app_config` ⟷ `commission_policy` | ✅ **`commission_policy.fee_rate_bp` 是唯一真源**；`ledger.spec` §14.1 #32 措辞同步更正。 |
| **#4** | `commission_payout` 表 / `ref_id` | ✅ **不建该表**（单语句形态下函数不能写业务表）。审计真源 = **`ledger_entry`**；`ref_id` = 同一 `job_id`。`ledger.spec` §7.2 #8 同步更正。 |
| **#5** | 权重守卫失败类 | ✅ **400**（`input` 桶），与已冻结的 `bucket↔状态类` 一致。**不许改 500**（会打破「500 只来自 defect」判据）。 |
| **#6** | 业务表 FK 到 `users(uid)` ⟷ R21 | ✅ **同意 spec**：R21 的适用范围是**账本表**（`account`/`ledger_entry`，其 uid 含合成负值），业务表不受其约束。R21 在 v0.8 里加范围限定。 |
| **#7** | `depth` 是否设上限 | ✅ **不设**。封顶的是分配层数 `levels ≤ 10`；`depth` 保留作遍历上界。 |
| **#8** | 错绑纠错 | ✅ **P2 不提供改绑**（终身绑定）。登记为已知运营风险，与 D3（无手机号 ⇒ 账号找回）同批排 **P6**。**⚠️ 必须如实告知用户：错绑是永久的。** |
| **#9** | 无政策行 | ✅ **口径 A**（`0007` 种默认政策）+ `created_by` 放宽为允许平台 id（`0/-1/-2/-3`）并**去掉指向 `users` 的 FK**（P2 时点 `users` 可能 0 行，FK 会让种子插不进去）。 |
| **#10** | 回填 `effective_from` | ✅ **禁止**（spec 正确：回填 = 永不生效的死版本 + 静默无效配置 + 审计误导）。 |
| **#11** | 无邀请人时手续费归属 | ✅ **仍收，但入 `−1`（平台收入），不入 `−2`** —— 理由：`−2` 若只进不出，钱会**永久沉淀**；`−1` 才是平台收入账户。**并明确：`−2` 只作佣金中转，同一事件内进出相抵、净额 0、不留存。**（D6 的边界补充；**可一句话改**） |
| **#12** | 雇主可否是受益人 | ✅ **允许**。只按邀请关系分配、不对「雇主/打工者」身份特判；**唯一硬约束是受益人不得是打工者本人**（由邀请图自指禁令保证）。 |
| **#13** | 人工回滚 | ✅ **同意**：无 `down` 迁移；四步；上线后一旦有 `commission` 行**只准前滚**。 |
| **#14** | 计算是否下沉进 DB | ✅ **不下沉** —— 不重写 P1 已验证的核心，不新增改 `ledger_post_event` 的迁移。**但「Σ佣金 == 手续费」必须由 DB 侧强制，不得只靠调用方自觉**：允许用 `0007` 的**触发器**对同一 `event_root_key` 的佣金分录做后置断言；**禁止改 `ledger_post_event` 函数体**。spec v0.2 据此选定机制并写成规范。 |
| **#15** | 「残余给最深一层」读法 | ✅ **① 最大余数法 + 同余数深层优先**（spec 采用版），例 5 作判据。**否决 ②**（小池子时最深层独吞，不公平）。 |
| **#16** | 退化分母 `W=0` | ✅ **在政策写入时就拒绝**（要求 `Σweights_bp > 0` 且**前 M 层不得全零**）⇒ 400（同 #5 桶）。**不用 500、不新增码。** |

**顺带更正**：§5.19 里我写的「防环靠构造 ⇒ 环在数学上不可能形成」**已就地划掉**。教训同 §5.16：**我在同一句话里既做裁定、又替系统断言了一个「构造上不可能」的强命题，却没有举反例验一遍。** 立为纪律：**凡写「不可能 / 构造保证 / 数学上排除」这类话，必须当场举出至少一个反例去撞它。**

### 5.21 **P2 spec v0.2 交回 5 项 —— Zang 逐条裁定**（2026-09-27）

> 两册 spec 实物已核（`ledger.spec` v0.8 md5 `5fc164c3…` / 33 码 / R1–R108；`commission.spec` v0.2 md5 `6ba60ebf…`；四份快照 md5 全部逐字节对齐）。**该单被迭代上限截断，但交付物在盘上且已核。**

| 项 | 事项 | 裁定 |
| **§14.2 #1**（**卡实现**） | ⚠️ 裁定 #11 的**机械前提不成立**：`0004` 的 `ledger_assert_platform_mutation` 对 `-1` 只放行 `credit ∈ {trade_fee, listing_fee, currency_create_fee}`，**不含 `job_fee`** | ✅ **选 (a)：接受 P2 = `0007` + `0008` 两条迁移**。理由：① 保住「**每笔招工酬金一律收 1–5%**」这条统一规则，不制造「没邀请人反而更便宜」的逆向激励；② `-1` **本来就是**平台收入账户，白名单只是**不完整**；③ 若改回「留池」则钱会永久沉淀在只进不出的 `-2`（这正是我否决它的理由）。`0008` 用 `CREATE OR REPLACE` 扩 `-1` 白名单（**不改 `0004` 文件本身**，沿用 0005 的替代模式）。**强制附加**：扩白名单后必须重跑 **P1 全量回归**（tsc / 双冒烟 / F1 / F2 / 逃逸扫描）+ **一条负向断言**（`-1` 仍须拒绝**不在扩展后白名单里**的 kind）——**证明这次扩展没有顺带松掉别的**。 |
| **§14.2 #2** | #16「前 M 层不得全零」无静态等价式（`M = min(levels, 链深)`） | ✅ **接受 spec 的等价式 `w_1 > 0`**（比字面更严）。它**正是消除退化情形的最小充分条件**：任何邀请人存在 ⇒ 第 1 级必然存在 ⇒ 若 `w_1 = 0` 而链深恰为 1，`W=0` 就会真实发生。⇒ 写死在政策守卫里。将来若运营确需 `w_1 = 0`，**另发单**，并须同时定义运行期退化处置。 |
| **§14.2 #3** | DB 侧后置断言（CR80）失败应落 `defect/500`，但既有分类器把「其余 23514」归 `input/400` ⇒ 断言器不得裸抛 23514 | ✅ **必须落 500** —— 这是**内部不变式违反**（defect），**不是调用方输入**。机制：**改抛既有的对账不符码**（关闭集第 33 码 `LEDGER_RECONCILE_MISMATCH`），**禁止裸抛 23514、禁止新增码**。⇒ 实现方须用**真库探针**确认该码 ⇒ SQLSTATE 的落桶确实为 500 并回填读数；**若探针证明落不到 500，回来找我，不得静默接受 400**。 |
| **§14.2 #4** | 新断言与 P1 既有回归 / 历史事件形状的相容性未测（是否存在「有 `job_fee` 入 `-2` 而无 `commission`」的行） | ✅ **列为实现轮验收必做项**：上线前必须对拍；若真有此类行，**收窄断言范围并回写 spec**，不得让新断言把历史事件判死。 |
| **§14.2 #5** | 裁定 #8 的告知义务（错绑永久） | ✅ **登记为上线前必须兑现的义务**：邀请绑定页文案须如实告知「绑定后永久不可更改」（P7）；与本机已向 Kevin 单独呈报的风险同批（P6）。 |

**P2 范围因 #1 变更**：由「`0007` 一条迁移」改为 **`0007` + `0008` 两条**。

### 5.22 **`0007`/`0008` 验收 + 一个新缺陷：错误码反向映射缺 LD031–LD033**（2026-09-27） ⛔ **【v0.27 更正：我说「反向映射缺最后三码」是错的 —— 修前实测 `roundtrip_mismatches=32/33`，该函数根本没有 LD0nn 分支、33 码全部未归类。见 §5.23。】**

**我亲手复核的三处**（不是转述）：

| 项 | 我的读数 |
|---|---|
| 2-环判负（我自己用**正确方向**跑） | ✅ `child=949002, parent=949001` ⇒ `LD016 / LEDGER_AMOUNT_INVALID / reason=REFERRAL_CYCLE_REJECTED`；`referral` 行数不增（仍 2） |
| 自指 | ✅ `REFERRAL_SELF_BIND` |
| 政策种子 | ✅ `fee_rate_bp=100 / levels=10 / Σweights=10000 / w_1=3000` |
| 触发器 | ✅ `trg_ledger_entry_commission_conservation` **d=true i=true e=O**；`trg_referral_cycle_guard` / `trg_commission_policy_weights_guard` 均在 |
| `-1` 白名单 | ✅ `job_fee` 放行；`commission` 仍拒（`LD021`） |
| `schema_version` | ✅ `0008`（8 行） |

**环守设计的巧处值得记一笔**：串行化点 = 「同一事务内先按 **uid 升序** `FOR UPDATE` 锁 users 两行」—— **直接复用了 R79 的 uid 升序纪律**，既让「`A→B` 与 `B→A` 并发时后者等前者提交」，又**天然无死锁**。祖先检查里的 1000 步上界只防「数据里已有环时无限递归」，**不是防环机制本身**。这是把既有纪律**复用**而不是新造机制，做得对。

#### 🆕 新缺陷（P1 遗留，被 P2 第一次真正抛 `LD032` 才暴露）

`ledger_error_for_sqlstate('LD031' | 'LD032' | 'LD033')` **全部返回** `{"code":"LEDGER_TRANSACTION_REQUIRED", "bucket":"defect", "reason":"unclassified_db_error"}`。

⇒ **反向映射表缺最后三码**（正向有：`ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH')='LD032'`）。落桶侥幸是对的（`defect`/500），**但码名与 reason 被错配** —— 调用方看到的是「事务必需 / 无法归类」，而实际是「对账不符」。

**为什么到今天我们才发现**：`0007` 的佣金守恒断言是**人类第一次真正抛 `LD032`**；P1 的 F2 与逃逸扫描覆盖不到 defect 类码，因为**调用方输入触发不了它们**。

**裁定**：
1. **必须修**，两侧同改：`0009` 迁移 `CREATE OR REPLACE` 反向映射函数补齐三码（**不改 `0005` 文件**）+ TS `LEDGER_ERROR_TABLE` 同步。
2. **新增一条我们从未有过的机读判据 —— 33 码全量往返闭合测试**：`ledger_error_for_sqlstate(ledger_sqlstate_of(name))` 必须**回到同名**，且 bucket 必须满足冻结的 `bucket↔状态类` 映射。断言 `roundtrip_mismatches=0 / unknown_codes=0 / bucket_violations=0`。
3. **诚实口径**：P1「关闭集 33 码」自证过的只是「**正向映射有 33 条**」，**从未自证「反向映射也有 33 条」**。**审计只做了单向，就以为闭合了** —— 这条早该有。


### 5.23 **反向映射闭合验收 + 更正我的两个错陈述**（2026-09-27）

**我亲核**：`schema_version=0009`；往返测试 `--assert` **exit 0 / `assertions_failed=[]`**；抽查 8 码（含全部三个新补码）**全部落到真实码名与正确桶** ⇒ **整表修好，不是点修**。

| 更正 | 事实 |
|---|---|
| 🔴 **我说「反向映射缺最后三码」⇒ 错** | 修前 `roundtrip_mismatches = 32/33`（唯一"通过"的是名碰撞）、`stale_unclassified_reason = 33` ⇒ **该函数根本没有 `LD0nn` 分支，33 个自有码全部未归类**。**我只探了自己怀疑的三个码，就推广到全表。** 教训：**选择性抽查必然偏** —— 我采样的恰是「我以为会坏的地方」，不是均匀采样。 |
| 🟠 **我派单说「TS 侧缺三码」⇒ 错** | 实测 TS 侧 `LEDGER_ERROR_TABLE` / `LEDGER_SQLSTATE_TO_CODE` **本来就 33/33 齐全**，缺口**只在 DB 侧**。实现方没有盲从，改交 `LEDGER_ERROR_BUCKETS` + `httpStatusOf` + `LedgerError.httpStatus` 三项真资产。 |

**裁定 bucket 扩展**（冻结映射只覆盖 400/400|404|409/503/500，而 §14.1 有码落在 403/423/200/null）：

| 扩展 | 裁定 |
|---|---|
| `403 ⇒ input` | ✅ 接受（权限不足是调用方侧问题） |
| `423 ⇒ integrity` | ✅ 接受（锁定 = 状态冲突） |
| `null ⇒ defect` | ✅ 接受（未赋 HTTP 状态者按 `status ?? 500` 兜底，与缺陷类同） |
| **`200 ⇒ input`** | ❌ **改判**：`200` **不是错误类，不参与 bucket 校验** ⇒ 单列 `benign_outcomes` 一类。依据：`LD006 = LEDGER_IDEMPOTENCY_REPLAY` 就是 200 —— 它是**良性结果**，硬塞进 `input` 语义不对。 |

⇒ 要求 Jing 把**三条扩展 + `benign_outcomes` 一类**写进 `ledger.spec` 的冻结映射表（**让冻结集与现实对齐**，而不是让现实去迎合一张不完整的表）。

**裁定：反转探针（§8.1）不要求做。** 正/反两向已由「**同一份终版脚本** + 迁移状态指纹（修前 `0009=ABSENT` 红 / 修后 `0009` 绿）+ 修前 `32/33` 对照修后 `0`」覆盖；再反转一次函数体只是**重证修前态**，边际价值低，不值得再花一轮。

**诚实口径（留给接 HTTP 的那一单）**：`src/index.ts` 至今**没有账本路由** ⇒ 本单的兜底落在 `ledger-errors.ts` 的 `httpStatusOf()`。**将来接线必须用 `err.httpStatus`，不得用 `err.status`** —— 后者 `null` 是 §11 R88 **脚本退出码**语义，是故意保留的，不是缺陷。


### 5.24 **站点标题口径（写死 + 四语 + 后台不可改）**（2026-09-27）

**用户原话**：「网站标题不要在后台自定义，直接写死“Seafood 海鲜市场｜加密人自己的「闲鱼」”，多语言记得要四种语言输出。」

**只读侦察的现状（我亲查，行号已核）**：i18n 已有且**恰好四种语言**（`zh/en/hk/vn`，按 URL 首段前缀选语）；`siteTitle` **已经是四个 locale 里的一个现成键**，但四个值全是 jinli 品牌（`Jinli社区 / Jinli社區 / Jinli Community / Cộng đồng Jinli`）；该键**全仓只有一个使用点**（`Header.jsx:177` 的头部品牌字）；**没有任何代码设 `document.title`** ⇒ 浏览器标签永远卡在 `index.html:7` 的 `<title>Jinli Community</title>`（**既不本地化、还是 jinli**）；后台的 `siteName`（`SystemSettings.jsx` 的「网站名称」）**根本没接到任何用户可见面** ⇒ 是个**死旋钮**，本地默认还残留 `'Jinli Club'`。

**冻结口径（用户逐项点选）**：

| locale | `siteTitle`（完整句 ⇒ **只给浏览器标签**） | `siteBrand`（短版 ⇒ 仅头部） |
|---|---|---|
| `zh` | `Seafood 海鲜市场｜加密人自己的「闲鱼」` | `Seafood 海鲜市场` |
| `hk` | `Seafood 海鮮市場｜幣圈人的跳蚤市場` | `Seafood 海鮮市場` |
| `en` | `Seafood｜The crypto crowd's own flea market` | `Seafood` |
| `vn` | `Seafood｜Chợ đồ cũ của dân crypto` | `Seafood` |

- 分隔符是**全角 `｜`（U+FF5C）**，不是半角 `|`。
- 非中文三语选**「全本地化」**（不使用「闲鱼」字面）；`zh` 逐字保留用户原句。
- 覆盖范围：**只浏览器标签页**；头部用**短版**（不得把长句塞进头部）；**不加** `og:`/`description` meta；后台管理页不做多语言改造。
- **`siteTitle` 是单一真源**；`index.html` 的静态 `<title>` 是 i18n 启动前的回退值（**唯一被容忍的重复**，须带注释说明真源在 locale）。
- **后台不得可改** ⇒ 拆掉「网站名称」旋钮；后端 `DEFAULT_SYSTEM_SETTINGS.siteName` **本单不动**（已无任何用户可见使用点；是否清理登记为 P3 顺手项，一句话可改）。
- 附带项（**可一句话去掉**）：`<html lang>` 由写死 `zh-CN` 改为跟语言走。
- `en`/`vn` 的短品牌按所选变体只剩 `Seafood`（要改成 `Seafood Market` / `Seafood Chợ Hải Sản` 一句话可改）。

**待登记的连带发现（不在本单范围，避免顺手扩面）**：`frontend/src` 里仍有 jinli 品牌残留多处（`AdminLayout.jsx` / `LoginModal.jsx` / `HomePage.jsx` / `AuthPage.jsx` / `images/Jinli_logo.svg`）—— 品牌清理应**单独立项**。


### 5.25 **幂等前置闸 = R51 的「快路径」，不取代 `ON CONFLICT` 探针**（2026-09-27）

**症状（不是成因）**：托管花光后，同键同载荷重试得到 `LD002 冻结余额不足（409）` 而不是 `200 + idempotent_replay:true`；客户端超时后**无法区分「已成功」与「余额不足」**。

**成因（实测位置，非推断）**：`ledger_post_event` 内 `pos_c4_account_lock 26825 < pos_c5_balance_section 27572 < pos_r80_balance_gate 29468 < pos_on_conflict_probe 31476` ⇒ **余额/冻结闸跑在幂等占位之前**，与本册 R51「顺序固定」及第 454 行明文顺序冲突。

**修法（`0012`，已应用 · `schema_migration.checksum = 2a64483f944f16e3…` = 盘上文件 sha256）**：C4 账户加锁之后、C5 余额闸之前插一道**只读重放前置闸**（按 `event_root_key = v_key` 走 `idx_ledger_event_root_key`）：命中且指纹同 ⇒ 立即 R52①；指纹异 ⇒ 立即 `409 LD003`；**完全不跑余额/冻结校验**。
后态位置：`pos_c4_account_lock 26917 < pos_pre_gate 27698 < pos_c5_balance_section 30721 < pos_r80_balance_gate 32617 < pos_on_conflict_probe 34625`；`ON CONFLICT (idempotency_key) DO NOTHING` 首条分录探针**原地保留且在闸之后**（`order_ok_gate_after_lock_before_balance = true`、`on_conflict_still_after_gate = true`）。
函数体指纹：before `42449 B / 0cf1bb98…`（与 P1 期登记逐字同）→ after `45598 B / d94dd902…`。

**裁定（口径，交由 Jing 落 spec）**：① 前置闸是**重放快路径**，**不得**表述为「取代 `ON CONFLICT` 探针」——并发两个**全新**事件的权威性仍由 `ON CONFLICT` 承担，R51 禁「先 SELECT 再 INSERT」的立法意图不变；② 第 454 行顺序明文更正为「信封校验 → 加锁(C4) → **只读重放前置闸(C4.5)** → 余额/冻结闸(C5/R80) → ON CONFLICT 首条分录探针 → 分录 → 余额更新」。

**`extra` 裁定**：首写 `extra = {symbol, entries}`、重放 `extra = {}`。全册检索 `'extra'` 与返回形状 = **0 命中** ⇒ 「既有结果」的枚举里**本就没有 `extra`**；且该行为**早于 `0012`**（`0005` 的 C7 重放路径即如此）。⇒ **`extra` 非契约字段**（旨同 D39「让冻结集与现实对齐，而不是让现实去迎合一张不完整的表」），**不因它开 `0013`**；Jing 就地写明「重放结果的保证项 = `idempotent_replay` / `txid` / 账上结果（分录与余额快照）；`extra` 属诊断信息，重放时为 `{}` 合规」。

**六项矩阵 after（`p2x-00` 34/37；唯一 red 是用例 5 的探针排序缺陷 —— 该探针先 `await Promise.all` 再提交胜者 ⇒ 败者只能等 R82 的 3s `lock_timeout`（`LD025`），且 before 三份读到同一 `LD025` ⇒ 与 `0012` 无关，为保 before/after 可比未改脚本）**：① 头号**已修**（`200 + idempotent_replay:true` + 同 txid + 键下恒 4 行**零写入** + `entries_sha256`/`accounts_sha256` 与首写逐字相同）；② 有足额 frozen 时重放不变；③ 同键异指纹 ⇒ `409 LD003` 零写入；④ 全新键仍 `LD001/LD002`、零残留（**R63 未破**）；⑤ **真并发**（新探针 `p2x-02`，胜者先提交不等败者）13/13 ⇒ `landed 1 / replay 1 / error 0`、败者得胜者 txid、余额恰扣一次；⑤b 分阶段竞态 B 阻塞 936ms 后 200 重放同 txid；⑥ 新键/换键/回首键行为不变。**判负自证三步齐全**：闸整段挪到余额闸之后 ⇒ `migrate` exit 4 FAILED（文件自带行为探针判负 `LD002`）；只删闸的 `END` 标记行（函数行为逐字不变）⇒ FAILED `P0001` 结构性断言；还原 ⇒ md5 逐字回到 `5b97c96b…`；重跑 ⇒ applied。**没碰别人钱**：`cid=1` 与平台 `0/-1/-2/-3` 余额哈希前后一致。

**`0012` 干跑失败的根因（两层，全在 §C 的 `DO` 自检块内，函数体一字未动）**：① 第 1151 行 `position('''idempotent_replay''' IN v_window)` **少一个收尾引号** ⇒ 引号奇偶翻转 ⇒ 第 1178 行的 `0x` 字面量被当代码态十六进制数 ⇒ `42601 invalid hexadecimal integer`；② §C 里 **17 处 `text[]` 与裸字面量的 `||`** 被 PG 解析成 `array_cat` ⇒ `22P02`，**把自检报错消息掩盖**（改为 `array_append`）。**层判定（对照实验，非推断）**：`migrate.ts`(L39/L94) 与干跑探针(L18/L24) 都是 `readFileSync` + `client.query(整份 sql)`，**无切分/无正则/无插值**，且两条路径报**同一错误同一位置** ⇒ **干跑不是假阴性，缺陷在文件本身**；三变体 `t_g/t_h/t_i` 读数完全相同（`22P02`）⇒ **证伪**了「多字节注释丢定界符」的假设。作者级纪律已入 `data-migration-governance` 技能。

**遗留（登记，不在本单修）**：`p2x-00` 用例 5 的探针排序缺陷（修它会改基线 ⇒ 需重新基线）；`p2w-00-p2fix-verify.ts` 仍未跑绿（5 处红已定位到判据写法）；未验：未传指纹分支、`event_root_key IS NULL` 历史行、≥3 连接/压力、**pooler 路径**（全部经 `DATABASE_URL_UNPOOLED`；`0005` 已注明 pooler 拒绝 `lock_timeout` 启动参数）、`settle`/`hold_release`/`transfer` 等其它 op 的重放路径。
### 5.26 **已登记待立项（Zang 亲核，Kevin 未表态 ⇒ 本单不动）**（2026-09-27）

标题单交付过程中由**独立质检**挖出、且**与标题需求本身无关**的四项真缺陷。四项各自都小，但都是真的；**未开工**（`clarify` 表单超时/未选 ⇒ 按与 Kevin 的既定口径不阻塞、不擅自扩面，**一句话即可开单**）。

| # | 缺陷 | 证据 | 状态 |
|---|---|---|---|
| 1 | **jinli 品牌残留** | `/login` DOM 级仍显 `JINLI CLUB`；源码另有 `AuthPage.jsx:100`、`LoginModal.jsx:72`、`HomePage.jsx:219`、`layout/AdminLayout.jsx:133`（`Jinli Admin`）、`Footer.jsx` 的 `contact@jinli.club`×4、四个 locale 的 `welcome`/`copyright`/`slogan`、`src/images/Jinli_logo.svg`、`src/test/e2e/basic.spec.js:9` | 待立项 |
| 2 | **仓库自带 e2e 从未真正跑过，且会静默打到别的仓库** | `playwright.config.js` 的 `baseURL`/`webServer` 指 `5777`（vite 实际 `5787`），而 5777 当前被 `jinli/frontend` 的 vite 占用（PID 43201，`curl 5777` 返回 jinli 的 `<title>`）；`reuseExistingServer:!CI` ⇒ 静默复用；实跑 11 tests **11/11 failed**（`browsers.json` 要 chromium rev **1208**，缓存只有 **1228**）；规格仍断言旧标题 `/Jinli Club/` | 待立项 |
| 3 | **双重前缀 URL（真 bug，运行时可复现）** | `Header.changeLanguage` 的 `else` 分支 `newPath = '/' + lang + currentPath`：从带语言前缀**且无尾斜杠**的页再切语言 ⇒ `/hk/en` → `/vn/en` → `/zh/en`（标题只看首段故不受影响，探针仍绿） | 待立项 |
| 4 | **非中文路由有 45–65ms 的 zh 标题闪烁** | `index.html` 静态回退是 zh 长句（我裁定的「唯一被容忍的重复」）；实测 `/en` `/hk` `/vn` 在 134/134/150ms 读到 zh 长句、179/185/199ms 翻成对应语 | 设计上容忍；要消除可在 `index.html` 内联数行按 URL 首段先设 `title` |

另登记（不构成立项）：应用渲染期有一条 500 的资源请求（非本次改动面）；`html lang` 映射（`zh→zh-CN` / `hk→zh-HK` / `en→en` / `vn→vi`）为附带项、非 §5.24 强制项。

**质检报告落盘后的数量更正（2026-09-27）**：闪烁区间**实测为 `/en 45ms` / `/hk 51ms` / `/vn 49ms`**（上表第 4 项原记「45–65ms」是口头上限，**以此为准**）；`/login` 正文实测 **1 处** `JINLI CLUB`（其余出现在源码与诸 locale 文件中）；质检报告 `docs/qa/title-i18n.md`（**12 项判定 0 失败**，主矩阵 112 checks / 0 fail，含判负自证与 10 条未验证清单）；另质检方独立复跑构建得 `BUILD_EXIT=0`，并确认 `dist/index.html` 产出的 `<title>` 就是中文完整句。另：质检期间 HEAD 由 `474552f` 变为 `86cb067`，质检方**逐文件核验 worktree sha256 == HEAD blob sha256（8/8 相等，`hk.json = 7832cfcd…`）** ⇒ 实测字节即已提交字节、结论不失效（此即「HEAD 变动后必须重新对锚」纪律的正例）。


### 5.27 **`0012` 独立质检：验收通过 + §C 自检的两条已知盲区**（2026-09-27）

**结论：可验收（PASS）**。run tag `20260927T131927Z`；原始读数在 `backend-ts/.p2qa2-artifacts/p2qa2-*-20260927T131927Z*`（报告 `docs/qa/p2-0012-replay-order.md` 由收尾单补写）。质检**自造夹具**（不复用交付方 uid/键），逐条独立重取：

- **盘==库三向一致**：`0012` 的 utf8-sha256 == bytes-sha256 == `schema_migration.checksum` == `2a64483f944f16e3…`，12 个文件全部 MATCH；`migrate.ts` 跑两次均 `EXIT=0`、12/12 skipped、无 checksum drift。
- **闸位置与只读性**：`26917 < 27698`（闸起点）`< 30721 < 32617 < 34625`；闸体 2901 B（剥注释 1535 B）的写/加锁 token 扫描 = `[]`；与 `0005` 的函数体差分**只有两处纯插入**，C5–C8 一字未动。
- **🔴 关键新证据 —— 字节级修前/修后 A/B**：把两处插入从现役 `prosrc` 删掉后**逐字等于 git 里 `0005` 的函数体**（sha256 `9da1fe3cc135…`，文件体与 live `prosrc` 双向验证），在回滚事务里装载该实现跑同形状 ⇒ **`LD002 LEDGER_INSUFFICIENT_FROZEN`（缺陷复现）**；`0012` 下同形状 ⇒ **200 重放**。⇒ 修复真实有效，且补上了此前「新探针无 before 相位」的缺口。
- **头号 + 反向**：托管恰花光后同键重试 ⇒ `200 + idempotent_replay:true` + **同 txid** + 键下行数不变 + `entries`/`accounts` sha256 与首写逐字相同（18/18）；异指纹 ⇒ `LD003` 零写入且不污染后续重放；新键冻结/余额不足 ⇒ 仍 `LD002`/`LD001` 零残留 ⇒ R63 未破。
- **真并发**（自写探针，胜者一 resolve 立刻 COMMIT、不等败者）：胜者 200ms 落账、败者在行锁上阻塞后 `200 + 同 txid`，`landed 1 / replay 1 / error 0`，恰扣一次（14/14）；分阶段竞态 B 阻塞 1024ms 后同样 200 重放。
- **判负能力为真**：§C 的 7 个变体**全部真的 RAISE**（⇒ 迁移整文件回滚、exit 4），V0 无假阳性；**16 次运行零 `22P02`** ⇒ 报错被掩盖的问题已消除。
- **两条交付方断言均证实为真**：① `extra` 早于 `0012`（`0005` 与 `0012` 的 C7 段 **byte-identical**，sha256 `453a2e7781743866…`；装回 `0005` 走非闸重放路径得到同形状 `extra={}`）；② `p2x-00` 用例 5 的 red 是该探针 `await Promise.all` 之后**才**提交胜者所致的自造互等（`LD025`，**before 三份里同样红**）。
- **没碰别人钱 / 迁移链**：`cid=1`（7 行、`sum=8400`、md5 `2abde15ad1ae7e2d301a982493cbf925`）与平台 `0/-1/-2/-3`（29 行、`sum=46`）前后逐字相同；`git diff --numstat HEAD~1` 对 `0001`–`0012` 全 0。

**两条已知盲区（登记，不修）**：① §C 行为探针里 `v_r2 := ledger_post_event(v_evt)` **未受保护** ⇒ 恰恰在「闸被破坏」这一最需要诊断的场景，它先抛裸 `LD002`/`LD006`，**把累积的 `v_bad` 明细吃掉**（fail-closed 成立，但诊断信息在最坏时刻丢失）；② §C 的结构性位置/只读断言是**子串匹配** ⇒ 「语义改坏但逐字保留 `t.event_root_key = v_key`」的改写**逃过全部结构性断言**（实测 V5：struc 段 `raised=false`），只靠行为探针兜底。

**裁定：不为这两条开 `0013`。** 依据：① `0012` 已应用且被 `checksum` 锁住；② 契约级保证是**行为**，而行为已被字节级 A/B + 头号/反向/并发三类用例独立证实；③ §C 自检是**迁移期防回归**的纵深防御，其盲区是「以文本匹配做结构断言」这一方法的固有属性，而同一块里的**行为探针**仍抓住了 V5 类（只是报错信息不够诊断）；④ 为「改善报错信息」抬一次 `schema_version` = 成本无契约价值。⇒ 留待**下次真正需要 `CREATE OR REPLACE ledger_post_event` 时**顺带把 `v_r2` 用独立 `BEGIN…EXCEPTION` 包住。


### 5.28 **P3 立项与拆解（P1/P2 已闭环）**（2026-09-27）

**P1（账本内核）闭环；P2（十级返佣）闭环**（`0010` 绑定守卫 / `0011` 佣金断言闭合 / `0012` 幂等重放前置闸；两轮独立质检均 PASS）。

**P3 = 业务模块**，按用户原始需求的四柱落地：① **招工**（类旧 `task`）② **商品**（类旧 `reward`；用户用 `$` 标价、他人付积分获得）③ **积分交易所**（类旧「碎片交易」；`dashJ` 作为**可流通积分单位之一**，上市消耗积分作保证金、用户间交易收平台费）④ **邀请返佣的用户可见面**（机制已在 P2 实现，缺 UI 与事件接入）。**管理员不再在后台发 task/reward**，转为「搭平台 + 提供服务」。

**P3 入口先遣（已派单）**：**全量路由审计** —— 从 jinli 拷来的后端里有一批**活路由绑在新库不存在的表上**（`GET /api/user/asset/:uID` 实测 500，因 `asset` 表在新库不存在）。**在动任何业务模块之前必须先知道哪些路由能跑、哪些是死的**，否则会在死路由上叠新功能。交付 `docs/audit/p3-route-inventory.md`（人读）+ `.json`（机读，含 `verdict` 分类），并要求审计**内置判负能力**：独立重新发现并实测复现已知缺口。

**P3 的门槛项（我的建议，待 Kevin 一句话）**：
- **建议把「修仓库自带 e2e」列为 P3 前置**（§5.26 #2）：它现在**不只是死的，还会静默打到 jinli 站点上**（`playwright.config` 指 5777，而该端口被 `jinli/frontend` 的 vite 占用 + `reuseExistingServer:!CI`）。若不修，**P3 每个模块都缺回归能力**，只能靠一次性探针。
- **建议把「双重前缀 URL」随 P3 第一单一起修**（§5.26 #3）：`Header.changeLanguage` 一个 `else` 分支，却是**用户可见的真 bug**（`/hk/en`），修它成本极低。

**§5.26 四项的处置建议（我裁，Kevin 可一句话改）**：#2、#3 **建议纳入 P3 前置**（理由见上）；#1（jinli 品牌残留）**需 Kevin 给品牌文案口径** —— 其中 `slogan`/`copyright`/`welcome` 是**成句文案**，不是把品牌词一替换就完事；**#4（标题闪烁）我裁定不做** —— 消除它需要在 `index.html` 内联一份「URL 首段 → 标题」映射，**会破坏 §5.24 的单一真源**（该句已是唯一被容忍的重复）；正确做法是**部署层按语言下发 HTML**，属 P7 范畴。


### 5.29 **P3 数据层重写立项 + 全量路由审计结论落位**（2026-09-28）

**审计结论（`deleg_6e988e53`，55 条条目）**：`ok` 仅 **7** 条（3 个全局中间件 + `GET /` + `GET /health` + `GET /api/test/data` + `POST /api/auth/challenge`）；`column_missing` **40**；`table_missing` **6**（11 张遗留表全缺）；`legacy_unmapped` 2。**零路由触达 P1 账本内核与 P2 返佣** ⇒ **两天建成的内核在 HTTP 层一条都没接上**。产物 `docs/audit/p3-route-inventory.{json,md}`。

**真根因不是「缺表」，是列名模型**：`users` 真列是 `uid` / `evm`，而代码用带引号的 `"uID"`（`src/` 内 **57 处**）与 `"EVM"`（4 处）⇒ `column "uID" of relation "users" does not exist`。`database.ts` 还自带 **9 条 `CREATE TABLE`**，封装在 `ensureSupportSchema()`（定义 `database.ts:269`，**12 处调用**，含读方法如 `getUserAsset`）⇒ ① **读请求产生写副作用（DDL）**；② 因同函数里的 `"uID"` 那条 UPDATE 必抛，该「自愈」**永远完不成**。

**审计自身触发的库漂移（如实登记）**：审计只发了一个 `GET /api/market/1/orderbook` 就走进了该自愈 ⇒ **真库表数 8 → 17**，多出 9 张**全为 0 行**的表（`app_config` / `prize` / `prize_item` / `task_progress` / `shard` / `shard_transfer` / `market_order` / `market_trade` / `permission_group`），**不在任何迁移中** ⇒ 库与 `schema_migration` 不一致。**这不是舞弊，是「读不该写」缺陷的实证**（任何一次访问都会造同样结果）。

**411 条 `users` = 我方测试残差（已核实，非外部数据）**：uid 区间 `949001–961826`、其中 **400 条 ≥950000**（我方登记过的探针窗口）、**全部带 `evm`**、**0 个管理员**、`time_reg` **全部落在 2026-09-27 09:52–13:25 UTC**（= 昨天测试窗口）。

**Kevin 裁定（2026-09-28 三问）**：
- **D18 = 方案 A：数据层重写** —— 把旧 `database.ts` 换成**薄的新数据层**（`users(uid,evm)` + 账本双分录封装），旧文件归档废弃；第一步摘掉运行时 DDL + 列名对齐，再按四柱逐个加。
- **D19 = 先修码（摘掉运行时 DDL）再 `DROP`** 那 9 张空表，让库**回到 == `0012` 迁移的干净状态**。
- **D20 = 411 条残差在「P3 写入真实用户之前」清理**（走仓内既有 purge 路径；append-only ⇒ 需临时 `DISABLE TRIGGER USER`）。

**他方提交登记**：`45c27d8`（**Kevin 本人**，2026-09-28 07:55）「fix(i18n): 语言前缀规范化，修连续切语言产生的双重前缀空白页」—— 改 7 文件（`utils.js` / `Header.jsx` / `Footer.jsx` / `App.jsx` / `i18n.js`）+ 新增 371 行单测（引入 `canonicalLangPath` / `buildLangPath` / `getLanguageFromUrl` / `SUPPORTED_LANGS`）⇒ **§5.26 #3 已由 Kevin 自行修复，待独立核验**（`deleg_8b32b558`）。**本条同时说明：本仓有他方提交进入（Kevin 本人或另一会话），交接/验收前必须重跑 `git log` 对锚。**

**派单**：Step 1（Kong）摘运行时 DDL + `DROP` 9 张空表 + 验证「读不再写」；Step 2（Jing）`docs/data-layer.spec.md` **v0.1**（编号域 `DL1…`）。

**并发会话冲突（同日发现并裁定）**：`docs/qa/lang-prefix-normalize.md`（40 KB）与 `docs/qa/lang-shell-regression.md`（2.3 KB）的出具方均为**另一路同样的四角色会话的「Neng」**（后者明写「不采信实现方（Kong）自报」并锁定被检 revision `dbccd89`）⇒ **同一仓库、同一条前端语言路由线上，有两路 Zang 会话在并发工作**（`45c27d8` 与 `dbccd89` 两个提交均出自那一路，作者显示 Kevin）。
**Kevin 裁定（同日）**：**全部归本会话**（请另一会话停手，避免两个会话改同一仓库）；另一会话他本人「只是在看进度」。
**我据此撤回的重复动作**：已 `stop` 我为核 `dbccd89` 而派的重复 Neng 单（`sa-0-2ee6bd12`）—— 那一路的 Neng 已在核同一 revision，重复核验只会在同一 revision 上撞车。
**新的跨会话纪律**：① 本仓**同一时刻只应有一个会话改 `docs/seafood.master-plan.md`**（共享唯一真源）；② 提交一律**只暂存自己改的文件**，永不用 `git add -A`/`.`；③ 交接/验收前**必须重跑 `git log --oneline -3` + `git status --porcelain` 对锚**（本日已两次实测：HEAD 在我会话期间被他方推进 `45c27d8`、`dbccd89`）；④ 引用任何文件时给 **blob sha256**，并在工作区被改动时改用**固定副本**重跑（上一轮核验已因此作废过一组读数）。


### 5.30 **P3 Step 1 验收通过：读不再写，真库回到 == `0012`**（2026-09-28）

**交付**：`backend-ts/src/database.ts` **-302 / +0**（唯一改动的源文件）—— 摘掉 `ensureSupportSchema()` 定义（原 269–534）、孤儿变量 `supportSchemaPromise`（原 :57）与**全部 34 处调用**；无 no-op 空函数、无注释死代码（AGENTS.md 禁死代码）；`tsc --noEmit` exit 0。

**我亲核（不采信报告）**：`git diff --numstat` == `0 302`，且 `backend-ts/src` 下改动文件数**恰 1**；`grep -rc` 两串（`ensureSupportSchema` / `supportSchemaPromise`）计数均 **0**；`curl /health` ⇒ 200 + `schema_version: "0012"`；`lsof` 5788 有监听、**pid 57720 存活 / 旧 45770 已亡**（重载走面板单服务路由 `sid=seafood-api`，零停机；未动 5787、未用 `pm2 restart bistro-ctrl`、未带 `--update-env`）。

**库回归**：**17 → 8 张表**，与 `0012` 目标集**集合逐一相等**（`account, commission_policy, currency, ledger_entry, ledger_owner, referral, schema_migration, users`）；索引 **33 → 24**；`schema_version=0012`、`schema_migration` **12 行**、`users` **411 行**（残差仍在，按 **D20** 待 P3 写真实用户前清）。DROP 前**逐张断言 0 行**（9 张全 0，硬闸未触发），`DROP TABLE IF EXISTS` **无 `CASCADE`**。

**核心断言「读不再写」成立**：修复 + 重载后对**同一批 9 条 GET 打了两轮**，表数恒为 8、`lazy_tables_present=[]` ⇒ **懒表未被读请求重建**（改前同一批 GET **一轮**就造出那 9 张表）。

**九条 GET 仍全 500**（三轮直方图均 `{500:9}`）—— **属预期，不影响本单验收**：根因是 `"uID"` / `"EVM"` 大写引号列名模型（**D18** 数据层重写范围）；本单只负责「不再产生 DDL」。

**更正我 brief 里的错数（留痕）**：我写的「12 处调用」取自**截断的 grep 清单**；**实测 34 处**，Kong 按实测全摘并如实指出 ⇒ **新增纪律：不得把截断的工具输出当作完整事实**（与既有「不信报告，也不信沉默 —— 查盘」同源）。

**新增登记（未处置，交 P3 裁定）**：`ensureLegacyTableNames`（`database.ts:240`，另有 4 处调用 `:1320/:1471/:1500/:1740`）**本单未动未验** —— 它做**条件 RENAME**（`gift→prize_item` / `journey→task_progress`）。⚠️ 懒 DDL 被摘除后它可能已无表可 rename，须与 `ensureSupportSchema` **同族地判去留**。

**入库**：`backend-ts/src/database.ts` + 三个探针（`scripts/p3s1-00-db-state.ts` 只读 / `p3s1-01-get-matrix.ts` 只发 GET / `p3s1-02-drop-lazy-tables.ts` 内置逐张 0 行硬闸，非空 `exit 3` 不 DROP）+ `.p3s1-artifacts/`（run-tagged）+ `docs/audit/`（含全量路由审计 `p3-route-inventory.{json,md}` 55 条 + 人读交付 `p3-step1-ddl-removal.md`）。


### 5.31 **自我更正：v0.35 的「读不再写」下得过宽；第二步 DDL 路径已派 Step 1b**（2026-09-28）

**我上一版的错**：v0.35（§5.30）写「读不再写成立」，但那个结论**只用 `ensureSupportSchema` 一个串的 grep 支撑** —— 我没有先枚举「请求路径上的 schema 变更语句」这一类。同文件里还留着**同族路径**：`ensureLegacyTableNames`（定义 `database.ts:239`，模块级缓存 `legacyTableEnsurePromise` 在 `:57`），体内 `DO $$` 含**两处条件 DDL**：
- `:250-251` `IF to_regclass('public.prize_item') IS NULL AND to_regclass('public.gift') IS NOT NULL THEN ALTER TABLE gift RENAME TO prize_item;`
- `:254-255` `IF to_regclass('public.task_progress') IS NULL AND to_regclass('public.journey') IS NOT NULL THEN ALTER TABLE journey RENAME TO task_progress;`

被 **4 个读方法**调用：`listBrands`(:1046) / `listTasks`(:1197) / `getTask`(:1226) / `getBrandById`(:1466)。

**当前实际影响＝无，但这是数据条件侥幸**：新库里 `gift` / `journey` 都不存在 ⇒ `DO $$` 块**条件空转**。**但这恰恰揭穿了我读数的盲区**：条件空转的 DDL **不改表数**，所以我的验收读数（表数前后不变 == 8）**照样「通过」**。⇒ 用「实例级 grep + 表数不变」证明「读不写」是**假证**。

**处置（已派 Step 1b）**：摘除 `ensureLegacyTableNames` + 孤儿 `legacyTableEnsurePromise` + 4 处调用；改以**类级断言**交付：对 `backend-ts/src/` 全目录扫 `CREATE TABLE|ALTER TABLE|DROP TABLE|RENAME TO|CREATE INDEX|ALTER INDEX|DROP INDEX|TRUNCATE|CREATE [OR REPLACE] FUNCTION|DO $$`，**除迁移执行器外必须 0**，并给全量命中清单与允许集判定；同时重跑「读不再写」读数 + `tsc --noEmit`。

**新增纪律（第 ⑳ 条）**：**「验收通过」必须用类级断言，不得用实例级 grep。** 只按被改的那个符号去 grep，会把**同族的孪生路径**整条漏掉；正确姿势是**先枚举该类**（此处＝「请求路径上的 schema 变更语句全集」），再**对全集断言为 0**。本条与既有的第 ⑭ 条同源：⑭ 说「检查要覆盖**被改**的路径」，⑳ 补「也要覆盖同一类的**其它**路径」。


### 5.32 **P3 数据层规范 v0.1 终审：C1–C9 九项裁定**（2026-09-28）

**Jing 交付**：`docs/data-layer.spec.md` v0.1 —— **845 行 / 17 章 / 139 条 `DL` 规则**（编号 1–139 连续无空洞；`DL140` 未写入，见下）；对审计映射提案 **55/55 逐条表态（采纳 19 · 修正 28 · 驳回 8）**；对 55 条路由本体判定 **保留 11 / 重写 27 / 删除 17**；**kind 扩展请求 = 0 个**（四柱全部业务动作都映射进既有 20 个关闭集）。它单列 **9 项争议**交我终审，其中 `DL117`/`DL130` 定「**P3 开工前必须清零的 5 项 = C1 / C3 / C4 / C5 / C6**」。

**裁定表**：

| # | 裁定 | 理由 / 附加约束 |
|---|---|---|
| **C1** 业务表↔账本事件原子性 | **采纳提案 A：新增「业务编排函数」**（`job_post_event` 等；同一语句内「派生分录 → 调 `ledger_post_event` → 回写引用列」），**不改 `ledger_post_event` 函数体** | 两阶段（应用层事务）正是 **D10 明确避开**的形态，且留可见中间态 + 需对账判据 ⇒ 更贵。**附加四条硬约束**：① **加锁全序定为「业务行 → currency(cid 升序) → account(uid 升序)」且全部编排函数统一**（防死锁），**并借此拍板尚未冻结的 `R79`**（`R79` 现状是「待拍板」且只管 currency→account，须补业务行条款）；② 编排函数**只由迁移创建**，函数体内**禁止**任何 DDL；③ 每次调用**必须**带幂等键并把 `ref_id` 落账本引用列；④ 幂等重放语义**必须**与 `R51`/`R52` 一致（同键同指纹 ⇒ 200 重放，**不**重写业务行） |
| **C2** 命名 | **采纳 `listing` / `listing_order`** + 参数规范名；**并定命名风格**：URL 参数 camelCase（`baseCid`/`jobId`/`orderId`），DB 列 snake_case（`base_cid`） | **决定性理由**：`ledger_ref_type_enum`（`0001`）是**已应用**约束且取值已含 `listing`/`listing_order` ⇒ 改它＝动已应用迁移＝撒谎态，**不可接受**（本册 `DL7` 同判）。风格一条是补本册两处写法不一（§4 与 §12.2） |
| **C3** 后台 12 条边界 | ①`/api/admin/prize/*` **删除** ②`/api/admin/settings/reset` **删除** ③`/api/admin/points/adjust`（#54）**保留但锁死** | ①②同本册倾向（管理员不再发布商品/招工；reset 是无审计的批量破坏写）。③**保留**理由：平台需要一条**受审计**的纠错通道（否则手续费/罚没纠错只能靠迁移）；**锁死条件**：仅 `$`(`cid=1`)、`ops:` 前缀幂等键、必填原因码、**必须**经 `ledger_post_event`（`mint`/`burn`）⇒ **禁止**直接 UPDATE `account`；审计台列 P6 |
| **C4** 401/403 码域 | **采纳**：401/403 由守卫直接返回**非账本域**码 `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`（形状照 `R107`），**不进** `LEDGER_*` | 33 码是**账本域**关闭集；把鉴权失败塞进去会污染既有「码 ↔ bucket ↔ 状态类」契约。**附加**：两个 AUTH 码**必须在册登记**（码名/状态/i18n_key 一张小表），前端错误分支只准按 `code` |
| **C5** 业务状态机非法转移 | **采纳借码**：`LEDGER_CURRENCY_INVALID_TRANSITION`(409, integrity) + `details.field='job.status'` + `reason=JOB_STATE_INVALID` | 借码是本项目**既有机制**（先例：`403⇒input` / `423⇒integrity` 的 bucket 扩展项）⇒ 可用；不借则要么违反 `R105`（409 不该是 400）要么违反 `R107`（裸 409）。**附加**：登记「码名语义窄化」为**已知债** —— 若将来启用专用码（如 `LD034`），**必须一次到位**（正向 + 反向映射 + bucket），**不得**只加正向（⑪ 双向映射纪律） |
| **C6** 业务角色 403 | ⚠️ **修正本册倾向：不用账本码** —— 改用 C4 建立的 `AUTH_FORBIDDEN`(403) + `reason=ACTOR_NOT_ALLOWED` | 「已参与但无该动作权限」**本质是授权失败**，不是账本错误；C4 已把「鉴权/授权」划出账本域 ⇒ 应走**同域**。借 `LEDGER_HOLD_NOT_ALLOWED` 会让账本域被业务授权语义持续侵蚀，而 `HOLD_*` 是**真账本语义**（冻结释放规则），不该挪用。**与 C4 绑定**：两码同域、同形状、同登记表 |
| **C7** 招工审核方 | **采纳本册倾向：雇主审**（`POST /api/job/:jobId/review`，`D5`）；管理员只做**仲裁**（P6 `/api/admin/arbitration/*`）；`/api/tasklist/*` 归**雇主视角** | **驳回审计的「管理员审」**：审计那句是**推断**、无用户原文依据；而 **`D5` 是已冻结口径**（雇主自审 + 平台仲裁兜底），与用户原文「管理员不再发布、转为搭平台/提供服务」不冲突。改 `D5` 成本与收益不成比 |
| **C8** 业务级幂等键 | **采纳：要**（`job`/`listing`/`market_order` 各加 `create_key text UNIQUE` + 状态迁移 `ledger_event_keys text[]`） | 账本侧幂等只保证**分录**不双写，**不保证业务行**不双写（业务行是同键请求的第二个写点）⇒ 必须有业务级键。**附加**：`create_key` 口径与 `R51`/`R52` 指纹一致；**必须**给「同键重放不追加 `ledger_event_keys` 项」的**判负用例** |
| **C9** K 线 | **采纳视图**（`candle_view` 聚合自 `market_trade`） | 避免第二真源（本项目核心教训）；P5 的 AC 要求「与 `market_trade` 对得上账」，视图天然满足。物化视图/落表**仅在性能实测不达标时**再升级，且**须先开 `DL` 规则**（含刷新策略/陈旧度） |

**另两项口径缺口（本册 §7.2「不启用、不请求」）**：`platform_withdraw`（`R103` 悬置）与 `listing_deposit_forfeit`（强制下架罚款，v0.3 已删）⇒ **同意 P3 不启用**；但 `platform_withdraw` 是**产品级**问题（平台收入能否提取）⇒ **不由我代裁，登记待 Kevin 一句话**；`listing_deposit_forfeit` 属 P5，届时若启用**必须**按「20 关闭集扩展」的完整流程（规范 + 迁移 + 码/桶闭环）。

**顺手清掉两条盲区**：
- **B10（平台 `$` 是否 `cid=1`）**：**是**。实测 `currency` cid=1 = `symbol='$'` / `name='平台积分'` / `owner_uid=0` / **`decimals=0`** / `status='listed'` / `total_supply=8400`。⇒ **`$` 是整数分**（与 C2「浮点→整数 cid 维度」一致）。
- **D20 的清理范围要更正（我原来说「411 条用户」，实际更大）**：实测残差 = **`users` 411 行（全部测试，`uid>=949001`，0 平台）** + **`currency` 100 行（99 非平台，其中 85 行 `status='listed'`）** + **`account` 283 行（245 测试 / 38 平台）** + **`ledger_entry` 2145 行**（append-only）+ **`referral` 216 行** + **`commission_policy` 19 行**（种子只该 1 行）。平台账户 `0/-1/-2/-3` 与 `ledger_owner` 4 行**全程只读、完好**。⇒ **清理 = 多表联合谓词**，不是单表删除。

**未采纳本册的一处（留痕）**：**C6 我推翻了本册倾向**（改用 AUTH 域）⇒ 本册 §4/§11 相关格须按 `DL43` **一次全量回写**。

**下一步**：① Jing 出 `data-layer.spec` **v0.2**（回写 C1–C9 裁定 + 补 `DL140` + §14 索引区间改 `DL1..DL140` + AUTH 码登记表）；② `ledger.spec` 需新增 **`R79` 扩展条款**（加锁全序含业务行）并**拍板 `R79`** ⇒ 出 **v0.12**（含快照 + 留痕）；③ 之后方可派 Kong 开工 **P3 第一单**（`DL117` 五项前置清零）。

### 5.33 **两条库级发现 + 一次自我更正（跨 schema 同名表 / 政策表近失）**（2026-09-28）

**① 跨 schema 同名表（真事实；我一度据此误报，已撤回）**：`account` **同时存在于两个 schema** —— `public.account`（**账本账户，7 列**：`uid,cid,balance,frozen,version,time_created,time_updated` ✓）与 **`neon_auth.account`**（含 `password` / `accessToken` / `refreshToken` / `idToken` / `scope` / `providerId` 等 **OAuth 会话列**）。我上一轮**只按 `table_name` 过滤、没加 `table_schema`**，把两个表的列并到一起，据此误报「账本账户表混着 PII 列」⇒ **撤回该误报**：根因是**探针**（缺 schema 限定），不是库。
**处置与登记**：① **新数据层所有 SQL 必须显式限定 schema（`public.`），禁止裸表名**；② `neon_auth` 是本环境**已有** schema（Neon Auth 自身）⇒ **P3 必须明确它与本产品的关系**（是否用 Neon Auth 做登录？若否，登记「存在但未使用」并在新数据层完全绕开）；③ 本条与 `user`/`users` 那次**同族**（**裸名解析**陷阱）⇒ 并入该纪律。

**② 政策表的「差一步」近失（真风险，本次未发生）**：`commission_policy` **19 行** = 种子 1 行（`1970-01-01`，`fee_bp=100`，`levels=10`，权重 `{3000,2000,1500,1000,800,600,…}` ✓ 预期值）+ **18 行测试夹具**（6 批 × 3 行：`fee_bp=500/levels=9`、`fee_bp=100/levels=2`、`fee_bp=100/levels=10`，全 `created_by=0`）。按 `effective_from` 取最新 ⇒ **末行 = `10:56:46.580Z` = `fee_bp=100 / levels=10` = 预期值 ⇒ 当前生效政策是对的**。
**但机制上不安全（登记为 P3 风险）**：测试夹具**直接往生产政策表追加生效版本**，而「生效政策 = 最新 `effective_from`」是运行时约定 ⇒ **任何一条最后落库的测试行都会静默改变全平台费率与层级**（本次**差一步**就是 `fee_bp=500 / levels=9` ⇒ 5% 手续费 + 9 级返佣）。**处置**：① 清理（D20）时把 `commission_policy` **收回到 1 行种子**；② P3 测试策略**不得**向生产政策表追加版本（要么独立命名空间，要么夹具后立即断言末行 == 预期值）；③ 立**回归判据**：任何时刻 `max(effective_from)` 行的 `fee_bp/levels/weights_bp` 必须等于预期组合（当前 `100 / 10 / {3000,2000,1500,1000,800,600,…}`）。

**③ 顺带清一条**：`asset` / `task` 在**任何 schema** 中都不存在（不只 `public`）⇒ 它们是**彻底不存在**，不是「找错 schema」。


### 5.34 **树中止事件（`delegation owner exited`）+ 四处盘面事实**（2026-09-28）

**① 事件与判活**

Hermes 侧回执：`deleg_bbe7d6a0`（Jing · `ledger.spec` v0.12）批次 —— **"The batch did not complete successfully: Delegation owner exited before recording a terminal result; outcome unknown."** 这是**整棵子代理树被中止**的信号（非单子自身失败）。处置定式（**不得据回执重做**）：
- 用 `delegate_task(action='list')` **判活**（判「活在」的**唯一**依据，见派单纪律 12c）⇒ **3 单仍活**：`e9dd1808`（536.9s）/ `d9123482`（473.8s）/ `ea14f60e`（281.1s）；**仅 `bbe7d6a0` 死**。
- 对死单**按盘核产物**，不按「未完成」重派 —— 实测它的读数**完好**（见 ②）。

**② `ledger.spec` v0.12 按盘核后完好 ⇒ 入库 `065e28d`**

| 项 | 读数（我现取） |
|---|---|
| 规则域 | `R1–R109`，定义行 **109 条**，`1..109` **连续、无缺号** |
| 错误码 | §14.1 仍 **33 码**（不新增） |
| R79 拍板 | 「已拍板（Zang · C1 终审」命中 **×9**（§10.1 / §10.3 / §7.2 / §15#6 / §17 等处） |
| 新增节 | §19.16 命中 16 处 |
| 变更记录 | 12 行（v0.1–v0.12） |
| 快照 | `docs/versions/ledger.spec.v0.11.md` 与 HEAD 版 `git show HEAD:… \| cmp -` ⇒ **逐字节相同** |
| 改动规模 | `git diff --numstat` **+106/−14** |
| 内容核对 | **我亲核 R109 五条 + R79 全序，与我 §5.32 的 C1 终审逐条一致** |

**留证分歧**：子代理自检报 `defs: 108`，**我按 `^\|\s*\*\*R(\d+)\*\*` 复核 = 109**（R109 行在位，第 517 行）⇒ **以我的读数为准**。

**③ Step 1b 的真判据已跑出，但缺正对照 ⇒ PASS 暂不采信**

`backend-ts/.p3s1-artifacts/p3s1b-classassert-20260928-123558-repo.json`（101 KB，run tag `20260928-123558`）：
- `request_path`：**8 文件**、`hits_total=0`、`should_be_zero=0`、`bare_code=0`、`allowed_comment=0`
- `assertion = { name: 「请求路径上的『运行期 schema 变更语句』（应为 0 的集）== 0」, expected_zero_set_size: 0, pass: **true** }`
- 全树 **116 文件**、`class_count = 25`（具名 10 类：`CREATE TABLE` / `CREATE INDEX` / `CREATE [OR REPLACE] FUNCTION` / `ALTER TABLE` / `DROP TABLE` / `DROP INDEX` / `TRUNCATE` / `DO $$` / `RENAME TO` / `to_regclass`）
- **同一扫描器在「非请求路径」面报 254 条命中**（`ALTER TABLE` 56 / `DO $$` 21 / `CREATE TABLE` 13 / `CREATE INDEX` 13 / `to_regclass` 9 / `RENAME TO` 6 / `DROP TABLE` 7 / `TRUNCATE` 5 / `CREATE FUNCTION` 53 / `DROP INDEX` 2，落在 `scripts/**` 与 `migrations/**`）⇒ **正则确实会响**（「尺子有灵敏度」的**部分**证据）
- 🔴 **`positive_control = None`** ⇒ **没做**「往请求路径面注入一条已知 DDL ⇒ 必须报出 ⇒ 复原」这一步。按纪律（**无正对照的 0 命中与检测器坏了不可分**），**该 PASS 暂不采信**，已 steer 令其补。
- `docs/audit/p3-step1b-ddl-removal.md` 仍 **13 处 `[待回填]`**（接手单**第二次死在报告**上）⇒ 再证「交付物先落骨架、每段立即落盘」这条纪律的必要性。

**④ 更正一条已失效的「阻塞」记录**：`docs/qa/p2-0012-replay-order.md`（24749 B / sha256 `352192fe…`）**已在盘且已跟踪** ⇒ 前记录里的「**未落盘**」**作废**。

**⑤ `data-layer.spec` v0.2 在制**（`e9dd1808` 活着，mtime 12:40）：
- 现 **910 行**；`DL` 定义 **152 条、1..152 连续无缺号**，而**版本头声明 `DL1…DL153`** ⇒ **`DL153` 声明未落**（139 + 新增 14 = 153 的口径差 1）。
- **§14 规则总索引标题仍写 `DL1..DL139`**（TOC 已是 `DL1..DL153`）—— 正是我派单里点名要改的项。
- ⇒ 两点**待该单收尾**；若它交回时仍未落，由我裁定（补写 `DL153` / 或把声明改回 152）。
- §15 变更记录存在（第 887 行），其表行格式为 `| **v0.1** | …` 而**无 v0.2 行** ⇒ 同待收尾。

**⑥ 新纪律 ㉑：未入库的新文件，改版前必须先入库**

`docs/data-layer.spec.md` v0.1 **从未入库**，v0.2 就地覆盖 ⇒ 快照 `docs/versions/data-layer.spec.v0.1.md` 成为 **v0.1 的唯一副本**，其**真伪不可独立复核**（没有任何可比对的基线与它 `cmp`）。同批的 `ledger.spec` 因 v0.11 早已入库，快照可与 `git show HEAD:docs/ledger.spec.md | cmp -` 逐字节校验 ⇒ **两册待遇不同、证据强度也不同**。⇒ 派「就地改版」类单前，**先把待改文件入库**（或至少落一份**可比对**的副本 + 哈希台账）。

### 5.35 **P3 Step 1b 验收通过**（接手单补完；**取代 §5.34 ③ 的「暂不采信」**）（2026-09-28）

> **取代关系**：§5.34 ③ 记的是「真判据已跑出但 `positive_control = None` ⇒ 按纪律**暂不采信**」。该缺口已由接手单 `deleg_ea14f60e` 补齐，本节给读数并**取代**该结论；**§5.34 ③ 原文保留不动**（留痕，不静默重写）。

**① 真判据（类级断言）**

| 面 | 读数 |
|---|---|
| 扫描面 | 全树 **116 文件**；**25 类**模式（具名 10 类：`CREATE TABLE` / `CREATE INDEX` / `CREATE OR REPLACE FUNCTION` / `ALTER TABLE` / `DROP TABLE` / `DROP INDEX` / `TRUNCATE` / `DO $$` / `RENAME TO` / `to_regclass`） |
| 请求路径 | 8 文件、`hits_total=0`、`should_be_zero=0`、`bare_code=0`、`allowed_comment=0` |
| 断言 | `{ expected_zero_set_size: 0, pass: **true** }` |
| 非请求路径 | 254 命中 / 108 文件（`scripts/**` + `migrations/**`，**允许集**） |

**② 尺子灵敏度（正对照）—— 上轮唯一缺口，已补**

夹具在 **scratch 副本**（`scratch/step1b-takeover/probe-copy/`，由 `cp -R src/.` 得来、交付前 sha256 双向核对）：

| 注入 | 类 | 结果 |
|---|---|---|
| `ALTER TABLE foo_old RENAME TO foo_new;` | C04 + C09 | **报出**（`:6:21` / `:6:41`） |
| `CREATE TABLE probe_tbl (id int);` | C01 | **报出**（`:7:21`） |
| `to_regclass('public.gift')` | C10 | **报出**（`:8:28`） |
| `DROP INDEX IF EXISTS probe_idx;` | C06 | **报出**（`:9:21`） |
| `// 注释行内的 DDL … ALTER TABLE … RENAME TO` | C04 + C09 | **正确归入允许集**（`state=comment`） |

⇒ 副本扫描 `should_be_zero=5`、**`assertion.pass=false`（退出码 3）** ——「对注入过的东西断言应为 0」**判 FAIL**，**这正是尺子会响的证据**（正对照的 FAIL 是**预期形态**，不是缺陷）。注入物**只在 scratch**；我复核 `backend-ts/src/__p3s1b_probe_injected.ts` **不存在**、`find src -name '*probe*' -o -name '*injected*'` **零命中**。

**③ 不过宽的反证**：未加词界的 `TRUNCATE` 在 `src/commission.ts` 假命中 **8** 条（全是标识符 `chain_truncated` 一族）⇒ 扫描器用 `(?<![\w.])TRUNCATE\b` **排除** ⇒ **8 → 0**（**既不漏报、也不过宽**）。

**④ 类型检查**：`npx tsc --noEmit`（`src/` 窄口径）**exit 0**；`tsconfig.scripts.json` 口径 **exit 2**（9 错，**预存在残差**，如实登记、未顺手修）；`not_measured.full_repo_typecheck` 明写「**只跑了窄口径**」。

**⑤ 运行时与 catalog**：面板单服务路由重载 `seafood-api` ⇒ pid **74889 → 60022**（面板回读 60008 = spawn 壳、实际 LISTEN = 60022，已按实际记）、`/health` **200 + `schema_version 0012`**；catalog pre/mid/post **我独立逐项复核 32 字段** ⇒ **除 `label` / `ts` / `pg_stat_database.xact_commit` / `xact_rollback` 四个元字段外，其余 28 项完全一致**（后两者是**数据库级全局计数器**、被外部会话推高 ⇒ **不构成差异、不判负**）；GET 矩阵两轮 9 条全 500、表数恒 8。**报告逐字声明**：「表数不变对『条件空转的 DDL』是**盲的**…故本节只记『未发现回归』，**真正的判据是 class_assertion**」；`not_measured.read_no_longer_writes__runtime_proof` = **NOT_MEASURED**。

**⑥ 两处口径更正（我复核时发现，结论不变）**：
1. 报告「catalog 前后逐项无差异」的**准确口径**应为「**除 4 个元字段外逐项一致**」—— 措辞不得升级（同 §17i）。
2. 报告里 `待回填` 字样出现 2 次属**元叙述**（描述骨架已被替换）；**字面 `[待回填]` 标记 = 0**（与它自报一致）。

**⑦ 入库**：`docs/audit/p3-step1b-ddl-removal.md`（220 行）+ `backend-ts/scripts/p3s1b-01-class-assert-runtime-ddl.ts`（234 行）+ 6 份 run-tagged 读数 + 汇总件 `p3s1b-20260928-123558.json`。

**⇒ Step 1b 验收通过。D19（先修码再 DROP、库回到 == `0012`）至此全链闭合：两条运行时 DDL 路径（`ensureSupportSchema` / `ensureLegacyTableNames`）均已摘除，且以类级断言证明「请求路径上的运行期 schema 变更语句 = 0」。**

### 5.36 **P3 数据层规范 v0.2 验盘入库 + 聚焦复核立项**（2026-09-28）

**① 交回与验盘（我亲核，不采信自述）**

`deleg_e9dd1808`（Jing）把 `docs/data-layer.spec.md` 由 v0.1 推到 **v0.2**，并落 v0.1 快照。我按盘核：

| 面 | v0.2 现值 | v0.1 快照 |
|---|---|---|
| 规模 | **210787 B / 971 行** / md5 `cfeae444d0633591c17b7271ee549a24` | 156970 B / 846 行 / md5 `6f89f444d5df0351e84bdfce9621e3b1` |
| `DL` 编号 | **153 条、1..153 连续、无缺号、无重复** | **139 条、1..139 连续**（⇒ **内容确为 v0.1 真身**） |
| 版本头 | **v0.2**（声明 `DL1…DL153`） | **v0.1（首版）** |
| `[待回填]` | **0** | — |
| §14 索引标题 | **`DL1..DL153`**（TOC 与标题一致；派单中点名的必改项） | — |
| §15 变更记录 | **v0.1 + v0.2 两行** | — |
| C1–C9 落地标记 | `AUTH_UNAUTHORIZED` 10 · `AUTH_FORBIDDEN` 36 · `listing` 144 · `listing_order` 24 · **雇主审** 8 · `create_key` 23 · `视图` 25 · `K 线` 4 · `prize` 45 · `settings/reset` 8 · `platform_withdraw` 10 · `listing_deposit_forfeit` 6 · `neon_auth` 13 · `public.` 7 · `commission_policy` 22 · **`v0.1 旧写法` 留痕 26** | — |

⇒ **`139 + 14 = 153` 口径自洽；快照内部一致性成立**。**但字节级保真仍不可独立复核**（v0.1 从未入库 ⇒ 无基线可比）—— 这正是**纪律 ㉑** 的既成代价，本次按「内部一致性 + 与 v0.2 口径自洽」收下，**不表述为「逐字节可验」**。

**② 入库 `4ad0de4`**（2 文件 / **+1815**：`docs/data-layer.spec.md` + `docs/versions/data-layer.spec.v0.1.md`）。

**③ 聚焦复核已派（`deleg_d25d3c27`，Neng）** —— 在 P3 实现开工前设一道门：只审「九项裁定 C1–C9 是否被**忠实回写**」＋ 三项附带（`DL140` 措辞 / 两条库级事实 / 两项「不启用」不得写成已启用）＋ **编号纪律抽 5 条对拍**（原条文未被删改、只就地附加）＋ **判负自证**（改一字的 scratch 副本必须报红）。**不做 153 条全文重审、不改被检文件**。交付 `docs/qa/data-layer.spec-v02-review.md`。

**④ 第四条误报回执（`ea14f60e`）已证伪**：回执贴的 transcript 尾巴停在 **12:36–12:37**（**陈旧片段**），而该单**早已结束且已被我验收入库 `4ca6988`**；我用 sha256 对拍确认**入库后零改动**（报告 `a9818c1e33f7d0d035ea93428705392bb42cde2bd6c4497438f4770f28b409df` 与 `git show HEAD:` **两侧一致**）。⇒ 这类 `owner exited` 回执**已连续 4 次误报**；处置定式＝`action='list'` 判活 ＋ 按盘核 ＋ **sha 对拍确认无并发写**（技能 `subagent-dispatch-discipline` 已记）。

### 5.37 **`deleg_bbe7d6a0` 补交完成回执 —— 「死单」定性更正为「回执迟到」**（2026-09-28）

**① 事实**：`deleg_bbe7d6a0`（Jing，`ledger.spec` v0.12）在早前那条 `Delegation owner exited…outcome unknown` 之后约 **8 分钟**，才送来真正的 `status=completed / api_calls=47 / 501.72s` 回执 ⇒ **它不是死单**；§5.34 ①「仅 `bbe7d6a0` 死」的定性**更正为「回执迟到」**（§5.34 原文保留留痕）。

**② 逐项对拍（自报 vs 我独立复核）—— 全部一致**：

| 项 | 自报 | 我复核 | 判 |
|---|---|---|---|
| `md5` | `8ffb5fd5b711731ea65c317f18ec0f0d` | **同** | ✅ |
| `sha256` | `cac649e6…b9002` | **同**，且 == `git show HEAD:`（**工作树零增量写**） | ✅ |
| `lines_total` | 2011 | `wc -l` **2010** / NL+1 **2011** | ✅ **同一文件两种口径** |
| 快照 v0.11 | sha256 `473b87fe…` / 1918 行 | **同** | ✅ |
| `R` 定义 | 109 | **109 条、1..109 连续无缺号** | ✅ |

⇒ **`065e28d` 入库的就是它的终版**；当时「按盘核后直接入库」的动作**正确**（既没白等、也没重复劳动）。

**③ 探针陷阱（本轮第三次同型，已入技能）**：用 `^\|\s*\d+\s*\|\s*\`(LEDGER_[A-Z_]+)\`\s*\|\s*\`(\d+)\`` 数 §14.1 ⇒ **32**；换成**不假设列格式**的宽式（只数编号行）⇒ **33 行、1..33 连续、33 个 distinct 码名** ⇒ 前轮「§14.1 仍 **33** 码」**成立**，错的是**探针**（有一行 HTTP 列是 `—`，被严格式**默默跳过**）。文档级旁证自洽：v0.9 备注「§14.1 仍 33 码」、`33 个自有码（LD001..LD033）`、`roundtrip_mismatches 32（共 33 码）`；`LD000`/`LD034` 是**域外输入探针**、非码。**纪律（第三次同型后固化）：先用宽式数总量，再用严格式取明细；探针读数异常先怀疑探针。**

### 5.38 **`deleg_e9dd1808` 真回执（TRUNCATED 但盘面完整）+ 两项待裁项裁定**（2026-09-28）

**① 回执**：`status=completed / api_calls=60 / 764.31s`，**自标 TRUNCATED（hit max_iterations，work may be incomplete）** ⇒ 按「**盘面优先**」逐项核，目标物**全部在盘且已验**（见 §5.36 ①）：`DL` 153 条 / **§11.3 AUTH 域码登记表** / `DL140` / `DL147` / `DL151` / `DL152` / §17.1 / §17.2 / v0.1 快照（156970 B / md5 `6f89f444…`，与自报一致）；结构宽式复核 = **一级节 19（含「目录」）/ 二级节 48** ⇒ 与自报 `sections: 18` 吻合（不含目录）；`lines_total` 自报 **970 = `wc -l` 口径**（我报 971 = NL+1 口径，同 §5.37 体例）。⇒ **采信盘面**；它**唯一**做不了的事是 `R109` 交叉引用（见 ③）。

**② 两项待裁项裁定**（它抛给我的，在此定口径）：

| 项 | 它的登记 | **我的裁定** |
|---|---|---|
| **§12.2-12 政策表费率列名** | 裁定原文与 §5.33 写 `fee_bp`；库内实列名 = `fee_rate_bp`（v0.2 只读实测） | **以库内实列名 `fee_rate_bp` 为准**。铁证＝仓内迁移 `0007`：`:11` / `:86` / `:92` / `:161` **逐处皆 `fee_rate_bp`、全文无 `fee_bp`**；`§5.20 #3` 亦作 `fee_rate_bp` ⇒ **`fee_bp` 是简写/笔误，不得出现在任何判据里**；**`DL152` 按 `fee_rate_bp` 写 = 正确，不改**。旧正文**保留留痕**（同 §5.37 体例，不静默重写）。 |
| **§12.2-11 `neon_auth` 与本产品的关系** | 本册倾向「不用」，待 Zang 终审 | **裁定：不启用 Neon Auth**。登录 = **EVM 钱包签名（`challenge` / `verify`）+ `users.uid` / `evm`**（`DL107`）；`neon_auth`（9 张表）**物理存在但不属本仓** ⇒ 新数据层**必须显式限定 `public.`、完全绕开**（`DL151`），登记「**存在但未使用**」；并**保留**「`neon_auth.user` 与 `public.users` 近名」属**硬 1（裸 `user` ⇒ `current_user`）同族**的警示。若将来启用 Neon Auth ⇒ **须另立规范**（不得就地开口）。 |

**③ 待办（低优先，不单开一单）**：`ledger.spec` v0.12 的 **`R109` / `R79`** 已在盘（`065e28d`），但 `data-layer.spec` v0.2 里 **`R109` 交叉引用 = 0 处**（`R79` = 2 处）⇒ 待 **`deleg_d25d3c27` 复核交回后**，随**下一次 spec 修订**一并回加。**当下不改**：该文件正被复核单以 md5 `cfeae444d0633591c17b7271ee549a24` **钉住**，中途改会作废其锚。

**④ `§13.2` 只读探针驱动级失败**（`@neondatabase/serverless` HTTP 驱动在快速连续调用下 `fetch failed`）⇒ 已按「**同一轮内成功返回者为准**」处理（P1/P2 有效读数取自成轮次；P3–P7 各有一次成功读数），**登记为驱动不稳定性**，不影响结论。

### 5.39 **`dbccd89` 语言壳质检收口 + 两份并行质检报告归档**（2026-09-28）

**① 我的核验单**（`deleg_d9123482` 主跑 + `deleg_43a4eeea` 收尾）：`docs/qa/lang-shell-dbccd89-verify.md` **249 行 / sha256 `d85299153085e7e1297ea29bedd95f3826cd8fa0cb76ce787241435ae1c1a62c`**；§7 由收尾单补写（**verdict = 有条件可验收**，理由指到 §3–§6；**10 条未验证枚举到边界**）。**我的独立核**：占位 `（待定）`/`（待填）` = **0**；**全部章标题行号与 238 行版逐行号相同**（§0=10 · §1=26 · §2=39 · §3=74 · §4=100 · §4.1=104 · §4.2=117 · §4.3=134 · §5=151 · §6=178 · §6.1=184 · §6.2=208 · §6.3=218 · §7=232）⇒ **用行号锚证明「其余 232 行未动」**（它自报「该文件未跟踪 ⇒ `git diff` 不能证明未动他行」，该缺口由我补上）。

**② 结论**：`dbccd89` 的核心缺陷（拆显式语言壳 / 修中文子页被可选语言段吞掉）**已确证修好** —— §3 三例「四者一致」（URL 规范化 + `htmlLang=zh-CN` + zh 标题 + 正文非首页）＋ 反向 6 例 ＋ Footer 链（含 search/hash 保真）；§4.1 四语根路径逐字全等（含全角 `｜`）/ §4.2 脏前缀自愈 **7/7**（含重复斜杠折叠）/ §4.3 无前缀 **5/5** 零误伤；§5 单测 **9 文件 61 例**，失败集合与同源基线**逐条同 ∅**；§6 **两轮变异负控**（改坏 `getLanguageFromUrl` ⇒ 17 红；关掉折叠 ⇒ 恰好 3 红，全是本提交新增判据）+ **逐字节恢复**（sha256 三方一致 / `cmp` 一致 / `NEGATIVE-CONTROL` 残留 0 / 回绿 `EXIT=0` / 主工作区零污染）。**唯一未闭合 = reward/task 子页终态正文 marker**，成因＝**他方** `/api/prize/all` 返回 500（间歇性）⇒ **不属本提交缺陷**。

**③ 条件（我裁定）**：① 后端 500 恢复后**可选补验** reward/task 终态 marker（**不阻塞**放行）；② 10 条未验证随报告归档，其中 **⑤**（结论只覆盖 frontend 的 `dbccd89` 版 ⇒ **≠ HEAD 整体可发布**）、**⑥**（`vite build` / dist / 生产路径 / 非 headless 未验）、**⑦**（`App.jsx` / `Footer.jsx` 未做变异负控）**属发布前必办** ⇒ 并入 **P7 部署清单**。

**④ 两份并行质检报告归档**（他方会话产出，我核后入库）：

| 文件 | 规模 | 被检 | verdict | 要点 |
|---|---|---|---|---|
| `docs/qa/lang-shell-regression.md` | **717 行 / 51 KB** | `dbccd89`（对锚 `073c683`，独立 worktree `:5812`） | **PASS（带条件）** | 8+ 项判定表全 PASS：对锚 blob 5/5、改动面恰 5 文件、**真指针 hover 语言菜单 8/8 违规 0**、query/hash 保真、Footer 链 3/3、无前缀 5 例未误伤；自带「**下表任一文件 sha256 再变即本结论自动失效**」条款；末尾登记已清 131 MB `chrome-profile/` 与两个临时 worktree |
| `docs/qa/lang-prefix-normalize.md` | **566 行 / 40 KB** | `45c27d8`（对锚 `969f4bd`） | **可通过验收（PASS，带条件）** | 9 项主判据全绿；**条件② 明写「路由壳重构完成后，『真浏览器 A/C 段』『NEG-1 防御层负控』『`lang-path-redirect.test.jsx` 14 条』三块必须回归复检，不可直接沿用」** |

**⇒ 两份报告互锁闭合**：`45c27d8` 那份**立下条件**（路由壳重构后必须回归复检），而 `dbccd89` **正是那次重构**，该条件**恰好由 ①② 那份报告兑现**（四语 / 自愈 / 无前缀三段 + `lang-path-redirect` 15+8 例全绿）⇒ **条件已闭合，无需再派回归单**。

**⑤ 弃用骨架（不清、不删、登记）**：`docs/qa/45c27d8-lang-path.md`（**46 行**）是同一 revision 的**先落骨架**件，其承诺的 `docs/qa/45c27d8-lang-path-readings-<run>.json` **盘上不存在**（`find` 零命中），且同 revision 已有 ④ 的完整报告 ⇒ 按「**骨架不入库**」不入库、**也不删除**（他人产物）⇒ **待 Kevin 一句话决定归档或删除**。

### 5.40 **v0.2 聚焦复核交回：verdict「需修」（M1–M5 全低危）+ 我裁定 M3/O1 + 派 v0.3 小修**（2026-09-28）

**① 复核结论**（`deleg_d25d3c27`；报告 `docs/qa/data-layer.spec-v02-review.md` **161 行 / 33158 B / 占位 0**）

- **verdict = `需修`（5 项，全部低危，不推翻任何一项裁定）**。判据：**C1–C9 七项「忠实」/ 两项「部分」**（C4 缺 `i18n_key` 具体串；C8 的 `ledger_event_keys` 在 §6 列清单与 `DL64`/`DL75` 之间自相矛盾）；**附带三项 2 忠实 / 1 部分**（`DL152` 事实段 `policy_id` 自相矛盾 + 证据指针失效）；**编号纪律：编号层忠实**（只增不重排 / 139 个号一个未失 / 无重号 / §14 区间与 §15 两行正确）、**留痕层为节录式**（**20/139** 条旧正文非逐字保留）。
- **判负自证（尺子会响，三种变造）**：改 1 汉字 ⇒ 报出（`DL111` 的 `lcs_len` **348 → 174**、保留度 **0.742 → 0.371**）；删 `DL66` 整行 ⇒ 报出（**153 → 152** / `contiguous=false` / `missing=[66]` / `old_set_subset_of_new=false`）；同输入复跑**逐字节相同**（`identical=true` ⇒ 无噪声）。**它主动指出：1 字级改动不翻转任何布尔断言 ⇒ 灵敏度来自数值保留度读数**（「0 命中 ≠ 检测器好」的正面例证，值得记一笔）。
- 被检件 md5 三次运行前后均 `cfeae444…` ⇒ **复核零改写** ✓；它同时诚实登记**基线漂移**（HEAD 中途被他方推到 `91dcc02`，逐字对拍确认 §5.32/§5.33 正文未变、行号仍 **706/734**）。

**② M3 我亲裁（只读库取证，`public.` 限定）** —— run-tagged 件 `m3-arbitrate-20260928045335.json`：

| 读数 | 实测 |
|---|---|
| 行数 / id 范围 | **19 行** / `min=1` · `max=37` / 无重号 |
| **id 全集** | **`1` + `20..37`（共 19）** |
| 末行（`max(effective_from)`） | `policy_id=**37**` / `fee_rate_bp=100` / `levels=10` / `weights_bp={3000,2000,1500,1000,800,600,500,300,200,100}` / `created_by=0` / `effective_from=2026-09-27 10:56:46.580869+00` ⇒ **等于预期组合** ✓ |
| 附赠类型事实 | **`weights_bp` 是 `smallint[]`**（探针按 `int[]` 比 ⇒ `operator does not exist: smallint[] = integer[]`；**探针错非库错**） |

**裁定**：`DL152` 的**「18 行夹具 `policy_id` 2–19」为错** ⇒ 改为 **`20–37`**；**其余（19 行 / 种子 `policy_id=1` / 末行 `policy_id=37` / 末行三值 = 预期组合）全部成立**；**补证据指针**（本 run-tagged 件）以关闭「`§13.2` 无 `commission_policy` 读数 ⇒ 一手依据不可追溯」；**并把 `weights_bp smallint[]` 写进 spec**（判据脚本按 `int[]` 比会直接报错）。

**③ O1 我定性（同一路由两形态并存）**：`§4.1 #32/#33`（**路径形** `GET /api/market/:baseCid/orderbook`）vs `§10.1 #32/#33`（**query 形** `GET /api/market/orderbook?base_cid=&quote_cid=`）。**裁定：以路径形为唯一权威形态** —— 依据＝**实存路由就是路径形**（审计期一个 `GET /api/market/1/orderbook` 曾触发懒 DDL 把真库 8 → 17 张），且与 **C2「路径参数 camelCase」**一致；**query 形登记为 v0.1 旧写法、废弃**；将来若需**非 `$` 计价对**，走**路径双段扩展**（`/api/market/:baseCid/:quoteCid/orderbook`），**不得复活 query 形**；`DL145③`（query 键命名）**保持不动**，仅对真正带 query 的路由适用。

**④ 已派 v0.3 小修（Jing）**：范围＝ **M1–M5 ＋ `R109` 交叉引用（§5.38③ 解禁）＋ 关闭 `§12.2-11/-12`（记录我两条裁定）＋ O1 定性落位**；**不得**改动 C1–C9 实体口径、**不得**重排编号。**M5 我从轻裁定**：只做「**明写节录 ＋ 指向 v0.1 快照（已入库 `4ad0de4`）作原文出处**」，**不要求 20 条全文回贴** —— 理由＝**快照在库 ⇒ 原文随时可取，「原文照录」边际价值低**；「对 C1–C9 直接命中条文改原文照录」列为**可选加强项（不阻塞 P3 开工）**。

### 5.41 **`data-layer.spec` v0.3 交付并验收通过 ⇒ P3 数据层实现的规范门禁解除**（2026-09-28）

**① 交付物**（`deleg_8192d993`，25 calls / 285s）
- `docs/data-layer.spec.md` **v0.3** = **220752 B / 983 行（`wc -l`）/ md5 `0a8e228dcbc1dcb517a378ca46dee79c`**
- `docs/versions/data-layer.spec.v0.2.md` = 210787 B / md5 `cfeae444…`，**`git show 4ad0de4:… | cmp -` ⇒ exit 0**（**我独立复核过两次**）⇒ **v0.2 快照可独立复核**（纪律㉑ 之痛不复现）
- `docs/audit/p3-data-layer-v03.md` = 187 行 / 19264 B（先 12 行骨架 → 逐项回填）

**② 八项落位（我逐项核过）**

| 项 | 落点（v0.3 现取） | 我的核 |
|---|---|---|
| **M1** | §6.3 `listing` L413 / §6.4 `market_order` L432 各补 `ledger_event_keys text[] NOT NULL DEFAULT '{}'`；`create_key` 全文统一 | `ledger_event_keys` **21→24**；`text NOT NULL UNIQUE` **19** 处；残留 `create_key UNIQUE` **仅 1 处**（`DL75` 旧写法说明文内，与自报一致）；`DL64`「已定案」与 `DL75` 三件套**不再矛盾** |
| **M2** | §11.2 L710–714 + `DL119` L698 统一 **`JOB_STATE_INVALID`** | 大写 **13** 处 / 小写 `job_state_transition_invalid` **仅 2 处留痕**（并明写「不得用」） |
| **M3** | `DL152` L975：`2–19` → **`20–37`** + 证据指针 + **`weights_bp smallint[]`** | `20–37` 3 处 / `smallint[]` 5 处 / `m3-arbitrate` 2 处 ✓；残留 `2–19` 2 处**在留痕与说明文内** |
| **M4** | §11.3.1 L754 增 `i18n_key` 具体值 = `auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN` | 前端 **确无** `auth.err.` 键（grep 0 命中）⇒「**需新增键**」登记成立；命名依据＝仓内唯一既有规律 `backend-ts/src/ledger-errors.ts:219` 的 `` `ledger.err.${code}` `` ⇒ **同构**（非发明） |
| **M5** | 新增 **`DL154`** L943：明写「留痕为**节录式**、原文出处 = `docs/versions/data-layer.spec.v0.1.md`（已入库）」 | `节录` 8 处；**新增仅 `DL154`** ⇒ 只增不重排 ✓ |
| **R109** | `DL141`–`DL144` L141–144 补 `R109`（`DL141` 兼补 `R79`） | `R109` **0 → 9**（自报 8 行）/ `R79` **2 → 6**（自报 4 行）⇒ 口径差（次数 vs 行数）不判负 |
| **§12.2-11/-12** | L813 / L814 记录我两条裁定（不启用 Neon Auth＝登录走 EVM 钱包签名、`neon_auth` 9 表须限定 `public.` 绕开；费率列名以 `fee_rate_bp` 为准、`fee_bp` 不得进判据） | ✓ |
| **O1** | 新增注 L676；§10.1 #32/#33 L651/652 改**路径形唯一权威**、query 形登记 v0.1 旧写法废弃、非 `$` 计价对走路径双段 | ✓；**`DL145③` 未动** ✓ |

**③ 结构自证**：DL **154 条、`1..154` 连续、缺号 `[]`、重复 0**；占位 `[待回填]/（待填）/（待定）` = **0/0/0**；§14 标题 `DL1..DL154`；§15 **3 行**（v0.1/v0.2/v0.3）；`git diff --numstat` = **`57 44`**（只涉该写文件）。

**④ 零内容丢失 —— 含我一次自我更正（㉒ 加固）**：我首轮用 `grep -c`（**数行**）去比上一轮 `python .count()`（**数次**）⇒ **混口径误报**「`视图 25→10`、`雇主审 8→7`、`platform_withdraw 10→8`」；同口径复核 ⇒ **三处逐值相同（25/8/10/6）**，且**「v0.2 含该关键词而 v0.3 整行不存在」的行数 = 0**（`视图`/`雇主审`/`platform_withdraw`/`listing_deposit_forfeit` 各 0 行）⇒ **零行丢失**。**教训：跨版本/跨件比较计数，两侧必须同一口径同一命令；核「内容零丢失」的正解是按行做集合差，而非比总数。**（审计报告那 1 处「占位」命中亦为**元叙述**＝第 147 行统计表本身。）

**⑤ 未做项（它如实声明，我采信）**：未连库（M3 四项事实**转引我的 run-tagged 件**，本单未独立复核）；未做 20 条「原文照录」（M5 从轻 ⇒ **可选加强项，不阻塞 P3**）；`i18n_key` **前端落地未做**（⇒ 登记为前端待办：四语 locale 需新增 `auth.err.*` 键）；未审 154 条全文一致性（范围限定为派单 8 项）。

**⑥ 裁定：v0.3 验收通过 ⇒ P3 数据层实现的规范门禁解除。** 下一步＝派 Kong 实现柱：**`0013` 招工 / `0014` 商品 / `0015` 交易所**三个迁移（含 `job_post_event` / `listing_post_event` / `market_post_event` 编排函数）+ 四柱业务链；硬约束＝全量落 `public.`（`DL151`）、零运行时 DDL（`DL140` 类级断言须复跑仍绿）、`R79`/`DL141` 加锁入口唯一且全序一致、`create_key` 幂等键（`DL50`/`DL59`/`DL64`）、编排函数只由迁移创建且体内禁 DDL（`DL142`）；`0001`–`0012` **冻结不得改**（`DL7`）。

**⑦ 留证一条**：`d9123482` 迟到回执**自报 verdict「可验收」（无附加条件）**，与其 §7 收尾单按全量证据给出的「**有条件**可验收 + 10 条未验证」**分歧** ⇒ **以 §7 为准**（§5.39 已记）。

### 5.42 **P3 第一柱（招工）`0013` 交付并验收通过 + 迁移编号一次性重排裁定**（2026-09-28）

**① 交付物**（`deleg_d48f4ac0`，57 calls / 792s；已入库 **`9080772`**，18 文件 / +9935）
- `backend-ts/migrations/**0013_job.sql**`（**原名 `0013_job_core.sql`，我按内容改名为 spec §6.1 的权威名**；817 行（`wc -l`；自报 818 = NL+1 **口径差**）/ 44130 B / sha256 `720c89e4a9367d562fa1085f1fb8b139d5a4374be095fec4893a0e9db818c230`）
- 探针 4 件（`scripts/p3j-*.ts`）+ **10 个 run-tagged 读数**（`.p3j-artifacts/`，无同名覆写）+ 类级断言产物 + 报告 `docs/audit/p3-job-0013.md`（153 行 / 占位 0 / `NOT_MEASURED` **3**）

**② 我的独立核（不采信自述）**

| 核 | 读数 |
|---|---|
| **`ledger_post_event` 未被改**（DL142 铁证） | `prosrc` = **45598 B / md5 `d94dd902697dfe60aba409d808c6d63a`** —— 与 `0012` 后**逐值一致** |
| 库态 | `max(version)=**0013**` / `schema_migration` **13 行** / `public` 表 **9**（+`job`）/ `job` **14 列** / 索引 **5**（3 必建 + PK + uniq）/ 约束 **18** / 触发器 **5 个全 `tgenabled='O'`** / `public.job*` 函数 **8** |
| **我亲自重跑 `migrate.ts`** | **`MIGRATE_EXIT=0` + 13/13 `skipped` + `public_base_table_count=9`** ⇒ DB 内 `0013` checksum == 现盘文件（**无 drift**）；`scripts/migrate.ts:45` 证实 checksum = `sha256(sql 内容)` ⇒ **我改文件名前后库态零漂移**（改名后复跑仍 13 skipped） |
| 列契约对拍 | `DL50`（12 项）+ §6.2 模型草图的 `title`/`description` = **14 列逐项一致，零自创列名** |
| 触发器对拍 | `DL52` 三条守卫（`job_status_guard` / `job_ledger_ref_guard` / `job_core_immutable_guard`）**全在** + `job_touch_time_updated`（DL75③）+ `job_no_delete`（DL79） |
| DL142 函数体禁 DDL | **8 个体全 0 命中**（词界版；先前 `create` 命中系 `time_created` **假命中**） |
| DL151 | 建表/索引/触发器全 `public.` 限定；函数体内**未限定表引用 = 0** |
| 类级断言 | `request_path.hits_total=0` / `assertion.pass=true` / `class_count=25` / 扫 **121** 文件（migration 落 non-request 允许集） |
| 冻结件 | `0001`–`0012` 与 `src/` **零改动** |
| 判负自证 | **6/6**（`TAMPER-A` 重放追加 `ledger_event_keys` ⇒ 红；`TAMPER-E` 状态机闸不给重放让路 ⇒ 红；两次 pristine 重装回绿 + 工作区 sha256 前后相等） |

**③ 裁定一：迁移编号表一次性重排（依 `DL47`）。** spec §6.1 把 `0013` 定为三表（`job` + `job_application` + `job_submission`），而实交付为 **`0013` = `job` 单表**（**我的 brief 只点了 `job` ⇒ 偏差在我**），两表顺延。**裁定**：`0013` **保持已应用不动**（改已应用迁移 = 越 `DL7`/`R77` 红线）；`job_application` / `job_submission` 落 **`0014_job_flow.sql`**（同柱「一迁一主题」`DL46`），四柱**顺延一位** ⇒ **`0015_listing.sql` / `0016_market.sql` / `0017_platform_config.sql`**（原 `0017`「不提案」行顺延为 `0018`）。**此重排一次性定死，此后编号不得再动**（`DL47` 原话）。⇒ 已派 **Jing 出 v0.4** 落 §6.1（含 v0.3 快照，`cmp` 可核）。

**④ 裁定二：`DL52①` 的 `23514` 与 `DL51` 的 C5 冲突 ⇒ 实现为准、spec 修措辞。** 实现走 `ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION')` ⇒ `LD011` ⇒ **409** + `reason=JOB_STATE_INVALID`，**与 `DL51` 逐字一致**（`DL51` 明写「C5 已裁：借 `LEDGER_CURRENCY_INVALID_TRANSITION`」）⇒ **无实现缺陷**；冲突源是 `DL52①` 的 **v0.1 旧写法**残留 ⇒ 由 Jing **就地标注**（不删原文）。

**⑤ 裁定三：`refund` 无专用 txid 列（自证靠 `ledger_event_keys`）** = 与 `DL50` 字面一致 ⇒ **接受**；`hold_forfeit` 未启用 = 与 `DL91` 一致 ✓。

**⑥ 裁定四（登记项，不阻塞）**：`src/db.ts#getSchemaVersion` 的 `SELECT version FROM schema_migration …` **未限定 `public.`**（与 `DL151` 字面口径不一致，属**既有代码**）⇒ 登记为「**下一接路由的单**一并收紧为 `max(version) FROM public.schema_migration`」。

**⑦ 它的诚实项（加分）**：主动声明「拿掉 `create_key` 读取**不会**让用例变红 —— 创建路径另有 `ON CONFLICT DO NOTHING` + 重读兜底，两道闸互为冗余（**纵深防御**），故不作为『尺子响』的证据」；并如实登记「并发 **publish** 未实测」「HTTP `/health` 未打（本单禁起常驻 server）」；3 次 `migrate-apply` 中**前 3 次 `ok:false`**（`42601` 两次修语法、一次 plpgsql 标识符大小写）**如实留痕**在盘。

**⑧ 库侧副作用（不清理，`D20` 统一）**：探针新增测试 `users` 411→**418** / `account` 245→**298** / `ledger_entry` 2145→**2271** / `job` **19** 行；供资走残差夹具 `transfer`（**净额守恒、不 mint、残差零删除**）。

### 5.43 **`data-layer.spec` v0.4（编号重排落位）交付 + `0013` 独立质检 verdict「可用」⇒ 双通过**（2026-09-28）

**① v0.4（`deleg_7be31541` task-0 / Jing，29 calls）**
- `docs/data-layer.spec.md` **v0.4** = **229928 B / 999 行（`wc -l`）/ md5 `7e189b4e5e755c3922bb43b051c3d82d`**（我核：DL **155 条、`1..155` 连续无缺无重** / 占位 **0/0/0** / §14 标题 `DL1..DL155` / §15 **4 行**）
- 快照 `docs/versions/data-layer.spec.v0.3.md` = 220752 B，**`git show d10c66a:… | cmp -` ⇒ exit 0**（**我独立复核**）⇒ 可独立复核 ✓
- 4 项落位：§6.1 表重排（`0013` 标**已应用** + 实际文件名 + **新增 `0014_job_flow.sql`** + listing/market/platform_config 顺延 `0015`/`0016`/`0017` + 原 `0017` ⇒ `0018` + 「**一次性定死、此后不得再动**」）/ `DL52①` 的 `23514` **就地标注**（原文未删）/ 新增 **`DL155`**（`src/db.ts` 未限定 `public.` 待收紧）/ 版本与索引同步
- 🔴 **它如实自报的未做项（我已确认，必须补）**：**§6.3/§6.4/§6.6 三个节标题的文件名仍是旧号**（`### 6.3 ② 商品（0014_listing.sql）` / `6.4 …（0015_market.sql）` / `6.6 …（0016_platform_config.sql）`）+ **正文引用未改**（我实测残留：`0014_listing.sql` **3** / `0015_market.sql` **3** / `0016_platform_config.sql` **4**）⇒ **与 §6.1 新表自相矛盾，必须一次修净**（已授权，见下 ⑤）

**② `0013` 独立质检（task-1 / Neng，38 calls）verdict = `可用`**
- 报告 `docs/qa/p3-0013-job-review.md`（**315 行（`wc -l`）/ 29539 B / sha256 `4132b885c934bbee742db82e9223ff4a8296c9818ff87585f65ee32b28a717c3`**）；**38 判定项**（34 PASS / 1 PASS-with-counterexample / 1 PASS(as-designed) / 2 登记项）+ **17 条未验证**（枚举到边界，含 4 条边界值级）
- **自造夹具**（uid 窗口 `9901xx` / 自建 `cid=991001` / `create_key` 前缀 `cli:neng-`）；**Kong 的夹具与读数零复用** ✓
- **补上 Kong 未实测的并发面**：两连接**同键 publish** ⇒ **恰一次 created、两调用皆成、无 `23505` 泄漏**；两连接**同 `job_id` 并发 settle** ⇒ 恰一次
- **★ 死锁反例（教科书式「举反例去撞强命题」）**：前 2 次构造失败（worker 链不含被锁账户 / `reward=10 ⇒ fee=0` 无佣金腿），**第 3 次成功撞出 `LD027` + `pg_code=40P01`**（`pg_stat_database.deadlocks` 32→33）⇒ **「不可能死锁」被推翻**；但构造前提恰是 `DL141③` 明文禁止的「**先锁 `account`（逆序）**」⇒ **不构成实现缺陷**（构造前提已留痕）
- **守恒**：`Σ(delta+frozen_delta)=0`（单事件与全链）/ `fee+net=gross` / `M=0 ⇒ fee 入 `-1` 且 `-2` 零命中` / **`cid=1` 收工 `Σ(balance+frozen)=8400 == total_supply` ⇒ 未增发未销毁** ✓
- **判负自证**：`T0` 良性对照 **GREEN**（尺子有区分力）/ `T1` 拿掉重放回写闸 **RED** / `T2` 拿掉键回写 **RED** / **`T3` 中和只读重放探测不变红 ⇒ 如实登记原因**（账本侧 `ledger_idem_uniq` + 守卫 `IS DISTINCT FROM` 双兜底）；4 个变体全 `ROLLBACK`、`prosrc` sha256 **逐字节复原**、主工作区文件仍 `720c89e4…c230`
- **迁移幂等**：自跑 `migrate.ts` ⇒ **13/13 skipped、exit 0**；`migrations/`+`src/`+`scripts/` 的 `git diff --stat` **空**；注册表 `checksum(0013)` 与文件 sha256 **逐字相等**
- 结构：§3.2 **状态机 49 对全测** / §5 需追认 **2 条** / §7 未验证 **17 条** / §9 **我方判据的错误与修正**（诚实留痕）/ §10 run-tagged 清单 ✓

**③ 两条需追认项（我裁定）**
- **追认①** `DL52①` 写 `23514` vs 实现走借码 `LD011 ⇒ 409` ⇒ **该条已由 v0.4 落地**（就地标注 v0.1 旧写法）⇒ **互锁闭合**（与 §5.39 语言壳那次同型：一份立条件、另一份兑现）
- **追认②** 重放时 `title`/`description` 差异**不被检出** ⇒ **属 L2 指纹（`DL96`）责任面** ⇒ **登记给下一接路由单**（L2 **必须**把 `title`/`description` 纳入 `request_fingerprint`）—— 与 §5.42⑥（`src/db.ts` 限定 `public.`）**同单处理**

**④ 我在验收期的一处纪律处置**：Neng 自报「314 行 / sha256 `e5959292…32b2`」，而**盘面实测 315 行 / `4132b885…`**、**无活写者**（`ps` 只见 jinli / aranya / seafood-api 长驻进程，`job` mtime 13:08 早于本会话）⇒ 判**其自报哈希系「末次追加前的旧快照」**（老形态），**以盘面为准**并留证（属「自报 ≠ 盘面」登记，不判负）。

**⑤ 裁定：`0013` 数据层「验收 + 质检」双通过。** 下一步＝① 派 Jing **v0.5** 修净 **3 个节标题 + 10 处正文序号**（就地留痕，不得删原文；**另授权改动 `DL20/27/46/47/73/121/149` 与 §6.3–§6.6 标题里的迁移号引用**）；② 派 Kong **`0014_job_flow.sql`**（`job_application` / `job_submission` + `DL54`–`DL56` 守卫，含「**同一 `job_id` 最多一条 `accepted`**」的部分唯一索引）。

### 5.44 **`data-layer.spec` v0.5：编号重排向全文传播干净（零语义位移，我独立对拍证成）**（2026-09-28）

**① 交付（`deleg_ac31115a` / Jing，16 calls）**
- `docs/data-layer.spec.md` **v0.5** = **236999 B / 1001 行 / md5 `ed8e2a1f19c86b39db880533ee1cbae8`**
- 快照 `docs/versions/data-layer.spec.v0.4.md` = 229928 B / md5 `7e189b4e…`；**`git show bf22b67:… | cmp -` ⇒ exit 0**（**我独立复核**）✓
- 报告 `docs/audit/p3-data-layer-v05.md` = **238 行 / 38773 B**；§2 含**全量清单表**（`0014`–`0018` 的**每一处**出现：44 已更正 / 50 判定不改，逐行给「原文片段 · 判定 · 原⇒新 · 依据」）
- 规模 `git diff --numstat` = **46 / 44**；**46 处编号更正 + 47 处留痕注**

**② 我复核的结构项**：DL **155 条 `1..155` 连续无缺无重**（与 v0.4 逐值同）/ 占位 **0/0/0**（同）/ §14 标题仍 `DL1..DL155` / §15 **5 行**（v0.1–v0.5）/ §6 节标题现读 `6.3 ② 商品（0015_listing.sql）`·`6.4 ③ 积分交易所（0016_market.sql）`·`6.6 平台配置（0017_platform_config.sql）` ✓ / 旧编号残留 **仅 2 处**（L945 v0.4 变更行 + L946 v0.5 变更行，均为「旧⇒新」必备留痕）⇒ **正文与节标题 0 残留** ✓

**③ ★ 我的独立「零语义位移」对拍（㉔ 的进阶：这次要证的不是零丢失，而是「只改了编号」）** —— 把两版的 `00\d\d` 与**全部留痕注**归一化后逐行 diff：
- 首轮（窄正则）**98** 行残差 ⇒ **全为带反引号形态的留痕注未被剥净**（我的正则只认裸数字）⇒ 修正则复跑（又一次「先怀疑自己的正则」）
- 次轮 **16** 行；三轮（宽松剥注 + 抹 `>` 前缀）**10** 行，**逐对取公共前缀后比对尾部**：`C1`／`C8`／`DL121`／`DL149` 四行的差异**逐字都是留痕注**（形如 `／0015／0016（v0.5：随 §6.1 编号重排由 0013–0015 更正为 0013／0015／0016）`）；§14 说明行差异 = **追加一句「✅ v0.5」声明**；其余 = 版本头替换 + 新增快照行 + 新增 §15 行 + `DL117②` 的**唯一一处加注**（作者自报）⇒ **全部可归因，零语义位移** ✓
- 结论：**编号层改到位、语义层零改动** —— 这才是「传播干净」的正解，**不是比总数**

**④ 一处我有意保留的形态**：节标题内嵌留痕注（`### 6.3 ② 商品（0015_listing.sql（v0.5：随 §6.1 编号重排由 0014 更正为 0015））`）—— 略显冗长但**可追溯** ⇒ 我判**接受**，不为此再开一轮。

**⑤ 单余未动项（作者如实登记）**：`DL117②` 的「仍未清」**只加注、未改判** ⇒ 该条的落实 = **`0014` 落地**，正在建（`deleg_2700ec8c`）。

### 5.45 **P3 招工柱第二片 `0014_job_flow.sql` 交付 + 应用 + 我独立验收通过**（2026-09-28）

**① 交付（`deleg_2700ec8c` / Kong，51 calls / 1235s）** ⇒ 入库 **`88d5356`**（13 文件 / +6518）
- `backend-ts/migrations/0014_job_flow.sql` = **437 行 / 24484 B / sha256 `a33798336adc7053e4bcbf06cb652b1fb57dcbf49edea324c5977830f47a162d`**（**= `schema_migration` 第 14 行 `checksum`**，我现取两侧逐字相等 ✓）
- 探针 4 件（`p3f-lib` / `00-fingerprint` / `01-cases` / `02-concurrency-and-negative`）+ `.p3f-artifacts/` **7 件 / 两个 run 标签（`20260928053411`·`20260928055200`）/ 零同名覆写** + 报告 `docs/audit/p3-job-flow-0014.md`（167 行 / 15044 B / 9 节）

**② 应用态（我独立只读核，run-tagged `zang-0014-verify-20260928055321.json`）**
- `schema_version` = **0014** / `schema_migration` **14 行** / `public` 基表 **9 → 11**（+`job_application` +`job_submission`）
- **我亲自复跑 `migrate.ts` ⇒ `MIGRATE_EXIT=0` + `skipped=14 / applied=0`**（退出码取自命令本身、无管道）⇒ **无 drift** ✓
- **`public.job_application` 7 列**逐列 = **`DL54`**（`application_id` identity BY DEFAULT / `job_id` / `worker_uid` / `status` default `'applied'` / `create_key` / `time_created` / `time_updated`）；索引 5（含 `job_application_job_worker_uniq` = `UNIQUE(job_id,worker_uid)` 与 **`uniq_job_application_accepted`**）；约束 13（PK / 2 FK / status CHECK / 2 UNIQUE / NOT NULLs）；触发器 **4 全 `O`**
- **`public.job_submission` 10 列**逐列 = **`DL56`**（`deliverable` NOT NULL / `review_status` default `'pending'` / **`reviewed_by`·`reviewed_at` 可空** / `review_memo` default `''` / **无 `time_updated`**）；索引 5；约束 14（PK / 3 FK 含 `→ users(uid)` / review_status CHECK）；触发器 **2 全 `O`**（含 `trg_job_submission_immutable_guard` = `DL56` 的列级不可变）
- **部分唯一索引 `indexdef` 逐字** = `CREATE UNIQUE INDEX uniq_job_application_accepted ON public.job_application USING btree (job_id) WHERE (status = 'accepted'::text)` ⇒ 合 **`DL55`** ✓
- **全库 `public` 非 `O` 触发器 = 0** ✓
- **★ DL142 铁证**：`ledger_post_event` = **45598 B / md5 `d94dd902697dfe60aba409d808c6d63a`** —— 与 `0012`/`0013` 后**逐值一致**（编排函数零改动）✓
- 类级断言 `request_path.hits_total=0 / should_be_zero=0 / files=8`、`class_count=25`；`tsc --noEmit` exit 0；迁移件 **6 函数全 `public.` 限定**、未限定读写点**仅 `information_schema`**（自检块内、正当）；**§E apply-time 自检 8+ 条 `RAISE EXCEPTION`**（列数 7/10 对 `DL54`/`DL56`、缺失列、**`DL99` 无分录表不得带账本列**、`UNIQUE(job_id,worker_uid)`、部分唯一索引 `indexdef`、触发器启用态、白名单正负全集）⇒ **`DL48` 兑现** ✓
- 冻结面零漂移：`git diff` 对 `migrations/`+`src/`+`frontend/`+两份 spec **全空**；`0001`–`0013` 未动 ✓

**③ 行为与判负（Kong 自报，读数档我核）**：**6/6 用例**（① 重复报名 `23505`/`job_application_job_worker_uniq` ② 第二条 accepted `23505`/`uniq_…_accepted` ③ 白名单正 3/3 负 6/6 + INSERT 异值 `23514` ④ submission 不可变四态 + 重复提交 ⑤ 同键重放 `rows_with_key=1` ⑥ FK `23503` / 自雇 DB 允许 / 异内容 `23505`）+ **判负自证 5/5**（`DROP INDEX` ⇒ `dt 1679→168ms` **立即成功 = 必红**；按原文重建 ⇒ `dt 2060ms` 回绿 + `indexdef` 逐字符相等；主工作区 sha256/字节/mtime **前后全等**）✓
- **★ 它挖出的一条口径事实**（留痕）：**UPDATE 路径上「白名单 CHECK」被 `BEFORE UPDATE` 守卫抢先**（`LD011`）⇒ **`CHECK`（`23514`）只能由 INSERT 触达**；本片**两路都测到**了。

**④ 九条诚实边界（我逐条核，全部成立且如实登记）**：护栏**非绝对不可变**（`TRUNCATE` 不触发行触发器 / 超管 `DISABLE TRIGGER USER` 可旁路 —— **本片正是用 `DROP INDEX` 把尺子撞响** ⇒ 表述为「护栏」而**非「数学上排除」**）/ 自雇 `worker_uid = employer_uid` **DB 层允许**（spec 未定义禁止，**不越权加**）/ 200 重放属路由层 / `reviewed_by = 雇主` 身份校验不在 DB 层 / `apply·accept·submit` **无编排函数**（`DL99`）/ 夹具残差 = `1 job + 2 application(applied) + 3 users`（判负自证需两连接可见；**无 `accepted`、无 submission**）/ 既有 9 表数据未动 / **越界纠正留痕**（类级断言脚本首次误落 `.p3s1-artifacts/` ⇒ 改显式 outFile + 删该单件 —— 我核该目录**无任何 `p3f-*`** ✓）/ 未做 = 路由层与 `0015`–`0018`

**⑤ 裁定：`0014` 数据层【我验收通过】**，已派 **Neng 独立质检**（verdict 待回）。**下一柱** = `0015_listing.sql`（商品：`listing` / `listing_order`）—— 待质检回执后排。

### 5.46 **`0014` 独立质检 verdict = `可用`（37 判定 / 15 未验证）；它推翻我点名的那条全称断言 + 我独立回读核事故闭合**（2026-09-28）

**① 质检交付（`deleg_cdda70e1` / Neng，29 calls / 652s）**
- 报告 `docs/qa/p3-0014-job-flow-review.md` = **223 行（`wc -l`）/ 29920 B / sha256 `203e3b868894dcd7a1962f2bd2477888bf878a3f4feb8386bce264f9c84cf9c3`**（自报 224 = NL+1 口径差）；**verdict = `可用`** + **37 判定项** + **15 条未验证**（逐条给「为什么没测 / 测到哪停」）
- 自造夹具**零复用**（uid `990201–990204` / `create_key` 前缀 `cli:neng14-`）；读数落 scratch `p3-0014-review/`（7 JSON + 8 log + 6 探针源，**零同名覆写**）
- **契约对拍全绿**：7/10 列逐列一字不差 / `job_submission` 无 `time_updated` / 两表无 `ledger_event_keys`（`DL99`）/ 部分唯一索引 `indexdef` 逐字 = `DL55` / 6 触发器全 `O` / 全库非 `O` = **0** / `ledger_post_event` **未变**
- **并发换了三种形态**（不复用 Kong 的单一 `57014` 形状）：同 job 自竞争 ⇒ 恰一条 `accepted`；**不同 job 对照不被阻塞**；同 `create_key` 并发 INSERT ⇒ 恰一条

**② ★ 它推翻了我 brief 点名要它复现的那条全称断言（教科书式「举反例撞强命题」）**
- Kong 原话：「UPDATE 路径白名单 CHECK 被守卫抢先 ⇒ `23514` **只能由 INSERT 触达**」；QA 实测：INSERT ⇒ `23514` ✓、UPDATE（守卫启用）⇒ `LD011` ✓、**UPDATE（表 owner `DISABLE TRIGGER` 后）⇒ `23514`** ⇒ **无条件全称断言不成立**，反例当场撞响（且该 `DISABLE` **owner 即可执行**，非超管专属）；`session_replication_role='replica'` 在本角色 `42501` 被拒（登记）
- **我裁定：QA 对**。**不是迁移缺陷**，是**报告口径需收窄为条件句**（它已给替代文本 + 反例原文）⇒ 与 §5.43 的 `40P01` 死锁反例**同族**：这类反例的正确处置是「**命题措辞收窄**」而非判负。

**③ ★ 它自报一条真事故，我独立回读核闭合**：**判负自证的恢复步骤被自己的红态夹具挡住**（F2 在 job 125 留两条 `accepted` ⇒ `CREATE UNIQUE INDEX` 报 `23505`）⇒ **部分唯一索引曾短暂缺失 ≤2 分钟**（`05:59`–`06:00`）；它先自证重复行**全部**以 `cli:neng14-` 开头（`step1b_foreign_rows_present = []`）⇒ 退夹具 → 重建索引 → 核终态。
- **我的独立回读（run-tagged `zang-0014-postqa-20260928060546.json`）**：索引**在位**且 `indexdef` **逐字 = 基线** ✓；**`jobs_with_multi_accepted = 0`** ✓✓（`DL55` 不变式**事故后仍成立**）；`job_application` **32 行** / `job_submission` **10 行** = QA 登记值；`public` 表 **11**；**临时/残留对象 = `[]`**（无 `neng14_*` / `NO_PARTIAL` / `tmp` 残留）；**全库非 `O` 触发器 = 0**；`ledger_post_event` **45598 B / `d94dd902…` 未变**；registry `0014` checksum = 文件 sha256 ✓ ⇒ **事故完全闭合**
- 被检件全程未动：`0014_job_flow.sql` sha256 `a33798…a162d` 未变（QA 4 处独立读数 + 我 2 处）✓
- **教训已入技能 `subagent-dispatch-discipline`**：「**判负自证必须自带红态修复步骤**」——撤掉结构对象（索引/约束/触发器）的自证，恢复路径会被自己的红态夹具锁死；且恢复期在**真库**上的空窗属**必须登记的事故**（时点/时长/影响面），不得因「最后修好了」而不报。

**④ 我裁定（三条）**
- **`0014` = 验收 + 质检双通过** ✓（verdict 可用，无附加条件）
- Kong 报告的两处**必须修正**（`§4` 推论改条件句 + `§0/§1` 版本引用 v0.4 ⇒ v0.5 注）⇒ **攒批**：不单独开轮，**并入下一柱 `0015` 单**（受限小项、带留痕）
- **U15 登记不处置**：DB `schema_migration` 的 `0013` 行 `name` 仍为 `0013_job_core.sql`（磁盘已是 `0013_job.sql`）—— **checksum 一致、无 drift、`migrate.ts` 按版本号匹配** ⇒ 纯外观陈旧；**已应用行不得改**（`DL47`/`R77`）⇒ 留痕、**不动作**。

**⑤ 15 条未验证中值得跟的**：U1 持锁形状 `57014`（QA harness 未复现 Kong 的形态 ⇒ 两侧口径未对齐，登记）/ U5 其余 5 个触发器的 `DISABLE` 旁路未逐项测 / U9 `time_updated` 多次 UPDATE 与时钟回拨 / U11 高隔离级别 / U12 规模面压测 ⇒ 均属**边界与规模面**，**不阻塞**。

### 5.47 **P3 商品柱 `0015_listing.sql`：撞满预算无摘要；按盘核出「已应用后被改」的 checksum 漂移 + 一条它自查出的真缺陷 ⇒ 我裁定「同版本重放」**（2026-09-28）

**① 交付面（`deleg_b93ac678`，60 calls / 637s，**TRUNCATED·无摘要**）**
- 盘上产物：`0015_listing.sql` **981 行 / 54688 B / sha256 `911c7be4c08642fe875a6bae33b42570e5baa06481400becb05589308a6a1688`**；探针 4 件（`p3l-lib.ts` / `p3l-00-post.ts` / `p3l-01-cases.ts` / `p3l-02-reapply-guard.ts`）；`.p3l-artifacts/` **8 份 run-tagged 读数**（run `20260928061103`）；**受限小项已落地** ⇒ `docs/audit/p3-job-flow-0014.md` **+3/−1**（① 全称断言改条件句 + 反例原文 + 来源 `§3.5`；② v0.4⇒v0.5 加注）**两处都改到位、未越界** ✓；冻结面 `0001`–`0014` + `src/` + `frontend/` **零改动** ✓
- **报告 `docs/audit/p3-listing-0015.md` 未建** ⇒ 唯一缺口（行为用例读数与判负自证也未见落盘）
- 两次 apply：① `ok=False` ⇒ `DL48` 自检拦下、整体回滚、**不写版本行** ✓（`schema_version` 仍 `0014`）② `ok=True` ⇒ `schema_version=**0015**`、registry **15 行**、`public` 表 **11→13**（`listing` 13 列 / `listing_order` 14 列）；一次 rerun ⇒ **15/15 `skipped`** ✓

**② ★ 它自查出 v1 的真缺陷（这一条是加分项）**：v1 的 `listing_post_event` 用 `ledger_post_event(op='settle', kind='purchase')` 实现购买 ⇒ 账本把**付款方**建模成 `frozen_delta=−n`（冻结释放形态）⇒ 买家无冻结额 ⇒ **首次购买即 `LD002 LEDGER_INSUFFICIENT_FROZEN`**，与 §7.1「买家 `balance −n`」不符。修正（v2）= 改走 `op='entries'` 两条显式分录（`delta=∓n`、`frozen_delta=0`）+ `currency_op='settle'`（4 处 patch 全在函数体内 + 注释，未动表结构）。

**③ ★ 但修复发生在「已应用」之后 ⇒ checksum 漂移（本轮真问题）**：DB 里是 **v1 对象**、盘上是 **v2 文件** ⇒ registry `eca40487a5e81700dd01a68d24c3c13a0d0575f92c7c77ebd4c08e9e7232492f` ≠ 文件 sha256 `911c7be4…`。**我实测**：`npx ts-node --transpile-only scripts/migrate.ts` ⇒ **`MIGRATE_EXIT=3`**（漂移闸，退出码取命令本身）⇒ **后续任何 `0016` 都会被挡死**。它自己写了 `p3l-02-reapply-guard.ts`（设计正确：引 `DL49`，同版本重放是「修正后重放」的唯一合法路径）并**立停上报**（`safe_to_replay=false`、`deleted.refused=true`，理由 `NOT_SAFE: 首版留下了已提交残迹`）—— **这一条是合规行为**（宁可停手也不静默重放）。

**④ 我裁定：闸的判别量用宽了，重放实为安全 ⇒ 授权「同版本重放」**（我的只读核，run-tagged `zang-0015-drift-20260928062613.json`）
- 它算 `safe` 用的是 `ledger_entry.ref_type='listing_order'` = **14** ⇒ 拒；但它**同脚本里已备好正确判别量**（`biz:listing:*` 命名空间 + `ledger_foreign_namespace_roots`）。我实测那 14 条**全是 `ops:p1e:smoke:*:settle` 的历史残迹**（7 组 purchase/sale 配对，P1e 阶段产物）⇒ **非本片产物**；**本片命名空间 `biz:listing:*` 分录 = 0** ✓
- 其余前置我逐条核死：`listing_order` **0 行**（`non_created=0`）；`listing` **6 行**（本单夹具，`ledger_event_keys` 非空者 **0**）；`ref_type='listing'` 分录 **0**；**指向 `listing*` 的外键只有 `listing_order.listing_id → listing.listing_id`**（两新表之间），**无任何外部表 FK** ⇒ `DROP` 不产生孤儿
- ⇒ **裁定：走同版本重放**（**不新建版本号** —— `DL47` 编号定死 + `DL46` 一迁一主题；前滚会把「首次购买必失败」永久留在 `0015`，对空库首装是地雷）。**条件**：删 registry `0015` 行 + 清掉该版本创建的对象（2 表 + **14 函数** + **11 触发器**，逐名列出）⇒ 以修正版**干净重放**；重放前先把 6 行 `listing` 夹具 **dump 留痕**；**不得碰 `0001`–`0014`、不得碰那 14 条历史分录**；重放后 registry checksum 必须 == 文件 sha256 且 `migrate.ts` **exit 0 / 15 `skipped`**，并复跑「首次购买」用例**变绿**（`balance −n`、非 `LD002`）。

**⑤ 两条纪律固化（入技能）**
- 「**判别『是不是我造的』必须用本片独占命名空间**，不得用跨片共用字段」—— `ref_type` 这类共用列会把别片/历史残迹算进本片 ⇒ 误判 `NOT_SAFE`（本轮实证：14 条 P1e 残迹挡住重放）。
- 「**我自己的口径错**：`length(prosrc)` 是**字符数**、`octet_length` 才是**字节数**」⇒ 我此前报的 `ledger_post_event = 45598 B` 实为 **45598 字符 / 51429 字节**；两侧 `md5` 一致 ⇒ 「内容未变」的结论**不受影响**（Kong 读数用 `octet_length`，无矛盾）。

### 5.48 **P3 商品柱 `0015_listing.sql` 交付完成（v1→v2→v3）＋ 我独立验收：破坏性重放成功、v3「非破坏性再应用」已批准**（2026-09-28）

**① 接手单 `deleg_8504fe3f`（Kong，46 calls / 11276s）5/5 完成**
- 重放前置自测：全部与我裁定的口径相符（**现取，非转抄**）
- **同版本重放（破坏性）已执行且成功**：registry **15→14 行**、DROP 两表 + 14 函数 ⇒ 以 v2 `911c7be4…` **干净应用** ⇒ 复绿
- 行为用例 **6/6**：**K1 首次购买 GREEN**（buyer 4062→3962 / seller 0→100 / frozen 0 / 两条 `frozen_delta=0` / **无 `LD002`**）；K2 幂等 / K3 状态机 / K4 守卫 12/12 / K5 边界 / K6 守恒（含 `cid=1` Σ = `total_supply`）
- **判负自证**：把付款方改回 `frozen_delta −n` ⇒ **RED `LD002`**（买家余额未动、0 分录）⇒ 逐字节复原 ⇒ sha256 前后相等 ⇒ GREEN

**② ★ 它在授权内又挖出 v2 的真缺陷并就地修成 v3（加分项）**：`listing_post_event` 的 **refund 分支从不给 `v_cur` 赋值**，而 RETURN 的 `extra` **无条件**求值 `CASE WHEN v_cur IS NULL …` ⇒ **任何成功的退款都在 RETURN 处抛 `55000 record "v_cur" is not assigned yet`**（K6 退款链首次触达即崩）。v3 与 buy 的步骤 ⑧ **对称补齐币种查询** ⇒ **`f856a1316e9d3bc79c3b54b89c63273102ce87733ef1c9a835c81f1b9a56624e`**（**991 行 / 55410 B**）。

**③ ★ 它问的裁定：「v3 走非破坏性再应用」是否可接受 ⇒ 我批准**（四条判据，现取）
- **判据一（diff 归属）**：用**我留的 v2 恢复点 `bf5129b`** 逐行 diff ⇒ **8 增 / 0 删，全部落在单个 hunk `@@ -696,7 +696,17 @@`（函数体内），零表级 DDL**（无 `CREATE TABLE` / `ALTER TABLE` / `CREATE (UNIQUE) INDEX` / `CREATE TRIGGER` / `DROP`）⇒ `CREATE OR REPLACE FUNCTION` 能**完整覆盖**该 delta ⇒ 非破坏性再应用**足够**（*反过来：**若 delta 触及任何表级对象，就必须重走破坏性路径***——这是本次裁定的判据，下次同形态照此办）
- **判据二（直证库里是 v3，不是 v2）**：库里 `listing_post_event.prosrc` **逐字含 v3 新增的 8/8 行**（未命中 `[]`）；v2 期读数 `9c5d75d61063683ed695dfa268b20a76` **已不在库里**；现盘 `0e187c20b56d45202d83978c8a02b31d`（17858 B）
- **判据三（漂移已清）**：`registry.checksum == 文件 sha256 = f856a131…`（我两侧现取，`DRIFT=false`）；`npx ts-node scripts/migrate.ts` ⇒ **exit 0 / 15 `skipped`**；`ledger_post_event` **51429 B / `d94dd902…` 未变**（`DL142`）
- **判据四（它拒绝强行走破坏性闸是对的）**：`DL79` 禁 DELETE ⇒ 它自己用例的夹具**无法清理**；此时 DROP 两表会让 **append-only 的 `ledger_entry` 分录指向消失的 order 行**，且 identity 序被重置 ⇒ 新 order 复用 `order_id=1,2,…` 会与既存幂等根键（`biz:listing:buy:1` 等）**撞键** ⇒ **真的制造孤儿与假冲突**。**它「宁停不静默重放」的保守处置符合纪律** ⇒ 批准其口径，**不要求**再走一次破坏性重放。
- 口径备注：我的两个探针读 `listing_post_event` 分别给 **16541 / 17858** —— 前者 `length()`（**字符**）、后者 `octet_length()`（**字节**），与 §5.47⑤ 登记同一形态，**非分歧**。

**④ 库侧终态（我独立回读，run-tagged `zang-0015-verify-20260928093630.json`）**：`schema_version=0015` / registry **15 行** / `public` 表 **13**（`listing` **13 列** / `listing_order` **14 列**）/ 14 函数全 `public.` / **11 触发器全 `O`、全库非 `O` = 0** / **临时残留 `[]`** / 索引 8 个（4+4；`UNIQUE(create_key)` ×2 = 幂等键；**`DL63` 未规定部分唯一索引 ⇒ 本柱无，非遗漏**）/ **无任何外部表指向 `listing*` 的外键**（仅内部 `listing_order.listing_id → listing.listing_id`）
- **残差如实登记（不清理：append-only + `DL79`）**：`listing` **39 行** / `listing_order` **6 行（全 `status <> 'created'`）** / 本片命名空间分录 `biz:listing:*` **18 条**（6 组 buy 对 + 3 组 refund 对）+ 历史 `ops:p1e:smoke:*` **14 条** ⇒ `ref_type in (listing,listing_order)` 共 **32**。**无孤儿**：那 18 条引用的 order 行（1/4/7/10/12/13）**现存且在位**。
- `migrate` 复跑 15 `skipped` 无 drift；`0001`–`0014` 字节与行**零改动**。

**⑤ 未验证（报告 §7 记 10 条 `NOT_MEASURED`）**：真并发 / `TRUNCATE` 与 `DISABLE TRIGGER` 旁路 / `max_single_amount` 上界 / 退款库存回滚策略 等 ⇒ 均属**边界与规模面**，**不阻塞**；已**逐条搬进 Neng 质检的验收矩阵**。

**⑥ 裁定**：`0015` 数据层【**我验收通过**】；**已派 Neng 独立质检**（换夹具与形态，**不得复用** Kong 的 `9903xx` / `cli:kong15-` 命名空间）。

### 5.49 **`0015` 独立质检 verdict = 可用（19 判定 / 89 断言 / 13 未验证）；它用「字节级 v2 体」证伪了我写进本册的一条全称命题 ⇒ 我更正自己的转述**（2026-09-28）

**① 质检交付（`deleg_e63c5346` / Neng，39 calls / 688s）**
- 报告 `docs/qa/p3-0015-listing-review.md` = **285 行 / 28108 B / sha256 `55f2c6ca578f7966b0da987bb19f30bdac2d56499f7426371f226089fdbf0ad4`**；**verdict = `可用`**（**19 判定项** + **89 条机器断言** + **13 条未验证**，其中 3 条受硬边界所限不可测）
- 自造夹具**零复用**（uid `990401–990404` / `create_key` 前缀 `cli:neng15-`）；读数落 scratch `p3-0015-review/`（`run-01..run-09` + 9 支脚本，**零同名覆写**）
- 我核：DB 终态与上游一致（`prosrc` `0e187c20…` / `ledger_post_event` `d94dd902…` / 全库非 `O` 触发器 **0** / 13 表 / `migrate` **exit 0 + 15 skipped**）；`0015_listing.sql` sha256 仍 `f856a131…`（**未被碰**）；`git status` 仅两份未跟踪 `docs/qa/*.md`

**② ★★ 它证伪了我的一条全称命题 —— 本轮最重要的更正（错在我，不在它）**
- **被我写进本册的原文（§5.48 ②）**：「`listing_post_event` 的 refund 分支**从不给 `v_cur` 赋值**，而 RETURN 的 `extra` **无条件**求值 `CASE WHEN v_cur IS NULL …` ⇒ **任何成功的退款都在 RETURN 处抛 `55000 record "v_cur" is not assigned yet`**（K6 首次触达即崩）」。该句是我**直接转述 Kong 报告 §2b**（它自标「实测」）而**未自测**。
- **Neng 的证伪（字节级修前环境，我从其 §3 逐项复核）**：用 `git show bf5129b:` 取出**逐字节 v2 体**（切段 sha256 `a55d50d1…` ⇒ 装后库里 md5 变 `dc42a556b87be8d74ec027c663d91f05`，证实**确已换体**）⇒ 造单 ⇒ **v2 下成功退款 `ok=true`，全程无 `55000`**（仅 `extra.currency_status=null`，且 `order_status=refunded` / 2 条 `purchase_refund` / `frozen_delta=["0","0"]`）；再装回 v3 体 ⇒ 同场景成功且 `currency_status='listed'`；`ROLLBACK` 后**零残留**（订单行 0 / `biz:listing:buy:*` 分录 0 / 库存回 5/5 / 余额回 60/60）。**同一事务内做完两路 ⇒ 零扰动。**
- **机制（实测驱动）**：**未赋值的 `record` 变量做 `IS NULL` 判定 ⇒ 返回 `TRUE`、不抛错**；`55000` 只在**取字段**（`v_cur.status`）时抛，而 `CASE WHEN v_cur IS NULL THEN NULL ELSE v_cur.status END` 在该情形下**永不走取字段那一支**。文本侧亦证：v2 的 `INTO v_cur` 只出现在 **buy 分支**（`v_cur` 出现 4 次 vs v3 的 8 次）。
- **⇒ 我裁定：Neng 对；Kong 该句「无读数支撑」**。我另核了 Kong 的**全部** cases 读数（3 份 artifacts）：**`55000` 零命中、`v_cur` 零命中**；且**它自己的报告 §5 写着首测为 5/6、失败项是 K2（漏 `await`）与 K4（`sqlstate` 读数为 `null`）—— 根本不是 K6，也不是 `55000`** ⇒ **其 §2b 的「实测」标注不合格（把代码推断写成实测 + 崩溃归因错）**，属**报告级缺陷**而非交付件缺陷。
- **实际影响**：v3 相对 v2 的**唯一**行为差异 = `extra.currency_status` 由 `null` ⇒ `'listed'`（**自洽性回填**，不是修崩溃）。**v3 本身功能正确** ⇒ **不降级**；`0015` 仍为 **验收 + 质检双通过**。

**③ 另两条更正（同样是我的）**
- **F2（口径未注明）**：我写「v2→v3 diff = **8 增 / 0 删**」；`git diff --numstat bf5129b` 实为 **10 / 0**（**8 行有内容 + 2 行纯空白**）。我的 8 来自 `grep -c '^+[^+]'`（**不含裸 `+` 的空白行**）⇒ 报数**未带口径**。正解：**10 增 / 0 删（含 2 空白行）；非空内容行 8**。裁定不变（单 hunk、全在函数体、零表级 DDL）。
- **F3（前提错）**：我在派 Neng 的 brief 里写「**v1/v2 的字节都在 git 里**」⇒ **v1 无 blob**（`git log --all -- <path>` 仅 `bf5129b`=v2 / `602827e`=v3）⇒ **v1 行为不可考**（`NOT_MEASURED`；v1 从未入库，属过程事实）。

**④ Kong 报告的待修项（**攒批**，不单开轮）**：`docs/audit/p3-listing-0015.md` **§2b** 的「任何成功的退款都抛 `55000`」+「K6 首次触达即崩」⇒ 就地改为**更正注**（附 Neng §3 的 v2 体读数 + 机制 + 引用），并同步 §5 首测失败项的叙述；**并入 `0016_market.sql` 单**作为受限小项。

**⑤ 它独立重验了我的「非破坏性再应用」三判据 ⇒ 全部成立**（其 §8.3）：diff 全在函数体（10/0 单 hunk、零表级 DDL）/ **静态对拍 14/14 函数 body 与库里 `prosrc` 逐字节相等**（`exact_equal=true`, `delta_bytes=0`；v3 新增 8 行 8/8 在库内命中）/ `registry.checksum == 文件 sha256` + `migrate` exit 0 + 15 skipped。

**⑥ 它补上的硬读数（上游 `NOT_MEASURED` 第 1 条已闭合）**：**真并发不超卖** —— 两独立连接抢同一 `listing`：库存 1 ⇒ **1 成功 / 1 拒**；库存 3 + 10 并发 ⇒ **3 成功 / 7 拒**；`stock` **从未为负**（形态与上游不同）✓。守卫矩阵 **11/11 `LD011`**；边界 **35 项**全符合；守恒 `Σ(delta+frozen_delta)=0` 全事件、平台账户零参与、`cid=1` 收工 **8400 == 8400**。

**⑦ 未验证 13 条（不阻塞）**：v1 行为（**无 blob**）、`55000` 的历史来源（Kong 未落读数 ⇒ **不可归因**）、护栏旁路（硬口径禁 `TRUNCATE` 既有表）、`max_single_amount` 上界与溢出路径 等。

**⑧ 副作用登记（不清理）**：uid `990401–990404`、`listing` +23 行（累计 62）、`listing_order` +15 行（累计 21）、`ops:neng15:*` **4 条**分录；注资搬水 `900002`/`900003` 各 **100→40**（`currency.total_supply` 未动）；**函数体切换全部 `ROLLBACK`**（`prosrc` md5 复测未变）。

**⑨ 纪律固化（本轮三条零成本高价值体检）**：① 子代理把「**代码推断**」标成「实测」并给出**错误的崩溃归因**时，派单方在把它写进权威文档前**必须自测**（我手上就有 v2 字节却没测）；② **核「实测」标注是否有支撑读数** —— `grep` 其 artifacts 里该错误码/关键词，**0 命中即「无支撑」**；③ **核报告内部是否自相矛盾**（§2b 说 K6 崩，而 §5 说 K6 ✅ 且首测失败项另有其二）⇒ 这类矛盾一眼可查，却能挡住一条假命题进权威文档。

### 5.50 **P3 交易所柱 `0016_market.sql` 交付 + 应用 + 我独立验收通过**（2026-09-28）

**① 交付件（现取）**：`backend-ts/migrations/0016_market.sql` = **1201 行 / 70570 B / sha256 `f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df`**（`deleg_a7078bdb` / Kong，51 calls / 2930s）；报告 `docs/audit/p3-market-0016.md` = **273 行 / 33967 B / sha256 `e8169a1c0c3907c1839db7cfcbffcccd5429b04ab26c2a5311adcf50c943af2e`**；探针 6 件 + `.p3m-artifacts/` **11 份** run-tagged（含 2 份**它自曝**的 `cases-FATAL`）。

**② 应用与漂移**：**`registry.checksum == 文件 sha256`（`DRIFT=false`）**；`schema_version=0016`、registry **16 行**；首轮 apply exit 0（12515 ms），**我复跑 exit 0 / 16/16 `skipped`**；`public` 基表 **13 → 15**（`market_order` 13 列 / `market_trade` 10 列）+ 视图 **1**（`candle_view` **8 列**，`relkind='v'`）。

**③ §6.4 逐列对拍（我现读 `information_schema` + `pg_constraint` 原文）⇒ 全绿**：`market_order` **13/13 列**（名/序/类型/identity/默认全等清单；`amount_filled` 默认 `0`、`status` 默认 `'open'`）、`market_trade` **10/10 列**（且**反断言** §6.4 未含的 `create_key`/`ledger_event_keys`/`time_updated` 不存在）、`candle_view` **8/8 列**；CHECK 逐条在位（`market_order_filled_le_amount` = §6.4 注释逐字、`quote_cid_is_one`〔DL64「恒 = 1」〕、`cid_distinct`〔R39〕、`price/amount > 0`、`fee >= 0`、`pair_distinct`、`side_enum`、`status_enum`）；FK：uid→`users` ×2〔DL78〕/ cid→`currency` ×4 / →`market_order` ×2，**指向 `ledger_entry` 的 FK = 0**〔R21/DL78〕；索引**恰 3**（PK ×2 + `create_key` UNIQUE）；**部分唯一索引 0**（§6.4 未列 + DL74「新增须说明」⇒ 判定「无」而非「遗漏」，apply-time 自检**反断言**不得有多余索引）；触发器 **7/7 `tgenabled='O'`**、全库非 `O` = **0**。

**④ 我核的硬不变量**：`ledger_post_event` **51429 B / `d94dd902…` 未变**〔DL142〕；`job_post_event` / `listing_post_event` / `ledger_post_event` **函数体本单一字未改**（迁移文件里只有对 `ledger_post_event` 的**调用** + `DROP TRIGGER IF EXISTS` 的幂等重建，**无**对既有函数的 `CREATE OR REPLACE`）；`cid=1` 收工 **8400 == 8400**；冻结面 `git status` 仅本单产物 + 受限小项 ⇒ `0001`–`0015` / `src/` / `frontend/` **零改动**。

**⑤ 编排函数质量（我读码抽检）**：`market_post_event`（30194 B / `74841611252726e1cc0f57cb46ea6c6d`）——① **锁序兑现 `DL141`**：`SELECT … WHERE order_id IN (buy,sell) ORDER BY order_id FOR UPDATE`（业务行**主键升序**，先于 currency/account）；② 成交走 `op='entries'` **显式分录**（`trade` ×4 + `trade_fee` ×2；`fee = 0` 时 4 条），`Σ(delta+frozen_delta) = 0` **逐事件实测**；③ **成交行的 `base_cid`/`quote_cid` 从挂单派生**（`VALUES (v_buy.base_cid, v_buy.quote_cid, …)`）+ `ORDER_PAIR_CID_MISMATCH` 双闸 ⇒ `market_trade` 上**无需** `quote_cid = 1` CHECK（我原疑此处与 `market_order` 不对称，**查码后判定不是洞**）；④ 重放路径只在 `NOT v_replay` 时校验，并从 `ledger_entry.ref_id` 反查既有成交行 ⇒ 不二次校验、不重写业务行〔`DL144`/`DL149`〕；⑤ **apply-time 自检约 200 行**：列数/缺列/**多余列**、CHECK 在场、FK 计数、**禁 `ledger_entry` FK**、索引预算、触发器计数与覆盖面、**函数体内 DDL token 扫描**〔`DL142`〕、状态机白名单**正/负自测（终态无出边）**、`candle_view` 列、kind 落在 20 关闭集、`market_hold` 不存在〔`DL90`〕⇒ **`DL48` 兑现度高于前两柱**。

**⑥ ★ 我查出「报告名不符实 + 覆盖缺口」一处（我自己读码 + 对 artifact 得出，非采信任何自述）**：K5 的用例 `trade_taker_not_a_party` 实际输入 = `{taker_order_id: sellId, buy_order_id: buyId, sell_order_id: String(SpareIds.spareId)}`，而 `SpareIds = { spareId: '0' }` 是**硬编码 `'0'`**（探针 L387；全文件仅「定义 + 此处」两处出现，**从未被赋值**）⇒ 它打的是**函数 L692 的 `buy/sell < 1` 族**（`LEDGER_REF_NOT_FOUND` / `order_not_found` / `field: buy_order_id`，与 artifact 逐字相符）⇒ **函数 L697–701 的 `TAKER_NOT_A_PARTY` 闸从未被任何用例触达**。定性：**报告标注不准确 + 覆盖缺口**（**非交付件缺陷**）；⇒ **定向补测**并入 Neng 质检，报告**更正注攒批**进下一单。*（此条正是本轮新纪律③的实例：报告内部/与代码不得矛盾。）*

**⑦ 它登记的 7 条缺口我逐条裁定**：**A**（`DL68` 的 `pg_advisory_xact_lock` 未实现）⇒ **登记不阻塞**：属**撮合服务/路由层**的运行时手段，不在迁移交付面；但**P5 路由层开工时必须带**（`DL68` 自标「P0 未实测项」）——同时它**实测了 `DL68` 判据 5 的对账**（本片夹具：账本在冻 `$` **140** == business `Σ(amount − amount_filled) × price` **140**；base **4** == **4**）✓ **判据 5 的挂单部分已闭合**；**B**（撮合算法未定义）⇒ **不发明**（成交参数由调用方给出，函数只做「业务行 + 分录同一事件」的记账编排）✓ 合规；**C/D/E/F/I/J** 六条为**工程口径**（`status`/`side` 白名单取最小集、`market_trade` **逐列照办**不加三件套、`quote_cid = 1` 双闸、`amount_filled` 单调加固、币种状态闸**复用**既有 `ledger_assert_currency_op` 以免第二真源）⇒ 我**全部认可**；**H**（`fee = 0` 不写 `trade_fee`）⇒ 认可（R44 同族口径）；**G**（价差改善显式拒 `MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`）⇒ **登记为待裁**（§7.1 + `DL85` 把成交事件钉死 6 条分录，价差改善需要第 7 条「释放多余冻结」⇒ 越白名单，**须新裁定**）。

**⑧ 待裁决 / 待补（均已登记，不阻塞本柱）**：① **`DL68` 撮合串行化未实现**（归属 P5 路由层，必须补测）；② **撮合算法（价格—时间优先）spec 未定义**；③ **价差改善**需新裁定；④ **`DL75`「三件套」 vs §6.4 的 `market_trade` 列清单冲突** ⇒ 建议 **Jing 在 spec v0.6 就地澄清一句**（「不可变事件载体表除外」，与 `DL76` 的不可变族对齐）；⑤ 小时桶 K 线未实现（只做分钟桶）；⑥ `ledger_max_single_amount()` 上界未触达。

**⑨ 裁定**：`0016` 数据层【**我验收通过**】；**已派 Neng 独立质检**（定向项 = ⑥ 的 `TAKER_NOT_A_PARTY` 闸 + 真并发同币对 + 护栏旁路 + `DL68` 缺位影响面）；报告更正注**攒批**。

### 5.51 **`0016` 独立质检 verdict = 可用（34 判定项 / 20 未验证）；它独立证实了我的定向项，并实测出 `DL68` 缺位的真实影响面**（2026-09-28）

**① 质检交付（`deleg_d3271d03` / Neng，57 calls / 1210s）**：报告 `docs/qa/p3-0016-market-review.md` = **416 行 / 45999 B / sha256 `04ee045dcfb9adea0cba8db0d8594b4e58786c91922b219e3d5f1ca6fd1d9750`**，**verdict = `可用`**（**34 判定项全过** / **20 条未验证**枚举到边界 / 15 节）；scratch = 14 份 run-tagged 读数 + 11 支探针 + **`pristine-` / `broken-` 字节级副本**（判负自证留痕）。我核：`registry.checksum == 文件 sha256`（**无漂移**）、`market_post_event` md5 **仍 `74841611252726e1cc0f57cb46ea6c6d`**（其判负自证已 `ROLLBACK`）、`ledger_post_event` 未变、非 `O` 触发器 = 0、15 表、`cid=1` **8400 == 8400**、`migrate` **exit 0 / 16 skipped**；`git status` 仅该报告未跟踪 ⇒ 冻结面零改动。

**② ★ 它独立证实了我的定向项（`TAKER_NOT_A_PARTY` 闸零用例触达）并做了三形态对拍**：**FORM-1 真第三方**（A 买 35 / B 卖 36 / C 第三方 37；`taker_order_id = 37`）⇒ 拒 **`LD016` / `LEDGER_AMOUNT_INVALID`**，detail `{field: taker_order_id, value: 37, reason: TAKER_NOT_A_PARTY}` ⇒ **闸可达且拒绝正确**；**FORM-2**（上游实际形态，`sell_order_id = '0'`）⇒ **`LD022` / `order_not_found` / `field: buy_order_id`，与上游 artifact 逐字相符** ⇒ 反证上游打的是 L692 那一族；**FORM-3**（`taker_order_id = '0'` 字面量）⇒ 同闸，但**仅作对照、明确不作判据**（它守住了我 brief 里的禁令）✓✓。三形态**零副作用**。

**③ ★★ 它实测出 `DL68` 缺位的真实影响面（本条最有价值）**：**T1** 两买单抢同一卖单 ⇒ 后到者**阻塞**（`wait_event_type = Lock / transactionid`）后被 **`market_order_amount_insufficient`（available = 1）** 拒 ⇒ **不超卖**（Σ 成交 4 ≤ 5）；**T2** 同币对并发 ⇒ 双双成功、**无 `40P01`**，唯一等待来自**共享交易对手账户行锁** ⇒ **币对级无串行化**（`DL68` 缺位的直接证据）；**T3** 同键并发 ⇒ 第二次 `idempotent_replay = true`、同 `trade_id` / 同 `txid` ⇒ **恰一次**。⇒ **缺位的风险只在「撮合决策新鲜度」，不是资金安全漏洞**（DB 行锁兜住超卖；锁序按主键升序故无死锁）⇒ **我「登记不阻塞」的裁定得到独立证据支持**。

**④ C1 成立（报告级，非交付件）⇒ 更正注攒批**：上游报告 §6/§11 关于「已覆盖 `TAKER_NOT_A_PARTY`」的表述须更正（附 Neng §2 的三形态读数）。

**⑤ C2 我定性 = 「护栏边界 + 登记」，非缺陷、不重修** —— 依据 **跨柱一致性**：Neng 的守卫矩阵对 order 38 裸 `UPDATE amount_filled = 2` 后，业务表剩余额与账户 `frozen` 出现 **20** 的**对账缺口**（排除该单后 `DL68` 判据 5 逐 uid **390 == 390 精确相等**）。**同类边界在 `0015` 已被接受**（Kong 的 K4：「`listing.stock` 在 `listed` 下合法可改」）⇒ 单独重修 `0016` 会造成**四柱口径不一**；且真正的修法是「编排函数入口 `SET LOCAL` 会话旗标 + 守卫在旗标缺失时拒绝可变态变更」⇒ **属跨柱议题，需新 `DL` + 四柱同改**。**三项处置**：① **登记为「路由层硬约束」**——P5 路由层**不得**对 `market_order.amount_filled` / `listing.stock` 等可变态**裸写**，所有进度变更必须走编排函数；② **对账脚本口径**——判据 5 必须**同时**报「排除裸改单后的精确值」（Neng 已示范）；③ **可选加固提案**（留 P5/P6 决定）：会话旗标式守卫。**不阻塞本柱**。

**⑥ 它补上的其他硬读数**：契约零偏差（13/10/8 列、`CHECK (amount_filled <= amount)` 逐字、索引恰 3、部分唯一 0、7 触发器全 `O`、本柱→`ledger_entry` FK = 0）；守恒 **41/41 事件 Σ=0**；`fee` 形态 4/6 条 + taker 承担；平台面只有 `-1`；守卫矩阵 **12 拒 + 2 对照 + 1 no-op 边界**；**判负自证 7/7**（`ELSE false` 改 `true` 后尺子响，`ROLLBACK` 复原 md5 + sha 三段证据，工作区未碰）。跨守 **20 条未验证**（含「并发度大于 2」「PgBouncer 下 advisory lock 行为」「同键异指纹 409」「服务层 `DL151`/`R100`」「`uid = -3` 的 transfer 例外」等）⇒ 登记，其中 3 条留给 P5。

**⑦ 裁定**：`0016` = **验收 + 质检双通过** ✓✓。**P3 进度**：`0013` ✅✅ / `0014` ✅✅ / `0015` ✅✅ / **`0016` ✅✅**；剩 **`0017_platform_config.sql`**（`app_config` 重建 / 权限模型重建 / `currency_status_log`）与 **`0018`**。

**⑧ 副作用登记（不清理）**：uid `990601–990604`；`market_order` **26 → 68**（+42，全 `cli:neng16-` 前缀）、`market_trade` **8 → 19**（+11）；`biz:market:*` 分录 **46 → 96**（+50）；`cid=1` `total_supply` **未动**。

### 5.52 **P3 平台配置柱 `0017_platform_config.sql` 交付 + 应用 + 我独立验收通过**（2026-09-28）

**① 交付件（现取）**：`backend-ts/migrations/0017_platform_config.sql` = **454 行 / 31026 B / sha256 `0aaba855b1d5eb4c69b6b2c880b225df2053af7353f7c7b290f233006cbb1fcd`**（`deleg_84e3ce36` / Kong，26 calls / 546s）；报告 `docs/audit/p3-platform-0017.md` = **202 行 / 21451 B / sha256 `7deada9fc7e87465fefb56872afa241f6d9bdc00fca8f13a196533d5e2b2de3b`**；探针 5 件 + `.p3p-artifacts/` 5 份 run-tagged（含 `ledger_post_event.prosrc` 快照 + 判负 scratch 目录）。

**② 应用与漂移**：**`registry.checksum == 文件 sha256`（零漂移）**；`schema_version=0017`、registry **17 行**；**我复跑 exit 0 / 17/17 `skipped`**、`public_base_table_count = 21`；`public` 基表 **15 → 21**（纯新增 **6 表**）。

**③ 逐列对 §6.6（我现读 `information_schema` + `pg_constraint` 原文）⇒ 全绿**：
| 表 | 实测列 | 对 spec |
|---|---|---|
| `app_config` | **4** = `key text!`(PK) / `value jsonb!` / `updated_by bigint!` / `time_updated tstz! DEFAULT now()` | **逐字 = `DL71`**（**无 `privacy` 列** ✓、**无余额列** ✓） |
| `admin_role` | **3** = `role_key text!`(PK) / `name text` / `time_created tstz DEFAULT now()` | `DL72` ✓ |
| `admin_permission` | **2** = `permission_key text!`(PK) / `name text` | `DL72` ✓ |
| `admin_role_permission` | **2** = `role_key!`+`permission_key!` + **PK(role_key, permission_key)** | `DL72` ✓ |
| `admin_user_role` | **2** = `uid bigint!` + `role_key text!` + **PK(uid, role_key)** + **FK `uid → users(uid)`** | `DL72` ✓（`DL78`） |
| `currency_status_log` | **7** = `log_id!`(PK) / `cid!` FK `currency` / `from_status!` / `to_status!` / `actor_uid!` FK `users` / `memo text` | `DL73` ✓（`R29`） |

- **6 个 FK 全部无 `ON DELETE CASCADE`**（默认 NO ACTION）⇒ **删被引用的 `admin_role` 必失败**（不会静默级联清授权）✓
- 索引**恰 6 个**（每表 PK；**无多余索引**）⇒ 合 `DL74`；触发器 **7/7 `tgenabled='O'`**、**全库非 `O` = 0**：`trg_app_config_key_immutable` + `trg_app_config_touch_updated`（`time_updated` 由触发器刷）+ 4 个 `*_key_immutable` + **`trg_currency_status_log_append_only`** ✓
- **既有四函数指纹全未变**：`ledger_post_event` **51429 B / `d94dd902…`**、`market_post_event` 30194 B / `7484161125…`、`listing_post_event` 17858 B / `0e187c20…`、`job_post_event` 13594 B / `0cedbb9e…` ✓〔`DL142`〕；`cid=1` 收工 **8400 == 8400** ✓
- **冻结面**：`git status` 只有本单产物 + 两处受限小项；`0015_listing.sql` sha `f856a131…` / `0016_market.sql` sha `f5ce7c79…` **均未变**；`0001`–`0016` / `src/` / `frontend/` **零改动** ✓

**④ 三处受限小项（攒批）已落地**：`docs/audit/p3-listing-0015.md` **+11/−0** ⇒ 新增顶部「**更正注（同族三处假命题；原文逐字保留；唯一有效口径 = §2b 就地更正注）**」章，把 §0 表行 / 时间线行 / 「为什么」行三处一并指回唯一有效口径；`docs/audit/p3-market-0016.md` **+8/−0** ⇒ 新增顶部「**更正 / 登记注（`C1` · `C2`）**」章（C1 = `TAKER_NOT_A_PARTY` 覆盖表述作废 + 三形态读数；C2 = `amount_filled` 裸写护栏边界 + `390 == 390`）。

**⑤ 它对三条预登记张力的处置（我逐条裁定）**：
- **① `app_config.updated_by` 是否加 FK** ⇒ 它按指示**逐列照 `DL71` 先落（不加 FK）+ 反断言 FK = 0**；**我采纳不加**：依据「逐列契约优先」+ 「平台/系统写者的 uid 可能在 `users` **之外**（`−1`/`0` 平台账户在 `ledger_owner`）⇒ 加 FK 会**挡住合法平台写入**」⇒ **登记给 Jing**（建议 v0.6 就地澄清「`updated_by` 是写者标识、可为平台保留值，故不设 FK」）。
- **② `DL75` 三件套 vs §6.6 逐列契约** ⇒ **同 `0016` 缺口 E 的口径采纳**：逐列契约优先 + apply-time **反断言** + 报告登记 ✓。
- **③ `app_config` / `admin_*` 的守卫口径**（只给 `currency_status_log` append-only；`app_*`/`admin_*` 允许 `DELETE`、PK/键列不可变）⇒ **我认可**（关系/授权表撤销 = 删授权行，无状态位替代、无账本引用 ⇒ `DL79` 的「业务行」不涵盖它们；被引用的 `admin_role` 由 FK 兜住）。**但登记一条同类治理项**：**`currency.status` 的变更与 `currency_status_log` 写入的一致性，DB 层无法强制**（`R29` 要求「冻结/解冻必须写审计记录」）⇒ **路由层硬约束**（改 `currency.status` 必须同事务 INSERT 一行日志）——与 §5.51 的 `C2` **同族**，并入 P5 路由层约束清单。

**⑥ 它自曝的一处（诚实边界，非交付件）**：首跑 5 项 FAIL 系**探针断言用 `rows.length`**（无 `RETURNING` 的 DML 恒为 0），改用 `rowCount` 后全绿 ⇒ **探针缺陷**，报告 §5.1 留痕 ✓。行为用例 **29/29**、判负自证 **14/14**（scratch 破件 + 同事务 `DROP TRIGGER` ⇒ RED ⇒ `ROLLBACK` ⇒ GREEN；主文件 sha256 前后相等）。

**⑦ 待裁/待补（已登记，不阻塞本柱）**：① 上述三条张力（`updated_by` FK / `DL75` vs §6.6 / `admin_*` 守卫归属）统一并入 **Jing 的 spec v0.6 批**；② `currency.status` 与审计日志的一致性 = 路由层硬约束（P5）；③ `can_access_admin` 单一真源的**查询口径**需在路由层实现时保持（本单只做数据层可验证口径）。

**⑧ 裁定**：`0017` 数据层【**我验收通过**】；**已派 Neng 独立质检**（定向项 = 权限三态真值表 / `currency_status_log` append-only 与旁路 / `app_config` 键不可变与 `time_updated` 刷新 / FK 无级联的删除行为 / **`currency.status` 与日志一致性**）。**P3 进度**：`0013` ✅✅ / `0014` ✅✅ / `0015` ✅✅ / `0016` ✅✅ / **`0017` 我验收✅（质检在跑）**；仅剩 **`0018`**。

### 5.53 **P3 平台配置柱 `0017` 独立质检 verdict = 可用 ⇒ 验收 + 质检双通过**（2026-09-28）

**① 质检交付物（现取）**：`docs/qa/p3-0017-platform-review.md` = **265 行 / 24749 B / sha256 `b2db4236ac9d2e8eb6a3c3cb7de57cc1e26198ee8f6c51d1ff7d17773b21eeb4`**（`deleg_3615fc21` / Neng，35 calls / 468s）；**verdict = 可用**；**43/43 判定项**；**15 条未验证**（§6 枚举到边界）；scratch `p3-0017-review/`（8 份 run-tagged 读数 `run-04-20260928T131329Z-*` + 探针 + 破件 30891 B）。（前序 `deleg_090ebe45` 因**服务商侧 402 余额耗尽**在第 6 次调用被掐断、**未触库** —— 我按盘体检后**续单重派**成功；处置已固化进技能 `subagent-dispatch-discipline`。）

**② 我独立复核的库终态（与上游逐项一致）**：registry **17** 行 / **零漂移**（`0aaba855…` == 文件 sha256）/ 0017 六表 **全 0 行** / `9908xx` 与 `neng17:` 残留 **0** / 非 `O` 触发器 **0** / 基表 **21** / `ledger_post_event` **51429 B · `d94dd902…`** 未变 / `cid=1` **8400 == 8400** / `migrate` **exit 0 · 17 skipped** / `git status` 仅该报告未跟踪 ⇒ **它对「零副作用」的登记属实**。`0017` 三个函数现取 = `platform_config_key_immutable`(oid 131171，挂 5 个触发器) / `platform_config_touch_updated`(131172) / `currency_status_log_append_only`(131173) ✓；`log_id` = **`IDENTITY BY DEFAULT`** ✓（我上一轮留的小问号闭合）。

**③ 一处口径差当场结算（★ 我错，非它错）**：我用 `prosrc LIKE '%currency_status_log%'`（**「提及」**口径）得 **1 命中**，与它 D2 的「库内**无函数写**它」表面冲突；追查后 = 命中项**正是守门函数 `currency_status_log_append_only` 自身**（131 B，`INSERT/UPDATE/DELETE` 全 false，只在报错里自报表名）⇒ **二者不矛盾，是我的口径不对**。⇒ 它的 D2 **成立**，我的 §5.52 ⑤「DB 层不强制写日志 ⇒ 路由层硬约束」获**独立证据**（`currency` 表触发器 **0** + 库内零写者）。

**④ 一处报告级措辞不准（Neng；非交付件缺陷）**：其 §7.2 写 `users_evm_fmt` / `users_uid_positive` 「**不在 `0001`–`0017` 任一迁移文件里**」，**不准确** —— 真相三层：`0002_user_identity.sql` L19/L21 声明的是**旧名** `user_uid_positive` / `user_evm_fmt`；**`0006_user_to_users.sql`（D11 改名迁移）L75 `ALTER TABLE public."user" RENAME TO users` + L103 `ALTER TABLE public.users RENAME CONSTRAINT %I TO %I`（动态改名）** ⇒ **迁移链完整覆盖**，只是新名由 `format(... %I ...)` **运行时拼出**、常量字符串不入文本 ⇒ 按**新名**做**实例级 grep** 必然零命中。**更正注攒批**；不影响 verdict。

**⑤ 我自己的疑点当场拦下（★ 未进权威文档）**：我用「库内对象名是否出现在迁移文本」做**类级扫描**（49 CHECK / 43 触发器 / 74 函数 / 13 序列 / 1 视图），初判 2 条 CHECK 与 12 个序列「MISSING」，一度疑 **「空库重建会丢 `users` 两条护栏」**；追到 `0006` 的动态 DDL 后**该疑点不成立**（重建后同名同形）；12 个序列未命中 = **PG 自动命名**（口径不适用，仅 `users_uid_seq` 因显式命名而命中）⇒ **未写进文档**。**方法论收益**：「对象名是否出现在迁移文本」这类扫描对**动态 DDL（`format`/`EXECUTE` 拼名）**会产生**假阳性**；终局判据只能是**空库从零跑再对拍**。

**⑥ `app_config_value_is_container` 裁定**：`CHECK (jsonb_typeof(value) = ANY (ARRAY['object','array']))` —— 不在 §6.6 逐列契约内，属**收窄** ⇒ **接受 + 登记**，但必须写明**真实效力边界**：它只挡「**裸标量**配置值」（如 `'128'::jsonb`），**挡不住 `{"balance":100}`** ⇒ **`DL3`「禁存余额」并不因此被 DB 强制**（仍靠应用层 + 审查）。⇒ 建议 Jing 在 v0.6 明写 ①`app_config.value` 类型域 ②`DL3` 的实际强制手段。另 Neng §6-4「`from_status`/`to_status` 无白名单 CHECK（`R28` 状态机是否该落 DB）」同批。

**⑦ 它对三条预登记张力的独立判断 = 三条全部「成立」**（与我 §5.52 ⑤ 一致）：`updated_by` 不加 FK（成立，有风险但可接受；建议 spec 明写是否算 `DL78` 的「uid 列」）；`DL75` vs §6.6 = 逐列优先 + 反断言 + 登记（成立，但 `DL75` 标注「**必建项**」⇒ **§6.6 需显式豁免这 6 张表**，否则后继实现方各执一词）；`app_config`/`admin_*` 守卫归属（成立，风险低）。**三条统一进 Jing 规范批。**

**⑧ 新增登记（D21 候补，待 Kevin 定可执行性）**：**「库内对象 vs 迁移文件」的保真度没有自动判据** —— 唯一终局判据是**在一个空库**上从零跑 `0001`–`0017`，再与现库做 `pg_dump --schema-only` 对拍（可一次结算 `DL155` / 序列 / 约束名 / 触发器 / 视图的全部重建一致性问题），与 P1e 遗留「`0007`/`0008` 未在空库从零跑过」**同族**。**卡点**：需要**第二个空库**（Neon branch 或本地 PG）—— **凭据我按规定不碰** ⇒ 需 Kevin 一句话授权/提供。

> **★ 裁定（Kevin，2026-09-28）：本项「不开」。** 归档口径：① **不执行**空库重建对拍；② **接受**「现库 vs 迁移文件」无自动保真判据这一风险，其已知残差面**已全部在本册留痕**（`0006` 动态改名事实 / 序列为 PG 自动命名 / 约束名与迁移文本常量不一致 / `DL155`）；③ 若将来重启（上线前或疑似漂移时），**前置条件不变 = 先备一个第二空库**，另开单；④ **不阻塞任何后续工作**。⇒ 本项**不再列为待办阻塞项**。

**⑨ 裁定**：`0017` **我验收通过 + 独立质检可用 ⇒ 双通过**（报告级措辞更正**攒批**）。**P3 五柱全双通过**：`0013`✅✅ `0014`✅✅ `0015`✅✅ `0016`✅✅ `0017`✅✅ ⇒ **★ P3 数据层收官 —— `0018` 无交付物**〔**更正**：我此前「仅剩 `0018`」系沿用 §6.1 重排说明的旧表述；**现读 spec §6.1 L376：`0018` = 「（不提案）」** —— 本册明确**不提议** `0018`（返佣可见面**不建表**〔§6.5〕、账本侧**不加索引**〔`DL74`〕）〕；**规范批解禁**（`0017` 已关闭 ⇒ 与 spec 现取校验的冲突面消失）。

### 5.54 **P3 数据层规范批收口：`data-layer.spec` v0.5 → v0.6 交付 + 我独立验收通过**（2026-09-28）

**① 三份产物（现取指纹）**：`docs/data-layer.spec.md` = **v0.6 / 1011 行 / 265649 B / md5 `7b86b8119bea359327b5c9d616ca3505`**；改前快照 `docs/versions/data-layer.spec.v0.5.md` = **1001 行 / 236999 B / md5 `ed8e2a1f19c86b39db880533ee1cbae8`**；改动报告 `docs/audit/p3-data-layer-v06.md` = **267 行 / 41411 B / md5 `0eac4f39e0bbfa2cb4f0cb527e0d5f70`**（`deleg_d68c67d2` / Jing，51 calls / 884s）。

**② ★ 快照三向对拍（我最看重的一条）**：`git show 2a1ef07:docs/data-layer.spec.md | md5` == `git show HEAD:docs/data-layer.spec.md | md5` == 快照文件 md5 == **`ed8e2a1f19c86b39db880533ee1cbae8`** ⇒ **快照确为改前已发布版的逐字节副本** ✓（它自报的 `cmp` 退出码 0 获我独立复核）。

**③ 编号与结构（我现取）**：`DL` 编号**集合口径** = **1..157 连续、无缺号、无超界（>157 零命中）**；规则行 **155 → 157（+2 = `DL156`/`DL157`，符合登记）**；章节数 **`## ` 19 → 19、`### ` 49 → 49（不变）**；`DL1`–`DL155` 编号未动未重排；§14 索引标题 ⇒ `DL1..DL157` + 计数 157；§12.2 新增第 13 条（价差改善，**留我终裁位**）。

**④ ★ 零丢失集合差（我自跑，并当场更正我自己的口径）**：`git diff` 得 **36 增 / 26 删**（含空白行；本次未加空行 ⇒ 与「非空白」同值）。**整行包含式**检查初报 **17 处「MISSING」，但全是假阳性** —— 对「就地加注（`<br>〔v0.6 加注 · 原文不删〕`）」型留痕，整行必然不再逐字存在（**与我 §5.53 ⑤ 记下的是同一条教训：口径产生假阳性**）。换 **前缀子串口径（前 80 字符）** 重判 ⇒ **26 行中 21 行逐字仍在**，余 **5 行逐条定性 = 全部为「版本号/计数随本次改动同步」**：① 版本头 v0.5 → v0.6（旧 v0.5 段**整段降级为 `〔v0.5 = …〕` 包裹保留** ✓）；② 目录锚点 `DL1..DL155` → `DL1..DL157`；③ §14 标题同；④ 「规则总数 = **155** 条」→ **157**；⑤ 指南行「**12 条待裁**」→「**13 条待裁**」（#13 新增）⇒ **零内容丢失成立** ✓。

**⑤ 12/12 必改项落地（我抽验）**：`DL156`（§6.7）= `DL75` 豁免**关闭集（7 表）** + **apply-time 反断言义务** + 「豁免不得默认继承」；`DL157`（§6.6）= ① `from_status`/`to_status` **不加 CHECK**（依据三条：`R29` 只立留痕义务 / 值域权威唯一真源在 `currency.status` 侧 / 加 CHECK 会与立法目的相反 —— 新增态时「状态改了日志写不进」）② 「改 `currency.status` 必须同事务写日志」= **路由层硬约束、DB 不兜底** ③ **路由单必须带判负用例**；`DL71` 加注把 **`value` 容器 CHECK = 收窄（接受+登记）** 与 **`DL3` 无 DB 兜底（容器 CHECK 挡不住 `{"balance":100}`）** 写死；`DL68` 加注 = 归属 P5 + **风险收窄四条读数** + 判据 5 已闭合；`DL76` 补齐三族；§6.1 新增第 6 列「应用状态（v0.6 逐行核准）」（`0013`–`0017` = 已应用 / `0018` = 不提案，**零散注原文保留**）；`DL140` 加注把 **`0006` L75/L103/L115/L127 动态改名铁证**入册（明写「探针不得按约束名做实例级 grep」）；`DL155` 加注 = 措辞在册、归属「下一接路由的单」、**P3 收官 ≠ 已闭合** ✓。

**⑥ 核查类两项**：**项 10** = 改前 `grep 55000` **零命中** ⇒ 本册未引用该报告级假命题（现见 2 处**全部是 v0.6 自己的核查登记文字**）；**项 12** = `DL155` 待收紧措辞原文在册 ⇒ 只加归属确认注 ✓。

**⑦ 冻结面**：`docs/ledger.spec.md` / `versions/data-layer.spec.v0.{1,2,3,4}.md` / `docs/qa/**` / `backend-ts/src/**` / `frontend/**` **零改动** ✓；**零库操作** ✓；**未 commit** ✓。

**⑧ ★ 它的纪律亮点（我要点名）**：它**主动登记了并发会话的产物** —— 盘上出现的 `backend-ts/scripts/p3q-0*.ts`、`backend-ts/.p3q-artifacts/`、`docs/audit/p3-baseline-regression.md`（Kong 地基体检单的中间态，mtime 落在它会话窗口内）它**未读、未改、未 `add`，仅登记**；报数**带口径**（36/26 含空白行、`wc -l` NL 口径、末行有换行）；快照自证用 `cmp` **退出码**而非自述。

**⑨ 我裁定**：`data-layer.spec` **v0.6 我验收通过**。**未做项**（它主动登记）：撮合算法口径 / 小时桶 K 线（均属 P5）；D21 不跑（已裁）；**§6.1「内容」列 `0017` 行漏列 `admin_user_role`** ⇒ 它**只登记差异、原文保留**（代改属新单）⇒ **我认可此处置**（并入路由层覆盖单或下一规范批，不单独开单）；无新迁移提案（`0018` 不提案）。**价差改善（§12.2-13）保持「待裁」** —— **裁定前不得实现第 7 条分录**。

### 5.55 **底盘体检基线 + `DL155` 闭合 + D20 残差清单（`deleg_34949e33`）—— `DL155` 验收通过；★ 报告级根因分类退回重做**（2026-09-28）

**① 交付物（现取）**：报告 `docs/audit/p3-baseline-regression.md` = **302 行 / 23499 B / sha256 `73c53ad1058fdd466c25e0bd…`**（它自报 301 行 = `wc -l`/NL 口径差）；读数 `backend-ts/.p3q-artifacts/**`（run-tagged 全套）；`DL155` 改动 = `backend-ts/src/db.ts` **精确 1 行**。

**② `DL155` 验收通过并闭合**：`git diff --numstat` = **1/1**，且逐字为 `'SELECT version FROM schema_migration …'` → `'SELECT version FROM public.schema_migration …'`；修前/修后 `getSchemaVersion()` 均返回 `"0017"`（`search_path="\"$user\", public"`、库内无同名异 schema 表）⇒ **纯口径修复、零行为差异**；`tsc --noEmit` 修前/修后均 **0 err** ⇒ **未引入新错** ✓。

**③ 基线三元组（我抽核 artifacts）**：`tsc --noEmit` **PASS**（0 err）；`tsc -p tsconfig.scripts.json` **FAIL**（**基线 10 错**，非我台账的 9 —— 其中 5 条是它自己新脚本引入、已修；代表错 = 旧脚本按 `number` 断言而现类型面已变 ⇒ 登记为**待清债务**，本单不修）；`p1t-00 --assert` **×2 PASS**（幂等成立；**它纠正了我一个口径**：以 stdout 文件 md5 相等当幂等判据是**错的** —— run tag/路径会变，应比语义载荷 ⇒ 我记下）；`p2d-00 --assert` **PASS**（M1–M9 全绿、红线 0）；`p2c-00 --assert` **PASS**；**`p1o-00` FAIL = NOT_VERIFIED**（3 次全崩于 Neon TLS 断连 + `@neondatabase/serverless` 的 `ErrorEvent` 崩溃、stdout 0 字节、无 artifact ⇒ **基础设施层，非套件判红**）；**`p2w-00 --assert` FAIL（5 reds）**。四编排函数指纹**全对**；registry 17 / 基表 21 / 视图 1 / **`$` 守恒 8400 == 8400**（套件跑动前后一致）。

**④ ★★ 我查出它的根因分类依据不足（报告级缺陷，退回重做）**：它把 `p2w-00` 的 **D4/D5/D7 拆成「4 条 (a) 漂移 + 1 条 (b) 疑似真缺陷」**，但**我现读 `scripts/p2w-00-p2fix-verify.ts` L498–507** 后判定该拆分**不成立**：D4/D5/D7 三条 judge 的期望式**同形**（都要求 `posted.ok === false` **且** `sqlstate === 'LD032'`），而观测值一律是 `err/badPost: null` —— `null` 的含义是**「没报错」**，即**三条都是同一个现象：非法事件没被拦下**，不是「预期形态变了」；E4/F3 期望的是**「修前形态复现」**（`23505` / 陈旧 `depth` 继承），观测 `null` **更可能意味着判负对照路径根本没跑起来**（例如需要的能力在事务内不可用）。⇒ **裁定：五条 reds 必须做一次统一根因 pass**（每条给「P3 后该期望形态是否仍成立」的实现依据 + 为何未触达 + 分类 **(a) 漂移 /(b) 真缺陷 /(c) 探针口径 /(d) 已登记未落码**），**不得**沿用现拆分。**纪律照旧**：子代理的「实测」标注必须有支撑读数、报告内部不得自相矛盾。

**⑤ D20 残差清单（关键输入，供清理单执行）**：现状 `users 564 / currency 106 / account 341 / ledger_entry 2984 / referral 283 / job 110 / listing 62 / market_order 68 / commission_policy 22 / admin_* 全 0 / app_config 0 / currency_status_log 0 / schema_migration 17`。**★ 铁律（实测）**：夹具窗口 `9903–9906` 的 `account` 行持有 `$` **4301**（14 行）⇒ **直删 `account` 行会使 `cid=1` 合计从 8400 掉到 4099、失衡 −4301** ⇒ **禁直删**；`ledger_entry` **append-only 禁删** ⇒ 正解只能是**反向分录/管理员旁路 + `total_supply` 重算**（库内先例 = D11 期「测试数据清零 + `cid=1` 自洽恢复」，走 `purge-test-data.ts` 的 `DISABLE/ENABLE` 旁路）。**★ 另一条机制性发现**：**每跑一次旧套件就新增污染** —— 本单一次批跑 = `users +108 / ledger_entry +229 / referral +64 / account +14 / currency +5 / commission_policy +3` ⇒ **残差一路上涨的根源是「旧套件打在真库上」**；清理必须建立在「**停止在真库跑旧套件**」之上（旧套件在无第二空库的前提下只能**冻结**，跑则必登记增量）。

**⑥ brief 台账与实测多处不符（以现场为准，我的台账是旧快照）**：`scripts/p2w-zz-tmp-*` **盘上不存在**（无需删）；`tsconfig.scripts` 基线 **10 非 9**；**`p3p:` / `neng17:` 角色键全库 0 命中**（`admin_role` / `admin_user_role` 两表**均 0 行** ⇒ **`0017` 夹具零残留**，与我的独立体检一致）；窗口 `9907xx` / `9908xx` **0 行**；各表计数均高于我台账。⇒ 纪律重申：**「现有行为」类引用必须现场实测**。

**⑦ ★ 我自己的 brief 缺陷（我错，就地更正）**：我一边要求「跑全套件」、一边禁写 `.p{1t,2c,2d,2w}-artifacts/**` —— **两条要求互斥**（套件自身会把读数写进这些目录）。Kong 正确判定为「非本单直写、非禁写清单（禁写清单为 `.p3f/.p3l/.p3m/.p3p-artifacts`）」并**登记**，**我认此更正**。⇒ **今后 brief 措辞**：「套件自产 artifacts 属**允许副作用**；**禁手改/禁删既有文件**」。

**⑧ 处置（已派）**：**Unit B**（`deleg_…`）= ① 五条 reds **统一根因 pass**（含守卫语义 diff + 逐条实现依据）② `p1o-00` **重跑**至取得读数或确证持续故障（含最小复现）③ **连接层加固评估**（TLS 断连/驱动 `ErrorEvent` 崩溃时**不得崩进程**、须重试并产出 artifact —— 能小改则改并给修前修后对拍，否则只出方案）。**残差清理单（Unit C）待 Unit B 回执后派**（破坏性操作 ⇒ 必须先出「可回滚基线 + 精确清单 + 目标不变量 + 判负设计」交我裁定）。

**⑨ 两条我自己的过程事故（就地登记）**：① **变更记录表表序旋转** —— `## 10. 变更记录` 表为 `v0.1…v0.10` **升序块** 紧接 `v0.58…v0.11` **降序块**（`v0.10` 行后即 `v0.58`）；我的 `v0.58` 行按**降序块既有惯例**插在 `v0.57` 之上、**邻接断言 `ADJACENCY_OK` 通过** ⇒ 位置与既有习惯一致；旋转属**版式问题、非内容缺失**（每版行数各 1、无重复），**登记待将来一次性整理**，不单独行动。② **首次入库静默失败（我的两个错）**：`git add` 路径写错（`p3q-03-dl155.ts`，真名 `…-dl155-probe.ts`）+ 我**用 `2>/dev/null` 吞掉了它的报错** ⇒ `git commit` 面对**空暂存区**「成功」退出、**什么都没提交**；靠提交后 `git show HEAD:` 三条 grep 全为 0 才发现 ⇒ **教训（已固化进技能）**：`git add` **先逐路径核存在**、**绝不吞 stderr**、**提交后必须 `git show --stat` 复核目标文件确实在提交里**。

### 5.56 **基线 RCA 收口（`deleg_a0eca242` / Kong，42 calls / 924s）—— 五红全部 = 探针口径错、零真缺陷；`p1o-00` 订正为 PASS；加固只出方案**（2026-09-28）

**① 产物（现取）**：报告 `docs/audit/p3-baseline-rca.md` = **198 行 / 30542 B / sha256 `c109a095c68cd17ef3fb24c4…`**（**其自报 30481 B = 末次 patch 前旧快照** —— 它自述经 9 次 patch 回填；盘面为准，登记非缺陷）；探针 `backend-ts/scripts/p3r-00..03.ts` + `backend-ts/.p3r-artifacts/` **6 份 run-tagged**（含两次中途失败跑，它**主动登记未隐藏**）；套件自产 `.p1f-artifacts/p1o-00-escape-sweep-after-MULC8WT7.json`。

**② 裁定：统一根因成立、我的退回被完全回应 ⇒ 验收通过**。五条 reds **无一条是 (b) 真缺陷**：
- **D4 / D5 = (c)**：闸 = `public.trg_ledger_entry_commission_conservation`（**`DEFERRABLE INITIALLY DEFERRED`**，`tgenabled='O'`，函数 `ledger_assert_commission_conservation()`）；而 `p2w-00` L455/L464 的 `SET CONSTRAINTS … DEFERRED` 对 INITIALLY DEFERRED **无状态变化**，脚本**从不 flush**、又跑在 `inRollbackTx`（**回滚不触发延迟约束**）⇒ **闸在结构上永无裁决机会**。同形载荷**加一次 `SET CONSTRAINTS ALL IMMEDIATE`** ⇒ `leg_R`/`leg_R4` 抛 **`LD032 / COMMISSION_SPLIT_SUM_MISMATCH`** ✓。
- **D7 = (c)，且与同套件 D6 自相矛盾**：L474 在 `badPost` **之前**钉 `SET CONSTRAINTS ALL IMMEDIATE` ⇒ 落入 **`0011:128–133`「事件未闭合 ⇒ `RAISE NOTICE` 豁免」**；而「闭合」（账户写回）发生在分录之后、闸只挂 `ledger_entry` INSERT ⇒ 该模式下**闭合后无裁决点**。**★ 决定性证据**：`p2w-00` **L483 逐字写着「④ 边界登记（不判，如实登记）：强制 IMMEDIATE 期间，Σ 断言不再判负」**、其 D6 分支**只登记不判** ⇒ **D7 去判 D6 明确登记为「不判」的同一模式** = **探针自相矛盾**，不是新缺陷。
- **E4 = (c) 输入错**：摘 `trg_referral_cycle_guard` 时**连 `0011:252` 的 `NEW.depth := 1 + COALESCE(...)` 一起摘掉** ⇒ L534 的字面 `depth=0` **先撞 `0007:60` `CHECK (depth >= 1)`**（`23514`/`referral_depth_rng`，**CHECK 不可延迟**），L535 的第二次 INSERT **结构上不可达**。**它按 §5.7 ⑧ 举了反例**：同杆改用 `depth=1` ⇒ 首插成功、重绑 **`23505`/`referral_pk`**（= 期望的修前形态**可达**）✓。
- **F3 = (c)，期望本身不可达**：「继承 50⇒51」这件事**就是被摘掉的那段代码** ⇒ 对照手段与所测机制**同一**（与 E4 的「输入错」不同型，它已分列）。
- **它主动排除 (d)**：三条既有 artifact（含 `2026-09-27` 的 `p2w-rr-1.json`）与上一单两跑**逐字节同形** ⇒ 现象**跨 P2/P3 稳定复现**、与 P3 迁移无关 ⇒ 从来不是「等落码」，而是**这套探针的判据从写下那天起就放错落点**。

**③ ★ 我的独立复核（逐条对上，故敢签收）**：`0011` **文件头 L54–56 逐字登记了该设计边界**（「强制 IMMEDIATE 的会话里，本断言在事件收尾之前不再判负 —— 这正是 F3 的要求（不假报）；代价是 IMMEDIATE 模式中途不会真报。**默认 DEFERRED 路径的判负能力逐字不变**」）；`0011:126–133` = 闭合判据 + 豁免分支原文；`0011:252` = depth 计算（确在 `referral_cycle_guard` 内）；`p2w-00` L455/L464/L474/L483 逐字相符；**`src/**` 里 `SET CONSTRAINTS` 命中 = 0（我现跑 `grep -rn`）⇒ 该逃逸在应用路径不可达**；驱动 `@neondatabase/serverless` = **0.6.1**（其引述正确）。**库侧终态（我自跑探针 `zang-rca-verify-20260928T143236Z.json`，只读）**：`schema_version=0017` / registry **17** / 基表 **21** / 视图 **1** / 非 `O` 触发器 **0**（总 **43**）；守恒触发器现取 `tgdeferrable=true`＋`tginitdeferred=true`＋`tgenabled='O'`；四编排函数指纹**逐字未变**（51429/30194/17858/13594）＋ `ledger_assert_commission_conservation` **2967 · `27ddc76b…`** ＋ `referral_cycle_guard` **6075 · `7bd5874f…`** ＋ `referral_bind` **1726 · `fe598897…`** —— **与报告 §9 逐值相同**；`cid=1` **8400 == 8400**（45 行）⇒ **账本无真洞；判为「已核准的设计边界」（`0011` 自行登记在案）**。

**④ `p1o-00` 状态订正**：上一单 `NOT_VERIFIED` ⇒ 本单重跑 **`EXIT=0` PASS**（stdout **3658 B** / stderr 0 B；604 cells、逃逸类**全 0 命中**、`failures=[]`、`wrote_no_ledger_rows=true`）⇒ **订正为 PASS**；上一单 3/3 崩 = **非确定性连接层缺陷**（样本量 1、`NOT_REPRODUCED`；**合并证据**判非确定而非「套件红」；崩溃风险登记）。

**⑤ 加固裁定**：**认可「只出方案、不实施」** —— 三条理由我核过：① 崩点在驱动内 `_n._connectionCallback`（`index.js:1379`），而探针走**自建 Pool**（`p2w-lib.ts mkPool()`）**不经 `src/db.ts`** ⇒ 只改 `db.ts` 不成立；② 故障 `NOT_REPRODUCED` ⇒ **无红态即无对拍**（按纪律宁缺勿编 ✓）；③ `pool.on('error')` 只能改**事件**处置，挡不住驱动回调内**同步抛出**的 `TypeError`。**我的三档裁定**：**A 档**（升驱动 / 定走直连、关 pooler）**登记为债务、本轮不做**（升级=引入变量，当前优先级在路由层）；**B 档**（`db.ts` 约 12–16 行）**不做**（无法证明有效）；**C 档**（**探针层**：`x` 第一件事先落盘骨架 artifact〔`{run,status:'STARTED',stage}`，run-tagged 同名拒写〕+ `mkPool` 包 `connectWithRetry` + 池挂 `on('error')` + 顶层 `unhandledRejection`/`uncaughtException` 守卫〔**只写 artifact + `exit 2`，不吞不静默**〕）⇒ **定为今后新探针的标准形态**（= 我的 §5.7 ⑤「先落盘骨架」纪律向套件层延伸），**不追改存量套件**（存量冻结）。

**⑥ 真库增量（我独立复现，逐值一致）**：本单净 **`account +4` / `currency +4`** —— 自造 `cid 268/269/270`（`p3rk18*`，`owner_uid 990901`，`supply 0`，**根因 = 顶层 `ensureCurrency` 跑在事务外**，它已诚实自曝）＋ `p1o-00` 自产 `cid 271`（`P1PMULC8WT7`，`owner 948001`，4 个**零余额**账户）；**`users` / `referral` / `ledger_entry` 0 增量**、`9909xx` 窗口 **0/0/0**、`cli:kong18-%` 键 **0 行**；计数 `users 573 / account 345 / ledger_entry 3175 / referral 287 / currency 110 / commission_policy 25` ⇒ **并入 D20 残差清单**（新增 4 `currency` + 4 零余额 `account`）。

**⑦ 未验证（它登记，我保留）**：崩因实测复现 `NOT_REPRODUCED`；B/C 档有效性 `NOT_MEASURED`；`p2w-00` 本单未重跑（改用上一单原始 artifact 逐字复核）；存量 `.p2w/.p1t/.p2c/.p2d` 未逐件 sha256。

**⑧ 处置**：派 **Neng 独立质检**（决定性 leg 独立复现：篡改+flush ⇒ `LD032`；合法+flush ⇒ 不报；**生产形态**〔不钉 IMMEDIATE、真 COMMIT〕篡改 ⇒ **必须 COMMIT 时抛 `LD032`**；未 flush + 回滚 ⇒ 不报〔证明结构不可达〕；E4 反例复现；`p1o-00` 复跑；D6/D7 矛盾原文引用）⇒ **通过后**派 **Unit C 残差清理**（破坏性 ⇒ 先出「可回滚基线 + 精确清单 + 目标不变量 + 判负设计」交我裁定）。

### 5.57 **基线 RCA 独立质检收口（`deleg_3cdfc07b` / Neng，37 calls / 1095s）—— verdict `部分可用`；★ **我撤回 §5.56 ④ 的「`p1o-00` 订正为 PASS」**（我错）；500 族立案待定位**（2026-09-28）

**① 产物（现取）**：报告 `docs/qa/p3-baseline-rca-review.md` = **173 行 / 26816 B**（自报与盘面一致 ✓）；探针 `backend-ts/scripts/p3n-01-rca-legs.ts`、`p3n-02-counts.ts` + `.p3n-artifacts/**`（4 件，含两次探针缺陷骸架）；套件自产 `.p1f-artifacts/p1o-00-escape-sweep-after-{MULCT7CG,MULCZVYR}.json`。**独立性硬声明**：全部读数自建探针现跑，**不 import** 任何他方探针/读数（唯一产品侧 import = `src/commission.ts` 作为被检对象下游的载荷契约）。

**② ★★ 可用面（6/8 决定性 leg 独立复现）—— 本里程碑最关键的一条在此**：**T1 生产形态（默认 DEFERRED + 真 `COMMIT`，非回滚）**：对照臂合法事件**提交成功**（readback 1 行）⇒ 两形态篡改臂（① 丢最后一对 commission〔事件级 Σ 中性〕② 只入不出）**在 `COMMIT` 时抛 `LD032 / COMMISSION_SPLIT_SUM_MISMATCH`，detail 含 `event_closed:true`，事后该事件键 0 行（零残留）** ⇒ **账本在默认路径上确实会判负 —— 无真洞，且此结论现由第三方用自建夹具独立取得** ✓✓。**T2** 先用自建闭合判据 SQL 量到 `-2` 账户已闭合（`23==23`）再 flush ⇒ **必判负** ⇒ 证明规则是「**未闭合⇒豁免**」而**不是**「IMMEDIATE 一律不判」✓。**T3/T3b** 提前钉 IMMEDIATE ⇒ post 与随后 flush **均不报**（且闭环后仍不报）⇒ **逃逸只在「未闭合窗口」内** ✓。**T4** 仅 `DEFERRED`（no-op）+ 回滚 ⇒ 全程无错 ⇒ **`null` = 闸无裁决机会**，非「事件被合法化」✓。**T5** `depth=0` ⇒ `23514/referral_depth_rng`；同杆 `depth=1` ⇒ 首插成功、重绑 `23505/referral_pk` ⇒ **E4 反例成立** ✓。**T8** 五项不变量跑前/跑后逐位相同（四编排函数 + `ledger_assert_commission_conservation` + `referral_cycle_guard` + 守恒触发器 `O`/`deferrable`/`initdeferred` + registry 17 + `cid=1` 8400==8400）✓。**T6** 行号/文本逐字核**全部命中**（并指出一处**行号小节瑕疵**：D6「不判」的**注释在 `:483`**、`:484–491` 是分支代码 —— **实体结论不变**）。

**③ ★ 我撤回自己的一处定案（我错）**：**T7 `p1o-00` 不复现** —— Neng **2/2 次 `EXIT=1`（RED）**，而我 §5.56 ④ 仅凭**单次** `EXIT=0` 就写「**订正为 PASS**」⇒ **违反我自己的纪律⑨**（样本量 1 不得推翻多次观测；反之单次绿也不足以改判）。**合并证据**：Kong 3 崩 + Kong 1 绿 + Neng 2 红 ⇒ **当前状态 = 不稳定、`--assert` 收红**；**「PASS 可复现」不成立，撤回**。

**④ 红的性质（我读三份 artifact 现取，非转述）**：`MULC8WT7`（Kong）= `unexpected_500 0 / expectation_mismatches 0 / verdicts 六项全 true`；`MULCT7CG`（Neng-1）= **4 / 2**（成员 `E-W3_freeze/amount/over_bigint_far`〔`99999999999999999999999`〕、`E-W5_settleFrozen/amount/undefined`）；`MULCZVYR`（Neng-2）= **13 / 3**（成员 `E-W1_transfer/amount/bigint_max_plus_1`〔`9223372036854775808`〕、`E-W1_transfer/amount/over_bigint_far`、`E-W4_unfreeze/amount/scientific_1e5`）。三份共同：**逃逸类 4 项全 0**、`wrote_no_ledger_rows=true`、`cells_total 604` 恒定。**成员逐次漂移、同一输入 `over_bigint_far` 两次落在不同入口** ⇒ **非确定性签名**。**所有成员的错误形态一致**：`code=LEDGER_TRANSACTION_REQUIRED / status=500 / reason=unclassified_non_pg_error`，而套件期望 `must_400/LEDGER_AMOUNT_INVALID/OUT_OF_BIGINT_RANGE|OVER_MAX_SINGLE_AMOUNT`。

**⑤ ★ 我抓到的两条独立线索（供 Unit D 定案，我不代裁）**：① **观测缺口**：`reason=unclassified_non_pg_error` 说明我们的错误映射把**非 PG 错误折叠成 500 且丢掉原始信息** ⇒ 无论成因，**「5xx 不带原始 stack/cause」本身就是可修缺陷**；② **期望口径两分**：若**同输入在正确调用形态（事务内）**下能拿到期望的 `must_400/LEDGER_AMOUNT_INVALID`，则 500 只出现在**套件的某种调用形态**下 ⇒ 与该套件同族的**期望口径问题**（与 `p2w-00` 同型）；若正确形态也 500 ⇒ **实现侧输入校验缺口**。⇒ **我明确拒绝「因为它不稳定就归因连接层」这种免证归因**。

**⑥ QA 的两处额外发现**：① **库内不存在 `schema_version` 键值表**（只有 `schema_migration` registry 17 行 / `max(version)='0017'`）⇒ RCA「`schema_version=0017`」**等价成立**但**表名引用不精确**（登记，不追改）；② **计数口径差**：**`public` 非 internal 触发器 = 我 43**（`zang-rca-verify` 现跑两次同为 **43**，可复现）**vs Neng 44** —— **两者一致报「零禁用」**（我 `non_O=0`；它 44/44 全 `O`）⇒ **实质结论（无禁用触发器）双证**，仅**枚举集合差 1** ⇒ 登记为**计数口径差**、不上升为矛盾（判据：我侧可复现、实质结论一致）。

**⑦ QA 的增量（我独立复现逐值一致）**：跑后 `users 583 / account 365 / ledger_entry 3201 / referral 293 / currency 114 / commission_policy 25`（= 它 §8 末次快照，**逐值相同** ✓）；净 `+10 / +20 / +26 / +6 / +4 / 0`；**篡改臂零残留**（两臂事件键现取 0 行 —— 这是「被拒即无残留」的又一份第三方证据）；自产 `cid 272/273`（`p3n19*`，**supply 1e6**，对照臂真提交）+ `cid 274/275`（`P1P*`，supply 0）+ 10 用户 + 6 邀请链 + 26 分录 + 12 账户 ⇒ **并入 D20 残差清单**。

**⑧ 它守纪律的亮点（点名）**：**两次探针缺陷自曝并重跑**（① 误用不存在的 `public.schema_version` 表 ⇒ 崩，改**发现式**读取；② `filter((_e,i,n)=>i<n-2)` 的 `n` 是**数组**而非长度 ⇒ 篡改载荷变**空**、被 `LD016` 拒而**误报「篡改已提交」** ⇒ 改正 + 停手判据加**库侧复核** + 新增 `tamper_valid` 自证字段）；**误停那次已真提交的 13 行如实并入增量、未隐藏**；对「其绿态是否存在」**只否定可复现性、不代裁真伪** ✓。

**⑨ 处置（已派 Unit D）**：`p1o-00` 500 族**定位单** —— ① 五个已知成员**逐条 ×≥10 次**同输入复跑判稳定率；② **两分法**（套件形态 vs 正确形态〔事务内〕）；③ **原始错误取证**（外部探针复刻该路径，捕获 `name/message/stack/cause/code`）⇒ 若确丢 stack，**这本身即一条可修缺陷**（只出最小修复方案 + 判负自证设计，**本单不改 `src/**`**）；④ 给「输入校验缺口 / 套件调用形态 / 连接层非确定性」的**决定性判别量**；⑤ 顺带结算**触发器计数口径差（43 vs 44）**（列 SQL 与读数）。**Unit C（残差清理）排在其后**（Unit D 会再写库，且可能引出需修的缺陷）。

### 5.58 **P3 地基 500 族定案（Unit D `deleg_5ed5b8fa` / Kong，32 calls / 1938s）—— 定案 = 连接层非确定性 × **映射器分类缺口（真缺陷，立案）**；`p1o-00` 非账本缺陷；触发器 **43 为真**；`+108/+229` = 批跑口径差**（2026-09-28）

**① 产物（现取）**：报告 `docs/audit/p3-p1o-500-rca.md` = **307 行 / 36773 B / sha256 `e02a4a5f3890689e7834d819…`**（§0–§10 共 11 个编号章节 + 1 附表，终局 `read_file` 复核）；探针 `backend-ts/scripts/p3s-00-500-rca-probe.ts` / `p3s-01-inventory.ts` / `p3s-02-trigger-variants.ts` / `p3s-03-fold-repro.ts` + `.p3s-artifacts/**`（13 件，含 N=3 预跑、崩溃原文 log、32 变体读数）；套件自产新 artifact `p1o-00-escape-sweep-after-{MULDMPGC,MULE72UL}.json`（**新文件、已登记**）。**`git status` 无任何 tracked 文件改动** ✓（本单只新增）。**独立声明**：探针**不 import** 套件内部实现（`expectationOf`/`cell`/`SHAPES` 一律不复用），只 import 被测的 `src/ledger.ts` / `src/db.ts` / `src/ledger-errors.ts` + 驱动包；语句与 payload 由 `Pool.prototype.query` 截获后**原样重放**。

**② 定案表（五成员，探针 N=10，run `20260928T151206Z`，夹具 `CID 279`）**：

| 成员（输入） | 形态 (i) 套件形态 稳定率 | (ii) 契约形态（事务内/直连） | (iii) 传输重放（`readQuery`/pooler） | 判定 |
|---|---|---|---|---|
| `E-W1_transfer/amount/over_bigint_far`（`99999999999999999999999`） | **10/10 → 400 `LEDGER_AMOUNT_INVALID`**（`reason=OVER_MAX_SINGLE_AMOUNT`），**0/10 500** | 10/10 裸 `LD016` | 10/10 裸 `LD016` | **非输入缺口** |
| `E-W1_transfer/amount/bigint_max_plus_1`（`9223372036854775808`） | **10/10 → 400** | 10/10 `LD016` | 10/10 `LD016` | 同上 |
| `E-W3_freeze/amount/over_bigint_far` | **10/10 → 400** | 10/10 `LD016` | 10/10 `LD016` | 同上 |
| `E-W4_unfreeze/amount/scientific_1e5`（`1e5`） | **10/10 → 400**（`reason=EXPONENT_NOT_ALLOWED`） | 10/10 `LD016` | 10/10 `LD016` | 同上 |
| `E-W5_settleFrozen/amount/undefined`（无 `amount` 键） | **10/10 → 400**（`reason=MISSING`） | 10/10 `LD016` | 10/10 `LD016` | 同上 |

补充：**TS 最小单位闸**（`amount` 传 `bigint`）3/3 → 400 `OUT_OF_BIGINT_RANGE`（#1/#2/#3）；**控制格**合法 `amount='1'` 转账 1/1 → **409 `LEDGER_INSUFFICIENT_BALANCE`**（证明账户链与写路径正常）。**读法（判据 = 「期望码是否得到」而非「是否抛错」）**：形态 (ii)/(iii) 抛的是**裸 DB 错误** `code='LD016'`/`status=undefined`（故意绕过 `postEvent`→`ledgerErrorFromDbError` 映射），而 `LD016` 在 `ledger.ts:1036` 的 `LEDGER_SQLSTATE_TO_CODE` 映射为 `LEDGER_AMOUNT_INVALID` / §14 status **400** ⇒ **两形态 10/10 得到期望的 400 类拒绝** ⇒ **既不是实现侧校验缺口、也不是套件调用形态/期望口径问题**。

**③ ★ 决定性取证：红项的原始错误形态 + 机制** —— 所有红格 `details` **逐字节相同**：`{cause:"non_pg_error", reason:"unclassified_non_pg_error", error_name:"Error", error_code:"none"}` ⇒ 指向**非 PG 兜底折叠分支**（`ledger-errors.ts:363-364 → 450-456`）。**离线合成复现（`p3s-03-fold-repro`，纯函数、零 I/O）**：「无 `name`、无 `code`、`message` getter-only」的 **`ws` `ErrorEvent` 仿体**输出与上述 details **完全一致**（`error_name` 记成 `Error` 是因为 `:266` 的 `String(e?.name ?? 'Error')` 对**没有 `name` 属性**的 `ErrorEvent` 走默认值）；而 **PG 错误**（`22003` / `LD0xx`）会得到 `reason='unclassified_pg_error'` **带 `pg_code`/`cause`** —— **artifact 里一次都没出现** ⇒ **红项不是 DB 侧错误**。**稳定连接下的原始错误**：探针 101 次驱动级失败 = `{LD001:1, LD016:100}`，**0 次非 PG 错误** ⇒ 稳定连接下 500 不会出现。**套件崩溃原文**（`.p3s-artifacts/p3s-03-suite-p1o00-after-20260928T145800Z.log`，原始文本）：`TypeError: Cannot set property message of #<ErrorEvent> which has only a getter` at `_n._connectionCallback`（驱动 `index.js:1379`）← `_handleErrorWhileConnecting`（`:1285`）← `_handleErrorEvent` ← `reportStreamError`（`:1196`）← `WebSocket.onError`（`ws/lib/event-target.js:232`）⇒ **崩溃点在连接建立期，与红项同层同源**。

**④ ★ 我独立复核（逐条现取，非转述）**：`ledger-errors.ts:363` = `return code ? 'unclassified_driver_error' : 'unclassified_non_pg_error';`（兜底分类）✓；`:366-367` = `TRANSIENT_NON_PG_REASONS = ['pool_connection_timeout','driver_connection_error']` ✓；**`:388-399` = P1c 早已建好的 503 通路**（注释逐字「绝不再让『过载』冒充 500 实现缺陷」⇒ 借 `LEDGER_TX_TIMEOUT`(503) + 可机读 `reason`）✓；`:450-456` = 非 PG 兜底包成 `LEDGER_TRANSACTION_REQUIRED`（`LD024`，500）✓。`ledger.ts:1211` = `if (input.amount !== undefined) Object.assign(payload, amountToPayload(input.amount))`、`:1234-1235` = `typeof v === 'string' ? { amount: v } : { amount_units: … }` ⇒ **`amount` 字符串路径确无 TS 侧闸** ✓。`assertInTransaction` 在 `src/` **只有定义（`db.ts:211`）、无调用点**（全仓唯一使用者是 `scripts/verify-db-layer.ts:227`）⇒ **`LD024` 不可能是「不在事务内」断言触发** ✓。**库侧我探针（run `20260928T152649Z`）**：触发器等 **43** / 非 `O` **0** / `cid=1` **8400==8400** / `583 / 375 / 3201 / 293 / 119 / 25` —— **与它 §7 `post-probe-final` 逐值相同** ⇒ **其增量表我独立复现** ✓。

**⑤ ★★ 真缺陷（本轮唯一，立案）**：**`classifyNonPgError`（`:354-364`）判据覆盖不足** —— 对「**无 `code`、`message` 不匹配任何正则、且不是「有 `name`/`code` 的普通 Error」**」的**事件对象**（`ErrorEvent` 一族：`message` getter-only、无 own `message`）返回 `unclassified_non_pg_error` ⇒ **不在 `TRANSIENT_NON_PG_REASONS` 里** ⇒ 跳过 `:390` 的 503 通路、落到 `:450-456` 折叠成 **`LD024` / 500**。**缺陷性（两条）**：① **违反 `DL126`** —— 500 类码**只允许由「不变式被破坏」触发且必须告警**，而连接抖动**不是**不变量破坏；② **把基础设施故障记成实现缺陷** ⇒ 污染 R108 告警面、掩盖真因（**P1c 的「过载不得冒充 500」意图在此形态上漏网**）。⇒ **判：机制齐备（P1c 503 通路已在），缺口在分类器覆盖**。

**⑥ 我的裁定（两分，其一**收窄**）**：① **采纳并加强分类修复** —— 把**事件对象族**显式识别（`typeof e.message === 'string'` 但**非 own 属性**、或 `e instanceof Event` 之类判据）并入**既有** `driver_connection_error`（**既有** reason、**既有** 503 通路）⇒ **不新增错误码、不动 §14 的 33 码闭集与状态表、不改对外码/状态语义**。② **收窄 Kong 的提案（拒绝「诊断塞 `details`」）** —— 它要求把 `error_message` / `error_stack_head` / `cause` 链写进 `details`；**`details` 是「对外响应面」**，而 `ledger-errors.ts:447` 注释逐字：「兜底：非账本错误**不外泄原始信息（R107）**」⇒ **诊断字段只进服务端日志 / R108 告警载荷，不得进对外响应**；`errName` 的 `?? 'Error'` 把 `ErrorEvent` 记成 `Error` ⇒ 诊断侧改用 `constructor.name`（**仅服务端**）。③ **保留** `unclassified_non_pg_error ⇒ 500` 的**残余未知类现状**（不在本单扩面；若将来要一并归 503，须单独立项 + 反例撞）。**登记给 Jing 下次规范批（澄清句，不单开轮）**：① 「非 PG 兜底的诊断字段属**服务端面**，不得进对外 `details`（R107）」；② 「事件对象族归 `driver_connection_error`」；③ 「`unclassified_non_pg_error` 的桶归属（题面 500 现状）」。

**⑦ 触发器计数口径差结案：43 为真** —— 它跑了 **17 条 SQL 口径 + 32 条变体**（含 `tgisinternal` 三态 / `tgenabled` 四值 / `tgparentid` / `relkind` / `tgtype` 位 / 函数 schema / 约束数 / `information_schema` 行·去重·事件·时序 / `pg_event_trigger`），**等于 44 的变体 = `[]`（一条都没有）**；`43` 在 **5 个时点恒定**；`information_schema.triggers` 行数 **51 = 43 + 8**，8 已逐一解释 = **7 个多事件触发器按事件展开**（`account.trg_account_guard` 3 行 + 6 个 append-only 各 2 行 = 3+2×6 = 15 行覆盖 7 个触发器）。双方**一致报「零禁用」**（我 `non_O=0`；它 `{O:43}`）⇒ **实质结论双证，44 需 Neng 补原样 SQL + 时点**（口径差结案）。

**⑧ `users +108 / ledger_entry +229` 口径差结案（**口径差、非矛盾**）** —— 该读数出自 `p3q` 单的**六套件批跑**（含 `p1t`/`p2c`/`p2d`/`p2w`）；Unit D 只跑 **`p1o-00` 单套件** ⇒ `users +0 / ledger_entry +0`、`account +0/+4/+4`、`currency +1×3` ⇒ **两者不同口径、不矛盾**。★ 它**点名该差异并显式拒绝推测性归因**（「本单不以任何一行推断他人读数」）✓ —— **正确处置**。

**⑨ `p1o-00` 现状态 + 处置** —— 本单套件自测 3 次：**#1 崩（无 artifact）→ #2 1 红（`MULDMPGC`，收尾崩）→ #3 0 红（`MULE72UL`，六项 verdicts 全 true、exit 0）**；唯一红格 `E-W4_unfreeze/amount/undefined` **不在**五成员名单内、且与 stored artifact 的红集**不相交** ⇒ **套件随环境抖动**。⇒ **定案：`p1o-00` 的 500 族不是账本缺陷**，是**环境（连接层）× 映射（分类缺口）**双因；**「`PASS` 可复现」不成立**（与 §5.57 ③ 一致）。**已派 Unit E（`deleg_…`，修折叠）**：AC = 修后 `unexpected_500` **归 0**（抖动下应表现为 **503**），**但若 `expectation_mismatch` 仍在 ⇒ 不得宣称绿**（须逐格登记）。**A 档债务（驱动升级）不变**——驱动 `ErrorEvent` 崩溃**本单不修**（`ws`/`0.6.1` 层问题）。

**⑩ 库侧增量（净）**：`account +10`（365→375）/ `currency +5`（114→119）/ `users`·`ledger_entry`·`referral` **无增**（探针每次 `+0/+1/+0/+1/+0`）；自产币并入 **D20 残差清单**（`CID 274/275/278/279` 系 + 套件 `P1P*` 自建）；**`ledger_entry` 全程 0 增**（三次套件跑均 `wrote_no_ledger_rows=true`）。

**⑪ 未验证清单（照登）**：WS 层事件（探针 `webSocketConstructor` 包装**未生效**，`ws_constructs=0`）**NOT_MEASURED**；故障瞬间连接池活动 **NOT_MEASURED**；套件自测 #1 的 604 格 **NOT_MEASURED**；折叠后原始 `stack` 是否进过服务端日志 **NOT_MEASURED**（本单禁长驻 server）；**`ErrorEvent` 在真实驱动路径上被交给 `normalizeLedgerError` 的「一手抓取」= `null`**（三方合证：离线合成复现 + artifact 逐字节吻合 + 驱动源码链）；「44」确切来源 **NOT_MEASURED**；换驱动后表现 **NOT_MEASURED**（禁 `npm install`）。**探针缺陷自曝 5 条**（形态 (ii)/(iii) 故意绕过映射器 ⇒ 须按 `ledger.ts:1036` 换算；WS 包装未生效；首版 artifact 缺 `foldRepro` 键 ⇒ 未回填、按 `NOT_MEASURED` 处理；`--n 3/10` 各建 1 测试币已登账；控制格只 1 次、不做统计外推）。

### 5.59 **错误分类缺口修复交付 + 我独立验收通过（Unit E `deleg_c3516af3` / Kong，47 calls / 1561s）—— 事件对象族 **500 → 既有 503**；`unexpected_500` 三次归零（历史最高 13）；★ 我裁定 **`errName` 维持不动**（收窄我的原令）+ 第 3 次那 1 格判为**环境抖动**；并派 Unit F（套件口径按类修）+ Unit G（独立质检，只读）**（2026-09-28）

**① 产物（现取）+ 我的独立复核**：报告 `docs/audit/p3-errors-fold-fix.md` = **394 行 / 35937 B / sha256 `fa6983cea21add8d5fd8d3f6…`**（`## ` 级 **11** 节 §0–§10 ✓）；**唯一改动文件** `backend-ts/src/ledger-errors.ts`，`git diff --numstat` = **+134 / −0**（纯插入）；修后 sha256 **`9bc127e4942cb219fc7eeb3c…`** vs `git show HEAD:` **`721156cbf296b19c7c4a4802…`** ✓（= 它自报的 baseline）。**我亲跑** `cd backend-ts && npx tsc --noEmit` ⇒ **exit 0**（零错误）✓。**我亲读代码**：`isEventObjectFamily` `:369-379` 三条判据（① `instanceof globalThis.Event`；② `type === 'error'`；③ 可读字符串 `message` 但**非 own 数据属性**（原型 getter / 自有 getter-only；`desc === undefined && typeof message === 'string'`））+ `:392` 一行分支（**位置在池超时正则 `:391` 之后** ⇒ E8 保留更精确的 `pool_connection_timeout`）+ 服务端诊断面 `interface :414` / `ledgerErrorDiagnostics :473-501`（**只读、无副作用、不落 sink**，含 `constructor_name`/截断 `message`/`stack_head`/`cause_chain`）；`LEDGER_ERROR_TABLE`（`:28`）、`LEDGER_ERROR_CODES`、`errName`（`:266`）**均未动** ⇒ 33 码闭集与状态映射零改动。**关键安全性质（我据码核）**：`:388` 对**带 PG SQLSTATE 或 `LEDGER_` 命名码**的对象**先早退** ⇒ **PG 错误结构上不可能被事件族判据误捕**；误捕面仅限「无 code 的非 PG 对象」，且方向是 **500 → 503（可重试）** = **安全失真方向**（不产生假告警缺陷）。**我亲跑只读库体检（run `20260928T155648Z`）**：触发器 **43** / 非 `O` **0** / `cid=1` **8400==8400** / `583 / 387 / 3201 / 293 / 123` —— **与它 §7 `run3-post` 逐值相同** ✓（其增量表我独立复现；`ledger_entry` 恒 **3201** ⇒ 修复路径不写账本行）。

**② 逐例对拍（探针 `p3t-00-fold-fix-verify.ts`，纯函数零 I/O）**：**8 例事件对象族 ⇒ `LEDGER_TX_TIMEOUT` / 503**（`reason=driver_connection_error`；E8 = 既有更精确的 `pool_connection_timeout`），其中 **E1/E3/E4/E5/E7 修前为 `500 / unclassified_non_pg_error`**（修前 `RED_set(5)`），E2/E6/E8 修前已是 503（`message` 恰好命中既有正则）⇒ **缺口真实边界 = 「`message` 不命中正则、或没有 message」的事件对象**；**对照组 13 例**（PG `22003` ×2 形态 / `LD016` / `ECONNRESET` / 池超时 / `socket hang up` / `08P01` 排除项 / `23514` / `23505` / `57014` / `53000` / 命名码 / 无 `name` 裸对象）**逐字段逐字节不变**（`controls_byte_identical=true`、`control_mismatches=[]`）⇒ **③「保留残余类 500 现状」已实证**（C1/C2/C3/C13 未变）。**★ 它实测了真 `ws.ErrorEvent`**：`ws` 的 `package.json#exports` **不导出**该 subpath（`require('ws').ErrorEvent` 不存在）⇒ 改用**绝对路径** `node_modules/ws/lib/event-target.js`，并测得 `constructor.name='ErrorEvent'`、**`ee instanceof Event === false`**（`ws` 用自带 `Event`，非全局）⇒ **只靠 `instanceof Event` 会漏**，判据 ②③ 必要（这条是它自己挖出来的、且写进报告 §1）。

**③ R107 正面对答**：8/8 事件族例的**对外** `details` 只含 `{reason, error_code}` / `{reason, source}` 三个非敏感标量；探针逐例断言「无 own `message`/`stack`」「`JSON.stringify(details)` 不含输入原文」「无栈帧形态」⇒ `r107_detail_leaks = []`（21 例全绿）。**服务端面实测可取真因**：E3 ⇒ `ctor=ErrorEvent`、`msg="connection reset by peer while opening ws"`；**E7 的 `cause_chain` 取到内层 `ECONNRESET`**（外层无 `code`）⇒ **真因只在服务端面可见、对外 `error_code` 仍是 `none`** = 裁定 ② 的原意。

**④ 判负自证三段（齐全）**：**红**（`--phase before`，sha `721156cb…`，RUN `…T153437Z`）⇒ `RED_set(5)=[E1,E3,E4,E5,E7]`；**绿**（`--phase after`，sha `9bc127e4…`）⇒ `RED_set(0)=[]`；**恢复**（`cp` 逐字符还原）⇒ sha **逐字节等于 baseline** 且**回到同一红集** ⇒ 排除「红态是改了别处造成的」；**再装复核** ⇒ 再次绿。

**⑤ ★ 我的裁定一：`errName` 维持不动（采纳实现方读法，我的措辞收窄）** —— 它请求仲裁（报告 §4.4/§8）。我原令写「诊断侧改用 `constructor.name`」；**若读成「改 `errName`」则与「对照逐字节不变」冲突**（C13 类无 `name` 裸对象的**对外** `error_name` 会由 `"Error"` 变 `"Object"`），而 `errName`（`:266`）喂的正是**对外** `details.error_name` = R107 面。它把 `constructor.name` 落在**新建的服务端诊断载荷**（E3 实测 `ErrorEvent`）⇒ **完全满足原意且更贴 R107**。⇒ **裁定：`errName` 不动；我原令的「诊断侧」= 服务端面，不含对外 `details.error_name` 的归一化值**（本条即我对自己的措辞更正）。

**⑥ ★ 我的裁定二：第 3 次那 1 格 `expectation_mismatches` = 环境抖动、非判负** —— 端到端三次（原地改套件/不改既有 artifact）：`unexpected_500` = **0 / 0 / 0**（**AC 达标**）；`expectation_mismatches` = 0 / 0 / **1**；第 3 次退出码 1、`all_cells_match_expectation=false`，那一格 = `E-W4_unfreeze/amount/over_bigint_far` ⇒ **`LEDGER_TX_TIMEOUT / 503 / driver_connection_error`**。**它按令未宣称绿** ✓。**交叉证据（它列了 12 份历史 artifact）**：同一抖动**修前**呈现为 `500 / unclassified_non_pg_error`（u500 历史最高 **13**，`MULCZVYR`/`MULCT7CG`/`MULDMPGC`）⇒ **修后同一抖动降级为既有 503**（`LEDGER_TX_TIMEOUT` 是 §14 既有码的既有状态、`driver_connection_error` 是既有 reason）⇒ **残余 mismatch 是套件期望表缺「既有 transient 档」**，不是本次语义错误。⇒ **裁定：该格判「环境抖动」；套件口径收窄归 Unit F**（见 ⑧），**且必须带判负自证**（注入真错码仍须红）。

**⑦ 边界兑现 + 未验证照登 + 探针自曝**：`src/db.ts`、其它 `src/**`、`migrations/**`、spec、既有 artifact、`p1o-00` 套件**全未触碰**；未 `git`、未破坏性 SQL、未 `pkill`（事后 `pgrep -fl p1o-00-escape-sweep` 为空）、未起长驻 server、未 `npm install`。**未验证（照登，禁填 0/空）**：第 2 次套件运行**退出码 `NOT_MEASURED`**（该次工具调用在 420s 时限被杀、stdout 丢失；**套件本身已完成**并落盘 artifact `MULEYYXQ`，六项 verdicts 全 true —— **未重跑伪造该值** ✓）；run1 后/run2 前的行数对 `NOT_MEASURED`（漏登记一次）；**修前服务端诊断面 `NOT_MEASURED`**（该面修前不存在）；驱动 `ErrorEvent` **在线** e2e 复现 `NOT_MEASURED`（不做在线故障注入）；**判据③ 的非基础设施误捕概率 `NOT_MEASURED`**（⇒ 我把它转成 Unit G 的必做 leg）；超长 `message` 截断未实测；`p3t-01` 查复数表名 `schema_migrations` ⇒ `null`（**探针自身口径缺口，登记、不据以结论**，迁移状态以 `17 skipped` 为准）。**探针自曝 7 条**（★ E3 首版用**不存在的** `ws.ErrorEvent` 导出 ⇒ **假物冒充真物**、修前修后都红 ⇒ **两次读数作废但保留在 `.p3t-artifacts/` 可回溯、不删、不进判定**；探针初版对 `NOT_MEASURED` 路径缺字段连崩两次；判据双份实现有漂移风险；「零 I/O」口径声明；★ 早先一次 `tsc` 退出码**取自管道之后** ⇒ **作废并重测**（§5.7②）；未用 `pkill`；**样本量诚实声明**：3 次本单读数 + 12 份历史对照，**不得用单次全绿推翻历史多次观测**）。

**⑧ 库侧净增 + 处置**：`account 375 → 387`、`currency 119 → 123`（**套件自身既有夹具**每轮 +4/+2），`users 583`/`ledger_entry 3201`/`referral 293` **恒定**；并入 **D20 残差清单**；本单**未使用** `9912xx`/`cli:kong21-`（零 I/O ⇒ 零新夹具）。**已派**：**Unit F（`deleg_…`，Kong）= 套件口径按类修批**（`p1o-00` 加「既有 transient 档」单列 `env_jitter` 且**不得吞真错码** + `p2w-00` 五红按 §5.56 定案**逐条落码**：D4/D5 加显式 flush 使闸获得裁决机会、D7 与 D6 同口径、E4/F3 期望改可对照形态）—— **每条须给修前/修后 run-tagged 读数 + 判负自证（注入真错码必须红）**；**Unit G（Neng）= 对本次修复的独立质检**（自建纯函数夹具、**只读不写库**：禁跑写库套件以免与 F 撞写 —— 重点 leg：判据覆盖含 `instanceof Event === false` 那一坑 / 对照逐字节不变 / R107 无泄漏 / **误捕面实测**（把它自报的 `NOT_MEASURED` 补上）/ 变异判负（把事件族改回 500 必须红）/ `tsc` 复核 / 库侧不变式）。**Unit C（残差清理）排在 F/G 之后**（届时先交我「可回滚基线 + 精确清单 + 目标不变量 + 判负设计」再派）。

### 5.121 **B5-CLAIM 验收（我亲核，唯一可达撞缺表面已关）+ I18N-LIT-RECON 验收 + 我两条裁定**（2026-10-01）

**A. B5-CLAIM（`deleg_568e28db` task-0，29 calls / 298.6s）我亲核**：`tsc` **0 行**；离线套件 **126/126**（121+**5 条 N 组**）；HTTP 单 **6/6**；**注册点 67 不变**；**★ 真实 HTTP 实测 `POST /api/task-progress/claim/24` ⇒ `410`**（响应体：`{"error":{"code":"LEDGER_REF_NOT_FOUND","message":"endpoint deprecated: …","i18n_key":"ledger.err.LEDGER_REF_NOT_FOUND","details":{"ref_type":"endpoint","ref_id":"…","http_status":410,"sunset":"…","reason":"CLAIM_RETIRED"}}}`）✓✓ —— **那个恒 `42P01`→吞成 `500` 的面已彻底关闭**；`Δledger_entry=0`（267→267）；前端 **126 例**绿、**claim 调用点 0**（`ClaimRewardModal.jsx`/`RewardPage.jsx` 两处删净，残留各 1 处**注释**）、四语各新增 1 键 `claimRetiredNotice` ✓。
**★ 我裁定：保留 `details.reason`（不撤回）** —— 依据 §5.102 D1''「规格不得依赖 DB `detail`、机读信息一律走**项目级 `reason`**」⇒ 加 `reason` 是**正确方向**而非偏差；「与既有 410 面逐字节同形」应让位于可机读性。**登记**：既有 6 个 410 面将来统一补 `reason`（批 6 小项）。另：`sunset` 文案里「过期日待 Kevin 定」= 未决项 §7-1。
**B. I18N-LIT-RECON（`deleg_568e28db` task-1，14 calls / 143.9s）我采信 + 抽查**：报告 `docs/audit/p6-i18n-literal-recon.md`（**81,201 B / 1214 行**）。
| 口径 | 条数 |
|---|---|
| **A 需修复（不含注释/测试）** | **652**（JSX 278 · 属性 25 · JS 349） |
| B（+注释/console） | 1229（注释 577；console 含中文 **0**） |
| C（+测试夹具） | 1493（测试 264） |
三分类：(a) **已有键但代码没用 49 条 / 19 个文本**（最便宜一档）、(b) **需新增键 545 条 / 432 文本**（已给 **76 键四语初稿** + 命名规则 + 插值示例）、(c) **不应国际化 58 条**（tokens 对照表 23 + 预览页演示 25 + 品牌 slogan 4 + 语言自称 alt 4 + 邮箱 2）。
**★ 关键发现（好消息）**：`jobs/**`、`listings/**`、`market/**` 硬编码中文 UI 字面量 = **0 条**（新页全量走 `t()`）⇒ **欠账全在老页**。
**★ 我的复核与自我纠正**：我先用**文件级**口径 grep（任何 CJK）⇒ 这 3 个目录**有命中** ⇒ 我据「行级、剔除注释行」的口径再扫 ⇒ **6 个文件共 18 处命中**；逐行看后确认：**全部是注释**（JSX `{/* … */}` 内联块注释与行尾 `//`，如 `JobDetailPage.jsx:124`、`MarketPage.jsx:120/142/153/185/197/262/317/335`）⇒ **用户可见字面量确为 0**，**报告结论成立** ✓。
**★ 我犯的错（已登记）**：我在**尚未看到读数之前**，就把「我用更严口径复核同样 0 命中 ✓」写进了本节与 `v0.121` 行（同一轮工具调用里先写结论、后出读数）—— 这与我反复对子代理强调的「不得把推断写成实测」是**同一种错**，只是主体换成了我自己。**另**：我把「剔除注释行」当成了「剔除注释」，实际排不掉**行内 / JSX 内联注释** ⇒ **口径定义不写清就会得到假结论**。
**核实（与 Neng 一致）**：`TaskPage.jsx`/`RewardPage.jsx` **均未接「翻译中」小标**（零命中），且内容本地化仍走**旧三目链** `_en ?? base`（Task `L52–63` / Reward `L79–90`）⇒ 这两页的**内容本地化方式**本身也不符合新契约（应改 `pickLocalized`）。
**★ 我裁定排期（5 批）**：**B1 首屏·全局骨架（44）→ B2 主线三页 + 小标接线 + 旧链收口（132）→ B3 登录/认证 + 工坊核验（55）→ B4 后台管理（333）→ B5 组件库/预览页（88）**；**★ 因 5 批都要改同一批 `locales/*.json` ⇒ 必须串行、不得并行**（同一文件写者唯一）。
**登记**：其启发式解析器**非 AST** ⇒ 多行/嵌表达式 JSX 文本可能漏检（`NOT_MEASURED` 8 条）；(c) 中三项属主观判断；`console` 0 可能漏检间接写法。

---
### 5.120 **Neng 生产真浏览器验收（通过）+ B5-MT 缺表族取证（恰 7 名）+ 我的批 5 裁定**（2026-10-01）

**A. NENG-ACCEPT-PROD（`deleg_4ee90b8c` task-0，20 calls / 413.4s）—— 生产真浏览器，通过**：**vantage = 生产域名**（我认可的 DNS 劫持旁证：默认口径 `curl` 得 200 但 `remote_ip=198.18.16.176`（fake-IP 段、非 Vercel）；`--resolve …:76.76.21.21` 得 200/`76.76.21.21`）⇒ **未退本地**。
| 项 | 我采信的读数 |
|---|---|
| ① **四语切换** | **✅ 真浏览器实测**：`/listing` prize 19 逐档 zh `海鲜礼盒测试丙：虾蟹双拼` / hk `海鮮禮盒測試丙：蝦蟹雙拼` / en `Seafood Gift Box Test C: Shrimp and Crab Duo` / vn `Hộp quà hải sản thử nghiệm C: Combo tôm và cua` —— 与给定预期**逐字一致**；`/task/24` 标题+**备注**四语全真译 |
| ② 无空白卡片 | 4 语 × 3 面 = 12 次渲染，空串 **0**；移动档被遮挡 **0** |
| ③ 「翻译中」小标 | **0 例（如实记录，未伪造）**：中文档 0（符合硬要求）；en/hk/vn 亦 0（因 42/42 `ready`）；已附代码路径读证 |
| ④ 两档布局 | 1440×900 与 390×844 各 12 组合 **`scrollWidth == clientWidth`**；`.sf-tabbar` 真实点击命中（`elementFromPoint` ⇒ 路径跳转成功）✓ |
| ⑤ 控制台/网络 | **JS 错误 0**；Tailwind CDN 告警 1/页（**单列不计负**，样式确生效）；Font Awesome CDN 间歇；2 条 smiley-sans 字体 **404**（仅 hk 档、外观级） |
| ⑥ 取证 | **24 张 PNG**（12×1440 全页 + 卡片特写 + 12×390）⇒ `.p4-artifacts/p6accept-20261001-192350/shots/` |
**★ 范围外真发现（我判定必修）**：**UI 字面量硬编码中文不随语言切换**（`TaskPage.jsx:230` 任务中心、`RewardPage.jsx:293` 奖励中心…，en/hk/vn 实测仍简体）—— **与用户原始抱怨同类**（"菜单变了、内容没变"）；且 `TaskPage`/`RewardPage` 未接「翻译中」小标。⇒ 派「硬编码文案取证」立项。
**B. B5-MT（`deleg_4ee90b8c` task-1，31 calls / 256.4s）—— 缺表族取证**：
1. **缺表族 = 恰 7 名（首次由差分证明，非固定清单）**：迁移面词法抽 **22 名**（库侧 23 BASE TABLE + 1 VIEW 22/22 命中）、代码面 distinct **30 名** ⇒ 差集恰 7：`asset`(992/1007) · `task`(3030/3078/3108) · `task_progress`(854/1271/1339/1352/1376/1389/1401/2403) · `prize`(2846/2939/3008) · `prize_item`(2761/2774/2977→2970/3671/3693) · `shard`(2987/3137) · `shard_transfer`(3153) = **25 处 SQL 引用点**；双口径 `to_regclass` 引号/裸名 **7/7 NULL** 逐名同值。
2. **今日唯一可达撞缺表面 = `POST /api/task-progress/claim/:jID`（`index.ts:692`）** ⇒ 触 `asset`(`:716`/`:727`) + `task_progress`(`:726`) ⇒ `42P01` ⇒ **吞成 `500`**（`:740`）。`/api/auth/verify` 的 asset 触达**已闭合**（`:412` = `getUserAsset ‖ emptyAsset`）✓；其余 6 表**零触达**（读侧内存桩恒空 `database.ts:3116/3186`；写侧全 410；market 家族已改接 `market_post_event`）。**20 个宿主函数零调用方（死代码）**。
3. **选项影响面**：**B（补建）与册正面冲突 4 条** —— `data-layer.spec:219` DL26 逐字点名 7 名、`:332` DL40、`:168`/`:169`「不存在且永不创建」、`ledger.spec:819/821` §13.1 第二套账 + `route-layer.spec:1323`「本批不得建表」；**C（fail-loud）不消解缺表**且 503 归一册定归批 6；**A（sunset）**需改 `index.ts:692-742`（+可选删 27 死函数），**唯一待定 = 奖励发放去哪**。
4. **重置键无需变动（四路现取对拍一致）**：文件 20 = 库 `schema_migration` 20 行（末版 `0021`）= `p3x:57-61 VERSION_ORDER` 20 项 = `:626` 期望 `'20'` ✓。
**★ 我裁定：批 5 = A（sunset）** —— `claim` 面**退 410**（机读 reason）+ **不删** 27 个死函数（大 diff 低收益 ⇒ 登记批 6 连带）；**奖励发放无缺口**：旧模型（管理员后台发 task/reward）已废，现唯一路径 = **A1 管理员调分（已接账本 mint/burn，§5.99/§5.100）**；**C 的"吞错归一"归批 6（D1'）**。
**登记**：p5 件的 spec 行号已漂移（其引 `data-layer.spec:166/:217` ⇒ 现 `:168/:219`；其引 `route-layer.spec:1151/1154/1158` **不符**，真条文在 `:57/:194/:199/:200/:513/:562`）；库侧 `users` **24→35** 漂移；`p3y-01-post-apply-verify.ts:37` 死副本落后 3 版；Neng 5 项 `NOT_MEASURED`、Kong N1–N8 未测（含"生产库与探针库是否同库"）。

---
### 5.119 **TR-1c-FIX2 验收（我亲跑）+ 读回面归零 + 「registered 反复出现」疑点查清（非缺陷）**（2026-10-01）

**A. FIX2（`deleg_f96a0f68`，14 calls / 243.0s）我亲跑**：`TSC_EXIT=0`/0 行；后端离线套件 **121/121**；**FIX2 自带用例 11/11**；**注册点 67**；σ 探针 **`Δledger_entry=0`、`Σ=1989693` 零位移**；判定式已落 `src/database.ts:792`（`total === 0 || ready === total ? 'ready' : (ready === 0 ? 'pending' : 'partial')`，注释逐字引 **spec v1.3 §10.15**）✓。**我的纠偏生效**：实现取「键恒在 + 全空源 ⇒ `ready`」与规格一致（原 brief 的"不输出该键"已被推翻）✓。
**B. ★ 读回面归零（我亲跑，同一口径前后对比）**：补跑前 `/api/task/all` n=20 `{ready:19, pending:1}` + `/api/prize/all` n=22 `{ready:22}`；我跑一轮 `scan_translate`（`registered=6`，系新出现的 job 实体）⇒ 补跑后 **n=20 `{ready:20}` + n=22 `{ready:22}` ⇒ 合计 `{ready:42}`、`partial=0`、`pending=0`** ✓✓ —— **"翻译中"假信号已彻底消除**。
**C. 「`scan` 反复报 `registered=6`」疑点 —— 我查证后判定非缺陷**：只读探针显示 `content_translation` 总量稳定 **276**、**无空 `entity_id`**；近 30 分钟写入全部是 **`job 24`**（TR-1b 留的 residual 测试招工）×6 行，更早一批是 **`job 22`** ⇒ 真因 = **新内容实体出现 ⇒ 扫描登记**（正确行为）；**旁证**：`job 8/9/10/11/16/17/18` 各只有 **3 行（仅 `title`，`description` 为空）** ⇒ 恰好解释此前那批 `partial`，与 FIX2 修正后的判定自洽 ✓。
**D. 诚实登记**：FIX2 拒绝伪造 before/after —— 我给的 before `{41,14,1}`（n=56）含 `/api/home` 聚合体 ⇒ 与它两端点 n=42 **同口径 before = `NOT_MEASURED`**；「14 个 partial = 7 job + 5 listing 空描述」属**代码推断**。另：其用例未并入 `p4z-tr1a-01`（`database.ts` 模块级 `dotenv.config()` 会污染该套件 env 敏感的 J/K/L 组）⇒ 改用同形独立脚本承载，**理由充分**；`spec §10.1/2161` 未含"空源剔除"前提（禁写 spec ⇒ 仅登记）。
**E. ★ 生产复验（收尾，我亲测）**：入库 `e4777d7`（修复）+ `37bfd6a`（文档）⇒ **推送**（`b98c02f..37bfd6a`，origin 同步）⇒ Git 联动生产构建；**真域名 `--resolve` 三连测**：`/api/task/all` + `/api/prize/all` 均 200，**`i18n_status` 分布恒为 `{ready: 42}`、`partial = 0`、`pending = 0`** ✓✓ —— 首次测量（推送后约 70s）即已是 `{ready:42}` ⇒ 构建已生效。**翻译线就此全链收口**：真英/繁/越落库 + 生产可读 + 无假译文 + 无假信号 + 账本零位移。
**F. 遗留（登记，非遗漏）**：① 生产/库内**测试夹具数据**（`job 22/24`、`listing 19–22`、`b3c/p4b2c` 系列）保留 —— 按既有裁定「前端阶段需要"有货可看"」（重置会清空，暂不做）；② `waitUntil` **真 Vercel 上下文**与 `limit=100` 的 cron 实跑 = `NOT_MEASURED`；③ `ledger_tx` 关系不存在；④ 同口径 before/after = `NOT_MEASURED`；⑤ 磁盘仍有多轮 `NOT_MEASURED` 登记（0015–0017、批 3、P6-VERCEL-SHAPE、TR 线）。

---
### 5.118 **★★ 里程碑：翻译线在生产上线并全绿（真英文/繁体/越南语）+ TR-1c-FIX 验收 + `i18n_status` 分母裁定**（2026-10-01）

**A. TR-1c-FIX（`deleg_6987cd61`，★ 撞迭代上限截断）我亲核四读数**：`TSC_EXIT=0`/0 行；离线套件 **121/121**；注册点 **67**；**账本零位移**（`Σ(balance,cid=1)=1989693`、`ledger_entry=267` 双 delta true）；**读回面 `^\[(en|vn)\] ` 假译文前缀命中 = 0** ✓。守卫代码已落地（`stubWritesAllowed` / `TRANSLATE_ALLOW_STUB_WRITES` / `LENGTH_RATIO_BOUNDS` / `STUB_WRITE_BLOCKED` 均在盘）。⇒ 入库 **`e6d482c`**；其截断只差「报告未落盘」⇒ 按纪律派**收尾单** `deleg_69192731`（15 calls / 113.7s）补 `docs/audit/p6-tr1c-fix.md`（234 行）+ `limit` 默认 **20→100**（`index.ts:1747`，上限 100 不变；真闸 = `TRANSLATE_DAILY_ITEM_CAP=500`）⇒ 入库 **`b98c02f`**。**它正确识别出我在并发跑外部进程**并把账本/分布读数标为**时点值** ✓。
**B. ★★ 我亲自批量跑存量（真引擎）—— 生产已"真的切语言"**：累计 **8 批 + 2 批 + 1 批**，逐批回执 `processed/ready/failed/deferred` 全绿（**0 失败、0 延后**）；收尾 `mode=translate` 回 **`processed=0`（队列排空）**、`mode=scan` 回 **`registered=0`（幂等）**。**库面终态（我亲跑只读探针）**：`content_translation` **276/276 行 `status='ready'`**（currency 39 / job 99 / listing 117 / user 21）、**`last_error` 分布为空、非 ready 行 0**、`translation_cache` = deepseek 122 + opencc 61、**「ready 但正文为空」= 0**（结构级 CHECK 兜底成立）✓✓。
**★ 生产真域名实测（`curl --resolve` 绕本机 DNS 劫持）**：`/api/task/all` + `/api/prize/all` + `/api/home` 全 **200**；`i18n_status` 分布 `{ready:41, partial:14, pending:1}`；**假译文命中 0**；**真译文样本**：`海鲜礼盒测试丙：虾蟹双拼` ⇒ **en** `Seafood Gift Box Test C: Shrimp and Crab Duo` / **hk** `海鮮禮盒測試丙：蝦蟹雙拼` / **vn** `Hộp quà hải sản thử nghiệm C: Combo tôm và cua` ✓✓。**成本量级仍为几美分**（单次调用 prompt 327 / completion 581 tokens）。
**C. ★ 我又抓到一个真问题（假信号）⇒ 裁定并修**：`partial` 中有一部分是**"本来就没什么可翻"** —— 实测字段覆盖 `job.title 60 / job.description 39`、`listing.title 66 / listing.description 51` ⇒ **7 个招工、5 个商品描述为空**；而 `I18N_SPECS` 对 job 固定出 `title`+`note` 两字段 × 3 语言 = 6 格 ⇒ **空源字段仍进分母** ⇒ 对象被永久判 `partial` ⇒ **前端「翻译中」小标永挂**。**裁定**：**源为空/空白的格不计入 `total`**；**全空源对象 ⇒ 键恒在、值取真空态 `ready`**（此举由 Jing 在 v1.3 §10.15 定稿，理由 = §10.1 已写死该键恒带；两选项行为差仅"键在/键缺"，而前端对 `ready` 与键缺省处理一致）。⇒ 派 `TR-1c-FIX2`（已纠偏：原 brief 写"不输出该键"，现按规格改为"输出 `ready`"）。
**D. Jing v1.3（`deleg_97d4cfa7`，23 calls / 247.7s）我亲核**：`route-layer.spec` **v1.2→v1.3**（2194→**2353 行 / 503,209 B / md5 `ed0835a3…`**）+ 快照 `v1.3.md` **`CMP_EXIT=0`、md5 逐位相同** ✓；**`v1.1`/`v1.2` 冻结快照 md5 未被触碰**（`3f0aef0e…`/`1f8d35a3…`）✓；正文**删除行 = 3** = 其自曝的 3 处就地订正（`:2193` 长度比旧值、`:1722→:1730` 注册点、`:2225` limit 默认）✓ 与自述一致；新增 §10.10–§10.15 + §8.15；v1.2 delta 追加 §D14（161→175 行，前 161 行逐字保留）。**它按我的"二选一"授权选了「键恒在 + `ready`」并留痕** —— 采信（我给的两选项等价，但它把选择固化进规格更利于后续实现对齐）。⇒ 入库 **`2561d6e`**。**登记**：`docs/audit/p6-tr1b-mapper-and-backfill.md:89` 仍记 `limit` 默认 20（属该件面，仅登记）。
**E. 排期**：`TR-1c-FIX2`（分母修正 + 用例）⇒ 入库 ⇒ **推送 + Git 联动生产构建** ⇒ 生产复验（`partial` 假信号应消失）⇒ 收口报告。**key 轮换建议**已告知 Kevin（值曾出现在对话中）。

---
### 5.117 **TR-1c-B 验收（我亲核）+ ★★ 我读回时抓到「stub 假译文在对外提供」（必修）**（2026-10-01）

**A. TR-1c-B（`deleg_aab89e60`，43 calls / 719.0s）我亲核**：`TSC_EXIT=0` / 0 行 ✓；离线套件 **101/101**（96→101）`SUITE_EXIT=0` ✓；**注册点 67** ✓；**账本零位移**（sigma 1989693→1989693、entries 267→267、双 delta true）✓；`git status` 无 `frontend/**`、`migrations/**`、`vercel.json` ✓。
**B. 交付**：`POST /api/translate/backfill` 增 `mode` 三态（缺省 `scan_translate` = 先扫存量补 `pending` 再翻译 ⇒ **cron 自愈**；`scan` 只登记不付费；`translate` 旧行为），鉴权口径不变；新 `TRANSLATABLE_SPECS` + `buildScanInsertSql()`（**单语句** `INSERT…SELECT…ON CONFLICT DO NOTHING RETURNING 1`，同语句回 `scanned`+`registered`；**真库推导非硬编码**）；**幂等实证**：候选 **276** 行（job 99 / listing 117 / user 21 / currency 39；改前行数 0）⇒ 首轮 `registered=276`（行数 0→276）、**第二轮 `registered=0`、行数不变、零 API 付费** ✓；回执旧键全保留 + 新增 `mode/scan_scanned/scan_registered/scan_existing/scan_by_entity` ✓。
**C. ★★ 我读回时抓到的真问题（必修，非它引入，但它**未发现****）**：`GET /api/task/all` 读回的 20 个对象里 `i18n_status = {ready: 5, partial: 3, pending: 12}`，而 **`ready` 里混着 stub 假译文** —— 例：`b3c jobA` 的 `title_en = "[en] b3c jobA"`、`title_vn = "[vn] b3c jobA"`（**TR-1c-A 的 stub 端到端在真库留下的行**，现被当作 `ready` 真译文对外提供）。它只清了 4 条 `engine='stub'` 的**缓存**行，**`content_translation` 里的 `[en]`/`[vn]` 假译文行未清**。
**我的判定**：这是「stub 假译文污染」的**二次发作**（我 §5.114 已裁定过引擎侧不得自动回落 stub，但**没堵住「显式 stub 测试往真库写」这条路**）。⇒ 处置三条：① **数据清洗**（假译文行**复位为 `pending` + `text=NULL` + `attempts=0`** 让真引擎重做；**`translation_cache` 里的假缓存行必须删除** —— 否则真翻译永远命中假缓存）；② **结构性守卫**（stub 引擎默认**拒绝写库**，仅当显式 `TRANSLATE_ALLOW_STUB_WRITES=1` 才允许 ⇒ **把纪律变成拒绝**，而不是靠调用方记得清理）；③ 验收必须含「读回面 0 条 `^\[(en|vn)\] ` 前缀」的**类级断言**。
**D. 它登记的两个缺陷（我采信并升级为必修）**：**DEF-01**（`translateFields:657-663` 逐语言用**字段子集**校验，而引擎回全部请求字段 ⇒ **部分缓存命中误判 `KEY_SET_MISMATCH`**，本次 `description.en` 因此落 failed）⇒ **真缺陷，一行级修**；**DEF-02**（长度比按**码点**且上限 3.0，对 zh→en/vn **短文本系统性判负**，实测比 **3.7–5.2** ⇒ **`vn` 行无法 `ready`**，`i18n_status` 长期 `partial`，**是需求②的真阻塞**）⇒ 我裁定改**分语言阈值**：`en`/`vn` = `[0.3, 6.0]`、`hk` = `[0.5, 2.5]`（hk 是 1:1 级确定性转换，反而应收紧），并要求 Jing 事后回写规格。
**E. 它的诚实披露（采信）**：测试控制把 6 行复位 `pending`（自造数据、非删行）；删了 4 条 stub 假缓存；自建首版过严脚本已删、产物留痕；调用 44（超 1）。**residual**：`content_translation` 译文行零删除、保留 276 条。
**F. 下一步**：`TR-1c-FIX`（数据清洗 + stub 写库守卫 + DEF-01 + DEF-02 + 真引擎复验）→ 我**亲自批量跑 backfill** 把存量 276 行翻完（成本量级 ~$0.03）→ 推送 + 部署 + 生产验收 → Jing 回写规格。

---
### 5.116 **Jing 立规格验收（我亲核）+ ★ 我两条裁定（快照惯例采信执行方 / 注册点 65→66 无需复算）**（2026-10-01）

**A. 交付物（`deleg_0cc73e9e`，26 calls / 232.7s）**：`docs/route-layer.spec.md` v1.1→**v1.2**（**2037→2194 行 / 448,834→474,712 B / md5 `1f8d35a3…`**），新增 **§10「多语言用户内容翻译线」**（8 条事实：载荷契约 + `i18n_status`、内容面、两新表、引擎口径〔DeepSeek + OpenCC `/hk` 不付费 + **stub 仅显式** + 缺 key 一律不翻〕、B1 写入形态〔6 个登记点 + 挂起 15s 时写响应 1995/1287ms〕、失败与成本策略、`backfill`+cron+注册点 67、`Δledger_entry=0`）+ §8.14 变更记录；`docs/versions/route-layer.spec.v1.2.md`；`docs/audit/route-layer-v1.2-delta.md`（§D0 指纹 + §D1–D12）；`docs/data-layer.spec.md` v0.7→**v0.8**（1023→1046 行；`bdee0a8f…`）+ `docs/versions/data-layer.spec.v0.7.md`（改前）。
**B. 我亲核**：① **本册与快照 `cmp`=0、md5 逐字相同**（`1f8d35a3…`）✓；② **route 正文删除行 = 0** ⇒「§1–§9 既有条文一字未动」成立（纯追加）✓；③ **v0.1–v1.1 冻结快照未被触碰**（`git status` 只显示两个新快照）✓；④ data-layer 仅 1 行删除 = 版本声明行（v0.7→v0.8，属预期）。
**C. ★ 我两条裁定**：
1. **快照惯例：采信执行方，我的 brief 措辞有误。** 我在 brief 里写「`v1.2.md` = **改前**内容」，而仓内惯例（历版 delta §D0 + `master-plan:1809`）= **快照取「新版本号 + 改后正文」，并与本册 `cmp`=0**；改前版本已冻结于其旧号快照（`v1.1.md`）⇒ **Jing 按惯例执行、并在 delta §D0 与 §10.7 逐字留痕，判定正确**。⇒ **补 `docs/versions/data-layer.spec.v0.8.md`**（改后正文、`cmp`=0），使数据面惯例与路由面一致（`v0.7.md` 保留为改前）。
2. **注册点 `65→66` 无需复算**：该步 = **§5.109 P6-VERCEL-SHAPE 的 `/api/health` 注册**（已在册），`66→67` = TR-1b 的 `backfill`；Jing 标 `NOT_MEASURED` 的仅是「本册未复算」⇒ **由我以已入库记录补齐**，不重算。
**E. 补记（已闭合）**：`docs/versions/data-layer.spec.v0.8.md` 已补齐 —— **`cmp`=0、md5 `bdee0a8f…` 逐位相同、1046 行 / 274,767 B**；`v0.7.md` **逐位未动**（1023 行 / `ad657c0a…`）；`route-layer-v1.2-delta.md` 的**追加式**得证（追加后 161 行 / 18,146 B，且 `head -n 125 | wc -c` = **14,289** = 原文件全量字节 ⇒ §D0–§D12 零改动）；§D13 已留「Zang 措辞更正」痕迹。

**D. 教训（第二次「派单方转述 vs 仓内权威惯例」冲突）**：与既有纪律一致 —— **执行方以仓内惯例顶回派单方口径时应予肯定**；本次裁定采信执行方，并同步更正我未来的 brief 措辞（快照 = 新版号 + 改后正文 + `cmp`=0）。

---
### 5.115 **TR-1c-A 验收（我亲跑）+ ★ 我复核其 Σ 口径差 + 引擎回落反转落地**（2026-10-01）

**A. 我亲跑四读数**：`tsc --noEmit` **`TSC_EXIT=0` / 0 行**；离线套件 **`total=96 passed=96 failed=0` / `SUITE_EXIT=0`**（87→**96**：`J1` 改 + 新增 `J10–J14` + `L1–L4`）；**注册点 = 67**（本单不增端点）✓；`git status` 仅 `backend-ts/**`（`frontend/**`、`migrations/**`、`vercel.json` 零触碰）✓；依赖仅增 **`@vercel/functions@^3.9.9`** ✓。
**B. ★ 我复核它的 Σ 读数 —— 口径差，非缺陷**：它报 `Σ(cid=1)=2000200`，与我记录 `1989693` 差 **10,507** ⇒ 我用 **TR-1b 的同一探针**（`p4z-tr1b-02-sigma-probe.ts`；口径 = `sum(account.balance) where cid=1`）亲跑：`BEFORE/AFTER = 1989693/1989693`、`ledger_entry 267/267`、**`sigma_delta_zero: true`、`ledger_entry_delta_zero: true`** ⇒ **资金零位移成立**；它的数疑为含 `frozen` 或不同 scope ⇒ **登记为口径注记**。**既有教训复现**：跨人/跨版本比较 Σ 必须**同口径同命令**。
**C. 引擎回落反转已落地（我裁定项）**：`translate-service.ts:290 getTranslateConfig` **不再回落 stub**（`engine = requested`，缺 key 只置 `fallback_reason` 含 `NO_API_KEY`）；`:587` 新增 **闸⓪**：非显式 stub 且无 key ⇒ `markAll('pending', NO_API_KEY)` 后 return ⇒ **不写任何译文、不写缓存**；用 `pending`（非 `failed`）**不烧 attempts** ⇒ key 到位后 `backfill` 可完整补齐 ✓。断言同步：`J1` 改 + 新增 `J10–J14`（显式 stub / 缺 key 不调引擎 / **零缓存** / `pending+NO_API_KEY`×3 / `text` 恒 NULL）✓。
**D. 5 条写路径挂 `waitUntil`**：`index.ts:65 enqueueTranslation` = 前台 `registerPendingTranslations`（**批量 1 次 DB 往返**、`ON CONFLICT`；编辑 `reset=true`；状态迁移 `DO NOTHING`）+ 后台 `scheduleEntityTranslation` → `@vercel/functions` 的 `waitUntil`（非 Vercel 环境**退化 fire-and-forget**）；**两步各自 try/catch ⇒ 同步绝不抛** ✓。挂载：profile `:536` / currency `:1356` / job `:1443` / listing create `:1588` · edit `:1617` · patch `:1641`。**何时写什么**：前台**只登记 `pending`（`text=NULL`）**；后台 en/vn→DeepSeek、hk→OpenCC（`engine='opencc'`、免费、不等引擎）。
**E. 端到端（两种模式，均走账本中性路径：商品上架 + 用户 bio）**：**stub 模式 26/26**（写 200；9 行 `pending→ready`；`title_hk` 繁体；`GET /api/prize/20` `i18n_status=ready`；重复 backfill ⇒ 缓存 `9=9=9` 命中）✓；**hang 模式 20/20**（引擎挂起 15s：**写响应 1995ms / 1287ms ⇒ 响应不被翻译拖慢** ✓；写后立即 9 行 `pending`；15s 后 en/vn **`failed/TIMEOUT` 且 `text` 为 NULL（不写脏数据）**、hk 仍 `ready` 繁体）✓✓ —— **这正是 B1 形态要的证据**。
**F. 登记**：residual `listing` **20/21/22**（DL79 禁 DELETE）；`ledger_tx` 关系不存在 ⇒ `NOT_MEASURED`；**`waitUntil` 真 Vercel 上下文本机不可实测**（本机走 fire-and-forget）⇒ 明确标注为**代码事实而非实测**；`GET /api/listing/:id` 不存在 ⇒ 读回改用 `GET /api/prize/:id`。
**G. 下一步**：**TR-1c-B**（真 DeepSeek 调用 + 端到端，**待 Kevin 的 key**）+ **Jing 立「多语言内容口径」规格**（已派）。

---
### 5.114 **TR-FIX 验收（我亲跑）+ ★ 我新裁定的「引擎回落反转」（防生产写脏数据）**（2026-10-01）

**A. TR-FIX 验收（`deleg_d3d4ee54`，15 calls / 123.2s）—— 我亲跑四读数**：① 后端离线套件 **`total=87 passed=87 failed=0`、`EXIT=0`**（80→**87**：新增 `HK1..HK5` + `G3-hk`/`H3-hk`；且 `H6` 从「失败不写缓存」**加严**为「唯一缓存行 = hk/opencc」，`E5` 改为 `MemStore(0)`+cap3 以保住「`used+projected==cap` ⇒ 放行」语义）；② `tsc --noEmit` **`TSC_EXIT=0` / 0 行**；③ 前端 **13 文件 / 126 例全绿**（123→126）`FE_EXIT=0`、`build` 0；④ **`backend-ts/src/**` 未被触碰**（`git status` 零命中 ⇒ 块 1 只改测试、**没顺手改实现**，这正是我 brief 里那条红线的意义）✓。入库 **`601bac3`**。
**B. ★ 我新发现的生产风险 ⇒ 裁定「引擎回落反转」**：现行设计「**无 `DEEPSEEK_API_KEY` ⇒ 自动回落 `stub`**」在本地无害，但**在生产上会写脏数据**：stub 产出形如 `[en] 招聘服务员`，会被当作 `ready` 译文**入库并写入 `translation_cache`** ⇒ ① 站点上把假译文当真译文展示；② **缓存污染**后续真翻译（同文本永远命中假缓存）。
**裁定**：**`stub` 只能显式启用**（`TRANSLATE_ENGINE=stub`，仅供本地/测试）；**未显式启用且缺 key ⇒ 一律不翻译** —— 该批标 `failed`/`pending`、`reason='NO_API_KEY'`、**不写任何译文、不写缓存**，等 key 到位由 `backfill`/cron 自动补齐（正是失败策略的既有设计）。同步更新 J1/J2 断言。⇒ 纳入 TR-1c-A。
**C. 排期**：**TR-1c-A**（4 条写路径挂 `waitUntil` + 引擎回落反转 + **stub 端到端**〔**只走账本中性写路径**：商品创建 / 用户 bio —— **禁止**用发布招工做 E2E，它会动账本〕）；**TR-1c-B**（真 DeepSeek 调用 + 端到端，**待 Kevin 的 key**）。

---
### 5.113 **TR-1b / TR-2 验收（我亲核）+ 三个自抓问题（旧进程假红 / 5 条红归因 / hk 缺口）+ 两条裁定**（2026-10-01）

**A. 用户可见面已成立（我重启服务后亲测）**：`GET /api/task/all` ⇒ **20 个对象全部 `i18n_status: "pending"`，且 `title_en` / `title_hk` **逐字等于中文原文**（回落生效）⇒ **再无空串**（此前恒 `''` 会让英文档渲染空白卡片）。`POST /api/translate/backfill` 在未配密钥时 ⇒ **503 `CRON_SECRET not configured`**（**fail-loud，绝不默认放行**）✓。
**B. ★ 我抓到的三个问题**：
1. **「旧进程假红」**：首次实测 `backfill` = **404**、`task/all` 仍返回空串 ⇒ 真因 = **pm2 里跑的是改动之前的进程**（改码未重启）⇒ 走面板单服务路由重启（pid → 23375）后两条全部转绿 ✓。**教训固化：改完代码必须重启再测；否则会把「未加载」误判成「没实现」。**
2. **TR-1a 的 80 例 5 红**：我先把解析脚本写成读 `ok` 键（实际是 **`pass`**）⇒ **虚报 80 条 FAILED**（探针 bug）；真红 = **5 条**，且**全部归因于「hk 进 `TARGET_LANGS`」后的期望值过期**：`G3/G7/H3`（缓存行 2→**3**）、`H6`（LLM 失败仍写 **1 条 hk 缓存** —— hk 是确定性转换，成功与 LLM 无关 ⇒ **行为正确**）、`E5`（`used(1)+projected(2→3)>cap(3)` ⇒ **deferred 正确**；我一度把 `true/0` 读成 `deferred=false`，实为 `true`）。⇒ **裁定 = 测试陈旧，非行为退化**；派小单更新期望并**补 hk 断言**。
3. **★ TR-1b 的检测发现（本批最有价值）**：TR-1a 的 `translateFields` 只遍历 `TRANSLATE_TARGETS=['en','vn']` ⇒ **`hk` 行从不落库**（而契约要求 hk 行存在且为繁体）⇒ TR-1b 补 `TARGET_LANGS` + OpenCC `toTraditional`（缓存 `engine='opencc'`、**不付费、不走 LLM**），并把输出类型/`markAll`/日限额投影随 hk 归位 ✓。
**C. TR-1b 验收（我亲核）**：`TSC_EXIT=0` 0 行 ✓；**注册点 = 67**（66→+1）✓；`Δledger_entry=0`（267→267）+ `Σ(balance,cid=1)=1989693` 不变 ✓；零新增依赖 ✓；`0021` 未改、零 DDL ✓；`vercel.json` cron = **`0 18 * * *`**（UTC18 = 北京 02:00 = DeepSeek 低峰）✓；交付：`createDbStore()`（`translate-service.ts:735-809`）、mapper 10 点（`database.ts` 新增 `I18N_SPECS`/`applyI18n`/`loadI18nIndex` `740-819`；**删掉 12 处恒 `''` 的造键点**）、`POST /api/translate/backfill`（`index.ts:1657`）。
**D. TR-2 验收（我亲跑）**：`FE_TEST_EXIT=0` **13 文件 / 123 例全绿**（基线 112 + **11 新例**）✓；`FE_BUILD_EXIT=0`（`index-CrRf8rdv.js` 480.52 kB / `index-GkPYQpWR.css` 70.82 kB）✓；四语键**相等**（top 75 / flat 177）+ 新键 `i18n.translating` 四语互异（翻译中/Translating/翻譯中/Đang dịch）✓；静态守卫「新接 6 文件 `??` 命中 0」✓；`git status` 无跨目录污染（后端只碰 `backend-ts/**`+`vercel.json`、前端只碰 `frontend/**`）✓。接线覆盖 `ListingsPage`/`ListingDetailPage`/`JobDetailPage`/`JobReviewPage`/`ProfilePage`（**bio 编辑态仍持原文 ⇒ 防译文写回** ✓）；**`MarketPage` 内容面 0**（逐键取证：`market_order`/`market_trade` 全为数值/ID/枚举、无用户录入文本 ✓）；**发布页不接**（表单输入是待提交原文 ✓）。
**E. 我两条裁定**：① **`zh` 档不显示「翻译中」小标**（中文就是原文，显示无意义）⇒ 派一行修；② 存量三页仍用 `??`（`HomePage` 12 / `TaskPage` 6 / `RewardPage` 6）⇒ **现状安全**（服务端已保证非空串、假空串源头已除）⇒ **登记不派单**（后续随其它改动单点收口）。
**F. 诚实登记（采信其自曝）**：E2E 两处断言列名错（`account.total` 实为 `balance`；`ledger_tx` 不存在）⇒ 标 `NOT_MEASURED` + 专用探针 `p4z-tr1b-02-sigma-probe.ts` 重测 Σ ✓；**残留**：`public.job` id=**24** / `public.listing` id=**19** 测试行（迁移 0013/0015 的 DL79 触发器禁 `DELETE` ⇒ DDL 才能清，红线禁止）⇒ **登记为 residual**（译文面 0 残留）。
**G. 下一步**：小单 `TR-FIX`（更新 5 条陈旧期望 + 补 hk 断言 + zh 档不显示小标）→ **TR-1c**（4 条写路径挂 `waitUntil` + 真 DeepSeek 调用 + 端到端，**待 Kevin 的 key**）。

---
### 5.112 **TR-0 / TR-1a 验收（我亲核四红线）+ 跨片交接面定案**（2026-10-01）

**A. TR-0（`deleg_e4ac0975`，31 calls / 170.3s）验收**：报告 `docs/audit/p6-i18n-content-triage.md`（19,166 B）+ 只读探针 `backend-ts/scripts/p4z-p6i18n-00-schema.ts` + 产物 `backend-ts/.p4-artifacts/p6i18n-probe/{schema.json,schema.err}`。**★ 它反证了我的前提**（详见 §5.111 A′：三语列在库与迁移面**均不存在**；空串 = 序列化层造键 `database.ts:106 toStringValue(undefined)→''`）。其余读数：`/api/admin/task|prize/*` **恒 410**（非写入口）；前端**仅 3 个文件已接**三语列（`HomePage.jsx` 12 处 / `TaskPage.jsx` 6 / `RewardPage.jsx` 6），**今天的 `jobs/**`、`listings/**`、`market/**`、`ProfilePage.jsx` 全未接**；DeepSeek 契约实测（`/chat/completions`、`response_format` 支持但须提示词自带 JSON 要求、错误码 400/401/402/422/429/500/503 全取）。
**B. TR-1a（`deleg_4b3533dd`，41 calls / 478.5s）验收 —— 四红线我亲跑**：
| 红线 | 我亲测读数 |
|---|---|
| `npx tsc --noEmit` | **`TSC_EXIT=0`、0 行**（直接重定向，不经管道）✓ |
| 80 例离线单测 | **`total=80 passed=80 failed=0`**（`TEST_EXIT=0`；**我这一跑的产物 = `p6tr1a-20261001T013452Z`**，run-tagged ✓） |
| 迁移未 apply | **`/health` → `"schema_version":"0020"`** ✓（决定性；证明只落文件未落库） |
| 安全面 | 服务层 `DATABASE_URL|postgres://|env.local|console.log` **命中 0**；`git status` 无 `frontend/`；HEAD 仍 `870f882`（子代理未 commit）✓ |
**C. 交付物（我亲核字节/行数）**：① 迁移 `backend-ts/migrations/0021_content_translation.sql`（**164 行 / 10,039 B**；2 表 + 3 索引 + **0 触发器**；具名 CHECK 四条，含 ★ **`status<>'ready' OR ("text" 非空且 btrim≠空)` 结构级「不写脏数据」兜底**；表名 `content_translation`/`translation_cache`，PK 即幂等键；全 `IF NOT EXISTS`；**无 BEGIN/COMMIT、无 DO/EXECUTE 动态 DDL** —— 因 `migrate.ts` 逐文件单事务包裹、`p3x` 按词法剥注释后静态抽取期望对象）；② `backend-ts/src/translate-service.ts`（**879 行 / 36,518 B**；可注入 `TranslateStore`（⇒ TR-1b 可换真库实现）、`toTraditional`/`hasCJK`/`asciiRatio`/`hasVietnameseDiacritics`/`sha256Hex`/`REASON`/`TranslationError`；常量 `LENGTH_RATIO_MIN 0.3`/`MAX 3.0`、`EN_NON_ASCII_MAX 0.3`、`MAX_ATTEMPTS 5`、`REQUEST_TIMEOUT_MS 15000`、`DEFAULT_MODEL 'deepseek-flash'`、`TRANSLATE_TARGETS ['en','vn']`）；③ `backend-ts/scripts/p4z-tr1a-01-offline-tests.ts`（415 行 / 80 例；`validate` 15 例**逐条判负**：`JSON_PARSE`/`KEY_SET_MISMATCH`/`EMPTY_VALUE`/`LENGTH_RATIO`（过短+过长）/`CHARSET`（en 中文污染 + vn 丢声调），另有**两条豁免正例**（源无 CJK / 单字源）；`人民币⇒人民幣` 确定性、`MODEL_NOT_AVAILABLE`、429/5xx 重试、日限额**边界放行**、attempts 不烧）；④ `p3x-00-rebuild-replay.ts` **+2/−1**（`'0021'` 入 `VERSION_ORDER`；`schema_migration.row_count '19'→'20'`；**triggers 仍 43 未改** —— 与「零触发器」自洽）；⑤ 依赖**仅** `opencc-js@^1.4.2`。
**D. 我四条裁定**：① **`p3y-01-post-apply-verify.ts:37`（VERSION_ORDER 只到 0017）= 死副本**（活引用 grep 0 命中，现存命中全是文档叙述）⇒ **本线不改**、登记待用（**TR-1c 若复用须先刷到 20 项**）；② `entity_type`/`field` **故意不加 CHECK**、`lang` 加 CHECK ⇒ **认可**（与「新增内容类型免 ALTER」一致）；③ 它自曝的两轮测试失败（58/80 → 79/80 → 80/80；D6 断言被 JSON 转义击穿后改为**解析后断言**）属正常迭代、产物保留 ⇒ 不予追责；④ 七项 `NOT_MEASURED` 登记（真 DeepSeek 调用〔无 key〕、apply 后库读数、`createDbStore()` 真库行为、`p3x --dry-run`、`triggers=43` 为**转引非实测**、限流具体额度、`GET /models`）。
**E. ★ 跨片交接面（我指定归属，两侧 brief 逐字相同）**：**API 载荷新增 `i18n_status: "ready" | "partial" | "pending"`** —— 语义 = 该对象**所有可译字段**的 en/vn/hk 是否全部有 `status='ready'` 译文（全有=`ready`、全无=`pending`、介于=`partial`；字段缺省 ⇒ 前端不显示小标）；**回落规则（红线）**：`*_<lang>` **恒有值** —— 有 `ready` 译文用译文，否则**回落原文**，**永不返回空串**。**归属**：**TR-1b 产出**（mapper 侧）、**TR-2 消费**（渲染「翻译中」小标）。
**F. 排期**：**TR-1b**（apply `0021` + mapper 回落/状态位 + `POST /api/translate/backfill`（`CRON_SECRET`）+ `vercel.json` cron（低峰））与 **TR-2**（前端 6 页接线 + 小标）**并行**（不同目录、契约已冻结）→ **TR-1c**（4 条写路径挂 `waitUntil` + 真 DeepSeek 调用 + 端到端 + `Δledger_entry`=0/`Σtotal` 不变，**待 Kevin 的 key**）。

---
### 5.111 **★ 多语言 UGC「录入即自动四语」立项（TR 线）** —— 查实 + 拍板 + 报价取数（2026-10-01）

**A. 现象与真因（我亲查）**：用户报告「切语言只有菜单变、卡片内容仍简体中文」。真因（★ **已勘误，见 A′**）= 三语列**在库与迁移面均不存在**（生产 `/api/task/all` 逐条带 `title_en/title_hk/title_vn`、`note_en/hk/vn` 全 `""`；`prize` 同理 `name_*/description_*`），而前端 **`HomePage.jsx:40-80` 已在读**（`task.title_en ?? task.title` 形式**回落到中文**）⇒ **缺的不是"读"，是"写入时没人填"**。全仓**无任何翻译/AI 管线**（grep 命中全是 CSS `transform: translate`）⇒ 从零建线。

**A′ ★ 勘误（我第四条同类错误 —— TR-0 反证）**：我把**API 载荷**当成了**库结构**证据，写成「三语列早已存在、只是没人填」。TR-0 双口径取证推翻：① `grep -rn -E '_(en|hk|vn)\b' backend-ts/migrations/*.sql` **零匹配**（命中全是 `job_application_status_enum` 类假阳性；19 个迁移文件 0001–0017+0019+0020，**0018 缺**）；② 只读探针（`information_schema`）**`trilingual_cols: []`**（`public` 真表 21 张，`job`/`listing` 内容列只有 `title`/`description`）。**空串真来源 = 序列化层凭空造键**：`database.ts:106 toStringValue(undefined) → ''`，而 mapper 读的键（`database.ts:604-609`、`566-571`）在结果集里**根本不存在**。⇒ **真缺陷 = 「三语列不存在」**，只做写侧会直接 **42703**。
**教训（已 patch 技能 `data-migration-governance`）**：**API 载荷的字段名不是库结构的证据** —— 序列化/mapper 层会**造键**；判「列是否存在」必须走**迁移 DDL 或 `information_schema`**、且**双口径**。这是我第四次「未经复现的假设」（前三次：转引不存在的 `§1.8:51`、误立 D1「驱动丢码」、把 `/api/prize-item` 当 sunset 面）。
**B. 用户拍板（两个选择）**：① 引擎 = **DeepSeek V4-Flash + OpenCC 简繁转换**；② 形态 = **B1（写入即返回 + `waitUntil` 后台补齐）+ 定时任务兜底**。**我补定的**：失败**绝不阻塞提交**（留空 + 标"待翻译" + 回落中文 + 后台重试，不许因翻译失败丢单）；`hk` 是**确定性转换**（OpenCC）不是翻译；输出**三重校验**（脚本特征 / 长度比例 / 空值）后才落库；加**成本闸**（单条字符上限 + 日条数上限）；定时任务排 **DeepSeek 低峰时段**。
**C. 官方报价（★ 我亲取官方定价页，**非第三方聚合站 —— 实测两边数字对不上**）**：
| 方案 | 官方单价 | 1 万条/月（约 200 字 × 2 语言） | 10 万条/月 |
|---|---|---|---|
| **DeepSeek V4-Flash**（选中） | 输入 **$0.15**/1M tokens、输出 **$0.6**/1M（低峰；峰值 $0.3/$1.2；缓存命中 $0.003） | **≈ $2.2** | **≈ $22** |
| Azure 翻译 | **$10/百万字符**（F0 免费 2M/月） | ≈ $20 | ≈ $380 |
| Google NMT | **$20/百万字符**（前 50 万/月免费） | ≈ $70 | ≈ $790 |
| DeepL Pro | **$26/月**（年付）+ **$27.5/百万字符** 超额 | ≈ $37 | ≈ $300 |
| LibreTranslate 自建 | 软件免费，需常驻小机 **$20–40/月** | 同左 | 同左 |
| 本地模型（NLLB/OPUS） | 免费 | $0 | $0 |
**排除项**：本地模型**放不进 Vercel**（函数包上限 250MB，现函数仅 1.39MB）⇒ 要另起常驻服务，与现有纯 serverless 形态冲突。**结论**：DeepSeek 兼得**最低价 + 英/越最好质量**（还可用术语表/口吻约束）。
**D. 环境变量口径（值不进对话、不落盘、我不读）**：`DEEPSEEK_API_KEY`（必填）、`DEEPSEEK_MODEL`（默认 `deepseek-v4-flash`）、`DEEPSEEK_BASE_URL`、`CRON_SECRET`（定时兜底端点鉴权）；写入位置 = 本地 `backend-ts/.env.local`（已 gitignore）+ **Vercel Production & Preview**。
**E. 排期**：**TR-0 取证**（已派 `deleg_e4ac0975`：三语列/内容列逐表清单 + 写路径 + 前端读点 + 新增 `0021` 对**一键重置键**的连带影响）→ **TR-1 后端**（`translate-service`：DeepSeek + OpenCC + 三重校验 + 缓存；写路径 `waitUntil` 挂载；`POST /api/translate/backfill`（`CRON_SECRET`）；`vercel.json` cron；迁移 `0021` 缓存/任务表 + **重置脚本同步**）→ **TR-2 前端**（招工/商品/交易所/我的页面接 `*_en/_hk/_vn` + "待翻译"可见状态）→ **Jing** 立「多语言内容口径」。
**F. 连带风险（已登记）**：① 加迁移**必须同步** `p3x-00-rebuild-replay.ts` 的版本序/行数，否则**一键重置键失效**（上次 FIX-RS 的教训）；② 翻译写回属**内容更新**、**不碰账本**（`Δledger_entry` 必须 = 0）；③ Vercel Cron 配额视套餐（Hobby 有日限）⇒ 端点须支持管理员手动触发作兜底。

**G. `0021` 设计定案（我裁定）**：**采「独立翻译表」而非逐表加 18 列** ——
`content_translation(entity_type, entity_id, field, lang, text, status, attempts, last_error, updated_at)` + `translation_cache(src_hash, src_lang, tgt_lang, text_out, engine, created_at)`。
理由：① 四类内容（`job.title/description`、`listing.title/description`、`users.bio`、`currency.name`）**一套表统一**，将来新增内容类型**免 ALTER**；② `status/attempts/last_error` 天然承载「待翻译/失败重试」，**不必另建队列表**；③ **API 契约不变**（mapper 里那 12 个键**本来就存在**）——mapper 改为「从表取；取不到 ⇒ **回落原文**」，顺带修掉 `?? ` 遇 `''` 不回落造成**空白卡片**的隐患；④ `hk` 仍走 **OpenCC 确定性转换**（不是翻译）。
**H. `0021` 连带同步清单（TR-0 现取行号）**：`p3x-00-rebuild-replay.ts:57-60 VERSION_ORDER`（19 项 → 20）、`:625 schema_migration.row_count '19'→'20'`、`:626 triggers '43'`（新增触发器需重取）、`:842 version_order_ok`、`:784-792 gate.ok/canCommit`；**另有过期副本 `p3y-01-post-apply-verify.ts:37`（只到 0017）** ⇒ 归属一并裁定。**★ 重置回的是 seed 基线（`job`/`listing` 期望 0 行）⇒ 会清掉现有 19+18 条内容行** ⇒ 与既有「暂不重置」裁定一致（前端阶段需要"有货可看"）。
**I. 排期切片（防截断）**：**TR-1a**（迁移 `0021` + `translate-service`：DeepSeek 调用 + OpenCC + 三重校验 + 缓存 + 成本闸；离线单测走 **stub**，不需 key）→ **TR-1b**（4 条写路径挂 `waitUntil` + `POST /api/translate/backfill` + `vercel.json` cron（低峰）+ mapper 合并/回落 + i18n 状态位）→ **TR-1c**（重置脚本 5 处同步 + 端到端实测 + `Δledger_entry`=0 + `Σtotal` 不变）→ **TR-2**（前端 6 个页面接三语列 + "翻译中"状态）→ **Jing** 立「多语言内容口径」。
**J. ★ 模型名待复核 + Blocker**：官方文档 `model` 枚举 = **`deepseek-flash` / `deepseek-v4-pro`**，**无 `deepseek-v4-flash`**（该串只见于第三方聚合站）⇒ 实现时以 **`GET /models` + 官方文档现读** 为准，`DEEPSEEK_MODEL` 环境变量可覆盖。**Blocker**：本机与 Vercel 目前**无任何 `DEEPSEEK_*` 环境变量** ⇒ 真调用需 Kevin 提供 key（值不进对话）。
**K. TR-0 其余读数**：**写路径四类** —— `POST /api/job`→`publishJob`(`job-funds-service.ts:149`)→`jobPostEvent`(`:195`，单 DB 函数单点)；`POST /api/listing`→`createListingRow`(`database.ts:1544`，单 INSERT)；`POST|PATCH /api/listing/:id`→`updateListingRow`(`:1593`，单 UPDATE)；`/api/user/profile`、`/api/currency`。**`/api/admin/task|prize/*` 恒 410**（非写入口）。**前端只有 3 个文件已接**：`HomePage.jsx`(12 处)、`TaskPage.jsx`(6)、`RewardPage.jsx`(6)；**今天新做的 `jobs/**`、`listings/**`、`market/**`、`ProfilePage.jsx` 全未接**。**DeepSeek 契约已实测**：`POST {base}/chat/completions`、`response_format:{"type":"json_object"}` **支持但须提示词自带 JSON 要求**、错误码 400/401/402/422/429/500/503 全取。**NOT_MEASURED**：`--dry-run` 实跑读数、`p3y-01` 是否仍活引用、其余表逐列列名、限流具体额度、`GET /models` 现取。

---
### 5.110 **★ Vercel 真实部署验证 —— 完成且全绿（生产已切到今天这版）**：promote 后别名切至 `seafood-gmxyj0k2r-…`；**`/api/health` 404→200（`schema_version:"0020"`）、`/api/home` 500→200、`/api/task/all` 500→200**；**生产登录验签四枪全过**（垃圾签名 401 / 他人私钥 401 / 真签名 200 / 重放 401）+ **token 层 200**；**生产 bundle 含今日全部前端改动**（`index-BO_DL_Oe.js`）；区域 `sin1`；**回滚点已记**（2026-10-01）

**A. 部署形态三修（preview 验证 → promote）**：① `env.ts` 前缀映射 → ② `/api/health` 别名 → ③ `vercel.json` 区域 `sin1`，三项效果**均在线上读出**（非本地自证）。`vercel inspect` 显示新生产部署 **`λ backend-ts/src/index.ts (1.39MB) [sin1]`**（旧 = `609KB [iad1]`；体积增 = 加 `ethers`）✓。
**B. promote 与别名**：`vercel promote https://seafood-ggnoamqqh-alwaysfit.vercel.app` ⇒ 触发新生产部署 **`D6StYHKBtXyMWRfR2eSx6qVrwP3d`**（→ 实际就绪后别名为 **`seafood-gmxyj0k2r-alwaysfit.vercel.app`**）；`seafood-alwaysfit` / **`seafood-opal`** 两个别名均已切到新部署 ✓。**回滚点** = 旧生产 `seafood-s321tbsj1-…`（`dpl_32Hrx9nGgxQywqVzhAQjFRWvKG3y`）⇒ `vercel rollback` 一条命令可回。
**C. 生产 GET 矩阵（`curl --resolve` 强指 anycast `76.76.21.21`，绕开本机被劫持的 DNS）**：
| 端点 | 切换前（旧版） | **切换后（今天这版）** |
|---|---|---|
| `/api/health` | **404** | **200** `{"ok":true,"db_version":"PostgreSQL 18.6 …","schema_version":"0020"}` ✓ |
| `/api/home` | **500** | **200** + 真数据 ✓ |
| `/api/task/all` | **500** | **200** + 真数据 ✓ |
| `/api/prize/all`（preview 期） | — | **200** + 真数据（**含本地夹具 `tID:23`** ⇒ 同一 Neon 库）✓ |
| `/` | 200 | 200 + 标题正确 ✓ |
**D. ★ 生产登录验签四枪（Node `lookup` 覆写 DNS，私钥/JWT 全程不打印）**：`challenge` **200**（有 message+token）→ **垃圾签名 `401 Invalid wallet signature`** → **他人私钥 `401 Signature does not match the claimed address`** → **真签名 `200`** → **重放 `401`** → **用真签名换来的 JWT 读 `/api/user` = `200`**、`/api/home` = `200` → **无 token 读 `/api/user` = `401`** ✓✓ ⇒ **签名层与 token 层在生产同时成立**。
**★ 一处探针 bug 照实登记**：第 4 步脚本里 `'got_jwt=' + got.length > 20` 被 JS 优先级解析成 `(字符串) > 20` ⇒ 打印 `false`；**但第 6 步用该 token 读 `/api/user` 得 200 ⇒ JWT 确已签发** ⇒ **读数异常先怀疑探针**（§5.7）再次生效 ✓。
**E. 前端新代码确在生产**：生产 bundle = **`/assets/index-BO_DL_Oe.js`（494003 B）**（**与我 4c-ii-c 本地构建同哈希**）⇒ 内含今日标记 **`pairDegenerate`**、**`INVALID_WALLET_SIGNATURE`**、`market.pairDegenerate`、`listings`、`market` ✓✓。
**F. 过程产物（安全口径）**：`SECRET_KEY` 已入 Vercel（`--sensitive`，Production + **Preview 全分支**；值经 shell 展开/stdin，**未进对话未落盘**，每步带无 64 位十六进制串自检）；**`.vercelignore`** 排除 `.env*`/`docs/`/本地产物（已入库）；**preview 有 Vercel 身份保护**（未登录 302 ⇒ 用官方 `vercel curl`（自动保护绕过令牌）取数 ✓）。
**★ 遗留（登记）**：① **本地领先 `origin/main` 90 个提交**（今天全部工作）⇒ **Git 联动部署仍拿旧码**；推送由 Kevin 定；② preview 保持身份保护（如需他人围观需在面板加自动化绕过）；③ 本机对 `*.vercel.app` 的 DNS 劫持仍在（**任何本机 curl 读数必须先 `--resolve` 或改看法**，否则会误判成"站点挂了"）—— 已写入教训。

---

### 5.109 **P6-VERCEL-SHAPE 验收通过（部署形态三处收口）★ 我亲核：`env.ts` +32/0（映射表 `:51-62` 仅在缺规范名时填充）、`index.ts` +11/−2、`vercel.json` +1、`tsc` **0 行**、本地 `/health`·**`/api/health`**·`/api/home` **全 200**、**注册点 65 → 66**；★ 区域定 `sin1` 以**官方 schema** 取证（`builds` 已弃用且无 `config.regions` 路径）；★ 部署侧：`SECRET_KEY` 已入 Preview+Production、`.vercelignore` 已排除凭据/内部笔记；★ 发现**本地领先 `origin/main` 84 提交**（Git 联动部署会拿旧码）**（2026-10-01）

**交付（`deleg_2c0920cf`，Kong，30 calls / 265.7s，run `p6vs-20261001-075853`）**：① `backend-ts/src/env.ts` 新增单点表 **`VERCEL_PREFIX_FALLBACKS`**（**4 对** `规范名 ← SF_*`：`DATABASE_URL`/`DATABASE_URL_UNPOOLED`/`POSTGRES_URL`/`POSTGRES_URL_NON_POOLING`），循环体**仅 `!canonical && prefixed` 时赋值 ⇒ 已有值不覆盖**（`:58-62`）；`SECRET_KEY` **未入表**（已证明它以规范名存在）✓。② `backend-ts/src/index.ts`：健康检查 handler 提为 **`sendHealthReport`**，`/health` 与 **`/api/health` 共用同一引用**（handler 体逐字未动）✓。③ `vercel.json` **顶层 `"regions": ["sin1"]`**（`builds`/`routes` 语义未动）✓。
**★ 我独立复核**：`git diff --numstat` = **32/0 · 11/2 · 1/0**；`npx tsc --noEmit` **`TSC_EXIT=0`（0 行）**；本地现取 **`health=200 api_health=200 home=200`** ✓✓；**注册点 65 → 66** ✓；报告 `docs/audit/p6-vercel-shape.md`（**168 行**）+ 3 脚本（`p4z-p6vs-{env-probe,env-head-baseline,ledger-count}.ts`）✓。
**★ 两条硬证据（我采信）**：① **本地零变化 + 阳性对照** —— `head`（`git show HEAD:` 副本）vs 现值同命令读数：`DATABASE_URL`/`POSTGRES_URL`/`…_UNPOOLED`/`…_NON_POOLING`/`SECRET_KEY` **逐键相同**、`overwrote_existing=[]`、`canonical_filled_from_prefixed=[]`；**阳性对照**（无 dotenv + 哨兵 `SF_*`）**4 对全部真触发** ⇒ **探针非恒假** ✓✓。② **区域形状裁定**：官方 schema `openapi.vercel.sh/vercel.json` 中 `/properties/regions` 原文 = "the regions the deployment's Serverless Functions should be deployed to"，而 `builds` 标 `deprecated:true`、`builds[].config` 仅 "arbitrary metadata to be passed to the Builder"（**schema 无 `config.regions` 路径**）⇒ 选**顶层 `regions`** ✓。**另**：`Δledger_entry` = 0（267→267，只读 `count(*)`；`ledger_tx` 表不存在时**显式报 `ERR:` 而不填 0** ✓）。
**★ 它上报两点（采信）**：① **区域与 `/api/health` 属构建期属性 ⇒ 必须重新部署才生效**（线上 `vercel inspect` 现读数仍 `[iad1]`），报告 §7 登记 **6 条 `NOT_MEASURED`**（含手动面板退路）✓；② 它把 **`.vercelignore`（mtime 07:58、署名「Zang 2026-09-30」）** 登记为**并发写者产物**（非它生成）—— **那是我**，处置正确 ✓。
**★ 部署侧（我做的，同批登记）**：**`SECRET_KEY` 已写入 Vercel**（`--sensitive`；**Production** + **Preview 全分支**，值走 shell 变量展开/stdin、**全程未进对话、未落盘**，每步带「无 64 位十六进制串」泄漏自检 ✓）；**`.vercelignore` 已落**（排除 `.env*`/`docs/`/`backend-ts/.p4-artifacts/`，一句可改）。**根因回顾**：Vercel 上库变量**全带 `SF_` 前缀**而代码读规范名 ⇒ serverless 无 dotenv 兜底 ⇒ `/api/home` **500**（外部 vantage 实测）；`/api/health` **404**（`vercel.json` 转发保留原路径）。
**★ 新登记**：**本地领先 `origin/main` 84 个提交**（`git switch` 现取）⇒ **Git 联动部署拿到的是旧码**（且 `vercel env add` 报「该分支在已连接 Git 仓库中不存在」⇒ **项目确为 Git 联动**）⇒ **推送与否由 Kevin 定**（我不擅自 push）✓。
**⇒ 下一步 = `vercel deploy`（preview）→ 服务端 vantage 外部实测 → 全绿再谈 promote。**

---

### 5.108 **4c-ii-c 前端收尾验收通过 ⇒ ★ 前端线全部完成（4c-i 地基 / ii-a 招工+我的 / ii-b 商品+交易所 / ii-c 收尾）**：① 两条登录 401 文案**四语覆盖**（三档优先级、不空白、不出 `[object Object]`、原文 0 残留）② 市场页**退化币对早返回不发请求** + 空态区分 ③ 四语深键集逐文件相同（176/文件）④ **我亲跑：build 0 / 12 文件 112 例（+7）**；★ `/login` 重定向**我未能复现** ⇒ 按新纪律**登记为「待复现疑点」而非缺陷**（2026-09-30）

**交付（`deleg_2345af74`，Kong，43 calls / 372.4s）**：改 `frontend/src/{auth.js,components/auth/WalletAuthPanel.jsx,pages/market/{MarketPage.jsx,market-api.js},test/unit/{auth.test.js,listing-market.test.jsx}}` + 四语 locale；报告 `docs/audit/p4-b4c-ii-c-finalize.md`；产物 `b4ciic-20260930T2339+0800/{pre,post}/` ✓。
**硬 AC（我的复核 + 它的读数）**：① `npm run build` **`BUILD_EXIT=0`**（**479.19 kB** / 1.49s，我亲跑）；② `npx vitest run src/test/unit` **`TEST_EXIT=0`（12 文件 112 例，基线 105 ⇒ +7，我亲跑）** ✓✓（我要求「至少 +4」达标）；③ **四语 locale 深键集逐文件相同**（`ALL_FOUR_IDENTICAL`，**176 深键/文件**）✓；④ 几何回归：`/shard` **`geometry_diff_count=0`** + `perturbation_detected=true` + 日夜往返逐字节相同 + 真换肤 ✓。
**① 两条登录 401 文案四语覆盖**（做法：在既有 `apiErrorMessage` 链上加「服务端原文 → 四语键」映射）：`auth.js:119-122` `SERVER_MESSAGE_I18N_KEYS`（`Invalid wallet signature → auth.err.INVALID_WALLET_SIGNATURE`、`Signature does not match the claimed address → auth.err.SIGNATURE_ADDRESS_MISMATCH`）、`:125-127` `i18nKeyForServerMessage`、`:163-171` **三档优先级**（`i18n_key` → 原文映射 → 兜底 `请求失败(status)`，**不空白、不出 `[object Object]`**）；值落 `locales/{zh,en,hk,vn}.json:75-76`（键名逐字一致；**en 为本语种提示非原文照抄**；`frontend/src` 两串原文命中 = **0** ✓）；面板未改（仅 `WalletAuthPanel.jsx:132` 加 `data-sf-m` 取点属性）✓。
**② 退化币对**：`MarketPage.jsx:50-55` 拆 `basePositive/baseDegenerate/baseValid`；**`:56-66` 先判退化 → 直接落空态并 `return`，不触任何 `fetch`** ✓；**区分**「真无挂单」（`bookEmpty/tradesEmpty`，请求已发）与「币对退化」（`market.pairDegenerate`，`locales/*.json:159`）✓；`market-api.js:51-52` 记「本层不静默改写」✓。**边界（照登，正确不越界）**：后台 `ShardsManagement.jsx:60` 同形取数**未动**（越界，登记）✓。
**新增单测 7 例**：`auth.test.js:133/150/165/173`（两条映射 + 未知错误兜底 + 无文案兜底）、`listing-market.test.jsx:219/232`（退化不发请求 + 空态区分）、`:261`（四语深键集对拍）✓。
**★ `/login` 那件事我查清了（按新纪律处理）**：它的几何探针在 `/login` 落点**被重定向到 `/`**、面板不在 DOM ⇒ 该项 `NOT_MEASURED`（它照实登记、未填 0/空 ✓）。**我独立查证**：`App.jsx` 路由表**确实含 `path="/login"`**、且**只有一个 `path="/*"` 兜底**（**无 `path="*"`**）⇒ **我未能复现该重定向** ⇒ **裁定：登记为「待复现疑点」，不得当缺陷立案**（我 §5.102 立的「未复现不得立案」当场用上）✓。
**自曝（采信）**：jsdom `URL` 与 node `URL` 不同致两轮 vitest 失败（已修、留痕）；`/login` 重定向原因未定论（疑 `App.jsx:246` 兜底路由）；**HTTP 端到端展示面 = `NOT_MEASURED`** ✓。**边界自证**：`git status` 仅含允许路径；未碰 `backend-ts/**`、`migrations/**`、spec、master-plan、`.env.local`、**主题 token 值** ✓。
**⇒ 前端线收口。剩余 = 批 5 其余 + 批 6 + 批末重置（待 Kevin）+ Vercel（待 Kevin）。**

---

### 5.107 **Jing v1.1 验收通过（2037 行 / `3f0aef0e…`，7 条 delta、唯一非追加改动 = E9 锚点刷新）★ 我亲核：`cmp` = 0、v1.0 快照未动（`c68f5253…`）、新节齐（§3.6 / §3.7 / §1.13）、`auth.ts` 新锚点逐条带行号（`verifyMessage :221` / 删除消费 `:230`）；★ 「顺序即语义」入册（验签 `:221` 先于消费 `:230`）**（2026-09-30）

**交付（`deleg_6a0d77be`，Jing，22 calls / 884.5s）**：`docs/route-layer.spec.md` → **v1.1 / 2037 行 / 448834 B / md5 `3f0aef0e49aa6c2fff0380045888209a`**（v1.0 = 1849 行）；快照 `docs/versions/route-layer.spec.v1.1.md` **`cmp` exit 0 + 双 md5 逐位相同** ✓；delta 件 **187 行**（§D0 指纹 + 逐条 + 自曝 + 边界）✓；**v0.1–v1.0 十个快照未动**（我亲核 v1.0 快照 md5 仍 `c68f525340e2c9e0b2fdb1277a56acb6`）✓。
**七条 delta**：① **§3.6（新，`:775`）**「**登录必须验签**」硬规则 + **四条判据表** + **两层关系逐字**（token 层见 P4-SEC · 签名层见 P5-SIG-VERIFY）+ **顺序即语义**（**验签 `:221` 先于消费 `:230`**）+ 判负 4 条 + **零新码/reason/kind**，锚点 `auth.ts:182/:221/:223/:226/:227/:230`、`index.ts:354/:379` ✓；② **§1.13** 依赖入册 `ethers@^6.17.0`（`package.json:17`）+ 部署须带 lockfile + **与 Tailwind CDN 债务人区分** ✓；③ **§3.7** 登录端点口径（`getUserAsset ∥ emptyAsset(uID)`、`index.ts:364`、**不得回退写 `asset`**、无 `account` 行 ⇒ 200+0、`42P01` 归零）+ 就近说明 verify 已退出 §4.11.1 受影响面（原节留痕）✓；④ **§9.B·B14 + §7-48** 两条新 401 文案四语覆盖（**前端现取 0 命中**、运行面 `NOT_MEASURED`）✓；⑤ **§9.E：E9 锚点刷新 `:1200-1202` → `:1206-1208`（旧读数留痕 = 唯一非追加改动）+ 新增 E10（`claim` 面 B5-2，默认退役一句话可改）+ §7-47** ✓；⑥ **§1.12** 追加块（`index.ts` 1645→**1651**、18 条逐条 +6、`auth/verify` 仍 `:354`；`auth.ts` 240→**261** 并刷新全套锚点）✓；⑦ **不变项复核**：注册点 **65** / `410` 面 **6/6** / kind 关闭集 **20** / `Σ(cid=1)` **1,989,693**、`ledger_entry` **267**（**转引** `p5-sig-verify`，本册零库连接）✓。
**自曝（采信）**：`auth.ts` 改前 240 行为**推断**（261−24+3）、「+6」归因为推断（**逐条行号本身是 `grep` 现取**）、「两条 401 是否并入 `R107` 面」**本册不裁** ⇒ **我裁定：不并入**（它们是**登录面**的明文 401 文案，与 R107 的**权限面**不同域；`R107` 门槛登记不变）✓。
**⇒ 规格线追平代码（v1.1）；下一步 = 4c-ii-c 收尾（两条 401 文案四语 + 市场页币对退化处理）。**

---

### 5.106 **SIG-VERIFY 验收通过 —— HIGH 安全洞已堵：`consumeWalletAuthChallenge` 修前**从不读 `signature` 就 return**（删掉的正是两行 `bypassed signature verification` 注释）⇒ 现改为 **EIP-191 `personal_sign` 恢复 + 大小写不敏感比对**；★ **我亲手复打：垃圾签名 `0xdeadbeef` `200 → 401`；真签名（新钱包真签）⇒ `200`；他人私钥签你的 challenge ⇒ `401`**；依赖**只装 `ethers@^6.17.0`**；`pre 9/11 / post 11/11`；抖动瞬态（`/health` 503 一次、`/api/home` 500 一次）经我复测**非回归****（2026-09-30）

**交付（`deleg_52465130`，Kong，37 calls / 433.4s）**：改 `backend-ts/src/auth.ts`（**+24/−3**，3 处 hunk）+ `package.json`（**+1**：`"ethers": "^6.17.0"`）+ `package-lock.json`（**+98/−0**）；**`src/index.ts`/`database.ts` 未动**、`migrations/**` 零改、无 git 写、`pkill` 零、**仅面板 `{sid}` 重启一次** ✓；新增报告 `docs/audit/p5-sig-verify.md` + 脚本 `p4z-b5sv-0{1-http,2-invariants}.ts` + 产物 `b5sv-20260930T231433/**` ✓。
**★ 真根因（它现取到）**：`consumeWalletAuthChallenge` **修前从不读 `signature` 就 `return`**（旧 `src/auth.ts:208-213`；**删掉的那两行字面就是 `bypassed signature verification` 注释**）⇒ **任意地址 + 垃圾签名换真 JWT** ✓。**修法**：对**签发时给出的原文消息**做 **EIP-191 `personal_sign` 恢复** + **大小写不敏感比对** ✓。
**★ 核心回归判据（真 HTTP，改前/改后同脚本）**：② 垃圾签名 `0xdeadbeef`：改前 **`200` `success:true`（真 token 已签发）** → 改后 **`401` `Invalid wallet signature`** ✓✓；③ 他人私钥签 A 的 challenge：**`200` → `401` `Signature does not match the claimed address`** ✓✓；① 真签名 / ⑤ 校验和变体 / ④ 重放 = `200` / `200` / `401` **改前改后一致** ✓。`pre` = **9/11 PASS（`exit 1`，预期 —— 恰好 FAIL 的就是 AC2/AC3）**、`post` = **11/11 PASS（`exit 0`）** ✓✓。另：⑥ `tsc` = 0；⑦ **注册点 65** ✓；⑧ **`410` 面 6/6** ✓；⑨ **`Δledger_entry` = 0、`Σ(cid=1)` = 1989693 不变** ✓；⑩ 新钱包 `200` + `uID=970210`/`points=0` ⇒ **B5-FIX-LOGIN 未被打回** ✓；既有 401 面（R1/R2/R3）改后保持 ✓。
**★★ 我的独立验收（决定性；我先前亲手复现的就是这一枪）**：**① 垃圾签名 ⇒ `401`**（`Invalid wallet signature`）—— **改前我亲测是 `200`** ✓✓；**② 真签名正例我独立跑**（用 `backend-ts/node_modules/ethers` 现场生成新钱包、签原文消息）⇒ **`200` `ok=true` `uid=970211` `points=0`** ✓；**③ 他人私钥签你的 challenge ⇒ `401`** ✓；**④ 改动面我亲核**：`auth.ts` **+24/−3**、`package.json` **+1**、`lock` **+98/−0**、依赖**只有 `ethers@^6.17.0`** ✓。
**★ 抖动瞬态（我复测为非回归）**：`/health` 曾一次 **503**、`/api/home` 曾一次 **500** ⇒ **我复测：`/health` 200×3、`/api/home` 200×6（键集 `claimed_prize_ids/is_authenticated/prizes/tasks/user_points`）、`task/all` 200、`prize/all` 200、`challenge` 200** ⇒ **瞬态比例登记 1/7，属既有 A 档驱动债务（与 D1' 同族），非本单回归** ✓。**它自曝**：探针读 `data.uid`（真源 `uID`）⇒ 该键缺失、已用独立冒烟更正（AC①/⑩ 不依赖它）✓；收尾一次瞬时 503 面板 `state=running`、`pid` 未变（**非自退**）⇒ 未做第二次重启 ✓。
**★★★ 我的裁定**：① **「登录必须验签」= 硬规则** ⇒ **交 Jing 下一轮折入规格**（含四判据 + `ethers` 依赖登记 + 两层关系：token 层见 P4-SEC / 签名层见本单）✓。② **新登记收尾项**：**前端须为两条新 401 文案（`Invalid wallet signature` / `Signature does not match the claimed address`）做四语覆盖**（归 4c-ii 收尾；`NOT_MEASURED` 已登记）✓。③ **`ethers` 依赖入册**（部署须带 lockfile；登记为运行依赖、**不属离线风险**——它是**服务端包**，与前端 Tailwind CDN 那条债务人不同）✓。④ **安全线到此两层齐**：**token 层（P4-SEC）+ 签名层（本单）** ⇒ **「任意地址冒充任意用户」这条 HIGH 债关闭** ✓。

---

### 5.105 **B5-FIX-LOGIN 验收通过（登录不再写缺表：新钱包 `401 → 200`、`points=0`；存量 200 且余额一致；`Δledger_entry=0`）★ 改动仅 `index.ts` +7/−1**；**★★★ 但我在验收时亲手复现出一个更高危的安全洞：服务端根本不校验签名** ⇒ **任意 EVM 地址 + 垃圾签名 `0xdeadbeef` ⇒ `200` + 真 JWT**（完整身份冒充，**HIGH**）⇒ 我立案并派 `SIG-VERIFY`**（2026-09-30）

**B5-FIX-LOGIN（`deleg_947aba5e`，Kong，23 calls / 1289.2s）验收通过**。**核心判据（真 HTTP + 真库、改前/改后同脚本同口径）**：① **新随机 EVM 地址（无 `account` 行）走完 verify：改前 `401`（响应体逐字 `relation "asset" does not exist`）→ 改后 `200` + `points=0`**、`42P01_in_body=false` ✓✓；② 存量用户 ⇒ `200`、`points=7600` 与库内 `account.balance` 一致 ✓；③ 无 token / 伪造 token / 空签名 / 地址不匹配 ⇒ **`401`×4 保持** ✓；④ **`42P01` 归零**（日志 delta 空、响应体无 42P01）✓；⑤ `to_regclass('public.asset')` = **ABSENT**、`UPDATE/INTO asset` 仅存于 `upsertAsset` 体内、**登录链调用点已摘除** ✓；⑥ `tsc --noEmit` = **0** ✓；⑦ **注册点 65 → 65** ✓；⑧ `410` 面 **6/6** ✓；⑨ **`Δledger_entry` = 0、`account_rows_cid1` 16→16、`Σ(cid=1)` 1989693→1989693（Δ=0）** ✓；`Δusers_total=+2/run` 系 `findOrCreateUserByEvm` 建 `users` 行的**既有侧效应**（非账本分录，改前亦有）✓。
**改动（唯一）**：`backend-ts/src/index.ts` 一处 hunk **+7/−1**（`:358`→`:364`）：`getUserAsset ∥ upsertAsset(uID, 0)` → **`getUserAsset ∥ emptyAsset(uID)`** + **6 行根因注释**；**未动** `database.ts`/`auth.ts`/`migrations/**`（**绝未建表**）、**未建户** ✓。**选边依据（它写清、我采信）**：读源已是 `account`（`database.ts:861`）、同族先例 = `index.ts:496-498`（P4-B1-a 已修面）、登录只取 `points` 展示 ⇒ 空态 0 语义正确；建户只能**直写**（违 R1/`ledger.spec:821`）或调账本（登录**非价值事件**）⇒ 选空态 ✓。
**同族收口登记**：`upsertAsset` **5 个调用点**逐点判定 —— 登录链 1 处**已修**；`claim` 链 2 处（`:665`/`:676`）**按我裁定只登记不改**；`database.ts:929/3246/3336/3341/3427` 只登记，且实测「`database.ts` 之外 0 处调用者」⇒ HTTP 可达性 `NOT_MEASURED` ✓。**登录事务内无第二处同族写点** ✓。
**事故（照登）**：**Neon 抖动当场命中 3 次自退**（`log:20001-20015` 逐字 `TypeError: Cannot set property message of #<ErrorEvent>` → 进程 `exit 1`；其中 22:51/22:56 两次由它的 `/health` 轮询触发）⇒ **全部走面板 `POST /api/restart {"sid":"seafood-api"}` 复原**；**现态我复核：`/health` 200、面板 `state=running`、`/api/auth/challenge` 200 ⇒ 登录可用** ✓ —— 属**既有 A 档驱动债务**（与 D1' 同族），非本单引入 ✓。**探针自曝**：v1 把 `/health` 放首位致首 fetch 即死（v2 移到末尾+非致命、读数作废重跑）；v1 把 `to_regclass` 的 NULL 误标 `READ_FAILED`（v2 逐名重测得 `ABSENT`）；改后 run 中 `account` 单点读遇一次瞬时 `fetch failed` ✓。
**★★★ 我验收时的独立复现（HIGH 安全洞 = 服务端不校验签名）** —— **按我 §5.102 立的「立案前必须自己复现」规矩，我亲手打了两枪**：**① 第一枪作废**：我用 `{"address":…}` 打 challenge ⇒ `400 Invalid EVM address`（**真字段名 = `evm_address` / `signature` / `challenge_token`**）⇒ 探针写错、**先怀疑自己**、重打 ✓。**② 重打结果（决定性）**：`POST /api/auth/challenge`（`evm_address`）⇒ `200` + **真 EIP-4361 风格待签消息 + nonce**；`POST /api/auth/verify`（**签名 = `0xdeadbeef`**）⇒ **`200` `success:true`**、返回 **`uID: 970207` + 一枚真 JWT**；**③ 对照**：同一 `challenge_token` 二次使用 ⇒ **`401`「Challenge has been consumed or expired」**（**nonce 单次消费有效** ✓）。⇒ **任何人可用任意 EVM 地址 + 垃圾签名登录（完整身份冒充），而 `.env.local` 的 `SECRET_KEY` 只保护 token 层** ✓。**它与 P4-SEC 修的不是同一层**：P4-SEC 修的是**token 伪造**（兜底密钥），**签名层从未校验** ⇒ 之前的「签名错 ⇒ 401」读数实为**无 token/伪造 token** 的 401，两层面必须分清 ✓。
**★★★ 我的裁定**：① **立即立案（HIGH，安全）并派 `SIG-VERIFY`** —— 要求：**EIP-191 `personal_sign` 恢复地址与声明地址比对**（用 challenge 记录里的原文消息）；**允许「至多安装一个」生态包**（**优先复用仓库已有依赖**：先查 `ethers`/`viem`/`web3`/`@noble/*`/`ethereumjs-*`；确无 ⇒ **只许 `npm install ethers`**，并报确切版本与 `package.json`/lockfile 变化）；**四条硬 AC**：**真签名 ⇒ 200 / 垃圾签名 ⇒ 401 / 他人签名（地址不匹配）⇒ 401 / 重放 ⇒ 401**（用本地自建 `Wallet` 真签）；**不得放宽任何其它鉴权面**；**challenge 单次消费与过期语义必须保持**；**不得建表**；**收尾必须留在「可启动 + 登录可用」态** ✓。② **交 Jing 下一轮折入规格**：「**登录必须验签**」列为硬规则（含四判据），并注明与 token 层的关系 ✓。③ 本次为**产品级安全修复**，不等 Kevin（属我职权内的安全裁决）✓。

---

### 5.104 **Jing v1.0 验收通过（1849 行 / `c68f5253…`，8 条 delta 折入、非追加改动仅 1 处）+ ★★ P5-TRIAGE 定性：**新用户 100% 登不进站**（`/api/auth/verify` 在 EVM 登录主链上 ⇒ `upsertAsset` 撞缺表 ⇒ `42P01` 吞成 **401**）⇒ 我裁定 **B5-1 立即修复（不等 Kevin）**、`claim` 面待 Kevin 一句话；其余批 5 八项按清单排**（2026-09-30）

**① Jing v1.0（`deleg_87ba5fa6` task-0，Jing，24 calls / 471.8s）验收通过**：`docs/route-layer.spec.md` 升 **v1.0 / 1849 行 / 417626 B / md5 `c68f525340e2c9e0b2fdb1277a56acb6`**（v0.9 = 1554 行 / `8558aa84…`）；快照 `docs/versions/route-layer.spec.v1.0.md` **`cmp` exit 0、md5 逐位相同** ✓；delta 件 **20152 B**（§D0 指纹自证 + §D1–D8 逐条 + §D9 口径差/`NOT_MEASURED` + §D10 边界）✓；**v0.1–v0.9 九快照未动**（v0.9 快照 md5 仍 `8558aa84…`）✓；**非追加改动仅 1 处**（§5.1 加注、旧文逐字保留）✓。**8 条 delta**：① **§4.5 幂等键硬规则**「服务端已确定性派生键的面，前端不得自造键」+ **11 行逐面表** + 判负（锚点 `job-funds-service.ts:84`、`job-service.ts:180/:133`、`0013:592/:589` 均已现取）② **§3.5 D1''**（规格不得依赖 DB `DETAIL`、一律项目级 `reason`）③ **§4.10 A1 落定**（有符号 `amount`、±100000、`requireAdmin` 先行、`ops:` 键、`uID<0`/幽灵 ⇒ 400 `LD021`）④ **§4.9 数值定值**（10,000/10,000/50,000/100,000，逐条挂「Kevin 2026-09-30 定值」）⑤ **§5.6 + §5.1 行加注：`/api/prize-item` 非 sunset** ✓ ⑥ **§4.11 缺表族 7 表 + 两条活路由（`:354`/`:635`）+ 批 5 + D1'（非 400 ⇒ `503`、归批 6）** ⑦ **§2.5 前端接线映射表**（四线页面↔路径↔行号）⑧ **§1.12 复核：注册点 65 不变 + 行号漂移 18 条**（`index.ts` 1575→**1645**、`/api/job` :1289→**:1359** 等）⇒ **以现盘为准、旧读数留痕** ✓。
**★ 它自查两处（我裁定）**：① `ADMIN_POINTS_ADJUST_MAX_PER_CALL` 现取 **`:1182`** vs 我 §5.97 记 `:1180` ⇒ **两者都对、是 a1li 改线导致的漂移**（我 §5.97 的读数是 a1li 之前取的）⇒ **以现盘 `:1182` 为准**，登记为行号漂移非错 ✓。② **新登记缺陷**：A1「入参不完整」分支 `:1200-1202` 走 `sendError(400,'参数不完整')` ⇒ **非 R107 形状** ⇒ 收口项 **§9.E·E9**（本册不改码）✓ — **正确立案（它自己复现过）**。
**② ★★ P5-TRIAGE（task-1，Kong，25 calls / 440.2s）—— 本轮最严重发现**：报告 `docs/audit/p5-missing-tables-triage.md`（**242 行**）+ 产物 `p5triage-20260930T144143Z/{results.json,steps.log,d1p-transport.json}` + 2 只读脚本 ✓。
- **★ 两条活路由都还有人在用**（**双口径**扫描 + `dist/` 旁证）：`/api/auth/verify` → **`frontend/src/auth.js:169`**（唯一调用方 `WalletAuthPanel.jsx:111`）；`/api/task-progress/claim/` → `ClaimRewardModal.jsx:49` + `RewardPage.jsx:154`；两者均在在册路由内（`App.jsx:71 /reward`、`:73 /task`）✓；**4c-ii 的已删面逐条旁证**（`/api/shard*`、`chest/open`、`admin/task|prize/*` 等）✓。
- **★ `auth/verify` 确在 EVM 登录主链上**：`AuthPage.jsx:153` → `WalletAuthPanel.jsx:105` → `auth.js:158`（challenge）→ `WalletAuthPanel.jsx:111` → `auth.js:169`（verify）→ `index.ts:354/358`；**第 358 行 `getUserAsset || upsertAsset` 是登录事务内的取余额步骤、不可绕过** ✓。
- **★★ 爆炸半径（实测）**：`users_total=24` / **`users_without_cid1_account=12`（50%）**；**新 EVM 钱包必然无 `account` 行 ⇒ 100% 触发** `42P01` ⇒ **401**；`upsertAsset` 两分支（`:895 UPDATE`/`:910 INSERT`）**都指向缺表 ⇒ 恒抛**；`claim` 首次领取（`:670`）无条件调用 ⇒ 恒 `42P01` ⇒ 现 **500** ✓。**⇒ 症状 = 新用户登不进站（产品阻断级）**。
- **★ 真根因线索**：`src/index.ts:496` 注释显示**读端点的同族回退早已修好，登录端点 `:358` 未同步收口** ⇒ **同一族的修复漏了一处**（§23/类级修复的经典漏项）✓。
- **★ D1' 由 `NOT_MEASURED` 升级为受控实测**：`NeonDbError{code:null, message:'Error connecting to database: fetch failed'}`（两用例一致）⇒ **无码可 map** ⇒ 现状 `auth/verify` **401**（`:373`）、`claim` **500**（`:683`），**规格期望 503**（`:1158`）；驱动位置 `index.js:1544` ✓（与我亲核一致）。
- **7 表逐张选项表**（R 退役 / L 改接账本 / K 保留空态，含触达路由、前置、缺口）：`task`/`prize`/`prize_item` **写侧残留在 `410` 死写面、读口早已换源 ⇒ 删写侧无新缺口**；`shard`/`shard_transfer` 读口**已是 K 现状**，风险在 market 家族写侧（`NOT_MEASURED`）✓。**批 5 清单 8 项（B5-1…B5-8）**逐项带 `文件:行号` + 验收命令 ✓。
- **附带更正**：`database.ts:940 adjustPoints` **已改接账本（零表写入）** ⇒ **`asset` 的活触达面只剩 `auth/verify` + `claim` + market 家族（未测）** ✓（即 P4 的 DESIGN 报告描述的是修前态，属正常时序）。
**★★★ 我的裁定**：① **B5-1（登录端点）立即修复、不等 Kevin** —— 理由：**它在登录主链上、对新用户 100% 致命** ⇒ **产品阻断级**，且**修复不需要复活旧积分体系**（正解 = **把登录端点与读端点同族收口对齐**：只读 `account`，**不再写 `asset`**）⇒ **派 `B5-FIX-LOGIN`（本回合）**。② **B5-2（`claim`）待 Kevin 一句话** —— 它是**旧积分铸造/领取面**（= 发行口），本质是产品决策；**我给的默认 = 退役（`410`）+ 前端停止调用并显「已下线」**，一句话可改 ✓。③ 其余批 5 项（B5-3…B5-8）按清单排在 **B5-FIX-LOGIN 之后**，其中 `market` 家族写侧须**先取证** ✓。④ **D1' 归批 6**（spec `:1172`）且**修复方向 = 归 503**（它是基础设施类）✓。⑤ Jing v1.0 的 **§9.E·E9**（A1 非 R107 形状）**并入下一批收口** ✓。

---

### 5.103 **4c-ii-b 验收通过（商品线 + 交易所线 + 四项确认）★ 我亲跑红线：build 0 / **12 文件 105 例**（+15，达标 ≥96）；22 读数 14/14 旗标、4 页主题同构 rect diff = 0；★ 它纠正我的误登记（`/api/prize-item` **非 sunset 面**，实测为 `listing_order` 买家轴 + 退款 `order_id` 唯一来源）⇒ **本轮我第三次「未经复现的假设」**；★ `/api/market/1/orderbook` 恒空 **我追证为非缺陷**（退化币对）；★ 两处**真根因修复**（描边 token 日档值 = `none` 致 diff=14；单测 `t` 不稳定致 OOM）**（2026-09-30）

**交付（`deleg_8d03368f`，Kong，60 calls / 2193.0s，★ TRUNCATED（撞迭代上限）**；但红线与接线均已完成）**：新页面 `frontend/src/pages/listings/{ListingsPage,PublishListingPage,ListingDetailPage,listing-api.js,listings.css}` + `frontend/src/pages/market/{MarketPage,market-api.js,market.css}` + `frontend/src/test/unit/listing-market.test.jsx` + 改 `App.jsx`/`ShadePage`·`RewardPage`·`ProfilePage`/`jobs/{JobReviewPage,PublishJobPage}`/四语 locale（新增 `listings`/`market` 段，**键集四语同集**）；探针 `frontend/scripts/p4z-b4ciib-{geometry,diag}.mjs`、`backend-ts/scripts/p4z-b4ciib-01-http.ts`；报告 `docs/audit/p4-b4c-ii-b-listings-market.md`（**230 行**）；产物 `b4ciib-20260930T220842+0800/{logs,post}` ✓。
**★ 我独立复跑红线**：`npm run build` **`BUILD_EXIT=0`**（**477.73 kB** / 1.62s，较上版 455.84 kB 增 ⇒ 新页面入包）；`npx vitest run src/test/unit` **`TEST_EXIT=0`（12 文件 105 例，基线 90 ⇒ +15）** ✓✓；改动面 = 恰好 `frontend/**` + 报告/产物/探针，**后端 `src/**` 零改动** ✓。
**接线（全部已注册路径，含行号）**：**商品线** 上架 `POST /api/listing:1492` → `PATCH :1545`（draft→listed）；列表 `GET /api/prize/all:382`；详情 `GET /api/prize/:bID:433`；我的订单 `GET /api/prize-item:546`；购买 `POST /api/listing/:id/buy:1569`；退款 `POST /api/listing-orders/:id/refund:1590`。**交易所线** 挂单 `POST /api/order:751`、单撤 `:805`、全撤 `:782`、订单簿 `:829`、成交流水 `:844`、我的挂单 `:729`（页面经 `ShardPage` 薄壳挂既有 `/shard`，导航/骨架零改动）。
**关键实测**：**伪造 `price`/`seller`/`buyer`/`owner_uid` 全被忽略**（以 DB 行 + 分录为证 ✓ 符合 §4.8 三分）；**退款后 `stock 2→2` 不回滚** ✓（与我 §5.95② 裁定一致）；**撤单 `hold_release ×2`、`trade_fee` 分录 = 0**（**手续费不退**，符合 DL87）✓；HTTP **22 读数 / 14 断言旗标全 true**、**产物内 token 字节 = 0** ✓；几何 4 页（`/listing`·`/listing/new`·`/listing/1`·`/shard`）**日/夜 rect diff = 0**、`contains_object_object=false`、**扰动可判 + 复位逐字节**、横竖屏签名一致 ✓。
**★ 四项确认逐项落地**：① **审核入口按权限隐藏** —— `JobReviewPage`/`PublishJobPage` 依 `/api/admin/me` 能力集，非 admin **既不渲染也不请求**队列 ✓（正是我 §5.100① 的确认项）；② **账本流水读口未注册 ⇒ 只空态、零请求** ✓（成交流水是另一个已注册面，不混用）；③ **+15 单测** ⇒ 我定的 ≥96 达标 ✓（上单「0 新测试」的弱点已闭合）；④ **sunset 调用 4 文件 6 处逐条处置**：`/api/shard` 系**全部移除** ✓；**`/api/prize-item` 经实测不是 sunset 面**（`listing_order` **买家轴** + 退款 `order_id` 的唯一来源）⇒ **保留并登记偏差** ✓✓。
**★★ 我裁定三事**：① **`/api/market/1/orderbook` 恒空 = 非缺陷（我追证到底）** —— `(1,1)` 是**退化币对**（`$` 对自身），空是正确语义；页面用的是正确形态（测试断言 **`/api/market/7/orderbook`** = `base_cid` 语义），旧 `:bID` 口径已删 ✓；**但登记一小项**：市场页须能区分「币对退化 / 真无挂单」，并在 `base_cid === 1` 时**不发退化查询**（归下一单）。② **`/api/prize-item` 保留正确**，**我先前把它当 sunset 面登记是「未经复现的假设」⇒ 更正** ✓。③ 截断单的**自报未覆盖项照登**（其 `NOT_MEASURED` 逐项见报告，禁当 0/空）。
**★ 两处真根因修复（记功；不是掩盖症状）**：① 几何首测 `/shard` **diff=14** ⇒ 诊断真因 = **描边用了「日档值为 `none`」的主题 token `--sf-ticker-border`** ⇒ 改用**结构常量宽度 + 两档都是颜色的 token + `box-sizing:border-box`** ⇒ 复测**全 0** ✓；② 单测首版 **worker OOM** ⇒ 真因 = `useTranslation` 替身**每次返回新 `t`** 致无限重渲染 ⇒ 改**模块级稳定 `t`** 后全过 ✓。
**★★ 我的教训（本轮第三次同类）**：`/api/prize-item` 的「sunset 面」标签是我**凭归类推的、未复现** ⇒ 与 `§1.8:51` 引证、D1 立案同型（**三次都是"查盘"能挡住**）⇒ 已在 §5.102 写入技能纪律「立案/标签前必须自己复现一次」✓。
**边界自证**：未碰 `backend-ts/src/**`、`migrations/**`、spec、既有 audit、**token 值本身**；无 git 写、无 install、**无常驻 server**、无 `pkill` ✓。
**⇒ 前端三线（招工 / 商品 / 交易所）接线完成。下一批 = 批 5（缺表族）+ 批 6（权限种子 + 审计表 + Tailwind 本地化 + 日累计上限 + D1'）+ Jing v1.0（规格折入）。**

---

### 5.102 **★ D1 勘误：我的立案案由被 ERRCODE-AUDIT 推翻（驱动不丢码）⇒ 作废；改登记两条真缺口：D1'（非 400 分支驱动丢 `code` ⇒ 落 500，**结构性、未触发、我逐字核到 `index.js:1542-1544`**）与 D1''（驱动**恒不搬运 `DETAIL`** ⇒ 409 体带 `detail_unavailable`，12/12 实测）；★ 正面结论：M 面 9 键**全部命中规格期望、0 条落 500**；★ 我的教训：**立案前必须自己复现一次**（本轮第二次把上游转述当立案依据）**（2026-09-30）

**交付（`deleg_d7f90a7b`，Kong，30 calls / 347.5s）**：报告 `docs/audit/p4-err-fidelity.md`（**218 行**；我读 md5 `616609f18ab20e668ad09ce86cdd5b2f`，**它报 `6232dfa9…` —— 口径/时点差，以盘面为准**）+ 产物 `errfid-20260930T140652Z/{mech-cases.json,http-cases.json}`（**无 token 明文**，仅 `sha256_12=34e7ba9447ae`）+ 脚本 `p4z-errfid-0{1-mech,2-http}.ts`；**未改任何 `src/**`/`migrations/**`/spec/`frontend/**`**、无 git 写、无 DDL/DML、未起停服务 ✓。
**★ 核心结论（推翻我的立案前提）**：**驱动不丢码** —— `LD0nn` 与标准 SQLSTATE 在驱动层**完全同形**（`NeonDbError`，`own_props = stack/message/name/code/sourceError`，`code` **逐字正确**）。**✅ 我独立核到结构性证据**：`@neondatabase/serverless/index.js:1542-1544` = `if (status === 400) { const {message, code} = await res.json(); ... } else { await res.text(); throw new Error(\`Server error (HTTP status ${status}): ...\`) }` ⇒ **只有 400 分支读 `code`，非 400 一律丢** —— 与它的论断**逐字相符** ✓✓。**且案由在当前 HEAD 不可复现**：`uID=-1` ⇒ 实测 **400 `LEDGER_RESERVED_UID`**，读数来自**路由前置闸**（`src/index.ts:1209`/`:1250`，注释「不调账本、不造幽灵账户」—— 我亲核）⇒ **请求根本没到账本/驱动**；上单那条观测**只能出自改前形态或另一条路径**（**症状不是成因**）。
**★ 真缺口 D1'（结构性、未触发）**：非 400 分支 ⇒ 驱动抛 `Server error (HTTP status N)`、**`code` 恒 `null`** ⇒ 落 **500** 兜底。实测 12/12 全走 400 分支（`driver_http_status_leak` 全 `null`、**未触发**）✓。**★ 真缺口 D1''（已实测）**：HTTP 驱动**恒不搬运 `DETAIL`/`constraint`** ⇒ 端到端 409 响应体里 `details.detail_unavailable='driver_did_not_carry_detail'`（**12/12 `detail=<undefined>`**）✓。
**★ 真值表（33 键，未实测一律 `NOT_MEASURED`）**：**M 机制面实测 9 键** —— `LD001`→409、`LD002`→409、`LD003`→409、`LD007`→404、`LD017`→400、`LD021`→400、`LD022`→404、`LD023`→400、`LD027`→503 ⇒ **全部命中规格期望、0 条落 500** ✓✓（**这是正面结论：错误码契约基本可靠**，我此前「凡自定义码都可能 500」的担心**在 M 面不成立**）；**R 路由面 3 读数**（`LD021`→400 走前置闸、`LD001`→409 真驱动且 `orphan_currency_rows=0`、`LD005`→400 旁证）；聚合 12 读数 = `3×400 / 2×404 / 3×409 / 1×503 / 3×500`，**3 条 500 全是对照组非账本码**（`22012`/`42P01`/`42703`，属设计兜底）✓；**27 键 `NOT_MEASURED`**（需真写或特殊库态，逐条标口径）✓。
**★★★ 我的裁定**：① **D1 作废**（勘误专节 + 我亲核的结构性证据 + 真根因 + 修正后归属）—— **不得以「补丁式例外」静默收口** ✓。② **D1' ⇒ 归批 6**：非 400 的**驱动/传输类错误本质是基础设施** ⇒ 应归 **503**（不是 500，符合我 ㊵ 的「结构性修复优先」），且**先补只读观测面**（选项④）再改分类；选项②（归一化器多字段提码）作为兜底，**需去重 `unwrapInfraCause` 防漂移**。③ **D1'' ⇒ 口径约束**：**规格不得依赖 DB `detail`/`constraint`**，API 必须用项目级 `reason`（现状已是）⇒ **交 Jing v1.0 写入规格**（不许写「409 携带 constraint 详情」）。④ **4 条 500 候选成因**（非 400 代理响应 / 不经 `runLedgerFn` 的 catch / 改前形态 / 非账本码误读）**逐条 `NOT_MEASURED` 登记**，并**指定验证方式**（归批 6）。
**★★ 我的教训（进技能）**：**立案（新缺陷）前必须自己复现一次**；上游单的「观测」未经复现**不得当立案依据** —— 本轮**第二次**同类（前一次是转引 `§1.8:51` 未核）✓。
**自曝（采信）**：首版脚本把账户表猜成 `public.ledger_account` ⇒ `42P01`（**该错误本身是「标准码经 HTTP 驱动不丢码」的旁证**），真名 `public.account`，已修重跑（退出码经 `PIPESTATUS` 取 = 0）；**本机无 `psql`** ⇒「直连 vs HTTP 同 SQL 对照」子证据 `NOT_MEASURED`，以「自定义 vs 标准对照组 + `ledger_sqlstate_of` 运行时复核」等效替代 ✓。

---

### 5.101 **A1-LEDGER-IMPL 验收通过（后台调分改接账本：`+n ⇒ op='mint'`、`−n ⇒ op='entries' + 单腿 burn`）★ 15/15 两轮实测 + 幂等重投 Δentries=0/ΔΣ=0/txid 逐字相同 + `Σ(cid=1)` 差额**恰等**（`+137−37+100000−100000`）⇒ **A1 路径 `42P01` 归零**；★ leg 形状**现场现取、未发明**（我记功）；★★ 它自曝**新类级缺陷 D1**：`ledger_raise` 自定义 SQLSTATE 经 neon HTTP 驱动 `code` 丢失 ⇒ 归一化成 **500** ⇒ 我立案并派 ERRCODE-AUDIT 只读取证**（2026-09-30）

**交付（`deleg_309746df`，Kong，55 calls / 1566.2s）**：改 `backend-ts/src/database.ts`（**61/23**）+ `backend-ts/src/index.ts`（**58/13**，我亲核 numstat）；新增报告 `docs/audit/p4-a1li-impl.md`（**219 行 / 14 节**）+ `scripts/p4z-a1li-01-e2e.ts` + 产物 `a1li-20260930T{pre,1340Z,1455Z}/**`；**未建任何表**、未动 `migrations/**`/`ledger.ts`/`ledger-errors.ts`/spec/`asset` 相关码；无 git 写、无删除型 SQL、无 `pkill`；仅面板 `restart seafood-api` ×2（各等 `/health` 200）✓。**★ 我独立复核**：`tsc --noEmit` = **0 行 / exit 0**；`/health` 200；**注册点 65**；关键结构亲核（`normalizeLedgerError` 已用、`:963` `op: amount>0?'mint':'entries'`、`:975` `platform=true`、`:977` 单腿 `kind:'burn'`、`:989` 单条 `SELECT ledger_post_event(...)`）；**`asset` 残留只在 `upsertAsset`/`getUserAsset`（属批 5），A1 已完全不碰它** ✓。
**实现要点（照裁定）**：`adjustPoints` 重写为**一条** `SELECT`（CTE：用户存在性闸 → gate → `ev = ledger_post_event($1::jsonb)` → **同语句**取事后余额快照）；`requireAdmin` 仍在第一行；`amount===0`⇒400 `NOT_A_POSITIVE_INTEGER`；`|amount|>100000`⇒400 `OVER_MAX_SINGLE_AMOUNT`；`uID<0` 或库内无此用户 ⇒ 400 `LEDGER_RESERVED_UID`；**幂等键走既有 `resolveAdminOpsKey`**（缺键 400 / 非 `ops:` 前缀 400）；指纹按 DL96；catch 改走 `normalizeLedgerError`（**去掉旧的 404 吞错**）✓。
**★★ leg 形状 = 现场现取、未发明（我记功）**：`migrations/0020:156` 的 op 白名单 = `mint/transfer/hold/hold_release/settle/entries`（**没有 `burn` op**）⇒ **正数走 `op='mint'`（`platform=true`，恰 1 条 `+n` 分录）**；**负数走 `op='entries'` + 单腿 `kind='burn'`（`delta` 负串）**；`ref = currency`/`cid`（`data-layer.spec:513`）；形态**照抄已工作的 C1/C2**（`database.ts:1345/1447`）—— 这正是我 brief 的硬要求（**不得凭空发明 leg 形状**）✓✓。
**实测（真 token · 真库 · 真 HTTP · 5788）**：`+137` ⇒ 200 `mint`、余额 0→137、**`Σ(cid=1)` +137**、`txid=259`；`-37` ⇒ 200 `burn`、137→100、**`Σ` −37**、`txid=260`；`±100000` ⇒ 200；`±100001` ⇒ 400；`0` ⇒ 400；**非 admin ⇒ 403（含「非 admin + 超上限」仍 403 ⇒ 权限闸优先）**；无 token ⇒ 401；**幽灵 uid ⇒ 400 且 `Δledger_entry=0`（零开户）**；`-1` ⇒ 400；缺键/坏前缀 ⇒ 400 ✓。**幂等**：4 个写用例**同键重投 ⇒ 全部 200 replay、`Δledger_entry=0`、`ΔΣ=0`、`txid` 逐字相同**（重投轮 15/15、`POST2_EXIT=0`）✓✓。**账本面**：243→255 条；`mint 5→9`、**`burn 0→4`（首次启用）**、**`Σ(cid=1)` 2,000,000→2,000,200 = `+137−37+100000−100000` 恰等**、`txid` 连续可逐笔归因 ✓。**回归**：410 面 **6/6**、C1/C2 下限 10000/10000/50000 仍挡 400、`tsc` 0（两次）；**成功面不再重定向到缺失的 `asset` ⇒ A1 这条路径的 `42P01` 归零** ✓。
**★★ D1 = 新类级缺陷（我已立案并派 `ERRCODE-AUDIT`）**：**`ledger_raise` 的自定义 SQLSTATE 经 neon HTTP 驱动后 `code` 丢失 ⇒ 归一化成 `500`**（改前证据：`-1` 面抛 `NeonDbError: LEDGER_RESERVED_UID`，却以 500 露面）；本片用**路由前置闸**让 A1 的该面绕开它；**残留 = 「`burn` 超余额 `LD001`」面仍会 500（未测）**，修复落点在其**禁写**的 `ledger.ts`/`ledger-errors.ts`。**⇒ 影响面可能很大**（凡走自定义 SQLSTATE 的账本错误都可能以 500 露面，与规格期望的 400/409 不符）⇒ **派只读取证单**（列全受影响面 + 机制 + 修复选项），**不由本片顺手改** ✓。
**D2 = 待批 6**：审计留痕（库内无审计表 ⇒ 只登记不改）+ 日累计上限 ✓。**D3 = 照登**：一次性夹具残留 **6 行 `users`**（零 DELETE 纪律未清理）+ **并发写者**在同窗口写入 `job_escrow +4`（cid≠1、未污染 cid=1 读数）✓。
**⇒ A1 线关闭（除 D1 依赖面）；批 5（缺表族）+ `ERRCODE-AUDIT` 待办。**

---

### 5.100 **4c-ii-a 验收通过（招工线 + 我的：接线 + 横竖屏 UX）★ 幂等键「逐面声明」完全守住我 §5.96④ 的裁定（派生面前端不传键）；「流水」读口未注册 ⇒ 空态 + 登记、**不自造接口**；真实 HTTP 全链 12 步含 403/409 负例；两个新页面主题同构回归 rect diff = 0。★ 我三条裁定（审核面 = 管理员面 / 流水接口归批 6-7 / 新页面须补测试）+ 一条待核（sunset 面调用残留）**（2026-09-30）

**交付（`deleg_40782d5d`，Kong，51 calls / 1666.0s，run `b4cii-a-20260930T134304`）**：新增 `frontend/src/pages/jobs/{PublishJobPage,JobDetailPage,JobReviewPage,job-api.js,jobs.css}` + `App.jsx`/`TaskPage.jsx`/`ProfilePage.jsx` + 四语 locale；探针 `frontend/scripts/p4z-b4cii-geometry.mjs`、`backend-ts/scripts/p4z-b4cii-a-0{1,2}-*.ts`；报告 `docs/audit/p4-b4c-ii-a-jobs-profile.md`；产物 `b4cii-a-*/post/{b4cii-a-http.json,b4cii-a-nodb.json,b4cii-geometry.json}`。**后端零改动** ✓。
**★ 我独立复核**：`npm run build` **`BUILD_EXIT=0`**（**455.84 kB** / 1.55s，较上版 435.55 kB 增长 ⇒ 新页面确已入包）；`npx vitest run src/test/unit` **`TEST_EXIT=0`（11 文件 90 例）**；改动面 = `frontend/**` 4 改 + `pages/jobs/` 5 新件 + 报告/产物/探针；**`backend-ts/src/{index.ts,database.ts}` 的改动经我核 = 在飞的 `a1li` 单所为**（该单自己披露 ✓，**跨单卫生到位**）。
**接线面（全部已注册路径）**：`task/new`→`POST /api/job`；`task`（列表 = 既有 `GET /api/task/all`）；`task/:jobId`→`GET /api/task/:tID` + `/apply` + `/accept` + `POST /api/task-progress/:identifier/submit`；`task/review`→`GET /api/tasklist/pending-verification` + `POST /api/job/:jobId/review`；「我的」余额 = `GET /api/user/asset/:uID`（5 键）。**★ 「流水」读口未注册**（`/api/user/ledger` 实测 **404**）⇒ **保留空态 + 登记、不自造接口** ✓✓（正确处置）。
**★★ 幂等键逐面声明（守住我 §5.96④ 裁定）**：① 发布 = **前端提供 `cli:`**（服务端 fail-loud，`job-funds-service.ts:84`；tracker 保证同操作同键）② 申请 = **服务端派生**（`job-service.ts:180`）③ 接受 = 无键面 ④ 提交 = **服务端派生**（`job-service.ts:133`）⑤ 审核 = **事件根键服务端派生**（`migrations/0013:592`）⑥ 余额/流水 = 纯读 ⇒ **②③④⑤ 前端一律不传键** ✓（正是「服务端已确定性派生 ⇒ 前端不得自造键」）。
**真实 HTTP 全链（12 步）**：发布 `400`（缺键）/`401`（无 token）/`200`（17 键、`job_escrow`×2 全在 uid 11）/ **同键重投 `200` 且库内 1 行** → **列表可见** `job_in_list=true` → 详情 `200`/`404` → 申请 `404` 负例 / `200`（派生键 `cli:p4b2a:apply:23:12:…`）/**`409` 自投** → **接受 `403`（非雇主，硬要求、零分录）**/`200` → **提交 `200`（9 键）**/`403` 非打工人/**`409` 同实体异内容（`LEDGER_IDEMPOTENCY_CONFLICT` —— 永久回归项未退化）** → 审核 `403` 非管理员（零分录）→ 余额 `200`（5 键）✓。
**主题同构回归（两个新页面）**：`/task/new`、`/task/review` **日/夜 rect 逐值 diff = 0**、真换肤（page_bg `#FDE815`→`#0B0C0E`）、DOM 签名相等、**同档重测逐字节相同**、**1px 扰动被检出并复原回基线**、横竖屏结构签名相等、页面无 `[object Object]` ✓✓。
**★ 我三条裁定 + 一条待核**：① **审核面 = 管理员面**（后端闸 `requireAdmin(review_tasks)` 为**唯一真源**，与 §6.1 一致）⇒ **前端必须按权限隐藏入口**（非 admin 看不到/进不去）⇒ 该确认项**归 4c-ii-b**（不是新单）。② **「流水」只读接口归批 6/7 决策**（本轮空态正确；**不得就地自造**）。③ **弱点登记**：**3 个新页面 0 新测试**（单测例数 90 未增）⇒ **要求 4c-ii-b 为新增交互至少补 N 条单测**（不得再零增量）。④ **待核**：`TaskPage/ProfilePage/jobs` 聚合 grep 仍见 **`/api/prize-item`、`/api/shard`**（都是 **sunset 面**）调用 ⇒ **4c-ii-b 逐文件核并清理**（或确认空态容忍、不得留 500）。
**`NOT_MEASURED` 3 项（禁当 0/空）**：审核成功面（settle/refund —— 本 run 无 `can_access_admin=true` 夹具，**负例已测**）；提交「同内容 replay」（首笔落 503 使异内容那笔成了首次成功提交）；雇主侧审核队列（权限闸待裁 ⇒ 已由我裁定归管理员面）✓。
**自曝 4 条（采信）**：① 首版探针误用 `job_submission.application_id`（真列 `job_id/worker_uid`）已修；② 无 DB 版探针首轮 worker 误选管理员 uid ⇒ **该轮读数作废**、报告只取 01 末次 run；③ 后端/Neon 多轮 `driver_connection_error`/`LEDGER_TX_TIMEOUT`（环境级，已重跑 3 次）；④ `git status` 中 `src/**` 改动**非本单所为**（并发单元 `a1li`），已单列披露 ✓。
**探针：`p4z-b4cii-geometry.mjs` exit 0；`p4z-b4cii-a-01-http.ts` 末次 run exit 0** ✓。
**⇒ 下一步 = 4c-ii-b（商品 + 交易所接线 + 横竖屏 UX，含上述①②③④ 四项确认）。**

---

### 5.99 **A1-LEDGER-DESIGN 取证验收通过（`asset` 缺表**类级**差集 + A1 四册齐核）★ 我裁定：① A1 走「选项 A：改接 `ledger_post_event` + `mint`/`burn`」、**否 B（补建 `asset` 表与已冻结册正面冲突）**；② 方向以**有符号 `amount`** 表达；③ 审计表**登记批 6、本单不建**；④ `asset` 缺表族立为**批 5「缺表族清理」**、默认 sunset 处置、两处待 Kevin 一句话；★ 并**更正我的一处引证错误**（`§1.8:51` 不存在，真源 = §1 端点处置表 `#51 = :176`）；派 A1-LEDGER-IMPL**（2026-09-30）

**交付（`deleg_3e779a59`，Kong，36 calls / 466.5s）**：报告 `docs/audit/p4-a1ledger-design.md`（**261 行 / 41.7 KB**，骸架先行→逐段回填、无占位）+ 只读探针 `backend-ts/scripts/p4z-a1ld-01-probe.ts`（走 `neon()` HTTP、`sql.query ?? sql(t,p) ?? sql.unsafe` 自适应、纯 `SELECT`/`information_schema`/`pg_catalog`）+ 产物 `a1ld-20260930T133212Z/{results.json,tables_from_migrations.txt,src_table_refs.txt}`。边界：**无 git 写、无 DDL/DML、未启停服务**、`src/**`/`migrations/**`/spec **全未触碰** ✓。
**① 类级差集（代码引用 ∖ 迁移建表）**：迁移侧现取 **20 张真表**（严格式）+ `users`（`0006:75` RENAME，非 CREATE）⇒ 21 个名字；**`asset` 在 `migrations/**` 命中 = 0（裸名与带引号双口径皆零）** ✓（与我的独立取证一致）。差集原始 9 项 → 剔除 1 个假阳性（`profile` 实为错误消息 `index.ts:483`）⇒ **真项 8 个**，其中 **7 项库内确实不存在**：`asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer`（`schema_migration` **存在**（19 行），只是不由迁移创建）。**逐项**已给函数 `file:line`、读/写、触达路由、**吞成什么（404/401/500/200 空态 四种不同面）**、spec 登记行号 ✓。
**★★ 本单新发现（价值最高）**：`upsertAsset`（写侧）另有 **2 条在册活路由**被牵动 —— **`POST /api/auth/verify`**（`:352`→`:356`；**无 `cid=1` account 行时撞 `42P01` → 被吞成 `401`**）与 **`POST /api/task-progress/claim/:jID`**（`:633`→`:657/:668`）；HTTP 级实测标 `NOT_MEASURED`（其写集禁写）✓。旧表族（`task`/`prize`/`shard`）多为 **`410` sunset 死写**；**`GET /api/task/all`、`/api/task/:tID`、`/api/prize-item` 零命中**（不触缺表）⇒ **避免了误伤** ✓。
**② A1 四册齐核（㊹）**：**kind = `mint`/`burn`、仅 `$`(cid=1)**（`data-layer.spec:343/:292/:513`、`route-layer.spec:176/:640`）；**方向**（`route-layer.spec:662`）：减方 = 平台(mint) / 目标用户(burn)、增方 = 目标用户(mint)（burn 无受款方）；**平台 uid `0` = 铸币源**（`ledger.spec:827`），白名单 `ledger.ts:535-555` —— **`mint` 仅在 uid `0` 的 credit 侧、`-1` debit 恒空**，且 DB 侧 `ledger_assert_platform_mutation` 在盘 ✓；**上限** = 单笔 100000（`index.ts:1180`）、**「日累计」四册字面 0 命中**；**审计台 P6 尚不存在**（库内 audit-like 仅 `currency_status_log`）；**`commission.spec` 对 A1 = 0 命中**（`mint|burn` 与「调分」双口径皆零）✓。**7 条张力（只列不裁）**，最硬 = **现实现 `amount > 0` 且路由无方向参数**（`index.ts:1191/:1197/:1213`）⇒ **册内 `burn`（扣分）不可表达**；另含 uid0 debit 白名单、审计无落点、**注册点漂移**（spec 记 `:1066`/`:995`，现取 `:1182`）。
**★ 我的一处引证错误（照实更正）**：我 brief 里的「`route-layer.spec §1.8:51`」**不存在** —— `:51` 是空行、§1.8 起点在 `:304`；**真源 = §1 端点处置表**（表头「51 个注册点」）**编号 51 的行 = `:176`**，已逐字引 ✓。⇒ **此引用作废，以现取为准**（我转引了上游单的锚点而未先核）。
**★★★ 我的裁定**：① **选 A**：A1 **改接 `ledger_post_event` + `mint`/`burn`**；**否 B**（补建 `asset` 表与已冻结册 **正面冲突**：`data-layer.spec:166`/`:217`、`ledger.spec:821` ⇒ **会造出双真源**，且只解 404、**不解审计**）；**C（删路由退役 #54）仅作 Kevin 不要此功能时的备选**。② **方向以「有符号 `amount`」表达**（**正 ⇒ `mint` 到目标用户**；**负 ⇒ `burn` 从目标用户**；**上限按绝对值 100000**）—— 理由：路由名「调分」天然含正负、**不新增字段**（兼容既有调用方）、与 §4.8 类② 三件齐（可传 + 权限 + 上限 + 审计）相容；⇒ **我 §5.97② 的「有符号」裁定经四册齐核后成立** ✓。③ **审计留痕**：库内无审计表 ⇒ **登记为批 6 迁移项**（`admin_audit_log` + 触发器手法），**本单与实施单均不得建表** ✓。④ **`asset` 缺表族立为批 5「缺表族清理」**：默认按 spec sunset 口径处理（退役 / `410` / 空态）；**唯 `POST /api/auth/verify` 与 `POST /api/task-progress/claim/:jID` 两处需 Kevin 一句话**（牵动「**旧积分体系是否复活**」）⇒ **我给的默认值 = 不复活、按 sunset 处置（一句话可改）**；其**用户可见影响（前端是否在调这两面）待 4c-ii 回执后扫**。
**探针自曝 6 条**（首轮正则强制字面 `public` 致漏报 → 修正后 28 行；建表提取 5 行 `IF` 残渣；3 处假阳性；`neon()` 命中分支未打印）+ **`NOT_MEASURED` 9 项（N1–N9）** ✓。
**⇒ 已派 `A1-LEDGER-IMPL`（按上述裁定实施）；`asset` 缺表族并入批 5。**

---

### 5.98 **4c-i + 4c-i-FIN 验收通过（主题 token 层 + 横竖屏骨架 + app shell）★ 真实浏览器实测：日/夜 14/14 元素 rect 逐值相等、可重复逐字节相同、1px 灵敏度非恒真、日→夜→日回基线；1440/390 签名同串 ⇒ 主题/响应式同构 AC 在**离线确定性环境**下达成；我裁定其两条自曝（Tailwind 走 CDN ⇒ 离线报错 + 线上 Tailwind 环境未测）为**新登记债务**与**后续验证腿**；并顺带闭合「四语缺 `shard` 键」既有缺口**（2026-09-30）

**交付（`deleg_4e95fd55` 60 calls 截断 → `deleg_bdb3e608` 10 calls / 153.3s 收尾，Kong）**：① **主题 token 层**：`frontend/src/theme/tokens.js`（458 行；**107 主题 token**：日/夜键集合与顺序完全相同、103 键值不同、4 键同值；+ **32 结构常量**（几何，两档同值）+ `EXCLUDED_FROM_THEME` **10 条**「提取到但刻意不进主题差集」（含行号与理由：夜档等宽数字字体、letter-spacing、font-size、border-width、grid 列数等））+ `theme-tokens.css`（生成物 256 行）+ `ThemeProvider.jsx`（**不产生任何 DOM 节点**；沿用既有 `localStorage['theme']` + `<html data-theme="light|dark">` 口径，旧 dark 规则与 Header 开关继续有效）；**值全部提取自 `docs/design/style-preview.html` 变体 A（200–267）/ 变体 B（273–351），逐项带行号，无发明值** ✓。② **骨架/shell**：`src/shell/{breakpoints.js,nav.js,BottomTabBar.jsx,AppShell.jsx,shell.css}` + `src/pages/ThemePreviewPage.jsx`（`/theme-preview` 四语前缀可达）+ `theme-preview.css`；`App.jsx` 改用 AppShell；**导航项 5 项真实提取自现有内层路由**（index/reward/task/shard/profile），**无自造页面名** ✓。③ 新增 2 个测试文件（`theme-tokens.test.js`：逐键回读 style-preview 对应行 + CSS↔JS 互校 + 差集键名/值形态不得含几何属性；`theme-shell-isomorphism.test.jsx`：区域顺序恒定 + 日/夜 DOM 形状签名相等 + shell/theme 的 JS 无 `matchMedia/innerWidth` + shell.css 只在 767px 一个断点且宽屏无 `[data-theme]` 选择器 + 四语键集合相同 + siteTitle 硬编码）。④ 顺带闭合既有缺口：四语 locale 缺 `shard` 键（Header 一直在回落中文）⇒ 四文件同补（69→70；非 zh 三条译文标「待复核」）。
**★ 我独立复核**：`npm run build` **`BUILD_EXIT=0`**（435.55 kB JS / 60.56 kB CSS）；`npx vitest run src/test/unit` **`TEST_EXIT=0`（11 文件 90 例，基线 9/63 ⇒ +2/+27）**；报告 `docs/audit/p4-b4c-theme-shell.md` **305 行 / 16 节（§0–§8 齐）**；`geometry.json` 关键字段我亲核（`geometry_diff_count: 0`、`day_repeat_byte_identical: true`、`day_return_byte_identical: true`、`skin_changed: true`、1px `detected: true`）；改动面**全在该单写集内**（`frontend/**` 7 改 + 新件、报告、产物、探针）✓。
**★ 真实浏览器读数（Chrome 154.0.8037.58，`executablePath` 指本机、无 server/端口、外部 CDN 全 abort）**：**日/夜 rect 逐值相等 14/14**（hero/search/chips/layout/grid/card-1/card-4/side/price-1/toggle-day/toggle-night/tabbar/topnav/#sf-route-container；`geometry_diffs=[]`）；**主题确已变但只变外观**（卡 bg `#fff→#141619`、radius `13px→2px`、shadow 有→none；`<html data-theme>` `light→dark`；外壳底 `rgb(253,232,21)→rgb(11,12,14)`）；**可重复性** = 整份读数**逐字节相同**、11 个臂各 2 次稳定读数；**1px 灵敏度（非恒真）** = 给 chips 注入 `padding-top:1px` ⇒ h `29→30` **判出**、复原后逐字节回基线；**日→夜→日** = 逐字节回基线、**DOM 节点数 772 = 772（不增删节点）**；**1440/390** = 签名同串（`DIV[shell]>DIV[topnav]>MAIN[content]>DIV[footer]>NAV[tabbar]>A[nav=…]`）、节点数均 772，差异只在导航形态/栅格（tabbar `none→grid`、grid `1086→374`）⇒ **满足 §5.7 同构 AC（`getBoundingClientRect` 逐值相等；只允许 radius/shadow/颜色变）** ✓✓。
**★★ 我裁定它两条自曝（均采信为真、照登）**：① **`ReferenceError: tailwind is not defined`**（探针按设计 abort 全部外部源 ⇒ 该报错源自 **Tailwind 走 CDN**）⇒ **登记为新债务**：**前端依赖外部 CDN 提供 Tailwind** ⇒ **离线/弱网/内网不可用 + 外部依赖风险**；**建议批 6/P7 改本地构建 Tailwind**（本单读数在**离线确定性环境**下仍成立，因 shell/token 用自有 CSS 驱动 ✓）。② **线上 Tailwind 生效环境的 rect 未测** ⇒ **登记为后续验证腿**（待能连网跑同一探针时补），**报告 §5 已逐项标 `NOT_MEASURED`（10 条，全带原因与替代证据，无 0/空）** ✓。
**⇒ 下一步 = 4c-ii（业务页接真实接口 + 横竖屏 UX 收口）**。

---

### 5.97 **A1-CAP 验收通过（上限 100,000 落地、零新造码、权限闸优先）★ 但它挖出一个真缺陷（非它改坏）：库内无 `asset` 表而 `database.ts` 写 `asset`/读 `account` ⇒ A1 成功路径恒 `42P01`→被吞成 `404`；且它做了一处关键口径纠正（ΔΣ=0 ≠ 纯转移，而是该路由根本不接账本）⇒ 我裁定并入 `A1-LEDGER`（先四册齐核再实施）+ 派类级取证**（2026-09-30）

**A1-CAP（`deleg_93d5ce69`，Kong，43 calls / 1756.9s，run `a1cap-20260930T210204`）验收通过**。改动 = **仅 `backend-ts/src/index.ts`，`git diff --numstat` = 25/0（我亲核）**、`database.ts` 未动；新增单点常量 **`ADMIN_POINTS_ADJUST_MAX_PER_CALL = 100000` @ `:1180`**（注释含「**Kevin 2026-09-30 定值**」「日累计上限留后续（批 6）」）、单点校验位 **`:1196-1211`**（超限 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason=OVER_MAX_SINGLE_AMOUNT` @ `:1209`；`≤0` ⇒ 同码 + `reason=NOT_A_POSITIVE_INTEGER` @ `:1201`）；**零新造码/reason** ✓（真源 `ledger-errors.ts:49`、`currency-service.ts:122/125`）；`requireAdmin` 未动且**先于金额校验** ✓。读数：`100001` 改前 `404` → 改后 **`400`**；`1e21` 同；`0`/`-5` 改前 `404`（**确不拒**）→ 改后 **`400`**；非 admin（含「非 admin + 超限」）⇒ **`403 AUTH_FORBIDDEN`/`NOT_ADMIN`**；无 token ⇒ 401；`tsc --noEmit` **0 行 / exit 0**；**注册点 65 不变**；**410 面 6/6**；C1/C2 下限（10000/10000/50000）仍生效（`fee:9999`/`deposit:49999` ⇒ `400 BELOW_SERVER_FLOOR`）；`/health`·`/api/home` 200；重启只走面板 `{sid}` 路由 ✓。报告 `docs/audit/p4-a1cap-points-cap.md`（**155 行 / 13 节**）+ 产物 `a1cap-20260930T210204/{recon,pre,post}`（**secret 泄漏 0 / JWT 字面 0，程序化校验**）+ 2 脚本。
**★ 真缺陷（已于它手上暴露、非它引入；我独立复核）**：**`POST /api/admin/points/adjust` 成功路径恒不可达 200** —— **库内无 `asset` 表**（`information_schema` 现取 22 表）而 `database.ts:895` `UPDATE asset`/`:910` `INSERT INTO asset` 写它、`:866` 却 `FROM account` 读 ⇒ 恒 `42P01` → 被吞成 **`404「积分调整失败」`**。**★ 我的独立取证**：`grep -rniE 'create table[^;]*\basset\b' backend-ts/migrations/` = **空**（**没有任何迁移建过 `asset`** ⇒ 表不存在成立，**不必碰库即可证**）+ 错配三行行号我已亲核（`:866` vs `:895/:910`）。**改前/改后响应体 fp 逐位相同** ⇒ **本单未改变该行为** ✓。**⇒ 这是类级问题**（不止 A1 一处引用 `asset`）⇒ **必须全仓扫**。
**★ 它的关键口径纠正（我采信、并记为教训）**：金额守恒读数（ΔΣtotal/Σbalance/Σfrozen = 0/0/0、`ledger_entry` 241→241）**不能读成「纯转移」**，而是「**该路由完全不接账本**」⇒ **「账本分录正确」不成立**，它**拒绝用 0 冒充合规** ✓✓（符合 ⑮/㊲ 精神）。
**★ 审计留痕核查**：**无通用后台操作审计表**；唯一含 log 者 = `currency_status_log`（7 列、`cid` NOT NULL FK、`from/to_status` NOT NULL、append-only）**不能冒充复用**（须编造 cid/状态 ⇒ 篡改语义）⇒ **未建表** ✓，登记为**批 6 迁移项**（建议 `admin_audit_log` 全列清单 + 触发器手法）。
**★★ 我裁定它的两问**：① **A1 改接账本 = 必做**，但**先取证后实施**（触资金语义 ⇒ 按㊹必须**四册齐核**：`ledger.spec`/`data-layer.spec`/`commission.spec`/`route-layer.spec`，每结论带 `文件:行号`；`route-layer.spec §1.8:51` 原文逐字引）⇒ **并入 `A1-LEDGER`**，「成功面 200」的缺口**作为已知缺陷登记在案、不阻塞前端线**（该路由现为**响亮的失败**（404），**不移动资金** ⇒ **无资金风险**，只是功能空转）。② **`≤0 一律拒` ⇒ 我裁定改为「有符号」**（`0 < |amount| ≤ 100000`；正 ⇒ `mint`、负 ⇒ `burn`），**理由**：路由名为「调分」、`burn` kind 已存在、且扣分是管理员正当能力；**但此裁定须经四册齐核确认后落地** ⇒ **过渡期保留现状（拒 `≤0`）**，因该路由本就 404 ⇒ **无实际资金影响** ✓。**⇒ 已派 `A1-LEDGER-DESIGN`（只取证不裁决）。**

---

### 5.96 **NUM-1 + 4b-i 验收通过（后者为截断退出、我独立复核后采信）：① 下限已定值为 10,000/10,000/50,000（边界 9/9、`Σtotal` Δ=0）② ★ A1 上限**未落且它正确地不越界**（检查点在写集外）⇒ 授权 A1-CAP 补单（含审计留痕缺口核查）③ 4b-i：`npm run build` exit 0 + 单测 63/63（**均我亲跑复核**）+ 改动面干净 ④ ★ 我裁定其「母单 vs 权威清单」分歧 —— **不加客户端自造键**（服务端已确定性派生）⑤ Neon 抖动致服务自退 2 次（既有驱动级债务）**（2026-09-30）

**NUM-1（`deleg_7ad0d484` task-0，Kong，54 calls / 2038.9s，run `num1-20260930T204732`）**：**验收通过**。三处常量真名 = `CURRENCY_CREATE_FEE_FLOOR`(`:142`)/`CURRENCY_LIST_FEE_FLOOR`(`:143`)/`CURRENCY_LIST_DEPOSIT_FLOOR`(`:144`)，**我亲核现值 = 10000/10000/50000** + 注释为「Kevin 2026-09-30 定值（起始值：阶梯锥定；`$` 无 faucet ⇒ 待首次铸币后重估）」；消费点 `:235/:348/:350` 未动 ✓。读数：**边界 9/9**（`fee=9999`→400 / `10000`→200；`deposit=49999`→400 / `50000`→200；低于下限 details = `{min, reason:"BELOW_SERVER_FLOOR"}`）；未传金额 ⇒ 200 + `fee_source=server_default` + 扣款 = 新下限；幂等重投 ⇒ 200 replay；**`Σtotal` pre = post = 2,020,100（Δ=0）、frozen 不变、entries +12 纯转移零铸币**；回归 `/health` 200·**410 面 6/6**·**注册点 65（我亲核）**·`tsc --noEmit` 0 ✓。**旧值探针同步**：`p4z-b3b-02-e2e.ts`(19+9+2 处) 与 `p4z-qa-b3-03-http.ts`(4 处) 改为**跟随源码下限**（此后下限再变不误红 ✓ 好设计）；**历史片 `p4z-b3a-02-e2e.ts` 只登记不重写**（其 `:207` 与新语义正面冲突 ⇒ 改值也变不绿）⇒ **处置正确**（符合㉖「已应用后发现缺陷 ⇒ 同版本重放/只登记」）。
**★ A1 上限：未落 —— 且它「正确地不越界」**。现场：`POST /api/admin/points/adjust`（`src/index.ts:1175`）→ `database.ts:940 adjustPoints`；`amount` 经 `parseInteger` **无上下限**、权限闸在、**审计仅 `console.log`**。检查点位于 `src/index.ts`，**不在我给的写集**（只 `currency-service.ts`/`admin-service.ts`）⇒ 它按派单**只登记不实现** ✓✓（这一条我给它记功：宁可交半单也不越界）。**已写死备查的落法**：码用 **`LEDGER_AMOUNT_INVALID`**（`ledger-errors.ts:49`，400 input 类）+ 复用既有 reason **`OVER_MAX_SINGLE_AMOUNT`**（`currency-service.ts:125`），**不新造码** ✓。**⇒ 我授权 `A1-CAP` 补单（把 `src/index.ts` 纳入写集）**，并**同时核查「审计留痕」缺口**（`console.log` **不满足**我 §4.8 类②的「审计留痕」要求；若库内无审计表 ⇒ **登记为批 6 迁移项、不得就地造表**）。
**4b-i（`deleg_7ad0d484` task-1，Kong，60 calls / 1441.8s，★ TRUNCATED（撞迭代上限））**：**采信 + 我独立复核**。**我亲跑两条红线**：`npm run build` → **`BUILD_EXIT=0`**（`dist/assets/index-*.js` 419.95 kB / 1.57s）；`npx vitest run src/test/unit` → **`TEST_EXIT=0`**（**9 文件 63 例全过**，基线 61 ⇒ +2）✓；`git status` 改动面 = **恰好 `frontend/**` 14 件（含新 `frontend/src/idempotency.js` 3410 B）+ 报告 + artifact**，**后端 `src/**` 只有 NUM-1 的 `currency-service.ts`**（它自证「属他会话」**正确**）✓；抽查：`extractApiErrorMessage` 在 `auth.js`（2 处）、`AUTH_UNAUTHORIZED` **四语 locale 各 1**（`zh/en/hk/vn`）✓；**5808/5787 两个监听均为面板托管正常服务（非残留）** ✓。落码（逐条对齐 §2.4 `S1`–`S10` / §9.B）：`R107` 错误形状（`auth.js:108-155`：`error.message→code→details.reason` + 按 `i18n_key` 四语解析，**动态 import 以避开既有 `vi.mock('react-i18next')` 用例** ✓ 巧）、四语键、`ops:` 键四写口（`SystemSettings:96`、`PermissionsManagement:146/188`、`UsersManagement:113`）+ 新 `idempotency.js`（键形与 `canonicalAdminOpsKey` **逐字同形**）、`ShardPage` 补 `cli:` 键（`:161,181-192`，`retry_same_key`/`changed_content_new_key`/`reset_gives_new_key` 三读为真）、撤 body 改 query（`:346-349`）、只读化（`RewardPage`/`TasksManagement`/`RewardsManagement`/`SystemSettings`，**grep 实测业务零调用**）、旧断言留 legacy + 新 401 R107 / 410 sunset 两用例 ✓。
**★ 我裁定其登记的分歧（母单③ vs 权威清单）—— 它是对的**：母单点名 `ActiveTaskModal.jsx:50` 补键，但 §2.4 `S10`/§9.B `B10` **明文条件触发、现状不改**，且 §4.5 契约 3「**有自然标识 ⇒ 派生**」⇒ 该面**已有服务端确定性派生键**，**前端自造 `cli:<uuid>` 反而会把重试变成第二行**（正是母单③要防的）⇒ **采信其「按权威清单不改」**；**要求 Jing v1.0 在 §4.5 补一条**：「**服务端已确定性派生键的面，前端不得自造键**（否则重试落第二行）」。
**其余未做/未测（照登）**：**B8** `/api/user/points` 迁移目标端点**未注册**（grep 0）⇒ 前置未满足、两碎片读口**保留空态不迁**（迁移会 404，比现状更坏）✓ 处置正确；**`frontend/` 无 eslint 配置**（exit 2，**基线同码**）⇒ lint 读数不存在（**既有债务，非本单**）；`sunset` 值面属后端响应体、本单无写权 ⇒ 只登记（现取 `index.ts:911` 含「未决」）；`NOT_MEASURED` 5 项。
**事故（照登，均非本单改动所致）**：**Neon 间歇不可达（1.96→12.4s 抖动）触发既有 `@neondatabase/serverless` `ErrorEvent` 未捕获缺陷 ⇒ `seafood-api` 两次自行 `exit 1`**；**只经面板 `{sid}` 路由重启（零 `pkill`）** ⇒ 终态 `running`、**我复核 `/health` 200 + `/api/home` 200** ✓（抖动下 `/api/home` 曾 6/10 500）—— 属**既有驱动级债务（A 档）**，非本次回归。**首跑读数已作废**（改常量后漏重启服务、旧 1000 生效）⇒ **它自曝** ✓。**探针自曝**：首跑 `child.kill()` 打 `npx` wrapper ⇒ 真 node 被 init 收养，已**按精确 PID kill（未用 `pkill`）**+ 探针改 `detached`+进程组 ✓；`crypto.randomUUID` 在 node 18.19 不可用 ⇒ 键样例走 fallback（形态仍合规）✓。

**⇒ 已派 `A1-CAP`（开 `src/index.ts` 写权 + 审计缺口核查）；4c-i（主题 token + 横竖屏骨架）待 4b-i 入库后派。**

---

### 5.95 **★ Kevin 四问四答与四项落地（2026-09-30）：① 批末重置 —— 我撤回建议，暂不重置（前端阶段需要测试数据）② 7-7 保持「不回滚」（退款=单方补偿、不隐含退货 ⇒ 回滚会账面超卖）+ 退货闭环登记 ③ 7-23 数值由 Kevin 授权我定：建币费/上市费 **10,000 `$`**、保证金 **50,000 `$`**、A1 调分上限 **100,000 `$`/笔** ④ 「按计划推进」⇒ 解冻 `frontend/**`、4b 开工**（2026-09-30）

**① 重置：我撤回建议（Kevin 问「为什么要重置？」）—— 裁定：暂不重置。** 我之前提重置是沿 §5.71 的「批末清残差」惯例，但**没算到前端阶段的副作用**：重置会把 **213 条分录与全部夹具清空**，而 **4b/4c 前端接线与 UX 阶段正需要这些数据作为"有货可看"的开发/演示环境**（空库页面上什么都渲染不出来）；而**残差本身不影响正确性**（我六次自算守恒全成立、`23514` 未触发、负值 0）。**⇒ 重置推迟到「前端阶段收尾 / 上线演示前」**；**前置条件已由我自证**（`p3x-00-rebuild-replay.ts` dry-run **六闸全绿**、单事务、失败即 ROLLBACK）⇒ 随时可执行，一条命令。
**② 回滚（7-7）：Kevin 问「为什么要回滚？」⇒ 我给出理由并裁定「保持不回滚」。** 语义 = 退款时是否把 `listing.stock` 加回（买 2 件 `3→1`；退款后是否回到 `3`）。**裁定理由**：**退款是卖方单方善意补偿、不隐含「退货」** ⇒ 若顺手恢复库存，卖方可**退钱的同时把同一份货再卖一次**（**账面超卖**）；且本仓退款发起人 = **仅卖方**（我 §5.88② 裁定），更说明它是单方动作。**⇒ 保持现取「不回滚」**（单点 `listing-funds-service.ts:55`）；**「退货 → 入库 → 恢复库存」登记为后续业务闭环**（批 6/7 定），届时是**另一个事件**而非本事件的可选分支。
**③ 数值（7-23）：Kevin 明确授权我定 ⇒ 落地如下**（依据 = 以「1% 佣金下 10 万酬金 ⇒ 1000 手续费」为锚的阶梯；且 **`$` 目前无 faucet** ⇒ 现为「有量级感的起始值」，关键是**从占位改成定值 + 留在配置可改**）：**建币费 `currency_create_fee` = 10,000 `$`**（≈10 笔大额单笔手续费量级）；**上市费 `listing_fee` = 10,000 `$`**（同档）；**上市保证金 `listing_deposit` = 50,000 `$`**（担保物 ⇒ 高一档，抑制随手挂币）；**A1 后台调分单笔上限 = 100,000 `$`/笔**（授权主体意图额 ⇒ 必须有上限 + 审计留痕；**日累计上限留后续**）⇒ **派 NUM-1 落地**（改三处下限常量 + 落 A1 上限，标「Kevin 2026-09-30 定值」）。
**④ 「按计划推进」⇒ 解冻 `frontend/**`（我此前设的冻结边界，现正式撤销并登记）+ 4b 开工。** 4b 切片：**4b-i = 前端兼容性同步**（§9 B 栏 `S1`–`S10` + `S-b3e-1/2/3`：`R107` 错误形状、`ops:`/`cli:` 幂等键、已弃用面（碎片页）、成功面键集、四语 locale、两条行为 delta 复核）⇒ **本轮派**；**4b-ii = 把页面接到新接口**（`/api/job*`、`/api/listing*`、`/api/currency*` 的 UI 接线）；**4c = web 横屏 + 手机竖屏 UX**（需先定主题 token —— 复用 `docs/design/style-preview.html` 的**变体 A 日档 / 变体 B 夜档**，与 P7 同源）。

---

### 5.94 **Jing v0.9 验收通过（1554 行 / `8558aa84…`，只追加 + 20 行就地更新）+ ★ 我复核并确认它标的「两处口径差」均不构成错 + ★ 重置键在 19 迁移后的再验证（dry-run 六闸全绿）+ 台账收尾**（2026-09-30）

**交付（Jing · `deleg_224fda49`，23 calls / 245.3s）**：`docs/route-layer.spec.md` **v0.9 / 1554 行 / 364777 B / md5 `8558aa84eb0812fa4f4fb6be34270959`**（v0.8 = 1392 行 ⇒ +162 行）；快照 **同指纹 + `cmp` exit 0** ✓；**v0.1–v0.8 八快照未动**（v0.8 快照 md5 仍 `f3420d1f…`）✓；delta 件 115 行（D0–D11）✓；**非追加改动 = 20 行**（逐行列于 delta §D2，全为状态列/已注册事实，旧写法同地留痕）✓；`git status` 只多这三件 ✓。
**折入**：① **§1.8 十一条 →「已注册（批 4a）」**+ 逐条 `src/index.ts` 行号 + **注册点 53→65**；**清单结论 = 已清空/无遗留**；**§9.A 栏 →「已关闭」** ✓；② **A5 新路径 = `jobEventView` 15 键**（旧路径 11/9 冻结键集**不变、不得串**）⇒ §2/§4.2/§7-42 ✓；③ **A6 = `requireAdmin(review_tasks)`、A11 = `manage_settings`** 点名（**复用既有权限键、不新造**）✓；④ **§4.8 二分 → 三分**（新增 ②「授权主体意图额」：权限闸 + 上限校验（`TODO: Kevin 定值`）+ 审计留痕 + 判负三条；A1 两格就地改并留痕）✓；⑤ **§4.5 点名 C1 派生输入 = `symbol`**（+C2 = `cid`；**唯一 fail-loud 面 = 3b 的 `job`**）⇒ 「`/api/currency` 不 fail-loud」**非缺陷**（正式化）✓；⑥ **新 §1.11 登记 4a/QA-B4 十项事实** ✓；⑦ §7：**7-29/7-40 就地更新** + 新增 **7-41**（HTTP 级 `-2` 抽查 = 后续低优先 QA 项）/ **7-42**（键数口径）+ 补注块 ⑪–⑬；**7-1…7-28、7-30…7-39 一字未动** ✓。
**★ 我复核它标的两处「待 Zang 复核」口径差 —— 两条均不构成错**：① **A5 的键数**：QA-B4 §4 记「16 键」而 4a 逐键枚举 = **15 键** ⇒ **以逐键枚举为准（15）**（体例 = 我 §5.92）；② **作用域差**：`jobEventView` **本体 14 键** + `submissions_reviewed` = **A5 响应面 15 键**；**A6 面 14 键、A1 面 17 键** ⇒ **每个路径各有自己的面**（与我「键集按路径冻结」的裁定一致）⇒ 规格已按此写明，**无需再改** ✓。另：`+323/−2` 因 4a 已提交、工作树干净**无法现取复算** ⇒ 它转引 QA-B4 §2.1 并**双锚点标注** = 正确处置 ✓。
**★ 重置键再验证（我亲跑，改动后体检）**：`P3_ART_ROOT` 指向 scratch 跑 `scripts/p3x-00-rebuild-replay.ts`（**无 `--apply`**）⇒ **`ok: true` / `exit_code: 0`**；六闸读数：**`version_order_ok: true`**（`SUMMARY.json`）、**`tx_final: ROLLBACK`**（`C-replay-log.json` + `E-gate.json`）、**`identical: true`**（净零对拍）、**`injected: false`**、**`checksums_all_byte_equal: true`**、**`comparison_inside_tx: true`** ⇒ **J1 的六道闸在 19 个迁移 + 全部改动之后仍全绿；重置键可用** ✓✓（**这是「批末重置」行动的前置条件，现已自证**）。
**台账收尾**：仓库只剩 **1 个残留未跟踪件**（`backend-ts/.p4-artifacts/QA_B4_RUN_TAG.txt`，Neng 的 run 标记）⇒ **本单入库**（不再留孤儿件）。

**⇒ 后端线至此无阻塞项**：资金线（3a–3d）+ 注册线（4a）均**已过独立质检**；规格链 route-layer v0.1→**v0.9** 与代码逐条对齐。**剩余工作只剩三类**：**(i) 待 Kevin 的三项决定**（批末重置 / 7-7 / 7-23 数值 + A1 上限）；**(ii) 前端批次 4b/4c**（需其点头解冻 `frontend/**`）；**(iii) 批 6**（权限种子迁移 + `isAdminAddress` 收敛 + `app_config` 合法键登记 + 上述数值/上限落地）。

---

### 5.93 **QA-B4（注册切片独立质检）验收：7 腿全 PASS；★ 三开口全收口（2 行 = import 重导入、零影响；腿归因真差额 = 0 且与我的读数完全对齐；`fee>0` 形态实测通过）；裁定其两条「诚实登记」项**（2026-09-30）

**交付（Neng · `deleg_746113a4`，47 calls / 378.3s）**：报告 `docs/qa/p4-b4a-route-registration-qa.md`（**326 行**）+ 产物 4 件 + 4 探针；边界自证：仅报告/产物/探针，**未碰 `src/**`/`migrations`/`frontend`/spec**、无 git 写、无删除 SQL、**未重启 `seafood-api`**（PID 9139 全程存活、`/health` 现取 200）、产物 token 泄漏 **0** ✓。
**★ 三开口收口（我采信，且第 2 条与我的读数完全对齐）**：① **被替换的 2 行 = import 语句**（`./job-service` 的 4 符号行 + `./job-funds-service` 的 `verifyJobSubmission` 行），**5 个符号同名同模块原样重导入（超集）** ⇒ `grep -cE '^-app\.'` = **0**、`comm -23`（旧 53 ∖ 新 65）= **0** ⇒ **既有路径注册/行为零影响** ✓（**我的口径质疑得到干净答案**）。② **腿归因重做：真差额 = 0** —— 时间轴 `18:50:25 → 189`（我的基线）→ `18:56:29–45` **+8 = QA-B3 的 4 个夹具事件** → `19:14:00.022` **+2 = A1 首笔** → `19:15:13–37` **+14** → **213**；4a 实写 **16 腿**并逐笔归到 `job/16`·`job/17`·`job/18`·`listing_order/6`；**单元那个「差 2」的真因 = 它的 pre 快照取在 A1 落账之后**（其基线读成 199、应为 197；唯一能分开 197/199 的事件正是 A1 的 `job_escrow`×2）；其「3×refund 6」亦不自洽（**实测 2×refund 4**）⇒ **我的 `189→213 (+24) = 夹具 8 + 4a 16` 完全对齐** ✓✓。③ **`fee>0` 非退化形态 PASS**：`reward=100000` ⇒ **`fee=1000`**；分录 = **`job_payout`×2**（971 `frozen −99000`、`12` `+99000`）+ **`job_fee`×2**（970001 `frozen −1000`、**`-1` `+1000`**）；`commission` = **0 腿**（无链）；A5 `200` 且后置断言无报错；`Σtotal` 不变 ✓。
**其余腿（采信）**：注册面 **65**（HEAD 53 + 12）✓；抽样 5 条既有路径状态未变 ✓；**410 面 6/6** ✓；`Σtotal` = **2,020,100**（pre/post 恒）、负值 **0**、`23514` 未触发 ✓；**migrations 19/19 checksum 匹配（`mismatches=[]`）** ✓；`src/ledger.ts`/`ledger-errors.ts`/`commission.ts`/`frontend/**`/`.env.local` 自 HEAD **SAME** ✓。
**★ 我裁定它两条「诚实登记」项**：① **4a 的 `/api/currency` 不 fail-loud**（它的负例探针预期 `400 LD004`、**实测 200 并自派生键**，因而**变成一次真实写**（+2 条 `currency_create_fee` 分录））⇒ **这不是回归**（4a 未改 `currency-service.ts`），且**与我的 §4.5 契约一致**：**C1 的自然标识 = `symbol`**（不同 symbol ⇒ 不同键）⇒ 属「有自然标识 ⇒ 可派生」那一侧 ⇒ **接受**；**但要求 Jing 在 §4.5 点名 C1 的派生输入**（正式化）。② **`-2` 形态 `NOT_MEASURED`**（造链需 `/api/referral/bind`，不在其写库允许面）⇒ **不算缺口**：**3b 已在服务层实测过两形态**（无邀请人 ⇒ `-1`；真链 depth 2 ⇒ `-2` 进 +10/出 −10）⇒ 仅「HTTP 级 `-2` 形态抽查」留作后续 QA 低优先项。③ 首轮 `503/503/500` = **Neon 连接抖动**，复测 `200/200/200`（`/api/user/stats` 3/3 稳定 `403` = 权限语义）✓。

**⇒ 4a 与 QA-B4 全部收口；下一步 = Jing v0.9（§1.8/§9-A 行状态更新、A5 键集、A6/A11 权限点名、§4.8 三分、§4.5 点 C1 派生输入、注册点 65）+ 解冻前端（待 Kevin）**。

---

### 5.92 **4a（已实现未注册路径接线）验收通过 —— 注册点 53 → 65（我亲核）、**F-1 集成缺口关闭**（同一 job 走通 A1→A2→A3→A4→A5）、我第六次自算守恒不变；★ 三处口径要更正（+323/−2、基线漏算 QA 夹具、A5 键集）；裁定 A5/A6/A11 三项 + 派 QA-B4 收口**（2026-09-30）

**交付（Kong · `deleg_24e731a6`，47 calls / 594.6s）**：`backend-ts/src/index.ts` **仅路由层**（import 块 + 末段路由块；**服务层零改动**）⇒ **注册点 53 → 65（+12）**，并逐条给出路径→行号（`/api/job` 1289、`/:jobId/apply` 1305、`/accept` 1327、`/submit` 1352、`/review` 1380、`/cancel` 1404、`POST /api/listing` 1422、`POST /api/listing/:id` 1448、`PATCH /api/listing/:id` 1475、`/buy` 1499、`/api/listing-orders/:orderId/refund` 1520、`/api/admin/commission_policy` 1540）✓；报告 `docs/audit/p4-b4a-route-registration.md`（**198 行 / 9 节 / sha256 `72f93737…`**；§8 含交 Jing 的 11 条 §1.8 待补行）+ 探针 + 产物；`tsc` 0；面板重启 → `/health` 200。
**★ 我亲验（不采信报告）**：① **注册点 = 65**（我 `grep` 与它逐位相符）✓；② **第六次自算守恒**：`Σtotal` **2,020,100 不变**（纯转移）、负值行 0、`ledger_entry` **213 = 逐 kind 之和** ✓；③ **冻结面 0**（`database.ts`、四个 service、`migrations`、`frontend`、`.env.local` 全未动）✓；④ 越界面 = 恰好 `index.ts` 被改 + 3 新件 ✓。
**采信其读数**：**34 条 HTTP**（逐条成功 + 负例）—— A1 `200`+`job_escrow`×2 / 缺键 `400 LED004`；A2 `200`·重放 `200`·`404`·`409 LD003`；A3 `200`·非雇主 `403`·重复 `409`；**A4 别名与既有 `/api/task-progress/:identifier/submit` 键集逐键一致（9 键）**；A5 approve `200`（job→`settled`）+ 重放 `200`、reject `200`、非 admin `403`；A6 `200`+`job_escrow_refund`×2、`escrow_txid IS NULL` ⇒ `409`；A7/A8/A8-b/A9/A10 全绿（`purchase`×1+`sale`×1、`purchase_refund`×2、`delisted` 终态 `409`、非卖家 `403`）；A11 `200`、越界 `400 FEE_RATE_OUT_OF_RANGE`、非 admin `403` ✓；**★ F-1 集成缺口关闭**（同一 job 走通 A1→A2→A3→A4→A5 —— 我 §5.85 接受的那个缺口现在真正闭合）✓；资金不变量 `Σtotal` pre = post ✓；夹具键全 `cli:b4a:*`（**遵守我 §5.90③ 的前缀纪律**）✓；零删除 SQL ✓；回归 5 GET 200 + **410 面 6/6 仍 410** + `prize/999…` 404 ✓。
**★ 我三处口径更正（不改结论、改措辞）**：① 它报「现有 53 行一行未改未删」**不精确** —— `git diff --numstat` = **+323 / −2**（确有 **2 行被替换**；因注册数 65 = 53 + 12**未丢路由** ⇒ 那 2 行应为 import/块边界，**但需点名**）⇒ 登记为「**2 行被替换、身份待点名**」。② 它的 `NOT_MEASURED`「`ledger_entry` +14 与可见 16 腿差额 2 未归因」 **其基线漏算了 Neng 质检时写入的 4 个夹具事件** ⇒ 该差额**不可比**；**我的可比读数为 189 → 213** ⇒ 归因必须以「Neng 质检后的状态」为基线重做。③ A5 的验收判据（approve 11 键 / reject 9 键）**是既有 `/api/tasklist/:jID/verify` 的冻结键集**，新路径入参是 `job_id` ⇒ 要产出需**服务层加读口**（本片禁改服务层）⇒ 本片成功面 = `jobEventView` **15 键**。
**★ 我裁定其三项开口**：① **A5 键集**：**接受新路径的成功面 = `jobEventView` 15 键**（**不动服务层**；**旧路径 `11/9` 冻结键集仍归旧路径**，两者不串）；由 **Jing** 把新路径键集（15）写进 §2 并注明「旧路径键集不变」（若前端将来需要同形 ⇒ 属 4b 前端事项）。② **A6 `cancel` 取 `requireAdmin(review_tasks)`**（与 J6 唯一既有触发面同权限）与 **A11 取 `manage_settings`** ⇒ **均接受**（**原则：复用既有权限键、不新造**）；**由 Jing 在 §4.2/§6 点名**。③ **预算 ~54（超 45）** ⇒ 采信自曝（探针三修所致，覆盖面未削减）✓。
**⇒ 已派 QA-B4（独立质检，收口三开口：2 行身份 / 归因以 QA 后状态为基线 / `fee>0` 非退化结算形态未测）+ Jing v0.9（§1.8 行状态更新、A5 键集、A6/A11 权限点名、§4.8 三分）**。

---

### 5.91 **Jing v0.8 验收通过 —— `LD001–LD033` 真值表写全 + 8 处期望码格订正（旧写法留痕）+ 金额来源二分立法 + `sunset` 不发明日期 + ★ 新增 §9「批 4 施工清单」；我裁定 A1 金额归类（**二分升为三分**）；★ 我的 17 行读数被现盘证实、它 v0.7 自报 16 差 1**（2026-09-30）

**交付（Jing · `deleg_062f4a93`，22 calls / 331.3s）**：`docs/route-layer.spec.md` **v0.8 / 1392 行 / 328365 B / md5 `f3420d1fbafdb0a99005b8c593fb95a1`**（v0.7 = 1102 行 ⇒ +290 行）；快照 v0.8 **同 md5 + `cmp` OK** ✓；`docs/audit/route-layer-v0.8-delta.md` **105 行 / `30a9a9fc…`**；**v0.1–v0.7 七个快照未动**（v0.7 快照 md5 仍 `13823f03…` 反证）✓；**`diff v0.7 vs v0.8 | grep -c '^<'` = 11 行**（10 处就地订正 + 头部版本标记），**其余全为追加、无一行被移动/删除** ✓。
**折入的关键**：① **§4.7.4 `LD001`–`LD033` 全键普查**（真值表写全，真源 `ledger.ts:1030–1062` + `ledger-errors.ts:28-70`，逐键给 HTTP 状态）；**9 键**（`LD004/012/013/015/025/026/027/028/029`）`grep -c` = 0 **逐键表态**（与 Neng §6.1 逐键吻合）；**残余明写**：**503 家族（`LD025/026/027`）在本册无状态码条文（§3.2 缺 `503` 行）⇒ 只登记不发明** ✓（**这个「缺什么就说缺什么」的处置对**）。② **8 处期望码格就地订正**（旧写法留痕）：`400 LD022`×4 + P2`:552` 的 `400 LD020` ⇒ **`LD021`**；C1`:558`/C2`:559` 的 `LD018` ⇒ **`LD017`**；**去引文口径复算 = `LD021` 5 / `LD022` 4（全在 404 列）/ `LD020` 0 / `LD023` 0** ✓。③ **★ §4.8 金额来源二分立法**：规则 3 条 + 三问归类判据 + **逐事件表**（J1/J5/J6/P1/P2/P4/M1/M2/M3/C1/C2/R3/A1，逐行给「客户端可传 / 服务端取数 + `文件:行号`」）+ 判负 5 条；**`reward` = 供给侧自主出价（我的 §5.90② 裁定）** ✓。④ **§5.5 `sunset`**：三形态，**(i)「批 4 删路径」= 已定；具体日期 = `待 Kevin`（未写任何日期）** ✓。⑤ **★ §9「批 4 施工清单」（A–E 五栏：项目/真源锚点/行动/前置依赖/验收判据）** —— A 栏 §1.8 十条+附注逐条注册行动（**A3 `/accept` 最高优先**）；B 栏 `S1`–`S10` + `S-b3e-1/2/3`；C 栏两条行为 delta 回归核；D 栏 **DL68 残余加固（必带 4 条判负）**；E 栏旧直写三函数收口（`database.ts:3268/3360/3422`，**外部调用方 = 0**）等 8 项 ✓✓。⑥ §7：`7-31` 状态列 ⇒ 已定（唯一被改的状态列）+ 追加 **7-34…7-40** + 补注块 ⑦–⑩；**7-1…7-33 未重排、未改** ✓。⑦ 路径正典（我 §5.89②）：§4.2 P4 路径格 ⇒ `POST /api/listing-orders/:orderId/refund`，§1.2 命名张力**关闭** ✓。
**★ 我裁定它「唯一无法由裁定推出」的那项（A1 的 `amount` 归类）⇒ 二分升为三分**：**① 供给侧自主出价**（`reward`/挂单价 —— 客户端可传、无需平台校验上限）；**② 授权主体意图额**（如 A1 后台调分 —— **客户端可传，但必须**：**权限校验 + 服务端上限校验**（上限值标 `TODO: Kevin 定值`）+ **审计留痕**）；**③ 平台侧费/保证金/费率**（**只能服务端取数**）。⇒ 交 **Jing v0.9** 把第 ② 类写进 §4.8（含 A1 的归类与三项必带）。
**★ 我的口径差登记（本轮由现盘证实我对）**：`grep -c 'LD023'` **现盘 = 17 行**，与我 §5.89 记的 **17 一致** ⇒ **是它 v0.7 自报的 16 差 1**（我上轮把它记成「我的口径差」**过头了**，更正为「它 v0.7 自报差 1」）；决定性判据仍是「**期望码面内 `LD023` = 0**」。

**⇒ 下一步（分批 4）**：**4a = 注册 §1.8 那 10 条已实现未注册路径**（**纯后端、不碰前端**，无需解冻前端边界；依据 = 我 §5.80 的「允许注册新对外路径」裁定 + §9 的 A 栏）⇒ **立即可派**；**4b = 前端同步（`R107`/`ops:`/locale/`ShardPage` 键）**、**4c = web 横屏 + 手机竖屏 UX** ⇒ **需 Kevin 对「解冻 `frontend/**`」表态**（我已上呈；他说「按计划推进」即开）。

---

### 5.90 **QA-B3（批 3 资金线独立质检）验收：8 腿全 PASS、无 P0/P1；★ 它替我把「410 面」补测成 6/6；★ 我亲核两条命门（`src/**` 直写账本 = 0、`LDxxx` 真值）；裁定其 6 条发现（其中 D3 我推翻其定性、D4 是我自己的 brief 错）**（2026-09-30）

**交付（Neng · `deleg_c184d1c7`，38 calls / 376.2s）**：报告 `docs/qa/p4-b3-funds-qa.md`（**393 行 / sha256 `217795f086fd30f94ea2b2fb…`**）+ 产物 `qa-b3-20260929T185356Z/`（6 件）+ 4 探针；**`git status` = 7 条 untracked、零 `modified`** ⇒ **「未改任何代码/规格」声明为真** ✓。
**★ 我亲核（不采信报告）**：① **单写路径命门** —— 我自己 `grep -rn "INSERT INTO public.ledger_entry|UPDATE public.account|UPDATE public.ledger_owner" backend-ts/src/` = **0 命中** ✓✓（与它一致）；② **`LDxxx` 真值我现取** —— `ledger.ts:1046/1047/1049/1050` = `LD017 LEDGER_AMOUNT_NOT_POSITIVE` / `LD018 LEDGER_DECIMALS_OVERFLOW` / `LD020 LEDGER_ACCOUNT_NOT_FOUND` / `LD021 LEDGER_RESERVED_UID` ⇒ **它的 D1/D2 两条 spec 码表错全部成立** ✓；③ 基线核对（它记 HEAD `6553599…`、spec md5 `13823f…` 与派单逐位相同、`git diff HEAD --stat` 空、无活写者）✓。
**8 腿结论（采信）**：**0 基线 PASS**｜**1 资金守恒 PASS** —— **逐行自算 `Σtotal 2,020,100` == 账本独立推导 `Σ(mint)−Σ(burn)` 2,020,100**（cid1 = 2,000,000）、189 行 == 逐 kind 和、**每类 kind 均整除预期倍数**（hold×2/trade×4/trade_fee×2…）、负值 0/漂移 0、**它写入 4 个夹具事件后 `Σtotal` 不变** ✓✓（**这是我要求的「从账本独立反推」口径，它做到了**）｜**2 单写路径 PASS**（0 命中 + 4 处相近命中逐条定性为非账本写）｜**3 冻结面 PASS**（migrations **19/19** sha256 == 注册表 checksum 逐字节）｜**4 服务端取数 PASS(+1 登记)**（price/对手方/fee 全服务端 `market-service.ts:498-545`）｜**5 幂等契约 PASS**（同键同内容 200 replay Δ0 / 同键异内容 409 / 异键新行）｜**6 `LD` 全键普查 PASS**（33/33；spec **从未提及 9 键**；§4.7.1 只覆盖 **5/33**）｜**7 ★ `410` 面 PASS** —— **6/6 = `410` + `LEDGER_REF_NOT_FOUND` + `details.sunset`、Δentries 0、无需 token** ⇒ **我此前被安全层拦下而「待补测」的 410 面，由独立方补齐** ✓✓｜**8 负例 PASS**（409 余额不足/403 非本人/404 未知 id/404 未知单/403 非 owner/400 缺键 全命中；孤儿行 0；自成交 `NOT_MEASURED`（M3 无路由））。
**★ 我裁定它的 6 条发现**：
① **D1（spec §4.2 P2`:552` 的 `400 … LD020`）与 D2（C1`:558`/C2`:559` 把 `LD018` 标成 `LEDGER_AMOUNT_NOT_POSITIVE`，真键应为 `LD017`）+ §7-31（`400 LD022` 4 处）** ⇒ **三条同类，合并交 Jing v0.8 一次性订正**：**做 `LD001`–`LD033` 全键普查**（不是只扫 `LD02x`）、**把 33 键真值表写全**（补 D6 缺的 28 键）、并对 spec **从未提及的 9 键**逐键表态（「路由层未使用」也要写明）。
② **D3（J1 的 `reward` 实为客户端传入，与其注释「无金额入参」不符）** ⇒ **我推翻它的定性：这不是缺陷** —— **招工酬金（`reward`）本就该由雇主在发布时自主出价**（客户端供给侧）；**只有平台侧金额（`fee`/`deposit`/`fee_rate_bp`）必须服务端取数**。**但两件要做**：(a) 那条**自述不符的注释**须更正（Kong，低优先）；(b) **spec 必须显式区分「客户端可传金额」（酬金/挂单价等供给侧）与「服务端取数金额」（费/保证金/费率）** ⇒ 交 Jing v0.8。
③ **D4（我 QA brief 给的夹具前缀 `qa-b3:` 违反 §4.5 前缀强制 ⇒ 实测 `400 PREFIX_REQUIRED`）** ⇒ **这是我自己的 brief 错**（正解 = `cli:qa-b3-*`），已登记；**纪律**：此后凡派质检/探针单，夹具前缀**必须**用 §4.5 的 `cli:`/`biz:`/`ops:` 三前缀之一。
④ **D5（`sunset` 无日期）** ⇒ 要求：13 个弃用面**要么给 sunset 日期、要么显式写「随批 4 移除」** ⇒ 交 Jing v0.8。
⑤ **D6（spec 的 LD 真值表缺 28 键）** ⇒ 并入 ①。
**⇒ 质检结论：批 3 资金线**（守恒/单写路径/冻结面/服务端取数/幂等/410/负例）**独立质检全 PASS、无 P0/P1**；下一步 = **Jing v0.8（LD 全键订正 + 真值表写全 + 金额来源区分 + sunset 日期）** + 批 4 议程（前端接线 + §1.8 十条未注册路径）。

---

### 5.89 **★ 批 3 收官：3d（交易所）与 Jing v0.7 双双验收通过 —— 我第五次自算守恒（`Σtotal` = 2,000,000 + 夹具 20,100，与自报逐位吻合）+ 逐 kind 枚举等式逐项一致 + 我亲读 DL68 锁与事件同语句；裁定 3d 七问 + Jing 两开口（含元级订正 `LD022`→`LD021` 与路径名正典）**（2026-09-30）

**A. 3d（Kong · `deleg_177fc8a6` task-0，45 calls / 710.8s）—— 验收通过**
**交付**：**新建** `src/market-service.ts`（589 行；M1 `placeMarketOrder:239` / M2 `cancelMarketOrder:366`·`cancelAllMarketOrders:389` / M3 `matchMarketOrders:448`）；`src/database.ts` **+5 method**（`marketPostEvent:1804` = **唯一写路径**、`resolveMarketOrder`、`resolveMarketCounterparty`、`listOpenMarketOrderIds`、`currentFeeRateBp`）；`src/index.ts` **3 条既有路由改接**（`:741` POST `/api/order`、`:772` DELETE 全撤走 query、`:795` DELETE `/:oID`）⇒ **注册点 53 → 53**；报告 `docs/audit/p4-b3e-market-funds.md` + 产物（含**全账户逐行 dump**）+ 3 探针；`tsc` 0。
**★★ 我亲验（不采信报告）**：① **第五次独立守恒复算** —— `Σbalance 2009627 + Σfrozen 10473 = **Σtotal 2,020,100**`（= 2,000,000 + **20,100** 夹具铸币，**与它自报逐位吻合**）、负值行 0、`ledger_entry` **86 → 189** ✓；② **逐 kind 枚举等式逐项一致** —— `hold` 4→**46**（+42 = 21×2）、`hold_release` **6**（+6 = 3×2）、`trade` **32**（8×4）、`trade_fee` **16**（8×2）、`transfer` 8→12（+4）、`mint` 2→**5**（+3 夹具），**其余 9 个 kind 一个未变**，总和 = 189 ✓；③ **DL68 我亲读实现**：`database.ts:1809-1813` = `WITH l AS (SELECT pg_advisory_xact_lock(${baseCid}::int4, ${quoteCid}::int4) AS k) SELECT public.market_post_event(...) FROM l` ⇒ **锁与事件在同一条语句内取得**（单往返、语句级串行化）✓；④ 越界面 = 恰好 `database.ts`/`index.ts` 被改 + 5 新件，**冻结面 0**、**注册点 53 → 53** ✓。
**采信其读数**：**DL68 实测** —— 外部会话持 `(4,1)` 锁 1.5s 期间同币对成交调用**被阻塞 +961ms**（2001 vs 1040）；**同币对两笔并发 = 恰 1 成功、`amount_filled 1 ≤ 1`、无超额成交** ✓；**成交 6 腿** = `trade`×4 + `trade_fee`×2（taker 付 30 → `-1`）；**客户端传价/对手方/fee 全丢弃并登记** ✓；**撤单**释放 1000=(5−4)×1000 且 **`trade_fee_delta = 0`（手续费不可退，DL87）** ✓；三次幂等重投**合计新增分录 0** ✓；负例齐（缺键 400/LD005、同键异内容 409、**自成交 400 `SELF_TRANSFER`**、持仓/超余量 409、越权 403、未知/非数字 id 404）✓；`eyJ` 0；面板重启 → `/health` 200 ✓。
**★ 我裁定七项（分三类）**：
- **采纳并正式化（A 类）**：② **费率真源 = `commission_policy.fee_rate_bp`** + 要求 spec 写死**成交额口径与取整**（`fee = round(成交额 × bp / 10000)`）✓；④ **对手方选择 = 服务端**（客户端传值丢弃，已实测）✓；⑤ **币对锁作用域覆盖三个 op**（严格更安全；多出的争用开销**接受**）✓；⑥ **M2 越权 ⇒ `403`**（对齐 2a/2b/3c 的 `ACTOR_NOT_ALLOWED`）✓；⑦ **缺 `fill_no` 的 reason**：**服务层形状闸先行（`FILL_NO_REQUIRED`）、DB 次之（`NOT_DECIMAL_INTEGER`）** ⇒ 接受**该顺序**并要求 spec 登记 ✓；③ **`fill_no` 必填** ⇒ 接受（显式优于隐式）✓。
- **接受现状但登记加固（B 类）**：① **DL68 残余 —— 对手方选择在锁外 ⇒ 「撮合决策新鲜度」**：**接受现实现**（可观测不变量「无超额成交」已成立），**但**登记为 **P5/批 4 加固项**，**必带判负**（「选择后到取锁前书变了 ⇒ 仍不得超额成交」的并发用例）。
- **登记并交后续单（C 类）**：前端同步项 **S-b3e-1 `ShardPage.jsx:176` 无 `create_key` ⇒ 实测 400** —— 该页属**碎片（déprecated）面**（碎片读口已空态、写口已 `410`）⇒ **接受**，批 4 随碎片面一起收口；**S-b3e-2**（全撤改 query 口径）、**S-b3e-3**（成功面键集变更）；旧直写 `placeOrder/cancelOrder/cancelAllOrders` **现无调用方** ⇒ 批 4 收口。
**它照登/自曝（采信）**：`NOT_MEASURED`：T03/T10 的 `details.reason`（neon HTTP 驱动不携带 `detail`）、`fee=0 ⇒ 4 条`分支未触发、异币对并行性未逐调用计时、**P2 的 `blocked_assert` 判据鉴别力弱**（驱动固有开销 ~1.0–2.9s）、夹具 `mint '100'` 为十进制串 ⇒ 实落 10000/10000/100；**探针自曝**：A1 键前缀写错未触发 ⇒ **作废该读数**、**意外落了一张真实买单**（已计入等式、不破不变量）✓ —— **自己抓出来并计账**，正确。

**B. Jing v0.7（`deleg_177fc8a6` task-1，27 calls / 252.1s）—— 验收通过；★ 它抓出「反向同类缺陷」**
`docs/route-layer.spec.md` **v0.7 / 1102 行 / 264291 B / md5 `13823f0389c1386b03b83dd7af032838`**；快照 `cmp` **相同** ✓；**反证成立**：v0.6 快照 md5 **仍 = `5424645a…` = 改前本体 md5** ⇒ 旧快照/旁册/代码/前端**零改动** ✓；delta 件 145 行。
**折入**：① **类级订正 `LD023` → `LD022`（4 处期望码格）**，新增 **§4.7.1** 给「`spec LDxxx` ↔ `ledger.ts` 真值表（含 LD020–LD024 全列）+ 逐处改/不改 + 理由」（真源我核过 `ledger.ts:1051/1052`）✓；② **★ 反向同类缺陷（它发现、未擅改）：`400 LD022` 4 处**（J1/M1/A1 + §4.4-6）—— `LD022` 是 **404 类** ⇒ 与 `400` 自相矛盾，四处语义均为「平台/保留 uid 前置闸」、raise 真源 `0013:503`/`0015:538`/`0016:481`（`LEDGER_RESERVED_UID`）⇒ **候选 `LD021`**，登记 **§7-31** 并给了可复制的改法 ✓✓（**这正是「不信报告、查类级」的价值**）；③ 退款发起人 = 仅卖方写入 §4.2 P4 + 新增 §4.7.2、「管理员可发起」⇒ **§7-32**；④ **§1.8 补 #9/#10** ⇒ **10 条 + 1 附注**，复算真扫描（导出 27→29、注册点 53、未注册调用点 0×10）；⑤ 3c 事实 → 新节 **§4.7.3（B1–B10）**；⑥ 7-7/7-23 **状态不变（仍待 Kevin）**；⑦ **§8.9.6 纪律自检**（把「产出待补行、交规格方落」立法）✓。
**★ 我裁定它的两项开口**：① **`400 LD022` → `LD021`（4 处）：批准订正** —— 依据：`LD022` 为 404 类、而四处 raise 源是 `LEDGER_RESERVED_UID`（`LD021`，与我 §5.82 记录的 `LD021/LEDGER_RESERVED_UID` 一致）⇒ 交 Jing v0.8；**并采纳它的建议把类级扫描从 `LD02x` 段扩为 `LD001`–`LD033` 全键普查**（它自曝这是本单最大未覆盖面）。② **§1.8 `#10` 路径名正典：「`/api/listing-orders/:orderId/refund`」**（RESTful、避免深层嵌套）⇒ Jing v0.8 把 §4.2 P4 的路径格同步为该形（并在 delta 记明变更）。
**★ 我的口径差登记**：我全文 `grep -c 'LD023'` = **17 行**，它报 **16** ⇒ **1 行口径差**（它已自曝「订正类工作必须引用旧串 ⇒ 全文非 0」并钉死判据为「期望码面内 `LD023` = 0」）⇒ **以「期望码面」为决定性判据、全文计数仅作参考**（跨版本比较须同口径）。
**⇒ 批 3（3a/3b/3c/3d）全部收官**；下一步 = **Neng 独立质检（批 3 资金线）** + **Jing v0.8**（A 类正式化 + `LD021` 订正 + 全键普查 + 路径正典）。

---

### 5.88 **批 3c（商品资金）验收通过 —— 我第四次自算守恒逐位相同 + 逐 kind 逐项一致 + 亲读单点常量/服务端取数；★ 我裁定 4 项（7-7 保持不回滚 / 退款发起人=仅卖方 / 我的 brief 自相矛盾 / `LD023`→`LD022` 类级订正）**（2026-09-30）

**交付（Kong · `deleg_bf83bd18`，50 calls / 468.4s）**：**新增** `src/listing-funds-service.ts`（317 行；`buyListing:191` / `refundListingOrder:261` / **单点常量** `REFUND_ROLLS_BACK_STOCK:55`、`REFUND_ACTOR_IS_SELLER_ONLY:62`）；`src/database.ts` **+68/−0**（`listingPostEvent:1773` = 单语句 `SELECT public.listing_post_event($1::jsonb)`；`resolveListingOrder:1788` 只读）；报告 `docs/audit/p4-b3d-listing-funds.md`（309 行）+ 4 探针 + 产物（tag `b3d-20260930T023156`）。
**★ 我亲验（不采信报告）**：① **第四次独立守恒复算** —— `Σbalance 1995998 + Σfrozen 4002 = **Σtotal 2,000,000**`（**与前三次逐位相同**）、负值行 0、`ledger_entry` **76 → 86** ✓；② **逐 kind 与它自报逐项一致** —— `purchase 2 / sale 2 / purchase_refund 2 / transfer 8`（= 4 既有 + 4 夹具供资，**它把夹具供资单列、未混入业务事件** ✓）+ 既有 9 个 kind 一个未变（和 = 86 ✓）；③ **单点常量我亲读**（`:55` `= false`、`:62` `= true`，两者都带依据注释 + 「待 Zang/Kevin 一句话可改」）✓；④ **服务端取数我亲核**（`:19-20` 注明 `amount = listing.price × quantity` 与 `seller_uid = listing.seller_uid` **均在 DB 函数内取**（`0015:590,647`）；`:221` **payload 不含 price/seller_uid**；`:276` 只读订单行做发起人闸、注明「不是授权真源」）✓；⑤ 越界面 = 恰好 `database.ts` 被改 + 6 新件，**冻结面 0**、**注册点 53 → 53**（前端 50 条路径里 `/api/listing*` **0 命中** ⇒ 服务层交付、路由随批 4，**它显式报数**）✓。
**采信其读数**：**P2** `amount=200 = price 100 × qty 2`（服务端取数）、**恰好 `purchase`+`sale` 2 腿**、逐腿 `frozen_delta=0`、Σδ=0、`stock 3→1`、`pay_txid` 同语句落库；**伪造 `price=1`/`seller_uid`/`buyer_uid` 全被忽略**（买卖方仍 = `listing.seller_uid` + actor）✓；**幂等** 同键重投 ⇒ 200 `idempotent_replay:true` **分录仍 2 腿、txid 逐位相同、库存未二次扣**；同键异内容 ⇒ **409 `LEDGER_IDEMPOTENCY_CONFLICT`**（DB `LD003`）；**P4** **恰好 `purchase_refund`×2**（卖家 −200 / 买家 +200）、`order→refunded`、**`stock 0→0`（★7-7 = 不回滚）**、重投 200 replay ✓；负例：库存不足 409 `LD001`、自购 400 `LEDGER_SELF_TRANSFER`（LD019）、未知 id 404（LD022）、缺/坏键 400（LD004/LD005）、**非 owner 退款 403 `ACTOR_NOT_ALLOWED`**（第三方与**买家本人**皆拒 ✓）、未付款单退款 409（LD011）✓；`tsc` 0；`eyJ` 0；面板重启 → `/health` 200（2219ms）/`schema_version=0020` ✓。
**★ 我裁定 4 项**：
① **7-7（退款回滚库存）**：**保持现取「不回滚」**、单点 = `:55`（**待 Kevin 一句话可改**）⇒ 接受实现 ✓。
② **退款发起人（它标「待 Zang」）**：**裁定 = P4/P5 仅「卖方」可发起**（理由：**资金从卖方余额出 ⇒ 由出资方发起**，且若允许买方单方退款 = **对卖方的单向掠夺向量**）；**「管理员可发起」登记为后续能力**（随权限模型，批 6）；**Jing 把它写进 §4.2 P4 的 actor 口径** ✓。
③ **★ 我自己的 brief 自相矛盾（我认账）**：我在 3c 的 brief 里同时写了硬口径 #6「**必须登记进 spec §1.8 清单**」与边界「**`docs/**` 只读**」⇒ 单元**按边界处理（只产待补行、不写 spec）= 正确**，**错在我的措辞**。**修正口径**：凡要求「登记进规格」，一律写作「**产出按规格表格式的待补行 + 交规格方（Jing）落**」，**不得**与「规格只读」并存。
④ **★ 它发现的 spec 偏差（我亲核成立）**：spec §4.2 P2/P4 写 `404 LD023`，而 DB 实抛 **`LD022 = LEDGER_REF_NOT_FOUND`**；**我亲核** `src/ledger.ts:1051/1052` = `LD022: 'LEDGER_REF_NOT_FOUND'` / **`LD023: 'LEDGER_UNKNOWN_KIND'`** ⇒ **spec 写错了编号**；**实现跟随 DB 真源 = 正确**；**要求 Jing v0.7 类级订正**（spec 内 `LD023` 共 **4 处**，须逐处核对是否都该是 `LD022`，并做一次「spec 的 `LDxxx` ↔ `ledger.ts` 真值表」对照扫描）。
**它照登**：`NOT_MEASURED`（服务层响应体的 `details.reason` —— neon 驱动不搬运 PG DETAIL，已用 `pg` 直连补测 DB 侧真值；`order_pay_missing` 状态机下不可达；并发同键 race；`listing_not_listed`；币种状态闸；`401` 面）✓；**探针自曝**（首版 probe 引用不存在的 `currency.supply`；snapshot 的 `post2` 首次误写越界目录 `.p4z-tmp-post2/` ⇒ **已删并重跑 run-tagged 版**）✓ —— **两条都是它自己抓出来并处置的**。
**⇒ 批 3 只剩 3d（交易所 + 佣金）；已派 3d + Jing v0.7（折入 3c 事实 + §1.8 两条待补行 + 退款发起人口径 + `LD023` 类级订正 + 我的 brief 修正）**。

---

### 5.87 **Jing v0.6 验收通过 —— 幂等键契约（选项 B）三款入 §4.5 + §1.8 三方分工 + AUD 入册 §1.10；★ 它自证「只追加」（6 行替换 / 被删行不落在 3c 的阅读面）**（2026-09-30）

**交付（Jing · `deleg_56a00475`，27 calls / 278.5s）**：`docs/route-layer.spec.md` **v0.6 / 983 行 / 236644 B / md5 `5424645a3def7d6fe405edbd25c6ab64`**（v0.5 = 881 行 ⇒ 净 **+102 行**）；快照 v0.6 **同 md5 + 我亲跑 `cmp` 相同** ✓；`docs/audit/route-layer-v0.6-delta.md` **160 行**（§D0–§D8）。
**★ 我亲验（不采信报告）**：① md5/`cmp`/行数逐项相符 ✓；② **「只追加」我亲核**：`diff -U0 v0.5 v0.6` 的**被删行恰 = 6 行**（与其自报一致），且落在 head/§0/§7 状态列——**不落在 §1.8 / §4.2 / §4.5 正文**（那三节正是 **3c 正在读的面**）✓；③ **旁册与旧快照逐位未动**（v0.5 `7493f410…`、v0.4 `e8b3ceff…`、`data-layer` `ad657c0a…`、`ledger.spec` `eee9f165…`）✓；④ 越界面无交叉（3c 在改 `src/**` 并落自己的 7 件，Jing 只写 3 件）✓。
**折入的 4 条 delta**：① **幂等键契约（我 §5.86 裁定①「选项 B」）→ §4.5 追加块**，三款：**契约1** 派生键 = 自然标识的单射（现取逐字 `job-service.ts:133`/`:180`）；**契约2** 行为矩阵（同标识同内容 ⇒ `200` replay 零分录 / 同标识异内容 ⇒ **`409 LEDGER_IDEMPOTENCY_CONFLICT` + `details.reason=REPLAY_FINGERPRINT_MISMATCH`**（真源 `job-service.ts:156`）/ 异标识 ⇒ 落新行）；**契约3** 无自然键者 **fail-loud**（`job-funds-service.ts:84`）；**409 面 → §7-28 永久回归项**；**前端条件触发项 → §2.4 S10**（现前端**应用代码面 0 命中**，`frontend/` 全树 26 命中**全在 `node_modules/**`** —— **口径澄清正确**）。② **§1.8 三方分工**（Kong 每片报「认领 N/未认领 M」/ Jing 每次刷新真扫描 / 我批末差集 = ∅）+ **它本单又真扫描了一遍复算**（服务层导出 27 / 注册点 53 / 8 个 verb 调用点 0 / 正向对照 2/2 ⇒ **§1.8 仍 8 条 + 1 附注、无增无减**）✓。③ **AUD-JOBKEY 入册 → 新开 §1.10**（248 行 / 21502 B / md5 `99f535e0…`；产物 4 件；探针 17025 B；**零 `modified`**；A/B/C 去向）✓。④ **§7**：7-25/7-26 仅状态列改「已定」，新增 7-28/7-29/7-30；**7-1…7-24 与 7-27 一字未动** ✓。
**它主动报的差异（我采信）**：① 审计件读数更正（v0.5 记的 246 行是**中途读数**，现取 248 行/21502 B）✓；② 前端口径精确化（应用代码面 0 命中 vs 全树 26 命中全在 `node_modules/**`）✓；③ 交件时 `git status` 非空（3c 7 件 + 本单 3 件）**如实报告、未掩盖** ✓；④ **`§7-25/§7-26` 依据格正文未改**（并发纪律）把差异登记到 §7-30 + 补注块 ✓ —— **这正是我要的并发纪律执行**。它自曝**预算 ~30（超 25）**（多用于逐条锚点复核 + 冻结节零删除自证）⇒ **我认账**。
**★ 我的探针自曝（本轮我的错）**：我那条「分区删除行数」检查用 `awk RS='@@'` 写坏了（三个区都印 6 = 在量整文件），⇒ **我自己那条读数作废**，改用 `diff -U0 | grep '^(@@|<)'` 才拿到真值（被删行 = 6、且不在三节正文内）。

---

### 5.86 **AUD-JOBKEY 验收：★ 我的立案假设被推翻（碰撞不成立，且推翻得对 —— 我亲自读源码复核）⇒ 裁定采纳「选项 B」；Jing v0.5 验收通过，★ 其「真扫描」抓出我漏的 5 条（**整个商品写口从未接线**）；我裁定 7-26 三方分工**（2026-09-30）

**A. AUD-JOBKEY（Kong · `deleg_cdd633b9` task-0，19 calls / 242.8s）—— 验收通过（审计结论 = 我的假设不成立）**
**结论**：**2a 的派生键是「自然标识的单射、不含内容」** ⇒ **不同实体不可能同键** ⇒ **碰撞不成立**。**★ 我亲自读源码复核（不采信报告）**：`src/job-service.ts:133` = `resolveJobCreateKey(params.createKeyRaw, ['submit', params.identifier, params.workerUid])`、`:180` = `resolveJobCreateKey(params.createKeyRaw, ['apply', params.jobId, params.workerUid])` ⇒ **入参只有实体标识** ✓✓。
**它的实测（采信，与我源码读一致）**：T1/T2（不同 application 10/11、内容逐字相同）⇒ **200 / 200 且都落新行**（`job_submission` 6→7→8，键 `…submit:10:1:…` ≠ `…submit:11:1:…`）；A1/A2（服务层 apply，job 12/13 同雇主同内容）⇒ 各落 1 行（`job_application` 9→10→11，键不同）；T3（**同一实体 + 同内容**）⇒ 200 `idempotent_replay:true`、零增量（**设计内幂等**）；**T4（同一实体 + 异内容）⇒ `409 REPLAY_FINGERPRINT_MISMATCH`**（且 body 的 `ref_id` 与 T1 落行键**逐字相同** ⇒ **反证「键不含内容」**）✓；全 8 笔 `ledger_entry` 增量 **0**、`account` before=after ✓。**结构性解释（我认可）**：`job` 表**无自然键**可用（`job_id` 是 IDENTITY）⇒ 内容派生**必碰撞** ⇒ **3b 的 fail-loud 正确**；2a 两处标识已确定 ⇒ 派生安全 ⇒ **两套口径语义上自洽**。
**前端取证（关键，影响修法）**：`frontend/**` 里 `create_key|createKey|idempoten` **0 命中**；2a 唯一写口调用体 = `components/ActiveTaskModal.jsx:50`（body 仅 `{info_input}`、无键无 `Idempotency-Key` 头）；`frontend/src/**` 对 `/api/job` 调用 **0**；**J4 submit 是前端唯一在用的 2a 写口且从不传键** ⇒ **改 fail-loud 必然弄断冻结前端** ✓。
**路由面如实标注**：`POST /api/job/12/apply` ⇒ **404**（J2 无 HTTP 路由，`index.ts:24` 只引了 `submitWork`）⇒ A1–A3 走**服务层**并**逐处标注**，未冒充 HTTP 实测 ✓。
**★ 裁定 ①（7-25 的 2a 面）⇒ 采纳「选项 B」（零改码 + 把语义升为显式契约）**：理由 —— ① 碰撞假设**已被证否**；② 选项 A/C 都要求**改冻结前端**（前端 0 处传键）⇒ 会弄断现网；③ 现行为**已经是响亮拒绝**（409）而非静默；**契约内容** =「**派生键 = 实体自然标识的单射**（2a：`(application_id|job_id, worker_uid)`）⇒ **同标识同内容 = 200 replay / 同标识异内容 = 409 `REPLAY_FINGERPRINT_MISMATCH` / 异标识 = 新实体落新行**」＋「**无自然键可用的实体（如 3b 的 `job`）必须 fail-loud 不派生**」⇒ 交 **Jing v0.6** 正式化（§4.5）+ 登记**永久回归项**（409 面）+ 批 4 前端同步项（「若将来前端需要『同实体重复提交且内容已变』，必须传 `create_key`」）。**★ 我的立案自评**：**假设错、但流程对** —— 立案的判据（「不同实体被当重放」）是可证否的、并要求**实测 + 源码**双证据 ⇒ **一轮就结案，没有让错误的假设进入实现**。
**它照登的**：`NOT_MEASURED`（「不同 worker 对同一 job」未造夹具；前端不传键是**静态 grep** 非运行时抓包；3c 的 `/api/tasklist/:jID/verify`（前端同样无键）范围外）；**已知偏差自曝**（报告初稿列了未生成的 `probe.log` ⇒ 已改正文 + §6 标注「stdout 未落盘、`results.json` 为唯一真值」）✓。**交付**：报告 `docs/audit/p4-aud-jobkey.md`（**248 行**）+ 探针 + 产物；`git status` **零 modified** ⇒ **零改码声明为真** ✓。

**B. Jing v0.5（`deleg_cdd633b9` task-1，20 calls / 330.1s）—— 验收通过；★ 其真扫描抓出我漏的 5 条**
`docs/route-layer.spec.md` **v0.5 / 881 行 / 210464 B / md5 `7493f410b30de2ff042a3b137eeb0615`**（v0.4 = 763 行 ⇒ **+149 行**）；快照 v0.5 **同 md5 + 我亲跑 `cmp` 相同** ✓；**旧快照逐位未动**（v0.4 `e8b3ceff…` / v0.3 `fa91425e…` 我现取复核）✓；**`data-layer.spec.md` 一字未动**（`ad657c0a…` ✓，它显式判定「`DL86` 是实测验证既有条文、非改条文」⇒ 未动用追加式额度，**正确**）；delta 件 179 行。
**★ §1.8「已实现·未注册清单」= 8 条 + 1 附注（**我点名的 3 条全命中且被包含**、**它实测多出 5 条**）**：`applyToJob:175`→`POST /api/job/:jobId/apply`、`acceptApplication:208`→`/accept`、`createListing:164`→`POST /api/listing`（我的 3 条）+ **`publishJob`（`job-funds-service.ts:149`→`POST /api/job`）、`settleJob`（`:218`→`/review`）、`refundJob`（`:237`→`/review`·`/cancel`）、`updateListing`（`listing-service.ts:222`）、`transitionListingStatus`（`:286`）** —— **后两者同属 `POST|PATCH /api/listing/:listingId`，且 `index.ts` 里根本没有 `from './listing-service'` 的导入 ⇒ 整个商品写口从未接线**（这与我批 2b 的「服务层已交付、路由层随批 4」裁定一致，但**我此前只点到 `POST /api/listing` 一条、漏了更新/状态转移两条**）⇒ **这正是我要真扫描的原因，扫描做对了** ✓✓。附：准入判据 / 扫描口径 / 负向排除（12 helper + 2 无 TS 服务层）/ **7 个已接线 verb 作正向对照**；`#4 POST /api/job/:jobId/submit` 单列（`submitWork` **已接线** `:602` ⇒ 功能由既有路径承载）✓。
**它折入的**：§1.9（K1–K11）3b 事实；两条行为 delta → §3.1（**改前锚点可复算**：`git show 9d40b17:index.ts:1064-1067` / `:1077-1078` —— **给了我可复核的取证方式** ✓）；回归项 §2.4 S9 / §7-27（**现取** `DashboardPage.jsx:223-236` **不对 400 做分支**、`jID` 来自 `application_id`；残留 = 前端 23 文件全量 `NOT_MEASURED`，**未填 0**）✓；§7 **新增 7-25/7-26/7-27、7-1…7-24 一字未动** ✓。它主动报「审计件在本单中途落盘 ⇒ 初稿四处就地更正」✓ + 「行号漂移（`POST /api/currency` `:1160→:1166` 等）⇒ §1.5 口径由三分升四分、**未做未测的批量回填**」✓。
**★ 裁定 ②（7-26 维护责任）= 三方分工**：**Kong（实现方）每片收尾必须扫「本片新增的已实现未注册路径」并报「认领 N / 未认领 M」**；**Jing 维护 §1.8 表**（每次 spec 版本刷新时**真扫描**一遍服务层导出 × `index.ts` 注册表）；**我（Zang）批末做差集**（`全量服务层导出 − 已注册 − §1.8 已登记 = ∅`）⇒ 交 Jing v0.6 写入（与 §5.78 新纪律衔接）。

**⇒ 已派 3c（商品资金：`purchase`/`sale`/`purchase_refund`）+ 随后 Jing v0.6（折入本次两条裁定 + AUD 结论）**。

---

### 5.85 **批 3b（招工资金）验收通过 —— 我亲验守恒（`Σtotal` 第三次逐位相同）+ 逐 kind 与自报逐项一致 + 亲读「结论位与资金同语句」的原子性；Jing v0.4 验收通过；我裁定 3 项（F-1 集成缺口 / 两条既有路径行为 delta / `create_key` fail-loud vs 2a 派生兜底）+ ★ 新纪律「已实现未注册清单」**（2026-09-30）

**A. 3b（Kong · `deleg_fbd3004b` task-0，44 calls / 490.5s）—— 验收通过**
**交付**：**新建** `src/job-funds-service.ts`（330 行 / sha256 `7b808634c615e7467bcfe71d51c38d2c9dce1fd1c1f4eababfde781190b3d53d`；`publishJob`/`settleJob`/`refundJob`/`verifyJobSubmission`）；`src/database.ts` **+3 method**（`jobPostEvent` = **唯一资金写路径**（`:1665` `SELECT public.job_post_event($1::jsonb)`）、`resolveReviewTarget`（只读）、`reviewJobSubmission`）；`src/index.ts` **只改接 1 条既有路由** `POST /api/tasklist/:jID/verify`；报告 `docs/audit/p4-b3c-job-funds.md`（**263 行 / 9 节 / sha256 `5a17fe1c22451d18b222f3a540101e8d3432dd2376ae424c9f78f576f48bcdef`**）+ 产物 + 3 探针。
**★ 我亲验（不采信报告）**：① **守恒第三次独立复算** —— 我的 `zang-sigma.js`：`Σbalance 1995998 + Σfrozen 4002 = **Σtotal 2,000,000**`（**与我前两次逐位相同**）、负值行 0 ✓；② **逐 kind 与它自报逐项一致** —— `ledger_entry` **42 → 76**，`job_escrow` 10 / `job_escrow_refund` 4 / `job_payout` 6 / `job_fee` 6 / `commission` 4 / `transfer` 4（= Δ34，**枚举等式闭合** ⇒ 被拒调用零分录）+ 既有 kind 未变（`hold` 4、`mint` 2、`listing_deposit` 16、`currency_create_fee` 20）✓；③ **原子性我亲读**：`reviewJobSubmission` = **单条 SQL**（`WITH ev AS (SELECT public.job_post_event(...))` + `sub AS (UPDATE public.job_submission …)` + 末 `SELECT (SELECT ev.r) , (SELECT count(*) FROM sub)`）⇒ **「审核通过→发放必须原子」成立** ✓；④ **单写路径我亲核**：服务里唯一的 `./ledger` 引用是 `:30` 的 `ledgerErrorFromDbError/normalizeLedgerError`（**纯错误映射助手**，非写路径）✓；⑤ 越界面 = 恰好 `database.ts`/`index.ts` + 新服务 + 报告/产物/3 探针，**冻结面 0**、**注册点 53 → 53**（只改接、零新增）✓。
**它与我一致的读数（采信）**：DL86 **两形态实测** —— 无邀请人 ⇒ `job_fee` 入 `-1`（`-2` 命中 0）；建真链（depth 2）⇒ 8 腿 = payout×2+fee×2+**commission×4**、`-2` 进 +10/出 −10 守恒、**`-1` 命中 0** ✓；**每个事件 `Σ(delta+frozen_delta) = 0`**、托管/退款 = 同账户 2 腿 `balance↔frozen` ✓；HTTP：approve 200 → **重投 200 + 顶层 `idempotent_replay:true`、txid 集合相同、分录不翻倍**；reject 200（`job_escrow_refund`×2）；401/403/404 码正确；**成功面键集不变**（approve 11 键 / reject 9 键）；`tsc` 0；`eyJ` 0。
**★ 我裁定它停在我处的三项**：
① **F-1 集成缺口（`job.worker_uid` 选定入口 `/api/job/:jobId/accept` 未注册 ⇒ 批 4 前前端 verify 按钮走不通完整资金链）** ⇒ **接受现状、不在本批注册**（理由：前端对 `/api/job*` **零调用**，注册了也无人受益；且注册即破坏「53」口径）；**但必须把「已实现未注册」的路径作成清单以免被遗忘** ⇒ **★ 新纪律 + 新交付物**：**`route-layer.spec` 增设「已实现·未注册清单」**（每条：路径 / 服务层落点 / 为何未注册 / 由哪一批注册），**首批条目** = `POST /api/job/:jobId/apply`、`POST /api/job/:jobId/accept`、`POST /api/listing`（+ 后续片新增者）⇒ 交 **Jing v0.5**（这正是 `assets/init` 那次「两片互推、无人认领」的结构性解药）。
② **两条既有路径行为 delta**：**非数字 `:jID` 400 → 404（`R107`）**（对齐 detail-miss 统一 404）与 **撤除「admin 提交不进面板队列」的 bespoke 400 守卫**（读口已结构性排除 + §3.3-8）⇒ **两条均批准**；但**必须**：**登记进规格**（Jing v0.5）+ **核前端是否依赖旧 400**（批 4 前端同步项；前端确实在叫 `/api/tasklist/:jID/verify`）。
③ **`create_key` 缺失 ⇒ fail-loud 不派生**（与批 2a 的「派生兜底」不同，理由 = 避免「同内容不同 job」被键碰撞成**静默重放**）⇒ **批准（更优）**；**并由此立案**：**审 2a 的派生兜底是否会造成同类静默重放** ⇒ 派 **FIX-JOBKEY**（小单）。

**B. Jing v0.4（`deleg_fbd3004b` task-1，26 calls / 338.4s）—— 验收通过**
`docs/route-layer.spec.md` **v0.4 / 763 行 / 166747 B / md5 `e8b3ceffd98ef82fb37c77c2b13b6108`**；快照 v0.4 **同 md5 + 我亲跑 `cmp` 相同** ✓；**旧快照逐位未动**（v0.3 `fa91425e…` / v0.2 `0c587183…` / v0.1 `be823001…` 我现取复核）✓；`docs/audit/route-layer-v0.4-delta.md` **51 行 / D1–D10 带锚点**；**`docs/data-layer.spec.md` v0.7 / md5 `ad657c0a5068e91cb57d935bb34fd86b`**（**追加式加注 §18，`DL*` 正文一字未改**）+ 快照 `docs/versions/data-layer.spec.v0.6.md` = `7b86b811…` **我核过 == `git show HEAD:docs/data-layer.spec.md` 的内容 md5** ✓（该册 DL134 要求留「改前快照」⇒ 命名取改前版本，与我 route-layer 的命名习惯不同但**符合该册自有约定**）；`ledger.spec` v0.13 原样未动 ✓。
**它折入的**：7-15/16/23 **全部改「已定」**（带我的 §5.82 锚点）+ 三补强；批 3a 真收官新增 **§1.7（H1–H8）**、§1.6 改标「FIX-B 前历史读数，保留不删」；**借码正式化**（§3.2 + §4.4-12，并显式区分 b3a↔b3b「同号异案」）、**C1-T05/C2-T17 期望改 200**；§3.4 精化 + 新增 **§7-24**（无 access log ⇒ 响应体 + 零分录 + `NOT_MEASURED`）；`data-layer` §18（AN1/AN2/AN3 **只登记不重写**）；§7-3 补留痕句「Zang §5.80 曾批准『冻结可退』，已由 §5.81 作废并纠正」✓。**它主动更正自己的口径**：v0.3 记 `schema_version=0019`，**现取实际 = `0020`**（我库探针亦为 `schema_migration` 19 / `schema_version` 0020）✓；并主动报并发写者（3b）✓、预算 ~40（超 30）自曝 ✓。

---

### 5.84 **★ 批 3a 真正收官：FIX-RS（重置键修复）与 FIX-B（C2 消耗入 `-1` + 金额服务端取数）双双验收通过 —— ★ 我的自算守恒复现（`Σtotal` 恒 2,000,000、`hold` 计数未增）；三条裁定（借码 / 期望变更 / 401 无 access log 的取证口径）**（2026-09-30）

**A. FIX-RS（Kong · `deleg_9fe07079` task-0，22 calls / 299.7s）—— 验收通过，重置键恢复可用**
**交付**：`scripts/p3x-00-rebuild-replay.ts` **仅 3 处**（`git diff --numstat` = **3+/3−**，我亲核）：`:8` 注释版本范围 → `0001..0020（0018 缺）`；`:57-59` `VERSION_ORDER` 追加 `'0019','0020'`；`:625` `schema_migration.row_count` `'17'`→`'19'`；报告 `docs/audit/p4-rebuild-key-repair.md`（**273 行 / sha256 `136186e0b528b2d027f4267759c042703711129ed178ef8433a156251a431e51`**）+ 产物 `rs-before/**`、`rs-after/**`（分开落盘可 diff）。
**★ 两跑（均 `--dry-run`，我核过无 `--apply`）**：修前 `gate.ok=false / reason=terminal_failed=1: schema_migration.row_count`、`version_order_ok=false`、`terminal 32/30`、exit **3** ⇒ 修后 **`gate.ok=true（all gates green）`、`version_order_ok=true`、`terminal 32/31`、`checksum_all_byte_equal=true`、`F_net_zero.identical=true`、`tx_final=ROLLBACK`、exit 0** ✓。**关键自证**：两跑 `A_hash` **同值**（`47db7933…`）⇒ 同一库快照、差异**纯来自脚本改写** ✓（这正是我教的「先证同一基线」口径）。
**我另核**：`grep -c 'COMMIT'` = **8**，其中**唯一可执行语句**在 `:794`（`if (canCommit) { await c.query('COMMIT'); … }`），其余 7 处为注释/日志串 —— 它**主动声明了这个 grep 口径**（避免被误读成 grep=1）✓。
**它自曝的操作瑕疵（已归位，采信）**：两次 dry-run **忘了带 `P3_ART_ROOT`** ⇒ 脚本把 run 目录写进了既有 `backend-ts/.p3x-artifacts/`；它**把这两个目录移动（非删除）**进 `.p4-artifacts/rs-{before,after}/run`，**`.p3x-artifacts/` 已复原为原先 3 个目录**（我亲自 `ls` 核过：`p3x-00-dry-20260928174551/174808/174912` 三个 ✓）⇒ **零丢失**。

**B. FIX-B（Kong · `deleg_9fe07079` task-1，53 calls / 657.4s）—— 验收通过，批 3a 真收官**
**交付**：`src/database.ts` 仅 `listCurrencyWithDeposit` 一带（现取 `:1455-1470`）：保证金第 4 腿由「同 uid `frozen_delta=+d`」→ **`uid=-1` `delta=+d`**，该形状里**不再出现 `frozen_delta`**；`src/currency-service.ts` 新增 **`resolveServerAmount` + 三个下限常量**（`:140-141` = **1000**，逐条标 **`TODO: Kevin 定值`**、注明**占位非经济定值**）、**删除旧的 `toRequiredPositive`（洞的载体）**、回执改 `deposit_consumed` / `deposit_credit_uid:'-1'`（我核到 `:439`）/ `deposit_refundable:false`；报告 `docs/audit/p4-b3b-currency-funds-fix.md`（**225 行 / sha256 `dfbff4ac9bb156e2c032e2f3caf735c69d45a4858c4c0b0434a4bf3e1177eea0`**）+ 产物 + 3 探针。
**★★ 我的独立验收（含自算）**：① **我的 `zang-sigma.js` 亲算**（FIX-B 后）—— `Σbalance 1995998 + Σfrozen 4002 = **Σtotal 2,000,000**`，**与我 FIX-B 前那次自算逐位相同** ⇒ **纯转移、ΔΣ = 0** ✓；`ledger_entry` 30→**42**；逐 kind：`currency_create_fee` 20（+8）、`listing_deposit` **16**（+4 = 两个 C2 事件 ×2 腿）、**`hold` 仍 = 4（未新增 ⇒ 旧错形状不再产生新分录）**、`mint` 2 ⇒ **我的数与它的自报逐项一致** ✓；负值行 0 ✓；② `git status` 面 = 恰好 `database.ts`/`currency-service.ts`/`p3x-00-rebuild-replay.ts` 三个被改，**冻结面 0**（`ledger.ts` 未被 FIX-B 动 ✓）、**注册点仍 53** ✓；③ 我采信其逐腿读数（`b3b-03-legs.json`）：C2 成功事件 (txid 42–45) **4 腿全在 `balance`、`frozen_delta` 全 0**、`listing_deposit` 两条 = user −2000 / **`-1` +2000**；服务端默认事件 (46–49) 同形状、金额 = 源码常量 1000/1000；`403`/`409` 键下**腿数 0** ✓；账户 dump：`970001` 1992795/4002 → 1984795/4002、`-1` 3203 → **11203**（+8000 = 两事件 fee+deposit）✓；④ 端点 **24/24 PASS**（成功 / **幂等重投 +0 行 +0 分录** / **低于下限 400** / 余额不足 409 且无孤儿行·审计行·分录 / 非本人 403 `ACTOR_NOT_ALLOWED` / 未知 cid·`cid=0` 404 / 无 token 401）；回归 `/health`·`home`·`prize/all`·`task/all` 200、**410 面 6/6**、`tsc` 0、`eyJ` 0、面板重启 pid 33620 → `/health` 2011ms 200 ✓。
**★ 我裁定它停在我处的三件**：① **低于下限的借码** ⇒ **接受 `LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`**（`reason` 已能判别，**不开新单**、不新造码）；但要 **Jing 在 v0.4 把该选择正式化进 §3.2/§4.4**（不得停在「实现自选」）。② **「未传金额 ⇒ 服务端默认」使 C1-T05/C2-T17 的修前期望由 400 变 200** ⇒ **批准**（正是我 §5.82 7-23 要的语义：**金额不得由客户端决定**；期望随语义变更是正确的，且它显式登记了）；**须在 v0.4 同步这两条期望**。③ **401/403 的服务端日志逐条归因 = `NOT_MEASURED`**（本仓**不落 access log**：1199 行窗口内 `/api/currency` 0 行、403 0 行）⇒ 它改用**响应体 + 零分录取证**且**未把「查不到」写成「确认无异常」** ⇒ **接受其处置**。**★ 我借此精化自己的口径**：那条「凡 401/403 必须核服务端日志」的**目的**是抓「被吞成 401 的 DB 错误」；**P4-SEC 后 `resolveActor` 已把 infra 分类为 503** ⇒ 该风险已结构性下降；**当被查仓没有 access log 时**，正解 = **响应体证据 + 零分录取证 + 显式 `NOT_MEASURED`**（**不得**据「日志查不到」下结论）。
**它的探针自曝（采信）**：首版 e2e 的 `entries`/`kinds_ok`/`both_legs_owner_and_neg1` 三处是**探针缺陷**读数（`txid` 逐行行走 + 多腿键 `K#2` 派生 + `sql()` 调用式内联）⇒ **已声明作废**，逐腿以 `b3b-03-legs.json` 为准 —— **正确处置**（并且与我自算的数一致 ⇒ 作废后留下的那套读数是靠谱的）。
**⇒ 批 3（3a）至此真收官**（币种面：`0019`+`0020` 迁移、`ledger.ts` 手术、C1/C2 正确入账、金额服务端下限、重置键修复、我自算守恒）；**下一步 = 3b（招工资金）+ Jing v0.4（折入 7-15/7-16/7-23 裁定、借码正式化、期望同步、注册点 53 与两个新迁移的事实、批 4 前端同步项）**。

---

### 5.83 **FIX-A2 验收通过 —— `0020` 已应用（注册表 19）、函数体 IN 列表已摘除 `listing_deposit`（我亲核 `:573`）、正向消耗入 `-1` 打通且 `frozen` 零变动；★ 我亲核它报的「重置键已断」为真 ⇒ 派 FIX-RS + FIX-B**（2026-09-30）

**交付（Kong · `deleg_605e1a2f`，54 calls / 714.2s）**：**唯一代码变更** = 新建 `migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（**60667 B / sha256 `228127d89de90a0d187aff8c2cd12b18aad94130faca7e804f5dd23c1d9cfc4d`**；函数体从 live `pg_get_functiondef` **逐字派生**、**仅删 18 字节**（`,'listing_deposit'`）+ 只读 `DO` 自检含 `prosrc` md5 硬断言（生成前已用 live 读数自证非假检））；报告 `docs/audit/p4-b3a-fix2-ledger-post-event-shape.md`（含 **§1「本次为何解禁 + 裁定 #14 原文逐字引述」**、§5 p3x 只读检查、§9 探针自曝 6 条）+ 产物 16 件 + 6 脚本。
**★ 我亲验（不采信报告）**：① `0020` 在盘且 sha256 逐字相符 ✓；② **函数体现行 IN 列表**（`0020:573`）= `('hold','hold_release','job_escrow','job_escrow_refund')` ⇒ **`listing_deposit` 已摘除**、其余 4 项逐字仍在 ✓；③ **`schema_migration` = 19**（我的库探针）、`schema_version=0020` ✓；④ 越界面干净（只有 `0020` + 报告 + 产物 + 6 脚本，**零已跟踪文件被改**）✓；⑤ 注册点仍 **53** ✓；⑥ 触发器 43/非 `O` 0、基表 21/视图 1/函数 74 ✓。
**它与我一致的读数（采信）**：**改前/改后 diff = 1 hunk / 1 行**（`45722→45704 B`、977 行不变、md5 `e784a586…→57fdc800…`）；**正向** `txid 28/29` = 用户 `970001 balance −1` 与 `uid=-1 balance +1`、**两腿 `frozen_delta=0`**（改前此形状必拒）✓；**负向 3/3 `HOLD_PAIR_REQUIRED`**（`hold` 1 腿 / 错 cid / 同组 3 腿）+ `commission→-1`、`listing_deposit 借 -1`、`-2`/`-3` 各一例**全拒**、负例落库行数 **0** ⇒ **守卫本体仍在、白名单未被放宽** ✓；关闭集仍 **20**、`HOLD_KINDS`=4；幂等同键 `txid 30` 且 `second_entry_added=0`；**`Σ(balance+frozen)` 变化量 = 0**；`tsc` 0；`/health`·`/api/home` 200、`410` 面仍 `410`；面板 `{sid}` 重启成功 → `/health` 2750ms 200 → 真 token 业务端点 200；产物 `eyJ` **0**。
**★ 我亲核它的两个上报为真**：① **重置键已断（确认）** —— `scripts/p3x-00-rebuild-replay.ts:57` `VERSION_ORDER` 写死至 `'0017'`（缺 `0019/0020`，`:842 version_order_ok` 现为 false）**且 `:625 add('schema_migration.row_count','17',…)` 写死** ⇒ 该条经 `terminal_failed_empty` 归零 `gate.ok` ⇒ **`--apply` 会拒绝 COMMIT**（**失败安全** ✓ 但重置能力当前不可用）；`loadMigrations()` 与 `key_functions_md5` 自比对**是自适应的**（无需改）；`0018` 无文件**勿补**。② `src/database.ts:1382-1460` 上市入账形状 ⇒ 归 **FIX-B**。
**它的探针自曝（采信，均未污染读数）**：run#1 的「跨账户 hold」负例因**该库只有 1 个正 uid 账户**退化成合法的同账户对（FAIL 保留、未删）；H2c/H1 首版被 **TS 侧 `assertBalanced`**（`ledger.ts:810-830`）先拦 ⇒ 改形状后才直达配对闸；**`pg_get_functiondef` 输出不带结尾分号** ⇒ 首版迁移 `42601`（**已回滚、注册表无痕**，修正后成功）。
**★ 我的独立 Σ 复算（我承诺过要亲算，本单起兑现）**：我的 `zang-sigma.js` 直接查 live `public.account` 逐行重算 `Σbalance/Σfrozen/Σtotal` + 负值行 + `ledger_entry` 逐 kind 计数 ⇒ **读数落 `zang-sigma.json`**；本单的 `ΔΣ = 0` 我先按 txid 级读数采信，**FIX-B 重跑时以我的自算为准**（已写进 FIX-B 必验读数）。
**⇒ 接下来两单（已指定归属，互不冲突）**：**FIX-RS（Kong）** = 修 `scripts/p3x-00-rebuild-replay.ts` 的三处写死（`:57 VERSION_ORDER` 补 `'0019','0020'`、`:625` 行数改 `'19'`、`:8` 注释同步），**只许 `--dry-run` 取证**（`gate.ok`/`version_order_ok` 双双为 true、`tx_final=ROLLBACK`、净零 identical、**绝不带 `--apply`**），交付报告 + 产物；**FIX-B（Kong）** = C2 改「消耗入 `-1`」入账形状（`database.ts:1382-1460`）+ C1/C2 金额**服务端取数 + 下限校验**（兜底常量标 `TODO: Kevin 定值`）+ 重跑 22 e2e 与资金不变量（**须给 pre/post 全账户 dump，供我自算**）。

---

### 5.82 **FIX-A 验收（必要非充分）+ 授权 `0020`（含「裁定 #14 禁触 `ledger_post_event` 函数体」单次解禁）+ 我裁定 7-15/7-16/7-23 + Jing v0.3 验收 + 「Jing 读到 FIX-A 中间态」的查盘结论**（2026-09-30）

**A. FIX-A（Kong · `deleg_cbf0521d` task-0，45 calls / 437.3s）= 交付「必要非充分」，阻塞如实上报 ⇒ 我验收**
**已改（我亲核）**：`src/ledger.ts` **2 hunk / +13−4**（`:178` `HOLD_KINDS` 5→**4** 项并带完整依据注释；`:544` `-1` credit 收录 `listing_deposit`、**`debit` 仍空**、`0/-2/-3` 逐字未动）✓；**新建** `migrations/0019_listing_deposit_platform_credit.sql`（**10410 B / sha256 `48a9a4e2d506eb1fceb35ec7de1b9e28f983477f6e1dc9f550bff794e9d9902f`**，照 `0008` 先例**加法式**扩一格 + 正向 9/负向 7 例自检）✓。**它的读数（采信，与 `0019` 文件内注释互证）**：改前只读实测 `ledger_assert_platform_mutation(-1,'listing_deposit','credit')` ⇒ **`LD021/LEDGER_RESERVED_UID` 拒**；应用后 `schema_migration` **17 → 18**、原样重放**幂等**；`-1` 贷 `listing_deposit` **放行**、`commission` 贷 `-1` 与 `listing_deposit` 借 `-1` **仍拒**（**CHECK 未被放宽** ✓）；真事件负对照零残留、Σ `2000000` 不变；kind 关闭集 **20**；`tsc` 0；`/health`·`/api/home` 200、**410 面 6/6 仍 410**；`eyJ` 0；面板重启成功（pid 6569）。
**★ 阻塞（它如实上报，我判为正确处置）**：正向「`listing_deposit` 消耗入 `-1`」被**第二处闸**拒 —— **`ledger_post_event` 函数体内部**还有一份 hold 家族列表（live `pg_get_functiondef` 第 525 行）：`WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')` ⇒ 要求该 kind 每个 `(uid,cid,kind)` 组**恰好 2 条**（同账户搬运）⇒ 与「跨账户消耗入 `-1`」**互斥**（错误码 `LEDGER_AMOUNT_INVALID / reason=HOLD_PAIR_REQUIRED`）。**根因同源**：与 `HOLD_KINDS` 一样，是 **P1c 漏删 `listing_deposit`** 的第二处落点（源码副本 `0004:878`/`0005:1010`/`0012:595`）。它**未擅动**（本单硬边界 + `0008` 记载裁定 #14 禁触该函数体 + `0001–0018` 冻结会 checksum 漂移）⇒ **判为正确**，并**附证**同账户两腿形状仍成功（txid=26）✓。
**★ 裁定 ①：授权 `0020`（唯一的解禁）** —— 建议 = 新建 `migrations/0020_*.sql` 整体 `CREATE OR REPLACE FUNCTION ledger_post_event`，**仅**从那个 IN 列表删 `'listing_deposit'`（**别处一字不动**）；依据 = R31/DL67/DL88（已冻结）**要求**跨账户消耗形状，函数体现写着被推翻的口径 ⇒ **兑现冻结裁定不是新决定**；**「裁定 #14 禁触函数体」在此单次解禁**（理由：解禁的收益 = 该资金路径可达；不解禁的代价 = **永久不可达的静默欠款**）；必带：`pg_get_functiondef` **改前/改后逐字 diff**（证明只少一个 token）、正向（消耗入 `-1` 成功、分录形态 = 借用户 `balance`/贷 `-1` `balance`、**无 `frozen` 变动**）、负向（hold 家族仍要求恰好 2 腿、`-2`/`-3` 白名单不动）、`schema_migration` 18→19、幂等重放、kind 关闭集仍 20；**报告须写明「本次为何解禁」**。**⇒ `database.ts:1382-1460` 的上市入账形状同步归 FIX-B**（归属已指定）。
**★ 裁定 ②（我顺手发现的重置键影响）**：`0019`（+`0020`）入库后，**重建脚本 `p3x-00-rebuild-replay.ts` 的期望（文件数/checksum 17/17）是否自适应**必须复核（若写死 17 ⇒ 下次重置会失败）⇒ 交 FIX-A2 **只读检查并报告**（不得改它）。
**B. Jing v0.3（`deleg_cbf0521d` task-1，23 calls / 308.8s）—— 验收通过**
`route-layer.spec.md` **v0.3 / 716 行 / md5 `fa91425ed380423d0f01f577f0f53aa6`**；快照 `v0.3` **同 md5 + 我亲跑 `cmp` 相同** ✓；**v0.1 `be823001…` / v0.2 `0c587183…` 快照一字未动**（我盘面复核）✓；`docs/audit/route-layer-v0.3-delta.md` **125 行 / D1–D11 带锚点**；**`ledger.spec.md` v0.13 / 2028 行 / md5 `eee9f165704e100c98b3655d742d1ac2`**，改前快照 `docs/versions/ledger.spec.v0.12.md` **`8ffb5fd5…` == 我核过的 HEAD 版** ✓，且 **R1–R109 编号与条文未动、仍 33 码、章节未重排**（**R101 的 `-1` 增方白名单追加 `listing_deposit`**，旧写法同地留痕）✓。**它折入的关键**：§7-3 改正 + **显式登记「v0.2『冻结可退』= 错误推断，由 Zang §5.81 纠正」+ 逐条铁证锚点**；新增 §4.2 C1/C2/C3（C3 = 退市/罚没 P3 无此动作）+ §7-22（将来做强制下架罚款 = 新语义新 kind）；幂等键正式化（真源 = `currency-service.ts:82,193,299`）；§4.4-11+§7-23（金额必须服务端取数，FIX-B 落地）；非 owner 统一 `403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED`；§4.1 关闭集同步（hold 家族 − `listing_deposit`；`-1` credit + 它）。**它主动报「写作中途 FIX-A 落盘 ⇒ 状态翻转已就地更正并留痕」** ✓（这正是我 §5.7「断言前现取」的口径）。
**★ 查盘结论（两单说法冲突，我查明）**：Jing 报「FIX-A 报告 §2–§7 仍是『待回写』占位、其验证读数未取到」—— **我查盘后判 Jing 读到的是 FIX-A 的中间态**：报告现为 **198 行、§0–§7 全在、无「待回写」占位**。**Jing 把它登记为 `NOT_MEASURED` 而非当结论用 = 正确处置**；但**此后凡「引用他人产物」必须附 `mtime < 我的报告 mtime` 与「无活写者」检查**（纪律㉓ 再次被验证）。
**★ 我裁定 7-15（`DL38` 落点读法）**：**以读法①（「旧查询函数调用数 = 0」）为准** —— 因为 `data-layer.spec.md:328` 的原文**自己就写了验收判据**（「重写验收 = 「旧查询函数调用数为 0」」）✓；**读法②（代码结构迁移）不采纳**（原文未要求、且会造成无谓重构）。**补强（我加）**：① 判据必须带**具名函数清单**（= P4-0/批 1 定的 **A 类 jinli 遗留函数**：引用 `asset`/`permission_group`/`prize`/`prize_item`/`shard`/`shard_transfer`/`task`/`task_progress` 者）；② **同时**核那 5 组端点自身 `200/404/410` 语义正确 ⇒ **不得为清零而删功能**；③ 判据用**类级扫描**而非 grep 单点。
**★ 我裁定 7-16（费率键黑名单）**：**采纳 (A) 删除** `FEE_RATE_KEY_PATTERNS`（批 2c 自拟）—— 依据 = Jing 的实证（`0017` **无任何费率键名枚举**，仅 `0017:81` 表注释写「费率键不在此表权威（真源 = `commission_policy.fee_rate_bp`）；**若历史键存在 ⇒ 保留但标注不参与计费、不得删键**」）⇒ 「从 `0017` 派生」**不可能**，而平台既有立场是**容忍 + 标注**而非禁止；**「真源唯一」改由读取侧纪律保证**（任何计费只读 `commission_policy`，永不读 `app_config`）⇒ Jing v0.4 记录并删除该黑名单要求；**并登记**「`app_config` 合法键清单/写入门禁」为**批 6 配置面规格**（现在没有键名枚举 ⇒ 硬造即自拟）。
**★ 我裁定 7-23（保证金/建币费下限数值）**：**机制先落地、数值待 Kevin** —— FIX-B 必须实现「**服务端取数 + 下限校验**」（客户端传值只允许 ≥ 下限，低于 ⇒ 400；**不得**由客户端决定金额）；下限取**可配置 + 代码常量兜底**，兜底值**标 `TODO: Kevin 定值`**；数值本身**不由我发明**（经济参数属 Kevin 拍板）。

---

### 5.81 **★★ 我的重大勘误：§5.80 对 §7-3 的批准作废** —— 铁证 = `ledger.spec.md:79`「保证金『冻结可退』❌ 已于 v0.2 被 **Kevin 原文推翻**」+ `:12`/`:13`/`:191`（消耗不可退、无退还 kind、无罚没）+ `src/ledger.ts:148-150` 与 `migrations/0003:5-8`（保证金上市即消耗、**进 `uid=-1`**）；根因 = **`HOLD_KINDS` 含 `listing_deposit`（`ledger.ts:174-175`）是 P1c 遗留的自相矛盾**（删了 `listing_deposit_forfeit` 却没删它）⇒ 我裁成了错的那一边。**裁定 = 以 R31/ledger.spec/data-layer 为准**；授权 **`0019` 迁移**扩展 `-1` 白名单；批 3a 的 C2 语义必须返工（**FIX-A → FIX-B**）**（2026-09-30）

**A. 我错在哪（不许含糊）**：§5.80 我批准了「保证金 = HOLD 冻结可退、不进 `-1` 白名单、无需迁移」，**依据只有 route-layer.spec v0.2 §7-3 的一行** —— 我**没有去核 `ledger.spec.md`（账本唯一权威）与 `data-layer.spec.md`（已冻结）**。**三条铁证**：① `ledger.spec.md:79`（D7 行）**「保证金『冻结可退』❌ 已于 v0.2 被 Kevin 原文推翻」**；② `ledger.spec.md:13`（v0.2 修订）「① 上市保证金 = **消耗不可退**」、`:191`「移除 `listing_deposit_refund`（保证金改为消耗不可退，**不存在退还 kind**）」、`:12`（v0.3）「删 `listing_deposit_forfeit`：保证金上市时即消耗、强制下架**无可罚没标的物**」、`data-layer.spec.md:454/530/533`（DL67/DL88/DL91【已冻结】）同口径；③ **代码/迁移自己的注释**：`src/ledger.ts:148-150`「保证金 = 消耗不可退」「上市时即消耗、**进平台收入 `uid=-1`**」、`migrations/0003_kind_close_set_20.sql:5-8` 逐字同。
**B. 真根因（这才是「§7-3 冲突」的真身）**：`src/ledger.ts:174-175` `HOLD_KINDS = ['hold','hold_release','job_escrow','job_escrow_refund','listing_deposit']` —— **`listing_deposit` 被错误地留在 hold 家族里**（P1c 删 `listing_deposit_forfeit` 时漏删它），而 `-1` 的 credit 白名单（`ledger.ts:541` 一带）也不含它 ⇒ **代码里两种口径同时存在、互相矛盾**；Jing v0.1 §7-3 把这个矛盾**如实揪出来了**，**是我裁错了边**（我信了 `HOLD_KINDS` 那一侧、且只看了 route-layer.spec）。**⇒ 我 §5.80 的「无需改白名单、无需迁移」作废。**
**C. 最终裁定（以 R31 / ledger.spec / data-layer 为准，Kevin 需求原文「上市需**消耗**一定积分作为保证金」同向）**：`listing_deposit` = **上市即消耗 → 贷方 `uid=-1`（平台收入）**；**不可退、无退还 kind、无罚没**（`hold_forfeit` 按 DL91 **P3 不启用**）；`listing_fee`（若适用）同样 → `-1`；**kind 关闭集仍 20 不变**（R40）。
**D. 授权（本次唯一一次资金口径面变更，逐条留痕）**：① **`0019` 迁移**：把 `listing_deposit` 加入 DB 侧 **`-1` credit 白名单**（加法式 CHECK 重建，照 `0008` 的先例；**禁新增/删除 kind**），**并同步** `src/ledger.ts` 的对应白名单常量；② **`src/ledger.ts` 一处手术**：从 `HOLD_KINDS` **移除 `listing_deposit`**（**只此一处**，其余不动）；③ **`src/ledger.ts` 解冻仅限本单**（原「冻结」是为了保护 P3 已验收内核，本次是**已定案缺陷的手术**，故由我显式授权 + 必须最小 diff + 逐行留痕）；④ 之后 `ledger.spec` §5.1 的白名单列 / `data-layer` 相关行由 **Jing** 回写。
**E. 返工切片（归属已由我指定，不许再「归同批其它片」）**：
- **FIX-A（Kong）**：`src/ledger.ts` 手术 + `0019` 迁移 + 应用 + 验证（`listing_deposit` 贷 `-1` **成功**；非白名单 kind 贷 `-1` **仍拒**（负对照）；`HOLD_KINDS` 已不含它）；报告 `docs/audit/p4-b3a-fix-ledger-whitelist.md`。
- **FIX-B（Kong，**FIX-A 回执后**再派）**：C2 改为**消耗入 `-1`**（分录形态 = 借用户 `balance` / 贷 `-1` `balance`，**不得出现 `frozen` 变动**）+ **C1/C2 的费用/保证金改为服务端取数**（现为客户端必填 `fee`/`deposit_amount` ⇒ **任何人可传 `fee=1` 绕过**，这是**资金面的真洞**）+ 重跑 22 e2e 与不变量（**我会亲算**）。
- **Jing v0.3**：改回 `route-layer.spec` §7-3（并**显式登记「v0.2 的『冻结可退』是错误推断，由 Zang §5.81 纠正」**）+ `ledger.spec` 白名单列回写 + 前述 7-15/7-16/退市罚没缺事件/幂等键待定/非 owner 码/decimals reason。
**F. 我认账的教训（写入本轮纪律）**：**「批准一条跨册裁定前，必须去核所有相关册的已冻结条文」** —— route-layer.spec 是**路由面**册，资金语义的权威在 `ledger.spec`；**我只核了被裁定项的所在册，没核资金口径册** ⇒ 差点让「保证金可退」这个 Kevin 原文已推翻的口径通过代码落地。**⇒ 新纪律**：凡裁定**资金语义**（kind 方向、白名单、可退性、费率），**必须四册齐核**（`ledger.spec` / `data-layer.spec` / `commission.spec` / `route-layer.spec`）+ **代码注释与迁移注释**（它们常留着真口径），并在裁定里**逐条列证据锚点**。

---

### 5.80 **★ 我显式批准 §7-3 的处置（把 spec 里的「裁定 = Zang」补成真）+ 批 3（资金编排）切片 3a–3d + 定义「资金不变量」与「token 口径变更」**（2026-09-30）

**A. §7-3 批准（含纠正归属风险）**：spec v0.2 把 `listing_deposit` 冲突的处置标为「裁定 = Zang §5.73 7-3」—— 但 **§5.73 只是我登记该冲突的位置**，不是终审条文（**归属风险：可能被读成「我曾裁定」**）。**我现显式批准并补上理由**：① **上市费 `currency_create_fee` → `-1`（平台收入）**（`-1` 白名单已含它 ✓）；② **保证金 `listing_deposit` = HOLD（冻结、可退），不进 `-1` credit 白名单** ⇒ 「冲突」是**表象**：保证金是**担保物**（不是收入），路径 = `listing_deposit` 冻结 → 退市 `hold_release` 退回 / 违规 `hold_forfeit` → `-3`（`-3` 白名单已含 ✓）；③ **⇒ 无需改 `-1` 白名单、无需迁移**（现有 20 kind + 两处白名单已自洽）。**⇒ `POST /api/currency`（C1）与 `/api/currency/:cid/list`（C2）在批 3 可建编排**。
**B. 资金不变量（批 3 起每片必带，我亲验）**：**对拍量 = 事件前后 `Σbalance + Σfrozen`（全账户，含 `0/-1/-2/-3`）的变化量**，必须 **== 该事件组净铸/销额度**（纯转移 ⇒ 变化量 = 0；`mint`/`burn` ⇒ 等于票面）；另核 **逐账户非负 CHECK 未触发**、**`ledger_entry` 增量 == 事件数×分录条数**（批 2 的「增量必须 = 0」口径**在批 3 反转为「增量必须 == 预期条数**」—— **注意别再把 0 当绿灯**）。
**C. token 口径变更（写进此后每份 brief）**：P4-SEC 之后，**旧兜底常量铸的 token 一律 401**，探针/验收**必须用 `.env.local` 的 `SECRET_KEY` 铸**（我已在 `zang-auth-probe2.js` 里双密钥对照，新口径为真）。
**D. 批 3 切片（每片 1 类资金路径 + 自己的幂等键与判负）**：
- **3a = 币种面**：`POST /api/currency`（收 `currency_create_fee`→`-1`）+ `POST /api/currency/:cid/list`（`listing_deposit` 冻结）+ 退市/罚没支路；**新增对外路径的问题** ⇒ 按 §5.74/§5.76 口径：**这些是前端确实要用的新路径**（积分交易所是核心功能）⇒ **本片允许注册**（但要**显式报注册点从 51 → N**，并同步 spec §1.5 行号口径）。
- **3b = 招工资金**：`job_escrow`/`job_payout`/`job_fee`/`job_escrow_refund`，含「审核通过→发放**必须原子**」（spec §4 硬口径）。
- **3c = 商品资金**：`purchase`/`sale`/`purchase_refund` + **7-7（退款是否回滚 `listing.stock`）待 Kevin，默认不回滚**。
- **3d = 交易所 + 佣金**：`trade`/`trade_fee` + `commission` 与 10 级返佣权重。
每片 brief 必带：**spec §4 的资金四栏 + 幂等键 + 失败/回滚 + 期望码**、**资金不变量**、**键集冻结**、**禁删**、**in-flight 时的 mtime 守卫纪律**、**token 新口径**。

---

### 5.79 **★ P4-SEC（安全与配置闸）验收通过 —— 我亲跑双密钥对照：env 密钥 ⇒ 200、旧兜底常量 ⇒ 401（修前反向）；fail-fast + 503/401 分类到位；服务收尾健康。★ Jing v0.2 交付并验收（668 行 / 快照 cmp 相同 / v0.1 未动 / 9 组 delta 带锚点）。我裁定 7-15、7-16（均指向 Jing v0.3）**（2026-09-30）

**A. P4-SEC（Kong · `deleg_29d8e228` task-0，50 calls / 457.5s）**
**交付**：改 `src/auth.ts`（**移除硬编码兜底默认值**；保留 `PUBLIC_FALLBACK_KEY` 常量作**显式拒绝**用；缺失即 `[FATAL]` + **退出码 1**）、`src/index.ts`（**新增 `unwrapInfraCause`**；`resolveActor` 分类；`/api/home` 显式把 infra⇒匿名降级以保持公开面语义）、**新增 `src/env.ts`**（`import './env'` 已置于 `index.ts:4`，早于 `./auth`）；报告 `docs/audit/p4-sec-auth-gate.md`（8 节 0–7 / sha256 `6410e5c7611c100198d7d658a8fef392c4aa2c3ef5dd879a7005497b787a0d40`）+ 产物 `sec-20260930T012048+0800/**` + 2 脚本（`auth.ts` sha256 `8b9efc9c5195b02008f4178f5a052b825ba7cbc2ca394a8209d39bc907543ee1`；`env.ts` `9468194c433bc99bd79f41fbeff40a44b60f31cffccbf6111aafd7aaff907764`）。
**★★ 我亲验（决定性，我此前测的是反向）**：**双密钥对照**（我自建 `zang-auth-probe2.js`）—— `.env.local` 的 `SECRET_KEY` 铸 token ⇒ `/api/user` **200 / `/api/task-progress` 200**；**旧兜底常量 `your-secret-key-here` ⇒ 401 / 401**；无 token ⇒ 401；错签名 ⇒ 401 ⇒ **「任何人可伪造任意 uID token」这条 HIGH 债确已消除** ✓。另核：`/health` **200**（服务收尾健康）、**注册点 = 51**、**冻结面 0**、产物内 `eyJ` **0** ✓。
**它的读数（与我一致，采信）**：改前 live 复现（env 密钥 401 / 公开常量 200）→ 改后反转；**fail-fast 实证**（拷贝 `src/` 到产物目录、无 `SECRET_KEY` 启动 ⇒ **退出码 1** + `[FATAL] SECRET_KEY is not set…`；对照组注入真密钥 ⇒ 正常 `running on port 5798` 无 FATAL）；**分类器对拍 5/5**（`ConnectTimeoutError`/53300/08006/ECONNREFUSED ⇒ **503**；`08P01` 反例 ⇒ 500）；**受控实例 5799**（指向拒连 DB；`.env.local` 未动）真 token ⇒ **503**、公开常量 token ⇒ **401**；回归 16/16（`/api/user`/`/api/admin/me`/`/api/home`/`/api/prize/all`/`/health` 200 + **5 个 `410` 面仍 410**）；`tsc --noEmit = 0`；**零业务写**（`ledger_entry` = 0；`account` 4 行全 0/0/0；`currency` `total_supply=0`）；**收尾** `POST /api/restart {sid:'seafood-api'}` ⇒ `ok:true, running, pid 76603`、全站 **16/16**（未误停他服务）✓；401 逐条服务端日志归因（6 签名错 + 2 格式错 = 2 轮 ×(3+1)，`[auth.infra]` 生产日志 0 条）✓。
**照登的余留边界**：冻结分类器对「既无码也无码化子链」的裸错误仍判 500（本单只把真因 `sourceError`/`cause` 下沉喂它，**未改判据、未新增码** —— 正确，判据属 P3 冻结面）；`/api/home` 保持**匿名降级**而非 fail-closed（登记）；**预算 ~37/32 略超**（超支来自发现 Neon 真因挂在 `sourceError` 而加下沉逻辑并重测 ⇒ **我认账**，且这是好的超支）。

**B. Jing v0.2（`deleg_29d8e228` task-1，13 calls / 231.5s）** —— **验收通过**
`docs/route-layer.spec.md` **668 行 / 115905 B / md5 `0c587183a66ae39b597370acc08ac2fc`**；快照 `docs/versions/route-layer.spec.v0.2.md` **同 md5 + 我亲跑 `cmp` 逐字节相同** ✓；**v0.1 快照 md5 `be823001…` 未动**（我盘面复核）✓；审计件 `docs/audit/route-layer-v0.2-delta.md` **162 行**。**9 组 delta 逐条带锚点**：D1 路径改标×2（依据 `p4-b2a-http.md:74`、`p4-b2b…:71/120` + 我的 §5.74/§5.76/§5.77 裁定）｜D2 §1.2「批 2 不新增对外路径（注册点冻结 51）」｜**D3 §6.4 由 4 键改 6 键**（我抽检到落点 `:101`/`:240`/`:576`，且 `:576` 逐字引用「Zang §5.78 ⑤」）｜**D4 新增 §6.5 `isAdminAddress` 顺序依赖**｜**D5 新增 §3.4 401/403 统一 `R107` + 前端同步**｜**D6 §4.5 `ops:` 请求侧强校验 + 4 写口代价**｜**D7 新增 §2.4 批 4 前端同步清单 S1–S8**｜D8 §7-15/16 **标「待 Zang」未自选**（正确）｜D9 新增 §1.4 批 2 已落地事实 F1–F11 + §1.5 行号对照｜D10 §7 加**状态列**（**7-1..7-14 全部「已定」**，7-15/7-16 待我，7-17..7-21 待）。**它主动报「并发写者」**（P4-SEC 在改 `index.ts` ⇒ 行号会漂）并在 §1.5 写死「逐行断言前必须现取」口径 ✓ —— **这正是我 §5.7 的口径，做对了**。
**★ 我裁定 Jing 停在我处的两项**：**7-15（`DL38` 落点读法）** ⇒ **要求 Jing 在 v0.3 先给出 `DL38` 的原文落点 + 两种读法的实证差异（含各自在库/码上的后果），我据实择一**（我不在缺原文的情况下凭记忆裁定）；**7-16（`saveSystemSettings` 费率键黑名单=批 2c 自拟）** ⇒ **裁定：自拟黑名单不得当长期口径**；正解 = **优先从 `0017` 迁移既有约束/键集派生**（有依据），此前只作**防御性校验**并登记「待正式化」⇒ 交 Jing v0.3 二选一（派生 or 删除）**带依据**。两项**均已明确归属 Jing + 交付物**，不留在我桌上空转。

**⇒ 下一步**：**批 3（资金编排）** —— 按 §5.71「先契约后动钱」，开工前我必须先核 **v0.2 §7-3（`listing_deposit` 在 `HOLD_KINDS` 却不在 `-1` credit 白名单 + 全局无 currency 建/上市编排函数）** 的处置是否已「已定」且可执行；同时 **P4-SEC 之后所有探针/验收必须改用 `.env.local` 的密钥铸 token**（旧兜底常量已失效 —— 这个口径变化必须写进此后每一份 brief）。

---

### 5.78 **批 2c（权限与设置，非资金面）验收通过 —— ★ 我亲核「权限键单一真源」成立（后端 11 键 vs 前端 `admin-utils.js` **0 差异**）；★ 查明 2a/2b 报告「互相把 `assets/init` 推给对方」⇒ 2c 补 `410` 正确（非越界）；5 条裁定 + 新增纪律「跨片交接面必须由派单方指定归属」**（2026-09-30）

**交付（Kong · `deleg_7015f3a8`，42 calls / 768.5s，★ 预算 34/40 内 —— 首个不超支的单元）**：`src/database.ts` **+68**（6 处跨度替换：`listPersistedPermissionGroups`/`getPermissionsForUser` → `admin_role*` 三表 + 6 辅助方法；`resolveAdminAccess` 按 @§6.1 单一真源两分支并行；`listPermissionGroups` 撤 3 个内置合成组；`savePermissionGroup` → 单事务；`deletePermissionGroup` → 「无在用用户才可删」；`getSystemSettings`/`saveSystemSettings` 补 **`updated_by`**（旧实现必违约 `NOT NULL`）+ 显式 `public.`；`buildAdminAccess` +`hasRoleRow`，**返回键集不变**）；**新增** `src/admin-service.ts`（269 行 / sha256 `586e8900f62d918580654ffe6a89bc4786fe874c26f5354de94a8c37f6d2912d`；**`./ledger`/`./commission` import 我亲核 = 0**）；`src/index.ts` **+51**（13 处：`settings/reset ⇒ 410`、撤 `permissions` 的 `deprecated`、**401/403 → `R107`**（`AUTH_UNAUTHORIZED`/`AUTH_FORBIDDEN` + `reason`）、**`admin/assets/init ⇒ 410`**）；报告 `docs/audit/p4-b2c-admin-write.md`（**283 行 / sha256 `a9fbb810a666abada81abe306f2d8bdecb7ddbaa82993d7de0558cabd617a658`**）+ 产物 16 件 + 3 脚本。
**★ 我亲验（不采信报告）**：① **权限键单一真源成立** —— 后端 `ALL_ADMIN_PERMISSIONS` 11 键 vs 前端 `frontend/src/admin-utils.js` **逐键 0 差异**（后端键：`dashboard_access/manage_permissions/manage_points/manage_rewards/manage_settings/manage_tasks/manage_users/publish_prizes/publish_tasks/read_users/review_tasks`；前端每个恰好命中 1 次）✓ —— **我 §5.77 修正后的设计（代码侧常量当真源 + 对齐前端）实测成立**；② **非资金不变量成立** —— 我的探针：`users 6`（2a+2b+2c 各 +2）、`app_config 1`、**`admin_role*`/`admin_permission` 仍 0**（未插种子 ✓）、**`ledger_entry` 仍 = 0**、`account` 4、`currency` 1、触发器 43/非 `O` 0、基表 21/视图 1/函数 74 ✓；③ **注册点 = 51** ✓；④ **冻结面 0** ✓（`migrations`/`ledger-errors.ts`/`ledger.ts`/`commission.ts`/`frontend`/`.env.local`）；⑤ 越界 0、产物内 `eyJ` **0** ✓；⑥ 采信其键集冻结读数（5 mapper 三版本 `all_key_sets_equal:true`）+ 39/39 HTTP PASS（写→读回同值 `p4b2c:siteA`；admin 200 / 普通 **403 `NOT_ADMIN`** / 无 token **401**；回归 4 GET 全 200、`prize/:bID` miss 404、**5 个已落 `410` 面仍 410**）。
**★ 我亲查的「移交缺口」真相（不是采信，是查盘）**：`POST /api/admin/assets/init` 在 **2b 报告 §1.3 与 2a 报告同处都写着「归同批其它片」**（我 grep 到原文两处）⇒ **两片互相推给对方、无人执行**，实测首跑 500（`relation "asset" does not exist`）⇒ **2c 按 §5.1 补 `410` 是正确的**。**裁定 ①：批准，不算越界**（在 `src/index.ts` 允许面内；spec §5.1 要求 `410`；留着 500 会违背批 1「零 500」目标）。**★ 新纪律（已进技能）**：**批次内跨片交接面必须由派单方（我）显式指定归属**，且**每片收尾必须扫全量 spec §5 弃用面并报「本片认领哪些、其余归谁」** —— 否则「已转派」= 无人认领。
**★ 其余 4 条裁定**：
② **`ops:` 幂等键按 `DL36` 落为请求侧强校验**（表无键列、不落库）⇒ **批准**（fail-loud 优于静默重复写）；但**代价登记**：冻结的旧前端 3 页 4 个写口会 `400` ⇒ **列入批 4 前端同步项**（写进 Jing v0.2 §2 前端契约）。
③ **401/403 改 `R107` 是跨 51 端点的形状变化** ⇒ **批准**（统一 `R107` 由 §5.73 裁定）；**代价登记**：`frontend/src/auth.js:105` + 四语 locale 需同步 ⇒ 同上列入**批 4 前端同步项**（v0.2 §2）。
④ **`isAdminAddress` 第三真源（§1.3-6）本片未改 = 正确** —— 它的收敛**必须与批 6 权限种子同批**，否则会当场锁死运营管理员（收敛所需的库写正是本片被禁的）⇒ **批准其登记**，并要求 **v0.2 显式记录这条顺序依赖**（「先有种子，再收敛第三真源」）。
⑤ `/api/admin/me` **保留 6 键**（未改成 §6.4 的 4 键形状）⇒ **批准**（键集冻结优先于 spec 描述），**要求 v0.2 把 §6.4 更正为 6 键**（改规格、不改码）。
**⇒ Jing v0.2 的 delta 清单（现 8+ 条）**：3 条路径改标（`/api/job/{apply,accept}`、`POST /api/listing` ⇒ 服务层已实现、路由层随批 4）＋ `/api/admin/me` 6 键更正 ＋ `isAdminAddress` 顺序依赖 ＋ `DL38` 落点读法 ＋ 费率键黑名单（自拟 ⇒ 正式化或改标）＋ 批 4 前端同步项（`ops:` 强校验 4 写口 + `R107` 401/403 + locale）＋ 我 13 项终审。
**照登**：`NOT_MEASURED`（因**禁写种子**而结构性不可测）：权限写口成功落行（`admin_permission` 0 行 + FK ⇒ 只到 404）、`delete` 的 `deleted`/`in_use` 两支、自锁守卫触发支、`admin_user_role` 那支的 `can_access_admin`、`updated_by` 无 FK 的语义面、并发面 ⇒ **这批面在批 6 权限种子迁移落地后必须补测**（⇒ 批 6 = 权限种子迁移 + `isAdminAddress` 收敛 + 上述面实测，一条线收口）；探针只 `INSERT`/`SELECT`、无删除型 SQL、未 `git`、重启 2 次只走面板 `{sid}` ✓。
**★ 批 2（2a/2a-HTTP/2b/2c）正式收官** ⇒ 下一步：**P4-SEC（安全与配置闸）** → **Jing v0.2** → **批 3（资金编排，先契约后动钱）** → **批 6（权限种子迁移）**。

---

### 5.77 **批 2b（商品 listing 非资金写入）验收通过 —— ★ 我亲验非资金不变量（`listing` +12 为唯一新增写面，`ledger_entry` 仍 0、`account`/`currency` 不变）；注册点 51/冻结面 0/泄漏 0；裁定一处 spec 偏差；★ 修正我自己 7-8 的裁定（权限种子不写库，改用代码侧常量真源）**（2026-09-29）

**交付（Kong · `deleg_1fcb1a6d`，46 calls / 1315.3s）**：**新增** `src/listing-service.ts`（311 行 / sha256 `f862eb3c8333e2fac221aeac840d807123c25f9fb424d90f2d0f2be6380e4ffe`；**零账本 import** ✓）；`src/database.ts` +4 方法（单语句 CTE + `FOR UPDATE`）；`src/index.ts` 5 处 **`410`**（含 `sunset` 登记）；报告 `docs/audit/p4-b2b-listing-write.md`（**271 行 / sha256 `b2cedba0fa50df93dafde0a188ab10d4f0bcc3675ca5e65d032ffd5f83d48e68`**）+ artifact `b2b-20260929T215723/**` + 3 个补丁/探针脚本。
**★ 我亲验（不采信报告）**：① **非资金不变量成立** —— 我自己的探针：新增写面**只有** `listing`(+12)、`users`(+2)、`job`/`job_application`/`job_submission`(+1 各)；**`ledger_entry` 仍 = 0**、`account` = 4（Σ0/Σ0）、`currency` = 1、`referral` = 0、触发器 43/非 `O` 0、注册表 17/17 ✓；② **注册点 = 51**（未新增对外路径）✓；③ **冻结面 0 改动**（`migrations`/`ledger-errors.ts`/`ledger.ts`/`commission.ts`/`frontend`/`.env.local`）✓；④ 越界 0、产物内 `eyJ` 泄漏 **0** ✓；⑤ 它的 **key 集冻结**读数采信（`normalizeBrand` 43/43/43、`normalizePrizeItem` 6/6/6、`all_key_sets_equal:true`；**其自曝**：合成夹具行 43 键 vs 真实行 45 键，用途仅「三口径相等」—— 我认这个口径）。
**⚠️ 我未独立复测的一项（如实登记）**：我原计划**亲自复测 5 个 `410` 面**（`admin/prize/{create,update,delete}`、`shard/redeem`、`chest/:bID/open`），但那条命令被**安全层拦下（内含 `-X POST`，未获用户确认）** ⇒ **按规则我不重试、不换法重试同一目的**。因此该面当前只有**单元读数**（无 token/有 token 均 `410` + `R107` 形状 + `sunset`，HTTP 26 条含回归 `prize/all`·`home`·`task/all`·`market` 全 200、`prize/:bID` miss 404、`POST /api/listing` 404 兜底、HTTP 级幂等重投 `idempotent_replay:true`）。**登记为「待补测」**（下次我在有授权时或交由 Neng 独立质检补）。
**★ 我的裁定（1 条 spec 偏差，与 2a 同构）**：spec **§1.1:130 把 `POST /api/listing` 标为「批 2」**，而我的硬口径要求「注册点须仍为 51」⇒ 单元**取 §1.2 + 2a 先例**（服务层已交付、路由层随批 4），**并未自选**✓。**裁定：批准**（理由同 `/api/job/*`：前端零调用 + 51 冻结口径）。**⇒ Jing v0.2 的改标清单现为 3 条**：`/api/job/:jobId/{apply,accept}`、`POST /api/listing`（均改标「服务层已实现、路由层随批 4」）。
**★ 我修正自己 §5.73 的 7-8 裁定（重要）**：我原写「`admin_permission` 表 0 行 ⇒ 批 2 须补种子」——**这条会破坏「重置键」设计**（种子若只存于当前库态，一旦用重建脚本重置回 `0001..0017` 声明基线，权限种子就**消失**，admin 面随即失效）。**改为**：**权限键的真源放在代码侧**（`src/database.ts` 已有的 `ALL_ADMIN_PERMISSIONS` 常量）＋ **对齐前端 `admin-utils.js` 的权限位**；`admin_permission` 表的种子**留到批 6（数据层补遗，须走迁移/Jing 规格）**，本批**不写库种子**。⇒ 该修正同时写进 2c 的 brief。
**照登（采信其自曝）**：`title` 非空校验**未做**（因其需新错误码，**不自创码** = 正确行为；登记待裁）；「创建指纹排除可变列（`stock`/`status`）」的可重构口径登记；**`NOT_MEASURED` 10 项**（商品写路径的 HTTP 业务分支（未注册）、币种闸 `draft/frozen/delisted` 三支（库内仅 `listed`，禁改 `currency`）、`media_urls` 落库值、`delisted` 上的 stock 编辑、并发竞态、`listing_order` 全柱（批 3）等）；**预算 ~50 calls（超 35）** —— **我认账**（brief 预算偏紧 + 连通性抖动重测）；探针自曝 3 条（Neon 抖动使 leg1 作废、`$3` 定型缺陷已修、`require` 相对路径缺陷已修）。

**已派批 2c（Kong · `deleg_…`）= 权限与设置（非资金面）**：spec 驱动、先落端点清单；`/api/admin/permissions*`（`admin_role*` 面）+ `/api/admin/settings*`（`app_config`）+ `/api/admin/me`/`user/update`/`user/all`/`user/stats` 按 spec §1 处置；**权限键真源 = 代码常量（对齐前端 `admin-utils.js`）**，**禁写 DB 种子**；非资金不变量 + 键集冻结 + 注册点 51 + 冻结面零触碰 + 禁删。

---

### 5.76 **批 2a-HTTP 验收通过 —— ★ 我亲做「双密钥对照」独立确认鉴权面已解锁（兜底常量 ⇒ 200/200、env 密钥 ⇒ 401）+ 批 2a 的 HTTP 写分支闭合（submit 端到端 + 幂等 replay）+ 非资金不变量复验；登记 3 项（含 HIGH 安全债）**（2026-09-29）

**交付（Kong · `deleg_d92c4508`，28 calls / 773.4s）**：改 `backend-ts/src/database.ts`（**7 处 `users` 旧列名 → 真列**：`normalizeUser` 回退键 / `getNextUserId` / `getAllUsers` 排序 / `uID` 谓词 ×3 / `getUserByEvm`（走 `idx_users_evm_lower`）/ `createUserByEvm` INSERT；**残留旧列 grep = 0**）；新增 `docs/audit/p4-b2a-http.md`（**148 行 / sha256 `fa92dcf5ac538f4d1c67b26206520e230dafc99ff0ad89e3bcf677ed212d5981`**）+ `.p4-artifacts/b2ahttp-20260929T133731/**` + 3 个探针脚本。
**★★ 我的独立复核（不采信报告）**：① **双密钥对照**（我自建 `zang-auth-probe2.js`）：`env(.env.local) SECRET_KEY` ⇒ **401**；**`auth.ts:3` 兜底常量 ⇒ `/api/user` 200 / `/api/task-progress` 200**；无 token ⇒ 401；错签名 ⇒ 401 ⇒ **鉴权面确已解锁，且「服务端生效密钥 = 兜底常量」经我实测确认**（修复列名后，之前被吞成 401 的鉴权路径已能走通）✓；② 越界核：仅 `database.ts` 被改 + 4 个新文件，**冻结面 0 改动**（含 `.env.local` 未被单元触碰）✓；③ 泄漏核：产物 + 报告内 `eyJ` **0 命中**、兜底常量字面**0 文件** ✓；④ 面板日志：`column u.uID does not exist` **归零** ✓（同窗口仍有 `UND_ERR_CONNECT_TIMEOUT` 抖动 = 既有 A 档债务）。
**它自己的读数（与我一致，采信）**：`GET /api/user` 无 token 401 / 有 token **200**，响应键集 `[uID,EVM,bio,is_admin,time_reg,time_login_last,points,requires_profile_completion]` **不变** ✓；`/api/admin/me` 200（仅 `requireActor`，不判 admin）；**J4 submit 端到端**：首投 **200 inserted**（`job_submission 0→1`、`review_status='pending'`、`job 3→submitted`）→ **同键重投 200 `idempotent_replay:true` 且不多一行** ✓；他人申请 **403**、未知 id **404**、`status='applied'` ⇒ **409 `JOB_APPLICATION_STATE_INVALID`**；**非资金不变量**：`ledger_entry` **0→0**、`account` 4 行/`Σbalance=0`/`Σfrozen=0` 不变（dump hash `7516d8c6…`）✓；`tsc --noEmit = 0`、注册点仍 **51** ✓。
**★ 我的裁定（1 条口径偏差）**：`POST /api/job/:jobId/{apply,accept}` 实测 **404 = 路径未注册**（spec §1:125-126 把它们列为批 2 目标），与我 §5.74 的裁定（「前端 49 路径里没有 `/api/job/*` ⇒ 对外路径随批 4 注册」）**存在偏差**。**裁定：偏差成立（以我的裁定为准）** —— 理由：前端零调用 + 注册即破坏「注册点 51」冻结口径；**要求 Jing 在 spec v0.2 里把这两条改标为「服务层已实现、路由层随批 4 注册」**（已登记为待办，与其余 13 项终审一并进 v0.2）。同时**把该偏差写入批 2b/2c 的 brief**（避免它们照 spec 盲目注册）。
**★ 登记 3 项（未修）**：① **★ HIGH 安全债**：`auth.ts:3` 硬编码兜底签名密钥 + `dotenv` 加载顺序 ⇒ **任何人可用公开常量伪造任意 uID 的会话 token**（本单正是这样在无钱包签名下拿到 200）⇒ **列为上线前硬闸**（修法：先 `import './env'` 再导其它模块 / 缺失即 fail-fast / 移除兜底），归 **P4-SEC（安全与配置闸）**；② **`resolveActor` 把一切异常吞成 401**（实测 Neon `ConnectTimeoutError` 抖动会让**合法 token** 也 401）⇒ 判读纪律已进技能 §26，**修法待 P4-SEC**；③ `NOT_MEASURED`：apply/accept 的 HTTP 业务分支、`users` 行数 before、`job` 命名台账、account dump hash 的 before 值、settle/并发面（照登）。
**它的过程自曝（采信）**：首次「15s 超时」先怀疑 service 死循环 → 读码证否 → 复测得 **409**（真因 Neon 抖动）；两处 `node -e` 引号自伤（探针缺陷，未污染读数）；**预算 ~38 calls（超 30）** —— 超支来自连通性抖动重测与泄漏自检返工（**我认账**）。

**已派批 2b（Kong · `deleg_…`）= 商品（listing）非资金面**：spec 驱动、**先落端点清单再动代码**、**禁碰资金**（下单/购买 `listing_post_event` 整条归批 3）、**不注册 `/api/job/*`（按我 §5.74 裁定）**、命名台账 + 非资金不变量（`ledger_entry` 增量 = 0）+ 键集冻结 + `tsc` 0 + 禁删。

---

### 5.75 **★ 更正 §5.74 的阻塞定性（我的误判，证据来自面板日志）+ 锁定真根因：`getUserById`/`getUserByEvm` 仍用 `u."uID"` 旧列名 ⇒ 鉴权路径 DB 报错 ⇒ 一律 401；并登记「批 1 的『零 500』掩盖了这条缺陷」+ 派单修它**（2026-09-29）

**★ 我的误判与更正（如实记）**：§5.74 我写「`.env.local` 缺 `SECRET_KEY` ⇒ 全部鉴权面 HTTP 不可用」——**错**。证据链（**面板日志 `GET :5555/api/logs/seafood-api` 实锤**）：
- **20:28–20:44（批 2a 运行期）**：`Failed to resolve actor: NeonDbError: **column u.uID does not exist**`，栈 = `Function.getUserById` ⇒ **真根因是 `users` 字段映射未做**（新表列 `uid`，代码查 `u."uID"`）⇒ 鉴权在 DB 层抛错被 `resolveActor` 的 catch 吞掉 ⇒ **一律 401**。
- **21:29（我写 `SECRET_KEY` 并重启后重测）**：`Failed to resolve actor: Error: **Invalid token signature**` ⇒ **我加的 `SECRET_KEY` 无效**：`src/auth.ts:3` = `const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-here'`（**有硬编码兜底**），且**模块加载顺序**使 `auth.ts` 在 `dotenv.config()` 之前取值 ⇒ 服务端**始终用兜底值**，`.env.local` 里的新键**不生效**。（我按 `.env.local` 铸 token ⇒ 与服务端密钥不一致 ⇒ 签名不匹配 ✓ 自洽。）
**★ 由此暴露的一条**验收口径教训（已进纪律）**：「**401 不是「正常鉴权」的同义词** —— 本仓 `resolveActor` 把所有异常吞成 401（DB 列错、签名错、用户不存在同形）⇒ **批 1 的判据「GET 端点零 500」为真，但掩盖了鉴权路径的 DB 缺陷**；今后凡 401 **必须同时核服务端日志**（有无 `Failed to resolve actor` 的 DB 错），不得只看状态码。**这正是「症状不是成因」+「检查通过前先确认该检查覆盖了被改路径」两条纪律的实例。**
**★ 处置**：① `SECRET_KEY` **保留在 `.env.local`**（无害，且一旦修好加载顺序/兜底它就是应有的配置），但**登记当前不透支效果**；**安全债务登记**：硬编码兜底签名密钥必须在上线前移除（缺失时应 fail-fast），并修 `dotenv` 加载顺序（`Kong` 的批 6/上线准备项）。② **派单修「鉴权路径 `users` 映射」**（见下方），并在同一单内**闭合批 2a 的 HTTP 写分支**（因为它才是 `NOT_MEASURED` 的主因）。③ §5.74 的「环境级阻塞」表述**作废**，以本节为准。

**已派 Unit P4-B2a-HTTP（Kong · `deleg_…`）**：① 修 `getUserById`/`getUserByEvm`（及必要的 `resolveAdminAccess`）的 `users` 列名映射 —— 旧 `u."uID"`/`u."EVM"`/`u."bio"`/`u."is_admin"`/`u."time_reg"` → 新 `uid`/`evm`/`bio`/`is_admin`/`time_reg`/`time_login_last`（**列名先取 `information_schema` 真值**），**且 mapper 的响应键集不得变**（代码消费 `user.EVM`、`user.uID` 等大写键 ⇒ 键集冻结）；② 用**按 `auth.ts` 逐字复刻、密钥取服务端实际生效值（= 兜底 `'your-secret-key-here'`，并**先实验确认**服务端密钥，不得假设）**铸出的 token，端到端验 `GET /api/user` ⇒ **200**、`GET /api/task-progress` ⇒ 200、`resolveAdminAccess` 面 ⇒ 200/403；③ **闭合批 2a 的 HTTP 写分支**：`POST /api/task-progress/:identifier/submit`、apply/accept 类端点带 token 的 status + **幂等重投**；④ 全程命名台账 + before/after 逐表计数差 + **非资金不变量**（`ledger_entry` 增量必须 0、`account` 不变）；⑤ 登记（不修）：`SECRET_KEY` 兜底 + `dotenv` 加载顺序缺陷；⑥ `tsc` 0、冻结面零触碰、禁删、禁跑写库套件。

---

### 5.74 **批 2a（招工非资金写入与状态机）验收通过 —— ★ 我亲验「非资金不变量」成立（新增行只有 `users/job/job_application`，`ledger_entry` 为 0、`account`/`currency` 逐行不变）；404/410 语义到位；★ 并发现**真阻塞：环境缺 `SECRET_KEY` ⇒ 全部鉴权面（含所有写路径）在 HTTP 层不可用**（2026-09-29）

**交付（Kong · `deleg_390acd0f`，52 calls / 5030.2s）**：**新增** `backend-ts/src/job-service.ts`（239 行 / sha256 `37e30f31ebc6c0394d464237f486ff1f95f35716987724437cb0cab3a7859d9a`；**`grep -c "from './ledger'|from './commission'"` = 0/0 ⇒ 零账本路径** ✓）；`src/database.ts` **+232**（4 个静态方法：`resolveJobApplication`/`submitJobWork`/`applyToJob`/`acceptJobApplication`，单语句 CTE + 显式 `public.`）；`src/index.ts` ±103（submit 改接 `job_submission` + `job.status→submitted`；`GET /api/task/:tID` miss ⇒ **404**；`/api/admin/task/{create,update,delete}` ⇒ **410 `R107` 形**）；报告 `docs/audit/p4-b2a-job-write.md`（**213 行 / sha256 `aed01854023b2a41c0aa7360683ea07a08b7010af514167a7c2836cae0b7d1a6`**）+ 探针 `scripts/p4z-b2a-01-fixture.ts` + 产物 `.p4-artifacts/b2a-20260929T193900/**`（7 件）。
**★ 我亲验（不采信报告）**：① **非资金不变量（本片最重要的判据）成立** —— 我自己的探针取数：新增行**只有** `users 2`（uid `970001/970002`）/`job 2`（`tID 2,3` = `p4b2:fixture:A/B`）/`job_application 2`，而 **`ledger_entry = 0`**、`account = 4`（4 行逐值 `balance=0/frozen=0` 且仅平台 `0/-1/-2/-3`）、`currency = 1`（`$` supply 0）、`referral = 0`；`job_submission = 0`；触发器 43/非 `O` 0；注册表 **17/17 逐字节相等** ✓（**注**：我探针的 `residue_zero_ok:false` 属**预期** —— job/job_application 正是本批夹具，**不是失败**；口径已写在 §5.71「接受残差」）；② 端点：`/api/task/999999999` ⇒ **404**（miss 语义，spec §3 ✓）、`/api/task/3` ⇒ **200**（真实行 `p4b2:fixture:B` ⇒ 我核实后确认**不是** 404/200 不一致的缺陷）、`/api/admin/task/{create,update,delete}` ⇒ **410 ×3** ✓、`/api/home`/`/api/task/all`/`/health` ⇒ 200（无回归）✓；③ **端点注册点仍 51**（未新增对外路径，符合其 §1.2 取舍）✓；④ 冻结面（`migrations/**`、`ledger-errors.ts`、`ledger.ts`、`commission.ts`、`frontend/**`）**0 改动** ✓；⑤ 写语义（service 直调 10 条）：apply 200、**同键重投 200 replay**（幂等 ✓）、异键同人/重复 accept/自投/坏键 ⇒ **409/409/409/400**、非雇主 accept ⇒ **403 ACTOR_NOT_ALLOWED**、未知 id ⇒ 404 ✓；⑥ `tsc --noEmit = 0` ✓。
**★ 我的裁定（3 条）**：① **批准其 §1.2 取舍**（不注册 `/api/job/:jobId/*` 对外路径）—— 我亲盘的前端 49 条路径里**没有** `/api/job/*`；对外新路径随**批 4 前端迁移**一起上；② **批准 `claim`(:505) 不动**（其唯一既有语义 = `upsertAsset` 直写发放 ⇒ 按 R4 整条归批 3，正确）；③ **批准其对「`R107` 错误体 vs §2 键集冻结」的解释**（成功分支键集逐字冻结、错误分支统一 `R107` 体，与 spec §3 一致）。
**★★ 我发现的真阻塞（环境级，非本单缺陷）**：**`backend-ts/.env.local` 中没有 `SECRET_KEY`**（`grep -c` = 0；面板 env 只有 `PORT`），而 `src/auth.ts:3` 在**模块加载期**读取它 ⇒ **签名/验签密钥缺失 ⇒ 全部鉴权面（含所有写路径）在 HTTP 层不可用**（本单的 submit/claim 实测 **401**；它按 `auth.ts` 逐字复刻签名铸 token 仍 401 ⇒ 根因是**服务端**没有密钥）。⇒ 它**未越界改服务环境**（正确行为），登记为 `NOT_MEASURED`。**我的裁定**：这是**产品级阻塞**（前端也登不上、任何写操作都不可用），不是测试瑕疵 ⇒ **已问 Kevin 一句话授权**（我加一个随机 dev `SECRET_KEY` 进 `.env.local` + 面板单服务重启 vs 他自己设 vs 暂不设）；**在他表态前，HTTP 写分支一律按 `NOT_MEASURED` 记账**（service 层直调读数**不能**当作 HTTP 面证据）。
**其它照登**：其**预算自曝 ~60 calls（超 25）**，主因 = 探针口径自查（LIKE 假零、`-X POST` 漏写、`ledger_event_keys` 假设不成立、`job` 计数 transient null）+ 认证阻塞定位 ⇒ **我认账**（brief 预算给得偏紧 + 认证不可用的连带探索）；期间 **DB 链路抖动 2 次 `/health` 503**（既有连接层债务 A 档，已在 §5.64 后登记）；**无删除型 SQL、无分录动作、无 `git`、未 `pkill`** ✓；命名台账 `cli:p4b2:job:A|B` / `cli:p4b2:app:A2|B2` / uid `970001/970002`（bio 带 `p4b2`）。

---

### 5.73 **P4-SPEC 验收（Jing）`docs/route-layer.spec.md` v0.1 + ★ 我对其 13 项未决的终审（全文批准其倾向，其中 7-3 由我给出可执行裁定、7-11 更正为「早已闭合」）+ 批 2a 已派**（2026-09-29）

**交付（Jing · `deleg_63a7b784`，23 calls / 367.1s）**：`docs/route-layer.spec.md` **498 行 / 80839 B / sha256 `6f27b4add4b79da36602f20ba93f6edd2d93dcdc4d9164c00293909a697b5018`**；快照 `docs/versions/route-layer.spec.v0.1.md` **同 sha（逐字节相同）**；边界 = `git status` 仅这 2 个新文件、仓库其余零改动 ✓。**八节**：§0 口径/权威输入 → §1 **51 端点逐条处置**（live 行号，已登记与 inventory 的改动前行号漂移）+ **18 条新增端点** + 404 兜底 → §2 **前端契约冻结**（逐端点 key 集来源 mapper + 23 文件消费清单 + **「前端消费但后端没有的路径 = 0」**）→ §3 detail-miss 统一 `404`（撤销 B1-b 的 200 空态）+ 逐码条件（对齐 `DL126`）+ `R107` 七条 → §4 **资金编排契约**（R1–R7 硬口径 + 7 个关闭集 + **18 个业务事件**的「端点→编排函数→kind→必需字段→幂等键→失败/回滚→期望码」+ **资金四栏**（谁出钱/谁收钱/平台费来源/佣金分配）+ 幂等键总表 + 批 2/批 3 切分）→ §5 **弃用面最终处置**（13 面统一 `410` + `R107` 形状 + 过期日；**`/api/prize-item` 保留并正式化、撤 `deprecated`**；碎片读口空态/写口 `410`）→ §6 权限单一真源 `can_access_admin` + 5 步判定 + 3 个守门函数 → §7 未决 13 项 → §8 变更记录 + 8 项 `NOT_MEASURED` + 3 条自曝。
**★ 它的关键裁定（我全文批准）**：① detail-miss **一律 404**；② **「审核通过→发放」必须原子** ⇒ `approve`/`review` 面**整条归批 3**，**批 2 不得半实现**（防静默欠款）；③ `422` 不启用；④ 13 个弃用面统一 `410` + 登记过期日（`DL35`）；⑤ `/api/prize-item` **≠** 碎片四件套，保留正式化。

**★ 我对 §7 十三项未决的终审（逐条）**：
| # | 我的裁定 |
|---|---|
| 7-1 | **批准**：批 2/批 3 **保留既有路径**；批 4 在前端迁移验收后切换。**过期日口径我定死**：13 个 `410` 面的过期日 = **批 4 前端迁移验收通过之日**，且**每批复核必须点名**（禁止无限期 410） |
| 7-2 | **批准**：批 2 `/api/user` **保持现有键集**（前端契约优先）；`DL24` 的「集合形状 + 禁裸数字」由**新增 `/api/user/points`** 满足；**登记**「`DL24` 履约时点 = 批 4（前端切新形状时）」——**不得静默丢弃** |
| 7-3 | ★ **我给出可执行裁定（无需新迁移）**：「上市」拆分表达 —— **上市费 = `currency_create_fee` → 平台 `-1`**（已在白名单，满足「消耗」语义）；**保证金 = `listing_deposit`（`HOLD_KINDS` 内）纯冻结、可退（`hold_release`）**；**违约罚没 = `hold_forfeit` → 罚没账户 `-3`**（`-3` 白名单含它）。⇒ 现有 kind 闭集 + 白名单**足以表达**，**禁止新增 kind / 禁改白名单 / 不开 `0018`**；批 3 实现前**必须**用对拍先验证这条组合可行，发现不可行 ⇒ 回头找我，不得自行扩白名单 |
| 7-4 | **批准**：批 3 **不得发明撮合**；成交必须由显式输入给出 5 个字段；**成交价 = 买单限价**（否则拒）；撮合服务属 **P5**，本批不实现（登记） |
| 7-5 | **批准**：`DELETE /api/order` 保留路径、入参改 **query**（后端不再读 body）；前端 `ShardPage.jsx:328-329` 同步改造（登记为前端改造项） |
| 7-6 | **批准**：`/api/admin/task/*`、`/api/admin/prize/*` 的 **`410` 随批 2 生效**（用户需求明文「管理员不再在后台发布 task/reward」）；后台页面**只读化**（不整页删）；**仲裁面 `/api/admin/arbitration/*` 排 P6** |
| 7-7 | **批准「不发明、不回滚 `stock`」**，但列为**需 Kevin 一句话**的产品项（默认不回滚）；批 3 前若他未表态 ⇒ 按不回滚实现并登记 |
| 7-8 | **批准**：批 2 先落**权限最小集**（`review_tasks`/`manage_permissions`/`manage_settings`/`finance`）并**必须与前端 `admin-utils.js` 现有权限位对齐**；`admin_permission` 表 0 行 ⇒ 批 2 须补种子（属数据面，走 Kong 的实现单，不改迁移） |
| 7-9 | **批准**：`422` 不启用（与 33 码闭集一致） |
| 7-10 | **批准**：`time_claimed`/`points_claimed` 恒 `NULL`/`0` 保留至批 4；归还语义由 `/api/job/:jobId/review` 结算事件承载 |
| 7-11 | ★ **我修正**：`DL155` **早已闭合**（`src/db.ts` 的 `getSchemaVersion` 已加 `public.` 限定，入库 `3b8e379`）—— Jing 的依据是数据层 spec 里「由下一接路由的单一并处理」的**过时注**。⇒ 批 2 只需把「**裸表名扫描**」纳入验收判据防回归，**不需要再改代码** |
| 7-12 | **批准**：批 2/批 3 只保证 **`i18n_key` 契约**（`R107` 四件套），文案暂 zh-only；四语文案属 **P7** 前端呈现层 |
| 7-13 | **批准**：`claim` 拆为 `apply`（无分录）/`accept`（无分录）/`settle`（有分录，随 `approve`）；**旧路径批 4 前保留**；批 2 只做 `apply`/`accept` |

**★ 已派批 2a（Kong · `deleg_…`）= 招工非资金写入与状态机**：以 `docs/route-layer.spec.md` v0.1 的 **§1 处置表 + §4「批 2」切分 + §3 错误语义**为唯一依据；**先落盘「本批端点清单（从 spec 抽取）+ 逐条处置」再动代码**，清单与 spec 冲突即停下问我；**禁碰资金**（`approve`/`settle` 整条不做）；首次真写库 ⇒ **必须产出命名空间台账**（夹具 uid/cid/`create_key` 前缀 + before/after 逐表计数差），**禁删**（append-only），**禁跑写库套件**；细节见派单。

---

### 5.71 **批 2 推进裁定（两问表单超时 ⇒ 按推荐项推进，**一句话可改**）+ ★ 关键追加裁定：**先由 Jing 钉「路由层 + 资金编排契约」，批 2/3 一律以契约为准**；并登记「残差可接受、重置键 = 已验收的重建脚本」**（2026-09-29）

**超时两问的默认取值（一句话可改）**：① **detail-miss 语义统一为 `404`**（含把 `/api/task/:tID` 从 200 空态改回 404；`/api/prize/:bID` 已是 404 ⇒ 改后一致）；② 批 2 顺序 = **2a 招工 → 2b 商品 → 2c 权限/设置**。
**★ 我追加的关键裁定（理由充分，不等人）**：**批 2 只做「非资金」写入与状态机**；**一切资金动作**（招工托管/发放、商品购买、交易所成交/手续费、10 级返佣、上市保证金）**一律推迟到批 3，且批 3 开工前必须先有契约**。理由：**「资金路径半实现」是最危险的形态** —— 例如「审核通过」若只改状态不发放，就是**静默欠款**（比 500 更难发现）；反之若直接写 `account` 又绕开账本不变式（Σ闸、幂等、append-only）。⇒ 本批不碰资金字段/不从直改 `account` 出发。
**已派 Jing（Specifier）= `docs/route-layer.spec.md` v0.1**：唯一权威输入 = `docs/data-layer.spec.md`（v0.6）+ `docs/ledger.spec.md`（R107/R108）+ `migrations/0001..0017`（含四个编排函数 `ledger_post_event`/`job_post_event`/`listing_post_event`/`market_post_event`）+ 上游 `docs/audit/p4-route-inventory.md` + `docs/audit/p4-b1-get-triage.md` + **用户原始需求逐字**（招工=悬赏积分、商品=积分标价售出、管理员转为搭平台不发布、积分交易所（$ 为基币、实时兑换、走势、自定义积分上市需保证金、成交收平台费）、邀请终身绑定 + 打工酬金 1%–5% 平台费转佣金 + **10 级**返佣 + 权重随时间后台可设、`dashJ` = 可流通积分单位之一、标题硬编码 + 四语、UI 仿闲鱼）。**规格必须含**：51 端点处置表（保留改接新 schema / 改语义 / 弃用下线 / 新增，逐条给目标表字段映射依据与 `文件:行号`）＋ **保留前端契约**（响应 key 集不得变，逐端点指出 key 来源）＋ detail-miss 统一口径 ＋ **资金编排契约**（每个业务事件 → 用哪个编排函数、kind 闭集、必需字段、幂等键、失败/回滚语义）＋ 弃用面最终处置（碎片四件套 + `prize-item` + `auth/register|login`，含前端同步要求）＋ 权限单一真源（`users.is_admin` vs `admin_role*`）＋ 未决项清单 ＋ 变更记录 v0.1。**边界**：只写 `docs/route-layer.spec.md`（可新建 `docs/versions/` 快照），**禁改代码/库/配置**，推定必须标「推断」并给依据。
**★ 残差与「重置键」（重要口径变更）**：本库有 **append-only / no_delete 禁删触发器** ⇒ 批 2 一旦真写库，**残差无法删除**（这正是 D20 之所以要整库重建的原因）。**裁定**：**接受残差**（但每批必须产出**命名空间清单**：夹具 uid/cid 前缀、create_key 前缀），并在批末与任何上线动作前用**已验收的重建脚本**一键重置 —— `backend-ts/scripts/p3x-00-rebuild-replay.ts --apply --confirm-irreversible`（闸已装 + 三段判负实测 + 真跑一次已验收、库现为 seed 基线）⇒ **我们首次拥有「可重复重置键」**，因此写测试不再需要「零残差」洁癖，**但「重置」本身必须由我（Zang）执行并留痕**，不得由子代理自行触发。

---

### 5.70 **★ P4 批 1（GET 面止血）完成验收 —— 我亲跑终扫荡：**17 个 GET 端点零 500**（原 `500×9`）、`/api/home` 200 且 key 集完整；四片全程**零写库**（我自建探针 3 次读数逐值一致）；A 类残留全在写侧函数；两处语义变更待裁**（2026-09-29）

**四片交付（Kong，含两次基础设施中断后重派）**：
| 片 | 范围 | run tag | 关键读数 |
|---|---|---|---|
| **B1-a** | `asset` 读侧 → `account`(cid=1) | `b1a-20260929T135443` | `/api/user/asset/1` 500→**200**（key 集 `{index_id,uID,points,lucks,time_update}`）；GET 隐式写回退删除（零写） |
| **B1-b** | `task`→`job`、`task_progress`→`job_application`+`job_submission`（6 个读函数） | `b1b-20260929T143421` | `/api/task/all` 500→**200**、`/api/task/1` 500→**200** 空态、`/api/task-progress/1` 500→**404** |
| **B1-c** | `prize`→`listing`、`prize_item`/`shard*`→空态弃用、`permission_group`→空态 | `b1c-20260929T151415` | **`/api/home` 500→200**（批 1 主锚点）、`/api/prize/all` 500→**200** |
| **B1-d**（补漏） | `market_order`/`market_trade` **列名**重写（`bID→base_cid`、`volume*→amount*`、`oID→order_id`） | `b1d-20260929T181702` | `/api/market/1/orderbook`+`/trades` 500→**200**（根因 42703 非缺表） |

**★★ 我的终验收（三路亲取，不采信报告）**：① **17 个 GET 全表扫荡零 500** —— `/`·`/health`·`/api/test/data`·**`/api/home`**·`/api/prize/all`·`/api/task/all`·`/api/task/1`·`/api/user/asset/1`·**`/api/market/1/orderbook`**·**`/api/market/1/trades`** = **200**；`/api/prize/1`·`/api/task-progress/1` = **404**（非 500）；`/api/prize-item`·`/api/task-progress`·`/api/shard`·`/api/shard/transfer`·`/api/order` = **401**（需鉴权，非 500）——**原 `500×9` 清零**；`/api/home` 响应体 key 集完整 `{tasks,prizes,claimed_prize_ids,user_points,is_authenticated}` ✓；② **零写库由我自建探针证明**：重建后基线在 `050655Z`/`061321Z`/`065656Z`/`102300Z` **四次读数逐值一致**（`users 0`/`account 4`/`currency 1`/`ledger_entry 0`/触发器 43・非 `O` 0/注册表 checksum 17/17/`cid` next=4）⇒ 四片全部 GET 扫荡 + 4 次面板重启**全程零写库**；③ **A 类双口径残留只在写侧/死代码函数**（`zang-a-class-scan` 脚本化，以函数归属）：`task_progress` 8、`prize_item` 6、`task` 4、`prize` 4、`asset` 3、`permission_group` 3、`shard` 2、`shard_transfer` 1 ⇒ 属批 2/批 3；**GET 路径已归零**；④ 冻结面零触碰（`migrations/**`、`src/ledger-errors.ts`、`src/ledger.ts`、`src/commission.ts`、`frontend/**` 全 0 改动）；`tsc --noEmit` 四片均 **0**；报告 `docs/audit/p4-b1-get-triage.md` **750 行 / 14 节 / sha256 `f8c356e53fa097bca14440810bfea1c4dbdff90f1db292dcb10ec1f6ce85af2d`**，四片均 **append-only**（0 删行）。

**★ 我自己的两处失误（如实登记）**：① **「A 类 8 名已归零」是我读错的假 0** —— 我的 shell 循环把正则写进**单引号**，`$n` 未展开、`$` 被当成行尾锚 ⇒ 八个名字全报 0；改用**脚本化双口径扫描**后得到真值（`prize_item 14`/`shard 8`/`task_progress 8`…）并据此切出 B1-c 的真实范围。**纪律**：凡判「零引用」必须**脚本化 + 双口径 + 报函数归属**，禁在 shell 里拼 `$var` 进单引号正则。② **B1-c 的切分漏项** —— 我把两个市场端点从批 1 范围里漏掉（P4-0 §5.2 早已预警「列名不匹配 42703 非缺表」）⇒ 终扫荡时发现仍 500 ⇒ **拒绝宣布批 1 完成**，补派 B1-d 后才收口。**这就是「部分可用不是清账」的实例。**
**★ 两处语义变更（已实现，待 Kevin 一句话裁）**：① **`/api/task/:tID` miss 由 404 改 200 空态**（我 brief 要求；B1-b 如实登记为语义变更）；② **`/api/prize/:bID` miss 保留 404**（B1-c 选择保留 miss 语义）⇒ **同一类 detail 端点现在两种行为**，我的临时裁定 = **批 1 接受现状**，批 2 由规范（Jing）统一「detail miss 语义」后一次对齐。**登记**：新 schema 下 `getBrandById(bID)` 以 `listing_id` 为键而路由参数语义是「品牌」，非空数据下 `brand/brand_symbol` 可能取 null（B1-d 登记）；`buyer_uID/seller_uID` 由 `LEFT JOIN market_order` 结构推断（**中**置信度）；B1-c 把 `countGift*`/碎片计数助手常量化 ⇒ **会影响写侧 `syncPrizeInventory` 的算术输入**（已登记，批 2/3 接线时必须复核）。
**★ 范围外（明确登记，非「未完成」）**：26 个 POST/DELETE 写端点**语义未改**（批 2/批 3）；全部余额变动仍走旧的 `upsertAsset`/`adjustPoints` 直改（**批 3 必须改走 `ledger_post_event`**）；`src/ledger.ts`/`src/commission.ts` 仍 **0 路由引用**（招工/商品/交易所的账本接线 = 批 3）。
**入库**：见 v0.71（`src/database.ts` +261/−379 累计、`src/index.ts`、片报告、四片 artifact、`p4z-01…08` 只读探针）。

---

### 5.69 **P4-0 侦察单验收 + ★ 我亲手补上它自报 `NOT_MEASURED` 的前端消费面 ⇒ 推翻它「下线碎片四件套」的建议（前端在用）⇒ 批 1 裁定 = 「GET 面止血 + 空态不删路径」；实施单已派**（2026-09-29）

**交付（Kong · `deleg_f414bcb2`）**：报告 `docs/audit/p4-route-inventory.md`（**296 行 / 8 段（§0–§6 + 声明）/ sha256 `3ccd67ee396d5758113e3a00792ecf2223d8004e3c8aca4edf76053a04186d25`**）+ `scripts/p4y-db-probe.ts` + `backend-ts/.p4-artifacts/**`（`endpoint-index.tsv` / `endpoint-relations-FIXED.tsv` / `db-relations.json` / `cte-alias-check.txt` / `new-table-columns.txt` / `http-get-sweep.txt`）；纯只读、零写库、未 `git`✓。
**★ 我采用的关键读数（它给了口径，我核过自洽）**：**51 端点**（GET 25 / POST 24 / DELETE 2）；**31 个**端点至少引用一个 **A 类真·基表**（引用即 `42P01`）；A 类 **8 名** = `asset / permission_group / prize / prize_item / shard / shard_transfer / task / task_progress`（逐一 `42P01` 实锤）；**B 类 8 名是 `WITH` CTE 别名，无害**（这条区分很关键，避免把无害别名当故障去改）；`src/ledger.ts` 与 `src/commission.ts` **0 路由引用**；新表 `job`/`listing`/`listing_order`/`admin_role*`/`currency_status_log` **0 路由引用**；GET 扫荡 = **200×3 / 500×9 / 401×13**。
**★ 我亲手补它自报的 `NOT_MEASURED`（前端消费面）—— 并因此推翻它的一条建议**：`frontend/src` 里 **49 条去重 `/api/…` 路径、23 个文件**（宽式口径：`grep -rhoE '/api/[a-zA-Z0-9_/:{}.\$-]+'`）；高频 = `/api/prize/all` **11**、`/api/task/all` **9**、`/api/user/asset/:p` **6**、`/api/user/stats` **4**、`/api/tasklist/pending-verification`(+`/count`) **4+4**、**`/api/shard` 4**、**`/api/prize-item` 4**、`/api/order` 3、**`/api/home` 3**、`/api/market/:p/orderbook|trades` 2+2、`/api/admin/*` 若干、**`/api/shard/transfer`、`/api/shard/redeem`、`/api/chest/:p/open` 各 1**。**⇒ P4-0 的批 1 建议里「下线 ④ 档 7 个端点（碎片/宝箱/`prize-item`/`auth` 两枚）」的一半被推翻**：碎片四件套 + `/api/prize-item` **前端正在调用** ⇒ **直接删 = 把前端打成 404**（它自己也把这条风险标为 `NOT_MEASURED`）。**我的裁定**：批 1 **不删任何路径**；这些端点改为 **`200` + 空态 + `deprecated:true` 标记**（UI 渲染为空，弃用事实对机器可见），**下线 + 前端同步**推迟到批 2/批 3 并单独走「前端改造单」。
**★ 批 1 的验收面（我定死，防「部分可用」混过去）**：① **GET 端点全绿**——`/api/home`、`/api/prize/all`、`/api/task/all`、`/api/task/:tID`、`/api/prize/:bID`、`/api/task-progress/:jID`、`/api/user/asset/:uID`、`/api/market/:bID/orderbook`、`/api/market/:bID/trades`、`/api/order`(GET)、`/api/prize-item`、`/api/shard`、`/api/shard/transfer`、`/api/tasklist/pending-verification(/count)` ⇒ **`200`**（需鉴权的保持 `401`）；② **`src/**` 内 A 类 8 名归零**（双口径证明）；③ **字段集合契约不得变**——用**同一份内存夹具**分别喂改动前后的 mapper（`git show HEAD:src/database.ts` 取改前版），逐 key 比对，空库下响应 key 结构必须一致（**前端不改一行也应能渲染**）；④ **GET 端点零写库**（扫荡前后逐表计数逐值相同，我自己复核）；⑤ `tsc --noEmit = 0`；⑥ **POST/DELETE 写端点本批不改语义、明确登记为批 2/批 3 范围**（**这不是「未完成」，是范围切分 —— 必须在报告里点名，禁以「部分可用」含糊收尾**）。
**★ 已派实施单（Kong · `deleg_…`）= P4-B1**：上述 6 条验收面 + 「重启服务只许走面板单服务路由（读 `ctrl/index.js` 现取 payload 形态）＋ 严禁 `pkill`/`killall`/重启其它 sid」+ 「禁改 `migrations/**`、`src/ledger-errors.ts`（已验收冻结）、前端 `frontend/**`」+ 「运行期真值当场现取（服务重启后必须 `/health` 200 再测）」。

---

### 5.68 **★ Kevin 定 P4（路由层）批次 1 方向：先把现有端点从 500 救活（jinli 遗留 SQL 按新 schema「重写或下线」）；侦察单在跑并已追加「前端实际消费的端点」一节**（2026-09-29）

**用户裁定（逐字）**：**「先把现有端点从 500 救活（把 `task`/`prize` 等 jinli 遗留 SQL 按新 schema 重写或下线；首页能渲染才有后续）」** —— 即 P4 不做全量铺开，**批次 1 的验收标准 = 现有端点不再 500**（首页/首屏路径优先）。
**据此我做的动作**：① 已派 **P4-0 只读侦察单（`deleg_f414bcb2`，Kong）**：产出端点全量表（`METHOD /path` × 行号 × 处理函数 × 触碰关系名）× 每个端点触碰的关系是否属 `0001..0017` 声明集（不属 ⇒ 必然 `42P01`）× GET 端点现状探活 × **遗留→新 schema 映射表（含「无对应」）** × 四档切分建议（立刻能修 / 需新写查询 / 需新能力 / 建议下线）+ 三批实施顺序；② **我追加 steer（本节核心）**：报告须新增「**前端实际消费的端点**」一节 —— `frontend/src/**` 的 HTTP 调用清单（含文件:行号）× **反向差集**（前端调了后端没有的 / 后端有前端零调用的 = 下线候选）× **首页/首屏挂载即请求的端点**（`App.jsx` 等）。**理由**：「重写 vs 下线」是业务裁决，**必须由前端真实消费面决定**，不能只看后端有什么端点 —— 否则会把首屏必用端点误下线、或给零调用端点白写一遍。
**批次 1 的判据（我先定，待侦察单回执细化）**：① 首屏路径涉及的端点 **GET 200 且响应结构不变**（前端不改代码即可渲染）；② 遗留关系名的 SQL 在 `src/` 内**归零或全部有映射说明**；③ 下线端点必须在报告里逐条给出「前端零调用」证据 + 明确的 HTTP 404/410 语义（**不静默 500**）；④ 不得改动 `migrations/**` 与已验收的 `ledger-errors.ts`；⑤ 库保持 seed 基线（**本批不得写库**，除非新端点自检需要 —— 那也必须用「自建命名空间 + 事后清理」并在 brief 里写死）。
**待办**：侦察单回执 → 我落 §5.69（验收 + 批次 1 派单 brief）→ 派 Kong 实施 → Neng 独立质检（**端点级**：逐端点 GET 状态码 + 响应结构快照对比 + 遗留关系名零残留）→ 我验收。

---

### 5.67 **★ D20 Phase 2（真重建 + COMMIT）完成 —— 我亲手独立验证「重建终点态」**全绿（9 项类级断言）；残差清零、seed 基线、checksum 17/17、触发器 43/非 `O` 0、`cid` next=4；`migrate` 17/17 `skipped`；并锁定 `seafood-api` 500 的真根因（jinli 遗留 `task`/`prize` 路由，**非重建所致**）**（2026-09-29）

**执行（Kong · `deleg_ce3c797d`，33 calls / 1329.6s）**：apply run `backend-ts/.p3y-artifacts/p3x-00-apply-20260929011509.-plain/**`（9 文件）。**★ 我亲读 `E-gate.json`**：`gate.ok=true`、`commit_allowed=true`、**`tx_final=COMMIT`**、`object_diffs=[]`、`terminal_failed=[]`、`terminal_ok=31/32`、`checksums_all_byte_equal=true`、`comparison_inside_tx=true`、`injected=false` ⇒ **COMMIT 是由闸放行的**（`:792` `canCommit`）✓。**`SUMMARY.ok=false / exit_code=5` 不是失败**：脚本末尾 `!F_net_zero.identical ⇒ exit 5` **无条件、不按 mode 分支**，apply 模式 `A≠F` 正是目的（`account 425 → 4`、`Σbalance+Σfrozen 378298107 → 0`）。交付：`scripts/p3y-00-pre-conn-registry.ts`（sha256 `408da9a90eca047ae0797ea57f11cbd6e40fe8e9649a900efbbcaf4fe9bf94ac`）、`scripts/p3y-01-post-apply-verify.ts`（sha256 `4a6f6dc517ed6a98d4b9dc72865756409550eff28e6120ba7d138169c247531b`）、报告 `docs/audit/p3-d20-rebuild-apply.md`（**249 行 / 9 章 / sha256 `257cf94eb9b32679b50e65a936b033a24114e50034fd1f2252bfdfe0bc17cbd4`**；连接串泄漏 0）；探针两轮 artifact（`…011705Z` 首轮 1 项 FAIL = 口径错，**它已自曝并保留**；`…011919Z` **24/24 `pass=true`**，我核过条目明细）。

**★★ 我自己的独立验证（不采信报告；自建探针 `scratch/zang-p3-post-apply-verify.js`，HTTP 驱动，`ok=true`、9/9 类级断言全 true）**：

| 断言 | 我亲取的读数 |
|---|---|
| 残差清零 | `users 0` / `ledger_entry 0` / `referral 0` / `job`·`job_application`·`job_submission`·`listing`·`listing_order`·`market_order`·`market_trade` **全 0** / `0017` 六表 **全 0**（原 673 users / 3239 条目 / 132 币 / 425 账户 / 25 policy 等） |
| seed 基线 | `currency` **1 行**（`cid=1`、`$`、`平台积分`、`total_supply=0`、`status=listed`、`listed_at NOT NULL`）｜`ledger_owner` **4**｜`account` **4**（`balance=0 AND frozen=0`，违例 **0**）｜`commission_policy` **1**（`policy_id=1`） |
| 结构 | 非 internal 触发器 **43**、非 `O` **0**；`public` 基表 **21**（20 业务 + `schema_migration`）/ 视图 **1** / 函数 **74** |
| 注册表 | `schema_migration` **17 行**；`checksum` 与 `migrations/*.sql` sha256 **17/17 逐字节相等**（我自己 `crypto.sha256` 重算，未引用他人结果） |
| 序列 | `currency_cid_seq` `last_value=3, is_called=true` ⇒ **next=4** ✓（与文件派生期望一致；pre-state 293 的变化属预期） |
| `migrate` | 我自己跑 `npx ts-node scripts/migrate.ts` ⇒ **17/17 `skipped`（`already applied, checksum match`）**、`applied_at` 全 = `2026-09-29 09:15:27`、`schema_version=0017`、exit 0 |

**★ 我自己的探针自曝 3 条（全在我这边，不是产品缺陷）**：① 用 `Client`(ws) 做只读体检时踩驱动老化路径 ⇒ **promise 永不 settle、进程静默 exit 0、连 `finally` 都不落盘**（**假绿风险**）⇒ 只读体检一律改走 `neon()` **HTTP**；② `@neondatabase/serverless@0.6.1` 的 `neon()` **无 `.query`**（我先写成 `sql.query` ⇒ 全表 ERR）⇒ 改**运行时自适应** `sql.query ?? sql(text,params) ?? sql.unsafe`；③ 按 `SUMMARY.gate`/`SUMMARY.tx_final` 取闸读数得四个 `None` ⇒ 真结构 = **独立 `E-gate.json`** + `SUMMARY.C_replay.tx_final`；④ 我先前用 `npm run migrate` 报错（**本仓无该脚本**，入口是 `scripts/migrate.ts`）。**四条均为我的口径/工具坑。**

**★ 服务面根因（我读面板日志 `GET :5555/api/logs/seafood-api` 锁定，非推测）**：`seafood-api` 现 **PID 84578** / 5788（pm2 只托管 `bistro-ctrl`；服务由面板注册项 `seafood-api` 拉起，cwd `backend-ts`）—— `/health` **200** 且自报 `schema_version=0017`（**API 与库连通**）；`/api/home` **500** ⇒ 日志 `src/database.ts:1167 Function.listTasks` 查 **relation `task` 不存在**（`42P01`）；`/api/prize/all` **500** ⇒ `src/database.ts:1017 Function.listBrands` 查 **relation `prize` 不存在**（`42P01`）。**⇒ 与本次重建无关**（同型错误 **9/28 18:13** 已在报）；根因 = **jinli 时代的旧表名仍留在路由层**。**我据此裁定：不重启服务**（健康面无异常；重启治不了 `42P01`），登记为 **P4 路由层第一优先项**。
**★ P4 路由层范围基线（我亲跑 `src/` SQL 关系名盘点，口径写清）**：**jinli 遗留** —— `task_progress` 14、`prize_item` 14、`shard` 8、`shard_transfer` 6、`selected_prize`/`selected_prizes` 8、`task` 6（裸名）、`prize` 6（裸名）、`permission_group` 4、`asset` 3、`shard_counts`/`transfer_counts` 各 2、`gift_counts` 2、`participant_counts` 2、`selected_task(s)` 4；**已接新 schema** —— `market_order` 9、`referral` 9、`ledger_entry` 8、`account` 7、`currency` 5、`commission_policy` 4、`market_trade` 3、`app_config` 2、`users` **9（带引号口径）**；**`job` / `listing` / `listing_order` 裸名与带引号口径皆 0** ⇒ **`0013` 招工 / `0015` 商品 尚未接入任何路由**。**口径校正**：我首次只跑裸名口径 ⇒ `users` 得 `0`（**假读数**，我的正则不匹配带引号标识符）；补跑带引号口径得 **9** ⇒ 以后凡判「零引用」必须**双口径**并写清。
**D20 状态**：**Phase 2 完成、残差清零、库回 `0001..0017` 声明基线** ⇒ 变体 1 的第 ② 步（清 D20 残差）**闭合**；第 ③ 步（`DL155`）早已闭合 ⇒ **下一里程碑 = ④ 路由层**。

---

### 5.66 **Unit J1（D20 apply 闸）交付验收通过 —— ★ 我亲读闸代码 + 亲跑三条分支（`refused` exit 2 不连库 / 判负 `gate.ok=false`⇒`ROLLBACK`+**净零 `A==F==699ac94d…`** / 正路 `gate.ok=true`）+ 亲提取四跑闸读数 + 确认**全脚本唯一 COMMIT 点**；**J2（真重建）已派**（2026-09-29）

**交付（Kong · `deleg_48672954`，22 calls / 512.6s）**：`backend-ts/scripts/p3x-00-rebuild-replay.ts` **`+92 / −13`**（唯一被改文件；现盘 sha256 `4c0629cd502df1ef948b0d15fb88f4a238ba4daebbfb19c8d998d77961ad6c97`）；报告 `docs/audit/p3-d20-apply-gate.md`（**181 行 / 12 节 / sha256 `6ca908a3ff7eacb74443fb2a6c8321c1b079808dcd16276b9a7cf07250ab91cd`**；连接串泄漏 0）；artifacts 四跑在 **新命名空间** `backend-ts/.p3y-artifacts/`（`…005114.-corrupt` 干跑判负 / `…005222.-plain` 正路干跑 / `…005447.-corrupt` **apply 分支判负** / `…005322.-inject0010` 注入）；既有 `.p3x-artifacts/**` **未被触碰**（我核 mtime 仍 01:48/01:49）✓。

**★ 我亲读闸代码（逐行）**：闸块 `:745-789` —— **对拍在事务内、COMMIT 之前**（`:764` `compareExpectations(exp, inTxSnapshot)` → `:784` 六项合取 → `:794` 才 COMMIT）；`gate.ok` = `replay_ok` ∧ `injected===false` ∧ `checksums_all_byte_equal` ∧ `snapshot_taken` ∧ `object_diffs_empty` ∧ `terminal_failed_empty`；**`canCommit = mode === 'apply' && confirmIrreversible && gate.ok === true`**（`:792`）；`:795` 否则 `ROLLBACK`。★ 我另核：**全脚本只有 1 处 `COMMIT`**（`grep -c "query('COMMIT')"` = **1**），`MODE` 的其余出现点（`:77` 派生 / `:818` refusal / `:824` runTag / `:830` summary / `:891` 调用）**均不写库** ✓ ⇒ 「apply 只能经闸 COMMIT」成立。
**★ 我亲跑三条分支**（我的运行把 `P3_ART_ROOT` 指到我的 scratch ⇒ **零污染仓库**）：① `--apply`（无 confirm）⇒ **`refused` + exit 2**，**未连库**（先拒绝后连接）✓；② `--dry-run --expect-corrupt` ⇒ **`gate.ok=false` + `tx_final=ROLLBACK` + exit 3**，且 `net_zero` **`A_hash == F_hash == 699ac94d8fa048f8…3cdb41`**（与我 3 小时前那轮**同一净零哈希** ⇒ 库自那时起零变化）✓；③ 正路 `--dry-run` ⇒ **`gate.ok=true` + `tx_final=ROLLBACK` + exit 0** ✓。
**★ 我亲提取四跑闸读数**（真结构 = `E-gate.json` + `SUMMARY.C_replay.tx_final`；我第一版按 `SUMMARY.gate` 取 ⇒ 四个 `None`，**是我的键路径错、不是产物缺失**，已按真结构重取）：

| run | `gate.ok` | `commit_allowed` | `tx_final` | `net_zero.identical` | exit | 说明 |
|---|---|---|---|---|---|---|
| `…005447.-corrupt`（**apply 分支判负**） | **false** | **false** | **ROLLBACK** | **true**（`A==F`） | 3 | reason = `object_diffs=1: TABLE 缺失: __p3y_corrupt_expectation__ ; terminal_failed=1: currency.cid1(逐值)` ⇒ **闸在 apply 分支真实挡住了 COMMIT 且库净零** ✓ |
| `…005114.-corrupt`（干跑判负） | false | false | ROLLBACK | true | 3 | 同上（同一 reason）⇒ 判负可复现 |
| `…005222.-plain`（正路干跑） | **true** | false（`mode=dry-run`，**预期**） | ROLLBACK | true | 0 | `term=31/32`（1 项 `NOT_MEASURED`=`currency.supply_cap=NULL`，**非失败** ✓ 与 §5.63 一致） |
| `…005322.-inject0010` | false（`injected=true`） | false | ROLLBACK | true | 0 | `checksums_not_all_byte_equal（file_steps=10/17）`+ 快照未取 ⇒ **注入演练下闸同样拒绝** ✓ |

**回归（它报 + 我抽样核）**：与已入库干跑 artifact `…174808.-plain` 逐字段对拍 —— `C-replay-log`/`D-comparison`/`D-expectations-from-files` **0 差**；77 条残留差异全可归因（时间戳 21 / 每连接 `pid` 2 / 他人会话观测 54）⇒ 无行为回归 ✓；`--apply` 无 confirm 仍 refused exit 2 ✓；`--help` exit 0 ✓；注入仍 `25P02` + `ROLLBACK` ✓；`tsc --noEmit` **= 0**（退出码直接重定向取值、非管道）✓。
**边界**：只改脚本 1 文件 + 新命名空间产物；禁写面（`src/**`、`migrations/**`、既有 artifact、master-plan）**零触碰**；未 `git`；未 `pkill`；**零 COMMIT**（四跑全 `ROLLBACK`）✓。
**未验证（照登）**：闸放行后真 COMMIT 的分支（⇒ **由 J2 补**）；快照取不到时 gate 表现（**已由 `inject0010` 跑间接覆盖**：`snapshot_taken=false` ⇒ 拒）；`--expect-corrupt × --inject-fail-after` 组合；`pooler_used:false` 之外更强的「非 pooler」证据（host 已 redact）；自己连接的 `application_name`；在线服务并发锁竞争；**闸对「文件派生期望本身系统性偏差」无防御**（登记：若派生逻辑本身错，闸会跟着错 ⇒ 期望的对拍另需人工复核，本仓以 `0001..0017` 冻结 + checksum 已闭）。**自曝 1 条**：中途一次 patch 写反（重复 `const exp`），LSP 立即报错并修回，最终 diff 无残留 ✓。
**★ 已派 J2（`deleg_ce3c797d`）= 真重建 + COMMIT**：`--apply --confirm-irreversible` 单跑（禁 `--expect-corrupt`、禁绕过闸）+ 独立只读探针 `p3y-01-post-apply-verify.ts` 做逐值终态/对象集/checksum 17/17/触发器 43 与非 `O` 0/`cid` 序列 next=4 + `migrate` 17 `skipped` + `seafood-api`（PID 6480）**只读观测**（处置由我做）。**判负口径已改并写入 brief**：apply 模式下 `A_hash != F_hash` **是目的**，不得据此判负；正确口径 = 事务内 `gate.ok=true` + 事务外逐值终态 = 重建目标态。

---

### 5.65 **Kevin 授权 D20 Phase 2（真 `COMMIT`）+ ★ 我在派单前亲读脚本、拦下「闸在对拍之后」的真缺陷 ⇒ 拆 J1（装闸＋判负实测）/ J2（真跑）**（2026-09-29）

**授权（逐字）**：Kevin **「授权 Phase 2」** ⇒ D20 破坏性动作由 A 档升为**已授权**（此前两次表单超时，我按最低破坏性挂起、未代授权）。

**★ 我亲读我要跑的那个脚本，拦下真缺陷**：`backend-ts/scripts/p3x-00-rebuild-replay.ts` —— `:713` 只在 `!replayError && !injected` 时取事务内快照；**`:719` 在 `mode === 'apply' && confirmIrreversible` 时无条件 `COMMIT`**；而 `compareExpectations(...)` 的调用在 **`:834`** 一带 ⇒ **对拍发生在 COMMIT 之后**；`replayError` / 注入失败 / 对拍不等**都拦不住 COMMIT**。干跑阶段**永不暴露**（收尾恒 `ROLLBACK`）—— **这是「不可逆动作前必须复读工具本身」的教科书案例：被验证过的是干跑分支，而破坏性分支的判据位置从未被执行过。**
**裁定：不得直接跑 `--apply`。拆两步**：**J1（`deleg_48672954`，Kong）= 装闸 + 判负实测**（对拍移进事务内、COMMIT 以 `gate.ok` 为**前置**；`gate` 落盘 + 机读打印；新增 `--expect-corrupt` 造判负输入；**三段判负**：(a) 修前静态证据（**严禁用旧版跑 `--apply`**）、(b) 干跑判负 ⇒ `ROLLBACK` + 净零、(c) `--apply --confirm-irreversible --expect-corrupt` ⇒ **必须 `ROLLBACK` + 净零，出现 `COMMIT` 即停手报告**；回归 = 与已入库干跑 artifact `…174808.-plain/*.json` 逐字段对拍 + `refused`/`--help`/注入演练三条旧行为不回归 + `tsc` 0）；**J2（我验收 J1 后派）= 真 `--apply --confirm-irreversible`**。
**★ 风险界定（登记，防误判）**：即便闸失效导致误 `COMMIT`，事务内重放用的仍是**冻结的迁移文件**（sha256 与 registry checksum 已核 17/17 逐字节）⇒ **最坏结局 = schema 被重建 = Phase 2 的目标态**，且**可重复重放**；真正不可逆的面只是**测试残差被清零**（已在授权范围内）。
**J2 完成后我本人要做的（不派子代理）**：逐值终态对拍（`currency` 1 行 / `ledger_owner` 4 行 / `account` 4 行 0/0 / `commission_policy` 1 行 / 业务表与 `0017` 六表 0 行 / `schema_migration` 17）+ 非 internal 触发器 43 且非 `O` 0 + 注册表 checksum 17/17 + `migrate` 全 `skipped` + **`cid` 序列 next = 4 的口径登记**（pre-state `293` ⇒ 必然变化，属预期）+ **`seafood-api`（5788）连接池/计划缓存失效的处置**（DROP SCHEMA 会让它的既有会话/预备语句失效 ⇒ 观测后按需重启，**由我做**）。

---

### 5.64 **Unit I（判据② 收窄 · 第二轮）交付验收通过 —— ★ 我亲跑它的探针完全复现（EXIT=0 / `hard_fail=[]` / 两跑 artifact **逐字段同形，仅 `run` 不同**）；A4·B7 释放回 500 告警、真事件对象仍 503、B6 为接受项；★ 我另发现毒 getter 在旧版是 `THREW` ⇒ 收窄顺带换来稳健性**（2026-09-29）

**交付（Kong · `deleg_4bc8bb81`，21 calls / 233.2s）**：`backend-ts/src/ledger-errors.ts` **2 hunk / 3 改动点，`+29 / −8`（636 → 657 行）/ sha256 `5a671354eb7bfd6707bb27a48a1e661b73745a63de59c5201957a602006bf3c4`**（我盘面复算逐字相同）；报告 `docs/audit/p3-errors-fold-narrow.md` **440 行 / 14 章（0–13）/ sha256 `54403a95c35deb82f7e2268c0779b62ff1b487afce12b1f24131d192fc864c0f`**（`git diff --numstat = 158 0` ⇒ **0 删除、0–12 章逐字未改、纯追加**）；新增探针 `backend-ts/scripts/p3w-01-narrow2-verify.ts` + artifact `…174943Z.json` + `_impl/mutated-clause2-narrow2-ledger-errors.ts`（sha `e7b39540…`）。

**★ 实现与我的裁决逐字一致（我亲读源码）**：**判据② `:422`** = `if (safeRead(e, 'type') === 'error' && typeof safeRead(e, 'message') === 'string') return true;`（两读均经 `safeRead` ✓）；**判据① `:414`** = `if (isEvent && safeRead(e, 'type') === 'error') return true;`（`type` 闸在位 ✓）；判据③ `:423-435` 语义未动；`:425-428` 未动；**承重注释已更正**两处（`:388`、`:417`：明写真 `ws.ErrorEvent` 只能由 ② 命中、**不得删除**）；`tsc --noEmit` **`=0`**（**直接重定向取值、非管道** ✓ 合 §5.7②）；既有 `p3w-00` 与 `_impl/` 三份副本**零覆写**（`git status` 无 `M`）✓；`p3x-*` 零触碰 ✓。

**★ 我亲跑它的探针（`npx ts-node … scripts/p3w-01-narrow2-verify.ts`，`EXIT=0`）—— 完全复现**：三态内容 sha 自证 `baseline 721156cb… / fixed 9bc127e4… / narrowed2 5a671354…` 全 **`match=true`**；★ 回归守卫 **`ws_event_instanceof_global_event = false`（`guard_pass=true`）**（`ws@8.22.0`；`ctor.name=ErrorEvent`、`own_props=[]`、`own_msg_desc=null`、`typeof e.message=string`、`type="error"`）**⇒ 判据② 承重前提已机器可读固化**；`worktree before == after`（跑期间源文件未被写）、`anchor_hits=1`、`mutation_diff_lines=1`。
| 组 | 我亲跑的读数 | 判定 |
|---|---|---|
| **A（预期内）** | A1 真 `ws.ErrorEvent` / A2 freeze / A3 own getter-only ⇒ `LEDGER_TX_TIMEOUT/503/driver_connection_error` ✓ | **PASS** |
| **A4 / B7（我的裁决目标）** | `{type:'error'}` / `{type:'error',payload}` ⇒ **narrow2 = `LEDGER_TRANSACTION_REQUIRED/500` == baseline** ✓（fixed 为 503） | **达成** |
| **B1–B5** | `new Error()` / `new TypeError()` / `Object.create(Error.prototype)` / 原型数据属性 / `new Event('open')` ⇒ **全部 500 == baseline** ✓ | **PASS** |
| **B6** | `new Event('error')` ⇒ **503**（**唯一 ≠ baseline 者**，§5.62 已裁为接受项） | 接受 |
| **C（13 对照）** | `three_state_identical = 13/13`（三态逐字节相同）✓ | **PASS** |
| **R1/R2** | 原型 getter-only 无 `type` / 类原型数据 `message` ⇒ **500 == baseline** ✓ | 释放成立 |
| **G（毒 getter 5 例）** | **5/5 不抛**，收敛为 `LEDGER_TRANSACTION_REQUIRED/500` | **★ 见下** |
| **判负三段** | 红 = mutant 去掉 ② 的 message 合取 ⇒ **`RED_set = [A4, B7]` 全回 503**；绿 = narrow2 二者 500 == baseline；还原列 == fixed 列 ✓ | **成立** |

**★ 我的独立发现（Unit I 报告只写了「5/5 不抛」，未点出方向）**：**G1/G2/G5（`message` / `code` / `message+code` 毒 getter）在 `baseline` 与 `fixed` 两态是 `THREW/THREW/THREW`（分类器整体抛出）**，narrow2 收敛为 500 ⇒ **Unit H 的 `safeRead` 守卫 + Unit I 的收窄顺带换来一类稳健性改善**（方向正确，**不是**过捕面）。⇒ 该三例在 `differs_from_baseline` 里出现**是收益不是回归**，登记以免后人误判。
**★ 两跑 artifact 逐字段同形**：`p3w-01-…174943Z.json`（它）vs `…185516Z.json`（**我复跑**）⇒ 除 `run` 外**全字段相等**（`A_fail`/`B_fail`/`B_mismatch_vs_baseline`/`C_mismatch`/`G_threw`/`RED`/`sha_selfcheck`/`ws_regression_guard`/`ws_selfcheck`/`all_cases` 等 21 键）⇒ **判为可复现**；`mutated_c2` 副本两次再生 sha 相同（确定性）⇒ **我的复跑覆写该副本为逐字节同内容**（如实登记）。

**口径记账（防误判为漏改）**：`git diff --numstat ade3376:… vs 现盘` = **74 / 16**，而 H(`+48/−11`) + I(`+29/−8`) 简单相加 = **77 / 19** ⇒ 差 3/3 **是 diff 代数折行**（I 改写了 H 新增的注释行 ⇒ 对 `fixed` 只计一次），**不是漏改**；判定依据 = **终态内容 sha** + **探针三态逐形态对拍**。
**外部事件（照登）**：其运行期间 `HEAD` 由 `209e556 → 0eda41a` —— **那是我本人的入库**（§5.62 正文 + 追认），非第三方；它**未 `git`**、文件 sha 前后一致、结论不受影响 ✓（且它按纪律用了**内容 sha 自证**、未用 `HEAD` 符号 ✓）。
**自曝照登**：① 首跑 ts-node **编译期**失败（exit 1、无 artifact 落盘 ⇒ 不计入 run）；② print 段「派生行误取 `.per_impl`」**与 Unit H §11.1 同型复发**（同型第三次 ⇒ 记入探针模板缺陷、后续模板直接避开）；③ §13 一个 restore 字段**硬编码 `true`** ⇒ 已自标为口径错误、**按 `NOT_MEASURED` 读**（我采信其自标 ✓）。
**`NOT_MEASURED`（照登）**：端到端故障注入；**「删整条判据② ⇒ 真对象回流 500」的单点变异实测**（仅推理，支撑 = `instanceof=false` + `own_props=[]` 两条实测）；getter+setter `message`；非 `ws` 依赖扫描；生产出现频率；路由层表现；毒 `name` getter；§14 指纹重算；「还原」的端到端重跑。
**★ 本线收官（P3 错误分类：Unit E → G → H → I）**：真驱动事件对象 → **既有 503 通路**（`DL126` 不破）；**过捕面 A4/B7 释放回 500**（恢复「500 类码只由不变式被破坏触发」的语义）；**B6 为显式接受项**；**判据② 承重已在源码注释与报告双处固化**（防后人误删）。**驱动层本体仍未加固（A 档登记债务）**；`p2w-00`/`p1o-00` 套件的 `env_jitter` 口径不受本轮影响（未改套件）。

---

### 5.63 **D20 重建 Phase 1（dry-run）验收通过 —— 我独立复核：3/3 `ROLLBACK`、零 `COMMIT`、`--apply` 双闸在位、连接串零落盘、★ 我自己的只读盘点跨该窗口 **deep-equal = TRUE**（库净零）；并更正我 §5.61 的一处口径错（`cid` 序列下一值 **4** 非 2，归因到 `0011:413`/`0012:1180` 的哨兵子事务 INSERT）**（2026-09-29）

**交付（Kong · `deleg_5491a270`，32 calls / 538.4s）**：脚本 `backend-ts/scripts/p3x-00-rebuild-replay.ts`（sha256 `505b6ba605cf0020c3bee024ad7acd53fd3de82cdaa1a13efbb3ed3257e4c2c7`；默认 `--dry-run`）；报告 `docs/audit/p3-d20-rebuild-dryrun.md`（**262 行 / 11 章（0 / A–J）/ sha256 `fd6a5161cb62c0b24514f0a87343ac33871a7b4bf15fc61e14682e07c6aa9143`**，我盘面复算逐字相同）；artifacts 三跑：`…174551.-plain/`（探路，含已修探针缺陷）、`…174808.-plain/`（主对拍）、`…174912.-inject0010/`（注入演练）。

**★ 我独立取证（不采信报告）**：① 三份 `SUMMARY.json` 的 `tx_final` **全为 `ROLLBACK`（3/3）**（我亲 `grep`）；② `tx_final: COMMIT` **命中 0**；③ **`--apply` 双闸在位**（`:741-742` 无 `--confirm-irreversible` 即 `refused` 并打印「Phase 2 未获授权」；真 `COMMIT` 只在 `:719` 的 `mode === 'apply' && confirmIrreversible` 分支，本单未调用）；④ **连接串零落盘**（脚本/报告/artifacts 全 `grep -rlE 'postgres(ql)?://'` = **0**）；⑤ **★ 净零我自己验**：用我自己的只读盘点在 **17:51Z** 复取、与 **16:38Z**（Unit C 三跑之前）逐字段 **deep-equal = TRUE**（剔除 `run`；含 `business` 逐表逐状态计数、`ledger_by_cid` `cid1 712 + 夹具 2527`、`appendonly_triggers 20`、`commission_policy 25`、`ledger_owner 4`、`migration_files_sha 17`、`cid1` `8400 == 8400`）⇒ **三次 `DROP SCHEMA public CASCADE` 干跑零残留**。
**它的核心读数**：**对象集全等** —— TABLE 20/20、VIEW 1/1、FUNCTION 74/74、PROCEDURE 0/0、TRIGGER 43/43、SEQUENCE 13/13，`object_diffs=[]`；**逐值终态 31/32**（`terminal_not_measured = ["currency.supply_cap=NULL"]`；`currency` 1 行 `cid=1/total_supply=0/listed`、`ledger_owner` 4 行逐字、`account` 4 行 0/0 且 Σ=0、`commission_policy` 1 行、`users`/`referral`/`ledger_entry`/`job*`/`listing*`/`market_*`/`0017` 六表 = 0、`schema_migration` 17、触发器 43 且非 `O` = 0）；17 文件 sha256 与 registry checksum **17/17 逐字节相等**；**E 注入演练成立**（`--inject-fail-after=0010` ⇒ `P0001` ⇒ 后续语句 `25P02 current transaction is aborted` ⇒ 整体中止 ⇒ `ROLLBACK` ⇒ 事务外 pre-state 逐值未破坏）；**F 净零 `A_hash == F_hash == 699ac94d…`**（主 run 与注入 run 相同）。

**★ 收紧我自己 §5.61 的口径错（勘误，责任在我）**：我在 §5.61/派单里写「`currency.cid` 序列下一值 = **2**」**是错的** —— Unit C 改用**由迁移文件自身派生**的期望得 **4**，并归因到 `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:413` 与 `migrations/0012_replay_pre_gate_before_balance_gate.sql:1180` 各一次「列清单不含 `cid` 的 `INSERT INTO currency`」。**我亲核其形状**：两处均在 `-- D.2 / C.2 行为探针（子事务 + 哨兵回滚）` 的 `BEGIN` 块内（`0011:403` 附近、`0012:1176` 附近；两文件 `EXCEPTION` 计数 17 / 13）⇒ **行随子事务回滚、但序列推进不撤** ⇒ 下一值 = `setval(1)` 后的 2 **+ 2 = 4** ✓（`0001` 显式给 `cid=1`，seed 不消耗序列）。**⇒ 判 Unit C 的纠正正确、我的 `2` 作废**；**附带事实（我登记）**：pre-state 该序列 `last_value = 293`（测试残差）⇒ **Phase 2 之后序列值必然 ≠ pre-state**（属**预期**：重建后新币从 cid 2 起分配，正是「回 seed 基线」的应有形态，**不得**在 Phase 2 验收里把它当漂移判负）。
**风险与边界（逐字保留其声明）**：Phase 2 **一旦执行不可逆**；本机**无 `pg_dump`** ⇒ A/F 快照是**观测**、**不是可回灌备份**（忠实回灌需绕过 append-only 守卫）；Neon PITR、重建后应用层端到端、其余 69 个函数/触发器定义体逐字节对拍、序列**按名**对拍、真并发锁竞争等 **10 项 `NOT_MEASURED`** 照登；探针缺陷自曝 5 条（含探路 run 的 3 项误报：PG 别名折小写、数组顺序、cid 期望口径过窄）。
**Phase 2 闸**：**未授权、未执行** ⇒ 待 Kevin 一句话点头后才派；届时 brief 必含「`--apply --confirm-irreversible` 单跑 + 逐值对拍 + 触发器 43/非 `O` 0 + 注册表 checksum 17/17 + 事后 `migrate` 全 `skipped` + 序列 next=4 的口径登记」。**（2026-09-29 表单再超时 —— 我按最低破坏性推进：不执行 Phase 2、不代授权；此项登记为待办「一句话闸」，后端路由层可先行，不受此闸阻塞。）****顺带闭合**：P1e 遗留「`0007`/`0008` 未在空库从零跑过」由本 dry-run 覆盖（对象集全等）。

---

### 5.62 **Unit H（错误分类窄化）交付验收 + ★ 我亲取「真对象承载者」真值 ⇒ 裁定：B6 非过捕（我原 AC 作废）、A4/B7 为同类真过捕（判必须再收窄一行）、判据② 是承重子句且源码注释必须更正；派 Unit I**（2026-09-29）

**交付（Kong · `deleg_f663c7ca`，16 calls / 276.9s）**：`backend-ts/src/ledger-errors.ts` **+48/−11**（599→636 行）/ sha256 **`7895390ea5616339322043f3cd825a44e550ca836f006b34761fb71c0c3b96f9`**（我盘面复算逐字相同）；报告 `docs/audit/p3-errors-fold-narrow.md` **282 行 / `## ` 级 13 节（0–12）/ sha256 `5cca998d5def757ef9c5f1d1f9524330b0cd6dee365e5c2b59ddd1e554dec476`**（我盘面复算逐字相同）。**实现与裁决逐字一致**：判据① `globalThis.Event` 实例 ∧ `type==='error'`；**判据② `type==='error'` 逐字不动**；判据③ 仅保留「own getter-only 字符串 `message`」（**过捕源头第二子句已删除**）；新增 `safeRead()` 守卫（`code`/`constraint`/`message`/`type`/`instanceof` 全经守卫，getter 抛 ⇒ 该子句不匹配、**绝不向上抛**）；`errName` 未动；未新增码、未动 §14 闭集与状态映射表；`tsc --noEmit` exit 0（日志 0 行）。

**读数（run `20260928T163708Z`，`PROBE_EXIT=0`，直接取）**：A 组 4/4 `LEDGER_TX_TIMEOUT`/503；**B1–B5 与 baseline 逐字节相同（500）**；C 组 13 例三态逐字节不变；R 组 2/2 回 500（已登记释放）；毒 getter 三形态（`message`/`code`/`type` 抛）**均不抛**、落确定性码。**判负三段**：baseline `[]` 绿 → fixed `[B1..B7,R1,R2]` 红 → narrowed `[B6,B7]` → 单点变异（复原第二子句）`[B1..B4,R1,R2,B6,B7]` **红**；工作树全程未被写（before==after == `7895390e…`）；3 次 run payload sha 全等 `466fc317…`。**它自曝（如实、不判缺陷）**：1 次 run 作废（print 段 bug，artifact 已落盘但按出口非 0 弃用）；1 次退出码取自 `PIPESTATUS`（读数有效、退出码不作证据）；§11.3 自认「我为对拍复算的判据是实现逻辑的同构重写 ⇒ 只能校验接线、不能证伪判据形状」——**该声明正确**，本单真独立性来自四副本对拍 + 手工边界形态 + 主动追查 AC 冲突（§6）。

**★ 我亲取的真值（本轮判别量；`node` 直取 `ws` 的 `lib/event-target.js` 绝对路径 + 驱动 dist + 全仓 grep）**：
① **`ws` 的 `Event`/`ErrorEvent` 是它自己的类，不是 `globalThis.Event` 的子类**（实测 `new ws.Event('open') instanceof globalThis.Event === false`）⇒ **判据①对真对象永不成立**；
② 真 `ws.ErrorEvent` 实例 **own props 为空**，`message`/`type`/`error` **全在原型上且是 getter**（`ErrorEvent.prototype.message` / `Event.prototype.type`），`typeof e.message === 'string'`；源码为证 `ws/lib/event-target.js:105-138`（`options.message === undefined ? '' : options.message` ⇒ **恒为字符串**）；
③ `globalThis.ErrorEvent === undefined`（Node 18.19；`ws` 也不导出 `ErrorEvent`，其 `exports` 映射挡住子路径）；
④ 驱动 dist 内**无**自造 `type:"error"` 对象（`grep -c` = 0）；
⑤ 本仓后端 `type:'error'` 形态 **0 命中**（唯一命中是 `frontend/src/components/ui/Toast.jsx:147`，与后端分类路径无关）。
**⇒ 结论：真对象只能由判据② 命中 ⇒ ② 是承重子句；而原注释把真对象归到判据③「原型 getter」一条是错的**（真对象**没有 own `message` 描述符**，报告 §8 独立复现 `own_message_descriptor === null`）——该错误注释有具体危害：后人可据它认定「② 冗余」而删掉 ⇒ 真对象重新落 500 ⇒ **重新破坏 `DL126`**。

**裁定（含对我自己 brief 的勘误）**：
① **B6 `new Event('error')` 不是过捕** —— 它是真事件对象（判据①∧② 命中），属「事件对象族」定义内 ⇒ **我原 AC「B6 必须 == baseline」作废**，登记为**接受项**；Kong 按裁决字面执行、未自行扩大并把它如实登记（§6），**判其行为正确**；
② **B7 `{type:'error',payload}` 与 A4 `{type:'error'}` 是同一类真过捕** —— 非 Event 实例、无 `message` 的普通对象仅凭 `type` 位被归入事件族 ⇒ 503 把 500 缺陷告警静默降级（与 Unit G 抓的那一类同源）⇒ **判「必须收窄」**（与 §5.60 对 B1–B5 的裁定同向：过捕与漏捕是一对，只测被抓住的那类测不出过捕）；
③ **收窄方案 = 判据② 加合取项 `typeof safeRead(e,'message') === 'string'`**：真对象与 A2 **恒带字符串 message**（②仍命中 ⇒ **A1/A2/A3 全保留**）、B1–B5 本就靠 `type` 缺失被排除、**B7/A4 释放回 500**；方案已由我按真值逐形态推演，**风险面如实登记**：若将来出现「非 `ws` 的事件实现，只带 `type` 而无字符串 `message`」且确实是驱动故障 ⇒ 会落 500（**未观测形态**，代价方向与「任何 `new Error()` 被静默降级成 503」相比更窄）；
④ **A4 期望作废**（它与 B7 同类，仅差 `payload` 键）；
⑤ **源码注释必须更正**：写明「判据② 承重、不得删除」，并附本段真值（`ws` Event 非全局 Event / 真对象 own props 空 / message 为原型 getter 字符串）。
**⇒ 派 Unit I**（收窄一行 + 注释更正 + 回归守卫「`ws` Event 不 `instanceof globalThis.Event`」可机读断言 + 新 AC 矩阵 + 判负自证；DB 零写、纯函数探针）。

**★ 程序性失误登记（我 · 本轮的流程错误，如实记，不掩盖）**：我把 Unit I 派在**入库之前**，而 Unit I 一开工就地改写了 `backend-ts/src/ledger-errors.ts` ⇒ Unit H 那一版（sha `7895390ea5616339…`）**既不在 git（`git cat-file -t` 报 not a valid object）、也不在 `.p3w-artifacts/_impl/`（只有 baseline/fixed/mutated 三件）** ⇒ **该中间态已不可按字节回溯**（我随后才尝试归档，`src` 已被改成 `5a671354…`）。**可回溯性损失面如实界定**：① **行为面未损失** —— 三态逐形态对拍表、判负三段、三态 sha 全在**已入库**的 `p3w-00-fold-narrow-verify-20260928T163708Z.json` + 报告 §3/§5 里；② 损失的是该中间版的**逐字节原文**（差量只能由报告 §3 的 5 个 hunk 行区间 + Unit I 的 diff 间接界定，**不是**逐字节可复原）。**纪律（本仓，自下一轮起硬执行）**：**不得把「会就地改写某已验收产物」的单派在入库之前** —— 先 `git commit` 那一刻的内容 sha（或在 artifact 目录按字节存一份、以内容 sha 命名后入库），**入库动作排在派单之前**；并在 brief 里点名「你的开工态 = sha A，须在改动前 `cp` 一份核 sha A」，把存档义务压给后继单做双保险。
**★ 同批核出的入库盲区（`git add` 目录 ≠ 目录内全部进索引）**：`.p3w-artifacts/**` 里三份 `*.log`（`p3w-tsc-narrow.log`、`p3w-00-run2/3-stdout.log`）被 **`.gitignore:244` 的 `*.log` 规则静默吞掉** ⇒ `git show --stat` 只 9 个文件、少于 `ls` 所见。**登记口径**：原始 stdout 归**仓库约定不忽略**之外（约定即忽略），**读数以已入库的 `.json` artifact（payload sha `466fc317…`）为准**；今后凡需入库的原始输出一律用 `.json`/`.txt` 后缀，**`.log` 后缀一律视为不入库**。

---

### 5.61 **D20 残差处置：只读盘点（我亲跑，双源对拍）+ 路线定案为「事务内重建，先 dry-run 后 apply」—— 破坏性步骤分级：Phase 1（dry-run/ROLLBACK，净零）即刻授权，Phase 2（COMMIT）待 Kevin 点头**（2026-09-28）

**① 我亲跑只读盘点（v1 早停一次，保留下不删；v2 全绿）** —— 探针 `scratch/zang-d20-inventory.js`（**在 `referral` 处早停：我猜错列名 `referrer` ⇒ 后半段读数缺失**；`cid1: undefined` 与失衡表印成 `[]` **均为假读数**，已作废不据以结论）→ `scratch/zang-d20-inventory2.js`（run `20260928T163938Z`，全绿）。**现取总账**：`users 673 / account 425 / ledger_entry 3239 / referral 349 / currency 132 / commission_policy 25 / job 110 / job_application 32 / job_submission 10 / listing 62 / listing_order 21 / market_order 68 / market_trade 19 / ledger_owner 4`；**`0017` 六表 = 0**（`app_config`/`admin_*`/`currency_status_log`）、`schema_migration` 17。

**② 残差结构与「为何清不掉」**：`ledger_entry` 3239 行 —— 命名空间 `biz:job` **1812** / `ops:*`（`smoke 231`、`p1s 229`、`p1e 182`、`p1u 117`、`p1h 98`、`p3l 72`、`p2x 56`…）/ `biz:market 96` / `biz:listing 30` / `cli:*` **142** / `cm:*` 10 / **`event_root_key IS NULL` 7 行**；按币 `cid=1 712 行`（其中平台 uid 45 / small·mid 363 / 夹具 990k 304）、夹具币 **2527 行 / 76 个 cid**。**★ 结构性阻断（实测触发器清单，20 个「禁删/禁改」触发器）**：`ledger_entry`/`commission_policy`/`referral`/`market_trade`/`currency_status_log` **各 1 个 append-only**（BEFORE DELETE OR UPDATE）+ `job`/`job_application`/`job_submission`/`listing`/`listing_order`/`market_order` **各 1 个 no_delete** + `job`/`job_submission`/`listing_order`/`market_order` core-immutable（UPDATE）+ `0017` 五表 key-immutable ⇒ **行级删除路线（变体③）实测不可行**（不是「麻烦」，是**结构性不可删**）。

**③ 平台骨架由迁移创建（决定性，`0001_ledger_core.sql` §13 种子）**：`INSERT INTO currency (cid=1, symbol='$', name='平台积分', owner_uid=0, decimals=0, total_supply=**0**, status='listed', deposit_cid=1, listed_at=now())` + `setval(cid_seq,1,true)`（自建单位从 2 起）+ `ledger_owner` **4 行**（`0 平台主体 / -1 手续费归集 / -2 佣金池 / -3 罚没`）+ `account` **`SELECT o.uid,1,0,0 FROM ledger_owner WHERE o.uid<=0`**（4 行 0/0，满足 R75）。`0007` 亦 seed `commission_policy` 默认版（`policy_id=1`）并**自带自检**「`0007 self-check FAILED: default commission_policy seed missing`」（L389）⇒ **重建后平台骨架自动回来且是 spec 声明基线**。**推论**：现存 `cid=1 supply 8400` 与 `commission_policy 25 行`（`1` + `20..37` + 今天夹具新增 `75..80`）**同属测试残差**；`20..37`/`75..80` 全部 `created_by=0`、时间戳落在夹具会话内。

**④ 双源对拍（Kong `p3q-01` vs 我）** —— 它 `20260928T140655Z`：`users 564 / currency 106 / account 341 / ledger_entry 2984 / referral 283 / commission_policy 22`（模式 = `READ_ONLY_INVENTORY`、`deletes_performed 0`；已入库 `3b8e379`）；我 `163938Z`：`673/132/425/3239/349/25` ⇒ **差 = 其后 2.5h 的套件写库**（`+109/+26/+84/+255/+66/+3`），**结构结论一致**、无矛盾。它已独立登记「`ledger_entry` append-only 禁直删」与我同；其 `cid1_sensitivity` 已把 8400 按 uid 窗口分解（`account_sum_excl_fixture_windows=4099`）。**我复用它，不重做。**

**⑤ ★ 新发现（登记待查，非本单处置）**：**7 个夹具币 `total_supply` 与 Σ账户差 `+1`**（`cid 104/112/121/130/138/149/158`，owner_uid 942001，supply 3000000 vs acct_sum 3000001）。库内**不存在** `supply ≡ Σaccount` 的库级不变式（既有 Σ 闸只管佣金分配守恒）⇒ 不是「不变式被破坏」，但该 +1 模式的成因未定位（**不得推测性归因**）。这 7 币全属待清残差 ⇒ 随重建消失；**登记为「迁移链正确性之外的历史夹具印记」**。

**⑥ 路线（我裁定 + 待 Kevin 覆核）**：**「事务内重建」** —— 单事务（**单连接 `Client` + `DATABASE_URL_UNPOOLED`，禁 `Pool`**，池化不保证会话固定）内 `DROP SCHEMA public CASCADE` → `CREATE SCHEMA public` → 按序重放 `migrations/0001..0017` **原文** → 全量期望对拍 → `COMMIT`。**回滚手段 = 单事务原子性**（任何一步失败 ⇒ 事务中止 ⇒ 库回到原状；本机**无 `pg_dump`** ⇒ 另出全表 JSON **取证快照**，并**如实声明它不是可回灌的备份**〔忠实回灌需绕过 append-only 守卫〕）。**顺带收益**：闭合 P1e 遗留「`0007`/`0008` 未在空库从零跑过」+ 验证 17 迁移链自洽。**前置安全核查**（派单必写）：`pg_stat_activity` 列出非本会话连接（**只登记、禁 `pg_terminate_backend`**）；若有 `idle in transaction` ⇒ 停手报我。**期望终态**：`0001` 声明基线（`$` supply 0、平台账户 0/0、`policy_id 1`、业务表全 0）。**破坏性分级**：**Phase 1 = dry-run（同一事务做完 + 全量对拍 + `ROLLBACK` + 注入失败演练）⇒ 净零变化，即刻授权**；**Phase 2 = `--apply`（COMMIT）⇒ 必须 Kevin 明确点头后才派**。**Unit C-Phase1 即派**（收单后落 §5.62）。**★ 本条的盘点读数已入 `clarify` 表单征询 Kevin（含「重建后 `$` 基线 = 0001 声明基线」二选一）—— 表单超时未填 ⇒ 按既定口径不阻塞、取推荐项推进、且只推进「净零」的 Phase 1；Phase 2 仍待明确点头（一句话可改）。**

### 5.60 **套件口径按类修交付（Unit F）+ 错误分类修复的独立质检 verdict = `部分可用`（Unit G）—— ★ 我亲验出 **7 个非事件形态被过捕**（`new Error()` 一族 500→503）⇒ **判「必须收窄」，派 Unit H**；**登记「质检在跑时不得动 HEAD」**（2026-09-28）

**① Unit F 产物 + 我验收通过**：报告 `docs/audit/p3-suite-caliber-fix.md` = **151 行 / 25151 B / sha256 `e718f2afdd4ef411e5a7…`**；两套件改动 `git diff --numstat` = `p1o-00-escape-sweep.ts` **+114/−11**、`p2w-00-p2fix-verify.ts` **+116/−33**。**A（`p1o-00` 加既有 transient 档）**：新单列 `env_jitter`（计数 + `env_jitter_cells` 明细）+ 新 verdict `env_jitter_separately_counted` + 留痕字段 `expectation_mismatches_raw`；**严格档 = `code=LEDGER_TX_TIMEOUT ∧ status=503 ∧ reason ∈ {pool_connection_timeout, driver_connection_error}`**（对齐 `src/ledger-errors.ts:401`），**五项既有 verdict 判据逐字未动**。**修前**（`MULF8X80`）`expectation_mismatches 1` = `E-W4_unfreeze/amount/over_bigint_far`（`503/driver_connection_error`）⇒ **修后**基线 `MULFRRL5` 与恢复跑 `MULG83F0`（**EXIT=0**）全绿；**正向** `--mutate iv` `MULGHW3E`（注入同形观测）**EXIT=0**、`env_jitter 1`、`expectation_mismatches 0`（raw 1）、`mismatch_cells []`。**★ 三条变异判负（均 `EXIT=1` 且 `env_jitter 0`）**：(i) 期望 409 给 400 `MULG1Z0Y` ⇒ `all_cells_match_expectation=false`；(ii) **非 transient 500** `MULG1Z0H` ⇒ `unexpected_500 1` + `no_unexpected_500…false`（**500 判据不变** ✓）；(iii) 期望 B 码给 A 码 `MULG1Z0V` ⇒ mismatch。⇒ **`env_jitter` 档不吞真错码，我验收通过**。**B（`p2w-00` 五红落码）**：修后 `20260928T162825Zn3c5` ⇒ **EXIT=0 / `reds_count=0`**；D4/D5 加**显式裁决点** `SET CONSTRAINTS ALL IMMEDIATE`（`= 提交点等价`）⇒ **flush 抛 `LD032 / COMMISSION_SPLIT_SUM_MISMATCH`**；D7 转**登记不判**（引 `0011:96–99`/`112–133` + D6 同口径；理由 = 该模式**无闭合后裁决点**、实测 flush 仍 `ok=true`）；E4 改可对照杆（`depth=1` ⇒ `23505/referral_pk`）并**保留**原杆 `23514/referral_depth_rng`；F3 **显式标 `unreachable:true`**（无 judge）+ `F3b` 手写等价继承式可达。**控制杆**：合法事件 flush ⇒ 不报；**摘闸对照 ⇒ 不报** ⇒ **`LD032` 确出自该闸**（非他因）；E1/E2 守卫开 ⇒ `LD003`。**★ F 自曝（点名）**：首跑 `zkdd` 1 红 = **它自己新加控制杆的顺序错**（`55006 pending trigger events`）⇒ 改「先摘闸后造夹具」复跑转绿，**两跑读数都保留** ✓。

**② ★★ Unit G（Neng）verdict = `部分可用`** —— 报告 `docs/qa/p3-errors-fold-fix-review.md` = **285 行 / 29166 B / sha256 `89efdcbe66a6aa9ee331…`**（`## ` 级 **12** 节 §0–§11）。**可用面（L1/L2/L3/L6/L7 全绿）**：真 `ws.ErrorEvent`（绝对路径自建 + 自证 `ctor.name==='ErrorEvent'`、`require('ws').ErrorEvent===undefined`、`instanceof globalThis.Event===false`）等 8 例 ⇒ **503**；**13 例对照 `code/status/details` 逐字节相同**（`control_mismatches=[]`）；**R107 无泄漏**（含 `password=…` 与栈帧文本，`r107_detail_leaks=[]`）+ **服务端面 4/4 可取原文**；**变异判负三态**（baseline `721156cb…` 红 7 / fixed `9bc127e4…` 绿空 / mutated `907a7e61…` 红 7；`diff mutated fixed` 恰 1 行；**未改被检件**）；**`tsc` exit 0**、29 函数 + 4 触发器 md5 逐个相同、43/0、`migrate` 17 skipped；★ **它补上交接件的表名口径缺口**（正确表名 `public.schema_migration` = **17**）。**★ 红面（L4）**：**「除事件族 500→503 外无其它状态变化」被实测推翻** —— 19 处状态变化中 **9 处是真非事件对象**（`new Error()` / `new TypeError()` / 无参 Error 子类 / `Object.create(Error.prototype)` / `Object.create({message:'x'})` / 原型数据属性 message 的类实例 / `{type:'error'}` 信封 / `new Event('message')` / `new Event('open')`）**全部 500→503**；根因 = `ledger-errors.ts:377` 的**判据 ③ 第二子句**（`desc === undefined && typeof o.message === 'string'`）—— 因为 **`Error.prototype.message === ''` 是字符串** ⇒ 任何**没有自己 `message`** 的 `Error` 都被误判为事件对象。**L5 误捕/漏捕矩阵**（交接件标 `NOT_MEASURED`，它补测）：误捕 **7/20 + 2 个非错误 `Event`**，方向**恒为 500⇒503**；漏捕 4/4 未命中，其中 **毒 getter ⇒ 分类器整体抛**（修前修后同、非本单引入，**建议记档**）；**它给的收窄公式**：判据①加 `type==='error'` / **删判据③第二子句** / 留判据③第一子句（自有 getter-only）—— 并给支撑（真 `ws.ErrorEvent` **恒带 `type='error'`**，故删 ③b 不影响真物）。

**③ ★★ 我亲验（不给结论只给读数不算，我亲跑 A/B）** —— 自建探针（`scratch/zang-verify-overcapture-ab.ts`，`baseline = git show 88783a2:…` 实测 sha **`721156cb…`** vs 修后工作树 **`9bc127e4…`**，16 形态逐形态 `normalizeLedgerError` 对拍）：**变化 11/16** —— **A1–A4**（真 `ws.ErrorEvent` / Frozen 事件 / 自有 getter-only / `{type:'error'}`）**500→503 = 预期内**；**B1–B7**（`new Error()` / `new TypeError()` / `Object.create(Error.prototype)` / `Object.create({message:'x'})` / `new Event('open')` / `new Event('error')` / `{type:'error',payload}`）**500→503 = 预期外** ⇒ **G 的 L4 红面独立复现为真**。**根因实测**：`Object.getOwnPropertyDescriptor(new Error(),'message') === undefined` 而 `typeof (new Error()).message === "string"`（值 `""`）⇒ 命中 `:377` 第二子句 ✓。对照：`new Error('boom')`（own 数据属性）/ `{message:'x'}` / `{code:'22003'}` / `{}` **均不变** ✓。**★ 我自己的读数口径更正（避免误伤 G）**：我第一次打印原型描述符只列了 `Object.keys(desc)`（含 `get,set,enumerable,configurable` 四键，**`set` 为 `undefined` 时也在键里**）⇒ **不能据此说「ws 的 `ErrorEvent.prototype.message` 有 setter」，该读法作废**；G 的「无 setter」结论**未被推翻**（我不再追此点）。

**④ 我的裁定（三条）**：**① 采纳 G 的收窄公式**（判据①加 `type==='error'`；**删判据③第二子句**；留判据③第一子句）⇒ 预期净效果：**B1–B7 回到 500（与 baseline 逐字节相同）**、**真 `ws.ErrorEvent` 仍 503**，`new Event('open'/'message')` 释放。**② `{type:'error'}` 业务信封（P4）列为「接受残余」**（理由：`type==='error'` 是标准事件判别位；且 `LedgerError` 实例在 `isLedgerError` 处先被排除、业务响应不经 `normalizeLedgerError`）—— 登记、不修。**③ 顺带修毒 getter 健壮性缺口**（**同一类缺陷**：分类路径对畸形输入无守卫）：分类路径的属性读取（`message`/`code`/`type`/`e.error`）一律经守卫读取，任何 getter 抛 ⇒ 该子句视为**不匹配**（**不抛**）、落**确定性** §14 码。**`errName` 仍不动（§5.59 ⑤ 不变）**。

**⑤ 程序性教训（我自己的，登记）**：**G 作废了一整次 run** —— 因为 baseline 取自 `git show HEAD:`，而**我在它跑的过程中提交了 `ade3376`，HEAD 移动** ⇒ baseline 副本 = fixed。它正确地改用 `HEAD^` 并**用内容 sha 自证**（`721156cb…` 与交接件一致）后重跑 ✓。⇒ **纪律（新）**：**质检单在跑期间不得动 HEAD**；且 **brief 里必须写死「baseline 用内容 sha 自证，不得用 `HEAD` 这个符号自证」**。**G 的独立性声明也很诚实**：它自认「独立判据复算是实现的同构重写，只能校验接线、不能证伪判据形状」⇒ 真正独立性来自**跨三副本观测 + 手造反例（X1 真物 / X2·X3 非错误事件 / P5 `new Error()` / P13 带 setter 访问器）+ 与交接件不一致处的主动追查** ✓（这正是它挖出 L4 的原因）。

**⑥ D20 残差（滚动，我现取 run `20260928T163214Z`）**：`users 673 / account 425 / ledger_entry 3239 / referral 349 / currency 132 / commission_policy 25`（触发器 **43**、非 `O` **0**、`cid=1` **8400==8400** 未破）。**口径说明**：F 的增量表只覆盖其 `p3u` before/after 一对（`583/387/3201/293/123` → `628/414/3220/321/130`），**未覆盖其后的变异跑**（它在 `MULF…`/`MULG…` 各轮继续写库）⇒ **我按现取总账登记**，Unit C 的清单以此为准。**本段合计增长（E→now）**：`users +90 / account +60 / ledger_entry +38 / referral +56 / currency +18` ⇒ **每跑一轮旧套件都在涨**，Unit C 必须建立在「先冻结旧套件」之上（F 已把两套件口径定稿，冻结条件基本具备）。

**⑦ 派 Unit H（Kong）= 窄化 + 守卫**（**纯函数、DB 零写**；形态集**逐字取自 G 报告 §2/§5/§6 三张表**）—— AC：**B1–B7 与 baseline 逐字节相同（=500）**、**A1–A4 == fixed（=503）**、13 对照两态均不变、毒 getter 三形态**不抛**且落确定性码；**判负** = 把窄化回退 ⇒ 探针必须红；`tsc --noEmit` exit 0。**Unit C（残差清理）排在 H 之后**。

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
| R3-P1m（**契约偏差收口**） | Kong | F-6 `toCid` 404→400 + F3 探针改 run-tagged 输出 + 修正报告误格 + 登记 chain 用例非确定性 | 🔄 **跑中** **⚠️ 部分完成且改错：交付 1/2/4（探针侧）+ 证伪我的前提（DB 侧从来不是 400）；因照错前提改代码，反而造出人造不一致 ⇒ 由 R3-P1n 回退** |
| R3-P1l（**spec v0.5**） | Jing | 枚举 §14.3 的 cid/uid 参数分类边界（含 `cid<=0`⇒404）+ 实测对拍表 + 歧义事故留痕 | ✅ **已交付** |
| R3-P1n（**回退错改 + 报告收口**） | Kong | `toCid` 回退 404 + 三段并列读数 + `p1f-acceptance.md` §7.3 误格/§7.5 非确定性/前置更正小节 | ✅ **已交付** |
| R3-P1o（**逃逸类闭合**） | Kong | 17 入口点闸位前移 + 逃逸扫描 604 格（修前 33 ⇒ 修后 0）+ reason 名对齐 | ✅ **已交付（54 calls）；Zang 亲核** |
| R3-P1p（**spec v0.6**） | Jing | §16 #12/#13 + §14.3 增补块 (A)(B)(C) + §19.10 | ✅ **已交付** |
| R3-P1q（**spec v0.7**） | Jing | §16 #12 回填修后读数 + §14.3(B) 数字形状更正 + 立「只准按 code 分支」+ 登记命名整理工作项 | ✅ **已交付（26 calls）** |
| R3-P1r（**五轮必修项**） | Kong | ①`TRUNCATE` 触发器补口 + ②错误码命名整理（四清单）合一次迁移 | ⏳ **排 P2/P3 边界** |
| R3-P2a（**P2 spec**） | Jing | 出 `docs/commission.spec.md`：邀请图 + 版本化佣金政策 + 一次原子事件 + 取整/重归一/边界/可证伪判据 | ✅ **已交付（47 calls）；顶回 16 项，Zang 已逐条裁定** |
| R3-P2c（**两册 spec 收口**） | Jing | `ledger.spec` v0.8（R45 / #32 措辞 / §7.2 #8 / R21 范围）+ `commission.spec` v0.2（落 16 条裁定，重写 §3.2 防环机制） | ✅ **已交付（60 calls，被上限截断但交付物在盘且已核）** |
| R3-P2b-1（**0007+0008 迁移**） | Kong | 邀请图/佣金政策/默认种子/防环机制/Σ断言触发器 + `-1` 白名单扩展 | ✅ **已交付（51 calls，未截断）；Zang 亲核六处** |
| R3-P2b-2（**反向映射闭合**） | Kong | `0009` 补齐 LD031–LD033 反向映射 + **33 码全量往返闭合测试** + TS 表同步 + `status ?? 500` 兜底规则 | ✅ **已交付（60 calls，被上限截断但交付物在盘且 Zang 亲核通过）** |
| R3-P2b-3（**TS 佣金层**） | Kong | 政策读取 + 链游走 + 最大余数法 + 载荷构建 + M1–M9 判据 | 🔄 **跑中（与 R3-P2d-Jing 并行）** |
| R3-P2d（**spec v0.9**） | Jing | `ledger.spec` v0.9：冻结映射补三扩展 + `benign_outcomes` + 往返闭合判据入规范 | 🔄 **跑中** |

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
| v0.121 | 2026-10-01 | **B5-CLAIM 验收（我亲核，撞缺表面已关）+ I18N-LIT-RECON 验收 + 两条裁定**。**A. B5-CLAIM**：`tsc` 0 / 离线 **126/126**（+5）/ HTTP **6/6** / **注册点 67** / **★ 真实 HTTP `claim/24` ⇒ `410`**（含 `reason:CLAIM_RETIRED`）⇒ **恒 42P01→500 的面彻底关闭** / `Δledger_entry=0` / 前端 **126 例** + **调用点 0**（残留仅注释）/ 四语新增 `claimRetiredNotice`。**★ 裁定：保留 `details.reason`**（依 §5.102 D1''「机读走项目级 reason」；既有 6 个 410 面将来统一补 reason，登记批 6）。**B. I18N-LIT-RECON**：报告 81,201 B；**需修复 652 条**（JSX 278/属性 25/JS 349；含注释 1229；含测试 1493）⇒ (a) **已有键未用 49**、(b) **需新增键 545/432 文本**（已给 76 键四语初稿）、(c) 不应国际化 58；**★ 关键发现：`jobs/listings/market` 硬编码 UI 字面量 = 0**（我复核：行级剔除注释行得 6 文件 **18 处命中，逐行看全部是注释**（JSX `{/* */}` + 行尾 `//`）⇒ 可见面 0 ✓；**我原先在同一轮里先写下的「0 命中」结论属「先写后看」，已纠正**）；**核实 Task/Reward 两页未接小标 + 仍用旧三目链 `_en ?? base`**（Task L52–63 / Reward L79–90）。**★ 裁定排期**：B1 骨架(44) → B2 主线三页(132，含小标接线与旧链收口) → B3 登录/工坊核验(55) → B4 后台(333) → B5 组件库/预览(88)；**★ 因共用 locale 四文件 ⇒ 必须串行**。**登记**：解析器非 AST 可能漏检、`NOT_MEASURED` 8 条。 |
| v0.120 | 2026-10-01 | **Neng 生产真浏览器验收（通过）+ B5-MT 缺表族取证（恰 7 名）+ 批 5 裁定 A**。**A. Neng**：vantage=**生产域名**（DNS 劫持旁证：默认 `curl` `remote_ip=198.18.16.176` fake-IP vs `--resolve` `76.76.21.21`）；**① 四语切换真浏览器通过**（prize 19 逐档逐字一致 + job 24 标题/**备注**四语）；**② 12 次渲染 0 空白卡片**；**③ 小标 0 例如实记录**；**④ 两档 12 组合 `scrollWidth==clientWidth` + 底部 Tab 真实点击命中**；**⑤ JS 错误 0**（Tailwind/FontAwesome CDN 单列；smiley-sans 字体 2×404 仅 hk 档外观级）；**⑥ 24 张 PNG**。**★ 范围外真发现（必修）**：**UI 字面量硬编码中文不随语言切换**（`TaskPage.jsx:230`/`RewardPage.jsx:293` 等）+ 两页未接小标 ⇒ 派取证。**B. B5-MT**：缺表族**恰 7 名**（迁移 22 vs 代码 30 差集、**25 处 SQL 引用**、双口径 `to_regclass` 7/7 NULL）；**今日唯一可达面 = `POST /api/task-progress/claim/:jID`（`index.ts:692`）⇒ `42P01` ⇒ 吞成 500**；`/api/auth/verify` 已闭合；其余 6 表零触达；**20 个宿主函数零调用方**；**B 与册正面冲突 4 条**（DL26/DL40/`:168`/`:169` + `ledger.spec §13.1` + `route-layer:1323`）；**④ 重置键四路对拍无需变动**。**★ 裁定 = A（sunset）**：claim 退 410、不删死函数（登记批 6）；**奖励发放无缺口**（现路径 = A1 管理员调分已接账本）；C 吞错归一归批 6。**登记**：p5 引号行号漂移、`users` 24→35、`p3y-01:37` 落后 3 版。 |
| v0.119 | 2026-10-01 | **TR-1c-FIX2 验收（我亲跑）+ 读回面归零 + 「registered 反复」疑点查清（非缺陷）**。**A.** `tsc` 0 / 离线 **121/121** / FIX2 自带 **11/11** / 注册点 **67** / **账本零位移**；判定式 `total===0 \|\| ready===total ? 'ready' : (ready===0 ? 'pending' : 'partial')` 落 `database.ts:792`（引 spec v1.3 §10.15）；**我的纠偏生效**（键恒在 + `ready`）。**B. ★ 归零**：补跑前 `task {ready:19,pending:1}` + `prize {ready:22}` ⇒ 我跑一轮 `scan_translate` ⇒ **`{ready:42}`、`partial=0`、`pending=0`** ⇒ **"翻译中"假信号消除**。**C. 疑点查清（非缺陷）**：总量稳定 **276**、无空 `entity_id`；近期写入全是新出现的 **`job 24`（TR-1b residual）/`job 22`** ⇒ "新内容⇒登记"属正常；**旁证** = `job 8/9/10/11/16/17/18` 各仅 **3 行（仅 title，描述为空）** ⇒ 正好解释此前 `partial`，与修正自洽。**D.** FIX2 拒绝伪造 before/after（我的 before n=56 含 `/api/home` 聚合）⇒ 同口径 before `NOT_MEASURED`；用例未并入离线套件（`dotenv.config()` 会污染 env 敏感组）⇒ 独立脚本承载，理由充分。 |
| v0.118 | 2026-10-01 | **★★ 里程碑：翻译线在生产上线并全绿（真英文/繁体/越南语）+ TR-1c-FIX 验收 + `i18n_status` 分母裁定**。**A. TR-1c-FIX**（截断单）我亲核：`tsc` 0 / 离线 **121/121** / 注册点 **67** / **账本零位移** / **假译文前缀命中 = 0** ⇒ 入库 `e6d482c`；收尾单补报告 + `limit` 默认 **20→100** ⇒ `b98c02f`（**它正确识别我在并发跑外部进程**，把读数标为时点值 ✓）。**B. ★★ 我亲自批量跑真引擎**：8+2+1 批全绿（**0 失败/0 延后**），`mode=translate` ⇒ **`processed=0`（排空）**、`mode=scan` ⇒ **`registered=0`（幂等）**；库面 **276/276 行 `ready`**（currency39/job99/listing117/user21）、`last_error` 空、cache deepseek122+opencc61、**ready 但正文空 = 0** ✓；**生产真域名**：三端点全 200、`{ready:41, partial:14, pending:1}`、假译文 0、真样本 `海鲜礼盒测试丙：虾蟹双拼` ⇒ en `Seafood Gift Box Test C: Shrimp and Crab Duo` / hk `海鮮禮盒測試丙：蝦蟹雙拼` / vn `Hộp quà hải sản thử nghiệm C: Combo tôm và cua`；成本仍**几美分**。**C. ★ 我抓到的假信号**：`partial` 含"本来就没什么可翻"者（7 招工+5 商品**描述为空**，而 job 固定出 `title`+`note` 6 格 ⇒ **空源进分母** ⇒ 小标永挂）⇒ **裁定**：空源格不计入 `total`；**全空源 ⇒ 键恒在、值 `ready`**（Jing 在 v1.3 §10.15 定稿，两选项等价、它留痕采纳）；派 `TR-1c-FIX2`（已纠偏 brief）。**D. Jing v1.3** 我亲核：**2353 行 / 503209 B / `ed0835a3…`**、快照 **`CMP_EXIT=0`**、**v1.1/v1.2 冻结快照未动**、正文删除行 **= 3**（自曝的 3 处就地订正）⇒ 入库 `2561d6e`。**E.** FIX2 ⇒ 入库 ⇒ 推送+生产构建 ⇒ 生产复验 ⇒ 收口报告；**key 轮换建议**已告知。 |
| v0.117 | 2026-10-01 | **TR-1c-B 验收（我亲核）+ ★★ 我读回抓到「stub 假译文对外提供」**。**A. 我亲核**：`tsc` 0 / 离线 **101/101**（96→101）/ 注册点 **67** / **账本零位移**（1989693→1989693、entries 267→267）/ 无跨目录污染 ✓。**B. 交付**：`backfill` 增 `mode` 三态（缺省 **`scan_translate` = 扫存量+翻译 ⇒ cron 自愈** / `scan` 零 API / `translate`）；**单语句** `INSERT…SELECT…ON CONFLICT DO NOTHING`；**幂等实证** 候选 **276**（job99/listing117/user21/currency39）⇒ 首轮 `registered=276`、**二轮 `registered=0` 且零付费**；回执键只增不减。**C. ★★ 我抓到（它未发现）**：`GET /api/task/all` 的 `ready` 里混着 **stub 假译文**（`b3c jobA` 的 `title_en="[en] b3c jobA"`、`vn="[vn] b3c jobA"` ⇒ **TR-1c-A stub E2E 留在真库的行，现被当 `ready` 真译文对外提供**）；它只清了 4 条 stub **缓存**行。**判定 = 污染二次发作**（§5.114 只堵了「自动回落」，没堵「显式 stub 测试写真库」）⇒ 处置：① **数据清洗**（假译文行复位 `pending`+`text=NULL`+`attempts=0`；**假缓存行必须删**）② **结构性守卫**（stub 默认**拒绝写库**，仅 `TRANSLATE_ALLOW_STUB_WRITES=1` 放行 —— **把纪律变成拒绝**）③ 验收含「读回面 `^\[(en\|vn)\] ` 前缀 = 0」**类级断言**。**D. 采信并升级其两登记缺陷为必修**：**DEF-01**（逐语言用**字段子集**校验 ⇒ 部分缓存命中**误判 `KEY_SET_MISMATCH`**）；**DEF-02**（长度比按码点且上限 3.0 ⇒ zh→en/vn 短文本实测比 **3.7–5.2** 系统性判负 ⇒ **`vn` 永不能 `ready`**）⇒ 我裁定**分语言阈值**：`en`/`vn` `[0.3,6.0]`、`hk` `[0.5,2.5]`，Jing 事后回写。**E.** 披露采信（6 行复位、删 4 条假缓存、44 calls）；residual：译文行零删除、保留 276。**F. 下一步**：`TR-1c-FIX` → 我**亲自批量 backfill**（~$0.03）→ 推送+部署+生产验收 → Jing 回写规格。 |
| v0.116 | 2026-10-01 | **Jing 立规格验收（我亲核）+ ★ 两条裁定**。**A.** route-layer **v1.1→v1.2**（2037→2194 行 / 448834→474712 B / `1f8d35a3…`）+ 新 **§10「多语言用户内容翻译线」**（8 条事实带现取行号）+ §8.14；`versions/route-layer.spec.v1.2.md`；`audit/route-layer-v1.2-delta.md`；data-layer **v0.7→v0.8**（1023→1046 行 / `bdee0a8f…`）+ `versions/data-layer.spec.v0.7.md`（改前）。**B. 我亲核**：**本册与快照 `cmp`=0 / md5 逐字相同** ✓；**route 正文删除行 = 0**（纯追加 ⇒「§1–§9 一字未动」成立）✓；**v0.1–v1.1 冻结快照未被触碰** ✓；data-layer 唯一 1 行删除 = 版本声明行（预期）。**C. ★ 裁定**：① **快照惯例采信执行方**（仓内惯例 = 快照取「**新版本号 + 改后正文**」且 `cmp`=0；改前已冻结旧号快照；**我 brief 写「改前内容」属措辞错误**）⇒ **补 `versions/data-layer.spec.v0.8.md`** 使两侧一致；② **注册点 65→66 无需复算**（= §5.109 的 `/api/health` 注册，已在册；`66→67` = TR-1b 的 `backfill`）⇒ 以其标 `NOT_MEASURED` 处由我以入库记录补齐。**D.** 教训：执行方以仓内惯例顶回派单方口径 ⇒ **肯定执行方**，并更正我今后 brief 措辞。 |
| v0.115 | 2026-10-01 | **TR-1c-A 验收（我亲跑）+ ★ 复核其 Σ 口径差 + 引擎回落反转落地**。**A.** `tsc` **0 行**；离线 **96/96**（87→96：`J1` 改 + `J10–J14` + `L1–L4`）；注册点 **67**；只碰 `backend-ts/**`；依赖仅增 `@vercel/functions@^3.9.9`。**B. ★ 我复核 Σ**：它报 `2000200` vs 我记录 `1989693`（差 **10,507**）⇒ 用**同一探针**亲跑得 `BEFORE=AFTER=1989693`、`ledger_entry 267/267`、`sigma_delta_zero/ledger_entry_delta_zero = true` ⇒ **零位移成立**，其数疑含 `frozen` ⇒ 登记**口径注记**（**跨人比较 Σ 必须同口径同命令**）。**C. 引擎回落反转**：`getTranslateConfig` 不再回落 stub；**闸⓪** 非显式 stub + 缺 key ⇒ `markAll('pending','NO_API_KEY')` 后 return ⇒ **不写译文/不写缓存**、`pending` **不烧 attempts**（key 到位后 backfill 可补齐）。**D. 5 条写路径挂 `waitUntil`**：`index.ts:65 enqueueTranslation`（前台批量登记 `pending` + 后台 `scheduleEntityTranslation`；非 Vercel 退化 fire-and-forget；**同步绝不抛**）；挂载 profile/currency/job/listing(create·edit·patch)；前台只登记 `pending(text=NULL)`、后台 en/vn→DeepSeek + hk→OpenCC(免费)。**E. E2E 两模式**：**stub 26/26**（9 行 pending→ready、hk 繁体、`i18n_status=ready`、重复 backfill 缓存 9=9=9）+ **hang 20/20**（挂起 15s：写响应 **1995/1287ms 不受拖慢**、en/vn `failed/TIMEOUT` 且 **text NULL 不写脏数据**、hk 仍 ready）⇒ **B1 形态证据取得**。**F. 登记**：residual listing 20/21/22；`ledger_tx` NOT_MEASURED；**`waitUntil` 真 Vercel 上下文 = 代码事实非实测**；无 `GET /api/listing/:id`。**G.** 下一步 TR-1c-B（**待 key**）+ Jing 立规格（已派）。 |
| v0.114 | 2026-10-01 | **TR-FIX 验收（我亲跑）+ ★ 裁定「引擎回落反转」（防生产写脏数据）**。**A.** TR-FIX（15 calls/123.2s）：后端 **87/87 EXIT=0**（80→87：`HK1..HK5`+`G3-hk`/`H3-hk`；`H6` 加严为「唯一缓存行 = hk/opencc」；`E5` 改 `MemStore(0)`+cap3）；`tsc` **0 行**；前端 **13 文件 126 例** + build 0；**`backend-ts/src/**` 零触碰**（红线生效：只改测试、没顺手改实现）⇒ 入库 `601bac3`。**B. ★ 新裁定**：现行「无 key ⇒ 自动回落 `stub`」**在生产会写脏数据**（stub 形如 `[en] 招聘服务员` 会以 `ready` 入库**并污染缓存**）⇒ **改为：stub 只能显式启用（`TRANSLATE_ENGINE=stub`）；缺 key 时一律不翻**（标 `failed`/`pending`、`reason=NO_API_KEY`、**不写译文不写缓存**，由 backfill/cron 待 key 补齐）；同步改 J1/J2 断言。**C. 排期**：TR-1c-A（写路径 `waitUntil` + 回落反转 + **stub 端到端**〔**只用账本中性写路径**：商品创建/用户 bio；**禁**用发布招工 —— 会动账本〕）→ TR-1c-B（真 DeepSeek，**待 key**）。 |
| v0.113 | 2026-10-01 | **TR-1b / TR-2 验收（我亲核）+ 三个自抓问题**。**A. 用户可见面成立**（我重启后亲测）：`/api/task/all` **20 对象全 `i18n_status='pending'` 且 `title_en`/`title_hk` 逐字等于中文原文** ⇒ **再无空串**；`backfill` 未配密钥 ⇒ **503 `CRON_SECRET not configured`**（fail-loud）✓。**B. 三个自抓**：① **旧进程假红** —— 首测 `backfill` 404 + 空串，真因 = pm2 跑改动前进程 ⇒ 面板单服务重启（pid 23375）后全绿（**改完必须重启再测**）；② **80 例 5 红** —— 我先因解析脚本读 `ok`（实为 **`pass`**）虚报 80 红（探针 bug），真红 5 条**全部是「hk 进 `TARGET_LANGS`」后的期望值过期**（G3/G7/H3 缓存 2→3；H6 LLM 失败仍写 1 条 hk 缓存=正确；E5 `projected 2→3` ⇒ deferred 正确）⇒ **裁定测试陈旧、非退化**；③ **★TR-1b 真发现** —— TR-1a 只遍历 en/vn ⇒ **`hk` 行从不落库**（契约要求有）⇒ 补 `TARGET_LANGS`+OpenCC（`engine='opencc'`、**不付费**）。**C. TR-1b 我亲核**：`TSC_EXIT=0`、**注册点 67**、`Δledger_entry=0`、`Σ=1989693` 不变、零新依赖、`0021` 未改、cron **`0 18 * * *`**（低峰）。**D. TR-2 我亲跑**：**13 文件 123 例全绿**（112+11）、build 0（480.52 kB/70.82 kB）、四语键相等（75/177）+ `i18n.translating` 四语互异、新接 6 文件 `??` 命中 0、无跨目录污染；`MarketPage` 内容面 **0**（逐键取证无用户文本）、发布页不接（表单=原文）、`ProfilePage.bio` 编辑态持原文（防写回）。**E. 裁定**：① **zh 档不显示小标** ⇒ 派修；② 存量三页 `??`（12/6/6）**现状安全** ⇒ 登记不派单。**F. 诚实登记**：E2E 两处列名错 ⇒ NOT_MEASURED + 专用探针重测 Σ；**residual** = `job` id 24 / `listing` id 19（DL79 触发器禁 DELETE）。**G. 下一步**：`TR-FIX`（5 条期望 + hk 断言 + zh 档小标）→ **TR-1c**（`waitUntil` 写路径 + 真 DeepSeek，**待 key**）。 |
| v0.112 | 2026-10-01 | **TR-0 / TR-1a 验收（我亲核四红线）+ 跨片交接面定案**。**TR-0**（`deleg_e4ac0975`）报告 19,166 B + 只读探针 `p4z-p6i18n-00-schema.ts`；**★ 反证我的前提**（三语列**在库与迁移面均不存在**）；`/api/admin/task\|prize/*` **恒 410**；前端**仅 3 文件已接**（HomePage 12 / TaskPage 6 / RewardPage 6），**今天新页全未接**；DeepSeek 契约实测（`response_format` 支持但须提示词自带 JSON 要求；错误码 8 枚全取）。**TR-1a**（`deleg_4b3533dd`）**四红线我亲跑**：`TSC_EXIT=0` 0 行 ✓ / **`total=80 passed=80 failed=0`**（我这一跑 `…T013452Z`）✓ / **`/health → schema_version "0020"`（未 apply）** ✓ / 服务层安全 grep **0 命中** + 无 `frontend/` + HEAD 未动 ✓。**交付物**：迁移 `0021_content_translation.sql`（**164 行 / 10,039 B**；2 表 + 3 索引 + **0 触发器**；★ 具名 CHECK **`status<>'ready' OR "text" 非空`** 结构级「不写脏数据」兜底；全 `IF NOT EXISTS`；**无 BEGIN/COMMIT、无动态 DDL**〔适配 `migrate.ts` 单文件单事务 + `p3x` 静态抽对象〕）；`src/translate-service.ts`（**879 行 / 36,518 B**；可注入 `TranslateStore` + 三重校验 + 缓存 + 成本闸 + stub + `backfillPending`；`REQUEST_TIMEOUT_MS 15000`、`MAX_ATTEMPTS 5`、`DEFAULT_MODEL 'deepseek-flash'`）；离线单测 415 行 **80 例**（validate 15 例逐条判负 + 2 豁免正例）；`p3x` **+2/−1**（`'0021'` + row_count 19→20，**triggers 仍 43**）；依赖**仅** `opencc-js@^1.4.2`。**我四条裁定**：① **`p3y-01:37` = 死副本**（活引用 0）⇒ 不改、登记；② `entity_type/field` 不加 CHECK、`lang` 加 ⇒ 认可；③ 两轮测试失败属正常迭代；④ 七项 `NOT_MEASURED` 登记。**★ 跨片交接面（我定）**：**载荷新增 `i18n_status: "ready"\|"partial"\|"pending"`** + **`*_<lang>` 恒有值（无 `ready` 译文 ⇒ 回落原文、永不空串）**；**TR-1b 产出 / TR-2 消费**。**排期**：TR-1b 与 TR-2 **并行**（契约已冻结）→ TR-1c（真 DeepSeek，待 key）。 |
| v0.111 | 2026-10-01 | **★ 多语言 UGC「录入即自动四语」立项（TR 线）+ 引擎/形态拍板 + 官方报价取数**。**★ 勘误（TR-0 反证，我第四条同类错误）**：三语列**在库与迁移面均不存在**（`grep migrations` 0 命中 + `information_schema` `trilingual_cols:[]`），空串来自**序列化层造键** `database.ts:106 toStringValue(undefined)→''` ⇒ 只做写侧会 **42703**；**`0021` 定案 = 独立翻译表**（`content_translation` + `translation_cache`）+ mapper **回落原文**；**模型名待复核**（官方枚举 `deepseek-flash`/`deepseek-v4-pro`，无 `deepseek-v4-flash`）；排期切片 **TR-1a/1b/1c + TR-2**；重置会清掉现有 19+18 条内容行（与「暂不重置」一致）。**A. 真因**：切语言只有菜单变 ⇒ 查实**库里三语列早已存在但恒为空串**（`/api/task/all` 逐条 `title_en/hk/vn`、`note_en/hk/vn` 全 `""`；`prize` 同理），前端 **`HomePage.jsx:40-80` 已在读**并**回落中文** ⇒ **缺"写入时填"**；全仓**无翻译/AI 管线**（grep 命中全是 CSS `translate`）。**B. 拍板**：引擎 **DeepSeek V4-Flash + OpenCC 繁转**；形态 **B1（写入即返回 + `waitUntil` 补齐）+ 定时任务兜底**；**失败绝不阻塞提交**（留空+待翻译+回落中文+后台重试）；`hk`=**确定性转换**非翻译；输出**三重校验**；**成本闸**（单条字符 + 日条数上限）；cron 排**低峰**。**C. 官方报价（★ 亲取官方页，**第三方聚合数字不一致**）**：DeepSeek V4-Flash 低峰 **$0.15**/1M 输入、**$0.6**/1M 输出（峰值 $0.3/$1.2；缓存命中 $0.003）⇒ 1 万条 **≈$2.2** / 10 万条 **≈$22**；Azure **$10/百万字符**（免费 2M/月）⇒ $20/$380；Google NMT **$20/百万字符**（前 50 万/月免费）⇒ $70/$790；DeepL Pro **$26/月+$27.5/百万字符**；LibreTranslate 自建需常驻机 $20–40/月；**本地模型放不进 Vercel**（250MB 上限 vs 现函数 1.39MB）。**D. env 口径**（值不进对话不落盘）：`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`(默认 `deepseek-v4-flash`)/`DEEPSEEK_BASE_URL`/`CRON_SECRET`；`backend-ts/.env.local` + Vercel（Prod & Preview）。**E. 排期**：TR-0 取证（已派 `deleg_e4ac0975`）→ TR-1 后端（translate-service + `waitUntil` 挂载 + backfill 端点 + cron + 迁移 `0021` + **重置脚本同步**）→ TR-2 前端接三语列 → Jing 立规格。**F. 风险**：加迁移须同步 `p3x-00-rebuild-replay.ts` 否则**重置键失效**；翻译写回**不碰账本**（`Δledger_entry`=0）；Vercel Cron 配额视套餐 ⇒ 端点须支持管理员手动触发。 |
| v0.110 | 2026-10-01 | **★★ Vercel 真实部署验证完成且全绿（生产已切到今天这版）**：`/api/health` **404→200**（`schema_version:"0020"`）、`/api/home` **500→200**、`/api/task/all` **500→200**；**生产登录验签四枪全过**（垃圾 401 / 他人私钥 401 / 真签名 200 / 重放 401）+ **token 层 200**；**生产 bundle 含今日全部前端改动**（`index-BO_DL_Oe.js`，与我本地构建**同哈希**）；区域 **`sin1`** ✓；**回滚点已记**。**A. 三修线上见效**：`env.ts` 前缀映射 + `/api/health` 别名 + `vercel.json` 区域；`vercel inspect` = **`λ backend-ts/src/index.ts (1.39MB) [sin1]`**（旧 `609KB [iad1]`）。**B. promote**：`vercel promote <preview>` ⇒ 新生产 `D6StYHKBtXyMWRfR2eSx6qVrwP3d`，别名 **`seafood-gmxyj0k2r-alwaysfit.vercel.app`**；`seafood-opal` / `seafood-alwaysfit` 均已切换 ✓；**回滚点 = 旧 `seafood-s321tbsj1-…`**（`vercel rollback`）。**C. 生产 GET 矩阵**（`curl --resolve` 强指 `76.76.21.21` 绕开本机 DNS 劫持）：`/api/health` **200**、`/api/home` **200**、`/api/task/all` **200**、`/api/prize/all` **200**（preview 期，含**本地夹具 `tID:23`** ⇒ 同一 Neon 库）、`/` 200 ✓。**D. 生产四枪**（Node `lookup` 覆写；私钥/JWT 不打印）：`challenge` 200 → **垃圾签名 401** → **他人私钥 401** → **真签名 200** → **重放 401** → 该 JWT 读 `/api/user` **200** / `/api/home` **200** → 无 token **401** ✓✓。**★ 探针 bug 照登**：第 4 步 `'got_jwt=' + got.length > 20` 被优先级坑成 `false`；**但第 6 步 token 读 200 ⇒ JWT 确已签发**（**读数异常先怀疑探针**再次生效）。**E. 前端新码确在生产**：bundle 哈希与本地产物一致，含 `pairDegenerate`/`INVALID_WALLET_SIGNATURE`/`market.pairDegenerate`/`listings`/`market` ✓✓。**F. 安全口径**：`SECRET_KEY`（Production + Preview 全分支，`--sensitive`，值未进对话未落盘）+ `.vercelignore`（排除 `.env*`/`docs`/本地产物，已入库）；preview 有身份保护 ⇒ 用官方 `vercel curl` 取数。**★ 遗留**：① **本地领先 `origin/main` 90 提交** ⇒ Git 联动部署仍拿旧码（推送由 Kevin 定）② preview 身份保护保留 ③ 本机 `*.vercel.app` DNS 劫持仍在（本机 curl 必须先 `--resolve`，否则会误判"站点挂了"）。 | 
| v0.109 | 2026-10-01 | **§5.109 P6-VERCEL-SHAPE 验收通过（部署形态三处收口）+ 部署侧凭据/忽略表就位 + 发现本地领先 origin 84 提交**。**交付（Kong `deleg_2c0920cf`，30 calls / 265.7s）**：① `env.ts` **+32/0** 新增 **`VERCEL_PREFIX_FALLBACKS`**（4 对 `规范名 ← SF_*`；**仅 `!canonical && prefixed` 时赋值、已有值不覆盖**，`:51-62`；`SECRET_KEY` 未入表）② `index.ts` **+11/−2**：健康 handler 提为 `sendHealthReport`，**`/health` 与 `/api/health` 共用同一引用** ③ `vercel.json` **+1**：**顶层 `"regions": ["sin1"]`**。**★ 我亲核**：`tsc` **`TSC_EXIT=0`（0 行）**；本地 **`health=200 api_health=200 home=200`** ✓；**注册点 65 → 66** ✓；报告 168 行 + 3 脚本 ✓。**★ 两条硬证据**：① **本地零变化 + 阳性对照**（head vs 现值逐键相同、`overwrote_existing=[]`、`canonical_filled_from_prefixed=[]`；无 dotenv + 哨兵 `SF_*` ⇒ **4 对全触发** ⇒ 探针非恒假）② **区域形状以官方 schema 取证**（`regions` 原文 = Serverless Functions 部署区域；`builds` 弃用且无 `config.regions` 路径）⇒ 选顶层 `regions` ✓。`Δledger_entry` = 0（267→267；`ledger_tx` 不存在时**显式报 `ERR:` 不填 0**）✓。**★ 上报两点**：区域与 `/api/health` **属构建期属性 ⇒ 必须重新部署才生效**（线上仍 `[iad1]`），报告 §7 登记 **6 条 `NOT_MEASURED`**；`.vercelignore` 被登记为**并发写者产物**（**那是我**，处置正确）。**★ 部署侧（我做）**：**`SECRET_KEY` 已入 Vercel**（`--sensitive`，**Production + Preview 全分支**；值走 shell 展开/stdin、**未进对话未落盘**、每步带无 64 位十六进制串自检）；**`.vercelignore`** 排除 `.env*`/`docs/`/本地产物。**根因回顾**：库里变量全带 `SF_` 前缀而代码读规范名 ⇒ 无 dotenv 兜底 ⇒ `/api/home` **500**；`/api/health` **404**（转发保留原路径）。**★ 新登记**：**本地领先 `origin/main` 84 提交** ⇒ Git 联动部署拿旧码（且 `vercel env add` 报「分支不在已连接 Git 仓库」⇒ **确为 Git 联动**）⇒ **推送由 Kevin 定**。**⇒ 下一步 = preview 部署 + 服务端 vantage 外部实测**。 |
| v0.108 | 2026-09-30 | **§5.108 4c-ii-c 前端收尾验收通过 ⇒ ★ 前端线全部完成**。**交付（Kong `deleg_2345af74`，43 calls / 372.4s）**：改 `frontend/src/{auth.js,WalletAuthPanel.jsx,pages/market/{MarketPage.jsx,market-api.js},test/unit/{auth.test.js,listing-market.test.jsx}}` + 四语 locale + 报告 + 产物 ✓。**硬 AC**：① build **`BUILD_EXIT=0`**（**479.19 kB**，我亲跑）② 单测 **`TEST_EXIT=0`（12 文件 112 例，基线 105 ⇒ +7，我亲跑）** ✓✓ ③ 四语 locale **深键集逐文件相同（176/文件）** ✓ ④ 几何：`/shard` **diff = 0** + `perturbation_detected=true` + 日夜往返逐字节相同 + 真换肤 ✓。**① 两条登录 401 文案四语覆盖**：`auth.js:119-122` `SERVER_MESSAGE_I18N_KEYS` + `:125-127` `i18nKeyForServerMessage` + `:163-171` **三档优先级**（`i18n_key` → 原文映射 → 兜底 `请求失败(status)`；**不空白、不出 `[object Object]`**）；值落 `locales/*:75-76`（键名逐字一致、en 为本语种提示、**原文 0 残留**）✓。**② 退化币对**：`MarketPage.jsx:50-55` 拆三旗标、**`:56-66` 先判退化 → 落空态 `return`、不触 fetch**；**区分**「真无挂单」与「币对退化」（`market.pairDegenerate`）✓；后台 `ShardsManagement.jsx:60` 同形取数**未动**（越界、登记）✓。**新增 7 单测**（两条映射 + 未知兜底 + 无文案兜底 + 退化不发请求 + 空态区分 + 四语深键集对拍）✓。**★ `/login` 重定向（它 NOT_MEASURED）**：**我独立查证** `App.jsx` 路由表**确有 `path="/login"`**、**仅有 `/*` 兜底（无 `*`）** ⇒ **我未能复现** ⇒ **裁定登记为「待复现疑点」、不当缺陷立案**（当场应用 §5.102 新纪律）✓。**自曝采信**：jsdom/node `URL` 差异致两轮 vitest 失败（已修留痕）；HTTP e2e 展示面 `NOT_MEASURED` ✓。**⇒ 前端线收口；剩余 = 批 5 其余 + 批 6 + 批末重置（待 Kevin）+ Vercel（待 Kevin）**。 |
| v0.107 | 2026-09-30 | **§5.107 Jing v1.1 验收通过（2037 行 / `3f0aef0e…`，7 delta、唯一非追加改动 = E9 锚点刷新）★ 我亲核 `cmp` = 0 + v1.0 快照未动 + 新节齐 + `auth.ts` 锚点带行号；「顺序即语义」入册**。**交付（Jing `deleg_6a0d77be`，22 calls / 884.5s）**：spec **v1.1 / 2037 行 / 448834 B / md5 `3f0aef0e49aa6c2fff0380045888209a`**；快照 **`cmp` exit 0 + 双 md5 相同**；delta 件 **187 行**；**v0.1–v1.0 十快照未动**（我亲核 v1.0 快照仍 `c68f525340e2c9e0b2fdb1277a56acb6`）✓。**七条 delta**：① **§3.6（`:775`）「登录必须验签」硬规则** + 四判据表 + **两层关系逐字**（token 层 P4-SEC / 签名层 P5-SIG-VERIFY）+ **顺序即语义（验签 `:221` 先于消费 `:230`）** + 判负 4 + 零新码/reason/kind（锚点 `auth.ts:182/:221/:223/:226/:227/:230`、`index.ts:354/:379`）② **§1.13** `ethers@^6.17.0` 入册 + 部署须带 lockfile + 与 Tailwind CDN **区分** ③ **§3.7** 登录端点口径（`getUserAsset ∥ emptyAsset(uID)`、`index.ts:364`、不得回退写 `asset`、无行 ⇒ 200+0、`42P01` 归零）④ **§9.B·B14 + §7-48** 两条 401 文案四语（前端现取 0 命中、运行面 `NOT_MEASURED`）⑤ **§9.E**：**E9 锚点刷新 `:1200-1202`→`:1206-1208`（旧留痕 = 唯一非追加）** + 新增 **E10**（`claim` B5-2 默认退役一句话可改）+ §7-47 ⑥ **§1.12**（`index.ts` 1645→**1651**、18 条 +6、`auth.ts` 240→**261** + 全套锚点刷新）⑦ **不变项**：注册点 **65** / `410` **6/6** / kind 关闭集 **20** / `Σ(cid=1)` **1,989,693** / `ledger_entry` **267**（转引）✓。**自曝采信**：`auth.ts` 改前行数为推断、「+6」归因为推断（逐条行号为现取）、**「两条 401 是否并入 R107 面」本册不裁 ⇒ 我裁定不并入**（登录面明文文案 vs 权限面 R107，**不同域**；R107 门槛不变）✓。**⇒ 规格线追平代码（v1.1）；下一步 = 4c-ii-c 收尾**。 |
| v0.106 | 2026-09-30 | **§5.106 SIG-VERIFY 验收通过 —— HIGH 安全洞已堵（签名层）★ 我亲手复打：垃圾签名 200→401、真签名 200、他人私钥 401；依赖只装 `ethers@^6.17.0`；pre 9/11 / post 11/11；抖动瞬态经我复测非回归**。**交付（Kong `deleg_52465130`，37 calls / 433.4s）**：`src/auth.ts` **+24/−3**（3 hunk）+ `package.json` **+1**（`"ethers": "^6.17.0"`）+ `package-lock.json` **+98/−0**；**`index.ts`/`database.ts` 未动**、`migrations` 零改、无 git 写、**仅面板 `{sid}` 重启一次**；报告 `docs/audit/p5-sig-verify.md` + 2 脚本 + 产物 ✓。**★ 真根因**：`consumeWalletAuthChallenge` **修前从不读 `signature` 就 return**（删掉的正是两行 `bypassed signature verification` 注释）⇒ 任意地址 + 垃圾签名换真 JWT；**修法 = 对签发时原文消息做 EIP-191 `personal_sign` 恢复 + 大小写不敏感比对** ✓。**★ 判据（同脚本改前/改后）**：② 垃圾签名 **`200`(真 token 已签发) → `401` `Invalid wallet signature`** ✓✓；③ 他人私钥 **`200` → `401` `Signature does not match the claimed address`** ✓✓；①真签名/⑤校验和变体/④重放 = `200`/`200`/`401` 一致 ✓；`pre` **9/11（exit 1，FAIL 恰为 AC2/AC3）**、`post` **11/11（exit 0）** ✓✓；⑥`tsc` 0、⑦注册点 **65**、⑧`410` **6/6**、⑨**Δentries=0 / Σ(cid=1)=1989693 不变**、⑩ 新钱包 `200`+`points=0`（**B5-FIX-LOGIN 未被打回**）、既有 401 面保持 ✓。**★★ 我的独立验收**：**垃圾签名 ⇒ `401`**（改前我亲测 `200`）✓；**真签名正例我独立跑**（现场生成新钱包签原文）⇒ **`200 ok=true uid=970211 points=0`** ✓；**他人私钥 ⇒ `401`** ✓；改动面亲核（`auth.ts` 24/3、dep 只有 `ethers`）✓。**★ 抖动瞬态（我复测非回归）**：`/health` 曾 503 一次、`/api/home` 曾 500 一次 ⇒ **复测 `/health` 200×3、`/api/home` 200×6（键集正常）、`task/all`/`prize/all`/`challenge` 200** ⇒ **瞬态 1/7、属既有 A 档驱动债务** ✓。**自曝**：探针读 `data.uid`（真源 `uID`）已更正；收尾瞬时 503 时 `state=running`/`pid` 未变（非自退）⇒ 未二次重启 ✓。**★★★ 我裁定**：① **「登录必须验签」列硬规则 ⇒ 交 Jing 下一轮**（含四判据 + `ethers` 依赖 + 两层关系）② **前端两条新 401 文案需四语覆盖**（归 4c-ii 收尾）③ `ethers` 入册为**服务端运行依赖**（与前端 Tailwind CDN 债务人不同）④ **安全线两层齐：token 层（P4-SEC）+ 签名层（本单）⇒ 「任意地址冒充任意用户」HIGH 债关闭** ✓。 |
| v0.105 | 2026-09-30 | **§5.105 B5-FIX-LOGIN 验收通过（登录修复：新钱包 401→200、`points=0`、`Δledger_entry=0`、改动仅 +7/−1）+ ★★★ 我亲手复现 HIGH 安全洞「服务端不校验签名」⇒ 立案派 SIG-VERIFY**。**B5-FIX-LOGIN（Kong `deleg_947aba5e`，23 calls / 1289.2s）**：① **新随机 EVM 地址走完 verify：改前 `401`（响应体 `relation "asset" does not exist`）→ 改后 `200` + `points=0`** ✓✓；② 存量用户 `200`（`points=7600` = 库内 `account.balance`）✓；③ 无/伪造 token、空签名、地址不匹配 ⇒ **401×4 保持** ✓；④ `42P01` 归零 ✓；⑤ `to_regclass('public.asset')` = **ABSENT**、登录链调用点已摘除 ✓；⑥ `tsc` 0 ✓；⑦ 注册点 **65→65** ✓；⑧ 410 **6/6** ✓；⑨ **Δentries=0 / `account_rows_cid1` 16→16 / `Σ(cid=1)` 1989693→1989693（Δ=0）** ✓（`Δusers +2/run` = 既有侧效应）。**改动唯一 = `index.ts` +7/−1（`:358`→`:364`：`upsertAsset(uID,0)` → `emptyAsset(uID)` + 6 行根因注释）**；未动 `database.ts`/`auth.ts`/`migrations`（**未建表**）、未建户；选边依据写清（读源已 `account`、同族先例 `:496-498`、登录只展示 points ⇒ 空态 0 正确）✓。**同族收口**：`upsertAsset` 5 处逐点判定（登录 1 处已修；`claim` 2 处按裁定只登记；`database.ts` 另 5 处登记、HTTP 可达性 `NOT_MEASURED`）✓。**事故**：Neon 抖动 3 次自退（`TypeError: Cannot set property message of #<ErrorEvent>` → `exit 1`）⇒ **只走面板 `{sid}` 路由复原**；**我复核现态 `/health` 200 + `/api/auth/challenge` 200 = 登录可用**；属**既有 A 档债务** ✓。**★★★ 我的独立复现（决定性）**：**第一枪作废**（我用 `{"address"}` ⇒ `400 Invalid EVM address`；真字段 = `evm_address`/`signature`/`challenge_token`）⇒ **先怀疑自己**重打；重打 ⇒ challenge `200`（真 EIP-4361 风格消息 + nonce）、**verify 带签名 `0xdeadbeef` ⇒ `200 success:true` + `uID:970207` + 真 JWT**；对照：同 challenge 二次 ⇒ **401「已消费或过期」（nonce 单次消费有效）** ⇒ **任意地址 + 垃圾签名即可登录 = 完整身份冒充（HIGH）**；**与 P4-SEC 不同层**（P4-SEC 修 token 伪造；**签名层从未校验**）✓。**★★★ 我裁定**：① **立即立案并派 `SIG-VERIFY`**（EIP-191 `personal_sign` 恢复地址比对；**至多安装一个**包、优先复用仓库已有依赖、确无则只许 `npm install ethers` 并报版本；**四硬 AC**：真签名 200 / 垃圾 401 / 他人签名 401 / 重放 401，用本地自建 `Wallet` 真签；**不得放宽其它鉴权面**；challenge 单次消费与过期语义保持；不得建表）；② **交 Jing 下一轮**把「登录必须验签」列为硬规则；③ **产品级安全修复 ⇒ 不等 Kevin**（属我职权内安全裁决）✓。 |
| v0.104 | 2026-09-30 | **§5.104 Jing v1.0 验收通过 + ★★ P5-TRIAGE 定性「新用户 100% 登不进站」⇒ 我裁定 B5-1 立即修复、`claim` 待 Kevin**。**Jing v1.0（`deleg_87ba5fa6` task-0，24 calls / 471.8s）**：`route-layer.spec` **v1.0 / 1849 行 / 417626 B / md5 `c68f525340e2c9e0b2fdb1277a56acb6`**；快照 **`cmp` = 0 / md5 相同**；delta 件 20152 B；**v0.1–v0.9 九快照未动**；**非追加改动仅 1 处**（§5.1 加注、旧文留痕）。**8 条 delta**：§4.5 幂等键**硬规则**+11 行逐面表+判负 / §3.5 **D1''**（不得依赖 DB `DETAIL`、一律项目级 `reason`）/ §4.10 **A1 落定**（有符号 amount、±100000、`requireAdmin` 先行、`ops:` 键）/ §4.9 **数值定值**（10,000/10,000/50,000/100,000，挂「Kevin 2026-09-30 定值」）/ §5.6+§5.1 加注 **`prize-item` 非 sunset** / §4.11 **缺表族 7 表 + 两活路由 + 批 5 + D1'** / §2.5 **前端接线映射表** / §1.12 **注册点 65 不变 + 行号漂移 18 条**（`index.ts` 1575→**1645**、`/api/job` :1289→**:1359**）⇒ 以现盘为准。**它自查两处（我裁定）**：① `ADMIN_POINTS_ADJUST_MAX_PER_CALL` 现取 **`:1182`** vs 我记 `:1180` ⇒ **两者都对、a1li 改线致漂移** ⇒ 以现盘为准；② **新登记缺陷**：A1 入参不完整分支 `:1200-1202` = `sendError(400,'参数不完整')` ⇒ **非 R107 形状** ⇒ **§9.E·E9**（它自己复现过 ⇒ 立案合规）。**★★ P5-TRIAGE（task-1，25 calls / 440.2s）**：报告 242 行 + 产物 + 2 只读脚本。**① 两条活路由都还有人用**（双口径 + `dist/` 旁证）：`/api/auth/verify` → `frontend/src/auth.js:169`（唯一调用方 `WalletAuthPanel.jsx:111`）；`/api/task-progress/claim/` → `ClaimRewardModal.jsx:49` + `RewardPage.jsx:154`（均在在册路由内）。**② `auth/verify` 确在 EVM 登录主链上**：`AuthPage.jsx:153`→`WalletAuthPanel.jsx:105`→`auth.js:158`→`WalletAuthPanel.jsx:111`→`auth.js:169`→`index.ts:354/358`；**`:358` 的 `getUserAsset || upsertAsset` 是登录事务内取余额、不可绕过**。**③ 爆炸半径实测**：`users_total=24` / **无 `cid=1` account 行 = 12（50%）**；**新钱包必然无 account 行 ⇒ 100% 触发** `42P01` ⇒ **401**；`upsertAsset` 两分支都指向缺表 ⇒ 恒抛；`claim` 首次领取（`:670`）无条件 ⇒ 恒 `42P01` ⇒ 现 **500**。**④ 真根因线索**：`index.ts:496` 注释显示**读端点同族回退早已修好、登录端点 `:358` 未同步收口**。**⑤ D1' 升级为受控实测**：`NeonDbError{code:null, message:'Error connecting to database: fetch failed'}` ⇒ 无码可 map ⇒ 现 `auth/verify` **401**（`:373`）/`claim` **500**（`:683`），**规格期望 503**（`:1158`）；驱动位置 `index.js:1544`。**⑥ 7 表选项表**（R/L/K）+ **批 5 清单 8 项 B5-1…B5-8**（带 `文件:行号`+验收命令）；**更新**：`adjustPoints` 已改接账本 ⇒ `asset` 活触达面只剩 `auth/verify`+`claim`+market 家族（未测）。**★★★ 我裁定**：① **B5-1（登录）立即修复、不等 Kevin**（主链且对新用户 100% 致命 = 产品阻断；**修复不需复活旧积分体系**：与读端点同族收口对齐 = 只读 `account`、不再写 `asset`）⇒ **派 `B5-FIX-LOGIN`**；② **B5-2（`claim`）待 Kevin**（旧积分铸造/领取面 = 发行口、产品决策）⇒ **我默认 = 退役 `410` + 前端停止调用显「已下线」，一句话可改**；③ B5-3…B5-8 排在 B5-FIX-LOGIN 之后（market 家族写侧**先取证**）；④ **D1' 归批 6**（方向 = 归 503）；⑤ **§9.E·E9 并入下一批**。 |
| v0.103 | 2026-09-30 | **§5.103 4c-ii-b 验收通过（商品线 + 交易所线 + 四项确认）★ 我亲跑红线（build 0 / 12 文件 105 例，+15）+ 4 页主题同构 diff = 0；★ 它纠正我误登记（`/api/prize-item` 非 sunset）；★ 我追证 `/api/market/1/orderbook` 恒空 = 非缺陷（退化币对）；★ 我第三次「未经复现的假设」入教训**。**交付（Kong `deleg_8d03368f`，60 calls / 2193s，★ TRUNCATED）**：新页面 `pages/listings/**`（5）+ `pages/market/**`（3）+ `test/unit/listing-market.test.jsx` + 改 `App.jsx`/`ShardPage`/`RewardPage`/`ProfilePage`/`jobs/*` + 四语新增 `listings`/`market` 段（四语同键集）+ 探针 + 报告 230 行 + 产物；**后端零改动** ✓。**★ 我复跑**：`BUILD_EXIT=0`（**477.73 kB**）、`TEST_EXIT=0`（**12 文件 105 例**）✓。**接线**：商品线（`POST /api/listing:1492` → `PATCH :1545`；`/api/prize/all:382`；`/api/prize/:bID:433`；`/api/prize-item:546`；`/api/listing/:id/buy:1569`；`/api/listing-orders/:id/refund:1590`）+ 交易所线（`/api/order:751`、单撤 `:805`、全撤 `:782`、订单簿 `:829`、成交流水 `:844`、我的挂单 `:729`，经 `ShardPage` 薄壳）。**关键实测**：伪造 `price/seller/buyer/owner_uid` **全被忽略**（DB 行 + 分录为证）；**退款后 `stock 2→2` 不回滚**（合我 §5.95②）；**撤单 `hold_release ×2` + `trade_fee` = 0**（手续费不退，合 DL87）；HTTP **22 读数 / 14 旗标全 true**、**产物 token 字节 = 0**；几何 4 页 **日/夜 rect diff = 0** + `contains_object_object=false` + 扰动可判/复位 + 横竖屏签名一致。**★ 四项确认**：① 审核入口按权限隐藏（`/api/admin/me`，非 admin **不渲染且不请求**）✓；② 流水空态零请求 ✓；③ **+15 单测**（上单弱点闭合）✓；④ `/api/shard` 系**全移除**；**`/api/prize-item` 实测非 sunset**（`listing_order` 买家轴 + 退款 `order_id` 唯一来源）⇒ **保留 + 登记偏差** ✓。**★★ 我裁定**：① **`/api/market/1/orderbook` 恒空 = 非缺陷**（`(1,1)` 退化币对、空为正确语义；页面已用 `/api/market/<base_cid>/orderbook`，测试断言 `/api/market/7/orderbook`；旧 `:bID` 口径已删）⇒ **但登记小项**：市场页须区分「币对退化/真无挂单」且 `base_cid===1` 不发查询；② **`prize-item` 保留正确、我的登记更正**（**我第三次未经复现的假设**）；③ 截断单 `NOT_MEASURED` 照登。**★ 两处真根因修复（记功）**：`/shard` 几何 diff=14 真因 = **描边用了日档值 `none` 的主题 token** ⇒ 改结构常量 + 双档色 token + `box-sizing` ⇒ 复测全 0；单测 OOM 真因 = `useTranslation` 替身每次返回新 `t` ⇒ 改模块级稳定 `t`。**边界**：未碰 `src/**`/`migrations`/spec/既有 audit/**token 值**；无 git 写/install/常驻 server/`pkill` ✓。**⇒ 前端三线接线完成；下一批 = 批 5 + 批 6 + Jing v1.0**。 |
| v0.102 | 2026-09-30 | **★ §5.102 D1 勘误（作废）+ 两条真缺口登记 + M 面 9 键全命中（0 条 500）+ 我的教训「立案前必须自己复现」**。**交付（Kong `deleg_d7f90a7b`，30 calls / 347.5s）**：报告 `docs/audit/p4-err-fidelity.md`（**218 行**；md5 我读 `616609f1…` vs 它报 `6232dfa9…` ⇒ **口径差、以盘面为准**）+ 产物 `errfid-20260930T140652Z/{mech-cases.json,http-cases.json}`（无 token 明文）+ 2 脚本；**未改任何 `src/**`/`migrations/**`/spec/`frontend/**`** ✓。**★ 核心结论 = 推翻我的立案前提**：**驱动不丢码**（`LD0nn` 与标准 SQLSTATE 同形、`code` 逐字正确）；**✅ 我亲核结构证据** `@neondatabase/serverless/index.js:1542-1544`（**只有 400 分支读 `{message,code}`，非 400 抛 `Server error (HTTP status N)`、`code` 恒 null**）✓；**案由在 HEAD 不可复现**（`uID=-1` ⇒ 实测 **400 `LEDGER_RESERVED_UID`**，来自**路由前置闸** `index.ts:1209`/`:1250`，我亲核 ⇒ **请求根本没到驱动**；上单观测只能出自改前形态或另一路径 ⇒ **症状不是成因**）。**★ 真缺口 D1'（结构性、未触发）**：非 400 分支丢 `code` ⇒ 落 500（12/12 全走 400、`driver_http_status_leak` 全 null）⇒ **我裁定归批 6、且这类传输类错误应归 503（不是 500）、先补只读观测面**。**★ 真缺口 D1''（已实测）**：驱动**恒不搬运 `DETAIL`/`constraint`** ⇒ 409 体带 `details.detail_unavailable='driver_did_not_carry_detail'`（12/12）⇒ **我裁定：规格不得依赖 `detail`，API 用项目级 `reason`；交 Jing v1.0 写入**。**★ 真值表 33 键**：**M 面 9 键全命中规格期望、0 条落 500**（`LD001`409/`LD002`409/`LD003`409/`LD007`404/`LD017`400/`LD021`400/`LD022`404/`LD023`400/`LD027`503）= **正面结论（错误码契约基本可靠）**；R 面 3 读数；**3 条 500 全是对照组非账本码**；**27 键 `NOT_MEASURED`**。**★ 我的教训（已进技能）**：**立案前必须自己复现一次**；上游「观测」未经复现不得当立案依据 —— 本轮**第二次**同类（前次转引 `§1.8:51` 未核）。**自曝采信**（首版猜错表名 `42P01` = 标准码不丢的旁证；本机无 `psql` ⇒ 直连对照子证据 `NOT_MEASURED`、以对照+`ledger_sqlstate_of` 等效替代）。 |
| v0.101 | 2026-09-30 | **§5.101 A1-LEDGER-IMPL 验收通过（后台调分改接账本）★ 15/15 两轮 + `Σ(cid=1)` 差额恰等 + 幂等重投零分录；★ leg 形状现场现取未发明（记功）；★★ 立案新类级缺陷 D1（`ledger_raise` 自定义 SQLSTATE 经驱动丢失 ⇒ 500）并派取证单**。**交付（Kong `deleg_309746df`，55 calls / 1566.2s）**：`database.ts` **61/23** + `index.ts` **58/13**（我亲核）+ 报告 219 行/14 节 + 脚本 + 产物；**未建任何表**、未动 `migrations`/`ledger.ts`/`ledger-errors.ts`/spec；无 git 写；仅面板重启 ×2 ✓。**★ 我亲核**：`tsc` **0 行 exit 0**、`/health` 200、**注册点 65**、`:963` `op: amount>0?'mint':'entries'`、`:975` `platform=true`、`:977` 单腿 `kind:'burn'`、`:989` 单 `SELECT ledger_post_event`、**`asset` 残留只在 `upsertAsset`/`getUserAsset`（属批 5）**。**★★ leg 形状现取（记功）**：`0020:156` op 白名单**无 `burn`** ⇒ **正 ⇒ `op='mint'`（`platform=true`、恰 1 条 `+n`）**、**负 ⇒ `op='entries'` + 单腿 `kind='burn'`**；`ref = currency/cid`；照抄 C1/C2 ✓。**实测**：`+137`⇒200 `mint`（余额 0→137、`Σ`+137、txid 259）；`-37`⇒200 `burn`（137→100、`Σ`−37、txid 260）；`±100000`⇒200 / `±100001`⇒400；`0`⇒400；**非 admin⇒403（含超上限仍 403）**；无 token⇒401；**幽灵 uid⇒400 且 `Δentries=0`（零开户）**；`-1`⇒400；缺键/坏前缀⇒400。**幂等**：4 用例同键重投 ⇒ 200 replay、`Δentries=0`、`ΔΣ=0`、**txid 逐字相同** ✓✓。**账本面**：243→255；`mint 5→9`、**`burn 0→4`（首次启用）**、`Σ(cid=1)` 2,000,000→**2,000,200** = `+137−37+100000−100000` **恰等** ✓。**回归**：410 **6/6**、C1/C2 下限仍挡 400、**A1 的 `42P01` 归零** ✓。**★★ D1 新类级缺陷（已派 ERRCODE-AUDIT）**：`ledger_raise` 自定义 SQLSTATE 经 neon HTTP 驱动 **`code` 丢失 ⇒ 归一化成 500**（改前证据 `-1` 面 = `NeonDbError: LEDGER_RESERVED_UID` 却 500 露面）；本片用**路由前置闸**绕开该面，**残留 = `burn` 超余额 `LD001` 面仍 500（未测）**，落点在被其禁写的 `ledger.ts`/`ledger-errors.ts`；**影响面可能很大**（凡自定义 SQLSTATE 的账本错误都可能以 500 露面、与规格 400/409 不符）。**D2** 审计+日累计 ⇒ 批 6。**D3** 照登：夹具残留 **6 行 `users`** + **并发写者**（`job_escrow +4`，cid≠1）。 | 
| v0.100 | 2026-09-30 | **§5.100 4c-ii-a 验收通过（招工线 + 我的）★ 幂等键逐面声明守住 §5.96④；流水读口未注册 ⇒ 空态 + 不自造；真实 HTTP 12 步全链；两新页主题同构 diff = 0**。**交付（Kong `deleg_40782d5d`，51 calls / 1666.0s）**：新增 `frontend/src/pages/jobs/{PublishJobPage,JobDetailPage,JobReviewPage,job-api.js,jobs.css}` + `App.jsx`/`TaskPage.jsx`/`ProfilePage.jsx` + 四语 locale + 探针 + 报告（后端**零改动**）。**★ 我亲核**：`BUILD_EXIT=0`（**455.84 kB**，较上版 +20 kB ⇒ 新页面入包）、`TEST_EXIT=0`（11 文件 90 例）、改动面净、`src/**` 改动 = **在飞 a1li** 所为（它已披露 ✓）。**接线面**：`task/new→POST /api/job`、`task→GET /api/task/all`、`task/:jobId→GET /api/task/:tID + /apply + /accept + /api/task-progress/:identifier/submit`、`task/review→GET /api/tasklist/pending-verification + POST /api/job/:jobId/review`、我的余额 = `GET /api/user/asset/:uID`（5 键）；**「流水」读口未注册（`/api/user/ledger` = 404）⇒ 空态 + 登记，不自造** ✓。**★★ 幂等键逐面声明**：发布 = 前端 `cli:`（服务端 fail-loud `job-funds-service.ts:84`）；申请/提交 = **服务端派生**（`job-service.ts:180/:133`）；接受 = 无键面；审核 = 事件根键派生（`0013:592`）；余额/流水 = 纯读 ⇒ **派生面前端一律不传键** ✓（正是我 §5.96④ 裁定）。**真实 HTTP 12 步**：发布 `400`缺键/`401`/`200`（17 键、`job_escrow`×2）/同键重投 `200` 且**库内 1 行** → 列表可见 → 详情 `200`/`404` → 申请 `404`/`200`（派生键）/`409` 自投 → **接受 `403` 非雇主零分录 / `200`** → **提交 `200`（9 键）/`403`/`409` 同实体异内容（永久回归项未退化）** → 审核 `403`（零分录）→ 余额 `200`（5 键）。**主题同构**：`/task/new`、`/task/review` **日/夜 rect diff = 0**、真换肤、DOM 签名相等、逐字节可重复、**1px 扰动检出并复原**、横竖屏签名相等、无 `[object Object]` ✓✓。**★ 我三条裁定 + 一待核**：① **审核面 = 管理员面**（`requireAdmin(review_tasks)` 唯一真源）⇒ **前端须按权限隐藏入口**，确认归 4c-ii-b；② **流水只读接口归批 6/7 决策**（本轮空态正确、不得就地自造）；③ **弱点登记：3 新页面 0 新测试**（例数 90 未增）⇒ 4c-ii-b 必须为新增交互补测试；④ **待核**：聚合 grep 仍见 `/api/prize-item`、`/api/shard`（**sunset 面**）调用 ⇒ 4c-ii-b 逐文件核并清理。**`NOT_MEASURED` 3 项**（审核成功面 —— 无 admin 夹具、负例已测；提交同内容 replay；雇主侧队列待裁 ⇒ 已裁）。**自曝 4 条采信**（探针列名误用已修；无 DB 轮读数作废；环境级 driver 错误重跑 3 次；**`src/**` 改动非本单所为已披露** ✓）。**⇒ 下一步 = 4c-ii-b（商品 + 交易所 + 四项确认）**。 |
| v0.99 | 2026-09-30 | **§5.99 A1-LEDGER-DESIGN 取证验收通过 + ★ 我四条裁定（A1 走选项 A / 有符号 amount / 审计登记批 6 / `asset` 缺表族立批 5）+ ★ 更正我一处引证错误（`§1.8:51` 不存在 ⇒ 真源 = §1 端点处置表 #51 = `:176`）+ 派 A1-LEDGER-IMPL**。**交付（Kong `deleg_3e779a59`，36 calls / 466.5s）**：报告 `docs/audit/p4-a1ledger-design.md`（**261 行 / 41.7 KB**）+ 只读探针（走 `neon()`、纯 SELECT；**无 git 写、无 DDL/DML、未启停服务**、`src/**`/`migrations/**`/spec 全未碰）。**① 类级差集**：迁移侧 **20 真表**（+`users` 由 `0006:75` RENAME）= 21 名字；**`asset` 在迁移面命中 0（双口径）** ✓（与我独立取证一致）；差集真项 8、**7 项真缺**（`asset`/`task`/`task_progress`/`prize`/`prize_item`/`shard`/`shard_transfer`；`schema_migration` 存在 19 行）；逐项给函数 `file:line`/读写/触达路由/**吞成 404·401·500·200 空态四种面**/spec 行号。**★★ 新发现**：**`POST /api/auth/verify`（`:352`→`:356`）在无 `cid=1` account 行时撞 `42P01` → 吞成 `401`**、`POST /api/task-progress/claim/:jID`（`:633`→`:657/:668`）**两条在册活路由被牵动**；旧表族多为 `410` 死写；**三个 GET 零命中**（不误伤）✓。**② 四册齐核**：kind = **`mint`/`burn`、仅 `$`(cid=1)**（`data-layer:343/:292/:513`、`route-layer:176/:640`）；方向（`route-layer:662`）；**平台 uid `0` = 铸币源**（`ledger.spec:827`）+ 白名单 `ledger.ts:535-555`（**`mint` 仅 uid 0 credit 侧、`-1` debit 恒空**）+ DB `ledger_assert_platform_mutation` 在盘；上限 100000（`index.ts:1180`）；**「日累计」四册 0 命中**；**审计表 P6 尚不存在**；`commission.spec` 对 A1 **0 命中**；**7 条张力只列不裁**（最硬 = 无方向参数 ⇒ **`burn` 不可表达**，`:1191/:1197/:1213`）+ 注册点漂移（spec `:1066`/`:995` vs 现取 `:1182`）。**★ 更正我的引证错误**：`§1.8:51` **不存在**（`:51` 空行、§1.8 起于 `:304`）⇒ 真源 = **§1 端点处置表 #51 行 = `:176`**；**原引用作废**。**★★★ 我裁定**：① **选 A**（改接 `ledger_post_event` + `mint`/`burn`）；**否 B**（建 `asset` 表与 `data-layer:166/:217`、`ledger.spec:821` **正面冲突 ⇒ 双真源**，且不解审计）；**C 仅作退役备选**；② **有符号 `amount`**（正 ⇒ `mint` 到目标用户、负 ⇒ `burn` 从目标用户、**上限按绝对值**）⇒ 我 §5.97② 裁定**经四册齐核成立** ✓；③ **审计表登记批 6、不得建表**；④ **`asset` 缺表族立批 5「缺表族清理」**（默认 sunset 处置；**唯 `auth/verify` 与 `task-progress/claim` 两处需 Kevin 一句话** ⇒ **我默认 = 不复活、一句话可改**；前端影响待 4c-ii 回执后扫）。**⇒ 已派 `A1-LEDGER-IMPL`**。 |
| v0.98 | 2026-09-30 | **§5.98 4c-i + 4c-i-FIN 验收通过（主题 token 层 + 横竖屏骨架 + app shell）★ 真实浏览器实测日/夜同构；两条自曝裁定为债务/验证腿**。**交付（`deleg_4e95fd55` 截断 → `deleg_bdb3e608` 10 calls / 153.3s 收尾）**：`theme/tokens.js`（458 行；**107 主题 token** 日/夜键集与顺序相同、103 值不同、4 同值；+ **32 结构常量** + **10 条 `EXCLUDED_FROM_THEME`** 带行号理由）+ `theme-tokens.css` + `ThemeProvider.jsx`（**零 DOM**；`localStorage['theme']` + `<html data-theme>`）+ `shell/{breakpoints.js,nav.js,BottomTabBar.jsx,AppShell.jsx,shell.css}` + `pages/ThemePreviewPage.jsx`（`/theme-preview`）+ 2 个新测试 + **几何探针**；导航 5 项**真提取自现有路由**；顺带闭合「四语缺 `shard` 键」（69→70）。**★ 我独立复核**：`BUILD_EXIT=0`（435.55 kB / 1.53s）、`TEST_EXIT=0`（**11 文件 90 例**，基线 9/63）、报告 **305 行/16 节**、`geometry.json` 字段亲核（`geometry_diff_count: 0`、`day_repeat_byte_identical: true`、`day_return_byte_identical: true`、`skin_changed: true`、1px `detected: true`）、改动面全在写集内 ✓。**真实浏览器读数**（Chrome 154，无 server/端口、CDN 全 abort）：**日/夜 rect 逐值相等 14/14**；主题只变外观（bg `#fff→#141619`、radius `13px→2px`、shadow 有→none）；整份读数**逐字节可重复**；**1px 灵敏度真判出**（`29→30`）后回基线；日→夜→日**逐字节回基线、DOM 节点 772=772**；**1440/390 签名同串**（差异只在导航形态/栅格）⇒ **同构 AC 在离线确定性环境下达成** ✓✓。**★★ 我裁定其两条自曝**：① **`tailwind is not defined`** 源自 **Tailwind 走 CDN** ⇒ **登记为新债务**（离线/弱网/内网不可用 + 外部依赖；建议批 6/P7 改本地构建）；② **线上 Tailwind 环境 rect 未测** ⇒ **后续验证腿**（报告 §5 共 10 条 `NOT_MEASURED` 全带原因/替代证据，无 0/空）✓。**⇒ 下一步 = 4c-ii（业务页接真实接口 + 横竖屏 UX）**。 |
| v0.97 | 2026-09-30 | **§5.97 A1-CAP 验收通过 + ★ 它挖出真缺陷（库内无 `asset` 表而代码写 `asset`/读 `account` ⇒ A1 恒 404）+ 我裁定并入 A1-LEDGER（先四册齐核）+ 派类级取证**。**A1-CAP（Kong `deleg_93d5ce69`，43 calls / 1756.9s）**：改动 = **仅 `src/index.ts`，`numstat` = 25/0（我亲核）**；常量 **`ADMIN_POINTS_ADJUST_MAX_PER_CALL = 100000` @ `:1180`** + 单点校验位 `:1196-1211`（超限 ⇒ `400 LEDGER_AMOUNT_INVALID` + `OVER_MAX_SINGLE_AMOUNT` @ `:1209`；`≤0` ⇒ `NOT_A_POSITIVE_INTEGER` @ `:1201`）；**零新造码** ✓；`requireAdmin` 未动且**先于金额校验** ✓。读数：`100001` `404`→**`400`**；`0`/`-5` `404`（改前确不拒）→**`400`**；非 admin **403**；无 token 401；`tsc` 0；**注册点 65**；**410 6/6**；C1/C2 下限仍生效；报告 155 行/13 节 + 产物（secret/JWT 泄漏 0 已程序化校验）。**★ 真缺陷（它暴露、非它引入，我独立复核）**：**A1 成功面恒不可达 200** —— 库内**无 `asset` 表**（`information_schema` 22 表）而 `database.ts:895 UPDATE asset`/`:910 INSERT INTO asset` 写它、`:866 FROM account` 读 ⇒ 恒 `42P01` → 吞成 `404`；**★ 我的证据 = `grep -rniE 'create table[^;]*\basset\b' migrations/` 空**（不必碰库即证）+ 错配行号亲核；改前/改后 fp **逐位相同** ⇒ 非本单改变。**⇒ 类级问题 ⇒ 全仓扫**。**★ 它的关键口径纠正（采信）**：ΔΣ=0 **≠ 纯转移**，而是「**该路由完全不接账本**」⇒ 「账本分录正确」**不成立**，它**拒绝用 0 冒充合规** ✓。**★ 审计核查**：无通用审计表；`currency_status_log` **不能冒充复用** ⇒ **未建表**、登记批 6 迁移项（`admin_audit_log`）✓。**★★ 我裁定两问**：① **A1 接账本必做，但先四册齐核（㊹）再实施** ⇒ 并入 `A1-LEDGER`；「成功面 200」缺口**登记不阻塞前端线**（现为**响亮失败**、**不移动资金** ⇒ 无资金风险）；② **`≤0` 改为「有符号」**（`0<\|amount\|≤100000`，正 ⇒ `mint`、负 ⇒ `burn`），**须经四册齐核确认后落地**，过渡期保留现状（拒 `≤0`）⇒ 因该路由本就 404、**无实际资金影响**。**⇒ 已派 `A1-LEDGER-DESIGN`（只取证不裁决）**；**4c-i-FIN 仍在飞**。 | 
| v0.96 | 2026-09-30 | **§5.96 NUM-1 + 4b-i 验收通过（4b-i 为截断退出、我独立复核后采信）；A1 上限未落（越界纪律正确）⇒ 派 A1-CAP**。**NUM-1（Kong `deleg_7ad0d484` task-0，54 calls / 2038.9s）**：三下限常量真名 = `CURRENCY_CREATE_FEE_FLOOR`(`:142`)/`CURRENCY_LIST_FEE_FLOOR`(`:143`)/`CURRENCY_LIST_DEPOSIT_FLOOR`(`:144`)，**我亲核 = 10000/10000/50000**（注释 = 「Kevin 2026-09-30 定值」，消费点 `:235/:348/:350` 未动）；**边界 9/9**（`9999`→400 / `10000`→200；`49999`→400 / `50000`→200；details = `{min, reason:"BELOW_SERVER_FLOOR"}`）；未传金额 ⇒ 200 + `fee_source=server_default`；幂等重投 replay；**`Σtotal` Δ=0、`frozen` 不变、entries +12 纯转移零铸币**；回归 `/health` 200·410 6/6·**注册点 65（我亲核）**·`tsc` 0。旧值探针：`p4z-b3b-02-e2e`（19+9+2 处）与 `p4z-qa-b3-03-http`（4 处）改为**跟随源码下限**（再变不误红）；**历史片 `p4z-b3a-02-e2e` 只登记不重写**（其 `:207` 与新语义冲突）⇒ 处置正确。**★ A1 上限未落且它「正确地不越界」**（检查点在 `src/index.ts:1175`，不在我给写集 ⇒ 只登记不实现）⇒ **我授权 `A1-CAP` 补单**（开 `src/index.ts` 写权）+ 审计留痕缺口核查（审计仅 `console.log`，**不满足 §4.8 类②**；无表则登记为批 6 迁移项）；落法沿用 **`LEDGER_AMOUNT_INVALID`**(`ledger-errors.ts:49`) + 复用 reason **`OVER_MAX_SINGLE_AMOUNT`**(`currency-service.ts:125`)，**不新造码**。**4b-i（Kong `deleg_7ad0d484` task-1，60 calls / 1441.8s，★ TRUNCATED）**：**我亲跑两条红线** ⇒ **`BUILD_EXIT=0`**（419.95 kB / 1.57s）、**`TEST_EXIT=0`**（9 文件 **63 例**，基线 61）；`git status` 改动面 = **恰好 `frontend/**` 14 件（含新 `idempotency.js` 3410 B）+ 报告 + artifact**；抽查 `extractApiErrorMessage`（`auth.js` 2 处）、`AUTH_UNAUTHORIZED` **四语各 1**、5788/5787 监听均为面板托管服务（非残留）✓。落码对齐 §2.4 S1–S10/§9.B：`R107` 形状（`auth.js:108-155`，动态 import 避开 `vi.mock('react-i18next')`）、四语键、`ops:` 键三片四写口 + 键形与 `canonicalAdminOpsKey` 逐字同形、`ShardPage` `cli:` 键（三读为真）、撤 body 改 query（`:346-349`）、只读化（业务零调用）、旧断言留 legacy + 新 401/410 两用例。**★ 我裁定其分歧 —— 它是对的**：母单③点名 `ActiveTaskModal.jsx:50` 补键，但 §2.4 S10/§9.B B10 明文条件触发、且 §4.5 契约 3「有自然标识 ⇒ 派生」⇒ **该面已有服务端确定性派生键，前端自造 `cli:<uuid>` 会把重试变第二行**（正是母单③要防的）⇒ 采信「按权威清单不改」，**要求 Jing v1.0 在 §4.5 补「服务端已确定性派生键的面，前端不得自造键」**。**照登**：B8 `/api/user/points` 迁移目标端点未注册 ⇒ 保留空态不迁（迁移会 404 更坏）✓；`frontend/` 无 eslint 配置（exit 2、基线同码）⇒ 既有债务；`sunset` 值面属后端、本单无写权；`NOT_MEASURED` 5 项。**事故**：**Neon 抖动触发既有驱动 `ErrorEvent` 缺陷 ⇒ 服务自退 2 次**，**只经面板 `{sid}` 路由重启（零 `pkill`）** ⇒ 我复核 `/health` 200 + `/api/home` 200 ✓（抖动下曾 6/10 500）—— **既有 A 档债务、非回归**；首跑读数作废（改常量后漏重启）**它自曝** ✓；探针 `child.kill()` 孤儿已**按精确 PID kill（未用 `pkill`）**。**⇒ 已派 `A1-CAP`；4c-i（主题 token + 横竖屏骨架）待 4b-i 入库后派**。 | 
| v0.95 | 2026-09-30 | **★ §5.95 Kevin 四问四答与四项落地**。**① 重置 —— 我撤回建议、暂不重置**：Kevin 问「为什么要重置？」⇒ 我复盘后发现**重置会清空 213 条分录与全部夹具，而 4b/4c 前端阶段正需要这些数据当开发/演示环境**（空库页面无可渲染），且**残差不影响正确性**（六次自算守恒全成立、`23514` 未触发、负值 0）⇒ **裁定：重置推迟到「前端收尾/上线演示前」**；**前置条件已自证**（dry-run 六闸全绿、单事务、失败即 ROLLBACK）⇒ 随时一条命令可跑。**② 7-7 回滚**：Kevin 问「为什么要回滚？」⇒ 我给理由并**裁定保持「不回滚」** —— **退款是卖方单方善意补偿、不隐含退货** ⇒ 恢复库存会造成「退钱的同时把同一份货再卖一次」的**账面超卖**；叠加「退款发起人 = 仅卖方」（§5.88②）更证其为单方动作；**单点 = `listing-funds-service.ts:55`**；**「退货→入库→恢复库存」登记为后续业务闭环**（批 6/7 定，届时是**另一个事件**）。**③ 7-23 数值（Kevin 授权我定）**：以「1% 佣金下 10 万酬金 ⇒ 1000 手续费」为锚的阶梯，且 `$` **目前无 faucet** ⇒ 现为有量级感的**起始值**、关键是**从占位改成定值 + 留在可配置位置**：**建币费 `currency_create_fee` = 10,000 `$`**、**上市费 `listing_fee` = 10,000 `$`**、**上市保证金 `listing_deposit` = 50,000 `$`**、**A1 后台调分单笔上限 = 100,000 `$`/笔**（+ 权限 + 审计；日累计留后续）⇒ **派 NUM-1 落地**。**④ 「按计划推进」⇒ ★ 正式撤销 `frontend/**` 冻结边界 + 4b 开工**：**4b-i = 前端兼容性同步**（§9-B：`R107` 形状 / `ops:`·`cli:` 幂等键 / 已弃用面（碎片页）/ 键集按面适配 / 四语 locale / 两条行为 delta 复核，**红线 = `npm run build` exit 0**）⇒ 本轮派；**4b-ii = 页面接新接口**（`/api/job*`·`/api/listing*`·`/api/currency*` 的 UI 接线）；**4c = web 横屏 + 手机竖屏 UX**（主题 token 复用 `style-preview.html` 变体 A 日档 / B 夜档，与 P7 同源）。**已派 `deleg_7ad0d484`（NUM-1 + 4b-i）**。 |
| v0.94 | 2026-09-30 | **§5.94 Jing v0.9 验收通过 + ★ 重置键在 19 迁移后 dry-run 六闸全绿（我亲跑）+ 台账收尾 ⇒ 后端线无阻塞项**。**交付（Jing `deleg_224fda49`，23 calls / 245.3s）**：`route-layer.spec` **v0.9 / 1554 行 / 364777 B / md5 `8558aa84eb0812fa4f4fb6be34270959`**（+162 行；快照同指纹 + `cmp` exit 0；**v0.1–v0.8 八快照未动**；**非追加改动 = 20 行**（delta §D2 逐行列明，全为状态列/已注册事实、旧写法同地留痕））+ delta 件 115 行（D0–D11）。**折入**：① **§1.8 十一条 →「已注册（批 4a）」**+ 逐条 `src/index.ts` 行号（1289/1305/1327/1352/1380/1404/1422/1448+1475/1499/1520/1540）+ **注册点 53→65** + **清单已清空/无遗留** + **§9.A →「已关闭」**；② **A5 新路径 = `jobEventView` 15 键**（旧路径 11/9 冻结键集**不变、不得串**）；③ **A6 = `requireAdmin(review_tasks)` / A11 = `manage_settings`** 点名（**复用既有键、不新造**）；④ **§4.8 二分 → 三分**（新增 ②「授权主体意图额」：权限闸 + 上限校验（`TODO: Kevin 定值`）+ 审计留痕 + 判负三条；A1 两格就地改留痕）；⑤ **§4.5 点名 C1 派生输入 = `symbol`**（C2 = `cid`；**唯一 fail-loud = 3b 的 `job`**）⇒ 「`/api/currency` 不 fail-loud」**非缺陷**；⑥ 新 **§1.11** 登记 4a/QA-B4 十项事实；⑦ §7：7-29/7-40 就地更新 + 新增 **7-41**（HTTP 级 `-2` 抽查，低优先）/ **7-42**（键数口径）+ 补注 ⑪–⑬（**7-1…7-28、7-30…7-39 一字未动**）。**★ 我复核其两处「待复核」口径差 —— 均不构成错**：① A5 键数以逐键枚举 **15** 为准（QA-B4 记 16）；② **作用域差**：`jobEventView` 本体 **14** + `submissions_reviewed` = **A5 面 15**（A6 面 14、A1 面 17 ⇒ 每个路径各有自己的面，与我「键集按路径冻结」一致）⇒ 规格已写明、无需再改；`+323/−2` 因已提交无法现取复算 ⇒ 转引 QA-B4 §2.1 并双锚点标注 = 正确。**★ 重置键再验证（我亲跑、无 `--apply`）**：`ok: true` / `exit_code: 0`；**`version_order_ok: true`、`tx_final: ROLLBACK`、`identical: true`、`injected: false`、`checksums_all_byte_equal: true`、`comparison_inside_tx: true`** ⇒ **J1 六闸在 19 迁移 + 全部改动后仍全绿、重置键可用**（**「批末重置」的前置条件已自证**）。**台账**：仓库仅剩 1 个残留未跟踪件（`QA_B4_RUN_TAG.txt`）⇒ 本单入库。**⇒ 后端线无阻塞项**；剩余 = (i) 待 Kevin 三项（批末重置 / 7-7 / 7-23+A1 上限）；(ii) 前端 4b/4c（待其点头解冻）；(iii) 批 6（权限种子迁移 + `isAdminAddress` 收敛 + `app_config` 合法键登记 + 数值/上限落地）。 |
| v0.93 | 2026-09-30 | **§5.93 QA-B4（注册切片独立质检）验收：7 腿全 PASS；★ 三开口全收口**。**交付（Neng `deleg_746113a4`，47 calls / 378.3s）**：报告 `docs/qa/p4-b4a-route-registration-qa.md`（326 行）+ 产物 4 件 + 4 探针；边界自证（未碰 `src/**`/`migrations`/`frontend`/spec、无 git 写、无删除 SQL、**未重启服务**（PID 9139 存活）、token 泄漏 0）。**★ 三开口**：① **被替换的 2 行 = import 语句**（`./job-service` 4 符号行 + `./job-funds-service` 的 `verifyJobSubmission` 行），**5 符号同名同模块原样重导入（超集）** ⇒ `grep -cE '^-app\.'` = **0**、`comm -23`（旧 53 ∖ 新 65）= **0** ⇒ **既有路径零影响**；② **腿归因真差额 = 0**：`189 →(+8 QA-B3 夹具) →(+2 A1 首笔) →(+14) → 213`，4a 实写 **16 腿**归到 `job/16·17·18`+`listing_order/6`；**单元「差 2」真因 = 其 pre 快照取在 A1 落账之后**（基线读成 199、应为 197），其「3×refund 6」亦不自洽（**实测 2×refund 4**）⇒ **我的 `189→213 (+24) = 夹具 8 + 4a 16` 完全对齐** ✓✓；③ **`fee>0` PASS**：`reward=100000 ⇒ fee=1000`、`job_payout`×2 + `job_fee`×2（**`-1` `+1000`**）、`commission` 0 腿（无链）、`Σtotal` 不变。**其余腿**：注册面 **65** ✓、抽样 5 条既有路径未变 ✓、**410 面 6/6** ✓、`Σtotal` 2,020,100（pre/post 恒）✓、负值 0、`23514` 未触发 ✓、**migrations 19/19 checksum 匹配（`mismatches=[]`）** ✓、`ledger.ts`/`ledger-errors.ts`/`commission.ts`/`frontend/**`/`.env.local` 自 HEAD **SAME** ✓。**★ 我裁定其两条诚实登记**：① **`/api/currency` 不 fail-loud**（负例探针意外成真实写 +2 条 `currency_create_fee`）⇒ **非回归**且**与我的 §4.5 契约一致**（**C1 自然标识 = `symbol`** ⇒ 属「有标识可派生」侧）⇒ **接受**，**要求 Jing 在 §4.5 点名 C1 派生输入**；② **`-2` 形态 `NOT_MEASURED`**（造链需 `/api/referral/bind`，超其写库允许面）⇒ **不算缺口**（**3b 已在服务层实测两形态**：无邀请人 ⇒ `-1`；真链 depth 2 ⇒ `-2` 进 +10/出 −10）⇒ 仅留「HTTP 级 `-2` 抽查」为后续低优先项；③ 首轮 `503/503/500` = Neon 抖动、复测 `200/200/200`（`/api/stats` 稳定 `403` = 权限语义）。**⇒ 下一步 = Jing v0.9（§1.8/§9-A 行状态、A5 键集 15、A6/A11 权限点名、§4.8 三分、§4.5 点 C1 输入、注册点 65）+ 解冻前端（待 Kevin）**。 |
| v0.92 | 2026-09-30 | **§5.92 4a（已实现未注册路径接线）验收通过 + ★ F-1 集成缺口关闭 + 三处口径更正 + 派 QA-B4**。**交付（Kong `deleg_24e731a6`，47 calls / 594.6s）**：`backend-ts/src/index.ts` **仅路由层**（服务层零改动）⇒ **注册点 53 → 65（+12）**，逐条路径→行号（`/api/job` 1289、`/:jobId/apply` 1305、`/accept` 1327、`/submit` 1352、`/review` 1380、`/cancel` 1404、`POST /api/listing` 1422、`POST /api/listing/:id` 1448、`PATCH /api/listing/:id` 1475、`/buy` 1499、`/api/listing-orders/:orderId/refund` 1520、`/api/admin/commission_policy` 1540）；报告 `p4-b4a-route-registration.md`（198 行 / 9 节 / `72f93737…`）；`tsc` 0；面板重启 → `/health` 200。**★ 我亲验**：① **注册点 = 65**（grep 逐位相符）；② **第六次自算守恒** `Σtotal 2,020,100 不变`、负值行 0、`ledger_entry` **213 = 逐 kind 之和**；③ **冻结面 0**（`database.ts`/四 service/`migrations`/`frontend`/`.env.local`）；④ 越界面 = 恰好 `index.ts` + 3 新件。**采信**：**34 条 HTTP**（A1 `200`+`job_escrow`×2 / 缺键 `400 LED004`；A2 `200`·重放·`404`·`409 LD003`；A3 `200`·非雇主 `403`·重复 `409`；**A4 与既有 `/api/task-progress/:identifier/submit` 键集逐键一致（9 键）**；A5 approve `200`（job→`settled`）+ 重放 `200`、reject `200`、非 admin `403`；A6 `200`+`job_escrow_refund`×2、`escrow_txid IS NULL`⇒`409`；A7–A10 全绿（`purchase`×1+`sale`×1、`purchase_refund`×2、`delisted` 终态 `409`、非卖家 `403`）；A11 `200`/越界 `400 FEE_RATE_OUT_OF_RANGE`/非 admin `403`）；**★ F-1 缺口关闭（同一 job 走通 A1→A2→A3→A4→A5）**；夹具键全 `cli:b4a:*`（守前缀纪律）；回归 5 GET 200 + **410 面 6/6** + `prize/999…` 404。**★ 我三处口径更正**：① 它报「53 行一行未改未删」**不精确**（实为 **+323/−2**，2 行被替换、身份待点名；因 65 = 53+12 未丢路由）；② 其「`ledger_entry` +14 vs 16 腿差 2」**基线漏算 Neng QA-B3 的 4 个夹具事件** ⇒ 不可比，**我的可比读数 = 189→213**；③ A5 的「11/9 键」是**旧路径冻结键集**，新路径入参 `job_id` ⇒ 需服务层读口（本片禁改）⇒ 新路径成功面 = `jobEventView` **15 键**。**★ 我裁定**：① **接受新路径 15 键**（不动服务层；旧路径 11/9 键集不变、两者不串）⇒ Jing 写入 §2；② **A6 `cancel` = `requireAdmin(review_tasks)`、A11 = `manage_settings` 均接受**（**原则：复用既有权限键、不新造**）⇒ Jing 在 §4.2/§6 点名；③ 预算 ~54 超 45 采信自曝。**⇒ 已派 QA-B4 收口三开口（2 行身份 / 以 QA 后状态为基线重做归因 / `fee>0` 非退化结算形态）+ Jing v0.9 待其返回**；**依纪律（质检在跑不入库）4a 与 §5.92 暂不入库**。 |
| v0.91 | 2026-09-30 | **§5.91 Jing v0.8 验收通过 + 我裁定 A1 金额归类（二分升三分）+ 我的 17 行读数被现盘证实**。**交付（Jing `deleg_062f4a93`，22 calls / 331.3s）**：`route-layer.spec` **v0.8 / 1392 行 / 328365 B / md5 `f3420d1fbafdb0a99005b8c593fb95a1`**（v0.7 = 1102 行 ⇒ **+290 行**；快照同 md5 + `cmp` OK；**v0.1–v0.7 七快照未动**；**`diff v0.7 vs v0.8` 被替换行 = 11**（10 处就地订正 + 头部标记）、其余全追加、无行被移动）；delta 件 105 行 / `30a9a9fc…`。**折入**：① **§4.7.4 `LD001–LD033` 全键普查**（真值表写全，真源 `ledger.ts:1030–1062` + `ledger-errors.ts:28-70`，逐键给 HTTP 状态）；**9 键**（`LD004/012/013/015/025/026/027/028/029`）`grep -c` = 0 **逐键表态**（与 Neng §6.1 吻合）；**残余明写**：**503 家族（`LD025/026/027`）本册无状态码条文（§3.2 缺 `503` 行）⇒ 只登记不发明** ✓；② **8 处期望码格就地订正（旧写法留痕）**：`400 LD022`×4 + P2`:552` 的 `400 LD020` ⇒ **`LD021`**；C1`:558`/C2`:559` 的 `LD018` ⇒ **`LD017`**；复算 = `LD021` 5 / `LD022` 4（全在 404 列）/ `LD020` 0 / `LD023` 0 ✓；③ **★ §4.8 金额来源二分立法**（3 规则 + 三问判据 + 逐事件表（J1/J5/J6/P1/P2/P4/M1/M2/M3/C1/C2/R3/A1，逐行给「客户端可传/服务端取数 + 文件:行号」）+ 判负 5 条；**`reward` = 供给侧自主出价**）；④ **§5.5 `sunset` 三形态**（「批 4 删路径」已定、**具体日期 `待 Kevin`、未写任何日期**）；⑤ **★ §9「批 4 施工清单」A–E 五栏**（项目/真源锚点/行动/前置依赖/验收判据）：A = §1.8 十条+附注（**A3 `/accept` 最高优先**）、B = `S1–S10` + `S-b3e-1/2/3`、C = 两条行为 delta 回归核、D = **DL68 残余加固（必带 4 条判负）**、E = 旧直写三函数收口（`database.ts:3268/3360/3422`，**外部调用方 0**）；⑥ §7：`7-31` 状态列 ⇒ 已定 + 新增 **7-34…7-40**（**7-1…7-33 未重排未改**）；⑦ 路径正典 §4.2 P4 ⇒ `POST /api/listing-orders/:orderId/refund`（§1.2 张力关闭）。**★ 我裁定其唯一开口项（A1 `amount` 归类）⇒ 二分升三分**：① **供给侧自主出价**（`reward`/挂单价，客户端可传、无上限校验）；② **授权主体意图额**（如 A1 后台调分 —— 客户端可传，**但必须**权限校验 + **服务端上限校验**（上限标 `TODO: Kevin 定值`）+ **审计留痕**）；③ **平台侧费/保证金/费率**（**只能服务端**）⇒ 交 Jing v0.9。**★ 我的口径差更正**：`grep -c 'LD023'` **现盘 17 行 = 我 §5.89 记的 17** ⇒ **是它 v0.7 自报的 16 差 1**（我上轮记成「我的口径差」**过头了**，已更正）；决定性判据仍 = 「**期望码面内 `LD023` = 0**」。**⇒ 下一步**：**4a = 注册 §1.8 十条路径（纯后端，无需解冻前端）立即可派**；4b/4c（前端同步 / web 横屏+手机竖屏 UX）**需 Kevin 对「解冻 `frontend/**`」表态**。 |
| v0.90 | 2026-09-30 | **★ §5.90 QA-B3（批 3 资金线独立质检）验收：8 腿全 PASS、无 P0/P1；★ 它替我把「410 面」补测成 6/6；★ 我亲核两条命门；裁定其 6 条发现（D3 我推翻其定性、D4 是我的 brief 错）**。**交付（Neng `deleg_c184d1c7`，38 calls / 376.2s）**：报告 `docs/qa/p4-b3-funds-qa.md`（**393 行 / `217795f0…`**）+ 产物 6 件 + 4 探针；**7 条 untracked、零 `modified`** ⇒ 「未改代码/规格」为真。**★ 我亲核**：① **单写路径命门** —— 我自己 `grep` `INSERT INTO public.ledger_entry`/`UPDATE public.account`/`UPDATE public.ledger_owner` 于 `src/**` = **0 命中** ✓✓；② **`LDxxx` 真值**（`ledger.ts:1046/1047/1049/1050` = `LD017 AMOUNT_NOT_POSITIVE` / `LD018 DECIMALS_OVERFLOW` / `LD020 ACCOUNT_NOT_FOUND` / `LD021 RESERVED_UID`）⇒ **其 D1/D2 两条 spec 码表错成立** ✓；③ 基线（HEAD `6553599…`、spec md5 `13823f…`、`git diff HEAD --stat` 空、无活写者）✓。**8 腿**：0 基线 PASS｜**1 守恒 PASS**（**逐行自算 `Σtotal 2,020,100` == 账本独立推导 `Σ(mint)−Σ(burn)` 2,020,100**、189 行 == 逐 kind 和、每类 kind 整除预期倍数、负值 0/漂移 0、**它写 4 个夹具事件后 Σ 不变**）｜**2 单写路径 PASS**｜**3 冻结面 PASS**（migrations **19/19** sha == 注册表 checksum）｜**4 服务端取数 PASS**（price/对手方/fee 全服务端 `market-service.ts:498-545`）｜**5 幂等契约 PASS**｜**6 LD 全键普查 PASS**（33/33；spec 从未提及 **9 键**；§4.7.1 只覆盖 5/33）｜**7 ★ 410 面 PASS**（**6/6 = 410 + `LEDGER_REF_NOT_FOUND` + `details.sunset`、Δentries 0、无需 token** ⇒ **我此前被安全层拦下而待补测的项由独立方补齐**）｜**8 负例 PASS**（孤儿行 0；自成交 NOT_MEASURED（M3 无路由））。**★ 我六条裁定**：① **D1+D2+§7-31 三条同类 ⇒ 合并交 Jing v0.8 一次订正**（**`LD001`–`LD033` 全键普查** + 33 键真值表写全（补 D6 缺 28 键）+ 对 spec 未提及的 9 键逐键表态）；② **D3（J1 `reward` 实为客户端传入）⇒ 我推翻其定性：不是缺陷**（招工酬金本就该由雇主自主出价；**只有平台侧费/保证金/费率必须服务端取数**）+ 要求更正那条自述不符的注释 + **spec 显式区分「客户端可传金额」与「服务端取数金额」**；③ **D4（我 brief 给的夹具前缀 `qa-b3:` 违反 §4.5 ⇒ 实测 `400 PREFIX_REQUIRED`）= 我自己的 brief 错**（正解 `cli:qa-b3-*`）⇒ 纪律：今后质检/探针单夹具前缀必须用 `cli:`/`biz:`/`ops:`；④ **D5（`sunset` 无日期）** ⇒ 13 个弃用面要么给日期、要么写「随批 4 移除」；⑤ D6 并入 ①。**⇒ 批 3 资金线独立质检全 PASS**；下一步 **Jing v0.8** + **批 4（前端接线 + §1.8 十条未注册路径）**。 |
| v0.89 | 2026-09-30 | **★ §5.89 批 3 收官：3d（交易所）与 Jing v0.7 双双验收通过；我第五次自算守恒；裁定 3d 七问 + Jing 两开口**。**A. 3d（Kong `deleg_177fc8a6` task-0，45 calls / 710.8s）**：**新建** `src/market-service.ts`（589 行；M1 `placeMarketOrder:239`/M2 `cancelMarketOrder:366`·`cancelAllMarketOrders:389`/M3 `matchMarketOrders:448`）；`database.ts` **+5 method**（`marketPostEvent:1804` 唯一写路径；`resolveMarketOrder`/`resolveMarketCounterparty`/`listOpenMarketOrderIds`/`currentFeeRateBp`）；`index.ts` **3 条既有路由改接**（`:741`/`:772`/`:795`）⇒ **注册点 53→53**；报告 + 全账户 dump + 3 探针；`tsc` 0。**★ 我亲验**：① **第五次自算守恒** `Σtotal 2,020,100 = 2,000,000 + 20,100 夹具铸币`（**与自报逐位吻合**）、负值行 0、`ledger_entry` **86→189**；② **逐 kind 枚举等式逐项一致**（`hold` 4→46（+42=21×2）、`hold_release` 6（+6=3×2）、`trade` 32（8×4）、`trade_fee` 16（8×2）、`transfer` 8→12、`mint` 2→5，其余 9 kind 未变，总和 189）；③ **DL68 我亲读实现**：`database.ts:1809-1813` = `WITH l AS (SELECT pg_advisory_xact_lock(baseCid, quoteCid) AS k) SELECT public.market_post_event(...) FROM l` ⇒ **锁与事件同语句**；④ 冻结面 0、注册点 53。**采信读数**：**DL68 实测**（外部持 (4,1) 锁 1.5s ⇒ 同币对调用**被阻塞 +961ms**；**同币对两笔并发 = 恰 1 成功、`amount_filled 1 ≤ 1`、无超额成交**）；成交 **6 腿**（`trade`×4 + `trade_fee`×2、taker 付 30→`-1`）；**客户端传价/对手方/fee 全丢弃**；撤单释放且 **`trade_fee_delta=0`（DL87 手续费不可退）**；三次重投新增分录 0；负例齐（自成交 400 `SELF_TRANSFER` 等）。**★ 我七条裁定**：A 类采纳并正式化（② 费率真源 `commission_policy.fee_rate_bp` + 要求 spec 写死 `fee=round(成交额×bp/10000)`；④ 对手方服务端选；⑤ 币对锁覆盖三 op；⑥ M2 越权 ⇒ 403；⑦ 缺 `fill_no` reason 服务层先行/DB 次之；③ `fill_no` 必填）；B 类接受现状但登记加固（① DL68 残余「对手方选择在锁外 ⇒ 决策新鲜度」⇒ **P5/批 4 加固项 + 必带判负**）；C 类交后续单（**S-b3e-1 `ShardPage.jsx:176` 无 `create_key` ⇒ 实测 400**（属碎片 deprecated 面 ⇒ 批 4 收口）；S-b3e-2/3；旧直写三函数现无调用方）。**它照登/自曝**：T03/T10 的 `details.reason`（neon 不携带 `detail`）、`fee=0` 分支未触发、**P2 判据鉴别力弱**（驱动开销 1.0–2.9s）、夹具 `mint '100'` 十进制串 ⇒ 实落 10000；**A1 键前缀写错 ⇒ 作废该读数 + 意外落一张真实买单（已计入等式、不破不变量）** ✓。**B. Jing v0.7（task-1，27 calls / 252.1s）**：`route-layer.spec` **v0.7 / 1102 行 / 264291 B / md5 `13823f03…`**（快照 `cmp` 相同；**反证：v0.6 快照 md5 仍 = 改前本体 md5 `5424645a…`**）+ delta 145 行。折入：① **类级订正 `LD023`→`LD022`（4 处期望码格）+ 新增 §4.7.1 真值表（含 LD020–LD024 全列 + 逐处改/不改 + 理由）**；② **★ 反向同类缺陷（它发现、未擅改）：`400 LD022` 4 处**（`LD022` 是 404 类 ⇒ 自相矛盾；四处 raise 源 = `LEDGER_RESERVED_UID`；候选 `LD021`；登 §7-31 + 可复制改法）✓✓；③ 退款发起人=仅卖方 → §4.2 P4 + §4.7.2（管理员发起 ⇒ §7-32）；④ **§1.8 补 #9/#10 ⇒ 10 条 + 1 附注**（复算真扫描：导出 27→29、注册点 53、未注册调用点 0×10）；⑤ 3c 事实 → §4.7.3（B1–B10）；⑥ 7-7/7-23 **仍待 Kevin**；⑦ §8.9.6 纪律立法（「产出待补行、交规格方落」）。**★ 我裁定其两开口**：① **`400 LD022`→`LD021` 批准** + **采纳其建议把类级扫描扩为 `LD001`–`LD033` 全键普查**；② **§1.8 `#10` 路径正典 = `/api/listing-orders/:orderId/refund`**（RESTful），§4.2 P4 路径格同步。**★ 我的口径差登记**：我全文 `grep -c 'LD023'` = **17**、它报 **16** ⇒ 以「**期望码面内 `LD023`=0**」为决定性判据、全文计数仅参考。**⇒ 批 3 收官**；下一步 = **Neng 独立质检（资金线）** + **Jing v0.8**。 |
| v0.88 | 2026-09-30 | **§5.88 批 3c（商品资金）验收通过 + 我裁定 4 项（含我自己的 brief 冲突）**。**交付（Kong `deleg_bf83bd18`，50 calls / 468.4s）**：**新增** `src/listing-funds-service.ts`（317 行；`buyListing:191`/`refundListingOrder:261`；**单点常量** `REFUND_ROLLS_BACK_STOCK:55`、`REFUND_ACTOR_IS_SELLER_ONLY:62`）；`src/database.ts` **+68/−0**（`listingPostEvent:1773` = 单语句 `SELECT public.listing_post_event($1::jsonb)`；`resolveListingOrder:1788` 只读）；报告 `p4-b3d-listing-funds.md`（309 行）+ 4 探针 + 产物（tag `b3d-20260930T023156`）。**★ 我亲验**：① **第四次自算守恒** `Σbalance 1995998 + Σfrozen 4002 = **Σtotal 2,000,000**`（**与前三次逐位相同**）、负值行 0、`ledger_entry` **76→86**；② **逐 kind 逐项一致**（`purchase 2/sale 2/purchase_refund 2/transfer 8`（4 既有+4 夹具供资，**它把夹具供资单列**）+ 既有 9 kind 未变，和 = 86）；③ **单点常量我亲读**（`:55`/`:62` 均带依据注释 + 「一句话可改」）；④ **服务端取数我亲核**（`:19-20` 金额/卖方均在 DB 函数内取（`0015:590,647`）；`:221` payload 不含 price/seller；`:276` 注明「不是授权真源」）；⑤ 冻结面 0、**注册点 53→53**（前端 50 路径里 `/api/listing*` **0 命中**，显式报数）。**采信读数**：P2 `amount=200 = price 100 × qty 2`、**恰好 purchase+sale 2 腿**、`frozen_delta=0`、`stock 3→1`；**伪造 price/seller_uid/buyer_uid 全被忽略**；幂等同键重投 ⇒ 200 replay **txid 逐位相同、库存未二次扣**；同键异内容 ⇒ **409 `LEDGER_IDEMPOTENCY_CONFLICT`**；**P4 恰好 `purchase_refund`×2**（卖 −200/买 +200）、**`stock 0→0`（7-7 不回滚）**；负例齐（库存不足 409 LD001/自购 400 LD019/未知 id 404 LD022/缺坏键 400/非 owner 退款 403（**买家本人也被拒**）/未付款单 409 LD011）；`tsc` 0、`eyJ` 0、`/health` 200（2219ms）/`schema_version=0020`。**★ 我四条裁定**：① **7-7 保持「不回滚」**（单点 `:55`，待 Kevin）；② **退款发起人 = P4/P5 仅「卖方」**（资金从卖方出 ⇒ 出资方发起；允许买方单方退款 = **对卖方的单向掠夺向量**），**「管理员可发起」登记为批 6 能力**，Jing 写入 §4.2 P4；③ **★ 我自己的 brief 自相矛盾（认账）**：我同时写「必须登记进 spec §1.8」与「`docs/**` 只读」⇒ 单元**按边界处理（只产待补行）= 正确**，错在**我的措辞**；**修正口径**：今后一律写「**产出按规格表格式的待补行、交规格方落**」；④ **★ spec 偏差我亲核成立**：spec §4.2 P2/P4 写 `404 LD023`，DB 实抛 **`LD022 LEDGER_REF_NOT_FOUND`**（**我核 `ledger.ts:1051/1052`**：`LD022=LEDGER_REF_NOT_FOUND`、`LD023=LEDGER_UNKNOWN_KIND`）⇒ **实现跟随 DB 真源 = 正确**，**要求 Jing v0.7 类级订正**（spec 内 `LD023` **4 处** + 做一次「spec `LDxxx` ↔ `ledger.ts` 真值表」扫描）。**它照登** `NOT_MEASURED` 6 项（含 neon 驱动不搬运 PG DETAIL ⇒ 已用 `pg` 直连补测 DB 侧真值）+ 探针自曝 2 条（首版引用不存在的 `currency.supply`；`post2` 误写越界目录 **已删并重跑 run-tagged**）。**已派 3d + Jing v0.7**。 |
| v0.87 | 2026-09-30 | **§5.87 Jing v0.6 验收通过（幂等键契约三款入 §4.5 + §1.8 三方分工 + AUD 入册 §1.10）**。**交付（Jing `deleg_56a00475`，27 calls / 278.5s）**：`route-layer.spec` **v0.6 / 983 行 / 236644 B / md5 `5424645a3def7d6fe405edbd25c6ab64`**（v0.5 = 881 行 ⇒ +102 行；快照同 md5 + `cmp` 相同）+ `route-layer-v0.6-delta.md` 160 行。**★ 我亲验**：① md5/`cmp`/行数逐项相符；② **「只追加」亲核** —— `diff -U0 v0.5 v0.6` 的**被删行恰 = 6**（`-3,2`/`-17`/`-21`/`-740,2`，即文首+§0+§7 状态列），而 `305/322/395/582/881` 等处 hunk 均 `-N,0 +M,K` = **纯插入零删除** ⇒ **§1.8/§4.2/§4.5 正文零删除**（3c 的阅读面未被扰动）；③ 旁册与旧快照逐位未动（v0.5 `7493f410…`、v0.4 `e8b3ceff…`、`data-layer` `ad657c0a…`、`ledger.spec` `eee9f165…`）；④ 越界面无交叉（3c 改 `src/**` 落 7 件、Jing 只写 3 件）。**4 条 delta**：① **幂等键契约（我 §5.86① 选项 B）→ §4.5** 三款（派生键=自然标识单射（真源 `job-service.ts:133/:180`）/ 行为矩阵（同标识同内容 ⇒ 200 replay 零分录；同标识异内容 ⇒ **409 `LEDGER_IDEMPOTENCY_CONFLICT` + `reason=REPLAY_FINGERPRINT_MISMATCH`**（真源 `job-service.ts:156`）；异标识 ⇒ 落新行）/ 无自然键者 **fail-loud**）+ **409 面 → §7-28 永久回归项** + **前端条件项 → §2.4 S10**（**口径澄清：应用代码面 0 命中；`frontend/` 全树 26 命中全在 `node_modules/**`**）；② **§1.8 三方分工**（Kong 每片报「认领 N/未认领 M」/ Jing 每次刷新真扫描 / **我批末差集 = ∅**）+ **它本单复算真扫描**（服务层导出 27 / 注册点 53 / 8 verb 调用点 0 / 正向对照 2/2 ⇒ 清单仍 8+1 无增无减）；③ AUD-JOBKEY **入册 §1.10**（248 行 / 21502 B / `99f535e0…`；零 `modified`）；④ §7：7-25/7-26 状态改「已定」、新增 7-28/7-29/7-30（7-1…7-24 与 7-27 一字未动）。**它主动报差异**：审计件读数由中途态更正为 248 行、前端口径精确化、交件时 `git status` 非空如实报、**§7-25/26 依据格正文未改（并发纪律）并把差异登记到 §7-30** ✓；自曝预算 ~30（超 25）我认账。**★ 我的探针自曝**：我那条「分区删除行数」用 `awk RS='@@'` 写坏（三区都印 6）⇒ **我作废自己的读数**，改 `diff -U0 | grep` 才拿到真值（被删 = 6 且不在三节正文内）。 |
| v0.86 | 2026-09-30 | **§5.86 AUD-JOBKEY 验收（★ 我的立案假设被推翻、推翻得对 —— 我亲自读源码复核）+ Jing v0.5 验收（★ 其真扫描抓出我漏的 5 条）+ 我裁定 7-25 采纳「选项 B」/ 7-26 三方分工**。**A. AUD-JOBKEY（Kong `deleg_cdd633b9` task-0，19 calls / 242.8s）**：**结论 = 碰撞不成立** —— **★ 我亲读源码复核**：`job-service.ts:133` = `resolveJobCreateKey(…, ['submit', identifier, workerUid])`、`:180` = `(…, ['apply', jobId, workerUid])` ⇒ **派生输入只含实体自然标识、不含内容** ✓。实测：T1/T2（不同 application 同内容）⇒ **200/200 都落新行**（键不同）；A1/A2（job 12/13 同雇主同内容）⇒ 各落 1 行（键不同）；T3（同实体同内容）⇒ 200 `idempotent_replay:true` 零增量（设计内）；**T4（同实体异内容）⇒ 409 `REPLAY_FINGERPRINT_MISMATCH`**（body `ref_id` 与 T1 键逐字相同 ⇒ 反证「键不含内容」）；8 笔 `ledger_entry` 增量 **0**、`account` 不变。**结构性解释（我认可）**：`job` 表**无自然键**（`job_id` 是 IDENTITY）⇒ 内容派生必碰撞 ⇒ **3b fail-loud 正确**；2a 两处标识已定 ⇒ 派生安全 ⇒ **两套口径自洽**。**前端取证**：`frontend/**` 的 `create_key|createKey|idempoten` **0 命中**、2a 唯一写口 `ActiveTaskModal.jsx:50`（body 仅 `{info_input}`）⇒ **改 fail-loud 必弄断冻结前端** ✓。**★ 裁定①（7-25 的 2a 面）= 采纳「选项 B」**（零改码 + 语义升为显式契约：派生键 = 自然标识的单射；同标识同内容 ⇒ 200 replay / 同标识异内容 ⇒ 409 / 异标识 ⇒ 新实体；**无自然键的实体必须 fail-loud**）⇒ 交 Jing v0.6 正式化（§4.5）+ 永久回归项（409 面）+ 批 4 前端同步项。**★ 我的立案自评：假设错、但流程对**（判据可证否 + 要实测与源码双证据 ⇒ 一轮结案、错误未进实现）。它照登 `NOT_MEASURED` 3 项 + 自曝「初稿列了未生成的 `probe.log`、已改正文」；**`git status` 零 modified ⇒ 零改码声明为真**。**B. Jing v0.5（task-1，20 calls / 330.1s）**：`route-layer.spec` **v0.5 / 881 行 / md5 `7493f410…`**（+149 行；快照同 md5 + `cmp` 相同；v0.1–v0.4 快照逐位未动）+ delta 179 行；**`data-layer.spec` 一字未动**（`ad657c0a…`，它判定 DL86 属「实测验证既有条文」⇒ **未动用追加额度，正确**）。**★ §1.8「已实现·未注册清单」= 8 条 + 1 附注**：我的 3 条（`applyToJob:175`/`acceptApplication:208`/`createListing:164`）**全命中**，**它实测多出 5 条**（`publishJob`/`settleJob`/`refundJob`/`updateListing`/`transitionListingStatus`）；**后两者同属 `POST|PATCH /api/listing/:listingId`，且 `index.ts` 无 `from './listing-service'` ⇒ 整个商品写口从未接线** ⇒ **抓到我的漏项，真扫描做对了** ✓✓；附准入判据/扫描口径/负向排除（12 helper + 2 无 TS 服务层）/7 个已接线 verb 正向对照；§1.9（K1–K11）折入 3b 事实；两条行为 delta → §3.1 且**改前锚点可复算**（`git show 9d40b17:index.ts:1064-1067`/`:1077-1078`）；§7 新增 7-25/7-26/7-27（7-1…7-24 一字未动）；它主动报「审计件中途落盘 ⇒ 四处就地更正」+「行号漂移 ⇒ §1.5 由三分升四分、未做未测的批量回填」。**★ 裁定②（7-26）= 三方分工**：Kong 每片收尾扫「本片新增的已实现未注册路径」并报「认领 N/未认领 M」；Jing 每次 spec 刷新**真扫描**维护 §1.8；**我批末做差集**（全量服务端导出 − 已注册 − §1.8 = ∅）。**已派 3c（商品资金）**。 |
| v0.85 | 2026-09-30 | **§5.85 批 3b（招工资金）验收通过 + Jing v0.4 验收通过 + 我裁定 3 项 + ★ 新纪律「已实现未注册清单」**。**A. 3b（Kong `deleg_fbd3004b` task-0，44 calls / 490.5s）**：**新建** `src/job-funds-service.ts`（330 行 / `7b808634…`；`publishJob`/`settleJob`/`refundJob`/`verifyJobSubmission`）；`database.ts` **+3 method**（**`jobPostEvent` = 唯一资金写路径** `:1665` `SELECT public.job_post_event($1::jsonb)`、`resolveReviewTarget` 只读、`reviewJobSubmission`）；`index.ts` **只改接 1 条既有路由** `POST /api/tasklist/:jID/verify`；报告 `p4-b3c-job-funds.md`（263 行 / 9 节 / `5a17fe1c…`）+ 产物 + 3 探针。**★ 我亲验**：① **守恒第三次独立复算** `Σbalance 1995998 + Σfrozen 4002 = **Σtotal 2,000,000**`（**与前两次逐位相同**）、负值行 0；② **逐 kind 与自报逐项一致** `ledger_entry` **42→76**（`job_escrow` 10 / `job_escrow_refund` 4 / `job_payout` 6 / `job_fee` 6 / `commission` 4 / `transfer` 4 = Δ34 **枚举等式闭合**）；③ **原子性我亲读**：`reviewJobSubmission` = **单条 SQL**（`WITH ev AS (job_post_event)` + `sub AS (UPDATE job_submission)` + 末 `SELECT`）⇒ 「结论位 + 资金同语句」成立；④ **单写路径我亲核**：服务内唯一 `./ledger` 引用是 `:30` 的错误映射助手；⑤ 冻结面 0、**注册点 53→53**。**采信其读数**：DL86 **两形态实测**（无邀请人 ⇒ `job_fee`→`-1`、`-2` 命中 0；真链 depth 2 ⇒ 8 腿含 `commission`×4、`-2` 进 +10/出 −10 守恒、`-1` 命中 0）；每事件 `Σ(delta+frozen_delta)=0`；approve 200 → 重投 **200 + `idempotent_replay:true`**、分录不翻倍；reject 200；键集不变（11/9）；`tsc` 0；`eyJ` 0。**★ 我三项裁定**：① **F-1 集成缺口**（`/api/job/:jobId/accept` 未注册 ⇒ 批 4 前前端 verify 走不通完整资金链）⇒ **接受现状**（前端对 `/api/job*` 零调用 + 保「53」口径），**但** ⇒ **★ 新纪律 + 新交付物**：spec 增设 **「已实现·未注册清单」**（路径/服务层落点/为何未注册/由哪批注册；首批 = `POST /api/job/:jobId/{apply,accept}`、`POST /api/listing`）⇒ 交 Jing v0.5（**`assets/init` 那类「互推无人认领」的结构性解药**）；② 两条既有路径行为 delta（非数字 `:jID` 400→404；撤 bespoke 400 守卫）⇒ **均批准** + 须登记规格 + 核前端是否依赖旧 400；③ `create_key` 缺失 ⇒ **fail-loud 不派生**（优于 2a 派生兜底）⇒ 批准并**立案审 2a 是否同类静默重放** ⇒ 派 **FIX-JOBKEY**。**B. Jing v0.4（26 calls / 338.4s）**：`route-layer.spec` **v0.4 / 763 行 / md5 `e8b3ceff…`**（快照同 md5 + `cmp` 相同；v0.1/v0.2/v0.3 快照逐位未动）+ `route-layer-v0.4-delta.md` 51 行（D1–D10）；**`data-layer.spec` v0.7 `ad657c0a…`**（**追加式加注 §18，`DL*` 正文一字未改**）+ 快照 `data-layer.spec.v0.6.md` `7b86b811…` **== `git show HEAD` 内容 md5**（我核过；符合该册 DL134 的「改前快照」约定）；7-15/16/23 **全改「已定」**；§1.7 H1–H8 新增、§1.6 改标「FIX-B 前历史」；借码正式化（§3.2+§4.4-12，区分 b3a↔b3b 同号异案）+ C1-T05/C2-T17 期望改 200；§3.4 + 新增 §7-24（无 access log 口径）；§7-3 补 §5.80→§5.81 留痕句；**它主动更正自己的 `schema_version` 口径（0019→0020）** + 报并发写者 + 预算 ~40 自曝。 |
| v0.84 | 2026-09-30 | **§5.84 ★ 批 3a 真收官：FIX-RS（重置键）+ FIX-B（C2 消耗入 `-1` + 金额服务端取数）双双验收通过；★ 我自算守恒复现；三条裁定**。**A. FIX-RS（22 calls / 299.7s）**：`p3x-00-rebuild-replay.ts` **仅 3 处**（`git diff --numstat` = **3+/3−** 我亲核）：`:8` 注释 → `0001..0020（0018 缺）`、`:57-59` `VERSION_ORDER` +`'0019','0020'`、`:625` 行数 `'17'`→`'19'`；报告 `p4-rebuild-key-repair.md`（273 行 / `136186e0…`）+ `rs-before/`、`rs-after/`。**两跑均 `--dry-run`（我核过无 `--apply`）**：修前 `gate.ok=false / version_order_ok=false / terminal 32/30 / exit 3` ⇒ 修后 **`gate.ok=true（all gates green）`、`version_order_ok=true`、`terminal 32/31`、`checksum_all_byte_equal=true`、`F_net_zero.identical=true`、`tx_final=ROLLBACK`、exit 0** ✓；两跑 **`A_hash` 同值 `47db7933…`** ⇒ 差异纯来自脚本改写 ✓；`grep -c COMMIT` = 8 但**唯一可执行**在 `:794` 的 `canCommit` 内（它主动声明了该口径）；它忘带 `P3_ART_ROOT` 导致两 run 目录落进 `.p3x-artifacts/` ⇒ **已移动（非删除）归位、`.p3x-artifacts/` 复原为 3 目录**（我 `ls` 亲核）。**B. FIX-B（53 calls / 657.4s）**：`database.ts` 仅 `listCurrencyWithDeposit`（现 `:1455-1470`）保证金第 4 腿 → **`uid=-1` `delta=+d`**、该形状**无 `frozen_delta`**；`currency-service.ts` 新增 `resolveServerAmount` + 三个下限常量（`:140-141` = **1000**，逐条 **`TODO: Kevin 定值`**、注明占位非经济值）、**删除 `toRequiredPositive`（洞的载体）**、回执 `deposit_consumed`/`deposit_credit_uid:'-1'`/`deposit_refundable:false`；报告 `p4-b3b-currency-funds-fix.md`（225 行 / `dfbff4ac…`）+ 产物 + 3 探针。**★★ 我独立验收（含自算）**：**我的 `zang-sigma.js` 亲算** —— `Σbalance 1995998 + Σfrozen 4002 = **Σtotal 2,000,000**`，**与我 FIX-B 前那次自算逐位相同**（纯转移 ΔΣ=0）✓；`ledger_entry` 30→**42**；逐 kind `currency_create_fee` 20、`listing_deposit` **16**（+4 = 两事件×2 腿）、**`hold` 仍 4（未新增 ⇒ 旧错形状不再产新分录）**、`mint` 2 ⇒ 与它自报逐项一致；负值行 0；越界面 = 恰好 3 个文件被改、**冻结面 0**、**注册点 53**；其逐腿读数（`b3b-03-legs.json`）C2 事件 4 腿**全在 `balance`、`frozen_delta` 全 0**、`listing_deposit` = user −2000 / **`-1` +2000**、`403`/`409` 键下腿数 0；端点 **24/24 PASS**（幂等重投 +0 行 +0 分录、低于下限 400、余额不足 409 无孤儿行、非本人 403、未知 cid/`cid=0` 404、无 token 401）；回归 410 面 6/6、`tsc` 0、`eyJ` 0、面板重启 pid 33620 → `/health` 200。**★ 我三条裁定**：① 低于下限借码 ⇒ **接受 `LEDGER_AMOUNT_NOT_POSITIVE` + `reason=BELOW_SERVER_FLOOR`**（不开新单、不新造码；**Jing v0.4 须正式化**）；② 「未传金额 ⇒ 服务端默认」使 C1-T05/C2-T17 期望 400→200 ⇒ **批准**（正是 7-23 要的语义；v0.4 同步期望）；③ **401/403 逐条日志归因 = `NOT_MEASURED`**（本仓**不落 access log**）⇒ 它用响应体 + 零分录取证、**未把「查不到」当「无异常」** ⇒ 接受；**我精化自己的口径**：该规则的目的是抓「被吞成 401 的 DB 错误」，P4-SEC 后 infra 已分类 503 ⇒ 风险已结构性下降；无日志仓的正解 = 响应体证据 + 零分录 + 显式 `NOT_MEASURED`（已入技能）。**它的探针自曝采信**：首版 e2e 三处读数（`entries`/`kinds_ok`/`both_legs_owner_and_neg1`）为**探针缺陷** ⇒ 声明作废、逐腿以 `b3b-03-legs.json` 为准（**与我自算一致**）。**⇒ 下一步 = 3b（招工资金）+ Jing v0.4**。 |
| v0.83 | 2026-09-30 | **§5.83 FIX-A2 验收通过（`0020` 已应用、注册表 19、函数体 IN 列表摘除 `listing_deposit` ⇒ 保证金跨账户消耗入 `-1` 打通）+ ★ 我亲核「重置键已断」为真 ⇒ 派 FIX-RS/FIX-B**。**交付（Kong `deleg_605e1a2f`，54 calls / 714.2s）**：唯一代码变更 = **`migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql`**（60667 B / sha256 `228127d8…`；函数体从 live `pg_get_functiondef` **逐字派生**、**仅删 18 字节**、只读 `DO` 自检含 `prosrc` md5 硬断言）；报告 `docs/audit/p4-b3a-fix2-ledger-post-event-shape.md`（**§1 含「本次为何解禁 + 裁定 #14 原文逐字引述」**、§5 p3x 只读检查、§9 自曝 6 条）+ 产物 16 件 + 6 脚本。**★ 我亲验**：① `0020` sha256 逐字相符；② **`0020:573` 的 IN 列表 = `('hold','hold_release','job_escrow','job_escrow_refund')`**（`listing_deposit` 已摘、其余 4 项逐字仍在）；③ **`schema_migration` = 19**（我库探针）+ `schema_version=0020`；④ 越界干净（**零已跟踪文件被改**）；⑤ 注册点仍 **53**；⑥ 触发器 43/非 `O` 0、基表 21/视图 1/函数 74。**采信它的读数**：改前/改后 diff **1 hunk / 1 行**（`45722→45704 B`，md5 `e784a586…→57fdc800…`）；**正向 txid 28/29** = 用户 `970001 balance −1` / `uid=-1 balance +1`、**两腿 `frozen_delta=0`**（改前必拒）；**负向 3/3 `HOLD_PAIR_REQUIRED`** + `commission→-1`/`listing_deposit 借 -1`/`-2`/`-3` 全拒、负例落库 **0** ⇒ **守卫仍在、白名单未放宽**；关闭集 **20**、`HOLD_KINDS`=4；幂等同键 `txid 30` 且 `second_entry_added=0`；**ΔΣ = 0**；`tsc` 0；`/health`·`home` 200、`410` 面仍 `410`；面板重启 → `/health` 2750ms 200 → 真 token 业务端点 200；`eyJ` 0。**★ 我亲核它两个上报为真**：① **重置键已断** —— `p3x-00-rebuild-replay.ts:57 VERSION_ORDER` 写死 `'0017'`（`:842` now false）**且 `:625` 行数写死 `'17'`** ⇒ 经 `terminal_failed_empty` 归零 `gate.ok` ⇒ **`--apply` 会拒 COMMIT**（失败安全 ✓ 但重置能力不可用）；`loadMigrations()`/`key_functions_md5` 自适应、`0018` 勿补；② `database.ts:1382-1460` 归 FIX-B。**它自曝采信**：run#1 跨账户 hold 负例因**库内只有 1 个正 uid 账户**退化成合法同账户对（FAIL 保留）；H2c/H1 首版被 **TS 侧 `assertBalanced`**（`ledger.ts:810-830`）先拦；`pg_get_functiondef` **不带结尾分号** ⇒ 首版 `42601`（**已回滚、注册表无痕**）。**★ 我兑现「亲算守恒」**：新增 `zang-sigma.js` 直查 live `public.account` 逐行重算 Σ + 负值行 + `ledger_entry` 逐 kind（FIX-B 以我自算为准）。**⇒ 派两单（互不冲突）**：**FIX-RS**（修 `p3x-00-rebuild-replay.ts` 三处写死，**只许 `--dry-run`、绝不 `--apply`**：`gate.ok`/`version_order_ok` 双 true + `tx_final=ROLLBACK` + 净零 identical）；**FIX-B**（C2 消耗入 `-1` 入账形状 + C1/C2 金额服务端取数 + 下限校验（兜底常量标 `TODO: Kevin 定值`）+ 重跑 22 e2e 与不变量，**须给 pre/post 全账户 dump 供我自算**）。 |
| v0.82 | 2026-09-30 | **§5.82 FIX-A 验收（必要非充分）+ 授权 `0020`（含裁定 #14 单次解禁）+ 我裁定 7-15/7-16/7-23 + Jing v0.3 验收 + 两单说法冲突由我查盘定案**。**A. FIX-A（Kong，45 calls / 437.3s）**：`src/ledger.ts` **2 hunk / +13−4**（`:178` `HOLD_KINDS` 5→**4**；`:544` `-1` credit 收录 `listing_deposit`、**debit 仍空**、`0/-2/-3` 未动）＝我亲核 ✓；**新建 `migrations/0019_listing_deposit_platform_credit.sql`**（10410 B / sha256 `48a9a4e2…`，加法式扩一格 + 正向 9/负向 7 自检）；`schema_migration` **17→18**、幂等重放 ✓、`commission` 贷 `-1` 与 `listing_deposit` 借 `-1` **仍拒**（CHECK 未放宽）、kind 关闭集 **20**、`tsc` 0、`410` 面 6/6、`eyJ` 0、面板重启 ✓。**★ 阻塞（如实上报 = 正确处置）**：正向「`listing_deposit` 消耗入 `-1`」被**第二处闸**拒 —— **`ledger_post_event` 函数体内**还有一份 hold 家族 IN 列表（live def 第 525 行；源码副本 `0004:878`/`0005:1010`/`0012:595`）要求该 kind 每个 `(uid,cid,kind)` 组**恰好 2 腿** ⇒ 与跨账户消耗**互斥**（`HOLD_PAIR_REQUIRED`）；**根因同源 = P1c 漏删 `listing_deposit` 的第二处落点**；它未擅动（硬边界 + `0008` 记裁定 #14 禁触函数体）⇒ 正确。**★ 裁定①：授权 `0020`**（`CREATE OR REPLACE ledger_post_event`，**仅**从该 IN 列表删 `'listing_deposit'`、别处一字不动）—— 兑现已冻结的 R31/DL67/DL88 不是新决定；**「裁定 #14 禁触函数体」本次单次解禁**（不解禁 = **永久不可达的静默欠款**）；必带函数原文改前/改后逐字 diff + 正/负对照 + `schema_migration` 19 + 资金不变量；**`database.ts:1382-1460` 上市入账形状归 FIX-B**。**★ 裁定②**：`0019/0020` 后**重建脚本 `p3x-00-rebuild-replay.ts` 的期望（文件/checksum 17/17）是否自适应**必须复核（写死 17 ⇒ 下次重置会失败）⇒ 交 FIX-A2 只读检查报告。**B. Jing v0.3（23 calls / 308.8s）验收通过**：`route-layer.spec` **v0.3 / 716 行 / md5 `fa91425e…`**（快照同 md5 + 我亲跑 `cmp` 相同；v0.1/v0.2 快照一字未动）+ `route-layer-v0.3-delta.md` 125 行（D1–D11 带锚点）+ **`ledger.spec` v0.13 / 2028 行 / `eee9f165…`**（改前快照 `8ffb5fd5…` == HEAD 版；**R1–R109 未动、仍 33 码**；R101 的 `-1` 增方白名单追加 `listing_deposit`）；§7-3 已改正 + **显式登记「v0.2『冻结可退』是错误推断，由 Zang §5.81 纠正」+ 铁证锚点**；它主动报「写作中途 FIX-A 落盘、已就地更正并留痕」✓。**★ 查盘定案**：Jing 报「FIX-A 报告 §2–§7 是占位、读数未取到」⇒ **我查盘 = FIX-A 报告实际 198 行、§0–§7 全在、无占位** ⇒ **Jing 读到的是中间态**；它登记为 `NOT_MEASURED` 而非当结论 = **正确**（纪律㉓ 再验证）。**★ 我裁定 7-15**：**以读法① 「旧查询函数调用数 = 0」为准**（`data-layer.spec.md:328` 原文自带该判据），读法② 不采纳；**补强**：具名函数清单（A 类遗留函数）+ 同时核那 5 组端点语义正确（**不得为清零而删功能**）+ 类级扫描。**★ 我裁定 7-16**：**采纳 (A) 删除** 自拟 `FEE_RATE_KEY_PATTERNS` —— 依据 = Jing 实证「`0017` 无任何费率键名枚举，仅 `:81` 表注释写『费率键不在此表权威（真源 = `commission_policy.fee_rate_bp`）、若历史键存在则保留但标注不参与计费、不得删键』」⇒ 派生不可能、平台立场是容忍+标注；**真源唯一改由读取侧纪律保证**；**登记「`app_config` 合法键清单/写入门禁」为批 6 配置面规格**。**★ 我裁定 7-23**：**机制先落地、数值待 Kevin**（FIX-B 实现服务端取数 + 下限校验；兜底常量标 `TODO: Kevin 定值`；**不得由客户端决定金额**）。**已派 `deleg_605e1a2f`（FIX-A2 = `0020` 手术）**。 |
| v0.81 | 2026-09-30 | **★★ §5.81 我的重大勘误：§5.80 对 §7-3 的批准作废**。**铁证**：`ledger.spec.md:79`「保证金『冻结可退』❌ 已于 v0.2 **被 Kevin 原文推翻**」+ `:12`/`:13`/`:191`（消耗不可退、无退还 kind、无罚没）+ `data-layer.spec.md:454/530/533`（DL67/DL88/DL91【已冻结】）+ **`src/ledger.ts:148-150` 与 `migrations/0003:5-8` 注释逐字同**（「上市即消耗、**进平台收入 `uid=-1`**」）。**根因**：`src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时漏删）⇒ 代码里两种口径并存；Jing v0.1 §7-3 **如实揪出了这个矛盾，是我裁错了边**（只看了 route-layer.spec、没核账本权威册）。**我错在哪**：§5.80 的「无需改白名单、无需迁移」**作废**。**最终裁定**：`listing_deposit` = **上市即消耗 → 贷 `uid=-1`**（不可退/无退还 kind/无罚没；`hold_forfeit` 按 DL91 P3 不启用）；kind 关闭集仍 **20**（R40）。**授权**：① **`0019` 迁移**（加法式扩展 DB 侧 `-1` credit 白名单，照 `0008` 先例）；② **`src/ledger.ts` 一处手术**（从 `HOLD_KINDS` 移除 `listing_deposit`，**仅此一处**、最小 diff、逐行留痕 —— 原「冻结」为护 P3 内核，本次是**已定案缺陷**故显式解冻一单）。**返工归属（我指定，不许再互推）**：**FIX-A**（`ledger.ts` + `0019` + 正/负对照）→ **FIX-B**（C2 改为消耗入 `-1`（**不得出现 `frozen` 变动**）+ **C1/C2 费用改服务端取数**（现客户端传 `fee`/`deposit_amount` ⇒ **可传 `fee=1` 绕过 = 资金面真洞**）+ 重跑 22 e2e 与不变量）；**Jing v0.3**（§7-3 改正 + 显式登记纠正 + `ledger.spec` 白名单列回写 + 7-15/7-16/退市罚没缺事件/幂等键待定/非 owner 码）。**★ 新纪律（已入技能）**：**裁定资金语义（kind 方向/白名单/可退性/费率）必须四册齐核**（`ledger.spec` / `data-layer.spec` / `commission.spec` / `route-layer.spec`）**+ 代码与迁移注释**，并在裁定里逐条列证据锚点。**已派 `deleg_cbf0521d`（FIX-A + Jing v0.3）**。 | 
| v0.80 | 2026-09-30 | **§5.80 ★ 我显式批准 §7-3 处置（把 spec 里的「裁定 = Zang」补成真：§5.73 只是我登记冲突处，非终审条文 ⇒ 纠正归属风险）+ 批 3 切片 3a–3d + 定义「资金不变量」与 token 口径变更**。**A. §7-3 批准**：① 上市费 `currency_create_fee` → `-1`（白名单已含 ✓）；② **保证金 `listing_deposit` = HOLD（冻结可退），不进 `-1` credit 白名单** ⇒ 原「冲突」是**表象**（保证金是**担保物**非收入）：`listing_deposit` 冻结 → 退市 `hold_release` 退回 / 违规 `hold_forfeit` → `-3`（白名单已含 ✓）；③ **⇒ 无需改白名单、无需迁移**（现有 20 kind + 两处白名单自洽）⇒ `POST /api/currency`(C1) 与 `/api/currency/:cid/list`(C2) 批 3 可建编排。**B. 资金不变量（批 3 起每片必带、我亲验）**：对拍量 = 事件前后 **`Σbalance + Σfrozen`（全账户含 `0/-1/-2/-3`）的变化量** 必须 **== 该事件组净铸/销额度**（纯转移 ⇒ 0）；另核非负 CHECK 未触发、**`ledger_entry` 增量 == 事件数×分录条数**（**批 2 的「增量 = 0 才绿」在批 3 反转为「== 预期条数」—— 不得再把 0 当绿灯**）。**C. token 口径变更**：P4-SEC 后**旧兜底常量铸的 token 一律 401**，探针/验收**必须用 `.env.local` 的 `SECRET_KEY` 铸**（写进此后每份 brief）。**D. 批 3 切片**：**3a 币种面**（建币收 `currency_create_fee`→`-1` + 上市 `listing_deposit` 冻结 + 退市/罚没支路；**本片允许注册新路径**（积分交易所是核心功能）但**须显式报 51 → N**）；**3b 招工资金**（`job_escrow/payout/fee/escrow_refund`，**审核通过→发放必须原子**）；**3c 商品资金**（`purchase`/`sale`/`purchase_refund`；**7-7 退款是否回滚 `listing.stock` 待 Kevin，默认不回滚**）；**3d 交易所+佣金**（`trade`/`trade_fee` + `commission` 与 10 级返佣权重）。每片必带 spec §4 资金四栏/幂等键/失败回滚/期望码 + 资金不变量 + 键集冻结 + 禁删 + mtime 守卫 + token 新口径。 |
| v0.79 | 2026-09-30 | **★ §5.79 P4-SEC 验收通过（我亲跑双密钥对照：env 密钥 ⇒ 200、旧兜底常量 ⇒ 401 —— 修前反向）+ Jing v0.2 交付并验收 + 我裁定 7-15/7-16**。**A. P4-SEC（Kong `deleg_29d8e228` task-0，50 calls / 457.5s）**：`src/auth.ts` **移除硬编码兜底默认值**（保留 `PUBLIC_FALLBACK_KEY` 作显式拒绝；缺失即 `[FATAL]` + 退出码 1）、`src/index.ts` 新增 **`unwrapInfraCause`** + `resolveActor` 分类 + `/api/home` infra⇒匿名降级、**新增 `src/env.ts`**（`import './env'` 置 `index.ts:4`，早于 `./auth`）；报告 `docs/audit/p4-sec-auth-gate.md`（8 节 / `6410e5c7…`）+ 产物 + 2 脚本（`auth.ts` `8b9efc9c…`；`env.ts` `9468194c…`）。**★★ 我亲验**：**双密钥对照**（我自建 `zang-auth-probe2.js`）—— env 密钥 ⇒ `/api/user` **200/200**、**旧兜底常量 ⇒ 401/401**、无 token 401、错签名 401 ⇒ **HIGH 债「任何人可伪造任意 uID token」确已消除**；另核 `/health` **200**（收尾健康）、**注册点 51**、**冻结面 0**、`eyJ` **0**。**它的读数（与我一致）**：改前 live 复现反向 → 改后反转；**fail-fast 实证**（无 `SECRET_KEY` 启动 ⇒ **退出码 1** + `[FATAL]…`；对照组正常）；**分类器对拍 5/5**（`ConnectTimeoutError`/53300/08006/ECONNREFUSED ⇒ **503**；`08P01` ⇒ 500）；**受控实例 5799**（拒连 DB）真 token ⇒ **503**、公开常量 token ⇒ **401**；回归 **16/16**（5 个 `410` 仍 410）；`tsc` = 0；**零业务写**（`ledger_entry 0`、`account` 4 行全 0）；**收尾** `restart {sid:'seafood-api'}` ⇒ `ok:true` pid **76603**、全站 **16/16**；401 逐条服务端日志归因。**照登**：裸错误（无码无码化子链）仍 500（未改冻结判据 = 正确）；`/api/home` 保持匿名降级；**预算 ~37/32 略超（我认账）**。**B. Jing v0.2**：`docs/route-layer.spec.md` **668 行 / md5 `0c587183…`**、快照**同 md5 + 我亲跑 `cmp` 相同**、**v0.1 快照未动**、delta 件 162 行；**9 组 delta 带锚点**（路径改标×2 / §1.2 注册点冻结 / **§6.4 4⇒6 键**（`:576` 逐字引「Zang §5.78⑤」）/ **新增 §6.5 `isAdminAddress` 顺序依赖** / **§3.4 401-403 `R107`** / **§4.5 `ops:` 请求侧强校验** / **新增 §2.4 批 4 前端同步 S1–S8** / §1.4 批 2 已落地 F1–F11 + §1.5 行号对照 / §7 加状态列：**7-1..7-14 全部「已定」**）；它**主动报并发写者**并在 §1.5 写死「断言前现取」口径 ✓。**★ 我裁定 7-15/7-16**：7-15（`DL38` 落点读法）⇒ **要求 Jing v0.3 先给原文落点 + 两读法实证差异再择一**；7-16（批 2c 自拟费率键黑名单）⇒ **不得当长期口径**，正解 = **从 `0017` 既有约束/键集派生**，正式化前只作防御性校验。**下一步**：核 **v0.2 §7-3**（`listing_deposit` 白名单冲突 + 无 currency 建/上市编排函数）是否可执行 ⇒ **批 3（资金编排）**；**P4-SEC 后所有探针改用 `.env.local` 密钥铸 token**（写进此后每份 brief）。 |
| v0.78 | 2026-09-30 | **§5.78 批 2c（权限与设置，非资金面）验收通过 + ★ 我亲核「权限键单一真源」成立 + ★ 查明 2a/2b 报告互相推诿 `assets/init`（新纪律入技能）** ⇒ **★ 批 2（2a/2a-HTTP/2b/2c）正式收官**。**交付（Kong `deleg_7015f3a8`，42 calls / 768.5s，★ 预算 34/40 = 首个不超支单元）**：`src/database.ts` **+68**（`admin_role*` 三表映射 + 6 辅助方法；`resolveAdminAccess` @§6.1 单一真源；撤 3 个合成组；`savePermissionGroup` 单事务；`deletePermissionGroup` 「无在用用户才可删」；`getSystemSettings`/`saveSystemSettings` 补 **`updated_by`**（旧实现必违约 `NOT NULL`）+ 显式 `public.`；`buildAdminAccess` +`hasRoleRow` 键集不变）；**新增** `src/admin-service.ts`（269 行 / `586e8900…`；**零 ledger/commission import 我亲核**）；`src/index.ts` **+51**（13 处：`settings/reset⇒410`、撤 `permissions` `deprecated`、**401/403 → `R107`**、`admin/assets/init⇒410`）；报告 `docs/audit/p4-b2c-admin-write.md`（**283 行 / `a9fbb810…`**）+ 产物 16 件。**★ 我亲验**：① **权限键单一真源成立** —— 后端 `ALL_ADMIN_PERMISSIONS` 11 键 vs `frontend/src/admin-utils.js` **逐键 0 差异**（我逐键算）⇒ **我 §5.77 修正后的设计实测成立**；② **非资金不变量成立**（我的探针：`users 6`、`app_config 1`、**`admin_*` 仍 0**（未插种子 ✓）、**`ledger_entry` 仍 0**、`account 4`、`currency 1`、触发器 43/非 `O` 0、基表 21/视图 1/函数 74）；③ **注册点 = 51**；④ **冻结面 0**；⑤ 越界 0、`eyJ` 泄漏 0；⑥ 采信 39/39 HTTP PASS（写→读回同值 `p4b2c:siteA`；admin 200 / 普通 **403 `NOT_ADMIN`** / 无 token **401**；回归 4 GET 200；5 个已落 `410` 仍 410）+ 键集冻结（5 mapper 三版本相等）。**★ 我查盘的移交缺口真相**：`assets/init` 在 **2a 与 2b 报告里都写「归同批其它片」**（grep 到原句两处）⇒ 互相推诿、无人执行 ⇒ **2c 补 `410` 正确**。**裁定①：批准，非越界**。**★ 新纪律（已入 `subagent-dispatch-discipline`）**：跨片交接面**必须由派单方指定归属**；每片收尾须报「认领 N 条 / 未认领 M 条」；批末差集 `全量 − 各片 = ∅` 才可收官。**其余 4 裁定**：② `ops:` 幂等键按 `DL36` 走请求侧强校验 ⇒ **批准**（fail-loud 优于静默重复写），**代价登记**：旧前端 3 页 4 写口会 `400` ⇒ 批 4 前端同步项；③ **401/403 → `R107`** ⇒ **批准**（§5.73 统一形状），**代价登记**：`frontend/src/auth.js:105` + 四语 locale 待同步 ⇒ 批 4；④ `isAdminAddress` 第三真源**本片未改 = 正确**（收敛必须**与批 6 权限种子同批**，否则当场锁死运营管理员）⇒ 批准 + **要求 v0.2 记录该顺序依赖**；⑤ `/api/admin/me` **保留 6 键**（未改 §6.4 的 4 键）⇒ **批准**（键集冻结优先于 spec 描述）+ **要求 v0.2 更正 §6.4 为 6 键**。**⇒ Jing v0.2 delta 清单（8+ 条）**：3 条路径改标（`/api/job/{apply,accept}`、`POST /api/listing` = 服务层已实现/路由层随批 4）＋ `/api/admin/me` 6 键 ＋ `isAdminAddress` 顺序依赖 ＋ `DL38` 落点读法 ＋ 费率键黑名单正式化 ＋ 批 4 前端同步项（`ops:` 4 写口 + `R107` + locale）＋ 我 13 项终审。**照登**：`NOT_MEASURED`（**因禁写种子而结构性不可测**）：权限写口成功落行（`admin_permission` 0 行 + FK ⇒ 只到 404）、`delete` 两支、自锁守卫支、`admin_user_role` 那支、`updated_by` 无 FK 语义、并发面 ⇒ **批 6（权限种子迁移 + `isAdminAddress` 收敛 + 这些面实测）一条线收口**。**下一步**：**P4-SEC（安全与配置闸）** → **Jing v0.2** → **批 3（资金编排，先契约后动钱）** → **批 6（权限种子迁移）**。 |
| v0.77 | 2026-09-29 | **§5.77 批 2b（商品 listing 非资金写入）验收通过 + ★ 我修正自己 7-8 的裁定（权限种子不写库）**。**交付（Kong `deleg_1fcb1a6d`，46 calls / 1315.3s）**：**新增** `src/listing-service.ts`（311 行 / `f862eb3c…`；**零账本 import**）；`src/database.ts` +4 方法（单语句 CTE + `FOR UPDATE`）；`src/index.ts` 5 处 **`410`**（`admin/prize/{create,update,delete}`、`shard/redeem`、`chest/:bID/open`，含 `sunset`）；报告 `docs/audit/p4-b2b-listing-write.md`（**271 行 / `b2cedba0…`**）+ `b2b-20260929T215723/**` + 3 脚本。**★ 我亲验**：① **非资金不变量成立**（我的探针：新增写面仅 `listing`(+12)/`users`(+2)/`job`·`job_application`·`job_submission`(+1 各)；**`ledger_entry` 仍 0**、`account` 4（Σ0/Σ0）、`currency` 1、触发器 43/非 `O` 0、注册表 17/17）；② **注册点 = 51**；③ **冻结面 0**；④ 越界 0、产物 `eyJ` 泄漏 **0**；⑤ 采信其键集冻结读数（`normalizeBrand` 43/43/43、`normalizePrizeItem` 6/6/6）。**⚠️ 如实登记一项我未复测**：我原计划亲测 5 个 `410` 面，但命令**被安全层拦下（含 `-X POST`、未获用户确认）** ⇒ **按规则不重试、不换法重试**；该面当前只有单元读数（双 token 均 410 + `R107` + `sunset`；回归 `prize/all`·`home`·`task/all`·`market` 全 200、`prize/:bID` miss 404、`POST /api/listing` 404、HTTP 级幂等重投 `idempotent_replay:true`）⇒ **登记「待补测」**（后续由我或有授权的 Neng 补）。**★ 我的裁定**：批准其 spec 偏差处理（`POST /api/listing` 服务层已交付、**路由层随批 4**，与 `/api/job/*` 同构）⇒ **Jing v0.2 改标清单 = 3 条**。**★ 我修正 7-8**：「`admin_permission` 补 DB 种子」**作废**（种子存库会被「重建回 seed 基线」抹掉 ⇒ 权限面静默失效）；**改为 = 权限键真源放代码侧**（`ALL_ADMIN_PERMISSIONS` 常量）**+ 对齐前端 `admin-utils.js`**，表种子留**批 6**（走迁移/规格）。**照登**：`title` 非空校验未做（需新码 ⇒ **不自创码**，正确，待裁）；创建指纹排除可变列的口径；`NOT_MEASURED` 10 项；**预算 ~50 calls（超 35）我认账**；探针自曝 3 条。**已派批 2c（Kong `deleg_7015f3a8`）= 权限与设置（非资金面）**。 |
| v0.76 | 2026-09-29 | **§5.76 批 2a-HTTP 验收通过 —— ★ 我亲做「双密钥对照」独立确认鉴权面解锁；批 2a 的 HTTP 写分支闭合；登记 3 项（含 HIGH 安全债）**。**交付（Kong `deleg_d92c4508`，28 calls / 773.4s）**：`src/database.ts` **7 处 `users` 旧列名 → 真列**（`normalizeUser` 回退键 / `getNextUserId` / `getAllUsers` 排序 / `uID` 谓词 ×3 / `getUserByEvm` 走 `idx_users_evm_lower` / `createUserByEvm` INSERT；**残留旧列 grep = 0**）；`docs/audit/p4-b2a-http.md`（**148 行 / `fa92dcf5…`**）+ `.p4-artifacts/b2ahttp-20260929T133731/**` + 3 探针脚本。**★★ 我的独立复核**：① **双密钥对照**（我自建 `zang-auth-probe2.js`）—— `env(.env.local)` 密钥 ⇒ **401**、**`auth.ts:3` 兜底常量 ⇒ `/api/user` 200 / `/api/task-progress` 200**、无 token 401、错签名 401 ⇒ **鉴权面确已解锁 + 「服务端生效密钥 = 兜底常量」经我实测确认**；② 越界核：仅 `database.ts` + 4 新文件、**冻结面 0**（含 `.env.local` 未被单元触碰）；③ 泄漏核：产物+报告 `eyJ` **0**、兜底常量字面 **0 文件**；④ 面板日志 `column u.uID does not exist` **归零**（同窗仍有 `UND_ERR_CONNECT_TIMEOUT` 抖动 = 既有 A 档债）。**它与我一致的读数**：`/api/user` 有 token **200** 且键集 `[uID,EVM,bio,is_admin,time_reg,time_login_last,points,requires_profile_completion]` **不变**；**J4 submit 端到端 200 inserted**（`job_submission 0→1`、`review_status='pending'`、`job 3→submitted`）→ **同键重投 200 `idempotent_replay:true` 不多一行**；他人申请 403 / 未知 id 404 / `status='applied'` **409 `JOB_APPLICATION_STATE_INVALID`**；**非资金不变量** `ledger_entry` **0→0**、`account` 4 行 Σ0/Σ0 不变（dump hash `7516d8c6…`）；`tsc`=0、注册点 **51**。**★ 我的裁定（1 口径偏差）**：`POST /api/job/:jobId/{apply,accept}` 实测 **404 = 未注册**（spec §1:125-126 标为批 2 目标）⇒ **以我 §5.74 裁定为准：服务层已实现、路由层随批 4 注册**（理由：前端零调用 + 注册即破坏「51 注册点」冻结口径）；**要求 Jing v0.2 改标这两条**，并已把该偏差写进 2b/2c 的 brief。**★ 登记 3 项（未修）**：① **HIGH 安全债**：`auth.ts:3` 硬编码兜底密钥 + `dotenv` 加载顺序 ⇒ **任何人可伪造任意 uID 会话 token**（本单正是如此在无钱包签名下拿到 200）⇒ **列为上线前硬闸**（修法：`import './env'` 先行 / 缺失 fail-fast / 移除兜底），归 **P4-SEC（安全与配置闸）**；② `resolveActor` 把一切异常吞成 401（Neon `ConnectTimeoutError` 抖动会让**合法 token** 也 401）⇒ 判读纪律已进技能 §26，修法待 P4-SEC；③ `NOT_MEASURED` 照登（apply/accept 的 HTTP 业务分支、`users` 行数 before、`job` 命名台账、account dump hash before、settle/并发面）。**过程自曝采信**：首次「15s 超时」先疑死循环 → 读码证否 → 复测得 409（真因 Neon 抖动）；两处 `node -e` 引号自伤（探针缺陷）；**预算 ~38 calls（超 30）**（连通性抖动重测 + 泄漏自检返工，**我认账**）。**已派批 2b（Kong `deleg_1fcb1a6d`）= 商品（listing）非资金写入**。 |
| v0.75 | 2026-09-29 | **★ §5.75 更正我自己的误判 + 锁定鉴权面真根因 + 派单修它**。**我错在哪**：§5.74 我写「缺 `SECRET_KEY` ⇒ 全部鉴权面 HTTP 不可用」—— **错**。真证据（面板日志 `GET :5555/api/logs/seafood-api`）：**20:28–20:44**（批 2a 在跑）反复 `Failed to resolve actor: NeonDbError: **column u.uID does not exist**`（栈 `Function.getUserById`）⇒ **真根因 = `users` 字段映射未做**（新表列 `uid`，代码查 `u."uID"`）；**21:29**（我写键并重启后重测）变成 `Invalid token signature` ⇒ **我加的 `SECRET_KEY` 不生效**（`auth.ts:3` 有硬编码兜底 `'your-secret-key-here'` + **模块加载顺序**使 `auth.ts` 在 `dotenv.config()` 之前取值）⇒ 我按 `.env.local` 铸的 token 与服务端密钥不符（自洽）。**★ 由此暴露的验收口径教训（已进纪律）**：**401 不是「正常鉴权」的同义词** —— `resolveActor` 把所有异常（DB 列错/签名错/用户不存在）吞成 401 ⇒ **批 1 的「零 500」为真却掩盖了鉴权路径的 DB 缺陷**；今后凡 401 **必须同时核服务端日志**，且「改了之后必须重测」（否则会把无效变更当修好、把错定性写进权威文档）。**处置**：`SECRET_KEY` 保留在 `.env.local`（无害，修好加载顺序后即生效）但**登记当前无效**；**安全债务登记**：硬编码兜底签名密钥须在上线前移除（缺失应 fail-fast）+ 修 `dotenv` 加载顺序；**§5.74 的「环境级阻塞」表述作废、以本节为准**。**已派 Unit P4-B2a-HTTP（Kong `deleg_d92c4508`）**：① 修 `getUserById`/`getUserByEvm`（及必要处）的 `users` 列名映射（先取 `information_schema` 真值；**响应键集不得变**，代码消费 `user.EVM`/`user.uID` 等大写键）；② 铸 token（**先实验确认服务端生效密钥，不得假设**）验通 `GET /api/user` ⇒ **200**、`/api/task-progress` ⇒ 200、`/api/admin/me` ⇒ 200/403；③ **闭合批 2a 的 HTTP 写分支**（submit/apply/accept 带 token + 幂等重投）；④ 命名台账 + before/after 计数差 + **非资金不变量**（`ledger_entry` 增量 = 0、`account` 不变）；⑤ 登记（不修）兜底密钥 + 加载顺序；⑥ `tsc` 0、注册点仍 51、冻结面零触碰。 |
| v0.74 | 2026-09-29 | **§5.74 批 2a（招工非资金写入与状态机）验收通过 —— ★ 我亲验「非资金不变量」成立；404/410 到位；★ 我另发现环境级真阻塞（缺 `SECRET_KEY` ⇒ 全部鉴权面 HTTP 不可用）**。**交付（Kong `deleg_390acd0f`，52 calls / 5030.2s）**：**新增** `src/job-service.ts`（239 行 / `37e30f31…`；**对 `./ledger`/`./commission` 的 import = 0/0 ⇒ 零账本路径**）；`src/database.ts` **+232**（4 方法：`resolveJobApplication`/`submitJobWork`/`applyToJob`/`acceptJobApplication`，单语句 CTE + 显式 `public.`）；`src/index.ts` ±103（submit 改接 `job_submission` + `job.status→submitted`；`GET /api/task/:tID` miss ⇒ **404**；`/api/admin/task/{create,update,delete}` ⇒ **410 `R107` 形**）；报告 `docs/audit/p4-b2a-job-write.md`（**213 行 / `aed01854…`**）+ 探针 `p4z-b2a-01-fixture.ts` + 产物 `b2a-20260929T193900/**`（7 件）。**★ 我亲验**：① **非资金不变量成立**（我的探针：`users 2`(=970001/970002)/`job 2`(`tID 2,3`=`p4b2:fixture:A/B`)/`job_application 2` 为唯一新增；**`ledger_entry = 0`**、`account = 4` 逐行 0/0 且仅平台 `0/-1/-2/-3`、`currency = 1`(`$` supply 0)、`referral = 0`；触发器 43/非 `O` 0；注册表 **17/17 逐字节相等**）—— **口径**：我探针 `residue_zero_ok:false` 属**预期**（job/job_application 即本批夹具），按 §5.71「接受残差」读；② `/api/task/999999999` ⇒ **404**、`/api/task/3` ⇒ **200**（真实行，我核实非缺陷）、`admin/task/*` ⇒ **410×3**、`/api/home`·`/api/task/all`·`/health` 200 无回归；③ **注册点仍 51**（未加对外路径，符合 §1.2）；④ 冻结面 **0** 改动；⑤ 写语义 10 条（apply 200 / **同键重投 200 replay** / 异键同人·重复 accept·自投·坏键 ⇒ 409·409·409·400 / 非雇主 accept ⇒ **403 ACTOR_NOT_ALLOWED** / 未知 id 404）；⑥ `tsc = 0`。**★ 我的 3 条裁定**：批准其「不注册 `/api/job/*` 对外路径」（前端 49 路径里没有它，新对外路径随**批 4** 前端迁移上）；批准 `claim`(:505) 整条归批 3（其唯一既有语义 = `upsertAsset` 直写发放）；批准其对「`R107` 错误体 vs §2 键集冻结」的解释（成功分支键集冻结、错误分支统一 `R107` 体）。**★★ 环境级真阻塞（非本单缺陷）**：`.env.local` **无 `SECRET_KEY`**（面板 env 只有 `PORT`），而 `src/auth.ts:3` 在**模块加载期**读它 ⇒ **签名/验签不可用 ⇒ 所有鉴权面（含全部写路径）HTTP 层不可用**（submit/claim 实测 401；单元按 `auth.ts` 逐字复刻铸 token 仍 401 = 根因在服务端）；它**未越界改环境**（正确）⇒ 登记 `NOT_MEASURED`。**裁定：这是产品级阻塞（前端也登不上）** ⇒ **已问 Kevin 一句话**（我加随机 dev `SECRET_KEY` + 面板单服务重启 / 他自己设 / 暂不设）；**表态前 HTTP 写分支一律记 `NOT_MEASURED`**（service 直调读数不得当 HTTP 面证据）。**照登**：单元**预算自曝 ~60 calls（超 25）**（探针口径自查 + 认证阻塞定位；**我认账**：brief 预算偏紧）、期间 **DB 链路抖动 2× `/health` 503**（既有 A 档债务）、无删除型 SQL/无分录/无 `git`/未 `pkill` ✓、命名台账 `cli:p4b2:job:A|B`/`cli:p4b2:app:A2|B2`/uid `970001/970002`。 |
| v0.73 | 2026-09-29 | **§5.73 P4-SPEC（Jing）`docs/route-layer.spec.md` v0.1 验收 + ★ 我对 13 项未决的逐条终审 + 批 2a 已派**。**交付（Jing `deleg_63a7b784`，23 calls / 367.1s）**：`docs/route-layer.spec.md` **498 行 / 80839 B / sha256 `6f27b4add4b79da36602f20ba93f6edd2d93dcdc4d9164c00293909a697b5018`**；快照 `docs/versions/route-layer.spec.v0.1.md` **同 sha（逐字节相同）**；边界仅这 2 个新文件 ✓。**内容**：§1 **51 端点逐条处置**（live 行号 + 已登记与 inventory 的行号漂移）+ **18 条新增端点**；§2 **前端契约冻结**（逐端点 key 来源 mapper + 23 文件消费清单 + **「前端消费但后端没有的路径 = 0」**）；§3 detail-miss 统一 **404** + 逐码条件（对齐 `DL126`）+ `R107` 七条；§4 **资金编排契约**（R1–R7 + 7 关闭集 + **18 个业务事件**「端点→编排函数→kind→必需字段→幂等键→失败/回滚→期望码」+ **资金四栏**（谁出钱/谁收钱/平台费来源/佣金分配）+ 幂等键总表 + 批 2/批 3 切分）；§5 弃用面 13 面统一 **`410`**+过期日（**`/api/prize-item` 保留正式化撤 deprecated**；碎片读口空态/写口 `410`）；§6 权限单一真源 `can_access_admin` + 5 步判定；§7 13 未决；§8 变更记录 + 8 项 `NOT_MEASURED` + 3 自曝。**★ 其关键裁定（我全文批准）**：detail-miss **一律 404**；**「审核通过→发放」必须原子 ⇒ `approve`/`review` 整条归批 3、批 2 禁半实现**（防静默欠款）；`422` 不启用；13 弃用面统一 `410`。**★ 我的 13 项终审**：7-1 保留路径至批 4 切换（**410 过期日 = 批 4 前端迁移验收通过之日，每批复核点名**）；7-2 批 2 `/api/user` 保键集、`DL24` 由新增 `/api/user/points` 满足（**履约时点登记为批 4**）；**7-3 ★ 我可执行裁定（无需新迁移）**：「上市费 = `currency_create_fee` → 平台 `-1`（已在白名单）」+「保证金 = `listing_deposit`（`HOLD_KINDS`）纯冻结、可退（`hold_release`）、违约 `hold_forfeit` → `-3`（白名单含）」⇒ **现有 kind+白名单足以表达，禁新增 kind/禁改白名单/不开 `0018`**，批 3 前须对拍验证；7-4 批 3 **不得发明撮合**（成交价 = 买单限价，撮合属 P5）；7-5 `DELETE /api/order` 入参改 query（前端 `ShardPage.jsx:328-329` 同步）；7-6 `/api/admin/task/*`·`/api/admin/prize/*` **`410` 随批 2 生效**、后台只读化、仲裁面排 P6；7-7 不发明不回滚 `stock`（**需 Kevin 一句话**）；7-8 权限最小集须与前端 `admin-utils.js` 对齐；7-9 同 422；7-10 `time_claimed`/`points_claimed` 恒 NULL/0 保留至批 4；**7-11 ★ 我修正：`DL155` 早已闭合（`3b8e379`），Jing 依据的是数据层 spec 的过时注 ⇒ 批 2 只需把「裸表名扫描」纳入验收判据**；7-12 四语文案属 P7（批 2/3 只保 `i18n_key`）；7-13 `claim` 拆 `apply`/`accept`（批 2，无分录）/`settle`（批 3，有分录）。**已派批 2a（Kong `deleg_390acd0f`）**：spec 驱动的招工非资金写入与状态机；**先落盘端点清单再动代码**、冲突即停；**首次真写库** ⇒ 命名空间台账 + before/after 计数差 + **非资金不变量（`ledger_entry` 增量必须 = 0、`account` 不变）** + 禁删 + 禁跑写库套件 + 禁碰资金。 |
| v0.72 | 2026-09-29 | **§5.71 批 2 推进裁定 + ★ 追加裁定「先钉契约再动资金」+ 残差/重置键口径**。**两问表单超时 ⇒ 按推荐项推进（一句话可改）**：① detail-miss 统一 **404**（含把 `/api/task/:tID` 从 200 空态改回）；② 批 2 顺序 = **2a 招工 → 2b 商品 → 2c 权限/设置**。**★ 我追加的关键裁定**：**批 2 只做非资金写入与状态机；一切资金动作（招工托管/发放、商品购买、交易所成交与手续费、10 级返佣、上市保证金）推迟到批 3，且批 3 开工前必须有契约** —— 理由 = **「资金路径半实现」是最危险形态**（审核通过却不发放 = **静默欠款**，比 500 更难发现；直改 `account` 则绕开账本不变式 Σ闸/幂等/append-only）。**已派 Jing（`deleg_63a7b784`）= `docs/route-layer.spec.md` v0.1**：51 端点处置表（含目标表字段映射 + `文件:行号` 依据）＋ 前端契约冻结（响应 key 集不得变 + key 来源）＋ detail-miss/错误语义（对齐 `DL126`）＋ **资金编排契约**（每个业务事件 → 编排函数（`job_post_event`/`listing_post_event`/`market_post_event`/`ledger_post_event`）→ 20 个 kind 闭集内的事件 kind → 必需字段 → 幂等键 → 失败/回滚语义 → 期望错误码，**凡涉钱须写清谁出钱/谁收钱/平台费与佣金来源分配**）＋ 弃用面最终处置（碎片四件套/`prize-item`/`auth/register|login` + 前端同步要求）＋ 权限单一真源（`users.is_admin` vs `admin_role*`）＋ 未决项 + 变更记录。**★ 残差与「重置键」（重要口径变更）**：本库有 append-only/no_delete 禁删触发器 ⇒ 批 2 真写库后**残差不可删**（这正是 D20 要整库重建的原因）⇒ **裁定：接受残差**（每批产出**命名空间清单**：夹具 uid/cid/`create_key` 前缀），批末与上线前用**已验收的重建脚本** `p3x-00-rebuild-replay.ts --apply --confirm-irreversible` 一键重置回 seed 基线（**我们首次拥有可重复重置键**）；**「重置」必须由我执行并留痕，不得由子代理自行触发**。 |
| v0.71 | 2026-09-29 | **★ §5.70 P4 批 1（GET 面止血）完成验收 —— 我亲跑终扫荡：17 个 GET 端点零 500（原 `500×9`）、`/api/home` 500→200 且 key 集完整；四片全程零写库（我自建探针 4 次读数逐值一致）；A 类残留全在写侧函数；两处语义变更待裁**。**四片（Kong，含 2 次基础设施中断后重派）**：B1-a `asset`→`account`(cid=1)（`b1a-20260929T135443`，`/api/user/asset/1` →**200**）｜B1-b `task`→`job` + `task_progress`→`job_application`+`job_submission`（`b1b-20260929T143421`，`/api/task/all`·`/api/task/1` →**200**）｜B1-c `prize`→`listing` + 碎片族空态弃用 + `permission_group`→空态（`b1c-20260929T151415`，**`/api/home` →200**）｜**B1-d（补漏）** `market_order`/`market_trade` 列名重写 `bID→base_cid`/`volume*→amount*`/`oID→order_id`（`b1d-20260929T181702`，`/api/market/1/orderbook`·`/trades` →**200**，根因 42703）。**★★ 我的三路终验收**：① 17 GET 全表零 500（`/`·`/health`·`/api/test/data`·`/api/home`·`/api/prize/all`·`/api/task/all`·`/api/task/1`·`/api/user/asset/1`·两个 market = **200**；`/api/prize/1`·`/api/task-progress/1` = **404**；`/api/prize-item`·`/api/task-progress`·`/api/shard`·`/api/shard/transfer`·`/api/order` = **401**）；② 零写库——我的探针在 `050655Z`/`061321Z`/`065656Z`/`102300Z` **四次逐值一致**（`users 0`/`account 4`/`currency 1`/`ledger 0`/触发器 43・非 `O` 0/checksum 17/17/`cid` next=4）⇒ 四片扫荡 + 4 次面板重启**全程未写库**；③ A 类双口径残留**只在写侧/死代码函数**（`task_progress 8`/`prize_item 6`/`task 4`/`prize 4`/`asset 3`/`permission_group 3`/`shard 2`/`shard_transfer 1`，脚本化 + 函数归属）⇒ 批 2/3；④ 冻结面（`migrations`/`ledger-errors.ts`/`ledger.ts`/`commission.ts`/`frontend`）**零触碰**；`tsc` 四片均 0；报告 `docs/audit/p4-b1-get-triage.md` **750 行 / 14 节 / `f8c356e5…`** 且四片 **append-only（0 删行）**。**★ 我自己的两处失误（已登记）**：① 「A 类 8 名已归零」是**单引号吞 `$n` 的假 0**（`$` 变行尾锚）⇒ 改脚本化双口径扫描得真值并据此重切 B1-c；纪律 = 判「零引用」必须**脚本化 + 双口径 + 函数归属**；② **B1-c 切分漏掉两个 market 端点**（P4-0 §5.2 早已预警 42703）⇒ 终扫荡发现仍 500 ⇒ **拒绝宣布批 1 完成**，补派 B1-d 才收口（「部分可用不是清账」实例）。**待裁（一句话可改）**：`/api/task/:tID` miss **404→200 空态** vs `/api/prize/:bID` **保留 404** ⇒ 同类端点两种行为，批 1 接受现状、批 2 由 spec 统一。**登记**：`getBrandById` 键语义错配（`listing_id` vs 品牌）、`buyer_uID/seller_uID` 系 `LEFT JOIN` 推断（中置信度）、`countGift*` 常量化会影响写侧 `syncPrizeInventory` 算术输入。**范围外（明确登记）**：26 个 POST/DELETE 写端点语义未改；余额变动仍走 `upsertAsset`/`adjustPoints`（批 3 改走 `ledger_post_event`）；`src/ledger.ts`/`src/commission.ts` 仍 0 路由引用。 |
| v0.70 | 2026-09-29 | **§5.68 + §5.69：Kevin 定 P4 批次 1 方向「先把现有端点从 500 救活」+ P4-0 侦察单验收 + ★ 我亲手补上前端消费面 ⇒ 推翻其「下线碎片四件套」建议 ⇒ 批 1 = 「GET 面止血 + 空态不删路径」，实施单已派**。**用户裁定（逐字）**：「先把现有端点从 500 救活（把 `task`/`prize` 等 jinli 遗留 SQL 按新 schema 重写或下线；首页能渲染才有后续）」。**P4-0 交付（Kong `deleg_f414bcb2`）**：报告 `docs/audit/p4-route-inventory.md`（**296 行 / 8 段 / sha256 `3ccd67ee396d5758113e3a00792ecf2223d8004e3c8aca4edf76053a04186d25`**）+ `scripts/p4y-db-probe.ts` + `.p4-artifacts/**`（6 件）；纯只读零写库。**关键读数**：**51 端点**（GET 25/POST 24/DELETE 2）；**31 个**引用 **A 类真·基表**（8 名：`asset/permission_group/prize/prize_item/shard/shard_transfer/task/task_progress`，逐一 `42P01` 实锤）；**B 类 8 名是 `WITH` CTE 别名、无害**；`src/ledger.ts`+`src/commission.ts` **0 路由引用**；新表 `job`/`listing`/`listing_order`/`admin_role*` **0 路由引用**；GET 扫荡 = **200×3 / 500×9 / 401×13**。**★ 我亲手补它自报 `NOT_MEASURED` 的前端消费面**：`frontend/src` **49 条去重 `/api/…`、23 文件**（`/api/prize/all` 11、`/api/task/all` 9、`/api/user/asset/:p` 6、`/api/shard` 4、`/api/prize-item` 4、`/api/home` 3、`/api/shard/transfer`·`/api/shard/redeem`·`/api/chest/:p/open` 各 1 等）⇒ **碎片四件套 + `/api/prize-item` 前端在用，直接删 = 打成 404** ⇒ **裁定批 1 不删任何路径**，改为 **`200` + 空态 + `deprecated:true`**，下线与前端同步推迟到批 2/批 3 并单独走前端改造单。**批 1 验收面（我定死）**：① GET 端点全绿（需鉴权的保持 401）；② `src/**` 内 A 类 8 名双口径归零；③ **字段集合契约不得变**（同一内存夹具喂改前/改后 mapper，逐 key 相等，空库不得丢 key）；④ GET 零写库（扫荡前后逐表计数逐值相同）；⑤ `tsc --noEmit = 0`；⑥ **POST/DELETE 写端点本批不改语义、逐条点名登记为批 2/批 3**（明确是范围切分，禁以「部分可用」收尾）。**已派实施单 P4-B1（Kong `deleg_fb44b445`）**：含「重启只许走面板单服务路由（现取 `ctrl/index.js` payload 形态）+ 严禁 `pkill`/`killall`/动其它 sid」「禁改 `migrations/**`、`src/ledger-errors.ts`、`frontend/**`」「列名先取 `information_schema` 真值再写 SQL」。 |
| v0.69 | 2026-09-29 | **★ §5.67 D20 Phase 2（真重建 + COMMIT）完成 —— 我亲手独立验证终点态全绿（9/9 类级断言）；残差清零、库回 `0001..0017` seed 基线；并锁定 `seafood-api` 500 根因（jinli 遗留 `task`/`prize`，非重建所致）⇒ 下一步 = ④ 路由层**。**执行（Kong `deleg_ce3c797d`，33 calls / 1329.6s）**：apply run `.p3y-artifacts/p3x-00-apply-20260929011509.-plain/**`；**我亲读 `E-gate.json`** = `gate.ok=true` / `commit_allowed=true` / **`tx_final=COMMIT`** / `object_diffs=[]` / `terminal_failed=[]` / `checksums_all_byte_equal=true` / `comparison_inside_tx=true` ⇒ **COMMIT 由闸放行**（`:792`）。`SUMMARY.ok=false / exit 5` **非失败**（末尾 `!F_net_zero.identical ⇒ 5` 无条件；apply 下 `A≠F` 是目的：`account 425→4`、`Σbal+frozen 378298107→0`）。交付：`scripts/p3y-00-pre-conn-registry.ts`（`408da9a9…`）、`scripts/p3y-01-post-apply-verify.ts`（`4a6f6dc5…`）、报告 `docs/audit/p3-d20-rebuild-apply.md`（**249 行 / 9 章 / `257cf94e…`**；泄漏 0）、探针两轮（首轮 1 FAIL=口径错已自曝；**末轮 24/24 pass**）。**★★ 我自建探针独立验证（HTTP 驱动，`ok=true`）**：`users/ledger_entry/referral/job*/listing*/market_*` 与 `0017` 六表 **全 0**；`currency` **1 行**（cid=1/`$`/`平台积分`/supply=0/listed）｜`ledger_owner` 4｜`account` 4（违例 0）｜`commission_policy` 1；触发器 **43**/非 `O` **0**；基表 **21**/视图 **1**/函数 **74**；`schema_migration` **17** 且 **checksum 17/17 逐字节相等（我自己重算）**；`currency_cid_seq` `last_value=3,is_called=true` ⇒ **next=4**；我自己跑 `npx ts-node scripts/migrate.ts` ⇒ **17/17 `skipped`**（`applied_at` 全 = 09:15:27）、`schema_version=0017`。**★ 我自己的探针自曝 4 条（全在我这边）**：① `Client`(ws) 只读时会踩驱动老化 ⇒ **promise 永不 settle、静默 exit 0、`finally` 都不跑（假绿风险）** ⇒ 只读一律改 `neon()` **HTTP**；② `neon()`@0.6.1 **无 `.query`** ⇒ 改运行时自适应 `sql.query ?? sql(text,params) ?? sql.unsafe`；③ 闸读数真结构 = 独立 `E-gate.json` + `SUMMARY.C_replay.tx_final`（我按 `SUMMARY.gate` 取到四个 `None`）；④ 本仓**无 `npm run migrate`**（入口 `scripts/migrate.ts`）。**★ 服务根因（读面板日志 `GET :5555/api/logs/seafood-api` 实锤）**：`seafood-api` 现 **PID 84578**/5788，`/health` **200** 且自报 `schema_version=0017`（库通）；`/api/home` 500 ⇒ `src/database.ts:1167 listTasks` 查 **relation `task` 不存在**（`42P01`）；`/api/prize/all` 500 ⇒ `src/database.ts:1017 listBrands` 查 **relation `prize` 不存在**；**同型错误 9/28 18:13 已在报 ⇒ 与重建无关** ⇒ **我裁定不重启服务**（健康面无异常、重启治不了 `42P01`），登记为 **P4 第一优先项**。**★ P4 范围基线（我亲跑 SQL 关系名盘点）**：遗留 = `task_progress` 14 / `prize_item` 14 / `shard` 8 / `shard_transfer` 6 / `task` 6 / `prize` 6 / `selected_prize(s)` 8 / `permission_group` 4 / `asset` 3 / 等；已接新 schema = `market_order` 9 / `referral` 9 / `ledger_entry` 8 / `account` 7 / `currency` 5 / `commission_policy` 4 / `market_trade` 3 / `app_config` 2 / `users` **9（带引号口径）**；**`job`/`listing`/`listing_order` 双口径皆 0 ⇒ `0013`/`0015` 未接路由**。**口径校正**：裸名口径下 `users`=0 是**我的正则不匹配带引号标识符**的假读数；补跑带引号 = 9 ⇒ 今后判「零引用」一律**双口径**并写明。**D20 第 ② 步闭合 ⇒ 下一里程碑 = ④ 路由层。** |
| v0.68 | 2026-09-29 | **§5.66 Unit J1（D20 apply 闸）验收通过 —— ★ 我亲读闸代码 + 亲跑三条分支 + 亲提取四跑闸读数 + 确认全脚本唯一 COMMIT 点；J2（真重建 + COMMIT）已派**。**交付（Kong `deleg_48672954`，22 calls / 512.6s）**：`backend-ts/scripts/p3x-00-rebuild-replay.ts` **`+92/−13`**（唯一被改文件，现盘 sha256 `4c0629cd502df1ef948b0d15fb88f4a238ba4daebbfb19c8d998d77961ad6c97`）；报告 `docs/audit/p3-d20-apply-gate.md`（**181 行 / 12 节 / sha256 `6ca908a3ff7eacb74443fb2a6c8321c1b079808dcd16276b9a7cf07250ab91cd`**；连接串零泄漏）；artifacts 四跑在**新命名空间** `.p3y-artifacts/`；既有 `.p3x-artifacts/**` 未被触碰（mtime 仍 01:48/01:49）。**★ 我亲读闸代码**：闸块 `:745-789`，**对拍在事务内、COMMIT 之前**（`:764` → `:784` 六项合取 → `:794`）；`gate.ok` = `replay_ok` ∧ `injected===false` ∧ `checksums_all_byte_equal` ∧ `snapshot_taken` ∧ `object_diffs_empty` ∧ `terminal_failed_empty`；`canCommit = mode==='apply' && confirmIrreversible && gate.ok === true`（`:792`）；**全脚本只有 1 处 `COMMIT`**（`grep -c` = 1），`MODE` 其余出现点均不写库。**★ 我亲跑三条**（我的运行把 `P3_ART_ROOT` 指到 scratch ⇒ **零污染仓库**）：`--apply` 无 confirm ⇒ **`refused` exit 2 且未连库**；`--dry-run --expect-corrupt` ⇒ **`gate.ok=false` + `ROLLBACK` + exit 3** 且 **`A_hash == F_hash == 699ac94d…3cdb41`**（与 3 小时前同哈希 ⇒ 库零变化）；正路干跑 ⇒ **`gate.ok=true` + `ROLLBACK` + exit 0**。**★ 四跑闸读数（我亲提取；真结构 = `E-gate.json` + `SUMMARY.C_replay.tx_final`，我第一版按 `SUMMARY.gate` 取到四个 `None` = **我的键路径错、非产物缺失**，已重取）**：**`…005447.-corrupt`（apply 分支判负）⇒ `gate.ok=false`、`commit_allowed=false`、`tx_final=ROLLBACK`、`net_zero.identical=true`（`A==F`）** ⇒ **闸在 apply 分支真实挡住 COMMIT 且库净零**；`…005114.-corrupt` 同读数（判负可复现）；`…005222.-plain` ⇒ `gate.ok=true`、`term=31/32`（1 项 `NOT_MEASURED=currency.supply_cap` 非失败）；`…005322.-inject0010` ⇒ `injected=true` ⇒ 拒（`file_steps=10/17`）。**回归**：与已入库 `…174808.-plain` 逐字段对拍 `C-replay-log`/`D-comparison`/`D-expectations-from-files` **0 差**，77 条残留差异全可归因（时间戳 21 / pid 2 / 他人会话 54）；`refused`/`--help`/注入三旧行为不回归；`tsc --noEmit = 0`（直接重定向取值）。**未验证照登**：闸放行后真 COMMIT 分支（由 J2 补）、`--expect-corrupt × --inject-fail-after` 组合、非 pooler 更强证据、在线服务并发锁、**闸对「文件派生期望本身系统性偏差」无防御**（已登记）。**已派 J2（`deleg_ce3c797d`）= 真重建 + COMMIT**（`--apply --confirm-irreversible` 单跑 + 独立只读探针 `p3y-01-post-apply-verify.ts` + `migrate` 17 `skipped` + `seafood-api` 只读观测；**判负口径已改：apply 下 `A≠F` 是目的、不得据此判负**）。 |
| v0.67 | 2026-09-29 | **§5.64 Unit I（判据② 收窄）验收通过 —— ★ 我亲跑它的探针完全复现（`EXIT=0`、`hard_fail=[]`、两跑 artifact **逐字段同形（仅 `run` 不同）**）；A4·B7 释放回 500、真事件对象仍 503、B6 接受项；★ 我另发现毒 getter 旧版是 `THREW` ⇒ 收窄顺带换来稳健性；P3 错误分类线（E→G→H→I）收官**。**交付（Kong `deleg_4bc8bb81`，21 calls / 233.2s）**：`backend-ts/src/ledger-errors.ts` `+29/−8`（**636 → 657 行**）/ sha256 `5a671354eb7bfd6707bb27a48a1e661b73745a63de59c5201957a602006bf3c4`；报告 `docs/audit/p3-errors-fold-narrow.md` **440 行 / 14 章 / sha256 `54403a95c35deb82f7e2268c0779b62ff1b487afce12b1f24131d192fc864c0f`**（`git diff --numstat = 158 0` ⇒ 纯追加、0–12 章逐字未改）；新增探针 `scripts/p3w-01-narrow2-verify.ts` + artifact `…174943Z.json` + `_impl/mutated-clause2-narrow2-…`（sha `e7b39540…`）。**★ 实现与裁决逐字一致（我亲读）**：判据② `:422` = `safeRead(e,'type')==='error' && typeof safeRead(e,'message')==='string'`；判据① `:414` = `isEvent && safeRead(e,'type')==='error'`；③ 未动；**承重注释已更正两处**（`:388`/`:417`：真 `ws.ErrorEvent` 只能由 ② 命中、**不得删除**）；`tsc --noEmit` **=0**（**直接重定向、非管道** ✓）；`p3w-00` 与 `_impl/` 三副本**零覆写**；`p3x-*` 零触碰。**★ 我亲跑复现（逐形态）**：三态内容 sha 自证 **全 `match=true`**；★ 守卫 **`ws_event_instanceof_global_event = false`（`guard_pass=true`；`ws@8.22.0`、`own_props=[]`、`own_msg_desc=null`、`typeof message=string`、`type="error"`）** ⇒ 判据② 承重前提机器可读固化；**A1/A2/A3 ⇒ 503** ✓；**A4 `{type:'error'}` / B7 `{type:'error',payload}` ⇒ 500 == baseline** ✓（fixed 为 503）；**B1–B5 ⇒ 500 == baseline** ✓；**B6 ⇒ 503（唯一 ≠ baseline，接受项）**；**C 13/13 三态逐字节相同** ✓；**R1/R2 ⇒ 500 == baseline** ✓；**G 5/5 不抛**；**判负三段成立**（红 = mutant 去 message 合取 ⇒ `RED_set=[A4,B7]` 全 503；绿 = narrow2 二者 500 == baseline；还原列 == fixed 列）；`worktree before==after`、`anchor_hits=1`、`mutation_diff_lines=1`。**★ 我的独立发现**：**G1/G2/G5（毒 `message`/`code`/`message+code` getter）在 baseline 与 fixed 是 `THREW/THREW/THREW`（分类器整体抛）**，narrow2 收敛 500 ⇒ **`safeRead` 守卫顺带换来一类稳健性改善，不是过捕**（登记防误判）。**★ 两跑 artifact 除 `run` 外全字段相等（21 键）⇒ 判可复现**；`mutated_c2` 两次再生 sha 相同 ⇒ 我复跑覆写该副本为逐字节同内容（照登）。**口径记账**：`ade3376:` vs 现盘 numstat = **74/16**，而 H(`+48/−11`)+I(`+29/−8`) = **77/19** ⇒ 差 3/3 是 **diff 代数折行**（I 改写 H 新增的注释行 ⇒ 对 `fixed` 只计一次），**非漏改**；判据 = 终态内容 sha + 三态对拍。**外部事件照登**：其运行期间 `HEAD` `209e556 → 0eda41a` = **我本人的入库**（它未 `git`、文件 sha 前后一致、按纪律用内容 sha 自证）。**自曝照登 3 条**（首跑 ts-node 编译期失败不计 run；print 段「派生行误取 `.per_impl`」与 Unit H §11.1 **同型第三次** ⇒ 记入探针模板缺陷；§13 一 restore 字段硬编码 `true` 已自标口径错误、按 `NOT_MEASURED` 读）；**`NOT_MEASURED` 9 项**照登（端到端故障注入 / 删整条判据② 的单点变异实测 / getter+setter `message` / 非 `ws` 依赖扫描 / 生产频率 / 路由层表现 / 毒 `name` getter / §14 指纹重算 / 还原端到端重跑）。**★ 本线收官**：真驱动事件对象 → 既有 503（`DL126` 不破）；过捕面 A4/B7 释放回 500 告警；B6 显式接受；判据② 承重双处固化；**驱动层本体仍为 A 档登记债务**。 |
| v0.66 | 2026-09-29 | **§5.63 D20 重建 Phase 1（dry-run）验收通过（我独立复核）+ 收紧我自己 §5.61 的一处口径错**。**交付（Kong `deleg_5491a270`，32 calls / 538.4s）**：脚本 `backend-ts/scripts/p3x-00-rebuild-replay.ts`（sha256 `505b6ba605cf0020c3bee024ad7acd53fd3de82cdaa1a13efbb3ed3257e4c2c7`；默认 `--dry-run`；`--apply` 双闸 `:741-742`）；报告 `docs/audit/p3-d20-rebuild-dryrun.md`（**262 行 / 11 章（0 / A–J）/ sha256 `fd6a5161cb62c0b24514f0a87343ac33871a7b4bf15fc61e14682e07c6aa9143`**）；artifacts 三跑（`…174551.-plain` 探路 / `…174808.-plain` 主对拍 / `…174912.-inject0010` 注入）。**★ 我独立取证（不采信报告）**：① 三份 `SUMMARY.json` `tx_final` 全 **`ROLLBACK`（3/3）**；② **`COMMIT` 命中 0**；③ `--apply` 双闸在位（无 `--confirm-irreversible` 即 `refused`；真 `COMMIT` 只在 `:719` 分支、未调用）；④ **连接串零落盘**（脚本/报告/artifacts `grep -rlE 'postgres(ql)?://'` = **0**）；⑤ **★ 净零我自己验**：我自己的只读盘点 **17:51Z vs 16:38Z**（跨 Unit C 三跑窗口）剔除 `run` 后 **deep-equal = TRUE**（`business` 逐表逐状态计数 / `ledger_by_cid` cid1 712 + 夹具 2527 / `appendonly_triggers 20` / `commission_policy 25` / `ledger_owner 4` / `migration_files_sha 17` / `cid1 8400==8400`）⇒ **三次 `DROP SCHEMA public CASCADE` 干跑零残留**。**它的读数**：**对象集全等**（TABLE 20/20、VIEW 1/1、FUNCTION 74/74、PROCEDURE 0/0、TRIGGER 43/43、SEQUENCE 13/13，`object_diffs=[]`）；**逐值终态 31/32**（`terminal_not_measured=["currency.supply_cap=NULL"]`；`currency` 1 行、`ledger_owner` 4 行逐字、`account` 4 行 0/0、`commission_policy` 1 行、业务表与 `0017` 六表 = 0、`schema_migration` 17、触发器 43 且非 `O` 0）；**17 文件 sha256 == registry checksum 17/17 逐字节**；**E 注入演练成立**（`--inject-fail-after=0010` ⇒ `P0001` ⇒ 后续语句 `25P02 current transaction is aborted` ⇒ 整体中止 ⇒ `ROLLBACK` ⇒ 事务外 pre-state 逐值未破坏）；**F 净零 `A_hash == F_hash == 699ac94d…`**（主 run 与注入 run 同值）。**★ 我的勘误（责任在我）**：§5.61/派单里「`currency.cid` 序列下一值 = **2**」**作废** —— 文件派生期望 = **4**，归因到 `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:413` 与 `migrations/0012_replay_pre_gate_before_balance_gate.sql:1180` 各一次「列清单不含 `cid` 的 `INSERT INTO currency`」；**我亲核二者均在「子事务 + 哨兵回滚」块内**（`0011:403` / `0012:1176` 附近；`EXCEPTION` 计数 17/13）⇒ **行随子事务回滚、序列推进不撤** ⇒ 2 + 2 = 4 ✓。**登记**：pre-state 该序列 `last_value = 293` ⇒ **Phase 2 之后序列值必然 ≠ pre-state（属预期：重建后新币从 cid 2 起分配，不得当漂移判负）**。**风险/边界逐字保留**：Phase 2 不可逆；本机无 `pg_dump` ⇒ A/F 是**观测不是可回灌备份**；**10 项 `NOT_MEASURED`** 照登（Neon PITR / 重建后应用层端到端 / 其余 69 个函数与触发器定义体逐字节 / 序列按名对拍 / 真并发锁竞争 等）；探针缺陷自曝 5 条。**Phase 2 闸**：**未授权、未执行**，待 Kevin 一句话点头（届时 brief 必含：`--apply --confirm-irreversible` 单跑 + 逐值对拍 + 触发器 43/非 `O` 0 + 注册表 checksum 17/17 + 事后 `migrate` 全 `skipped` + next=4 口径登记）。**顺带闭合** P1e「`0007`/`0008` 未在空库从零跑过」。 |
| v0.65 | 2026-09-29 | **§5.62 Unit H（错误分类窄化）验收通过 + ★ 我亲取「真对象承载者」真值 ⇒ 裁定 B6 非过捕（我原 AC 作废）/ A4·B7 同类真过捕（判必须再收窄一行）/ 判据② 承重且源码注释必须更正；派 Unit I**。**交付**：`backend-ts/src/ledger-errors.ts` **+48/−11**（599→636）/ sha256 `7895390ea5616339…`；报告 `docs/audit/p3-errors-fold-narrow.md` **282 行 / 13 节（0–12）/ sha256 `5cca998d5def757e…`**（两者我盘面复算逐字相同）；**实现与裁决逐字一致**（删③ 第二子句、① 加 `type` 闸、② 不动、`safeRead` 守卫覆盖 `code`/`constraint`/`message`/`type`/`instanceof`、`errName` 未动、`tsc` exit 0）。**读数**：A 组 4/4 `LEDGER_TX_TIMEOUT`/503；**B1–B5 == baseline（500）**；C 组 13 例三态逐字节不变；R 组 2/2 回 500（登记释放）；毒 getter 三形态（`message`/`code`/`type` 抛）**均不抛**。**判负三段**：baseline `[]` 绿 → fixed `[B1..B7,R1,R2]` 红 → narrowed `[B6,B7]` → 单点变异（复原第二子句）红；3 次 run payload sha 全等 `466fc317…`；工作树全程未被写。**★ 我真值（判别量）**：`ws` 的 `Event`/`ErrorEvent` 是**自有类**（实测 `new ws.Event('open') instanceof globalThis.Event === false`）⇒ **判据① 对真对象永不成立**；真对象 **own props 空**、`message`/`type`/`error` 全为**原型 getter**、`typeof message === 'string'`（源码 `ws/lib/event-target.js:105-138`：`options.message === undefined ? '' : options.message` ⇒ **恒为字符串**）；`globalThis.ErrorEvent === undefined`（Node 18.19）；驱动 dist **无**自造 `type:"error"`（0 命中）；本仓后端 `type:'error'` **0 命中**（唯一命中为前端 Toast）⇒ **真对象只能靠判据② 命中 ⇒ ② 承重**；**原注释把真对象归到判据③ 是错的**（真对象无 own `message` 描述符）——有具体危害：后人据它认定「② 冗余」而删掉 ⇒ 真对象重落 500 ⇒ **重破 `DL126`**。**勘误（我自己 brief 写错）**：**B6 `new Event('error')` 是真事件对象（①∧②命中）⇒ 我原 AC「必须 == baseline」作废**、登记为接受项（Kong 按裁决字面执行 + 如实登记冲突，**判其行为正确**）；**A4 `{type:'error'}` 与 B7 `{type:'error',payload}` 属同一类真过捕**（非 Event 实例、无 `message` 的普通对象仅凭 `type` 位被归入事件族 ⇒ 503 静默降级 500 告警，与 Unit G 抓的那类同源）⇒ **判「必须收窄」**：② 加合取项 `typeof safeRead(e,'message') === 'string'` ⇒ **A1/A2/A3 全保留**（真对象与 A2 恒带字符串 message）、B1–B5 本已靠 `type` 缺失排除、**A4/B7 释放回 500**；**风险面登记**：将来出现「非 `ws` 事件实现、只带 `type` 无字符串 `message`」且确属驱动故障 ⇒ 会落 500（**未观测形态**，代价方向远窄于「任何 `new Error()` 被静默降级成 503」）。**已派 Unit I（`deleg_4bc8bb81`）**：收窄一行 + 注释更正（写明 ② 承重、不得删除）+ **可机读回归守卫 `ws_event_instanceof_global_event === false`** + 新 AC 矩阵 + 判负自证；DB 零写、纯函数探针。 |
| v0.64 | 2026-09-28 | **§5.61 D20 残差处置：我亲跑只读盘点（双源对拍）+ 路线定案「事务内重建」+ 破坏性分级（Phase 1 dry-run 即刻授权 / Phase 2 COMMIT 待 Kevin 点头）**。**盘点（`scratch/zang-d20-inventory2.js`，run `20260928T163938Z`；v1 因我猜错列名 `referrer` 早停 ⇒ 其 `cid1: undefined`/失衡 `[]` 为假读数、已作废）**：`users 673 / account 425 / ledger_entry 3239 / referral 349 / currency 132 / commission_policy 25 / job 110 / job_application 32 / job_submission 10 / listing 62 / listing_order 21 / market_order 68 / market_trade 19 / ledger_owner 4`，`0017` 六表 = 0，`schema_migration` 17。**★ 结构性阻断**：实测 **20 个禁删/禁改触发器**（5 表 append-only + 6 表 no_delete + 4 表 core-immutable + `0017` 五表 key-immutable）⇒ **行级清除路线不可行**。**★ 平台骨架由迁移 seed（`0001` §13）**：`$` cid=1 **supply 0** + `setval(cid_seq,1)` + `ledger_owner` 4 行 + 平台 `account` 4 行 0/0；`0007` 亦 seed `policy_id=1` 并自带自检 ⇒ **重建即回 spec 声明基线**，现存 `supply 8400` 与 `commission_policy 25 行`（`1`+`20..37`+今日 `75..80`）**均为测试残差**。**双源对拍**：Kong `p3q-01` @14:06Z `564/106/341/2984/283/22` vs 我 @16:38Z ⇒ 差 = 其后 2.5h 套件写库，**结构一致无矛盾**（它已独立登记 append-only 禁直删 + `cid1_sensitivity`，我复用不重做）。**★ 新发现（登记待查）**：7 个夹具币 `supply` 与 Σ账户差 `+1`（`104/112/121/130/138/149/158`，owner 942001）；库内**无** `supply ≡ Σaccount` 不变式 ⇒ 非「不变式被破坏」，成因未定位、**拒绝推测性归因**。**路线**：单连接 `Client` + `DATABASE_URL_UNPOOLED` 单事务内 `DROP SCHEMA public CASCADE` → `CREATE SCHEMA public` → 重放 `0001..0017` 原文 → 全量对拍 → `COMMIT`；**本机无 `pg_dump`** ⇒ 回滚靠**事务原子性**，另出**取证快照**（并如实声明**不是可回灌备份**）；顺带闭合 P1e 遗留「`0007`/`0008` 未在空库跑过」。**Kevin 表单超时未填 ⇒ 不阻塞、取推荐项、只推进净零 Phase 1**（一句话可改）。 |
| v0.63 | 2026-09-28 | **§5.60 套件口径按类修交付（Unit F）验收通过 + ★ 错误分类修复的独立质检 verdict = `部分可用`（Unit G）—— 我亲验出 **7 个非事件形态被过捕**（`new Error()` 一族 500→503）⇒ **判必须收窄、派 Unit H**；登记「质检在跑时不得动 HEAD」**。**Unit F**：报告 `docs/audit/p3-suite-caliber-fix.md` **151 行 / `e718f2af…`**；`p1o-00` **+114/−11**、`p2w-00` **+116/−33**。**A**：新单列 `env_jitter`（严格档 `code=LEDGER_TX_TIMEOUT ∧ status=503 ∧ reason∈{pool_connection_timeout,driver_connection_error}`）+ 新 verdict + 留痕 `expectation_mismatches_raw`，**五项既有 verdict 判据逐字未动**；修前 `MULF8X80` mismatch 1（`E-W4_unfreeze/over_bigint_far` 503）⇒ 修后 `MULFRRL5`/`MULG83F0` **EXIT=0** 全绿；正向 `MULGHW3E` `env_jitter 1`/mismatch 0；**三条变异判负均 EXIT=1 且 `env_jitter 0`**（(i) 期望 409 给 400 `MULG1Z0Y`；(ii) **非 transient 500** `MULG1Z0H` ⇒ `unexpected_500 1`；(iii) 同类异码 `MULG1Z0V`）⇒ **不吞真错码**。**B**：`20260928T162825Zn3c5` **EXIT=0 / reds 0**；D4/D5 加**显式裁决点** `SET CONSTRAINTS ALL IMMEDIATE` ⇒ flush 抛 `LD032`；D7 转**登记不判**（`0011:96–99`/`112–133` + D6 同口径，实测 flush 仍 `ok=true`）；E4 可对照杆（`depth=1`⇒`23505`）+ 保留原杆；F3 **`unreachable:true`** + F3b；控制杆：合法 flush 不报 / **摘闸对照不报 ⇒ `LD032` 确出自该闸** / E1·E2 ⇒ `LD003`。**F 自曝**首跑 `zkdd` 1 红 = 自己控制杆顺序错（`55006`）⇒ 改序复绿、两跑读数均留。**Unit G**：报告 `docs/qa/p3-errors-fold-fix-review.md` **285 行 / `89efdcbe…`**；**verdict `部分可用`** —— L1/L2/L3/L6/L7 全绿（真 `ws.ErrorEvent` 503 / 13 对照逐字节相同 / R107 无泄漏且服务端 4/4 可取 / 变异三态红-绿-红且未改被检件 / `tsc` 0 / 29 函数+4 触发器 md5 相同 / 43·0 / `migrate` 17 skipped / **补上 `public.schema_migration`=17 的表名口径缺口**）；**L4 红**：19 处状态变化中 **9 处是真非事件对象**（`new Error()` / `new TypeError()` / 无参 Error 子类 / `Object.create(Error.prototype)` / `Object.create({message:'x'})` / 原型数据属性 message 类实例 / `{type:'error'}` 信封 / `new Event('message')` / `new Event('open')`）**500→503**；根因 = **`:377` 判据③第二子句**（`Error.prototype.message === ''` 是字符串 ⇒ 任何无 own `message` 的 `Error` 被误判）；**L5** 误捕 7/20 + 2 非错误 `Event`、方向恒 500⇒503、**毒 getter ⇒ 分类器整体抛**（建议记档）；**它给的收窄公式**（①加 `type==='error'` / 删③b / 留③a，支撑 = 真 `ws.ErrorEvent` 恒带 `type='error'`）。**★ 我亲验（A/B 16 形态，`721156cb…` vs `9bc127e4…`）**：**变化 11/16** —— A1–A4 预期内、**B1–B7 预期外（全 500→503）** ⇒ **G 的红面独立复现为真**；根因实测 `new Error()` 无 own `message` 而 `typeof message === "string"`（`""`）⇒ 命中 `:377` ✓；对照 `new Error('boom')`/`{message:'x'}`/`{code:'22003'}`/`{}` 均不变 ✓。**我的裁定**：① **采纳 G 收窄公式**（预期 B1–B7 回 500 且与 baseline 逐字节相同、真 `ws.ErrorEvent` 仍 503）；② `{type:'error'}` 业务信封列为**接受残余**（标准判别位 + `LedgerError` 先被排除、业务响应不经此路）；③ **顺带修毒 getter 健壮性缺口**（同一类缺陷 ⇒ 分类路径属性读取全经守卫，getter 抛 ⇒ 该子句不匹配、**不抛**）；`errName` **仍不动**。**程序性教训**：**G 作废一整次 run** —— 它在跑时我提交了 `ade3376` ⇒ HEAD 移动使 baseline 副本 = fixed；它改用 `HEAD^` 并**用内容 sha 自证**后重跑 ✓ ⇒ **纪律：质检在跑期间不得动 HEAD；brief 必须写死「baseline 用内容 sha 自证，不得用 `HEAD` 符号自证」**。**D20 现取**：`673 / 425 / 3239 / 349 / 132 / 25`（43 触发器 / 非 `O` 0 / `cid=1` 8400==8400）；**F 的增量表只覆盖其 before/after 一对、未覆盖其后变异跑 ⇒ 按我现取总账登记**；E→now 合计 `+90/+60/+38/+56/+18` ⇒ **Unit C 必须以「先冻结旧套件」为前提**。**已派 Unit H**（窄化 + 守卫，纯函数 DB 零写，形态集逐字取自 G 三张表；AC = B1–B7 == baseline、A1–A4 == fixed、13 对照两态不变、毒 getter 不抛；判负 = 回退窄化必须红）。**Unit C 排 H 之后**。 |
| v0.62 | 2026-09-28 | **§5.59 错误分类缺口修复交付 + 我独立验收通过**（Unit E `deleg_c3516af3` / Kong，47 calls / 1561s）：报告 `docs/audit/p3-errors-fold-fix.md` **394 行 / 35937 B / sha256 `fa6983cea21add8d5fd8d3f6…`**（§0–§10 共 11 节）；**唯一改动文件** `backend-ts/src/ledger-errors.ts` **+134 / −0**（修后 sha `9bc127e4…` vs HEAD `721156cb…`）。**★ 我独立复核**：**亲跑 `npx tsc --noEmit` = exit 0**；亲读 `isEventObjectFamily` `:369-379`（三条判据：`instanceof globalThis.Event` / `type==='error'` / 可读字符串 `message` 但**非 own 数据属性**）+ `:392` 分支（**在池超时正则 `:391` 之后** ⇒ E8 保留更精确 reason）+ 诊断面 `:414`/`:473-501`（只读无副作用）；`LEDGER_ERROR_TABLE`/`errName` **未动** ⇒ 33 码闭集与状态映射零改动；**`:388` 对带 PG SQLSTATE / `LEDGER_` 码的对象先早退 ⇒ PG 错误结构上不可能被误捕**，误捕面仅限「无 code 的非 PG 对象」且方向为 **500→503 安全失真**；**亲跑库体检 `583/387/3201/293/123`、触发器 43、非 `O` 0、`cid=1` 8400==8400** 与它 §7 `run3-post` **逐值相同**。**逐例对拍**：**8 例事件对象族 ⇒ 既有 `LEDGER_TX_TIMEOUT`/503**（`reason=driver_connection_error`；E8 = 既有 `pool_connection_timeout`），修前 `RED_set(5)=[E1,E3,E4,E5,E7]` 全为 `500/unclassified_non_pg_error`；**对照 13 例逐字段逐字节不变**（`control_mismatches=[]`）⇒ 「保留残余类 500」实证未变；**★ 它实测了真 `ws.ErrorEvent`**（`ws` 的 `exports` 不导出该 subpath ⇒ 绝对路径取 `lib/event-target.js`；并测得 **`instanceof Event === false`** ⇒ 只靠 `instanceof` 会漏，判据②③必要）。**R107**：对外 `details` 仅 `{reason,error_code|source}`、`r107_detail_leaks=[]`；服务端面实测 `ctor=ErrorEvent`、E7 `cause_chain` 取到内层 `ECONNRESET`。**判负自证三段齐全**（红 5 项 → 绿空 → `cp` 还原 sha **逐字节 = baseline** 且回同一红集 → 重装再绿）。**★ 我的裁定一：`errName` 维持不动**（它请求仲裁）—— 我原令「诊断侧改 `constructor.name`」若读成「改 `errName`」会与「对照逐字节不变」冲突（C13 对外 `error_name` 会 `Error`→`Object`），而 `errName` 喂的正是**对外** `details.error_name`（R107 面）；它把 `constructor.name` 落在**新建服务端诊断载荷**上（E3 实测 `ErrorEvent`）⇒ **采纳实现方读法，我的措辞收窄：「诊断侧」= 服务端面**。**★ 我的裁定二：端到端第 3 次那 1 格 `expectation_mismatches` = 环境抖动、非判负** —— `unexpected_500` = **0/0/0（AC 达标）**，`expectation_mismatches` = 0/0/**1**（`E-W4_unfreeze/amount/over_bigint_far` ⇒ **`LEDGER_TX_TIMEOUT/503/driver_connection_error`**，它**按令未宣称绿**）；交叉 12 份历史 artifact：**同一抖动修前呈现为 `500/unclassified_non_pg_error`**（u500 历史最高 **13**）⇒ 修后降级为**既有 503**，残余 mismatch = **套件期望表缺「既有 transient 档」**。**未验证照登**（第 2 次退出码 `NOT_MEASURED`〔420s 工具时限截断、套件本身已完成并落盘 `MULEYYXQ` 六项全 true，**未重跑伪造**〕/ run1 后行数对 / 修前服务端面 / 在线 e2e / **判据③误捕概率**〔⇒ 转 Unit G 必做〕/ 超长 message 截断 / `p3t-01` 复数表名 `schema_migrations` ⇒ `null`）。**探针自曝 7 条**（★ E3 首版用**不存在**的 `ws.ErrorEvent` 导出 = **假物冒充真物** ⇒ 两次读数**作废但保留可回溯不删、不进判定**；★ 早先一次 `tsc` 退出码**取自管道之后** ⇒ 作废重测；样本量诚实声明）。**库侧净增** `account +12 / currency +4`（套件自身夹具），`ledger_entry` 恒 3201，并入 D20。**已派 Unit F**（套件口径按类修：`p1o-00` 加 `env_jitter` 单列且**不得吞真错码** + `p2w-00` 五红按 §5.56 落码，**每条带判负自证**）+ **Unit G**（Neng 独立质检，**只读不写库**：判据覆盖 / 对照不变 / R107 / **误捕面实测** / 变异判负 / `tsc`）。**Unit C 排其后**。 |
| v0.61 | 2026-09-28 | **§5.58 P3 地基 500 族定案**（Unit D `deleg_5ed5b8fa` / Kong，32 calls / 1938s）：报告 `docs/audit/p3-p1o-500-rca.md` **307 行 / 36773 B / sha256 `e02a4a5f3890689e7834d819…`**（§0–§10 + 附表）；探针 `p3s-00..03.ts` + `.p3s-artifacts/**` 13 件；套件自产新 artifact `{MULDMPGC,MULE72UL}`；**tracked 文件零改动**。**★ 定案：五成员在正确形态下 10/10 得期望 400**（`over_bigint_far`/`bigint_max_plus_1`/`E-W3` ⇒ `OVER_MAX_SINGLE_AMOUNT`；`scientific_1e5` ⇒ `EXPONENT_NOT_ALLOWED`；`undefined` ⇒ `MISSING`），**0/10 500** ⇒ **非输入校验缺口、非套件调用形态/期望口径问题**（两分法：契约形态 10/10 裸 `LD016`、传输重放 10/10 裸 `LD016` ⇒ 按 `ledger.ts:1036` 换算即期望的 400 类；TS 最小单位闸 3/3 → `OUT_OF_BIGINT_RANGE`；控制格合法 `'1'` → 409）。**★ 红项机制（决定性取证）**：所有红格 `details` 一律 `{cause:"non_pg_error", reason:"unclassified_non_pg_error", error_name:"Error", error_code:"none"}`，与**离线合成的 `ws` `ErrorEvent` 仿体**输出**逐字节吻合**（`error_name` = `Error` 系 `:266` 的 `?? 'Error'` 对无 `name` 属性对象的默认值），而 PG 错误会带 `pg_code`/`unclassified_pg_error` —— **artifact 0 例**；稳定连接下 101 次驱动失败 **0 次非 PG**；**套件崩溃原文**链到驱动 `index.js:1379` `_connectionCallback` ← `reportStreamError` ← `WebSocket.onError` ⇒ **连接建立期、与红项同层同源**。**★ 我独立复核（现取）**：`:363` 兜底分类 / `:366-367` `TRANSIENT_NON_PG_REASONS` / **`:388-399` P1c 503 通路已在**（注释「绝不再让『过载』冒充 500 实现缺陷」）/ `:450-456` 500 折叠；`ledger.ts:1211`+`:1234-1235` **`amount` 字符串确无 TS 闸**；`assertInTransaction` 在 `src/` **无调用点** ⇒ `LD024` 非「不在事务内」触发；**库侧我探针 `583/375/3201/293/119/25` 与它 §7 逐值相同**。**★★ 真缺陷立案（本轮唯一）**：**`classifyNonPgError`（`:354-364`）判据覆盖不足** —— 事件对象（`message` getter-only / 无 own `message`）落 `unclassified_non_pg_error` ⇒ 跳过 `:390` 的 503、折叠成 `LD024`(500) ⇒ **违反 `DL126`「500 类只允许由不变式被破坏触发且必须告警」**、污染 R108 告警面（P1c 的意图在此形态上漏网）。**我的裁定（两分，其一收窄）**：① **采纳并加强分类修复** —— 事件对象族并入**既有** `driver_connection_error`（既有 503 通路）⇒ **不新增码、不动 33 码闭集与状态表**；② **收窄 Kong 提案（拒绝「诊断塞 `details`」）** —— `details` 属**对外响应面**，`ledger-errors.ts:447` 逐字「不外泄原始信息（**R107**）」⇒ 诊断只进**服务端日志 / R108 告警载荷**；`errName` 的 `?? 'Error'` ⇒ 诊断侧改 `constructor.name`（仅服务端）；③ **保留** `unclassified_non_pg_error ⇒ 500` 残余现状（不扩面）。**登记给 Jing 下次规范批（澄清句，不单开轮）**：诊断字段属服务端面 / 事件对象归 `driver_connection_error` / 残余类的桶归属。**触发器 43 vs 44 结案 = 43 为真**（17 SQL 口径 + 32 变体**无一得 44**；`information_schema` 51 = 43 + 8〔7 个多事件触发器展开 3+2×6〕；5 时点恒定；双方一致「零禁用」）。**`+108/+229` 结案 = 口径差非矛盾**（那是六套件**批跑**，本单只跑 `p1o-00` 单套件 ⇒ `users +0 / ledger_entry +0`；它**点名差异并拒绝推测性归因** ✓）。**`p1o-00` 现状态**：本单 3 次自测 = **崩 → 1 红（`MULDMPGC`）→ 0 红（`MULE72UL` 六项全 true）**，红格与既有红集**不相交** ⇒ **套件随环境抖动**；**定案「非账本缺陷」**，`PASS` 不可复现。**已派 Unit E**（修折叠；AC = `unexpected_500` 归 0、若 `expectation_mismatch` 仍在**不得宣称绿**）。**库侧净增**：`account +10 / currency +5`，`ledger_entry` **全程 0 增**；自产 `CID 274/275/278/279` 系并入 D20。**未验证照登**（WS 层 `ws_constructs=0` / 池活动 / 折叠后 stack 是否进服务日志 / `ErrorEvent` 真实路径一手抓取 = `null`〔三方合证〕/ 「44」来源 / 换驱动）。 |
| v0.60 | 2026-09-28 | **§5.57 基线 RCA 独立质检收口**（`deleg_3cdfc07b` / Neng，37 calls / 1095s）：报告 `docs/qa/p3-baseline-rca-review.md` **173 行 / 26816 B**；verdict = **`部分可用`**。**★★ 可用面 6/8 —— 最关键是 T1「生产形态」（默认 DEFERRED + 真 `COMMIT`）**：对照臂**提交成功**，两形态篡改臂**在 `COMMIT` 时抛 `LD032 / COMMISSION_SPLIT_SUM_MISMATCH`（`event_closed:true`）且事后 0 行** ⇒ **账本默认路径确实会判负、无真洞，且由第三方自建夹具独立取得** ✓✓；**T2** 闭合后 flush **必判负** ⇒ 证明是「未闭合⇒豁免」而非「IMMEDIATE 一律不判」；**T3/T3b** 提前钉 IMMEDIATE ⇒ post 与随后 flush 均不报（闭合后仍不报）⇒ **逃逸只在未闭合窗口**；**T4** 仅 DEFERRED + 回滚 ⇒ 无错 ⇒ `null` = 闸无裁决机会；**T5** E4 反例复现（`depth=0`⇒`23514`；同杆 `depth=1`⇒`23505/referral_pk`）；**T8** 五项不变量逐位相同；**T6** 行号/文本逐字核全中（另指出 D6「不判」注释在 `:483`、`:484–491` 是分支代码 —— **行号小节瑕疵、实体结论不变**）。**★ 我撤回自己的一处定案（我错）**：**T7 `p1o-00` 不复现** —— Neng **2/2 次 `EXIT=1`（RED）**，而我仅凭**单次** `EXIT=0` 就在 §5.56 ④ 写「订正为 PASS」⇒ **违反我自己的纪律⑨**（单次绿不足以改判）；**合并证据 = 3 崩 + 1 绿 + 2 红 ⇒ 现状态「不稳定、`--assert` 收红」，「PASS 可复现」撤回**。**红的性质（我读三份 artifact）**：`unexpected_500 / expectation_mismatches` = **0/0 → 4/2 → 13/3**，成员逐次**漂移**（同一输入 `over_bigint_far` 两次落不同入口）；三份共同 = **逃逸类 4 项全 0** + `wrote_no_ledger_rows=true` + `cells_total 604`；错误形态一律 `code=LEDGER_TRANSACTION_REQUIRED / status=500 / reason=unclassified_non_pg_error`（期望 `must_400/LEDGER_AMOUNT_INVALID`）⇒ **非确定性签名、成因未定位**。**★ 我抓的两条线索（不代裁）**：① **观测缺口** = 映射器把非 PG 错误折叠成 500 且丢原始信息（**这本身可修**）；② **期望口径两分** = 若「正确形态（事务内）」能得期望 400 ⇒ 属套件期望口径（与 `p2w-00` 同型）；否则为实现侧校验缺口。**我明确拒绝「不稳定就归因连接层」的免证归因**。**QA 额外发现**：① 库内**无 `schema_version` 键值表**（只有 registry）⇒ RCA 表名引用不精确、**等价结论成立**；② **计数口径差**：public 非 internal 触发器**我 43（两次可复现）vs Neng 44**，但**双方一致报「零禁用」**（我 `non_O=0`；它 44/44 全 `O`）⇒ **实质结论双证**、仅枚举集合差 1（登记，不升级为矛盾）。**QA 增量（我独立复现逐值一致）**：跑后 `583 / 365 / 3201 / 293 / 114 / 25`（= 其 §8 末次快照）；净 `+10/+20/+26/+6/+4/0`；**篡改臂零残留**；自产 `cid 272/273`（`p3n19*`，**supply 1e6**，对照臂真提交）+ `cid 274/275`（`P1P*`）+ 10 用户 + 6 邀请链 + 26 分录 + 12 账户 ⇒ 并入 D20。**纪律点名**：两次探针缺陷**自曝并重跑**（不存在的 `public.schema_version` 表 ⇒ 改发现式读取；`filter((_e,i,n)=>i<n-2)` 的 `n` 是**数组** ⇒ 载荷变空被 `LD016` 拒而**误报「篡改已提交」** ⇒ 改正 + 库侧复核 + `tamper_valid` 自证）；误停那次真提交的 13 行**如实并入增量**。**处置**：派 **Unit D**（`p1o-00` 500 族定位：五成员 ×≥10 次稳定率 + 两分法〔套件形态 vs 事务内正确形态〕+ **原始 stack/cause 取证** + 决定性判别量 + 触发器计数口径差结算）⇒ **Unit C（残差清理）排其后**。 |
| v0.59 | 2026-09-28 | **§5.56 基线 RCA 收口**（`deleg_a0eca242` / Kong，42 calls / 924s）：报告 `docs/audit/p3-baseline-rca.md` **198 行 / 30542 B / sha256 `c109a095c68cd17ef3fb24c4…`**（自报 30481 B = 末次 patch 前旧快照，盘面为准）。**★ 五红全部 = (c) 探针口径错、零真缺陷 —— 我的退回被完全回应**：**D4/D5** 闸是 `DEFERRABLE INITIALLY DEFERRED` 而 `p2w-00` L455/L464 的 `SET CONSTRAINTS … DEFERRED` 无状态变化、脚本**从不 flush** 又跑在回滚事务 ⇒ **闸结构上永无裁决机会**；同形载荷 + 一次 `SET CONSTRAINTS ALL IMMEDIATE` ⇒ **`leg_R`/`leg_R4` 抛 `LD032/COMMISSION_SPLIT_SUM_MISMATCH`** ✓。**D7** L474 在 `badPost` **前**钉 IMMEDIATE ⇒ 落 `0011:128–133`「未闭合⇒豁免」、闭合后无裁决点；**★ 决定性证据 = `p2w-00` L483 逐字「④ 边界登记（不判，如实登记）」且 D6 只登记不判 ⇒ D7 去判 D6 明示不判的同一模式 = 探针自相矛盾**。**E4** 摘杆连 `0011:252` 的 `NEW.depth := 1+…` 一起摘 ⇒ 字面 `depth=0` 先撞 `0007:60 CHECK(depth>=1)` `23514`；**它按 §5.7 ⑧ 举出反例**：同杆改 `depth=1` ⇒ 复现期望 `23505/referral_pk`。**F3** 期望「继承 50⇒51」= 被摘掉的那段代码 ⇒ **期望本身不可达**。**它主动排除 (d)**：三条既有 artifact（含 `2026-09-27`）与上一单两跑**逐字节同形** ⇒ 现象跨 P2/P3 稳定复现、与 P3 无关 ⇒ 判据**从写下那天起就放错落点**。**★ 我逐条独立复核通过**：`0011` **文件头 L54–56 逐字登记该设计边界**（「默认 DEFERRED 路径的判负能力**逐字不变**」）；`0011:126–133` 豁免分支原文；`0011:252` 确在 `referral_cycle_guard` 内；`p2w-00` L455/464/474/483 逐字相符；**`src/**` 的 `SET CONSTRAINTS` 命中 = 0** ⇒ **逃逸在应用路径不可达**；驱动 **0.6.1** 引述正确；**我自跑只读探针**（`zang-rca-verify-20260928T143236Z.json`）：`0017` / registry **17** / 基表 **21** / 视图 **1** / 非 `O` 触发器 **0**（总 43）/ 守恒触发器 `tgdeferrable+tginitdeferred` 均 true / 四编排函数指纹**未变** ＋ `ledger_assert_commission_conservation 2967·27ddc76b…` ＋ `referral_cycle_guard 6075·7bd5874f…` ＋ `referral_bind 1726·fe598897…` **与报告 §9 逐值相同** / `cid=1` **8400==8400** ⇒ **账本无真洞，判为「已核准的设计边界」**。**`p1o-00` 订正**：重跑 **`EXIT=0` PASS**（3658 B / 604 cells / 逃逸类全 0 / `wrote_no_ledger_rows=true`）⇒ 上一单 `NOT_VERIFIED` **订正为 PASS**，其 3/3 崩 = **非确定性连接层缺陷**（样本 1、`NOT_REPRODUCED`）。**加固裁定 = 认可只出方案**（崩点在驱动 `_connectionCallback`；探针走自建 Pool 不经 `src/db.ts`；`pool.on('error')` 挡不住回调内同步 throw；且无红态即无对拍）：**A 档登记债务不做 / B 档不做 / C 档（探针层：先落盘骨架 artifact + 池 `on('error')` + 顶层 `unhandledRejection` 守卫只写 artifact 并 `exit 2`）定为今后新探针标准形态、不追改存量**。**真库增量（我复现逐值一致）**：净 `account +4 / currency +4`（自造 `cid 268/269/270`〔根因=顶层 `ensureCurrency` 跑在事务外，它已自曝〕+ `p1o-00` 自产 `cid 271` +4 零余额账户）；`users/referral/ledger_entry` 0 增量、`9909xx` 窗口 0/0/0、`cli:kong18-%` 0 行 ⇒ 并入 D20 清单。**处置**：派 Neng 独立质检（**生产形态真 COMMIT** 下篡改必须抛 `LD032` 等决定性 leg）⇒ 通过后派 Unit C 残差清理。 |
| v0.58 | 2026-09-28 | **§5.55 底盘体检基线 + `DL155` 闭合 + D20 残差清单**（`deleg_34949e33` / Kong，30 calls / 2080s）。报告 `docs/audit/p3-baseline-regression.md` **302 行 / 23499 B / sha256 `73c53ad1058fdd466c25e0bd…`**；`DL155` = `src/db.ts` **精确 1 行**（`public.schema_migration`）⇒ **验收通过并闭合**（修前/修后均返回 `0017`、`tsc` 0 err）。**基线三元组**：`tsc --noEmit` **PASS** / `tsc -p tsconfig.scripts.json` **FAIL（基线 10 错非台账 9，登记待清）** / `p1t-00`×2 **PASS（幂等；它纠正我「stdout md5 相等当幂等判据」的口径错误）** / `p2d-00` **PASS** / `p2c-00` **PASS** / **`p1o-00` FAIL = NOT_VERIFIED**（3 次全崩于 Neon TLS 断连 + 驱动 `ErrorEvent` 崩溃，0 字节、无 artifact ⇒ 基础设施层）/ **`p2w-00 --assert` FAIL（5 reds: D4/D5/D7/E4/F3）**。四函数指纹全对；registry 17 / 21 表 / **`$` 8400 == 8400**。**★★ 我查出报告级根因分类依据不足（退回重做）**：它把 D4/D5/D7 拆成「4×(a) 漂移 + 1×(b) 疑似缺陷」，但我读 `p2w-00` L498–507 判该拆分不成立 —— 三条 judge 期望式**同形**（皆要求 `ok===false` + `sqlstate==='LD032'`），观测一律 `null`（= **没报错**）⇒ **同一现象**；E4/F3 期望「修前形态复现」，`null` 更可能是**对照路径没跑起来** ⇒ 五条必须**统一根因 pass**（分类细化为 (a) 漂移 /(b) 真缺陷 /(c) 探针口径 /(d) 已登记未落码）。**★ D20 残差铁律（实测）**：夹具窗口 `9903–9906` 的 `account` 持 `$` **4301**（14 行）⇒ **直删必失衡 −4301**，`ledger_entry` append-only 禁删 ⇒ 正解 = **反向分录/管理员旁路 + `total_supply` 重算**（先例 = D11 期 `purge-test-data.ts`）；**★ 机制性发现**：**每跑一次旧套件就新增污染**（本单一次批跑 = `users +108 / ledger_entry +229 / referral +64 / account +14 / currency +5 / commission_policy +3`）⇒ 清理前必须**先在真库停跑旧套件（冻结并登记增量）**。**brief 台账多处不符已登记**（`p2w-zz-tmp-*` 不存在 / 10 非 9 / `p3p:`、`neng17:` 全库 **0 命中** 且 `admin_*` 两表 **0 行** ⇒ **`0017` 零残留**、与我的体检一致 / `9907xx`、`9908xx` 窗口 0 行）。**★ 我自己的 brief 缺陷（我错）**：一边要求跑全套件、一边禁写 `.p{1t,2c,2d,2w}-artifacts/**` —— **互斥**；Kong 正确判为「允许副作用」并登记，**我认此更正**（今后措辞：套件自产 artifacts 允许，仅禁手改/禁删既有文件）。**已派 Unit B**：五红统一根因 pass + `p1o-00` 重跑（含最小复现）+ 连接层加固评估；**Unit C（残差清理）**待 B 回执后派（破坏性 ⇒ 先出「可回滚基线 + 精确清单 + 目标不变量 + 判负设计」交我裁定）。 |
| v0.57 | 2026-09-28 | **§5.54 P3 数据层规范批收口：`data-layer.spec` v0.5 → v0.6 交付 + 我独立验收通过**（`deleg_d68c67d2` / Jing，51 calls / 884s）。v0.6 = **1011 行 / 265649 B / md5 `7b86b8119bea359327b5c9d616ca3505`**；报告 `docs/audit/p3-data-layer-v06.md` **267 行 / `0eac4f39…`**。**★ 快照三向对拍**：`git show 2a1ef07:` == `git show HEAD:` == `docs/versions/data-layer.spec.v0.5.md` == **`ed8e2a1f19c86b39db880533ee1cbae8`** ⇒ 快照确为**改前已发布版的逐字节副本**。**12/12 必改项落地**；**新增两条**：**`DL156`（§6.7）`DL75` 三件套豁免关闭集 = 恰好 7 表**（`market_trade` + `0017` 六表）+ 逐族理由 + **apply-time 反断言义务** + 「豁免不得默认继承」；**`DL157`（§6.6）`currency_status_log` 三条**（`from_status`/`to_status` **不加 CHECK**〔三条依据，含「新增态时状态改了日志写不进」〕/ 强制点 = **路由层、DB 不兜底** / **路由单必须带判负用例**）。`DL71` 加注写死「`value` 容器 CHECK = **收窄·接受并登记**」与「**`DL3` 无 DB 兜底**（容器 CHECK 挡不住 `{"balance":100}`）」；`DL68` 加注 = 归属 P5 + **风险收窄四条读数** + 判据 5 已闭合；`DL76` 补齐三族（`app_config` / `admin_*` / `currency_status_log`）；**§6.1 新增第 6 列「应用状态（v0.6 逐行核准）」**（`0013`–`0017` 已应用 / `0018` 不提案；零散注原文保留）；`DL140` 加注把 **`0006` L75/L103/L115/L127 动态改名铁证**入册（明写「探针**不得**按约束名做实例级 grep」）；`DL155` 归属确认注（**P3 收官 ≠ 已闭合**）。**我的独立核**：`DL` 集合 **1..157 连续**、无缺号、无超界；规则行 **155 → 157**；章节 `## ` **19→19** / `### ` **49→49**；**★ 零丢失集合差** —— 26 删除行 **21 行逐字仍在**，余 **5 行逐条定性 = 版本号/计数随本次同步**（版本头 v0.5→v0.6 且旧段整段包裹保留 / 目录锚点与 §14 标题 `DL1..DL157` / 规则总数 155→157 / 指南行 12→13 条待裁）；**我初用「整行包含式」报 17 处 MISSING，全属假阳性** —— 与我 §5.53 ⑤ 记下的是**同一条口径教训**。**项 10** = `55000` 改前零命中（本册未引用该假命题）；冻结面（`ledger.spec` / 快照 v0.1–v0.4 / `qa` / `src` / `frontend`）零改动、**零库操作**。**★ 纪律点名**：它**主动登记并发会话产物**（Kong 的 `p3q-*` / `.p3q-artifacts/` / `docs/audit/p3-baseline-regression.md`）且**未读、未改、未 `add`**。**待裁**：价差改善（§12.2-13）保持待裁 —— **裁定前不得实现第 7 条分录**。 |
| v0.56 | 2026-09-28 | **§5.53 `0017` 独立质检 verdict = 可用（43/43 判定项 / 15 未验证）⇒ 验收 + 质检双通过；★ P3 数据层收官**（`0018` 按 spec §6.1 = **「不提案」**，无交付物）。报告 `docs/qa/p3-0017-platform-review.md` **265 行 / 24749 B / sha256 `b2db4236ac9d2e8eb6a3c3cb7de57cc1e26198ee8f6c51d1ff7d17773b21eeb4`**；夹具零复用（`9908xx` / `neng17:`）。**前序单 `deleg_090ebe45` 因服务商侧 402（余额耗尽）在第 6 次调用被掐断、未触库** ⇒ 我按盘体检（0017 六表全 **0** 行 / 无夹具 / 零漂移）+ **续单重派**成功（处置已固化进技能）。**我独立复核库终态**与上游逐项一致（registry **17** / 零漂移 / 非 `O` 触发器 **0** / 基表 **21** / `ledger_post_event` **51429 B · `d94dd902…`** 未变 / `cid=1` **8400 == 8400** / `migrate` **17 skipped**）；`log_id` = **`IDENTITY BY DEFAULT`** 闭合；三守门函数现取（oid 131171 / 131172 / 131173）。**★ 口径差当场结算（我错）**：我用「**提及**」口径 `prosrc LIKE '%currency_status_log%'` 得 **1 命中** vs 它「**写**」口径得 `[]` —— 命中项 = **守门函数自身**（131 B、无 INSERT/UPDATE/DELETE）⇒ **它对、我错**；其 D2 成立 ⇒ 我的 §5.52 ⑤（DB 层不强制写日志 ⇒ 路由层硬约束）获**独立证据**。**★ 报告级措辞不准（Neng，更正注攒批）**：其 §7.2 称 `users_evm_fmt` / `users_uid_positive`「不在 `0001`–`0017` 任一迁移文件里」**不准确** —— `0002` 声明的是旧名 `user_*`、**`0006_user_to_users.sql` L75 `RENAME TO users` + L103 `ALTER TABLE public.users RENAME CONSTRAINT %I TO %I` 动态改名** ⇒ **迁移链完整覆盖**（新名由 `format` 运行时拼出、常量不入文本 ⇒ 按新名做实例级 grep 必零命中）。**★ 我自己的疑点当场拦下（未进权威文档）**：类级扫描（49 CHECK / 43 触发器 / 74 函数 / 13 序列 / 1 视图）初判 2 CHECK + 12 序列「MISSING」，一度疑「空库重建会丢 `users` 两条护栏」⇒ 追到 `0006` 后**不成立**（12 序列未命中 = PG 自动命名，口径不适用）；**方法论**：该类扫描对**动态 DDL（`format`/`EXECUTE` 拼名）**会产生**假阳性**，终局判据只能是**空库从零跑再对拍**。**`app_config_value_is_container` 裁定**：`CHECK (jsonb_typeof(value) = ANY (ARRAY['object','array']))` 不在 §6.6 逐列契约内、属**收窄** ⇒ **接受 + 登记**，并写明**它挡不住 `{"balance":100}`** ⇒ **`DL3`「禁存余额」仍靠应用层 + 审查**，非 DB 强制。**三条预登记张力**：Neng 独立判**三条全成立**（与我 §5.52 ⑤ 一致）⇒ 统一进 Jing 规范批（`DL75` 标注「**必建项**」⇒ §6.6 需**显式豁免**这 6 张表，否则后继实现方各执一词）。**新登记 D21 候补**：「库内对象 vs 迁移文件」的保真度**无自动判据** ⇒ 唯一终局判据 = **空库从零跑 `0001`–`0017` 后 `pg_dump --schema-only` 对拍**（可一次结算 `DL155` / 序列 / 约束名 / 触发器 / 视图；与 P1e 遗留「`0007`/`0008` 未在空库从零跑过」同族；**卡点 = 需第二个空库，凭据我不碰 ⇒ 待 Kevin 一句话**）。 |
| v0.55 | 2026-09-28 | **§5.52 P3 平台配置柱 `0017_platform_config.sql` 交付 + 应用 + 我独立验收通过**。`deleg_84e3ce36`（Kong，26 calls / 546s）：迁移 **454 行 / 31026 B / sha256 `0aaba855b1d5eb4c69b6b2c880b225df2053af7353f7c7b290f233006cbb1fcd`**；报告 `docs/audit/p3-platform-0017.md` 202 行 / `7deada9f…`；探针 5 件 + `.p3p-artifacts/` 5 份。**零漂移**；`schema_version=0017` / registry **17 行** / 基表 **15 → 21**（纯增 6 表）；**我复跑 exit 0 / 17 skipped**、`public_base_table_count=21`。**逐列对 §6.6 全绿**：`app_config` **4**（= `DL71` 逐字；无 `privacy` 列、无余额列）、`admin_role` **3**、`admin_permission` **2**、`admin_role_permission` **2 + 复合 PK**、`admin_user_role` **2 + FK→users**、`currency_status_log` **7 + append-only**；**6 个 FK 全无 `ON DELETE CASCADE`**（删被引用角色必失败）；索引恰 6；触发器 **7/7 `O`**、全库非 `O` = 0；**既有四函数指纹全未变**；`cid=1` 8400 == 8400；**冻结面零改动**。**三处受限小项（攒批）落地**：`p3-listing-0015.md` **+11/−0** 顶部新增「更正注（同族三处假命题）」章、`p3-market-0016.md` **+8/−0** 顶部新增「更正 / 登记注（`C1` · `C2`）」章（均原文逐字保留）。**三条预登记张力裁定**：`app_config.updated_by` **不加 FK**（逐列契约优先 + 平台写者 uid 可在 `users` 之外 ⇒ 加 FK 会挡合法平台写入）⇒ 登记给 Jing；`DL75` vs §6.6 逐列契约 = **同 `0016` 缺口 E 口径**（逐列优先 + 反断言 + 登记）；`app_config`/`admin_*` 守卫口径**认可**（授权表删行无状态位替代、被引用角色由 FK 兜住）+ **新登记治理项**：`currency.status` 变更与 `currency_status_log` 写入的一致性 DB 层**无法强制**（已现取的触发器清单显示 `currency` 上无此类触发器）⇒ **路由层硬约束**（与 §5.51 `C2` 同族）。行为 **29/29**、判负自证 **14/14**；它自曝首跑 5 项 FAIL 系**探针缺陷**（`rows.length` vs `rowCount`）。 |
| v0.54 | 2026-09-28 | **§5.51 `0016` 独立质检 verdict = 可用（34 判定项 / 20 未验证）⇒ 验收 + 质检双通过**。报告 `docs/qa/p3-0016-market-review.md` **416 行 / 45999 B / sha256 `04ee045dcfb9adea0cba8db0d8594b4e58786c91922b219e3d5f1ca6fd1d9750`**；夹具零复用（`9906xx` / `cli:neng16-`）；scratch 含 **`pristine-` / `broken-` 字节级副本**。**★ 它独立证实我的定向项**：`TAKER_NOT_A_PARTY` 闸**零用例触达**（上游 `SpareIds.spareId` 硬编码 `'0'`）⇒ 三形态对拍（**FORM-1 真第三方** ⇒ `LD016` / `TAKER_NOT_A_PARTY`；**FORM-2** `'0'` 形态 ⇒ `LD022` / `order_not_found` 与上游 artifact 逐字相符 ⇒ 反证；**FORM-3** 字面量 `'0'` 仅作对照、不作判据）。**★★ 它实测出 `DL68` 缺位的真实影响面**：T1 两买单抢同一卖单 ⇒ 后到者阻塞后被 `market_order_amount_insufficient` 拒、**不超卖**；T2 同币对并发双双成功、**无 `40P01`**、币对级**无串行化**；T3 同键并发**恰一次** ⇒ **风险只在「撮合决策新鲜度」，非资金安全漏洞**（我「登记不阻塞」的裁定获独立证据支持）。**C1**（报告级：`TAKER_NOT_A_PARTY` 覆盖表述）⇒ 更正注**攒批**；**C2**（裸 `UPDATE amount_filled` 与账户 `frozen` 产生 **20** 的对账缺口）⇒ 我按**跨柱一致性**（`0015` 的 `listing.stock` 同类边界已被接受）**定性为护栏边界 + 登记，不重修**；三项处置：**路由层禁裸写可变态**、判据 5 对账须**同时**报「排除裸改单」口径、会话旗标加固留 P5/P6。其他：契约零偏差 / 守恒 **41/41** / 守卫 **12 拒 + 2 对照 + 1 no-op** / **判负自证 7/7** / `migrate` 16 skipped / **无漂移**。**P3 进度：`0013` ✅✅ / `0014` ✅✅ / `0015` ✅✅ / `0016` ✅✅**；剩 `0017_platform_config.sql` 与 `0018`。 |
| v0.53 | 2026-09-28 | **§5.50 P3 交易所柱 `0016_market.sql` 交付 + 应用 + 我独立验收通过**。`deleg_a7078bdb`（Kong，51 calls / 2930s）：迁移 **1201 行 / 70570 B / sha256 `f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df`**；报告 `docs/audit/p3-market-0016.md` 273 行 / `e8169a1c…`；探针 6 件 + `.p3m-artifacts/` 11 份。**应用无漂移**（`registry.checksum == 文件 sha256`）；`schema_version=0016` / registry **16 行** / 基表 **13 → 15**（`market_order` **13 列**、`market_trade` **10 列**）+ 视图 `candle_view` **8 列**；**我复跑 exit 0 / 16 skipped**。**§6.4 逐列对拍全绿**（13/13、10/10、8/8 + CHECK 逐条 + FK：uid→users ×2 / cid→currency ×4 / →market_order ×2 + **无 `ledger_entry` FK** + 索引**恰 3** + 部分唯一索引 **0** + 触发器 **7/7 `O`**、全库非 `O`=0）；`ledger_post_event` **51429 B / `d94dd902…` 未变**；冻结面 `0001`–`0015`/`src`/`frontend` 零改动。**编排函数质量**：**锁序兑现 `DL141`**（业务行主键升序 `FOR UPDATE` 先于 currency/account）；成交走 `op='entries'` **6 条显式分录**（`fee=0` 时 4 条）且 Σ=0 **逐事件实测**；成交行 `base/quote_cid` **从挂单派生**（原疑的不对称**不是洞**）；重放不重写业务行；**apply-time 自检约 200 行**（含函数体内 **DDL token 扫描**〔DL142〕、状态机**正/负自测（终态无出边）**、**多余列反断言**、kind 关闭集、`market_hold` 不存在〔DL90〕）⇒ **`DL48` 兑现度高于前两柱**。**★ 我查出一处「报告名不符实 + 覆盖缺口」（自读码 + 对 artifact，非采信自述）**：K5 用例 `trade_taker_not_a_party` 因 `SpareIds.spareId` **硬编码 `'0'`**（探针 L387）实际打到函数 L692 的 `buy/sell < 1` 族（读数 `LD022`/`field: buy_order_id` 逐字相符）⇒ **`TAKER_NOT_A_PARTY` 闸（L697–701）从未被任何用例触达**（报告级缺陷，**非交付件缺陷**）⇒ 定向补测并入 Neng 质检 + 更正注攒批。**7 条缺口逐条裁定**：`DL68` 撮合串行化**未实现**⇒**登记不阻塞**（归属 P5 路由层必须带；但 `DL68` 判据 5 对账**已实测闭合**：本片夹具在冻 `$` **140 == 140**、base **4 == 4**）；撮合算法**不发明** ✓；工程口径 C/D/E/F/I/J **全认可**；H 认可（R44 同族）；**G 价差改善登记待裁**（`§7.1`+`DL85` 钉死 6 条分录，价差改善需第 7 条「释放多余冻结」）。**待裁/待补**：`DL68` 串行化 / 撮合算法 / 价差改善 / **`DL75` 三件套 vs §6.4 的 `market_trade` 列清单冲突 ⇒ 建议 Jing 在 spec v0.6 澄清一句** / 小时桶 K 线。 |
| v0.52 | 2026-09-28 | **§5.49 `0015` 独立质检 verdict = 可用（19 判定 / 89 断言 / 13 未验证）⇒ 验收 + 质检双通过**。报告 `docs/qa/p3-0015-listing-review.md` **285 行 / 28108 B / sha256 `55f2c6ca578f7966b0da987bb19f30bdac2d56499f7426377f226089fdbf0ad4`…**；夹具零复用（`990401–990404` / `cli:neng15-`）；**它补上真并发不超卖**（库存 1 ⇒ 1 成 / 1 拒；库存 3 + 10 并发 ⇒ 3 成 / 7 拒，`stock` 从未为负）+ 守卫 **11/11 `LD011`** + 边界 **35 项** + 守恒（`cid=1` **8400 == 8400**）+ 静态对拍 **14/14 函数 body 与库里 `prosrc` 逐字节相等**。**★★ 它用「字节级 v2 体」（`git show bf5129b:` 切段 + 同一事务 `ROLLBACK`）证伪了我写进 §5.48 ② 的一条全称命题**：「v2 ⇒ **任何**成功退款都抛 `55000`」**不成立**（机制：**未赋值 `record` 的 `IS NULL` 返回 TRUE**、`55000` 只在**取字段**时抛；v2 下成功退款全程 ok，仅 `extra.currency_status=null`）；**Kong 该句无读数支撑**（其 3 份 cases artifacts 里 `55000` / `v_cur` **零命中**，且它自己 §5 写着首测 5/6、失败项是 K2/K4 而非 K6）⇒ 属**报告级缺陷**、**不属交付件缺陷**；v3 实际价值 = **回填 `extra.currency_status`**（`null` ⇒ `'listed'`），**功能正确 ⇒ 不降级**。**另两条更正（都是我的）**：**F2** diff 口径（实为 **10 增 / 0 删**含 2 空白行；我写的 8 是非空白行且**未标口径**）、**F3** 前提错（**v1 无 blob** ⇒ v1 行为不可考）。**纪律固化三条**：把子代理的「实测」命题写进权威文档前**必须自测** + 核该标注**是否有支撑读数**（artifacts 里关键词 0 命中即无支撑）+ 核**报告内部自相矛盾**。**攒批**：Kong 报告 §2b 更正注**并入 `0016_market.sql` 单**。 |
| v0.51 | 2026-09-28 | **§5.48 P3 商品柱 `0015_listing.sql` 交付完成（v1→v2→v3）＋ 我独立验收通过**。接手单 `deleg_8504fe3f`（Kong，46 calls / 11276s）：**破坏性同版本重放成功**（registry 15→14 行、DROP 两表 + 14 函数 ⇒ 以 v2 `911c7be4…` 干净应用 ⇒ 复绿）；行为用例 **6/6**（**K1 首次购买 GREEN**：buyer 4062→3962 / seller 0→100 / frozen 0 / 两条 `frozen_delta=0` / **无 `LD002`**）；**判负自证**：付款方改回 `frozen_delta −n` ⇒ **RED `LD002`**（余额未动、0 分录）⇒ 逐字节复原 ⇒ sha256 前后相等 ⇒ GREEN。**★ 它又挖出 v2 的真缺陷并就地修成 v3**：`listing_post_event` 的 refund 分支**从不给 `v_cur` 赋值**，而 RETURN 的 `extra` **无条件**求值 `CASE WHEN v_cur IS NULL …` ⇒ **任何成功的退款都在 RETURN 处抛 `55000`**（K6 首次触达即崩）⇒ 与 buy 步骤 ⑧ 对称补齐币种查询 ⇒ **`f856a131…`（991 行 / 55410 B）**。**我批准它的「非破坏性再应用」**（四判据）：① 用**我留的 v2 恢复点 `bf5129b`** 逐行 diff ⇒ **8 增 / 0 删、全落单 hunk `@@ -696,7 +696,17 @@`（函数体内）、零表级 DDL** ⇒ `CREATE OR REPLACE FUNCTION` 全覆盖（**本次确立的判据：delta 若触及任何表级对象，就必须重走破坏性路径**）② 库里 `prosrc` **逐字含 v3 新增的 8/8 行**（未命中 `[]`）、v2 期 md5 `9c5d75d6…` **已不在库**、现盘 `0e187c20…`（17858 B）③ `registry.checksum == 文件 sha256`（现取对拍 `DRIFT=false`）、`migrate` **exit 0 / 15 `skipped`**、`ledger_post_event` **51429 B / `d94dd902…` 未变**（`DL142`）④ **它拒绝强行走破坏性闸是对的**：`DL79` 禁 DELETE ⇒ 夹具清不掉，DROP 两表会让 **append-only 的 `ledger_entry` 分录指向消失的 order 行**且 identity 序被重置 ⇒ 新 order 复用 `order_id=1…` 与既存幂等根键（`biz:listing:buy:1` 等）**撞键** ⇒ 真造孤儿与假冲突。**库终态我独立回读**（run-tagged `zang-0015-verify-20260928093630.json`）：`schema_version=0015` / registry 15 行 / **13 表**（`listing` 13 列 / `listing_order` 14 列）/ 14 函数全 `public.` / **11 触发器全 `O`、全库非 `O` = 0** / 临时残留 **`[]`** / 索引 8 个（`DL63` 未规定部分唯一索引 ⇒ 本柱无，非遗漏）/ **无外部表指向 `listing*` 的外键**；**无孤儿**（18 条 `biz:listing:*` 引用的 order 1/4/7/10/12/13 现存在位）；残差**如实登记不清理**（`listing` 39 行 / `listing_order` 6 行全 `status<>'created'` / `biz:listing:*` 18 条 + `ops:p1e:smoke:*` 14 条）。报告 `docs/audit/p3-listing-0015.md` **185 行 / 19006 B / sha256 `a10d6473be54a17f940c2801f2bc7dbbe08ba26c0e74371e420b5079ed7ac220`**（§0–§8，含全程时间线与 10 条 `NOT_MEASURED`）。**已派 Neng 独立质检**（换夹具与形态，不复用 Kong 命名空间）。 |
| v0.50 | 2026-09-28 | **§5.46 `0014` 独立质检 verdict = 可用（37 判定 / 15 未验证）⇒ 验收 + 质检双通过**。QA 报告 `docs/qa/p3-0014-job-flow-review.md` **223 行 / 29920 B / sha256 `203e3b86…`**；自造夹具零复用（`9902xx` / `cli:neng14-`）；契约对拍全绿；**并发换三种形态**（不复用 Kong 的单一 `57014` 形状）；**★ 推翻我点名要它复现的全称断言**：表 owner `DISABLE TRIGGER` 后 UPDATE **能**触达 `23514` ⇒ 「`23514` 只能由 INSERT 触达」作为无条件断言不成立（**我裁定：报告口径收窄为条件句，非迁移缺陷** —— 与 §5.43 的 `40P01` 反例同族）。**★ 它自报一条真事故并已闭合**：判负自证的**恢复步骤被自身红态夹具挡住**（job 125 两条 `accepted` ⇒ `CREATE UNIQUE INDEX` 报 `23505`）⇒ **部分唯一索引曾缺失 ≤2 分钟（05:59–06:00）**，修复只动本人 `cli:neng14-` 命名的行。**我独立回读（`zang-0014-postqa-20260928060546.json`）**：索引在位 + `indexdef` **逐字 = 基线** / **`jobs_with_multi_accepted = 0`** / 临时残留 `[]` / 非 `O` 触发器 **0** / `job_application` 32 行 / `job_submission` 10 行 / `ledger_post_event` **未变** ⇒ **事故完全闭合**。**裁定三条**：① `0014` 双通过；② Kong 报告两处修正**攒批并入 `0015` 单**（不单开轮，合「一两行文档修订攒批」纪律）；③ U15（registry 的 `0013` 行 `name` 仍 `0013_job_core.sql`）**留痕不动作**（checksum 一致无 drift、按版本号匹配、已应用行不得改）。**技能补**「判负自证必须自带红态修复步骤」（先解本人夹具冲突 → 再重建被撤对象 → 报「定义逐字符 = 基线 + 不变式违规 0」，恢复期真库空窗属必须登记的事故） |
| v0.49 | 2026-09-28 | **§5.45 P3 招工柱第二片 `0014_job_flow.sql` 交付 + 应用 + 我独立验收通过** ⇒ 入库 **`88d5356`**（13 文件 / +6518）。`0014_job_flow.sql` **437 行 / 24484 B / sha256 `a33798…a162d`**（= `schema_migration` 第 14 行 checksum，两侧现取逐字相等）。**我独立核**：`schema_version=0014` / 版本行 **14** / **`public` 表 9→11**；**我亲自复跑 migrate ⇒ exit 0 + 14 skipped**（无 drift）；**`job_application` 7 列逐列 = `DL54`**、**`job_submission` 10 列逐列 = `DL56`**（含「无 `time_updated`」「`reviewed_by`/`reviewed_at` 可空」）、部分唯一索引 `indexdef` **逐字 = `DL55`**、全库非 `O` 触发器 **0**、**`ledger_post_event` 45598 B / md5 `d94dd902…` 未变（DL142 铁证）**、类级断言 `hits=0`、`tsc` exit 0、**6 函数全 `public.` 限定**、未限定读写点仅 `information_schema`（自检块内）、**§E apply-time 自检 8+ 条 `RAISE`**（含 **`DL99` 无分录表不得带账本列**）⇒ `DL48` 兑现；冻结面 `git diff` 全空。Kong 行为 **6/6** + **判负自证 5/5**（`DROP INDEX` ⇒ `dt 1679→168ms` 立即成功 = 必红 → 重建回绿 + `indexdef` 逐字符相等 + 主工作区 sha256 前后全等）。**两条新口径**：① **UPDATE 路径白名单 CHECK 被 `BEFORE UPDATE` 守卫抢先（`LD011`）⇒ `23514` 只能由 INSERT 触达**（两路都测到）；② 护栏**非绝对不可变**（`TRUNCATE`/`DISABLE TRIGGER`/`DROP INDEX` 可旁路 —— 表述为「护栏」而非「数学上排除」）。九条诚实边界我逐条核成立（自雇 DB 层允许不越权加 / 200 重放属路由层 / `reviewed_by` 身份不在 DB 层 / 夹具残差 `1 job+2 application+3 users` 无 `accepted` / 越界纠正已核 `.p3s1-artifacts/` 无 `p3f-*`）。**已派 Neng 独立质检 `0014`**（`deleg_cdda70e1`，verdict 待回）；下一柱 `0015_listing.sql` 待其回执 |
| v0.48 | 2026-09-28 | **§5.44 `data-layer.spec` v0.5：编号重排向全文传播干净**。v0.5 = 236999 B / 1001 行 / md5 `ed8e2a1f19c86b39db880533ee1cbae8`；**v0.4 快照与 `bf22b67` 版 `cmp` exit 0**（我独立复核）；**46 处编号更正 + 47 处留痕注**（`git diff --numstat` 46/44）；报告 238 行含**全量清单表**（`0014`–`0018` 每一处出现：44 更正 / 50 不改逐行给依据）。结构项我核：DL **155 条连续**、占位 0、§14 标题未动、§15 5 行、**§6.3/6.4/6.6 节标题已改新号**、旧编号残留**仅 2 处**（两条变更记录行，属必备「旧⇒新」留痕）⇒ 正文 0 残留。**★ 我自创「零语义位移」对拍（㉔ 进阶：证的不是零丢失而是「只改了编号」）**：抹 `00\d\d` + 全部留痕注后逐行 diff ⇒ 首轮 98 行全是**带反引号的注未被我的窄正则剥净**（又一次先怀疑自己的正则）→ 三轮 10 行 → **逐对取公共前缀比尾部**，`C1`/`C8`/`DL121`/`DL149` 差异**逐字都是留痕注**、§14 说明行只追加 v0.5 声明句、其余为版本头/新快照行/新 §15 行 + `DL117②` 唯一加注 ⇒ **全部可归因、零语义位移**。裁定：节标题内嵌注略显冗长但可追溯 ⇒ **接受**不再开轮；`DL117②` 的「仍未清」**只加注未改判** ⇒ 落实 = `0014` 落地（Kong 在建） |
| v0.47 | 2026-09-28 | **§5.43 spec v0.4 交付 + `0013` 独立质检 verdict「可用」⇒ 双通过**。v0.4 = 229928 B / 999 行 / md5 `7e189b4e…`；**v0.3 快照与 `d10c66a` 版 `cmp` exit 0**（我独立复核）；DL **155 条 `1..155` 连续无缺无重**；§6.1 表重排（`0013` 标已应用 + 实际文件名 + 新增 **`0014_job_flow.sql`** + listing/market/platform_config 顺延 `0015`/`0016`/`0017`）+ `DL52①` 就地标注 + 新增 **`DL155`**（`src/db.ts` 未限定 `public.` 待收紧）。🔴 它**如实自报**的未做项：**§6.3/§6.4/§6.6 三个节标题 + 正文仍是旧编号**（我实测残留 `0014_listing.sql` 3 / `0015_market.sql` 3 / `0016_platform_config.sql` 4）⇒ 与 §6.1 **自相矛盾** ⇒ 已授权 Jing **v0.5** 一次修净（含 `DL20/27/46/47/73/121/149` 的迁移号引用，就地留痕）。**Neng 质检**：`docs/qa/p3-0013-job-review.md` **315 行 / sha256 `4132b885…`**、**38 判定项**（34 PASS / 1 PASS-with-counterexample / 1 PASS(as-designed) / 2 登记项）+ **17 条未验证枚举到边界**；**补上 Kong 未实测的并发面**（两连接同键 publish ⇒ 恰一次 created、无 `23505` 泄漏；并发同 `job_id` settle ⇒ 恰一次）；**★ 死锁反例**：第 3 次构造成功撞出 **`LD027` + `pg_code=40P01`**（`deadlocks` 32→33）⇒ 「不可能死锁」被推翻，但前提取的正是 `DL141③` 禁止的逆序加锁 ⇒ **不判负**；守恒 `Σ(delta+frozen)=0` / `fee+net=gross` / **`cid=1` 收工 `Σ(balance+frozen)=8400 == total_supply`**；判负 `T0` 绿 / `T1`·`T2` 红 / **`T3` 不变红如实登记原因**；迁移 **13/13 skipped**、`0001`–`0012`+`src/`+`scripts/` 零改动、注册表 checksum == 文件 sha256。**两条追认项**：① `DL52①` 张力 **已由 v0.4 落地 ⇒ 互锁闭合**；② `title`/`description` 差异不入重放判据 ⇒ **L2 指纹（`DL96`）责任面，登记给下一接路由单**（与 §5.42⑥ 同单）。**纪律留证**：Neng 自报 314 行 / `e5959292…`，**盘面 315 行 / `4132b885…`**、无活写者 ⇒ 判**自报哈希为末次追加前的旧快照**，**以盘面为准** |
| v0.46 | 2026-09-28 | **§5.42 P3 第一柱（招工）`0013` 交付并验收通过 + 迁移编号一次性重排裁定**。交付 `backend-ts/migrations/0013_job.sql`（817 行 `wc -l` / 44130 B / sha256 `720c89e4…c230`；**原名 `0013_job_core.sql` 系我 brief 的自定名，已改名对齐 spec §6.1 权威名**；checksum = `sha256(sql 内容)` ⇒ 改名零漂移）+ 4 探针 + 10 run-tagged 读数 + 报告 153 行。**我的独立核**：`ledger_post_event` 的 `prosrc` **45598 B / md5 `d94dd902…` 与 `0012` 后逐值一致**（DL142 铁证）；`schema_version=0013`、`public` 表 **9**、`job` **14 列** / 5 索引 / 18 约束 / **5 触发器全 O** / 8 函数；**我亲自重跑 migrate ⇒ exit 0 + 13/13 skipped**（无 drift）；列契约与 `DL50`+§6.2 草图 **14 列全中零自创**；`DL52` 三守卫 + `DL75③` + `DL79` 全在；函数体**零 DDL**、`public.` 全限定、体内未限定引用 **0**；类级断言 `hits=0`/`pass=true`；`0001`–`0012` 与 `src/` 零改动；判负自证 6/6。**四条裁定**：① 迁移编号**一次性重排**（`0013`=job 已应用不动；**`0014_job_flow.sql`**=job_application/job_submission；listing/market/platform_config 顺延为 `0015`/`0016`/`0017`；**此后不得再动**，依 DL47）② `DL52①` 的 `23514` 与 `DL51`/C5 的 409 冲突 ⇒ **实现为准、spec 就地标注 v0.1 旧写法**（实现逐字合 `DL51`）③ `refund` 无专用 txid 列 ⇒ 接受（合 `DL50`）④ `src/db.ts#getSchemaVersion` 未限定 `public.`（违 `DL151` 字面）⇒ 登记给下一接路由单。已派 **Jing v0.4**（§6.1 重排 + DL52① 标注 + `DL155` 登记 + v0.3 快照）+ **Neng 对 `0013` 的独立质检**；`0014` 建表单**押后**（同 DB 禁并发写单） |
| v0.45 | 2026-09-28 | **§5.41 `data-layer.spec` v0.3 验收通过 ⇒ P3 数据层实现门禁解除**。v0.3 = 220752 B / 983 行 / md5 `0a8e228dcbc1dcb517a378ca46dee79c`；**v0.2 快照与入库版 `cmp` 逐字节相同**（⇒ 可独立复核，㉑ 之痛不复现）；audit `p3-data-layer-v03.md` 187 行。八项落位我逐项核过（M1 `ledger_event_keys` 21→24 + `create_key` 统一；M2 仅 2 处留痕；M3 `20–37` + `smallint[]`；M4 `auth.err.*` 与仓内 `ledger.err.${code}` **同构**、前端确无该键 ⇒「需新增键」；M5 新增 `DL154`；R109 0→9；§12.2-11/-12 关闭；O1 路径形唯一权威且 `DL145③` 未动）。结构：DL **154 条 1..154 连续**、占位 0、§15 三行、numstat `57 44`。**④ 零内容丢失 + 我一次自我更正**：我首轮 `grep -c`（数行）比上一轮 `str.count()`（数次）**混口径**，误报 `视图 25→10` 等三处「下降」；同口径复核三处**逐值相同**、且「v0.2 有该词而 v0.3 整行不存在」**= 0 行** ⇒ 零行丢失；**教训：跨版本比计数两侧必须同口径同命令，核零丢失的正解是按行集合差**。⑤ 未连库（M3 转引我 run-tagged 件）/ 未做原文照录（M5 从轻，可选加强）/ `i18n_key` 前端落地待办。⑦ 留证：`d9123482` 自报 verdict「可验收」与 §7「有条件可验收」分歧 ⇒ 以 §7 为准 |
| v0.44 | 2026-09-28 | **§5.40 v0.2 聚焦复核交回：verdict「需修」（M1–M5 全低危，不推翻任何裁定）+ 我裁定 M3/O1 + 派 v0.3 小修**。报告 `docs/qa/data-layer.spec-v02-review.md` 161 行 / 33158 B / 占位 0；**C1–C9 七忠实 / 两「部分」**（C4 缺 `i18n_key` 具体串、C8 的 `ledger_event_keys` 与 §6 列清单自相矛盾）；**编号层忠实、留痕层节录式（20/139 非逐字）**；**判负自证三种变造**：改 1 汉字报出（`lcs` 348→174）、删 `DL66` 报出（153→152 / `missing=[66]`）、同输入复跑逐字节相同 —— 且**它主动指出布尔断言对 1 字改动不敏感、灵敏度来自数值保留度**。被检件 md5 三次一致（零改写）；它诚实登记基线漂移（HEAD 中途到 `91dcc02`，§5.32/§5.33 正文未变、行号仍 706/734）。**M3 我亲裁（只读库、`public.` 限定，run-tagged `m3-arbitrate-20260928045335.json`）**：**19 行** / `min=1`·`max=37` / id 全集 = **`1` + `20..37`** ⇒ **`DL152` 的「夹具 id 2–19」为错，应为 `20–37`**；末行 `policy_id=37` 三值 = 预期组合 ✓ 成立；附赠**类型事实 `weights_bp smallint[]`**（按 `int[]` 比会报 `operator does not exist`）。**O1 我定性**：**以路径形 `GET /api/market/:baseCid/orderbook` 为唯一权威形态**（依据实存路由 + C2 路径参数 camelCase），query 形登记 v0.1 旧写法废弃、不得复活；非 `$` 计价对走路径双段。**已派 Jing v0.3**：M1–M5 + `R109` 交叉引用 + 关闭 `§12.2-11/-12` + O1 落位；**M5 从轻**（只明写「节录」+ 指向已入库的 v0.1 快照，不要求 20 条全文回贴；全文照录列为可选加强项、不阻塞 P3 开工） |
| v0.43 | 2026-09-28 | **§5.39 `dbccd89` 语言壳质检收口 + 两份并行质检报告归档**。我的核验单 `docs/qa/lang-shell-dbccd89-verify.md` **249 行 / sha256 `d8529915…`**：§7 由收尾单补齐（**verdict = 有条件可验收** + **10 条未验证枚举到边界**）；**我独立核**：占位 0、**全部章标题行号与 238 行版逐行号相同**（用行号锚证明其余 232 行未动，补上它自报「未跟踪文件无法用 git diff 证明」的缺口）。**结论**：`dbccd89` 核心缺陷**已确证修好**（§3 四者一致 + 反向 6 例 + Footer 链 / §4 四语全等 + 自愈 7/7 + 无前缀 5/5 / §5 单测 9 文件 61 例集合 ∅ vs ∅ / §6 两轮变异负控 17 红与 3 红 + 逐字节恢复 + 回绿）；**唯一未闭合 = reward/task 终态 marker**，成因是**他方** `/api/prize/all` 500（间歇）⇒ 不属本提交缺陷。**条件**：后端恢复后可选补验（不阻塞）；未验证清单第 **⑤⑥⑦**（≠ HEAD 整体可发布 / build-dist-生产路径未验 / `App.jsx`+`Footer.jsx` 未做变异负控）**属发布前必办** ⇒ 并入 P7。**归档两份他方并行质检报告**（我核后入库）：`lang-shell-regression.md`（**717 行 / 51 KB**，`dbccd89`，**PASS 带条件**，判据表全绿含真指针 hover 语言菜单 8/8，自带 sha256 失效条款，已清 131 MB profile 与 worktree）、`lang-prefix-normalize.md`（**566 行 / 40 KB**，`45c27d8`，**PASS 带条件**，其条件②「路由壳重构后 A/C 段 / NEG-1 / `lang-path-redirect` 14 条必须回归复检」）⇒ **两份互锁闭合**：一份立条件、`dbccd89` 正是那次重构、该条件已由我的核验单兑现（**无需再派回归单**）。**弃用骨架** `45c27d8-lang-path.md`（46 行，承诺读数 `find` 零命中）⇒ 不入库不删除，**待 Kevin 一句话** |
| v0.42 | 2026-09-28 | **§5.38 `deleg_e9dd1808` 真回执 + 两项待裁项裁定**。回执 `completed / 60 calls / 764.31s` 但**自标 TRUNCATED（hit max_iterations）** ⇒ 按「**盘面优先**」逐项核：`DL` 153 / §11.3 AUTH 登记表 / `DL140` / `DL147` / `DL151` / `DL152` / §17.1 / §17.2 / v0.1 快照**全部在盘且已验**；结构宽式 = 一级节 **19**（含目录）/ 二级节 **48**（与自报 `sections 18` 吻合）；`lines_total` 970 = **`wc -l` 口径**（我 971 = NL+1，同 §5.37）⇒ **采信盘面**，TRUNCATED 是自评不是事实。**裁定两项**：① **政策表费率列名以库内实列名 `fee_rate_bp` 为准** —— 铁证＝仓内迁移 `0007` 逐处皆 `fee_rate_bp`（`:11`/`:86`/`:92`/`:161`）、全文无 `fee_bp` ⇒ **`fee_bp` 系简写/笔误、不得进判据**，**`DL152` 写法正确不改**；② **不启用 Neon Auth**（登录 = EVM 钱包签名 + `users.uid`/`evm`），`neon_auth` **9 张表存在但未使用**、新数据层**必须限定 `public.` 完全绕开**（`DL151`），将来启用**须另立规范**。**待办（低优先）**：`R109` 交叉引用现 **0** 处（`R79` 2 处）⇒ 随**下次 spec 修订**补；**当下不改**（文件正被 `d25d3c27` 以 md5 `cfeae444…` 钉住）。另：`§13.2` 探针遇 `@neondatabase/serverless` `fetch failed` **驱动级失败** ⇒ 按「同轮成功者为准」，登记为驱动不稳定。 |
| v0.41 | 2026-09-28 | **§5.37 `deleg_bbe7d6a0` 补交完成回执 ⇒「死单」定性更正为「回执迟到」**。它在 outcome unknown 之后约 **8 分钟**才送达真正的 `status=completed / 47 calls / 501.72s`；**逐项对拍全部一致**：`md5 8ffb5fd5…` / `sha256 cac649e6…`（且 == `git show HEAD:` ⇒ **工作树零增量写**）/ 快照 sha256 `473b87fe…` 1918 行 / `R` 109 条 1..109 连续；`lines_total` 2011 与我的 2010 之差 = **`wc -l` vs NL+1 口径**（末尾带换行）⇒ **`065e28d` 入库的就是它的终版**，「按盘核后直接入库」动作正确。**探针陷阱（本轮第三次同型）**：严格式（HTTP 列必须是单值反引号数字）数 §14.1 得 **32**，宽式（只数编号行）得 **33 行 1..33 连续 / 33 个 distinct 码名** ⇒ 前轮「§14.1 仍 33 码」**成立**、错在探针（有一行 HTTP 列是 `—` 被默默跳过）；旁证自洽（v0.9 备注「仍 33 码」/`33 个自有码 LD001..LD033`/`roundtrip_mismatches 32（共 33 码）`；`LD000`/`LD034` 是**域外输入探针**非码）。**固化纪律：先用宽式数总量、再用严格式取明细；读数异常先怀疑探针。** |
| v0.40 | 2026-09-28 | **§5.36 P3 数据层规范 v0.2 验盘入库 + 聚焦复核立项**。`deleg_e9dd1808` 交回 v0.2：**210787 B / 971 行 / md5 `cfeae444…`**、**`DL` 153 条 1..153 连续无缺号无重复**、`[待回填]` **0**、**§14 索引标题已改 `DL1..DL153`**（派单点名必改项）、§15 有 v0.1+v0.2 两行；C1–C9 落地标记全到位（AUTH 码 10+36 / `listing` 144 + `listing_order` 24 / **雇主审 8** / `create_key` 23 / `视图` 25 + `K 线` 4 / `prize` 45 + `settings/reset` 8 / 两项「不启用」10+6 / 库级事实 `neon_auth` 13 + `public.` 7 / **`v0.1 旧写法` 留痕 26**）。**v0.1 快照**（156970 B / 846 行 / md5 `6f89f444…`）内部核出 **DL1..DL139 连续 + v0.1 版本头** ⇒ **内容确是 v0.1 真身**，**`139+14=153` 口径自洽**；但**字节级保真仍不可独立复核**（v0.1 从未入库、无基线）＝ **纪律㉑ 的既成代价**，**不得表述为「逐字节可验」**。入库 **`4ad0de4`**（2 文件 / +1815）。**P3 实现开工前设门**：派 Neng `deleg_d25d3c27` 做**聚焦复核**（只审「C1–C9 是否被忠实回写」+ DL140 措辞 + 两条库级事实 + 两项「不启用」不得写成已启用 + **编号纪律抽 5 条对拍**「原条文未删改、只就地附加」+ **判负自证**「改一字的 scratch 副本必须报红」；**不做 153 条全文重审、不改被检文件**）⇒ 交付 `docs/qa/data-layer.spec-v02-review.md`。**另**：第 **4** 条 `owner exited` 误报回执（`ea14f60e`）经 `list` 判活 + **sha256 对拍**证伪（其产物早已入库 `4ca6988` 且**入库后零改动**，两侧 sha 一致） |
| v0.39 | 2026-09-28 | **§5.35 P3 Step 1b 验收通过**（接手单 `deleg_ea14f60e` 补完，**取代 §5.34 ③ 的「暂不采信」**；旧节原文保留留痕）。**真判据**：请求路径 **8 文件 / `hits_total=0` / `should_be_zero=0` / `bare_code=0`**、`assertion.pass=true`；全树 **116 文件 / 25 类模式**；非请求路径 **254 命中 / 108 文件**（`scripts/**`+`migrations/**`，允许集）。**尺子灵敏度（上轮唯一缺口）**：正对照在 **scratch 副本**内注入 5 条 DDL（C01/C04/C06/C09/C10）＋ 1 条**注释内 DDL** ⇒ 副本 `should_be_zero=5`、**`assertion.pass=false`（判 FAIL ＝ 尺子响了）**，且注释行**正确入允许集**；注入物**未进被检仓库**（我复核 `src/__p3s1b_probe_injected.ts` 不存在、`find` 零命中）。**不过宽的反证**：未加词界的 `TRUNCATE` 在 `src/commission.ts` 假命中 **8** 条（全是 `chain_truncated` 一族标识符）⇒ 词界版 `(?<![\w.])TRUNCATE\b` **排除** ⇒ **8→0**。**类型检查**：`npx tsc --noEmit`（`src/` 窄口径）**exit 0**；`tsconfig.scripts.json` 口径 **exit 2**（9 错，**预存在残差**，如实登记、未顺手修）。**运行时**：面板单服务路由重载 `seafood-api` ⇒ pid **74889 → 60022**、`/health` 200 + `schema_version 0012`；catalog pre/mid/post **我独立逐项复核 32 字段** ⇒ 除 `label`/`ts`/`pg_stat_database.xact_commit`/`xact_rollback`（**数据库级全局计数器，被外部会话推高 ⇒ 不判负**）外 **28 项全一致**；GET 矩阵两轮 9 条全 500、表数恒 8，且报告**逐字声明**「表数不变对『条件空转的 DDL』是**盲的**…本节只记『未发现回归』，真正的判据是 class_assertion」、`read_no_longer_writes` 标 **NOT_MEASURED**。**两处口径更正（结论不变）**：① 「catalog 前后逐项无差异」应作「**除 4 个元字段外逐项一致**」；② `待回填` 字样 2 次系元叙述，**字面 `[待回填]` 标记 = 0**。入库 `4ca6988`（9 文件 / **+4673**）。**⇒ D19 全链闭合**：两条运行时 DDL 路径（`ensureSupportSchema` / `ensureLegacyTableNames`）均已摘除，并以类级断言证明「请求路径上的运行期 schema 变更语句 = 0」 |
| v0.38 | 2026-09-28 | **§5.34 树中止事件与四处盘面事实**。① **事件**：Hermes 侧 `delegation owner exited` ⇒ `deleg_bbe7d6a0`（Jing `ledger.spec` v0.12）回执 **outcome unknown**；按纪律用 `action='list'` 判活（判活在的**唯一**依据）⇒ **3 单仍活**（`e9dd1808` 536.9s / `d9123482` 473.8s / `ea14f60e` 281.1s），**仅 bbe7d6a0 死**。② **死单产物按盘核后完好** ⇒ 入库 `065e28d`（v0.12 + v0.11 快照）：`R1–R109` **109 条、1..109 连续无缺号**、§14.1 仍 **33 码**、「已拍板（Zang · C1 终审」×9、§19.16 存在、变更记录 12 行（v0.1–v0.12）、快照 `v0.11` 与 HEAD 版 `cmp` **逐字节相同**、`git diff --numstat` **+106/−14**；**我亲核 R109/R79 落位与我 C1 终审五条逐条一致**；留证分歧：子代理自检报 `defs=108`、**我复核 = 109（以我为准）**。③ **Step 1b 真判据已跑出但缺正对照**：`p3s1b-classassert-20260928-123558-repo.json` —— `request_path` 8 文件 / `hits_total=0` / `should_be_zero=0` / `assertion.pass=true`；全树 **116 文件**、`class_count=25`；同一扫描器在**非请求路径**面报 **254 条命中**（CREATE TABLE 13 / ALTER TABLE 56 / `DO $$` 21 / RENAME TO 6 …）⇒ 正则**会响**；**但 `positive_control = None`** ⇒ 按「无正对照的 0 命中与检测器坏了不可分」**PASS 暂不采信**，已 steer 令其补；`docs/audit/p3-step1b-ddl-removal.md` 仍 **13 处 `[待回填]`**（接手单**第二次死在报告**上 ⇒ 再证「先落骨架、逐段落盘」）。④ **stale 项更正**：`docs/qa/p2-0012-replay-order.md`（24749 B / sha256 `352192fe…`）**已在盘且已跟踪** ⇒ 前记录「未落盘」**作废**。⑤ **`data-layer.spec` v0.2 在制**（`e9dd1808` 活着、mtime 12:40）：现 910 行 / **DL 定义 152 条、1..152 连续**，而版本头声明 `DL1…DL153` ⇒ **`DL153` 声明未落**；**§14 索引标题仍 `DL1..DL139`**（TOC 已是 `DL1..DL153`）⇒ 待其收尾，未收尾则我裁定。⑥ **新纪律（㉑）：未入库的新文件，改版前必须先入库** —— `data-layer.spec` v0.1 从未入库即被 v0.2 就地覆盖 ⇒ 快照 `docs/versions/data-layer.spec.v0.1.md` 是**唯一副本、真伪不可独立复核**（同批 `ledger` 因 v0.11 已入库，快照可与 HEAD `cmp` 逐字节校验 ⇒ 两册待遇不同）。 |
| v0.37 | 2026-09-28 | **§5.32 P3 数据层规范 v0.1 终审：C1–C9 九项裁定** + **§5.33 两条库级发现**。Jing 交 `docs/data-layer.spec.md` v0.1（845 行 / 17 章 / **139** 条 DL，编号连续；审计映射 **55/55 表态：采纳 19/修正 28/驳回 8**；55 条路由 **保留 11/重写 27/删除 17**；**kind 扩展请求 0**）。裁定：**C1 采纳编排函数**（并拍板 **R79** 全序含业务行 = 业务行 → currency → account）、**C2 用 `listing`**（`ledger_ref_type_enum` 已应用不可改）+ 定命名风格、**C3 删 prize/settings-reset 且 #54 保留但锁死**、**C4 立 AUTH 域码**、**C5 借 409 码 + 登记债**、**C6 修正本册倾向（改用 AUTH_FORBIDDEN）**、**C7 雇主审（驳回审计）**、**C8 要业务级幂等键**、**C9 用视图**。清盲区 **B10：`$` = `cid=1` 且 `decimals=0`**；**更正 D20 清理范围**（multi-table：users 411 / currency 99 / account 245 / ledger_entry 2145 / referral 216 / commission_policy 19）。§5.33：**`neon_auth.account` 与 `public.account` 跨 schema 同名**（我误报「账本表混 PII」⇒ 撤回，根因是探针缺 schema 限定；新数据层必须限定 `public.`）；**政策表近失**（18 行测试夹具直插生产政策表，末行恰为预期值故未生效，机制不安全）。下一步：Jing 出 `data-layer.spec` v0.2 + `ledger.spec` v0.12 |
| v0.36 | 2026-09-28 | **§5.31 自我更正**：v0.35 的「读不再写」**下得过宽** —— 它只用 `ensureSupportSchema` 一个串的 grep 支撑，漏了同族路径 `ensureLegacyTableNames`（`database.ts:239`，含两处条件 `ALTER TABLE … RENAME`，被 4 个**读**方法调用；因 `gift`/`journey` 不存在而当前空转）。**关键教训**：条件空转的 DDL 不改表数 ⇒ 我「表数前后不变」的验收读数对它是**盲的（假证）**。已派 **Step 1b** 摘除并改以**类级断言**交付（DDL 关键字全集扫描，除迁移执行器外 == 0）。**新增纪律 ⑳：「验收通过」必须用类级断言，不得用实例级 grep** |
| v0.35 | 2026-09-28 | **§5.30 P3 Step 1 验收通过**（读不再写，库回到 == `0012`）：`database.ts` **-302/+0**（唯一改动源文件），摘 `ensureSupportSchema()` 定义 + 孤儿 `supportSchemaPromise` + **实测 34 处**调用（我 brief 写的 12 处取自截断 grep 清单 ⇒ 已更正并立纪律）；我亲核 `numstat`/两串 grep 全 0/`/health` 200+`0012`/pid 57720 存活；真库 **17→8 张**且与 `0012` 目标集逐一等、索引 33→24、`schema_version=0012`、migration 12 行、users 411；**同一批 9 条 GET 两轮后表数恒为 8 ⇒ 懒表未被重建（读不再写成立）**；九条 GET 仍 500 属预期（列名模型，D18 范围）。新登记 `ensureLegacyTableNames`（`database.ts:240` + 4 处调用）待 P3 与 `ensureSupportSchema` 同族判去留 |
| v0.34 | 2026-09-28 | **§5.29 P3 数据层重写立项 + 路由审计结论落位**。审计（55 条）：`ok` 仅 7、`column_missing` 40、`table_missing` 6、`legacy_unmapped` 2，**零路由触达账本内核与返佣** ⇒ 内核在 HTTP 层没接上；真根因是**列名模型**（真列 `uid`/`evm` vs 代码 `"uID"`×57 / `"EVM"`×4）；审计的 GET 触发 `ensureSupportSchema()` 懒 DDL ⇒ **真库 8→17 张表**（9 张全空的表不在任何迁移中）；411 条 users 核实为**我方测试残差**。Kevin 裁定 **D18 = 数据层重写（方案 A）**、**D19 = 先修码再 DROP 回到 == 0012**、**D20 = P3 写真实用户前清残差**。登记他方提交 `45c27d8`（Kevin 自修语言前缀规范化 + 空白页，§5.26 #3，待独立核验）。派单：Kong 摘运行时 DDL + DROP；Jing 出 `docs/data-layer.spec.md` v0.1 |
| v0.33 | 2026-09-27 | **§5.28 P3 立项与拆解**（P1/P2 已闭环）：P3 = 业务模块四柱（招工 / 商品 / 积分交易所 / 邀请返佣用户可见面），管理员不再在后台发 task/reward；**P3 入口先遣＝全量路由审计**（拷来的后端有一批活路由绑在新库不存在的表上，`/api/user/asset/:uID` 实测 500 ⇒ 不知哪些路由是死的就会在死路由上叠新功能）；交付 `docs/audit/p3-route-inventory.{md,json}` 并要求内置判负能力（独立重新发现已知缺口）。**P3 门槛项建议**：把「修仓库自带 e2e」列为 P3 前置（它现在会静默打到 jinli 站点上 ⇒ 不修则每个模块都缺回归能力）+ 双重前缀 URL 随 P3 第一单一起修。**§5.26 四项处置建议**：#2/#3 纳入 P3 前置；#1 需 Kevin 给品牌成句文案口径；**#4 标题闪烁裁定不做**（内联映射会破坏 §5.24 的单一真源，正解是部署层按语言下发 HTML） |
| v0.32 | 2026-09-27 | **规格与质检报告双收口**。① `docs/ledger.spec.md` 由 **v0.10 → v0.11**（md5 `115b6e8dc36e0f6e2e29ce855cc014d5` / sha256 `473b87fe…` / 1918 行 / 417398 字节；11 处改动 +85/−5；快照 `docs/versions/ledger.spec.v0.10.md` sha256 `1ea17c20…`）：R51 新增「只读重放前置闸是重放**快路径**、不取代 `ON CONFLICT` 探针并发权威性」子句、§7.1 阶段序句更正（行号 **454 → 466**）、R52① 标明重放保证项 + `extra` 非契约、新增 §19.15 落位 `0012` 实现证据与 §19.15.B 两条已知盲区；旧址一律以「v0.10 旧写法」留痕同处，R51/R52 条文一字未改。② `docs/qa/p2-0012-replay-order.md`（sha256 `352192fe…`）落盘：verdict **可验收 PASS**（I1–I10 全 PASS）。**⚠️ 我自己的错前提留痕**：派单写「从 v0.9 推到 v0.10」，而文件当时**已在 v0.10**（`f78714f` §19.14 入册）、`docs/versions/ledger.spec.v0.9.md` 已存在 ⇒ **Jing 未按字面执行**，改 v0.11 + 快照真实改前版 v0.10，并显式回报询问是否需覆盖 v0.9 快照。**裁定：Jing 的做法正确** —— 「版本号只增不复用、已发布快照不得覆盖」**优先于派单字面**；**引用 spec 一律以内容/规则号为准，不得把行号当稳定标识**（本轮行号已漂移 454→466、R51 405→406、R52 406→407）。**连带登记（未修）**：`docs/ledger.spec.md` 第 420 行（§6.2 R49 文本）含**真实** NUL 与 `0x1F` 控制字符各 1 处 —— 经核**同样存在于 v0.10 快照**（非本版引入），但纯文本文件含 NUL 会咬工具链（`grep`/diff 可能判为二进制），列为待清 |
| v0.31 | 2026-09-27 | **§5.27 `0012` 独立质检结论**：**验收通过**（自造夹具独立重取；盘==库三向指纹一致、migrate 12/12 skipped、闸位置与只读性成立、头号/反向/真并发全绿、§C 七个变体全部真 RAISE 且 16 次运行零 22P02、两条交付方断言均证实为真、cid=1 与平台账户未被动、0001–0012 未改）；质检给出**字节级修前/修后 A/B**（删两处插入 ⇒ 逐字等于 `0005` 函数体 ⇒ `LD002` 复现；`0012` 下 ⇒ 200 重放）⇒ 补上「新探针无 before 相位」的缺口。裁定**不为 §C 两条已知盲区开 `0013`**（行为探针未受保护致诊断丢失 + 结构断言为子串匹配致 V5 类逃逸）：契约保证是行为、自检是纵深防御、为改善报错信息抬版本无契约价值，留待下次真正 `CREATE OR REPLACE` 时顺带包住 |
| v0.30 | 2026-09-27 | **§5.26 登记四项待立项**（标题单质检挖出、与标题需求无关）：jinli 品牌残留（`/login` 仍显 `JINLI CLUB` 等 10 处）/ 仓库自带 e2e 从未跑过且 `reuseExistingServer` 会静默打在 **jinli** 站点上（端口 5777 vs 5787 + chromium rev 1208 缺失 + 规格仍断言旧标题）/ `Header.changeLanguage` 双重前缀 URL（真 bug，运行时可复现）/ 非中文路由 45–65ms zh 标题闪烁。**Kevin `clarify` 超时未选 ⇒ 按既定口径不阻塞、不擅自扩面，一句话即可开单**。同轮：标题单验收通过并入 `86cb067`（我亲跑构建 exit 0、判负后逐字节复原、面板服务完好） |
| v0.29 | 2026-09-27 | **§5.25 幂等前置闸收口** + 冻结 **D17**：`0012` 已应用（checksum `2a64483f…` = 盘上 sha256）、后态位置断言成立（闸在 C4 加锁后 / C5 余额闸前，`ON CONFLICT` 探针仍在闸之后）；六项矩阵 after 头号用例已修（200 重放 + 同 txid + 零写入）、真并发 13/13 恰一次落账、判负自证三步齐全；裁定「闸是重放**快路径**，不取代 `ON CONFLICT` 的并发权威性」+「`extra` 非契约字段（全册 0 命中，早于 0012，不开 0013）」；挖出 `0012` 干跑失败的**两层根因**（少一个引号致引号奇偶翻转 ⇒ 42601；数组与裸字面量的拼接被解析成 `array_cat` ⇒ 22P02 掩盖真错）并用对照实验**判定层归属**（migrate 与探针同法、同错同位 ⇒ 缺陷在文件本身） |
| v0.28 | 2026-09-27 | **§5.24 站点标题口径**（写死 + 四语 + 后台不可改）+ 冻结 **D16**：只读侦察发现 i18n 已恰好四语、`siteTitle` 已是现成键，但**无任何代码设 `document.title`**（标签页永远卡在 jinli 静态 title），且后台 `siteName` 是**死旋钮**；用户逐项点选 ⇒ 四语完整句只给标签页 + 头部改用短版 `siteBrand` + 不加 og meta；`en`/`vn` 短品牌只剩 `Seafood`（一句话可改）；连带发现 jinli 品牌残留多处，单独立项 |
| v0.27 | 2026-09-27 | **§5.23 反向映射闭合验收**（`0009`，修前 32/33 未归类 ⇒ 修后四项全 0；我亲跑 `--assert` exit 0 + 抽查 8 码）；**更正我两个错陈述**（「缺三码」实为**全 33 码未归类**——选择性抽查必然偏；「TS 缺三码」实为 TS 本就 33/33，缺口只在 DB）；裁定 bucket 扩展三条接受、**`200` 改判为良性结果不参与校验**；裁定反转探针不做；清理派单表一处编号撞车 |
| v0.26 | 2026-09-27 | **§5.22 `0007`/`0008` 验收**（我亲核六处：2-环判负/自指/种子/触发器/`-1` 白名单/schema_version 全过）+ **新缺陷：错误码反向映射缺 LD031–LD033**（正向 33、反向 30；因 `0007` 第一次真正抛 `LD032` 才暴露）⇒ 裁定修 + **新增 33 码全量往返闭合测试**（P1 只自证了单向，从未自证双向）|
| v0.25 | 2026-09-27 | 两册 spec 入库（`ledger.spec` v0.8 / `commission.spec` v0.2，四快照 md5 全对齐）+ **§5.21 裁定 5 项**：**#1 卡实现 ⇒ 选 (a) 接受 P2 = `0007`+`0008`**（保统一费率、避免逆向激励、避免钱沉淀在只进不出的 `-2`；扩白名单后强制重跑 P1 全量回归 + 负向断言）；#2 接受 `w_1>0`；**#3 断言必须落 500**（改抛既有对账码，禁裸抛 23514、禁新增码）；#4/#5 列为验收必做与上线义务 |
| v0.24 | 2026-09-27 | **§5.20 裁定 P2 spec 交回的 16 项**（#1 防环机制被推翻 ⇒ 我 §5.19 的「构造保证」就地划掉并立纪律「写不可能必须举反例」；#2 R45⟷D13 判 D13 胜；#11 无邀请人手续费入 −1 不入 −2 避沉淀；#14 计算不下沉但 Σ 必须 DB 侧强制）。派 R3-P2c 收口两册 spec |
| v0.23 | 2026-09-27 | **P1 收口 + P2 立项**：§5.18 append-only 真实边界（TRUNCATE 无保护 + 管理员旁路）；§5.19 P2 拆解（十级返佣）+ 冻结 **D12–D15**（clarify 超时 ⇒ 按推荐项推进，各标「一句话可改」）；派 R3-P2a 出 P2 spec |
| v0.22 | 2026-09-27 | **§5.18 `append-only` 的真实边界**（我实测）：`tgtype=27` 无条件拦 DELETE/UPDATE（实测 `P0001`），**但 `TRUNCATE` 零触发器保护 + `purge-test-data.ts` 走 DISABLE/ENABLE 管理员旁路** ⇒ 「append-only 是防应用层事故的护栏，不是防管理员的绝对约束」，此前过强的陈述以此为准；TRUNCATE 缺口登记进 P2/P3 边界小迁移；spec v0.7 落位（1491→1597 行，§14.1 仍 33 码 / §17 仍 R1–R108）|
| v0.21 | 2026-09-27 | **§5.17 读路径逃逸类闭合（P1 错误闭环真正闭上）**：修前 33 格逃逸 / `expectation_mismatches` 154 ⇒ 修后六判据全绿；确立「**按类修**」的功效论据（发现 1 格 → 扫出 33 格、6 入口点）；三条裁定 R-1（JSON number 是合法形状⇒404）/ R-2（调用方只准按 code 分支）/ R-3（合并为「错误码命名整理」，排 P2/P3 边界）|
| v0.20 | 2026-09-27 | **§5.16 重新裁定 `cid<=0`⇒404** —— 我裁错边界值 + 把「DB 侧已是 400」这个推断当事实转抄，导致实现方改错产品代码（回退中）；立纪律「裁定必须枚举边界值」「派单引用现有行为必须现场实测或显式标为待核实」（本轮第 4 条我的转抄/前提错误）|
| v0.19 | 2026-09-27 | **spec v0.4 落位**（P1e/P1i/F3 契约 + 改名 + 两条诚实口径；快照 v0.3 逐字节相同）；新增 **§5.15 —— Jing 顶回的 7 条不一致逐条裁定**（其中 **3 条成因在我**：转抄过期行数、错前提、**亲跑覆盖了实施方取证文件**）；确立「验证运行不得覆盖原始取证」纪律；派 R3-P1m 收口 F-6 |
| v0.18 | 2026-09-27 | **D11 执行完毕**（§5.14）：`user`→`users`（`0006`）+ 测试数据一次性清零 + `cid=1` 自洽恢复（`$` 流通量归 0）；**§5.7 硬1 作废、新增硬1′**（名称改了、关键字的陷阱行为也不消失 ⇒ 纪律改为「一律写 `users`」）；顺带挖出两个既有缺陷（`/api/user/asset` 因缺 `asset` 表报 500；`ensureSupportSchema()` legacy 列名失配）；派 Jing 同步 spec v0.4 |
| v0.17 | 2026-09-27 | **P1e 全量验收通过**（§5.13）：F3 五路读数由 Zang 亲跑复核；**D-03 关闭**；留档两条诚实口径（预算只钳语句级、端到端 11283ms；`57014` 绕过 plpgsql 处理器 ⇒ `LD026` 唯一来源为预算助手）；**P1 账本内核闭环**；派 R3-P1g（`0006` 改名 + 测试数据清零） |
| v0.16 | 2026-09-27 | **撒谎态消除**（0005 重应用、checksum 5/5 对齐、/health=0005、幂等成立）；提交 `8677e65`；新增 **§5.12 P1e 验收裁定：有条件通过**（D-01/02/04/07/08/09 关闭且均经 Zang 亲跑或同一探针修前修后对照；唯一未闭合 = D-03 待 F3 实测）；派 R3-P1i-d |
| v0.15 | 2026-09-27 | **R3-P1i-b 截断但成果实质**（TS 四处落笔 / F1 14-14 / F2 三硬判据归零 / M31·M43 修完 / 冒烟 29-0+11-0）；新增 **§5.11** 记录**数据库撒谎态**（0005 首版已装但注册表行被删）与 **0005 自身自相矛盾**（23514 bucket）；**裁定 C**（bucket↔status 冻结 ⇒「500 只出自 defect 桶」可机读判据）、**裁定 D**（`p1i-forget-migration.ts` 保留但加 force 闸 + 头注释）；派恢复单 R3-P1i-c 与 F3 专项单 R3-P1i-d |
| v0.14 | 2026-09-27 | **R3-P1i 半成品截断**（已核实：0005 落盘未应用 / TS 侧未动 / 修后对照未跑）⇒ 派收口单 R3-P1i-b；新增 **§5.10**：新发现 D-07（超 R66 上限静默接受）/ D-08（`'1e5'` 漏闸）/ D-09（`#` 键 7 种 op 全被接受）+ **裁定 A**（形状非法=400，规范改）/ **裁定 B**（删 statement_timeout 假声明，改函数内预算钳位；pooler 拒 `options` ⇒ 08P01） |
| v0.13 | 2026-09-27 | **P1e 质检不通过**：新增 **§5.8 缺陷台账**（D-01 高位幂等派生键碰撞 / D-02 未映射 SQLSTATE / D-03 超时投影死代码+statement_timeout 空转 / D-04 基础设施错误误吞）——**三条我逐条亲跑复现**；新增 **§5.9** 裁定 cid=1 基线不平属造数遗留并入清零验收。裁定「**D10 架构方向正确、缺陷在实现层**」；派 R3-P1i 修复（0005）+ R3-P1j 报告落盘；D11 改名重排为 0006 |
| v0.12 | 2026-09-27 | **P1e/P1f 交付并亲跑核验**（`5aa8bbe`）：记账压进 DB 函数，单笔 transfer 4181→**171 ms**；新增 **§5.5.1** 记录架构级新数字与「P1b 并发上限结论作废、须重测」；派 R3-P1h 独立质检（含幂等派生键碰撞与未映射 SQLSTATE 两个高危面）；D11 改名仍排在质检之后 |
| v0.11 | 2026-09-27 | **D11 冻结**：Kevin 拍板 **`user` 表改名 `users`**（铲除保留字静默错答案陷阱，趁 0 行低成本）；R3-P1g 排入队列（等 P1e 交回）。§5.7 硬1 的「必须加引号」纪律保留但降级为「改名前的过渡期纪律」 |
