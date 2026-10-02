# 批 7-D · 错误文案面收口（`ledger.err.*` 33 码四语本地化 + reason 机读码收口 R1′ + 页面级直拼 toast 归护栏 + 新类级判据）· 独立终审质检报告（Neng）

> 被检提交：**`f0bd336`**（`fix(fe): 批 7-D 错误文案面收口 …`，本地未推）。其后 `17f4a23` / `4ea1148` / `80b1530` 均为**文档提交**，不属被检代码面。
> 固定副本：`git worktree add --detach /Users/kevin/.hermes/profiles/zang/cache/scratch/qa7d f0bd336` + `ln -s /Users/kevin/bistro/seafood/frontend/node_modules`（**未起后端实例**）。
> 质检口径：**逐条重取读数**，不采信交付方/收口方结论；退出码一律**管道外**捕获（`cmd; echo $?`）。
> 产物：`frontend/.p7dqa-artifacts/*.q7d.{txt,json}`（run-tagged，**不用 `.log`**）。本单只读被检代码 + 只写 `docs/qa/**` 与本单产物；判负变异**只在仓外副本内**并已复原。
> 待核文档（main 工作区**只读**）：`docs/audit/p7-d-errmsg-i18n.md`、`docs/route-layer.spec.md` v2.1、`docs/versions/route-layer.spec.v2.1.md`、`docs/audit/route-layer-v2.1-delta.md`。

---

## §0 元信息（开工/收尾态、副本建立、blob 对拍）

### §0.1 开工态（逐字）
```
$ git status --porcelain
（空 —— 工作区干净）
$ git rev-parse HEAD
80b15306f79571d91279155a0e446e577e1e490e
$ git log --oneline -4
80b1530 docs: 批 7-D 验收 + spec v2.1 验收 + 我三条裁定（…）
4ea1148 docs: 批 7-D 收口报告（439 行/占位 0/两口径 33-132/判负重跑逐字）+ spec v2.1 只追加（+179 行 0 删 …）
17f4a23 docs: 批 7-D 我亲核盘面通过 + 两处回执失真登记 …
f0bd336 fix(fe): 批 7-D 错误文案面收口 —— ledger.err.* 33 码四语本地化（flat 704->737）…（本地入库，待质检后推送）
```
⇒ 被检 sha `f0bd336` 已入库；其父 = **`d7dbf91`**（`git rev-parse f0bd336^`，逐字 `d7dbf919b5d9e3ad61b4ddaeafe1a76cbc3eab49`）。

### §0.2 副本逐文件 blob 对拍（现取，`f0bd336` 全量 2163 个 tracked 项）
```
total tracked=2163  mismatches=1
MISMATCH backend-ts/.p4-artifacts/sec-.../failfast/node_modules   != 4b33369f…
```
⇒ 唯一「不符」项经复核为**符号链接**（`git ls-tree` 模式 = `120000`，内容 = 目标路径字符串 `…/backend-ts/node_modules`）—— `git hash-object <路径>` 会**跟随软链**去哈希目标目录 ⇒ 取值为空，**非内容差异**。以 `git -C <副本> diff f0bd336 --stat` 复核：**输出为空**（`DIFF_EXIT=0`）⇒ 副本对 `f0bd336` **零 tracked 差异**。

**被检 5 件 blob（现取 `git hash-object` == `git rev-parse f0bd336:<path>`，逐字）**：

| 件 | blob（现取） | `f0bd336:<path>` | 结论 |
|---|---|---|---|
| `frontend/src/locales/en.json` | `e350f41c3e9c0443a34e76f269f3d88a47aa0293` | 同左 | **相等** |
| `frontend/src/locales/zh.json` | `f23a6e25b43454ea6af9bd0a8d4fa9d865044b13` | 同左 | **相等** |
| `frontend/src/locales/hk.json` | `0448bd83523424c5e2f52c43b2c3b17434f83dc0` | 同左 | **相等** |
| `frontend/src/locales/vn.json` | `5c2bb2ad88abb3868c58559a08c7fb686d988033` | 同左 | **相等** |
| `frontend/src/auth.js` | `cd1a72c171e81389e92ca32e6e26dd85761d0e12` | 同左 | **相等** |

