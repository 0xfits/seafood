# S38 / 台账 B18 残差 · 「S37 留下的 30 处残差」定性单（`users` 8 + `currency` 22）

> 角色：Kong（定性方，子代理）· 仓库 `/Users/kevin/bistro/seafood`（Express/TS + Neon PG18）
> 本单性质：**只读定性为主 + 探针面最小修（本单判为「不宜实施」⇒ 零代码改动）**。
> 硬口径遵守：**零** `nextval`/`setval`/任何写库；连库**全部只读**（进程内 dotenv + `@neondatabase/serverless`）；
> **未** `pkill -f`/`killall`；**未**启停 5787/5788；**未** commit/push；**未** `npm install`；原始输出不用 `.log`。
> **未动**：`backend-ts/migrations/**`、`backend-ts/src/**`、`frontend/**`、三份 docs 规范件（`docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`）。
> **未动门判据**（`s36-00` 保持 S37 收敛态；见 §3）。
> 产物目录：`backend-ts/.s38-artifacts/s38-20261005T053022Z/`

---

## §0 对锚

**开工前（现取）**：
```
$ cd /Users/kevin/bistro/seafood && git log --oneline -3
a037737 fix(scripts): S37/B18 —— 夹具显式号段上移到序列不可达带 9e8（…）；门判据细化为带感知…；命中 43⇒30…
5bf56d7 docs: §5.357/v0.357 —— S36b 核盘 … 派 S37 …
dfd67fb chore(gates): S36+S36b —— B14 隐式 identity-PK 全仓盘点报告 …   ← **与派单锚一致** ✓（HEAD 含 S37 那笔 a037737）

$ git status --porcelain | grep -cE '^ M'
0                                                                       # 开工时 tracked 零改动
```

**收工时对锚（★ HEAD 被并发会话推进 —— 登记，非本单所为）**：
```
$ git log --oneline -1
99470f0 docs: §5.359/v0.359 —— ★我下 B17 两条定档 … + 派 S39 …
$ git log --oneline a037737..HEAD
99470f0 docs: §5.359/v0.359 …          # 并发 docs 单
77f5b61 docs: §5.358/v0.358 —— S37 核盘（… 带感知判据=加严所批准 / users 排除批准 …）+ 派 S38 残差定性   ← Zang 裁令落盘
$ git diff --name-only a037737..HEAD
docs/OPEN-ITEMS.md
docs/seafood.master-plan.md
$ git diff --name-only a037737..HEAD | grep -E 'backend-ts/(scripts|src|migrations)/|frontend/'
（空）                                                                   # 与本单读/写面**零交集** ⇒ 无冲突、无需 rebase ✓

$ git status --porcelain | grep -E '^ M|^M' | wc -l
0                                                                       # ★ 收工时 tracked 零改动（本单零代码改动）
$ git status --porcelain | grep -E 's38'
?? backend-ts/.s38-artifacts/                                           # 仅本单产物目录（含报告在 docs/）
```

**现取依据**：`docs/audit/s37-fixture-id-band-move.md` §1.2/§5/§8 · `backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json` · `backend-ts/scripts/s36-00-identity-pk-form-gate.ts`。
**残差 30 处现取（门 `--json` 落盘 `gate-before.json`）**：`currency 22 + users 8`，与派单逐字一致。

**Zang 两条裁令（逐字执行，见 `77f5b61` §5.358）**：① 门判据「带感知」=批准（更严）；② `users` 排除号段上移法=批准。本单**未回退**二者。

---

## §1 `users` 8 处逐处定性（核心）

### 1.0 现取：连库读数（只读；`ro-db-probe.mjs` / `ro-db-probe2.mjs`）

```
server : db=neondb  addr=169.254.254.254/32  pgver=18.6  usr=neondb_owner   # 单一 Neon dev 库 ep-holy-forest-b3fi7u3u
seqnames: users_uid_seq = public.users_uid_seq ; currency_cid_seq = public.currency_cid_seq
users_uid_seq: last_value=41  is_called=true     ⇒ 下一枚 nextval = 42        # 只读 pg_sequences / 直查序列视图；**未跑 nextval**
users 聚合: n=64  min_uid=1  max_uid=971213
uid=42 是否存在: count=0                          # ★ 42 **未被占用**
uid ≤ 100 全集: {1..12, 17..22, 34..41}           # 13-16,23-33,42+ 缺
uid > 42 的最小值: 900001
全 uid: {1..12,17..22,34..41, 900001-900008, 910001-910010, 910311, 970001,970002,970101,970102, 970201-970213, 971100, 971213}
ns 残差带(现取): 9903xx=0 · 9905xx=0 · 9907xx=0 · 952xxx=0 · 9608xx-9609xx=0    # 当前库无这些夹具行
currency: n=15  min=1  max=36 ; currency_cid_seq: last_value=346 is_called=true ⇒ next=347 ; cid=1 存在
```

