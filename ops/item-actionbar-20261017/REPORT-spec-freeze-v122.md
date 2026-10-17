# /item/:id 操作栏 goofish 形态 · 设计真源冻结（Jing · v1.22）

> 单号：JING-SPEC-ITEM-ACTIONBAR-DS ｜ 日期：2026-10-17（CST） ｜ 基线 HEAD `2324584`（工作区另有未跟踪 `ops/item-actionbar-20261017/`）
> 依据：Kevin 2026-10-17「详情页底部操作栏改成闲鱼（goofish）形态」+ 参考图 `ops/item-actionbar-20261017/ref/goofish-ref.png`（1128×170 · sha256 `308e2b62c45a2b3c3868d4783a93b19e2308523bb2cc5cece5b8bec4265485cd`，复算一致）
> 本单**只冻设计真源与 token 层**：`docs/design/style-preview.html`（纯追加）· `docs/design/design-system.spec.md`（§24 + 版本头 + §12 行）· `frontend/src/theme/tokens.js` · `frontend/src/theme/theme-tokens.css`（生成器重生成）。
> **UI 实现（`pages/item/**` / `ItemDetailPage` / `shell.css`）一行未动** —— 归下一单。

## 1. 冻结了什么

| # | 项 | 内容 |
|---|---|---|
| 1 | **新增 2 个颜色 token（本轮唯一新增）** | `--sf-cta-solid-bg` 日 `#202020` / 夜 `#EDEFF2`；`--sf-cta-solid-fg` 日 `#FFFFFF` / 夜 `#0A0A0A`（**夜档成对反相**：深底在夜档深页上会消失 ⇒ 亮底深字；亮底值与 `--sf-title-fg` 夜档同源；日档底色取既有 ink 家族 `--sf-btna-fg` 同值，不引入第二套墨色） |
| 2 | **其余零新增** | `聊一聊` = `--sf-btna-bg`/`--sf-btna-fg`（日夜同值 `#FFE60F`/`#202020`）；`收藏` = `--sf-btnalt-bg`/`--sf-btnalt-fg`/`--sf-btnalt-border`（夜档自带反相） |
| 3 | **形态口径 `T120`（§24，新 T 号 = 现取最大 T119 + 1）** | 三段结构（组合条 2 段 + 留白 + 独立收藏）· 组合条内部 **58% / 42%**（±1 个百分点）· 组合条与收藏**留白 > 0** · **两端半圆 + 中缝直角**（中缝 4 角 = 0）· 收藏 = 独立胶囊 · **两档几何逐值相等**（颜色以外不进主题层）· 几何常量落页面局部 `--sf-l-*`（承 `T98`，不进 `STRUCT`） |

## 2. 四处同动读数

| 件 | 改前 | 改后 | numstat |
|---|---|---|---|
| `docs/design/style-preview.html`（尾部纯追加 `<section id="item-actionbar-ref-v122">`） | 1103 行 / 93,949 B / md5 `7b8780af15802102f9ddf578510490a5` | 1172 行 / 102,653 B / md5 `a17919a495f4bd03bdf2434df8013753` | **`69 0`**（删除列 = 0） |
| `frontend/src/theme/tokens.js`（DAY / NIGHT 各 +2 键 · PROV +2 行） | 110 键 / 档 | 112 键 / 档（新键索引 **107 / 108**，两档 `orderEqual = true`） | `12 0` |
| `frontend/src/theme/theme-tokens.css`（**既有生成器重生成**，未手改；先跑零漂移 `cmp = 0`） | 8,155 B / 110 声明 / 块 | 8,275 B / 112 声明 / 块 | `4 0` |
| `docs/design/design-system.spec.md`（版本头 v1.22 + §12 表行 + §24） | 2819 行 / 651,259 B / md5 `7c3995951ab45ca61ba51a599a3a99f6` | 2904 行 / 669,944 B / md5 `d8bc778e9aede1e6f3b8bcc3cf41ff8d` | `86 1` ★ |

★ **spec 的 1 行删除是「空白行」**：§12 表在 v1.21 行之后原有 1 个空行（表被空行终止），新 v1.22 行若落在空行之后会**渲染成表外段落**（册内已登记过的坑）。故**删掉该空行**使 `v1.19 / v1.20 / v1.21 / v1.22` 四行连续同表 —— **零正文删除**（邻行实测见 `readings/selfproof-D.txt`）。

## 3. PROV 指针（逐键回读）

