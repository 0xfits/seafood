# 对账告警（B32 · D + A）· Telegram 推送 + healthchecks 心跳

- 仓：`/Users/kevin/bistro/seafood`（`main`，开工基线 HEAD `be483cc`，工作区干净）
- 性质：**纯旁路改造**。零新路由、零迁移、零新表/新列、零写库、零新错误码、零前端改动、零 i18n 键。
- 裁定真源：`docs/OPEN-ITEMS.md` `B32`（v2.38 块）+ Kevin 2026-10-17 口径 **D + A**
  （D = 漂移/异常直达 Telegram；A = 成功跑完才 ping 外部心跳）
- 取证时间：2026-10-17 12:56–13:03 CST（`05:0x`Z）
- 证据目录：本目录（`readings/` + `logs/` + `probe/`）

---

## 0. 结论先行

| 项 | 结果 |
|---|---|
| 新增文件 | `backend-ts/src/ops-alert.ts`（`notifyOps` + `pingHeartbeat` + 三个纯格式器） |
| 改动文件 | `backend-ts/src/index.ts`（import + `runAlertSafely` + `opsReconHandler` 三态分支，**+34 行 / −0 行**） |
| 路由注册点 | **107（未动）** —— `p7b-03` `AC10-2` 现取 `registration_points=107` |
| 错误码闭集 | **33（未动）** —— `p7b-03` `AC10-1` 现取 `codes=33` |
| `tsc --noEmit` | **exit 0** |
| `p7b-03` 离线门 | **37/37 全绿**（`EXIT=0`，`failed:0`，`red:[]`） |
| 行为探针 | **38/38 断言为真**，`EXIT=0`（零真库 / 零真网络 / 零真消息） |
| 反向对照 | ①「心跳恒 ping 成功位」⇒ 探针**变红**（36/38，`A2_ping_fail_once` / `A7_unbound_no_tg` 红，`EXIT=1`）；②「`notifyOps` 直接 throw」⇒ **响应仍 200 / 503 不变**（30/38，红的 8 条全是「消息发没发出去」类，响应类断言全绿） |
| 未做项 | healthchecks.io 账号与 check 创建（用户侧）/ Vercel env 配置（Zang 侧）/ 首次真告警演练 |

---

## 1. 改动面

| # | 文件 | 动作 | 规模 |
|---|---|---|---|
| 1 | `backend-ts/src/ops-alert.ts` | **新建**：`notifyOps` / `pingHeartbeat` / `buildDriftAlertText` / `buildInfraAlertText` / `redactSensitive` / `briefError` | +225 行 |
| 2 | `backend-ts/src/index.ts` | `import … from './ops-alert'`；新增 `runAlertSafely()`（告警兜底）；`opsReconHandler` 三态接告警 | +34 / −0 |
| 3 | `ops/recon-alert/**` | 本报告 + 探针 + 读数 + 日志（证据链） | 新增 |

`git diff --stat`：`backend-ts/src/index.ts | 34 ++++++++++++++++++++`（`1 file changed, 34 insertions(+)`）。
`ops-alert.ts` 是新建文件，不在 diffstat 里（sha256 = `5c5329ef…a6268d`，见 `readings/ops-alert.sha256`）。

### 1.1 `opsReconHandler` 的改动（原文）

```ts
    // ---- B32 告警面（旁路；任一失败不改回执）--------------------------------
    if (report.ok) {
      // A · 成功跑完 ⇒ ping 成功位（缺 ping = 外部来叫人）
      await runAlertSafely('heartbeat', () => pingHeartbeat(process.env.RECON_HEARTBEAT_URL));
    } else {
      // A · 漂移 ⇒ 显式 ping `/fail`（healthchecks 侧记一红，比「缺 ping」更准）
      await runAlertSafely('heartbeat', () => pingHeartbeat(process.env.RECON_HEARTBEAT_URL, true));
      // D · 漂移 ⇒ 推一条中文摘要
      await runAlertSafely('notify', () => notifyOps(buildDriftAlertText(report)));
    }
    return sendSuccess(res, report, report.ok ? 'Ledger recon completed' : 'Ledger recon detected drift');
  } catch (error) {
    // D · 基础设施异常 ⇒ 推一条（**不** ping 成功位：缺 ping 走外部报警）
    await runAlertSafely('notify', () => notifyOps(buildInfraAlertText(error)));
    return sendInfraMapped(res, 'ops.recon.ledger', error);
  }
```

