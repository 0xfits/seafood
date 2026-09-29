# P4-B3a · 币种面资金编排（C1 建单位 / C2 上市收保证金）交付与资金不变量审计

> **单元**：P4-B3a（批 3 第一片 · **第一批真资金动作**）· **实现方（Kong）** · 2026-09-30 CST
> **唯一权威**：`docs/route-layer.spec.md` **v0.2**（668 行 / sha256 `2b9cb2f1…a9edca2`）§1.1 / §4 / §4.5 / §7-3 / §3 / §2
> **run-tag**：**主** = `b3a-20260930T013647`（run2，代码定稿后全量复跑）· **次** = `b3a-20260930T013122`（run1，首轮全矩阵通过）
> **产物绝对路径**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3a-20260930T013647/{snapshot-pre.json,snapshot-post.json,e2e.json}`（+ run1 同构三件）
> **状态**：✅ 交付完成（22/22 端到端通过 · 资金不变量对拍通过 · `tsc --noEmit` = 0）

## §0 摘要（读数一览，逐条可 grep）

| 项 | 读数 | 口径 / 来源 |
|---|---|---|
| 注册点 | **51 → 53** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts` = **53**（新增 2：`POST /api/currency`、`POST /api/currency/:cid/list`） |
| `tsc --noEmit` | **0**（成功） | 全量 `tsc -p tsconfig.json` 口径（`./node_modules/.bin/tsc --noEmit`） |
| 端到端用例 | **22 / 22 PASS**（run1、run2 各一遍，两轮均 22/22） | `e2e.json` 的 `summary.pass/total` + 逐例 `[PASS]` 行 |
| Σ(balance+frozen)（全账户含 `0/-1/-2/-3`） | run2：**1,000,000 → 2,000,000**（Δ = **+1,000,000** = 唯一 fixture 铸币票面） | `snapshot-{pre,post}.json` 的 `sigma_all`（SQL）与 `account_dump_sigma_js`（JS 复算，两口径一致） |
| `ledger_entry` 增量 | run2：**9 → 18**（Δ = **9** = 1 铸币 + 2（C1）+ 4（C2）+ 2（C1 建 D 单位）） | `snapshot-*` 的 `count_ledger_entry` + `e2e.json` 逐例 `delta_entries` |
| 重放 / 冲突 / 余额不足 的增量 | **全 0**（不产生第二条分录、不留业务行） | run2：`C1_replay.delta_entries=0`、`C1_conflict.delta_entries=0`、`C1_insufficient.symbol_c_created=false`、`C2_replay.delta_entries=0`、`C2_insufficient.unit_D_row.status='draft'` |
| `23514`（非负 CHECK）触发 | **0 次**（全部余额不足由 DB 前置 `R80` 判定 ⇒ `LD001`/409） | 22 例中余额不足 2 例均回 `409 LEDGER_INSUFFICIENT_BALANCE`，无 500 面 |
| 冻结点`-1`/`-3` 白名单 / 迁移 / `ledger.ts` | **未改**（sha256 前后一致，见 §6.1） | — |

## §1 本片端点与事件清单（**先落盘、后动代码**；本表在首次改码前已写入本文件）

> 抽自 spec §1.1（`:147-148`）+ §4.2 C1/C2（`:406-407`）+ §4.3（`:427`）+ §7-3（`:598`）+ data-layer.spec v0.6 §8.3（`:578-579`，仅作幂等键形参考）。
> 「资金四栏」= 谁出钱 / 谁收钱 / 平台费来源 / 佣金来源与分配（§4.3 强制四栏）。

| # | 端点（本片注册） | 编排入口（本片实现） | kind（§4.1 关闭集内） | 幂等键 | 资金四栏 | 期望码（本片实测落点） | 依据 |
|---|---|---|---|---|---|---|---|
| **C1** | `POST /api/currency` | spec 逐字「**未实现（无编排函数）**」⇒ 本片以**单语句 CTE**（一条 `SELECT` = 隐式事务）实现：`src/currency-service.ts` + `DatabaseService.createCurrencyWithFee` | `currency_create_fee` **×2**（owner `balance −fee` / `uid=-1` `balance +fee`） | 调用方 `create_key`/`idempotency_key`/`Idempotency-Key`（`cli:`/`biz:`/`ops:`/`cm:`）；**缺省 ⇒ 确定性派生** `biz:currency:create:<symbol>` | **谁出钱** = 建单位者（`owner_uid` 的 `$` 可用余额 `−fee`）；**谁收钱** = 平台收入 `-1`；**平台费来源** = 建单位费（消耗性）；**佣金** = 无 | `401 AUTH_UNAUTHORIZED`；`403 AUTH_FORBIDDEN`(+`ACTOR_NOT_ALLOWED`)；`400 LD005`/`LD016`/`LD017`；`409 LD001`/`LD003`/`LD033` | `§1.1:147`、`§4.2 C1:406`、`§4.3:427`、`§7-3` |
| **C2** | `POST /api/currency/:cid/list` | 同上（spec「**未实现（无编排函数）**」）⇒ `listCurrencyWithDeposit` | **上市费** `currency_create_fee` **×2**（owner `−fee` / `-1` `+fee`）+ **保证金** `listing_deposit` **×2**（`HOLD_KINDS`：owner `balance −dep` / owner `frozen +dep`） | 同上；缺省 ⇒ `biz:currency:list:<cid>` | **谁出钱** = 该币 `owner_uid`（可用余额）；**谁收钱** = 上市费入 `-1`、保证金入**自己的冻结**（**担保物、非收入、不进 `-1` credit 白名单**）；**平台费来源** = 上市费；**佣金** = 无 | `401`；`403 AUTH_FORBIDDEN`(+`ACTOR_NOT_ALLOWED`)；`400 LD005`/`LD017`；`404 LD007`；`409 LD001`/`LD003`/`LD011` | `§1.1:148`、`§4.2 C2:407`、`§4.3:427`、`§7-3:598`（**已裁**） |
| **C3 退市 / 罚没** | **（无端点）** | **未实现**（禁自创路径） | （设计：`hold_release`×2 退回 / `hold_forfeit`→`-3`） | spec 未给 | — | — | `§7-3` 提及方向，但 **§4.2 无事件行、§1.1 无端点、无幂等键、无失败/回滚语义** ⇒ 按派单硬口径 #5 **不实现**，登记 §7-N1 / 提问 §7-Q1 |

