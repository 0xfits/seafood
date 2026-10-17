# design-system.spec v1.20 **就地注 delta2** · JING-SPEC-CARDUI-DS-B（2026-10-17）

> 单号 **JING-SPEC-CARDUI-DS-B**（承 `JING-SPEC-CARDUI-DS`）· 作者角色 = Jing（Specifier · 制度员）· 依据 = **Zang 终审 2026-10-17**（`Q5`–`Q9` 五条待裁全部定案 + 两条新教训）＋ **Kevin 2026-10-17 追加口径**（逐字：「**日档配色可严格参照 goofish，夜档另议，本项目需要夜档。**」）。**本单 = 微回写单**：只写 `docs/**` + 本单读数；**v1.20 就地注（不新开版本、不新开节）**；**不改 `frontend/**`**；**未启停任何服务**；**未 `git add -A` · 未 commit · 未 push**。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| `Q5` 已裁 = (a)：`RewardCard.jsx` 缺省 `variant` 由 `'primary'` ⇒ **`'default'`**；**稀有度渐变底同批去掉**；**稀有度图标 + `absolute` 光斑保留**；**不得改 `ui/Card.jsx` 变体表** | Zang 终审 + 现取 `Card.test.jsx:17-19`（冻结 `primary` 的 `bg-yellow-50 border-yellow-200`） | §22.11 已裁登记表 `Q5` 行 + §22.14 |
| `Q6` 已裁 = (a)：去 `hover="glow"`（黄环 `ring-2 ring-yellow-200`）⇒ `hover="none"` + `className` 加 **`hover:shadow-lg`**、**不位移**；不动 `ui/Card.jsx` hover 变体表 | Zang 终审 + Kevin「hover 略加阴影」 | §22.11 已裁登记表 `Q6` 行 + §22.14 |
| `Q7` 已裁 = (a)：夜档 `--sf-surface-bg` **保留 `#101114`**（PROV 仍 `style-preview.html:1073`）+ **标注「暂定值」** | Zang 终审 | §22.11 `Q7` 行 + §22.12 第 12 项 |
| `Q8` 已裁 = **不动**（`--sf-st-shell-max-w` 保持 `1440px`） | Zang 终审 | §22.11 `Q8` 行 |
| `Q9` 已裁 = (a) 的**变体**：数字**保持 `text-2xl`(24px)**、`$`/单位 = 数字的 **`0.75em`(≈18px)**、数字 `font-bold`、**零新增常量 / token / `--sf-l-*`** | Zang 终审 + 现取 `RewardCard.jsx:93/:96`（24px ÷ 14px = 0.583） | §22.11 `Q9` 行 + §22.9 `AC-2` 仍为收口判据 |
| **夜档另议边界**：日档严照 goofish；夜档「最小改动 + 保可读」；**仅三处实际变化**（① 卡底 奶黄⇒纯白 ② 新 token 夜档 `#101114`〔暂定〕 ③ 价格色 ⇒ 深墨 `#030402`，卡内局部重绑三色为日档值）；**「夜档整卡配色本轮未定 · 另立单」** | Kevin 2026-10-17 追加口径 + Zang 终审 | §22.11「夜档另议边界」块 + §22.12 第 11/12 项 + §22.14 末条 |
| **新 `AC-9`** 夜档价格可读性（WCAG ≥ 4.5:1 + 改前/改后两读数 + 反事实臂灵敏度自证） | Zang 终审 + 本单 canvas 回读 sRGB + WCAG 计算 | §22.9 表末插入 |
| 教训 **`N48`**（候选裁定的「视觉权重」必须显式声明）/ **`N49`**（「主题无关浅色卡 × 两档异值 token」= 必然有一档失读，定式二选一） | 本单实测（`Q9` 候选 (a) 隐含 24px⇒21px；`#FDE815` 在白卡 = 1.255:1） | §22.10 末插入 |
| 断言面重取（`Q5`/`Q6`/`Q9` **零改锚**；保护面在 `Card.test.jsx`；`reward-card-view` 测试锚复核） | 现取全仓测试 | §22.7 小结后 + §22.12 第 15/16 项 |
| `style-preview.html` **零改动**（本单不产生新真源值 ⇒ 不触发 `N46` 双件） | `Q5`–`Q9` 裁定均复用既有真源 / 既有 Tailwind 档 | §22.14（真源面） |

