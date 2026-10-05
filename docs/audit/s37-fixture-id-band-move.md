# S37 / 台账 B18 · 夹具「显式给号」号段上移 —— 序列不可达带（≥ 9e8）

> 角色：Kong（实现方，子代理）· 仓库 `/Users/kevin/bistro/seafood`（Express/TS + Neon PG18）
> 本单性质：**根治**「显式给号落在序列可达带」——把**探针/夹具面**的固定号段上移到「序列不可达带」，
> 并让门（`s36-00`）**认得这个带**（否则判负不可实施，见 §5.1 F2）。
> 硬口径遵守：**改动面只在** `backend-ts/scripts/**`（5 个文件）+ 本报告；**未改** `backend-ts/src/**` /
> `backend-ts/migrations/**` / `frontend/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`；
> 连库**零**（本单全部读数**离线**；门与 `tsc` 均零 DB）；**未** `pkill -f` / `killall`；**未**启停 5787/5788；
> **未** commit / push；**未** `npm install`；原始输出不用 `.log`。
> 产物目录：`backend-ts/.s37-artifacts/s37-20261005T051842Z/`

---

## §0 对锚（开工前）

```
$ cd /Users/kevin/bistro/seafood && git log --oneline -3
dfd67fb chore(gates): S36+S36b —— B14 隐式 identity-PK 全仓盘点报告（188 处三层逐处 + 三级分级 R1=11/R2=43/R3=134
        + 与 S29 对拍未覆盖 43 全量 + NOT_MEASURED 逐条不洗白）+ 新立独立门 s36-00-identity-pk-form-gate.ts
        （同表双形态⇒红；基线 43 登记；类级自证 + selftest 7/7 + 判负仓外副本红 exit3）   ← **与派单锚一致** ✓
513ff5b docs: §5.356/v0.356 —— S35 核盘 + S36 截断与 ★我亲验 188 处分级 R1=11/R2=43/R3=134 + 派 S36b 收尾
ccfb23a docs: S35 —— B6 裁定落规范（route-layer v2.25⇒v2.26 …）+ 快照 + delta + 台账 B6 翻为闭环

$ git rev-parse HEAD
dfd67fb093ab9decdad379c410726cdf13fa07a0                                # == 派单锚 dfd67fb ✓

$ git status --porcelain | grep -c '^ M'
0                                                                       # 开工时 tracked 零改动
```

**现取依据（本单逐条复核过）**：`docs/audit/s36-implicit-identity-pk-inventory.md` §3/§4/§5/§6 ·
`backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json` · `backend-ts/scripts/s36-00-identity-pk-form-gate.ts`。
**现取读数与 S36 报告逐项一致**：受体 188 = `src 23 + migrations 36 + scripts 129`；形态 `omitted 154 + explicit 34`；
分级 `R1 11 / R2 43 / R3 134`；门基线 43（`--json` 落盘比对，见 §5.2）。

### §0.1 收工对锚（**★ HEAD 被并发会话推进，登记**）

```
$ git log --oneline -1
5bf56d7 docs: §5.357/v0.357 —— S36b 核盘（我亲跑新门 188/43/43/0 exit0 + selftest 7/7 + 零 tracked 改动）
        + ★从报告拎出新根因「显式号落在序列可达带」⇒ 新登记 B18（0030/0042 高优先=真·端到端撞号对）
        + 派 S37（号段上移 9e8 一处治两类）+ B14 闭环（门纳入验收轮）       ← **并发会话的 docs 单**
$ git show --stat --oneline 5bf56d7 | tail -3
 docs/OPEN-ITEMS.md          |  3 +++
 docs/seafood.master-plan.md | 12 ++++++++++++
 2 files changed, 15 insertions(+)
$ git show --name-only --format= 5bf56d7 | grep -E 's36-00|p8-s8|p8-s3'
（空）                                              # 并发提交**未触及**本单 5 个文件 ⇒ 无冲突、无需 rebase
```
**说明（不洗白）**：本单**开工锚 = `dfd67fb`**（§0）；开工后、收工前，**并发会话**把 §5.357/v0.357 的
两份 docs 提交为 `5bf56d7`。本单**自始至终未 commit / push**，其 5 个改动文件与 `5bf56d7` 的 **blob 无交集**
（上表 `git show --name-only` 为空 + `git diff --stat HEAD -- backend-ts/scripts/` 恰为本单 261+/210−）。

```
$ git status --porcelain | grep -E '^ M'
 M backend-ts/scripts/p8-s3-01-effective.ts
 M backend-ts/scripts/p8-s3b-01-effective.ts
 M backend-ts/scripts/p8-s8-rating-timeliness-gate.ts
 M backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json
 M backend-ts/scripts/s36-00-identity-pk-form-gate.ts
$ git status --porcelain | grep -E '^ M' | grep -vE 'backend-ts/scripts/'
（空）                                                                   # 允许面外零改动 ✓
```

**本单新增/改动面（逐处可 revert）**：
```
 M backend-ts/scripts/p8-s3-01-effective.ts           （3 行：cidB/cidA/cidN 常量）
 M backend-ts/scripts/p8-s3b-01-effective.ts          （3 行：measure(2_200_00x) 实参）
 M backend-ts/scripts/p8-s8-rating-timeliness-gate.ts （72 处号字面量 + 1 段注释；见 §3.1）
 M backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json （43 ⇒ 30 残差 + unreachable_floor + 逐条 residual_reason）
 M backend-ts/scripts/s36-00-identity-pk-form-gate.ts （+119/-?：『序列可达带』判据 + 3 个 selftest 例）
?? backend-ts/.s37-artifacts/s37-20261005T051842Z/   （本单产物）
?? docs/audit/s37-fixture-id-band-move.md            （本报告）
```

**`tsc` 双口径**（现取）：
```
$ npx tsc --noEmit
TSC_SRC_EXIT=0                                                            ✓（AC6）

$ npx tsc -p tsconfig.scripts.json --noEmit | grep -c "error TS"
96                                                                        # after
（git stash 后同命令） 96                                                  # before ⇒ 新增错 = 0
$ … | grep -E "p8-s3"        （before 与 after 同）
scripts/p8-s3-01-effective.ts(199,43): error TS18046: 'baseline.app_config' is of type 'unknown'.
                                                                          # **存量债**（HEAD 亦有）；本单只动 233/327/385 三行 ⇒ 与该错无关
$ … | grep -c "s36-00"   → 0     $ … | grep -c "p8-s8"  → 0
```

