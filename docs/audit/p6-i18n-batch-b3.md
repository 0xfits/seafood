# P6-I18N-LIT-B3 · 登录 / 认证 / 钱包面四语化 + 工坊三线核验 + D3/D7 收口

_Unit I18N-LIT-B3（Kong, 写单）。基线 = `ccb5f10`（B2 入库后：`top=86 / flat=307`、键集逐文件相等、单测 136 passed）。_

## §0 报数口径（§5.7 ②）

- **命中/条数**：静态扫描「剥注释后残留 CJK（表意文字 U+4E00–9FFF / U+3400–4DBF / U+F900–FAFF）」的**代码行**与**字面量串**两个口径分别给出，不混用。
- **键数**：顶层键 `top` / 拍平键路径 `flat`（逐文件）。
- **渲染断言**：走真实 i18n 单例 + `i18n.changeLanguage('en')`（不 mock `react-i18next`），jsdom 渲染 —— 与真浏览器渲染**不等价**（见 §7）。
- **退出码**：取命令本身（`cmd > file; echo RC=$?`），**不取自管道之后**。

## §1 变更清单（写集封闭性）

| # | 文件 | 动作 | 说明 |
|---|---|---|---|
| 1 | `frontend/src/components/LoginModal.jsx` | 改 | 5 条字面量 → `loginModal.*`（新增 `useTranslation`） |
| 2 | `frontend/src/pages/AuthPage.jsx` | 改 | 23 条 → `authPage.*` / `walletAuth.stateConnected` |
| 3 | `frontend/src/components/auth/WalletAuthPanel.jsx` | 改 | 24 条 → `walletAuth.*`（模块级 `COPY` 改存**键**，渲染处 `t()`） |
| 4 | `frontend/src/auth.js` | 改 | 3 条 → `auth.err.REQUEST_FAILED` / `auth.err.NO_CREDENTIAL`（走既有 `resolveI18nMessage` 动态导入通道） |
| 5 | `frontend/src/locales/{zh,en,hk,vn}.json` | 改 | 四文件同步 +55 键（逐文件相等） |
| 6 | `frontend/src/pages/HomePage.jsx` | 改 | **D3 改指点**（1 处 `t('CanClaim')` → `t('common.redeemable')`） |
| 7 | `frontend/src/pages/RewardPage.jsx` | 改 | **D3 改指点**（3 处同上） |
| 8 | `frontend/src/test/unit/i18n-batch-b2.test.jsx` | 改 | D3 连带：1 行断言 `'Claim Now (1)'` → `'Redeemable (1)'`（tab 标签改指后盘面变化） |
| 9 | `frontend/src/test/unit/i18n-batch-b3.test.jsx` | 新增 | 6 用例（en 档渲染 3 + D3 2 + 键集 1） |
| 10 | `frontend/scripts/p4z-i18nb3-cjk.mjs` | 新增 | 类级 CJK 断言（写集 + 三目录核验） |
| 11 | `frontend/scripts/p6-tr2-i18n-locales.mjs` | 改 | **D7**：陈旧 LEGACY 项更正 |

`git status` 复核：改动仅在上述 11 项内（`frontend/dist/**` 为 AC ① 的构建产物，已被 `.gitignore:218` 忽略）。未执行 `git add/commit/push`、未 `npm install`、未启停服务、未触碰 `pages/{jobs,listings,market}/**`、`TranslatingBadge.jsx`、`i18n-content.js`、`backend-ts/**`、`migrations/**`、`vercel.json`、spec、`.env*`、既有 audit 件。


## §2 逐条处理（B3 = 55 条，全数落键）

