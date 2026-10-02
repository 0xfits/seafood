# 批 8 第五片 8③b 终审质检（**Neng · 独立复跑**）—— `app_config` 键级寻址写面（形态 B）

> **被检代码面** = **`464cfaa`**（`464cfaa03f1eec3725c8da6f4ae9626602831a18` · 本地未推）。
> **质检角色** = **Neng**（独立第三方）。**不采信**交付方 / 派单方任何转引：本件每条读数均为**本单现取**（命令 + 退出码 + 读数逐条给出）。
> **固定副本** = `git worktree add --detach <scratch>/qa8s3b 464cfaa` + `backend-ts/node_modules` / `frontend/node_modules` / `backend-ts/.env.local` **三条软链**（**未读 / 未打印其内容**）。
> **硬口径自证**：**生产库零写**（一切「写」在**同一** `withTransaction` 内 + 末尾哨兵 ⇒ `ROLLBACK`，**无 `COMMIT`**）；**未跑任何 HTTP 写**（`POST /api/admin/settings` / `POST /api/currency/:cid/list` 一次都没跑）；**未**改被检代码（变异只在**仓外副本**且已复原）；**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**启停 5787/5788；**未**写 `app_config` 任何行；本单**只写** `docs/qa/**` 与自己产物。
> **占位归零**：本件「双下划线占位模式」计数 = **0**（回填后现取检索该模式 ⇒ 0）。
> **本单第一优先 = §2 生产库 `app_config` 复原的独立只读复核**（生产数据复原不接受单方自述）。

---

## §0 锚 + 环境（现取）

| 项 | 命令 | 现取读数 |
|---|---|---|
| 钉 rev | `git rev-parse 464cfaa` | `464cfaa03f1eec3725c8da6f4ae9626602831a18` |
| 主工作区 HEAD（质检期） | `git rev-parse HEAD` | `464cfaa03f1eec3725c8da6f4ae9626602831a18` |
| 固定副本 | `git worktree add --detach <scratch>/qa8s3b 464cfaa` | `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa8s3b`（三条软链：`backend-ts/node_modules` / `frontend/node_modules` / `backend-ts/.env.local`） |
| 时点 | `date "+%Y-%m-%d %H:%M:%S %Z"` | 开工 **2026-10-03 07:12 CST** · 收尾 **2026-10-03 07:19 CST** |
| 产物目录 | `backend-ts/.p8s3bqa-artifacts/` | run-tagged `.json` / `.out`（**无 `.log`**） |

**自写探针（本单核心 · 不 import / 不抄交付方 `p8-s3b-*.ts`）**：
- `qa-p8s3b-97-readonly.ts`（自写 · **纯只读**：键集 / 全列逐字 / 触发器清单 / 四表同基线；仅 `SELECT` + `pg_trigger` + `information_schema`）
- `qa-p8s3b-98-address.ts`（自写 · **L4 离线**：形态 A / 多键拒 / `AV1`–`AV5` / `ops:` 派生 / 零新增 reason / `amount` 类型 / 下限 fail-closed；零 DB / 零 HTTP）
- `qa-p8s3b-99-effective.ts`（自写 · **L3 四段真生效** · **Q_AMOUNT = 64200**（自选，刻意避开交付方 `234567`）· 事务内 + 哨兵 ⇒ `ROLLBACK`）

---

## §1 L1 硬门独立复跑（**退出码管道外捕获**）

捕获方式逐字：`{ <cmd> > <out> 2>&1; echo "EXIT=$?"; }` —— **管道不参与**（不 `| tail` 吞码）。全部在**固定副本**内。

