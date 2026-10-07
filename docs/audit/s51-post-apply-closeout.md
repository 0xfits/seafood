# S51 — apply 后收口：库面硬编前推 · 16 门全量复跑 · `s3-01` 行为级证据

- **单据**：S51（Kong）——`0044_restore_listing_deposit_leg.sql` **apply 之后**的收口
- **日期**：2026-10-07（CST）
- **仓库**：`/Users/kevin/bistro/seafood`（HEAD = `1aa5f7d`）
- **产物**：`backend-ts/.s51-artifacts/s51-20261007T045906Z/`（`gates/` · `probes/` · `neg/` · `summary.tsv` · `run_gates_s51.sh` · `instance-5792.stdout.txt`）
- **性质**：只读库（**未跑 migrate / 未改活库**）；只改 3 个门脚本的库面硬编；未 commit / 未 push

---

## §0 对锚（含 apply 事实转录）

| 项 | 命令 | 读数 |
|---|---|---|
| HEAD（**开工锚**） | `git log --oneline -3` | `1aa5f7d …`（含），其下 `c3e0724` / `65a6e81` |
| 工作区（首） | `git status --porcelain` | **空（干净）** |
| 端口（首） | `lsof -nP -iTCP -sTCP:LISTEN` | `5191`(Python 56716) / `5787`(node 56865) / `5788`(node 56867) / `5555`(node 61000) **四条他人在听（未碰）**；`5792–5799` **全空** |

> **★ 锚点变动（并发，如实登记）**：开工锚 = `1aa5f7d`。**我作业期间**，**另一会话（Zang）**在其上落了 **2 枚 docs-only 提交**：`ec3e1aa`（§5.382/v0.382 · `0044` 已 apply 记录 + 派 S51）与 `1f2fac7`（`docs/OPEN-ITEMS.md`：B23 `pending_apply` ⇒ **已 apply**；`+1/-1` 单行）。⇒ **收工时 HEAD = `1f2fac7`**（`1aa5f7d` 仍是其**祖先**，不违背「HEAD 应含 `1aa5f7d`」）。**两枚提交均为文档面、不触 `migrations/**`/`src/**`/`frontend/**`/三门脚本** ⇒ 与本单产物**无交叠**；我的 3 处门编辑**未提交**、叠在 `1f2fac7` 工作区之上。

**apply 事实转录（Zang 已亲做；本单不重做、不回退）**：

- `0044_restore_listing_deposit_leg.sql` **已 apply**（2026-10-07）
- 应用后 `pg_proc.prosrc md5 = a9615fe18baad67ea62b9fbf1a156bfa`（长度 **47950**），`listing_deposit` 在函数体**位置 = 0（删净）**
- `schema_migration` = **43 行** · `max(version)` = **0044**；生产 `/api/health` 报 `schema_version:"0044"`
- 应用前 = `3737e0f8…` / `listing_deposit` 位置 25952 ⇒ **回归已消除**

**本单实测（受控实例 `5792`，唯一实例，PID 77308/监听 77687）**：

```
$ PORT=5792 npx ts-node --transpile-only src/index.ts        # 后台
$ curl -s http://127.0.0.1:5792/health
{"ok":true,"db_version":"PostgreSQL 18.6 …","schema_version":"0044","time":"2026-10-07T04:59:18.278Z"}
```

⇒ 受控实例**独立复核**：库面确为 `0044`。

---

## §1 硬编现取与前推逐处

### §1.1 全仓现取（先取后改）

现取命令（改前）：

```
grep -rn "42 行\|42·0043\|=== 42\|'0043')" backend-ts/scripts
grep -rn "schema_version\|schema_migration" --include=*.ts backend-ts/scripts | grep -E "42|0043"
```

**结论**：全仓**库面**（`schema_migration` = N 行 · `max(version)`）硬编**仅在下列 3 个门**，共 **17 行**（`p8-s9` 9 + `p8-s10` 4 + `p8-s11` 4；含注释口径描述）。其余命中均为**非库面**引用，已逐条排除（§1.3）。

