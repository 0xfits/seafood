# BTTC / 账本对账「定时化」最小改动面评估

- 仓：`/Users/kevin/bistro/seafood`（HEAD `2da49e0`，分支 `main`）
- 性质：**只读评估**。本轮零代码改动、零数据模型改动、零迁移、零写库（含 dev 库）；唯一写入 = 本 `ops/bttc-recon-cadence/` 目录。
- 现取时间：**2026-10-17 10:12 CST（02:12Z）**
- 取证读数全部落在 `ops/bttc-recon-cadence/readings/`（含两个可重跑的只读探针）

---

## 0. 结论先行

| 项 | 结论 |
|---|---|
| 推荐方案 | **A · 复用 Vercel cron + 新只读端点**（`GET /api/ops/recon/ledger`，`CRON_SECRET` 闸） |
| 改动面 | **4 个文件**（其中 1 个新建），**零迁移、零前端、零 i18n 键、零数据模型** |
| 落地前的桥 | 本轮的 `readings/recon-readonly.cjs` 已可在本机零改动跑（方案 C），用于先定基线常量 |
| 三条对账口径 | ① 供应量 vs 账本（**带已知差额常量**）② 逐户 balance/frozen ③ 逐户 batt。三条**今天实测全绿**（除①的已登记差额） |
| 必须先知道的两件事 | **(a)** 生产**没有 BTTC 币种行**（`currency` 只有 cid=1 的 `$`）⇒ BTTC 专项检查今天是空集，不能写成「必须有行」的硬闸；**(b)** 事件级配对不变式在生产**有 28 个非零根键**⇒ **不能进 v1**（详见 §3.4） |

---

## 1. 最小改动面（逐项 · 文件级）

### 1.1 四个文件（方案 A）

| # | 文件 | 动作 | 规模 | 是否触碰数据模型 |
|---|---|---|---|---|
| 1 | `backend-ts/src/ops-recon.ts` | **新建**：三个纯 SELECT 检查函数 + 判定 + 告警分发。走 `db.ts:226` 的 `readQuery`（只读池，`resolveReadUrl`） | ≈110 行 | 否 |
| 2 | `backend-ts/src/index.ts` | **+1 注册点**：`app.get('/api/ops/recon/ledger', …)`，`CRON_SECRET` fail-closed（照 `:3131` 的 backfill 三段式：无 secret ⇒ 503 / bearer 或 `x-cron-secret` 不符 ⇒ 401 / 通过 ⇒ 干活） | ≈25 行 | 否 |
| 3 | `backend-ts/scripts/p7b-03-offline-gates.ts:145` | **常量前推 105 → 106**（`AC10-2` 注册点计数）+ 注释链等行数追加 | +1 行（等行数替换） | 否 |
| 4 | `vercel.json` | `crons` 数组 **+1 条**：`{"path":"/api/ops/recon/ledger","schedule":"30 18 * * *"}`（= 02:30 CST，与既有 02:00 CST 的 backfill 错开 30 分钟） | +4 行 | 否 |

**不需要的东西（逐条排除，均有现取依据）**：

- **不需要迁移**：三条检查只读既有表 `currency` / `ledger_entry` / `account` / `batt_account` / `batt_entry`（`0001_ledger_core.sql:40-95`、`0029_batt_checkin.sql:79-94`）。零 DDL。
- **不需要新的读模型 / 视图 / 快照表**：见 §5.4（「记录上次运行结果」这件事 v1 明确不做，因为它要写库）。
- **不需要前端页面**：告警面走 Telegram + 函数日志（§4）；站内展示的代价见 §4 表。
- **不需要新 i18n 键**：告警文本是运维面文本，不进四语键集（不进 `frontend/src/locales/**` 就零撞键）。
- **不需要 Vercel CLI**：`vercel.json` 是仓内文件，push 即生效（本仓 push = 上线）。CLI 侧在本仓历史上被并行会话改过 scope（技能已登记），本方案不依赖它。
- **不需要 GitHub Action**：见 §2 方案 B。

