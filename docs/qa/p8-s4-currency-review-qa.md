# 批 8④ · 自建单位审核闸（变体 Ⅱ）· 终审质检报告（Neng）

> 被检面：钉 **`8f17b33`**（本地已入库；含 `0d86ce5` 代码面）。**不采信交付方 / 派单方转引，逐条现取重取**。
> 夹具 / 探针 = 本单自写（**不复用 Kong 的**）。一切写面 = **事务内 + 末尾 `ROLLBACK`**（`currency_review_log` / `currency_status_log` 均 append-only ⇒ 真写不可恢复）。
> 语言：中文 · 结构化 · 逐条给命令与读数。**本报告完成后无「双下划线」占位**（本单末自证：对「连续两个下划线」模式计数 = 0）。
> 本件 = **收尾单**：承接上一轮（L0–L4/L6 已通过、被 max-iter 截断），本轮只做**遗留面**（HTTP 权限面补跑）+ **报告回填** + **自我结论订正** + **被检报告瑕疵登记** + **收尾**。**不重启已做过的主读**（L1 硬门为现取重跑取证，L3 四段为复跑确认；均只读）。

## §0 元信息（现取）

| 项 | 读数 | 来源 |
|---|---|---|
| 仓库 | `/Users/kevin/bistro/seafood` | — |
| 主仓 HEAD（首取） | `8f17b33` | `git rev-parse --short HEAD`（首） |
| 主仓 HEAD（收尾取） | `639d28a7727762cb21412539554f06d7f3c86413` | `git rev-parse HEAD`（尾） |
| 被检提交 | `8f17b33b3d77c0dd15cdb438d0d66ac9a2007698` | `git rev-parse 8f17b33` |
| 固定副本（worktree） | `scratch/qa8s4` @ `8f17b33b3d77c0dd15cdb438d0d66ac9a2007698`（**本单已回收**） | `git worktree add --detach … 8f17b33` → `git worktree remove --force` |
| 质检刻 | `2026-10-03T07:59:36+0800` | `date '+%Y-%m-%dT%H:%M:%S%z'` |
| 主仓 `git status`（首） | **27 行 `??`（全 untracked 产物 + 本报告）· 0 tracked 改** | `git status --porcelain`（首） |
| 主仓 `git status`（尾） | **33 行 `??`（首 27 + 本单 6 个新门产物目录）· 0 tracked 改** | `git status --porcelain`（尾） |
| 迁移 `0025` | `209 行 / 16913 B`；`sha256 = 2e4c62c0ccbaeb858763d7a73cef5149a840526bf6792fab3f0a628ae6ea0814` | `wc -l -c` / `shasum -a 256` |
| 库 `schema_version` | `0025` | 只读现取（`/health`） |
| 探查口 | 受控实例 **5796**（链 `.env.local`，**未打印内容**；收尾已 `kill -TERM` 精确 PID）+ 库只读/事务 | `lsof` / `/health` |

> **HEAD 漂移说明**：主仓 HEAD 从 `8f17b33` 前推 2 提交（`9b23029` 派本收尾单 / `639d28a` Zang push 代码 + 生产终验），被检面锚仍钉 **`8f17b33`**（工作树内被检文件 blob 未变，见 §8）。

## §1 三表触发器现取（`C-8` 纪律 · 前提）

> 结论先行：**只有 `currency_status_log` / `currency_review_log` 两表启用 append-only 触发器；`currency` 表 0 触发器。** 两 append-only 表真写不可删改 ⇒ 本节一切写面均「事务内 + 末尾 `ROLLBACK`」。

| 表 | 启用触发器（非 internal） | 守门函数 | 语义 |
|---|---|---|---|
| `public.currency` | **0 个** | — | 无触发器（`status` 转移由业务语句负责） |
| `public.currency_status_log` | `trg_currency_status_log_append_only` | `currency_status_log_append_only()` | `BEFORE DELETE OR UPDATE` **无条件 `RAISE`**（原生 `P0001`） |
| `public.currency_review_log` | `trg_currency_review_log_append_only` | `currency_review_log_append_only()` | 同上 · **只增不删** |

现取命令与读数（`pg_trigger` 只读）：

