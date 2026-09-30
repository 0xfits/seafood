# P4 · NUM-1 金额下限定值 + A1 单笔上限 — 报告

> 角色 = Kong（实现方）· 单号 = NUM-1 · 定值人 = **Kevin（2026-09-30，由 Zang 代定）** ·
> 报告生成时间 = 2026-09-30T20:5x（CST）· 依据 = Zang §5.82 7-23（机制先落地、数值待 Kevin）+ 本单派单。
> **骸架先行**（§5.7 ⑤）：本文件先落只有小节标题 + `NOT_MEASURED` 占位的骸架，随后**逐段立即回写**实测读数。

## 0 元信息（run tag / 产物路径 / 口径）

| 项 | 值 |
|---|---|
| 生效 run（本文所有读数出处） | `num1-20260930T204732` |
| 产物目录（绝对路径） | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/num1-20260930T204732/`（`num1-01-e2e.json` + `run.log`） |
| 侦察产物 | `.p4-artifacts/num1-20260930T203917/`（首跑，**已作废**，见 §7 自曝①） |
| token 口径 | `backend-ts/.env.local` 的 `SECRET_KEY` 铸 HS256（产物只记 12 位指纹，**不落 token 本体**） |
| 夹具幂等键 | `cli:num1-<TAG>:<case>`（TAG = run 目录数字段） |
| 服务 | `seafood-api`（面板 sid）· 端口 5788 · 经面板 `POST /api/restart {sid:"seafood-api"}` 重启 |
| 铸币 | 本单**零铸币**（`mints_in_this_run: 0`） |

## 1 三个下限常量：真名 / 真行号 / 改前 → 改后

文件：`backend-ts/src/currency-service.ts`（**单点常量形态**，未散落、未改成读 `app_config` —— 后者属批 6）。

| 常量真名 | 改前行号 · 值 | 改后行号 · 值 | 消费点（改后行号） |
|---|---|---|---|
| `CURRENCY_CREATE_FEE_FLOOR` | `:140` = `1000` | **`:142` = `10000`** | `:235`（建币 `fee`） |
| `CURRENCY_LIST_FEE_FLOOR` | `:141` = `1000` | **`:143` = `10000`** | `:348`（上市 `listing_fee`） |
| `CURRENCY_LIST_DEPOSIT_FLOOR` | `:142` = `1000` | **`:144` = `50000`** | `:350`（上市 `deposit_amount`） |

- 改前注释逐字 = `TODO: Kevin 定值（占位：非经济定值，仅机制占位）`；改后 = **`Kevin 2026-09-30 定值`**
  （10000/10000/50000；依据 = **阶梯锥定**，以「1% 佣金下 10 万酬金 ⇒ 1000 手续费」为锚；`$` 无 faucet
  ⇒ 属**有量级感的起始值**，待**首次铸币后重估**）。
- 行号 +2/+2/+2 的成因 = 同段注释扩写 3 行（常量块整体下移 2 行）。
- 机制**未变**：语义仍是「未传 ⇒ 服务端取数（下限兜底）；传了 ⇒ 必须 `>= 下限`，否则 400」。

## 2 硬编码旧下限的探针清单（逐一）+ 同步处置

**现取口径**：`grep -rnE "(fee|deposit_amount|listing_fee|create_fee): *[0-9]" backend-ts/scripts/p4z-*.ts`。

### 2.1 已同步（live 面，硬编码旧下限 ⇒ 会误红）

| 探针 | 旧值命中 | 处置 |
|---|---|---|
| `scripts/p4z-b3b-02-e2e.ts` | `fee: 1500` ×**19**、`deposit_amount: 2000` ×**9**、用例名 2 处、Σ 基线 `'2000000'` ×**3** | **已同步**：注入 `AMT_C1 = CREATE_FLOOR` / `AMT_DEP = LIST_DEPOSIT_FLOOR` / `SIGMA_BASE = '2020100'`，金额一律**跟随源码下限**（此后下限再变不会误红）；`sigma_is_2000000_pre_and_post` 改名 `sigma_is_baseline_pre_and_post` |
| `scripts/p4z-qa-b3-03-http.ts` | `:120` `fee: 1000`（cBody，被 T07/T08/T09/T10 复用，期望 200 replay / 409）、`:138` `fee: 1000`（期望 400 PREFIX_REQUIRED —— 费闸**先于**键闸 ⇒ 旧值会改成 AMOUNT_NOT_POSITIVE 而误标）、`:153`+`:157` `fee: 1000, deposit_amount: 1000` | **已同步** → `fee: 10000` / `deposit_amount: 50000`（4 处） |

同步**由脚本落盘并自证命中数**：`scripts/p4z-num1-02-sync-b3b.ts`（逐条断言命中数，零命中或数目不符即中止不写盘）。
实测输出：`hits: 1 / 19 / 9 / 1 / 1 / 3 / 1`，`RESIDUAL_1500 0 RESIDUAL_1000 0`；
残留 `2000` 2 处经核为**无害**：`SIGMA_BASE` 注释行 + `AbortSignal.timeout(20000)`。

### 2.2 未同步（**已被 FIX-B 取代的历史面**，逐条列出、不重写）

`scripts/p4z-b3a-02-e2e.ts`（run tag `b3a-20260930T013122`）硬编码旧下限共 **13 处**：
`fee: 1`（`:132,133,134,135,137,202,203,204,206`）、`fee: 1000`（`:142,156,168,180`）、
`fee: 500`（`:205,207,212,227,241`）、`fee: 100`（`:252,258`）、`deposit_amount: 2000`（`:205,212,227,241`）。

**不重写的判据（可 grep 复核）**：该片是 **FIX-B 之前**的记录，其 `:207`（`C2-T17 deposit missing` → 期望
`400 LEDGER_AMOUNT_NOT_POSITIVE`）**与 FIX-B 语义直接冲突** —— FIX-B 起「未传 ⇒ 服务端取数」，本单实测
`C1-c` / `C2-e` 均为 **200 + `source: server_default`**（§4）。⇒ 该片**不是**「硬编码旧值」型误红，而是
**语义已被取代**；按新语义重写它等于改写历史断言，故**只登记、不改**。（改值并不能让它变绿。）

其余 `p4z-*.ts` 的 `fee:`/`deposit_amount:` 命中经核**与下限无关**：`p4z-08-keys-b1d.ts:50`（撮合单 `fee: 0`）、
`p4z-qa-b3-01-conserve.ts:36-40`（`kind` 计数表）、`p4z-b3b-02-e2e.ts:185,269`（`fee: 99_000_000` 余额不足面，≥ 下限）、
`p4z-qa-b3-03-http.ts:144`（`fee: 999999999999` 余额不足面，≥ 下限）⇒ **无需同步**。

## 3 A1（后台调分）现状与处置

**现状（现取，非转抄文档 —— 文档 `route-layer-v0.9-delta.md:82` 记 `index.ts:1066`，实际已漂到 `:1175`）**：

| 项 | 实测 |
|---|---|
| 是否已实现 | **已实现** |
| 路由 | `backend-ts/src/index.ts:1175` `app.post('/api/admin/points/adjust', ...)` |
| 服务层 | `backend-ts/src/database.ts:940` `static async adjustPoints(uID, amount, reason)`（内部 `upsertAsset` 加/减） |
| 金额入参 | `parseInteger(req.body?.amount, Number.NaN)` —— **不区分正负**（可负 = 扣分） |
| 现有校验 | `!uID \|\| Number.isNaN(amount) \|\| !reason` ⇒ `sendError(res, 400, '参数不完整')`（**明文串**，**非**封闭集码形状） |
| 权限闸 | `requireAdmin(req, res)`（**无**更细权限键） |
| 审计留痕 | **仅 `console.log`**（`adjustPoints` 内），**无**账本/审计表留痕 |

**处置 = 只登记、不实现（上限 100000 `$`/笔未落）**，判据：
A1 的**单点校验位在 `src/index.ts`**（路由体），而本单**硬边界**只允许写 `src/currency-service.ts`（必要时
`src/admin-service.ts`）+ `scripts/p4z-*.ts` ⇒ **「能单点加校验」这一前提在授权写集内不成立**（改 `index.ts`
即越界）。⇒ 登记为**一行可改的待办**，随「授权写集放开」或 A1 专项一并落；**不得**为凑验收越界改 `index.ts`。

**届时落法（已定，照抄即可）**：在 `index.ts:1180` 前后（`amount` 解析后、`adjustPoints` 调用前）加
`if (Math.abs(amount) > 100000) return ...`，**沿用**既有权限闸（`requireAdmin`，不新增权限键）、
**超限拒绝用封闭集已有入参类码** = **`LEDGER_AMOUNT_INVALID`**（`ledger-errors.ts:49`，`class='input'`/`400`），
`details.reason` 复用本仓**已有**的 `OVER_MAX_SINGLE_AMOUNT`（`currency-service.ts:125` 同族语义：金额超单笔上限）
—— **不新造码、不新造 reason**。（A1 现有 `400` 走的是明文串，改造时一并收口为 R107 形状属 A1 专项，不在本单。）

## 4 边界实测读数（新值上下各一例）

出处：`.p4-artifacts/num1-20260930T204732/num1-01-e2e.json`。下限**从源码现取**（`floorOf()`，不写死在测试里）。
探针读数：`FLOORS {"CREATE_FLOOR":10000,"LIST_FEE_FLOOR":10000,"LIST_DEPOSIT_FLOOR":50000}`。
主体 = cid=1 余额最大者 `actor_uid=970001`（`actor_cid1_balance=1789070`）。

| # | 用例 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| C1-a | 建币 `fee=9999`（新下限**下**一例） | 400 | **400** `LEDGER_AMOUNT_NOT_POSITIVE`，`details={field:fee, value:"9999", min:"10000", reason:"BELOW_SERVER_FLOOR"}` | ✅ |
| C1-b | 建币 `fee=10000`（新下限**上/等**一例） | 200 | **200**，`fee="10000"`，`fee_source="client_ge_floor"`，`matches_source_floor=true` | ✅ |
| C1-c | 建币 **不传 fee** ⇒ 服务端默认 | 200 | **200**，`fee="10000"`，`fee_source="server_default"`，`matches_source_floor=true` | ✅ |
| C1-d | 同键同内容重投（幂等） | 200 replay | **200**，`idempotent_replay=true` | ✅ |
| C2-a | 上市 `deposit_amount=49999`（下例） | 400 | **400** `LEDGER_AMOUNT_NOT_POSITIVE`，`details={field:deposit_amount, value:"49999", min:"50000", reason:"BELOW_SERVER_FLOOR"}` | ✅ |
| C2-b | 上市 `listing_fee=9999`（下例） | 400 | **400** `LEDGER_AMOUNT_NOT_POSITIVE`，`details={field:listing_fee, value:"9999", min:"10000", reason:"BELOW_SERVER_FLOOR"}` | ✅ |
| C2-c | 上市 `fee=10000 + deposit=50000`（等值） | 200 | **200**，`listing_fee="10000"`/`deposit_consumed="50000"`，双 `source="client_ge_floor"` | ✅ |
| C2-d | 同键同内容重投 | 200 replay | **200**，`idempotent_replay=true` | ✅ |
| C2-e | 上市 **不传金额** ⇒ 服务端默认 | 200 | **200**，`listing_fee="10000"`/`deposit_consumed="50000"`，双 `source="server_default"`，`matches_source_floors=true` | ✅ |

**`SUMMARY {"pass":9,"total":9,"failed":[]}`；探针退出码 `EXIT=0`**（退出码直取，未过管道）。

## 5 回归读数（/health · /api/home · 410 面 · 注册点）

| 项 | 口径 | 读数 |
|---|---|---|
| `/health` | `curl -s -o /dev/null -w %{http_code}` | **200** |
| `/api/home` | 同上 | **200**（主测时点）；**远端库抖动下间歇 500** —— 40s 窗口实测 **6/10**（见 §7 事故④，非本单改动所致） |
| 已落 410 面 | 6 条路径 `POST` 无 token，逐条取 status | **6/6 = 410**（`/api/shard/redeem`、`/api/chest/1/open`、`/api/admin/settings/reset`、`/api/admin/task/create`、`/api/admin/prize/create`、`/api/admin/assets/init`） |
| 注册点 | `grep -cE "app\.(get\|post\|put\|delete\|patch)\(" src/index.ts` | **65**（改前 = 65，**不变**；本单未动 `index.ts`） |
| `tsc --noEmit` | `node_modules/.bin/tsc --noEmit`（退出码直取） | **`TSC_EXIT=0`**（在常量改动 + 两个探针同步后各验一次） |

## 6 资金不变量（Σtotal）

| 项 | pre | post | Δ |
|---|---|---|---|
| `Σ(balance+frozen)` | **2,020,100** | **2,020,100** | **`"0"`** ✅（= 派单给定基线，`sigma_is_expected_pre_and_post=true`） |
| `Σfrozen` | 10,483 | 10,483 | 0 |
| `ledger_entry` 行数 | 229 | 241 | +12（= 2 建币 ×2 腿 + 2 上市 ×4 腿，**全部纯转移**） |
| 新增币种 | — | `31:N1A0T204732:listed`、`32:N1B0T204732:listed` | 仅状态行，无铸币 |

⇒ **纯转移**（无 mint/burn），Σtotal 守恒。按 cid 分解（侦察实测）：cid1 Σ=2,000,000、cid4 Σ=10,000、cid16 Σ=10,000、cid21 Σ=100，合计 2,020,100。

## 7 探针自曝 / NOT_MEASURED 清单 / 环境事故

**探针自曝（我方探针/流程的缺陷，先怀疑自己）**：
1. **首跑读数全部作废**（run `num1-20260930T203917`）：服务**未重启**，跑的还是旧常量（1000）⇒ `C1-a(fee=9999)`
   被**接受为 200**、C1-c 的「服务端默认」实为 1000。**根因 = 我方漏了「改常量后必须重启服务」这一步**，
   不是业务缺陷 —— 重启后同一用例按新下限正确 400。**该 run 的读数不得引用**。
2. **同轮 C1-b `503 LEDGER_TX_TIMEOUT`**（`details={reason:"driver_connection_error", error_code:"ECONNRESET"}`）
   ⇒ 级联导致 C2-a..d 全 `404 LEDGER_CURRENCY_NOT_FOUND {cid:"0"}`（`cidA=Number(null)=0`）。属**远端库瞬时抖动**。
3. **次跑（`num1-20260930T204348`）9/9 全 `status=null`**：`body_head="FETCH_ERROR TypeError: fetch failed"` ——
   当时服务已**崩溃退出**（见事故②），并非用例问题。
4. 同步脚本的命中数**初值猜错**（我预估 `fee: 1500` 15 次、`deposit_amount: 2000` 7 次；脚本实测为 **19 / 9**）
   ⇒ 印证「读数不得凭空估」。脚本的**断言命中数**设计正是为此。

**环境事故（已复原/已登记）**：
- ① **远端 Neon（ap-southeast-1）间歇不可达**：`curl` 到 `ep-holy-forest-…neon.tech` 耗时 12.3s；node 的 `fetch`
  需 `--dns-result-order=ipv4first` 才稳定（默认 DNS 序下 `TypeError: fetch failed`）⇒ 本单所有 ts 脚本**均以该
  flag 运行**，且探针的只读查询带 5 次重试。
- ② **重启 `seafood-api` 时进程崩溃退出 code=1**：面板日志 = `@neondatabase/serverless` 的 WebSocket 建连
  超时后触发 `TypeError: Cannot set property message of #<ErrorEvent>`（库内缺陷 + 网络慢）⇒ 与本次改动**无关**
  （常量改动不涉 DB 连接）。按红线**只走面板 `{sid}` 路由**重启，未用任何 `pkill`/`killall`；重试后服务恢复。
