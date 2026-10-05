# S41 / B14·B18·B19·B20 收尾 · ★「更正后的撞号判据」只读巡检门（`s41-00-identity-seq-collision-gate`）

> 角色：Kong（子代理）· 仓库 `/Users/kevin/bistro/seafood`（Express/TS + Neon PG18）
> 本单性质：把 S38 §1.2 更正后的撞号判据（**「`nextval` 落在已占用集合内」**，非「`seq ≤ max`」）
> 固化成**一道只读巡检门**：全库 `public` 的 identity/serial 列逐列三态（FAIL/WARN/OK）+ 基线 + 类级自证 + `--selftest` + 仓外判负。
> 硬口径遵守：**只许新增** 4 类路径（本门 `.ts` / `.baseline.json` / 本报告 / `.s41-artifacts/<runid>/`）；
> 连库**仅**进程内 `dotenv`（绝对路径 `backend-ts/.env.local`，**未** 在 shell 里 source/export `.env*`），**未**打印密钥值；
> **零 DML/DDL/序列写**（**禁** `nextval` / `setval` / INSERT / UPDATE / DELETE）；**未**起实例（本单不需要，未占用 5792–5799）；
> **未** `pkill -f` / `killall`；**未** commit / push；**未** `npm install`；原始输出**不用 `.log`**（用 `.txt`/`.json`）；
> **未改任何既有文件**（不动 15 门、不动产品/迁移/规范/台账）。
> 产物目录：`backend-ts/.s41-artifacts/s41-20261005T120535Z/`

---

## §0 对锚

**开工前（现取）**：
```
$ cd /Users/kevin/bistro/seafood && git log --oneline -3
5f56daf docs(open-items): 固化验收门套口径为成文条款（15 门 = 13 基线 + s5-02 + s36-00 + p7b-03；…）+ 派 S41 …
cbd5c0a docs: §5.364/v0.364 —— ★★S40b 全批收口（15 门口径落定 …）
c0c5fde fix(gate): S40b —— p8-s7 G9 改为「完整数据态模型」 …
                                                                        ← **与派单锚一致** ✓（HEAD 含 5f56daf）

$ git status --porcelain | grep -cE '^ M|^M'
0                                                                       # 开工时 tracked 零改动
```

**收工时对锚（★ HEAD 被并发会话推进 —— 登记，非本单所为）**：
```
$ git log --oneline -1
b2e8b41 docs: §5.365/v0.365 —— … + 派 S41（把更正后的撞号判据固化成只读巡检门，落地后成 16 门）

$ git status --porcelain | grep -cE '^ M|^M'
0                                                                       # 收工时 tracked 仍零改动（本单零既有文件改动）
$ git status --porcelain | grep -E 's41'
?? backend-ts/.s41-artifacts/
?? backend-ts/scripts/s41-00-identity-seq-collision-gate.baseline.json
?? backend-ts/scripts/s41-00-identity-seq-collision-gate.ts
                                                                        # 仅本单新增三处 + 报告（docs/audit/s41-…md）
```
**HEAD 漂移说明（不洗白）**：开工 `5f56daf` → 收工 `b2e8b41`，中间那笔是 **Zang 的 docs 派单提交**
（`b2e8b41` 内容 = §5.365 台账 + 明确「派 S41」），**仅触 `docs/`**，与本单读写面（`backend-ts/scripts/**`、`backend-ts/.s41-artifacts/**`、`docs/audit/s41-…`）**零交集** ⇒ 无冲突。**非本单所为**。

**现取依据**：`docs/audit/s36-implicit-identity-pk-inventory.md`（188 处 / R1=11·R2=43·R3=134 + 23 identity 列）·
`docs/audit/s38-residual-30-triage.md` §1.2（★ **判据纠偏**）· `backend-ts/scripts/s36-00-identity-pk-form-gate.ts` / `.baseline.json`（格式与自证口径对齐）。

---

## §1 判据口径（**引用 S38 §1.2 的终审更正**，逐字沿用）

**★ 撞号判据不是「`seq ≤ max`」，而是「`nextval` 落在已占用集合内」。**
依据（`s38-residual-30-triage.md` §1.2 逐字）：`users` 序列 `last_value=41`（`next=42`）而 `uid=42` **现存 0 行**（空位）
⇒ 取 42 **不撞**；但若某表的**已占用集合**里存在小于等于 `nextval` 的位（典型：夹具残差固定号 `900001`）⇒ **当序列爬到那里就撞**。