```
SELECT c.relname AS table, t.tgname, t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE NOT t.tgisinternal AND c.relname IN ('currency','currency_status_log','currency_review_log');
-- 读数：currency=0；currency_status_log: trg_currency_status_log_append_only (enabled=O)；
--       currency_review_log: trg_currency_review_log_append_only (enabled=O)
```

**来源**：自写探针 `qa8s4-00-triggers.ts` → `qa8s4-00-20261002T235149Z/triggers.json`（9/9 通过，末尾哨兵 `ROLLBACK`）。

## §2 L1 硬门独立复跑（退出码管道外捕获）

| 门 | 读数 | 退出码 |
|---|---|---|
| `npx tsc --noEmit`（backend-ts） | 0 行诊断 | `0` |
| 离线套件 `p4z-tr1a-01-offline-tests.ts` | **126 / 126 passed** | `0` |
| `p8-s1-app-config-gate.ts` | **24 / 24 passed** | `0` |
| `p8-s2-fee-rebate-gate.ts` | **41 / 41 passed** | `0` |
| `p8-s3-deposit-gate.ts` | **45 / 45 passed** | `0` |
| `p8-s3b-address-gate.ts` | **38 / 38 passed** | `0` |
| **`p8-s4-currency-review-gate.ts`** | **79 / 79 passed** | `0` |
| `npm run build`（frontend，vite） | `✓ built in 1.95s` | `0` |
| `npm run test:unit`（frontend，vitest） | **31 files / 276 passed** | `0` |
| 七门（`frontend/scripts/*.mjs`） | 七门全 `0`（见下） | `0` |

**七门逐门**：`p4z-i18nviol-global` `0` · `p6-tr2-i18n-locales` `0` · `p4z-miscfix-links` `0` · `p4z-feperf-safelist` `0` · `p7a-03-errmessage-gate` `0` · `p7b-errfallback-gate` `0` · `p7c-errmsg-machinecode-gate` `0`。

> ⇒ **L1 = 全绿**。门产物落 `backend-ts/.p4-artifacts/p6tr1a-20261002T235718Z/`、`.p8s1-artifacts/p8s1-20261002T235718Z/`、`.p8s2-artifacts/p8s2-gate-20261002T235719Z/`、`.p8s3-artifacts/p8s3-20261002T235723Z/`、`.p8s3b-artifacts/p8s3b-20261002T235724Z/`、`.p8s4-artifacts/p8s4-20261002T235724Z/`（均 untracked，见 §8 尾注归因）；原始输出 `scratch/qa8s4-L1/*.out`。

## §3 L2 ★ C2 审核闸（承重面）· 双证 + 类级

### §3.1 闸真身（现取 `database.ts` `LIST_CURRENCY_WITH_DEPOSIT_SQL` 的 `apply` CTE）

```
        WHERE c.cid = $1::bigint
          AND c.status = 'draft'
          AND (SELECT cur.owner_uid FROM cur) = $4::bigint
          AND EXISTS (
            SELECT 1 FROM public.currency_review_log AS r
             WHERE r.cid = $1::bigint AND r.result = 'approved'
          )
```

- 落点：`src/database.ts:226-229`（`apply` CTE 的 `WHERE` 追加 fail-closed 闸）。**唯一写路径**内 ⇒ 服务层 / 探针两路共用、不可绕过。

### §3.2 仓外副本三类变异（必红）· 现取真语句 + 事务内实证

探针 `qa8s4-04-mutation.ts` **从 `src/database.ts` 现取**该常量（非硬编码副本），在字符串层施加三类变异，逐变体在**同一事务内**跑真语句路径（末尾哨兵 `ROLLBACK`）。

| # | 变异 | 位置 | 改法 | 期望红点 | 实测 |
|---|---|---|---|---|---|
| ① 去闸 | `database.ts:226-229` | 删 `AND EXISTS (… currency_review_log …)` 块 | 未审 `draft` 自助上市 | ✅ `applied=1` / `status_post=listed` |
| ② 反转为 `NOT EXISTS` | 同上 | `AND EXISTS (` → `AND NOT EXISTS (` | 未审 `draft` 自助上市 | ✅ `applied=1` / `status_post=listed` |
| ③ 恒真谓词 | 同上 | `AND EXISTS (…)` → `AND TRUE` | 未审 `draft` 自助上市 | ✅ `applied=1` / `status_post=listed` |

