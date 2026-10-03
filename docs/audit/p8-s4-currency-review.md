# 批 8④ · 自建单位审核闸（变体 Ⅱ = 旁路台账型）· 实现第一步「收口」报告

> **本件 = 8④ 实现第一步（收口单）**：代码面 + 迁移 `0025` **内容** + 新门 `p8-s4` + 前端后台页 + 四语文案面 + 收口（红项定性 / 硬门复跑 / 仓外副本判负 / 收尾）。
> **库面（四段真链路 + 库面判负）不在本件** —— 逐字见 **§9 `NOT_MEASURED`**。
> 撰写：Kong（实现）。**本报告不含双下划线占位**（自证：**实质占位 = 0**；`__` 字面命中 = **1**，系**门自证标识符** `J1__selftest`（非占位）；`待回填` 字面命中 = 1，系元陈述内回引）。

## §0 元信息（现取）

| 项 | 读数 | 命令 / 来源 |
|---|---|---|
| 仓库 | `/Users/kevin/bistro/seafood` | — |
| 分支 / HEAD | `main` / 开工 **`b6e08908bb29e26a93135ab2df77945888985e49`** ⇒ 收尾 **`2f0cb400fff645ccc4264055fac977c62ef68a42`**（**他方** docs-only 提交 = master-plan `§5.201/v0.201`，`+21 行`、**仅 `docs/seafood.master-plan.md`**、零代码 ⇒ 不影响任何门/被测面） | `git rev-parse HEAD` / `git show --stat HEAD` |
| 迁移 `0025` | **209 行 / 16,913 B / sha256 `2e4c62c0ccbaeb858763d7a73cef5149a840526bf6792fab3f0a628ae6ea0814`** | `shasum -a 256` / `wc -l -c` |
| `ls backend-ts/migrations/*.sql \| wc -l` | **24**（在场；**未 apply**，受控实例 `/health` 仍 `schema_version = 0024`） | `ls` / `curl /health` |
| 新门产物 | `backend-ts/.p8s4-artifacts/<run>/gate.json`（本报告权威 run = `p8s4-20261002T233604Z`） | 门脚本自落 |
| 权威真源 | `docs/route-layer.spec.md` **v2.8 §23** · `docs/data-layer.spec.md` **v0.15 §26.7** | 只读引用 |

---

## §1 红项逐条定性（★ 优先项：分类在先）

> 输入 = `.p8s4-artifacts/p8s4-20261002T233019Z/gate.json` 的 `pass:false` 三项（`total 73 / passed 70 / failed 3`）。
> 三分 = **(a) 探针口径错**（改门 + 真实文本逐字对拍）· **(b) 真缺陷**（改实现 + 改前改后 diff）· **(c) 期望不该存在**（停报 `PENDING_ZANG`）。

### ① `E4`（`rejectLedger`）：**(a) 探针口径错**

| 项 | 内容 |
|---|---|
| 断言文本 | approve 才走 `draft→listed`（`= 'approved'` 门控；驳回不改 status） |
| 门原谓词 | `t('E4', …, /SET status = 'listed'[\s\S]{0,120}= 'approved'/.test(DATABASE_TS), …)` |
| 实际取值 | 谓词 = `false`（红） |
| **定性** | **(a) 探针口径错。窗口 `{0,120}` 比真实间距短 1 字符（真值 = 121）；且锚点未限定审核语句、会先命中上市语句的同名副串。产品的门控本身正确。** |

**真实文本逐字对拍（`backend-ts/src/database.ts:297-305`，`CURRENCY_REVIEW_POST_EVENT_SQL` 的 `apply` CTE）**：

```
      apply AS (
        UPDATE public.currency AS c
        SET status = 'listed',
            listed_at = now(),
            time_updated = now()
        WHERE c.cid = $1::bigint
          AND $3::text = 'approved'
          AND c.status = 'draft'
          AND NOT EXISTS (SELECT 1 FROM prior)
        RETURNING c.cid, c.status
      ),
```

- `python re` 距离实测：审核语句处 `SET status = 'listed'` → 后一个 `= 'approved'` 的间距 = **121**（> 门限 120）；上市语句处（`database.ts:212`）同名头 → `= 'approved'` 间距 = **4181**。⇒ 旧正则两处皆不匹配，必红。
- **改法（已落 `scripts/p8-s4-currency-review-gate.ts`）**：把谓词锚定审核语句体、去掉人肉窗口 ——
  `reviewApplyGated(REVIEW_SQL)` = `/apply AS \(\s*UPDATE public\.currency AS c\s*SET status = 'listed',[\s\S]*?AND \$3::text = 'approved'/`，其中 `REVIEW_SQL` = `database.ts` 的 `const CURRENCY_REVIEW_POST_EVENT_SQL = \`` 起至闭合反引号。
- **附自证**：新增 E4 负对照自证（喂「无 `= 'approved'` 门控」的 `apply` CTE ⇒ 谓词必须转红），实测 `judge_fired = true`。

### ② `H9`（`migration`）：**(a) 探针口径错**

| 项 | 内容 |
|---|---|
| 断言文本 | 恰一列 `time_created`（DEFAULT now()）；**无** `time_updated` |
| 门原谓词 | `… && !/time_updated/.test(MIGRATION_SQL)` |
| 实际取值 | `{"time_created":true,"time_updated":true}`（红） |
| **定性** | **(a) 探针口径错。门把「整份 SQL 原文含 token」当成「有该列」。`time_updated` 在 `0025` 中只出现于注释与自检串（反断言）；`CREATE TABLE` 的 8 列**无** `time_updated`。** |

**真实文本逐字落点（`0025`）**：

