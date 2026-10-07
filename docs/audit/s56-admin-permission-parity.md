# S56 · 权限面重建盘点 + 修法提案（Kong · 严格只读）

> **单号**：S56（角色：Kong）· **runid**：`s56-20261007T124650Z`
> **产物目录**：`backend-ts/.s56-artifacts/s56-20261007T124650Z/`（`**/.*-artifacts/` 已在 `.gitignore`）
> **硬口径**：**两库严格只读（本单零写：无 `INSERT/UPDATE/DELETE/DDL/setval/nextval`）** · 零 env 变更 · 零部署 · **零仓改动（不 commit、不 push）** · 未起实例 · 未碰 `5787/5788/5555/5191` · 未 `npm install` · 未用 `.log`。
> **姿态前提（S55a 已定格）**：新库（`.env.newdb.local` ⇒ `ep-red-moon-b3xvoyjk`）**自 2026-10-07 13:10:49 起 = 生产库**。⇒ 本单对**两个库一律只读**，**未写任何行**。
> **脱敏**：全文**不含任何密钥值、不含完整 evm 地址**（一律 `sha8` 或前 6 后 4）· 不含连接串。

---

## §0 对锚（开工时现取）

| 项 | 读数 |
|---|---|
| `git log --oneline -3` | `a40793e`（S55a 法证 + §5.394 订正）/ `933d2d7` / `aa5aa5d` — **HEAD 含 `a40793e`，对锚成立** |
| `git status --porcelain` | **空**（开工时；本单结束时复查见 §8） |
| 分支 | `main` |
| 现时 | 2026-10-07 20:46–21:0x CST（runid `20261007T124650Z` UTC）|
| 两库 host 指纹 | 旧库 `ep-holy-forest-b3fi7u3u-pooler`（`.env.local`，`url_sha8=b2462064`）· 新库 `ep-red-moon-b3xvoyjk-pooler`（`.env.newdb.local`，`url_sha8=85312051`）|

> 探针脚本：`s56probe.mjs`（四表全量 + users 全量 + 映射）、`s56fix-probe.mjs`（可行性：uid 占用/唯一约束/identity/迁移态）、`s56-diff`（对拍）。**均只发 `SELECT/SHOW`**。
> ★ **本单补了 S55a 自曝⑥ 的建议**：连库后显式 `SET TRANSACTION READ ONLY`（`tx_readonly_set=true` 两库）；但 `SHOW transaction_read_only` 仍回报 `off`（Neon HTTP 驱动逐条隐式事务，**会话级护栏不落地**）⇒ **零写仍来自「只发读语句」这一构造**，如实登记（§8）。

---

## §1 `admin_*` 四表 + `users.is_admin` 逐表对拍（★三件不可丢之①）

### §1.1 逐表计数 + 内容判定

| 表 | 旧库行数 | 新库行数 | 逐字相同? | 仅旧库（差异行） | 仅新库 |
|---|--:|--:|---|---|---|
| `admin_role` | **5** | **1** | ❌ | **4**（`p7b_fixture_admin` · `p7b_fixture_nopts` · `qa7b_admin` · `qa7b_nopts`） | 0 |
| `admin_permission` | **12** | **12** | ✅ **逐字相同** | 0 | 0 |
| `admin_role_permission` | **16** | **12** | ❌ | **4**（`p7b_fixture_admin×manage_points` · `p7b_fixture_nopts×read_users` · `qa7b_admin×manage_points` · `qa7b_nopts×read_users`） | 0 |
| `admin_user_role` | **7** | **0** | ❌ | **全 7 行**（见 §2） | 0 |
| `users.is_admin=true` | **{1,10,970201}** | **{1,10}** | ❌ | **`970201`** | 0 |

> 读数取自 `admin-parity-probe.json`；差异由 `admin-table-diff.json` 程序化产出（非目测）。

### §1.2 差异的性质（★关键：去夹具后只剩 1 处真回归）

| 差异 | 类别 | 判定 |
|---|---|---|
| `admin_role` 少 4 行 | **夹具**（`name` 直写「P7B/QA7B fixture …」）· `time_created` 全在 `2026-10-02T08:07:25` / `11:05:12`（p7b/qa7b 夹具批次） | **丢失无害** |
| `admin_role_permission` 少 4 行 | 同上（全挂在上列 4 个夹具角色上） | **丢失无害** |
| `admin_user_role` 少 6 行（`900004/900005/900006/910004/910005/910006`） | **夹具**（S43 §2：bio = `p7b fixture uid=…` / `qa7b fixture uid=…`） | **丢失无害** |
| `users.is_admin` 少 `970201` | `970201` bio = `p4b2c:fixture uid=970201`（S43 §2 第 138 行逐字）⇒ **夹具** | **丢失无害** |
| **`admin_user_role` 少 `970213/super_admin`** | **非夹具**（见 §3）——`evm` = 平台**原硬编码管理员地址** `0x59f9…09b0` | ★ **唯一真回归** |

