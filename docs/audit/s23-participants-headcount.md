# S23 · B4「已参与 X / 共 N 人」（`headcount` 进读模型 + 前端展示） + A1/A2 定值留痕

**单号**：S23　**角色**：Kong（实现方）　**执行**：2026-10-04（CST）
**口径**：B4 = 把既有 `job.headcount`（迁移 `0041`，`NOT NULL DEFAULT 1`）**进入任务读模型**（`TaskRecord` + `normalizeTask`，两读口同源）并在前端四语展示「已参与 X / 共 N 人」；A1/A2 = 把活代码里的 `TODO: Kevin 定值` 标为**已定值**（改注释，不改行为、不改数值）。
**硬口径遵守**：未改 `migrations/**`（`0023` 逐字未动）✓ · 未改 `docs/*.spec.md` / `docs/seafood.master-plan.md` ✓ · 未改 `frontend/src/styles.css` ✓ · 未 `git add -A` / 未 commit / 未 push ✓ · 未 `npm install` ✓ · 未碰 `.env*` ✓ · 未启停 `5787/5788`、未起任何实例（未占 5792–5799）✓ · 禁 `pkill -f`/`killall`（未使用）✓ · 原始输出**不用 `.log` 后缀** ✓ · 测试 uid ≥ 900000（本单未建夹具）✓ · 表引用显式 `public.` / 身份表写 `users`（本单未触碰）✓。

---

## §0 对锚（开工现取）

```
$ git log --oneline -3
c8ec4ef chore(gates): S21 扫面根卫生 … + 报告；台账 B2/B11 闭环
25121f0 docs: §5.337/v0.337 —— S20 收口 … + 台账同步
1bff643 chore(gates): S20 门卫生 —— p7b-03 AC10-2 注册点冻结面前推 68→89 …

$ git branch --show-current → main
$ git status --porcelain（开工）
  （无 tracked 改动；仅大量 backend-ts/.p*-artifacts/ 等未跟踪历史产物）
```
- **开工 HEAD = `c8ec4ef`**。开工时工作区**无 tracked 修改**（对锚干净）。

> ★ **并发写者（自曝，非本单）**：会话期间工作区**陆续出现他方改动**，本单**未碰、未暂存、未回滚**：
> - `frontend/src/styles.css`（`25/49`，另有并行单在改）
> - `docs/data-layer.spec.md`（`64/0`）· `docs/route-layer.spec.md`（`41/0`）（Jing 面）
> - 未跟踪新件：`docs/versions/{data-layer.spec.v0.31,route-layer.spec.v2.25,ledger.spec.v0.13}.md`、`docs/audit/{data-layer-v0.31,route-layer-v2.25,ledger-v0.13-snapshot,s24-spec-decisions-and-snapshot}*.md`、`frontend/src/test/unit/s22-decor-cleanup.test.js`、根目录 `_tmp_dl_tbl.md`/`_tmp_rl_tbl.md`。
> 上述均归**他方并发会话**（S24/Jing + 装饰清理单）。本单交付面与之**零交集**。

---

## §1 现取（改动前）

### 1.1 B4 事实面
| 事实 | 现取读数 |
|---|---|
| `job.headcount` 列 | **已存在**（迁移 `0041_job_headcount.sql`，`NOT NULL DEFAULT 1`）；两读口 `listTasks`/`getTask` 皆 `SELECT t.*` ⇒ **行里已带 `headcount`** |
| 读模型是否带 `headcount` | **不带** —— `TaskRecord`（`database.ts:1160-1184` 改前）**无 `headcount` 键**；`normalizeTask`（改前 `:1467`）**未映射** ⇒ 读侧把该列**丢弃** |
| 发布/评审路径 | `database.ts:3404/3417` `SELECT … j.headcount` → `jobHeadcount`（**另一条路**，读模型未共用） |
| 前端消费点 | `JobDetailPage.jsx:215`（`t('jobs.participants',{count:…})`）· `TaskCard.jsx:130`（`{task.participants} {t('common.participantsUnit')}`）· 映射：`HomePage.jsx:54` / `TaskPage.jsx:60,73`（`participants: task.participants_count \|\| 0`） |
| 既有四语键 | `jobs.participants`（S19 已改值「已参与 {{count}} 人」）· `common.participantsUnit`（「人参与」）· `jobs.headcount/headcountInvalid/depositHint`（S5① 发布面用） |
| 键计数（改前） | 顶层 **119** / 拍平 **1059** / 四语节点 **4236** |