| 行 | 性质 | 逐字片段 |
|---|---|---|
| `0025:27` | `--` 行注释 | `--   · **无 create_key / 无 ledger_event_keys / 无 time_updated**（照抄 0023/0024 审计表` |
| `0025:191` | `--` 行注释 | `-- ★ 反断言（§26.7(e)(f)）：本表**无 time_updated**、**无 create_key**、**无 ledger_event_keys**` |
| `0025:193` | SQL 串字面量 | `AND table_name='currency_review_log' AND column_name IN ('time_updated','create_key','ledger_event_keys')) THEN` |
| `0025:194` / `0025:208` | `RAISE` 串（字面量内） | 自检失败 / 成功文案回引三 token |

- `CREATE TABLE`（`0025:42-59`）逐列 = `log_id, cid, actor_uid, result, request_fingerprint, idempotency_key, memo, time_created`（**恰 8 列**），列定义位扫描 `^\s+time_updated\s` = **0**。
- **改法（已落）**：改判「**结构面**」—— 先 `sqlStructure(t)` 去 `--` 行注释 + 去单引号字面量，再 `!/\btime_updated\b/.test(MIGRATION_STRUCT)`。注释与自检串不计；真列定义仍会命中（见 H9 负对照自证）。

### ③ `H10`（`migration`）：**(a) 探针口径错**

| 项 | 内容 |
|---|---|
| 断言文本 | 无 `create_key` / 无 `ledger_event_keys` |
| 门原谓词 | `!/\bcreate_key\b\|\bledger_event_keys\b/.test(MIGRATION_SQL)` |
| 实际取值 | `{"create_key":true,"lek":true}`（红） |
| **定性** | **(a) 探针口径错。与 ② 同因：两 token 仅见于注释（`0025:27` / `0025:191`）与自检串（`0025:193` / `0025:194` / `0025:208`），`CREATE TABLE` 无同名列。** |

- **改法（已落）**：同 ②，改判结构面 ⇒ `!/\bcreate_key\b|\bledger_event_keys\b/.test(MIGRATION_STRUCT)`。

> **三分结论**：三条**全部 = (a)**，**零 (b) / 零 (c)**。**未改任何期望的语义、未删任何判据**；动作仅 = ①把两条过窄/过宽的手写正则换成结构面判据 ②新增 1 条 E4 负对照自证。**实现面（`src/database.ts` / `src/index.ts` / `src/currency-review-service.ts`）与迁移内容（`0025`）一字未改。**

---

## §2 新门 `p8-s4` 读面总读数

- run `p8s4-20261002T233604Z`：**`total 74 / passed 74 / failed 0`**，脚本 `exit 0`（退出码管道外捕获）。
- 逐组：`registration 8` · `readSurface 6` · `actionShape 6` · `illegalInput 10` · `rejectLedger 8` · `noRefundSurface 5` · `i18n 10` · `migration 13` · 负对照自证 `8`（registration / readSurface / actionShape / illegalInput / rejectLedger×2 / i18n / migration）。
- 冻结读数：`registration_points 71` · `actions [approve,reject]` · `action_to_result {approve:approved, reject:rejected}` · `ops_action currency_review` · `currency_status_values [draft,listed,frozen,delisted]` · `error_codes_closed_set_size 33` · `error_codes_used [LEDGER_CURRENCY_NOT_FOUND, LEDGER_CURRENCY_INVALID_TRANSITION, LEDGER_AMOUNT_INVALID]` · `review_ns_keys 28` · `migrations_count 24`。
- 根因修复后新增/改动的 4 条（E4 / E4 自证 / H9 / H10）逐字读数：E4 `true`；H9 `{"time_created":true,"time_updated":false}`；H10 `{"create_key":false,"lek":false}`；H9 自证 `judge_fired = true`。
- ★ **本门零 DB / 零 HTTP / 零网络**，不依赖新表存在（`0025` 只做**文本断言**，不 apply）。

---

## §3 迁移 `0025` × `data-layer.spec` v0.15 §26.7 逐条对应表

> 真源 = `docs/data-layer.spec.md` v0.15 §26.7（`(a)` 表名 `:1910` · `(b)` 8 列 `:1918-1925` · `(c)` 5 约束 `:1931-1935` · `(d)` 4 索引 `:1941-1944` · `(e)` append-only `:1947-1949` · `(f)` 时间列 `:1951`）。
> 落地 = `backend-ts/migrations/0025_currency_review_log.sql`（在场 · 未 apply）。

