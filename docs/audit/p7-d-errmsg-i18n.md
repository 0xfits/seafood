# 批 7-D · 错误文案面收口（`ledger.err.*` 33 码四语本地化 + reason 机读码收口 R1′ + 页面级直拼 toast 归护栏 + 新类级判据）· 交付报告

> 作者：**Kong** · 仓库 = `/Users/kevin/bistro/seafood` · 交付 sha = **`f0bd336`**（本地入库，未推送）
> 本单 = **批 7-D 收口**：**只补本报告 + 重跑判负取红读数；`f0bd336` 之后不改任何被检代码**（`frontend/src/**`、`frontend/scripts/**`、`frontend/src/test/**` 一字未动）。
> 硬口径：**未 `git add/commit/push`**；`npm` 只读向（`build` / `test:unit` / `npx vitest run` 指定件 / `node scripts/*.mjs`）；**未 `npm install`**；未碰/未打印 `.env*`；未用 `pkill -f` / `killall`；未启停 5787/5788；**判负只在仓外副本内做**（`git worktree` 于 scratch）。
> 读数一律「命令 → 退出码 → 原文摘录」。未测项写原因（§7），**禁填 0 或空**。

---

## §0 元信息

### §0.1 本单（收口单）开工 / 收尾态（逐字）

**开工态**
```
$ git status --porcelain
（空 —— 工作区干净）
$ git rev-parse HEAD
17f4a237b14b5ad8105f609d601c9e664137d263
$ git log --oneline -1
17f4a23 docs: 批 7-D 我亲核盘面通过 + 两处回执失真登记 + 批 7-E 降级为规范澄清 + §5.171/v0.171
```
⇒ 交付 sha `f0bd336` 已被派单方**亲核通过并本地入库**，其后紧接一条 docs 提交 `17f4a23`（登记本单两处回执失真）；工作区干净 ＝ 对锚成立。

**收尾态**（见 §7.3 逐字）：`git status --porcelain` 仅一条本报告为未跟踪；HEAD 仍 = `17f4a23…`（本单不提交）。

### §0.2 被改面清单（现取）

```
$ git show --stat f0bd336
commit f0bd33655bdbb5d7fb9c90d5adc8e7f9c5a3f631
Author: Kevin <kevin@BlueSpace.local>
Date:   Fri Oct 2 19:40:38 2026 +0800
...
 frontend/scripts/p7a-03-errmessage-gate.mjs        |  16 +-
 frontend/scripts/p7b-errfallback-gate.mjs          |  42 ++++-
 frontend/scripts/p7c-errmsg-machinecode-gate.mjs   | 174 +++++++++++++++++++--
 frontend/src/auth.js                               |  12 +-
 frontend/src/components/ActiveTaskModal.jsx        |  10 +-
 frontend/src/components/ClaimRewardModal.jsx       |   7 +-
 frontend/src/locales/en.json                       |  35 +++++
 frontend/src/locales/hk.json                       |  35 +++++
 frontend/src/locales/vn.json                       |  35 +++++
 frontend/src/locales/zh.json                       |  35 +++++
 frontend/src/pages/TaskPage.jsx                    |  14 +-
 frontend/src/test/unit/auth.test.js                |  21 +++
 frontend/src/test/unit/i18n-batch-b4a.test.jsx     |   2 +-
 frontend/src/test/unit/i18n-batch-b4b.test.jsx     |   6 +-
 frontend/src/test/unit/i18n-batch-b5.test.jsx      |   6 +-
 .../src/test/unit/i18n-violation-closeout.test.jsx |   4 +-
 frontend/src/test/unit/p7a-ledger-error-i18n.test.js |  11 +-
 frontend/src/test/unit/p7b-errfallback.test.js     |  42 ++++-
 frontend/src/test/unit/p7c-errmsg-machinecode.test.js |  97 ++++++++++--
 19 files changed, 540 insertions(+), 64 deletions(-)
```

被改面分四类：
1. **文案面**：`frontend/src/locales/{zh,en,hk,vn}.json` 各 **+35 键**（`ledger.err.*` **33 码** + 顶层注释不动；4 语 flat **704 ⇒ 737**）。
2. **链路面**：`frontend/src/auth.js`（批 7-D R1′ —— `details.reason` 施机读码判据，命中则**不附加 `(reason)` 后缀**）；`frontend/src/components/{ActiveTaskModal,ClaimRewardModal}.jsx`、`frontend/src/pages/TaskPage.jsx`（页面级直拼 toast 归护栏，改走 `apiErrorMessage`）。
3. **门面**：`frontend/scripts/{p7a-03-errmessage-gate,p7b-errfallback-gate,p7c-errmsg-machinecode-gate}.mjs`（新增类级判据 G 段）。
4. **单测面**：`frontend/src/test/unit/{auth,i18n-batch-b4a,i18n-batch-b4b,i18n-batch-b5,i18n-violation-closeout,p7a-ledger-error-i18n,p7b-errfallback,p7c-errmsg-machinecode}.test.js(x)`。

### §0.3 本单（收口单）亲跑读数（非采信回执）

| 项 | 命令 | 读数 | 判 |
|---|---|---|---|
| build | `npm run build` | `✓ built in 1.60s` / **EXIT 0** | PASS |
| 单测 | `npm run test:unit` | `Test Files 30 passed (30)` / `Tests 268 passed (268)` / **EXIT 0** | PASS |
| 七门 | 见 §0.4 | 七门全 **EXIT 0** | PASS |

### §0.4 七门（我亲跑，逐门 EXIT 码）

