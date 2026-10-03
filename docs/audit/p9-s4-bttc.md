# P9④ · BTTC（`battcoin`）铸造 / 分解 —— 收尾报告（`p9-s4-bttc`）

- **单号**：P9④【最后收尾单】（角色 **Kong** · 实现/收尾）
- **仓**：`/Users/kevin/bistro/seafood`（HEAD = `7ad9670` · 本单**不 push / 不 commit**）
- **硬口径**：本单**不 apply** 任何迁移 · **不改 `src/**` 逻辑** · 错误码闭集 **33 不动** · 库面写一律**事务内 + ROLLBACK** · 受控实例**只用 5796/5797** · 精确 PID `kill -TERM`（禁 `pkill -f` / `killall`）· 不碰 5787/5788。
- **读数来源标注**：`[实跑]` = 本单亲自运行并落产物；`[上位已核]` = 上位单（Zang）亲核、本单**不重做**；`[产物]` = 既有 run-tagged 产物现值。

---

## §0 结论速览

| 项 | 读数 | 来源 |
|---|---|---|
| `p8-s7` 带受控实例（5797） | `total=58 passed=58 failed=0` · `pending_apply=0` · `db=7` · `http=9` | `[实跑]` `.p8s7-artifacts/p8s7-20261003T052659Z/gate.json` |
| `p8-s7` 离线（无实例） | `total=58 passed=55 failed=3` · 红 = `G8/G9/G10`（HTTP 腿 · 环境差异，沿 `R-9-26`，**不放宽判据 / 不标 SKIPPED**） | `[实跑]` `.p8s7-artifacts/p8s7-20261003T052610Z/gate.json` |
| `p8-s8` 带受控实例（5797） | `total=92 passed=92 failed=0` · `pending_apply=0` · `db=13` · `http=11` | `[实跑]` `.p8s8-artifacts/p8s8-20261003T052709Z/gate.json` |
| `p8-s8` 离线（无实例） | `total=92 passed=89 failed=3` · 红 = `H5/H6/H7`（HTTP 腿 · 环境差异） | `[实跑]` `.p8s8-artifacts/p8s8-20261003T052620Z/gate.json` |
| `p8-s9`（本片 BTTC 门） | `total=71 passed=71 failed=0` · `pending_apply=10` · `db=5` · `http=0`（本门零网络） | `[上位已核]` `.p8s9-artifacts/p8s9-20261003T052320Z/gate.json` |
| 三迁移真跑四项读数（`0032/0033/0034`） | 各 **4/4 绿**（无错 · 回滚后新对象不在 · `schema_migration` 无新行 · 目标对象复原） | `[实跑]` `.p9s4-artifacts/mig-realrun-20261003T062145Z.json` |
| 判负三点 | `M1 ⇒ F1` · `M2 ⇒ E1` · `M3 ⇒ D4`（各 1 fail） | `[产物]` `.p9s4-negctl/.../.p8s9-artifacts/{052145,052151,052156}Z/gate.json` |
| 副本基线 / 复原 | `71/71` · `71/71` | `[产物]` 同目录 `{052120,052203}Z/gate.json` |
| 主仓 `cmp` 副本 | 8 文件**逐字节 SAME** | `[实跑]` |
| 受控实例收尾 | 精确 PID `5616` `kill -TERM` ⇒ 已回收；`5796–5799` LISTEN **空**；用户 `5787/5788`（pid 30475 / 65096）**未碰** | `[实跑]` |
| 上位单已核（不重做） | 端口空 · `注册点现取=87` · `tsc=0` · 离线 `126/126` · `s1..s6` 现值未掉 · 前端 build `0` · `test:unit` `31 files / 276` | `[上位已核]` |

> **一句话结论**：P9④（BTTC 铸造/分解）静态面 + 库面只读面 + 受控实例 HTTP 面**三处齐绿**；三条迁移**真跑可逆**；两条通用判据（`C-15` / `R-9-23`）**真读数**；判负三点**逐点必红**；**未 apply** 的库面效果**如实挂在 `pending_apply`（10 项）**，**不伪装绿**。

---

## §1 三迁移结构面 + 各迁移真跑四项读数

### §1.1 `0032_kind_close_set_23.sql` —— kind 闭集 `21 → 23`（三处编码）
- **手法**：`0032:59` `ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS ledger_kind_enum;` + `0032:61` `ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (…23 值…));`（**CHECK 重建、非 enum**，沿 `0003` 手法）。
- **三处编码（穷举）**：
  - ① **DB CHECK** `ledger_kind_enum`（`0032:61`）= **23 值**（既有 21 逐字前 21 位 + 末位追加 `bttc_mint_fee` / `bttc_burn_fee`）；
  - ② **DB 函数** `ledger_kind_ok` 第一支（`0032:76`）= **23 值**（同集）；
  - ③ **TS 常量** `LEDGER_KINDS`（`src/ledger.ts`）= **23 值**（末位追加两值，既有 21 次序不动）。
- **冻结族第二支** `p_frozen_settle`（`ledger_kind_ok` 第二支）= **4 值**（`hold_forfeit/job_payout/purchase/trade`）**一字不动**，**不含**任何新增值。
- **`−1` credit 白名单** `ledger_assert_platform_mutation`：既有 6 值 → **8 值**（追加 `bttc_mint_fee` / `bttc_burn_fee`，既有格逐字未丢）。
- **穷举扫面结论**：代码面「全闭集编码（≥21 值）」**恰四处** = `0028` CHECK / `0029` 函数 / `0032`（CHECK+函数）/ `src/ledger.ts` ⇒ **无未登记全闭集编码**。

### §1.2 `0033_currency_platform_coin_flag.sql` —— `ADD COLUMN` + 豁免谓词
- **唯一 DDL**：`0033:24-25` `ALTER TABLE public.currency ADD COLUMN IF NOT EXISTS is_platform_coin boolean NOT NULL DEFAULT false;`（**只加列**：零 `ALTER COLUMN` / 零 `DROP CONSTRAINT`；既有 1 UNIQUE + 6 CHECK 指纹不动 · `DL7`）。
- **存量兼容**：既有全部行 `is_platform_coin = false`（`ADD COLUMN … DEFAULT false`）；`0033` 自检 `count(*) … WHERE is_platform_coin` 且 `v_true <> 0 ⇒ ABORT`。
- **豁免谓词（落唯一写路径）**：改 `src/database.ts` 上市审核闸 SQL ⇒ `AND ( EXISTS ( SELECT 1 FROM public.currency_review_log … result = 'approved' ) OR c.is_platform_coin = true )`（既有审核闸逐字仍在，**豁免 = 加谓词**）。
- **保证金腿对平台行跳过**：`AND NOT (c.is_platform_coin = true AND $3::bigint <> 0)`（非平台行**仍全额缴** · C-1）。

### §1.3 `0034_ledger_op_burn_and_supply.sql` —— `op` 加 `burn` + 分解 `total_supply` 双写
- **`op` 白名单**：`v_op NOT IN ('mint','transfer','hold','hold_release','settle','entries')` ⇒ **末位追加 `'burn'`**（原 6 项**逐字照抄**）。
- **`v_op='burn'` 分支**：本体腿 = **单边负额** `ledger_norm_entry(v_uid, v_cid, -v_amount, 0, 'burn', …)`（真销毁）。
- **`total_supply` 双写（`R-9-37`）**：`UPDATE currency SET total_supply = total_supply - v_amount, time_updated = now() WHERE cid = v_cid;`（与 `op='mint'` 对称）。
- **配对不变式**：`Σ(delta)=0` 对 `kind IN ('mint','burn')` **豁免**（`v_has_mb`）一字未动 ⇒ 单边负额合法；不变量 `total_supply == Σmint − Σburn` 恢复。
- **`C8` 回执**：`supply_before = v_supply_before` / `supply_after = v_supply_before − v_amount`（与 `mint` 镜像）。
- **持有人授权兜底**：平台 uid（≤0）不得经 `burn` 支销毁 ⇒ `PLATFORM_BURN_FORBIDDEN`（`R-9-38`，不因新币种免检）。

