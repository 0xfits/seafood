# p6-accept-prod-i18n-b1b5 — 生产四语界面复检（B1–B5 验收）

- **Unit**: NENG-ACCEPT-I18N2 ｜ **验收人**: Neng（质检）｜ **日期**: 2026-10-01 (CST)
- **Vantage**: **真浏览器**（CDP 驱动本机浏览器）访问 `https://seafood-opal.vercel.app` —— **未退本地**。
- **本机网络基线（对账用）**: `host seafood-opal.vercel.app` ⇒ `198.18.16.176`（保留段 / 代理 fake-ip）+ `67.15.129.210`（与 Vercel 无关网段 ⇒ 劫持）。**浏览器路径可通**（上轮结论复现），故本报告全部读数为**生产站实测**。
- **产物目录**: `backend-ts/.p4-artifacts/p6accept2-20261001T202157Z/`
- **红线遵守**: 纯浏览 + 只读；**未提交任何表单、未发起登录、未发布内容、未发起任何资金操作**；**未改任何 `src/**`·`frontend/**`·`backend-ts/**`（产物目录除外）**；未跑 `git`/`npm install`/`vercel`，未启停任何服务，未用 `pkill`/`killall`。
- **§5.7 口径**: ① 本报告不含任何取自管道之后的退出码（本轮未跑 npm 脚本，无退出码可报）；② 每个数都带口径；③ `NOT_MEASURED` 一律写理由，**不填 0/空**；④ **「读码推断」与「实测」分栏标注**；⑤ 骸架先行（骨架先落盘），逐段追加产物。

---

## 0. 测量口径

- 语言 = **URL 路径前缀**（`utils.SUPPORTED_LANGS = ['zh','en','hk','vn']`；`zh` = 无后缀）。`i18n.js` 在模块初始化时从 `window.location.pathname` 取语言 ⇒ **同一 tab 内客户端跳转不会重初始化 i18n**（下文 §1.6 有实测后果）。
- 逐页拾取：`header` / `nav` / `footer` / `h1..h4` / `button,[role=button]` 的 `innerText`，外加「可见正文**剔除语言切换器子树**」后的 **CJK 码点数 + CJK 连续串集合**（`[\u3400-\u4dbf\u4e00-\u9fff]+`）。
- **切换器豁免**：切换器自身的语言自称（`简体中文 / 繁體中文 / 粵語 / English / Tiếng Việt`）按派单**属预期豁免**，下文以 `【豁免】` 标注。
- 视口：**1440×900**（`deviceScaleFactor=1, mobile=false`）与 **390×844**（`deviceScaleFactor=2, mobile=true`）。
- 控制台采集：`Page.addScriptToEvaluateOnNewDocument` 注入 `window.__errs`，捕获 `error`（区分 **JS 异常** 与 **资源加载失败**）与 `unhandledrejection`，跨全部导航累计。
- 原始数据：`sweep.jsonl`（24 条 = 4 语 × 6 页）、`probe-home-zh.json`、`probe-listing.json`。

---

## 1. 全站文案随语言切换（核心矩阵）

**结论①（UI 文案面）: PASS。** 四档下逐页拾取的 **UI 文案全部随语言变化**；**en/vn 档的非豁免中文残留 = 0**（残留只有切换器自称，见 §1.5）。

### 1.1 ① 页首 Header（导航 / 按钮）

| 语言 | Header 实测文本串 | 读数 |
|---|---|---|
| zh | `Seafood 海鲜市场 │ 社区奖励 │ 社区任务 │ 碎片市场 │ 语言 │ 注册 │ 登录` | cjk=**277**（首页） |
| hk | `Seafood 海鮮市場 │ 社區獎勵 │ 社區任務 │ 碎片市場 │ 語言 │ 注冊 │ 登錄` | cjk=**277** |
| en | `Seafood │ Rewards │ Tasks │ Shard Market │ Language │ Register │ Login` | cjk=**21** |
| vn | `Seafood │ Phần thưởng │ Nhiệm vụ │ Chợ mảnh │ Ngôn ngữ │ Đăng ký │ Đăng nhập` | cjk=**21** |

同一 Header 在 5 个页面（`/`·`/task`·`/reward`·`/listing`·`/login`）**逐字相同**（4 档各 5 页读数一致，见 `sweep.jsonl` 的 `header` 字段）。
**语言 → 实际文本（≥3 条）**：`社区任务` → hk `社區任務` → en `Tasks` → vn `Nhiệm vụ`；`碎片市场` → `碎片市場` → `Shard Market` → `Chợ mảnh`；`登录` → `登錄` → `Login` → `Đăng nhập`。

