# ledger.spec v0.14 delta —— P9② 连带回写：`kind` 关闭集 20 → 21（追加 `checkin_makeup_fee`）+ `−1` 增方白名单追加

> **角色**：Jing（Specifier · 制度员）· **单号** = **JING-SPEC-P9-2L** · **同批姊妹册** = `docs/audit/data-layer-v0.21-delta.md` ／ `docs/audit/route-layer-v2.14-delta.md`。
> **口径**：**只追加 · 追加式就地加注 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件 · 不新建迁移文件 · 不 apply · 不 `git add/commit/push`**。
> **依据（逐字）**：`docs/seafood.master-plan.md` **§5.230 B** `R-9-14`（`:1428`）+ **§5.230 C**（`:1436`）+ `docs/data-layer.spec.md` **v0.21 §31.1**（`R-9-14` 就地定案块）。
> **上游对锚**：`git log --oneline -1` = **`7dc4495`**（P9② 裁定落册 · data v0.21 ／ route v2.14 · **HEAD 含之** ✅）。
> **本单性质**：把 `R-9-14` 对**账本册**的连带要求**就地落位**（**旧文一行未改**）—— 一律以「★★ ★ v0.14 就地加注（Zang 裁定 `R-9-14`）」块追加于对应小节末尾 + 顶部状态块**新增 1 行**。

## §D0 指纹（改前 ／ 改后 · 现取）

| 项 | 改前（v0.13） | 改后（v0.14） |
|---|---|---|
| 文件 | `docs/ledger.spec.md` | 同 |
| 行数（`wc -l` = 换行符数） | **2028** | **2044** |
| 字节 | 461344 | **467967** |
| md5 | `eee9f165704e100c98b3655d742d1ac2` | **`2d071b5ee70efff27351493f133f3c11`** |
| sha256 | `d7f2dd483f3459be2b665f710286b632f9ef83983263ee4c1ee61ab5043904e3` | **`1debc9d827f2a1ec1398f86df6fb36f2e61913a85ed6359fde590d93eb5333bf`** |
| 改后快照 | — | **`docs/versions/ledger.spec.v0.14.md`**（`cmp` = 0 · sha256 同上） |

**★ 只追加自证**：`git diff --numstat -- docs/ledger.spec.md`（HEAD → 工作树）= **`16\t0`**（**删除列 = 0**）；`difflib.SequenceMatcher` 独立复核（v0.13 → v0.14）= **0 replace ／ 0 delete ／ 4 insert**。

## §D1 改动点（逐条 · **4 处** · 逐处给插入位置行号）

| # | 落点 | 插入位置（改前 v0.13 · 1-based） | 新文件起行 | 内容（就地加注块） |
|--:|---|---|--:|---|
| 1 | **顶部状态块区** | 插在 **v0.13 状态行（旧第 3 行）之前** | **3** | **新增 v0.14 状态行 1 行**（⇒ 其后全部行号 +1）；**未改写旧行** |
| 2 | **§5.1 `kind` 表** | 插在 **`reversal` 行（旧 364）之后** | **366** | **追加 1 行** `| **新增** | checkin_makeup_fee | …`（**只增不改序**） |
| 3 | **§5.1 末** | 插在 **`### 5.2 规则`（旧 368）之前** | **370** | ★ `R-9-14` 就地加注块（关闭集 20 → 21 + 三列 + DB 落点 + 影响面） |
| 4 | **§13.3（`R101`）末** | 插在 **`---`（旧 849）之前** | **858** | ★ `R-9-14` 就地加注块（`−1` 增方白名单追加 `checkin_makeup_fee` + 现取位置） |

**非追加改动 = 0 处**（**§1–§19 全部旧行一字未动**；`R1–R109` 编号与条文未动；§14.1 仍 33 码）。**全部 4 处均为纯插入**（`difflib` 复核 0 replace ／ 0 delete）。

## §D2 与裁定的对应（`R-9-14` → 落点）

