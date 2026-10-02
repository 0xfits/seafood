# 批 8 首片 8① 实现 —— `app_config` 合法键清单 + 写入门禁（`AG1`–`AG4`）

> **作者角色** = **Kong（实现方）** · **单别** = 批 8 首片 **8①**（`app_config` 管理 + 合法键清单 + 写入门禁）· **本件 = 8① 收口**（回填报告 + 按 `R-8-10` 改动 + 改后全量硬门复跑 + 登记）。
> **契约真源（已冻结，逐字遵守）**：`docs/data-layer.spec.md` **v0.10 §21**（`AK1` / `AG1`–`AG4` / `AT1`–`AT4`）+ `docs/route-layer.spec.md` **v2.2 §17.2 / §17.3**（权限映射 / 写口准入）。
> **本收口单的两条裁定（Zang）**：**`R-8-10`** = 报错码保持借 `LEDGER_AMOUNT_INVALID`(400)（依据 `ledger.spec §14.3` 明载借用 ⇒ 先例优先）；**但 `details.reason` 必须改为稳定常量** `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST`（不得随输入插值）+ 未知键逐个进 `details.unknown_keys`。**`R-8-11`** = `create_key` / `idempotency_key` 作信封控制字段在判定前剥离 —— **确认**（保持）。
> **硬口径自证**：本单**是** `backend-ts/src/index.ts` / `database.ts` 的唯一写者；**未 apply 任何迁移**（零迁移）；**未碰** `migrations/**`、任何 `docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`、`docs/audit/**`（除本件）；**未** `git add/commit/push`；**未** `npm install`；**未**碰/打印 `.env*`；**未**用 `pkill -f` / `killall`；**未**启停 5787/5788；受控实例只用 **5796**（链 `backend-ts/.env.local`，不打印内容），收尾按**精确 PID** `kill -TERM` + `lsof` 空读数。
> 所有读数为本单现取；未测项标 `NOT_MEASURED`（禁填 0 / 禁空）。
> **工作树旁证（非本单产物）**：`docs/data-layer.spec.md` / `docs/route-layer.spec.md` 的 `M` 与 `docs/versions/{data-layer.spec.v0.11.md,route-layer.spec.v2.3.md}` / `docs/audit/route-layer-v2.3-delta.md` 属 **Jing 的并发「规范补正」单**（两单文件面不相交），**非本单改动**。

---

## §0 开工锚（现取）+ 改后硬门读数

### 0.1 开工锚（现取 · 收口时点）

| 项 | 命令 | 现取读数 |
|---|---|---|
| 仓库 HEAD | `git rev-parse HEAD` | `ddcf4c9f531c84aa9a1eda4dc0938282d62cccc8` |
| 分支 | `git rev-parse --abbrev-ref HEAD` | `main` |
| 主工作区 `git status --short` | `git status --short` | `M`×5（本单 3：`backend-ts/src/database.ts` / `backend-ts/src/index.ts` / `frontend/src/pages/market/MarketPage.jsx`；Jing 2：两册 spec）+ 未跟踪（本单：`.p8s1-artifacts/` / 两个脚本 / 本件；Jing：`docs/versions/*` 两快照 / 一 delta） |
| 收口时点 | `date "+%Y-%m-%d %H:%M:%S %Z"` | `2026-10-02 22:09:50 CST` |

> **诚实标注**：8① **实现轮**（截断）**未回填 §0 骨架** ⇒ **开工瞬间**的 HEAD/基线门读数**未留痕**（`NOT_MEASURED`，原因 = 该轮以代码落盘与实测为主、报告仅留骨架）。本节以**收口现取**为准；硬门的**权威读数 = 0.2 改后全量复跑**。

### 0.2 ★ 改后全量硬门复跑（本收口单 · 退出码一律**管道外**捕获）

| # | 门 | 命令 | 退出码 | 读数 |
|---|---|---|---|---|
| 1 | **类型** | `cd backend-ts && npx tsc --noEmit` | **0** | 输出 **0 字节**（零诊断） |
| 2 | **离线套件** | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | **`total=126 passed=126 failed=0`** · 产物 `.p4-artifacts/p6tr1a-20261002T140813Z/offline-tests.json` |
| 3 | **★ 新门** | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | **0** | **`total=24 passed=24 failed=0`** · 产物 `.p8s1-artifacts/p8s1-20261002T140813Z/gate.json` |
| 4 | **前端构建** | `cd frontend && npm run build` | **0** | `✓ built in 1.56s`；`dist/assets/index-DkXZLFGD.js 319.33 kB`（gzip 91.50 kB） |
| 5 | **单测** | `cd frontend && npm run test:unit` | **0** | **`Test Files 31 passed (31)` · `Tests 276 passed (276)`** · Duration 4.41s |
| 6 | **七门** | `node scripts/<gate>.mjs` ×7 | **全 0** | 见下表 |

