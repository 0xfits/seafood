# 批 7-C · 错误文案护栏扩口径（修 F-1）· 交付报告

> 作者：**Kong** · 范围：**只改 `frontend/**`**（`src/auth.js` 文案链 + 门 + 单测 + 本报告）
> 锚点：分支 `main` / `6d76e43`（工作区首检见 §8）。**硬口径**：未 `git add/commit/push`、未 `npm install`、未碰 `.env*`、未启停 5787/5788、未用 `pkill -f`/`killall`；判负变异**只在仓外副本内**做。
> 交付物：① `frontend/src/auth.js`（扩口径）② `frontend/scripts/p7c-errmsg-machinecode-gate.mjs`（新门）③ `frontend/scripts/p7b-errfallback-gate.mjs`（既有门 A 段扩口径）④ `frontend/src/test/unit/p7c-errmsg-machinecode.test.js`（新单测）⑤ 本报告。

## §0 一句话
服务端 `message` 为「**全大写下划线机读码**」（F-1 真体 `LEDGER_CURRENCY_INVALID_TRANSITION`）时，旧护栏只认「点分裸键 token」⇒ 漏网 ⇒ 四语用户看到英文机读码；本单把机读码纳入「不可作为用户文案」判据并**落在服务端 `message` 面** ⇒ 命中即落 **③ 四语通用兜底**，`details.reason` 仍在机读面。AC 全绿：build 0 / 单测 **265**（≥258）/ 七门全 PASS。

## §1 缺陷复现（F-1 真体）

退款拒收回执的 **HTTP 真实体**（逐字）：

```json
{"error":{"code":"LEDGER_CURRENCY_INVALID_TRANSITION","message":"LEDGER_CURRENCY_INVALID_TRANSITION",
          "i18n_key":"ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION",
          "details":{"reason":"order_not_refundable","order_id":88123,"http_status":409}}}
```

旧链（`apiErrorMessage` → `resolveI18nMessage`）走向：

| 跳 | 判定 | 结果 |
|---|---|---|
| ① `t('ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION')` | `ledger.err.*` 四语键**缺失**（已登记 P6/P7）⇒ i18next 回键名本身 | `isUsableText` 判否 ⇒ 不采用 |
| ② `direct = 'LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)'` | 旧护栏只认「点分裸键 token」`x.y.z`；下划线机读码**不匹配** | **采用** ⇒ 用户可见串 = 英文机读码 |

**复现读数（判负自证①，实际输出逐字）**：

```
AssertionError: [zh] 必须落该语通用兜底: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
+ LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)
```

⇒ 四语用户可见串均为英文机读码 `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`（与裁定纸面一致）。

## §2 判据（正则逐字 + 边界样本表）

### §2.1 正则**逐字**（真源 = `frontend/src/auth.js`）

