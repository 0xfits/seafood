# 8① `app_config` 写入门禁 + 两册 spec 终审质检（Neng 独立复跑）

- 被检面（钉死）：`b4d0d5d`（`git worktree add --detach <scratch>/qa8s1 b4d0d5d`）
- 主工作区 HEAD：`ed5c07b`（收口单）
- 受控实例：`5796`（链 `.env.local`，仅 5796/5797，禁用 5787/5788）
- 硬口径：不改被检代码（变异只在仓外副本内且复原）；不 `git add/commit/push`；不 `npm install`；不碰/打印 `.env*`；禁 `pkill -f`/`killall`；不写 `listing_deposit_policy`；原产不用 `.log`。

---

## L0 固定副本与基线

**现取命令与读数**（工作目录 = 主仓 `/Users/kevin/bistro/seafood`，副本 = `$S/qa8s1`，`$S=/Users/kevin/.hermes/profiles/zang/cache/scratch`）：

```
git worktree add --detach $S/qa8s1 b4d0d5d
  ⇒ Preparing worktree (detached HEAD b4d0d5d)
    HEAD is now at b4d0d5d feat(b8-1): app_config 写入门禁 AG1-AG4 …
ln -s /Users/kevin/bistro/seafood/backend-ts/node_modules $S/qa8s1/backend-ts/node_modules
ln -s /Users/kevin/bistro/seafood/frontend/node_modules     $S/qa8s1/frontend/node_modules
ln -s /Users/kevin/bistro/seafood/backend-ts/.env.local     $S/qa8s1/backend-ts/.env.local
```

- 三件符号链接就位（`ls -la` 三条 `-> ` 指主仓；**未打印其内容**）。
- 副本 `git status --porcelain` 仅 `?? backend-ts/node_modules` / `?? frontend/node_modules`（符号链接未被 ignore）⇒ **tracked 面零改动**。
- 主仓 HEAD = `ed5c07b`（收口单），被检面 = `b4d0d5d`（副本 HEAD 现取 = `b4d0d5d`）。
- 被检提交 `b4d0d5d` 统计（`git show --stat`）：**25 files changed, 12753 insertions(+), 15 deletions(-)**；其中两册 spec `docs/data-layer.spec.md | 114 +`、`docs/route-layer.spec.md | 223 +`（**删除列 0**），快照两件各 `1288 +` / `4253 +`。
- 实例受控端口 **5796**；5787/5788 **未碰**（现取 `lsof -iTCP:5787-5788 -sTCP:LISTEN` = 主仓既有 `node 30475 / 65096`，非本单产物）。

## L1 硬门独立复跑（退出码管道外捕获）

全部在**副本内**（`$S/qa8s1`），退出码在管道**外**捕获（`cmd > f 2>&1; echo EXIT=$?`）。产物：`backend-ts/.p8s1qa-artifacts/l1-<RUN>/`。

| # | 门 | 命令 | 退出码 | 读数（现取） |
|---|---|---|---|---|
| 1 | 后端类型 | `npx tsc --noEmit` | **0** | **0 行**（`wc -l` = 0） |
| 2 | 离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | **`total=126 passed=126 failed=0`**（产物 `p6tr1a-20261002T141242Z`） |
| 3 | ★ 新门 | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | **0** | **`total=24 passed=24 failed=0`**（产物 `p8s1-20261002T141242Z`） |
| 4 | 前端 build | `npm run build` | **0** | `✓ 1783 modules transformed.` / `✓ built in 1.49s` |
| 5 | 前端单测 | `npm run test:unit` | **0** | **`Test Files 31 passed (31)` · `Tests 276 passed (276)`** |

**七门（`frontend/scripts/*.mjs`，逐门退出码）——全部 EXIT=0**：

