# route-layer.spec **v1.9** delta 件（两批落地事实与 Zang 终审回写）

> **作者角色** = **Jing（Specifier · 制度员）** ｜ **日期** = 2026-10-02（CST / UTC+08:00）
> **性质** = **只追加单 · 零代码 · 零迁移 · 库面只读 · 零 HTTP**
> **依据** = 本单派单（Zang 终审 ①② 逐字）＋ 批 7-A（`docs/audit/p7-a-ledger-read-fix2.md`）＋ 批 7-B（`docs/audit/p7-b-errfallback.md` + `backend-ts/migrations/0024_admin_refund_audit.sql` + `backend-ts/.p7b-artifacts/p7b-00-recon-*.json`）
> **交付物** = `docs/route-layer.spec.md`（就地升 **v1.9**）+ `docs/versions/route-layer.spec.v1.9.md`（快照）+ 本件

---

## §D0 读数（口径逐字 · 退出码一律不取管道之后）

### D0.1 开工前锚（**先对锚、后动手**）

| 项 | 命令 | 读数 | 判定 |
|---|---|---|---|
| 分支 | `git rev-parse --abbrev-ref HEAD` | `main` | ✅ |
| 本册行数 | `wc -l docs/route-layer.spec.md` | **3467** | 与派单相符 ✅ |
| 本册字节 | `wc -c docs/route-layer.spec.md` | **739146** | 与派单相符 ✅ |
| 本册 md5 | `md5 -q docs/route-layer.spec.md` | **`3d44a3b242f3823ee3f6a4dfb0935933`** | 与派单相符 ✅ |
| 快照惯例 | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.8.md` | **0（identical）** | 惯例 = 「**新版本号 + 改后正文**」⇒ 本单照做 ✅ |

### D0.2 改后读数

| 项 | 读数 |
|---|---|
| 本册行数 | **3596**（`wc -l docs/route-layer.spec.md`） |
| 本册字节 | **768417**（`wc -c`） |
| 本册 md5 | **`7ded449b2e2e2f3b611172177df925ec`** |
| 快照 | `docs/versions/route-layer.spec.v1.9.md` —— `wc -l` = **3596** / `wc -c` = **768417** / `md5` = **`7ded449b2e2e2f3b611172177df925ec`**；`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.9.md` = **0（identical）** ✅ |
| **只追加判据（机器）** | `git diff --numstat docs/route-layer.spec.md` = **`129` / `0`** ⇒ **删除列 = 0** ✅ |
| **独立复核（更强 · 非 `git`）** | `difflib.SequenceMatcher(a=v1.8, b=v1.9)`：**opcode 计数 = `{'insert': 9}`**（**无 `replace`、无 `delete`**）、**纯插入 = 129 行**、`old=3467 / new=3596` ⇒ **v1.8 正文一字未删、一字未改** ✅ |
| 旧快照 | **v0.1–v1.8 十八个快照一字未动**（`git status --short docs/versions/` 除 v1.9 外为空 ✅） |
| 写盘范围 | `git status --short`（tracked）⇒ 仅 ` M docs/route-layer.spec.md`；本单 untracked = `docs/versions/route-layer.spec.v1.9.md` + `docs/audit/route-layer-v1.9-delta.md`（**本件**） |

### D0.3 新增 / 改动落点行号（**改后 · 现取**）

| 节 | 行号 | 备注 |
|---|---|---|
| 顶部 **v1.9 状态块** | **:163–171**（状态行 `:163` / 修订入口 `:164` / 要点标题 `:165` / 要点 ①–⑥ `:166–171`） | **纯插入** |
| **§12.3 v1.9 就地订正加注** | **:2982–2992** | **纯插入**（§12.3 G1–G6 表体 `:2915–2922` 一字未动） |
| **§12.11.6 v1.9 就地加注** | **:3327–3340**（含 **判据 ① 现取确认** `:3338`） | **纯插入**（AC-11…AC-13 表体 `:3250–3255` 一字未动） |
| **§12.13（新）** | **:3443–3461** | 迁移 `0024` 已 apply 事实（F-0024-1…9） |
| **§14.3（新）** | **:3537–3555** | 回退护栏纪律 + 132 键登记 |
| **§15.2 v1.9 就地加注** | **:3576–3577** | **纯插入**（§15.2 正文 `:3456–3460` 一字未动） |
| **§15.4（新）** | **:3585–3596** | 同族 `sendError` 26 处登记 + `:1482` 勘误（至 EOF） |
| **§8.1 表 v1.9 行** | **:1775** | **纯插入**（v1.8 行 `:1772` 一字未动） |
| **§8.21（新）** | **:2464–2501** | 变更记录与自曝 |

---

## §D1 逐条 delta（依据 → 裁定 / 事实 → 落点）

### delta ① **§12.3 G2 就地订正**（Zang 终审 · 本仓自身发现的真矛盾）

- **矛盾（本仓自身发现 · 逐字）**：**§12.3 G2**（`:2918`）对「**有 actor、`can_access_admin=false`**」写 `reason='NOT_ADMIN'`；而 **§12.11.6 · AC-13④**（`:3255`）与 **§12.12** 对**同一输入**（非卖方且非 admin）写 `reason='ACTOR_NOT_ALLOWED'` ⇒ **同一输入两种 reason = 真矛盾**；且 **AC-13⑥**（非 admin 但有 `manage_points`）**构造上不可达**。
- **裁定（Zang · 逐字）**：**以 AC-13（可证伪验收表）为准** ——
  1. **非卖方非 admin** ⇒ `403 AUTH_FORBIDDEN` + **`reason='ACTOR_NOT_ALLOWED'`**（取代 G2 旧写法）；
  2. **有 admin 但缺 `manage_points`** ⇒ `403` + **`reason='PERMISSION_NOT_GRANTED'`**（= G3，不变）；
  3. **`NOT_ADMIN` 不在本路由使用**（属既有 admin 面）；
  4. **不可达分支已删除（本仓禁死代码）**。
- **写法**：**就地加注订正 + 旧写法逐字留痕**（G2 行原文 + AC-13⑥ 行原文逐字引在加注内；**两处表体一字未动**）。
- **落点**：**§12.3 v1.9 加注 `:2982–2992`**（＋ §12.11.6 加注 `:3327–3338` 的 AC-13⑥ 同源订正）。
- **闭集不变**：`src/index.ts:254` 的 `AUTH_REASONS` 仍 3 值 ⇒ 本路由**不得返回 `NOT_ADMIN`**；新增第 4 值 / 新码 ⇒ 判负（AC-10）。

### delta ② **AC-11 判负口径改可复现三条**（Zang 终审）

- **原判负（保留不删 · 逐字）** = 「临时移除 / 停用 `0015:670` 的 `SELECT … FOR UPDATE` 行锁（仅测试环境、仅本用例、跑完必须还原）⇒ 必得 `Δpurchase_refund = +4`」。
- **改版理由（结构性不可行）**：该自证**需第二个库**（主库不得改既有行）**且需改已应用迁移**（`0015` 已 apply ⇒ 禁改）⇒ **不可复现**。
- **改版（三条可复现判据 · 逐字）**：
  1. **源码级**：`position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0`；
  2. **竞争实测**：两会话同订单并发 ⇒ **受害者阻塞时长 > 0**；
  3. **正向**：并发两笔同订单 ⇒ **恰一次生效**（另一笔 `409 LEDGER_CURRENCY_INVALID_TRANSITION`）+ **资金腿恰一次** + **审计行恰 1 行**。
- **登记（写死）**：「**`+4` 判负需第二个库 ⇒ 归 P8 前可选**」（**不再作为本 AC 的硬判负要求**）。
- **判据 ① 现取确认**：`backend-ts/.p7b-artifacts/p7b-04-recon2-collect1.json` ⇒ `for_update.pos_regproc = 4183` ⇒ **`position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) = 4183 > 0`**（**已证**）；**判据 ②③ = `NOT_MEASURED`**（竞争实测需两会话 + 测试环境）。
- **落点**：**§12.11.6 v1.9 加注 `:3327–3340`**。

### delta ③ **回退护栏（`ledger.err.*`）纪律 + 132 键登记**

- **新纪律（逐字 · 写死）**：**错误文案链必须保证：`t(i18n_key)` 未命中（返回裸键形态）时落四语通用兜底；用户可见文案不得出现 `x.y.z` 类裸键。**
- **真源** = `frontend/src/auth.js`（`resolveI18nMessage` 末道闸 + `isUsableText` 准入闸 + `looksLikeBareI18nKey` / `containsBareI18nKey`）。
- **可判负门** = `frontend/scripts/p7b-errfallback-gate.mjs`（转引 `docs/audit/p7-b-errfallback.md §4 G8` 的 PASS 读数：`D 节点=132 需护栏=132 已本地化=0`）。
- **登记**：**132 键（33 码 × 4 语）逐码本地化 = 产品/文案决策 ⇒ 登记 P6/P7 待定**（本单不补）；**护栏让位语义写死**（locale 补 `ledger.err.<CODE>` 后 `t()` 命中即用真文案、无需改代码）。
- **落点**：**§14.3（新）`:3534–3552`**。

### delta ④ **同族 `sendError` 26 处登记 + `:1482` 勘误**

- **口径（转引 `docs/audit/p7-a-ledger-read-fix2.md §5` · 本册不复算）**：`sendError` 定义 `backend-ts/src/index.ts:116-120` ⇒ 旧形状 `{success,message,error}`（非 R107）；全仓**实调用 = 26 处**。
- **登记结论**：**全部 26 处属既有面、本批只登记不修**；逐条清单**转引**报告 §5 表（本册不转抄其 26 行）。
- **点名（逐字）**：`POST /api/admin/points/adjust`（**注册行 `:1472`**）在 **`:1482`** 抛 `sendError(res, 400, '参数不完整')` ⇒ message = **硬编码中文「参数不完整」**、**非 R107 形状**。
- **勘误（写死）**：**先前引的 `:1477` 系早期 artifact 行号，已作废**；**行号以该报告现取 `:1482`（注册行 `:1472`）为准**。
- **落点**：**§15.4（新）`:3582–3593`** + **§15.2 v1.9 加注 `:3573–3574`**（v1.8 的「清单 = `NOT_MEASURED`」前提消失 ⇒ 读法更新；**§15.2 正文一字未动**）。

### delta ⑤ **迁移 `0024` 已 apply 事实**

- **现取（本册亲取）**：`schema_version=0024`（`applied_at 2026-10-02T08:01:41.542Z`）· checksum **`b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d`**（`shasum -a 256` 逐字相符）· 表 `admin_refund_audit_log` 在场 · 函数 `listing_refund_post_event` 在场（`post_event_functions` **5→6**）· 触发器 **44→45** · `Σbalance(cid=1)` = `1989693` **零位移**（改前 / 改后逐字相同）· **注册点仍 68** · **前端零改动**。
- **幂等佐证（F-0024-9 · 本册现取）**：`backend-ts/.p7b-artifacts/p7b-ac04-migrate-idempotent-ac04.json` ⇒ `ok = true`，`0024` 条目 = `{ action: "skipped", reason: "already applied, checksum match" }` ⇒ **迁移链重跑幂等、checksum 未漂移**。
- **落点**：**§12.13（新）`:3443–3461`**（F-0024-1…9；8 条为**事实行**，替代 I-9 / I-10 / I-13 的「待实现」态；其余实现项落地与否 = `NOT_MEASURED`）。

### delta ⑥ **变更记录 / 快照 / delta 件**

- **§8.1 v1.9 行** `:1775` ＋ **§8.21（新）** `:2464–2501`（声明 / `NOT_MEASURED` 六项 / 自曝 5 条 / delta 对照 / 纪律自检）。
- **快照** = `docs/versions/route-layer.spec.v1.9.md`（`cmp` = 0）。
- **delta 件** = 本件 `docs/audit/route-layer-v1.9-delta.md`。

---

## §D2 `NOT_MEASURED`（未测项 · 禁填 0 / 空）

| # | 未测项 | 原因 |
|--:|---|---|
| ① | **`0024` apply 后的 HTTP 行为面** | 本册**零 HTTP**（只读源码 / 只读 recon 产物） |
| ② | **服务层 `listing-funds-service.ts:62` 单点是否已升级（卖方 ∨ 管理员）** | 本册**未改、未测代码**；`backend-ts/**` **正被并发单元改写**（行号是移动靶） |
| ③ | **`docs/data-layer.spec.md` 是否已登记 `0024` 涉表** | 本册**禁改**该件、**未读改** |
| ④ | **26 处 `sendError` 的逐条行号 / message 现取复核** | **转引** `docs/audit/p7-a-ledger-read-fix2.md §5`（本册只转引计数结论 + 点名 1 处） |
| ⑤ | **回退护栏门的当日判负实跑读数** | 本册**不跑前端套件** ⇒ **转引** `docs/audit/p7-b-errfallback.md §4/§5` |
| ⑥ | **AC-11 竞争实测（两会话阻塞时长 / 并发恰一次）** | 需实现批 / 质检批在**测试环境**执行；本册**零库写** |

---

## §D3 自曝 / 口径缺陷

| # | 项 | 处置 |
|--:|---|---|
| ① | 「就地加注」与「删除列 = 0」不可兼得 | 取机器判据优先：**G2 / AC-13⑥ 表体一字未动**，订正由加注承载 + 旧写法逐字留痕（先例 v1.5 补注块 ⑳ / v1.7 补注块 ㉓ / v1.8 §8.20.3-①） |
| ② | §15.2 的 `NOT_MEASURED` 前提已消失 | fix2 报告已落盘 ⇒ **§15.2 加注就地更新读法**；**旧文保留不删** |
| ③ | `:1477` 是早期 artifact 行号 | 现取 = `:1482`（注册行 `:1472`）；旧引作废 |
| ④ | AC-11 原判负「`+4` 自证」结构性不可行 | 改可复现三条；**原判负行保留不删** |
| ⑤ | 并发写者 ⇒ 行号锚点是移动靶 | 只现取注册点计数（68）；点名行号标「转引 fix2 §5、以该报告现取为准」 |

---

## §D4 纪律自检（逐条对照硬口径与派单纪律）

① **身份表写 `users`** ✅（本单**零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（本单**无 SQL**；§12.13 引 `pg_get_functiondef('public.…')` 逐条 `public.`）｜③ **只追加 / 删除列 = 0** ✅（`numstat = 126 / 0`；difflib `{'insert': 9}`、**0 replace / 0 delete**）｜④ **快照惯例已先校验** ✅（开工前 `cmp` = 0；改后 `cmp` = 0）｜⑤ **v0.1–v1.8 十八个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 行 + §8.21）｜⑦ **不得改**（代码 / `migrations/**` / `data-layer.spec.md` / `ledger.spec.md` / `commission.spec.md` / `design/**` / `master-plan.md` / `audit/**` 既有件 / `qa/**`）✅（**全部零改动**；本单只新建本 delta 件）｜⑧ **无 git 写 / 无 `npm install` / 未碰 `.env*` / 未用 `pkill -f`·`killall` / 未启停 5787·5788** ✅｜⑨ **原始输出不用 `.log`** ✅｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（§D2 六项；无 0 / 无空）｜⑪ **不确定处不二选一** ✅（裁定 / 事实已给全；无「二选一」型未决）｜⑫ **报数带口径** ✅（§D0）｜⑬ **未发明任何规格值** ✅（`0024` 读数 = 现取；26 处 = 转引；护栏门读数 = 转引）。

> **★ 未取的实现面事实（诚实登记）**：批 7-B 的 `p7b-03-offline-gates` 产物含 **AC13-6「非 admin ⇒ `NOT_ADMIN`」** 一条（其自陈 = 「**构造上不可达分支，仅映射保留**」）—— 本册**登记该产物存在**，但 **`NOT_ADMIN` 在本退款路由的最终处置以 Zang 终审（delta ①）为准**（**该产物与本册口径不冲突**：二者均认定 `NOT_ADMIN` 分支在本路由**不可达 / 不启用**）。
