# P6 · I18N-LIT-B1 — 首屏 · 全局骨架硬编码文案四语化（批 B1）

> 单元：Unit I18N-LIT-B1（Kong，实现单）。**真源**：`docs/audit/p6-i18n-literal-recon.md` 表④ B1（44 条）。
> 口径：本单所有条数取自该报告 recon 口径（`run_tag=20261001T113240Z-bb0e4ed`）；**行号 = 表①-1 改前行号**。
> 硬边界遵守：只写 `frontend/src/**`(B1 范围) / `frontend/src/locales/*.json` / `frontend/src/test/unit/**` / `frontend/scripts/p4z-i18nb1-cjk.mjs` / 本文件；未动 `backend-ts/**`、`migrations/**`、`vercel.json`、spec、master-plan、`.env*`、`src/pages/{jobs,listings,market}/**`、既有 audit 件；未 `git add/commit/push`、未 `npm install`、未启停服务、未 `vercel`、未 `pkill/killall`。

## §1 写集（= 报告 B1 的 8 个文件）

| 文件 | recon 条数 | 本批改动 |
|---|---|---|
| `frontend/src/components/Header.jsx` | 7 | 7 条（2 复用键 + 1 新键 + 4 复用键） |
| `frontend/src/pages/HomePage.jsx` | 28 | 28 条（28 字面量 → 19 新键 + `common.*` 复用） |
| `frontend/src/components/Footer.jsx` | 8 | 8 条（2 新键 + 4 新键品牌同值 + 2 条拆分为 1 新键 + 字面量邮箱） |
| `frontend/src/App.jsx` | 1 | 1 条（1 新键） |
| `frontend/src/shell/AppShell.jsx` | 0 | 未改（0 条，仅注释） |
| `frontend/src/shell/BottomTabBar.jsx` | 0 | 未改（0 条，仅注释） |
| `frontend/src/shell/nav.js` | 0 | 未改（0 条，仅注释） |
| `frontend/src/shell/breakpoints.js` | 0 | 未改（0 条，仅注释） |

**未触碰**（硬边界）：`src/pages/jobs/**`、`src/pages/listings/**`、`src/pages/market/**` 以及 B2/B3/B4/B5 的页面文件；`HomePage.jsx` 里 12 处 `_en/_hk/_vn ?? ` 三目链（UGC 内容本地化，既有机制）**原样保留**。

## §2 条数对账（44 = 4 (a) + 30 (b) + 10 (c) ⇒ 实际处理 44 条）

三列：**已处理 / 判定不需改（含理由）/ 漏检补充**。

### 2.1 已处理（44 条，逐条）

