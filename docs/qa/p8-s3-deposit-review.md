# 批 8 第三片 8③ 终审质检（**Neng · 独立复跑**）—— 上市保证金「金额可配置」`AK2`

> **被检代码面** = **`4333623`**（`a7f932ea4613f18ad450a9cc4e559fd17fde3ed7` 仅补 artifacts/探针 · **非产品代码** · 已逐文件核 `git diff --name-only 4333623 a7f932e` = 4 文件全在 `.p8s2-artifacts/` 与 `scripts/p8-s3-00*probe.ts`）。
> **质检角色** = **Neng**（独立第三方）。**不采信**交付方/派单方的任何转引：> 本件每一条读数均为**本单现取**（命令 + 退出码 + 读数逐条给出）。
> **固定副本** = `git worktree add --detach <scratch>/qa8s3 4333623` + `node_modules` ×2 软链 + `backend-ts/.env.local` 软链（**未读 / 未打印其内容**）。
> **硬口径自证**：**生产库零写**（一切「写」在**同一** `withTransaction` 内 + 末尾哨兵 ⇒ `ROLLBACK`，**无 `COMMIT`**；**未跑任何 HTTP 写**：`POST /api/admin/settings` / `POST /api/currency/:cid/list` 一次都没跑）；**未**改被检代码（变异只在**仓外副本**且已复原）；**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**启停 5787/5788；**未**写 `listing_deposit_policy` 之外的键；本单**只写** `docs/qa/**` 与自己产物。
> **占位归零**：本件「双下划线占位模式」计数 = **0**（回填后现取检索该模式 ⇒ 0）。

---

## §0 锚 + 环境（现取）

| 项 | 命令 | 现取读数 |
|---|---|---|
| 钉 rev | `git rev-parse 4333623` | `4333623a609a214452bedbc7a932dc14338ff8d2` |
| `a7f932e` 差值面 | `git diff --name-only 4333623 a7f932e` | 4 文件：`.p8s2-artifacts/**` ×2 + `scripts/p8-s3-00-probe.ts` + `scripts/p8-s3-00b-probe.ts` ⇒ **非产品代码** ✓ |
| 主工作区 HEAD（质检期） | `git rev-parse HEAD` | `a7f932ea4613f18ad450a9cc4e559fd17fde3ed7` |
| 固定副本 | `git worktree add --detach <scratch>/qa8s3 4333623` | `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa8s3`（`backend-ts/node_modules` / `frontend/node_modules` / `backend-ts/.env.local` 三条软链） |
| 时点 | `date "+%Y-%m-%d %H:%M:%S %Z"` | `2026-10-02 23:32 CST`（开工） |
| 产物目录 | `backend-ts/.p8s3qa-artifacts/` | run-tagged `.json` / `.out`（**无 `.log`**） |

**自写探针（本单核心 · 不 import / 不抄交付方 `p8-s3-01-effective.ts`）**：
- `worktree/backend-ts/scripts/qa-p8s3-99-effective.ts`（自写 · 四段 + fail-closed 负向 + nextval 边界 + 事务外逐字节反证 · **Q_AMOUNT = 73317**）
- `worktree/backend-ts/scripts/qa-p8s3-97-readonly.ts`（自写 · 纯只读守恒核）

---

## §1 L1 硬门独立复跑（**退出码管道外捕获**）

捕获方式逐字：`{ <cmd> > <out> 2>&1; echo "EXIT=$?"; }` —— **管道不参与**（不 `| tail` 吞码）。全部在**固定副本**内。

