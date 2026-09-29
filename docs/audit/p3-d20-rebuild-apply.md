# P3-D20-REBUILD-APPLY · D20 残差清理 Phase 2（真重建 + COMMIT）· 事后对拍报告

- 单：**P3-D20-REBUILD-APPLY（Unit J2）** · 执行人 **Kong**
- 执行时间：2026-09-29T01:15:09Z（apply 开始）→ 01:20:26Z（S4 观测结束）；本机 CST = UTC+8
- 唯一破坏性命令（逐字）：
  `cd backend-ts && P3_ART_ROOT=.p3y-artifacts npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --apply --confirm-irreversible`
- 授权：项目负责人 Kevin **明确授权**（本单为全项目唯一不可逆动作）
- 判负口径本单采用：① 事务内 `gate.ok === true`（六项逐项列于 §2）；② 事务外**独立**只读探针的逐值终态对拍（§3）。
  **`A_hash != F_hash` 在 apply 模式是目的，不是失败**（见 §2 退出码说明）。

---

## §0 不可逆声明

1. **已生效、无回滚**：`COMMIT` 已执行（`tx_final=COMMIT`，§2）。库当前 public schema 内容 = `migrations/0001..0017` 文件自身声明的 seed 基线。
2. **无备份可回灌**：本机**无 `pg_dump`**；本次唯一的"前状态"记录是脚本的 `A-pre-state.json`（事务外只读快照）与 `.p3x-artifacts/p3x-00-dry-20260928174808.-plain/A-pre-state.json`。
   **事务外快照 ≠ 可回灌备份** —— 它是观测（行数/行内容/catalog 指纹），既不含 DDL 全量导出，也无 append-only 守卫的绕过方案；用它回灌在技术上不成立。
3. **一次性清零（A → F，脚本 artifact 读数，`SUMMARY.json` → `F_net_zero.diffs` + `A-pre-state.json`）**：
   | 对象 | 前（A） | 后（F） |
   |---|---|---|
   | users | 673 | 0 |
   | account | 425 | 4 |
   | ledger_entry | 3239 | 0 |
   | referral | 349 | 0 |
   | currency | 132 | 1 |
   | commission_policy | 25 | 1 |
   | job | 110 | 0 |
   | job_application | 32 | 0 |
   | job_submission | 10 | 0 |
   | listing | 62 | 0 |
   | listing_order | 21 | 0 |
   | market_order | 68 | 0 |
   | market_trade | 19 | 0 |