### §1.2 逐处前推（改前 → 改后，逐字）

#### A. `backend-ts/scripts/p8-s9-bttc-gate.ts`（9 行）

| 行 | 类别 | 改前（逐字） | 改后（逐字） |
|---|---|---|---|
| `:11` | 注释 | `…\`0035\`…\`0043\` **已 apply**（\`schema_version = 0043\` · \`schema_migration\` 42 行）` | `…\`0035\`…\`0044\` **已 apply**（\`schema_version = 0044\` · \`schema_migration\` 43 行）` |
| `:29` | 注释 | `…\`schema_migration\` 42·0043）` | `…\`schema_migration\` 43·0044）` |
| `:356` | 注释 | `…**已 apply**（\`schema_version = 0043\` · \`schema_migration\` 42 行）⇒ 原 10 条` | `…**已 apply**（\`schema_version = 0044\` · \`schema_migration\` 43 行）⇒ 原 10 条` |
| `:405` | 注释 | `…**已 apply**（\`schema_version = 0043\` · \`schema_migration\` 42 行）⇒ 原 \`pending_apply[]\` 10 条` | `…**已 apply**（\`schema_version = 0044\` · \`schema_migration\` 43 行）…` |
| `:516` | 注释（S27 历史，合并为一行） | `// ★ S27 库面前推（…）：` + 换行 + `//   库面 … 41 行/\`0042\` ⇒ **42 行/\`0043\`**（15 张 … 守卫）。` | `// ★ S27 库面前推（出处 = 本批 apply \`0043_truncate_guard.sql\`；S26 建、Zang apply）：库面 \`schema_migration\` 41 行/\`0042\` ⇒ 42 行/\`0043\`（15 张 append-only 表各补 1 枚 \`BEFORE TRUNCATE\` 守卫）。` |
| `:517` | 注释（**S51 新增**） | — | `// ★ S51 apply 后库面前推（出处 = 本批 apply \`0044_restore_listing_deposit_leg.sql\`；Zang 亲做）：库面 42 行/\`0043\` ⇒ **43 行/\`0044\`**（\`0044\` 重放 \`0020\`：hold 家族守卫去 \`listing_deposit\`）。` |
| `:518` | **判据（代码）** | `t('K5', 'dbStructureLive', Number(sm[0].n) === 42 && String(sm[0].mx) === '0043',` | `t('K5', 'dbStructureLive', Number(sm[0].n) === 43 && String(sm[0].mx) === '0044',` |
| `:519` | 断言文本 | `'★ 迁移结构指纹：\`schema_migration\` = **42 行** · \`max(version)\` = **0043**（\`0032\`→…→\`0043\` 已 apply · \`0043\` TRUNCATE 守卫 · 8⑥ 审计台权限键）'` | `'★ 迁移结构指纹：\`schema_migration\` = **43 行** · \`max(version)\` = **0044**（\`0032\`→…→\`0044\` 已 apply · \`0043\` TRUNCATE 守卫 · \`0044\` hold 守卫去 \`listing_deposit\` · 8⑥ 审计台权限键）'` |
| `:763` | report.note | `…（\`schema_version\` 0043 · \`schema_migration\` 42 行）…` | `…（\`schema_version\` 0044 · \`schema_migration\` 43 行）…` |

#### B. `backend-ts/scripts/p8-s10-invite-reward-gate.ts`（4 处）

