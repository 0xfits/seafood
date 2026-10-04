# S26 · 台账 B9 —— `append-only` 真实边界补齐（`BEFORE TRUNCATE` 守卫）

- **单号**：S26（台账 B9）
- **角色**：Kong（实现方）
- **仓库**：`/Users/kevin/bistro/seafood`（Express/TS 后端 + Neon PG18）
- **RUNID**：`S26-20261004T210633Z`
- **产物目录**：`backend-ts/.s26-artifacts/S26-20261004T210633Z/`
- **语言**：中文

---

## §0 对锚

| 项 | 命令 | 读数 |
|---|---|---|
| HEAD | `git log --oneline -3` | `49ecc35`（…S22 补落单回执）· `7e59ace` · `51a5d6c` |
| HEAD 全量 | `git rev-parse HEAD` | `49ecc3534ab69dd7323bbfe5bd67bffc532d897b` |
| 工作区 | `git status --porcelain` | 仅 `?? backend-ts/.p*-artifacts/**` + `?? frontend/.s22-artifacts/**` 等**既有未跟踪产物目录**（开工前即如此，无已跟踪文件改动） |

对锚结论：**HEAD = `49ecc35`**，开工前工作区只含既有未跟踪产物目录。

---

## §1 append-only 表清单（**文件面 + 库面双口径**）

### §1.1 现取命令

```bash
# 文件面
grep -rn "BEFORE UPDATE OR DELETE\|BEFORE DELETE OR UPDATE\|append_only\|tgtype" backend-ts/migrations/*.sql
grep -rn "CREATE TRIGGER" backend-ts/migrations/*.sql
grep -rn "EXECUTE format\|EXECUTE 'CREATE" backend-ts/migrations/*.sql   # 查有无 DO 块动态建触发器 → 无
# 库面（只读探针：进程内 dotenv.config，禁 source）
node backend-ts/.s26-artifacts/S26-20261004T210633Z/probe-triggers.js
```

### §1.2 双口径逐表（**15 张 · 完全一致**）