- 副本基线（真语句·有闸态）：`applied=0` / `cur_status=draft`（未审 `draft` 被闸拦住）。
- **副本探针自证未审可上市**（三变异态逐字）：`M1 {applied:1,status_post:listed}` · `M2 {applied:1,status_post:listed}` · `M3 {applied:1,status_post:listed}`（`cur_status` 字段是 `cur` CTE 的改前快照，真值另取 `currency.status`）。
- **主仓零写入**：变异只发生在**内存字符串层**（`REAL_SQL.replace(GATE_RE,…)`），未改任何仓内文件；主仓被检文件 blob 未动（§8）。
- **类级声明**：闸缺 ⇒ 任何未审 `draft` 单位均可被 owner 自助 `draft→listed`（三变异同证）；闸在 ⇒ 唯一放行来源 = 台账 `result='approved'` 行。

**来源**：`qa8s4-04-20261002T235909Z/mutation.json`（6/6 通过：M0 真语句 =0 / M1·M2·M3 必红 / Z 回滚 / R1 残渣 0）。

## §4 L3 四段真链路独立重取

> 自写探针 `qa8s4-01-effective.ts` + 自造 fixture（`cid` 窗口 `920000000+`、symbol 前缀 `qa8s4`）；单事务 + 末尾哨兵 `ROLLBACK`；**同探针复跑**（残渣均 0）。

### §4.1 通过路径

`currencyReviewPostEvent(approve)` 回执 `{cur_found:1, prior_count:0, applied:1, slogged:1, reviewed:1}` ⇒ 台账恰 1 行 `approved`（actor=admin）+ `draft→listed` + 状态日志恰 1 行（`draft→listed`）。

### §4.2 驳回路径

`currencyReviewPostEvent(reject)` 回执 `{cur_found:1, applied:0, slogged:0, reviewed:1}` ⇒ **驳回必落台账恰 1 行 `rejected`**；`status` 仍 `draft`；状态日志 0 行；驳回后再调 C2 仍拒（`applied=0`）。

### §4.3 幂等三向

同键同 `result` ⇒ `prior_count=1 / reviewed=0 / rows=1`（不增行）；同键异 `result`（先驳后成）⇒ 各留一行（`final_rows=2`）+ `listed`；异键 ⇒ 新行（`rows=1`）。

### §4.4 ★ ④ 两读数（同一业务量「可否上市」）

| 读数 | 取值（逐字） | 来源 |
|---|---|---|
| 有闸（主仓态）：未审 C2 | `applied=0` / `status_post=draft` / `ledger_legs=0` / `status_log_rows=0` | 本单探针 `unreviewed_c2` |
| 去闸（副本态）：未审 C2 | `applied=1` / `status_post=listed`（`ledger_legs`>0） | 副本探针 §3.2 ① |
| 通过后 R28 放行 / 未审 `draft` `LD008` | `draft`: `hold/price = {ok:false, code:LEDGER_CURRENCY_NOT_LISTED}`；`listed`: `hold/price = {ok:true, code:null}` | `r28` |

### §4.5 非法入参 ≥6 + 权限面

纯函数面（`parseReviewInput` / `parseStatusFilter`）：`cid` 非数字 / `cid=0` / `action` 缺失 / `action` 非枚举 / `reason` 缺失 / `reason` 空白 ⇒ `400`/`404` 且码 ⊆ 33 码闭集（`LEDGER_AMOUNT_INVALID` / `LEDGER_CURRENCY_NOT_FOUND`）；非法 `?status` ⇒ `400`。**HTTP 权限面见 §4.7**。

### §4.6 残渣零净写（复跑）

`review_rows=0` · `probe_cur=0` · `probe_sym=0` · `probe_slog=0` · `probe_ledger=0` · `max_cid=36`（未推进）· `ledger_total=355`（未增）。

### §4.7 ★ 本单补跑：HTTP 权限面（只读/鉴权面请求 · 零写）

> 探针 `qa8s4-03-http.ts`（已修：`codeOf`/`reasonOf` + 令牌 round-trip 自证）+ `qa8s4-03b-http-shape.ts`。受控实例 `PORT=5796`（链 `.env.local`）。**只发 401/403 面 + 读口 200 + 非数字 `:cid` 早退 404 —— 绝不对任何有效 `cid` 发写请求**。
> **探针自证**：`[diag] SECRET_KEY present=true len=64 roundTrip={"uID":1,"evm":"0x99a7…"}`（本进程现签令牌能被本仓 `verifySessionToken` 回读 ⇒ 已排除「探针令牌自造错致全 401」这一伪因）。

