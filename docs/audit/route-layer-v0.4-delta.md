# 路由层规范 **v0.4** delta 审计件（逐条 delta → 依据 → 改动位置）

> **单号**：Unit Jing-V0.4（规范折入单） · **作者角色** = **Jing（Specifier · 制度员）** · **日期**：2026-09-30
> **前身** = `docs/route-layer.spec.md` **v0.3**（**716 行 / md5 `fa91425ed380423d0f01f577f0f53aa6`**，快照 `docs/versions/route-layer.spec.v0.3.md` **一字未动**）。
> **成品** = `docs/route-layer.spec.md` **v0.4**（**763 行 / 166747 B / md5 `e8b3ceffd98ef82fb37c77c2b13b6108`**）；快照 `docs/versions/route-layer.spec.v0.4.md`（**同 md5**，`cmp` 退出码 **0**）。
> **附带**：`docs/data-layer.spec.md` **v0.6 → v0.7**（**追加式加注 §18**；改前快照 `docs/versions/data-layer.spec.v0.6.md` = **`7b86b8119bea359327b5c9d616ca3505`** 本单新建）。
> **纪律**：每条 delta 带**依据锚点**（`文件:行号` / 报告节号 / Zang 节号）；**凡与 Zang 裁定冲突 ⇒ 以 Zang 为准**并标「依据 = Zang §5.8x」；**无法调和 ⇒ 标 `待 Zang`（本单为 0 条）**。
> **口径**：本册§/行号 = **v0.4 成品行号**（`grep -n` 现取）；依据锚点 = 裁定/报告原文锚点。