- ③ **面板状态 `foreign`**：重启后面板把新实例列为 `occupier`（`node …/ts-node src/index.ts`，reparen 到 launchd）。
  按技能纪律**面板故意不杀**，未做清理；服务 `/health` 已 200。最终 `state=stopped→running` 收敛。
- ④ **服务在 20:53:02 再次自行崩溃**（同一 `@neondatabase/serverless` WebSocket `ErrorEvent` 未捕获缺陷 ⇒
  `进程退出，code=1`），与本次常量改动**无关**（本单只改 currency verb 的三个数值常量，不涉 DB 连接路径）。
  已按红线**只经面板 `{sid}` 路由**重启（`POST /api/start`，未用任何 `pkill`/`killall`），第 2 次尝试后恢复。
  恢复后 40s 稳定性窗口：`health` 9/10 = 200、`/api/home` 6/10 = 200（其余为远端库连接失败导致的 500/000），
  面板终态 `state:"running"`, `portOpen:true`。**该抖动为环境既有缺陷，本单不修复、仅登记**
  （修法属 `db.ts`/驱动层，且 `src/db.ts` 不在本单授权写集）。Neon 端点直连时延实测在 1.96s ~ 12.4s 间大幅波动。

**NOT_MEASURED（禁填 0/空）**：
- **A1 单笔上限行为**：`NOT_MEASURED`（上限**未实现**，见 §3 —— 授权写集不含 `src/index.ts`；非「测了得 0」）。
- **A1 的权限面/审计面**：`NOT_MEASURED`（本单未发 `/api/admin/points/adjust` 请求）。
- **同步后 `p4z-b3b-02-e2e.ts` 的端到端复跑读数**：`NOT_MEASURED`（本单只做静态同步 + `tsc` 通过；
  未重跑该片 —— 其夹具面与 `p4z-num1-01-e2e.ts` 重叠，语义由后者实测覆盖）。