| 门 | EXIT | 总判读数（逐字摘要） |
|---|---|---|
| `p4z-i18nviol-global` | 0 | `总判：PASS`（locale 裸命中 0 / source 裸命中 0；节点 locale=2980 / source=37） |
| `p6-tr2-i18n-locales` | 0 | `新接文件守卫=PASS` / `总判：PASS` |
| `p4z-miscfix-links` | 0 | `总判：PASS（残留全部已登记）` |
| `p4z-feperf-safelist`（**先 build 再跑**，见 #4） | 0 | `VERDICT=PASS` |
| `p7a-03-errmessage-gate` | 0 | `总判：PASS`（扫描文件 77 / 受体 6 / 命中 0 / 基线 0） |
| `p7b-errfallback-gate` | 0 | `总判：PASS`（A=PASS / B 含裸键值=0 / C 兜底键=2×4 / D 节点=132 已本地化=132 / G 键不可用=0/132） |
| `p7c-errmsg-machinecode-gate` | 0 | **`链路体制 = 真链`** / `总判：PASS`（链=真链 / A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 / E 样本=19） |

⇒ **L1 = 全绿**，与交付方口径（`tsc` 0 / 离线 126/126 / 新门 24/24 / build 0 / 31 files 276 passed / 七门 PASS）**逐项一致**。

## L2 独立重取门禁真行为（自起 5796 + 自有探针）

**自起受控实例**：`cd $S/qa8s1/backend-ts && PORT=5796 npx ts-node --transpile-only src/index.ts`（链**副本内 `.env.local`** 符号链接；`src/env.ts` 按 \_\_dirname（模块目录变量）解析 `.env.local`）。就绪读数：`TypeScript backend running on port 5796` / `Using Neon PostgreSQL for Seafood API routes`；`lsof -iTCP:5796 -sTCP:LISTEN` ⇒ 精确 PID **88893**。

**★ 自有探针**（**不采信交付方 `p8-s1-01-e2e.ts`**）：`$S/qa8s1/backend-ts/scripts/p8s1qa-l2-probe.ts`（我新写，非仓内 tracked 件）。命令：`P8S1QA_BASE=http://127.0.0.1:5796 npx ts-node --transpile-only scripts/p8s1qa-l2-probe.ts` ⇒ **`SUMMARY total=33 passed=33 failed=0`**（`L2_EXIT=0`）。基线：`app_config` 行数 **1**（键 = `system_settings`，值 9 字段闭合），`GET /api/admin/settings` ⇒ 200。

### L2-a 合法键 `system_settings` 写入 ⇒ 200 + 前后对拍 + 读口同值 + 恢复原值

- 请求：`POST /api/admin/settings`，体 = `{…原值, siteDescription: "p8s1qa-20261002T141357Z", create_key: "ops:1:setting:system_settings"}`，token = 真 admin uid **1**。
- **逐字响应体**（200）：`{"success":true,"message":"System settings saved","data":{"siteName":"p4b2c:siteA","siteDescription":"p8s1qa-20261002T141357Z","maintenance":false,"allowRegistration":true,"emailNotifications":true,"defaultLanguage":"zh","pointsPerTask":100,"maxDailyTasks":10,"rewardCooldown":24}}`
- **库内对拍**：`value.siteDescription` = marker ✓；`updated_by` = `1`（= 真 admin uid）✓；`time_updated` 前移（before `2026-10-02 14:08:34.829285+00` → after 不同值）✓。
- **读口回包同值**：`GET /api/admin/settings` ⇒ 200，`data.siteDescription` = marker = 库内值 ✓（键数 9）。
- **★ 末尾恢复原值**：写回 `original` ⇒ 200，`{...restored}` 与原值 **JSON 逐字相等**（`value_equal=true`，`siteDescription` 回 `去中心化社区奖励平台`）✓。

### L2-b 未知键 ⇒ 400 逐字（稳定 reason 常量 + unknown_keys）

两个**自造且互异**的未知键（`qa8s1UnknownAlpha` / `qa8s1UnknownBeta`；**均不命中费率类黑名单** `fee_?rate|rate_?bp|commission_?*|费率|佣金`）。

