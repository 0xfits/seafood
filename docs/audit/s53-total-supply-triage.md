# S53 · `currency.total_supply` 与账本不一致 — 定性（设计语义 vs 计数器漂移）

- 单号：S53（Kong · **严格只读**：两库均 `BEGIN READ ONLY`，零写、零 commit、零 push）
- 台账：`B25`
- 仓库：`/Users/kevin/bistro/seafood`
- 结论一句话：**H2「计数器漂移」成立**——`cid=1` 的 `total_supply` 比账本净额多出 **200,076**，恰等于该币种历史 **全部 6 笔 `burn` 之和**；成因 = 历史 burn 走 `op='entries'` 旁路（**不触发** `ledger_post_event` §④ 的供应量双写），且这 6 笔全部早于首个含 `op='burn'` 的迁移 `0034`。B25 记的 **216,821** = 200,076（真漂移）+ 16,745（`Σfrozen_delta`，**测量基线口径假象**）。`cid=21` 的「差 1」是**冻结 1 单位**，非漂移。当前 `total_supply` **不在任何公开/用户/后台 API 面，也不上屏** ⇒ 目前不构成对外「假陈述」，属内部口径破。

---

## §0 对锚

| 项 | 读数 | 命令 |
|---|---|---|
| HEAD | `c9b60e1`（`S52c-pre` 那笔，含 B25） | `git log --oneline -3` |
| 工作树 | 干净（`git status --porcelain` 空） | 同上 |
| 分支 | `main` | `git branch --show-current` |
| `.env.local` sha256（开工） | `0960bd1d352fd12f1a424ea3e08a9d8c89084b3052c9d7fa9795164c42aba453` | `shasum -a 256 .env.local` |
| `.env.newdb.local` sha256（开工） | `b575627f24556a227af0deb780242c08586d0f7b5dede55b3a82acb9d314479b` | `shasum -a 256 .env.newdb.local` |
| 现库 host（去密） | `ep-holy-forest-b3fi7u3u.c-4.ap-southeast-1.aws.neon.tech/neondb` | 进程内 dotenv 解析后取 host |
| 新库 host（去密） | `ep-red-moon-b3xvoyjk.c-4.ap-southeast-1.aws.neon.tech/neondb` | 同上 |

- 连库方式：**进程内** python `psycopg2` 读 `.env.local`/`.env.newdb.local`（未 `source`/`export`，未打印任何密钥）；每会话 `set_session(readonly=True)` + `statement_timeout=60s`，结束一律 `rollback`，**无 commit**。
- 现库计数（开工实测）：`currency=15 · ledger_entry=504 · account=48 · batt_account=56 · batt_entry=60`；`schema_migration` 头 = `0044`（checksum `937af1…`）。
- 新库计数（开工实测）：`currency=1 · ledger_entry=0 · account=4`（仅结构＋`$` 种子）。

---

## §1 写入面逐处（谁写 `total_supply`）

### 1.1 DB 层：**唯一**写者 = `public.ledger_post_event(payload jsonb)` §④

`pg_proc` 全库扫描（`pg_get_functiondef(...) LIKE '%total_supply%'`，`prokind='f'`）⇒ **命中且仅命中** `public.ledger_post_event`。
`currency` 表 **无触发器、无规则**（`currency_triggers=[]`、`currency_rules=[]`）⇒ 除该函数外**无 DB 内旁路**。

现取部署体（`def_ledger_post_event.sql`）§④，逐行：

```
812:    -- ④ mint / burn 双写 currency.total_supply（R9 / R-9-37：必须同事务）
813:    IF v_op = 'mint' THEN
814:      UPDATE currency SET total_supply = total_supply + v_amount, time_updated = now()
815:       WHERE cid = v_cid;
816:    ELSIF v_op = 'burn' THEN
817:      UPDATE currency SET total_supply = total_supply - v_amount, time_updated = now()
818:       WHERE cid = v_cid;
819:    END IF;
```

**关键**：§④ 被 `IF v_op='mint' … ELSIF v_op='burn'` 收口 ⇒ **`op='entries'` 永远不碰 `total_supply`**。全文 `total_supply` 仅出现在 §④ 的两行 `UPDATE`（＋C8 回执里只读 `v_cur.total_supply`）。