**⇒ 本单结论一句话**：新库权限面**唯一实质损失 = 1 个管理员绑定**（种子 `super_admin` 的持有人 `uid 970213`）；`admin_role` 少 4 / `admin_role_permission` 少 4 / `admin_user_role` 少 6 / `is_admin` 少 1 **全部是夹具**（S52b 按「零夹具」口径不搬 ⇒ 正是设计意图）。

### §1.3 内容逐字对拍（非夹具部分）

| 表 | 非夹具行 | 旧库 | 新库 | 判 |
|---|---|---|---|---|
| `admin_role` | `super_admin` = `超级管理员` | 在场 | 在场 | ✅ **同**（`time_created` 异：旧 `2026-10-02T00:41:05.838Z`（`0022` apply 时点）· 新 `2026-10-07T06:43:53.459Z`（新库 `0022` apply 时点）⇒ `now()` 派生，**非内容差**）|
| `admin_permission` | 12 键（含 `manage_audit`） | 12 | 12 | ✅ **逐键逐字相同** |
| `admin_role_permission` | `super_admin × 12` | 12 | 12 | ✅ **逐对相同** |
| `admin_user_role` | — | 1（970213） | **0** | ❌ **全 0** |

⇒ **角色定义面（`admin_role`/`admin_permission`/`admin_role_permission` 的非夹具部分）在新库完整无损**（`0022`+`0039` 迁移两边都 apply，`schema_migration` 两库都到 `0044`）。**坏的只有「人→角色」绑定这一环**。

---

## §2 旧库 7 行 `admin_user_role` 逐行的「人」（★三件不可丢之②）

映射法：`admin_user_role.uid` → 旧库 `users` 取 `evm` → 算 `sha8(lower(evm))` → 在新库 `users` 同 `sha8` 反查 `uid`。
（**不打印完整地址**：只给 `sha8` + 前 6 后 4。前端读取以 `lower` 规范化，`users_evm_uniq` 对原样 `evm` 唯一、`idx_users_evm_lower` 供忽略大小写检索。）

| # | 旧 `uid` | `role_key` | `evm` sha8 | `evm` 前6…后4 | 旧 `is_admin` | **新库同人 uid** | 新库状态 |
|--:|--:|---|---|---|---:|:--:|---|
| 1 | `900004` | `p7b_fixture_admin` | `d2029fcc` | `0x3277…491f` | false | — | **查无此人** |
| 2 | `900005` | `p7b_fixture_admin` | `744d79be` | `0x0dd6…aecc` | false | — | **查无此人** |
| 3 | `900006` | `p7b_fixture_nopts` | `afc4b4f3` | `0x7d85…8797` | false | — | **查无此人** |
| 4 | `910004` | `qa7b_admin` | `7b661d34` | `0xd6f4…f375` | false | — | **查无此人** |
| 5 | `910005` | `qa7b_admin` | `42fff767` | `0x1556…54dd` | false | — | **查无此人** |
| 6 | `910006` | `qa7b_nopts` | `79339a90` | `0x6abc…fa39` | false | — | **查无此人** |
| 7 | **`970213`** | **`super_admin`** | **`c9f277f5`** | **`0x59f9…09b0`** | false | — | **查无此人** |

**逐行定性**：

- 第 1–6 行：`uid ∈ {900004,900005,900006,910004,910005,910006}` **全属 9e8 夹具号段**；S43 §2 逐行 bio = `p7b fixture uid=…` / `qa7b fixture uid=…`（夹具批次 2026-10-02T08:07 / 11:05）。**6/6 = 纯夹具**，S52b 不搬属**正确**。
- 第 7 行：`970213` **不是夹具**（见 §3）——它是**种子 `super_admin` 的唯一持有人**，`evm` = 平台**原硬编码 `DEFAULT_ADMIN_ADDRESS`**。
- **7/7 在新库 `查无此人`** ⇒ 7 行绑定在新库**全部消失**（其中 6 行无害、1 行是有害的真回归）。

---

