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
