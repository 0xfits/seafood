# 批 8 第三片 8③ 收口 —— 上市保证金「金额可配置」（`AK2` 入册 · 读侧 + fail-closed + 四段真生效 + 无退还/罚没面）

> **作者角色** = **Kong（实现方）** · **单别** = 批 8 第三片 **8③** · **本件 = 8③ 最后收口**（★ `R-8-20` 门判据升级 + `v4` 重跑 + 报告落盘回填 + 攒批项 + 收尾）。
> **契约真源**：`docs/data-layer.spec.md` **v0.12 §23**（`AK2` 入册 / 「键 ≠ 字段」两禁令 / `AG3` 字段层）+ `docs/route-layer.spec.md` **v2.5 §20**（§20.4(d) 真生效四段 / §20.6 键级寻址缺口 / §20.7 下限 fail-closed）。
> 本件所有读数为本单现取；未测项标 `NOT_MEASURED`（**禁填 0 / 禁空**）。
> **占位归零**：本件「双下划线占位模式」计数 = **0**（现取检索式 ⇒ **0**）。
> **硬口径自证**：本单**未**新增 / apply 迁移（迁移数仍 **23**）；**未**在主仓新增任何路由（注册点仍 **69**）；**未**实现任何兑换 / 退还 / 罚没 / `delist` 面（`R-8-17`）；错误码闭集仍 **33**（不动）；**未**碰 `migrations/**`、任何 `docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`、既有 `docs/audit/**`（除本件）；**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未**用 `pkill -f` / `killall`；**未**启停 5787/5788。

---

## §0 开工锚 + 改后全量硬门复跑 + ★ `R-8-20` 升级前后判据数

### 0.1 开工锚（现取）

| 项 | 命令 | 现取读数 |
|---|---|---|
| 仓库 HEAD | `git rev-parse HEAD` | `ef2e798eefeef2303cf29e5b877c6e32d3ff675a` |
| 分支 | `git rev-parse --abbrev-ref HEAD` | `main` |
| 主工作区 `git status --porcelain`（首） | `git status --porcelain` | `M`×3（`backend-ts/scripts/p8-s1-app-config-gate.ts` / `backend-ts/src/currency-service.ts` / `backend-ts/src/database.ts`）+ 未跟踪（`.p4-artifacts/` ×2 / `.p8s1-artifacts/` ×2 / `.p8s2-artifacts/` ×2 / `.p8s3-artifacts/` / 五探针 `p8-s3-00/00b/00c/00d/00e-probe.ts` / `p8-s3-01-effective.ts` / `p8-s3-deposit-gate.ts`） |
| 收口时点 | `date "+%Y-%m-%d %H:%M:%S %Z"` | `2026-10-02 23:29:38 CST` |

### 0.2 改后全量硬门复跑（退出码**管道外**捕获）

> **口径说明**：**四段探针 34/34、判负 `v1`–`v3`、改后硬门全绿** 已由 8③ 实现/收口轮（`§5.192`）成立并经 Zang **亲核** ⇒ 本单**不重做**（硬口径「不重做已完成项」）。本单仅因 **`R-8-20` 改了门脚本**，故对 **`tsc`** 与 **`p8-s3` 门** 做**本单现取**复跑（其余门读数标 `§5.192`）。

| # | 门 | 命令 | 退出码 | 读数 |
|---|---|---|---|---|
| 1 | **类型** | `cd backend-ts && npx tsc --noEmit` | **0**（本单现取） | 输出 **0 字节**（零诊断 · 证明 `R-8-20` 门脚本改动类型干净） |
| 2 | 离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0**（`§5.192` · Zang 亲核） | `total=126 passed=126 failed=0` |
| 3 | `p8-s1` 门 | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | **0**（`§5.192`） | `total=24 passed=24 failed=0` |
| 4 | `p8-s2` 门 | `npx ts-node --transpile-only scripts/p8-s2-fee-rebate-gate.ts` | **0**（`§5.192`） | `total=41 passed=41 failed=0` |
| 5 | **★ 门 `p8-s3`** | `npx ts-node --transpile-only scripts/p8-s3-deposit-gate.ts` | **0**（**本单现取 · `R-8-20` 升级后**） | **`total=45 passed=45 failed=0`**（**新基线** · 产物 `.p8s3-artifacts/p8s3-20261002T152824Z/gate.json`） |
| 6 | 前端构建 | `cd frontend && npm run build` | **0**（`§5.192`） | `✓ built`（未变） |
| 7 | 单测 | `cd frontend && npm run test:unit` | **0**（`§5.192`） | `Test Files 31 passed (31)` · `Tests 276 passed (276)`（未变） |
| 8 | 七门 | `node scripts/<gate>.mjs` ×7 | **全 0**（`§5.192`） | 含 **`p7c` 链路体制 = 真链** |