**七门逐门读数（`EXIT=0` 全部）**：

| 门 | 读数（现取摘要） |
|---|---|
| `p4z-i18nviol-global` | `总判：PASS`（`locale 裸命中 0` + `source 裸命中 0`；类级作用域 = **63** 源文件；**形态命中 = 0** / 显式豁免 **0/0** / **类级残余（活体）= 0**） |
| `p6-tr2-i18n-locales` | `总判：PASS`（`新接文件守卫=PASS`；六页逐页 `命中=0 经i18n-content=yes`） |
| `p4z-miscfix-links` | `总判：PASS（残留全部已登记）`（扫描 **77** 源文件 / 命中行 **1** / **未登记残留 = 0**） |
| `p4z-feperf-safelist` | `VERDICT=PASS`（依赖 `dist/` ⇒ 已在 #4 build 之后跑） |
| `p7a-03-errmessage-gate` | `总判：PASS`（扫描文件 **77** / 受体 **6** / **命中 0** / **基线 0**） |
| `p7b-errfallback-gate` | `总判：PASS`（`D 节点=132 需护栏=0 已本地化=132`；`G 键不可用=0/132`；`A=PASS`） |
| `p7c-errmsg-machinecode-gate` | `总判：PASS`；**★ `链路体制 = 真链`**（`D 类级违例=0/16` / `F 反例违例=0/16` / `G 机读码出现次数=0/36 违例=0`） |

> 退出码捕获方式（逐字）：`{ <cmd> > <out> 2>&1; echo "EXIT=$?"; }` —— **管道不参与**（禁 `cmd | tail` 吞码）。

---

## §1 交付物清单（本单现取）

**代码（3 件 · 唯一写者范围）**：

| 文件 | 改动 | 内容 |
|---|---|---|
| `backend-ts/src/database.ts` | `+208 −?`（净增） | §2 合法键关闭集 + 逐字段类型规格 + 信封控制字段常量 + **稳定 reason 常量** + 纯函数门禁真源（`validateSystemSettingsPatch` / `assertSystemSettingsPatch` / `screenSystemSettingsWrite`）+ `SystemSettingsWriteError`；`normalizeSystemSettings` → **读侧 `normalizeSystemSettingsRead`**（删静默吸收）+ `saveSystemSettings` 严格断言前置 |
| `backend-ts/src/index.ts` | `+55 −?` | `POST /api/admin/settings`：逐键白名单 + 类型闸（整请求拒）+ `pgConstraintOf`（读 PG 约束名、不打印原始 message）+ DB 容器 CHECK(`23514`) **转译 400** + catch 走**既有** §14 分类器 `sendInfraMapped`（改前硬编码 `sendError(400, …)`） |
| `frontend/src/pages/market/MarketPage.jsx` | `+5 −5` | **`R-7E-6`**：`localizeFields` 的 keys 收敛为 `['name','title']`（去 DB 枚举 `side`/`status`） |

**探针 / 门（2 件 · 未跟踪）**：`backend-ts/scripts/p8-s1-app-config-gate.ts`（类级门，24 判据）、`backend-ts/scripts/p8-s1-01-e2e.ts`（真链路四段探针，16 判据）。

**本件**：`docs/audit/p8-s1-app-config.md`。

**产物**：`.p8s1-artifacts/p8s1-20261002T140813Z/gate.json`（24/24）、`.p8s1-artifacts/p8s1-e2e-20261002T140828Z/e2e.json`（16/16）、`.p4-artifacts/p6tr1a-20261002T140813Z/offline-tests.json`（126/126）。

---

## §2 现取缺口与治点

**现取缺口（改前，`data-layer.spec` §21.2 立法意图逐字承接）**：写口 `POST /api/admin/settings` 是「**整块 `system_settings` 单键 upsert**」，请求体里**任何**键都被 `normalizeSystemSettings` 按白名单 9 字段**吸收**、**其余一律忽略** ⇒ **未知键 = 静默丢弃、未知键名 = 静默放行**；类型不符则 `toNumberValue` / `toBooleanValue` / `toStringValue` **强转或回落默认值**（如 `pointsPerTask:"abc"` ⇒ 静默 `100`、`maintenance:1` ⇒ 强转 `true`）⇒ 触发 `AG4` 元规则（「不得静默放行」）。

