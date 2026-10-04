# S19 · `participants_count` 真源换轴（`job_application` → `job_submission`）+ 四语「已参与」+ `ProfilePage` `/shard`→`/exchange` 收口

**单号**：S19
**角色**：Kong（实现方）
**口径**：悬赏制读口修数据源（`R-9-97~R-9-103`）；**只改值/真源，不动键名/键数**；不 commit / 不 push；不碰 `migrations/**`、`docs/*.spec.md`、`docs/seafood.master-plan.md`、`.env*`。
**开工时间**：2026-10-04 20:00 CST

---

## §0 先过门与对锚

| 项 | 现取读数 |
|---|---|
| `git log --oneline -3` | `81d08a8 feat(jobs): S18 发布者可发现性…` / `8781640 feat(task-model): S17a…` / `9bd1df0 feat(task-model): S16 待审队列准入放宽…` |
| `git branch --show-current` | `main` |
| 对锚结论 | 开工 HEAD = `81d08a8`（S18 已入库）；两处同族 SQL 落点复核 **以现取为准**：`backend-ts/src/database.ts:2530-2537`（`listTasks`）· `:2559-2566`（`getTask`），与派单一致 |
| 工作区 | 仅本单 6 个 tracked 文件被改 + 3 个自建新件（见 §2）；其余为多会话既有未跟踪产物（未触碰） |

---

## §1 现取（改前）

### 1.1 两处同族 SQL（改前文本，行号=现取）

`backend-ts/src/database.ts` · `listTasks`（`FROM job_application AS j` 在 **:2534**）：

```sql
-- :2530-2537
      participant_counts AS (
        SELECT
          j.job_id AS tid,
          COUNT(1)::int AS participants_count
        FROM job_application AS j
        JOIN selected_tasks AS t ON t.job_id = j.job_id
        GROUP BY j.job_id
      )
```

`backend-ts/src/database.ts` · `getTask`（`FROM job_application AS j` 在 **:2563**）：

```sql
-- :2559-2566
      participant_counts AS (
        SELECT
          j.job_id AS tid,
          COUNT(1)::int AS participants_count
        FROM job_application AS j
        JOIN selected_task AS t ON t.job_id = j.job_id
        GROUP BY j.job_id
      )
```

- 计数形态 = `COUNT(1)::int AS participants_count`（两处同形）；`FROM` = `job_application`（**且未加 `public.` 限定**）。

### 1.2 提交表真源（DDL 现取）

`backend-ts/migrations/0014_job_flow.sql:115-133` `public.job_submission`（**冻结，不改**）：
列 = `submission_id / job_id / worker_uid / deliverable / review_status(pending|approved|rejected) / reviewed_by / reviewed_at / review_memo / create_key / time_created`。**无 `application_id`** ⇒ 提交物**不依赖**报名行，换轴后无悬空依赖。

### 1.3 前端消费点（现取，本单**不改**这些调用面）

| 文件:行 | 现取 |
|---|---|
| `frontend/src/pages/jobs/JobDetailPage.jsx:215` | `t('jobs.participants', { count: job.participants_count \|\| 0 })` |
| `frontend/src/components/task/TaskCard.jsx:130` | `{task.participants \|\| 0} {t('common.participantsUnit')}` |
| `frontend/src/pages/HomePage.jsx:54` | `participants: task.participants_count \|\| 0` |
| `frontend/src/pages/TaskPage.jsx:60,73` | `participants: task.participants_count \|\| 0`（:73 归并分支 `participants: task.participants \|\| 0`） |

### 1.4 四语改前值（现取）

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `jobs.participants` | 已报名 {{count}} 人 | 已報名 {{count}} 人 | {{count}} applicants | {{count}} người ứng tuyển |
| `common.participantsUnit`（**本单不动**） | 人参与 | 人參與 | participants | người tham gia |

键计数（改前）：顶层 **119** / 拍平 **1059** / 四语节点 **4236**（`zh/hk/en/vn` 各 1059）。

### 1.5 `ProfilePage` `/shard` 链接（现取）