### 1.2 ② 首页（栏目 / 分区 / 按钮）

| 语言 | h1/h2 分区标题 | 按钮 |
|---|---|---|
| zh | `欢迎来到 Jinli Club` / `热门任务` / `精选奖励` | `立即注册` / `查看奖励` / `查看全部` / `立即参与` |
| hk | `歡迎嚟到 Jinli Club` / `熱門任務` / `精選獎勵` | `即刻註冊` / `查看獎勵` / `查看全部` / `即刻參加` |
| en | `Welcome to Jinli Club` / `Hot tasks` / *(rewards 区标题)* | `Sign up now` / `Browse rewards` / `View all` / `Join now` |
| vn | `Chào mừng đến Jinli Club` / `Nhiệm vụ nổi bật` | `Đăng ký ngay` / `Xem phần thưởng` / `Xem tất cả` / `Tham gia ngay` |

**语言 → 实际文本**：`立即注册` → `即刻註冊` → `Sign up now` → `Đăng ký ngay`；`查看全部` → `查看全部` → `View all` → `Xem tất cả`；`参与任务，赚取 J，兑换精彩奖励` → hk `參與任務，賺取 J，兌換精彩獎勵` → en `Complete tasks, earn J and redeem great rewards` → vn（同区英文/越南文，见 `sweep.jsonl` 的 home `buttons`）。
**注**：`精选奖励` 的 en 标题未单独拾到（该区 h2 未进 `h1,h2,h3` 采样前 8 条）；**en 版该区标题 = NOT_MEASURED**（未取到该元素读数，原因：采样深度上限，非页面缺失）。

### 1.3 ③ 页脚 Footer

| 语言 | 实测 Footer 全文 |
|---|---|
| zh | `© 2024-2026 Abbey Quant & Jinli Club. 保留所有权利。 │ 本网站支持简体中文、英文、粤语和越南语。 │ 联系我们：contact@jinli.club` |
| hk | `© 2024-2026 Abbey Quant & Jinli Club. 保留所有權利。 │ 本網站支持簡體中文、英文、粵語和越南語。 │ 聯繫我們：contact@jinli.club` |
| en | `© 2024-2026 Abbey Quant & Jinli Club. All rights reserved. │ This website supports Simplified Chinese, English, Cantonese and Vietnamese. │ Contact us: contact@jinli.club` |
| vn | `© 2024-2026 Abbey Quant & Jinli Club. Tất cả quyền bảo lưu. │ Trang web này hỗ trợ tiếng Trung giản thế, tiếng Anh, tiếng Quảng Đông và tiếng Việt. │ Liên hệ với chúng tôi: contact@jinli.club` |

Footer 在 5 页逐字相同。**en/vn 档 Footer 无中文残留**（`本网站支持简体中文…` 这句已整体译为英文/越南文）。

### 1.4 ④ 任务页 ⑤ 奖励页 ⑥ 我的/个人页 ⑦ 登录页

**④ `/task`（任务中心）**
| 语言 | 标题 / 筛选按钮 |
|---|---|
| zh | `任务中心` ｜ `可参与 (20)` `待领取 (0)` `已完成 (0)` `待验证 (0)` ｜ `立即参与` |
| hk | `任務中心` ｜ `可參加 (20)` `待領取 (0)` `已完成 (0)` `待驗證 (0)` ｜ `即刻參加` |
| en | `Task Center` ｜ `Available (20)` `To claim (0)` `Completed (0)` `Pending Verification (0)` ｜ `Join now` |
| vn | `Trung tâm nhiệm vụ` ｜ `Có thể tham gia (20)` `Chờ nhận (0)` `Đã xong (0)` `Chờ xác minh (0)` ｜ `Tham gia ngay` |

**⑤ `/reward`（奖励中心）**
| 语言 | 标题 / 筛选按钮 |
|---|---|
| zh | `奖励中心` ｜ `可兑换 (0)` `限量版 (0)` `高价值 (1)` `已兑换 (0)` |
| hk | `獎勵中心` ｜ `可兌換 (0)` `限量版 (0)` `高價值 (1)` `已兌換 (0)` |
| en | `Reward Center` ｜ `Redeemable (0)` `Limited edition (0)` `High value (1)` `Redeemed (0)` |
| vn | `Trung tâm phần thưởng` ｜ `Có thể đổi (0)` `Bản giới hạn (0)` `Giá trị cao (1)` `Đã đổi (0)` |

