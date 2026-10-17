# 对账定时化（方案 A）· `GET /api/ops/recon/ledger`

- 仓：`/Users/kevin/bistro/seafood`（分支 `main`，开工基线 `0537ea8`）
- 性质：**只读对账定时化**。三条检查全部单语句 `SELECT`；**零迁移、零新表、零新列、零写库、零数据模型改动、零字段级加密、零前端改动、零新 i18n 键**。
- 口径真源：`ops/bttc-recon-cadence/REPORT.md` §3.1/§3.2/§3.3（SQL 原文，未自创算式）+ `docs/audit/p9-s4-bttc.md` 的 KI2（burn 存负 `delta` ⇒ 守恒式是 `Σmint **+** Σburn`）+ `docs/OPEN-ITEMS.md` B25（cid=1 的 `2,000,000` 已登记差额）。
- 取证时间：**2026-10-17 02:51–03:00Z（10:51–11:00 CST）**
- 证据目录：本目录（`readings/` + `logs/` + `probe/`）

---

## 0. 结论先行

| 项 | 结果 |
|---|---|
| 新端点 | `GET /api/ops/recon/ledger`（**只注册 GET**，与 Vercel cron 的调用形态一致） |
| 鉴权 | 逐行照搬 `translateBackfillHandler`：`CRON_SECRET` 未配 ⇒ **503**；`Authorization: Bearer` 或 `x-cron-secret` 不匹配 ⇒ **401**；密钥只做等值比较，**不回显、不进日志**（探针有专门断言） |
| 回执 | 既有 `sendSuccess`：`{ success, message, data:{ ok, checks[3], checked_at, duration_ms } }`；`ok=false` 时额外 `console.error('[recon] …')` 一条 |
| cron | `vercel.json` 追加第二条日级：`{"path":"/api/ops/recon/ledger","schedule":"30 18 * * *"}`（既有 `0 18 * * *` 一字未改） |
| 门常量 | `p7b-03` 的 AC10-2 **106 → 107**（逐 verb：get 46→47、post 56、put 0、delete 3、patch 1）⇒ **37/37 全绿** |
| `tsc --noEmit` | **exit 0** |
| 行为探针 | **15/15 断言 true**（503/401×3/200×2/FAIL×4/404×2/无密钥回显），退出码 0 |
| 反向灵敏度 | 桩侧 4 臂 + 真库侧 1 臂（dev）全部把 `ok` 翻成 false |
| 新错误码 | **0 个**（只用既有 503 / `AUTH_UNAUTHORIZED` / `LEDGER_REF_NOT_FOUND` / §14 分类器） |

---

## 1. 改动面（4 个仓内文件 + 本证据目录）

| # | 文件 | 动作 | 规模 |
|---|---|---|---|
| 1 | `backend-ts/src/ops-recon.ts` | **新建**：三条只读 SQL + 基线常量表 + 判定 + `runLedgerRecon()` | +221 行 |
| 2 | `backend-ts/src/index.ts` | `import { runLedgerRecon }` + `opsReconHandler` + `app.get('/api/ops/recon/ledger', …)` | +45 行 |
| 3 | `vercel.json` | `crons` **+1 条**（既有那条一字未动，其它字段未碰） | +4 行 |
| 4 | `backend-ts/scripts/p7b-03-offline-gates.ts` | AC10-2 常量 106→107 + 派生注释链追加 1 条本单出处（**判据形态一字未改**） | 6 行（4 增 2 改） |

`git diff --stat`：`3 files changed, 53 insertions(+), 2 deletions(-)`（第 1 个文件是新建，不在 diffstat 里）。

**明确没动的**：迁移目录、任何 `INSERT/UPDATE/DELETE`、`ledger_post_event`、`frontend/`、`frontend/src/locales/**`、`docs/seafood.master-plan.md`（本单未要求落账）、既有 `translate/backfill` 路由与它的 cron。

---

## 2. 三条对账 SQL（原文 · 与报告 §3 逐字一致）

符号约定（先读）：`ledger_entry` 里 burn 分录存的是**负** `delta` ⇒ `total_supply == Σmint + Σburn`，**不是** `Σmint − Σburn`（`docs/audit/p9-s4-bttc.md` KI2 勘误；现役门 `p8-s9-bttc-gate.ts` 同式）。

