# route-layer.spec v2.34 delta · JING-SPEC-MSGPANEL-RT（2026-10-16）

> 单号 **JING-SPEC-MSGPANEL-RT** · 作者角色 = Jing（Specifier · 制度员）· 依据 = **Kevin 2026-10-16 逐字裁定「消息面板化（方案 1 · 就地叠加）」六条**（`docs/route-layer.spec.md` §44.0）。姊妹册 = `docs/design/design-system.spec.md` **v1.19 §21**（形态 / 几何 / 钩子 / 断言改锚 / 键集算式）。**本单只写 `docs/**`**；**零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件 · 不 commit · 不 push**。
> **本单建独立 delta 件之依据**：本册既有惯例 = **语义变更类建 delta**（§36.4 / §37.4 / §38 / §39 / §41 同族）、**纯登记类不建**（§42 / §43）；**本单属语义变更类**（`/messages` 落点语义 + 新增查询参数口径）⇒ **建**。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| `/messages` 语义：**独立真页 ⇒ 直链落点 = 首页 + 面板**（路径字面逐字保留、`App.jsx` 一字不改） | Kevin ②⑤ | §44.2 |
| 新增查询参数口径 **`?msg=1`**（开面板）**/ `&c=<conversation_id>`**（面板内打开该会话）；关闭 = 移除 `msg`/`c`（`replace`）；后退键天然关 | Kevin ①②③ | §44.3(1)(2) |
| 参数组合矩阵四态（无参 / `?msg=1` / `?msg=1&c=` / `?c=`） | Kevin ① + 现取入口③形态 | §44.3(3) |
| **口径外延登记**：`?c=` **单独出现也构成开面板判据**（否则入口③ 失效） | 本单发现（**非 Kevin 逐字**）⇒ **标「一句话可改」** | §44.3(1)「`c` 子句的登记理由」+ 姊妹册 §21.2 `T105` |
| 四入口保全表（**逐条现取 `href` / 路径字面 / 文案字面**） | Kevin ④ | §44.4 |
| 两计数不变：前端字面 **`42`** / 精确 **`34`** / 内层逐段 **`20`**；后端注册点 **`105`** | **现取**（§40.2 / §43.4 同口径） | §44.5 |
| `/messages` 与 catch-all 边界（精确段优先；带参亦不落提示页） | 现取 `App.jsx:119` vs `:175` | §44.2 |
| 待裁 `Q4`（聊一聊落点形态）/ `Q7`（参数是否进 history） | 本单发现（**不自选**） | §44.3(4) |
| 零新后端面（`/api/messages` 族读口 / `MSG_*` `TG_*` 码集 / `details.reason` 域 / 幂等键） | Kevin ⑤ + §41 既有条文 | §44.0 ⑤ + §44.7 #7 |

## §B 改前 / 改后自证（真读数 · 本单实测）

| 项 | 改前 | 改后 |
|---|---|---|
| 行数 | **8357** | **8499**（+142） |
| 字节 | **1,641,256** | **1,661,215**（+19,959） |
| md5 | `ccac4b9ef31ea02ed40de7fee8054e89` | `5395260f49aeab5041ffe1850a097896` |
| `git diff --numstat docs/route-layer.spec.md` | — | **`142 1`** —— **该 `1−` = 文末 EOF 换行归一化**（改前末行**无行尾换行符** ⇒ 追加后获得换行；**字符内容一字未变**；`git diff` 该 hunk 逐字为「`-  …emoji 不拆）…` + `\ No newline at end of file`」⇒「`+  …emoji 不拆）…`」）；**属承 §42.7 / §43.6 同族的已知现象，正文零删除** |
| 快照 `docs/versions/route-layer.spec.v2.34.md` | — | `cmp` = **0**（逐字节相同 ✓） |
| 改前快照对照 | `docs/versions/route-layer.spec.v2.33.md` | 本单开工复核 `cmp` = **0**（md5 `ccac4b9e…`）；**未动** ✓ |
| 头部 / 正文两处同步（计数锚点） | — | ① `grep -n '^> \*\*状态：v2.34'` = **1**（`:371`）；② `grep -n '^## §44 '` = **1**（`:8371`）✓（两处同批入库，漏一处 = 不完整） |
| `p7b-03` 冻结面 | `backend-ts/scripts/p7b-03-offline-gates.ts:145` = `regs === 105` | **已到位、无需前推**（本单零新路由）✓ |

## §C 范围自证

- 本单改动路径 = **恰 7**（逐条）：`docs/route-layer.spec.md`（改）· `docs/design/design-system.spec.md`（改）· `docs/versions/route-layer.spec.v2.34.md`（**新建，快照**）· `docs/versions/design-system.spec.v1.19.md`（**新建，快照**）· `docs/audit/route-layer-v2.34-delta.md`（**新建，本件**）· `docs/audit/design-system-v1.19-delta.md`（**新建**）· `docs/OPEN-ITEMS.md`（**追加** `F21`/`F22`）。
- **未动**：`frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/data-layer.spec.md` / `docs/seafood.master-plan.md` / `docs/qa/**` / 既有任何 `docs/versions/**` 快照（含 `v2.33`）；**未启停任何服务**；**未跑任何门**；**未连库**；**未 `git add -A` · 未 commit · 未 push**。
- **未发明项**：路径字面（`/messages`）与参数名（`msg` / `c`）**全部来自 Kevin 裁定逐字**；四入口 `href` / 文案字面**逐条现取**；两条计数**现取命令可复核**；**未发明任何路径 / 错误码 / 数值 / 后端契约**。
- **口径外延项（唯一）**：`?c=` 单独出现亦开面板 —— **非 Kevin 逐字**，为「入口③自洽」所必需，**已标「一句话可改」并登记 §44.3(1)**（**不得当 Kevin 口径引用**）。