### 1.2 一个必须说清的现取事实：**唯一既有 cron 是死的**

```
$ cat vercel.json | sed -n '/crons/,/]/p'
  "crons": [
    { "path": "/api/translate/backfill", "schedule": "0 18 * * *" }
  ]

$ grep -n "api/translate/backfill" backend-ts/src/index.ts
3131:app.post('/api/translate/backfill', async (req, res) => {
```

- 该路径**只注册了 POST**（全仓 1 处命中，无 `app.get`）。`backend-ts/src/index.ts:3480` 的兜底 `app.use((req,res)=>sendRefNotFound(...'route_not_found'))` ⇒ GET 落 404。
- Vercel cron 的调用形态是 **HTTP GET**（`user-agent: vercel-cron/1.0`，带 `x-vercel-cron-schedule`；配了 `CRON_SECRET` 则自动带 `Authorization: Bearer <CRON_SECRET>`），且**只在 production 部署上跑、一律 UTC**（外部口径：Vercel 官方 cron 文档 / 三份独立复述一致；本仓无法离线自证）。
- ⇒ **「复用 Vercel cron」这件事在本仓今天并没有先例可复用**：新端点必须自己注册 `GET`，否则同样落 404 且**静默无告警**（cron 只会在 dashboard 上记一次非 2xx）。
- 这条不属本单范围，但**必须登记**：既有翻译 backfill 的日级 cron 大概率从未真正跑过（`B25` 的「对账没有定时任务」之外，多一处「有 cron 但不生效」）。建议另立单，不并入本单改动。

---

## 2. 三条候选方案对比

| 维度 | **A · Vercel cron + 只读端点** | **B · GitHub Action** | **C · 本机 launchd + `ops/` 脚本** |
|---|---|---|---|
| 改动量 | 4 文件 / 1 新建 ≈140 行；含 1 处门常量前推（注册点 105→106，必须同批） | 2 文件（`.github/workflows/recon.yml` + 脚本）；**但本仓 `.github/` 根本不存在**（`ls .github` ⇒ No such file）⇒ 等于从零起 CI | **0 个仓内代码文件**（脚本已在 `readings/recon-readonly.cjs`，可直接提为 `ops/…/recon-readonly.cjs`）+ 1 个 `~/Library/LaunchAgents/*.plist` |
| 运行位置 | Vercel 生产函数（`sin1`），独立于任何人的机器 | GitHub Actions runner | Kevin 的 Mac |
| 凭据需求 | **零新增**：复用 Vercel 现有 env（`DATABASE_URL` 已在生产 env 里；`CRON_SECRET` 已存在，被 backfill 使用） | **新增一份生产库串到 GitHub Secrets** ⇒ 生产凭据多一个副本、多一处暴露面（与「凭据泄露」这一真风险正相反） | **零新增**：直读既有 `~/.config/seafood/prod-db.env`（600，单键 `DATABASE_URL_UNPOOLED`） |
| 失败告警 | ① drift ⇒ 返回 500 ⇒ Vercel cron 面板红 + 套餐自带 cron 失败通知；② 同时 Telegram 主动推（env-gated，缺 token 自动降级为日志）；③ 函数日志 | GH 自带 workflow failure 邮件/通知（免费、可靠） | 只有本机日志 + `osascript` 通知（**无 Telegram token 在本机** ⇒ 想推 TG 得再存一份 bot token = 新凭据） |
| 可靠性 | 高：与机器开关机无关 | 高 | **低**：Mac 睡眠/关机即漏跑（launchd 的 `StartCalendarInterval` 只在唤醒后补跑一次，夜间关机则整天无读数） |
| 成本 | **0**（cron 含在套餐内；3 条 SQL 实测 162/163 ms，Neon 唤醒时间可忽略）。⚠ Hobby 套餐 cron 上限为 2 条（本仓当前已用 1 条，加这条正好 2 —— 已到顶）；Pro 为 40 条。**套餐档位未现取，需用户确认** | 免费额度内（私有仓 2000 min/月，日跑 1 分钟 ≈ 30 min/月） | 0（本机） |
| 是否触碰数据模型 | **不触碰** | 不触碰 | 不触碰 |
| 主要缺点 | 需动 1 处门常量；`vercel.json` 用的是 legacy `builds`，cron 能否在该形态下正常注册**需上线后现取验证**（无法离线证明） | 生产凭据二次分发；仓内无任何 CI 先例，等于新开一条流水线 | 无客观可核的告警；读数只在一台机器上 |
| 结论 | ✅ **推荐** | ✗（凭据面） | ✅ **作为落地前的 0 改动桥**（今天就能跑，见 §3.5） |