### 1.2 ★ 键集冻结风险扫描（本单必做）
`grep` 全仓「是否有测试/门断言 `TaskRecord` 键集或 `/api/task/*` 响应键集」：
- **vitest 套件 / 四脚本 / `p7b-03-offline-gates.ts`：0 处**断言 `TaskRecord` 键集或 `/api/task/*` 响应键集。前端测试一律用 stub payload（`{tID,title,points,participants_count}`），**不校验响应键集**。
- **命中**：`backend-ts/scripts/p4z-03-keys.ts` · `p4z-04-keys-b1b.ts` · `p4z-08-keys-b1d.ts` —— 这类「key-contract fixture」把合成行喂给**HEAD 快照 vs 工作树快照**的 mapper 并断言 **key 集相等**。它们**需显式传 `<preDir> <postDir>` 参数、未接 vitest、未接四脚本、未接 p7b-03**（`grep` 全仓无自动调用点）。
- **处置**：本单**合法新增** `TaskRecord.headcount` ⇒ 该夹具若手动重跑会如实报 `only_new: ['headcount']`，属**预期变更**（非假红）。**登记**（见 §5），**不改该夹具**（它绑 HEAD 快照语义，改它无意义）。

### 1.3 A1/A2 `TODO: Kevin 定值` 现取（`grep -rn` = **7 处**，全在 `backend-ts/src`）
| 文件:行 | 现取 |
|---|---|
| `currency-service.ts:142` | `` …降为兜底`（`TODO: Kevin 定值`；现取读数 = `50000`，… `` |
| `currency-service.ts:147` | `` …—— **`TODO: Kevin 定值`**（现取读数 = 50000）。 */ `` |
| `currency-service.ts:148` | `export const CURRENCY_LIST_DEPOSIT_FLOOR = 50000; // TODO: Kevin 定值（批 8③…）` |
| `database.ts:62` | `` …**数值真值 = `TODO: Kevin 定值`**）。 `` |
| `database.ts:133` | `` …—— 数值真值 = `TODO: Kevin 定值`。 `` |
| `database.ts:138` | `` /** 上市保证金金额（…；数值真值 `TODO: Kevin 定值`）。 */ `` |
| `index.ts:2094` | `// TODO: Kevin 定值`（`ADMIN_POINTS_ADJUST_MAX_PER_DAY = 1000000`，`index.ts:2095`） |

`migrations/0023_admin_points_audit_daily_cap.sql`：含 `TODO: Kevin 定值` **3 处**（`:9` / `:43` / `:161`）—— **已 apply ⇒ 内容冻结，本单逐字未动**（§3.4 给证明）。**规范侧留痕由 Jing 单 S24 承担**（登记）。

---

## §2 改动逐处（`git diff --numstat`，仅本单面）

```
24	3	backend-ts/src/database.ts
3	3	backend-ts/src/currency-service.ts
1	1	backend-ts/src/index.ts
1	1	frontend/src/components/task/TaskCard.jsx
1	0	frontend/src/locales/{zh,hk,en,vn}.json   （各 +1）
1	0	frontend/src/pages/HomePage.jsx
2	0	frontend/src/pages/TaskPage.jsx
1	1	frontend/src/pages/jobs/JobDetailPage.jsx
14	13	frontend/src/test/unit/s19-participants-truth-source.test.jsx
（其余 9 个计数断言测试文件各 2~5 行「数值前推」）
```
自建新件（未跟踪）：`backend-ts/scripts/s23-participants-headcount.ts` · `frontend/src/test/unit/s23-participants-headcount.test.jsx` · `backend-ts/.s23-artifacts/**`。