| # | 门 | 命令（副本内） | 退出码 | 现取读数 |
|---|---|---|---|---|
| 1 | 类型 | `cd backend-ts && npx tsc --noEmit` | **0** | 输出 **0 字节**（零诊断） |
| 2 | 离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | `total=126 passed=126 failed=0` ✓ |
| 3 | `p8-s1` 门 | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | **0** | `total=24 passed=24 failed=0` ✓ |
| 4 | `p8-s2` 门 | `npx ts-node --transpile-only scripts/p8-s2-fee-rebate-gate.ts` | **0** | `total=41 passed=41 failed=0` ✓ |
| 5 | **★ `p8-s3` 门** | `npx ts-node --transpile-only scripts/p8-s3-deposit-gate.ts` | **0** | **`total=45 passed=45 failed=0`** ✓（含新增负对照 `E1b`） |
| 6 | 前端构建 | `cd frontend && npm run build` | **0** | `✓ built in 1.56s`（`index-B-JvDbIk.js`） |
| 7 | 单测 | `cd frontend && npm run test:unit` | **0** | `Test Files 31 passed (31)` · `Tests 276 passed (276)` ✓ |
| 8 | **七门** | `cd frontend && node scripts/<gate>.mjs` ×7 | **全 0** | 见下 |

**七门逐门（`EXIT=0` 全部）**：`p4z-i18nviol-global` / `p6-tr2-i18n-locales` / `p4z-miscfix-links` / `p4z-feperf-safelist` / `p7a-03-errmessage-gate` / `p7b-errfallback-gate` / **`p7c-errmsg-machinecode-gate`**。
**`p7c` 逐字读数**：`链路体制 = 真链` · `总判：PASS（判负 0 必须 = 0；链=真链 / A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）` ✓

**`p8-s3` 门 `readings`（现取 · 独立重取非引交付）**：`legal_keys_code=["system_settings","listing_deposit_policy"]` · `legal_keys_spec` 同 · `ak1_fields` 9 字段 · `ak2_field_types={"amount":"number"}` · `deposit_floor_constant=50000` · **`registration_points=69`** · `registration_points_legacy_column0=69` · `envelope_fields=["create_key","idempotency_key","idempotencyKey"]`。
**`E1b`（`R-8-20` 新增负对照）现取**：`{"upgraded":70,"legacy_column0":69}` ✓（2 空格缩进注入 ⇒ 升级判据 +1；旧列 0 判据不增计）。
⇒ **L1 全绿，与交付方声明一致（此处为现取复跑，非采信）。**

---

## §2 L2 ★ 四段真生效独立重取（**自写探针** · 事务内 `ROLLBACK` · **自选金额 73317**）

`qa-p8s3-99-effective.ts` · **Q_AMOUNT = 73317**（交付方用 123456，本单刻意避开）· 非法值 `{"amount":"88888"}`（交付方用 77777）· 受控夹具 = **现库已出资正 uid 账户**（`cid=1` 最大余额者）。

**★ 两轮连跑均绿（可重跑性）**：`total=30 passed=30 failed=0`（run `…153535Z` 与 `…153553Z` 两次相同）—— 探针全部 `ROLLBACK` ⇒ 无残留夹具 ⇒ **可重复运行**。