`frontend/src/pages/ProfilePage.jsx:514`：`<Link to={buildLocalizedPath(lang, '/shard')} …>` ⇒ 属换轴遗留（`/shard` 已由 `App.jsx` 的 `LegacyExchangeRedirect` 兜住、零破损，但产品面仍是旧路径）。

---

## §2 改动清单（`git diff --numstat` 逐文件）

```
16	10	backend-ts/src/database.ts
1	1	frontend/src/locales/en.json
1	1	frontend/src/locales/hk.json
1	1	frontend/src/locales/vn.json
1	1	frontend/src/locales/zh.json
1	1	frontend/src/pages/ProfilePage.jsx
```

自建新件（未跟踪）：`backend-ts/scripts/s19-participants-truth-source.ts` · `frontend/src/test/unit/s19-participants-truth-source.test.jsx` · `backend-ts/.s19-artifacts/**`。

### 2.1 `backend-ts/src/database.ts`（两处 CTE 同源换真源）

> **硬口径**：表引用显式 `public.`；两处**必须同源**（S16 纪律）；`COUNT(1)` → `COUNT(DISTINCT worker_uid)`（**不区分 `review_status`**）。

`listTasks`（改后）：

```sql
      -- ★ S19（R-9-97~R-9-103）：participants_count 真源 = 逐笔提交（public.job_submission）。
      --   提交过即算参与（不区分 review_status；判不合格者仍是参与者、可再提）。
      --   本 CTE 与 getTask 内同族 CTE **必须同源**（S16「过滤谓词两处同源」纪律）。
      participant_counts AS (
        SELECT
          s.job_id AS tid,
          COUNT(DISTINCT s.worker_uid)::int AS participants_count
        FROM public.job_submission AS s
        JOIN selected_tasks AS t ON t.job_id = s.job_id
        GROUP BY s.job_id
      )
```

`getTask`（改后）：**逐字同形**，仅 `JOIN selected_tasks` → `JOIN selected_task`（其外层 CTE 名随 `getTask` 单任务形态，属既有限定，非语义差异）：

```sql
      participant_counts AS (
        SELECT
          s.job_id AS tid,
          COUNT(DISTINCT s.worker_uid)::int AS participants_count
        FROM public.job_submission AS s
        JOIN selected_task AS t ON t.job_id = s.job_id
        GROUP BY s.job_id
      )
```

### 2.2 四语 `jobs.participants`（**只改值、键名/键数不动**）

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `jobs.participants`（改后） | 已参与 {{count}} 人 | 已參與 {{count}} 人 | {{count}} participants | {{count}} người tham gia |

`common.participantsUnit` **保持不动**（真源变活后「人参与」语义成立）。

### 2.3 `frontend/src/pages/ProfilePage.jsx`

`:514` `buildLocalizedPath(lang, '/shard')` → `buildLocalizedPath(lang, '/exchange')`。

### 2.4 同族扫面（产品面 `/shard` 页面链接）

`frontend/src/**` 产品代码（排除 `/test/`）中，**页面级** `/shard` 链接形态
（`buildLocalizedPath(lang,'/shard')` / `to="/shard"` / `navigate('/shard')`）：

- **改前** = **1 处**：`pages/ProfilePage.jsx:514`
- **改后** = **0 处**（`grep` 读数见 §3.5；测试文件内的 `/shard` 属重定向覆盖，**保留不动**）

> 另存的 `/shard` 字样 = **注释**（`shell/nav.js`/`App.jsx`/`ShardPage.jsx`/`RewardPage.jsx`/`MarketPage.jsx`）与 **API 路径 `/api/shard*`**（冻结站内接口，非页面链接，**不在本单**）。

---

## §3 读数（逐格、run-tagged）

产物根：`backend-ts/.s19-artifacts/`
- 探针 pre（干净）：`s19-20261004T115900Z/readings.json`
- 探针 post：`s19-20261004T115944Z/readings.json`
- 原始 stdout 归档：`s19-20261004T120222Z/raw/`（`probe-pre.json` / `probe-post.json` / `tsc-noemit.txt` / `vitest-baseline.txt` / `vitest-final.txt` / `vitest-negcontrol-red.txt` / `build.txt` / `scr-*.txt`）

### 3.1 真库读数（探针 `readings.json`，只读 SQL）