| 行 | 类别 | 改前 → 改后 |
|---|---|---|
| `:12` | 注释 | `（kind 24 / \`schema_migration\` 42·0043）` → `（kind 24 / \`schema_migration\` 43·0044）` |
| `:329` | 注释 | S27 行合并 + **S51 新增**：`// ★ S27 库面前推（…）：41 行/\`0042\` ⇒ 42 行/\`0043\`。★ S51 apply 后前推（出处 = apply \`0044_restore_listing_deposit_leg.sql\`；Zang 亲做）：42 行/\`0043\` ⇒ **43 行/\`0044\`**。` |
| `:330` | **判据（代码）** | `kg('K2', Number(sm.n) === 42 && String(sm.mx) === '0043',` → `kg('K2', Number(sm.n) === 43 && String(sm.mx) === '0044',` |
| `:331` | 断言文本 | `…= **42 行** · \`max(version)\` = **0043**（\`0035\`→…→\`0043\` 已 apply · \`0043\` TRUNCATE 守卫 · 8⑥ 审计台权限键）` → `…= **43 行** · \`max(version)\` = **0044**（\`0035\`→…→\`0044\` 已 apply · \`0043\` TRUNCATE 守卫 · \`0044\` hold 守卫去 \`listing_deposit\` · 8⑥ 审计台权限键）` |

#### C. `backend-ts/scripts/p8-s11-audit-console-gate.ts`（4 处）

| 行 | 类别 | 改前 → 改后 |
|---|---|---|
| `:11` | 注释 | `（\`schema_migration\` 42·0043 / \`admin_permission\` 12 …` → `（\`schema_migration\` 43·0044 / \`admin_permission\` 12 …` |
| `:469` | 注释 | 同 B`:329` 合并式，**S51 新增**一行 |
| `:470` | **判据（代码）** | `kg('K1', Number(sm.n) === 42 && String(sm.mx) === '0043',` → `kg('K1', Number(sm.n) === 43 && String(sm.mx) === '0044',` |
| `:471` | 断言文本 | `…= **42 行** · \`max(version)\` = **0043**（\`0043\` 已 apply · TRUNCATE 守卫）` → `…= **43 行** · \`max(version)\` = **0044**（\`0043\` 已 apply · TRUNCATE 守卫 · \`0044\` hold 守卫去 \`listing_deposit\`）` |

### §1.3 相邻命中「不动」的逐条理由（防下轮误读）

| 命中 | 为何**不动** |
|---|---|
| `p8-s5-01-real-chains.ts` 通篇 `0043_truncate_guard.sql` / `0043 守卫 tgtype 34` | 引用的是**文件名**与「`0043` 仍 applied」的事实 —— 本批 apply `0044` 不改 `0043` 及其守卫 ⇒ **仍然成立** |
| `p8-s9:356` `出处 = 本批 apply \`0043\``（S27 历史行）、`:519` `\`0043\` TRUNCATE 守卫` | 同上：`0043` 事实未变 |
| `p4z-b6audit-02-idemkey.ts` 注释含 `0043` | 历史探针注释（P6-B6-AUDIT 时代冻结），**非库面判据**、非本门套 |
| `p1j-read.ts:42` / `p1o-00-escape-sweep.ts` / `p3y-01` 等 | 行号巧合 / 仅取表不硬编行数 ⇒ **非库面期望** |

### §1.4 未删任何断言

- `K5`（`p8-s9:518`）/ `K2`（`p8-s10:330`）/ `K1`（`p8-s11:470`）判据**均在**，仅右值前推。
- 三门各自的 `selfTest`（负对照）**均保留未动**：`p8-s9:520` 的 `selfTest('K5', …, (v)=>String(v)==='0038', '0034', …)` **逐字未变**（它是独立谓词自证，与 42/0043 无关）。
- 改动 **line-count-neutral**：`git diff --numstat` = `9/9` · `4/4` · `4/4`（增删相等）⇒ 文件行数不变（`p8-s9` 799 / `p8-s10` 494 / `p8-s11` 626）。

---

## §2 16 门全量复跑（受控实例 `5792`）

**runner**：`.s51-artifacts/s51-20261007T045906Z/run_gates_s51.sh`（base URL 全 env 覆写 `http://127.0.0.1:5792`；`export PORT=5792 P8S5_HTTP_MODE=after`）。逐门 stdout/stderr/exit 见 `gates/`；summary 见 `summary.tsv`。

