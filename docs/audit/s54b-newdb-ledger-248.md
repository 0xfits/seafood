# S54b · 新库 `cid=1` 账本补到 **248 集**（补 T1 误剔的 72 行真分录，幂等插）＋三项复核＋零夹具双口径＋序列重对齐＋终态六项

- **单号**：S54b（角色：**Kong**）· 模式：**新库可写（唯一写目标）；现库全程只读；零仓改动**
- **日期**：2026-10-07（CST）
- **runid**：`s54b-20261007T112358Z`
- **产物目录**：`backend-ts/.s54b-artifacts/s54b-20261007T112358Z/`（`**/.*-artifacts/` 已忽略 ⇒ 零 tracked 改动）
- **现库（生产，本单只读）**：`.env.local` ⇒ host 前缀 `ep-holy-forest-b3fi7u3u` · `neondb` · PostgreSQL 18.6
- **新库（唯一写目标）**：`.env.newdb.local` ⇒ host 前缀 `ep-red-moon-b3xvoyjk` · `neondb` · PostgreSQL 18.6
- **结论先行（一句话）**：新库 `ledger_entry(cid=1)` **176 → 248**（幂等补插 **72 行 · inserted 72 / conflict 0**）；**12 个 uid 失配 → 0**；**`account` 21/21 与现库逐 uid 相等（含 `uid=6 = 930`）**；零夹具**行主 uid 口径 = 0**（文本命中口径 = 72，全为真行）；序列对齐；终态六项全绿。**★ 但 `Σmint−Σburn`（新库 `cid=1`）= `200` ≠ `2,010,200` ⇒ 按派单硬口径「停下报回」**：差额 `2,010,200 − 200 = 2,010,000` **全部来自被「零夹具」规则排除的 165 行 `uid ≥ 900000`（夹具行主）分录**（那 165 行承担 `Σmint − Σburn = 2,010,000`）；**我未改 `total_supply`**（新库仍 `2,010,200`）。

---

## §0 对锚（开工 / 收尾）

| 项 | 开工 | 收尾 | 命令 |
|---|---|---|---|
| 仓库 | `/Users/kevin/bistro/seafood` | 同 | `pwd` |
| HEAD | `057415f`（Zang 的 S54 派单提交）→ 开工瞬间被外部提交推到 **`6e0266f`**（S54 结果提交，**含 S54 那笔**） | **`6e0266f`**（未再变） | `git log --oneline -1` |
| HEAD 含 S54 锚点 | `6e0266f` 即 S54 结果提交（外部、非本单） | 同 | — |
| tracked 改动 | 0（`git status --porcelain` 空） | **0**（空） | `git status --porcelain` |
| `backend-ts/.env.local` sha256 | `0960bd1d…a453` | **同值（未变）** | `shasum -a 256` |
| `backend-ts/.env.newdb.local` sha256 | `b575627f…479b` | **同值（未变）** | `shasum -a 256` |
| 现库 host / db / 版本 | `ep-holy-forest-b3fi7u3u` / `neondb` / PG 18.6 | 同 | 进程内 dotenv + `version()` |
| 新库 host / db / 版本 | `ep-red-moon-b3xvoyjk` / `neondb` / PG 18.6 | 同 | 同上 |
| `host_different` | **true** | **true** | 两 DSN host 对比 |
| 只读自证（现库） | `SET TRANSACTION READ ONLY`；`transaction_read_only='on'` | 同 | `current_setting('transaction_read_only')` |

**连库方式（硬口径）**：一律**进程内** `python3` + `psycopg2`，DSN 由 `dotenv.dotenv_values()` 读**绝对路径**的 `.env.local` / `.env.newdb.local`（**未 shell `source`/`export`，未进 argv/`ps`，未打印任何凭据值**）；现库**全程** `SET TRANSACTION READ ONLY`（本单现库**零写**）。**未起实例、未打 HTTP、未碰 `5787/5788/5555/5191`；未 `pkill`/`killall`；未 `npm install`；未 commit/push。**

---

## §1 差集与 72 行补插（逐行登记）

### §1.1 差集口径与读数（`recon.json`）