| §26.7 条目 | spec 契约 | `0025:<行>` 落点 | 逐字读数 | 门判据 |
|---|---|---|---|---|
| **(a) 表名** | `public.currency_review_log` | `0025:42` | `CREATE TABLE IF NOT EXISTS public.currency_review_log (` | H2 |
| **(b) #1** | `log_id` `bigint GENERATED BY DEFAULT AS IDENTITY`（PK） | `0025:43` | `log_id              bigint      GENERATED BY DEFAULT AS IDENTITY,` | H3 |
| **(b) #2** | `cid` `bigint NOT NULL` | `0025:44` | `cid                 bigint      NOT NULL,` | H3 |
| **(b) #3** | `actor_uid` `bigint NOT NULL`（= admin） | `0025:45` | `actor_uid           bigint      NOT NULL,` | H3 |
| **(b) #4** | `result` `text NOT NULL`（值域见 (c)#4） | `0025:46` | `result              text        NOT NULL,` | H3 · H5 |
| **(b) #5** | `request_fingerprint` `text NOT NULL` | `0025:47` | `request_fingerprint text        NOT NULL,` | H3 |
| **(b) #6** | `idempotency_key` `text NOT NULL` | `0025:48` | `idempotency_key     text        NOT NULL,` | H3 |
| **(b) #7** | `memo` `text`（可空） | `0025:49` | `memo                text,` | H3 |
| **(b) #8** | `time_created` `timestamptz NOT NULL DEFAULT now()` | `0025:50` | `time_created        timestamptz NOT NULL DEFAULT now(),` | H3 · H9 |
| **(c) #1** | `currency_review_log_pk` `PRIMARY KEY (log_id)` | `0025:51` | `CONSTRAINT currency_review_log_pk        PRIMARY KEY (log_id),` | H4 |
| **(c) #2** | `currency_review_log_actor_fk` `FK (actor_uid) → public.users(uid)` | `0025:52` | `CONSTRAINT currency_review_log_actor_fk  FOREIGN KEY (actor_uid) REFERENCES public.users(uid),` | H4 |
| **(c) #3** | `currency_review_log_cid_fk` `FK (cid) → public.currency(cid)` | `0025:53` | `CONSTRAINT currency_review_log_cid_fk    FOREIGN KEY (cid)       REFERENCES public.currency(cid),` | H4 |
| **(c) #4** | `result_ck` `CHECK (result IN ('pending','approved','rejected'))` | `0025:54` | `CONSTRAINT currency_review_log_result_ck CHECK (result IN ('pending', 'approved', 'rejected')),` | H4 · H5 |
| **(c) #5** | `idem_uniq` `UNIQUE (idempotency_key, result)` | `0025:58` | `CONSTRAINT currency_review_log_idem_uniq UNIQUE (idempotency_key, result)` | H4 · H6 |
| **(d) #1** | PK 索引（约束自带） | `0025:51` | PK 自带 | H7 |
| **(d) #2** | idem 唯一索引（约束自带 · `(idempotency_key,result)`） | `0025:58` | UNIQUE 自带 | H7 · H6 |
| **(d) #3** | `currency_review_log_cid_idx` `ON (cid, time_created)` | `0025:101-102` | `CREATE INDEX IF NOT EXISTS currency_review_log_cid_idx ON public.currency_review_log (cid, time_created);` | H7 |
| **(d) #4** | `currency_review_log_actor_day_idx` `ON (actor_uid, time_created)` | `0025:103-104` | `CREATE INDEX IF NOT EXISTS currency_review_log_actor_day_idx ON public.currency_review_log (actor_uid, time_created);` | H7 |
| **(e) append-only** | 触发器 `trg_currency_review_log_append_only`（`BEFORE UPDATE OR DELETE`）+ 守门函数 `public.currency_review_log_append_only()` | `0025:79-84`（函数）/ `0025:89-92`（触发器） | `CREATE OR REPLACE FUNCTION public.currency_review_log_append_only() …` / `CREATE TRIGGER trg_currency_review_log_append_only BEFORE UPDATE OR DELETE ON public.currency_review_log FOR EACH ROW EXECUTE FUNCTION public.currency_review_log_append_only();` | H8 |
| **(f) 时间列** | **恰一列** `time_created`（DEFAULT now()）；**无** `time_updated` | `0025:50`（有）/ 全表无 `time_updated` 列 | `time_created        timestamptz NOT NULL DEFAULT now(),`；`time_updated` 列定义位 = 0 | H9 |
| **(e) 反断言** | **无** `create_key` / 无 `ledger_event_keys` | 全表无同名列（自检 `0025:191-195`） | 列定义位 = 0 | H10 |
| §26.8 零 `ALTER` | 不改既有表（`currency` / `currency_status_log`） | 全文零 `ALTER TABLE` | `/ALTER\s+TABLE/i` = false | H11 |
| 零数据 DML | 纯 DDL + append-only + 自检 | 全文零 `INSERT INTO` / `UPDATE public` / `DELETE FROM` / `ledger_post_event` | = false | H12 |
| 自带 apply-time 自检（DL48） | 失败则整迁移回滚、不写版本行 | `0025:110-209`（`DO $$ … $$`） | `RAISE NOTICE '0025 self-check OK: …'` | H13 |

---

## §4 权限键与注册点 71（逐 verb）

- **注册点 = 71**（判据 `^[ \t]*app\.(get|post|put|patch|delete)\(`，`R-8-20` 容忍前置空白）。逐 verb：**get 29 · post 39 · patch 1 · delete 2 · put 0** ⇒ 合计 **71**（8④ 动作口/读口各 +1；登记 69 → **71**）。
- **权限键 = 复用既有 11 键闭集**（真源 `backend-ts/src/database.ts:11-23` 的 `ALL_ADMIN_PERMISSIONS`，**零新增 / 零删除**）：`dashboard_access` / `manage_tasks` / `publish_tasks` / `manage_rewards` / `publish_prizes` / `read_users` / `manage_users` / `manage_points` / `manage_permissions` / `manage_settings` / **`review_tasks`（`:22`）**。
- 两路由（`backend-ts/src/index.ts`）闸均 = `requireAdmin(req, res, 'review_tasks')`：

| 路由 | 方法 / 路径 | 行锚 | 闸 | 取数 / 幂等 |
|---|---|---|---|---|
| 读口 | `GET /api/admin/currency` | `index.ts:2113` | `review_tasks`（`:2114`） | `DatabaseService.listCurrenciesForAdmin(filter.status)`（`:2120`，单一真源）；**无 `ops:` 键**（只读） |
| 动作口 | `POST /api/admin/currency/:cid/review` | `index.ts:2133` | `review_tasks`（`:2134`） | `resolveAdminOpsKey(req, actor.session.uID, CURRENCY_REVIEW_OPS_ACTION, cidText)`（`:2143`）⇒ 键形 `ops:<admin_uid>:currency_review:<cid>` |

- 受控实例鉴权实测（`§8`）：两路由**无 token 均 = 401 `AUTH_UNAUTHORIZED`**（闸先于任何 DB 读 ⇒ **不触新表**）。

---

## §5 四语键集与工程口径泄漏

- `adminCurrencyReview`：**四语各 28 键**，键集**逐语完全相等**（en == hk == vn == zh = 28）。
- `adminNav`（本片新增 2 键）：`currencyReview` + `currencyReviewDesc` **四语齐备**。
- `en` / `vn`：`adminCurrencyReview` 全值**零 CJK**（命中 `[]`）。
- `hk`：为**繁體**（抽查 `title` = `自建單位審核`，含 `單位` / `審核` 异形）。
- **六类工程口径泄漏 = 0**（判据 `§|R-8-|DL\d|LD\d` / HTTP 码 / `/api/` 与方法 / 内部批次名 / 机读码与裸 i18n 键 / 表列函数名；四语 × `adminCurrencyReview`）：命中 `[]`；`adminNav` 2 键泄漏 = `[]`；负对照自证 `judge_fired = true`。

