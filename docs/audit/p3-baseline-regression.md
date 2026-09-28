# P3 地盘体检基线 + `DL155` 收紧 + D20 残差只读清单

> 单号：P3-Q（地基体检 / 变体 1 第 ①③ + ② 前置）
> 角色：Kong（实现）。Zang 拆解派单，Neng 独立质检。
> 交付三件：① 全量回归基线 ③ `DL155` 收紧 ② 前置 D20 残差只读清单。
> **零删除、零破坏**：本单未执行任何 `DELETE`/`TRUNCATE`/`DROP`/`ALTER`，未改迁移，未动 `0018`。

> 口径约定：所有 SQL 显式限定 `public.`；exit code 一律取自进程本身（非管道之后）；行号/指纹/计数均为**现场现取**，不转抄 brief。

---

## §0 元信息与环境指纹（现取）

| 项 | 值 | 取法 |
|---|---|---|
| RUN tag (UTC) | `20260928T133709Z`（会话开档）/ 批跑 `20260928T134558Z` | `date -u +%Y%m%dT%H%M%SZ` |
| 仓库 | `/Users/kevin/bistro/seafood` | `pwd` |
| `git log -1 --oneline` | `0ab8cd3 QA: 0017_platform_config independent review verdict=USABLE (43/43 checks, 15 unverified) => acceptance + QA double-pass; P3 data layer CLOSED (0018 is non-proposed per spec 6.1, no deliverable)` | `git log -1 --oneline` |
| `git status --porcelain` | **非空**（3 行，见下） | `git status --porcelain` |
| node | `v18.19.0` | `node --version` |
| npm | `10.2.3` | `npm --version` |
| tsc（backend-ts） | `Version 5.9.3` | `npx tsc --version` |
| PostgreSQL | `18.6`（`aarch64-unknown-linux-gnu`，Neon） | `SELECT version()` |
| `schema_version` | `0017` | `MAX(version)` on `public.schema_migration` |
| registry 行数 | `17` | `count(*)` on `public.schema_migration` |
| `public` 基表数 | `21` | `information_schema.tables` (BASE TABLE) |
| 视图数 | `1`（`candle_view`） | `information_schema.tables` (VIEW) |

`git status --porcelain` 原文（**与 brief「应空」不符，登记为实测差异**）：

```
 M docs/data-layer.spec.md
?? docs/audit/p3-data-layer-v06.md
?? docs/versions/data-layer.spec.v0.5.md
```

> 上述 3 项**均非本单所写**（本单仅动 `db.ts` 一行 + `scripts/p3q-*.ts` + `.p3q-artifacts/**` + 本报告）。
> **会话内变化（收尾复核）**：收尾时再取 `git status --porcelain`，上述 3 项**已不在**工作树（会话期间被外部提交/清理，非本单所为）；届时 status 仅含本单产物 + `M backend-ts/src/db.ts`。

### 四个编排函数指纹（不得变）——**实测逐一相符**

| 函数 | octet_length 期望 | 实测 | md5(prosrc) 期望 | 实测 md5(prosrc) | 判定 |
|---|---|---|---|---|---|
| `ledger_post_event` | 51429 | **51429** | `d94dd902697dfe60aba409d808c6d63a` | `d94dd902697dfe60aba409d808c6d63a` | ✅ |
| `market_post_event` | 30194 | **30194** | `74841611252726e1cc0f57cb46ea6c6d` | `74841611252726e1cc0f57cb46ea6c6d` | ✅ |
| `listing_post_event` | 17858 | **17858** | `0e187c20b56d45202d83978c8a02b31d` | `0e187c20b56d45202d83978c8a02b31d` | ✅ |
| `job_post_event` | 13594 | **13594** | `0cedbb9ea60dcbda28e3ef3dafdd119b` | `0cedbb9ea60dcbda28e3ef3dafdd119b` | ✅ |

> 口径：`octet_length(prosrc)` + `md5(prosrc)`，取自 `pg_proc`（`pronamespace='public'`）。另附 `md5(pg_get_functiondef(oid))` 备查（`ledger`=`e784a58681ae971bcd97f3043f293002`、`market`=`6e74cf49089e71012c4a688792b861e8`、`listing`=`4ba4624c414db37ec188c6d9355f15b1`、`job`=`584966956afdf1a1d4d12da5159d7c36`）。
> 读数落盘：`.p3q-artifacts/p3q-00-fingerprint-20260928T133816Zitnn.json`