**为什么 A 优于 B**：B 的唯一优势是「不新增路由、不用推门常量」，但它把**生产库串复制进 GitHub** —— 而本单的真风险定义正是「库/备份/运维凭据泄露」。用 A 的 4 个文件和 1 个常量换取「凭据不出 Vercel」，是这笔账里最划算的一项。

---

## 3. 对账 SQL 口径（全部只读 SELECT，全部现取）

> 符号约定（**必读，勘误已定案**）：`burn` 分录是**单边负额**（`delta = −v_amount`），故守恒式是
> **`total_supply == Σmint + Σburn`**，不是 `Σmint − Σburn`。
> 出处：`docs/audit/p9-s4-bttc.md:324`（`KI2` 首跑红的定性 = **门自身口径错**：「原式 `Σmint − Σburn` 把符号弄反（`0 == 1 − (−1) = 2`）；判据语义（严格相等）未放松，仅订正符号约定」）+ `backend-ts/scripts/p8-s9-bttc-gate.ts:683/708`（现役代码里就是 `BigInt(supply) === BigInt(sumMint) + BigInt(sumBurn)`）。

### 3.1 检查① 供应量 vs 账本（按 cid）

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

- **期望**：`diff` 逐行 **== 该 cid 的已登记基线常量**（不是 0）。
- **现取（2026-10-17T02:12Z，生产 Neon `sweet-pond-28934105`）**：

  | cid | symbol | total_supply | Σmint | Σburn | ledger_derived | **diff** |
  |---|---|---|---|---|---|---|
  | 1 | `$` | 2,010,200 | 210,274 | −200,074 | 10,200 | **2,000,000** |

  ⇒ 该差额**与 `docs/OPEN-ITEMS.md` B25 已登记的已知差额逐位相同**（B25 状态行逐字：「守卫须换算的已知差额 = `2,000,000`（= 未搬的纯夹具 mint/burn 净额，几乎全为 `970001` 的 `mint 2,000,000`）」）。
- **阈值**：`diff <> 常量` 即 FAIL，**无容差**（整数计数器，任何非零差都是漂移）。编码形态 = `KNOWN_SUPPLY_OFFSET: Record<cid,string> = { '1': '2000000' }`，未登记 cid 的默认必须为 `'0'`。
- **为什么不能写成 `diff == 0`**：今天第一天就会红，且**永远红**。这是本报告最重要的一条工程结论 —— 门要带基线常量，否则上线即噪音，三天内没人再看。
- **BTTC 专项注意（现取）**：`currency` 表**只有 1 行**，`symbol='BTTC'` **不存在**。

  ```
  $ node readings/recon-readonly.cjs | jq '.bttc_row'      ⇒ []
  $ … | jq '.counts'  ⇒ {"currency":1,"ledger_entry":271,"account":25,"batt_account":19,"batt_entry":24,"app_config":1}
  ```
  ⇒ BTTC 行由 `ensureBttcCurrency` 在**首次 mint 时惰性创建**（`p9-s4-bttc.md` §8.2 的 `F-α` 修的就是这次插入的返回确定值）。故检查①必须按「cid 全集」写，**不得**写成 `WHERE symbol='BTTC'`（否则今天 0 行、明天 1 行，变成「有行才检查」的假绿）。

