# 批 8 第五片 8③b 收口 —— `app_config` **键级寻址写面（形态 B）**「真生效」+ 类级门 + **生产库基线复原**

> **作者角色** = **Kong（实现方）** · **单别** = 批 8 第五片 **8③b** · **本件 = 8③b 最后收口**（★ 生产库时间戳漂移**复原** + `S2` 期望修 + 四段探针重跑全绿 + 仓外副本判负 + 报告落盘 + 收尾）。
> **契约真源**：`docs/data-layer.spec.md` **v0.13 §24**（§24.1 线格式 / §24.2 `AV1`–`AV5` / §24.3(c) `ops:` 派生 / §24.4 下限 fail-closed）+ `docs/route-layer.spec.md` **v2.6 §21**（§21.1 形态 A 冻结 / §21.2 键级寻址）+ `R-8-18`（事务内 `ROLLBACK`）+ `R-8-19`（键级寻址）+ `R-8-20`（门判据升级）。
> **本件所有读数为本单现取**；未测项标 `NOT_MEASURED`（**禁填 0 / 禁空**）。
> **硬口径自证**：本单**未**新增 / apply 迁移（迁移数仍 **23**）；**未**在主仓新增任何路由（注册点仍 **69**）；**未**实现任何退还 / 罚没 / `delist` 面（`R-8-17`）；错误码闭集仍 **33**（不动 · **零新增 `reason`**）；**未**碰 `migrations/**`、任何 `docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`、既有 `docs/audit/**`（除本件）；**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未**用 `pkill -f` / `killall`；**未**启停 5787/5788。

---

## §0 开工锚 + 改后全量硬门复跑（退出码**管道外**捕获）

### 0.1 开工锚（现取）

| 项 | 命令 | 现取读数 |
|---|---|---|
| 仓库 HEAD | `git rev-parse HEAD` | `c6aaee2ca779fc99ec8ff8fea496098b56d58f68`（开工锚；★ **收尾时已前移为 `9bf4b5f229cffe2778356ffab9abcbe108093811`** —— 系**控制方（Zang）**在本单运行期间提交的 `docs/seafood.master-plan.md`（+24 行）· **非本单所为**（本单**未** `git add/commit/push`）） |
| 分支 | `git rev-parse --abbrev-ref HEAD` | `main` |
| 主工作区 `git status --porcelain`（首 · 开工） | `git status --porcelain` | `M`×2（`backend-ts/src/database.ts` / `backend-ts/src/index.ts`，**均为上轮 8③ 遗留**，非本单所改）+ 未跟踪（`.p4-artifacts/` / `.p8s1-artifacts/` / `.p8s2-artifacts/` / `.p8s3-artifacts/` / `.p8s3b-artifacts/` + 四探针 `p8-s3b-01-effective.ts` / `p8-s3b-address-gate.ts`） |
| 残留实例 | `lsof -nP -iTCP:5793-5799 -sTCP:LISTEN` | **空**（开工即已确认） |

### 0.2 改后全量硬门复跑（退出码**管道外**捕获）

> 捕获方式（逐字）：`{ <cmd> > <out> 2>&1; echo "EXIT=$?"; }` —— **管道不参与**（禁 `cmd | tail` 吞码）。

| # | 门 | 命令 | 退出码 | 读数（现取） |
|---|---|---|---|---|
| 1 | **类型** | `cd backend-ts && npx tsc --noEmit` | **0** | 输出 **0 字节**（零诊断） |
| 2 | 离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | `total=126 passed=126 failed=0` |
| 3 | **新门 `p8-s1`** | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | **0** | `total=24 passed=24 failed=0` |
| 4 | **新门 `p8-s2`** | `npx ts-node --transpile-only scripts/p8-s2-fee-rebate-gate.ts` | **0** | `total=41 passed=41 failed=0` |
| 5 | **新门 `p8-s3`** | `npx ts-node --transpile-only scripts/p8-s3-deposit-gate.ts` | **0** | `total=45 passed=45 failed=0` |
| 6 | **★ 新门 `p8-s3b`** | `npx ts-node --transpile-only scripts/p8-s3b-address-gate.ts` | **0** | **`total=38 passed=38 failed=0`**（产物 `.p8s3b-artifacts/p8s3b-20261002T160402Z/gate.json`） |
| 7 | 前端构建 | `cd frontend && npm run build` | **0** | `✓ built in 1.58s`（`dist/` 产出齐） |
| 8 | 单测 | `cd frontend && npm run test:unit` | **0** | `Test Files 31 passed (31)` · `Tests 276 passed (276)` |
| 9 | **七门** | `node scripts/<gate>.mjs` ×7 | **全 0** | 见 §0.3 |