- **键①逐字体**（400）：`{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"Unknown key(s) are not writable via /api/admin/settings","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"qa8s1UnknownAlpha","reason":"SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST","unknown_keys":["qa8s1UnknownAlpha"],"legal_keys":["siteName","siteDescription","maintenance","allowRegistration","emailNotifications","defaultLanguage","pointsPerTask","maxDailyTasks","rewardCooldown"]}}}`
- **键②逐字体**（400，体为 `{qa8s1UnknownBeta:2, siteName:"QA-NEG", …}`）：`…"field":"qa8s1UnknownBeta","reason":"SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST","unknown_keys":["qa8s1UnknownBeta"]…`（**已知键 `siteName` 未落库** ⇒ 整请求拒）。
- **逐字校验**：`code` = **`LEDGER_AMOUNT_INVALID`** ✓；`details.reason` = **`SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST`**（★ **稳定常量**，两键驱动逐字相同）✓；`unknown_keys` 逐个列出且**两键不同** ✓。
- **★ R-8-10 判据**：`reason_1 === reason_2 === "SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST"` ⇒ **byte_identical = true**，而 `unknown_keys` 分别 `["qa8s1UnknownAlpha"]` / `["qa8s1UnknownBeta"]` ⇒ **不同** ✓。
- **R107 形状逐字**：顶层键恰 `["error"]`（长度 1）；`error` 键集恰 `["code","details","i18n_key","message"]` ✓。

### L2-c 类型不符 ⇒ 400 + reason 常量 + field/expected/got

- 请求：`POST /api/admin/settings`，体 `{pointsPerTask:"abc", create_key:…}`。
- **逐字体**（400）：`{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"Setting field type is invalid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"pointsPerTask","reason":"SETTING_TYPE_INVALID","expected":"number","got":"string"}}}`
- 校验：`code`=`LEDGER_AMOUNT_INVALID` ✓；`reason`=`SETTING_TYPE_INVALID`（稳定常量）✓；`field/expected/got` = `pointsPerTask/number/string` ✓。

### L2-d 非 object（数组体）⇒ 400 + `SETTING_VALUE_NOT_OBJECT`

- 请求：`POST /api/admin/settings`，体 `[1,2]`（幂等键走 `Idempotency-Key` 头）。
- **逐字体**（400）：`{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"Setting value must be a JSON object","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"value","reason":"SETTING_VALUE_NOT_OBJECT","expected":"object","got":"array"}}}`
- 校验：`code`=`LEDGER_AMOUNT_INVALID` ✓；`details.reason` = **`SETTING_VALUE_NOT_OBJECT`** ✓；`got`=`array` ✓。

### L2-e 库行零污染（每次拒绝后逐字对拍）

对 `public.app_config` **全表全列**取规范化串（`key/value/updated_by/time_updated`，`ORDER BY key`），在每次拒绝**前后**对拍：

| 对拍点 | 结果 |
|---|---|
| 拒绝前基线 vs 未知键①拒绝后 | **逐字相同（true）** |
| 未知键①拒绝后 vs 未知键②拒绝后 | **逐字相同（true）** |
| 基线 vs 类型不符拒绝后 | **逐字相同（true）** |
| 类型不符拒绝后 vs 数组体拒绝后 | **逐字相同（true）** |

⇒ (b)(c)(d) 每一次拒绝后，`app_config` 行**逐字与拒绝前相同** ✓。

### L2-f 服务层直调不得静默吸收

- 直调 `DatabaseService.saveSystemSettings({qa8s1UnknownAlpha:1}, 1)`（**绕路由**）⇒ **抛** `SystemSettingsWriteError`（`threw=true`），`details.reason` = `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST`，`unknown_keys=["qa8s1UnknownAlpha"]` ✓；调用前后 `app_config` 全表串 **逐字相同（zero_pollution=true）** ✓。

### L2 收尾（精确 PID kill + 端口空）

