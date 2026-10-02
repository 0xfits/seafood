# data-layer.spec v0.9 · delta 件（Jing · Unit JING-SPEC-B6）

- **单号 / 角色**：Unit **JING-SPEC-B6** · **Jing（Specifier · 制度员）**
- **性质**：**纯规范写作（零代码改动）** —— 批 6 管理面治理两迁移（`0022` / `0023`）入册，追加式加注。
- **上位册**：`docs/data-layer.spec.md` —— **就地升 v0.8 ⇒ v0.9**；**新增节 = §20**。与 `docs/route-layer.spec.md` **v1.4 §11** 同批交付。
- **依据**：`docs/seafood.master-plan.md` §5.138 / §5.144–§5.147 + `docs/audit/p6-b6-perm-seed.md` / `p6-b6-audit-and-cap.md` / `p6-b6-audit-live.md`。

---

## D0 报数（带口径：行数 / 字节 / md5）

| 文件 | 改前 | 改后 | 位移 |
|---|---|---|---|
| `docs/data-layer.spec.md` | **1046 行 / 274767 B / md5 `bdee0a8f6f5871fbc4512e1dab39f523`** | **1070 行 / 284069 B / md5 `f63fffad343e0591934d00ba129c8683`** | **+24 行**（`git diff --numstat` = **`24  0`**）|

**改前快照** `docs/versions/data-layer.spec.v0.8.md`（该册约定：快照命名取**改前**版本号）= **开工前既存**；开工时 `cmp docs/data-layer.spec.md docs/versions/data-layer.spec.v0.8.md` ⇒ **退出码 0**、`md5` 同 `bdee0a8f…`、**1046 行**、**274767 B** ⇒ **改前正文逐字节相同、可独立复核**；本单**未新建 / 未改动**它。二次自证：`git show HEAD:docs/data-layer.spec.md | cmp - docs/versions/data-layer.spec.v0.8.md` ⇒ **退出码 0**（`DATA_PRE_CMP0`）。

**★ 只追加自证（既有节零删除）**：`git diff --numstat` = **`24  0`**（**删除数 = 0**）⇒ **无任何既有 `DL*` 行被删除 / 改写**；本册全部改动 = **纯新增行**（新状态行 1 行 + §20 全文 23 行）。

---

## D1 逐条落地（加注对象 → 依据 → 落点）

| # | 加注对象 | 依据（Zang）| 真源 | 落点 |
|---|---|---|---|---|
| `AN8` | 新表 `public.admin_ops_audit_log`（15 列；PK×1 / FK×3 / CHECK×4 / **UNIQUE×1** = `UNIQUE(idempotency_key, result)` / 索引×4；只增不删） | §5.144–§5.146 | `migrations/0023_admin_points_audit_daily_cap.sql:82-99`（**391 行**，本册现取）| **§20** |
| `AN9` | append-only 触发器 `trg_admin_ops_audit_log_append_only`（`BEFORE UPDATE OR DELETE` 无条件 RAISE；手法同 `0017`） | §5.145 | `0023:114/124-127`；`p6-b6-audit-and-cap.md §2` | **§20** |
| `AN10` | 新函数 `public.admin_points_adjust_post_event(jsonb) RETURNS jsonb`（唯一资金写路径；取锁 → 存在性闸 → 日累计闸 → `ledger_post_event` → 写审计行 → 回执；**同函数同语句**；阈值 `CONSTANT 1000000` 标 `TODO: Kevin 定值`；**日累计只计 `result='applied'`**；被拒留痕 `rejected_daily_cap` 且零资金分录；**函数不得 `RAISE`**） | §5.144 / §5.145 / §5.146 | `0023:157-228`；`p6-b6-audit-and-cap.md §2/§4/§7/§8`；`p6-b6-audit-live.md §5/§6` | **§20** |
| `AN11` | 迁移 `0023` 的 `p3x` 同步（`VERSION_ORDER += '0023'`；`schema_migration 21⇒22`、`triggers 43⇒44`；索引 `65⇒65` 不变；`0001–0022` 零字节改动） | §5.145 | `p6-b6-audit-and-cap.md §2.1` | **§20** |
| `AN12` | 迁移 `0022_admin_permission_seed.sql`（**纯 DML**、177 行、已 apply；`admin_permission 11 / admin_role 1 / admin_role_permission 11 / admin_user_role 1`；幂等 `ON CONFLICT DO NOTHING`；apply-time `DO $$` 自检；**不动任何表结构**） | §5.138 | `migrations/0022_admin_permission_seed.sql`；`p6-b6-perm-seed.md §2/§3/§5` | **§20** |
| `AN13` | 权限单一真源与「第三真源删除」的**数据层归属**（只登记连带面，不改正文） | §5.138 | `p6-b6-perm-seed.md §4` | **§20** |
| `AN14` | **待复核登记**：`admin_ops_audit_log` 是否落入 `DL75`「必建项」三件套范围（`DL75`/`DL156` 逐表清单未与本表对照）⇒ 标 `NOT_MEASURED`、**不下断言** | — | `DL75` / `DL156` | **§20** |

**§20.1 指纹自证**：改前（v0.8）= 1046 行 / 274767 B / md5 `bdee0a8f6f5871fbc4512e1dab39f523`（开工现取）；改后（v0.9）行数 / 字节 / md5 = 见本件 **D0**。

---

## D2 非追加改动（逐处）

**非追加改动 = 0 处**。`DL*` 编号域**零改动**（仍 **`DL1..DL157`**，**不新增** `DL` 条）；**章节编号未重排**（新内容向后追加为 **§20**）；既有 `DL` 条文**一字未改**、旧写法**不静默重写**。版本头采用**纯插入**写法（新 v0.9 状态行插在原 v0.8 状态行之前，**原行逐字节保留**）⇒ `numstat` 删除数 = **0**。

---

## D3 `NOT_MEASURED`（**逐项，禁填 0 / 空**）

| # | 未测项 | 原因 / 转引锚点 |
|--:|---|---|
| 1 | `0023` 表 / 函数 / 触发器的 **apply 后真库结构现值**（本册零库连接）| 转引 `p6-b6-audit-and-cap.md §7.2`（事务内重放读数）+ `p6-b6-audit-live.md §5`（`pg_get_functiondef` 只读摘录、`schema_migration=22`）|
| 2 | `0022` **apply 后真库终态**（四表行数）| 转引 `p6-b6-perm-seed.md §5`（`schema_version=0022`、`admin_permission=11 / admin_role=1 / admin_role_permission=11 / admin_user_role=1`）|
| 3 | `admin_ops_audit_log` 是否落入 `DL75` 三件套适用范围 | 本册**未逐表复核** ⇒ 登记 `AN14`、**不下「已豁免」/「必须补列」断言** |
| 4 | 审计表**体量与清理 / 归档策略**（`rejected_daily_cap` 行随被拒请求增长）| 转引 `p6-b6-audit-and-cap.md §7.4-4`（未建清理任务、未压测速率）|
| 5 | `app_config` 化日累计阈值 | 未决（本批用服务端常量）⇒ 转引 `p6-b6-audit-and-cap.md §7.4-5` |