| # | 门 | exit | total | passed | failed | 备注 |
|---|---|---|---|---|---|---|
| 1 | `p8-s1-app-config` | 0 | 24 | 24 | 0 | |
| 2 | `p8-s2-fee-rebate` | 0 | 44 | 44 | 0 | |
| 3 | `p8-s3-deposit` | 0 | 45 | 45 | 0 | |
| 4 | `p8-s3b-address` | 0 | 38 | 38 | 0 | |
| 5 | `p8-s4-currency-review` | 0 | 79 | 79 | 0 | |
| 6 | `p8-s5-02-ownership` | 0 | — | — | 0 | HTTP 腿（`p8s5-http-*.json`） |
| 7 | `p8-s5-compliance` | 0 | 117 | 117 | 0 | |
| 8 | `p8-s6-site-text` | 0 | 64 | 64 | 0 | |
| 9 | `p8-s7-batt-checkin` | 0 | 60 | 60 | 0 | db=8 http=9 |
| 10 | `p8-s8-rating-timeliness` | 0 | 92 | 92 | 0 | db=13 http=11 |
| 11 | **`p8-s9-bttc`** | 0 | 100 | 100 | 0 | **K5 前推后**；db=10 http=0 |
| 12 | **`p8-s10-invite-reward`** | 0 | 49 | 49 | 0 | **K2 前推后**；db=3 http=3 |
| 13 | **`p8-s11-audit-console`** | 0 | 87 | 87 | 0 | **K1 前推后**；db=6 http=6 |
| 14 | `s36-00-identity-pk-form` | 0 | — | — | 0 | 受体 191 / 命中 30 / 基线 30 / **新增 0** |
| 15 | `p7b-03-offline-gates` | 0 | — | — | 0 | 离线门 |
| 16 | `s41-00-identity-seq-collision` | 0 | — | — | 0 | 受体 23 / 违例 0 / 新增 0 |

**⇒ 16/16 全绿。**

**三门前推判据的绿色读数（`actual`）**：

| 门 | 判据 | pass | actual |
|---|---|---|---|
| `p8-s9` | `K5` | **true** | `{"n":43,"mx":"0044"}` |
| `p8-s10` | `K2` | **true** | `{"n":43,"mx":"0044"}` |
| `p8-s11` | `K1` | **true** | `{"n":43,"mx":"0044"}` |

### §2.1 复跑中的两次一次性异常（已定性为**非**回归）

1. **首轮 `s36-00-identity-pk-form` exit=3（RED）** —— 定性：**行号漂移**（我第一版前推在 `p8-s9` 多插了 2 行注释 ⇒ 基线登记项 `p8-s9-bttc-gate.ts:584:currency` 漂到 `:586`，被记为 `new_hit`、原 `:584` 记 `stale`）。**修法**：把三门前推改为 **line-count-neutral**（合并非新行）⇒ `s36-00` 复跑 **新增=0、exit 0 绿**。
2. **一轮 `p8-s11` exit=1（RED，`K10` HTTP 腿）** —— 定性：**Neon driver 瞬断**（实例 stderr 逐字：`LEDGER_TX_TIMEOUT` / `driver_connection_error` / `NeonDbError: Error connecting to database: fetch failed`）；与实际 `schema_migration` 判据无关（该轮 DB 腿 `K1` 已绿，仅 `ok_page` 收到 `503`）。**复跑即 87/87 绿**（`gates/p8-s11-audit-console.retry1.stdout.txt`）。**非期望过期、非真回归。**

---

## §3 ★ `p8-s3-01-effective.ts` 行为段 —— 前后对照（4 分录逐字）

命令：`cd backend-ts && npx ts-node --transpile-only scripts/p8-s3-01-effective.ts`
（全段在**一个** `withTransaction` 内，末尾抛哨兵 ⇒ `ROLLBACK`，无 COMMIT / 无 HTTP 写）