| 文件 | recon 条数 | 本单实测（行 / 串） | 处理 | 命名空间 |
|---|---|---|---|---|
| `components/LoginModal.jsx` | 5 | 5 行 / 5 串 | 5/5 已改 | `loginModal.*`（5 键） |
| `pages/AuthPage.jsx` | 23 | 21 行 / 23 串 | 23/23 已改 | `authPage.*`（23 键） |
| `components/auth/WalletAuthPanel.jsx` | 24 | 20 行 / 24 串 | 24/24 已改 | `walletAuth.*`（24 键） |
| `src/auth.js` | 3 | 3 行 / 3 串 | 3/3 已改 | `auth.err.REQUEST_FAILED` / `auth.err.NO_CREDENTIAL`（2 键，`未找到登录凭证` 复用同一键） |
| **合计** | **55** | **49 行 / 55 串** | **55/55** | **55 键** |

**命名空间铁律遵守**：`login`/`register`/`auth` 等**顶层字符串/对象键**已存在，故新命名空间一律取不冲突名（`loginModal` / `authPage` / `walletAuth`），`auth.err.*` 为既有对象下扩键。

`auth.js` 三处就地改法（不新开通道）：
- `请求失败 (${status})`：`extractApiErrorMessage` 改为在**无任何服务端文案**时返回 `undefined`（签名 `(payload, status)` → `(payload)`，模块私有、调用点唯一），由 `apiErrorMessage` 走 `FALLBACK_I18N_KEYS.REQUEST_FAILED` + `{{status}}` 插值；i18n 不可用时回落 ASCII `Request failed (status)`。
- `未找到登录凭证`（×2）：新增私有 `noCredentialError()`，走 `resolveI18nMessage('auth.err.NO_CREDENTIAL', 'No login credential found')`。
- 原有优先级（`error.i18n_key` > 服务端原文映射 > 兜底）与 `details.reason` 拼接**未改**，B14 两条映射键**未动**。


## §3 D3 / D7 收口

### D3（Zang 裁定）· `common.redeemable` 独立键

- 新键四语：`zh=可兑换` / `en=Redeemable` / `hk=可兌換` / `vn=Có thể đổi`（四语互异 `${'{'}4{'}'}/4`）。
- **`CanClaim` 取值一字未动**：`zh=可兑换` / `en=Claim Now` / `hk=立即領取` / `vn=Nhận ngay`（既有 B1/B2 面不受影响）。
- 改指 4 处：`HomePage.jsx:86`（卡片 statusText）、`RewardPage.jsx:85`（卡片 statusText）、`:285`（详情状态）、`:312`（「可兑换 (n)」Tab）。
- 实测读数：源码内 `t('CanClaim')` 调用点 = **0**；`t('common.redeemable')` 调用点 = **4**（`i18n-batch-b3.test.jsx` 断言）。
- **连带影响（如实登记）**：RewardPage 的 available Tab 在 en 档由 `Claim Now (1)` 变为 `Redeemable (1)` ⇒ B2 已验收测试 `i18n-batch-b2.test.jsx:104` 的**1 行断言**随之更正（键集/条数不变，136 → 142 全绿，见 §5 ②）。
- zh 档 `common.redeemable` 与 `CanClaim` **同字面**（均为 `可兑换`）—— 源语言同值属 D3 规定；差异化落在 en/hk/vn 三档（测试按此断言）。

### D7 · `p6-tr2-i18n-locales.mjs` 陈旧 LEGACY 项

口径更正为「按盘面读数」，非「按单据描述」：

| 项 | 旧（陈旧） | 新（实测一致） |
|---|---|---|
| `LEGACY` 名单 | `['pages/HomePage.jsx','pages/TaskPage.jsx','pages/RewardPage.jsx']` | `['pages/HomePage.jsx']` |
| 段标题 | 「三页仍用三目链 + `??`」 | 「仍在旧三目链 + `??` 上的页面（B2 收口后仅余首页）」 |
| 文件头口径 ④ | 「既有三页为存量登记」 | 「存量登记 = 仅 `pages/HomePage.jsx`（B2 已把 TaskPage/RewardPage 单点收口到 `pickLocalized`）」 |