### §1.4 各迁移「真跑四项读数」（**单事务内整文件执行 + 末尾 `ROLLBACK`**，禁 `COMMIT`）

> 依据：`.p9s4-probe/mig-realrun.ts` `[实跑]` · 产物 `.p9s4-artifacts/mig-realrun-20261003T062145Z.json`。
> 三项迁移**均不新建任何关系**（`new_relations_added = 0`）⇒ 「回滚后新对象 `to_regclass` NULL」一腿对**新关系**天然 N/A；判据改由**更强的结构指纹**承担（约束值集 / 列在场 / `op` 白名单的迁移后 ⇄ 回滚后对照）。

| 迁移 | ① 无错（事务内整文件执行） | ② 回滚后新对象不在（结构指纹） | ③ `schema_migration` 无新行 | ④ 目标对象复原（迁移前 ≡ 回滚后，逐字） | 事务内迁移后态（决定性读数） |
|---|---|---|---|---|---|
| `0032` | true（`exec_err = null`） | true（`ledger_kind_enum` 回退 = **21 值**，含 `checkin_makeup_fee`、**无** `bttc_*`） | true（`30 → 30` · `max(version)` `0031 → 0031`） | true | `ledger_kind_enum = 23`（含 `bttc_mint_fee`/`bttc_burn_fee`） |
| `0033` | true（`exec_err = null`） | true（`information_schema` 中 `is_platform_coin` 列 = **0**） | true（`30 → 30` · `0031 → 0031`） | true | `is_platform_coin` 列 = **1** |
| `0034` | true（`exec_err = null`） | true（`ledger_post_event` `op` 白名单含 `burn` = **false**） | true（`30 → 30` · `0031 → 0031`） | true | `ledger_post_event` `op` 白名单含 `burn` = **true** |

- **③ 口径**：`schema_migration` 现值 = **30 行**（`0001`–`0031`；`0032/0033/0034` **未 apply**）；真跑 + `ROLLBACK` 后行数与 `max(version)` **均不变** ⇒ 三迁移**未落版本行**。
- **④ 口径**：迁移前快照 ≡ 回滚后快照（四项结构指纹 `ledger_kind_enum` / `ledger_kind_ok` / `ledger_assert_platform_mutation` / `ledger_post_event` 定义 + `is_platform_coin` 列计数**逐字相等**）。

---

## §2 两条通用判据读数（`C-15` / `R-9-23`）

> 依据：`p8-s9` 门 `[上位已核]`（`total=71 passed=71 failed=0`）· 产物 `.p8s9-artifacts/p8s9-20261003T052320Z/gate.json`（`checks` 现值）。

### §2.1 `C-15`「无行 ⇒ 兜底值」独立负对照（**三形** + `COALESCE` 包标量子查询**外层**）

| 检查 | 期望 | 现取 `actual` | 判定 |
|---|---|---|---|
| `H1` 负对照（**无行 · 空表**）：`resolveMintBurnPolicy(undefined)` | `source = constant` + 五键 = 常量默认 | `{"policy":{"mintBattCost":100,"mintFeeUsd":1,"burnBttcCost":1,"burnFeeUsd":1,"burnBattGain":100},"source":"constant"}` | true |
| `H2` 独立负对照（**`null` / `[]` 两形**） | 均 `source = constant` + 回落常量 | `{"null_src":"constant","arr_src":"constant"}` | true |
| `H3` 正对照（**有行**） | `source = config` + 取真值 | `{"policy":{"mintBattCost":7,"mintFeeUsd":2,"burnBttcCost":3,"burnFeeUsd":4,"burnBattGain":5},"source":"config"}` | true |
| `H4` **`COALESCE` 外层** | `COALESCE((SELECT …), 0)` / `COALESCE((SELECT …), '0')` | `{"batt":true,"bal":true}` | true |
| `H5` 常量兜底逐字 | = 需求 §5.2.2 / §5.3.2 / §5.3.3 | `{"mintBattCost":100,"mintFeeUsd":1,"burnBttcCost":1,"burnFeeUsd":1,"burnBattGain":100}` | true |

- **三形齐**：`undefined`（`H1`）/ `null` + `[]`（`H2`）三种「无行」形**各自**回落常量，**不因无行变 0 / NaN** ⇒ 「只测有行 ⇒ 判负」的反面已成立。
- **`COALESCE` 外层**（`H4`）：`COALESCE((SELECT b.batt::int FROM public.batt_account AS b WHERE b.uid = ${uid}), 0)` 与 `COALESCE((SELECT a.balance::text FROM public.account AS a WHERE …), '0')` **命中** ⇒ 禁内层 `(SELECT COALESCE(…))` 形态（内层形态下无行整值为 `NULL`、三值逻辑逃逸）。

### §2.2 `R-9-23` 钳制 + **反事实直插必红 `23514`** + 边界对照

| 检查 | 期望 | 现取 `actual` | 判定 |
|---|---|---|---|
| `K1` 既有范围 CHECK（`0029` 已 apply） | `batt_account_range` = `CHECK (batt BETWEEN 0 AND 100)` | `{"def":"CHECK (((batt >= 0) AND (batt <= 100)))"}` | true |
| `K4` ★ **反事实直插越界** | 绕过应用层钳制直插 `batt = 101` ⇒ **`23514`** | `{"over_code":"23514","uid":"1"}` | true |
| `K5` 边界对照 | 直插 `batt = 100` ⇒ **通过**（`23514` 非恒拒） | `{"boundary_code":"OK"}` | true |
| `I1` 纯函数钳制 | `mintBattCost 500, cap 50 ⇒ 50` | `{"mint500_cap50":50,"gain500":100}` | true |
| `I2` 纯函数钳制 | `burnBattGain 500 ⇒ 100`（硬上限 `BATT_CAP_HARD_MAX`） | （同上 `gain500=100`） | true |
| `I3` SQL 封顶（`R-9-17`） | `LEAST(COALESCE(cur.batt,0) + burnBattGain, capBatt)` | `{"least":true}` | true |
| `I4` 生效值二次钳 | `capBatt = Math.min(Math.max(1, capBatt), BATT_CAP_HARD_MAX)` | `{"cap_clamp":true}` | true |

- **两条一起才证完**：「钳制生效」（`I1/I2`）与「约束仍在」（`K4` 反事实直插 `101 ⇒ 23514` + `K5` 边界 `100`）**分开**给出 —— 单看「写入 200 ⇒ 生效 100」无法区分「真钳制」与「约束被顺手放宽」。

---

## §3 判负三点红字 + 副本基线 + 主仓 `cmp SAME`

> 副本 = 仓外副本 `[产物]` `/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s4-negctl/backend-ts`（`p8-s9` 门逐轮复跑；**主仓与副本同源**）。产物 = 该副本 `.p8s9-artifacts/p8s9-<RUN>/gate.json`。