```js
// 整串即机读码
export const MACHINE_CODE_RE = /^(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}$/
// 文案中「出现」机读码 token（边界集与 BARE_I18N_KEY_TOKEN_RE 逐字同一集）
export const MACHINE_CODE_TOKEN_RE = /(?:^|[\s()[\]{}"'`,;:/\\|])(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}(?=$|[\s()[\]{}"'`,;:/\\|])/
```

判据（裁定①建议形的逐字实现）：一个**独立 token**，① 整 token 均为 `[A-Z0-9_]`（⇒ 天然排除小写字母与非 ASCII）；② 含**至少 1 个下划线**（`(?=[A-Z0-9_]*_)`）；③ **长度 ≥ 4**（`{4,}`）。边界集与既有裸键 token 判据 `BARE_I18N_KEY_TOKEN_RE` **逐字同一集**（串首/尾/空白/括号/引号/逗号/分号/冒号/斜杠/反斜杠/竖线），**不含** `.`（点分键由既有裸键判据负责，两判据互补）。

### §2.2 边界样本表（读数为门 E 段实测）

| 样本 | `containsMachineCode` | `looksLikeMachineCode` | 说明 |
|---|---|---|---|
| `LEDGER_CURRENCY_INVALID_TRANSITION` | **true** | true | F-1 真体 |
| `AUTH_UNAUTHORIZED` | **true** | true | 裁定正例 |
| `STATEMENT_TIMEOUT` | **true** | true | 大写 reason |
| `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)` | **true** | false | 拼接面（token 判据强于整串判据） |
| `系统繁忙，请稍后重试 (too_many_connections)` | false | false | **裁定反例**：zh 句 + 小写 token |
| `Request failed (400)` | false | false | **裁定反例**：`400` 无下划线且 < 4 |
| `database is unreachable` | false | false | **裁定反例**：普通英文句 |
| `Invalid wallet signature` | false | false | 含小写词 |
| `too_many_connections` | false | false | 含小写词 |
| `endpoint deprecated: /api/auth/register` | false | false | S6 回归面 |
| `v1.2` / `no-dots-here` / `请求失败 (500)` / `''` | false | false | 正常文案 |
| `undefined` / `null` / `42` / `{}` / `['A_B']` | false | false | 非字符串 |

正例 4 条 ⇒ true；反例 10 条 + 非字符串 5 条 ⇒ false（门 E 段断言，非空转）。

### §2.3 与既有裸键判据的关系
- 裸键判据（`containsBareI18nKey`）**不动**：`ledger.err.X`（含 `.`）仍由其负责。
- 机读码判据**新增**：负责「无点、全大写下划线」族。两判据在 `extractApiErrorMessage` 里**串联**收口（见 §3）。

## §3 代码改动（落点）

**落点 = 服务端提供的 `message`**（裁定②「对服务端提供的 message 应用该判据」），真源 = `frontend/src/auth.js` 的 `extractApiErrorMessage`（3 处以 `!containsMachineCode(...)` 收口）：

| 位置 | 旧 | 新 |
|---|---|---|
| 对象面 `error.message` | `if (base) return reason ? \`${base} (${reason})\` : base` | `if (base && !containsMachineCode(base)) return ...` |
| 旧字符串面 `error` | `if (typeof error === 'string' && error) return error` | `... && !containsMachineCode(error)` |
| 顶层 `payload.message` | `if (payload?.message) return payload.message` | `... && !containsMachineCode(payload.message)` |

命中机读码 ⇒ `direct = undefined` ⇒ 链下沉到 **③ `auth.err.REQUEST_FAILED` 四语通用兜底**；`details.reason` **仍在机读面**（`details` 内），不随文案外泄。服务端 `message` 本体**不改**（见 §6 登记）。

**护栏让位不变**：`resolveI18nMessage` 次序 ① `t(i18n_key)` 在 ② 之前 —— 一旦 `ledger.err.<CODE>` 四语键建齐，① 命中即用真文案，**无需改本单代码**。新增导出：`MACHINE_CODE_RE` / `MACHINE_CODE_TOKEN_RE` / `looksLikeMachineCode` / `containsMachineCode`（零行为副作用）。

## §4 门与单测

### §4.1 新门 `frontend/scripts/p7c-errmsg-machinecode-gate.mjs`（类级判据）
判据 A–F（真源谓词从 `src/auth.js` **导入不重写**；真 locale 数据 + 真 i18next）：

| 段 | 判据 | 实测读数 |
|---|---|---|
| A | 护栏在场（源码）：导出 `MACHINE_CODE_TOKEN_RE` / `containsMachineCode`；`extractApiErrorMessage` 内以该谓词收口 | A=**PASS**（导出 2/2；`containsMachineCode(` 调用 **3** ≥ 1） |
| B | locale 四语每个叶子值不得含机读码 token | 含机读码值 = **0**（2816 节点） |
| C | 四语通用兜底 `auth.err.REQUEST_FAILED` 齐备 | 兜底键 = **4/4** OK |
| D | **★ 类级**：机读码 message 向量 × 4 语 ⇒ 链产出非机读码、无 reason 后缀、逐字 = 该语兜底 | 类级违例 = **0 / 16** |
| E | 边界样本表自证 | 正例 4 / 反例 10 + 非字符串 5 |
| F | 反例面（O-1 边界）：真人可读 message ⇒ 仍走 ② | 违例 = **0 / 12** |

**D 段逐语读数**（4 向量 × 4 语，全绿）：

```
· F-1 · 409 真体（message = 机读码 + reason = order_not_refundable）
    [zh] "请求失败 (409)"   [hk] "請求失敗（409）"   [en] "Request failed (409)"   [vn] "Yêu cầu thất bại (409)"
· 服务端自拼（message 已含 `机读码 (reason)`）           ⇒ 四语兜底（同上形，status=409）
· 无 i18n_key 的机读码 message（旧字符串面, 401）        ⇒ 四语兜底（status=401）
· 机读码 message + 大写 reason `STATEMENT_TIMEOUT`（503）⇒ 四语兜底（status=503）
★ 类级违例计数（「全大写下划线机读码被当作文案输出」形态）= 0 / 节点 16（必须 = 0）
```

**F 段逐语读数**（O-1/回归锚，全绿）：

```
· O-1 · 503 真体（zh 句子 + 小写 reason=too_many_connections）⇒ 四语均 "系统繁忙，请稍后重试 (too_many_connections)"（② 保留）
· S6 · 410 弃用面（英文句）      ⇒ 四语均 "endpoint deprecated: /api/auth/register"（② 保留）
· B14③ · 未登记裸 message        ⇒ 四语均 "database is unreachable"（② 保留）
```

### §4.2 新单测 `frontend/src/test/unit/p7c-errmsg-machinecode.test.js`（7 例，真 i18n + 真 locale 表）
① 谓词边界表；② **F-1 真 409 体** ⇒ 四语逐语 = 该语 `auth.err.REQUEST_FAILED` 真兜底，`not.toContain` 机读码 / `order_not_refundable` / `ledger.err.` / `[object Object]`；③ 服务端自拼 ⇒ 同样兜底；④ 让位面（`i18n_key` 命中 ⇒ 真文案）；⑤ **O-1 边界**（503 zh 句 ⇒ ② 原文，`not.toBe` 兜底）；⑥ `ledger-api` 端到端 409 ⇒ 该语兜底且逐字 = `apiErrorMessage`；⑦ 回归锚（裸 message / 410 英文句 ⇒ ② 胜出）。
实测：`1 passed (1) / 7 passed`。

### §4.3 既有门 `frontend/scripts/p7b-errfallback-gate.mjs` 扩口径
A 段加两条同源判据：**A④** 具名导出 `containsMachineCode`、**A⑤** `extractApiErrorMessage` 内以机读码判据收口；并入 `guardWired`。实测该门仍 **PASS**（`A=PASS / D 节点=132`）。

## §5 判负自证（**仓外副本内**，两处）

副本 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/p7c-neg/frontend/`（`rsync` 自仓内、`node_modules` 软链；**主工作区零污染**）。

### §5.1 判负① —— 把新判据**改回旧版**（只认点分裸键）⇒ 新单测**必红**
变异：`extractApiErrorMessage` 三处 `!containsMachineCode(...)` 守卫删除（= 回到旧口径）。逐字红读数：

```
❯ src/test/unit/p7c-errmsg-machinecode.test.js  (7 tests | 3 failed)
  ② [zh] 必须落该语通用兜底: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
  ③ [zh]: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
  ⑥ [zh]: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
AssertionError: [zh] 必须落该语通用兜底: expected 'LEDGER_CURRENCY_INVALID_TRANSITION (o…' to be '请求失败 (409)'
+ LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)
 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)        ← TEST_EXIT=1
