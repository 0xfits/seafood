# P4-B4c-ii-c 收尾报告（两项 · 前端唯一）

- **单**：P4-B4c-ii-c / 前端收尾（Kong）
- **范围**：① 两条登录 401 文案四语覆盖（§9.B **B14** / §7-48）② 市场页 `baseCid === 1` 退化币对不发请求 + 空态区分（§5.103 裁定小项）
- **时间**：2026-09-30（本机 `date "+%Y-%m-%d %H:%M:%S %Z"` = `2026-09-30 23:39:17 CST`，见 run 目录 `pre/`）
- **产物**：`backend-ts/.p4-artifacts/b4ciic-20260930T2339+0800/{pre,post}/`（日志与几何 JSON 全在此）
- **探针**：`frontend/scripts/p4z-b4ciic-locales.mjs`（文案落盘+键集对拍）· `p4z-b4ciic-retarget.mjs`（尺子改目标页）· `p4z-b4ciic-geometry.mjs`（几何回归本体）
- **报告顺序**：先定小节骸架（§0–§6）→ 逐段回填实测读数（每处读数都对应 §5 的 grep 支撑）。

---

## 0. 硬 AC 对拍（读数全部来自 run 目录日志，退出码**管道外**捕获）

| # | 硬 AC | 读数 | 支撑文件 | 判定 |
|---|---|---|---|---|
| ① | `npm run build` exit 0 | `BUILD_EXIT=0`（末轮 `BUILD_FINAL_EXIT=0`，同一工作树） | `post/build-b4ciic.log` · `post/build-b4ciic-final.log` | **PASS** |
| ② | `npx vitest run src/test/unit` exit 0 且例数 > 105 | `VITEST_EXIT=0` · `Test Files 12 passed (12)` · `Tests 112 passed (112)` | `post/vitest-b4ciic.log:183-184` | **PASS**（基线 105 ⇒ **+7**，本单新增 7 例，≥ 要求的 4 例） |
| ③ | 四语 locale 键集相同 | `verdict.summary = ALL_FOUR_IDENTICAL` · 深键 **176** 键/文件 | `pre/locales-write.json:775-782` | **PASS** |
| ④ | 主题同构不回退（几何回归） | `/shard`：`geometry_diff_count = 0`、`perturbation_detected = true`、日夜往返逐字节相同；`/login`：**NOT_MEASURED**（原因见 §4.3） | `post/b4ciic-geometry.json` | **PASS(市场页) / NOT_MEASURED(登录面板几何)** |

> 退出码取法（§5.7 ①）：`npx vitest run src/test/unit > <log> 2>&1; echo "VITEST_EXIT=$?"` —— 重定向在管道之外，`$?` 即 vitest 自身退出码（首轮 = 1，见 §5 失败留痕；终轮 = 0）。

---

## 1. ① 两条登录 401 文案的四语覆盖

### 1.1 机制（写在既有 `extractApiErrorMessage`/`apiErrorMessage` 链上：**按服务端原文做映射表**）

服务端这两条 401 **不带头部可解析的 `i18n_key` / `code`**：真源 = `backend-ts/src/auth.ts:223`（`Invalid wallet signature`）/ `:227`（`Signature does not match the claimed address`），经既有出口 `sendError(res, 401, error.message)`（`backend-ts/src/index.ts:376-380`）⇒ 响应体形状 = `{ success:false, message, error:<同一字符串> }`（**`error` 是字符串，不是对象**）。前端只能按**原文**建映射表。