---

## §6 硬门全量复跑（**退出码管道外捕获**）

| 门 | 读数 | 退出码 |
|---|---|---|
| `npx tsc --noEmit`（backend-ts） | 0 行 | **0** |
| 离线套件 `p4z-tr1a-01-offline-tests.ts` | **126 / 126** | **0** |
| 新门 · 前置 `p8-s1-app-config-gate.ts` | **24 / 24** | **0** |
| 前置 `p8-s2-fee-rebate-gate.ts` | **41 / 41** | **0** |
| 前置 `p8-s3-deposit-gate.ts` | **45 / 45** | **0** |
| 前置 `p8-s3b-address-gate.ts` | **38 / 38** | **0** |
| **新门 `p8-s4-currency-review-gate.ts`** | **74 / 74** | **0** |
| `npm run build`（frontend） | `index-BYREZ47t.js 347.90 kB`；`✓ built in 1.60s` | **0** |
| `npm run test:unit`（frontend） | **31 files / 276 passed**（≥276 不掉） | **0** |
| 七门（`frontend/scripts/*.mjs`） | `p4z-i18nviol-global` locale 裸命中 0 / 源面 0 · `p6-tr2-i18n-locales` PASS · `p4z-miscfix-links` 未登记残留 0 · `p4z-feperf-safelist` PASS · `p7a-03-errmessage-gate` 命中 0 / 基线 0 · `p7b-errfallback-gate` D 节点=132 需护栏=0 · **`p7c-errmsg-machinecode-gate` `链路体制 = 真链`** | 七门**全 0** |

> **★ 复跑触发说明**：本单**改动了 4 个门脚本**（`p8-s2` / `p8-s3` / `p8-s3b` 的跨批冻结计数前推 + 新门 `p8-s4`）。改动**不含任何被测文件**（`src/*.ts` / `0025` / locale 一字未动）⇒ 门读数即等价本轮最终态。凡门后又触碰被测文件者**必须重跑** —— 本单无此情形。

**★ 跨批冻结计数前推（逐字证据 · **非**判据删除 / **非**凑绿）**：8④ 合法新增 2 路由 + 1 迁移 + 2 `adminNav` 键 ⇒ 三个**前批**门的**跨批冻结计数**（HEAD 基线：注册点 69 / 迁移 23）失配：

| 门 | 判据 | 旧冻结 → 新冻结 | 逐字证据 |
|---|---|---|---|
| `p8-s2` `A1` | 注册点数 | **69 → 71** | HEAD `index.ts` 线锚路由 = 69（`git show HEAD:…`）；工作树 = 71（8④ +2） |
| `p8-s2` `D1-adminNav` | `adminNav` 键数 | **20 → 22** | 8④ +`currencyReview` +`currencyReviewDesc`（本片四语齐） |
| `p8-s3` `E1` / `E1b` | 注册点数 + `R-8-20` 负对照 | **69 → 71**（对照 69→70 变 71→72） | 同上；实跑 `{upgraded:72, legacy_column0:71}` |
| `p8-s3` `E6` · `p8-s3b` `G4` | 迁移文件数 | **23 → 24** | `ls migrations/*.sql` = 24（新增 `0025`） |
| `p8-s3b` `G1` | 注册点数 | **69 → 71** | 同上 |

- 性质 = **(a) 探针口径错**（门的**跨批计数常量**相对**合法变动的产品**陈旧），与「计数期望登记 `105⇒106 / 788⇒818 / 3152⇒3272`」**同类**；判据本体（零新增路由 / 零新增迁移 / 零退还罚没面）**语义未动、条数未减**（`p8-s2` 仍 41 · `p8-s3` 仍 45 · `p8-s3b` 仍 38）。**未新增/未删除任何断言**。

---

## §7 仓外副本判负（不含库面）

- 副本位置：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p8s4-copy`（rsync 主仓，排除 `node_modules` / `.git` / `.*-artifacts` / `dist`；`backend-ts/node_modules` 以软链接指回主仓）。
- **基线**：副本内 `p8-s4` = **74 / 74**（`exit 0`）。

| 变异 | 位置 | 改法 | 期望红点 | 实测 |
|---|---|---|---|---|
| **M1 驳回不落台账** | `src/database.ts` | `AND ($3::text <> 'approved' OR EXISTS (SELECT 1 FROM apply))` → `AND ($3::text = 'approved')` | `E2` | ✅ 红 |
| **M2 approve 门控删除** | `src/database.ts` | `apply` CTE 内删 `AND $3::text = 'approved'` | `E4` | ✅ 红 |
| **M3 闸错键** | `src/index.ts` | 读口 `'review_tasks'` → `'manage_settings'` | `A4` | ✅ 红 |
| **M4 迁移混入 `time_updated` 列** | `migrations/0025…sql` | `CREATE TABLE` 插 `time_updated timestamptz,` | `H9` | ✅ 红 |

- **变异态读数**：`exit 1` / `70 passed / 4 failed`；**逐字红点 = `['A4','E2','E4','H9']`** —— 与预期**四项全中**（M4 尤其坐实 ② 的结构面判据仍咬真列）。
- **复原**：从主仓回拷 3 件 ⇒ 副本 `p8-s4` = **74 / 74**（`exit 0`）。
- **主仓零写入**：`cmp` 副本 vs 主仓 3 件（`database.ts` / `index.ts` / `0025…sql`）**逐字节相同（SAME）**；首尾 `git status` 可逐条归因（`src/` 两件 `M` = 上单既有；3 门脚本 `M` = 本单计数前推；`0025` / 新门 / service / 报告 / 页面 = 上单 `??`）⇒ **无新增主仓写入**。

---

## §8 收尾（受控实例 + 端口 + 首尾 git status）

- 受控实例：`cd backend-ts && PORT=5796 npx ts-node --transpile-only src/index.ts`（链 `.env.local`，**未打印其内容**；后台起、**未用裸 `&`**）。
- 只读 / 鉴权面探针（**未碰新表**）：

| 探针 | 读数 |
|---|---|
| `GET /health` | **200** · `schema_version = **0024**`（迁移未 apply）· DB 可达 |
| `GET /api/admin/currency`（无 token） | **401** `AUTH_UNAUTHORIZED`（读口已注册 · 闸先于 DB） |
| `POST /api/admin/currency/1/review`（无 token） | **401** `AUTH_UNAUTHORIZED`（动作口已注册 · 闸先于 DB） |
| `GET /api/user/ledger`（无 token） | **401** `AUTH_UNAUTHORIZED` |
| `GET /api/admin/currency?status=bogus`（无 token） | **401**（鉴权先于滤镜解析 ⇒ 无表访问） |

- 收尾：按**精确 PID** `kill -TERM` —— 监听 PID **87472** + 包装 PID **87093**；`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**（exit 1）。
- **5787 / 5788 未碰**；未 `pkill`/`killall`；未 `git add/commit/push`。
- 首尾 `git status`：见 §7 归因，`M` / `??` 全集一致（本单增 3 门脚本 `M` + 报告 `??`）。