**⑥ 「我的」/个人页 —— `NOT_MEASURED`（安全红线：需钱包签名登录）**
- 实测：`/profile` · `/zh/profile` · `/en/profile` · `/hk/profile` · `/vn/profile` **全部 302/客户端重定向到 `/login`**（未登录态），**页面本体不是个人页** ⇒ 个人页文案**不可测**。
- **转引**（非实测，来源 = 本单派单方给的基线）：个人页文案已入 652 集。**本单不为其背书**。
- **连带实测发现（§1.6）**：重定向目标 URL **丢掉语言前缀**。

**⑦ 登录页 —— 四档中只有默认档可用（缺陷，见 §8-F1）**
| 语言 | URL | 实测 |
|---|---|---|
| zh / 默认 | `/login`（`/zh/login` → 302 到 `/login`） | **完整渲染**：`连接钱包继续探索 │ 钱包签名登录 │ 尚未连接钱包 │ 连接你的 EVM 钱包，并完成一次签名验证即可登录。 │ 登录只会请求一次签名，不会发起链上交易，也不会消耗 gas。 │ 当前环境未检测到 MetaMask 或 OKX Wallet。 │ 连接钱包 │ 签名登录 │ 说明 │ 1. 连接一个 EVM 钱包。 2. 按提示完成签名验证。 3. 首次登录用户继续补全个人简介。` |
| hk | `/hk/login` | **空壳**：`<main>` 存在但 `innerHTML.length = 0`，页面只有 Header + Footer + 切换器 |
| en | `/en/login` | **空壳**（同上，`main` = 0 字节） |
| vn | `/vn/login` | **空壳**（同上，`main` = 0 字节） |

- 四档 **JS 错误均为 0** ⇒ 不是崩溃，是**路由未匹配**。
- **读码推断（推断，非实测）**：`frontend/src/App.jsx:217` 的 `<Route path="/login" …/>` 声明在 **LangShell 之外**（顶层），而 `/<lang>/*`（App.jsx:243）的嵌套路由里**没有 `login` 子路由** ⇒ `/en/login` 命中 `/:lang/*` → LangShell → 无匹配子路由 → 空 `<main>`。此解释与实测一致，但**本单只对「空壳」这一实测读数背书**。
- **可达性限定（实测）**：Header 的「Login」在四档下都是 `<button>`（非 `<a>`，无 `href`）；在 `/en` 点击后 **URL 未变化、仍在首页** ⇒ 空壳 `/en/login` 目前**只能靠直链到达**（不是首页按钮的直接后果）。其后续行为涉登录 ⇒ 按安全红线**不追测**。

**六个页面在四档下的 CJK 码点总数（口径 = 可见正文剔切换器）**

| | home | task | reward | listing | shard | login |
|---|---|---|---|---|---|---|
| zh | 277 | 398 | 129 | 297 | (见§2) | 199 |
| hk | 277 | 401 | 129 | 299 | — | 69（仅壳） |
| en | **21** | **34** | **6** | **6** | — | **6**（仅壳） |
| vn | **21** | **34** | **6** | **6** | — | **6**（仅壳） |

### 1.5 en/vn 档中文残留清单（逐条 · 归属判定）

| 页 | 残留串 | 归属 | 判定 |
|---|---|---|---|
| en/vn `/`·`/task`·`/reward`·`/listing`·`/login` | `简体中文` `粤语`/`粵語` | **语言切换器自称** | **豁免（预期）** |
| en `/` | `无托管` `保持` | **内容面**（后台 seed 的任务描述原文：`…fixture（无托管：escrow_txid 保持 NULL）`） | 内容回落，见下 |
| en `/task` | `海鲜招工测试甲` `整理货架与盘点` `负责每日盘点与货架整理` `包午餐` | **内容面**（招工 title/desc/benefit 无译文） | 内容回落，见下 |
| hk `/task` | `海鲜招工测试甲`（未转繁） | **内容面** | 内容回落 |

**内容回落 = 设计契约，不是缺陷（读码 + 实测一致）**：`docs/route-layer.spec.md:78`（§10.1）写死「`*_en`/`*_hk`/`*_vn` **恒有值**；有 `ready` 译文用译文，否则**回落原文 zh**、**永不空串**」，并配 **`i18n_status ∈ {ready, partial, pending}`**。实测印证了该契约两端：
- 回落生效：`/en/task` 显示 zh 原文而非空串（**卡片不空白**）；
- 小标生效：`/hk/task` 出现 `<span class="sf-i18n-badge">翻譯中</span>`（实测 DOM 读数为 `H3 = 海鲜招工测试甲：整理货架与盘点` + 同级 `SPAN.sf-i18n-badge = 翻譯中`），对应 `components/i18n/TranslatingBadge.jsx`（`pending`/`partial` 且非 zh 才挂）⇒ **「翻譯中」是设计内的状态小标，不是残留、不立案**。

