# P6-B5-CLAIM · `POST /api/task-progress/claim/:jID` 退役为 **410**（Unit B5-CLAIM）

## 0 一句话 / 裁定依据
- 批 5 = **sunset**：旧模型（管理员后台发 task/reward）已废弃 ⇒ 该领取口**退役**（`410 Gone`）。
- 奖励/积分发放的**唯一路径** = A1 管理员调分（已接账本 `mint`/`burn`）⇒ **无功能缺口**。
- 本单消除本仓**今日唯一可达的「撞缺表」面**：旧实现体经 `DatabaseService` 读 `asset`(`index.ts:716`/`:727`) 与 `task_progress`(`:726`)，
  而迁移面**从未建过**这两张表 ⇒ 恒 `42P01` ⇒ 被吞成 `500`(`:740`)。

## 1 改动清单（仅动授权面；`git status --porcelain` 读数）
| 文件 | 改动 |
|---|---|
| `backend-ts/src/index.ts` | 该 handler **整段重写**为 410（旧实现体整段删除，非死代码）＋ 3 个常量 `CLAIM_RETIRED_REASON/REF_ID/SUNSET` |
| `backend-ts/scripts/p4z-tr1a-01-offline-tests.ts` | 仅**增**断言：新增 N 组 5 条（`N1`–`N5`） |
| `backend-ts/scripts/p4z-b5claim-01-http.ts` | **新增**：真实 HTTP 实测（6 断言，含与既有 410 面逐键比对） |
| `frontend/src/components/ClaimRewardModal.jsx` | 删该端点调用 + 删「领取奖励」按钮，就地显示 `claimRetiredNotice`；顺带删仅服务该调用的 `celebrate` 动效与 `useNavigate/useLocation` |
| `frontend/src/pages/RewardPage.jsx` | 删该端点调用 + 删「领取奖励」UI 分支（就地显示 `claimRetiredNotice`）；删随之失效的 `claiming`/`canClaim`/`handleTaskProgressClaim` |
| `frontend/src/locales/{zh,en,vn,hk}.json` | 各**增 1 键** `claimRetiredNotice`（四语齐备，键集逐文件相同） |
| `docs/audit/p6-b5-claim-retire.md` | 本报告 |

### 1.1 handler 现文（源码级，零表访问）
```ts
const CLAIM_RETIRED_REASON = 'CLAIM_RETIRED';
const CLAIM_RETIRED_REF_ID = '/api/task-progress/claim/:jID';
const CLAIM_RETIRED_SUNSET = '批 5 sunset（未决 §7-1：过期日待 Kevin 定）';

app.post('/api/task-progress/claim/:jID', (_req, res) => {
  return res.status(410).json(ledgerErrorBody(
    'LEDGER_REF_NOT_FOUND',
    `endpoint deprecated: ${CLAIM_RETIRED_REF_ID}`,
    { ref_type: 'endpoint', ref_id: CLAIM_RETIRED_REF_ID, http_status: 410,
      sunset: CLAIM_RETIRED_SUNSET, reason: CLAIM_RETIRED_REASON },
  ));
});
```
- **零表访问**口径：从路由注册行截到下一个顶层 `app.<verb>(`，`grep -c -E 'DatabaseService|task_progress|asset'` ⇒ **0**。
- **撤 `requireActor` 前置**（同 B2a/B2b 先例）：弃用面不得把「已下线」伪装成「未授权」；本面零副作用 ⇒ 无令牌下亦可观测 410。
  实测判别：重启**前**该面为 `401`，重启**后**为 `410`。

## 2 验收读数（逐条，均本批自跑）
| # | 项 | 命令 / 口径 | 读数 | 判定 |
|---|---|---|---|---|
| ① | `tsc` | `npx tsc --noEmit > file 2>&1; echo $?` ＋ `wc -l < file`（退出码**不取自管道之后**） | exit **0**；**0 行**（改前 0 / 改后 0） | ✅ |
| ② | 离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | `SUMMARY total=126 passed=126 failed=0`；exit **0**（基线 121 ⇒ 新增 5 条） | ✅ ≥121 |
| ③ | 410 + 机读 reason | 离线 `N1`–`N5`（源码级）＋ `scripts/p4z-b5claim-01-http.ts`（真实 HTTP） | 离线 5/5 绿；HTTP `SUMMARY total=6 passed=6 failed=0` | ✅ |
| ④ | 注册点（现取） | `grep -c "app\.\(get\|post\|put\|patch\|delete\|all\)(" src/index.ts` | 改前 **67** / 改后 **67** | ✅ 不减少 |
| ⑤ | 重启 + 真实 HTTP | 面板 `POST :5555/api/restart {"sid":"seafood-api"}` ⇒ `{"ok":true,"pid":46042}`；轮询至该面 `410`（第 1 秒即到） | 见 §3 | ✅ |
| ⑥ | `Δledger_entry` | `npx ts-node --transpile-only scripts/p4z-p6vs-ledger-count.ts`（口径＝全表行数，只读） | T0 `267` @11:35:17Z（改码后/重启前）→ T1 `267` @11:35:31Z（重启＋两次 HTTP 实测后）⇒ **Δ0** | ✅ |
| ⑦ | 前端单测 | `cd frontend && npm run test:unit` | `Test Files 13 passed`；`Tests 126 passed`；exit 0 | ✅ ≥126 |

