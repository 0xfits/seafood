# P1e · `ledger_post_event(jsonb)` 单语句记账 · 独立对抗式质检报告（Neng）

> **本文件的来源与保真说明**：报告正文由质检人 Neng 在本次运行中产出，但因该次运行 hit `max_iterations`（iteration budget exhausted）而**未落盘**，全部结论以结构化 JSON 形式留在实况日志
> `/Users/kevin/.hermes/profiles/zang/cache/delegation/live/deleg_c52af65a/task-0.log` 的末尾 summary 行（该行被日志写入器截断于 `…(+100 chars)`）。
> 本文件由 **Jing** 依据该次运行的同源记录**逐字段人肉誊清**：**所有读数均为 Neng 实跑，Jing 未做任何二次复跑、未新增任何读数，也未删改任何阈值/码值/pid/txid/行数/毫秒值**。
> 誊清过程中凡素材未覆盖之处，一律标注「**素材缺失**」，不自行补齐。

---

## 1. 元信息

| 项 | 值 |
| --- | --- |
| 被检提交 | `5aa8bbe`（完整 SHA `5aa8bbec02cf8a1eb3fea9ca274821b0e8b2b999`，Author Kevin <kevin@BlueSpace.local>，Date Sun Sep 27 13:37:29 2026 +0800） |
| 提交内容 | P1e / D10 变体 B：把记账压进 PL/pgSQL 函数 `ledger_post_event(payload jsonb) RETURNS jsonb`（`backend-ts/migrations/0004_ledger_post_event.sql`，派单口径 **1177 行**；干净 schema 重演口径 **53954 B**），一个业务事件 = 一条 `SELECT` = 一次往返；`op = mint \| transfer \| hold \| hold_release \| settle \| entries`；错误投影 LD001..LD033 ↔ spec §14.1 关闭集 33 码 |
| 质检人 | Neng（独立第三方质检，未参与本模块实现；自写公共库 `qa-p1e-lib.ts`，**不 import `src/`**，以免「用实现测实现」） |
| 质检性质 | **独立对抗式**：把实现方与派单方的说法都当作**待证伪命题**，用自己的探针拿原始读数 |
| 质检时间 | 2026-09-27 13:38:26 → 13:59:24（CST），duration 1257.72s，api_calls=60 |
| 质检对象仓库 | `/Users/kevin/bistro/seafood`（后端 `backend-ts/`） |
| **已知局限** | 本次运行 **hit `max_iterations`**（`exit_reason=max_iterations`，iteration budget exhausted），报告正文文件**未落盘**——这是本次唯一的未完成交付动作。**本文件正文由 Jing 人肉誊清；所有读数均为 Neng 实跑，未做二次复跑（没有独立复现，只有单轮原始读数）** |
| 素材状态 | 实况日志末尾的 summary 行本身被截断（`…(+100 chars)`）；本文件据同源记录（该次运行的最终 JSON，11604 字符）逐字段誊清 |

**未二次复跑的后果（明示）**：本报告中所有毫秒值、行数、pid、txid、SQLSTATE 均为 Neng 单轮原始读数；凡涉及时间敏感或资源竞争的量（延迟中位数、并发档位 wall/p50、锁等待时长），**未经跨轮复现验证**。

---

## 2. 总裁定：**不通过**（3 条真缺陷，其中 1 条高危）

| # | 级别 | 缺陷 | 一句话判据 |
| --- | --- | --- | --- |
| F1 | **【高】** | **幂等派生键碰撞 ⇒ 无关业务事件被静默丢弃却报成功** | DB 直调 + 公开 API **双证**（verdict `silently_dropped_and_reported_success=true`） |
| F2 | **【中高】** | **未映射 SQLSTATE 面成立**：34 例畸形 payload 中 **7 例**落到 §14.1 闭集之外 ⇒ 调用方可构造 **500**（**22003 ×6、22P02 ×1**） | 触发源是调用方入参，本应 400，实得 500 |
| F3 | **【中】** | **LD025/LD026/LD027 三条 503 级投影全部是死代码**；且函数内 `set_config(statement_timeout,10000)` **完全不生效** | **55P03/40P01/57014 原样逃出函数**（只有 TS 侧 P1b 遗留映射兜住语义）；累计等待 **15.58s** 仍未触发 57014 ⇒ 声明的 10s 上限是空的，最坏单语句可持锁约 **16 账户 × 3s ≈ 48s** |

**总裁定原文（Neng 逐字）**：

> 总判定：**不通过（3 条真缺陷，其中 1 条高危）**。①【高】幂等派生键碰撞 ⇒ 无关业务事件被静默丢弃却报成功（DB 直调 + 公开 API 双证）；②【中高】未映射 SQLSTATE 面成立：34 例畸形 payload 中 7 例落到 §14.1 闭集之外 ⇒ 调用方可构造 500（22003 ×6、22P02 ×1）；③【中】LD025/LD026/LD027 三条 503 级投影**全部是死代码**：55P03/40P01/57014 原样逃出函数（只有 TS 侧 P1b 遗留映射兜住语义），且函数内 set_config(statement_timeout,10000) 实测**完全不生效**（累计等待 15.58s 仍未触发 57014）⇒ 声明的 10s 上限是空的，最坏单语句可持锁约 16 账户 × 3s ≈ 48s。

---

## 3. 逐缺陷章节

### 3.1 F1【高】幂等派生键碰撞 ⇒ 无关业务事件被静默丢弃却报成功（DB 直调 + 公开 API 双证）

**现象 / 判定（Neng 原文）**：**攻击成立，两方向均可复现 ⇒ 真缺陷（高）**。

**根因（含 `0004` 行号）**：0004 只校验键前缀 `^(biz|cm|cli|ops):`（不禁止 #），第 847 行把第 i 条分录的键派生为 i=0 用原始键、i≥1 用 `<key>#<i+1>`；重放分支（1108–1109 行）查询 `key = v_key OR left(key, length+1) = v_key||'#'` 会**匹配他人事件的派生键**；而指纹校验（1119–1121 行）只查 `WHERE idempotency_key = v_key`，派生键行的 request_fingerprint 恒为 NULL ⇒ `v_fp IS NOT NULL AND v_stored_fp IS NOT NULL` 为假 ⇒ **校验被短路**。