S38 §1.2 的精确口径（逐字引）：
> 「**既非「当下必撞」，也非「仅在某些库必撞」**；精确口径 = **「当下不撞；仅当序列爬升到某个已占用 uid（本库最近=900001，距 42 约 9.0e5）时才会撞，而那个占用位本身依库而存在」**。」

本门据此定义（**逐字落地派单口径**）：
- **判据 1（撞号直接证据）** = 已占用集合中存在 `col = nextval` 的行 ⇒ **FAIL**（当下就撞）。
- **判据 2（撞号逼近度）** = `gap = 下一个已占用位 − nextval`；`0 < gap ≤ 阈值` ⇒ **WARN**（序列爬到即撞，进入预警带）。
- **判据 3（`gap ≤ 0`）** ⇒ **FAIL**（防御性；正常情况下 `next_occupied > nextval` 恒真，故 `gap ≤ 0` 只可能来自异常）。
- 其余（`gap > 阈值` / 序列上方无已占用位 / 已占用集合为空）⇒ **OK**。
- **阈值**默认 `1000`，env `S41_GAP_THRESHOLD` 可覆写。
- ★ 口径与 S38 逐字一致：**空位不撞**（`users` 取 42 不撞，因 42 未被占用）；**夹具残差固定号（900001）才是真撞点**（序列爬到即撞）。

---

## §2 受体枚举与逐列读数表

### 2.1 受体枚举（现取，只读）

**受体 = 全库 `public` 中带 identity / serial（`nextval` 默认值）的列**：
```sql
SELECT c.table_name, c.column_name,
       CASE WHEN c.is_identity='YES' THEN c.identity_generation ELSE 'serial/nextval' END AS generation,
       c.is_identity, pg_get_serial_sequence('public.'||quote_ident(c.table_name), c.column_name) AS seq
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
 WHERE c.table_schema='public' AND (c.is_identity='YES' OR c.column_default LIKE 'nextval(%')
 ORDER BY c.table_name, c.column_name;
```
```
受体数 = 23   （is_identity=YES 22 + serial 1[=schema_migration.id]）
server : db=neondb  addr=169.254.254.254/32  pgver=18.6  usr=neondb_owner
```

**★ 与 `s36-00` 的 23 列对齐（差异写明）**：
- **表×列集合 = 23/23 逐字一致**（逐项对齐 `s36-00-identity-pk-form-gate.baseline.json` 的 `identity_pk` 数组）。
- **差异 = 序列 `last_value`/`nextval` 数值漂移**：本门读数系**新现取**，与 S36 盘点时刻不同（该库历次跑门会消耗序列）。
  例：`batt_entry` seq_next 637(S36)→**660**(本单)；`currency` 339(S36)→**367**(本单)；`users` 42(S36)=**42**(本单)。
  **非列集合差异，仅为时点漂移**；本门基线以本单现取为准。
- 口径差异：`s36-00` 判「同表双形态」（词法级，零 DB）；本门判「序列值域撞号」（读数级，只读连库）。**两者互补，非替代**。

### 2.2 逐列读数表（23 列全量，现取 `readings-live.json`）

**读法**：`nextval` = `is_called ? last_value + increment_by : last_value`（由**只读** `SELECT last_value,is_called FROM <seq>` ＋ `pg_sequences.increment_by` 推算，**未跑** `nextval`）。
`下一已占位` = `SELECT min(col) FROM <表> WHERE col > :nextval`；无上方已占用位 ⇒ `null`。
`gap` = `下一已占位 − nextval`；`null` 时判 OK（**含「已占用集合为空」**）。