## §3 种子 `super_admin`（旧库 `uid 970213`）**是谁** + 三处置选项（★三件不可丢之③）

### §3.1 `uid 970213` 的库内实录（只读现取）

| 字段 | 读数 | 出处 |
|---|---|---|
| `uid` | `970213` | `admin-parity-probe.json` |
| `evm` | `sha8=c9f277f5` · `0x59f9…09b0` | 同上 |
| `is_admin` | **`false`**（⇒ 收敛后**完全依赖角色行**才拿到 admin；`0022` §④ 的种子本意即此） | 同上 |
| `bio`（名册字段） | **`hellohello`**（**非** `fixture` 字样） | 同上 |
| `time_reg` | **`2026-10-01T00:34:03.736Z`** | 同上 |
| `time_login_last` | **`2026-10-05T23:18:58.428Z`**（切库前 2 天仍活跃） | 同上 |
| `account`（cid=1） | **`balance=4292` · `frozen=5800`**（**真资金摆过**：冻结 5800 = 6 笔 job 托管） | `seed-admin-footprint.json` |
| `ledger_entry` | **17 行**：`job_escrow×6` · `job_payout×7` · `job_fee×3` · `mint×1`；`ref_type` = `job×16` + `currency×1` | 同上 |
| 入向 FK 引用 | **26 处**（`reviewed_by=12` · `worker_uid` · `employer_uid=3` · `target_uid` …） | S43 §2 第 150 行 |

### §3.2 它是**谁** —— 判定：**真实运营者（Kevin 本人），不是测试夹具**

**证据链（三条独立）：**

1. **地址身份**：`0x59f9…09b0` = 平台**原硬编码第三真源** `DEFAULT_ADMIN_ADDRESS`（`migrations/0022_admin_permission_seed.sql:21-26` 逐字；`auth.ts:35-40` 记其「已下沉为迁移种子」）。⇒ 该地址**被平台设计为管理员地址**。
2. **产品负责人本人**（master-plan 逐字）：
   - §5.280：「**Kevin（产品负责人，验收中）** 报『用**尾号 `09b0`** 的钱包登录…无法参与任务』」+ 同节表格「用户 **`uid 970213`** · `evm 0x59f9…b209b0`（**尾号 `09b0` ✓**）· `is_admin false`」。
   - §5.306：`account 970213 / cid 1 = 9889` ⇒「**他已成功发布任务 `#136`**」。
   - master-plan 现取登记：「**我 2026-10-03 给 Kevin 发放 10000 积分那次真实运营动作**」（`txid 1439`，`idempotency_key='ops:1:points_adjust:970213:1:kevin-grant-10000-a'`）。
   - 「| **★ Kevin** | … **`uid 970213` · `batt = 30`**」（`0040` 存量补发）。
   - S13：`submission 237` `reviewed_by=970213`（**他做过审核动作**）。
3. **真业务行为**（本单现取）：`ledger_entry` 17 行含**真托管/放款/手续费**（`job_escrow×6`/`job_payout×7`/`job_fee×3`）· `account` 冻结 `5800` · `time_login_last` 切库前仍活跃 ⇒ **绝非线性测试夹具的形态**。

**⇒ 为何 S52b 把它剔掉（机制）**：`uid 970213 ≥ 900000`，S52b 的「零夹具」口径 = **`uid < 900000` 才算真号段**（S52b §「真号段身份 `users WHERE uid < 900000` ⇒ 26」）。**Kevin 的真实账号恰好落在 9e8 号段**（S43 §2 逐行可见：`970203–970212` 是纯夹具，而 `970213` 是**同号段里唯一的真账号**，bio=`hellohello`、非空、26 处引用）⇒ **被「一刀切」号段规则误扫**。这不是 Kevin 是夹具，而是**号段判据把真账号夹带进去了**。

> ★ **重要边界（诚实登记）**：`970213` **是不是** `970201`（另一 is_admin 夹具）同一批脚本建的、以及它**为何**拿到 9e8 号（而非低号段序列号）——**代码考古未做**（同 S43/S48 明列 `NOT_MEASURED`）。**但「是谁」不依赖这一点**：地址 + master-plan + 真业务三证一致指向 **Kevin**。

### §3.3 三处置选项：影响面 / 风险 / 判定依据

> 三选项**均未执行**（§0 硬口径）。**(A) 是唯一需要写库的**；**(B)/(C) 为「不改库」的两种声明**。

#### **(A) 在新库以真 uid 重建该 evm 的用户行 + 绑定 `super_admin`**