| # | 位置（recon 行号） | 原文 | recon 类 | 处置 | 键 |
|---|---|---|---|---|---|
| 1 | Header L119 | `碎片市场` | (a) | 去 `\|\|` 兜底，走键 | `shard`（复用） |
| 2 | Header L121 | `管理面板` | (a) | 去 `\|\|` 兜底，走键 | `admin_panel`（复用） |
| 3 | Header L196 | `中文`(alt) | (c) | 复用既有键（报告 ②-c 明列备选） | `chinese`（复用） |
| 4 | Header L210 | `粵語`(alt) | (c) | 同上 | `cantonese`（复用） |
| 5 | Header L248 | `社区积分` | (b) | JSX 文本 → 键 | `common.communityPoints`（新） |
| 6 | Header L367 | `中文`(alt) | (c) | 同 #3 | `chinese`（复用） |
| 7 | Header L387 | `粵語`(alt) | (c) | 同 #4 | `cantonese`（复用） |
| 8 | HomePage L55 | `进行中` | (b) | 映射字符串 → 键 | `common.ongoing`（新） |
| 9 | HomePage L55 | `已结束` | (b) | 同上 | `common.ended`（新） |
| 10 | HomePage L58 | `立即参与` | (b) | 同上 | `common.joinNow`（新） |
| 11 | HomePage L84 | `已兑换` | (b) | 同上 | `common.redeemed`（新） |
| 12 | HomePage L84 | `可兑换` | (a) | 走既有键 | `CanClaim`（复用） |
| 13 | HomePage L84 | `库存不足` | (b) | 映射字符串 → 键 | `common.outOfStock`（新） |
| 14 | HomePage L159 | `加载首页失败: ${error.message}` | (b) | 插值拆键 | `homePage.loadFailed`（新，`{ message }`） |
| 15 | HomePage L180 | `请先登录` | (a) | 走既有键 | `pleaseLogin`（复用） |
| 16 | HomePage L186 | `这个奖励你已经兑换过了` | (b) | toast → 键 | `homePage.rewardAlreadyClaimed`（新） |
| 17 | HomePage L191 | `当前奖励库存不足` | (b) | 同上 | `homePage.rewardOutOfStock`（新） |
| 18 | HomePage L196 | `积分不足` | (b) | 同上 | `homePage.notEnoughPoints`（新） |
| 19 | HomePage L200 | `奖品兑换入口即将上线，请先前往奖励中心查看详情` | (b) | 同上 | `homePage.redeemComingSoon`（新） |
| 20 | HomePage L208 | `正在加载精彩内容...` | (b) | JSX 文本 → 键 | `homePage.loading`（新） |
| 21 | HomePage L219 | `欢迎来到 Jinli Club` | (b) | 同上 | `homePage.welcome`（新） |
| 22 | HomePage L220 | `参与任务，赚取` | (b) | 同上（DashJ 前置片段） | `homePage.heroLead`（新） |
| 23 | HomePage L221 | `，兑换精彩奖励` | (b) | 同上（DashJ 后置片段） | `homePage.heroTail`（新） |
| 24 | HomePage L226 | `继续任务` | (b) | 三目 → 键 | `homePage.continueTask`（新） |
| 25 | HomePage L226 | `立即注册` | (b) | 同上 | `homePage.registerNow`（新） |
| 26 | HomePage L230 | `查看奖励` | (b) | 按钮文本 → 键 | `homePage.browseRewards`（新） |
| 27 | HomePage L240 | `热门任务` | (b) | 同上 | `homePage.hotTasks`（新） |
| 28 | HomePage L241 | `参与任务赚取` | (b) | 同上（DashJ 前置片段） | `homePage.hotTasksLead`（新） |
| 29 | HomePage L244 | `查看全部` | (b) | 同上 | `common.viewAll`（新） |
| 30 | HomePage L261 | `暂无可用任务` | (b) | 空态文本 → 键 | `homePage.noTasks`（新） |
| 31 | HomePage L272 | `精选奖励` | (b) | 同上 | `homePage.featuredRewards`（新） |
| 32 | HomePage L273 | `用` | (b) | 同上（DashJ 前置片段） | `homePage.featuredLead`（新） |
| 33 | HomePage L273 | `兑换精彩礼品` | (b) | 同上（DashJ 后置片段） | `homePage.featuredTail`（新） |
| 34 | HomePage L276 | `查看全部` | (b) | 同上 | `common.viewAll`（新） |
| 35 | HomePage L298 | `暂无可用奖励` | (b) | 空态文本 → 键 | `homePage.noRewards`（新） |
| 36 | Footer L8 | `猫猫大使团｜不止一份报酬，更加一份经验。` | (c) | 品牌不译 ⇒ 迁键、**四语同值** | `footer.catSlogan1`（新） |
| 37 | Footer L9 | `猫猫大使团｜你的声音，值得被品牌听见。` | (c) | 同上 | `footer.catSlogan2`（新） |
| 38 | Footer L10 | `你的代言，从猫猫大使团开始。` | (c) | 同上 | `footer.catSlogan3`（新） |
| 39 | Footer L31 | `云朵计划｜播种童年梦想，浇灌美和希望。` | (c) | 同上 | `footer.cloudSlogan`（新） |
| 40 | Footer L101 | `本网站支持简体中文、英文、粤语和越南语。` | (b) | 四分支三目 → 单键（同键含 L102/L104 的 en/vn 非 CJK 分支） | `footer.websiteLanguages`（新） |
| 41 | Footer L103 | `本網站支持簡體中文、英文、粵語和越南語。` | (b) | 同上 | `footer.websiteLanguages`（新） |
| 42 | Footer L111 | `联系我们：contact@jinli.club` | (c) | 拆分：标签走键 + 邮箱本体留字面量 | `footer.contact`（新，`{ email }` 插值） |
| 43 | Footer L113 | `聯繫我們：contact@jinli.club` | (c) | 同上 | `footer.contact`（新） |
| 44 | App L182 | `正在验证权限...` | (b) | `ProtectedRoute` 加载态 → 键 | `common.verifyingPermission`（新） |

