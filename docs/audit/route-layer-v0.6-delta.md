# route-layer.spec v0.5 → v0.6 · delta 审计件（逐条 delta → 依据锚点 → 改动点）

> **本单** = Unit **Jing-V0.6**（作者角色 = **Jing（Specifier · 制度员）**）；**性质 = 纯规范写作**（零代码改动 / 零库连接 / 零服务启停 / 零 git 写）。
> **本册读数（自报 · 交付时现取）**：`docs/route-layer.spec.md` = **983 行 / 236644 字节 / md5 `5424645a3def7d6fe405edbd25c6ab64`**；**改前 = v0.5 = 881 行 / 210464 字节 / md5 `7493f410b30de2ff042a3b137eeb0615`**（= 父单给我的值，**逐字节一致**）。**★ 口径**：本件初稿的后一次追加（§1.10 A4 补「现取时点」限定）使本体 md5 由 `0ebf658d…` 变为 `5424645a…`，**快照已同步重拷**（`cmp` = 0）⇒ **上列 = 交件终值**。
> **快照** = `docs/versions/route-layer.spec.v0.6.md`（**本单新建**）⇒ 与本体 **`cmp` = 相同**（自证）。
> **`docs/data-layer.spec.md` 本单未写**（现取 = 1023 行 / md5 `ad657c0a5068e91cb57d935bb34fd86b`；**未建任何 data-layer 快照**）—— 判定理由见 §D6。
> **★ 本单只追加、未重写**（并发纪律）：**§4.2 商品事件行 / §4.5 幂等键总表 / §1.8 清单四栏表体与编号 —— 一字未动**；另一单元 **Kong · 3c 商品资金**正并发改 `backend-ts/src/**` 并阅读这三节。

---

## §0 硬口径自证（§5.7 · 逐条）

| 项 | 自证 |
|---|---|
| §5.7 ①（带引号对象加引号） | 全文 `"users"` / `"is_admin"` 等**均加引号**；本单新写的「同标识 + 异内容 ⇒ `409`」等**状态码/码名均带引号** |
| §5.7 ②（退出码不取管道之后） | 命令用 `&&` / `;` 串联；`diff … > /tmp/v06.diff; echo "exit=$?"` 的 `$?` **取自 `diff` 本身**（不在管道之后） |
| §5.7 ③（本机无 `timeout`） | **未使用** `timeout`/`gtimeout` |
| §5.7 ④（读数异常先怀疑自己） | 「前端 0 命中」**先怀疑自己** ⇒ 复算发现 `frontend/` **全树 26 文件命中**，逐层下沉后证实**全在 `node_modules/**`**（第三方依赖；`frontend/src` + `package.json` = **0**）⇒ 差异**如实登记**（§D5-2） |
| §5.7 ⑤（先骸架后回填） | 依序落盘：head/§0 → §1.8 追加块 → §1.10 → §2.4 S10 → §4.5 追加块 → §7 → §8.8；**版本号最后一致化**（**未停在占位态**：可 `grep` 到 §4.5 追加块、§1.10 A1–A6、§7-28/29/30、§8.8.1–8.8.5 正文） |
| §5.7 ⑥（报数带口径） | 所有计数带命令/口径（§D0 diff 口径、§D2 扫描口径、§D5 各条口径） |
| §5.7 ⑦（「实测」必须可 grep 支撑） | 「实测」全部落在**本单现取**（`md5 -q` / `wc` / `grep -c` / `ls -la` / `git status --porcelain`）或**转引**（`p4-aud-jobkey.md` / `p4-b3c-job-funds.md`）并**逐处标注** |
| **安全红线** | **未** `pkill -f` / `killall`；**未启停任何进程**；**未 kill 任何 PID** |
| **只读 git** | 只用 `git status --porcelain` / `git log --oneline -3` —— **未** `git add/commit/push` |

---

## §D0 自报读数与「只追加」取证（可复算）