**复现路径 · 方向①（裸 SQL 直调，`qa-p1e-02-idem-collision.ts`）**：（B 用 A 的派生键）A 以 ops:qae:e6zeh:coll:a 落 transfer（流水 a=txid1028、a#2=txid1029），B 以 ops:qae:e6zeh:coll:a#2 落一笔**完全无关**的 A→C 777 ⇒ B 得到 {ok:true, idempotent_replay:true, txid:1029}（A 那条分录的 txid），C 余额 0、A 未被多扣 ⇒ **B 的业务事件被静默丢弃却报成功**，返回的 entries 只是他人事件的一条单边分录。

**复现路径 · 方向①（公开 API，`qa-p1e-02b-api-collision.ts`）**：**公开 API 同样可达**（非仅直调面）：调 src/ledger.ts 的 transfer()，keyA=ops:qae:e93ef:api:a（txid1040/1041）、keyB=keyA+#2 ⇒ 返回 ok:true / idempotent_replay:true / txid=1041，第三方账户 934003 余额 0、owner 4900 未变，ledger 中该键下 B 自己的流水 0 条（verdict.silently_dropped_and_reported_success=true）。

**复现路径 · 方向②（A 撞已有派生键）**：先以 ops:qae:...:coll:p#2 落单条事件，再以 ...:coll:p 落两分录事件 ⇒ 第二条分录 INSERT（无 ON CONFLICT）撞唯一约束 ⇒ **LD003 LEDGER_IDEMPOTENCY_CONFLICT / 409**，DETAIL={"reason":"UNIQUE_KEY_FAMILY_COLLISION","idempotency_key":...}（TS 侧同码同 status=409）⇒ 无关事件被误判冲突。

**对照（反证，同一探针内）**：无碰撞的正常键（n1 与 n2#2）互不干扰。

**原始读数**：素材以行内数字形式给出（`txid1028`、`txid1029`、`txid1040`、`txid1041`、第三方账户 `934003` 余额 **0**、owner **4900** 未变、B 自己的流水 **0** 条、`verdict.silently_dropped_and_reported_success=true`、`DETAIL={"reason":"UNIQUE_KEY_FAMILY_COLLISION","idempotency_key":...}`）；**F1 无独立读数块（素材如此，未补）**。

**影响面**：素材未单列「影响面」段。据上文可确证的两条直接后果：① 方向① 下 **B 的业务事件被静默丢弃却报成功**，调用方拿到的是**他人事件的一条单边分录**（含他人 txid）；② 方向② 下 **无关事件被误判冲突**（`LD003 LEDGER_IDEMPOTENCY_CONFLICT` / **409**）。

**修复方向（不指定实现）**：派生键纳入独立命名空间/加不可伪造分隔、或键格式禁止 #（LD005）、或重放族查询改为按事件根键精确归属、或派生行也写指纹。

---

### 3.2 F2【中高】未映射 SQLSTATE 面成立：34 例畸形 payload 中 7 例逃出 §14.1 闭集 ⇒ 500

**现象 / 判定 + 逐例读数（Neng 原文）**：**存在无法归类的路径 ⇒ 真缺陷（中高）**。34 例畸形 payload 直调函数（每例一次调用，逐例记 SQLSTATE/MESSAGE/DETAIL + 用**真实异常对象**喂 ledgerErrorFromDbError → normalizeLedgerError 取最终 code+status）：**7 例逃出 §14.1 闭集**，全部落 `LEDGER_TRANSACTION_REQUIRED` **status=500**、details={cause:码, reason:'unclassified_pg_error', error_name, pg_code:码}：M01 amount_units=19个9、M02 from_uid=19个9、M03 ref_id=19个9、M04 entries[0].delta=19个9、M05 business_frozen_cap=19个9、M06 entries 两条正 delta 使 Σdelta 溢出 —— 六例 SQLSTATE 均为 **22003 numeric_value_out_of_range**；M07 mint platform=maybe（`(payload->>'platform')::boolean` 非法输入）SQLSTATE=**22P02 invalid_text_representation** ⇒ 500。

**根因（含 `0004` 行号）**：函数的 `BEGIN…EXCEPTION` **只包住 C6 写入段**（990–1100 行），**C0–C5（信封/金额/分录组装/配对/加锁）无兜底**；ledger_int_amount 的长度闸只拦 `>19 位`，19 位但超 bigint max(9223372036854775807) 会直接 `::bigint` 炸；C3 的 Σdelta 求和发生在余额/配对判定之前。

**对照 · 其余 24 例正确归类（闭集内，逐码计数）**：LD016×14（JSON 数组/标量/number/null payload、op 非法、amount 为浮点、amount_units 为 number、cid=abc、entries 非数组/空数组/33 条/元素为数字/delta=1.5、ref_type 白名单外、amount_units 超 1e15、Σ≠0）、LD023×3（kind=bogus/对象/settle kind 非法）、LD005×2（无前缀、2000 字符）、LD004×1（key 为 number）、LD015×1（hold 无业务单 403）、LD002/LD001/LD013 各若干。

**附带发现（3 例被静默接受，低危类型闸缺口）**：**被静默接受**（低危类型闸缺口）：cid 传 JSON number、from_uid 带前后空格（btrim 后照收）、memo 传深层嵌套对象。

**结论（直答派单问题）**：⇒ 正面回答「是否存在无法归类的路径」：**存在，7/34，且触发源是调用方入参（本应 400，实得 500）**。

**影响面**：**7/34 例、且触发源是调用方入参 —— 本应 400，实得 500**（素材原文口径）；被静默接受的 3 例为「低危类型闸缺口」。

**修复方向**：**素材缺失** —— Neng 报文中 F2 未给出修复方向段（与 F1 不同，F1 有）。

---

### 3.3 F3【中】LD025/LD026/LD027 三条 503 投影全为死代码；`set_config(statement_timeout,10000)` 自身语句不生效

**现象 / 判定（Neng 原文）**：**三条超时路径全部真跑，且三条的 LD 投影全是死代码**。

**原始读数 (1) 真 55P03**：伙伴事务持 931001 行锁，函数直调 transfer ⇒ 3325ms 后返回**原始 SQLSTATE 55P03**（msg=canceling statement due to lock timeout，**不是 LD025**），该次尝试 rows_written=0、余额逐字未变（unchanged=true）；同键重试（无争抢）1692ms 成功、流水恰 2 条、debit 恰一次；第三次调用 replay=true、流水仍 2 条 ⇒ **不双扣**。

