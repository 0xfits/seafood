# S5 前端 UI 重设 · 交付与阻塞报回（Kong）

- 基线：`git log --oneline -1` = `102d090`（fix(task-model): 0042 修 settle_txid set-once 冲突…）
- 范围（实际改动）：**仅 `frontend/**`**（页面 / `job-api.js` / `locales/**` / 测试）+ 本报告。
  未碰 `backend-ts/**` · 未碰 `docs/*.spec.md` · 未碰 `migrations/**`；不 commit / 不 push。
- 结论：**§① 已交付并自证；§② 按「不确定就停下报回」硬口径停线报回；§③ 遵守（未重设视觉风格）。**

---

## ① 发布任务表单「总人数」+ 押金提示（**已交付**）

### 改动
| 文件 | 改动 |
|---|---|
| `frontend/src/pages/jobs/job-api.js` | `publishJob` 入参 + body 增 `headcount`；`jobPublishFingerprint` 纳入 `headcount`（人数变 = 新实体，防误判重放） |
| `frontend/src/pages/jobs/PublishJobPage.jsx` | 表单新增「总人数」字段（`type=number min=1 step=1 required`，默认 `'1'`）；新增押金提示（`赏金 × 人数`，空值占位 `—`）；`onSubmit` 增代码闸（非 ≥1 整数 ⇒ 拦下、不发起请求） |
| `frontend/src/locales/{zh,en,hk,vn}.json` | 新增 3 键（各语各添 1 份，共 12 节点） |

### 后端依据（现取，未自造接口）
- `backend-ts/src/job-funds-service.ts:152-212` `publishJob`：**已收 `headcount`**（`:182-185`，缺省 `'1'`）；托管额 = `reward × headcount`（`:144-146`，金额由 DB 侧派生）。
- 故前端只需**照传** `headcount` + **展示**提示，不做托管计算。

### 新增文案键（逐字 · 四语）
| 键 | zh | en | hk | vn |
|---|---|---|---|---|
| `jobs.headcount` | 总人数 | Headcount | 總人數 | Headcount |
| `jobs.headcountInvalid` | 总人数必须是不小于 1 的整数 | Headcount must be a whole number of at least 1 | 總人數必須係不小於 1 嘅整數 | Headcount must be a whole number of at least 1 |
| `jobs.depositHint` | 押金：{{deposit}} $（酬金 {{reward}} × 人数 {{headcount}}） | Deposit: {{deposit}} $ (reward {{reward}} x headcount {{headcount}}) | 押金：{{deposit}} $（酬金 {{reward}} × 人數 {{headcount}}） | Deposit: {{deposit}} $ (reward {{reward}} x headcount {{headcount}}) |

- 四语齐备、非空；**en/vn 零 CJK**（脚本现取 = 0）。

### 键计数（前后）
| 口径 | 前 | 后 |
|---|---|---|
| 顶层键（每语） | 119 | **119**（`jobs` 为既有顶层，不新增 namespace） |
| 拍平键（每语） | 1041 | **1044**（+3） |
| 四语节点合计 | 4164 | **4176** |
- 计数断言**逐条登记订正**（本仓既有「计数期望订正」惯例，非删断言）：
  `i18n-batch-b4a` / `i18n-batch-b4b`(×2) / `i18n-batch-b5`(×2) / `i18n-violation-closeout`(×2) / `r9-93-points-symbol` / `r9-96-dashj-copy`。

---

## ② 悬赏家评判列表（**停线报回 · 未接线**）

**未动一行**：按本单硬口径「★ 不得因接口形态未定而自己发明路径 —— 不确定就停下报回」。现取结果与任务书假定**不符**，且缺一个必需的读口：

### 现取（逐条给 `文件:行`）
1. **任务书假定的 `POST /api/job/:jobId/review` 并非「逐笔判定」**：
   - 路由 = `backend-ts/src/index.ts:2443-2460`；入参形态 = **仅路径 `:jobId` + body `{approved}`**（`:2448`），**无提交号**（body / 路径皆无）。
   - 实现 = `settleJob({ jobIdRaw, reviewerUid })`（`:2452`）—— **未传 `submissionIdRaw`** ⇒ 落 `settleJob` 的「遗留单笔」分支（键退化为 `biz:job:settle:<job_id>`，发 `job.worker_uid`；真源 `job-funds-service.ts:234-235`）。
   - ⇒ 该路由**当前无法逐笔**：没有可承载「提交号」的入参。