| 维度 | 内容 |
|---|---|
| **做什么** | ① 在新库 `users` 以**未占真 uid**（建议 `uid ≥ 100`，见 §7 现取 `max_uid=41`、`uid=100` 空闲）重建 `evm=0x59f9…09b0` 的用户行（`is_admin=false`）；② `INSERT INTO admin_user_role (uid, 'super_admin')`（= `0022` §④ 的**同义重建**）。 |
| **影响面** | 恢复**1 个可用管理员**（Kevin 登录 ⇒ `findOrCreateUserByEvm` 命中该行 ⇒ `resolveAdminAccess` 见角色行 ⇒ `can_access_admin=true` + `super_admin` 12 键全量）。**不新增角色/权限行**（`super_admin×12` 已在库）；**不碰 uid 1/10**。 |
| **风险** | ① **数据不还原**：Kevin 的 `account 4292/5800` 与 17 笔流水、job #136 **不在新库**（新库 `job=0`/`listing=0` 是 S52b 明令不搬）⇒ **只恢复 admin 身份，不恢复业务资产**；② **uid 选择**：若选号与他人冲突/未来序列撞号 ⇒ 需选 `≥ 100` 且校验未占；③ **`is_admin` 口径**：以 `is_admin=false`+角色行（忠于 `0022`）还是 `is_admin=true`（更鲁棒）需定档；④ 一旦重建，**再登录会写 `time_login_last`/`account`**（登录即写路径，S55a R2）——属预期。 |
| **判定依据** | `0022` §④ **本意就是**「把该地址在库内的持有人绑到 `super_admin`」；原真库里该绑定**确实存在**（旧库 `970213/super_admin`）。⇒ (A) = **按设计原样恢复**，语义最正。**反证代价**：不恢复则 Kevin 从此**无法用自己钱包进后台**（§5）。 |

#### **(B) 改用新库现有真用户（`is_admin` 的 `uid 1/10`）当管理员**

| 维度 | 内容 |
|---|---|
| **做什么** | **零写库**。声明「管理员 = 现有 `is_admin=true` 的 `uid 1`/`uid 10`」，不作任何数据变更。 |
| **影响面** | 后台**本已可进**（§5：uid 1/10 持 12 键全量）⇒ 决策成本最低、零风险。**Kevin 仍无后台**（除非他是 1/10 之一）。 |
| **风险** | ① **身份不可核**：`uid 1/10` 的 `evm` 是**非构造随机地址**（S43 §3.2），**谁持有该钱包 = `NOT_MEASURED`**（本单无法从库内证明其归属）⇒ **等于把管理员交给一个未知钱包**；② 与其注册时间极早（`2026-09-29T18:2x`，项目首日）、bio 空、**零业务行为**（`account/ledger` 均 0）——形态更像**早期开发/自建号**而非运营者；③ 若 `1/10` 实为团队自持 ⇒ 可接受；若否 ⇒ 高危。 |
| **判定依据** | **必须先核 `uid 1/10` 的钱包归属**（问 Kevin / 让 1 或 10 登录）**再定**。此为 (B) 的**前置硬条件**。 |

#### **(C) 声明不需要外置管理员（改用本机/运维路径）**

| 维度 | 内容 |
|---|---|
| **做什么** | **零写库**。声明**不重建 admin 绑定**；后台 HTTP 管理面**不使用/无人使用**（或仅 uid 1/10 保留既有可进状态）；运维动作走**本机/CLI/直接 DB**（如 Kong/Zang 侧脚本）。 |
| **影响面** | `admin_role`(1)/`admin_permission`(12)/`admin_role_permission`(12) **保持在场但「持有人为空」**（`admin_user_role=0`）；`super_admin` 成为**悬空定义**；后台「角色/权限管理」UI 退化为**只读 1 角色 + 0 用户**。 |
| **风险** | ① **可用性落差**：`/api/admin/*`（settings/permissions/user/update/points/commission_policy/audit）**对外的运营动作全失效**——除非改用 uid 1/10（那就退回 (B)）；② **产品面向**：当前**业务面为空**（`job=0`/`listing=0`/`prize` 空）⇒ 短期「无管理需求」成立；**但一旦要发积分/管佣金/上币/审审计台**，无 HTTP admin = 只能走库。 |
| **判定依据** | 若 Kevin 定档「**现阶段不用 Web 后台**」⇒ (C) 自洽；否则 (C) 会**卡住**后续任何 `manage_*` 运营。**（B）与（C）在「后台没人用」上等价，差别在是否点明 uid 1/10 就是管理员。** |