### 2.2 判定不需改（0 条）— 理由必须交代

**0 条**。报告 ②-c 的 10 条本意是「不译 / 保留原文」，**语义上仍不译**（值一律不变或语言不变式），但本单的类级硬要求是「**本批写集内用户可见面 CJK 字面量 ⇒ 0 命中**」——这 10 条里除邮箱本体（非 CJK）外全部是**用户可见** CJK，留在代码里就会命中。故全部做了「出代码、值不变」的处理（见 #3–#7、#36–#39、#42–#43），**不落入"不需改"**（详见 §5 偏差 D3）。

### 2.3 漏检补充（0 条）

B1 8 文件全量扫描（`scripts/p4z-i18nb1-cjk.mjs`）后**无新增 CJK 字面量**：报告列 44 条与本批实际改动落点**逐条对齐**（Header 7 / HomePage 28 / Footer 8 / App 1 = 44，无多、无少）。非 CJK 的品牌/单位符号（`Jinli Club`、`DashJ`、`contact@jinli.club`、`CAT`、`CloudPlan`、URL）按 recon 口径不国际化，未动。

## §3 键表

**新增 33 键 × 4 语 = 132 条值**（全部四语齐备；`common.*` 8 + `homePage.*` 19 + `footer.*` 6）。复用键 5 个（`shard` / `admin_panel` / `CanClaim` / `pleaseLogin` / `chinese` / `cantonese`，其中 alt 两个为 4 条落点）。

