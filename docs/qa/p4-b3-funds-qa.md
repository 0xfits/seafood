# P4 · 批 3（资金线 3a–3d）独立质检报告 — Neng

**角色**：Neng（质检）。**只登记缺陷、不修**（修复由 Kong 另单）。
**run tag**：`qa-b3-20260929T185356Z`（见 `backend-ts/.p4-artifacts/QA_B3_RUN_TAG.txt`）。
**产物**（绝对路径）：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/qa-b3-20260929T185356Z/**`。
**探针**：`backend-ts/scripts/p4z-qa-b3-01-conserve.ts` / `-02-freeze.ts` / `-03-http.ts` / `-04-ld-census.ts`（本单新增，4 个）。

**声明**：本单**未修改任何** `backend-ts/src/**`、`migrations/**`、`frontend/**`、`backend-ts/.env.local`、任何 spec（`docs/**` 只读）、`docs/seafood.master-plan.md`、其它既有脚本/artifact。**未** `git add/commit/push`、**未**跑删除型 SQL、**未**改 kind/白名单、**未**启停任何服务、**未** `npm install`、**未**用 `execute_code`、**未**用 `pkill -f`/`killall`/`timeout`。写库仅限 `cli:qa-b3-*` 夹具键（**不删行**）。

---

## 0. 基线冻结（逐项取证）

| 项 | 现取读数 | 命令 |
|---|---|---|
| `git rev-parse HEAD` | `6553599dc8a0d1daebeb11fcf82cf616c7490c12`（**与派单值逐位相同**） | `git rev-parse HEAD` |
| `docs/route-layer.spec.md` md5 | `13823f0389c1386b03b83dd7af032838`（**与派单值逐位相同**） | `md5 -q` |
| `git diff HEAD --stat` | **空输出 / exit 0** ⇒ 自 HEAD 起**无任何 tracked 文件被改** | `git diff HEAD --stat` |
| 引用件 mtime | 全部 **< 报告 mtime**（见下） | `stat -f '%Sm %N'` |

### 0.1 引用件 sha256（现取）

```
f62a9ff3c4e2bb2aaf706027dfa832ff4bcc5dcd4022d09e0c1bbfe365249c68  src/market-service.ts
7b808634c615e7467bcfe71d51c38d2c9dce1fd1c1f4eababfde781190b3d53d  src/job-funds-service.ts
e1948bb667897608c337191c3b62abf65825987fa40b85257850062e2bef2157  src/listing-funds-service.ts
05389680bd683df0497c83209d263b0dd74ac43de88bd09f7aa749f2ec6b0cba  src/currency-service.ts
586e8900f62d918580654ffe6a89bc4786fe874c26f5354de94a8c37f6d2912d  src/admin-service.ts
fd1a9bc5cdbb67a754b289eda0968c59a4bfcd42d473930fe6eee5474238e301  src/database.ts
1a65d813f06403285d79066051138d241ff18064f5d6029b2e2bb68c74e90065  src/index.ts
c3430e56a03e45165325ff0425f451d7fcf10813e63853f0d82b79c685049c35  src/ledger.ts
```
注：`listing-funds-service.ts` 的 sha256 **与 spec §4.7.3 B1 转引值逐位相同**（`e1948bb6…2157`）⇒ 该片交付后未被再动。

### 0.2 mtime（引用件 < 报告）

```
2026-09-30T01:42:33  backend-ts/src/ledger.ts
2026-09-29T01:48:28  backend-ts/src/ledger-errors.ts
2026-09-27T19:32:13  backend-ts/src/commission.ts
2026-09-29T21:24:07  backend-ts/.env.local      （注：.env.local 未被 git 跟踪 ⇒ 只能以 mtime 取证）
2026-09-30T02:43:56  docs/route-layer.spec.md
2026-09-30T02:54:11  docs/qa/p4-b3-funds-qa.md（本报告，**晚于以上全部**）
```

### 0.3 无活写者

- `ps -eo pid,ppid,etime,command | grep -E 'ts-node|nodemon|npm run'` ⇒ 与仓库相关者只有 `pid 80264 node .../ts-node src/index.ts`（= 5788 的 `seafood-api`，**非 watcher**：不是 `ts-node-dev`/`nodemon`，不会回写源码；本单**未重启**它）。
- `lsof -nP | grep bistro/seafood | grep -E '[0-9]+[uw]'` ⇒ **0 行**（无进程持有仓库内文件的写句柄）。
- `git status --porcelain` ⇒ 除本单新增的 5 个 untracked 路径外**无其它改动**（无并发写者痕迹）。

**0 段结论：PASS**（HEAD/md5 与派单一致；引用件 mtime < 报告 mtime；无活写者）。

---

## 1. ★ 资金守恒（独立重算）

**状态：PASS**

探针 `p4z-qa-b3-01-conserve.ts`：逐行 dump `public.account` 后**在脚本内自行累加**（不采信任何自报数字），并与 SQL 聚合对拍。

### 1.1 逐行自算 vs SQL 聚合（两口径互证）

| 读数 | 自算（逐行 Σ） | SQL 聚合 | 一致 |
|---|---|---|---|
| 行数 | 23 | 23 | ✅ |
| `Σbalance` | **2,009,627** | 2,009,627 | ✅ |
| `Σfrozen` | **10,473** | 10,473 | ✅ |
| **`Σtotal`** | **2,020,100** | 2,020,100 | ✅ |

### 1.2 从 `ledger_entry` 独立推导期望（不采信自报）

`Σ(mint 票面) − Σ(burn 票面)`（burn 分录 delta 为负，直接相加）：

| 口径 | 读数 |
|---|---|
| 全币种推导值 | **2,020,100** |
| 其中 cid=1 推导值 | **2,000,000** |
| 其余币种推导值 | 20,100 |
| `matches_account_sum_total` | **true** |

⇒ **账户 Σtotal == 账本推导 Σ(mint)−Σ(burn)**，逐笔对账闭合（探针按 `cid,kind` 分组 SUM(delta)，全量覆盖，无抽样）。**与各片自报 `2,000,000 → 2,020,100`（含夹具铸币 20,100）逐位相同 —— 但本读数为独立重算所得。**

### 1.3 分录总数与逐 kind 计数

| 项 | 读数 |
|---|---|
| `ledger_entry` 总行数 | **189** |
| 逐 kind 计数之和 | **189**（`kind_sum_equals_total = true`） |
| （与自报 189 逐位相同，独立重算所得） | |

逐 kind（189 快照）：`commission 4 / currency_create_fee 20 / hold 46 / hold_release 6 / job_escrow 10 / job_escrow_refund 4 / job_fee 6 / job_payout 6 / listing_deposit 16 / mint 5 / purchase 2 / purchase_refund 2 / sale 2 / trade 32 / trade_fee 16 / transfer 12`（`reversal 0`、`burn 0`、`listing_fee 0`、`hold_forfeit 0`）。

### 1.4 ★ 每类 kind 的预期倍数（逐类整除检验）

| kind | 条数 | 预期倍数 | 事件数 | 判定 |
|---|---|---|---|---|
| `hold` | 46 | ×2 同账户 | 23 | ✅ 整除 |
| `hold_release` | 6 | ×2 同账户 | 3 | ✅ |
| `job_escrow` | 10 | ×2 同账户 | 5 | ✅ |
| `job_escrow_refund` | 4 | ×2 同账户 | 2 | ✅ |
| `trade` | 32 | **×4** | 8 | ✅ |
| `trade_fee` | 16 | ×2 | 8 | ✅ |
| `purchase` | 2 | ×2 | 1 | ✅ |
| `sale` | 2 | ×2 | 1 | ✅ |
| `purchase_refund` | 2 | ×2 | 1 | ✅ |
| `currency_create_fee` | 20 | ×2 | 10 | ✅ |
| `listing_deposit` | 16 | ×2 | 8 | ✅ |
| `job_payout` / `job_fee` | 6 / 6 | ×2 | 3 | ✅ |
| `commission` | 4 | ×2 | 2 | ✅ |
| `transfer` | 12 | ×2 | 6 | ✅ |
| `mint` | 5 | ×1 | 5 | ✅ |

**逐事件分录数直方图**：`{1 条: 5 事件, 2 条: 52, 4 条: 6, 6 条: 8, 8 条: 1}` ⇒ `5+104+24+48+8 = 189` ✅。
逐事件 kinds 抽样（`qa-b3-01-conserve-postqa.json.ledger.per_event`）：
- 4 条事件 = `biz:job:settle:5|8` ⇒ `{job_payout,job_payout,job_fee,job_fee}`；4 个 `c2-list` 事件 ⇒ `{currency_create_fee×2, listing_deposit×2}`（**保证金 = 消耗（balance 两侧），无 frozen 腿**，与 FIX-B 口径一致）
- 6 条事件 = 8 个成交事件 ⇒ `trade×4 + trade_fee×2`
- 8 条事件 = `biz:job:settle:11` ⇒ `{job_payout×2, job_fee×2, commission×4}`

### 1.5 负余额 / 漂移 / 事件级守恒

| 判据 | 读数 | 判定 |
|---|---|---|
| `account` 负值行（`balance<0 OR frozen<0`） | **0** | ✅ |
| 账户级漂移（`balance ≠ Σdelta` 或 `frozen ≠ Σfrozen_delta`） | **0 行** | ✅ |
| 逐事件 `Σ(delta+frozen_delta) ≠ 0`（**排除**含 mint/burn 的事件） | **0** 个根键 | ✅ |
| `23514`（CHECK 违反） | **未触发**；结构闸在库：`account_bal_guard = CHECK ((balance >= 0))`（+ 同族 `frozen`/`account_guard`，见 artifact） | ✅ |

**`23514` 口径自曝**：CHECK 违反属**运行时异常**，历史未触发**无法事后直接观测**。本单的取证方式 = ① 约束真实存在（`pg_constraint` 现取）；② 负值行 0；③ 探针运行期间**未出现任何 500/未映射 SQLSTATE**（`qa-b3-03-http.json` 全部 33 例中无 500）。判为 PASS，但注明属**结构性 + 无观测**双证据，非「事件流回放」。

### 1.6 本单自身写入后的守恒复验（追加读数）

本单 4 次夹具事件写完后重跑同一探针：

| 项 | 写入前 | 写入后 |
|---|---|---|
| `Σtotal` | 2,020,100 | **2,020,100**（不变） |
| `Σbalance / Σfrozen` | 2,009,627 / 10,473 | 2,009,617 / 10,483 |
| `ledger_entry` | 189 | **197**（= 189 + 8：`currency_create_fee +2`、`hold +4`、`hold_release +2`） |
| 负余额 / 漂移 / 事件非零 | 0 / 0 / 0 | **0 / 0 / 0** |

⇒ 追加写量逐 kind 与探针 `Δentries` 完全对账（+2/+2/+2/+2），且**守恒在写入后仍成立**。

---

## 2. ★ 单写路径（结构性）

**状态：PASS**

### 2.1 命令与原始输出（直写账本 = 0 命中）

```
$ grep -rn -E 'INSERT[[:space:]]+INTO[[:space:]]+(public\.)?(ledger_entry|account|ledger_owner|ledger_event_keys|currency)[^_a-z]|UPDATE[[:space:]]+(public\.)?(account|ledger_owner|ledger_entry|currency)[^_a-z]|DELETE[[:space:]]+FROM[[:space:]]+(public\.)?(ledger_entry|account)' src/
src/ledger.ts:686:    'INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, $2, 0, 0) ON CONFLICT (uid, cid) DO NOTHING',
src/ledger.ts:890:// **已删除，禁止双真源**：`postEntry`（逐条 INSERT + UPDATE account）、`withIdempotentEvent`
src/database.ts:1332:        INSERT INTO public.currency (symbol, name, owner_uid, decimals, status, deposit_cid)
src/database.ts:1429:        UPDATE public.currency AS c
```

逐条定性：

| 命中 | 定性 | 判定 |
|---|---|---|
| `src/ledger.ts:686` `INSERT INTO account ... VALUES ($1,$2,0,0) ON CONFLICT DO NOTHING` | **R75 开户**（只建 0/0 行，不是记账；不产生分录、不改余额） | 非违规 |
| `src/ledger.ts:890` | **注释**（描述已删除的旧实现） | 非语句 |
| `src/database.ts:1332` `INSERT INTO public.currency` | **业务行**（C1 建单位） | 非账本写 |
| `src/database.ts:1429` `UPDATE public.currency` | **业务行**（C2 上市状态迁移） | 非账本写 |

⇒ **`INSERT INTO public.ledger_entry` = 0 命中；`UPDATE public.account` = 0 命中；`UPDATE public.ledger_owner` = 0 命中**（原口径三查，逐项满足）。

### 2.2 资金一律经四个 `*_post_event` DB 函数（调用点取证）

| 服务 | 调用点（`文件:行号`） | 目标函数 |
|---|---|---|
| `job-funds-service.ts` | `:195`、`:274` | `DatabaseService.jobPostEvent` |
| `listing-funds-service.ts` | `:234`、`:306` | `DatabaseService.listingPostEvent` |
| `market-service.ts` | `:300`、`:358`、`:562` | `DatabaseService.marketPostEvent` |
| `currency-service.ts` | `:251`、`:366` | `createCurrencyWithFee` / `listCurrencyWithDeposit`（单语句 CTE 内调 `ledger_post_event`） |
| `commission.ts` | `:771`、`:793` 段 | `SELECT ledger_post_event($1::jsonb)` |
| `database.ts` | `:1662` / `:1773` / `:1804`（三个包装）+ `:1345`、`:1447`（两条 CTE 内 `SELECT ledger_post_event(jsonb_build_object(...))`） | 唯一编排层 |
| `ledger.ts` | `:1007` `const LEDGER_FN_SQL = 'SELECT ledger_post_event($1::jsonb) AS r'` | TS 侧唯一写入口 |

⇒ **结构性命门成立**：`src/**` 里没有任何绕过 DB 编排函数的账本写语句；`ledger_event_keys` 在 `src/**` 内 **0 处** SQL 引用（只在迁移的函数体内写）。

---

## 3. 冻结面

**状态：PASS**

### 3.1 `migrations/*.sql` ↔ `schema_migration` 注册表

- 磁盘文件数 **19**（`0001..0017, 0019, 0020`；**0018 不存在** —— 与 C1 注释「迁移冻结 ⇒ 不开 0018」一致）
- 注册表行数 **19**（列 = `id, version, name, checksum, applied_at`）
- **逐文件 sha256 与 `checksum` 逐字节相等：19/19**（`all_checksum_match = true`，见 `qa-b3-02-freeze.json.comparison`）

⇒ 与自报「`schema_migration` = 19」一致，且**内容级**（不是行数级）对拍通过。

### 3.2 自 HEAD 起未改（`git diff HEAD --stat` 空输出）

- `src/ledger.ts` / `src/ledger-errors.ts` / `src/commission.ts` / `frontend/**`：均在 tracked 面内，`git diff HEAD --stat` **空** ⇒ **未改**。
- `backend-ts/.env.local`：**未被 git 跟踪**（`git status --porcelain` 不列它）⇒ 无法用 git 取证；以 mtime `2026-09-29T21:24:07`（< 报告 mtime）+ 本单未写它 为证。**口径自曝：此项为「弱证据」**（mtime 可被伪造/前移），建议后续以 sha256 落盘进基线单。

### 3.3 旁证

`src/listing-funds-service.ts` sha256 = `e1948bb6…2157`，与 spec §4.7.3 转引值**逐位相同** ⇒ 3c 片交付后未再被改写。

---

## 4. 服务端取数（客户端传价/对手方/金额不可直达账本）

**状态：PASS（代码级；其中「金额」有一处**口径需登记**的例外，见 4.2）**

### 4.1 对手方 / 受款方：一律服务端取数（客户端值被丢弃并登记）

| 面 | 真源 | 取证（`文件:行号`） |
|---|---|---|
| C1 建单位 | `owner_uid` 必须 = actor（否则 403） | `currency-service.ts:221-230` |
| C2 上市 | actor 必须 = `currency.owner_uid`（DB 闸） | `currency-service.ts:366` + spec §4.2 C2 |
| J1 发布 | `employer_uid` = **token 的 actor**（客户端传异值 ⇒ 403） | `job-funds-service.ts:159-165,184` |
| J5/J6 结算/退款 | 收款对象 = `job.worker_uid`（业务行）；服务层 payload **无任何金额/收款人入参** | `job-funds-service.ts:227-259`（payload 只含 `job_id`/`request_fingerprint`） |
| P2 下单 | 买方 = **actor**（`buyer_uid` 服务端注入，客户端传值只留 `client_buyer_uid_ignored`）；**payload 不含 price / seller_uid** | `listing-funds-service.ts:217-228,247` |
| P4 退款 | 发起人 = **仅卖方**（`REFUND_ACTOR_IS_SELLER_ONLY`） | `listing-funds-service.ts:59-62,276-277` |
| M1 挂单 | `owner_uid` = actor（客户端传值被丢弃并登记）；`quote_cid` **服务端恒 1** | `market-service.ts:263-264,284-288,310-312` |
| M2 撤单 | 仅订单 `owner_uid` 可撤（否则 403） | `market-service.ts:340-348` |
| M3 成交 | **`price` = 买单限价、`buy_order_id`/`sell_order_id` = 服务端选出的最优对手方、`fee` = 服务端按费率算** —— 全部服务端取数；客户端传 `price`/`buy_order_id`/`sell_order_id`/`fee` **一律丢弃并登记 `client_inputs_ignored`** | `market-service.ts:474-481`（解析 taker 行）、`:498-522`（对手方选择）、`:524-527`（定价）、`:529-537`（费率取数 + 公式）、`:539-545`（丢弃登记） |

**HTTP 侧独立实测（腿 4 的运行时证据）**：`T14`（M1 带 `owner_uid=11` 而 actor=970001）⇒ `200`，`Δentries=+2`，回执含 `client_owner_uid_ignored:"11"`，且分录落在 actor（见 `qa-b3-03-http.json`）。

### 4.2 ⚠️ 需登记的例外（**不是**越权向量，但口径必须写清）

| 面 | 现象 | 取证 | 定性 |
|---|---|---|---|
| **J1 招工发布** | `cid` 与 `reward` **由客户端 body 原样透传**进 payload（字符串直传） | `job-funds-service.ts:174-189` | 服务层文件头自称「本面 payload **无任何金额入参**」（`:18-19`），但实际 payload **含 `reward`**。经济上无害（出资人 = actor 自己冻结自己的钱、收款人由 DB 从业务行定），**但「无任何金额入参」的自述与代码不符** ⇒ 建议 spec/报告措辞改为「金额 = 出资人自定的业务约定额（同 M1 限价单条款）」 |
| **M1 挂单** | `price`/`amount` = 用户自定限价单条款 | `market-service.ts:277-281` | 已在文件头明记（非缺陷），登记以保持口径一致 |

⇒ 结论：**客户端无法把「钱付给谁」或「手续费多少」改成自己的值**（受款方/费率/成交价全为服务端或 DB 取值）；客户端能定的只有**自己出多少**（J1 reward / M1 限价），属业务约定额。

---

## 5. 幂等契约（§4.5 三款）实测

**状态：PASS**（探针 `p4z-qa-b3-03-http.ts`，`qa-b3-03-http.json`；每条均带 **Δentries 前后对照**）

**夹具键口径（重要）**：派单给的「前缀 `qa-b3:`」**与 §4.5 的前缀强制冲突** —— 实测 `create_key='qa-b3:probe'` ⇒ **400 `LEDGER_IDEMPOTENCY_KEY_INVALID` / `reason=PREFIX_REQUIRED`**（`T11`）。故本单夹具键取 **`cli:qa-b3-*`**（合法前缀内嵌 `qa-b3` 命名空间）。**此项建议回写派单模板**。

| # | 用例 | 期望 | 实测 status / code | Δentries | 判定 |
|---|---|---|---|---|---|
| T07 | C1 首建（`cli:qa-b3-c1-<tag>`，symbol `QAB3…`） | 200、+2（`currency_create_fee ×2`） | **200** / — | **+2** | ✅ |
| T08 | **同键同内容** ⇒ 重放 | 200 replay、**零新增分录** | **200**，回执 `idempotent_replay:true` | **0** | ✅ |
| T09 | **同键异内容**（`name` 改） ⇒ 409 | 409 `LEDGER_IDEMPOTENCY_CONFLICT` | **409 / LEDGER_IDEMPOTENCY_CONFLICT** | **0** | ✅ |
| T10 | 异键同符号 | 409 `LEDGER_CURRENCY_SYMBOL_TAKEN` | **409 / LEDGER_CURRENCY_SYMBOL_TAKEN** | **0** | ✅ |
| T12 | M1 挂单首建（`cli:qa-b3-m1-<tag>`, base=10, buy, price=10, amount=5） | 200、+2（`hold ×2`） | **200** / — | **+2** | ✅ |
| T13 | **M1 同键同内容** ⇒ 重放 | 200 replay、零新增 | **200**，`idempotent_replay:true` | **0** | ✅ |
| T15 | M2 撤自己的单 | 200、+2（`hold_release ×2`） | **200** / — | **+2** | ✅ |
| T11 | 非法前缀键 `qa-b3:` | 400 `PREFIX_REQUIRED` | **400 / LEDGER_IDEMPOTENCY_KEY_INVALID** | 0 | ✅（附带发现） |

**三款逐款结论**：同键同内容 ⇒ 200 重放 **零新增分录**（T08/T13 双面，C1 + M1）；同键异内容 ⇒ **409**（T09）；异标识 ⇒ **新行**（T07→T10 证明同符号在不同键下走「符号占用」而非静默复用；T07/T12 各自新键均落新事件/新行，`Δ+2`）。

---

## 6. `LDxxx` 全键普查（LD001–LD033）

**状态：PASS（有 3 条不一致登记，均属**spec 侧**；代码侧自洽）**

探针 `p4z-qa-b3-04-ld-census.ts` 三源对拍：`src/ledger.ts` 的 `LEDGER_SQLSTATE_TO_CODE` → `src/ledger-errors.ts` 的 `LEDGER_ERROR_TABLE` → `docs/route-layer.spec.md` 每个 `LD0nn` 出现的**所属状态格**。产物 `qa-b3-04-ld-census-v2.json`。

### 6.1 键集完整性

| 判据 | 读数 |
|---|---|
| `ledger.ts` 真值表键数 | **33**（`LD001`–`LD033`，无缺号） |
| `ledger-errors.ts` 码表键数 | **33** |
| 差值 | **0**（`lds_in_map_not_in_error_table = []`） |
| spec 全文**从未提及**的键 | **9 个**：`LD004`(KEY_REQUIRED)、`LD012`(CURRENCY_MISMATCH)、`LD013`(SUPPLY_CAP_EXCEEDED)、`LD015`(HOLD_NOT_ALLOWED)、`LD025`(LOCK_TIMEOUT)、`LD026`(TX_TIMEOUT)、`LD027`(DEADLOCK_RETRY_EXHAUSTED)、`LD028`(NEGATIVE_BALANCE_GUARD)、`LD029`(APPEND_ONLY_VIOLATION) |
| §4.7.1「真值表」实际覆盖 | **仅 5 键**：`LD020`–`LD024`；**缺 28 键** |

⇒ 上一单（Jing v0.7）自曝的「只扫 `LD02x` 段」属实；**本单已扩为全键普查**，结论：**spec 的 `LDxxx` 真值表面既不完整（5/33），且未覆盖的 9 键在 §4.2/§4.3 事件表里也没有期望码格** ⇒ 这些码的**协议面没有被 spec 描述过**（属覆盖缺口，非错误）。

### 6.2 状态类不一致（14 处命中，按面分类）

| 类 | 处数 | 明细 | 判定 |
|---|---|---|---|
| ① **活表格里的 `400 LD022`** | **4 处**（§4.2 J1 `:545` / M1 `:555` / A1 `:564` + §4.4-6） | `LD022` 真值 = `LEDGER_REF_NOT_FOUND` = **404**，却写在 `400` 列表 | **❌ 真缺陷（已知）** |
| ② §4.7.1 / §7-31 的**引文行** | 10 处（`:5,680-687,875`） | 描述订正必然引用旧字符串 ⇒ 「引文污染」 | 非缺陷（spec §8.9.3-30 已自曝） |

### 6.3 ★ 直接回答派单问题：「spec 里 `400 LD022` 那 4 处是否已订正为 `LD021`？」

**未订正。** 现取 spec 仍为 `400 … LD022`（4 处），并在 §7-31 登记为「**待 Zang（一句话可落）**」，明写「本单不改（候补码系本册推定 ⇒ 不得自选）」。候选码 `LD021`（`LEDGER_RESERVED_UID` = **400**）**语义契口成立**（四处均为「平台/保留 uid 前置闸」）。⇒ 现状 = **已登记未裁定**，**不是已修**。

### 6.4 ★ 本单**新增**的 2 条不一致（上一单未覆盖）

| # | 位置 | 现象 | 与真值对照 | 建议（只登记） |
|---|---|---|---|---|
| **F1** | §4.2 **P2**（商品下单）`:552` | 期望码格里写 **`400 … LD018/LD020`** | `LD020` = `LEDGER_ACCOUNT_NOT_FOUND` = **404** ⇒ 与所在 `400` 列表**自相矛盾**（与 §7-31 **同类**，但**未被 §4.7.1 的 8 处枚举收录** —— 其扫描口径是 `LD022`/`LD023`，**漏了 `LD020`**） | 候补 `LD021`；须同步 §4.7.1 真值表 + §7-31 枚举补一行 |
| **F2** | §4.2 **C1** `:558`（+ **C2** `:559` 同形） | 写 **`LD018(`LEDGER_AMOUNT_NOT_POSITIVE`+`BELOW_SERVER_FLOOR`)`** | `LD018` = `LEDGER_DECIMALS_OVERFLOW`（`ledger.ts:1047`）；**`LEDGER_AMOUNT_NOT_POSITIVE` 的真键是 `LD017`**（`ledger.ts:1046`）。代码实际抛的是 `LEDGER_AMOUNT_NOT_POSITIVE`（`currency-service.ts` 的 `resolveServerAmount` 借码，见 `:148-150` 注释） ⇒ spec 的**键↔码名错配**（F2 亦为「类级」：`:559` 同形但未带码名，故机制只捕捉到 `:558` 一处，人工核对补上 `:559`） | 应写 `LD017`（或删除 `LD018`）；须 Zang 裁定 |

### 6.5 非缺陷项（防误读）

- `§4.2 J5/J6` 的 **`500 LD032`**：`LD032` 在码表里 `status: null`（脚本退出码语义），但 spec `:487` 自己写死了规则「HTTP 状态一律取 `err.httpStatus` = `status ?? 500`」+ `:585` 明写「`LD032` ⇒ 500 defect」⇒ **与自有规则自洽，不是缺陷**（探针的 `null_status_in_spec` 命中已人工排除）。
- `LD006`（REPLAY）在 spec 里配 `200`：与码表 `status: 200` 一致 ✅。

---

## 7. ★ `410` 面补测

**状态：PASS**（安全层**未拦截**本单请求；6/6 全部实测成功）

| # | 端点（无 token） | status | 响应体形状 |
|---|---|---|---|
| T01 | `POST /api/shard/redeem` | **410** | R107：`{error:{code:'LEDGER_REF_NOT_FOUND', message:'endpoint deprecated: /api/shard/redeem', i18n_key:'ledger.err.LEDGER_REF_NOT_FOUND', details:{ref_type:'endpoint', ref_id:'/api/shard/redeem', http_status:410, sunset:'批 3 末删除路径（§5.1 碎片写口①/宝箱写口；未决 §7-1：过期日待 Kevin 定）'}}}` |
| T02 | `POST /api/chest/1/open` | **410** | 同形（`ref_id` 为各自路径） |
| T03 | `POST /api/admin/settings/reset` | **410** | 同形，`sunset` = `批 4 删路径（未决 §7-1：过期日待 Kevin 定）` |
| T04 | `POST /api/admin/assets/init` | **410** | 同形 |
| T05 | `POST /api/admin/task/create` | **410** | 同形 |
| T06 | `POST /api/admin/prize/create` | **410** | 同形 |

**共同读数**：① status **一律 410**；② `code` **一律 `LEDGER_REF_NOT_FOUND`**（**不是**新码 `R107`；`R107` 是**响应结构规则**，不是错误码 —— 与 spec 口径一致）；③ `details.sunset` **存在且有值**（两条文案：碎片写口 = 批 3 末删除；其余 = 批 4 删路径；**过期日仍「待 Kevin 定」**）；④ **Δentries = 0**（6 例全部零分录，未伪造成 200 空态）；⑤ **不需要 token**（设计如此：弃用面不得伪装成 401）。

**发现（只登记）**：`sunset` 值**不含日期**，且 6 个面的过期日**仍未决**（§7-1）⇒ 与 spec §5.1「过期日」列同为待定；另 `details.sunset` 是**中文字符串**（非 ISO 日期），机读方无法据此定期 —— 建议 Jing 定格式（如 `sunset_at`）。

---

## 8. 负例面独立重测（7 例）

**状态：PASS（6 实测 + 1 NOT_MEASURED）**

| # | 负例 | 期望 | 实测 | Δentries | 判定 |
|---|---|---|---|---|---|
| N01 | **余额不足**（uid=2，余额 7,600，`fee=999,999,999,999`） | 409 `LEDGER_INSUFFICIENT_BALANCE`、零残留 | **409 / LEDGER_INSUFFICIENT_BALANCE** | **0** | ✅ |
| N01b | 同上，事后查**孤儿 `currency` 行** | 0 | **0 行** | — | ✅ |
| N02 | **非本人**（C2 上市，actor=11 非该币 owner） | 403 | **403 / AUTH_FORBIDDEN** | 0 | ✅ |
| N03 | **未知 id**（`POST /api/currency/999999/list`） | 404 `LEDGER_CURRENCY_NOT_FOUND` | **404 / LEDGER_CURRENCY_NOT_FOUND** | 0 | ✅ |
| N04 | 未知订单 id（`DELETE /api/order/999999999`） | 404 `LEDGER_REF_NOT_FOUND` | **404 / LEDGER_REF_NOT_FOUND** | 0 | ✅ |
| N05 | **非 owner 撤单**（他人 token 撤已撤单） | 403/409、零分录 | **403 / AUTH_FORBIDDEN** | 0 | ✅ |
| N06 | M1 缺 `create_key` | 400 `LEDGER_IDEMPOTENCY_KEY_REQUIRED` | **400 / LEDGER_IDEMPOTENCY_KEY_REQUIRED** | 0 | ✅ |
| N07 | **自成交**（M3 撮合） | — | **404**（`/api/market/trade` **本批未注册**） | 0 | **NOT_MEASURED** |

**N07 口径自曝**：3d 只交付服务层，M3 无注册路由（spec §4.2 M3 明记「撮合服务调用；批 3 新端点」）⇒ **自成交（`LEDGER_SELF_TRANSFER`）在本单无法经 HTTP 独立复测**（服务层 `market-service.ts:509-513` 的「退到含自身 ⇒ 让 DB 闸拒绝」为**代码推断，非实测**）。不采用「同一进程内直调服务层」的替代测法，以保持「HTTP 真机面」口径单一。

---

## 9. 腿汇总表

| # | 腿 | 状态 | 关键读数 |
|---|---|---|---|
| 0 | 基线冻结 | **PASS** | HEAD `6553599…0c12`；spec md5 `13823f…2838`；`git diff HEAD` 空；无活写者 |
| 1 | **资金守恒** | **PASS** | Σtotal 自算 **2,020,100** == 账本推导 `Σ(mint)−Σ(burn)` **2,020,100**；189 = 逐 kind 和；倍数逐类整除；负值 0 / 漂移 0 / 事件非零 0 |
| 2 | **单写路径** | **PASS** | `INSERT ledger_entry`/`UPDATE account`/`UPDATE ledger_owner` 在 `src/**` **0 命中**；资金全经 4 个 `*_post_event` |
| 3 | 冻结面 | **PASS** | migrations **19/19** sha256 == 注册表；引用件未改 |
| 4 | 服务端取数 | **PASS**（+1 条口径登记）`price`/对手方/`fee` 均服务端；J1 `reward` 属自定约定额（自述「无金额入参」与代码不符） |
| 5 | 幂等契约 | **PASS** | 同键同内容 200 replay **Δ0**；同键异内容 **409**；异键新行；夹具键必须带合法前缀 |
| 6 | LD 全键普查 | **PASS**（+3 条不一致登记） | 33/33 键；spec 缺 9 键；§4.7.1 仅 5/33；**`400 LD022` 4 处未订正**；新增 **F1**（P2 的 `400 LD020`）、**F2**（`LD018`↔`AMOUNT_NOT_POSITIVE` 错配） |
| 7 | 410 面 | **PASS** | 6/6 **410** + `LEDGER_REF_NOT_FOUND` + `details.sunset`；Δentries 0；无需 token |
| 8 | 负例重测 | **PASS**（6 实测 + 1 NOT_MEASURED） | 409/403/404/400 逐条命中；孤儿行 0；自成交面未注册 ⇒ NOT_MEASURED |

---

## 10. 登记缺陷（只登记，不修）

| # | 面 | 级别 | 内容 | 建议归属 |
|---|---|---|---|---|
| **D1** | spec §4.2 P2 `:552` | 中 | 期望码格写 `400 … LD018/LD020`，而 `LD020` 真值 = **404** ⇒ 与 §4.7.1 已知缺陷同类但**未被枚举**（Jing 的扫描只扫 `LD022/LD023`） | **Jing**（与 §7-31 合并，候补 `LD021`） |
| **D2** | spec §4.2 C1 `:558` / C2 `:559` | 中 | `LD018` 被标注为 `LEDGER_AMOUNT_NOT_POSITIVE`，真值 = `LEDGER_DECIMALS_OVERFLOW`；`LEDGER_AMOUNT_NOT_POSITIVE` 的真键 = `LD017` ⇒ **键↔码名错配** | **Jing**（`LD017`，或删除 `LD018`） |
| **D3** | `job-funds-service.ts:18-19` | 低 | 文件头自称 payload「无任何金额入参」，实际 payload 含客户端 `reward`（`:186`）⇒ **自述与代码不符**（经济上无害） | **Kong**（改注释/措辞） |
| **D4** | 派单模板 / 夹具口径 | 低 | 「夹具前缀 `qa-b3:`」与 §4.5 前缀强制冲突 ⇒ 实测 400 `PREFIX_REQUIRED`；正确形 = `cli:qa-b3-*` | **Zang**（回写派单模板） |
| **D5** | `410` 面 `details.sunset` | 低 | 值为中文自然语言、**无日期**，且 6 个面过期日仍「待 Kevin 定」⇒ 机读方无法定期 | **Jing**（定 `sunset_at` 格式 + §7-1 过期日） |
| **D6** | spec `LDxxx` 覆盖 | 低 | 9 键（`LD004/012/013/015/025/026/027/028/029`）在 spec 全文**从未出现**；§4.7.1 真值表 5/33 | **Jing**（补真值表全 33 键） |

**说明**：D1/D2/D5/D6 属 spec 侧（我只登记，未改一行 spec）；D3 属代码注释；D4 属流程。**无 P0/P1 级缺陷**：四条资金安全腿（守恒 / 单写路径 / 服务端取数 / 幂等）全部 PASS。

---

## 11. 未覆盖 / 受限（NOT_MEASURED 清单）

| # | 项 | 原因 |
|---|---|---|
| N-1 | **自成交闸（`LEDGER_SELF_TRANSFER`）运行时复测** | M3 撮合端点本批**未注册**（3d 只交服务层）⇒ 只能用 HTTP 面，无可用路由（**不以服务层直调替代**） |
| N-2 | **`23514` 的历史未触发** | CHECK 违反是运行时异常，无法事后回放观测；本单以「约束存在 + 负值行 0 + 运行期无 500」三证据替代 |
| N-3 | **3b/3c 的 HTTP 面**（`POST /api/job`、商品 buy/refund） | 三片服务层已落地但**路由未注册**（随批 4）⇒ 本单对 3b/3c 的取数与幂等只做**代码级**取证 + 用 3a/3d 的已注册面做等价实测 |
| N-4 | `C2` 上市成功路径的运行时复测 | 需在**自有币种**上做状态迁移 + 收费；本单未新建上市夹具（避免为质检引入额外经济状态）⇒ 仅负例面（N02/N03）实测 |
| N-5 | `schema_migration` 的 **19 vs spec 声称的 `schema_version = 0020`** | 注册表**无 `schema_version` 列**（列 = `id/version/name/checksum/applied_at`）⇒ 「0020」属**版本口径**（可解释为最新迁移文件号），本单未能把它作为可测字段取证 ⇒ **登记为口径待澄清**，不判 FAIL |
| N-6 | `.env.local` 未改 | **弱证据**（gitignored，仅 mtime） |

---

## 12. 探针自曝（§5.7④⑧⑨）

1. **`qa-b3-01-conserve`**：`23514` 判据为**结构 + 无观测**双证据（非事件回放，见 §1.5）。逐行自算与 SQL 聚合**两口径互证**，但两口径若同时错（列名写错）不会互相发现 —— 缓解：读数列 `balance/frozen` 系 `src/ledger.ts:657` 同名口径 + SQL 聚合结果与线上下发视图一致。
2. **`qa-b3-03-http`**：**写库探针**（4 个夹具事件）。为让「Δentries」可信，每条用例**前后各取一次全表 `COUNT`**；因是本机唯一流量源（另一会话无写），Δ 口径成立。**若期间有他人写库，Δ 会失真** —— 已用「Δ 与逐 kind 增量双向对账」（§1.6）交叉验证，二者一致。**未删任何行**（夹具 currency/order 行留在库中，symbol 前缀 `QAB3`/`cli:qa-b3-*` 可识别）。
3. **`qa-b3-02-freeze`**：首跑因 `users.username` 列不存在而失败（NeonDbError）⇒ **已修探针并重跑**（该次失败读数不采信；未采信任何失败轮的中间结果）。
4. **`qa-b3-04-ld-census`**：状态格归属用「**同段内最近的前置状态标记**」启发式解析 Markdown 表格；对**同一单元格跨多状态**的写法会有归属歧义 ⇒ 已人工复核全部 14 处命中（10 处确认为引文行，4 处为真活表格）。**码名配对检查（F2）只能捕捉「键后紧跟码名」形态**，故 `:559` 的同形缺码名处**由人工补登**（已在 §6.4 标注）。
5. **凡「实测」均可 `grep`**：全部读数落盘于 `qa-b3-01-conserve.json`（写入前快照，189 行）/ `qa-b3-01-conserve-postqa.json`（写入后复验，197 行）/ `qa-b3-02-freeze.json` / `qa-b3-03-http.json` / `qa-b3-04-ld-census-v2.json` / `qa-b3-06-ld-occurrences.txt`（均在 `backend-ts/.p4-artifacts/qa-b3-20260929T185356Z/`）。**代码推断**（如 M3 自成交闸行为、`23514` 约束语义）已逐处标注为推断，未写成实测。