**响应面零变化**：`sendSuccess(res, report, …)` / `sendInfraMapped(res, 'ops.recon.ledger', error)` 两处出口**一字未动**；
鉴权仍是「`CRON_SECRET` 未配 ⇒ 503 / 不匹配 ⇒ 401」；`console.error('[recon] ledger drift detected', …)` 那条**保留**。
告警 await 在响应**之前**完成（两者都有界：心跳 3s，发送 3s），但任一失败只 `console.warn`。

---

## 2. 三态行为（探针实测）

| 态 | 心跳 ping | Telegram | 响应 |
|---|---|---|---|
| `report.ok === true` | **1 次**，URL **无** `/fail` | **0 次** | `200` + `data.ok:true`（`message='Ledger recon completed'`） |
| `report.ok === false`（漂移） | **1 次** `/fail` | **1 次**（文案含 `id` / `rows` / `diff` / `checked_at` / `duration_ms`） | `200` + `data.ok:false`（`message='Ledger recon detected drift'`） |
| handler 抛错（DB 不可达） | **0 次**（刻意不 ping 成功位） | **1 次**（`对账执行异常: …`） | `503` + `LEDGER_TX_TIMEOUT`（§14 分类器原样，零新码） |
| 鉴权失败（503 / 401） | 0 次 | 0 次 | `503` / `401`（**告警不得在鉴权失败时触发**，两臂实测） |

> 异常分支**不** ping 成功位是设计：缺 ping ⇒ 外部服务叫人，这正是死人开关语义；
> 若在异常时也 ping 成功位，则「库挂了」会被外部监控记成绿的。

---

## 3. 新增 env 清单 + 缺 env 降级矩阵

| env | 示例 | 敏感性 | 缺失时的行为 |
|---|---|---|---|
| `OPS_ALERT_UID` | `100` | **非敏感**（站内 uid） | `notifyOps` 立刻返回 `{sent:false, reason:'OPS_ALERT_UID not configured'}`，**不打日志、不查库、不改响应** |
| `RECON_HEARTBEAT_URL` | `https://hc-ping.com/<uuid>` | **敏感**（UUID 即凭据）：**只在 Vercel 配**，不入仓、不进文档、不进日志 | `pingHeartbeat` 立刻 `return`（连 `console.warn` 都不打 —— 未配 ≠ 故障），不改响应 |

> 唯一复用而**未新增**的既有 env：`TELEGRAM_BOT_TOKEN`（发送层 `sendTelegramReply` 本来就用它；
> 缺它时该函数自己 `console.warn` 后 return，本单**不引入新失败面**）。

### 3.1 降级矩阵（逐条，全部实测）

| 触发 | 行为 | 响应是否改变 |
|---|---|---|
| `OPS_ALERT_UID` 未配 | 不发，`reason='OPS_ALERT_UID not configured'` | **否** |
| `OPS_ALERT_UID` 非数字（如 `abc`） | 不发，`reason='… not numeric'` | **否** |
| `OPS_ALERT_UID` 数值越界 / ≤0 | 不发，`reason='… out of range'` | **否** |
| 该 uid 查无此行 | 不发，`reason='… user not found'` | **否** |
| `tg_user_id IS NULL`（未绑定 / 已解绑） | 不发，`reason='… has no telegram binding'` | **否** |
| 收件人查询抛错（库不可达） | 不发（`console.warn` 一行），漂移回执仍 `200 + ok:false` | **否** |
| 缺 `TELEGRAM_BOT_TOKEN` | 发送层降级为「只 warn」，`notifyOps` **如实**回 `{sent:false}`（不谎报已送达） | **否** |
| Telegram 发送超过 3s | 停止等待、`console.warn` 一行（后台 fetch 由运行时收尾） | **否** |
| `RECON_HEARTBEAT_URL` 未配 | 不 ping、不打日志 | **否** |
| 心跳超时（>3s，`AbortController`） | 只 `console.warn`；实测耗时 3008ms 后响应仍 `200 + ok:true` | **否** |
| 心跳返回非 2xx（探针造 500） | 只 `console.warn('[ops-alert] heartbeat ping non-2xx: 500')` | **否** |
| 心跳 fetch 抛错 | 只 `console.warn('[ops-alert] heartbeat ping failed: …')` | **否** |
| `notifyOps` / `pingHeartbeat` 意外抛出 | `runAlertSafely()` 吞掉 + `console.warn` | **否**（反向对照②实测） |

**日志里的凭据口径**：心跳失败只打状态码 / 错误摘要，**从不打 URL**（UUID 即凭据）；
探针有专门断言 `N2_no_heartbeat_url_in_logs`（扫全部 `console.warn` 行）。

---

## 4. 文案口径（中文纯文本 · 单条 · ≤300 字 · 不含秘密）