⇒ **UI 文案面 en/vn 非豁免中文残留 = 0；内容面残留 = 无译文的 seed/fixture 数据按契约回落（附「翻譯中」小标）。**

### 1.6 语言前缀在客户端跳转时丢失（实测，附带发现）

| 场景 | 起始 URL | 落地 URL | 渲染语言 |
|---|---|---|---|
| 未登录访问 `/en/profile` | `/en/profile` | **`/login`**（前缀丢失） | 英文（因 i18n 已在 `/en` 初始化，客户端跳转不重初始化） |
| 未登录访问 `/hk/profile` | `/hk/profile` | `/login` | 繁体 |
| 未登录访问 `/zh/profile` | `/zh/profile` | `/login` | 简体 |
| **刷新** 上面任何一条 | `/login` | `/login` | **简体**（URL 驱动重新初始化） |

⇒ 实测结论：**同一 `/login` URL 会因「进入方式」不同而渲染不同语言**；分享/刷新即回落简体。属可复现的口径不一致，登记为观察项（非本线回归）。

---

## 2. 工程口径是否进用户眼前 —— **FAIL（立案）**

扫描口径：对 `/shard`·`/listing`·`/listing/1`·`/task` × 4 档取 `body.innerText`，正则 `(GET|POST|PUT|DELETE|PATCH)\s+/api…|listing\.stock|escrow_txid|base_cid|quote_cid|status=paid|403|400`。
**读数：四档各命中 `GET /api/…` × 5、`POST /api/…` × 2**（四档**同数**）。逐条文本：

| # | 页面 | 档 | 用户眼前实际文本 |
|---|---|---|---|
| L1 | `/shard` | zh | `行情/盘口/成交流水为公开只读面；挂单与撤单需登录。计价币 quote_cid 服务端恒 1。` |
| L2 | `/shard` | zh | `挂单 = POST /api/order；买单冻结 amount×price 的 $，卖单冻结 base 币 amount。` |
| L3 | `/shard` | zh | `读面 = GET /api/market/:base_cid/orderbook（已注册）。` |
| L4 | `/shard` | zh | `读面 = GET /api/market/:base_cid/trades（已注册、只读）。` |
| L5 | `/shard` | zh | `读面 = GET /api/order；撤单只释放剩余在冻额，手续费不退。` |
| L6 | `/shard` | zh | `账本流水读口尚未注册，暂不展示（已登记）。` ／ `暂无盘口（填 base_cid 后读取；base_cid=1 与「quote 恒 1」互斥 ⇒ 恒空）` |
| L7 | `/shard` | en | `Quotes, order book and trades are public read faces; … The quote currency is always cid 1 server-side.` ／ `Place = POST /api/order; a buy freezes amount x price of $…` ／ `Read face = GET /api/market/:base_cid/orderbook (registered).` ／ `Read face = GET /api/market/:base_cid/trades (registered, read-only).` ／ `Read face = GET /api/order; …` |
| L8 | `/shard` | hk / vn | 同 L7 结构的繁中 / 越南文版本，`POST`·`GET`·`base_cid`·`quote_cid` **原样保留** |
| L9 | `/listing` 列表页 | zh | `读面 = GET /api/prize/all（已注册；读侧已换源 listing 表：bID=listing_id、name=title、points=price）。` |
| L10 | `/listing` 列表页 | zh | `读面 = GET /api/prize-item（listing_order，买家轴，status=paid）。` |
| L11 | `/listing` 列表页 | zh | `退款发起人仅卖方（非卖方 403）；按卖家列订单的读口未注册 ⇒ 请手填订单号。` ／ `退款只退钱、不回滚 listing.stock。` |
| L12 | `/listing` 列表页 | en | `Read face = GET /api/prize/all (registered; source already switched to the listing table: bID=listing_id, name=title, points=price).` ／ `Read face = GET /api/prize-item (listing_order, buyer axis, status=paid).` |
| L13 | `/listing/1` 详情 | zh | `购买 = POST /api/listing/:listingId/buy；幂等键由前端提供（缺键服务端 400）。` |
| L14 | `/listing/19` 详情 | **en** | `Buy = POST /api/listing/:listingId/buy; the idempotency key is supplied by the client (missing key => 400).` |
| L15 | `/listing/19` 详情 | **vn** | `Mua = POST /api/listing/:listingId/buy; khoá idempotency do phía trước cung cấp (thiếu khoá ⇒ 400).` |
| L16 | `/listing/19` 详情 | hk | `購買 = POST /api/listing/:listingId/buy；冪等鍵由前端提供（缺鍵伺服器 400）。` |
| L17 | 任一 `/listing*` | zh | `退款只退钱、不回滚 listing.stock。` ／ en `A refund returns money only; listing.stock is not rolled back.` |
| L18 | `/task` 内容 | 四档 | seed fixture 描述原文 `p4b2 P4-B2a fixture（无托管：escrow_txid 保持 NULL）`（**内容面**，非 UI 文案） |
| L19 | 全站余额按钮 | 四档 | `dashJ不足` / `Not enough dashJ` / `Không đủ dashJ`（`locales/*.json:335`）—— 币种符号被写成 `dashJ`（四档一致，属命名口径问题） |
| L20 | `/task/new`（未实测页面） | 四档 | **读码证据（非实测）**：`locales/*.json:86` `publishNote = 发布即把酬金从可用余额转入托管（job_escrow×2）；审核通过才发放。` ⇒ 该页上线时会把 `job_escrow×2` 给到用户。**页面本身 = NOT_MEASURED**。 |

