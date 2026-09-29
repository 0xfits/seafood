# route-layer.spec v0.2 → v0.3 · 逐条 delta 审计件

> **单**：Unit Jing-V0.3（规范改正与回写）· **角色** = **Jing（Specifier · 制度员）** · 2026-09-30 CST / UTC+08:00
> **成品**：`docs/route-layer.spec.md`（就地升 **v0.3**）＋ 快照 `docs/versions/route-layer.spec.v0.3.md`（`cmp` 自证一致）＋ 本审计件；**另追加式回写** `docs/ledger.spec.md`（就地升 **v0.13**）＋ 快照 `docs/versions/ledger.spec.v0.12.md`（＝改前主体）
> **唯一裁定来源**：`docs/seafood.master-plan.md` **§5.81**（`:1390-1399`，**Zang 自我勘误：§5.80 对 route-layer §7-3 的批准作废**）＋ **§5.80**（批 3 切片 3a–3d / 资金不变量 / token 新口径）
> **纪律**：逐条 delta **必带依据锚点**（`文件:行号` 或报告节号），**不凭记忆**；凡「实测」均可 `grep`/`sed` 复核（见 §2）；与 Zang 裁定冲突 ⇒ **以 Zang 为准**；无法调和 ⇒ §7 标 `待 Zang`（本册两处：**7-15 / 7-16**）

## §0 交付件与指纹

| 件 | 改前 | 改后 | 备注 |
|---|---|---|---|
| `docs/route-layer.spec.md` | v0.2 · md5 `0c587183a66ae39b597370acc08ac2fc` · 668 行 / 115905 B | **v0.3 · md5 `fa91425ed380423d0f01f577f0f53aa6` · 716 行 / 143415 B**（`md5`/`wc -l`/`wc -c` 现取） | 就地升版 |
| `docs/versions/route-layer.spec.v0.3.md` | — | 与上者**逐字节相同**（`cmp` exit 0） | 本单新建 |
| `docs/versions/route-layer.spec.v0.2.md` | md5 `0c587183a66ae39b597370acc08ac2fc` | **未动** | 既有快照 |
| `docs/versions/route-layer.spec.v0.1.md` | sha256 `6f27b4add4b7…b5018` | **未动** | 既有快照 |
| `docs/ledger.spec.md` | v0.12 · md5 `8ffb5fd5b711731ea65c317f18ec0f0d` · 2010 行 / 450638 B | **v0.13 · md5 `eee9f165704e100c98b3655d742d1ac2` · 2028 行 / 461344 B**（现取） | 追加式回写 |
| `docs/versions/ledger.spec.v0.12.md` | 不存在 | **改前主体**（md5 `8ffb5fd5…`，`cmp` 自证） | 本单新建 |
| 本文件 `docs/audit/route-layer-v0.3-delta.md` | — | 新建 | — |

**改前基线取材**：`git show HEAD:docs/route-layer.spec.md | md5` = `0c587183…`；`git show HEAD:docs/ledger.spec.md | md5` = `8ffb5fd5…` ⇒ 两册改前主体 == HEAD（**无未提交改动**），故 v0.2 / v0.12 快照可逐字节复现。

---

## §1 delta 逐条（**delta → 依据 → 改动位置**）

### D1 — §7-3 全面更正（**本单最重要**）
- **delta**：`listing_deposit` 由「纯冻结、可退（`hold_release`）＋ 违约罚没 `hold_forfeit`→`-3`」改为 **「上市即消耗 → 贷 `uid = -1`；不可退、无退还 kind、无罚没」**；**并显式登记**「v0.2 的『冻结可退』是**错误推断**，由 **Zang §5.81** 纠正；根因 = `HOLD_KINDS` 误含 `listing_deposit`（P1c 漏删），已由 `0019` + `ledger.ts` 手术修正」。
- **依据**：`master-plan:1390-1399`（§5.81 全文，含「我错在哪 / 真根因」）；铁证逐条 = `ledger.spec.md:79`（D7 行「❌ 已于 v0.2 被 Kevin 原文推翻」）、`:12`/`:13`/`:191`、`data-layer.spec.md:454`/`:530`/`:533`（DL67/DL88/DL91【已冻结】）、`ledger.ts:148-150`、`migrations/0003_kind_close_set_20.sql:5-8`；**真根因** = `ledger.ts:174-175`（`HOLD_KINDS` 原含 `listing_deposit`）。
- **改动位置**：`route-layer.spec.md` 文首「**★★ v0.3 本单要点**」（新增行）；**§7-3 行**（整行重写，含 `v0.2 旧写法（错，留痕）`）；连带 = §1.1 C2 行、§4.1（`hold` 家族 / `-1` 白名单 / `-3` 行）、§4.2 C2 行、§4.3 C2 四栏、§4.4-7、§4.6 批 3 行、§8.2b 对照表。