### 0.3 七门逐门读数（`EXIT=0` 全部 · 本单现取）

| 门 | 读数（现取摘要） |
|---|---|
| `p4z-i18nviol-global` | `总判：PASS`（locale 裸命中 0 + 源面裸命中 0；作用域 locale=3152 / source=40） |
| `p6-tr2-i18n-locales` | `总判：PASS` |
| `p4z-miscfix-links` | `总判：PASS（残留全部已登记）` |
| `p4z-feperf-safelist` | `VERDICT=PASS` |
| `p7a-03-errmessage-gate` | `总判：PASS`（扫描文件 79 / 受体 6 / 命中 0 / 基线 0） |
| `p7b-errfallback-gate` | `总判：PASS`（`D 节点=132 需护栏=0 已本地化=132`；`G 键不可用=0/132`） |
| `p7c-errmsg-machinecode-gate` | `总判：PASS`；**★ `链=真链`**（`D 类级违例=0/16` / `F 反例违例=0/16` / `G 机读码出现次数=0/36 违例=0`） |

> ⇒ **四新门（`p8-s1`/`p8-s2`/`p8-s3`/`p8-s3b`）+ 七门全 PASS**；`p7c` 仍 `真链`。

---

## §1 交付物清单（本单）

| 文件 | 性质 | 内容 |
|---|---|---|
| `backend-ts/scripts/p8-s3b-01-effective.ts` | 未跟踪 · **本单修改** | ① `S2-key-set-unchanged` 期望修为「基线键集 ∪ {`listing_deposit_policy`}」；② `ak2_read_db` 锚点改从 `src/database.ts` 取行号（原误用 `currency-service` 行缓冲 ⇒ 恒 `-1`）；③ `restore.disk_seal` 文案改为 **DELETE + INSERT**（原写 UPDATE，与实装不符）。 |
| `backend-ts/scripts/p8-s3b-02-dbstate.ts` | 未跟踪 · **本单新增** | **只读**现状探针：`pg_trigger` 触发器清单（时机/事件/函数/启用）+ 列/约束 + `app_config` 逐字节行集。 |
| `backend-ts/scripts/p8-s3b-03-restore.ts` | 未跟踪 · **本单新增** | 生产库 `app_config` 基线**复原**（单事务 DELETE + INSERT · 前置断言漂移态 · 复原后逐字节对拍）。 |
| `docs/audit/p8-s3b-write-path.md` | **本件** | 本报告。 |

**产物（现取）**：`.p8s3b-artifacts/p8s3b-dbstate/{pre,post}.json`（触发器清单 + 现状）· `.p8s3b-artifacts/p8s3b-restore/{pre,post}.json`（复原对拍）· `.p8s3b-artifacts/p8s3b-effective-20261002T160302Z/effective.json`（四段探针 41/41）· `.p8s3b-artifacts/p8s3b-20261002T160402Z/gate.json`（门 38/38）· 仓外副本 `~/.hermes/profiles/zang/cache/scratch/p8s3b-falsify/`（三处变异判负）。

---

## §2 ★ 生产库基线复原 + 自曝：本轮时间戳漂移事件

> **本单第一件事（最高优先）**：复原生产库 `app_config` 的基线态。**已复原并对拍通过。**

### 2.1 现取触发器清单（复原前置取证 · `.p8s3b-artifacts/p8s3b-dbstate/pre.json`）

`public.app_config` 上**恰 2 枚**（均 `FOR EACH ROW` · `tgenabled = 'O'` · 非内部触发器）：

| 触发器 | 时机 | 事件 | 函数 |
|---|---|---|---|
| `trg_app_config_key_immutable` | **BEFORE** | **UPDATE**（**无** INSERT / **无** DELETE） | `platform_config_key_immutable` |
| `trg_app_config_touch_updated` | **BEFORE** | **UPDATE**（**无** INSERT / **无** DELETE） | `platform_config_touch_updated` |

**⇒ 两枚均为 `BEFORE UPDATE` 且均不含 `DELETE` / `INSERT` 事件 ⇒ `DELETE` 未被禁**（可复原）。另现取佐证（`pg_constraint` / `pg_rewrite`）：**无**外键引用 `app_config`、**无** rewrite 规则、`app_config` **无** `time_created` 列（列为 `key text` / `value jsonb` / `updated_by bigint` / `time_updated timestamptz DEFAULT now()`；约束 = PK(`key`) + 三 NOT NULL + `CHECK (jsonb_typeof(value) IN ('object','array'))`）。

### 2.2 自曝：时间戳漂移事件（现象 / 根因 / 修复 / 对拍）