### 3.2 检查② `account.balance/frozen` vs `Σ ledger_entry.delta/frozen_delta`（逐户）

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

- 出处：`backend-ts/scripts/qa-p1b-lib.ts:88-102`（`qaDrift`，**独立的 QA 侧重算**，非复用实现方的 drift 函数）。同一口径在 `docs/qa/p4-b3-funds-qa.md:125` 记为「账户级漂移（`balance ≠ Σdelta` 或 `frozen ≠ Σfrozen_delta`）= **0 行**」。
- **期望：0 行**。**现取：0 行**（覆盖 25 个 `account` 行）。
- **阈值**：`count(*) > 0` 即 FAIL；告警体带 `uid/cid/diff` 三列（前 20 行），便于直接定位。
- 索引：`idx_ledger_uid_cid_txid ON ledger_entry (uid, cid, txid DESC)`（`0001_ledger_core.sql:114`）⇒ 该 `GROUP BY uid,cid` 有索引支撑。实测 **163 ms**。

### 3.3 检查③ `batt_account.batt` vs `Σ batt_entry.delta`（逐户）

```sql
SELECT b.uid, b.batt, COALESCE(e.d,0) AS sum_delta, b.batt - COALESCE(e.d,0) AS diff
  FROM public.batt_account b
  LEFT JOIN (SELECT uid, SUM(delta) AS d FROM public.batt_entry GROUP BY uid) e ON e.uid = b.uid
 WHERE b.batt <> COALESCE(e.d,0)
 ORDER BY b.uid;
```

- 表形态现取：`0029_batt_checkin.sql:79-94`（`batt_account.batt` + `batt_entry(uid, delta, batt_after, …)`，`batt_entry_after_guard CHECK (batt_after BETWEEN 0 AND 100)`）。同一不变量在 `docs/OPEN-ITEMS.md` B25 行记为「`batt_account` vs `batt_entry` **56/56 全满足**」。
- **期望：0 行**。**现取：0 行**（覆盖 19 个 `batt_account` 行 / 24 条 `batt_entry`）。
- **阈值**：`count(*) > 0` 即 FAIL。
- 加一条**只读旁证**（可选，成本 0）：`batt_after` 链自洽 —— `MAX(batt_after)` 不得越界，且每 uid 最后一条 `batt_after` 应等于 `batt_account.batt`。前者已由 DB CHECK 兜底（`23514`），后者与上面主检查等价，**v1 不必单列**。

### 3.4 ❌ 不进 v1 的一条：事件级配对不变式（附现取反证）

`docs/qa/p4-b3-funds-qa.md:126` 曾记「逐事件 `Σ(delta+frozen_delta) ≠ 0`（**排除**含 mint/burn 的事件）= **0 个根键**」（当时 `ledger_entry` = 189~197 行）。**今天同样口径跑出来不是 0**：

```
按 (ref_type, ref_id) 分组：28 个非零根键
   currency 12 / job 7 / market_trade 8 / ref_type IS NULL 1（net +105,543 · 25 腿）
按 idempotency_key 去 #N 后缀分组：59 个非零组
   例：biz:currency:create:N1A0T203917 ⇒ net +9999（1 腿）
        biz:job:settle:19            ⇒ net +100000（2 腿）
        biz:listing:buy:6            ⇒ net −2（1 腿）
```

- 同期 `account ↔ ledger` **严格闭合**（逐户 0 漂移；全局 `Σ(balance+frozen) = Σ(delta+frozen_delta) = 378,897`）⇒ **不是账做错了**，而是**存在单腿残差行**（形如 `ops:p3j:…:fund:<uid>:970001#2`，对侧腿落在夹具号段 `970001`，随「只搬 C 类行」未迁入——与 B22/S54 同源，此归因为**推断、未单独取证**）。
- **结论**：该口径**今天不可作为 0 行闸**（上线即 28 条告警）。**v1 排除**；若将来要收，必须先落一份「已知非零根键白名单」再做增量判据，属另一单。

