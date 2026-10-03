# S3-c 收尾 · 路由层退役（route layer retire）

> 单号：S3-c（收尾；承接 S3 单撞迭代上限留下的三项）
> 角色：Kong · 日期：2026-10-03 · 仓库：`/Users/kevin/bistro/seafood`（**不 commit / 不 push**）
> 开工 HEAD：`f87d268`
> 本单实际改动面：`backend-ts/scripts/p8-s11-audit-console-gate.ts`（K9 前推）+ 本报告。**未碰** `backend-ts/src/**`（S4a-c 并行）/ `frontend/**`（S3b-c 并行）/ `migrations/**` / `docs/*.spec.md`。

## 0. 背景与前推原因
- `0041` 已 apply 真库 ⇒ `schema_migration` = **40 行 / max `0041`**。
- 一次**真实运营发放**落库：`admin_ops_audit_log` 中 `action='points_adjust'` 行数 **4 → 5**
  （`idempotency_key='ops:1:points_adjust:970213:1:kevin-grant-10000-a'`）。
  ⇒ `p8-s11` 门内该表的**两处冻结值**（K8 过滤行数 / K9 计数）均须前推。
  前单已把 **K8 前推为 5（已绿）**，**K9 漏改** —— 本单补齐。

## (a) 两个 `410` 的逐字形状 + 真 HTTP 读数

两条退役面均在 `backend-ts/src/index.ts` 内**在访问任何表之前**直接返回 `410`（handler 零表访问 / 零副作用），
且**撤 `requireActor` 前置**（弃用面不得把「已下线」伪装成「未授权」；零副作用 ⇒ 无令牌下亦可观测 410）。

### A2 · J2 报名 —— `POST /api/job/:jobId/apply`（`index.ts:2361-2385`）
- `reason` 稳定常量 = **`APPLY_RETIRED`**（`route-layer.spec` v2.23 §34.7）；`ref_id = '/api/job/:jobId/apply'`。
- 产出器 = `job-service.ts` `ledgerErrorBody`（R107，`§3.3-1`）。逐字形状（源码）：

```ts
app.post('/api/job/:jobId/apply', (_req, res) => {
  return res.status(410).json(ledgerErrorBody(
    'LEDGER_REF_NOT_FOUND',
    `endpoint deprecated: ${APPLY_RETIRED_REF_ID}`,
    {
      ref_type: 'endpoint',
      ref_id: APPLY_RETIRED_REF_ID,
      http_status: 410,
      sunset: APPLY_RETIRED_SUNSET,
      reason: APPLY_RETIRED_REASON,   // 'APPLY_RETIRED'
    },
  ));
});
```

展开后的 JSON 体（逐键）：
```json
{"error":{"code":"LEDGER_REF_NOT_FOUND",
           "message":"endpoint deprecated: /api/job/:jobId/apply",
           "i18n_key":"ledger.err.LEDGER_REF_NOT_FOUND",
           "details":{"ref_type":"endpoint",
                      "ref_id":"/api/job/:jobId/apply",
                      "http_status":410,
                      "sunset":"任务模型改造（`R-9-103`）sunset（未决 §7-1：过期日待 Kevin 定）",
                      "reason":"APPLY_RETIRED"}}}
```

### A3 · J3 雇主选定 —— `POST /api/job/:jobId/accept`（`index.ts:2387-2407`）
与上条**逐字同源**（同一 `ledgerErrorBody` 产出器），仅 `reason` / `ref_id` 换值：
- `reason` = **`ACCEPT_RETIRED`**；`ref_id = '/api/job/:jobId/accept'`；`message = "endpoint deprecated: /api/job/:jobId/accept"`；其余键与 apply 面逐键一致。

### 真 HTTP 读数（★ 来源：**前一个 S3 单的真 HTTP 读数，转录**；本单未复测，见 §(e)）

