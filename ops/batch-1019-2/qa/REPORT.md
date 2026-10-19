# BATCH-1019-2 · 独立质检 REPORT（Neng 位）

- **被检面**：HEAD `9c8a460`（工作树干净、未 push），未推链 = `a0a464f`（dev 夹具币清理）→ `a7f0dbc`（zh 对齐）→ `9c8a460`（底栏恒 5 格）。
- **方式**：全部读数独立自取，不采信三单自报；零库写（全 SELECT）、零真登录、零真发布、不 commit 不 push。
- **环境**：5800（h5-preview）→ 5787（vite dev）→ 5788（api，dev 库 Neon `quiet-math-65207667`）三服务开跑前均 200；DB 连接串从 `backend-ts/.env.local` 经 `dotenv.parse` 显式构造（`processEnvLeakKeys=[]`，禁吃 process.env）。
- **结论**：**8/8 AC PASS**（详见 `verdict.json`）。三单自报与实测一致。

## 逐 AC 读数要点

| AC | 结论 | 关键读数（reading 文件见 `readings/`） |
|---|---|---|
| 1 游客形态 | PASS | `/item/new`@390×844 游客：`a[data-sf-nav]` 恰 5（keys=home/shard/sell/messages/profile，含 profile）；zh href=`[/, /exchange, /item/new, /messages, /profile]`；/en 下 profile href=`/en/profile`（home=`/en/` 为 `navPathInLang` 对 `path:''` 的既有输出，前缀正确）。点「我的」→ `/login`，页面文案「连接钱包 / 使用现有钱包签名即可登录」（**input=0** —— 本站登录=钱包签名页无表单，恰好反证「有 input」不可作判据；判据按 AC 用 URL+文案）。pageerror=0。**判负对照**：注入假 profile tab 计数 6、移除回 5（尺子灵敏）。→ `ac1-guest-shape.json` |
| 2 登录态形态 | PASS | 假会话（localStorage `user` + 非 JWT 校验形状 token，`/api/**` 503 拦截防 401 清会话）5 格不变、sessionPersisted=true、pageerror=0。`grep -rn 'visibleNavItems\|requiresAuth' frontend/src` 4 命中**全部在注释内**：`nav.js:17/:30`（留痕注释，AC 明文允许）、`theme-shell-isomorphism.test.jsx:108`（全行注释）、`v15-nav-floatmenu.test.jsx:92`（行尾注释）——代码位置 0 处。→ `ac2-nav-grep-fakesession.json` |
| 3 桌面/详情不回归 | PASS | 1440×900 游客：`.sf-tabbar` computed `display=none`，DOM 恒 5 tabs（`state:'attached'` 等待，keysInDom 全对）。`/item/1`：classes=`sf-tabbar is-detail`、display=none、DOM 5 tabs。代码层：`git show 9c8a460 -- BottomTabBar.jsx` diff 仅 import 行（−useAuth/−visibleNavItems → +SHELL_NAV_ITEMS）、注释 2 行、−`const { isAuthenticated } = useAuth()`、`items` 来源改 `SHELL_NAV_ITEMS`；未读角标（useUnreadCount/unreadBadgeText/角标 span 渲染块）**零 diff 行触碰**。→ `ac3-desktop-detail-badge.json` |
| 4 zh 对齐 | PASS | 四语 `jobs.cidNote` 现取：zh=`请从下拉框选择币种`（无「悬赏」）、hk=`請從下拉框選擇幣種。`、en=`Select the currency from the dropdown.`、vn=`Chọn tiền tệ từ danh sách.`。`git show a7f0dbc --stat` 共 5 文件 = **代码面恰 `frontend/src/locales/zh.json`（1+/1−）** + `ops/item-cid-select/` 证据件 4 个。拍平键数 1106×4（四语节点 4424），两两对称差全 0、键集逐语相同、顶层键 128×4。→ `ac4-i18n-align.json` |
| 5 dev 夹具币清理 | PASS | 只读探针（`probe-db-cleanup.mjs`）：`current_setting('neon.project_id')=quiet-math-65207667`（branch `br-soft-lake-b3iv9tli`）；`currency` 16 行 = **listed 恰 2**（cid 1 `$`、cid 399 `BTTC`）+ delisted 9（恰夹具 cids `[4,10,16,21,29,31,32,35,36]`）+ draft 5（cid 9/15/22/27/28，与 item-cid-select QA 存量读数一致）；`currency_status_log` 计 **16**，末 9 行 `to_status='delisted'` 且 memo 均含 `dev cleanup`；**审计行↔currency 行 9/9 逐一对应**（delisted 集合与审计 cid 集合相等）。→ `ac5-db-cleanup.json` |
| 6 读口 | PASS | `curl http://localhost:5788/api/currencies`（**无 Authorization 头**）⇒ HTTP 200、`success=true`、rows=2（cid 1 `$`/平台积分、cid 399 `BTTC`/battcoin）、每行键恰 `{cid,symbol,name}` 三键。→ `ac6-currencies-verified.json`（原始体 + headers） |
| 7 门套 | PASS | HEAD 自跑（`readings/gates.log`）：build `BUILD_EXIT=0`（✓ built in 1.96s，产物 `index-DAobK5Jq.js` / `index-DnoMyxQu.css`，与 `dist/index.html` 引用逐字同名）；`test:unit` `TEST_EXIT=0`，**Test Files 59 passed (59)、Tests 568 passed (568)** —— 与 9c8a460 自报 59/568 持平。log 内 `HOME_UNREGISTERED` 行 = 用例回退路径 console 噪声，非失败。→ `ac7-gates.json` |
| 8 回归 | PASS | `/` 游客态 `#root` innerHTML=49310（非空）、pageerror=0。`git log --oneline origin/main..HEAD` 逐条 = 恰 3 条（9c8a460 / a7f0dbc / a0a464f，全文见读数）；merge-base=`9adcfcc`，且 `e0a6ee3` 为 `origin/main` 祖先 ⇒ e0a6ee3 之后未推提交 = 恰这 3 条。→ `ac8-home-guest-git.json` |

