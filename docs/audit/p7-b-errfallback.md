# 批 7-B · `ledger.err.*` 回退护栏（C-1）报告

> 角色 = **Kong**（Builder） · 仓库 = `/Users/kevin/bistro/seafood` · 分支 = `main`
> 本单 = **只改前端**（`frontend/**`）；与并行的**后端退款单**（`backend-ts/**`）**文件面不相交**。
> 本报告**分段落盘**（先骨架、后逐节回填），不以一次性写入收尾。
> 硬口径：未做项写原因、禁填 0 或空；读数一律「命令 → 退出码 → 原文摘录」。

---

## §0 开工态与范围锚

**开工态（逐字）**：`git status --porcelain` → **空**（工作区干净）＝对锚成立；
`git branch --show-current` → `main`；`git log --oneline -1` → **`89b899d`**
（`docs: 批 7-A 生产终验读数（线上 /api/user/ledger 401 R107 ⇒ 新端点已上线；bundle 已换）+ 开下一批（退款实现单 0024 ∥ ledger.err 护栏）+ §5.164 E/G`）。

**开工 sha（逐件留证，收尾重取对照见 §8）**

| 件 | 开工 sha256 | 收尾 sha256 | 结论 |
|---|---|---|---|
| `frontend/src/auth.js` | `6200e64d72da6637bd7ed5d9b99f554fe384406126c3a6755bd9804d62bd5973` | `a72e7e18df8dc04ed35468c671d2833e56bdbb39be9c10fd63d87fa16b0e40a1` | **本单改**（唯一被改的已跟踪文件） |
| `frontend/src/ledger-api.js` | `c83573a0469192b9dcf497f94819eaf246ba615c1030eb65924ec37e4ebf142f` | 同左（**逐字未变**） | **未碰**（裁定 ⑤ 明令不得改其既有契约） |
| `frontend/src/locales/{zh,hk,en,vn}.json` | `5e576ea6…` / `c2ed3386…` / `f85cb44e…` / `3a73acce…` | **逐字相同** | **未碰**（见 §2-⑤：复用既有兜底键，**不需要新增键**） |
| `frontend/src/i18n.js` | `97b316d8d3f3628cc8927d968ec53ac3d460c2c84256e1454911c3bd28b58d50` | 同左 | **未碰** |