---

## §9 `NOT_MEASURED`（逐项 · 禁填 0 / 空）

| # | 未测项 | 原因（逐字） |
|--:|---|---|
| 1 | **四段真链路（①后台审 → ②库内落值 → ③业务读口取数 → ④行为随之）** | **待 Zang apply `0025` 后另一单补跑**：本单硬约束 = **不得 apply `0025`、不得碰真库**（`0025` 一旦 apply 内容即冻结 checksum；须门与报告先行收口、内容定稿后由 Zang apply）。 |
| 2 | **库面判负（驳回不落台账 / 通过不写 `currency_status_log` / 状态非 `draft` 仍落行 / `ON CONFLICT` 重放 / 明细流转）** | 同上：需真表在场；本单**零 DB / 零 HTTP 写**。 |
| 3 | **新表 `public.currency_review_log` 的现库结构 / 行数** | 迁移**未 apply** ⇒ 表不存在；受控实例 `/health` 仍报 `schema_version = 0024`。 |
| 4 | **动作口的线上写面（真 HTTP `POST …/review` 全链）** | 无 admin 凭据；且按 `R-8-15` 口径，写面验收一律「事务内造数 + 回滚」，不在生产库跑真写。 |
| 5 | **动作口错误码 `LEDGER_CURRENCY_INVALID_TRANSITION`（409）与 `LEDGER_CURRENCY_NOT_FOUND`（404）的真库触发** | 门只在**纯函数面**判负（`parseReviewInput` / DB 侧 CTE 文本），真库分支（`cur_found=0` / `cur_status≠draft`）待 apply 后补跑。 |

---

## §10 自曝

1. **跨批冻结计数前推是判断项，非机械项**：`p8-s2` / `p8-s3` / `p8-s3b` 三门的 5 处冻结计数（69→71 / 23→24 / 20→22）由 8④ 合法新增所致。已在 §6 给逐字证据，并**保持判据语义与条数不变**；若 Zang 认定这些计数应另单处置 ⇒ 可回退（本单未删任何断言）。
2. **E4 的旧正则差 1 字符**：门限 `{0,120}` vs 真值 121 —— 属「人肉窗口」抗性差，已改为锚定 `apply` CTE 的无上限结构判据（并加负对照自证）。
3. **H9 / H10 的旧判据是「全文含 token」**：对**中文注释 + 反断言自检**的迁移天然误报；已改为结构面判据（去注释 + 去字面量后再判）。
4. **本单唯一改动面**：4 个门脚本（`p8-s4` 分类修复 + 三门计数前推）+ 本报告。**`src/*.ts` / `0025` / locale / 其它迁移 / 任何 `docs/*.spec.md` 一字未改**；未 apply、未跑迁移运行器、未碰 `.env*`、未 `git` 提交。
5. **判据强度诚实边界**：`p8-s4` 是**文本/纯函数级**离线门（`§3` 迁移契约 = **文本断言**，非 apply 后结构断言）；真结构与真链路待 apply 后由另一单在真库面判负（§9）。

---

## §11 补漏节（8④ C2 审核闸 + 四段真链路 · 库面补跑）

> **本单 = 8④ 补漏单**（派单方遗漏「C2 加闸」，**非实现方之错**）。承接 §1–§10，**本节只追加**。
> 现取：仓库 `/Users/kevin/bistro/seafood` · HEAD `2f0cb40` · 受控实例 `/health` = `schema_version **0025**`（`0025` 已由 Zang apply，库内现取；本单**未 apply 任何迁移**）。

### §11.1 C2 加闸（核心）—— 实现与现取依据

- **改动**（唯一写点 · 最小 diff）：`backend-ts/src/database.ts` 的 `LIST_CURRENCY_WITH_DEPOSIT_SQL`（C2 **唯一写路径** SQL，`:197`）之 `apply` CTE 的 `WHERE` 追加一行 **fail-closed 闸**（`:219-229`）：
  `AND EXISTS (SELECT 1 FROM public.currency_review_log AS r WHERE r.cid = $1::bigint AND r.result = 'approved')`