```
LISTEN_PID = 88893（lsof -t），parent = 88861（npm exec 包装）
kill -TERM 88893  ⇒ exit 0
kill -TERM 88861  ⇒ exit 1（父随子已退）
lsof -nP -iTCP:5796-5799 -sTCP:LISTEN  ⇒ 无输出（PORT_EXIT=1 = 空）
ps -p 88893,88861  ⇒ 仅表头（进程不存在）
```
⇒ **5796–5799 全空** ✓；5787/5788 未触碰 ✓。

## L3 两处判负独立重跑（仓外副本内，复原回绿）

**副本纪律**：两处变异均在**本单仓外副本**（`$S/qa8s1`，被检面 `b4d0d5d`）内落地，**未写入主仓**；变异前先存原件（`l3-20261002T141236Z/{database.ts,admin-service.ts}.orig`）并记基线 sha（`l3-20261002T141236Z/baseline.sha256`）。门退出码一律**管道外**捕获。

### L3-① 静默吸收 ⇒ 新门必红

**变异落点**（副本 `backend-ts/src/database.ts`）：把未知键判据回退为「静默吸收」——`validateSystemSettingsPatch` 的 `if (unknownKeys.length)` 分支被短路（等效 `if (false && unknownKeys.length)`）⇒ 未知键重新被 `normalizeSystemSettingsRead` 吞掉、整请求 `ok=true`。

**读数（run `20261002T141509Z`）**：**EXIT=1** · `SUMMARY total=24 passed=19 failed=5`（产物 `l3-20261002T141236Z/gate-mut-a.txt`）。**红 5 条 = C1 / C2 / C3 / E1 / E2**，逐字：

```
RED C1 AG1 | expect: ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/unknown_keys 含 foo | actual: ok=true
RED C2 AG1 | expect: ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/unknown_keys 含 deposit_amount | actual: ok=true
RED C3 AG1 | expect: ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/unknown_keys 含 listing_deposit_policy | actual: ok=true
RED E1 AG4 | expect: 合法键+未知键混合 ⇒ ok=false 且 unknown_keys=['foo']（整请求拒，合法字段不落库） | actual: ok=true
RED E2 AG4 | expect: 3 个未知键**逐键列出** | actual: ok=true
```

⇒ **门可判负**（判据真源回退静默吸收 ⇒ 必红 5 条）✓。

**复原回绿**：还原 `database.ts` 原件后重跑（run `20261002T141515Z`）⇒ **EXIT=0 · `SUMMARY total=24 passed=24 failed=0`**（`gate-restored-a.txt`）；`sha256(src/database.ts)` 回基线 **`242c518700a8d484702f395d645c58bcdef4c9824d7ce3a8bc8bf7790114c098`** ✓。

### L3-② `admin-service.ts` 注入越权写 `app_config` ⇒ 新门必红

**变异落点**（副本 `backend-ts/src/admin-service.ts`）：在该文件内注入**第二处对 `public.app_config` 的写语句**（`INSERT INTO public.app_config`）⇒ 制造 `AG2` 越权写面（写 `app_config` 的文件不再唯一、写入语句不再唯一、且不在 `saveSystemSettings` 方法体内）。

**读数（run `20261002T141523Z`）**：**EXIT=1** · `SUMMARY total=24 passed=21 failed=3`（产物 `l3-20261002T141236Z/gate-mut-b.txt`）。**红 3 条 = A1 / A2 / A3**，逐字：

```
RED A1 AG2 | expect: 写 app_config 的文件 = ['backend-ts/src/database.ts']（唯一） | actual: ["backend-ts/src/admin-service.ts","backend-ts/src/database.ts"]
RED A2 AG2 | expect: 写 app_config 的语句 = 1 处（INSERT） | actual: ["INSERT INTO public.app_config","INSERT INTO public.app_config"]
RED A3 AG2 | expect: 唯一写入语句落在 saveSystemSettings 方法体内 | actual: save=[92549,93369) hit_offset=8951
```