> 退出码捕获方式（逐字）：`{ <cmd> > <out> 2>&1; echo "EXIT=$?"; }` —— **管道不参与**（禁 `cmd | tail` 吞码）。

### 0.3 ★ `R-8-20` 门判据升级（判据数 **44 → 45**）

**事实（`v4` 暴露的判据盲区）**：门 `p8-s3-deposit-gate` 的**注册点计数判据**原写死 `^app\.(get|post|put|delete|patch)\(`（**要求列 0**）⇒ **任何带缩进插入的路由不被计入**（**它仍是已注册路由！**）⇒ `v4`（挂退还面）只红了 **E4**，**E1/E2 未点亮**。

**升级（`R-8-20` · 本单实装）**：

| # | 面 | 改前（逐字） | 改后（逐字 · 本单实装） |
|---|---|---|---|
| 1 | 路由计数判据（E1 / `readings`） | `/^app\.(get\|post\|put\|delete\|patch)\(/gm` | `/^[ \t]*app\.(get\|post\|put\|patch\|delete)\(/gm`（★ **容忍前置空白**；= 裁定所写 `^\s*` 的**行局部同义形**，避免 `\s` 跨行贪婪吞并空行 ⇒ 计数虚增/错配） |
| 2 | `delist` 探测（E2） | `/^app\.(get\|post\|put\|delete\|patch)\([^)]*delist/mi` | `/^[ \t]*app\.(get\|post\|put\|delete\|patch)\([^)]*delist/mi`（同容忍前置空白） |
| 3 | **★ 新增负对照 E1b** | （无） | 「**以 2 空格缩进插入一条路由 ⇒ 计数必须 +1**」（常态化可判负 · 即把 `v4` 的缺口变成判据） |
| 4 | 判据总数 | **44** | **45**（+E1b） |

**升级后现取读数（主仓 · 基线回绿）**：
- `total=45 passed=45 failed=0`（`.p8s3-artifacts/p8s3-20261002T152824Z/gate.json`）；`readings.registration_points = 69` · `readings.registration_points_legacy_column0 = 69`。
- **E1b（负对照）现取**：`actual = {"upgraded":70,"legacy_column0":69}` —— **升级判据对 2 空格缩进注入 +1（69→70）** ✓；**旧列 0 判据对该注入仍 = 69（同轮反证 = `v4` 盲区复现）** ✓。
- 三式在**主仓** `backend-ts/src/index.ts` 上逐一同读数：`^app\.` = **69** / `^\s*app\.` = **69** / `^[ \t]*app\.` = **69**（升级**不改变**主仓基线读数，仅**扩射程**）。

---

## §1 交付物清单

**代码（本片 8③ 写者范围 · 现取 `git diff --stat`）**：

| 文件 | 改动 | 内容 |
|---|---|---|
| `backend-ts/src/database.ts` | `237 插入 / 89 删除`（3 件合计） | `APP_CONFIG_LEGAL_KEYS` **1→2 键**（`listing_deposit_policy` 入册）+ `:42-50` 注释块**同轮改**（含 **「在册 ≠ 可写」**）+ `LISTING_DEPOSIT_POLICY_FIELD_TYPES = { amount: 'number' }` + `LISTING_DEPOSIT_POLICY_FIELDS` + `parseListingDepositPolicyAmount`（fail-closed 纯函数）+ `LISTING_DEPOSIT_POLICY_KEY` + 只读 `getListingDepositPolicyValue(ex?)` + `listCurrencyWithDeposit` 重构为**单一真源 SQL 常量 + 可选 `SqlRunner`** |
| `backend-ts/src/currency-service.ts` | （同上合计） | `CURRENCY_LIST_DEPOSIT_FLOOR` **降为兜底 + `TODO: Kevin 定值`**（值仍 `50000`）+ `resolveListingDepositFloor` / `resolveListingDepositFloorFromDb`（**先读 `AK2`** · fail-closed）+ `listCurrencyVerb` 取 `depositFloor` 并入 `resolveServerAmount(…, floor, source)`（**客户端永不决定金额**） |
| `backend-ts/scripts/p8-s1-app-config-gate.ts` | `+16` | **既有门同步**：随「清单 1→2 键」更新期望（**非本单改动** · 8③ 实现轮所落） |

**本单（= 最后收口）改动**：`backend-ts/scripts/p8-s3-deposit-gate.ts`（**未跟踪** · `R-8-20` 路由计数判据升级 + 负对照 E1b）· `docs/audit/p8-s3-deposit.md`（**本件**）· `docs/audit/p8-s2-fee-rebate.md`（**③ 攒批**：3 处表述改述 · 见 §8）。