| # | delta（本单折入） | 依据锚点 | 改动位置（v0.4） |
|--:|---|---|---|
| **D1** | **7-15 定案**：`DL38` 落点读法 **以读法①「旧查询函数调用数 = 0」为准**；**读法②（代码结构迁移）不采纳**；**三条补强**：① 判据须带**具名函数清单**（引用 `asset`/`permission_group`/`prize`/`prize_item`/`shard`/`shard_transfer`/`task`/`task_progress` 的 **A 类遗留函数**）；② **同时**核那 **5 组端点自身 `200/404/410` 语义正确**（**不得为清零而删功能**）；③ 判据用**类级扫描**。状态由「仍待」→ **已定** | **依据 = Zang §5.82**（`docs/seafood.master-plan.md:1429`，逐字「以读法① 为准…读法② 不采纳…补强①②③」）；原文落点 = `docs/data-layer.spec.md:328`（**原文自带判据**）；2c 取此读法 = `p4-b2c-admin-write.md §4.2-6` | **§7-15 行**（`:658`）—— 状态列改「**已定（★ v0.4 定案 · Zang §5.82）**」+ 裁定正文前插；**v0.3 实证材料以「▼ 保留不删」留痕** |
| **D2** | **7-16 定案**：**采纳 (A) 删除** 批 2c 自拟的 `FEE_RATE_KEY_PATTERNS` 黑名单；**「真源唯一」改由读取侧纪律保证**（任何计费**只读 `commission_policy`、永不读 `app_config`**）；写入侧只做**命名提示**（非硬拒）；**登记「`app_config` 合法键清单 / 写入门禁」为批 6 配置面规格**。状态由「仍待」→ **已定** | **依据 = Zang §5.82**（`master-plan:1430`）；实证 = `0017:81` 表注释立场（「费率键不在此表权威…历史键保留但标『不参与计费』、不得删键」）；本册 v0.3 的 `0017` 无键名枚举实证（`grep -n 'fee\|rate\|费率\|佣金' 0017_platform_config.sql` 仅 `:81` + 头注 `:45`） | **§7-16 行**（`:659`）—— 状态列改「**已定（★ v0.4 定案 · Zang §5.82）**」+ (A) 裁定 + 批 6 登记前插；**v0.3 实证以「▼ 保留不删」留痕** |
| **D3** | **7-23 定案**：金额**必须服务端取数 + 下限校验**（机制**已由 `FIX-B` 落地**）；下限取**可配置 + 代码常量兜底**，兜底值标 **`TODO: Kevin 定值`**（**占位非经济值**）；**具体数值待 Kevin**（**不得由子代理发明**） | **依据 = Zang §5.82 7-23**（`master-plan:1431`，逐字「机制先落地、数值待 Kevin…数值不由我发明」）+ **§5.84**（`master-plan:1401`；`zang-sigma.js` 亲算） | **§7-23 行**（`:666`）—— 标题加「· v0.4 定案」、状态改「**已定（Zang §5.82 7-23 + §5.84；★ 机制已落地）· 数值待 Kevin**」+ 落地状态前插；**§4.4-11**（`:479`）与 **§4.4-12**（`:486`）呼应；**§3.2** 新增借码行（`:362`） |
| **D4** | **批 3a 真收官事实折入**（带真源）：`0019_listing_deposit_platform_credit.sql`（`listing_deposit` 入 DB 侧 **`-1` credit 白名单**，**已应用**）+ **`0020_ledger_post_event_hold_family_drop_listing_deposit.sql`**（把 `listing_deposit` 从 **`ledger_post_event` 函数体** hold 家族 IN 列表摘除，**已应用**）；`src/ledger.ts` 的 **`HOLD_KINDS` 5→4**（`:178`）；**注册点 53**（未增删对外路径）；**C2 最终入账形状 = 4 腿全在 `balance`**（`currency_create_fee` ×2 + `listing_deposit` ×2，贷方 `uid=-1`）/ **C1 同族**；回执 `deposit_consumed` / `deposit_credit_uid:'-1'` / `deposit_refundable:false`；**幂等键真源 = `src/currency-service.ts`**；`/health` ⇒ **`schema_version=0020`**、`schema_migration` = **19** | **依据 = Zang §5.82/§5.83/§5.84**（`master-plan:1419/1407/1390`）；报告 = `p4-b3a-fix-ledger-whitelist.md`（198 行）、`p4-b3a-fix2-ledger-post-event-shape.md`（322 行）、**`p4-b3b-currency-funds-fix.md`**（225 行；`§1.1,§2.2,§4.3,§6`）；代码 = `backend-ts/src/ledger.ts:178`、`currency-service.ts:433/439/440`、`0020:30`（IN 列表）；本册现取：`ls migrations`（含 `0019`/`0020`）、`wc -l`（167/1115） | **新增 §1.7**（`:244`，H1–H8）+ **§1.6 改标**（`:229`，「= FIX-B 前之历史读数，保留不删」）；**§0 库行**（`:16`）、**§0.3** 新增 4 行（`:62-66`）、**§0.1 I4/I8**（`:28/32`）；**§4.1 hold 家族 / `-1` 白名单**（`:424/426`）；**§4.2 C1/C2**（`:449/450`）；**§4.3 C2**；**§4.5 C1/C2 键**（沿用 v0.3 真源） |
| **D5** | **低于下限的借码正式化**：接受 **`LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason = BELOW_SERVER_FLOOR`**（`details = {field,value,min}`）；备选码 `LEDGER_AMOUNT_INVALID` **未采纳**；**同步 C1-T05/C2-T17 的新期望**（**未传金额 ⇒ 服务端默认 ⇒ `200`**，**不再 `400`**）；**显式区分「同号异案」**（`p4-b3a` 的 T05/T17 = 缺值；`p4-b3b` 的 T05/T17 = `999` < 下限 ⇒ 400） | **依据 = Zang §5.84 ①/②**（`master-plan:1401`，逐字「接受 `LEDGER_AMOUNT_NOT_POSITIVE` + `reason=BELOW_SERVER_FLOOR`…须在 v0.4 正式化进 §3.2/§4.4」+「批准期望变更…须同步这两条期望」）；实测 = `p4-b3b-currency-funds-fix.md §3,§5`（C1-T05/T12、C2-T16/T17/T23）；真源 = `backend-ts/src/currency-service.ts:169`（`BELOW_SERVER_FLOOR`） | **§3.2 新增行**（`:362`「`400`（★ v0.4 借码正式化）」）；**§4.4 新增第 12 条**（`:486`）；**§4.2 C1/C2 期望码列**加 `LD018` 借码（`:449/450`） |
| **D6** | **401/403 取证口径精化**：本仓**不落请求级 access log** ⇒ 正解 = **响应体（`R107` 的 `code` + `details.reason`）+ 零分录**取证 + **显式 `NOT_MEASURED`**；**严禁把「日志查不到」写成「日志确认无异常」**；记录**结构性前提** = **P4-SEC 后 `resolveActor` 已把 infra 分类为 `503`**（吞 401 风险结构性下降） | **依据 = Zang §5.84 ③**（`master-plan:1401`，逐字「当被查仓没有 access log 时，正解 = 响应体证据 + 零分录取证 + 显式 `NOT_MEASURED`…不得据『日志查不到』下结论」+「P4-SEC 后 infra 已分类 503」）；实测 = `p4-b3b-currency-funds-fix.md §5.1`（1199 行窗口内 `/api/currency` = 0 行、`403` = 0 行）；P4-SEC = `p4-sec-auth-gate.md` / Zang §5.79 | **§3.4 两段**（`:399-400`，把「修法归 P4-SEC」改为「已由 P4-SEC 结构性下降」+ 新增取证口径段）；**新增 §7-24**（`:667`）；**§8.6.2** 新增 `NOT_MEASURED` 条（§8.3-14） |
| **D7** | **`data-layer.spec.md` 追加式加注**（**只增不改**）：`DL67`/`DL88` 口径**已在 DB 侧兑现**（`0019`/`0020` 已应用）；**`listing_deposit` 不属于 hold 家族**；若有冲突旧写法 ⇒ **同地保留旧写法 + 加注**（**不静默重写**）；另登记 `DL67` 的 `listing_fee` 命名张力（**不改正文**） | 依据 = 本单 D4 的同一组真源 + Zang §5.81/§5.83；**加注纪律** = `data-layer.spec.md` §16（「已发生的事实就地登记而非静默覆盖正文」）；本册现取 `grep 'hold 家族\|HOLD_KINDS\|冻结可退' data-layer.spec.md` = **0 命中** ⇒ 无冲突旧写法 | **`docs/data-layer.spec.md` 新增 §18**（`:1015`，AN1–AN3）+ **版本头一句**（`:3`，v0.6→**v0.7**）；改前快照 `docs/versions/data-layer.spec.v0.6.md`（`7b86b811…`）新建 |
| **D8** | **Zang §5.81 的自我勘误同步**：在 §7-3 处补留痕句 —— **Zang §5.80 曾显式批准「保证金 = `HOLD` 冻结、可退、不进 `-1` 白名单、无需迁移」，该批准已由 §5.81 作废并纠正** | **依据 = Zang §5.81**（`master-plan:1435` A 节「我错在哪」+ B 节「真根因」）；v0.3 已登记 v0.2 的「冻结可退」为错误推断（本单**确认口径一致**，只补 §5.80 的批准作废留痕） | **§7-3 行**（`:646`）—— 状态加「· v0.4 补 §5.80 留痕」、正文前插「★ v0.4 留痕」句；**v0.2 旧写法留痕保留** |
| **D9** | **§0 / §0.1 / §0.3 元信息同步**：`/health` ⇒ **`schema_version=0020`**（`schema_migration` = 19、`0018` 勿补）；注册点 **53**（真收官复核，FIX-A/B/RS 未增删路径）；`migrations` 输入 = `0001..0017` + **`0019`/`0020`**；**审计四件 I8** 扩充（+`p4-b3a-fix*`×2、`p4-b3b`）+ Zang §5.82–§5.84；§0.3 新增 4 条实测读数（两迁移/ C2 形状 / 金额下限 / 401 取证） | 依据 = D4/D5/D6 同源；注册点真源 = `p4-b3b-currency-funds-fix.md §6`（53）；`schema_version` 真源 = `b3b-01-http.json` + `migrate-apply.out.json`（`0020`） | **§0 表**（`:13` 版本、`:16` 库、`:18` 端点锚口径、`:19` 批次）；**§0.1**（`:25` I1、`:26` I2、`:28` I4、`:30` I6、`:32` I8）；**§0.3**（`:62-66` 新增 4 行） |
| **D10** | **§8 变更记录 / 声明 / 自曝补遗**：新增 v0.4 变更行；**本单声明**（只写 5 文件、零代码/零库/零 git/零进程）；`NOT_MEASURED` 增补；**自曝**（§1.6↔§1.7 并存刻意 / 转引边界 / 裁定原文落点 / 同号异案风险） | 依据 = 本单全部 delta（D1–D9）+ 任务纪律（§5.7 ①②④⑤⑥⑦） | **§8.1 表新增 v0.4 行**（`:678`）；**新增 §8.6**（`:744`，含 8.6.1 声明 / 8.6.2 `NOT_MEASURED` / 8.6.3 自曝）；**§8.3/§8.4 历史措辞保留**（8.6 明标「对 v0.4 生效」） |

