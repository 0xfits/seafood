# S7 前端接线 · 悬赏家评判列表（JobDetailPage 发布者视角）— 交付与自证报告

- 单号：**S7-FRONTEND-SUBMISSIONS-PANEL**
- 角色：**Kong（实现）**
- 开工 HEAD：`692f622`（`feat(task-model): S6 后端补口…`）
- 改动面：**仅 `frontend/**`**（页面 / `job-api.js` / `locales/**` / 测试）+ 本报告。
  **未碰** `backend-ts/**`（★S6b 并行面，工作树里 `backend-ts/src/index.ts` 的改动为 **S6b** 所出，非本单）· **未碰** `docs/*.spec.md` · **未碰** `migrations/**`。
- **未 commit / 未 push**；未 `npm install`；未碰/未打印 `.env*`；未 `pkill -f`/`killall`；未启停 5787/5788；**未起任何服务 / 未占端口**。
- 结论：**①–④ 全部交付并自证；vitest 零新增失败；build 0；四语齐备；六类泄漏 0。**

---

## §0 结论速览

| # | 事项 | 结果 |
|---|---|---|
| 1 | ① 发布者视角「提交列表」区块（仅发布者可见） | **已交付**：逐条 提交人 + 交付物 + 状态（三态四语查表）；`pending` 条给「合格」/「不合格」两按钮 |
| 2 | ② 接线层 `listJobSubmissions` / `reviewSubmission`（URL/body 与 S6 一致） | **已交付**：GET `/api/job/:jobId/submissions`；POST `/api/job/:jobId/review` body `{approved, submission_id}` |
| 3 | ③ 调用后刷新列表 + 失败按既有惯例 | **已交付**：成功后重读读口；失败复用既有 `reason→文案`（`auth.i18nKeyForErrorReason`，不另建） |
| 4 | ④ 新增文案键四语齐备 + 不重设视觉风格 | **已交付**：10 新键 × 4 语；全沿既有 `sf-jobs-*` 类与主题 token（零新增 CSS） |
| 5 | vitest | 前 `4 failed / 42 passed`（408 pass / 7 fail）⇒ 后 **`4 failed / 43 passed`（422 pass / 7 fail）** ⇒ **零新增失败** |
| 6 | `npm run build` | **0**；产物 `dist/index.html` + `dist/assets/index-DYLJmdLN.js`（419.60 kB）+ `dist/assets/index-C…css` |
| 7 | 四语键（值-只改 / 新增） | **值-只改 = 0**；**新增 = 10 键 × 4 语 = 40 节点**；top 119 不变 / flat **1044⇒1054** / 节点 **4176⇒4216** |
| 8 | 六类泄漏 | 脚本总判 **PASS**：locale 裸命中 **0** / 源面裸命中 **0** / en·vn CJK **0** / 类级残余 **0** |
| 9 | 未测项 | 真机 e2e（禁起服务）；后端逐笔 reject 真链路（S6b 面）——见 §6 |

---

## §1 ★「是否发布者」判定的现取与落法（本单最关键的口径）

**任务书要求**：「仅当**当前用户 = 发布者**时渲染（现取现有「是否发布者」判定助手复用，**不另写**）」。

**现取（逐条给 `文件:行`）**：

1. **前端不存在**任何「是否发布者 / isPublisher / isOwner」判定助手 —— 全 `frontend/src` grep：`isPublisher|isOwner|isMine|publisher|owner` 无此函数（`utils.js` / `admin-utils.js` / `auth*.js` 导出清单逐条核对）。
2. **结构上无法本地判定**：任务详情读口 `GET /api/task/:tID` 的归一 `normalizeTask`（`backend-ts/src/database.ts:1467-1491` 与 `interface TaskRecord :1160`）**不含发布者 uid**（键集 = `tID/title/note/refcode/link0/linkA/linkB/points/type/time_*/is_open/participants_count` + i18n 键）⇒ 即便 `SELECT t.*`，路由回包也不带 `employer_uid`。
3. **既有归属闸唯一**：后端 `requireJobOwnerOrAdmin`（`backend-ts/src/index.ts:2289`）＝「**发布者本人 ∨ 持 `review_tasks` 的管理员**」；`/api/job/:jobId/{submissions,review}` 两口的准入都是它（`:2485` / `:2453`）。