**判定**：派单第 2 条 ⇒ **FAIL**。且这些文案**已进 652 集四语 locale**（`frontend/src/locales/*.json:99-191`），即「四语化」把它们**翻译成了英文/繁中/越南文并原样保留 API 路径与状态码** —— 英文读者照样看到 `POST /api/...`、`403`、`400`、`base_cid`。**不是漏译，是源头收录了口径错误的文案。**

**「未见」项（实测负结果，供对账）**：正则单独扫 `§\s*\d`、`R\d{3}`、`\bsunset\b`、`TODO` ⇒ **四档全部页面 0 命中**。派单列举的 `§5.1` / `R107` / `sunset` **在本轮可达页面上不存在**（未见 ≠ 不存在于未测页，见 §8）。

---

## 3. 卡片内容四语回归（不得空白）—— **PASS**

抽查对象：已译内容 `listing #19`（标题 + 描述），四档直取详情页 `<h1>` 与描述段：

| 档 | 标题（`h1`） | 描述 |
|---|---|---|
| zh | `海鲜礼盒测试丙：虾蟹双拼` | `顺丰包邮，含虾蟹各两斤，冷链发货` |
| hk | `海鮮禮盒測試丙：蝦蟹雙拼` | `順豐包郵，含蝦蟹各兩斤，冷鏈發貨` |
| en | `Seafood Gift Box Test C: Shrimp and Crab Duo` | `SF Express free shipping, contains 2 jin each of shrimp and crab, shipped via cold chain` |
| vn | `Hộp quà hải sản thử nghiệm C: Combo tôm và cua` | `Miễn phí vận chuyển SF Express, gồm 2 jin tôm và 2 jin cua, giao hàng bằng chuỗi lạnh` |

⇒ **四档均为对应真译文，zh 为中文；四档均非空。** 抽查 2（列表页 `/listing`，卡标题）：`/en/listing` 卡片 19/20 = `Seafood Gift Box Test C: Shrimp and Crab`、`Seafood Gift Box TR1C Test: Shrimp and C…`，与 zh `海鲜礼盒测试丙：虾蟹双拼`、`海鲜礼盒TR1C测试：虾蟹双拼-tr1c01015515` 对应。
**卡片不空白（实测）**：列表页 24 张卡片全部有标题/价格/状态文本（如 `p4b2c:listing A │ $ │ 137 │ 单价 │ 已上架`），无 `[object Object]`、无空卡片。

**连带实测缺陷（非本线）**：列表页**每张卡片与「上架商品」的 `href` 都是 `/undefined/listing/listing/<id>`**（zh 与 en 同）——**字面 `undefined` + 重复路径段**。实测点击后果：落到 `https://seafood-opal.vercel.app/undefined/listing/listing/new`，页面**只剩 Header + Footer，正文全空**（截图 `1440x900-zh-listing-cardclick.png`）。⇒ 列表页点卡片 = 空白页。登记 **F2**。

---

## 4. 两档布局

**1440×900（口径：`documentElement.scrollWidth − clientWidth`）**

| 页 | zh | hk | en | vn |
|---|---|---|---|---|
| home | 0 | 0 | 0 | 0 |
| task | 0 | 0 | 0 | 0 |
| reward | 0 | 0 | 0 | 0 |
| listing | 0 | 0 | 0 | 0 |
| shard | 0 | 0 | 0 | 0 |
| login | 0 | 0 | 0 | 0 |

