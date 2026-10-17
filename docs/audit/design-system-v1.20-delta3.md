# design-system.spec v1.20 **勘误就地注 delta3** · JING-SPEC-CARDUI-DS-C（2026-10-17）

> 单号 **JING-SPEC-CARDUI-DS-C**（承 `-DS` / `-DS-B`）· 作者角色 = Jing（Specifier · 制度员）· 依据 = **Kong 三臂实测反证**（证据件 `ops/ui-card-ref-20261017/readings/kong-night-contrast.json` / `.log`，**本单先读它再落笔**）—— 该反证**推翻**了上一轮在 §22.12 第 14 项写下的结论（当时已诚实标 `NOT_MEASURED`，现读数已就绪）。**本单 = 勘误微回写单**：只写 `docs/**` + 本单读数；**v1.20 就地注（不新开版本、不新开 `## §` 节、不新开 `###` 节）**；**不碰 `frontend/**`**；**未启停任何服务**；**未 `git add -A` · 未 commit · 未 push**。**★ 勘误的落笔形态受本册「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束 ⇒ 旧行一律「逐字保留」，更正以「紧随其后的登记行 / 表后注块」承接，并显式标「已被实测推翻 · 见本注」（承 §22.11 既有的「已裁登记表」体例）。**

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| **§22.12 第 14 项就地更正** —— 旧行结论「**站点切夜档不触发任何 `dark:` 工具类**」= **已被实测推翻**；**状态 `NOT_MEASURED` ⇒ `MEASURED`** | Kong 三臂实测（`kong-night-contrast.json` 的 `darkVariantMechanism.arms`；臂 A/C 两键取值相反） | §22.12 表内第 14 项**紧随其后**插 `14-勘误（v1.20c）` 行 ＋ 表后插「★ v1.20c 就地注（勘误 · 第 14 项 ＋ 第 16 项收口）」块 |
| **机制写死**：浏览器按**根元素 used `color-scheme`** 解析 `prefers-color-scheme`；本仓 `html{color-scheme:light}` / `html[data-theme="dark"]{color-scheme:dark}`（`frontend/src/styles.css:111-112` 顶层 ＋ `frontend/index.html:14` meta）⇒ **站点切夜档即命中** ⇒ **全站 tailwind `dark:` 是活的** | 现取 `styles.css:103-112` / `index.html:11-14` ＋ 现取产物 `frontend/dist/assets/index-B0eM_JXL.css` 该媒体查询**恰 1 处** | §22.12 勘误块（机制段）＋ §22.10 的 `N50` |
| **两条旧事实链仍成立**（① 仓内无 `@custom-variant dark`；② 产物该媒体查询恰 1 处）—— **错的是由它们推出的结论** | 本单现取复核（`grep -rn 'custom-variant' frontend/src frontend/index.html` = 0；dist 命中 = 1） | §22.12 勘误块（勘误对象段）＋ §22.10 `N50` |
| **§22.9 `AC-9` 改前臂数值更正**：改前夜档 = **同一个价格块两色不一致**（数字 `text-yellow-600` `#CA8A04` = **2.84:1** / 符号 `dark:text-yellow-400` `#FACC15` = **1.48:1**）⇒ **最差 1.48:1**；改后 = **20.55:1** | Kong `before` / `after` 字段 ＋ 本单 Node **独立复算**（八臂，见 §B） | §22.9 表末插入 `AC-9 · v1.20c 勘误注` 行 |
| **「独立复现」写进 AC-9 判据**：质检方**不得只读实现方读数**（反证件只作旁证 / 交叉核对），须在**同一 dist / 同一 headless Chrome** 自行跑**三臂 A/B/C** 并各自落盘 `color-scheme` ＋ `mqDark` ＋ `getComputedStyle` 回读，**由回读值自行复算 WCAG**；**臂 C 必须与臂 A/B 取值不同**（否则尺子不敏感 ⇒ 判负） | 本仓既有纪律「自报读数不是证据」「判负须自证灵敏度」（承 `N42` 一族） | §22.9 `AC-9 · v1.20c 勘误注` 的第 ④ 项 ＋ 判负列 |
| **新教训 `N50`** —— 「root 声明 `color-scheme` ⇒ 产物里的 `prefers-color-scheme` 媒体查询随**站点主题**命中 ⇒ `dark:` 工具类是**活的**；判死活**必须实测三臂**，不得仅凭『无 `custom-variant dark`』推断」＋ **「修一个 bug 开出另一个变量」定式**（该声明当初是为治手机 UA 强制深色） | 本单实测 + 现取 `styles.css:103`（注释自陈「治真机日档『明显暗淡』」） | §22.10 末插入 `N50` |
| **收口挂账** `frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx`（上单登记「不应随单入库」的待清理项）⇒ **已清理 · 现取不存在** | 本单现取（`ls` = No such file；`grep -rn 'zz-kong-ac4-tmp' frontend/src/test` = 0） | §22.12 勘误块末段 ＋ delta2 §E 追加指向注 |
| **真源 `docs/design/style-preview.html` 本单零改动**（五条裁定 + 本条勘误**均不产生新真源值** ⇒ 不触发 `N46` 双件） | 现取 `git diff --numstat` = `61 0`（与上单逐字相同） | §22.14 新增行（真源面） |