| # | 门 | 现取读数（逐字摘录） | EXIT |
|---|---|---|---|
| 1 | `node scripts/p4z-i18nviol-global.mjs` | `总判：PASS（locale 裸命中 0 + 源面裸命中 0…；作用域节点数 locale=2948 / source=37）` | 0 |
| 2 | `node scripts/p6-tr2-i18n-locales.mjs` | `zh: top=102 flat=737` / `[TR-2] 键集相等：PASS（四文件拍平键数取值集合 = {737}）` / `总判：PASS` | 0 |
| 3 | `node scripts/p4z-miscfix-links.mjs` | `残留 = 1`（已登记）/ `未登记残留 = 0` / `总判：PASS` | 0 |
| 4 | `node scripts/p4z-feperf-safelist.mjs` | `VERDICT=PASS`（`dist_css = dist/assets/index-mRq3HT-x.css`，与本次 build 产物同名） | 0 |
| 5 | `node scripts/p7a-03-errmessage-gate.mjs` | `总判：PASS（未登记命中 0 必须 = 0；扫描文件 77 / 受体 6 / 命中 0 / 基线 0）` | 0 |
| 6 | `node scripts/p7b-errfallback-gate.mjs` | `总判：PASS（判负 0 必须 = 0；A=PASS / B 含裸键值=0 / C 兜底键=2×4 / D 节点=132 需护栏=0 已本地化=132 / G 键不可用=0/132 / E 样本=17）` | 0 |
| 7 | `node scripts/p7c-errmsg-machinecode-gate.mjs` | `总判：PASS（判负 0 必须 = 0；A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）` | 0 |

---

## §1 ★ 两口径数（**必须同时给并标口径**）

本批有**两个不同量纲的数**，极易被混用；本节把两数的**口径、命令、读数**并列冻结。

| 口径 | 数 | 定义（量纲） | 现取命令 | 现取读数 |
|---|---|---|---|---|
| **(a) 码面** | **33** | 错误码**闭集**大小 ＝ 每语 `ledger.err.*` **键数**（33 码 × 1 语） | `node -e 'for(const l of ["zh","en","hk","vn"]){const e=JSON.parse(require("fs").readFileSync("src/locales/"+l+".json","utf8")).ledger.err;console.log(l,Object.keys(e).length)}'` | `zh 33 / en 33 / hk 33 / vn 33` |
| **(b) 节点面** | **132** | 代码里带 `ledger.err.*` 引用、**需护栏判定**的**行为节点**数 ＝ 33 码 × 4 语 ⇒ 「**33 码 × 4 语 = 132 个文案值**」 | `node scripts/p7b-errfallback-gate.mjs`（D / G 段计数） | `D：节点 = 132；「未命中 ⇒ 依赖护栏」= 0；「已本地化 ⇒ 护栏让位」= 132`；`G：节点 = 132（33 码 × 4 语）；不可用 = 0` |

**逐字写清关系**：
- **33 码 × 4 语 = 132 个文案值** —— 这是 **(b) 节点面**的算法（每个 (code, lang) 是一条待判定文案值）。
- **节点面 132** 与 **(a) 码面 33** 是**不同口径**：33 是「**码/键的种数**」（不随语种变），132 是「**码 × 语 的行为节点实例数**」（随语种线性放大 ×4）。**二者不相等、不可互替**。
- **★ 勘误声明**：本单上一轮（被截断的）回执把 `keys_enumerated` 写成 **132** 当作**键数** —— 这是把 **(b) 节点面**错抄成了 **(a) 码面**。**键数 = 33**（每语），**132 是节点面**。本报告此后再不把 132 当键数。

**两数现取命令的退出码**：上表两条命令均 **EXIT 0**（纯 node 只读）。

---

## §2 逐码四语表（33 行）

真源：`frontend/src/locales/{zh,hk,en,vn}.json` 的 `ledger.err.*`（**现取**，见 §1(a) 命令）。
**四语键集完全相等**（`p6-tr2-i18n-locales`：`四文件拍平键数取值集合 = {737}`）；**零 stub**（无「=键名 / 空串 / 即码本身 / 含机读码」的占位，见门 G 段 `不可用 = 0/132`）。
zh 列与后端 `backend-ts/src/ledger-errors.ts` 的 `LEDGER_ERROR_TABLE[code].message` **语义一致**（多数为同义 + 句读规范化）；**唯一两处后端 canonical 为空的码**见 §3。

