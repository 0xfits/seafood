# 项目（打工 / 工资）域后端落盘 · 收尾报告

- **仓** = `/Users/kevin/bistro/seafood`（`main`）· **基线 commit** = `4dc2717`
- **本单性质** = 后端项目域**落盘**（迁移 0063/0064 + 服务层 + 七口接线 + 门）
- **apply** = **未做**（真库 `schema_migration` 顶仍 = `0061`；本门全程单回滚事务）
- **push** = **未做**（仅本地 commit）
- **未触碰** = `frontend/**` · `docs/**` · `vercel.json` · 既有迁移文件（`0063`/`0064` 为新增，其余零改动）

---

## 1. 交付物

| 文件 | 性质 | 行数 / numstat |
|---|---|---|
| `backend-ts/migrations/0063_project_domain.sql` | 新增 · 四表 DDL + 配置键 + 尾部 `DO $$` 自检 | 346 行 |
| `backend-ts/migrations/0064_seed_projects.sql` | 新增 · 十条链种子（按 `title` 幂等） | 157 行 |
| `backend-ts/src/project-service.ts` | 新增 · 服务层（七口 verb + 纯函数 + 常量） | 1059 行 |
| `backend-ts/src/index.ts` | 改 · 七口接线 + 活动桶埋点（**纯追加**） | `134 0` |
| `backend-ts/scripts/p7b-03-offline-gates.ts` | 改 · `regs` 常量前推 111 → **118** | `7 2` |
| `ops/project/p63-00-project-gate.ts` | 新增 · 本域门（35 项） | 586 行 |
| `ops/project/readings/p63-project-gate-*.json` | 新增 · 读数（只留最终全绿一轮） | — |

`src/index.ts` 的 `numstat` **删除列 = 0** ⇒ 既有 111 个注册点的处理体逐字未动，本单只做「新增 7 个注册点 + 1 行旁路埋点」。

---

## 2. 读数（本轮现跑）

| 面 | 门 | 读数 |
|---|---|---|
| 项目域 | `ops/project/p63-00-project-gate.ts` | **35 / 35**（含 N 三臂负控、B 段迁移干跑、S 段真路径、Z 段零残留） |
| 注册点闭集 | `backend-ts/scripts/p7b-03-offline-gates.ts` | **37 / 37** · `registration_points=118` |
| 类型面 | `npx tsc -p tsconfig.json --noEmit` | **0 error** |
| 既有门回归 | p57 40/40 · p58 29/29 · p59 13/13 · p59b 42/42 · p60 37/37 · p61 39/39 | 全绿（前推常量后） |

`p63` 门共 35 项 = A 静态 14 + B 迁移/读口 3 + S 真路径 14 + N 负控 3 + Z 残留 1
（`X` 只在事务抛错时**补记一条**，全绿轮不出现 ⇒ 不计入分母）。
（**口径更正**：首跑报「15/17」是因为 `X` 在 B 段后即中止 ⇒ S/N 段一条都没跑；不是本域只有 17 项判据。）

---

## 3. 门自身缺陷（4 处，全在本单修完）