**★ 现取结论（推翻 S37 §1.2 依据 3 的举例）**：S37 写「省略 PK 的 users 插入**取到 42 这类真 uid 早已占用**的值 ⇒ 撞的是真行」。
现取 **`uid=42` 在本库并不存在**（count=0）；`users_uid_seq.nextval=42` 是**当前空位**。
⇒ **「当下必撞」不成立**。详见 §1.2。

### 1.1 逐处表（8 处；现取 `文件:行` + 四问）

**读法**：`runtime_form` = 该 INSERT **运行时**的真实形态（≠门扫描形态时标 ★）。
「跑向哪库」= 全部经 `backend-ts/.env.local` 的 `DATABASE_URL_UNPOOLED` ⇒ **同一台 Neon dev 库 `neondb`**（与产品真 `users` 同库同表；**本仓无第二 DB / 无受控实例 env 切换**）。

| # | 文件:行 | 函数 | 运行时形态 | ①是否真跑（死码?） | ②跑向哪库 | ③是否在会 ROLLBACK 的事务内 |
|---|---|---|---|---|---|---|
| 1 | `scripts/p3f-lib.ts:85` | `ensureUser` | **omitted**（`names` 无 uid ⇒ identity） | 真跑（人工）：调用者 `p3f-01-cases.ts` / `p3f-02-concurrency-and-negative.ts`；非自动门 | dev neondb | **YES** —— 两调用者均 `BEGIN …(SAVEPOINT)… ROLLBACK`（p3f-01 全文单事务末尾 ROLLBACK） |
| 2 | `scripts/p3j-lib.ts:93` | `ensureUser` | **omitted**（identity） | 真跑（人工）：9 个调用者（p3j-02/p3j-03/p4z-b3c-02/03、p4z-b3d-02/03、p4z-b3e-02/03）；非自动门 | dev neondb | **NO** —— 调用者一律传 `Pool` ⇒ autocommit **落库** |
| 3 | `scripts/p3l-05-cases.ts:37` | `ensureUserAt` | ★ **explicit（uid=990301..990304）** | 真跑（人工用例脚本） | dev neondb | **NO** —— `mkPool(2)` 直用 ⇒ autocommit（脚本尾部还审计 9903xx 行数） |
| 4 | `scripts/p3l-09-first-purchase.ts:26` | `ensureUserAt` | ★ **explicit（uid=990301/990302）** | 真跑（人工判负用例） | dev neondb | **NO** —— `mkPool(1)` 直用 ⇒ autocommit |
| 5 | `scripts/p3l-lib.ts:94` | `ensureUser` | **omitted**（identity） | 真跑（人工）：p3l-01/05/09 等 | dev neondb | **NO** —— 调用者一律传 `Pool` ⇒ autocommit |
| 6 | `scripts/p3m-lib.ts:99` | `ensureUser` | ★ **explicit（uid=9905xx）** | 真跑（人工）：`p3m-02-cases.ts`（`mkPool()`）；非自动门 | dev neondb | **NO** —— `Pool` 直用；文件头注释「DL79 不清理夹具」 |
| 7 | `scripts/p3p-lib.ts:150` | `ensureUser` | ★ **explicit（uid=9907xx）** | 真跑（人工）：`p3p-02-cases.ts` / `p3p-03-falsify.ts` | dev neondb | **YES** —— 两调用者 `txn.begin(db)` 起单一事务、末尾整体 `ROLLBACK`（p3p-02 文件头明写「整体 ROLLBACK ⇒ 零残留」） |
| 8 | `scripts/p4z-a1li-01-e2e.ts:107` | `ensureUser` | **omitted**（identity） | 真跑（人工 e2e，`MODE=pre|post`，需运行中服务）；非自动门 | dev neondb | **NO** —— `sql` tag autocommit；文件头「**零 DELETE SQL**」⇒ 行**落库残留** |