### D2 — 新增事件行：C1 / C2（已落地形态）+ **C3（退市/罚没）**
- **delta**：① C1/C2 由「**未实现**（无编排函数）+ 待定幂等键」改为**批 3a 已落地的完整事件行**（单语句 CTE、kind 与条数、必需字段、幂等键、失败/回滚、期望码、批标）；② **新增 C3 行** = 「退市 / 罚没」**P3 无此动作**（**不退、不罚、不建端点、不建幂等键**），并把「将来若做**强制下架罚款** = **新语义新 kind**，须单独裁定」写进 §7。
- **依据**：`p4-b3a-currency-funds.md §1`（C1/C2 表）、`§3.1-§3.3`（实现与幂等）、`§4 C1-T01..T11 / C2-T12..T22`（22 例）、`§5.3`（`-3` 账户 0→0）；`data-layer.spec.md:454`/`:530`/`:533`（DL67「下架无账务动作」/DL88「不可退、无罚没、无退还 kind」/DL91「`hold_forfeit` P3 不启用」）；`ledger.spec.md:492`（§7.2 #14）；裁定 = **Zang §5.81**。
- **改动位置**：`§4.2`（C1/C2 两行重写 + **C3 新行**）；`§7` 新增 **7-22**（退市/罚没口径已定）。

### D3 — §4.1 关闭集校正（`hold` 家族 − `listing_deposit`；`-1` credit + `listing_deposit`）
- **delta**：**`hold` 家族移除 `listing_deposit`**；**`-1` 可 credit 的 kind 加入 `listing_deposit`**；`-3` 行改标「真源 = `ledger.ts:544`；`hold_forfeit` **P3 不启用**（DL91）⇒ 保留但无人用」。
- **依据**：`ledger.ts:174-175`（改前 `HOLD_KINDS` 5 项）/ `:541`（改前 `-1` credit 不含它）/ `:544`；`ledger.spec` §13.2 `:827`（**早已**把 `listing_deposit` 计入 `-1` 收入口径）+ R101（v0.13 回写）；`DL91`（`data-layer.spec.md:533`）；裁定 = **Zang §5.81**；**落地** = FIX-A（`0019` + `ledger.ts`，见 D11）。
- **改动位置**：`§4.1` 三行（`hold` 家族 / `-1` / `-3`）；`§4.4-7`（`-1` 收入口径补 `listing_deposit`）。

### D4 — §4.5 / §4.2 幂等键「待定」→ **正式化（批 3a 落地形态）**
- **delta**：C1 缺省派生 `biz:currency:create:<symbol>`；C2 缺省派生 `biz:currency:list:<cid>`；调用方键（`create_key`/`idempotency_key`/`Idempotency-Key`，前缀 ∈ {`biz:`/`cm:`/`cli:`/`ops:`}）优先，须过 §4.5 校验序。
- **依据**（**真源，非记忆**）：`backend-ts/src/currency-service.ts:82`（派生键注释）、`:193`（C1 派生）、`:299`（C2 派生）、`:92-97`（键校验序）；`docs/audit/p4-b3a-currency-funds.md §3.3`（幂等与重放）、`§5.5`（键族实测 `<key>`/`<key>#2..4`）。
- **改动位置**：`§4.5` 幂等键总表（新增 C1/C2 两行）；`§4.2` C1/C2 行的「幂等键」列。

### D5 — 费率 / 保证金金额**必须服务端取数**（标 `FIX-B 落地`）
- **delta**：新增硬口径 —— 金额**不得由调用方决定**；`FIX-B` 改为服务端取数 + 下限校验。**理由**（Zang 逐字）：批 3a 现为客户端必填 ⇒ **可传 `fee=1` 绕过 = 资金面真洞**。
- **依据**：`currency-service.ts:188,292,294`（`toRequiredPositive`，客户端必填）；`master-plan:1390-1399`（§5.81 返工归属 FIX-B）；费率真源 = `commission_policy.fee_rate_bp`（`ledger.spec` §14.1 #32 / §5.20 #3）。
- **改动位置**：**`§4.4-11`（新增判决）**；`§7` 新增 **7-23**（金额来源：方向已定、**数值待 Kevin**）。

