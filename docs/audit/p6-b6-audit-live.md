# P6-B6-AUDIT · 线上实证报告（BE-AUDIT-LIVE / Kong）

- 日期：2026-10-02（UTC 02:02）· 单元：**BE-AUDIT-LIVE** · 角色：Kong
- 载体：`backend-ts/scripts/p4z-b6audit-live-01.ts`（真 HTTP，vantage = `http://127.0.0.1:5788`）
- 产物 artifact：`backend-ts/.p4-artifacts/p6b6audit-live/live-*.json`（两次运行各一份）
- 结论：**11/11 判据全绿，退出码 0（不取自管道之后）**；**资金净位移 = 0**；件①②③④⑤逐件有真读数；
  **真库 live 未触发日累计拒绝**（理由见 §6）。

---

## 0. 前置：单路重启（必须，先于一切）

| 项 | 读数 |
|---|---|
| 面板 `POST :5555/api/restart {"sid":"seafood-api"}` | HTTP **200**，body `{"sid":"seafood-api","ok":true,"state":"running","pid":65078,"msg":"已启动"}` |
| 重启前 5788 监听 PID | **63152** |
| 重启后 5788 监听 PID | **65096**（PID 变化 ⇒ 进程确为**新起的**，非旧内存） |
| `/health`（重启后） | HTTP **200**，`{"ok":true,"schema_version":"0023","db_version":"PostgreSQL 18.6 …"}` |

过程纪律：只用面板单路 restart；**未**用 `pkill`/`killall`；未起停其它 sid。
（本单共两次运行，每次运行开头都执行同一单路重启：run A 61958→63152，run B 63152→65096。）

只读库内前置：`admin_ops_audit_log` 在场 = true；`schema_migration` 行数 = **22**、链尾版本 = **0023**；
`result='rejected_daily_cap'` 既有行 = **0**；代码路径 `src/database.ts` 已改为
`SELECT … FROM (SELECT public.admin_points_adjust_post_event(${payload}::jsonb) AS r) AS t`（单语句新函数）；
`src/ledger.ts` 码表逐字 `LD016: 'LEDGER_AMOUNT_INVALID',`。

主体：真 admin = **uid 1**（库内 `is_admin=true`，`0x99a7…`）；非 admin = **uid 2**（`is_admin=false` 且无 `admin_user_role` 行）。
**token 由脚本用 `.env.local` 的 `SECRET_KEY` 现铸**（HS256，`sub/evm/exp`）；**本报告只报存在性：admin token=在场、non-admin token=在场，不打印任何 token 串。**

夹具（**新窗口**，历史已用 970001/970002/970101/970102/970201–970213）：
run A 目标 **uid 971100**、run B 目标 **uid 971213**（均在本单新建；非历史夹具复用）。

---

## 1. 件① 成功路径（真 admin · 极小额度 amount=1）

请求：`POST /api/admin/points/adjust`，body `{"uID":971213,"amount":1,"reason":"b6audit-live mint","idempotency_key":"ops:1:points_adjust:971213:1:live-mint-a"}`，`Authorization: Bearer <admin token>`。

- **HTTP 200**；回执体：
  `{"success":true,"message":"积分调整成功（铸币）","data":{"uID":971213,"cid":1,"op":"mint","amount":1,"new_points":1,"timestamp":1790906552,"reason":"b6audit-live mint","txid":"277"}}`
- 同一次调用两表各 +1：`ledger_entry` 269 → 270（本运行内 delta = 1）、`admin_ops_audit_log` 2 → 3（delta = 1）。

**只读行级证据 — 资金分录（`public.ledger_entry`，列名 + 值）**

| 列 | 值 |
|---|---|
| txid | **277**（与 HTTP 回执 `txid` 逐字相同） |
| uid / cid | 971213 / 1 |
| delta / balance_after | 1 / 1 |
| kind | **mint** |
| ref_type / ref_id | currency / 1（= `cid`，与 §4.10③ 既有口径一致） |
| idempotency_key | `ops:1:points_adjust:971213:1:live-mint-a` |
| request_fingerprint | `533f5b83a2a86da5f954de112287b60b09b027c75b3fbade4826e437397b7223` |
| memo / event_root_key | `b6audit-live mint` / 同 idem 键 |
| frozen_delta / reversal_of_txid | 0 / NULL |

