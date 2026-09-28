# P3-D20 重建重放 dry-run（本单：P3-D20-REBUILD-DRYRUN / Unit C-Phase1 / Kong）

**结论（一句话）**：在**单事务**内 `DROP SCHEMA public CASCADE` → `CREATE SCHEMA public` → 按序重放 `migrations/0001..0017` 原文 → 全量期望对拍**成立**（对象集与逐值终态 31/32 通过、1 项 NOT_MEASURED、0 项失败），随后 **`ROLLBACK`**，事务外复核 **pre-state 与 post-state 逐值相同（净零变化）**；注入失败演练证明事务**整体中止**且库未被破坏。**未执行 `--apply`、未 COMMIT。**

- 驱动脚本：`backend-ts/scripts/p3x-00-rebuild-replay.ts`（默认 `--dry-run`）
- artifacts：`backend-ts/.p3x-artifacts/<run_tag>/**`
- 本报告：`docs/audit/p3-d20-rebuild-dryrun.md`

---

## 0. 运行元信息（run-tagged）

| run_tag | 参数 | 退出码 | 事务收尾 | D 对拍 | F 净零 |
|---|---|---|---|---|---|
| `p3x-00-dry-20260928174808.-plain` | `--dry-run`（默认） | `0` | **`ROLLBACK`** | `D_pass=true` | `identical=true` |
| `p3x-00-dry-20260928174912.-inject0010` | `--inject-fail-after=0010` | `0` | **`ROLLBACK`** | `NOT_MEASURED`（按设计中止） | `identical=true` |
| `p3x-00-dry-20260928174551.-plain` | `--dry-run`（探路 run，**已被取代**） | `3` | **`ROLLBACK`** | 见 G③ 探针缺陷 | `identical=true` |

- 连接：`@neondatabase/serverless` **`Client`（单连接）** + `ws`；`url_source=` `DATABASE_URL_UNPOOLED`；`pooler_used=false`；`url="[REDACTED]"`（连接串未落盘）。
- Node `v18.19.0`；`version_order_ok=true`（文件序 = `0001..0017`）。
- 三个 run 的 **pre-state 哈希完全相同**：`699ac94d8fa048f8de99f0a20b1951b4c5fed2f1ec98f4c2003d33136d3cdb41`（跨 run 一致 ⇒ 前序 run 未改动库）。

---

## A. pre-state 快照（事务外，21 张业务表逐表计数）

`public` 基数表 = **21** = **20 张业务表 + `schema_migration`**。
（口径注：brief 写「21 张业务表」，本探针把 `schema_migration` 单列，故业务表读数 = 20；`public` 基数表总数 = 21，两者都如实登记。）

| 表 | 行数 | 表 | 行数 |
|---|---|---|---|
| `users` | **673** | `listing` | 62 |
| `account` | **425** | `listing_order` | 21 |
| `ledger_entry` | **3239** | `market_order` | 68 |
| `referral` | **349** | `market_trade` | 19 |
| `currency` | **132** | `ledger_owner` | 4 |
| `commission_policy` | **25** | `currency_status_log` | 0 |
| `job` | **110** | `app_config` | 0 |
| `job_application` | **32** | `admin_role` / `admin_permission` / `admin_role_permission` / `admin_user_role` | 0 / 0 / 0 / 0 |
| `job_submission` | **10** | `schema_migration` | **17** |

（与 Zang 的只读盘点逐值一致：673/425/3239/349/132/25/110/32/10/62/21/68/19/4。）

- `schema_migration` = **17 行**（逐行 `version/name/checksum/applied_at` 见 `A-pre-state.json`）；17 行的 `checksum` 与本次逐文件 sha256 **逐字节相等**（见 C 段，17/17）。
- catalog（`public`）：基数表 `21`、视图 `1`、物化视图 `0`、**序列 `13`**、索引 `56`、函数 `74`（`functions_all=74`，无 `prokind='p'`）、存储过程 `0`。
- 5 个关键函数 `md5(prosrc)`：
  - `job_post_event(jsonb)` = `0cedbb9ea60dcbda28e3ef3dafdd119b`
  - `ledger_assert_commission_conservation()` = `27ddc76b842594cb6ee8673c171e6526`
  - `ledger_post_event(jsonb)` = `d94dd902697dfe60aba409d808c6d63a`
  - `listing_post_event(jsonb)` = `0e187c20b56d45202d83978c8a02b31d`
  - `market_post_event(jsonb)` = `74841611252726e1cc0f57cb46ea6c6d`