## §B 改前 / 改后自证（**本单终值** · 真读数）

| 项 | 改前（本单开工现取） | 改后（**本单终值**） |
|---|---|---|
| `design-system.spec.md` 行数 | **2620** | **2638**（+18） |
| `design-system.spec.md` 字节 | **582,734** | **594,700**（+11,966） |
| `design-system.spec.md` md5 | `185f9da2ccab9d8779dfec339ee2c23d` | **`bc279e8a7632b87144603755d0106712`** |
| `design-system.spec.md` sha256 | `d4018f489777a0261ad950169cc36ea68056a50aaaac4dad985757e06185e4c7` | **`05dbe3635cecf71b0a5a155353b7e87a088f513579fbc8b3342e100fc4d8a44c`** |
| `git diff --numstat docs/design/design-system.spec.md` | `265 0` | **`283 0`** ⇒ **删除列 = 0 ✓ 纯追加 / 无一行改写**（`283 − 265 = 18` = 行数增量 · **算术闭合**） |
| `git diff --numstat docs/design/style-preview.html` | `61 0`（上单） | **`61 0`（本单零改动 · 与上单逐字相同）** |
| 本版镜像 `docs/versions/design-system.spec.v1.20.md` | `185f9da2ccab9d8779dfec339ee2c23d`（与改前 live `cmp=0`） | **`bc279e8a7632b87144603755d0106712`**（重制）⇒ 对改后 live **`cmp` = 0 ✓** |
| 三处版本记录同步 | —— | 头部 `^> \*\*★ 现行版 = v1.20` = **1**；正文 `^## §22 ` = **1**；§12 表 `^\| \*\*v1.20\*\* \|` = **1**（**均一字未动**） |
| 本单新落点在场 | —— | `AC-9 · v1.20c 勘误注` = 2；`` `N50` · 站点在 `` = 1；`14-勘误（v1.20c）` = 3；`v1.20c 就地注（勘误 · 第 14 项` = 3；`已清理 · 现取不存在` = 2；``MEASURED`（原 `NOT_MEASURED`）`` = 1；`^### 22\.` 节标题 **15（22.0–22.14）· 未新增**；`^### 5\.` = 3（与 HEAD 同） |
| **WCAG 八臂**（本单 Node 由 sRGB **独立复算** · 非转述） | 改前·数字 **2.840**（`#CA8A04` on `#FEFCE8`）／改前·符号 **1.481**（`#FACC15` on 同底 ⇒ **最差臂**）／旁证 Node-oklch 数字臂 **2.841**（`#D08700`）· 符号臂 **1.521**（`#FDC700`） | 改后 **20.546**（`#030402` on `#FFFFFF` ✓）；反事实臂 **1.255**（`#FDE815` on 白卡 ⇒ 判负已证）；对照 **15.589**（夜档 token on 夜底 `#0B0C0E`） |

**★ 落点清单（逐处 · 全部为**插入** · 无一行改写）**：① §22.9 AC 表末（承 `AC-9` 后）插 **`AC-9 · v1.20c 勘误注`** 行（改前臂更正 + 改后臂 + 反事实臂 + **④ 独立复现判据**）；② §22.10 末（`N49` 后）插 **`N50`**；③ §22.12 表内第 14 项**紧随其后**插 **`14-勘误（v1.20c）`** 行（旧行逐字保留 + 标「已被实测推翻 · 见本注」+ 状态 `MEASURED`）；④ §22.12 表后插 **「★ v1.20c 就地注（勘误 · 第 14 项 ＋ 第 16 项收口）」** 块（13 行）；⑤ §22.14 末插 **1 行**（本单落点 / 快照自证 / git 面 / 证据落点）。**`§22.0`–`§22.13` 原正文一行未改。**

**★ 诚实留痕（本单两次 patch 操作事故与复原）**：**事故 1** —— 插 ③ 的首版 `patch` 因 `new_string` 未以 `old_string` 逐字结尾，把 `| 15 | **实现面（…）当前状态** |` 两个单元格吃掉；**事故 2** —— 插 ① 的首版落点落在 §22.9 表尾**空行之后** ⇒ 该行**脱离 AC 表**（markdown 表被空行终止）⇒ 改为紧贴 `AC-9` 行（原空行仍在其后 ⇒ **仍是纯插入**）。**两次均当场发现并复原**：复原后第 15 项行与改前**逐字相同**、§22.9 表连续性 = `AC-7` / `AC-8` / `AC-9` / `AC-9 · v1.20c 勘误注` /（空行）✓（现取见 `jing-v120c-readings.txt` 【8】）。**本单最终态下无一行被改写** —— 该结论的机器证据 = `numstat` 删除列 = 0。

## §C 未动面自证