| 轮 | RUN | 变异 | 读数 | 红点 | 判定 |
|---|---|---|---|---|---|
| 基线 | `p8s9-20261003T052120Z` | 无（未变异） | `71/71/0` | — | ✅ |
| **M1** | `p8s9-20261003T052145Z` | 变动 `0034` 分解 `total_supply` 双写语句的**收口**（`− v_amount` 之后的 `time_updated = now()` / `WHERE cid = v_cid` 一带）⇒ 整行逐字判据不成立（同件简写读数仍 `true`） | `71/70/1` | **`F1`**（组 `migration0034` · `R-9-37` 双写） | ✅ 必红 |
| **M2** | `p8s9-20261003T052151Z` | 从 `0034` `op` 白名单**移除** `'burn'` | `71/70/1` | **`E1`**（组 `migration0034` · `{old6:true, new7:false}`） | ✅ 必红 |
| **M3** | `p8s9-20261003T052156Z` | 从 `src/database.ts` 上市闸 SQL **去掉**平台豁免谓词 `OR c.is_platform_coin = true` | `71/70/1` | **`D4`**（组 `migration0033` · 复合谓词不成立，前缀读数仍 `true`） | ✅ 必红 |
| 复原 | `p8s9-20261003T052203Z` | 还原 | `71/71/0` | — | ✅ |

- **判负三点一一对应**（每条变异**只**点红其判据，无外溢）：`M1 ⇒ F1` · `M2 ⇒ E1` · `M3 ⇒ D4`。
- **副本基线 `71/71`** · **复原 `71/71`** ⇒ 门对「正/负两态」可区分。
- **主仓 `cmp` 副本 SAME** `[实跑]`：8 文件逐字节相等 —— `backend-ts/migrations/{0032,0033,0034}*.sql` · `backend-ts/src/{database,ledger,index}.ts` · `backend-ts/scripts/p8-s9-bttc-gate.ts` · `frontend/src/locales/zh.json` ⇒ 副本变异**未污染**主仓。

---

## §4 冻结计数逐处表

> `[实跑]` `git diff -- backend-ts/scripts/` 逐文件现取（旧值取自 `HEAD:文件`，新值取自工作区）+ 前端 i18n 现取。

### §4.1 注册点冻结（`85 → 87` · P9④ BTTC 2 新口 +2）

| # | 位置（`backend-ts/scripts/`） | 冻结项 | 前 | 后 | 增量出处 |
|---|---|---|---|---|---|
| 1 | `p8-s2-fee-rebate-gate.ts` | `REG_COUNT` | `85` | `87` | BTTC 铸/分解 2 动作口 +2 |
| 2 | `p8-s3-deposit-gate.ts` | `REG_POINTS_FROZEN` | `85` | `87` | 同上 |
| 3 | `p8-s3b-address-gate.ts` | `REG_POINTS_FROZEN` | `85` | `87` | 同上 |
| 4 | `p8-s4-currency-review-gate.ts` | `REG_POINTS_FROZEN` | `85` | `87` | 同上 |
| 5 | `p8-s5-compliance-gate.ts` | `REG_POINTS_FROZEN` | `85` | `87` | 同上 |
| 6 | `p8-s6-site-text-gate.ts` | `REG_POINTS_FROZEN` | `85` | `87` | 同上 |
| 7 | `p8-s7-batt-checkin-gate.ts` | `REG_POINTS_FROZEN` | `85` | `87` | 同上 |
| 8 | `p8-s8-rating-timeliness-gate.ts` | `REG_POINTS_FROZEN` | `85` | `87` | 同上 |
| — | `p8-s9-bttc-gate.ts`（**本片新文件**） | `REG_POINTS_FROZEN` | —（新） | `87`（内置） | — |

> ★ **口径订正（诚实登记）**：brief 记「**六门** `85→87`」；**现取 = 8 处**（上表 #1–#8，另加 `p8-s9` 新文件内置 87）。逐处以上表为准；派单方（Zang）六门为**二手转述**，本文按现取更正。

### §4.2 逐 verb 冻结（`{get:36, post:46} → {get:36, post:48}`）

| # | 位置 | 冻结项 | 前 | 后 | 出处 |
|---|---|---|---|---|---|
| 1 | `p8-s6-site-text-gate.ts` | `PER_VERB_FROZEN` | `{36, 46}` | `{36, 48}` | `post +2`（BTTC 双动作口；`get` 不变 · 读口并入既有 `GET /api/batt`） |
| 2 | `p8-s7-batt-checkin-gate.ts` | `PER_VERB_FROZEN` | `{36, 46}` | `{36, 48}` | 同上 |
| 3 | `p8-s8-rating-timeliness-gate.ts` | `PER_VERB_FROZEN` | `{36, 46}` | `{36, 48}` | 同上 |
| — | `p8-s9-bttc-gate.ts` | `PER_VERB_FROZEN` | —（新） | `{36, 48}` | 同上 |

现取总注册点 = `87`（`get 36 / post 48 / put 0 / patch 1 / delete 2`，和 = 87）`[实跑]`（`p8-s7/s8/s9` 三门 `A1/A2` 现值）。

### §4.3 迁移文件数冻结（`MIGRATIONS_FROZEN 30 → 33`）

| # | 位置 | 冻结项 | 前 | 后 | 出处 |
|---|---|---|---|---|---|
| 1 | `p8-s3-deposit-gate.ts` | `MIGRATIONS_FROZEN` | `30` | `33` | 新增 `0032/0033/0034` 三文件 |
| 2 | `p8-s3b-address-gate.ts` | `MIGRATIONS_FROZEN` | `30` | `33` | 同上 |
| 3 | `p8-s4-currency-review-gate.ts` | `MIGRATIONS_FROZEN` | `30` | `33` | 同上 |
| 4 | `p8-s5-compliance-gate.ts` | `MIGRATIONS_FROZEN` | `30` | `33` | 同上 |

现取迁移文件数 = **33**（`0001`–`0034`，其中 `0001`–`0031` 已 apply / `0032`–`0034` 未 apply）`[实跑]`（`mig-realrun` 快照 `schema_migration` 30 行）。

### §4.4 kind 闭集（`21 → 23` · 穷举**恰四处**）

| 编码处 | 前 | 后 | 性质 |
|---|---|---|---|
| ① `0032` `ledger_kind_enum` CHECK | 21（`0028`） | **23** | 现役 · DROP+ADD 重建 |
| ② `0032` `ledger_kind_ok` 第一支 | 21（`0029 §G2`） | **23** | 现役 · `CREATE OR REPLACE` |
| ③ `src/ledger.ts` `LEDGER_KINDS` | 21 | **23** | 现役 · TS 常量 |
| 历史 `0028` CHECK / `0029` 函数 | 21 | 21（**逐字未改**，被 `0032` 取代） | P9② 冻结快照 |

- 新增两值 = `bttc_mint_fee` / `bttc_burn_fee`（末位追加，既有 21 次序不动）；冻结族第二支 = 4 值不动。穷举扫面 = **无未登记全闭集编码**（现役 3 处 + 历史 2 处，共**恰四处**代码面全闭集）。

### §4.5 `p8-s7` `B2` 响应键（`6 → 7` 键）

| 项 | 前（6 键） | 后（7 键） | 出处 |
|---|---|---|---|
| `GET /api/batt` `data` 顶层键 | `acceptThresholdBatt / batt / canAccept / capBatt / floorBatt / updated_at` | 上述 6 键**逐字不动** + **`bttc`**（子对象） | `[实跑]` `B2` `actual.keys = ["acceptThresholdBatt","batt","bttc","canAccept","capBatt","floorBatt","updated_at"]` |

- `B2` 用**括号深度切顶层逗号**取顶层键（嵌套子对象只贡献 1 个键）⇒ `bttc` 子对象的内层键**不计入**顶层键集。

### §4.6 四 i18n 冻结（`{top 117, flat 988} → {top 118, flat 1000}` / 节点 `3952 → 4000`）