**本单新增件（3）**：`frontend/scripts/p7b-errfallback-gate.mjs`、`frontend/src/test/unit/p7b-errfallback.test.js`、本报告。
**本单未碰**：后端任何文件、`migrations/**`、任何 `docs/*.spec.md`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**` 既有件、`.env*`；
未 `git add/commit/push`；未 `npm install`；未启停 5787/5788；未用 `pkill -f` / `killall`。

> **并行面登记（诚实标注）**：收尾 `git status --porcelain` 另有 **8 条非本单** 未跟踪件 =
> `backend-ts/.p4-artifacts/p6tr1a-20261002T075248Z/`、`backend-ts/.p7b-artifacts/`、
> `backend-ts/migrations/0024_admin_refund_audit.sql`、
> `backend-ts/scripts/p7b-{00-recon,01-migration-dry-run,02-t2-capture,dbg,lib}.ts`
> ⇒ 属**并行的后端退款单**（该单在推进：本单执行期间多出 `p7b-02-t2-capture.ts`），本单**未读改**
> （`git diff --numstat` 仅 1 行 = `frontend/src/auth.js`）。**该清单会随并行单继续变化**，非本单产出。

---

## §1 背景与缺陷面（逐字）

1. **契约面**：`R107`（`docs/ledger.spec.md`）规定账本错误统一响应体
   `{ error: { code, message, i18n_key, details } }`，其中 `i18n_key` 的**命名法**是 `` `ledger.err.${code}` ``
   （真源 = `backend-ts/src/ledger-errors.ts`；本单现取 `LEDGER_ERROR_TABLE` **33 键**）。
2. **缺口面**：四语 locale `frontend/src/locales/{zh,hk,en,vn}.json` **无 `ledger.err.*` 族键**
   （`docs/data-layer.spec.md` §11.3.1 早已登记「**需新增键**」）。本单实测：
   `zh` 的 `ledger.*` 键 **25 个**（`ledger.balance` / `ledger.kind.*` …），`ledger.err.*` = **0 个**；四语 flat 键各 **704**。
3. **泄漏机理（实测，非推断）**：i18next 对**未命中**键**原样回键名本身**。本单现取探针：
   `i18next.t('ledger.err.LEDGER_AMOUNT_INVALID')` → `"ledger.err.LEDGER_AMOUNT_INVALID"`（`exists()` = `false`）。
   ⇒ 任何直接 `t(key)` 的路径都会把**裸键**当文案输出（用户看到 `ledger.err.LEDGER_AMOUNT_INVALID`）。
4. **★ 本单新采到的第二形态（原单未提）**：当服务端把键**放进 `message`** 且带 `details.reason` 时，
   既有 `extractApiErrorMessage` 会拼出 `'ledger.err.LEDGER_AMOUNT_INVALID (NOT_DECIMAL_STRING)'`
   —— **整串判据判不出，裸键却照样出现在用户文案里** ⇒ 本单护栏的判据因此升为「**出现** token」级（见 §6-①）。

---

## §2 裁定落点（C-1 逐条）

| 裁定 | 逐字要求 | 落点（现取） | 证据 |
|---|---|---|---|
| **① 加守卫** | 错误文案链上，`t(key)` 未命中（回键名本身 / 含 `.` 的裸键形态）⇒ 落**四语通用兜底**，**绝不裸键** | `frontend/src/auth.js` `resolveI18nMessage`（末道闸）；准入闸 = `isUsableText`；终局 ③ = `FALLBACK_I18N_KEYS.REQUEST_FAILED`、④ = ASCII | §4 G6；§5 NC① |
| **② 可判负门** | 「用户可见文案不得出现 `x.y.z` 形态裸键」成**机读判据**；存量逐条登记；本单新增面零命中 | 新增 `frontend/scripts/p7b-errfallback-gate.mjs`（同族 p7b 前缀，与 `p7a-03` 同口径） | §4 G6（判负 0；存量 0 条） |
| **③ 判负自证** | ①拆守卫 ⇒ 新单测必红（红读数 = `ledger.err.…`）；②删某语兜底键 ⇒ 门非零退出 | 均在**仓外副本**内做 | §5 NC① / NC② |
| **④ 登记** | 132 键（33 码 × 4 语）逐码本地化 = 产品/文案决策 ⇒ P6/P7 待定，**本单不补**；写明「将来逐码本地化 ⇒ 护栏自动让位」 | 本报告 §6-②；代码注释 `auth.js` `resolveI18nMessage` ① 行 | §6 |
| **⑤ 范围限定** | 只改 `frontend/**`；**不得改** `ledger-api.js` 既有契约、后端任何文件、`migrations/**`、各 `docs/*.spec.md` / master-plan / `docs/qa/**` / `docs/audit/**` | `git diff --numstat` = **仅** `frontend/src/auth.js`（`89 15`）；`ledger-api.js` sha 未变；**未新增 locale 键**（复用既有 `auth.err.REQUEST_FAILED` 一族 ⇒ 四语本就齐备） | §0 / §8 |

**候选次序（`resolveI18nMessage` 内，逐条可判负）**：
① `t(i18nKey)` 可用 ⇒ 用它（**将来逐码本地化后自动让位**）；
② 服务端原文（`R107` 的 `message` = 中文文案，属真人可读文本）可用 ⇒ 用它；
③ 四语通用兜底 `auth.err.REQUEST_FAILED`；④ ASCII `Request failed (status)`。

> **为什么 ② 先于 ③（诚实登记 · 非偏好）**：既有已验收用例 `auth.test.js` S6（410 弃用面，
> `i18n_key = 'ledger.err.LEDGER_REF_NOT_FOUND'` **四语均缺** + 真人可读 `message`）**逐字断言保留服务端文案**。
> 若 ③ 先于 ②，S6 会从「保留服务端文案」退化为通用兜底 ⇒ **既有验收面回归**（`npm run test:unit` 掉测试）。
> ⇒ 裁定①的「落四语通用兜底」在本单落成：**①② 都不可用时**（键未命中 ∧ 无原文 ∧ 原文本身即裸键）
> 一律落 ③ —— **这正是 `ledger.err.*` 今天会走的路径**。

**附带收口（同属错误文案链，逐条给因）**：`extractApiErrorMessage` 不再把 `error.code` 当「服务端**文案**」
（`code` 是机读码）；把它直丢给用户正是 **p7-A R-1 已裁定的「服务端码原文」缺陷类**。
⇒ 只给 `code`、无 `message` 的 `ledger.err.*` 响应现在也落四语通用兜底（见 §4 G5 用例④/⑧）。
**回归证据**：改后 `npm run test:unit` = **258 passed / 0 failed**（含既有 250 条，一条未红）。

---

## §3 改动清单

**A. 已跟踪文件（`git diff --numstat`）**

```
89  15  frontend/src/auth.js        ← C-1（裸键判据 + 准入闸 + 四跳候选链 + `code` 不作文案 + 注释留痕）
```

**B. 新增件（3）**

| 件 | 作用 |
|---|---|
| `frontend/scripts/p7b-errfallback-gate.mjs` | 新门（A 护栏在场 / B locale 文案面 / C 兜底键四语齐备 / D 33 码 × 4 语行为节点 / E 判据自证）；**只读** |
| `frontend/src/test/unit/p7b-errfallback.test.js` | 判负单测 **8 例**（真 `i18n` 实例 + 真 locale 查表，**四语逐语断言**） |
| `docs/audit/p7-b-errfallback.md` | 本报告 |

**C. `frontend/src/auth.js` 逐处留痕**

| 处 | 内容 |
|---|---|
| `BARE_I18N_KEY_RE` / `looksLikeBareI18nKey` | **整串**判据（`a.b` / `a.b.c`，各段标识符）——**具名导出**供门/单测消费 |
| `BARE_I18N_KEY_TOKEN_RE` / `containsBareI18nKey` | **token** 判据（文案里**出现**裸键即命中）——**具名导出** |
| `isUsableText(value, key)` | 准入闸：非空 ∧ ≠所查键名 ∧ **不含裸键 token** |
| `resolveI18nMessage(i18nKey, fallback, vars)` | 四跳候选链（§2）；守卫本体；动态导入保留（不污染静态依赖图） |
| `extractApiErrorMessage` | `base = error.message \|\| ''`（原 `\|\| error.code`）——**code 不作文案** |
| `apiErrorMessage` | 不再把 ASCII `Request failed (status)` 塞进 `fallback`（否则「键未命中 ∧ 无原文」会落英文而非四语） |
| 未改动 | `FALLBACK_I18N_KEYS`（复用既有 `REQUEST_FAILED` / `NO_CREDENTIAL`，四语齐备）、`fetchApiJson`、`noCredentialError`、其余 `auth.js` 全文 |

---

## §4 硬门读数（退出码**在管道外**捕获；命令一律 `cmd > 文件 2>&1; echo EXIT=$?`）

| 门 | 命令（`frontend/`） | 退出码 | 读数（原文摘录） |
|---|---|---|---|
| **G1 build** | `npm run build` | **0** | `✓ built in 1.63s` |
| **G2 test:unit** | `npm run test:unit` | **0** | `Test Files 29 passed (29)` / `Tests 258 passed (258)`（**≥250 不掉**；= 开工 250 + 本单新增 8，**零既有用例红**） |
| **G3 脚本①** | `node scripts/p4z-i18nviol-global.mjs` | **0** | `总判：PASS（locale 裸命中 0 + 源面裸命中 0；作用域节点数 locale=2816 / source=37）` |
| **G4 脚本②** | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | `[TR-2] 总判：PASS` |
| **G5 脚本③** | `node scripts/p4z-miscfix-links.mjs` | **0** | `总判：PASS（残留全部已登记）` |
| **G6 脚本④** | `node scripts/p4z-feperf-safelist.mjs` | **0** | `VERDICT=PASS` |
| **G7 同族既有门** | `node scripts/p7a-03-errmessage-gate.mjs` | **0** | `总判：PASS（未登记命中 0 必须 = 0；扫描文件 77 / 受体 6 / 命中 3 / 基线 3）` |
| **G8 新门（C-1②）** | `node scripts/p7b-errfallback-gate.mjs` | **0** | `总判：PASS（判负 0 必须 = 0；A=PASS / B 含裸键值=0 / C 兜底键=2×4 / D 节点=132 需护栏=132 已本地化=0 / E 样本=17）` |

**G8 分段读数（原文）**

```
A 护栏在场：① 导出 looksLikeBareI18nKey=true  ①' 导出 containsBareI18nKey=true
            ② isUsableText 用到 token 判据=true  ③ resolveI18nMessage 内 isUsableText( 调用数=2（≥2）
B locale 文案面：zh/hk/en/vn 各 704 叶子值，含裸键 token = 0/0/0/0（存量登记 0 条）
C 通用兜底键：auth.err.REQUEST_FAILED ⇒ zh:OK hk:OK en:OK vn:OK；auth.err.NO_CREDENTIAL ⇒ 同
D 行为节点：33 码 × 4 语 = 132；「未命中 ⇒ 依赖护栏」= 132；「已本地化 ⇒ 护栏让位」= 0
            例：zh · ledger.err.LEDGER_AMOUNT_INVALID ⇒ "请求失败 (400)"
E 判据自证：裸键样本 4 ⇒ true；正常文案样本 8 + 非字符串 5 ⇒ false；
            拼接面 "ledger.err.LEDGER_AMOUNT_INVALID (NOT_DECIMAL_STRING)" ⇒ 整串=false / token=true
```

**G2 新单测逐例（`npx vitest run src/test/unit/p7b-errfallback.test.js` → EXIT 0，`8 passed`）**

| 例 | 判据 | 四语逐语断言（真 lang 查表） |
|---|---|---|
| ① | 整串判据 + **token 判据**（含拼接面）true/false + 非字符串 | —（纯谓词） |
| ② | **裸键面**：`message = 键名` ∧ `details.reason` ⇒ 落该语通用兜底；`not.toContain('ledger.err.')` / `not.toContain('NOT_DECIMAL_STRING')` | zh/hk/en/vn 期望值 = `locales/<lang>.json` 的 `auth.err.REQUEST_FAILED` 真串（代入 status） |
| ③ | 只给 `i18n_key`（连 `code` 都无）⇒ 落**该语**通用兜底（**不落英文 ASCII**） | 同上 + `=== i18n.t('auth.err.REQUEST_FAILED',{status})` |
| ④ | 只给机读 `code` ⇒ 落该语通用兜底，**不含 `LEDGER_AMOUNT_INVALID`** | 同上 |
| ⑤ | 原文直通面：`message` 即裸键 ⇒ 该语通用兜底 | 同上 |
| ⑥ | **让位面**：真键命中 ⇒ 用真文案（护栏不得打掉真命中） | `=== locales/<lang>` 的 `auth.err.AUTH_UNAUTHORIZED` |
| ⑦ | **既有面回归锚**（S6 语义）：未本地化键 + 真人可读 `message` ⇒ **保留原文** | `=== 'endpoint deprecated: /api/auth/register'`，且 `i18n.exists('ledger.err.LEDGER_REF_NOT_FOUND')===false` |
| ⑧ | **端到端**：`fetchMyLedger` 401 面 ⇒ 用户可见串非裸键，且 `=== apiErrorMessage(payload,401)` | 同上 |

---

## §5 判负自证（两件；**全部在仓外副本内做**）

**副本锚（零仓内污染）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p7b-neg/frontend/`
（`cp -R src scripts package.json vitest.config.js` + `node_modules` 软链；`auth.js` 初拷 sha = `a72e7e18…` = 主工作区**逐字相同**）。
主工作区全程**未做任何变异**（§8 `git status` 终态佐证）。

### §5.1 NC①（拆守卫 ⇒ 新单测必红）

- **变异**：副本 `src/auth.js` ← `git show HEAD:frontend/src/auth.js`（= 改前原作，sha `6200e64d…`，**回改前即「守卫不存在」**）。
- **命令**：`npx vitest run src/test/unit/p7b-errfallback.test.js` ⇒ **`EXIT=1`，`Test Files 1 failed` / `Tests 8 failed (8)`**（红）。
- **红读数（逐字摘录，佐证「输出 = `ledger.err.…`」）**：
  - ② `AssertionError: [zh] 必须落该语通用兜底: expected 'ledger.err.LEDGER_AMOUNT_INVALID (NOT…' to be '请求失败 (422)'`
  - ③ `AssertionError: [zh] 必须落该语通用兜底: expected 'Request failed (400)' to be '请求失败 (400)'`
  - ④ `AssertionError: [zh] 必须落该语通用兜底: expected 'LEDGER_AMOUNT_INVALID' to be '请求失败 (409)'`
  - ⑤ `AssertionError: [zh]: expected 'ledger.err.LEDGER_AMOUNT_INVALID' to be '请求失败 (500)'`
  - ⑧ `AssertionError: [zh]: expected 'LEDGER_AMOUNT_INVALID' to be '请求失败 (401)'`
  - ① `AssertionError: expected undefined to be an instance of RegExp`（改前未导出判据）
- ⇒ **红因 = 守卫缺位**；把守卫加回（= 现取 `auth.js`）后 `8 passed`（§4 G2）。

### §5.2 NC②（删某语通用兜底键 ⇒ 门必非零退出）

- **变异（副本内）**：`delete zh.json.auth.err.REQUEST_FAILED`（删后该语 `auth.err` 剩 5 键）。
- **命令**：`node scripts/p7b-errfallback-gate.mjs` ⇒ **`EXIT=1`**（非零，符合判负要求）。
- **判负读数（逐字）**：
  `auth.err.REQUEST_FAILED ⇒ zh:**缺/非法**  hk:OK  en:OK  vn:OK`
  `判负 1 条（必须 = 0）：! C 通用兜底键 \`auth.err.REQUEST_FAILED\` 在 zh 缺失 / 为空 / 为裸键（值 = undefined）`
  `总判：FAIL（… A=PASS / B 含裸键值=0 / C 兜底键=2×4 / …）`
- **附加（同副本，非要求项）**：把副本 `auth.js` 换成改前版再跑门 ⇒ `EXIT=1`，`判负 40 条`，首四条 =
  `! A① 缺具名导出 \`looksLikeBareI18nKey\`` / `! A①' 缺具名导出 \`containsBareI18nKey\`` /
  `! A② \`isUsableText\` 未定义 / 未用 token 判据` / `! A③ \`resolveI18nMessage\` 未以闸收口（isUsableText 调用 0 < 2）`
  ⇒ **门对「拆守卫」同样可判负**（两条独立通路）。
- **复原**：副本 `auth.js` 复位为 `a72e7e18…`、副本 `zh.json` 由主工作区原件覆盖；主工作区**自始至终未被变异**。

---

## §6 登记项（不自作主张）

**① 已知残余（判据面）**：token 判据是**子串级** ⇒ 形如 `See docs.v2` 的英文文案会被误判为裸键而落通用兜底
（本仓服务端文案面**无此形态**：现取 `SERVER_MESSAGE_I18N_KEYS` 两键 + `R107` 的 `message` 均为整句）。
若将来服务端文案出现「点分标识符样式的普通词」，须收窄 `BARE_I18N_KEY_TOKEN_RE`（本单**不改**）。

**② ★ 132 键逐码本地化 = 产品/文案决策 ⇒ 归 P6/P7 待定（本单不补）**
- 面 = **33 码 × 4 语 = 132 键**（键名 `ledger.err.<CODE>`；`<CODE>` 真源 = `backend-ts/src/ledger-errors.ts` 的 33 键关闭集）。
- 本门读数：`D 节点 = 132；「未命中 ⇒ 依赖护栏」= 132；「已本地化 ⇒ 护栏让位」= 0` ⇒ **今天 132/132 全依赖护栏**。
- **护栏让位语义（写死）**：任何 (码, 语) 一旦在 locale 里补上真文案，
  `resolveI18nMessage` ① 行 `t(i18n_key)` **命中即用真文案** ⇒ 护栏**自动让位**、**无需改代码**；
  本门 D 段会把它从「需护栏」改读为「**已本地化登记**」而**不判负**（门不红，只读数变化）。
- **未补的原因**：属**产品/文案决策**（132 条用户可见措辞 × 4 语），不在本单授权内（裁定 ④ 逐字「归 P6/P7 待定，本单不补」）。

**③ 已收口的相邻缺陷**：`extractApiErrorMessage` 的 `error.code` 曾当「服务端文案」直丢用户
（p7-A R-1 同族缺陷）⇒ 本单并入文案链收口（§2 附带收口；既有 250 例**零回归**）。

---

## §7 未测项与原因

| 项 | 状态 | 原因（不得填 0 / 空） |
|---|---|---|
| 浏览器级 E2E（`npm run test:e2e`） | `NOT_MEASURED` | 需 dev server + 浏览器 + 登录态；本单硬门口径不含 e2e，**未跑**，故**不给读数** |
| 后端 / 迁移 / DB 面 | `N-A` | 本单**只改前端**（裁定 ⑤）；未连库、未起后端实例 |
| 5787 / 5788 服务实例 | `未启停` | 本单无需实例（不跑 HTTP 探针）；硬口径 ① 明令不得启停 |
| 跨语种机器翻译质量 | `N-A` | 本单**未新增任何文案**（复用既有四语兜底键），无新译文可评 |

---

## §8 收尾锚

- 收尾 `git status --porcelain`（逐字）：
  `M frontend/src/auth.js` / `?? frontend/scripts/p7b-errfallback-gate.mjs` /
  `?? frontend/src/test/unit/p7b-errfallback.test.js` / `?? docs/audit/p7-b-errfallback.md`
  （+ §0 登记的 **8 条并行后端单未跟踪件**，非本单；清单随并行单推进而变）。
- 主工作区**未留在弄坏态**：`git diff --numstat` = 仅 `89 15 frontend/src/auth.js`；
  四语 locale / `ledger-api.js` / `i18n.js` **sha 逐字未变**；无遗留探针（`ls src/test/unit | grep dbg` → 无）。
- 收尾硬门：**G1–G8 全 PASS**（§4）；`test:unit` 258 ≥ 250；两条判负自证在**仓外副本**内完成（§5）。
