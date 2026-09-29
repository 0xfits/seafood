# P4-B3b / FIX-B —— C2 入账形状修正（冻结可退 → **消耗入 `uid=-1`**）+ C1/C2 金额服务端取数

> **单号**：Unit P4-B3b（Kong · 批 3a 返工单 FIX-B） · **日期**：2026-09-30
> **Run tag（产物目录 / 事件键前缀）**：`b3b-20260930T020359+0800`
> **服务**：`seafood-api` @ `127.0.0.1:5788`（面板 sid `seafood-api`；重启走 `POST :5555/api/restart`，**未用** `pkill/killall`）
> **上游依据（只兑现已冻结的裁定，不自行推导）**：
> `docs/ledger.spec.md` **§3.1 R31（v0.2）**（`:287`）· `:79`（D7 行）· `:12-13` · `:191`；
> `docs/data-layer.spec.md` **DL67**（`:454`）· **DL88**（`:530`）· DL91（`:533`）【**均已冻结**】；
> `docs/route-layer.spec.md` v0.3 **§4.2 C2 行**（`:427`）· **§4.3 资金四栏 C2 行**（`:448`）· **§4.4-11**（`:466`）· §7-3（`:622`）· §7-23（`:642`）；
> Zang 裁定 **§5.81**（`docs/seafood.master-plan.md:1418`，保证金 = 上市即消耗 → 贷 `-1`）· **§5.82 7-23**（`:1414`，机制先落地、数值待 Kevin）。
> **spec 与代码冲突**：**未发现**需停询的冲突（详见 §2.3「kind 组合的取法」）。
> **产物（绝对路径）**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3b-20260930T020359+0800/`
> （`snapshot-pre.json` · `snapshot-post.json` · `b3b-02-e2e.json` · `b3b-03-legs.json` · `b3b-01-http.json` · `panel-logs-after.json` · `*-tty.log` · `tsc-noEmit.log`）

---

## §0 边界自证（改了什么 / 没改什么）

| 类别 | 文件 | 说明 |
|---|---|---|
| **改** | `backend-ts/src/currency-service.ts` | C2 回执语义 + C1/C2 金额服务端取数（文件头/§4.4-11 注释、`resolveServerAmount`、3 个下限常量） |
| **改** | `backend-ts/src/database.ts` | **仅** `listCurrencyWithDeposit` 一带（`:1381-1470`，行号现取）：保证金第 4 条腿由「同 uid `frozen_delta=+d`」改为「`uid=-1` `delta=+d`」+ 注释 |
| **新建** | `backend-ts/scripts/p4z-b3b-01-restart-http.ts` · `p4z-b3b-02-e2e.ts` · `p4z-b3b-03-legs.ts` | 本单探针（**未改** `p4z-01-probe.ts` 或任何既有脚本） |
| **新建** | `docs/audit/p4-b3b-currency-funds-fix.md`（本文件）· `.p4-artifacts/b3b-20260930T020359+0800/**` | |
| **未碰** | `migrations/**`（`0019`/`0020` **已应用、本单未改**） · `src/ledger.ts` · `src/ledger-errors.ts` · `src/commission.ts` · `src/index.ts` · `frontend/**` · `backend-ts/.env.local` · 任何 spec（`docs/**` 只读） · 其它既有脚本/artifact | `git status --porcelain` 佐证：本单工作树变更 = `src/currency-service.ts`、`src/database.ts` + 上述新增（`scripts/p3x-00-rebuild-replay.ts` 的改属 **FIX-RS** 另一单，非本单） |
| **禁用项遵守** | 无 `git add/commit/push`；无删除型 SQL；未改 kind 集合/白名单；未跑写库套件；未 `npm install`；未用 `execute_code` | |

---

## §1 两处修正（各带「修前 → 修后」与依据）

### 1.1 C2 入账形状：冻结可退 → **消耗入 `uid = -1`**

- **落点**：`backend-ts/src/database.ts` `listCurrencyWithDeposit` 的 `ledger_post_event` 分录数组（现取 `:1455-1470`）。
- **修前（错）**：`listing_deposit` 两条腿 = 「user `delta=-d`（`frozen_delta=0` 未写）」+「user `delta=0` / `frozen_delta=+d`」⇒ **纯冻结、可退、不进 `-1`**。
- **修后**：「user `balance -d`」+「`uid=-1` `balance +d`」⇒ **跨账户消耗**；**`frozen_delta` 字段整体不再出现**（= 零 `frozen` 变动）。
- **依据**：R31（v0.2）/ DL67 / DL88【冻结】+ Zang §5.81；DB 侧 `0019`（`-1` credit 白名单收 `listing_deposit`）+ `0020`（`ledger_post_event` hold 家族 IN 列表摘除它）**均已应用**（`/health.schema_version = 0020`，实测）。

### 1.2 C1/C2 金额：客户端必填 → **服务端取数 + 下限校验**

- **落点**：`backend-ts/src/currency-service.ts`（`resolveServerAmount`、`CURRENCY_CREATE_FEE_FLOOR` / `CURRENCY_LIST_FEE_FLOOR` / `CURRENCY_LIST_DEPOSIT_FLOOR`、两处调用点）。
- **修前（洞）**：`toRequiredPositive(body.fee / body.deposit_amount)` ⇒ **只校验正数** ⇒ **任何人可传 `fee=1` 绕过**（Zang §5.81 逐字判为「资金面的真洞」）。
- **修后**（语义写死）：
  1. **未传**（`undefined`/`null`/`''`）⇒ 取**服务端常量**（下限兜底）；
  2. **传了** ⇒ 形状闸（正整数 · `≤ 1e15`）后必须 `>= 下限`，**低于 ⇒ 400**；
  3. 事件入参与**请求指纹**一律用**生效值**（服务端值）⇒ 同键重投的判定不受「未传 vs 传下限值」影响。
- **删除**：原 `toRequiredPositive`（**其唯一用途就是允许调用方自定金额** = 该洞的载体；删后无引用，`tsc --noEmit` 仍 0）。

---

## §2 修前形状 vs 修后形状（含修前那批错形状记录的出处）

### 2.1 出处（修前记录的来源）

| 记录 | 位置 | 内容 |
|---|---|---|
| 批 3a 交付报告 | `docs/audit/p4-b3a-currency-funds.md` | §1 表 **T2 行**（`DL88` 保证金「上市即消耗」 vs 本片实现的「纯冻结、可退」= **正面冲突**）；**§7-Q2**（该冲突「取 §7-3 ⇒ 与 DL88/R31 冲突，需 Zang 终审」）；`§4` C1-T01..T11 / C2-T12..T22（22 例，其中 T18/T21/T22 的期望形状均为**冻结**） |
| 代码原注释 | `backend-ts/src/database.ts:1391`（修前） | 「保证金 = `listing_deposit`（`HOLD_KINDS` 内）⇒ 2 条（`delta=-d` / `frozen_delta=+d`，同 uid 同 cid），**纯冻结、可退、不进 `-1`**（§7-3）」 |
| C1/C2 头注释 | `backend-ts/src/currency-service.ts:12-14`（修前） | 同上口径（已按 FIX-B 改写并留痕） |
| spec（v0.2 错口径） | `route-layer.spec.md` v0.2 §7-3 | 「保证金 = HOLD 冻结可退」—— 已由 v0.3 §7-3 更正（`:622`）并显式登记为**错误推断** |
| Zang 勘误 | `master-plan §5.81`（`:1418` A 节） | 「§5.80 批准『无需改白名单、无需迁移』**作废**；真根因 = `HOLD_KINDS` 误含 `listing_deposit`」 |

### 2.2 形状对照（同一事件）

| | 修前（批 3a，错） | 修后（本单，实测） |
|---|---|---|
| 腿数 | 4（2× `currency_create_fee` + 2× `listing_deposit`） | **4** |
| 上市费 2 腿 | user `balance -fee` / `-1` `balance +fee` | **同左（未动）** |
| 保证金 2 腿 | user `delta=-d`（`frozen_delta=0`）+ user `delta=0` / `frozen_delta=+d` | **user `balance -d` + `-1` `balance +d`** |
| `frozen` 变动 | `+d`（**在冻**） | **零**（无 `frozen_delta` 字段） |
| 收款方 | 无（冻结在用户自己账上） | **`uid=-1`（平台收入）** |
| 可退性 | 回执 `deposit_refundable: true` | **`deposit_refundable: false`**；回执 `deposit_consumed` + `deposit_credit_uid: '-1'` |
| 金额来源 | 请求体 `fee` / `deposit_amount`（只校验正数 ⇒ `fee=1` 可绕过） | **服务端常量（下限兜底）+ 低于下限 ⇒ 400** |

### 2.3 kind 组合的取法（**未发生冲突，无需停询**）

`route-layer.spec` **§4.2 C2 行**（`:427`）写死事件的 kind = 上市费 **`currency_create_fee` ×2 → `-1`** + 保证金 **`listing_deposit` ×2 → 贷 `uid=-1`**；DL67 的「`listing_fee`（**若适用**）」是**条件项**，§4.2/§4.3 的 C2 行均**未**列入。
⇒ **本单不新增 `listing_fee`**、**不改动既有 `currency_create_fee` 两腿**（与批 3a 一致）。**kind 关闭集仍 20**（`R40`，未增未删）。

---

## §3 金额服务端取数：口径、码的选择与依据

| 项 | 取值 | 依据 |
|---|---|---|
| 载体 | **服务端代码常量兜底**（`currency-service.ts` 三个 `*_FLOOR`） | §4.4-11「配置真源或下限校验」+ Zang §5.82 **7-23**「下限取可配置 + 代码常量兜底」 |
| 占位数值 | `CURRENCY_CREATE_FEE_FLOOR = 1000` · `CURRENCY_LIST_FEE_FLOOR = 1000` · `CURRENCY_LIST_DEPOSIT_FLOOR = 1000`，逐条标 **`TODO: Kevin 定值`**（**非 0、非小数、明显占位**） | 7-23「数值不由我（子代理）发明；经济参数属 Kevin 拍板」 |
| 未传时 | 用服务端常量（实测：`fee_source=server_default`，扣款 = **源码常量**） | 「**不得**由调用方决定金额」 |
| 低于下限 | **400**，借码 **`LEDGER_AMOUNT_NOT_POSITIVE`**（`§14.1 #18`，400 入参类；`details = {field, value, min, reason:'BELOW_SERVER_FLOOR'}`） | 派单硬口径「用封闭集里已有的入参错误码，不得新造码」；同族（本文件原缺值/非正整数分支同码） |
| **备选码（供 Zang 复核）** | `LEDGER_AMOUNT_INVALID`（`#17`，本文件 `shapeError` 兼作「参数形状码」的既有惯例，`details.reason` 区分）—— 语义上「低于下限」是**量纲不足**而非「格式错」⇒ 本单取 `NOT_POSITIVE`；若 Zang 判「下限」应归形状族，改一行即可（**未自选不改**，登记于此） | §14.1 #17/#18；`ledger-errors.ts:49-50` |
| **批 6 待办（登记，不在本单实现）** | 改为**从平台配置取数**；**真源键名待 Kevin 给**（**不得**从 `app_config` 硬造键名 —— Zang 裁定 7-16）；届时本常量降为兜底 | §4.4-11 + 7-23 + 7-16 |

---

## §4 必验读数（全部实测；产物可 `grep`）

### 4.1 库侧 pre / post 全账户 dump（供 Zang 自算）

`public.account` **逐行**（`snapshot-pre.json` / `snapshot-post.json` → `account_dump`）：

| uid | cid | pre balance | pre frozen | post balance | post frozen | Δbalance | Δfrozen |
|---|---|---|---|---|---|---|---|
| `-1` | 1 | 3203 | 0 | **11203** | 0 | **+8000** | **0** |
| `-2` | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `-3` | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `0` | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `970001` | 1 | 1992795 | **4002** | 1984795 | **4002** | **−8000** | **0** |

| 口径 | pre | post | Δ |
|---|---|---|---|
| **Σbalance** | 1995998 | 1995998 | **0** |
| **Σfrozen** | 4002 | 4002 | **0** |
| **Σtotal（= Σbalance+Σfrozen）** | **2000000** | **2000000** | **0** |
| `ledger_entry` 行数 | 30 | 42 | **+12** |
| `currency` 行数 | 5 | 7 | +2（本单新建单位 A/B） |
| `currency_status_log` 行数 | 2 | 4 | +2（两次上市各 +1 审计行） |

> **断言通过**：① Σtotal **恒 = 2,000,000**（= 两次 `mint` 票面之和；**本单 0 次铸币**，与 Zang 基线一致）；② 纯转移事件前后 Σtotal **不变**（Δ=0）；③ **Σfrozen 零变动**（4002 → 4002）。

### 4.2 `ledger_entry` 逐 kind 计数与总增量

| kind | pre | post | Δ（= 本单增量） |
|---|---|---|---|
| `currency_create_fee` | 12 | 20 | **+8**（C1×2 事件 2 腿 + C2×2 事件各 2 腿 = 4 事件 ×2） |
| `listing_deposit` | 12 | 16 | **+4**（C2×2 事件各 2 腿） |
| `hold` | 4 | 4 | **0** ← 修前的 `listing_deposit` 两腿曾被记进 hold 形状；**本单零新增** |
| `mint` | 2 | 2 | **0** ⇒ **本单无铸币** |

### 4.3 C2 成功事件的**逐腿**取证（`b3b-03-legs.json`）

事件键 `cli:p4b3b:b3b-20260930T020359+0800:c2-list`（cid 16，`fee=1500`/`deposit=2000`，客户端传值 `≥ 下限`）：

| txid | uid | cid | delta | **frozen_delta** | kind | balance_after | frozen_after |
|---|---|---|---|---|---|---|---|
| 42 | 970001 | 1 | −1500 | **0** | `currency_create_fee` | 1988795 | 4002 |
| 43 | **−1** | 1 | +1500 | **0** | `currency_create_fee` | 7203 | 0 |
| 44 | 970001 | 1 | −2000 | **0** | `listing_deposit` | 1986795 | 4002 |
| 45 | **−1** | 1 | **+2000** | **0** | `listing_deposit` | 9203 | 0 |

事件键 `…:c2-default`（cid 21，**body 完全不传金额** ⇒ 服务端取数）：txid 46..49，形状同上，金额 = **1000/1000 = 源码常量**（`both_events_4_legs=true`、`no_frozen_anywhere=true`、`listing_deposit_credits_neg1=true`、`listing_deposit_debits_owner=true`，`delta_sum_zero=0`）。

> **硬断言**：C2 成功的两个事件里，`listing_deposit` 的**两条分录都在 `balance`**（`frozen_delta=0`）、收款方 = **`uid=-1`**、事件内 Σdelta = 0、Σfrozen = 0 ⇒ 与 R31/DL67/DL88 逐字一致。
> **判负零残留**：`c2-notowner`（403）/ `c2-insuf`（409）/ `c1-insuf`（409）三个键下 `ledger_entry` **腿数 = 0**（无一滴残留）。

---

## §5 端点级矩阵（真 token · `.env.local` `SECRET_KEY` 铸 · **24/24 PASS**）

| # | 用例 | 期望 | 实测 |
|---|---|---|---|
| C1-T01 | 无 token | 401 `AUTH_UNAUTHORIZED` | ✓ |
| C1-T02 | 键前缀非法 | 400 `LEDGER_IDEMPOTENCY_KEY_INVALID` | ✓ (`reason=PREFIX_REQUIRED`) |
| C1-T03 | `decimals=99` | 400 `LEDGER_AMOUNT_INVALID` | ✓ |
| C1-T04 | symbol 形状 | 400 `LEDGER_AMOUNT_INVALID` | ✓ |
| **C1-T05** | **`fee=999` < 下限** | **400** | ✓ `LEDGER_AMOUNT_NOT_POSITIVE` `{min:"1000",reason:"BELOW_SERVER_FLOOR"}`，**Δ分录 0、无建单位行** |
| C1-T06 | `owner_uid != actor` | 403 `AUTH_FORBIDDEN` | ✓ |
| C1-T07 | **成功建单位**（`fee=1500`） | 200 | ✓ 2 腿、`fee_source=client_ge_floor`、owner −1500 / `-1` +1500、**frozen Δ0** |
| C1-T08 | 同键同载荷重投 | 200 replay | ✓ **Δ分录 0 / Δ行 0 / ΔΣ 0** |
| C1-T09 | 同键异载荷 | 409 `LEDGER_IDEMPOTENCY_CONFLICT` | ✓ |
| C1-T10 | 异键同 symbol | 409 `LEDGER_CURRENCY_SYMBOL_TAKEN` | ✓ |
| C1-T11 | 余额不足 | 409 `LEDGER_INSUFFICIENT_BALANCE` | ✓ **无孤儿 `currency` 行** |
| **C1-T12** | **金额全不传** | **200（服务端取数）** | ✓ 扣款 **= 源码常量 1000**、`fee_source=server_default` |
| C2-T13 | 无 token | 401 | ✓ |
| C2-T14 | 未知 cid 999999 | 404 `LEDGER_CURRENCY_NOT_FOUND` | ✓ |
| C2-T15 | `cid=0` | 404 | ✓ |
| **C2-T16** | **`deposit_amount=999` < 下限** | **400** | ✓ `{field:"deposit_amount",min:"1000"}` |
| **C2-T17** | **`fee=999` < 下限** | **400** | ✓ `{field:"listing_fee",min:"1000"}` |
| C2-T18 | 非本人 | **403 `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`** | ✓ `{condition:"not_currency_owner",ref_id:"16"}` |
| C2-T19 | 键前缀非法 | 400 | ✓ |
| **C2-T20** | **成功上市**（`1500`+`2000`） | 200 | ✓ **4 腿全在 balance、frozen 零变动**（§4.3）、`deposit_refundable=false`、`deposit_credit_uid=-1`、ΔΣ=0、Δ审计行 +1 |
| C2-T21 | 同键同载荷重投 | 200 replay | ✓ Δ分录 0 / Δ审计行 0 / ΔΣ 0 |
| C2-T22 | 已 listed 再上市（新键） | 409 `LEDGER_CURRENCY_INVALID_TRANSITION` | ✓ |
| **C2-T23** | **金额全不传** | **200（服务端取数）** | ✓ 扣款 **1000+1000 = 源码常量**、4 腿、frozen Δ0、ΔΣ=0 |
| C2-T24 | 保证金 > 余额 | 409 `LEDGER_INSUFFICIENT_BALANCE` | ✓ **状态仍 `draft` + 审计行 0 + 分录 0** |

### 5.1 401/403 的服务端日志口径（纪律 ⑩ 的**如实半边**）

- 已抓：`panel-logs-after.json`（`GET :5555/api/logs/seafood-api?lines=1200`，**1199 行**）。
- **读数**：该日志**不含请求级 access log** —— `grep '/api/currency'` = **0 行**、`403` = **0 行**（仅 2 处 `401` 且为**栈帧行号** `src/index.ts:401`）。
- ⇒ **如实登记**：「401/403 的服务端日志逐条归因」= **NOT_MEASURED**（**本仓不落请求日志**，非本单可解）；替代取证 = 响应体 `code`/`details.reason` + 事件键下**零分录**（§4.3 判负行）。**不把「日志查不到」写成「日志确认无异常」。**

---

## §6 回归 / 静态 / 收尾

| 判据 | 读数 |
|---|---|
| 面板单服务重启 | `POST :5555/api/restart {sid:'seafood-api'}` ⇒ `{ok:true,state:"running",pid:33620}`；等待 **2011 ms** 后 `/health` **200** |
| `/health` | 200（`schema_version=0020`，`db_version=PostgreSQL 18.6`） |
| `/api/home` · `/api/prize/all` · `/api/task/all` | **200 / 200 / 200**（重启前 + 重启后各一轮） |
| 已落 **410** 面 | **6/6 仍 410**（`/api/auth/register` · `/api/shard/redeem` · `/api/chest/1/open` · `/api/admin/prize/{create,update,delete}`） |
| **注册点** | **53**（`src/index.ts` 内 `app.<method>(` 计数）—— **本片未新增/删除对外路径** |
| `tsc --noEmit` | **exit 0**（`tsc-noEmit.log`，0 行输出） |
| 产物内 `grep -c 'e[y]J'` | **0**（`src/` 全量；`grep -l` 无命中） |
| 收尾 `/health` | 200 |

---

## §7 探针缺陷与教训（先骸架后回填；异常先怀疑探针）

1. **`ledger_entry.txid` 是逐行的**：同一事件 4 条腿有 **4 个不同 txid**（42/43/44/45）⇒ 用 `WHERE txid = <事件返回的 txid>` 取「该事件全部分录」**只回 1 腿**（首版 `p4z-b3b-02-e2e.ts` 的 `entries` / `kinds_ok` / `both_legs_owner_and_neg1` 三处即此缺陷读数）。
2. **一条事件的多腿 `idempotency_key` 不同**：账本按 `K` / `K#2` / `K#3` … 派生（§4.4-1 的 `{K, K#2}`）⇒ 必须 `= K OR LIKE 'K#%'`。
3. **`sql(\`…${x}…\`)` 是调用式**（neon）：JS 先把插值**内联**成字符串 ⇒ 文本参数直接 `syntax error at or near ":"`（数值侥幸通过，更危险）⇒ 一律用**标签模板** `sql\`…${x}…\``。
- **处置**：以上三处已就地修正于 `p4z-b3b-03-legs.ts`；**逐腿证据一律以 `b3b-03-legs.json` 为准**（§4.3），`b3b-02-e2e.json` 的 `entries` / `kinds_ok` / `both_legs_owner_and_neg1` 三处字段**声明作废**（其余字段——事件腿数 4、owner/`-1` 余额 Δ、frozen Δ、Σ 不变——均为独立读数，**有效**）。
- **未重跑 e2e 的原因（如实登记）**：事件键按 run tag 确定 ⇒ 重跑会把成功路径变成 **replay**、拿不到新鲜分录；故**不**用重跑掩盖，改以只读探针 `p4z-b3b-03-legs.ts` 对**既有 txid 42..49** 逐腿取证。

---

## §8 待办 / 未决（**登记，不自决**）

| # | 项 | 归属 |
|---|---|---|
| 1 | **下限数值**（三个 `*_FLOOR`，现为占位 `1000`，逐条标 `TODO: Kevin 定值`） | **Kevin**（经济参数） |
| 2 | 金额改**从平台配置取数**（真源键名待定；**不得**从 `app_config` 硬造键） | **批 6 配置面** |
| 3 | 低于下限的借码 = `LEDGER_AMOUNT_NOT_POSITIVE`（备选 `LEDGER_AMOUNT_INVALID`）—— 请 Zang 复核拍板 | **Zang** |
| 4 | 「未传金额 ⇒ 服务端默认」这一语义**改变了** `p4-b3a-currency-funds.md` 的 C1-T05 / C2-T17（修前 = 缺值 400）；本单按「服务端取数」硬口径执行并显式登记 | Zang 确认 |
| 5 | 401/403 的**服务端日志逐条归因** = `NOT_MEASURED`（本仓无 access log） | 已知边界 |
| 6 | `.env.local` 密钥口径：本单全部探针用**生产签名器 + `.env.local` `SECRET_KEY`** 铸 token（旧兜底常量 token 已 401） | 已遵守 |
| 7 | 既有「旧形状」残留数据：cid 4 / cid 10 的 `deposit_amount=2000` 与 4002 的 `frozen` 余额是**修前 hold 形状的历史残留**（本单**不改历史数据**，删除型 SQL 已禁用） | 登记（清理口径待裁） |

---

## §9 一句话结论

C2 上市事件的保证金已从「同账户冻结可退」改为 **跨账户消耗入 `uid=-1`**（4 腿全在 `balance`、`frozen` 零变动、`deposit_refundable=false`），C1/C2 金额已改为 **服务端取数 + 下限校验**（客户端低于下限 ⇒ 400 `LEDGER_AMOUNT_NOT_POSITIVE`，未传 ⇒ 用服务端常量）；24/24 端点用例、Σtotal 恒 2,000,000、Σfrozen 零变动、注册点 53、`tsc` 0、`eyJ` 0 全部实测通过。