### D6 — 非 owner 的码统一为 **`403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED`**
- **delta**：§4.2 C2 期望码列删 `409 LD011/LD014 + not_currency_owner`，改为 `403 AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`（`details.condition='not_currency_owner'`）。
- **依据**：§3.2 明文「账本层权限语义…**新面业务路由不得返回它们**（`LEDGER_UNAUTHORIZED_MINT`/`LEDGER_HOLD_NOT_ALLOWED`）」；§6.2 附表（业务角色守卫 ⇒ `403` + `ACTOR_NOT_ALLOWED`）；实测 = `p4-b3a-currency-funds.md §4 C2-T15`（`403` + `condition=not_currency_owner`）。
- **改动位置**：`§4.2` C2 行「期望码」列；`§8.2b` 对照表同期登记（v0.2 曾写 `LD014`，与 §3.2 冲突）。

### D7 — 新增 §1.6「批 3a 已落地事实」+ §0.3 读数 + §0.1 **I8**
- **delta**：新增 **§1.6**（G1–G6：注册点 51→53 / C1 / C2 / 资金不变量 / 冻结面自证 / 未落地项）；§0.3 追加 3 条实测读数；§0.1 追加输入 **I8**（批 3a 审计件 + Zang §5.80/§5.81）。
- **依据**：`p4-b3a-currency-funds.md §0:13`（注册点 53）、`§4`（22 例）、`§5.1-§5.4`（Σ 1,000,000→2,000,000；`ledger_entry` 9→18 = 1+2+4+2）、`§6.1-§6.2`（冻结 sha256、17 迁移、无 `0018`）、`§8:236,238`；`master-plan §5.80 B`（批 3 判据反转：**「增量=0 才绿」作废** ⇒「== 预期条数」）、`§5.80 D`（**须显式报 51 → N**）。
- **改动位置**：`§0.1`（I8 新行；I4 行补「批 3a 仍 17 文件/无 `0018`」+ FIX-A 状态）；`§0.3`（+3 行）；`§1.6`（**新节**）；`§0.2`/`§0` 元表（版本、本单性质、册内批次、端点锚口径）。

### D8 — §1.1 C1/C2 行改标「已落地」+ §4.6 批 3 行 + §8 变更记录
- **delta**：§1.1 两条「未实现（无编排函数）」改为「**★ 已实现（批 3a）**：`src/currency-service.ts` + `createCurrencyWithFee` / `listCurrencyWithDeposit`（单语句 CTE）；**已注册**（`src/index.ts:1160/1179`）」；§4.6 批 3 行补交付/返工状态；§8.1 追加 **v0.3 行**（含 8 组 delta 摘要）、新增 **§8.2b v0.2→v0.3 对照**、§8.3 追加 NOT_MEASURED、§8.4 追加自曝、§8.5 重写声明。
- **依据**：`p4-b3a-currency-funds.md §3.1`（改动清单：`currency-service.ts` 389 行新建、`database.ts` +170、`index.ts` +48）、`§6.2`（注册点在 404 兜底前）；`src/index.ts:1160/1179`（**现取**）。
- **改动位置**：`§1.1`、`§4.6`、`§8.1/§8.2b/§8.3/§8.4/§8.5`。

### D9 — **`docs/ledger.spec.md` 追加式同步（v0.12 → v0.13）**
- **delta**：R101（§13.3）的 `−1` **增方白名单追加 `listing_deposit`**（原文只列三项 ⇒ 与 §13.2 的 `−1` 收入口径**册内自相矛盾**）；同处保留旧写法「三项」；§17 索引 R101 注记；§18 追加 v0.13 行；新增 **§19.17**（A/B/C/D 四段）。
- **依据**：本册 §3.1 **R31**（`:287`）、§3.2 转移表（`:269`）、§13.2 `−1` 行（`:827`）、§11 判据 7（`:754`）—— **自 v0.2（P1a）起已按「消耗入 `−1`」登记**；`ledger.spec.md:79`（D7 行）；裁定 = **Zang §5.81**；DB 侧落点 = `0019`（见 D11）。
- **未动（明确声明）**：§5.1、§3.1 R31、§3.2、§13.2、§11 判据 7、§0.4；**R1–R109 编号与条文一律不动**；**§14.1 仍 33 码**；**章节编号未重排**（v0.13 内容一律追加为 §19.17）。