- **落点取舍（为何落 SQL 而非 `listCurrencyVerb` / 路由层）**：C2 的**唯一**写口径 = 这条 SQL（服务层 `listCurrencyVerb → DatabaseService.listCurrencyWithDeposit`；探针「同路径」`ex` 口 · `R-8-18` 单一真源）。闸放进 SQL ⇒ ① **不可绕过**（仓内无第二条 `draft→listed` 业务写口）；② **零 service / 零路由改动** ⇒ 既有错误分支与**判定优先级**（重放 200 → 非本人 403 → 同键异指纹 409 → 状态 409）**逐字不变**；③ 闸不产地行时**自然落回冻结锚点** `currency-service.ts:454` 的 `stateConflict(...)`，与 `§23.5 ④` 逐字一致（**最小侵入且不改既有错误形状**）。
- **零新增码 / 零新增 reason 常量**：落值 = `{field:'currency.status', reason:'CURRENCY_STATE_INVALID', cid, from, to:'listed', required_from:'draft'}` —— `reason` 为**稳定常量、无插值**；33 码闭集不动。
- **approve 与 C2 的关系（逐字）**：**approve 自己就把 `currency.status` 迁 `draft → listed`**（`CURRENCY_REVIEW_POST_EVENT_SQL`，同事务写 `currency_status_log` 恰 1 行）。⇒ **审核通过后**单位**已是 `listed`**，C2 的 `c.status = 'draft'` **自然不满足 ⇒ C2 自然拒（`required_from='draft'`）**；故 C2 **唯一**绕过口 = **未审的 `draft`**（owner 自助上市）——本闸正是堵它。台账表 **append-only** ⇒ 「已通过」单调不可撤销 ⇒ **无 TOCTOU 逃逸**。

### §11.2 三表触发器清单（C-8 纪律 · 现取 `pg_trigger`）

| 表 | 启用触发器（非 internal） | 守门函数 | 源 | 语义 |
|---|---|---|---|---|
| `public.currency` | **0 个** | — | `0001_ledger_core.sql` 建表 | 无触发器（`status` 转移由业务语句负责）|
| `public.currency_status_log` | `trg_currency_status_log_append_only` | `currency_status_log_append_only()` | `0017:237` / `0017:192` | `BEFORE UPDATE OR DELETE` **无条件 `RAISE`**（原生 `P0001`）|
| `public.currency_review_log` | `trg_currency_review_log_append_only` | `currency_review_log_append_only()` | `0025:90` / `0025:79` | 同上 · **只增不删** |

- ⇒ 后两者**写完不可删改**（诚实边界：不拦 `TRUNCATE` / `DISABLE TRIGGER USER`）⇒ **一切写面「事务内 + 末尾 `ROLLBACK`」**（本节真链路全部按此执行，**生产库零净写**，见 §11.3 残渣读数）。

### §11.3 四段真链路（事务内 + `ROLLBACK` · 权威 run `p8s4-effective-20261002T234507Z`）

探针 `backend-ts/scripts/p8-s4-01-effective.ts`：**31 / 31 · exit 0**（退出码管道外捕获）。单 `withTransaction` + 末尾哨兵 ⇒ `ROLLBACK`（绝不 `COMMIT`）。

**（A）通过路径**（① 后台动作 → ② 库内落值三处 → ③ 业务读口 → ④ 行为随之）

| 步 | 逐字读数 | 判据（判负形态）|
|---|---|---|
| ① 未审 C2 | `unreviewed_c2 = {applied:0, status_post:'draft', ledger_legs:0, status_log_rows:0}` | 未审 `draft` C2 必 **不产行**（未审可上市 ⇒ 判负）|
| ① 后台动作 | receipt `{cur_found:1, applied:1, slogged:1, reviewed:1}` | 任一 ≠ 1 ⇒ 判负 |
| ② 台账 | `currency_review_log` 恰 **1 行**：`result='approved' / actor_uid='1'(admin) / cid / memo='probe approved' / time_created 非空` | 无行 / 记成 owner ⇒ 判负 |
| ② `status` | `currency.status = 'listed'` + `listed_at` 非空（`draft→listed`）| 未变 ⇒ 判负 |
| ② 状态日志 | `currency_status_log` 恰 **1 行**：`draft→listed / actor_uid='1'` | 少行 / 多行 / 非此边 ⇒ 判负 |
| ③ 业务读口 | 直取 `SELECT status … = 'listed'`（读口 `database.ts:2349 listCurrenciesForAdmin` 同一 `SELECT`）| 仍旧值 ⇒ 判负 |
| ④ 行为随之 | 见下表「两读数」 | — |

**（B）驳回路径**

| 项 | 逐字读数 | 判据 |
|---|---|---|
| receipt | `{cur_found:1, applied:0, slogged:0, reviewed:1}` | — |
| 台账 | 恰 **1 行** `result='rejected' / actor_uid='1'(admin) / memo='probe reason'` | ★ **驳回后台账无行 ⇒ 判负** |
| `status` | 仍 `'draft'` | 变了 ⇒ 判负 |
| 状态日志 | **0 行** | 写了 ⇒ 判负 |
| C2 | `applied:0 / cur_status:'draft'` ⇒ **仍不可上市** | 驳回后可上市 ⇒ 判负 |

**（C）幂等**

| 款项 | 逐字读数 | 判据 |
|---|---|---|
| 同键同 `result` 重投（approve）| `{prior_count:1, applied:0, reviewed:0}` · 台账行**不增**（仍 **1**）| 增行 ⇒ 判负 |
| 同键异 `result`（先驳后成）| 第 1 次 reject（rows=1）→ 第 2 次 approve `{prior_count:0, applied:1, reviewed:1}` ⇒ 终态 rows=**2** · `status='listed'` | 被幂等挡 ⇒ 判负 |

**（D）④ 行为随之 · 两读数（同一业务量 = 该单位可否上市）**

| 读数 | 取值（逐字） | 来源 |
|---|---|---|
| **改动后（有闸）**：未审 `draft` + owner C2 | `applied=0` / `status_post='draft'` / 零分录 / 零状态日志 ⇒ **不可上市**（映射 `409 LD011` / `reason=CURRENCY_STATE_INVALID` / `required_from='draft'` @ `currency-service.ts:454`）| 主仓 run `p8s4-effective-20261002T234507Z` |
| **改动前（去闸）**：同输入 | `applied=1` / `ledger_legs=4` / `status_log_rows=1` ⇒ **未审可自助上市**（绕过口实证）| 仓外副本（§11.5 M-C2）· 副本 run `p8s4-effective` |
| **审核通过后** | `status='listed'` ⇒ R28 `hold`/`price` **放行**（`assertCurrencyOperable` 通过）；未审 `draft` ⇒ R28 抛 **`LD008 LEDGER_CURRENCY_NOT_LISTED`** | `ledger.ts:644` |
| 附：已 `listed` 单位再调 C2 | `applied=0 / cur_status='listed'` ⇒ **自然拒**（非绕过口）| 主仓 run 同上 |

