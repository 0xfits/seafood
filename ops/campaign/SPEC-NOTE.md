# SPEC-NOTE · 活动任务体系（Campaign → Task → Subtask → Subtask Type → Subtask Proof）

- **单号**：`JING-SPEC-CAMPAIGN`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件、零 HTTP 写、零库写、零测试改动、不 push**；迁移 `0062` 由实现单落盘 / apply 由 Zang，前后端实现由后续实现单承接。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = 09943ba`（**工作区非干净 12 路径**：`M backend-ts/src/{database,index,listing-service,listing-funds-service}.ts` + `?? 0061_listing_allow_multi_buy.sql` + `?? ops/multi-buy/.probe*` 等，属**并行多件购买/item-id 面**，与本单无关）
- **正典**：`docs/data-layer.spec.md` **§40.14**（v0.44 · 五表 `CP-1…CP-10`）＋ `docs/route-layer.spec.md` **§49.18**（**v2.45** 新路由升版 · 注册点 111 → **118 预计**）＋ `docs/design/design-system.spec.md` **§26.19**（骨架预留 · 加性续登不升版）＋ `docs/seafood.master-plan.md` **§5.446 / 版本行 v0.363**

## 1. Kevin 依据（四点定案 ＋ 同日两次 OOB）

> ① **全新三张主表，现有 `task_progress`/`job` 悬赏体系原封不动**。
> ② **Subtask Type = 枚举表起步冻结 5 种，后续管理员可加**（OOB 留痕：先由 3 扩 6、再删 `poll`（投票）收敛 5；`poll` 不入 seed、管理员后续如需可自增）。
> ③ **Proof 只存不审（提交即通过）**。
> ④ **Campaign/Task 都有 start/end 时间窗 ＋ 状态机 draft→active→ended**。

**出处披露（诚实）**：四点转引自本单派单，**原始会话未入仓** ⇒ 不伪造逐字引语。派单未定、由本单裁的口径见 §3。

## 2. 冻结口径（按面拆）

### 2.1 数据面（data §40.14 · `CP-1…CP-10`）

| 项 | 值 |
|---|---|
| 五表 | `campaign`（9 列）/ `task`（11）/ `subtask`（11）/ `subtask_type`（4）/ `subtask_proof`（7）；DB 实测 `NOT_MEASURED` |
| 主键 / 对外 Id | 内务 `bigserial` PK；三主表各带 `snowflake_id bigint NOT NULL UNIQUE`，**对外出参一律字符串**（承 §40.12 ID-* 零改写） |
| 状态机 | 闭集 `{draft→active, active→ended}`，campaign/task 各自独立；回退/跳变/ended 封板 ⇒ 409；同值写 = 200 no-op；**零定时器零触发器** |
| 时间窗 | `time_start`/`time_end` 可空 ＋ 具名 CHECK（同时非空 end>start）；**零跨表窗口约束** |
| 级联 | `task→campaign` ON DELETE CASCADE（随活动删）；`subtask→task` / `proof→subtask` 级联（本单裁定） |
| `required` | `boolean NOT NULL DEFAULT false`（默认关，承 §40.13「不替活动方做决定」纪律；一句话可改） |
| Proof | `UNIQUE(subtask_id, uid)` = 一人一提交；**重提 = 覆盖 200**（单语句 `ON CONFLICT DO UPDATE`；与 DL54「同键回放旧值」方向相反，禁互抄；禁两步写）；`status` CHECK 只 `'submitted'`（单值 CHECK = 「审核态不存在」的库面声明） |
| payload 键闭集 | `screenshots` / `links` / `answers` / `snapshot_addr` 四族，未知键 ⇒ 400；类型↔键：`x_verify`⇒screenshots+links、`onchain_snapshot`⇒snapshot_addr、`survey`/`prediction`/`quiz`⇒answers |
| Seed（逐字） | sort 1–5：`x_verify` X 验证 / `onchain_snapshot` 链上快照 / `survey` 问卷 / `prediction` 预测 / `quiz` 答题；`INSERT … ON CONFLICT DO NOTHING`；**无 `poll`** |
| 迁移 | **`0062_campaign_hierarchy.sql`**：五表 `IF NOT EXISTS` ＋ seed ＋ 索引两枚（`task_campaign_idx` / `subtask_task_idx`）＋ `DO $$` 自检、无 `BEGIN`-`COMMIT`；`schema_version` 0061 → 0062 |
| 互不干涉 | job 四表（`0013`/`0014`/`0027`）＋ `/api/job*`、`/api/task*`、`/api/task-progress/*`、`/api/tasklist/*` **零触碰**；`task_progress`（DL26 封禁）在 0062 **零命中**；**DL26 定向收窄** = 新表 `task` 是新语义新表（迁移链从未建过该名表，grep 0） |

### 2.2 接口面（route §49.18 · **v2.45** · 七口逐字登记）

| # | verb | path | 面 |
|---|---|---|---|
| R1 | GET | `/api/campaign/all` | 公开（active 嵌套列表，无分页） |
| R2 | GET | `/api/campaign/:ref` | 公开（draft 公众 404 / `manage_tasks` 管理员 200） |
| R3 | POST | `/api/campaign/subtask/:subtaskId/proof` | 用户（登录；重提覆盖 200 非 409） |
| R4 | POST | `/api/campaign` | 管理员 `manage_tasks`（status 恒 draft、禁带 status/snowflake/id） |
| R5 | PATCH | `/api/campaign/:campaignId` | 管理员（可改闭集 5 键 ＋ 状态机 ＋ ended 封板） |
| R6 | POST | `/api/campaign/:campaignId/task` | 管理员（非 ended 才可加；可内联 `subtasks[]`） |
| R7 | PATCH | `/api/campaign/task/:taskId` | 管理员（可改闭集 ＋ `subtasks[]` 整组 upsert、永不 DELETE） |

- **注册点 111 → 118（预计 +7：get +2 / post +3 / patch +2 / put 0 / delete 0）**；**回填前不冒充实测**。
- **注册顺序判据**：R1 必须先于 R2 注册（倒置 ⇒ `all` 被 `:ref` 吞成 404，判负 #55）。
- subtask 增改 = 内联 task 写口；type 增 = 迁移受控追加 —— 均无独立路由；实现单若裁定开口 ⇒ **计数变体**每口 +1 并回填。
- **权限键 = `manage_tasks`**（`database.ts:21` 在册），**不是** §49.15 的 `manage_rewards`（两键两域，混用 ⇒ #59）。
- 错误码 **33 码闭集不动**：401 既有 auth / 403 `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED` / 404 reason `campaign_not_found` / 400 借 `LEDGER_AMOUNT_INVALID` / 409 借 `LEDGER_INSUFFICIENT_BALANCE`（reason 字符串不进闭集）。

### 2.3 设计面（design §26.19 · 骨架预留，零代码）

- 页面路由 `/campaign` ＋ `/campaign/:ref`（不计注册点）；H5 列表单列卡流 / Web ≥2 列网格；详情**两级结构写死**（活动头 → 任务卡 → 子任务清单，禁拍平）。
- required 视觉承载 · 时间窗禁 ISO 直出 · 类型徽标 = `campaign.type.<code>` **5** 键优先、seed label 兜底 · ended 终态可区分 · 活动卡独立组件（禁复用商品卡类名）· shell 红线不动（零新 region / 零 shell.css / 零 token）。
- i18n 零键落地（建议键族 `campaign.*`，计数 `NOT_MEASURED`）。

## 3. 本单裁定的口径（派单未定处，一句话可改）

1. **状态机只封两个正向迁移**：`draft→ended`（作废草稿）不在闭集内，需要 = 一句话加。
2. **ended = 终态封板**：ended 后 campaign/task 一切 PATCH ⇒ 409（要改 = 另建）。
3. **零自动收口**：时间窗过期**不**自动 ended（零 cron/触发器）；「到期自动收口」= 挂账另单，需 Kevin 口径。
4. **proof 重提 = last-write-wins**：与 `job_application` 的「同键回放旧值」方向相反，两处 UNIQUE 不得互抄实现。
5. **subtask 管理面无独立路由**：整组 upsert 内联于 task 写口（「不做删除」字面的自然推论）。
6. **`required` 默认 `false`**：不替活动方强制。
7. **DL26 定向收窄**：新表名 `task` ≠ 旧表复活（迁移链从未建过该名表）；判据 = `task_progress` 零命中 ＋ 旧列集/旧路由零引用；回避同名（`campaign_task`）= 一句话可改。
8. **0062 编号冲突登记**：§5.445 挂账把「0062」用作多件购买闸加固的占位语 ⇒ 两单均未落盘，**先落盘者得号**，顺延方一次性回填编号字面。

## 4. 判负清单（只登记引用）

- data §40.14.7：**CP-N1…N6**（审核态回潮 / 重提 409 / 回退放行 / 旧体系连坐 / snowflake 出 number / seed ≠ 5 行或含 `poll`）。
- route §49.18.4：**#54–#60**（注册点不符 / 注册顺序倒置 / 旧路由连坐 / proof 出审核语义 / 状态机旁路 / 权限键混用 / 出参形态错）。
- design §26.19.3：**#70–#76**（详情拍平 / required 无承载 / 时间窗失格 / 组件混用 / 类型直出 code / 终态不可辨 / 破坏 shell 红线）。

## 5. 现取与未做（明账）

- **现取（2026-10-20 · HEAD `09943ba`）**：regs **111**（get 50 / post 57 / put 0 / delete 3 / patch 1）· 迁移末位盘上 **`0061_listing_allow_multi_buy.sql`**（untracked 未提交）、`0062` 零命中 · `requireAdmin`（`index.ts:480`，34 处）· `manage_tasks` 在权限闭集（`database.ts:21`）· 迁移链无名为 `task` 的表 · **DB 面 `NOT_MEASURED`**（本环境连不上 Neon）。
- **未做（`NOT_MEASURED` · 本册不预填）**：`0062` 未落盘 / 两库未 apply / 七路由未注册 / **118 为预计值未回填** / 状态机与覆盖 upsert 未实现 / 页面与 i18n 零代码 / 判负三族一条未跑；**零代码 / 零迁移文件 / 零库写 / 零 HTTP 实测**。
- **本笔** = 只写 `docs/data-layer.spec.md`（§40.14）、`docs/route-layer.spec.md`（§49.18）、`docs/design/design-system.spec.md`（§26.19）、`docs/seafood.master-plan.md`（§5.446 ＋ 版本行 v0.363）、本文件五件；`git diff --numstat` **删除列 = 0**；`git reset -q` 后只 add 自己路径、**不 push**。