| # | 码（= `ledger.err.<CODE>` 后缀） | zh | hk | en | vn |
|---|---|---|---|---|---|
| 1 | LEDGER_INSUFFICIENT_BALANCE | 可用余额不足，无法完成本次操作。 | 可用餘額不足，完成唔到今次操作。 | Your available balance is not enough to complete this action. | Số dư khả dụng không đủ để hoàn tất thao tác này. |
| 2 | LEDGER_INSUFFICIENT_FROZEN | 冻结余额不足。 | 凍結餘額不足。 | The frozen balance is not enough. | Số dư bị phong tỏa không đủ. |
| 3 | LEDGER_IDEMPOTENCY_REPLAY | 该请求此前已处理，本次为重复提交，不会重复执行。 | 該請求之前已經處理，今次屬重複提交，唔會再執行。 | This request was already handled. It is a duplicate submission and will not run again. | Yêu cầu này đã được xử lý trước đó. Lần gửi trùng sẽ không được thực hiện lại. |
| 4 | LEDGER_IDEMPOTENCY_CONFLICT | 该请求与先前提交的请求内容不一致。 | 該請求同之前提交嘅內容唔一致。 | This request does not match the earlier one sent with the same identifier. | Yêu cầu này không khớp với yêu cầu đã gửi trước đó cùng mã định danh. |
| 5 | LEDGER_IDEMPOTENCY_KEY_REQUIRED | 请求缺少唯一请求标识。 | 請求缺少唯一請求標識。 | The request is missing its unique request identifier. | Yêu cầu thiếu mã định danh duy nhất của yêu cầu. |
| 6 | LEDGER_IDEMPOTENCY_KEY_INVALID | 请求标识格式不合法。 | 請求標識格式唔合法。 | The request identifier format is invalid. | Định dạng mã định danh của yêu cầu không hợp lệ. |
| 7 | LEDGER_CURRENCY_NOT_FOUND | 该单位不存在。 | 呢個單位唔存在。 | This unit does not exist. | Đơn vị này không tồn tại. |
| 8 | LEDGER_CURRENCY_NOT_LISTED | 该单位尚未上市，暂不可交易。 | 呢個單位仲未上市，暫時唔可以交易。 | This unit is not listed yet, so it cannot be traded for now. | Đơn vị này chưa được niêm yết nên tạm thời chưa thể giao dịch. |
| 9 | LEDGER_CURRENCY_FROZEN | 该单位已暂停交易。 | 呢個單位已經暫停交易。 | Trading in this unit is suspended. | Đơn vị này đã tạm dừng giao dịch. |
| 10 | LEDGER_CURRENCY_DELISTED | 该单位已下架。 | 呢個單位已經下架。 | This unit has been delisted. | Đơn vị này đã bị hủy niêm yết. |
| 11 | LEDGER_CURRENCY_INVALID_TRANSITION | 当前状态不允许此变更。 | 目前狀態唔允許呢個變更。 | The current state does not allow this change. | Trạng thái hiện tại không cho phép thay đổi này. |
| 12 | LEDGER_CURRENCY_SYMBOL_TAKEN | 该符号已被占用。 | 呢個符號已經有人用咗。 | That symbol is already taken. | Ký hiệu này đã được sử dụng. |
| 13 | LEDGER_CURRENCY_MISMATCH | 币种不一致。 | 幣種唔一致。 | The currency does not match. | Loại tiền không khớp. |
| 14 | LEDGER_SUPPLY_CAP_EXCEEDED | 已达该单位发行上限。 | 已經達到呢個單位嘅發行上限。 | The issuance cap for this unit has been reached. | Đã đạt giới hạn phát hành của đơn vị này. |
| 15 | LEDGER_UNAUTHORIZED_MINT | 你没有发行该单位的权限。 | 你冇發行呢個單位嘅權限。 | You do not have permission to issue this unit. | Bạn không có quyền phát hành đơn vị này. |
| 16 | LEDGER_HOLD_NOT_ALLOWED | 不支持手动冻结。 | 唔支援手動凍結。 | Manual holds are not supported. | Không hỗ trợ phong tỏa thủ công. |
| 17 | LEDGER_AMOUNT_INVALID | 金额格式不正确。 | 金額格式唔正確。 | The amount format is invalid. | Định dạng số tiền không đúng. |
| 18 | LEDGER_AMOUNT_NOT_POSITIVE | 金额必须大于零。 | 金額一定要大過零。 | The amount must be greater than zero. | Số tiền phải lớn hơn không. |
| 19 | LEDGER_DECIMALS_OVERFLOW | 该单位支持的小数位数不足。 | 呢個單位支援嘅小數位唔夠。 | This unit supports fewer decimal places than required. | Đơn vị này hỗ trợ ít chữ số thập phân hơn mức cần thiết. |
| 20 | LEDGER_SELF_TRANSFER | 不能转给自己。 | 唔可以轉畀自己。 | You cannot transfer to yourself. | Không thể chuyển cho chính mình. |
| 21 | LEDGER_ACCOUNT_NOT_FOUND | 账户不存在。 | 帳戶唔存在。 | This account does not exist. | Tài khoản này không tồn tại. |
| 22 | LEDGER_RESERVED_UID | 目标账户无效。 | 目標帳戶無效。 | The target account is invalid. | Tài khoản đích không hợp lệ. |
| 23 | LEDGER_REF_NOT_FOUND | 关联单据不存在。 | 關聯單據唔存在。 | The linked record does not exist. | Chứng từ liên quan không tồn tại. |
| 24 | LEDGER_UNKNOWN_KIND | 不支持的账务类型。 | 唔支援嘅賬務類型。 | This transaction type is not supported. | Loại giao dịch này không được hỗ trợ. |
| 25 | LEDGER_TRANSACTION_REQUIRED | 服务暂不可用，请稍后重试。 | 服務暫時唔可用，請遲啲再試。 | The service is temporarily unavailable. Please try again later. | Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau. |
| 26 | LEDGER_LOCK_TIMEOUT | 系统繁忙，请稍后重试。 | 系統繁忙，請遲啲再試。 | The system is busy. Please try again later. | Hệ thống đang bận, vui lòng thử lại sau. |
| 27 | LEDGER_TX_TIMEOUT | 系统繁忙，请稍后重试。 | 系統繁忙，請遲啲再試。 | The system is busy. Please try again later. | Hệ thống đang bận, vui lòng thử lại sau. |
| 28 | LEDGER_DEADLOCK_RETRY_EXHAUSTED | 系统繁忙，请稍后重试。 | 系統繁忙，請遲啲再試。 | The system is busy. Please try again later. | Hệ thống đang bận, vui lòng thử lại sau. |
| 29 | LEDGER_NEGATIVE_BALANCE_GUARD | 服务异常，请联系客服。 | 服務異常，請聯絡客服。 | Something went wrong on our side. Please contact support. | Dịch vụ gặp sự cố, vui lòng liên hệ bộ phận hỗ trợ. |
| 30 | LEDGER_APPEND_ONLY_VIOLATION | 服务异常，请联系客服。 | 服務異常，請聯絡客服。 | Something went wrong on our side. Please contact support. | Dịch vụ gặp sự cố, vui lòng liên hệ bộ phận hỗ trợ. |
| 31 | LEDGER_ACCOUNT_GUARD_VIOLATION | 服务异常，请联系客服。 | 服務異常，請聯絡客服。 | Something went wrong on our side. Please contact support. | Dịch vụ gặp sự cố, vui lòng liên hệ bộ phận hỗ trợ. |
| 32 | LEDGER_FEE_RATE_INVALID | 服务配置异常。 | 服務配置異常。 | The service configuration is invalid. | Cấu hình dịch vụ không hợp lệ. |
| 33 | LEDGER_RECONCILE_MISMATCH | 对账不符，请联系客服处理。 | 對帳唔相符，請聯絡客服處理。 | The accounts do not reconcile. Please contact support. | Sổ sách không khớp, vui lòng liên hệ bộ phận hỗ trợ. |