| # | 门 | 命令（副本内） | 退出码 | 现取读数 |
|---|---|---|---|---|
| 1 | 类型 | `cd backend-ts && npx tsc --noEmit` | **0** | 输出 **0 字节**（零诊断） |
| 2 | 离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | `total=126 passed=126 failed=0` ✓ |
| 3 | `p8-s1` 门 | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | **0** | `total=24 passed=24 failed=0` ✓ |
| 4 | `p8-s2` 门 | `npx ts-node --transpile-only scripts/p8-s2-fee-rebate-gate.ts` | **0** | `total=41 passed=41 failed=0` ✓ |
| 5 | `p8-s3` 门 | `npx ts-node --transpile-only scripts/p8-s3-deposit-gate.ts` | **0** | `total=45 passed=45 failed=0` ✓ |
| 6 | **★ `p8-s3b` 门** | `npx ts-node --transpile-only scripts/p8-s3b-address-gate.ts` | **0** | **`total=38 passed=38 failed=0`** ✓ |
| 7 | 前端构建 | `cd frontend && npm run build` | **0** | `✓ built in 1.68s`（`index-B-JvDbIk.js` **338.43 kB**） |
| 8 | 单测 | `cd frontend && npm run test:unit` | **0** | `Test Files 31 passed (31)` · `Tests 276 passed (276)` ✓ |
| 9 | **七门** | `cd frontend && node scripts/<gate>.mjs` ×7 | **全 0** | 见下 |

**七门逐门（`EXIT=0` 全部）**：`p4z-i18nviol-global` / `p6-tr2-i18n-locales` / `p4z-miscfix-links` / `p4z-feperf-safelist` / `p7a-03-errmessage-gate` / `p7b-errfallback-gate` / **`p7c-errmsg-machinecode-gate`**。
**`p7c` 逐字读数**：**`链路体制 = 真链`** · `总判：PASS（判负 0 必须 = 0；链=真链 / A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）` ✓

**门 `readings`（现取 · 独立重取非引交付）**：
- `p8-s3b`：`legal_keys=["system_settings","listing_deposit_policy"]` · `reason_constants={unknownKey,typeInvalid,valueNotObject}`（**恰 3 键**）· `ak1_fields` **9 项** · **`registration_points=69`** · `deposit_floor_constant=50000` · `ops_key_forms={formA:"ops:7:setting:system_settings", formB:"ops:7:setting:listing_deposit_policy"}`
- `p8-s3`：`legal_keys_code` = `legal_keys_spec` = 2 键 · `ak2_field_types={"amount":"number"}` · `registration_points=69` · `registration_points_legacy_column0=69`
- `p8-s2`：`registration_points=69` · `registration_by_verb={get:28,post:38,put:0,patch:1,delete:2}`

⇒ **L1 全绿，与交付方声明一致（此处为现取复跑，非采信）。**

---

## §2 L2 ★★ 生产库 `app_config` 复原的独立只读复核（**本单第一优先**）

**方法**：自写**纯只读**探针 `qa-p8s3b-97-readonly.ts`（仅 `SELECT` / `pg_trigger` / `information_schema`；**无任何 DML / DDL / HTTP**）现取。**两跑**（开工 `qa-readonly.out` 与收尾 `qa-readonly-final.out`）均 **12/12**。

| 判据 | 现取读数 | 判 |
|---|---|---|
| 键集恰 `{system_settings}` | `["system_settings"]`（`n=1`） | ✓ |
| `listing_deposit_policy` 不存在 | `absent=true` | ✓ |
| `system_settings.value` **逐字** | `{"siteName": "p4b2c:siteA", "maintenance": false, "maxDailyTasks": 10, "pointsPerTask": 100, "rewardCooldown": 24, "defaultLanguage": "zh", "siteDescription": "去中心化社区奖励平台", "allowRegistration": true, "emailNotifications": true}`（逐字节 == 基线） | ✓ |
| `system_settings.updated_by` **逐字** | `1` | ✓ |
| `system_settings.time_updated` **== 基线** | **`2026-10-02 14:14:07.502017+00`**（== 基线；**漂移已复原**） | ✓✓ |
| 触发器清单恰 **2 枚** · 均 `BEFORE UPDATE` · **无 INSERT / DELETE 事件** | `trg_app_config_key_immutable`（`BEFORE`/`UPDATE`/`platform_config_key_immutable`）· `trg_app_config_touch_updated`（`BEFORE`/`UPDATE`/`platform_config_touch_updated`）· 二者 `ev_insert=null` / `ev_delete=null` / `ev_truncate=null` · `tgenabled='O'` | ✓ |
| `currency` 行数与摘要同基线 | `n=15` · `max_cid=36` · `digest=692b67e77b7200cabb3bae49132bcea2` | ✓ |
| `ledger_entry` 行数与摘要同基线 | `n=355` · `max_txid=366` · `digest=f92c5406c8424ff50994d2ba6de81545` | ✓ |
| `account` 行数与摘要同基线 | `n=39` · `digest=98bcfeea69807ba05961c474caef17a9` | ✓ |
| `currency_status_log` 行数与摘要同基线 | `n=7` · `max_log_id=7` | ✓ |