| # | 位置（`frontend/src/test/unit/`） | 冻结项 | 前 | 后 | 出处 |
|---|---|---|---|---|---|
| 1 | `i18n-batch-b4a.test.jsx` | `counts.zh = {top, flat}` | `{117, 988}` | `{118, 1000}` | 新增顶层 `bttcPanel`（12 键）⇒ `flat +12` / `top +1` |
| 2 | `i18n-batch-b4b.test.jsx` | `counts.zh` + 打印串 | `{117, 988}` | `{118, 1000}` | 同上 |
| 3 | `i18n-batch-b5.test.jsx` | `counts.zh` + 打印串 | `{117, 988}` | `{118, 1000}` | 同上 |
| 4 | `i18n-violation-closeout.test.jsx` | `作用域命中节点数` + 拍平键数 | `3952` / `988` | `4000` / `1000` | 同上 |

- **现取** `[实跑]`：四语 `zh/en/hk/vn` 均 `top = 118` / `flat = 1000`（逐语相等）⇒ 与期望订正一致，键集四语齐、`+12` 增量全部落 `bttcPanel`。

---

## §5 `PENDING_APPLY` 清单（10 项）

> ★ 本单**不 apply** 任何迁移（`0032/0033/0034` 未 apply）；下列 10 条库面 leg **如实登记、不入 `checks`、不伪装绿**。逐条写明「**apply 前不可验的具体面**」。依据 `[上位已核]` `.p8s9-artifacts/p8s9-20261003T052320Z/gate.json`（`pending_apply` 数组现值）。

| # | leg | **apply 前不可验的具体面** |
|---|---|---|
| 1 | `0032` · 活体 `ledger_kind_enum = 23`（含 `bttc_mint_fee`/`bttc_burn_fee`） | 活体约束**值集**（未 apply ⇒ 现库仍 21 值）；源码面 23 值 + 正/负自检已验（`C1`–`C7`） |
| 2 | `0032` · 活体 `ledger_kind_ok` 接纳两新 kind / 冻结族第二支未放宽 | 活体**函数体白名单**（`CREATE OR REPLACE` 未执行）；源码面函数体已验（`C2`/`C4`） |
| 3 | `0032` · 活体 `ledger_assert_platform_mutation` `−1` credit 含两新 kind | 活体**`−1` credit 白名单**（未 apply）；源码面白名单 + 负向自检已验（`C5`/`C7`） |
| 4 | `0033` · 活体 `currency.is_platform_coin` 列（`boolean NOT NULL DEFAULT false`） | 活体**列在场 / 类型 / 默认值**（`ALTER TABLE ADD COLUMN` 未执行 ⇒ 现库 `42703`）；结构契约源码面已验（`D1`–`D3`） |
| 5 | `0033` · 活体 BTTC 载体行（`symbol=BTTC` / `owner_uid=0` / `is_platform_coin=true`） | 活体**载体行**（`ensureBttcCurrency` 引用 `is_platform_coin` ⇒ 未 apply 时不可执行 `42703`）；须 apply `0033` 后取证 |
| 6 | `0033` · 活体上市闸豁免（平台行免审核 / 免保证金；非平台行仍全额） | 活体**豁免闸行为**（需 apply `0033` + 真平台行）；本门只验 `src/database.ts` 唯一写路径谓词（`D4`/`D5`） |
| 7 | `0034` · 活体 `ledger_post_event` `op=burn` 分支 + 分解 `total_supply` 双写 | 活体**`burn` 分支 + 双写**（`CREATE OR REPLACE` 未执行）；源码面 `op` 白名单 / 分支 / 双写 / 自检已验（`E`/`F`） |
| 8 | `getBttcState` 活体：无行 ⇒ 兜底值 · 有行 ⇒ 真 `balance/supply` | 活体**取数读数**（需 apply `0033` ⇒ BTTC 载体行存在）；纯函数负对照已验（`H1`–`H3`） |
| 9 | `bttcMint` / `bttcBurn` 活体链路（铸/分解 + 双写 + 钳制 + 幂等 `cli:<UUID>`） | 活体**端到端链路**（需 apply `0032`+`0033`+`0034` + 真库）；本门 SQL 语法自证 + 钳制 / 反事实已验 |
| 10 | 2 新口真 HTTP（无 token `401` / 有 token `200` / `409` 拒绝面） | 活体**HTTP 面**（本门**零网络** `http_calls:0`；真 HTTP 需受控实例 + 已 apply 另册） |

- **过渡态声明**：以上 10 条为 **「等 apply 再测」的过渡态，非永久豁免**；apply 后须把每一条转成真 `checks`（`pending_apply` 归零）。

---

## §6 未测项逐项原因（禁填 0 / 空）

| 未测项 | 原因（逐项） |
|---|---|
| `0032/0033/0034` 的**活体**库面效果（约束值集 / 函数体 / 列 / `op` 分支 / 双写） | 本单**不 apply**（硬口径）⇒ 活体不可验；已用**源码面 + 真跑四项读数**（`§1.4`）覆盖，逐条挂 `pending_apply`（`§5` #1–#7） |
| `getBttcState` / `bttcMint` / `bttcBurn` **活体链路** | 依赖 `0033`（BTTC 载体行）⇒ apply 前 `42703`（不可执行）；纯函数负对照 + 源码面已验 |
| 2 新口 **真 HTTP**（`POST /api/bttc/mint` / `POST /api/bttc/burn`：`401` ⇄ `200` / `409` 拒绝面） | `p8-s9` 门**零网络**（`http_calls:0`，设计如此）⇒ 真 HTTP 需受控实例 + **已 apply** 另册；本单受控实例的两门为 `p8-s7/p8-s8`（非 BTTC 口） |
| `0033` 活体**存量兼容**（既有全部行 `is_platform_coin = false`） | 列在 apply 前不存在（`42703`）⇒ 存量读不可验；`0033` 自检（`count(*) … WHERE is_platform_coin` 且 `v_true <> 0 ⇒ ABORT`）源码面已验 |
| 「四语 `bttcPanel` 文案**值**」的产品 / 文案决策 | 产品决策面（非工程可测）；本单只验**键集四语相等 + 零工程泄漏 + `en/vn` 零 CJK**（`L1`–`L3`） |
| 前端 `bttcPanel` **UI 交互**（点击铸/分解的端到端） | 依赖后端真 HTTP（未 apply）+ 受控前端实例；超出本收尾单写集（本单为 `scripts/**` + 报告） |

---

## §7 自证 + 受控实例收尾 + `git status` 归因

### §7.1 报告自证

- **行数 / 字节**：见末次读数（`§7.4`）。
- **双下划线记法计数 = 0**（报告正文**零**「连续两个下划线」字面；判据编号一律用 `C-15` / `R-9-23` / `M1` 一类写法，**未**把自检 id 记法写入说明句；命令口径 = 报告文件 `grep` 该记号计数）。
- **占位归零**：全文无未完成标记（英文代填符 / 中文代填符）/ 空表。

### §7.2 受控实例收尾（`[实跑]`）

- 启动：`PORT=5797 node_modules/.bin/ts-node --transpile-only src/index.ts`（**只用 5797**）。
- 就绪：`lsof -nP -iTCP:5797 -sTCP:LISTEN -t` ⇒ **精确 PID `5616`**；健康码 = 公开 `GET /api/role-names ⇒ 200` / 受保护 `GET /api/batt`（无 token）⇒ `401`。
- 回收：`kill -TERM 5616` ⇒ 进程退出（`kill -0` = NO）；`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` ⇒ **空**；用户 `5787`（pid `30475`）/ `5788`（pid `65096`）**未碰**（**禁** `pkill -f` / `killall`，仅精确 PID）。

### §7.3 `git status --porcelain` 首尾归因