- 触发器（非 internal）= **43**，其中 `tgenabled <> 'O'` = **0**（43/43 全 `'O'`）。
- `currency` 全表 132 行；`cid=1`：`symbol='$'`、`name='平台积分'`、`owner_uid=0`、`decimals=0`、`status='listed'`、`supply_cap=NULL`，但 **`total_supply=8400`**（≠ 0 ⇒ D20 残差已污染平台单位发行量）。
- `Σ(account.balance+frozen)` = **378298107**（D20 在飞余额）；`account` 全表 425 行，其中 `balance=0 AND frozen=0` 的 133 行；`cid=1 ∧ uid<=0 ∧ (0/0)` 的 **3** 行。
- `ledger_owner` 4 行：`-1 手续费归集账户` / `-2 佣金池` / `-3 罚没账户` / `0 平台主体`。
- `commission_policy` policy_id = `1,20..37,75..80`（25 行）。
- `currency_cid_seq`：`last_value=293`、`is_called=true` ⇒ 下一值 **294**（`probe=` 只读 `SELECT last_value,is_called`，**未 nextval**）。

---

## B. 连接登记（`pg_stat_activity`，事务外）

主 run：`self_pid=948`；注入 run：`self_pid=1127`。两次一致：

- 非本会话连接数 **`others_count=0`**（`others=[]`）
- **`idle_in_transaction_count=0`**（`idle_in_transaction=[]`）
- 其他会话未授予锁 `ungranted_locks_by_others=0`

⇒ 未触发铁律 3（无 `idle in transaction`、无锁阻塞），故 `DROP SCHEMA` 未被阻塞（实测耗时见 C 段）。全程**未使用** `pg_terminate_backend` / `pg_cancel_backend`，**未**重启或停任何服务。

---

## C. 事务内重放日志（逐文件 before/after + sha256 vs registry checksum）

事务骨架（全部在**同一** `Client` 会话内）：

1. `BEGIN`
2. `SET LOCAL lock_timeout='20s'`、`SET LOCAL statement_timeout='300s'`
3. `DROP SCHEMA public CASCADE`
4. `CREATE SCHEMA public`
5. bootstrap `schema_migration`（镜像 `migrate.ts` 的 `BOOTSTRAP`；重建后 `bootstrap_row_count=0`）
6. 逐文件重放 `0001..0017`（**原文**，每个文件执行后由驱动写入该文件的版本行）
7. 事务内全量快照 + 期望对拍（D 段）
8. `ROLLBACK`（`tx_final="ROLLBACK"`）