| 项 | 改前（S50b · `p8s3-effective-20261007T013959Z`） | 改后（S51 · `p8s3-effective-20261007T050621Z`） |
|---|---|---|
| **SUMMARY** | `total=35 passed=24 **failed=11**` | `total=35 **passed=35 failed=0**` |
| `4_before.list_reply` | `{cur_found:0, applied:0, cur_status:null}` | `{cur_found:1, **applied:1**, cur_status:"draft"}` |
| `4_before.guard_error` | `{code:"LD016", message:"LEDGER_AMOUNT_INVALID", detail:{"cid":"1","uid":"970001","kind":"listing_deposit","field":"entries","reason":"**HOLD_PAIR_REQUIRED**"}}` | **`null`** |
| `4_before.owner_balance` | `1627271 → 1627271，decrease=0` | `1627271 → 1567271，decrease=**60000**` |
| `4_before.pool_balance_minus1` | `168558 → 168558，increase=0` | `168558 → 228558，increase=**60000**`（= owner 减少额 ⇒ **守恒**） |
| `4_before.ledger_legs` | `[]`（0 腿） | **4 腿**（下表逐字） |
| `4_after.list_reply` | `{cur_found:0, applied:0, cur_status:null}` | `{cur_found:1, **applied:1**, cur_status:"draft"}` |
| `4_after.guard_error` | `LD016 / HOLD_PAIR_REQUIRED` | **`null`** |
| `4_after.owner_balance.decrease` | `0` | **`133456`**（= 上市费 10000 + 新键值 123456） |
| `4_two_readings` | before/after 消耗额皆 0（不可算） | before `{floor:50000, source:constant, owner_decrease:"60000"}` · after `{floor:123456, source:config, owner_decrease:"133456"}` · `delta=73456 = delta_expected` |
| `defects` | `[{id:"S49-S3-01-DOWNSTREAM-LEDGER-GUARD", code:"LD016", …}]` | **`[]`**（LD016 消失） |
| 11 条红 | `S4-before-applied-1 / S4-before-owner-decrease / S4-before-pool-increase / S4-before-deposit-legs / S4-after-applied-1 / S4-after-owner-decrease / S4-after-pool-increase / S4-after-deposit-legs / S4-two-readings-differ / S4-two-readings-computable / S4-fail-closed-behavior` | **全绿** |

**改后 `4_before.ledger_legs`（4 条分录逐字 · `draft_cid=925000001`）**：

```json
[ {"uid":"970001","cid":"1","delta":"-10000","kind":"currency_create_fee","idempotency_key":"biz:currency:list:925000001"},
  {"uid":"-1",    "cid":"1","delta":"10000", "kind":"currency_create_fee","idempotency_key":"biz:currency:list:925000001#2"},
  {"uid":"970001","cid":"1","delta":"-50000","kind":"listing_deposit",    "idempotency_key":"biz:currency:list:925000001#3"},
  {"uid":"-1",    "cid":"1","delta":"50000", "kind":"listing_deposit",    "idempotency_key":"biz:currency:list:925000001#4"} ]
```

- `currency_create_fee` **两腿**：owner(`970001`) **−10000** / `uid=-1` **+10000**
- `listing_deposit` **两腿**：owner(`970001`) **−50000** / `uid=-1` **+50000**
- 合计：**owner −60000** / **`uid=-1` +60000** ⇒ **守恒**

**改后 `4_after.ledger_legs`（同形，`draft_cid=925000002`，保证金用新键值 `123456`）**：`-10000/+10000`（`currency_create_fee`）+ `-123456/+123456`（`listing_deposit`）⇒ **owner −133456 / `uid=-1` +133456 守恒**。

**⇒ 行为级证明：`0044` 在（生产同源）库上真生效 —— 自建币上市 `draft → listed` 不再被 `LD016/HOLD_PAIR_REQUIRED` 拒，4 腿照落账。**（`defects` 归零 = 下游账本闸不再回执。）