⇒ **越权面可判负**（注入第二个写点 ⇒ `AG2` 三判据必红）✓。

**复原回绿**：还原 `admin-service.ts` 原件后重跑（run `20261002T141530Z`）⇒ **EXIT=0 · `SUMMARY total=24 passed=24 failed=0`**（`gate-restored-b.txt`）；`sha256(src/admin-service.ts)` 回基线 **`586e8900f62d918580654ffe6a89bc4786fe874c26f5354de94a8c37f6d2912d`** ✓。

> **两处判负小结**：`EXIT=1 / 19 passed=5 failed`（红 C1/C2/C3/E1/E2）与 `EXIT=1 / 21 passed=3 failed`（红 A1/A2/A3）**均复原回绿且 sha 回基线** ⇒ 门「可判负」与「复原」双证成立，且**未污染主仓**。

## L4 报告复核（`docs/audit/p8-s1-app-config.md`）

**体量**（现取）：**370 行**（`wc -l`）/ **31790 字节**（`wc -c`）/ **占位计数 = 0**（双下划线占位模式计数 = 0）⇒ 交付报告**占位归零** ✓。

**抽 5 条读数与交付产物逐字对拍**（产物 = 副本 `.p8s1-artifacts/p8s1-20261002T140813Z/gate.json`（门）与 `.p8s1-artifacts/p8s1-e2e-20261002T140828Z/e2e.json`（真链路探针））：

| # | 报告（`docs/audit/p8-s1-app-config.md`） | 产物（逐字） | 对拍 |
|---|---|---|---|
| 1 | §0.2 #3 / §7.1：新门 = `total=24 passed=24 failed=0`；门属性 `offline: true` / `db_connections: 0` / `http_calls: 0` | `gate.json`：`total:24 passed:24 failed:0` / `offline:true` / `db_connections:0` / `http_calls:0` | **全中 ✓** |
| 2 | §6：真链路四段 = `16/16`；`RESTORE` 恢复原值 | `e2e.json`：`total:16 passed:16 failed:0`；`RESTORE.detail = {"status":200,"siteDescription":"去中心化社区奖励平台","original":"去中心化社区奖励平台"}` | **全中 ✓** |
| 3 | §7.1 C 组：C1–C3 `reason` = `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` | `gate.json` C1/C2/C3 的 `actual.reason = "SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST"`（三键 `unknown_keys` 分别 `["foo"]` / `["deposit_amount"]` / `["listing_deposit_policy"]`） | **全中 ✓** |
| 4 | §4① 报错体（`field:"foo"`，`AG1` 未知键）+ §6② 库内落值 | `e2e.json` `NEG-AG1-unknown-key` 的 `error` 与报告 §4① **逐字相等**；`②-db-landed = {"siteDescription":"p8s1-probe-20261002T140828Z","updated_by":"1","time_updated":"2026-10-02 14:08:31.833349+00"}` | **全中 ✓** |
| 5 | §6 判负 8 条：`NEG-service-layer-strict` 抛 `SystemSettingsWriteError` 且零污染；`NEG-AG1-zero-pollution` | `e2e.json`：`NEG-service-layer-strict = {"threw":true,"name":"SystemSettingsWriteError","zero_pollution":true}`；`NEG-AG1-zero-pollution = {"changed":false}` | **全中 ✓** |

⇒ **抽 5 条全中**（报告读数与交付产物逐字一致）。

**「5 条期望订正」属真订正的依据**（报告 §9 的订正表 5 行 = ① `SETTINGS_WRITE_REASONS.unknownKeySuffix` → `unknownKey` 常量；② `validateSystemSettingsPatch` 未知键 `reason` 去插值；③ 门 C1–C3 期望串改常量；④ e2e `NEG-AG1-unknown-key` 断言改常量；⑤ e2e `NEG-fee-rate-key` 候选串改常量）：