只读 SQL（与两处 CTE 语义逐字对应）：

```sql
-- 旧源
SELECT COUNT(1)::int AS participants_count FROM public.job_application WHERE job_id = $1;
-- 新源
SELECT COUNT(DISTINCT worker_uid)::int AS participants_count FROM public.job_submission WHERE job_id = $1;
```

| job_id | 类型 | 旧源计数 | 新源计数 | 服务层 `getTask` | 服务层 `listTasks` |
|---|---|---|---|---|---|
| **232** | 派单指定 | 0 | **1** | 1（改后） | 1（改后） |
| **22** | 有 `job_submission` 行 | 1 | **3** | 3（改后） | 3（改后） |
| **12** | 只有 `job_application` 历史行 | 1 | **0** | 0（改后） | 0（改后） |

- **改前**（HEAD/旧源在效）：服务层三格 = `0 / 1 / 1` = **旧源**（与「数据源已死」一致）。
- **改后**：服务层三格 = `1 / 3 / 0` = **新源**（`COUNT(DISTINCT worker_uid)`）。
- **逐个解释数值差**：
  - `232`：旧 `job_application` 无行（0）、新 `job_submission` 有 1 个 distinct worker ⇒ 改前「已报名 0 人」是**假话**，改后「已参与 1 人」为真。
  - `22`：旧源 1 行（历史残值）、新源 3 个 distinct worker ⇒ 旧值 1 是**历史残值**（停写前的一次报名），真值 = 3。
  - `12`：旧源 1 行（历史残值）、新源 0 ⇒ 该 job 从未有提交 ⇒ 真值 = **0**（旧值 1 是残留）。

### 3.2 静态同源读数（探针 §A）

| 检查 | 期望 | 读数 |
|---|---|---|
| `participant_counts` CTE `FROM public.job_submission AS s JOIN selected_task` | 2 处 | 改前 0 / **改后 2** |
| `COUNT(DISTINCT s.worker_uid)::int AS participants_count` | 2 处 | 改前 0 / **改后 2** |
| `participant_counts` CTE `FROM job_application AS j JOIN selected_task` | 0 处 | 改前 2 / **改后 0** |
| `COUNT(1)::int AS participants_count`（全 `database.ts`） | 0 处 | 改前 2 / **改后 0** |
| 两处 CTE 段**逐字同形**正则命中 | 2 处 | 改后 **2** |

**`COUNT(1)::int AS participants_count` + `job_application` 的组合 = 0 处** ✅

存量历史面另有 `job_application` 引用（**不在本单**，逐处列出）：

| 行 | 形态 | 归属 |
|---|---|---|
| `:3345` `FROM public.job_application AS a` | 读口 | `listMyApplications` 历史行读口（S2 换轴后仅供历史面，注释已标） |
| `:3845` `INSERT INTO public.job_application …` | 写口 | J2 报名（`/apply` 已恒 410，服务层遗留分支） |
| `:3862` `:3869` `FROM public.job_application AS a, j` | 写口 | J2 同语句原子校验 |
| `:3930` `FROM public.job_application AS a` / `:3945` `UPDATE public.job_application AS a` | 写口 | J3 选定（`/accept` 已恒 410） |
| `:3974` `'job_application', ${applicationId}` | 账本标签 | 历史分录 actor 标签 |

⇒ 上述均为 **apply/accept 写路径 + 历史读面**，与 `participants_count` 计数无关（派单 AC1 允许逐处登记）。

### 3.3 前端四语（键名/键数不变 + 值逐字）

| 项 | zh | hk | en | vn |
|---|---|---|---|---|
| `jobs.participants`（值） | 已参与 {{count}} 人 | 已參與 {{count}} 人 | {{count}} participants | {{count}} người tham gia |
| `common.participantsUnit`（不动） | 人参与 | 人參與 | participants | người tham gia |

- 键计数：顶层 **119** / 拍平 **1059** / 四语节点 **4236**（**改前=改后**，值改不动键）。
- en/vn 的 `jobs.participants` **零 CJK**（单测 §(a) 断言通过）。
- 四语值均含 `{{count}}` 占位符。

