# P6-TR-1c-FIX-CRON · `/api/translate/backfill` 补注册 GET（Vercel cron 实际发 GET）

- 仓：`/Users/kevin/bistro/seafood`（分支 `main`）
- 基线：`e1283da`（工作区改动前已现取 `git log --oneline -3` + `git status --porcelain`；同期另有会话落了 `3424fd4` **纯 docs**，未触 `src/`）
- 范围：**只修注册面**。零迁移、零新错误码、零新权限键、未改 `vercel.json`。

## 1. 缺陷（修前实取）

| 事实 | 现取读数 |
| --- | --- |
| `vercel.json` 唯一日级 cron 目标 | `crons[0].path = /api/translate/backfill`，`schedule = "0 18 * * *"`（UTC 18:00 = 北京 02:00） |
| 修前该路径注册面 | 仅 `app.post('/api/translate/backfill', …)`（`backend-ts/src/index.ts:3133`）⇒ **零 `app.get`** |
| Vercel Cron 请求方法 | **GET**（平台按 cron 声明发 GET，并自带 Bearer 授权头，值取 env `CRON_SECRET`） |
| 修前 GET 落点 | 文件末 catch-all `app.use((req,res)=>sendRefNotFound(...'route_not_found'))` ⇒ `404 / LEDGER_REF_NOT_FOUND` |
| 结论 | 该日级任务**自上线以来从未进入 handler** ⇒ 日级存量扫描/回填实际从未跑过 |

探针基线（`git worktree` 导出 `e1283da`，只读，主工作区未动；跑完已 `git worktree remove`）：

```
prefix_HEAD_e1283da-A1_GET_no_secret_unset   GET  无密钥            → 404 LEDGER_REF_NOT_FOUND
prefix_HEAD_e1283da-B2_GET_wrong_bearer      GET  Bearer(错)       → 404 LEDGER_REF_NOT_FOUND
prefix_HEAD_e1283da-C1_GET_correct_bearer    GET  Bearer(正确)     → 404 LEDGER_REF_NOT_FOUND   ← 缺陷证据
prefix_HEAD_e1283da-D1_POST_correct_bearer   POST Bearer(正确)     → 200 data.ok=true mode=translate
prefix_HEAD_e1283da-D2_POST_wrong_none       POST 无密钥           → 401 AUTH_UNAUTHORIZED
```
⇒ 修前「同一密钥，POST 通、GET 404」，与「cron 发 GET 而只注册 POST」完全吻合。

## 2. 修法（最小，语义不改）

`backend-ts/src/index.ts`：

1. 原 `app.post('/api/translate/backfill', async (req,res)=>{…})` 的 handler **整体提为同名文件顶层常量**
   `const translateBackfillHandler: RequestHandler = async (req, res) => { … }`（函数体**一字未改**：
   503 fail-loud 闸、`Bearer`/`x-cron-secret` 相等比较 401 闸、`req.body ?? {}`、`req.query.limit/mode/scan`、
   `sendSuccess` 回执键面、`sendInfraMapped` 收口，全部原样）。
2. **同时注册两法**（同一 handler）：
   ```ts
   app.post('/api/translate/backfill', translateBackfillHandler);  // 人工/旧调用（p4z-tr1c-01/07、d1p-04 等脚本）
   app.get ('/api/translate/backfill', translateBackfillHandler);  // Vercel cron 入口（平台发 GET、无 body）
   ```
3. 注释写明「GET = Vercel cron 入口 / POST = 人工旧调用 / 同一 handler」。
4. `import express, { Request, RequestHandler, Response } from 'express'`（仅补类型导入）。
5. `vercel.json` **未改**（目标与 `0 18 * * *` 保持原样）。

`backend-ts/scripts/p7b-03-offline-gates.ts`（同批前推常红门，否则下轮被立案为回归）：

- `AC10-2` 常数 `105 → 106`，并同步派生注释链（逐 rev 出处续写 `→ 106 P6-TR-1c-FIX-CRON（GET +1）`）与逐 verb 分解
  `get 45→46 / post 56 / delete 3 / patch 1`。其余判据（AC10-1、AC10-3..7、AC13、AC14）**一字未动**。
- 口径（现取复算）：`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts`：改前 **105** → 改后 **106**。

## 3. 验证（全部真跑，读数见 `readings/`、原始输出见 `logs/`）

| # | 判据 | 命令 | 读数 |
| --- | --- | --- | --- |
| 1 | 类型 | `cd backend-ts && npx tsc --noEmit` | **exit 0**，stdout 0 字节（`logs/tsc-noemit.log`、`readings/tsc-noemit.json`） |
| 2 | 离线门 | `cd backend-ts && npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts` | **exit 0 · 37/37 全绿 · red=[]**，`AC10-2 registration_points=106`（`readings/gate-p7b-03.json`，artifact `p7b-03-offline-gates-20261017T023433Zojey.json`） |
| 3 | 行为探针 | `cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/cron-get-fix/probe/get-probe.ts` | 见下表（`readings/probe-fixed.json`、`logs/probe-fixed.log`） |