**落法（不另写）**：前端**不臆测身份** —— 直接调用 S6 读口 `GET /api/job/:jobId/submissions`，由**既有归属闸**裁决：
- 过闸（**200**）⇒ 是发布者（或 `review_tasks` 管理员）⇒ **渲染**本区块；
- 闸拒（**403 `AUTH_FORBIDDEN`**）⇒ 非发布者 ⇒ **整块不渲染**（当作「不可见」而非首屏错误）；
- 其它失败 ⇒ **fail-closed 隐藏**（不臆测身份）；仅当**此前已过闸**（发布者）才把刷新失败升为可见错误。

> ★ **登记待 Zang 复核**：因闸是「发布者 **∨** admin」且前端无发布者 uid ⇒ 本区块对「发布者」与「`review_tasks` 管理员」**均可见**（结构上无法区分二者）。若要求「**仅**发布者、admin 不可见」，需后端在回包暴露发布者 uid 或另定判据（属后端面，本单不动）。

---

## §2 交付内容

### ① 页面区块（`frontend/src/pages/jobs/JobDetailPage.jsx`，主列，提交表单之后）
- **可见性**：`subs.admitted` 为真（读口过闸）才渲染；403 ⇒ 不渲染。
- **逐条**（`item` = S6 读口 9 键之一）：标题 = `jobs.submissionItemTitle`（`提交 #<submission_id> · 提交人 #<worker_uid>`，**复用本仓 uid 展示惯例** `#<uid>`，同 `MarketPage` / `UsersManagement`）；交付物 = `item.deliverable || '—'`；状态 = **三态查表**（`review_status` ⇒ 四语文案，**不原样渲染枚举**）。
- **按钮**：仅 `review_status === 'pending'` 条给「合格」（`jobs.markQualified`）/「不合格」（`jobs.markUnqualified`）两按钮 ⇒ `decideSubmission`。
- **状态机文案查表**（`SUB_STATUS_I18N_KEYS`）：`pending→jobs.subStatusPending` / `approved→jobs.subStatusApproved` / `rejected→jobs.subStatusRejected`；未知取值 ⇒ `—`（不泄漏枚举）。
- **视觉**：全用既有类 `sf-jobs-panel/-title/-item/-item-title/-meta/-row/-tag/-status/-ok/-err/-empty` 与既有 `data-sf-m` 命名；**零新增 CSS / 零 token 改动 / 零主题分支**。

### ② 接线层（`frontend/src/pages/jobs/job-api.js`）
```js
// 读口（S6 入库；准入 = 发布者本人 ∨ review_tasks）
export const listJobSubmissions = (jobId, user) => getJson(`/api/job/${jobId}/submissions`, user)

// 判定口：body = { approved, submission_id }（S6 形态）
export const reviewSubmission = (jobId, approved, user, submissionId) =>
  postJson(`/api/job/${jobId}/review`, { approved, submission_id: submissionId }, user)
```
- **URL 与 body 形态与 S6 逐字一致**（`index.ts:2483` / `:2451`）；**未发明任何接口**。
- `submissionId` 为**第 4 参追加**：既有 3 参调用（`JobReviewPage.jsx:70`）**逐字不变** ⇒ 缺省 ⇒ `JSON.stringify` 丢弃该键 ⇒ body 仅 `{approved}` ⇒ 服务层落**遗留单笔分支**（**零回归**）。
- 逐笔语义（逐字）：`approved:true` ⇒ **发一份赏金**；`approved:false` ⇒ **零资金、该提交转 `rejected`、任务保持 `open`**（后端 S6b 正实现该分支；本单**只接线、不改后端**）。

### ③ 状态反馈
- 判定成功 ⇒ 先写成功态（`jobs.reviewQualifiedOk` / `jobs.reviewUnqualifiedOk`）⇒ **`await loadSubmissions()` 刷新列表**。
- 判定失败 ⇒ **复用既有 `reason→文案`映射**（`frontend/src/auth.js` 的 `i18nKeyForErrorReason`，**不另建**）：`reason` 命中 ⇒ 用该键文案；未命中 ⇒ 原链路文案（`error.message` 已过 R107 链：`reason`→`i18n_key`→原文→四语通用兜底）。

