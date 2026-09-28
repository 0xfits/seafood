# P3 数据层规范 **v0.3** 小修执行记录（Jing · 制度员）

> **本单定位**：把 `docs/data-layer.spec.md` 由 **v0.2** 推到 **v0.3**，**只做派单指定的 8 项**（M1–M5 / `R109` 交叉引用 / 关闭 §12.2-11/-12 / O1 定性落位）。**不改 C1–C9 实体口径、不重排编号**。
> **裁定权威来源（现读，不凭记忆）**：`docs/qa/data-layer.spec-v02-review.md`（161 行，M1–M5 全文）＋ `docs/seafood.master-plan.md` **§5.32**（C1–C9）/ **§5.33** / **§5.38**（两条裁定）/ **§5.40**（M3 亲裁 + O1 定性）＋ `docs/ledger.spec.md` **v0.12** 的 **R109**（§7.3）与 **R79**（§10.3）。
> **交付物**：① 本册 v0.3（`docs/data-layer.spec.md`）；② 快照 `docs/versions/data-layer.spec.v0.2.md`；③ 本报告。
> **纪律**：**先落骨架后回填**（骨架 12 行 → 终稿见 §6 行数自证）；未实测字段写 `NOT_MEASURED`，**不填 0 / 空数组占位**；**未** commit / add / push；**未**连库（M3 读数由 Zang 提供）。

---

## §0 基线与版本/快照（**可独立复核**）

| 项 | 读数（本单现取） |
|---|---|
| 开工锚 `git log --oneline -1` | **`9641d5b`**（`master-plan v0.44: §5.40 v0.2 复核 verdict=需修(M1-M5) + 裁定 M3(夹具id 20-37/smallint[]) 与 O1(路径形为准) + 派 v0.3`） |
| 收尾期 HEAD | **`bcccaba`**（他方会话把 `docs/qa/data-layer.spec-v02-review.md` 入库；**与本单交付物无关**，本单未 commit） |
| 被改件（改前） | `docs/data-layer.spec.md` v0.2 —— **210787 B / 970 行 / md5 `cfeae444d0633591c17b7271ee549a24`**（与来件一致 ✅） |
| 被改件（改后） | v0.3 —— **220752 B / 983 行 / md5 `0a8e228dcbc1dcb517a378ca46dee79c`** |
| **v0.2 快照** | `docs/versions/data-layer.spec.v0.2.md`：`cp -n` 建，**210787 B / md5 `cfeae444d0633591c17b7271ee549a24`** |
| **快照自证（cmp）** | `git show 4ad0de4:docs/data-layer.spec.md \| cmp - docs/versions/data-layer.spec.v0.2.md` ⇒ **`exit=0`（逐字节相同）** ✅ ⇒ **v0.2 快照可独立复核**（v0.1 当年未入库无法验，本次不再犯） |
| §5.7 硬口径自检 | ① 本单**未对**保留字 `user` 做任何断言 ⇒ 不适用；涉及处一律加引号/限定 schema 转引。② 所有**判据**命令**不带管道**（`md5`/`wc`/`grep -c`/`cmp`/`git diff --numstat` 均直读，退出码未被管道改写）；管道仅用于展示。③ 本机 `timeout` / `gtimeout` **不存在**，本单**未使用任何限时命令**。④ 无「管道退出码判据 / 限时命令」形态的读数 ⇒ 无作废项。⑤ 本报告**先落 12 行骨架**再回填。 |
| 安全 / 范围 | **未启动、未清理任何进程**（无 kill）；**只写** 3 个文件：`docs/data-layer.spec.md` / `docs/versions/data-layer.spec.v0.2.md` / `docs/audit/p3-data-layer-v03.md`；**未**碰 `docs/ledger.spec.md`、`docs/qa/**`、`docs/seafood.master-plan.md`、`docs/versions/data-layer.spec.v0.1.md`、`backend-ts/**`、`frontend/**`；**未** commit / add / push |

**行号约定**：本报告行号一律为 **v0.3 现取**（`grep -n` 直读）。