| 段 | 判据 | 现取读数 |
|---|---|---|
| ③-改前 | 业务读口（`DatabaseService.getListingDepositPolicyValue` + `resolveListingDepositFloor`） | `raw_ak2 = null` ⇒ **`{floor:50000, source:'constant'}`**（**AK2 不在生产库** ⇒ fail-closed 到常量）✓ |
| ① 写键 | 事务内 DB 直写 `app_config`（**HTTP 写面 = NOT_MEASURED**） | `rows=1` · `RETURNING "{\"amount\": 73317}"` ✓ |
| ② 库内落值 | `Q2-landed-eq-new` / `Q2-write-not-lost`（**「写成功但库值未变 ⇒ 判负」**）/ `Q2-keys-2` | 落值 `{"amount": 73317}` · 顶层键集恰 2 键 `["listing_deposit_policy","system_settings"]` ✓ |
| ③-改后 | 同锚 | `raw_ak2 = {amount:73317}` ⇒ **`{floor:73317, source:'config'}`** ✓ · `parse = 73317`（不隐式转换） |
| ④-改前 | **行为随之**（`draft → listed` 同路径 DB 函数 `listCurrencyWithDeposit(…, tx)`，`draft_cid=2100301`） | owner `1636071 → 1576071`（**−60000** = 上市费 10000 + 常量保证金 50000）；`uid=−1` `167283 → 227283`（**+60000**，**守恒**）；`listing_deposit` 分录 = `["-1:50000","970001:-50000"]`；总分录 4 条 ✓ |
| ④-改后 | 同路径（`draft_cid=2100302`） | owner `1576071 → 1492754`（**−83317** = 10000 + 73317）；`uid=−1` `227283 → 310600`（**+83317**）；分录 = `["-1:73317","970001:-73317"]`；总分录 4 条 ✓ |
| ★ 两读数 | `Q4-two-readings-differ` / `Q4-delta-computable` | `{before:{floor:50000,source:'constant',owner_decrease:60000}, after:{floor:73317,source:'config',owner_decrease:83317}}` ⇒ **`delta 23317 = 73317 − 50000`** ✓✓ |
| **fail-closed 负向** | `Q3-illegal-fail-closed` / `Q4-illegal-behavior-constant` | 写**非法**（字符串金额 `"88888"`）⇒ 读口回 **`{floor:50000, source:'constant'}`** · 行为面消耗回 **`60000`**（= 10000+50000，**不是** fail-open 到 88888）✓ |
| 每段判负**自证** | 判负自证臂 `Q2-landed` / `Q3-fail-closed` / `Q4-two-readings-differ` / `NV-ledger-12` / `NV-slog-3` / `NV-cid-0`（各带 `selfcheck` 后缀） | 谓词喂错值 6/6 `judge_fired=true`（**非假门**）✓ |

**★ 事务外复取反证（逐字节 · 只读 · 探针在第 3 次调用前 `setTimeout 500ms`）**：

| 面 | 判据 | 基线 ⇄ 回滚后 |
|---|---|---|
| `app_config` | 行集（key/value/updated_by/time_updated）**逐字节**同基线 | `rows_identical = true` ✓ |
| `currency` | `n` / `max_cid` / 逐行摘要 | `n=15` · `mx=36` · `dg=692b67e77b7200cabb3bae49132bcea2` ⇄ 同 ✓ |
| `ledger_entry` | `n` / `max_txid` / 逐行摘要 | `n=355` · `mx=366` · `dg=f92c5406c8424ff50994d2ba6de81545` ⇄ 同 ✓ |
| `account` | `n` / 余额·冻结·version 摘要 | `n=39` · `dg=98bcfeea69807ba05961c474caef17a9` ⇄ 同 ✓ |
| `currency_status_log` | `n` / `max_log_id` | `n=7` · `ml=7` ⇄ 同 ✓ |
| 时间戳 | `max(time_updated)` / `max(time_created)` / `max(listed_at)` **未前移** | 全 true ✓ |

**★ 事务外独立只读复核（第三个读数 · 与探针无关）**：`qa-p8s3-97-readonly.ts`（纯 SELECT）现取 ⇒ **`app_config` 仍恰 1 行（`system_settings`，AK2 未泄入生产库）** · `currency 15/36/692b67…` · `ledger_entry 355/366/f92c54…` · `account 39/98bcfee…` · `status_log 7/7` —— **与报告 §2.5 + 交付产物 + 我的探针基线三方一致** ✓

### §2.6 ★ nextval 边界（独立判明：哪些序列前进 / 哪些未动）

| 序列 | 我的 run 前 → 后 | 前进量 | 表内 `max`（对照） | 判定 |
|---|---|---|---|---|
| `ledger_entry_txid_seq` | `378 → 390` | **+12** | `max_txid = 366` | **前进 +12**（3 次同路径上市 × 4 分录 = 12 次 `nextval`）✓ |
| `currency_status_log_log_id_seq` | `10 → 13` | **+3** | `max_log_id = 7` | **前进 +3**（3 次 `draft` 插入）✓ |
| `currency_cid_seq` | `36 → 36` | **0（未动）** | `max_cid = 36` | **未动**（探针显式给 cid ⇒ 不走序列）✓ |