### ④ 新增文案键（10 键 · 四语齐备 · 逐字）
| 键 | zh | en | hk | vn |
|---|---|---|---|---|
| `jobs.submissions` | 提交列表 | Submissions | 提交列表 | Bài nộp |
| `jobs.submissionsEmpty` | 暂无提交 | No submissions yet | 暫無提交 | Chưa có bài nộp |
| `jobs.submissionItemTitle` | 提交 #{{submission}} · 提交人 #{{worker}} | Submission #{{submission}} - by #{{worker}} | 提交 #{{submission}} · 提交人 #{{worker}} | Bài nộp #{{submission}} · bởi #{{worker}} |
| `jobs.subStatusPending` | 待审核 | Pending | 待審核 | Chờ duyệt |
| `jobs.subStatusApproved` | 已通过 | Approved | 已通過 | Đã duyệt |
| `jobs.subStatusRejected` | 未通过 | Rejected | 未通過 | Không đạt |
| `jobs.markQualified` | 合格 | Qualified | 合格 | Đạt |
| `jobs.markUnqualified` | 不合格 | Not qualified | 不合格 | Không đạt |
| `jobs.reviewQualifiedOk` | 已判定合格，赏金已发放 | Marked qualified; the reward has been paid | 已判定合格，賞金已發放 | Đã đánh giá đạt; thù lao đã được trả |
| `jobs.reviewUnqualifiedOk` | 已判定不合格 | Marked not qualified | 已判定不合格 | Đã đánh giá không đạt |

- 四语齐备、非空；**en/vn 零 CJK**（脚本现取 = 0）；`jobs` 为**既有顶层** ⇒ 顶层键数不变。

---

## §3 自证读数

### ① vitest（`npx vitest run src/test`，含路径参数；**未**用裸 `npm test` / `npx vitest`）
| 口径 | 前（基线 `692f622`） | 后 |
|---|---|---|
| Test Files | **4 failed / 42 passed (46)** | **4 failed / 43 passed (47)** |
| Tests | **7 failed / 408 passed (415)** | **7 failed / 422 passed (429)** |
- 失败集**逐条不变**（均非本单面）：`Card.test.jsx` 6 例 + `VirtualList.test.jsx` 1 例 + 文件级 0-test（`Accessibility.test.jsx` 转译错、`e2e/basic.spec.js` Playwright）⇒ **零新增失败**。
- 新增用例：`src/test/unit/s7-submissions-panel.test.jsx`（**14 例全绿**）。
- 受影响/计数测试显式复跑：8 文件 = **8 passed / 74 tests**。

### ② build
- `npm run build` ⇒ **EXIT 0**；产物 = `dist/index.html` + `dist/assets/index-DYLJmdLN.js`（419.60 kB）+ `dist/assets/index-BKka7fLt.css`（126.09 kB）+ `vendor-{react,router,ui,i18n}.*`。`frontend/dist` 受 `.gitignore` 忽略（未进工作树）。

### ③ 四语键逐字 + 计数（值-只改 **vs** 新增）
| 口径 | 前 | 后 |
|---|---|---|
| **值-只改（键数不动）** | — | **0**（本单未改任何既有键的值） |
| **新增键** | — | **10 键 × 4 语 = 40 节点** |
| 顶层键（每语） | 119 | **119**（`jobs` 既有顶层，不新增 namespace） |
| 拍平键（每语） | 1044 | **1054**（+10） |
| 四语节点合计 | 4176 | **4216**（+40） |
- 逐字值见 §2④。脚体现取：zh/en/hk/vn 每语 `top=119 / flat=1054`。
- 计数断言**逐条登记订正**（本仓既有「期望订正」惯例，**非删断言**）：`i18n-batch-b4a` / `i18n-batch-b4b`(×2) / `i18n-batch-b5`(×2) / `i18n-violation-closeout`(×2) / `r9-93-points-symbol`(×2) / `r9-96-dashj-copy`(×3) / `s5-publish-headcount`(×2)。

### ④ 六类泄漏（工程口径进用户可见文案）
- `node scripts/p4z-i18nviol-global.mjs` ⇒ **EXIT 0 / 总判 PASS**：locale 裸命中 **0** + 源面裸命中 **0**、en/vn 残留中文 **0**、类级残余（活体）**0**；作用域节点 `locale=4216 / source=48`。
- 子面③「非注释引号字面量」= **36**（与基线**同为 36**）；其中命中工程口径 **1**，为**既有** JSX 注释（`JobDetailPage.jsx:336`）**非本单**——新增 10 键逐条过六类黑名单 **命中 0**。