### 1.2 业务路径 → op 映射（谁走 mint/burn，谁走 entries）

| 业务路径 | 代码位置 | op | 是否双写 `total_supply` |
|---|---|---|---|
| 后台调分（正向 `amount>0`） | `src/database.ts:2364`（注释）· 部署函数 `admin_points_adjust_post_event` 行 78–82 | `'mint'` | **是**（§④ `+v_amount`） |
| 后台调分（负向 `amount<0`） | `admin_points_adjust_post_event` 行 **83–88**：`op='entries'` + 单腿 `kind='burn'` | **`'entries'`** | **否** ← **漂移源** |
| 普通 mint 动作（`op='mint'`） | `src/ledger.ts:935` 类型；`ledger_post_event` mint 分支 | `'mint'` | 是 |
| 普通 burn 动作（`op='burn'`，**`0034` 起**） | `ledger_post_event` burn 分支 | `'burn'` | 是 |
| 其余（transfer/hold/settle/entries） | 各自分支 | 非 mint/burn | 否（设计如此） |

部署体 `admin_points_adjust_post_event`（`def_admin_points_adjust_post_event.sql`）逐行：
```
43:  IF v_amount > 0 THEN v_op := 'mint'; ELSE v_op := 'burn'; END IF;
...
78:  IF v_op = 'mint' THEN
79-82:  v_envelope := ... 'op','mint' ...
83:  ELSE
84-88:  v_envelope := ... 'op','entries' ... 'kind','burn' ...  ← 负向走 entries，绕过 §④
```
配套代码注释：`src/database.ts:2366-2368`（负向 ⇒ `op='entries'` + 单腿 `kind='burn'`；op 白名单无 burn）、`src/ledger.ts:95`。

### 1.3 源码级 `INSERT/UPDATE currency(...total_supply...)`

| 位置 | 用途 | 取值 |
|---|---|---|
| `migrations/0001_ledger_core.sql:167-169` | 种子 `$`（cid=1） | **0** |
| `migrations/0011_…:413`、`migrations/0012_…:1180` | 建自定义单位（普通用户） | 初始值（非 cid=1） |
| `migrations/0004:1044 · 0005:1205 · 0012:858 · 0020:836 · 0034:857/861 · 0044:874/878` | `ledger_post_event` 各历史版本 §④ 主体 | `± v_amount`（mint +，burn −；`0004/0005/0012/0020` **无 burn 分支**） |
| `src/database.ts` 4954/4965/4974/4987/5010/5018/5038 | `ensureBttcCurrency`/`getBttcState` | **只读**（BTTC 行） |
| `src/ledger.ts` 606-624 | `mapCurrency`/`CURRENCY_COLS` | **只读** |

### 1.4 有没有「=账本和」的断言或重算？

- **无** `total_supply == Σledger` 的 DB 约束/触发器/规则。`currency` 上唯一供应相关约束 = `currency_supply_guard`：`total_supply >= 0 AND (supply_cap IS NULL OR total_supply <= supply_cap)`——**只钳非负/上限，不校账本**。
- `0034` 自检（`0034:1093-1095`）只做**结构**检查（函数体源码里 `total_supply - v_amount` 在场），**不校活体数据值** ⇒ 抓不到本漂移。
- 无对账/重算 job（全仓 `total_supply` 命中仅为 src/migrations/dist/测试脚本/docs，无 cron/reconcile 落库逻辑）。

**§1 小结**：`total_supply` 唯一活跃写路径 = `ledger_post_event` §④，仅对 `op='mint'`/`op='burn'` 生效；`op='entries'`（负向调分在用的路径）**结构性绕过**双写，且**无任何断言兜底**。

---

## §2 读面：`total_supply` 是否上屏？