| 面 | 方法 / 路径 | 读数 |
|---|---|---|
| J2 报名（退役） | `POST /api/job/:jobId/apply` | **410** |
| J3 选定（退役） | `POST /api/job/:jobId/accept` | **410** |
| J4 提交通道（现役，`submitWork`；`POST /api/task-progress/:identifier/submit` ∧ 别名 `POST /api/job/:jobId/submit`） | `POST …/submit` | **200** |

## (b) `index.ts` `getTaskProgress` 改参逐字 diff（`index.ts:1993-2013`）

```diff
     if (!result.ok) return sendVerbError(res, result);
 
     // 成功面：仍由 `getTaskProgress`（9 键）产出；approve 分支再补 `task`/`user`（与改接前逐键一致）
-    const record = await DatabaseService.getTaskProgress(Number(result.applicationId));
+    // ★ S3 修（`R-9-100/101`）：`getTaskProgress` 读口**已换轴 = `submission_id`**（`database.ts:2586`
+    //   `s.submission_id AS "jID"`）⇒ 成功面**不得**再用申请号 `result.applicationId`（旧轴 ⇒ 会读到别的行 / miss）。
+    //   改传**提交号**：与解析/结算**同源**的 URL 参数 `:jID`（`R-9-100` 起读口 identifier = `submission_id`；
+    //   后台待审队列 `listPendingVerification` 与前端契约同步换轴随 S4 / S3b）。
+    const submissionId = Number(req.params.jID);
+    const record = await DatabaseService.getTaskProgress(submissionId);
     if (!record) {
       return sendVerbError(res, {
         ok: false,
         status: 404,
         code: 'LEDGER_REF_NOT_FOUND',
         message: 'Referenced object not found',
-        details: { ref_type: 'job_application', ref_id: String(result.applicationId) },
+        details: { ref_type: 'job_submission', ref_id: String(submissionId) },
       });
     }
```

读口侧同源（`database.ts:2582-2598`，本单未改，仅作轴依据）：
```sql
SELECT s.submission_id AS "jID", s.job_id AS "tID", s.worker_uid AS "uID", s.deliverable AS info_input, …
  FROM public.job_submission AS s
 WHERE s.submission_id = ${submissionId}
 LIMIT 1
```
⇒ 读口的 identifier 轴 = **`job_submission.submission_id`**，与 URL 参数 `:jID` 同源；旧代码把**申请号**（`job_application.application_id`）灌进去 = **轴错位**。

## (c) 轴错位实证（真库只读对照读数）

只读探针（`readQuery` + `DatabaseService.getTaskProgress`，未写库 / 未起服务）：

- **新轴** `getTaskProgress(1)`（= `WHERE submission_id = 1`）⇒
  `{"jID":1,"tID":3,"uID":970002,"info_input":"cli:p4b2:deliverable:J3A","time_created":1790689357,"time_submitted":1790689357,"time_checked":1790948887,"time_claimed":0,"points_claimed":0}`
  ⇒ **`submission_id=1` 指向 `job_id=3`**。
- **「以申请号 1 调」对照** —— `job_application.application_id = 1` ⇒
  `{"application_id":"1","job_id":"2","worker_uid":"970002","status":"applied","create_key":"cli:p4b2:app:A2"}`
  ⇒ **申请号 1 指向 `job_id=2`**。

**同一个数字 `1`，两轴落点不同：`job_id 3`（提交轴）vs `job_id 2`（申请轴）** ⇒ 旧代码把申请号灌进提交轴读口，
会读到**别的 job 的进度** / 落到 `null`（对照：`getTaskProgress(2)` ⇒ `null`，库中无 `submission_id=2`）。
且两轴编号本就非恒等、更不同步：`job_submission` 14 行（`submission_id` ∈ {1,5,7,8,9,…}）、
`job_application` 19 行（`application_id` ∈ {1,4,5,6,7,…}）均**稀疏不连续** ⇒ 逐号恒等映射不成立，必须换轴传值。

## (d) K9 前推前后对比