**原始读数 (2) 真 40P01（3 轮 + 1 轮公开 API）**：pg_stat_activity 先取到 `wait_event_type=Lock` 的等待证据（pid 7829/7847/7868，query=SELECT ledger_post_event($1::jsonb) AS r）后再触发环，每轮 pg_stat_database.deadlocks **+1（17→21）**，函数侧拿到的是**原始 40P01 deadlock detected**（**不是 LD027**），DETAIL 完整给出环内互相等待的 pid/事务号；每轮 rows_written=0；公开 API 那轮 transfer() 最终返回 ok / txid 1557（TS 在**原生 40P01** 上按 R60 同键重试成功）⇒ 调用方无感、无双扣。任何一例都没有产生 LD025/LD026/LD027。

**原始读数 (3) 57014 不可由函数产生 + 机制隔离**：6 个持锁者（释放时刻 2.6/5.0/7.4/9.8/12.2/22.0s，栅栏同步共用 t0）使函数累计等待 **15583ms**，仍未触发 statement_timeout，而是以 **55P03（lock_timeout 3s，落在第 6 个账户上）**结束；机制隔离实验 qa-p1e-04c：同一语句内 `set_config('statement_timeout','1500',true)` + pg_sleep(4) **未被取消（4311ms）**、is_local=false 同样未被取消（4193ms），而对照「独立语句 SET statement_timeout=1500 后再 pg_sleep(4)」在 **1705ms 被取消并返回 57014** ⇒ **函数 C1 的 set_config(statement_timeout,10000) 对它自己那条语句完全无效**（lock_timeout 逐次获取生效，所以实测 3s 有效）。

**影响面**：R82 声明的 10s 语句上限是空的，最坏情况单语句可持锁约 16 账户 × 3s ≈ 48s；且 LD025/LD026/LD027 三条 503 级投影在真实路径上永不产生（55P03/57014/40P01 原样逃出，靠 P1b 遗留的 ledger-errors.ts 映射才保住 503 语义）；LD027 的码名 RETRY_EXHAUSTED 与事实不符（DB 层 0 次重试）。

**附带读数 · 3 处 LD024（500 类）**：在 N=128/160 并发下出现，是函数 C6 `WHEN OTHERS` 把基础设施错误吞成 500。

**修复方向**：**素材缺失** —— Neng 报文中 F3 未给出修复方向段（与 F1 不同，F1 有）。

---

## 4. 站得住的部分（逐项，含数字）

### 4.1 并发上限重测：P1b 的「同一行有效并发 ≈2」被推翻，下界 ≥64

单语句形态下**上限结论推翻 P1b 的「≈2」**。(A) 同键并发（直调函数）：N=8 → success 8 / replay_true 7 / replay_false 1 / failure 0，键族流水恰好 2 条；N=16 → success 16 / replay_true 15 / failure 0，恰好 2 条；同键并发期间采样 distinct_backend_pids 8 与 16、max_lock_waiters 1 与 5、wall 1248ms 与 1212ms（P1b 同形：恰好 1 业务事件 = 2 条流水）。(B) 不同键、**同一行**（931001/cid=49）扫描 N=1/2/4/8/16/32/64，池 max 显式 = N：**每档 success=N、failure=0**（8/8、2/2、4/4、16/16、32/32、64/64），wall 1181/956/1013/1060/1239/2846/3814ms，p50 1181/952/1011/1029/1179/1594/1959ms，lock_waiters 峰值 0/0/0/0/0/3/3 → **0 次锁超时**，即同一行有效并发 ≥64（旧形态是 2，提升 ≥32×）。(C) 高段 N=96/128/160 的失败**全部是基础设施连接级**、与账本锁无关：XX000 Couldn't connect to compute node 15/30/43、53300 Too many connections attempts 1/7/23、53200 out of memory 10/13、LD024 各 1（函数 C6 的 WHEN OTHERS 把基础设施错误吞成 500 类），success 被池/计算节点封顶在 80/80/80。结论：拐点被 Neon 端连接上限（max_connections=112）遮住，**无法在本环境测到账本自身的并发拐点**；已证伪「≈2」这一旧读数，且任何档位下均无锁超时。并发真实性取证：pg_stat_activity 采样 max_distinct_pids 8/16/77、max_lock_waiters 1/5/12。

### 4.2 守恒 / 不变式 / 非负 / 不超发 / 不双扣：全部成立

全部并发/死锁/超时/畸形用例跑完后（entry_count 341 → 1189）：§11 判据 1（account 对 Σdelta/Σfrozen_delta 漂移）**0 行**；判据 8 正式形状（按 ref_type/ref_id 分组 Σ(delta+frozen_delta)≠0 且无 mint/burn 豁免）**0 行**；判据 8 键族形状（按 split_part(key,'#',1) 分组）**0 行**；全库 balance<0 或 frozen<0 **0 行**；超 supply_cap **0 行**；各 cid 的 Σ(balance+frozen) 恰等于该币总铸额（cid49=1000000、50=10000、51=5000、52=100、53=10000、54=10000、55=100004、58/59 对账一致，cid_net 逐条相等）；死锁/锁超时/statement_timeout 三类失败**均未落任何分录**（rows_written=0）且余额逐字未变；全部 8 个 lock/deadlock 键族终态**恰好 2 条流水**（含公开 API 那轮真死锁 + TS 重试：ops:qae:ec7yb:lock:deadlock:api 与 ops:qae:eeo48:lock:deadlock:api 均 2 条、delta 为 -1/+1）⇒ 无双扣/无双铸。唯一非零项：cid=1 的 supply_mismatch（total_supply=10400 vs Σmint=4800）在**开工基线（我第一笔写之前）读数即如此、跑完未变**，属前序遗留，不归本提交。

### 4.3 R79 加锁全序 + 6 个 op + 指纹策略（`qa-p1e-08-surface.ts` 逐字原始读数）