**回滚纪律自证**（探针自带，全绿）：`ROLLBACK-app_config-identical` / `currency-digest` / `ledger-digest` / `account-digest` / `status-log` / `review-log` 六项逐字节复原 + `ROLLBACK-no-commit`；`sequence_cost.currency_review_log_log_id_seq` 前移 3（`nextval` 不回滚，**登记为成本、非残留**）；`ledger_entry_txid_seq` 前移 12。

---

## §4 `p8-s5-01-real-chains.ts`（应仍绿）

命令：`npx ts-node --transpile-only scripts/p8-s5-01-real-chains.ts`

```
SUMMARY total=84 passed=84 failed=0 artifact=…/.p8s5-artifacts/p8s5-20261007T050632Z/real-chains.json
```

⇒ **84/84 绿**（含 `0043` 15 枚 `BEFORE TRUNCATE` 守卫逐条现取 —— 见 §1.3，`0043` 事实未变，故仍成立）。

---

## §5 判负（前推反向 ⇒ 必红）

**方法**：把三门前推**反向改回**（`43/0044` ⇒ `42/0043`）于**仓外一次性副本**（`backend-ts/scripts/s51neg-*.ts`，跑后即删；**非**改真门文件），跑后对拍；真门保持前推版。

**命令**（要点）：

```
cp <前推版> scripts/s51neg-p8-s9-bttc-gate.ts        # + s10/s11
# 副本内把 (=== 43 && === '0044') 逐字改回 (=== 42 && === '0043')
export PORT=5792 P8S10_BASE=/ P8S11_BASE=http://127.0.0.1:5792
npx ts-node --transpile-only scripts/s51neg-p8-s9-bttc-gate.ts   # 三门各跑
```

**判负读数**（`neg/*.neg.stdout.txt`）：