1. **「插值 reason」现取 0 命中**：`grep -c 'unknownKeySuffix' backend-ts/src/database.ts`（副本 `b4d0d5d` 现取）= **0** ⇒ 改前插值形 `'<KEY>_NOT_IN_APP_CONFIG_WHITELIST'` 的**固定后缀常量已不存在**，由 `SETTINGS_WRITE_REASONS.unknownKey = 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'`（常量）接管 ⇒ 订正 ①/② 是**已落盘的真改动**（非纸面登记）。
2. **L3-① 证明 C1–C3 / E1–E2 仍为活断言**：把判据真源回退静默吸收 ⇒ 门**必红 5 条 = C1/C2/C3/E1/E2**（见 L3-①）⇒ 订正 ③（门 C1–C3 期望串）**承重**，不是「注释级」同步；同理 e2e 两处（订正 ④/⑤）为真链路判据的承重断言。
3. ⇒ **5 条订正均为真订正**（1 处常量定义 + 1 处判据用点 + 3 处判据/探针断言同步），且**可判负、可复原**。

> **报告自曝与登记（现取）**：§10.1 登记五条（`D-2` / `D-3` / `D-4` / `O-3`（★ 真缺口：`ops:` 幂等键写死 `'system_settings'`，登记为 8② 前置）/ `O-2`）；§10.2 自曝 7 条（含 `AG3`① 裸标量经路由不可达、`AG2` 预防性不变量、费率黑名单/白名单先后不可区分等）。

## L5 两册 spec 复核（只追加 + D-1 勘误块独立核）

### L5-a 只追加（`git diff --numstat` + `difflib` 双层）

- `git diff --numstat b4d0d5d^ b4d0d5d -- docs/route-layer.spec.md docs/data-layer.spec.md` ⇒ **`223  0  docs/route-layer.spec.md`** / **`114  0  docs/data-layer.spec.md`**（**删除列 = 0**）。
- `difflib.SequenceMatcher(a=旧, b=新, autojunk=False)`（按行）：`docs/route-layer.spec.md` ⇒ opcodes = **`{equal: 6, insert: 6}`**；`docs/data-layer.spec.md` ⇒ **`{equal: 2, insert: 2}`**；**`replace = 0` / `delete = 0`** ⇒ **纯插入（只追加）**。

### L5-b 快照一致 + 旧快照零改动

- 两快照 `cmp`：`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.3.md` ⇒ **0**；`cmp docs/data-layer.spec.md docs/versions/data-layer.spec.v0.11.md` ⇒ **0**（改后正文 == 同名快照）。
- 旧快照计数（`docs/versions/` 现取）：`route-layer.spec.v*` = **23**（v0.1–v2.3，含新 `v2.3`）⇒ **旧 = 22**；`data-layer.spec.v*` = **11**（v0.1–v0.11，含新 `v0.11`）⇒ **旧 = 10** ⇒ **v0.1–v2.2 二十二 / v0.1–v0.10 十，一字未动**。

### L5-c ★ `D-1` 勘误块锚点独立核（对 **v2.2 基线** 现取）

现取对象 = `docs/versions/route-layer.spec.v2.2.md`（**4030 行**）—— `§18.5` 的现取命令基座为 v2.2 快照：

| 核项 | 命令 | 逐字读数 |
|---|---|---|
| 错引行锚 | `sed -n '3042p'` | **空行**（`blank = true`，逐字读数 = 空） |
| 节头 | `sed -n '3080p'` | `#### 12.1.1 权限闸候选：11 键逐键（**现取调用面**）+ 「无键」口径 ⇒ 选**唯一**` |
| 真实内容行 | `sed -n '3096p'` | **非空** —— 原文 = **①②③④ 枚举**（① 新迁移 → ② 真源常量 `database.ts:11-23` 加键 → ③ 前端兜底 `admin-utils.js:40-52` 加键 → ④ `0022` apply-time 自检同批改），**无**「新权限键须 4 处同批改」这一句；`:3097` = **空行** |
| 逐字原文对拍 | `§18.5(d)` 引用原文 vs 真源 `:3096` | **逐字相等**（去标记后 `len = 372 = 372`，两端恒等） |
| 三处错引命中 | `grep -n '§12.1.1:3042' docs/route-layer.spec.md` | **恰三处** = **`1798` / `3922` / `4030`**（§7 追加表 `7-63` 行内 / §17.2(a) 闭集注 / §17.8 引用关系表末行） |