**只读行级证据 — 审计行（`public.admin_ops_audit_log`，列名 + 值）**

| 列 | 值 |
|---|---|
| log_id | **5** |
| actor_uid（谁） | **1**（= 真 admin） |
| action | points_adjust |
| target_uid（对谁） | **971213**（= 夹具 uid） |
| cid / op | 1 / **mint** |
| amount（有符号） | **1** |
| balance_before → balance_after | **0 → 1**（= 事后 − amount 推导） |
| request_fingerprint | `533f5b83…7223`（与资金分录**同一指纹**） |
| idempotency_key | `ops:1:points_adjust:971213:1:live-mint-a` |
| result（结论位） | **applied** |
| txid | **277**（与资金分录 txid 逐字相同 ⇒ 审计与资金同一条语句） |
| time_created | 2026-10-02T02:02:32.13164+00:00 |

（run A 的同形证据：txid 275 / log_id 1，uid 971100，指纹 `eb610a56…54fd`。）

---

## 2. 件② 幂等重投（同键 + 同内容）

**三个读数**：

| 读数 | 值 |
|---|---|
| ① HTTP 回执 | **200**，body 顶层带 **`"idempotent_replay":true`**，`data.txid` = `"277"` |
| ② 两表行数 | `ledger_entry` 270 → **270**（delta **0**）、`admin_ops_audit_log` 3 → **3**（delta **0**） |
| ③ txid | 首投 `277` / 重投 `277` —— **逐字相同** |

---

## 3. 件③ 单次上限回归 + burn 支路（Σ 零净位移）

**③a `amount=100001`** ⇒ **HTTP 400**，body：

```json
{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"Request shape is invalid",
 "i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID",
 "details":{"field":"amount","reason":"OVER_MAX_SINGLE_AMOUNT","max":100000,"provided":100001}}}
```

即 **400 + LD016**（`src/ledger.ts` 码表逐字 `LD016: 'LEDGER_AMOUNT_INVALID'`）+ **`reason='OVER_MAX_SINGLE_AMOUNT'`**（既有行为未回归）；
且**零残留**：该请求期间 `ledger_entry` delta = **0**、`admin_ops_audit_log` delta = **0**（路由层前置拒，未触达 DB 编排函数）。

**③b `amount=-1`（burn 支路）** ⇒ **HTTP 200**，`{"success":true,"data":{"op":"burn","amount":-1,"new_points":0,"txid":"278"}}`。
只读证据：`ledger_entry` txid **278** / kind **burn** / delta **-1** / balance_after **0** / ref_type currency / ref_id 1；
审计行 log_id **6** / op **burn** / amount **-1** / balance_before→after **1 → 0** / result **applied** / txid **278**；
夹具账户余额 = **0** ⇒ 本对 mint(+1)/burn(−1) 使 Σ 归零。

---

## 4. 件④ 非 admin ⇒ 403 / 无 token ⇒ 401（零残留）

| 场景 | 判据 | 读数 |
|---|---|---|
| 非 admin（uid 2，无角色行） | 403 + 机读 reason | **403**，`{"error":{"code":"AUTH_FORBIDDEN",…,"details":{"reason":"NOT_ADMIN"}}}` |
| 无 token | 401 | **401**，`{"error":{"code":"AUTH_UNAUTHORIZED",…}}` |

**零残留（只读查询）**：两次调用区间内 `ledger_entry` delta = **0**、`admin_ops_audit_log` delta = **0**；
按这两个请求所用幂等键检索审计表：`count(*) WHERE idempotency_key IN ('…live-nonadm','…live-notok')` = **0**。
⇒ 鉴权面被拒时**不写任何审计行、不写任何资金分录**。

---

## 5. 件⑤① 日累计闸：阈值常量与求和判据（**只读逐字证据**）