- **现象**：上一轮 8③b 探针跑**真 HTTP 写**后，`system_settings.time_updated` 停在 `2026-10-02 15:57:54.741187+00`，而基线为 `2026-10-02 14:14:07.502017+00`（**前移 1h43m**）。
- **根因（逐字证据）**：①-a **形态 A 回归**真 HTTP `POST /api/admin/settings`（写 `{maintenance:<现值>}`）走 `UPDATE public.app_config` ⇒ 触发 `trg_app_config_touch_updated`（`NEW.time_updated := now()`）**强改**时间戳；而**当轮恢复逻辑用的是 `UPDATE`**（旧 run `effective.json` 的 `restore.disk_seal.ak1` 逐字 = `"UPDATE 逐字节恢复"`）⇒ **UPDATE 无法还原 `time_updated`**（`trg_app_config_touch_updated` 再次强改 `now()`；`trg_app_config_key_immutable` 又拒 `key` 变更）⇒ 漂移留存。
- **修复**：以「**单事务内 DELETE 该行 + 按原样 INSERT**（含基线 `time_updated`）」复原 —— **因两枚触发器均不含 INSERT / DELETE 事件**，DELETE + INSERT **不被任何触发器改写**，可**逐字节复原**（`scripts/p8-s3b-03-restore.ts`）；同一手法同步写入探针 `finally` 的封存段（探针自证「恢复路径可逐字节复原」）。
- **复原对拍读数（现取）**：

| 面 | 改前（漂移态 · `pre.json`） | 改后（复原 · `post.json`，事务外复取） |
|---|---|---|
| 分类 | `DRIFTED_KNOWN`（值同基线 · 时间为漂移值） | `system_settings_byte_identical_to_baseline = true` |
| `key` 集 | 恰 `{system_settings}` | 恰 `{system_settings}`（`key_set_is_exactly_system_settings = true`） |
| `value` | 逐字节 = 基线 | 逐字节 = 基线 |
| `updated_by` | `1` | `1` |
| `time_updated` | `2026-10-02 15:57:54.741187+00` | **`2026-10-02 14:14:07.502017+00`（== 基线）** |
| `listing_deposit_policy` 行 | **不存在** | **不存在**（`listing_deposit_policy_absent = true`） |

> **动作** = `DELETE+INSERT (single tx, committed)`（**无中间态**：删 + 插在同一 `withTransaction` 内，要么全成要么全回滚）。**`time_created` 口径**：`app_config` **无该列** ⇒ 无可变项（原任务书「原 `time_created` 未变」在本表**不适用**，已登记）。

### 2.3 探针 `finally` 恢复路径（改后 · 逐字）

- **① 真 HTTP 回写原值**：仅当**基线存在合法 AK2 行**时执行；本轮基线**无** `listing_deposit_policy` 行 ⇒ `http_rewrite = {sent:false, reason:"原 AK2 行不存在（或值非法）⇒ HTTP 写面无法删行 ⇒ 交由 DB 封存 DELETE"}`。
- **② DB 逐字节封存**：`withTransaction` 内 `DELETE FROM public.app_config WHERE key = ANY(['system_settings','listing_deposit_policy'])` + （`system_settings` 存在则）**INSERT 原 value / updated_by / time_updated** + （原 AK2 行存在则）INSERT 之。`disk_seal = {ak2:"DELETE（原无行）", ak1:"DELETE + INSERT（含原 value+updated_by+time_updated）逐字节恢复"}`。
- **⇒ 恢复路径可逐字节复原已证**（本单另以 `p8-s3b-03-restore.ts` 对生产库实做并逐字节对拍通过 · §2.2）。

---

## §3 ★ 四段「真生效」逐段读数（`p8-s3b-01-effective.ts` · **41/41** · run `20261002T160302Z`）

> 段面机制（逐字登记）：**① 写 = 真 HTTP `POST /api/admin/settings`（形态 B）** —— 与生产**同一路由 / 同一闸 / 同一服务层**；**末尾恢复原值**（`finally` 保证 · §2.3）。**④ 行为随之 = 与 `POST /api/currency/:cid/list` 同路径的 DB 函数** `DatabaseService.listCurrencyWithDeposit(input, tx)`，**全部在事务内 + 末尾抛哨兵 `ROLLBACK`**（`R-8-18`）；**严禁在生产库跑真 HTTP `list`**（会永久把 `draft` 推成 `listed`）。受控 actor = 现库 admin `uid=1`；探针金额 = `234567`（**非定值 · 末尾恢复 ⇒ 零净变更**）。