**四问答案（汇总）**：
- ① **8/8 均非死代码**（都可运行的人工探针/用例脚本）；但 **0/8 属于 14 门自动验收面**（不属于任何 gate）。
- ② **8/8 跑向同一台 dev Neon 库 `neondb`**（与真 `users` 同库同表）；**无**独立受控实例库。
- ③ **会 ROLLBACK 的 = 2 处**（#1 p3f-lib、#7 p3p-lib）；**其余 6 处 autocommit 落库**（#2/#5 的函数本身不控事务，由调用者池决定，实测调用者均 autocommit）。
- ★ **门扫描形态 ≠ 运行时形态：8 处中 4 处（#3/#4/#6/#7）运行时为「显式给 uid」**（列清单是动态模板 `INSERT INTO public.users (${names.join(',')})`，`names` 含 `'uid'` ⇒ 扫描器读不到 `uid` 列名 ⇒ 误记为 `omitted`）。**只有 #1/#2/#5/#8 是真·省略 PK（走 identity）**。

### 1.2 ★ 关键现取：省略 PK 的插入是「当下必撞」还是「仅某些库才撞」？

**现取事实**：`users_uid_seq.last_value=41, is_called=true` ⇒ **下一枚 `nextval` = 42**；而 **`uid=42` 现存 0 行**；**`uid > 42` 的最小已占用值 = 900001**。

**判定：不是「当下必撞」，而是「条件撞」（且条件来自本库夹具残差）**：

- **当下**：真·省略 PK 的 4 处（#1/#2/#5/#8）若运行 ⇒ 取 `uid=42` ⇒ **该值空闲 ⇒ `INSERT` 成功，不撞**。（且 #1 还在 ROLLBACK 事务里。）
- **条件**：identity 序列是**单调自增计数器**，只有当它爬升到某个**已被占用的 uid** 时才撞。本库序列上方最近的已占用位 = **`900001`**（= `scripts/p4z-b6audit-01-e2e.ts:111` 的 `900001-900003` 等夹具残差）⇒ 需再消耗 **≈ 899,959 次 `nextval`**。而本仓**只有这 4 处省略-PK 站点会消耗该序列** ⇒ 正常使用下**极难到达**。
- **「某些库才撞」**：`900001/910001/970…` 这些占用位**本身就是夹具残差**（是否在库取决于该库是否跑过对应夹具）⇒ 在**没有这些残差的库**（如全新库）序列上方直到 `971213+` 都近乎空闲 ⇒ 撞号面由**库状态**决定。

**⇒ 对派单②的问法逐字回答**：**既非「当下必撞」，也非「仅在某些库必撞」**；精确口径 = **「当下不撞；仅当序列爬升到某个已占用 uid（本库最近=900001，距 42 约 9.0e5）时才会撞，而那个占用位本身依库而存在」**。

**★ 与 S37 的差异（如实登记，非洗白）**：S37 §1.2 依据 3 的**举例**（「撞到 42 这类真 uid 早已占用」/「seq_next ≤ max 为 True ⇒ 撞真行」）在本库**不成立**——`42` 空、真 `max` 的重复项来自 `MAX+1` 产品路径而非 identity。**「`users` 撞号风险来自真行、与夹具固定号无关」这一更上位判断**在**取号源分裂**（identity vs `MAX+1`）意义上仍成立；但**具体机制**应从「立刻撞真行」修正为「**序列最终撞到夹具残差行（9xxxxx/97xxxx）**」。

### 1.3 最小修法草案（**仅登记 ⇒ 本单不实施**）