| # | 症状 | 根因 | 修法 |
|---|---|---|---|
| 1 | `A13` 五个 reason 全读成空串 | `parseProjectPayload` 出参是 `{payload} \| {err}` **联合**，门把整个返回当 `VerbErr` 用 ⇒ `r.ok` / `r.details` 都是 `undefined` | 加 `errOf()` 一律取 `.err` 再判；5 个 reason 现全部命中 |
| 2 | `X` = `42P01 relation "public.project" does not exist` | 门的 SQL 切分器把 `CREATE TABLE` 前的大段 `--` 注释并进第一条语句 ⇒ 首条 `CREATE TABLE public.project` 随注释被当成同句「注释」吞掉，表没建就查 | **切分前先剥注释**（`stripSqlComments`，dollar-dollar 外按 `--` 到行尾删）—— **迁移文件一字未动** |
| 3 | `X` = `503 LEDGER_LOCK_TIMEOUT`（修 #2 后暴露） | 夹具铸币走 `postEvent` 未注入 `ex` ⇒ 另起一条连接；该连接的 FK 检查要读本事务**未提交**的 `users` 行 ⇒ 等锁到超时 | 两笔 `postEvent` 均注入 `ex`（同事务）；资金夹具随事务回滚 ⇒ Z1 仍 0 残留 |
| 4 | `S1` entries=1（应 2）· `N1` `22P02` · `S4/S5/S6/S8/S12` 404 | ① 台账两腿的派生键是 `<key>#<i>` ⇒ 只按 `idempotency_key = $1` 等值计数少算一半；② 铸币额只够建 1 个项目 ⇒ 后续 `create` 全部 409 拿空 `project_id`，`P4=''` 让 `$1::bigint` 报 `22P02`；③ `S14` 在 `S13`（W2 离职）之后对 `P1` 缩容到 1 是**合法**的（在职只剩 1） | ① 计数改 `= k OR LIKE k \|\| '#%'`；② 铸币额 `fee*8 + 5000`；③ 缩容改用专用 `P6`（满员 2/2 后再缩到 1） |

附带的一处**服务层可测性**改动：`listProjects(ex?)` / `getProjectByRef(ref, ex?)` 新增**可选**事务连接注入（`ex` 缺省 = 原只读池，HTTP 路径调用点未变）。原因：迁移干跑未提交 ⇒ 别的连接看不到四表，读口否则无法在门内被真调。这不是行为变更，是**同一份 SQL 换连接**。

---

## 4. 常量前推（仅常量，无行为回归）

| 文件 | 前推 | 说明 |
|---|---|---|
| `p57` / `p58` / `p59` / `p59b` / `p60` | `regs === 111` → `118` | 红因**只有** `A1 registration_points=118`；本单**零新注册点** |
| `p61` | `111` → `118` · `by_verb [50,57,0,3,1]` → `[52,61,0,3,2]` | 同上；逐 verb 增量 = 项目域 2 GET / 4 POST / 1 PATCH |
| `p59b` `A4` / `P1` | 迁移**文件链顶** `0061` → `0064` | 因 0063/0064 落盘；`0062` 从未落盘 ⇒ 编号顺延（`p63` 门 `A12` 同条判据） |

**key 数口径**：既有 111 口的响应体键集**零变化**（`index.ts` 纯追加、删除列 0）；新增键只出现在本域 7 个新口自己的 view 里。`LEDGER_KINDS` 仍 24、`LEDGER_ERROR_CODES` 仍 33 ⇒ 无 kind/码新增。

---

## 5. 三条口径披露（本单必须写明的）

### 5.1 物理列数：`project` **14 列** · `project_wage_claim` **10 列**

| 表 | 物理列 | 列名 |
|---|---|---|
| `public.project` | **14** | `project_id` `snowflake_id` `owner_uid` `title` `description` `headcount` `recruit_min_account_days` `wage_batt_per_claim` `wage_cid` `wage_currency_amount` `wage_interval_hours` `status` `time_created` `time_updated` |
| `public.project_worker` | 6 | — |
| `public.project_wage_claim` | **10** | `claim_id` `project_id` `uid` `batt_credited` `currency_cid` `currency_amount` `hours_elapsed` `active_hours` `offline_hours` `time_created` |
| `public.user_activity_hour` | 4 | — |

依据 = 门 `B1` 现跑读数 `information_schema.columns`：`{"project":14,"project_wage_claim":10,"project_worker":6,"user_activity_hour":4}`。
**披露点**：`project` 的 14 列里含 `snowflake_id`（对外标识，出参一律字符串）与两枚时间戳，**业务列只有 11 枚**；`project_wage_claim` 的 10 列里 `currency_cid`/`currency_amount` 是**可空双币腿**（`(cid IS NULL) = (amount IS NULL)` CHECK），**币种腿的列不是 2 张表**。

### 5.2 零新 kind / 零新错误码