| 文件（version/name） | sha256(file) | registry checksum 逐字节相等 | `schema_migration` before→after | ok |
|---|---|---|---|---|
| 0001_ledger_core.sql | `4f902d3c47508d91826925a46765ad728b1a5a9c2773d0fc1c0f2c1e8e2451a4` | ✅ | 0→1 | ✅ |
| 0002_user_identity.sql | `688b1935f6bc3006b545ca158ca97324256a117e4f86e69c09bda8bbb01c5990` | ✅ | 1→2 | ✅ |
| 0003_kind_close_set_20.sql | `f268e03075eb4bf46d58766412fc5b53d8f8841d4cac175a3f96c440e8730a23` | ✅ | 2→3 | ✅ |
| 0004_ledger_post_event.sql | `55fd1ce8085bd3b3ef77f86c35f07d3b9f9c9157ee9ce0cf05f2733033e9c932` | ✅ | 3→4 | ✅ |
| 0005_ledger_event_root_key.sql | `4de12361cf7df2038438d79200fbca68de4f57821e324a2ce0681bae439f0231` | ✅ | 4→5 | ✅ |
| 0006_user_to_users.sql | `4aa19b1487000d44b6a2961f2ea6ac2f598745af5d9186dbc881c4ea997c0c47` | ✅ | 5→6 | ✅ |
| 0007_referral_and_commission_policy.sql | `7044c6be33f7421a9659c4f7e684c887e1f90709e6a179c7f55aac253bd7b34a` | ✅ | 6→7 | ✅ |
| 0008_platform_revenue_job_fee.sql | `e98ac1a0470e90446c4be710921fc048f80a0067bcaf28d92c3ee4c7446b2210` | ✅ | 7→8 | ✅ |
| 0009_ledger_error_reverse_map_complete.sql | `6688e2ce35c67d5bd74b1e573625d17e1ef62789ef3d29e92437f22cb33c3870` | ✅ | 8→9 | ✅ |
| 0010_referral_bind_protocol_guard.sql | `73e7ac8b6fd426558faf2802876ab7b9be83db8cb73295944e66000c614551dc` | ✅ | 9→10 | ✅ |
| 0011_commission_assert_closure_and_referral_depth_guard.sql | `238f96ae42298f85c03ffe08973eccb01bc560b9751ac752af769154f2583dfe` | ✅ | 10→11 | ✅ |
| 0012_replay_pre_gate_before_balance_gate.sql | `2a64483f944f16e3364be822e5ff61e0b95afa0168f937ce5aac6671b561dcbe` | ✅ | 11→12 | ✅ |
| 0013_job.sql | `720c89e4a9367d562fa1085f1fb8b139d5a4374be095fec4893a0e9db818c230` | ✅ | 12→13 | ✅ |
| 0014_job_flow.sql | `a33798336adc7053e4bcbf06cb652b1fb57dcbf49edea324c5977830f47a162d` | ✅ | 13→14 | ✅ |
| 0015_listing.sql | `f856a1316e9d3bc79c3b54b89c63273102ce87733ef1c9a835c81f1b9a56624e` | ✅ | 14→15 | ✅ |
| 0016_market.sql | `f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df` | ✅ | 15→16 | ✅ |
| 0017_platform_config.sql | `0aaba855b1d5eb4c69b6b2c880b225df2053af7353f7c7b290f233006cbb1fcd` | ✅ | 16→17 | ✅ |

- `replay_ok=true`、`replay_error=null`、`checksum_all_byte_equal=true`（**17/17**）、`in_tx_snapshot_error=null`。
- 17 个文件全部**零报错**（故无「原始错误文本 + 文件 + 行号」可记；该通道由 E 段的注入演练实际验证过：`P0001` + `statement` + `tx_state_after_failure`，探针会记录 `message/code/detail/where/hint/position/line_in_file`）。
- 逐文件 `ms` 见 `C-replay-log.json`（本报告不另行摘录）。

---

## D. 事务内期望对拍（期望**由迁移文件自身推导**，非现库计数）

### D1 对象集（文件解析 vs 事务内实测）

| 类别 | 文件派生期望 | 事务内实测 | missing | extra |
|---|---|---|---|---|
| TABLE（业务表，排除 `schema_migration`） | **20** | **20** | `[]` | `[]` |
| VIEW | **1** (`candle_view`) | **1** | `[]` | `[]` |
| FUNCTION（按 proname 去重） | **74** | **74** | `[]` | `[]` |
| PROCEDURE | **0** | **0** | — | — |
| TRIGGER（非 internal） | **43** | **43** | `[]` | `[]` |
| SEQUENCE | **13** = IDENTITY 声明 12 + SERIAL 声明 0 + bootstrap 1 | **13** | — | — |

- `object_diffs = []`（**逐名集合**全等，无缺失/多余）。
- catalog 实测：基数表 `21`（= 20 业务表 + `schema_migration`）、视图 `1`、序列 `13`、函数 `74`、过程 `0`、索引 `56`。
- 文件派生口径：`stripSql()` 词法剥离 `--`/`/* */` 注释、单引号与 `$$` 体后按 token 抽 `CREATE {TABLE|VIEW|FUNCTION|PROCEDURE|TRIGGER|SEQUENCE|...}`，再按 `RENAME TO` 回代（`0006`：`user`→`users` 等）。