---

## §1 号段全谱（34 处显式给号）＋ ★ `users` 关键判定

### 1.1 全谱（现取：门 `all_recipients` 的 `form==='explicit'` ∩ 同文件 9xxxxx/9 位数字面量）

**取得方式**（可复现）：门落盘 `all_recipients` → 过滤 `form==='explicit'`（34 处，与 S36 §2 逐处计数一致）
→ 对每个**宿主文件**抽取 6 位 `9xxxxx` 与 9–10 位字面量集合（= 该站点实际使用的号段；
identity 值为**参数**时号段由调用点字面量给出）。产物 `explicit-sites-spectrum.json`。

| # | 层 | `文件:行` | 表.列 | identity 值来源 | **号段** |
|---|---|---|---|---|---|
| 1 | mig | `0001_ledger_core.sql:167` | currency.cid | 字面量 | **`1`**（+ 紧邻 `setval(seq,1,true)`） |
| 2 | mig | `0010_referral_bind_protocol_guard.sql:213` | users.uid | `unnest(v_probe_uids)` | **`952991-952998`** |
| 3 | mig | `0011_commission_assert…:405` | users.uid | `unnest(v_probe_uids)` | **`952981-952998`** |
| 4 | mig | `0012_replay_pre_gate…:1175` | users.uid | `unnest(v_probe_uids)` | **`960901-960902`** |
| 5 | scr | `p1t-00-bind-protocol-guard.ts:289` | users.uid | `$1::bigint[]` | `952991/952998`、`955001-955999` |
| 6 | scr | `p2b-02-cases.ts:49` | users.uid | `$1::bigint[]` | `949001-949016` |
| 7 | scr | `p2d-00-commission-m-criteria.ts:152` | users.uid | `$1::bigint[]` | `951001-951146` |
| 8 | scr | `p2qa-lib.ts:150` | users.uid | `$1::bigint[]` | 由调用方传入（本文件无字面量） |
| 9 | scr | `p2w-lib.ts:95` | users.uid | `$1::bigint[]` | 同上 |
| 10 | scr | `p2x-lib.ts:102` | users.uid | `$1::bigint[]` | 同上 |
| 11 | scr | `p3n-01-rca-legs.ts:233` | users.uid | `$1::bigint[]` | `991000` |
| 12 | scr | `p3n-01-rca-legs.ts:375` | users.uid | `$1::bigint[]` | `991000` |
| 13 | scr | `p3n-01-rca-legs.ts:382` | users.uid | `$1::bigint[]` | `991000` |
| 14 | scr | `p4z-b2a-01-fixture.ts:124` | users.uid | `$1` | `970001/970002/970099` |
| 15 | scr | `p4z-b2ahttp-02-patch-users-cols.ts:60` | users.uid | 文本生成（补丁模板） | 源为产品串（`${String(nextUserId)}`） |
| 16 | scr | `p4z-b2ahttp-02-patch-users-cols.ts:62` | users.uid | 文本生成（补丁模板） | 同上 |
| 17 | scr | `p4z-b2b-02-listing.ts:133` | users.uid | `$1` | `970101/970102` |
| 18 | scr | `p4z-b2c-02-probe.ts:101` | users.uid | `${uid}` | `970201/970202` |
| 19 | scr | `p4z-b6audit-01-e2e.ts:111` | users.uid | `$1,$2` | `900001-900003` |
| 20 | scr | `p4z-b6audit-02-idemkey.ts:205` | users.uid | `$1,$2` | `910001-910013`、`920001/920002` |
| 21 | scr | `p4z-b6audit-02-idemkey.ts:209` | users.uid | `$1,$2` | 同上 |
| 22 | scr | `p4z-b6audit-live-01.ts:158` | users.uid | `$1` | `971100` |
| 23 | scr | `p7b-06-fixture-setup.ts:39` | users.uid | `$1` | `900001-900008` |
| 24 | scr | `p8-s10-invite-reward-gate.ts:352` | users.uid | `$1` | 由调用点传入（文件无字面量） |
| 25 | scr | `p8-s3-01-effective.ts:117` | currency.cid | `$1::bigint` | 调用点 `2_100_001-003` ⇒ **本单改 925_000_001-003** |
| 26 | scr | `p8-s3b-01-effective.ts:94` | currency.cid | `$1::bigint` | 调用点 `2_200_001-003` ⇒ **本单改 925_000_011-013** |
| 27 | scr | `p8-s4-01-effective.ts:74` | currency.cid | `$1::bigint` | `900000000 + (h%1e5)*10 +{0..3}`（**已在 9e8 级**） |
| 28 | scr | `p8-s8-rating-timeliness-gate.ts:576` | users.uid | `$1::bigint` | **`981001-981021`**（★ 不动，见 §1.2） |
| 29 | scr | `p8-s8-rating-timeliness-gate.ts:579` | job.job_id | 字面量 | `900001-900002` ⇒ **920000001-920000002** |
| 30 | scr | `p8-s8-rating-timeliness-gate.ts:589` | job_submission.submission_id | 字面量 | `900901` ⇒ **921000001** |
| 31 | scr | `p8-s8-rating-timeliness-gate.ts:591` | listing_order.order_id | 字面量 | `900201-900205` ⇒ **922000001-922000005** |
| 32 | scr | `p8-s8-rating-timeliness-gate.ts:597` | listing_order_event.event_id | 字面量 | `900921-900924` ⇒ **923000001-923000004** |
| 33 | scr | `p8-s8-rating-timeliness-gate.ts:603` | rating.rating_id | 字面量 | `900911-900914` ⇒ **924000001-924000004** |
| 34 | src | `database.ts:2158` | users.uid | `${nextUserId}`（产品路径） | **=`MAX(uid)+1`**（不占序列，见 §1.2） |

**按表归并**：`users.uid 27 处`（含 3 处迁移冻结 + 1 处产品路径）· `currency.cid 4 处`（1 迁移 + 3 脚本）·
`job/job_submission/listing_order/listing_order_event/rating` 各 1 处（全在 `p8-s8`）。
**9 位（9e8 级）现存量**：仅 `p8-s4` 的 currency 动态带 `[900000000, 900999993]` 与产品路径（§1.2）。

### 1.2 ★ 关键判定：**`users` 必须排除于本修法之外**（现取依据）

