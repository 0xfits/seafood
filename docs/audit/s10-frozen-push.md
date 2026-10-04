# S10 门前推报告 —— 迁移冻结计数 40·0041 → 41·0042（7 门）+ 门复跑

- **单**：S10 门前推（只改门脚本冻结计数 + 逐门复跑；**不 commit / 不 push**）
- **执行**：Kong · 2026-10-04（CST）
- **基线**：`9f5b2aa`（开工 `git log --oneline -1` 现取，一致）；★ 会话中 HEAD 前进至 `4ce7b1b`（并行 S9 的 **docs-only** 提交 · 仅改 `docs/seafood.master-plan.md` · **未碰任何门脚本 / `src/` / `migrations/`**）⇒ 本单改动面不受影响。
- **触发**：迁移 `0042_job_settle_per_submission.sql` 已 apply 真库 ⇒ 真库现取 `schema_migration` = **41 行 / max `0042`**（apply 前 40 行 / `0041`）；迁移**文件**数现取 `ls migrations/*.sql | wc -l` = **41**（`MIGRATIONS_FROZEN` 的真实定义 = 迁移文件数 · 沿 S2b 报告口径）。
- **登记**：★ **前推前基线**（同类**第三次**：`0031`→`0039` 与 `0040`→`0041`）⇒ **不得判为缺陷，不得为求绿放宽 / 删任何判据**。
- **硬口径**：不 commit / 不 push ✓ · 未起服务 / 未占端口 ✓ · 禁 `pkill -f`/`killall` ✓ · 连库仅由 `backend-ts/.env.local` 自动加载（未复制 / 未回显）✓ · 未 `npm install` ✓

---

## ① 全仓现取（`scripts/` ∪ `src/`）——落点清单

现取模式：`\b40\b` / `'0041'` / `"0041"` / `MIGRATIONS_FROZEN` / `schema_migration` / `schema_version`（`scripts/` ∪ `src/` 全域）。

**结论：本冻结面（`40`·`'0041'`·`MIGRATIONS_FROZEN`）全仓仅此 7 门持有，无第 8 落点。**
- `src/**` 命中 **0**（`MIGRATIONS_FROZEN` / `'0041'` / `40 行` 均无）；其余 `40` 命中为 `0x…{40}` 地址长度、`§4.1 #40` 条款号、`R-9-40` 规则号等**噪音**，非本冻结面。
- `scripts/*.ts` 中其余 `0041` 命中 = 4 门 `MIGRATIONS_FROZEN` 的 **S2b 历史注释行**（`+0041_job_headcount`，**沿惯例保留不删**）。
- 旁证：`p3x-00-rebuild-replay.ts`（`schema_migration.row_count` 冻结 **22**）/ `p3y-01-post-apply-verify.ts`（**17**）为**更早 epoch**的自建-registry 探针，**非**本「40·0041」族 ⇒ 不在清单、未改。