### D2 逐值终态（`terminal_total=32`，`terminal_ok=31`，`terminal_failed=[]`，`terminal_not_measured=["currency.supply_cap=NULL"]`）

| 项 | 期望（文件派生） | 实测（事务内） | ok |
|---|---|---|---|
| `currency` 行数 | 1 | 1 | ✅ |
| `currency` cid=1（逐值） | `cid=1,symbol='$',name='平台积分',owner_uid=0,decimals=0,total_supply=0,status='listed'`（取自 `0001 §13` 的 `INSERT` 字面量） | 同左（**`total_supply=0`**） | ✅ |
| `currency.status` | `listed` | `listed` | ✅ |
| `currency.supply_cap` | `NULL` | `NULL` 与「未取到」不可区分 ⇒ **NOT_MEASURED** | ⚪ |
| `ledger_owner` 行数 / 逐 uid+name | 4 / 取自 `0001 §13` 字面量（`0 平台主体`、`-1 手续费归集账户`、`-2 佣金池`、`-3 罚没账户`） | 4 / 逐字相同（顺序无关比较） | ✅ |
| `account` 行数 | 4 | 4 | ✅ |
| `account` `cid=1 ∧ uid<=0 ∧ 0/0` | 4 | 4 | ✅ |
| `account` 全表 0/0 | 4 | 4 | ✅ |
| `Σ(account.balance+frozen)` | 0 | **0** | ✅ |
| `commission_policy` | 1 行、`policy_id=1`（`0007` seed，自带自检） | 1 行、`policy_id=1` | ✅ |
| `users` / `referral` / `ledger_entry` | 0 / 0 / 0 | **0 / 0 / 0** | ✅ |
| `job` / `job_application` / `job_submission` / `listing` / `listing_order` / `market_order` / `market_trade` | 全 0 | **全 0** | ✅ |
| `0017` 六表（`app_config`/`admin_role`/`admin_permission`/`admin_role_permission`/`admin_user_role`/`currency_status_log`） | 全 0 | **全 0** | ✅ |
| `schema_migration` | 17 | **17** | ✅ |
| 非 internal 触发器 / 非 `'O'` | 43 / 0 | **43 / 0** | ✅ |
| 5 个关键函数 `md5(prosrc)` | — | 与 pre-state **逐字节相同**（`key_functions_md5_equal_to_prestate=true`） | ✅ |
| `currency.cid` 序列下一值 | 见 ★ | **4** | ✅（口径见 ★） |

### ★ D 段**唯一与 brief 预置口径不等**的项：`currency.cid` 下一值

- brief 预置期望：**2**（仅据 `0001 §13` 的 `setval(pg_get_serial_sequence('currency','cid'),1,true)`）。
- 事务内实测：**4**（`seq_name=public.currency_cid_seq`、`last_value=3`、`is_called=true`）。
- 差额 **+2** 已定位到迁移文件自身（**不是库污染**）：
  - `0011_commission_assert_closure_and_referral_depth_guard.sql:413` — `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at) … RETURNING cid INTO v_cid`（**列清单无 `cid`** ⇒ 走 IDENTITY 序列；该自检在**子事务**内，回滚**不撤销**序列推进）
  - `0012_replay_pre_gate_before_balance_gate.sql:1180` — 同上（`'0012 self-check probe'`，同样子事务回滚、零残留）
- 故本探针把期望改为**文件派生**：`setval 下限(2) + Σ(无 cid 的 INSERT INTO currency 次数)(2) = 4`，并把预置口径 2 作为 `note` 与 `seed_expectations.currency_cid_nextval_theory_from_0001_only` 一并留档。
- **对照量**：pre-state 该序列 `last_value=293`（下一值 294）。⇒ 重建会把 `currency_cid_seq` 由 293 拉回 3，**这是有意的**（D20 残差清空），但它宣告：**「重建后逐值回到 spec 基线」对序列不成立**（序列推进不可回滚 / 不可重放复现），Phase 2 后 **序列值 ≠ pre-state**，任何依赖序列历史值的下游假设都会受影响。

