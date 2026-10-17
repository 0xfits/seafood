# design-system v1.21 · 顶栏实黄 delta（Jing / Specifier · 2026-10-17）

## A. 本单改动面（只写 `docs/**` + 本单读数）
| 件 | 动作 |
|---|---|
| `docs/design/design-system.spec.md` | **纯追加 181 行**：版本头 v1.21 行（插入于 v1.20 行之后）+ §12 表 `| **v1.21** |` 行（插入于 v1.20 行之后，表内）+ **§23（新 · 2649 行起 · `T114`–`T119` + 对比度表 + 断言清单 + 归因式 AC + 教训 `N52`/`N53` + 诚实清单 + 快照自证）** |
| `docs/versions/design-system.spec.v1.21.md` | **新建**（本版镜像） |
| `docs/audit/design-system-v1.21-delta.md` | **新建**（本件） |
| `ops/ui-card-ref-20261017/readings/jing-v121-*` | **新建**（读数 / 原始 JSON / 自证 log）|

## B. 行数 / 字节 / 摘要（现取）
- **改前 live** = `2646 行 / 607,188 B / md5 6fa271687481dd69c70a5ce358b63dc5`
  （= `docs/versions/design-system.spec.v1.20.md` 逐字节相同 · **开工复核 `cmp` = 0**）
- **改后 live** = **`2819 行 / 651,259 B / md5 7c3995951ab45ca61ba51a599a3a99f6`**
  **`sha256 = b843f50a710e37b76d1b4dd69539dd2b94039379f8b87636099a47b38f15a506`**
  ⇒ **+173 行 / +44,071 B**
- **`git diff --numstat docs/design/design-system.spec.md` = `181 0`** ⇒ **删除列 = 0（纯追加 ✓）**
- **本版镜像** = `docs/versions/design-system.spec.v1.21.md`（对改后 live **`cmp` = 0** ·
  同 `md5 7c3995951ab45ca61ba51a599a3a99f6` / `2819 行 / 651,259 B`）

## C. 「原字面一字未动」自证（反删重建 · 比 `numstat` 更硬）
把改后 live **只删掉本单的三处新增**（版本头 v1.21 行 · §12 的 v1.21 行 · `## §23 ` 起的整块）
⇒ 重建件与 **改前快照** `docs/versions/design-system.spec.v1.20.md` 的 **`cmp` = 0**
⇒ `§1`–`§22`（含 v1.20d 微回写面）**逐字节未动**。

## D. 三处版本记录同步（各恰 1 命中）
```
grep -c '^> \*\*★ 现行版 = v1.21' docs/design/design-system.spec.md  -> 1   (行 22 · v1.20 行之外、姊妹册行之前)
grep -c '^## §23 '                docs/design/design-system.spec.md  -> 1   (行 2649 · 文件末节)
grep -c '^| \*\*v1.21\*\* |'      docs/design/design-system.spec.md  -> 1   (行 829 · §12 表内 · v1.20 行之下)
```
**邻行核验**：HDR 前 = `> **★ 现行版 = v1.20 …` · HDR 后 = `> **★ v1.10 姊妹册（同批交付）** …`；
ROW 前 = `| **v1.20** | 2026-10-17 | …` · ROW 后 = 空行 ×2 ⇒ `### 与上游文件的关系`（**表未被空行断开** ✓）。

## E. 未动面自证
```
git status --porcelain frontend backend-ts tools ctrl docs/design/style-preview.html  ->  （空）
```
- **未动** `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html`；
  **未启停任何服务**；**未 `git add -A` · 未 commit · 未 push**。
- **真源零改动**（预期即零）：三个槽位（`topbar-bg` / `topbar-border` / `brand-fg`）均已在 `style-preview.html`
  与 `tokens.js` PROV 表内存在 ⇒ **本单不产生新真源值**（`T118`；若实现方要新增 ⇒ 走 `N46` 双件 + 停下上报）。
- **本单未触碰** `ops/ui-card-ref-20261017/shots/**`（该目录下新增的 `neng-*` 截图属并行质检单，非本单产出）。

## F. 证据落点
- `ops/ui-card-ref-20261017/readings/jing-v121-readings.txt`（现取真渲染读数 · 14 行对比度表 · 候选机制注入自证 · 机制坑实测 · 诚实清单）
- `ops/ui-card-ref-20261017/readings/jing-v121-readings.json` / `-dark.json` / `-mobile390.json` / `-sticky.json` / `-light-current.json`（逐档原始 JSON）
- `ops/ui-card-ref-20261017/readings/jing-v121-selfproof.log`（可复跑命令；**★ `.log` 被 `.gitignore:244` 命中 ⇒ 入库须 `git add -f`**，承 `N42`）

## G. 留给实现 / 质检的硬项（本册 §23.5）
- `AC-1` 日档三档像素 = `rgb(253,232,21)` + alpha = 1 + `backdropFilter: none` + 边框 `rgb(3,4,2)`；
- `AC-2` 夜档 **冻结**逐值不变 + **反向自证**（去掉 `:root:not([data-theme="dark"])` ⇒ 夜档必须变 `rgb(11,12,14)`）；
- `AC-3` §23.3 表逐行复算（**含真 `:hover` 回读 —— 本单因环境限制 `NOT_MEASURED`**）；
- `AC-5` 归因式「全站顶栏面」+ 反事实臂 **日/夜两档分别回退** ⇒ 差异集为空；
- `AC-8` 两向灵敏度自证；`AC-9` 零几何；`AC-10` 移动档（含待裁 `Q10`）。