**⇒ 三选项对照（一句话）**：
- 要 **Kevin 本人**当管理员 ⇒ **(A)**（需写库 2 条 DML）。
- 要 **最低成本、可接受 uid 1/10** ⇒ **(B)**（零写，但**须先核身份**）。
- 要 **彻底不用 Web 后台** ⇒ **(C)**（零写，但**放弃 HTTP 运营面**）。

---

## §4 `is_admin` 的 `uid 1/10` 在新库**是谁**

| uid | `evm` sha8 | `evm` 前6…后4 | `bio` | `time_reg` | `time_login_last` | `is_admin` | 业务足迹 |
|--:|---|---|---|---|---|---|---|
| **1** | `4ec3880f` | `0x99a7…8f74` | `""` | `2026-09-29T18:20:42.664Z` | **= `time_reg`**（建行后未再登录） | **true** | `account=0` · `ledger=0` |
| **10** | `c74b853b` | `0xd1e5…055e` | `""` | `2026-09-29T18:35:02.922Z` | **= `time_reg`** | **true** | `account=0` · `ledger=0` |

- **同人确认**：`uid 1/10` 的 `evm` sha8 在**两库逐个相等**（S55a `uid_evm_common=26, mismatch=0`）⇒ 新库的 1/10 = 旧库的 1/10**同人**。
- **号段**：`1/10 ∈ 1–12/17–22/34–41` = S43 §3.2 明定的 **「真号段，非候选（禁删）」**；`is_admin` 者在低号段**仅** `uid=1`、`uid=10`（S43 §3.2 逐字）。
- **角色**：`uid 1` 是**全仓门/验收脚本的基准管理员**（`master-plan:6902`「admin = `is_admin=true` 的 uid 1」· `p8-s5-01-real-chains.ts:57` `ADMIN_UID=1`）· `p6-b6-audit-live.md:28`「**真 admin = uid 1**（库内 `is_admin=true`，`0x99a7…`）」。
- **是否「真用户」**：**是「真号段」行**（`evm` 为非构造随机地址、被 S43/S48 判为真号段禁删），**但**：`bio` 空、**零业务行为**、`time_login_last = time_reg`（建行后从未再登录）⇒ **形态更像早期开发/自建号**，而非活跃运营者。
- **归属**：**该两钱包由谁持有 = `NOT_MEASURED`**（本单只读，无法从库内证明；未用真账号/真钱包）。⇒ 这是 (B) 的**决定性未知量**。

---

## §5 后台可用性影响（**逐条给代码依据**）

### §5.1 准入链（读码）

| 环节 | 位置 | 逻辑 |
|---|---|---|
| `resolveActor` | `src/index.ts:245-285` | ①无 `Bearer` ⇒ `unauthorized`（**未触库**）②`verifySessionToken`（HMAC 纯计算）③`getUserById(sub) ‖ getUserByEvm(evm)` **查无此人 ⇒ `unauthorized`**（②③两步均 401）④命中 ⇒ `resolveAdminAccess(user)` |
| `resolveAdminAccess` | `src/database.ts:4308-4319` | `bypass = user.is_admin`；**若 `is_admin`** ⇒ 不再查表（`hasRoleRow=false, permissions=[]`）；**否则** ⇒ `hasAdminRoleRow(uid)` + `getPermissionsForUser(uid)`（= `admin_user_role ⋈ admin_role_permission`，`database.ts:4228-4251`） |
| `buildAdminAccess` | `src/database.ts:6612-6644` | `isAdmin = user.is_admin`；**`permissions = isAdmin ? ALL_ADMIN_PERMISSIONS(12 键) : 角角色位`**；`can_access_admin = isAdmin ∨ hasRoleRow ∨ permissions.length>0` |
| `requireAdmin` | `src/index.ts:337-356` | `!can_access_admin` ⇒ **403 `NOT_ADMIN`**；`!is_admin ∧ !hasRequiredPermission` ⇒ **403 `PERMISSION_NOT_GRANTED`**；**`is_admin=true` 走 `:349` 短路 ⇒ 直接放行（不再看权限位）** |

### §5.2 新库现状下：**还能不能进 / 谁能进 / 少了哪些能力**