---

## §1 逐项落位（8 项）

> 每项 = **落点行号 + 改前读数 + 改后读数 + 判定**。

### 1.1 **M1**（中低 · 影响建表）——列清单补 `ledger_event_keys` + `create_key` 归一

| 子项 | 落点（v0.3 行号） | 改前 | 改后 |
|---|---|---|---|
| `listing` 列清单补列 | §6.3 代码块 **L411–L413** | 无 `ledger_event_keys`（L411 行尾 `create_key UNIQUE, time_created, time_updated )`） | 新增 **L413** `ledger_event_keys text[] NOT NULL DEFAULT '{}'`，改 `create_key text NOT NULL UNIQUE` |
| `market_order` 列清单补列 | §6.4 代码块 **L430–L432** | 无 `ledger_event_keys` | 新增 **L432** `ledger_event_keys text[] NOT NULL DEFAULT '{}'`，改 `create_key text NOT NULL UNIQUE` |
| `create_key` 约束归一 | §6.2/§6.3/§6.4 清单 + `DL50`/`DL54`/`DL56`/`DL59`/`DL61`/`DL64`/`DL75`/`DL99`/§5-C8 | **三种写法并存**：清单 `create_key UNIQUE`（11 处）/ `DL64`·§5-C8 `create_key text UNIQUE`（3 处）/ `DL50`·`DL75` `text NOT NULL UNIQUE` | **全文 16 处一律 `create_key text NOT NULL UNIQUE`**（对齐 `ledger.spec` **R109④** 原文）；残留 1 处 `create_key UNIQUE` **仅在 `DL75` 的 v0.2 旧写法说明文字内**（引述「v0.2 曾并存三种写法」，非可执行口径） |
| `DL64` 自称「已在上方列清单内定案」 | **L441**（`DL64`） | 与列清单**互斥**（清单无该列） | **已一致**：清单现含该列 ⇒ 与 `DL75`「三件套必建」不再矛盾 |
| 归一说明落痕 | `DL75` 口径尾 **L469** | — | 新增「**✅ v0.3（M1）**：全文 `create_key` 约束统一为 `text NOT NULL UNIQUE`（对齐 `R109④`）；v0.2 曾并存三种写法…」 |

**判定**：✅ 两项子改均落地，`DL64`/`DL75` 与 §6 列清单**不再矛盾**，`create_key` **只剩一种可执行口径**。

### 1.2 **M2**（低）——`reason` 名统一为裁定逐字 `JOB_STATE_INVALID`

| 项 | 落点（v0.3 行号） | 改前 | 改后 |
|---|---|---|---|
| §11.2 逐路由表「业务 `reason`」列 | **L710 / L711 / L712 / L713 / L714**（`apply`/`accept`/`submit`/`review`/`cancel`） | 小写形态 **`job_state_transition_invalid`**（5 处） | **`JOB_STATE_INVALID`** |
| `DL119` 示例串 | **L698** | `**`reason` 串用固定小写下划线命名**（`job_state_transition_invalid` / `not_job_worker` / …）` | 改为「**一般**用小写下划线命名」（去掉该串）＋ 新增「**但状态机「非法转移」的 `reason` 以裁定逐字为准 = `JOB_STATE_INVALID`**（C5 / `DL51`）—— **▸ v0.2 旧写法**作小写形态 `job_state_transition_invalid`；**v0.3（M2）起一律用 `JOB_STATE_INVALID`**」 |
| §11.2 表后 v0.3 说明 | **L736** | — | 新增「本表原写作小写形态 → **v0.3 起统一为 `JOB_STATE_INVALID`**；实现方一律用大写形态，全文只有这一种可执行口径」 |

**读数（收尾）**：`grep -c 'job_state_transition_invalid'` = **2**（**仅** `DL119` 与 L736 两处**留痕性**提及，均明写「不得用小写形态」）；`grep -c 'JOB_STATE_INVALID'` = **10** 行。
**判定**：✅ 裁定逐字 `JOB_STATE_INVALID` 为**唯一可执行口径**；旧字样按「留痕/等价写法」保留（二选一中的前者）。