4. **唯一的"序列不归零"**：`currency.cid` 序列 `last_value` 293 → 3（下一值 294 → 4），属预期（§3.5），**不得当漂移判负**。
5. 未触碰：`backend-ts/src/**`、`migrations/**`、`p3x-00-rebuild-replay.ts`、`scripts/migrate.ts`、既有 `.p3x-artifacts/**` / `.p3w-artifacts/**`、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/**`、既有 `docs/audit/p3-*.md`；无 `git add/commit/push`；未跑任何写库套件。

---

## §1 S0 前置只读

### S0a 闸结构核对（脚本内 COMMIT 处数）

命令：`grep -n "COMMIT\|canCommit\|gate.ok" backend-ts/scripts/p3x-00-rebuild-replay.ts`

读数（9 命中，其中**可执行的 COMMIT 只有 1 处**）：

- `792`：`const canCommit = mode === 'apply' && confirmIrreversible && gate.ok === true;`
- `794`：`if (canCommit) { await c.query('COMMIT'); final = 'COMMIT'; }` ← **全脚本唯一可执行 COMMIT，位于 `canCommit` 之下（792 行）**
- `796`：`gate.commit_allowed = canCommit;`
- `745/780/784/787/893`：闸的构造与打印（`gate.ok` 由六项合取得出，893 行 console 打印）
- `20/21/23/387`：**注释/说明文本**，非可执行语句（387 行为 `--expect-corrupt` 的 note 文案）
- `946`：`G_not_verified` 的说明字符串（dry-run 措辞）

结论：**未发现第二处 COMMIT，跑 apply 的前置条件成立**。此外 792 行的合取含 `confirmIrreversible`，本单命令行显式带 `--confirm-irreversible`。

### S0b 连接登记（`pg_stat_activity` 非本会话 + `idle in transaction`）

探针：`backend-ts/scripts/p3y-00-pre-conn-registry.ts`（只读；会话级 `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` + 仅 SELECT）
artifact：`backend-ts/.p3y-artifacts/p3y-00-pre-conn-20260929T010222Z.-plain/conn-registry.json`

读数（口径 = `WHERE pid <> pg_backend_pid()`；四列齐全 + xact_start/client_addr）：
- 本会话：`pid=3322`，`db=neondb`，`user=neondb_owner`，`PostgreSQL 18.6`
- **非本会话连接 = 10**；**`state LIKE 'idle in transaction%'` 的非本会话连接 = 0** ⇒ **VERDICT=CLEAR，未触发停手条件**
- 10 个连接全部为 Neon 平台内部后台（`neon_compute_sql_exporter`(idle)、`compute_ctl:compute_monitor`(idle)、`pg_cron scheduler`、`TimescaleDB Background Worker Launcher`、`vm-monitor`(idle)、4 个 `application_name` 为空且 `state` 为 NULL 的后台 worker），无应用侧长事务
- **未调用** `pg_terminate_backend` / `pg_cancel_backend`；未 kill 任何 PID

---

## §2 S1 执行（唯一一次破坏性命令）

- artifact run dir：**`backend-ts/.p3y-artifacts/p3x-00-apply-20260929011509.-plain/`**（9 文件：`A-pre-state.json`、`B-connections.json`、`C-replay-log.json`、`D-comparison.json`、`D-expectations-from-files.json`、`D-in-tx-state.json`、**`E-gate.json`**、`F-post-state.json`、`SUMMARY.json`）
- stdout 首行：`gate.ok=true reason=all gates green（replay_ok & 无注入 & checksums 全字节相等 & 对象集无差 & 逐值终态无失败 & 事务内快照已取）`
- **`E-gate.json` 逐项（事务内、COMMIT 之前得出）**：

| 字段 | 读数 |
|---|---|
| expect_corrupt | `false`（未用判负开关） |
| replay_ok | `true` |
| injected | `false` |
| checksums_all_byte_equal | `true` |
| snapshot_taken | `true`（事务内快照已取） |
| comparison_inside_tx | `true` |
| object_diffs_empty | `true`（`object_diffs: []`） |
| terminal_failed_empty | `true`（`terminal_failed: []`） |
| terminal_total / terminal_ok | `32` / `31`（唯一 N/M = `currency.supply_cap=NULL`，非失败） |
| **ok** | **`true`** |
| **commit_allowed** | **`true`** |
| **tx_final** | **`COMMIT`** |

- `SUMMARY.json`：`mode=apply`、`D_pass=true`、`D_comparison.object_diffs=[]`、`key_functions_md5_equal_to_prestate=true`、`B_connections={self_pid:726, others_count:0, idle_in_transaction_count:0, ungranted_locks_by_others:0}`（脚本自身视角：执行期内无并发会话抢锁）
- **退出码 = 5 —— 不是闸失败，读法与口径**：
  - 脚本 `964` 行 `if (!summary.F_net_zero.identical) code = 5;` **无条件**（不按 mode 分支）。apply 的目的就是让库变，故 `A_hash=699ac94d8fa048f8de99f0a20b1951b4c5fed2f1ec98f4c2003d33136d3cdb41` ≠ `F_hash=35913c096edbe76aa549a5eabf5a4b1e62810390a1bc7806963496feeac3a9d3`（`diff_count=24`）**必然**导致 exit 5。
  - `962` 行（`log.replay_error` ⇒ 4）与 `963` 行（`D_pass===false` ⇒ 3，实测 `D_pass=true`）**均未触发** ⇒ 5 不是闸判负。
  - **反向独立旁证**：若 `gate.ok=false`，794 行会走 `ROLLBACK`，事务外 `F` 必然与 `A` 一致；实测 `F ≠ A` 且 `F` 内容 = 重建终态（见 §3 的独立读数：users 0 / account 4 / currency 1 / registry applied_at = 01:15:27Z），⇒ **COMMIT 确实落库**。
  - 口径声明：脚本头部退出码表未为 apply 模式单列 0；本条按"964 行无条件 + F/A 内容差异"判定，**未按 exit code 判负**，也**未重试硬闯、未改脚本、未降级 `--expect-corrupt`**。

---

## §3 S2 事后独立只读对拍

探针：**`backend-ts/scripts/p3y-01-post-apply-verify.ts`**（新建，独立于脚本自身结论）
- 只读保证：单连接 `Client` + `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` + 全脚本无 DML/DDL + 序列**只用** `SELECT last_value,is_called`（**未调用 `nextval`**）
- 连接：`@neondatabase/serverless` `Client`（非 Pool）、`DATABASE_URL_UNPOOLED`（非 pooler）
- **run tag：`p3y-01-post-apply-20260929T011919Z.-plain`（exit 0，24/24 PASS，NOT_MEASURED=0）**
  - 同目录另有首轮 `p3y-01-post-apply-20260929T011705Z.-plain`（exit 3，1 项 FAIL，**原因是探针自身口径错**，见 §7 修正记录；保留原样不删）
- 保留字命名对象一律加引号查询（`public."users"` / `public."schema_migration"` 等），未出现无引号 `FROM user`。

### §3.1 逐值终态（24 项中 16 项属本组，全 PASS）

| 项 | 期望 | 实测 |
|---|---|---|
| `currency` 行数 | 1 | **1** |
| `currency` 唯一行 | cid=1, symbol=`$`, total_supply=0, status=listed | **cid=1, symbol=`$`, name=平台积分, owner_uid=0, decimals=0, total_supply=0, supply_cap=NULL, status=listed, listed_at NOT NULL=true** |
| `ledger_owner` 行数 | 4 | **4**（uid 升序 -3/-2/-1/0） |
| `ledger_owner` 逐行 | uid/名字/owner_type 逐字 | **-3 罚没账户 / -2 佣金池 / -1 手续费归集账户 / 0 平台主体，owner_type 全 = platform** |
| `account` | 全表 4；uid≤0 行 4（cid=1 且 balance=0 且 frozen=0） | **全表 4；uid≤0 distinct uid=4；违例（cid≠1 或 balance≠0 或 frozen≠0）行 = 0** |
| `commission_policy` | 1 行且 policy_id=1 | **1 行，policy_id=1** |
| `users`/`referral`/`ledger_entry`/`job`/`job_application`/`job_submission`/`listing`/`listing_order`/`market_order`/`market_trade` | 全 0 | **全 0（10/10）** |
| 0017 六表 `app_config`/`admin_role`/`admin_permission`/`admin_role_permission`/`admin_user_role`/`currency_status_log` | 全 0 | **全 0（6/6）** |
| `schema_migration` | 17 行 | **17** |

### §3.2 对象集对拍

派生口径（写死在探针里，artifact `object-set.json`）：对 `migrations/0001..0017` **原文**做 `stripSql()`（剥 `--` 行注释 / `/* */` 块注释 / 单引号字面量 / 美元引用体）后按正则抽取 `CREATE [OR REPLACE] TABLE|VIEW|FUNCTION|PROCEDURE|TRIGGER|SEQUENCE` 的对象名（去 `public.` 与引号），按名去重；再应用**文件内自身的静态改名**（正则 `ALTER TABLE x RENAME TO y`，覆盖 `DO/EXECUTE` 里的字符串形式）——本库 `0006_user_to_users.sql` 把 `"user"` 改为 `users`（该改名在 `0006:75` 的 `EXECUTE` 内，属文件自身声明，非我引入）。

| 类别 | 文件期望（去重） | 实测 | missing | extra（未解释） |
|---|---|---|---|---|
| TABLE | 20 | 21 基表 | **[]** | **[]**（`extra_known=["schema_migration"]`：registry 表，由 `scripts/migrate.ts` 创建，**不在任何迁移文件内**） |
| VIEW | 1（`candle_view`） | 1 | **[]** | **[]** |
| FUNCTION | 74 | 74（`pg_proc` 原始行数亦 74） | **[]** | **[]** |
| PROCEDURE | 0 | 0 | **[]** | **[]** |
| TRIGGER | 43 | 43（非 internal） | **[]** | **[]** |
| SEQUENCE | 文件内 `CREATE SEQUENCE` = 0 ⇒ 名字不可派生 | 13 | 数量：`IDENTITY 声明 12 + SERIAL 声明 0 + 1 bootstrap = 13` = 实测 13 ✔ | —（**名字级比对 = NOT_MEASURED**，见 §7） |

空数组口径说明：`missing=[]` 表示"文件声明要在的对象一个不缺"；`extra_unexplained=[]` 表示"实测多出的对象已全部解释"（本 run 唯一多出者是 `schema_migration`，来源已指名）。

### §3.3 注册表 checksum（17/17 逐字节，**我自己重算，未引用脚本结论**）

口径：`public."schema_migration"` 每行 `name` → 本地 `crypto.createHash('sha256').update(fs.readFileSync(migrations/<name>))`，与库内 `checksum` 逐字节比较。
读数：**`byte_equal_count = 17/17`，`all_equal = true`**（artifact `checksums.json`）。
注：`0013` 现登记名 = `0013_job.sql`（与磁盘文件名一致；旧 registry 曾记 `0013_job_core.sql`），sha256 仍逐字节相等。

### §3.4 触发器 / 基表 / 视图计数

- public **非 internal 触发器 = 43**（口径 `pg_trigger JOIN pg_class JOIN pg_namespace WHERE nspname='public' AND NOT tgisinternal`）
- 其中 **`tgenabled <> 'O'` = 0**（即 43 个全部启用）
- public **基表 = 21**（口径 `information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`；= 文件期望 20 + `schema_migration`）
- public **视图 = 1**（口径 `information_schema.tables table_type='VIEW'`）
- 序列 13（口径 `pg_class.relkind='S'`）：`commission_policy_policy_id_seq`, `currency_cid_seq`, `currency_status_log_log_id_seq`, `job_application_application_id_seq`, `job_job_id_seq`, `job_submission_submission_id_seq`, `ledger_entry_txid_seq`, `listing_listing_id_seq`, `listing_order_order_id_seq`, `market_order_order_id_seq`, `market_trade_trade_id_seq`, `schema_migration_id_seq`, `users_uid_seq`

### §3.5 `currency.cid` 序列下一值（只读推断）

- 读数（`SELECT last_value, is_called FROM public."currency_cid_seq"`，**未 nextval**）：**`last_value=3`, `is_called=true` ⇒ 下一值 = 4** ✔（期望 4）
- pre-state（`.p3x-artifacts/…174808.-plain/A-pre-state.json`）：`last_value=293`, `is_called=true` ⇒ 下一值 294
- **差异属预期、不当漂移判负**，口径：`0011:413` / `0012:1180` 各有一句**无 `cid`** 的 `INSERT INTO currency`，位于"子事务 + 哨兵回滚"块内 ⇒ **行回滚但序列推进不撤**；`0001` 显式给 `cid=1` 且 `setval(pg_get_serial_sequence('currency','cid'), 1, true)` ⇒ 重建后下一值 = 4。

### §3.6 关键函数 `md5(prosrc)` 与 pre-state 比对

口径：`md5(p.prosrc)`（与 `A-pre-state.json` 的 `key_functions_md5` 同口径）——**5/5 逐字节相等**：

| 函数 | md5(prosrc) 现在 | = pre-state |
|---|---|---|
| `ledger_post_event` | `d94dd902697dfe60aba409d808c6d63a` | ✔ |
| `job_post_event` | `0cedbb9ea60dcbda28e3ef3dafdd119b` | ✔ |
| `listing_post_event` | `0e187c20b56d45202d83978c8a02b31d` | ✔ |
| `market_post_event` | `74841611252726e1cc0f57cb46ea6c6d` | ✔ |
| `ledger_assert_commission_conservation` | `27ddc76b842594cb6ee8673c171e6526` | ✔ |

### §3.7 残留命名空间扫描（只读）

- 口径：needle 扫描**只覆盖"行数>0 的 public 基表"**的 text/varchar 列（重建后 21 表中非空者仅 5 张：`account`, `commission_policy`, `currency`, `ledger_owner`, `schema_migration`；共 9 个文本列 × 6 needle = **54 次 count 查询**）
- needle：`cli:`, `p3p:`, `p3q:`, `p3x:`, `p3y:`, `99xxx` ⇒ **命中 = `[]`（0）**
- uid 窗口（`left(uid::text,4) = ANY(['9903','9904','9905','9906','9907','9908'])`，样本 6 前缀）：`users.uid` = 0 行、`account.uid` = 0 行、`currency.owner_uid` = 0 行
- 口径固有限制：空表无行，**不扫**（已按"非空表"显式限定，故非"全库全列"结论）。

---

## §4 S3 `migrate` 复核

- 命令：`cd backend-ts && npx ts-node --transpile-only scripts/migrate.ts`
- **退出码 = 0**；stdout 为 JSON：`"ok": true`
- **`applied_now` 长度 = 17，`action` 全部 = `"skipped"`（17/17）**，`reason` 全部 = `"already applied, checksum match"`，`applied_at` 全部 = `Tue Sep 29 2026 09:15:27 GMT+0800`（= 本次重建的 COMMIT 时刻）
- **未 apply 任何文件**（若 apply 则 `action` 会变为执行态；实测无）⇒ 未触发停手条件
- 附：同次输出还列出 public 基表 21 张（与 §3.4 独立读数一致，互为旁证）

---

## §5 S4 `seafood-api`（PID 6480 / 5788）只读观测 + 建议

- **进程**：`ps -p 6480` ⇒ `node …/node_modules/.bin/ts-node src/index.ts`，`STAT=S`，`ELAPSED=33:23`（**未重启、未 kill、未 terminate**）
- **监听**：`lsof -nP -iTCP:5788 -sTCP:LISTEN` ⇒ `node 6480 … TCP *:5788 (LISTEN)`
- **HTTP 观测**（全部只读 GET）：

| 端点 | 状态码 | 备注 |
|---|---|---|
| `/` | **200** | 路由 `src/index.ts:175` |
| `/health` | **200** | body：`{"ok":true,"db_version":"PostgreSQL 18.6 …","schema_version":"0017","time":"2026-09-29T01:20:25.989Z"}` ⇒ **服务到 DB 的连接可用，且它自报 schema_version=0017** |
| `/api/health`、`/api/status`、`/healthz`、`/api/v1/status`、`/status` | 404 | 本服务无这些路由（口径：404 = 路由不存在，非"服务不可用"） |
| `/api/prize/all` | **500** | `{"success":false,"message":"Failed to load prizes"}` |
| `/api/home` | **500** | `{"success":false,"message":"Failed to load home payload"}` |
| `/api/user` | **401** | 需鉴权（预期） |

- **建议 / 归因（交由派单方处置）**：
  1. 重建让 `seafood-api` 的预备语句 / 计划缓存 / 关系缓存**可能失效**；`/health` 仍 200 说明连接与 schema 可见性正常，**但 `/api/prize/all`、`/api/home` 返回 500**。本单**无法**区分这两种原因：(i) 重建后 seed 基线内业务数据为空（数据形状导致的 500，属重建预期后果）；(ii) 缓存/预备语句失效（处置 = 由派单方重启该服务）。
  2. **归因 NOT_MEASURED**：我**没有**重建前对同名端点的读数（重建不可逆，已无法补测），故不声称"500 是重建引起"或"500 早已存在"。
  3. 本单**未重启、未停、未 terminate** 该服务（依硬边界）；是否重启请派单方决定。

---

## §6 未验证清单（NOT_MEASURED，**不填 0 / 空数组**）

1. **回滚/回灌能力 = NOT_MEASURED 且判定为"不存在"**：本机无 `pg_dump`，`A/F` 快照是观测不是可回灌备份（§0.2）。
2. **重建期间与在线服务（`seafood-api`）的真实并发锁竞争 = NOT_MEASURED**：脚本 B 段快照显示 `others_count=0`（执行瞬时窗口），这不等于整个 6 分钟窗口无竞争；未在负载下压测。
3. **重建后应用层端到端可用性 = NOT_MEASURED**：只做了 HTTP 只读观测（§5），未跑任何写库/业务流；`/api/prize/all`、`/api/home` 500 的根因 = NOT_MEASURED。
4. **序列名级期望比对 = NOT_MEASURED**：迁移文件内 `CREATE SEQUENCE` 语句 = 0，序列名不可由声明派生，故只做数量对拍（13=13）。
5. **`currency.supply_cap`**：期望 NULL 与"未取到"不可区分 ⇒ 脚本侧记为 NOT_MEASURED（我的探针单独读到 `supply_cap=NULL` 且 `listed_at NOT NULL`，作为信息记录，不作判负项）。
6. **Neon 平台侧分支 / PITR 能力 = NOT_MEASURED**（超出本机工具面；也无证据表明已开）。
7. **needle 残留扫描的覆盖面 = 有限**：只扫了 5 张非空表的 9 个文本列（空表不扫）；**未**做"全库所有文本列"结论。
8. **服务器重启后的一致性 = NOT_MEASURED**（未重启，故未观测冷启动行为）。
9. **本机 `timeout`/`gtimeout` 缺失**（未安装）⇒ 未对任何命令施加外部限时；脚本内 `statement_timeout=300s` / `lock_timeout=20s` 是 DB 侧，不是进程墙钟限时。

---

## §7 探针自曝（口径 / 样本量 / 弱点 / 修正记录）

1. **首轮探针 FAIL 的自我归因（§5.7④）**：`p3y-01-…011705Z` 报 `ledger_owner.rows` FAIL。核查后 = **探针口径错**：DB `ORDER BY uid` 返回 `-1,-2,-3,0`，而我把期望数组按 seed 书写顺序写成 `0,-1,-2,-3`，直接字符串比较 ⇒ 误报。**数据本身正确**（4 行的 uid/name/owner_type 逐字都对）。修正：两侧按 uid 数值升序规范化后比较，并把该修正记录写进 artifact 的 `note` 字段。两轮 run 均保留，不删。
2. **对象集抽取是正则 + 词法剥离，不是 SQL 解析器**：若某迁移在 `DO`/`EXECUTE` 里**动态**建对象会被漏；本 run 未出现（也与实测计数相合）。`0006` 的 `"user"→users` 改名在 `EXECUTE` 字符串内，我专门用独立正则从**原文**（未剥离字符串）抽取并记录于 `renames_from_files`（出现 2 次重复，因该文件内有两句同类 `ALTER TABLE`）。
3. **函数比对按 `proname` 去重 + `pg_get_function_identity_arguments`**：重载会被折叠；本 run `pg_proc` 原始行数 = 74 = 名字数 74，无折叠损失。`md5(prosrc)` 口径与 `A-pre-state.json` 一致（不比对 `pg_get_functiondef`，避免 owner/ACL 差异干扰）。
4. **触发器口径**：只数 `NOT tgisinternal`（含 internal 会得到 175 级读数，属口径错）。
5. **needle 扫描样本量**：见 §3.7（54 次查询 / 9 列 / 5 表 / 6 needle）。
6. **`F`/`A` 哈希不等不是判负项**（apply 目的），本报告只把它当作"COMMIT 已落库"的旁证之一。
7. **run 归属**：本报告所有"实测"读数都能在**本单自己的 artifact** 中 grep 到 —— 脚本侧在 `.p3y-artifacts/p3x-00-apply-20260929011509.-plain/**`，探针侧在 `.p3y-artifacts/p3y-01-post-apply-20260929T011919Z.-plain/**`、`.p3y-artifacts/p3y-00-pre-conn-20260929T010222Z.-plain/**`；`.p3x-artifacts/…174808.-plain/**` 仅作 pre-state 只读引用（未改未删）。
8. **连接串 redact**：全部产物做 `postgres(ql)://` → `[REDACTED]`；收尾检查 `grep -rlE 'postgres(ql)?://' backend-ts/scripts/p3y-*.ts backend-ts/.p3y-artifacts/ docs/audit/p3-d20-rebuild-apply.md` ⇒ **命中文件数 = 0**。
9. **未使用**：`Pool`、`DATABASE_URL`(pooler)、`execute_code`、`pkill -f`/`killall`、`pg_terminate_backend`/`pg_cancel_backend`、`git add/commit/push`、`npm install`、长驻 server、任何写库套件（`p1o-00`/`p2w-00`/`p3*` 一个未跑）。

---

## §8 交付物清单

- 新建探针：`backend-ts/scripts/p3y-00-pre-conn-registry.ts`（S0b 只读连接登记）、`backend-ts/scripts/p3y-01-post-apply-verify.ts`（S2 只读事后对拍）
- 新 artifact（run-tagged，同名拒写）：
  - `backend-ts/.p3y-artifacts/p3x-00-apply-20260929011509.-plain/**`（脚本 apply run，9 文件）
  - `backend-ts/.p3y-artifacts/p3y-00-pre-conn-20260929T010222Z.-plain/conn-registry.json`
  - `backend-ts/.p3y-artifacts/p3y-01-post-apply-20260929T011919Z.-plain/**`（`value-checks.json`/`object-set.json`/`checksums.json`/`catalog-facts.json`/`sequence.json`/`key-functions.json`/`ns-scan.json`/`POST-APPLY-REPORT.json`）
  - `backend-ts/.p3y-artifacts/p3y-01-post-apply-20260929T011705Z.-plain/**`（首轮口径错 run，保留）
- 本报告：`docs/audit/p3-d20-rebuild-apply.md`
- 未改：`backend-ts/src/**`、`backend-ts/migrations/**`、`backend-ts/scripts/p3x-00-rebuild-replay.ts`、`backend-ts/scripts/migrate.ts`、既有 `.p3x-artifacts/**`、`.p3w-artifacts/**`、`docs/` 内既有文件

**终局判读（一句话）**：`gate.ok=true` / `commit_allowed=true` / `tx_final=COMMIT`，事务外独立探针 24/24 PASS（NOT_MEASURED=0），库 = `0001..0017` seed 基线（checksum 17/17、对象集无差、触发器 43/非 O 0、序列下一值 4），`migrate` 17/17 `skipped` exit 0；**不可逆已生效，无回滚路径**。