- 首（开工，本单首个命令）：`.p9s4-closeout/git-status-first.txt` = **200 行**（`?? 179` / `M 21`）。
- 末（收尾，全部写盘后）：`.p9s4-closeout/git-status-last.txt` = **201 行**（`?? 180` / `M 21`）。
- **首尾差集 = 恰 1 行**：`?? docs/audit/p9-s4-bttc.md`（**本报告**）⇒ 本单一共只**新增**该一件跟踪外文件。

**逐条归因**：

| 类别 | 计数 | 归因（**本单不碰 / 不提交 / 不回滚**） |
|---|---|---|
| `M` · `backend-ts/.p4-artifacts/b4c-…/geometry.json` | 1 | 早期批次（P4）遗留的**在途**改动，**非本单**所写 |
| `M` · `backend-ts/scripts/p8-s2…s6,s7,s8-*.ts` | 8 | P8 各片在途（含 P9④ 对各门冻结算数的现取前推，见 `§4`）—— **非本单**所写（本单只跑不改） |
| `M` · `backend-ts/src/{database,index,ledger}.ts` | 3 | P9④ 实现面在途（`is_platform_coin` 豁免谓词 / BTTC 口 / `LEDGER_KINDS`）—— **非本单**所写 |
| `M` · `frontend/src/components/BattCheckinPanel.jsx` + `frontend/src/locales/{zh,en,hk,vn}.json` | 5 | P9④ 前端面在途 —— **非本单**所写 |
| `M` · `frontend/src/test/unit/i18n-batch-{b4a,b4b,b5} + i18n-violation-closeout` | 4 | P9④ i18n 期望订正（`§4.6`）—— **非本单**所写 |
| `??` · 各 run-artifact 目录（`.p4-artifacts/` · `.p8s*/` · `.p9s*/` 等） | 169 | 历批 / 本批的 run-tagged **产物目录**（未跟踪、按纪律**不提交**，登记「删除 / 归档 / 加 ignore」三选一） |
| `??` · `backend-ts/migrations/{0032,0033,0034}*.sql` | 3 | P9④ **未 apply** 的三迁移文件 —— **非本单**所写 |
| `??` · `backend-ts/scripts/p8-s9-bttc-gate.ts` + `p8-s5-00-recon*.ts` | 4 | P9④ 新门 / 探针 —— **非本单**所写 |
| `??` · `frontend/src/bttc-api.js` | 1 | P9④ 前端接线 —— **非本单**所写 |
| `??` · `backend-ts/.p9s4-closeout/` · `.p9s4-probe/` · `.p9s4-artifacts/` | 3 | **本单**产物所在目录（首尾均列于 `??`；产物 = `.out`/`.json`，无 `.log` 后缀） |
| `??` · `docs/audit/p9-s4-bttc.md` | 1 | **本单**唯一新增跟踪外文件（本报告） |

- **口径**：本单**未** `git add` / `commit` / `push`；**未**改任何 `M` 文件；**未**回滚他人改动。

### §7.4 末次自证读数

| 项 | 读数 |
|---|---|
| 报告行数 | **281 行**（回填后） |
| 报告字节 | **≈ 26.3 KB**（末次 `wc -c` 约 26290 B） |
| 双下划线记法计数（`grep` 该记号） | **0** |
| 占位符（未完成标记） | **0** |
| `docs/audit/p9-s4-bttc.md` 首尾差集 | **+1 行**（`?? docs/audit/p9-s4-bttc.md`） |
| `5796–5799` LISTEN | **空** |
| 用户 `5787` / `5788` | **未碰**（pid `30475` / `65096`） |



---

## §8 P9④ 库面收口续跑（`F-α` 修复 · 门收口 · 判负 4 处 · 全量复跑）

> 单号：P9④【库面收口续跑单】（角色 **Kong**）· 仓 `/Users/kevin/bistro/seafood`（HEAD `aadece8` · 本单**不 push / 不 commit**）· ★ 本单为**唯一 `src` 写者**（仅 `F-α` 最小修）。
> ★ **本节为追加**（§0–§7 逐字未改写）。库面口径已变：`0032`/`0033`/`0034` **已 apply**（`schema_version = 0034` · `schema_migration` **33 行**）⇒ 原 §5 的 10 条 `PENDING_APPLY` 在本轮**全部落实为活体 `checks`**（`pending_apply[]` **归零**）。

### §8.1 结论速览

| 项 | 读数 | 来源 |
|---|---|---|
| `F-α` 修复（`R-9-45`） | `ensureBttcCurrency` 首调**非空**（`ins RETURNING` 同名取回 + 逐列 `COALESCE`）· `tsc` **0** | `[实跑]` |
| `p8-s9`（改后门） | `total=99 passed=99 failed=0` · **`pending_apply=0`** · `db=10` · `http=0` · **exit 0** | `[实跑]` `.p8s9-artifacts/p8s9-20261003T064744Z/gate.json` |
| 门**继承态**首跑两红 | `98 / 96 / 2` · 红 = `KI2`（配对不变式符号）+ `KGS1`（`canMint` 期望）⇒ **口径错**（非代码缺陷） | `[实跑]` `p8s9-20261003T063923Z` |
| 门加固（`E1`） | 原仅锚**自检串**（双引号形）⇒「去真白名单 `burn`」**假绿**；加固后同变异**必红** | `[实跑]` 副本（加固前 `99/99` ⇄ 加固后 `E1` 红） |
| 判负 4 处 | `M1⇒F1` · `M2⇒E1` · `M3⇒D4+KE3` · `M4⇒KC1b`（各**复原回绿** `99/99`） | `[实跑]` 副本 |
| 主仓 `cmp` 副本 | `src/` + `migrations/` 两目录**逐字节 IDENTICAL**（7 文件 `SAME`） | `[实跑]` |
| 全量复跑 | `tsc` 0 · `build` 0 · `test:unit` **31 files / 276** · 离线 **126/126** · `s1..s6` = **24/41/45/38/79/117/64** · 注册点 **87** | `[实跑]` |
| `s7`/`s8`/`s9` 双读数 | 带实例 `58/58` · `92/92` · `99/99` ⇄ 离线 `55/58` · `89/92` · `99/99` | `[实跑]` |
| 受控实例收尾 | 精确 PID `99827` `kill -TERM` ⇒ `5796–5799` LISTEN **空**；用户 `5787`/`5788`（pid 30475 / 65096）**未碰** | `[实跑]` |

### §8.2 `F-α` 修复（`R-9-45` · 唯一 `src` 改动）

- **根因（原实现）**：`ensureBttcCurrency` 用 **数据修改型 CTE `ins`（`INSERT … ON CONFLICT DO NOTHING`）+ 主查询标量子查询直读 `public.currency`**。PG 语义下主查询的读**与 CTE 同快照、互不可见** ⇒ 首次（真正插入那一次）`(SELECT c.cid FROM public.currency WHERE symbol='BTTC')` = `NULL` ⇒ **函数返回 `null`**（行**确已插入**，第二次调用才可见）。
- **最小修（`R-9-45`「返回确定值」· 不动语义）**：`ins` 的 `RETURNING cid` 扩为 `RETURNING cid, symbol, name, decimals, status, total_supply, is_platform_coin`，主查询**逐列** `COALESCE((SELECT i.… FROM ins AS i), (SELECT c.… FROM public.currency AS c WHERE c.symbol='BTTC' LIMIT 1))` ⇒ 插入那次取 `ins`（同语句 `RETURNING`，官方唯一通信通道）、幂等命中那次回落直读。`inserted` / 幂等 / 列语义**逐字未动**。
- **回归判据（门内新增 `KC1b`）**：`c1 !== null && c1.symbol==='BTTC' && c1.is_platform_coin===true && c1.decimals===0 && c1.status==='listed'`。
  - 修后现取 `[实跑]`：`KC1b.actual = {"first_call":{"cid":"92","symbol":"BTTC","decimals":0,"status":"listed","is_platform_coin":true,"inserted":true}}` ⇒ 首调**非空**且 = 载体行。
  - 判负 `M4`（副本把 `cid` 退回直读）⇒ `KC1b` **必红**（`first_call:null`，`F-α` 状态回落 `open`）—— 见 §8.5。
