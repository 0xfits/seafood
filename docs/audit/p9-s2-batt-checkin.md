# P9② 实现单（第一步 · 不 apply）· batt 电量 + 签到 / 补签

- **单号**：P9② 实现第一步（Kong）
- **依据（真源 · 冻结）**：
  - `docs/data-layer.spec.md` **v0.21 §31**（全 11 小节 + 七裁定就地注 `R-9-14`..`R-9-20`）
  - `docs/route-layer.spec.md` **v2.14 §28**（全）
  - `docs/ledger.spec.md`（kind 闭集 / `−1` 归属 / `R25`/`R31`/`R101`/`R49`/`R50`）
  - `docs/requirements/p9-four-role-economy.md` §4 / §5 / §7
- **仓库**：`/Users/kevin/bistro/seafood`（**推送即上线 ⇒ 本单不 push**）
- **范围**：迁移文件（**建好不 apply**）+ `src/ledger.ts` + `src/database.ts` + `src/index.ts` + 前端 + 新门 + 测试连带。
- **★ 硬边界**：本单**不 apply 任何迁移**；**不改已 apply 迁移**；错误码闭集 **33 不动**；**不碰** `docs/*.spec.md` / `master-plan` / `docs/qa/**`；**不 `git add/commit/push`**；**禁 `pkill -f`/`killall`**；库面写一律事务内 + 末尾 `ROLLBACK`；**严禁 UPDATE `app_config`**。

---

## 0. 开工锚（现取）

- **HEAD** = `e68edf0`（`docs(p9-2): §5.231/v0.231 —— 规范回写入库 fe48c27 …`）；分支 `main`（与 `origin/main` 同步；**未推送、未提交**）。
- **`git status` 归因**：
  - **上单（P9② 实现）已落盘、未提交**（` M`）：`backend-ts/src/{database,index,job-service,ledger}.ts` · `frontend/src/locales/{zh,en,hk,vn}.json` · `frontend/src/pages/ProfilePage.jsx`。
  - **本（收口）单改动**（` M`）：`backend-ts/scripts/p8-s{2,3,3b,4,5,6}-*-gate.ts`（冻结计数前推）· 四个 i18n 计数测试（`i18n-batch-b4a/b4b/b5.test.jsx` / `i18n-violation-closeout.test.jsx`）。
  - **未跟踪**（`??`）：`backend-ts/migrations/0028_kind_close_set_21.sql` · `0029_batt_checkin.sql` · `backend-ts/scripts/p8-s7-batt-checkin-gate.ts`（本单新门）· `frontend/src/batt-checkin.js` · `frontend/src/components/BattCheckinPanel.jsx` · 本报告 · （上一单落盘的 spec 快照 / delta 等归上一单）。
  - **无关既有改动**：`backend-ts/.p4-artifacts/b4c-…/geometry.json`（上一单遗留，非本单）。
- **注册点 = 80 逐 verb 现取**：`get 34 / post 43 / put 0 / patch 1 / delete 2`（和 = 80；`grep -cE '^app\.(get|post|put|patch|delete)\('`）。
- **`LEDGER_KINDS` 现取** = **21**（末位 `checkin_makeup_fee`）；`PLATFORM_KIND_WHITELIST['-1'].credit` 现取含 `checkin_makeup_fee`。
- **两策略键现取**：`batt_policy` / `checkin_policy` 恒在 `APP_CONFIG_LEGAL_KEYS`（9 键，未动）。
- **权限键 = 11**（本单**零新增** admin 键：4 新口全走 `requireActor`，`requireAdmin(` 零命中）。
- **错误码闭集 = 33**（本单**零新增码**）。
- **已 apply 迁移集** = `0001–0027`（交接读数：`0026`/`0027` 曾 DB↔文件 checksum 双对拍；`0018` 号段缺席 ⇒ 26 个迁移文件）；**本单新建 `0028`/`0029` 且 `0028`/`0029` 一律未 apply**。

## 1. 迁移 `0028_kind_close_set_21.sql`（建好 · 不 apply）

- **内容契约（逐项 · `§31.1 R-9-14`）**：① 前置断言（`fail-closed`，逐字沿 `0003:28-55`）—— `ledger_kind_enum` 约束**在场且为 CHECK**（`contype='c'`）、`ledger_entry.kind` **列类型 = `text`**（非 PG enum 类型，否则手法不适用 ⇒ ABORT）；② `DROP CONSTRAINT IF EXISTS ledger_kind_enum` + `ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (…))`（**21 值**）；③ 收尾自检 —— 恰 1 个 `ledger_kind_enum` CHECK / 该 CHECK 覆盖**恰 21** 个期望值 / 新 kind `checkin_makeup_fee` 逐字在场（逐字沿 `0003:69-83` + `0019:143-166`，把 20 前推为 21）。
- **21 值逐字（`:60-68`）**：`mint,burn,transfer,hold,hold_release,hold_forfeit,job_escrow,job_escrow_refund,job_payout,job_fee,commission,purchase,sale,purchase_refund,trade,trade_fee,listing_fee,listing_deposit,currency_create_fee,reversal,checkin_makeup_fee`（**只追加末位**、不改既有 20）。
- **本迁移不做什么**：只改 `ledger_kind_enum` **一个约束**；不改 `0001`/`0002`（checksum 漂移会 ABORT）；不新增 / 不删除 kind（= 追加 1 值）；不改任何业务表；不新增 / 不删除错误码（仍 33）；不写业务数据。
- **`PENDING_APPLY`**：`ledger_kind_enum` **活体**值集 = 21（需 apply 后证）—— 本单不 apply，见 §11。

## 2. 迁移 `0029_batt_checkin.sql`（建好 · 不 apply）