### 3.4 硬门读数

| 门 | 命令 | 读数 |
|---|---|---|
| 后端类型 | `cd backend-ts && npx tsc --noEmit` | **exit 0** |
| 前端全量测试 | `cd frontend && npx vitest run` | **failed = 7 / 4 文件**（基线 = 7 / 4 文件，**逐条相同**） |
| 前端构建 | `cd frontend && npm run build` | **exit 0**（`✓ built in 1.80s`） |
| 四脚本 | `node scripts/{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.mjs` | **全 exit 0 / 全 PASS** |

**vitest 基线 vs 改后（逐条失败集，完全相同）**：

```
FAIL src/test/accessibility/Accessibility.test.jsx            (file-level，0 test)
FAIL src/test/e2e/basic.spec.js                               (file-level)
FAIL src/test/components/Card.test.jsx > renders Card with default props
FAIL src/test/components/Card.test.jsx > renders Card with different variants
FAIL src/test/components/Card.test.jsx > renders CardHeader
FAIL src/test/components/Card.test.jsx > renders CardTitle
FAIL src/test/components/Card.test.jsx > renders CardContent
FAIL src/test/components/Card.test.jsx > applies hover effect when enabled
FAIL src/test/performance/VirtualList.test.jsx > updates visible items on scroll
```

| 读数 | Test Files | Tests |
|---|---|---|
| 基线（改动前，stash 后跑） | 4 failed \| 47 passed (51) | 7 failed \| 449 passed (456) |
| 改后 | 4 failed \| 48 passed (52) | 7 failed \| **460** passed (467) |

⇒ failed 数 **7 = 7**（≤ 基线）且失败集**逐条相同**；新增 1 文件 / 11 测试全绿（`+11 passed`，`467-456=11`）。
**基线失败 8 项均为既有环境性缺陷**（Tailwind class 未加载 / Playwright spec 混入 vitest / Accessibility 套件崩），与本单改动无因果。

四个静态脚本读数（要点）：
- `p6-tr2-i18n-locales` → `总判：PASS`
- `p4z-i18nviol-global` → `总判：PASS`（locale 裸命中 0 + 源面裸命中 0；locale 节点 4236）
- `p4z-feperf-safelist` → `VERDICT=PASS`
- `p4z-miscfix-links` → `总判：PASS（残留全部已登记）`

### 3.5 `ProfilePage` 链接（AC5）

- `buildLocalizedPath(lang,'/exchange')` 四语读数（单测 §(c) 真 jsdom import 现取）：
  `zh → /exchange` · `en → /en/exchange` · `hk → /hk/exchange` · `vn → /vn/exchange`
- 产品面（排除 `/test/`）页面级 `/shard` 链接：**改后 = 0**（`grep` 与单测 §(c) 双读数一致）。

---

## §4 判负自证

### 4.1 数据源侧（红→绿两跑）

| 时点 | 探针 | 服务层读数 | 判定 |
|---|---|---|---|
| **改前**（HEAD 旧源在效） | `s19-20261004T115900Z` | `232→0 / 22→1 / 12→1` = **旧源** | **FAIL**（`failed` 含 `B-*` 与 `C2-neg-*`） |
| **改后** | `s19-20261004T115944Z` | `232→1 / 22→3 / 12→0` = **新源** | **PASS**（`failed: []`） |

- 负对照 `C2-neg-*`：**若真源未换** ⇒ `service == 旧源` 成立（改前 3/3 成立 = 红）；换源后 3/3 不成立（绿）。自证「服务层读数确实随真源变」。

### 4.2 展示面侧（内建负对照 + 字面红读数）

- 内建负对照（`s19-participants-truth-source.test.jsx` §★）：把 `participants_count` 钉为**旧源代表值 3** ⇒「新源断言」（文案须含「已参与 5 人」）**判假**（`false`）；钉为新源代表值 5 ⇒ 判真（`true`）。给红/绿两次读数。
- **字面红读数**（临时件 `s19-negcontrol-tmp.test.jsx`，跑完即删）：
  `AssertionError: expected '#9 · 已参与 3 人' to include '已参与 5 人'` ⇒ **1 failed (1)**（`vitest-negcontrol-red.txt`）。
  ⇒ 复原（钉回新源值）后全绿（§3.4，11/11 passed）。