```text
A1_mint ok=true txid=1634 
   lock_trace=["currency:58","account:937001:58"] err=undefined 
   entries=[{"uid":"937001","cid":"58","delta":"500","frozen_delta":"0","kind":"mint","key":"ops:qae:enuq6:sf:mint"}] 
   extra={"supply_cap":"1000","supply_after":"500","supply_before":"0"}
A2_transfer ok=true txid=1635 
   lock_trace=["account:937001:58","account:937002:58"] err=undefined 
   entries=[{"uid":"937001","cid":"58","delta":"-10","frozen_delta":"0","kind":"transfer","key":"ops:qae:enuq6:sf:xfer"},{"uid":"937002","cid":"58","delta":"10","frozen_delta":"0","kind":"transfer","key":"ops:qae:enuq6:sf:xfer#2"}] 
   extra={"amount":"10","symbol":"qaeOOenuq6"}
A3_hold ok=true txid=1637 
   lock_trace=["account:937001:58"] err=undefined 
   entries=[{"uid":"937001","cid":"58","delta":"-5","frozen_delta":"0","kind":"hold","key":"ops:qae:enuq6:sf:hold"},{"uid":"937001","cid":"58","delta":"0","frozen_delta":"5","kind":"hold","key":"ops:qae:enuq6:sf:hold#2"}] 
   extra={"amount":"5","symbol":"qaeOOenuq6"}
A4_hold_release ok=true txid=1639 
   lock_trace=["account:937001:58"] err=undefined 
   entries=[{"uid":"937001","cid":"58","delta":"0","frozen_delta":"-5","kind":"hold_release","key":"ops:qae:enuq6:sf:holdrel"},{"uid":"937001","cid":"58","delta":"5","frozen_delta":"0","kind":"hold_release","key":"ops:qae:enuq6:sf:holdrel#2"}] 
   extra={"amount":"5","symbol":"qaeOOenuq6"}
A5_settle ok=true txid=1643 
   lock_trace=["account:937001:58","account:937002:58"] err=undefined 
   entries=[{"uid":"937001","cid":"58","delta":"0","frozen_delta":"-3","kind":"purchase","key":"ops:qae:enuq6:sf:settle"},{"uid":"937002","cid":"58","delta":"3","frozen_delta":"0","kind":"sale","key":"ops:qae:enuq6:sf:settle#2"}] 
   extra={"kind":"purchase","amount":"3","symbol":"qaeOOenuq6","payee_kind":"sale"}
A6_entries_real_shape ok=true txid=1645 
   lock_trace=["account:937001:58","account:937002:59"] err=undefined 
   entries=[{"uid":"937001","cid":"58","delta":"-25","frozen_delta":"0","kind":"purchase","key":"ops:qae:enuq6:sf:entries"},{"uid":"937002","cid":"59","delta":"25","frozen_delta":"0","kind":"sale","key":"ops:qae:enuq6:sf:entries#2"}] 
   extra={"symbol":"qaeOOenuq6","entries":"2"}
D first {"ok":true,"replay":false,"txid":"1647","entries":[{"uid":"937001","cid":"58","delta":"-20","frozen_delta":"0","kind":"transfer","key":"ops:qae:enuq6:sf:fp"},{"uid":"937002","cid":"58","delta":"20","frozen_delta":"0","kind":"transfer","key":"ops:qae:enuq6:sf:fp#2"}],"accounts":[{"cid":"58","uid":"937001","frozen":"0","balance":"442"},{"cid":"58","uid":"937002","frozen":"0","balance":"33"}],"extra":{"amount":"20","symbol":"qaeOOenuq6"},"lock_trace":["account:937001:58","account:937002:58"]}
D diff_fp {"ok":false,"error":{"code":"LD003","message":"LEDGER_IDEMPOTENCY_CONFLICT","detail":"{\"actual\": \"fp-beta\", \"expected\": \"fp-alpha\", \"idempotency_key\": \"ops:qae:enuq6:sf:fp\"}"}}
D no_fp {"ok":true,"replay":true,"txid":"1647","entries":[{"uid":"937001","cid":"58","delta":"-20","frozen_delta":"0","kind":"transfer","key":"ops:qae:enuq6:sf:fp"},{"uid":"937002","cid":"58","delta":"20","frozen_delta":"0","kind":"transfer","key":"ops:qae:enuq6:sf:fp#2"}],"accounts":[{"cid":"58","uid":"937001","frozen":"0","balance":"442"},{"cid":"58","uid":"937002","frozen":"0","balance":"33"}],"extra":{},"lock_trace":["account:937001:58","account:937002:58"]}
accounts [{"uid":"937001","cid":"58","balance":"442","frozen":"0","version":"8"},{"uid":"937002","cid":"58","balance":"33","frozen":"0","version":"3"},{"uid":"937002","cid":"59","balance":"25","frozen":"0","version":"1"}]
E_section11 {"j1_drift_rows":0,"j8_ref_rows":0,"j8_key_rows":0,"negative_balances":"0","supply_over_cap":0,"supply_mismatch":[{"cid":"1","symbol":"$","total_supply":"10400","minted":"4800"}]}
entry_count 1189 deadlocks 21
```

（以上为探针 stdout 中 `A1_..A6_` / `D ..` / `E_section11` / `entry_count` / `accounts [..]` 各行**逐字誊录**。`lock_trace` 即 R79 的加锁顺序取证，6 个 op **全部 `ok=true`**；`D diff_fp` 得到 **LD003 LEDGER_IDEMPOTENCY_CONFLICT**（`actual=fp-beta` vs `expected=fp-alpha`），`D no_fp` 为**重放** `replay=true`、`txid=1647`，与声称一致。）

### 4.4 干净 schema 上 0001 → 0004 从零重演成功，并可端到端跑账（`qa-p1e-09-migration-replay.ts`）

```text
steps [{"file":"0001_ledger_core.sql","ok":true,"bytes":8134,"ms":347},{"file":"0002_user_identity.sql","ok":true,"bytes":1304,"ms":317},{"file":"0003_kind_close_set_20.sql","ok":true,"bytes":3259,"ms":300},{"file":"0004_ledger_post_event.sql","ok":true,"bytes":53954,"ms":1254}]
replay mint {"ok":true,"meta":{"op":"mint","lock_trace":["currency:2","account:950001:2"]},"txid":"1","extra":{"supply_cap":null,"supply_after":"100","supply_before":"0"},"entries":[{"cid":"2","uid":"950001","kind":"mint","memo":"","txid":"1","delta":"100","ref_id":null,"ref_type":null,"frozen_after":"0","frozen_delta":"0","time_created":"2026-09-27T05:58:34.744Z","balance_after":"100","idempotency_key":"ops:qae:mig:mint","reversal_of_txid":null,"request_fingerprint":null}],"accounts":[{"cid":"2","uid":"950001","frozen":"0","balance":"100"}],"idempotency_key":"ops:qae:mig:mint","idempotent_replay":false}
replay transfer {"ok":true,"meta":{"op":"transfer","lock_trace":["account:950001:2","account:950002:2"]},"txid":"2","extra":{"amount":"40","symbol":"qaeMIG"},"entries":[{"cid":"2","uid":"950001","kind":"transfer","memo":"","txid":"2","delta":"-40","ref_id":null,"ref_type":null,"frozen_after":"0","frozen_delta":"0","time_created":"2026-09-27T05:58:35.081Z","balance_after":"60","idempotency_key":"ops:qae:mig:xfer","reversal_of_txid":null,"request_fingerprint":null},{"cid":"2","uid":"950002","kind":"transfer","memo":"","txid":"3","delta":"40","ref_id":null,"ref_type":null,"frozen_after":"0","frozen_delta":"0","time_created":"2026-09-27T05:58:35.081Z","balance_after":"40","idempotency_key":"ops:qae:mig:xfer#2","reversal_of_txid":null,"request_fingerprint":null}],"accounts":[{"cid":"2","uid":"950001","frozen":"0","balance":"60"},{"cid":"2","uid":"950002","frozen":"0","balance":"40"}],"idempotency_key":"ops:qae:mig:xfer","idempotent_replay":false}
replay accounts [{"uid":"-3","cid":"1","balance":"0","frozen":"0"},{"uid":"-2","cid":"1","balance":"0","frozen":"0"},{"uid":"-1","cid":"1","balance":"0","frozen":"0"},{"uid":"0","cid":"1","balance":"0","frozen":"0"},{"uid":"950001","cid":"2","balance":"60","frozen":"0"},{"uid":"950002","cid":"2","balance":"40","frozen":"0"}] drift []
cleanup DROPPED schema_left 0 public_tables [{"n":"6"}] public_rows 1189
```