漂移（实测原文，80 字）：

```
对账漂移 2026-10-17T05:01:48.593Z 用时0ms 失败1/3项: supply_vs_ledger rows=1 diff=2000001
```

- 必带：`checked_at`（ISO8601）/ `用时<N>ms` / 每条 FAIL 的 `id` + `rows=<n>` + `diff=<值>`
  （②③ 两条零行检查不产出 `diff` ⇒ 打 `diff=-`，不谎报 0）。
- 三条全 FAIL 的最坏情形：`… 失败3/3项: supply_vs_ledger rows=1 diff=2000001; account_vs_ledger rows=1 diff=-; batt_account_vs_batt_entry rows=1 diff=-`（≤300 字，实测通过）。
- 异常：`对账执行异常: <error.message 摘要>`（≤140 字，再叠 300 字总闸）。

脱敏（`redactSensitive`，外发文案的唯一出口，实测）：

| 输入 | 输出 |
|---|---|
| `postgresql://sf_user:S3CRETPASS@db.example.tech/x` | `postgresql://***:***@db.example.tech/x` |
| `123456789:AAFakeTokenAAAA…`（bot token 形状） | `***` |
| JWT / `sk_live_…` / ≥32 位 hex / ≥40 位 base64url | `***` |

截断按**码点**（`Array.from`）而非字节 —— 中文 / emoji 不会被切成半个代理对。

---

## 5. 读数（全部亲跑，未采信自报）

### 5.1 `tsc --noEmit`

```
cd backend-ts && npx tsc --noEmit   ⇒ TSC_EXIT=0
```

日志：`logs/tsc.log`。

### 5.2 `p7b-03` 离线门

```
npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts  ⇒ GATE_EXIT=0
summary: {"total": 37, "passed": 37, "failed": 0, "red": []}
AC10-1 pass=true  codes=33
AC10-2 pass=true  registration_points=107
```

日志：`logs/p7b-03-gate.log`；机读产物：`readings/gate-p7b-03.json`
（原盘 `backend-ts/.p7b-artifacts/p7b-03-offline-gates-20261017T050303Z0mqt.json`）。
**107 未动** ⇒ 零新路由成立（本单只改 handler 体，未新增任何 `app.get/post/…`）。

### 5.3 行为探针（`probe/recon-alert-probe.ts`，**38 断言 = 16 个 HTTP 臂的 28 条 + 单元面 8 条 + 泄密扫描 2 条**）

零真库、零真网络：`db.readQuery` 与 `globalThis.fetch` 全换桩；鉴权 / 判定 / 回执 / 告警分支走真码。

| 臂 | 场景 | 关键读数 |
|---|---|---|
| A1 | `ok=true` | `hb=["…/probe-8f3a1c2d-uuid"]`（1 次、无 `/fail`）、`tg=0`、`200`/`ok:true` |
| A2 | 供应量漂移 +1 | `hb=["…/fail"]`（1 次 `/fail`）、`tg=1`、`200`/`ok:false`、文案 80 字含 `supply_vs_ledger rows=1 diff=2000001` |
| A3 | DB 不可达（`ECONNREFUSED`） | `hb=[]`（0 次）、`tg=1`、`503`/`LEDGER_TX_TIMEOUT`、文案 `对账执行异常: …` |
| A4 | 三条全 FAIL | `tg=1`、文案含三条 id、`chars≤300` |
| A5 | 无 `RECON_HEARTBEAT_URL` + 绿 | `hb=0`、`tg=0`、`200`/`ok:true` |
| A6 | 无心跳 URL + 漂移 | `hb=0`、`tg=1`、`200`/`ok:false`（通知不依赖心跳） |
| A7 | `tg_user_id IS NULL` | `tg=0`、`hbFail=1` |
| A8 | uid 查无此行 | `tg=0` |
| A9 | `OPS_ALERT_UID` 未配 | `tg=0` |
| A10 | `OPS_ALERT_UID=abc` | `tg=0` |
| A11 | 收件人查询抛错 | `tg=0`、`200`/`ok:false`（回执不受影响） |
| A12 | 心跳 500 | `200`/`ok:true` |
| A13 | 心跳 fetch 抛错 | `200`/`ok:true` |
| A14 | 心跳挂起 | `elapsed=3008ms` 后 `200`/`ok:true`（3s 上限生效） |
| A15 | `CRON_SECRET` 未配 | `503`、`hb=0`、`tg=0` |
| A16 | 错 secret | `401`、`hb=0`、`tg=0` |
| U1–U6 | 脱敏 / 300 字上限 / 文案字段 / 无 token 不谎报 / 空 URL 不 ping | 全绿 |
| N1–N2 | 回执与外发文案无秘密；warn 行无心跳 URL | 全绿 |

