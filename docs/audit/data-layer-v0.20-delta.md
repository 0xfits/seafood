# data-layer.spec v0.20 delta —— 批 9 第 2 片（P9②）契约冻结：batt 电量（独立数据面）+ 签到 / 补签

> **角色**：Jing（Specifier · 制度员）· **单号** = **JING-SPEC-P9-2** · **同批姊妹册** = `docs/audit/route-layer-v2.13-delta.md`（正文 = `route-layer.spec` v2.13 §28）。
> **口径**：**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件 · 不新建迁移文件**。
> **依据**：`docs/requirements/p9-four-role-economy.md` **§4（batt）逐字 + §7**；已裁 **`R-9-3`**（手续费进 `uid = −1` · 不真 burn）/ **`R-9-5`**（五片依赖序）/ **`R-9-6`**（batt = 独立数据面）—— `docs/seafood.master-plan.md:1815` / `:1817` / `:1789`。
> **上游对锚**：`git log --oneline -1` = **`a2a2d7c`**（= P9① 质检 PASS + 上线 + 生产终验 · **HEAD 含 P9① 已推** ✅）。

## §D0 指纹（改前 / 改后 · 现取）

| 项 | 改前（v0.19） | 改后（v0.20） |
|---|---|---|
| 文件 | `docs/data-layer.spec.md` | 同 |
| 行数（`wc -l` = 换行符数） | **2871** | **3266** |
| 逻辑行 | **2871**（末行带换行） | **3266**（末行带换行） |
| 字节 | 585357 | **641515** |
| md5 | `fa698c0c8cd8ca45ac9f54272217bf81` | **`ea6fb1840aadc4a8ceb7a6ca3047e349`** |
| sha256 | `e420e5012e0348b0bd32d1ca3d73eb60c43a6a07bc4ed0fcaf1f6d437e7341d3` | **`fc565cb806f3f7bc7336a8ede7234749351e07b2e289593e77f4dbedf3e44295`** |
| 改前快照 | `docs/versions/data-layer.spec.v0.19.md`（`cmp` = 0 · **未动**） | — |
| 改后快照 | — | **`docs/versions/data-layer.spec.v0.20.md`**（`cmp` = 0 · sha256 同上） |

**只追加自证**：`git diff --no-index --numstat docs/versions/data-layer.spec.v0.19.md docs/data-layer.spec.md` = **`395\t0`**（**删除列 = 0**）；`git diff --numstat docs/data-layer.spec.md`（HEAD → 工作树）= **`395\t0`**；`difflib.SequenceMatcher` 独立复核（v0.19 → v0.20）= **0 replace / 0 delete / 395 insert**；**旧快照 `v0.1`–`v0.19` 一十九件一字未动** ✅。

## §D1 改动点（逐条）

| # | 落点 | 内容 |
|--:|---|---|
| 1 | **顶部状态块区**（`# 标题` 与 `v0.19 状态行` 之间） | **新增 v0.20 状态行 1 行**（⇒ 其后全部行号 +1） |
| 2 | **§31〔新〕**（追加于本册末行之后） | P9② 契约冻结：§31.0 开工锚（现取 12 项）/ **§31.1 C-3（`LEDGER_KINDS` 现取自证 = 20 + 两方案 + 影响面 + `PENDING_ZANG`）** / **§31.2 存储载体三查（六迁移 8 表逐查 ⇒ 另建新表）+ 新表列草案 ①–④（逐项溯源）** / **§31.3 batt 数值面（`[0,100]` fail-closed 逐条 + `batt_policy` + ★ `< 9` 禁接单 SQL 单写路径闸落点 + 去闸负对照 4 条）** / **§31.4 签到 / 补签（`checkin_policy` + 断签清零 + 补签 + 幂等 / 唯一键 + 日界三候选）** / **§31.5 `$` 与归属（`uid = −1` · 不真 burn · 零净写）** / §31.6 七面覆盖 / **§31.7 三变体（不择一）+ 每案代价** / §31.8 判据分级 + 未测项（9 项）/ §31.9 与 P9①·8① 衔接 / §31.10 指纹自证 / §31.11 引用关系 |

**非追加改动 = 0 处**；`§21`–`§30` 与 `DL*` 条文一字未动。

## §D2 与裁定的对应（诚实登记）