## 一、成品指纹与自证

| 件 | 行数 | md5 | 自证 |
|---|---|---|---|
| `docs/route-layer.spec.md`（v0.4） | **763** | **`e8b3ceffd98ef82fb37c77c2b13b6108`**（166747 B） | 就地升版 |
| `docs/versions/route-layer.spec.v0.4.md` | 763 | `e8b3ceffd98ef82fb37c77c2b13b6108` | `cmp` 退出码 **0**（与工作件逐字节相同） |
| `docs/route-layer.spec.md`（改前 v0.3） | 716 | `fa91425ed380423d0f01f577f0f53aa6` | 快照 `v0.3` **未动**（现取 md5 相同） |
| `docs/versions/route-layer.spec.v0.1.md` | — | `be823001f3a99e12da0ee02056c80e90` | **未动** |
| `docs/versions/route-layer.spec.v0.2.md` | — | `0c587183a66ae39b597370acc08ac2fc` | **未动** |
| `docs/data-layer.spec.md`（v0.7） | — | `ad657c0a5068e91cb57d935bb34fd86b` | 就地追加式加注 |
| `docs/versions/data-layer.spec.v0.6.md` | — | `7b86b8119bea359327b5c9d616ca3505` | **改前基线**（= 改前 `data-layer.spec.md` md5） |
| `docs/versions/data-layer.spec.v0.1.md`–`v0.5.md` | — | 未列 | **未动** |