`SELECT pg_get_functiondef('public.admin_points_adjust_post_event(jsonb)')` 摘录（逐字，未改写）：

```
v_daily_cap   CONSTANT bigint := 1000000;                       -- 阈值 = 服务端常量，客户端永不参与

SELECT COALESCE(sum(abs(a.amount)), 0)::bigint INTO v_used
  FROM public.admin_ops_audit_log AS a
 WHERE a.actor_uid  = v_actor
   AND a.result     = 'applied'                                 -- ★ 求和判据：只计成功行
   AND a.time_created >= v_day_start                            -- ★ 自然日（UTC）
   AND a.idempotency_key <> v_key;

IF v_used + abs(v_amount) > v_daily_cap THEN                    -- 闸条件
```

另：`no_raise_in_body = true`（函数体内**无 RAISE**，被拒尝试的留痕行不会被异常回滚）、
`reject_branch_marker = true`（`rejected_daily_cap` 分支在场）。

真库 live 只读读数：操作人 uid 1 当日 `Σ|amount| WHERE result='applied'` = **4**（= 本单 2 对 mint/burn 的 |1|+|-1| 合计）；
同口径「含拒绝行」= **4**（当前无一拒绝行）；`result='rejected_daily_cap'` 行数 = **0**；阈值常量 **1000000**。

---

## 6. 件⑤②③ 日累计拒绝的复现方式与「真库 live 未触发」声明

**★ 声明（逐字）：真库 live 未触发日累计拒绝。**
理由（红线②）：触发需操作人当日 `applied` 额度 ≥ 1,000,000 点；**为测试真造百万点会污染真账本**，
故**不做**。因此「route 层 400 + reason=OVER_MAX_DAILY_AMOUNT」这条 HTTPS 面**未在真库产生**（见 §8 NOT_MEASURED）。

替代取证（**事务内**：合成额度占用 → 直接调函数 → 读回执 → **ROLLBACK**）：

| 步骤 | 读数 |
|---|---|
| 事务内合成一行当日 `result='applied'`、`amount=1000000`（actor=1，键 `…live-cap-synth`） | 占用额度 1,000,000（事务内可见） |
| 直接调 `public.admin_points_adjust_post_event({actor_uid:1,target_uid:971213,cid:1,amount:1,…})` | 回执 **`{"ok":false,"user_found":1,"reason":"OVER_MAX_DAILY_AMOUNT","op":"mint","requested":"1","daily_cap":1000000,"daily_used":1000004}`**（1000004 = 真库当日 4 + 合成 1000000；1000004+1 > cap ⇒ 拒） |
| 拒绝留痕行（只读行级证据） | log_id 8 / actor_uid 1 / target_uid 971213 / op **mint** / amount **1**（= 请求值）/ balance_before **NULL** / balance_after **NULL** / result **`rejected_daily_cap`** / txid **NULL** / memo **`OVER_MAX_DAILY_AMOUNT`** / 指纹 `fp-live-cap` / 键 `ops:1:points_adjust:971213:1:live-caprepro` |
| 资金零残留 | 事务内 `ledger_entry` delta = **0**（拒绝 ⇒ **零资金分录**）；`audit` delta = 2（合成行 1 + 拒绝留痕 1） |
| `ROLLBACK` 后 | `ledger_entry` **271** / `audit` **4** / `Σ(account.balance,cid=1)` **1989693** / `account` 27 —— 与 ROLLBACK 前读数**逐字相同**（`zero_residue = true`） |

⇒ 「超限 ⇒ 明确拒绝 + 机读 reason + 审计留痕 + 零资金分录」在**真库 DB 编排函数层**已实证，且对真库**零残留**；
route 层的 400 映射由静态源码取证（`src/index.ts:1310-1322` 复用既有码 LD016 + `reason`）承担（§8）。

---

## 7. 收尾：净位移（**两个数**）