---

## §1 全量回归基线（**未修码前**）

命令口径：`cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/<file>.ts <args>`。
**exit code 取法**：重定向后 `echo $?`（管道之外）。

| # | 套件 | 实际命令 | exit | 关键读数（逐字） | 判定 |
|---|---|---|---|---|---|
| 1 | 类型检查 `src/**` | `npx tsc --noEmit` | **0** | `0 error TS` | **PASS** |
| 2 | 类型检查 `scripts/**` | `npx tsc -p tsconfig.scripts.json` | **2** | `15 error TS`（其中 **5 条为本人新脚本 `p3q-01` 引入，已修**⇒ **基线真值 = 10 条**） | **FAIL**（详见 §2） |
| 3 | `p1t-00` 第 1 跑 | `… scripts/p1t-00-bind-protocol-guard.ts --assert` | **0** | `"assertions_failed": []` / `"ok": true`（run=`20260928T134559Z`） | **PASS** |
| 4 | `p1t-00` 第 2 跑（幂等） | 同 #3 | **0** | `"assertions_failed": []` / `"ok": true`（run=`20260928T134705Z`） | **PASS**（幂等，见下） |
| 5 | `p2d-00` | `… scripts/p2d-00-commission-m-criteria.ts --assert` | **0** | 自产报告 `红线数：**0** ⇒ 全绿`；M1–M9 全 `✅ pass` | **PASS** |
| 6 | `p1o-00` | `… scripts/p1o-00-escape-sweep.ts --phase after --assert` | **2**（3 次重试：2 / 1 / 1） | stdout **0 字节**；stderr=`P1O-00 FAILED: Error: Client network socket disconnected before secure TLS connection was established`；随后两次为驱动崩溃（见 §2） | **FAIL** |
| 7 | `p2c-00` | `… scripts/p2c-00-code-roundtrip.ts --phase after --assert` | **0** | `assertions_failed = []`；自产 `.p2c-artifacts/p2c-00-roundtrip-after-MULB34YY.json` 已写 | **PASS** |
| 8 | `p2w-00`（无 `--assert`） | `… scripts/p2w-00-p2fix-verify.ts` | **0** | 但 artifact 顶层 `reds` 数组 **5 条非空** ⇒ 与「0 全绿」契约语义冲突 | **AMBIGUOUS**（以 #9 定论） |
| 9 | `p2w-00` 加 `--assert`（决定性） | `… scripts/p2w-00-p2fix-verify.ts --assert` | **1** | `reds` = 5 条（D4/D5/D7/E4/F3，逐字见 §2） | **FAIL** |

### 幂等证据（#3 vs #4）
两次 `--assert` 均 `exit 0` + `assertions_failed: []`。两份 stdout **文件 md5 不同**（`de7bcf…` vs `b32bfb…`），但差异**仅在 run tag / artifact 路径**（脚本自带 `run`/`file` 字段随运行时刻变化），语义载荷一致（同为 `ok:true`、`bypass_selfproof.rolled_back=true`、`trigger_enablement: 43/43`）。
> 结论：`p1t-00` 幂等成立；**以文件 md5 相等作幂等判据是错的口径**（已在本单登记）。

### 未捕获 exit 的说明
首个「6 套件批跑」在工具层 420s 超时被截断，**批跑 stdout（含 exit）未回传**。故：#3/#4/#7/#8 的 exit 已由**单独重跑**补齐（上表均为实测）；#3/#4 的批跑产物仍在 `.p1t-artifacts/`（`assertions_failed: []`）。批跑中 `p2d-00` 的 stdout 被截断于 JSON 中段，但其**自产完整报告** `.p2d-artifacts/p2d-REPORT-20260928T134746Z.md` 落盘完整（+ 重跑 `p2d-REPORT-20260928T140829Z.md` 同判）。

### 读数落盘
`backend-ts/.p3q-artifacts/`（run-tagged，同名拒写）：`p3q-suite-<name>-20260928T134558Z.{out,err}`、`p3q-exit-<name>-20260928T140727Z.{out,err}`、`p3q-rerun-*`、`_s1_tsc.out`、`_s2_tsc_scripts.out`。