| # | 表 | 列 | 生成方式 | last_value | is_called | **nextval** | **下一已占位** | **gap** | 态 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | admin_ops_audit_log | log_id | BY DEFAULT | 9 | true | 10 | null | null | OK |
| 2 | admin_refund_audit_log | log_id | BY DEFAULT | 7 | true | 8 | null | null | OK |
| 3 | batt_entry | txid | ALWAYS | 659 | true | 660 | null | null | OK |
| 4 | checkin_log | log_id | BY DEFAULT | 257 | true | 258 | null | null | OK |
| 5 | checkin_makeup_log | log_id | BY DEFAULT | 104 | true | 105 | null | null | OK |
| 6 | commission_policy | policy_id | BY DEFAULT | 36 | true | 37 | null | null | OK |
| 7 | currency | cid | BY DEFAULT | 366 | true | 367 | null | null | OK |
| 8 | currency_review_log | log_id | BY DEFAULT | 38 | true | 39 | null | null | OK |
| 9 | currency_status_log | log_id | BY DEFAULT | 64 | true | 65 | null | null | OK |
| 10 | job | job_id | BY DEFAULT | 272 | true | 273 | null | null | OK |
| 11 | job_application | application_id | BY DEFAULT | 65 | true | 66 | null | null | OK |
| 12 | job_arbitration_log | log_id | BY DEFAULT | 28 | true | 29 | null | null | OK |
| 13 | job_submission | submission_id | BY DEFAULT | 248 | true | 249 | null | null | OK |
| 14 | ledger_entry | txid | ALWAYS | 2629 | true | 2630 | null | null | OK |
| 15 | listing | listing_id | BY DEFAULT | 44 | true | 45 | null | null | OK |
| 16 | listing_order | order_id | BY DEFAULT | 39 | true | 40 | null | null | OK |
| 17 | listing_order_event | event_id | BY DEFAULT | 390 | true | 391 | null | null | OK |
| 18 | listing_review_log | log_id | BY DEFAULT | 19 | true | 20 | null | null | OK |
| 19 | market_order | order_id | BY DEFAULT | 26 | true | 27 | null | null | OK |
| 20 | market_trade | trade_id | BY DEFAULT | 8 | true | 9 | null | null | OK |
| 21 | rating | rating_id | BY DEFAULT | 390 | true | 391 | null | null | OK |
| 22 | schema_migration | id | serial/nextval | 42 | true | 43 | null | null | OK |
| 23 | **users** | **uid** | BY DEFAULT | **41** | true | **42** | **900001** | **899959** | **OK** |

**关键读数（与派单逐字一致）**：`users`：`last=41 → next=42`、**已占下一位 `900001`、`gap≈899959` ⇒ OK** ✓
（`uid=42` 现存 0 行 = 空位 ⇒ 不撞；最近撞点 = 夹具残差 `900001`，距 42 约 `9.0e5`）。

---

## §3 三态判定（现取：23/23 = OK；`FAIL=0 / WARN=0 / UNKNOWN=0`）

```
$ cd backend-ts && npx ts-node --transpile-only scripts/s41-00-identity-seq-collision-gate.ts
verdict = GREEN   exit_code = 0
state_summary = { OK: 23, WARN: 0, FAIL: 0, UNKNOWN: 0 }
[自证] 受体数=23  命中数=23(读数命中)  违例数=0(FAIL=0/WARN=0/UNKNOWN=0)  基线数=23(基线违例=0)  新增=0  阈值=1000
```

**逐条判定规则（现取，与 §1 口径同源）**：
| 态 | 触发条件 | 意义 |
|---|---|---|
| **FAIL** | 存在 `col = nextval` 的行 或 `gap ≤ 0` | 序列**已撞**已占用位（当下撞号） |
| **WARN** | `0 < gap ≤ 阈值(默认 1000)` | 序列**逼近**已占用位（爬到即撞） |
| **OK** | `gap > 阈值` 或 `next_occupied = null`（上方无已占位 / 已占用集合为空） | 无活体撞号对 |

**退出码口径**：`0`=绿(全 OK) / `3`=红(有 FAIL / 新增违例) / `4`=黄(仅 WARN) / `5`=**断言无效** / `2`=致命(连库失败等)。

**★「空集不误报」现取**：22 列 `next_occupied=null`（其上方已占用集合为空）**全部判 OK，无一误报 FAIL** —— 这正是判据纠偏
（旧口径「`seq ≤ max`」会把它们中的 `users`（`42 ≤ 971213`）判红；新口径下 `users` 因 **42 是空位**而 OK）。

---

## §4 类级自证 + `--selftest` 逐例

### 4.1 类级自证（缺一不可，对齐 `s36-00` / `p4z-i18nviol-global` 家族）