结论行：`{"total":38,"passed":38,"failed":[],"all_assertions_pass":true}`（`EXIT=0`）。
日志：`logs/probe-recon-alert.log`；机读：`readings/probe-recon-alert.json`。

---

## 6. 反向对照（证明探针有分辨力 / 告警不阻断主流程）

两臂都是**临时改真码 → 复跑 → 原样还原**（`ops-alert.ts` 还原后 sha256 与改前逐字节相同：`5c5329ef…a6268d`）。

### 6.1 臂①：`pingHeartbeat` 改成**总是** ping 成功位（忽略 `fail`）

改法（一行）：`const target = fail ? …'/fail' : base;` ⇒ `const target = base;`

结果：`EXIT=1`，**36/38**，红项：

```
FAIL A2_ping_fail_once :: hb=["https://hc-ping.invalid/ping/probe-8f3a1c2d-uuid"]
FAIL A7_unbound_no_tg :: tg=0 hbFail=0
```

⇒ 漂移态的 `/fail` 断言**确实会红**，探针对「ping 到哪儿」有分辨力。
日志：`logs/probe-negctl-always-ping.log`；机读：`readings/probe-negctl-always-ping.json`。

### 6.2 臂②：`notifyOps` 改成**直接 throw**（`PROBE_FORCE_NOTIFY_THROW=1`）

结果：`EXIT=1`，**30/38**，红的 8 条**全部**是「消息发没发出去」类
（`A2_text_*` / `A3_one_telegram` / `A3_text_infra` / `A4_*` / `A6_notify_independent_of_heartbeat`）；
**响应类断言全绿**：

```
PASS A2_200_ok_false  :: status=200 ok=false
PASS A3_503_unchanged :: status=503 code=LEDGER_TX_TIMEOUT
PASS A1_status_200_ok_true / A5_still_200_ok_true / N1_ / N2_
```

⇒ 告警通道整个抛掉，对账回执与状态码**一字不变**（`runAlertSafely` 兜底生效）。
日志里可见 `[recon] alert channel "notify" failed: probe negctl: forced notify throw`。
日志：`logs/probe-negctl-notify-throw.log`；机读：`readings/probe-negctl-notify-throw.json`。

### 6.3 探针自身踩的坑（留痕，免得下一轮重踩）

- **U2 首版夹具**用 `'x'.repeat(1000)` 造「超长错误」⇒ 先命中「≥40 位 base64url」脱敏规则，
  整段变成 `***`（11 字），300 字上限断言假红。改为自然长句 `'连接超时，重试中。'.repeat(120)` 后转绿。
  ⇒ **教训**：验截断的夹具必须「长但不像凭据」，否则验的是脱敏不是截断。
- **跑法**：本仓 `npx ts-node --transpile-only ../ops/...` 在本机需显式 `TS_NODE_PROJECT=tsconfig.json`
  （否则 ts-node 对仓外入口文件解析出 `module=NodeNext` ⇒ `TS5109` 编译错）。门用
  `TS_NODE_PROJECT=tsconfig.scripts.probe.json`。

---

## 7. ★ 与已登记口径的差异（供 Jing 补登 `OPEN-ITEMS`）

`docs/OPEN-ITEMS.md` **`B32`（v2.38 块）** 登记的前置写法是 **`OPS_ALERT_TG_CHAT_ID`**
（即在 env 里**直接存 Telegram chat_id**）。**本实现改为 `OPS_ALERT_UID` + 服务端查
`users.tg_user_id`**，理由两条：

1. **env 不存敏感值**：chat_id 是「一发就能找到人」的对外标识，属于凭据类；
   uid 是站内主键，非敏感（`100`），与环境变量清单里其它值的敏感度同档。
2. **告警跟随用户绑定的变化**：用户在 Settings 解绑 / 换绑 Telegram ⇒ 告警自动跟着变或自动停
   （`tg_user_id IS NULL` ⇒ 不发，reason 可见）；若把 chat_id 写进 env，解绑后 env 仍会往一个
   用户以为已断开的账号推送 —— 与「解绑即停推」（A5-DL-P3）口径相冲突。

其余口径与登记一致：token / 心跳 URL 一律走 env、不入库、不入代码、不入文档。
`B32` 里「四类静默失败」的覆盖情况：**漂移**（A `/fail` + D 推送）/ **没跑**（缺 ping，外部叫人）/
**401**（本单**未**新增告警：401 时既无 ping 也无通知 —— 按「缺 ping = 报警」由外部覆盖，
见 §8）/ **超时**（`AbortController` 3s 只保护心跳本身；函数级 300s 超时仍由「缺 ping」覆盖）。