- **承载（变体 Ⅰ · `R-9-19`）= 4 张新表**（`:45`/`:79`/`:120`/`:167`）：`public.batt_account`（可变表 · `CHECK batt BETWEEN 0 AND 100`）· `public.batt_entry`（append-only · `CHECK delta <> 0` + `batt_after BETWEEN 0 AND 100` + `UNIQUE (idempotency_key)`）· `public.checkin_log`（append-only · `UNIQUE (uid, checkin_day)`）· `public.checkin_makeup_log`（append-only · `UNIQUE (uid, makeup_day)` + `UNIQUE (idempotency_key, result)`）。
- **触发器恰 4 枚**（`:251`/`:256`/`:261`/`:266`）：`batt_account` 一枚 `BEFORE UPDATE` 刷 `time_updated`（`batt_account_touch_updated`）+ 其余三表各一枚 `BEFORE UPDATE OR DELETE` 无条件 `RAISE`（append-only，**原生 `P0001`**，不借账本错误码）。
- **具名索引 3 枚**（`IF NOT EXISTS`）：`idx_batt_entry_uid_time` · `idx_checkin_log_uid_day` · `idx_checkin_makeup_log_uid_day`。
- **`§G`（`:423`）**：`ledger_assert_platform_mutation` 加法式扩展 —— **仅** `-1` 的 `credit` 再加 `checkin_makeup_fee`；其余每一格（`0`/`-2`/`-3`/`-1` debit）**逐字不变**；含**双向**自检（正向六格放行 + 负向：非白名单 credit / 任意 debit / 其它平台格 皆拒）。
- **`§G2`（`:546` · `R-9-21`）**：`ledger_kind_ok` 关闭集 **20 → 21**（第一支 IN 列表末位追加 `checkin_makeup_fee`）；**`p_frozen_settle` 第二支一字不动**（`job_payout/purchase/trade/hold_forfeit`，不含新 kind）；含 ± 自检（21 值全接纳 + 闭集外必拒 + 冻结族第二支未放宽）。
- **`§F` apply-time 自检**：四表在场 / 逐表列名逐字 / 约束计数（PK·FK·CHECK·UNIQUE）/ 具名索引 / 触发器覆盖 UPDATE OR DELETE —— 不通过 ⇒ 整迁移回滚、**不写版本行**。
- **`PENDING_APPLY`**：4 表 + 4 触发器 + 索引 + `ledger_kind_ok` 活体 = 21 + `-1` credit 活体 —— 均需 apply 后证，见 §11。

## 3. `src/ledger.ts`（kind 20 → 21）

- **`LEDGER_KINDS` 追加**（`:157` 数组定义 / `:164` 新增值）：`'checkin_makeup_fee'` **只追加于末位**、不改既有 20 值次序（⇒ `length = 21`）；`type LedgerKind` 随之含第 21 值。
- **`PLATFORM_KIND_WHITELIST['-1'].credit` 追加**（`:540` 定义 / `:560` 取值）：`['trade_fee','listing_fee','currency_create_fee','job_fee','listing_deposit','checkin_makeup_fee']`（**加法式**，`debit` 仍恒空）；手法逐字照 `0019` 对 `listing_deposit` 的扩展。
- **溯源**：`data-layer.spec` v0.21 §31.1 `R-9-14`（C-3 = 方案 ② 扩容 +1）+ §31.5 + `ledger.spec` `R101`；**不真 burn**（`R-9-3`）。

### 3.1 ★「kind 闭集编码处清单」（**恰三处** · 逐处给出处 + 现取形态 + 判别依据）

| # | 文件:行 | 现取形态 | 判别依据 |
|---|---|---|---|
| ① | `backend-ts/migrations/0028_kind_close_set_21.sql:60-68` | `ALTER TABLE ledger_entry ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (…21 值…))` | DB 侧**约束编码**（`text` + CHECK，非 enum；`contype='c'`）⇒ 接纳入库 kind 的唯一闸 |
| ② | `backend-ts/migrations/0029_batt_checkin.sql:546-556` | `CREATE OR REPLACE FUNCTION ledger_kind_ok(p_kind text, p_frozen_settle boolean DEFAULT false) … SELECT p_kind IN (…21 值…) AND (NOT p_frozen_settle OR p_kind IN ('job_payout','purchase','trade','hold_forfeit'))` | `ledger_post_event` 的 `entries` 路径（`0004:788` `NOT ledger_kind_ok(COALESCE(v_e_kind,''))`）**逐条目调用** ⇒ 不收窄则补签腿被拒、交付不成立 |
| ③ | `backend-ts/src/ledger.ts:157-165` | `export const LEDGER_KINDS = [ …21 值… ]` | TS 侧**类型/值集真源**（`LedgerKind` + 运行期 `LEDGER_KINDS.includes`） |

- **三处同集（现取）**：① `21` · ② `21` · ③ `21`，且彼此**集合逐字相等**（新门 `D2`/`D3`/`D4` 现取绿）；② 的 `p_frozen_settle` **第二支 = 4 值**且**不含** `checkin_makeup_fee`（新门 `D5` 绿）。
- **★「无第四处」扫面证据（新门 `D6`/`D7`/`D8` 现取）**：
  - **扫面正则** = `ledger_kind_ok|ledger_kind_enum|LEDGER_KINDS|PLATFORM_KIND_WHITELIST|checkin_makeup_fee`；
  - **扫面根** = `backend-ts/src` · `backend-ts/migrations` · `backend-ts/scripts` · `frontend/src` · `docs`（排除 `node_modules`/`dist`/`.git`/`*artifacts`）；
  - **命中分类逐桶（现取）** = `{ full_set_21: 3, spec_text: 90, historical_or_superseded: 5, single_kind_usage: 2, probe_or_artifact: 11, readonly_call_or_subset: 11 }`；
  - **结论**：代码面**全闭集编码（≥21 值）恰三处** = ① `0028 CHECK` ② `0029 ledger_kind_ok` ③ `src/ledger.ts`（`full_set_21` 桶 = 3；`probe_or_artifact` / `readonly_call_or_subset` / `historical_or_superseded` = 派生子集 / 只读调用 / 一次性 apply 自检 / 历史被取代定义（20 值，无新 kind）/ 探针弃件，**均无独立全闭集值集**；`spec_text` = 规范文本（真源，非代码编码））；等价判别 `D8`：代码面「含 `checkin_makeup_fee` 且 kind 数 ≥ 20」的文件 = **恰那三处**（其余含新 kind 者皆为单值使用）。

## 4. `src/database.ts`（batt / 签到 / 补签读写口 + ★双闸）

- **读口**：`getBatt(uid)`（`batt_account` + `batt_policy` fail-closed；派生布尔 `canAccept` 即时重算，**不落库**）· `getCheckinStatus(uid)`（`checkin_log`/`checkin_makeup_log` + `checkin_policy`；`checkedInToday`/`canMakeup` 即时算）。
- **写口**（**单语句 CTE = 一个隐式事务**）：`checkin(uid, idem)`（判连续天数 → INSERT `checkin_log` → 加发 batt（**封顶丢弃**）→ `batt_entry` 仅在 `delta <> 0` 落行；**零账本腿**）· `checkinMakeup(input)`（判 `result` → `applied` 时**同语句**调 `ledger_post_event`（`−cost $ → uid=−1`，kind `checkin_makeup_fee`，**不真 burn**）→ INSERT `checkin_makeup_log`；**不补发该日 batt** · `R-9-20`）。
- **配置 fail-closed**：`resolveBattPolicy` / `resolveCheckinPolicy`（逐字段回落服务端常量；无行 / 非 object / 字段非法 ⇒ 常量；`source = 'config'|'constant'`）；`BATT_POLICY_DEFAULTS = {taskCostBatt 9, capBatt 100, floorBatt 0, acceptThresholdBatt 9}` · `CHECKIN_POLICY_DEFAULTS = {baseRewardBatt 30, streakCapDays 7, streakDay7RewardBatt 60, makeupCostUsd 100, makeupDailyLimit 1}`（**现取**比对绿）。`getAppConfigValueByKey` = **纯 SELECT**（只读）。
- **★双闸两处（`R-9-18`）**：
  - **落点 A · `applyToJob` 前置拦（fail-fast）**：阈值闸落**单写路径 CTE `ins` 的 `WHERE`**（`batt_account ≥ COALESCE(…acceptThresholdBatt…)`）；outcome CASE 产 `'batt_below_threshold'`。
  - **落点 B · `acceptJobApplication` 权威扣费点**：`thr` CTE 取 `accept`/`cost`；`upd` 门控 `worker_batt ≥ thr.accept`；`deduct` CTE **同事务** `SET batt = b.batt − cost` 且**二次判** `b.batt ≥ cost`（不满足 ⇒ 无行 ⇒ 整体回滚 ⇒ 409）；`ins_entry` 为该扣减落 `batt_entry` 逐笔（`reason='task_cost'` · 幂等键 `biz:job:accept:cost:<uid>:<applicationId>`）。
