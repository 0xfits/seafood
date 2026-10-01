# P6 · 按钮参考值立设计真源 + PROV 合法形式口径（Jing）

- 单号：**Unit JING-BTN-SRC**（角色 = **Jing · 真源/规范**，只写真源与报告，**不写代码**）
- 日期：**2026-10-01（CST）**｜仓库：`/Users/kevin/bistro/seafood`
- 交付两件：① `docs/design/style-preview.html`（**仅追加**，+6205 字节）② 本文件
- 事由：Kevin 拍板按钮新样式（日档 A″ / 夜档 A′，扁平、4 色 + 两个比例），但本仓主题层有 PROV 硬门 ⇒ 不合真源就改 token 值必然判负，故先把参考值**立进设计真源**并冻结 PROV 口径。

---

## §1 任务 1 · PROV 合法形式的逐条口径（**全部现取**，带行号）

**口径来源现取**：`frontend/src/test/unit/theme-tokens.test.js`（194 行，8217 字节，mtime 2026-09-30 21:20）与 `frontend/src/theme/tokens.js`（458 行，25023 字节，mtime 2026-09-30 21:07）。

| # | 规则（合法形式的构成要件） | 出处（现取行号） | 判负方式 |
|---|---|---|---|
| 1.1 | **真源是单点文件**：`TOKEN_SOURCE_FILE = 'docs/design/style-preview.html'`；测试用它 + 仓库根拼绝对路径 | `tokens.js:16`；`test.js:18-20` | 文件不存在 ⇒ :54 直接失败 |
| 1.2 | **行号 1-based**：全文按 `\n` 切行，`lineAt(n) = sourceLines[n-1]` | `test.js:23`、`:27` | 传 0 或 off-by-one ⇒ 命中错行 |
| 1.3 | **每个 key 必须有 PROV[key]**（缺 ⇒ 失败，不可跳过） | `test.js:71-75` | `缺 PROV` |
| 1.4 | **d 与 n 两档都必须有 entry**（只给一档 = 不合法） | `test.js:76-81` | `缺证据` |
| 1.5 | **entry 形态 = `[lineNo, needle, mustNot?]`**（第 3 元素可选） | `test.js:82` | 解构失败 ⇒ 抛错/判负 |
| 1.6 | **命中口径 = 归一化子串包含**：`norm = 去全部空白 + toLowerCase`，判定 `norm(该行).includes(norm(needle))` | `test.js:26`、`:89` | `L{N} 不含「needle」` |
| 1.7 | ⇒ 由 1.6 推出三条**合法但危险的自由度**：① 大小写/空格/换行不敏感；② needle 只需是**单行内**的子串（跨行拼接无效，因为只取一行）；③ needle 可以极短（单字符也能通过）⇒ 见 §1.10 的收口口径 | 同上 | — |
| 1.8 | **行号越界即判负**（`raw === undefined`） | `test.js:84-88` | `行号 N 越界` |
| 1.9 | **值表必须两档都有该键且为 string**（键集齐备性由测试兜底） | `test.js:83`（另见 :58-66 键集/键序、`:119-129` STRUCT） | `值表缺档` |
| 1.10 | **负例 mustNot**：提供时「该行**不得含**该子串」⇒ 专用于 `none` / `transparent` / `inherit` 这类「缺席即真值」的槽 | `test.js:90`；实例 `tokens.js:263`（`search-shadow` 夜档）、`:275`、`:297-299`、`:338-339` | `L{N} 不该含「mustNot」` |
| 1.11 | **无豁免、无单键跳过**：逐键收集 failures，最后 `expect(failures).toEqual([])` | `test.js:69`、`:93` | 任一键不合格即整体判负 |
| 1.12 | **STRUCT_PROV 同形**（`[行号, needle, mustNot?]`，d/n 两项都要，逐条回读） | `test.js:131-143`（用 `prov[which]` 解构，:136） | `L{N} 不含「needle」` |
| 1.13 | STRUCT 额外硬条件：键数 ≥ 25（:121）、值必须 string 且**不含颜色**（`not.toMatch(/#|rgba?\(/)`，:123-124）、`STRUCT_PROV[key]` 必须 truthy（:125）、与 `TOKEN_KEYS` **不得重名**（:128） | `test.js:119-129` | 逐条失败 |
| 1.14 | **键名合法性**：按「连字符分段精确匹配」判，禁词集 = `padding/pad/margin/gap/width/height/size/cols/rows/flex/order/display/position/inset/top/left/right/bottom/font/spacing/line/overflow/z/min/max/grid/align/justify` | `test.js:98-104` | `bad !== []` |
| 1.15 | **取值形态白名单**（两个档都要匹配）：`#hex(3-8)｜rgb(a)()｜transparent｜none｜inherit｜currentColor｜\d+px｜linear-gradient(...)｜"\d+px \d+px …"` | `test.js:106-108` | `badValues !== []` |
| 1.16 | 由 1.15 推出两条**决定性结论**：**(a) 组合值不能进 token**——`1px solid #E0E0E0` 必须拆成「颜色 token + 宽度结构常量」；**(b) 裸小数比例不能进 token**——`0.17` / `0.45` 不匹配任何白名单分支 ⇒ 只能以 **px 落地值**进 STRUCT，或在 STRUCT 内存比值字符串（见 §3.4 推荐与保留意见） | `test.js:106-108` | 判负 |
| 1.17 | 两档**键集合与键序完全相同**、`TOKEN_KEYS.length ≥ 100` | `test.js:58-66` | 判负 |
| 1.18 | **差异键数 > 90**（day≠night）⇒ 把 4 色做成「两档同值」会**减少**差异键数 | `test.js:111-117` | 判负 |
| 1.19 | `EXCLUDED_FROM_THEME` 每行必须满足：`why.length > 10`（:149）且 `${day} ${night}` 能匹配正则 **`style-preview.html:\d+`**（:150）；条数 ≥ 8（:146） | `test.js:145-152` | 判负 |
| 1.20 | 真源文件存在且**行数 > 400** | `test.js:53-56` | 判负（追加后 983 行 ✓） |
| 1.21 | 生成物一致性（改 token 后必须走生成器）：`--sf-${key}` 日块逐键 = JS day 表、夜块逐键 = JS night 表；两块变量键集合相同；结构常量只出现在 `:root` | `test.js:167-179`、`:181-186`、`:188-193`；禁手改见 `tokens.js:1-14` | 判负 |
| 1.22 | `EXCLUDED_FROM_THEME` 登记的是「提取到但刻意不进主题差集的档间差异」，每条含 文件:行号 与理由（写法样例） | `tokens.js:435-447` | — |
| 1.23 | PROV 的**写法样板**（本仓实际形态，可直接照抄）：`{ d: [行号, '该行原文片段'], n: [行号, '该行原文片段'] }`，第 3 元素仅在需要「缺席即真值」时给出 | `tokens.js:252-253`（注释定义的形态）、`:264-267`（`btn-bg/fg/radius/shadow` 四键实例） | — |