### ⑤ 未测项（写原因）
1. **真机 e2e / 起服务联调**：未做 —— 硬口径禁起服务 / 占端口 / 启停 5787/5788；改以「真 `job-api.js` + 真 `fetchApiJson` + stubbed `fetch`」的**接线层联测**（`s7-submissions-panel.test.jsx` 断言 URL/body/刷新/403 隐藏）+ 全量单测代偿。
2. **后端 `approved:false` 逐笔真链路**（零资金 / 该提交转 `rejected` / 任务保持 `open`）：未测 —— 属 **S6b 并行面**（本单禁碰后端）；且真库 `0042` 未 apply（S6 报告 §6 已登记阻断）。本单只接线，body 形态与 S6/S6b 一致（`{approved, submission_id}`）。若自测发现异常按口径**只报不改**。
3. **「发布者」与「`review_tasks` 管理员」的可见性区分**：未提供 —— 见 §1 登记（前端无发布者 uid，结构上无法区分）。

---

## §4 改动清单（工作树）

| 文件 | 变更 | 说明 |
|---|---|---|
| `frontend/src/pages/jobs/job-api.js` | +24 / −2 | 新增 `listJobSubmissions`（读口）；`reviewSubmission` 增第 4 参 `submissionId` ⇒ body `{approved, submission_id}`（3 参旧调用零回归）；头部路由清单 +1 行 |
| `frontend/src/pages/jobs/JobDetailPage.jsx` | +114 / −2 | 新增发布者视角「提交列表」区块（可见性 / 逐条 / 状态查表 / 两按钮 / 刷新 / 错误链） |
| `frontend/src/locales/{zh,en,hk,vn}.json` | 各 +12 / −1 | 新增 10 键（各语各添 1 份，共 40 节点） |
| `frontend/src/test/unit/{i18n-batch-b4a,i18n-batch-b4b,i18n-batch-b5,i18n-violation-closeout,r9-93-points-symbol,r9-96-dashj-copy,s5-publish-headcount}.test.*` | 12 / −12 行 | 计数期望订正（1044⇒1054 / 4176⇒4216），**非删断言** |
| `frontend/src/test/unit/s7-submissions-panel.test.jsx` | 新增 | 本单 14 例（接线层 URL/body + 页面渲染 + 403 隐藏 + 刷新 + reason 复用 + 四语/计数） |
| `docs/audit/s7-frontend-submissions-panel.md` | 新增 | 本报告 |

- `git status`（本单面）**未含** `backend-ts/**`（该处改动 = S6b 并行面）· 未含 `docs/*.spec.md` · 未含 `migrations/**`。

---

## §5 现取发现（登记 · 越出本单面，仅报不改）

- **`jobs.deliverable` 键缺失**：`JobDetailPage.jsx` 提交表单字段标签引用 `t('jobs.deliverable')`（`:182`），但四语 locale **均无该键**（全仓 `grep deliverable src/locales` 命中 0）⇒ 该标签当前渲染**裸键** `jobs.deliverable`（一处既有 i18n 泄漏，脚本②未覆盖「被引用但缺失的键」）。**本单未改**（越出本单面；避免牵动提交表单既有断言）。建议后续单补键或用既有键替代。
- **`submission_id` 别名**：S6 body canonical = `submission_id`（别名 `submissionId`）；本单前端取 **canonical `submission_id`**（与 S6 report §1② 一致）。

---

## §6 硬口径核对

- ✅ 仅改 `frontend/**`（13 文件）+ 本报告；**未碰** `backend-ts/**` / `docs/*.spec.md` / `migrations/**`。
- ✅ **未 commit / 未 push**；**未 `npm install`**；未碰/未打印 `.env*`。
- ✅ 测试只用 `npx vitest run <路径>`（**未**用裸 `npm test` / `npx vitest`）。
- ✅ 新增文案键**四语齐备**（zh/en/hk/vn）；en/vn 零 CJK。
- ✅ **未起服务 / 未占端口**；未 `pkill -f` / `killall`；未启停 5787/5788。
- ✅ 未测项均写明原因（§3⑤）。