依据：`TaskPage.jsx` / `RewardPage.jsx` 的 `_en\s*\?\?` 命中在 B2 后已为 **0**（`i18n-content-wiring.test.jsx` / `i18n-batch-b2.test.jsx` 已登记收口）；`HomePage.jsx` 实测 `??命中=12`（B1 面，本单只核不改）。脚本总判仍为 `PASS`（见 §5 ③）。`i18n.translating`、6 个 UGC 接线文件的守卫断言**未改**。


## §4 类级核验：工坊 / 商品 / 交易所三目录（实测复核 recon 的 0）

脚本 = `frontend/scripts/p4z-i18nb3-cjk.mjs`（与 `p4z-i18nb2-cjk.mjs` 同形：字符级状态机剥注释 → 残留 CJK 判命中，注释行单列）。

| 目录 | 文件数（`.js`/`.jsx`/`.css`，排除 `__tests__`） | 用户可见面 CJK 字面量 | 注释保留中文行 |
|---|---|---|---|
| `pages/jobs` | 5（3 页 + `job-api.js` + `jobs.css`） | **0** | 89 |
| `pages/listings` | 5（3 页 + `listing-api.js` + `listings.css`） | **0** | 90 |
| `pages/market` | 3（`MarketPage.jsx` + `market-api.js` + `market.css`） | **0** | 79 |
| **合计** | **13** | **0** | **258** |

**结论：与 recon 判 0 一致，三目录**无需修改**（本单对三目录**零写入**，`git status` 可验）。注释内中文（258 行）按 recon §5.7 口径**不算命中**、逐条登记在脚本输出中。


## §5 AC 读数（五项，自跑；退出码取命令本身）

**① `npm run build`** ⇒ `BUILD_RC=0`
```
✓ built in 1.41s        dist/assets/index-WdrIkEMH.js  506.76 kB │ gzip: 150.19 kB
```
（仅有既存的 >500 kB chunk 体积 warning，非 error。）

**② `npm run test:unit`** ⇒ `TEST_RC=0`
```
 Test Files  16 passed (16)
      Tests  142 passed (142)
```
基线 136 passed ⇒ **142 passed（+6，零回归）**。新增用例（`src/test/unit/i18n-batch-b3.test.jsx`）：
1. AuthPage（`/en/login`）主标题/副标题/钱包面板/说明/侧栏链接**全英文**，并反证 zh 原文不出现；
2. AuthPage（`/en/register`，已登录未补全资料）补全资料卡英文；
3. LoginModal（en 档）`aria-label`/标题/描述/注册引导英文；
4. **D3**：`common.redeemable` 四语齐备且取值互异，en/hk/vn 三档与 `CanClaim` 不同值，且 **`CanClaim` 四语取值被断言钉死为原值**；
5. **D3**：源码 `t('CanClaim')` 调用点 = 0 / `t('common.redeemable')` ≥ 4；
6. 新增 **55** 键四语齐备（非空串）+ 四文件拍平键集逐文件相等。

**③ `node scripts/p6-tr2-i18n-locales.mjs`** ⇒ `TR2_RC=0`、`[TR-2] 总判：PASS`
```
zh: top=89 flat=362 / en: top=89 flat=362 / hk: top=89 flat=362 / vn: top=89 flat=362
键集相等：PASS（取值集合 = {362}）
新接文件守卫=PASS（6 文件 ??命中=0、均经 i18n-content）
存量登记（只核不改）：pages/HomePage.jsx: ??命中=12   ← 旧「三页」口径已更正（D7）
```
键数：`top 86 → 89`（+`loginModal`/`authPage`/`walletAuth` 三个新命名空间）、`flat 307 → 362`（+55 键）⇒ 四文件读数一致。