| 项 | 读数 |
|---|--:|
| 现库 `ledger_entry` 总 / `cid=1` 总 | 504 / **413** |
| 现库 **闭合集** `cid=1 ∧ uid<900000` | **248**（`min_txid=10 · max_txid=2651`） |
| 现库 `cid=1 ∧ uid≥900000`（夹具行主） | 165 |
| 现库 `cid=1 ∧ txid≥900000` | 0 |
| 新库（写前）`ledger_entry` | **176**（全 `cid=1`） |
| 新库（写前）`uid≥900000` 行 | **0** |
| **差集（闭合集 − 新库，按 `txid`）= 待补** | **72** |
| 新库多出（`hand − closed`）= 越界行 | **0** |
| 72 行内 `txid≥900000` 行数 | **0**（全部为 T1 文本命中、非高 txid） |
| 72 行内 `idempotency_key` 与新库既有键冲突数 | **0**（可安全插） |

**72 行 txid 清单**：
```
10,12,16,19,21,25,29,31,37,39,41,43,45,47,49,51,73,85,87,88,89,90,91,95,97,100,101,
128,129,130,131,140,141,144,145,159,160,167,168,169,170,179,180,183,184,217,222,230,
232,234,236,238,240,242,244,246,248,253,259,263,271,272,335,337,339,347,349,351,2390,2410,2430,2452
```

**72 行画像**（`recon` / `topup.json → missing_*`）：

| 维度 | 分布 |
|---|---|
| 按行主 uid（13 个） | `−1:26 · 2:2 · 6:6 · 7:3 · 8:3 · 11:13 · 12:13 · 19:1 · 21:1 · 34:1 · 36:1 · 38:1 · 40:1` |
| 按 `kind` | `currency_create_fee 18 · hold 22 · transfer 16 · listing_deposit 8 · purchase 4 · sale 2 · mint 2` |
| 命中源（文本，仅供参考） | `idempotency_key` 命中（`p4b3`/`p3j`/`num1`/`p7b`/`qa7b`/`b4cii`/`b4ciib`/`b3d`/`qab4`/`n1a`/`n1b`）· `memo` 命中 |
| **行主 uid ≥ 900000 的行数** | **0**（⇒ 按 Zang 裁定「行主 uid<900000 = 真行」：**72 行全部为真行**） |

### §1.2 补插（新库单事务；`topup.json`）

- **SQL**：`INSERT INTO public.ledger_entry (<16 列>) OVERRIDING SYSTEM VALUE VALUES (…) ON CONFLICT (txid) DO NOTHING`（`txid` = `GENERATED ALWAYS AS IDENTITY` 主键 ⇒ 必须 `OVERRIDING SYSTEM VALUE`；`ON CONFLICT (txid)` 命中主键 ⇒ 幂等）。
- **事务**：**单事务**（`BEGIN`…`commit`；同事务内续做账户 UPDATE 与序列 setval，异常即整单 `ROLLBACK`）。

| 步 | 读数 |
|---|---|
| 待补（差集） | **72** |
| **成功 inserted（`rowcount=1`）** | **72** |
| **冲突 conflict_do_nothing（`rowcount=0`）** | **0** |
| 事务内回读新库 `ledger_entry` | **248**（`cid=1` = 248；写前 176） |
| 事务内回读 `max(txid)` | **2651**（写前 2651 — **未抬高**，见 §7.1） |
| 提交 | `committed = true` |

**逐行结果**：72 行**全部 `inserted`**（`topup.json → rows_log` 逐行 `{txid, uid, rowcount, result}`）；**0 行冲突**。

### §1.3 后置复核：新库 248 与现库闭合集**逐行同构**

- 逐行比对 13 列 `(txid,uid,cid,delta,frozen_delta,balance_after,frozen_after,kind,ref_type,ref_id,idempotency_key,reversal_of_txid,memo)`：**`newdb(248) == prod_real(248)` 逐行相等 = true**（其余列 `request_fingerprint/reversal_of_txid/memo/time_created/event_root_key` 亦随行搬）。
- 分类核对（`cid=1`）：现库 `uid<900000` = `{n:248, mint:200274, burn:−200074, Σmint−Σburn:200}` ≡ 新库 `{n:248, 同值}`。

---

## §2 补后三项复核（缺一不可）

### §2① `account` 逐 uid 不变量：`balance = Σdelta = 最新 balance_after`（`frozen` 同理）⇒ **失配 uid = 0**

