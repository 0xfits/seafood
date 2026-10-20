# BTTC 口径订正（`symbol='₿'` / `name='BTTC'`）— 实现单报告

口径（Kevin 2026-10-20）：**BTTC 是货币名称，₿ 是货币符号**；顶部菜单余额行必须显示**符号**。
本单只改**数据口径 + 定位方式**：`currency` 平台币行的 `symbol` 由 `'BTTC'` → `'₿'`、`name`
由 `'battcoin'` → `'BTTC'`，并把后端所有「BTTC 读 / 写路径」的**定位键**从 `symbol = 'BTTC'`
改成 `is_platform_coin = true`（cid 两库不同：dev 399 / 生产 4，不可写死；symbol 本身是会被改名的值）。

## 1. 变更集

| 文件 | 改动 |
|---|---|
| `backend-ts/migrations/0066_bttc_symbol_rename.sql`（新） | 平台币行原地改名 `symbol='₿'` / `name='BTTC'`；**一个 `DO` 块**内含改前 `cid` 快照 → 改名本体 → 终态自检（平台行恰 1 行 / 目标符号未被非平台行占用 / `symbol`/`name`/`is_platform_coin` 逐字 / **`cid` 不变** / 无残留 `symbol='BTTC'` / 无重复 `symbol`） |
| `backend-ts/src/database.ts` | 4 条路径的定位键改 `is_platform_coin = true`：`getBttcState` CTE、`bttcMint` CTE、`bttcBurn` CTE、`ensureBttcCurrency`（插入谓词 `WHERE NOT EXISTS` + 8 处回读兜底 `COALESCE` 子查询，均加 `ORDER BY c.cid LIMIT 1`）；兑底插入值改 `'₿'`/`'BTTC'`；`getBttcState` 兜底默认改 `'₿'`/`'BTTC'`；两处文档注释同步 |
| `backend-ts/scripts/p8-s9-bttc-gate.ts` | 前推 + 新增 M 段轻门臂（见 §5） |
| `ops/bttc-symbol/**` | 本报告 + 探针脚本 + 读数 |

**未动**：`frontend/**`、`docs/**`、其他迁移、`app_config`、ledger kind / 错误码闭集。注册点 **128 不变**（零新路由）。

## 2. dev apply（已做 · 仅 dev）

- preflight：`PROJECT=quiet-math-65207667`（dev）· `PENDING=[0066]` · `EXTRA=[]` · `SAFE`
- `npx ts-node --transpile-only scripts/migrate.ts` ⇒ `ok:true` · `schema_version=0066` · 0066 `action=applied`
- 库面：`cid=399 · symbol=₿ · name=BTTC · is_platform_coin=true · status=listed · total_supply=1`
  （`account` 引用面原样：cid 399 下 1 户、余额 1；`ledger_entry` 509 行 / `account` 49 行前后不变）
- 无残留 `symbol='BTTC'` 行（0）· `symbol` 无重复（0）

**幂等性（自证过程 · 含一次真缺陷）**：首版迁移的「目标符号空闲」前置断言写成了「全表无 `'₿'` 行」⇒
**整文件重放报 `symbol ₿ already taken by 1 row(s)`**（终态未变、数据无损，但幂等性被自己的前置断言破坏）。
已修为「**非平台行**未占用 `'₿'`」，并把该坑写进迁移注释与 M2 判据。修后：
整文件重放 HTTP 200（`command=DO`，0 行更新）、终态逐字不变；`migrate.ts` 复跑 `skipped · checksum match`。
★ dev `schema_migration` 里 0066 的 `checksum` 已同步平移为新文件 sha256（`5c5226ed…`，改前 `dd856216…`），
前提 = 新旧文件**终态逐行一致**（本次差异仅在自检断言与注释）——已用重放读数自证，`readings/checksum-realign.log`。

## 3. dev 活体（后端重启后 · 真 token · 本机 HMAC 签发）

`readings/http-probe.log`（`GET /api/health` schema 0066）：

- `GET /api/batt` ⇒ 200，`data.bttc = {symbol:"₿", name:"BTTC", status:"listed", totalSupply:"1", balance:"1", canMint:false, canBurn:true}`（**status 不再 null**）
- `GET /api/user/balances` ⇒ 200，`[{cid:1,symbol:"$",…},{cid:399,symbol:"₿",name:"BTTC",balance:"1"}]` ⇒ 顶部菜单渲染 `$4,291` / `₿1`
- `GET /api/user/balances`（无 token）⇒ 401 `AUTH_UNAUTHORIZED`
- `/api/bttc/*` 零 500：`mint`/`burn` 缺键 ⇒ 400 `LEDGER_IDEMPOTENCY_KEY_REQUIRED`；`biz:bttc:*` ⇒ 400 `…_INVALID(PREFIX_REQUIRED)`；`cli:not-a-uuid` ⇒ 400 `…_INVALID(NOT_UUID)`；batt/BTTC 不足 ⇒ 409 + `INSUFFICIENT_BATT` / `INSUFFICIENT_BTTC`
  （四臂全是**写前拒绝**：`ledger_entry` 509 / `account` 49 / `total_supply` 1 前后不变）