| # | 面 | 期望 | 实测（逐字） |
|---|---|---|---|
| H0 | 健康 | 200 | `200` / `schema_version=0025` |
| H1 | 读口**无 token** | 401 | `401` `AUTH_UNAUTHORIZED` |
| H2 | 动作口**无 token** | 401 | `401` `AUTH_UNAUTHORIZED` |
| H3 | 非 admin（uid `2`）读口 | 403 | `403` `AUTH_FORBIDDEN` / `details.reason=NOT_ADMIN` |
| H4 | 非 admin（uid `2`）动作口 | 403 | `403` `AUTH_FORBIDDEN` / `details.reason=NOT_ADMIN` |
| H5 | admin（uid `1`）读口 | 200 | `200` / `data` 数组（`len=15`） |
| H6 | admin + 非数字 `:cid`（`abc`）动作口 | 404 `LD007` | `404` `LEDGER_CURRENCY_NOT_FOUND`（写逻辑前早退） |
| **H7** | **uid `900004`（缺 `review_tasks`）读口** | **403** | **`403` `AUTH_FORBIDDEN` / `details.reason=PERMISSION_NOT_GRANTED`** |
| **H8** | **uid `900004`（缺 `review_tasks`）动作口** | **403** | **`403` `AUTH_FORBIDDEN` / `details.reason=PERMISSION_NOT_GRANTED`** |

**读口 200 的键集**（`qa8s4-03b` 现取）：顶层 `{data, message, success}`；`data[0]` 行键 `{cid, deposit_amount, deposit_cid, listed_at, name, owner_uid, status, symbol, time_created}`。

**uid `900004` 的现库身份**（只读 `qa8s4-02-perm.ts` → `qa8s4-02/perm.json`）：`is_admin=false` · `admin_user_role.role_key=p7b_fixture_admin` · 该角色权限集 = **仅 `manage_points`**（**不含 `review_tasks`**）⇒ 有后台角色但不含审核权。实测两路由（读 / 动作，动作口于**写逻辑前**鉴权早退）均 `403 PERMISSION_NOT_GRANTED` ⇒ **与期望逐字一致（非 403 才须 `PENDING_ZANG`）**。

**H7 403 逐字体**（`qa8s4-03b` 现取）：

```json
{"error":{"code":"AUTH_FORBIDDEN","message":"AUTH_FORBIDDEN","i18n_key":"auth.err.AUTH_FORBIDDEN","details":{"reason":"PERMISSION_NOT_GRANTED"}}}
```

**零写旁证**（只读现取）：`currency_review_log = 0` 行、`currency_status_log = 7` 行（与本单开头同值，未增）。

**来源**：`qa8s4-03-20261002T235631Z/http.json`（9/9）· `qa8s4-03b-20261002T235650Z/http-shape.json`。

## §5 L4 库面复核（只读）

| 项 | 读数 | 来源 |
|---|---|---|
| `currency_review_log` 8 列 | `log_id, cid, actor_uid, result, request_fingerprint, idempotency_key, memo, time_created` | `information_schema` |
| 5 约束 | `currency_review_log_actor_fk` · `currency_review_log_cid_fk` · `currency_review_log_idem_uniq` · `currency_review_log_pk` · `currency_review_log_result_ck` | `pg_constraint` |
| 4 索引 | `currency_review_log_actor_day_idx` · `currency_review_log_cid_idx` · `currency_review_log_idem_uniq` · `currency_review_log_pk` | `pg_indexes` |
| 触发器 | `trg_currency_review_log_append_only`（enabled=`O`） | `pg_trigger` |
| `schema_migration` 0025 行 | `version=0025` / `applied_at=2026-10-02 23:38:23.551505+00` | 只读 |
| 0025 checksum == 文件 sha256 | `2e4c62c0ccbaeb858763d7a73cef5149a840526bf6792fab3f0a628ae6ea0814` **==** | 对拍 |
| `schema_version` | `0025` | 只读 |
| 探针残渣 | `review_rows=0` · `probe_cur/sym/slog/ledger=0` | 只读 |