（与交付报告 §6.0 所列 5 个 blob **逐字相同** = 该表读数独立复现。）

---

## §1 一句话结论 + verdict

**PASS（建议入库）。** 七门全 `EXIT=0`（build 0 / 单测 **30 files 268 passed** 我亲跑复现）；四语**逐码独立重取**：`ledger.err.*` 每语 **33 键**（四语键集完全相等）、flat **737**（基线 `d7dbf91` = **704**，+33/lang 我自证）、**35/35（33 ledger + 2 auth）经真 i18n 实例 ① 恒命中**且 ≠ 键名；零 stub / 零空值 /零「值==码名」/零纯机读码值；`en`/`vn` 的 **33 码值零 CJK**；`hk ≠ zh` **33/33**（真做粤语面）；33 码语义我**逐条独立审**并与后端 canonical 对拍，**无一条译错或语义不符**。**R-7D-2「① 恒命中 ⇒ ② 不可达」我独立枚举后端码全集后判 HOLDS**（含 AUTH 域 —— 报告未提，但有独立 `auth.err.*` 键）。**两处判负我在仓外副本逐字复跑**：删 `en.ledger.err.LEDGER_AMOUNT_INVALID` ⇒ 门 `p7b` **EXIT 1** + 单测 **3 files / 4 red**；改回 reason 旧口径 ⇒ **门 `p7c` 仍 `EXIT 0`（镜像门不回放 `auth.js`，我坐实）** + 真链单测 **2 red**；两处均**复原回绿**、blob == `f0bd336`。

**登记项（非阻塞，交裁）**：① `en`/`vn` **全 locale 各 8 处 CJK** —— 全部**在本批 33 码面之外**、且与 `f0bd336^` **逐字相同**（= 存量面，非本批引入）；② `hk` 33/33 与 zh 不同，其中 **25 条**含粤语特征字、**8 条**仅繁体转写（无粤语标记）；③ R-7D-2 的边界：无 `i18n_key` 的 `sendError` 旧面仍走 ②，但其文案为**英文人读句**（非中文/非机读码）。

---

## §L1 硬门独立复跑（副本内 `frontend/`，退出码管道外捕获）

| # | 命令 | 现取读数（逐字摘录） | EXIT |
|---|---|---|---|
| 0 | `npm run build` | `✓ built in 1.67s`（`dist/` 已产；本门须**先 build**） | **0** |
| 1 | `npm run test:unit` | `Test Files 30 passed (30)` / `Tests 268 passed (268)` | **0** |
| 2 | `node scripts/p4z-i18nviol-global.mjs` | `总判：PASS（locale 裸命中 0 + 源面裸命中 0；作用域节点数 locale=2948 / source=37）` | **0** |
| 3 | `node scripts/p6-tr2-i18n-locales.mjs` | `zh: top=102 flat=737`（四语同）；`[TR-2] 键集相等：PASS（… = {737}）`；`总判：PASS` | **0** |
| 4 | `node scripts/p4z-miscfix-links.mjs` | `总判：PASS（残留全部已登记）` | **0** |
| 5 | `node scripts/p4z-feperf-safelist.mjs` | `VERDICT=PASS`（读本地 `dist/` 产物） | **0** |
| 6 | `node scripts/p7a-03-errmessage-gate.mjs` | `总判：PASS（未登记命中 0 必须 = 0；扫描文件 77 / 受体 6 / 命中 0 / 基线 0）` | **0** |
| 7 | `node scripts/p7b-errfallback-gate.mjs` | `总判：PASS（… D 节点=132 需护栏=0 已本地化=132 / G 键不可用=0/132 / E 样本=17）` | **0** |
| 8 | `node scripts/p7c-errmsg-machinecode-gate.mjs` | `总判：PASS（… D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）` | **0** |

七门读数与交付报告 §0.4 **逐字一致**；`p7b` D 段 = **132 节点 / 需护栏 0 / 已本地化 132**、`p7c` = **D 0/16、F 0/16、G 0/36**，均**独立复现**。⇒ 交付方「七门全绿 / 单测 268」读数**属实**。