- **幂等键**：`biz:checkin:<uid>:<checkin_day>` / `biz:checkin:makeup:<uid>:<target_day>`（**服务端派生定案形** · `R-9-16`/`R-9-19`；前缀 `biz:` · 逐段冒号 · **禁金额/时间戳入键** · `R49`/`R50`）。
- **日界** = **UTC 自然日**（`R-9-15`）：读 / 写 SQL 一律 `now() AT TIME ZONE 'UTC'`。**溢出** = **封顶丢弃**（`R-9-17`）：`newbatt = LEAST(cur + reward, capBatt)`；DB 兜底 `CHECK (batt BETWEEN 0 AND 100)` + `delta <> 0` 移动守卫。

## 5. `src/index.ts`（4 新口 · 注册点 76 → 80）

- **注册点 80 逐 verb 现取**：`get 34 / post 43 / put 0 / patch 1 / delete 2`（+4 = 2 GET + 2 POST；`get 32→34` / `post 41→43`）。
- **4 新口（全闸 `requireActor(req, res)` · uid 取自 token · **零 admin 键新增**）**：
  - `:1194` `GET /api/batt` → `DatabaseService.getBatt(`；`data` 冻结 **6 键**（batt/capBatt/floorBatt/acceptThresholdBatt/canAccept/updated_at）。
  - `:1213` `GET /api/checkin` → `DatabaseService.getCheckinStatus(`；`data` 冻结 **6 键**（streakDay/streakCapDays/checkedInToday/canMakeup/makeupCostUsd/updated_at）。
  - `:1232` `POST /api/checkin` → `DatabaseService.checkin(uid, bizKeyOf('checkin', uid, utcDay()))`；`data` 冻结 **4 键**（checkedIn/streakDay/rewardBatt/batt）。
  - `:1254` `POST /api/checkin/makeup` → `DatabaseService.checkinMakeup({…bizKeyOf('checkin','makeup',uid,targetRaw)})`；`data` 冻结 **3 键**（restoredStreakDay/costUsd/txid）；`target_day` 入键 / 入 SQL 前经 `isBusinessDay(targetRaw)` 服务端校验（非法 ⇒ 400）。
- **异常面**：四口 `sendInfraMapped` 标签 `batt.get` / `checkin.get` / `checkin.post` / `checkin.makeup`（既有 §14 分类器）；拒绝面 = **既有 33 闭集借码 + 稳定 `reason`**（R107 单形状）。

## 6. 前端（电量 / 签到 / 补签 + 四语命名空间）

- **接线层 `frontend/src/batt-checkin.js`（4,136 B）**：`fetchBatt` / `fetchCheckinStatus` / `postCheckin` / `postMakeup`（无 token ⇒ 本地化 `auth.err.NO_CREDENTIAL`；非 2xx ⇒ `apiErrorMessage`；**本层零本地数值计算** · 承 `R-8-5`）。
- **组件 `frontend/src/components/BattCheckinPanel.jsx`（4,442 B）**：电量卡 + 签到区（只消费 `t(...)` 四语文案；派生布尔由读口即时取）；`frontend/src/pages/ProfilePage.jsx` 接线（`:16` import + `:250` `<BattCheckinPanel />`）。
- **四语命名空间（新增顶层 2 个 · 9 键 × 4 语）**：`battCard`（4 键：title/unit/rangeHint/insufficient）+ `checkinPanel`（5 键：checkinButton/streakDays/brokenHint/makeupButton/makeupCost）。
- **六类工程口径泄漏 = 0**（`i18n-violation-closeout` 现取：locale 裸命中 0 + 源面裸命中 0；en/vn 零 CJK）。

## 7. 新门 `backend-ts/scripts/p8-s7-batt-checkin-gate.ts`

- **性质**：**零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / 迁移 / locale 文本），与「离线 126/126 套件」同族；产物 `backend-ts/.p8s7-artifacts/p8s7-<RUN>/gate.json`。
- **判据清单（7 组）**：`A` 注册点 80 逐 verb + 4 新口在场（含缩进注入负对照）· `B` 4 新口形态（`requireActor` 全闸 / 零 admin 键 / 响应冻结键集 / 幂等键派生形 / `target_day` 校验 / `sendInfraMapped` 四标签）· `C` 双闸两处（A 前置拦 / B 同事务扣 + 二次判 + 扣费逐笔）· `D` `R-9-21` 三处编码含 21 + 穷举扫面「无第四处」· `E` 幂等 / 日界 UTC / 溢出封顶丢弃 / 配置 fail-closed · `F` 零新增码（33）· `G` `PENDING_APPLY` 如实登记。每组均含**自证负对照**（谓词喂错值必转红）。
- **现取读数**：`total=48 passed=48 failed=0`（**EXIT 0**）；`pending_apply = 5`；关键读数：注册点 `80` · `LEDGER_KINDS = 21`（末位 `checkin_makeup_fee`）· 三处编码 `{sql_0028_check:21, sql_0029_ledger_kind_ok:21, sql_0029_frozen_settle_branch:4, ts_ledger_kinds:21}` · 扫面 `full_set_21 = 3` · 错误码 `33`。
- **★ `PENDING_APPLY` 说明**：库面 leg（`0028`/`0029` 的 DB 级效果）**单列 `pending_apply[]`、不入 `checks`** ⇒ **不得伪装绿**；`G2` 断言本门零 DB 连接（`db_connections:0` / `http_calls:0`）⇒ 不可能已验 DB。清单逐条见 §11。

## 8. 判负 ≥ 2 处（仓外副本 + 复原 + 主仓零写入 `cmp`）