---

## §2 失败项根因分类表

根因三选一：**(a) 旧套件与新 schema 漂移** / **(b) 真缺陷** / **(c) 探针自身口径错**。**本单只分类、不修。**

| 套件 | 现象（逐字） | 根因分类 | 依据 / 定论状态 |
|---|---|---|---|
| `tsc -p tsconfig.scripts.json` | `15 error TS`（基线 10） | **(a) 漂移** | 10 条基线错全部落在 P1/P2 期旧脚本，其类型面已被 P3 更新。代表：`qa-p1e-05-neon-ab.ts(15,10): error TS2724: '"…/qa-p1e-lib"' has no exported member named 'accountOf'. Did you mean 'accountsOf'?`（旧 API 名）；`p1f-02-f2-malformed.ts(171,23): error TS2352 … Type 'null' is not comparable to type 'number'`（= `src/ledger-errors.ts` 的 `status` 现为 `null` 字面量、旧脚本仍按 `number` 断言 ⇒ 与 brief 登记的「`status` 仍为 `number`」同源）。**本单不定论修法** |
| `p1o-00`（3 次） | 第 1 次：`P1O-00 FAILED: Error: Client network socket disconnected before secure TLS connection was established`（exit 2）；第 2/3 次：`TypeError: Cannot set property message of #<ErrorEvent> which has only a getter at _n._connectionCallback (…/@neondatabase/serverless/index.js:1379:72)`（exit 1） | **(b) 真缺陷**（第三方驱动错误处理路径）+ **环境网络触发** | 崩点位于 `@neondatabase/serverless` 的 WebSocket error 处理，**不在任何 SQL/函数体**；故**不是** schema 漂移、**不是**探针口径。3 次重试均未能取得读数 ⇒ 该套件本单**未能验证**（非「套件判红」）。触发条件是 Neon TLS 连接抖动（同批 `p1t-00`/`p2d-00`/`p2c-00`/`p2w-00` 均正常） |
| `p2w-00 --assert` | exit **1**；`reds` 5 条：<br>① `D4 丢一对佣金（Σ-中性）⇒ 仍报 LD032 + COMMISSION_SPLIT_SUM_MISMATCH :: null`<br>② `D5 只入不出（commission_rows=0 且 pool_in>0）⇒ 仍报 LD032 :: null`<br>③ `D7 先落账后强制结算：非法事件仍报 LD032 :: {"badPost":null,"after":{"ok":true,"err":null}}`<br>④ `E4 判负对照：无守卫时裸 INSERT 退回 23505/referral_pk（= 修前形态） :: null`<br>⑤ `F3 判负对照：无守卫时陈旧 depth 被继承（50 ⇒ 51 = 修前形态） :: null` | **① ② ④ ⑤ = (a) 漂移**；**③ = (b) 疑似真缺陷** | ①②④⑤ 的观测值为 `null`（该判负路径未产生可观测事件），符合「P3 重写四个编排函数体后，旧判负对照的预期形态已变」；③ 的观测是 `badPost:null` 且 `after.ok:true` ⇒ **非法事件疑似未被 LD032 拦下**，与「仍报 LD032」的预期直接相悖，故单列为 **(b) 疑似真缺陷**。**本单不定论**，下一单需做守卫语义 diff 定案 |

> 备注：`p2w-00` 除 `reds` 外，其结构性读数均健康：`graph_invariants_after = {"cycles":"0","bad_depth":"0","referral_rows":"255"}`、`trigger_enablement_after = {"total":43,"enabled":43,"anomalies":[]}`。

---

## §3 `DL155` 收紧（本单唯一改码）

- 目标：`backend-ts/src/db.ts` 的 `getSchemaVersion`，SQL 未限定 `public.`，与 `DL151` 口径不一致。

**修前**（`src/db.ts:250-255` 原文，`sed -n '250,255p'`）：

```ts
250:export const getSchemaVersion = async (): Promise<string | null> => {
251:  const rows = await readQuery<{ version: string }>(
252:    'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1',
253:  );
254:  return rows[0]?.version ?? null;
255:};
```