---

## §L2 ★ 四语文案独立审（本单核心，自写只读探针）

**探针**：`q7d-l2-probe.mjs`（递归拍平四语 JSON，独立取值）→ 读数 `frontend/.p7dqa-artifacts/l2-probe.q7d.json`；真 i18n 解析探针 `src/test/unit/q7d-neng-probe.test.js` → `l2-resolved.q7d.json`（**不采信交付方 §2 表**）。

### §L2.1 ① 键数 / flat / 四语键集（现取）
```
counts: zh/en/hk/vn 全 = {top:102, flat:737, err:33}
flat_count_set: [737]      err_count_set: [33]
err_key_set_equal: true    flat_key_set_equal: true
```
⇒ 每语 `ledger.err.*` 键数 = **33**、flat = **737**，**四语键集完全相等**（全 locale 亦相等）。基线自证：`git show d7dbf91:frontend/src/locales/{zh,en,hk,vn}.json` 拍平 = **704** 且 **`ledger.err` = NONE** ⇒ `704 ⇒ 737`（+33/语）**属实**。

### §L2.2 ② 卫生面（零 stub / 零空值 / 零「值==码名」/零纯机读码）
```
zh/en/hk/vn:  stub 0  empty 0  eqcode 0  machine 0  token 0   |  GLOB(全 locale) stub 0 machine 0 empty 0
```
⇒ 33 码四语**无任何** `[xx] ` 占位前缀 / 空串 / 「值 == 码名」/ 纯机读码值 —— 连全 locale 面亦为 0。

### §L2.3 ③ en / vn 零 CJK（**我采到一条口径边界，须分清**）
- **本批 33 码面内**：`en`/`vn` 各 **0** 处 CJK（33 码值逐条 CJK-free）⇒ **PASS**。
- **全 locale 面**：`en`/`vn` 各 **8** 处 CJK：`chinese=简体中文` / `cantonese=粤语` / `footer.catSlogan1/2/3` / `footer.cloudSlogan` / `adminSettings.langZh=中文` / `adminSettings.langHk=繁體中文`。
- **独立定性**：这 8 处 **不在** `ledger.err.*`（即本批被检面）之内；且与 `git show d7dbf91:…/{en,vn}.json` 的 CJK 命中**同为 8 处、逐字相同** ⇒ **存量面、非本批引入**。其中语言切换器自名（`简体中文`/`粤语`/`中文`/`繁體中文`）属**有意保留**的 endonym；`footer.catSlogan*` / `footer.cloudSlogan` 为**未翻译的中文口号**（存量未译）。
⇒ **判定**：本批 33 码面 **PASS**；全 locale 的 8 处 CJK 登记为**存量偏离**（非本批责任，交裁）。

### §L2.4 ④ hk ≠ zh（现取）与「真做粤语」深度
```
hk != zh  whole-locale = 667 / 737      ledger.err 面 = 33 / 33
hk 含粤语特征字（唔/咗/呢/嘅/畀/冇/嚟/哋/喺/咪/嗰/嘢…）= 25 / 33
仅繁体转写（无粤语标记）= 8 条：LEDGER_INSUFFICIENT_FROZEN, LEDGER_IDEMPOTENCY_KEY_REQUIRED,
  LEDGER_AMOUNT_NOT_POSITIVE, LEDGER_RESERVED_UID, LEDGER_NEGATIVE_BALANCE_GUARD,
  LEDGER_APPEND_ONLY_VIOLATION, LEDGER_ACCOUNT_GUARD_VIOLATION, LEDGER_FEE_RATE_INVALID
```
⇒ 「应 33/33 即真做粤语」：**33/33 成立**。细化：**25 条**含明确粤语词（如 #1 `完成唔到今次操作`、#7 `呢個單位唔存在`、#20 `唔可以轉畀自己`、#12 `已經有人用咗`）；**8 条**为繁体转写（如 #2 `凍結餘額不足。`）。后者属 HK **書面語**风格的合法选择（正式错误文案用繁体书面语、口语面用粤语），登记为**风格观察**，非缺陷。