**附带现取（核对报告口径）**：
- `app_config` 列清单 = `key text` / `value jsonb` / `updated_by bigint` / `time_updated timestamptz DEFAULT now()` —— **无 `time_created` 列**（交付报告 §2.1 该项口径**成立**）。
- `schema_version` = **`0024`**。

**⇒ L2 判定：`app_config` 复原 = 逐字节同基线（含 `time_updated`）· 键集恰 1 键 · 触发器恰 2 枚均 `BEFORE UPDATE`（`DELETE` 未被禁的前提**成立**）· 四表行数 + 摘要同基线 —— **生产数据复原经独立只读复核 = 成立**（非采信交付方自述）。**

---

## §3 L3 四段真生效独立重取（**自写探针** · 自选金额 `64200` · 事务内 `ROLLBACK`）

`qa-p8s3b-99-effective.ts` · **27/27 全绿** · 全部在同一 `withTransaction` 内 · 末尾抛哨兵 `SEG4` ⇒ `ROLLBACK`。夹具 = 现库最大余额正 uid 账户（`uid=970001` · `cid=1` · 基线 `balance=1636071`）。

| 段 | 判据 | 现取读数 |
|---|---|---|
| ③-改前 | 事务外只读读口 + 事务内同锚 | `{floor:50000, source:"constant"}`（AK2 不在库 ⇒ fail-closed 到常量）✓ |
| ① 写 | 事务内 DB 直写 `app_config`（**HTTP 写面 = NOT_MEASURED**） | `INSERT … ON CONFLICT(key) DO UPDATE`（无异常）· `L3-①-write-returned=true` ✓ |
| ② 库内落值 | `L3-②-landed-eq-new`（**「写成功但库值未变 ⇒ 判负」**）/ `L3-②-keys-2` | 落值 `{"amount": 64200}` · 顶层键集恰 2 键 `["listing_deposit_policy","system_settings"]` ✓ |
| L4 · DB 回归 | `L4-DB-formA-target-untouched` | 写 AK2 后 `system_settings.time_updated` **逐字未变**（形态 A 目标行不被连累）✓ |
| ③-改后 | 业务读口（`currency-service.ts:387-388` → `database.ts:2038`） | `raw_ak2={amount:64200}` ⇒ **`{floor:64200, source:"config"}`** ✓ · `parse = 64200`（不隐式转换） |
| ④-改前 | **行为随之**（事务内 `DatabaseService.listCurrencyWithDeposit(input, tx)` 同路径） | owner `uid=970001` `owner_decrease = 60000`（**= 上市费 10000 + 常量 50000**）· `uid=-1` `pool_increase = +60000` · 分录 `listing_deposit = ["-1:50000","970001:-50000"]` ✓ |
| ④-改后 | 同路径 | owner `owner_decrease = 74200`（**= 10000 + 64200**）· `uid=-1` `pool_increase = +74200` · 分录 `= ["-1:64200","970001:-64200"]` ✓ |
| ★ 两读数 | `L3-④-two-readings-differ` / `-delta-computable` | `{before:{floor:50000,owner_decrease:"60000"}, after:{floor:64200,owner_decrease:"74200"}, delta:"14200", delta_expected:"14200"}` ⇒ **`delta 14200 = 64200 − 50000`** ✓✓ |
| fail-closed 负向 | `L3-④-fail-closed-behavior` | 写**非法**（字符串金额 `{"amount":"64200"}`）⇒ 读口回 `{floor:50000, source:"constant"}` · 行为面消耗回 **`60000`**（**不是** fail-open 到 64200）✓ |
| `ROLLBACK` 自证 | `L3-rollback-no-commit` | `rollback = {tag:"SEG4", committed:false}` ✓ |
| 每段**判负自证** | `L3-②-landed-eq-new-自证后缀` / `L3-③-uses-config-自证后缀` / `L3-④-two-readings-differ-自证后缀` | 谓词喂错值 3/3 `fired=true`（**非假门**）✓ |

