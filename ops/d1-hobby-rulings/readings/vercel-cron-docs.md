# 现取证据：Vercel 对 cron 的失败语义（2026-10-17 亲取）

- **取数时刻**：2026-10-17 12:0x CST（同日，本单操作窗口内）
- **取数方式**：真实浏览器打开官方文档页，读 `document.body.innerText`（非转述、非二手博客）
- **结论**：`D1` 选项 ②（漂移改 `500`）**不会「叫人」** —— 故 Kevin 裁「保持 `200`」有据。

## 1. 不重试（逐字）

页 = `https://vercel.com/docs/cron-jobs/manage-cron-jobs`（标题 `Managing Cron Jobs`），
段 `Cron job error handling`：

> Vercel will not retry an invocation if a cron job fails. You can check for error logs
> through the View Log button in the Cron Jobs section in the sidebar.

⇒ ① **任何档位对 cron 均不重试**（该页无按档位的重试差异）；② 失败的唯一官方观察面 = **面板 `View Log`**。

## 2. 没有「cron 任务失败」通知机制

页 = `https://vercel.com/docs/notifications`（标题 `Notifications`）：

- 全文（`document.body.innerText` 9.9 KB）**除左侧导航外零 `cron` 命中** ⇒ **无 cron 专项失败通知**。
- 通知类型表中与失败相关者只有两条，**都不是 cron 逐次失败**：
  - `Error Anomalies` —— 逐字「Triggered when a high rate of failed function invocations
    (those with a status code of 5xx) in your project exceeds a certain threshold」
    ⇒ **比率型 / 阈值型**告警，**日级单次任务达不到阈值**。
  - `Deployment Failures` —— 「Deployment owners will be notified about any deployment failures」
    ⇒ 面 = **部署**，不是 cron 运行。

⇒ 「漂移改 `500` ⇒ 套餐级失败通知才生效」（`ops/recon-cron/REPORT.md` §9.2 旧句）**与现取文档不符**；
本单**不以该句为依据**（旧字面保留、不删）。

## 3. 「根本没触发」连日志都没有（逐字）

同页 §`Cron job delivery and idempotency`：

> Cron job delivery is best effort. Most invocations run as scheduled, but occasional transient
> network errors can prevent a request from reaching your function. In those cases, your function
> does not execute, and no runtime log is created for that scheduled run.

⇒ **静默失败第 ② 类（没跑）无任何站内痕迹** ⇒ 只有 heartbeat（外部侧）+ 期望值比对才抓得到
（= `B32` 的 (b) 件）。

## 4. Hobby 精度与额度（复核 · 与 v2.36 块一致）

页 = `https://vercel.com/docs/cron-jobs/usage-and-pricing`：

| 档 | 条数 | 最小间隔 | 精度 |
|---|---|---|---|
| Hobby | 100 cron jobs | Once per day | Per-hour (±59 min) |
| Pro | 100 cron jobs | Once per minute | Per-minute |
| Enterprise | 100 cron jobs | Once per minute | Per-minute |

- Hobby 逐字：「Hobby accounts are limited to cron jobs that run once per day. Cron expressions
  that would run more frequently will fail during deployment.」
- 精度逐字（manage 页）：「Vercel may invoke these cron jobs at any point within the specified hour …
  `0 8 * * *` could trigger an invocation anytime between 08:00:00 and 08:59:59」
  ⇒ 与 `route-layer.spec` §46.3(b)「±59 min」一致；**`B32` (b) 的 grace `≥ 75min` 由此推出**
  （窗口 `59min` + 运行时长余量）。

## 5. heartbeat 参数建议的性质（诚实标注）

`B32` 里「period `24h` · grace `≥ 75min` · failure threshold `1`」= **文献口径 / 由 §4 的官方窗口参数推出的
建议值**，**非本站实测**（本单不实现、无外部监控服务可选型 ⇒ 无从实测）。落册时必须带此标注。