- **副本**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s2-copy`（`rsync` 主仓，排除 `node_modules`/`.git`/`.*-artifacts`/`dist`；`backend-ts/node_modules` 与 `frontend/node_modules` 软链回主仓）；**基线**副本 `p8-s7` = **48/48**（`exit 0`）。
- **三变异（逐字红点）**：

| 变异 | 目标文件 | 改动 | 副本门读数 | **红点（failed id）** | 复原 |
|---|---|---|---|---|---|
| **M1** 去 `apply` 前置闸 | `backend-ts/src/database.ts` | 前置闸 `>= COALESCE(…acceptThresholdBatt…)` ⇒ `>= 0 OR COALESCE(…)` | `exit 1` | **`C1`** | `exit 0` |
| **M2** 去 `accept` 二次判 | `backend-ts/src/database.ts` | `AND b.batt >= (SELECT cost FROM thr)` ⇒ `AND TRUE` | `exit 1` | **`C2`** | `exit 0` |
| **M3** `ledger_kind_ok` 不扩（回 20） | `backend-ts/migrations/0029_batt_checkin.sql` | 函数第一支去 `'checkin_makeup_fee'`（回 20 值） | `exit 1` | **`D3` · `D4`** | `exit 0` |

- **复原回绿**：三变异后各从主仓回拷 ⇒ 副本 `p8-s7` 复 = **48/48**（`exit 0`）。
- **主仓零写入**：复原后 `cmp` 主仓 vs 副本 —— `backend-ts/src/database.ts` · `backend-ts/migrations/0029_batt_checkin.sql`（含基线时 `src/index.ts`）**全部逐字节 SAME** ⇒ 变异只发生在副本。

## 9. 硬门全量复跑

> 退出码**管道外捕获**（`cmd; rc=$?`）。

| 门 | 命令 | 读数 | 退出码 |
|---|---|---|---|
| `tsc` | `cd backend-ts && npx tsc --noEmit` | 0 行 | **0** |
| 离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | `total=126 passed=126 failed=0` | **0** |
| 前端 `build` | `cd frontend && npm run build` | `index-CAasue3y.js` 388.42 kB · `✓ built` | **0** |
| `test:unit` | `cd frontend && npm run test:unit` | `31 files / 276 passed` | **0** |
| `p8-s1` | `p8-s1-app-config-gate.ts` | 24/24 | **0** |
| `p8-s2` | `p8-s2-fee-rebate-gate.ts` | 41/41 | **0** |
| `p8-s3` | `p8-s3-deposit-gate.ts` | 45/45 | **0** |
| `p8-s3b` | `p8-s3b-address-gate.ts` | 38/38 | **0** |
| `p8-s4` | `p8-s4-currency-review-gate.ts` | 79/79 | **0** |
| `p8-s5` | `p8-s5-compliance-gate.ts` | 117/117 | **0** |
| `p8-s6` | `p8-s6-site-text-gate.ts` | 64/64 | **0** |
| **`p8-s7`（新门）** | `p8-s7-batt-checkin-gate.ts` | **48/48**（`pending_apply=5`） | **0** |

- **注册点 = 80**；`p8-s1..s7` **现值均未掉**（含 `p8-s6` 注册点/逐 verb 前推、`p8-s7` 库面 leg = `PENDING_APPLY` 未伪装绿）。合计 = `24+41+45+38+79+117+64+48` = **456/456**，全退出码 **0**。
- **★ 附带冻结计数前推**（沿 `R-8-22`，为上表复绿所必需）：除任务点名的 `76 → 80` 外，`p8-s3/s3b/s4/s5` 的 `MIGRATIONS_FROZEN` **26 → 28**（+`0028`/`0029`）同轮前推（不改判据语义，仅计数）。

### 9.1 冻结计数前推逐处（文件:行 · 旧值 ⇒ 新值 · 沿 `R-8-22`）

| 文件:行 | 冻结常量 | 旧值 ⇒ 新值 | 依据 |
|---|---|---|---|
| `p8-s2-fee-rebate-gate.ts:72-73` | `REG_COUNT === …` + 说明串 | `76` ⇒ `80` | 注册点 +4（`get 32→34` / `post 41→43`） |
| `p8-s3-deposit-gate.ts:66` | `REG_POINTS_FROZEN` | `76` ⇒ `80` | 注册点 +4 |
| `p8-s3-deposit-gate.ts:76` | `MIGRATIONS_FROZEN` | `26` ⇒ `28` | +`0028` / +`0029` |
| `p8-s3b-address-gate.ts:63` | `REG_POINTS_FROZEN` | `76` ⇒ `80` | 注册点 +4 |
| `p8-s3b-address-gate.ts:65` | `MIGRATIONS_FROZEN` | `26` ⇒ `28` | +`0028` / +`0029` |
| `p8-s4-currency-review-gate.ts:61` | `REG_POINTS_FROZEN` | `76` ⇒ `80` | 注册点 +4 |
| `p8-s4-currency-review-gate.ts:63` | `MIGRATIONS_FROZEN` | `26` ⇒ `28` | +`0028` / +`0029` |
| `p8-s5-compliance-gate.ts:70` | `REG_POINTS_FROZEN` | `76` ⇒ `80` | 注册点 +4 |
| `p8-s5-compliance-gate.ts:72` | `MIGRATIONS_FROZEN` | `26` ⇒ `28` | +`0028` / +`0029` |
| `p8-s6-site-text-gate.ts:70` | `REG_POINTS_FROZEN` | `76` ⇒ `80` | 注册点 +4 |
| `p8-s6-site-text-gate.ts:75` | `PER_VERB_FROZEN` | `{get:32,post:41,put:0,patch:1,delete:2}` ⇒ `{get:34,post:43,put:0,patch:1,delete:2}` | 逐 verb 同前推 |
| `p8-s6-site-text-gate.ts:14`·`:110`·`:115` | 头注释 / 分组注释 / 说明串 | `76`（逐 verb `32/41`）⇒ `80`（`34/43`） | 同 |

> 各门自带的「缩进注入」负对照以 `REG_POINTS_FROZEN + 1` **现算** ⇒ 随常量自动前推；**未删任何断言**（仅前推期望值）。

## 10. 测试连带（四个 i18n 计数测试逐处出处）

| # | 文件:行 | 旧值 | 新值 | 出处 |
|---|---|---|---|---|
| 1 | `frontend/src/test/unit/i18n-batch-b4a.test.jsx:143` | `{top:112, flat:944}` | `{top:114, flat:953}` | `+battCard(4)+checkinPanel(5)` ⇒ 顶层 +2 / 拍平 +9 |
| 2 | `i18n-batch-b5.test.jsx:215` · `:241` · `:256` | `top=112 flat=944` | `top=114 flat=953` | 上位脚本 `p6-tr2-i18n-locales.mjs` 现取 `zh: top=114 flat=953`（读 locale 动态算） |
| 3 | `i18n-batch-b4b.test.jsx:239` · `:256` · `:321` | `top=112 flat=944` | `top=114 flat=953` | 同上 |
| 4 | `i18n-violation-closeout.test.jsx:80` · `:81` · `:126` | 节点 `3776` / 拍平 `944` | 节点 `3812` / 拍平 `953` | 拍平 `944→953` ⇒ 节点 `953×4=3812`（上位脚本 `p4z-i18nviol-global.mjs` 现取 `作用域命中节点数 = 3812`） |

- **top `112 → 114`**（+2 顶层命名空间）· **flat `944 → 953`**（+9 键）· **节点 `3776 → 3812`**（`953 × 4`）；**未删任何断言**（仅前推期望值 + 逐字登记订正注释）。
- **`b4a` 的 `NEW_KEY_TOTAL`**：**不受影响**（`battCard`/`checkinPanel` 为**新增顶层命名空间**，不入 `NEW_NS` 清单 —— 与 `B8S4` 的 `adminCurrencyReview`「另计为顶层」同处理）⇒ `NEW_KEY_TOTAL = 175` 断言**逐字不变**。

## 11. `PENDING_APPLY` 与未测项（逐项原因）

### 11.1 `PENDING_APPLY` 清单（新门 `pending_apply[]` 现取 · 5 条 · **单列、不入 `checks`**）

| # | 库面 leg | 原因 |
|---|---|---|
| 1 | `0028` · `ledger_kind_enum` CHECK 在 DB 侧扩容为 21（DROP+ADD） | 本单**不 apply** 迁移 ⇒ 活体约束值集不可验；源码面三处编码已验（`D1–D6`） |
| 2 | `0029` · 4 表 + 4 触发器 + 具名索引在 DB 侧落地 | 同上 ⇒ 结构未落库；源码面内容契约 / 自检块已验 |
| 3 | `0029 §G/§G2` · `-1` credit 白名单 + `ledger_kind_ok` 活体 = 21 | 函数 `CREATE OR REPLACE` **未执行** ⇒ 活体行为不可验 |
| 4 | `batt_account CHECK (batt BETWEEN 0 AND 100)` / append-only 触发器（原生 `P0001`）真行为 | DB 兜底未落库 ⇒ 越界 / `UPDATE`/`DELETE` 拒绝不可验 |
| 5 | 4 新口真 HTTP 200 / 401（受控实例探针） | 本门**零网络**；真 HTTP 读数需受控实例另册 |

### 11.2 未测项（逐项原因 · 禁填 0/空）

| # | 未测项 | 原因 |
|---|---|---|
| 1 | `0028`/`0029` apply 后的 DB 级效果（约束值集 / 表·触发器·索引 / `ledger_kind_ok` 活体 / `-1` credit 活体 / 兜底 CHECK 行为） | **硬边界**：本单**不 apply 任何迁移** ⇒ 无法连库取证（`PENDING_APPLY`，见 §11.1）。 |
| 2 | 4 新口**真 HTTP** 状态码与响应体（无 token 401 / 有 token 200 / 补签 409 三类拒绝） | 需**受控实例探针**（起实例 + 真库）；本单零网络、且**不得启停 5787/5788** ⇒ 未跑。 |
| 3 | 双闸 / 补签的**端到端真库链路**（`apply` 前置闸拒 / `accept` 二次判回滚 / `checkout` 腿落账） | 同上：需 apply `0028`/`0029` + 真库；属库面 leg，`PENDING_APPLY`。 |
| 4 | 前端电量卡 / 签到区的**浏览器渲染**与 i18n 实渲染（四语切换目视） | 需真实浏览器 + 受控实例；本单只读源码 / 单测（`test:unit` 276 含 i18n 计数与泄漏面，但非该组件实渲染断言）。 |
| 5 | 冒顶丢弃 / 断签清零 / `≤1/日` 补签上限的**运行时行为** | 依赖真库状态与时钟；本单仅验源码判据（`E2`–`E5`）⇒ 运行期行为未测。 |

## 12. 结论

- **5 件全交付、逐条给读数**：① 冻结计数前推（6 门 `76→80` + 4 门 `MIGRATIONS_FROZEN 26→28`，逐处；四 i18n 计数测试 `112/944/3776 → 114/953/3812`，未删断言，`b4a` `NEW_KEY_TOTAL` 不受影响）② 新门 `p8-s7-batt-checkin-gate.ts`（48/48 · 零 DB/HTTP · 判据 A–G 含负对照 · `R-9-21` 三处编码含 21 + 穷举扫面「无第四处」· 库面 leg `PENDING_APPLY`）③ 判负 3 处（仓外副本 M1⇒`C1` / M2⇒`C2` / M3⇒`D3+D4`；复原回绿；主仓 `cmp` SAME）④ 硬门全量复跑（`tsc` 0 · 离线 126/126 · 前端 build 0 · `test:unit` 276 · `p8-s1..s7` = 456/456 · 注册点 80）⑤ 报告回填（本文件，含 kind 闭集编码处清单 + `PENDING_APPLY` 清单 + 未测项逐项原因）。
- **硬口径遵守**：**未 apply 任何迁移** · **未改 `src/**` 逻辑**（本单只写 6 门 + 4 测试 + 新门 + 报告）· 错误码闭集 **33 不动** · **未碰** `docs/*.spec.md` / `master-plan` / `docs/qa/**` · **未 `git add/commit/push`** · 未 `npm install` · 未碰 / 未打印 `.env*` · 未 `pkill -f` / `killall` · 未启停 5787/5788 · 库面 leg 一律 `PENDING_APPLY`（本单**零库面写**）。
- **库面 leg = `PENDING_APPLY`（如实登记、不得伪装绿）**：DB 级效果待 apply `0028`/`0029` 后另册取证（§11）。

## 13. 静态 vs 真跑（P9② 极小修复单 · 迁移类自证）

> 立据：`R-9-24` —— 迁移类交付**必备自证 = 单事务内真跑 + `ROLLBACK`**（**禁 `COMMIT`**）；静态检查（括号 / 引号 / 语法）**不足以**覆盖 PL/pgSQL 运行期歧义。

### 13.1 真失败（Zang apply 现取 · 逐字）

```
"version":"0028", "action":"FAILED", "message":"column reference \"k\" is ambiguous", "code":"42702"
```

`public.schema_migration` 仍 **`0027`**；`0028` / `0029` **均未应用**；runner 单事务整文件回滚 ⇒ **零残留**。

### 13.2 根因 + 修法

- **根因**：`migrations/0028_kind_close_set_21.sql` 收尾自检 `DO $$ DECLARE` 块在 `:82` 声明了**从未被当作变量使用**的 `k text;`；同块 `:102` 的 `FROM unnest(v_expected) AS t(k)` 引入**列别名 `k`** ⇒ PL/pgSQL 内 `:103` 的 `quote_literal(k)` 对**变量 `k` 与列 `k`** 产生运行期歧义（`42702`）。**静态语法 / 括号 / 引号全过**（歧义只在 PL/pgSQL 名字解析期暴露）。
- **修法**：**仅删 `:82` 一行 `  k text;`**（最小改动，`6194 → 6184` 字节，−10B）；**未改任何其它行**、**未动 21 值或断言语义**、**未动 `0029`**。`:102` 的 `AS t(k)` 此后唯一指向列别名，歧义消解。

### 13.3 同族扫面（穷举 · 正则 + 逐处结论）

- **扫面正则**（逐 `$$…$$` 块）：
  - 声明变量：`^\s*([A-Za-z_]\w*)\s+(?:"[A-Za-z_]\w*"|[A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*(?:\[\s*\])?\s*(?::=|=|;)`
  - SQL 列别名：`\bAS\s+([A-Za-z_]\w*)\s*\(\s*([A-Za-z_]\w*)`
  - 判据：同块内 `{声明变量}` ∩ `{别名列名}` ≠ ∅ ⇒ 高风险。
- **逐处结论**（`0028` / `0029` + 顺带 `0026` / `0027`）：

| 文件 | 块（起始行） | 声明变量 | `AS 别名(列)` | 交集 |
|---|---|---|---|---|
| `0026` | `:115` | `v_names,v_n,v_trg,v_covers` | 无 | ∅ |
| `0027` | `:119` | `v_names,v_n,v_trg,v_covers` | 无 | ∅ |
| `0028` | `:29` | `v_contype,v_udt` | 无 | ∅ |
| `0028` | `:71` | `v_cnt,v_def,v_covered,v_expected` | `t(k)`@`:102` | ∅（原 `k` 已删） |
| `0029` | `:274` | `v_names,v_n,v_trg,v_covers` | 无 | ∅ |
| `0029` | `:426` | `v_ok` | 无 | ∅ |
| `0029` | `:456` | `v_msg,v_n` | 无 | ∅ |
| `0029` | `:564` | `v_bad` | `t(k)`@`:578` | ∅ |

- **复核 `0029:578` `AS t(k)`**：全文件（含函数体）**无任何 `k` 变量声明**（正则 `^\s*k\s+text\b` 命中 0）⇒ `t(k)` 仅解析为列别名，**无歧义**；此块 `DECLARE` 仅 `v_bad`。
- **穷举结论**：四文件**声明变量名 vs 其内 SQL 列别名/列名同名 = 0 处**；本缺陷为 `0028` **孤例**，`0029` / `0026` / `0027` 无同族风险。

### 13.4 ★ 真跑自证（`R-9-24` 本单核心）

- **手法**：与 `backend-ts/scripts/migrate.ts` **同款 Pool**（`@neondatabase/serverless` + `ws`）；对 `0028` / `0029` **各自单独**执行 `BEGIN; <文件全文>; (读事务内态); ROLLBACK;` —— **全程禁 `COMMIT`**（脚本 `.p9s2-apply/p9s2-r924-realrun.ts` 只在 `finally` 发 `ROLLBACK`）。
- **基线（真跑前现取）**：`schema_migration` = **26 行**、`max(version)` = **`0027`**、含 `0028`/`0029` = **0**；`ledger_kind_enum` = **20 值（不含 `checkin_makeup_fee`）**；`ledger_kind_ok` 源长 **384**（不含新值）；`ledger_assert_platform_mutation` 源长 **1250**；`batt_*` 四表 / 四函数 `to_regclass`/`to_regprocedure` = **NULL**；`batt_*` 触发器 = **0**。

| 文件 | (a) 无错 | (b) 回滚后 `to_regclass`/`to_regprocedure` | (c) `schema_migration` | (d) 目标对象复原 |
|---|---|---|---|---|
| `0028` | file_ok=`true`（error_code=`null`）；事务内 `kind_def` **含 `checkin_makeup_fee`（21 值落地）** | 四表 `[null,null,null,null]` · 四函数 `[null,null,null,null]` · 触发器 `0` | 26 行 / max=`0027` / 新行=`0` | `ledger_kind_enum` def **逐字相同**=`true` · `ledger_kind_ok` 源 **逐字相同**=`true`(384) · `ledger_assert_platform_mutation` 源相同=`true` |
| `0029` | file_ok=`true`（error_code=`null`）；事务内 **四表 `[batt_account,batt_entry,checkin_log,checkin_makeup_log]` + 触发器 `4`**；`ledger_kind_ok` 源长 **410**（含新值） | 四表 `[null,null,null,null]` · 四函数 `[null,null,null,null]` · 触发器 `0` | 26 行 / max=`0027` / 新行=`0` | `ledger_kind_enum` def 逐字相同=`true` · `ledger_kind_ok` 源逐字相同=`true` · `ledger_assert_platform_mutation` 源相同=`true` |

- **结论**：**两文件均单事务内真跑成功、`ROLLBACK` 后零残留**（四读数逐项如上）；`0028` 缺陷**已消解**，`0029` **无错**。**本单未 apply / 未 `COMMIT`** —— apply 仍归 Zang。

---

## 14. 三处真缺陷（真链路查出 · 静态门 A–G 全漏 · 已最小修）

> 出处：`C-14`（静态门无法覆盖运行期 SQL 缺陷）。**三者只有真链路（`backend-ts/.p9s2c-apply/` 四段）才炸**，静态门（含 `p8-s7` A–G）首跑全绿。真链路首跑 `realchain-20261003T024414Z.json` = `total 25 / passed 21 / failed 4`（`A7`·`B1`·`B2` 三红 + `C1`）；三修后 `024537Z` = `24/25`（仅余 `C1`）。

| # | 位置 | 逐字根因 | 修法（现取） |
|---|---|---|---|
| **1** | `src/database.ts` `checkin`（`ins_log` 之后引用处） | 首签取 `(SELECT streak FROM ins_log)` —— `ins_log` 的 `RETURNING` **只出 `streak_day`**（无 `streak` 列）⇒ 首签即 **`42703`**（`column "streak" does not exist`）⇒ 第 7 天夹具只累到 `streakDay=2`（`A7` 红） | 逐字改为 `streak_day`（现取 `:4349` `(SELECT streak_day FROM ins_log)` + `:4358` `COALESCE((SELECT streak_day FROM ins_log), …)`）✓ |
| **2** | `src/database.ts` `checkinMakeup` 账本腿 | 事件带 `ref_type='checkin_makeup'` —— **不在 `ledger_ref_type_enum` 白名单**，且 `ref_id=<日期>` 非整数 ⇒ 账本按 **`R18`**（`ref_type`/`ref_id` 成对校验）抛 **`LEDGER_AMOUNT_INVALID`**（`B2` 红） | 按 **`R18`「成对或双 NULL」删去 ref 对**：`entries` 每支只留 `uid/cid/delta/kind`（现取 `:4427-4432`；`checkin_makeup'` 命中 **0**）✓ |
| **3** | `src/database.ts` `checkinMakeup` 末 SELECT | 首 `applied` 的末 SELECT **漏选 `txid`/`restored_streak_day`** ⇒ 回执 `txid=null`（`B1` 红） | 补两列：`RETURNING log_id, result, txid, restored_streak_day`（`:4445`）+ 末 SELECT `(SELECT txid FROM ins_log)` / `(SELECT restored_streak_day FROM ins_log)`（`:4450-4451`）✓ |

- **现取复核**：`grep -c "checkin_makeup'" backend-ts/src/database.ts` = **0**；`streak_day` 两处引用在；`txid`/`restored_streak_day` 在。

## 15. C1 定位结论（六中间量读数 + 三假设逐条排除 + 根因 + 最小修法）

> 探针 `backend-ts/.p9s2c-apply/c1-locate.ts`（**同事务 + 哨兵 `ROLLBACK`**；产物 `c1-locate-20261003T025201Z.json`）；夹具 `job 990101` / `workerUid=6`（**无 `batt_account` 行**）。

### 15.1 六中间量读数（逐字 · 形态 Ⅰ = 无 batt 行）

| # | 中间量 | 读数 | 含义 |
|---|---|---|---|
| a | batt 实值（**代码形态** A = `(SELECT COALESCE(b.batt,0) …)`） | **`null`** | 无行时子查询返回 **NULL**（非 0）⇒ 代码读到错值 |
| a′ | batt 实值（**对照形态** B = `COALESCE((SELECT b.batt …), 0)`） | **`0`** | 外层 COALESCE 兜「无行」⇒ 正解 |
| b | 解出 `acceptThresholdBatt` | **`9`**（来源：`batt_policy` 无行 `raw_cfg=null` ⇒ 参数默认 **9**） | 阈值面正常 |
| c | `ins` CTE 返回行数 `ins_rows` | **`0`** | 谓词 `NULL >= 9` = NULL ⇒ 未插入 |
| d | `cur.outcome` | **`null`** | `cur` 无行（非 `replay`/`already_applied`） |
| e | `j.job_status` | **`open`** | 判决 CASE 首个 WHEN 不命中 |
| f | `j.employer_uid = workerUid` | **`false`** | 第二 WHEN 不命中 |
| — | 实参 | `jobId=990101`(number) / `workerUid=6`(number) / `createKey`(string) | 非空 |
| — | `pg_typeof` | `$1=bigint` / `$2=bigint` / `$4=integer` | 类型正常 |

### 15.2 三假设逐条排除（我立 `C-15`）

| 假设 | 判别 | 结局 |
|---|---|---|
| **H1** 实参空/类型不符 ⇒ `NULL < 9` | 实参非空 + `pg_typeof` = bigint/bigint/integer | **排除** |
| **H2** 夹具既有 `job_application` 行 ⇒ `replay`/`already_applied` 抢先 | `cur_rows=0`、`cur_outcome=null` | **排除** |
| **H3** 三条 WHEN 顺序与夹具冲突 | `job_status='open'`、`employer_eq_worker=false` ⇒ 前两条均不命中 | **排除** |

### 15.3 根因（坐实）

`(SELECT COALESCE(b.batt,0) FROM batt_account b WHERE b.uid=$n)` —— **`COALESCE` 包在标量子查询内部**：它只兜**列值** NULL，**不兜「无行」**。无 `batt_account` 行时整条子查询返回 **NULL**（非 0）⇒ `NULL < 9` = **NULL**（非 TRUE）⇒ 判决 CASE 落 `ELSE 'conflict'`；**同因** `ins` 的 `>=` 亦为 NULL ⇒ 未插入。

### 15.4 最小修法 + 对照读数

- **修法**：`applyToJob` 两处改**外层** `COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = ${workerUid}), 0)`（与 `acceptJobApplication` 的 `gate` 同形；**未削弱任何判据**）；全修 **5 处**（现取外层形态 = **5**、旧内层形态 = **0**）。
- **对照读数**：① 无 batt 行 ⇒ 修后 `batt_below_threshold`（修前 `conflict`）② 显式 `batt=0` 行 ⇒ `batt_below_threshold` ③ 显式 `batt=9` 行 ⇒ `applied`（`applicationId=41`）。
- **连带**：四段真链路 **24/25 → 25/25**。

## 16. 库面判负 3 处（仓外副本 + 复原 + 主仓 `cmp`）

> 手法：仓外副本（`rsync` 主仓，排除 `node_modules`/`.git`/`.*-artifacts`/`dist`）；**活体 `ledger_kind_ok` 用事务内 `CREATE OR REPLACE` + `ROLLBACK`**。

| 变异 | 改动 | 红点 | 复原 |
|---|---|---|---|
| **N1** 去 `apply` 前置闸 | `applyToJob` 前置闸 | **`C1`·`C2` 红**（`C1` `applied` vs 期望 `batt_below_threshold`） | 回绿 |
| **N2** 去 accept 一次闸 | `acceptJobApplication` 的 `g.worker_batt >= thr.accept` | **`C3`·`C4` 红**（`C3` `accepted`） | 回绿 |
| **N3** `ledger_kind_ok` 回 20 | 事务内 `CREATE OR REPLACE` + `ROLLBACK` | 活体 `checkin_makeup_fee` = **false** ⇒ 补签抛 **`LD023 LEDGER_UNKNOWN_KIND`** | 回滚后活体复原 **21** |

- **复原读数**：三变异后四段真链路复 = **25/25**（`total 25 / passed 25 / failed 0`）。
- **主仓零写入**：`cmp` 主仓 vs 副本 —— `src/database.ts` · `migrations/0028_…sql` · `0029_…sql` **全 IDENTICAL**（变异只发生在副本）。

## 17. 门 · 复跑读数（带实例 vs 离线双读数）

> 退出码**管道外捕获**（`cmd; rc=$?`）。`p8-s7` 含真 HTTP 腿（`G8`–`G10`）⇒ **两组读数并列**（`R-9-26`）。

| 门 | 命令 | 读数 | 退出码 |
|---|---|---|---|
| **`p8-s7`（带实例 `5797` 在听）** | `p8-s7-batt-checkin-gate.ts` | **`total 56 / passed 56 / failed 0`** · `pending_apply=[]` · `db=7` · `http=9` | **0** |
| **`p8-s7`（离线 · 无实例）** | 同上 | **`total 56 / passed 53 / failed 3`** · 红 **`G8`·`G9`·`G10`**（全 HTTP 类：`{"status":-1}` / `fetch failed`） | **1** |
| `tsc -p tsconfig.json` | `npx tsc -p tsconfig.json` | 0 行 | **0** |
| 离线套件 | `p4z-tr1a-01-offline-tests.ts` | `total=126 passed=126 failed=0` | **0** |
| 前端 `build` | `npm run build` | `index-CAasue3y.js 388.42 kB` · `✓ built` | **0** |
| 前端 `test:unit` | `npm run test:unit` | `31 files / 276 passed` | **0** |
| `p8-s1` | `p8-s1-app-config-gate.ts` | 24/24 | **0** |
| `p8-s2` | `p8-s2-fee-rebate-gate.ts` | 41/41 | **0** |
| `p8-s3` | `p8-s3-deposit-gate.ts` | 45/45 | **0** |
| `p8-s3b` | `p8-s3b-address-gate.ts` | 38/38 | **0** |
| `p8-s4` | `p8-s4-currency-review-gate.ts` | 79/79 | **0** |
| `p8-s5` | `p8-s5-compliance-gate.ts` | 117/117 | **0** |
| `p8-s6` | `p8-s6-site-text-gate.ts` | 64/64 | **0** |

- **注册点 = 80 逐 verb**：`get 34 / post 43 / put 0 / patch 1 / delete 2`（和 = 80）。
- **离线 3 红的判别**：三红**全为 HTTP 类** ⇒ 属**环境差异**（**无实例在听**），**非判据退化**；**未改判据放宽、未标 `SKIPPED` 假绿**（`R-9-26`）。

## 18. HTTP 读数（带实例 `5797` · 4 口 401 ⇄ 200 + 公开面 + 冻结键集）

- **4 新口无 token ⇒ 逐口 401**：`GET /api/batt`=401 / `GET /api/checkin`=401 / `POST /api/checkin`=401 / `POST /api/checkin/makeup`=401。
- **4 新口有 token ⇒ 逐口 200**：同上四口 = 200/200/200/200。
- **公开面零回归**：`GET /api/role-names` 无 token ⇒ **200**。
- **冻结键集（现取逐字）**：

| 口 | 键数 | 键集 |
|---|---|---|
| `GET /api/batt` | 6 | `acceptThresholdBatt / batt / canAccept / capBatt / floorBatt / updated_at` |
| `GET /api/checkin` | 6 | `canMakeup / checkedInToday / makeupCostUsd / streakCapDays / streakDay / updated_at` |
| `POST /api/checkin` | 4 | `batt / checkedIn / rewardBatt / streakDay` |
| `POST /api/checkin/makeup` | 3 | `costUsd / restoredStreakDay / txid` |

## 19. `pending_apply[] = 0` + 两项边界登记

- **`pending_apply[] = 0`**（现取 · 带实例）：库面 leg（`0028`/`0029` 的 DB 级效果）已由 **G1–G7** 转为**真 `checks`**（活体 `ledger_kind_enum`=21 / 4 表 + 4 触发器 / `ledger_kind_ok` 活体=21 / 范围 CHECK `23514` / append-only `P0001` / §G 白名单）⇒ **`pending_apply` 空**、无库面 leg 伪装绿。
- **边界 (a) · `p8-s7` 运行前置 = 受控实例在听（`R-9-26`）**：`p8-s7` 含真 HTTP 腿（`G8`–`G10`）⇒ **运行前置 = 受控实例（`5796`/`5797`）在听**；离线复跑红 **3** 条属**环境差异**（不得改判据放宽、不得标 `SKIPPED` 假绿）；**交付/质检必须带实例取全绿读数、并同时登记离线读数**。
- **边界 (b) · `tsc` 覆盖面**：`backend-ts/tsconfig.json` 的 `include = ["src/**/*"]` ⇒ **`scripts/` 不在编译面**（`tsc -p tsconfig.json --listFilesOnly` 命中 `/scripts/` = **0**）；**门脚本仅经 `ts-node --transpile-only` 运行** ⇒ **`tsc` 绿不等于门脚本无类型错**（本族脚本依赖 `transpile-only` 跳过类型检查）。