（`0004_ledger_post_event.sql` 重演字节数 **53954 B**、耗时 **1254ms**（0001 **8134 B/347ms**、0002 **1304 B/317ms**、0003 **3259 B/300ms**）；重演后 `drift []`、自清理 `schema_left 0`、`public_rows 1189`。）

### 4.5 neon 驱动闭包不破（`qa-p1e-05-neon-ab.ts`）

同脚本、同币（qaeNAB/cid55）、同账号，仅换 SEAFOOD_LEDGER_WRITE_DRIVER：**pool** 档 transfer 采样 [184,196,237,221,802] 中位 **221ms**，复跑 [203,227,224,171,198] 中位 **203ms**；**neon**（SQL-over-HTTP）[175,196,432,242,166] 中位 **196ms**，复跑 [186,184,327,219,191] 中位 **191ms**；mint 中位 pool 523/195ms vs neon 252/400ms。结论：两者同数量级，**neon 略快约 5–10%**，说明 4181ms→171/196ms 的收益来自「10–14 条语句压成 1 条」而非传输层，三档驱动可互换。错误投影对照（同一 payload 两档各跑）：LD019 自转两档均 {code:LEDGER_SELF_TRANSFER, status:400, details:{uid,cid}}；LD007 cid=999999 两档均 404 LEDGER_CURRENCY_NOT_FOUND，但 **neon 档 details 退化为 {detail_unavailable:'driver_did_not_carry_detail'}**（HTTP 驱动不搬运 DETAIL，与代码注释一致）⇒ code/status 闭包不破，details 形状在 neon 档不满足 §14.4。

### 4.6 判负能力成立（`qa-p1e-06-falsify.ts`）

**成立**。事务内注入一条「孤儿分录」（delta=+1、带 ref 对 system/<9位>、不更新 account）：§11 判据 1 当场命中 1 行（931001/cid49 balance=999631 ≠ Σdelta=999632）、判据 8 正式形状命中 1 组（system/488476190 net_sum=1）、判据 8 键族形状命中 1 组（ops:qae:falsify:488476190 net_sum=1）⇒ 三条判据**同时变红**（caught_j1/j8_ref/j8_key 全 true）。附带复核派单建议的 UPDATE account 路线：被 trg_account_guard 以 **P0001** 拒绝（account(999632/0) != latest ledger snapshot(0/0) for uid=931001 cid=49）⇒ 该注入路线在本库不可用。ROLLBACK 后全部回绿（j1/j8_ref/j8_key=0），被牵连行指纹逐字恢复（balance 999631、frozen 0、version 370、time_updated 相同）、entry_count 未变、孤儿分录 0 行残留（未提交，等于「备份-恢复」的更强形式）。

（探针自报 verdict：`probe_can_detect_evil=true`、`db_guard_blocks_account_update=true`、`back_to_green=true`；`after_entry_count=1174`、`orphan_persisted=0`。）

### 4.7 基座未动

- Neng 的结论句（逐字）：**「基座 sha256 与平台账户逐字未动」**。
- 开工基线 sha256 读数（`qa-p1e-00-baseline.ts`，逐字）：

| 文件 | sha256（开工基线） |
| --- | --- |
| `migrations/0001_ledger_core.sql` | `4f902d3c47508d91826925a46765ad728b1a5a9c2773d0fc1c0f2c1e8e2451a4` |
| `migrations/0002_user_identity.sql` | `688b1935f6bc3006b545ca158ca97324256a117e4f86e69c09bda8bbb01c5990` |
| `migrations/0003_kind_close_set_20.sql` | `f268e03075eb4bf46d58766412fc5b53d8f8841d4cac175a3f96c440e8730a23` |
| `migrations/0004_ledger_post_event.sql` | `55fd1ce8085bd3b3ef77f86c35f07d3b9f9c9157ee9ce0cf05f2733033e9c932` |
| `src/ledger.ts` | `b81382020bc9ea8e9d92eee2d0dd2fd437bbfa94697491b2a4dd06ba9ceb46d8` |
| `src/ledger-errors.ts` | `194d43c1495f0c4c06f4748f3345d4b52bf507fa248023ce2e6b609b7f3379ef` |
| `src/db.ts` | `b240787f80c2dfdb6633b2c3b2f6595e7bb2fbe9a7cceade1248677ef4f454f3` |

- 平台账户（cid=1）：开工与收工均 `uid -3/-2/-1/0 → balance 0 / frozen 0`；`cid=1` 流水 **128** 条。
- **素材说明**：素材中可见的 sha256 读数只有**开工基线这一次**（上表）；收工第二次哈希读数未落进素材（`qa-p1e-08` 自述含「基座终态复合」，但该段哈希读数素材未给出）。

---

## 5. 未验证面（照录，共 9 条）

**共 9 条**，逐条照录（**未做二次复跑，故这些边界均仍开放**）：