**探针 / 门（未跟踪）**：`p8-s3-deposit-gate.ts`（类级门 · **升级后 45 判据**）· `p8-s3-01-effective.ts`（真生效四段探针 · 34 判据）· 诊断探针 `p8-s3-00-probe.ts` / `p8-s3-00b-probe.ts`（留存）；`p8-s3-00c/00d/00e-probe.ts`（**本单删除** · 见 §8）。

**产物**：`.p8s3-artifacts/p8s3-effective-20261002T152345Z/effective.json`（34/34）· `.p8s3-artifacts/p8s3-20261002T152824Z/gate.json`（45/45 · `R-8-20` 升级后新基线）· 仓外副本 `…/p8s3-falsify/{v0-baseline-rerun,v1..v4}`（四变异判负 · 见 §5）。

---

## §2 ★ 四段真生效逐段读数（`R-8-18` 事务内 `ROLLBACK` · 34/34）

受控夹具 = **现库已出资的正 uid 账户**（`cid=1` 最大余额者）：`uid = 970001` · `balance = 1636071` · `cid = 1`（**无需 mint · 无发明数值** · 判据 `S0-owner-funded`：余额 ≥ `10000 + 50000 + 123456 = 183456` ✓）。run `20261002T152345Z` · **34/34 passed**。四段 = ①写键 → ②库内落值 → ③业务读口取数 → ④行为随之。

| # | 段 | 判据 / 锚点 | 逐段读数（现取） |
|---|---|---|---|
| ③-改前 | 业务读口 | 锚 `src/currency-service.ts:387` `listCurrencyVerb` 取保证金下限 | `raw_ak2 = null` ⇒ **`{floor:50000, source:'constant'}`**（AK2 不在库 ⇒ **fail-closed 到常量**）✓ |
| ① | **写键** | `S1-write-affected-1` / `S1-write-returned-new-value` | `public.app_config` · key `listing_deposit_policy` · `rows_affected=1` · `RETURNING {value_text:"{\"amount\": 123456}", updated_by:"0"}`（**HTTP 写面 = `NOT_MEASURED`** · 键级寻址线格式未冻结） |
| ② | **库内落值** | `S2-value-landed` / `S2-key-set-is-2` / `S2-ak1-untouched` | 列 `key`/`value` ⇒ `{"amount": 123456}`（`time_updated = 2026-10-02 15:23:48.812992+00`）· 顶层键集**恰 2 键** = `["listing_deposit_policy","system_settings"]` · **`AK1`（`system_settings`）值逐字节未动** ✓ |
| ③-改后 | 业务读口 | 同锚 `:387` | `raw_ak2 = {amount:123456}` ⇒ **`{floor:123456, source:'config'}`** ✓ · `S3-parse-no-invention` = `123456`（读侧解析 = 落值，**不隐式转换**） |
| ④-改前 | **行为随之**（消耗额） | 上市 `listing_deposit` **消耗额**（`draft → listed` 同路径 DB 函数 `listCurrencyWithDeposit`，`draft_cid=2100001`） | owner `1636071 → 1576071`（**−60000** = `10000` 上市费 + `50000` 常量保证金）；`uid=−1` `167283 → 227283`（**+60000**）；分录 `−10000/+10000 currency_create_fee` + `−50000/+50000 listing_deposit` ✓ |
| ④-改后 | **行为随之**（消耗额） | 同路径（`draft_cid=2100002`） | owner `1576071 → 1442615`（**−133456** = `10000` + `123456`）；`uid=−1` `227283 → 360739`（**+133456**）；分录 `−10000/+10000` + `−123456/+123456 listing_deposit` ✓ |
| ★ 两读数 | `S4-two-readings-differ` / `-computable` | 改前/改后**必不等**且逐值可算 | `{before:{floor:50000,source:'constant',owner_decrease:'60000'}, after:{floor:123456,source:'config',owner_decrease:'133456'}, delta:'73456', delta_expected:'73456'}` ⇒ **`delta 73456 = 123456 − 50000`** ✓✓ |
| fail-closed 负向 | `S3-illegal-fail-closed` / `S4-fail-closed-behavior` | 写**非法**值（`{"amount":"77777"}` 字符串型） | 读口回 **`{floor:50000, source:'constant'}`** · 行为面消耗回 **`60000`**（= `10000+50000`）⇒ **fail-closed 传到行为**（**不是** fail-open 到坏值 `77777`）✓ |

### 2.5 `R-8-18` 逐字执行与**事务外复取逐字节反证**