**依据 1（代码，逐字）——`users.uid` 不走序列、走 `MAX(uid)+1`**：
```
$ sed -n '2073,2081p' backend-ts/src/database.ts
export class DatabaseService {
  static async getNextUserId(): Promise<number> {
    const sql = getSql();
    const rows = asItems<{ next_id: number }>(await sql`
      SELECT COALESCE(MAX(uid), 0) + 1 AS next_id
      FROM public."users"
    `);
```
⇒ 真用户 uid = **表内当前 max + 1**。夹具把 uid 写到 **9e8** ⇒ **下一枚真 uid 立刻变 9e8+1**：
号段上移对 `users` **不但无效（序列不是它的取号源），反而把产品 id 空间顶到 9e8 级**。

**依据 2（全仓穷举）——`src/**` 里唯一的运行期取号器就是它**：
```
$ grep -rnE 'nextval\(|setval\(|MAX\(' backend-ts/src/*.ts | grep -v '^\s*//'
backend-ts/src/database.ts:2077:      SELECT COALESCE(MAX(uid), 0) + 1 AS next_id
（仅此一条）
```
⇒ 其余 22 张 identity 表**全部**走 `GENERATED BY DEFAULT AS IDENTITY` 的 `nextval` ⇒ 号段上移对它们**有效**。

**依据 3（撞号机制不同向）——`users` 的风险来自「真行」而非「夹具固定号」**：S36 §1.1 现取
`users`：`seq_next = 42` 而 `max(uid) = 971213`（**唯一** `seq_next ≤ max(PK)` 为 True 的表）。
即：省略 PK 的 `INSERT INTO users` 取到 42 这类**真 uid 早已占用**的值 ⇒ 撞的是真行。
**把夹具号段上移对此毫无作用**（撞号点在真 uid 域），属**另一类缺陷、须另法**。

### 1.3 现取：`frontend/src/test/**` 是否含固定号？——**含，但不在本修法射程，不改**

```
$ grep -rnE '\b(9[0-9]{5}|9810[0-9]{2})\b' frontend/src/test | head
frontend/src/test/unit/p7a-ledger-error-i18n.test.js:33:const USER = { uID: 970001, token: 'real-token-shape' }
frontend/src/test/unit/p7a-ledger-error-i18n.test.js:110: … uID: 970002 …
frontend/src/test/unit/d1-batt-reason-i18n.test.js:4: … 生产 · uid 970213 · batt 低于承接门槛 …
frontend/src/test/unit/ledger-flow-behavior.test.jsx:72:  uid: 970001,
frontend/src/test/unit/p7c-errmsg-machinecode.test.js:222: … { uID: 970001, … }
frontend/src/test/unit/p6-btn-impl.test.js:132: { 'x-range': { d: [999999, '#FFE60F'] … } }
frontend/src/test/unit/p7b-errfallback.test.js:233: … { uID: 970001, … }
```
**判定：不动。** 逐条理由：① 这些是**前端单测的 mock 入参**（`vi.fn` 假 `fetchCurrentUser` /
`uid: 970001` 的**读**夹具），**无一处** `INSERT INTO <identity 表>`；② 它们不在 S36 的 188 受体面
（受体限型 = `src/*.ts` + `migrations/*.sql` + `scripts/*.{ts,js,mjs,cjs}`）⇒ **不构成 R1/R2 的任何一处**；
③ 号段 `970001/970002/970213` 与 `users` 的**真 uid 域（≤971213）同域**，但那是「前端 mock 用真 id 形态」的
**有意选择**（模拟真实用户），改成 9e8 会**降低**测试保真度且**无任何撞号收益**（前端不写库）。
⇒ **登记为「已现取、判定不改」，非疏漏**（§8/N-M6）。

---

## §2 新带分配（9e8 级）与不重叠校验

### 2.1 分配（按表 1e6 槽位偏移，基 `900,000,000`）

| 表 | identity 列 | **新号段** | 用到的值 | 余量 | 处置 |
|---|---|---|---|---|---|
| `job` | job_id | `920,000,001 - 920,000,099` | `920000001-2` | 98 | **已上移** |
| `job_submission` | submission_id | `921,000,001 - 921,000,099` | `921000001` | 99 | **已上移** |
| `listing_order` | order_id | `922,000,001 - 922,000,099` | `922000001-5` | 95 | **已上移** |
| `listing_order_event` | event_id | `923,000,001 - 923,000,099` | `923000001-4` | 96 | **已上移** |
| `rating` | rating_id | `924,000,001 - 924,000,099` | `924000001-4` | 96 | **已上移** |
| `currency` | cid | `925,000,001 - 925,000,099` | `925000001-3`（p8-s3）/ `925000011-13`（p8-s3b） | 87 | **已上移** |
| `users` | uid | **不分配** | — | — | **排除**（§1.2；走 `MAX(uid)+1`） |

**基与下界**：全部 ≥ `900,000,000` = 门基线 `unreachable_floor`（本单新增键）。
**判定「不可达」的口径（诚实边界）**：序列**非有界**，任何有限固定号**理论上**终会到达；
「不可达带」= **在可预见的运维时域内不可达**——以现序对比：`job_job_id_seq=265`、`listing_order=40`、
`event=377`、`rating=377`、`currency=339` ⇒ 9e8 与现值差 **6 个数量级**（≈ 10⁶ 倍余量）。

### 2.2 三项必核

**① 列类型上限**（现取 DDL，非推断）：
```
$ grep -rniE '(job_id|submission_id|order_id|event_id|rating_id|cid|uid)\s+(bigint|integer|int|bigserial)\s+GENERATED' migrations/*.sql
migrations/0001_ledger_core.sql:14:  cid            bigint      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
migrations/0002_user_identity.sql:12:  uid             bigint      GENERATED BY DEFAULT AS IDENTITY,
migrations/0013_job.sql:80:  job_id             bigint      GENERATED BY DEFAULT AS IDENTITY,
migrations/0014_job_flow.sql:116:  submission_id bigint      GENERATED BY DEFAULT AS IDENTITY,
migrations/0015_listing.sql:154:  order_id           bigint      GENERATED BY DEFAULT AS IDENTITY,
migrations/0031_rating_and_order_event.sql:57:  rating_id           bigint      GENERATED BY DEFAULT AS IDENTITY,
migrations/0031_rating_and_order_event.sql:114:  event_id            bigint      GENERATED BY DEFAULT AS IDENTITY,
```
⇒ **全 `bigint`**（上限 9.22e18）；新带 9.2e8 **余 10 个数量级** ✓（且**即便某列退化为 int4**（2.147e9）亦不越界 ⇒ 双保险）。