**U1.** 【交付缺口】报告正文文件 docs/qa/p1e-db-function.md 未写盘（写报告前用尽工具调用配额）；所有读数与本 JSON 字段内容即为待誊清的素材
**U2.** 同一行并发的**精确拐点**：N=1..64 全部零失败，N=96/128/160 先被 Neon 端连接上限（XX000/53300/53200）截断，无法在本环境测出账本自身的拐点（结论只能给下界 ≥64）
**U3.** 40001 serialization failure 未能构造（read committed + 单语句隐式事务，无可重复读冲突路径）；因此 04 里 serialization_failure 分支只能按代码判定为死代码，无原始读数
**U4.** neon（SQL-over-HTTP）驱动的**并发**行为未测（A/B 全部为串行延迟读数）
**U5.** 三处 LD024（N=128/160 各 1、N=160 另一处）只拿到 SQLSTATE，未捕获其 DETAIL.pg_code（探针未记录失败详情字段）
**U6.** freeze/unfreeze/settleFrozen 三条公开 API 的并发用例未覆盖（派单范围外，P1b 亦未覆盖；本次仅覆盖 mint/transfer/hold/hold_release/settle/entries 六 op 的串行正确性）
**U7.** burn / reversal 路径未测（P1a 文件头即声明未实现，无并发调用点）
**U8.** op=entries 的 32 条上限、16 账户上限只测了 33 条拒绝与 4/6 账户成功，未测正好 16 账户/32 条边界
**U9.** statement_timeout 无效的**确切机制**只做到行为级隔离（同语句 set_config 不生效、独立语句 SET 生效），未从 PG 源码层面确认原因

> 注：**U1 即本次的交付缺口本身**（报告文件未落盘）；U2 即「并发拐点被 Neon 端连接上限遮住」；U3 即「40001 未能构造」。
> 上述 9 条之外，**素材未提供其他未验证面**（未自行补充）。

---

## 6. 既有问题线索（前序遗留 / 跨提交口径；Neng 原文）

**① cid=1 发行量对账基线就不平**

① cid=1（$）的发行量对账在**开工基线**即为 total_supply=10400 vs Σmint=4800（差 5600），跑完未变（cid=1 流水 128 条、平台账户 0/0 未动）⇒ 前序遗留，不归本提交，需 Zang/Kevin 裁定（是否属 P0/P1a 历史造数）。

**② 幂等键前缀允许 `#` 是跨提交的既有口径**

② 幂等键前缀白名单允许 # 是跨提交的既有口径（TS normalizeIdempotencyKey 与 DB 校验都只查前缀），P1a/P1b 未暴露是因为当时是「先查后插 + 唯一约束」的多语句形态；D10 的派生键把它放大成可静默丢弃事件 ⇒ 建议同时修 TS 与 DB 两侧。

**③ 池过载被吞成 500 的老问题：已在 P1c 修好，但在 DB 函数内以新形态复现**

③ P1b 报告点名的「池过载被吞成 500」已在 P1c 修好（本次 LD025 相关读数中池过载正确落在 503），但同一类型问题在 DB 函数内以新形态复现：C6 的 WHEN OTHERS 把基础设施错误（OOM/连接失败）改成 LD024 → 500，N=128/160 各命中 1 次。

**④ 环境事实：Neon 连接上限先于账本锁成为瓶颈**

④ 环境事实：Neon 计算节点连接上限（max_connections=112 / pooler ~80 并发）会先于账本锁成为并发瓶颈，任何「100 并发全部成功」的口径在本端点结构性不可达。

---

## 7. 测试数据清单（uid / symbol / 行数 / 幂等键前缀）

### 7.1 逐字读数（`qa-p1e-07-inventory.ts`，`entry_total=1174` 时那次输出）

```text
entry_total 1174 baseline 341 (QA-P1E-00 开工读数) deadlocks 21
--- by prefix ---
  {"prefix":"ops:p1e:* (Kong 实现方 P1e)","rows_":"209","events":"114","min_txid":"370","max_txid":"706"}
  {"prefix":"ops:qae:* (Neng 本单)","rows_":"833","events":"416","min_txid":"746","max_txid":"1614"}
  {"prefix":"other/前序","rows_":"132","events":"72","min_txid":"451","max_txid":"745"}
--- my currencies ---
  {"cid":"49","symbol":"qaeCe4rkl","owner_uid":"931001","decimals":0,"total_supply":"1000000","supply_cap":null,"status":"listed"}
  {"cid":"50","symbol":"qaeIe6zeh","owner_uid":"932001","decimals":0,"total_supply":"10000","supply_cap":null,"status":"listed"}
  {"cid":"51","symbol":"qaeAe93ef","owner_uid":"934001","decimals":0,"total_supply":"5000","supply_cap":null,"status":"listed"}
  {"cid":"52","symbol":"qaeMe9jok","owner_uid":"935001","decimals":0,"total_supply":"100","supply_cap":"1000","status":"listed"}
  {"cid":"53","symbol":"qaeLec7yb","owner_uid":"933001","decimals":0,"total_supply":"10000","supply_cap":null,"status":"listed"}
  {"cid":"54","symbol":"qaeLeeo48","owner_uid":"933001","decimals":0,"total_supply":"10000","supply_cap":null,"status":"listed"}
  {"cid":"55","symbol":"qaeNAB","owner_uid":"936001","decimals":0,"total_supply":"100004","supply_cap":null,"status":"listed"}
--- my accounts ---
  {"uid":"931001","cid":"49","balance":"999631","frozen":"0","version":"370"}
  {"uid":"931002","cid":"49","balance":"243","frozen":"0","version":"243"}
  {"uid":"931003","cid":"49","balance":"126","frozen":"0","version":"126"}
  {"uid":"932001","cid":"50","balance":"9836","frozen":"0","version":"5"}
  {"uid":"932002","cid":"50","balance":"164","frozen":"0","version":"4"}
  {"uid":"932003","cid":"50","balance":"0","frozen":"0","version":"0"}
  {"uid":"933001","cid":"53","balance":"9991","frozen":"0","version":"6"}
  {"uid":"933001","cid":"54","balance":"9653","frozen":"0","version":"11"}
  {"uid":"933002","cid":"53","balance":"9","frozen":"0","version":"5"}
  {"uid":"933002","cid":"54","balance":"47","frozen":"0","version":"7"}
  {"uid":"933011","cid":"54","balance":"160","frozen":"0","version":"6"}
  {"uid":"933012","cid":"54","balance":"40","frozen":"0","version":"4"}
  {"uid":"933013","cid":"54","balance":"80","frozen":"0","version":"3"}
  {"uid":"933014","cid":"54","balance":"20","frozen":"0","version":"2"}
  {"uid":"934001","cid":"51","balance":"4850","frozen":"0","version":"3"}
  {"uid":"934002","cid":"51","balance":"150","frozen":"0","version":"2"}
  {"uid":"934003","cid":"51","balance":"0","frozen":"0","version":"0"}
  {"uid":"935001","cid":"52","balance":"97","frozen":"0","version":"4"}
  {"uid":"935002","cid":"52","balance":"3","frozen":"0","version":"3"}
  {"uid":"936001","cid":"55","balance":"99992","frozen":"0","version":"17"}
  {"uid":"936002","cid":"55","balance":"12","frozen":"0","version":"12"}
--- section11 --- {"j1_drift_rows":0,"j8_ref_rows":0,"j8_key_rows":0,"negative_balances":"0","supply_over_cap":0,"supply_mismatch":[{"cid":"1","symbol":"$","total_supply":"10400","minted":"4800"}]}
--- cid1/platform --- [{"uid":"-3","cid":"1","balance":"0","frozen":"0","version":"0"},{"uid":"-2","cid":"1","balance":"0","frozen":"0","version":"0"},{"uid":"-1","cid":"1","balance":"0","frozen":"0","version":"0"},{"uid":"0","cid":"1","balance":"0","frozen":"0","version":"0"}] [{"cid":"1","symbol":"$","total_supply":"10400","supply_cap":null,"status":"listed"}] cid1 entries 128
--- totals --- [{"cid":"49","sum_balance":"1000000","sum_frozen":"0","net":"1000000"},{"cid":"50","sum_balance":"10000","sum_frozen":"0","net":"10000"},{"cid":"51","sum_balance":"5000","sum_frozen":"0","net":"5000"},{"cid":"52","sum_balance":"100","sum_frozen":"0","net":"100"},{"cid":"53","sum_balance":"10000","sum_frozen":"0","net":"10000"},{"cid":"54","sum_balance":"10000","sum_frozen":"0","net":"10000"},{"cid":"55","sum_balance":"100004","sum_frozen":"0","net":"100004"}]
--- p1e currencies (untouched) count 35
--- my key cases count 416
```