---

## E. ★ 注入失败演练（判负自证）

命令：`--inject-fail-after=0010`（在第 10 个文件**之后**执行必然失败语句）。
run_tag：`p3x-00-dry-20260928174912.-inject0010`；退出码 `0`。

1. 事务内**已部分重建**（注入前实测，证明确实动过库）：`in_tx_state_before_inject = { currency_rows: "1", users_rows: "0", schema_migration_rows: "10" }`
2. 注入语句：`DO $$ BEGIN RAISE EXCEPTION 'p3x drill: intentional failure after 0010_referral_bind_protocol_guard.sql'; END $$;`
   → 错误：`{ "code": "P0001", "severity": "ERROR", "message": "p3x drill: intentional failure after 0010_…" }`
3. 事务**整体中止**的硬证据：中止后再执行 `SELECT 1` →
   `tx_state_after_failure = "REJECTED code=25P02 msg=current transaction is aborted, commands ignored until end of transaction block"`
4. 收尾：`tx_final = "ROLLBACK"`。
5. **事务外复核 pre-state 未被破坏**：同一探针重跑 → `F_net_zero.identical = true`、`diff_count = 0`，且 `A_hash == F_hash == 699ac94d8fa048f8de99f0a20b1951b4c5fed2f1ec98f4c2003d33136d3cdb41`（与主 run 的 pre-hash 相同 ⇒ 注入 run 中止后库与 A 段**逐值相同**）。

⇒ 本项成立：**事务整体中止 + 库未被破坏**。

---

## F. `ROLLBACK` 后 post-state（净零变化证明）

同一探针（与 A **完全相同**的参数与 SQL）在 `ROLLBACK` 之后重跑：

| run | `identical` | `diff_count` | A_hash | F_hash |
|---|---|---|---|---|
| 主 run（plain） | **true** | 0 | `699ac94d…3cdb41` | `699ac94d…3cdb41` |
| 注入 run | **true** | 0 | `699ac94d…3cdb41` | `699ac94d…3cdb41` |

`F_net_zero.diffs = []` ⇒ 21 张表逐表计数、17 行 `schema_migration`（含 `applied_at`）、catalog 计数、43 个触发器、5 个函数 `md5`、`currency` 逐值、`Σ(account)`、序列 `last_value` **全部逐值相同**。

**事务外零写库**：为了不产生偶发写，序列下一值用**只读** `SELECT last_value,is_called` 推断（**未 `nextval`**）；全程无 `DELETE`/`TRUNCATE`/`UPDATE`、无 `CREATE`/`ALTER`/`DROP` 落在事务外。三个 run 的 pre-hash 一致，也从侧面证明「跑一次 dry-run 不改变库」。

---

## G. 未验证清单（NOT_MEASURED）与探针缺陷自曝

### G1 NOT_MEASURED（凡未测一律登记，不填 0/空数组）

1. `--apply`（真实重建 / Phase 2）：**未执行**（未获授权）。
2. `currency.supply_cap` 逐值：NULL 与「未取到」不可区分 ⇒ `NOT_MEASURED`（唯一 `terminal_not_measured` 项）。
3. 重建期间与在线服务（`seafood-api` 等）的**真实并发锁竞争**：未在负载下压测；仅有 B 段「零其他会话」的静态快照。
4. **回滚后备库可回灌性**：`NOT_MEASURED` —— 本机**无 `pg_dump`**，A/F 是**观测快照**，**不是可回灌备份**（忠实回灌需绕过 `append-only`/`no_delete` 守卫）。
5. 重建后**应用层端到端**可用性（`backend-ts/src/**`）：`NOT_MEASURED`（本单只做数据层）。
6. Neon 平台侧分支 / PITR 能力：`NOT_MEASURED`（超出本机工具面）。
7. `lock_timeout=20s` / `statement_timeout=300s` 下**本次未超时 ≠ 无长事务风险**（单次观测）。
8. SEQUENCE **按名字**的对拍：文件内 `CREATE SEQUENCE` 语句 = 0，序列名无法从声明推出 ⇒ 只做了**计数**对拍（13 vs 13），名字集合未逐名对拍（实测名字见 `D-in-tx-state.json`）。
9. 重放后**函数重载**分辨力：函数按 `proname` 去重比较（`prosrc` 的 5 个关键函数已做 md5 对拍，其余 69 个未做 md5 对拍）。
10. 触发器**定义体**（`pg_get_triggerdef`）/ 函数体全文的逐字节对拍：只对 5 个关键函数做了 `md5(prosrc)`；其余对象只做了名字集合与计数。

