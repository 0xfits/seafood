# 0049 · seed BTTC 载体行（修 `ensureBttcCurrency` 零调用点死链）+ 门指纹 47/0048 → 48/0049

- 单号 / 形态：迁移 seed（**方案 A**，Kevin 裁定）＋ 同批前推迁移结构指纹门
- 仓 / 分支 / 基点：`/Users/kevin/bistro/seafood` · `main` · HEAD `5da4228`（开工时工作区干净）
- 结论：**已实现、静态面全绿、未 apply、未 push**（apply 由 Zang 执行）
- **零库操作声明**：本单**未连接任何数据库**（无 `migrate.ts`、无 `--status`、无只读探针、无 `migrate.ts --status`、无 Neon 驱动实例化）；只做 `tsc --noEmit`、词法静态体检、以及一个**零 DB** 的既有门（`s36-00` 扫源码/迁移文本）。**未 apply、未写库、未改任何既有迁移字节。**

---

## ① 缺陷链（三行因果 · 现取）

| # | 环节 | 现取证据 |
|---|---|---|
| ① | 读口 `DatabaseService.getBttcState` 只按 `symbol='BTTC'` 查 `public.currency`；**查无行 ⇒ `status = NULL`** | `backend-ts/src/database.ts:5225-5247`（CTE `bttc` + `(SELECT bttc.status FROM bttc) AS status`，行缺 ⇒ NULL） |
| ② | 路由面把 `status === null` 透出为「不可用」⇒ 前端 `bttcAvailable = bttc && bttc.status !== null` = **false** | `frontend/src/components/BattCheckinPanel.jsx:79`；`:130` 只渲染 `t('bttcPanel.unavailable')`，`:133 {bttcAvailable && (…)}` 才是铸造/分解按钮整块 |
| ③ | 唯一会创建该行的 `ensureBttcCurrency`（幂等 `INSERT … WHERE NOT EXISTS`）**生产代码零调用点** ⇒ 「系统引导创建」无触发点 = 死链 | `grep -rn ensureBttcCurrency backend-ts/src backend-ts/scripts frontend/src` ⇒ 仅 `src/database.ts:5168`（定义）+ 门脚本 `p8-s9-bttc-gate.ts` 的三处探针调用；`src/` 内**零调用** |
| — | 后果（Zang 现取坐实）：生产 `sweet-pond-28934105` 的 `currency` 只有 1 行 `$`、dev `quiet-math-65207667` 15 行**均无 BTTC** ⇒ P9④ 铸造/分解**自上线起对所有人不可用** | 本报告引述 Zang 现取读数（本单不连库） |

修法（方案 A）：由迁移把这**一行**确定性建出来；**读口 / 写口 / 前端契约一字不动**。

---

## ② 迁移列值对照表（口径源 = `database.ts:5173-5181` `ensureBttcCurrency`，逐字）

| 列 | `ensureBttcCurrency`（源） | `0049`（本迁移） | 一致 |
|---|---|---|---|
| `symbol` | `'BTTC'::text` | `'BTTC'::text` | ✅ |
| `name` | `'battcoin'::text` | `'battcoin'::text` | ✅ |
| `owner_uid` | `0::bigint` | `0::bigint` | ✅ |
| `decimals` | `0::smallint` | `0::smallint` | ✅ |
| `status` | `'listed'` | `'listed'` | ✅ |
| `listed_at` | `now()` | `now()` | ✅ |
| `deposit_amount` | `0::bigint` | `0::bigint` | ✅ |
| `deposit_cid` | `1::bigint` | `1::bigint` | ✅ |
| `supply_cap` | `NULL::bigint` | `NULL::bigint` | ✅ |
| `is_platform_coin` | `true` | `true` | ✅ |
| `total_supply` | 不写（列默认 `0`） | 不写（列默认 `0`） | ✅ |
| `icon_url` / `time_created` / `time_updated` | 不写（列默认 `''` / `now()` / `now()`） | 不写（同） | ✅ |

列**清单与次序**亦逐字相同（`symbol, name, owner_uid, decimals, status, listed_at, deposit_amount, deposit_cid, supply_cap, is_platform_coin`）。
程序化比对（不是目测）：`readings/sql-static-check.json` 的 `columns-identical` / `values-identical` / `columns-vs-values-count` 三条 = PASS。