**修前行为实测**（`.p3q-artifacts/p3q-03-dl155-pre-20260928T134530Z5cw5.{json,txt}`）：

| 探针项 | 修前读数 |
|---|---|
| `getSchemaVersion()`（`src/db.ts`） | `"0017"` |
| `getDbVersion()`（`src/db.ts`） | `"PostgreSQL 18.6 …"` |
| `current_setting('search_path')` | `"$user", public` |
| `current_schema()` | `public` |
| SQL **未限定** `schema_migration` | `0017` |
| SQL **限定** `public.schema_migration` | `0017` |
| 名为 `schema_migration` 的表 | `[{schema:public, table:schema_migration}]` |

> 判定：**当前无行为差异**（`search_path` 解析到 `public`，且无同名异 schema 表）。`DL155` 是**口径/潜在漂移风险**，不是现网 bug。

**改动**（`git diff --numstat` = `1  1  backend-ts/src/db.ts`，无空白行）：

```diff
-    'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1',
+    'SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1',
```

**修后行为实测**（`.p3q-artifacts/p3q-03-dl155-post-20260928T140316Zej0l.{json,txt}`）：

| 探针项 | 修前 | 修后 | 差异 |
|---|---|---|---|
| `getSchemaVersion()` | `"0017"` | `"0017"` | 无（符合预期） |
| `search_path` | `"$user", public` | `"$user", public` | 无 |
| 未限定 SQL 读数 | `0017` | `0017` | 无 |
| 限定 SQL 读数 | `0017` | `0017` | 无 |

**`npx tsc --noEmit` 对拍（修前 vs 修后）**：

| 项 | 修前 | 修后 | 是否引入新错 |
|---|---|---|---|
| exit | `0` | `0` | 否 |
| `error TS` 计数 | `0` | `0` | 否 |

> 仅改此一处；未顺手改任何其它行（`git diff --numstat` 只有 `db.ts` 1/1；另有一次**本单新增探针自身的类型修正** `scripts/p3q-01-d20-residual.ts`，属 `p3q-*` 允许范围，见 §5）。

---

## §4 D20 残差只读清单（**禁删**）

- 机器可读 JSON（人可读 TXT 同目录）：
  - **清残差前基线**（本单批跑前，`13:39Z`）：`backend-ts/.p3q-artifacts/p3q-01-d20-residual-20260928T133943Z009o.json`
  - **套件跑完后现状**（`14:06Z`）：`backend-ts/.p3q-artifacts/p3q-01-d20-residual-20260928T140655Zgxy0.json`
- 辅助普查（命名空间/角色键定位）：`p3q-02-ns-scan-20260928T134131Zes22.json`
- **本单未执行任何删除**（`deletes_performed: 0`）。

### 4.1 逐表 `count(*)`（前 = 13:39Z 基线 / 后 = 14:06Z 现状；Δ = 本单套件跑动所致）

| table | count（前） | count（后） | Δ | 归属判定 |
|---|---|---|---|---|
| `public.users` | 456 | 564 | **+108** | 混；窗口 9903–9906 共 16 行为**夹具残留**，`0/-1/-2/-3` 为**平台合法** |
| `public.currency` | 101 | 106 | **+5** | 混；`cid=1` 合法，其余（`p1e*/P1HMU*/smkuji*/p1u*/p1w*/p1x*/p1y*/p2x*/p2qa*/neng48`）为**夹具残留** |
| `public.account` | 327 | 341 | **+14** | 混；平台 uid 合法，窗口 uid 为**夹具残留** |
| `public.ledger_entry` | 2755 | 2984 | **+229** | **append-only，禁直删**（见 §4.3/§4.4） |
| `public.referral` | 219 | 283 | **+64** | 夹具残留为主 |
| `public.job` | 110 | 110 | 0 | 夹具残留（含 `cli:`110 条 create_key） |
| `public.job_application` | 32 | 32 | 0 | 夹具残留 |
| `public.job_submission` | 10 | 10 | 0 | 夹具残留 |
| `public.listing` | 62 | 62 | 0 | 夹具残留 |
| `public.listing_order` | 21 | 21 | 0 | 夹具残留 |
| `public.market_order` | 68 | 68 | 0 | 夹具残留 |
| `public.market_trade` | 19 | 19 | 0 | 夹具残留 |
| `public.commission_policy` | 19 | 22 | **+3** | `policy_id=1` 为**基线政策（合法）**；`20..37` 为夹具残留 |
| `public.ledger_owner` | 4 | 4 | 0 | **平台合法**（uid `0/-1/-2/-3`，`owner_type=platform`） |
| `public.admin_role` / `admin_user_role` / `admin_permission` / `admin_role_permission` | 0 | 0 | 0 | 空表（**brief 所述 `p3p:`/`neng17:` 角色键在此处不存在**，见 §4.2） |
| `public.app_config` / `public.currency_status_log` | 0 | 0 | 0 | 空表 |
| `public.schema_migration` | 17 | 17 | **0** | **合法**；Δ=0 ⇒ 本单套件**未施加任何迁移** |