### 7.2 收工终值（`qa-p1e-07-inventory.ts` 收尾跑，逐字）

```text
entry_total 1189 deadlocks 21
deadlock_case_keys [{"base_key_":"ops:qae:ec7yb:lock:deadlock:1","rows_":"2","uids":"933001,933002","deltas":"-1,1"},{"base_key_":"ops:qae:ec7yb:lock:deadlock:2","rows_":"2","uids":"933001,933002","deltas":"-1,1"},{"base_key_":"ops:qae:ec7yb:lock:deadlock:3","rows_":"2","uids":"933001,933002","deltas":"-1,1"},{"base_key_":"ops:qae:ec7yb:lock:deadlock:api","rows_":"2","uids":"933001,933002","deltas":"-1,1"},{"base_key_":"ops:qae:ec7yb:lock:timeout","rows_":"2","uids":"933001,933002","deltas":"-5,5"},{"base_key_":"ops:qae:eeo48:lock:deadlock:1","rows_":"2","uids":"933001,933002","deltas":"-1,1"},{"base_key_":"ops:qae:eeo48:lock:deadlock:api","rows_":"2","uids":"933001,933002","deltas":"-1,1"},{"base_key_":"ops:qae:eeo48:lock:timeout","rows_":"2","uids":"933001,933002","deltas":"-5,5"}]
api_deadlock_family_rows 2
section11 {"j1_drift_rows":0,"j8_ref_rows":0,"j8_key_rows":0,"negative_balances":"0","supply_over_cap":0,"supply_mismatch":[{"cid":"1","symbol":"$","total_supply":"10400","minted":"4800"}]}
===== PANEL =====
sites 16 up 16 not_up []
seafood-api {"running":true,"state":"running","stopping":false,"portOpen":true,"occupier":null,"error":null,"name":"海鲜市场 后端","group":"seafood","port":5788,"pid":20320,"cwd":"/Users/kevin/bistro/seafood/backend-ts"}
===== PROCS =====
20334 20320        19:07 node /Users/kevin/bistro/seafood/backend-ts/node_modules/.bin/ts-node src/index.ts
43132 42869     01:45:46 node /Users/kevin/bistro/jinli/backend-ts/node_modules/.bin/ts-node src/index.ts
43150 42894     01:45:46 sh -c node scripts/sync-content-view-model.mjs && node scripts/sync-theme-icon-assets.mjs && nodemon --exec ts-node api/src/index.ts
43203 43150     01:45:46 node /Users/kevin/bistro/aranya_go/node_modules/.bin/nodemon --exec ts-node api/src/index.ts
43266 43203     01:45:46 node /Users/kevin/bistro/aranya_go/node_modules/.bin/ts-node api/src/index.ts
```

### 7.3 要点摘录（全部来自上列逐字读数，未新增）

- **行数**：开工 `entry_count 341`（`qa-p1e-00` 开工读数）→ 收工 `entry_total 1189`；`deadlocks 21`（累计 `pg_stat_database.deadlocks`）。
- **幂等键前缀三族**：`ops:p1e:*`（Kong 实现方 P1e）`rows_ 209 / events 114 / txid 370–706`；`ops:qae:*`（Neng 本单）`rows_ 833 / events 416 / txid 746–1614`；`other/前序` `rows_ 132 / events 72 / txid 451–745`。`my key cases count 416`。
- **本次新造币（cid / symbol / owner_uid / decimals / total_supply / supply_cap / status）**：`49 qaeCe4rkl 931001 0 1000000 null listed`；`50 qaeIe6zeh 932001 0 10000 null listed`；`51 qaeAe93ef 934001 0 5000 null listed`；`52 qaeMe9jok 935001 0 100 null 1000 listed`（`supply_cap=1000`）；`53 qaeLec7yb 933001 0 10000 null listed`；`54 qaeLeeo48 933001 0 10000 null listed`；`55 qaeNAB 936001 0 100004 null listed`。
- **`p1e currencies (untouched) count 35`**（未动）；Kong 的 P1e 币族与本人测试币族分离，见上「by prefix」。
- **测试 uid**：`931001/931002/931003`(cid49)、`932001/932002/932003`(cid50)、`933001/933002`(cid53、cid54)、`933011/933012/933013/933014`(cid54)、`934001/934002/934003`(cid51)、`935001/935002`(cid52)、`936001/936002`(cid55)；另 `qa-p1e-08` 用到 `937001/937002`（cid58/59），迁移重演用 `950001/950002`（临时 schema，已自清理）。
- **各 cid 对账**（`--- totals ---`）：`49 净 1000000`、`50 净 10000`、`51 净 5000`、`52 净 100`、`53 净 10000`、`54 净 10000`、`55 净 100004`（`sum_frozen` 全 `0`）。
- **死锁/锁超时键族终态**：8 个 base key（`ops:qae:ec7yb:lock:deadlock:1/2/3`、`ops:qae:ec7yb:lock:deadlock:api`、`ops:qae:ec7yb:lock:timeout`、`ops:qae:eeo48:lock:deadlock:1`、`ops:qae:eeo48:lock:deadlock:api`、`ops:qae:eeo48:lock:timeout`）**每族恰好 `rows_ 2`**，uid 均为 `933001,933002`，`deltas` 为 `-1,1`（timeout 族为 `-5,5`）；`api_deadlock_family_rows 2`。
- **探针所需环境变量**：`QAE_CID=49`、`QAE_SRC=931001`、`QAE_DST=931002`（`qa-p1e-01b-sweep-high.ts`）；`QAE_CID=54`（`qa-p1e-04b-statement-timeout.ts`）。
- **素材说明**：素材未给出「测试 uid 总数/币总数」的聚合断言；上列 uid、symbol、行数、键前缀均为逐字读数，**未做任何归并或补算**。