- **逐字执行**：四段 + fail-closed 负向段**全部**在**同一个** `withTransaction` 内完成，末尾抛 `RollbackSentinel` ⇒ `withTransaction` 走 `catch` ⇒ **`ROLLBACK`（绝不 `COMMIT`）**：`rollback = {sentinel:"SEG_MAIN", committed:false, sql:"…catch ⇒ ROLLBACK（无 COMMIT）", tx_elapsed_ms:7500}`（`ROLLBACK-no-commit` 判据 `committed===false` ✓）。**零生产 HTTP 写**（两写面逐字登记 `NOT_MEASURED`：`POST /api/admin/settings` 键级寻址线格式未冻结 / `POST /api/currency/:cid/list` 会永久改线上状态 ⇒ 只走事务内同路径 DB 函数）。
- **事务外复取（回滚自证 · 只读）**：

| 面 | 判据 | 现取读数（改前基线 ⇄ 改后复取） |
|---|---|---|
| `app_config` | 行集（key/value/updated_by/time_updated）**逐字节**同基线 | `rows_identical = true` ✓ |
| `currency` | `n` / `max_cid` / 逐行摘要 | `n=15` · `max_cid=36` · `digest=692b67e77b7200cabb3bae49132bcea2` ⇄ 同 ✓ |
| `ledger_entry` | `n` / `max_txid` / 逐行摘要 | `n=355` · `max_txid=366` · `digest=f92c5406c8424ff50994d2ba6de81545` ⇄ 同 ✓ |
| `account` | `n` / 余额·冻结·version 摘要 | `n=39` · `digest=98bcfeea69807ba05961c474caef17a9` ⇄ 同 ✓ |
| `currency_status_log` | `n` / `max_log_id` | `n=7` · `max_log_id=7` ⇄ 同 ✓ |
| 时间戳 | `max(time_updated)` / `max(time_created)` / `max(listed_at)` **未前移** | `ROLLBACK-timestamps-not-advanced` 四项**全 true** ✓ |

> ⇒ **表行 / 计数 / 摘要逐字节不变 + 时间戳未前移** = 回滚自证成立（**写已外泄的反证为空**）。

### 2.6 ★ 自曝：`nextval` **非事务性**（「事务内造数 + `ROLLBACK`」的已知边界）

**事实**：`ROLLBACK` **不回收** `nextval` 消耗 ⇒ 事务内造数虽回滚，**序列计数仍前进**（表行/计数/摘要**逐字节不变**）。本片现取（只读序列）：

| 序列 | 现取 `last_value` | 关联表列 | 前进量 | 解释 |
|---|---|---|---|---|
| `public.ledger_entry_txid_seq` | **378** | `max_txid=366` | **+12** | 3 次同路径上市 × 每条 4 分录 = **12 次 `nextval`**（基线 366 → **378** · 与 effective run 记录一致） |
| `public.currency_status_log_log_id_seq` | **10** | `max_log_id=7` | **+3** | 3 次 `draft` 插入触发的 **3 次 `nextval`**（表列 `max_log_id` 仍 **7**；序列 `last_value=10` ⇒ **缺口 3** = 已耗未落） |
| `public.currency_cid_seq` | **36** | `max_cid=36` | **0（未动）** | 探针**显式给** `cid 2100001/2100002/2100003`（不走序列）⇒ 与 `max_cid=36` **对齐** ⇒ **cid 序列未动** ✓ |

> **登记为「事务内造数 + 回滚」的已知边界**：序列前进是**事务性 `ROLLBACK` 的固有代价**（`nextval` 刻意非事务，保证并发唯一）；**不构成数据泄漏**（无表行 / 无余额 / 无分录落库）。本单**不藏**此代价。

---

## §3 `AK2` 入册（1→2 键）+ `:42-50` 注释同轮改 + `amount: number` 规格 + fail-closed

**入册（现取 `backend-ts/src/database.ts`）**：

| 面 | 现取 | 说明 |
|---|---|---|
| `APP_CONFIG_LEGAL_KEYS` | `['system_settings', 'listing_deposit_policy'] as const`（`:54`） | **清单 1 → 2 键**（`AK2` 入册 · §23.1）· **唯一真源**（实现/测试/探针不得自拟键名） |
| `:42-50` 注释块 | `:42` 写「顶层合法键…**恰好 2 个**」；`:43` 列 `AK2`；`:45` 「★ **「在册」≠「可写」**」；`:49-50` 列 `amount` 规格 | **同轮改**（改前写「恰好 1 个」⇒ 门 A4 判负「不再写『恰好 1 个』」）✓ |
| 键维同步 | `LISTING_DEPOSIT_POLICY_KEY = 'listing_deposit_policy' as const`（`:129`） | 键名字面量单点 |
| ★ 键 ≠ 字段 | `LISTING_DEPOSIT_POLICY_FIELD_TYPES` **并入** `SYSTEM_SETTINGS_FIELD_TYPES`（AK1）**零发生** | 门 A5/A6 判负（`AK1` 仍恰 9 字段 · AK2 不在其内） |