**行数自证**：上表 **33 行**（#1–#33），与 §1(a) 的「每语 `ledger.err` 键数 = 33」逐行对齐。

---

## §3 语义不明清单

**结论：无。** 本批 **33 码全部落成四语文案，无一条因「语义不明」而留空 / 编造占位 / 交由下游兜底。**

**判定依据（可复核）**：
1. **码语义有唯一真源**：33 码的语义由 `backend-ts/src/ledger-errors.ts` 的 `LEDGER_ERROR_TABLE[code]`（`message` 字段 = 后端 zh canonical）与 `LEDGER_ERROR_BUCKETS`（分类桶）双重界定；本批 zh 列即由该表派生。现取对拍：**31/33 码**的后端 `message` 非空，zh 列与其**语义一致**（多为同义扩写 + 句读规范化，如后端 `'可用余额不足'` → `'可用余额不足，无法完成本次操作。'`）。
2. **余 2 码后端 canonical 为空串**（`message: ''`），但**码名自描述**、且分类桶已界定其性质 ⇒ 未构成「语义不明」（**逐条登记交裁**，见下）：
   - `LEDGER_IDEMPOTENCY_REPLAY`：后端 `{status: 200, message: ''}` —— R106 明定它**不是错误**（良性结果，永不进错误分支）；本批文案按码名 + R106 语义构造为「该请求此前已处理，本次为重复提交，不会重复执行。」
   - `LEDGER_RECONCILE_MISMATCH`：后端 `{status: null, message: ''}` —— 桶 = `defect`（账实不符 = 实现缺陷），`status: null` 是**脚本退出码语义**（§11 R88）；本批文案按码名 + defect 语义构造为「对账不符，请联系客服处理。」
3. **四语零 stub 自证**：门 G 段对 132 节点逐条断言「存在 / 非空 / ≠键名 / ≠码本身 / 不含裸键 token / 不含机读码 token」⇒ `不可用 = 0/132`；无任何一条落「占位/回退」即证明**没有靠兜底掩盖语义缺口**。

> **交裁项（2 条，非阻塞）**：上列 2 码是**后端唯一两处 `message: ''`** 的码 —— 其用户可见文案是**按码名 + 分类桶构造**（非逐字抄后端）。若产品侧希望这两条与后端 canonical 严格同源，需先由后端补 `message`（本单硬口径不得改 `backend-ts/**`，故在此登记）。

---

## §4 ★ 旧断言订正逐字

### §4.1 被订正的断言（`frontend/src/test/unit/p7a-ledger-error-i18n.test.js` 第 ③ 例）

**原断言（改前，`git show f0bd336^:…` 逐字）**：
```js
  it('③ 503 + R107（带 `details.reason`）⇒ 同链产出（机读 reason 面保留），非服务端 code 原文', async () => {
    ...
    expect(err.message).not.toBe('LEDGER_TX_TIMEOUT')
    expect(err.message).toContain('(STATEMENT_TIMEOUT)') // 旧写法丢 reason ⇒ 本条必红
    expect(err.message).toBe(await apiErrorMessage(payload, 503))
    expect(err.message).not.toContain('[object Object]')
  })
```

**新断言（改后，`f0bd336` 现行逐字）**：
```js
  it('③ 503 + R107（带**大写机读** `details.reason`）⇒ 走 ② 服务端原文 + **不含机读 reason 后缀**（R1′ 订正）', async () => {
    ...
    expect(err.message).not.toBe('LEDGER_TX_TIMEOUT')
    // ★ 批 7-D（R1′ · reason 口径订正）**期望订正**：
    //   原断言 = `expect(err.message).toContain('(STATEMENT_TIMEOUT)')`（旧口径：② 路径把 reason 拼进括号）；
    //   新断言 = **不含** —— `details.reason = 'STATEMENT_TIMEOUT'` 是「全大写下划线机读码」⇒
    //   与 `message` 同判据（复用 `containsMachineCode`）⇒ **不附加后缀**。
    //   真人可读 reason（如 `too_many_connections`）仍保留后缀（见 `p7c` 单测 ⑤/⑧）。
    expect(err.message).toContain('Ledger statement timed out')
    expect(err.message).not.toContain('(STATEMENT_TIMEOUT)')
    expect(err.message).not.toContain('STATEMENT_TIMEOUT')
    expect(err.message).toBe(await apiErrorMessage(payload, 503))
    expect(err.message).not.toContain('[object Object]')
  })
```