> **brief 台账对数差异登记**：brief 记 `users ~430+`/`account 245+`/`ledger_entry 2145+112`/`listing 6+23`/`listing_order 15`/`market_order 26`/`market_trade 8`，实测（前）为 `456/327/2755/62/21/68/19`。**以现场读数为准**（brief 为较早快照）。

### 4.2 按命名空间聚合明细（前 = 13:39Z）

**夹具 uid 窗口直方图**（`left(uid::text,4)`）：

| table.col | 9903 | 9904 | 9905 | 9906 | 9907 | 9908 |
|---|---|---|---|---|---|---|
| `users.uid` | 4 | 4 | 4 | 4 | 0 | 0 |
| `account.uid` | 3 | 3 | 7 | 7 | 0 | 0 |
| `ledger_entry.uid` | 67 | 14 | 114 | 138 | 0 | 0 |
| `listing.seller_uid` | 39 | 23 | 0 | 0 | 0 | 0 |
| `listing_order.buyer_uid` | 6 | 15 | 0 | 0 | 0 | 0 |
| `listing_order.seller_uid` | 6 | 15 | 0 | 0 | 0 | 0 |
| `market_order.owner_uid` | 0 | 0 | 26 | 42 | 0 | 0 |
| `market_trade.taker_uid` | 0 | 0 | 8 | 11 | 0 | 0 |
| `referral.child_uid` / `parent_uid` / `currency.owner_uid` / `job.*_uid` / `job_application.worker_uid` / `job_submission.worker_uid` / `commission_policy.created_by` | 0 | 0 | 0 | 0 | 0 | 0 |

> 窗口 `9907xx` / `9908xx` **全表命中 0**（brief 列出的这两个窗口在本库无行）。

**幂等键 / `create_key` 命名空间前缀**（`split_part(col,':',1)`）：

| table.col | 明细 |
|---|---|
| `ledger_entry.idempotency_key` | `biz=1534`, `cli=136`, `ops=1075`, `cm=10` |
| `job.create_key` | `cli=110` |
| `job_application.create_key` | `cli=32` |
| `job_submission.create_key` | `cli=10` |
| `listing.create_key` | `cli=62` |
| `listing_order.create_key` | `cli=21` |
| `market_order.create_key` | `cli=68` |

**字符串普查（`p3q-02`）关键结论**：
- `p3p:` 前缀：**全库 0 命中**；`neng17`：**全库 0 命中**。
- `neng` 实际落点：`currency.cid=991001`（`symbol='neng48-atk'`, `status='draft'`）、以及 `job.create_key=90` / `listing.create_key=23` / `market_order.create_key=42` / `ledger_entry.idempotency_key=110` / `memo=146` 等键值中。
- `admin_role` / `admin_user_role` **两表均 0 行** ⇒ **brief 所述「`p3p:`、`neng17:` 角色键」在当前库中不存在**（登记为实测差异；可能为更早 run 的产物或落点已变）。
- `ops:` 仅出现在 `ledger_entry.idempotency_key`（前 `1075` / 后 `1112`）。

### 4.3 逐表归属判定（供下一单清理执行）