| 副本 | exit | total/passed/failed | 失败判据 | `actual` |
|---|---|---|---|---|
| `s51neg-p8-s9-bttc-gate.ts` | **1（红）** | 100/99/**1** | **恰 `K5`** | `{"n":43,"mx":"0044"}` |
| `s51neg-p8-s10-invite-reward-gate.ts` | **1（红）** | 49/48/**1** | **恰 `K2`** | `{"n":43,"mx":"0044"}` |
| `s51neg-p8-s11-audit-console-gate.ts` | **1（红）** | 87/86/**1** | **恰 `K1`** | `{"n":43,"mx":"0044"}` |

⇒ **反向必红**（且**只**红在那一条库面判据上 ⇒ 判据仍「活着」，非死门）。
**复原回绿**：真门（前推版）在 §2 复跑 = **16/16 全绿**（`K5/K2/K1` 均 `pass:true`）。副本已删除（`git status` 无 `s51neg-*`）。

---

## §6 `NOT_MEASURED`（未测 / 不洗白）

1. **`migrate apply` 未跑**（遵硬口径 ②）⇒ 「apply 动作本身」本单**未**复现；`0044` 已生效这一事实 = **转录 Zang 亲做读数 + 本单受控实例 `/health` 独立复核**（§0）。
2. **生产 `/api/health` 我未亲打**：只打**受控实例 `5792`** 的 `/health`（= `0044`）。生产面为 Zang 转录。
3. **HTTP 写面 = `NOT_MEASURED`**（探针自带口径：键级寻址线格式未冻结）—— `p8-s3-01` 的「① 写键」走的是**事务内 DB 直写 `app_config`**，非 HTTP。
4. **HTTP `list` 面 = `NOT_MEASURED`**（跑真 `POST /api/currency/:cid/list` 会永久改线上状态）。
5. **`0044` apply-time 自检**本单**未**独立复跑（属 apply 相位；本单只读）。
6. **序列成本**：`currency_review_log_log_id_seq` 每次跑 `s3-01` 前移 3（`nextval` 不回滚）——登记为成本，**非**行残留（`ROLLBACK` 自证六表逐字节复原）。

---

## §7 自曝（我认账）

1. **★ 第一版前推踩了 `s36-00` 的行号敏感区**：我在 `p8-s9` K5 块**多插 2 行注释** ⇒ 基线登记项 `p8-s9-bttc-gate.ts:584:currency` 漂到 `:586` ⇒ `s36-00` 报 `new_hits=1` / `stale=1` / **exit 3（RED）**。**若我只看「16/16」结论不追根，就会把一条真红洗成"预期"**。**修法 = 三门前推全改 line-count-neutral**（`numstat 9/9·4/4·4/4`），复跑绿。**教训**：`s36-00` 基线按 `file:line` 键控 ⇒ 任何在**既含 identity-PK 命中**的门脚本上「加行」都会污染它。
2. **首轮 runner 曾得 15/16**（`s36-00` red）+ 另一轮 `p8-s11` 503（Neon 瞬断）—— 两者均已定性（§2.1），**非**回归。
3. **第一版判负控制写坏**：副本命名与调用路径不匹配（`s51neg-…-bttc.ts` vs `…-bttc-gate.ts`）⇒ 首次三门「红」实为 `Cannot find module` 崩溃（stdout 0 字节）。**已重做**，红的是**真判据**（§5 表）。
4. **未 commit / 未 push**；**未跑 `migrate` / 未改活库**；**未 `npm install`**。
4b. **★ 锚点并发前移**：开工 HEAD = `1aa5f7d`；作业期间**另一会话（Zang）**落了 `ec3e1aa` + `1f2fac7`（均 docs-only）⇒ 收工 HEAD = `1f2fac7`。**我未 commit**，故我的 3 处门编辑仍在工作区（`M`）。**风险自曝**：若我晚一步 `git stash pop`/对拍而不复核 HEAD，可能把别人的 doc 提交误算进本单 —— 本单所有读数均在 `1f2fac7` 工作区之上重跑，且三门编辑与两枚 doc 提交**文件面零交叠**。
5. **零越界**：`git status --porcelain` = **仅 3 个门脚本 `M`**；`git diff --name-only` 无 `migrations/**` / `src/**` / `frontend/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`（本报告为**新增**文件）。
6. **`tsc` 双配置新增错 = 0**：`tsconfig.json` ⇒ 0 错；`tsconfig.scripts.json` ⇒ 改前 77 / 改后 **77**（`git stash` 对拍），且**无一条**落在三门文件上。三门编辑仅字符串字面量 + 比较常量，不引入类型面改动。
7. **端口收尾**（亲验）：`5792–5799` **全空**；监听 PID `77687` 与 `npm` 父 PID `77308` **均已消失**（按精确 PID `kill`，**未**用 `pkill -f`/`killall`）；他人在听的 `5787/5788/5555/5191` **四条无恙（未碰）**。

---

## 附：本单交付物

| 路径 | 内容 |
|---|---|
| `backend-ts/scripts/p8-s9-bttc-gate.ts` | K5 前推 `42/0043 ⇒ 43/0044`（+ 7 处注释口径同步） |
| `backend-ts/scripts/p8-s10-invite-reward-gate.ts` | K2 前推（+ 3 处注释口径同步） |
| `backend-ts/scripts/p8-s11-audit-console-gate.ts` | K1 前推（+ 3 处注释口径同步） |
| `docs/audit/s51-post-apply-closeout.md` | 本报告 |
| `backend-ts/.s51-artifacts/s51-20261007T045906Z/` | `run_gates_s51.sh` · `summary.tsv` · `gates/*`（16 门逐门 stdout/stderr/exit）· `probes/*`（`s3-01` 改后 + `s5-01` + 三门 gate.json）· `neg/*`（三副本源码 + 逐门红读）· `instance-5792.stdout.txt` |