**幂等策略（与源同形，双重幂等）**：
```sql
INSERT INTO public.currency
  (symbol, name, owner_uid, decimals, status, listed_at, deposit_amount, deposit_cid, supply_cap, is_platform_coin)
SELECT 'BTTC'::text, 'battcoin'::text, 0::bigint, 0::smallint, 'listed', now(),
       0::bigint, 1::bigint, NULL::bigint, true
 WHERE NOT EXISTS (SELECT 1 FROM public.currency AS c WHERE c.symbol = 'BTTC')
ON CONFLICT (symbol) DO NOTHING;
```
⇒ 行已存在：谓词闸挡下（插入 0 行）+ 唯一约束兜底；**零 UPDATE / 零 DELETE / 零 TRUNCATE**，可反复 apply。
文件内**不写 `BEGIN`/`COMMIT`**（`scripts/migrate.ts` 逐文件包事务 + 同事务写 `schema_migration`；失败 ⇒ 整文件回滚、不写版本行）。

---

## ③ 约束满足清单（`0001 §2 currency` 7 条 + `0033` 标记列；现取自 `0001_ledger_core.sql:27-38`）

| 约束 | 定义 | 本行取值 | 满足 |
|---|---|---|---|
| `currency_symbol_uniq` | `UNIQUE(symbol)` | 单行 + `WHERE NOT EXISTS` + `ON CONFLICT DO NOTHING` | ✅ |
| `currency_symbol_fmt` | `symbol ~ '^[^[:space:]]{1,16}$'` | `'BTTC'`（4 字符、无空白） | ✅ |
| `currency_decimals_rng` | `decimals BETWEEN 0 AND 18` | `0` | ✅ |
| `currency_supply_guard` | `total_supply>=0 AND (supply_cap IS NULL OR (supply_cap>=0 AND total_supply<=supply_cap))` | `total_supply=0`（列默认）/ `supply_cap=NULL` | ✅ |
| `currency_status_enum` | `status IN ('draft','listed','frozen','delisted')` | `'listed'` | ✅ |
| `currency_deposit_guard` | `deposit_amount >= 0` | `0` | ✅ |
| **`currency_listed_at`** | `status='draft' OR listed_at IS NOT NULL` | `status='listed'` ⇒ **必须** `listed_at`，已给 `now()` | ✅ |
| `is_platform_coin`（`0033`） | `boolean NOT NULL DEFAULT false` | 显式 `true`（平台币免审核 + 保证金腿跳过） | ✅ |

---

## ④ 门前推（前后值 · 判据形态一字不改，仍是 `===` 硬等值）

`backend-ts/scripts/p8-s9-bttc-gate.ts` K 段 `K5`：

| | 改前 | 改后 |
|---|---|---|
| 断言 | `Number(sm[0].n) === 45 && String(sm[0].mx) === '0046'` | `Number(sm[0].n) === 48 && String(sm[0].mx) === '0049'` |
| 判据文案 | ``schema_migration = **45 行** · max(version) = **0046**`` | ``schema_migration = **48 行** · max(version) = **0049**`` |
| 派生注释链（4 处同前推，出处逐行保留） | 45/0046 与更早的 43/0044 | 48/0049；**新增一行出处**：`0049_seed_bttc_currency.sql` = BTTC 载体行 seed（行 520），历史 apply 行（517/518/519）**原样保留** |
| 报告 `note` | `schema_version 0046 · 45 行` | `schema_version 0049 · 48 行` |
| `selfTest('K5', …)` 负对照 | 未动 | 未动（`'0038'` vs `'0034'` 谓词形态一字不改） |

差分全文：`readings/gate-fingerprint.diff`（74 行）。
现取依据：迁移文件数 = **47**（`0001`–`0048`，缺 `0018`）＝库面 `schema_migration` **47 行 / 0048** ⇒ `0049` apply 后 **48 行 / 0049**（与既存 `max(version)` 链一致）。

### 同批附带修正（我的改动引起的既有门行号位移）

`backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json` 的 `scripts/p8-s9-bttc-gate.ts` 登记项是**行号键**：我在 K5 注释区插了 1 行（+1 位移）⇒ 该门报 `NEW scripts/p8-s9-bttc-gate.ts:587`（原登记 `:586`，**同一语句** `INSERT INTO public.currency (symbol,name,…) …`）。
⇒ 只把该登记行号 `586 → 587`（判据、理由、残差文本一字不动）。复跑：`GREEN / 新增=0 / 命中数=30 = 基线数 30`（`readings/s36-identity-pk-gate.log`）。

---

## ⑤ 验证读数（自己跑，零库）

| 项 | 命令 | 结果 | 读数 |
|---|---|---|---|
| TS 编译 | `cd backend-ts && npx tsc --noEmit` | **exit 0** | 会话内实测 |
| SQL 静态体检（词法/结构 + 与源逐字比对） | `node ops/bttc-seed-migration/readings/sql-static-check.mjs` | **exit 0 · 24/24 PASS** | `readings/sql-static-check.log` / `.json` |
| 既有零-DB 门（扫迁移文本） | `cd backend-ts && npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts` | **exit 0 · GREEN · 新增 0** | `readings/s36-identity-pk-gate.log` |
| `p8-s9-bttc-gate.ts` 全跑 | —— | **未跑（K 段必连库）** | 本单禁连库 ⇒ 只能 tsc 保证语法；K5 的**真绿**须 apply 后由 Zang 跑 |