| 服务端原文（逐字） | 前端映射键（`frontend/src/auth.js:119-122`） | zh | en | hk | vn |
|---|---|---|---|---|---|
| `Invalid wallet signature` | `auth.err.INVALID_WALLET_SIGNATURE` | 钱包签名无效，请重新签名后再登录。 | The wallet signature is invalid. Please sign again to log in. | 錢包簽名無效，請重新簽名再登入。 | Chữ ký ví không hợp lệ, vui lòng ký lại để đăng nhập. |
| `Signature does not match the claimed address` | `auth.err.SIGNATURE_ADDRESS_MISMATCH` | 签名与所声明的钱包地址不一致，请切回正确的钱包账号再重试。 | The signed account is not the one that was claimed. Please switch accounts and retry. | 簽名同所聲明嘅錢包地址唔一致，請轉返正確嘅錢包帳號再試。 | Chữ ký không khớp với địa chỉ ví đã khai báo, vui lòng chuyển lại đúng tài khoản ví rồi thử lại. |

- **键名口径**：`auth.err.<原文 SCREAMING_SNAKE 化>` —— 是**前端映射键**，**不是服务端 code**（§3.6：服务端零新码 / 零新 reason / 零新 kind，本单未动后端一行）。四语**键名逐字一致**（§0-③）。
- **解析优先级**（`frontend/src/auth.js:163-171`）：① `error.i18n_key`（`R107` 契约键，原逻辑不动）② **原文映射表**（本单新增）③ `extractApiErrorMessage` 兜底（未登记 ⇒ 原样服务端文案；连文案都没有 ⇒ `请求失败 (status)`）。**任何一支都不返回空串、不会出现 `[object Object]`**。
- **翻译取值仍是动态 `import('./i18n')`**（`frontend/src/auth.js:143-156`）：保持「不把 `i18n.js` 拉进 `auth.js` 静态依赖图」的既有理由（既有单测对 `react-i18next` 做 mock）。`i18n` 不可用 ⇒ 回落服务端原文（**这是唯一的「英文露面」路径**，且只在 i18n 初始化失败时发生 —— 明确登记，不粉饰）。

### 1.2 逐项 `文件:行号`

| 文件 | 行号（现取） | 改动 |
|---|---|---|
| `frontend/src/auth.js` | `111-117` | 口径注释（B14 真源 / 出口 / 形状 / 「前端映射键非服务端 code」） |
| `frontend/src/auth.js` | `119-122` | `SERVER_MESSAGE_I18N_KEYS`（2 键；`Object.freeze`） |
| `frontend/src/auth.js` | `125-127` | `i18nKeyForServerMessage`（未登记 ⇒ `undefined`，调用方必须保留兜底） |
| `frontend/src/auth.js` | `143-156` | `resolveI18nMessage(i18nKey, fallback)`（签名由「对象面」改为「键面」，纯内部函数） |
| `frontend/src/auth.js` | `163-171` | `apiErrorMessage`：原文字段提取（`error` 字符串面 / 对象面 `message||code` / 顶层 `message`）+ 三档优先级 |
| `frontend/src/locales/zh.json` | `75-76` | `auth.err.INVALID_WALLET_SIGNATURE` / `auth.err.SIGNATURE_ADDRESS_MISMATCH` |
| `frontend/src/locales/en.json` | `75-76` | 同上（键名逐字一致） |
| `frontend/src/locales/hk.json` | `75-76` | 同上 |
| `frontend/src/locales/vn.json` | `75-76` | 同上 |
| `frontend/src/components/auth/WalletAuthPanel.jsx` | `132` | 根节点加 `data-sf-m="auth-wallet-panel"`（**仅供尺子取点**，无 CSS/无布局影响） |

**登录面板为何「未改却已覆盖」**：`WalletAuthPanel.jsx:125` 的 `toast.error(error.message || '签名验证失败')` 与 `AuthPage.jsx`（`WalletAuthPanel` 唯一宿主，`AuthPage.jsx:153-156`）展示的都是 `error.message` —— 而该串**在 `auth.js` 的 `fetchApiJson` 抛出前就已按原文映射成四语**（`auth.js:152` → `auth.js:163-171`）。⇒ 两面板**结构性拿不到英文原文**，因此本单未在面板层再加一层映射（避免双份键表漂移）。登记：面板层**无 diff**（除 §1.2 末行的取点属性）。

---

