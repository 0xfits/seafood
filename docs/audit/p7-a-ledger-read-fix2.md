# 批 7-A · 收口六报告（`p7-a-ledger-read-fix2`）

> 角色 = **Kong**（Builder） · 轮次 = **批 7-A 第六单（收口六 · 极窄收口）**
> 仓库 = `/Users/kevin/bistro/seafood` · 分支 = `main`
> 开工锚 = 本地提交 **`ae46297`**（已 commit、未 push）
> 本报告**分段落盘**（先骨架、后逐节回填），不以一次性写入收尾。
> 硬口径：身份表一律 `users`（绝不裸 `user`）；SQL 显式 `public.`；未做项写原因、禁填 0/空；转引不得冒充实测。

---

## §0 开工态与未回退声明

**开工态（逐字）**：
- `git log --oneline -1` → `ae46297 fix(api): 批 7-A 收口五 —— ledger 读口 cid/before_txid 非法面统一 R107（cid<=0=>404/cursor 非正=>400 NOT_POSITIVE/严格整数闸）；…（本地未推）`
- `git rev-parse HEAD` → `ae462973918f815b6edc3f53e1e5de116e68854e`
- `git status --porcelain`（**开工**）→ **空**（工作区干净）
- `shasum -a 256 backend-ts/src/index.ts`（开工）→ `c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f`

**★ 本单零仓内变异（硬纪律，针对上轮事故）**：本单**未在主工作区改任何被检文件**。判负变异**只在仓外副本**内施加（见下）；主工作区 `backend-ts/src/index.ts` 全程 sha 恒为 `c4db3627…`（开工 / 收尾两次核对一致）。

**本单只做三件事**：① 最终布局的判负自证（仓外副本内 · 两轮）；② 本报告 `docs/audit/p7-a-ledger-read-fix2.md`；③ 自起实例按精确 PID 收尾。