| 方案 | 内容 | 面 | 判为「不宜实施」的理由 |
|---|---|---|---|
| F1（治表象） | 把 #1/#2/#5/#8 由「省略 uid」改为**显式 uid 落专用窗口**（如 `9.9e5` 隔离带），使 `users` 与门统一判据对齐 | 仅 `scripts/**` | 会改变共享 lib 的**产物 uid 值**，多个调用者以返回 uid 参与断言（如派生键/`rateeUid`）⇒ **非「明显安全」** ⇒ 不实施 |
| F2（治分裂） | 产品与夹具**统一取号源**：`users` 改用 identity（弃 `MAX+1`），或迁移处 `setval(users_uid_seq, (SELECT max(uid) FROM users), true)` 对齐 | `src/**` + `migrations/**` | **越射程**（硬口径禁改）⇒ 登记不实施 |
| F3（治门面） | 给门加**动态列清单解析**：能识别 `${names.join(',')}` 且数组含 `uid` ⇒ 判为 `explicit`（消除 #3/#4/#6/#7 的 4 处假阳） | `scripts/s36-00*` | 属**改判据**；且会**减少**命中（放宽）⇒ 与「只许加严」方向相反；**未**预先裁定 ⇒ 不实施 |

**登记**：F2 是最接近「根因」的（取号源唯一化），但受硬口径约束只能留待 Zang 另单；F1/F3 收益窄且有副作用，本单**一律不动**。

---

## §2 `currency` 22 处逐处（含调用点常量传播 + `0001:167` 判定）

### 2.1 现取：`currency` 的**显式给号源**（决定该表是否 `both_form`）

门落盘 `all_recipients`（`form==='explicit' && table==='currency'`）现取 **4 处**：

| 站点 | 显式形态 | `in_band`（门原判据） | 调用点常量传播后 |
|---|---|---|---|
| `migrations/0001_ledger_core.sql:167` | **字面量 `cid=1`**（+ 172 行 `setval(seq,1,true)`） | **in-band**（1 < 9e8） | **仍 in-band**（字面量，不可传播出带） |
| `scripts/p8-s3-01-effective.ts:117` | `$1::bigint`（`insertDraft` 形参） | in-band（参数不可证） | **可证出带** —— 调用点 `cidB=925_000_001`(234) / `cidA=925_000_002`(328) / `cidN=925_000_003`(386) 全 ≥9e8 |
| `scripts/p8-s3b-01-effective.ts:94` | `$1::bigint` | in-band | **可证出带** —— `measure(925_000_011/12/13)`(340/343/346) 全 ≥9e8 |
| `scripts/p8-s4-01-effective.ts:74` | `$1::bigint` | in-band | **仍 in-band** —— `cidA/cidB/cidC = base+{1,2,3}`，`base=900000000+(sha256(RUN)%1e5)*10`（**表达式**，不可静态证明） |

产物：`currency-callsite-propagation.json`（逐条附 `文件:行`）。

**★ 传播加装的结论（本单核心判断之一）**：即便给门加「调用点实参常量传播」，
`currency` 仍因 **`0001:167`（cid=1 字面量）+ `p8-s4:74`（表达式）** 保有 in-band 显式给号 ⇒ **仍 `both_form` ⇒ 22 处命中读数不变（读数差 = 0）**。
⇒ **加装传播零读数收益 + 属改判据（且非「加严」方向）⇒ 本单不实施**（§3）。

### 2.2 ★ `migrations/0001_ledger_core.sql:167` 现取判定

```
0001:167  INSERT INTO currency (cid, symbol, …) VALUES (1, '$', '平台积分', …);
0001:172  SELECT setval(pg_get_serial_sequence('currency','cid'), 1, true);   -- 令序列从 2 续
现取: currency_cid_seq.last_value=346, is_called=true ⇒ next=347 ; cid=1 现存 1 行 ; max(cid)=36
```

**判定：`0001:167` 是「静态 in-band、但**非活体**的撞号对」**。
理由：① 静态 `cid=1 < 9e8` ⇒ 门按「可达带」计入（保守）；② 但**序列已越过 1**（现值 346 ≫ 1）⇒ 省略-PK 的 `nextval` 今天得 347，**永不回落到 1** ⇒ `cid=1` 与当前取号域**不相交** ⇒ **非活体**。
⇒ 这正是「带感知」判据的**结构性盲区**：判据只知「值是否 ≥ floor」，**不知「序列是否已越过该值」**。属**保守假阳**，**非真风险**（与 §2.3 的 22 处残差同源）。

### 2.3 逐处表（22 处；分类 + `residual_reason`）

