# route-layer.spec v2.19 → v2.20 · delta 件（P9⑤ C3 规范回写）

> **性质**：本件 = `docs/route-layer.spec.md` 由 **v2.19 → v2.20** 的逐条改动记录（Jing · Unit **JING-SPEC-P9-5C3**；**只追加 · `git diff --numstat` 删除列 = 0**）。
> **裁定来源**：`docs/seafood.master-plan.md` **§5.268 B / §5.269 B·C**（`R-9-64` / `R-9-65` / `R-9-66`）；姊妹册 = `ledger.spec` v0.15 / `commission.spec` v0.5 §19.12 / `data-layer.spec` v0.27 §34.9。

## 1. 版本与快照

| 项 | 值 |
|---|---|
| 改前版本 | **v2.19**（快照 `docs/versions/route-layer.spec.v2.19.md`，md5 `660ec5e92ec89ad27d6973dcff7bf559`，**7279** 行 / **1423358** 字节） |
| 改后版本 | **v2.20**（快照 `docs/versions/route-layer.spec.v2.20.md`，md5 `93d059c085690c637a0624f5a73ea10d`，**7291** 行 / **1426614** 字节） |
| 快照自证 | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.20.md` ⇒ 退出码 **0** |

## 2. 只追加自证

- `git diff --numstat docs/route-layer.spec.md` ⇒ **`12	0`**（**删除列 = 0**）。
- `difflib(autojunk=False)` ⇒ **仅 `equal` / `insert`，`replace` = 0、`delete` = 0**；行数增量 = 7291 − 7279 = **12** = 插入行数。

## 3. 逐条改动点（只增）

| # | 落位 | 内容 | 增行 |
|---|---|---|---|
| ① | 文件头（v2.19 行**之后**） | 新增 **v2.20 状态行**（`kind` 23 → 24 + `−1` debit 白名单首开 + `R103` 就地修订）；**v2.19 行未改写、保留留痕** | 1 |
| ② | **§31 末**（§31 只追加自证块之后、册末 `---` 之前） | 新增 **§31.11**：kind 24 口径 + `−1` debit 白名单首开（承 §31.4 错误面增注）+ `R103` 就地修订（分层）+ 未测项 | 11 |
| 合计 | | | **12** |

## 4. 关键口径（逐字）

- **route 侧零新口 · 注册点 `87 → 87`（+0）**：邀请奖励 = 结算腿（随 `job settle`），无独立读 / 动作口；权限键 11 键内（`R-9-59`）。
- **kind 面（23 → 24）**：末位追加 `invite_first_task_reward`；三处编码同集；**错误码闭集 33 不动**。
- **`−1` debit 白名单首开（`R101`）**：`credit` 8 值不变、`debit` 首开仅 1 项；**白名单外 `−1` debit 仍拒** —— `code = LEDGER_RESERVED_UID` / `400`（借既有闭集，零新增码）；`reason` **非契约**。
- **`R103` 留白不变**：`platform_withdraw` 未批、后台不得提供提取按钮；与「需求 §6.2② 明文授权的发放」（系统内转移）**不同层级**。

## 5. 未测项（禁填 0 / 空）

- `0038` 真跑自证 + 四项读数**未跑**（文件在盘、**未 apply**）；真生效四段 HTTP 实跑**未做** ⇒ `NOT_MEASURED`（归实现单 + 质检单）；首任务腿**未接线**。
- **本册未连库、未启停服务、未跑迁移/探针、未改代码。**
