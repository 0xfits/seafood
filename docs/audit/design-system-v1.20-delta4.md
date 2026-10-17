# design-system.spec v1.20 **二次勘误微回写 delta4** · JING-SPEC-CARDUI-DS-D（2026-10-17）

> 单号 **JING-SPEC-CARDUI-DS-D**（承 `-DS` / `-DS-B` / `-DS-C`）· 作者角色 = Jing（Specifier · 制度员）· 依据 = **两路独立浏览器 `getComputedStyle` 回读**（`ops/ui-card-ref-20261017/readings/kong-night-contrast.json`）＋ **质检方读数**（`ops/ui-card-ref-20261017/qa/neng-readings-ac9.json` · `…/qa/neng-readings-ac5.json`，**本单先读它们再落笔**）。**本单 = 二次勘误微回写单**（只写 `docs/**` + 本单读数）；**v1.20 就地注（不新开版本、不新开 `## §` 节、不新开 `###` 节）**；**不碰 `frontend/**`**；**未启停任何服务**；**未 `git add -A` · 未 commit · 未 push**。**★ 受本册「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束 ⇒ 旧行一律「逐字保留」，更正以「紧随其后的登记行」承接**（承 §22.11 的「已裁登记表」/ §22.12 的 `14-勘误（v1.20c）` 体例）。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| **① 值勘误**：`text-yellow-600` 的册面 sRGB 值 `#D08700`（`rgb(208,135,0)`）**作废** ⇒ 现行值 **`#CA8A04`**（`rgb(202,138,4)`）；**结论不变**（`#CA8A04` on `#FEFCE8` = **2.84:1** ≤ 改后 `#030402` on `#FFFFFF` = **20.55:1**）⇒ **属值勘误、非口径变更** | Kong `browserReadback.light/dark.probe.y600` = `"rgb(202, 138, 4)"`（**两档两读一致**）+ `nodeReadback.--color-yellow-600 = [208,135,0]`（自算路）+ Neng `neng-readings-ac9.json` **四臂** `parent.num.color` = `rgb(202, 138, 4)` / `contrast = 2.84` | §22.12 表内**紧接第 13 项**插 **`13-勘误（v1.20d）`** 行（旧行逐字保留；并写明本册凡 `#D08700` / `rgb(208,135,0)` 处均为已作废的自算值） |
| **② 定式入册（`N51`）**：同一色的册面 sRGB 值一律以「**真实元素浏览器 `getComputedStyle` 回读**」为准；canvas / Node 自算（`oklch` 转换路径）只作旁证 | Kong `crossCheck.maxChannelDiff` = `{'yellow-600': 6, 'yellow-50': 0, 'gray-800': 2}`（同色两路 **最大通道差 6/255**）⇒ 既是**取数路径差**也是**判据差**（`2.84` ⇄ `2.841`） | §22.10 末（`N50` 后）插 **`N51`**（承 `N46`「回读才是证据」同族） |
| **③ `AC-5` 范围措辞补齐（防下一轮误立案）**：承重面 = **真·非首页路由**（`/item/:id` + `/exchange` + `/task` + `/profile`）；**★ 例外点名 `/messages`** —— 现取 `pages/MessagesPage.jsx:15` = `const MessagesPage = () => <HomePage />` ⇒ **不是独立页**（渲染树 = 首页 + 面板）⇒ **卡面改造在该路由上的差异属「被批准的变更集」** | 现取 `frontend/src/pages/MessagesPage.jsx:2/15` + Neng `neng-readings-ac5.json` 的 `ac['AC-5'].homeBearingRoutes[0]`（`normalizedDiffCount = 68` = 结构项 66 + 颜色项 2；`approvedMarkerHits = 66`；`unapprovedRemainder = []`；`geometryDiffs = 0`；`attributionComplete = true`）+ `nonHomeRoutes`（8 档 `counterfactualEmptyAllCases = true` · `ok = true`） | §22.9 AC-5 行后插 **`AC-5 · v1.20d 范围补注`** 行（① 承重面点名 ② `/messages` 例外点名 ③ **`T109`-only 反事实臂不覆盖卡面**） |
| **④ 质检方 harness 自修项（非产品缺陷）**：`AC-5` 夜档臂首轮 `cf = 2` 的真因 = **首版 CF CSS 的 `:root` 在夜档下同样命中 `html` ⇒ 夜档被强灌日档旧值 `#FDE815`**（尺子灌错档）⇒ 不判负；**写死要求 = 反事实臂「日 + 夜」两档同口径回退、回退后差异集为空** | Neng `qa/neng-probe-ac5.mjs` 的 v2 注释（自曝）+ v2 复跑读数（`neng-readings-ac5.json` · `startedAt 2026-10-17T00:37:42Z`）：**`8/8` 非首页档 `cf = 0`** · `counterfactualEmptyAllCases = true` · `nonHomeRoutes.ok = true` | §22.12 表内第 16 项后插第 **17** 项 + §22.14 末条 ③ |
| **⑤ 两条未测观察入册（挂账）**：**(a)** 稀有度装饰光斑与价格块**同位重叠**（价格变宽后更明显）；**(b)** 非链接回落态 CTA 由 `<button>` 退化为只挂 `onClick` 的 `<span>` ⇒ **丢失键盘可达性 / button 语义** | 现取 `frontend/src/components/reward/RewardCard.jsx:80-87`（`.absolute top-0 right-0 w-20 h-20 … opacity-20 blur-xl`）↔ `:119-122`（`div.ml-4.sf-reward-price`）；CTA `:183-191`（`:190` = `onClick={clickable ? undefined : () => onClaim?.(reward)}`，无 `role` / `tabIndex` / Enter·Space） | §22.12 表内第 16 项后插第 **18** / **19** 项（**均标「待测 / 挂账 · 另立单」、不自选方案**） |
| **真源 `docs/design/style-preview.html` 本单零改动**（本单不产生新真源值 ⇒ 不触发 `N46` 的「加真源行 + 改 PROV 指针」双件） | 现取 `git diff --numstat docs/design/style-preview.html` = **无输出（本单零改动）** | §22.14 末条（真源面） |

