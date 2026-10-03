# S2b 门前推报告 —— 迁移冻结计数 39·0040 → 40·0041（7 门）

- **单**：S2b 门前推（只改门脚本冻结计数 + 逐门复跑）
- **执行**：Kong · 2026-10-03（CST）
- **基线**：`befcd4e`（`git log --oneline -1` 现取，开工时一致）
- **触发**：迁移 `0041_job_headcount.sql` 已 apply 真库 ⇒ 真库现取 `schema_migration` = **40 行 / max `0041`**（apply 前 39 行 / `0040`）；迁移**文件**数现取 `ls migrations/*.sql | wc -l` = **40**（`MIGRATIONS_FROZEN` 的真实定义 = 迁移文件数）。
- **硬口径**：不 commit / 不 push ✓ · 未起服务 / 未占端口 ✓ · 未 `npm install` ✓ · 连库仅由 `backend-ts/.env.local` 自动加载（未复制 / 未回显）✓

---

## ① 全仓现取（`scripts/` ∪ `src/`）——落点清单

现取模式：`39 行` / `39·0040` / `=== 39` / `MIGRATIONS_FROZEN` / `'0040'` / `"0040"` / `schema_version = 0040`。
**结论：全仓仅此 7 门持有该冻结面，无第 8 落点。** `src/**` 命中 0；命中 `0040` 的其它门（`p3y`/`p4z`/`qa-p1e` 类 17 行 checksum / 表存在性探针）非本冻结面，不在清单。

| # | 文件:行（前推前） | 现形 | 改后（行号） | 类型 |
|---|---|---|---|---|
| 1 | `p8-s9-bttc-gate.ts:515` | `Number(sm[0].n) === 39 && String(sm[0].mx) === '0040'` | `=== 40` / `=== '0041'`（515） | 库面活体断言 `K5` |
| 2 | `p8-s9-bttc-gate.ts:516` | 文案 `**39 行** · **0040**（0032→…→0040 已 apply…）` | `**40 行** · **0041**（0032→…→0041…）`（516） | 断言外显文案 |
| 3 | `p8-s9-bttc-gate.ts:11` | 头注 `…0035…0040 已 apply（schema_version = 0040 · schema_migration 39 行）` | `…0041…（schema_version = 0041 · 40 行）`（11） | 头注 |
| 4 | `p8-s9-bttc-gate.ts:29` | 判据表 `schema_migration 39·0040` | `40·0041`（29） | 头注 |
| 5 | `p8-s9-bttc-gate.ts:355` | `已 apply（schema_version = 0040 · 39 行）⇒ 原 10 条` | `0041` / `40 行`（355） | 段注 |
| 6 | `p8-s9-bttc-gate.ts:404` | `已 apply（schema_version = 0040 · 39 行）⇒ 原 pending_apply[] 10 条` | `0041` / `40 行`（404） | 段注 |
| 7 | `p8-s9-bttc-gate.ts:760` | report.note `schema_version 0040 · schema_migration 39 行` | `0041` / `40 行`（760） | report 文案 |
| 8 | `p8-s10-invite-reward-gate.ts:328` | `Number(sm.n) === 39 && String(sm.mx) === '0040'` | `=== 40` / `=== '0041'`（328） | 库面活体断言 `K2` |
| 9 | `p8-s10-invite-reward-gate.ts:329` | 文案 `**39 行** · **0040**（0035→…→0040 已 apply…）` | `**40 行** · **0041**（0035→…→0041…）`（329） | 断言外显文案 |
| 10 | `p8-s10-invite-reward-gate.ts:11` | 头注 `0035–0040 已 apply` | `0035–0041 已 apply`（11） | 头注 |
| 11 | `p8-s10-invite-reward-gate.ts:12` | 头注 `schema_migration 39·0040` | `40·0041`（12） | 头注 |
| 12 | `p8-s11-audit-console-gate.ts:468` | `Number(sm.n) === 39 && String(sm.mx) === '0040'` | `=== 40` / `=== '0041'`（468） | 库面活体断言 `K1` |
| 13 | `p8-s11-audit-console-gate.ts:469` | 文案 `**39 行** · **0040**（0040 已 apply）` | `**40 行** · **0041**（0041 已 apply）`（469） | 断言外显文案 |
| 14 | `p8-s11-audit-console-gate.ts:10` | 头注 `0040 已 apply` | `0041 已 apply`（10） | 头注 |
| 15 | `p8-s11-audit-console-gate.ts:11` | 头注 `schema_migration 39·0040` | `40·0041`（11） | 头注 |
| 16 | `p8-s3-deposit-gate.ts:80` | `const MIGRATIONS_FROZEN = 39;` | `= 40;`（**81**） | 常量 `E6` |
| 17 | `p8-s3-deposit-gate.ts:79` | 注释（末行 `38 → 39（+0040…）`） | **追加**一行 `// ★ S2b 门前推：迁移文件数 39 → 40（+0041_job_headcount 任务 headcount）。`（80） | 注释（不删历史行） |
| 18 | `p8-s3b-address-gate.ts:69` | `const MIGRATIONS_FROZEN = 39;` | `= 40;`（**70**） | 常量 `G4` |
| 19 | `p8-s3b-address-gate.ts:68` | 同上注释 | 追加 S2b 注释行（69） | 注释 |
| 20 | `p8-s4-currency-review-gate.ts:67` | `const MIGRATIONS_FROZEN = 39;` | `= 40;`（**68**） | 常量 `H1` |
| 21 | `p8-s4-currency-review-gate.ts:66` | 同上注释 | 追加 S2b 注释行（67） | 注释 |
| 22 | `p8-s5-compliance-gate.ts:76` | `const MIGRATIONS_FROZEN = 39;` | `= 40;`（**77**） | 常量 `H1` |
| 23 | `p8-s5-compliance-gate.ts:75` | 同上注释 | 追加 S2b 注释行（76） | 注释 |