**§7-3 逐字口径（本片实现依据，已由 Zang §5.73 批准）**：「上市费 = `currency_create_fee` → `-1`（消耗）；保证金 = `listing_deposit`（`HOLD_KINDS` 内）**纯冻结、可退**（`hold_release`）；违约罚没 = `hold_forfeit` → `-3`。**禁止新增 kind / 禁改白名单 / 不开 `0018`**」。⇒ 本片**未**新增 kind、**未**改任何白名单、**未**改迁移。

## §2 与 data-layer.spec v0.6 的**登记冲突**（本片不自行裁，交 Zang）

| # | 冲突 | data-layer v0.6 逐字 | route-layer v0.2 §7-3（已批准） | 本片取法 |
|---|---|---|---|---|
| **T1** | 上市费 kind | `DL67`（`:454`）「上市事务的账务 = `currency_create_fee`**（若适用）** + **`listing_fee`** + `listing_deposit`（消耗、入 `uid=−1`，R31）」；§8.3:505「`listing_fee` ×2 + `listing_deposit` ×2」 | 「上市费 = `currency_create_fee` → `-1`」 | **取 §7-3**（派单硬口径 #1）⇒ `listing_fee` 本片**未使用**；data-layer 需回写（§7-Q2） |
| **T2** | 保证金语义 | `DL88`（`:530`）「**上市即消耗**（`balance → uid −1`），**不可退、无罚没、无退还 kind**（R31/v0.3）⇒ 交易所路由**不得**提供『退还保证金』按钮或接口」 | 「`listing_deposit` = **纯冻结、可退**」 | **取 §7-3**（派单硬口径 #1）⇒ 与 `DL88`/`R31` **正面冲突**，需 Zang 终审（§7-Q2） |
| **T3** | 幂等键形态 | `DL101`（`:594`）「创建类请求允许『先建业务行（`cli:` 键）→ 同请求内落一个账务事件（`biz:` 键派生自新 id）』」；§8.3:578-579 给 `biz:currency:create:<symbol>` / `biz:currency:list:<cid>` | §4.2 C1/C2 该列 = **「待定」** | 两法并用：调用方键优先、缺省 = 确定性派生键（§3.3）；请确认（§7-Q3） |
| **T4** | 非 owner 的码 | — | §4.2 C2「期望码」列写 `409 LD011/LD014 + not_currency_owner`（`LD014` = `LEDGER_UNAUTHORIZED_MINT`，403） | §3.2（`:322`）**明文**：账本层权限码「**新面业务路由不得返回它们**」+ §6.2 附表（业务角色守卫 ⇒ `403 AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`）⇒ **取 §3.2/§6.2**，详情里附 `condition:'not_currency_owner'`；请确认（§7-Q5） |

## §3 实现

### 3.1 改动清单（**最小改动**；行数 = `wc -l` 现取）

| 文件 | 性质 | 规模 | 内容 |
|---|---|---|---|
| `backend-ts/src/currency-service.ts` | **新建** | 389 行 | C1/C2 两个 verb：入参形状闸 → 幂等键解析（§4.5）→ 单语句编排调用 → 错误映射（`ledgerErrorFromDbError`/`normalizeLedgerError`，**不新增错误码**）→ 重放/冲突/状态冲突判定 |
| `backend-ts/src/database.ts` | 改（**+170 行**，无删改） | 3082 → 3252 行 | 新增 `createCurrencyWithFee`（C1）与 `listCurrencyWithDeposit`（C2）——各**一条** `SELECT`（CTE） |
| `backend-ts/src/index.ts` | 改（**+48 行**：+2 import 行、+46 路由行） | 1162 → 1210 行 | 注册 `POST /api/currency`、`POST /api/currency/:cid/list`（`requireActor` 前置；基础设施异常走既有 §14 分类器） |
| `backend-ts/scripts/p4z-b3a-01-snapshot.ts` | **新建** | 89 行 | 台账快照（**只读**）：Σ / 计数 / **逐账户 dump** / `ledger_entry` 全行 / `currency` 全行；`<outDir> <pre\|post>` |
| `backend-ts/scripts/p4z-b3a-02-e2e.ts` | **新建** | 302 行 | 端到端 22 例矩阵 + fixture 铸币 + 每例 `Δledger_entry` / `ΔΣ` 对拍；**不落 token 本体** |
| `backend-ts/docs/audit/…` → `docs/audit/p4-b3a-currency-funds.md` | 本报告 | — | 骨架先行（§1 在首次改码前落盘） |