---

## 8. 可复跑的探针脚本清单（`backend-ts/scripts/qa-p1e-*.ts`）

**全部已落盘、只读、可重跑**（`qa-p1e-lib.ts` 为自写公共库，**不 import `src/`**，以免「用实现测实现」）：

| # | 脚本 | 用途（照录） |
| --- | --- | --- |
| 1 | `backend-ts/scripts/qa-p1e-lib.ts` | （自写公共库：独立池/裸 SQL/直调函数/PG 原始错误提取/§11 核对 SQL/pg_stat_activity 采样；不 import src/ 以免用实现测实现） |
| 2 | `backend-ts/scripts/qa-p1e-00-baseline.ts` | （提交与基座指纹、schema_version、行数、§11、平台账户、服务端超时参数） |
| 3 | `backend-ts/scripts/qa-p1e-01-concurrency.ts` | （同键 N=8/16；同一行不同键 N=1..64 扫描；并发真实性；不变式） |
| 4 | `backend-ts/scripts/qa-p1e-01b-sweep-high.ts` | （同一行高段 N=96/128/160，需 QAE_CID） |
| 5 | `backend-ts/scripts/qa-p1e-02-idem-collision.ts` | （派生键碰撞两个方向的**裸 SQL 直调**取证） |
| 6 | `backend-ts/scripts/qa-p1e-02b-api-collision.ts` | （派生键碰撞的**公开 API（transfer）可达性**取证 + LD003 误冲突） |
| 7 | `backend-ts/scripts/qa-p1e-03-malformed.ts` | （34 例畸形 payload 直调：SQLSTATE/MESSAGE/DETAIL + TS 最终 code/status + 闭集内外判定） |
| 8 | `backend-ts/scripts/qa-p1e-04-locktimeout-deadlock.ts` | （真 55P03 与真 40P01、锁等待证据轮询、同键重试不双扣、公开 API 在死锁下的行为） |
| 9 | `backend-ts/scripts/qa-p1e-04b-statement-timeout.ts` | （6 持锁者栅栏同步构造累计等待 >10s，验证 57014 是否可达） |
| 10 | `backend-ts/scripts/qa-p1e-04c-statement-timeout-mechanism.ts` | （机制隔离：同语句 set_config vs 独立语句 SET） |
| 11 | `backend-ts/scripts/qa-p1e-05-neon-ab.ts` | （pool vs neon 延迟 A/B + 错误 details 形状对照） |
| 12 | `backend-ts/scripts/qa-p1e-06-falsify.ts` | （事务内注入使 §11 判据 1/8 变红再回绿 + 行指纹备份/恢复核对） |
| 13 | `backend-ts/scripts/qa-p1e-07-inventory.ts` | （只读测试数据清单 + 终态核对 + 死锁键族终态） |
| 14 | `backend-ts/scripts/qa-p1e-08-surface.ts` | （6 个 op 各一次 + 真实业务形状跨币种 entries + R79 lock_trace + 指纹策略 + 基座终态复合） |
| 15 | `backend-ts/scripts/qa-p1e-09-migration-replay.ts` | （干净 schema 内 0001→0004 从零重演 + 端到端最小验证 + 自清理，含 search_path 安全闸） |

**环境变量需求（照录）**：`qa-p1e-01b-sweep-high.ts` 需 `QAE_CID=49 QAE_SRC=931001 QAE_DST=931002`；`qa-p1e-04b-statement-timeout.ts` 需 `QAE_CID=54`；其余脚本按 `qa-p1e-lib.ts` 头的用法（`cd backend-ts && npx ts-node --transpile-only scripts/<脚本>`）直接跑。

---

## 9. 本次质检的纪律声明（照录）

**Neng 原文（纪律句）**：

> 未改 `src/**`、`migrations/**`、`docs/**`（除本报告路径）、未 `git add/commit/push`、未 `pkill/killall`、未重启任何面板服务、未碰 `cid=1` 与平台账户。

**收工面板与进程读数（`panel_state`，照录）**：

收工核对：GET http://127.0.0.1:5555/api/status = **16/16 站点 up**（sites 16, up 16, not_up []）；seafood-api {running:true, state:running, portOpen:true, pid:20320, port:5788, cwd:/Users/kevin/bistro/seafood/backend-ts}；lsof -nP -iTCP:5788 为面板托管 node（PID 20334 ← 20320）。全程**未停/未重启任何面板托管服务**、未 pm2 restart、**未使用 pkill -f / killall**（只按精确 PID 概念操作且实际未杀任何进程）；ps 中残留的 ts-node 属他人会话（jinli 43132、aranya_go 43150/43203/43266）与我自己的探针无关；我启动的全部 ts-node 探针均已自行退出（ps 无残留）。

**Jing 的补充声明（本轮誊清作业）**：本轮**只新建/写入 `docs/qa/p1e-db-function.md` 一个文件**；**未改** `docs/ledger.spec.md`、`docs/seafood.master-plan.md`、`backend-ts/**`、`frontend/**`；**未** `git add/commit/push`；**未**启动/重启任何服务；**未**连库改数据；**未**使用 `pkill -f` / `killall`。
