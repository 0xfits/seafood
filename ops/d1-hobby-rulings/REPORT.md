# 裁定落册 · `D1` = 保持 `200`（告警另单 `B32`）+ Hobby 非商业用途已接受（暂不升级 Pro）

- **单型**：纯文档落册（**只写 `docs/**`**；证据目录 `ops/d1-hobby-rulings/**`）；**删除行 = 0**；**不 push**
- **基线**：`main` · HEAD `67488c2`（工作区干净，改动前 `git status --porcelain` 空）
- **日期**：2026-10-17

---

## 0. 结论先行

| # | 裁定 | 落册位置 |
|--:|---|---|
| ① | **`D1` = 已裁（保持 `200`）** —— 漂移时 HTTP 仍 `200`，body `data.ok=false` + 一条 `console.error('[recon] …')` 不变；**告警改造 = 另单 `B32`** | `docs/OPEN-ITEMS.md` 新块 `v2.38`（v2.37 块字面一字未改）+ `docs/route-layer.spec.md` **§46.4 粗体补注段** |
| ② | **`Hobby` 非商业用途 = 已接受（暂不升级 Pro）** —— 风险描述与官方原文要点**保留不减记**，含「将来被限流/要求升级/项目被停用 ⇒ 在此条目下追记」 | `docs/OPEN-ITEMS.md` 新块 `v2.38` ②（顶部 v2.36 块 ② 字面一字未删） |
| ③ | **新单 `B32`** = 「对账告警：Telegram 推送 + heartbeat（覆盖『漂移 / 没跑 / 401 / 超时』四类静默失败）」—— **只登记、不实现** | `docs/OPEN-ITEMS.md` B 段表末行（B31 之后，编号顺延现取最大） |

## 1. 做了什么（逐文件）

| 文件 | 变更 | numstat |
|---|---|---|
| `docs/OPEN-ITEMS.md` | ① 顶部新增 `v2.38` 裁定块（两条裁定状态改写 + 现取依据 + 追记规则）；② B 段表末新增 `B32` 行 | `3 0` |
| `docs/route-layer.spec.md` | §46.4 之后、§46.5 之前新增**一条粗体补注段**（blockquote，**未新开 §、未新开 `###`**） | `2 0` |
| `docs/OPEN-ITEMS.md` 合计 | | **删除行 0** |
| `docs/route-layer.spec.md` 合计 | | **删除行 0** |

**纪律自证**
- `git diff --numstat` = `3 0` + `2 0` ⇒ **删除列合计 = 0**（读数落 `readings/numstat.txt`）。
- **旧字面一律未改**：`v2.37` 块（含「`D1` 待裁」字样）、`v2.36` 块 ②（含「待裁定风险」字样）、§46.4 标题（含「`D1` 待裁」）、§46.7 ④（「`D1` 未裁」）**全部原样保留**；新块/补注里显式标注「旧字面 = 裁前字面，现行口径以本块为准」。
- **未新开节号**：`grep -c '^### 46\.'` 改前改后均为 **8**；`^## §46 ` 仍恰 **1** 命中；`B` 段只加表格行，不加小标题。
- **零代码**：`git show --stat` 只含 `docs/**` + `ops/d1-hobby-rulings/**`。

## 2. 关键现取证据（否决「改 `500`」的理由 · 本单亲取）

> 取数方式 = 真实浏览器打开官方页读 `document.body.innerText`（**非二手转述**）；完整引文落
> `readings/vercel-cron-docs.md`。

1. **不重试**（`vercel.com/docs/cron-jobs/manage-cron-jobs` · `Cron job error handling`）逐字：
   「Vercel will not retry an invocation if a cron job fails. You can check for error logs through the
   View Log button in the Cron Jobs section in the sidebar.」
   ⇒ **任何档位对 cron 均不重试**；失败唯一官方观察面 = 面板 `View Log`。
2. **无 cron 专项失败通知**（`vercel.com/docs/notifications`）：全文（9.9 KB）除左导航外**零 `cron` 命中**；
   唯一 5xx 相关项 = `Error Anomalies`「**high rate** of failed function invocations (5xx) … exceeds a
   certain threshold」⇒ **比率型团队告警，日级单次任务达不到阈值**。
   ⇒ **改 `500` 只让面板标红、不叫人**；A/B 实质差别**仅是「去哪儿看」**。
3. **「没跑」连日志都没有**（同页 `Cron job delivery and idempotency`）逐字：
   「Cron job delivery is best effort … occasional transient network errors can prevent a request from
   reaching your function. In those cases, your function does not execute, and **no runtime log is
   created for that scheduled run**.」
   ⇒ `B32` 必须含 heartbeat 的直接理由。
4. Hobby 精度复核（`usage-and-pricing`）：Hobby = `100 cron jobs` / `Once per day` / `Per-hour (±59 min)`；
   ⇒ `B32` 的 grace `≥ 75min` 由「`±59min` 窗口 + 运行时长」推出（**建议值，非本站实测**）。

## 3. `B32` 登记要点（只登记 · 不实现）

- **四类静默失败**：① 漂移（逻辑失败但 `200`）② 根本没触发（best-effort，**无日志**）③ `CRON_SECRET` 错配 ⇒ 每次 `401` ④ 函数超时半途而废（Hobby `300s` 上限）。
- **(a) 漂移推送**：复用 `backend-ts/src/telegram-service.ts` 的 `sendTelegramReply(chatId, text)`（env-gated；缺 `TELEGRAM_BOT_TOKEN` ⇒ `console.warn` 后 return = 降级为仅日志）。**前置待定 = 收件人**（新增 env 如 `OPS_ALERT_TG_CHAT_ID`，或复用管理员 `users.tg_user_id`）⇒ **须 Kevin 定**。
- **(b) heartbeat（死人开关）**：成功跑完才 ping；没 ping 即告警。参数建议 **period `24h` · grace `≥ 75min` · failure threshold `1`**（**文献/推导口径，非实测**）；自建需新端点 + 外部调度。
- **代价 / 风险**：新增配置 + 外部依赖；误报治理；**凭据不得入库**。
- **前提**：Kevin 定收件人 + 选心跳服务（自建 vs 第三方）；**未定之前不实现**。

## 4. 未做项（显式登记，不冒充已做）

1. **`B32` 未实现**（按派单：只登记）。
2. **`docs/versions/` 快照未重制**（版本收口单职责；本单未动版本号头）。
3. **首次生产回执仍未取**（承 v2.37 未做项；待 UTC 18 时段窗口后现取）。
4. **`docs/route-layer.spec.md` 版本头未升号**（本单只在 §46.4 挂粗体续段；未改任何 `状态：v2.3x` 行）。

## 5. 复跑 / 复核命令

```bash
cd /Users/kevin/bistro/seafood
git diff --numstat                       # 期望：docs/OPEN-ITEMS.md 3 0 · docs/route-layer.spec.md 2 0
grep -c '^> \*\*★ v2.38' docs/OPEN-ITEMS.md          # 1
grep -n '| \*\*B32\*\*' docs/OPEN-ITEMS.md            # 命中 1 行
grep -n '★ 补注（2026-10-17 · Kevin 裁定落册）' docs/route-layer.spec.md   # 1 行
grep -c '^### 46\.' docs/route-layer.spec.md          # 8（未新增小节）
grep -n '^\| \*\*D1\*\*' docs/OPEN-ITEMS.md            # 0 命中（D1 无独立表格行，仅顶部块 + route §46.4）
```