**未改（硬边界自证）**：`src/ledger.ts` / `src/ledger-errors.ts` / `src/commission.ts` / `migrations/**` / `.env.local` / `frontend/**` / `docs/route-layer.spec.md` / 其它既有 `scripts/*` 与 `.p4-artifacts/*`（sha256 见 §6.1）。

### 3.2 编排形状：**单语句 CTE = 一个隐式事务**（为何不是 DB 编排函数）

- spec §4.0 **R2** 要求「业务行 + 分录必须同一事务」，其**唯一被 spec 授权的形态**是**业务编排函数**（`job_post_event` 等，由迁移创建）；但本片**迁移冻结**（§7-3 逐字「不开 `0018`」）且 `src/ledger.ts` 冻结 ⇒ 不能新增 `currency_post_event`。
- 等价实现：把「锁/写业务行 → 调 `ledger_post_event` → 回写引用列」压进**一条 `SELECT`**（PostgreSQL 单语句 = 自带隐式事务；`@neondatabase/serverless` 的 `sql\`\`` 一次往返一条语句）。**原子性由实测判负用例坐实**（非文档推断，见自曝 §6.3-⑤）：
  - C1-T11（余额不足）：`currency` 插入被**整条语句回滚** ⇒ `symbol_c_created = false`（无孤儿行）。
  - C2-T22（保证金不足）：`currency.status` **未变**（仍 `draft`）、`currency_status_log` **未增行**、分录 **0 条** ⇒ 同时满足 `DL157③` 的判负要求（不存在「状态已改而审计缺失」的中间态）。
- **加锁全序**（`DL141`）：C2 的 CTE 第一步即 `SELECT … FROM public.currency WHERE cid=$1 FOR UPDATE`（**业务行先锁**），随后 `ledger_post_event` 内部按 `uid` 升序锁 `account` ⇒ 全序 = 业务行 →（`currency` 只读/已在锁内）→ `account` ✅。
- CTE 门控（`ev` 的 `FROM ins` / `FROM apply`）：**只有真发生业务写时才调账本** ⇒ 重放 / 符号占用 / 状态非法 / 越权 **一律零分录** ✅（实测 Δentries 全 0）。
- C2 的 `slog`（`currency_status_log` 插入）与 `apply`（`currency` 更新）在**同一条语句**内 ⇒ `DL73`/`DL157②`「改 `currency.status` 必须同事务写审计」在**结构上**成立（DB 层无兜底，本片落在同一语句 = 比「同事务两次提交」更强）。
- `ref_type='currency'`、`ref_id` = 目标 `cid`（两条事件均回写引用列，满足 C1 硬约束 ③）。

### 3.3 幂等与重放语义（逐字对齐 §4.0 R6 / §4.5）