**逐行差异（原 → 新）**：
| 行 | 原 | 新 |
|---|---|---|
| 用例名 | `③ 503 + R107（带 \`details.reason\`）⇒ 同链产出（机读 reason 面保留），非服务端 code 原文` | `③ 503 + R107（带**大写机读** \`details.reason\`）⇒ 走 ② 服务端原文 + **不含机读 reason 后缀**（R1′ 订正）` |
| 期望（3 条） | `toContain('(STATEMENT_TIMEOUT)')` ＋ 2 条不变量 | `toContain('Ledger statement timed out')` ＋ `not.toContain('(STATEMENT_TIMEOUT)')` ＋ `not.toContain('STATEMENT_TIMEOUT')` ＋ 2 条不变量 |

### §4.2 为什么这不是「删断言凑绿」

1. **不是删，是「换向 + 加严」**：`toContain('(STATEMENT_TIMEOUT)')`（1 条）被换成 **3 条**（`toContain` 保留原文 + `not.toContain` 两条禁止机读码 / 后缀）。**断言行数净增**，且两条 `not.toContain` 是**更强**的断言（旧口径只保证「拼了 reason」，新口径要求「不得出现机读码」）。同时**保留**了不变量 `toBe(await apiErrorMessage(payload, 503))`（同链自证）与 `not.toContain('[object Object]')`。
2. **换向有独立裁定来源**：订正由**批 7-D 的 R1′ 裁定**驱动（`details.reason` 施与 `message` 同一机读码判据 `containsMachineCode`），**不是**为了绕过一次红灯而改期望 —— 判负自证已实测「把 reason 判据改回旧口径 ⇒ 本断言（连同 `p7c` 类级判据）**必红**」（见 §6.2 逐字红读数）。
3. **同批登账的「计数期望」是 +33（非 -）**：全站 flat 键数期望由 **704 上调至 737**（**+33**），是**加法**、方向与「删断言凑绿」相反。逐字 diff（4 个测试文件，现取）：

```diff
--- frontend/src/test/unit/i18n-batch-b4a.test.jsx
-    expect(counts.zh).toEqual({ top: 102, flat: 704 }) // …批 7-A 新增 ledger.flowMore + ledger.kind.*…共 21 键（683⇒704）
+    expect(counts.zh).toEqual({ top: 102, flat: 737 }) // …批 7-D 新增 ledger.err.* 33 码 × 4 语文案（704⇒737）

--- frontend/src/test/unit/i18n-batch-b4b.test.jsx
-    it('…（B5 末批扩容后 top=102 / flat=704）', () => {
+    it('…（B5 末批 + 批 7-A + 批 7-D 后 top=102 / flat=737）', () => {
-    expect(counts.zh).toEqual({ top: 102, flat: 704 })
+    expect(counts.zh).toEqual({ top: 102, flat: 737 }) // …批 7-D 再 +33 键（ledger.err.* 33 码四语文案）
-    expect(out).toContain('zh: top=102 flat=704')
+    expect(out).toContain('zh: top=102 flat=737')

--- frontend/src/test/unit/i18n-batch-b5.test.jsx
-    expect(out).toContain('zh: top=102 flat=704')
+    expect(out).toContain('zh: top=102 flat=737')
-  it('四文件拍平键集逐文件相等（top=102 / flat=704）；…')
+  it('四文件拍平键集逐文件相等（top=102 / flat=737）；…')
-    expect(counts.zh).toEqual({ top: 102, flat: 704 })
+    expect(counts.zh).toEqual({ top: 102, flat: 737 }) // 批 7-D：+33 键（ledger.err.* 33 码四语文案）

--- frontend/src/test/unit/i18n-violation-closeout.test.jsx
-    expect(out).toContain('作用域命中节点数 = 2816')
+    expect(out).toContain('作用域命中节点数 = 2948')
-    expect([...counts][0]).toBe(704)
+    expect([...counts][0]).toBe(737)
```
**注**：`作用域节点数 2816 → 2948` 同为 **+132**（＝新增 33 键 × 4 语），与 §1(b) **节点面 132** 一致（**仍是节点口径，不是键数**）。

---

## §5 类级判据读数（`p7c` 门 D/F/G 三段 + 向量集）与 O-1 边界不回归

**命令**：`node scripts/p7c-errmsg-machinecode-gate.mjs`（cwd = `frontend/`）· **EXIT 0** · 总判 `PASS（判负 0 必须 = 0；A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）`

### §5.1 D 段 —— 机读码 `message` 向量 × 4 语 = 16 节点（逐字）
```
[P7C-MACHINE-CODE] D 行为节点（★ 类级）：机读码 message 向量 × 4 语 = 4 × 4 = 16
  · F-1 · 409 真体（message = 机读码 + reason = order_not_refundable）（status=409）
      [zh] ⇒ "当前状态不允许此变更。"
      [hk] ⇒ "目前狀態唔允許呢個變更。"
      [en] ⇒ "The current state does not allow this change."
      [vn] ⇒ "Trạng thái hiện tại không cho phép thay đổi này."
  · 服务端自拼（message 已含 `机读码 (reason)`）（status=409）
      [zh] ⇒ "当前状态不允许此变更。" …（四语同上）
  · 无 i18n_key 的机读码 message（旧字符串面）（status=401）
      [zh] ⇒ "请求失败 (401)" / [hk] ⇒ "請求失敗（401）" / [en] ⇒ "Request failed (401)" / [vn] ⇒ "Yêu cầu thất bại (401)"
  · 机读码 message + 大写 reason（`STATEMENT_TIMEOUT`）（status=503）
      [zh] ⇒ "系统繁忙，请稍后重试。" …（四语）
  ★ 类级违例计数（「全大写下划线机读码被当作文案输出」形态）= 0 / 节点 16（必须 = 0）
```