★ dev 5788 原先是**外部进程**（pid 22387，起于 19:15，跑改前代码）⇒ 已 kill 并经面板 `seafood-api` 重启（新 pid 17994）。
不重启的旧码在 apply 之后会按 `symbol='BTTC'` 查不到行 ⇒ `bttc.status=null`（按钮整块不渲染）——这正是本单要把定位键换成
`is_platform_coin` 的原因；**新码对新旧两态都成立**（`is_platform_coin` 两态都为 true）⇒ 代码先于迁移上线也安全。

## 4. 门套

| 门 | 读数 |
|---|---|
| `backend-ts` tsc（`tsc --noEmit -p tsconfig.json`） | **exit 0**（`readings/tsc.log`） |
| `p7b-03-offline-gates.ts` | **37/37 · red []** · 注册点 **128**（`readings/p7b.log`） |
| `p8-s9-bttc-gate.ts`（改前 → 改后） | **87/100（13 red）→ 93/104（11 red）**；新增 M1/M1-st/M2/M2-st 全绿，`K5`/`K10` 由红转绿；剩余 11 红**全为存量滞后**，见下 |

`p8-s9` 剩余 11 红（**均改前已红，非本单回归**，`readings/p8s9-before.log` 对比）：

- `A1/A2/A3/A5`：注册点冻结常量 99 vs 实际 128（存量滞后）
- `K3b`：断言「`is_platform_coin=true` 行数 = 0」（`0049` seed 落行起即为 1，存量）
- `KM1–KM4` / `KB1`：mint/burn 链基线按 `total_supply=0` 写死，dev 现有 1（存量数据态漂移）
- `KGS1`：同上（`totalSupply==='0'` 断言）；其 `symbol` 断言已前推为 `'₿'` 且**该子项已满足**

## 5. 门面改动明细（`p8-s9-bttc-gate.ts`）

前推（断言旧字面 → 新口径）：
1. `rowNow` 直查 `WHERE symbol='BTTC'` → `WHERE is_platform_coin = true`（并注释口径）
2. `KC1` / `KC2` / `KC1b`：`symbol === 'BTTC'` → `symbol === '₿'`，并各加 `name === 'BTTC'`
3. `KGS1`：`st.symbol === 'BTTC'` → `'₿'`，并加 `st.name === 'BTTC'`
4. `K10`：`WHERE symbol='BTTC'` 计数 == 0 → `WHERE is_platform_coin = true` 计数 == 1（语义 = 创建链未新增平台行，seed 行本就在场）
5. `K5`：库面指纹 `48 行/0049` → **`64 行/0066`**（加迁移必须同批前推，否则下一轮被当回归）
6. 头部判据清单加 M 段；新增 `SQL_0066` 读入

新增轻门臂（静态 · 零 DB）：
- **M1**：`src/database.ts` 中 `symbol = 'BTTC'` 字面 = **0** 处 ∧ `is_platform_coin = true` ≥ 4 处（实测 16）— 自检臂喂「symbol_lookups=3」必转红
- **M2**：迁移 0066 本体逐字在场（`UPDATE … SET symbol='₿', name='BTTC' WHERE is_platform_coin = true AND symbol='BTTC'`）+ 四条自检卫（平台行恰 1 / 目标符号未被非平台行占用 / `cid` 不变 / 无重复 symbol）+ `ensureBttcCurrency` 兑底值 `'₿'`/`'BTTC'` 与 `is_platform_coin` 插入谓词 — 自检臂喂「rename_body=false」必转红

## 6. 生产只读预检（未 apply · 零写 · `readings/prod-readonly-preflight.log`）

`project_id = sweet-pond-28934105`（生产）：

- 平台行 **恰 1 行**：`cid=4 · symbol=BTTC · name=battcoin · is_platform_coin=true · status=listed · supply=1`
- `symbol='₿'` 行 = **0**（目标符号空闲；无被非平台行占用风险）· 重复 `symbol` = 0
- `schema_migration` = 63 行 / `max=0065` ⇒ apply 0066 后应为 **64 行 / 0066**
- ⇒ 0066 在生产的三条前置全部满足（平台行恰 1 / 目标符号空闲 / 待 apply 恰 1 件），**本次未 apply**

## 7. 未做 / 待办（按单约定）

- **不 push**、**不 apply 生产**（生产 cid 4 待与 push 同批：preflight 三前置 → apply → `/api/health` 现读 0066）
- **不改 frontend / docs**：前端 `Header` 只透传 `symbol`（已核 `frontend/src` 无 `'BTTC'` 字面消费），余额行随 API 自动变 `₿1`
- **apply → push 之间有一个短窗口**：此刻线上仍是旧码，按 `symbol='BTTC'` 查不到行 ⇒ BTTC 铸造/分解/资产面显示「暂不可用」。
  本迁移是**值改名**（非契约变更）、新码对新旧两态都成立 ⇒ 若要零窗口，可**先 push 后 apply**（推荐），本次未执行
- `p8-s10` / `p8-s11` 的库面指纹仍停在旧版本（存量滞后，本单未动，建议另单前推）
- `ops/bttc-seed-migration/readings/sql-static-check.mjs`、`ops/bttc-mint-shortfall/**` 等历史读数脚本里的
  `'BTTC'` / `'battcoin'` 是**当时那次 apply 的证据快照**，按「历史读数不改写」保留