| 读数 | 现取 | 说明 |
|---|---|---|
| **受体数** | **23** | 枚举到的 identity/serial 列数 |
| **命中数** | **23（读数命中）** | **成功读得三读数（nextval / 下一已占位 / gap）**的受体列数；`受体=0 或 命中=0 ⇒ 自标「断言无效」`（EXIT 5），**一律不得当「零违例」** |
| **违例数** | **0**（`FAIL=0 / WARN=0 / UNKNOWN=0`） | 态 ≠ OK 的列数（= 门「真的响了」的次数） |
| **基线数** | **23**（基线违例 `0`） | 基线登记的列数；基线违例 = 基线 `flags` 里登记的 FAIL/UNKNOWN |
| **新增** | **0** | 违例中**不在**基线违例名单者（零容忍 ⇒ 红） |

**无效断言（INVALID）三触发**：① 受体数 = 0；② 命中数 = 0（无任何一列读得出读数）；
③ 基线登记了违例列但本次一个都不复现（判据未生效）。⇒ 三者任一成立即 **EXIT 5**，**不得**当绿。

### 4.2 `--selftest`（内存合成数据，不连库 / 不落盘 / 不改仓）—— **6/6 逐条 PASS**

```
$ cd backend-ts && npx ts-node --transpile-only scripts/s41-00-identity-seq-collision-gate.ts --selftest
  PASS  ① gap 极小 ⇒ WARN  [state=WARN gap=50 yellow=true red=false]
  PASS  ② nextval 已在已占集合内 ⇒ FAIL  [state=FAIL hit=true red=true]
  PASS  ③ gap 很大 ⇒ OK  [state=OK gap=899959 (gap=899959 > 阈值 1000（下一个已占用位 900001 距 nextval 42 尚远）)]
  PASS  ④ 已占用集合为空 ⇒ OK（不得 FAIL）  [state=OK next_occupied=null]
  PASS  ⑤ 受体=0 ⇒ 断言无效（非绿）  [recipients=0 invalid=true]
  PASS  ⑥ 命中(读数)=0 ⇒ 断言无效（非绿）  [readings_ok=0 invalid=true]
SELFTEST PASS (6/6)                        → SELFTEST_EXIT=0
```
逐例读法：① 合成 `nextval=100, 下一已占位=150, gap=50 ≤ 1000` ⇒ WARN；② 合成 `nextval=42, hit=true`（已占集合内含 42）⇒ FAIL；
③ 合成 `gap=899959 > 1000` ⇒ OK（**与 `users` 实测同态**）；④ 合成 `next_occupied=null` ⇒ OK（**防空集误报**，含「已占用集合为空」）；
⑤ 受体=0 ⇒ INVALID（非绿）；⑥ 全部列读数失败 ⇒ INVALID（非绿）。**⑥ 即「命中=0 ⇒ 无效」的字面实现**。

---

## §5 基线登记

**文件**：`backend-ts/scripts/s41-00-identity-seq-collision-gate.baseline.json`（**新增**；md5 `756568ddccdd0e233325988bf56b2c01`）
**内容**：`meta`（判据/来源/阈值/锚/runid/只读）+ **`columns` 23 条**（每条含 **表 / 列 / 生成方式 / is_identity / seq / nextval / 下一已占位 / gap / 态**）
+ `flags`（基线违例名单；**现取 = 空**，因 23/23 全 OK）+ `column_count=23` / `flags_count=0`。

**登记要点**：`users.uid` = `{nextval:"42", next_occupied:"900001", gap:"899959", state:"OK"}`（逐字对应派单要求）。
**比较语义**：巡检时逐列读数与基线比对 → 基线缺失的列 = `[ADDED]`；库中消失的列 = `[STALE-WARN]`（不致命）；
**新增违例** = 当前 FAIL 且不在基线 `flags` ⇒ **零容忍 ⇒ 红**。

**★ 口径说明（防歧义）**：本基线的「基线违例」= **FAIL/UNKNOWN**（需长期观测的撞号），**不含 WARN**
（WARN 是「逼近预警」，是**动态**读数，不应当作基线常态；WARN 会以 `EXIT 4` 独立报出且计入 `违例数`）。

---

## §6 判负（**仓外副本**，`cp -R` 到 agent scratch，主仓零残留）

**构造**：`cp -R backend-ts/scripts` 到 agent scratch 的 `repo-copy/`（**仓外**，非本仓工作区），
副本内用 `--readings <json>` 离线回放（**不连库 / 不写库**）制造控制态；`S41_GAP_THRESHOLD` env 覆写阈值。