**★ 事务外复取反证（逐字节 · 含时间戳）**：

| 面 | 判据 | 基线 ⇄ 回滚后 |
|---|---|---|
| `app_config` | 行集（key/value/updated_by/time_updated）**逐字节**同基线 | 同 ✓（`L3-post-app_config-byte-identical`） |
| `currency` | `n` / `max_cid` / 逐行摘要 | `15/36/692b67…` ⇄ 同 ✓ |
| `ledger_entry` | `n` / `max_txid` / 逐行摘要 | `355/366/f92c54…` ⇄ 同 ✓ |
| `account` | `n` / 余额·冻结·version 摘要 | `39/98bcfee…` ⇄ 同 ✓ |
| `currency_status_log` | `n` / `max_log_id` | `7/7` ⇄ 同 ✓ |
| 时间戳 | `max(time_updated)` / `max(time_created)` / `max(listed_at)` **未前移** | 全 true ✓ |

> **判定**：四段真生效**成立** —— 写 → 库内落值 → 业务读口 → 行为（消耗额）**delta 逐值可算**；非法值 fail-closed **传到行为**；事务外**逐字节**（含时间戳）反证为空。

---

## §4 L4 键级寻址面独立核（自写 `qa-p8s3b-98-address.ts` · 离线 · **29/29**）

| 组 | 判据（本单 id） | 现取读数 |
|---|---|---|
| 形态 A 回归 | `L4-A-formA-ok` / `-unknown-field` / `-discriminant-false` / `-control-field-stripped` | `{maintenance:true}` 原样透传；未知字段拒 + `legal_keys` = **9 字段** + `unknown_keys=["foo"]`；判别式对裸值对象 = `false`；`create_key` 控制字段被剥离 ✓ |
| 多键拒 | `L4-multikey-envelope-extra` / `-top-double` / `-array` | 信封多余属性 ⇒ `unknownKey` + `unknown_keys=["key2"]`；顶层双键 ⇒ 两键皆未知 ⇒ 整请求拒；数组体 ⇒ `SETTING_VALUE_NOT_OBJECT` ✓ |
| `AV1`–`AV5` 逐层 | `L4-AV1-key`（`legal_keys` **恰 2 键**）/ `-legal` / `L4-AV2-field-closed`（`legal_keys=["amount"]` · 键 ≠ 字段）/ `L4-AV3-type`（`expected='number'`/`got='string'`）/ `L4-AV4-domain`（`0/-5/1.5` 皆 `expected='positive_integer'`）/ `-legal` / `L4-AV5-container-check`（`app_config_value_is_container` ⇒ `SETTING_VALUE_NOT_OBJECT` · 禁裸 500） | 全 ✓（**分层证据 = `details.legal_keys` 逐层不同**：`AV1` 2 键 / `AV2` `["amount"]`） |
| `ops:` 派生 | `L4-ops-formA-literal` = `ops:7:setting:system_settings`（**逐字不变**）· `-formB-derived` = `ops:7:setting:listing_deposit_policy` · `-namespaces-disjoint` · `-fourth-arg`（源码第 4 实参 = `targetKey`）· `-order-AV1-before-ops` | 全 ✓ |
| 零新增 reason | `L4-reason-zero-new` | `SETTINGS_WRITE_REASONS` 现取仍 **3 常量** ✓ |
| `amount` 类型 | `L4-amount-type-number` | `LISTING_DEPOSIT_POLICY_FIELD_TYPES = { amount: 'number' }` ✓ |
| 下限 fail-closed | `L4-floor-null-constant` / `-illegal-fail-closed` / `-legal-config` / `-todo-present` | `null` ⇒ 常量；`{amount:"64200"}` ⇒ 常量（**fail-closed**）；`{amount:64200}` ⇒ `config`；`TODO: Kevin 定值` 在场 ✓ |
| 负对照 | 4 条「自证后缀」条目 | 谓词喂错值 4/4 转红 ✓ |