**治点（本单落点）**：
1. **写侧入口先判后写**：`screenSystemSettingsWrite(body)`（路由层）→ `validateSystemSettingsPatch`（纯函数真源）→ **不合法即 400**；
2. **服务层强断言**：`saveSystemSettings` 首行 `assertSystemSettingsPatch(input)` ⇒ **任何**调用方（含绕路由直调）都不静默吸收；
3. **读侧与写侧二分**：`normalizeSystemSettings` **改名** `normalizeSystemSettingsRead`，**仅**用于读路径与已校验写侧的终态回填；
4. **DB 兜底转译**：容器 CHECK `23514`（`app_config_value_is_container`）⇒ 项目级 `400` + 机读 `reason`（**禁裸 500**）；
5. **catch 归位**：基础设施异常交**既有** §14 分类器（R107）。

---

## §3 `AK1` 合法键清单（现取 · 关闭集）

| 层 | 现取真源 | 值（关闭集） |
|---|---|---|
| **顶层键**（`app_config.key`） | `database.ts:47` `APP_CONFIG_LEGAL_KEYS` | **恰好 1 键** = `['system_settings']` |
| **值容器** | `0017:77` 容器 CHECK（值须为 jsonb **object**） | `value` = jsonb object |
| **值内字段**（9 个，关闭集） | `database.ts:50` `SYSTEM_SETTINGS_FIELD_TYPES` | `siteName:string` / `siteDescription:string` / `maintenance:boolean` / `allowRegistration:boolean` / `emailNotifications:boolean` / `defaultLanguage:string` / `pointsPerTask:number` / `maxDailyTasks:number` / `rewardCooldown:number` |

> **键名唯一真源纪律（§21.3 规则①）**：实现 / 测试 / 探针**不得自拟键名**。门 **B3** 复算：`grep` 面 `public.app_config` 附近的 SQL 键字面量 **⊆ {'system_settings'}**（现取 = `["system_settings"]`）。
> **候选载体键**（`listing_deposit_policy`，`R-8-9` 已批准**命名**、`R-8-10` 语境下**未入册**）⇒ **本单不写入**（硬口径⑥）；它现在写入**必被 `AG1` 拒** = **fail-safe 正面用例**（门 **C3** 逐字判负）。

---

## §4 `AG1`–`AG4` 逐条实现 + **逐字报错体**

| 条目 | 实装落点 | 判据（可判负） |
|---|---|---|
| **`AG1` 未知键 ⇒ 拒** | `validateSystemSettingsPatch` ②分支（逐键过滤，`unknown_keys` 数组） | 键名不在 9 字段关闭集 ⇒ `400` |
| **`AG2` 越权面 ⇒ 拒** | 类级不变量：写 `app_config` 的语句**只允许**在 `database.ts` 的 `saveSystemSettings` | 门 **A1/A2/A3** 逐条复算 |
| **`AG3` 类型不符 ⇒ 拒** | ①容器（`isJsonbObject`）②逐字段严格比对（**无隐式转换**） | 门 **D1–D7** |
| **`AG4` 不得静默放行** | 元规则：**整请求拒**（合法键 + 未知键混合体 ⇒ 整请求 400，合法字段**不落库**） | 门 **E1/E2** + e2e 库行对拍 |

**★ 逐字报错体（`R-8-10` 改后 · 真链路现取 · run `20261002T140828Z`）**——四条门禁形态**逐字**如下（R107 形状 = `{code,i18n_key,message,details}`）：

**① `AG1` 未知键（`reason` = 稳定常量，不插值）：**
```json
{"code":"LEDGER_AMOUNT_INVALID","message":"Unknown key(s) are not writable via /api/admin/settings","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"foo","reason":"SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST","unknown_keys":["foo"],"legal_keys":["siteName","siteDescription","maintenance","allowRegistration","emailNotifications","defaultLanguage","pointsPerTask","maxDailyTasks","rewardCooldown"]}}
```

**② `AG3`① 非 object（数组体 · `got=array`）：**
```json
{"code":"LEDGER_AMOUNT_INVALID","message":"Setting value must be a JSON object","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"value","reason":"SETTING_VALUE_NOT_OBJECT","expected":"object","got":"array"}}
```

**③ `AG3`② 字段类型不符（`pointsPerTask:"abc"`）：**
```json
{"code":"LEDGER_AMOUNT_INVALID","message":"Setting field type is invalid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"pointsPerTask","reason":"SETTING_TYPE_INVALID","expected":"number","got":"string"}}
```

**④ 既有费率黑名单（保留 · 排它在前）：**
```json
{"code":"LEDGER_AMOUNT_INVALID","message":"Fee-rate keys are not writable via /api/admin/settings","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"fee_rate","reason":"FEE_RATE_KEY_NOT_IN_APP_CONFIG","authoritative_table":"commission_policy","authoritative_column":"fee_rate_bp"}}
```

> **`R-8-11` 确认（逐字写清）**：请求信封的**控制字段** `SETTINGS_CONTROL_FIELDS = ['create_key','idempotency_key','idempotencyKey']` 由 `screenSystemSettingsWrite` 在**判定前剥离** —— 它们**不是** settings 字段、**不是** `app_config` 键（由 `resolveAdminOpsKey`（`admin-service.ts:51`）消费，键形 `ops:<admin_uid>:setting:<key>`）。**保持** ✓。