## 质检尺子修正留痕（非放宽判据）

首轮聚合 AC2/AC4 判 FAIL，均系**质检方聚合脚本自身取数 bug**，修正后重判 PASS：
1. AC2：把测试文件里**行尾注释**中的 `requiresAuth` 误判为代码引用 → 增加 `occurrence_in_comment` 逐命中分类，代码位置 0 处；
2. AC4：stat 文件名等值判断漏 `frontend/` 前缀；且重算 `all_pass` 时把盘上旧 `all_pass:false` 一并纳入 → 剔除后重算。
两次修正过程留痕于 `verdict.json` 的 `ruler_corrections` 与对应 reading。底层数据未变、判据未放宽。

## 副作用披露

- 探针全部只读；判负对照的 DOM 注入为页面内瞬时操作（每次新建 context、`localStorage.clear()`），无持久残留。
- DB 探针零写（全 SELECT）、未触碰他人读数与 docs/；未 commit 未 push。
- 本机 dev 库为多会话共享：本轮未新增任何夹具行。

## 产物清单（ops/batch-1019-2/qa/）

- `verdict.json` · `REPORT.md`（本件）
- `probe-shape.mjs`（浏览器六臂探针）· `probe-db-cleanup.mjs`（DB 只读探针）
- `readings/`：`ac1-guest-shape.json`、`ac2-nav-grep-fakesession.json`、`ac3-desktop-detail-badge.json`、`ac4-i18n-align.json`、`ac5-db-cleanup.json`、`ac6-currencies-verified.json` + `ac6-currencies.json`/`ac6-currencies.headers`、`ac7-gates.json` + `gates.log`、`ac8-home-guest-git.json`、`ac1-ac3-ac8-browser-master.json`
