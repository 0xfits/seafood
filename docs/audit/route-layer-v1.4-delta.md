# route-layer.spec v1.4 · delta 件（Jing · Unit JING-SPEC-B6）

- **单号 / 角色**：Unit **JING-SPEC-B6** · **Jing（Specifier · 制度员）**
- **性质**：**纯规范写作（零代码改动）** —— 把批 6 已上线的裁定与实测写进权威册。
- **上位册**：`docs/route-layer.spec.md` —— **就地升 v1.3 ⇒ v1.4**；同批同步 `docs/data-layer.spec.md` **v0.8 ⇒ v0.9**。
- **依据**：`docs/seafood.master-plan.md` **§5.137–§5.151**（本批全部裁定与实测）+ 审计件 `p6-b6-perm-seed.md` / `p6-b6-audit-and-cap.md` / `p6-b6-audit-live.md` / `p6-d1prime-errclass.md` / `p6-d1prime-sweep.md` / `p6-fe-perf.md`。

---

## D0 报数（带口径：行数 / 字节 / md5）

| 文件 | 改前 | 改后 | 位移 |
|---|---|---|---|
| `docs/route-layer.spec.md` | **2353 行 / 503209 B / md5 `ed0835a352b0560f2adb2602af5a7471`** | **2459 行 / 530839 B / md5 `4ba6b8a1554accc2808086606a1bf37d`** | **+106 行**（`git diff --numstat` = **`106  0`**）|
| `docs/data-layer.spec.md` | **1046 行 / 274767 B / md5 `bdee0a8f6f5871fbc4512e1dab39f523`** | **1070 行 / 284069 B / md5 `f63fffad343e0591934d00ba129c8683`** | **+24 行**（`git diff --numstat` = **`24  0`**）|

**快照自证**：
- `docs/versions/route-layer.spec.v1.4.md`（**新建** = **新版号 + 改后正文**）= `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.4.md` ⇒ **退出码 0**（`ROUTE_CMP0`），md5 **`4ba6b8a1554accc2808086606a1bf37d`**（与 live 逐字节相同）。
- `docs/versions/data-layer.spec.v0.8.md`（**该册「改前快照」** = 开工前既存、**未改动**）= `git show HEAD:docs/data-layer.spec.md | cmp - docs/versions/data-layer.spec.v0.8.md` ⇒ **退出码 0**（`DATA_PRE_CMP0`）。

**★ 只追加自证（既有节零删除）**：`git diff --numstat` 对两册均为 **`N  0`**（**删除数 = 0**）⇒ **无任何既有行被删除 / 改写**；两册的**全部改动 = 纯新增行**（route-layer +106、data-layer +24）。

---

## D1 逐条落地（派单 4 条事实 → 依据锚点 → 改动点）

| 派单事实 | 依据（Zang） | 真源（本册现取 / 转引） | 落点 |
|---|---|---|---|
| ① 权限种子 `0022` + `isAdminAddress` 单一真源 + 「先 apply 后部署」顺序依赖 | §5.138 + §5.143（BE-PERM 验收 / 生产终验）| `migrations/0022_admin_permission_seed.sql`（**177 行**，本册 `wc -l` 现取）；`p6-b6-perm-seed.md` §1/§4/§5 | 顶部 v1.4 状态块 ①；**§11.1**（新）|
| ② 审计表 / 日累计 `0023`（阈值 `TODO: Kevin`、只计 `applied`、被拒留痕但不计入累计、`UNIQUE(idempotency_key,result)`、函数不得 `RAISE`| §5.144–§5.147 | `0023_…`（**391 行**；关键行号 `:82-99/114/125/157/161-162/214-228` 本册现取）；`p6-b6-audit-and-cap.md` §7/§8；`p6-b6-audit-live.md` §5/§6 | 顶部 v1.4 状态块 ②；**§11.2**（新）|
| ③ 错误语义 D1'（`code==null` ⇒ 503 + `driver_connection_error`；401 只在凭据面且在 DB 调用前；26 面收口；2 处假成功改 `throw`）| §5.147 / §5.149 / §5.150 | `src/ledger-errors.ts:487/500/514/519`、`src/index.ts:419/1498`（本册现取）；`p6-d1prime-errclass.md`、`p6-d1prime-sweep.md` | 顶部 v1.4 状态块 ③；**§11.3**（新）|
| ④ 前端实现纪律（禁重引 CDN / 兼容层必进 `@layer` / 动态类名必 safelist / 测试字面量必拼接 / 按钮口径）| §5.132 / §5.135 / §5.138–§5.142 / §5.151 | `p6-fe-perf.md` §1–§15 | 顶部 v1.4 状态块 ④；**§11.4**（新）|