**分类两型**：`MIG-DO`（迁移内 DO 块行为探针，子事务回滚、迁移已 apply 冻结）× 2；`SCR-PROBE`（脚本探针/夹具省略 cid）× 20。
**共同 `residual_reason`（不可约 in-band 显式源）** = **`migrations/0001_ledger_core.sql:167`（cid=1，字面量<floor，非活体）+ `scripts/p8-s4-01-effective.ts:74`（`$1` 表达式，不可静态证明）** ⇒ 表恒 `both_form` ⇒ 该省略-PK 站点恒计命中。（`p8-s3/s3b` 若加传播可出带，但据 §2.1 **不影响结论**。）

| # | 文件:行 | 层 | 类 | `residual_reason`（逐处） |
|---|---|---|---|---|
| 1 | `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:413` | mig/DO | MIG-DO | 0011 自检探针（子事务+哨兵回滚，零残留）；**已 apply 冻结**；`0001:167`+`p8-s4:74` 使其表恒 in-band |
| 2 | `migrations/0012_replay_pre_gate_before_balance_gate.sql:1180` | mig/DO | MIG-DO | 0012 C.2 探针（哨兵子事务回滚）；**已 apply 冻结**；同上 |
| 3 | `scripts/ledger-smoke-db.ts:54` | scripts | SCR-PROBE | 省略 cid ⇒ 取 `nextval`（现得 347，空闲）；表恒 in-band（`0001:167`+`p8-s4:74`） |
| 4 | `scripts/ledger-smoke.ts:313` | scripts | SCR-PROBE | 同上 |
| 5 | `scripts/p1e-01-latency.ts:36` | scripts | SCR-PROBE | 同上 |
| 6 | `scripts/p1e-04-db-fn-probe.ts:64` | scripts | SCR-PROBE | 同上 |
| 7 | `scripts/p1f-lib.ts:163` | scripts | SCR-PROBE | 同上（db-fn 探针夹具） |
| 8 | `scripts/p2qa-11-f1-f7.ts:53` | scripts | SCR-PROBE | 同上 |
| 9 | `scripts/p2qa-11-f1-f7.ts:171` | scripts | SCR-PROBE | 同上 |
| 10 | `scripts/p2qa-12-f3-f6-f2.ts:48` | scripts | SCR-PROBE | 同上 |
| 11 | `scripts/p2qa-lib.ts:160` | scripts | SCR-PROBE | 同上（lib 夹具） |
| 12 | `scripts/p2w-lib.ts:102` | scripts | SCR-PROBE | 同上（lib 夹具） |
| 13 | `scripts/p2x-lib.ts:109` | scripts | SCR-PROBE | 同上（lib 夹具） |
| 14 | `scripts/p3n-01-rca-legs.ts:230` | scripts | SCR-PROBE | 同上（RCA 探针） |
| 15 | `scripts/p3s-00-500-rca-probe.ts:290` | scripts | SCR-PROBE | 同上 |
| 16 | `scripts/p8-s9-bttc-gate.ts:584` | scripts | SCR-PROBE | 同上（S9 门内夹具） |
| 17 | `scripts/qa-p1b-01-setup.ts:23` | scripts | SCR-PROBE | 同上 |
| 18 | `scripts/qa-p1b-05-supplycap.ts:31` | scripts | SCR-PROBE | 同上 |
| 19 | `scripts/qa-p1e-02b-api-collision.ts:30` | scripts | SCR-PROBE | 同上 |
| 20 | `scripts/qa-p1e-05-neon-ab.ts:36` | scripts | SCR-PROBE | 同上 |
| 21 | `scripts/qa-p1e-09-migration-replay.ts:79` | scripts | SCR-PROBE | 同上 |
| 22 | `scripts/qa-p1e-lib.ts:171` | scripts | SCR-PROBE | 同上（qa lib 夹具） |

（逐处结构化落盘：`currency-22-sites.json`。）

**`currency` 侧总结**：22 处**全部是保守判据的假阳**（无活体撞号对）——显式源里 `cid=1` 已被序列越过、`p8-s4` 落在 9e8 级、`p8-s3/s3b` 已上移 9.25e8。**本单不放宽判据、不动已 apply 迁移** ⇒ **22 处按 Zang 裁令保留为扫描面内保守残差**。

---

## §3 门改动（**本单：无**）与读数

