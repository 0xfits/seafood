# ledger.spec v0.14 → v0.15 · delta 件（P9⑤ C3 规范回写）

> **性质**：本件 = `docs/ledger.spec.md` 由 **v0.14 → v0.15** 的逐条改动记录（Jing · Unit **JING-SPEC-P9-5C3**；**只追加 / 就地增补 · `git diff --numstat` 删除列 = 0**）。
> **裁定来源**：`docs/seafood.master-plan.md` **§5.269 B/C**（`R-9-64` / `R-9-65` / `R-9-66`）+ `docs/commission.spec.md` v0.4 §19。

## 1. 版本与快照

| 项 | 值 |
|---|---|
| 改前版本 | **v0.14**（快照 `docs/versions/ledger.spec.v0.14.md`，md5 `2d071b5ee70efff27351493f133f3c11`，**2044** 行 / **467967** 字节） |
| 改后版本 | **v0.15**（快照 `docs/versions/ledger.spec.v0.15.md`，md5 `19a51009d9bd798453be19438f69cd7e`，**2084** 行 / **485141** 字节） |
| 快照自证 | `cmp docs/ledger.spec.md docs/versions/ledger.spec.v0.15.md` ⇒ 退出码 **0**（逐字节相同） |

## 2. 只追加自证

- `git diff --numstat docs/ledger.spec.md` ⇒ **`40	0`**（**删除列 = 0**）。
- `difflib.SequenceMatcher(autojunk=False)` 对 **HEAD（v0.14）** 与改后逐行比对 ⇒ **仅 `equal` / `insert`，`replace` = 0、`delete` = 0**。
- 插入行数 = **40**；行数增量 = 2084 − 2044 = **40**（**相等**）。

## 3. 逐条改动点（只增）

| # | 落位 | 内容 | 增行 |
|---|---|---|---|
| ① | 文件头（v0.14 行**之前**） | 新增 **v0.15 状态行**（`kind` 23 → 24 + `−1` debit 首开 + `R103` 就地修订）；**v0.14 行未改写、保留留痕** | 1 |
| ② | **§5.1**（表末位，`checkin_makeup_fee` 行之后） | 追加 1 行 `| **新增** | invite_first_task_reward | … |`（`uid = −1` 出账；本人 + 直接上级各 `+firstTaskUsd`；净增发 0） | 1 |
| ② | **§5.1**（v0.14 加注块之后） | 新增 **v0.15 加注块**（依据 / 落位 / **24 值** / **三处编码** / **三列登记** / **DB 落点 `0038`** / 影响面） | 6 |
| ③ | **§13.3**（v0.14 块之后） | 新增 **v0.15 块**：`R101` `−1` **`debit` 首开仅 1 项**、`credit` 8 值不变；**`R103` 就地修订**（区分「运维提取留白不变」⇄「需求规定的发放放行」）；判负（白名单外仍必红）；**显式登记 + 一句话可改**；落地边界 | 6 |
| ④ | **§14.3**（R103 错误行之后） | 新增 **1 行**：`invite_first_task_reward` 白名单内放行 / 白名单外仍拒（`code = LEDGER_RESERVED_UID` / `400`） | 1 |
| ⑤ | **§15**（表后、§16 之前） | 新增 **§15 #3 加注块**（**本项与 `invite_first_task_reward` 无关**） | 2 |
| ⑤b | **§17 索引**（索引表后、§18 之前） | 新增 **v0.15 索引注**（`R40`/`R101`/`R103` 旧写法留痕 · 以 §5.1/§13.3 v0.15 块为准；kind 24 / `−1` debit 首开 / `R103` 留白不变） | 2 |
| ⑥ | **§18 变更记录**（v0.13 行之后） | 新增 **v0.15 行** | 1 |
| ⑥ | **§19 末**（§19.17 之后） | 新增 **§19.18**（`R-9-64`/`R-9-65`/`R-9-66` 逐条 + 落位索引 + 诚实边界） | 20 |
| 合计 | | | **40** |

## 4. 关键口径（逐字）

- **kind 面**：`invite_first_task_reward`（**23 → 24**，**末位追加、不改既有次序**）；**三处编码同集** = DB `ledger_kind_enum` CHECK **24 值** / DB `ledger_kind_ok`（**`p_frozen_settle` 第二支一字不动**）/ TS `LEDGER_KINDS`（`ledger.ts:168-178`）。**错误码闭集 33 不动**。
- **`R101`**：`−1` `credit` 8 值（`trade_fee`/`listing_fee`/`currency_create_fee`/`job_fee`/`listing_deposit`/`checkin_makeup_fee`/`bttc_mint_fee`/`bttc_burn_fee`）**逐字不变**；**`−1` `debit` 首开、仅 1 项 `invite_first_task_reward`**。
- **`R103`**：**「平台运维提取」留白保持不变**（`platform_withdraw` 仍未批；后台不得提供提取按钮）—— 与「**需求 §6.2② 明文授权的发放**」（系统内转移，经 `R101` 白名单放行）**不同层级**。
- **`R-9-64` 更正**：`0037` 播种源 = **`0011:81-145`**（非 `0007:317-354`）；`grep -c v_closed` ⇒ `0011`=5 ⇄ `0007`=0。

## 5. 未测项（禁填 0 / 空）

- `0038` 的 `R-9-24` 真跑自证 + 四项读数**未跑**（`0038` 现取 = 文件在盘、**未 apply**）⇒ 归 P9⑤ 实现单。
- 两新方法（`grantSignupInviteBatt` / `settleInviteFirstTaskReward`）**未真跑**；首任务腿**未接线**（`0038` 未 apply 时接线 = 静默必失败写入 ⇒ 实现方只留可调用入口）。
- **本册未连库、未启停服务、未跑迁移/探针、未改代码**（`backend-ts/**` 只读）。