- **键**：调用方给 `create_key` / `idempotency_key` / `Idempotency-Key` 头 ⇒ 按 §4.5 校验（顺序 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`，前缀只允许 `biz:`/`cm:`/`cli:`/`ops:`）后**原样用作账本事件幂等键**；未给 ⇒ **确定性派生**（`biz:currency:create:<symbol>` / `biz:currency:list:<cid>`）⇒ 同一请求重试必得同键 ⇒ 重放。
- **指纹**：`request_fingerprint = sha256(规范化请求体)`（C1：`create|symbol|name|ownerUid|decimals|fee`；C2：`list|cid|actor|fee|deposit`），随事件第 1 条分录落 `ledger_entry.request_fingerprint`。
- **语义**（实测）：
  - **同键同载荷 ⇒ 200 重放**：`C1-T08`（`idempotent_replay=true`、Δentries=0、`currency` 行数不变）；`C2-T19`（Δentries=0、Δstatus_log=0）。
  - **同键异载荷 ⇒ 409**：`C1-T09` `LEDGER_IDEMPOTENCY_CONFLICT`（且目标符号 B **未被创建** ⇒ 无「半个事件」）。
  - **异键同符号 ⇒ 409**：`C1-T10` `LEDGER_CURRENCY_SYMBOL_TAKEN`（`LD033`；不落裸 `23505` ↓）。
- **不得让裸 `23505` 变 400**（§3.3-4）：`currency_symbol_uniq` 由 `ON CONFLICT (symbol) DO NOTHING` 在应用层接住 ⇒ 实测 409（T10），**未**出现 400 `LEDGER_AMOUNT_INVALID` 面；账本键同冲突由 `ledger_post_event` 内部按 `ledger_idem_uniq` 分流为 `LD003`/`LD006`（T09/T08）。
- **错误码封闭性**：全部响应码 ∈ 33 码封闭集 ∪ `AUTH_*`（§3.3-7），**零自创码**（实测 22 例：`LEDGER_*` 8 种 + 2 种 `AUTH_*`）。

## §4 端到端实测（真 token = `backend-ts/.env.local` 的 `SECRET_KEY` 签名；真库）

**口径**：`POST` + `Authorization: Bearer <token>`；token 由生产签名器 `src/auth.createSessionToken` 铸（只落 sha256 前 12 位，**产物不落本体**，§6.3-①）。run2 全 22 例：

| # | 用例 | 期望 | 实测 | `error.code` / `details` 要点 |
|---|---|---|---|---|
| C1-T01 | 建单位 · **无 token** | 401 | **401** ✅ | `AUTH_UNAUTHORIZED`（`details={}`） |
| C1-T02 | 建单位 · 键前缀非法 | 400 | **400** ✅ | `LEDGER_IDEMPOTENCY_KEY_INVALID` + `reason=PREFIX_REQUIRED` |
| C1-T03 | 建单位 · `decimals=99` | 400 | **400** ✅ | `LEDGER_AMOUNT_INVALID` + `field=currency.decimals,reason=DECIMALS_OUT_OF_RANGE,min=0,max=18` |
| C1-T04 | 建单位 · 符号含空格 | 400 | **400** ✅ | `LEDGER_AMOUNT_INVALID` + `reason=SYMBOL_FORMAT_INVALID` |
| C1-T05 | 建单位 · 缺 `fee` | 400 | **400** ✅ | `LEDGER_AMOUNT_NOT_POSITIVE` + `field=fee` |
| C1-T06 | 建单位 · `owner_uid≠actor` | 403 | **403** ✅ | `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED` |
| C1-T07 | 建单位 · **HAPPY**（fee 1000 → `-1`） | 200 | **200** ✅ | 事件 **2 条分录**；`ΔΣ=0`、`Δledger_entry=2`；`cid=10`、`status=draft` |
| C1-T08 | 建单位 · **同键重投** | 200 | **200** ✅ | `idempotent_replay=true`；`Δentries=0`、`ΔΣ=0`、行数不变 |
| C1-T09 | 建单位 · **同键异载荷** | 409 | **409** ✅ | `LEDGER_IDEMPOTENCY_CONFLICT`；符号 B **未创建** |
| C1-T10 | 建单位 · **重复符号（异键）** | 409 | **409** ✅ | `LEDGER_CURRENCY_SYMBOL_TAKEN`（`LD033`） |
| C1-T11 | 建单位 · **余额不足** | 409 | **409** ✅ | `LEDGER_INSUFFICIENT_BALANCE`（`LD001`，**非 500**）；**无孤儿 `currency` 行** |
| C2-T12 | 上市 · **无 token** | 401 | **401** ✅ | `AUTH_UNAUTHORIZED` |
| C2-T13 | 上市 · **未知 cid** 999999 | 404 | **404** ✅ | `LEDGER_CURRENCY_NOT_FOUND` + `details.cid="999999"` |
| C2-T14 | 上市 · `cid=0`（形状合法、不存在） | 404 | **404** ✅ | `LEDGER_CURRENCY_NOT_FOUND` + `cid="0"`（§3.1 类②） |
| C2-T15 | 上市 · **非本人**（970002 上市 970001 的 cid） | 403 | **403** ✅ | `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED` + `condition=not_currency_owner` |
| C2-T16 | 上市 · 键前缀非法 | 400 | **400** ✅ | `LEDGER_IDEMPOTENCY_KEY_INVALID` + `PREFIX_REQUIRED` |
| C2-T17 | 上市 · 缺 `deposit_amount` | 400 | **400** ✅ | `LEDGER_AMOUNT_NOT_POSITIVE` + `field=deposit_amount` |
| C2-T18 | 上市 · **HAPPY**（费 500 → `-1`；保证金 2000 **HOLD**） | 200 | **200** ✅ | 事件 **4 条分录**；`ΔΣ=0`、`Δledger_entry=4`、`Δcurrency_status_log=1`；行变 `listed`、`deposit_amount=2000` |
| C2-T19 | 上市 · **同键重投** | 200 | **200** ✅ | `idempotent_replay=true`；`Δentries=0`、`Δstatus_log=0`、余额/冻结不变 |
| C2-T20 | 上市 · **重复上市**（新键） | 409 | **409** ✅ | `LEDGER_CURRENCY_INVALID_TRANSITION` + `field=currency.status,reason=CURRENCY_STATE_INVALID,from=listed,required_from=draft` |
| C2-T21 | 前置：建 D 单位（fee 100，正常） | 200 | **200** ✅ | 事件 2 条分录（后面 T22 的对照组） |
| C2-T22 | 上市 · **保证金不足** | 409 | **409** ✅ | `LEDGER_INSUFFICIENT_BALANCE`；**D 仍 `draft`**、`Δstatus_log=0`、`Δentries=0`（判负用例） |

**服务端日志归因（§5.7 ⑪，凡 401/403 必看日志）**：`GET http://127.0.0.1:5555/api/logs/seafood-api` ⇒ 缓冲区 **21 条 `[ERR]`，最后一条时间戳 = 01:27:57**，**均早于本片两轮窗口**（run1 01:35:4x、run2 01:36:5x–01:37:37）；两轮窗口内**零 `[ERR]`**。逐条归因：
- `C1-T01`/`C2-T12` 的 **401**：`resolveActor` 在 `Authorization` 缺失时**短路返回**（`index.ts:155-157`，不调用 `verifySessionToken`）⇒ **不写日志、不触 DB**——与 §3.4 实测口径「无 token ⇒ 不触 DB、日志无记录」逐字一致。
- `C2-T15` 的 **403**：业务角色守卫（`ActorContext` 已解析成功）⇒ 走 `ledgerErrorBody`，**不是异常路径**、不写 `[ERR]`。
- 旁证：日志中 01:36:42-46 有面板 `killTree` + `启动校验：state=running pid=91246` ⇒ 本片第二次重启落地，且 run2 的 `C2-T20` 回出新增字段 `required_from=draft`（= 定稿代码特征）⇒ **run2 跑的是定稿代码**。

