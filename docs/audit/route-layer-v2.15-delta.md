# route-layer.spec v2.15 delta —— 批 9 第 3 片（P9③）**契约冻结**：评分 / 时效（四角色指标）+ R-9-7 发货 / 收货

> **角色**：Jing（Specifier · 制度员）· **单号** = **JING-SPEC-P9-3** · **同批姊妹册** = `docs/audit/data-layer-v0.22-delta.md`（正文 = `data-layer.spec` v0.22 §32）。
> **口径**：**只追加 · 追加式 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件 · 不新建迁移文件 · 不 apply · 不 `git add/commit/push`**。
> **依据（逐字）**：`docs/requirements/p9-four-role-economy.md` **§2**（`:14-51`）+ **§3**（`:53-65`）+ **§7**（`:128-132`）；已定裁定 **`R-9-1`**（`docs/seafood.master-plan.md:2055`）/ **`R-9-4`**（`:2058`）/ **`R-9-7`**（`:1990`）。
> **上游对锚**：`git log --oneline -1` = **`c6151d4`**（P9② 质检 PASS + 上线 + 生产终验 · **HEAD 含 P9② 已推** ✅）。
> **本单性质**：P9③ 的「契约冻结」（与 P9①/P9② 冻结单同族）—— **不含裁定落册**（本片无新裁定；只承接已定 `R-9-1`/`R-9-4`/`R-9-7`）。

## §D0 指纹（改前 / 改后 · 现取）

| 项 | 改前（v2.14） | 改后（v2.15） |
|---|---|---|
| 文件 | `docs/route-layer.spec.md` | 同 |
| 行数（`wc -l` = 换行符数） | **6608** | **6849** |
| 逻辑行 | **6609**（末行 `---` 无尾换行） | **6850**（同 · 末行 `---` 无尾换行保留） |
| 字节 | 1329388 | **1361329** |
| md5 | `53e5bbfc70a0971d24d76e1210af6dda` | **`a595cee6b50981c9cf49ed4143cf9164`** |
| sha256 | `04ebeaca3749ce16d91e25973e43547855cc24f8fc08a4c45f8adcbba95fa703` | **`85874d389400fc19d69c521e9ea763faddff10f26d24b77c6b46181da283e0a2`** |
| 改前快照 | `docs/versions/route-layer.spec.v2.14.md`（`cmp` = 0 · **未动**） | — |
| 改后快照 | — | **`docs/versions/route-layer.spec.v2.15.md`**（`cmp` = 0 · sha256 同上） |

**★ 只追加自证**：`git diff --no-index --numstat docs/versions/route-layer.spec.v2.14.md docs/route-layer.spec.md` = **`241\t0`**（**删除列 = 0**）；`git diff --numstat -- docs/route-layer.spec.md`（HEAD → 工作树）= **`241\t0`**；`difflib.SequenceMatcher` 独立复核（v2.14 → v2.15）= **0 replace / 0 delete / 241 insert**；**末行 `---` 无尾换行保留**（`tail -c 8 | xxd` = `2a 20 7c 0a 0a 2d 2d 2d` ⇒ 末 3 字节 = `2d 2d 2d` = `---`、**无尾换行**）；**改前既有快照一字未动**（本单只**新建** `v2.15` 一件）。

> **★ 手法登记（诚实）**：首次插入脚本误用 `str.index(空行串)` ⇒ 命中**文件中第一处空行**（偏移 0）⇒ 状态块误落文件顶部；**已 `git checkout -- docs/route-layer.spec.md` 复原，改以「按前 N 行累加字符偏移」定位**（`sum(len(l)+1 for l in lines[:268])`）后重插 ✅。**data-layer 侧未受影响**（其锚 = 唯一的 v0.21 状态长串 · `str.index` 不歧义）。

## §D1 改动点（逐条 · **2 处** · 逐处给插入位置行号）