2. **逐笔复核面的真正落点 = 另一条路由，且仅管理员**：
   - verb = `verifyJobSubmission`（`job-funds-service.ts:374-426`，`approved:false` ⇒ `rejectJobSubmission` 只落结论位、零资金）。
   - 唯一接线 = `POST /api/tasklist/:jID/verify`（`index.ts:1978`），`:jID` = `submission_id`，body `{approved}`。
   - 准入 = `requireAdmin(req, res, 'review_tasks')`（`index.ts:1979`）⇒ **管理员专用**，**不是「发布者本人」**（与需求「仅发布者可见」冲突）。
3. **读口缺失**：列出「该任务的提交」所需读口**未注册**：
   - spec 已冻结 `GET /api/job/:jobId/submissions`（`docs/data-layer.spec.md:281`），但 `backend-ts/src/index.ts` **无此路由**（`grep -rn '/submissions' src` 命中 0）。
   - 现有提交类读口均不可用：`GET /api/task-progress` = **本人**逐笔（`listTaskProgressByUser`）；`GET /api/tasklist/pending-verification` = **管理员**全局且**仅 pending**；`GET /api/task/:tID` = 任务详情（无 submissions 数组）。

### 结论 / 请求裁定
- **两个必需口都还没上桌**：(a) 「发布者列出本任务全部提交（含状态）」读口不存在；(b) 「发布者逐笔判合格/不合格」写口没有可传提交号的路由（逐笔路由是 admin-only）。
- 依本单「S4e 并行面 · 不得自造接口」⇒ 我**不发明** `/api/job/:jobId/review` 的 body 形态，也不去调不存在的 `/submissions`。**请确认 S4e 落点后我再接线**（预期 S4e 需：① 注册 `GET /api/job/:jobId/submissions`；② 把 `POST /api/job/:jobId/review` 改为收提交号并转发 `submissionIdRaw`，或另定发布者用的逐笔口）。

---

## ③ 视觉风格（**遵守**）
- PublishJobPage 新增字段 / 提示一律沿用既有类（`sf-jobs-field` / `sf-jobs-label` / `sf-jobs-input` / `sf-jobs-meta`）与既有 `data-sf-m` 命名；未新增 CSS、未改 token、未动主题。

---

## 自证读数

### ① vitest（`npx vitest run src/test`，加路径参数，未用裸 `npm test`/`npx vitest`）
| | 前（基线） | 后 |
|---|---|---|
| Test Files | 4 failed / 41 passed (45) | **4 failed / 42 passed (46)** |
| Tests | **7 failed** / 399 passed (406) | **7 failed** / 408 passed (415) |
- 失败集**逐条不变**（均非本单面）：`Card.test.jsx` 6 例 + `VirtualList.test.jsx` 1 例 + 文件级 0-test（`Accessibility.test.jsx` / `e2e/basic.spec.js`）⇒ **零新增失败**。
- 新增用例：`src/test/unit/s5-publish-headcount.test.jsx`（9 例全绿）；受影响 10 个测试文件显式复跑 = **10 passed / 93 passed**。

### ② build
- `npm run build` ⇒ **0**；产物 = `dist/index.html` + `dist/assets/index-Hez9Kgrg.js`（415.35 kB）+ `dist/assets/index-BKka7fLt.css`（126.09 kB）+ 若干 vendor chunk。

### ③ 四语键
- 见上「新增文案键」表；脚体现取：zh/en/hk/vn 每语 `top=119 / flat=1044`。

### ④ 六类泄漏（工程口径进用户可见文案）
- `node scripts/p4z-i18nviol-global.mjs` ⇒ **退出码 0 / 总判 PASS**：locale 裸命中 **0** + 源面裸命中 **0**、en/vn 残留中文 **0**、类级残余 **0**。
- 新增 3 键逐条过六类黑名单：① 章节号/条号 0 ② HTTP 码 0 ③ 路径/方法 0 ④ 批次名/单号 0 ⑤ 机读码/裸 i18n 键 0 ⑥ 表名列名函数名 0。

### ⑤ 未测项（写明原因）
- **发布表单真机联调 / e2e**：未做 —— 硬口径禁起服务 / 占端口 / 启停 5787/5788；改以 `PublishJobPage` 组件测（`s5-publish-headcount.test.jsx`）+ 全量单测代偿。
- **对后端 `POST /api/job` 的真发（含 `headcount`）**：未做 —— 硬口径禁起服务；仅以 mock 断言 body 形状（`headcount` 照传）。服务层已冻结（`job-funds-service.ts:182`），未复测其后端行为。
- **§② 悬赏家评判列表**：未实现（见上，接口缺口阻塞，待 S4e 落点）。