### 2.1 `backend-ts/src/database.ts`（B4 读模型）
1. `TaskRecord` 加 `headcount: number;`（含 S23 注释）。
2. `normalizeTask` 加 `headcount: toHeadcount(getValue(row, 'headcount'))`。
3. 新增纯函数 `toHeadcount`：**fail-closed** —— 缺省 / 非整数 / `< 1` ⇒ `1`（与 `0041` `NOT NULL DEFAULT 1` 同语义）：
   ```ts
   const toHeadcount = (value: unknown): number => {
     const next = toOptionalNumber(value);
     return next !== null && Number.isInteger(next) && next >= 1 ? next : 1;
   };
   ```
> **两读口同源**：`listTasks`/`getTask` 皆经 `normalizeTask`；`headcount` 来自各自 `SELECT t.*` 的行内列 ⇒ **单一映射点，无第二套真相**。（`SELECT t.*` 内层 2 处，probe A4 断言。）

### 2.2 四语新增键 `jobs.participantsHeadcount`（**+1 键/语**，双占位符）
| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `jobs.participantsHeadcount` | `已参与 {{done}} / 共 {{limit}} 人` | `已參與 {{done}} / 共 {{limit}} 人` | `{{done}} / {{limit}} participants` | `{{done}} / {{limit}} người tham gia` |

- **四语键集严格相等**（单测 §(a) 逐字断言；`flat = 1060` 单值 / 节点 `4240`）。
- en/vn **零 CJK**；四语值均含 `{{done}}` **与** `{{limit}}`。
- 既有 `jobs.participants` / `common.participantsUnit` **保留不动**（未删键）。

### 2.3 前端消费点（四语展示）
| 文件:行 | 改后 |
|---|---|
| `JobDetailPage.jsx:215` | `#{job.tID} · {t('jobs.participantsHeadcount', { done: job.participants_count \|\| 0, limit: job.headcount \|\| 1 })}` |
| `TaskCard.jsx:130` | `<span>{t('jobs.participantsHeadcount', { done: task.participants \|\| 0, limit: task.headcount \|\| 1 })}</span>` |
| `HomePage.jsx:54` | 加 `headcount: task.headcount \|\| 1,`（映射 `mapTasksForHome`） |
| `TaskPage.jsx:60,73` | 加 `headcount: task.headcount \|\| 1,`（`enrichTask` / `normalizeTaskProgressTask`） |
> 前端亦 **fail-closed**：`… \|\| 1` ⇒ 缺省/非法 headcount 展示「共 1 人」，不显示 `共 0 人`（单测 §(c) 断言）。

### 2.4 A1/A2 定值留痕（**只改注释，零行为/零数值变更**）
`TODO: Kevin 定值` → **`Kevin 2026-10-04 定值 50000`**（保证金，`currency-service.ts:142/147/148` + `database.ts:62/133/138` 共 6 处语义旁注）· **`Kevin 2026-10-04 定值 1000000`**（调分日累计上限，`index.ts:2094`）。
**保留原有语义句**：「常量仅兜底 / 唯一真值在 DB 编排函数 `public.admin_points_adjust_post_event`（`migrations/0023`）」。

### 2.5 计数基线前推（**逐条给出处**，严禁删断言）
新增 1 键/语 ⇒ **顶层 119 不变**（键入既有 `jobs` 命名空间）· **拍平 1059 → 1060** · **四语节点 4236 → 4240**。
逐条前推出处（同一句：「本单合法新增 `jobs.participantsHeadcount` ×1/语」）：