---

## §5 错误码现取与选择理由 + `PENDING_ZANG`

**现取闭集**：`ledger-errors.ts` 错误码表 **33 码**（`grep -c` 表项 = **33**）；本单**零新增 / 零更换**（闭集不动）。

**选择理由（`R-8-10` 裁定 · 先例优先）**：
- **借码** = `LEDGER_AMOUNT_INVALID`（`400`）。**依据（`docs/ledger.spec.md` §14.3 `:942` 逐字现取）**：「**`LEDGER_AMOUNT_INVALID` 是历史码名，本册不新增错误码**：该码字面语义是「金额格式不正确」，自 v0.4 起被**兼用**作「**参数形状非法**」码（`cid` / `uid` / 金额 / `ref_type`·`ref_id` / 冲正守卫等入参形态问题皆借它）⇒ 靠 **`details.field` 区分是哪个参数字段**、靠 `details.reason` 区分具体形态。**§14.1 的 33 个错误码关闭集不动**」。
- **驳回** `LEDGER_UNKNOWN_KIND`：其语义 = **账务 kind 闭集**（`ledger` 领域枚举），借用会**扩大其含义** ⇒ 不采用。
- **★ `details.reason` 改为稳定常量**（本收口单实装）：`SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST`（**不随键名插值**）；理由 = `reason` 是**稳定机读面**（须**能枚举** + **能映射 i18n**），插值形 `<KEY>_...` 逐键不同 ⇒ 判据不可枚举。未知键**逐个**进 `details.unknown_keys`（数组）✓。
- `AG3`① 非 object 的 reason **保持**稳定常量形 `SETTING_VALUE_NOT_OBJECT` ✓。

**`PENDING_ZANG`**：**无**（原「错误码取既有闭集无合适码 ⇒ 停报我裁」一事，已由 `R-8-10` 裁定收口 = 借 `LEDGER_AMOUNT_INVALID`(400)）。

---

## §6 真链路生效**四段读数**（16/16 · 真库 · run `20261002T140828Z`）

受控实例 = **5796**（链 `backend-ts/.env.local`，**不打印内容**）；真库 = Neon（`Using Neon PostgreSQL for Seafood API routes`）。**四段** = ①后台写 → ②库内落值 → ③业务读口取数 → ④行为随之。

| # | 段 | 判据 | 逐段读数（现取） |
|---|---|---|---|
| S0 | 权限 | `can_access_admin === true` | `{"status":200,"can_access_admin":true}` |
| ① | **后台写**（合法键） | `POST /api/admin/settings` ⇒ 200 且回读同值 | `{"status":200,"siteDescription":"p8s1-probe-20261002T140828Z"}` |
| ② | **库内落值** | 直读 `public.app_config`：值与 `updated_by` | `{"siteDescription":"p8s1-probe-20261002T140828Z","updated_by":"1","time_updated":"2026-10-02 14:08:31.833349+00"}` |
| ③ | **业务读口取数** | `GET /api/admin/settings` ⇒ 同值 + 9 键 | `{"status":200,"siteDescription":"p8s1-probe-20261002T140828Z","keys":9}` |
| ④ | **行为随之** | 读回同值（读口 == 库） | `{"read_back":"p8s1-probe-20261002T140828Z","db":"p8s1-probe-20261002T140828Z"}` |
| ④ | **时间前移** | `time_updated` 真前移 | `{"before":"2026-10-02 14:04:34.283646+00","after":"2026-10-02 14:08:31.833349+00"}` |

**基线（改前）**：`{"get_status":200,"data_keys":[9 键],"db_row_keys":["system_settings"],"db_rows":1,"siteDescription":"去中心化社区奖励平台","time_updated":"2026-10-02 14:04:34.283646+00"}`。

**判负 8 条（同 run · 全 pass）**：

