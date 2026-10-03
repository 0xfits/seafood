# S0 任务模型规范冻结报告（`R-9-97`..`R-9-103` 落册）

> **角色**：Jing（规范角色） · **单号**：**S0-TASKMODEL-FREEZE** · **日期**：2026-10-03
> **开工 HEAD**：`ef279d1`（`docs: §5.314/v0.314 —— Kevin 定档 task 无报名逻辑…`）
> **性质**：**只追加**（纯插入，0 删除行）；**只写应然冻结，不写任何实现现状读数**；**不自行调和矛盾**（新旧冲突逐条列出交裁）。
> **硬口径遵守**：**未** `commit` / `push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**起服务 / 占端口。

---

## 0. 覆盖面

按各册职责把 7 条冻结口径落进对应册（同一口径可跨册，各册以本册章节承载、姊妹册指路）：

| 冻结口径 | route-layer | data-layer | ledger | commission |
|---|:--:|:--:|:--:|:--:|
| `R-9-97` 任务模型 `headcount` | ● | ●（列契约） | | |
| `R-9-98` 托管 = `reward × headcount` | ● | | ●（金额/腿） | |
| `R-9-99` 提交即参与（取消报名与选定 · 移除 `self_application` · 多次提交 · `batt` 闸移到提交） | ● | ●（`job_submission`） | | |
| `R-9-100` 读口 identifier ⇒ `submission_id` | ● | ●（`job_application` 停写） | | |
| `R-9-101` 逐笔发放（发满 `headcount` = `settled`） | ● | | ●（账务） | ●（分佣） |
| `R-9-102` 随时结束退剩余 | ● | | ●（退款金额） | |
| `R-9-103` `apply`/`accept` 下架 `410` | ● | ●（映射） | | |

---

## 1. 逐册读数

### 1.1 `docs/route-layer.spec.md`
- **版本**：**v2.22 → v2.23**（顶部新增 1 个状态块，3 行，插在 v2.22 状态块之后；旧行一词未动）。
- **新增节号**：**§34**（插在本册末行 `---` 之前）。
- **`git diff --numstat`**：**`59  0  docs/route-layer.spec.md`**（新增 59 行 / **删除 0 行**）。
- **`SequenceMatcher(autojunk=False)`**：`{'equal': 7651, 'insert': 59}`（**0 replace / 0 delete**）。
- **快照**：`docs/versions/route-layer.spec.v2.23.md`，**`cmp` = 0**（逐字节相等）。旧快照 `v0.1`–`v2.22` 一字未动。
- **本册内与新口径冲突的旧条文清单**（正文 = §34.8，逐条列交裁）：
  1. **§4.2 J2**（`POST /api/job/:jobId/apply` = 申请报名，期望 `200`）↔ `R-9-103`（下架 `410`）。
  2. **§4.2 J3**（`POST /api/job/:jobId/accept` = 雇主选定，期望 `200`）↔ `R-9-103`。
  3. **§4.2 J2** 期望拒因含 `self_application_not_allowed` ↔ `R-9-99`（显式移除）。
  4. **§4.2 J5**（单次 `settle` · `worker_uid` 必须已选定）↔ `R-9-101`（逐笔）。
  5. **§1.8 #2 / #3**（apply / accept 已在册）↔ `R-9-103`（注册点计数受影响）。
  6. **§4.2 J4** 的 `identifier`（读口以 `application_id` 为轴）↔ `R-9-100`（`submission_id`）。
  7. **§2.4 S9 / §7-27**（前端旧 `400` 依赖回归项）↔ `R-9-103`（下架）。
  8. **§12**（管理员退款发起契约中与 `job` 流程相关读法）↔ `R-9-99/101`（若以「选定」为前提者须随之改）。

### 1.2 `docs/data-layer.spec.md`
- **版本**：**v0.28 → v0.29**（顶部新增 1 个状态块，1 行，插在 v0.28 状态块之后；旧行一词未动）。
- **新增节号**：**§36**（追加于文件末尾）。`DL` 编号域零改动（不新增 `DL` 条，以 `S0-TM-*` 承载）。
- **`git diff --numstat`**：**`35  0  docs/data-layer.spec.md`**（新增 35 行 / **删除 0 行**）。
- **`SequenceMatcher`**：`{'equal': 4564, 'insert': 35}`（0 replace / 0 delete）。
- **快照**：`docs/versions/data-layer.spec.v0.29.md`，**`cmp` = 0**。旧快照一字未动。
- **本册内与新口径冲突的旧条文清单**（正文 = §36.4）：
  1. **`DL54`**（`job_application` 列契约 + `UNIQUE(job_id,worker_uid)`「一人一单一条」）↔ `R-9-100`（停写）。
  2. **`DL55`**（`job_application` 状态白名单 + 部分唯一索引）↔ `R-9-99/100`（取消报名与选定）。
  3. **`DL56`**（`job_submission` 列契约；`review_*` 一次写定）↔ `R-9-99/101`（多次提交 / 逐笔）。
  4. **§3 旧面→新面映射**（`/api/task-progress*` = 报名 + 提交两条链）↔ `R-9-99/100`。
  5. **`DL58`**（招工幂等键 `biz:job:escrow/refund/settle`）↔ `R-9-98/101/102`（金额与逐笔 ⇒ 键语义）。
  6. **§10 / §20–§22 路由映射表**（含 `apply` / `accept`）↔ `R-9-103`（下架）。
  7. **`DL111` / `DL119`**（含「非报名人不得提交」类 `reason`）↔ `R-9-99`（移除 `self_application`）。
  8. **§27.2 `job.status` 闭合集** ↔ `R-9-101`（枚举**不动** ⇒ 无冲突，登记）。

### 1.3 `docs/ledger.spec.md`
- **版本**：**v0.15 → v0.16**（顶部新增 1 个状态块，1 行，插在 v0.15 状态块之后；旧行一词未动）。
- **新增节号**：**§19.19**（追加于文件末尾；本册惯例 = 新内容一律追加为 §19.NN）。
- **`git diff --numstat`**：**`22  0  docs/ledger.spec.md`**（新增 22 行 / **删除 0 行**）。
- **`SequenceMatcher`**：`{'equal': 2085, 'insert': 22}`（0 replace / 0 delete）。
- **快照**：`docs/versions/ledger.spec.v0.16.md`，**`cmp` = 0**。旧快照一字未动。
- **本册内与新口径冲突的旧条文清单**（正文 = §19.19.D）：
  1. **R44 / R68**（费率恒等式与取整，按「一次结算 = 一整笔 `reward`」表述）↔ `R-9-101`（逐笔）。
  2. **§7.2 #7**（招工流单 / 拒单退回「2 条分录」定额形态）↔ `R-9-98/102`（金额随 `headcount`）。
  3. **§5 kind 表**（`job_escrow` / `job_escrow_refund` 金额域）↔ `R-9-98/102`（登记，不改 kind 集）。
  4. **结算类事件幂等键**（`biz:job:settle:<job_id>` 单键、只由 `job_id` 派生）↔ `R-9-101`（同 `job` 多次发放 ⇒ **键唯一性冲突**）★。
  5. **§14.1 33 码闭集** ↔ `R-9-98`「余额不足」机读 `reason` 稳定常量（常量归属待裁）。

### 1.4 `docs/commission.spec.md`
- **版本**：**v0.5 → v0.6**（顶部新增 1 个状态块，1 行，插在 v0.5 状态块之后；旧行一词未动）。
- **新增节号**：**§20**（追加于文件末尾）。
- **`git diff --numstat`**：**`31  0  docs/commission.spec.md`**（新增 31 行 / **删除 0 行**）。
- **`SequenceMatcher`**：`{'equal': 1793, 'insert': 31}`（0 replace / 0 delete）。
- **快照**：`docs/versions/commission.spec.v0.6.md`，**`cmp` = 0**。旧快照一字未动。
- **本册内与新口径冲突的旧条文清单**（正文 = §20.4）：
  1. **§5 + CR32**（一个结算事件 = `job_payout`→`job_fee`→N×`commission` 的**同一幂等键、一次原子调用**）↔ `R-9-101`（同一 `job` 多份 ⇒ 多事件）。
  2. **事件根键**（`jobSettleKey` 只由 `job_id` 派生）↔ `R-9-101`（同 `job` 多次发放 ⇒ **键唯一性冲突**）★。
  3. **§8 边界情形 / `R-9-1`**（以 Worker 为中心 6 层）↔ `R-9-99`（打工人 = 提交者，分佣链锚点随每次提交）。
  4. **`C-2`（验收清单）/ 5 片依赖序** ↔ `R-9-101`（依赖序是否重排，登记）。

---

## 2. 跨册重点（§★ 提示交裁）

- **★ 幂等键唯一性（ledger §19.19.D#4 + commission §20.4#2）**：`R-9-101` 使**同一 `job` 产生多次结算事件**，而现行结算事件根键 `biz:job:settle:<job_id>` **只由 `job_id` 派生** ⇒ 第二份起会落「幂等重放」而非新发放。**键派生须含提交标识**（如 `<job_id>:<submission_id>`）—— 属**须裁**项，本单未自行改动键口径。
- **★ `R-9-98` 余额不足的机读 `reason` 稳定常量**：任务书未给出常量名，本单**未发明**，登记待裁（须落在既有 33 码闭集内、不得新增码）。
- `R-9-103` 下架 `410` 与 §1.8 / §7-27 / §2.4 S9 等**回归项 / 注册点计数**的连带影响，登记待裁（本单未改这些既有条文）。

---

## 3. 只追加自证

- **`git diff --numstat`**（4 册）：删除列**全部 = 0**（`59/0`、`35/0`、`22/0`、`31/0`）。
- **`difflib.SequenceMatcher(autojunk=False)`**（4 册）：**只有 `equal` / `insert`，0 `replace` / 0 `delete`**。
- **快照 `cmp`**（4 件）：**全部 = 0**（逐字节相等）；旧快照 `route-layer v0.1–v2.22` / `data-layer v0.1–v0.28` / `ledger v0.1–v0.15` / `commission v0.1–v0.5` **一字未动**。
- **追加前副本 + `cmp` 自证**：4 册改前正文与各自最新快照（`v2.22` / `v0.28` / `v0.15` / `v0.5`）逐字节相等（建副本前已 `cmp` 核实）。

## 4. 改前 / 改后规模

| 册 | 改前 md5 | 改后 md5 | 行数 | 字节 |
|---|---|---|---|---|
| route-layer | `ae65077a989e73c08521857b0d03cdbd` | `8f145d48d649668f01390210dc0c69db` | 7650 → 7709 | 1493938 → 1501171 |
| data-layer | `4f5fe4571d50af626e1bc4577bf00967` | `9f012185a7886484820b41fd6950477b` | 4563 → 4598 | 862628 → 867791 |
| ledger | `19a51009d9bd798453be19438f69cd7e` | `cafef7962a6a8748eeb7cf038326f933` | 2084 → 2106 | 485141 → 489279 |
| commission | `c8c56831d88d2dc72be9e789aa675627` | `9e8df4625b1d98c3590f63d19db22096` | 1792 → 1823 | 285473 → 289458 |

## 5. 改动文件面（仅以下，未越界）

| # | 文件 | 动作 |
|--:|---|---|
| 1 | `docs/route-layer.spec.md` | 改（+59 / −0） |
| 2 | `docs/data-layer.spec.md` | 改（+35 / −0） |
| 3 | `docs/ledger.spec.md` | 改（+22 / −0） |
| 4 | `docs/commission.spec.md` | 改（+31 / −0） |
| 5 | `docs/versions/route-layer.spec.v2.23.md` | 新建快照（`cmp` = 0） |
| 6 | `docs/versions/data-layer.spec.v0.29.md` | 新建快照（`cmp` = 0） |
| 7 | `docs/versions/ledger.spec.v0.16.md` | 新建快照（`cmp` = 0） |
| 8 | `docs/versions/commission.spec.v0.6.md` | 新建快照（`cmp` = 0） |
| 9 | `docs/audit/s0-task-model-freeze-report.md` | 本报告（新建） |

> **未碰**：`backend-ts/**` · `frontend/**` · 其它 `docs/` 文件（尤其 `docs/seafood.master-plan.md`）· `.env*`。

## 6. 未测项（诚实边界 · 禁填 0 / 空）

- 本单为 **S0 规范冻结**（应然），**零代码 / 零迁移 / 零 HTTP / 零套件**；**未连库、未启停服务、未占端口**。
- 冻结口径的落地面（列 / 迁移 / 路由 / 账本腿 / 前端 / 幂等键派生）**归后续实现单**；本单**不写任何实现读数** ⇒ **无可测实现项**（故本单**不填 0 / 空**，如实记「无实现面」）。