**④ 类级 CJK 断言** ⇒ `CJK_RC=0`、`[B3-CJK] 总判：PASS`
```
① 写集 6 文件（LoginModal / AuthPage / WalletAuthPanel / auth.js / HomePage / RewardPage）
   用户可见面 CJK 字面量命中 = 0（断言 == 0）；注释内保留中文行 = 45（登记，不计命中）
   LoginModal=0 ; AuthPage=0 ; WalletAuthPanel=0（注释 L10）; auth.js=0（注释 26 行）
   ; HomePage=0 ; RewardPage=0（注释 18 行）
② 三目录合计：文件数=13 字面量命中=0（断言 == 0）；注释保留中文行=258（登记）
```
注释行逐条（口径 = 文件内行号，均**不计命中**）：
`WalletAuthPanel.jsx` L10 · `auth.js` L101–106,113–117,124,130–134,150,154,155,166,172–175,224 · `RewardPage.jsx` L23,49–51,70,71,77,131–134,161–166,202 · `jobs/*` 89 行 · `listings/*` 90 行 · `market/*` 79 行（逐文件行号见脚本输出全文）。

**⑤ 条数对账** ⇒ 见 §6。


## §6 条数对账（三列）

### 6.1 已处理（55/55）

按文件：`LoginModal` 5 · `AuthPage` 23 · `WalletAuthPanel` 24 · `auth.js` 3 = **55**；新增键 **55** 个（5+23+24+2+1，其中 `auth.js` 3 条串 → 2 键，`未找到登录凭证` 两处复用 `auth.err.NO_CREDENTIAL`）。改指（D3）4 处**不新增键**（复用新增的 `common.redeemable`）。

### 6.2 判定不改（含理由）

| 项 | recon 口径 | 本单判定 | 理由 |
|---|---|---|---|
| `pages/jobs|listings|market/**`（13 文件） | 0 条 | **不改** | 类级实测复核 = 0（§4），本单对三目录零写入 |
| `CanClaim` 键的 en/hk/vn 取值 | 在用 | **不改** | D3 明令「不得改 `CanClaim` 的取值」；它可能确实服务「立即领取」，且改动会动 B1 已验收面 |
| `rewardPage.emptyAvailable` = `暂无可兑换奖励` 等**含「可兑换」字样的整句** | — | **不改** | D3 的射程是「原样输出 `可兑换` 的**标签位**」；整句是另一语义单元，改指会丢「暂无」语义 |
| `rewardCard.claimNow` = `立即领取` | — | **不改** | 与 `CanClaim` 的 en 值同形但属卡片动作位，非本单射程 |
| zh 档 `common.redeemable` 与 `CanClaim` 同字面 | — | **不改（预期）** | 源语言同值；D3 规定的差异化落在 en/hk/vn |

### 6.3 漏检补充（脚本/人工复核新增，不计入 recon 的 55）

| # | 项 | 来源 | 处理 |
|---|---|---|---|
| 1 | `AuthPage.jsx:128` 行内**第二个** CJK 片段「已连接钱包：」（recon 只登记同行的 `未知地址`） | 本单行/串双口径扫描 | 一并收口 → `walletAuth.stateConnected`（复用新键，不额外造键） |
| 2 | `HomePage.jsx:86` / `RewardPage.jsx:85,285,312` 的 `可兑换` 语义错配（键存在、值不对） | Zang 裁定 D3 | 改指 `common.redeemable` |
| 3 | `i18n-batch-b2.test.jsx:104` 断言 `'Claim Now (1)'` | 第 2 项的连带 | 更正为 `'Redeemable (1)'`（1 行） |
| 4 | `p6-tr2-i18n-locales.mjs` LEGACY 陈旧项（3 页 → 1 页） | Zang 裁定 D7 | 已更正（§3） |

**行/串口径差登记**：`AuthPage` 23 串落在 21 行、`WalletAuthPanel` 24 串落在 20 行（同行多串），与 recon 的**条数**口径一致、与脚本的**行数**口径不同 —— 两者不混用（§0）。


