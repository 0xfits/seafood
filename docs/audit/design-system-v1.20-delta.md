# design-system.spec v1.20 delta · JING-SPEC-CARDUI-DS（2026-10-17）

> 单号 **JING-SPEC-CARDUI-DS** · 作者角色 = Jing（Specifier · 制度员）· 依据 = **Kevin 2026-10-17 逐字三条**（① 背景色不要用黄色，黄色可以用在顶部菜单栏 ② 严格按照参考图调整「货币符号和金额」处的 UI 设计，其它部分酌情处理 ③ 整张卡片可点击，而不是只有按钮可点击）+ **Zang 已裁定口径 `Q1`–`Q3`**（`docs/design/design-system.spec.md` §22.0）。**本单只写 `docs/**` 与本单读数**：改 `docs/design/design-system.spec.md`（→ **v1.20**）+ `docs/design/style-preview.html`（**纯追加**）+ 快照 / 镜像 + 本 delta + `ops/ui-card-ref-20261017/readings/jing-*`；**不改任何代码、不跑任何门、不连库、不启停服务、不 commit、不 push、不 `git add -A`**。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| 底色分层：新 token `--sf-surface-bg`（日 `#FFFFFF` / 夜 `#101114`）+ `--sf-page-bg` 日档 `#FDE815 ⇒ #F5F7F9` + `--sf-topbar-bg` 日档保留 `#FDE815`（黄色唯一落点） | Kevin ① + Zang `Q1` | §22.2 **`T109`** + §22.4 |
| 落点：`.sf-shell` 留 `var(--sf-page-bg)`；`.sf-route-container` 新挂 `var(--sf-surface-bg)`；**`.sf-item-actionbar`（`item.css:349`）改挂 `var(--sf-surface-bg)`** | Zang `Q1` 追加裁定 + 现取 `grep -rn 'var(--sf-page-bg)' frontend/src`（**只 2 处**） | §22.2 `T109` + §22.4 |
| 价格块版式：同行 flex + `baseline` / `$` 小（数字高 75–80%）/ 数字大加粗 / 去框去底去内边距 / 色用既有 `--sf-price-*-fg`（参考图橙红不采纳）/ **「小数位更小」不适用** | Kevin ② + Zang `Q2` | §22.2 **`T110`** + §22.5 + §22.3 |
| 范围收窄：只改首页卡片；详情页价格块（`item.css` `.sf-item-price*` / `--sf-l-detail-price-size` 32px）+ `ThemePreviewPage` 的 `.sf-price` 家族**不动** | Zang `Q2` 边界 | §22.2 **`T111`** + §22.9 `AC-8` |
| 整卡可点击：卡片根单一 `<a>`（`buildLocalizedPath`）+ 卡内嵌套交互元素 = 0 + CTA 降级非交互视觉胶囊（保留 `item.viewDetail` / `reward-card-view`）+ 不得引入 `.sf-btn` 族 | Kevin ③ + Zang `Q3` + `p6-btn-impl2.test.js:73-89` | §22.2 **`T112`** + §22.6 + §22.7 `A7` |
| 无 Router 回落契约（裸渲染不得抛错、且不得产出 `<a href>`） | 既有用例 `i18n-batch-b2.test.jsx:154/158/170` | §22.2 **`T113`** + §22.9 `AC-4` |
| 真源纯追加块 + PROV 指针三处 | 溯源硬门（`theme-tokens.test.js:68-94`） | `style-preview.html` **1044–1103** 行 + §22.13 |
| 断言影响清单（真改锚 1 / 真改面 4 / 新契约 2 / 冻结面零改锚 11） | 现取逐文件逐行 | §22.7 清单 A / B |
| i18n 零新增零删除 ⇒ `128 / 1104 / 4416` 不变 | 现取四语 JSON（2026-10-17 逐文件相等） | §22.8 |
| 教训 `N46`（改值 = 加真源行 + 改 PROV 指针）/ `N47`（派单描述与现取不符：先取证再写册） | 本单实测 | §22.10 |
| 待裁 `Q5`–`Q9` | 本单发现的口径缺口（**不自选**） | §22.11 |
| 勘误：派单称价格块「外套一层黄底黑框胶囊（`.sf-price` 家族）」**与现取不符** | 现取 `RewardCard.jsx:91-98` + `grep -rn 'sf-price' frontend/src` | §22.3 勘误 + §22.10 `N47` |

## §B 改前 / 改后自证（真读数 · 本单实测）