| # | 段 | 判据 / 锚点 | 逐段读数（现取 · 逐字） |
|---|---|---|---|
| ①-形态 A 回归 | 真 HTTP `POST` | `S1a-formA-*` | `status=200` · `message='System settings saved'` · `data` 键集 = 9 字段（`AW9` 冻结）；`ops_key = ops:1:setting:system_settings`（**逐字不变**） |
| ①-b 形态 B 负向 | 真 HTTP `POST`（拒写 · 库未动） | `S1b-av1/av2/av3/av4` + `S1b-negatives-db-untouched` | 见 §6；`S1b-negatives-db-untouched`：全部被拒后库内 AK2 仍 `null`（`null` == 基线） |
| ①-b **形态 B 正向（写）** | 真 HTTP `POST` | `S1b-write-*` | `status=200` · `message='App config key saved'` · `data={key:'listing_deposit_policy', value:{amount:234567}}` · `data_keys=[key,value]` · `ops_key = ops:1:setting:listing_deposit_policy` |
| ② | **库内落值** | `S2-value-landed` / `S2-key-set-unchanged` / `S2-ak1-value-untouched` | `public.app_config` · key `listing_deposit_policy` · `value = {"amount": 234567}` · `updated_by='1'`；**顶层键集 = `["listing_deposit_policy","system_settings"]`**（= 基线键集 ∪ 此一键 · 见 §3.1）；`AK1`（`system_settings`）值**逐字节未动** |
| ③ | **业务读口取数** | 锚 `src/currency-service.ts:387` `listCurrencyVerb` 取保证金下限 | `raw_ak2 = {"amount":234567}` ⇒ **`{floor:234567, source:'config'}`** ✓ · `S3-parse-no-invention = 234567`（读侧解析 = 落值 · **不隐式转换**） |
| ④-改前 | **行为随之**（消耗额） | 同路径 DB 函数 · `draft_cid=2200001` | 事务内把 AK2 置回**原态**（`null` ⇒ 删行）⇒ `floor={floor:50000,source:'constant'}` · `applied=1` · owner（`uid 970001`）`owner_decrease = 60000`（= `10000` 上市费 + `50000` 常量保证金）· 分录 `listing_deposit` = `["-1:50000","970001:-50000"]` |
| ④-改后 | **行为随之**（消耗额） | 同路径 · `draft_cid=2200002` | 事务内置 AK2 = `{amount:234567}` ⇒ `floor={floor:234567,source:'config'}` · `applied=1` · `owner_decrease = 244567`（= `10000` + `234567`）· 分录 `listing_deposit` = `["-1:234567","970001:-234567"]` |
| ★ 两读数 | `S4-two-readings-differ` / `-computable` | 改前/改后**必不等**且逐值可算 | `{before:{floor:50000,owner_decrease:'60000'}, after:{floor:234567,owner_decrease:'244567'}, delta:'184567', delta_expected:'184567'}` ⇒ **`delta = 234567 − 50000`** ✓✓ |
| fail-closed 负向 | `S4-fail-closed-behavior` | 置**非法**值（`{"amount":"77777"}` 字符串型） | 读口回 **`{floor:50000, source:'constant'}`** · 行为面消耗回 **`60000`**（= `10000+50000`）⇒ **fail-closed 传到行为**（**不是** fail-open 到坏值 `77777`）✓ |
| `ROLLBACK` 自证 | `S4-rollback-no-commit` | `rollback.committed === false` | `rollback = {sentinel:'SEG4_LIST', committed:false, sql:'withTransaction 回调抛哨兵 ⇒ catch ⇒ ROLLBACK（无 COMMIT）'}` ✓ |
| **事务外复取** | `RESTORE-*`（7 判据） | 库面与开工基线**逐字节**相同 | 见 §3.2 |

### 3.1 `S2-key-set-unchanged` 期望修正（本单）

- **原缺陷**：判据期望 = **基线键集**（原库无 AK2 行 ⇒ `["system_settings"]`），但形态 B 写对**不存在的行**是 **INSERT 新行**（非 UPDATE 既有行）⇒ 顶层键集**应恰多出** `listing_deposit_policy` ⇒ 旧期望**必红**（旧 run `20261002T155737Z` 即因此红）。
- **修正（逐字）**：`expectedKeySet = 基线键集 ∪ (ak2Original ? {} : {listing_deposit_policy})`（`ak2Original` = 基线 AK2 行，本轮 = `null` ⇒ 并上该键）。
- **修正后现取**：`actual = expected = ["listing_deposit_policy","system_settings"]` ✓。

### 3.2 事务外复取（回滚/复原自证 · 只读）