| 载体 | 位置 | 是否含 `total_supply` | 是否有路由调用 |
|---|---|---|---|
| `CurrencyRecord.total_supply`（`mapCurrency`） | `src/ledger.ts:613`，`CURRENCY_COLS` `:623` | **是** | `getCurrency`/`getCurrencyBySymbol`/`getSystemCurrency` **在 `src/index.ts` 无调用者**（grep 命中 0）⇒ 死口 |
| `getBttcState().totalSupply` | `src/database.ts:5038`（读 **BTTC 行**，`symbol='BTTC'`，非 cid=1） | 是 | `GET /api/batt` → `src/index.ts:1264` `data.bttc.totalSupply` |
| `ensureBttcCurrency().total_supply` | `src/database.ts:4987` | 是 | 仅创建 BTTC 行的平台路径（现库**无 BTTC 行**，实测 `symbol='BTTC' → []`） |
| `GET /api/admin/currency` → `listCurrenciesForAdmin` | `src/database.ts:2972-2981` | **否**（SELECT 不含 `total_supply`） | 后台面 |
| 前端（`frontend/src`、`dist`、`public`、`*.html`） | — | **0 处**（`totalSupply`/`total_supply` 全仓前端 grep 命中 0） | — |

**§2 明确定性**：`cid=1`（`$`）的 `total_supply`
- **不在任何公开/用户 API 面**（`getCurrency` 系无路由；`/api/batt` 的 `totalSupply` 指向 **BTTC 行**，而现库无 BTTC 行）；
- **不在后台 API 面**（`/api/admin/currency` 的 SELECT 不含该列）；
- **不在前端任何页面/文案**（全仓前端 0 引用；`bttcPanel` locale 存在但无供应量字段）。
⇒ **当前不对外可见 ⇒ 不构成「假陈述」**；是内部计数器口径破，风险点是**迁库/对账会把该不自洽带过去**（S52c 评估语境）。

---

## §3 逐 cid 差表（全币种 · 现库实测）

设计不变量 = `total_supply == Σmint − Σburn`（`0034` 头 / `R-9-37`）。`Σdelta`（B25 基线）**非**设计不变量（漏 `frozen_delta`）。

| cid | symbol | total_supply | Σdelta | Σfrozen_delta | Σmint−Σburn | Σbalance | Σfrozen | diff=TS−Σdelta（B25 口径） | **diff=TS−(Σmint−Σburn)（设计口径）** |
|---|---|---|---|---|---|---|---|---|---|
| **1** | `$` | **2,210,276** | 1,993,455 | 16,745 | **2,010,200** | 1,993,455 | 16,745 | **216,821** | **200,076** |
| 4 | P4B3A013122 | 10,000 | 10,000 | 0 | 10,000 | 10,000 | 0 | 0 | 0 |
| 9 | P4B3A013122X | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 10 | P4B3A013647 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 15 | P4B3A013647X | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 16 | P4B3B590800 | 10,000 | 10,000 | 0 | 10,000 | 10,000 | 0 | 0 | 0 |
| **21** | P4B3B590800X | 100 | 99 | **1** | **100** | 99 | 1 | **1** | **0** |
| 22 | QAB30929T185356Z | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 27 | QAB4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 28 | N1A0T203917 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 29 | N1B0T203917 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 31 | N1A0T204732 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 32 | N1B0T204732 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 35 | qap7a31l3k6 | 10,000 | 10,000 | 0 | 10,000 | 10,000 | 0 | 0 | 0 |
| 36 | qap7b1wtoqc | 30 | 30 | 0 | 30 | 30 | 0 | 0 | 0 |

**读数**：
- **仅 `cid=1` 破设计不变量**，幅度 **200,076 = Σburn**。
- `cid=21` 的「差 1」= 冻结 **1** 单位（`Σfrozen_delta=1`）；按设计口径 `diff=0` ⇒ **非漂移**，是 B25 用 `Σdelta` 基线导致的**漏冻结假象**。
- 其余 13 币种设计口径全 0（多为只有 mint、无 burn，或空币）。

`cid=1` 恒等式闭合（现库实测）：
```
total_supply 2,210,276  ==  Σmint 2,210,276        ← 反证：计数器只累加了 mint，未减 burn
Σmint − Σburn 2,010,200 ==  Σbalance 1,993,455 + Σfrozen 16,745   ← 真实净流通
漂移 2,210,276 − 2,010,200 = 200,076   ==  Σburn
216,821 (B25) = 200,076 (漂移) + 16,745 (Σfrozen)
```

---

## §4 两个互斥假设与判别方法 / 读数

