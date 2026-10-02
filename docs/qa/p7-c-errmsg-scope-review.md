# 批 7-C · 错误文案护栏扩口径（修 F-1）· 独立质检报告（Neng）

> 被检提交：**`74c998a`**（`fix(fe): 批 7-C 错误文案护栏扩口径 …`，本地未推）。
> 固定副本：`git worktree add --detach /Users/kevin/.hermes/profiles/zang/cache/scratch/qa7c 74c998a`（`frontend/node_modules` 软链；**未起后端实例** ⇒ 未链 `backend-ts/node_modules` / `.env.local`）。
> 质检口径：**逐条重取读数**，不采信交付方结论；退出码一律**管道外**捕获（`cmd; echo $?`）。
> 产物：`frontend/.p7cqa-artifacts/*.q7c.{txt,json}`（run-tagged）。本单只读被检代码 + 只写 `docs/qa/**` 与本单产物；判负变异**只在副本内**并已复原。

## §0 一句话结论

**PASS（建议入库）**：判据正则逐字与裁定①建议形一致；**落点正确**（施加在**服务端 `message` 本体**、**不是**整条拼接后的 `direct` —— 我已用变异实跑证明：若改施加在整条 `direct`，既有验收面 `p7a-ledger-error-i18n` ③ **必红**）；硬门七门全 `EXIT=0`（build 0 / 单测 **30 files 265 passed**，基线实测 **29/258** 不掉）；四语文案链**独立重取**逐语 = 该语 `auth.err.REQUEST_FAILED` 真文案（zh/hk 含非 ASCII），不含机读码 / reason 后缀 / 裸键 / `[object Object]`；O-1 边界四语**保住**；两处判负自证**逐字复现**（单测 3 failed|4 passed / 门 `EXIT=1`）后复原回绿；误杀面**未发现**（`i18n_key` 命中优先，改前=改后逐字相同）。
**独立发现（非阻塞，须登记）**：`②` 路径的 `(reason)` 后缀残余**不是理论风险、是可达事实** —— 业务状态机 409 面（`stateConflict` ⇒ `message='Business state transition rejected'` + `reason='LISTING_STATE_INVALID'` 等 5 处）在**四语**逐语外显 `Business state transition rejected (LISTING_STATE_INVALID)`，且**改前=改后**（本单未引入、未恶化）。判为**可接受（本批）**并**升级为待裁定项**（见 §3.4 / §6.2 / 交付方报告 §6.1 的**具体实例补充**）。

## §1 被检面与判据亲读（L1）

### §1.1 判据正则逐字（真源 `frontend/src/auth.js:155-166`，`node` 读源码逐字打印，非抄报告）