**独立归因（非引交付）**：本单共跑探针 **4 次**（2 次初测 + 2 次带自证），末尾只读复核现取 `ledger_entry_txid_seq = 426` / `currency_status_log_log_id_seq = 22` / `currency_cid_seq = 36` ⇒ `378 + 4×12 = 426` ✓ / `10 + 4×3 = 22` ✓ / `36 + 0 = 36` ✓ —— **每跑 +12 / +3 / 未动** 与表内 `max` 的缺口逐值自洽。
> **判定**：`nextval` **非事务性**，`ROLLBACK` 不回收 ⇒ 序列前进是「事务内造数 + 回滚」的**固有代价**（无表行 / 无余额 / 无分录落库 ⇒ **不构成数据泄漏**）。交付方报的 `+12 / +3 / 未动` **独立复现成立**。

---

## §3 L3 ★ `R-8-20`「旧绿新红」独立复现（**仓外副本**）

**副本** = `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa8s3-falsify/base`（**主仓树外** · 从固定副本 rsync `backend-ts/{src,scripts,migrations,...}` + `docs/{data-layer,route-layer}.spec.md` + `node_modules` 软链）。**主仓零写入**。

| 步 | 动作 | 命令 | 现取读数 |
|---|---|---|---|
| 0 | 副本基线忠实 | `npx ts-node --transpile-only scripts/p8-s3-deposit-gate.ts` | `EXIT=0` · **`total=45 passed=45 failed=0`** ⇒ 副本可复现主仓绿基线 ✓ |
| 1 | **插入一条带 2 空格缩进的真路由**（`src/index.ts` · `app.listen` **前**） | `  app.get('/api/currency/:cid/delist-refund', …)` | md5 变更 `3cf5f00a…` → 变异态 |
| 2 | **升级后门跑变异副本** | 同门 | **`EXIT=1`** · `total=45 passed=42 failed=3` · **逐字红点**：`RED E1 actual="70"` · **`RED E2 actual="true"`** · `RED E1b actual="{\"upgraded\":71,\"legacy_column0\":69}"` ⇒ **E1/E2 点亮** ✓ |
| 3 | **同一副本上另跑「旧形态判据（列 0 计数）」** | 直接对变异文件复算 | **`{"upgraded_count":70,"legacy_column0_count":69,"old_delist_detect":false,"new_delist_detect":true}`** ⇒ **旧判据对该注入仍读 69（=`v4` 盲区复现）**；旧 delist 探测 **false**（盲）✓ |
| 4 | **复原回绿** | 还原 `index.ts`（md5 回 `3cf5f00ad112297e1c40a5475252cfa2`）→ 复跑门 | **`EXIT=0`** · **`total=45 passed=45 failed=0`** ✓ |

> **自证结论**：**同一变异**在**旧形态判据**下读 `69`（假绿）、在**升级后判据**下读 `70`（红）⇒ **升级真的换了强度，不是门本来就会红** ✓✓。旧门对 2 空格缩进**结构性失明**，升级后 `E1/E2` 均点亮。

---

## §4 L4 报告复核（`docs/audit/p8-s3-deposit.md`）

| 项 | 命令 | 现取读数 |
|---|---|---|
| 行数 | `wc -l docs/audit/p8-s3-deposit.md` | **266** ✓ |
| 占位（双下划线模式） | `grep -c '<双下划线>' docs/audit/p8-s3-deposit.md` | **0** ✓ |
| `p8-s2` 报告占位 | `grep -c '<双下划线>' docs/audit/p8-s2-fee-rebate.md` | **0** ✓（该件 332 行） |

**抽 6 条读数与产物 / 盘面逐字对拍**（报告 ⇄ 盘面 ⇄ 我的独立读数）：