**`amount` 规格（`AG3`(ii) 字段层 · 现取）**：`LISTING_DEPOSIT_POLICY_FIELD_TYPES = { amount: 'number' } as const`（`:102-105`）· `LISTING_DEPOSIT_POLICY_FIELDS = ['amount']`（关闭集 1 个 · `:108`）。

**fail-closed（读侧 · 现取 `parseListingDepositPolicyAmount` `:117-126`）**：合法 = jsonb object **且字段 ⊆ `{amount}` 且 `amount` 为正整数** ⇒ 返 `amount`；**其余一律 `null`**（⇒ 调用方回落常量）。逐形判负：字符串型 `"50000"` / `null` / 数组 / 裸标量 / `0` / `-5` / `1.5` / 缺 `amount` / 夹带清单外字段（`{"balance":…}` §23.8 禁形）**全部 ⇒ `null`** ✓（门 C4–C12）。**不发明数值 · 不隐式转换**。

**`currency-service` 读路径（现取）**：`resolveListingDepositFloor(rawPolicyValue)`（`:158-164` 纯函数：合法 ⇒ `{floor:amount, source:'config'}`；否则 ⇒ `{floor:CURRENCY_LIST_DEPOSIT_FLOOR, source:'constant'}`）+ `resolveListingDepositFloorFromDb()`（`:170-177`：**先读** `DatabaseService.getListingDepositPolicyValue()` · `try/catch` ⇒ 读失败回落常量）+ `listCurrencyVerb`（`:387` 取 `depositFloor` ⇒ `:388` `resolveServerAmount(…, depositFloor.floor, depositFloor.source)`）。**客户端永不决定金额**。

---

## §4 门 `p8-s3-deposit-gate` 判据清单（升级后新基线 = **45/45**）

**门属性**：`offline: true` · `db_connections: 0` · `http_calls: 0`（**零 DB / 零网络 / 零 HTTP** · 只 import 纯函数 + 读源码 / spec 文本）。**判据总 45 = A 8 + B 2 + C 12 + D 8（含自证 1）+ E 8（含 `R-8-20` 新增 E1b）+ F 4 + G 3**。

| 组 | 条目 | 判据 | 现取 |
|---|---|---|---|
| **A · `AK2` 入册**（8） | A1 / A3 | 代码常量键集 == spec 键集（逐字一致） | `["listing_deposit_policy","system_settings"]` ✓ |
| | A2 | spec §21.1 ∪ §23.1 解析键集同冻结 | ✓ |
| | A4 | 注释块同轮改：写「恰好 2 个」· **不再写**「恰好 1 个」 | `{has2:true, has1:false}` ✓ |
| | A5 / A6 | `AK1` 值对象**仍恰 9 字段** · `AK2` **不在** `AK1` 字段集内 | ✓ |
| | A7 / A8 | spec §23.1 有 `AK2` 行 · 姊妹册 §20/§23 互指 | ✓ |
| **B · 键 ≠ 字段**（2） | B1 | AK2 当 AK1 第 10 字段塞写口 body ⇒ **必拒** | `ok=false` · `reason=unknownKey` · `unknown_keys` 含它 ✓ |
| | B2 | 合法 AK1 字段 + AK2 混合体 ⇒ **整请求拒** | `unknown_keys` 恰 `[AK2]` ✓ |
| **C · `AK2` 值规格**（12） | C1 / C2 | 字段规格 `{amount:"number"}` · 关闭集 `["amount"]` | ✓ |
| | C3 | 解析正整数 ⇒ 原样返回（不发明） | `123456` ✓ |
| | C4–C12 | 9 类非法形态 ⇒ `null`（字符串/`null`/数组/裸标量/`0`/`-5`/`1.5`/缺字段/夹带字段） | 9 条全 `null` ✓ |
| **D · fail-closed 有效**（8） | D1–D4 | `null`/缺字段/字符串 ⇒ **回落常量**；合法 ⇒ 用键值 | `{50000,'constant'}` / `{77777,'config'}` ✓ |
| | D5 / D6 / D7 | 常量标 `TODO: Kevin 定值` · 确**先读 `AK2`**（`getListingDepositPolicyValue` + `resolveListingDepositFloorFromDb` + `try/catch`）· 常量 = 50000 | ✓ |
| | D1 自证 | 「常量兜底」误记为 `config` ⇒ 谓词转红 | `judge_fired=true` ✓ |
| **E · 无退还/罚没面**（8） | **E1** | 注册点仍 = **69**（★ `R-8-20` 计数**容忍前置空白**） | `69` ✓ |
| | **★ E1b（`R-8-20` 新增负对照）** | **2 空格缩进插入一条路由 ⇒ 计数必须 +1**；并反证旧列 0 判据不增计 | `{upgraded:70, legacy_column0:69}` ✓ |
| | **E2** | **无** delist 一族路由（容忍前置空白） | `false` ✓ |
| | E3 / E4 / E5 | `listing_deposit_refund` 零命中 · `currency-service` 不引用 `unfreeze(`/`hold_release`/`hold_forfeit` | `[]` ✓ |
| | E6 / E7 | 迁移数仍 23（零新增 DDL）· AK2 读 SQL 只读 SELECT | ✓ |
| **F · `AG2` 不变**（4） | F1 / F2 | 写 `app_config` 语句**唯一**（`database.ts` 1 处 INSERT）且落在 `saveSystemSettings` | `["INSERT INTO public.app_config"]` ✓ |
| | F3 / F4 | AK2 读口落 `database.ts` · 上市语句不触碰 `app_config` | ✓ |
| **G · 门自证**（3） | A1 / C1 / E1 自证 | 清单写「恰 1 键」/ 字段类型写 string / 注册点写 70 ⇒ 谓词**必转红** | 三条 `judge_fired=true` ✓ |