### ① 供应量 vs 账本（逐 cid）

```sql
SELECT c.cid, c.symbol, c.total_supply,
       COALESCE(l.sum_mint,0)                       AS sum_mint,
       COALESCE(l.sum_burn,0)                       AS sum_burn,
       COALESCE(l.sum_mint,0)+COALESCE(l.sum_burn,0) AS ledger_derived,
       c.total_supply - (COALESCE(l.sum_mint,0)+COALESCE(l.sum_burn,0)) AS diff
  FROM public.currency c
  LEFT JOIN (SELECT cid,
                    SUM(delta) FILTER (WHERE kind='mint') AS sum_mint,
                    SUM(delta) FILTER (WHERE kind='burn') AS sum_burn
               FROM public.ledger_entry GROUP BY cid) l ON l.cid = c.cid
 ORDER BY c.cid;
```

判定：**逐 cid `diff === 基线常量`**（在 TS 侧用 `BigInt` 严格比较，`pg` 的 `numeric` 回来是字符串；带小数残差即判 FAIL，不静默取整）。
- 只对**在场** cid 判 —— 不写 `WHERE symbol='BTTC'`：BTTC 币种行由首次 mint 惰性创建（今天 0 行、明天 1 行会变成「有行才检查」的假绿）。

### ② `account.balance/frozen` vs `Σ ledger_entry.delta/frozen_delta`（逐户）⇒ 期望 **0 行**

```sql
SELECT a.uid, a.cid, a.balance, COALESCE(s.d,0) AS sum_delta,
       a.balance - COALESCE(s.d,0) AS diff_balance,
       a.frozen, COALESCE(s.f,0) AS sum_frozen_delta,
       a.frozen  - COALESCE(s.f,0) AS diff_frozen
  FROM public.account a
  LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f
               FROM public.ledger_entry GROUP BY uid, cid) s
         ON s.uid = a.uid AND s.cid = a.cid
 WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)
 ORDER BY a.uid, a.cid;
```

### ③ `batt_account.batt` vs `Σ batt_entry.delta`（逐户）⇒ 期望 **0 行**

```sql
SELECT b.uid, b.batt, COALESCE(e.d,0) AS sum_delta, b.batt - COALESCE(e.d,0) AS diff
  FROM public.batt_account b
  LEFT JOIN (SELECT uid, SUM(delta) AS d FROM public.batt_entry GROUP BY uid) e ON e.uid = b.uid
 WHERE b.batt <> COALESCE(e.d,0)
 ORDER BY b.uid;
```

判据分层（`docs/OPEN-ITEMS.md` B25 的既有纪律，**别混成一个阈值**）：②③ 是严格 0 行闸；① 是按**已登记基线**对拍。

---

## 3. 基线常量（显式表 · **不是**容差、**不是**不等式）

```ts
export const KNOWN_SUPPLY_OFFSET: Readonly<Record<string, string>> = Object.freeze({
  '1':  '2000000',
  '21': '1',
});
// 未登记 cid ⇒ '0'（默认严格相等，绝不因「新币种」而放宽）
```

| cid | 基线 | 来源 |
|---|---|---|
| 1（`$`） | `2000000` | `docs/OPEN-ITEMS.md` B25 逐字登记的已知差额（未搬的纯夹具 mint/burn 净额，几乎全为 `970001` 的 `mint 2,000,000`）；生产现取 `diff` 与它**逐位相同**（`ops/bttc-recon-cadence/readings/recon-prod-2026-10-17T021208235Z.json`：`total_supply 2010200 · Σmint 210274 · Σburn −200074 · diff 2000000`） |
| 21 | `1` | 本单登记的基线值（Kevin 派单指定） |
| 其它 | `0` | 默认 |

判据形态 = `diff <> 基线 ⇒ 该 cid FAIL`，**没有容差、没有 `>=`、没有区间**。改法（写死在 `ops-recon.ts` 注释与本报告 §9.1）：先复核读数 → 良性则改本表 + `OPEN-ITEMS` 留痕（旧值/新值/原因/日期）；**禁止**放宽阈值 / 加 try-catch 吞掉 / FAIL→SKIP。

---

## 4. 鉴权与回执（体例逐行对齐 `translateBackfillHandler`）