| 文件 | 期望（旧→新） |
|---|---|
| `s9-ledger-kind-closure.test.js` | 拍平 `1059→1060`；节点 `4236→4240`（含 it 名/注释） |
| `r9-93-points-symbol.test.jsx` | 拍平 `1059→1060`（含 it 名） |
| `r9-96-dashj-copy.test.jsx` | 拍平 `1059→1060`；节点 `4236→4240`（含 describe 名） |
| `s8-locale-key-coverage.test.js` | 拍平 `1059→1060`；节点 `4236→4240`（含 it 名） |
| `s5-publish-headcount.test.jsx` | 拍平 `1059→1060`；节点 `4236→4240`（含 it 名） |
| `s7-submissions-panel.test.jsx` | 拍平 `1059→1060`；节点 `4236→4240`（含注释/describe/it 名） |
| `i18n-batch-b4a.test.jsx` | `{top:119, flat:1059→1060}` |
| `i18n-batch-b4b.test.jsx` | `{top:119, flat:1059→1060}`；`'zh: top=119 flat=1059→1060'` |
| `i18n-batch-b5.test.jsx` | 同上两处 |
| `i18n-violation-closeout.test.jsx` | 节点 `4236→4240`；`counts[0] 1059→1060` |
| `s19-participants-truth-source.test.jsx` | 拍平 `1059→1060`；节点 `4236→4240`；**§(b) 展示断言**改为「已参与 X / 共 N 人」格式（stub 无 headcount ⇒ 共 1 人） |

**判据语义与条数一字未改**（只前推数值 + 就近注明出处）；**未删任何断言、未放宽阈值**。

---

## §3 读数（逐格、run-tagged）

产物根：`backend-ts/.s23-artifacts/`
- 探针 pre/post（干净）：`s23-20261004T123152Z/readings.json`（首跑，A4 口径错，见 §6）· `s23-20261004T123224Z/readings.json`（**有效**）
- 判负（数据源侧）：`s23-20261004T123240Z/readings.json` + `negctl-a-backend.txt`
- 判负（前端）：`negctl-b-frontend.txt`
- 原始读数归档：`vitest-after.txt` / `vitest-baseline.txt` / `build.txt` / `scr-{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.txt`

### 3.1 真库只读读数（探针 `readings.json`，只读 SQL + 真服务层）
只读 SQL：`SELECT job_id, headcount FROM public.job WHERE …`；服务层经真代码路径 `DatabaseService.getTask` / `listTasks`（真库只读）。

| job_id | 库内原始 headcount | `getTask`.headcount | `listTasks`.headcount | `getTask`.participants_count | `listTasks`.participants_count |
|---|---|---|---|---|---|
| **232**（派单指定） | **50** | **50** | **50** | 1 | 1 |
| **2**（存量 headcount=1） | **1** | **1** | **1** | 1 | 1 |

- **两字段都在**（`headcount` + `participants_count`），**两读口同源**、值可复算（`getTask == listTasks == 库内原始`）。
- 探针 static：`TaskRecord.headcount`=1 · `normalizeTask` 映射=1 · `toHeadcount`=1 · 两读口内层 `SELECT t.* FROM job AS t`=**2**。
- **零副作用**：`job=45 / job_submission=40 / ledger_entry=502 / account=48 / Σbalance(cid=1)=1993455` **首尾逐字相等**（`zero_side_effect=true`）。

### 3.2 四语与计数
- 四语 `jobs.participantsHeadcount` 逐字（见 §2.2）；**四语键集严格相等**（单测 §(a)）；en/vn 零 CJK。
- 键计数：顶层 **119** / 拍平 **1060** / 四语节点 **4240**（改前 119/1059/4236）。
- 六类泄漏：新增键值为纯 UI 文案 + `{{done}}`/`{{limit}}` 占位符，**六类工程口径命中 = 0**；`p4z-i18nviol-global`（实跑）`locale 裸命中 0 + 源面裸命中 0`，`作用域节点数 locale=4240`。

### 3.3 硬门读数
| 门 | 命令 | 读数 |
|---|---|---|
| 后端类型 | `cd backend-ts && npx tsc --noEmit` | **exit 0** |
| 前端全量测试 | `cd frontend && npx vitest run` | **4 failed \| 50 passed (54)** / **7 failed \| 480 passed (487)** |
| 前端构建 | `cd frontend && npm run build` | **exit 0**（`✓ built in 1.60s`） |
| 四脚本 | `node scripts/{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.mjs` | **全 exit 0 / 全 PASS** |