`readings`（现取）：`legal_keys_code=["listing_deposit_policy","system_settings"]` · `ak1_fields=` 9 字段 · `ak2_field_types={amount:"number"}` · `deposit_floor_constant=50000` · `registration_points=69` · `registration_points_legacy_column0=69` · `envelope_fields=["create_key","idempotency_key","idempotencyKey"]`。

---

## §5 ★ 仓外副本四变异判负（逐字红点 `v1`–`v4` · 升级后门）

**副本位置（仓外 · `NOT` 在仓库树内）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p8s3-falsify/<variant>/`（rsync 门所读文件：`backend-ts/{src,scripts,migrations,package.json,tsconfig.json}` + `docs/{data-layer,route-layer}.spec.md`；`node_modules` 软链回仓；Node 的**「双下划线 dirname」**全局常量 ⇒ `REPO_ROOT` = 副本根）。**主仓零写入**。

**基线忠实（`v0-baseline-rerun`）**：`total=45 passed=45 failed=0` ⇒ **副本可复现主仓绿基线** ✓。

| 变异 | 落点（逐字） | 读数 | 逐字红点 |
|---|---|---|---|
| **`v1` 清单退回 1 键** | `database.ts`：`APP_CONFIG_LEGAL_KEYS` → `['system_settings']` | **43/45**（2 红） | `RED A1 actual=["system_settings"]` · `RED A3 actual={"code":["system_settings"],"spec":["listing_deposit_policy","system_settings"]}` |
| **`v2` AK2 当 AK1 第 10 字段** | `database.ts`：`SYSTEM_SETTINGS_FIELD_TYPES` 插入 `listing_deposit_policy:'object'` | **41/45**（4 红） | `RED A5 actual=[listing_deposit_policy,siteName,…]` · `RED A6 actual={"inAk1":true}` · `RED B1 actual={"code":"LEDGER_AMOUNT_INVALID","reason":"SETTING_TYPE_INVALID"}`（**写被拒面失守**：非 `unknownKey`）· `RED B2 actual={}` |
| **`v3` 字符串金额被接受（fail-open）** | `database.ts`：`parseListingDepositPolicyAmount` 严格判 → `Number()` 强转 | **43/45**（2 红） | `RED C4 actual=50000`（`"50000"` 被当数）· `RED D3 actual={"floor":77777,"source":"config"}`（fail-open 到坏值） |
| **★ `v4` 挂退还面（2 空格缩进插入路由）** | `currency-service.ts` 加 `hold_release` 常量；`index.ts` 在 `app.listen(PORT)` **前**插一条 **2 空格缩进**路由 `app.get('/api/currency/:cid/delist-refund', …)` | **41/45**（4 红） | `RED E1 actual=70`（**注册点 69→70 点亮**）· `RED E1b actual={"upgraded":71,"legacy_column0":69}`（**负对照点亮**）· `RED E2 actual=true`（**delist 探测点亮**）· `RED E4 actual=["hold_release"]` |

**★ `R-8-20` 升级射程的意义（`v4` 同轮反证）**：在同一 `v4` 副本上，**旧「列 0」判据**现取读数 = `^app\.` 计数 **69** · delist 探测 **`false`** ⇒ 若沿用**旧门**，`v4` 只红 **E4**（`E1/E2` 假绿 = **盲区**）；**升级后** `E1/E2` **均点亮** ⇒ **盲区同轮收口** ✓✓。

**复原回绿**：变异副本已**整体删除**（`rm -rf …/p8s3-falsify/v1..v4` 及 `v0-baseline-rerun`）；**主仓门复跑 = `45/45`**（`.p8s3-artifacts/p8s3-20261002T152824Z/gate.json`）= **判据真源回退必红、复原即绿** ✓。主仓 `git status` **无副本残留**（见 §8）。

---

## §6 声明（`R-8-17` + `R-8-18` + `R-8-20`）

**`R-8-17`（8③ 射程收缩 · Zang 裁 · 本片严守）**：8③ = **「(a) 金额可配置」**（`AK2` 入册 + 读侧 + fail-closed + 四段）；**(b) 退市退还正式作废**。⇒ 本片**零新增对外路由**（注册点仍 **69**）、**零实现**兑换 / 退还 / 罚没 / `delist` 面；`hold_forfeit` / `hold_release` / `unfreeze` / `listing_deposit_refund` **不得**挂上上市保证金面（门 E2–E5 判负 · `v4` 自证）。上市保证金语义现取 = **上市即消耗、不可退、无罚没**（`DL67`/`DL88`/`R31`）。

**`R-8-18`（本片新裁 · 与 8② `R-8-15` 同族）**：**四段真生效 + fail-closed 负向段全部在同一 `withTransaction` 内完成，末尾抛哨兵 ⇒ `ROLLBACK`（`committed=false`）· 绝不 `COMMIT`**；**零生产 HTTP 写**（两写面逐字登记 `NOT_MEASURED`）。DML 用「事务内同路径 DB 函数 + 事务外复取逐字节反证」取证（§2.5）。

**`R-8-20`（本单新裁 · Zang 裁 · 本片实装）**：`v4` 暴露的不是「实现错误」而是**「判据射程缺口」** —— 「注册点计数」类判据若写死 `^app\.`（**列 0**），则**任何缩进的路由都逃过计数**（**它仍是已注册路由！**）。⇒ **升级门的路由计数判据为容忍前置空白**（`^[ \t]*app\.` = 裁定所写 `^\s*` 的行局部同义形），**并配常态化负对照 E1b「2 空格缩进插入一条路由 ⇒ 计数必须 +1」**；**重跑 `v4` 直至 `E1/E2` 点亮**（§5）。**判据的盲区在同一轮内收口，不留到下轮。**（门判据数 **44 → 45**。）

---

## §7 未测项逐项原因（**禁填 0 / 禁空**）

1. **HTTP 写面 `POST /api/admin/settings`（写 `AK2`）= `NOT_MEASURED`** —— 原因（逐字）：`route-layer.spec §20.6` **键级寻址线格式未冻结**（`AK2` **入册但不可写** · `R-8-19`）⇒ 跑真 POST **无合法键寻址形态**。写键证据由**事务内 DB 直写**（§2 段①）承载。
2. **HTTP `POST /api/currency/:cid/list`（④ 行为面）= `NOT_MEASURED`** —— 原因（逐字）：跑真 POST 会把 `draft` **永久推成 `listed`**（不可逆 · 改线上状态）⇒ 只走**事务内同路径 DB 函数** `DatabaseService.listCurrencyWithDeposit(input, tx)`（与生产 `listCurrencyVerb` **同一份 SQL**）。
3. **退市退还 / 罚没 / 兑换 / `delist` 面 = 不测（`R-8-17` 禁线）** —— 原因：本片**禁实现**该面（射程收缩为 (a)）；其「不存在」由门 E2–E5 的**零命中判据** + `v4` 变异自证承载，**非**「实测为 0」。
4. **`resolveListingDepositFloorFromDb` 的 `catch`（DB 抛错）分支未实测** —— `NOT_MEASURED`，原因：事务内不便**制造 DB 连接 / 查询失败**；本片实测的 fail-closed 路径为「**读不到（`null`）**」与「**值非法**」两条（§2 ③-改前 / fail-closed 负向），**抛错分支**仅由源码 `try/catch`（`:170-177`）静态保证。
5. **`E1b` 负对照是「对注入文本的计数谓词」判负（不真在文件系统插路由）** —— 原因（逐字）：硬口径「**不得在主仓新增路由**」⇒ 门内以**拼接字符串**注入 2 空格缩进路由并复算计数；**真文件插入**由**仓外副本 `v4`** 承载（§5）。
6. **`amount` 的正整数**上界**未逐值实测** —— `NOT_MEASURED`，原因：探针取值只覆盖 `123456` / `77777` / 各非法形态；上界（`Number.MAX_SAFE_INTEGER` 邻域）行为由 `Number.isSafeInteger` 静态保证（`database.ts:124`），**未**逐值取材。
7. **前端面 = 未测** —— `NOT_MEASURED`，原因：本片**零前端改动**（无页面 / 无四语键 / 无路由），不适用。

---

## §8 收尾自证（`git status` / 端口 / 诊断探针删除）

**诊断探针删除（④）**：

| 文件 | 处置 | 现取 |
|---|---|---|
| `backend-ts/scripts/p8-s3-00c-probe.ts` | 删除 | `removed` ✓ |
| `backend-ts/scripts/p8-s3-00d-probe.ts` | 删除 | `removed` ✓ |
| `backend-ts/scripts/p8-s3-00e-probe.ts` | 删除 | `removed` ✓ |
| `p8-s3-00-probe.ts` / `p8-s3-00b-probe.ts` | 留存（未在删除清单内） | 仍在 |

> 另：本单临时只读序列探针 `p8-s3-99-seqtmp.ts`（读三序列 `last_value`）**用后即删**（`rm` · 现取 `git status` 无它）。

**端口 / 进程**：

| 项 | 读数 |
|---|---|
| `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` | **空读数**（退出码 1 · 0 行）✓ |
| 5787 / 5788 | **未碰**（现取仍由外部 PID `30475`（`[::1]:5787`）/ `65096`（`*:5788`）持有） |

**`git status --porcelain`（首 ≠ 尾 对拍）**：

| | 首（开工） | 尾（收尾） | 差 |
|---|---|---|---|
| `M` | ×3（`p8-s1-app-config-gate.ts` / `currency-service.ts` / `database.ts`） | ×**4**（同上 + **`docs/audit/p8-s2-fee-rebate.md`**） | **+1**（本单 **③ 攒批** 改述 3 处） |
| `??` 探针 | `p8-s3-00/00b/00c/00d/00e-probe.ts` + `01-effective` + `deposit-gate` | `p8-s3-00/00b-probe.ts` + `01-effective` + `deposit-gate` | **−3**（**④ 删除 00c/00d/00e**） |
| `??` 本件 | （无） | **`docs/audit/p8-s3-deposit.md`** | **+1**（本件） |
| `??` 产物 | `.p4×2 / .p8s1×2 / .p8s2×2 / .p8s3` | 同 | 0（`.p8s3-artifacts/` 内含本单新 run） |

```text
 M backend-ts/scripts/p8-s1-app-config-gate.ts
 M backend-ts/src/currency-service.ts
 M backend-ts/src/database.ts
 M docs/audit/p8-s2-fee-rebate.md