**新库逐 uid 不变量**（`verify.json → inv_account_newdb`, 23 行）：`balance = Σdelta`、`balance = 最新 balance_after`、`frozen = Σfrozen_delta` **三项全部成立 ⇒ 失配 = 0**（写前失配 12）。对照：**现库同口径失配亦 = 0**（48 行）。

**12 个失配 uid 逐个「前后」读数**（前 = S54 落盘的 176 集口径；后 = 本单 248 集）：

| uid | 前 bal / Σdelta / last | 前 frozen / ΣfzΔ / last | 前失配 | **后 bal / Σdelta / last** | **后 frozen / ΣfzΔ / last** | **后失配** |
|--:|--|--|:--:|--|--|:--:|
| −1 | 168558 / **3356** / 168558 | 0 / 0 / 0 | Σ✗ | **168558 / 168558 / 168558** | **0 / 0 / 0** | **0 ✓** |
| 2 | 7400 / **−2600** / 7400 | 0 / 0 / 0 | Σ✗ | **7400 / 7400 / 7400** | **0 / 0 / 0** | **0 ✓** |
| 7 | 5100 / **−200** / 5100 | 0 / 0 / 0 | Σ✗ | **5100 / 5100 / 5100** | **0 / 0 / 0** | **0 ✓** |
| 8 | 4900 / **200** / 4900 | 0 / 0 / 0 | Σ✗ | **4900 / 4900 / 4900** | **0 / 0 / 0** | **0 ✓** |
| 11 | 29374 / **944** / 29374 | 6370 / **−5200** / 6370 | Σ✗·F✗ | **29374 / 29374 / 29374** | **6370 / 6370 / 6370** | **0 ✓** |
| 12 | 139417 / **101629** / 139417 | 0 / **−2203** / 0 | Σ✗·F✗ | **139417 / 139417 / 139417** | **0 / 0 / 0** | **0 ✓** |
| 19 | 100 / **−37** / 100 | 0 / 0 / 0 | Σ✗ | **100 / 100 / 100** | **0 / 0 / 0** | **0 ✓** |
| 21 | 100 / **−37** / 100 | 0 / 0 / 0 | Σ✗ | **100 / 100 / 100** | **0 / 0 / 0** | **0 ✓** |
| 34 | 100 / **−1300** / 100 | 200 / 200 / 200 | Σ✗ | **100 / 100 / 100** | **200 / 200 / 200** | **0 ✓** |
| 36 | 100 / **−1300** / 100 | 200 / 200 / 200 | Σ✗ | **100 / 100 / 100** | **200 / 200 / 200** | **0 ✓** |
| 38 | 50 / **−1350** / 50 | 250 / 250 / 250 | Σ✗ | **50 / 50 / 50** | **250 / 250 / 250** | **0 ✓** |
| 40 | 100 / **−1300** / 100 | 200 / 200 / 200 | Σ✗ | **100 / 100 / 100** | **200 / 200 / 200** | **0 ✓** |
| **6** | 990 / 990 / 990（自洽但 ≠ 生产 930） | 0 / 0 / 0 | Σ✗(vs 生产) | **930 / 930 / 930** | **0 / 0 / 0** | **0 ✓** |

**⇒ 12 个失配 uid 全部归零**（前 12 失配 + `uid=6` 使新库自洽却背离生产；后 **0 失配、且对齐生产**）。账户落法 = 逐 uid `UPDATE account SET balance, frozen` 到「248 集最新分录快照」，**21 次 UPDATE · 被 `trg_account_guard` 拒 0 次**（`topup.json → account_updates`，逐行 `rowcount=1`）。

### §2② `account` **21/21 与现库相等（含 `uid=6 = 930`）**

| 口径 | 读数 |
|---|--:|
| 有分录的 uid 数（新库 `ledger_entry` 去重 `uid`） | **21** |
| 其中新库 `(balance,frozen)` == 现库 | **21 / 21** ✓ |
| 全体 `cid=1` 交集（新库 23 ∩ 现库 36）逐 uid 相等 | **23 / 23** ✓ |
| **`uid=6`**：新库 `(930,0)` vs 现库 `(930,0)` | **相等 ✓** |
| 新库 `account(cid=1)` 行数 | 23（**未新增行**；12 个 uid 账户本已在库，仅 UPDATE） |