> **判定**：形态 B 为形态 A 的**纯增量**；键级寻址线格式 / 多键拒 / `AV1`–`AV5` 分层 / `ops:` 按 key 派生 / 零新增 reason / 下限 fail-closed —— **全在场且逐层可判负**。

---

## §5 L5 门与变异（**仓外副本** · 主仓零写入）

**副本** = `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa8s3b-falsify/base`（**仓外** · `rsync` 自固定副本 · `node_modules` / `.env.local` 软链）。**主仓树外**。

| 步 | 动作 | 现取读数 |
|---|---|---|
| 0 | 副本**基线**先跑（证忠实） | `EXIT=0` · **`total=38 passed=38 failed=0`** ⇒ 副本忠实 ✓ |
| 1 | 变异 **MUT1**（`src/index.ts` 破坏形态 A：`screenSystemSettingsWrite(body)` 改直传） | **`A1` 红**：`actual={"screen":false,"save":true,"msg":true}` |
| 2 | 变异 **MUT2**（`src/index.ts` `ops:` 回写死常量：第 4 实参 `targetKey` ⇒ `SYSTEM_SETTINGS_KEY`） | **`D1` 红**：`actual={"line":"…'setting', SYSTEM_SETTINGS_KEY); // MUT2…","fourth_arg":"SYSTEM_SETTINGS_KEY"}` |
| 3 | 变异 **MUT3**（`src/currency-service.ts` 下限 **fail-open**：常量回落改为读 `raw.amount`） | **`F3` 红**：`actual={"floor":"77777","source":"constant"}`（应 `{floor:50000,source:'constant'}`） |
| 4 | 三变异合计 | **`EXIT=1` · `total=38 passed=35 failed=3`**（**`A1` / `D1` / `F3` 逐字红**）✓ |
| 5 | 本单**自写探针**在变异副本上另跑（独立判据强度） | **`EXIT=1` · 27/29** · 红点 `L4-ops-fourth-arg`（= `SYSTEM_SETTINGS_KEY`）· `L4-floor-illegal-fail-closed`（`{floor:"64200",source:"constant"}`）✓ |
| 6 | **复原回绿** | 拷回副本 `src/index.ts` / `src/currency-service.ts` ⇒ 门 **`EXIT=0` · 38/38**；`cmp` 副本 ⇄ 固定副本 **逐字节相同（SAME ×2）** ⇒ **主仓零写入** ✓ |

> **判定**：本单**三处**变异（≥两处要求）下门**必红**（逐字红读数已列），**复原回绿**；本单自写探针**独立复现**两处红 ⇒ 判据非假门。

---

## §6 L6 报告 `docs/audit/p8-s3b-write-path.md` 抽 5 条对拍 + 面核

| 项 | 命令 | 现取读数 |
|---|---|---|
| 行数 | `wc -l docs/audit/p8-s3b-write-path.md` | **290** ✓ |
| 体积 | `ls -la` | **29717 字节**（≈ **29.0 KiB** / 十进制 **29.7 KB** ⇒ 「29.7 KB 级」口径成立）✓ |
| 占位（双下划线占位模式） | `grep -c` 该模式 | **0** ✓ |

**抽 5 条读数对拍（报告 ⇄ 我的独立读数）**：

| # | 报告条目 | 报告值 | 对拍对象（本单现取） | 判 |
|---|---|---|---|---|
| 1 | §2.2 / §3.2 `time_updated` 基线 | `2026-10-02 14:14:07.502017+00` | 我的只读探针 `qa-p8s3b-97` | 同字 ✓ |
| 2 | §3.2 `currency` 摘要 | `15 / 36 / 692b67e77b7200cabb3bae49132bcea2` | 同上 | 同字 ✓ |
| 3 | §3.2 `ledger_entry` 摘要 | `355 / 366 / f92c5406c8424ff50994d2ba6de81545` | 同上 | 同字 ✓ |
| 4 | §8 `readings` `ops_key_forms` + `registration_points=69` | `{formA:"ops:7:setting:system_settings", formB:"ops:7:setting:listing_deposit_policy"}` · 69 | 我的 `p8-s3b` 门复跑 | 同字 ✓ |
| 5 | §3 ④ 夹具 owner / ④-改前消耗 | `uid 970001` · `owner_decrease=60000` | 我的四段探针 ④ 段 | `uid=970001` · `60000` ✓ |