## §5 资金不变量对拍（**本片最重要判据**）

### 5.1 账户对拍量 Σ(balance+frozen)（全账户，含 `0/-1/-2/-3`）

| run | Σ 事件前 | Σ fixture 铸币后 | Σ 事件后 | ΔΣ（后−前） | 该 run 净铸/销额度 | 判定 |
|---|---|---|---|---|---|---|
| **run2（主）** | **1,000,000** | 2,000,000 | **2,000,000** | **+1,000,000** | fixture `mint` = **+1,000,000**（票面） | ✅ 相等 |
| run1（次） | 0 | 1,000,000 | **1,000,000** | **+1,000,000** | fixture `mint` = **+1,000,000** | ✅ 相等 |

- 两口径复算：`sigma_all`（SQL `sum(balance+frozen)`）与 `account_dump_sigma_js`（逐行 JS 复算）在 pre/post 两态**逐 run 相等**（run2 post：`2000000` = `2000000`）。
- **每个 C1/C2 事件**都是纯转移（无 `mint`/`burn`）⇒ 逐例 `delta_sigma` **全 0**（`e2e.json` 的 `C1_happy/C1_replay/C1_conflict/C1_symbol_taken/C1_insufficient/C2_happy/C2_replay/C2_relist/C2_insufficient` 九个读数）。
- **唯一** ΔΣ ≠ 0 的动作 = **fixture 铸币**（本片为让 happy path 有可用余额而做的受信任 `mint`，平台路径 R23；**已在 §5.4 单列**，`e2e.json.fixture_mint`）。

### 5.2 `ledger_entry` 增量 == 事件数 × 分录条数

| 事件 | 分录条数（规格） | 实测 Δentries | 支撑 |
|---|---|---|---|
| fixture `mint` | 1 | **1** | `fixture_mint.delta_entries=1` / `entries_in_event=1` |
| C1 建单位（run2 cid 10 / run1 cid 4） | 2（`currency_create_fee` ×2） | **2** | `C1_happy.delta_entries=2`、`entries_in_event=2` |
| C2 上市（run2 cid 10 / run1 cid 4） | 4（费 ×2 + 保证金 `listing_deposit` ×2） | **4** | `C2_happy.delta_entries=4`、`entries_in_event=4` |
| C1 建 D 单位（T21 前置） | 2 | **2** | run2 `ledger_entry` 9→18 的构成 |
| 重放 ×2（T08/T19） | **0** | **0** | `C1_replay/C2_replay.delta_entries=0` |
| 409 面 ×5（T09/T10/T11/T20/T22） | **0** | **0** | 各例 `delta_entries=0` |
| 400/401/403/404 面 ×9 | **0** | **0** | 上游形状/鉴权闸，未触账本 |

**合计**：run2 Δ = 1+2+4+2 = **9** ⇒ `count_ledger_entry` 9 → **18** ✅（`snapshot-{pre,post}.json`）。
**注意（批 2→批 3 判据反转）**：批 2 的「`ledger_entry` 增量 = 0 才绿」在批 3 **作废** —— 本片判据是「**增量 == 预期条数**」，`snapshot-post.json` 的 `18` 即绿信号（**不再把 0 当绿灯**）。

### 5.3 逐账户 dump（before / after，run2 主口径）