### §1.10 收口口径（Jing 定，测试本身不查）
测试只做「子串命中」，**不查 needle 的唯一性、长度与语义** ⇒ `needle='a'` 也能通过，属**假证据**。本单立以下收口规则（后续单须遵守）：

1. needle 至少是「**属性名:取值**」的最小可辨片段（如 `background:#FFE60F`、`border:1px solid #E0E0E0`），禁止单字符 / `#` / `px` / 纯属性名。
2. needle **必须含该 token 的取值本体**（颜色串或 `Npx`），否则视为未取证。
3. 几何类（进 STRUCT）needle 走 `STRUCT_PROV`，与颜色 token 分开写，禁止互相借用。
4. 行号必须**现取**（不得沿用他人报告里的行号）；行号必须落在**承载该值的那一行**。
5. 追加式扩展时，新 needle 必须指向**追加区间**（本单：≥ 937 行），不得指向既有 1–936 行的近似片段。

---

## §2 任务 2 · 参考实测值立进设计真源（**仅追加**）

### §2.1 追加式三读数自证（§5.7 ⑥）

| 读数 | 值 |
|---|---|
| **追加前字节数** | `72809`（md5 `648c18d474c841ac45198ff6a66be240`，换行数 936） |
| **追加后字节数** | `79014`（md5 `597c9c12a9790cf0bcd325f9bf52fdfc`，换行数 982 ⇒ 行数 983） |
| **增量** | `+6205` 字节（写入载荷 6205 字节；原文件末尾为 `</html>\n` ⇒ 未额外补分隔换行，`SEP_ADDED=False`） |
| **前 N 字节与原文件全量相等** | **True** — `after[:72809] == before` 逐字节相等；且 `md5(after[:72809]) == 648c18d4…`（与原 md5 相同） |
| 写入方式 | Python `open(path,'ab')` **纯追加**，无任何原位改写；新块行区间 = **938–982**（937 行是空行） |
| 既有行号影响 | 既有 PROV 引用**最大行号 = 351**（`tokens.js` PROV 表内含 `n: [351, …]`）< 937 ⇒ 追加**不改变任何既有行号与行内容**。现取回读实证：第 200 行 `.vstage-a .page{background:#FDE815;color:#0A0A0A}`、第 206 行 `.vstage-a .btn-pub{background:#030402;color:#FDE815;border-r…` 均原样。 |

