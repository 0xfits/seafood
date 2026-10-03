# data-layer.spec v0.18 delta —— 批 9 第 1 片（P9①）契约冻结：**后台可配置面**

> **角色**：Jing（Specifier · 制度员）· **单号** = **JING-SPEC-P9-1** · **同批姊妹册** = `docs/audit/route-layer-v2.11-delta.md`（正文 = `route-layer.spec` v2.11 §26）。
> **口径**：**只追加 · 零代码 · 零迁移 · 库面只读（事务内 + `ROLLBACK`）· 零 HTTP · 零套件**。
> **依据**：Zang `§5.217` D 派单（`docs/seafood.master-plan.md:1440`）+ Kevin 三答（同文件 `:1424-1426`）+ `R-9-6` / `R-9-8`（同文件 `:1429-1430`）+ **追加** `R-9-10` / `R-9-8` 更正 / `R-9-11`（本单 steer）。

## §D0 指纹（改前 / 改后 · 现取）

| 项 | 改前（v0.17） | 改后（v0.18） |
|---|---|---|
| 文件 | `docs/data-layer.spec.md` | 同 |
| 行数（`wc -l` = 换行符数） | **2497** | **2750** |
| 逻辑行 | **2497**（末行带换行） | **2750** |
| 字节 | 522555 | **567651** |
| md5 | `a6eb8cecd755a0eec0aea9beac004a2f` | **`2f84b22abaeb0c7041e73a24875a5f6a`** |
| sha256 | `a92a470dffa3c20a808698a0b0768cf6b8a6db561f30fab39c63c91b1738dbd3` | **`d3dfa1de92ac2b44007d66f2c92eaaf7550918a24444975aa8dbef1100d8de8a`** |
| 改前快照 | `docs/versions/data-layer.spec.v0.17.md`（`cmp` = 0 · **未动**） | — |
| 改后快照 | — | **`docs/versions/data-layer.spec.v0.18.md`**（`cmp` = 0 · sha256 同上） |

**只追加自证**：`git diff --numstat docs/data-layer.spec.md` = **`253\t0\tdocs/data-layer.spec.md`**（**删除列 = 0**）；`difflib.SequenceMatcher` 独立复核 = **0 replace / 0 delete / 253 insert**；**旧快照 `v0.1`–`v0.17` 一十七件一字未动**（`git status --porcelain docs/versions/` = 仅 `v0.18` 一件 untracked）✅。

## §D1 改动点（逐条）

| # | 落点 | 内容 |
|--:|---|---|
| 1 | **顶部状态块区**（`# 标题` 与 `v0.17 状态行` 之间） | **新增 v0.18 状态行 1 行**（⇒ 其后全部行号 +1） |
| 2 | **§29〔新〕**（追加于本册末行之后） | P9① 契约冻结：§29.0 性质与硬约束 / §29.1 **现取锚（16 条 · 逐条 `文件:行` / 命令 / 读数）** / §29.2 **P9 数值项配置键全表（既有 2 + 候选 B1–B7）· 白名单 `2 → 9` · 「在册 ≠ 可写」三重复核** / §29.3 **角色文案 + 站点标语覆盖层三载体变体 + 每案代价（不择一）** / §29.4 **与 8① 机制衔接（形态 A/B · `AV1`–`AV5` · `ops:` · `reason` 常量 · 下限 fail-closed · 不得第二套写入面）** / §29.5 **小数位契约** / §29.6 **真生效（②段库面 + 事务内 `ROLLBACK`）** / §29.7 **权限键映射（11 键）** / §29.8 **六类禁漏 + 非数值项登记** / §29.9 `NOT_MEASURED`（9 项）/ §29.10 指纹自证 / §29.11 引用关系 / **§29.12 `R-9-10` 追加（站点标语四语 · 显式白名单 · 拆键 `siteSlogan` · `index.html:8` 边界 · 测试连带）** / **§29.13 `R-9-8` 范围更正 + `R-9-11` `vn` 定案** |
| 3 | **§29 标题之后（仅 1 行注 · insert）** | **★ 标题口径（诚实登记）**：「（中/越）」= `R-9-8` 原口径 · 经更正 = **四语** · **以 §29.13 为准**（守「只追加」⇒ 不改标题文本） |