?? backend-ts/.p4-artifacts/p6tr1a-20261002T151651Z/
?? backend-ts/.p4-artifacts/p6tr1a-20261002T152457Z/
?? backend-ts/.p8s1-artifacts/p8s1-20261002T151647Z/
?? backend-ts/.p8s1-artifacts/p8s1-20261002T152458Z/
?? backend-ts/.p8s2-artifacts/p8s2-gate-20261002T151651Z/
?? backend-ts/.p8s2-artifacts/p8s2-gate-20261002T152458Z/
?? backend-ts/.p8s3-artifacts/
?? backend-ts/scripts/p8-s3-00-probe.ts
?? backend-ts/scripts/p8-s3-00b-probe.ts
?? backend-ts/scripts/p8-s3-01-effective.ts
?? backend-ts/scripts/p8-s3-deposit-gate.ts
?? docs/audit/p8-s3-deposit.md
```

**收尾核对**：**未** `git add/commit/push`；**未** 新增迁移 / apply（迁移数仍 **23**）；**未** 触碰 `migrations/**`、任何 `docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`、既有 `docs/audit/**`（除本件与 §8 登记的单处攒批改述）；**未** 启停 5787/5788；**未** `pkill -f` / `killall`。**`git status` 无副本残留**（无 `falsify` / `delist-refund` / `negsurface`）。

**占位归零自证**：本件「**双下划线占位模式**」计数 = **0**（现取对本文档检索该模式 ⇒ **0**）；全篇**无遗留占位符**（现取检索占位符记号 ⇒ **空**）。

**复原回绿**：主仓门末次复跑 = **`total=45 passed=45 failed=0`**（`.p8s3-artifacts/p8s3-20261002T153104Z/gate.json`）。