| 集合 | 判定 | 依据 |
|---|---|---|
| platform uid `0/-1/-2/-3` + `ledger_owner` 4 行 + `cid=1` | **平台/合法产物** | `ledger_owner.owner_type='platform'`（`0`=平台主体, `-1`=手续费归集账户, `-2`=佣金池, `-3`=罚没账户） |
| `commission_policy.policy_id=1` | **合法（基线政策）** | 与 `20..37` 夹具政策并列存在 |
| `schema_migration` 17 行 | **合法** | 迁移注册表 |
| uid 窗口 `9903xx–9906xx`（users 16 行、account 20 行、ledger_entry 333 行） | **夹具残留** | `evm` 多为 `0x9904xx…` 占位式地址（`p3p`/`neng48` 期夹具） |
| `currency` 除 `cid=1` 外 100 行（`p1e*/P1HMU*/smkuji*/p1u*/p1w*/p1x*/p1y*/p2x*/p2qa*/neng48-atk`，含 `draft` 15 行、`cid=991001`） | **夹具残留** | symbol 前缀即各柱夹具命名空间 |
| `referral` 219 行、`job*`、`listing*`、`market_*` | **夹具残留** | `create_key` 全为 `cli:*` |
| `ledger_entry` 2755 行 | **禁直删（append-only）** | `biz=1534` 承载业务语义（结算流水），须走反向分录/对冲，不得 `DELETE` |

### 4.4 `$`（`cid=1`）敏感性预演（**只读计算，未执行删除**）

口径：`account_sum = SUM(balance + frozen)` over `public.account WHERE cid=1`。

| 场景 | `cid=1` 账户合计 | 行数 | 与 `total_supply` 对比 |
|---|---|---|---|
| `currency.total_supply`（`cid=1`） | — | — | **8400** |
| **现状（NOW）** | **8400** | 45 | **平衡**（8400 = 8400）✅ |
| 若删掉夹具窗口 `9903–9906` 各账户 | **4099** | 31 | **失衡 −4301** ❌ |
| 若删掉夹具窗口 `9903–9906` **的 `account` 行**（逐窗口贡献） | `9903=1508`(3 行), `9904=120`(3), `9905=1076`(4), `9906=1597`(4) ⇒ **合计 4301**（14 行） | 14 | — |

**非窗口持币方（不应动）**：`9901=1607`(7 行)、`6=1000`(1)、`10=900`(1)、`11=200`(1)、`8=200`(1)、`55=100`(1)、`9000=80`(3)、`9547=0`(8)、`-1=12`(1)、`0/-2/-3=0`；负 uid 行：`uid=-1: sum=12`、`uid=-2: 0`、`uid=-3: 0`。

> **下一单执行依据（关键）**：**不得**对 `cid=1` 的夹具账户做「直接删 `account` 行」式清残差 —— 那会使 `cid=1` 合计从 `8400` 掉到 `4099`，与 `currency.total_supply=8400` **失衡 4301**。正确路径是**以 `ledger_entry` 反向分录/对冲**冲销夹具流水后再评估，且 `ledger_entry` 本身 append-only、禁 `DELETE`。
> 另：`account.version` 等乐观锁字段在批量冲销时须按行校验（本单未做写路径验证）。
> 完整逐窗口数值见 `.p3q-artifacts/p3q-01-d20-residual-20260928T140655Zgxy0.json` 的 `cid1_sensitivity`。

---

## §5 未验证清单（枚举到边界）