| 项 | 值 | 口径 |
|---|---|---|
| 本体 | `docs/route-layer.spec.md` = **983 行 / 236644 字节 / md5 `5424645a3def7d6fe405edbd25c6ab64`** | `wc -l` / `wc -c` / `md5 -q` |
| 前身 | **v0.5 = 881 行 / 210464 字节 / md5 `7493f410b30de2ff042a3b137eeb0615`** | 父单给定值 + 本单现取复核（一致） |
| 净增量 | **+102 行**（881 → 983） | `wc -l` 相减 |
| 快照 | `docs/versions/route-layer.spec.v0.6.md` = 与本体 **`cmp` 相同**（同 md5） | `cp` + `cmp` + `md5 -q` |
| **改动的既有行** | **仅 6 行被替换**：head **2 行**（状态行、v0.4 前身行）+ `§0` **2 行**（版本行、本单性质行）+ **§7-25 / §7-26 的「状态」单元格 2 行** | `diff <v0.5> <v0.6> \| grep -c '^<'` = **6**；逐行核对（见 §D6） |
| 新增行 | **108 行**（其中 11 行 = 上述 6 行的替换文本，其余 97 行 = 纯新增内容） | 同上 `grep -c '^>'` = 108 |
| **★ 冻结面零删除** | **§4.2 商品事件行 / §4.5 幂等键总表 / §1.8 清单表体 —— 无任何 `<` 行**（6 个被替换行全部位于 head / §0 / §7 区） | `grep -n '^<' /tmp/v06.diff`（diff 行号 2,3,15,19,77,78） |

> **口径声明**：本单的「只追加」= **不重写、不移动任何已有节**；允许且仅发生的有两类：① **状态列单元格改写**（§7-25 / §7-26，**Zang §5.86 裁定② 的指派要求**）；② **版本/身份行改写**（head 状态行、`§0` 版本行、`§0` 本单性质行 —— 若不改则**版本号与正文不一致**，本身即缺陷）。其余全部为**追加块 / 追加行 / 追加节**。

---

## §D1 ★ delta①：§4.5 追加块 —— **2a 面幂等键契约定案（采纳「选项 B」）**

**依据 = Zang §5.86 裁定①**（`docs/seafood.master-plan.md:1397`，v0.86 记录 `:2004`）逐字要点：**「采纳「选项 B」（零改码 + 把语义升为显式契约）……契约内容 = 「派生键 = 实体自然标识的单射（2a：`(application_id|job_id, worker_uid)`）⇒ 同标识同内容 = 200 replay / 同标识异内容 = 409 `REPLAY_FINGERPRINT_MISMATCH` / 异标识 = 新实体落新行」＋「无自然键可用的实体（如 3b 的 `job`）必须 fail-loud 不派生」⇒ 交 Jing v0.6 正式化（§4.5）+ 登记永久回归项（409 面）+ 批 4 前端同步项」**。

**改动点**：`### 4.5 幂等键总表` 之后（`ops:` 注段落下）**追加「v0.6 追加块」** = 契约 1（派生键 = 自然标识的单射）/ 契约 2（行为矩阵）/ 契约 3（与 3b 的关系 + 判据）/ 永久回归项 / 批 4 前端同步项 / 依据锚点汇总。**幂等键总表 14 行、`ops:` 注、规则段（前缀闭集 + 校验序）一字未改。**

**★ 本册现取的真源逐字（源码，防「同一端点两个说法」）**：

| 项 | 现取逐字 | 锚点 |
|---|---|---|
| 派生函数 | `export const resolveJobCreateKey = (` | `backend-ts/src/job-service.ts:90` |
| J4 提交（fallbackParts） | `resolveJobCreateKey(params.createKeyRaw, ['submit', params.identifier, params.workerUid]);` | `backend-ts/src/job-service.ts:133` |
| J2 报名（fallbackParts） | `resolveJobCreateKey(params.createKeyRaw, ['apply', params.jobId, params.workerUid]);` | `backend-ts/src/job-service.ts:180` |
| 409 分支（真源） | `fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { field: 'job_submission.create_key', reason: 'REPLAY_FINGERPRINT_MISMATCH', ref_id: resolvedKey.key }, 'Idempotency conflict')` | `backend-ts/src/job-service.ts:156` |
| 同族（商品 / 币种） | `listing-service.ts:210`、`currency-service.ts:284,410`（**同码同 reason**） | 本册现取 `grep` |

**行为矩阵（写进 §4.5 追加块，逐行有实测锚点）**：

| 情形 | 期望 | 实测锚点（`docs/audit/p4-aud-jobkey.md`） |
|---|---|---|
| 同标识 + 同内容 | `200` replay（`idempotent_replay:true`）+ **零新增分录** | **T3**（`:115`）/ **A3**（`:119`） |
| 同标识 + 异内容 | **`409`** `LEDGER_IDEMPOTENCY_CONFLICT` + `reason=REPLAY_FINGERPRINT_MISMATCH` + **零落行** | **T4**（`:116`；`ref_id` 与 T1 键**逐字相同** ⇒ 反证「键不含内容」） |
| 异标识（内容逐字相同亦然） | **新实体、落新行**（键不同） | **T1/T2**（`:113-114`）、**A1/A2**（`:117-118`）；`db_truth`（`:124-131`） |
| **无自然键的实体**（3b `job`） | **fail-loud 不派生** ⇒ `400` | §4.4-14；`src/job-funds-service.ts:84` |