| uid | cid | balance（pre → post） | frozen（pre → post） | 说明 |
|---|---|---|---|---|
| `970001` | 1 | 996,400 → **1,992,800** | 2,000 → **4,000** | 唯一真实参与者：+1,000,000 铸币，−1,000−500−100 建单位/上市费，−2,000 转入冻结 |
| `-1` | 1 | 1,600 → **3,200** | 0 → 0 | 平台收入（**只进**）：+1,000（C1）+500（C2）+100（建 D） |
| `-2` | 1 | 0 → 0 | 0 → 0 | 佣金池：本片**无佣金事件**，不动（正确） |
| `-3` | 1 | 0 → 0 | 0 → 0 | 罚没账户：**退市/罚没未实现** ⇒ 不动（正确，§7-N1） |
| `0` | 1 | 0 → 0 | 0 → 0 | 平台主体（`$` 铸币源）：`mint` 只铸给受铸人，本体不动 |

**Σ 交叉验算（run2 post）**：1,992,800 + 4,000 + 3,200 = **2,000,000** = `sigma_all` ✅。
**非负 CHECK（`23514`）**：本片**未触发**（22 例无 500 面）；余额不足全部由 DB 前置 `R80` 判成 `LD001`/409（`0004:970-975`）⇒ 探针读数与「CHECK 是兜底、不是第一道闸」一致。

### 5.4 孤儿分录检查（每条新 `ledger_entry` 必须能对应本片的一个业务状态变化）

run2 新增 9 条（txid 17..25，run1 为 8..16，同构）：

| txid | uid | delta | frozen_delta | kind | ref_type/ref_id | 归属业务状态变化 |
|---|---|---|---|---|---|---|
| 17 | 970001 | +1,000,000 | 0 | `mint` | `null`/`null` | **fixture 铸币**（非业务事件，§5.1 单列） |
| 18/19 | 970001 / -1 | −1,000 / +1,000 | 0 | `currency_create_fee` | `currency`/10 | C1：`currency` 行 cid 10 落库（`draft`） |
| 20/21 | 970001 / -1 | −500 / +500 | 0 | `currency_create_fee` | `currency`/10 | C2：cid 10 `draft→listed`（上市费） |
| 22/23 | 970001 | −2,000 / 0 | 0 / **+2,000** | `listing_deposit` | `currency`/10 | C2：cid 10 保证金冻结（`deposit_amount=2000`，`HOLD_KINDS` 2 条配对） |
| 24/25 | 970001 / -1 | −100 / +100 | 0 | `currency_create_fee` | `currency`/15 | T21 前置：`currency` 行 cid 15 落库（`draft`） |

**结论**：9/9 条可对应；`ref_type='currency'` 全覆盖业务事件（`mint` 除外，它是显式 fixture）；`-1` 侧只有 credit（`debit` 恒空未被触碰）；**零孤儿**。run1 的 8 条同构（cid 4/9）✅。

### 5.5 幂等键的**键族**实测（`grep` 可得）

`snapshot-post.json` 的 `ledger_entry_dump` 显示同事件内派生键形如 `<key>`、`<key>#2`、`<key>#3`、`<key>#4`（`#` 为内部派生分隔符，§4.5 禁调用方使用）；C1 = 2 键（`key`,`key#2`）、C2 = 4 键（`key`..`key#4`）⇒ 与「事件数 × 分录数」表逐字吻合。

## §6 冻结面校验与探针自曝

### 6.1 冻结文件 sha256（**改前 = 改后**；改前取值于本片首次改码前）

| 文件 | 改前 = 改后 sha256 |
|---|---|
| `backend-ts/src/ledger.ts` | `cb7ef5c8b7c6166c3d4f2620a2b141b91dae8cf45f73ba301037be114d0377d7` |
| `backend-ts/src/ledger-errors.ts` | `5a671354eb7bfd6707bb27a48a1e661b73745a63de59c5201957a602006bf3c4` |
| `backend-ts/src/commission.ts` | `7b5ff9b36bfd7a34899145e7c1c5e61fe9522a8c446c82ae522b9efa5bf48d02` |
| `backend-ts/migrations/0017_platform_config.sql` | `0aaba855b1d5eb4c69b6b2c880b225df2053af7353f7c7b290f233006cbb1fcd` |
| `docs/route-layer.spec.md`（只读） | `2b9cb2f122d8800bbd2ada366677f81e94985fe1f33b20c739a9fe7daa9edca2` |

（§6.1 的「改后」复算见文末 §8 收尾读数；`migrations/**` 全目录未增删文件：`0001..0017` 共 17 个，无 `0018`。）

### 6.2 注册点与静态口径

- `grep -cE '^app\.(get|post|put|delete|patch)\(' src/index.ts` = **53**（批 2 末态 **51** + 本片 **2**）；新增两行位于 `src/index.ts` 的 404 兜底之前。
- 本片**未删改**任何既有注册点（51 条既有路径的键集不受影响；新增路径是**新面**，不涉及 §2 键集冻结）。
- `tsc --noEmit` = **0**；`dotenv` 装载顺序未改（`import './env'` 仍为 `index.ts` 第一行）。

### 6.3 探针自曝（口径缺陷与更正）