| 判负 | 判据 | 读数 |
|---|---|---|
| `NEG-AG1-unknown-key` | 400 + `reason`=常量 + `unknown_keys` 含 `foo` | 400 ✓（`reason:"SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST"`） |
| `NEG-AG1-zero-pollution` | 拒后**库内零污染**（行前后对拍） | `{"changed":false}` |
| `NEG-AG4-mixed-whole-reject` | `{siteName:"HACK",foo:1}` ⇒ **整请求拒** | `{"status":400}` |
| `NEG-AG3-type` | `{pointsPerTask:"abc"}` ⇒ 400 + `SETTING_TYPE_INVALID` | ✓（`field:pointsPerTask`/`got:string`） |
| `NEG-AG3-not-object` | 数组体 ⇒ 400 + `SETTING_VALUE_NOT_OBJECT`/`got=array` | ✓ |
| `NEG-fee-rate-key` | `{fee_rate:5}` ⇒ 400（既有黑名单，保留） | ✓（`FEE_RATE_KEY_NOT_IN_APP_CONFIG`） |
| `R107-shape` | 顶层键恰 `["error"]`；error 键恰 `["code","details","i18n_key","message"]` | ✓ |
| `NEG-service-layer-strict` | 绕路由直调 `saveSystemSettings({foo:1})` ⇒ 抛 `SystemSettingsWriteError` 且零污染 | `{"threw":true,"name":"SystemSettingsWriteError","zero_pollution":true}` |
| `AG2-key-closure` | 库内 `app_config` 全行键集 = 关闭集 | `{"keys":["system_settings"]}` |
| **`RESTORE`** | **末尾已恢复原值** | `{"status":200,"siteDescription":"去中心化社区奖励平台","original":"去中心化社区奖励平台"}` —— **恢复成功** ✓ |

> 十六判据 = S0 + ① + ② + ③ + ④×2 + 判负×10 = **16/16 passed**。

---

## §7 门类级化 + 仓外副本判负（逐字）

### 7.1 类级门读数（`p8-s1-app-config-gate` = **24/24**）

**判据清单（24 条 · 现取）**：

| 组 | 条目 | 判据（判负形态 = 把判据真源改回「静默吸收」⇒ 必红） | 现取 |
|---|---|---|---|
| **A · `AG2`** | A1 / A2 / A3 | 写 `app_config` 的**文件唯一** = `database.ts`；**语句唯一** = 1 处 `INSERT`；且落在 `saveSystemSettings` **方法体内** | `["backend-ts/src/database.ts"]` / `["INSERT INTO public.app_config"]` / `save=[92580,93400) hit_offset=92980` |
| **B · `AK1`** | B1 / B2 / B3 | 顶层键恰 `['system_settings']`；值字段恰 9 个（逐字冻结）；SQL 键字面量 ⊆ `{'system_settings'}` | 全等 ✓ / 9 字段全等 ✓ / `["system_settings"]` |
| **C · `AG1`** | C1 / C2 / C3 | 未知键（`foo` / `deposit_amount` / `listing_deposit_policy`）⇒ 拒 + `reason` = **常量** + `unknown_keys` 含该键 + `code='LEDGER_AMOUNT_INVALID'` | 三条全 pass（`reason="SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST"`） |
| **D · `AG3`** | D1 / D2 / D3 | 非 object：`5` ⇒ `got=number`；`['a']` ⇒ `got=array`；`null` ⇒ `got=null`（均 `SETTING_VALUE_NOT_OBJECT`） | 三条全 pass |
| **D · `AG3`** | D4–D7 | 类型不符：`pointsPerTask:"abc"` / `maintenance:1` / `siteName:42` / `maxDailyTasks:false` ⇒ `SETTING_TYPE_INVALID` + `{field,expected,got}` | 四条全 pass |
| **E · `AG4`** | E1 / E2 | 混合体（合法 + 未知）⇒ `ok=false` 且 `unknown_keys` **逐键列出**（1 键 / 3 键） | `["foo"]` / `["foo","fee_rate","bar"]` |
| **F · 正例** | F1 / F2 / F3 | 全量合法 / 部分补丁（**不补默认值**）/ 空补丁 ⇒ `ok=true` | 全 pass（`keys=9` / `{"maintenance":true}` / `ok=true`） |
| **G · 不得静默吸收** | G1 / G2 / G3 | 路由调 `screenSystemSettingsWrite(`；`saveSystemSettings` 调 `assertSystemSettingsPatch(`；旧名 `normalizeSystemSettings(` **零命中** | `true` / `true` / `[]` |

**门属性**：`offline: true` · `db_connections: 0` · `http_calls: 0`（零 DB / 零网络 / 零 HTTP）。

### 7.2 ★ 仓外副本判负（两处 · 逐字红读数）