- **未改**：`p8-s9:517` `K5` 元判据元测试（`selfTest('K5', … String(v) === '0038' …)`）—— 沿既有惯例，非冻结计数断言。
- **改法**：逐处最小替换（`str.replace` count==1 断言），**未删任何历史注释行 / 未放宽 / 未删任何判据**。diff = **7 文件 · +23 / −19**。

---

## ② 逐门复跑（前推前 vs 前推后）· 库面 leg 读数

命令：`npx ts-node --transpile-only scripts/<gate>.ts`（cwd = `backend-ts`，env 由 `.env.local` 自动加载）。

| 门 | 目标判据 | 前推前 | 前推后 |
|---|---|---|---|
| `p8-s3-deposit-gate` | `E6` | **45 / 44 / 1（红）** · `E6 pass=false`·`actual=40`（期望 39） | **45 / 45 / 0（绿）** · `E6 pass=true`·`actual=40` |
| `p8-s3b-address-gate` | `G4` | **38 / 37 / 1（红）** · `G4 pass=false`·`actual=40` | **38 / 38 / 0（绿）** · `G4 pass=true`·`actual=40` |
| `p8-s4-currency-review-gate` | `H1` | **79 / 78 / 1（红）** · `H1 pass=false`·`{"count":40}` | **79 / 79 / 0（绿）** · `H1 pass=true`·`{"count":40,"has":true}` |
| `p8-s5-compliance-gate` | `H1` | **117 / 116 / 1（红）** · `H1 pass=false`·`{"count":40}` | **117 / 117 / 0（绿）** · `H1 pass=true`·`{"count":40}` |
| `p8-s9-bttc-gate` | `K5` | **100 / 99 / 1（红）** · `K5 pass=false`·`{"n":40,"mx":"0041"}`（期望 39/0040） | **100 / 100 / 0（绿）** · `K5 pass=true`·`{"n":40,"mx":"0041"}`·`db=10`·`http=0` |
| `p8-s10-invite-reward-gate` | `K2` | **49 / 47 / 2（红）** · `K2 pass=false`·`{"n":40,"mx":"0041"}` **+ `K8` 红（HTTP 腿）** | **49 / 48 / 1** · **`K2 pass=true`**·`{"n":40,"mx":"0041"}`（余 `K8` = HTTP 腿未测，见 ③） |
| `p8-s11-audit-console-gate` | `K1` | **87 / 83 / 4（红）** · `K1 pass=false`·`{"n":40,"mx":"0041"}` **+ `K8`/`K9`/`K10` 红** | **87 / 84 / 3** · **`K1 pass=true`**·`{"n":40,"mx":"0041"}`（余 `K8`/`K9` = 非本单射程，`K10` = HTTP 腿未测，见 ③） |

