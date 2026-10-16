# design-system.spec v1.19 delta · JING-SPEC-MSGPANEL-DS（2026-10-16）

> 单号 **JING-SPEC-MSGPANEL-DS** · 作者角色 = Jing（Specifier · 制度员）· 依据 = **Kevin 2026-10-16 逐字裁定「消息面板化（方案 1 · 就地叠加）」六条**（`docs/design/design-system.spec.md` §21.0）。**本单只写 `docs/**`**：改 `docs/design/design-system.spec.md`（→ **v1.19**）+ `docs/route-layer.spec.md`（→ **v2.34**）+ 快照 / delta 各二 + `docs/OPEN-ITEMS.md`（新增 `F21`/`F22`）；**不改任何代码、不跑任何门、不连库、不启停服务、不 commit、不 push**。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| 面板化形态（不换页 / 原地左压 / 挂载态与滚动保留） | Kevin 2026-10-16 ① | §21.2 **`T104`** |
| 打开 / 关闭判据 = 路由串匹配（**严禁宽度判定**）+ 关闭 = 移除 `msg`/`c` + 面板左上「×」 + 后退键 | Kevin ④⑥ | §21.2 **`T105`** + §21.4 |
| 几何冻结表（`600` / `104` / `704` / `240` / `360` / 全高 `fixed`；`≤767` 全屏 + 单栏两态；零断点值新增） | Kevin ①②⑥ + `T78` / `T85` 体例 | §21.2 **`T106`** + §21.3 |
| 四入口保全（`href` 一字不改）+ `/messages` 语义变更 + 两计数不变 | Kevin ⑤④ | §21.2 **`T107`** + 姊妹册 §44.4 / §44.5 |
| 落点 = 新文件 `shell/messages-panel.css`（`shell.css` 一字不动）+ 面板只用 `data-sf-m`（不得新增 `data-sf-region`）+ 壳层修饰类 + 零新 token / 零 `STRUCT` | 现取硬断言 15 条（§21.6）+ `T95`/`T98`/`N40` 体例 | §21.2 **`T108`** + §21.4 |
| `T101` 真页 ⇒ 面板（三态 / keyset / 两空态 / 触控 / 字号**逐字保留**，只换宿主） | Kevin ① + v1.17 `T101` | §20.2 表后**就地注** + §21.10 |
| 钩子面：16 条既有 `messages-*` **逐字保留**；唯一改名 `messages-page` ⇒ `messages-panel`；新增 3 条 `messages-panel*` | 现取 `MessagesPage.jsx:157/167/184/188/190/197/207/217/220/228/236/243/245/249/256/264/278` | §20.4 末**就地注** + §21.5 |
| i18n `+1` 键（`messagesPage.close` 四语）⇒ 顶层 `128` 不变 / 拍平 `1103→1104` / 四语节点 `4412→4416`；13 文件硬编计数前推 | **现取**（四语 JSON 解析）+ 本仓「新增键必前推全部硬编计数」纪律 | §21.7（含清单 B） |
| 断言改锚：真改锚 **2 处**（`v15-nav-floatmenu.test.jsx:245` 用例名 / `:260` 钩子）+ 冻结面 **16 条零改锚** | **现取**（各测试文件逐行） | §21.6（清单 A1 / A2） |
| 归因式 AC（AC-1 四入口 / AC-2 不换页 / AC-3 桌面几何 / AC-4 手机档 / AC-5 未打开零影响 + 尺子灵敏度自证 / AC-6 结构不变式） | §19.8 / §20.9 体例 + `N40` 教训族 | §21.8 |
| 教训 `N44`（就地叠加三条落点纪律）/ `N45`（换宿主的改锚成本 = 钩子命名策略） | 本单实测（改锚面压到 2 处；唯一大面 = i18n 13 文件） | §21.9 |
| 待裁 `Q4`（聊一聊落点形态）/ `Q5`（`768–1199` 左栏下限）/ `Q6`（动效） | 本单发现的口径分歧（**不自选**） | §21.11 |
| 姊妹册 route 侧 | Kevin ⑤④ + 本册 §21.2 `T107` | `docs/route-layer.spec.md` **v2.34 §44** |

## §B 改前 / 改后自证（真读数 · 本单实测）

| 项 | 改前 | 改后 |
|---|---|---|
| 行数 | **2100** | **2310**（+210） |
| 字节 | **467,793** | **506,871**（+39,078） |
| md5 | `49b2ebb1cae59d6409b2d3f70e8d9cbf` | `7b5c2a0be1ed7a527167568ab3409c23` |
| `git diff --numstat docs/design/design-system.spec.md` | — | **`210 0`**（**删除列 = 0 ✓** 纯追加；§20.2 / §20.4 两处就地注均为**新增行**，原地正文一字未动） |
| 快照 `docs/versions/design-system.spec.v1.19.md` | — | `cmp` = **0**（逐字节相同 ✓） |
| 改前快照对照 | `docs/versions/design-system.spec.v1.18.md` 对**现盘 live** `cmp` = **≠ 0**（`char 38020, line 19`） | **属预期**：该快照保留 **2026-10-15 勘误前**字面（其自述「本单未重制 / 未触碰 `docs/versions/**`」）⇒ **本单不重制、不触碰它**（历史留痕）；**本单改前读数以「现盘 live 正文」为准**（2100 行 / 467,793 B / `49b2ebb1…`） |
| 头部 / 正文两处同步（计数锚点） | — | ① `grep -n '^> \*\*★ 现行版 = v1.19'` = **1**；② `grep -n '^## §21 '` = **1**；另 §12 表 `grep -n '^| \*\*v1.19\*\* |'` = **1** ✓ |