⇒ **桌面档横向溢出 = 0（全部 24 个组合）**，`scrollWidth == clientWidth == 1440`。
- 口径补充：`home/task/reward/listing/login` 五页的 4 档读数取自主扫描（`sweep.jsonl` 的 `overflow` 字段）；**`/shard` 行的 4 档为补充测量**（`zh/hk/en/vn` 均 `sw=1440 / cw=1440 / o=0`）。**24 格全部有实测读数，无空格。**
- （zh 首页早期一条 `scrollW=1280/clientW=1280` 为视口覆写生效前的基线读数，非偏差；覆写为 1440×900 后全部为 1440。）

**390×844（`mobile=true`）**

| 页 | zh | hk | en | vn |
|---|---|---|---|---|
| home | 0 | 0 | 0 | 0 |
| task | 0 | 0 | **7** | 0 |
| reward | 0 | 0 | 0 | 0 |
| listing | 0 | 0 | 0 | 0 |
| shard | 0 | 0 | 0 | 0 |

- **唯一非零格 = `en/task`，溢出 7px**，`scrollWidth=397 / clientWidth=390`。**可重复性：连测 3 次 = [7, 7, 7]（确定性，非 flaky）**。
- 溢出元素定位探针（遍历 `*` 找 `rect.right > clientWidth`）**返回 0 个元素** ⇒ 溢出**不来自任何单元素的 bounding rect**（推断为文本节点/伪元素/内部滚动容器所致；**此处标「未定位到责任元素」，不写成结论**）。
- 其余 19/20 格为 0 ⇒ 除该格外**无横向溢出**。

**底部 Tab（实测存在且可点）**
- 移动档存在 `position: sticky` 的底部导航条：`rect.top=782, height=62, width=390`（视口高 844 ⇒ 贴底）。
- 四档 Tab 项（逐档实测）：

| 档 | Tab 项（文本 → href） |
|---|---|
| zh | `首页`→`/` ｜ `社区奖励`→`/reward` ｜ `社区任务`→`/task` ｜ `碎片市场`→`/shard` |
| hk | `首頁`→`/hk/` ｜ `社區獎勵`→`/hk/reward` ｜ `社區任務`→`/hk/task` ｜ `碎片市場`→`/hk/shard` |
| en | `Home`→`/en/` ｜ `Rewards`→`/en/reward` ｜ `Tasks`→`/en/task` ｜ `Shard Market`→`/en/shard` |
| vn | `Trang chủ`→`/vn/` ｜ `Phần thưởng`→`/vn/reward` ｜ `Nhiệm vụ`→`/vn/task` ｜ `Chợ mảnh`→`/vn/shard` |

- **点击验证（zh）**：点 `社区奖励` ⇒ `URL = /reward`、`h1 = 奖励中心` ⇒ **可点、跳转正确、标签随档变化**。其余三档的 Tab `href` 均**正确带语言前缀**（对策正确）。

---

## 5. 控制台错误分类

| 类别 | 读数 | 口径 |
|---|---|---|
| **JS 异常**（`error` 非资源 / `unhandledrejection`） | **0** | 24 个「4 语 × 6 页」导航 + 全部补充导航，累计 `window.__errs` 中 `k='js'`/`k='promise'` = **0 条** |
| **资源加载失败** | **8 条 / 首页 × 4 档**（共 32 条，四档同形） | 唯一 URL：`https://seafood-opal.vercel.app/placeholder.jpg`（`<img>` 404） |
| 其它资源失败 | **0** | 上述 8 条之外无任何 `k='resource'` 记录 |
| **Tailwind / FontAwesome CDN** | **未计负**（派单口径），且**实测未观察到失败** | 本轮未 abort 外部源；页面另加载 Google Fonts + `cdn.jsdelivr.net`（LXGW WenKai / Smiley Sans 回退）—— **未见加载失败记录** |

- `placeholder.jpg` 404 在**四档首页各 8 次**（= 8 张无图商品卡各自请求同一缺失占位图）⇒ **F3（低危：占位资源缺失）**。
- 注意：上方为**浏览器侧采集**；生产站是否有 5xx 需看服务端日志 ⇒ **不在本单口径内（NOT_MEASURED）**。

---

## 6. 日期是否随语言变化（`formatDate` 残留：验证/推翻）

**结论：本轮的浏览器侧读数 = 页面不渲染任何日期 ⇒ 无法对照；残留既未被证实也未被推翻（`NOT_MEASURED`，不填 0）。**

**实测（四档 × 可达页）**：对 `/`·`/task`·`/reward`·`/listing`·`/shard`·`/listing/1` 取 `body.innerText` 扫 `\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}` 与 `\b\d{1,2}:\d{2}(:\d{2})?\b`：