### §L2.5 ★ 35/35 真 i18n ① 恒命中（独立重取，非采信）
```
$ npx vitest run src/test/unit/q7d-neng-probe.test.js   → Test Files 1 passed / Tests 1 passed   EXIT=0
langs: zh,hk,en,vn   keys/lang: 35（33 ledger + 2 auth）
```
逐 (code, lang)：`i18n.t('ledger.err.<CODE>')` **== 该语 locale 真值** ∧ **≠ 键名** ∧ 非空；`auth.err.{AUTH_UNAUTHORIZED,AUTH_FORBIDDEN}` 同。

### §L2.6 ★ 33 码语义逐条独立审（含 4 条抽象码重点判定）
对拍真源 = `backend-ts/src/ledger-errors.ts` `LEDGER_ERROR_TABLE[code].message`（后端 zh canonical）。

- **总体**：33 码 zh 列与后端 canonical **逐一语义一致**；其中 **31/33** 后端 `message` 非空、zh 为「同义扩写 + 句读规范化」（如 `可用余额不足` → `可用余额不足，无法完成本次操作。`）；**2/33** 后端 `message=''`（`LEDGER_IDEMPOTENCY_REPLAY` status 200 良性、`LEDGER_RECONCILE_MISMATCH` status null defect）—— 该两条 zh 按**码名 + 分类桶**构造，交付报告 §3 已**逐条登记交裁**，我**认同**其构造合理（非占位）。
- **四条抽象码（重点独立判定）**：
  | 码 | 后端 canonical | 本批 zh | 我的独立判定 |
  |---|---|---|---|
  | #19 `LEDGER_DECIMALS_OVERFLOW` | `该单位支持的小数位数不足` | `该单位支持的小数位数不足。`（en `This unit supports fewer decimal places than required.`） | **语义忠于 canonical**。码名「OVERFLOW」+ 文义「位数不足」方向相反但**与后端 canonical 一致** ⇒ 文案正确，非译误。 |
  | #22 `LEDGER_RESERVED_UID` | `目标账户无效` | `目标账户无效。`（en `The target account is invalid.`） | **忠于 canonical**。码名指「用到了系统保留 uid」而文案为「目标账户无效」（未区分保留 vs 不存在）—— 这是**后端 canonical 的取舍**，非本批翻译错误。 |
  | #16 `LEDGER_HOLD_NOT_ALLOWED` | `不支持手动冻结` | `不支持手动冻结。`（en `Manual holds are not supported.`） | **忠于 canonical**，四语一致。 |
  | #25 `LEDGER_TRANSACTION_REQUIRED` | `服务暂不可用，请稍后重试` | `服务暂不可用，请稍后重试。`（en `The service is temporarily unavailable. Please try again later.`） | **忠于 canonical**。注：该码被 `normalizeLedgerError` 用作 500 类**兜底**（如 `DATABASE_URL_MISSING` 配置缺陷、`unclassified_pg_error`）—— 对「配置缺陷」提示「请稍后重试」在语义上可议，但**源为后端 canonical**，非本批译文之责（登记）。 |
- **结论**：**未发现任何一条与码名含义不符或明显错误的译法**；四语列之间亦无相互矛盾（同 zh 的 #26/#27/#28 与 #29/#30/#31 在四语内部分别保持一致）。

---

## §L3 ★ 独立判定 R-7D-2「① 恒命中 ⇒ ② 不可达」

**方法**：扫 `backend-ts/src/**` 的错误构包点（`ledgerErrorBody` / `sendError` / `sendVerbError` / `sendAuthError` / `fail(...)` / `toErrorResponse`）+ 错误码常量表 / 闭集清单，枚举**所有能进 `i18n_key` 的码**，与本批 33 键对差。探针读数：`l3-code-census.q7d.txt`。