| 问 | 答（代码依据） |
|---|---|
| **后台还能不能进？** | **能。** 新库 `users.is_admin=true` 有 **uid 1、10**；`resolveAdminAccess`（`database.ts:4313-4318`）对它们 `bypass=true` ⇒ `buildAdminAccess`（`:6619-6623`）给 `permissions = ALL_ADMIN_PERMISSIONS`（**12 键全量**）· `can_access_admin=true` ⇒ `/api/admin/me` 可读、所有 `requireAdmin` 口放行。 |
| **谁能进？** | **恰且仅 uid 1、uid 10。** 新库 `admin_user_role=0` ⇒ 对**任何其它 uid**：`hasAdminRoleRow=false` + `getPermissionsForUser=[]` ⇒ `can_access_admin=false` ⇒ `requireAdmin` → **403 `NOT_ADMIN`**（`index.ts:343-347`）。 |
| **Kevin（970213）能进吗？** | **不能（401）。** 新库无 uid 970213 ⇒ `resolveActor` ②`getUserById(970213)=null` → ③`getUserByEvm(evm)=null` ⇒ **`unauthorized` 401**（`index.ts:268-274`）。**连「403」都到不了**——他**不是「无权限的管理员」，而是「查无此人的登录」**。 |
| **少了哪些能力？** | 对 **uid 1/10 而言：一项不少**（`is_admin` 短路给 12 键全量）。**真正的「少」有三条**：① **Kevin 的整条后台**（401）——他被剔出库；② **`super_admin` 角色成悬空定义**（`admin_user_role=0`）⇒ `/api/admin/permissions`（`index.ts:1803`）返回的角色视图退化为「1 角色 / 0 用户」，**无法用它把谁授成管理员**（除非先补 `admin_user_role` 行）；③ **`manage_audit` 等 12 键都在**（`admin_permission=12`、`super_admin×12`）⇒ **无键缺失**，缺的是**持有人**。 |
| **权限位会「无键退化」吗？** | **不会**。`hasRequiredPermission(actor, undefined) === true`（`index.ts:328-331`）⇒ 对无 `requiredPermission` 的 `requireAdmin`（如 `/api/user/all`、`/api/user/stats`、`/api/admin/points/adjust`）**只要 `can_access_admin` 即放行** ⇒ 这些口对 uid 1/10 全开。 |

> **一句话**：**新库后台「功能完整、可用」，但「管理员只剩 uid 1/10」**；`super_admin` 沦为**无人持有的定义**，Kevin 本人**被挡在 401**。

---

## §6 修法提案（**只写不进** · 含 SQL + 判负 + 回滚）

> ⚠️ **本单未执行下列任何语句**（硬口径①）。下列 SQL 是**给 Zang/Kevin 定档后**才由授权者执行的建议稿。
> **脱敏**：以 `:seed_evm` 占位（值 = 原 `DEFAULT_ADMIN_ADDRESS`，完整值见 `migrations/0022_admin_permission_seed.sql` §④；**不在本报告打印**）。

### §6.1 选项 A —— 重建该 evm 用户行 + 绑 `super_admin`（**唯一需写库者**）

**A0 前置只读核对（应得：新库 0 行）**
```sql
-- 目标 evm 在新库必须不存在（否则下面的 INSERT 会撞 users_evm_uniq DO NOTHING）
SELECT uid, is_admin FROM public.users WHERE lower(evm) = lower(:'seed_evm');   -- 期望 0 行
-- 选号：确认真 uid 空闲（现取 max_uid=41 ⇒ 100 空闲）
SELECT count(*) FROM public.users WHERE uid = 100;                                   -- 期望 0
```

**A1 重建用户行（建议真 uid，`is_admin=false` ⇒ 完全依赖角色行，忠于 `0022` §④ 语义）**
```sql
BEGIN;
INSERT INTO public.users (uid, evm, bio, is_admin)
VALUES (100, lower(:'seed_evm'), '', false)
ON CONFLICT (evm) DO NOTHING;                    -- users_evm_uniq 兜底（幂等）
```

**A2 绑定 `super_admin`（= `0022` §④ 的同义重建 · 按库内 evm 匹配，非硬编码值）**
```sql
INSERT INTO public.admin_user_role (uid, role_key)
SELECT u.uid, 'super_admin'
  FROM public.users u
 WHERE lower(u.evm) = lower(:'seed_evm')
ON CONFLICT (uid, role_key) DO NOTHING;
COMMIT;
```