> 判负自证：`grep -rn 'claim' frontend/src | grep -E 'fetch\(|fetchApiJson\('` ⇒ **0**（该端点前端**零调用**；仅剩 2 处**注释**提及）；
> 残留标识符 `grep -c 'claiming|handleTaskProgressClaim' RewardPage.jsx` ⇒ **0**。

## 3 真实 HTTP 实测（重启后；两次请求 = 不带上下文 / 带上下文）
```
POST /api/task-progress/claim/1   (无 Authorization)
{"error":{"code":"LEDGER_REF_NOT_FOUND","message":"endpoint deprecated: /api/task-progress/claim/:jID",
 "i18n_key":"ledger.err.LEDGER_REF_NOT_FOUND","details":{"ref_type":"endpoint",
 "ref_id":"/api/task-progress/claim/:jID","http_status":410,
 "sunset":"批 5 sunset（未决 §7-1：过期日待 Kevin 定）","reason":"CLAIM_RETIRED"}}}
HTTP 410

POST /api/task-progress/claim/1   (Authorization: Bearer <probe-token>)
<与上**逐字节相同**>            HTTP 410
```
产物：`backend-ts/.p4-artifacts/p6b5claim-http-20261001T113529Z/http.json`（含两次响应体 + 参照面 + 6 条断言）。

## 4 「形状与既有 410 面一致」的证据与**唯一一处刻意的键差**
参照面（既有 410 面之一，同一会话实测）`POST /api/admin/task/create`：
```
{"error":{"code":"LEDGER_REF_NOT_FOUND","message":"endpoint deprecated: /api/admin/task/create",
 "i18n_key":"ledger.err.LEDGER_REF_NOT_FOUND","details":{"ref_type":"endpoint",
 "ref_id":"/api/admin/task/create","http_status":410,"sunset":"批 4 删路径（未决 §7-1：过期日待 Kevin 定）"}}}
```
- **一致**：信封键集 `code,message,i18n_key,details`；`code` / `i18n_key`；`details.ref_type/http_status`；同一共享产出器 `ledgerErrorBody`（R107）。
- **差异（1 键）**：claim 的 `details` 多 `reason:"CLAIM_RETIRED"` —— 这是本单明确要求的**机读 reason**（S6 惯例，见 `frontend/src/test/unit/auth.test.js:107`「surfaces the R107 `details.reason`」）。
  若 Kong 裁定要**逐字节同形**（不放 `reason`），撤回该键为 **1 行**（`job-service.ts` 不在本单授权面，故未改 `sendGone` 签名）。

## 5 红线自证（逐条）
- 未 `git add/commit/push`（仅只读 `git status --porcelain`）；未 `vercel`；未 `npm install`；**无 DDL**；未 `pkill`/`killall`。
- 未读取/打印任何密钥或 `.env*` 值（DB 计数脚本自报 `read_url_source: DATABASE_URL`，不回显 URL）。
- 写面仅限授权的 7 个文件 + `.p4-artifacts/p6b5claim-*/**`；退出码均直接取自被考察命令；本机无 `timeout`，未使用。
- 旧进程假红：本轮**改码 → 重启（`pid:46042`）→ 再实测**；重启判据 = 该面 `401 → 410`。

## 6 自曝 / 未决
1. `details.reason` 造成与既有 410 面 details 键集**1 键差**（§4）——刻意的，为本单「机读 reason」要求；可 1 行回退。
2. 前端处置 = **删调用 + 删 UI 分支**（同 `shard/redeem` / `chest` 先例）；因此 `ClaimRewardModal` 的成功动效 `celebrate` 一并删除（原仅服务该调用）。
3. 该面**唯一**历史语义（领取已核验任务的积分）在 `cid` 模型下由 A1 管理员调分承接 ⇒ 前端**无替代入口**（不新造）。
4. 未决 §7-1：过期日待 Kevin 定（`sunset` 文案沿用既有风格，仅把「批 N」改为「批 5 sunset」）。
5. 未跑 live 库写入型验证（本单无写入路径，且 `Δledger_entry=0` 即为其自证）。