| # | 报告条目 | 报告值 | 对拍对象 | 现取 | 判 |
|---|---|---|---|---|---|
| 1 | §2.5 `currency` 摘要 | `n=15 · max_cid=36 · 692b67e77b7200cabb3bae49132bcea2` | 我的探针基线 + `qa-readonly-final` | 同字 | ✓ |
| 2 | §2.5 `ledger_entry` 摘要 | `n=355 · max_txid=366 · f92c5406c8424ff50994d2ba6de81545` | 同上 | 同字 | ✓ |
| 3 | §2.5 `account` 摘要 | `n=39 · 98bcfeea69807ba05961c474caef17a9` | 同上 | 同字 | ✓ |
| 4 | §2.6 序列水位 | `378 / 10 / 36` | 交付 `seq-now.out`（4333623）⇄ 我的探针**改前**基线 | `378 / 10 / 36` | ✓ |
| 5 | §2 四段夹具 | `uid=970001 · balance=1636071` | 我的探针 owner | `{"uid":"970001","balance":"1636071"}` | ✓ |
| 6 | §2 交付探针判据数 | `34/34 passed` | 交付产物 `p8s3-effective-…152345Z/effective.json` | `total=34 passed=34 failed=0` · `two_readings delta=73456 = 123456−50000` | ✓ |

⇒ **报告读数与产物/盘面逐字一致，无虚报**。

---

## §5 L5 面核（逐条现取）

| 判据 | 命令 / 位置 | 现取 | 判 |
|---|---|---|---|
| `APP_CONFIG_LEGAL_KEYS` **恰 2 键** | `database.ts:54` | `['system_settings', 'listing_deposit_policy'] as const` | ✓ |
| `:42-50` 注释含 **「在册 ≠ 可写」** | `database.ts:45` | `// · ★ **「在册」≠「可写」**（§23.2 / §23.3 / `route-layer.spec` §20.6）…` | ✓ |
| 注册点仍 **69** | 我复算 `^[ \t]*app\.(get\|post\|put\|patch\|delete)\(` | `69`（门 `readings.registration_points=69` 同） | ✓ |
| 迁移仍 **23** | `ls backend-ts/migrations/*.sql \| wc -l` | `23`（门 E6 同） | ✓ |
| **类级无退还 / 罚没 / delist 面** | 自算（**去注释**口径，独立复现门 E3–E5） | `listing_deposit_refund`（全 `src` 去注释）= **0** · `hold_release`（`currency-service` 去注释）= **0** · `hold_forfeit`（`currency-service` 去注释）= **0** · `unfreeze(`（`currency-service`）= **0** · delist 路由探测 = **false** | ✓ |
| `TODO: Kevin 定值` **在场** | `currency-service.ts:147-148` | 常量声明行逐字含 `TODO: Kevin 定值` | ✓ |
| 回执含 **`floor_source`** | `currency-service.ts:193/195/205/210` | 类型签名 + 三条 return 全含 `floor_source: 'config'\|'constant'`（含 `BELOW_SERVER_FLOOR` 错误详情） | ✓ |
| `amount: 'number'` 规格在场 | `database.ts:104` | `LISTING_DEPOSIT_POLICY_FIELD_TYPES = { amount: 'number' } as const` | ✓ |

> **注**：`listing_deposit_refund` / `hold_forfeit` 在**注释**与**既有 `ledger.ts` kind 枚举**（P1c 遗留面，非上市保证金面）里有文本出现 —— 本判据口径 = **去注释的代码面 + 上市保证金面**（`currency-service` + 门 E3），与该面判定一致；已在本表登记口径，**不得读成「全域 0 命中」**。

---

## §6 L6 未验证清单 + verdict（**禁填 0 / 禁空**）

**未验证 / 未实测项（逐项原因）**：