1. **token/密钥本体**：三份产物 + 本报告**零 token/密钥字节**，只落 sha256 前 12 位指纹（`grep -c 'eyJ'` = **0**，见 §8）。
2. **两轮 run（诚实披露）**：run1（`b3a-20260930T013122`）22/22 通过后发现 `C2-T20` 的 `details` 读法不佳（`from=listed,to=listed` 会被误读成 no-op）⇒ 补 `required_from:'draft'`（**仅 error details 文案，不动资金语义**）后重启服务、**run2 全量复跑**（22/22）。报告读数**以 run2 为主**，run1 产物保留在盘上可复核。
3. **fixture 铸币**：为让 happy path 有可用余额，两轮各做 1 次 `mint`（`cli:p4b3a:<run>:fixture-mint`，1,000,000 `$`，平台路径 R23）——这是本片**唯一** ΔΣ ≠ 0 的动作，已单列（§5.1/§5.4），**未**混入 C1/C2 的守恒结论。
4. **`ledger_entry` dump 的行序**：SQL 显式 `ORDER BY txid`，但 HTTP 驱动返回的行序出现 `10..16` 先于 `8,9`（run2 post 亦然）⇒ **只影响展示顺序**：行集完整、计数两口径一致（`count_ledger_entry`=18 与 dump 行数 18 逐字相符）。登记为探针观察，**不得**读作「行缺失」。
5. **「单语句 = 隐式事务」是实测结论，不是代码推断**：由两条判负用例坐实（C1-T11 无孤儿行、C2-T22 状态与审计与分录三零残留）。
6. **DB 直接调用面的 `details`**：本片走 HTTP 驱动（不搬运 PG `DETAIL`）⇒ 部分码的 `details` 只见 `{"detail_unavailable":"driver_did_not_carry_detail"}`（如 `LD001`/`LD003`）；**码与状态不受影响**。逐条 `details`（`required/available` 等）**未在本片逐字验证**（登记 §7-N4）。
7. **未复核**：`data-layer.spec.md` 的 md5 未复算（沿用父单）；`docs/route-layer.spec.md` 只读未改。
8. **未用**：`execute_code` / `git add|commit|push` / `npm install` / `pkill -f` / `killall` / 删除型 SQL / 写 `.env.local` / 写迁移。（本报告与产物均由 `ts-node` + `curl` + `grep` 生成。）

## §7 NOT_MEASURED 与待裁（**禁填 0/空**）

### 7.1 NOT_MEASURED（**未测 = 未测，不当 0/空使用**）

| # | 项 | 原因 |
|---|---|---|
| **N1** | **退市（`hold_release` 退回保证金）/ 罚没（`hold_forfeit`→`-3`）两条资金支路** | `§7-3` 只给了方向，**§4.2 无对应事件行、§1.1 无端点、无幂等键、无失败/回滚语义** ⇒ 按派单硬口径 #5（禁半实现）**未实现**（提问 §7-Q1） |
| **N2** | 币种状态闸的 `frozen` / `delisted` 两支（C2 的 409/423 面） | 库内无 `frozen`/`delisted` 行，且**禁改 `currency`** ⇒ 只测到 `draft→listed` 与「重复上市（`listed`）」；`frozen`/`delisted` 未测（与 spec §8.3-3 同款登记） |
| **N3** | 并发同键双发（真并发竞态） | 本片为串行用例；`LD006` 的「探针冲突但重放行不可见 ⇒ 同键重发一次」分支**未构造**（属 `ledger.ts` 既有面，非本片新增） |
| **N4** | 账本错误 `details` 的逐字形状（`required`/`available`/`kind`…） | HTTP 驱动不搬运 PG `DETAIL`（§6.3-⑥）；**码 + HTTP status 已验证**，`details` 逐字未验证 |
| **N5** | `currency` 表其它列的落库语义（`icon_url` / `supply_cap` / `total_supply`） | 本片 C1 只写 §4.2 C1 必需字段（`symbol/name/decimals/owner_uid` + `status`/`deposit_cid`），其余取 DDL 默认；不做「顺手加字段」 |
| **N6** | `deposit_cid ≠ 1`（非 `$` 保证金）分支 | 库内所有币 `deposit_cid=1` ⇒ 该分支未取数（**未实现任何特殊处理**：代码直接用该行既有列值） |
| **N7** | 前端消费面 | 本片**未改 `frontend/**`**；两条新路径**前端零调用**（spec §2.2 清单内无 `/api/currency`）⇒ 键集冻结不受影响 |

### 7.2 待裁（**需 Zang 一句话**；本片已按最小发明落地并留痕）