| 面 | 判据 | 改前基线 ⇄ 改后复取（现取） |
|---|---|---|
| `app_config` | 行集（key/value/updated_by/time_updated）**逐字节**同基线 | **`true`**（`RESTORE-app_config-identical` ✓ · `time_updated` 仍 `2026-10-02 14:14:07.502017+00`） |
| `app_config` 行数 | 同基线 | `1` ⇄ `1` ✓ |
| `currency` | `n` / `max_cid` / 逐行摘要 | `15` / `36` / `692b67e77b7200cabb3bae49132bcea2` ⇄ **同** ✓ |
| `ledger_entry` | `n` / `max_txid` / 逐行摘要 | `355` / `366` / `f92c5406c8424ff50994d2ba6de81545` ⇄ **同** ✓ |
| `account` | `n` / 余额·冻结·version 摘要 | `39` / `98bcfeea69807ba05961c474caef17a9` ⇄ **同** ✓ |
| `currency_status_log` | `n` / `max_log_id` | `7` / `7` ⇄ **同** ✓ |
| 时间戳 | `max(time_updated)` / `max(time_created)` / `max(listed_at)` **未前移** | `RESTORE-timestamps-not-advanced` 四项**全 `true`** ✓ |

> ⇒ **表行 / 计数 / 摘要逐字节不变 + 时间戳未前移** = 复原自证成立（**写已外泄的反证为空**）。

### 3.3 `nextval` 非事务性（已知代价 · 如实登记）

| 序列 | 现取 `last_value` | 关联表列 | 前进量（本轮 run） |
|---|---|---|---|
| `public.ledger_entry_txid_seq` | **462** | `max_txid=366` | 基线 `450` → **`462`（+12）** = 本 run ④ 段 3 次同路径上市 × 每条 4 分录 = **12 次 `nextval`** |

> **登记为「事务内造数 + `ROLLBACK`」的固有代价**（`nextval` 刻意非事务 · 保并发唯一）；**不构成数据泄漏**（无表行 / 无余额 / 无分录落库）。本单**不藏**此代价。

---

## §4 形态 A 逐字兼容（回归）证据

**现取（真 HTTP + 门双证）**：

| 面 | 现取读数 | 判据 |
|---|---|---|
| 路由支 | `screenSystemSettingsWrite(body)` 在场 · `DatabaseService.saveSystemSettings(verdict.value, actor.session.uID)` 在场 · `'System settings saved'` 在场 | 门 `A1` ✓（`{screen:true,save:true,msg:true}`） |
| 目标键常量 | `let targetKey: string = SYSTEM_SETTINGS_KEY` 在场 · 常量 = `'system_settings'` | 门 `A2` ✓ |
| 费率键闸 | `findFeeRateKey(plainBody)` 保留 | 门 `A3` ✓ |
| 值对象透传 | `validateAppConfigValue('system_settings', {maintenance:true})` ⇒ `ok=true` · 原样 `{maintenance:true}`（**不补默认值**） | 门 `A4` ✓ |
| 未知字段拒 | `legal_keys` = **9 字段** · 整请求拒 | 门 `A5` ✓ |
| **真 HTTP 回归** | `POST {maintenance:<现值>, create_key:ops:1:setting:system_settings}` ⇒ `200` · `message='System settings saved'` · `data` 键集 = 9 字段 | 探针 `S1a-formA-status-200` / `-message` / `-data-keys` ✓ |

⇒ **形态 A（裸值对象）行为逐字不变**；形态 B 为其**纯增量**（键级寻址），不破 `§24.1(f)`。

---

## §5 `ops:` 派生键形与**类级 grep 判据** + §24.3(c)② 口径登记

### 5.1 键形（现取）

| 形态 | 键形（现取） |
|---|---|
| A | `ops:1:setting:system_settings`（真 HTTP 回归以 `uid=1` 现取） |
| B | `ops:1:setting:listing_deposit_policy`（真 HTTP 写以 `uid=1` 现取） |
| 门纯函数 | `canonicalAdminOpsKey(7,'setting','system_settings')` = `ops:7:setting:system_settings`；`(…,'listing_deposit_policy')` = `ops:7:setting:listing_deposit_policy` |

### 5.2 类级 grep 判据（门 `D` 组 · 现取）

| 判据 | 现取 |
|---|---|
| `D1` | 源码行 `const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'setting', targetKey);` ⇒ **第 4 实参 = `targetKey`（解出的目标键变量）** ✓（**不得**写死 `'system_settings'`） |
| `D2` | 两键 `canonical_key` **命名空间不相交**（`…:system_settings` ≠ `…:listing_deposit_policy`）✓ |
| `D3` | 次序：`validateAppConfigKey(`（`AV1`）**先于** `resolveAdminOpsKey(…,'setting'`（非法键不得被伪装成「缺幂等键」· `§24.3(c)⑤`）✓ |
| `D4` | `SETTINGS_WRITE_REASONS` 仍**恰 3 常量**（**零新增 `reason`**）✓ |