**vitest 基线 vs 改后（逐条失败集完全相同）**：
| 读数 | Test Files | Tests |
|---|---|---|
| 基线（stash 回退本单 tracked 改动 + 移出 s23 新测试后跑） | 4 failed \| 49 passed (53) | 7 failed \| 469 passed (476) |
| 改后 | 4 failed \| 50 passed (54) | 7 failed \| **480** passed (487) |

失败集（两跑逐条相同，均**既有环境性缺陷**：Tailwind class 未加载 / Playwright spec 混入 vitest / Accessibility 套件崩）：
`accessibility/Accessibility.test.jsx` · `components/Card.test.jsx`（6 例）· `e2e/basic.spec.js` · `performance/VirtualList.test.jsx`（1 例）。
⇒ **failed 7 = 7（≤ 基线）**；新增 1 文件 / 11 测试**全绿**（`480-469=11`）。

### 3.4 A1/A2 与迁移冻结
- `grep -rn "TODO: Kevin 定值" backend-ts/src`：**改前 7 → 改后 0**（exit 1 = 零命中）。
- `grep -rn "Kevin 2026-10-04 定值" backend-ts/src`：**7 处**（保证金 50000 ×6 + 调分上限 1000000 ×1）。
- `migrations/0023` **未变动**：`git status --porcelain -- backend-ts/migrations` = **0 行** · `git diff --numstat -- backend-ts/migrations` = **0 行**；文件内 `TODO: Kevin 定值` 仍 **3 处**（内容冻结，逐字未动）。

---

## §4 判负（两处变异，主仓零残留）

### 4.1 后端（数据源侧）：移除 `normalizeTask` 的 `headcount` 映射 ⇒ 读模型断言必红
- 变异：临时把 `headcount: toHeadcount(getValue(row, 'headcount')),` 整行移出（仓内**改后立即复原**）。
- 读数（`s23-20261004T123240Z/readings.json` + `negctl-a-backend.txt`）：**PROBE_EXIT=1**，**20 条转红**，含：
  `A2` · `B-get-hc-232` `B-list-hc-232` `B-get-num-232` · `B-get-hc/list-hc/get-num-{2,3,4,5,8}` · **`C1-neg-232`**（job232 `headcount !== 50`）。
- 复原：`database.ts` 现取内容 == 意图版（sha256 一致）；`grep NEGCTL` = **0**。
⇒ 承重证据：**移除映射 ⇒ 读模型 `headcount` 断言必红**（缺省 1/undefined），复原回绿（§3.1）。

### 4.2 前端（展示侧）：把展示的 `limit` 钉为错值 ⇒ 断言必红
- 变异：`JobDetailPage.jsx:215` `limit: job.headcount || 1` → `limit: 1`（钉为错值）。
- 读数（`negctl-b-frontend.txt`）：`s23` 文件 **3 failed \| 8 passed**，红点：
  `(c) participants_count=3 / headcount=50 ⇒ 「已参与 3 / 共 50 人」` · `(c) 两维独立…` · `★ (d) 正确 limit（50）⇒ 谓词判真`。
- 复原：`JobDetailPage.jsx` sha256 与改前意图版一致；`grep NEGCTL` = **0**；`s23` 单文件重跑 **11/11 全绿**。
- 另：`★ (d)` **内建负对照**（在测试内部把 limit 钉为 1 ⇒ 正确谓词判假）常态在场，随套件全绿。

---

## §5 未做与 NOT_MEASURED