### §L3.1 码全集（现取）
```
表键数 = 33（LEDGER_ERROR_TABLE，`status:` 行）；LEDGER_ 字面量 = 34
字面量不在表内（extra）= [ LEDGER_FUNCTION_BAD_RESULT ]   ← ledger.ts:1136 是 `details.error_code`（非 wire 码，见下）
表键未作字面量出现 = []（无死码）
AUTH_ 字面量 = [ AUTH_FORBIDDEN, AUTH_UNAUTHORIZED ]
```
- **wire 码构造**：`ledgerErrorBody(code, message, details, i18nDomain)` 产 `i18n_key = ${i18nDomain}.err.${code}`；`i18nDomain` = `err.authDomain ? 'auth' : 'ledger'`，而 `fail()` 置 `authDomain = code.startsWith('AUTH_')`。
- **`LEDGER_FUNCTION_BAD_RESULT` 不是 wire 码**：`ledger.ts:1133-1138` 处它是 `new LedgerError('LEDGER_TRANSACTION_REQUIRED', { error_code: 'LEDGER_FUNCTION_BAD_RESULT', … })` 的 **`details` 字段**（wire code = `LEDGER_TRANSACTION_REQUIRED`，在 33 内）。同理 `DATABASE_URL_MISSING`（`ledger.ts:988/1014`）亦为 details 字段。

### §L3.2 对差：**每个带 `i18n_key` 的 wire 码都有对应 locale 键**
```
cov[l]  (l=zh/en/hk/vn):  tableKeysWithoutLedgerErrKey = []   ledgerErrKeysNotInTable = []
authCov[l](l=zh/en/hk/vn): authWireCodesWithoutKey = []
```
- ledger 域 **33/33** 有 `ledger.err.*` 键（四语齐备）；**无**超出 33 的 `ledger.err.*` 键。
- **AUTH 域**（`AUTH_UNAUTHORIZED` 401 / `AUTH_FORBIDDEN` 403）**有自己的 locale 键**：`auth.err.AUTH_UNAUTHORIZED`、`auth.err.AUTH_FORBIDDEN` —— 四语**逐语存在**（现取 `frontend/src/locales/{zh,en,hk,vn}.json` 均有，如 zh `AUTH_UNAUTHORIZED` = `登录凭证无效或已过期，请重新登录。`）。

### §L3.3 我的独立结论：**HOLDS**（附边界）
1. **R107 形状响应**（ledger 33 码 + auth 2 码 = **35 个 wire 码**）——**全部**有对应本地化键 ⇒ 前端 ① `t(i18n_key)` **恒命中** ⇒ ②（服务端 `message`，含中文 canonical / 机读码）**不可达**。**交付方论断成立**，且我把「33 码」**外延到含 AUTH 域的 35 码**（报告未单列 AUTH，但其结论更强地成立）。
2. **非 R107 形状** —— `sendError(res, status, message)`（`index.ts:116`，26 处非注释调用点）产 `{success:false, message, error:message}`：**无 `code` / 无 `i18n_key`** ⇒ ① 无法命中 ⇒ 前端走 ②。**我逐条核过这 26 处的文案**（`grep` 现取）：**全部为 ASCII 英文人读句**（`Invalid tID` / `Prize not found` / `bio is required` / `Registration has moved to wallet sign-in…` / `Failed to load shard holdings` …），**无一条中文、无一条机读码** ⇒ ② 外显的是**未翻译英文**，**不外显中文/机读码**。
3. ⇒ 对论断的**精确表述**：**所有带 `i18n_key` 的码 ① 恒命中**（33 ledger + 2 auth），故**服务端中文/机读码 `message` 不可达**；「② 不可达」严格成立于 i18n_key 载体的响应。**唯一 ② 可达面** = 无键的 `sendError` 旧面，但该面**不泄漏中文/机读码**（仅英文人读句，属既有 O-1 族）。**登记此边界**（§L6）。

**旁证**：其余非 R107 错误体仅 `index.ts:366`（health 失败体，无面向用户的码/文案）与 `simple-test.ts`（测试文件），均非产品错误文案面。

---

## §L4 两处判负独立复跑（仓外副本内）+ 「镜像级门不回放」坐实