### §2.2 实测值表（逐项标【实测】/【推断】）

| 项 | 值 | 口径 | 说明 |
|---|---|---|---|
| 主按钮填充 | `#FFE60F` | **【实测】** | 日档 A″ / 夜档 A′ 同值 |
| 主按钮文字 | `#202020` | **【实测】** | 日档 A″ / 夜档 A′ 同值 |
| 次按钮填充 | `#FFFFFF` | **【实测】** | 日档 A″ |
| 次按钮描边色 | `#E0E0E0` | **【实测】** | 日档 A″（宽度 1px 由结构常量承载） |
| 参考图页面底色 | `#FFFFFF` | **【实测】** | 取样底噪基准 |
| 圆角比 | `0.17` | **【实测】** | 16px ÷ 高 96px |
| 水平内边距比 | `0.45` | **【实测】** | 落地换算成 px |
| 日档主按钮 **1px 深描边** | `1px solid #202020` | **【推断】** | 参考图**无描边**；为在黄色页底（`--sf-page-bg: #FDE815`，`tokens.js:30`）上可辨而加，**Kevin 已确认** |
| 夜档次按钮「深底 + 浅描边」形态 | `#202020` 底 + `#E0E0E0` 浅描边 | **【推断 · 应用】** | 4 色取自实测；夜档形态参考图未展示，按 Kevin 拍板落地（Kevin 已确认） |

**来源**：用户提供的参考截图（**本机路径 = `NOT_MEASURED`**，核查见 §2.3）｜**采样方法**：**PIL 像素取样（非目测）**｜**日期**：2026-10-01（CST）。

### §2.3 来源（参考截图本机路径）核查 —— 结论 `NOT_MEASURED`

任务要求写「来源 = 用户提供的参考截图（本机路径）」。**本单实测未能定位到该图**，故不得编造路径，据实登记：

- 扫描范围：`~/Desktop`、`~/Downloads`、`~/Pictures`、仓内 `**/*.png|jpg`、scratch 缓存 ⇒ **候选图片 230 张**（现取，Pillow **12.3.0**）。
- 判定：对全部候选按缩小后取样，**命中 `#FFE60F` 的图片数 = 0**（另 4 个目标色同查）。
- 唯一高黄占比候选 `/Users/kevin/Downloads/9040670ef6393962345e28cb1b88fa38.jpg`（4070×…、375282 字节）：近黄占比 58%，但**白 0%、中性浅灰(200–236) 0%、深色(<60) 0%** ⇒ 是黄底海报类图，**非按钮规范图**，排除。
- ⇒ **参考截图未落在本机可读位置**；本设计真源登记的口径为「用户提供的参考截图」，路径字段记 `NOT_MEASURED`（字段同时写进新块的 `data-src-path`）。
- **口径声明**：4 色与 2 比例的**采样动作不是本单做的**（本单**未复采样**该图，因为找不到原图）；其上游转录出处 = `docs/audit/p6-btn-a-recon.md:11`（该处标「用户提供的取样实测值」）。**本单对色值本体的复校 = `NOT_MEASURED`**，不得写成「本单实测」。

### §2.4 新块内的可引用原文片段（needle 现取回读，按 `test.js:26/89` 口径复算）

