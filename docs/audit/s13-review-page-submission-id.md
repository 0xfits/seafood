# S13 · `/task/review`「判合格」报 409 — 逐笔提交号缺参修正

**单号**：S13（Kevin 亲报用户可见缺陷）
**基线**：`fadae40`（开工 `git log --oneline -1` 现取）
**角色**：Kong
**口径**：**只改前端**（后端已正确，仅缺前端参数）；**不 commit / push**。
**红点**：Kevin 在 `/task/review` 页点「合格」→ 报「当前状态不允许此变更」（= 后端 `409 LEDGER_CURRENCY_INVALID_TRANSITION`）。

---

## 1. 真因（现取坐实）

| # | 落点（现取） | 事实 |
|---|---|---|
| ① | `frontend/src/pages/jobs/JobReviewPage.jsx:70` | `await reviewSubmission(key, approved, user)` —— **只传 3 参**，缺第 4 参 `submissionId` |
| ② | `frontend/src/pages/jobs/job-api.js:89` | `reviewSubmission(jobId, approved, user, submissionId)` ⇒ `postJson('/api/job/'+jobId+'/review', { approved, submission_id: submissionId })` |
| ③ | 缺参后果 | body 只有 `{approved}` ⇒ 后端 `index.ts:2464` `submissionIdRaw` 为 `undefined` ⇒ 落**遗留单笔分支**（`settleJob` 不传 `submissionIdRaw`） |
| ④ | 遗留分支 + 0042 | `migrations/0042_job_settle_per_submission.sql:361-364` `v_payee := v_job.worker_uid`；新模型 job `worker_uid = NULL` ⇒ 结算分录无法派生 ⇒ **`409 LEDGER_CURRENCY_INVALID_TRANSITION`**（见 §5 实测 3/3） |
| ⑤ | 数据可用 | `database.ts:4013-4014` 现取：`s.submission_id AS "jID"`、`s.job_id AS "tID"` ⇒ **两值都在** ⇒ 页面已取 `tID`，**只需补 `jID`** |

**修法**：`decide` 同时取 `jobId = String(item.tID ?? '')`（URL `:jobId`）与 `submissionId = item.jID`（body `submission_id`），调 `reviewSubmission(jobId, approved, user, submissionId)`。

---

## 2. 同族全仓扫面（`reviewSubmission` / `/api/job/…/review` / `/api/tasklist/:jID/verify`）

**动作面**（`POST /api/job/:jobId/review`，提交号走 body `submission_id`）：

| 文件:行 | 是否传提交号 | 处置 |
|---|---|---|
| `frontend/src/pages/jobs/JobReviewPage.jsx:70` | ❌ 缺（3 参） | **本单修正** ⇒ 4 参 |
| `frontend/src/pages/jobs/JobDetailPage.jsx:127` | ✅ `reviewSubmission(jobId, approved, user, sid)`（`sid = item.submission_id`） | **已正确，零改** |
| `frontend/src/pages/jobs/job-api.js:89` | — 接线层定义 | 仅**注释**同步（旧口径「3 参零回归」已作废） |

**旧路径**（`POST /api/tasklist/:jID/verify`，`:jID` 语义 = 提交号，`index.ts:1978` / `job-funds-service.ts:374` `verifyJobSubmission` 按 `submission_id` 解析）：

| 文件:行 | 是否传提交号 | 处置 |
|---|---|---|
| `frontend/src/pages/DashboardPage.jsx:225`（`handleVerifyTask`，调用点 `:477` `task.jID`） | ✅ 传的是 `item.jID = submission_id`，且后端 `:jID` 即按提交号解析 | **已正确，零改**（口径不同：提交号在 **URL** 而非 body） |

**测试引用**（非产品调用）：

| 文件:行 | 说明 |
|---|---|
| `frontend/src/test/unit/s7-submissions-panel.test.jsx:105/116` | 接线层 4 参 / 3 参对拍（保留，作负对照锚） |
| `frontend/src/test/unit/s13-review-page-submission-id.test.jsx`（**本单新增**） | 页面 + 接线层逐笔断言 |

**结论**：全仓**仅 1 处真缺陷**（`JobReviewPage`，已修）；`JobDetailPage` 与 `DashboardPage` 均已正确传提交号。无遗漏落点。

---

## 3. 改动清单（仅允许面内）