```
 M docs/design/design-system.spec.md          ← 本单（勘误就地注）
 M docs/design/style-preview.html             ← 上单（本单零改动 · 61 0）
 M frontend/src/components/reward/RewardCard.jsx     152/120  ← Kong 实现单
 M frontend/src/pages/HomePage.jsx                     8/0    ← Kong 实现单
 M frontend/src/pages/item/item.css                    1/1    ← Kong 实现单
 M frontend/src/shell/shell.css                        3/0    ← Kong 实现单
 M frontend/src/theme/theme-tokens.css                 3/1    ← Kong 实现单
 M frontend/src/theme/tokens.js                        9/2    ← Kong 实现单
?? docs/audit/design-system-v1.20-delta.md
?? docs/audit/design-system-v1.20-delta2.md
?? docs/audit/design-system-v1.20-delta3.md    ← 本单新建
?? docs/versions/design-system.spec.v1.20.md
?? frontend/src/components/reward/reward-card.css
?? ops/ui-card-ref-20261017/
```

- **本单一行未写 `frontend/**`**（只**只读**现取一次）；上表六件 `frontend/**` 改动**全部归 Kong 实现单**（含未跟踪件 `reward-card.css`）。**★ `frontend/dist/**` 现取 mtime = 08:25 —— 属**并发会话（Kong）的 build 产物**（`dist/` gitignored），**本单未跑任何 build**；`find frontend/src -newermt '2026-10-17 08:23' -type f` = **0 件**。**
- **未动 `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `ops/ui-card-ref-20261017/shots/**`**（shots 现取 6 件 · mtime 均早于本单开工）。
- **未启停任何服务**：现取 `localhost:5787/` = **200** · `localhost:5788/api/health` = **200**。
- **`docs/versions/design-system.spec.v1.18.md` / `v1.19.md` 未写**。
- **未 `git add -A` · 未 commit · 未 push**。

## §D 证据件清单

| 件 | 内容 |
|---|---|
| `ops/ui-card-ref-20261017/readings/jing-v120c-readings.txt`（新建 · 14,135 B） | 十二段现取读数：本单性质与边界 / **依据证据件（先读它再落笔）** / **三臂 A·B·C 读数** / 机制 + 两条旧事实链**现取**复核 / **数值更正 + WCAG 八臂独立复算** / spec 改前改后终值 / 落点清单 + 在场复核 / 第 15 项行完好性与表连续性（含**两次 patch 事故复原**留痕）/ **挂账收口** / 未动面 / 镜像 `cmp` / git 面与 `.log` 入库告警 |
| `ops/ui-card-ref-20261017/readings/jing-v120c-selfproof.log`（新建 · **可复跑** · 11 段 · 5,509 B） | 终值 md5/sha256/行数/字节 · `numstat` 删除列 / `style-preview.html` 未动 · **镜像 `cmp` = 0** · 三处版本锚 · 新落点在场 + 节标题数（`22.` = 15 / `5.` = 3）+ **表连续性**（§22.9 `AC-7`→`AC-9`→`AC-9勘误`、§22.12 `14`→`14-勘误`→`15`→`16`）· **主题事实链现取**（`custom-variant` = 0 / `styles.css:111-112` + `index.html:14` / dist 命中 = 1）· **WCAG 八臂 Node 复算** · 挂账现取（`ls` = 无 + `grep` = 0）· 未动面 / 服务 · **`.gitignore:244 *.log` 命中断言**（⇒ 入库须 `git add -f`，承 `N42`）.txt 不受影响 · **§11 frontend 未写自证**（`frontend/src` 新改件数 = 0 · `dist` 新改件归并发会话 build） |
| 依据件（**本单只读** · 未改） | `ops/ui-card-ref-20261017/readings/kong-night-contrast.json` / `.log` |

## §E 挂账 / 诚实清单（本单）

- **`MEASURED`（本单新增）**：`dark:` 工具类在**站点夜档**下的死活 —— 三臂实测已就绪并已入册（§22.12 勘误块 + §22.10 `N50`）；**判死活定式 = 三臂**（臂 C 控制臂必跑）。
- **`NOT_MEASURED`（**仍未实测 · 原样保留 · 不改成 PASS**）**：① 本册**未**自行复跑三臂（本单为勘误回写单，读数来自 Kong 反证件 + 本单独立**复算**其 sRGB 比值；**页内真渲染取色**的**裁决读数**按新增判据归质检方自行三臂复现）；② 真机（`env(safe-area-inset-bottom)` / 手机档观感）承 §19.12 / §21.12 / §22.12 第 3 项未测；③ 参考图橙红精确取样值未测（#22.12 第 4 项）。
- **已闭环（本单收口）**：`frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx` **已清理 · 现取不存在** ⇒ 上单「不应随单入库」的待清理挂账**结清**（§22.12 勘误块末段 ＋ delta2 §E 指向注）。
- **`UNRESOLVED` · 另立单（本单未动）**：「**夜档整卡配色（是否深色卡 / 价格是否亮黄）本轮未定，另立单**」＋ `--sf-surface-bg` 夜档 `#101114` **暂定值**复核（§22.11 夜档另议块 + §22.12 第 11/12 项）。
- **非本单写面**：`frontend/**` 六件（含 Kong 新建 `reward-card.css`）。