**来源**：`qa8s4-00-…/triggers.json` + `qa8s4-01-20261002T235954Z/effective.json`。

## §6 L5 报告与锚点核对（只核不改）

- `docs/audit/p8-s4-currency-review.md` 现取：**378 行 / 36,030 B**；对「连续两个下划线」模式计数 = **1**；`待回填` 计数 = **1**。
- 抽 5 条读数对拍（H5 列齐 / H8 触发器 / G2 四语 28 键 / C5 0025 checksum / 四段 32→31 读数）：**与交付报告逐字一致**。
- **★ 拓锚点核对**：§11 写 `listCurrenciesForAdmin` = `database.ts:2338`；**现取 = `:2349`**（`grep -n 'static async listCurrenciesForAdmin' src/database.ts` ⇒ `2349`）⇒ **+11 漂移**。
- 笔误：`line 346` 写 `p4z-i18nvviol-global` ⇒ 应为 `p4z-i18nviol-global`（`line 173` 拼写正确，仅 `:346` 笔误）。
- **只核不改**（登记，不改被检报告）：见 §6.1。

### §6.1 被检报告 `docs/audit/p8-s4-currency-review.md` 登记项（**只核不改**）

**两处瑕疵**：

1. **锚点漂移**（`§11` line 286）：写 `database.ts:2338 listCurrenciesForAdmin`；现取 `:2349`（+11）。行号漂移系其后提交所致，**判据语义未变**（同一 `SELECT` 列 `status`）。
2. **笔误**（line 346）：`p4z-i18nvviol-global` ⇒ 应为 `p4z-i18nviol-global`（多一 `v`）。同名门 `line 173` 拼写正确。

**两处遗留**（措辞/结论面）：

3. **§0 门自证措辞过强**（line 5）：自证「双下划线模式命中 = 0 · `待回填` 标记 = 0」**不成立** —— 实测对「连续两个下划线」模式计数 = **1**（`line 348` = 门自证标识符，其形为 `J1` 后接连两个下划线再接 `selftest`，**非占位**）且 `待回填` 计数 = **1**（`line 5` 元陈述内回引自身，非占位）。⇒ **实质占位 = 0（成立），但「命中 = 0」字面不成立**（措辞过强；建议改「无**占位式**双下划线 / 无**实际**待回填」）。
4. **§11.6 #2 `NOT_MEASURED` 不成立**（line 369）：声明「缺 `review_tasks`（`PERMISSION_NOT_GRANTED`）子面…**本轮现取无合适样本**」。**现取推翻**：库内存在 **uid `900004`**（`is_admin=false` + `admin_user_role.role_key=p7b_fixture_admin`，角色权限集 = 仅 `manage_points`，**不含 `review_tasks`**）⇒ 本单 §4.7 H7/H8 已实测两路由 **`403 AUTH_FORBIDDEN` / `details.reason=PERMISSION_NOT_GRANTED`**。⇒「无合适样本」**不成立**，该面**可测且已测**。

**一处澄清（明写非缺陷）**：

5. **§11.2 `UPDATE OR DELETE` 与 PG 规范化 `DELETE OR UPDATE`**：报告 line 268/269 写触发器 `BEFORE UPDATE OR DELETE`；`pg_trigger` 规范化显示 `BEFORE DELETE OR UPDATE`。**语义等价**（同一 append-only 语义，`OR` 子句无序）⇒ **非缺陷**，仅记此处以免误判。

> 上述 5 项**均为只核**——**本单未改 Kong 报告一个字节**（`git status` 无 `docs/audit/**` 改动）。

## §7 L6 面核