| # | 问题 | 本片取法（可作为默认） |
|---|---|---|
| **Q1** | 退市 / 罚没的**端点、幂等键、失败语义**由谁定义？（`§7-3` 只给资金方向） | 未实现（N1）；请给端点与键形 |
| **Q2** | `data-layer` v0.6 `DL67`/`DL88`/`R31`（上市费含 `listing_fee`、保证金**消耗不可退**）与 route-layer `§7-3`（上市费 `currency_create_fee`、保证金**冻结可退**）**正面冲突** —— data-layer 是否回写？ | 取 `§7-3`（派单硬口径 #1） |
| **Q3** | C1/C2 幂等键的**正式形态**（§4.2 该列 = 「待定」） | 调用方 `cli:`/`biz:`/`ops:`/`cm:` 键优先；缺省派生 `biz:currency:create:<symbol>` / `biz:currency:list:<cid>`（data-layer §8.3 键形） |
| **Q4** | 建单位费 / 上市费 / 保证金**金额来源**（spec 未定义费率，`app_config` 内亦无费率键，且「禁写费率键」） | 取**请求必填参数** `fee` / `deposit_amount`（正整数、≤ `1e15`），缺 ⇒ `400 LD017` |
| **Q5** | 非 owner 上市的码：`§4.2 C2` 期望码列写 `LD014`（403）vs `§3.2` 明文「新面业务路由**不得**返回 `LEDGER_UNAUTHORIZED_MINT`/`LEDGER_HOLD_NOT_ALLOWED`」 | `403 AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED` + `details.condition='not_currency_owner'`（两读法的折中，码域守 §3.2） |
| **Q6** | C1 的 `owner_uid` 是否**必须** = actor？（spec §4.2 C1 把它列为必需字段，未说可否代持） | 缺省 = actor；给了≠actor ⇒ `403 ACTOR_NOT_ALLOWED`（不替他人出资） |
| **Q7** | `decimals` 越界的码：data-layer §11.2 只给 `decimals_out_of_range` 字面，无专用码 | `400 LEDGER_AMOUNT_INVALID` + `reason=DECIMALS_OUT_OF_RANGE`（**不自创新码**） |

## §8 收尾复核读数（**全部现取**，均可 `grep` 复核）

| 读数 | 值 | 命令 / 支撑 |
|---|---|---|
| `tsc --noEmit` | **0**（`TSC_EXIT=0`） | `./backend-ts/node_modules/.bin/tsc --noEmit -p backend-ts` |
| 注册点 | **53** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` |
| 行数 | `currency-service.ts` **389** · `scripts/p4z-b3a-01-snapshot.ts` **89** · `scripts/p4z-b3a-02-e2e.ts` **302** · `database.ts` **3252** · `index.ts` **1210** | `wc -l` |
| 迁移文件数 | **17**（`0001..0017`，**无 `0018`**） | `ls backend-ts/migrations/ \| grep -c '^00'` |
| 冻结文件 sha256 | `ledger.ts` `cb7ef5c8…77d7` · `ledger-errors.ts` `5a671354…f3c4` · `commission.ts` `7b5ff9b3…8d02` · `0017_…sql` `0aaba855…1fcd` · `route-layer.spec.md` `2b9cb2f1…edca2` —— **与改前逐条相等** | `shasum -a 256`（§6.1 同值） |
| 产物 token/密钥字节 | `e2e.json` **0** · `snapshot-pre.json` **0** · `snapshot-post.json` **0** | `grep -rc 'eyJ' .p4-artifacts/<run2>` |
| 报告文本内 `eyJ` | 仅 **1 行**（= 本节 §6.3-① **记载该命令本身**，非 token 字节） | `grep -n 'eyJ' docs/audit/p4-b3a-currency-funds.md` |
| 报告节数 | **9**（`§0`…`§8`） | `grep -c '^## §' docs/audit/p4-b3a-currency-funds.md` |
| 终态台账 | `Σ=2,000,000` · `ledger_entry=18` · `currency_status_log=2` · `currency=5` 行 · `account=5` 行 | `snapshot-post.json`（run2） |
| 服务 | sid `seafood-api` · pid **91246** · `/health` **200** · `schema_version=0017` | 面板 `POST /api/restart {"sid":"seafood-api"}` → 轮询 `/health`（重启后**先等 200 再开测**） |

**run 目录（绝对路径）**
- 主：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3a-20260930T013647/`（`snapshot-pre.json` 5,983 B · `e2e.json` 20,749 B · `snapshot-post.json` 9,257 B）
- 次：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3a-20260930T013122/`（同构三件）

**交付声明**：本片只写 `backend-ts/src/**`（`currency-service.ts` 新建；`database.ts`/`index.ts` 增量）、`backend-ts/scripts/p4z-b3a-*.ts`（新建 2 个）、`backend-ts/.p4-artifacts/b3a-20260930T013647|013122/**`、本报告 `docs/audit/p4-b3a-currency-funds.md`。**未**改 `.env.local` / `migrations/**` / `src/ledger.ts` / `src/ledger-errors.ts` / `src/commission.ts` / `frontend/**` / `scripts/p4z-01-probe.ts` / 其它既有脚本与 artifact / `docs/route-layer.spec.md`（只读）/ `docs/seafood.master-plan.md`；**未**用 `git add|commit|push`、**未**跑删除型 SQL、**未**改任何 kind 集合或 `-1`/`-3` 白名单、**未**跑写库套件（除本片自有端到端）、**未** `npm install`、**未**用 `execute_code`、**未**用 `pkill -f`/`killall`（重启一律走面板单服务路由 `POST /api/restart`）。