**A3 正读回（应得：uid=100 · is_admin=false · has_role=true）**
```sql
SELECT u.uid, u.is_admin,
       EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid) AS has_role,
       (SELECT jsonb_agg(rp.permission_key ORDER BY rp.permission_key)
          FROM public.admin_user_role r
          JOIN public.admin_role_permission rp ON rp.role_key = r.role_key
         WHERE r.uid = u.uid) AS perms
  FROM public.users u WHERE lower(u.evm) = lower(:'seed_evm');
-- 期望 has_role=true 且 perms = 12 键全量
```
> **备选子变体 A′**：若定档「Kevin 是所有者 ⇒ 直接总开关」⇒ 把 A1 的 `is_admin` 改 `true`（则 `buildAdminAccess:6619` 走 12 键全量，**不依赖角色行**）。**A 与 A′ 择一，不要都做**（否则语义重叠）。

**判负用例（≥4，必须能使提案「红」）**
| # | 构造 | 期望「红」 |
|--:|---|---|
| N1 | A2 用一个**不在库**的 `evm` 跑 `INSERT…SELECT` | 命中 **0 行** ⇒ `admin_user_role` **不增行**（证明绑定**按 evm 匹配**、非无条件插）|
| N2 | 把 A2 的 `uid` 换成**不存在的 uid** | **违反 `admin_user_role_uid_fk`** ⇒ 事务回滚（证明不能给幽灵 uid 绑角色）|
| N3 | **重复跑 A1+A2** | `ON CONFLICT DO NOTHING` ⇒ **0 新行**（幂等）|
| N4 | 重建后对 **control uid 2**（`is_admin=false`、无角色行）跑 `resolveAdminAccess` | `can_access_admin=false`（证明权限**未外溢**）；同时对 uid 100 ⇒ `true` |
| N5 | A 执行前后 `SELECT uid FROM users WHERE is_admin=true` | **恒为 `{1,10}`**（证明 A **不误伤** uid 1/10）|

**回滚（可逆）**
```sql
BEGIN;
DELETE FROM public.admin_user_role
 WHERE role_key = 'super_admin'
   AND uid IN (SELECT uid FROM public.users WHERE lower(evm) = lower(:'seed_evm'));
COMMIT;
-- 如需连用户行一并撤（★ 仅当该行此后未被登录写入 account/ledger 依赖时才可用）：
-- DELETE FROM public.users WHERE lower(evm) = lower(:'seed_evm');
```
> **风险提示**：若 A 执行后 Kevin **已登录过**，其行会被写入 `account`/`batt_account`/`ledger_entry` 等下游（登录是写路径，S55a R2）⇒ **撤用户行会撞 FK**；**回滚首选只删 `admin_user_role` 行**（即时收回 admin，不动业务行）。

### §6.2 选项 B —— 沿用新库 `is_admin` 的 `uid 1/10`（**零 SQL**）

- **无 SQL**（不改库）。**前置硬条件 = 先核 `uid 1/10` 的钱包归属**（§4：`NOT_MEASURED`）。核清后（若确为团队自持）即生效——**后台本已可用**（§5.2）。
- **判负**：若要求「管理员身份可追溯到 Kevin 本人」⇒ (B) **天然判负**（Kevin 未被恢复）。
- **回滚**：无需（零写）。

### §6.3 选项 C —— 声明不需要外置管理员（**零 SQL**）

- **无 SQL**。声明不用 Web 后台；运维走本机/CLI/直连库。
- **判负**：任何 `POST /api/admin/points/adjust`、`/api/admin/user/update`、`/api/admin/permissions/save` 类运营需求出现 ⇒ (C) **判负**（无 HTTP 持有人）。
- **回滚**：无需（零写）；日后改主意再走 (A) 或 (B)。

### §6.4 ★ 不采纳的「顺手修」（登记为反例）

- ❌ **恢复 `admin_role` 的 4 个夹具角色 / `admin_role_permission` 的 4 行夹具** —— 与 S52b「零夹具」口径**直接冲突**，且**无任何真需求**。
- ❌ **恢复 `is_admin=true` 的 `970201`** —— 它是夹具（`bio='p4b2c:fixture uid=970201'`），**恢复即污染生产**。
- ❌ **把 `super_admin` 整条 DELETE** —— 会**连带** `admin_role_permission.super_admin×12`（FK）且丢掉**唯一**可用角色定义；**不可取**。

---