**面核（逐条现取）**：

| 判据 | 命令 / 位置 | 现取 | 判 |
|---|---|---|---|
| **注册点仍 69** | 我复算 `^[ \t]*app\.(get\|post\|put\|patch\|delete)\(` 于 `src/index.ts` | **69**（门 `readings.registration_points=69` 同） | ✓ |
| **迁移仍 23** | `ls backend-ts/migrations/*.sql \| wc -l` | **23** | ✓ |
| **错误码闭集仍 33 未动** | 我复算 `LEDGER_ERROR_TABLE` 键数（`src/ledger-errors.ts`） | **33** · 注释逐字「§14.1 关闭集 33 不动」 | ✓ |
| **类级：无退还 / 罚没 / `delist` 面** | 自算（**去注释**口径）：`listing_deposit_refund`（全 `src`）= **0** · `hold_release` / `unfreeze(` / `hold_forfeit`（`currency-service`）= **0** · 同三面 + `listing_deposit_refund`（本片两件 `index.ts` / `database.ts`）= **0** · `delist` 路由探测 = **0** | 全 0 | ✓ |
| **`TODO: Kevin 定值` 在场** | `currency-service.ts:148` | `export const CURRENCY_LIST_DEPOSIT_FLOOR = 50000; // TODO: Kevin 定值…` | ✓ |
| **`amount: 'number'` 在场** | `database.ts:112` | `amount: 'number',`（`LISTING_DEPOSIT_POLICY_FIELD_TYPES`） | ✓ |

> **作用域声明（类级「无退还/罚没面」）**：判据口径 = **去注释的代码面 + 上市保证金面**（`currency-service` + 本片两件）；**不得**读成「全域字面 0 命中」（`ledger.ts` 的既有 `kind` 枚举内可能有历史文本）。且本面「不存在」由**零命中判据 + §5 副本变异自证**承载，**非**运行时实测计数。

⇒ **报告读数与产物/盘面逐字一致，无虚报；面核逐条在场。**

---

## §7 L7 未验证清单 + verdict（**逐项原因 · 禁填 0 / 禁空**）

**未验证 / 未实测项（逐项原因）**：

1. **HTTP `POST /api/currency/:cid/list`（④ 行为面真 HTTP）= `NOT_MEASURED`** —— 原因：跑真 POST 会把 `draft` **永久推成 `listed`（不可逆）**；本单只走**事务内同路径 DB 函数**（`DatabaseService.listCurrencyWithDeposit`，与生产同一份 SQL）。**本单一次未跑**。
2. **HTTP `POST /api/admin/settings`（写面真 HTTP）= `NOT_MEASURED`** —— 原因：**本单硬禁任何生产 HTTP 写**；且上一轮真 HTTP 写曾触发 `app_config` `BEFORE UPDATE` 触发器致**时间戳漂移**（已复原，见 §2）。写证据由**事务内 DB 直写**（§3 段①）承载。
3. **`AV5` 容器硬约束的真 HTTP 端到端 = `NOT_MEASURED`** —— 原因：应用层闸（`AV1`–`AV4`）**先拦**，须绕过应用层方可抵达 `app_config_value_is_container`；本单只证兜底**在场**（§4 `L4-AV5-container-check`）。
4. **受控实例 5796/5797 = 未启（`NOT_MEASURED`）** —— 原因：本片面可全部离线 / 事务内验证，无 HTTP 面需起实例；`lsof 5796-5799` 全程空读（见 §8）。
5. **Playwright `test:e2e` / `components` / `performance` / `accessibility` = `NOT_MEASURED`** —— 原因：需浏览器 + 起服务；本单硬口径 = 仅 `build` + `test:unit` + 四新门 + 七门。
6. **`amount` 上界（`Number.MAX_SAFE_INTEGER` 邻域）= `NOT_MEASURED`** —— 原因：探针取值只覆盖 `64200` 与各非法形态；上界由 `Number.isSafeInteger` 静态保证（`parseListingDepositPolicyAmount`）。
7. **交付方探针 `p8-s3b-01-effective.ts` = 未跑**（**刻意**）—— 原因：本单要求**自写探针**独立重取，不采信交付方读数；其产物仅用于 §6 对拍。
8. **线上（生产 Vercel）终验读数 = `NOT_MEASURED`** —— 原因：本单禁 `git push` ⇒ 无线上读数。