## 2. ② 市场页退化币对（`baseCid === 1`）：不发请求 + 空态区分

### 2.1 口径
`quote_cid` 服务端恒 `1`（§4.2 M1；`market-api.js:30` 的 `QUOTE_CID`）；`baseCid === 1` ⇒「`$` 对自身」= **退化币对**，与「`quote_cid` 恒 1 且 base≠quote」互斥 ⇒ 该路径恒空态。本单把它从「隐式不合法」升格为**显式分支**：**页面结构性不发该请求**，且空态文案与「真无挂单」区分。

### 2.2 逐项 `文件:行号`

| 文件 | 行号（现取） | 改动 |
|---|---|---|
| `frontend/src/pages/market/MarketPage.jsx` | `50-55` | 拆三态：`basePositive`（正整数）/ `baseDegenerate`（`=== QUOTE_CID`）/ `baseValid = basePositive && !baseDegenerate` |
| `frontend/src/pages/market/MarketPage.jsx` | `56-66` | `loadMarket`：**先判退化**（`59-64`，直接落 `market.pairDegenerate` 空态并 `return`，**不触任何 fetch**）→ 再判未填/非法（`65-69`，落 `market.bookEmpty`/`market.tradesEmpty`）→ 才进 loading/请求（`70` 起） |
| `frontend/src/pages/market/MarketPage.jsx` | `29-32` | 文件头口径块：新增退化币对条（含与「真无挂单」的区分声明） |
| `frontend/src/pages/market/market-api.js` | `51-52` | 注释：退化币对**由页面层拦下**、本数据层**不做静默改写**（不把 1 换成别的 cid） |
| `frontend/src/locales/{zh,en,hk,vn}.json` | `159` | 新增 `market.pairDegenerate`（四语；键名逐字一致） |

四语文案（`market.pairDegenerate`）：

| zh | en | hk | vn |
|---|---|---|---|
| 币对退化：平台计价币（#1）不能与自身成对，该请求已跳过。 | Degenerate pair: the platform quote currency (#1) cannot be paired against itself, so the request was skipped. | 幣對退化：平台計價幣（#1）唔可以同自己成對，嗰個請求已經跳過。 | Cặp tiền suy biến: đồng định giá nền tảng (#1) không thể ghép cặp với chính nó, yêu cầu đã được bỏ qua. |

> 该键**同时**用于盘口与成交两个面板的退化空态（退化是**币对**属性，不是单一面属性）；「真无挂单」仍为 `market.bookEmpty` / `market.tradesEmpty`（请求发出去、回包为空）。
> **边界（未扩大）**：`frontend/src/pages/admin/ShardsManagement.jsx:60` 也有 `fetchApiJson('/api/market/${bID}/orderbook', ...)`（**后台碎片管理页**，bID 由运营手填）—— 本单**未动**（既非「市场页」，也非 §5.103 裁定对象），如需同口径收敛请另开单。

---

## 3. 新增单测（+7；逐条给 `文件:行号`）

| # | 用例 | 文件:行号 |
|---|---|---|
| 1 | B14 ①：`Invalid wallet signature`（`sendError` 形状）⇒ 映射四语、**不等于**英文原文、非空、无 `[object Object]` | `frontend/src/test/unit/auth.test.js:133` |
| 2 | B14 ②：`Signature does not match the claimed address`（对象面 `message`）⇒ 第二条映射 | `frontend/src/test/unit/auth.test.js:150` |
| 3 | B14 ③：未登记错误 ⇒ 保留服务端文案（映射不到**不得空白**） | `frontend/src/test/unit/auth.test.js:165` |
| 4 | B14 ④：连文案都没有的错误体 ⇒ 通用兜底 `请求失败 (status)` | `frontend/src/test/unit/auth.test.js:173` |
| 5 | §5.103 ①：`base_cid=1` ⇒ 页面**不发** `/api/market/**`（`callsTo('/api/market/').length === 0`）且空态 = `market.pairDegenerate` | `frontend/src/test/unit/listing-market.test.jsx:219` |
| 6 | §5.103 ②：`base_cid=7` + 回包空数组 ⇒ **请求确实发出**（`/api/market/7/orderbook` = 1 次）且空态 = `market.bookEmpty`（与退化区分） | `frontend/src/test/unit/listing-market.test.jsx:232` |
| 7 | 四语 locale **深键集逐文件对拍**（`keyPaths` 递归）+ 新增 3 键四语齐备、非空、**不是英文原文照抄** | `frontend/src/test/unit/listing-market.test.jsx:261` |