## §7 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因 |
|---|---|---|
| **任何写**（A 的 SQL、`setval`、建户、绑定） | **未做** | 硬口径①（两库只读、生产写需授权）|
| `uid 1/10` **钱包归属** | **`NOT_MEASURED`** | 只读无法从库内证明持有人 |
| `uid 970213` **为何拿 9e8 号** / 由哪段脚本/流程写入 | **`NOT_MEASURED`** | 未做代码考古（同 S43/S48）|
| 新库 **`account`/`batt`/`ledger` 面**是否也有 970213 的残留 | **`NOT_MEASURED`** | 本单聚焦权限面；新库 `users` 无 970213 ⇒ 余表按 FK 亦无 |
| 生产 HTTP `/api/admin/me` 实际响应 | **`NOT_MEASURED`** | 硬口径：**未带真 admin 凭证**（不得用真账号）；§5 结论全部**由代码推得**，非线上实测 |
| (A) 执行后的真实生效（`200`/权限位） | **`NOT_MEASURED`** | **提案未执行** |
| 旧库 `prize`/`market` 等**非权限面**计数 | **`NOT_MEASURED`** | 不在本单射程（S55a 已另测）|
| 两库 `neon_auth` schema 行数 | **`NOT_MEASURED`** | 应用 0 引用（S55a 已证）|
| 会话级只读护栏是否真生效 | **否**（`SHOW transaction_read_only=off`）| Neon HTTP 驱动逐条隐式事务；见 §0 / §8 |
| 新库 `users` 总数 | **26**（uid `1-12,17-22,34-41`）| 现取 |
| 新库空闲真 uid | **`100` 空闲**（`max_uid=41`；`uid_is_identity=BY DEFAULT` ⇒ 可显式给号）| 现取 |

---

## §8 自曝

1. **零写来自「只发读语句」的构造，而非会话护栏**：本单两库均 `SELECT/SHOW`（探针脚本内无 `INSERT/UPDATE/DELETE/DDL/nextval/setval`）；虽尝试 `SET TRANSACTION READ ONLY`，但 `SHOW transaction_read_only` 仍 `off`（Neon HTTP 驱动）⇒ **同 S55a 自曝⑥**，登记为**未消除的局限**。
2. **动的是「生产库」，全程只读**：新库自 2026-10-07 13:10:49 起即生产（S55a 定格）⇒ 本单**未写新库任何行**；§6 的 SQL **全部未执行**。
3. **「差」的口径诚实**：§1 的逐表差异**由程序算**（`admin-table-diff.json`），非目测；`super_admin.time_created` 的跨库差异**已标注为 `now()` 派生、非内容差**，**未拿它凑「差异」**。
4. **「是谁」的边界**：§3.2 判定 `uid 970213 = Kevin` 的**强证据**来自 **master-plan 逐字转引**（§5.280/§5.296/§5.306）+ **本单现取的真业务足迹** + **地址=原 `DEFAULT_ADMIN_ADDRESS`**；**但**「为何是 9e8 号」未考 ⇒ **未把「推断」写成「实测」**。
5. **未用真账号/真钱包/真 admin 凭证**：§5 的后台可用性结论**全部是读码推得**（附逐行 `index.ts`/`database.ts` 行号），**非线上 200/403 实测**——已如实标 `NOT_MEASURED`。
6. **多 agent 并发**：开工对锚 HEAD=`a40793e`；本单**未 commit / 未 push**（硬口径⑤）；产物目录 `**/.*-artifacts/` 已在 `.gitignore`。收工时 `git status --porcelain` 见下（**仅本单新增的 untracked 报告 + 产物**）。
7. **未碰的端口/进程**：全程未起实例、未 `pkill/killall`、未碰 `5787/5788/5555/5191`；未 `npm install`（复用已装 `@neondatabase/serverless`）。
8. **未打印密钥/完整地址**：探针只打印 `host_prefix/sha8/前6后4`；§6 的 SQL 以 `:seed_evm` 占位。

---

### 产物清单（`backend-ts/.s56-artifacts/s56-20261007T124650Z/`）

| 文件 | 内容 |
|---|---|
| `admin-parity-probe.json` | 两库 `admin_*` 四表 + `users` 全量 + `is_admin` + 业务足迹（**无值**：evm 只出 sha8/前6后4） |
| `admin-table-diff.json` | §1 逐表**程序化 diff**（only_old / only_new / identical） |
| `admin-fix-feasibility.json` | §6 可行性：uid 占用 / `uid=100` 空闲 / `users_evm_uniq` / identity / `schema_migration` / `super_admin` / 12 键 |
| `seed-admin-footprint.json` | §3 `970213` 的 `account`＋`ledger` 分型 ＋ `970201`/`1`/`10` 名册字段 |
| `s56probe.mjs` · `s56fix-probe.mjs` | 只读探针脚本（仅 `SELECT/SHOW`） |
| `collect.sh` | 复跑入口（可选） |