**（E）非法入参 ≥6 + 权限面**

| # | 输入 | 读数 | 期望 |
|--:|---|---|---|
| D1 | `:cid` 非数字 | 404 `LEDGER_CURRENCY_NOT_FOUND` | 404 LD007 |
| D2 | `:cid = 0` | 404 `LEDGER_CURRENCY_NOT_FOUND` | 404 LD007 |
| D3 | `action` 缺失 | 400 `LEDGER_AMOUNT_INVALID` | 400 |
| D4 | `action='maybe'` | 400 `LEDGER_AMOUNT_INVALID`（`reason=NOT_IN_CLOSED_SET`）| 400 |
| D5 | `reason` 缺失（驳回）| 400 `LEDGER_AMOUNT_INVALID` | 400 |
| D6 | `reason='   '`（驳回）| 400 `LEDGER_AMOUNT_INVALID` | 400 |
| H1/H2 | 两路由**无 token**（真 HTTP 5796）| **401 `AUTH_UNAUTHORIZED`** | 401 |
| H3/H4 | 两路由**非 admin**（真 HTTP 5796）| **403 `AUTH_FORBIDDEN` / `reason=NOT_ADMIN`** | 403 |
| H5 | 读口 **admin token**（正控）| **200** | 200 |
| H6 | 动作口 admin token + 非数字 `:cid` | **404 `LD007`**（路由在任何写逻辑前早退）| 404 |
| D7 | 全部非法入参用码 | `⊆ {LD007, LD011, LD016}` | **零新增码** |

- 真 HTTP 探针 `backend-ts/scripts/p8-s4-02-http-readonly.ts`：**6 / 6 · exit 0**，run `p8s4-http-20261002T234659Z`（受控实例 `PORT=5796`；令牌由**本仓自身** `createSessionToken` 现签、**不打印令牌值**；**只跑读面 / 鉴权面 / 早退面**）。

### §11.4 硬门复跑（**退出码管道外捕获**）

| 门 | 读数 | 退出码 |
|---|---|---|
| `npx tsc --noEmit`（backend-ts）| **0 行** | **0** |
| 离线套件 `p4z-tr1a-01-offline-tests.ts` | **126 / 126** | **0** |
| `p8-s1-app-config-gate.ts` | **24 / 24** | **0** |
| `p8-s2-fee-rebate-gate.ts` | **41 / 41** | **0** |
| `p8-s3-deposit-gate.ts` | **45 / 45** | **0** |
| `p8-s3b-address-gate.ts` | **38 / 38** | **0** |
| **`p8-s4-currency-review-gate.ts`** | **79 / 79**（run `p8s4-20261002T234551Z`；**原 74 + 新 J 组 5 条 = 79**）| **0** |
| `npm run build`（frontend）| `index-BYREZ47t.js 347.90 kB` · `✓ built in 1.56s` | **0** |
| `npm run test:unit`（frontend）| **31 files / 276 passed**（≥276 不掉）| **0** |
| 七门（`frontend/scripts/*.mjs`）| `p4z-i18nviol-global` 裸命中 0 · `p6-tr2-i18n-locales` PASS · `p4z-miscfix-links` 未登记残留 0 · `p4z-feperf-safelist` PASS · `p7a-03-errmessage-gate` 命中 0/基线 0 · `p7b-errfallback-gate` 节点 132 需护栏 0 · **`p7c-errmsg-machinecode-gate` `链路体制 = 真链`** | 七门**全 0** |

- **`p8-s4` 新增 J 组 5 条**（C2 闸判据，含负对照自证）：`J1` 上市语句被审核闸门控 / `J2` 闸谓词 `result='approved'` 稳定常量 / `J3` fail-closed（`EXISTS` 而非 `NOT EXISTS`）/ `J4` 按 `cid=$1` 关联 / `J1__selftest`（喂无闸 `apply` CTE ⇒ 谓词必转红，实测 `judge_fired=true`）。

### §11.5 仓外副本判负（≥2 处 · 逐字红点 + 复原回绿 · 主仓零写入）

