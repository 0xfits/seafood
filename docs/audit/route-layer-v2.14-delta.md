# route-layer.spec v2.14 delta —— 批 9 第 2 片（P9②）**裁定落册**：Zang 七裁定 `R-9-14`..`R-9-20` 就地定案

> **角色**：Jing（Specifier · 制度员）· **单号** = **JING-SPEC-P9-2R** · **同批姊妹册** = `docs/audit/data-layer-v0.21-delta.md`（正文 = `data-layer.spec` v0.21 §31）。
> **口径**：**只追加 · 追加式就地加注 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件 · 不新建迁移文件 · 不 apply · 不 `git add/commit/push`**。
> **依据（逐字）**：`docs/seafood.master-plan.md` **§5.230 B**（七条裁定 · `:1428-1434`）+ **§5.230 C**（派单「P9② 裁定落册」· `:1436`）。
> **上游对锚**：`git log --oneline -1` = **`ce4f8db`**（P9② 冻结交付 · route v2.13 §28 `233 0` · **HEAD 含之** ✅）。
> **本单性质**：把 §28 内 `PENDING_ZANG` 各项**就地定案**（**旧文一行未改**）—— 一律以「★ Zang 裁定（`R-9-xx`）」块追加于对应小节末尾。

## §D0 指纹（改前 / 改后 · 现取）

| 项 | 改前（v2.13） | 改后（v2.14） |
|---|---|---|
| 文件 | `docs/route-layer.spec.md` | 同 |
| 行数（`wc -l` = 换行符数） | **6562** | **6608** |
| 逻辑行 | **6563**（末行 `---` 无尾换行） | **6609**（同 · 末行 `---` 无尾换行保留） |
| 字节 | 1320697 | **1329388** |
| md5 | `4f445b3417b244b38b690d69c70a22a8` | **`53e5bbfc70a0971d24d76e1210af6dda`** |
| sha256 | `d9e3530e2b6b5503279cd0bf96760e9a0dc1c09040a2eeab2ccc2b359a4fb4b7` | **`04ebeaca3749ce16d91e25973e43547855cc24f8fc08a4c45f8adcbba95fa703`** |
| 改前快照 | `docs/versions/route-layer.spec.v2.13.md`（`cmp` = 0 · **未动**） | — |
| 改后快照 | — | **`docs/versions/route-layer.spec.v2.14.md`**（`cmp` = 0 · sha256 同上） |

**★ 只追加自证**：`git diff --no-index --numstat docs/versions/route-layer.spec.v2.13.md docs/route-layer.spec.md` = **`46\t0`**（**删除列 = 0**）；`git diff --numstat -- docs/route-layer.spec.md`（HEAD → 工作树）= **`279\t0`**（= 冻结 `233` + 本单 `46`，**删除列仍 = 0**）；`difflib.SequenceMatcher` 独立复核（v2.13 → v2.14）= **0 replace / 0 delete / 7 insert**；**末行 `---` 无尾换行保留**（`tail -c 5 | xxd` = `7c 0a 0a 2d 2d 2d`）✅；**改前既有快照一字未动**（本单只**新建** `v2.14` 一件）。

## §D1 改动点（逐条 · **7 处** · 逐处给插入位置行号）

| # | 落点 | 插入位置（改前 v2.13 · 1-based） | 新文件起行 | 内容（就地加注块） |
|--:|---|---|--:|---|
| 1 | **顶部状态块区** | 插在 **v2.13 要点行（旧 264）之后** | **266** | **新增 v2.14 状态块**（空行 + 3 行 = 状态 / 修订入口 / 本单要点，⇒ 其后全部行号 +4） |
| 2 | **§28.2 末** | 插在 **`### 28.3`（旧 6389）之前** | **6393** | ★ `R-9-19`：**4 新口逐字定案**（`/api/batt` · `/api/checkin` · `POST /api/checkin` · `POST /api/checkin/makeup`）+ 闸 / 幂等键逐口形态 + A2 资金腿 |
| 3 | **§28.4 末** | 插在 **`### 28.5`（旧 6415）之前** | **6431** | ★ **权限键映射**落位确认（用户面无 admin 键 / 配置面 `manage_settings` / 承接闸不改闸 · 11 键零增删） |
| 4 | **§28.5 末** | 插在 **`### 28.6`（旧 6449）之前** | **6468** | ★ `R-9-19`：**注册点 `76 → 80` 逐 verb 定案**（`get 34 / post 43`）+ 变体 Ⅰ 定案 / Ⅱ·Ⅲ 不采纳 + 判负 |
| 5 | **§28.6 末** | 插在 **`### 28.7`（旧 6463）之前** | **6495** | ★ **真生效四段判据**（①③④ + ② 段指向姊妹册 §31.6 · 两读数 · 每段判负 + 负对照） |
| 6 | **§28.7 末** | 插在 **`### 28.8`（旧 6478）之前** | **6513** | ★ **后台页契约 + 四语命名空间**（`adminSettings` / 候选 `adminEconomyConfig` · `battCard` / `checkinPanel` · 四语 `zh/en/hk/vn` · 六类禁漏） |
| 7 | **§28.8 末** | 插在 **`### 28.9`（旧 6505）之前** | **6545** | ★ `R-9-19`：**变体 Ⅰ 采纳 · Ⅱ/Ⅲ 不采纳**（含理由转引） |

