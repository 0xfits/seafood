# design-system.spec v1.18 delta · JING-SPEC-V118-MICRO（2026-10-12）

> 单号 **JING-SPEC-V118-MICRO** · 作者角色 = Jing（Specifier · 制度员）· 本单 = **微回写单**：只改 `docs/design/design-system.spec.md`（→ **v1.18**）+ 快照 / delta；**不改代码、不改台账 / 挂账**。依据 = Kong 停手上报的 v1.17 §20 两处自相矛盾 + **Kevin/Zang 亲核实测裁定（以实测为准，见 `frontend/src/locales/*.json` 现取）**。**体例 = 就地追加 / 就地更正 + 旧字面逐字保留 + 标「已被 v1.18 取代」（纯插入 ⇒ `numstat` 删除列 = 0）。**

## §A 三件回写 → 改动点（逐条）

| # | 依据（实测 / 裁定） | 改动点 |
|---|---|---|
| ① | **现取**：四语逐文件 `len(json)` = 顶层 **125** / 递归叶 = 拍平 **1078** / `× 4` = 四语节点 **4312**（四语逐文件相等）；新顶层命名空间 = `telegram`（11）+ `msg`（`msg.err.MSG_*` 7）+ `tg`（`tg.err.TG_*` 5）；HEAD 基线 = 顶层 **122** / 拍平 **1045** | **§20.8 顶层键数算式更正**：`122 + 1 = 123` ⇒ **`122 + 3`（`telegram` + `msg` + `tg`）= `125`**（拍平 `1078` / 四语节点 `4312` 原写**正确、不变**）；**★ 键名不得改**（保持 `msg.err.*` / `tg.err.*`，与后端**已 commit** 的 `i18n_key` 字面对齐，改键名破坏对齐） |
| ② | **以 §20.2 `T100` 为准**（未登录 ⇒ 点击走登录引导 = 隐含渲染）；v1.17 §20.3 判据表「未登录 ⇒ 不渲染」与 §20.9 `AC-1`「未登录可见该格 ⇒ 判负」与 §20.2 **互斥** | **§20.3 判据表未登录行 + §20.9 `AC-1` 就地更正（裁死）**：**卖家本人 ⇒ 不渲染**；**未登录 ⇒ 渲染且点击走既有登录引导（不 `disabled`）**；**登录 ∧ 非卖家 ⇒ 正常进会话**；`AC-1` 判负项改为自洽形式（**未登录就应看到第 3 格**；**只有卖家本人看到第 3 格才判负**） |
| ③ | **现取**：`frontend/src/test/unit/v15-nav-floatmenu.test.jsx:243-251` 仍断言占位钩子共存（`:240` 用例名 / `:250` 钩子非空 / `:251` `xPlaceholder` 文案在场）；`T101` 已显式删钩子 `messages-x-placeholder` + 键 `xPlaceholder`/`xNote`（四语）⇒ 断言必红 | **§20.7 新增 #9 + 其后就地注（登记改锚）**：改锚 = **「占位钩子计数归 0 + 真页钩子在场」**；**性质 = 属显式删除项引致的合法前推、非语义放宽**（Kong 并行单执行） |
| — | 本单边界 | **§20.12 就地更新**（`#4` 现取收口 + 本单只读边界）+ **§20.13 就地追加**（本节自证指针）+ **版本头 v1.18 行** + **§12 表 v1.18 行** |

## §B 改前 / 改后自证（真读数）

| 项 | 改前（v1.17） | 改后（v1.18） |
|---|---|---|
| 行数 | 2078 | **2093**（+15） |
| 字节 | 450,138 | **462,015**（+11,877） |
| md5 | `f0d8e248b791330bf1e45ba5cdfba084` | `f2341253c92138bfe64eac1d88414aba` |
| `git diff --numstat` | — | **`15 0`**（**删除列 = 0** ✓；全部为纯插入行，§20 原地正文一字未动；**未改既有行** ⇒ 无「必须改的既有行」需要说明） |
| 快照 `docs/versions/design-system.spec.v1.18.md` | — | `cmp` = **0**（逐字节相同）✓ |
| 改前快照对照 | `docs/versions/design-system.spec.v1.17.md`（本单开工复核 `cmp` = **0**；未动） | — |

## §C 范围自证

- 本单改动文件 = **恰 3**：`docs/design/design-system.spec.md` + 新建快照 `docs/versions/design-system.spec.v1.18.md` + 本 delta 件 `docs/audit/design-system-v1.18-delta.md`。
- **未动** `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `style-preview.html` / `docs/seafood.master-plan.md` / `docs/OPEN-ITEMS.md`；未启停任何服务；未跑任何门；未连库；未 `git add -A` · 未 commit · 未 push。
- **键集现取属只读复核**：`frontend/src/locales/{zh,en,hk,vn}.json` 逐文件读 = **125 / 1078 / 4312**（未写、未改）。`msg.err.*` / `tg.err.*` 键名逐字保留（grep 佐证：四语各含 `MSG_*` 7 + `TG_*` 5）。
- 全仓未改代码证明（本单写面）：`git status --porcelain` 中**本单产生**的条目 = 恰 1 个 spec（+ 未跟踪的新快照 / delta 属 `docs/**`）；`frontend/**` 的 M/?? 条目均为 **Kong 同轮并行单**（本单开工时已在盘，非本单写面）。