- 副本 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/p8s4-copy2`（rsync 主仓，排除 `.git`/`node_modules`/`.p*-artifacts`/`dist`；`node_modules` 软链回主仓）。**基线** 副本 `p8-s4` = **79 / 79**（exit 0）；复原后 = **79 / 79**（exit 0）。

| 变异 | 位置 | 改法 | 期望红点 | 实测红点 |
|---|---|---|---|---|
| **M-C2**（去 C2 闸）| `src/database.ts` | 删除 `apply` CTE 内的 `AND EXISTS (SELECT 1 FROM public.currency_review_log …)` 块 | `J1/J2/J3/J4` | ✅ **红 = ['J1','J2','J3','J4']**（离线门）+ 副本**有效探针** `unreviewed_c2.applied=1 / ledger_legs=4 / status_log_rows=1`（**未审可上市**实证）|
| **M-C2b**（闸向反转）| `src/database.ts` | `AND EXISTS (` → `AND NOT EXISTS (`（fail-open 向）| `J1/J3` | ✅ **红 = ['J1','J3']** |
| **M-reject**（驳回不落台账）| `src/database.ts` | `AND ($3<>'approved' OR EXISTS(SELECT 1 FROM apply))` → `AND ($3='approved')` | `E2` | ✅ **红 = ['E2']** |

- **复原回绿**：从主仓回拷 `src/database.ts` ⇒ 副本 `p8-s4` = **79 / 79**（exit 0）。
- **主仓零写入**：复原后 `cmp` 主仓 vs 副本 —— `src/database.ts` / `src/index.ts` / `src/currency-review-service.ts` / `scripts/p8-s4-currency-review-gate.ts` / `migrations/0025…sql` **全部逐字节 SAME**（⇒ 变异只发生在副本）。
- **残渣零净写**（主库只读核 · 探针连跑 3 次后现取）：`currency_review_log` 行 = **0** · `cid ≥ 900000000` 的 `currency` 行 = **0** · `p8s4%` symbol = **0** · `cid ≥ 900000000` 的状态日志 = **0** · 探针幂等键（`biz:currency:list:900%` / `ops:%:currency_review:900%`）的 `ledger_entry` = **0** · `MAX(cid)` = **36**（未被探针推进）；`ledger_entry` 总数 = **355**（现取——**探针键 0 命中为核心证据**：本单未新增任何账本行）。

### §11.6 NOT_MEASURED（逐项 · 禁填 0 / 空）

| # | 未测项 | 原因（逐字）|
|--:|---|---|
| 1 | **真 admin 凭据的 `approve`/`reject` 真 HTTP 写面** | 按 `§23.5(b)` / `R-8-15`：真写会在生产库 `COMMIT` 一条**不可删**台账行 + 迁 `status`（`currency_review_log` append-only ⇒ 不可复原）⇒ **禁跑**。已由**事务内 + ROLLBACK** 的「同路径 DB 函数」实测替代（§11.3）。|
| 2 | **`PERMISSION_NOT_GRANTED` 子面（原列未测 —— 2026-10-03 已实测覆盖）** | **实测已覆盖**（受控实例 5796 · Neng 收尾单 2026-10-03）：库内存在 uid `900004`（`is_admin=false` + `admin_user_role='p7b_fixture_admin'`，权限仅 `manage_points`）⇒ 两条路由均得 **`403 AUTH_FORBIDDEN` + `details.reason = 'PERMISSION_NOT_GRANTED'`**（逐字）。并列读数：无 token ⇒ `401 AUTH_UNAUTHORIZED`；非 admin（uid 2）⇒ `403 / NOT_ADMIN`；admin（uid 1）读口 ⇒ `200`（`data` 15 行）；非数字 `cid` ⇒ `404 LEDGER_CURRENCY_NOT_FOUND`。|
| 3 | **C2 真 HTTP `POST /api/currency/:cid/list`（未审 draft 走真 HTTP）** | 同上：闸若失效即**不可复原写**；且无合适 owner 之外的触发面。已由**同 SQL** 的事务内探针实测（`R-8-18` 同路径）。|
| 4 | **`0025` apply 后的**真结构断言**（vs §3 文本断言）** | 本单**未 apply**；但库内现取 `schema_version=0025` + `pg_trigger` / `information_schema` 已核得表 / 8 列 / 触发器在场（§11.2 起）。|

### §11.7 自曝

1. **本补漏单唯一改动面**：`src/database.ts`（C2 闸，1 处 `WHERE` 追加）+ `scripts/p8-s4-currency-review-gate.ts`（+J 组 5 条）+ 2 个新探针（`p8-s4-01-effective.ts` / `p8-s4-02-http-readonly.ts`）+ 本节。**未 apply 任何迁移 · 未改 `0025` / `index.ts` / `currency-review-service.ts` / locale / 任何 `docs/*.spec.md` / `master-plan` / 既有 `docs/audit` / `docs/qa`**；未 `git add/commit/push`；未碰 `.env*`；未 `pkill`/`killall`；未启停 5787/5788；受控实例仅 5796（精确 PID `kill -TERM`，`lsof 5796-5799` = 空）。
2. **落点取舍为判断项**：闸落 `database.ts` 的 SQL（非 `listCurrencyVerb`）——理由见 §11.1（不可绕过 + 零错误形状位移 + 落回冻结锚点 `:454`）。若 Zang 认定必须落 service 层 ⇒ 可迁（须重跑 §11.3–§11.5）。
3. **「通过后放行」的口径**：按 `§23.5 ④` 逐字，approve 自身即完成 `draft→listed` ⇒ C2 在 approve 后**自然拒**（`required_from='draft'`）；「放行」指**该单位已 `listed`、可挂单/标价/计酬**（R28）⇒ 见 §11.3(D) 两读数。
4. **`p8-s4` 门数变化**：74 → **79**（+J1/J2/J3/J4 与 1 条 J1 自证），判据**只增不减**。


### §11.8 订正记录（2026-10-03 · 收尾质检登记 4 处）

> 口径：**就地订正**（正文已替换；逐字「旧 ⇒ 新」见 `git diff` 的删除/新增行）。本节不复引被改字面量，以保现取复核「旧串命中 = 0 · 新串见 §… 修订行」。

1. **§11.6 #2** —— 撤「无合适账号 ⇒ 未测」定性，改列**实测结论**：库内 p7b 只读账号（`is_admin=false` + `admin_user_role='p7b_fixture_admin'`，权限仅 `manage_points`）两条路由均得 `403 AUTH_FORBIDDEN` + `details.reason='PERMISSION_NOT_GRANTED'`；并列 无 token⇒`401`、非 admin(uid 2)⇒`403 / NOT_ADMIN`、admin(uid 1)读口⇒`200`(15 行)、非数字 `cid`⇒`404`。逐字读数见 §11.6 #2 修订行。
2. **§0 自证措辞收紧** —— 原「双下划线命中录零」字面不成立，改为「实质占位为 0；`__` 字面命中 1（系门自证标识符，非占位）；`待回填` 命中 1（系元陈述内回引）」。逐字见 §0 修订行。
3. **§11 锚点漂移** —— `listCurrenciesForAdmin` 锚点由原记数字上调 +11 订正为现取数字（`grep -n` 现取）。逐字见 §11 修订行。
4. **§11 笔误** —— 七门脚本名多一 `v` 的字面笔误，订正为与 `frontend/scripts/` 实文件一致的写法。逐字见 §11 修订行。