### 1.3 **M3**（低）——`DL152` 事实段修正 + 证据指针 + 类型事实

| 子项 | 落点（v0.3 行号） | 改前 | 改后 |
|---|---|---|---|
| 夹具 `policy_id` 范围 | `DL152` **L975** | **`policy_id` 2–19**（与同句「末行 = `policy_id=37`」**自相矛盾**） | **`policy_id` 20–37**；**新增**「**id 全集 = `1` + `20..37`，`min=1` / `max=37`、无重号**」 |
| 其余事实保留 | `DL152` **L975** | 19 行 / 种子 `policy_id=1` / 末行 `policy_id=37` / 末行三值 = 预期组合 `100`·`10`·`{3000,…,100}` | **全部保留未动** ✅ |
| 证据指针 | `DL152` **L975** 事实段开头 | 「v0.2 只读实测，§13.2 同批探针」（§13.2 P1–P7 **无** `commission_policy` 读数 ⇒ 指向失效） | 改为「**Zang 只读亲裁 + v0.2 §13.2 同批探针；证据件 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/m3-arbitrate-20260928045335.json`（run-tagged、`public.` 限定只读）**」 |
| **类型事实（新增）** | `DL152` **L975** 列名句 | 无 | 新增「**`weights_bp` 类型实测 = `smallint[]`**（**按 `int[]` 比较会报 `operator does not exist: smallint[] = integer[]`** ⇒ 回归判据须按 `smallint[]` 写）」 |
| v0.2 错误留痕 | `DL152` **L975** 尾 | — | 新增「**▸ v0.2 旧写法（错，v0.3 已修正 · M3）**：夹具 `policy_id` 写作 **2–19**…**改为 `20–37`**」 |
| 列名差异收口 | `DL152` **L975** / §12.2-12 **L814** / §17.2 状态格 | 「待 Zang 一句话确认」 | **「✅ v0.3 已裁：以 `fee_rate_bp` 为准」**（§5.38①） |

**判定**：✅ `2–19 → 20–37` 已改；19 行 / 种子 / 末行 / 三值**未动**；证据指针 + `smallint[]` 类型事实均补齐。

### 1.4 **M4**（低）——§11.3.1 增 `i18n_key` 具体值列（**先 grep 前端既有风格**）

| 步骤 | 读数 / 落点 |
|---|---|
| **先 grep 前端既有风格**（现读，不凭记忆） | `frontend/src/locales/{zh,en,hk,vn}.json` 与 `frontend/src/i18n.js` —— **实测**：`grep -rn 'unauthorized\|forbidden' frontend/src/locales/` = **0 命中**；四语 locale 为**扁平 camelCase 无点号**风格（`sessionExpired` / `pleaseLogin` / `error` / `success`）；**无任何 auth/error 类键**。仓内**唯一**既有错误键生成规律 = `backend-ts/src/ledger-errors.ts:219`：**`ledger.err.${code}`** |
| **结论** | 前端**无既有键可沿用** ⇒ 按派单要求**登记「需新增键」并给出建议值**（不发明风格：沿用既有 `*.err.<CODE>` 点号体例） |
| 落点（v0.3 行号） | §11.3.1 表头 **L754** 新增列 **`i18n_key`（具体值）**；`AUTH_UNAUTHORIZED` 行 **L756** → **`auth.err.AUTH_UNAUTHORIZED`**；`AUTH_FORBIDDEN` 行 **L757** → **`auth.err.AUTH_FORBIDDEN`**（均标「**需新增键**」）；命名依据注 **L759** |

**判定**：✅ 具体值已给（2 行）；因前端无对应键，**已登记「需新增键」**并说明落地须在四语 locale 各加条目（`i18n_key` 为契约值，呈现层键名由前端定）。

### 1.5 **M5**（从轻）——明写「留痕为节录式；原文出处 = v0.1 快照」

| 落点（v0.3 行号） | 内容 |
|---|---|
| **新增 `DL154`**（§15 规则表）**L943** | 「留痕体制 = **节录式，非原文照录**；原文出处 = **`docs/versions/data-layer.spec.v0.1.md`（已入库 `4ad0de4`）**」；列明不逐字保留的 **20 条**；并说明 v0.3 起同样留快照 ⇒ 每版原文随时可取（即「M5 从轻」的**理由**） |
| §14 索引行 **L916** | `DL154` 索引登记（§15 · 节录式 + 原文出处） |
| §14 主题反查 **L927** | 「留痕是原文照录还是节录」→ `DL154`（**节录式**） |

**判定**：✅ 已按「从轻裁定」**明写节录 + 指向已入库 v0.1 快照**；**未**要求 / **未**执行 20 条全文回贴。

### 1.6 **`R109` 交叉引用**（`DL141`–`DL144`；`DL141` 兼补 `R79`）

| 条 | 落点（v0.3 行号） | 改前 | 改后（新增交叉引用） |
|---|---|---|---|
| `DL141` | **L141** | 仅「（C1 硬约束 ①）」 | ＋「**交叉引用**：`ledger.spec` **R79**（加锁全序，逐字一致）+ **R109**①（同一事务）」 |
| `DL142` | **L142** | 「（C1 硬约束 ②）」 | ＋「**R109**②（函数内禁 DDL、只由迁移创建）」 |
| `DL143` | **L143** | 「（C1 硬约束 ③）」 | ＋「**R109**③④（幂等键 / `ref_id` 落引用列）」 |
| `DL144` | **L144** | 「（C1 硬约束 ④；`R51`/`R52` 为重放母规）」 | ＋「**R109**③（幂等重放语义与 `R51`/`R52` 一致）」 |
| 上位册指针 | 版本头 **L5** | `ledger.spec` **v0.11** | **v0.12（含新增 `R109` / 扩写 `R79`）** |

**读数**：改前 `grep -c 'R109'` = **0**（`R79` = 2）；改后 **`R109` = 8 行 / `R79` = 4 行**。
**判定**：✅ `R109` 交叉引用已补（0 → 8），`R79` 亦经 `DL141` 补引。

### 1.7 **关闭 §12.2-11 / §12.2-12**（记录 Zang 两条裁定）

| 待裁项 | 落点（v0.3 行号） | 改前 | 改后（裁定记录） |
|---|---|---|---|
| **§12.2-11 `neon_auth`** | **L813** | 「本册倾向：不用」，裁定者 = Zang（待终审） | **已裁（Zang · §5.38②）：不启用 Neon Auth** —— 登录 = EVM 钱包签名（`challenge`/`verify`）+ `users.uid`/`evm`；`neon_auth`（9 表）**存在但未使用**，新数据层**必须限定 `public.` 完全绕开**（`DL151`）；将来启用**须另立规范** |
| **§12.2-12 费率列名** | **L814** | 「按库内实列名 `fee_rate_bp`」，待 Zang 一句话确认 | **已裁（Zang · §5.38①）：以 `fee_rate_bp` 为准**；铁证 = 迁移 `0007`（`:11`/`:86`/`:92`/`:161` 逐处皆 `fee_rate_bp`、全文无 `fee_bp`）**+ `§5.20 #3`**；**`fee_bp` 系简写/笔误，不得进判据** |
| §17.1 尾「⚠️ 待裁」 | **L964 区（§17.1 `DL151` 尾）** | 「不属本册能定 ⇒ 进 §12.2-11 交 Zang」 | 改为「**✅ v0.3（已裁）**：已由 Zang 裁定（§5.38②）⇒ **闭 §12.2-11**」 |
| §17.2 状态格 | `DL152` 状态列 | 「列名差异为**待确认**」 | 「**已于 v0.3 裁定：以 `fee_rate_bp` 为准**」 |
| §14 主题反查 **L924** | 「12 条待裁」 | ＋「其中 **#11/#12 已于 v0.3 关闭**」 |