| 文件 | 改动 |
|---|---|
| `frontend/src/pages/jobs/JobReviewPage.jsx` | `decide` 补第 4 参 `submissionId = item.jID`；文件头注释同步为**逐笔口径**（含现取行号 `:1962`/`:2457`、`database.ts:4013-4014`） |
| `frontend/src/pages/jobs/job-api.js` | 仅**注释**：文件头 ⑤ 幂等键改为 `biz:job:settle:<job_id>:<submission_id>`；`reviewSubmission` 文档改为「缺提交号 ⇒ 0042 下必 409 ⇒ 新代码一律带提交号」 |
| `frontend/src/test/unit/s13-review-page-submission-id.test.jsx` | **新增**：页面逐笔 + 逐行各自提交号 + 负对照锚 |
| `docs/audit/s13-review-page-submission-id.md` | 本报告 |

**未碰**：`backend-ts/**`（除 `.p9s13/` 探针）· `docs/*.spec.md` · `migrations/**` · `frontend/src/locales/**`。

---

## 4. 测试与构建读数

| 项 | 读数 |
|---|---|
| `npx vitest run`（改后全量） | `Test Files 4 failed \| 46 passed (50)`；`Tests 7 failed \| 444 passed (451)` |
| 基线（改前全量） | `Test Files 4 failed \| 45 passed (49)`；`Tests 7 failed \| 439 passed (446)` |
| **Δ** | **failed 7 → 7（未新增）**；新增 1 文件 / 5 用例**全绿** |
| `npx vitest run .../s13-review-page-submission-id.test.jsx` | **5 passed (5)** |
| **负对照**（临时去掉第 4 参 ⇒ 重跑本单测试） | **3 failed \| 2 passed (5)** —— 3 条页面断言全红（`expected {approved:true} to deeply equal {approved:true, submission_id:235}`），红点已复现 |
| `npm run build` | **exit 0**，产物 `dist/assets/index-TQYNpynj.js`（420.23 kB）+ `dist/assets/index-BKka7fLt.css` |

---

## 5. 真 HTTP 两臂（受控实例 **5796** · 真库 **schema_version=0042**）

`PORT=5796 npx ts-node --transpile-only src/index.ts`；令牌 = `createSessionToken({uID:970213})`（= job232 雇主，亦持 `review_tasks`）。
目标：`job 232`（`open` · headcount 50 · reward 100 · escrow 2357 · worker_uid NULL）+ 待审提交 `sub 237`（`pending`）。

| 臂 | 请求 | 读数 |
|---|---|---|
| **(a) 不带提交号**（对照 = 现状缺陷复现） | `POST /api/job/232/review {approved:true}` | **409 `LEDGER_CURRENCY_INVALID_TRANSITION`**（重复 3/3 稳定）；`ledger_entry` 前后 408→408（**零写**）|
| **(b) 带提交号**（修正路径） | `POST /api/job/232/review {approved:true, submission_id:237}` | **200 `Job settled`**；成功面 15 键；`entry_count=4`；`kinds=[job_payout,job_payout,job_fee,job_fee]`；`submissions_reviewed=1` |

**臂 (b) 逐条净写登记**（`event_root_key = biz:job:settle:232:237`）：

| 对象 | 净写 |
|---|---|
| `ledger_entry` | **+4 行**：`job_payout` uid970213 Δ0 / `job_payout` uid970213 Δ+90 / `job_fee` uid970213 Δ0 / `job_fee` uid−1 Δ+10 |
| `account` 合计 | `Σbalance` 2023986 → 2024086（**+100**）；`Σfrozen` 16344 → 16244（**−100**）|
| `job_submission 237` | `review_status` pending → **approved**；`reviewed_by=970213`；`review_memo='job settle:232:237'` |
| `job 232` | `ledger_event_keys` += `biz:job:settle:232:237`；`status` 保持 **open**（1/50，未发满）|

> 臂 (a) 首次运行曾偶发 `503 LEDGER_TX_TIMEOUT`（`driver_connection_error ECONNRESET`，驱动瞬时抖动、零写）；复测 3/3 稳定为 **409** ⇒ 采用稳定读数。

---

## 6. 实例收尾

| 项 | 读数 |
|---|---|
| 精确 `kill -TERM` | PID `74518`（LISTEN，ts-node 子进程）、`74139`（npm exec ts-node 父进程）|
| `lsof -nP -iTCP:5796 -sTCP:LISTEN` | **空读数**（`PORT_5796_FREE`）|
| 残留进程 | 无 |

---

## 7. 边界与纪律

- ✅ 只改前端 3 文件 + 报告；`backend-ts/**` 未动（探针在 `.p9s13/`）。
- ✅ 不 commit / push；不 `npm install`；未启停 5787/5788；未占 5796 以外端口。
- ✅ 连库只从主仓 `.env.local` 加载，未复制/回显连接串、密钥、令牌。
- ✅ 未使用 `pkill -f` / `killall`；实例按精确 PID 收尾。
