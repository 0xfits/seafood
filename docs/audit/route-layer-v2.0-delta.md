# route-layer.spec **v2.0** delta 件（两条小订正 + 一条确认 —— Zang 自我更正 + 载体定层 + 措辞确认）

> **作者角色** = **Jing（Specifier · 制度员）** ｜ **日期** = 2026-10-02（CST / UTC+08:00）
> **性质** = **只追加单 · 零代码 · 零迁移 · 库面只读 · 零 HTTP**
> **依据** = 本单派单（Zang 自我更正 ①②③ 逐字）＋ 既有批 7-B 产物（`backend-ts/.p7b-artifacts/p7b-07-ac11-collect1.json` + `p7b-08-e2e-http-collect1.json` + 探针脚本 `backend-ts/scripts/p7b-07-ac11.ts` · `p7b-08-e2e-http.ts`）
> **交付物** = `docs/route-layer.spec.md`（就地升 **v2.0**）+ `docs/versions/route-layer.spec.v2.0.md`（快照）+ 本件

---

## §D0 读数（口径逐字 · 退出码一律不取管道之后）

### D0.1 开工前锚（**先对锚、后动手**）

| 项 | 命令 | 读数 | 判定 |
|---|---|---|---|
| 分支 | `git rev-parse --abbrev-ref HEAD` | `main` | ✅ |
| 本册行数 | `wc -l docs/route-layer.spec.md` | **3596** | 与派单相符 ✅ |
| 本册字节 | `wc -c docs/route-layer.spec.md` | **768417** | 与派单相符 ✅ |
| 本册 md5 | `md5 -q docs/route-layer.spec.md` | **`7ded449b2e2e2f3b611172177df925ec`** | 与派单相符 ✅ |
| 快照惯例 | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.9.md` | **0（identical）** | 惯例 = 「**新版本号 + 改后正文**」⇒ 本单照做 ✅ |
| 旧快照 | `ls docs/versions/` | route-layer **v0.1–v1.9 十九个快照齐** | ✅ |

### D0.2 改后读数

| 项 | 读数 |
|---|---|
| 本册行数 | **3661**（`wc -l docs/route-layer.spec.md`） |
| 本册字节 | **787963**（`wc -c`） |
| 本册 md5 | **`1448107be1a418fbc577db61cd98e84f`** |
| 快照 | `docs/versions/route-layer.spec.v2.0.md` —— `wc -l` = **3661** / `wc -c` = **787963** / `md5` = **`1448107be1a418fbc577db61cd98e84f`**；`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.0.md` = **0（identical）** ✅ |
| **只追加判据（机器）** | `git diff --numstat docs/route-layer.spec.md` = **`194` / `0`** ⇒ **删除列 = 0** ✅（其中 v1.9 自带 `129/0`，本单净增 = `194 − 129 = 65` 行） |
| **独立复核（更强 · 非 `git`）** | `difflib.SequenceMatcher(a=v1.9, b=v2.0)`：**opcode 计数 = `{'equal': 6, 'insert': 5}`**（**无 `replace`、无 `delete`**）、**纯插入 = 65 行**、`old=3596 / new=3661` ⇒ **v1.9 正文一字未删、一字未改** ✅ |
| 旧快照 | **v0.1–v1.9 十九个快照一字未动**（`git status --short docs/versions/` 仅 `?? …v1.9.md` / `?? …v2.0.md`（前件为本单开工前既存未跟踪件））✅ |
| 写盘范围 | `git status --short`（tracked）⇒ 仅 ` M docs/route-layer.spec.md`；本单 untracked = `docs/versions/route-layer.spec.v2.0.md` + `docs/audit/route-layer-v2.0-delta.md`（**本件**） |

### D0.3 新增 / 改动落点行号（**改后 · 现取**）

| 节 | 行号 | 备注 |
|---|---|---|
| 顶部 **v2.0 状态块** | **:173–179**（状态行 `:173` / 修订入口 `:174` / 要点标题 `:175` / 要点 ①–④ `:176–179`） | **纯插入** |
| **§8.1 表 v2.0 行** | **:1784** | **纯插入**（v1.9 行 `:1783` 一字未动） |
| **§8.22（新）** | **:2511–2545** | 声明 / `NOT_MEASURED` 五项 / 自曝 5 条 / delta 对照 / 纪律自检 |
| **§12.5 v2.0 就地加注** | **:3108–3115**（`:3116` 空行） | **纯插入**（§12.5 表 `:3050–3062` 一字未动；§12.6 现起于 `:3117`） |
| **§12.11.6 v2.0 就地加注** | **:3393–3404**（`:3405` 空行） | **纯插入**（AC-11…AC-13 表体 `:3314–3317` 一字未动；§12.11.7 现起于 `:3406`） |

---

## §D1 逐条 delta（依据 → 裁定 / 事实 → 落点）

### delta ① **AC-11 期望订正**（Zang 自我更正 · 派单 ①）

- **旧写法（保留不删 · 逐字）** = **AC-11 行期望列**（原 `:3314`）：「**恰一次生效**：恰一笔 `200`（`purchase_refund ×2`）+ 另一笔 **`409` `LEDGER_CURRENCY_INVALID_TRANSITION`**（`details.field='listing_order.status'`；`reason='order_not_refundable'` ⇒ 驱动相关、`NOT_MEASURED`）**或** `200` + `idempotent_replay:true`（若第二笔落在首笔提交后 ⇒ 只读根键探测命中，`0015:677-678`）」。
- **作废（Zang · 逐字）**：**「另一笔 `409 LEDGER_CURRENCY_INVALID_TRANSITION`」这一预期作废**（**派单写错**）。
- **真因（逐字）**：**退款幂等键由 `order_id` 派生**（`biz:listing:refund:<order_id>`，`0015:667`）⇒ **并发两笔同订单 ⇒ 必同键 ⇒ 第二笔是幂等重放**（`0015:673-676` 只读根键探测命中 ⇒ `v_replay`）。
- **正确期望（写死 · 逐字）**：**「另一笔 = `200` + `idempotent_replay:true`（且 `txid` 与首笔逐字相同）」** —— **比 `409` 更好**：不报错、不双扣。
- **保留（逐字）**：AC-11 判据两条原样保留 —— **「资金腿恰一次」**（判据 ① `Δpurchase_refund` 恰 `+2`）+ **「审计行恰 1 行」**（判据 ③ `result='applied'` 恰 1 行）。
- **实测佐证（本册现取 · 转引）**：`backend-ts/.p7b-artifacts/p7b-07-ac11-collect1.json` ⇒
  - `criterion_iii_concurrent = { a: { outcome:"ok", result:"applied", idempotent_replay:false, txid:"341" }, b: { outcome:"ok", result:"applied", idempotent_replay:true, txid:"341" } }` ⇒ **第二笔 `replay`、`txid` 与首笔逐字相同（`341`）**；
  - `deltas = { purchase_refund:2, rootkey_rows:2, audit_applied:1, audit_rejected:0, sum_cid1_shift:"0", order_status_after:{status:"refunded", refund_txid:"341"} }` ⇒ **资金腿恰一次（+2）+ 审计行恰 1 行 + `Σ(cid=1)` 零位移 + 订单恰转 `refunded` 一次**。
  - **实测载体 = DB 函数调用层**（`SELECT public.listing_refund_post_event($1::jsonb)`，两会话并发；转引 `backend-ts/scripts/p7b-07-ac11.ts:27-28,78-79`）。
- **落点**：**§12.11.6 v2.0 加注 `:3393–3404`**（＋ **§8.22.3-② / §8.22.3-④** 自曝；**顶部 v2.0 状态行一并声明**）。
- **同源旧写法（4 处 · 原文逐字未动 · 一律以本加注为准）**：§12.6 v1.6 加注 `:3082` / §12.9 v1.6 加注 `:3128` / 顶部 v1.6 块 ⑨ `:136` / §12.11.7 · Z8 登记行 `:3175`。
- **不涉本订正**：**AC-11 判负自证行**（原 `:3315`）与其 **v1.9 可复现三条加注**（原 `:3327–3338`）**一字不变**（本订正只改「另一笔」期望，**不改判据列、不改判负自证**）。

### delta ② **「同键异内容 ⇒ `409`」载体定层 = DB 层**（Zang 裁定 · 派单 ②）

- **旧写法（保留不删 · 逐字）**：**§12.5 表**「同键异内容 ⇒ **`409` `LEDGER_IDEMPOTENCY_CONFLICT`**（`details.reason = 'REPLAY_FINGERPRINT_MISMATCH'`；`i18n_key = ledger.err.LEDGER_IDEMPOTENCY_CONFLICT`）」（原 `:3058`）+「同键异内容在本面的可达性（诚实边界）」行「**结构性不可达**：指纹只由 `order_id` 派生，而键也由 `order_id` 派生 ⇒ 同一订单 ⇒ 同键必同指纹」（原 `:3059`）—— **均未指明层**。
- **定层（Zang · 逐字）**：**正式载体 = DB 层**（编排函数 `public.listing_refund_post_event(jsonb)` 入口的幂等指纹闸 —— 同键异指纹 ⇒ `LD003`）。
- **实测（本册现取 · 转引）**：`backend-ts/.p7b-artifacts/p7b-08-e2e-http-collect1.json` 的 `item8_same_key_diff_content_db` ⇒ `{ error: { sqlstate: "LD003", message: "LEDGER_IDEMPOTENCY_CONFLICT", detail: "{\"actual\": \"p7b:DIFFERENT-FP\", \"expected\": \"77b48b2e62c4c75ae34ee50d268294aec1a43ec3b864587ec8ed8f10ec2934a4\", \"idempotency_key\": \"biz:listing:refund:8\"}" } }` ⇒ **`LD003` = `LEDGER_IDEMPOTENCY_CONFLICT`（§3.2 映射 `409`）**。
  - **构造载体** = 直呼函数并显式传异指纹（`SELECT public.listing_refund_post_event($1::jsonb)`，入参 `request_fingerprint = 'p7b:DIFFERENT-FP'`、同键 `biz:listing:refund:8`）；转引 `backend-ts/scripts/p7b-08-e2e-http.ts:82-92` 其行内注「**⑧ 同键异内容 ⇒ 409：HTTP 面 fp 由服务端派生 ⇒ DB 层等价构造**」。
- **HTTP 面 = `NOT_APPLICABLE`（写死 · 带原因）**：本路由的幂等键与请求指纹**同由 `order_id` 派生**（键 `biz:listing:refund:<order_id>` `0015:667`；指纹 `sha256('listing.refund' | <order_id>)` `src/listing-funds-service.ts:300`）⇒ **同订单 ⇒ 必同键且必同指纹 ⇒ 同键异内容在 HTTP 面构造不出** ⇒ **该面在 HTTP 层判为 `NOT_APPLICABLE`**（≠「未测」、≠「契约不成立」）。
- **契约仍成立且可判负（不变）**：**判负对象 = 实现方改了键 / 指纹的派生输入**（= **AC-10 判负对象**）。
- **落点**：**§12.5 v2.0 加注 `:3108–3115`**。

### delta ③ **AC-13⑥ 措辞确认**（Zang 确认 · 派单 ③）

- **被确认的措辞（v1.9 已落 · 逐字）**：① **路由分支已删除（本仓禁死代码）**；**且** ② **`NOT_ADMIN` 常量仍保留**（它属**既有 admin 面**的 `reason`、**不在本路由使用**）。
- **确认（Zang · 逐字）**：**该措辞正确**。
- **就地补此一句（不改小节）**：「**删的是「本退款路由内」的不可达死分支**（AC-13⑥ 构造上不可达 ⇒ 禁死代码）；**保的是 `AUTH_REASONS` 闭集常量本身**（`src/index.ts:254`，**3 值**，`NOT_ADMIN` 供**既有 admin 面**使用）」⇒ **两句并列、不矛盾**；**本路由实际只返两 `reason`**：`ACTOR_NOT_ALLOWED`（非卖方非 admin · AC-13④）/ `PERMISSION_NOT_GRANTED`（admin 缺 `manage_points` · AC-13⑤）。
- **落点**：**§12.11.6 v2.0 加注 `:3403–3404`**（**AC-13 表体一字未动**；**⑥ 行留痕**）。

### delta ④ **变更记录 / 快照 / delta 件**

- **§8.1 v2.0 行** `:1784` ＋ **§8.22（新）** `:2511–2545`（声明 / `NOT_MEASURED` 五项 / 自曝 5 条 / delta 对照 / 纪律自检）。
- **快照** = `docs/versions/route-layer.spec.v2.0.md`（`cmp` = 0）。
- **delta 件** = 本件 `docs/audit/route-layer-v2.0-delta.md`。

---

## §D2 `NOT_MEASURED`（未测项 · 禁填 0 / 空）

| # | 未测项 | 原因 |
|--:|---|---|
| ① | **AC-11 期望订正的 HTTP 行为面** | 本册**零 HTTP**；实测证据为**函数调用层**（`p7b-07`），非 HTTP ⇒ 行为面 `NOT_MEASURED` |
| ② | **`p7b-07-ac11-collect1.json` 派生布尔 `verdict_iii.exactly_one_effective = false` 的成因** | 该布尔与同一件的 `deltas` **不自洽**；脚本 `p7b-07-ac11.ts` 正被并发改写 ⇒ **不解释**，归因 `待 Zang 确认` |
| ③ | **「同键异内容」在 HTTP 面的正向探测** | 本册**零 HTTP**；`NOT_APPLICABLE` 由**派生同源（键 ∧ 指纹皆由 `order_id` 派生）** 静态得出 ⇒ 运行时探测 `NOT_MEASURED` |
| ④ | **服务层 `listing-funds-service.ts:62` / 路由闸的当前落点** | `backend-ts/**` **正被 Kong 并发改写**（行号是移动靶）⇒ **不现取行号** |
| ⑤ | **`docs/data-layer.spec.md` 是否登记 `LD003` 载体口径** | 本册**禁改**该件、**未读改** ⇒ `NOT_MEASURED` |

---

## §D3 自曝 / 口径缺陷

| # | 项 | 处置 |
|--:|---|---|
| ① | 「就地订正」与「删除列 = 0」不可兼得（承 v1.8 §8.20.3-① / v1.9 §8.21.3-①） | 取机器判据优先：**§12.5 / §12.11.6 表体与正文一字未动**，订正由就地加注行承载 + **旧写法逐字引在加注内 ⇒ 留痕成立** |
| ② | AC-11 的 `409` 是「派单写错」而非「实现走偏」 | **原期望行（含 `409`）保留不删**；订正由 §12.11.6 v2.0 加注承载；**不改判据列 / 不改判负自证行** |
| ③ | 同源旧写法散落 4 处未逐处改 | **一律以 §12.11.6 v2.0 加注为准**；4 处原文逐字未动（**避免多处重写破坏只追加**） |
| ④ | `verdict_iii.exactly_one_effective = false` 与自件 `deltas` 不自洽 | **不解释、不发明原因**；**AC-11 口径只取 `criterion_iii_concurrent` + `deltas`**（见 §D2-②） |
| ⑤ | 并发写者 ⇒ 行号锚点是移动靶（承 v1.8 §8.20.3-⑥ / v1.9 §8.21.3-⑤） | **不把任一 `backend-ts/**` 静态行号冒充现盘**；引用行号均标「转引 / 现取于产物」 |

---

## §D4 纪律自检（逐条对照硬口径与派单纪律）

① **身份表写 `users`** ✅（本单**零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（本单**无 SQL**；引用键 `SELECT public.listing_refund_post_event($1::jsonb)` 逐条 `public.`）｜③ **只追加 / 删除列 = 0** ✅（`numstat = 194 / 0`；difflib `{'insert': 5}`、**0 replace / 0 delete**、净增 65 行）｜④ **快照惯例已先校验** ✅（开工前 `cmp` vs v1.9 = 0；改后 `cmp` vs v2.0 = 0）｜⑤ **v0.1–v1.9 十九个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 行 + §8.22）｜⑦ **不得改**（任何代码 `backend-ts/**`·`frontend/**` / `migrations/**` / 其它 spec / `docs/design/**` / `docs/seafood.master-plan.md` / `docs/audit/**` 既有件 / `docs/qa/**`）✅（**全部零改动**；本单只新建本 delta 件 + v2.0 快照）｜⑧ **无 `git add/commit/push` / 无 `npm install` / 未碰 `.env*` / 未用 `pkill -f`·`killall` / 未启停 5787·5788** ✅｜⑨ **原始输出不用 `.log`** ✅（本单**无新原始输出**，只转引既有 `.json`）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（§D2 五项）｜⑪ **不确定处不二选一** ✅（派单 ①②③ 已给全；确实无先例处见 §8.22.2-②③ / §8.22.3-④）｜⑫ **报数带口径** ✅（§D0）｜⑬ **未发明任何规格值** ✅（`LD003` / `idempotent_replay` / `txid` 逐字 = **转引** `backend-ts/.p7b-artifacts/*.json` 现取；**无一处来自推断**）。