**「未回退声明」（逐字）**：`ae46297` 已入库内容 —— ① ledger 读口 `cid`/`before_txid` 非法面统一 R107（`cid<=0 ⇒ 404 LEDGER_CURRENCY_NOT_FOUND`；cursor 非正 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason='NOT_POSITIVE'`；严格十进制整数闸 `parseLedgerReadInt`）；② `backend-ts/scripts/p7a-05-ledger-shape.ts` 探针；③ spec v1.8（注册点 65→68 九处回写等）与 `route-layer-v1.8-delta.md`；④ `§5.163`/`v0.163`（`docs/seafood.master-plan.md`）；⑤ `P7A-FIX5-001` 全套产物 —— **均未回退、未重写**。本单未触碰任何 `docs/*.spec.md`、`migrations/**`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**` **既有件**（仅新增本报告）；未 `git add/commit/push`；未 `npm install`；未碰 `.env*`；未改 `backend-ts/src/**` 一行。

### (a) 判负副本与 sha 链（**仓外**）

- 副本根：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p7a-fix6/`
- 被检副本文件：`…/p7a-fix6/backend/src/index.ts`
- 构建方式：`rsync -a --exclude node_modules --exclude .env.local --exclude dist --exclude dist-scripts …` 从 `backend-ts/` 复制；`node_modules` 与 `.env.local` 以**符号链接**指向真仓（避免复制 178M 依赖与私密文件；**真仓 `.env.local` 只读引用、未被改动**）。

| 时点 | 文件名（副本内） | sha256 | 说明 |
|---|---|---|---|
| 复制后（**干净本**） | `…/p7a-fix6/backend/src/index.ts` | `c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f` | 与主工作区**逐字相等**（= 开工 sha） |
| 干净备份 | `…/p7a-fix6/index.PRISTINE.ts` | `c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f` | 供「副本内 `cp` 回」用 |
| **判负变异后** | `…/p7a-fix6/backend/src/index.ts` | `e0d0b43bd5af75beb865fba58c59920b2efefa828e5a2b49868e545f9ca7c025` | NEG 实例所用（`cid` 闸回退） |
| **复原后** | `…/p7a-fix6/backend/src/index.ts` | `c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f` | GREEN 实例所用（`cmp` 与干净备份逐字相等） |

**变异内容（逐字）**：把副本内 `cid` 闸的新 R107 分支整段回退回旧写法 ——
`parseLedgerReadInt` + `sendVerbError(404 LEDGER_CURRENCY_NOT_FOUND / 400 LEDGER_AMOUNT_INVALID)` →
```
    const next = Number(rawCid);
    if (!Number.isInteger(next) || next <= 0) {
      return sendError(res, 400, 'Invalid cid');
    }
    cid = next;
```
**仅** `cid` 闸回退；`before_txid` 闸与 `kind` 闸**保持现状**（故 `before_txid_*`/`kind_*` 在 NEG 轮仍绿 —— 见 §4，此即「只动一轴」的对照）。


---

## §1 现取口径与行号（最终布局 `ae46297`）

**被检文件**：`backend-ts/src/index.ts` · sha256 = `c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f`（开工 / 收尾两次核对一致）。

**最终布局行号（现取 `grep -n` 自核，非转抄）**：

| 项 | 行号 | 逐字 |
|---|---|---|
| 端点注册行 | **`:633`** | `app.get('/api/user/ledger', async (req, res) => {` |
| `parseLedgerReadInt` 用法（`cid` 闸） | **`:651`** | `? parseLedgerReadInt(rawCid)` |
| `parseLedgerReadInt` 用法（`before_txid` 闸） | **`:678`** | `? parseLedgerReadInt(rawBefore)` |
| `parseLedgerReadInt` 定义 | **`:764`** | `const parseLedgerReadInt = (raw: string): { ok: true; value: bigint } \| { ok: false; reason: string } => {` |

**冻结裁定（写入报告，本单不得改写）**：
1. `cid=0` / `cid=-5` ⇒ **404 `LEDGER_CURRENCY_NOT_FOUND`**（裁定 §5.16：**形状合法但不存在**；`currency.cid` 是正整数序列，`≤0` 构造上不存在；与 `toCid` / DB 侧 `ledger_cid_arg` 逐字一致）。
2. `before_txid=-9` ⇒ **400 + `reason='NOT_POSITIVE'`**（`before_txid` 是 keyset 游标、**无实体** ⇒ 不适用 §5.16 的「不存在 ⇒ 404」；该 `reason` 为**诊断值、已登记**，调用方**只按 `code` 分支** —— §5.17 R-2）。
3. **严格整数字面量**（拒 `1e3` / `0x10` / `1.0` / 空白）⇒ **400**；**空串 / 缺省仍按「未给」处理**（回落「不过滤」，与 `limit` 空串回落默认同族）。

**DB 侧同族判据的现成 `reason` 枚举（现取 `grep -n`，法源自核）**：

- `ledger_int_amount(text, text)` —— 定义 `migrations/0005_ledger_event_root_key.sql:340`（与 `migrations/0004_ledger_post_event.sql:164` 同源重定义）。其 `reason` 取值：
  `MISSING`（`0005:345`，「缺失/`NULL`」）· `NOT_DECIMAL_INTEGER`（`0005:350`，非 `^-?[0-9]+$`）· `OVER_MAX_SINGLE_AMOUNT`（`0005:354`，长度 > 19 位）· `OUT_OF_BIGINT_RANGE`（`0005:360`，`numeric` 查界后超 `bigint`）。
- `ledger_cid_arg(text)` —— 定义 `migrations/0004_ledger_post_event.sql:276`：`v_c := ledger_int_amount(p_raw,'cid')` 后 `IF v_c <= 0 THEN ledger_raise('LEDGER_CURRENCY_NOT_FOUND', {"cid": v_c::text})` ⇒ **形状闸（400 族）** 与 **`≤0 ⇒ 404`** **同函数内串联** —— 即 TS 侧新闸（形状 `:651`/`:662`、`≤0 :662-670`）与之**逐格同判**。
- 同族另两个（**金额**专用、TS 侧不复制 ⇒ §5 登记）：`ledger_parse_user_amount` 的 `EXPONENT_NOT_ALLOWED`（`0005:390`）与 `NOT_DECIMAL_STRING`（`0005:394`）；负金额 `LEDGER_AMOUNT_NOT_POSITIVE`（`0005:382/414/465`）。
- 另：`0005:204` 的 `MISSING_REQUIRED_FIELD`、`0005:478` 的 `CASE WHEN p_payload ? 'amount' THEN 'NOT_STRING' ELSE 'MISSING' END`。

> **TS↔DB 差异（登记、不改）**：DB 侧对 **> 19 位**先撞 `OVER_MAX_SINGLE_AMOUNT`，TS `parseLedgerReadInt` 用真 `bigint` 界 ⇒ 19~20 位区间两者 `reason` 名可能不同（**同码 `LEDGER_AMOUNT_INVALID` / 同 `400`，仅 `reason` 名不同** ⇒ 依 `code` 分支规则不构成契约分歧）。本单不改。

---

## §2 改动清单（`git diff --numstat` 对 `ae46297`）

**读数（逐字捕获，退出码在管道外）**：

```
$ git diff --numstat            # 工作区 vs HEAD
(空)  ⇒ 0 文件 0 增 0 删          exit=0
$ git diff --numstat ae46297    # 工作区 vs 开工锚
(空)  ⇒ 0 文件 0 增 0 删          exit=0
```

⇒ **对 `ae46297` 而言，本单的代码改动清单为空：0 文件 / +0 / −0**（本单为**报告 + 仓外副本取证**单，不改任何被跟踪文件）。

**本单对工作区的唯一落盘 = 本报告（新建、untracked）**：`docs/audit/p7-a-ledger-read-fix2.md`。
**被检/被改文件**：无（`backend-ts/src/index.ts` 全程 sha = `c4db3627…`，与 `ae46297` 逐字相等）。

**全部变异/取证产物均落仓外**（`…/cache/scratch/p7a-fix6/`）：副本 `backend/src/index.ts`、干净备份 `index.PRISTINE.ts`、探针产物 `run-neg/` `run-green/`、stdout `p7a-06-neg-stdout.txt` / `p7a-06-green-stdout.txt`、服务日志 `serve-neg-5793.txt` / `serve-green-5794.txt`、`senderror-inventory-FINAL.json`。

---

## §3 AC 逐格读数

> **来源实例**：**GREEN 轮**（复原后 · 端口 `5794` · 进程 `node …/p7a-fix6/backend/node_modules/.bin/ts-node --transpile-only src/index.ts`，src sha256 = **`c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f`**）。
> 探针 = `backend-ts/scripts/p7a-05-ledger-shape.ts`（以 `--transpile-only` 运行，**逐字未改**）；产物 `…/p7a-fix6/run-green/p7a-05-ledger-shape-run-green.json`。
> fixture：`uid=970001`（`ledger_entry` 120 行）；`real_txid=99` / `real_cid=16`；`secret_fp=b1ec01afb2eb`。

### AC① —— 非法入参 ⇒ **R107 形状**（逐例给完整响应体，逐字）

五例（本片判据轴；另附第 6 例 `kind_nope` 作**同形对照**，其 R107 面系既有、非本片所改）：

**① `cid=abc`** — `GET /api/user/ledger?cid=abc` · **HTTP 400**
```json
{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"cid shape is invalid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"cid","reason":"NOT_DECIMAL_INTEGER"}}}
```
`error_keys=["code","message","i18n_key","details"]` · `top_keys=["error"]` · `r107_shape=true` · `top_only_error=true`

**② `cid=0`** — `GET /api/user/ledger?cid=0` · **HTTP 404**
```json
{"error":{"code":"LEDGER_CURRENCY_NOT_FOUND","message":"currency not found","i18n_key":"ledger.err.LEDGER_CURRENCY_NOT_FOUND","details":{"cid":"0"}}}
```
`error_keys=["code","message","i18n_key","details"]` · `top_keys=["error"]` · `r107_shape=true` · `top_only_error=true`

**③ `cid=-5`** — `GET /api/user/ledger?cid=-5` · **HTTP 404**
```json
{"error":{"code":"LEDGER_CURRENCY_NOT_FOUND","message":"currency not found","i18n_key":"ledger.err.LEDGER_CURRENCY_NOT_FOUND","details":{"cid":"-5"}}}
```
`error_keys=["code","message","i18n_key","details"]` · `top_keys=["error"]` · `r107_shape=true` · `top_only_error=true`

**④ `before_txid=xyz`** — `GET /api/user/ledger?before_txid=xyz` · **HTTP 400**
```json
{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"before_txid shape is invalid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"before_txid","reason":"NOT_DECIMAL_INTEGER"}}}
```
`error_keys=["code","message","i18n_key","details"]` · `top_keys=["error"]` · `r107_shape=true` · `top_only_error=true`

**⑤ `before_txid=-9`** — `GET /api/user/ledger?before_txid=-9` · **HTTP 400**
```json
{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"before_txid must be a positive txid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"before_txid","reason":"NOT_POSITIVE","value":"-9"}}}
```
`error_keys=["code","message","i18n_key","details"]` · `top_keys=["error"]` · `r107_shape=true` · `top_only_error=true`

**（对照）⑥ `kind=__nope__`** — `GET /api/user/ledger?kind=__nope__` · **HTTP 400**
```json
{"error":{"code":"LEDGER_UNKNOWN_KIND","message":"unsupported ledger kind","i18n_key":"ledger.err.LEDGER_UNKNOWN_KIND","details":{"kind":"__nope__"}}}
```
`error_keys=["code","message","i18n_key","details"]` · `top_keys=["error"]` · `r107_shape=true` · `top_only_error=true`

⇒ **AC① 全绿**：五例（+对照例）**键集逐字 = `code,message,i18n_key,details`**、**顶层键恰 `["error"]`**、状态码 **400/400/404/400/400（+400）** 与裁定逐格一致。

### AC② —— 合法入参 ⇒ **200 + `next_before_txid` 键在**（前后对照：与 `238bc01` 行为面逐格一致）

| 用例 | path | status | top_keys | count | next_before_txid |
|---|---|---|---|---|---|
| plain | `/api/user/ledger` | 200 | `["success","message","data","next_before_txid"]` | 100 | 36 |
| cid_real | `/api/user/ledger?cid=16` | 200 | `["success","message","data","next_before_txid"]` | 7 | `null` |
| before_real | `/api/user/ledger?before_txid=99` | 200 | `["success","message","data","next_before_txid"]` | 34 | `null` |
| kind_transfer | `/api/user/ledger?kind=transfer` | 200 | `["success","message","data","next_before_txid"]` | 6 | `null` |
| limit_abc | `/api/user/ledger?limit=abc` | 200 | `["success","message","data","next_before_txid"]` | 100 | 36 |
| empty_vals | `/api/user/ledger?cid=&before_txid=&kind=` | 200 | `["success","message","data","next_before_txid"]` | 100 | 36 |

⇒ **AC② 全绿**：六例 `status=200`、顶层键含 `next_before_txid`；**空串 `cid=&before_txid=&kind=` 回落「未给」**（count=100 / next=36，与 `plain` 同）；`limit=abc` 回落默认 100 —— 均与「空串/缺省=未给」的裁定一致。
（**对照说明**：`plain`/`limit_abc`/`empty_vals` 三例读数相同 ⇒ 佐证「非法 `limit` 与空串回落默认、不报错」的既有口径未变。）

---

## §4 判负自证（本单 ① 的两轮 · 仓外副本）

> **纪律声明**：全部变异**只在仓外副本** `…/p7a-fix6/backend/src/index.ts` 内施加；**主工作区被检文件全程零改动**（开工/收尾 sha 均 = `c4db3627…`）。探针 `p7a-05-ledger-shape.ts` **逐字未改**、两轮同一份。

### §4.1 第一轮 · 判负（NEG）：`cid` 闸回退 ⇒ 探针**必红**

- **实例**：端口 `5793` · 精确 PID `48965` · 进程 = `node …/p7a-fix6/backend/node_modules/.bin/ts-node --transpile-only src/index.ts`。
- **该实例 src sha256** = **`e0d0b43bd5af75beb865fba58c59920b2efefa828e5a2b49868e545f9ca7c025`**（= 回退后）。
- **命令**：`node_modules/.bin/ts-node --transpile-only scripts/p7a-05-ledger-shape.ts …/run-neg http://127.0.0.1:5793`
- **退出码 = `1`**（**EXIT=1**）· `verdict = FAIL` · `failures = 8`（逐条，逐字）：

```json
{
 "run": "run-neg",
 "verdict": "FAIL",
 "failures": 8,
 "fails": [
  "AC1 cid_abc ⇒ R107 键集 code,details,i18n_key,message :: []",
  "AC1 cid_abc ⇒ 顶层键恰 [\"error\"] :: [\"success\",\"message\",\"error\"]",
  "AC1 cid_zero ⇒ status=404 :: 400",
  "AC1 cid_zero ⇒ R107 键集 code,details,i18n_key,message :: []",
  "AC1 cid_zero ⇒ 顶层键恰 [\"error\"] :: [\"success\",\"message\",\"error\"]",
  "AC1 cid_neg5 ⇒ status=404 :: 400",
  "AC1 cid_neg5 ⇒ R107 键集 code,details,i18n_key,message :: []",
  "AC1 cid_neg5 ⇒ 顶层键恰 [\"error\"] :: [\"success\",\"message\",\"error\"]"
 ]
}
```

**红项归类（与派单要求逐条对上）**：
- **R107 键集红** ×3（`cid_abc`/`cid_zero`/`cid_neg5`：`error_keys=[]` ≠ `code,details,i18n_key,message`）；
- **顶层键红** ×3（旧形状顶层键 = `["success","message","error"]` ≠ `["error"]`）；
- **`cid=0/-5` 期望 404 红** ×2（`cid_zero` 与 `cid_neg5` 实测 **400**，期望 **404**）。

**该轮 `cid` 三例的完整响应体（旧形状，逐字）**：
```json
cid=abc  → {"success":false,"message":"Invalid cid","error":"Invalid cid"}   (HTTP 400)
cid=0    → {"success":false,"message":"Invalid cid","error":"Invalid cid"}   (HTTP 400)
cid=-5   → {"success":false,"message":"Invalid cid","error":"Invalid cid"}   (HTTP 400)
```
**对照：`before_txid_xyz` / `before_txid_neg9` / `kind_nope` 在本轮仍 `r107_shape=true` / `200?=否` —— 即「只回退 `cid` 一轴」的对照成立**（这三例两轮读数一致，未受变异影响）。

### §4.2 第二轮 · 复原（GREEN）：副本 `cp` 回干净本 ⇒ 探针**必绿**

- **复原动作**：`cp …/p7a-fix6/index.PRISTINE.ts …/p7a-fix6/backend/src/index.ts`；`cmp index.PRISTINE.ts backend/src/index.ts` ⇒ **逐字相等**；sha 回 **`c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f`**。
- **实例**：端口 `5794` · 精确 PID `49427` · 同命令面。
- **该实例 src sha256** = **`c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f`**（= 干净本）。
- **命令**：`… --transpile-only scripts/p7a-05-ledger-shape.ts …/run-green http://127.0.0.1:5794`
- **退出码 = `0`**（**EXIT=0**）· `verdict = PASS` · `failures = 0`：

```json
{ "run": "run-green", "verdict": "PASS", "failures": 0, "fails": [] }
```

### §4.3 两轮汇总（退出码 + src sha256）

| 轮 | 端口 | 精确 PID | 副本 src sha256 | 退出码 | verdict | failures |
|---|---|---|---|---|---|---|
| **NEG** | 5793 | 48965 | `e0d0b43b…`（回退 `cid` 闸） | **1** | **FAIL** | **8** |
| **GREEN** | 5794 | 49427 | `c4db3627…`（复原=干净本） | **0** | **PASS** | **0** |

⇒ **判负成立**：同一探针、同一 fixture，仅 `cid` 闸一轴回退即 **8 条红**（其中 `cid=0/-5` 的 `400≠404` 直证裁定①），复原即 **0 红** —— 即本片 AC① 判据**对 `cid` 闸具判别力**，非恒真。

---

## §5 `sendError` 同族清单 26 处逐条判定（全部既有面、不修）

**口径**：`sendError` 定义 `backend-ts/src/index.ts:116-120` = `res.status(statusCode).json({ success:false, message, error:message })` ⇒ **旧形状 `{success,message,error}`（非 R107）**。全仓仅 `index.ts` 一处定义、一处使用文件（`grep -rn '\bsendError\(' backend-ts/src --include=*.ts` ⇒ 27 命中，其中 `:464` 为**注释行**、`const sendError` 为**定义行** ⇒ **实调用 = 26 处**）。本清单在**最终布局**（sha `c4db3627…`）用脚本重生成（`…/p7a-fix6/senderror-inventory-FINAL.json`），**非**转引 `P7A-FIX5-001/senderror-inventory.json`（后者行号在 `:600` 之后**整体偏移 −5**，系早期版本所产，本单不采用）。

**判定总则**：以下 26 处**全部为既有面**（非批 7-A 读口所增），**本单一律不修**（本单只做报告 + 判负取证，无代码授权）；逐条给「路由 / 调用行 / status / message 逐字 / 判定」。

| # | 调用行 | status | 路由（注册行 · 方法 路径） | message（逐字） | 判定 |
|---|---|---|---|---|---|
| 1 | `:391` | 410 | `:390` · POST `/api/auth/register` | `'Registration has moved to wallet sign-in plus profile completion'` | 旧形状；弃用端点固定文案；**保留** |
| 2 | `:399` | 400 | `:394` · POST `/api/auth/challenge` | `error instanceof Error ? error.message : 'Failed to create auth challenge'` | 旧形状；**回显 `error.message`**（异常文案直出）⇒ 登记 |
| 3 | `:421` | 401 | `:403` · POST `/api/auth/verify` | `error instanceof Error ? error.message : 'Failed to verify auth challenge'` | 旧形状；**回显 `error.message`**；登记 |
| 4 | `:504` | 400 | `:500` · GET `/api/task/:tID` | `'Invalid tID'` | 旧形状；硬编码英文；登记 |
| 5 | `:533` | 400 | `:529` · GET `/api/prize/:bID` | `'Invalid bID'` | 旧形状；硬编码英文；登记 |
| 6 | `:538` | 404 | `:529` · GET `/api/prize/:bID` | `'Prize not found'` | 旧形状；登记 |
| 7 | `:572` | 400 | `:566` · POST `/api/user/profile` | `'bio is required'` | 旧形状；硬编码英文；登记 |
| 8 | `:578` | 404 | `:566` · POST `/api/user/profile` | `'User not found'` | 旧形状；登记 |
| 9 | `:598` | 400 | `:594` · GET `/api/user/asset/:uID` | `'Invalid user ID'` | 旧形状；硬编码英文；登记 |
| 10 | `:853` | 400 | `:849` · GET `/api/task-progress/:jID` | `'Invalid jID'` | 旧形状；硬编码英文；登记 |
| 11 | `:858` | 404 | `:849` · GET `/api/task-progress/:jID` | `'Task progress not found'` | 旧形状；登记 |
| 12 | `:879` | 400 | `:870` · POST `/api/task-progress/:identifier/submit` | `'Invalid task or task progress id'` | 旧形状；硬编码英文；登记 |
| 13 | `:883` | 400 | `:870` · POST `/api/task-progress/:identifier/submit` | `'info_input is required'` | 旧形状；硬编码英文；登记 |
| 14 | `:951` | 500 | `:940` · GET `/api/shard` | `'Failed to load shard holdings'` | 旧形状；**硬编码 500**（IO catch 族，D1' 同族）；登记 |
| 15 | `:966` | 500 | `:955` · GET `/api/shard/transfer` | `'Failed to load shard transfers'` | 旧形状；**硬编码 500**；登记 |
| 16 | `:1087` | 400 | `:1084` · GET `/api/market/:bID/orderbook` | `'Invalid bID'` | 旧形状；硬编码英文；登记 |
| 17 | `:1104` | 400 | `:1101` · GET `/api/market/:bID/trades` | `'Invalid bID'` | 旧形状；硬编码英文；登记 |
| 18 | `:1168` | 400 | `:1142` · POST `/api/admin/settings` | `error instanceof Error ? error.message : 'Failed to save system settings'` | 旧形状；**回显 `error.message`**；登记 |
| 19 | `:1225` | 400 | `:1199` · POST `/api/admin/permissions/save` | `error instanceof Error ? error.message : 'Failed to save permission group'` | 旧形状；**回显 `error.message`**；登记 |
| 20 | `:1247` | 400 | `:1229` · POST `/api/admin/permissions/delete` | `error instanceof Error ? error.message : 'Failed to delete permission group'` | 旧形状；**回显 `error.message`**；登记 |
| 21 | `:1269` | 400 | `:1251` · POST `/api/admin/user/update` | `error instanceof Error ? error.message : 'Failed to update user'` | 旧形状；**回显 `error.message`**；登记 |
| **22** | **`:1482`** | 400 | **`:1472` · POST `/api/admin/points/adjust`** | **`'参数不完整'`** | 旧形状；★**硬编码中文 message** ⇒ **非 R107、待批（仅登记）**（见下「点名」） |
| 23 | `:1763` | 400 | `:1755` · POST `/api/job/:jobId/submit` | `'info_input is required'`（行末注「与既有 `:595` 逐字一致（别名面）」） | 旧形状；硬编码英文；登记 |
| 24 | `:1987` | 503 | `:1984` · POST `/api/translate/backfill` | `'CRON_SECRET not configured'` | 旧形状；登记 |
| 25 | `:1993` | 401 | `:1984` · POST `/api/translate/backfill` | `'Unauthorized'` | 旧形状；登记 |
| 26 | `:2042` | 404 | `:1984` · POST `/api/translate/backfill` | `'Not found'` | 旧形状；兜底 404；登记 |

**★ 点名（仅登记、本单不修）**：第 **22** 处 —— `POST /api/admin/points/adjust`（注册行 **`:1472`**）的守卫 `:1481`（`if (!uID || Number.isNaN(amount) || !reason)`）在 **`:1482`** 抛 **`sendError(res, 400, '参数不完整')`**：
- message = **硬编码中文字面量「参数不完整」**，且走 **旧形状 `{success,message,error}`** ⇒ **非 R107**（与同文件 `sendVerbError`/`sendError` 混用面同族）。
- **行号勘误**：派单文引作 `:1477`，该值系 `P7A-FIX5-001/senderror-inventory.json` 的**早期版本行号**（该 artifact 在 `:600` 后整体 −5）；**最终布局现取 = `:1482`**（注册行 `:1472`）。
- 处置 = **只登记、待批**（本单无代码授权、且属既有面）。

**这 26 处为什么「不修」**：① 本单授权 = 报告 + 判负取证（**禁改代码**）；② 这些面**均非**批 7-A 读口改动面（读口已由 `ae46297` 收敛为 R107，其内部**已不调用 `sendError`**——读口 `:633-716` 现取零 `sendError(`）；③ 「`sendError` 旧形状面收敛为 R107」是**类级工作项**，应按「错误码命名整理 / 形状统一」在独立单内按类推进（引 `docs/ledger.spec.md` §14.3 v0.7 增补块 (C) 的「关闭集词汇中心化」口径），不在本极窄收口单内。

---

## §6 未做与 `NOT_MEASURED`

> 口径：本单**未跑任何硬门**（授权面 = 报告 + 判负取证）。凡未跑者标 `NOT_MEASURED` + 原因，**禁填 0 / 空**；凡顺带跑到的读数（本单 = 探针两轮）已在 §4 原样给出。

| 项 | 状态 | 原因（逐字） |
|---|---|---|
| G1 `npx tsc --noEmit`（后端 `src/**`） | `NOT_MEASURED` | 本单**不改代码**（`git diff --numstat` = 空）⇒ `src/**` 类型面无变化；硬门口径⑥「不必全量重跑」。**未跑，故不给读数**。 |
| G2 `npx tsc -p tsconfig.scripts.json` | `NOT_MEASURED` | 本单**未增/改任何脚本**（探针 `p7a-05-ledger-shape.ts` 逐字未改）；该项为**既有债**（`ae46297` 时 22 文件 / 77 条），读数见收口四报告 §5.3。本单**未重跑**。 |
| G3 离线门 `p4z-tr1a-01-offline-tests.ts` | `NOT_MEASURED` | 本单不动后端行为 ⇒ **未跑**。 |
| G4 `npm run build`（frontend） | `NOT_MEASURED` | 本单不动前端 ⇒ **未跑**。 |
| G5 `npm run test:unit` | `NOT_MEASURED` | 本单不动前端/后端被单测覆盖面 ⇒ **未跑**。 |
| G6–G9 四脚本门（`i18nviol` / `i18n-locales` / `miscfix-links` / `feperf-safelist`） | `NOT_MEASURED` | 本单不动其扫描面 ⇒ **未跑**。 |
| G10 类级门 `p7a-03-errmessage-gate.mjs` | `NOT_MEASURED` | 本单不动前端取数面 ⇒ **未跑**。 |
| 浏览器级 E2E（Playwright `test:e2e`） | `NOT_MEASURED` | 需 dev server + 浏览器 + 登录态；本单硬门口径不含 e2e ⇒ **未跑**。 |
| DB 侧 `ledger_cid_arg` / `ledger_int_amount` **直连实测**（`cid=0/-5` 等） | `NOT_MEASURED`（**本单**） | 本单取证面 = **HTTP 层**（探针经 `:5794` 实例）；DB 侧读数**未在本单位内重跑**（其历史读数见 `docs/ledger.spec.md` §14.3 对拍表，两轮 `I0AUQ/I5JZU`）。**不转引为「本单实测」**。 |
| TS↔DB 对 **> 19 位** `reason` 名差异的联测 | **未覆盖（登记）** | 见 §1 末注：同码同 status、仅 `reason` 名不同；按「只按 `code` 分支」规则**不构成契约分歧**，本单**未**构造 19~20 位边界输入。 |
| 并发质检方实例（`5796`）的行为 | **未测（非本单面）** | 该实例属质检方（见 §7.6），本单**未触碰、未测**。 |

---

## §7 自曝

1. **★ 上轮（收口五）事故的如实记述与本轮防范**：**上轮我把判负变异直接施加在主工作区被检文件 `backend-ts/src/index.ts` 上**，随后撞到调用上限 ⇒ **仓库被留在「已变异未复原」的弄坏态**，由**派单方亲自复原**（复原后 sha 归 `c4db3627…`、注册行 `:633`、注册点 68）。**这是我的直接责任，不推诿。**
   **本轮的防范（已落实）**：① 全部变异**只在仓外副本** `…/p7a-fix6/backend/src/index.ts` 内施加（§0(a)/§4）；② 主工作区被检文件**开工 / 收尾两次 sha 均 = `c4db3627…`**、`git status` 两次核对；③ 变异采用「**先备份 `index.PRISTINE.ts` → 改副本 → 跑 → `cp` 回 → `cmp` 逐字相等**」的**可复原链**，且复原动作在 §4.2 有独立读数；④ 收尾按**精确 PID**（`48965` / `49427`）关闭实例。**若再次撞上限，主工作区仍为零污染**。
2. **收尾 `git status --porcelain` 非空（诚实登记）**：开工时为空；收尾时 = 两个 **untracked**：
   `?? docs/audit/p7-a-ledger-read-fix2.md`（**本单交付物**）与 `?? docs/qa/p7-a-ledger-read-review.md`（**非本单** —— 并行**质检方（Neng）**的落盘件，其头注自陈「被检对象 `ae46297` / 质检方 Neng / 固定副本 `qa-p7a-final` / 实例 `5796`」，`mtime = 15:41`）。⇒ **本单零 tracked 改动**（`git diff --numstat` 空），唯一新增 tracked 面文件为**本报告**；该 `docs/qa` 件**非我所产、我未触碰**。
3. **行号勘误（不冒从）**：派单文引 `sendError` 同族里 `points/adjust` 为 `:1477`；**最终布局现取 = `:1482`**（注册行 `:1472`）。差异源 = `P7A-FIX5-001/senderror-inventory.json` 系**早期版本**所产、其 `:600` 之后行号**整体 −5**（§5 已说明，并以脚本重生成当前布局清单）。**本报告一律用现取行号**。
4. **本单探针两轮的边界**：判负只回退了 **`cid` 一轴**（`before_txid` / `kind` 轴**未**做变异判负）⇒ **`before_txid` 闸与 `kind` 闸的「可判负性」本单未证**（它们在 NEG 轮保持绿，是**对照**而非**判负**）。派单只要求 `cid` 闸的红/绿读数，故未越界构造其余轴（登记此项，避免读成「全闸均已判负」）。
5. **副本以 symlink 复用真仓 `node_modules` / `.env.local`（只读）**：为免复制 178M 依赖与私密文件，副本的 `node_modules`、`.env.local` 为**指向真仓的符号链接**；**真仓 `.env.local` 未被读写修改**（仅被 dotenv 只读加载）。副作用：副本内两文件的「内容」即真仓内容 ⇒ 依赖/密钥面**非隔离**，但**变异面（`src/index.ts`）完全隔离**。**如实声明，不称「全隔离」。**
6. **端口现场归属为命令行推断（非核对确认）**：收尾 `lsof -nP -iTCP:5793-5799` 显示**本单端口 5793 / 5794 已空**，仅 **`5796` 有监听**（`PID 47921`，`started 15:41:14`，`node ./node_modules/.bin/ts-node src/index.ts`）。据其启动时刻与我方进程无关（我方 `ps | grep p7a-fix6` ⇒ 空）+ 质检方报告自陈实例 `5796` ⇒ 判为**质检方实例**，**本单未触碰**。5787 空；5788 = 既有 dev（`PID 65096`，他单）**未启停**。全程**未用** `pkill -f` / `killall`。
7. **未跑硬门（§6）如实标注、不转引**：本单对 G1–G10 **均未重跑**，一律 `NOT_MEASURED`；收口四/五的读数**本单未转引冒充实测**。

---

### 附：本单产物路径（原始输出**无 `.log` 后缀**）

- **交付报告**：`docs/audit/p7-a-ledger-read-fix2.md`（本件）
- **判负取证工作区（仓外）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p7a-fix6/`
  - 副本被检件：`backend/src/index.ts`（NEG 时 `e0d0b43b…` / GREEN 时 `c4db3627…`）
  - 干净备份：`index.PRISTINE.ts`（`c4db3627…`）
  - 探针产物：`run-neg/p7a-05-ledger-shape-run-neg.json`、`run-green/p7a-05-ledger-shape-run-green.json`
  - 探针 stdout：`p7a-06-neg-stdout.txt`、`p7a-06-green-stdout.txt`
  - 实例日志：`serve-neg-5793.txt`、`serve-green-5794.txt`
  - 清单：`senderror-inventory-FINAL.json`（最终布局 26 处；sha `c4db3627…`）
- **主工作区被检件**：`backend-ts/src/index.ts`（sha 恒 `c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f`，**零改动**）
- **库侧残留**：本单探针**零 DB 写**（仅 `SELECT`）⇒ 无测试数据、无残留。