**verdict**：

- **L1 硬门**：`tsc 0` / 离线 **126/126** / `p8-s1 24/24` / `p8-s2 41/41` / `p8-s3 45/45` / **`p8-s3b 38/38`** / `build 0` / `test:unit 31 files·276 passed` / **七门全 0（`p7c` 真链）** ⇒ **全绿** ✓
- **L2 生产库复原**：只读现取 —— 键集恰 `{system_settings}` · **`time_updated` == 基线 `2026-10-02 14:14:07.502017+00`** · 触发器恰 2 枚均 `BEFORE UPDATE`（无 INSERT/DELETE）· 四表行数 + 摘要同基线 ⇒ **复原经独立复核 = 成立** ✓✓（本单第一优先）
- **L3 四段真生效**：自写探针 **27/27**；改前 `{50000,constant}` 消耗 60000 ⇄ 改后 `{64200,config}` 消耗 74200，**delta 14200 逐值可算**；owner ↓ + `uid=−1` ↑ 守恒；fail-closed 负向 ✓；**事务外逐字节（含时间戳）反证** ✓ ⇒ **成立**
- **L4 键级寻址面**：自写探针 **29/29**；形态 A 逐字兼容 · 多键拒 · `AV1`–`AV5` 分层（`details.legal_keys`）· `ops:` 按 key 派生 · 零新增 reason（3）· `amount` 类型 · 下限 fail-closed ⇒ **成立**
- **L5 门与变异**：三处变异（`ops:` 写死 / 下限 fail-open / 破形态 A）⇒ **`EXIT=1` / 35/38**（`A1`/`D1`/`F3` 逐字红）；复原 **38/38**；主仓零写入 ⇒ **成立**
- **L6 报告与面核**：290 行 / 29717 字节 / 占位 0 / 抽 5 条逐字对拍 · 注册点 69 · 迁移 23 · 错误码 33 · 类级零命中（作用域已声明）· `TODO` · `amount:'number'` ⇒ **成立**
- **L7 未验证清单**：8 条（上）**均已逐项给原因**（无填 0 / 无空）。
- **总 verdict**：**8③b 独立终审质检 = 通过（PASS）**。所有硬门与四段真生效读数**由本单现取独立复现**，与交付方声明一致；**生产数据复原经独立只读复核成立**（`app_config` 逐字节含时间戳同基线，四表同基线）；**生产库零写外泄**。

---

## §8 收尾自证（blob 对拍 + 端口空 + 首尾 `git status`）

**① 固定副本逐文件 blob 对拍（现取）**：`git ls-files` = **2445** 项；其中**普通文件 2444** 项 —— 逐文件 `git hash-object <f>` ⇄ `git rev-parse 464cfaa:<f>` ⇒ **0 MISMATCH**；余 **1** 项为**符号链接条目**（随 commit 记录的 `120000` 条目）。`git status --porcelain | grep -v '^??'` = **0 行** ⇒ **被检代码面零改动**（我在副本内只**新增**自写探针，未触碰任何被跟踪文件）。

关键文件 blob（= `git rev-parse 464cfaa:<path>`，与副本 `hash-object` 逐字相同）：`backend-ts/src/database.ts` / `src/index.ts` / `src/currency-service.ts` / `src/admin-service.ts` / `scripts/p8-s3b-address-gate.ts` / `scripts/p8-s3b-01-effective.ts` / `docs/audit/p8-s3b-write-path.md` —— **全 OK**。

