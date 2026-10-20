# SPEC-NOTE · 项目（打工/工资体系：Project → Worker → Wage Claim ＋ 活动小时表 ＋ 建项目费）

- **单号**：`JING-SPEC-PROJECT`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件、零 HTTP 写、零库写、零测试改动、不 push**；迁移 `0063` 由实现单落盘 / apply 由 Zang，前后端实现由后续实现单承接。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = 5f6b838`（**工作区非干净 19 路径**：`M backend-ts/src/{database,index,listing-service,listing-funds-service}.ts` ＋ ops 五 gate ＋ `?? 0061_listing_allow_multi_buy.sql` ＋ `?? ops/multi-buy/**` 等，属**并行多件购买/item-id 面**，与本单无关）
- **正典**：`docs/data-layer.spec.md` **§40.15**（v0.45 · 四表＋两既有面 `PR-1…PR-9`）＋ `docs/route-layer.spec.md` **§49.19**（**v2.46** 新路由升版 · 注册点 111 → **125 两级预计**）＋ `docs/design/design-system.spec.md` **§26.20**（文案变更＋骨架 · 加性续登不升版）＋ `docs/seafood.master-plan.md` **§5.447 / 版本行 v0.364**

## 1. Kevin 依据（四点 clarify ＋ 业务规则五条）

> ① **活跃/离线判定 = 近 1 小时内有任意登录态请求 = 活跃（2 电量/时），否则离线（1/时）**。
> ② **电量只在被招工期间累积**（未招工不累积，被招后从入职时刻起算）。
> ③ **原 H5【招工】入口文案改为【任务】**。
> ④ **建项目费**：从创建者 $ 余额扣、走既有积分台账入平台收入，费额存 `app_config` 键 `project_create_fee`（默认 10000，管理员可改）。
> 规则五条：人人可建项目；项目工资 = 工资金额×领取间隔（batt 一笔**必有** ＋ 平台货币一笔**可选**，每次领取固定数额，间隔 1–100 小时）；**只有点【领工资】才实际到账**（类似每日签到）；一人同时只在一个项目打工、项目可改招工状态/人数/条件（注册 ≥ N 天）、**招满自动截止**；被招工才能领工资。

**出处披露（诚实）**：逐字转引自本单派单，**原始会话未入仓** ⇒ 不伪造引语。派单未定、由本单裁的口径见 §3。

## 2. 冻结口径（按面拆）

### 2.1 数据面（data §40.15 · `PR-1…PR-9`）

| 项 | 值 |
|---|---|
| 四新表 | `project`（15 列）/ `project_worker`（6）/ `project_wage_claim`（9）/ `user_activity_hour`（4）；DB 实测 `NOT_MEASURED` |
| 对外 Id | `project.snowflake_id bigint NOT NULL UNIQUE`，出参**一律字符串**（承 §40.12 ID-* 零改写） |
| 工资两笔 | `wage_batt_per_claim` 必有（> 0）；`wage_cid` ＋ `wage_currency_amount` **同空同非空具名 CHECK**；`wage_interval_hours` CHECK 1–100 |
| 状态机 | 闭集 `{recruiting→working（招满自动＝apply 事务内翻转／管理员停招）, working→recruiting（重开）, recruiting/working→ended}`；ended **终态封板**；同值写 = no-op 200；零定时器零触发器 |
| 在职唯一 | **部分唯一索引 `UNIQUE(uid) WHERE status='hired'`**（`project_worker_single_hired_uniq`）= DB 级「同时只在一个项目打工」；`left` 后可复职（新行，历史保留） |
| 招工准入 | `recruiting` ∧ 在职数 < `headcount` ∧ 注册天数（`users.time_reg`）≥ `recruit_min_account_days`；服务层前置只读闸 ＋ DB 部分唯一兜底 |
| 领取 | 资格 = `now − 上次领取（首次 = hired_at）≥ interval_hours`；**`hours_elapsed` CHECK ≤ 100（超出不补）**；claim 行记录 `batt_credited` / `currency_cid`/`amount` / `hours_elapsed` / `active_hours` / `offline_hours` |
| 活动桶 | `user_activity_hour` 复合主键 (uid, day, hour)，UTC 日/时；登录态请求单语句 upsert +1（**旁路写**，失败不阻断业务）；活跃 = 该小时桶有行（2/时）否则离线（1/时）；**桶边界近似已登记** |
| 台账衔接 | 货币腿 = `ledger_post_event` 单事件（D10），kind 从现取 **24 值闭集**（`ledger.ts:168`）择近或扩容 +1（推荐 `project_create_fee` / `project_wage`，扩容承 R-9-36 体例）；batt 腿 = `batt_entry`/`batt_account` **[0,100] 封顶丢弃**（R-9-17）；建费腿 = 创建者 $ 出账 ＋ 平台收入（`uid=−1` 体例）；**禁两步写** |
| 建费键 | `app_config` 键 **`project_create_fee`** = `{"fee":"10000"}`；seed 随 `0063` 入册（在册 ⇒ 可写）；写口 = 既有 `POST /api/admin/settings`（**零新路由**），AK1 键清单扩 +1 由实现单做 |
| 迁移 | **`0063_project_jobs.sql`（预计）**：四表 `IF NOT EXISTS` ＋ 具名 CHECK/UNIQUE ＋ 部分唯一索引 ＋ seed 一行 ＋ `DO $$` 自检、无 `BEGIN`-`COMMIT`；`schema_version` 0062 → 0063（0062 为 §40.14 占用未落盘 ⇒ 先落盘者得号，顺延回填） |
| 互不干涉 | job 四表（`0013`/`0014`/`0027`）＋ `/api/job*`、`/api/task*`、`/api/task-progress/*`、`/api/tasklist/*` **零触碰**；§40.14 campaign 五表**零复用零 FK**；迁移链无名为 `project`/`user_activity*` 的表（grep 现取 0） |

### 2.2 接口面（route §49.19 · **v2.46** · 七口逐字登记）

| # | verb | path | 面 |
|---|---|---|---|
| R1 | GET | `/api/project/all` | 公开（recruiting/working 列表；ended 不进列表） |
| R2 | GET | `/api/project/:ref` | 公开（纯数字谓词、单语句 OR 双形态、三态全公开） |
| R3 | POST | `/api/project` | 用户（八键闭集、禁带 status/snowflake/id/owner、同事务扣建费、`cli:` 幂等、余额不足 409） |
| R4 | POST | `/api/project/:id/apply` | 用户（五臂 409 闸链；满足即直接录用；重复 apply = 200 回放；招满自动置 working） |
| R5 | POST | `/api/project/:id/claim` | 用户（在职→非 ended→间隔三闸；`FOR UPDATE` 防双领；响应 = claim 行本体） |
| R6 | POST | `/api/project/:id/leave` | 用户（幂等 no-op；ended 项目也可 leave） |
| R7 | PATCH | `/api/project/:projectId` | 管理员 `requireAdmin(manage_tasks)`（可改闭集 9 键＋状态机＋ended 封板＋**缩容禁令** 409） |

- **注册点 111 → 125（两级预计：§49.18 campaign +7 亦未注册；本单 get +2 / post +4 / patch +1 / put 0 / delete 0）**；**回填前不冒充实测**。派单字面「111→约 122」与实算出入已登记（route §49.19.2）。
- **注册顺序判据**：R1 必须先于 R2 注册（倒置 ⇒ `all` 被 `:ref` 吞成 404，判负 #62）。页面路由 `/project`、`/project/create`、`/project/:ref`、`/project/mine` 不计注册点。
- **权限键 = `manage_tasks`**（`database.ts:21` 在册），**不是** `manage_rewards`（两键两域，混用 ⇒ #66）。
- 错误码 **33 码闭集不动**：401 既有会话解析 / 403 `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED` / 404 reason `project_not_found` / 400 借 `LEDGER_AMOUNT_INVALID`（`NOT_SUPPORTED` 等）/ 409 借 `LEDGER_INSUFFICIENT_BALANCE` ＋ 十个 `details.reason`（`project_not_recruiting` / `project_headcount_full` / `project_min_days_unmet` / `worker_already_hired` / `worker_not_hired` / `wage_interval_not_reached` / `project_ended_frozen` / `project_invalid_transition` / `project_headcount_below_hired` / `project_create_fee_insufficient`，不进闭集）。

### 2.3 设计面（design §26.20 · 文案变更＋骨架，零代码）

- **文案变更登记**：`jobs.line` 值改「任务」系 —— zh **「任务」**（Kevin 逐字）/ en·hk·vn 建议 Tasks·任務·Nhiệm vụ（待 Kevin 确认）；**只改值不改键**（键集 top **131** / flat **1140** 零漂移，现取复算四语相等）；消费点现取 = `PublishJobPage.jsx:192`（h2）＋ `TaskPage.jsx:230`（入口条）；旧 job 域其余「招工」文案（发布招工/招工仲裁等）**不动**；新项目域用新键族 `project.*`，禁复用 `jobs.*`。
- **骨架预留**：页面路由四条（不计注册点）；H5 列表单列卡流 / Web ≥2 列网格；详情 = 项目头＋打工面板（在职/未在职双态；**间隔未到 = 按钮可见禁点＋原因，禁隐藏禁静默**）；创建页八字段＋**建费读配置明示（禁写死 10000）**；三态徽标可区分；间隔/时间禁 ISO 直出；项目卡独立组件（禁复用商品卡类名）；shell 红线不动（零 region / 零 shell.css / 零 token）；i18n 零键落地（建议键族 `project.*`，计数 `NOT_MEASURED`）。

## 3. 本单裁定的口径（派单未定处，一句话可改）

1. **batt 到账公式 = `PENDING_KEVIN`，实现单禁自行择一**：候选 A = 固定数额（`batt_credited = wage_batt_per_claim` 恒定，小时三列纯记录）；候选 B = 按窗 pro-rata（`wage × hours_elapsed ÷ interval`，恰按间隔领 = 固定数额，迟领最多 ×100/interval）。张力 = 「每次固定数额」字面 vs ①「2/时 1/时」的函数位；**两案在准点领取时一致**；判负不锁公式分支。
2. **apply = 直接录用**（无申请池、无 `'pending'` 态）；要申请池 ⇒ 必须回改 data §40.15 扩闭集，不得静默加值。
3. **重开招工边在册**：`working→recruiting`（「可改招工状态」字面）；`ended` 终态封板（ended 后 claim 409 `project_ended_frozen`，一句话可改）。
4. **`headcount` 缩容禁令**：缩到 < 在职数 ⇒ 409 `project_headcount_below_hired`（不代项目方裁人）。
5. **leave 幂等**：未在职/已 left/项目 ended ⇒ 200 no-op；再入职重开新窗口（`hired_at` 重新起算，承「从入职时刻起算」字面）。
6. **`left` 后可复职**：同项目历史多行 ⇒ `(project_id, uid)` 不设 UNIQUE，在职判据走部分唯一索引。
7. **活跃判定 = 小时桶语义**：「近 1 小时」落地为「该 UTC 小时桶有行」；桶边界近似（10:59 请求令 10 点桶活跃）已登记；真滚动 60 分钟窗口 = 改判定谓词一句话，表结构不变。
8. **埋点 = 旁路写**：不进业务事务、失败吞错（最坏 = 该桶缺行按离线计）；埋点阻断业务 ⇒ 判负 PR-N5。
9. **配置零新路由**：`project_create_fee` 走既有 `POST /api/admin/settings` 键级寻址；AK1 键清单扩 +1 归实现单；fail-closed 兜底常量实现单定、回填登记。
10. **kind 扩容推荐**：新 kind `project_create_fee` / `project_wage`（扩容 +2 承 R-9-36 体例）；借 `currency_create_fee` = 语义窄化债须登记 —— 实现单定，回填。
11. **迁移号 = 0063 预计**：0062 已被 §40.14 契约占用（未落盘）⇒ 先落盘者得号，顺延方一次性回填编号字面。
12. **计数披露**：派单称「六表」，实为**四新表＋两既有面**（app_config 键面、ledger/batt 衔接面），按实数落册不虚增。

## 4. 判负清单（只登记引用）

- data §40.15.7：**PR-N1…N6**（部分唯一失守 / 招工闸旁路 / 领取闸旁路 / 两币 CHECK 失守 / 埋点阻断业务 / 台账腿断裂）。
- route §49.19.4：**#61–#67**（注册点不符 / 注册顺序倒置 / 闸链旁路 / 事务断裂 / 双领竞态得手 / 权限键混用 / 出参形态错）。
- design §26.20.3：**#77–#83**（入口文案回潮 / 文案外溢 / ISO 直出 / 领工资静默 / 建费写死 / 组件混用 / 破坏 shell 红线）。

## 5. 现取与未做（明账）

- **现取（2026-10-20 · HEAD `5f6b838`）**：regs **111**（get 50 / post 57 / put 0 / delete 3 / patch 1）· campaign 七口未注册（grep `api/campaign` = 0）· 迁移末位盘上 **`0061_listing_allow_multi_buy.sql`**（0062 契约占用未落盘）· `requireAdmin(` 24 处 · `manage_tasks` 在权限闭集（`database.ts:21`）· 设置写口 `index.ts:1915` · 会话解析面 `index.ts:256`/`:362` · `LEDGER_KINDS` **24 值**（`ledger.ts:168`）· `jobs.line` 四语现值 = 招工线 / Jobs / 招工線 / Tuyển việc · i18n top **131** / flat **1140**（四语相等）· 迁移链无名为 `project`/`user_activity*` 的表 · **DB 面 `NOT_MEASURED`**（本环境连不上 Neon）。
- **未做（`NOT_MEASURED` · 本册不预填）**：`0063` 未落盘 / 两库未 apply / 七路由未注册 / **125 为两级预计未回填** / batt 公式 A/B 未裁 / apply 直录未终裁 / 配置键未入册 / `jobs.line` 值未改 / 页面与 i18n 零代码 / 埋点保留期未定 / 判负三族一条未跑；**零代码 / 零迁移文件 / 零库写 / 零 HTTP 实测**。
- **本笔** = 只写 `docs/data-layer.spec.md`（§40.15）、`docs/route-layer.spec.md`（§49.19）、`docs/design/design-system.spec.md`（§26.20）、`docs/seafood.master-plan.md`（§5.447 ＋ 版本行 v0.364）、本文件五件；`git diff --numstat` **删除列 = 0**；`git reset -q` 后只 add 自己路径、**不 push**。