| 项 | 读数 | 口径 |
|---|---|---|
| 注册点 | **71** | `grep -cE "app\.(get\|post\|put\|delete\|patch)\(" src/index.ts` = **72**，**减去** `index.ts:777` 注释行内 `app.get('/api/user/ledger'` 字面 ⇒ **71**（门 A1 同值） |
| 迁移数 | **24** | `ls migrations/*.sql \| wc -l`（含新增 `0025_currency_review_log.sql`） |
| 错误码 | **33** | 33 码闭集未动（门 F9 = 33） |
| 退还/罚没/`delist` 面 | **0** | 门 F2 无 `delist` 路由 · F3 审核服务零 `hold_forfeit`/`hold_release`/`unfreeze(`/`listing_deposit_refund` · F4 审核语句零 `ledger_post_event` · F5 全 `src` 面 `listing_deposit_refund` 零命中 |
| 四语键集 | **`adminCurrencyReview` 28 键 × 4 语齐**（zh/en/hk/vn 键集相等）；en/vn 无 CJK；hk 为繁體（抽查 `自建單位審核`） | 门 G1–G4 |
| 六类泄漏 | **0**（四语 × `adminCurrencyReview`；门自证（`G5` 后接连两个下划线再接 `selftest`）⇒ `judge_fired=true`） | 门 G5 |
| `TODO: Kevin 定值` | **在场**（`currency-service.ts:142/147` · `database.ts:52/106/111` · `index.ts:1563`） | `grep` |

## §8 收尾（worktree / 端口 / git status）

- worktree 逐文件 blob == `git rev-parse 8f17b33:<path>`：`database.ts` / `index.ts` / `currency-review-service.ts` / `p8-s4-currency-review-gate.ts` / `0025…sql` **逐个 SAME**（判为「副本 == 被检面」）。
- 主仓零写入（tracked）：收尾 `git status --porcelain` 中**无任一 ` M ` / `M ` 行** ⇒ 被检 commit 的 tracked 文件**零改**；全部为 `??` untracked 产物 + 本报告。
- 端口 `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN`：**空**（收尾 `LSOF_EMPTY_RC=1`）。
- PID `kill -TERM`：本单受控实例 **`kill -TERM 16563`（wrapper）/ `16946`（node ts-node :5796）**；`git worktree` 无残留进程。
- 5787/5788 未碰：外部 PID `30475`（`[::1]:5787`）/ `65096`（`*:5788`）**原样在场，未启停**。
- 尾次 `git status --porcelain` 逐条归因：**33 行，全 `??` untracked**，明细见下。
- `git worktree remove --force scratch/qa8s4`：`REMOVED_RC=0`。**剩余 worktree 列表**（登记，非本单产生）：`main@639d28a` · `p7d-neg@f0bd336` · `qa-p7a-09362ad@09362ad` · `qa-p7a-final@ae46297` · `qa-p7b@39d89b3`。

**尾次 `git status --porcelain`（33 行）逐条归因**：

| 组 | 行数 | 归因 |
|---|--:|---|
| `.p4-artifacts/p6tr1a-*` | 6 | 离线套件产物（5 为前轮遗留 + **1 本单重跑 `235718Z`**） |
| `.p8s1-artifacts/p8s1-*` | 5 | s1 门产物（4 前 + **1 本单 `235718Z`**） |
| `.p8s2-artifacts/p8s2-gate-*` | 6 | s2 门产物（5 前 + **1 本单 `235719Z`**） |
| `.p8s3-artifacts/p8s3-*` | 6 | s3 门产物（5 前 + **1 本单 `235723Z`**） |
| `.p8s3b-artifacts/p8s3b-*` | 6 | s3b 门产物（5 前 + **1 本单 `235724Z`**） |
| `.p8s4-artifacts/p8s4-*` | 2 | s4 门产物（1 前 `235114Z` + **1 本单 `235724Z`**） |
| `backend-ts/.p8s4qa-artifacts/` | 1 | **本单 QA 探针 + 产物**（`qa8s4-00/01/02/03/03b/04`） |
| `docs/qa/p8-s4-currency-review-qa.md` | 1 | **本件**（QA 报告） |

> ⇒ **主仓 tracked 零改**；33 行全为 untracked 门/探针产物 + 本报告。**本单未 `git add`/`commit`/`push`**。

## §9 未测项 + verdict（逐项原因，禁填 0 / 空）