**② 不与其它表/它处已有号段重叠**（现取：三类存量带 vs 新带）：
| 存量带 | 值域 | 是否与新带相交 |
|---|---|---|
| `p8-s4` currency 动态带 | `[900000000, 900999993]` | 否（新带最低 920000001 > 900999993，**间隔 1900 万**）✓ |
| 各脚本 `9xxxxx` 级夹具带（`900xxx/910xxx/949xxx/951xxx/952xxx/955xxx/960xxx/970xxx/9810xx/991000`） | ≤ `991000` | 否（差 3 个数量级）✓ |
| 数值哨兵 `999999 / 999999999 / 2147483647`（上界/溢出负向用例的值，**非 identity id**） | 哨兵 | 否（非 identity 域）✓ |
| 新带内部 | `920|921|922|923|924|925` + `000001-99` | **六槽互斥、无交集** ✓ |
| 同表内既有带（迁移冻结） | currency `cid=1` | 与 `925000001-13` 不相交 ✓ |

**③ 不与产品真实取号方式冲突**：
- `job/job_submission/listing_order/listing_order_event/rating/currency` 全部走序列（§1.2 依据 2 穷举）
  ⇒ 夹具固定号**只占用该号段本身**，不改变产品的取号起点（**非** `MAX` 依赖）✓
- `users` **排除**（依据 1）✓
- `scripts/ns-alloc.ts` 是**只读命名空间扫描探针**（S36 §5.2 口径），**非运行期分配器** ⇒ 无冲突 ✓

---

## §3 逐处改动（改前 ⇒ 改后）

### 3.1 `scripts/p8-s8-rating-timeliness-gate.ts`（**72 处字面量 + 1 段注释**；逐处日志 `p8s8-band-move-log.json`）

| identity | 表.列 | **改前 ⇒ 改后** | 处数 | 触及行 |
|---|---|---|---|---|
| ① | `job.job_id` | `900001 ⇒ 920000001` | 10 | 580,583*,622,626,630,634 |
| ① | `job.job_id` | `900002 ⇒ 920000002` | 3 | 581,583*,590 |
| ② | `job_submission.submission_id` | `900901 ⇒ 921000001` | 1 | 590 |
| ③ | `listing_order.order_id` | `900201 ⇒ 922000001` | 7 | 583*,592,598-601,611 |
| ③ | `listing_order.order_id` | `900202 ⇒ 922000002` | 15 | 593,686-693 |
| ③ | `listing_order.order_id` | `900203 ⇒ 922000003` | 12 | 594,694,695,697,708,718-720 |
| ③ | `listing_order.order_id` | `900204 ⇒ 922000004` | 6 | 595,707,718-720 |
| ③ | `listing_order.order_id` | `900205 ⇒ 922000005` | 10 | 583*,596,698,700,706,718-720 |
| ④ | `listing_order_event.event_id` | `900921-900924 ⇒ 923000001-923000004` | 4 | 598-601 |
| ⑤ | `rating.rating_id` | `900911-900914 ⇒ 924000001-924000004` | 4 | 604-607 |

（`*` = 注释行；注释段 582-588 已重写为「新带 + uid 例外 + 原 S29 窗口留痕」）

**为何是同批替换（连带面）**：这些号在门内**互为引用**——`job_submission.job_id` 指向本门 job 行、
`listing_order_event.order_id` 指向本门 order 行、`V1..V4` 的 `targetId` 与幂等键 `biz:rating:<uid>:job:<job_id>`
指向本门 job 行。⇒ 只改「插入点」会造成自相矛盾的夹具。本次以**词界精确替换**（`(?<![0-9])…(?![0-9])`）
同批改 72 处，**逐处留痕**（含行号与上下文，`p8s8-band-move-log.json`）⇒ 可逐处 revert。

**★ 不改的**：`users.uid` 的 `981001-981021`（§1.2 排除）；`rating.target_id` 的 `900011-900014`
（**非 identity 列**，不参与撞号机制 ⇒ 出射程，登记 §8/N-M4）。

### 3.2 `scripts/p8-s3-01-effective.ts` / `scripts/p8-s3b-01-effective.ts`（currency 探针 cid）

| 文件:行 | 改前 ⇒ 改后 | 为何 |
|---|---|---|
| `p8-s3-01-effective.ts:233` | `const cidB = 2_100_001 ⇒ 925_000_001` | `2.1e6` 落在序列可达区（`currency_cid_seq` 现值 339，终将涨到 2.1e6）⇒ 上移 9e8 级 |
| `p8-s3-01-effective.ts:327` | `const cidA = 2_100_002 ⇒ 925_000_002` | 同上 |
| `p8-s3-01-effective.ts:385` | `const cidN = 2_100_003 ⇒ 925_000_003` | 同上 |
| `p8-s3b-01-effective.ts:340` | `measure(2_200_001,…) ⇒ measure(925_000_011,…)` | 同上 |
| `p8-s3b-01-effective.ts:343` | `measure(2_200_002,…) ⇒ measure(925_000_012,…)` | 同上 |
| `p8-s3b-01-effective.ts:346` | `measure(2_200_003,…) ⇒ measure(925_000_013,…)` | 同上 |

**为何只改调用点常量**：`insertDraft(tx, cid, …)` 的 `cid` 是纯局部变量，幂等键/账户读/断言**全部由该变量派生**
⇒ 改常量即全网一致（无散落硬编码；`grep -nE '2[12]0000[0-9]|2_[12]00_00'` 现取仅此 6 处）。
**门读数影响**：**零**——该两站点的 identity 值是 `$1`（**不可静态证明**）⇒ 按 §5.1 的**保守判据**仍计为「可达」。
⇒ 这是**真实风险下移**（2.1e6 ⇒ 9.25e8）而非门面数字游戏。

### 3.3 未动（**明列，防误记**）
`p8-s4-01-effective.ts`（cid 已在 9e8 级）· `p4z-*`/`p2*`/`p1*`/`p7b-*` 的 uid 带（**全属 `users` ⇒ 排除**）·
`migrations/**`（**已 apply，硬口径禁改**；`0001:167 cid=1` / `0010,0011,0012` 的 `952xxx/9609xx` 探针 uid 均**留滞**，
构成 §5.3 残差）· `src/**`（零改动）· `frontend/src/test/**`（§1.3 判定不改）。