## §B 改前 / 改后自证（**本单终值** · 真读数）

| 项 | 改前（本单开工现取） | 改后（**本单终值**） |
|---|---|---|
| `design-system.spec.md` 行数 | **2569** | **2620**（+51） |
| `design-system.spec.md` 字节 | **564,194** | **582,734**（+18,540；= 七个插入块 UTF-8 18,531 B + 9 B 分隔换行 ⇒ **算术闭合**） |
| `design-system.spec.md` md5 | `16f124fc6533770c912e79d6487ebac0` | **`185f9da2ccab9d8779dfec339ee2c23d`** |
| `design-system.spec.md` sha256 | —（未取） | **`d4018f489777a0261ad950169cc36ea68056a50aaaac4dad985757e06185e4c7`** |
| `git diff --numstat docs/design/design-system.spec.md` | `214 0` | **`265 0`** ⇒ **删除列 = 0 ✓ 纯追加 / 无一行改写** |
| `git diff --numstat docs/design/style-preview.html` | `61 0`（上单） | **`61 0`（本单零改动 · 与上单逐字相同）** |
| 本版镜像 `docs/versions/design-system.spec.v1.20.md` | `16f124fc6533770c912e79d6487ebac0`（与改前 live `cmp=0`） | **`185f9da2ccab9d8779dfec339ee2c23d`**（重制；对改后 live **`cmp` = 0 ✓**） |
| `docs/design/style-preview.html` | 1103 行 / 93,949 B / md5 `7b8780af15802102f9ddf578510490a5` | **同值（零改动）** |
| 三处版本记录同步 | —— | 头部 `^> \*\*★ 现行版 = v1.20` = **1**；正文 `^## §22 ` = **1**；§12 表 `^\| \*\*v1.20\*\* \|` = **1**（**均一字未动**） |
| 本单新落点在场 | —— | `AC-9` 行 = 1；`` `N48` ``/`` `N49` `` = 4/4 命中；「已裁登记表」= 1；「夜档另议边界块」= 1；`§22.14` 标题 = 1；§22.12 新增第 11–16 项 = 6 项 |
| **`AC-9` 三臂**（canvas 回读 sRGB ⇒ WCAG 2.x） | **2.841:1**（`#D08700` on `#FEFCE8` ✗） | **20.546:1**（`#030402` on `#FFFFFF` ✓）；**反事实臂 1.255:1**（`#FDE815` on 白卡 ⇒ 判负已证） |
| 旁证两臂 | `dark:` 若命中：**1.521:1**（`#FDC700` on `#FEFCE8`）· 夜档 token on **夜底**：**15.589:1** | —— |

**★ 落点清单（逐处 · 全部为**插入**）**：① §22.7 断言影响小结后（`Q5`/`Q6`/`Q9` 零改锚 + `Card.test.jsx` 才是保护面）；② §22.9 表末（`AC-9`）；③ §22.10 末（`N48` / `N49`）；④ §22.11 表后（**已裁登记表** + **夜档另议边界块**）；⑤ §22.12 表末（第 11–16 项 + 断言面重取注）；⑥ 文末 §22.14（本单总注）。**§22.0–§22.13 原正文一行未改。**

## §C 未动面自证