```
const secret = String(process.env.CRON_SECRET || '').trim();
if (!secret) return sendError(res, 503, 'CRON_SECRET not configured');   // fail-closed
bearer = authorization 以 'bearer ' 开头时取尾段（trim）
headerSecret = x-cron-secret（trim）
if (bearer !== secret && headerSecret !== secret) return sendAuthError(res, 401);
try { sendSuccess(res, await runLedgerRecon(), …) }
catch (e) { sendInfraMapped(res, 'ops.recon.ledger', e) }                 // 既有 §14 分类器 ⇒ 503
```

回执（机读）：`data = { ok, checks: [{ id, status:'PASS'|'FAIL', rows, diff?, sample? }], checked_at, duration_ms }`
- `id` 闭集三项：`supply_vs_ledger` / `account_vs_ledger` / `batt_account_vs_batt_entry`
- `ok=false` ⇒ 额外 `console.error('[recon] ledger drift detected', { checked_at, duration_ms, failed:[{id,rows,diff}] })`（只含 id/行数/差额，**不含 SQL 参数与密钥**）
- 注意：drift **不改 HTTP 状态码**（恒 200），因为本单派单明确「零新错误码、只用 503/401 既有形态」 ⇒ **cron 面板不会因 drift 变红**，告警唯一入口是回执 + 日志（见 §9.2）。

---

## 5. 上线后新增的每日行为（**别把 Hobby 当准点**）

| 项 | 值 |
|---|---|
| 频率 | **1 次/日**（Hobby：每条 cron 每天至多 1 次） |
| 计划时刻 | `30 18 * * *` = **UTC 18:30 = 次日 02:30 CST**；与既有 translate backfill（`0 18 * * *` = 02:00 CST）**错开 30 分钟** |
| 实际触发 | **落在指定小时窗口内任意时刻（±59 min ⇒ 01:31–03:29 CST）**，**不保证准点，也不保证与 backfill 的先后顺序**；两条的窗口本身是重叠的（30 分钟间隔 < 1 小时窗口） |
| 函数时长上限 | 300 s（现页口径）；本任务实测 **0.55 s**（dev 三条合计，`readings/recon-real-dev.json`）⇒ 余量 ≈ 500× |
| 费用 | 3 条 SELECT / 日；生产报告实测单条 162–163 ms（271 行 `ledger_entry`）⇒ 可忽略 |
| 副作用 | **零**（纯只读、天然幂等，重入/连跑/手动触发均无写） |
| cron 条数占用 | Hobby 现页口径 100 条/项目 ⇒ 本仓用 2 条（**旧册记的「上限 2」已作废**，见 `docs/OPEN-ITEMS.md` / 台账 v0.241 的留痕） |

★ **回执与报告里不得声称「每天 02:30 准时跑」** —— 正确表述是「每日 1 次，落在 UTC 18:30 所在小时窗口内（CST 01:31–03:29）」。任何「准点」「定时 02:30」的措辞都是错的（Hobby 非准点；窗口由平台决定，代码侧无从得知实际触发时刻）。

---

## 6. 验证读数（全部真跑 · 现场落盘）

| # | 门 | 跑法 | 结果 | 证据 |
|---|---|---|---|---|
| 1 | 类型 | `cd backend-ts && npx tsc --noEmit` | **exit 0**（`TSC_EXIT=0`） | `logs/tsc.log` |
| 2 | 离线门 | `cd backend-ts && npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts` | **exit 0 · 37/37 · red=[]**，`AC10-2 registration_points=107` | `logs/p7b-03-gate.log`、`readings/gate-p7b-03.json` |
| 3 | 注册点现取 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' …` | **107**（get 47 / post 56 / put 0 / delete 3 / patch 1） | `logs/counts.log` |
| 4 | 行为探针（桩 db） | 见 §6.1 | **15/15 断言 true**，exit 0 | `readings/probe-recon-auth.json`、`logs/probe-auth.log` |
| 5 | 真库只读读数（dev） | 见 §6.2 | SQL 真跑通；**dev 判 FAIL（预期，见 §7）** | `readings/recon-real-dev.json`、`logs/recon-real-read.log` |
| 6 | `vercel.json` 合法性 | `node -e "JSON.parse(...)"` | `vercel.json JSON OK` | `logs/counts.log` |