**登记去向**：永久回归项 → **§7-28**（契约面）；批 4 前端同步（**条件触发**）→ **§2.4 S10**；审计件入册 → **§1.10**。

---

## §D2 ★ delta②：§1.8 追加块 —— **清单维护责任 = 三方分工（已定）**

**依据 = Zang §5.86 裁定②**（v0.86 记录 `:2004`）逐字要点：**「Kong 每片收尾扫「本片新增的已实现未注册路径」并报「认领 N/未认领 M」；Jing 每次 spec 刷新真扫描维护 §1.8；我批末做差集（全量服务端导出 − 已注册 − §1.8 = ∅）」**。

**改动点**：`### 1.8` 的「维护责任」段之后**追加「v0.6 追加块」** = **三方分工表**（Kong 报数 / Jing 真扫描维护 / Zang 差集收口，含触发时点与判据）+ **本单现取复算** + **边界声明（3c 在途）**。**§1.8 的准入判据 / 扫描口径 / 8 条 + 1 附注表体 / 负向排除 / 正向对照 / 并案段一字未改。**

**★ 本单真扫描复算（= 履行上表第 2 行「Jing 每次 spec 刷新真扫描一遍」）**：

| 口径（命令） | 现取结果 |
|---|---|
| 服务编排 5 文件具名导出：`grep -nE '^export (async )?function\|^export const [a-zA-Z]+ = (async )?\(' src/{job-service,listing-service,job-funds-service,currency-service,admin-service}.ts` | **27** 条 |
| 已注册路径表：`grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts` | **53**（`src/index.ts` 现 **1216 行**） |
| `grep -n "from './listing-service'" src/index.ts` | **0** |
| 8 条未注册 verb 逐 verb `grep -cE '\b<verb>\b' src/index.ts` | **全 0**（`publishJob`/`settleJob`/`refundJob`/`applyToJob`/`acceptApplication`/`createListing`/`updateListing`/`transitionListingStatus`） |
| 正向对照 | `verifyJobSubmission` = **2**、`submitWork` = **2**（已接线，证扫描无漏） |

⇒ **§1.8 清单条目 = 与 v0.5 完全一致（8 条 + 1 附注）：本单无新增、无消除**（3c 在途 ⇒ 其改动按其分工报数后由下次刷新登记，见 **§7-29**）。

---

## §D3 ★ delta③：新开 **§1.10 AUD-JOBKEY 审计件入册**（§1.9 与 `## §2` 之间）

**依据**：Zang §5.86 A（「交付：报告 248 行 + 探针 + 产物；`git status` 零 modified ⇒ 零改码声明为真」）。

**改动点**：**新增 §1.10**（**新节**；**§1.9 与 `## §2` 的既有内容未动**），表 A1–A6：

| # | 项 | 本册现取读数 |
|--:|---|---|
| A1 | 审计件 | `docs/audit/p4-aud-jobkey.md` = **248 行 / 21502 字节 / md5 `99f535e0ffa18e16c8d34d7e40be9c4e`**（含节结构行号索引：§4 三选项 `:198`，选项 B `:209`） |
| A2 | 产物 | `backend-ts/.p4-artifacts/audjk-20260929T182652Z/` = **4 文件**（`before-counts.json` 321 B / `after-counts.json` 323 B / `fixture-ledger.json` 760 B / `results.json` 12345 B） |
| A3 | 探针 | `backend-ts/scripts/p4z-audjk-01-probe.ts` = **17025 字节** |
| A4 | **零改码** | `git status --porcelain` **动笔前现取** = 仅 `?? backend-ts/scripts/p4z-b3d-00-probe.ts`（**3c 在途产物**）；**`modified` = 0** ⇒ 结论成立且可复算；HEAD = `f5a8bb3`（**交件时现取**见 §D5-3） |
| A5 | 三选项去向 | A `:202` / **B `:209`** / C `:216` ⇒ **Zang §5.86 裁定① 采纳 B** |
| A6 | 未测项 | 「不同 worker 同一 job」未造夹具（`:153`）；前端「不传键」= 静态 grep（`:167`）；前端命中口径（§D5-2） |