判据文案 / 值（`p8-s11-audit-console-gate.ts`）：

| | 前（前单遗留） | 后（本单） |
|---|---|---|
| 断言 | `Number(opsMemo[0].n) === 4` ❌ | `Number(opsMemo[0].n) === 5` ✅ |
| 文案 | 「历史 **4 行**（不回填 · `R-9-76`）」 | 「历史 **5 行**（不回填 · `R-9-76`；含 2026-10-03 一次真实运营发放 `points_adjust`）」 |
| 实测 actual | `{"rows":5,"wired":true}` ⇒ 与 `===4` 相悖 ⇒ **红** | `{"rows":5,"wired":true}` ⇒ 与 `===5` 相符 ⇒ **绿** |

复跑整门读数（本机实测，产物 `backend-ts/.p8s11-artifacts/`）：

| 轮次 | 改动 | artifact | total / passed / failed | 红点 |
|---|---|---|---|---|
| **前** | K9 仍 `===4` | `p8s11-20261003T142813Z` | 87 / **85** / **2** | K9（4≠5）、K10（无实例） |
| **后** | K9 = `===5` | `p8s11-20261003T142839Z` | 87 / **86** / **1** | 仅 K10（无实例） |

- K8（前单已前推）：`{"points_adjust":5,"none":0}` ⇒ **绿**（前后两轮皆绿）。
- K9：前 **红**（`Number(5)===4`）⇒ 本单改 `===5` 后 **绿**。
- 历史对照：前一单 `p8s11-20261003T142415Z` 曾 K8 绿 / K9 红 / K10 **真绿**（当时实例在线，读数 `{"no_tok":401,"ok_page":200,"app_config":400,"cfg_reason":"AUDIT_TABLE_NOT_FOUND","inapplicable":400,"supported":["from","to","refId"],"over":400,"nope":400,"err":null}`）。
- **未放宽 / 未删任何判据**：K9 只前移阈值 4→5（与真库真实发放一致），未动其余 86 条判据任何一字。

> 结论：本单把该门从 **85/87（K9+K10 红）** 拉到 **86/87（仅 K10 红）**；K10 红**纯因无在线实例**（非判据放宽）——
> 若按前单在线时点（`142415Z`）实测口径，K10 绿 ⇒ 该门即 **87/87 exit 0**。本单因硬口径禁起服务，未复现该时点。

## (e) 未测项与原因

1. **K10 受控实例真 HTTP 腿 —— 本单未测（红）**。
   原因：默认 `P8S11_BASE=127.0.0.1:5797`，本机 `lsof` 无监听、`curl` 返回 `000` ⇒ 门内 `fetch failed`；
   硬口径③「**不得起服务 / 占端口**（不得占 5793–5799，不得启停 5787/5788）」⇒ **不为其单独起实例**。
   历史读数见 §(d)（`142415Z`，实例在线时 K10 真绿，401/200/400 齐备）。
2. **`410` / 提交口 `200` 的真 HTTP 读数 —— 本单未复测**。
   原因同上（无在线实例不得起服务）。§(a) 读数 = **转录前一个 S3 单真 HTTP 读数**，已注明来源；不做二次验证。
3. **`8000` 端口 / 其它实例**：本单全程未起、未占、未启停任何服务端口（仅只读探针连真库 + 门脚本自身各连库 6 次，**未打受控实例** ⇒ `http_calls=0`）。

## 附：本单产物与边界
- 改动文件：`backend-ts/scripts/p8-s11-audit-console-gate.ts`（K9 阈值 + 文案，2 行）、本报告。
- 跑门产物（自动，非手改）：`backend-ts/.p8s11-artifacts/p8s11-20261003T142813Z/`（前）、`p8s11-20261003T142839Z/`（后）。
- **未** commit / push；**未** `npm install`；连库仅从主仓 `.env.local` 加载（未复制 / 未回显）；原始输出未落 `.log`。