- **十面履约**：① C-3（§31.1 · 现取自证 20 + 两方案 + `PENDING_ZANG` + 影响面核）；② 存储载体三查（§31.2 · 六迁移逐表）；③ batt 数值面 + 闸落点（§31.3）；④ 签到 / 补签（§31.4）；⑤ `$` 与归属（§31.5）；⑥ 七面覆盖（§31.6）；⑦ 三变体（§31.7）；⑧ 判据分级 + 未测项（§31.8）；⑨ 衔接（§31.9）；⑩ 指纹 / 引用（§31.10/§31.11）。
- **逐字遵守的真源**：需求 §4.1.1/§4.1.2/§4.1.3/§4.2.1/§4.2.2/§4.2.3/§4.2.4（逐字引）；`R-9-3` / `R-9-5` / `R-9-6`（`master-plan` 逐字）；`ledger.spec` `R40`/`R25`/`R31`/`R101`/`R41`/`R42`（只读引用）。
- **未发明**：键名（`batt_policy` / `checkin_policy` = `B1`/`B2` 既有候选）、字段名、`reason` 常量（三常量既有）、错误码（闭集 33 不动）、表名（`batt_account` 等 = **候选**，构词法可复算）；**数值**一律引需求逐字或 `R-9-13`-3 定案；**待裁项一律标 `PENDING_ZANG`**（C-3 择一 / 补签 kind 名 / 日界口径 / 幂等键前缀 / 签到溢出）。
- **★ 主动暴露的张力（登记，不单方面解决）**：① **`DL81`（kind 扩展 = 0）** vs 补签 `$` 腿取「扩容」方案（§31.1(d)/(e) · 须 Zang 一并裁定 `DL81` 表述）；② `acceptThresholdBatt`（9）与 `taskCostBatt`（9）的**恒等判负**归属（§31.3(b)）；③ `streakDay7RewardBatt ≥ baseRewardBatt` 的判负归属（§31.4(a)）；④ 补签成功后**是否再发当日 batt**（§31.4(c#6) · 需求零覆盖）。

## §D3 `NOT_MEASURED`（逐项 · 禁填 0 / 空）

| # | 未测项 | 原因 |
|--:|---|---|
| 1 | 4 张新表的库面实况 | 规范单零库连接、零迁移 ⇒ 表不存在 ⇒ 无对象可测 |
| 2 | 签到 / 补签 / 断签 HTTP 实跑（四段 + 两读数 + 负对照） | 规范单零代码；读 / 写口未实现 |
| 3 | 「`batt < 9` 禁接单闸」实跑（`apply`/`accept` `409` ⇄ 去闸 `200`） | 规范单零代码；`batt_account` 不存在 ⇒ 闸无对象可挂 |
| 4 | C-3 择一 + 补签 `$` kind 名 | `PENDING_ZANG` ⇒ 未裁 ⇒ 未测 |
| 5 | 日界时区口径择一 | `PENDING_ZANG` ⇒ 未裁 ⇒ 未测 |
| 6 | 幂等键前缀择一（`biz:` vs `ops:`） | `PENDING_ZANG` ⇒ 未裁 ⇒ 未测 |
| 7 | `batt_policy` / `checkin_policy` 真库行值 | 本册零库连接（两键已在代码面白名单 9 键） |
| 8 | `LEDGER_KINDS` 扩容若落地后的 33 码 / 既有门复跑 | 方案未裁 ⇒ 未实现 ⇒ 未跑（影响面已核 = §31.1(e)） |
| 9 | `B-2` 签到溢出（封顶丢弃 vs 拒绝） | 需求零覆盖 ⇒ `PENDING_ZANG` ⇒ 未测 |

## §D4 现取读数（本单亲读 · 只读）

- **`LEDGER_KINDS` 闭集** = **恰 20 个**（`backend-ts/src/ledger.ts:153-160` 现取逐字）；与 `0003_kind_close_set_20.sql:58-77` / `0001_ledger_core.sql:76` / `ledger.spec` v0.13 §5.1 三处一致 ✅。
- **`APP_CONFIG_LEGAL_KEYS`** = **恰 9 键**（`backend-ts/src/database.ts:68-78`）⇒ P9① 白名单 `2 → 9` 已落 ✅。
- **`batt_policy` / `checkin_policy` 现取**：字段类型（`database.ts:160-166`）+ `AV4` 域（`:190-199`）**已在代码面**。
- **承接写路径现取**：路由 `index.ts:1877`（`/api/job/:jobId/apply`）/ `:1899`（`/api/job/:jobId/accept`）；DB `database.ts:3468`（`applyToJob` · 单条 SQL CTE · `:3484` `INSERT`）/ `:3532`（`acceptJobApplication` · 单条 SQL CTE · `:3554` `UPDATE`）⇒ **两处均为单一 SQL 写路径**（可加闸 ✅）。
- **注册点** = **76**（`get 32 / post 41 / put 0 / patch 1 / delete 2`）。
- **本单未写库 / 未 apply / 未启停服务 / 未提交（`git add/commit/push` 全无）/ 未碰 `.env*`**（纯规范单）。