| 页 | zh | hk | en | vn |
|---|---|---|---|---|
| `/` `/task` `/reward` `/listing` `/shard` `/listing/1` | `dates=[]` | `dates=[]` | `dates=[]` | `dates=[]` |

⇒ **四档读数全空（不是「四档相同」，而是「无日期可测」）** ⇒ 派单给的判据（「四档完全相同 ⇒ 证实」/「不同 ⇒ 推翻」）**本轮不成立**，**不得**据此宣称证实或推翻。

**读码读数（静态事实，非实测）**：
- `frontend/src/components/ui/Advanced.jsx:119-121` 的 `formatDate` 确以 `new Date(date).toLocaleDateString('zh-CN')` 写死 `zh-CN` —— 该**代码事实成立**。
- 但 `DatePicker`（`Advanced.jsx:106`）的**消费者只有 `components/ui/index.js`（barrel）与两个测试文件**（`ui-barrel-exports.test.js`、`i18n-batch-b5.test.jsx`）——**没有任何页面渲染 `DatePicker`** ⇒ 该残留**在当前生产可达面上不可达**。
- 另有 `ProfilePage.jsx:271/335` 用 `toLocaleDateString()`（**浏览器 locale 驱动，非写死 `zh-CN`**）—— 该页需钱包登录 ⇒ **NOT_MEASURED**；`admin/*` 的 `formatDateTime` 亦在鉴权后 ⇒ **NOT_MEASURED**。

⇒ 判定：**「日期不随语言变化」在生产页面上的实际影响 = 本轮无法证实（NOT_MEASURED）**；能确证的只有「写死 `zh-CN` 的代码仍在仓里、且当前无页面消费它」。

---

## 7. 截图取证（存 `backend-ts/.p4-artifacts/p6accept2-20261001T202157Z/shots/`，共 **20** 张）

**1440×900（15 张）**
```
1440x900-zh-home.png        1440x900-hk-home.png      1440x900-en-home.png      1440x900-vn-home.png
1440x900-zh-task.png        1440x900-hk-task.png      1440x900-en-task.png      1440x900-vn-task.png
1440x900-zh-reward.png      1440x900-hk-reward.png    1440x900-en-reward.png    1440x900-vn-reward.png
1440x900-zh-listing.png     1440x900-hk-listing.png
1440x900-zh-listing-cardclick.png   ← F2 取证：点卡片后 `/undefined/…` 空白页
```
**390×844（5 张）**
```
390x844-zh-home.png   390x844-en-home.png
390x844-zh-task.png   390x844-en-task.png   ← en/task 7px 横向溢出取证
390x844-zh-reward-aftertab.png  ← 底部 Tab 点击后落在 /reward（h1=奖励中心）
```
（1440 档四语各 ≥2 张：home + task + reward；390 档 zh 3 张、en 2 张 ⇒ 派单「每档至少 2 张」已满足，且四语在 1440 档各有专属取证。）

**原始读数文件**：`sweep.jsonl`（24 条逐页记录：header/footer/headings/buttons/cjkRuns/errs/overflow）、`probe-home-zh.json`、`probe-listing.json`。

---

## 8. 立案与观察项汇总

| 编号 | 级别 | 项 | 实测证据 |
|---|---|---|---|
| **F1** | **高** | **登录页在 hk/en/vn 前缀下为空壳**（`/hk/login`·`/en/login`·`/vn/login` ⇒ `<main>` 0 字节，只余 Header/Footer），仅 `/login`（zh/默认）完整渲染；四档 JS 错误均 0（路由未匹配，非崩溃） | §1.4 ⑦；URL:前缀 + `mainLen=0/mainHTML=0` |
| **F2** | **高** | 列表页**所有卡片 + 「上架商品」`href` = `/undefined/listing/listing/<id>`**（字面 `undefined` + 重复段）；实测点击 ⇒ 落 `/undefined/…`，正文全空 | §3；截图 `1440x900-zh-listing-cardclick.png` |
| **F3** | 低 | 首页 `placeholder.jpg` 404 × 8（四档同形） | §5 |
| **F4** | 中 | **工程口径进用户眼前**：`/shard`·`/listing`·`/listing/:id` 四档各命中 `GET /api/…`×5、`POST /api/…`×2，并含 `403`/`400`/`base_cid`/`quote_cid`/`listing.stock`/`job_escrow×2` 等；**已进 652 集四语 locale 并被译为英文/繁中/越南文** | §2（L1–L20） |
| **F5** | 中 | `390×844` 下 **`en/task` 横向溢出 7px**（`397/390`，连测 3 次稳定 [7,7,7]；未定位到责任元素） | §4 |
| **F6** | 低 | `ProtectedRoute` 重定向丢语言前缀（`/en/profile` → `/login`），导致同一 `/login` 因进入方式不同渲染不同语言，刷新即回落简体 | §1.6 |
| **观察** | — | 币种符号写作 `dashJ`（四档一致）；`/hk/task` 显示 zh 原文 + `翻譯中` 小标（**属 §10.1 契约，非缺陷**）；`listing #1..18` 等 fixture 无译文按契约回落（卡片不空白） | §1.5 / §2 L19 |