⇒ **D-1 勘误块成立**：`§12.1.1` 的**节头 = `:3080`**、**真实内容 = `:3096`**（`sed -n '3042p'` 落空行 = 错锚）；三处错引行锚独立核 = `1798 / 3922 / 4030`（与 `§18.5` 自述一致）。

### L5-d 三裁定落位 + `listing_deposit_policy` **未入册**

- **`§18.2` = `R-8-7`**：8⑦ 审计台读口 = **复用 `manage_points`**；`read_users` **已排除**（跨批登记）。✓
- **`§18.3` = `R-8-8`**：8④⑤ = **确认临时复用 `review_tasks`**（附带「⑤ takedown 后续成独立动作面 ⇒ 再报 Zang 裁」）。✓
- **`§18.4` = `R-8-9`**：键名**批准** = `listing_deposit_policy`；**入册时机 = 8③ 冻结时**；**8①/8② 禁写令**。✓
- **`listing_deposit_policy` 未入册（现取）**：`docs/data-layer.spec.md` **§21.1 合法键清单仍 = 恰 1 键 `system_settings`**（`AK1` 条目行 1 处）；该候选键**不在清单**、**`AK2` 号未占用**；`§21.4` 只把候选**升格为「已批准」**并**保持**「未入册 ⇒ 写入必被拒」⇒ **`AG1` 正面用例**（本单未把它当已入册）✓。

## L6 未验证清单 + verdict

**未验证项（逐项给原因，禁填 0 / 空）**：

| # | 未验证项 | 原因（`NOT_MEASURED`） |
|---|---|---|
| 1 | **`npx tsc -p tsconfig.scripts.json`（脚本面类型门）** | **本单未复跑** —— 本单为**转录收口单**（不重跑硬门）；且脚本面 `tsconfig.scripts.json`（`include = scripts/**`）与后端主 `tsconfig`（L1#1 `npx tsc --noEmit` = 0 行）**分属两套配置**，脚本面**既有类型债**不在本单口径内 ⇒ 该面读数 `NOT_MEASURED` |
| 2 | **`D-1` 行锚在并发落盘后的重锚需求** | `D-1` 的三处错引行锚（`1798` / `3922` / `4030`）与正确锚（`:3080` / `:3096`）均为**对 v2.2 基线**现取；`docs/route-layer.spec.md` 正文在**批 8 后续单**中仍会**继续追加**（行号将漂移），且 `§18.5` **未声明版本基线** ⇒ 落盘后**须重锚**；本单**无法预测漂移量** ⇒ `NOT_MEASURED` |
| 3 | **费率黑名单 vs 白名单的先后顺序在生产面的可达性** | 两闸命中的键集**重叠**（费率键同时也是白名单外键）⇒ **任一先后都回 `400`**，在现取形态下**先后顺序不可区分**；要区分须**移除黑名单**（属「接该面的实现单」）或**构造只命中一闸的键** —— 在现行 6 条黑名单正则 + 9 字段白名单下**无此样本** ⇒ `NOT_MEASURED`；且**生产面（Vercel）未取** |
| 4 | **`app_config` 写口在「生产 Vercel 面」的行为** | 本单只在**受控实例 5796**（链 `.env.local`，真库 Neon）实测；**未部署 / 未打生产 Vercel** ⇒ 生产面（冷启动 / 连接池 / serverless 超时下的 `23514` 转译与 §14 分类器落位）`NOT_MEASURED` |
| 5 | **`AG2`「无越权写」的现取违规样本** | 属**预防性不变量**（报告 `D-2`）：现取**无可证违规** ⇒ 无样本即 `NOT_MEASURED`（**不得**当作「已证无违规」）；其判负能力已由 **L3-②**（注入即 3 红）自证 ✓ |