## 二、未采纳 / 待 Kevin（**不得自选**）

| 项 | 状态 | 归属 |
|---|---|---|
| **三个 `*_FLOOR` 下限数值**（现占位 `1000`，逐条 `TODO: Kevin 定值`） | **待 Kevin**（经济参数） | Kevin |
| **金额改「从平台配置取数」**（真源键名待定；**不得从 `app_config` 硬造键名**） | **待批 6 配置面** | 批 6 |
| **「`app_config` 合法键清单 / 写入门禁」** | **待批 6 配置面规格**（现在无键名枚举） | 批 6 |
| `frozen`/`delisted` 币种状态闸两支 | **未测**（禁当 0/空） | 后续片 |
| `401`/`403` 的服务端日志逐条归因 | **`NOT_MEASURED`**（本仓无 access log） | 结构性 |

## 三、边界自证（本单做了什么 / 没做什么）

- **写**：`docs/route-layer.spec.md`（v0.4）、`docs/versions/route-layer.spec.v0.4.md`（快照）、`docs/audit/route-layer-v0.4-delta.md`（本件）、`docs/data-layer.spec.md`（v0.7 追加式加注 §18 + 版本头一句，**`DL*` 正文一字未改**）、`docs/versions/data-layer.spec.v0.6.md`（改前基线快照）。
- **未写**：`route-layer.spec.v0.1/v0.2/v0.3.md`、`data-layer.spec.v0.1`–`v0.5.md`、`ledger.spec.md`（v0.13 原样）、`seafood.master-plan.md`、其它 `docs/audit/*`、`backend-ts/**`（含 `src`/`migrations`/`scripts`/`.p4-artifacts`）、`frontend/**`、其它 `*.spec.md`。
- **未做**：任何 SQL（**零库连接**）/ 启停进程 / `npm install` / `execute_code` / **`git add|commit|push`** / **`pkill -f`|`killall`** / `timeout`（本机无）。**未 kill 任何 PID**。
- **任务纪律对照**：① 与 Zang 裁定冲突 ⇒ 以 Zang 为准（本单 **0 冲突**）；② 逐条带依据锚点 ✓；③ 先骸架后回填（各节先落标题后回填，**未停在占位态**）✓；④ 旧快照未动 ✓、**未改 `ledger.spec`** ✓（R1–R109 与 33 码零触碰）；⑤ 自报行数/指纹 + `cmp` 自证 ✓；⑥ 未改代码 / 未改 `master-plan` ✓。