---

## 9. NOT_MEASURED（逐条带理由，禁填 0/空）

| # | 未测项 | 理由 |
|---|---|---|
| N1 | **「我的」/个人页（`/profile`）文案四语** | 需钱包签名登录；安全红线禁止登录/提交凭据。实测四档均重定向至 `/login`，页面本体不可达 |
| N2 | **个人简介编辑（ProfilePage 个人简介表单）** | 同上（需登录；且派单明确禁提交表单） |
| N3 | **后台/管理面**（`/admin/*`：Dashboard·Tasks·Rewards·Shards·Users·Permissions·Points·Settings） | `ProtectedRoute adminOnly` + `requiredPermission`；无凭据 ⇒ 不可达。**不给读数** |
| N4 | **日期随语言变化的行为**（`Advanced.jsx formatDate('zh-CN')` 的实际影响） | 可达页面上**不渲染任何日期**（§6 四档 `dates=[]`）⇒ 无对照物；消费方 `DatePicker` 无任何页面使用（静态读数），`ProfilePage`/`admin` 的日期渲染在鉴权后 |
| N5 | `ProfilePage` 的 `time_reg` / `time_update` 实际渲染串 | 同上（需登录） |
| N6 | `/task/new`（发布招工）、`/task/review`、`/task/:jobId`、`/listing/new` 四语界面 | **未进入本轮采样**（预算内优先覆盖派单点名的 7 类页面）；`/task/new` 的 `job_escrow×2` 仅为 **locale 读码证据**（§2 L20），**不是实测** |
| N7 | 钱包连接 → 签名 → 登录 全流程及其文案 | 安全红线（不得发起登录操作） |
| N8 | 生产服务端 4xx/5xx、真实 API 载荷状态码 | 本单为纯浏览器只读口径，无服务端日志 vantage |
| N9 | 英文档「精选奖励」区 h2 标题 | 采样深度上限（`h1,h2,h3` 取前 8 条）未覆盖该元素；**非页面缺失** |
| N10 | 四语**译文质量**评测（语义/术语一致性） | 派单已把此项列为 NOT_MEASURED 项；本轮只做「是否随语言切换 / 是否有中文残留 / 是否空白」的可判负读数 |
| N11 | `/theme-preview` 生产可达性 | 不在本轮 7 类页面内，未采样 |
| N12 | 溢出 7px（F5）的**责任元素** | 元素级探针返回 0 命中 ⇒ 未定位；**只报读数，不猜因** |

---

## 10. 障碍与边界

1. **本机 DNS 劫持（已按基线处理）**：`host` 返回 `198.18.16.176`（fake-ip）+ `67.15.129.210`（无关网段）。浏览器路径可通 ⇒ **全部读数取自生产站，未退本地 `127.0.0.1:5787`**。
2. **`capture_screenshot()` 每次写同一路径**（`…/browser-harness/tmp/shot.png`，会被后续截图覆盖）⇒ 第一轮 6 张截图被覆盖作废；**已在发现后改为「截一张立刻 `shutil.copyfile` 到产物目录」并重拍**（现 20 张均为即拍即存）。后续同类复检应**默认即拍即拷**。
3. **客户端跳转不重初始化 i18n**（`i18n.js` 模块级 init 只读一次 URL）⇒ SPA 内跳转的语言归属可能与 URL 不一致；§1.6 已把该效应作为**实测现象**记录，而非把它误读成「切换失效」。
4. **安全红线致覆盖缺口**：`/profile`、`/admin/*`、个人简介编辑、发布类页面的**四语实测缺口无法在本单类型（只读复检）内补齐**——需带授权会话的专用单，且须显式批准登录与提交范围；本单**不代填、不推断**。
5. **`/undefined/...` 与 `/en/login` 空壳均为「直链/点击可复现」的实测现象**；对 F1 的**成因**我给的是读码推断（App.jsx 路由层级），已标注为推断，若立单需由实现方确认。