### 6.1 行为探针（进程内 stub `db.readQuery`，零写库 / 零网络 / 零生产连接）

跑法：`cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/probe/recon-probe.ts`

| 读数 | 场景 | 状态码 | 结论 |
|---|---|---|---|
| `A1_no_secret_configured` | `CRON_SECRET` 未配 | **503** | fail-closed，绝不放行 |
| `B1_no_header` | secret 已配、无头 | **401** `AUTH_UNAUTHORIZED` | — |
| `B2_wrong_bearer` | Bearer 错值 | **401** `AUTH_UNAUTHORIZED` | — |
| `B3_wrong_header_secret` | `x-cron-secret` 错值 | **401** `AUTH_UNAUTHORIZED` | 备用头同样受闸 |
| `C1_correct_bearer_clean` | Bearer 正确 + 干净夹具 | **200** `data.ok=true` | 三条检查齐（`supply_vs_ledger/account_vs_ledger/batt_account_vs_batt_entry` 全 PASS）；**桩真被调用 3 次**（= 三条 SQL 都执行了） |
| `C2_correct_header_secret_clean` | `x-cron-secret` 正确 | **200** | 备用头放行 |
| `S1_supply_drift_should_fail` | 差额 `2000000→2000001` | 200 | **`ok=false`**，`supply_vs_ledger=FAIL`，`diff=2000001` |
| `S2_baseline_table_enforced` | cid=21（基线 1）喂 `diff=0` | 200 | **`ok=false`** ⇒ 基线表真生效，不是空转 |
| `S3_account_drift_should_fail` | account 漂移 1 行 | 200 | **`ok=false`**，`account_vs_ledger=FAIL` |
| `S4_batt_drift_should_fail` | batt 漂移 1 行 | 200 | **`ok=false`**，`batt_account_vs_batt_entry=FAIL` |
| `E1_unregistered_path` | 错路径 | **404** `LEDGER_REF_NOT_FOUND` | 200 是「进 handler」而非兜底 |
| `E2_post_not_registered` | `POST` 同路径 | **404** | 本单只注册 GET（Vercel cron 发 GET） |

密钥面：`secret_source=env(.env.local)`、`secret_len=64`、**所有读数 `secret_echoed=false`**（对每次回执原文做「是否包含密钥字面」检查）；日志与读数文件里**没有任何密钥值**。

### 6.2 真库只读读数（dev · 证明 SQL 在真 schema 上成立）

`readings/recon-real-dev.json`：`identity = { project_id: quiet-math-65207667, branch_id: br-soft-lake-b3iv9tli, db: neondb }`（= **dev**，非生产）、`schema_top=0048`、`duration_ms=551`。

| 检查 | dev 读数 |
|---|---|
| ① `supply_vs_ledger` | **FAIL**（15 个 cid）；`cid=1 diff=0`（基线 2000000）、`cid=21 diff=0`（基线 1） |
| ② `account_vs_ledger` | **PASS**（0 行） |
| ③ `batt_account_vs_batt_entry` | **PASS**（0 行） |

⇒ 这一臂同时是**真数据上的反向灵敏度**：SQL 跑的是真表、真数据，判定确实会给出 FAIL，不是恒绿。FAIL 的成因见 §7（**基线是按生产登记的，dev 库不是同一份数据**）。

---

## 7. ★ 必须知道的一条：基线是「按生产登记」的 ⇒ **dev 库恒红，生产首日应全绿**

| cid | 生产现取（`sweet-pond-28934105`，02:12Z） | dev 现取（`quiet-math-65207667`，02:55Z） |
|---|---|---|
| 1（`$`） | `total_supply 2010200 · Σmint 210274 · Σburn −200074 · diff **2000000**` ⇒ 基线 2000000 ⇒ **PASS** | `total_supply 2010200 · Σmint 2210276 · Σburn −200076 · diff **0**` ⇒ 基线 2000000 ⇒ **FAIL** |
| 21 | **该 cid 不存在**（生产 `currency` 只有 1 行）⇒ 基线不生效（惰性创建前无行可判） | 存在，`diff 0` ⇒ 基线 1 ⇒ **FAIL** |
| 4/9/10/15/16/22/27/28/29/31/32/35/36 | 不存在 | `diff 0` ⇒ PASS |