### 3.5 落地前的 0 改动桥（方案 C，今天可跑）

```bash
cd ops/bttc-recon-cadence/readings && node recon-readonly.cjs
# 串从 ~/.config/seafood/prod-db.env 读入（600 · 单键 DATABASE_URL_UNPOOLED）· 永不打印 · 只发 SELECT
# 产物：recon-prod-<ts>.json（本轮 = recon-prod-2026-10-17T021208235Z.json）
```

用途：**在写任何代码前，把 §3.1 的基线常量用真读数钉死**（今天 = `cid 1 → 2000000`）。这条正好回应「先有读数、后有门」的顺序纪律。

---

## 4. 告警面代价对比

| 通道 | 需要什么 | 改动量 | 缺口 / 风险 | 结论 |
|---|---|---|---|---|
| **仅日志**（`console.error` + 返回 500） | 无 | **0 行** | Vercel 运行时日志保留期短、且**没人看**；但 500 会让 cron dashboard 变红 | ✅ **必做（成本 0，作为兜底一层）** |
| **Telegram** | `TELEGRAM_BOT_TOKEN`（**生产 Vercel env 已有**，A5 已在用）+ 一个 `tg_user_id` 绑定的管理员 | ≈15 行（`sendTelegramReply(chat_id, text)`，`telegram-service.ts:238`） | **缺 token ⇒ 该函数自己 `console.warn` 后 `return`**（`:239-241` 现取）⇒ **降级为日志是既有行为，不需要额外代码** ⇒ 正合「env-gated」纪律 | ✅ **推荐主通道** |
| 邮件 | 本仓**零邮件基础设施**：`backend-ts` 内 `resend`/`sendgrid`/`nodemailer`/`smtp` 命中 **0** | 新 provider + 新 secret + 新依赖 + 新失败面 | 为一个日级对账引入第三方发信依赖，收益 ≪ 代价 | ✗ |
| 站内（后台页） | ① 结果要**落库**（新表或 `audit_log` 写）② 后台页（`frontend/src/pages/admin/` 现有 14 页，新增 1 页）③ **四语键同补**（任一语多/少一键即红） | **1–2 人日 + 1 条迁移 + 四语键 + 路由登记 + 门套** | 触碰「写库」与「数据模型」，与本单「最小改动」正相反；且夜间无人看后台 ⇒ 告警时效最差 | ✗（v1） |

**建议的告警形态（三段，全部零新增凭据）**：

1. **状态码即告警**：发现 drift ⇒ `500` + 结构化 JSON（`{verdict:'DRIFT', checks:[…]}`）。Vercel cron 面板立刻红；若套餐带 cron 失败通知，这是**免费的第二通道**。
2. **Telegram 主动推**：`sendTelegramReply(adminTgUid, 一行摘要 + 首条 diff)`。目标 uid 的取法 = 只读查 `users WHERE tg_user_id IS NOT NULL` 且是管理员（`0046_telegram_binding.sql:6` 记 `tg_user_id` 为数字 ID；`0046:14-15` 记解绑即置 NULL ⇒ 读侧自然排除未绑定者）。**零绑定 ⇒ 跳过、只留日志**。
3. **函数日志**：无论成败都 `console.log` 一份完整读数（drift 全绿时也是证据）。

⚠ 一处诚实边界：Telegram 侧「管理员已绑定」这件前提**今天无法离线确认**（要读 `users.tg_user_id`，属生产库读数）。本轮只读探针**没有**查它 —— 因为与本单「对账口径」无关，且绑定关系随时可解绑。落地时该行必须有 `null` 分支。

---

## 5. 风险与前置

### 5.1 只读 vs 写库（红线）