---

## 4. 主题同构回归（几何量测）

### 4.1 尺子与目标
`frontend/scripts/p4z-b4ciic-geometry.mjs` = 由 `p4z-b4ciib-geometry.mjs` **逐处字符串替换**改目标页（替换脚本 `p4z-b4ciic-retarget.mjs`，每处替换点要求「命中且仅命中 1 次」，`RETARGET_EXIT=0`，见 `pre/retarget.json`）；量测逻辑（日夜 rect 逐值 / 1px 灵敏度 / 同档两次逐字节 / 夜归日逐字节 / 横竖屏签名 / 换肤证明）**一字未改**。目标页 = `/shard`（② 改页）· `/login`（① 改页）。无 dev server：`page.route` 把 `http://sf.local/**` 映射到 `frontend/dist`，外部 CDN 一律 abort（`blocked_external_origins` = cdn.tailwindcss.com / cdnjs.cloudflare.com / fonts.googleapis.com / cdn.jsdelivr.net / raw.githubusercontent.com）。

### 4.2 `/shard`（市场页）— **实测 PASS**

| 读数 | 值 |
|---|---|
| `geometry_diff_count`（日 vs 夜 rect 逐值） | **0** |
| `present_elements` / `measured_elements` | 21 / 44（未出现的选择器多为商品线专用点，`null` 不计） |
| `perturbation_detected`（1px 注入到 `[data-sf-m="mkt-form"]`） | **true**（尺子确实能判出 1px） |
| `day_repeat_byte_identical` / `day_return_byte_identical` | true / true |
| `skin_changed`（真换肤证明） | **true** |
| `contains_object_object` | false |
| `responsive.signature_equal_wide_vs_portrait` | true |

JSON 路径：`post/b4ciic-geometry.json` → `verdict.market`。

### 4.3 `/login`（登录面板）— **NOT_MEASURED**（§5.7 ⑥：不填 0、不填空）

- 事实（可 grep）：探针导航到 `http://sf.local/login` 后，**落点 `path = "/"`**（`arms.login_night.path = /`），DOM 签名 = `DIV[shell]>DIV[topnav]>MAIN[content]>DIV[footer]>NAV[tabbar]>…`（**导航外壳 + 首页**，非登录卡）；`[data-sf-m="auth-wallet-panel"]` 在该落点 **DOM 中不存在**（`rects` 里只有 5 个 shell/内容区选择器非 null）；扰动臂随之 `detected=false`、`day=null/perturbed=null`（`arms.login_perturbation`）。
- ⇒ **登录面板自身的几何 = NOT_MEASURED**（不是「diff=0」，也不是空）。此页的 `geometry_diff_count = 0` 只对**被重定向到的首页路由**成立，**不得**当作面板证据。
- 本单 ① 的替代证据（结构级，可复核）：改动仅一处属性 + 一处文案解析链 —— `WalletAuthPanel.jsx:132` 加 `data-sf-m`（无 class/style 变更 ⇒ 无布局影响）、`auth.js:119-171` 纯 JS 文案链（不产出 DOM 节点、不引入 CSS）；`+7` 例单测（§3）覆盖文案行为；`git diff` 层面 `frontend/src/components/auth/WalletAuthPanel.jsx` 仅 1 行变更。**若需面板几何硬证据，需另一条能真正落到 `/login` 的探针路径（疑与 LangShell 兜底路由 `App.jsx:246` 的 `/` 重定向有关）——本单未解，登记为遗留。**