**副本位置（仓外 · `NOT` 在仓库树内）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p8s1-falsify/<variant>/backend-ts/`（`node_modules` 软链回仓；`src` / `scripts` / `tsconfig.json` 为副本）。

**变异① · 「静默吸收」变异（把未知键判据改回静默吸收）** —— 落点：副本 `database.ts` 的 `if (unknownKeys.length)` → `if (false && unknownKeys.length)`。

读数（run `20261002T140906Z`）：**`total=24 passed=19 failed=5`** ⇒ **5 红 = C1 / C2 / C3 / E1 / E2**，逐条：
```
RED C1 AG1 | expect: ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/unknown_keys 含 foo | actual: ok=true
RED C2 AG1 | expect: ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/unknown_keys 含 deposit_amount | actual: ok=true
RED C3 AG1 | expect: ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/unknown_keys 含 listing_deposit_policy | actual: ok=true
RED E1 AG4 | expect: 合法键+未知键混合 ⇒ ok=false 且 unknown_keys=['foo']（整请求拒，合法字段不落库） | actual: ok=true
RED E2 AG4 | expect: 3 个未知键**逐键列出** | actual: ok=true
```
⇒ **门可判负**（判据真源回退 ⇒ 必红）✓。

**变异② · `AG2` 越权面注入（第二个文件写 `app_config`）** —— 落点：副本新增 `src/aaa_p8s1_neg_inject.ts`，内含 `UPDATE public.app_config SET …`。

读数（run `20261002T140918Z`）：**`total=24 passed=21 failed=3`** ⇒ **3 红 = A1 / A2 / A3**，逐条：
```
RED A1 AG2 | expect: 写 app_config 的文件 = ['backend-ts/src/database.ts']（唯一） | actual: ["backend-ts/src/aaa_p8s1_neg_inject.ts","backend-ts/src/database.ts"]
RED A2 AG2 | expect: 写 app_config 的语句 = 1 处（INSERT） | actual: ["UPDATE public.app_config","INSERT INTO public.app_config"]
RED A3 AG2 | expect: 唯一写入语句落在 saveSystemSettings 方法体内 | actual: save=[92549,93369) hit_offset=26
```
⇒ **越权面可判负** ✓。

> **副本纪律自证**：两处判负均在**仓外副本**执行，**零写入主仓**（主仓 `git status` 见 §11 · 无副本残留）；副本产物落在副本自有 `.p8s1-artifacts/` 下。

---

## §8 `R-7E-6`（A 小项）keys 收敛

**落点**：`frontend/src/pages/market/MarketPage.jsx`（`mineRows` 构造处）。

```diff
-  const mineRows = mine.rows.map((row) => localizeFields(row, ['name', 'title', 'side', 'status'], lang))
+  const mineRows = mine.rows.map((row) => localizeFields(row, ['name', 'title'], lang))
```
**理由（现取）**：`side` / `status` 是 **DB 枚举**（`open`/`filled`/`buy`…）⇒ **不得入翻译面**；它们由 `orders.statusLabel.*` / `orders.sideLabel.*` **查表渲染**，**不走** `*_<lang>` 后缀列。收敛后 keys = 用户录入文本 `['name','title']`。

**验证**：`p7c` = `链路体制 = 真链`（G `机读码出现次数=0/36`）；`p6-tr2` MarketPage `命中=0 经i18n-content=yes`；七门全 PASS ✓。

---

## §9 与既有闸的关系 + **期望订正**

**与既有闸的关系（不冲突、不取代 · 逐条）**：
1. **费率键黑名单**（`index.ts` 调 `findFeeRateKey`）：`route-layer.spec §7-16` 裁定 = **删除**；本单**保留**（删除属**接该面**的实现单，§21.5 `AT1`）。它命中的键**同时**也是白名单外键 ⇒ **无论先后一律 400 拒**（不静默放行）；本单**排它在前** = 保持既有行为（`FEE_RATE_KEY_NOT_IN_APP_CONFIG`）。
2. **`ops:` 幂等键闸**（`resolveAdminOpsKey`）：保留（`DL36`；见 §10 `O-3`）。
3. **`DL99`**（无分录的写不得造账本事件占位）：`app_config` 写**不产生任何 `ledger_entry`** ⇒ 保留。
4. **`DL36`**「无键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`」：保留。

**★ 期望订正（逐字登记 · 由 `R-8-10` 驱动）**：

| # | 面 | 改前（逐字） | 改后（逐字 · 本收口单实装） |
|---|---|---|---|
| 1 | `database.ts` `SETTINGS_WRITE_REASONS` | `unknownKeySuffix: '_NOT_IN_APP_CONFIG_WHITELIST'` | `unknownKey: 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'` |
| 2 | `validateSystemSettingsPatch` 未知键 `reason` | 插值 `` `${first}${…unknownKeySuffix}` `` | **常量** `SETTINGS_WRITE_REASONS.unknownKey`（**不插值**） |
| 3 | 门 `p8-s1-app-config-gate` C1–C3 期望串 | `ok=false/reason=${key}_NOT_IN_APP_CONFIG_WHITELIST/…` | `ok=false/reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST/…` |
| 4 | e2e 探针 `NEG-AG1-unknown-key` 断言 | `'foo_NOT_IN_APP_CONFIG_WHITELIST'` | `'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'` |
| 5 | e2e 探针 `NEG-fee-rate-key` 候选串 | `'fee_rate_NOT_IN_APP_CONFIG_WHITELIST'` | `'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'` |