### §5.2 F 段 —— 反例面（O-1 边界回归）：真人可读服务端 `message` ⇒ 仍走 ② 服务端原文（逐字）
```
[P7C-MACHINE-CODE] F 反例面（O-1 边界回归）：真人可读服务端 message ⇒ 仍走 ② 服务端原文
  · O-1 · ② 边界（无 i18n_key：zh 句子 + 小写 reason = too_many_connections）⇒ 原文 + 后缀保留（status=503）
      [zh] ⇒ "系统繁忙，请稍后重试 (too_many_connections)"
      [hk] ⇒ "系统繁忙，请稍后重试 (too_many_connections)"
      [en] ⇒ "系统繁忙，请稍后重试 (too_many_connections)"
      [vn] ⇒ "系统繁忙，请稍后重试 (too_many_connections)"
  · O-1′ · 503 真体（i18n_key 已本地化 ledger.err.LEDGER_TX_TIMEOUT）⇒ ① 让位（真文案）（status=503）
  · S6 · 410 弃用面（**未登记** i18n_key）⇒ ② 服务端原文保留（既有面回归锚）（status=410）
  · B14③ · 未登记裸 message（无 `error` 对象）（status=503）
  ★ 反例面违例 = 0 / 节点 16（必须 = 0）
```

### §5.3 G 段 —— ★ 类级判据（批 7-D ② · R1′）：用户可见串机读码出现次数 = 0（9 向量 × 4 语 = 36 节点）
**向量集（9 条，逐字）**：① 409 机读码 message（F-1 真体）；② 409 服务端自拼 `机读码 (reason)`；③`stateConflict()`·`LISTING_STATE_INVALID`；③`stateConflict()`·`JOB_STATE_INVALID`；③`stateConflict()`·`JOB_APPLICATION_STATE_INVALID`；③`stateConflict()`·`CURRENCY_STATE_INVALID`；④ 503 `STATEMENT_TIMEOUT`（大写机读 reason）；⑤ `LEDGER_LOCK_TIMEOUT`（已本地化键 + 大写机读 reason）；⑥ **O-1（无键 + 小写 reason）⇒ 后缀必须保留**。
```
  ★ 机读码出现次数合计 = 0（必须 = 0）/ 节点 36；违例向量-语 = 0（必须 = 0）
```

### §5.4 O-1 边界不回归 —— 逐语自证

**判据**：`系统繁忙，请稍后重试 (too_many_connections)`（**zh 句 + 小写 reason**，真人可读）**仍走 ② 服务端原文** 且 **后缀 `(too_many_connections)` 保留**；即「机读码不得后缀」这一新口径**未误伤真人可读 reason**。

| 语 | 用户可见串（F 段 / G⑥ 现取，逐字） | 后缀保留 |
|---|---|---|
| zh | `系统繁忙，请稍后重试 (too_many_connections)` | ✅ |
| hk | `系统繁忙，请稍后重试 (too_many_connections)` | ✅ |
| en | `系统繁忙，请稍后重试 (too_many_connections)` | ✅ |
| vn | `系统繁忙，请稍后重试 (too_many_connections)` | ✅ |

**为什么算「不回归」**：旧口径对**所有**含 `details.reason` 的 ② 路径都拼后缀（含机读码，缺陷）；新口径（R1′）**只对「全大写下划线机读码」不拼**，对**真人可读小写 reason 仍照旧拼接** ⇒ 新判据是**收窄**而非**改向**，O-1 边界（有 suffix 一侧）读数**逐字未变**。同时门 `p7c` F 段另有 4 条反例（S6 410 弃用面 / B14③ 裸 message / O-1′ ① 让位）作回归锚，`反例面违例 = 0/16`。

---

## §6 ★ 判负自证（逐字红读数，重跑）

### §6.0 副本建立与首尾态（仓外，零仓内污染）

```bash
$ git worktree add --detach "$SCR/p7d-neg" f0bd336       # SCR = ~/.hermes/profiles/zang/cache/scratch
Preparing worktree (detached HEAD f0bd336)
HEAD is now at f0bd336 fix(fe): 批 7-D 错误文案面收口 …
$ ln -s /Users/kevin/bistro/seafood/frontend/node_modules "$SCR/p7d-neg/frontend/node_modules"
```

**副本首态（逐字）**：
```
$ git status --porcelain
?? frontend/node_modules
$ git rev-parse HEAD
f0bd33655bdbb5d7fb9c90d5adc8e7f9c5a3f631
```

**被检文件 blob == `git rev-parse f0bd336:<path>`（首尾皆核，逐字）**：

| 件 | `git hash-object <file>`（副本） | `git rev-parse f0bd336:<path>` | 结论 |
|---|---|---|---|
| `frontend/src/locales/en.json` | `e350f41c3e9c0443a34e76f269f3d88a47aa0293` | 同左 | **blob 相等** |
| `frontend/src/locales/zh.json` | `f23a6e25b43454ea6af9bd0a8d4fa9d865044b13` | 同左 | **blob 相等** |
| `frontend/src/locales/hk.json` | `0448bd83523424c5e2f52c43b2c3b17434f83dc0` | 同左 | **blob 相等** |
| `frontend/src/locales/vn.json` | `5c2bb2ad88abb3868c58559a08c7fb686d988033` | 同左 | **blob 相等** |
| `frontend/src/auth.js` | `cd1a72c171e81389e92ca32e6e26dd85761d0e12` | 同左 | **blob 相等** |