## §7 NOT_MEASURED（未测项 —— 本次确实没测，不以 0/空代替）

- **真浏览器渲染未测**：本单是「静态扫描 + jsdom 渲染断言」，**未**在真浏览器里逐条切换 zh/en/hk/vn 复核这 55 条的落屏效果；「切语言后不再显示简体」在真浏览器上无本单证据（安全红线亦禁止在站上发起登录，登录墙后的面**无法**在站上真跑）。
- **钱包链路未测**：`eth_requestAccounts` / `personal_sign` / 钱包扩展不存在的真实分支、`toast` 落屏文案**未在真环境触发**；本单只断言了**文案取值**与**未装钱包分支**的渲染。
- **hk/vn 译文质量未评测**：55×2 条为**初稿**，未做母语者审校 / 术语表校验 / 回译核验。
- **`auth.js` 的 i18n 不可用回落路径未测**：`No login credential found` / `Request failed (status)` 两条 ASCII 兜底只有代码路径，单测覆盖的是 i18n **可用**路径（zh 档）。
- **生产环境读数未测**：只测本地 `npm run build`（RC=0）与本地单测；**未**部署、未对 prod 读键数、未验 CDN 产物。
- **三目录运行时未测**：`pages/{jobs,listings,market}/**` 的 0 命中是**静态扫描**读数，其运行时渲染（含后端返回文案）本单未实测；`__tests__` 目录被排除在扫范围外。
- **`src/` 其余批次面未测**：B4（后台管理 333 条）/ B5（组件库 + 预览页 88 条）不在本单射程，**未测未改**。
- **JSON 重排的 diff 面未人工逐行复核**：四语 locale 由脚本整体重排（`indent=2`），键集/取值经断言相等，但**未逐行人工比对**格式差异。


## §8 自曝（本次取证的局限与可能的错判）

1. **语言档判定靠 `i18n.changeLanguage('en')`**，不是真浏览器 URL 前缀：本批 4 个代码文件均**只读 `i18n.t`**（不读 URL 语言码），故该差异在本单射程内**不构成**误判风险；但若将来这些面引入 URL 语言码，测试口径需同步。
2. **`extractApiErrorMessage` 签名变更**（`(payload, status)` → `(payload)`）：模块私有、调用点唯一（`apiErrorMessage`），已复核；若仓内另有同名复用点（本单全仓 grep 未命中），则属**漏检**。
3. **D3 的射程是我按「渲染出 `可兑换` 三个字的标签位」界定的**：4 处调用点全改；`rewardPage.emptyAvailable`、`profilePage.redeemedRewards`（`已兑换奖励`）等**含该词但语义不同**的键判定不改 —— 这是**判断**，可被产品推翻。
4. **连带改了 B2 的 1 行验收断言**（tab 文案 `Claim Now (1)` → `Redeemable (1)`）：这是 D3 改指的**必然结果**（zh 档 tab 文字不变，en 档跟随新键），非测试放水；若验收方要求 B2 测试零改动，则 D3 在 `RewardPage:312` 这一点上需改判。
5. **三目录「0」是启发式扫描读数**，非 AST：多行 JSX 文本、模板串内插值拆分等仍可能漏检（与 recon §7 同源局限）；不过本次三目录命中为 **0**，漏检**只会让真值非 0**，故「0」是**乐观侧**读数，保守解读应为「未发现 ≥ 0 条」。
6. **注释内中文被排除**（口径与 B1/B2 一致）：`auth.js` 26 行、`RewardPage` 18 行等注释中文**保留**（技术说明需中文），若审方要求注释也四语化，需另立单。
7. **报告内所有读数均来自本机本次运行**（`npm run build` / `npm run test:unit` / 两个 `.mjs`），**未经第二人复核**；`docs/audit/p6-i18n-batch-b3.md` 本身是本单**自证**材料，非独立裁定。