| # | 表 | 建它的迁移:行（触发器 + 函数） | 触发器名（文件面） | 触发事件 | 函数名 | 库面 `tgtype` | 库面 `tgenabled` |
|---|---|---|---|---|---|---|---|
| 1 | `ledger_entry` | `0001_ledger_core.sql:125-127`（fn `:119`） | `trg_ledger_entry_append_only` | BEFORE UPDATE OR DELETE · ROW | `ledger_entry_append_only()` | `27` | `O` |
| 2 | `referral` | `0007_...:75-77`（fn `:67`） | `trg_referral_append_only` | BEFORE UPDATE OR DELETE · ROW | `referral_append_only()` | `27` | `O` |
| 3 | `commission_policy` | `0007_...:110-112`（fn `:102`） | `trg_commission_policy_append_only` | BEFORE UPDATE OR DELETE · ROW | `commission_policy_append_only()` | `27` | `O` |
| 4 | `market_trade` | `0016_market.sql:359-361`（fn `:313`） | `trg_market_trade_append_only` | BEFORE UPDATE OR DELETE · ROW | `market_trade_append_only()` | `27` | `O` |
| 5 | `currency_status_log` | `0017_platform_config.sql:237-239`（fn `:192`） | `trg_currency_status_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `currency_status_log_append_only()` | `27` | `O` |
| 6 | `admin_ops_audit_log` | `0023_...:125-127`（fn `:114`） | `trg_admin_ops_audit_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `admin_ops_audit_log_append_only()` | `27` | `O` |
| 7 | `admin_refund_audit_log` | `0024_...:100-102`（fn `:89`） | `trg_admin_refund_audit_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `admin_refund_audit_log_append_only()` | `27` | `O` |
| 8 | `currency_review_log` | `0025_...:90-92`（fn `:79`） | `trg_currency_review_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `currency_review_log_append_only()` | `27` | `O` |
| 9 | `listing_review_log` | `0026_...:95-97`（fn `:84`） | `trg_listing_review_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `listing_review_log_append_only()` | `27` | `O` |
| 10 | `job_arbitration_log` | `0027_...:99-101`（fn `:88`） | `trg_job_arbitration_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `job_arbitration_log_append_only()` | `27` | `O` |
| 11 | `batt_entry` | `0029_batt_checkin.sql:256-258`（fn `:215`） | `trg_batt_entry_append_only` | BEFORE UPDATE OR DELETE · ROW | `batt_entry_append_only()` | `27` | `O` |
| 12 | `checkin_log` | `0029_...:261-263`（fn `:226`） | `trg_checkin_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `checkin_log_append_only()` | `27` | `O` |
| 13 | `checkin_makeup_log` | `0029_...:266-268`（fn `:237`） | `trg_checkin_makeup_log_append_only` | BEFORE UPDATE OR DELETE · ROW | `checkin_makeup_log_append_only()` | `27` | `O` |
| 14 | `rating` | `0031_...:171-173`（fn `:146`） | `trg_rating_append_only` | BEFORE UPDATE OR DELETE · ROW | `rating_append_only()` | `27` | `O` |
| 15 | `listing_order_event` | `0031_...:176-178`（fn `:157`） | `trg_listing_order_event_append_only` | BEFORE UPDATE OR DELETE · ROW | `listing_order_event_append_only()` | `27` | `O` |

> `tgtype` 位义：`ROW=1 · BEFORE=2 · INSERT=4 · DELETE=8 · UPDATE=16 · TRUNCATE=32`。故 `27 = 1+2+8+16` = **ROW · BEFORE · DELETE · UPDATE**。

### §1.3 一致性判定

- **文件面 append-only 守卫 = 15**（全部 `CREATE TRIGGER trg_<t>_append_only … BEFORE UPDATE OR DELETE … FOR EACH ROW`，`grep CREATE TRIGGER` 穷举）。
- **库面 append-only 守卫 = 15**（`pg_trigger`，`tgtype=27`、`tgenabled='O'`、`NOT tgisinternal`）。
- **逐表名 + 触发器名 + 函数名一一对应 ⇒ 双口径一致**（探针字段 `append_only_guards_exact_upd_and_del`，共 16 条；其中 `account::trg_account_guard`（`tgtype=31` = BEFORE INSERT|DELETE|UPDATE）**非** append-only 表（可变余额表，`account_guard` 语义），**已在口径外显式剔除** ⇒ 真 append-only = 15）。
- **`TRUNCATE` 现状：库面 `existing_before_truncate_triggers = []`**（全仓 **零** `BEFORE TRUNCATE` 触发器）⇒ B9 缺口坐实。
- `migrations/*.sql` 内**无** DO 块动态建触发器（`EXECUTE format('…CREATE…')` 穷举仅命中 `0006` 的 `RENAME CONSTRAINT`，与本议题无关）⇒ 文件面清单穷尽。

---

## §2 迁移形态与先例引用

### §2.1 新增文件

- **`backend-ts/migrations/0043_truncate_guard.sql`**（**未 apply**）
- `sha256 = 60bcd0c2f064ec012625cd3773d718fbf11c2a32099cebe5f4b1d31b79195850` · `15243` 字节

### §2.2 手法（逐项先例）

| 形态要素 | 先例（现取） | 0043 照抄 |
|---|---|---|
| 守卫函数形态 | `0023:114-119` `admin_ops_audit_log_append_only()`：`CREATE OR REPLACE FUNCTION public.<t>_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '… is append-only: % forbidden (…=%)', TG_OP, …; END $$;` | 同形；因 `TRUNCATE` 为**语句级无 `OLD` 行**，错误消息**省略** `OLD.<pk>` 位：`RAISE EXCEPTION '<t> is append-only: % forbidden', TG_OP;` |
| 错误码 | 既有 append-only 守卫一律**原生 `RAISE EXCEPTION`**（默认 **`P0001`**，**不借账本错误码**）—— 见 `0001:121` / `0017:200` / `0023:122` / `0029:223` / `0031:154` 的 `COMMENT` 逐处自陈 | **零新造错误码**，沿用原生 `RAISE EXCEPTION`（`P0001`） |
| 触发器幂等 | `0029:255-268` / `0031:170-178`：`DROP TRIGGER IF EXISTS …` + `CREATE TRIGGER …` | 同形 |
| 函数命名 | 既有 `_append_only`（15 枚）**不可复用**（`CREATE OR REPLACE` 会覆写既有函数体 ⇒ 硬禁）；沿 `_no_delete` 家族（`0013` 的 `job_no_delete` / `trg_job_no_delete`） | 新名 `public.<t>_no_truncate()` / `trg_<t>_no_truncate` |
| 触发器事件 | `TRUNCATE` **不支持行级**触发器（PG 语义） | `BEFORE TRUNCATE ON public.<t> FOR EACH STATEMENT EXECUTE FUNCTION …` |
| apply-time 自检（“每表恰一触发器”断言） | `0029:360-371`：`FOR … LOOP SELECT count(*) … WHERE … (t.tgtype & 2)<>0 AND (t.tgtype & 8)<>0 AND (t.tgtype & 16)<>0; IF <> 1 THEN RAISE EXCEPTION …` | 同形，改判据位为 `(t.tgtype & 2)<>0 AND (t.tgtype & 32)<>0`（BEFORE+TRUNCATE）并加 `(t.tgtype & 1)=0`（**statement 级**） |
| apply-time 自检（“上游版本行在场”） | `0027:213-215`：`SELECT count(*) INTO v_n FROM public.schema_migration WHERE version IN ('0025','0026'); IF v_n <> 2 THEN RAISE EXCEPTION …` | 同形：`SELECT count(*) FROM public.schema_migration WHERE version = '0042'; IF v_n <> 1 THEN RAISE …` |

### §2.3 0043 的硬边界（自陈）

- **不改 `0001`–`0042` 任何文件字节**；**不动任何既有函数体**；**不 `ALTER` / 不删任何既有对象**（`DROP TRIGGER IF EXISTS` 仅针对本迁移新建的 `trg_*_no_truncate`，首跑为无操作）。
- 不新增列 / 表 / 错误码；不写任何业务数据（**纯 DDL**）。
- 保护对象 = **15 张 append-only 表**，逐表 1 函数（`CREATE OR REPLACE`）+ 1 触发器（`DROP IF EXISTS` + `CREATE`）= **15 函数 + 15 触发器**。
- 幂等：`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` + 末尾 apply-time `DO` 自检。

---

## §3 单事务真跑四读数（**禁 `COMMIT` · 已 `ROLLBACK`**）

脚本：`backend-ts/.s26-artifacts/S26-20261004T210633Z/dry-run-0043.js`（**未跑 `scripts/migrate.ts`**）
原始输出：`backend-ts/.s26-artifacts/S26-20261004T210633Z/dry-run-0043.out.json`

流程：`BEGIN` → `client.query(<0043 全文>)` → 取读数 → **`ROLLBACK`** → 再取读数。

| 读数 | 判据 | 结果 |
|---|---|---|
| **① 无错** | 0043 全文在同一事务内执行无异常 | ✅ `step2_run.ok = true` |
| **② 回滚后新触发器无新行** | `ROLLBACK` 后 `pg_trigger` 中 `BEFORE TRUNCATE` 触发器数 = 0 ∧ `%_no_truncate` 函数数 = 0 | ✅ 均 = **0** |
| **③ 版本表无新行** | `ROLLBACK` 后 `schema_migration` 仍 `n=41 / max=0042`，无 `'0043'` 行 | ✅ `n=41` · `mx='0042'` |
| **④ 既有对象复原（对拍）** | `ROLLBACK` 前后 `public` 全部非内部触发器的 `table::trigger::tgtype::tgenabled` 签名**逐字相同** | ✅ 前后签名串**相等** |

**事务内中间态（佐证迁移生效）**：

- `truncate_trigger_count = 15`，且 `per_table_truncate_triggers` **逐表 = 1**（15/15）。
- `%_no_truncate` 函数数 = **15**。
- `full_public_trigger_count` 由 54 → **69**（+15，恰为本迁移新建）；既有 append-only 守卫**未被改动**（自检断言 `BEFORE…DELETE+UPDATE` 每表仍 = 1）。
- **守卫实测触发**：事务内执行 `TRUNCATE public.rating` ⇒ **`SQLSTATE = P0001`** · 消息 `rating is append-only: TRUNCATE forbidden` ⇒ 守卫**真实阻断 `TRUNCATE`**。

**真实库面（探针，非事务）复核**：`schema_migration = {n:41, mx:'0042'}`；`existing_before_truncate_triggers = []` ⇒ 0043 **确未 apply**。

---

## §4 冻结面前推逐门表（`MIGRATIONS_FROZEN` 41 ⇒ 42）

### §4.1 全仓现取（穷举）

```bash
grep -rn 'MIGRATIONS_FROZEN' backend-ts/scripts/*.ts
```
命中 **恰 4 门**（与判据 `migFiles.length === MIGRATIONS_FROZEN` 同处）：

| 门文件 | 常量行（前→后） | 判据行 | 判据 | 增量出处 | 前读数 | 后读数 |
|---|---|---|---|---|---|---|
| `p8-s3-deposit-gate.ts` | `83 → 84` | `E6`（`:255`） | `migFiles.length === MIGRATIONS_FROZEN` | `+0043_truncate_guard.sql`（删列 = 0） | `41` | **`42`** |
| `p8-s3b-address-gate.ts` | `72 → 73` | `G4`（`:278`） | 同上 | 同上 | `41` | **`42`** |
| `p8-s4-currency-review-gate.ts` | `70 → 71` | `H1`（`:326`） | `… && migFiles.length === MIGRATIONS_FROZEN` | 同上 | `41` | **`42`** |
| `p8-s5-compliance-gate.ts` | `79 → 80` | `H1`（`:411`） | 同上 | 同上 | `41` | **`42`** |

- 各门**仅**：常量 `41 → 42` + 新增 1 行出处注释 `// ★ S26 台账 B9 门前推：迁移文件数 41 → 42（+0043_truncate_guard …）`。
- **判据语义与条数一字未动**（仍为 `migFiles.length === MIGRATIONS_FROZEN`；`migFiles` 仍 `readdirSync(...migrations).filter(.sql)`）。
- 磁盘现取：`ls backend-ts/migrations/*.sql | wc -l = 42`（前 41 → 后 42）。

### §4.2 另现取别处硬编码 41 / `'0042'`（逐处判定）

```bash
grep -rn "41\b" backend-ts/scripts/*.ts | grep -i migra
grep -rn "0042" backend-ts/scripts/*.ts
```

| 处 | 形态 | 判定 | 依据 |
|---|---|---|---|
| `p8-s9-bttc-gate.ts:516` `K5` | `Number(sm[0].n) === 41 && String(sm[0].mx) === '0042'` | **不改** | 读**库面 `schema_migration` 已 apply 行数**（活体只读）；0043 **未 apply** ⇒ 库面仍 41/0042 ⇒ 判据仍真 |
| `p8-s10-invite-reward-gate.ts:329` `K2` | 同上（`sm.n === 41 && sm.mx === '0042'`） | **不改** | 同上 |
| `p8-s11-audit-console-gate.ts:469` `K1` | 同上 | **不改** | 同上 |
| `p3j-02-cases.ts`（`15/100/101/109/116/124/126/136/159`） | 引用 `0042` 的**行为**（`open→settled` 合法边 / `R-9-101`） | **不改** | 语义引用（非文件计数）；与迁移条数无关 |
| `p8-s9/s10/s11` 各 `comment`（`:11/29/…`） | 注释文案 `schema_migration 41 行 · 0042` | **不改** | 描述库面现状，仍真 |

> 结论：全仓硬编码「迁移文件数」仅 §4.1 的 4 门（已前推）；硬编码「库面 apply 行数」仅 §4.2 的 3 门（s9/s10/s11，**本单不 apply ⇒ 不动**）。**无遗漏**。

---

## §5 未做与 NOT_MEASURED

| 项 | 状态 | 说明 |
|---|---|---|
| `0043` **apply** | **未做（硬口径：禁）** | 未跑 `scripts/migrate.ts`；库面 `schema_migration` 仍 41/0042（探针 + dry-run 双证） |
| 库面「15 张表上 `BEFORE TRUNCATE` 守卫**已 apply 且现役**」 | **NOT_MEASURED** | 需 apply 后方可测；本单只测「单事务内真跑中间态」（15/15 已建） |
| 三张 DB-live 门（s9/s10/s11）**实跑受控实例真 HTTP** 腿 | **NOT_MEASURED** | 非本单验收面（`s3/s3b/s4/s5` 已实跑）；未起受控实例 |
| `p8-s9/s10/s11` 的 `41·0042` 硬编码在**未来 apply 0043 后**需否前推 | **NOT_MEASURED（越界）** | 属「apply 0043」那一单的事；本单严禁 apply |

---

## §6 自曝

1. **允许红 ≤ 实测红**：验收 AC4 只预设「受控实例真 HTTP 腿 `fetch failed`」一种已知环境红，但 `p8-s3` / `p8-s3b` 实跑**各报 1 红且非 `fetch failed`**：
   - `p8-s3` · `D5`（`failClosed`）：「兜底常量标 `TODO: Kevin 定值`」判据 `false`；
   - `p8-s3b` · `F4`（`failClosed`）：同判据 `false`。
   **两条红均测 `backend-ts/src/currency-service.ts` 内是否含字面 `TODO: Kevin 定值`**（现取：`grep -rn "TODO: Kevin 定值" backend-ts/src/` **零命中**）⇒ 与迁移前推**完全无关**。
   **已证预存**：`git archive HEAD` 取 **pristine HEAD**（`49ecc35`，41 迁移）到 scratch 并**原样实跑**两门 ⇒ **同样各 1 红、同一 `D5`/`F4`**（见 `pristine-p8-s3-deposit-gate.out` / `pristine-p8-s3b-address-gate.out`）。即：**此前推未引入任何新红**；`E6`/`G4`/`H1` 判据**全绿**。
2. **`p8-s3`/`p8-s3b` 描述串未动**：`E6`/`G4` expect 文案仍含「**零新增迁移 / 零 DDL**」（`R-8-5` 语境）。该串属判据**说明文案**，非判据本身；为守「判据语义不得动」**未改**。若后续要求文案与 `42` 自洽，可另开单。
3. **错误消息省略 `OLD.<pk>`**：因 `TRUNCATE` 语句级无 `OLD` 行，新守卫消息为 `'<t> is append-only: % forbidden'`（对比既有行级守卫含 `(…=%)` 位）。**`P0001` 原生码形态一致**，仅去掉无意义的行标识位。
4. **命名 `_no_truncate` 系强制**：既有 `_append_only` 名不可复用（`CREATE OR REPLACE` 会覆写既有函数体 ⇒ 触犯硬边界），故沿 `_no_delete` 家族取新名。
5. **`account` 表显式排除**：库面 `trg_account_guard`（`tgtype=31`）含 `UPDATE|DELETE` 位，但为可变余额表（非 append-only）⇒ 未纳入 15 张目标；若口径要求把「任何含 `BEFORE UPDATE OR DELETE` 的表」一律加闸，需另议（本单按台账 B9「append-only 表」原义取 15）。
6. **沙箱临时物**：pristine HEAD 副本落在 `…/cache/scratch/s26-pristine`（scratch 区，非仓库）；产物后缀均非 `.log`（遵 ⑦）。

---

## 附：产物清单（`backend-ts/.s26-artifacts/S26-20261004T210633Z/`）

| 文件 | 内容 |
|---|---|
| `probe-triggers.js` | 库面只读探针（`pg_trigger` 全量 + append-only 判定 + `schema_migration`） |
| `db-probe.out.json` | 探针原始输出（含 15 行 append-only 双口径清单 + `BEFORE TRUNCATE = []`） |
| `dry-run-0043.js` | 0043 单事务真跑脚本（`BEGIN…ROLLBACK`，禁 `COMMIT`） |
| `dry-run-0043.out.json` | 四读数 + 中间态 + 守卫实测（`P0001`）原始输出 |
| `gate-p8-s3-deposit-gate.out` / `gate-p8-s3b-address-gate.out` / `gate-p8-s4-currency-review-gate.out` / `gate-p8-s5-compliance-gate.out` | 四门实跑输出（前推后） |
| `pristine-p8-s3-deposit-gate.out` / `pristine-p8-s3b-address-gate.out` | pristine HEAD 对照实跑（证 `D5`/`F4` 预存） |