结论与处置：
1. **cron 只在生产跑** ⇒ dev 红**不影响**上线后的日检；但**本地/dev 实例上调这个端点会恒返回 `ok=false`**，别据此立案成缺陷。
2. 生产首日预期：① PASS（diff = 2000000 = 基线）、②③ 0 行 PASS（02:12Z 实测 0/0）⇒ **`ok=true`**。
3. **上线后必须现取一次生产的 `currency` 行集**（`/api/ops/recon/ledger` 的第一次回执就有全量 `sample`）：
   - 若生产出现了**未登记的新 cid**，其 `diff≠0` 会立刻告警 —— 这**是设计意图**（新币种必须显式登记基线）；
   - 若某 cid 的 `diff` 与基线只差 1，说明真的漂了，按 §9.1 复核。
4. dev 与生产是**两个不同的 Neon 项目**（技能已登记），任何「dev 绿 ⇒ 生产绿」的推断都不成立。

---

## 8. `vercel.json`（legacy `builds` 形态 · 只追加 cron）

改后全文（**落盘于仓根 `vercel.json`**）：

```json
{
  "version": 2,
  "regions": ["sin1"],
  "builds": [
    { "src": "frontend/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } },
    { "src": "backend-ts/src/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "backend-ts/src/index.ts" },
    { "src": "/(.*\\..*)", "dest": "/frontend/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/frontend/index.html" }
  ],
  "crons": [
    { "path": "/api/translate/backfill", "schedule": "0 18 * * *" },
    { "path": "/api/ops/recon/ledger", "schedule": "30 18 * * *" }
  ]
}
```

（仓内文件是缩进展开形态；上面为等效压缩显示。**改后全文以仓根 `vercel.json` 为准**，JSON 校验通过。）

diff 摘要（`readings/config-and-gate.diff` 摘录）：

```diff
   "crons": [
     {
       "path": "/api/translate/backfill",
       "schedule": "0 18 * * *"
+    },
+    {
+      "path": "/api/ops/recon/ledger",
+      "schedule": "30 18 * * *"
     }
   ]
```

- **只追加**：`version` / `regions` / `builds` / `routes` / 既有 cron 一字未动（`git diff vercel.json` = 4 行纯新增，删除行 0）。
- ⚠ **唯一「上线才知道」项**：该文件是 legacy `builds` 形态，cron 能否正常注册**离线证明不了**。上线后现取：`vercel crons ls`（若 CLI scope 可用）或 dashboard 的 Cron Jobs 面板，确认**两条**都在册；次日再看函数日志里有没有 `[recon]` / 回执。

---

## 9. 未做的事（按派单要求显式登记）

### 9.1 人工核对流程（**没有做，属线下 SOP，不是代码缺口**）

代码只负责「把结论算出来 + 留下可检索的一条日志」。人这一侧的动作**本单未落地任何工具/页面**，建议的固定流程（供下一班照走，写在报告里而非代码里）：

1. 日志检索 `[recon] ledger drift detected` 或看回执 `data.ok=false`；
2. **先复核、不改阈值**：跑 `node ops/bttc-recon-cadence/readings/recon-readonly.cjs`（同一份 SQL、同一把尺子）确认是同一读数 —— 排除「尺子/取数路径写错」（本仓历史上「取数路径写错 ⇒ 判负恒真」踩过）；
3. 分类：**良性**（新夹具/搬数/一次性订正）⇒ 改 `KNOWN_SUPPLY_OFFSET` + `docs/OPEN-ITEMS.md` 留痕（旧值/新值/原因/日期）；**真漂移** ⇒ 走 B25 三道（① 一次性订正计数器 ② 根因修复：负向调分改走 `op='burn'` ③ 加守卫）；
4. **禁止**：放宽容差、把 `>` 改 `>=`、try-catch 吞掉、FAIL 改 SKIP。

⚠ 本单**没有**建「结果落库 / 历史曲线 / 站内页面」—— 那需要写库口（新表或 `app_config`/`audit_log`）与四语键，与「最小改动」正相反（见评估报告 §5.1、§4）。

### 9.2 告警升级路径（**未做 · 下一版**）