**判定**：✅ 两条裁定**均已记录并落位**；两项**不阻塞**事项已解除。

### 1.8 **O1 定性落位**（以路径形为唯一权威形态）

| 落点（v0.3 行号） | 改前 | 改后 |
|---|---|---|
| **新增 O1 定性注**（§10.1 表后）**L676** | — | 「**✅ v0.3（O1 定性落位 · Zang §5.40）**：行情读口**以路径形为唯一权威** —— `GET /api/market/:baseCid/orderbook`、`…/trades`（依据 = **实存路由即路径形** + **C2 路径参数 camelCase**，且 §4.1 #32/#33 原本就是路径形）。**§10.1 #32/#33 query 形登记为 v0.1 旧写法、废弃，不得复活**。非 `$` 计价对走**路径双段扩展** `GET /api/market/:baseCid/:quoteCid/orderbook`（**不得复活 query 形**）。**`DL145③`（query 键命名）保持不动**，仅对**真正带 query 的路由**适用」 |
| §10.1 **#32** | **L651** | `GET /api/market/orderbook?base_cid=&quote_cid=`（query 形） | **`GET /api/market/:baseCid/orderbook`**（路径形，唯一权威）＋「**▸ v0.2 旧写法（已废弃）**：query 形…**不得复活**」 |
| §10.1 **#33** | **L652** | `GET /api/market/trades?base_cid=&quote_cid=`（query 形） | **`GET /api/market/:baseCid/trades`**（路径形）＋ query 形废弃留痕 |
| §11.2 交易所读行 | **L725** | `GET /api/market/orderbook` / `/trades` / `/candles` | `GET /api/market/:baseCid/orderbook` / `/trades` / `/candles`（标「v0.3 O1：路径形；query 形已废弃」） |
| §4.1 #32/#33 | **L267 / L268** | — | **未改**（原本即为路径形 ⇒ 与 O1 一致）✅ |
| `DL145③` | （§3.4，**L222 区**） | query 键命名保持 v0.1 写法 | **保持不动** ✅ |