**21 个 uid 逐行对拍**（`topup.json → account_updates`，全 `match=True`）：`−2(0,0) −1(168558,0) 2(7400,0) 3(1385,1) 4(4,0) 5(6,0) 6(930,0) 7(5100,0) 8(4900,0) 11(29374,6370) 12(139417,0) 19(100,0) 21(100,0) 34(100,200) 35(990,0) 36(100,200) 37(990,0) 38(50,250) 39(990,0) 40(100,200) 41(990,0)`。

### §2③ ★ `Σmint − Σburn`（新库 `cid=1`）vs `2,010,200` ⇒ **≠ ⇒ 停下报回**（未改 `total_supply`）

| 量（`cid=1`） | 现库全量 413 | 现库 `uid<900000`（248） | 现库 `uid≥900000`（165，夹具行主） | **新库（248）** |
|---|--:|--:|--:|--:|
| `Σmint` | 2,210,276 | 200,274 | 2,010,002 | **200,274** |
| `Σburn` | −200,076 | −200,074 | −2 | **−200,074** |
| **`Σmint − Σburn`** | **2,010,200** | **200** | **2,010,000** | **200** |
| `Σdelta`（全量净流通） | 1,993,455 | 361,584 | 1,631,871 | **361,584** |

- **新库读数 = `200`**；**`2,010,200 − 200 = 2,010,000`**。
- **差额来源定性**：**全部来自「被零夹具规则排除的 165 行 `uid ≥ 900000`（夹具行主）」** —— 那 165 行自身 `Σmint − Σburn = 2,010,000`（`mint 2,010,002 − burn 2`），新库按「零夹具」不搬它们 ⇒ 新库账本净额比 `total_supply(2,010,200)` 少 `2,010,000`。
- **★ 与 S54 对比**：S54 时新库 `Σmint−Σburn = −74`；本单补 72 行后 = **`200`**（因 72 行含 **2 笔 `mint`**（`txid 253 uid19 Δ137`、`txid 259 uid21 Δ137`）⇒ `Σmint +274`；`Σburn` 不变）。
- **处置**：按派单硬口径「**若 ≠ 2,010,200 ⇒ 停下报回**」——**我未改 `total_supply`**；新库 `currency.cid=1.total_supply` **仍 = `2,010,200`**（未动、未强凑）。⇒ 「新库 `total_supply == 新库 Σmint−Σburn`」**结构性不成立**（子集/零夹具 vs 全量），请 Kevin/Zang 拍板口径（S54 §3.2 已登记同类张力，本单给更精确的差额归因）。

---

## §3 零夹具（按新口径：行主 uid 判）

### §3.1 双口径逐表读数（`verify.json → zero_fixture_newdb`）

| 表 | 行数 | **(a) 行主 uid 口径**<br>`uid≥900000` 行数 | **(b) 文本命中口径**<br>T1 命中行数（提示） |
|---|--:|--:|--:|
| `ledger_entry` | 248 | **0** | **72** |
| `account` | 23 | **0** | 0 |
| `batt_account` / `batt_entry` | 18 / 20 | **0 / 0** | 0 / 0 |
| `checkin_log` / `checkin_makeup_log` | 4 / 5 | **0 / 0** | 0 / 0 |
| `users` / `currency` / `app_config` | 26 / 1 / 1 | **0 / 0 / 0** | 0 / 0 / 0 |
| `referral` / `commission_policy` / `ledger_owner` | 2 / 4 / 4 | **0 / 0 / 0** | 0 / 0 / 0 |
| `admin_permission` / `admin_role` / `admin_role_permission` | 12 / 1 / 12 | **0 / 0 / 0** | 0 / 0 / 0 |
| `schema_migration` | 43 | **0** | 0 |
| **合计（16 张非空表）** | | **(a) = 0 ✓** | **(b) = 72** |

- **(a) 行主 uid 口径 = 0**（全表）⇒ **零夹具（新口径）成立** ✓。
- **(b) 文本命中口径 = 72**（仅在 `ledger_entry`）—— **全部行主 uid < 900000（真行）**，逐条见 §3.2。

### §3.2 `ledger_entry` 文本命中 72 行：逐条行主 uid + 判真理由