**非追加改动 = 0 处**（**§17–§28 全部旧行一字未动**）。**全部 7 处均为纯插入**（`difflib` 复核 0 replace / 0 delete）。

## §D2 与裁定的对应（route 侧 · 诚实登记）

| 面 | 定案 | 落点（本册） |
|---|---|---|
| **4 新口** | `GET /api/batt`（R1）· `GET /api/checkin`（R2）· `POST /api/checkin`（A1）· `POST /api/checkin/makeup`（A2）；**全闸 `requireActor`** | §28.2 |
| **权限键映射** | 4 口**零授权键新增**（用户面 `requireActor`）；配置面 `manage_settings`；**11 键零增删** | §28.4 |
| **注册点** | **`76 → 80`**（`get 32 → 34` / `post 41 → 43` / `put 0 / patch 1 / delete 2` 不变） | §28.5 |
| **真生效四段** | ①改键 → ②库内落值（姊妹册 §31.6）→ ③业务读口取数 → ④行为随之；每段判负 + 负对照 | §28.6 |
| **后台页 + 四语** | 后台页 0 或 1 页（`adminSettings` / 候选 `adminEconomyConfig`）；用户面 `battCard` / `checkinPanel`；四语 `zh/en/hk/vn` | §28.7 |
| **变体** | **Ⅰ 采纳 · Ⅱ/Ⅲ 不采纳**（`R-9-19`） | §28.8 |

- **逐字遵守**：`R-9-19`（变体 Ⅰ · 注册点 80 · 4 新口）照录自 `docs/seafood.master-plan.md:1433`；`R-9-15`（日界 UTC）与 `R-9-16`（`biz:` 前缀）在 §28.2 幂等键格转引（姊妹册 §31.4(e)/(d)）。
- **未发明**：路径（4 口 = 裁定逐字）、注册点数（`80` = 裁定逐字）、权限键（11 键现取）、错误码（**闭集 33 不动 · 零新增**）、文案值（不写 · 登记实现单）。
- **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件**：本节只写契约（承 §28 冻结口径）。

## §D3 只追加自证（逐条）

- `git diff --numstat`（HEAD → 工作树）**删除列 = 0**：route-layer = **`279\t0`**、data-layer = **`473\t0`** ✅。
- `git diff --no-index --numstat`（冻结快照 → 本单）**删除列 = 0**：route-layer = **`46\t0`** ✅。
- `difflib.SequenceMatcher`（v2.13 → v2.14）**0 replace / 0 delete / 7 insert** ✅。
- 快照 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.14.md` = **退出码 0**（逐字节相同）✅。
- 顶部状态块**新增 1 块**（非改写旧行）✅；**旧行（含 v2.13 状态块 / §17–§28 正文）一字未改** ✅。

## §D4 现取读数（本单亲读 · 只读）

- **注册点现取** = **76**（`get 32 / post 41 / put 0 / patch 1 / delete 2` · 锚定口径排除注释行）⇒ 本裁后 **80**（`get 34 / post 43`）。
- **权限键现取** = **恰 11 键**（`backend-ts/src/database.ts:15-27`）⇒ 本片**零增删**。
- **配置写口现取**：`index.ts:1171` / `:1172`（`POST /api/admin/settings` · 闸 `manage_settings`）⇒ P9② 复用、**注册点 +0**。
- **P9② 现有面现取** = `grep -rin "batt\|checkin\|签到\|电量" backend-ts/src/index.ts` ⇒ **命中 = 0** ⇒ batt / 签到 / 补签 = **零路由 / 零读口 / 零动作口**（本裁的 4 新口即补此面）。
- **本单未写库 / 未 apply / 未新建迁移文件 / 未改 `src/`·`migrations/` / 未启停服务 / 未提交（`git add/commit/push` 全无）/ 未碰 `.env*`**（纯规范单）。