> **规范侧待同步（非本单 · 已由 Zang 指派 Jing 的 `data-layer v0.11` 补正）**：`docs/data-layer.spec.md` §21.2 `AG1` 行现写 `details.reason = '<KEY>_NOT_IN_APP_CONFIG_WHITELIST'`（插值形）⇒ 与 `R-8-10`（稳定常量）**口径不一致**，**应订正**。**本单严守只读纪律，未改任何 `docs/*.spec.md`**，仅登记。
> **`side`/`status` 门读数陈旧登记无涉及**（`p4z-i18nviol-global` 的类级残余 = **0**、豁免 **0/0**）。

---

## §10 登记四条 + 自曝（口径边界 / 未测项）

### 10.1 ★ 登记四条（写入报告，**不修代码**）

| # | 项 | 现取 | 性质 / 处置 |
|---|---|---|---|
| **D-2** | `AG2` **无现取落点** | 唯一写入点 `database.ts:3075` `saveSystemSettings`；现取「无越权写」 | **预防性不变量**（**不得当作「已证违规」**）。门的 A1–A3 = **类级可判负**（变异②自证：注入即 3 红） |
| **D-3** | `AG3`① 经**唯一写口不可达** | 裸标量体被 `express.json` strict **前置拒**（非本闸）；可达形态 = **数组体 + 服务层直调** | 登记（**可达形态已实跑判负**：e2e 数组体 → `SETTING_VALUE_NOT_OBJECT`/`got=array` ✓；服务层直调 → `SystemSettingsWriteError` ✓） |
| **D-4** | `AG4` 与 `AG1` **同落点** | 混合体拒与未知键拒走**同一分支**（整请求拒） | 登记（同点、非缺陷；门 E1/E2 与 C1–C3 各自可判负） |
| **O-3（★ 真缺口）** | `ops:` 幂等键**写死** `'system_settings'` | `index.ts:1161` `resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings')` —— businessId **硬编码** | **多键写入前必修（按 key 派生）⇒ 登记为 8② 前置项**。**★ 现取加注（如实）**：`resolveAdminOpsKey`（`admin-service.ts:51`）**未强制** `provided === expected`（仅校验前缀 `ops:` / 长度 / 无 `#` / 无控制字符）；`expected` 仅出现在缺键错误体的 `details.canonical_key` 提要中 ⇒ 现取影响面 = **提要/可枚举性**，非键值放行。**仍按 Zang 口径登记为 8② 前置必修项** |
| **O-2** | 不可判定算子（「正向孤儿」） | `mint`/`burn`/`transfer` 非 admin 独占 ⇒ 算子**不可判定** | **不得进机读门**（登记）—— 本门 24 判据**不含**该算子 ✓ |

### 10.2 自曝（口径边界 / 未测项）

1. **8① 实现轮（截断）未回填 §0 骨架** ⇒ **开工瞬间**基线门读数 **`NOT_MEASURED`**（原因见 §0.1）；本件以**收口现取**为准。
2. **`AG3`① 裸标量（数字 / 字符串 / bool）经路由不可达**（`express.json` strict 前置 400）⇒ 该形态**只在纯函数门（D1/D3）与服务层直调覆盖**；**真链路只实测了数组体**（`got=array`）。**未测**：路由层裸标量形态（`NOT_MEASURED`，原因 = 传输层前置拒绝，不可达）。
3. **`AG2`「无越权写」是预防性不变量**（D-2）：现取**无可证违规样本**；判负能力靠**变异②**自证（不声称「已证违规」）。
4. **费率黑名单与白名单的先后**：本单**排黑名单在前**（保持既有行为）；两闸命中的键集**重叠**（费率键同时也是白名单外键），故**任一先后都 400**。**未测**：黑名单**移除后**的白名单单独形态（属接该面的实现单）。
5. **`reason` 稳定常量已改**，但**门/单测断言同步**只覆盖本门 C1–C3 与 e2e 两处（§9 期望订正 #3–#5）；**仓内其它面**（前端 `SystemSettings.jsx` 等）**现取无引用**该 reason 字面量（`grep` 现取 = 仅门/探针/本件）。
6. **`RESTORE` 已恢复原值**（§6），但**只改了一个展示字段**（`siteDescription`）—— **未碰** `listing_deposit_policy` 键（硬口径⑥）✓。
7. **受控实例**只起 **5796** 一个；**未启停** 5787/5788（现取仍由外部持有）✓。

---

## §11 收尾自证（git status / 端口 / PID）

**端口/进程**：

| 项 | 读数 |
|---|---|
| 受控实例 LISTEN PID（5796） | `81154` ⇒ `kill -TERM` 后 `ps -p 81154` = **gone**；启动包装 PID `80776` = **gone** |
| 5796 `lsof -iTCP:5796 -sTCP:LISTEN` | **空（0 行）** |
| 5793–5799 逐口 | `5793=0 5794=0 5795=0 5796=0 5797=0 5798=0 5799=0`（**全空**） |
| 5787 / 5788 | **未碰**（本单未启停） |