---

## §4 连带期望同步（逐处「改前⇒改后 + 为何」）

**读法**：本门的「期望」分两类 —— ① **字面量断言**（`evN(900202) === 1` 等）；② **派生键**
（`biz:rating:981001:job:900001`、`biz:listing:ship:900202`）。**两类都已随 §3.1 同批改锚**，理由与锚点如下：

| 类 | 例（改前 ⇒ 改后） | 行 | 为何必须同改 |
|---|---|---|---|
| 夹具 FK 引用 | `job_submission.job_id` `900002 ⇒ 920000002` | 590 | 指向本门刚插入的 job 行；不同改 ⇒ **FK 违约（非撞号类的假红）** |
| 事件行 FK | `listing_order_event.order_id` `900201 ⇒ 922000001` ×4 | 598-601 | 指向本门 order 行 |
| 断言入参 | `evN/stOf(900203) ⇒ evN/stOf(922000003)` | 695,697,714?,718-720 | 断言「该 order 的事件行数/状态」——号不同则该断言指向别的行 |
| 服务调用入参 | `mkTx({orderId: 900202 ⇒ 922000002})` ×5 | 686,690,694,698 | 状态机用例必须打在**本门建的**那一单 |
| 幂等键（派生） | `'biz:listing:ship:900202' ⇒ '…:922000002'` | 686,690,694,698 | 键 = `biz:listing:<action>:<order_id>`（函数内确定性派生）⇒ 键中号必须与 `order_id` 一致，否则同键异体 ⇒ 假 `CREATE_KEY_REUSED` |
| 幂等键（派生） | `'biz:rating:981001:job:900001' ⇒ '…:920000001'` | 622,626,630 | 键含 `job_id` ⇒ 同上 |
| `targetId` | `targetId: 900001 ⇒ 920000001` ×4 | 622,626,630,634 | `submitRating` 由 `target_id` **反查 job 行**推导 `ratee_uid`（断言 `rateeUid===981009`）⇒ 若不同改则反查落空、V1 假红 |
| 只读负向 | `DELETE … WHERE order_id = 900201 ⇒ 922000001` | 611 | 打向本门 order 行 |
| 文案 | `'★ …（order 900202 事件行 = 1）' ⇒ 922000002` | 688,692,700,719 | 读数文案须与断言同号（**非判据**，但不得留旧号 → 审计误导） |
| 对象键名 | `{ ev_900203: … } ⇒ { ev_922000003: … }` | 720 | 仅键名，随批量替换改变（**无副作用**） |

**判据未放宽（逐条自证，现取原文）**：
```
$ diff <(grep -oE '"(id|V[0-9]+|C[0-9]+)"' before/p8-s8-….txt | sort -u) \
       <(grep -oE '"(id|V[0-9]+|C[0-9]+)"' after/p8-s8-….txt  | sort -u)
（空）                          # 用例 id 集合一字不变；断言式/阈值/`pass` 判定逻辑零改动

$ diff before/p8-s8-….txt after/p8-s8-….txt | grep -cE '^[<>]'
30                              # 差异行总数
$ … | grep -E '^[<>]' | grep -vE '9200000|9220000|9210000|9230000|9240000|900001|900002|900201|900202|900203|900204|900205|900901|90091[1-4]|90092[1-4]|generated_at|"run"|artifact'
< …"rateeUid":981009,"ratingId":379,"stars":4}"       # ← **唯一残余差异**
> …"rateeUid":981009,"ratingId":377,"stars":4}"
< …"rateeUid":981009,"ratingId":379,"stars":null}"
> …"rateeUid":981009,"ratingId":377,"stars":null}"
```
⇒ **除号字面量/时间戳/路径外，唯一差异 = `ratingId 379 ⇒ 377`** —— 这是 **`rating_rating_id_seq` 在
`before`/`after` 两次跑之间被消耗**（`p8-s9` 之类提交型用例真插 rating 行）的**序列漂移**，
与 §6 的 `p8-s9 cid/txid`、`p8-s3` 系同族；**非判据、非期望改动**（该字段是**事实读数**，`pass` 判定不依赖其值）。

（同法核未触及的门：`p8-s3b-address` / `p8-s4-currency-review` 的 `diff` **仅** `generated_at`/`run`/artifact 路径；
`p8-s3-deposit` 同 ⇒ **判据与计数零改动**。）

---

## §5 新门与两类风险重测

### 5.1 ★ 先行发现（**本单第一个结构性判断**）：原门判据**看不见号段**

**现取**：`s36-00` 原实现（`dfd67fb`）的命中判据是**形态级**——`both_form_tables` 由
`h.form === 'explicit' ? 'explicit' : 'omitted'` 聚合；**`form` 只取决于 identity 列是否出现在列清单里，与值的大小无关**。
⇒ ① 把号从 `900xxx` 搬到 `9e8`，**`form` 不变** ⇒ **原门读数恒定 43**（改动不可测）；
② 派单 §7 的**判负**（「把某一处号段改回 `900xxx` ⇒ 新门必红」）在原判据下**物理上不可能**
（改值不改形态 ⇒ 门必绿）⇒ AC5 不可达。

**处置（不换修法，只补判据）**：按派单**根因**（「显式号落在序列可达带」）把 `explicit` 侧判据细化为
**带感知**——`in_band = identity 值**不能证明** ≥ unreachable_floor`。**保守方向明确**：
```
   · 整型字面量且 ≥ floor      ⇒ out-of-band（该站点不再使该表构成撞号对）
   · 参数($1)/表达式/子查询/SELECT ⇒ **仍计 in-band**（不可静态证明 ⇒ 不放行）
   · 多行 VALUES ⇒ 逐元组核，任一 <floor 或不字面量 ⇒ in-band
```
⇒ **只豁免「可证的 9e8 级站点」**，未知形态一律按原口径。**自证**：selftest 由 `7/7 ⇒ 10/10`，
新增 `POS3（出带⇒绿）/ NEG6（出带+未出带混合⇒仍红，防整表豁免）/ NEG7（参数不可证⇒保守仍红）`。

```
$ npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts --selftest
  PASS  NEG1 … POS1 … NEG2 … POS2 … NEG3 … NEG5 … NEG4 …
  PASS  POS3 同表显式全为 9e8 级字面量（出带）⇒ 绿  [hits=0 out_of_band=1 red=false]
  PASS  NEG6 出带字面量 + 未出带字面量 混合 ⇒ 仍红（不整表豁免）  [hits=1 out_of_band=1 red=true]
  PASS  NEG7 显式侧取参数/子查询（不可证）⇒ 保守仍红  [hits=1 out_of_band=0 red=true]
SELFTEST PASS (10/10)
```