1. **HTTP 写面 `POST /api/admin/settings`（写 `AK2`）= `NOT_MEASURED`** —— 原因：`route-layer.spec §20.6` **键级寻址线格式未冻结**（`AK2` **入册但不可写**），**无合法键寻址形态**；且**本单硬禁生产 HTTP 写**（`R-8-15/18`）。写键证据由**事务内 DB 直写**（§2 段①）承载。
2. **HTTP `POST /api/currency/:cid/list`（④ 行为面）= `NOT_MEASURED`** —— 原因：跑真 POST 会把 `draft` **永久推成 `listed`**（不可逆 · 改线上状态）；只走**事务内同路径 DB 函数**（与生产 `listCurrencyVerb` **同一份 SQL**）。**本单一次未跑**。
3. **`resolveListingDepositFloorFromDb` 的 `catch`（DB 抛错）分支 = `NOT_MEASURED`** —— 原因：事务内不便制造 DB 连接 / 查询失败。本单实测的 fail-closed 路径只两条：**读不到（`null`）** 与 **值非法**（§2）；**抛错分支**仅由源码 `try/catch` 静态保证（`currency-service.ts:170-177`）。
4. **`amount` 正整数的上界（`Number.MAX_SAFE_INTEGER` 邻域）= `NOT_MEASURED`** —— 原因：探针取值只覆盖 `73317` / `"88888"` / 各非法形态，**未逐值取材**上界；行为由 `Number.isSafeInteger` 静态保证（`database.ts` `parseListingDepositPolicyAmount`）。
5. **退还 / 罚没 / `delist` 面「不存在」= 非「实测为 0」** —— 原因：`R-8-17` **禁实现**该面（射程收缩为 (a) 金额可配置）。其「不存在」由**门 E2–E5 的零命中判据** + **本单 §3 副本变异自证**承载，**不是**运行时实测计数。
6. **前端面 = `NOT_MEASURED`** —— 原因：本片**零前端改动**（无页面 / 无四语键 / 无路由），不适用。
7. **交付方探针 `p8-s3-01-effective.ts` = 未跑**（**刻意**）—— 原因：本单要求**自写探针**独立重取，不采信交付方读数；其产物仅用于 §4 第 6 条对拍。
8. **受控实例 5796/5797 = 未启**（`NOT_MEASURED`）—— 原因：本片**无 HTTP 面可测**（两写面禁令 + 无前端改动）⇒ 无需起实例；`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` 全程空读（见 §7）。

**verdict**：

- **L1 硬门**：`tsc 0` / 离线 **126/126** / `p8-s1 24/24` / `p8-s2 41/41` / **`p8-s3 45/45`** / `build 0` / `test:unit 31 files·276 passed` / **七门全 0（`p7c` = 真链）** ⇒ **全绿** ✓
- **L2 四段真生效**：**自写探针 30/30 × 2 跑**；改前 `{50000,constant}` 消耗 60000 ⇄ 改后 `{73317,config}` 消耗 83317，**delta 23317 逐值可算**；fail-closed 负向 ✓；事务外**逐字节反证 + 时间戳未前移** ✓；**nextval 独立判明 +12/+3/未动** ✓ ⇒ **成立**
- **L3 `R-8-20` 旧绿新红**：变异副本**升级红 / 旧形 69 假绿**、复原回绿 45/45 ⇒ **独立复现成立** ✓
- **L4 报告复核**：266 行 / 占位 0 / 抽 6 条逐字对拍一致 / `p8-s2` 占位 0 ⇒ **成立** ✓
- **L5 面核**：2 键 / 「在册≠可写」/ 69 / 23 / 类级零命中 / `TODO` / `floor_source` / `amount:'number'` ⇒ **全在场** ✓
- **L6 未验证清单**：8 条（上）**均已逐项给原因**（无填 0 / 无空）。
- **总 verdict**：**8③ 独立终审质检 = 通过（PASS）**。所有硬门与四段真生效读数**由本单现取独立复现**，与交付方声明一致；无生产库写外泄（`app_config` 仍恰 1 行，`currency/ledger/account` 摘要逐字节同基线）。

---

## §7 收尾自证（blob 对拍 + 端口空 + 首尾 `git status`）

**① 固定副本逐文件 blob 对拍（现取）**：`git ls-files` = **2367** 项；其中**普通文件 2366** 项 —— 逐文件 `git hash-object <f>` ⇄ `git rev-parse 4333623:<f>` ⇒ **0 MISMATCH**；余 1 项为**符号链接条目**（`120000` · `backend-ts/.p4-artifacts/sec-20260930T012048+0800/failfast/node_modules`），其 blob `4b33369f43e07d2eacf20fd21dd5a6d0ee4807a8` 与 `git ls-tree 4333623` 记录**逐字相同**。
产品代码面 4 + 报告 1 关键文件逐字对拍（全 **OK**）：