| # | 文件:行（前推后行号） | 现形 → 改后 | 类型 |
|---|---|---|---|
| 1 | `p8-s3-deposit-gate.ts:82` | `const MIGRATIONS_FROZEN = 40;` → `= 41;` | 常量 `E6` |
| 2 | `p8-s3-deposit-gate.ts:81` | 注释**追加**一行 `// ★ S10 门前推：迁移文件数 40 → 41（+0042_job_settle_per_submission 每提交结算）。` | 注释（不删历史行） |
| 3 | `p8-s3b-address-gate.ts:71` | `= 40;` → `= 41;` | 常量 `G4` |
| 4 | `p8-s3b-address-gate.ts:70` | 同 #2 追加注释行 | 注释 |
| 5 | `p8-s4-currency-review-gate.ts:69` | `= 40;` → `= 41;` | 常量 `H1` |
| 6 | `p8-s4-currency-review-gate.ts:68` | 同 #2 追加注释行 | 注释 |
| 7 | `p8-s5-compliance-gate.ts:78` | `= 40;` → `= 41;` | 常量 `H1` |
| 8 | `p8-s5-compliance-gate.ts:77` | 同 #2 追加注释行 | 注释 |
| 9 | `p8-s9-bttc-gate.ts:515` | `Number(sm[0].n) === 40 && String(sm[0].mx) === '0041'` → `=== 41` / `'0042'` | 库面活体断言 `K5` |
| 10 | `p8-s9-bttc-gate.ts:516` | 文案 `**40 行** · **0041**（0032→…→0041…）` → `**41 行** · **0042**（…→0042…）` | 断言外显文案 |
| 11 | `p8-s9-bttc-gate.ts:11` | 头注 `…0035…0041 已 apply（schema_version = 0041 · 40 行）` → `…0042…（= 0042 · 41 行）` | 头注 |
| 12 | `p8-s9-bttc-gate.ts:29` | 判据表 `schema_migration 40·0041` → `41·0042` | 头注 |
| 13 | `p8-s9-bttc-gate.ts:355` | 段注 `（schema_version = 0041 · 40 行）` → `= 0042` / `41 行` | 段注 |
| 14 | `p8-s9-bttc-gate.ts:404` | 段注 `（schema_version = 0041 · 40 行）` → `= 0042` / `41 行` | 段注 |
| 15 | `p8-s9-bttc-gate.ts:760` | `report.note` `schema_version 0041 · 40 行` → `0042 · 41 行` | report 文案 |
| 16 | `p8-s10-invite-reward-gate.ts:328` | `Number(sm.n) === 40 && String(sm.mx) === '0041'` → `=== 41` / `'0042'` | 库面活体断言 `K2` |
| 17 | `p8-s10-invite-reward-gate.ts:329` | 文案 `**40 行** · **0041**（0035→…→0041…）` → `**41 行** · **0042**（…→0042…）` | 断言外显文案 |
| 18 | `p8-s10-invite-reward-gate.ts:11` | 头注 `0035–0041 已 apply` → `0035–0042 已 apply` | 头注 |
| 19 | `p8-s10-invite-reward-gate.ts:12` | 头注 `schema_migration 40·0041` → `41·0042` | 头注 |
| 20 | `p8-s11-audit-console-gate.ts:468` | `Number(sm.n) === 40 && String(sm.mx) === '0041'` → `=== 41` / `'0042'` | 库面活体断言 `K1` |
| 21 | `p8-s11-audit-console-gate.ts:469` | 文案 `**40 行** · **0041**（0041 已 apply）` → `**41 行** · **0042**（0042 已 apply）` | 断言外显文案 |
| 22 | `p8-s11-audit-console-gate.ts:10` | 头注 `0041 已 apply` → `0042 已 apply` | 头注 |
| 23 | `p8-s11-audit-console-gate.ts:11` | 头注 `schema_migration 40·0041` → `41·0042` | 头注 |

- **未改**：`p8-s9:517` `K5` 元判据元测试（`selfTest('K5', … String(v) === '0038' …)`）—— 沿既有惯例，**非**冻结计数断言。
- **改法**：逐处最小替换（`str.replace` + `count` 断言，越界即抛）⇒ **未删任何历史注释行 / 未放宽 / 未删任何判据**。diff = **7 文件 · +23 / −19**。

---

## ② 逐门复跑（前推前 vs 前推后）· 读数

命令：`npx ts-node --transpile-only scripts/<gate>.ts`（cwd = `backend-ts`，env 由 `.env.local` 自动加载）。格式 = `total / passed / failed`。
「前」为**实测**（编辑前跑；`s9/s10/s11` 以 `git stash` 仅暂存本单 3 脚本取前读数后即 `pop` 复原子实测）。

| 门 | 目标判据 | 前推前 | 前推后 |
|---|---|---|---|
| `p8-s3-deposit-gate` | `E6`（迁移数） | **45 / 42 / 3** · `E6 pass=false`·`actual=41` | **45 / 43 / 2** · **`E6 pass=true`**·`actual=41` |
| `p8-s3b-address-gate` | `G4`（迁移数） | **38 / 36 / 2** · `G4 pass=false`·`actual=41` | **38 / 37 / 1** · **`G4 pass=true`**·`actual=41` |
| `p8-s4-currency-review-gate` | `H1`（迁移数） | **79 / 75 / 4** · `H1 pass=false`·`{"count":41,"has":true}` | **79 / 76 / 3** · **`H1 pass=true`**·`{"count":41,"has":true}` |
| `p8-s5-compliance-gate` | `H1`（迁移数） | **117 / 112 / 5** · `H1 pass=false`·`{"count":41,…}` | **117 / 113 / 4** · **`H1 pass=true`**·`{"count":41,…}` |
| `p8-s9-bttc-gate` | `K5`（库面） | **100 / 95 / 5** · `K5 pass=false`·`{"n":41,"mx":"0042"}` | **100 / 96 / 4** · **`K5 pass=true`**·`{"n":41,"mx":"0042"}`·`db=10`·`http=0` |
| `p8-s10-invite-reward-gate` | `K2`（库面） | **49 / 43 / 6** · `K2 pass=false`·`{"n":41,"mx":"0042"}`（+`K8` HTTP 红） | **49 / 44 / 5** · **`K2 pass=true`**·`{"n":41,"mx":"0042"}`·`db=3`·`http=0`（余 `K8` 见 ③A） |
| `p8-s11-audit-console-gate` | `K1`（库面） | **87 / 82 / 5** · `K1 pass=false`·`{"n":41,"mx":"0042"}`（+`K10` HTTP 红） | **87 / 83 / 4** · **`K1 pass=true`**·`{"n":41,"mx":"0042"}`·`db=6`·`http=0`（余 `K10` 见 ③A） |