## §B 改前 / 改后自证（**本单终值** · 真读数）

| 项 | 改前（本单开工现取） | 改后（**本单终值**） |
|---|---|---|
| `design-system.spec.md` 行数 | **2638** | **2646**（+8） |
| `design-system.spec.md` 字节 | **594,700** | **607,188**（+12,488） |
| `design-system.spec.md` md5 | `bc279e8a7632b87144603755d0106712` | **`6fa271687481dd69c70a5ce358b63dc5`** |
| `design-system.spec.md` sha256 | `05dbe3635cecf71b0a5a155353b7e87a088f513579fbc8b3342e100fc4d8a44c` | **`be6ceb2b9ef8bcc2a11dd1442297f39bdc16df6a44eee6aa186b00decefb046b`** |
| `git diff --numstat docs/design/design-system.spec.md` | `0 0`（HEAD 现盘 = 干净） | **`8 0`** ⇒ **删除列 = 0 ✓ 纯追加 / 无一行改写**（`+8` = 落点 ①1 + ②1 + ③1 + ④3 + ⑤1 **算术闭合**） |
| `git diff --numstat docs/design/style-preview.html` | —— | **无输出（本单零改动）** |
| 本版镜像 `docs/versions/design-system.spec.v1.20.md` | `bc279e8a7632b87144603755d0106712`（与改前 live `cmp=0`） | **`6fa271687481dd69c70a5ce358b63dc5`**（重制）⇒ 对改后 live **`cmp` = 0 ✓**；`numstat` = `8 0` |
| 三处版本记录同步 | —— | 头部 `^> \*\*★ 现行版 = v1.20` = **1**；正文 `^## §22 ` = **1**；§12 表 `^\| \*\*v1.20\*\* \|` = **1**（**均一字未动**） |
| 本单新落点在场 | —— | `AC-5 · v1.20d 范围补注` = 3；`13-勘误（v1.20d）` = 3；`` `N51` · 同一色 `` = 1；`^\| 17 \| **质检方 harness` = 1；`^\| 18 \| **稀有度` = 1；`^\| 19 \| **非链接回落态` = 1；`v1.20d 二次勘误微回写单` = 1；`HARNESS_FIXED_BY_QA` = 1；`CA8A04` = 6；`^### 22\.` = **15**（22.0–22.14 · **未新增**）；`^## §` = **24**（未新增）；`^### 5\.` = **3**（与 HEAD 同） |
| 表连续性（本单新增行**必须在表内**） | —— | §22.9：`2527 AC-5` → `2528 AC-5·v1.20d 补注` → `2529 AC-6` → … → `2532 AC-9` → `2533 AC-9·v1.20c 勘误注`（无空行断表）；§22.12：`2599 13` → `2600 13-勘误（v1.20d）` → `2601 14` → `2602 14-勘误（v1.20c）` → `2603 15` → `2604 16` → `2605 17` → `2606 18` → `2607 19` → `2608 空行`（无空行断表） |
| **值勘误的两路回读（本单取证 · 非转述）** | 自算路（已作废）：`nodeReadback.--color-yellow-600 = [208,135,0]` ⇒ `#D08700` | **回读路（册面现行值）**：Kong `browserReadback.{light,dark}.probe.y600 = "rgb(202, 138, 4)"` = **`#CA8A04`**；Neng 四臂 `parent.num.color` = `rgb(202, 138, 4)`；**两路最大通道差 `6/255`** |
| **`AC-5` 归因读数（本单引用）** | v1 版（自修前）：`item1440_night` `cf = 2`、`ok = false` | **v2 复跑**：`8/8` 非首页档 **`cf = 0`**、`counterfactualEmptyAllCases = true`、`ok = true`；`/messages` `norm = 68`（结构项 66 全归因 + 颜色项 2）、未批准 `0` · 几何 `0` · 结构 `0` · 文本 `0` |