| 项 | 改前 | 改后 |
|---|---|---|
| `design-system.spec.md` 行数 | **2355** | **2569**（+214） |
| `design-system.spec.md` 字节 | **517,050** | **564,194**（+47,144） |
| `design-system.spec.md` md5 | `1ac3dc50c40cb15d409d008090d02e47` | `16f124fc6533770c912e79d6487ebac0` |
| `design-system.spec.md` sha256 | —（未取） | `f99b00594c6adf2daeb70364730d830a34d2c4a851690611fc7df1b57d98aefd` |
| `style-preview.html` 行数 | **1042** | **1103**（+61） |
| `style-preview.html` 字节 | **86,638** | **93,949**（+7,311） |
| `style-preview.html` md5 | `13a845dacb6865ea3fa738663a63159c` | `7b8780af15802102f9ddf578510490a5` |
| `style-preview.html` sha256 | —（未取） | `6565559d633e79886587550a22a9d1d50180079952e62f42a93c84d0a9cdcf94` |
| `git diff --numstat docs/design/` | —— | **`214 0`**（spec）· **`61 0`**（preview）⇒ **删除列 = 0 ✓ 纯追加** |
| 纯追加前缀自证 | —— | `head -n 1042 改后 \| cmp - 改前` ⇒ **exit 0**（前 1042 行逐字节未动） |
| 快照 `cmp` | `docs/versions/design-system.spec.v1.19.md` 对 **`HEAD:docs/design/design-system.spec.md`** = **0**（改前快照逐字节 = 改前态 ✓） | `docs/versions/design-system.spec.v1.20.md` 对现盘 = **0**（本版镜像 ✓） |
| 三处版本记录同步 | —— | 头部 `^> \*\*★ 现行版 = v1.20` = **1**；正文 `^## §22 ` = **1**；§12 表 `^\| \*\*v1.20\*\* \|` = **1**（旧 v1.19 两行仍在场 = 1 / 1） |

**新真源块行号锚（PROV 用 · 本单冻结）**：追加块 = `style-preview.html` **1044–1103** 行（注释 1044–1061 · `<section id="card-ui-ref-v120">` 1062–1103）；**PROV 指针三处** = `page-bg.d` ⇒ **1069**（`.vstage-a .page{background:#F5F7F9;color:#0A0A0A}`）· `surface-bg.d` ⇒ **1071**（`.vstage-a .surface{background:#FFFFFF}`）· `surface-bg.n` ⇒ **1073**（`.vstage-b .surface{background:#101114}`）。

## §C 未动面自证（`git status --porcelain` / `git diff --name-only` 现取）

```
 M docs/design/design-system.spec.md
 M docs/design/style-preview.html
?? docs/versions/design-system.spec.v1.20.md
?? ops/ui-card-ref-20261017/
```

- **未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`**（`git diff --name-only` 只列 `docs/design/` 两件）。
- **未触碰参考图**：`ops/ui-card-ref-20261017/shots/*.png` 的 sha256 复核后与开局逐字相同（`be25f542…491` / `c7a0aa9f…fa0`）。
- **未启停任何服务**；**未 `git add -A` · 未 commit · 未 push**。
- **`docs/versions/design-system.spec.v1.19.md` 未写入**（只读校验：`cmp` 与 `HEAD:docs/design/design-system.spec.md` = 0）。

## §D 证据件清单（`ops/ui-card-ref-20261017/readings/`）

| 件 | 内容 |
|---|---|
| `jing-v120-readings.txt` | 九段现取读数：改前快照复核 · 真源改前/改后 + 纯追加自证 · PROV 行号锚 · spec 改前/改后 · 三处版本锚命中数 · 快照镜像 `cmp` · 未动面自证 · 现取基线（键集 / 路由计数 / 后端注册点 / `var(--sf-page-bg)` 消费者全集 / `reward-card-view` 测试锚计数 = **0**）· **⑨ 落笔后终值重取**；**含两条诚实留痕**：**③bis**（同批第三次 `grep` 的转义写错未命中，重取后追加、旧读数不改写）与 **⑨**（§22.4 原写「`#FDE815` 字面仅出现在 `tokens.js`」经复核有误 —— 另有 29 行落在生成物 `theme-tokens.css` ⇒ **就地更正本单新增行**（非改旧行），并重取 spec 改后终值 `2569 行 / 564,194 B / md5 16f124fc6533770c912e79d6487ebac0`、重制 v1.20 镜像至 `cmp=0`） |
| `jing-v120-selfproof.log` | 可复跑的 `cmp` / `numstat` / 锚点命令与输出（`.log` 后缀被仓根 `.gitignore` 命中 ⇒ 若要入库须 `git add -f`，承 `N42` 体例） |
| `baseline.log`（Zang 采 · 本单只读） | 门套改前基线 = `Test Files 54 passed (54)` / `Tests 520 passed (520)`；产物名 `assets/index-C3dRJ_m4.js` + `assets/index-D4sieLPp.css`；生产哨兵 |

## §E 后续单指向（**纯追加 · 本件上文字一行未改**）

- **本件记录的是 v1.20 的**首单**（`JING-SPEC-CARDUI-DS`）终值**；其后 **v1.20 就地注单**（`JING-SPEC-CARDUI-DS-B` · Zang 终审 `Q5`–`Q9` 全部已裁 + 夜档另议边界 + `AC-9` + `N48`/`N49`）**不新开版本**，其改前 / 改后读数（含本件 §B 那三项的**新终值**）**一律以 `docs/audit/design-system-v1.20-delta2.md` 为准**。
- **两件的关系（写死 · 防读错）**：本件 §B 的 `design-system.spec.md` = **2569 行 / 564,194 B / md5 `16f124fc6533770c912e79d6487ebac0`** 是「**首单终值 / 就地注单开工值**」；就地注单后 = **2620 行 / 582,734 B / md5 `185f9da2ccab9d8779dfec339ee2c23d`**（见 delta2 §B）。**`docs/versions/design-system.spec.v1.20.md` 已按后者的终值重制**（`cmp=0`）⇒ **本件 §B 的镜像 md5 为历史值，勿据以判当前镜像**。
- **真源面零改动**：`docs/design/style-preview.html` 在就地注单中**未动**（md5 仍 `7b8780af15802102f9ddf578510490a5`）⇒ 本件 §B 的真源读数**仍为现行值**。