静态体检覆盖（24 条，见 json 逐条）：`DO` 块外**无** `BEGIN/COMMIT/ROLLBACK`、注释**零** `/*`（不触发审计脚本吞码）、圆括号净差 0、`$$` 恰 2 次、块外恰 1 条语句且为 `INSERT INTO public.currency`、`IF`/`END IF` 12/12 平衡、幂等两态在场、块外零 `UPDATE/DELETE/TRUNCATE/DROP/ALTER/CREATE`、**列清单与值与 `ensureBttcCurrency` 逐字相同**、列数 = 值数（10:10）、自检 DO 块 12 条断言在场（含必需五条：恰好 1 行 / `status='listed'` / `is_platform_coin=true` / `decimals=0` / `listed_at IS NOT NULL`）。

**自检块的重跑免疫**：只断言 `total_supply >= 0`（不硬判 `=0`）—— 行可能已带真实铸造量，本文件不改它；其余 11 项是 seed 常量，漂移即应炸。

---

## ⑥ apply 顺序建议（由 Zang 执行；本单未做）

1. **dev 先**（Neon `quiet-math-65207667`，`backend-ts/.env.local` 的 dev 串）：`npx ts-node --transpile-only scripts/migrate.ts` ⇒ 期望 `applied 0049`、库面 `schema_migration` = **48 行 / 0049**；再用只读探针核 `PENDING=[] EXTRA=[]`。
2. dev 现证功能面：`GET /api/batt`（登录态）应出现 `bttc.status = "listed"` / `bttcAvailable` 由 false 转 true ⇒ 铸造/分解按钮渲染（这一步才是「缺陷真修好」的外部闭环）。
3. dev 复跑 `p8-s9-bttc-gate.ts` ⇒ K5 应转绿（改前因 47≠45 是红的 —— **附带说明：本单前该门 K5 已滞后两档，属既有欠账**）。
4. **生产后**（`sweet-pond-28934105`，凭据走 `~/.config/seafood/prod-db.env` + 技能自带 `scripts/apply-migration.sh`，串不进命令行/不进会话）：apply 前先核 `neon.project_id` = `sweet-pond-28934105` ＋ `schema_migration` 顶 = `0048` ＋ `currency` 无 `symbol='BTTC'`（三条前置）⇒ 再 apply。
5. **迁移先于 push**（本仓铁律：`push` = 生产部署；库落后于代码 ⇒ 新读口 500）。本单**不 push**；push 时顺序 = apply 生产 → `git push` → 生产终验。
6. `checksum` 对账基准（`migrate.ts` 存 `sha256(文件)`）：
   `07751a964aa8bc6d54d55dfed96a8aa3202ebcea1dff8552ca896a52fceafcbd`（文件 7733 B）。

---

## ⑦ 现取登记（**不在本单范围、未改**）

同组「迁移结构指纹 = 45 行 / 0046」在**另两个门**里也滞后（现盘 47/0048）：

- `backend-ts/scripts/p8-s10-invite-reward-gate.ts:331` — `kg('K2', Number(sm.n) === 45 && String(sm.mx) === '0046', …)`
- `backend-ts/scripts/p8-s11-audit-console-gate.ts:471` — `kg('K1', Number(sm.n) === 45 && String(sm.mx) === '0046', …)`

⇒ 这两个门在 `0049` apply 后会因 `48 ≠ 45` 报红（**改前就已经是红的**，非本单回归）。建议下一单一起前推到 48/0049（或届时 0050 的实际值）。

---

## ⑧ 文件清单

| 文件 | 形态 |
|---|---|
| `backend-ts/migrations/0049_seed_bttc_currency.sql` | 新增（7733 B · `sha256 = 07751a96…afcbd`） |
| `backend-ts/scripts/p8-s9-bttc-gate.ts` | 改（K5 断言 + 4 处派生注释 + 1 行出处） |
| `backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json` | 改（行号 586→587，同一语句的位移） |
| `ops/bttc-seed-migration/REPORT.md` | 本文件 |
| `ops/bttc-seed-migration/readings/sql-static-check.mjs` / `.json` / `.log` | 静态体检脚本与读数 |
| `ops/bttc-seed-migration/readings/s36-identity-pk-gate.log` | 既有零-DB 门读数 |
| `ops/bttc-seed-migration/readings/gate-fingerprint.diff` | 门前推差分全文 |
| `ops/bttc-seed-migration/readings/defect-chain.txt` | 缺陷链 grep/sed 原样取证 |