| 待引用的 token | 行号 | needle（原文片段） | 回读 |
|---|---|---|---|
| `btna-bg`（主按钮填充） | **954**（日）/ **958**（夜） | `background:#FFE60F` | HIT |
| `btna-fg`（主按钮文字） | **954**（日）/ **958**（夜） | `color:#202020` | HIT |
| `btna-border`（日档 1px 深描边色，推断） | **954**（日） | `border:1px solid #202020` | HIT |
| `btna-border` 夜档（无描边） | **958** | needle `border:0`，**mustNot** = `border:1px solid #202020` | HIT（且 mustNot 不含 ⇒ True） |
| `btna2-bg`（次按钮填充） | **956**（日）/ **960**（夜） | `background:#FFFFFF` / `background:#202020` | HIT |
| `btna2-fg`（次按钮文字） | **956**（日）/ **960**（夜） | `color:#202020` / `color:#FFFFFF` | HIT |
| `btna2-border`（次按钮描边色） | **956**（日）/ **960**（夜） | `border:1px solid #E0E0E0` | HIT |
| 参考图页面底色（若需） | **964** | `background:#FFFFFF` | HIT |
| 圆角比（STRUCT/换算依据） | **962** | `--btn-ref-radius-ratio:0.17` | HIT |
| 水平内边距比 | **962** | `--btn-ref-padx-ratio:0.45` | HIT |
| 高 34px 档圆角（STRUCT 落地值） | **954/958** | `border-radius:6px` | HIT |
| 高 34px 档水平内边距（STRUCT 落地值） | **954/958** | `padding:0 15px` | HIT |

15 项 needle 全部 HIT（`ALL_NEEDLES_OK = True`），mustNot 用例 `NIGHT_MUSTNOT_OK = True`。

**⚠ 已知不洁点（须下一单追加修正）**：夜档主按钮行（958）写的是 `border:0`，而 token 值白名单只接受 `transparent`/`none`（`test.js:106`）⇒ 测试不会判负（PROV 只校验行含 needle），但「真源行措辞」与「token 取值」不同形。建议下一单**再追加一行** `border-color:transparent`（追加式修正，不改既有字节），或在该 key 的 PROV 里直接引 `border:0`。

### §2.5 比例换算（h×0.17 / h×0.45，四舍五入到整像素）

| 档 | 高 | 圆角 | 水平内边距 |
|---|---|---|---|
| 平台控件档（`.sf-*-btn`，`min-height` 决定） | 34px | **6px** | **15px** |
| 中档 | 40px | **7px** | **18px** |
| 大档 | 51px | **9px** | **23px** |
| 参考图档（实测基准：16 ÷ 96） | 96px | **16px** | **43px** |

---

## §3 任务 3 · 仓内惯例核查 + 待改 token 清单（**只列不改**）

### §3.1 惯例核查 ⇒ **本仓设计真源无版本快照惯例**

- `docs/design/` 仅 2 个文件：`design-system.spec.md`（99944 字节）、`style-preview.html`（追加前 72809 字节）——**无 vN 快照、无备份副本**。
- `docs/versions/` 存在但**只快照 spec**：`commission.spec.v0.1-0.2`、`data-layer.spec.v0.1-0.8`、`ledger.spec.v0.1-0.12`、`route-layer.spec.v0.1-1.3`（共 35 个 `.spec.vN.md`）。按 `design|style|preview|theme|ui` 过滤 ⇒ **命中 0 条**（现取，grep rc=1）。
- ⇒ **结论：本仓设计真源无版本快照惯例**。故本单**只做末尾追加**（不另建副本、不动任何既有快照、不改 `design-system.spec.md`）。`style-preview.html` 的历史版本由 git 承载（本单未执行任何 git 写操作）。

### §3.2 将来要改的 token 键（**只列不改**）

| 键 | 现值（现取行号：日 / 夜） | 目标值 | 依据 | PROV 现值行号（需同步改指向） |
|---|---|---|---|---|
| `btn-bg` | `#030402`（`tokens.js:40`）/ `#FDE815`（`:150`） | `#FFE60F` / `#FFE60F` | 实测 | `tokens.js:264`（引 `:206`/`:279`） |
| `btn-fg` | `#FDE815`（`:41`）/ `#0B0C0E`（`:151`） | `#202020` / `#202020` | 实测 | `tokens.js:265` |
| `btn-radius` | `11px`（`:42`）/ `2px`（`:152`） | `6px` / `6px`（高 34 档） | 实测比例换算 | `tokens.js:266` |
| `btn-shadow` | `2px 2px 0 rgba(3,4,2,.35)`（`:43`）/ `none`（`:153`） | `none` / `none` | 实测（无阴影） | `tokens.js:267` |
| `btnsm-bg` | `#FDE815`（`:98`）/ `#FDE815`（`:208`） | `#FFE60F` / `#FFE60F` | 实测 | `tokens.js:322` |
| `btnsm-fg` | `#030402`（`:99`）/ `#0B0C0E`（`:209`） | `#202020` / `#202020` | 实测 | `tokens.js:323` |
| `btnsm-radius` | `9px`（`:100`）/ `2px`（`:210`） | `6px` / `6px` | 实测比例换算 | `tokens.js:324` |
| **新增** `btna-bg` / `btna-fg` | 不存在 | `#FFE60F` / `#202020`（两档同值） | 实测 | 新建，引新块 `:954`（日）/ `:958`（夜） |
| **新增** `btna-border`（日档 1px 深描边色） | 不存在 | 日 `#202020` / 夜 `transparent` | **推断**（Kevin 已确认） | 新建，引 `:954` / `:958`（mustNot 用例） |
| **新增** `btna2-bg` / `btna2-fg` / `btna2-border` | 不存在 | `#FFFFFF` / `#202020` / `#E0E0E0`（日）；`#202020` / `#FFFFFF` / `#E0E0E0`（夜） | 实测（夜档形态 = 应用推断） | 新建，引 `:956` / `:960` |
| （可选 · 第二批）`cat-bg` / `cat-border` / `cat-fg` / `cat-radius` | `#fff`/`#030402`/`#0A0A0A`/`999px`（`:57-60`）；`#15171B`/`#2A2D33`/`#C4C9D0`/`2px`（`:167-170`） | `#FFFFFF`/`#E0E0E0`/`#202020`/（圆角=推断） | 实测色 + 推断圆角 | `tokens.js:281-284` |