| 裁定 | 逐字定案 | 落点（本册） |
|---|---|---|
| **`R-9-14`** | C-3 = **方案 ② 扩容 +1**：新 kind **`checkin_makeup_fee`**（**20 → 21**）；迁移 **`0028_kind_close_set_21.sql`**（CHECK 重建、非 enum，沿 `0003`）+ `ledger.spec §5.1` 回写 + `−1` 白名单追加；**不真 burn**（`R-9-3`） | §5.1（表行 + 注块）+ §13.3 `R101`（注块） |

- **逐字遵守**：**照录**自 `docs/seafood.master-plan.md:1428`（未改写语义、未自选）；kind 名 `checkin_makeup_fee` ／ 迁移名 `0028_kind_close_set_21.sql` ／ 21 值（= `0003:61-66` ／ `0001:76-82` ／ `ledger.ts:153-160` 三处一致之既有 20 值 **+ 新 1 值**）均**取裁定与现盘**（**不发明**）。
- **未发明**：kind 名（裁定逐字）、迁移文件名（裁定逐字）、三列（承 data-layer v0.21 §31.1(d)）、DB 现取（`0019:63` ／ `ledger.ts:550` 本册亲读）；**错误码闭集 33 不动**。
- **本册不建迁移文件**：`0028` = **内容契约**（§5.1 注块）；**文件由 Kong 建、apply 由 Zang 执行**。

## §D3 既有缺口登记（只登记 · 不补）

> **★ 本册快照 ／ delta「双件」既有缺口（只登记、不补历史快照）**：**现取**（`git ls-files` + 目录亲读）—— `docs/versions/` 下有 `ledger.spec.v0.1.md … v0.12.md` 共 **12** 件（快照链最后一件 = **v0.12**）；**`docs/versions/ledger.spec.v0.13.md` 不存在**（v0.13 修订只新建了其**改前**快照 `v0.12`、**未为 v0.13 自身建快照**）；`docs/audit/` 下**从无** `ledger-*-delta.md`（本件 = **首个**）。⇒ **本次 `ledger.spec.v0.14.md`（快照）+ `ledger-v0.14-delta.md`（delta）为断档后首个**；**只登记、不补历史快照**（**不补 `v0.13`**、**不改 `v0.1–v0.12`**）。**★ 诚实标注**：派单件头「本册此前从未建过快照」系**上位件表述**；**现取事实 = 快照存在 `v0.1–v0.12`、缺口在 `v0.13`**（本册按现取事实登记，不沿用未核表述）。

## §D4 只追加自证（逐条）

- `git diff --numstat`（HEAD → 工作树）**删除列 = 0**：ledger = **`16\t0`** ✅。
- `difflib.SequenceMatcher`（v0.13 → v0.14）**0 replace ／ 0 delete ／ 4 insert** ✅。
- 快照 `cmp docs/ledger.spec.md docs/versions/ledger.spec.v0.14.md` = **退出码 0**（逐字节相同）✅。
- 顶部状态块**新增 1 行**（非改写旧行）✅；**旧行（含 v0.13 状态行 ／ §5.1 ／ §13.3 ／ 全部 `R*` 条文）一字未改** ✅。

## §D5 现取读数（本单亲读 · 只读）

- **`LEDGER_KINDS` 闭集** = **恰 20 个**（`backend-ts/src/ledger.ts:153-160`）；与 `0003_kind_close_set_20.sql:61-66` ／ `0001_ledger_core.sql:76-82` ／ `ledger.spec` §5.1 三处一致 ⇒ **本裁后须前推为 21（加 `checkin_makeup_fee`）**。
- **`−1` credit 白名单现取** = `0019_listing_deposit_platform_credit.sql:63` = `-1 credit IN ('trade_fee','listing_fee','currency_create_fee','job_fee','listing_deposit')`；TS 侧 = `backend-ts/src/ledger.ts:550` ⇒ **本裁后须追加 `checkin_makeup_fee`**。
- **本单未写库 ／ 未 apply ／ 未新建迁移文件 ／ 未改 `src/`·`migrations/` ／ 未启停服务 ／ 未提交（`git add/commit/push` 全无）／ 未碰 `.env*`**（纯规范单）。