```
'cta-solid-bg': { d: [1130, 'background:#202020'], n: [1133, 'background:#EDEFF2'] },
'cta-solid-fg': { d: [1130, 'color:#FFFFFF'],  n: [1133, 'color:#0A0A0A'] },
```

真源对应行（**现取逐字**）：

```
1130:.vstage-a .cta-solid{background:#202020;color:#FFFFFF}
1133:.vstage-b .cta-solid{background:#EDEFF2;color:#0A0A0A}
```

**灵敏度自证（必做项，已跑）**：把指针临时改成 `1131 / 1134` ⇒ `theme-tokens.test.js` **当场红**（`cta-solid-bg.d: L1131 不含「background:#202020」` + `cta-solid-bg.n: L1134 不含「background:#EDEFF2」`，`1 failed | 12 passed`）；复原后回绿（`readings/gate-A-theme-tests.log`）。

## 4. 门套（逐条读数）

| 门 | 命令 | 读数 | 判 |
|---|---|---|---|
| A | `npx vitest run src/test/unit/theme-tokens.test.js src/test/unit/theme-shell-isomorphism.test.jsx` | **2 files / 33 tests passed** | ✅ |
| B | `npm run test:unit` | **56 files / 544 tests passed / 0 failed**（改前基线同为 `56 / 544`） | ✅ 例数未减 |
| C | `npm run build` | `✓ built in 1.76s` · `EXIT=0` | ✅ |
| D | 三处 `grep -n 'cta-solid'` + `git diff --numstat docs/design/style-preview.html` | 三处均命中；`69 0`（删除行 = 0） | ✅ |
| — | 生成器零漂移前置 | 改前跑一次 `gen-theme-css.mjs` ⇒ 与现盘 `cmp = 0` | ✅ 才使用生成器 |

## 5. 断言影响（**零计数常量前推**）

仓内 token 计数断言全为**下限 / 包含**式，故**未改任何测试文件**：

- `theme-tokens.test.js:65` `TOKEN_KEYS.length >= 100`
- `p6-btn-impl.test.js:85` `TOKEN_KEYS.length >= 106`
- `p6-btn-impl2.test.js:127` `BTN_VARS` 逐项 `toContain`
- 等值断言只有「日 / 夜两档键集与键序相同」（`theme-tokens.test.js:58-64` / `:181-186`），由实现本身满足（`orderEqual = true`）
- `theme-shell-isomorphism.test.jsx:240-250`「未登记 token」硬门：两键已进 `TOKEN_KEYS`

## 6. 未动面（禁区自证）

`frontend/src/pages/item/**` · `ItemDetailPage` · `frontend/src/shell/shell.css` · `data-sf-region` 集合 · `--sf-l-actionbar-h`(60px) · 任何既有 token 值 · 真源 1–1103 行 · spec §1–§23 —— **一字未改**（`git diff --name-only` 无命中，见 `readings/selfproof-D.txt`）。**未 `git add -A` · 未 commit · 未 push。**

## 7. 挂账（不得自选）

1. **「收藏」的数据承载 / 行为 = `OPEN`**：本站现取**无收藏接口 / 无收藏表**。本单只冻形态与颜色；「接后端收藏能力」vs「先渲染为无后端动作的视觉按钮」**须 Kevin / Zang 裁定**（§24.6 第 1 项）。
2. 操作栏高度 `--sf-l-actionbar-h` = 60px **不动**；若 44px 触控 + 60px 高度不够，另裁（§24.6 第 3 项）。
3. 组合条与收藏之间的**精确 px 留白**留给实现单（判据只到「> 0」，§24.6 第 4 项）。
4. 本单**未建** `docs/versions/design-system.spec.v1.22.md` 镜像（未在任何处声称已建）。

## 8. 证据清单（`readings/`）

- `gate-testunit-baseline.log`（改前基线 56/544）
- `gate-A-theme-tests.log`、`gate-B-testunit-after.log`、`gate-C-build.log`
- `selfproof-D.txt`（三处 grep + numstat + 状态 + 邻行）
- `jing-v122-readings.json`（结构化读数）

★ 日志类被仓根 `.gitignore:243/244`（`logs` / `*.log`）命中 ⇒ 入库须 `git add -f`（本单未 commit）。

---

> **留痕**：本文件原为 `REPORT.md`。实现单（Kong）按下单要求把实现报告写到 `REPORT.md` ⇒ 原文件**逐字重建**为本文件
> （内容取自同轮读取的原文；重建时未改一字、未删一条）。两单证据互不覆盖：本文件 = 设计真源冻结，`REPORT.md` = UI 实现。