### 5.2 新门读数（三态）

| 态 | 受体 | **命中** | 基线 | 新增 | 出带显式给号 | verdict |
|---|---|---|---|---|---|---|
| **before**（原门 + 原基线与原夹具） | 188 | **43** | 43 | 0 | —（原门无此维） | GREEN |
| **mid**（新门 + **原基线 43**） | 188 | **30** | 43 | 0 | 5 | GREEN + `[STALE-WARN]` **13** |
| **after**（新门 + 同步基线 30 + 上移后夹具） | 188 | **30** | 30 | 0 | 5 | **GREEN** ✓ |

**命中分布（before ⇒ after）**：
```
before: currency 22 · job 7 · job_submission 3 · listing_order 3 · listing_order_event 0 · rating 0 · users 8   Σ=43
after : currency 22 · users 8                                                                                  Σ=30
```
**出带站点（现取，5 处，全在 p8-s8）**：`job.job_id@579` / `job_submission.submission_id@593` /
`listing_order.order_id@595` / `listing_order_event.event_id@601` / `rating.rating_id@607`。

**★ 命中确实从 43 降到 30（−13）**，且 **13 处恰为** `job(7) + job_submission(3) + listing_order(3)`——与 §5.1 判据推导**逐条吻合**。

### 5.3 「仍命中」逐条说明（**不洗白；这 30 处未修**）

| 表 | 命中 | 仍命中的**显式源** | 为何上移治不了它 | 真实风险（现取判读） |
|---|---|---|---|---|
| `currency` | 22 | ① `migrations/0001_ledger_core.sql:167`（`cid=1` 顶层种子，**已 apply 禁改**）② `p8-s3/s3b` 的 `$1`（**已上移到 9.25e8，但参数值不可静态证明 ⇒ 判据保守计入**）③ `p8-s4` 的 `$1`（动态 9e8） | ① 冻结在迁移里，脚本面无权处置；②③ 是**保守判据**的必然结果（"不可证 ⇒ 视同可达"） | **本单已实质下降**：脚本侧固定 cid 由 `2.1e6/2.2e6`（可达）上移到 `9.25e8`；`0001` 的 `cid=1` **在序列现值 339 之**前**（已越过）⇒ 非撞号对；`p8-s4` 原已在 9e8。⇒ **22 处货币残差 = 保守判据的假阳性，非活体风险**（但**未被门放行**：仍登记在基线 ⇒ 每次跑门都可见） |
| `users` | 8 | ① `p8-s8:576` 等 24 处脚本 uid 带 ② `migrations/0010/0011/0012` 的 `952xxx/9609xx`（**冻结**）③ 产品路径 `MAX(uid)+1` | **§1.2：`users` 整表排除**（MAX 取号 ⇒ 上移反而污染真 uid 空间；且真风险来自真行） | **真实且未修**：`users_uid_seq=42` 而真 `max(uid)=971213` ⇒ 省略 PK 的 users 插入**取到 42 就会撞真行**。**须另法**（§8 / 交付建议） |

**⇒ 派单口径「② R2 的 43 处…在序列涨到 9e8 前**全部**安全」——**不成立**：**
**13/43 成立**（job/job_submission/listing_order）；**22/43 属保守判据残差（实质已降但未消）**；
**8/43（users）排除且真风险仍在**。**本单不把 30 当绿**：基线仍**逐条登记 + 每行带 `residual_reason`**，
门每次运行都打印命中数与 OOB 数（无法静默通过）。

### 5.4 R1（11 处）重测——逐条核「现在是否序列不可达」

| # | 站点 | 表 | **撞号对是否成立** | **本单后** |
|---|---|---|---|---|
| 8 | `migrations/0030:314` | `listing_order.order_id` | 原成立（同表夹具 `900201-900205`） | ★ **已破**：同表固定号 ⇒ `922000001-5`（≥9.22e8）；`listing_order_order_id_seq=40` ⇒ **不可达** ✓ |
| 11 | `migrations/0042:235` | `job.job_id` | 原成立（同表夹具 `900001-900002`） | ★ **已破**：⇒ `920000001-2`；`job_job_id_seq=265` ⇒ **不可达** ✓ |
| 1 | `src/database.ts:3171` | `job_arbitration_log.log_id` | **不成立**（全仓无该表显式给号） | 无变化（仅剩耗号） |
| 2,3 | `migrations/0016:569/830` | `market_order` / `market_trade` | **不成立**（无显式给号） | 无变化 |
| 4,5 | `migrations/0023:219/260` | `admin_ops_audit_log.log_id` | **不成立** | 无变化 |
| 6,7 | `migrations/0024:180/227` | `admin_refund_audit_log.log_id` | **不成立** | 无变化 |
| 9,10 | `migrations/0034:803/828` | `ledger_entry.txid`（ALWAYS） | **不成立**（无显式给号） | 无变化 |

**⇒ R1 的「真·端到端撞号对」= 2/11，本单**全部破除**；余 9/11 从无撞号对（风险形态=耗号/gaps，非撞号）。**
（派单「R1 11 处同样安全」应修正为：**2 处由本单根治；9 处本无此风险**。）

---

## §6 全量门前后对照（**13 门 + `p7b-03` + 新门 `s36-00`**，前后逐门，非只跑同名门）

**运行器**：`backend-ts/.s37-artifacts/s37-20261005T051842Z/run_gates_s37.sh <before|after>`（`npx ts-node --transpile-only`；
**before 用 `git stash` 取原态、跑完 `git stash pop` 复原**，现取 `grep -c '^ M'` 已回 5）。
**实例口径**：**未启用受控实例**（未启停 5796/5797/5787/5788；**未** `pkill -f`/`killall`）⇒ HTTP 腿**预期环境性红**。

