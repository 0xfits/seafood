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
| R3-P1b（账本质检） | Neng | 独立复验：**并发总额守恒**（并发而非串行）、幂等重放、对账脚本判负能力 | ⏳ 排队（等 P1a） |

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