```js
export const MACHINE_CODE_RE = /^(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}$/
export const MACHINE_CODE_TOKEN_RE = /(?:^|[\s()[\]{}"'`,;:/\\|])(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}(?=$|[\s()[\]{}"'`,;:/\\|])/
export const looksLikeMachineCode  = (value) => typeof value === 'string' && MACHINE_CODE_RE.test(value)
export const containsMachineCode   = (value) => typeof value === 'string' && MACHINE_CODE_TOKEN_RE.test(value)
```

- 判据 = 一个**独立 token**：① 整 token ∈ `[A-Z0-9_]`（天然排小写与非 ASCII）；② `(?=[A-Z0-9_]*_)` ⇒ **至少 1 个下划线**；③ `{4,}` ⇒ **长度 ≥ 4**。边界类 `[\s()[\]{}"'`,;:/\\|]` 与既有 `BARE_I18N_KEY_TOKEN_RE`（`auth.js:214`）**逐字同一集**，**不含 `.`** ⇒ 两判据互补（点分键归旧判据、无点下划线码归新判据）。**亲读结论：与裁定①逐字一致，无隐性收窄/放宽。**

### §1.2 三处收口点逐字（`extractApiErrorMessage`）

| # | 面 | 改后逐字（`auth.js:179 / 182 / 183`） |
|---|---|---|
| ① | 对象面 `error.message` | `if (base && !containsMachineCode(base)) return reason ? \`${base} (${reason})\` : base` |
| ② | 旧字符串面 `error` | `if (typeof error === 'string' && error && !containsMachineCode(error)) return error` |
| ③ | 顶层 `payload.message` | `if (payload?.message && !containsMachineCode(payload.message)) return payload.message` |

三处命中 ⇒ `extractApiErrorMessage` 返回 `undefined` ⇒ `apiErrorMessage` 的 `mappedKey` 兜 `auth.err.REQUEST_FAILED`（`auth.js:289`）⇒ `resolveI18nMessage` ① `t(i18n_key)` 未命中（`ledger.err.*` 无键）⇒ ② `direct=undefined` ⇒ **③ 四语通用兜底**。`error.code` **不再**被当文案（7-B 已封，本单未回退；`rawMessage = error.message || error.code` 只喂 `SERVER_MESSAGE_I18N_KEYS` 映射，不外泄）。

### §1.3 落点语义独立判定：判据施加在**服务端 message 本体**、**不是**整条 `direct`

**判定证据（逐字）**：`auth.js:179` 的守卫自变量是 `base`（`= error.message || ''`）；`(reason)` 是**通过守卫之后**才拼接的（同一行的三元表达式）。⇒ 语义 = 「**message 本体是机读码** ⇒ 视为不可用原文」；**不含**「拼接后的串里出现机读码 token」这一条。

**后果（残余）**：`message` 为**真人句** + `reason` 为**大写机读码**时，`direct = '真人句 (STATEMENT_TIMEOUT)'` 仍走 **② 服务端原文** ⇒ `(reason)` 后缀**外显**。本单的 D 段类级向量**全部**取「`message` 本体即机读码」形态 ⇒ **不进 D 类**（口径自洽，不是漏测）。

**我的独立判定（该残余是否可接受）——「可接受（本批）」，但必须登记为**可达到**事实而非理论风险：**

1. **判据落点正确**：F-1 的病根是**后端把码塞进 `message`**（`listing-funds-service.ts:405` `fail(409,'LEDGER_CURRENCY_INVALID_TRANSITION',{…reason:'order_not_refundable'…},'LEDGER_CURRENCY_INVALID_TRANSITION')` —— **第 4 参 message 逐字就是码**，我从源码逐字确证真体形状）。裁定②明写「对服务端提供的 `message` 应用该判据」⇒ 实现与裁定一致。
2. **反向做法已被实跑否决**（见 §1.4）⇒ 该残余**不是**可以「顺手改掉」的，而是与既有验收面**硬张力**。
3. **残余可达且具体（我新采）**：`stateConflict()`（`listing-service.ts:55` / `job-service.ts:122` / `job-funds-service.ts:61` / `currency-service.ts:59`）⇒ `message='Business state transition rejected'`（真人英文句）+ `reason ∈ {JOB_STATE_INVALID, JOB_APPLICATION_STATE_INVALID, LISTING_STATE_INVALID, CURRENCY_STATE_INVALID, UNKNOWN_CURRENCY_STATUS}`（**大写机读**）⇒ **四语逐语**用户可见串 = `Business state transition rejected (LISTING_STATE_INVALID)`（**逐字读数**见 §3.4 表尾 3 行；**改前=改后**）。交付方报告 §6.1 只举了单测向量 `Ledger statement timed out (STATEMENT_TIMEOUT)`；**真实可达面比它举的更宽**（业务状态机 5 个 reason × 4 语）。
4. **结论**：本批**接受**（与裁定③「message 真人句 ⇒ 保留原文」同族，且 O-1 边界正是为保住这类「真人句」而设）；**升级为待裁定项**（建议下一批以 `details.reason` 的**大写机读码白名单/判据**在 ② 之前收口，或随「错误文案面收口」在后端修 message）。

### §1.4 若改为对整条 `direct` 施加判据 ⇒ **回归既有验收面（实跑证实）**

副本内变异 B（只改 ① 处守卫自变量为整条 `direct`：`!containsMachineCode(reason ? \`${base} (${reason})\` : base)`）⇒ 跑既有用例：

```
$ npx vitest run src/test/unit/p7a-ledger-error-i18n.test.js src/test/unit/p7c-errmsg-machinecode.test.js
→ expected '请求失败 (503)' to include '(STATEMENT_TIMEOUT)'
AssertionError: expected '请求失败 (503)' to include '(STATEMENT_TIMEOUT)'
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 12 passed (13)          ← EXIT=1
```

（向量 = `p7a-ledger-error-i18n.test.js:81-97` ③：`message='Ledger statement timed out'` + `details.reason='STATEMENT_TIMEOUT'`；判据挂整条 `direct` 后 `(STATEMENT_TIMEOUT)` 命中 ⇒ 下沉兜底 ⇒ 该既有断言 `toContain('(STATEMENT_TIMEOUT)')` 必红。）
逐字读数文件：`frontend/.p7cqa-artifacts/l1-mutB-directpred.q7c.txt`。⇒ **交付方「落点选择」自曝属实，且其取舍被实跑支持。**

## §2 硬门独立复跑（L2，副本内 `frontend/`）

| 门 / 命令 | 读数 | 退出码 |
|---|---|---|
| `npm run build` | `✓ built in 1.59s`（`dist/` 已产） | **0** |
| `npm run test:unit` | **30 files / 265 passed**（Duration 4.27s） | **0** |
| `p4z-i18nviol-global` | `总判：PASS（locale 裸命中 0 + 源面裸命中 0；locale=2816 / source=37）` | **0** |
| `p6-tr2-i18n-locales` | `[TR-2] 总判：PASS`（新接文件守卫=PASS；旧三目链页面 = 0 页） | **0** |
| `p4z-miscfix-links` | `已登记待办 = 8；未登记残留 = 0；总判：PASS` | **0** |
| `p4z-feperf-safelist` | `VERDICT=PASS` | **0** |
| `p7a-03-errmessage-gate` | `总判：PASS（扫描 77 / 受体 6 / 命中 3 / 基线 3）` | **0** |
| `p7b-errfallback-gate` | `A=PASS`（①②③ + **④ `containsMachineCode` 导出=true / ⑤ extract 内收口=true**）/ `D 节点=132` | **0** |
| **新门** `p7c-errmsg-machinecode-gate` | `A=PASS / B 含机读码值=0（704×4=2816）/ C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/12 / E 样本=19` | **0** |

- **基线不掉（我自证，非采信）**：副本内**移出** `p7c-errmsg-machinecode.test.js` 后重跑 `npm run test:unit` ⇒ **29 files / 258 passed**（`l2-testunit-baseline.q7c.txt`）；含该文件 ⇒ **30 / 265**。⇒ 交付方「基线 29/258 ⇒ +1 文件 +7 例」**逐字复现**。
- **已知环境件登记（我实测确认，非采信）**：`p4z-feperf-safelist` **依赖 `dist/`（构建产物）** —— 在**无 `dist/` 的镜像副本**（`rsync --exclude dist`）上跑 ⇒ `VERDICT=FAIL` / **`EXIT=1`**（`safelist_missing_in_dist: null`）。⇒ 「先 `npm run build` 再跑该门」是**真前置依赖**，已登记为环境件（读数 `l2-nodist-safelist.q7c.txt`）。其余六门无此依赖。

## §3 四语文案链独立重取（L3，真 i18n 实例 + 真 `src/locales/*.json` + 真 `apiErrorMessage`）

方法：副本内新写探针单测 `src/test/unit/q7c-neng-probe{,2}.test.js`（**不 mock auth / 不 mock react-i18next**；期望值直接读真 locale 表代 `{{status}}`），读数落 `l3-l5-probe.q7c.json` / `l1-residual-probe.q7c.json`。

### §3.1 (a) **真 409 形状**（`message` = 机读码 + `details.reason`）⇒ 四语逐语

真体形状逐字（源码确证 `listing-funds-service.ts:405`）：`{error:{code:'LEDGER_CURRENCY_INVALID_TRANSITION', message:'LEDGER_CURRENCY_INVALID_TRANSITION', i18n_key:'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION', details:{reason:'order_not_refundable', order_id:88123, http_status:409}}}`

| lang | 用户可见串（逐字） | = 该语 `auth.err.REQUEST_FAILED` | 非 ASCII | 含机读码 | 含 reason | 含裸键 | `[object Object]` |
|---|---|---|---|---|---|---|---|
| zh | `请求失败 (409)` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| hk | `請求失敗（409）` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| en | `Request failed (409)` | ✓ | — | ✗ | ✗ | ✗ | ✗ |
| vn | `Yêu cầu thất bại (409)` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

⇒ **F-1 已修**（改前四语均为 `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`，见 §4 判负①红读数逐字）。

### §3.2 (b) 服务端**自拼** `机读码 (reason)`

`message='LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)'` ⇒ 四语**均**落该语兜底（`请求失败 (409)` / `請求失敗（409）` / `Request failed (409)` / `Yêu cầu thất bại (409)`）。**独立判定：正确** —— 因为判据取 **token 级**（`containsMachineCode`，非整串 `looksLikeMachineCode`），拼接串里的码 token 被命中；这恰是 7-B 采到的「token 判据强于整串判据」缺口的镜像面，本单未重犯。

### §3.3 (c) **O-1 边界必须保住**：`message='系统繁忙，请稍后重试'` + `reason='too_many_connections'`

四语逐语 = **`系统繁忙，请稍后重试 (too_many_connections)`**（`isGeneric=false`，即**走 ② 服务端原文**）。⇒ **未被当机读码抹掉**，O-1 边界**保住**（zh 单语外溢到 hk/en/vn = 7-B 已知边界 O-1，本单未改）。

### §3.4 (d) 反向边界**独立枚举（18 样本）** 与假阳性可达性

| # | 样本（逐字） | `containsMachineCode` | 整串判据 | 去向（zh/en） | 我的独立判定 |
|---|---|---|---|---|---|
| 1 | `database is unreachable` | false | false | ② 原文 | ✓ 正确 |
| 2 | `Invalid wallet signature` | false | false | **① 映射键**（`auth.err.INVALID_WALLET_SIGNATURE` ⇒ 四语真文案） | ✓ 正确（出处 = `SERVER_MESSAGE_I18N_KEYS`，非本单判据） |
| 3 | `系统繁忙，请稍后重试` | false | false | ② 原文 | ✓ 正确 |
| 4 | `2024_01_02` | **true** | true | **③ 兜底** | ⚠ **假阳性**（交付方自曝，我复现） |
| 5 | `订单 A123_456 不存在` | **true** | false | **③ 兜底** | ⚠ **假阳性（交付方未自曝）**：空格包围的「大写+数字+下划线」token |
| 6 | `订单A123_456不存在` | false | false | ② 原文 | △ 与 #5 **不对称**（无分隔符不命中）—— 被动漏网，非回归 |
| 7 | `TIMEOUT`（无下划线） | false | false | ② 原文 | ✓ 正确 |
| 8 | `ABCD`（无下划线） | false | false | ② 原文 | ✓ 正确 |
| 9 | `A_B`（长 3 < 4） | false | false | ② 原文 | ✓ 正确 |
| 10 | `endpoint deprecated: /api/auth/register` | false | false | ② 原文（S6 回归锚） | ✓ 正确 |
| 11 | `Request failed (400)` | false | false | ② 原文 | ✓ 正确 |
| 12 | `see LEDGER_CODE_XYZ in logs` | **true** | false | **③ 兜底** | ⚠ **假阳性**：英文句内嵌大写 token |
| 13 | `v1.2` | false | false | ② 原文 | ✓ 正确 |
| 14 | `STATEMENT_TIMEOUT` | true | true | ③ 兜底 | ✓ 正确（机读码） |
| 15 | `HTTP_500` | true | true | ③ 兜底 | ✓ 正确（机读码形态） |
| 16 | `abc_DEF`（含小写） | false | false | ② 原文 | ✓ 正确 |
| 17 | `A123_456` | true | true | ③ 兜底 | ✓ 正确（机读码形态） |
| 18 | `Ledger statement timed out (STATEMENT_TIMEOUT)` | **true** | false | ② 原文 | ✓ **本单有意保留**（判据只施加于 `message` 本体 ⇒ `(reason)` 后缀外显；见 §1.3/§1.4） |

**假阳性可达性（我独立核，口径 = 扫 backend-ts/src 全「message 面」字面量，用真谓词）**：脚本 `q7c-reach-scan.mjs`（读数 `l5-reach-scan.q7c.txt`）扫得 **38 条去重 message 字面量**，命中 **12 处**：

- `ACTOR_NOT_ALLOWED`（×7，`currency/job-funds/job/listing/market-service`）⇒ 403 面，`i18n_key=auth.err.AUTH_FORBIDDEN` **命中** ⇒ **① 优先 ⇒ 用户可见串不变**（§5 实测）；
- `LEDGER_CURRENCY_INVALID_TRANSITION`（×1，退款拒收回执）⇒ **本单 F-1 目标面**，③ 兜底 = 修复；
- **`CRON_SECRET not configured`（×1，`index.ts:1995` `sendError(res,503,…)`）⇒ ⚠ 真·假阳性实例**：**英文句内嵌大写带下划线 token** ⇒ 改后由 ② 英文原文变 ③ 四语兜底。**可达性判定**：该路由 = `POST /api/translate/backfill`（**cron/secret 面**），**前端 web 无调用点** ⇒ **用户不可达**，判为**良性**（且对用户更友好）；
- `endpoint deprecated: ${CLAIM_RETIRED_REF_ID}` ⇒ **扫描器对模板原文的伪命中**（运行时 `CLAIM_RETIRED_REF_ID='/api/task-progress/claim/:jID'`，含小写 `jID` ⇒ 运行时不命中）；`sendGone` 全部实参均为小写路径（`/api/shard/redeem` …）⇒ **运行时不命中**。

**纯数字下划线串（`2024_01_02` 形态）可达性 —— 独立核**：38 条 message 字面量**无一条**为该形态；另查 message 生成源（`LEDGER_ERROR_TABLE` 全 zh 文案 / `sendError` 英文句 / `fail(...,message)` / `sendGone` 路径 / `toErrorResponse→err.message`）**均无**「纯数字+下划线」形态 ⇒ **交付方 §6.3 断言（本仓无此形态）成立**；但该假阳性在**谓词层已确认可达**（#4），若将来后端 message 出现日期/编号形（如 `2024_01_02`、`88123_456`）即会**误杀为兜底**。**我的意见**：加「含 ≥1 个字母」约束可零成本收窄（`(?=[A-Z0-9_]*[A-Z])`），本单不做 = 遵从裁定①逐字实现，**可接受但建议登记为下一批一行改动**。

## §4 两处判负自证（L4，**仓外副本内**，主工作区零污染）

**① 破坏新判据（回到旧口径）⇒ 新单测必红**（副本内仅删三处 `!containsMachineCode(…)` 守卫，保留导出以隔离变量）：

```
$ npx vitest run src/test/unit/p7c-errmsg-machinecode.test.js
  → [zh] 必须落该语通用兜底: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
  → [zh]: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
  → [zh]: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)            ← EXIT=1
```
⇒ 与交付方 §5.1 **逐字一致**（3 failed | 4 passed；红串 = `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`）。读数：`l4-neg1-unit.q7c.txt`。

**② 删 `en.json` 的 `auth.err.REQUEST_FAILED` 兜底键 ⇒ 新门必非零退出**：

```
  auth.err.REQUEST_FAILED ⇒ en:**缺/非法**（undefined）   （zh/hk/vn = OK）
[P7C-MACHINE-CODE] 判负 5 条（必须 = 0）：
  ! C 通用兜底键 `auth.err.REQUEST_FAILED` 在 en 缺失 / 为空 / 为裸键 / 为机读码（值 = undefined）
  ! D … F-1 · 409 真体 … · en ⇒ "Request failed (409)"（产出 ≠ 该语兜底）
[P7C-MACHINE-CODE] 总判：FAIL（A=PASS / B=0 / C=4 / D 类级违例=4/16 / F=0/12 / E=19）
GATE_EXIT=1
```
⇒ 与交付方 §5.2 **逐字一致**。读数：`l4-neg2-gate.q7c.txt`。

**复原回绿**：`git checkout -- frontend/src/{auth.js,locales/en.json}` 后 ⇒ 新门 `EXIT=0`（`D=0/16`）、新单测 `7 passed`（`l4-restore-*.q7c.txt`）。**副本 tracked 逐文件 blob 对拍（`git hash-object` vs `git rev-parse 74c998a:<path>`）全 SAME**：

```
SAME frontend/src/auth.js                        5362a06100852bf9a3b5284ba2e12fa3ca33b264
SAME frontend/scripts/p7b-errfallback-gate.mjs   162ed2336078651b36b5229773d256201a12f944
SAME frontend/scripts/p7c-errmsg-machinecode-gate.mjs      833ce095489cda8225a3321cd7974ffc40555e40
SAME frontend/src/test/unit/p7c-errmsg-machinecode.test.js c0dd4a392bce965b49f14f6857dbdaf970c7ac17
SAME docs/audit/p7-c-errmsg-scope.md             1fa2417dcd46391298fbb01f15934db7e2887f68
```
副本 `git status --porcelain`：**tracked 改动 = 空**（余 3 条为**我自己的** untracked 探针件：`frontend/src/auth.oldprobe.js`、`frontend/src/test/unit/q7c-neng-probe{,2}.test.js` —— 随副本删除，不入仓）。

## §5 误杀面专项（L5，真旧代码 before/after 对拍 + 全仓 message/键面）

方法：把 `74c998a^` 的 `auth.js` 作为 `src/auth.oldprobe.js` 导入，**同一真 i18n + 同真 locale** 逐条对拍 `apiErrorMessage`（zh/en）。读数：`l3-l5-probe.q7c.json`（L5 段）。

| # | 面（真实回执形状） | status | 改前 | 改后 | 变化 |
|---|---|---|---|---|---|
| 1 | `AUTH_UNAUTHORIZED`（message=码, `i18n_key=auth.err.AUTH_UNAUTHORIZED`） | 401 | `登录凭证无效或已过期，请重新登录。` | **同** | **无** |
| 2 | `AUTH_FORBIDDEN`+`reason=ACTOR_NOT_ALLOWED`（message=reason 码） | 403 | `当前账号无权执行该操作。` | **同** | **无** |
| 3 | `AUTH_FORBIDDEN`+`reason=PERMISSION_NOT_GRANTED` | 403 | 同上 | **同** | **无** |
| 4 | `LEDGER_REF_NOT_FOUND` + `Referenced object not found` | 404 | 英文原文 | **同** | **无** |
| 5 | `LEDGER_REF_NOT_FOUND` + `job not found` | 404 | `job not found` | **同** | **无** |
| 6 | `fromLedgerError` 面（message=机读码 + 大写 reason） | 503 | `LEDGER_LOCK_TIMEOUT (STATEMENT_TIMEOUT)` | `请求失败 (503)` | **修复**（码不外泄） |
| 7 | B14 旧字符串面（英文原文，无 `error` 对象） | 401 | ① 映射真文案 | **同** | **无** |
| 8 | 410 弃用面（英文句） | 410 | `endpoint deprecated: /api/auth/register` | **同** | **无** |
| 9 | `p7a③` 向量（英文句 + 大写 reason） | 503 | `Ledger statement timed out (STATEMENT_TIMEOUT)` | **同** | **无**（残余，见 §1.3） |
| 10 | 未登记裸 `payload.message` | 503 | `database is unreachable` | **同** | **无** |

**重点确认 ①：`i18n_key` 命中**优先**于新判据** —— 表内 #1/#2/#3/#7 逐字相同（且 §4 单测 ④ 同源断言）；源码次序（`auth.js:260-265`：① `t(i18n_key)` → ② `fallback`）与新判据**不同层**（判据只在 `extractApiErrorMessage` 造 `direct` 时生效，`direct` 只是 ② 的输入）⇒ **键存在即不受影响**，且将来 `ledger.err.*` 建键后**自动让位**（无需改本单代码）。

**结论：未发现对合法/既有用户可见文案的误杀**。#6 是**修复**（把机读码换成四语兜底）；全仓 message 面 12 处命中里，7 处被 `i18n_key` 命中面吸收，1 处（`CRON_SECRET not configured`）为前端不可达的 cron 面良性变化，其余为 F-1 目标面。**唯一需登记的形态** = 「英文句内嵌大写带下划线 token」（实例 #12 / `CRON_SECRET not configured`）与「空格包围的大写+数字+下划线 token」（§3.4 #5）。

## §6 复核交付方报告 + 未测项（L6）

### §6.1 抽查 5 条读数与产物**逐字对拍**（我重跑的真值，非抄报告）

| 交付方报告条目 | 报告值 | 我重取值 | 判定 |
|---|---|---|---|
| §4.1 A | `containsMachineCode(` 调用 **3** / 导出 2/2 | extract 体内实测 **3**；`MACHINE_CODE_TOKEN_RE`/`containsMachineCode` 导出=true | **SAME** |
| §4.1 B | 含机读码值 **0**（**2816** 节点） | 门：`[zh/hk/en/vn] 叶子值=704×4=2816`；命中 **0** | **SAME** |
| §4.1 D | 类级违例 **0/16** | 门 `D 类级违例=0/16`，四语逐语 = 请求失败(409)/請求失敗（409）/Request failed (409)/Yêu cầu thất bại (409) | **SAME** |
| §4.1 F | 反例面违例 **0/12** | 门 `F 反例违例=0/12` | **SAME** |
| §7 单测 | **30 files / 265 passed**（基线 29/258） | 实测 30/265；**移出该测试文件后 29/258** | **SAME** |
| （附加）§5.1/§5.2 判负 | `3 failed | 4 passed` / `GATE_EXIT=1` | 双双逐字复现 | **SAME** |

⇒ 抽查 6 组**全部 SAME**，无一处夸大或口径漂移。**唯一补正（非矛盾）**：§6.1 残余举例偏窄（只举单测向量）——已按 §1.3/§3.4 补上**可达的具体实例**（`stateConflict` 的 5 个 reason × 4 语）。

### §6.2 未测项（逐项给原因，**无 0 / 无空**）

1. **未起后端实例跑「真 HTTP 409 体」**：原因 —— 本单**前端为主**（硬口径）；且真体**形状**已由源码**逐字确证**（`listing-funds-service.ts:405` 的 `fail(…,'LEDGER_CURRENCY_INVALID_TRANSITION')` 第 4 参即码 + `details.reason` 默认 `order_not_refundable`，`:404`），前端链只吃 body、与实例无关；上游 7-B 已**活体**采到同形。⇒ 用**真 i18n + 真 locale + 真 `apiErrorMessage`**（§3.1）替代实例，读数等价。
2. **线上/生产 bundle 是否已换护栏**：原因 —— `74c998a` **本地未推**（本单禁 `git add/commit/push`）⇒ 线上必仍为旧护栏，**无需测**，登记为「未推 ⇒ 线上未生效」。
3. **`p7a-03` 门登记的 3 条存量基线**（`ActiveTaskModal.jsx` / `ClaimRewardModal.jsx` / `TaskPage.jsx` 自造错误串直拼 toast）：原因 —— 它们**绕过 `apiErrorMessage`**（页面级 `fetchJson`），**不经过**本护栏 ⇒ 本单判据对其**无作用**（不在作用域）；p7a 门已登记基线，未测其用户可见串。
4. **`details.reason` 侧的上限/白名单**：原因 —— 本单**明示**不对 `reason` 施加判据（裁定②只指 `message`）；其后果已由 §1.3/§3.4 以「实跑读数」量化，不属本单测项。
5. **zh/hk/en/vn 之外的语种 / 非字符串 locale 值**：原因 —— 本仓语种集 = 这 4 个（门 `p6-tr2` 与 `p7c C 段` 只认 4 语）；节点计 704×4=2816 全覆盖。
6. **`backend-ts/**` 与 `migrations/**`**：原因 —— 本单范围外（且交付方自曝另一子代理在读写）；我只做**只读**调用面扫描（§3.4）用于假阳性可达性判定。

### §6.3 我的独立裁定（非阻塞）

1. **判据落点** = 正确（施加于 `message` 本体，与裁定②一致；反向做法实跑必红 ⇒ 取舍成立）。
2. **该残余可接受（本批）**，但**须**作为「可达事实」登记并派下一批（`stateConflict` 5 reason × 4 语外显大写机读 reason）。
3. **假阳性**：`2024_01_02` 形态**谓词层可达/仓内 message 面不可达**（我扫 38 条确证）；真·运行实例 = `CRON_SECRET not configured`（cron 面、web 不可达）。建议下一批加「含 ≥1 字母」约束（一行）+ 收窄「英文句内嵌大写 token」对**真人句**的误伤（可用「token 占比 / 句内混合语言」启发，或改由 `i18n_key` + 后端 message 收口替代启发式）。**均为可选增强，不阻塞本单入库。**

## §7 零污染凭据 / 收尾

**首检**（开工前，主工作区 `/Users/kevin/bistro/seafood`）：`git status --short` = **空**；`HEAD = b78603047114b0f8addcb6b9cb687ad6c2660958`。
**尾检**（完工后）：

```
?? docs/qa/p7-c-errmsg-scope-review.md      （本单报告）
?? frontend/.p7cqa-artifacts/               （本单产物，run-tagged）
git diff --stat = 空；HEAD = b786030…（未变）
```

⇒ **被检代码零改动**、**无 `git add/commit/push`**、**未 `npm install`**、**未碰/未打印 `.env*`**、**未启停 5787/5788**、**未用 `pkill -f`/`killall`**；判负变异**只在 `scratch/qa7c` 副本内**且已 `git checkout` 复原为**逐文件 blob SAME**。
**副本收尾**：`git worktree remove --force <scratch>/qa7c` + 删 `scratch/nodist-probe`；**未启后端实例 ⇒ 无后端 PID 可收**；`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` 收尾读数见下（空）。

```
$ lsof -nP -iTCP:5796-5799 -sTCP:LISTEN ; echo "LSOF_EXIT=$?"
（无输出）LSOF_EXIT=1     ← 5796–5799 无监听
```