修后同探针（同脚本、同密钥，仅换代码）：

```
fixed-A1_GET_no_secret_unset   GET  无密钥（CRON_SECRET 置空）      → 503  message="CRON_SECRET not configured"
fixed-B1_GET_no_header         GET  secret 已配、无头                → 401  AUTH_UNAUTHORIZED
fixed-B2_GET_wrong_bearer      GET  Bearer(错)                       → 401  AUTH_UNAUTHORIZED
fixed-C1_GET_correct_bearer    GET  Bearer(正确·值不打印)            → 200  data.ok=true  data.mode=scan_translate
fixed-C2_GET_query_mode_scan   GET  ?mode=scan&limit=5 + x-cron-secret → 200  data.ok=true  data.mode=scan
fixed-D1_POST_correct_bearer   POST Bearer(正确) body{mode:translate}→ 200  data.ok=true  data.mode=translate   （旧面不回归）
fixed-D2_POST_wrong_none       POST 无密钥                           → 401  AUTH_UNAUTHORIZED                        （鉴权闸不变）
fixed-E1_GET_unregistered_path GET  /api/translate/backfill-not-a-route → 404 LEDGER_REF_NOT_FOUND                    （catch-all 对照面）
```

探针口径（**诚实标注**，见 `probe/get-probe.ts` 头注释）：

- 零真实翻译 API / 零写库：在**进程内**把 `src/translate-service` 的两个导出（`scanRegisterPending` / `backfillPending`）
  替换为恒零 stub（`require` 缓存内改导出；`index` 侧是 `ts_1.backfillPending(...)` 属性取值 ⇒ 生效），
  鉴权闸、body/query 参数解析、`mode` 三态、回执键面**全部走真码**。`svc_stub_calls=4`
  = C1（scan+backfill 2 次）+ C2（仅 scan 1 次）+ D1（仅 translate 1 次）⇒ 参数路由本身也被验证。
- `process.env.VERCEL=1` 抑制 `index.ts` 末尾的 `app.listen(PORT)`，探针自带 ephemeral 端口 `listen(0)`。
- `CRON_SECRET` 只从 `process.env`/`backend-ts/.env.local`（`src/env.ts` 首 import）读取，**输出仅状态码与键名**，
  值/长度外的一切均不落盘（`cron_secret_len=64` 仅作「已配」旁证）。

## 4. 上线后新增的每日行为与成本上限（供上线前告知）

- **新增每日行为**：北京时间每日 **02:00 前后**（Vercel Hobby 档非准点，平台会在该小时窗内调度）**真跑一次**
  `GET /api/translate/backfill`：先扫存量把缺失的 `pending` 行登记进翻译表，再翻译最多 **100 条**
  （默认 `limit=100`；`mode` 缺省即 `scan_translate`）。此前该任务**从未生效**，故这是新增的日级写库 + API 调用。
- **成本上限**：条目级硬闸 `TRANSLATE_DAILY_ITEM_CAP=500`（每天最多 500 条被翻译；本次默认只吃 100 条/次）＋
  单条字符闸 `TRANSLATE_MAX_CHARS_PER_ITEM=2000` ⇒ 最坏输入 ≤ **100 条 × 2000 字符 = 20 万字符/日**（默认档），
  上限档 ≤ 50 万字符/日。**缓存命中不重复付费**；扫描 `ON CONFLICT DO NOTHING` 幂等 ⇒ 连跑不增行、不重复计费。
- 鉴权：Vercel cron 自带 Bearer 授权头（值取 env `CRON_SECRET`）；**前提是 Vercel 项目已配 `CRON_SECRET`**，
  未配则每次 cron 收 `503 CRON_SECRET not configured`（fail-loud，不静默放行）——上线前请核对该项 env。

## 5. 未做 / 边界

- 未推 `push`（push = 上线，由 Zang 排期）。
- 未改 `vercel.json`、未 apply 迁移、未新增错误码/权限键；`POST` 语义与回执键面对既有脚本保持兼容。
- 未在真实生产库跑一次 cron（会真写 `pending` 行 + 真调 DeepSeek 付费）——本单只证「注册面 + 鉴权 + 参数路由」，
  首个真实跑由上线后首个 cron 自然触发，回执键面即本文 C1 形状。

## 6. 复现

```bash
cd backend-ts
npx tsc --noEmit
npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts
TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/cron-get-fix/probe/get-probe.ts
# 修前基线（只读 worktree）：
git worktree add --detach /tmp/sf-prefix e1283da && \
  ln -s "$PWD/node_modules" /tmp/sf-prefix/backend-ts/node_modules && \
  ln -s "$PWD/.env.local" /tmp/sf-prefix/backend-ts/.env.local && \
  PROBE_BACKEND_ROOT=/tmp/sf-prefix/backend-ts PROBE_LABEL=prefix_HEAD_e1283da \
  TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/cron-get-fix/probe/get-probe.ts
git worktree remove --force /tmp/sf-prefix
```
