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

---

## 9. 增量（2026-10-20 · `/wage` 两处 UI 缺陷的**数据面**根因）

**背景**：`/wage` 上「已加入的项目仍显示【加入】」「【领工资】应出现在已加入项目**自己的卡片内**」两条
反馈的根因不在卡片渲染，而在数据面 —— `GET /api/project/all` 的行里**没有登录取向**（原 15 键），
前端拿不到「我是否在职于这一行」。本单只补数据面（**零新路由、零前端改动**）。

### 9.1 契约增量（route §49.19 R1 加性）

| 键 | 匿名 | 登录态 · 未在职 | 登录态 · 在职（`project_worker.status='hired'`） |
|---|---|---|---|
| `my_role` | **缺省** | `'none'` | `'hired'` |
| `my_hired_at` | **缺省** | `null` | 库内 `hired_at`（ISO） |
| `next_claim_at` | **缺省** | `null` | `max(hired_at, 上次 claim) + wage_interval_hours`（ISO） |

- 「缺省」不是 `null` —— 前端按 `hasOwn` 区分「未登录」与「未在职」，否则两条分支在 JS 里同形。
- `next_claim_at` 与 `claimProjectWageVerb` ③ 段的结算窗口起点**同一算式**（`GREATEST(hired_at, max(claim.time_created))`），
  前端据此显示倒计时，不必自算、不会与服务端闸口径漂移。
- 行键数：匿名 **15**（原样不动）· 登录态 **18**（+3 加性）。**零新路由**（注册点仍 **127**）。
- 登录态响应头恒 `Cache-Control: private, no-store` + `Vary: Authorization`（带个人面的载荷不得进共享缓存）；
  匿名分支**不设缓存头** = 既有行为零变化。
- 身份解析失败 / 坏 token / 基础设施异常 ⇒ **fail-open 按公众处理**（列表照常 200，不落 401 —— 公开读口不得因鉴权抖动变不可读）。

### 9.2 实现落点

- `backend-ts/src/project-service.ts`：新增 `ProjectListRow`（`ProjectView` + 三可选键）、
  `PROJECT_LIST_VIEWER_SQL`（`LEFT JOIN project_worker` 取在职行 + 子查询取 `max(claim.time_created)`；
  部分唯一索引 `project_worker_single_hired_uniq` ⇒ 每 uid 至多一条 hired 行 ⇒ JOIN 不放大行数）、
  `listProjects(ex?, { viewerUid })`（缺省 ⇒ 原 SQL 原 15 键）。
- `backend-ts/src/index.ts`：`resolveOptionalProjectViewer`（体例同 `resolveOptionalCampaignViewer`）+ R1 接线 + 私有缓存头。

### 9.3 门（`ops/project/p63-00-project-gate.ts` · 35 → **38** 臂）

| 臂 | 断言 | 读数 |
|---|---|---|
| **B4** | 匿名行三键**缺省**（非 null）· 行仍 15 键 · 全表一致 | `keys=15 absent=true` |
| **S15** | 登录态 · 未在职者：三键**在场**且 `my_role='none'`、两键 `null` · 行 18 键 | `rows=15 sample={my_role:'none', my_hired_at:null, keys:18}` |
| **S16** | 登录态 · 在职者：「领工资」只落在**自己的**卡（恰 1 行 `hired`）· `my_hired_at` 与库内 `hired_at` 一致 · `next_claim_at` 与库内 `GREATEST(...)+interval` 复算一致且为未来时刻 | `hired_rows=1 claims_w1=1 my_hired_at=…08:42:25.629Z db_hired_at=…08:42:25.629345+00 next_claim_at=…12:42:25.629Z db_next_claim=…12:42:25.629+00` |

B4 与 S15/S16 构成**成对判据**（同一批数据：匿名 ⇒ 缺省，登录 ⇒ 在场），任一侧失效另一侧必红；
S16 的期望值由**独立 SQL 复算**（不是拿服务层自身出参自证）。

### 9.4 门改 mode-aware（环境性红点，非本单回归）

开工时 dev 库已被 apply 到 **0065**（`schema_migration`：0063 `11:14:42Z` / 0064 `11:14:43Z` / 0065 `11:14:44Z`），
而 `B1` / `Z1` 原断言「本门全程未 apply（版本行 0 / 提交面无四表）」⇒ 首跑 `36/38`（红 `B1`、`Z1`），
两臂与本次改动**无交集**（只读 `information_schema` / `schema_migration` / `app_config`）。
按既有纪律改为 **mode-aware**：

- `pre-apply`（0063 未进库）⇒ 原断言逐字保留（版本行 0 / 提交面零残留）；
- `post-apply`（0063 已进库）⇒ 断言**已 apply 稳态**：干跑不新增版本行（`before=1 / after=2`）、
  提交面四表在场 + `project_create_fee` 1 行（= 迁移真实终态，不是本门残留）。

`out.mode` 与 `readings.mode` 都落盘。**判据未放宽**：两态各自断言各自的终态，未合并成「任一为真即过」。
首跑红读数 `readings/p63-project-gate-20261020T114108Zzpb3.json` 保留在库（归因：环境已 apply）。

### 9.5 读数

- `ops/project/readings/p63-project-gate-20261020T114224Zi3id.json` —— **38/38 全绿**（`mode=post-apply`）
- `ops/project/qa/logs/p63-run2.log`（终轮）· `p63-run.log`（首跑 36/38 红 B1/Z1）· `p7b-03.log`（**37/37**，注册点 **127** = get 54 / post 66 / put 0 / delete 3 / patch 4）
- HTTP 三臂（临时实例 5811，已关停；零写库）：匿名 `200 / 10 行 / 15 键 / 三键缺省 / 无缓存头` ·
  登录态（uid 10）`200 / 18 键 / my_role='none' / Cache-Control: private, no-store + Vary: Authorization` ·
  坏 token `200 / 15 键 / 缺省`（fail-open，不 401）
- `tsc --noEmit -p tsconfig.json` ⇒ **exit 0**

### 9.6 未做 / 交接

- **前端未改**（本单按派单只做数据面）：`frontend/src/pages/wage/WagePage.jsx` 需改为按
  `row.my_role === 'hired'` 在**该卡片内**渲染【领工资】、否则渲染【加入】，并按 `next_claim_at` 走既有 `m:ss` 倒计时；
  匿名（三键缺省）沿用「按钮置灰 + 登录提示」。
- **未 push**（push = 上线）；**未改** `docs/**`、既有迁移、`frontend/**`。