- **命中列**：`idempotency_key` 单列 33 行 · `memo`+`idempotency_key` 31 行 · `memo` 单列 8 行。
- **行主 uid 分布**：`−1:26 · 2:2 · 6:6 · 7:3 · 8:3 · 11:13 · 12:13 · 19:1 · 21:1 · 34:1 · 36:1 · 38:1 · 40:1`。
- **判真理由（逐类）**：
  1. **`uid=6` 6 行**（`txid 335/337/339/347/349/351`，`kind=transfer`）：**真实用户 uid6 → 夹具账户 900001/910001… 的真实转出**，`balance_after` 990→930 单调递减，`930` **恰等于现库 `account.uid=6.balance`** ⇒ 真行。
  2. **`uid=−1`（平台手续费归集）26 行**：`currency_create_fee`/`listing_deposit`，是**平台账户收手续费/押金**的真实分录（`uid=−1` 为 `ledger_owner` 登记的平台保留账户）⇒ 真行。
  3. **`uid 2/7/8/11/12/19/21/34/36/38/40` 40 行**：`transfer`/`hold`/`purchase`/`sale`/`mint`/`currency_create_fee`，均为**真实用户的真实业务流水**（真值锚点对得上：如 `uid=8` 收 `uid=7` 的 listing 售款、`uid=11/12` 的 market 买单冻结/解冻配对）⇒ 真行。
- **⇒ 按 Zang 裁定「真行按行主 uid 判（`uid<900000` = 真行）」：这 72 行**全部为真行**，文本命中**仅作提示读数、不单独决定归属**。这与 S54 §1.5 反事实预判一致：**采 248 集 ⇒ 新库 `ledger_entry` 会出现 72 行「含夹具文本但行主为真 uid」的行**——按新口径其零夹具判定**仍为 0**（口径 (a)），文本口径 (b) 记 72 作为提示。

### §3.3 幂等探针（新库单事务 `INSERT`+`ROLLBACK`，不改落盘态）

| 判据 | 读数 |
|---|--:|
| 对新库现有 248 行**全量重插**（`OVERRIDING SYSTEM VALUE … ON CONFLICT (txid) DO NOTHING`） | 尝试 **248** |
| 实际插入行数（`Σ rowcount`） | **0**（全冲突） |
| 事务内计数 / 回滚后计数 | **248 / 248**（落盘态未变） |

⇒ **`ON CONFLICT (txid) DO NOTHING` 幂等成立**（重跑零副作用）。

---

## §4 序列重对齐（新库）

**`ledger_entry_txid_seq` 重新 `setval` 到 `max(txid)+1`**：

| 项 | 读数 |
|---|--:|
| `max(txid)`（补后） | **2651** |
| `setval` 目标 | **2652**（= max+1） |
| `last_value` 前 / 后 | 2652 / **2652** ⇒ **= max+1 ✓** |

- **★ 注**：**补入的 72 行未抬高 `max(txid)`**（72 行 `txid ∈ [10, 2452]`，均 < 写前 max 2651）—— 派单括注「补入行会抬高 max」**不成立**（见 §7.1）；序列 `last_value` 前后同值 `2652`，对齐关系保持。
- 新库全部序列读数见 §5⑤。

---

## §5 新库终态六项复跑（同 S54 口径，`verify.json`）

### ① 逐表行数（现库 / 新库）

| 表 | 现库 | 新库 | | 表 | 现库 | 新库 |
|---|--:|--:|---|---|--:|--:|
| **ledger_entry** | 504 | **248** | | **account** | 48 | **23** |
| batt_account | 56 | **18** | | batt_entry | 60 | **20** |
| checkin_log | 6 | **4** | | checkin_makeup_log | 5 | **5** |
| users | 64 | 26 | | currency | 15 | 1 |
| app_config | 1 | 1 | | referral | 2 | 2 |
| commission_policy | 4 | 4 | | ledger_owner | 4 | 4 |
| admin_permission | 12 | 12 | | admin_role | 5 | 1 |
| admin_role_permission | 16 | 12 | | schema_migration | 43 | 43 |
| content_translation | 321 | 0 | | job | 45 | 0 |
| job_submission | 40 | 0 | | market_order | 25 | 0 |
| market_trade | 8 | 0 | | translation_cache | 213 | 0 |
| listing | 24 | 0 | | （其余 10 表全 0） | — | 0 |