**另**：**§11.5**（新）= 本批入册的审计件与真源锚点表；**§8.16**（新）= v1.4 变更记录与自曝（写盘范围 / `NOT_MEASURED` 75–81 / 自曝 82–84 / delta 对照 / 纪律自检）。

---

## D2 非追加改动（**逐处，若 0 则明写 0**）

**非追加改动 = 0 处**。本单**未就地订正任何既有条文**（§1–§10 一字未动）；**唯一新增** = 顶部 v1.4 状态块（插入）+ **§11**（文件末追加）+ **§8.16**（§8.15 之后、§9 之前插入）。`git diff --numstat` 的**删除数 = 0** 即自证。

> 说明：`data-layer.spec.md` 的版本头采用**纯插入**写法（新 `> **文档状态（最新）**：v0.9 …` 行插在原 v0.8 状态行**之前**，**原行逐字节保留**）⇒ 其 `git diff --numstat` 亦为 `24  0`（**删除数 = 0**）。

---

## D3 数据层同步

`0023` 涉**表 / 触发器 / 函数 / 约束** ⇒ 已同批在 **`docs/data-layer.spec.md` v0.9 §20**（`AN8`–`AN13` + `AN14` 待复核登记 + §20.1 指纹自证）**追加式登记**；`0022`（纯 DML）⇒ 同处 `AN12`。数据层 delta 件 = `docs/audit/data-layer-v0.9-delta.md`。

---

## D4 `NOT_MEASURED`（**逐项，禁填 0 / 空**；本册侧 = §8.16.2 的 75–81）

| # | 未测项 | 原因 / 转引锚点 |
|--:|---|---|
| 75 | 生产（`https://ssseafood.vercel.app`）面本册复读 | 本册零 HTTP / 零部署 ⇒ 转引 `master-plan §5.148` |
| 76 | 迁移 `0022` / `0023` apply 后真库终态本册复读 | 本册零库连接 ⇒ 转引 `p6-b6-perm-seed.md §5` / `p6-b6-audit-live.md §0` |
| 77 | `isAdminAddress` 收敛后全站 admin 端点回归面 | 转引 `p6-b6-perm-seed.md §7`（只跑两个代表端点 + 401/403 负例）|
| 78 | 日累计拒绝的 HTTPS 生产面 | 真库 live 未触发（不得造百万点）⇒ 转引 `p6-b6-audit-live.md §6/§8` |
| 79 | 前端「用户可见差异 = 0」的 640–1023px 断点与暗色档 | 转引 `p6-fe-perf.md §15.7` |
| 80 | 未渲染 palette 类（约 70 个）与 `hover/focus/dark` 变体 | 转引 `p6-fe-perf.md §15.7` |
| 81 | `app_config` 化日累计阈值 | 未决（本批用服务端常量）⇒ 转引 `p6-b6-audit-and-cap.md §7.4-5` / `p6-b6-audit-live.md §8` |

---

## D5 纪律自检（对照 §5.7 与派单纪律）

① **退出码不取自管道之后** ✅（本单无管道后 `$?`；`cmp` 退出码直取）｜② **报数带口径** ✅（D0：行数 / 字节 / md5 + `git diff --numstat`）｜③ **引用行号现取** ✅（本册现取清单 = §8.16.3-82；其余转引并标注）｜④ **`NOT_MEASURED` 禁填 0/空** ✅（D4 七项）｜⑤ **只追加 + 自证「既有节零删除」** ✅（`numstat` 两册删除数 = 0）｜⑥ **预算 40 calls** ✅（本单 calls ≤ 40）｜⑦ **硬红线** ✅（只写 spec / 快照 / delta；**未碰** `backend-ts/**` / `frontend/**` / `migrations/**` / `docs/seafood.master-plan.md` / 既有 audit 件 / `.env*`；**未** `git add/commit/push` / `npm` / `vercel` / DDL / DML / `pkill` / `killall` / heredoc；**未读任何密钥或 `.env*` 值**）。