**副本尾态（逐字，两处判负均已复原后）**：
```
$ git status --porcelain
?? frontend/node_modules
$ git rev-parse HEAD
f0bd33655bdbb5d7fb9c90d5adc8e7f9c5a3f631
```
⇒ 副本工作区**除 node_modules 符号链接（未跟踪，系本单接入用）外零改动**；被检 5 件 blob 与 `f0bd336` **逐字相同** ⇒ 判负实验**全部落在仓外副本内、已完全复原**。

### §6.1 判负(a) —— 删一个新加的真可达 `ledger.err.*` 键 ⇒ 类级判据 / 四语断言 **必红**

**动作**：在副本内 `delete en.json.ledger.err.LEDGER_AMOUNT_INVALID`（新加的真可达键 ⇒ `en.ledger.err keys = 32`）。

**红读数①（门 `p7b-errfallback-gate.mjs`）**：
```
EXIT=1
[P7B-ERRFB] G 类级判据（批 7-D ①）：33 码 × 4 语 `ledger.err.*` 键齐备 + 可用
  ! en:ledger.err.LEDGER_AMOUNT_INVALID ⇒ undefined（缺/空 undefined）
  节点 = 132（33 码 × 4 语）；不可用 = 1（必须 = 0）
  ! G `ledger.err.LEDGER_AMOUNT_INVALID` 在 en 不可用：缺/空 undefined
[P7B-ERRFB] 总判：FAIL（判负 1 必须 = 0；A=PASS / B 含裸键值=0 / C 兜底键=2×4 / D 节点=132 需护栏=1 已本地化=131 / G 键不可用=1/132 / E 样本=17）
```

**红读数②（四语断言：单测，`npx vitest run …`）**：
```
EXIT=1
 Test Files  3 failed (3)
      Tests  4 failed | 15 passed (19)
```
逐条失败差异（逐字）：
| 测试 | 断言差异（逐字） |
|---|---|
| `i18n-batch-b4a.test.jsx`「四文件拍平键集逐文件相等」 | `AssertionError: expected [ 'Actived', 'CanActive', …(734) ] to deeply equal [ 'Actived', 'CanActive', …(735) ]`（en 键集 ≤ zh） |
| `i18n-violation-closeout.test.jsx` ⑤「四文件拍平键数单值」 | `AssertionError: expected 2 to be 1`（`counts.size` 由 1 变 2） |
| `i18n-violation-closeout.test.jsx` ②（类级脚本读数） | 子进程 EXIT `status: 1`；脚本内 `键集读数：四文件拍平键数取值集合 = {737, 736}（应单值）` ⇒ `总判：FAIL` |
| `p7b-errfallback.test.js` ⑨「★ 批 7-D 让位面…**四语逐语真文案**」 | `AssertionError: expected 'undefined' to be 'string'` |

**复原回绿**：`git checkout -- frontend/src/locales/en.json`（blob 复原 = `e350f41c…` == `f0bd336`）⇒ 门 `EXIT=0`（`总判：PASS … G 键不可用=0/132`）。

### §6.2 判负(b) —— 把 reason 判据改回旧口径 ⇒ 新类级判据 **必红**

**动作**：在副本 `frontend/src/auth.js` 把批 7-D 的新块
```js
      const suffix = reason && !containsMachineCode(reason) ? ` (${reason})` : ''
      return `${base}${suffix}`
```
**改回旧口径**：
```js
      return reason ? `${base} (${reason})` : base
```

**红读数（真链**类级**判据 = 单测；`npx vitest run`）**：
```
EXIT=1
 Test Files  2 failed | 1 passed (3)
      Tests  2 failed | 21 passed (23)
```
逐条失败差异（逐字）：
| 测试 | 断言差异（逐字） |
|---|---|
| `p7a-ledger-error-i18n.test.js` ③（R1′ 订正面） | `AssertionError: expected 'Ledger statement timed out (STATEMENT…' to not include '(STATEMENT_TIMEOUT)'` |
| `p7c-errmsg-machinecode.test.js` ⑧「★ 批 7-D（R1′）类级：`stateConflict()` 四种 reason / `STATEMENT_TIMEOUT` 等机读 reason ⇒ 用户可见串零机读码」 | `AssertionError: [zh] LISTING_STATE_INVALID 不得外泄机读码: expected true to be false` |

**★ 诚实读数（门的已知边界，非「未测」）**：同一次改回**旧口径**下，`node scripts/p7c-errmsg-machinecode-gate.mjs` 仍 **EXIT 0**（`总判：PASS`），因为该门是**纯 node 门**（其文件头自述：D/F/G 采用**链式决策镜像**而非真跑 `apiErrorMessage`，只有 A 段读 `auth.js` 源码）。改回后 A 段确有一处读数变化（`② extractApiErrorMessage 内 containsMachineCode( 调用数 = 3`，改前为 4；阈值 ≥1 ⇒ 仍 PASS）。⇒ **「R1′ reason 判据」的可判负落点是「真链单测（类级）」，不是纯 node 镜像门**。此点登记为口径边界（§7.2 未测项）。

**复原回绿**：`git checkout -- frontend/src/auth.js`（blob 复原 = `cd1a72c1…` == `f0bd336`）⇒ 门 `p7c EXIT=0`、门 `p7b EXIT=0`、单测 `3 passed / 23 passed`。

