# data-layer.spec v0.27 → v0.28 · delta 件（批 8 第 6 片（8⑥）审计台库侧事实 + 裁定落册）

> **性质**：本件 = `docs/data-layer.spec.md` 由 **v0.27 → v0.28** 的逐条改动记录（Jing · Unit **JING-SPEC-8-6**；**只追加 · `git diff --numstat` 删除列 = 0**）。
> **依据**：`docs/seafood.master-plan.md` **`:716`（`C3`）+ `:1419-1449`（Zang §5.277 A–E）** + **Kevin 定档「② 中」** + **`R-9-71`** + **`R-9-72`..`R-9-79`**（终审裁定 · 本单落册）；route 侧正文 = 姊妹册 `route-layer.spec` v2.21 §32。

## 1. 版本与快照

| 项 | 值 |
|---|---|
| 改前版本 | **v0.27**（快照 `docs/versions/data-layer.spec.v0.27.md`，md5 `a207119820b016386b457ec128766f9f`，`wc -l` **4471** / **846650** 字节 / sha256 `bce18c5d2619a80a6e444913a8a938b86f757a132a732c1d5448f8478d1a935d`） |
| 改后版本 | **v0.28**（快照 `docs/versions/data-layer.spec.v0.28.md`，md5 `4f5fe4571d50af626e1bc4577bf00967`，`wc -l` **4563** / **862628** 字节 / sha256 `8cb922b80713b965ea8ae1ad8b2c90d11cb56502f38ee181e1cc4e5a27705e68`） |
| 快照自证 | `cmp docs/data-layer.spec.md docs/versions/data-layer.spec.v0.28.md` ⇒ 退出码 **0** |
| 版本号说明 | 本单 = **8⑥ 裁定落册**（`R-9-72`..`R-9-79`）；本册稿**未入库** ⇒ **就地改 v0.28（无新版本号）**；相对**已提交基线**（`79c103b`）仍**只追加**。 |

## 2. 只追加自证

- `git diff --numstat docs/data-layer.spec.md` ⇒ **`92\t0`**（**删除列 = 0**）。
- `difflib(autojunk=False)` ⇒ **仅 `equal` / `insert`（`replace` = 0、`delete` = 0）**；`wc -l` 增量 = 4563 − 4471 = **92** = 插入行数。

## 3. 逐条改动点（只增）

| # | 落位 | 内容 | 增行 |
|---|---|---|---|
| ① | 文件头（**v0.27 行之前**） | 新增 **v0.28 状态行**；**v0.27 / v0.26 … 旧行未改写、保留留痕** | 1 |
| ② | **本册末（§34.9 之后）** | 新增 **§35（8⑥ 审计台库侧事实 · §35.0–§35.6）** | 91 |
| 合计 | | | **92** |

## 4. 新增节 §35 子节一览（只增）

| 子节 | 内容 |
|---|---|
| §35.0 | 本节性质（与 §21–§34 关系） |
| §35.1 | 现取锚（只读探针 `backend-ts/.p8s6-ro/inv{,2,3}.ts` · 7 条读数） |
| **§35.2** | ★ 15 面逐表三性（append-only 触发器名 / `tgtype` / `tgenabled` / PK / 有无 `time_created` / keyset 排序键）★ **第 14 行 `app_config` 已裁出（`R-9-77`）** |
| **§35.3** | ★ 口径更正：**`app_config` 非 append-only**（`tgtype=19`）⇒ 14 面真 append-only；★ **已裁：`app_config` 出检索台 ⇒ 面数 15 → 14（`R-9-77`）** |
| §35.4 | 五类过滤面库侧列映射（权威表指 `route-layer.spec` §32.3）+ 库侧列类型注（`app_config.key` 已标出） |
| §35.5 | 只读 / 零迁移声明 + 与既有面衔接（不建表/视图/索引 · 无新迁移 · 不造第二真源 · 变体 Ⅲ 已否决 `R-9-74`） |
| §35.6 | 未测项（6 项 · 禁填 0/空）★ **已同步终审裁定（归实现单）** |

## 5. 关键口径（逐字 · 现取读数）