### D10 — §7 状态列更新（含给 Zang 的实证材料）
- **delta**：**7-3** 更正（已定）；**7-15** 补齐 **`DL38` 原文落点 + 两读法实证差异**（**仍标 `待 Zang`**）；**7-16** 记 **Zang 方向裁定「必须从 `0017` 派生或删除」+ 本册实证**（**仍标 `待 Zang`**）；**7-17** 追加批 3a 实证；**新增 7-22**（退市/罚没已定）、**7-23**（金额来源：方向已定、数值待 Kevin）。
- **依据（7-15）**：`data-layer.spec.md:328`（DL38 逐字：判据 =「**旧查询函数调用数为 0**」）；两读法实证差异 = ①「计数为 0」**2c 已满足**（`p4-b2c-admin-write.md §4.2-6`）vs ②「把 SQL 迁出 `DatabaseService`」**未做**（新 SQL 仍为 `database.ts` 新方法 —— 2c 与批 3a 同款：`p4-b3a-currency-funds.md §3.1`）⇒ **二读法结论相反**，**本册不选**。
- **依据（7-16）**：Zang 方向 = `master-plan:1390-1399`；本册实证 = `grep -n 'fee\|rate\|费率\|佣金' backend-ts/migrations/0017_platform_config.sql` ⇒ **仅 `:81` 表注释 + 头注 `:45`**（0017 **无键名枚举**，只给「权威在 `commission_policy.fee_rate_bp` + 旧键保留不删」的**规则**）⇒ **「从 0017 派生」产不出键名闭集**；本册给出 **(A) 删除黑名单 / (B) 从权威声明派生最小闭集** 两个可执行选项，**由 Zang 选**；现况 = 2c 自拟集（`src/admin-service.ts:89`）。
- **改动位置**：`route-layer.spec.md §7`（7-3 / 7-15 / 7-16 / 7-17 四行重写 + 7-22 / 7-23 新行）；`§8.4-10`（自曝：这两项是**给 Zang 的实证材料、非本册裁定**）。

### D11 — **FIX-A 落地核实**（写作中途的状态翻转 · 留痕）
- **事实**：本册**开工时**现取 `ls backend-ts/migrations/0019*` ⇒ **无文件**（故初稿各处写「FIX-A **待落盘**」）；**收尾核实时**已是：`migrations/0019_listing_deposit_platform_credit.sql`（167 行）**在盘**、`ledger.ts` 的 `HOLD_KINDS`（`:178`）= **4 项**（`listing_deposit` 已移除）、`-1` credit 白名单已收录 `listing_deposit`、`GET /health` 自报 **`schema_version=0019`** ⇒ **迁移已应用**。
- **依据**：FIX-A 迁移文件头（权威口径逐条列 R31/DL67/DL88 + 改前只读取证 `LD021`）；`docs/audit/p4-b3a-fix-ledger-whitelist.md`（87 行；**§1 改前/目标表齐全，§2–§7 仍为「待回写」占位**）；产物 `backend-ts/.p4-artifacts/b3afix-20260930T014132/{b3afix-00-probe.json,b3afix-01-verify.json}`。
- **改动位置**：`route-layer.spec.md` 文首要点 / §0.1 I4 / §1.1 C2 / §4.1（`hold`+`-1`）/ §4.6 批 3 / §7-3 返工归属 / §8.3-13 / §8.4-9；`ledger.spec.md` 文首状态行 / v0.13 修订行 / R101 / §17 索引 / §18 v0.13 行 / §19.17.C。
- **纪律**：两版措辞（「待落盘」→「已落盘」）**均留痕**，以免读者读成矛盾；**仍未取到** = FIX-A 报告 §2–§7 的逐条读数（**禁当 0/空使用**）。

---

## §2 依据锚点总清单（可 `grep` 复核）