**判定：不改门**，三条现取理由（均须先满足「明显安全」才可动，此处不满足）：
1. **加「调用点常量传播」零读数收益**：`currency` 恒 `both_form`（`0001:167` + `p8-s4:74`，§2.1/§2.2）⇒ 22 处不变；且该改动**属改判据**（非「只许加严」方向）⇒ 与 Zang 裁令②/派单口径相悖。
2. **加「动态列清单解析」（F3）方向为放宽**（会把 4 处 explicit 从命中移除）⇒ 与「只许加严」相悖。
3. 门当前态即 **S37 收敛态**，本次现取与 S37 逐字一致（下），无修改必要。

**现取（本单，`s36-00` 未改）**：
```
$ cd backend-ts && npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts --json .s38-artifacts/…/gate-before.json
[自证] 扫描面=3层(src:20文件/23受体 migrations:42文件/36受体 scripts:298文件/129受体)  受体数=188  命中数=30  基线数=30  新增=0  出带显式给号=5(floor=900000000)
verdict=GREEN  exit_code=0
$ npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts --selftest
SELFTEST PASS (10/10)   # 含 4 个必红例（NEG1/NEG2/NEG6/NEG7）+ POS3（出带⇒绿）
```
**命中分布**：`currency 22 · users 8`（Σ=30；基线 30，`new=0`，`STALE=0`）。**出带显式给号 = 5**（全在 `p8-s8`）。

**门文件 md5（未改锚，现取）**：
```
$ md5 -q backend-ts/scripts/s36-00-identity-pk-form-gate.ts
11de688a497b3e1cec71265074a548be
$ md5 -q backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json
37a88bc916b37fe48d0d2d753e785c7e
```
（落盘 `gate-md5.txt`；`git status` 显示门文件**零 tracked 改动** ⇒ 与 `a037737` 逐字节相同。）

---

## §4 全量门对照（14 门 = 12×`p8-s*` + `p7b-03` + `s36-00`）

**运行器**：`backend-ts/.s38-artifacts/s38-20261005T053022Z/run_gates_s38.sh s38a`（`npx ts-node --transpile-only`）。
**实例口径**：**未启用受控实例**（未启停 5796/5797/5787/5788；未 `pkill`）⇒ HTTP 腿**预期环境性红**。
**「前后对照」口径**：本单**对扫描面零改动**（`git status` tracked=0）⇒ **before ≡ after（逐字节）**；故此处以 **S38 单次全跑** 对照 **S37 收工的 after 列**（跨会话二次锚）。

| 门 | **S38 现取（s38a）** | **S37 after（对照锚）** | 红点分流 |
|---|---|---|---|
| `p8-s1-app-config` | 24/24 EXIT 0 | 24/24 EXIT 0 | — |
| `p8-s2-fee-rebate` | 44/44 EXIT 0 | 44/44 EXIT 0 | — |
| `p8-s3-deposit` | 45/45 EXIT 0 | 45/45 EXIT 0 | — |
| `p8-s3b-address` | 38/38 EXIT 0 | 38/38 EXIT 0 | — |
| `p8-s4-currency-review` | 79/79 EXIT 0 | 79/79 EXIT 0 | — |
| `p8-s5-compliance` | 117/117 EXIT 0 | 117/117 EXIT 0 | — |
| `p8-s6-site-text` | 64/64 EXIT 0 | 64/64 EXIT 0 | — |
| `p8-s7-batt-checkin` | 56/59 EXIT 1（db=7 http=1） | 56/59 EXIT 1 | **3 红** = `G8/G9/G10` `fetch failed`（真 HTTP 腿）⇒ **环境性** |
| `p8-s8-rating-timeliness` | 89/92 EXIT 1（db=13 http=1） | 89/92 EXIT 1 | **3 红** = `H5/H6/H7` `httpLive` `fetch failed` ⇒ **环境性** |
| `p8-s9-bttc` | 100/100 EXIT 0（db=10） | 100/100 EXIT 0 | — |
| `p8-s10-invite-reward` | 48/49 EXIT 1 | 48/49 EXIT 1 | **1 红** = `K8` `fetch failed` ⇒ **环境性** |
| `p8-s11-audit-console` | 86/87 EXIT 1 | 86/87 EXIT 1 | **1 红** = `K10` `fetch failed` ⇒ **环境性** |
| `p7b-03-offline-gates` | EXIT 0（`red=[]`） | EXIT 0 | — |
| **`s36-00-identity-pk-form-gate`** | 命中 **30** 基线 30 EXIT 0（OOB 5） | 命中 30 基线 30 EXIT 0 | — |
| **合计** | 14 门全跑；红=**8**（s7×3/s8×3/s10×1/s11×1） | 同左（8） | **8 红全为「真 HTTP 腿 fetch failed」· 真回归 = 0** ✓ |