```
$ SCRATCH=/Users/kevin/.hermes/profiles/zang/cache/scratch/s41-negctrl
$ cp -R backend-ts/scripts "$SCRATCH/repo-copy/backend-ts/scripts"        # 仓外副本（302 件）
$ G="$SCRATCH/repo-copy/backend-ts/scripts/s41-00-identity-seq-collision-gate.ts"
$ TS_NODE_PROJECT=<主仓>/backend-ts/tsconfig.json npx ts-node --transpile-only "$G" --readings <…>
```

| 控制 | 构造 | 现取读数 | 判定 |
|---|---|---|---|
| **POS（克隆保真）** | 副本 + **真读数**（`readings-live` 复制）+ 默认阈值 | 受体 23 / 命中 23 / 违例 0 / 新增 0 / `invalid=false` | **EXIT 0 绿** ✓（副本是忠实的门克隆） |
| **NEG-RED（撞态 ⇒ 必红）** | 副本 + 撞态读数：`users.uid` 的**已占用集合内含 `nextval=42`**（`hit_at_nextval=true`） | 受体 23 / 命中 23 / **违例 1(FAIL=1)** / **新增 1** | **EXIT 3 红** ✓ `[NEW-FAIL] users.uid nextval=42 next_occupied=900001 gap=899959 :: nextval=42 已落在已占用集合内（存在 users.uid=42 的行）` |
| **NEG-WARN（阈值极端 ⇒ 必 WARN）** | 副本 + **真读数** + `S41_GAP_THRESHOLD=99999999999` | 受体 23 / 命中 23 / **违例 1(WARN=1)** / 新增 0 / 阈值 99999999999 | **EXIT 4 黄** ✓ `[WARN] users.uid nextval=42 … gap=899959 :: gap=899959 ≤ 阈值 99999999999` |

**主仓零残留**（现取）：
```
$ git status --porcelain | grep -cE '^ M|^M'          → 0                  # 无 tracked 改动
$ git status --porcelain | grep -E 's41'              → 仅本单三处新增（.s41-artifacts/ + 门 + 基线）
（仓外副本不与主仓工作区相通 ⇒ 主仓零残留；判负读数落盘 .s41-artifacts/<runid>/negctl-{POS,RED,WARN}.{json,txt}）
```

---

## §7 未做与 `NOT_MEASURED`（不洗白）

| # | 未做 / 未测 | 说明 |
|---|---|---|
| N1 | **未**跑 `nextval` 实证「序列爬到 900001 即撞」 | 硬口径禁 `nextval`；`nextval` 由 `pg_sequences.increment_by` ＋ 只读 `SELECT last_value,is_called` 推算，**未**耗序列。 |
| N2 | **未**在真库制造撞态 | 硬口径禁 INSERT/UPDATE/DELETE；判负**在仓外副本用离线回放（`--readings`）**完成（§6），**未**触真库。 |
| N3 | `NOT_MEASURED`：**跨库/多副本** | 仅测 `.env.local` 指向的单一 dev 库（Neon `ep-holy-forest-b3fi7u3u` / `neondb`）；「条件撞依库而存在」**未**多库取样（S38/N8 同）。 |
| N4 | `NOT_MEASURED`：**产品 `users` 取号源（`MAX+1`）面** | `getNextUserId = COALESCE(MAX(uid),0)+1` 的撞号机理属 S37/S38 登记面（R1），本门只巡**序列**面，不巡 `MAX+1`。 |
| N5 | **未**追 `currency.next_occupied=null` 与 S38 期「cid≥9e8 带」的差异 | S38 期探针见 `cid` 9e8 带行；本单现取 `next_occupied=null`（即当前库无 >367 的 cid）⇒ **属库态漂移**，**未**归因（可能夹具回滚/清理）。如实登记。 |
| N6 | **未**改任何既有文件 | 未动 15 门、产品 `src/**`、`migrations/**`、三份规范件（`docs/*.spec.md` / `OPEN-ITEMS.md` / `master-plan.md`）、台账。**登记新门由 Zang 接**。 |
| N7 | **未**做并发/压力实验 | 两实例并跑是否撞固定夹具号：**未测**（S36/N2、S37/M8、S38/N2 同）。 |
| N8 | **未** commit / push / `npm install` / 起实例 / `pkill` | 硬口径；本单未占用 5792–5799 任何端口。 |

---

## §8 自曝