- **`public` 基础表 = 34 张**（只读探针 `relkind='r'`）；**盘面 15 留痕面** = `admin_ops_audit_log` / `admin_refund_audit_log` / `ledger_entry` / `currency_review_log` / `currency_status_log` / `listing_review_log` / `job_arbitration_log` / `batt_entry` / `checkin_log` / `checkin_makeup_log` / `rating` / `listing_order_event` / `referral` / `app_config` / `commission_policy`。
- **append-only 判据**：`tgtype & 27 == 27`（= ROW+BEFORE+DELETE+UPDATE）且 `tgenabled='O'` ⇒ **14 面成立**；**`app_config` 例外** = 两触发均 `tgtype = 19`（`BEFORE UPDATE`）⇒ **非 append-only**（就地 UPSERT 当前态 · 1 行/键）。★ **终审（`R-9-77`）= `app_config` 出检索台 ⇒ 有效面数 = 14**（白名单见姊妹册 §32.2）。
- **`time_created` 缺列面**：`referral`（→ `bound_at`）/ `app_config`（→ `time_updated` · 已裁出）。
- **`admin_ops_audit_log` 单动作锁**：`CHECK (action='points_adjust')`（`0023:86`）⇒ 该表只服务单动作。
- **schema 版本 = `0038`**（迁移 37/37）；**kind 闭集现取 = 24**；`ledger_entry` **16 列 / 359 行**（`txid` 唯一）。★ **终审（`R-9-75`）：`manage_audit` 迁移（`admin_permission` 11 → 12）归 8⑥ 实现单 · apply 由 Zang**。
- **零迁移 / 只读**：本节**不新建任何 DB 对象**；检索台**仅 `SELECT`**；**禁** `UPDATE`/`DELETE`/`TRUNCATE`（14 面由触发器兜底、**纪律不依赖触发器**；`app_config` 已裁出 ⇒ 检索台全为真 append-only 面）。

## 6. 未测项（禁填 0 / 空）

- 读口对 14 面取数 / 分页 / 过滤**未做**（规范单零代码 · 归实现单 + 质检单）；变体 Ⅲ 统一视图**已否决（`R-9-74`）⇒ 不建、无对象可测**；`app_config` 面数 **已裁 = 14（`R-9-77`）**；四语文案「值」**归实现单**（`PZ-3`）；C3③ 枚举化库侧落值**已裁 = (b)（`R-9-76`）· 未实现 ⇒ 未测（归实现单）**；`manage_audit` 迁移库侧读数**未测（归实现单）**。
- **本节一切读数来自只读探针（未入 `scripts/`）；本册未连写库、未启停服务、未跑迁移/写探针、未改 `backend-ts/**` / `frontend/**`、未改任何 append-only 面。**

## 7. ★ 8⑥ 裁定落册（`R-9-72`..`R-9-79` · 就地修订 · 无新版本号）

> **落位表正文** = 姊妹册 `route-layer.spec` v2.21 **§32.14**；本节只登记库侧受影响项。

| 裁定号 | 影响本册的点 | 库侧落位 |
|---|---|---|
| `R-9-73` | `app_config` **非 append-only**（以现取为准）⇒ 有效面数 **14** | §35.1-3 / §35.2（第 14 行） |
| `R-9-74` | 载体 **Ⅰ**、否决 Ⅲ（统一视图）⇒ **库侧零新建 DB 对象**（不建视图） | §35.5（建表/视图行 · 变体 Ⅲ 行） |
| `R-9-75` | 新增权限键 `manage_audit` ⇒ **库侧新迁移**（`admin_permission` 11 → 12 · apply 由 Zang） | §35.5（迁移行）/ §35.6-6 |
| `R-9-76` | C3③ 枚举原因码（常量集非错误码）⇒ 库侧无新表 / 新码 | §35.6-5 |
| `R-9-77` | **`app_config` 出检索台（15 → 14）**；「配置变更史（若要）」另定留痕载体（非本片） | §35.2 / §35.3 / §35.4 / §35.5 |
| `R-9-72` | `docs/audit/**` 口径：**不得改写既有 audit 文件**；**新建 delta 件仍落 `docs/audit/`** | 本 delta 件位置 |
| `R-9-78` / `R-9-79` | 参数不适用 `400` / 路径·分页批准 ⇒ 库侧仅「逐表排序键逐表明列」由实现单登记 | §35.2 keyset 列 / §35.6 |
| （附）`PZ-3` / `PZ-4` | 四语文案值 / 六类禁漏门 ⇒ **归实现单 / 质检单**（库侧无涉） | — |

- **本单落位方式**：**就地修订 v0.28（本册稿未入库 ⇒ 无新版本号）**；相对**已提交基线**（`79c103b`）**`git diff --numstat` 删除列 = 0** 且 **`difflib(autojunk=False)` 0 replace / 0 delete**；快照 `docs/versions/data-layer.spec.v0.28.md` **`cmp` 退出码 = 0**。