**红点分流证据（现取逐条）**：`G8/G9/G10`、`H5/H6/H7`、`K8`、`K10` 的 `expect` 均为「★ … 真 HTTP（受控实例）」，`actual` 均为 `fetch failed`/`status:-1`（无实例）⇒ **环境性**，非代码回归。

**`tsc` 双口径（现取）**：
```
$ npx tsc --noEmit                          → TSC_SRC_EXIT=0（AC）
$ npx tsc -p tsconfig.scripts.json --noEmit | grep -c "error TS"   → 96   # == S37 基线，本单零改动 ⇒ 新增错 = 0
$ … | grep -E "s36-00|p8-s8"                → （空）
$ … | grep -E "p8-s3-"                      → scripts/p8-s3-01-effective.ts(199,43) TS18046（**存量债**，HEAD 亦有，与本单无关）
```

---

## §5 判负

**本单未改门 ⇒ 无「改门⇒红→绿」判负（AC5 在本单为空集，如实声明，非跳过）**。
**替代：仓外合成树判负（证明门的尺子活着 + 带感知生效；不改本仓任何文件）**：

| 控制 | 构造（`--root <合成树>`，仅 `scripts/` 层） | 现取读数 | 判定 |
|---|---|---|---|
| **NEG-GREEN** | 基线匹配的省略-cid 站点（`ledger-smoke-db.ts:54`）+ 同表 **in-band** 显式（`cid=7`） | 受体 2 / 命中 1 / 新增 0 / OOB 0 / `invalid=false` | **EXIT 0 绿** ✓（baseline 命中被抑制；in-band 显式使表 both_form） |
| **NEG-RED** | NEG-GREEN + **新增**一处省略-cid 站点 | 受体 3 / 命中 2 / **新增 1**（`scripts/zz-new-omitted.ts:1 currency`） | **EXIT 3 红** ✓（尺子会响） |
| **NEG-RED2** | 省略-cid + 同表 **≥9e8 显式**（`cid=925000007`）+ 新增省略站点 | 受体 3 / **命中 0** / 新增 0 / **OOB 1** / **`invalid=true`** | **EXIT 3**（`[INVALID] 命中数=0 但基线非空`）✓（**带感知**：9e8 显式**不**构成 both_form；且门拒绝把 0 命中当「零违例」） |

产物：`negctrl-{GREEN,RED,RED2}.json` + `negctl-{GREEN,RED,RED2}.txt` + `negctrl-root-{GREEN,RED,RED2}/`。**主仓零改动**（合成树在产物目录内）。

---

## §6 未做与 `NOT_MEASURED`（不洗白）

| # | 未做 / 未测 | 说明 |
|---|---|---|
| N1 | **未**逐点活体复现 `users` 撞号 | §1.2 的「条件撞」为**静态推断 + 序列/表现取**（未跑 `nextval`，硬口径禁）；**未**实证「消耗 899,959 次后确撞」。**不洗白为「已验」** |
| N2 | **未**做并发实验（两实例并跑是否撞固定夹具 id） | S36/N3、S37/M8 同 |
| N3 | **未**追因 `p8-s9/s8` 读数里的序列漂移 | 本单 s38a 单跑，未与二次跑对比；沿用 S37/M10 的「跑门即耗序列」口径 |
| N4 | **未**写 `docs/*.spec.md`/`OPEN-ITEMS.md`/`master-plan.md` | 硬口径禁改（三份规范件）。B18/B19/B20 的台账翻页属 Zang 面 |
| N5 | **未**改任何 `scripts/**`（含 §1.3 F1/F3） | 判为**非「明显安全」**（会改夹具产物 uid / 属改判据）⇒ 仅登记 |
| N6 | **未**动门判据 / 未加「调用点常量传播」 | §2.1/§3：零读数收益 + 方向非加严 ⇒ 不实施 |
| N7 | `NOT_MEASURED`：**受控实例 HTTP 面** | 未启停实例（硬口径禁）⇒ s7/s8/s10/s11 的 HTTP 腿**不可测**（`fetch failed`），**不**判为代码回归 |
| N8 | `NOT_MEASURED`：**其它库/Neon 分支** | 仅测 `.env.local` 指向的单一 dev 库；跨库「条件撞」**未**多库取样 |
| N9 | **未**追「门为何对 `users` 8 处中 4 处误判为 omitted」到修复 | 仅**现取定位**（动态列模板），修法 F3 登记未实施 |
| N10 | **未**核 `src` 其它 `currency` 省略-PK（`database.ts:2846/4959`）是否活体 | 属产品面（门不命中），本单不动 |