- **kind**：`LEDGER_KINDS` 仍 **24** 值，**不含** `project_create_fee` ⇒ 建费**借** `currency_create_fee`（`PROJECT_CREATE_FEE_KIND = 'currency_create_fee'`）。电量（batt）**根本不是 ledger kind**（走 `batt_account` / `batt_entry`），故无需新 kind。
- **错误码**：`LEDGER_ERROR_CODES` 仍 **33** 码闭集；本域全部**借码 + `details.reason`** 表意：400 借 `LEDGER_AMOUNT_INVALID`、403 借 `AUTH_FORBIDDEN`、404 借 `LEDGER_REF_NOT_FOUND`、409 借 `LEDGER_INSUFFICIENT_BALANCE`，`reason` 字符串**不进**闭集。
- 门 `A6` / `A7` 现跑读数：`kinds=24 borrowed=true` · `codes=33`。

### 5.3 领薪 400/403 与 route 册 409 的差异（服务层头注已写）

派单要求「间隔未到 ⇒ 400、未录用 ⇒ 403」，而 `docs/route-layer.spec.md §49.19.3` 原表写 409。本实现取**派单口径**（同节自带授权句「具体码回填时可在闭集内择近者替换」）：

| 场景 | 实现 | `details.reason` |
|---|---|---|
| 领薪：间隔未到 | **400** `LEDGER_AMOUNT_INVALID` | `wage_interval_not_reached` |
| 领薪：未录用 | **403** `AUTH_FORBIDDEN` | `worker_not_hired` |
| 其余闸（非招募期 / 满员 / 天数不足 / 他项目在职 / ended 封板 / 缩容低于在职） | **409** | 各自 reason |

上述取舍逐字写在 `backend-ts/src/project-service.ts` 头注第 27–32 行（`★ 两处「派单与 route 册状态码」的显式取舍`），门 `S9` / `S12` / `S14` 按此断言。

---

## 6. N 三臂负控（判据可红，非自证）

| 臂 | 反事实动作 | 读数 | 结论 |
|---|---|---|---|
| ① 部分唯一索引 | `DROP INDEX project_worker_single_hired_uniq` 后同 uid 双项目在职直插 | 成功、hired 行 = **2**；复索引后 ⇒ **23505** | 索引缺失时「S8 他项目在职 409」必失效 ⇒ 判据对索引敏感 |
| ② 100h 上限 | 直插 `hours_elapsed = 150` | **23514**（`project_claim_hours_check`）；去 cap 的窗口值 = 150 > 100 | DB CHECK 与函数 cap **双证**；「S11 hours=100」非恒真 |
| ③ 建费扣款 | 穷号建项 vs 跳过扣费腿直插项目行 | 穷号 ⇒ **409** `project_create_fee_insufficient` · 项目行不增 · 同键台账 **0** 条；绕过 ⇒ 行数 **+1** | 「免费建项」可现 ⇒ 扣费腿是唯一闸 |

---

## 7. 边界与残留

- **未 apply**：真库提交面 `information_schema` 四表 = **0**、`app_config.project_create_fee` = **0** 行、`schema_migration` 顶 = **`0061`**、夹具用户（`bio LIKE 'p63-gate%'`）= **0** 行 —— 门跑完现取，四读全 0/空。
- **未 push**；**未改** `frontend/**`、`docs/**`、既有迁移。
- 种子 10 条链项目只在**回滚事务内**建过，dev 库无残留（同上读数 `tables=0`）。

---

## 8. 证据文件

- `ops/project/readings/p63-project-gate-20261020T104035Z8b3v.json`（35/35 全绿终轮；同轮 `Z1` 残留 = 0）
- 回归门的读数落在各自目录（`ops/item-detail/readings/` · `ops/admin-edit/readings/` · `ops/item-id/readings/` · `ops/multi-buy/readings/`）—— **本单只 add `ops/project/**`**，故这些读数**未入本 commit**（保持改动面 = 项目域）。