**★ 落点清单（逐处 · 全部为**插入** · 无一行改写 · 共 8 行）**：① §22.9 AC 表（锚 = `| **AC-6** 结构不变式 |`，插在其前）**1 行**；② §22.10 末（锚 = `### 22.11 待裁项（**不得自选 · 交 Kevin / Zang**）`，含前置空行）**2 行**；③ §22.12 表内第 13 项后（锚 = `| 14 | **`dark:text-yellow-400` 在「OS 深色 × 站点日档」组合下会命中`）**1 行**；④ §22.12 表内第 16 项后（锚 = 第 16 项行尾 `归属 Kong / 收口方） |`）**3 行**；⑤ §22.14 末（锚 = 上单 v120c bullet 末句逐字收尾）**1 行**。**`§22.0`–`§22.13` 原正文一行未改。**

**★ 诚实留痕（本单 patch 事故与复原）**：**事故 1** —— ④ 的首版 `old_string` 取「表后 `★ v1.20 就地注` 块首句」，而该句**上一行是断表的空行** ⇒ 替换后 `| 17 |` / `| 18 |` / `| 19 |` **落在表外**（markdown 表被空行终止）。**检出** = 落笔后立即 `awk` 打印邻行（本单纪律：每次 patch 后复现邻行 + 复核插入点是否在表内）⇒ 当场发现并**只就去掉那枚断表空行**复原（行内容一字未动）⇒ 现取 `2604|16` → `2605|17` **连续无断** ✓。**终值自证** = `numstat` **删除列仍 = 0**（净效果 = 3 行插入；断表空行只是从第 16 项之后移到第 19 项之后）。**事故 2** = 无。**★ 终值 / 首值差额来源（留痕）** —— 本单终值为**第二遍落笔**值：首遍落笔后按现取把 `HomePage.jsx:318-320`（+ 两条测试件行号 `i18n-batch-b2.test.jsx:154/158/170` · `r9-93-points-symbol.test.jsx:157`）补进 §22.12 第 19 项行内（**本单自订新行**）⇒ 字节数由首测 `607,047` ⇒ **`607,188`**、md5 由 `296064f670e90c59dcec71a6b68219c2` ⇒ **`6fa271687481dd69c70a5ce358b63dc5`**（行数恒 **`2646`** · `numstat` 恒 **`8 0`**）。**★ 并行会话留痕（非事故）** —— 本单 08:36 首读 `neng-readings-ac5.json` 时为 **v1 版**（`item1440_night` `cf = 2`、`ok = false`）；**08:38:04 质检方并行自修 harness 并复跑** ⇒ 本单**据现取精修自订新行**（§22.12 第 17 项 + §22.9 补注 ① + §22.14 ③ —— **三处均为本单新增行、非改写 HEAD 既有行**）⇒ `numstat` 删除列仍 = 0。**口径** = `AC-5` 判负一律以 **v2 复跑**读数为准；harness 首轮残差**不作缺陷立案**。

## §C 未动面自证

```
 M docs/design/design-system.spec.md        ← 本单（二次勘误就地注 · 8 0）
 M docs/versions/design-system.spec.v1.20.md ← 本单（按终值重制 · 8 0）
 M frontend/src/**（六件）                    ← Kong 实现单（上轮 · 非本单）
 M ops/ui-card-ref-20261017/qa/**（3 件）     ← ★ 质检方并行会话（v2 harness 自修 + 复跑）
?? ops/ui-card-ref-20261017/readings/jing-v120d-readings.txt   ← 本单新建
?? ops/ui-card-ref-20261017/readings/jing-v120d-selfproof.log  ← 本单新建（.gitignore:244 *.log 命中 ⇒ git add -f）
```