```
⇒ **实际输出 = `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`**（与裁定纸面逐字一致）。

### §5.2 判负② —— 把 ③ 四语兜底键**删一处**（`en.json` 之 `auth.err.REQUEST_FAILED`）⇒ 门**必非零退出**
变异：副本 `src/locales/en.json` 删除 `auth.err.REQUEST_FAILED`（原值 `Request failed ({{status}})`）。逐字读数：

```
  auth.err.REQUEST_FAILED ⇒ en:**缺/非法**（undefined）
[P7C-MACHINE-CODE] 判负 5 条（必须 = 0）：
  ! C 通用兜底键 `auth.err.REQUEST_FAILED` 在 en 缺失 / 为空 / 为裸键 / 为机读码（值 = undefined）
[P7C-MACHINE-CODE] 总判：FAIL（判负 5；A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=4/16 / F 反例违例=0/12 / E 样本=19）
```
⇒ **GATE_EXIT=1**（非零）。

### §5.3 复原回绿
副本 `auth.js` 自仓内 `cp` 复原后 `GATE_EXIT=0`；两处变异均**只**发生在副本内，主工作区首尾 `git status` 见 §8。

## §6 自曝 / 口径诚实标注 / 残余风险

1. **落点选择（有意保留，须复核）**：判据落在**服务端 `message` 本体**（`extractApiErrorMessage` 三处），**不**对整条拼接后的 `direct` 施加 token 判据。后果 ①：既有 `p7a-ledger-error-i18n.test.js` ③ 的向量（`message='Ledger statement timed out'` + `details.reason='STATEMENT_TIMEOUT'`）仍走 ② 保留 `(STATEMENT_TIMEOUT)` 后缀 —— 其 `message` 本体是**真人英文句、不含机读码**，故**不进 D 类**。若改为对整条 `direct` 施加 token 判据，则该既有用例会由「② 保留原文」变「③ 兜底」= **既有验收面回归**，且与裁定④「保留 O-1 边界」张力更大。**残余登记**：`details.reason` 若为**大写机读码**（如 `STATEMENT_TIMEOUT`），在 ② 路径仍会随 `(reason)` 出现在用户可见串（与 O-1 同族）⇒ 并入「错误文案面收口」工作项。
2. **服务端 `message` 本体不改**（裁定②）：F-1 的真因是后端把**码**塞进了 `message`；本单只做前端护栏收口。⇒ **登记「错误文案面收口」工作项**（与「132 键逐码本地化」同批 P6/P7）。本单**未**触碰 `backend-ts/**`（另一子代理在读）。
3. **纯数字下划线串假阳性**：判据按裁定①逐字实现（`[A-Z0-9_]` 不要求含字母）⇒ `2024_01_02` 这类串同样命中。本仓服务端 `message` 面无此形态；如需收窄可加「含 ≥1 个字母」约束（本单不擅自收窄，登记备查）。
4. **非 ASCII**：`[A-Z0-9_]` 天然排除非 ASCII，故「无非 ASCII」由正则满足；未做中文分词。
5. **适配面**：机读码判据只作用于**错误文案链**（`auth.js`）；未改任何页面/组件的取数分支。
6. **未测项**：无「仓内」未测项（AC 全项有读数）。跨单未测：`backend-ts/**`、`migrations/**`（本单范围外且另一子代理在读写）。

## §7 验收读数（AC）

| 项 | 命令 | 读数 | 判定 |
|---|---|---|---|
| build | `npm run build` | `✓ built in 1.70s` / **EXIT=0** | PASS |
| 单测 | `npm run test:unit` | **30 files / 265 passed**（基线 29/258 ⇒ **+1 文件 +7 例，不掉**） | PASS（≥258） |
| 门 `p4z-i18nviol-global` | `node scripts/...` | **EXIT=0**（locale 2816） | PASS |
| 门 `p6-tr2-i18n-locales` | 同上 | **EXIT=0** | PASS |
| 门 `p4z-miscfix-links` | 同上 | **EXIT=0** | PASS |
| 门 `p4z-feperf-safelist` | 同上 | **EXIT=0**（`VERDICT=PASS`） | PASS |
| 门 `p7a-03-errmessage-gate` | 同上 | **EXIT=0**（扫描 77 / 受体 6 / 命中 3 / 基线 3） | PASS |
| 门 `p7b-errfallback-gate` | 同上 | **EXIT=0**（A=PASS / D 节点 132） | PASS |
| **新门** `p7c-errmsg-machinecode-gate` | 同上 | **EXIT=0**（A=PASS / B=0 / C=4 / D 类级违例=**0/16** / F=0/12 / E=19） | PASS |

> 退出码均**管道外**捕获（`node scripts/X.mjs; echo $?`，非 `| grep` 后的 `$?`）。

## §8 零污染凭据（首尾 `git status`）

**首检**（开工前）：

```
?? backend-ts/.p7bqa-artifacts/
?? docs/qa/p7-b-admin-refund-review.md
（= 另一子代理的产物；本单不动）
```

**尾检**（完工后，仅 `frontend/**`）：

```
 M frontend/scripts/p7b-errfallback-gate.mjs
 M frontend/src/auth.js
?? frontend/scripts/p7c-errmsg-machinecode-gate.mjs
?? frontend/src/test/unit/p7c-errmsg-machinecode.test.js
?? backend-ts/.p7bqa-artifacts/          （另一子代理，未动）
?? docs/qa/p7-b-admin-refund-review.md   （另一子代理，未动）
```

`git diff --stat -- frontend`：`2 files changed, 49 insertions(+), 10 deletions(-)` + 本报告（`docs/audit/p7-c-errmsg-scope.md`）。
**判负变异产物全在仓外副本**（`.../cache/scratch/p7c-neg/`），主工作区无 `.log`、无临时件、无后端实例启停。