### H1 · **设计语义**（`total_supply` 非「净流通」，而是「毛累计铸造」/含未入账铸造/从别处初始化）
### H2 · **计数器漂移**（历史 burn 走 `op='entries'` 旁路，未双写；计数器只增不减）

| # | 判别方法（可执行读数） | H1 预测 | H2 预测 | **现取读数** | 裁决 |
|---|---|---|---|---|---|
| D1 | `total_supply − (Σmint − Σburn)` 是否为 0 | 非 0 | 恒 = Σburn | cid=1：**200,076 == Σburn** | **H2** |
| D2 | 每一分量的算术来源 | H1a「含未入账铸造」⇒ TS > Σmint；H1b「另处初始化」⇒ 残差无解释 | 残差可被 burn 完全解释 | TS **恰 = Σmint**（2,210,276）；残差 = Σburn，**全解释** ⇒ H1a/H1b **均被证伪** | **H2** |
| D3 | 时间序：burn 是否早于首个 `op='burn'` 迁移 | — | 是（否则会双写） | 6 笔 burn 全在 **2026-09-30 / 10-02**；`0034`（唯一加 `op='burn'` 者）**2026-10-03 06:25** 才 apply ⇒ 全早于 0034 | **H2** |
| D4 | 迁移白名单：pre-0034 是否允许 `op='burn'` | — | 不允许 ⇒ burn 只能走 `entries` | `0004:518 / 0012:178 / 0020:156` = `NOT IN ('mint','transfer','hold','hold_release','settle','entries')`（**无 burn**）；`0034:147` 才加入 | **H2** |
| D5 | 部署函数路径：负向调分用什么 op | — | `entries` | `admin_points_adjust_post_event` 行 83-88 = `op='entries'`+`kind='burn'`；`ledger_post_event` §④ 仅 `mint/burn` 双写 | **H2** |
| D6 | 正控：0034 后是否执行过 `op='burn'` 以校正 | — | 无 ⇒ 计数器未回调 | `cid=1` 最后 burn txid=278（10-02）< 0034（10-03）；`currency.cid=1.time_updated = 2026-10-03 12:11:22 = 最后一笔 mint txid=1439` | **H2** |
| D7 | 横向：是否有币种呈「毛铸造」语义 | 有 | 无 | 6 个含 mint 的币种：有 burn 的仅 cid=1 且破；其余 mint-only 两口径同 ⇒ 无毛语义迹象 | **H2** |

**三方闭合（对 4 笔早于审计表的 burn 亦成立）**：
① 部署 §④ 只在 `mint/burn` 更新 → ② `entries` 旁路物理上不碰 → ③ 6 笔 burn 全早于唯一放行 `op='burn'` 的 `0034` ⇒ **数学上必定未减计数器**。
旁证：`admin_ops_audit_log`（`0023` 建表后）现存 5 行，其中 txid 276/278 记 `op='burn'` —— 但部署函数对负向明明是发 `op='entries'` 信封 ⇒ **业务 op='burn'，账本 op='entries'**，正是旁路。

---

## §5 定论与处置建议

### 5.1 定论（**可判定**）
> **H2「计数器漂移」成立。** `cid=1` 的 `total_supply (2,210,276)` 与设计不变量 `Σmint − Σburn (2,010,200)` 差 **200,076**，恰等于该币历史 **6 笔 `burn` 之和**；成因 = 历史 burn 由 `op='entries'`（单腿 `kind='burn'`）写入，绕过 `ledger_post_event` §④ 的供应量双写，且 6 笔全部早于放行 `op='burn'` 的 `0034`，`0034` 后无 burn 复核。
> **B25 的 216,821 = 200,076（真漂移）+ 16,745（`Σfrozen_delta`，基线口径假象）；`cid=21` 的「差 1」= 冻结 1，非漂移。**
> **`total_supply` 当前不在任何 API/上屏面 ⇒ 不构成对外假陈述**，属内部口径破（迁库/对账会外带）。

