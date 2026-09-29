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