---

## 8. 「没跑」类只靠外部心跳（站内无解）

Vercel 官方逐字（`docs/OPEN-ITEMS.md` v2.38 块已引，证据 `ops/d1-hobby-rulings/readings/vercel-cron-docs.md`）：

> **Cron job delivery is best effort … occasional transient network errors can prevent a request
> from reaching your function. In those cases, your function does not execute, and no runtime log
> is created for that scheduled run.**

⇒ 「cron 根本没跑」时**站内什么都不会发生**：没有请求、没有 handler、没有 `console.error`、
没有任何可挂 hook 的点。**唯一可见的痕迹是外部侧「该来的 ping 没来」**。
所以本单**没有**、也**不可能**在站内补这条；覆盖它完全依赖 healthchecks.io 的 grace 判定
（建议 period `24h` / grace ≥ `75min` / failure threshold `1`，理由同 `B32` 登记值）。
**这不是缺陷，是形态边界**：站内只能观测「跑过之后的结果」，观测不了「从未开始」。

---

## 9. 未做项（明确不做，不在本单）

| 项 | 归属 | 说明 |
|---|---|---|
| healthchecks.io 账号与 check 创建 | **用户侧（Kevin）** | 免费档即可；需 period `24h` + grace ≥ 75min（覆盖 Vercel `±59min` 窗口）；拿到 ping URL 后交 Zang |
| Vercel env 配置（`RECON_HEARTBEAT_URL` / `OPS_ALERT_UID`） | **Zang 侧** | `RECON_HEARTBEAT_URL` 只在 Vercel 配（敏感）；`OPS_ALERT_UID` 建议同为 Production |
| 首次**真**告警演练（真发一条 Telegram / 真 ping 一次） | 上线后 | 本单一切外发全部被探针桩接住，**零真实消息、零真实 ping** |
| 401 / 超时 四类文案分开与去重 | 后续单 | 当前 401 无站内告警（靠缺 ping）；如需「401 单独叫人」需另立单（会引入新告警面） |
| 「不跑」以外的去重 / 静默窗口 | 后续单 | 日级任务暂无刷屏风险 |

---

## 10. 明确没动的

- `vercel.json`（cron 一字未改）、`backend-ts/migrations/**`、任何 `INSERT/UPDATE/DELETE`、
  `ledger_post_event`、`frontend/**`、`frontend/src/locales/**`
- 既有 `translate/backfill` 路由与其 cron、`sendInfraMapped` / §14 分类器 / 错误码闭集
- `docs/**`（`B32` 的差异补登由 Jing 负责，本单只留本报告 §7）
- 未 `git push`

---

## 11. 复跑命令（逐字可执行）

```bash
# ① 类型检查
cd /Users/kevin/bistro/seafood/backend-ts && npx tsc --noEmit; echo "TSC_EXIT=$?"

# ② 离线门（注册点 107）
cd /Users/kevin/bistro/seafood/backend-ts \
  && TS_NODE_PROJECT=tsconfig.scripts.probe.json npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts

# ③ 三态探针（38 断言；零真库 / 零真网络）
cd /Users/kevin/bistro/seafood/backend-ts \
  && TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-alert/probe/recon-alert-probe.ts

# ④ 反向对照（先临时改真码，跑完务必还原；还原基准 = readings/ops-alert.sha256）
#   臂①：ops-alert.ts 的 `const target = fail ? … : base;` 改成 `const target = base;`
#   臂②：PROBE_FORCE_NOTIFY_THROW=1 PROBE_NEGCTL=notify_throw …（需在 notifyOps 首行加 throw）
```

---

## 12. 敏感面自检（本目录自身）

- 本报告、`probe/**`、`readings/**`、`logs/**` **不含**任何真实 secret / 连接串 / 真实 bot token；
  探针用的是**合成**值：`123456789:PROBEFAKETOKEN…`、`https://hc-ping.invalid/ping/probe-8f3a1c2d-uuid`
  （`.invalid` 顶级域不可解析，永远打不出去）。
- `logs/**` 由 `.gitignore` 的 `logs` / `*.log` 规则忽略 ⇒ 入库需 `git add -f`（本单如此）。
- 心跳 URL 一旦在 Vercel 配好即为凭据（UUID 可被用来伪造 ping）⇒ 只在 Vercel 存，不进任何仓内文件。