---

## §D4 delta④：§7 状态列 + 追加条目/补注（**不改依据格正文**）

| 项 | 改动 | 依据 |
|---|---|---|
| **7-25** | **状态列**：`3b 面已定 · 2a 面待 Zang` ⇒ **`已定（★ v0.6：Zang §5.86 裁定① = 采纳「选项 B」；契约正文 = §4.5 追加块）`** | **Zang §5.86 裁定①** |
| **7-26** | **状态列**：`机制已定 · 责任人待 Zang` ⇒ **`已定（★ v0.6：Zang §5.86 裁定② = 三方分工）`** | **Zang §5.86 裁定②** |
| **7-28（新增）** | **`409` 面永久回归项**：必须持续 `409`、不得退化为静默 replay；判据 = T4 形态；真源 `job-service.ts:156` | **Zang §5.86 裁定①**（逐字「登记永久回归项（409 面）」） |
| **7-29（新增）** | **§1.8 条目在 3c 落地后的变动**：**待**（3c 按分工报「认领 N / 未认领 M」⇒ Jing 下次刷新登记）；本单不代 3c 推导 | **Zang §5.86 裁定② 第 1 行** |
| **7-30（新增）** | **§7-25 依据格「待 v0.6 定案」的兑现**：已定；**未改写依据格正文**（并发纪律），差异显式登记 | **Zang §5.86 裁定①** |
| **§7 追加补注块** | 说明「7-25/7-26 仅状态列改动、依据格保留不删」的读法；**7-23 保持原状**（数值仍待 Kevin）；**7-1…7-24 与 7-27 一字未动** | 本单纪律 + **§5.86** |

---

## §D5 增量登记 / 差异登记（**不自行推导，发现与现盘不一致即以现盘为准**）

| # | 差异 | 现取证据 | 处置 |
|--:|---|---|---|
| 1 | **审计件读数**：v0.5 `§7-25` 记「**246 行 / 21165 字节**」；**现取 = 248 行 / 21502 字节** | `wc -l` / `wc -c` / `md5 -q` | 判定 = **v0.5 抄了审计中途落盘读数**（该审计自曝「四处就地更正」）；**Zang §5.86 A 亦记 248 行** ⇒ **以现取为准**并写入 **§1.10 A1 + §8.8.3-23**；**未改 §7-25 依据格正文**（并发纪律）⇒ **标 `待 Zang 复核`**（§D7-1） |
| 2 | **前端 grep 口径**：审计/task 写「`frontend/**` 0 命中」；本单 `grep -rIlE 'create_key\|createKey\|idempoten' frontend` 现取 = **26 文件命中** | 逐层下沉：26 文件**全部位于 `frontend/node_modules/**`**（`@remix-run/router`、`typescript`、`@babel/parser`、`react-dom`、`playwright-core`、`tough-cookie`、`undici-types`、`@vue/compiler-sfc`、`combined-stream`、`.vite/.vitest` 缓存）；**排除 `node_modules` / `dist` 后 = 0** | **两说法不冲突**：差别只在**是否含依赖树** ⇒ 本册统一写「**应用代码面 0 命中**（`frontend/src` + `frontend/package.json`）」并登记于 **§2.4 S10 / §8.8.2-24 / §8.8.3-25**；**标 `待 Zang 复核`**（§D7-2） |
| 3 | **`git status --porcelain` 现取非空**（Zang §5.86 记「零 modified」，与该时点现取一致） | **① 本单动笔前现取 = 1 行**：`?? backend-ts/scripts/p4z-b3d-00-probe.ts`（3c 在途）。**② 交件时现取 = 10 行**，逐类：**3c（Kong）7 项** = ` M backend-ts/src/database.ts` + `?? backend-ts/src/listing-funds-service.ts` + `?? backend-ts/scripts/p4z-b3d-{00-probe,01-snapshot,02-e2e}.ts` + `?? backend-ts/.p4-artifacts/b3d-20260930T023156/` + `?? docs/audit/p4-b3d-listing-funds.md`；**本单（Jing）3 项** = ` M docs/route-layer.spec.md` + `?? docs/versions/route-layer.spec.v0.6.md` + `?? docs/audit/route-layer-v0.6-delta.md` | **「零改码 = 零 modified」对审计面仍成立**（审计未产生任何 ` M`）；该 untracked 面**非本单、非该审计所造** ⇒ 写入 **§1.10 A4 / §7-29 / §8.8.3-24**（不改结论、只加边界与时点）。**★ 对 §1.8/§7-29 的直接含义**：3c **已新增服务层文件 `backend-ts/src/listing-funds-service.ts`** ⇒ **「本片新增导出 / 新注册路径」的报数条件已在途**，须待 3c 按分工报「认领 N / 未认领 M」后由 Jing 下次刷新登记（**本单不代 3c 推导**，标 `待 Zang 复核`） |
| 4 | 审计自曝**未生成 `probe.log`** | 产物目录现取 = 4 文件，**无 `probe.log`** ⇒ `results.json` 为唯一真值 | 写入 **§1.10 A2**（避免后来者按旧稿找该文件） |