### G2 探针缺陷自曝（§5.7 ④「先怀疑自己的探针」）

1. **探路 run（`…174551.-plain`）误报 3 项失败，全是探针缺陷，已修并重跑**：
   - ① `triggers.enabled_not_O` 实测 `null` —— **PG 把未加引号的别名折成小写**（`AS enabled_not_O` → 结果列名 `enabled_not_O` 降为 `enabled_not_o`），探针读错键。修：统一小写。**注意：`pre-state` 用同一查询早已返回 `enabled_not_o=0`，即真值一直是 0。**
   - ② `ledger_owner.rows` 误报 —— 文件派生期望按**文件顺序** `[0,-1,-2,-3]`，实测 `ORDER BY uid` 为 `[-1,-2,-3,0]`：**顺序差、逐值相同**。修：改顺序无关比较（按 uid 数值排序）。
   - ③ `currency.cid.nextval` 期望 2 vs 实测 4 —— 期望侧口径过窄（只看了 `0001`）。修：期望改文件派生（见 D 段 ★）。
2. `currency.cid.nextval` 最初版本用 `nextval()` 取下一值 —— 那会**写库**（推进序列），违反「事务外零写库」且会污染 A/F 对比。已改为只读 `SELECT last_value,is_called`。
3. 期望对象集依赖自写词法 `stripSql()`（剥注释/字符串/`$$` 体）；若某文件在 `DO`/`EXECUTE` 里**动态**建对象会被漏解析。本次 `grep` 未发现动态 `CREATE`，且与实测 **43/74/20/1/13** 全等，故未发现漏项 —— 但这是**解析口径**，不是「不可能漏」的构造保证。
4. TABLE 期望计数与 brief 差 1：brief 写「21 张业务表」，本探针 = 20 业务表 + `schema_migration`（`public` 基数表 21）。**两张口径 21/21 都是真的，差在 `schema_migration` 算不算业务表**。
5. `account` 的期望口径为「4 行、cid=1、uid≤0、0/0」；实测直接取了 4 个聚合量（全表行数 / cid=1∧uid≤0∧0/0 / 全表 0/0 / Σ），未逐行 dump uid 列表 —— 口径已在 D 段标明。

---

## H. `--apply` **未执行**声明

- 本单**未**执行 `--apply`，**未** `COMMIT`，**未**触碰 `DATABASE_URL`（pooler）、**未**用 `Pool`、**未** `pg_terminate_backend`/`pg_cancel_backend`、**未**重启或停任何服务、**未** `git add/commit/push`、**未**写 `backend-ts/src/**` 或任何 `p3w-*`/既有 artifact。
- 脚本内 `--apply` 分支**存在**但需**双闸**：`--apply` **且** `--confirm-irreversible`；缺一即 `exit 2` 拒绝（`refused` 输出）。**Phase 2 未获授权 ⇒ 本单绝不调用。**
- dry-run / 注入演练两条路径的事务收尾均为 **`ROLLBACK`**（证据行：`C-replay-log.json` / `SUMMARY.json` 的 `"tx_final": "ROLLBACK"`）。

---

## I. 风险与残留不确定性