| # | 落点 | 插入位置（改前 v2.14 · 1-based） | 新文件起行 | 内容 |
|--:|---|---|--:|---|
| 1 | **顶部状态块区** | 插在 **v2.14 本单要点行（旧 268）之后** | **269** | **新增 v2.15 状态块**（空行 + 3 行 = 状态 / 修订入口 / 本单要点，**共 4 行**；⇒ 其后全部行号 +4）；**未改写旧行** |
| 2 | **§28 末（末行 `---` 之前）** | 插在 **本册末行 `---`（旧 6609 · 无尾换行）之前** | **6613** | **§29**（12 小节 = §29.0–§29.11 · **237 行**）：读 / 动作口清单 / 配置写口复用 / 权限键映射 / 注册点 `80 → N` 预登记 + 错误码 / `R107` / 真生效四段 / 后台页 + 四语 + 六类禁漏 + 派生布尔 / 三变体（不择一）/ 判据分级 + `NOT_MEASURED` / 待办 + 指纹自证 / 引用关系 |

**非追加改动 = 0 处**（**§17–§28 全部旧行一字未动**）。**全部 2 处均为纯插入**（`difflib` 复核 0 replace / 0 delete）。

## §D2 与要件的对应（route 侧 · 诚实登记）

| 面 | 定案 / 冻结 | 落点（本册） |
|---|---|---|
| **读 / 动作口** | 候选 2 读（`GET /api/rating/summary` · `GET /api/timeliness`）+ 3 动作（`POST /api/rating` · `POST /api/listing-orders/:orderId/ship` · `POST /api/listing-orders/:orderId/receive`）；全闸 `requireActor`；A2/A3 加**归属闸**（卖方 / 买方本人） | §29.2 |
| **权限键映射** | 5 口**零授权键新增**（用户面 `requireActor`）；配置面 `manage_settings`；**11 键零增删** | §29.4 |
| **注册点** | **`80 → 85`（变体Ⅰ）/ `84`（Ⅱ）/ `83`（Ⅲ）** 逐 verb 预登记 | §29.5 |
| **错误码 / 形状** | **既有闭集优先 · 零新增**（借码 + `reason` 稳定常量）；**R107 单形状**（`details` 禁敏感） | §29.5 |
| **真生效四段** | ①改键 → ②库内落值（姊妹册 §32.7③）→ ③业务读口取数 → ④行为随之；每段判负 + 负对照 | §29.6 |
| **后台页 + 四语 + 六类禁漏** | 后台页 0 页（复用 `adminSettings`）；用户面 `ratingPanel` / `timelinessPanel` / `listingOrders.statusLabel` + 「暂无数据」；四语 `zh/en/hk/vn`；六类禁漏 + 负对照 | §29.7 |
| **三变体** | **Ⅰ / Ⅱ / Ⅲ 不择一**（注册点 +5/+4/+3） | §29.8 |
| **判据分级 + 未测项** | 镜像级 ≠ 真链级；7 项 `NOT_MEASURED`（逐项原因） | §29.9 |

- **逐字遵守**：`R-9-1` / `R-9-4` / `R-9-7` 照录（`docs/seafood.master-plan.md:2055` / `:2058` / `:1990`）；姊妹册 §32 的键面 / 库面 / 状态机口径**只指路、不重抄**。
- **未发明**：路径（5 口 = 候选 · 构词法可复算）、注册点数（变体随择）、权限键（11 键现取）、错误码（**闭集 33 不动 · 零新增**）、文案值（不写 · 登记实现单）。

## §D3 只追加自证（逐条）

- `git diff --numstat`（HEAD → 工作树）**删除列 = 0**：route-layer = **`241\t0`** ✅。
- `git diff --no-index --numstat`（冻结快照 → 本单）**删除列 = 0**：route-layer = **`241\t0`** ✅。
- `difflib.SequenceMatcher`（v2.14 → v2.15）**0 replace / 0 delete / 241 insert** ✅。
- `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.15.md` ⇒ **退出码 0**（改后快照与本册逐字节相同）✅。
- **末行 `---` 无尾换行保留** ✅。
- **插入手法**：状态块 + §29 由**一次性 Python 脚本原子插入 + 断言**（`assert` 头部锚 + 末尾 `\n\n---` 锚 + `difflib` 0 replace/delete 断言），**非手写 patch**；**误插已复原并重插**（§D0 手法登记）✅。