命名沿用报告规则 `<域>.<页>.<元素>` 与表③-1 初稿措辞（zh 值逐字取自 recon 原文；hk 按 recon 的 s2t 风格；en/vn 为翻译产出）。**命名空间相对草案有调整**（草案 `home.*`/`task.*`/`reward.*`/`page.*` 与既有顶层字符串键冲突）——见 §5 偏差 D2。

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `common.viewAll` | 查看全部 | 查看全部 | View all | Xem tất cả |
| `common.communityPoints` | 社区积分 | 社群積分 | Community points | Điểm cộng đồng |
| `common.verifyingPermission` | 正在验证权限... | 正在驗證權限... | Verifying permissions... | Đang xác minh quyền... |
| `common.ongoing` | 进行中 | 進行中 | Ongoing | Đang diễn ra |
| `common.ended` | 已结束 | 已結束 | Ended | Đã kết thúc |
| `common.joinNow` | 立即参与 | 即刻參加 | Join now | Tham gia ngay |
| `common.redeemed` | 已兑换 | 已兌換 | Redeemed | Đã đổi |
| `common.outOfStock` | 库存不足 | 庫存不足 | Out of stock | Hết hàng |
| `homePage.welcome` | 欢迎来到 Jinli Club | 歡迎嚟到 Jinli Club | Welcome to Jinli Club | Chào mừng đến Jinli Club |
| `homePage.loading` | 正在加载精彩内容... | 載入緊精彩內容... | Loading highlights... | Đang tải nội dung... |
| `homePage.hotTasks` | 热门任务 | 熱門任務 | Hot tasks | Nhiệm vụ nổi bật |
| `homePage.hotTasksLead` | 参与任务赚取 | 參與任務賺取 | Complete tasks to earn | Tham gia nhiệm vụ để kiếm |
| `homePage.featuredRewards` | 精选奖励 | 精選獎勵 | Featured rewards | Phần thưởng nổi bật |
| `homePage.featuredLead` | 用 | 用 | Redeem | Dùng |
| `homePage.featuredTail` | 兑换精彩礼品 | 兌換精彩禮品 | for great gifts | để đổi quà hấp dẫn |
| `homePage.heroLead` | 参与任务，赚取 | 參與任務，賺取 | Complete tasks, earn | Tham gia nhiệm vụ, kiếm |
| `homePage.heroTail` | ，兑换精彩奖励 | ，兌換精彩獎勵 | and redeem great rewards | và đổi phần thưởng hấp dẫn |
| `homePage.noTasks` | 暂无可用任务 | 暫無可參加任務 | No tasks available | Chưa có nhiệm vụ |
| `homePage.noRewards` | 暂无可用奖励 | 暫無可兌換獎勵 | No rewards available | Chưa có phần thưởng |
| `homePage.browseRewards` | 查看奖励 | 查看獎勵 | Browse rewards | Xem phần thưởng |
| `homePage.continueTask` | 继续任务 | 繼續任務 | Continue tasks | Tiếp tục nhiệm vụ |
| `homePage.registerNow` | 立即注册 | 即刻註冊 | Sign up now | Đăng ký ngay |
| `homePage.rewardAlreadyClaimed` | 这个奖励你已经兑换过了 | 呢個獎勵你已經兌換過喇 | You have already redeemed this reward | Bạn đã đổi phần thưởng này rồi |
| `homePage.rewardOutOfStock` | 当前奖励库存不足 | 當前獎勵庫存不足 | This reward is out of stock | Phần thưởng này đã hết hàng |
| `homePage.notEnoughPoints` | 积分不足 | 積分不足 | Not enough points | Không đủ điểm |
| `homePage.redeemComingSoon` | 奖品兑换入口即将上线，请先前往奖励中心查看详情 | 獎品兌換入口即將上線，請先前往獎勵中心睇詳情 | The redemption portal is coming soon; check the Reward Center for details | Cổng đổi thưởng sắp ra mắt, vui lòng xem Trung tâm phần thưởng để biết chi tiết |
| `homePage.loadFailed` | 加载首页失败: {{message}} | 載入首頁失敗: {{message}} | Failed to load the home page: {{message}} | Tải trang chủ thất bại: {{message}} |
| `footer.websiteLanguages` | 本网站支持简体中文、英文、粤语和越南语。 | 本網站支持簡體中文、英文、粵語和越南語。 | This website supports Simplified Chinese, English, Cantonese and Vietnamese. | Trang web này hỗ trợ tiếng Trung giản thế, tiếng Anh, tiếng Quảng Đông và tiếng Việt. |
| `footer.contact` | 联系我们：{{email}} | 聯繫我們：{{email}} | Contact us: {{email}} | Liên hệ với chúng tôi: {{email}} |
| `footer.catSlogan1` | 猫猫大使团｜不止一份报酬，更加一份经验。 | （四语同值） | （四语同值） | （四语同值） |
| `footer.catSlogan2` | 猫猫大使团｜你的声音，值得被品牌听见。 | （四语同值） | （四语同值） | （四语同值） |
| `footer.catSlogan3` | 你的代言，从猫猫大使团开始。 | （四语同值） | （四语同值） | （四语同值） |
| `footer.cloudSlogan` | 云朵计划｜播种童年梦想，浇灌美和希望。 | （四语同值） | （四语同值） | （四语同值） |

**插值**：全部走 `t('key', { name })`（`homePage.loadFailed`→`{ message }`、`footer.contact`→`{ email }`），无字符串拼接、无新依赖（`react-i18next` 既有依赖）。