---

## §7 自曝

### §7.1 两条回执失真（自查，逐字）

1. **`keys_enumerated = 132` 抄数失真**：本单上一轮（被截断的）回执把错误码键数写成 **132** —— 这是把 **(b) 节点面（33 码 × 4 语 = 132 个文案值）** 错当成 **(a) 码面（键数）**。**正确键数 = 33 / 语**。本报告 §1 已把两口径并列冻结、并给「33 码 × 4 语 = 132 个文案值 ≠ 节点面 132 ≠ 键数 33」的明文澄清；§2 逐码表恰好 **33 行**自证。
2. **报告未落盘失真**：上一轮回执**声称**已落盘 `docs/audit/p7-d-errmsg-i18n.md`，**实际未写**（截断所致，派单方亲核确认不存在）。本单即为补写；本报告即为该落盘的**实际产物**（现取 `ls docs/audit/p7-d-errmsg-i18n.md` 存在，§7.3 给收尾态）。

### §7.2 未测项（逐项给原因，**不填 0 / 不填空**）

| # | 未测项 | 原因（逐项） |
|---|---|---|
| 1 | **真链（`apiErrorMessage`）由「纯 node 门」直跑** | 门 `p7c`/`p7b` 的自述口径：`src/i18n.js` 的 `./utils` 无扩展名导入在 node 下不可解析 ⇒ D/F/G 只能用**链式决策镜像**（准入闸 = 从 `auth.js` 导入的**真谓词**）。**真链证据在单测**（真 `i18n` + 真 `apiErrorMessage` + 真 `ledger-api`）。⇒ 「门是否真跑链」= **不成立项**（已知边界，非疏漏）。 |
| 2 | **门 `p7c` 对「R1′ reason 判据回退」不红** | §6.2 实测：改回旧口径后门仍 `PASS`（纯 node 镜像不回放该代码）。可判负落点 = `p7a` ③ / `p7c` ⑧ 单测。⇒ 「镜像门对 R1′ 的判负覆盖」= **当前无**（登记为口径边界）。 |
| 3 | **端到端（Playwright / `test:e2e`）** | 本单硬口径 = 只跑 `build` + `test:unit` + 指定 `npx vitest run` + 七门（`node scripts/*.mjs`）；**未跑 e2e**（需起服务 / 浏览器，且硬口径禁启停 5787/5788）。⇒ 未测。 |
| 4 | **线上（生产）终验读数** | 本单 = 本地收口单；`f0bd336` **未推送**（禁 `git push`）⇒ 无线上读数。七门中的 `p4z-feperf-safelist` 依赖本地 `dist/`（本次 `build` 产物 `index-mRq3HT-x.css` 与其读数同名，已核）。 | 
| 5 | **四语「语言学家级」文案审校** | 本单只做**结构与可达性**判据（键齐备 / 非裸键 / 非机读码 / 四语键集相等 / 零 stub）；**译文的地道度与产品语气**（尤其 hk/vn）**未做人工审校**（超出工程判据面）。⇒ 未测。 |
| 6 | **`LEDGER_IDEMPOTENCY_REPLAY` 能否真到用户** | 该码 R106 明定**永不进入错误分支**（良性结果）⇒ 其 `ledger.err.*` 文案**可能在运行时不可达**（属「防御性键」）。本单按「键齐备」类级判据纳管（33 码闭集全覆盖），**未验证其运行时可达性**。⇒ 未测（登记）。 |
| 7 | **`frontend/src/**` 之外的下游消费者** | 本单范围 = `frontend/**`；后端/其它仓的 `ledger.err.*` 文案消费点**未扫**（硬口径不得改 `backend-ts/**`）。⇒ 未测。 |

### §7.3 收尾态（现取，逐字）

```
$ lsof -nP -iTCP:5796-5799 -sTCP:LISTEN
（空 —— 5796–5799 无监听进程）
$ git status --porcelain
?? docs/audit/p7-d-errmsg-i18n.md
$ git rev-parse HEAD
17f4a237b14b5ad8105f609d601c9e664137d263
```
⇒ 主工作区仅**本报告**为未跟踪新增；HEAD 与开工一致（本单**不 `git add/commit/push`**）。

### §7.4 本报告占位归零自证

本报告全篇**不含任何「连续两个下划线」占位符**（即模板填空标记）。现取读数（为避免读数命令自身引入该字面，改用等价 ERE 写法 `_{2}`）：

```
$ grep -cE '_{2}' docs/audit/p7-d-errmsg-i18n.md
0
```
（同上口径的 `grep -c '<两个下划线>' …` 亦为 0；此处不写该字面以免自指。）

---

## §8 一句话

批 7-D 把 `ledger.err.*` **33 码**（＝ **33 码 × 4 语 = 132 个文案值**，节点面 132）落成四语本地化（flat **704 ⇒ 737**，四语键集相等、零 stub），并把 `details.reason` 机读码收口（R1′：机读码不附加后缀、真人可读 reason 后缀保留 = O-1 不回归）。**我亲跑**：`build` EXIT 0 / `test:unit` **30 files 268 passed** / 七门全 EXIT 0。**仓外副本两处判负重跑**：删一新加 `ledger.err.*` 键 ⇒ 门 `p7b` **EXIT 1** + 单测 **4 红**；reason 判据改回旧口径 ⇒ 真链类级单测 **2 红**（纯 node 镜像门不红，已登记口径边界）；两处均**复原回绿**、副本 blob == `f0bd336`。报告已落盘，占位归零。