```
 M docs/design/design-system.spec.md          ← 本单（就地注）
 M docs/design/style-preview.html             ← 上单（本单零改动）
 M frontend/src/components/reward/RewardCard.jsx
 M frontend/src/pages/HomePage.jsx
 M frontend/src/pages/item/item.css
 M frontend/src/shell/shell.css
 M frontend/src/theme/theme-tokens.css
 M frontend/src/theme/tokens.js
?? docs/audit/design-system-v1.20-delta.md
?? docs/versions/design-system.spec.v1.20.md
?? frontend/src/components/reward/reward-card.css
?? ops/ui-card-ref-20261017/
```

- **`frontend/**` 的六件改动全部属于**上单 / Kong 实现单**（其中 `reward-card.css` 为 Kong 新建未跟踪件）；**本单一行未写 `frontend/**`**（本单只读现取一次，读数见 §D 与 `jing-v120b-readings.txt` 【9】）。
- **未动 `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `ops/ui-card-ref-20261017/shots/**`**；**未启停任何服务**（5787 现取仍 200）。
- **参考图 sha256 现取与上单逐字相同**：`be25f542…491`（`current-seafood.png`）/ `c7a0aa9f…fa0`（`ref-xianyu.png`）。
- **`docs/versions/design-system.spec.v1.18.md` / `v1.19.md` 未写**（`v1.19` md5 复取 = `1ac3dc50c40cb15d409d008090d02e47`，与上单同）。
- **未 `git add -A` · 未 commit · 未 push**。

## §D 证据件清单

| 件 | 内容 |
|---|---|
| `ops/ui-card-ref-20261017/readings/jing-v120b-readings.txt` | 十二段现取读数：本单性质 / spec 改前改后终值 / 快照镜像 / 三处版本锚 / 新落点在场 / 真源零改动（含「不触发 `N46` 双件」的推论）/ **`dark:` 无效的五条事实链** / `Q9` 改前绝对值 / 断言面重取 / **`AC-9` 三臂 WCAG + canvas 回读 sRGB** / 实现面只读现取（非终值）/ 未动面 / 挂账 / `.log` 入库告警 |
| `ops/ui-card-ref-20261017/readings/jing-v120b-selfproof.log` | **可复跑**自证脚本输出（10 段 · 93 行 / 5,163 B）：终值 md5/sha256 · `cmp` 镜像 · `numstat` 删除列 · 三处锚 · 新落点 · 主题事实链 · `Q9` 改前 + 断言面 · **WCAG 三臂由 sRGB 复算** · 未动面 / shots sha256 · 服务面。**★ `.log` 后缀被 `.gitignore:244 *.log` 命中（`git check-ignore` exit 0）⇒ 入库须 `git add -f`**（承 `N42`）；`.txt` 不受影响（check-ignore exit 1）。 |

## §E 挂账 / 诚实清单（本单）

- **`UNRESOLVED` · 另立单**：「**夜档整卡配色（是否深色卡 / 价格是否亮黄）本轮未定，另立单**」＋ `--sf-surface-bg` 夜档 `#101114` **暂定值**复核（已入册 §22.11 夜档另议块 + §22.12 第 11/12 项 + §22.14 末条）。
- **`NOT_MEASURED`**：`AC-9` 的**页内真渲染取色**（改后无产物 ⇒ 值对由已声明值精确给定，渲染实测归 Kong）；`dark:text-yellow-400` 在「OS 深色 × 站点日档」下命中并压低对比度的**实测**（本单只给结构推断 + 复取法）。
- **非本单写面**：`frontend/**` 六件（含 Kong 新建 `reward-card.css`）× `frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx`（未跟踪临时件 · **不应随单入库**）。
- **★ v1.20c 勘误单（= `docs/audit/design-system-v1.20-delta3.md`）收口上条**：`frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx` ⇒ **已清理 · 现取不存在**（2026-10-17 现取：`ls` = `No such file or directory`；`grep -rn 'zz-kong-ac4-tmp' frontend/src/test` = **0 命中**）⇒ 上条「不应随单入库」的**待清理挂账已闭环**（**该件的现取口径以 `delta3` §E 为准**）。