### 5.3 ★ 裁定落地：`§24.3(c)②`「互不接受」口径 = **「派生式命名空间不相交」**（逐字登记）

- **口径**：两形态的 `ops:` 键按**解出的目标键**派生 —— `ops:<uid>:setting:<目标键名>`；对**每个**目标键其 `canonical_key` **逐键不相交**，并由门 `D2` 作**类级判据**（**已可判负**：若某轮把两键映射到同一 `ops:` 串，`D2` 转红）。
- **不加「严格相等」校验 + 自曝原因**：若额外要求 `ops:` 键「**严格等于**某个固定串」（如一律 `ops:<uid>:setting:system_settings`），则 **①** 会破 `§24.1(f)`（形态 B 允许**任意合法目标键**，其 `ops:` 键须随之变）**②** 需新增一枚 `reason` 常量以报「键不符」，**违「零新增 `reason`（闭集 33 不动）」** ⇒ **不加严格相等校验**。
- **代价（逐字写明）**：本口径下判据强度 = 「**命名空间不相交（`D2`）+ 第 4 实参 = 解出的目标键变量（`D1`）**」，而**非**「`ops:` 键值严格等于某常量」。残留风险 = 若未来有人把第 4 实参换成**另一个名字但同样派生自目标键**的变量，`D1` 仅校验其**文本为 `targetKey`** ⇒ 理论上可被**同形替换**绕过（现实可达性极低：需同轮改 `src/index.ts` 且保持 `D2`/`D3` 仍绿）⇒ **登记为已知边界**（本单不引入新判据/新常量，代价如实入账）。

---

## §6 `AV1`–`AV5` 分层判负（`details.legal_keys` 证据）

**真 HTTP（形态 B 负向 · 探针现取）**：