- **7 处目标判据全部由红转绿** ✓（`s3`/`s3b`/`s4`/`s5` 为静态门，无 DB 腿，`db=0`；其红纯为迁移文件数冻结面滞后）。
- `s9` 全绿（`pending_apply=0`）；`s3/s3b/s4/s5/s9` 均 **0 失败**。

---

## ③ 未测项 / 额外红点（如实登记 · 未改）

### A. HTTP 腿未测（无受控实例；禁起服务）
- **`p8-s10` `K8`**：打 `P8S10_BASE`（默认 `http://127.0.0.1:5796`）⇒ 实测 `{"err":"fetch failed"}`。现取 `lsof -nP -iTCP -sTCP:LISTEN` 显示 5796 **无监听**。**未测 + 原因**：受控实例未起，且 5796 ∈ 硬口径禁占区 **5793–5799** ⇒ 不得为凑绿起服务。
- **`p8-s11` `K10`**：打 `P8S11_BASE`（默认 `http://127.0.0.1:5797`）⇒ 实测 `{"err":"fetch failed"}`。5797 **无监听**，同属禁占区 ⇒ **未测 + 同上原因**。
- （对照：会话开始前 11:44 的 `p8-s11` 产物为 **87/87 全绿**，`K10` 当时有真读数 `401/200/400…` ⇒ 该腿依赖实例，非本单可离线复现。）

### B. 非本单射程的额外红点（未改，登记待裁）
- **`p8-s11` `K8` / `K9`**：`admin_ops_audit_log` 中 `action='points_adjust'` 实测 **5 行**（冻结期望 **4 行**）。
  - **归因（只读探针现取）**：新增行为 `log_id=9` · `time_created=2026-10-03T12:11:22Z` · `memo='PROMOTION_BONUS'` · `idempotency_key='ops:1:points_adjust:970213:1:kevin-grant-10000-a'` ⇒ **一次真实运营动作（Kevin 发放积分）**在 11:44 全绿之后追写。
  - **与 `0041` 无关**：`0041_job_headcount.sql` 为**纯 DDL + 存量 backfill**（现取全文：仅 `ADD COLUMN headcount` / `UPDATE public.job` / `ADD CONSTRAINT` / `COMMENT` / `DO` 自检），**不写 `admin_ops_audit_log`**（该表仅由 `0023`–`0027` 面写入）。
  - **定性**：这是**另一个冻结面（历史审计行数）**的滞后，**不属于**本单三类现取模式（`39 行` / `'0040'` / `MIGRATIONS_FROZEN`）⇒ **未改**（沿「不得借前推之机放宽 / 删任何判据」）。**需 Zang 另裁**（是否另派单把 `K8`/`K9` 的历史行数 4 → 5 前推）。

---

## ④ 边界与硬口径遵守

- **改动文件面**：仅 `backend-ts/scripts/*.ts`（7 文件）+ 本报告 `docs/audit/s2b-frozen-push.md`。
- **未碰**：`backend-ts/src/**` · `frontend/**` · `migrations/**` · `docs/*.spec.md` · `.env*`（`git status` 现取：仅 7 个 `backend-ts/scripts/*.ts` 为 `M`）。
- **未 commit / 未 push**；**未起服务 / 未占端口**（`lsof` 现取：仅既有 `5787`(pid 30475) / `5788`(pid 65096) 在听，非本单所起）；**未 `pkill`/`killall`**；**未 `npm install`**；连库仅由 `backend-ts/.env.local` 自动加载，未复制 / 未回显。
- 临时只读归因探针 `scripts/_s2b_attr_probe.ts` **已删除**（`ls` 现取不存在）。
- 原始输出存 `$BH_AGENT_WORKSPACE` 之外的 scratch（`~/.hermes/profiles/zang/cache/scratch/s2b/`，`.txt` 后缀，非 `.log`）。