- 三条检查 **全部 `SELECT`**，无 `INSERT/UPDATE/DELETE`、无 `ledger_post_event`、无事务。
- 端点只读 ⇒ **不满足 `db.ts` R55「写操作必须交互式事务」的场景**，走 `readQuery`（`:226`，只读池，串优先 `DATABASE_URL` pooler）。这是正确的层，不是绕闸。
- **v1 明确不做「记录上次运行结果」**：那需要一个写口（新表 / `app_config` / `audit_log`），会把一个只读任务变成写任务，且 `app_config` 有 `app_config_value_is_container` 约束（`0017_platform_config.sql:77`，value 只收 object/array）。**代价可接受**：drift 是「当下是否闭合」，不需要历史曲线；要历史就查 Vercel 日志。
- **不做增量对账（Δ 对账）**：Δ 口径天然免疫 §3.1 的基线常量，但它需要「昨天那一份」= 又一次写库。故 v1 用「绝对值 + 基线常量」，把 Δ 留给有存储时的 v2。

### 5.2 生产凭据怎么给

- 本机既有存档：`~/.config/seafood/prod-db.env`，现取 **`-rw------- (600)`、单键 `DATABASE_URL_UNPOOLED`**（`ls -l` + `grep -o '^[A-Z_]*='`，**值从未打印、也没进过命令行**）。
- **助手纪律**：读文件 → 直接喂给驱动的 `neon(url)` → 只打印读数。本报告所有数字都是这么来的。
- **方案 A 在生产侧不需要这份凭据**：Vercel 函数自带 env。**这是 A 相对 B/C 的硬优势**。
- **方案 C 才需要**：本机脚本 subshell 内 `set -a; . <env>; set +a`（技能自带 `apply-migration.sh` 同体例），串不进命令行、不进会话环境。

### 5.3 cron 超时 / 并发

| 项 | 现取 | 判断 |
|---|---|---|
| 单条检查耗时 | 供应量 **162 ms** / 逐户 **163 ms**（HTTP 驱动、生产库；`ledger_entry` 271 行） | 三条合计 **< 0.6 s** |
| 函数超时 | Vercel 函数默认上限（Hobby 级 10 s，未在本仓现取） | 余量 ≥ 15× |
| 并发 | 与既有 cron 同刻会并发两发函数 | **错开到 `30 18 * * *`**（既有 `0 18 * * *`） |
| 幂等 | 纯只读 ⇒ 重入、连跑、手动触发均无副作用 | 无需幂等键 |
| 数据量风险 | 现在是 271 行；`idx_ledger_uid_cid_txid` 支撑逐户聚合并行 | 到 10⁶ 行级仍是秒级；届时再谈物化 |

### 5.4 误报处置流程（写死，别现场发明）

1. **先复核，不改阈值**：跑 `readings/recon-readonly.cjs`（同一份 SQL、同一把尺子）确认是同一读数 —— 排除「尺子/取数路径写错」（本仓历史上「取数路径写错 ⇒ 判负恒真」踩过）。
2. **分类**：
   - 良性（新夹具、搬数、一次性订正）⇒ **改基线常量 + 在 `docs/OPEN-ITEMS.md` 留痕**（写明旧值/新值/原因/日期）。**不改 SQL，不放宽容差。**
   - 真漂移 ⇒ 走 B25 已定的处置三道：① 一次性订正计数器 ② 根因修复（负向调分改走 `op='burn'`）③ 加守卫。
3. **禁止**：把 `>` 放宽成 `>=`、把阈值调大、给检查加 `try/catch` 静默吞掉、把 FAIL 改成 SKIP。历史纪律：**环境性 FAIL 原样保留 + 写明归因**。

### 5.5 其它前置（都是「不做就会白干」的）

- **门常量必须同批前推**：新注册点 ⇒ `p7b-03-offline-gates.ts:145` 的 `regs === 105` 必红。现取复算：`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` = **105**（get 45 / post 56 / put 0 / delete 3 / patch 1）。改后 = **106（get 46）**。
- **`vercel.json` 是 legacy `builds` 形态**（`builds` + `routes`，不是 `rewrites`）：cron 能否在该形态下正常注册，**只能上线后现取验证**（`vercel crons ls` 或 dashboard）；离线无法证明。**这是本方案唯一的「上线才知道」项**，需在验收清单里单列。
- **push = 上线**：本单含 `vercel.json` 与 `backend-ts/src` 改动 ⇒ 一旦 push 即生产部署；但**零迁移** ⇒ 不存在「代码先上线、迁移未 apply」的时序风险。
- **Hobby 套餐 cron 上限 2 条**（本仓已占 1）⇒ 落地前需用户确认套餐档位（未现取）。