（本单变动**仅 1 表**：`ledger_entry` **176 → 248（+72）**；其余与 S54 终态一致。全 34 表读数见 `verify.json → row_counts`。）

### ② 不变量

- **(a) `account ↔ ledger_entry`（新库逐行）**：`balance=Σdelta`、`balance=最新 balance_after`、`frozen=Σfrozen_delta` **全 23 行成立 ⇒ 失配 = 0** ✓（写前 12）。现库同口径失配 **0**。
- **(b) `batt_account ↔ batt_entry`（新库）**：18 个账户全 `batt = Σdelta = 最新 batt_after` ⇒ **失配 = 0** ✓。
- **(c) `total_supply == Σmint − Σburn`**：现库全 15 币种**仅 `cid=1` 口径见 §2③**（现库 `cid=1 = 2,010,200 = Σmint−Σburn` ✓）；**新库 `cid=1`：计数器 `2,010,200` vs 账本 `200` ⇒ 失配（结构性，§2③）**。

### ③ 零夹具（双口径）→ 见 §3（**(a) 行主 uid 口径 = 0 ✓**；(b) 文本命中 = 72，全真行）

### ④ 外键悬空（新库）

- 现取 `public→public` FK **54 条**，逐条 `NOT EXISTS` 计数 ⇒ **悬空 = 0** ✓（`verify.json → fk_dangling_newdb = []`）。

### ⑤ 序列对齐（新库）

| 表.列 | 序列 | 表 max | `last_value` | 对齐(=max+1) |
|---|---|--:|--:|:--:|
| `ledger_entry.txid` | `ledger_entry_txid_seq` | **2651** | **2652** | ✅ |
| `batt_entry.txid` | `batt_entry_txid_seq` | 660 | 661 | ✅ |
| `checkin_log.log_id` | `checkin_log_log_id_seq` | 259 | 260 | ✅ |
| `checkin_makeup_log.log_id` | `checkin_makeup_log_log_id_seq` | 105 | 106 | ✅ |
| `users.uid` | `users_uid_seq` | 41 | 42 | ✅ |
| `commission_policy.policy_id` | `commission_policy_policy_id_seq` | 5 | 6 | ✅ |
| `currency.cid` | `currency_cid_seq` | 1 | 3 | ✅（≥max+1；S52b 遗留） |
| `schema_migration.id` | `schema_migration_id_seq` | 43 | 43 | ⚠️ runner 自维护（未动） |

### ⑥ 结构指纹（新库 vs 现库，抽验）

| 面 | 现库 | 新库 | 相等 |
|---|--:|--:|:--:|
| `information_schema.columns` 行数 | 300 | 300 | ✅ `cols_equal=true` |
| 约束逐表 `(contype,count)` | — | — | ✅ `constraints_equal=true` |
| 触发器逐表计数（非 internal） | — | — | ✅ `triggers_equal=true` |
| `schema_migration` 逐行 `(version,name,checksum)` | 43 | 43 | ✅ `schema_migration_eq=true` |

---

## §6 未做 与 `NOT_MEASURED`

**未做（有意，附理由）**：

1. **未改新库 `total_supply`** —— §2③ 硬口径「≠ 2,010,200 ⇒ 停下报回」，我**未强凑**；新库仍 `2,010,200`。
2. **未对现库发任何写**（全程 `SET TRANSACTION READ ONLY`）；**未改 `.env.local` / `.env.newdb.local`**（sha256 前后同值）。
3. **未改 `migrations/**` / `src/**` / 前端 / `docs/*.spec.md` / `docs/OPEN-ITEMS.md`**；**未 commit / 未 push**；**未 `npm install`**。
4. **未对 `0043`/`0001` 守卫做任何放宽**（未 `DISABLE TRIGGER`、未 `session_replication_role`），未绕 `account_guard`，未直写 `balance/frozen`；未对 `ledger_entry` 做 UPDATE/DELETE（append-only 未触碰，仅 INSERT）。
5. **未追 S53 根因修复（`admin_points_adjust_post_event` 负向分支改 `op='burn'`）与守卫加装** —— 属 Kevin 另单。

**`NOT_MEASURED`**：