| 门 | **before** | **after** | 对照 | 红点分流 |
|---|---|---|---|---|
| `p8-s1-app-config` | 24/24 EXIT 0 | 24/24 EXIT 0 | 逐字一致 ✓（差异仅 `generated_at`/`run`） | — |
| `p8-s2-fee-rebate` | 44/44 EXIT 0 | 44/44 EXIT 0 | 同上 ✓ | — |
| `p8-s3-deposit` | 45/45 EXIT 0 | 45/45 EXIT 0 | 同上 ✓（`diff` **仅**时间戳/路径） | — |
| `p8-s3b-address` | 38/38 EXIT 0 | 38/38 EXIT 0 | 同上 ✓ | — |
| `p8-s4-currency-review` | 79/79 EXIT 0 | 79/79 EXIT 0 | 同上 ✓ | — |
| `p8-s5-compliance` | 117/117 EXIT 0 | 117/117 EXIT 0 | 同上 ✓ | — |
| `p8-s6-site-text` | 64/64 EXIT 0 | 64/64 EXIT 0 | 同上 ✓ | — |
| `p8-s7-batt-checkin` | 56/59 EXIT 1（`db=7 http=1`） | 56/59 EXIT 1 | 计数逐字一致 ✓ | **3 红** = `G8/G9/G10` `fetch failed`/**环境性 HTTP 腿** ⇒ 非真回归 |
| `p8-s8-rating-timeliness` | 89/92 EXIT 1（`db=13 http=1`） | **89/92 EXIT 1** | 计数/通过集**逐字一致** ✓ | **3 红** = `httpLive` 组 `fetch failed` ⇒ 非真回归（**号段上移未致任何新红**） |
| `p8-s9-bttc` | 100/100 EXIT 0（`db=10`） | 100/100 EXIT 0 | 计数一致；文内读数 `cid 343→339`、`txid 2575→2566` | **⚠ 非代码差异 = 序列漂移**（见下） |
| `p8-s10-invite-reward` | 48/49 EXIT 1 | 48/49 EXIT 1 | 逐字一致 ✓ | 1 红 = `fetch failed` 环境性 HTTP 腿 |
| `p8-s11-audit-console` | 86/87 EXIT 1 | 86/87 EXIT 1 | 逐字一致 ✓ | 1 红 = `fetch failed` 环境性 HTTP 腿 |
| `p7b-03-offline-gates` | 37/37 EXIT 0 `red=[]` | 37/37 EXIT 0 `red=[]` | ✓ | —（含 AC10 码闭集 33 / 注册点 89） |
| **`s36-00-identity-pk-form-gate`**（新门） | 命中 **43** 基线 43 EXIT 0 | 命中 **30** 基线 30 EXIT 0 | **43 ⇒ 30**（−13）✓ | — |
| **合计** | 14 门全跑；红 = **8 条 HTTP 腿**（s7×3 / s8×3 / s10×1 / s11×1） | 同左（8 条） | 除 `s36-00` 有意收口外**逐门不变** | **8 红全为环境性 HTTP 腿 · 真回归 = 0** ✓ |

**★ 一处必须点名的「非代码差异」（诚实登记）**：`p8-s9` 的读数在 before/after 间由
`cid 343 → 339`、`txid 2575 → 2566`；`p8-s8` 的 `ratingId 379 → 377`（§4）—— 这是 **`before` 与 `after`
两次运行各自消耗了 `currency_cid_seq` / `ledger_entry_txid_seq` / `rating_rating_id_seq`**（相关用例真插行）
⇒ **跑门本身就在推进序列**，正是 S36/R1 所述「序列非事务性」的**现场复现**。
**判定：非本单代码所致**（本单零改动 `src`/`migrations`；且两处差异**方向不一致**——`p8-s9` 是后跑者**更小**、
`p8-s8` 是后跑者**更小**，而时序上 `after` 先跑、`before` 后跑 ⇒ 只能由**两次跑之间的并发/前置消耗**解释），
登记为**环境性序列漂移**，**不影响**本门/本单结论（这些字段均为**事实读数**，不参与 `pass` 判定）。

---

## §7 判负（**主仓内注入 ⇒ 红；复原 ⇒ 绿；主仓零残留**）

**做法**（派单 §7 逐字）：把 `p8-s8` 的 `job` 号段**改回 `900xxx`**（`920000001/2 ⇒ 900001/2`，9 处）⇒ 跑新门。
```
$ python3 … re.sub('920000001','900001'), re.sub('920000002','900002') on scripts/p8-s8-rating-timeliness-gate.ts
reverted job band 920000001/2 -> 900001/2 : 9 occ

$ npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts --json …/gate-negctrl.json
[自证] 扫描面=3层(…)  受体数=188  命中数=37  基线数=30  新增=7  出带显式给号=4(floor=900000000)
[NEW] scripts/p3f-lib.ts:102 job.job_id (test/scripts)
[NEW] scripts/p4z-audjk-01-probe.ts:145 job.job_id (test/scripts)
[NEW] scripts/p4z-b2a-01-fixture.ts:140 job.job_id (test/scripts)
[NEW] scripts/p4z-b2b-02-listing.ts:142 job.job_id (test/scripts)
[NEW] scripts/p4z-tr1b-01-e2e-stub.ts:103 job.job_id (test/scripts)
[NEW] scripts/p4z-tr1b-01-e2e-stub.ts:133 job.job_id (test/scripts)
[NEW] scripts/p8-s10-invite-reward-gate.ts:379 job.job_id (test/scripts)
EXIT=3                                                                    # ★ 红 ✓（AC5）
```
**复原**（备份 → `cp` 回 + `md5` 对锚）：
```
$ cp …/p8s8-negctrl-backup.ts scripts/p8-s8-rating-timeliness-gate.ts
$ md5 -q scripts/p8-s8-…ts   → 9b275ec11585372206adfc4715833136
$ cat …/p8s8-md5-green.txt   → 9b275ec11585372206adfc4715833136          # 逐字节一致 ✓
$ npx ts-node --transpile-only … --json …/gate-negctrl-restored.json
[自证] …  命中数=30  基线数=30  新增=0  出带显式给号=5(floor=900000000)
EXIT=0                                                                    # ★ 绿 ✓
```
**主仓零残留**：`git status --porcelain | grep -E '^ M'` = **恰 5 个脚本文件**（与 §0.1 同）；
`p8-s8` 内 `\b900001\b|\b900002\b` 仅剩 **1 行（586，注释里对**原 S29 窗口**的留痕叙述）**——**非代码路径**。

---

## §8 未做与 `NOT_MEASURED`（**不洗白**）

| # | 未做 / 未测 | 说明 |
|---|---|---|
| M1 | **`users` 的撞号风险未处置** | §1.2 / §5.3：`users` 整表排除 ⇒ 其 8 处 R2 + 真行撞号风险**仍在**。**须另法**（建议：夹具对 `users` 一律**不省 PK**，或迁移收口处 `setval(users_uid_seq, max(uid)+1, false)` + 独立巡检门） |
| M2 | **`currency` 22 处残差未消** | 显式源含**已 apply 的迁移**（`0001:167`）⇒ 脚本面无权收口（硬口径禁改迁移）。**若须清零 ⇒ 须改迁移或用别的判据**，属越射程 ⇒ **本单不越** |
| M3 | **未逐处活体复现撞号** | 无 43 处的逐点撞号实验（S36/N1 同）；本单的全部读数为**静态扫描 + 离线判据** |
| M4 | `rating.target_id` `900011-900014` **未动** | **非 identity 列** ⇒ 不在撞号机制内。**登记为「有意不动」**，非疏漏 |
| M5 | `p8-s3/s3b` 的 cid 上移**对门读数零影响** | 因 `$1` 不可静态证明（§3.2）⇒ **门面数字**上未体现，仅**真实风险**下移。**未**为「让数字好看」而改判据 |
| M6 | `frontend/src/test/**` 的固定号**已现取、判定不改** | §1.3 三条理由（无 INSERT / 不在 188 受体面 / 改之降保真度）。**若 Zang 要求改** ⇒ 属新增射程，须新单 |
| M7 | **未做**跨库/多环境（Neon 分支）对拍；**未**重取序列快照 | §2.1 的现序（265/40/377/377/339）取自 S36 的**瞬时快照**（复述，未复核） |
| M8 | **未做**并发实验（两实例并跑是否会撞固定夹具 id） | S36/N3 同；本单为上移号段**降低**了该风险，但**未实证** |
| M9 | **门判据的「带感知」是本单新引入的口径** | §5.1：**未**由 Zang 预先裁定；若 Zang 认其越界 ⇒ **须回退为形态级判据**（则本单门读数回到 43，且 §7 判负不可实施）⇒ 见 §9-1 |
| M10 | `p8-s9` 的 before/after 读数差（cid/txid）**未追因到根** | 登记为环境性序列漂移（§6），**未**定位到具体消耗者 |
| M11 | **未**纳入全量门注册表 | 硬口径：本单**未**改 `p7b-03-offline-gates.ts` 的检查清单/计数常数 ⇒ `s36-00` 仍为**独立门**（建议同 S36 §7.5，由 Zang 裁） |

---

## §9 自曝

1. **★ 最大的一处「越派单预期」的自决（请裁）**：派单 §5 预期「命中数应从 43 下降」，但**原门判据（形态级）
   物理上不可能反映号段** ⇒ 我**没有**停在「报告原门仍 43」，而是**按派单根因**把 `explicit` 侧细化为
   **带感知**（`unreachable_floor` 缺省 9e8），使 §5 的「下降」与 §7 的「判负」**可实施**。
   **保守方向明示**：只豁免**可证 ≥9e8 的字面量**；参数/表达式/`SELECT` **一律仍计可达**。
   若 Zang 认为「改判据」本身越权 ⇒ 处置是**回退该判据**（门读数回 43、判负作废），**号段上移本身仍有效**。
2. **`users` 排除是判定，不是实测**：§1.2 依据 1/2 是**代码逐字现取**（`src/database.ts:2077` + `src` 全仓
   `MAX(`/`nextval(` 穷举），但「夹具 uid 抬升真 uid 后**会不会真出事**」**未**做活体实验（M1/M8）。
3. **「13 处下降」是判据推导 + 现取读数的双证，但**不是**「43 处风险已消」**：30/43 仍在基线里，
   `currency 22` 是**保守假阳性**（我明确标注），`users 8` 是**真残差**。**本单不宣称 B18 全清**。
4. **`p8-s3/s3b` 的 cid 上移「门面无痕」**：我**明知**它对门读数零影响却仍改（真实风险下移）——
   若被视为「改了没用」，请按下条裁决；我**未**为了制造数字而把 `$1` 判成 out-of-band。
5. **`p8-s8` 的 72 处批量替换含 4 处「文案行」与 1 处「对象键名」**（§4 表末两行）：**无判据影响**
   （`diff` 证据见 §4），但**确实改动了文案**（目的：不留旧号误导审计）。若要求**最小 diff** ⇒ 可撤回这 5 处。
6. **`p8-s9` 的 before/after 读数差我未能追因**（M10）：只确定方向与「跑门即耗序列」一致，**未**定位具体消耗者。
   **未**把该差异归零，**也未**把它算作回归。
7. **`s36-00` 的「自证循环」边界照旧**：门基线与盘点**同源**（S36/B14 的 `implicit-inserts.json`）；
   本单**未**引入第二路独立盘点（沿用 S36 §7.4 的诚实边界）。
8. **未做**：`frontend` 任何改动 / `npm install` / commit / push / 启停实例 / `pkill`。**本单零 commit**；
   工作区 HEAD 由 **并发会话** 推进 `dfd67fb ⇒ 5bf56d7`（其仅改 `docs/OPEN-ITEMS.md` + `docs/seafood.master-plan.md`，
   **与本单 5 个文件无交集** ⇒ 无冲突），**非本单所为**（§0.1 逐条留痕）。

---

## §10 产物清单（`backend-ts/.s37-artifacts/s37-20261005T051842Z/`）

```
run_gates_s37.sh                 门运行器（14 门 = 13 + s36-00；before/after 两相）
gate-before.json                 原门+原夹具（受体188 / 命中43 / 基线43）
gate-mid-oldbaseline.json        新门+原基线（命中30 / 基线43 / STALE 13）
gate-after.json                  新门+同步基线（命中30 / 基线30 / OOB 5 / GREEN）
gate-negctrl.json                判负态（命中37 / 新增7 / EXIT 3）
gate-negctrl-restored.json       复原态（命中30 / 新增0 / EXIT 0）
p8s8-band-move-log.json          72 处替换逐处（文件/行/旧值/新值/上下文）
currency-band-move-log.json      6 处替换逐处
explicit-sites-spectrum.json     34 处显式给号 × 宿主文件号段集合
baseline-sync-log.json           基线 43⇒30 的 cleared 13 + kept 30
p8s8-negctrl-backup.ts           判负前备份（复原锚）
p8s8-md5-green.txt               复原 md5 锚 = 9b275ec11585372206adfc4715833136
before/ after/                   14 门逐门原始输出（<gate>.txt ×14 + _summary.txt）
```