**判定**：✅ 路径形为唯一权威；query 形**仅存于废弃留痕**（`grep 'GET /api/market/orderbook?base_cid'` = **1** 处，即 §10.1 #32 的「已废弃」引文）；`DL145③` **未动**。

---

## §2 编号纪律（只增不重排）

| 项 | 读数（v0.3 现取） |
|---|---|
| `grep -c '^| \*\*DL[0-9]'` | **154**（v0.2 = 153；**+1** = 新增 `DL154`） |
| DL 号集合 | `min=1` / `max=154` / **连续无空洞**（`missing=[]`）/ **无重号**（`duplicates=[]`） |
| `DL1`–`DL153` | **一条未动、未删、未重排**（v0.3 仅**就地内容更新** + 就地留痕） |
| 新增 | **`DL154`（1 条，纯追加）** |
| §14 索引标题 | `## §14 规则总索引 DL1..DL154`（**L873**） |
| §14 总数句 / 核对命令 | **154 条**（L876）／「应等于 `154`」（L876） |
| §15 变更记录 | **3 行**（v0.1 / v0.2 / **v0.3**；`| **v0.d** |` 计数 = 3，v0.3 行在 **L937**） |

---

## §3 收尾自证读数（逐条落盘）

| # | 读数命令（**判据不带管道**） | 结果 |
|---|---|---|
| 1 | `grep -c '^| \*\*DL[0-9]' docs/data-layer.spec.md` | **154** |
| 2 | 编号连续性（python 直读 `^\| \*\*DL(\d+)\*\*`） | `missing=[]`、`duplicates=[]`、`1..154` 连续 |
| 3 | 三种角标占位符（「待回填」全角半角 + 「待填」+「待定」）在 **v0.3 全文**计数 | **0**（三种形态合计 0） |
| 4 | §14 索引标题 | `## §14 规则总索引 DL1..DL154`（L873） |
| 5 | §15 变更记录行数 | **3**（v0.1 / v0.2 / v0.3） |
| 6 | `git diff --numstat` | **`57  44  docs/data-layer.spec.md`**（**只涉本单该写文件**；另两件为 untracked 新增，见 §4） |
| 7 | `git show 4ad0de4:docs/data-layer.spec.md \| cmp - docs/versions/data-layer.spec.v0.2.md` | **`exit=0`**（逐字节相同） |
| 8 | v0.2 快照读数 | 210787 B / md5 `cfeae444d0633591c17b7271ee549a24` |
| 9 | v0.3 读数 | **220752 B / 983 行 / md5 `0a8e228dcbc1dcb517a378ca46dee79c`** |
| 10 | 库操作 | **0**（v0.3 零连库；M3 读数由 Zang 提供） |

