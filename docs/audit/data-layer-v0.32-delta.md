# data-layer.spec v0.32 delta · JING-SPEC-A5-DL（2026-10-12）

> 单号 **JING-SPEC-A5-DL** · 作者角色 = Jing（Specifier · 制度员）· 依据 = Kevin 2026-10-12 逐字「直接 A+C」（`docs/OPEN-ITEMS.md` `A5` 行，commit `3ae743e`）+ Zang 结构裁定 1–9 逐字。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| 新增 §38.0 裁定来源（Z1–Z10 逐字表） | Kevin「直接 A+C」+ Zang 结构 1–9 + `F19` 并入 | `docs/data-layer.spec.md` §38.0 |
| `conversation` 完整 DDL（受限可变面：不可删 + 三列受限更新 + TRUNCATE 闸） | Z1（per-listing 唯一）+ Jing「不可删」裁死 | §38.2（`A5-DL-G1..G4/N1`） |
| `message` 完整 DDL（append-only 三闸 · 0043 体例） | Z1 + B9 体例 | §38.3（`A5-DL-G5/N2..N4`） |
| `users` +2 列（`tg_user_id` / `tg_linked_at` + 部分唯一索引） | Z4 隐私红线 | §38.4（`A5-DL-P1..P4`；code 不入库） |
| 未读计数读口（查询期聚合，无计数器） | Z7 | §38.6 |
| 频次上限数据面（20/会话/日 + 200/用户/日，UTC 日界，写路径 CTE 闸） | Z6 | §38.7（`A5-DL-R1/R2`） |
| 迁移 `0045_message_conversation.sql` + `0046_telegram_binding.sql` 内容契约 + 计数前推 | 现 `schema_migration` 43 行/`0044`、`MIGRATIONS_FROZEN=43`（p8-s4:72 / p8-s5:81） | §38.8 |
| 既有不变式冲击清单 12 条 | 全量复核 | §38.9 |
| 待裁项（bot 创建 / 双语一行 / 20 条 / Jing 提议初值） | 不得自选 | §38.10 |

## §B 改前 / 改后自证（真读数）

| 项 | 改前 | 改后 |
|---|---|---|
| 行数 | 4683 | 4885（+202） |
| 字节 | 881,757 | 907,746（+25,989） |
| md5 | `b037d6aa895f7b4220ae3a21fff20d0d` | `1e36ca8992e06b57d764f5bed204e5b4` |
| `git diff --numstat` | — | `202 0`（**删除列 = 0** ✓） |
| 快照 `docs/versions/data-layer.spec.v0.32.md` | — | `cmp` = 0（逐字节相同）✓ |
| 改前快照对照 | `docs/versions/data-layer.spec.v0.31.md`（上轮镜像，未动） | — |

## §C 范围自证

- 本单改动文件 = **恰 2**：`docs/data-layer.spec.md` + 新建快照 + 本 delta 件（`git status` 现取 = 仅 docs 面）。
- **未改** `frontend/**` / `backend-ts/**` / `vercel.json` / `docs/seafood.master-plan.md` / `docs/OPEN-ITEMS.md`；未建迁移文件；未连库；未跑任何门；未 `git add -A` · 未 commit · 未 push。
- `§21–§37` 与 `DL1..DL157` **一字未动**（追加式自证 = 删除列 0 + 版本头插入为纯插入行）。
