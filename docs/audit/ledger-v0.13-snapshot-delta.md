# ledger.spec v0.13 快照重建 delta（S24 · 台账 B3）

> 单号 = **S24**（Jing · 只碰规范）；性质 = **快照重建（byte-exact）**，**非新版本、非规范改动**；报告 = `docs/audit/s24-spec-decisions-and-snapshot.md` §2。

## D0 结论
- **可重建**（**不是**「从未入库」情景）⇒ 本单**新建** `docs/versions/ledger.spec.v0.13.md`，**逐字节取自 git rev `5673cae` 的 blob**，**未手工编辑一字**。
- **重建出处 rev = `5673cae`**（commit：`fix(ledger): listing_deposit 移出 HOLD_KINDS + 0019 白名单迁移（已应用，registry 18）+ Jing v0.3/ledger v0.13 规范改正 + §5.82/v0.82`，2026-09-30）。

## D1 判定读数（rev 级证据）
| # | 命令 | 读数 |
|---|---|---|
| 1 | `ls docs/versions/ledger.spec.*` | `v0.1`…`v0.12`、**（无 `v0.13`）**、`v0.14`…`v0.17` ⇒ 确为断档 |
| 2 | `git log --follow --oneline -- docs/ledger.spec.md` | `… fe48c27(v0.14) ← 5673cae ← 065e28d(v0.12) …` ⇒ v0.13 由 **`5673cae`** 产出 |
| 3 | `git show 5673cae:docs/ledger.spec.md` 第 3 行 | `> **文档状态**：**v0.13** · 已完成（19 章 + 目录 + 规则总索引，共 **109 条规则 R1–R109**）…` ⇒ **blob 版本块 = v0.13** |
| 4 | `git show 5673cae^:docs/ledger.spec.md` 第 3 行 | `> **文档状态**：**v0.12**…` ⇒ 证明 `5673cae` 即 v0.12→v0.13 的那一步 |
| 5 | `git show 7dc4495:docs/ledger.spec.md`（=`fe48c27^`） | 与 `5673cae:` **逐字节相同**（`7dc4495` 未触 ledger.spec.md）⇒ v0.13 = v0.14 改前的稳定末态 |
| 6 | `git show 5673cae:docs/ledger.spec.md \| md5` | `eee9f165704e100c98b3655d742d1ac2` · 2028 行 |

## D2 `cmp` 逐字节证据（重建后自证）
```
$ git show 5673cae:docs/ledger.spec.md > docs/versions/ledger.spec.v0.13.md   # 提取（未经任何编辑）
$ git show 5673cae:docs/ledger.spec.md > /tmp/ledger_v013_recheck.md
$ cmp docs/versions/ledger.spec.v0.13.md /tmp/ledger_v013_recheck.md          # → 0（逐字节相同）
$ git show 7dc4495:docs/ledger.spec.md > /tmp/led_7dc.md
$ cmp docs/versions/ledger.spec.v0.13.md /tmp/led_7dc.md                       # → 0（= fe48c27^ 改前主体）
```

## D3 留痕（缺口成因 · 只登记）
- **成因**：`5673cae` 产出 v0.13 时**未同时建 `v0.13.md` 快照**；后继 v0.14 回写（`fe48c27`）**只建了 `v0.14.md`**，并在其头注登记「快照链断档 —— `docs/versions/ledger.spec.v0.13.md` 不存在 … **只登记、不补历史快照**」。本单据「台账 B3」**补建**。
- **已知残差面**：`docs/audit/` 下**仍无** `ledger-v0.13-delta.md`（v0.13 当时未出 delta）；本 delta 为**事后补齐的建快照 delta**（非当时 delta 的复原）。
- **未改** `v0.1`…`v0.12`、`v0.14`…`v0.17` 任何既有快照；**未改** `docs/ledger.spec.md` 主体。