| 类别 | 锚点 |
|---|---|
| 裁定（唯一） | `docs/seafood.master-plan.md:1390-1399`（§5.81）· `:1404` 起（§5.80） |
| 账本权威册 | `docs/ledger.spec.md:79`（D7 行）· `:12`/`:13`/`:191` · `:287`（R31）· `:269` · `:360`（#19 行）· `:492`（§7.2 #14）· `:754`（判据 7）· `:827`（§13.2 `−1`）· `:844`（R101 原文）· `:1384`（§17 索引 R101） |
| 数据层 | `docs/data-layer.spec.md:454`（DL67）· `:530`（DL88）· `:533`（DL91）· `:328`（DL38 原文） |
| 代码（只读现取） | `backend-ts/src/ledger.ts:148-150`（注释）· `:174-175`→`:178`（`HOLD_KINDS` 5→4）· `:541`（`-1` credit）· `:544`（`-3`）· `:548-558`（判定器）· `src/currency-service.ts:82,92-97,188,193,292,294,299,348-353` · `src/index.ts:1160,1179` · `src/admin-service.ts:89`（`FEE_RATE_KEY_PATTERNS`） |
| 迁移 | `migrations/0003_kind_close_set_20.sql:5-8,65-66` · `0008_platform_revenue_job_fee.sql:49` · **`0019_listing_deposit_platform_credit.sql`**（167 行）· `0017_platform_config.sql:45,81`（费率键口径） |
| 审计件 | `docs/audit/p4-b3a-currency-funds.md`（§0:13 · §3.3 · §4 C1/C2 22 例 · §5.1-§5.5 · §6.1-§6.3 · §7 N1/N2 · §8:236,238）· `docs/audit/p4-b3a-fix-ledger-whitelist.md`（§0/§1；§2–§7 占位）· `docs/audit/p4-b2c-admin-write.md §4.2-6/-7` |
| 运行读数（本册现取） | `GET /health` ⇒ `schema_version=0019`（`2026-09-29T17:44:45Z`）· `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts` ⇒ **53** |

---

## §3 交付纪律自检

① **只写五个文件**（§0 表所列）；`docs/route-layer.spec.md` 与 `docs/ledger.spec.md` **就地升版**，**既有快照（v0.1/v0.2、ledger v0.1…v0.11）一字未动**。
② **ledger.spec 为追加式**：**R1–R109 编号与条文一律不动**、**§14.1 仍 33 码**、**章节编号未重排**（v0.13 内容一律追加为 §19.17）；**每处改写均留痕**（R101 旧写法「三项」保留）。
③ **route-layer v0.3 每处与 v0.2 的差异均标「v0.2 旧写法」**（§4.1 两行 / §4.3 / §7-3 / §8.2b），**无静默重写**。
④ **零代码改动**（`backend-ts/**` 只读）· **零库写 / 零库连接**（唯一网络读 = `GET /health` 只读探针）· **未启停任何进程** · **未 `git add/commit/push`** · **未 `npm install`** · **未 `execute_code`** · **未用 `pkill -f`/`killall`** · **未用 `timeout`**（本机无）。
⑤ **不动**：`docs/seafood.master-plan.md`、`docs/data-layer.spec.md`、其它 `*.spec.md`、其它 `docs/audit/*`（只读）、`frontend/**`。

---

## §4 NOT_MEASURED / 诚实边界（本册自身）

| # | 项 | 说明 |
|--:|---|---|
| N1 | FIX-A 报告的 §2–§7 | `p4-b3a-fix-ledger-whitelist.md` 该七节为**「待回写」占位** ⇒ 其正向/负对照逐条读数、`tsc` 读数、注册表 17→18 的具体行 **本册未取到**（**禁当 0/空**） |
| N2 | `b3afix-01-verify.json` 的内容 | **未由本册解析**（只登记其存在与路径） |
| N3 | 批 3a 的 `frozen`/`delisted` 两支、并发同键、`details` 逐字 | 同 `p4-b3a-currency-funds.md §7 N2/N3/N4`（本册继承其边界） |
| N4 | `data-layer.spec.md` 的 md5 | **未复算**（沿用父单前缀 `7b86b811…`）；其行号引用为本单现取，若被并行改动可能漂移（**以内容/DL 号为准**） |
| N5 | 7-15 / 7-16 的裁决 | **本册不裁**，状态保持 `待 Zang`（只提供原文落点与实证差异） |

---

## §5 声明

本单**未**改：`docs/versions/route-layer.spec.v0.1.md`、`docs/versions/route-layer.spec.v0.2.md`、`docs/seafood.master-plan.md`、`docs/data-layer.spec.md`、`frontend/**`、`backend-ts/**`（含 `src`/`migrations`/`scripts`/`.p4-artifacts`）、其它 `docs/audit/*`。
本单**交付**：`docs/route-layer.spec.md`（v0.3）、`docs/versions/route-layer.spec.v0.3.md`、`docs/audit/route-layer-v0.3-delta.md`（本件）、`docs/ledger.spec.md`（v0.13）、`docs/versions/ledger.spec.v0.12.md`。
**作者**：Jing（制度员）· **裁定者**：Zang · **本册一切资金语义以 `docs/ledger.spec.md` + `docs/data-layer.spec.md` + `master-plan §5.81` 为准**。