---

## §4 文件改动面（只应涉本单该写文件）

| 文件 | git 状态 | 读数 |
|---|---|---|
| `docs/data-layer.spec.md` | `M`（已跟踪） | `git diff --numstat` = **57 加 / 44 删**（改 970 → 983 行） |
| `docs/versions/data-layer.spec.v0.2.md` | `??`（新增） | 210787 B / md5 `cfeae444…`（= v0.2 入库版，`cmp exit=0`） |
| `docs/audit/p3-data-layer-v03.md` | `??`（新增） | 本文件 |
| **他方在制（本单未碰）** | `?? docs/qa/45c27d8-lang-path.md` 等 | 未读未改 |

**未触碰确认**：`docs/ledger.spec.md`、`docs/qa/**`、`docs/seafood.master-plan.md`、`docs/versions/data-layer.spec.v0.1.md`、`backend-ts/**`、`frontend/**` —— `git status --porcelain` 中**无**这些文件的 `M`/`A`/`D` 记录。
**未 commit / 未 git add / 未 push** ✅。

---

## §5 未做项 / 诚实边界（**不得读作已做**）

1. **未连库、未跑任何 SQL**：`M3` 的三项事实（19 行 / id 全集 `1`+`20..37` / 末行三值 / `weights_bp smallint[]`）**全部转引 Zang 的 run-tagged 只读件**（`m3-arbitrate-20260928045335.json`），本单**未独立复核**。⇒ 该四项读数在本单为 **NOT_MEASURED（本单）**，其真值以 Zang 件为准。
2. **未做 20 条旧条文「原文照录」**：按 M5 **从轻裁定**，仅明写「节录式 + 指向 v0.1 快照」；「对 C1–C9 直接命中条文改原文照录」为**可选加强项**，本单**未执行**（不阻塞 P3 开工）。
3. **未审 `DL154` 之外新增内容的「全文一致性」**：本单范围限定为派单 8 项；154 条**全文重审不在范围**。
4. **未改 C1–C9 实体口径**（派单硬约束）：C1–C9 的实体判定（编排函数 / `listing` 命名 / 后台边界 / AUTH 域 / 借码 / 雇主审 / 幂等键 / 视图）**一律未动**；本单改动仅限 M1–M5 + `R109` 交叉引用 + §12.2 关闭 + O1 定性。
5. **`i18n_key` 前端落地未做**：M4 只给**契约值 + 建议值**并登记「需新增键」；**四语 locale 实际新增条目不在本单范围**（不属授权写入面 `frontend/**`）。
6. **本报告行号为 v0.3 现取**：若文件后续再改，行号失效（引用前请重跑 `grep -n`）。

---

## §6 行数自证

本报告**骨架首落 12 行**（`write_file` 首次写入）；回填后终稿见盘上 `wc -l`（**md5 不写入本句** —— md5 对自身无不动点）。被改件 `docs/data-layer.spec.md` 由 **210787 B / 970 行** → **220752 B / 983 行**（`md5` 见 §3 #9）。

> **产出摘要**：`docs/data-layer.spec.md` **v0.3**（220752 B / 983 行 / md5 `0a8e228dcbc1dcb517a378ca46dee79c`）｜ `docs/versions/data-layer.spec.v0.2.md`（210787 B / md5 `cfeae444d0633591c17b7271ee549a24`，`cmp` 对 `4ad0de4` **逐字节相同**）｜ 本报告 `docs/audit/p3-data-layer-v03.md`。