| 项 | 原因 |
|---|---|
| **新库「自洽」`total_supply` 应为多少** | 本单按 Kevin 值仍落 `2,010,200`；新库账本净额 = `200`（§2③）。「新库计数器 == 新库账本」应落何值（`200`？或真用户净流通 `361,584`？）**未裁定**，交 Kevin/Zang。 |
| **新库运行时对「`total_supply` ≠ 新库账本净额」的行为**（对账/上屏/脚本是否报警） | 需**起实例 + 打 HTTP** ⇒ 与本单「不起实例」冲突 ⇒ **未测**。 |
| **S55 切库语义下**：新库应否保留 `uid=−1`（平台手续费归集，168558）与「真 uid 行含夹具文本」的 72 行 | 语义未裁定，交 Kevin。 |
| **72 行在「文本口径」下算不算夹具** | 按 Zang 新口径（行主 uid）**不算**（真行）；文本口径仅提示。是否需另设「真行含夹具文本」的白名单/豁免，**未裁定**。 |

---

## §7 自曝

1. **★ 派单括注「补入行会抬高 `max(txid)`」不成立（如实登记）**：72 行 `txid ∈ [10, 2452]`，**全部小于写前 `max(txid)=2651`** ⇒ 补插后 `max(txid)` **仍 2651**，`setval` 目标仍 **2652**（`last_value` 前后同值）。派单假设的是「误剔行落在高位」，实测不然；序列对齐关系**未受影响**。
2. **★ 我触发了硬口径并要求停下报回**：新库 `Σmint−Σburn = 200`（**非** `2,010,200`、亦非 S54 的 `−74`）。差额 `2,010,000` 归因**明确**：**被零夹具规则排除的 165 行 `uid≥900000` 夹具行主分录**（其自身净额 `2,010,000`）。**我未改 `total_supply`、未改账本口径**，只报回。⇒ 三项硬读数达成 **2/3**（①②绿；③定性完成、值不等 ⇒ 报回）。
3. **本单只写新库、且只 INSERT `ledger_entry` 72 行 + UPDATE `account` 21 行 + `setval` 1 条**；`account` **未新增行**（12 个 uid 账户本已存在，仅 UPDATE 到 248 快照，过守卫 0 拒）。`ledger_entry` append-only **未被触碰**（无 UPDATE/DELETE）。
4. **落盘态可核**：写前 `ledger_entry=176`，写后 `248`；`account=23`（前后同）；`total_supply=2,010,200`（未动）；站名等 S54 值未动（本单未碰）。**幂等探针**已证重跑零副作用（§3.3）。
5. **口径一致性**：本单闭包口径 = **`cid=1 ∧ uid<900000` = 248**（Zang 裁定「真行按行主 uid 判」）；与 S54 的 176（T1 文本过滤子集）差异**仅在「是否按 uid 闭合」**，与 S52c-pre 逐表过滤口径一致。
6. **端口/进程**：未起实例、未占端口、未 `pkill -f`/`killall`。
7. **运行环境**：DB 客户端 = **Python 3.9 + `psycopg2` 2.9.6 + `dotenv`**（仓内/系统既有，**未 `npm install`**）。
8. **探针笔误**：无（`s54b-topup.py` 首版含一处死代码 `nc.cursor.rowcount if False else nc.rowcount`，运行前已改为 `nc.rowcount`；无运行时影响，如实登记）。

---

## §8 产物清单（`backend-ts/.s54b-artifacts/s54b-20261007T112358Z/`）

| 文件 | 内容 |
|---|---|
| `s54blib.py` | 公共库（进程内 dotenv、connect、fetch 辅助；承 S54） |
| `s54b-recon.py` / `recon.json` | 只读侦察 + 差集（248 / 176 / 72 / 13 uid / 逐行 missing / supply 现状） |
| `s54b-topup.py` / `topup.json` | **主编写**：幂等补插 72 行（逐行结果）+ 21 账户 UPDATE（逐 uid）+ setval（单事务） |
| `s54b-verify.py` / `verify.json` | 终态六项 + 三项硬读数 + 零夹具双口径 + 幂等探针 + 12-uid 前后 |

**复现命令**（均在产物目录内）：

```
python3 s54b-recon.py     # 只读侦察 + 差集
python3 s54b-topup.py     # 新库补插 72 行（已跑，落盘态=248）
python3 s54b-verify.py    # 终态六项 + 三读数（只读）
```