**非追加改动 = 0 处**；`§21`–`§28` 与 `DL*` 条文一字未动。

## §D2 与 Zang 裁定的对应（诚实登记）

- **派单履约（`§5.217` D）**：① 覆盖层三变体 + 代价（§29.3 · 不择一）✓；② **P9 全部数值项键全表 + 白名单 `2 → N`**（§29.2 · `N = 9`）✓；③ 与 8① 机制衔接不破（§29.4）✓；④ 权限键 11 键内（§29.7）✓；⑤ 真生效判据（§29.6）✓；⑥ 小数位契约（§29.5）✓；⑦ 后台页 + 四语命名空间 + 六类禁漏（§29.8 + 姊妹册 §26.6）✓。
- **追加裁定**：
  - **`R-9-10`**（§29.12）：覆盖层扩展为「四角色名 + 站点标语（四语）」；`site_text_overrides` 显式白名单；`siteTitle` 拆键（新 `siteSlogan`）；`index.html:8` 已知边界；测试连带。
  - **`R-9-8` 范围更正 + `R-9-11` 定案**（§29.13）：四角色名 = **四语**（原 zh/vn 作废）；**四角色名 = 新增键**（现取坐实 locale 无键）；四语初值定稿（`vn` = 英文 = **正式口径**）；四语键集相等 + 缺语 fail-closed。
- **承接（只读引用）**：`R-9-6`（batt 独立数据面 ⇒ 参数落 `batt_policy`，不触 kind 闭集）。
- **未发明**：键名（**候选** · 依 §21.3 规则③ 从既有两样本反推）、数值（一律引需求书逐字行或标 `TODO: Kevin 定值`）、状态值、路径、权限键、文案值 —— 一律「候选」「待裁」或 `NOT_MEASURED`。

## §D3 `NOT_MEASURED`（逐项 · 禁填 0 / 空）

| # | 未测项 | 原因 |
|--:|---|---|
| 1 | P9 候选键写入 / 读取（过 `AV1`–`AV5`） | 规范单零代码 + 候选键**未入册** ⇒ 入册前写入必被 `AV1` 拒；HTTP `NOT_MEASURED` |
| 2 | 覆盖层三变体实跑（含前端实时生效） | 规范单零代码；判据已写死、未实跑 |
| 3 | `rating_policy.storageDecimals` 真值 | 需求未给位数 ⇒ `TODO: Kevin 定值` |
| 4 | `checkin_policy.streakDay7RewardBatt` 真值 | 需求未给数 ⇒ `TODO: Kevin 定值` |
| 5 | 权重 `weights_bp` 改 6 项的分配复算 | 归 **P9⑤** ⇒ 本片未跑 |
| 6 | 前端四语文案「值」 | 产品 / 文案决策 ⇒ 本单不写 |
| 7 | `siteSlogan` 拆段各语「值」 | 文案决策 ⇒ 本单不写 |
| 8 | 覆盖层 `site_text_overrides` 实跑（含 `document.title`） | 规范单零代码 |
| 9 | 覆盖层四语键集相等性 + 缺语 fail-closed 实测 | 规范单零代码（门 `J-10`）；★ **`vn` = 英文 = 已定案（`R-9-11` · 非缺口）** |

## §D4 库面读数（本单唯一实跑 · 事务内 + `ROLLBACK`）

- 真库 `public.app_config` = **恰 1 行** `{key:'system_settings', vtype:'object', updated_by:'1', time_updated:'2026-10-02T14:14:07.502Z'}` ⇒ **真库仅 1 键**；`listing_deposit_policy` **无行**。
- `schema_migration`：`max(version)=0027` / 已 apply **26**；尾三 = `0027_job_arbitration_log.sql` / `0026_listing_review_log.sql` / `0025_currency_review_log.sql`。
- 探针（scratch）：`SELECT … FROM public.app_config` 于 `BEGIN … ROLLBACK` 内执行（`rollback: OK`）；**未写任何行、未 apply 迁移、未启停服务、未打印 `.env`**。