| 指标 | 改前（本单所有真 HTTP 跑之前） | 改后（终态） | 位移 |
|---|---|---|---|
| **Σ(account.balance, cid=1)** | **1989693** | **1989693** | **0（两个数相等）** |
| `ledger_entry` 行数 | 267 | **271** | +4 |
| `admin_ops_audit_log` 行数 | 0 | **4** | +4 |
| `account` 行数 | 25 | 27 | +2（两个新夹具账户，余额各 0） |

- **+4 资金分录 = 2 对 mint(+1)/burn(−1)**（run A：uid 971100，txid 275/276；run B：uid 971213，txid 277/278），
  全部落在本单新建夹具账户上，**每对净额 0**。账本 append-only（`ledger_idem_uniq` + 三表不可删）⇒ 已落分录**不可撤销**，故以「±1 点成对」把资金净位移压到 **0**。
- 4 行审计 = 上述 2 对动作的 `applied` 留痕（log_id 1,2,5,6），**无** `rejected_daily_cap` 行（真库 live 未触发）。
- 终态再确认：夹具 uid 971213 `cid=1` 余额 = **0**；`result='rejected_daily_cap'` 真库行数 = **0**。

**两次运行的诚实说明**：run A（02:01，artifact `live-20261002020141..json`）**五件事全部拿到真读数**，
但探针断言过严（numeric 列经驱动回成 JS number，我按字符串比较；`daily_used` 我硬填 1000000，实为 2+1000000）⇒ 探针 `exit=3`。
run B（02:02，`exit=0`，11/11 绿）是断言修正后的完整复跑。**这不是产品缺陷**——是本探针自身的类型比较 bug（已就地修正）。

---

## 8. `NOT_MEASURED`（逐项，禁填 0/空）

1. **日累计拒绝的 HTTPS 面**（`POST /api/admin/points/adjust` 回 **400 + LD016 + reason=OVER_MAX_DAILY_AMOUNT`）：
   真库 live **未**触发（不得造百万点，红线②）；DB 编排函数层已在**事务内**实证（§6），
   route 映射线仅有**静态源码取证**（`src/index.ts:1310-1322`）+ 离线/单元层（`scripts/p4z-b6audit-01-e2e.ts`）。
2. **两笔真并发同时卡在阈值下的端到端竞态**（HTTP 并发）：真库不可造百万点；
   DB 层并发闸有跨会话 `pg_advisory_xact_lock` 实测（`p4z-b6audit-01-e2e.ts` H1，55P03 lock_timeout），HTTP 并发面未测。
3. **route 层 → DB 的 `daily_used` 数值透传核对**（`details.used`）：同一原因，真库未产生该 400 响应体，未测。

---

## 9. 红线自查

| 红线 | 遵守方式 |
|---|---|
| ① 退出码不得取自管道之后 | 退出码由脚本内部计算（`process.exit(exitCode)`），运行命令为 `ts-node … > out 2>&1; echo EXIT=$?` ⇒ **EXIT=0** 直接得自命令本身 |
| ② 不得为测试造大额点数 | 真库写入额度最大 **±1 点**；百万点只在**事务内合成并 ROLLBACK**（§6） |
| ③ 不得写无关测试数据 | 只新增本单夹具（2 个 uid + 3 个 `ops:` 键 + 2 对分录），收尾资金回补归零 |
| ④ 只按精确 PID 关自己的进程 | 只用面板单路 `restart`；**未**用 `pkill -f`/`killall`；未起停其它 sid |
| ⑤ `NOT_MEASURED` 禁填 0/空 | §8 三项逐项写明「未测 + 原因 + 替代取证」 |
| 安全 | `.env.local` 只以变量方式读取，**未打印任何值**；token 只报存在性 |
| 硬边界 | 只写 `backend-ts/scripts/p4z-b6audit-live-01.ts`（+ 产物 `.p4-artifacts/p6b6audit-live/*.json`）与本文件；未动 `frontend/**`、`src/**`、迁移、spec、`docs/seafood.master-plan.md`、既有 audit 件；未 `git add/commit/push`；未 `npm install`；未 `vercel` |

**发现的产品缺陷：无**（两处 400/401/403 语义、幂等重投三读数、审计与资金同语句、净位移零，全部符合 `0023` 契约）。