1. **Phase 2 一旦执行不可逆**：本机**无 `pg_dump`**（已实测 `which pg_dump` 无输出），**不存在**可回灌的快照；A/F 只读快照是**观测**，不是**备份**。忠实回灌需绕过 20 个 `append-only`/`no_delete`/`immutable` 守卫（`ledger_entry`/`commission_policy`/`referral`/`market_trade`/`currency_status_log` 的 append-only；`job*`/`listing*`/`market_order` 的 no_delete；core-immutable/key-immutable 类）—— 即「用 bug 恢复生产数据」的另一条高风险路径。
2. **副作用外的不可回滚量**：序列推进（`nextval`）与 `pg_stat_*` 计数器**不随 `ROLLBACK` 回退**。本单已在事务内验证到这一点（0011/0012 令 `currency_cid_seq` 前进 2）。⇒ Phase 2 后 **序列值必然 ≠ pre-state**（`currency_cid_seq` 294 → 4），依赖序列历史值的假设会失效。
3. **锁与并发**：本次 `others_count=0`，`DROP SCHEMA` 未被阻塞。若 Phase 2 执行时有长事务 / `idle in transaction` 会话，`DROP SCHEMA` 会被阻塞（本脚本 `lock_timeout=20s` 会以 `55P03` 中止整个事务 ⇒ 安全失败，但会打断重建窗口）。**不得**用 `pg_terminate_backend` 清理（铁律 3）。
4. **`plpgsql` 扩展**：本库扩展只有 `plpgsql`（`pg_catalog`），故 `DROP SCHEMA public CASCADE` **不会**连带删扩展 —— 这与事务内实测「重建后 74 函数 / 43 触发器可用、17 个文件全部自检通过」一致。
5. **`neon_auth` schema** 未被触碰（不在 `public` 下，`DROP SCHEMA public` 不影响）。
6. **`schema_migration` 是驱动 bootstrap**（非迁移文件建立）：重建后由本探针创建，结构与 `migrate.ts` 的 `BOOTSTRAP` 逐字对齐；Phase 2 若改用 `migrate.ts` 跑，需要 `migrate.ts` 自己 bootstrap（它会），但**版本行 checksum 必须与文件 sha256 相等**才不会被判漂移 `exit 3` —— 本单已验证 17/17 逐字节相等。
7. **单次绿不足以推翻多次观测**：本单 = 3 次 run（1 次探路含缺陷 + 1 次主对拍 + 1 次注入演练），三次 pre-hash 相同、三次 `ROLLBACK`、两次净零 identical。**仍需**在 Phase 2 前确认 `seafood-api` 是否在线及其连接行为。

---

## J. 证据索引（artifact + grep）

run 根目录：`backend-ts/.p3x-artifacts/<run_tag>/`（`p3x-00-dry-20260928174808.-plain`、`p3x-00-dry-20260928174912.-inject0010`、`p3x-00-dry-20260928174551.-plain`）

| 段 | 文件 | 关键 grep |
|---|---|---|
| A | `A-pre-state.json` | `grep -n 'table_row_counts' -A24`；`grep -n 'md5'`；`grep -n 'non_internal'` |
| B | `B-connections.json` | `grep -n 'idle_in_transaction_count'`、`grep -n 'others_count'` |
| C | `C-replay-log.json` | `grep -n '"tx_final"'`；`grep -c '"checksum_byte_equal": true'`（=17） |
| D | `D-expectations-from-files.json`、`D-in-tx-state.json`、`D-comparison.json` | `grep -n 'object_diffs'`；`grep -n 'terminal_failed' -A2`；`grep -n 'currency_cid_nextval_derived'` |
| E | `SUMMARY.json`（inject run） | `grep -n 'E_injection' -A16` |
| F | `F-post-state.json` | `grep -n 'identical'`；`A_hash`/`F_hash` 比较 |
| 汇总 | `SUMMARY.json` | `grep -n '"tx_final"'`、`grep -n '"exit_code"'` |

> 复现命令（限时依赖见 §5.7 ③：本机**无** `timeout`/`gtimeout`，退出码**不取自管道之后**）：
> ```
> cd backend-ts
> npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts                      # 主对拍
> npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --inject-fail-after=0010
> ```