### 5.2 处置建议（建议取 **(a)**，并补路径修复）
1. **一次性订正（受控窗口）**：`UPDATE currency SET total_supply = Σmint − Σburn (= 2,010,200) WHERE cid=1;`（等价 `Σbalance+Σfrozen`）。执行前应冻结写入、留 txid 前后快照。
2. **根因修复（首选）**：把 `admin_points_adjust_post_event` 的**负向分支改用 `op='burn'`**（`0034` 起既有且已双写）⇒ 此后负向调分自动减计数器；同步给 `database.ts:2364-2368` 的**过期注释**校正（其「op 白名单无 burn」是 `0020` 时代旧值）。
3. **加守卫（防复发）**：选其一或并用——
   (a) 将 `total_supply` 改**派生**（视图/物化/生成列 `= Σmint − Σburn`，避免双写守恒靠人）；或
   (b) 在 §④ 双写处加**同事务断言** `ASSERT (new total_supply == Σmint − Σburn for cid)`；并
   (c) 在迁移 apply 审查加**活体对账**步骤：`diff_vs_mint_burn == 0` 才算过，从机制上堵住「结构性自检漏数据值」。
4. **迁库（S52c）**：搬 `currency` 前必须先订正或用 (a) 派生，否则把 200,076 的不自洽带进新库；且**`total_supply` 非上屏列**，迁库口径应以账本净额为准。

---

## §6 未做与 NOT_MEASURED

- **未做（严格只读）**：未执行任何 `INSERT/UPDATE/DELETE/DDL/setval`；未建实例；未碰 `5787/5788/5555/5191`；未 `npm install`；未 commit/push。
- **NOT_MEASURED / 未测**：
  - `NOT_MEASURED`：**0023 之前（2026-09-30）4 笔 burn（txid 253/254/255/256/259–262）的确切调用栈** —— 当时 `admin_ops_audit_log` 尚未存在（`0023` 于 2026-10-02 建表），无历史代码快照可回溯 ⇒ 对那 4 笔的 op 判定为**归纳**（由 pre-0034 白名单 + 部署 §④ + 无审计行三方推断为 `entries` 旁路）。
  - B25 声称的「`account` vs `ledger` **48/48**」我**未复现同值**（见 §7），该数字**不作为本报告依据**。
  - 新库 `currency=1/ledger_entry=0`：与 `S52c` 快照 `invariants.json`（`currency=1/ledger_entry=184`）**不一致**，**未追因**（越界，属 S52b/S52c 语域）；本单对新库仅取零写自证。

---

## §7 自曝（自查与口径分歧）

1. **`account` vs `ledger` 我实测 46/48（B25 报 48/48）**：未匹配的 2 行 = `uid=0,cid=1` 与 `uid=-3,cid=1`，二者均 `balance=0/frozen=0` 且**无任何 `ledger_entry` 行**（= 种子平台账户 uvms 从未交易）。差异属**口径**（是否把「无分录的 0/0 账户」计为匹配），**非新破口**；按「有分录才比」口径即 48/48。
2. **`batt_account` vs `batt_entry` 我实测 56 个账户全匹配 / 60 行 entry**；B25 的「56/56」我想是账户侧口径，值一致。
3. **我把 B25 的「Σdelta」基线判为「非设计不变量」**：它漏掉 `frozen_delta`，故对任何有冻结的币都会出现「假差」。证据 = `cid=21` 设计口径差 0 而 Σdelta 口径差 1。**若把 `total_supply` 当「净流通」，正确基线是 `Σ(delta+frozen_delta)`。**
4. **H2 对早于审计表的 4 笔 burn 为归纳**（见 §6），非直接读到调用栈；但结论由 `whitelist + 部署 §④ + 时间序` 三方闭合，不依赖该归纳。
5. 本次全部为**只读**读数（每会话 `readonly=True`＋`rollback`）；报告与证据目录为唯一产物，未改任何被跟踪源码。

---

## 附：产物与复现

- 报告：`docs/audit/s53-total-supply-triage.md`（本文件）
- 证据：`backend-ts/.s53-artifacts/<runid>/`（`evidence.json`、`def_ledger_post_event.sql`、`def_admin_points_adjust_post_event.sql`、探针脚本、原始读数）
- 复现：`python3 backend-ts/.s53-artifacts/dbprobe.py`（进程内 dotenv，只读）；核心 SQL 见 `probe1/2/3/4/both/pairs.py`。