- `tsc`（`tsconfig.json` `include=["src/**/*"]`）**exit 0 · 0 行**；`tsc -p tsconfig.scripts.json` 中 `p8-s9-bttc-gate.ts` **0 错误**（该工程另有 86 处**既有**、非本单脚本错误，与本节改动无关）。
- **诚实更新**：`src/database.ts` 内两处 `PENDING_APPLY（0032/0033 未 apply）` 陈旧注释一并改「**已 apply ⇒ 活体可验**」（注释非语义）。

### §8.3 门收口：对象 `note` / 顶层 `findings` + 首跑两红定性（口径订正，非放宽）

**A. 报告对象（`gate.json`）收口** `[实跑]`：
- `note`：由「`0032`/`0033`/`0034` **未 apply** ⇒ 单列 `pending_apply[]`」改为「★ `0032`/`0033`/`0034` **已 apply**（`schema_version` 0034 · `schema_migration` 33 行）⇒ 全部转 K 段**活体 checks**，`pending_apply[]` **归零**」。
- **顶层 `findings`（新增）**：两条 —— `F-α`（`status=resolved`）· `F-β`（`status=open_transferred_r9_44`）。原来只在 `readings.live.findings` 内且 `F-α` 仅在 `c1===null` 时登记；现**恒登记**并带 `status`。

**B. 门**继承态**首跑两红**（`total=98 passed=96 failed=2`，`p8s9-20261003T063923Z`）逐字红点 + 定性：

| 红点 | 组 | 逐字 actual | 定性 |
|---|---|---|---|
| `KI2` | `pairingInvariant` | `{"supply":"0","sumMint":"1","sumBurn":"-1"}` | **口径错（门的算式）** —— burn 本体腿为**单边负额**（`ledger_norm_entry(…,-v_amount,…,'burn')` ⇒ 存储 delta = `−1`），故守恒式是 `total_supply == Σmint + Σburn`（`0 == 1 + (−1)`）；原式 `Σmint − Σburn` 把符号弄反（`0 == 1 − (−1) = 2`）。**判据语义（严格相等）未放松**，仅订正符号约定；`KI1` 同步改 `+` 保持一致（其 `Σburn=0` 时两式等值）。 |
| `KGS1` | `bttcStateLive` | `{"symbol":"BTTC","totalSupply":"0","balance":"0","usdBalance":"2","batt":100,"canMint":true,"canBurn":false,…}` | **口径错（门的期望值）** —— 分解 `+burnBattGain(100)` 经 `LEAST(…,capBatt)` **封顶**后 `batt=100`、`$=2`，按 `getBttcState` 的 `canMint = 可铸 && batt≥100 && $≥1` ⇒ **`canMint=true` 为真**（原期望 `false` 未计封顶回流）。`canBurn=false`（持仓 0）不变。 |

> **两红均为门自身**口径错**，不是产品/代码缺陷**；订正后**判据未删、未放宽、未标 SKIPPED**（`F-α` 修复另立 `KC1b` 真判据，见 §8.2）。

**C. 门加固（发现并闭合一处**假绿**）** `[实跑]`：`E1` 原锚在**双引号自检串**（`strpos(v_src, 'v_op NOT IN (''…'',''burn'')')`），**未锚 `ledger_post_event` 真白名单**（单引号形 · `0034:147`）。实测：把真白名单的 `'burn'` 去掉（仅此处）⇒ 门**仍 `99/99` 绿**（假绿）。加固 = `E1` 增锚 `V_REAL = "v_op NOT IN ('mint', 'transfer', 'hold', 'hold_release', 'settle', 'entries', 'burn')"`（**双面同锚**：真白名单 + 自检串）⇒ 同一变异**必红**，`actual` 显示 `{"old6_selfcheck":true,"new7_selfcheck":true,"real_whitelist":false}`（证明锚在**真白名单**上）。**只加严、未放宽。**

### §8.4 四段真链路逐段读数（★ `0032/0033/0034` 已 apply ⇒ 活体）

> 事务内 + 子步 `SAVEPOINT` + 末尾 `ROLLBACK`（append-only 表无 DELETE 复原路径）；受控实例**无**（`http_calls=0`）。`[实跑]` 产物 `.p8s9-artifacts/p8s9-20261003T064744Z/gate.json`（`readings.live.chains`）。

| 段 | 检查 | 逐段读数（现取） |
|---|---|---|
| ① 创建 | `KC1b`/`KC1`/`KC2` | 首调 `{cid:"92",symbol:"BTTC",decimals:0,status:"listed",is_platform_coin:true,inserted:true}` · 二调 `inserted:false` · 直读行同值 ⇒ **首调即有确定值**（`F-α` 已修） |
| ② 豁免闸（两读数对照） | `KE1`/`KE2`/`KE3` | 非平台 `dep0` ⇒ `{ok:true,applied:0,cur_status:"draft"}`（**仍走审核闸**）· 平台 `dep7` ⇒ `{ok:true,applied:0}`（保证金腿对平台行**跳过**）· 平台 `dep0` ⇒ `{ok:false,err:"LD016"}`（**越过审核闸**、触达账本腿 ⇒ 零额保证金分录 `LEDGER_AMOUNT_INVALID`/`BOTH_ZERO`） |
| ③ 铸造·闸负 | `KM1`/`KM2` | `batt=99` ⇒ `{outcome:"rejected",battAfter:99,usd:"4",bttc:"0",supply:"0",mintLegs:0,feeLegs:0,battEntry:0}`（**零副作用**）· `$=0` ⇒ `{outcome:"rejected",battAfter:100,usd:"0",mintLegs:0,battEntry:0}` |
| ③ 铸造·成功 | `KM3` | `{outcome:"applied",txid:"827",supplyBefore:"0",supplyAfter:"1",batt:"100→0",usd:"4→3",bttc:"0→1",bodyLegs:[{uid:"4",delta:"1",kind:"mint"}],feeLegs:[{uid:"4",delta:"−1",kind:"bttc_mint_fee"},{uid:"−1",delta:"1",kind:"bttc_mint_fee"}]}` |
| ③ 幂等重放 | `KM4` | `{outcome:"replayed",ledger_entry_delta:0,batt_entry_delta:0,supplyNow:"1"}`（同 `cli:<UUID>` 键 ⇒ **零新增**） |
| ④ 配对不变式（铸后） | `KI1` | `{supply:"1",sumMint:"1",sumBurn:"0"}` ⇒ `1 == 1 + 0` ✓ |
| ③ 分解·封顶 | `KB1`/`KB2` | `{outcome:"applied",txid:"830",supplyBefore:"1",supplyAfter:"0",batt:"50→100",usd:"3→2",bttc:"1→0",bodyLegs:[{uid:"4",delta:"−1",kind:"burn"}],battEntry:{d:50,a:100}}` ⇒ `LEAST(50+100,100)=100`，**只入 +50**（封顶丢弃 · `R-9-17`） |
| ④ 配对不变式（分解后） | `KI2` | `{supply:"0",sumMint:"1",sumBurn:"−1"}` ⇒ `0 == 1 + (−1)` ✓（符号约定订正，见 §8.3-B） |
| ③ 持有人授权兜底 | `KN1` | 平台 uid（`−1`）经 `burn` ⇒ `{raised:true,code:"LD021"}`（`LEDGER_RESERVED_UID`/`PLATFORM_BURN_FORBIDDEN` · `R-9-38`） |
| ⑤ `getBttcState` 活体 | `KGS1`/`KGS2` | 有行：`{symbol:"BTTC",totalSupply:"0",balance:"0",usdBalance:"2",batt:100,canMint:true,canBurn:false,source:"constant"}` · 无行（`C-15`）：`{balance:"0",usdBalance:"0",batt:0}`（**外层 `COALESCE`，不 NULL 逃逸**） |
| 零残渣 | `K9`/`K10` | `residue_before == residue_after` = `{currency:15,ledger_entry:359,batt_account:2,batt_entry:2,account:39,currency_status_log:7,currency_review_log:0}`；回滚后 `currency` 无 `symbol='BTTC'` 行 |