- **7 处目标判据全部由红转绿** ✓（真库读数 `schema_migration = 41 行 / max 0042`，与 apply 后真库一致）。
- **前/后 FAIL 数各减 1**（恰为目标判据那一处）—— 未连带影响其它判据。
- `s3/s3b/s4/s5` 为静态门（`db=0`）；`s9/s10/s11` 库面 leg `pending_apply=0`。

---

## ③ 未测项 / 额外红点（如实登记 · **未改**）

### A. HTTP 腿未测（无受控实例；**禁起服务**）
- **`p8-s10` `K8`**：打 `P8S10_BASE`（默认 `http://127.0.0.1:5796`）⇒ 实测 `{"pub":-1,"no_tok_batt":-1,"tok_batt":-1,"err":"fetch failed"}`。`lsof -nP -iTCP -sTCP:LISTEN` 现取 **5796 无监听**。
- **`p8-s11` `K10`**：打 `P8S11_BASE`（默认 `http://127.0.0.1:5797`）⇒ 实测 `{"no_tok":-1,"ok_page":-1,"app_config":-1,…,"err":"fetch failed"}`。**5797 无监听**。
- **未测 + 原因**：受控实例未起，且 `5796`/`5797` **∈ 硬口径禁占区 `5793–5799`** ⇒ **不得为凑绿起服务**（沿 S2b 先例）。两腿红为**环境依赖**，非判据缺陷。

### B. 非本单射程的额外红点 —— **注册点冻结面 `88 → 89`**（未改，登记待裁）
7 门**另有**一族额外红点，**全部**为**注册点计数**（`REG_POINTS_FROZEN = 88` vs 现取实际 **89**）：

| 门 | 红点 |
|---|---|
| `p8-s3` | `E1`, `E1b`（负对照） |
| `p8-s3b` | `G1` |
| `p8-s4` | `A1`, `A8`（负对照）, `F1` |
| `p8-s5` | `A1`, `A1b`, `A14`（负对照）, `F1` |
| `p8-s9` | `A1`, `A2`, `A3`, `A5`（负对照） |
| `p8-s10` | `A1`, `A2`, `A3`, `A5`（负对照） |
| `p8-s11` | `I1`, `I2`, `I4`（负对照） |

- **归因（逐 commit 现取 `git show <c>:backend-ts/src/index.ts | grep -c app.<verb>(`）**：`337a5fb`(S2b)=**88** · `9d6bc20`(S3)=**88** · **`692f622`(S6)=89** ⇒ **净 +1 由 S6 引入**（新增 `GET /api/job/:jobId/submissions`）。现取逐 verb = `get 38 / post 48 / put 0 / patch 1 / delete 2` = **89**。
- **与 `0042` 无关**：`0042_job_settle_per_submission.sql` 为**纯迁移**（不改 `src/index.ts` / 不新增路由）；注册点计数滞后**早于**本单触发（S6 起）。
- **定性**：这是**另一个冻结面（注册点数）**的滞后，**不属于**本单现取模式（`40` / `'0041'` / `MIGRATIONS_FROZEN`）⇒ **未改**（沿「不得借前推之机放宽 / 删任何判据」，且 `src/**` 本单禁碰）。**需 Zang 另裁**（是否另派单把 7 门 `REG_POINTS_FROZEN` 88 → 89 前推；S6/S6b 报告均未见注册点前推登记）。

---

## ④ 边界与硬口径遵守

- **改动文件面**：仅 `backend-ts/scripts/*.ts`（7 文件）+ 本报告 `docs/audit/s10-frozen-push.md`。
- **未碰**：`backend-ts/src/**` · `frontend/**` · `migrations/**` · `docs/*.spec.md` · `.env*`。
- **并行面提示**：`git status` 现取**另见** `frontend/src/locales/{en,hk,vn,zh}.json` 与 `frontend/src/test/unit/*` 为 `M` —— **非本单所改**（**S9 并行面**，会话进行中被外部写入），本单**未触碰**。
- **未 commit / 未 push**；**未起服务 / 未占端口**（`lsof` 现取：`5793–5799` **全空**；仅既有 `5787`(pid 30475) / `5788`(pid 65096) 在听，**非本单所起 · 未启停**）；**未 `pkill`/`killall`**；**未 `npm install`**；连库仅由 `backend-ts/.env.local` 自动加载，未复制 / 未回显。
- 原始输出存 scratch（`~/.hermes/profiles/zang/cache/scratch/s10push/`，`.txt` 后缀，非 `.log`）。