- 现役告警 = **只有两层**：结构化回执（`ok=false`）+ `console.error('[recon] …')` 一条（Vercel 函数日志可按 `[recon]` 检索）。
- **刻意没接 Telegram**，理由（现取，不是推断）：`backend-ts/src/telegram-service.ts:238` 的 `sendTelegramReply(chatId, text)` 确实可直调、且 token 缺失时**自己 `console.warn` 后 return**（不引入新失败面）；但「**发给谁**」这一环要么新增 env（管理员 `tg_user_id`），要么按管理员语义查 `users.tg_user_id` —— 两者都属**新配置 / 新语义**，派单明确「做不成就在报告里写下一版，不要为此扩面」。⇒ 下一版若要做，最小形态 = 一个 env（管理员 chat_id）+ 3 行调用，且必须先裁定「谁收」。
- 另一个免费的升级杠杆（无需代码）：**drift 时改回 `500`** —— Vercel cron 面板会变红、套餐级失败通知才生效。本单按派单「零新错误码 / 只用 503·401」**没有**这么做；若 Kevin 要「面板红」这条信号，需另行裁一次状态码口径。
- **回执里不得声称准时**（重申）：没有「02:30 准点」这回事，只有「UTC 18:30 所在小时窗口内 1 次」。

### 9.3 其它明确不做

- 不改 `translate/backfill` 的既有 cron（已由 `0537ea8` 单独修好 GET）；
- 不把「事件级配对不变式 `Σ(delta+frozen_delta)=0`」加进日检（生产现取 **28 个非零根键** ⇒ 上线即天天告警，须先落白名单基线，另立单）；
- 不做 Δ 对账（需要「昨天那一份」= 又一次写库）；
- 不碰字段级加密（评估报告 §6.1 已裁定理由）；
- 不动 `docs/seafood.master-plan.md` 台账（本单未要求，且规范/台账与实现分角色）。

---

## 10. 回滚

单 commit、四文件、零迁移 ⇒ 回滚 = `git revert <commit>` + push（不依赖 Vercel CLI；CLI scope 在并行会话里被改过，技能已登记）。回滚影响面：端点 404、cron 目标消失；**无数据面影响**（从未写库）。

---

## 附录 A · 证据清单（可复核）

| 文件 | 内容 |
|---|---|
| `readings/probe-recon-auth.json` | 12 条行为读数 + 15 条断言 + `all_assertions_pass:true` |
| `readings/recon-real-dev.json` | dev 真库三条对账读数（identity / schema_top / report 明细含 sample） |
| `readings/gate-p7b-03.json` | 离线门 artifact（`summary {total:37, passed:37, failed:0, red:[]}`，AC10-2 `registration_points=107`） |
| `readings/config-and-gate.diff` | `vercel.json` + 门脚本的 `git diff` 原文 |
| `probe/recon-probe.ts` | 桩式行为探针（可重跑） |
| `probe/recon-real-read.ts` | 真库只读读数探针（可重跑） |
| `logs/tsc.log` | `npx tsc --noEmit` 输出（空输出 + `TSC_EXIT=0`） |
| `logs/p7b-03-gate.log` | 门套完整输出（含 ac13 cases / ac14 classifier） |
| `logs/probe-auth.log` | 探针逐条 JSON + 结论行 |
| `logs/recon-real-read.log` | 真库读数结论行 |
| `logs/counts.log` | 注册点逐 verb 现取 + `vercel.json` JSON 校验 |

## 附录 B · 复跑命令

```bash
cd /Users/kevin/bistro/seafood/backend-ts
npx tsc --noEmit                                                        # exit 0
npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts              # 37/37, AC10-2 = 107
TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/probe/recon-probe.ts      # 15/15 断言
TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/probe/recon-real-read.ts  # dev 真库只读

cd ..
echo "total=$(grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts)"   # 107
for v in get post put delete patch; do echo "$v=$(grep -cE "^app\.$v\(" backend-ts/src/index.ts)"; done
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('vercel.json JSON OK')"
```

★ 探针必须带 `TS_NODE_PROJECT=$PWD/tsconfig.json`（同 `ops/cron-get-fix` 的既有体例）：不带时 ts-node 从探针所在目录向上找配置，会撞 `TS5109 moduleResolution must be NodeNext`。