## §C 范围自证

- 本单改动路径 = **恰 7**（逐条）：`docs/design/design-system.spec.md`（改）· `docs/route-layer.spec.md`（改）· `docs/versions/design-system.spec.v1.19.md`（**新建，快照**）· `docs/versions/route-layer.spec.v2.34.md`（**新建，快照**）· `docs/audit/design-system-v1.19-delta.md`（**新建，本件**）· `docs/audit/route-layer-v2.34-delta.md`（**新建**）· `docs/OPEN-ITEMS.md`（**追加** `F21`/`F22`）。
- **未动**：`frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `docs/seafood.master-plan.md` / `docs/qa/**` / 既有任何 `docs/versions/**` 快照；**未启停任何服务（绝不 `pm2 restart`）**；**未跑任何门**（`build` / `test:unit` / 后端离线门均未执行）；**未连库**；**未 `git add -A` · 未 commit · 未 push**。
- **`frontend/` 未改自证（可复核）**：`git status --porcelain frontend/ backend-ts/` = **空**（本单结束时应为空串）。
- **未发明项**：几何值（`600`/`104`/`704`/`240`/`360`）全部来自 Kevin 裁定逐字或**现取几何的派生**（`shell.css:118` `right:16px` + `:120` `width:72px`）；键名（`messagesPage.close`）与钩子名（`messages-panel*`）为**本册命名**（**新产物、已逐条落表**）；**未发明任何路径 / 错误码 / 数值 / 后端契约**。

## §D 勘误补登（Neng 质检 `7150278` 的 6 条 `spec_drift` · 勘误级不升版 · 2026-10-16）

> 依据 = `docs/qa/v119-msg-panel-qa.md` **§10 六条**（判决 **PASS-with-drift**；被检面 = `b776aee`）；**旧字面逐字保留 + 标「已被本单实测取代」**。姊妹册 = `docs/audit/route-layer-v2.34-delta.md` §D。

| 项 | 改前（`bc57a3a` 落笔版） | 改后（本补登 · 现盘） |
|---|---|---|
| 行数 | **2310** | **2351**（+41） |
| 字节 | **506,871** | **515,046**（+8,175） |
| md5 | `7b5c2a0be1ed7a527167568ab3409c23` | `b0a993515e9d2c9519bae68b47d6ab88` |
| `git diff --numstat docs/design/design-system.spec.md` | — | **`41 0`**（**删除列 = 0 ✓ 纯追加**；旧字面逐字保留、「★ 勘误补登」块全部为**新增行**） |
| 镜像 `docs/versions/design-system.spec.v1.19.md` | `cmp` 相对旧 live = 0 | **重制（`cp` 覆盖）⇒ 对现盘 live `cmp` = 0**（复核 ✓） |
| 三处锚点（计数锚点，改后实测） | — | ① `grep -c '^> \*\*★ 现行版 = v1.19'` = **1**；② `grep -c '^## §21 '` = **1**；③ `grep -c '^| \*\*v1.19\*\* |'` = **1** ✓ |

- **补登范围（漂移 ①–⑥ 逐条）**：① 入口③「聊一聊」**就地叠加** ⇒ 取代 `§21.8 AC-1③` / `§21.11 Q4` 的「换页」字面（**`toContain('/messages?c=')` 型锚不得采用**）；② `/messages` 直链态「×」⇒ **回首页**（`T105` 判据必然推论）；③ `≥768` 未选会话右栏空态 **全档**复用既有键 `messages-detail-empty`；④ 分隔线 = `.sf-mp-list` **`border-right`**（非 `inset` 阴影）；`600 = 240 + 360` 依赖 **Tailwind preflight `box-sizing: border-box`**（隐式依赖已登记）；⑤ 「零横向溢出」**降级为环境性旁证**（承重 = 面板宽 / 右偏移 / 间隙 / 相交 / 正文右缘五条）；⑥ **`AC-5` 声明式归一化口径**（结构键 + 剔 `alt`/`title` 属性值）+ **噪声源具名 `Footer.jsx:12`** + **raw 判据原样保留 `ENV_LIMITED`（未改写为 PASS）**。
- **未动**：`§1`–`§20` 一字未动；`T104`–`T108` 条文与 §21.3 几何冻结值**一字不改**；`docs/versions/design-system.spec.v1.18.md` **未触碰**（勘误前历史）。
- **未动代码自证**：`git status --porcelain frontend backend-ts` = **空**。**未 push**。