**`git status --short`（收尾 · 现取）**：

```text
 M backend-ts/src/database.ts                 ← 本单
 M backend-ts/src/index.ts                    ← 本单
 M frontend/src/pages/market/MarketPage.jsx   ← 本单（R-7E-6）
 M docs/data-layer.spec.md                    ← Jing 并发补正单（非本单）
 M docs/route-layer.spec.md                   ← Jing 并发补正单（非本单）
?? backend-ts/.p4-artifacts/p6tr1a-20261002T135927Z/    ← 离线套件产物
?? backend-ts/.p4-artifacts/p6tr1a-20261002T140515Z/    ← 离线套件产物
?? backend-ts/.p4-artifacts/p6tr1a-20261002T140813Z/    ← 离线套件产物（本收口）
?? backend-ts/.p8s1-artifacts/                          ← 门/探针产物
?? backend-ts/scripts/p8-s1-01-e2e.ts                   ← 本单探针
?? backend-ts/scripts/p8-s1-app-config-gate.ts          ← 本单门
?? docs/audit/p8-s1-app-config.md                       ← 本件
?? docs/audit/route-layer-v2.3-delta.md                 ← Jing 并发补正单（非本单）
?? docs/audit/data-layer-v0.11-delta.md                 ← Jing 并发补正单（非本单）
?? docs/versions/data-layer.spec.v0.11.md               ← Jing 并发补正单（非本单）
?? docs/versions/route-layer.spec.v2.3.md               ← Jing 并发补正单（非本单）
```

**收尾核对**：**未** `git add/commit/push`；**未** 新增技能进程；**未** 触碰 `migrations/**`、`docs/*.spec.md`、`master-plan`、既有 `docs/qa/**`；**未** 启停 5787/5788；**未** `pkill -f`/`killall`。

**占位归零自证**：本件「双下划线」占位模式计数 = **0**（现取 `grep -c` 该模式 ⇒ **0**；见交付回执）。

---

## §12 R-8-10 实装 diff（逐字 · 供终审）

**`backend-ts/src/database.ts`**（`SETTINGS_WRITE_REASONS` + 未知键分支）：

```diff
-/** 写入口禁的**稳定原因串**（`details.reason` 取值；机读判据）。 */
+/**
+ * 写入口禁的**稳定原因串**（`details.reason` 取值；**机读判据 —— 恒为常量、不随输入插值**）。
+ * ★ `R-8-10` 裁定：`reason` 是**稳定机读面**（要**能枚举** + **能映射 i18n**）⇒ 未知键**不得**用
+ * `<KEY>_NOT_IN_APP_CONFIG_WHITELIST` 插值形（逐键不同 ⇒ 判据不可枚举）；改用**单一常量**，
+ * 「哪些键未知」由 `details.unknown_keys`（数组，逐键）承载。
+ */
 export const SETTINGS_WRITE_REASONS = {
-  /** `AG1`：未知键（`<KEY>_NOT_IN_APP_CONFIG_WHITELIST` 的固定后缀）。 */
-  unknownKeySuffix: '_NOT_IN_APP_CONFIG_WHITELIST',
+  /** `AG1`：未知键 —— **常量**（与键名无关，`R-8-10`）。 */
+  unknownKey: 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST',
   typeInvalid: 'SETTING_TYPE_INVALID',
   valueNotObject: 'SETTING_VALUE_NOT_OBJECT',
 } as const;
```

```diff
   if (unknownKeys.length) {
     const first = unknownKeys[0];
-    const reason = `${first}${SETTINGS_WRITE_REASONS.unknownKeySuffix}`;
     return {
       ok: false,
       code: 'LEDGER_AMOUNT_INVALID',
       message: 'Unknown key(s) are not writable via /api/admin/settings',
       details: {
+        // ★ `R-8-10`：`reason` = **稳定常量**（**不随键名插值**，保证可枚举 / 可映射 i18n）；
+        //   未知键**逐个**进 `details.unknown_keys`（数组）；`field` = 首个未知键（便于定位、非机读键）。
         field: first,
-        reason,
+        reason: SETTINGS_WRITE_REASONS.unknownKey,
         unknown_keys: unknownKeys,
         legal_keys: [...SYSTEM_SETTINGS_FIELDS],
       },
     };
   }
```

**门 / 探针同步**：`p8-s1-app-config-gate.ts` C1–C3 期望串与注释 → 常量；`p8-s1-01-e2e.ts` `NEG-AG1-unknown-key` 与 `NEG-fee-rate-key` 候选串 → 常量（§9 期望订正 #3–#5 逐字）。