- **读数锚点说明**：`cid`/`txid` 跨轮会漂移（本轮 `44→56→92` · `773→827/830`）—— 这是 `GENERATED … AS IDENTITY` 序列推进**不随 `ROLLBACK` 回退**所致（非行级副作用 ⇒ **不构成缺陷**）；故一切比对以**业务语义字段**（`symbol`/`kind`/`delta`/`uid`/`status`/幂等键）为锚，**不以自增 id 为判据**。

### §8.5 库面判负 4 处（仓外副本 + 复原回绿 + 主仓 `cmp`）

> 副本 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s4-negctl/backend-ts`（`node_modules` 软链主仓 · `.env.local` 同源；门 `REPO_ROOT` = 副本根 ⇒ 读副本的 `src`/`migrations`/`locales`）。每轮**只删/改一处**，跑完即复原。

| 轮 | 变异（逐字） | 读数 | 红点 | 判定 |
|---|---|---|---|---|
| 基线 | 无 | `99/99/0` · exit 0 | — | ✅ |
| **M1** | `0034` 分解双写**去值**：`total_supply = total_supply - v_amount` ⇒ `= total_supply`（供应量不再随分解回落） | `99/98/1` | **`F1`**（`migration0034` · `R-9-37` 双写） | ✅ 必红 |
| **M2** | `0034` **真白名单**去 `burn`：`v_op NOT IN ('mint','transfer','hold','hold_release','settle','entries','burn')` ⇒ 去末位 `'burn'`（`0034:147`） | `99/98/1` | **`E1`**（`real_whitelist:false`） | ✅ 必红（**加固后**；加固前同变异假绿 `99/99` ⇒ 见 §8.3-C） |
| **M3** | `src/database.ts` 上市闸**去豁免谓词**：删 `OR c.is_platform_coin = true` | `99/97/2` | **`D4`**（静态）+ **`KE3`**（活体：平台行止于审核 `applied=0`，不再触达账本） | ✅ 必红（同一豁免面的静态 + 活体**双读数**） |
| **M4** | `src/database.ts` `F-α` **回归**：`cid` 退回 `ins` 兜底前的直读 ⇒ 首调 `null` | `99/98/1` | **`KC1b`**（`first_call:null`；`F-α` 状态回落 `open`） | ✅ 必红 |
| 复原 | 全部还原 | `99/99/0` · exit 0 | — | ✅ |

- **无外溢**：每条变异只点红其判据（`M3` 双红同属豁免面；`M4` 仅 `KC1b` + 派生 `F-α.status`）。
- **主仓零写入** `[实跑]`：`cmp` 逐字节 —— `src/database.ts` · `migrations/{0032,0033,0034}*.sql` · `src/{index,ledger}.ts` · `scripts/p8-s9-bttc-gate.ts` **7 文件 `SAME`**；`diff -rq src` 与 `diff -rq migrations` **两目录 IDENTICAL** ⇒ 变异**未污染主仓**。

### §8.6 `pending_apply` 归零 + `F-α`/`F-β` 与 `R-9-44`/`R-9-45`

- **`pending_apply[]` = `[]`（0 项）** `[实跑]`：`0032`/`0033`/`0034` **已 apply** ⇒ 原 §5 的 10 条「等 apply 再测」库面 leg **全部转为 K 段活体 `checks`**（结构面 `K2/K2b/K2c/K3/K3b/K4/K4b/K5` + 四段真链路 `KC*`/`KE*`/`KM*`/`KI*`/`KB*`/`KN1`/`KGS*`/`K9`/`K10`）。`J4` = `pendingApply.length === 0` 且带自检臂（喂 `1` 必红）。**过渡态声明解除**（§5 末「等 apply 再测」已兑现）。
- **`F-α`（`R-9-45` · 已修）**：`ensureBttcCurrency` 首调返回确定值；门内 `KC1b` 为回归判据，`findings` 登记 `status=resolved`。调用方**不得据 `null` 判「未创建」**。
- **`F-β`（`R-9-44` · 定性=预期行为、非缺陷）**：平台行经 `listCurrencyWithDeposit` 的 `draft→listed` 边**不可达**（保证金 `0` ⇒ `LD016`；`>0` ⇒ 守卫拦 `applied=0`）；豁免谓词语义 = **平台币免审核**，而非「平台币可申请上市」。`findings` 登记 `status=open_transferred_r9_44`；**登记待办**：若未来开放平台币上市申请 ⇒ 须修 `LD016` 零额保证金分录入径（**非本片范围**）。

### §8.7 全量复跑读数（双读数 · 退出码**管道外**捕获）

| 门 | 读数 | exit |
|---|---|---|
| `tsc`（`--noEmit`） | **0 行** | 0 |
| `build`（`npm run build` = `tsc`） | 0 | 0 |
| 前端 `test:unit` | **31 files / 276 passed** | 0 |
| 离线套件（`p4z-tr1a-01-offline-tests`） | **126 / 126** | 0 |
| `p8-s1` | `24 / 24 / 0` | 0 |
| `p8-s2` | `41 / 41 / 0` | 0 |
| `p8-s3` | `45 / 45 / 0` | 0 |
| `p8-s3b` | `38 / 38 / 0` | 0 |
| `p8-s4` | `79 / 79 / 0` | 0 |
| `p8-s5` | `117 / 117 / 0` | 0 |
| `p8-s6` | `64 / 64 / 0` | 0 |
| `p8-s7` | **带实例 `58 / 58 / 0`**（`db=7 http=9`）⇄ **离线 `58 / 55 / 3`**（红 `G8/G9/G10` · HTTP 腿） | 0 / 1 |
| `p8-s8` | **带实例 `92 / 92 / 0`**（`db=13 http=11`）⇄ **离线 `92 / 89 / 3`**（红 `H5/H6/H7` · HTTP 腿） | 0 / 1 |
| `p8-s9` | **带实例 `99 / 99 / 0`**（`db=10 http=0`）⇄ **离线 `99 / 99 / 0`**（`http=0` ⇒ 与实例**无关**） | 0 / 0 |
| 注册点 | **87** = `get 36 / post 48 / put 0 / patch 1 / delete 2`（`s7`/`s8`/`s9` 三门 `A1/A2` 现值） | — |

- **离线红点定性（沿 `R-9-26`）**：`p8-s7` 红 `G8/G9/G10`、`p8-s8` 红 `H5/H6/H7` **全为 `httpLive` HTTP 腿**（无受控实例 ⇒ `fetch failed`）⇒ **环境差异**，**未放宽判据 / 未删腿 / 未标 SKIPPED**；带实例取全绿并**同时登记离线读数**。`p8-s9` **零网络**（`http_calls:0`）⇒ 两读数**逐字相同**（已登记）。
- **`s1..s6` 现值未掉**：`24/41/45/38/79/117/64` 与上单基线逐值一致。
- **本轮产物路径**（run-tagged · 无 `.log` 后缀）：门 `p8-s9` = `.p8s9-artifacts/p8s9-20261003T064744Z/gate.json`（带实例 `…064929Z` / 离线 `…065025Z`）；离线套件 = `.p4-artifacts/p6tr1a-20261003T064810Z/offline-tests.json`；`p8-s7` = `.p8s7-artifacts/p8s7-20261003T064851Z`（带实例）/ `…064957Z`（离线）；`p8-s8` = `.p8s8-artifacts/p8s8-20261003T064903Z`（带实例）/ `…065003Z`（离线）；复跑原始输出 = `.p9s4-closeout/final-*.out`。

### §8.8 收尾

- **受控实例** `[实跑]`：`PORT=5797 node_modules/.bin/ts-node --transpile-only src/index.ts` ⇒ 就绪（`GET /api/role-names` 200 · 受保护 `GET /api/batt` 无 token **401**）· `lsof` 精确 PID **`99827`** ⇒ `kill -TERM 99827` ⇒ **`5797` LISTEN 空**（本单实例已回收）；用户 `5787`（pid `30475`）/`5788`（pid `65096`）**未碰**（**禁** `pkill -f` / `killall`，仅精确 PID）。
  - ★ **`5796` 现被并发会话占用**（非本单）：pid `4776` = `python -m http.server 5796 --bind 127.0.0.1 --directory …/frontend/dist`（起于 `14:51:14`）+ pid `6672` = `ts-node … src/index.ts`（`PORT=5796` · 起于 `14:51:39`）。**非本单所起、未碰、未回收** ⇒ 因此「`5796–5799` 聚合 LISTEN 空」此刻**由并发写入者占位**而不成立，**非本单实例残留**（本单仅用 `5797` 且已精确回收）。
- **`git status --porcelain` 归因** `[实跑]`：末次 **217 行 = `M 21` + `?? 196`**（本单收尾时重取；`M` 集合**全程恒等**，`??` 随并发会话 run 产物增长）。
  - `M` **21 行**：**与开工快照**逐条**同一集合**（`backend-ts/.p4-artifacts/…/geometry.json` 1 · `scripts/p8-s2…s8-*.ts` 8 · `src/{database,index,ledger}.ts` 3 · 前端 `BattCheckinPanel.jsx` + 四语 `locales` 5 · 四个 `i18n-*.test.jsx` 4）—— 其中 `src/database.ts` 的 `M` 含**本单 `F-α` 最小修**，其余为 P9④ 既存**在途**改动（**非本单**）。
  - `??` **196 行** = **run-artifact 目录 186 行**（`.p4-artifacts/` · `.p8s*/` · `.p9s*/` —— 本单新增 = 各门本轮 run-tagged 目录 + `.p9s4-closeout/` 内 `.out`；余为并发会话 run 产物）+ **源码侧 10 条** = `migrations/0032–0034` 3 · `scripts/p8-s5-00-recon{,2,3}.ts` 3 · **`scripts/p8-s9-bttc-gate.ts`（本单改）** · `docs/audit/p9-s4-bttc.md`（本报告 · 本单改） · `frontend/src/bttc-api.js` · `docs/qa/favicon-install-qa.md`（并发）。
  - ★ **并发写者披露（非本单）**：`?? docs/qa/favicon-install-qa.md`（mtime `14:50:46` · **本单会话中途**出现，开工快照**无**此件）⇒ **他人/并发会话所写，本单不碰、不提交、不回滚**（且 `docs/qa/**` 属本单**禁改面**）。
  - ★ **HEAD 被并发会话前移**（非本单）：开工锚 `aadece8` ⇒ 会话中途 `HEAD` 前移至 **`c004ce2`**（`462203f`→`eb1ae48`→`c004ce2`，**linear**、`aadece8` 为祖先）—— 即另一 **favicon** Kong 会话的提交（改 `docs/audit/favicon-install.md` · `frontend/index.html` · `frontend/public/brand/*`）。**本单不 `commit`/`push`/`rebase`**，改动全部留在工作区；因 `aadece8` 仍是祖先 ⇒ 本单改动**未丢**。归因：末次 `?? 196` 相对本单**早先取数** `?? 190` 的增量含并发会话的 run 产物（`frontend/dist` 服务等），非本单。
  - **本单未 `git add` / `commit` / `push`**；**未改任何** `M` 文件（`database.ts` 由 P9④ 即在途）；**未回滚**他人改动。

### §8.9 未测项更新（逐项原因，**禁填 0 / 空**）

| 未测项 | 原因（逐项） |
|---|---|
| 2 新口**真 HTTP**（`POST /api/bttc/mint` / `POST /api/bttc/burn`：无 token `401` ⇄ 有 token `200` / 拒绝面 `409`） | `p8-s9` 门**零网络**（`http_calls:0`，**设计如此**）⇒ 门内不产 HTTP 读数；真 HTTP 需**受控实例 + 已 apply 另册**（本单受控实例面为 `p8-s7`/`p8-s8`，非 BTTC 口）。**本单未新增该面**，如实登记。 |
| 前端 `bttcPanel` **UI 交互**端到端（点击铸/分解） | 依赖后端真 HTTP 面 + 受控前端实例；**超出本单写集**（本单为 `src/database.ts`（仅 `F-α`）/ `scripts/p8-s9*` / 报告）。 |
| 平台币**上市申请路径**（`R-9-44` 待办） | 平台币**不开放** `listCurrencyWithDeposit` 申请入口 ⇒ 该边**结构性不可达**；待办（未来若开放 ⇒ 修 `LD016` 零额保证金分录入径）**未实现** ⇒ 无可测活体面。 |
| 四语 `bttcPanel` **文案值**的产品 / 文案决策 | 产品决策面（非工程可测）；工程面只验**键集四语相等 + 六类工程口径泄漏 = 0 + `en`/`vn` 零 CJK**（`L1`–`L3` 现取绿）；**值**未测（如实登记，非填 0）。 |
| `ledger_entry`/`batt_entry` 等 append-only 表的**物理清理**（长期累积） | 本单所有库面写**事务内 + `ROLLBACK`**（零落盘）；appendix-only 表**无 DELETE 复原路径** ⇒ 清理策略属**运维面**，非本片可测面。 |
| `M2` 加固前的**假绿**是否在**他门**同族复现 | 仅核 `p8-s9` `E1`；**未扫**其它门的「双引号自检串锚点」同族面 ⇒ **未测**（登记为后续同族扫面待办）。 |

### §8.10 本单改动清单 + 自证

- **改动文件（恰 3 类）**：① `backend-ts/src/database.ts`（`ensureBttcCurrency` **仅** `F-α` 最小修 + 两处陈旧注释）；② `backend-ts/scripts/p8-s9-bttc-gate.ts`（`note` · 顶层 `findings` · `KC1b` · `KI1/KI2` 符号订正 · `KGS1` 期望订正 · `E1` 加固）；③ `docs/audit/p9-s4-bttc.md`（**追加本节 §8**）。
- **产物（run-tagged · 无 `.log` 后缀）**：报告追加体 = 本节；门产物 = `.p8s9-artifacts/p8s9-20261003T0642{20,44}Z/gate.json` 等；副本判负产物 = 副本内 `.p8s9-artifacts/p8s9-20261003T064{300,400,433,511,547,642,712}Z/gate.json`；复跑原始输出 = `.p9s4-closeout/final-*.out`。
- **自证**：`src/database.ts` `tsc` 0 · 门 `p8-s9` **99/99 exit 0** · 判负 4 处必红且复原回绿 · 主仓 `cmp`/`diff -rq` **SAME/IDENTICAL** · 端口空。