1. **本单零既有文件改动**：`git status | grep -cE '^ M|^M'` **= 0**；新增仅 4 类（门 `.ts` / 基线 `.json` / 本报告 / `.s41-artifacts/`）。**未动 15 门**。
2. **★ 命名自曝（请 Zang 裁）**：本门「**命中数**」取 **「读数命中」**（成功读得三读数的受体列数，现取 23）—— 使之满足
   「**命中=0 ⇒ 断言无效**」的字面 fail-loud 规则（`--selftest`⑥ 已证），同时健康库（23/23 读得出）**判绿而非误标无效**。
   「**违例数**」（态 ≠ OK，现取 0）**单列**，不与之混同。**若 Zang 意图「违例数=0 ⇒ 无效」**（即门在健康库恒判无效），
   请明示 —— 我判该口径会把「**零撞号**」这一**正确结论**误标为「无效」，故**未采纳**，留此自曝待裁。
3. **★ 与 S38 §2.2 的一处读数差异**：S38 记 `currency_cid_seq.next=347`、上方有 9e8 带；本单现取 `next=367`、`next_occupied=null`
   （**库态已漂移**）。我**不洗白为「S38 错」**——两者是**不同时刻**的库态；本门基线以**本单现取**为准（§5）。
4. **`nextval` 的出现处仅 1 处，且非调用**：门源码里 `nextval(` 唯一出现于 `c.column_default LIKE 'nextval(%'`（**LIKE 模式**，词法匹配），
   **非** `nextval()` 调用；`SELECT`-only 证据见 §8.5。**未**跑 `setval`。
5. **纯只读证据（本单零写）**：门内**全部 6 条 SQL 均为 `SELECT`** ——
   ①`SELECT current_database()/inet_server_addr()/server_version`；②受体枚举 `SELECT … FROM information_schema.columns`;
   ③`SELECT sequencename,increment_by,start_value FROM pg_sequences`；④`SELECT last_value,is_called FROM public.<seq>`（**序列只读，不耗 nextval**）；
   ⑤`SELECT 1 … WHERE col = :nextval LIMIT 1`；⑥`SELECT min(col) … WHERE col > :nextval`。
   `grep -nE "INSERT|UPDATE|DELETE|setval|TRUNCATE|CREATE|DROP|ALTER" <门>.ts` → **仅命中第 12 行的文档注释**（口径说明文字），**无 SQL 写语句**。
6. **`tsconfig.scripts.json` 需显式 `TS_NODE_PROJECT`**：仓外副本运行时 ts-node 会因目录外解析而报 `TS5109`；
   以 `TS_NODE_PROJECT=<主仓>/backend-ts/tsconfig.json` 显式指定即解（§6 命令已含）。
7. **两口径 `tsc`（AC6，现取）**：`npx tsc --noEmit` → **EXIT 0**；
   `npx tsc -p tsconfig.scripts.json --noEmit | grep -c "error TS"` → **96**（== 开工前基线，**新增错 = 0**）；
   `… | grep -E "s41-00"` → **空**。**未改任何既有 TS 文件**（门为纯新增）。

---

## §9 产物清单（`backend-ts/.s41-artifacts/s41-20261005T120535Z/`）

```
RUNID.txt（上级目录）                    本次 runid = s41-20261005T120535Z
readings-live.json                      23 列逐列读数（只读现取）
gate-bootstrap.json                     首跑（空基线，用于生成基线）
gate-live.json / gate-live.txt          正跑（真基线 / GREEN exit 0）
selftest.txt                            --selftest 6/6 PASS
negctl-POS.json / .txt                  判负 POS（副本+真读数 ⇒ GREEN 0）
negctl-RED.json / .txt                  判负 NEG-RED（撞态 ⇒ RED 3）
negctl-WARN.json / .txt                 判负 NEG-WARN（阈值极端 ⇒ WARN 4）
```
**仓外副本（不在本仓）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/s41-negctrl/{repo-copy/,neg-red-readings.json,neg-warn-readings.json}`。
**本单新增（仓内）**：`backend-ts/scripts/s41-00-identity-seq-collision-gate.ts`（md5 `9ed2987cc1456cb96df5a8e0646a49db`）·
`…baseline.json`（md5 `756568ddccdd0e233325988bf56b2c01`）· `docs/audit/s41-identity-seq-collision-gate.md`（本报告）。