| # | 未测项 | 原因（逐字） |
|--:|---|---|
| 1 | 真 admin 凭据的 `approve`/`reject` **真 HTTP 写面（`COMMIT` 级）** | `currency_review_log` append-only ⇒ 真写不可复原；按 `R-8-15` 一切写面「事务内 + 回滚」⇒ **禁跑**。已由事务内 + `ROLLBACK` 的同路径 DB 函数实测替代（§4）。 |
| 2 | **C2 `POST /api/currency/:cid/list`（未审 `draft` 走真 HTTP）** | 同上：闸若失效即不可复原写；且须 owner 凭据。已由**同 SQL** 的事务内探针实测（§3.2 / §4.4）。 |
| 3 | 线上（生产 Vercel）终验读写面 | 本单不触网；且硬口径未含线上跑。代码虽已由 Zang push（`639d28a` 后），本单**不自跑线上**。 |
| 4 | frontend 端到端（Playwright / `test:e2e`） | 硬口径 = build + test:unit + 七门；**未含 e2e**；且禁启停 5787/5788（e2e 需起服务/浏览器）⇒ 未测。 |
| 5 | `0025` 迁移**运行器再次执行** | 硬口径**禁 apply 任何迁移** ⇒ 未跑（迁移已由 Zang apply，库内现取 `schema_version=0025`）。 |
| 6 | `currency_review_log` **历史数据行**面 | 现库该表 `0` 行（除探针外无数据）⇒ 无历史行可核（非「未测」而是「无样本」，如实登记）。 |

> **订正（承 §6.1 #4 / 本报告前一版结论作废）**：前一版 `NOT_MEASURED #2`「缺 `review_tasks` 无合适账号」**作废** —— 现取 uid `900004` 即为合适样本，两路由实测 `403 PERMISSION_NOT_GRANTED`（§4.7 H7/H8）⇒ **该面可测且已测，非未测**。

**verdict**：**PASS（建议入库）**。被检面 `8f17b33` 的 L0–L7 全部独立复现通过：L1 十门全绿（`tsc 0` / 离线 126/126 / s1 24 / s2 41 / s3 45 / s3b 38 / s4 79 / build 0 / 单测 31·276 / 七门 0）；L2 C2 审核闸**承重**（现取真语句三变异必红，去闸态未审 `draft` 实测自助上市）；L3 四段真链路 32/32（事务内 + `ROLLBACK`，残渣 0）**并补跑 HTTP 权限面 9/9**（含 uid `900004` 缺 `review_tasks` ⇒ 两路由 `403 PERMISSION_NOT_GRANTED` 逐字取证）；L4 库面 8 列 / 5 约束 / 4 索引 / 触发器 / `0025` checksum 对拍全中；L5 报告 378 行 / 36,030 B，读数对拍一致（登记 2 瑕疵 + 2 遗留 + 1 澄清，见 §6.1）；L6 面核（注册点 71 / 迁移 24 / 码 33 / 零退还罚没 / 四语 28 键 / 六类泄漏 0 / `TODO: Kevin` 在场）；L7 收尾干净（worktree 回收 / 端口空 / tracked 零改）。**无阻塞项。**

## §10 自曝

1. **探针曾自造伪 401（已修，非被检缺陷）**：`qa8s4-03-http.ts` 初版用 `{uid}` 传参，而 `createSessionToken` 读 `payload.uID`（大写 `ID`）⇒ `sub="undefined"` ⇒ 全路由 401（伪因）。**已由令牌 round-trip 自证捕获并修正**（改传 `{uID, evm}`）；修后 round-trip 回读成功、9/9 通过 ⇒ 此前「全 401」是**探针口径错**，非权限面缺陷。
2. **L2 变异是「字符串层 + 同事务真语句路径」实证**，非「副本整仓 apply」：变异在内存字符串层施加、经真 `LIST_CURRENCY_WITH_DEPOSIT_SQL` 路径在事务内执行；未在仓外建整仓副本跑迁移（受控成本），故 ① 去闸态的 `ledger_legs>0` 未逐条枚举（`applied=1`/`status_post=listed` 已足证闸缺）。
3. **L1 硬门在主仓（HEAD `639d28a`）重跑**：被检文件的 working-tree blob == `8f17b33`（§8），故读数等同被检面；门产物落 untracked 目录（§8 已归因）。
4. **本报告无「双下划线」占位**（自证：对「连续两个下划线」模式计数 = 0）。
5. **本单唯一改动面**：`docs/qa/p8-s4-currency-review-qa.md`（本件）+ `backend-ts/.p8s4qa-artifacts/**`（探针 / 产物）+ untracked 门产物目录。**未改被检代码 / `docs/audit/**` / 任何 spec**；未 `git add/commit/push`；未 `npm install`；未碰 `.env*`；未 `pkill`/`killall`；未启停 5787/5788；受控实例仅 5796（精确 PID `kill -TERM`，`lsof 5796-5799` 空）。