### §L4.1 判负① —— 删 `en.ledger.err.LEDGER_AMOUNT_INVALID`（真可达码）
```
$ node -e 'delete j.ledger.err.LEDGER_AMOUNT_INVALID …'   → en.ledger.err keys now: 32
$ node scripts/p7b-errfallback-gate.mjs ; echo $?         → P7B_EXIT=1
  ! en:ledger.err.LEDGER_AMOUNT_INVALID ⇒ undefined（缺/空 undefined）
  节点 = 132（33 码 × 4 语）；不可用 = 1（必须 = 0）
$ npx vitest run <b4a> <violation-closeout> <p7b-errfallback> ; echo $?
  → UNIT_EXIT=1 ; Test Files 3 failed (3) ; Tests 4 failed | 15 passed (19)
```
逐条红（逐字）：`i18n-batch-b4a`（键集 `[ …734 ]` vs `[ …735 ]`）、`i18n-violation-closeout` ②（子进程脚本 FAIL）与 ⑤（`expected 2 to be 1`）、`p7b-errfallback` ⑨（`expected 'undefined' to be 'string'`）。⇒ **门 + 单测必红，与交付报告 §6.1 逐字一致**。

### §L4.2 判负② —— reason 判据改回旧口径 + ★「镜像门不回放」坐实
```
$ <副本内 auth.js：把 `const suffix = reason && !containsMachineCode(reason) ? … : ''; return \`${base}${suffix}\``
   改回 `return reason ? \`${base} (${reason})\` : base`>
$ node scripts/p7c-errmsg-machinecode-gate.mjs ; echo $?   → P7C_GATE_EXIT=0（★ 总判：PASS，镜像门不红）
$ npx vitest run <p7a-ledger-error-i18n> <p7c-errmsg-machinecode> ; echo $?
  → UNIT_EXIT=1 ; Test Files 2 failed (2) ; Tests 2 failed | 12 passed (14)