| 文件 | blob（= `4333623:<path>`） |
|---|---|
| `backend-ts/src/database.ts` | `01285036c2c6817f2556af3e0f6d98edeeae3494` |
| `backend-ts/src/currency-service.ts` | `bb422d244c2841188df182be45dfafde49916671` |
| `backend-ts/scripts/p8-s1-app-config-gate.ts` | `56e4abb32d45ea7338beb6d66ae106b70395d841` |
| `backend-ts/scripts/p8-s3-deposit-gate.ts` | `56d555afebdfff9535f1a4af870c7ebcc5f5b446` |
| `docs/audit/p8-s3-deposit.md` | `2b74b5cee28f85924d66ba8de81c8c4b8539220f` |

⇒ **被检代码面零改动**（我在副本内只**新增**自写探针，未触碰任何被跟踪文件；`git status --porcelain | grep -v '^??'` = **0 行**）。

**② 副本回收**：`git worktree remove --force <scratch>/qa8s3` ⇒ **removed**；`rm -rf <scratch>/qa8s3-falsify` ⇒ **removed**；`ls <scratch> | grep qa8s3` ⇒ **无残留**；`git worktree list` 仅余既有 worktree（`p7d-neg` / `qa-p7a-*` / `qa-p7b`）。

**③ 端口 / 进程**：

| 项 | 命令 | 现取 |
|---|---|---|
| 受控端口 | `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` | **空读数**（退出码 **1** · 0 行）✓（本单**未启实例** · 无 HTTP 面可测） |
| 5787 / 5788 | `lsof -nP -iTCP:5787,5788 -sTCP:LISTEN` | **未碰**（现取仍由外部 PID `30475`（`[::1]:5787`）/ `65096`（`*:5788`）持有）✓ |

**④ `git status --porcelain`（主工作区 · 首 ⇄ 尾）**：

| | 首（开工） | 尾（收尾） | 差 |
|---|---|---|---|
| 新增未跟踪 | `?? backend-ts/.p8s3qa-artifacts/` · `?? docs/qa/p8-s3-deposit-review.md` | 同 | **0** |

```text
?? backend-ts/.p8s3qa-artifacts/
?? docs/qa/p8-s3-deposit-review.md
```

⇒ **首尾一致**；**未** `git add/commit/push`；**未**改被检代码 / 规范册 / `master-plan` / `versions/**` / 既有 `docs/audit/**`（只**读**）；**未**启停 5787/5788；**未** `pkill -f` / `killall`。

---

## §8 产物清单（`backend-ts/.p8s3qa-artifacts/` · run-tagged · **无 `.log`**）

| 文件 | 内容 |
|---|---|
| `qa-effective.out` · `qa-effective-run2.out` · `qa-effective-final-run1.out` · `qa-effective-final-run2.out` | 自写四段探针 SUMMARY（最终 **30/30 × 2**） |
| `p8s3qa-effective-<RUN>/effective.json`（4 个 run 目录 · 在副本内随 worktree 回收；末次读数已在本件 §2 逐条登记） | 四段 + fail-closed + nextval + 回滚反证原始读数 |
| `qa-readonly-final.out` | 独立只读守恒核（第三读数） |
| `qa-tsc-noemit.out`（0 字节）· `qa-offline.out` · `qa-p8s1.out` · `qa-p8s2.out` · `qa-p8s3.out` | L1 硬门输出 |
| `qa-fe-build.out` · `qa-fe-testunit.out` | 前端 `build` / `test:unit` 输出 |
| `qa-sevengate-*.out` ×7 | 七门逐门输出 |
| `qa-l3-copy-baseline.out` · `qa-l3-mutated.out` · `qa-l3-mutated-gate.json` · `qa-l3-restored.out` | L3 副本四步（基线 45/45 · 变异红 · 门产物 · 复原 45/45） |
| `probes/qa-p8s3-99-effective.source.txt` · `probes/qa-p8s3-97-readonly.source.txt` | 自写探针源码快照（`.txt`） |

**`find <ART> -name '*.log' | wc -l` = 0** ✓（无 `.log` 后缀）。