---

## §7 自曝

1. **本单零代码改动（含门）**：派单给了「若修法仅涉 `scripts/**` 且明显安全，可实施」的口子，我**逐条评估后均判为不满足「明显安全」**（F1 会改夹具产物 uid；F3 属改判据且方向为放宽）⇒ **全部只登记**。若 Zang 要求落地 F1/F3，属**新射程**，请另派。
2. **★ 我推翻了 S37 的一处具体举例**：S37 §1.2 依据 3 写「取到 42 这类真 uid 早已占用 ⇒ 撞真行」，我现取 **`uid=42` 不存在**（count=0）⇒ 该举例**不成立**。**更上位判断（`users` 取号源分裂 ⇒ 号段上移不适用）我确认成立**；只纠正其「立刻撞真行」的力度为「**条件撞夹具残差行**」。
3. **「4 处假阳」是我新发现的门的口径盲点**：#3/#4/#6/#7 运行时为显式 uid，但门因**动态列模板**看不到 `uid` 列名 ⇒ 判 `omitted`。**我不洗白为「门错了」**：门的设计口径是「形态级词法」，动态列清单本就在其能力边界外；**这 4 处恰是「门该保守的一侧」**（把不确定当 omitted ⇒ 宁多勿漏），**方向是安全的**。
4. **`currency` 22 处「保守残差」我确认为 100% 假阳**（§2.2/§2.3）：`0001:167` 已被序列越过、`p8-s4` 在 9e8 级。**但我不据此要求降判据/减基线**——判据的保守性是 Zang 已批的「加严」口径，**留残差可见 > 静默放行**。
5. **`p8-s8` 读数里的 `rating_stars_rng` 约束报错**是 **DB 腿的负向用例读数**（`pass=true`，非红）；本单 3 处红**全部**是 `H5/H6/H7 httpLive fetch failed`（§4 证据）。**未**把 DB 腿误记为回归。
6. **HEAD 漂移**：开工锚 `a037737`，收工 `99470f0`——**并发会话**推了 2 笔 docs（`77f5b61` S37 核盘 / `99470f0` §5.359），**仅触 `docs/OPEN-ITEMS.md` + `docs/seafood.master-plan.md`，与本单读/写面零交集**（§0 逐条留痕）。**非本单所为**。
7. **未做**：commit/push、`npm install`、启停实例、`pkill`、写 `.log`。连库**全程只读**（无 `nextval`/`setval`/DML/DDL）。

---

## §8 产物清单（`backend-ts/.s38-artifacts/s38-20261005T053022Z/`）

```
RUNID.txt                       本次 runid
run_gates_s38.sh                14 门运行器（phase=s38a）
s38a/_summary.txt               14 门逐门 EXIT + SUMMARY
s38a/<gate>.txt ×14             逐门原始输出
ro-db-probe.mjs / .out.json     只读连库探针 #1（server/序列名/users/currency）
ro-db-probe2.mjs / .out.json    只读连库探针 #2（pg_sequences 全表 + users_uid_seq 直查 + 全 uid 清单）
gate-before.json                门现取（受体188 / 命中30 / 基线30 / OOB5 / GREEN）
currency-callsite-propagation.py / .json   currency 显式源调用点常量传播（逐条附 :行）
users-8-sites.json              users 8 处逐处定性（形态/真跑/库/回滚/序列）
currency-22-sites.json          currency 22 处逐处分类 + residual_reason
negctrl-root-{GREEN,RED,RED2}/  仓外合成树（判负）
negctl-{GREEN,RED,RED2}.json/.txt  三态判负读数
gate-md5.txt                    门两份文件的 md5（未改锚）
```