| 层 | 判据 | 请求（逐字） | 现取读数 |
|---|---|---|---|
| `AV1` 顶层键 | `S1b-av1-unknown-key` | `{key:'nope', value:{amount:1}, create_key:<ops>}` | `400` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` · `field='nope'` · **`legal_keys=["system_settings","listing_deposit_policy"]`（恰 2 键）** |
| `AV2` 字段层 | `S1b-av2-extra-field` | `{key:'listing_deposit_policy', value:{amount:1,balance:2}, …}` | `400` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` · **`legal_keys=["amount"]`**（**键 ≠ 字段**） |
| `AV3` 类型 | `S1b-av3-string-amount` | `value:{amount:'50000'}` | `400` · `reason=SETTING_TYPE_INVALID` · `expected='number'` · `got='string'`（**不隐式转换**） |
| `AV4` 语义域 | `S1b-av4-zero-amount` | `value:{amount:0}` | `400` · `expected='positive_integer'` · `field='amount'` |
| 次序 | `S1b-av1-before-ops` | `{key:'nope', value:{amount:1}}`（**缺** `ops:`） | `400` · `code=LEDGER_AMOUNT_INVALID` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` ⇒ **先报 `AV1`**（不得伪装成缺幂等键 · `§24.3(c)⑤`） |
| 幂等键 | `S1b-canonical-key` | 合法键但缺 `ops:` | `400` · `code=LEDGER_IDEMPOTENCY_KEY_REQUIRED` · `canonical_key='ops:1:setting:listing_deposit_policy'`（幂等键载体 · `§24.1(c)①`） |

**类级（门 `E` 组 · 离线纯函数）**：`E1`（`AV1` `legal_keys` 恰 2 键）· `E2`（合法键通过）· `E3`（`AV2` `legal_keys=["amount"]`）· `E4`（`AV3` `expected='number'`/`got='string'`）· `E5`（`AV4` `0`/`-5`/`1.5` 皆 `expected='positive_integer'`）· `E6`（`amount=3` 通过）· `E7`（`AV5` 容器硬约束兜底在场：`app_config_value_is_container` ⇒ 转译 `400` + `SETTING_VALUE_NOT_OBJECT` · **禁裸 500**）。

> `AV5` 的**真 HTTP 端到端**（直接触发 `SETTING_VALUE_NOT_OBJECT`）**未单独构造** —— 应用层闸（`AV1`–`AV4`）**先拦**，须绕过应用层方可抵达容器约束（列为 `NOT_MEASURED` · 见 §10）；`E7` 已证兜底**在场**。

---

## §7 `amount` 类型与下限 fail-closed

| 面 | 现取读数 |
|---|---|
| 键值解析纯函数 | `parseListingDepositPolicyAmount`：`{amount:234567}` ⇒ `234567`（正整数）；字符串型 / 非正整数 / 缺字段 / 非 object ⇒ `null`（**不隐式转换 · 不发明数值**） |
| 业务读口 | `resolveListingDepositFloor(raw)`：合法 ⇒ `{floor:raw.amount, source:'config'}`；**其余一律** ⇒ `{floor:50000, source:'constant'}`（**fail-closed**） |
| 常量兜底 | `CURRENCY_LIST_DEPOSIT_FLOOR = 50000`（标 `TODO: Kevin 定值` · 门 `F4` ✓ · **本单不发明保证金数值**） |
| 门 `F1/F2/F3` | `F1`（`null` ⇒ `{floor:50000,source:'constant'}`）✓ · `F2`（`{amount:77777}` ⇒ `{floor:77777,source:'config'}`）✓ · `F3`（`{amount:'77777'}` 字符串 ⇒ **fail-closed** `{floor:50000,source:'constant'}` · **非** fail-open 到 `77777`）✓ |
| 探针行为面 | 合法 AK2 ⇒ 消耗 `244567`；**非法** AK2 ⇒ 消耗回 `60000` ⇒ fail-closed **传到行为**（`S4-fail-closed-behavior` ✓） |

---

## §8 ★ 新门 `p8-s3b-address-gate` 判据清单（**38/38** · `.p8s3b-artifacts/p8s3b-20261002T160402Z/gate.json`）

**零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / spec 文本）。

| 组 | 判据（id） | 断言（摘要） |
|---|---|---|
| `formACompat` | `A1` `A2` `A3` `A4` `A5` | 形态 A 支完整保留 / 目标键 = 常量 `SYSTEM_SETTINGS_KEY` / 费率键闸保留 / 值对象原样透传 / 未知字段拒 + `legal_keys` = 9 字段 |
| `formBFormat` | `B1`…`B6` | 判别 = `isAppConfigEnvelope(body)` / 响应 `{key,value}` + `'App config key saved'` / 写落点第 3 参 = 解出的目标键 / SQL `key` 已参数化（`${targetKey}::text`）/ 判别式纯函数 / 信封形状 |
| `multiKeyReject` | `C1` `C2` `C3` | 信封多余属性拒 / 顶层双键拒 / 数组体拒（**不静默忽略**） |
| `opsDerivation` | `D1` `D2` `D3` `D4` | 第 4 实参 = `targetKey` / 两键命名空间不相交 / `AV1` 先于 `ops:` 派生 / 零新增 `reason`（恰 3 常量） |
| `avLayers` | `E1`…`E7` | `AV1`–`AV5` 逐层 + `details.legal_keys` 分层证据 |
| `failClosed` | `F1`…`F4` | 下限 fail-closed 三态 + 常量标 `TODO: Kevin 定值` |
| `noRefundSurface` | `G1`…`G4` | 注册点仍 **69** / 无 `delist` 路由 / 退还罚没面零命中（注释剥离） / 迁移数仍 **23** |
| **自证（负对照）** | `A1` / `D1` / `E1` / `F1` / `G1` 各自的**自证条目**（门内 id = 判据 id 后接自证后缀） | 谓词喂错值 ⇒ **必须转红**（不转红 = 假门） |

`readings`（现取）：`legal_keys=["system_settings","listing_deposit_policy"]` · `reason_constants={unknownKey,typeInvalid,valueNotObject}` · `ak1_fields` 9 项 · `registration_points=69` · `deposit_floor_constant=50000` · `ops_key_forms={formA:"ops:7:setting:system_settings", formB:"ops:7:setting:listing_deposit_policy"}`。

---

## §9 仓外副本判负（副本基线先跑证忠实）

**副本** = `~/.hermes/profiles/zang/cache/scratch/p8s3b-falsify/copy`（**仓外**：`backend-ts/src` 17 件 + `scripts/p8-s3b-address-gate.ts` + `migrations` 23 件 + `docs/{data-layer,route-layer}.spec.md` + `node_modules` 软链）。

| 步 | 动作 | 现取读数 |
|---|---|---|
| 0 | 副本**基线**跑（先证忠实） | `EXIT=0` · `total=38 passed=38 failed=0` ⇒ 副本忠实 |
| 1 | 变异 ①**`ops:` 回写死常量**（`…,'setting', targetKey)` ⇒ `…,'setting', SYSTEM_SETTINGS_KEY)`） | `D1` **红**：`actual={"line":"const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'setting', SYSTEM_SETTINGS_KEY);","fourth_arg":"SYSTEM_SETTINGS_KEY"}` |
| 2 | 变异 ②**下限 fail-open**（`resolveListingDepositFloor` 直接 `Number(raw.amount)` 记 `config`） | `F3` **红**：`actual={"floor":77777,"source":"config"}`（应为 `{floor:50000,source:'constant'}`） |
| 3 | 变异 ③**形态 A 被破坏**（响应 `'System settings saved'` ⇒ `'Settings saved'`） | `A1` **红**：`actual={"screen":true,"save":true,"msg":false}` |
| 4 | 三变异合计 | `EXIT=1` · **`total=38 passed=35 failed=3`**（`A1`/`D1`/`F3` 必红 · **逐字红读数如上**） |
| 5 | **复原回绿** | 从 `.orig` 拷回 ⇒ 副本 `src/index.ts` / `src/currency-service.ts` 与主仓 **`cmp` 逐字节相同（YES）** ⇒ 副本 `EXIT=0` · `total=38 passed=38 failed=0` |
| 6 | **主仓零写入** + 首尾 `git status` | 见 §11（`git status --porcelain` 首尾**同**） |

> ⇒ 两处以上（本单**三处**）变异下门**必红**（逐字红读数已列）；**均复原回绿**；**主仓零写入**。

---

## §10 未测项（逐项原因 · **禁填 0 / 禁空**）

| # | 未测项 | 状态 | 原因 |
|---|---|---|---|
| 1 | 真 HTTP `POST /api/currency/:cid/list` | `NOT_MEASURED` | 会**永久把 `draft` 推成 `listed`（不可逆）** ⇒ ④ 一律走**事务内同路径 DB 函数 + `ROLLBACK`**（`R-8-18`）；**严禁在生产库跑真 HTTP `list`**。 |
| 2 | `POST /api/admin/settings`（形态 A/B）**真 HTTP 写** | 已测（本单） | 本单因需重跑四段探针，**已跑**真 HTTP 写并在 `finally` 逐字节恢复；**恢复路径可逐字节复原已证**（§2.2/§2.3）⇒ 满足硬口径 ⑤ 的例外条件。 |
| 3 | 线上（生产 Vercel）终验读数 | `NOT_MEASURED` | 本单禁 `git push` ⇒ 无线上读数。 |
| 4 | Playwright `test:e2e` / `components` / `performance` / `accessibility` | `NOT_MEASURED` | 需浏览器 + 起服务；本单硬口径 = 只跑 `build` + `test:unit` + 四新门 + 七门。 |
| 5 | `AV5` 容器约束的**真 HTTP 端到端** | `NOT_MEASURED` | 应用层闸（`AV1`–`AV4`）**先拦**，须绕过应用层方可抵达容器约束（门 `E7` 已证兜底**在场**）。 |
| 6 | `p8-s3b-01-effective.ts` 的 `DB 封存`在**基线存在 AK2 行**时的 HTTP 回写支 | `NOT_MEASURED` | 现库基线**无** `listing_deposit_policy` 行 ⇒ 该支本轮不可达（`http_rewrite = {sent:false}`）。 |

---

## §11 收尾

| 项 | 现取读数 |
|---|---|
| 残留实例 | `lsof -nP -iTCP:5793-5799 -sTCP:LISTEN` = **空**（本单起的 `5796` 实例已按**精确 PID** `kill -TERM`（`38174` + npx 包装 `37784`）终止） |
| 首 `git status --porcelain` | `M`×2（`database.ts`/`index.ts` · **上轮遗留**）+ 未跟踪（`.p4/.p8s1/.p8s2/.p8s3/.p8s3b-artifacts` + 四探针） |
| 尾 `git status --porcelain` | **与首同**（`M`×2 不变 · 未跟踪仅新增本单的 `p8-s3b-02-dbstate.ts` / `p8-s3b-03-restore.ts` / `.p8s3b-artifacts/`）⇒ **本单零 tracked 文件写入** |
| 生产库终态（事务外复取） | `app_config` = 恰 `{system_settings}` · 逐字节 == 基线（`time_updated = 2026-10-02 14:14:07.502017+00`）· `listing_deposit_policy` 不存在 |
| 占位归零自证 | 本件「双下划线占位模式」**现取检索计数 = 0** |

> **结论**：`tsc` / 离线 126 / `p8-s1..s3b` / `build` / `test:unit` / 七门 **全绿**；生产库**已复原到逐字节基线**（自曝漂移事件已修复并对拍）；`S2` 期望已修 + 四段探针 **41/41 全绿**；仓外副本**三处判负 + 复原回绿**；主仓**零写入**。