**必须同步核算的三条（只提示，不在本单执行）**：
1. §1.16(a)：描边**不能**做成组合值 token ⇒ 拆「颜色 token（`btna-border`/`btna2-border`）+ 宽度走现有 `STRUCT['stroke-w-thin'] = '1px'`（`tokens.js:368`，其 `STRUCT_PROV` 现值 `:403`）」。
2. §1.18：4 色 + 2 比例若做成两档同值，`btn-bg/fg`、`btnsm-bg/fg` 会由「有差」变「同值」⇒ **差异键数减少 ≥ 4**，落地前必须先数（现值 `NOT_MEASURED`，见 §4）。
3. §1.21：改 `tokens.js` 后**必须跑生成器**再覆盖 `theme-tokens.css`；禁手改生成物。

### §3.3 命名避歧义建议

- `tokens.js:3-5` 已把「**变体 A**」定义为 `style-preview.html` 的**日档「码头大牌」**（黑底黄字 + 硬投影 + 品牌黄 `#FDE815`），且 `tokens.js:4-5` 又把「变体 B」定义为夜档 ⇒ **Kevin 口中的「变体 A″/A′（圆角扁平）」与之同名异义**，沿用 `btn-a-*` 会与真源注释、既有 audit（`p6-btn-a-recon.md`）全线撞车。
- **建议命名**（与本仓 `btn-*` / `btnsm-*` 无连字符的既有风格一致）：
  - 主操作（扁平黄底）：**`btna-*`**（`btna-bg` / `btna-fg` / `btna-border`）
  - 次操作（扁平白底/深底 + 描边）：**`btnalt-*`**（`btnalt-bg` / `btnalt-fg` / `btnalt-border`）
  - 真源区块标识（已落地）：`id="btn-ref-a-src"`、`data-ref="variant-A-flat"`、行内注释前缀 `[BTN-SRC-REF]`
- 键名合法性预检（对 §1.14 禁词集逐段比对）：`btna` / `btnalt` / `bg` / `fg` / `border` / `shadow` / `radius` **均不在禁词集**中（禁词集见 `test.js:98-102`）⇒ 可安全使用。

### §3.4 比例（0.17 / 0.45）的落法建议

- **推荐**：比例**不直接进 token/STRUCT 值**，只在真源与报告里作为「换算依据」；落地值取 px（34⇒6/15、40⇒7/18、51⇒9/23），进 `STRUCT`（`tokens.js:365-398`，生成 `--sf-st-*`），`STRUCT_PROV` 引新块 `:954`/`:958`（`border-radius:6px` / `padding:0 15px` 现取 HIT）。
- **保留意见（未拍板）**：`STRUCT` 无取值形态白名单（`test.js:119-129` 只要求 string + 不含颜色），理论上可存 `'0.17'` 并由 `calc()` 消费；但 `STRUCT` 现有 34 键**全是 px / 整数字符串**，无小数先例 ⇒ 引入 calc 依赖属新形状，**建议不采用**，除非要「换高度即自动等比」。新块 `:962` 已为两种落法都留了可引用片段（`--btn-ref-radius-ratio:0.17` / `--btn-ref-padx-ratio:0.45`）。

### §3.5 未决风险（只登记，不裁决）