```
逐条红（逐字）：`p7a…` ③ `expected 'Ledger statement timed out (STATEMENT…' to not include '(STATEMENT_TIMEOUT)'`；`p7c…` ⑧ `[zh] LISTING_STATE_INVALID 不得外泄机读码: expected true to be false`。

**★ 独立坐实交付方的新纪律（「镜像级门不回放 `auth.js`」）**：同一次旧口径回退下，`p7c` 门 **`EXIT=0`**（`总判：PASS`）—— 因为该门 D/F/G 段用**链式决策镜像**（纯 node），只有 A 段读 `auth.js` 源码。**我复核了 A 段的实际变化**：`② extractApiErrorMessage 内 containsMachineCode( 调用数 = 3`（改前 = **4**），阈值 `≥1` ⇒ **仍 PASS**。⇒ 交付方「**镜像门不红、只真链单测红**」的论断**成立**（我独立坐实，非采信）。

### §L4.3 复原回绿（逐字）
```
$ git checkout -- frontend/src/locales/en.json   → blob = e350f41c… == f0bd336
$ git checkout -- frontend/src/auth.js           → blob = cd1a72c1… == f0bd336
$ node scripts/p7b-errfallback-gate.mjs ; echo $?  → P7B_EXIT=0（总判：PASS … 已本地化=132）
$ node scripts/p7c-errmsg-machinecode-gate.mjs    → P7C_EXIT=0（总判：PASS …）
$ npx vitest run <p7a ③ / p7c ⑧>                   → 2 passed / 14 passed   EXIT=0
```
5 件被检 blob 逐件 `OK`（== `f0bd336`）。⇒ 两处判负**均落在仓外副本内、已完全复原**。

---

## §L5 复核报告 + spec v2.1（独立重取）

### §L5.1 交付报告 `docs/audit/p7-d-errmsg-i18n.md`
```
$ wc -l docs/audit/p7-d-errmsg-i18n.md          → 439
$ grep -cE '_{2}' docs/audit/p7-d-errmsg-i18n.md → 0
```
⇒ **439 行 / 占位归零** 复核属实。**抽 5 条读数对拍盘面（逐字）**：

| # | 报告读数 | 我现取 | 判 |
|---|---|---|---|
| 1 | flat 704 ⇒ 737 | `d7dbf91`=704（`ledger.err` NONE）/ `f0bd336`=737（33 键） | ✓ |
| 2 | `p7a`：命中 0 / 基线 0（扫描 77 / 受体 6） | `扫描文件 77 / 受体 6 / 命中 0 / 基线 0` | ✓ |
| 3 | `p7b`：D 节点 132 / 已本地化 132 / 需护栏 0 | 同左（逐字） | ✓ |
| 4 | `p4z-i18nviol`：locale=2948 / source=37 | 同左（逐字） | ✓ |
| 5 | §6.0 五件 blob | 5 个 blob **逐一相等**（§0.2） | ✓ |

**两口径数独立核**：码面 **33**（每语键数，现取四语全 33）与节点面 **132**（33 码 × 4 语 = 132 文案值，`p7b` D 段现取 132）—— **两数不同口径、不可互替**，交付报告 §1 的勘误与澄清**成立**。

### §L5.2 spec v2.1（`docs/route-layer.spec.md`）
```
$ wc -l docs/route-layer.spec.md                        → 3840
$ md5 docs/route-layer.spec.md                          → 3f261af960e3dd4a15ba1b08c3a0eed0（前缀 3f261af9… ✓）
$ git diff --numstat HEAD -- docs/route-layer.spec.md   → （空 —— 已入库，与 HEAD 一致）
$ git show --stat 4ea1148 | grep route-layer.spec.md    → docs/route-layer.spec.md | 179 +
$ cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.1.md  → CMP_EXIT=0（字节一致）
$ md5 docs/versions/route-layer.spec.v2.1.md            → 3f261af960e3dd4a15ba1b08c3a0eed0（== 主 spec）
```
**difflib 独立复核**（`v2.0` 快照 vs 主 spec，Python `SequenceMatcher`）：
```
base lines: 3661  new lines: 3840  diff: 179
opcode counts: {'equal': 6, 'insert': 6}
replace/delete occurrences: 0 0
```
⇒ **只见 equal + insert，0 replace / 0 delete**，净增 **+179** ⇒ **纯追加，无误删/改写**。

**20 个旧快照（v0.1–v2.0）零改动**：
```
$ ls docs/versions/ | grep -c 'route-layer.spec.v'    → 21（v0.1…v2.1；旧 = 20）
$ git status --porcelain docs/versions/               → （空 —— 无任何修改）
```
⇒ 旧 20 快照**零改动**复核属实；`v2.1` 快照与主 spec **字节一致**。

---

## §L6 未验证清单（逐项原因，禁填 0 或空）

| # | 未验证项 | 原因（逐项） |
|---|---|---|
| 1 | **真链（`apiErrorMessage`）由「纯 node 门」直跑** | 门 `p7b`/`p7c` 自述：`src/i18n.js` 的 `./utils` 无扩展名导入在 node 下不可解析 ⇒ D/F/G 用**链式决策镜像**（A 段读源码）。真链证据在**单测**（真 `i18n` + 真 `apiErrorMessage`）。⇒ 「门是否真跑链」= **不成立项**（已知边界，非疏漏）。 |
| 2 | **门 `p7c` 对「R1′ reason 判据回退」不红** | §L4.2 实测：改回旧口径后 `p7c` 仍 `EXIT=0`（纯 node 镜像不回放该代码；A 段调用数 4→3 但阈值 ≥1）。**可判负落点 = `p7a` ③ / `p7c` ⑧ 单测**。⇒ 「镜像门对 R1′ 的判负覆盖」= **当前无**（已坐实并登记）。 |
| 3 | **端到端（Playwright / `test:e2e`）** | 本单硬口径 = build + test:unit + 指定 `npx vitest run` + 七门；**未跑 e2e**（需起服务/浏览器，且硬口径禁启停 5787/5788）。⇒ 未测。 |
| 4 | **线上（生产）终验读数** | `f0bd336` **未推送**（禁 `git push`）⇒ 无线上读数。七门中 `p4z-feperf-safelist` 依赖本地 `dist/`（本次 build 产物，已核）。⇒ 未测。 |
| 5 | **四语「语言学家级」审校（地道度 / 语气）** | 本单做**结构与语义**判据（键齐备 / 非裸键 / 非机读码 / 键集相等 / 零 stub / 逐条对 canonical）；`hk` 8 条仅繁体转写、`footer.catSlogan*` 等存量中文**未做人工地道度审校**。⇒ 未测。 |
| 6 | **`LEDGER_IDEMPOTENCY_REPLAY` 运行时可达性** | R106 明定其**永不进错误分支**（200 良性）⇒ 其 `ledger.err.*` 文案**可能运行时不可达**（防御性键）。本单按「键齐备」类级判据纳管，**未验证运行时可达性**。⇒ 未测（登记）。 |
| 7 | **`frontend/src/**` 之外的下游消费者** | 本单范围 = `frontend/**`（硬口径不得改 `backend-ts/**`）；后端/其它仓对 `ledger.err.*` / `auth.err.*` 的**消费点未扫**（仅核「产出侧」）。⇒ 未测。 |
| 8 | **全 locale 面 en/vn 8 处 CJK 的整改** | 该 8 处为**存量偏离**（与 `d7dbf91` 逐字相同、在本批 33 码面之外）⇒ 不在本批范围，**未处理**（登记交裁）。 |

---

## §L7 收尾（端口空 + 首尾 git status 零污染 + worktree 收尾）

```
$ lsof -nP -iTCP:5796-5799 -sTCP:LISTEN
（空 —— LSOF_EXIT=1，5796–5799 无监听进程）
$ git status --porcelain          # 主工作区收尾态
?? docs/qa/p7-d-errmsg-i18n-review.md
?? frontend/.p7dqa-artifacts/
$ git rev-parse HEAD
80b15306f79571d91279155a0e446e577e1e490e
```
⇒ **开工态**：`git status --porcelain` 空、HEAD = `80b1530`；**收尾态**：仅**本报告** + 本单**产物目录**为未跟踪新增，**无任何 tracked 文件被改**（零污染）。HEAD 与开工一致（本单**不 `git add/commit/push`**）。

**副本逐文件 blob == `git rev-parse f0bd336:<path>`**：2163 个 tracked 项中 2162 项**逐一相等**；唯一不符项为**符号链接**（模式 `120000`，`git hash-object` 跟随软链所致），以 `git diff f0bd336 --stat`（空）复核**零 tracked 差异**（见 §0.2）。

**worktree 收尾**：
```
$ git worktree remove --force /Users/kevin/.hermes/profiles/zang/cache/scratch/qa7d   → EXIT=0
$ git worktree list                                                                    → 仅主工作区
```

**主工作区 blob 零污染凭据**（现取，`git status --porcelain` 仅上面两条 `??`，无 ` M` / ` M` 行）。

---

## §8 一句话

批 7-D 把 `ledger.err.*` **33 码**（= 33 码 × 4 语 = **132 个文案值**，节点面 132）落成四语本地化（flat **704 ⇒ 737**，四语键集相等、零 stub），并把 `details.reason` 机读码收口（R1′）。**我亲跑**：`build` EXIT 0 / `test:unit` **30 files 268 passed** / 七门全 EXIT 0；**四语逐码独立重取**：35/35 ① 恒命中、33 码语义逐条对 canonical 无误、en/vn 码面零 CJK、hk≠zh 33/33。**R-7D-2 我独立枚举后端码全集后判 HOLDS**（33 ledger + 2 auth 全有 locale 键）；**仓外副本两处判负逐字复现**：删键 ⇒ `p7b` EXIT 1 + 4 红；旧口径 ⇒ `p7c` 门 EXIT 0（**镜像门不回放 `auth.js`，我坐实**）+ 真链 2 红；均**复原回绿**、blob == `f0bd336`。报告 439/0、spec v2.1 3840/`3f261af9…`/179 0/difflib 纯 insert/旧 20 快照零改 —— **全部复核通过**。**PASS（建议入库）**。