### 4.4 探针自曝（不进「实测」台账的干扰项）
1. `page_errors = ["ReferenceError: tailwind is not defined", …]`（两页各一条）：`index.html` 的内联 tailwind 配置脚本依赖被 abort 的 `cdn.tailwindcss.com` ⇒ 与主题/几何无关，且**两档一致**（不影响日夜对拍）。此为尺子既有环境事实，非本单引入。
2. jsdom 下 `fs.readFileSync(new URL(...))` 抛 `ERR_INVALID_ARG_TYPE`、`new URL(.., import.meta.url).pathname` 解析成 `/src/...`（首版两轮失败，见 §5）⇒ 改为 `fileURLToPath(import.meta.url)` 推 `SRC`（与 `theme-shell-isomorphism.test.jsx:29-30` 同法）。

---

## 5. 失败留痕（本单自曝，不抹）
- 第 1 轮 vitest：`VITEST_EXIT=1`，2 例失败 —— (a) `getByText('market.pairDegenerate')` 命中**多个**元素（退化空态同时落在盘口与成交面板）；(b) `fs.readFileSync(URL)` 类型错误。修法见 `listing-market.test.jsx:226`（改 `getAllByText`）与 `:250-252`（`fileURLToPath`）。
- 第 2 轮 vitest：`VITEST_EXIT=1`，1 例失败 —— `new URL(..).pathname` 在 vitest 下解析为 `/src/locales/zh.json`（jsdom `URL` ≠ node `URL`）。第 3 轮起 exit 0。
- 第 1 次落盘脚本 dry-run：`JSON.parse` 报 `Unexpected string`（市场键插入行漏尾逗号）⇒ 抛错即**未写盘**（脚本先 `JSON.parse` 再 `writeFileSync`，坏 JSON 不允许落盘），修后 `DRYRUN_EXIT=0` / `WRITE_EXIT=0`。

---

## 6. 边界自证

`git status --porcelain`（现取）**只**含以下路径 ⇒ 未碰 `backend-ts/**`（含 `src/**`、`package.json`）、未碰 `migrations/**`、未碰任何 spec、未碰 `docs/seafood.master-plan.md`、未碰 `.env.local`、未改既有 audit/qa 件、未改主题 token 值；未做 `git add/commit/push`、未 `npm install`、未 `npx playwright install`、未起常驻 server、未用 `pkill`/`killall`、未用 `execute_code`：

```
 M frontend/src/auth.js
 M frontend/src/components/auth/WalletAuthPanel.jsx
 M frontend/src/locales/{en,hk,vn,zh}.json
 M frontend/src/pages/market/MarketPage.jsx
 M frontend/src/pages/market/market-api.js
 M frontend/src/test/unit/auth.test.js
 M frontend/src/test/unit/listing-market.test.jsx
?? backend-ts/.p4-artifacts/b4ciic-20260930T2339+0800/
?? frontend/scripts/p4z-b4ciic-{geometry,locales,retarget}.mjs
```

（`backend-ts/.p4-artifacts/.a1ld-run`、`.lastrun` 为**前序运行遗留**的未跟踪文件，非本单产出。）

## 7. 遗留 / 未测（不许当已测）
- **HTTP 展示面 = `NOT_MEASURED`**：本单未发真实 HTTP（无 server 起停，红线），两条文案的**端到端展示**（浏览器里 toast 的中文串）未取读数，只取证到「`fetchApiJson` 抛出的 `error.message` 已是四语」这一层。
- **登录面板几何 = `NOT_MEASURED`**（§4.3）；`/login` 落点被重定向到 `/` 的原因未定论（疑 `App.jsx:246` `/` 兜底路由）。
- 后台 `ShardsManagement.jsx:60` 的 orderbook 取数未做退化币对收敛（越界，见 §2.2 边界注）。