---

## §5 未做与 NOT_MEASURED（逐项给原因）

1. **`headcount`（招募总人数）读模型** — 本单**不做**。原因：派单 ★ 明示「一句话可改、不要实现，只登记」；`normalizeTask` 未含 `headcount` ⇒「已参与 X / 共 N 人」属后续可选增强。**登记待办**。
2. **`/apply` `/accept` 路由** — 不动。原因：已恒 410（`APPLY_RETIRED`/`ACCEPT_RETIRED`）；本单只换计数真源，不碰写面。
3. **locale 键名/键数** — 不动。原因：派单硬性「只改值、不动键名、不动键数」；已给改前/改后键计数相等读数（119/1059/4236）。
4. **10 个死键** — 保留不动。原因：父单已裁「保留」。
5. **`/dashboard` 路由闸** — 不放开。原因：父单已裁「不放开」。
6. **`common.participantsUnit`** — 不改。原因：真源变活后「人参与」语义成立（派单逐字）。
7. **`job_application` 存量历史行** — 不删。原因：派单「历史行保留、不删」；探针改前后 `job_application = 19` 行逐字不变。
8. **NOT_MEASURED：无 HTTP 面端到端** — 未起服务、未发 HTTP。原因：硬口径⑥「本单预期无需起服务（组件级测试 + 只读 SQL 即可）」；服务层读数经 `DatabaseService.getTask/listTasks`（真代码路径 + 真库只读）覆盖，未跑 `/api/task/:tID` HTTP 往返。
9. **NOT_MEASURED：库面 `schema_version` 指纹** — 本单零迁移、零 DDL ⇒ 未取。原因：无 DDL 变更，取之无判据价值。

---

## §6 自曝（如实）

1. **探针首跑静态检查口径 bug**：初版 `A1` 用全文件 `/FROM public\.job_submission AS s/g` 计数，读到 **8**（他读口同形），误判 A1（期望 2）。首跑产物 `s19-20261004T115829Z/readings.json` **作废**（`A1` 假红）。已改为「限定到 `participant_counts` CTE」的锚定正则，并于 `s19-20261004T115900Z` 重取干净 pre 读数。**作废读数留档、未删**（可复核）。
2. **前端临时负对照件**：`s19-negcontrol-tmp.test.jsx` 仅为取「字面红」读数而建，跑完**已删**（`ls` 计数 = 0），不入交付。
3. **baseline 取法**：vitest 基线非「开工瞬时」取得，而是改动后以 `git stash push`（仅本单 6 个 tracked 文件）**临时回退到 HEAD** 跑得，跑完 `git stash pop` 复原（已核 `database.ts`/`locales`/`ProfilePage` 恢复）。原因：开工时未先跑全量，事后以 stash 精确重建；对锚 HEAD=`81d08a8` 未变。
4. **`git worktree`/`npm install` 未用**；未跑任何写库语句；探针首尾真库行数逐字相等（`job=45 / job_application=19 / job_submission=40 / ledger_entry=502 / account=48 / Σbalance(cid=1)=1993455`）。
5. **工作区未跟踪产物众多**（`.p8s*`/`.p9s*` 等历史产物），属多会话既有，本单未触碰、未清理。

---

## §7 交付物清单

| 类 | 路径 |
|---|---|
| 代码 | `backend-ts/src/database.ts`（两处 CTE 同源换真源） |
| 代码 | `frontend/src/locales/{zh,hk,en,vn}.json`（`jobs.participants` 4 值） |
| 代码 | `frontend/src/pages/ProfilePage.jsx`（`/shard`→`/exchange`） |
| 测试 | `frontend/src/test/unit/s19-participants-truth-source.test.jsx`（11 测试，含内建负对照） |
| 探针 | `backend-ts/scripts/s19-participants-truth-source.ts`（只读 SQL） |
| 读数 | `backend-ts/.s19-artifacts/s19-{20261004T115900Z,20261004T115944Z}/readings.json` + `s19-20261004T120222Z/raw/**` |
| 报告 | 本文件 |