## 20. 自证汇总（本单 · 极小收尾）

- **报告**：`docs/audit/p9-s2-batt-checkin.md` —— 本单**追加 §14–§20**（既有 §0–§13 **未改写**）；**占位符（连续两下划线）命中 = 0**；**行数 = 363 · 字节 = 41404**。
- **改动文件清单（不提交）**：
  - **本单未新增源码**（只**追加本报告** + **落产物**）。
  - **未跟踪产物目录**（本单产生，**不提交**）：`backend-ts/.p9s2c-closeout/`（读产物：`offline.out`/`test-unit.out`/`build.out`/`instance.out`/`p8s7-with-instance.out`/`p8s7-offline.out`/`p8s1..p8s6*.out`/`tsc.out`/`git-status-first.txt`/`git-status-last.txt`）+ 各门新 run 产物（`backend-ts/.p4-artifacts/p6tr1a-20261003T030305Z/`、`.p8s1..s5-artifacts/*030417Z…030420Z/`、`.p8s6-artifacts/`、`.p8s7-artifacts/*030336Z/` 与 `*030404Z/`）。
- **首尾 `git status` 归因**（HEAD = `818dd6b`）：首 **147** 行（`20 M` + `127 ??`）→ 尾 **154** 行（`20 M` + `134 ??`）；差异 **+7**，**逐条全为 `??`（新产物 run 目录）**：`p6tr1a-20261003T030305Z/`（离线套件）、`p8s1-20261003T030417Z/`、`p8s2-gate-20261003T030417Z/`、`p8s3-20261003T030418Z/`、`p8s3b-20261003T030419Z/`、`p8s4-20261003T030419Z/`、`p8s5-20261003T030420Z/`（`p8s6`/`p8s7` 新产物落在**已整目录未跟踪**的父目录内 ⇒ 不另计行）；**` M` 差额 = 0**（既有 **20** 个 ` M` 恒等，**零源码改动**）。
- **端口**：受控实例 **`PORT=5797`**（LISTEN PID **`34054`**）⇒ `kill -TERM 34054` ⇒ 进程消失 + `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**；**`5787`/`5788` 全程未动**（`5787` PID=`30475` / `5788` PID=`65096` 恒等）。
- **硬口径**：**未 apply**（已 apply）· **未 `git add/commit/push`** · **未 `npm install`** · **未碰/未打印 `.env*`** · **未 `pkill -f`/`killall`** · **未启停 `5787`/`5788`** · 库面写**一律事务内 + `ROLLBACK`** · **未 UPDATE `app_config`** · 错误码闭集 **33 不动**（现取 `grep -rhoE "LD0[0-9][0-9]" src | sort -u | wc -l` = **33**）。