**② 副本回收**：`git worktree remove --force <scratch>/qa8s3b` ⇒ removed；`rm -rf <scratch>/qa8s3b-falsify` ⇒ removed。

**③ 端口 / 进程**：

| 项 | 命令 | 现取 |
|---|---|---|
| 受控端口 | `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` | **空读数**（退出码 **1** · 0 行）✓（本单**未启实例**） |
| 5787 / 5788 | `lsof -nP -iTCP:5787,5788 -sTCP:LISTEN` | **未碰**（现取仍由外部 PID `30475`（`[::1]:5787`）/ `65096`（`*:5788`）持有）✓ |

**④ `git status --porcelain`（主工作区 · 首 ⇄ 尾）**：

| | 首（开工 07:12） | 尾（收尾 07:19） |
|---|---|---|
| 读数 | **working tree clean**（`nothing to commit`） | `M docs/data-layer.spec.md` · `M docs/route-layer.spec.md` · `?? docs/audit/data-layer-v0.14-delta.md` · `?? docs/audit/route-layer-v2.7-delta.md` · `?? docs/versions/data-layer.spec.v0.14.md` · `?? docs/versions/route-layer.spec.v2.7.md` · `?? docs/qa/p8-s3b-write-path-review.md` |

> **★ 归因（现取证据）**：尾部新增的 `data-layer.spec.md` / `route-layer.spec.md` 修改 + `v0.14` / `v2.7` 快照与 delta **非本单所为** —— 其 `mtime` = **07:17:00–07:17:59**（本单运行期），系**另一并发会话**（规范线，`docs/*.spec.md` / `versions/**` / delta）所改；本单**只读** `docs/*.spec.md` / `versions/**` / 既有 `audit/**`、**未碰**。**本单唯一 footprint = `?? docs/qa/p8-s3b-write-path-review.md`**（`mtime` 07:12:48）+ 产物 `backend-ts/.p8s3bqa-artifacts/`。**HEAD 全程 = `464cfaa`（未移动）；未 `git add/commit/push`。**

⇒ 本单**未**改被检代码 / 规范册 / `master-plan` / `versions/**` / 既有 `docs/audit/**`（只读）；**未**启停 5787/5788；**未** `pkill -f` / `killall`；**未**任何生产库写。

---

## §9 产物清单（`backend-ts/.p8s3bqa-artifacts/` · run-tagged · **无 `.log`**）

| 文件 | 内容 |
|---|---|
| `qa-readonly.out` · `qa-readonly-final.out` · `qa-p8s3b-97-readonly.json` | 自写只读探针（开工 + 收尾）· **12/12 × 2** |
| `qa-p8s3b-98-address.json` · `qa-address.out` | 自写 L4 离线探针 **29/29** |
| `qa-p8s3b-99-effective.json` · `qa-effective.out` | 自写 L3 四段探针 **27/27**（含 `L3-rollback-no-commit` / 事务外复取） |
| `qa-tsc.out`（0 字节）· `qa-offline.out` · `qa-p8-s1-app-config-gate.out` · `qa-p8-s2-fee-rebate-gate.out` · `qa-p8-s3-deposit-gate.out` · `qa-p8-s3b-address-gate.out` | L1 硬门输出 |
| `qa-fe-build.out` · `qa-fe-testunit.out` | 前端 `build` / `test:unit` 输出 |
| `qa-sevengate-<gate>.out` ×7 | 七门逐门输出 |
| `qa-l5-baseline.out` · `qa-l5-mutated.out` · `qa-l5-restored.out` · `qa-l5-mutated-myprobe.out` | L5 仓外副本四步（基线 38/38 · 变异红 35/38 · 复原 38/38 · 自写探针变异红 27/29） |
| `probes/qa-p8s3b-97-readonly.source.txt` · `qa-p8s3b-98-address.source.txt` · `qa-p8s3b-99-effective.source.txt` | 自写探针源码快照（`.txt`） |

**`find <ART> -name '*.log' | wc -l` = 0** ✓（无 `.log` 后缀）。