**verdict = PASS** —— L1 全绿；L2 **33 腿全绿**（`total=33 passed=33 failed=0`，含 `R-8-10` 稳定常量逐字与**库行零污染**）；L3 两处判负**均红**（`19/5` 红 C1/C2/C3/E1/E2、`21/3` 红 A1/A2/A3）**且复原回绿**（`24/24`、sha 回基线）；L4 **抽 5 全中**；L5 **只追加**（删除列 0 + 0 replace/delete）+ 快照 `cmp=0` + **`D-1` 锚点成立**。

## 收尾：逐文件 blob 对拍 + worktree remove

**① 副本 tracked 面逐文件对拍（钉 `b4d0d5d`）**

- 文件域：`git ls-tree -r --name-only b4d0d5d` ⇒ **2240** 个 tracked 路径；逐个 `git rev-parse b4d0d5d:<path>` 与副本索引/工作树对拍。
- 结果：`git diff-index --quiet b4d0d5d --` ⇒ **EXIT=0**；`git diff --stat b4d0d5d --` ⇒ **空** ⇒ **2240/2240 tracked blob 一致**（**副本 tracked 面零改动**）。
- **唯一需说明项**：`backend-ts/.p4-artifacts/sec-20260930T012048+0800/failfast/node_modules` 为**已入册符号链接**（mode **`120000`**，blob `4b33369f43e07d2eacf20fd21dd5a6d0ee4807a8`，指向主仓 `backend-ts/node_modules`）；副本**索引条目 == `b4d0d5d` blob**（逐字相等）⇒ **非改动**（朴素 `git hash-object <path>` 对软链会**跟随**指向目录而返回空，故以 **索引 / `diff-index`** 为准）。

**② 移除本单 worktree**

- `git worktree remove --force /Users/kevin/.hermes/profiles/zang/cache/scratch/qa8s1` ⇒ **EXIT=0**。
- 复核：`ls -d $S/qa8s1` ⇒ `No such file or directory`（**GONE**）；`git worktree list` ⇒ 仅余 `seafood`（main `7f792c7`）+ **四个非本单既有 worktree**（`p7d-neg` / `qa-p7a-09362ad` / `qa-p7a-final` / `qa-p7b`）⇒ 本单 worktree **已清**。

**③ 端口空（收尾确认）**

- `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` ⇒ **无输出**（`LSOF_EXIT=1`）⇒ **5796–5799 全空**；**5787 / 5788 本单未碰**。

**④ 主工作区 `git status --porcelain`（收尾 · 现取）**

```text
?? backend-ts/.p8s1qa-artifacts/
?? docs/qa/p8-s1-app-config-review.md
```

⇒ **仅本单两个未跟踪项**（本报告 + 本单产物），**无 `M`**、**无其它未跟踪**；主工作区 HEAD 现取 = `7f792c7`（main）。**未** `git add/commit/push`；**未** 触碰被检物（代码 / `docs/*.spec.md` / 快照 / delta / master-plan / 既有 `docs/qa/**`、`docs/audit/**`）；**未** `pkill -f`/`killall`；**未** 启停 5787/5788；**未** 碰/打印 `.env*`。

**★ 引证卫生登记（1 条 · 由派单方裁定，非本单处置）**

- `docs/route-layer.spec.md` **`§18.5`** 的现取命令 `sed -n '3042p'`（及 `:3080` / `:3096`）**只在 v2.2 基线成立**（`docs/versions/route-layer.spec.v2.2.md`），在 **v2.3 正文**（`docs/route-layer.spec.md`）**不复现**（v2.3 正文 `§12.1.1` 节头实为 **`:3136`**）；且该节**未声明版本基线** ⇒ **引证卫生缺陷**（非条文错误）。**已由派单方裁定为 `R-8-14` 登记待批**，本单**不处置**（不改被检物）。