---

## 6. 明确不建议做的事

### 6.1 ❌ 字段级加密（`account.balance` / `currency.total_supply` / `app_config.mint_burn_policy` / `ledger_entry.delta`）

**一句话理由**：加密挡不住它想挡的那个威胁 —— 库/备份/凭据泄露时，解密密钥必然与库凭据同域存放（同一份 Vercel env / 同一台机器），泄露即同获；而代价是**全链改（写路径 + 读路径 + 比对口径）+ 三条不变量全部重做 + 数值列上的索引与聚合直接失效**（`idx_account_cid_balance`、`idx_ledger_uid_cid_txid`、`SUM(delta)`、`CHECK (balance >= 0)` 全部要改成密文/信封字段才有意义）。

配套事实（本报告已取的部分）：`account.balance` 有 `CHECK (balance >= 0)`（`0001:41-49`）、`currency` 有 `supply_guard`、`ledger_entry` 有 `ledger_move_guard` / `ledger_after_guard`（同文件 `:55-80`）—— 这些闸全都建立在**数值列可比较**这个前提上。真要加密，等于把「DB 兜底」这一整层换成应用层密码学，**风险不降、攻击面反增**。

Kevin 已裁定「暂时明文」，与本结论一致；本报告只补一句边界：**该裁定成立的前提是「先有对账守卫」，而不是「先有加密」** —— 本单正是那个守卫。

### 6.2 ❌ 「先把事件级配对不变式也加进日检」

现取有 28 个非零根键（§3.4）。加进去 = 上线第一天 28 条告警 ⇒ 通道在三天内被静音 ⇒ **等于没做**。等有白名单基线再谈。

### 6.3 ❌ 「顺便修掉 translate/backfill 的 POST/GET 错配」

`vercel.json` 那条 cron 大概率从未生效（§1.2）。修它是正确的事，但它**会把本单的验收面从「对账是否跑通」扩到「翻译 backfill 是否恢复」**，两件事的判据、风险、回滚路径都不同。**另立单**。

### 6.4 ❌ 「用 `p8-s9-bttc-gate.ts` 当日常对账」

它是**门**，不是**对账**：会上 pgbouncer 事务、写夹具、末尾 `ROLLBACK`（`p8-s9-bttc-gate.ts:409` 逐字：「库面写一律事务内 + 末尾 ROLLBACK」），且部分判据需要受控实例。拿它天天打生产 = **每天在生产库写一遍再回滚**，`ledger_entry.txid` 序列还会被推进（`p9-s4-bttc.md:349` 已登记该现象）。**日常对账必须是纯 SELECT。**

---

## 7. 一页实施清单（若 Kevin 批 A）

```
[ ] 1. backend-ts/src/ops-recon.ts              新建 · 三条 SELECT + 判定 + 告警分发
[ ] 2. backend-ts/src/index.ts                  +app.get('/api/ops/recon/ledger') · CRON_SECRET 三段式
[ ] 3. backend-ts/scripts/p7b-03-offline-gates.ts:145   105 → 106（+ 注释链等行数追加）
[ ] 4. vercel.json                              crons += {"path":"/api/ops/recon/ledger","schedule":"30 18 * * *"}
[ ] 5. 本地先证：curl -H 'Authorization: Bearer <CRON_SECRET>' localhost:5788/api/ops/recon/ledger
        (dev 库读数 ≠ 生产读数 —— dev 是另一份 Neon，数字不可比，只验链路)
[ ] 6. push 后现取：vercel crons ls / dashboard 确认该 cron 已注册（legacy builds 形态的唯一未知项）
[ ] 7. 次日 02:30 CST 现取函数日志里的 verdict + 三条读数
[ ] 8. 误报预案落 docs/OPEN-ITEMS.md（基线常量 cid=1 = 2000000 的出处与改法）
```