## §4 AC 读数（全部本机自跑，退出码未取自管道之后）

| AC | 命令 | 读数 | 判定 |
|---|---|---|---|
| ① build | `npm run build`（日志 `~/.hermes/profiles/zang/cache/scratch/b1-build.log`） | `BUILD_EXIT=0` | **PASS** |
| ② 单测 | `npm run test:unit`（日志 `…/b1-test.log`） | `Test Files 14 passed (14)` / `Tests 129 passed (129)`（基线 126/13 ⇒ **+3，未掉**） | **PASS** |
| ③ 四语键集 | `node scripts/p6-tr2-i18n-locales.mjs` | `键集相等：PASS`（zh/en/hk/vn 各 `top=79 flat=211`）、`i18n.translating` 四语齐备 PASS、新接文件守卫 PASS、**总判 PASS**（`TR2_EXIT=0`） | **PASS** |
| ④ 类级 CJK | `node scripts/p4z-i18nb1-cjk.mjs`（本单新增） | B1 8 文件**用户可见面 CJK 字面量命中 = 0**；注释内保留中文 = 89 行（逐行列出见 §6）；`CJK_EXIT=0` | **PASS** |

**新增用例**（`frontend/src/test/unit/i18n-batch-b1.test.jsx`，3 条，走**真实** i18n 实例、不 mock `react-i18next`）：
1. `HomePage 首屏骨架（标题/小标题/按钮/空态）在 en 档渲染英文` —— 断言 `Welcome to Jinli Club` / `Hot tasks` / `Featured rewards` / `View all`×2 / `Browse rewards` / `No tasks available` / `No rewards available`；
2. `Footer 支持语言/联系文案在 en 档渲染英文，且邮箱保持字面量` —— 断言 `This website supports…` 与 `Contact us: contact@jinli.club`；
3. `四语 locale 文件拍平键集逐文件相等` —— `zh/hk/en/vn` 键集逐一对拍 + 本批新增键齐备。

既有 `src/test/unit/home-page.test.jsx` 因 HomePage 新接 `useTranslation` 需真实 i18n 实例，补 1 行副作用 import `../../i18n`（jsdom 无前缀路径 ⇒ zh 兜底，既有 2 条断言语义不变）；其余 12 个测试文件未改。

## §5 偏差登记（相对 recon；盘面为准）

| # | 偏差 | 说明 |
|---|---|---|
| **D1** | 键数口径 | recon §0 记「flat 177」；**盘面改前实测 = 178**（改后 211 = 178 + 33 新键，四文件逐文件相等）。计数口径与 recon 相同（拍平键路径），算术可复现。四语相等不变量未变。 |
| **D2** | **键命名空间** | 草案表③-1 的 `home.*` / `task.*` / `reward.*` / `page.*` **与既有顶层字符串键冲突**（`home`=`首页`、`task`=`社区任务`、`reward`=`社区奖励`、`page`=`页` 已是字符串值），i18next 下 `home.welcome` 这类路径**无法解析**（launch 仍是原串）。故改用未占用命名空间：首页专属 `homePage.*`、跨页共享词条 `common.*`（草案 `task.ongoing`/`task.ended`/`task.joinNow`/`reward.redeemed`/`reward.outOfStock`/`common.viewAll` 的取值逐字保留，只换前缀）、页脚 `footer.*`。**这是草案的潜在缺陷，非本单改坏**。 |
| **D3** | (c) 10 条的处置 | 报告判 (c)「不译」；本单为满足「写集内用户可见面 CJK ⇒ 0」把其中用户可见 CJK 全部移出代码，**语义仍是"不译"**：Header 4 条 alt 复用既有键（报告 ②-c 明列的备选，等于转入 (a) 类）；Footer 品牌 4 条新增键**四语同值**（语言不变式）；Footer 联系行 2 条按报告要求**拆分**（标签走键、邮箱本体留字面量）。故 §2.2「不需改」= 0 条。 |
| **D4** | `cantonese` 既有值不一致 | `cantonese` 在 `zh`/`en` = `粤语`、`hk`/`vn` = `粵語`（既有盘面）。`alt={t('cantonese')}` 读数因此随档位不同。属既有数据，本批未修正（改文案会动到 Header 可见语言标签，超出本批范围）。 |
| **D5** | `homePage.featuredLead`(=`用`) | 单字键，仅为 DashJ 图标前后切分服务（原文 `用<DashJ/>兑换精彩礼品`）；en/vn 用 `Redeem` / `Dùng` 承接整句，切分后语义完整。属插值/元素混排的拆键取舍，登记备查。 |