- **`p4z-b3a-02-e2e.ts` 的复跑**：`NOT_MEASURED`（**故意不重写、不重跑**，判据见 §2.2）。
- **410 面 6/6 的响应体**：`NOT_MEASURED`（只取 status，未解析 body）。

## 8 硬边界遵守与产物

**改动文件（全部在授权写集内）**：
1. `backend-ts/src/currency-service.ts` —— 三个常量定值 + 注释同步（§1）。**唯一 src 改动**（`admin-service.ts` 未动）。
2. `backend-ts/scripts/p4z-b3b-02-e2e.ts` —— 旧下限夹具同步（§2.1）。
3. `backend-ts/scripts/p4z-qa-b3-03-http.ts` —— 旧下限夹具同步（§2.1）。
4. `backend-ts/scripts/p4z-num1-00-recon.ts`（新增·只读侦察）、`p4z-num1-01-e2e.ts`（新增·边界实测）、
   `p4z-num1-02-sync-b3b.ts`（新增·同步器）。
5. `docs/audit/p4-num1-floors-and-cap.md`（本报告）。

**产物**：`.p4-artifacts/num1-20260930T204732/`（run-tagged，绝对路径 = `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/num1-20260930T204732/`），含 `num1-01-e2e.json` + `run.log`；另留 `.p4-artifacts/NUM1_RUN_TAG.txt`。

**未触碰（逐条对照硬边界）**：`migrations/**`、`src/ledger.ts`、`src/ledger-errors.ts`、`src/commission.ts`、
`src/admin-service.ts`、`src/index.ts`、`frontend/**`、`backend-ts/.env.local`、`docs/**`（除本报告这一新增文件）、
`docs/seafood.master-plan.md`、`scripts/p4z-01-probe.ts`。**未用** `git add/commit/push`、删除型 SQL、
`npm install`、`execute_code`、kind/白名单改动；**未用** `pkill -f`/`killall`。