1. **未起服务 / 未发 HTTP** —— `NOT_MEASURED`：本单为读模型 + 组件级展示；服务层读数经真 `DatabaseService.getTask/listTasks`（真代码路径 + 真库只读）覆盖，**未跑 `/api/task/:tID` HTTP 往返**。判据：AC 未要求起实例；硬口径⑥禁起 5787/5788。
2. **key-contract fixture（`p4z-03/04/08-keys*.ts`）未重跑** —— 它们需 `HEAD 快照 vs 工作树快照` 显式参数、非自动门；本单**合法新增** `TaskRecord.headcount` ⇒ 手动重跑会如实报 `only_new:['headcount']`（预期）。**登记**：该新增属本单意图，非缺陷。
3. **`migrations/0023` 内 `TODO: Kevin 定值`（3 处）** —— **不改**（已 apply ⇒ 内容冻结，改它 = checksum 漂移红线）。**规范侧留痕由 Jing 单 `S24` 承担**（已在 §1.3 登记）。
4. **`common.participantsUnit`（「人参与」）** —— 保留（未删键）；`TaskCard` 停止引用它，改引 `jobs.participantsHeadcount`。键仍在（`i18n-batch-b2` 键清单未变）。
5. **`user`/裸表名** —— 本单未新增任何表引用（纯读模型映射 + 四语键 + 注释）。

---

## §6 自曝（如实）

1. **探针首跑 A4 口径错**：初版 `A4` 用 `/SELECT\s+t\.\*/g` 全文件计数，读到 **8**（他读口同形），误判（期望 2）。首跑产物 `s23-20261004T123152Z/readings.json` **作废**（`A4` 假红），留档可复核。已改为锚定正则 `/SELECT\s+t\.\*\s*\n\s*FROM\s+job\s+AS\s+t/`（=2）并重取 `s23-20261004T123224Z`。
2. **修复 s19 测试时一度打坏语法**：批量替换 `s19` 的 `it` 名时多插了一个 `'`，致 `:123` 转译失败（`Expected ")"`）。发现即就地修正并复跑 **11/11 绿**（属**修改测试期望**，非删断言）。
3. **baseline 取法**：vitest 基线非「开工瞬时」取得，而是改动后以 `git stash push -- <本单 frontend tracked 面>` **临时回退**再跑、跑完 `git stash pop` 复原（已核四语 `participantsHeadcount` 恢复在场）。首次 stash 因 cwd 错致 pathspec 未命中（stash 未生效 ⇒ 该次「baseline」无效，**已重取**）；最终有效基线见 §3.3。
4. **并发写者**：会话期间他方改动 `styles.css` / 两份 `docs/*.spec.md` 与多个未跟踪件（§0）。本单**未碰、未暂存、未回滚**。`vitest` 两跑均含他方未跟踪的 `s22-decor-cleanup.test.js`（基线/改后**一致**），不构成 differential。
5. **`git worktree`/`npm install` 未用**；未跑写库语句；探针首尾真库行数逐字相等（§3.1）。
6. **工作区未跟踪历史产物众多**（`.p8s*/p9s*/…`），属多会话既有，本单未触碰、未清理。

---

## §7 交付物清单

| 类 | 路径 |
|---|---|
| 代码 | `backend-ts/src/database.ts`（`TaskRecord.headcount` + `normalizeTask` 映射 + `toHeadcount` fail-closed） |
| 代码 | `frontend/src/locales/{zh,hk,en,vn}.json`（新增 `jobs.participantsHeadcount`） |
| 代码 | `frontend/src/pages/jobs/JobDetailPage.jsx` · `components/task/TaskCard.jsx` · `pages/HomePage.jsx` · `pages/TaskPage.jsx` |
| 注释（A1/A2） | `backend-ts/src/{currency-service,database,index}.ts`（7 处 `TODO→Kevin 2026-10-04 定值`） |
| 测试（前推） | `frontend/src/test/unit/{s9-ledger-kind-closure,r9-93-points-symbol,r9-96-dashj-copy,s8-locale-key-coverage,s5-publish-headcount,s7-submissions-panel,i18n-batch-b4a,i18n-batch-b4b,i18n-batch-b5,i18n-violation-closeout,s19-participants-truth-source}` |
| 测试（新） | `frontend/src/test/unit/s23-participants-headcount.test.jsx`（11 测试，含内建负对照） |
| 探针 | `backend-ts/scripts/s23-participants-headcount.ts`（只读 SQL + 真服务层） |
| 读数 | `backend-ts/.s23-artifacts/**`（`readings.json` ×3 · `negctl-*.txt` · `vitest-{after,baseline}.txt` · `build.txt` · `scr-*.txt`） |
| 报告 | 本文件 |