**不做的**：迁移 / 前端 / i18n 键 / 站内页面 / 写库 / 字段级加密 / GitHub Actions / 修 backfill 的 POST 错配。

---

## 附录 A · 本轮读数清单（可复核）

| 文件 | 内容 |
|---|---|
| `readings/recon-readonly.cjs` | 只读对账探针（6 组 SELECT；串从 env 文件读、永不打印） |
| `readings/recon-prod-2026-10-17T021208235Z.json` | 主读数：identity / counts / schema_top / supply_recon / account_drift / batt_drift / event_pairing / kinds / bttc_row / policy |
| `readings/drill-event-pairing.cjs` + `drill-2026-10-17T021226656Z.json` | 事件级配对为什么非零（逐腿样本） |
| `readings/drill-global-2026-10-17T021235342Z.json` | 全局闭合：`acct_total 378897 == ledger_total 378897`；单腿 kind 分布 |

## 附录 B · 取证命令（本报告每个数字的出处）

```bash
# 生产身份 / 行数 / 三条对账读数（只读）
cd ops/bttc-recon-cadence/readings && node recon-readonly.cjs
# 现取：identity = {"project_id":"sweet-pond-28934105","branch_id":"br-delicate-fire-b3m3upi5","db":"neondb"}
#       schema_top = 0048 / 0047 · counts = currency 1 · ledger_entry 271 · account 25 · batt_account 19 · batt_entry 24

# 唯一 cron + 它的注册形态
sed -n '/crons/,/]/p' vercel.json
grep -n "api/translate/backfill" backend-ts/src/index.ts     # 仅 3131 行 app.post ⇒ cron(GET) 落 404

# 符号约定勘误
grep -n -A2 'KI2' docs/audit/p9-s4-bttc.md | sed -n '1,20p'  # :324 原式 Σmint − Σburn 弄反了符号
grep -n 'sumMint' backend-ts/scripts/p8-s9-bttc-gate.ts       # :683/:708 现役 = supply == sumMint + sumBurn

# 已知差额的既有登记
grep -n 'B25' docs/OPEN-ITEMS.md                              # 守卫须换算的已知差额 = 2,000,000

# 注册点基线（改前）
grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts    # 105（get45/post56/put0/delete3/patch1）
grep -n 'regs === 105' backend-ts/scripts/p7b-03-offline-gates.ts        # :145 AC10-2

# 无 CI / 无邮件通道
ls .github            # No such file or directory
grep -rn -i 'resend\|sendgrid\|nodemailer\|smtp' backend-ts/src backend-ts/package.json   # 0 命中

# 凭据存档（只看权限与键名，不看值）
ls -l ~/.config/seafood/prod-db.env && grep -o '^[A-Z_]*=' ~/.config/seafood/prod-db.env
```

## 附录 C · 本轮未取证项（诚实登记）

| 项 | 为什么没取 | 影响 |
|---|---|---|
| Vercel 套餐档位（决定 cron 条数上限 2 / 40） | 需 CLI 或后台，本单禁改配置 | 若为 Hobby ⇒ 加这条正好到顶，之后的 cron 需先腾位 |
| `vercel.json` legacy `builds` 形态下 cron 是否正常注册 | 只能上线后现取 | 方案 A 的唯一「上线才知道」项 |
| 生产 `users.tg_user_id` 的绑定现状 | 与对账口径无关，且随时可变 | 告警必须带「零绑定 ⇒ 只留日志」分支 |
| 单腿残差行的完整归因（是否 100% 来自「只搬 C 类行」） | 需逐行核对迁移清单，超本单范围 | §3.4 已标为**推断**，并据此把该检查排除出 v1 |