- **日档页底同色风险**（最高危）：`--sf-page-bg: #FDE815`（`tokens.js:30`）与主按钮填充 `#FFE60F` 色相/亮度近乎重合 ⇒ 日档「黄底按钮」与页底几乎不可分；本单已把「日档主按钮加 1px 深描边（`#202020`）」登记为**推断项**并进入真源，作为可辨性兜底。
- **夜档次按钮「深底」取值**：4 色里唯一的深色 = `#202020`，与夜档页底 `#0B0C0E`（`tokens.js:140`）对比度低 ⇒ 边界只能靠浅描边 `#E0E0E0` 承载；如需更强对比，建议改取现有夜档 token `search-bg #15171B`（`tokens.js:145`）——**属拍板项，本单不决定**。

---

## §4 `NOT_MEASURED` 清单（禁填 0/空）

| 项 | 状态 | 说明 |
|---|---|---|
| 参考截图**本机路径** | `NOT_MEASURED` | 230 张候选图片扫描未命中 `#FFE60F`（§2.3）；未编造路径 |
| 色值/比例本体的**复采样** | `NOT_MEASURED` | 找不回原图 ⇒ 本单未复采样；口径沿用用户提供（转录自 `p6-btn-a-recon.md:11`） |
| 日夜「差异键数」现值（判据 > 90） | `NOT_MEASURED` | 本单未跑测试；落地前必须先数（§3.2 提示 2） |
| `npm run test:unit` / `npm run build` 实跑 | `NOT_MEASURED` | 本单不跑 npm（禁用），故不做任何绿/红结论 |
| 新块在浏览器中的渲染与横向溢出 | `NOT_MEASURED` | 本单未起浏览器/服务 |
| 生成器 `backend-ts/.p4-artifacts/…/gen-theme-css.mjs` 在盘可运行 | `NOT_MEASURED` | 未验证（引用 `theme-tokens.css:3` 的路径字符串） |
| 按钮实际高度（34/40/51px 等） | `NOT_MEASURED` | 全部比例换算依赖推算高度，来源 `p6-btn-a-recon.md:38,65` |

---

## §5 红线遵守与命令口径

- **只写两个文件**：`docs/design/style-preview.html`（仅追加 +6205 字节）、`docs/audit/p6-btn-src-and-prov.md`（本文件）。另在 scratch 目录 `/Users/kevin/.hermes/profiles/zang/cache/scratch/btn_probe.py` 写了一个只读探针脚本（**仓外**，不属仓内产物）。
- **未触碰**：`frontend/src/**`（含 `tokens.js` / `theme-tokens.css` / `theme-tokens.test.js`）、`backend-ts/**`、`migrations/**`、`vercel.json`、`docs/seafood.master-plan.md`、其它 spec/快照、`.env*`、既有 audit 件（仅**读** `docs/audit/p6-btn-a-recon.md`）。
  - 现取旁证：`frontend/src/theme/tokens.js` mtime `2026-09-30 21:07`（25023 字节）、`theme-tokens.test.js` mtime `2026-09-30 21:20`（8217 字节）、`vercel.json` mtime `2026-10-01 09:39` —— 均**早于**本单写入时刻 `2026-10-01 22:28`。
  - 诚实声明：近 3h 内 `frontend/src` 有 57 个文件 mtime 更新（**同仓其它并行单的写入，非本单**）；该 mtime 扫描对「本单是否触碰前端」**不具判别力**，本单的合规依据是「本单只发起过上述两个仓内写操作」。
- **未执行**：`git add/commit/push`、`npm`、`vercel`、任何 DDL/DML、`pkill`/`killall`、未起停任何服务；未读取/打印任何密钥或 `.env*` 值。
- **命令口径（§5.7）**：① 退出码直接取自命令本身（`python3 …probe.py; echo "PROBE_RC=$?"` ⇒ `PROBE_RC=0`），**不取自管道之后**；② 报数均带口径（字节 / 行数 / md5 / 归一化子串命中数）；③ 本文件所有行号均为**本单现取**（`tokens.js:16,23,26,27,30,40-43,57-62,98-100,140,145,150-153,167-170,208-210,249-253,264-267,281-284,322-324,368,403,435-447`；`test.js:16-27,53-56,58-66,68-94,96-109,111-117,119-129,131-143,145-152,154-157,160-194`；`style-preview.html:200,206,936-982`）；④ `NOT_MEASURED` 项见 §4，未以 0/空填；⑤ 先落骨架后回填、每段追加落盘。