- **本单一行未写 `frontend/**`**（只**只读**现取一次：`MessagesPage.jsx:15` / `RewardCard.jsx:80-87 · :119-122 · :183-191`）；`find frontend/src -newermt '2026-10-17 08:30'` = **0 件**。
- **未动 `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `ops/ui-card-ref-20261017/shots/**`**（`numstat` 四项皆空）。
- **未启停任何服务**：现取 `localhost:5787/` = **200** · `localhost:5788/api/health` = **200**。
- **未 `git add -A` · 未 commit · 未 push**。

## §D 证据件清单

| 件 | 内容 |
|---|---|
| `ops/ui-card-ref-20261017/readings/jing-v120d-readings.txt`（新建 · 13,187 B · **NOT_IGNORED**) | 七段现取读数：本单四件 / **依据证据件（先读再写 · 逐件字段）** / 册内 `#D08700` 出现处（作用面）/ 落点清单（8 行算术闭合）/ **两次 patch 事故与复原留痕 + 并行会话留痕** / 终值自证 / 未动面与 git 面 |
| `ops/ui-card-ref-20261017/readings/jing-v120d-selfproof.log`（新建 · **可复跑** · 12 段 · 5,972 B 输出） | 终值 md5/sha256/行数/字节 · `numstat` 删除列 / `style-preview.html` 未动 · 三处版本锚 · 新落点在场（10 条计数）+ 节标题数 · **表连续性**（§22.9 `AC-4`→`AC-5`→`AC-5补注`→`AC-6`…；§22.12 `13`→`13-勘误`→`14`→…→`19`）· **镜像 `cmp` = 0** · 未动面 / 服务 · **依据件现取复核**（Kong y600 两档 / nodeReadback / maxChannelDiff / Neng 四臂 / Neng ac5 逐档 cf）· 现取锚 · `.gitignore` 命中断言（**`.log` 须 `git add -f`**，承 `N42`） |
| 依据件（**本单只读** · 未改本单所写面） | `ops/ui-card-ref-20261017/readings/kong-night-contrast.json`（+`.log`）· `ops/ui-card-ref-20261017/qa/neng-readings-ac9.json` · `ops/ui-card-ref-20261017/qa/neng-readings-ac5.json`（+ 探针 `neng-probe-ac5.mjs` v2 注释） |

## §E 挂账 / 诚实清单（本单）

- **`CONFIRMED`（本单新增）**：`text-yellow-600` 的册面 sRGB 值 = **`#CA8A04`**（**两路独立浏览器回读一致**；`#D08700` 为已作废的 Node / `oklch` 自算值）；对比度结论不变（**2.84:1** vs 改后 **20.55:1**）。
- **`HARNESS_FIXED_BY_QA`（本单新增）**：`AC-5` 夜档臂首轮 `cf = 2` = **尺子错（`:root` 跨档灌日档旧值）**、非产品缺陷；质检方已自修并复跑（`8/8` 档 `cf = 0`）；**写死要求 = 反事实臂「日 + 夜」两档同口径回退**。
- **`NOT_MEASURED` · 挂账（另立单 · 本单不自选方案）**：① 稀有度装饰光斑 ↔ 价格块**同位重叠**（未做像素级重叠读数）；② 非链接回落态 CTA 的**键盘可达性 / button 语义**（未做键盘走查；生产消费点仅首页、恒传 `to` ⇒ 恒为链接态，实际影响面以质检方补完单为准）。
- **原样保留（不改写成 PASS）**：§22.12 第 1–16 项各项状态（门套 / 真机 / 参考图取样 / 数据承载 / 生成器可用性 / `variant` 数据面 / hover 阴影量 / `/hk`·`/vn` 前缀 / 夜档整卡配色 / `#101114` 暂定 / `AC-9` 取数性质 / `dark:` 两项）。
- **`UNRESOLVED` · 另立单（本单未动）**：「**夜档整卡配色（是否深色卡 / 价格是否亮黄）本轮未定，另立单**」＋ `--sf-surface-bg` 夜档 `#101114` **暂定值**复核（§22.11 夜档另议块 + §22.12 第 11/12 项）。
- **非本单写面**：`frontend/**`（Kong 实现单）· `ops/ui-card-ref-20261017/qa/**`（Neng 质检单 · 并行会话）。