## §6 保留的中文注释逐行位置（89 行；**不计入命中**，逐条列出）

剥注释后 CJK 字面量 = 0；以下行**只有注释**含中文（本批未改注释，属 recon 口径 ④）：

- `App.jsx`（33 行）：L5, L15, L16, L24, L33, L40, L43, L44, L48, L55, L56, L65, L67, L70, L73, L76, L77, L78, L80, L88, L91, L94, L108, L109, L110, L119, L126, L179, L216, L219, L222, L241, L246
- `components/Header.jsx`（22 行）：L67, L87, L90, L95, L104, L106, L110, L115, L124, L126, L134, L161, L163, L178, L222, L232, L245, L294, L310, L354, L403, L417
- `components/Footer.jsx`（10 行）：L6, L9, L10, L14, L34, L37, L48, L77, L90, L100
- `pages/HomePage.jsx`（0 行）：—
- `shell/AppShell.jsx`（4 行）：L7, L8, L9, L10
- `shell/BottomTabBar.jsx`（3 行）：L8, L9, L10
- `shell/nav.js`（10 行）：L4, L5, L6, L7, L8, L9, L10, L11, L22, L26
- `shell/breakpoints.js`（7 行）：L1, L3, L4, L5, L6, L7, L8

## §7 NOT_MEASURED（未测项 —— 不填 0/空）

- **真浏览器四语验收未做**：本单证据是 `npm run build`（0）、jsdom 单测（en 档渲染断言）与静态扫描；**未**用真浏览器逐页切 en/hk/vn 复核 Header/首页/页脚。AC 只要求 build + 单测，故未做浏览器验收。
- **hk/vn 译文质量未评测**：`footer.*` / `homePage.*` 的 hk 由 zh 按 recon 的 s2t 风格产出、en/vn 为翻译产出，**无母语者/术语表回译核验**。
- **布局回归未测**：`homePage.heroLead/heroTail`、`hotTasksLead`、`featuredLead/featuredTail` 把原 JSX 文本节点切成「键 + `<DashJ/>` + 键」，**切分后行盒/换行有无变化未在真机量测**（只验了文案取值与渲染存在）。
- **品牌 slogan 的落位未获产品确认**：`footer.catSlogan1..3` / `footer.cloudSlogan` 现落在四语 locale 文件里（同值）。若产品认为品牌文案应放代码常量而非 locale 资源，需改判（本单按 0-CJK 类级断言选了 locale 方案）。
- **`alt` 文案变更未获产品确认**：Header 语言切换 `alt` 由 `中文`/`粵語` 变为既有键 `chinese`/`cantonese` 的取值（`简体中文`/`粤语`/`粵語`）。recon §6 亦记该点「需产品决定」，本单采纳报告明列的「复用键」备选。
- **其他批次未动**：B2（含真浏览器实测过的「任务中心」`TaskPage.jsx:230`、`奖励中心` `RewardPage.jsx:293`）、B3/B4/B5 一律未改，本批**不含**它们的验收读数。

---
_本报告由 Unit I18N-LIT-B1（Kong）产出；真源 recon `run_tag=20261001T113240Z-bb0e4ed`。所有读数均可由 §4 四条命令复跑对账。_