---

## §D6 未动面自证（逐项现取）

| 面 | 证据 |
|---|---|
| **§4.2 商品事件行 / §4.5 幂等键总表 / §1.8 清单表体** | `diff v0.5 v0.6` 的 6 个 `<` 行**全部位于 head（2）/ §0（2）/ §7（2）**；**这三节零 `<` 行** ⇒ 对 Kong · 3c 的阅读面**零改动** |
| `docs/versions/route-layer.spec.v0.1–v0.5.md` | **五个既有快照一字未动**（本单只新建 **v0.6** 快照） |
| `docs/data-layer.spec.md` | **未写**（现取 **1023 行 / md5 `ad657c0a5068e91cb57d935bb34fd86b`**）；判定理由 = **两条 delta 全在路由 / 幂等契约面，无任何 `DL*` 需改**（追加式额度一次未用） |
| `docs/ledger.spec.md` | **未写**（`R1..R109` / 33 码一字未动） |
| `docs/seafood.master-plan.md` | **未写**（只读引用 `:1390-1398` / `:2004` 作依据锚点） |
| 其它 `docs/audit/*`（含 `p4-aud-jobkey.md`、`p4-b3c-job-funds.md`） | **未写**（只读取证） |
| `backend-ts/**`（含 `src` / `migrations` / `scripts` / `.p4-artifacts`） | **只读**（`grep` / `wc` / `ls` / `git status`）；**未写任何代码、未新增迁移、未连库** |
| `frontend/**` | **只读**（静态 `grep`）；**未写** |

---

## §D7 待 Zang 复核（本单**不自行裁定**）

1. **§7-25 依据格正文未同步更新**（仍写「改法（A/B/C）待 Zang ⇒ 由 v0.6 定案」、「246 行 / 21165 字节」）—— **原因 = 并发纪律**（Kong · 3c 正阅读 §4.2 / §4.5 / §1.8，本单**不得重写**这些节既有正文；§7-25 虽不在其阅读清单，但同属 Zang 指定的「先落盘骸架再逐段回填 + 只追加」范围，本单取**最保守口径**：只改状态列 + 追加补注块）。**若 Zang 要求就地改写该依据格** ⇒ 需在 3c 落地后单独下一单（**本单不自选**）。
2. **前端「0 命中」口径**：本册统一为「**应用代码面 0**（`frontend/src` + `package.json`）、**全树 26（全在 `node_modules/**`）**」；若 Zang 口径要求写「`frontend/**` 0」⇒ 请明示（本册认为含依赖树的全树读数更可复算，故并记两数）。
3. **`git status` 的 untracked 行归属**：本册判定 `?? backend-ts/scripts/p4z-b3d-00-probe.ts` 属 **3c（`p4-b3d`）在途产物**（依据 = 命名 tag + 当前 3c 在跑）；**若实为其它单元产物** ⇒ 请指正（结论「零 modified」不受影响）。
4. **§1.8 维护条款的两条本册建议**（**不构成裁定**，沿用 v0.5 的自曝口径）：① 「未认领 M 条」是否要求**逐条**给出未认领理由；② 批 4 每注册一条是否**强制**从清单划掉并在 §8 留痕。

---

## §D8 本单禁令自证

- **未** `git add/commit/push`；**未**写库；**未**启停任何进程；**未** `npm install`；**未**用 `execute_code`；**未**用 `pkill -f` / `killall`；**未**用 `timeout`（本机无）；**未**建任何 data-layer 快照；**未**改 `docs/seafood.master-plan.md`。
- **写入面 = 恰好 3 个文件**：`docs/route-layer.spec.md`（就地升 v0.6）、`docs/versions/route-layer.spec.v0.6.md`（快照）、`docs/audit/route-layer-v0.6-delta.md`（本件）。