| 项 | 状态 | 原因 / 边界 |
|---|---|---|
| `p1o-00`（`--phase after --assert`） | **NOT_VERIFIED** | 3 次重试全崩（Neon TLS 断连 + 驱动 `ErrorEvent` 崩溃），stdout 0 字节、无 artifact。**未能取得任何读数** |
| `p2w-00` 的 5 条 `reds`（D4/D5/D7/E4/F3）根因 | **未定论** | 本单只分类（§2）：① ② ④ ⑤ 归 (a) 漂移、③ 归 (b) 疑似真缺陷，需下一单做**守卫语义 diff** |
| `tsconfig.scripts.json` 基线 10 条错的修法 | **未定论** | 本单只列错、只分类（§2），未改任何旧脚本 |
| brief 记「9 错」vs 实测「10 错（基线）」 | **差异未定论** | 实测 10 条（见 §1/#2）；差异来源未查（可能为 brief 计数口径或期间新增） |
| `p1t-00` 是否真正 import `ns-alloc` | **NOT_VERIFIED** | brief 登记「未真正 import」；本单未对 `p1t-00` 做 import 分析（超出本单「跑基线」范围） |
| `tsconfig.scripts.json` 之外的类型面（`tsconfig.scripts.probe.json`） | **NOT_MEASURED** | 本单未跑该配置 |
| 临时探针 `scripts/p2w-zz-tmp-{facts,mint}.ts` | **不存在（实测）** | `find . -name 'p2w-zz-tmp*'` 返回空 ⇒ brief 的「待删」项在盘上**已不存在**，无需删除 |
| `src/ledger-errors.ts` 的 `status: number` | **NOT_VERIFIED（只读观察）** | 仅从 `tsc` 报错侧证（`p1f-02` 的 `status: null` 断言失败）推断，未直读该文件 |
| P1/P2 其余套件（`p2qa-*`、`p2x-*`、`p2b-*`、`p1f-*`、`p1v-00`、`qa-p1*` 等） | **本单未跑** | 边界 = 本单只跑 brief 点名的 7 条；其余**不在本单范围** |
| `0018` | **无对象** | spec §6.1 明写「（不提案）」⇒ 无交付物可验 |
| 清残差的**写路径**（反向分录能否扣平 `$`） | **NOT_MEASURED** | 本单禁删/禁写数据；仅做只读预演 |
| `git status` 3 项非本单变更 | **来源未查** | `docs/data-layer.spec.md` 等 3 项在会话开始即存在，非本单所写 |

---

## §6 库侧副作用登记（本单在真库的写入）

**本单自建探针（`p3q-00/01/02/03`）：纯只读**（仅 `SELECT` / `SHOW` / `information_schema`），**新建 0 行、新建 0 命名空间**。

**本单执行既有套件所致的行增量**（取 `p3q-01` 前/后同一口径对拍）：

| 表 | 前(13:39Z) | 后(14:06Z) | 本单增量 |
|---|---|---|---|
| `users` | 456 | 564 | **+108** |
| `currency` | 101 | 106 | **+5** |
| `account` | 327 | 341 | **+14** |
| `ledger_entry` | 2755 | 2984 | **+229** |
| `referral` | 219 | 283 | **+64** |
| `commission_policy` | 19 | 22 | **+3** |
| `schema_migration` | 17 | 17 | **0（未施加迁移）** |

- `$` 守恒：`cid=1` `total_supply=8400` / `account_sum=8400`，**套件跑动前后一致**（未破坏）。
- 新增命名空间：套件按各自窗口分配夹具 uid（如 `955xxx` / `956xxx` / `959xxx` / `759015375xx` 键前缀 `ops:p1y:*`），**非本单命名，属套件自管**。
- `p2w-00` 自报残留（其 artifact `residue` 字段）：`my_window_users=45`、`my_window_referral_rows=28`、`my_key_prefix_rows=5`、`my_job_rows=14`、`my_currency_rows=1`。
- **长驻 server：无**。本单未起任何 server、未占用任何端口（全部为短命 `ts-node` 前台进程）；故无 PID/端口需登记。会话中观察到既有 `ts-node src/index.ts`（PID 60022，已运行 9h13m）**非本单启动**，未触碰。
- 未执行：`DELETE` / `TRUNCATE` / `DROP` / `ALTER` / `commit` / `git add` / `push`（**均为 0 次**）。

**盘上副作用（诚实登记）**：本单执行既有套件时，**套件自身的落盘逻辑**在其自有 artifact 目录新增了文件（`backend-ts/.p1t-artifacts/`、`.p2c-artifacts/`、`.p2d-artifacts/`、`.p2w-artifacts/`，均为 run-tagged、未覆盖既有文件）。这些目录**不在** brief 的禁写清单内（禁写清单为 `.p3f/.p3l/.p3m/.p3p-artifacts`），且写入者是套件本身、非本单直接写；现登记以免误判。

---

## §7 章节数自检

- 复核方式：`read_file docs/audit/p3-baseline-regression.md`。
- 章节数：**8**（§0 环境指纹 / §1 基线 / §2 根因分类 / §3 DL155 / §4 残差清单 / §5 未验证 / §6 副作用 / §7 自检）。
- 产物路径：报告 = `docs/audit/p3-baseline-regression.md`；读数 = `backend-ts/.p3q-artifacts/**`。

