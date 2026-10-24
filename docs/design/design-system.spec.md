# 海鲜市场 · 主题体系设计规范与 Design Token 契约

> 版本 **v1.4** · 作者 **Jing（制度员）** · 状态：**口径冻结（T1..T79 逐条）**（v1.1 新增 `T75..T79` = 手机竖屏 H5 加固口径 P0–P4，见 §13；**v1.2 收窄 `T77` 实施范围 + 升 `T75` 配对项为硬判据**；**v1.3（补丁单 2）= ① 补登 `T79` 桌面侧受影响元素（三类）· ② 把「桌面档不动」硬判据**改写为「例外清单式」** · ③ 入册 P2 侧栏缺陷 D1 及其根因/教训**；**v1.4（补丁单 3）= ① 把「桌面档不动」硬判据由「例外清单式（元素白名单）」★改「归因式判据」（反事实归因实验）** · ② **登记 D1 修复后事实**（修法 = 共同祖先 · 消费者全扫 `= 0` · 同根因第 4 面 · 新副作用 `.sf-listings-status` 390 档 0→44）· ③ **把归因实验写成可复跑配方 + 登记 `.sf-tabbar` 子树 `0×0` 事实**，见 §12 / §13.1 / §13.2.1 / §13.3 / §13.4 / §13.5 / §13.6）
> **★ 现行版 = v1.5（2026-10-11 · Kevin/Zang 定档）**：**底栏（H5）五项新集合**〔`T80`〕+ **右侧悬浮菜单（仅桌面 `>767`）**〔`T81`–`T83`〕+ **三弹窗模板位**〔`T84`〕+ **1440 档不重叠硬判据**〔`T85`〕+ **`T76` 去重口径重算**〔`T86`〕⇒ 新增 **§14** + 规则 **`T80..T86`** + **`N27..N30`**。**上行「版本 v1.4」字面 = 历史留痕**（受「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束，未改写；**以本行为现行版**）。**改前快照** = `docs/versions/design-system.spec.v1.4.md`（`cmp=0`）。**真源** = `docs/design/style-preview.html` 追加区块（**行 983–1042**；纯追加、三读数见 §14.9）。**本册 v1.5 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务。**
> **★ 现行版 = v1.6（2026-10-11 · Kevin/Zang 裁定⑦）**：**i18n `home` 键值变更** —— **`首页` ⇒ `海鲜市场`**（四语：zh「海鲜市场」/ en「Seafood Market」/ hk「海鮮市場」/ vn「Chợ hải sản」）。依据 **Zang 裁定⑦**：底栏①文案 = Kevin 指定的「海鲜市场」，而实现 `SHELL_NAV_ITEMS[0].labelKey = 'home'` ⇒ 渲染 `t('home')`（**现取：`t('home')` 唯一消费点 = `frontend/src/shell/nav.js:15`**）现值 = 「首页 / Home / 首頁 / Trang chủ」⇒ **不满足指定文案** ⇒ 按裁定更正 `home` 值（与 `siteTitle` 品牌口吻一致）。**值变更 = +0 键 ⇒ §14.10 计数（顶层 `119⇒128` / 拍平 `1050⇒1070` / 四语节点 `4200⇒4280`）逐字不变**（增量全部来自 +20 新增键）。**连同 v1.5 的 `shard` 值变更 ⇒ §14.10 B = 值变更 2 键（`shard` + `home`）**。**nav 文案断言现取 = 无**（见 §14.5 ★）。**改动 = 版本头 + §12 + §14（§14.0 / §14.4 / §14.5 / §14.6 / §14.7 / §14.10）**；**改前快照** = `docs/versions/design-system.spec.v1.5.md`（`cmp=0`；md5 `23957167410322920fed75c8c57124b1`）。**本册 v1.6 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（`home` 值变更由 Kong 落地 `frontend/src/locales/*.json`）。
> **★ 现行版 = v1.7（2026-10-11 · Kevin/Zang 裁定⑧⑨）**：**① 裁定⑧ · 底栏⑤（第五格）文案键** —— **`profile` 键值一律不动**（四语仍 `个人资料`/`Profile`/`個人資料`/`Hồ sơ`），**新增键 `me`**（zh「我的」/ en「Me」/ hk「我的」/ vn「Tôi」）⇒ **`frontend/src/shell/nav.js:21` 第五项 `labelKey` 由 `'profile'` 改 `'me'`**（**`key: 'profile'` / `path: 'profile'` / `requiresAuth: true` 逐字不动**）。**理由**：底栏⑤文案 = Kevin 指定「我的」，而 `t('profile')` 另有**两个消费点**（`frontend/src/components/Header.jsx:284` 桌面下拉 · `:460` 移动面板），且 **`r9-84-profile-entry.test.jsx` 锚定「个人资料」**（`:135`/`:226` = `toContain(zh.profile)`）⇒ 直接改 `profile` 值会牵连**非底栏面** ⇒ 以**新增键 `me`** 承接、`profile` 值保持。**「一句话可改」**：若 Kevin 要**全站统一为「我的」**，才改 `profile` 键值（四语 ⇒ 我的/Me/我的/Tôi）**并**改锚 `r9-84-profile-entry.test.jsx:135/:226`（见 §14.5 ★①）。**② 裁定⑨ · 1440 悬浮菜单与正文重叠** —— **Kong 实测 1440 档正文全幅（首页卡片右缘至 `x=1388`）** 而 **悬浮菜单占 `x∈[1316,1424]`**（`right:16` + 宽 `108`）⇒ **相交 ≈ 4.6 万 px²**，**违 `T85`「悬浮菜单 rect 与正文卡片 rect 相交 = 0」硬判据**。**裁定**：**桌面档给正文预留右侧 gutter（宽 `140px` = 菜单 `right:16` + 宽 `108` + 余量 `16`）**；**gutter 规则落 `frontend/src/styles.css` 的 `@media (min-width:1024px)`**，**不得在 `frontend/src/shell/shell.css` 新增 `@media` 块**（外壳断言要求其仍**只有 1 个 767 块**；现取 `grep -c '@media' shell.css = 1`）⇒ **≤767 零影响**；**`T85` 判据不降级**（「相交 = 0」逐字不变）。**必须交**：**1440 / 1600 / 1920 三档相交 = 0** 与 **三档 `scrollWidth == clientWidth`**。**归因式判据的「允许变更集」 += 「gutter 引起的容器/内容宽度变化面」**（与上轮 `T79` 字号、`.sf-fm` 子树并列，见 §14.9(b)）。**裁决 = 值/结构变更（+1 新键 `me` + 桌面 gutter）** ⇒ §14.10 计数（**实取**：顶层 `119 ⇒ 129` / 拍平 `1050 ⇒ 1071` / 四语节点 `4200 ⇒ 4284`）。**改动 = 版本头 + §12 + §14（§14.0 两条裁定 + §14.1 补注 + §14.2 gutter + §14.4 补注 + §14.5 补 2 行 + §14.6 补 2 行 + §14.7 补 1 行 + §14.9(b) 归因措词 += gutter + §14.10 A 加 `me` 行 + 计数注）**；**改前快照** = `docs/versions/design-system.spec.v1.6.md`（`cmp=0`；md5 `51475b46117d6dc4f986408cf6b6de43`）。**本册 v1.7 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（`me` 键 + gutter 由 Kong 落地）。
> **★ 现行版 = v1.8（2026-10-11 · Kevin/Zang 裁定⑩ + 归因第④类）**：**① 裁定⑩ · gutter 生效起点由 `1024` 改 `768`** —— Kong 实测 **D4（真缺陷）**：v1.7 的 gutter 只写在 `@media (min-width:1024px)`，而 `.sf-fm` 的隐藏阈值是 **`≤767`**（`shell.css` 唯一 767 块内）⇒ **`768–1023` 中间档「菜单可见、正文无留白」** ⇒ 悬浮菜单与正文卡片**相交 ≈ `49920 px²`**，**违 `T85`**。**裁定**：**gutter 生效起点 = `768px`**（与菜单显示阈值同界；落 `frontend/src/styles.css` 的 `@media (min-width:768px)`；**`shell.css` 仍不得新增 `@media`**）；**`T85`（相交 = 0）不降级**，**作用域 = 菜单可见的一切宽度档**（`>767` 全档）；**验收面扩为六档 × 三页**（`768`/`1024`/`1280`/`1440`/`1600`/`1920` × `/`、`/listing`、`/exchange`）+ **手机档（`390`/`375`/`320`）零影响**。**② 归因式判据「允许变更集」 += 第④类「§14 已批准的 locale 值变更引起的文案/宽度面」** —— Kong 实测 **D3（判据漏洞）**：归因差异里有 **5 条/页**归不进既有三类允许集（桌面左 nav 第 3 项宽 **`52 ↔ 80`**），根因 = **`shard` 值 `碎片市场 → 市场`（§14 已批准的值变更）** ⇒ 允许变更集由三类扩为四类；**措词含可判负要求**：「**须给算术语义闭合**（字串长度变化 → 宽度变化方向与量级一致）」。**改动 = 版本头 + §12 + §14（§14 节注 + §14.0 两条裁定 + §14.1 `T85` 补注 + §14.2 gutter 表 + §14.5 补 2 行 + §14.6 第 16 行 + §14.7 判负行 + §14.9(b) 归因措词 += 第④类）**；**改前快照** = `docs/versions/design-system.spec.v1.7.md`（`cmp=0`；md5 `8b9606a0e2ca09a676dacb4098af8cfe`）。**本册 v1.8 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（gutter 起点 `768` 与 `shard`/`me` 值由 Kong 落地）。
> **★ 现行版 = v1.9（2026-10-11 · Kevin/Zang 裁定⑪⑫⑬ + 登记项）**：**① 裁定⑪ · 撤 gutter + 允许遮挡 + `T85` 重定义** —— Kevin 明言「不要窄 `140px`，恢复原来宽度；右侧悬浮栏**可以遮挡**其它内容」⇒ (a) **撤销** `frontend/src/styles.css` 的 `@media (min-width:768px){.sf-route-container{padding-right:140px}}`（实现侧 Kong 做）；(b) **`T85` 由「相交 = 0」重定义**为「**悬浮菜单的可见性（`≤767` 隐藏 / `≥768` 显示）、几何（宽 `72` / 单元高 `92` / 图标 `26` / 字号 `12` / 右边距 `16` / `top:45%`）与六档（`768`…`1920`）× 多页零横向溢出**；**遮挡为已知并接受项**（**仅需登记实测面积，不得当 `FAIL`**）」；(c) 各档验收面**保留六档 × 三页**，**删去「相交 = 0」这一条**。**本裁定推翻 v1.7/v1.8 关于 gutter、`T85` 作用域与验收面的口径** —— 旧措词**逐字保留为改前原文 + 标「已被 v1.9 取代」留痕**（§14.0 裁定⑨⑩ / §14.1 `T85` 行 / §14.2 / §14.5 #34–#36 / §14.6 #16 / §14.7 / §14.9(b)；**尤其中间档 `D4` 与反相复现 `49920` 两段叙述原文一字未修饰**）。**② 裁定⑫ · `profile` 文案全站统一** —— `profile` 键**四语值改** zh「我的」/ en「Me」/ hk「我的」/ vn「Tôi」；底栏第 5 项 `labelKey` 回 `profile`；**删除上一轮新增的 `me` 键** ⇒ 键计数**回落为顶层 `128` / 拍平 `1070` / 四语节点 `4280`**（本册现取核验，见 §14.10 尾）；并写明 **`r9-84-profile-entry.test.jsx` 等锤「个人资料」文案的断言需改锚（Kong 执行）**；**本裁定取代上一轮（v1.7）标注的「一句话可改」选项**。**③ 裁定⑬ · 夜档三 token 收口** —— `--sf-fm-bg`/`--sf-fm-fg`/`--sf-fm-divider` 的夜档**推断值经人类认可**（Kevin 回复「目前看没问题」）⇒ **`N28`/`F8` 标「已认可（2026-10-11）」**而非待裁（**历史行未改写，只追加/就地留痕**）。**④ 登记项 · 真机与本地 H5 配色差异** —— 承 `N26`/`F7` 登记为**待查**（三假设：主题档状态 / 广色域色彩管理 / iframe vs 独立视口渲染；旁证见 §14.8 `N31`）。**改动 = 版本头 + §12 + §14（§14 节注 + §14.0 + §14.1 `T85` 行 + §14.2 + §14.5 + §14.6 #14/#15/#16 + §14.7 + §14.8 + §14.9(b) + §14.10）**；**改前快照** = `docs/versions/design-system.spec.v1.8.md`（`cmp=0`；md5 `06e66ba255531086619e9b4f8becaf40`）。**本册 v1.9 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（撤 gutter + `profile` 值 + 删 `me` + `nav.js` 第五项 `labelKey` 回 `profile` 由 Kong 落地）。
> **★ 现行版 = v1.10（2026-10-11 · Kevin 裁定 · `移除 reward 概念 → 闲置物品 item`）**：**① 范围 A = 只改前端**（后端 `/api/prize/*` 与 `prizes` 表名**不动**，映射表见姊妹册 `route-layer.spec` v2.28 §38.3）；**② 路由 D = `/item` 列表 + `/item/:id` 详情 + 保留 `?id=` 兼容**；**③ 旧路由直接删除、不做 301 / 不做重定向**（⇒ 旧收藏 404，登记 `docs/OPEN-ITEMS.md` `F11`）；**④ 导航删「社区奖励」**（桌面左 nav ⇒ `[社区任务, 市场]`）；**⑤ 奖励页与列表页合并**为同一个「闲置物品」列表页。**⇒ 新增 §15 + 规则 `T87..T90` + `N32..N34`**。**本册 v1.10 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（实现由 Kong 同轮落地）。**★ 改前快照** = `docs/versions/design-system.spec.v1.9.md`（`cmp=0`；md5 `33bae5270240d544443d9c88afd42401`；1296 行 / 259,082 B）。
> **★ 现行版 = v1.11（2026-10-11 · 小补丁单 · 三处口径按实情对齐 + 一条新可复用教训）**：**① `T89` 筛选口径就地更正** —— 由「分类筛选**仅在后端读口可筛**才留（否则**整块删**）」改为「**能筛才留（服务端或客户端侧，依据已取回的字段）**」；依据 = **Kong 实测**：`GET /api/prize/all`（`backend-ts/src/index.ts:535`）的**返回字段**含 `points` / `gift_limit` / `time_end`，且 `GET /api/prize-item`（`index.ts:880`）给**已兑换集** ⇒ **客户端侧筛可行** ⇒ **三档分类筛选均保留**（限量版 `limited` / 高价值 `points>5000` / 已兑换）；改前字面逐字见 §15.4。**② §15.2 新增 C 段 · 四语键集新基线回写** = **顶层 `127` / 拍平 `1053` / 四语节点 `4212`**（**Kong 实测 · 工作区、未提交**；`4212 = 1053 × 4` 自洽；待提交后若有变再更正留痕）。**③ 登记「reward 文案键保留」裁定** —— `common.claimReward` / `claimRewardModal.*` / `rewardCard.claimNow` **保留**（仍被 `TaskPage` / `ClaimRewardModal` / `RewardCard` 消费，删则**渲染裸键名**）⇒ 口径 =「**reward 概念已从前端用户路径移除；已退役的领奖面文案键保留，登记为待清理（`docs/OPEN-ITEMS.md` `F13`）**」（见 §15.2 B′）。**④ 新增可复用教训 `N35`** —— **源码 / 测试注释里不得写「路径尾部 + 块注释起始二连」的通配路径字面**（正解 = 改写为 `/api/prize/…` 这类 `…` / `<x>` 形式；**不得去改剥离脚本**；见 §15.5）。**改动 = 版本头 + §12 + §15（`T89` 行 · §15.2 尾补注 + B′ + C · §15.4 · §15.5 `N34` 回写 + `N35`）**；**改前快照** = `docs/versions/design-system.spec.v1.10.md`（`cmp=0`；md5 `5bd7e1059da47acbcc4c313f195a7a0c`；1443 行 / 285,977 B）。**本册 v1.11 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。
> **★ v1.11 回写单（2026-10-11 · 与实现真相对齐 · Neng 判负 5 条登记类偏差 + 一条产品观察 · 逐字采用）**：**① D1 口径 =「消费点在场 ⇒ 保留」** —— §15.2 B 表标「删」的键**一律改判「保留」**（强删会渲染裸键名），**并新增 11 死键「待清理批次」**（`F13` · 本轮不删 · 一句话可改，见 §15.2 **B″**）。**② D2 `claimRetiredNotice`**：**实现保留且仍有消费点**（`frontend/src/components/ClaimRewardModal.jsx:86`）⇒ §15.3 **#13** 原写「随合并删除」**作废**（逐字留痕）。**③ D3 内部标识实际净减**：`data-sf-m="listing-*"` **唯一钩子 `46 → 39`**（丢 8 / 增 1）、`sf-listings*` 命中 **`159 → 141`**（唯一类仍 32）；首页改用 `home-*` 钩子 ⇒ §15.4 追加回写 bullet + 修正 `T89` 的 `listing-feed-layout` 锚点（已不存在）。**④ D4**：`/item` 无 id ⇒ `Navigate` 首页（姊妹册 `route-layer.spec` v2.28 **§38.1 #1** 就地更正）。**⑤ D5**：积分展示**仅登录态渲染**（未登录整块不渲染）= **已知口径（非缺陷）**（`T88` 补注）。**＋ 产品观察**：三档分类筛选在「当前真实数据」下均为空列表（`N36` / `F14` · 一句话可改）。**改动 = 版本头（本行）+ §15.2 B 注 + **B″（新）** + §15.3 #13 + §15.4 + `T88`/`T89` + §15.5 `N36`**；**改前快照** = `docs/versions/design-system.spec.v1.10.md`（`cmp=0`；md5 `5bd7e1059da47acbcc4c313f195a7a0c`）；**现版 md5 `fdfa2380e6472ac8c9cae6174175b20a`（1470 行 / 296,246 B · 回写前）**。**本册 v1.11 回写未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。**基线 = HEAD `54f906c`（实现 commit `8e136b9` + `54f906c`）。**
> **★ 现行版 = v1.12（2026-10-11 · Kevin 四条新裁定 · 逐字采用）**：**① `F13` 死键清理已批准（→ 执行中）** —— 11 死键（`reward` · `rewardsList` · `tasksToClaimReward` · `chooseReward` · `confirmChooseReward` · `successClaimReward` · `common.loadingRewards` · `homePage.noRewards` · `homePage.rewardAlreadyClaimed` · `homePage.rewardOutOfStock` · `claimRewardModal.loadProgressFailed`）**四语同删** ⇒ **键集基线将再次变化**；**新基线由 Kong 实测、Jing 现取回写（不得拄推定值）**。**② `F10` 内部标识一并改名（→ 执行中）** —— `sf-listings*` → `sf-item*`、`data-sf-m="listing-*"` → `data-sf-m="item-*"` ⇒ **`F10` 由「待统一」改「已执行（待 Kong 交读数）+ 几何零变化判据」**（判据形同 §13「桌面档不动 / 归因式判据」）。**③ 补 catch-all 提示页（新裁定）** —— **内层 `<Routes>` 末位新增 `<Route path="*">`**（**不得动外层 `LangShell` 的 `/*` 机制**）；**新增 3 个 i18n 键 × 四语（非 zh 待复核）**；**口径 = 旧路径命中的是提示页、而不是白页** ⇒ **修正 §15.4 `N32` / `F11` 的「硬删后白页」**（**`F11` 改「已由 catch-all 提示页收口（非重定向，仍不是 301）」**）。**④ 主题图标语义（`T41` 口径）** —— **图标 = 将要切到的档位**（日档显月亮 / 夜档显太阳）；Kevin 反馈**真机逻辑正确、本地 H5 应反转** ⇒ **Kong 现取两处（桌面顶栏 / 移动面板）现状；本册只登记口径 + 「待 Kong 实测后回写一致性结论」（不预先断言哪处错）**。⇒ **新增 §16 + 规则 `T91..T92` + `N37`**；姊妹册 = `docs/route-layer.spec.md` **v2.29 §39**（catch-all 路由登记 + 路由总数现取）。**改动 = 版本头（本行）+ §12 + §16（新）**；**改前快照** = `docs/versions/design-system.spec.v1.11.md`（`cmp=0`；md5 `e929fb7f1aa0a4cb082dda51561158fe`；1494 行 / 304,333 B）。**本册 v1.12 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（实现由 Kong 同轮落地）。**现取基线 = HEAD `ecbefd1`。**
> **★ 现行版 = v1.13（2026-10-12 · 回写单 · 与实现真相对齐 + 真机诊断定案 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① 键集新基线回写（§16.2 / §17.1）** —— **顶层 `122` / 拍平 `1045` / 四语节点 `4180`**（`= 1045 × 4` 自洽；**Jing 现取**，逐文件 `len(json)` = 顶层 / 递归叶 = 拍平 / `×4` = 四语节点；改前 `127/1053/4212`）。**算式闭合** = 拍平 `1053 − 11`（删 `F13` 死键）+ `3`（增 `notFound.*`）= `1045`；顶层 `127 − 6`（删顶层死键族）+ `1`（增 `notFound`）= `122`。**② `F10` 内部标识改名收口（§16.3 / §17.2）** —— `sf-item*` 命中 **`144`** / 唯一类 **`33`**；`data-sf-m="item-*"` 唯一钩子 **`39`**；**残留 `sf-listings` = `0`**；**几何零变化判据已交** = `/item/1` **8 元素 × 390/1440 = 16 个 rect 逐值相同**。**③ `F13` 死键清理收口（§16.3）** —— 11 死键四语同删（**已执行**）。**④ 真机诊断定案（§17.3）** —— 手机（Xiaomi MiuiBrowser / Android 14 / Chrome 135）实站内 `html[data-theme]=dark` · `.sf-shell` 背景 `rgb(11,12,14)` · `--sf-page-bg: #0B0C0E` · 父页 `prefers-color-scheme` = **false** · **色卡 9/9 回读精确（含 `#FDE815 → rgb(253,232,21)`）** ⇒ **`F7` / `N26` / `N31` 一族由「待查」收口为「已定案」**：手机上是**本站夜档**（`localStorage theme=dark`，**按 origin 隔离**）+ **屏幕渲染忠实** ⇒ **「浏览器强制深色」与「色域/屏幕」两假设均被排除**。**⑤ 新观察 `N38`（§17.5）** —— 同源 iframe 与父页的 `matchMedia('(prefers-color-scheme: dark)')` 可**出现相反读数** ⇒ **不得拿父页该值推断 iframe 内站点主题**；判站点主题只看站内 `html[data-theme]` / `.sf-shell` 背景色。**⑥ `/item/999999` 口径（§17.4 · 姊妹册 `route-layer.spec` v2.30 §40）** —— 不存在的 id 走**详情页内空态**（「关联单据不存在」+ 返回列表），**不并入 catch-all 提示页**；登记为**已知口径（非缺陷）**。**改动 = 版本头（本行）+ §12 + §13.6 `N26` 就地注 + §14.8 两处就地注 + §16.2 / §16.3 / §16.5 回写 + §17（新）**；**改前快照** = `docs/versions/design-system.spec.v1.12.md`（`cmp=0`；md5 `448f038e79a071347fbb7e5573040e1d`）；**本版镜像** = `docs/versions/design-system.spec.v1.13.md`（`cmp=0`）。**本册 v1.13 只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `d2ad4ef`。**
> **★ 现行版 = v1.14（2026-10-12 · Kevin「主题初始默认跟随系统」裁定落册 + catch-all 提示页上线回写 + `/item/999999` 依据补记 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① 新规则 `T93`（§18.1 · 三级优先序逐字落册）** —— **① 用户显式选择**（`localStorage['theme']`，仅由顶栏/面板的主题开关写入）＞ **② 首次访问跟随系统** `prefers-color-scheme`（由 `frontend/index.html` 内联脚本在 React 渲染前设 `data-theme`，**不落盘** ⇒ 系统后续变化仍可跟随）＞ **③ 默认日档**（拿不到系统偏好 ⇒ `day`）；**`matchMedia` 只允许出现在 `frontend/index.html` 内联脚本**，**不得进入 `src/theme/**` / `src/shell/**` 的 JS**（既有硬断言 `theme-shell-isomorphism.test.jsx:205-213` 一字不动维持）；**`ThemeProvider.readInitialTheme()` 的取值顺序不变**（`data-theme` 属性 > `localStorage` > 默认）⇒ 跟随系统自然生效。**② 配套两条（§18.1）** —— **初始应用不落盘**（初次挂载只设 `data-theme`；仅用户显式切换才写 `localStorage`）＋ **无 `matchMedia` 可用（旧 WebView / 异常）⇒ 回退日档、不得抛错**。**③ catch-all 提示页 = 已实现 · 已上线（§18.3 + §16.2 / §16.5 就地注）** —— Kevin 裁定字面「**已上线（`NotFoundPage`，四语 12 例实测，旧路由不再白壳）**」；现取 = 组件 `frontend/src/pages/NotFoundPage.jsx` + `App.jsx:145` `<Route path="*">`（commit `d2ad4ef`；`origin/main == HEAD` ⇒ 已 push）。**④ `/item/999999` 依据补记（§17.4 行后就地注）** —— route 册（v2.30 §40.1）与本册 §17.4 上轮均已记 ⇒ 本版只补**依据行**（「详情页内空态带上下文更精确，且非空白」；口径一字未改）。**⑤ 主题章就地注三则（§6 表后）+ §18 现取边界（§18.2）** —— 真机诊断定案补记（**Kevin 已确认切日档正常；夜档 = 该 origin 存储的显式选择，非浏览器强制深色**）；`T42` 键名册面 `sea.theme` 与实现 `theme` 出入、`T43` 的 `theme.js` `matchMedia`/`change` 机制**均以 `T93` 为现行口径**（原行一字未改）。**⑥ `docs/OPEN-ITEMS.md` 新增 `F16`**（T93 实现与验收挂账）。**改动 = 版本头（本行）+ §12 + §6 表后一处就地注（含 `T42`/`T43` 两则）+ §16.2 / §16.5 两处就地注 + §17.4 依据补记 + §18（新）**；**改前快照** = `docs/versions/design-system.spec.v1.13.md`（上轮 v1.13 本版镜像原件；本单开工复核 `cmp` = **0**；md5 `b6e3685e84441ef582b73f1cbf012d9c`；1615 行 / 336,436 B）；**本版镜像** = `docs/versions/design-system.spec.v1.14.md`（落笔后建，`cmp=0`）。**本册 v1.14 只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `07a3927`（origin/main 同步；工作区另有 Kong 同轮改动 `frontend/index.html`，非本单写面，本册按「现取 = HEAD + 已知工作区」如实分列）。** **★ 复跑（本单收笔前）：现行 HEAD = `bb55925`（Kong 内联脚本单已提交）—— 上列「工作区改动」表述为现取时点状态，随之关闭。**
> **★ 现行版 = v1.15（2026-10-12 · Kevin「`/item/:id` 详情页 UI 改造（变体 A = 闲鱼结构 × 本站主题）」拍板 · 五条逐字采用 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① 新规则 `T94`（范围 + 渲染面白名单）** —— 只改 `/item/:id`；**只渲染** 价格行 / 大标题 / 详情面板（渐变占位图 + 描述 + 库存 + 数量输入）/ 底部固定操作栏（**仅「立即购买」一个 CTA**）/ 页内顶栏返回箭头 / **既存** `.sf-item-note`；**一律不渲染** 卖家信息行 / 属性两列 / 集市横幅 / 划线原价 / 比市场价 / 包邮 / 想要·浏览计数 / 留言 / 收藏 / 聊一聊（判据 = **无数据承载不渲染**；`GET /api/prize/:bID` 现取**无** owner/seller、无 media_urls、无品牌/成色）。**② 新规则 `T95`（隐藏底栏机制 · 二选一裁死）** —— **采纳「DOM 恒在 + 页面级 `display:none`」**：`BottomTabBar` **恒渲染** `<nav class="sf-tabbar">` 与**全部 5 个** `<a data-sf-nav>`；**仅** `pathname` 命中详情路由时追加 **`is-detail`** 修饰类（状态挂点 = `frontend/src/shell/BottomTabBar.jsx`，其**已有 `useLocation()`** ⇒ 只加**路由串匹配**，**不得**引入宽度判定）；隐藏规则落 **`frontend/src/styles.css` 顶层**（`.sf-tabbar.is-detail{display:none}`；**不入 `@layer` / 不入 `@media`**；**`shell.css` 一字不动**）⇒ **五 region 断言零改动**（`theme-shell-isomorphism.test.jsx:80-81`/`:89`/`:106-107`/`:120-122` · `v15-nav-floatmenu.test.jsx:228`/`:109`）；**否决 DOM 移除**（会红 6 处同构断言 + 拆掉「同构 ⇒ DOM 恒在」硬核）。**③ 新规则 `T96`（可达性硬 AC）** —— **页面内顶栏 = 返回箭头（`‹`）**，**不加搜索框**；**返回目标裁死 = 固定回首页 `root('/')`**（**否决 `history.back()`** —— 深链 / 刷新时 history 无站内上一页）；**a11y 名复用既有键 `t('item.list')`**；**触控复用既有 `.sf-tap-sq`**（≤767 档 ≥44×44）。**④ 新规则 `T97`（桌面档）** —— 桌面底栏本就 `display:none` ⇒ 详情页导航不受影响；**操作栏 ≤767 = `fixed` 独占底部 / >767 = 留在内容流**（页面文件 `item.css` 内，`shell.css` 不得新增 `@media`）。**⑤ 新规则 `T98`（结构常量落点）** —— **零新主题 token**（`TOKEN_KEYS` 一字不动）；确需新增的**结构常量一律落 `item.css` 的页面局部 `--sf-l-*`**（**不得进 `tokens.js` 的 `STRUCT`** —— `STRUCT_PROV` 带**溯源硬门**：值须回读 `docs/design/style-preview.html` 行号，本单无新真源块）：`--sf-l-detail-price-size`(28px) · `--sf-l-detail-title-size`(18px) · `--sf-l-actionbar-h`(60px) · `--sf-l-actionbar-safe`(`env(safe-area-inset-bottom)`，与 `shell.css:72` 同形复刻)；**CTA 胶囊半径复用既有 `--sf-st-radius-pill`(999px)**。**⑥ 新规则 `T99`（视觉口径 + 映射表）** —— 参考图元素 → 既有槽位**逐项映射**（§19.4）；**未被映射的元素一律不渲染**；**CTA「黄底深字」逐字命中既有 `.sf-btn`（`--sf-btna-bg #FFE60F` / `--sf-btna-fg #202020`）⇒ 零新颜色**；**可见文本 ≥12px**（`T79` 不破）。**⑦ i18n 零新增 / 零删除** ⇒ 键集 **顶层 122 / 拍平 1045 / 四语节点 4180 逐字不变**（回退 a11y 名与 CTA 文案**全复用既有键**；去刷新按钮后 `item.refresh` 键**保留**、登记为键卫生项，**非死键清理对象**）。**⑧ 两条新教训 `N39`/`N40`** —— `N39` = 页面源码 / CSS 新增注释**禁写「`/*` 收尾的路径字面」**（吞码引信 · 承接 `N35`）；`N40` = **页面级隐藏共享外壳元素的口径**（DOM 恒在 + 路由条件修饰类 + 全局 CSS 顶层 · 具体性压过断点块）。**⑨ 留痕（§19.10）** —— **就地收窄 `T46`/`T80` 的「底栏恒 5 格」，仅限 `/item/:id`**；**其余页面逐字照旧**；`T86`（汉堡排除集 `['exchange']`）/ `T75`（`viewport-fit=cover` 安全区）**逐字不变**。**⑩ 三条待裁 `Q1`–`Q3`（§19.11 · 不得自选）** —— 聊一聊 = 站内信 vs 站外 Telegram · CTA 胶囊圆角（`radius-pill` vs `radius-btna`）· 大号价格字号（28px vs 32px）。**改动 = 版本头（本行）+ §12 + §19（新）**；**改前快照** = `docs/versions/design-system.spec.v1.14.md`（本单开工复核 `cmp` = **0**；md5 `7e67f2cdd95417502148bdff74ee95a2`；1673 行 / 354,073 B）；**本版镜像** = `docs/versions/design-system.spec.v1.15.md`（落笔后建，`cmp=0`）。**本册 v1.15 只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit · 未 push**（实现 / 验收归 Kong / Neng）。**现取基线 = HEAD `a111b45`（2026-10-12）。**
> **★ 现行版 = v1.16（2026-10-12 · 回写单 · `/item/:id` 详情页 UI 改造（变体 A）实现真相回写 = Zang 六条终审裁定 `R-A`–`R-F` 入册 + `Q2`/`Q3` 已裁 + 白名单/AC-2 判据补齐 + `N41`/`N42` 两条教训 + `§17.4` 钩子就地更正 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**依据 = 质检报告 `docs/qa/v115-item-detail-qa.md`（verdict = **PASS** · `spec_drift` 清单）+ 实现 commit `2aee62f`（本地 · 未 push）**。**① 新增 §19.13 = 六条裁定逐条入册**（`R-A` 三键折进 `.sf-item-meta-group` · `R-B` CTA 胶囊 999px 落 `.sf-btn.sf-item-cta` · `R-C` 大号价格 32px + 320 档硬门 · `R-D` ≤767 详情页等量底部内边距 · `R-E` 详情页限 `:has()` 页脚补齐 · `R-F` `item.buyNote` 保留渲染）。**② §19.11 `Q2`/`Q3` 就地回写为「已裁」**（旧「待裁」字面逐字保留 + 标「已被 §19.13 `R-B`/`R-C` 取代」）。**③ §19.4 末表值更正** `--sf-l-detail-price-size` **28px ⇒ 32px**（28px 降为「320 溢出则回落」备值 · 旧字面逐字保留）。**④ §19.5 白名单 + §19.8 AC-1 判据补齐**（白名单由六项扩为「六项 + `R-A` 三键 + `R-F` buyNote」⇒ 否则按旧字面判会误判为负 · 质检已实测）。**⑤ §19.8 AC-2 href 字面集改锚**（实现产出无尾斜杠 = `/`、`/en`、`/hk`、`/vn` ⇒ 改字面或明文注明「忽略尾斜杠」，登记该字面差异非缺陷）。**⑥ §19.14 = `R-D` 与 `R-E` 判据分离**（`R-D` = 机械量「≤767 文档高 +60px」；`R-E` = 内容级遮挡 `lastLeafOverlapPx` 29→0 且 `lastLeafCovered` true→false · 只在固定档〔`position:fixed`〕判定；**`footCoveredPx` 是无效判据**）。**⑦ 新增教训 `N41`**（跨文件同具体性覆盖 · 页面级形状修饰须在选择器上取胜 · 判据 = `border-radius` 计算值）。**⑧ 新增教训 `N42`**（证据入库 vs `.gitignore` · `git add -f` 属已登记口径 + `check-ignore`/`ls-files` 两读数）。**⑨ §17.4 就地更正 + 快照口径声明**（`data-sf-m="item-back-link"` 过期 ⇒ 实现改名 `item-back` + 新增 `item-actionbar`；`docs/versions/` 旧快照一字不改，属历史）。**⑩ §19.12 诚实清单更新**（真机 `env(safe-area-inset-bottom)` · `:has()` 非 Chrome 渲染 · mock 数据面 ⇒ 三项 `NOT_MEASURED`，引质检 `not_measured`）。**改动 = 版本头（本行）+ §12 + §17.4 就地更正 + §19 就地追加（§19.4 更正注 · §19.5 白名单注 · §19.8 AC-1/AC-2 注 · §19.9 `N41`/`N42` · §19.11 已裁注 · §19.12 更新 · 新增 §19.13/§19.14）**；**改前快照** = `docs/versions/design-system.spec.v1.15.md`（本单开工复核 `cmp` = **0**；md5 `910494eb9c290bbb8bf745f33bc67891`）；**本版镜像** = `docs/versions/design-system.spec.v1.16.md`（落笔后建，`cmp=0`）。**本册 v1.16 只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `2aee62f`（本地 commit · 未 push；本册设计面真源 = v1.15 md5 `910494eb9c290bbb8bf745f33bc67891`）。** **★ 复取（本单收笔前 · 现取）**：现行 HEAD = **`203cf9a`**（同批：`4f69080` = 质检件 `docs/qa/v115-item-detail-qa*` 入库〔Neng · 钉 `2aee62f`〕+ `203cf9a` = `docs/OPEN-ITEMS.md` 就地更正 F15/F10）；**均未 push**（`origin/main...HEAD = 0 / 5`）；**这批 commits 未触及设计面** ⇒ 本册引用真源仍为 v1.15（`HEAD:docs/design/design-system.spec.md` md5 复取 = `910494eb9c290bbb8bf745f33bc67891`）。
> **★ 现行版 = v1.17（2026-10-12 · Kevin「直接 A+C」= 站内信最小闭环 + Telegram bot 绑定/通知一步到位 · §19.11 `Q1` 已裁 + 底部操作栏第 3 格「聊一聊」激活 + `/messages` 占位页转真页 + Settings 绑定/解绑面 + 未读角标 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① `Q1` 已裁 = 站内信（A）+ Telegram bot 通知/绑定（C）并行**（§19.11 就地注；route v2.27 §37「X/推特私信接驳位预留」语义作废 ⇒ **Telegram，非 X**）。**② 新规则 `T100`（聊一聊激活）** —— `/item/:id` 底部固定操作栏**第 3 格**（§19.5 挂点激活）渲染「聊一聊」CTA；**渲染条件 = 登录 ∧ 非卖家本人**（卖家本人不渲染，Zang 结构 2；未登录 = 既有登录引导）；点击 = `POST /api/messages/conversations`（自然幂等）后进入该商品会话（route 契约 = v2.31 §41.2 #1/#2）。**③ 新规则 `T101`（`/messages` 真页形态）** —— 占位页转真页：会话列表态 / 会话详情态 / 输入区三态 + keyset「加载更多」+ 空态；**占位区块删除**（钩子 `messages-x-placeholder` + 键 `xPlaceholder`/`xNote` 四语同删，`F13` 体例）。**④ 新规则 `T102`（Settings 绑定/解绑面）** —— `ProfilePage`（我的）新增「Telegram 通知」卡：三态（未配置降级 / 未绑定 / 已绑定）+ 绑定码展示与步骤 + 解绑；env 缺 = 降级卡（`503 TG_NOT_CONFIGURED` 形态，route v2.31 §41.9）。**⑤ 新规则 `T103`（未读角标）** —— 底栏第 4 格（`messages`）+ 桌面悬浮菜单消息项双挂点；**取数口径 = 挂载时 + 发送成功后 + 进入 `/messages` 后**，**无轮询**（一句话可改）；`unread_total` 真源 = `GET /api/messages/unread-count`；`>99` 封顶显示 `99+`。**⑥ i18n = +35 新键 / −2 删键（四语同补同删）** ⇒ 键集 **顶层 `122 → 123` / 拍平 `1045 → 1078` / 四语节点 `4180 → 4312`**（算式见 §20.8；12 文件计数断言前推，§20.7）。**⑦ 零新主题 token / 零 `STRUCT` 增项**（`TOKEN_KEYS` 一字不动；新结构常量走页面局部 `--sf-l-*`，承 `T98` 体例）。**⑧ 新教训 `N43`**（预留槽位激活时必须同步回收占位键/占位钩子，防「占位常驻」）。**⑨ 姊妹册** = `route-layer.spec` **v2.31 §41**（10 条路由 + 12 新错误码 + 注册点 89→99）+ `data-layer.spec` **v0.32 §38**（两表 DDL + `users` +2 列）。**改动 = 版本头（本行）+ §12 表 v1.17 行 + §19.5 / §19.11 两处就地注（原地正文一字未动）+ §20（新）**；**改前快照** = `docs/versions/design-system.spec.v1.16.md`（本单开工复核 `cmp` = **0**；md5 `0400a3d9bbcc38b22cae0190b658c8ee`；1923 行 / 422,501 B）；**本版镜像** = `docs/versions/design-system.spec.v1.17.md`（落笔后建，`cmp=0`）。**本册 v1.17 只写 `docs/**`；未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit · 未 push**（实现 / 验收归 Kong / Neng）。**现取基线 = HEAD `3ae743e`（2026-10-12）。**
> **★ 现行版 = v1.18（2026-10-12 · Jing 微回写单 · v1.17 §20 两处自相矛盾裁定更正 + `T101` 删钩子引致的断言改锚登记 · 只追加 + 就地更正留痕（旧字面逐字保留 + 标「已被 v1.18 取代」）· 本单只写 `docs/**` + 快照 / delta · 不改代码、不改台账 / 挂账）**：**依据 = Kong 停手上报的 §20 两处自相矛盾 + Kevin/Zang 亲核实测裁定（以实测为准，见 `frontend/src/locales/*.json` 现取）**。**① §20.8 顶层键数算式更正（现取 顶层 `125` / 拍平 `1078` / 四语节点 `4312` · 四语逐文件相等）** —— 原算式「顶层 `122 + 1`（新顶层命名空间 `telegram`）`= 123`」**漏计另两个新顶层错误域 `msg`（`msg.err.MSG_*` **7 键**）与 `tg`（`tg.err.TG_*` **5 键**）** ⇒ **现行算式 = `122 + 3`（`telegram` + `msg` + `tg`）= `125`**（拍平 `1078` / 四语节点 `4312` 原写**正确、不变**）。**★ 键名不得改** —— 必须保持 `msg.err.*` / `tg.err.*`（与后端**已 commit** 的 `i18n_key` 字面对齐，改键名会破坏对齐）。**② §20.3 判据表 + §20.9 `AC-1` 未登录口径更正（以 §20.2 `T100` 为准）** —— 两处原写「未登录 ⇒ **不渲染**第 3 格 / 未登录可见该格 ⇒ 判负」，与 `§20.2`「未登录 ⇒ 点击走登录引导」（隐含渲染）**互斥** ⇒ **裁死**：**卖家本人 ⇒ 不渲染**；**未登录 ⇒ 渲染且点击走既有登录引导（不 `disabled`）**；**登录且非卖家 ⇒ 正常进会话**；`AC-1` 判负项改为与三态自洽（**未登录就应看到第 3 格**；**只有卖家本人看到第 3 格才判负**）。**③ 登记 `T101` 显式删除项引致的断言改锚** —— `T101` 删 `messages-x-placeholder` 钩子 + `messagesPage.xPlaceholder` / `xNote` 两键（四语）⇒ 引致 `frontend/src/test/unit/v15-nav-floatmenu.test.jsx:243-251` 断言**必红**（现取实测仍断言旧钩子共存）⇒ **改锚 = 占位钩子计数归 0 + 真页钩子在场；属显式删除项引致的合法前推、非语义放宽**（由 Kong 并行单执行）。**改动 = 版本头（本行）+ §12 表 v1.18 行 + §20.3 / §20.7 / §20.8 / §20.9 / §20.12 / §20.13 就地更正 / 登记注（原地正文一字未动）**；**改前快照** = `docs/versions/design-system.spec.v1.17.md`（本单开工复核 `cmp` = **0**；md5 `f0d8e248b791330bf1e45ba5cdfba084`；2078 行 / 450,138 B）；**本版镜像** = `docs/versions/design-system.spec.v1.18.md`（落笔后建，`cmp=0`）。**本册 v1.18 只写 `docs/**`；未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit · 未 push**（实现 / 验收归 Kong / Neng）。**现取基线 = HEAD `680fc2a`（2026-10-12）。**
> **★ 勘误（2026-10-15 · 文案表同步 · 勘误级不升版）**：**依据 = Kevin 2026-10-15 裁定**（Telegram 通知由「不带消息内容」⇒ **带消息开头预览 = 首 6 个显示宽单位**；同裁定权威落点 = 姊妹册 `docs/route-layer.spec.md` v2.33 §41.7 勘误留痕）+ **实现现盘只读现取** `frontend/src/locales/{zh,en,hk,vn}.json`（commit `c804ef1`）。**① §20.8 键清单 `telegram.desc` 行四语文案就地同步** —— 旧口径「不包含消息内容」（四语同族）**作废** ⇒ **现行四语逐字** = zh「绑定后，收到新消息会通过 Telegram bot 提醒你（含消息开头摘要）」/ en「Get Telegram bot reminders for new messages (includes a preview of the message opening)」/ hk「綁定後，收到新消息會通過 Telegram bot 提醒你（含訊息開頭摘要）」/ vn「Nhận thông báo qua Telegram bot khi có tin nhắn mới (kèm trích đoạn đầu tin nhắn)」（**改前字面逐字保留** = §20.8 表后勘误留痕）。**② 同口径就地加注** = §20 裁定映射表 `Z3/Z4` 行「通知双语一行不带内容」（`:1944`）+ §20.11 待裁项 2「通知双语一行」（`:2080`）—— 旧字面逐字保留、标「已被本勘误取代」。**③ 不升版依据** = **勘误级 · 非新批次 · 零新增契约面**（无新路由 / 错误码 / 表 / 文案键；**值变更 1 键**、键计数 `125 / 1078 / 4312` 逐字不变）；承姊妹册 route 册 v2.33（同日 · 同裁定）「勘误级就地改，不升版」先例 + 本册 v1.11「回写单」先例。**④ 快照边界（诚实）** = **本单未重制 / 未触碰 `docs/versions/**` 任何快照**（上级单明令禁止）：`docs/versions/design-system.spec.v1.18.md` 保留勘误前字面 = **历史**；**现行口径以本册 live 正文为准**（与 route 册 v2.33「快照同步重制 `cmp=0`」做法**不同**，差异如实登记）。**⑤ 本册本单只写 `docs/**`**；未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit 时写入并行单在改面 · **未 push**。**现取基线 = HEAD `a280afe`**（本单开工时点；`frontend/src/locales/*.json` 只读现取）。
> **★ 现行版 = v1.19（2026-10-16 · Kevin「消息面板化（方案 1 · 就地叠加）」逐字裁定 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① 消息不做独立页面** —— `/messages` 由 v1.17 `T101` 的**独立真页** ⇒ **内嵌在其它页面内部的面板**：打开消息时**原有页面向左压缩**、页面整体右侧留出 **`600px`** 呈现消息界面；**② 面板内部 = 左「各联系人选择（侧边栏）」/ 右「对话窗口」**；**③ 面板外部的右侧 = 当前悬浮按钮面板**（**不遮挡、零几何改动** = 既有 `.sf-fm`，`T81`–`T83` + §14.2 一字不动）；**④ 打开方式 = 不换页** —— 给**当前路由**加查询参数 **`?msg=1`**（可带 **`&c=<conversation_id>`**），当前页**原地左压**、**挂载态与滚动位置保留**；**⑤ `/messages` 路由保留**为**直链落点**（Telegram 通知链接 / 旧链）= **首页 + 面板**（同一面板，底 = 首页）；**⑥ 关闭** = **移除 `msg`/`c` 查询参数**（`replace` 保当前页）+ 面板内**左上「×」**；**浏览器后退键天然关面板**。**★ 四入口全集（全部要保、全部不改 `href`）** = 底栏第 4 格 · 悬浮菜单「消息」· 详情页「聊一聊」· Telegram 通知里的 `/messages` 直链。**⇒ 新增 §21 + 规则 `T104`–`T108` + 教训 `N44`/`N45`**（**几何冻结表** = 面板 `600px` / 右偏移 `104px` / 让位 `704px` / 左栏 `240px` / 右栏 `360px` / 全高 `fixed`；`≤767` = 全屏 + 单栏两态，**零断点值新增**）。**本册 v1.19 未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；未启停任何服务（绝不 `pm2 restart`）；未 `git add -A` · 未 commit · 未 push**（实现 / 验收归 Kong / Neng）。**改动 = 版本头（本行）+ §12 表 v1.19 行 + §20.2 表后一处就地注 + §20.4 末一处就地注（原地正文一字未动）+ §21（新）**；**改前快照** = **现盘 live 正文**（`md5 49b2ebb1cae59d6409b2d3f70e8d9cbf` / 2100 行 / 467,793 B；**`docs/versions/design-system.spec.v1.18.md` 对现盘 `cmp` ≠ 0**（`char 38020, line 19`）—— 该快照为 **2026-10-15 勘误前**历史、其自述「未重制 / 未触碰 `docs/versions/**`」⇒ **本单不重制、不触碰它**）；**本版镜像** = `docs/versions/design-system.spec.v1.19.md`（落笔后建，`cmp=0`）。**现取基线 = HEAD `fd34ca0`（2026-10-16 · 工作区干净）。** **姊妹册** = `docs/route-layer.spec.md` **v2.34 §44**（`/messages` 语义变更 + `?msg=1` / `&c=` 查询参数口径 + 四入口保全 + **两计数不变**：前端 `<Route` 字面 `42` / 精确 `34`、后端注册点 `105`）。
> **★ 现行版 = v1.20（2026-10-17 · Kevin「首页商品卡片 UI」逐字三条 + Zang 已裁定口径 `Q1`–`Q3` · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① Kevin 原话** = 「背景色不要用黄色，黄色可以用在顶部菜单栏。」/「严格按照参考图调整 货币符号和金额 处的 UI 设计。其它部分的 UI，请你酌情处理。」/「整张卡片可点击，而不是只有按钮可点击。」**⇒ 新增 §22 + 规则 `T109`–`T113` + 教训 `N46`/`N47`**：**② `T109` 底色分层**（**新增主题 token `--sf-surface-bg`** 日 `#FFFFFF` / 夜 `#101114`；**`--sf-page-bg` 日档 `#FDE815` ⇒ `#F5F7F9`**、夜档 `#0B0C0E` **不变**；**`--sf-topbar-bg` 日档保持 `#FDE815` = 黄色唯一落点**；`.sf-shell` 继续 `var(--sf-page-bg)`、`.sf-route-container` **新增** `var(--sf-surface-bg)`、**`.sf-item-actionbar`（`item.css:349`）改挂 `var(--sf-surface-bg)`**；**零几何改动**）。**③ `T110` 价格块版式**（同行 flex + `baseline`；`$` → 数字；`$` 高 ≈ 数字 **75–80%**；数字大号加粗；**去外框 / 去底色 / 去内边距**；色用既有 `--sf-price-cur-fg`/`--sf-price-num-fg`/`--sf-price-unit-fg` ⇒ 参考图橙红 `#FF4D2E` **不采纳**；**参考图「小数位更小」规则不适用**〔积分恒为整数〕；**零新 token / 零 `STRUCT` 增项**）。**④ `T111` 范围收窄**（只改 `components/reward/RewardCard.jsx`；**详情页价格块 `item.css` 的 `.sf-item-price*` / `--sf-l-detail-price-size`(32px) 本单不动**；`ThemePreviewPage` 的 `.sf-price` 家族一字不动）。**⑤ `T112` 整卡可点击**（卡片根 = 单一 `<a>`，`href = buildLocalizedPath(lang,'/item/'+id)`〔`utils.js:115`〕；**卡内 `a|button|input|select|textarea` 计数 = 0** ⇒ CTA 降级非交互视觉胶囊、保留文案键 `item.viewDetail` 与钩子 `reward-card-view`；**不得引入 `.sf-btn` 族**〔`p6-btn-impl2.test.js:73-89` 的 11 文件冻结清单不含 `RewardCard.jsx`〕）。**⑥ `T113` 无 Router 回落契约**（裸渲染不得抛错、且不得产出 `<a href>`；既有用例 `i18n-batch-b2.test.jsx:154/158/170`）。**⑦ 真源追加块** = `docs/design/style-preview.html` **1044–1103 行**（`<section id="card-ui-ref-v120">`）+ **PROV 指针三处** = `page-bg.d ⇒ 1069` / `surface-bg.d ⇒ 1071` / `surface-bg.n ⇒ 1073`；**真源页改前 1042 行 / 86,638 B / md5 `13a845dacb6865ea3fa738663a63159c` ⇒ 改后 1103 行 / 93,949 B / md5 `7b8780af15802102f9ddf578510490a5`**（`git diff --numstat` = **`61 0`** 纯追加）。**⑧ i18n 零新增 / 零删除** ⇒ 顶层 `128` / 拍平 `1104` / 四语节点 `4416` **逐字不变**（2026-10-17 四语逐文件现取相等）；**不触发 §21.7 的 13 文件计数前推**。**⑨ 断言影响** = **真改锚 1 条**（`A4`：`tokens.js:266` 的 `page-bg.d` 指针 `200 ⇒ 1069` + 新增 `surface-bg` 的 PROV）+ **真改面 4 条**（`A1` `>$</span>` 恰 1 / `A3` 无 Router 不抛错 / `A5` `theme-tokens.css` 生成物同步 / `A7` 不得引入 `.sf-btn`）+ **新增硬契约 2 条** + **冻结面零改锚 11 条**（§22.7 清单 B）。**⑩ 勘误（本单取证）** = 派单称首页卡片价格块「外套一层黄底黑框胶囊（`.sf-price` 家族）」**与现取不符** —— 现取 `RewardCard.jsx:91-98` 为 Tailwind `text-yellow-600` + 数字/`$` **上下堆叠、无框无底**；`.sf-price` 家族唯一消费者 = `pages/ThemePreviewPage.jsx:152`（`item.css` 那族是**另一个**同名族 `.sf-item-price*`）⇒ **派单描述逐字保留 + 标「与现取不符」+ 口径按现取写**（§22.3 勘误 + `N47`）。**⑪ 待裁 `Q5`–`Q9`**（卡片底色纯白的落点〔现取 `variant='primary'` ⇒ `bg-yellow-50`，**派单落法清单未点名**〕/ hover 黄环 / 夜档 `#101114` 分层可辨性 / 容器宽 `1500px`〔现 `1440px`，一句话可改〕/ `$` 小号落点）。**改动 = 版本头（本行）+ §12 表 v1.20 行 + §22（新）**；**改前快照** = `docs/versions/design-system.spec.v1.19.md`（本单开工复核 **`cmp` = 0**；md5 `1ac3dc50c40cb15d409d008090d02e47`；**2355 行 / 517,050 B**）；**本版镜像** = `docs/versions/design-system.spec.v1.20.md`（落笔后建，`cmp=0`）。**本册 v1.20 只写 `docs/**` + `ops/ui-card-ref-20261017/readings/jing-*`；未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `ops/ui-card-ref-20261017/shots/**`；未启停任何服务；未 `git add -A` · 未 commit · 未 push**（实现 / 验收归 Kong / Neng）。**现取基线 = HEAD `d8cb98e`（2026-10-17 · 工作区仅多出未跟踪的 `ops/ui-card-ref-20261017/`）。**
> **★ 现行版 = v1.21（2026-10-17 · Kevin「顶栏实黄」逐字三项 + Zang 冻结裁定 1–6 · 只追加 + 就地留痕 · 本单只写 `docs/**` + 本单读数）**：**① Kevin 逐字三项**（顶栏 = 「B 顶栏实黄」· 移动档 = 「保持全白」· 上线时机 = 「先把顶栏定下来、改完再一并 push（含生产终验）」）。**② `T114` 日档顶栏 = 实黄不透明**（`backgroundColor` = `rgb(253,232,21)` 且 **alpha = 1**；`bg-opacity-95` / `backdrop-blur-sm` 必须失效；落点 = `frontend/src/styles.css` 顶层，**`shell.css` 一字不动**）。**③ `T115` 夜档顶栏冻结 `rgb(31,41,55)`**（`#1F2937` = 现 `dark:bg-gray-800`）⇒ 日档规则**必须**写成 `:root:not([data-theme="dark"]) …`（**不加限定会把夜档一并压成 `rgb(11,12,14)` · 本单实测**，见 §23.6 `N53`）。**④ `T116` 日档下边框** = **`var(--sf-topbar-border)`（`#030402`）**（**宽度保持现状 1px**；真源 `2px` 属几何变更 ⇒ 另裁）。**⑤ `T117` 日档顶栏内所有前景 ≥ 4.5:1**（大字 3:1）：**logo ⇒ `var(--sf-brand-fg)`** · **`.nav-link` 的 `:hover`/`.active` ⇒ `var(--sf-brand-fg)`** · **注册/登录 `hover:text-yellow-600` ⇒ `var(--sf-brand-fg)`**；**夜档前景维持现状**（由 `styles.css:146-147` 的 `!important` 两条保证 · **一字不得改**）。**⑥ `T118` 零新 token / 零 `STRUCT` / 零几何 / 零新 i18n 键**（三个槽位均已在真源与值表中存在 ⇒ **真源 `style-preview.html` 本单零改动**）。**⑦ `T119` 作用面 = 「全站顶栏面」**（`Header` 是全站共享外壳件 ⇒ 归因式允许变更集扩为顶栏面两项）；移动档顶栏同落实黄、**页面底保持全白**（≤767 满宽 ⇒ 灰页底不可见 = 已知事实）。**⑧ 现取对比度表** = §23.3 **14 行逐元素**（现状 vs 改后 · 阈值 · 判）+ **取数路径差登记**（夜档 `12.63`〔合成〕vs `14.68`〔未合成 · Zang 报值〕；logo `2.90` vs `2.94`；nav base `7.45` vs `7.56`）⇒ 教训 `N52`。**⑨ 断言影响** = **真改锚 0 条**（本仓**无任何测试锚定 `#header` 外观类**）· **真改面 3 条**（`.nav-link[href]` 集不得动 / 五 `data-sf-region` 恒等 / 落点不得越界到 `shell.css`）· **新依赖 2 条** · **冻结面零改锚 8 条**（§23.4）。**⑩ 归因式 AC** = §23.5 `AC-1`–`AC-10`（日/夜 × 390/1440/1600 顶栏像素 · 每前景 ≥ 阈值 · alpha = 1 · 不穿透 · **尺子灵敏度两向自证** · 零几何 · 移动档）。**⑪ 顺带勘误 / 发现** = 顶栏 `sticky` 声明**实际不生效**（含块高 = 顶栏高 ⇒ 随页滚走）· 移动面板在 `#header` 子树内且其 `bg-white` **继承 95% 语义** · **移动面板「登录」胶囊 = `2.80:1` ✗（既有 · 与顶栏底色无关 · 挂账）**；**待裁 `Q10`**（「移动档 = 保持全白」两读法）。**改动 = 版本头（本行）+ §12 表 v1.21 行 + §23（新）**；**改前快照** = `docs/versions/design-system.spec.v1.20.md`（开工复核 `cmp` = 0；md5 `6fa271687481dd69c70a5ce358b63dc5`；2646 行 / 607,188 B）；**本版镜像** = `docs/versions/design-system.spec.v1.21.md`（落笔后建，`cmp=0`）；**delta** = `docs/audit/design-system-v1.21-delta.md`；**证据** = `ops/ui-card-ref-20261017/readings/jing-v121-*`。**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `ops/ui-card-ref-20261017/shots/**`；未启停任何服务；未 `git add -A` · 未 commit · 未 push。**
> **★ 现行版 = v1.22（2026-10-17 · Kevin「`/item/:id` 操作栏 goofish 形态」裁定 · **本轮唯一新增 2 个颜色 token `--sf-cta-solid-bg` / `--sf-cta-solid-fg`** + 形态口径 **`T120`** · 只追加 + 就地留痕 · 本单只写 `docs/**` + `frontend/src/theme/**`（值表 / 生成物）+ 本单读数）**：**① token 增项（仅 2 键，日 / 夜成对反相）** —— `--sf-cta-solid-bg` 日档 `#202020` / 夜档 `#EDEFF2`、`--sf-cta-solid-fg` 日档 `#FFFFFF` / 夜档 `#0A0A0A`；**日档底色取站点既有 ink 家族 `--sf-btna-fg` 同值（不引入第二套墨色）**，**夜档必须反相**（夜档深页上深底会消失 ⇒ 亮底深字，亮底色值与 `--sf-title-fg` 夜档同源）。**其余全部复用既有 token、零新增**：`聊一聊` = `--sf-btna-bg` / `--sf-btna-fg`（日夜同值 `#FFE60F` / `#202020`）；`收藏` = `--sf-btnalt-bg` / `--sf-btnalt-fg` / `--sf-btnalt-border`（夜档自带反相）。**② `T120` 形态口径（§24）** —— 三段结构（组合条 2 段 + 留白 + 独立收藏）· 组合条内部占比 `聊一聊 58% / 立即购买 42%`（±1 个百分点）· 组合条与收藏**留白 > 0** · **两端半圆 + 中缝直角**（中缝 4 角 = 0）· 收藏 = 独立胶囊 · **两档几何逐值相等**（颜色以外不进主题层）· 几何常量落页面局部 `--sf-l-*`（承 `T98`，**不进 `STRUCT`**）。**③ 四处同动读数** —— 真源 `docs/design/style-preview.html` **尾部纯追加** `<section id="item-actionbar-ref-v122">`（1103 行 / 93,949 B / md5 `7b8780af15802102f9ddf578510490a5` ⇒ **1172 行 / 102,653 B / md5 `a17919a495f4bd03bdf2434df8013753`**；`numstat = 69 0`）；`tokens.js` 两档键 **110 ⇒ 112**（新键同索引 `107` / `108`，`orderEqual = true`；`numstat = 12 0`）；`PROV` 新指 **1130 / 1133 行**；`theme-tokens.css` **用既有生成器重生成**（先跑零漂移自证 `cmp = 0`）8,155 B ⇒ **8,275 B**（`numstat = 4 0`）。**④ 断言影响 = 零计数常量前推（写死）** —— 仓内 token 计数断言全为**下限 / 包含**式（`theme-tokens.test.js` `>=100`、`p6-btn-impl.test.js:85` `>=106`、`p6-btn-impl2.test.js:127` `toContain`），等值断言只有「两档键集与键序相同」由实现自身满足 ⇒ **本单未改任何测试文件**（§24.4 A1–A8）。**⑤ 未动面** —— `frontend/src/pages/item/**` / `ItemDetailPage` / `shell.css` / `data-sf-region` 集合 / `--sf-l-actionbar-h`(60px) / 任何既有 token 值 / §1–§23 与真源 1–1103 行：**一字未改**（全文件 `numstat` 删除列 = 0）。**⑥ 挂账（不得自选）** —— **「收藏」无数据承载 / 无收藏接口** ⇒ 「接后端收藏能力」vs「渲染为无后端动作的视觉按钮」**待 Kevin / Zang 裁定**（§24.6 第 1 项）；操作栏高度 60px 不动（§24.6 第 3 项）；精确 px 留白留给实现单（≥1px 即满足）。**改动 = 版本头（本行）+ §12 表 v1.22 行 + §24（新）**；**改前快照** = `docs/versions/design-system.spec.v1.21.md`（本册 v1.21 镜像）；**改前 live** = 2819 行 / 651,259 B / md5 `7c3995951ab45ca61ba51a599a3a99f6`；**本单只写** `docs/design/style-preview.html`（纯追加）· `docs/design/design-system.spec.md`（纯追加）· `frontend/src/theme/tokens.js` · `frontend/src/theme/theme-tokens.css`（生成物重生成）· `ops/item-actionbar-20261017/readings/**`；**未动** `frontend/src/pages/**` / `frontend/src/shell/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；**未启停任何服务**；**未 `git add -A` · 未 commit · 未 push**。**证据落点** = `ops/item-actionbar-20261017/readings/`（门套日志与逐条读数；★ `.log` 被 `.gitignore:244 *.log` 命中 ⇒ 入库须 `git add -f`）。
> **★ 勘误（2026-10-17 · §24 `T120` 横向几何口径 · 勘误级不升版）**：**触发 = 上一单在 `T120`（§24）冻结的「组合条内部占比 `58% : 42%`」来自 Zang 对参考图的目测**（非读数）⇒ 本单以**列主类逐像素实测**复测同一参考图（`ops/item-actionbar-20261017/ref/goofish-ref.png` · **1128×170** · sha256 `308e2b62c45a2b3c3868d4783a93b19e2308523bb2cc5cece5b8bec4265485cd` · 只读未改图）并**原位校正**：**① 组合条内部 = `50% : 50%`（以 50:50 为准）** —— 实测 `聊一聊` 388px（**50.1%**）/ `立即购买` 387px（**49.9%**）；**② 补全三段横向口径（均相对「按钮行可用宽」= 1064px，**不得写成固定 px**）= 组合条 `72.8%`（775px）/ 留白 `4.6%`（49px）/ 收藏 `22.6%`（240px）**，三者相加 `100.0%`；**③ 旧字面逐字保留、一律不作口径** —— 版本头 v1.22 行 / §12 表 v1.22 行 / §24.6 第 4 项中的 `58%` / `42%` 与 `58/42` **仅作目测期历史留痕**，**已被本勘误取代**；§24.1-b / §24.3 两处**就地更正**（旧字面逐字转入 §24.7 勘误表「作废」列）。**④ 颜色口径零变更** —— `--sf-cta-solid-bg` / `--sf-cta-solid-fg` 两键及其余 token **一字未改**；与参考图的**已知色差**在 §24.8 显式登记（墨 / 黄 / 浅底 3 处 + 一致 4 处 · 理由 = 站内 token 家族一致 · 每条标「一句话可改」）。**⑤ 不升版依据** = 勘误级 · 纯数值口径校正 · 零新增契约面（无新 token / 无新 `STRUCT` / 无新 i18n 键 / 无新路由）· 承本册 v1.18 勘误先例（第 19 行同形）。**改动 = 本行 + §24.1-b 就地更正 + §24.1-i（新增）+ §24.3 就地更正 + §24.3 新增 1 行 + §24.7（新）+ §24.8（新）**；**`git diff --numstat` = 删除 2 行**（逐行说明见 §24.7 末「删除行说明」）；**本单只写** `docs/design/design-system.spec.md` + 本单读数 `ops/item-actionbar-20261017/readings/spec-correction-v122.md`；**未动代码 / 未动 `docs/design/style-preview.html` / 未动 `frontend/src/theme/tokens.js`**；**未启停任何服务**；**未 `git add -A` · 未 commit · 未 push**。
> **★ 现行版 = v1.23（2026-10-17 · 「首页商品卡片动作胶囊下线」勘误单 · §22 `T112` / 冻结项 #6 / `AC-3` 三处点名就地勘误 + §22.6 契约行同口径就地注 + `docs/OPEN-ITEMS.md` `F32` 过时引用状态改写 · 只追加 + 状态改写（旧字面逐字保留、不删条文）· 本单只写 `docs/**` + 本单读数）**：**① Kevin 指令（2026-10-17）** = 「首页商品卡片移除『查看详情』胶囊」，实现已落 `frontend/src/components/reward/RewardCard.jsx`（`actionLabelKey` 存在 ⇒ 动作胶囊**整块不渲染**）。**② 现行口径（v1.23 · 取代 v1.20 `T112` 的 CTA 子条）** = **首页卡片不渲染动作胶囊** · **入口由整卡链接承载**（卡根单一 `<a>`，`href` = `buildLocalizedPath(lang,'/item/'+id)`） · **卡内交互元素计数仍必须 = 0** · **钩子 `reward-card-view` 随胶囊下线（不得存在）**。**③ 旧路径零变化** = 不传 `actionLabelKey` 的 `reward-card-claim` / `onClaim` / 三态文案**逐字不变**（实测 `claimPill = 1` · `viewPill = 0` · 卡内交互元素 `0`）。**④ 实测读数** = 首页卡内 `[data-sf-m=reward-card-view]` **4 → 0**（1440 与 390 同）· 卡根 `a[href=/item/<id>]` **仍在** · 卡内交互元素 **0 → 0** · 卡最后一行子元素 **2 → 1（无空洞）** · 点卡片标题仍跳 `/item/3041` · 门套 **57 files / 554 tests 前后不变** · CSS **零变化**（证据 = `ops/home-card-remove-cta-20261017/readings/`）。**⑤ 勘误落点（点名三处 + 同口径一处）** = §22.2 `T112` 行后就地勘误段（旧条文逐字保留）· §22.9 `AC-3` 行后新增 `AC-3 · v1.23 勘误注` 行 · §22.12 第 6 项后新增 `6-勘误（v1.23）` 行 · §22.6 「CTA 形态」行后新增取代行；另有 `docs/OPEN-ITEMS.md` 的 `F32` 状态改写行 + 头部 v2.40 块。**⑥ i18n 零新增 / 零删除**（`item.viewDetail` 键**保留不删**，仅首页路径不再消费）⇒ 顶层 `128` / 拍平 `1104` / 四语节点 `4416` **逐字不变**。**⑦ 断言影响** = **真改锚 1 条**（`F32` 所引 `data-sf-m={actionLabelKey ? …}` 写法过时 ⇒ 改指本册 v1.23 口径）+ **新增硬判据 1 条**（`reward-card-view` 计数必须 = 0）· **零新 token / 零 `STRUCT` / 零 CSS / 零真源改动**。**改动 = 版本头（本行）+ §12 表 v1.23 行 + §22.2 / §22.6 / §22.9 / §22.12 就地勘误 + `docs/OPEN-ITEMS.md`（`F32` 状态改写行 + 头部 v2.40 块）**；**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html`（真源零改动）；未启停任何服务；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `e8be9be`（2026-10-17；工作区另有实现单未提交面 `M frontend/src/components/reward/RewardCard.jsx` + 未跟踪 `ops/home-card-remove-cta-20261017/`，非本单写面）。** **★ 快照口径（诚实）**：本单**未新建 / 未重制 `docs/versions/**` 快照**（写面限 `docs/design/design-system.spec.md` + `docs/OPEN-ITEMS.md` + 本单读数）；`docs/versions/design-system.spec.v1.22.md` 保留 v1.22 字面 = **历史**，现行口径以本册 live 正文为准。
> **★ 勘误（2026-10-19 · §15.2 第 18 / 19 行「值不动」+ 发布页币种字段形态 · 勘误级不升版 · 本单只写 `docs/**`）**：**依据 = Kevin 2026-10-19 逐字指令**「在发布商品的时候，【币种编号】一栏，不要输入编号，而是要在下拉框中选择币种。」+ 同批契约（正典 = 姊妹册 `docs/route-layer.spec.md` **v2.37 §47**）。**① 旧句逐字保留**：§15.2 A 表第 18 行「`listings.cid` → `item.cid` ｜ 币种编号 ｜ 键名改（**值不动**）」与第 19 行「`listings.cidNote` → `item.cidNote` ｜ 币种编号请手动填写；社区积分 $ 填 1。 ｜ 键名改（**值不动**）」**原行一字未动**；**其「值不动」口径自本勘误起作废 · 以本段为准**（v1.10 时点该字段确为手填，现指令改为下拉选择 ⇒ 值必须改）。**② 现行口径（写死）** = `item.cid` / `item.cidNote` **只改值、键数不变**（四语同改）；文案**不得再含「手动填写 / 手填」语义**；`jobs.cid` / `jobs.cidNote`（发布任务页）**本单不动**。**③ 字段形态（可判负）** = `/item/new` 币种字段**必须是 `<select data-sf-m="item-select-cid">`**；**旧钩子 `item-input-cid` 不得存在**（数字输入框形态随本单下线）；选项文本 = `symbol · name`（**不显示编号**）；默认 `$`（cid 1）；列表加载失败或为空 ⇒ 仅 `$` 一项、表单仍可提交；提交 `cid` 仍为数字、`POST /api/listing` 形状一字不变。**④ 本册不改 token / 不改表单几何 / 不新增 `T` 规则**（本字段沿用既有 `.sf-item-*` 家族；若实现需新类，归实现单并回写）。**⑤ 落点 = 版本头（本行）+ §15.2 A 表后就地勘误段（旧表体与「旁证」行一字未动）**；**未动 `frontend/**` / `backend-ts/**` / `docs/design/style-preview.html`（真源零改动）**。
> **★ 勘误（2026-10-19 · 第二单「发布任务页币种同改下拉」· §15.2 A 表 `jobs.cid*` **零命中** · 勘误级不升版 · 本单只写 `docs/**`）**：**依据 = Kevin 2026-10-19 追加指令逐字两条**「① 发布任务页（悬赏）同样的修改。② 下拉文本不带编号」+ 同批契约（正典 = 姊妹册 `docs/route-layer.spec.md` **v2.38 §47.8**）。**① 表体零命中（检索式写死）**：`grep -n 'jobs\.cid\|jobs\.cidNote' docs/design/design-system.spec.md` ⇒ 仅命中**版本头两行 + §15.2 上一段勘误**的叙述文字；**A 表体（第 1389–1408 行）内 `jobs.` 命中 = 0** ⇒ **表内无 `jobs.cid` / `jobs.cidNote` 行可勘**（不虚构行号、不改表体）。**② 旧句处置**：上一段勘误的第 ④ 项「`jobs.cid` / `jobs.cidNote`（发布任务页）**本单不动**」**自本段起作废 · 以本段为准**（旧句逐字保留，不删不改）。**③ 现行口径（写死）** = `jobs.cid` / `jobs.cidNote` **只改值、键数不变**（四语 zh / en / hk / vn 同改）；`jobs.cidNote` **不得再含手填 / 编号提示语义**（「填 1 / 填寫 / 手填 / enter 1 / nhập 1」）；**字段形态（可判负）** = `/task/new` 币种字段**必须是 `<select data-sf-m="jobs-select-cid">`**、**旧钩子 `jobs-input-cid` 不得存在**；选项文本 = `symbol · name`（**不带编号**）；默认 `$`（cid 1）、cid 1 不在列表 ⇒ 选首项；列表加载失败或为空 ⇒ 仅 `$` 一项且**表单仍可提交**；提交 `cid` 仍为数字、`POST /api/job` 形状一字不变。**④ 页面对称**：`/task/new` 与 `/item/new` **同形**（`<select>` + 同一读口 `GET /api/currencies` + 同一文案规则），差异仅钩子前缀（`jobs-` / `item-`）与页面壳类（`.sf-jobs-*` / `.sf-item-*`）。**⑤ 本册不改 token / 不改表单几何 / 不新增 `T` 规则**（沿用既有 `.sf-jobs-*` 家族；若实现需新类，归实现单并回写）。**⑥ 落点 = 版本头（本行）+ §15.2 A 表后追加本段**；**未动 `frontend/**` / `backend-ts/**` / `docs/design/style-preview.html`（真源零改动）**。
> **★ 勘误（2026-10-19 · 第三单「媒体上传单」连带：`T94` 渐变占位图条款 + `T80` requiresAuth/恒 5 格 + 底栏①文案微单 · 勘误级不升版 · 本单只写 `docs/**`）**：**依据 = Kevin 2026-10-19 三裁定**（存储 = A「Neon 存图」/ 张数 ≤4 卡用第一张 / 占位 = 机械鱼图）+ 同批缺陷单 `9c8a460`（底栏恒 5 格）；契约正典 = `route-layer.spec` **v2.39 §48** + `data-layer.spec` **v0.34 §40** + `master-plan` **§5.422**。**① `T94` 勘误（状态改写式 · 旧句逐字保留）**：§19.2 `T94` 行「③ 详情面板（**渐变占位图** + 描述 + 库存 + 数量输入）」中的「渐变占位图」**形态限定自本勘误起作废 · 以本段为准** —— 现行口径 = 详情面板 image 槽 = **`media_urls[0] || 机械鱼占位`**（**渲染面允许真图 / 占位图填充原几何盒**，几何盒与槽位不变；媒体上传单落地前维持占位渲染）；§19.4/§19.5 涉「渐变占位图」字面同此读法。**② `T80` 勘误（状态改写式 · 旧句逐字保留）**：`T80` 行与 v1.7 补注中「`我的`→`/profile`（key `profile`，**`requiresAuth`**）」「**`requiresAuth` 仍 `true`**」的**可见性语义自本勘误起作废 · 以本段为准** —— `requiresAuth` 字段已随 `9c8a460` **废除**（`shell/nav.js` 删 `visibleNavItems` + 去 profile `requiresAuth`；生产码 `grep 'visibleNavItems|requiresAuth'` 零引用、仅注释留痕）；现行口径 = **底栏恒 5 格、含未登录**（`BottomTabBar` 恒染 `SHELL_NAV_ITEMS`；未登录点【我的】走既有钱包签名登录引导；详情页 `is-detail` 隐藏面不变）；三测试改锚 = `theme-shell-isomorphism` / `route-exchange-rename` / `v15-nav-floatmenu:92`（`fifth.requiresAuth` ⇒ `fifth.key==='profile'`）。**③ 底栏①文案微单（进行中）**：`home` 键值四语改短（**海鲜 / 海鮮 / Seafood / Hải sản**，键数不变）；§14.10 B / v1.6 注的「海鲜市场」= 旧值字面留痕，实现 commit 落盘后本册以现行值为准（消费点唯一 = `frontend/src/shell/nav.js:20`）。**④ 本册零 token / 零几何 / 零真源改动**（占位资产属图片资源、非主题 token）；**未动 `frontend/**` / `backend-ts/**` / `docs/design/style-preview.html`**。**现取基线 = HEAD `9c8a460`。**
> **★ 现行版 = v1.24（2026-10-19 · Kevin「宽度与列数」两项口径 · 新增 §25 + 规则 `T121` + 三项结构常量链 · 只追加 + 就地指针 · 本单只写 `docs/**`）**：**① 容器最大宽 = `1536px`**（结构常量 `shell-max-w` `1440px ⇒ 1536px`）。**Kevin 今日口径（逐字）**：「容器最大宽 **1536px**」；**「1500 不是标准宽度」已当面说明** ⇒ **`1500` 不再是候选值**（承 §22.11 `Q8`「保持 `1440px` · 另立单」⇒ **本版取代该口径**，**`Q8` 原行一字未删**、其后追加指针行）。**② 列数断点（写死）** = **视口 `≥1280px` ⇒ 6 列** · **`768–1279px` ⇒ 4 列** · **`<768px` 手机档不变**（现取 d `2` / n `1`，**是否也调 2/2 待 Kevin** ⇒ `OPEN-ITEMS` `B38`）；**夜档 `feed-cols` 由 `3` 统一为 `4`**（与日档一致 —— 回归「列数属断点层、**不得按主题变**」的既有口径，见 `EXCLUDED_FROM_THEME` 该行 why）。**③ 落点约束（写死）**：`frontend/src/shell/shell.css` **只允许唯一 `767` 断点块**（现取 `@media` 计数 = **1** · `shell.css:185`）⇒ **`1280` 的 6 列规则落 `frontend/src/styles.css` 顶层 `@media (min-width:1280px)`**（承 §14 桌面 gutter「断点规则落 `styles.css`、`shell.css` 一字不动」先例），且**只覆盖 `.sf-grid` 的 `grid-template-columns`**。**④ 三件同步链（缺一即判负）**：`docs/design/style-preview.html` **纯追加**真源块（`max-width:1536px` 行 + `repeat(6,minmax(0,1fr))` 行 + 夜档 `repeat(4,…)` 行）⇒ `frontend/src/theme/tokens.js` 的 `STRUCT` / `STRUCT_PROV` **重指**（`shell-max-w` · `feed-cols.n` · **新键 `feed-cols-xl`**）⇒ `frontend/src/theme/theme-tokens.css` **用既有生成器重生成**（先跑零漂移 `cmp = 0` 自证）。**⑤ 零 i18n / 零颜色 / 不动 `TOKEN_KEYS`**（只动 `STRUCT`：**改 2 键值 + 改 1 个 PROV 指针 + 新增 1 键**）。**改动 = 版本头（本行）+ §12 表 v1.24 行 + §22.11 `Q8` 行后**新行**（指针，原行一字未动）+ §25（新）**；**本册只写 `docs/**`**；**未动 `frontend/**`**（值表 / 生成物 / 样式归实现单 —— 本笔 = **契约冻结，实现待发**）；**未启停任何服务**；**未 `git add -A` · 本单 commit 仅含 `docs/**` + `ops/feed-6col/**` · 未 push**。**★ 编号勘误（必须披露）**：派单写「新增记 **`T104`**」，而 **`T104` 已被 v1.19 §21（消息面板化 `T104`–`T108`）占用**（现取 `grep -n 'T104' docs/design/design-system.spec.md` 命中 §21 规则表）⇒ **本册按「数字现取」顺延为 `T121`**（现取最大 `T120` = §24），**派单编号字面保留于此**。
> **★ 现行版 = v1.25（2026-10-19 · Kevin「商品卡固定尺寸」四条逐字 · 新增 §26 + 规则 `T122` + `Q5` 勘误 + route 册 `§41.3` 勘误指针 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① Kevin 四条原话（逐字见 §26.0）** = 尺寸固定约 252×412、卡高不得变化 ／ 移除【库存不足】与【0 人已领取 0】两提示及其前置礼物图标 ／ 卡最上方商品预览图 240×240（原图按比例裁切后显示）／ 卡底 224×48 发布者信息（左 24px 圆头像 + 灰色脱敏昵称、右橙色信用胶囊无图标）。**② 冻结契约（§26.1 `T122`）** = **卡高恒 412px**（不随内容）· **预览图 = 卡顶通栏 × 固定高 240px、`object-fit:cover` 居中裁切**（原图任意比例）· **412 内部分配 = 240（图）+ 48（卖家栏）+ 中部 flex-1**（标题 clamp-2 + `$` 价格块 + 描述 clamp，溢出隐藏）。**③ 移除** = `statusText` 状态徽章全态（库存不足/可兑换/已兑换）+ 前置稀有度图标（`getRarityIcon` 整函数）+ 卡底「N 人已领取 / 总数」行（含 `Gift`）+ `limited` 限量徽章（同行一并）。**④ 保留** = 整卡链接（`T112`/`T113`）、`$` 价格块（`r9-93`）、描述 clamp、剩余时间行（条件）、CTA 逻辑（`actionLabelKey` 路径逐字不变）、稀有度光斑。**⑤ `Q5` 勘误（状态改写）** = §22.11 `Q5` 已裁行「稀有度图标（`getRarityIcon`）…保留」**图标部分作废**（行后勘误行已插、旧句一字未删）；**装饰光斑保留不变**。**⑥ 卖家栏数据面** = 昵称 = `maskWalletAddress(evm)`（前 6 + `******` 6 星 + 后 4，例 `0x1234******abcd`；route `§41.3`「`…` 掩码」口径同步勘误、旧句保留）· 头像 = 迁移 `0052_users_avatar_url.sql` 的 `users.avatar_url`（可空；null ⇒ 灰底 + 掩码首字符占位）· 信用档位 = `rating` 按 `ratee_uid` 均星四档（≥4.5 优秀 / ≥3.5 良好 / <3.5 一般 / 无评分新卖家），**独立于排序公式**。**⑦ 后端 / i18n 增量（契约数 · 随实现单）** = `listBrands` 行增 `seller{uid,nickname,avatar,credit}`（feed 行键 45→46；详情 `seller` 加 `credit`、顶层仍 46）+ i18n 新命名空间 `sellerCredit` 4 键（top 128→129 / flat 1110→1114 / 四语节点 4440→4456；base = 编制时点现取 128/1110/4440）。**⑧ 零新主题 token / 零 `STRUCT` / 零 PROV 改指 / `style-preview.html` 零改动**（412/240/48/24 属几何常量，承 §24「颜色以外不进主题层」先例落 `reward-card.css`；信用胶囊色值本版不锁）。**改动 = 版本头（本行）+ §12 表 v1.25 行 + §22.11 `Q5` 行后勘误行 + §26（新）**；**本笔零代码**（编制时点工作区另有实现单未提交面 `M frontend/src/components/reward/RewardCard.jsx`，非本单写面）；**未启停任何服务**；**未 `git add -A` · commit 仅含本单 `docs/**` + `ops/card-resize/**` · 未 push**。
> **★ 现行版 = v1.26（2026-10-24 · Kevin「移动底栏恒 4 格（取消【卖闲置】）+ 桌面浮菜单保留【卖闲置】+ STRUCT token `tabbar-cols` `5 → 4`（PROV 指向 `style-preview.html` L1192）」裁定落册 · **状态改写式 · 只追加零删行** · 本单只写 `docs/**`）**：**① 移动底栏（H5 `BottomTabBar`）取消【卖闲置】格 ⇒ 底栏恒 4 格**（左→右 `home` / `shard` / `messages` / `profile`）⇒ 新规则 **`T123`**（§27.1），`SHELL_NAV_ITEMS` 现取 **4 项**（`frontend/src/shell/nav.js`）。**② 桌面右侧悬浮菜单（`FloatingMenu` · `>767`）保留【卖闲置】⇒ 浮菜单仍五项**（现取 `FM_ITEMS` = `wage`（领工资）/ `sell`（卖闲置）/ `messages`（消息）/ `app`（APP）/ `support`（客服），`frontend/src/shell/FloatingMenu.jsx` **一字未改**）；**路由 `/item/new` 保留、可直链**。**③ STRUCT token `--sf-st-tabbar-cols` `5 → 4`，四处同动已完成**：真源 `docs/design/style-preview.html` **尾部纯追加块 `L1188–1193`**（**新真源行 = `L1192`** `.tabbar{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,1fr);align-items:end;position:relative;z-index:4}`）· `frontend/src/theme/tokens.js:421` 值 `4` · `STRUCT_PROV['tabbar-cols']` = `{d:[1192,'grid-template-columns:repeat(4,1fr)'],n:[1192,同上]}`（`frontend/src/theme/tokens.js:465`）· `frontend/src/theme/theme-tokens.css:24` `--sf-st-tabbar-cols: 4`。**旧 `SP:169` 的 `repeat(5,1fr)` 逐字保留为历史、不作应用值**（§27.3）。PROV 硬门 `theme-tokens.test.js` 已绿。**④ 几何实测**（§27.4）：390 档 `grid-template-columns` = `97.5px × 4`（= 390/4）、末格贴右、`scrollWidth − clientWidth = 0`；1440 / 1536 档底栏 `display:none` 但 **DOM 仍 4 格**；1536 档浮菜单 `sell` 可见（`w=72 h=92`、`href=/item/new`）。**⑤ i18n 零变更**：本单**零新增 / 零删除**键；现取（`json.load` 逐语）**顶层 `135` / 拍平叶子 `1451` / 四语节点 `5804`（= 1451 × 4）**，四语逐文件相同；**`sell` 键仍在、仍被浮菜单消费**（§27.5）。**⑥ 新教训 `N54`**（STRUCT token 变更：真源新行只追加、旧行留痕不动；§27.8）。**⑦ 留痕（§27.9）** —— `T46` / `T80` / §2 token 表 / §7 几何表 / **v1.5 版本行**的「底栏恒 5 格」与「`卖闲置`→`/listing/new`」表述**自本版起作废**，旧字面**逐字保留**、紧随追加取代行。**⇒ 新增 §27 + 规则 `T123` + 教训 `N54`**。**改前快照** = `docs/versions/design-system.spec.v1.25.md`（`cmp=0`；md5 `ffa8cf62fc1180aec1db8b10dff2df4e`）；**本版镜像** = `docs/versions/design-system.spec.v1.26.md`（落笔后建，`cmp=0`）。**本册 v1.26 只写 `docs/**`：未动 `frontend/**` / `backend-ts/**` / `docs/seafood.master-plan.md`（§5.451 由 Kong 写）/ `docs/route-layer.spec.md`（路由未变）；未启停任何服务、未占端口；未 `git add -A`。现取基线 = HEAD `806ea51`（2026-10-24）。**
> **★ 现行版 = v1.27（2026-10-24 · Kevin「首页取闲鱼的视觉、不取它的语义欠债」裁定落册 + 闲鱼 `www.goofish.com` 真浏览器实测 · **状态改写式 · 只追加零删行** · 本单只写 `docs/**` 并提交 / push）**：**① 实测（§28.1）** = 首页 `document.title`「🐴 闲鱼 - 闲不住？上闲鱼！」· **`h1` = 0** · **`h1`–`h6` = 0** · 地标 `header` + **两个 `main`**（**无 `nav`**）· 元素 `2648` · 正文 `2581` 字（**非拦截页**：首轮默认 UA 被反爬拦、换正常 UA 后取真 DOM）；详情 `/item?id=765416638957` `title`「zara 2020Collection系列 尺码S_闲鱼」· **`h1` = 0** · **`h1`–`h6` = 0**。**② 裁定（§28.2 逐字）** = 「**本站首页取闲鱼的视觉、不取它的语义欠债**」⇒ 视觉上无页面标题（与闲鱼一致）· **保留 `1×1` 视觉隐藏 `h1`** 作读屏锚点（容器首子 · 文案复用 `t('siteBrand')` · `.sf-visually-hidden` 落 `styles.css` 顶层）· **不得**把【热门任务】`h2` 改 `h1`（撞钩子与探针）。**③ 三条理由（§28.3）** = APP 镜像 / 洪布流无主题可做标题 / `<title>` 接管标题职责 —— **解释「为什么它这样」，不构成「我们也该这样」**。**④ 与本站差异（§28.4）** = 视觉取齐；`h1` 我们 **1**（隐藏）、它 **0**；`h1`–`h6` 我们 `h1` + `h2`×2、它 0；地标我们 `header`+`main`+**`nav`**、它 `header`+`main`×2 无 `nav` ⇒ **皆有意不同**（不以欠债对齐）。**⑤ 新规则 `T125`（§28.5）+ 教训 `N55`（§28.8）+ 判负 6 条（§28.7）**。**⇒ 新增 §28**。**改动 = 版本头（本行）+ §12 表 v1.27 行 + §28（新）**；**改前快照** = `docs/versions/design-system.spec.v1.26.md`（本单开工复核 `cmp` = **0**；md5 `f410b532d6ed86b8c17f6c48079ccb1b`；`4565` 行 / `945,158` B）；**本版镜像** = `docs/versions/design-system.spec.v1.27.md`（落笔后建，`cmp=0`）。**本册 v1.27 只写 `docs/**`：未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html`（真源零改动）；未启停任何服务、未占端口；未 `git add -A`。现取基线 = HEAD `4169140`（2026-10-24；「首页隐藏 `h1`」实现已在 `4169140` 落地，本笔零代码）。**

> **★ 现行版 = v1.28（2026-10-24 · Kevin「资金余额变动类操作的成功反馈统一用 Toast」裁定落册 · **状态改写式 · 只追加零删行** · 新增 §29 + 规则 `T126` · 本单只写 `docs/**`）**：**① 范围＝仅两类** —— 【**领工资**】与【**任务 / 子任务 / 活动一键领奖**】的成功反馈**统一用 Toast**（顶部轻提示，一句话说清到账金额/次币），**不得**再用模态框、**不得**在卡内/行内再写成功文案；**② 明确不在范围** —— **充值 · 购买 · 订单退款 · 发货 · 收货**一律**仍内联**（逐字照旧，不因本条改形态）；**③ 失败一律仍内联** —— `batt_insufficient` / `nothing_to_claim` / 其他错误、以及登录提示与「加入成功」提示**均不得改 Toast**；**④ 依据** = **Kevin 2026-10-24 裁定**（§29.0 逐条转写）；**⑤ 零新 token / 零新 `STRUCT` / 零新 `PROV` / 零新 i18n 键**（成功文案复用现役键）；实现已在 HEAD 落地（master §5.454 / commit `77da63c`），**本单零代码**。

> **★ v1.10 姊妹册（同批交付）** = `docs/route-layer.spec.md` **v2.28 §38**（`/item` 家族 + 旧路由硬删 + 「前端概念名 ⇄ 后端路径名」映射表）；本册只承载 **形态 / 入口集合 / 可达性 AC / 合并页口径 / i18n 删改留表**，**不重抄**。
> **v1.5 口径来源（逐字）**：Kevin 2026-10-11 定档 ①方案 A·UI 先行（不动后端）②右悬浮菜单仅桌面档显示、H5 隐藏 ③消息模块占位（后续接驳 X/推特私信）④客服/反馈做弹窗模板位；**＋ Kevin 当日两条连锁更正**（`Zang` 转达）：**(A)** 底栏第二项 = **「市场」→ `/exchange`**（key `shard`，图标 `Store`；**不再新建 `/nearby` 占位页、`nearby` 键不新增**）**(B)** `T76` 去重按新底栏集合重算（**`exchange` 继续排除、`reward`/`task` 恢复**）。
> 交付物路径：`docs/design/design-system.spec.md`
> 冻结依据：Kevin 口径 D9（2026-09-27 更正）+ Zang 连带裁决 `docs/seafood.master-plan.md` §5.3（八条）
> **v1.1 冻结依据（追加）**：Kevin 2026-10-11 定档「seafood 前端**桌面档不动**，把**手机竖屏（H5）档**做扎实，P0~P4 全上」；依据 = 设备档实测报告（Neng 采集 / Zang 复核 40/40 零横向溢出；判负实验 `baseline==rerun==restored`；tabbar 真实点击跳转 PASS；1440 档 tabbar `display:none`）
> **v1.2 冻结依据（追加 · Zang 2026-10-11 两条裁定）**：① **`T77`（P2）实施范围一律限在 `@media (max-width: 767px)` 内** —— **复用同一个断点值 767**、**不得新增断点类型**（如 `pointer: coarse`），`frontend/src/shell/shell.css` 仍必须**只有一个 767 断点块**；**桌面档几何零变化为硬判据**。理由：v1.1 原方案（直接抬 `.btn` 家族 / `--sf-*-ctl-h` 34→44）会**连带抬高桌面控件**，与 Kevin 2026-10-11「桌面档不动」定档冲突。② **`T75`（P0）配对项升为硬判据** —— `frontend/index.html` 的 `<meta name="viewport">` **必须**含 `viewport-fit=cover`（缺则 T75 不成立）。
> **v1.3 冻结依据（追加 · 补丁单 2 · Zang 裁定 · 2026-10-11）**：① **D2 入册（`T79` 覆盖范围完整化）** —— 实现方为满足 `T79`（全站最小字号 ≥12px），除 §13.4 已列 3 处外**额外**把 `frontend/src/pages/jobs/jobs.css` 的 `.sf-jobs-tag` 由 `11px→12px`（**上轮 §13.4 未列**）⇒ 后果：`/task/:id` 在 **1440 档** 该元素 **34×20.5 → 36×22**。**Zang 裁定：保留该全局字号变更**（`T79` 是全站规则），**但必须入册**（`.sf-jobs-tag` 补进 §13.1 `T79` 行 + §13.4 P4 清单；桌面侧受影响元素**完整清单（三类）** + 逐元素前后读数见 §13.2.1）。② **「桌面档不动」硬判据由「逐控件逐值相等」改写为「例外清单式」**（**改前/改后字面见 §13.1 `T77` 行 · §13.3 第 14 行 · §13.5 `P2 触控` 行留痕**）。③ **D1 入册**：P2 触控（`T77`）在 ≤767 档因 **CSS 变量作用域跨兄弟节点失效** 留有 **6 个侧栏控件 37.5 < 44** 的实现缺陷（根因 + 修法入 §13.5 判负清单；可复用教训入 §13.6 `N25`）。**本册 v1.3 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。
> **v1.4 冻结依据（追加 · 补丁单 3 · Zang 裁定⑤ · 2026-10-11）**：① **「桌面档不动」硬判据由「例外清单式（元素白名单）」★改「归因式判据」** —— 新判据 = **「1440 档差异集必须 100% 归因于 T79 字号提升。验证法 = 反事实归因实验：只在测量期回退 T79 字号（不动仓库）⇒ 差异集必须为空（`仅基线有 = 0` 且 `仅归因有 = 0`）；且差异集中不得存在与字号无关的几何/布局差异。」**（改前「例外清单式」字面**逐字保留 + 标已作废**，见 §13.1 `T77` 行 / §13.3 第 14 行 / §13.5 `P2 触控` 行）。② **登记 D1 修复后的事实**（Kong commit `ebca3ab`）：修法 = ≤767 的变量覆盖**从「只挂主列根」扩到「主列根 + 主列与侧栏共同祖先 `.sf-layout`」**；**消费者全扫 = 0**（动态哨兵法，非类名清单）；**同根因第 4 面** = `/task/:id` 侧栏 `.sf-jobs-status`（`JobDetailPage.jsx:322`）也已覆盖（390 档 = 172×44）；**新副作用** = `/listing` 侧栏 `.sf-listings-status` 由 **0 → 44px** 高（页高 +114px）—— 属「**T77 的必然几何后果**」，归入已知后果类。③ **归因实验可复跑配方**（devtools 注入回退 4 处 T79 字号 ⇒ 与父版逐元素对拍）+ **`.sf-tabbar` 子树 23 元素 1440 `0×0`（`display:none`）⇒ 不产生可见几何影响**（见 §13.5）。**本册 v1.4 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。
> **v1.3 改前快照**：`docs/versions/design-system.spec.v1.2.md`（本册 v1.2 正文逐字节副本，`cmp=0`；sha256 `32fc97c8…d7499`，131,208 B / 932 行）。
> **v1.4 改前快照**：`docs/versions/design-system.spec.v1.3.md`（本册 v1.3 正文逐字节副本，`cmp=0`；sha256 `72a6ebbe…1ad543`，144,548 B / 962 行）。
> 真源：`docs/design/style-preview.html`。**v1.0 冻结时读数**（该册彼时未改一字）：sha256 `b61ad55d36211958b65d086d09fb79f57d0494b01c8cf6bc79dd84c622982deb`，72,809 B，936 行。
> **★ v1.1 就地更正（P4 · 本册已执行 · 留痕）**：`style-preview.html` 已被 v1.1 改 **1 行**（L170 `.tabbar .tab` 的 `font-size:10.5px` → `12px`；见 §13.2）。**改前** sha256 `9ddebde7fae6b3e7ecf62a3767c0ccfa418a23aa6d915cabe7e9effeba9b5bcd`（80,291 B / 982 行）⇒ **改后** sha256 `cd09248fb19a99f9598cd18362cd4c2a1fdee1d537409252f4c32b946d6f7da6`（80,289 B / 982 行）：**字节 −2、行数 ±0、`git diff --numstat` = `1 1`**。⇒ 自此本册不再主张「真源一字未改」，改动仅此一处并已全量留痕。
> **改前快照**：`docs/versions/design-system.spec.v1.0.md`（本册 v1.0 正文逐字节副本，`cmp=0`）。
> **v1.2 改前快照**：`docs/versions/design-system.spec.v1.1.md`（本册 v1.1 正文逐字节副本，`cmp=0`）。

**一句话**：一整套主题体系、两个外观档 —— **日间档 = 变体 A「码头大牌」**，**夜间档 = 变体 B「夜市行情板」**；两档共用同一套 DOM、同一套组件、同一套 token 语法，差异全部收敛到 token 值层。

**阅读约定**
- 每条规则编号 `T1..Tn`（与 `docs/ledger.spec.md` 的 `R1..R108` 错开，两者可同时引用）。
- 规则格式：**编号 | 口径 | 落点 | 连带影响**。
- 所有色值与形状值均标注提取出处：`SP:行号 选择器`（SP = `docs/design/style-preview.html`）。
- 【已冻结口径】= 来自 D9 或 §5.3，不得自行变更；【本册裁定】= 本册为落地而做的一致性裁定，改需走 Zang 裁决；【本册建议·一句话可改】= 一改即生效、无连带影响。
- 本册**不含** React/TSX 实现代码；只出现 `:root{...}` / `.dark{...}` 的 CSS token 声明与 Tailwind `@theme` 片段。

---

## §0 本册定位与冻结口径来源

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T1** | 【已冻结口径】只做**一整套主题体系、两个外观档**：日间档表现为变体 A，夜间档表现为变体 B。**不是两套设计**，也不是在两个变体里各挑零件拼装。 | 全文；`--sea-*` 全 token 组 | 任何组件不得出现「A 款/B 款」两套分支；只允许 `:root` / `:root.dark` 两组值 |
| **T2** | 【已冻结口径】同构优先：两档共用 **DOM 结构、元素顺序、信息层级、列数、间距栅格、交互**；差异只允许收敛到 **token 值层**。 | 全站组件 | 变体 B 中所有**结构级**差异一律废弃（清单见 T26、T35、T46） |
| **T3** | 【已冻结口径】形状也进 token 层：圆角/描边/投影随主题切换（日＝A 的 `13px 圆角 + 1.5px 描边 + 3px 硬投影`；夜＝B 的 `2px 圆角 + 零投影`），且**同一主题内全站形状语言必须一致**。 | `--sea-radius-*`、`--sea-border-w-*`、`--sea-shadow-*` | 形状 token 与色 token 一样必须给 **Light/Dark 两列值**（§3） |
| **T4** | 【已冻结口径】数字排版统一取 B（`tabular-nums` + 等宽），**两档共用**（D9/§5.3.3）。 | `--sea-font-num`、`--sea-num-tabular` | 交易所站点数字不对齐不可接受；等宽栈两档不得分叉 |
| **T5** | 【已冻结口径】必须有语义化 design token 层，**禁止组件里散落色值/圆角/阴影值**；主题切换 = 换一组 token（§5.3.4）。 | `frontend/src/styles/tokens.css`（建议路径） | 组件只允许 `var(--sea-*)` 或 Tailwind 的 `*-sea-*` 工具类 |
| **T6** | 【已冻结口径】Tailwind 4 暗色用 **class 策略** `@custom-variant dark (&:where(.dark, .dark *))`，**不用** `prefers-color-scheme` 媒体查询策略（§5.3.5）。 | `theme.css` | 用媒体查询策略 ⇒ 用户手动切换无法覆盖 ⇒ 直接判负 |
| **T7** | 【已冻结口径】主题是**用户可见功能**：切换入口 + 持久化（localStorage）+ 首次访问跟随系统（§5.3.6）。 | `ThemeToggle` 组件、`theme.js` | 见 §6 契约 |
| **T8** | 【已冻结口径】商品图在深底下的可见性：**图片位必须有描边或底衬**（§5.3.8）。 | `--sea-border-media`、`--sea-surface-media` | 非文本对比 ≥3:1（T67） |
| **T9** | 【本册裁定】本册的**真源只有 `style-preview.html` 的 A/B 两段 CSS**。变体 C（`SP:357-427`）**已弃用**，其色值不得进入任何 token。 | 全文 | 任何 token 值无法指到 `SP` 行号 ⇒ 视为发明，判负 |
| **T10** | 【本册裁定】本册把 token 分成两类，**这条是全部可判负 AC 的地基**：<br>① **几何 token**（影响 `getBoundingClientRect`）：间距、栅格列数、字号/行高、元素固定尺寸、内边距、图标尺寸 → **两档必须同值**，不属于「主题可切换值」。<br>② **观感 token**（不进 rect）：颜色、圆角、描边宽度、投影、焦点环 → 允许 Light/Dark 两值。 | 全文；§3 与 §4 的分界 | 违反 ⇒ T69（几何恒等 AC）必挂；本条同时解释了为什么 §4 的字号只能给一列值 |

---

## §1 提取方法与证据链

**方法**（可复现）：`re.findall(r'([^{}]+)\{([^{}]*)\}')` 解析 `SP` 的 `<style>` 块 → 按 `.vstage-a` / `.vstage-b` 前缀归集 69 / 79 条选择器 → 每条 token 记录 `值 / 出处选择器 / SP 行号` → 对比度用 WCAG 2.x 相对亮度公式逐对计算（sRGB→线性化→`0.2126R+0.7152G+0.0722B`→`(L1+.05)/(L2+.05)`），`rgba()` 先与底衬做 alpha 合成再算。

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T11** | 变体 A 段 = `SP:196-267`（标题「变体 A · 高饱和黄主导『码头大牌』」），共 **69** 条 `.vstage-a` 选择器；本册所有 Light 列色值只从这段取。 | §2 / §3 Light 列 | — |
| **T12** | 变体 B 段 = `SP:269-351`（标题「变体 B · 黄黑高对比硬朗『夜市行情板』」），共 **79** 条 `.vstage-b` 选择器；本册所有 Dark 列色值只从这段取。 | §2 / §3 Dark 列 | — |
| **T13** | 两档**共用**的结构骨架在 `SP:79-194`（「变体共用的语义结构」，只定版式与骨架，配色全部走变量）。**凡在此段出现的值（字号、间距、列数、尺寸）即为两档同值**，与 T10① 自洽。 | §4 / §5 | 基类 `.feed` 4 列（`SP:115`）、`.feed-m` 2 列（`SP:116`）等即出自此段 |
| **T14** | 品牌黄 `#FDE815` 与品牌黑 `#030402` 由 A、B 两档共同使用（`SP:200/204/206/210…` 与 `SP:274/279/290/292…`），**两档同值**，不是可切换 token。涨跌基色 `#12A150 / #E5484D` 见 `SP:104` 与图例 `SP:476-477`。 | `--sea-accent`、`--sea-accent-fg` | 两档共用同一品牌色 ⇒ 主题差异只体现在「黄占多少面积」，不是「换成另一个黄」 |
| **T15** | 【本册裁定】当某状态在 A/B 稿中**都没有定义**（如「悬停」「禁用」桌面态、「错误态」「骨架屏」），本册**不新造色值**，而是从稿件中**已存在的色值**里指派一个用途，并在表中标 `【本册指派】`+ 出处行号。**凡本册表中标 `【本册指派】` 的格子，都是「值已提取、用途为本册指定」，可一句话改。** | §2 标注列 | 若 Kevin 不认某条指派，改一格值即可，不动结构 |
| **T16** | 【本册裁定】A 稿的 `.thumb.t1..t10`（`SP:258-267`）与 B 稿的 `.thumb.t1..t10`（`SP:342-351`）是**商品图占位渐变**，属「内容占位」而非主题 token；但**图片位的描边/底衬**是 token（`--sea-border-media`，T8）。 | `--sea-border-media` | 渐变两档不同（淡彩 vs 暗彩）是允许的，因为它是图片内容的占位面 |

---

## §2 色 Token 全表（Light=日=A / Dark=夜=B）

**表例**：`出处` 列写作 `SP:行号 选择器`。`【本册指派】` 含义见 T15。

### 2.1 页面底与层级底

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-surface-page` | `#FDE815` | `SP:200 .page{background}` | `#0B0C0E` | `SP:273 .page{background}` |
| `--sea-surface-elevated`（卡/面板/白卡） | `#FFFFFF` | `SP:219 .card{background}`、`SP:239 .panel` | `#141619` | `SP:292 .card`、`SP:314 .panel` |
| `--sea-surface-sunken`（行情条/层深底/深色底衬） | `#030402` | `SP:210 .tickwrap{background}` | `#111317` | `SP:283 .tickwrap{background}` |
| `--sea-surface-input` | `#FFFFFF` | `SP:204 .search{background}` | `#15171B` | `SP:277 .search`、`SP:280 .me`、`SP:289 .cat` |
| `--sea-surface-subtle`（次级底：头像/标签底） | `#FFF7B8` | `SP:230 .tags span{background}` | `#22262B` | `SP:302 .card .meta .avatar{background}` |

### 2.2 前景与强调

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-fg`（正文/标题） | `#0A0A0A` | `SP:200 .page{color}` | `#E8EAED` | `SP:273 .page{color}` |
| `--sea-fg-strong`（卡内标题） | `#0A0A0A` | `SP:223 .card .title{color}` | `#EDEFF2` | `SP:296 .card .title`、`SP:315 .panel-hd h4` |
| `--sea-fg-secondary`（次要前景） | `#3D3D3D` | `SP:228 .card .meta{color}` | `#C4C9D0` | `SP:318 .prow{color}`、`SP:322 .jrow` |
| `--sea-fg-muted`（弱前景，**硬约束 ≥4.5:1**） | `#6B6B5A` | `SP:253 .tabbar .tab{color}`【本册指派】 | `#A9AFB7` | `SP:310 .job-list li{color}` |
| `--sea-fg-muted-on-accent`（黄底上的弱字） | `#4A4A2E` | `SP:256 .empty-note{color}` | `rgba(11,12,14,.72)` | 【本册建议·一句话可改】B 稿无「黄底弱字」场景；值 = `--sea-accent-fg` 加 alpha |
| `--sea-accent`（强调色） | `#FDE815` | `SP:200/206 品牌黄` | `#FDE815` | `SP:274/279/290 品牌黄（同值）` |
| `--sea-accent-fg`（强调前景＝黄底上的字） | `#030402` | `SP:206 .btn-pub{color:#FDE815}` 的反向使用，A 的 `.cat.on` `SP:217` | `#0B0C0E` | `SP:279 .btn-pub{color}`、`SP:290 .cat.on`、`SP:295 .badge` |
| `--sea-accent-hover` | `#FFC44D` | `SP:258 .thumb.t1` 渐变深端【本册指派】 | `#FFC44D` | 同上【本册指派】 |
| `--sea-fg-disabled`（禁用前景；WCAG 1.4.3 豁免非活跃组件） | `#9A9A88` | `SP:238 .job-pub{color}`【本册指派】 | `#5C6169` | `SP:340 .empty-note{color}`【本册指派】 |
| `--sea-surface-disabled` | `#E8E8C8` | `SP:234 .job-pay .unit{color}`【本册指派】 | `#17191D` | `SP:518` B 变体图例色块【本册指派】 |
| `--sea-surface-hover`（悬停底） | `#FFF7B8` | `SP:230 .tags span{background}`【本册指派】 | `#22262B` | `SP:302 .avatar{background}`【本册指派】 |
| `--sea-surface-skeleton`（骨架屏） | `rgba(253,232,21,.35)` | `SP:200` 品牌黄 + alpha；B 稿自有 rgba 用法 `SP:294 .glyph` | `rgba(253,232,21,.16)` | `SP:294 .glyph{color:rgba(253,232,21,.20)}` 同族【本册指派】 |

### 2.3 描边、分隔、投影

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-border`（普通描边，装饰/分组） | `#030402` | `SP:219 .card{border:1.5px solid}`、`SP:204 .search`、`SP:239 .panel` | `#262A30` | `SP:292 .card{border:1px solid}`、`SP:317 .hr{background}` |
| `--sea-border-strong`（**必需的 UI 边界，硬约束 ≥3:1**） | `#030402` | 同上（A 只有一档描边，天然 ≥16:1） | `#8A9099` | `SP:277 .search{color}` 同值【本册指派】；备选 `#FDE815`（B 已有用法 `SP:274/304/326`） |
| `--sea-border-media`（图片位描边，T8） | `#030402` | `SP:220 .thumb{border-bottom:1.5px solid}` | `#8A9099` | 【本册指派】；备选 `#FDE815`（`SP:304 .job-card{border:1px solid #FDE815}`） |
| `--sea-border-tag`（标签描边） | `#030402` | `SP:230 .tags span{border:1px solid}` | `#2A2D33` | `SP:303 .tags span{border:1px solid}` |
| `--sea-divider`（分隔线） | `#030402` + `opacity:.18` | `SP:242 .hr{background:#030402;opacity:.18}` | `#262A30` + `opacity:1` | `SP:317 .hr{background:#262A30;opacity:1}` |
| `--sea-shadow-color`（硬投影色） | `#030402` | `SP:219 .card{box-shadow:3px 3px 0 #030402}` | `transparent` | B 稿全部零投影（`SP:292 .card` 未声明 box-shadow） |
| `--sea-shadow-color-soft`（软投影色/带 alpha） | `rgba(3,4,2,.35)` | `SP:206 .btn-pub{box-shadow:2px 2px 0 rgba(3,4,2,.35)}`；`SP:231` 用 `.4`；`SP:255` 用 `.28` | `transparent` | 同上 |
| `--sea-surface-media`（图片位底衬） | `#FFFFFF` | `SP:219 .card{background:#fff}` 下的图片位 | `#141619` | `SP:292 .card` |
| `--sea-focus-ring` | `#030402` | 【本册指派】取 `--sea-border`（A 的描边色，天然高对比） | `#FDE815` | 【本册指派】；B 已用黄做强调边线 `SP:274` |
| `--sea-focus-ring-invert`（深底/黄底按钮上的焦点环） | `#FDE815` | `SP:217 .cat.on{color:#FDE815}`（黑底黄字） | `#0B0C0E` | `SP:279 .btn-pub{color}`（黄底黑字） |

### 2.4 价格、涨跌与招工

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-price-fg`（价格数字） | `#030402` | `SP:226 .price .num{color}` | `#FDE815` | `SP:299 .price .num{color}` |
| `--sea-price-cur`（`$` 符号） | `#030402` | `SP:225 .price .cur{color}` | `#FDE815` | `SP:298 .price .cur{color}` |
| `--sea-price-bg`（价格底衬） | `#FDE815` | `SP:224 .price{background:#FDE815}` | `transparent` | B 价格无底衬，只有下边线（`SP:297`） |
| `--sea-price-border`（价格底衬描边） | `#030402` | `SP:224 .price{border:1.5px solid}` | `#22262B` | `SP:297 .price{border-bottom:1px solid}` |
| `--sea-price-unit`（单位 `/ 8只装`） | `#3A3A2A` | `SP:227 .price .unit{color:#3A3A2A;opacity:1}` | `#8A9099` | `SP:300 .price .unit{color}` |
| `--sea-up`（涨，**深色底衬上**） | `#3DDC84` | `SP:214 .up{color:#3DDC84}` | `#3DDC84` | `SP:286 .up{color:#3DDC84}` |
| `--sea-down`（跌，**深色底衬上**） | `#FF7A7A` | `SP:214 .down{color:#FF7A7A}` | `#FF6B6B` | `SP:286 .down{color:#FF6B6B}` |
| `--sea-up-on-light`（浅底衬上的涨，见 T63） | `#12A150` | `SP:104 .up{color:#12A150}` + 图例 `SP:476` | 不需要（夜档无浅底衬） | — |
| `--sea-down-on-light`（浅底衬上的跌，见 T63） | `#E5484D` | `SP:104 .down{color:#E5484D}` + 图例 `SP:477` | 不需要 | — |
| `--sea-up-bg`（涨跌文本的底衬） | `#030402` | `SP:210 .tickwrap{background:#030402}` | `#141619` | `SP:292 .card{background}` |
| `--sea-jobcard-bg` | `#030402` | `SP:231 .job-card{background:#030402}` | `#141619` | `SP:304 .job-card{background:#141619}` |
| `--sea-jobcard-fg` | `#FFFFFF` | `SP:231 .job-card{color:#fff}`、`SP:235 .job-title` | `#EDEFF2` | `SP:306 .job-title{color}` |
| `--sea-jobcard-fg-muted` | `#C9C9B8` | `SP:236 .job-list li{color}` | `#A9AFB7` | `SP:310 .job-list li{color}` |
| `--sea-jobcard-fg-faint`（发布方/信用） | `#9A9A88` | `SP:238 .job-pub{color}` | `#8A9099` | 由 `#6B7079`（`SP:313`）**升级**而来，见 T65 |
| `--sea-jobcard-bullet`（列表圆点） | `currentColor` + `opacity:.45` | `SP:144 .job-list li::before{background:currentColor;opacity:.45}` | `#FDE815` + `opacity:.7` | `SP:311 .job-list li::before{background:#FDE815;opacity:.7}` |
| `--sea-jobcard-accent-bar`（夜档左强调条） | `0`（A 无） | `SP:231` A 用整块黑底表达 | `4px solid #FDE815` | `SP:304 .job-card{border-left:4px solid #FDE815}` |

### 2.5 徽标、标签、底栏、状态

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-badge-bg` / `--sea-badge-fg` | `#030402` / `#FDE815` | `SP:222 .badge{background:#030402;color:#FDE815}` | `#FDE815` / `#0B0C0E` | `SP:295 .badge{background:#FDE815;color:#0B0C0E}` |
| `--sea-tag-bg` / `--sea-tag-fg` | `#FFF7B8` / `#0A0A0A` | `SP:230 .tags span` | `transparent` / `#A9AFB7` | `SP:303 .tags span{background:transparent;color:#A9AFB7}` |
| `--sea-tabbar-bg` | `#FFFFFF` | `SP:252 .tabbar{background:#fff}` | `#0B0C0E` | `SP:336 .tabbar{background:#0B0C0E}` |
| `--sea-tabbar-border` | `#030402`（2px） | `SP:252 .tabbar{border-top:2px solid #030402}` | `#262A30`（1px） | `SP:336 .tabbar{border-top:1px solid #262A30}` |
| `--sea-tab-fg` | `#6B6B5A` | `SP:253 .tabbar .tab{color}` | `#8A9099` | 由 `#6E747C`（`SP:337`）**升级**而来，见 T65 |
| `--sea-tab-fg-active` | `#030402` | `SP:254 .tab.active{color:#030402}` | `#FDE815` | `SP:338 .tab.active{color:#FDE815}` |
| `--sea-ticker-bg` / `--sea-ticker-fg` | `#030402` / `#FFFFFF` | `SP:210 .tickwrap`、`SP:213 .tk-price{color:#fff}` | `#111317` / `#FDE815` | `SP:283 .tickwrap`、`SP:285 .tk-price{color:#FDE815}` |
| `--sea-ticker-pair` | `#FDE815` | `SP:212 .tk-pair{color:#FDE815}` | `#9AA0A8` | `SP:284 .tk-pair{color}` |
| `--sea-ticker-note` | `#FFFFFF` + `opacity:.7` | `SP:105 .tk-note{opacity:.7}`（A 未覆色，继承 `SP:210` 的 `#fff`） | `#8A9099` | 由 `#6B7079`（`SP:287`）**升级**而来，见 T65 |
| `--sea-topbar-bg` | `#FDE815` | `SP:201 .topbar{background:#FDE815}`、`SP:247 .m-head` | `#0B0C0E` | `SP:274 .topbar{background:#0B0C0E}`、`SP:324 .m-head` |
| `--sea-topbar-line` | `#030402`（2px） | `SP:201 .topbar{border-bottom:2px solid}`、`SP:249 .tb-m` | `#FDE815`（1px） | `SP:274 .topbar{border-bottom:1px solid #FDE815}`、`SP:326 .tb-m` |
| `--sea-statusbar-fg` | `#0A0A0A` | `SP:248 .statusbar{color}` | `#C9CED6` | `SP:325 .statusbar{color}` |
| `--sea-foot-fg` | `#0A0A0A` | `SP:257 .foot{color:#0A0A0A}` | `#6B7079` → 用 `#8A9099` | `SP:341 .foot{color:#6B7079}`，见 T65 |
| `--sea-glyph`（图片占位字） | `rgba(3,4,2,.30)` | `SP:221 .glyph{color:rgba(3,4,2,.30)}` | `rgba(253,232,21,.20)` | `SP:294 .glyph{color:rgba(253,232,21,.20)}` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T17** | token 命名前缀统一 `--sea-*`；语义分层为 `surface-*`（底）/`fg-*`（前景）/`border-*`（描边）/`accent-*`（强调）/`price-*`/`up`·`down`/`shadow-*`/`focus-ring-*`。**禁止出现以颜色或变体命名的 token**（如 `--yellow-500`、`--a-card-bg`、`--dark-mode-gray`）。 | 全 token 表 | 组件改主题时不需要知道「这是哪一档」 |
| **T18** | 【本册裁定】`--sea-accent`（`#FDE815`）与 `#030402` 是**两档同值**的品牌常量（T14）；两档差异靠**使用面积与承载方式**表达 —— 日档黄铺满页面底（`SP:200`），夜档黄只出现在价格/主按钮/边线/徽标（`SP:279/290/292/299/304`）。**禁止在夜间档把黄改成「暗黄/深黄」以求对比**。 | `--sea-accent` | 任何「夜间用另一个黄」的提案 = 破坏品牌一致性，判负 |
| **T19** | 【本册裁定】`--sea-fg-muted` 是**硬约束 token**：无论主题如何，它必须 ≥4.5:1（对照其实际底衬）。因此 **B 稿的三处弱灰不得原样进入 token**：`#6B7079`（`SP:287/313/341`，实测 3.64:1 on `#141619`）、`#6E747C`（`SP:337`，4.15:1 on `#0B0C0E`）、`#5C6169`（`SP:340`，3.14:1 on `#0B0C0E`）—— 表内已统一改为 B 稿**自身已有的** `#8A9099`（5.58–6.08:1 ✅）。 | `--sea-fg-muted`、`--sea-tab-fg`、`--sea-ticker-note`、`--sea-foot-fg`、`--sea-jobcard-fg-faint` | 这是本册对 B 稿的**唯一一类强制取值改动**；理由与实测见 §8 |
| **T20** | 【本册裁定】`--sea-surface-hover` / `--sea-surface-disabled` / `--sea-surface-skeleton` / `--sea-focus-ring` / `--sea-border-strong` / `--sea-border-media` 这 6 个 token 在 A/B 稿中**无直接对应选择器**，本册按 T15 从已提取值中指派。**每格均已标 `【本册指派】` 与出处行号，属「一句话可改」。** | §2 表 | 若 Kevin/Zang 另定，只改这 6 格值 |
| **T21** | 【本册裁定】悬停态在两档的语义**不同构、但视觉同构**：日档悬停 = 浅黄底（`#FFF7B8`），夜档悬停 = 提亮一级（`#22262B`）。二者都必须是**比自身底衬更「显」的一级**，不得使用反转色（黑/白反转属状态语义，不属主题值）。 | `--sea-surface-hover` | 悬停不得改变元素尺寸/位置（不得用 `transform`/`border`），只能用 `background`/`box-shadow` 颜色 |
| **T22** | 【本册裁定】`--sea-border`（装饰性分组边界）**不强制 3:1** —— 它只做「成组」的视觉提示，分组语义由间距与层级（`surface-elevated` vs `surface-page`）承担；而 **`--sea-border-strong` 必须 ≥3:1**，用于任何「边界是识别该 UI 组件所必需」的场合（输入框、可点击卡的轮廓、选中态指示器）。 | `--sea-border` / `--sea-border-strong` | 实测：夜档 `#262A30` 对卡底仅 1.26:1、对页底 1.08–1.11:1 ⇒ **夜档卡片边界靠底差无法辨识**，因此夜档**可点卡片**必须带 `--sea-border-strong` 或 `--sea-accent` 边线（B 稿 `.job-card` 的 `1px solid #FDE815` 正是此用法，`SP:304`） |

---

## §3 形状 Token 全表（Light=日=A / Dark=夜=B）

### 3.1 圆角档位

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 | 用途 |
|---|---|---|---|---|---|
| `--sea-radius-xs` | `5px` | `SP:131 .tags span{border-radius:5px}`、`SP:136 .job-tag`、`SP:246 .jrow .jp` | `2px` | `SP:303 .tags span{border-radius:2px}`、`SP:305 .job-tag` | 标签 / 招工标记 / 行情小胶囊 |
| `--sea-radius-badge` | `6px` | `SP:120 .badge{border-radius:6px}` | `2px` | `SP:295 .badge{border-radius:2px}` | 商品图角标 |
| `--sea-radius-sm` | `8px` | `SP:224 .price{border-radius:8px}` | **`0`（实测）** | `SP:297` `.vstage-b .price` 未声明圆角 ⇒ 实测 `border-radius: 0px`。本册取 `0`（忠于原稿）；因夜档价格底为 `transparent` 且无描边，`0` 与 `2px` 视觉无差异 | 价格底衬 / 小控件 |
| `--sea-radius-md` | `11px` | `SP:204 .search{border-radius:11px}`、`SP:206 .btn-pub`、`SP:202 .logo-w` | `2px` | `SP:277 .search{border-radius:2px}`、`SP:279 .btn-pub`、`SP:275 .logo-w` | 输入框 / 主按钮 / Logo 容器 / 小按钮 `--sea-radius-btn-sm` `9px`（`SP:237`）→ 夜档 `2px`（`SP:312`） |
| `--sea-radius-lg` | `13px` | `SP:219 .card{border-radius:13px}`、`SP:239 .panel` | `2px` | `SP:292 .card{border-radius:2px}`、`SP:314 .panel` | 商品卡 / 面板 / 招工卡 |
| `--sea-radius-fab` | `14px` | `SP:173 .tabbar .fab{border-radius:14px}`（基类，A 未覆盖） | `2px` | `SP:339 .tabbar .fab{border-radius:2px}` | 底栏中央发布键 |
| `--sea-radius-pill` | `999px` | `SP:207 .me`、`SP:216 .cat`、`SP:30 .h-nav a` | `2px` | `SP:280 .me{border-radius:2px}`、`SP:289 .cat{border-radius:2px}` | 分类胶囊 / 账户胶囊 / chip |
| `--sea-radius-avatar` | `50%` | `SP:93 .avatar{border-radius:50%}`（基类，A 未覆盖） | `2px` | `SP:281 .me .avatar{border-radius:2px}`、`SP:302 .card .meta .avatar{border-radius:2px}` | 头像（30px / 19px 两档同尺寸，仅形状变） |

### 3.2 描边宽度

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-border-w`（组件通用描边） | `1.5px` | `SP:204 .search`、`SP:207 .me`、`SP:216 .cat`、`SP:219 .card`、`SP:220 .thumb`、`SP:224 .price`、`SP:239 .panel` | `1px` | `SP:277 .search`、`SP:280 .me`、`SP:289 .cat`、`SP:292 .card`、`SP:293 .thumb`、`SP:314 .panel` |
| `--sea-border-w-tag` | `1px` | `SP:230 .tags span{border:1px solid}` | `1px` | `SP:303 .tags span{border:1px solid}`（两档同值） |
| `--sea-border-w-frame`（顶栏/底栏/行情条分隔线） | `2px` | `SP:201 .topbar{border-bottom:2px}`、`SP:249 .tb-m`、`SP:252 .tabbar{border-top:2px}` | `1px` | `SP:274 .topbar{border-bottom:1px}`、`SP:326 .tb-m`、`SP:336 .tabbar{border-top:1px}` |
| `--sea-border-w-accent-bar`（夜档招工卡左条） | `0` | A 无此元素（`SP:231` 靠整块黑底） | `4px` | `SP:304 .job-card{border-left:4px solid #FDE815}` |
| `--sea-focus-w`（焦点环宽度） | `2px` | 【本册指派】 | `2px` | 【本册指派】（两档同值，保证观感一致） |
| `--sea-focus-offset` | `2px` | 【本册指派】 | `2px` | 【本册指派】 |

### 3.3 投影档位

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-shadow-control`（输入框/小控件） | `2px 2px 0 var(--sea-shadow-color)` | `SP:204 .search{box-shadow:2px 2px 0 #030402}` | `none` | B 稿 `.search`（`SP:277`）未声明 box-shadow |
| `--sea-shadow-btn`（主按钮） | `2px 2px 0 var(--sea-shadow-color-soft)` | `SP:206 .btn-pub{box-shadow:2px 2px 0 rgba(3,4,2,.35)}` | `none` | `SP:279 .btn-pub` 未声明 |
| `--sea-shadow-card`（卡/面板） | `3px 3px 0 var(--sea-shadow-color)` | `SP:219 .card`、`SP:239 .panel` | `none` | `SP:292 .card`、`SP:314 .panel` 未声明 |
| `--sea-shadow-card-soft`（招工卡/深底卡） | `3px 3px 0 rgba(3,4,2,.4)` | `SP:231 .job-card{box-shadow:3px 3px 0 rgba(3,4,2,.4)}` | `none` | `SP:304 .job-card` 未声明 |
| `--sea-shadow-fab`（底栏发布键） | `0 3px 0 rgba(3,4,2,.28)` | `SP:255 .tabbar .fab{box-shadow:0 3px 0 rgba(3,4,2,.28)}` | `none` | `SP:339 .tabbar .fab` 未声明 |
| `--sea-shadow-color` | `#030402` | 见 §2.3 | `transparent` | 见 §2.3 |

### 3.4 描边零占位（本册最重要的工程裁定）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T23** | 【本册裁定】**全站所有描边一律零布局占位**：组件不得使用 `border`（`border:0`），描边改由 `box-shadow` 实现 —— 外描边 `0 0 0 <w> <color>`、内描边 `inset 0 0 0 <w> <color>`；边线（仅一侧）用 `inset 0 -<w> 0 0 <color>` 等方向形式。**理由**：A 的 `1.5px`/`2px` 与 B 的 `1px` 若走 `border`，在 `box-sizing:border-box` 下**外框尺寸不变但内容盒被吃掉 0.5–1px**，导致文字换行点变化、行盒高度变化、下游元素整体位移 —— `§5.3.7` 的「尺寸不变」不足以保证**内容**不重排，故本册把约束前移到「描边不占位」。 | 全部组件；`--sea-border-w*` 仅作 `box-shadow` 的 spread 参数 | 这是 T69（`getBoundingClientRect` 逐值相等）能通过的前提；违反 ⇒ AC 必挂 |
| **T24** | 【本册裁定】形状 token 的合成规则：每个组件的 `box-shadow` 是**一条有序列表**，按「内描边 → 外描边 → 高度投影 → 焦点环」拼接：<br>`box-shadow: inset 0 0 0 var(--sea-border-w) var(--sea-border), var(--sea-shadow-card), 0 0 0 var(--sea-focus-w) var(--sea-focus-ring);`<br>焦点环仅在有 `:focus-visible` 时追加，且必须带 `--sea-focus-offset` 的间隙（用第二层 `0 0 0 calc(var(--sea-focus-w) + var(--sea-focus-offset)) <底衬色>` 实现）。 | 全部组件 | 禁止在组件里手写 `box-shadow` 字面量（T5） |
| **T25** | 【本册裁定】夜档零投影（`none`）时，**投影 token 不得被 `border` 顶替**：B 稿靠「卡底 `#141619` + 描边 + 间距」表达层级，本册保持该形状语言；禁止「夜间补一个柔和投影」以求层次（会破坏 B 的硬朗观感）。 | `--sea-shadow-*` | 夜档层级完全由 `--sea-surface-elevated` 与间距承担 |
| **T26** | 【本册裁定】同一主题内**全站形状语言必须一致**（§5.3.2）：日档全站 `1.5px` 描边 + `13px/11px/8px` 圆角 + 硬投影；夜档全站 `1px` 描边 + `2px` 圆角 + 零投影。**禁止在夜档给某类卡留圆角、给另一类卡切直角**，也禁止在日档给某个按钮去投影。 | §3 全表 | 唯一被允许的例外是**承载语义差异**的形状：`--sea-radius-pill`（胶囊）、`--sea-radius-avatar`（圆头像）、`--sea-border-w-accent-bar`（左强调条）—— 它们在两档都有对应值，不是「混用」，而是「同一档位在两档取不同值」 |
| **T27** | 【本册裁定】`--sea-radius-avatar` 在夜档由 `50%` 变 `2px`（`SP:281/302`）是 B 稿的**显式形状语言**，必须保留；头像尺寸（30px / 19px）两档不变，故不影响 T69。 | `--sea-radius-avatar` | 禁止「头像保持圆形因为更好看」——那是放弃 B 的形状语言 |

---

## §4 字阶、字重与等宽数字

### 4.1 字体栈（两档同值）

| Token | 值 | 出处 |
|---|---|---|
| `--sea-font-sans` | `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", "Microsoft YaHei", Arial, sans-serif` | `SP:16 body{font}`（基类，A/B 均未覆盖） |
| `--sea-font-num` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | `SP:285 .tk-price`、`SP:299 .price .num`、`SP:307 .job-pay`、`SP:319 .prow .rt`、`SP:323 .jrow .jp` |
| `--sea-font-weight-sans` | `400`（正文）/ 字重按档位显式给（见 4.3） | `SP:16`、各选择器 |
| `--sea-num-tabular` | `font-variant-numeric: tabular-nums` | `SP:102 .tk-price`、`SP:125 .price .num`、`SP:140 .job-pay .num`、`SP:156 .prow .rt`、`SP:179 .jrow .jp` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T28** | 【已冻结口径】**等宽数字规则**：凡「价格 / 汇率 / 余额 / 成交额 / 涨跌幅 / 佣金 / 酬金 / 信用分」等一切数字，必须**同时**具备 ① `font-variant-numeric: tabular-nums` ② `font-family: var(--sea-font-num)`（等宽栈）。两档共用，不得分叉（§5.3.3 / T4）。 | `--sea-font-num`、`--sea-num-tabular` | 未加等宽的「汇率对齐」类缺陷直接判负；判负方法见 T71（脚本断言 `getComputedStyle(el).fontVariantNumeric === 'tabular-nums'`） |
| **T29** | 【本册裁定】**字号与字重属「几何 token」**（T10①）：字号变化 ⇒ 行盒高度变化 ⇒ 卡片高度变化 ⇒ 全站位移。因此 **§4 全部字号只给一列值，两档共用**；B 稿中比 A 更大的数字字号**不得进入主题值**。 | §4.2 全表 | 这直接决定 T69 能否通过；「夜间把价格调大」= 破坏 AC |

### 4.2 字号 / 行高 / 字重全表（**单列 = 两档同值**）

| Token | 字号 / 行高 / 字重 | 出处（基类 = 两档共用段 `SP:79-194`） |
|---|---|---|
| `--sea-fs-body` | `14px / 1.55 / 400` | `SP:16 body{font:14px/1.55}` |
| `--sea-fs-card-title` | `13.5px / 1.45 / 600` | `SP:122 .card .title` |
| `--sea-fs-panel-title` | `13.5px / ~1.5 / 800` | `SP:152 .panel-hd h4` |
| `--sea-fs-job-title` | `13.5px / 1.4 / 800` | `SP:137 .job-title` |
| `--sea-fs-job-list` | `12px / 1.5 / 400` | `SP:143 .job-list li` |
| `--sea-fs-price-num` | `21px / 1 / 900` + `letter-spacing:-.01em`（基类 20px、A 覆为 21px、B 覆为 26px ⇒ 取 A，见 T30） | `SP:226 .vstage-a .price .num{font-size:21px}` + `SP:125` |
| `--sea-fs-price-cur` | `14px / 1 / 900` | `SP:124 .price .cur` |
| `--sea-fs-price-unit` | `11.5px / 1 / 500` | `SP:126 .price .unit` |
| `--sea-fs-job-pay-num` | `24px / 1 / 900`（B 覆为 30px ⇒ 取基类 24px，见 T30） | `SP:140 .job-pay .num` |
| `--sea-fs-ticker-pair` | `12.5px / 1 / 700` + `letter-spacing:.02em` | `SP:101 .tk-pair` |
| `--sea-fs-ticker-price` | `13px / 1 / 800` | `SP:102 .tk-price` |
| `--sea-fs-ticker-chg` | `12px / 1 / 700` | `SP:103 .tk-chg` |
| `--sea-fs-ticker-note` | `11.5px / 1 / 400` | `SP:105 .tk-note` |
| `--sea-fs-meta` | `11.5px / 1.5 / 400` | `SP:127 .card .meta` |
| `--sea-fs-badge` | `11px / 1.2 / 700` | `SP:120 .badge` |
| `--sea-fs-tag` | `11px / 1.2 / 400` | `SP:131 .tags span` |
| `--sea-fs-job-tag` | `11px / 1.2 / 900` | `SP:136 .job-tag` |
| `--sea-fs-btn` | `13.5px / 1 / 800` | `SP:91 .btn-pub` |
| `--sea-fs-btn-sm` | `12px / 1 / 800` | `SP:147 .btn-sm` |
| `--sea-fs-search` | PC `13.5px`；手机 `12.5px`（`SP:166`） | `SP:89 .search`、`SP:166 .tb-m .search` |
| `--sea-fs-cat` | `12.5px / 1 / 400`（选中 `800`） | `SP:109 .cat`、`SP:217 .cat.on` |
| `--sea-fs-brand` | `17px / 1 / 900` + `letter-spacing:.02em` | `SP:88 .brand-txt` |
| `--sea-fs-prow` | `12.5px / 1.5 / 400`（名称 `700`） | `SP:154-155 .prow` |
| `--sea-fs-rule` | `12px / 1.65 / 400` | `SP:157 .rule` |
| `--sea-fs-jrow` | `12.5px / 1.5 / 600`（价格 `900`） | `SP:177-179 .jrow` |
| `--sea-fs-glyph` | PC `46px / 1 / 900`（基类；B 覆为 52px ⇒ 取 46px，见 T30）；手机 `34px` | `SP:193 .glyph{font-size:46px}`、`SP:194 .feed-m .glyph{font-size:34px}` |
| `--sea-fs-tab` | `10.5px / 1 / 600`（选中 `800`） | `SP:170`、`SP:254` |
| `--sea-fs-statusbar` | `12px / 1 / 700` | `SP:162 .statusbar` |
| `--sea-fs-empty` | `11.5px / 1.5 / 400` | `SP:182 .empty-note` |
| `--sea-fs-foot` | `11.5px / 1.5 / 400` | `SP:181 .foot` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T30** | 【本册裁定】**字号冲突一律取 A / 基类**，B 的三个放大字号（`.glyph 52px` `SP:294`、`.price .num 26px` `SP:299`、`.job-pay .num 30px` `SP:308`）与 B 的缩小字号（`.card .title 13px` `SP:296`、手机 `.title 12.5px`/`.price .num 22px` `SP:332-333`）**全部不采纳**。<br>**推理链（可判负）**：列数取 A 的 **4 列**（T31）⇒ 单卡宽度取 A ⇒ 单卡可用宽度比 B 的 3 列窄 ≈ 25% ⇒ B 为 3 列设计的 26px/30px/52px 在 4 列下会挤压标题与单位 ⇒ 字号必须与列数同源。**列数与字号只能同取一端，不允许「列数取 A、字号取 B」这种零件拼装**（那是 T1 明确禁止的）。 | `--sea-fs-price-num`、`--sea-fs-job-pay-num`、`--sea-fs-glyph`、`--sea-fs-card-title` | 若 Kevin 想要 B 的大数字，唯一自洽方案是**列数一起回到 3 列** —— 但那样违反 §5.3.1「列数一致」在两档间的解释（会与「夜间可用更少列」混为一谈），故本册不建议。**此条为本册最重要的一处「选边」，请 Zang 复核。** |
| **T31** | 【本册裁定】夜间档通过**字号不变 + 等宽字形 + 黄色 + `tabular-nums`** 来呈现 B 的「行情板」观感（`SP:299` 的观感来源是**黄色 + 等宽 + 数字大间距**，不必然是更大的 px）。因此夜档价格视觉主角地位由 `--sea-price-fg`（`#FDE815`）与 `--sea-font-num` 承担。 | `--sea-price-fg`、`--sea-font-num` | 与 T30 配套 |
| **T32** | 【本册裁定】字重是**两档同值**的（不随主题变）。禁止「夜间加粗以求对比」—— 那会改变行盒高度 ⇒ 位移。夜档对比靠 `--sea-fg`/`--sea-fg-strong` 的色值差，不靠字重（§8 实测夜档前景均 ≥10:1，无需加粗）。 | §4.2 字重列 | 违反 ⇒ T69 判负 |
| **T33** | 【本册裁定】字距 `letter-spacing` 也是几何属性（影响文本宽度 ⇒ 可能改变换行）：`--sea-fs-brand` 的 `.02em`（`SP:88`）、`--sea-fs-price-num` 的 `-.01em`（`SP:125`）、`--sea-fs-ticker-pair` 的 `.02em`（`SP:101`）**两档同值**；B 稿上的 `.brand-txt{letter-spacing:.04em}`（`SP:276`）与 `.price .num{letter-spacing:-.02em}`（`SP:299`）**不采纳**。 | `--sea-fs-*` 的 letter-spacing | 同上 |

---

## §5 间距、栅格与断点

### 5.1 间距档位（4px 基线的派生序，**两档同值**）

| Token | 值 | 出处（基类段或 A 段；A/B 的间距冲突取 A，见 T36） |
|---|---|---|
| `--sea-space-0` | `0` | — |
| `--sea-space-hair` | `1px` | `SP:224 .price{padding:1px 8px 3px}` |
| `--sea-space-2` | `2px` | `SP:120 .badge{padding:2px 7px}`、`SP:136 .job-tag` |
| `--sea-space-3` | `3px` | `SP:170 .tabbar .tab{gap:3px}`、`SP:224 .price{gap:3px}` |
| `--sea-space-4` | `4px` | `SP:123 .price{gap:4px}`、`SP:138 .job-pay`、`SP:252 .tabbar{padding-top:4px}` |
| `--sea-space-5` | `5px` | `SP:130 .tags{gap:5px}` |
| `--sea-space-6` | `6px` | `SP:120 .badge` 上下文、`SP:127 .card .meta{gap:6px}`、`SP:91 .btn-pub{gap:6px}` |
| `--sea-space-7` | `7px` | `SP:121 .card .body{gap:7px}`、`SP:52 .v-swatch`（外壳） |
| `--sea-space-8` | `8px` | `SP:108 .cats{gap:8px}`、`SP:120 .badge{left:8px;top:8px}`、`SP:224 .price{padding … 8px}` |
| `--sea-space-9` | `9px` | `SP:89 .search{gap:8px}`→ 手机 `.tb-m .search`；`SP:134 .job{gap:9px}`、`SP:86 .brand{gap:9px}`、**手机栅格 gap**（见 5.2） |
| `--sea-space-10` | `10px` | `SP:85 .tb-inner{gap:14px}` 上下文、`SP:121 .card .body{padding:10px 11px 12px}`、`SP:154 .prow{gap:10px}`、`SP:150 .panel{gap:10px}` |
| `--sea-space-11` | `11px` | `SP:121 .card .body{padding:10px 11px}` |
| `--sea-space-12` | `12px` | `SP:108 .cats{padding:12px 20px 4px}`、`SP:75 .device` 相关、`SP:170 .tabbar .tab{padding:8px 0 12px}` |
| `--sea-space-13` | `13px` | `SP:134 .job{padding:13px 14px}`、`SP:150 .panel{padding:13px 14px}`、`SP:109 .cat{padding:6px 13px}` |
| `--sea-space-14` | `14px` | `SP:85 .tb-inner{gap:14px}`、`SP:121 .card .body{padding … 12px}` 对应的 `14px` 出现在 `.panel`/`.job` 横向 |
| `--sea-space-16` | `16px` | `SP:218 .vstage-a .feed{gap:16px}` |
| `--sea-space-18` | `18px` | `SP:112 .layout{gap:18px}` |
| `--sea-space-20` | `20px` | `SP:85 .tb-inner{padding:10px 20px}`、`SP:112 .layout{padding:8px 20px 26px}` |
| `--sea-space-22` | `22px` | `SP:98 .ticker{gap:22px}`（基类；A 覆为 26px，见 T36） |
| `--sea-space-26` | `26px` | `SP:211 .vstage-a .ticker{gap:26px}`、`SP:112 .layout{padding:… 26px}`、`SP:181 .foot{padding:16px 20px 26px}` |

### 5.2 栅格与布局尺寸（**两档同值**）

| Token | 值 | 出处 | 备注 |
|---|---|---|---|
| `--sea-shell-max` | `1520px` | `SP:21 .shell{max-width:1520px}` | 比选页外壳；产品页用 `--sea-content-max` |
| `--sea-content-max` | `1440px` | `SP:85 .tb-inner{max-width:1440px}`、`SP:112 .layout{max-width:1440px}` | 与比选稿的 1440px PC 演示宽度一致 |
| `--sea-grid-cols-pc` | `4` | `SP:115 .feed{grid-template-columns:repeat(4,minmax(0,1fr))}` | **取自 A**；B 的 3 列（`SP:291`）废弃，见 T35 |
| `--sea-grid-cols-mobile` | `2` | `SP:116 .feed-m{grid-template-columns:repeat(2,minmax(0,1fr))}` | **取自 A/基类**；B 的 1 列（`SP:328`）废弃，见 T35 |
| `--sea-grid-gap-pc` | `16px` | `SP:218 .vstage-a .feed{gap:16px}` | B 的 13px（`SP:291`）、基类 14px（`SP:115`）不采纳（几何一致性优先，见 T36） |
| `--sea-grid-gap-mobile` | `9px` | `SP:116 .feed-m{gap:9px}` | B 的 8px（`SP:328`）不采纳 |
| `--sea-side-w` | `320px` | `SP:114 .side{flex:0 0 320px}` | PC 右侧栏；`--sea-side-gap` `18px`（`SP:112`） |
| `--sea-card-thumb-h` | PC `150px` / 手机 `118px` | `SP:189 .page .thumb{height:150px}`、`SP:190 .feed-m .card .thumb{height:118px}` | 两档同值；B 的「手机行式缩略图 116px 宽」废弃（T35） |
| `--sea-tabbar-cols` | `5` | `SP:169 .tabbar{grid-template-columns:repeat(5,1fr)}` | 两档同值；**夜间档不得增减格**（切换入口不得塞进底栏，见 T46） |
| **`--sf-st-tabbar-cols`**〔**取代上一行 `--sea-tabbar-cols` · 2026-10-24 裁定**〕 | **`4`** | **`SP:1192 .tabbar{display:grid;grid-template-columns:repeat(4,1fr)}`** —— `docs/design/style-preview.html` **尾部纯追加块 `L1188–1193`**（新真源行 = **`L1192`**）；**上一行的 `SP:169` + 值 `5` 为历史留痕、不作应用值** | 移动底栏取消【卖闲置】⇒ **恒 4 格**（`T123`）；两档同值；**夜间档不得增减格**（切换入口不得塞进底栏，`T46` 取代注）。**四处同动**（§27.3）：真源追加行 `L1192` · `frontend/src/theme/tokens.js:421` `'tabbar-cols': '4'` · `STRUCT_PROV['tabbar-cols']`（`tokens.js:465`）`{d:[1192,…],n:[1192,…]}` · `frontend/src/theme/theme-tokens.css:24` `--sf-st-tabbar-cols: 4`。**PROV 硬门 `theme-tokens.test.js` 已绿** |
| `--sea-fab-size` | `46px × 46px`，`margin-top:-16px` | `SP:173 .tabbar .fab{width:46px;height:46px;…margin-top:-16px}` | 两档同值 |
| `--sea-avatar-size` | `30px` / `--sea-avatar-sm-size` `19px` | `SP:93 .avatar{width:30px;height:30px}`、`SP:128 .avatar.sm{width:19px;height:19px}` | 两档同值（形状可变，尺寸不可变，T27） |
| `--sea-logo-size` | PC `46px` / 手机 `36px` | `SP:562`（`width="46" height="46"`）、`SP:734`（`36`） | 来自 HTML 模板，属几何 |

### 5.3 断点

| Token | 值 | 说明 |
|---|---|---|
| `--sea-bp-mobile-max` | **`767px`** | 手机竖向上界。**★ v1.1 原位更正**（原记 `639px`，本册自身裁定 **639 作废**）：**实现真源 = `frontend/src/shell/breakpoints.js:11` `phonePortraitMax: 767`**（可复跑判据 `grep -n phonePortraitMax frontend/src/shell/breakpoints.js` ⇒ `767`）。实测：390/375/320 档 `matchMedia('(max-width:767px)')=true`、tabbar `display:grid`；1440 档 tabbar `display:none` ⇒ 切档行为落在 767，非 639。**639 之误的理由链**：① 实现真源实测可复跑 = 767（上）；② **639 源自比选稿 375px 演示框的缩放显示**（`SP:868-880` 用 `transform:scale()` 缩放，本册 §11 `N12` 已登记「那不是真机视口」）；③ 640–767 为常见机型/折叠屏区间，取 639 会令其**落回 PC 档**；④ Kevin 2026-10-11 裁定。⇒ 手机档 = 2 列 + 底栏 Tab + 无侧栏。 |
| `--sea-bp-tablet-min/max` | **`768px / 1023px`** | 【本册建议·一句话可改】**★ v1.1 连带更正**（原记 `640px / 1023px`，系旧 `639px` 的 +1 邻档）：中间档：仍 2 列（或 3 列，需与两档一致），保留侧栏折叠，允许横向滚动的行情条。实现侧 768–1023 走「宽屏同一套 DOM、栅格降为 2 列」的过渡，**不新增骨架**（`frontend/src/shell/breakpoints.js:8`）。 |
| `--sea-bp-pc-min` | `1024px` | PC 横屏（比选稿实测 **1440px**，`SP:501`）：**4 列** + 右侧栏 320px |
| `--sea-bp-pc-side-min` | `1280px` | 【本册建议·一句话可改】≥1280 才显示 320px 侧栏，否则主区满宽（4 列宽度更有余量） |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T34** | 【本册裁定】断点值本身**不是可切换 token**（两档同值）；`@media` 查询里不得出现主题相关分支（主题只走 `.dark` 类，T6）。 | `tokens.css` / `theme.css` | 「夜间用更少列」= 违反 T2 / T35 |
| **T35** | 【本册裁定】**废弃 B 的两处结构级差异**：① `SP:291 .vstage-b .feed{grid-template-columns:repeat(3,…)}` 的 3 列；② `SP:328-334` 手机端「1 列 + `flex-direction:row` 卡内横排 + 116px 缩略图」的整体版式。两者均为**结构差异**，按 §5.3.1 必须废弃。手机端一律为 **2 列竖排卡**（A/基类，`SP:116`）。 | `--sea-grid-cols-pc` / `--sea-grid-cols-mobile` | 这是「综合 A 和 B」最容易搞错的地方：**列数不参与综合**，只取 A |
| **T36** | 【本册裁定】两档在**间距/栅格/gap** 上的取值冲突（A `feed gap 16px`、`ticker gap 26px`、`cats padding-top 14px` vs B `13px`/基类 `22px`）一律**取 A**；基类段（`SP:79-194`）已有的值（如 `.feed-m gap 9px`）直接采用。理由：间距栅格属 T10① 的几何 token，两档必须同值，而既然列数取 A，间距节奏也必须同源。 | §5.1 / §5.2 | 禁止「PC 用 A 的 16px、手机用 B 的 8px」这类混搭 |
| **T37** | 【本册裁定】`--sea-space-*` 使用 4px 基线的**离散档位**（见 5.1），不在组件里写任意 px 值。表中 `5px/7px/9px/11px/13px` 等奇数档来自稿件原值，**允许保留**，但**不得新增表外的档位**（如 `15px`）。 | §5.1 | 新增档位需回到本册 |

---

## §6 主题实现契约

### 6.1 token 声明位置与结构（`frontend/src/styles/tokens.css`，建议路径）

```css
/* 1) 观感 token：两档两值 —— 只有这一层随主题切换 */
:root {
  --sea-surface-page:#FDE815;      /* SP:200 */
  --sea-surface-elevated:#FFFFFF;  /* SP:219 */
  --sea-fg:#0A0A0A;                /* SP:200 */
  --sea-border:#030402;            /* SP:219 */
  --sea-radius-lg:13px;            /* SP:219 */
  --sea-border-w:1.5px;            /* SP:204/219 */
  --sea-shadow-card:3px 3px 0 var(--sea-shadow-color); /* SP:219 */
  --sea-shadow-color:#030402;
  --sea-focus-ring:#030402;
  --sea-focus-ring-invert:#FDE815;
  /* …其余观感 token 见 §2 / §3 */
}
:root.dark {
  --sea-surface-page:#0B0C0E;      /* SP:273 */
  --sea-surface-elevated:#141619;  /* SP:292 */
  --sea-fg:#E8EAED;                /* SP:273 */
  --sea-border:#262A30;            /* SP:292 */
  --sea-border-strong:#8A9099;     /* 见 T19/T22 */
  --sea-radius-lg:2px;             /* SP:292 */
  --sea-border-w:1px;              /* SP:292 */
  --sea-shadow-card:none;          /* SP:292 未声明投影 */
  --sea-shadow-color:transparent;
  --sea-focus-ring:#FDE815;
  --sea-focus-ring-invert:#0B0C0E;
}

/* 2) 几何 token：两档同值，只声明一次（T10① / T29 / T34）—— 放在 :root，不在 .dark 覆盖 */
:root {
  --sea-space-16:16px;             /* SP:218 */
  --sea-grid-cols-pc:4;            /* SP:115 */
  --sea-grid-gap-pc:16px;          /* SP:218 */
  --sea-fs-price-num:21px;         /* SP:226 */
  --sea-card-thumb-h:150px;        /* SP:189 */
  --sea-font-sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Helvetica Neue","Microsoft YaHei",Arial,sans-serif; /* SP:16 */
  --sea-font-num:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;      /* SP:285 */
  --sea-num-tabular:tabular-nums;  /* SP:102/125/140/156/179 */
}

/* 3) 主题切换同时驱动 color-scheme（原生控件/滚动条随之变色） */
:root { color-scheme: light; }
:root.dark { color-scheme: dark; }
```

Tailwind 4 侧（`frontend/src/styles/theme.css`，建议路径）：

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));   /* T6：class 策略，禁用 prefers-color-scheme */

@theme inline {
  /* 只做「注册」，真实值仍走 var() ⇒ .dark 覆盖自动生效 */
  --color-sea-page:     var(--sea-surface-page);
  --color-sea-elevated: var(--sea-surface-elevated);
  --color-sea-fg:       var(--sea-fg);
  --color-sea-accent:   var(--sea-accent);
  --color-sea-border:   var(--sea-border);
  --radius-sea-lg:      var(--sea-radius-lg);
  --spacing-sea-16:     var(--sea-space-16);
  --font-sea-num:       var(--sea-font-num);
}
```

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T38** | 【已冻结口径】主题态挂在 **`<html>` 元素**上，使用 **`.dark` 类**（T6 的 class 策略必需），同时镜像到 `data-theme` 供 CSS/测试选择与调试：`<html class="dark" data-theme="dark">`。**`light` 档不挂 `.light` 类**，只挂 `data-theme="light"`（`:root` 即日档默认值）；禁止给 `<body>` 或某个 App 容器挂主题类（会导致 `position:fixed` 元素/Portal 逃逸）。 | `index.html`、`ThemeProvider` | Tailwind 的 `dark:` 变体、`@custom-variant` 均以 `<html>.dark` 为基准 |
| **T39** | 【已冻结口径】token 声明位置：**只允许** `tokens.css`（上表 1、2、3 三段）与 `theme.css` 的 `@theme` 注册块。**组件内不得声明 `--sea-*` 值**（可读不可写）。 | `tokens.css` / `theme.css` | grep 判负：除这两个文件外，`frontend/src/**` 内出现 `--sea-.*:` 赋值即判负（T70） |
| **T40** | 【本册裁定】观感 token 与几何 token 必须**分行分段集中声明**（上表 1 段 vs 2 段）。凡「几何 token」出现在 `:root.dark` 块里 ⇒ 判负（说明它被当成了可切换值，T10① / T29）。 | `tokens.css` | 这是 T69 的最直接静态守卫 |
| **T41** | 【已冻结口径】切换入口位置：**PC 顶栏** `.tb-inner` 内、`.me` 账号胶囊的**右侧**（图标按钮，`aria-label="切换日间/夜间模式"`，`aria-pressed` 反映当前态，**不使用 emoji**：日/夜两态用同一个内联 SVG 的 `currentColor`，日档显示「月亮（切到夜间）」、夜档显示「太阳（切到日间）」）；**手机端**入口在「我的」页设置区（见 T46：底栏保持 5 格不动）。 | `ThemeToggle.jsx` | 入口必须永远可见（PC 顶栏在日/夜两档都是可见区域）；不得只在「我的」页里藏一个开关 |
| **T42** | 【已冻结口径】持久化：`localStorage["sea.theme"]`，取值仅 `"light"` \| `"dark"` 两个字面量。**不存 `"system"`** ——「跟随系统」的表达方式就是**没有这个键**。切换时同步写 `class`/`data-theme`/`color-scheme`/`localStorage` 四件套（同一次同步调用内完成，避免中间态被渲染）。 | `theme.js` | 键名与取值双写死，禁止 `theme`/`mode`/`sea-theme` 等变体命名（多版本共存会导致「切换后刷新又变回去」） |
| **T43** | 【已冻结口径】首次访问跟随系统：无 `localStorage["sea.theme"]` 时读 `matchMedia('(prefers-color-scheme: dark)').matches` 决定初始档；并在**未显式选择过**的前提下监听该媒体查询的 `change` 事件，跟随系统实时切换；一旦用户点击过切换入口（键已写入），**停止跟随**（移除监听或忽略事件）。 | `theme.js` | 禁止把 `change` 监听写成「永远跟随」（会覆盖用户选择） |
| **T44** | 【已冻结口径 / 防 FOUC】内联脚本放在 `index.html` 的 **`<head>` 内、且位于主 CSS `<link>`/样式入口之后、`<body>` 之前**，必须是**同步**脚本（不得 `defer`/`async`/`type="module"`），内容为：读 `localStorage` → 兜底 `matchMedia` → 立刻写 `<html>.classList` + `dataset.theme` + `style.colorScheme`。**任何主题判定都不得等到 React 挂载后才发生**（否则首帧会出现黄底闪一下再变黑，或反之）。 | `index.html` | 判负方法：T72（在 `DOMContentLoaded` 之前读取 `documentElement.className`，必须已是正确档位） |
| **T45** | 【本册裁定】切换时**不得触发重新挂载**：主题只改 `<html>` 上的类与 CSS 变量，**禁止**把 `theme` 作为 React `key`、禁止条件渲染两套组件树、禁止整页 reload。 | `ThemeProvider` | 违反会中断用户操作（搜索框失焦、列表滚动位置丢失） |
| **T46** | 【本册裁定】底栏 Tab 恒为 **5 格**（`--sea-tabbar-cols`，`SP:169`），两档一致；**主题切换入口不得占用底栏格位**（§5.3.1 要求交互同构 + T35 的列数一致性）。 | `TabBar` | 若产品坚持手机端「快捷切换」，只能加在顶栏搜索框左侧的图标位（该位置两档都有），不得改底栏 |
| **T46**〔**2026-10-24 取代注**〕 | 【本册裁定】**底栏 Tab 恒为 4 格**（STRUCT token `--sf-st-tabbar-cols`，真源 **`SP:1192`**），两档一致；**主题切换入口不得占用底栏格位**（§5.3.1 要求交互同构 + `T35` 的列数一致性，**逐字不变**）。**同行旧句「底栏 Tab 恒为 5 格（`--sea-tabbar-cols`，`SP:169`）」已被 2026-10-24 裁定取代、旧字面逐字保留。** | `TabBar` / `frontend/src/shell/BottomTabBar.jsx` | 同行旧避让条（「若产品坚持手机端『快捷切换』…不得改底栏」）**逐字不变**；**格数由 STRUCT token 承载 ⇒ 改格数须四处同动**（真源追加行 + `tokens.js` 值 + `STRUCT_PROV` + `theme-tokens.css`，见 §27.3） |
| **T47** | 【本册裁定】`prefers-reduced-motion` 语义也走同一套 class 策略之外的媒体查询（允许），但**主题相关的一切不得用媒体查询**（T6）。 | `tokens.css` | 不要把两件事混在一个 `@media` 块里 |
| **T48** | 【本册裁定】主题切换**不得改变 `document.documentElement.scrollWidth`**（§5.3.7 结尾「不得造成任何元素位移或横向溢出」）：因为 §3 已把所有描边改为零占位、投影不影响布局、圆角不改变几何，故 `scrollWidth` 两档必须逐值相等。 | 全站 | 判负方法：T73（两档 `scrollWidth`/`scrollHeight` 必相等） |

> **★ v1.14 主题章就地注（三则 · 原表 `T38`–`T48` 一字未改）**：
> - **真机诊断定案 · 补记**：真机配色归因已定案（§17.3：手机实站内 `html[data-theme]=dark` / `.sf-shell` 背景 `rgb(11,12,14)` / 色卡 9/9 回读精确）⇒ **夜档 = 该 origin 存储的显式选择**（`localStorage['theme']='dark'`，**按 origin 隔离**），**非浏览器强制深色**（UA forced dark 已排除）；**Kevin 已确认（2026-10-12）真机「切到日档」正常**。初始默认取值序见 **`T93`**（§18.1）。
> - **`T42` 键名勘误（原行一字未改）**：本行冻结的 `localStorage["sea.theme"]` 与实现不符 —— **实现自始用 `localStorage['theme']`**（现取 `frontend/src/theme/tokens.js:23` `THEME_STORAGE_KEY='theme'` · `ThemeProvider.jsx:5` 注释 · `main.jsx:14`）；「取值仅 `"light" | "dark"` 两字面 · 不存 `"system"`」逐字成立。**键名现行口径以 `T93` 为准 = `localStorage['theme']`，仅由顶栏/面板的主题开关写入**。
> - **`T43` 机制取代（原行一字未改）**：本行「`theme.js` 读 `matchMedia` + 监听 `change`」**未按此落地**，且与既有硬断言相抵触（`theme-shell-isomorphism.test.jsx:205-213`：shell/theme 的 JS 无 `matchMedia`/`innerWidth`，**一字不动维持**）。**现行口径 = `T93`**：`matchMedia` 只许在 `frontend/index.html` 内联脚本；跟随系统 = 内联脚本设 `data-theme`（**不落盘** ⇒ 每次加载重读系统档、系统后续变化仍可跟随）+ `readInitialTheme()` 属性＞存储＞默认顺序自然生效；用户显式切换写入 `localStorage['theme']` 后存储优先 ⇒ 自动停止跟随（本行判负列「不得永远跟随」由 `T93` 配套①承接）。

---

## §7 组件级规格（每组件日/夜两套）

> 通用约束（每条都已在前面独立编号，此处复述以免组件实现遗漏）：**结构两档完全相同**（T2）；**描边一律零占位 `box-shadow`**（T23）；**只允许 `var(--sea-*)`**（T5/T39）；**几何量（尺寸/内边距/字号/间距）两档同值**（T10①/T29/T36）；**数字一律等宽 + `tabular-nums`**（T28）；**状态不得仅靠颜色**（T61）；**焦点环必须可见**（T64）。

### 7.1 顶栏 `.topbar` / `.tb-inner`（`SP:84-86`、`SP:201-209`、`SP:274-282` / 模板 `SP:560-567`）

| 部位 | 日间档（A） | 夜间档（B） | 所用 token |
|---|---|---|---|
| 顶栏底 | 品牌黄铺满 | 深底 + **黄色 1px 下边线** | `--sea-topbar-bg`（`#FDE815` / `#0B0C0E`）、`--sea-topbar-line`（`#030402` / `#FDE815`）、`--sea-border-w-frame`（`2px` / `1px`） |
| 结构/尺寸 | `.tb-inner` `display:flex; gap:14px; padding:10px 20px; max-width:1440px`；品牌 Logo 46px + 文字 17px/900；搜索框 `flex:1`；发布按钮；账号胶囊 | **完全相同** | `--sea-space-14`、`--sea-space-20`、`--sea-content-max`、`--sea-logo-size`、`--sea-fs-brand` |
| 品牌字 | `#0A0A0A` / 900 / `letter-spacing:.02em` | `#F5F6F7` / 900 / **`.02em`（不取 B 的 `.04em`，T33）** | `--sea-fg`（夜档用 `--sea-fg-strong` 更亮：`#F5F6F7`，`SP:276`） |
| Logo 容器圆角 | `11px`（`SP:202`） | `2px`（`SP:275`） | `--sea-radius-md` |
| 下边线实现 | **必须 `box-shadow: inset 0 calc(-1 * var(--sea-border-w-frame)) 0 0 var(--sea-topbar-line)`**，不得用 `border-bottom` | 同 | T23（否则 2px vs 1px 会让整个页面下移 1px） |

### 7.2 搜索框 `.search`（`SP:89-90`、`SP:204-205`、`SP:277-278`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 字 | `#FFFFFF` 底、`#0A0A0A` 字 | `#15171B` 底、`#8A9099` 提示字 | `--sea-surface-input`、`--sea-fg` / `--sea-fg-muted` |
| 描边 | `1.5px #030402` | **`1px #8A9099`（原稿 `#33373D` 实测仅 1.50:1，见 T19/T22 升级）** | `--sea-border-strong`（这是「必需的 UI 边界」，T22） |
| 投影 | `2px 2px 0 #030402` 硬投影 | `none` | `--sea-shadow-control` |
| 圆角 | `11px` | `2px` | `--sea-radius-md` |
| 图标 | `color:#030402` | `color:#FDE815`（B 的强调用法） | `--sea-fg` / `--sea-accent` |
| 几何 | `display:flex; gap:8px; padding:9px 14px; font-size:13.5px`；手机 `padding:7px 11px; font-size:12.5px`（`SP:166`） | 同 | `--sea-space-8/9/14`、`--sea-fs-search` |
| 提示文案 | 占位文本用 `--sea-fg-muted`（**不得**用 `--sea-fg`，否则与已输入值不可区分） | 同 | 占位文字对比 ≥4.5:1（§8） |

### 7.3 发布按钮 `.btn-pub`（主按钮）（`SP:91`、`SP:206`、`SP:279`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 字 | `#030402` 底、`#FDE815` 字 | `#FDE815` 底、`#0B0C0E` 字 | `--sea-fg`（黑）/`--sea-accent` 与 `--sea-accent`/`--sea-accent-fg` |
| 圆角 | `11px` | `2px` | `--sea-radius-md` |
| 投影 | `2px 2px 0 rgba(3,4,2,.35)` | `none` | `--sea-shadow-btn` |
| 字重/字距 | `800` / 无 | `900` / **`.02em`（不取 B 的 `.04em`，T33）** | `--sea-fs-btn` 的 800（两档同值，T32） |
| 几何 | `padding:9px 16px; font-size:13.5px`；手机 `padding:8px 12px`（`SP:250`）/ B 手机 `8px 11px`（`SP:327`）⇒ **取 A 的 `8px 12px`** | 同 | `--sea-fs-btn`、T36 |
| 悬停 | 底 `--sea-accent-hover`（`#FFC44D`），字不变 | 同 | `--sea-accent-hover` |
| 禁用 | `--sea-surface-disabled` 底 + `--sea-fg-disabled` 字 + `cursor:not-allowed` + `aria-disabled` | 同 | T58 |

### 7.4 商品卡 `.card`（`SP:117-131`、`SP:219-230`、`SP:292-303`）

| 部位 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 卡 | 白底 + `1.5px #030402` + `13px` 圆角 + `3px 3px 0 #030402` | `#141619` 底 + `1px #262A30` + `2px` 圆角 + 零投影 | `--sea-surface-elevated`、`--sea-border`、`--sea-radius-lg`、`--sea-shadow-card`（夜 `none`） |
| 图片位 | `150px` 高（手机 `118px`），**下边线 1.5px 黑**（`SP:220`） | 同高，**下边线 1px `#262A30`**（`SP:293`） | `--sea-card-thumb-h`、`--sea-border-media`（T8：图片位必须带描边/底衬） |
| 图片占位字 | `rgba(3,4,2,.30)` / 46px / 900 | `rgba(253,232,21,.20)` / **46px（不取 B 的 52px，T30）** | `--sea-glyph`、`--sea-fs-glyph` |
| 角标 `.badge` | `#030402` 底 / `#FDE815` 字 / `6px`：如「死蟹包赔」 | `#FDE815` 底 / `#0B0C0E` 字 / `2px` | `--sea-badge-bg`/`--sea-badge-fg`、`--sea-radius-badge` |
| 标题 | `#0A0A0A` / 13.5px / 600 / 2 行截断 | `#EDEFF2` / **13.5px（不取 B 的 13px，T30）** / 600 | `--sea-fg-strong`、`--sea-fs-card-title` |
| 价格 | **黄底胶囊**：`#FDE815` 底 + `1.5px #030402` + `8px` 圆角；`$` 与数字 `#030402`，数字 21px/900 | **无底衬**，数字与 `$` 为 `#FDE815`，21px/900 **等宽**，下方 1px `#22262B` 分隔 | `--sea-price-bg`（夜 `transparent`）、`--sea-price-fg`、`--sea-price-cur`、`--sea-price-border`、`--sea-price-unit`、`--sea-fs-price-num`、`--sea-font-num` |
| 单位 `/8只装` | `#3A3A2A` | `#8A9099` | `--sea-price-unit` |
| 卖家行 `.meta` | `#3D3D3D`，头像 `#030402` 圆底黄字 | `#8A9099`，头像 `#22262B` 底 `#D7DBE0` 字 **2px 方角** | `--sea-fg-secondary`、`--sea-surface-subtle`、`--sea-radius-avatar` |
| 标签 `.tags span` | `#FFF7B8` 底 + `1px #030402` + `5px` + `#0A0A0A` | 透明底 + `1px #2A2D33` + `2px` + `#A9AFB7` | `--sea-tag-bg`/`--sea-tag-fg`/`--sea-border-tag`/`--sea-radius-xs` |
| 悬停 | 卡底 `--sea-surface-hover` + 描边转 `--sea-accent`（不移动、不缩放） | 同机制 | T21 |

### 7.5 招工卡 `.job-card`（`SP:133-147`、`SP:231-238`、`SP:304-313`）

| 部位 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 卡 | **整块黑底** `#030402` + 白字 + `1.5px #030402` + `13px` + `3px 3px 0 rgba(3,4,2,.4)` | `#141619` 底 + **`1px #FDE815` 全描边 + `4px #FDE815` 左强调条** + `2px` + 零投影 | `--sea-jobcard-bg`、`--sea-jobcard-fg`、`--sea-jobcard-accent-bar`（日 `0` / 夜 `4px`，**用 `inset 4px 0 0 0 #FDE815` 实现，T23**） |
| 标记 `.job-tag` | `#FDE815` 底 / `#030402` 字 / `5px` / 11px / 900 | 同色，`2px` 圆角 | `--sea-radius-xs`、`--sea-fs-job-tag` |
| 酬金 | `$` + 数字 `#FDE815`，24px/900；单位 `#E8E8C8` | 同色 `#FDE815`，**24px（不取 B 的 30px，T30）**，**等宽**（T28） | `--sea-fs-job-pay-num`、`--sea-font-num`、`--sea-jobcard-fg` |
| 说明列表 | 文字 `#C9C9B8`，圆点 `currentColor + .45` | 文字 `#A9AFB7`，圆点 `#FDE815 + .7` | `--sea-jobcard-fg-muted`、`--sea-jobcard-bullet` |
| 发布方 | `#9A9A88` | `#8A9099`（原稿 `#6B7079` 升级，T19） | `--sea-jobcard-fg-faint` |
| 报名按钮 `.btn-sm` | `#FDE815` 底 / `#030402` 字 / `9px` | `#FDE815` 底 / `#0B0C0E` 字 / `2px` | `--sea-radius-btn-sm`、`--sea-fs-btn-sm` |
| 布局 | `flex-direction:column; gap:9px; padding:13px 14px`；PC 占 1 列 | **完全相同**（B 的手机端行式卡已废弃，T35） | `--sea-space-9/13/14` |

### 7.6 行情条 `.tickwrap` / `.ticker`（`SP:97-105`、`SP:210-214`、`SP:283-287`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 字 | **深色条** `#030402` + 白字（黄只打币对） | `#111317` 底 + `1px #24272C` 下边线 | `--sea-ticker-bg`、`--sea-ticker-fg` |
| 币对 `KONG / $` | `#FDE815`，12.5px/700 | `#9AA0A8`，12.5px/700 | `--sea-ticker-pair` |
| 价 | `#FFFFFF`，13px/800，**等宽 + tabular-nums** | `#FDE815`，13px/800，**等宽 + tabular-nums** | `--sea-ticker-fg`、`--sea-font-num`、T28 |
| 涨跌 | `▲ 2.31%` / `#3DDC84`；`▼ 0.74%` / `#FF7A7A`（**底衬已是深色 `#030402`，故 11.51:1 / 8.14:1 ✅**） | `#3DDC84` / `#FF6B6B`（10.97:1 / 7.05:1 ✅） | `--sea-up`、`--sea-down`、**符号 ◀ 必须存在（T61）** |
| 备注 `.tk-note` | 白字 `opacity:.7`（`SP:105`） | `#8A9099`（原稿 `#6B7079` 升级，T19） | `--sea-ticker-note` |
| 几何 | `gap:26px`（A 值，T36）；`padding:8px 20px`；手机可横滑 + 右缘 mask 渐隐（`SP:188`） | **完全相同** | `--sea-space-26`、`--sea-space-8/20` |

### 7.7 底部 Tab 栏 `.tabbar`（`SP:168-174`、`SP:252-255`、`SP:336-339`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 上边线 | `#FFFFFF` + `2px #030402` 上边线 | `#0B0C0E` + `1px #262A30` | `--sea-tabbar-bg`、`--sea-tabbar-border`、`--sea-border-w-frame` |
| 普通格 | `#6B6B5A`，10.5px/600 | `#8A9099`（原稿 `#6E747C` 4.15:1 ⇒ 升级，T19），10.5px/600 | `--sea-tab-fg` |
| 选中格 | `#030402`，800 + `aria-current="page"` | `#FDE815`，800 + `aria-current="page"` | `--sea-tab-fg-active`、**不得仅靠颜色（T61）：选中态必须同时改字重** |
| 中央 FAB | `#030402` 底 / `#FDE815` 图标 / `14px` / `0 3px 0 rgba(3,4,2,.28)` | `#FDE815` 底 / `#0B0C0E` 图标 / `2px` / 零投影 | `--sea-radius-fab`、`--sea-shadow-fab` |
| 几何 | `grid-template-columns:repeat(5,1fr)`；FAB `46×46`、`margin-top:-16px` | **完全相同**（含格数，T46） | `--sea-tabbar-cols`、`--sea-fab-size` |
| **几何**〔**2026-10-24 取代注**〕 | `grid-template-columns:repeat(4,1fr)`（**恒 4 格**，`T123`）；FAB `46×46`、`margin-top:-16px` | **完全相同**（含 4 格，`T46` 取代注） | `--sf-st-tabbar-cols`、`--sea-fab-size`。**上一行「`repeat(5,1fr)`」已被 2026-10-24 裁定取代、旧字面逐字保留**；新 PROV = `SP:1192`（旧 `SP:169` 为历史留痕） |
| 图标尺寸 | 22px（`SP:171/174`） | 同 | 几何 token |

### 7.8 按钮三态（主 / 次 / 幽灵）

| 类型 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| **主按钮**（发布/报名/提交） | `#030402` 底 + `#FDE815` 字（如 `.btn-pub`）或 `#FDE815` 底 + `#030402` 字（如 `.btn-sm`，`SP:237`） | 反向：`#FDE815` 底 + `#0B0C0E` 字 | `--sea-accent`、`--sea-accent-fg`、`--sea-fg` |
| **次按钮**（取消/查看全部） | 透明底 + `1.5px #030402` 描边 + `#0A0A0A` 字 + `11px` 圆角（沿用 A 的「白底黑描边」控件语言 `SP:204/207/216`） | 透明底 + `1px #8A9099` 描边 + `#C4C9D0` 字 + `2px` 圆角 | `--sea-border-strong`、`--sea-fg-secondary`、`--sea-radius-md` |
| **幽灵按钮**（面板「去交易 →」类链接） | `#0A0A0A` 字 + **下划线**（`SP:241`） | `#FDE815` 字 + **无下划线**（`SP:316`）⇒ 统一为 **黄/黑强调色 + 下划线**（T61：形态两档一致） | `--sea-accent-fg`（日）/`--sea-accent`（夜） |
| 共同 | 高度由 `padding + 字号` 决定（两档同值）；悬停只改 **颜色/描边色**；`:focus-visible` 出焦点环（T64）；`<button>` 且 `type="button"` | 同 | T21 / T23 / T64 |

### 7.9 徽标 / 标签（`.badge` / `.tags span` / `.chip`）

| 类型 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 商品图角标 `.badge` | `#030402` 底 / `#FDE815` 字 / `6px` / 11px/700 | `#FDE815` 底 / `#0B0C0E` 字 / `2px` / 11px/700 | `--sea-badge-*`、`--sea-radius-badge`、`--sea-fs-badge` |
| 属性标签 `.tags span` | `#FFF7B8` 底 / `1px #030402` / `#0A0A0A` / `5px` | 透明底 / `1px #2A2D33` / `#A9AFB7` / `2px` | `--sea-tag-*`、`--sea-border-w-tag`（两档同 1px） |
| 招工标记 `.job-tag` | `#FDE815` 底 / `#030402` 字 / 11px/**900** | 同色 / `2px` 圆角 | `--sea-radius-xs`、`--sea-fs-job-tag` |
| 选中态（分类 `.cat.on`） | `#030402` 底 / `#FDE815` 字 / `999px` / 800 | `#FDE815` 底 / `#0B0C0E` 字 / `2px` / 900 ⇒ **字重取 800**（T32） | `--sea-radius-pill`、`--sea-fg`+`--sea-accent` |

### 7.10 输入框（表单，区别于顶栏搜索框）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 | `#FFFFFF` | `#15171B` | `--sea-surface-input` |
| 描边 | `1.5px #030402`（A 的控件语言） | `1px`，**必须 `--sea-border-strong`（`#8A9099`，5.58:1 ✅）；禁用 B 原稿的 `#33373D`（1.50:1 ❌）** | `--sea-border-strong`、`--sea-border-w` |
| 圆角 | `11px` | `2px` | `--sea-radius-md` |
| 投影 | `2px 2px 0 #030402`（沿用 A 的控件投影） | `none` | `--sea-shadow-control` |
| 内文 / 占位 | `#0A0A0A` / 占位 `--sea-fg-muted`（`#6B6B5A`，5.42:1 ✅） | `#E8EAED` / 占位 `#8A9099`（5.58:1 ✅） | `--sea-fg`、`--sea-fg-muted` |
| 聚焦 | 描边转 `--sea-focus-ring`（`#030402`）+ 2px 焦点环 + 2px 间隙 | 描边转 `--sea-focus-ring`（`#FDE815`）+ 同规格环 | `--sea-focus-ring`、`--sea-focus-w`、`--sea-focus-offset` |
| 错误 | 描边 `--sea-down-on-light`（`#E5484D`）+ **必配文字/图标**（T61） | 描边 `--sea-down`（`#FF6B6B`）+ 文字/图标 | `--sea-up` / `--sea-down` 系 |
| 禁用 | `--sea-surface-disabled` 底 + `--sea-fg-disabled` 字 + `aria-disabled` | 同机制 | T58 |

### 7.11 空态 / 加载 / 错误三态

| 态 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| **空态** | 居中说明文字 `#4A4A2E`（`SP:256 .empty-note`，7.24:1 ✅）+ 一个幽灵按钮（「去看看」）+ 无插画（稿件无插画资产） | `#8A9099`（原稿 `#5C6169` 3.14:1 ⇒ 升级，T19） | `--sea-fg-muted-on-accent`（日）/`--sea-fg-muted`（夜） |
| **加载态** | 骨架屏：`rgba(253,232,21,.35)` 块 + 卡内文字行骨架；`role="status" aria-busy="true"`；**骨架必须与真实卡片几何逐值相同**（同 padding、同 thumb 高、同行数） | `rgba(253,232,21,.16)` | `--sea-surface-skeleton`、`--sea-card-thumb-h` |
| **加载态（列表尾部）** | 稿件原文案：`— 正在加载更多 · 已按 $ 价格排序 —`（`SP:831`），11.5px | 同文案，颜色 `--sea-fg-muted` | `--sea-fs-empty` |
| **错误态** | 稿件**未定义**：本册指派 = `--sea-down-on-light`（`#E5484D`）图标 + 文字 + 「重试」次按钮；**必须有图标与文字，不得只靠红色**（T61） | `--sea-down`（`#FF6B6B`）+ 文字 + 「重试」 | 【本册指派】 |
| 三态共同 | 三态都必须**撑满与内容态相同的容器高度**（否则切换态时列表跳动 ⇒ 影响 T69/T73 的判定语义）；均带 `role` + `aria-live` 语义 | 同 | T50 |

### 7.12 侧栏面板 `.panel`（PC）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 面板 | 白底 + `1.5px #030402` + `13px` + `3px 3px 0 #030402` | `#141619` + `1px #262A30` + `2px` + 零投影 | 同卡片 |
| 面板内分隔 `.hr` | `#030402` + `opacity:.18`（1.51:1，**装饰性，T22**） | `#262A30` + `opacity:1` | `--sea-divider` |
| 行情行 `.prow .rt` | `#0A0A0A` + **等宽** | `#C4C9D0` + **等宽** | `--sea-font-num`（T28） |
| 招工行 `.jrow .jp` | `#030402` 字 + `#FDE815` 底 + `5px` | `#FDE815` 字 + 透明底 + **等宽** | `--sea-accent`、`--sea-radius-xs` |
| 社区规则 `.rule b` | `#2C2C2C`（13.97:1） | `#FDE815`（`SP:321`） | `--sea-fg`/`--sea-accent` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T49** | 上文 7.1–7.12 中每一个「日间档」列与「夜间档」列的**差异项**，必须能映射到 §2/§3 的某个 `--sea-*` token。**组件规格里出现任何字面色值/圆角/阴影 ⇒ 判负**（T5）。 | 全部组件 | 这是「规范可落地」的最直接判据 |
| **T50** | 【本册裁定】三态（空/加载/错误）与内容态**几何必须同构**：同一列表容器在三态下的 `getBoundingClientRect()` 尺寸一致（骨架卡占位与真卡同尺寸、同 gap）。 | `*State` 组件 | 否则「三态切换」会连带违反 T48/T73 的精神（页面跳动） |
| **T51** | 【本册裁定】商品的**状态类**语义（在售/已售/已下架/争议中）**不得只用一个色相区分**：必须「颜色 + 文字/图标」成对（例：已售 = 角标文字「已售」+ 灰度化图片 `filter:grayscale(1)` + 75% 不透明）。灰度化不改变几何，允许。 | `CardStatus` | 与 T61 同源 |
| **T52** | 【本册裁定】`.thumb` 的渐变占位（`t1..t10`）在两档**是两套渐变**（`SP:258-267` 淡彩 / `SP:342-351` 暗彩），这是允许的（T16），但**必须同时具备 `.thumb` 的 `--sea-border-media` 描边**（T8）：B 的暗彩渐变在深底上若不加描边会与卡底糊成一片（实测 `#3E3520` 对 `#141619` 仅约 1.9:1）。 | `--sea-border-media` | 见 §8 实测（`#8A9099` 3.76:1 ✅ / `#FDE815` 9.64:1 ✅） |

---

## §8 可访问性硬指标（含实测对比度表）

**测量口径**：WCAG 2.x 相对亮度；`rgba()` 先与底衬 alpha 合成；"底衬"取该前景**实际所在的**底色（不是页面底）。全部数值为本册**实际计算**所得（脚本见 §11 的复现说明），非估计。

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T53** | 【已冻结口径】**正文与背景对比度 ≥4.5:1**，两档都要。适用对象：卡标题、正文、列表项、按钮文字、标签文字、底栏 Tab 文字、占位符、行情数字、招工卡全部文字。 | §8.1 全表 | 任一对 <4.5 ⇒ 判负 |
| **T54** | 【本册裁定】**不使用「大文本 3:1」豁免**：本册中唯一符合 WCAG 大文本定义的是价格数字（21px / 900，`SP:226`）与酬金数字（24px / 900），它们实测已 ≥14:1，故本册统一按 **4.5:1** 验收，避免「靠字号换阈值」的争议。 | 价格/酬金数字 | 更严无害 |
| **T55** | 【本册裁定】对比度**必须按「前景 × 实际底衬」逐对验收**，禁止只测「前景 × 页面底」：两档都有「同一前景坐在多个底衬上」的情况（如 `--sea-fg-muted` 同时坐在 `--sea-surface-elevated`、`--sea-surface-input`、`--sea-surface-page` 上）。 | §8.1 表 | 这是 B 稿三处弱灰被漏掉的原因（只测卡底会漏掉页底场景） |

### 8.1 文本对比实测（阈值 4.5:1）

**日间档（A）**

| 前景 | 底衬 | 实测 | 判定 |
|---|---|---|---|
| `#0A0A0A` 正文 | `#FDE815` 页底 | **15.77:1** | ✅ |
| `#0A0A0A` 正文 | `#FFFFFF` 卡底 | **19.80:1** | ✅ |
| `#3D3D3D` 次要 | `#FFFFFF` 卡底 | **10.86:1** | ✅ |
| `#6B6B5A` 弱（Tab） | `#FFFFFF` 底栏底 | **5.42:1** | ✅ |
| `#4A4A2E` 弱（黄底） | `#FDE815` 页底 | **7.24:1** | ✅ |
| `#3A3A2A` 价格单位 | `#FDE815` 价格底 | **9.20:1** | ✅ |
| `#030402` 价格数字/`$` | `#FDE815` 价格底 | **16.37:1** | ✅ |
| `#FDE815` 币对 | `#030402` 行情底 | **16.37:1** | ✅ |
| `#FFFFFF` 行情价 | `#030402` 行情底 | **20.55:1** | ✅ |
| `#3DDC84` 涨 | `#030402` 行情底 | **11.51:1** | ✅ |
| `#FF7A7A` 跌 | `#030402` 行情底 | **8.14:1** | ✅ |
| `#FFFFFF` 招工卡正文 | `#030402` 招工卡底 | **20.55:1** | ✅ |
| `#C9C9B8` 招工说明 | `#030402` | **12.26:1** | ✅ |
| `#9A9A88` 招工发布方 | `#030402` | **7.19:1** | ✅ |
| `#E8E8C8` 酬金单位 | `#030402` | **16.44:1** | ✅ |
| `#0A0A0A` 标签字 | `#FFF7B8` 标签底 | **18.15:1** | ✅ |
| `#FDE815` 角标/按钮字 | `#030402` | **16.37:1** | ✅ |
| `#2C2C2C` 社区规则 | `#FFFFFF` | **13.97:1** | ✅ |
| ❌ `#3DDC84` 涨（若放白底） | `#FFFFFF` | **1.78:1** | ❌ **禁用**（见 T63） |
| ❌ `#FF7A7A` 跌（若放白底） | `#FFFFFF` | **2.52:1** | ❌ **禁用**（见 T63） |
| ❌ `#12A150` 涨（若放白底） | `#FFFFFF` | **3.37:1** | ❌ **不足 4.5**（见 T63） |
| ❌ `#E5484D` 跌（若放白底） | `#FFFFFF` | **3.91:1** | ❌ **不足 4.5**（见 T63） |

**夜间档（B）**

| 前景 | 底衬 | 实测 | 判定 |
|---|---|---|---|
| `#E8EAED` 正文 | `#0B0C0E` 页底 | **16.24:1** | ✅ |
| `#EDEFF2` 卡标题 | `#141619` 卡底 | **15.73:1** | ✅ |
| `#C4C9D0` 次要 | `#0B0C0E` / `#141619` | **11.75 / 10.89:1** | ✅ |
| `#A9AFB7` 弱（列表） | `#141619` | **8.20:1** | ✅ |
| `#8A9099` 弱（本册升级值） | `#141619` / `#15171B` | **5.64 / 5.58:1** | ✅ |
| `#8A9099` 弱 | `#0B0C0E` 页底 | **6.08:1** | ✅ |
| `#FDE815` 强调 | `#0B0C0E` / `#141619` | **15.59 / 14.44:1** | ✅ |
| `#0B0C0E` 按钮字 | `#FDE815` 按钮底 | **15.59:1** | ✅ |
| `#3DDC84` 涨 | `#0B0C0E` / `#141619` | **10.97 / 10.16:1** | ✅ |
| `#FF6B6B` 跌 | `#0B0C0E` / `#141619` | **7.05 / 6.53:1** | ✅ |
| `#9AA0A8` 币对 | `#111317` 行情底 | **7.06:1** | ✅ |
| `#D7DBE0` 头像字 | `#22262B` 头像底 | **10.94:1** | ✅ |
| ❌ `#6B7079` 原稿弱灰 | `#141619` 卡底 | **3.64:1** | ❌ **不得用于文本** → 升级为 `#8A9099`（T65） |
| ❌ `#6B7079` 原稿弱灰 | `#111317` 行情底 | **3.74:1** | ❌ 同上 |
| ❌ `#6E747C` 原稿 Tab 灰 | `#0B0C0E` 底栏底 | **4.15:1** | ❌ 同上（差 0.35） |
| ❌ `#5C6169` 原稿空态灰 | `#0B0C0E` 页底 | **3.14:1** | ❌ 同上 |

### 8.2 非文本元素对比实测（阈值 3:1）

| 元素 | 日间档（A） | 夜间档（B） | 判定 |
|---|---|---|---|
| 卡/面板描边 | `#030402` / `#FFFFFF` = **20.55:1** | `#262A30` / `#141619` = **1.26:1** | 日✅；夜 **仅作装饰**（T22），可点卡片须用 `--sea-border-strong`/`--sea-accent` |
| 页底 vs 卡底（层级可辨） | `#FDE815` vs `#FFFFFF` = **1.26:1** | `#0B0C0E` vs `#141619` = **1.08:1**；vs `#15171B` = **1.09:1**；vs `#17191D` = **1.11:1** | ❌ **两档都不能靠底差辨识卡片** ⇒ 卡片边界必须由描边（日）或 `--sea-border-strong`/`--sea-accent`（夜）承担 |
| 输入框/搜索框描边 | `#030402` / `#FFFFFF` = **20.55:1** | 原稿 `#33373D` / `#15171B` = **1.50:1** ❌ → 本册 `#8A9099` = **5.58:1** ✅ | 夜档必须升级（T19/T22） |
| 标签描边 | `#030402` / `#FFF7B8` = 高 ✅ | `#2A2D33` / `#141619` = **1.31:1** | 夜档标签描边为装饰；标签**文字** 8.20:1 ✅（可读性不被描边影响） |
| 图片位描边（T8） | `#030402` / 缩略图 t1 首色 `#FFE8A3` = **16.95:1** ✅ | `#8A9099` / t1 首色 `#3E3520` = **3.76:1** ✅；`#FDE815` = **9.64:1** ✅；原稿 `#262A30` = **1.19:1** ❌ | 夜档必须用 `--sea-border-media`（`#8A9099` 或 `#FDE815`） |
| 焦点环 | `#030402` / `#FFFFFF` = **20.55:1**；`#030402` / `#FDE815` = **16.37:1** | `#FDE815` / `#0B0C0E` = **15.59:1**；`/ #141619` = **14.44:1**；`/ #15171B` = **14.30:1** | ✅ 但**需反色**（T64） |
| 分隔线 | `#030402` @ `.18` / `#FFFFFF` = **1.51:1**（装饰） | `#262A30` / `#141619` = **1.26:1**（装饰） | 装饰性（T22）；**不得作为唯一分组手段** |
| 骨架屏块 | `rgba(253,232,21,.35)` / `#FFFFFF` | `rgba(253,232,21,.16)` / `#141619`（原稿 `#22262B` / `#141619` = **1.19:1**） | 骨架为装饰，**不适用 3:1**；但必须带 `aria-busy` 与文字（T59） |
| 涨跌指示器 | 见 8.1（深底衬上 ≥8:1） | 见 8.1（≥6.5:1） | ✅ 且必须带箭头符号（T61） |

### 8.3 不达标项汇总与处置（本册对两稿的全部强制改动）

| # | 不达标项 | 实测 | 处置 | 依据 |
|---|---|---|---|---|
| 1 | B 稿 `#6B7079`（`.tk-note` `SP:287`、`.job-pub` `SP:313`、`.foot` `SP:341`） | 3.64–3.74:1 | 升级为 `#8A9099`（B 稿自身已有值） | T19 / T65 |
| 2 | B 稿 `#6E747C`（`.tabbar .tab` `SP:337`） | 4.15:1 | 升级为 `#8A9099` | T19 / T65 |
| 3 | B 稿 `#5C6169`（`.empty-note` `SP:340`） | 3.14:1 | 升级为 `#8A9099` | T19 / T65 |
| 4 | B 稿 `#33373D`（`.search` / `.me` 描边 `SP:277/280`，同类推及表单输入框） | 1.50:1 | **必需的 UI 边界**改用 `--sea-border-strong` = `#8A9099`（5.58:1） | T22 |
| 5 | B 稿 `.thumb` 描边 `#262A30` 对暗彩渐变 | 1.19:1 | 图片位改用 `--sea-border-media` = `#8A9099`（3.76:1）或 `#FDE815`（9.64:1） | T8 / T52 |
| 6 | A 稿 `.up`/`.down`（`#3DDC84`/`#FF7A7A`）若坐在浅底衬上 | 1.78 / 2.52:1 | 日档涨跌**只允许坐在深色底衬上看**；白底场景必须套深色底衬或用 `--sea-up-on-light`/`--sea-down-on-light` 且仍需底衬（见 T63） | T63 |
| 7 | A 稿 `#12A150`/`#E5484D` 坐在白底 | 3.37 / 3.91:1 | 同上：**不得直接用于白/黄底上的涨跌文本**（除非底衬为深色） | T63 |
| 8 | A 稿 `.hr` 分隔线 `.18` 透明 | 1.51:1 | 保持装饰定位；**若某处分组必须依赖该线**，改用实色 `#030402`（20.55:1）或 `@.40`（≥3:1） | T22 |
| 9 | B 稿卡底 vs 页底 | 1.08:1 | 夜档**可点卡片**必须带 `--sea-border-strong`/`--sea-accent`（B 的 `.job-card` 已是此做法 `SP:304`） | T22 |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T56** | 【本册裁定】8.3 的 9 条是**本册对两稿的全部强制改动**；除此以外，任何 token 值必须与 A/B 原稿逐字一致（含字号、色值、圆角、间距）。**新增第 10 条强制改动需 Zang 裁决。** | §8.3 | 保证「不是自行造一套颜色」 |
| **T57** | 【本册裁定】对比度验收必须在 **CI 可执行**：把 8.1 / 8.2 的配对表固化为机器可读清单（`fg, bg, kind, min`），由脚本重算 —— 见 T74。 | §10 T74 | 「可脚本校验」是 AC 要求 |
| **T58** | 【本册裁定】**非活跃组件豁免**（WCAG 1.4.3 例外）只适用于 `disabled`/`aria-disabled="true"` 的元素；因此 `--sea-fg-disabled`（日 `#9A9A88` 2.28:1、夜 `#5C6169` 3.14:1）**合法**，但**必须同时具备非颜色的禁用指示**（`cursor:not-allowed` + `aria-disabled` + 文本说明），不得让用户分不清「禁用」与「弱化」。 | `--sea-fg-disabled`、`--sea-surface-disabled` | 若把 `--sea-fg-disabled` 用在**活跃**元素上 ⇒ 直接判负 |
| **T59** | 【本册裁定】骨架屏不适用 3:1，但**必须**：① `aria-busy="true"` + `role="status"`；② 有可视的加载文字（稿件已有：`— 正在加载更多 · 已按 $ 价格排序 —`，`SP:831`）；③ 骨架块与真内容的**几何一致**（T50）。禁止只用动画条而无文字。 | `Skeleton` | — |
| **T60** | 【本册裁定】行情/汇率等**「图表 + 数值」**场景：数值必须同时给「颜色 + 箭头符号 + 正负号」，且 ±0 必须显式显示为「— 0.00%」而不是绿色。 | `--sea-up` / `--sea-down` | 稿件已合规（`SP:570-573` 有 ▲▼），本条要求不得在实现中丢掉符号 |
| **T61** | 【已冻结口径】**不得仅靠颜色传达状态**（§5.3 / §10 反例）。强制配对：涨 = `#3DDC84`/`#12A150` + `▲` + 正数；跌 = `#FF7A7A`/`#E5484D` + `▼` + 负数；选中 = 颜色 + **字重 800** + `aria-current`/`aria-selected`；错误 = 颜色 + **图标 + 文字**；必填 = 颜色 + **`*` 或「必填」文字**。 | 全站状态 | 判负方法：脚本断言 `.up/.down` 元素的 `textContent` 必须匹配 `/[▲▼]/`（T71 同批脚本） |
| **T62** | 【本册裁定】主题切换与状态语义的可访问性标记：主题按钮 `aria-label` + `aria-pressed`；Tab `aria-current="page"`；三态容器 `aria-live="polite"`；图片位 `alt`；装饰 SVG `aria-hidden="true"`（稿件已是如此，`SP:435/562`）。 | 全站 | — |
| **T63** | 【已冻结口径 / 本册裁定】**涨跌色的底衬规则**（由 §8.1 实测推出）：<br>① 日档：涨跌文本**必须坐在 `--sea-up-bg`（`#030402`）这类深色底衬上**（实测 11.51 / 8.14:1 ✅），例如行情条、深色胶囊。直接放在 `#FDE815` 黄色页底或 `#FFFFFF` 卡底上 ⇒ 判负。<br>② 夜档：`#3DDC84` / `#FF6B6B` 在 `#0B0C0E`/`#141619` 上均 ≥6.5:1 ✅，**无底衬要求**。<br>③ 若确需在浅底衬上显示涨跌，**必须套一个深色底衬**（同 A 的价格胶囊做法：深底 + 圆角 + 描边）；本册**不建议**改用压暗色值（如需，`#12A150`→`#0F8844`、`#E5484D`→`#D34247` 可勉强达 4.5:1，但**这两个值不来自稿件，属发明**，须 Zang 批准）。 | `--sea-up`、`--sea-down`、`--sea-up-on-light`、`--sea-down-on-light`、`--sea-up-bg` | 本册给出的是「零新色值」的合规路径 |
| **T64** | 【本册裁定】**焦点环必须在两档的三种底衬上都 ≥3:1**，因此使用**双色环 + 反色**：<br>① 日档：外环 `--sea-focus-ring` = `#030402`（对 `#FFFFFF` 20.55:1、对 `#FDE815` 16.37:1 ✅）；当元素自身为**深底**（`#030402`）时改用 `--sea-focus-ring-invert` = `#FDE815`（16.37:1 ✅）。<br>② 夜档：外环 `--sea-focus-ring` = `#FDE815`（对 `#0B0C0E` 15.59:1、对 `#141619` 14.44:1、对 `#15171B` 14.30:1 ✅）；当元素自身为**黄底**（`#FDE815`）时改用 `--sea-focus-ring-invert` = `#0B0C0E`（15.59:1 ✅）。<br>③ 单色环在「黄底按钮（夜）」与「黑底按钮（日）」上实测 **1.00:1**，属不可见 —— 故反色不是可选项。<br>④ 焦点环必须带 `--sea-focus-offset`（`2px`）露出底衬色，且**不得因出现而改变元素 rect**（用 `box-shadow` 出环，T23/T24）。 | `--sea-focus-ring`、`--sea-focus-ring-invert`、`--sea-focus-w`、`--sea-focus-offset` | 判负方法：T74 把 `#030402`/`#FDE815` 的四种组合写进配对表；`#FDE815` vs `#FDE815` 若出现在表里即说明实现用了单色环 |
| **T65** | 【本册裁定】B 稿三处弱灰（`#6B7079` / `#6E747C` / `#5C6169`）的升级值是 **`#8A9099`**（B 稿 `SP:277/301/309` 已有），**不是新造色**。若 Zang 偏好更亮的弱字，备选 `#A9AFB7`（8.20:1，B 稿 `SP:310` 已有）。**禁止在夜间档用低于 `#8A9099` 的灰做文本。** | `--sea-fg-muted`、`--sea-tab-fg`、`--sea-ticker-note`、`--sea-foot-fg`、`--sea-jobcard-fg-faint` | 这是 §8.3 的 #1/#2/#3 |
| **T66** | 【本册裁定】占位符（placeholder）必须 ≥4.5:1 且**与已输入值可区分**：日档占位 `#6B6B5A`（5.42:1）、夜档 `#8A9099`（5.58:1）；实际输入值用 `--sea-fg`。禁止让 placeholder 与 value 同色。 | `--sea-fg-muted` | — |
| **T67** | 【已冻结口径】**非文本元素对比 ≥3:1**（图表、涨跌指示、描边、图标、状态点、图片位边界），两档都要。详见 8.2 实测表；不达标项处置见 8.3。 | §8.2 全表 | 判负方法：T74 |
| **T68** | 【本册裁定】键盘可达性（主题是用户可见功能的一部分）：① 主题切换按钮必须可 `Tab` 聚焦并有 `:focus-visible` 环；② 不使用只有 `hover` 才出现的关键操作；③ 底栏 Tab 为真实链接/按钮（稿件为 `<a>`，`SP:836-840`）。 | `ThemeToggle`、`TabBar` | — |

---

## §9 反例清单（禁止事项）

> 编号 `X1..X16`：反例是规则的否定面，每条标注它违反的 `T` 号。**反例清单与 T 规则同等强制**，质检发现任一条即判负（除非有 Zang 裁决豁免）。

| # | 禁止事项 | 违反 | 为什么（后果） |
|---|---|---|---|
| **X1** | 组件里写死色值（`#FDE815`、`bg-yellow-400`、`rgba(0,0,0,.4)`） | T5 / T39 / T49 | 主题切换时该处不变 ⇒ 出现「黄底黑字卡里有一块白」，且无法审计 |
| **X2** | 组件里写死圆角/描边/阴影（`rounded-xl`、`border`、`shadow-lg`、`border-b-2`） | T5 / T23 / T26 | 描边走 `border` ⇒ 两档 1.5px vs 1px 造成内容盒位移 ⇒ T69 必挂 |
| **X3** | 同一主题内混用两种形状语言（日档某卡 `2px` 直角、夜档某卡 `13px` 圆角；日档某按钮去投影） | T26 | 主题不再「一整套」，退化为零件拼装 |
| **X4** | 跨用途复用同一 token（用 `--sea-accent` 当正文色、用 `--sea-border` 当价格色、用 `--sea-up` 当主按钮底） | T17 | 语义层失效，改一处炸一片 |
| **X5** | 仅靠颜色传达状态（涨跌无 ▲▼、选中只换颜色、错误只变红、必填只变红） | T61 / T51 / T60 | 色盲/强光下不可辨；也是 AC 明列项 |
| **X6** | 夜间档把品牌黄改成暗黄/深黄以提高对比 | T18 | 破坏品牌一致性；黄在两档是同一常量 |
| **X7** | 夜间档对 B 稿的弱灰原样照抄（`#6B7079` / `#6E747C` / `#5C6169`） | T19 / T65 | 实测 3.14–4.15:1，低于 4.5:1 文本阈值 |
| **X8** | 夜间档用 B 稿原描边色 `#33373D` 做输入框/搜索框边界 | T22 | 实测 1.50:1，UI 边界不可辨 |
| **X9** | 把字号/字重/间距/列数做成 `:root.dark` 里的可切换 token（「夜间价格调大到 26px」「夜间列表改 3 列」） | T10① / T29 / T34 / T35 | 直接违反 T69（rect 逐值相等） |
| **X10** | 导入变体 C 的任何色值 | T9 | C 已弃用；引入即口径分叉 |
| **X11** | 用 `prefers-color-scheme` 媒体查询实现主题（含 `@media (prefers-color-scheme: dark){ … }` 覆盖 token） | T6 | 用户手动切换无法覆盖系统偏好 ⇒ 主题功能失效 |
| **X12** | 主题切换时重挂载组件树 / 换 React `key` / `location.reload()` | T45 | 丢失滚动位置、输入焦点、播放中状态 |
| **X13** | 用 `transform`/`scale`/`padding` 变化做悬停、聚焦、选中效果 | T21 | 改变 rect ⇒ 违反 T69 |
| **X14** | 主题判定放到 React 挂载之后（`useEffect` 里写 `documentElement.classList`） | T44 | 首帧闪烁（FOUC）：夜间用户先看到一屏黄 |
| **X15** | 把主题切换入口塞进底栏 Tab（改成 6 格）或只在「我的」页提供一个入口 | T41 / T46 | 两档交互不同构；PC 端入口不可达 |
| **X16** | 图片位不加描边/底衬（尤其夜档暗彩渐变直接贴深底） | T8 / T52 | 实测 `#262A30` 对 `#3E3520` 仅 1.19:1，浅色商品图会糊成一片 |

---

## §10 可判负 AC

> **判负能力（falsifiability）**是本节的核心要求：每条 AC 都必须给出「**如何证明这条断言真的会失败**」。若某条断言在任何实现下都通过 ⇒ 该断言无判别力，视为无效 AC。

| 编号 | AC（可判负） | 判定方法（可执行） | 判负能力验证（必做一次） |
|---|---|---|---|
| **T69** | **【核心 · 已冻结口径】**切换主题前后，对同一批元素取 `getBoundingClientRect()`，**x / y / width / height 必须逐值相等**（要求严格相等，或 `Math.abs(d) < 0.01`；本册取**严格字符串相等**，即 `JSON.stringify` 两份读数一致）。允许变化的是 `border-radius` / `box-shadow` / 颜色 / `outline` 颜色。 | ```js
const SEL = '[data-ac-geom]';                // 见下方「取样面」
const snap = () => JSON.stringify(
  [...document.querySelectorAll(SEL)].map(e=>{
    const r=e.getBoundingClientRect();
    return [r.x,r.y,r.width,r.height];
  }));
// 日间档读数
document.documentElement.classList.remove('dark');
const A = snap();
// 夜间档读数
document.documentElement.classList.add('dark');
const B = snap();
__ASSERT__(A === B, 'T69 几何恒等');
```
取样面（最小集，覆盖两类形状）：`.topbar`、`.search`、`.btn-pub`、`.me`、`.tickwrap`、`.cats`、`.feed`、前 4 张 `.card`、1 张 `.job-card`、每张卡的 `.thumb`/`.title`/`.price`、`.panel`×3、`.hr`、`.tabbar`、`.tabbar .fab`（若该页存在）。全部元素加 `data-ac-geom` 属性。 | ① 把 `--sea-border-w` 的夜间值改成 `1px` 并让它走**真实 `border`**（去掉 T23 的 `box-shadow` 模拟）⇒ 断言**必须失败**。<br>② 在 `:root.dark` 里加 `--sea-fs-price-num:26px` ⇒ 价格胶囊宽度变化 ⇒ 断言**必须失败**。<br>③ 把夜档 `.topbar` 的 `box-shadow` 换成 `border-bottom:1px`（日档仍 `2px`）⇒ 整页 y 偏移 1px ⇒ 断言**必须失败**。<br>三条测试用例必须先在 CI 里跑出 **FAIL**（证明判负能力），再对真实实现跑出 PASS。 |
| **T70** | **无硬编码**：`frontend/src/**` 内除 `styles/tokens.css`、`styles/theme.css` 外，**不得出现** `#hex` 颜色、`rgb(`/`rgba(` 颜色、`border-radius:`、`box-shadow:` 的字面量（允许：`transparent`/`currentColor`/`none`、SVG 内联 `fill`/`stroke` 的品牌路径、`aria` 文本）。 | ```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|border-radius\s*:|box-shadow\s*:' \
  frontend/src --include='*.jsx' --include='*.js' --include='*.tsx' --include='*.ts' \
  | grep -v 'styles/tokens.css' | grep -v 'styles/theme.css'
# 期望：0 行（白名单见上）
```
另加 `grep -rnE '\-\-sea-[a-z-]+\s*:' frontend/src --include='*.jsx'` 期望 0 行（T39）。 | 在任一组件里加 `style={{background:'#FDE815'}}` ⇒ grep **必须**命中 ⇒ 判负。验收记录须附「注入后命中」与「还原后 0 命中」两份输出。 |
| **T71** | **对比度阈值可脚本校验**：把 §8.1 / §8.2 的配对清单固化为 `docs/design/contrast-pairs.json`（`[{fg,bg,kind:'text'|'nontext',min}]`），脚本重算全部比值并断言 `ratio >= min`；**同时**脚本断言实现侧 token 的实际解析值与该清单一致（从 `:root` / `:root.dark` 读出的值必须能匹配清单里的每一对）。 | Python 脚本：解析 `tokens.css` 的 `:root` 与 `:root.dark` 块 → 取 `--sea-*` 值 → 对 `contrast-pairs.json` 逐对算 WCAG 对比度 → 全部 `>= min` 则 PASS。另加：`kind:'text'` 的 `min` 必须 ≥4.5，`kind:'nontext'` 的 `min` 必须 ≥3.0（防止有人把阈值改小来「通过」）。 | ① 把 `:root.dark` 的 `--sea-fg-muted` 改回 `#6B7079` ⇒ 3.64 < 4.5 ⇒ **必须 FAIL**（并且与 8.3 #1 的判定一致）。<br>② 把 `--sea-border-strong`（夜）改回 `#33373D` ⇒ 1.50 < 3.0 ⇒ **必须 FAIL**。<br>③ 断言脚本必须**先**在清单里对 `#FDE815` vs `#FDE815`（1.00:1）报错 —— 用来证明「脚本不是恒真」。 |
| **T72** | **防 FOUC / 首帧正确**：`document.readyState === 'loading'` 时（即 `DOMContentLoaded` 之前）读取 `document.documentElement`，其 `classList.contains('dark')` 与 `dataset.theme` **必须已反映** localStorage/系统偏好。 | 用 CDP `Page.addScriptToEvaluateOnNewDocument` 注入探针记录 `documentElement.className` 的首次赋值时机；或在 E2E 里 `page.goto(url, {waitUntil:'commit'})` 后立刻 `evaluate` 读 class，与预期的 `--sea-*` 计算值比对（`getComputedStyle(document.documentElement).getPropertyValue('--sea-surface-page')` 必须已是 `#0B0C0E`）。 | 把内联脚本从 `<head>` 移到 `ReactDOM.createRoot` 之后 ⇒ 首帧必为日档 ⇒ 探针读到 `--sea-surface-page: #FDE815` 而预期 `#0B0C0E` ⇒ **必须 FAIL**。 |
| **T73** | **无横向溢出 + 尺寸恒定**：两档下 `document.documentElement.scrollWidth` / `scrollHeight` **逐值相等**（§5.3.7 尾句）；且在 375px 与 1440px 两个视口下 `scrollWidth <= innerWidth`（无横向溢出）。 | `innerWidth` 分别设为 375 / 1440，两档各取一次 `{scrollWidth, scrollHeight, innerWidth}`，断言 `A.scrollWidth===B.scrollWidth && A.scrollHeight===B.scrollHeight && A.scrollWidth<=375(或1440)`。 | 给夜档任意元素加 `border: 1px solid` 且宽度 100% + `box-sizing: content-box` ⇒ 溢出 ⇒ **必须 FAIL**。 |
| **T74** | **非文本 3:1 + 焦点环反色**：① §8.2 的每一对 ≥3:1 通过；② 焦点环在 4 种组合下（日/夜 × 浅底/深底）均 ≥3:1，且**反向组合（黄环对黄底、黑环对黑底）必须出现在「禁止清单」里并被脚本拒绝**；③ 三态容器与非文本边界（`--sea-border-strong`、`--sea-border-media`）在实现中确实被使用（脚本断言至少 1 处引用）。 | 与 T71 共用脚本；额外对 ② 建立一个 `forbidden-pairs` 列表并断言实现中**不出现**（例：`--sea-focus-ring` 与 `--sea-accent` 同时用于同一元素的 `background` 与环色 ⇒ 命中 `#FDE815` vs `#FDE815`）。 | 把夜档 `.btn-pub` 的焦点环写成 `--sea-focus-ring`（黄）而非 `--sea-focus-ring-invert` ⇒ 命中 1.00:1 禁止对 ⇒ **必须 FAIL**。 |

**AC 通过的最低证据包（Kong 交付时必须附）**
1. T69 的 A/B 两份 `rect` JSON 快照（含元素数）+ 三条判负用例的 FAIL 输出。
2. T70 的 grep 输出：注入后命中 / 还原后 0 行。
3. T71+T74 的脚本输出：全部配对 PASS + 三条判负用例 FAIL + 阈值合法性断言（`min>=4.5` / `>=3.0`）。
4. T72 的首帧探针读数（两档各一份）。
5. T73 的两档 `scrollWidth/scrollHeight`（375 与 1440 两视口）。

---

## §11 我未能核实 / 未实测（诚实清单）

> 本节是**负面证据清单**：凡未实测、未复核、或存在不确定的结论，一律在此列出，不藏在正文里。

### A. 已实测的部分（供对照，说明本册不是纯推理）

| 已实测 | 方法 | 读数 |
|---|---|---|
| 比选稿文件摘要 | `sha256sum` | `b61ad55d36211958b65d086d09fb79f57d0494b01c8cf6bc79dd84c622982deb`，72,809 B，936 行 |
| 变体 A / B 段选择器数 | 正则解析 `<style>` 块 | 69 / 79 条 |
| §8 中**每一对**对比度 | WCAG 2.x 公式脚本逐对计算（`rgba` 先 alpha 合成） | 见 8.1 / 8.2 表（全部为脚本输出，非估计） |
| token 值是否与渲染一致 | 真实 Chromium 打开 `file://…/style-preview.html`，`getComputedStyle` 抽样 **30 项 × 2 档** | **全部一致**：A `.card` `13px/1.5px声明/3px 3px 0 #030402`、B `.card` `2px/1px/none`、A `.price` `#FDE815`+`8px`、A 价格数字 `21px`+`tabular-nums`、B 价格数字 `26px`+`ui-monospace`、A `.feed` `4 cols`/`16px`、B `.feed` `3 cols`/`13px`、A `.feed-m` `2 cols`、B `.feed-m` `1 col`、A 头像 `50%`、B 头像 `2px`、B `.job-card` `border-left 4px #FDE815`、A `.fab` `14px`+`0 3px 0 rgba(3,4,2,.28)`、B `.fab` `2px`/`none`、A `.hr` `#030402`/.18、B `.hr` `#262A30`/1 等 |
| 比选稿自身的自检读数 | `window.__selfcheck` | `viewport 1280x633`、`overflow:false`、`variantRoots:3`、`renderedCards:66`、`brandLogo:true`、`errors:0` |
| 本册未修改受限文件 | 未对 `docs/design/style-preview.html`、`docs/seafood.master-plan.md`、`docs/ledger.spec.md`、`frontend/src/**`、`backend-ts/**` 执行任何写操作 | — |

### B. 未能核实 / 未实测（诚实清单）

| # | 未核实项 | 影响 | 需要的验证动作 |
|---|---|---|---|
| N1 | **`1.5px` 描边在浏览器里被取整**：实测 DPR=1 的 Chromium 把 `border-width:1.5px` 解析为**使用值 `1px`**（合成元素测试：`1px` 与 `1.5px` 的 `clientWidth` 同为 `98`；`2px` 为 `96`）。⇒ A 的 `1.5px` 与 B 的 `1px` **在当前桌面浏览器上渲染结果相同**。 | ① 本册仍按原稿写 `1.5px`（忠于提取）；② 但「1.5 vs 1px 造成位移」的风险是 **DPR 相关**的（DPR≥2 时 1.5px 可精确渲染为 3 设备像素 ⇒ 差异才真实存在）⇒ 风险**非确定性**，T23 的必要性因此**更强**，不是更弱。 | 在 DPR=2 / DPR=3 的设备（真机或 CDP `Emulation.setDeviceMetricsOverride`）复测 A/B 两档同元素的 `clientWidth` 差异 |
| N2 | **T69 断言本身未经运行时验证**：我未在真实实现上跑过 `getBoundingClientRect` 的 A/B 双快照（该实现尚不存在，P7 才产出）。 | T69 是**设计断言**，不是已验证事实 | P7 由 Kong 实现后，Neng 必须按其第 1 条证据包实测；本册同时给出 3 条「应当 FAIL」的注入用例来证明其判负能力 |
| N3 | **未实测 `box-shadow` 内/外描边对 `getBoundingClientRect` 的零影响**（T23 的理论依据是 CSS 规范中 `box-shadow` 不参与布局；我**没有**跑过实测）。 | 若某浏览器有反例，T69 的路线需重估 | 在 Chrome / Safari / Firefox 三端各跑一次：`border:0` + `box-shadow` 元素与 `border:2px` 元素的 rect 对比 |
| N4 | **字体栈回落未实测**：`ui-monospace` 与 `SFMono-Regular` 的具体解析结果，我**未**在 Chrome/Firefox/Windows/Linux 上核对；本册只保证「两档同值」而非「跨平台一致」。 | 等宽栈若在某平台回落到非等宽字体 ⇒ 数字对齐失效（T28 的**目的**落空，但**规则**仍满足） | 在目标平台列表上 `document.fonts.check()` + 实测数字列宽是否相等 |
| N5 | **Tailwind 4 的 `@theme inline` + `:root.dark` 覆盖组合未实测生效**：我未读 `frontend/package.json` 的 `tailwindcss` 实际版本，也未跑一次构建。（受任务边界限制：本册不得碰 `frontend/src/**`。） | §6 的 `@theme` 片段是**语法级建议**，可能需按实际版本微调（例如是否必须 `inline`） | 读 `frontend/package.json` 确认版本 → 用一个空组件验证「`.dark` 下 `bg-sea-elevated` 真的变色」 |
| N6 | **`#3E3520` 只是 B 稿 t1 渐变的起点**：8.2 中「图片位描边对暗彩缩略图 3.76:1」是按渐变**第一个色标**算的；真实缩略图是渐变，**局部对比会随位置变化**，亮端可能更低。 | 图片位描边的 3:1 结论是**保守估计**，不是全渐变面的最小值 | 对 t1..t10 两条色标各算一遍，取较不利者 |
| N7 | **`--sea-surface-disabled`（夜 `#17191D`）的出处是 HTML 内联色块**（`SP:518` 的 B 变体图例 `<i style="background:#17191D">`），**不是 CSS 规则**。 | 它是「稿件里存在但未被 CSS 使用」的值；严格说它是 B 的**色彩标注**而非 B 的**样式** | 如 Zang 认为不可接受，改取 `#15171B`（`SP:277`，B 的 CSS 实际使用值） |
| N8 | **6 个 `【本册指派】` token（T20）没有 A/B 的对应选择器**：hover / disabled（桌面态）/ skeleton / focus-ring / border-strong / border-media。它们的值都**来自稿件已有色值**，但「这个值用在这个状态上」是**我的设计判断**，不是稿件事实。 | 若 Kevin 不认，改这 6 格即可（一句话可改） | 需 Kevin / Zang 点一次头 |
| N9 | **T30（字号取 A）是本册最大的一处「选边」**：列数取 A（4 列）⇒ 字号必须同源 ⇒ 放弃 B 的 26px/30px/52px 数字。这是**我的裁定**，不是 D9 或 §5.3 明文。§5.3 只说「数字排版统一取 B（tabular-nums + 等宽）」，**没有说字号也取 B**；且 §5.3 同时要求列数一致 ⇒ 我判定「列数与字号同源」是唯一自洽解。 | 若 Kevin 想要 B 的大数字，则列数须一并回到 3 列 ⇒ 需 Zang 重新裁决 | **请 Zang 明确复核这一条** |
| N10 | **A 稿的行情价原本不是等宽字形**：实测 A `.tk-price` 的 `font-family` 是**系统无衬线栈**（只有 `SP:102` 的 `tabular-nums`），等宽栈 `ui-monospace` 只出现在 B（`SP:285`）。本册按 §5.3.3「数字排版统一取 B，两档共用」⇒ **日间档的行情价/价格数字也改用等宽字体**。 | 这是相对 A 的一处**已授权偏离**（依据 §5.3.3），但会轻微改变 A 的数字观感 | 若 Kevin 只想保留 A 的原观感，可把 `--sea-font-num` 降级为「仅 `tabular-nums` + 数字专用字距」⇒ 但那会违反 §5.3.3 字面 |
| N11 | **`--sea-fg-muted` 的日档取值（`#6B6B5A`）原本是底栏 Tab 的非选中色**（`SP:253`），本册把它提升为「通用弱前景」。 | 在白色卡内做辅助文字时 5.42:1 合格，但**观感偏橄榄绿**（它是黄底系调过的灰绿），可能与 A 的纯黑系不符 | 若要更「中性」，备选 `#3D3D3D`（10.86:1，`SP:228`）——但那样它与「次要前景」无法区分 |
| N12 | **移动端未在真机实测**：比选稿的 375px 是**桌面浏览器把 1440/375 演示框用 `transform:scale()` 缩放**显示的（`SP:868-880`），**不是真机视口**。 | 手机端的 `100vh`、地址栏收起、`position:sticky` 顶栏、横滑行情条的 mask 渐隐均**未在真机验证** | 真机或 DevTools 手机模拟下按 T73 复测 375px 两档 |
| N13 | **375px 下「2 列 + 价格胶囊 + 价格数字 21px」是否真的放得下**：我未做文本溢出实测。（B 的 1 列布局正是为这个宽度设计的，本册按 T35 废弃了它。） | 若放不下 ⇒ 会出现换行/截断，而这是**几何**问题，可能连带影响 T69 | 在 375px 下实测 `.price` 的 `scrollWidth <= clientWidth` |
| N14 | **「深色底衬上的涨跌」在日档的实际布局位置未确定**：T63 只规定了「必须坐深底衬」，但日档首页除行情条外，**哪里还有深底衬**（如卡片内是否需要涨跌）属产品问题。 | 若产品在日档白卡上要显示涨跌，需按 T63③ 套深色胶囊（新增 UI 元素 ⇒ 需重新过 T69） | 产品确认日档涨跌的出现位置 |
| N15 | **对比度未按「真实渐变/半透明叠加后的最终像素」实测**：所有计算都基于**纯色对值**，未对渐变缩略图、`opacity` 叠加后的实际渲染色取样。 | 8.2 中与渐变相关的结论（N6）是估算 | 用 CDP `Page.captureScreenshot` + 取色器对关键像素复核 |
| N16 | **`--sea-glyph` 的 `rgba(3,4,2,.30)`（日）/`rgba(253,232,21,.20)`（夜）与底衬的对比度未列入 8.1/8.2 的硬阈值**：它是**装饰性占位字**（会被真实商品图替换），本册按装饰处理。 | 若 Kevin 要求它也 ≥3:1，需重新取值 | 明确一次：占位字算内容还是装饰 |
| N17 | **未核实「400+ 组件」类的全站覆盖面**：本册 §7 只覆盖了比选稿中出现过的 12 类组件。P7 全量页面（详情/发布/我的/交易所）中的**新组件**（表格、图表、对话框、表单长列表）**没有**在本册给出组件级规格。 | 新组件可能引入未 token 化的形状/色值 | P7 开工前需按本册的「token 语法 + X 反例清单」对新组件补一份附录 |

### C. 一句话结论

本册的**色值与形状值是实测提取**（源码 + 渲染双重复核，30 项抽样全中）；**对比度是实测计算**（每一对都有具体比值）；**未核实的是**：T69 断言本身的运行验证（实现尚不存在）、跨浏览器/跨 DPR 的描边取整与字体回落、真机移动端、以及 2 处需要 Zang/Kevin 点头的裁定（**N9 的字号选边**、**N8 的 6 个指派 token**）。

---

## §12 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-09-27 | 首版。依据 D9（Kevin 2026-09-27 更正）+ `docs/seafood.master-plan.md` §5.3 八条逐一落地。产出：13 个章节（§0–§12）；**74 条规则** `T1..T74`；**16 条反例** `X1..X16`；**17 条未核实项** `N1..N17`；色 token 全表 5 组 × Light/Dark 两列（含出处行号）；形状 token 全表 4 组 × 两列；字阶 30 项（单列 = 两档同值）；间距 21 档；断点 4 档；组件级规格 12 类；可判负 AC 6 条（`T69..T74`，每条附判负能力验证方法）。<br>对两稿的**全部强制改动仅 9 条**（§8.3）。 |
| v1.1 | 2026-10-11 | **手机竖屏（H5）加固口径 P0–P4（Kevin 定档）→ 新增 §13 + 规则 `T75..T79`**。**T75** 底部安全区：移动档 `.sf-tabbar` 必声明 `padding-bottom: env(safe-area-inset-bottom)`（结构层，**不得新增 `@media`**；配对硬要求 `index.html` 的 `<meta name=viewport>` 加 `viewport-fit=cover`）· **T76** 移动端导航去重：移动汉堡面板**不得含底部 tab 已有目标**（去 `/reward`/`/task`/`/exchange`），桌面档一字不动 · **T77** 主要操作路径触控目标 **≥44×44**（结构常量 `min-height`/`min-width` + padding；**不得改主题 token 色值/形状值**；**不得改 `STRUCT.h-btna`**）· **T78** 断点收口实现值 **767px**（§5.3 表原位更正 `639→767`、`640→768`，逐处留痕；`100vh` 本轮不动、登记待真机）· **T79** 最小字号 **≥12px**（真源 `SP:170` 就地更正 `10.5px→12px`）。附「§13.3 断言影响」16 行逐条点名 + 「§13.4 Kong 实现清单」+「§13.5 Neng 判负清单」+「§13.6 未核实 N18..N22」。**真源改动**：`docs/design/style-preview.html` L170 就地改 1 行（`10.5px→12px`；**−2 B、行数不变、numstat `1 1`**）。**改前快照**：`docs/versions/design-system.spec.v1.0.md`（`cmp=0`）。 |
| **v1.2** | 2026-10-11 | **Zang 两条裁定落册（口径收窄 + 硬判据升级）**。① **`T77`（P2）收窄**：触控目标 ≥44×44 的**实施范围一律限在 `@media (max-width: 767px)` 内**（复用同一断点值 767、**不得新增断点类型**、`shell.css` 仍只有一个 767 断点块；**桌面档几何零变化 = 硬判据**）。**理由/代价**：v1.1 原方案会**连带抬高桌面控件**（`.btn` 家族 40/34→44、`--sf-*-ctl-h` 34→44），与 Kevin 2026-10-11「桌面档不动」冲突；收窄后**桌面几何回到零变化**，代价 = 各页须把 44px 追加/改值**包进 767 媒体块**（实现面略增、判据面更严）。同步更正 **§13.3 第 14 行**（由「**必须改锚**」改「**若红则最小改锚**」——取值入 767 块后**可能仍绿**）+ **§13.3 尾「一句话」** + **§13.4 P2 逐项加「限 ≤767」** + **§13.4 尾「桌面连带声明」标 v1.2 作废（原文保留）**。② **`T75`（P0）升级**：`frontend/index.html` 的 `<meta name="viewport">` 追加 `viewport-fit=cover` 由「配对项」**升为 P0 硬判据**（缺则 T75 不成立）。附 **§13.6 N24**。**本册改动**：§13.1 T75/T77 行 + §13.3 + §13.4 + §13.5 + §13.6 + 顶部版本行 + §12。**改前快照**：`docs/versions/design-system.spec.v1.1.md`（`cmp=0`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |
| **v1.3** | 2026-10-11 | **补丁单 2 · Zang 三条落册（登记完整化 + 硬判据改写 + 缺陷入册）**。① **D2 入册（`T79` 覆盖范围完整化）**：实现方为满足 `T79` 额外把 `frontend/src/pages/jobs/jobs.css` 的 `.sf-jobs-tag`（规则块 L195–202，`font-size` = **L201**）由 `11px→12px`（**上轮 §13.4 未列**）⇒ `/task/:id` 在 **1440 档 34×20.5 → 36×22**；Zang 裁定**保留该全局字号变更但必须入册** ⇒ `.sf-jobs-tag` 补进 **§13.1 `T79` 行** + **§13.4 P4 清单（新增 #27）** + **§13.2 新增 13.2.1「T79 全局字号提升 ⇒ 桌面侧受影响元素完整清单（三类：`/listing .sf-listings-price-unit`、`.sf-listings-tag`、`/task/:id .sf-jobs-tag`）+ 逐元素前后读数」**。② **「桌面档不动」硬判据改写为「例外清单式」**：原措词「1440 档逐控件 `getBoundingClientRect()` 与现状逐值相等」**作废**（现实已有 T79 的 3 个元素例外）⇒ 新口径 = **「1440 档逐元素 `getBoundingClientRect()` 相等，唯一允许的例外 = T79 字号提升所覆盖的元素，且例外集必须是当轮现取扫描的完整集（不得有未登记元素；发现任何额外元素 ⇒ 立缺陷）」**；同步改 **§13.1 `T77` 行 · §13.3 第 14 行 + 尾「一句话」 · §13.5 `P2 触控` 行 + §13.4 尾补注**（`old→new` 字面留痕）。③ **D1 入册**：Neng 复核发现 **6 个侧栏控件 37.5 < 44**，根因 = `@media (max-width:767px)` 只把 `--sf-*-ctl-h` 挂在**主列根** `.sf-jobs`/`.sf-mkt`/`.sf-listings` 上，而侧栏 `.sf-layout-side` 是**兄弟节点** ⇒ `var()` 取空 ⇒ `min-height` 失效；⇒ 写入 **§13.5 判负清单**（新增 `D1` 行 + **P2 验收必须含「所有消费该变量的消费者全扫，含侧栏兄弟节点」**）+ **§13.6 `N25` 可复用教训**。**本册改动**：版本头 + §12 + §13.1（`T77`/`T79` 行）+ §13.2（新增 13.2.1）+ §13.3（第 14 行 + 尾「一句话」）+ §13.4（P4 新增 #27 + 尾补注）+ §13.5（`P2 触控` 行 + 新增 `D1`/验收面两行）+ §13.6（`N25`）。**改前快照**：`docs/versions/design-system.spec.v1.2.md`（`cmp=0`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |
| **v1.4** | 2026-10-11 | **补丁单 3 · Zang 裁定⑤ 落册（硬判据再改写 + D1 修复事实登记 + 归因配方）**。① **「桌面档不动」硬判据由 v1.3「例外清单式（元素白名单）」★改「归因式判据」**：新判据 = **「1440 档差异集必须 100% 归因于 T79 字号提升。验证法 = 反事实归因实验：只在测量期回退 T79 字号（不动仓库）⇒ 差异集必须为空（`仅基线有 = 0` 且 `仅归因有 = 0`）；且差异集中不得存在与字号无关的几何/布局差异。」**；v1.3 白名单字面**逐字保留 + 标已作废**（作废理由两条：**字号变更会级联**到块级容器与下游元素 ⇒ 白名单法须**逐元素登记两百多条**〔`/listing` 1440 差异集实测 **243**〕**不可维护**；且白名单法会**漏掉 `display:none` 子树**〔`/exchange`/`/task/new`/`/task/:id` 各 23〕）。② **登记 D1 修复后事实**（Kong commit `ebca3ab`）：修法 = ≤767 变量覆盖**从「只挂主列根」扩到「主列与侧栏共同祖先 `.sf-layout`」**（三页 CSS 同改；**34px 基准未动**）· **消费者全扫 = 0**（**动态哨兵法**，非类名清单；`/listing`/`/exchange`/`/task/new`/`/task/1` 均 0）· **同根因第 4 面** `/task/:id .sf-jobs-status`（`JobDetailPage.jsx:322`）一并覆盖（390 档 **172×44**）· **新副作用** `/listing .sf-listings-status` **0→44**（页高 **+114**）归**已知后果类**（**T77 的必然几何后果**）。③ **归因实验写成可复跑配方**（devtools 注入回退 4 处 T79 字号：`listings.css:130,140` + `jobs.css:201` + `--sf-st-tab-font-size`〔`theme-tokens.css:35`〕）+ 登记 **1440 `.sf-tabbar` 子树 23 元素 `0×0`（`display:none`）⇒ 无可见几何影响**。**本册改动**：版本头 + §12 + §13.1（`T77`/`T79` 行）+ §13.2.1（新增 v1.4 复核）+ §13.3（第 14 行 + 尾「一句话」）+ §13.4（尾新增 v1.4 补注）+ §13.5（`P2 触控`/`P2 侧栏` 行 + `P2 消费者全扫`〔原 `P2 验收面` 升级〕+ 新增 `P2 归因实验配方`）+ §13.6（`N25` 追加 + 新增 `N26`）。**改前快照**：`docs/versions/design-system.spec.v1.3.md`（`cmp=0`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |
| **v1.5** | 2026-10-11 | **两项新需求落册（Kevin 2026-10-11 定档 + Zang 转达两条连锁更正）**：① **底栏（H5）五项新集合**〔`T80`〕= `海鲜市场`→`/`(home) · `市场`→`/exchange`(shard) · `卖闲置`→`/listing/new`(sell) · `消息`→`/messages`(messages) · `我的`→`/profile`(profile)；图标 `Home`/`Store`/`PlusCircle`/`MessageCircle`/`User`；**恒 5 格（`T46` 不破）**。**留痕**：原写「`附近`→`/nearby`」**已由 Kevin 当日变更取代**（**不新建 `/nearby`、`nearby` 键不新增**）。② **右侧悬浮菜单（仅桌面 `>767`）**〔`T81`–`T83`〕= 五项（`卖闲置`/`消息`/`APP`/`反馈`/`客服`）+ 几何结构常量 + 日/夜 token `--sf-fm-bg`/`--sf-fm-fg`/`--sf-fm-divider`。③ **三弹窗模板位**〔`T84`〕。④ **1440 档不重叠硬判据**〔`T85`〕。⑤ **`T76` 去重口径重算**〔`T86`：汉堡排除集 `['reward','task','exchange']` ⇒ `['exchange']`，`reward`/`task` 恢复〕。**真源** = `style-preview.html` 追加区块（行 983–1042）。**改前快照**：`docs/versions/design-system.spec.v1.4.md`（`cmp=0`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |

| **v1.6** | 2026-10-11 | **小补丁单 · Zang 裁定⑦ 落册（i18n `home` 值变更 · 补齐值变更键由 1 键 → 2 键）**。**`home` 键值：`首页` ⇒ `海鲜市场`**（四语 zh「海鲜市场」/ en「Seafood Market」/ hk「海鮮市場」/ vn「Chợ hải sản」）—— 依 **Zang 裁定⑦**：底栏①文案 = Kevin 指定「海鲜市场」；实现 `labelKey:'home'` ⇒ `t('home')`（**现取唯一消费点 = `frontend/src/shell/nav.js:15`**）现值 = 「首页 / Home / 首頁 / Trang chủ」⇒ **不满足指定文案** ⇒ 更正（与 `siteTitle` 品牌口吻一致）。**改动**：版本头 + §12 + §14 节目注 + §14.0（裁定⑦留痕）+ §14.4（★ 补注：`home` 值变更非路由变更）+ §14.5（新增 `home` 值变更行 + ★ nav 文案现取结论）+ §14.6 第 14 行 + §14.7「四语键集逐文件相同」行 + §14.10 B（标题「改 1 值」就地更正 ⇒「改 2 值」+ 新增 `home` 行）+ §14.10 尾计数注。**值变更 = +0 键 ⇒ 计数（顶层 `119⇒128` / 拍平 `1050⇒1070` / 四语节点 `4200⇒4280`）逐字不变**（增量全部来自 +20 新增键）。**nav 文案断言现取 = 无**（`grep -rn "首页" frontend/src/test` 命中 5 行**全为注释**；唯一 locale-文案类断言 `theme-shell-isomorphism.test.jsx:266-267` = `siteTitle`，与本键无关）⇒ **无需改锚**。**改前快照**：`docs/versions/design-system.spec.v1.5.md`（`cmp=0`；md5 `23957167410322920fed75c8c57124b1`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |
| **v1.7** | 2026-10-11 | **小补丁单 3 · Zang 裁定⑧⑨ 落册（底栏⑤文案键 + 桌面 gutter）**。① **裁定⑧**：底栏⑤文案 = Kevin 指定「我的」；实现 `frontend/src/shell/nav.js:21` 第五项 `labelKey:'profile'` ⇒ `t('profile')` 现值 = 「个人资料 / Profile / 個人資料 / Hồ sơ」；`t('profile')` 另有**两个消费点**（`frontend/src/components/Header.jsx:284` 桌面下拉 / `:460` 移动面板）且 `r9-84-profile-entry.test.jsx` 锚定「个人资料」⇒ **`profile` 值不动**、**新增键 `me`**（zh 我的 / en Me / hk 我的 / vn Tôi）⇒ `nav.js:21` 第五项 **`labelKey` 改 `'me'`**（`key`/`path`/`requiresAuth` 仍 `profile`）。**「一句话可改」**：若全站统一为「我的」才改 `profile` 值 + 改锚 r9-84。② **裁定⑨**：Kong 实测 1440 档悬浮菜单（`x∈[1316,1424]`）与正文（首页卡片至 `x=1388`）**相交 ≈ 4.6 万 px²**，违 `T85`「相交 = 0」⇒ **桌面档正文预留右侧 gutter `140px`**；**gutter 落 `frontend/src/styles.css` 的 `@media (min-width:1024px)`**，**`shell.css` 不得新增 `@media`**（仍只 1 个 767 块）；**≤767 零影响**；**`T85` 判据不降级**；**必须交 1440/1600/1920 三档相交 = 0 + 三档 `scrollWidth==clientWidth`**。**改动**：版本头 + §12 + §14（§14.0 / §14.1 补注 / §14.2 / §14.4 补注 / §14.5 补 2 行 / §14.6 补 2 行 / §14.7 补 1 行 / §14.9(b) / §14.10 A 加 `me` 行 + 计数注）。**计数（实取）**：顶层 `119⇒129`、拍平 `1050⇒1071`、四语节点 `4200⇒4284`。**改前快照**：`docs/versions/design-system.spec.v1.6.md`（`cmp=0`；md5 `51475b46117d6dc4f986408cf6b6de43`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |
| **v1.8** | 2026-10-11 | **小补丁单 4 · 裁定⑩ 落册（gutter 起点对齐 `.sf-fm` 显示阈值）+ 归因第④类入册**。① **裁定⑩ · gutter 生效起点 `1024` ⇒ `768`**（与 `.sf-fm` 隐藏阈值 `≤767` 同界）。**依据 = Kong 实测 D4（真缺陷）**：v1.7 的 gutter 只写 `@media (min-width:1024px)`，而 `.sf-fm` 在 **`768–1023` 中间档已可见** ⇒ **相交 ≈ `49920 px²`**、**违 `T85`**（判据正确、实现漏档）。**裁定**：**gutter 起点 = `768px`**（落 `frontend/src/styles.css` 的 `@media (min-width:768px)`；**`shell.css` 仍不得新增 `@media`**，仍只 1 个 767 块）；**`T85`（相交 = 0）不降级**，**作用域 = 菜单可见的一切宽度档**（`>767` 全档，不再限 `≥1024`）；**验收面扩为六档 × 三页**（`768`/`1024`/`1280`/`1440`/`1600`/`1920` × `/`、`/listing`、`/exchange`）+ **手机档（`390`/`375`/`320`）零影响**。② **归因式判据「允许变更集」由三类扩为四类，第④类 = 「§14 已批准的 locale 值变更引起的文案/宽度面」**。**依据 = Kong 实测 D3（判据漏洞）**：归因差异每页 **5 条**归不进既有三类（`T79` 字号级联 / `.sf-fm` 子树 / gutter 面）—— 桌面左 nav **第 3 项宽 `52 ↔ 80`**，根因 = **`shard` 值 `碎片市场 → 市场`**（**§14 已批准的值变更**）⇒ 属**合法后果、非缺陷**，须补入允许变更集。**措词含可判负要求**：「**须给算术语义闭合**（字串长度变化 → 宽度变化方向与量级一致）」——即 `newWidth−oldWidth` 符号 = `(len(new)−len(old))` 符号、量级同阶；**闭合不成立（方向相反/量级背离/根因指不到任何 §14 已批准值变更）⇒ 立缺陷**（不得以「属第④类」豁免）。**改动**：版本头 + §12 + §14（节注 + §14.0 两条裁定 + §14.1 `T85` 补注 + §14.2 gutter 表 + §14.5 补 2 行 + §14.6 第 16 行 + §14.7 判负行 + §14.9(b) 归因措词 += 第④类）。**改前快照**：`docs/versions/design-system.spec.v1.7.md`（`cmp=0`；md5 `8b9606a0e2ca09a676dacb4098af8cfe`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**（gutter 起点 `768` 由 Kong 落地）。 |
| **v1.9** | 2026-10-11 | **补丁单 5 · 裁定⑪⑫⑬ + 登记项落册（撤 gutter / `T85` 重定义 / `profile` 值全站统一 / 夜档 token 收口 / 真机配色差异登记）**。**① 裁定⑪（撤 gutter + 允许遮挡 + `T85` 重定义）**：Kevin 明言「不要窄 `140px`，恢复原来宽度；右侧悬浮栏**可以遮挡**其它内容」⇒ **(a) 撤销** `frontend/src/styles.css` 的 `@media (min-width:768px){.sf-route-container{padding-right:140px}}`（**实现侧 Kong 做**；本册只落口径）；**(b) `T85` 由「相交 = 0」重定义**为「**悬浮菜单的可见性（`≤767` 隐藏 / `≥768` 显示）、几何（宽 `72` / 单元高 `92` / 图标 `26` / 字号 `12` / 右边距 `16` / `top:45%`）与六档（`768`…`1920`）× 多页零横向溢出**；**遮挡为已知并接受项**（**仅需登记实测面积，不得当 `FAIL`**）」；**(c) 各档验收面保留六档 × 三页**，**删去「相交 = 0」这一条**。**本裁定推翻 v1.7 / v1.8 关于 gutter、`T85` 作用域与验收面的口径** —— 旧措词**逐字保留为改前原文 + 标「已被 v1.9 取代」留痕**（见 §14.0 裁定⑨⑩ / §14.1 `T85` 行 / §14.2 / §14.5 #34–#36 / §14.6 #16 / §14.7 / §14.9(b)；**尤其中间档 `D4` 与反相复现 `49920` 两段叙述原文一字未修饰**）。**② 裁定⑫（`profile` 文案全站统一）**：`profile` 键**四语值改** zh「我的」/ en「Me」/ hk「我的」/ vn「Tôi」（原值 = 个人资料/Profile/個人資料/Hồ sơ）；底栏第 5 项 `labelKey` **回 `profile`**（`frontend/src/shell/nav.js` 第五项 `labelKey: 'me'` ⇒ `'profile'`）；**删除上一轮（v1.7）新增的 `me` 键**（避免两键同义）⇒ 键计数**回落**为顶层 `128` / 拍平 `1070` / 四语节点 `4280`（**本册现取核验 2026-10-11**，见 §14.10 尾；上轮 v1.8 基线现盘 = **129/1071/4284**（含 `me`）⇒ **本册 v1.9 现取**（Kong 同轮已落地裁定⑫）= **128/1070/4280**）；**`r9-84-profile-entry.test.jsx` 等锤「个人资料」文案的断言需改锚（Kong 执行）**；**本裁定取代上一轮标注的「一句话可改」选项**（§14.0 裁定⑧ / §14.5 ★① / §14.10 A）。**③ 裁定⑬（夜档三 token 收口）**：`--sf-fm-bg`/`--sf-fm-fg`/`--sf-fm-divider` 的夜档**推断值经人类认可**（Kevin 回复「目前看没问题」）⇒ **`N28`/`F8` 标「已认可（2026-10-11）」**而非待裁（**不得改写历史行，只追加/就地留痕**，见 §14.0 裁定⑬ / §14.2 / §14.8）。**④ 登记项（真机与本地 H5 配色差异）**：承 `N26`/`F7` 登记为**待查**（三假设：主题档状态 / 广色域色彩管理 / iframe vs 独立视口渲染；旁证 = 本仓**样式/主题层无 `oklch`/`color-mix` 声明**）⇒ 新增 **`N31`**（§14.8）。**改动 = 版本头 + §12 + §14（§14 节注 + §14.0 + §14.1 `T85` 行 + §14.2 + §14.5 + §14.6 #14/#15/#16 + §14.7 + §14.8 + §14.9(b) + §14.10）**。**改前快照** = `docs/versions/design-system.spec.v1.8.md`（`cmp=0`；md5 `06e66ba255531086619e9b4f8becaf40`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**（撤 gutter + `profile` 值 + 删 `me` + `nav.js` `labelKey` 回 `profile` 由 Kong 落地）。 |
| **v1.10** | 2026-10-11 | **`移除 reward 概念 → 闲置物品 item` 落册（Kevin 裁定 · 六条 · 逐字采用）**。**① 范围 A = 只改前端**（后端 `/api/prize/*` 与 `prizes` 表名不动；映射表 = 姊妹册 `route-layer.spec` v2.28 §38.3）· **② 路由 D = `/item` 列表 + `/item/:id` 详情 + 保留 `?id=` 兼容** · **③ 旧路由直接删除、不做 301 / 不做重定向**（`/reward`、`/listing`、`/listing/new`、`/listing/:listingId` ⇒ 旧收藏 404，登记 `F11`）· **④ 导航删「社区奖励」**（桌面左 nav `Header.jsx:124-129` `menuItems` ⇒ `[任务, 市场]`）· **⑤ 奖励页与列表页合并**为「闲置物品」列表页。**新增 §15**（`T87` 导航入口集合变更 + 可达性 AC · `T88` 首页入口改挂 `/item` · `T89` 合并页口径 · `T90` i18n 删改留表）+ **`N32..N34`** + **§15.3 断言影响清单（逐条点名）** + **§15.4 留痕（旧措词逐字保留 + 标「已被 v1.10 取代」）**。**改前快照** = `docs/versions/design-system.spec.v1.9.md`（`cmp=0`；md5 `33bae5270240d544443d9c88afd42401`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**（由 Kong 落地）。 |
| **v1.11** | 2026-10-11 | **小补丁单 · 三处口径按实情对齐（Kong 实测）+ 一条新可复用教训**。**① `T89` 筛选口径就地更正**：由「**仅在后端读口可筛**才留（否则整块删）」改为「**能筛才留（服务端或客户端侧，依据已取回的字段）**」；依据 = **Kong 实测** `GET /api/prize/all`（`backend-ts/src/index.ts:535`）**返回字段**含 `points` / `gift_limit` / `time_end` + `GET /api/prize-item`（`index.ts:880`）给**已兑换集** ⇒ **客户端侧筛可行** ⇒ **三档保留**（限量版 `limited` / 高价值 `points>5000` / 已兑换）。**② §15.2 新增 C 段 · 四语键集新基线回写** = **顶层 `127` / 拍平 `1053` / 四语节点 `4212`**（**Kong 实测 · 工作区、未提交**；`= 1053 × 4` 自洽；改前基线 `128`/`1070`/`4280`）。**③ 登记 reward 文案键保留裁定**：`common.claimReward` / `claimRewardModal.*` / `rewardCard.claimNow` **删 ⇒ 留**（仍被 `TaskPage` / `ClaimRewardModal` / `RewardCard` 消费；口径 = 「已退役的领奖面文案键保留，登记为待清理 `F13`」，§15.2 B′）。**④ 新增 `N35`**：源码 / 测试注释里**不得写「路径尾部 + 块注释起始二连」的通配字面**（审计脚本的块注释剥离器会**静默吃掉后续代码**；实测吞 ≈ 3.2 KB，含 `statusLabel` ⇒ unknown-status 兜底断言变红）。**改动 = 版本头 + §12 + §15（`T89` 行 · §15.2 尾补注 + B′ + C · §15.4 · §15.5 `N34`/`N35`）**。**改前快照** = `docs/versions/design-system.spec.v1.10.md`（`cmp=0`；md5 `5bd7e1059da47acbcc4c313f195a7a0c`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |
| **v1.12** | 2026-10-11 | **Kevin 四条新裁定落册（逐字采用）**：**① `F13` 死键清理 → 执行中**（11 死键**四语同删**；**新基线由 Kong 实测、Jing 现取回写** · **不得拄推定值**）· **② `F10` 内部标识改名 → 已执行**（`sf-listings*` → `sf-item*` / `data-sf-m="listing-*"` → `data-sf-m="item-*"`；**+ 几何零变化判据**）· **③ catch-all 提示页（新裁定）**（内层 `<Routes>` 末位 `<Route path="*">`；**不得动外层 `LangShell` 的 `/*` 机制**；**3 新 i18n 键 × 四语 · 非 zh 待复核**；**旧路径命中提示页而非白页**）· **④ 主题图标 `T41` 语义**（图标 = **将要切到的档位**；**真机逻辑正确、本地 H5 应反转** ⇒ 两处现状待 Kong 现取）。**⇒ 新增 §16**（`T91` catch-all 提示页 + `T92` 主题图标语义 + `N37` + §16.2 i18n 新键 + §16.3 `F10`/`F11`/`F13` 新字面回写 + §16.5 未核实）。**修正** §15.4 `N32` / `F11` 的「硬删后白页」「无兜底」口径（**非重定向 · 仍不是 301 逐字不变**）。**改前快照** = `docs/versions/design-system.spec.v1.11.md`（`cmp=0`；md5 `e929fb7f1aa0a4cb082dda51561158fe`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**（由 Kong 落地）。 |
| **v1.13** | 2026-10-12 | **回写单（与实现真相对齐 + 真机诊断定案 · 只追加 + 就地留痕）**：**① 键集新基线回写** = **顶层 `122` / 拍平 `1045` / 四语节点 `4180`**（`= 1045 × 4` 自洽；**Jing 现取**；改前 `127/1053/4212`；算式闭合 = 拍平 `1053 − 11 + 3`、顶层 `127 − 6 + 1`） · **② `F10` 内部标识改名收口**（`sf-item*` 命中 `144` / 唯一类 `33`；`data-sf-m="item-*"` 唯一 `39`；**残留 `sf-listings` = `0`**；**几何零变化判据 = `/item/1` 8 元素 × 390/1440 共 16 个 rect 逐值相同**） · **③ `F13` 死键清理收口**（11 死键四语同删已执行） · **④ 真机诊断定案**（手机实站内 `html[data-theme]=dark` / `.sf-shell` `rgb(11,12,14)` / `--sf-page-bg:#0B0C0E` / 父页 `prefers-color-scheme=false` / 色卡 9/9 回读精确 ⇒ `F7`+`N26`+`N31` 一族收口为「已定案 = 本站夜档 + 屏幕忠实」；「浏览器强制深色」「色域/屏幕」两假设排除；**诊断工具 `/_preview/colors` 的持久价值已登记**） · **⑤ 新观察 `N38`**（同源 iframe 与父页 `prefers-color-scheme` 可相反 ⇒ 不得以父页值推断 iframe 主题） · **⑥ `/item/999999` 口径**（详情页内空态 · 已知口径非缺陷）。**⇒ 新增 §17**；**§16.2 / §16.3 / §16.5 收口回写**；**§13.6 `N26` / §14.8 两处就地加注**（原地正文一字未动）。**改前快照** = `docs/versions/design-system.spec.v1.12.md`（`cmp=0`；md5 `448f038e79a071347fbb7e5573040e1d`）；**本版镜像** = `docs/versions/design-system.spec.v1.13.md`（`cmp=0`）。**只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停服务；未 `git add -A` · 未 commit · 未 push**。 |
| **v1.14** | 2026-10-12 | **Kevin「主题初始默认跟随系统」裁定落册 + catch-all 上线回写（只追加 + 就地留痕）**：**① `T93` 三级优先序**（用户显式 `localStorage['theme']` ＞ 首访跟随系统 `prefers-color-scheme`〔`index.html` 内联脚本设 `data-theme` · 不落盘〕＞ 默认日档 `day`；`matchMedia` 只许在 `index.html` 内联脚本、不得进 `src/theme/**` / `src/shell/**` JS〔硬断言维持〕；`readInitialTheme()` 顺序不变 = 属性 > localStorage > 默认）· **② 配套两条**（初始应用不落盘 / 无 `matchMedia` ⇒ 回退日档不抛错）· **③ catch-all 提示页已实现 · 已上线**（`NotFoundPage` · 四语 12 例实测 · 旧路由不再白壳；`T91`/§16.2/§16.5 就地注）· **④ `/item/999999` 依据补记**（§17.4 就地注；route 册 v2.30 §40.1 + 本册 §17.4 已记，只补依据行）· **⑤ 主题章就地注**（真机诊断定案补记：Kevin 确认切日档正常；夜档 = origin 显式选择非强制深色；`T42` 键名 / `T43` 机制以 `T93` 为现行口径）· **⑥ 台账新增 `F16`**。**⇒ 新增 §18**（`T93` + 配套 + 现取边界 + 断言影响）。**改前快照** = `docs/versions/design-system.spec.v1.13.md`（`cmp=0`；md5 `b6e3685e84441ef582b73f1cbf012d9c`）；**本版镜像** = `docs/versions/design-system.spec.v1.14.md`（`cmp=0`）。**只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停服务；未 `git add -A` · 未 commit · 未 push**。 |
| **v1.15** | 2026-10-12 | **`/item/:id` 详情页 UI 改造（变体 A = 闲鱼结构 × 本站主题）落册（Kevin 2026-10-12 拍板 · 五条逐字采用 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① `T94` 范围 + 渲染面白名单**（只改详情页；只渲染 价格行 / 大标题 / 详情面板 / 底部操作栏（**仅「立即购买」**）/ 页内返回箭头 / 既存 `.sf-item-note`；不渲染 卖家行 / 属性两列 / 集市横幅 / 划线原价 / 比市场价 / 包邮 / 想要·浏览计数 / 留言 / 收藏 / 聊一聊 —— 判据 = **无数据承载不渲染**，数据面 `GET /api/prize/:bID` 现取无 owner/seller · 无 media_urls · 无品牌/成色） · **② `T95` 隐藏底栏机制（二选一裁死）**（**采纳「DOM 恒在 + 页面级 `display:none`」**：`BottomTabBar` 恒渲染 + 详情路由追加 `is-detail` 类 + `.sf-tabbar.is-detail{display:none}` 落 `src/styles.css` **顶层**；`shell.css` **一字不动**；**否决 DOM 移除**） · **③ `T96` 可达性硬 AC**（页内顶栏 = **返回箭头** · **不加搜索框** · 返回目标 = **固定回首页** · a11y 名复用 `item.list` · 触控复用 `.sf-tap-sq`） · **④ `T97` 桌面档**（桌面底栏本就 `display:none` ⇒ 导航不受影响；操作栏 **≤767 `fixed` / >767 内容流**） · **⑤ `T98` 结构常量落点**（**零新主题 token**；新增结构常量一律页面局部 `--sf-l-*` 落 `item.css`，**不得进 `STRUCT`**〔溯源硬门〕；CTA 胶囊半径复用 `--sf-st-radius-pill`） · **⑥ `T99` 视觉口径 + 参考图逐项映射表**（§19.4；未映射元素一律不渲染；CTA 黄底深字**逐字命中既有 `.sf-btn`** ⇒ 零新颜色；可见文本 ≥12px） · **⑦ i18n 零新增 / 零删除** ⇒ 键集 **122 / 1045 / 4180 逐字不变**（`item.refresh` 键保留为键卫生登记） · **⑧ 两条新教训 `N39`**（源码 / CSS 新注释禁写「`/*` 收尾的路径字面」· 吞码引信）**/ `N40`**（页面级隐藏共享外壳元素的口径：DOM 恒在 + 路由条件修饰类 + 全局 CSS 顶层） · **⑨ 留痕**（就地收窄 `T46`/`T80`「底栏恒 5 格」**仅限 `/item/:id`**；`T86`/`T75` 逐字不变） · **⑩ 待裁 `Q1`–`Q3`**（聊一聊 站内 vs 站外 Telegram · CTA 圆角 · 价格字号）。**⇒ 新增 §19**（`T94`–`T99` + `N39`/`N40` + §19.3 机制对照 + §19.4 映射表 + §19.5 渲染面/挂点 + §19.6 受影响硬断言清单 + §19.7 i18n + §19.8 归因式 AC + §19.10 留痕 + §19.11 待裁 + §19.12 未核实）。**改前快照** = `docs/versions/design-system.spec.v1.14.md`（`cmp=0`；md5 `7e67f2cdd95417502148bdff74ee95a2`；1673 行 / 354,073 B）；**本版镜像** = `docs/versions/design-system.spec.v1.15.md`（`cmp=0`）。**只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停服务；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `a111b45`。** |
| **v1.16** | 2026-10-12 | **回写单 · `/item/:id` 详情页 UI 改造（变体 A）实现真相回写（`R-A`–`R-F` 六条终审裁定 + `Q2`/`Q3` 已裁 + 白名单/AC-2 判据补齐 + `N41`/`N42` + §17.4 钩子就地更正 · 只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① 新 §19.13 = `R-A`–`R-F` 六条入册**（`R-A` = `item.line`/`priceServerNote`/`refundStockNote` 三键保留、折进 `.sf-item-meta-group`〔依据 = 既有可见内容 / 零数据依赖 / 删则成死键〕· `R-B` = CTA 胶囊 `--sf-st-radius-pill` 999px 落 `.sf-btn.sf-item-cta`〔复合选择器取胜〕· `R-C` = 大号价格 32px + **320 档零横向溢出硬门**〔溢出则回落 28px〕· `R-D` = ≤767 详情页等量底部内边距（机械量 +60px）· `R-E` = 详情页限 `:has()` 页脚补齐〔`.sf-shell:has(.sf-item-detail) .sf-region-foot`〕· `R-F` = `item.buyNote` 保留渲染〔携带幂等告知，与 `priceServerNote` 不冗余〕） · **② §19.11 `Q2`/`Q3` 就地回写为「已裁」**（胶囊 999px / 价格 32px + 320 档硬门；旧「待裁」字面逐字保留 + 标「已被 §19.13 `R-B`/`R-C` 取代」） · **③ §19.4 末表值更正** `--sf-l-detail-price-size` **28px ⇒ 32px**（28px 降为回落备值） · **④ §19.5 白名单 + §19.8 AC-1 判据补齐**（白名单由六项扩为「六项 + `R-A` 三键 + `R-F` buyNote」⇒ 否则按旧字面判会误判为负） · **⑤ §19.8 AC-2 href 字面集改锚**（实现无尾斜杠 ⇒ 改字面或明文「忽略尾斜杠」，登记为字面差异非缺陷） · **⑥ `R-D`/`R-E` 判据分离（§19.14）**（`R-D` = 机械量 +60px；`R-E` = 内容级遮挡 29→0 且 true→false，只在固定档判定；**`footCoveredPx` 是无效判据**） · **⑦ 新教训 `N41`**（跨文件同具体性覆盖：页面 CSS 先于 `shell.css` 落地 ⇒ 页面级形状修饰须在选择器上取胜；判据 = `border-radius` 计算值） · **⑧ 新教训 `N42`**（证据入库 vs `.gitignore`：`/.*-artifacts/` 吞目录 ⇒ `git add -f` 属已登记口径 + `check-ignore`/`ls-files` 两读数自证） · **⑨ §17.4 就地更正**（`item-back-link` ⇒ 现取 `item-back` + 新增 `item-actionbar`；旧快照字面不回改） · **⑩ §19.12 诚实清单更新**（真机 `env()` / `:has()` 非 Chrome / mock 数据面 ⇒ 三项 `NOT_MEASURED`）。**⇒ 新增 §19.13 / §19.14**。**改前快照** = `docs/versions/design-system.spec.v1.15.md`（`cmp=0`；md5 `910494eb9c290bbb8bf745f33bc67891`）；**本版镜像** = `docs/versions/design-system.spec.v1.16.md`（`cmp=0`）。**只写 `docs/**`；未动 `frontend/**` / `tools/**` / `ctrl/**`；未启停服务；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `2aee62f`（本地 · 未 push）。** |
| **v1.17** | 2026-10-12 | **Kevin「直接 A+C」（站内信最小闭环 + Telegram bot 绑定/通知一步到位）落册（只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① `Q1` 已裁 = 站内信 + Telegram bot 并行**（§19.11 就地注；route v2.27 §37「X/推特接驳位预留」语义作废 ⇒ Telegram 非 X） · **② `T100` 聊一聊激活**（详情页操作栏**第 3 格**；渲染条件 = 登录 ∧ 非卖家本人；未登录 = 既有登录引导；点击 = `POST /api/messages/conversations` 后进入会话） · **③ `T101` `/messages` 真页**（列表/详情/输入三态 + keyset 加载更多 + 空态；占位区块与 `xPlaceholder`/`xNote` 键删除） · **④ `T102` Settings 绑定面**（`ProfilePage` Telegram 卡三态 + code 步骤 + 解绑；env 缺 = 降级卡） · **⑤ `T103` 未读角标**（底栏第 4 格 + 桌面悬浮菜单消息项；取数 = 挂载 + 发送后 + 进入 `/messages` 后，无轮询；`99+` 封顶） · **⑥ i18n +35 / −2** ⇒ **顶层 `123` / 拍平 `1078` / 四语节点 `4312`**（§20.8 算式；12 文件计数断言前推 §20.7） · **⑦ 零新 token / 零 STRUCT 增项** · **⑧ 教训 `N43`**（预留槽位激活须同步回收占位键/钩子）。**⇒ 新增 §20**（`T100`–`T103` + `N43` + §20.7 断言清单 + §20.8 键清单 + §20.9 归因式 AC + §20.11 待裁）。**改前快照** = `docs/versions/design-system.spec.v1.16.md`（`cmp=0`；md5 `0400a3d9bbcc38b22cae0190b658c8ee`）；**本版镜像** = `docs/versions/design-system.spec.v1.17.md`（`cmp=0`）。**只写 `docs/**`；未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；未启停服务；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `3ae743e`。** |
| **v1.18** | 2026-10-12 | **Jing 微回写单 · v1.17 §20 两处自相矛盾裁定更正 + `T101` 删钩子引致的断言改锚登记（只追加 + 就地更正留痕 · 本单只写 `docs/**` + 快照 / delta · 不改代码、不改台账 / 挂账）**：**① §20.8 顶层键数算式更正** —— 原「顶层 `122 + 1`（`telegram`）`= 123`」**漏计 `msg`（`msg.err.MSG_*` 7 键）+ `tg`（`tg.err.TG_*` 5 键）** ⇒ **现行算式 = `122 + 3`（`telegram` + `msg` + `tg`）= `125`**（现取四语逐文件相等：顶层 `125` / 拍平 `1078` / 四语节点 `4312`；拍平 / 节点算式原写**正确、不变**）；**★ 键名不得改**（保持 `msg.err.*` / `tg.err.*`，与后端**已 commit** 的 `i18n_key` 字面对齐） · **② §20.3 + §20.9 `AC-1` 未登录口径更正（以 §20.2 为准）** —— 裁死：**卖家本人 ⇒ 不渲染**；**未登录 ⇒ 渲染且点击走既有登录引导（不 `disabled`）**；**登录且非卖家 ⇒ 正常进会话**；`AC-1` 判负项改为自洽形式（**未登录应看到第 3 格**；**只有卖家本人看到第 3 格才判负**） · **③ `T101` 显式删除项引致的断言改锚登记** —— `v15-nav-floatmenu.test.jsx:243-251` 现取仍断言旧占位钩子共存 ⇒ 改锚 = **占位钩子计数归 0 + 真页钩子在场**；属显式删除项引致的**合法前推、非语义放宽**（Kong 并行单执行）。**改动 = 版本头 + §12（本行）+ §20.3 / §20.7 / §20.8 / §20.9 / §20.12 / §20.13 就地注（旧字面逐字保留 + 标取代）**。**改前快照** = `docs/versions/design-system.spec.v1.17.md`（`cmp=0`；md5 `f0d8e248b791330bf1e45ba5cdfba084`）；**本版镜像** = `docs/versions/design-system.spec.v1.18.md`（`cmp=0`）。**只写 `docs/**`；未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；未启停服务；未 `git add -A` · 未 commit · 未 push**。**现取基线 = HEAD `680fc2a`。** |
| **v1.19** | 2026-10-16 | **Kevin「消息面板化（方案 1 · 就地叠加）」逐字裁定落册（只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① `T101` 收窄** = `/messages` 由**独立真页** ⇒ **内嵌面板**（原页原地左压 `600px`；面板外右侧仍是既有 `.sf-fm`）· **② `T104`** 面板化形态（**不换页** `?msg=1`；当前页原地左压、**挂载态与滚动位置保留**）· **③ `T105`** 打开/关闭判据 = **路由串匹配**（`stripLangPrefix(pathname) === '/messages'` ∨ `search` 含 `msg=1`；**严禁任何宽度判定**）+ 关闭 = 移除 `msg`/`c`（`replace`）+ 面板左上「×」+ 浏览器后退 · **④ `T106`** 几何冻结表（面板 `600px` / 右偏移 `104px` / 让位 `704px` / 左栏 `240px` / 右栏 `360px` / 全高 `fixed`；`≤767` = 全屏 + 单栏两态；**零断点值新增**）· **⑤ `T107`** 四入口保全（**`href` 一字不改**）+ `/messages` 语义变更（真页 ⇒ 直链落点 = 首页 + 面板）· **⑥ `T108`** 落点 = **新文件 `shell/messages-panel.css`**（`shell.css` 一字不动）+ 面板只用 `data-sf-m`（**不得新增 `data-sf-region`**）+ 壳层修饰类 `.sf-shell.sf-shell--msg-open`。**i18n = +1 键**（`messagesPage.close` 四语）⇒ **顶层 `128` 不变 / 拍平 `1103 → 1104` / 四语节点 `4412 → 4416`**（**现取**基线；13 文件硬编计数前推 = §21.7 清单 B）。**断言改锚** = 真改锚 **2 处**（`v15-nav-floatmenu.test.jsx:245` 用例名 + `:260` 钩子 `messages-page` ⇒ `messages-panel`）+ **冻结面零改锚 16 条**（§21.6 清单 A）。**改动 = 版本头 + §12 本行 + §20.2 表后一处就地注 + §20.4 末一处就地注 + §21（新）**；**改前快照** = 现盘 live 正文（`design-system.spec.v1.18.md` 为勘误前历史、**本单不触碰**）；**本版镜像** = `docs/versions/design-system.spec.v1.19.md`（`cmp=0`）。**未动 `frontend/**` / `backend-ts/**`；未启停任何服务；未 commit · 未 push。** |
| **v1.20** | 2026-10-17 | **Kevin「首页商品卡片 UI」逐字三条 + Zang 已裁定口径 `Q1`–`Q3` 落册（只追加 + 就地留痕 · 本单只写 `docs/**`）**：**① Kevin 原话三条**（背景色不要用黄色、黄只留顶部菜单栏 · 严格按参考图调「货币符号 + 金额」处 UI、其它部分酌情处理 · 整张卡片可点击）。**② `T109` 底色分层** = 新 token `--sf-surface-bg`（日 `#FFFFFF` / 夜 `#101114`）+ `--sf-page-bg` 日档 `#FDE815 ⇒ #F5F7F9`（夜档不变）+ `--sf-topbar-bg` 日档保持 `#FDE815`（黄色唯一落点）+ `.sf-route-container` 新挂 `var(--sf-surface-bg)` + `.sf-item-actionbar`（`item.css:349`）改挂 `var(--sf-surface-bg)` + **零几何改动**。**③ `T110` 价格块版式** = 同行 flex + `baseline` / `$` 小（数字高 75–80%）/ 数字大加粗 / **去框去底去内边距** / 色用既有 `--sf-price-*-fg`（参考图橙红 `#FF4D2E` **不采纳**）/ **「小数位更小」不适用**（积分恒整数）/ 零新 token、零 `STRUCT`。**④ `T111` 范围收窄** = 只改 `components/reward/RewardCard.jsx`；详情页价格块（`item.css` `.sf-item-price*` / `--sf-l-detail-price-size` 32px）+ `ThemePreviewPage` 的 `.sf-price` 家族**本单不动**。**⑤ `T112` 整卡可点击** = 卡片根单一 `<a>`、`href = buildLocalizedPath(lang,'/item/'+id)`（`utils.js:115`）、**卡内嵌套交互元素计数 = 0** ⇒ CTA 降级非交互视觉胶囊（保留 `item.viewDetail` + `reward-card-view`）、**不得引入 `.sf-btn` 族**（`p6-btn-impl2.test.js:73-89` 11 文件冻结清单不含 `RewardCard.jsx`）。**⑥ `T113` 无 Router 回落契约** = 裸渲染不得抛错、且不得产出 `<a href>`（既有用例 `i18n-batch-b2.test.jsx:154/158/170`）。**⑦ 真源纯追加块** = `docs/design/style-preview.html` **1044–1103 行**（`<section id="card-ui-ref-v120">`）；**改前 1042 行 / 86,638 B / md5 `13a845dacb6865ea3fa738663a63159c` ⇒ 改后 1103 行 / 93,949 B / md5 `7b8780af15802102f9ddf578510490a5`**（`git diff --numstat` = **`61 0`**、`head -n 1042 \| cmp` = 0）；**PROV 指针** = `page-bg.d ⇒ 1069` / `surface-bg.d ⇒ 1071` / `surface-bg.n ⇒ 1073`。**⑧ i18n 零新增 / 零删除** ⇒ 顶层 `128` / 拍平 `1104` / 四语节点 `4416` 逐字不变（不触发 §21.7 的 13 文件计数前推）。**⑨ 断言影响** = 真改锚 1 条（`tokens.js:266` 的 `page-bg.d` 指针 `200 ⇒ 1069` + 新键 PROV）+ 真改面 4 条（`A1` `>$</span>` 恰 1 · `A3` 无 Router 不抛错 · `A5` `theme-tokens.css` 生成物同步 · `A7` 不得引入 `.sf-btn`）+ 新增硬契约 2 条 + 冻结面零改锚 11 条。**⑩ 勘误（本单取证）** = 派单称首页卡片价格块「外套一层黄底黑框胶囊（`.sf-price` 家族）」**与现取不符**（现取 = Tailwind `text-yellow-600` + 数字/`$` 上下堆叠、无框无底；`.sf-price` 唯一消费者 = `ThemePreviewPage.jsx:152`）⇒ 派单描述逐字保留 + 标「与现取不符」+ 口径按现取写（`N47`）。**⑪ 待裁 `Q5`–`Q9`**（卡片底色纯白落点〔现 `variant='primary'` ⇒ `bg-yellow-50`〕· hover 黄环 · 夜档 `#101114` 分层可辨性 · 容器宽 `1500px`〔现 `1440px`〕· `$` 小号落点）。**改动 = 版本头 + §12（本行）+ §22（新）**；**改前快照** = `docs/versions/design-system.spec.v1.19.md`（开工复核 `cmp` = 0；md5 `1ac3dc50c40cb15d409d008090d02e47`；2355 行 / 517,050 B）；**本版镜像** = `docs/versions/design-system.spec.v1.20.md`（落笔后建，`cmp=0`）；**delta** = `docs/audit/design-system-v1.20-delta.md`；**证据** = `ops/ui-card-ref-20261017/readings/jing-*`。**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `ops/ui-card-ref-20261017/shots/**`；未启停任何服务；未 `git add -A` · 未 commit · 未 push。** |
| **v1.21** | 2026-10-17 | **Kevin「顶栏实黄」逐字三项 + Zang 冻结裁定 1–6 落册（只追加 + 就地留痕 · 本单只写 `docs/**` + 本单读数）**：**① Kevin 三项答**（顶栏「B 顶栏实黄」· 移动档「保持全白」· 「先把顶栏定下来、改完再一并 push（含生产终验）」）。**② `T114` 日档顶栏实黄不透明**（`rgb(253,232,21)` · alpha = 1 · `bg-opacity-95`/`backdrop-blur-sm` 失效 · 落点 `styles.css` 顶层 · `shell.css` 一字不动）。**③ `T115` 夜档顶栏冻结 `#1F2937`** + **日档限定 `:root:not([data-theme="dark"])` 为承重件**（不加限定 ⇒ 夜档被压成 `rgb(11,12,14)` · 实测 · `N53`）。**④ `T116` 日档下边框色 = `--sf-topbar-border`**（宽度保持 1px · 真源 2px 属几何变更 ⇒ 另裁）。**⑤ `T117` 日档顶栏前景 ≥ 4.5:1**（logo · `.nav-link` 的 `:hover`/`.active` · 注册登录 hover ⇒ `var(--sf-brand-fg)`；夜档维持现状 · `styles.css:146-147` 不得改）。**⑥ `T118` 零新 token / 零 `STRUCT` / 零几何 / 零新 i18n**（真源本单零改动）。**⑦ `T119` 作用面 = 全站顶栏面**（`Header` 全站共享 ⇒ 归因允许变更集扩集）。**⑧ §23.3 现取对比度表 14 行**（逐元素 · 现状 vs 改后 · 阈值 · 判）+ **取数路径差登记**（合成 vs 未合成：夜档 `12.63`/`14.68` · logo `2.90`/`2.94` · nav base `7.45`/`7.56`）⇒ **`N52`**。**⑨ 断言影响** = 真改锚 0 / 真改面 3（`.nav-link[href]` 集 · 五 `data-sf-region` 恒等 · 落点不越界）/ 冻结面零改锚 8。**⑩ §23.5 归因式 `AC-1`–`AC-10`**（三档像素 · 前景硬门 · alpha = 1 · 不穿透 · 反事实空集 · **两向灵敏度自证** · 零几何 · 移动档）。**⑪ 顺带勘误 / 发现** = 顶栏 `sticky` **实际不生效**（含块高 = 顶栏高）· 移动面板在 `#header` 子树内（其 `bg-white` 继承 95% 语义）· **移动面板「登录」胶囊 `2.80:1` ✗（既有 · 挂账）**；**待裁 `Q10`**（移动档读法）。**改动 = 版本头 + §12（本行）+ §23（新）**；**改前快照** = `docs/versions/design-system.spec.v1.20.md`（`cmp` = 0；md5 `6fa271687481dd69c70a5ce358b63dc5`；2646 行 / 607,188 B）；**本版镜像** = `docs/versions/design-system.spec.v1.21.md`（`cmp=0`）；**delta** = `docs/audit/design-system-v1.21-delta.md`；**证据** = `ops/ui-card-ref-20261017/readings/jing-v121-*`。**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `ops/ui-card-ref-20261017/shots/**`；未启停任何服务；未 `git add -A` · 未 commit · 未 push。** |
| **v1.22** | 2026-10-17 | **Kevin「`/item/:id` 操作栏 goofish 形态」裁定落册（只追加 + 就地留痕 · 本单只写 `docs/**` + `frontend/src/theme/**` + 本单读数）**：**① 本轮唯一新增 2 个颜色 token** —— `--sf-cta-solid-bg` 日 `#202020` / 夜 `#EDEFF2`、`--sf-cta-solid-fg` 日 `#FFFFFF` / 夜 `#0A0A0A`（**夜档成对反相**：夜档深页上深底会消失 ⇒ 亮底深字；亮底色值与 `--sf-title-fg` 夜档同源；日档底色取既有 ink 家族 `--sf-btna-fg` 同值，**不引入第二套墨色**）。**② 其余全部复用既有 token、零新增** —— `聊一聊` = `--sf-btna-bg` / `--sf-btna-fg`（日夜同值 `#FFE60F` / `#202020`）；`收藏` = `--sf-btnalt-bg` / `--sf-btnalt-fg` / `--sf-btnalt-border`（夜档自带反相）。**③ 新增 §24 + 规则 `T120`** —— 三段结构（组合条 2 段 + 留白 + 独立收藏）· 组合条内部占比 `聊一聊 58% / 立即购买 42%`（±1 个百分点）· 组合条与收藏**留白 > 0** · **两端半圆 + 中缝直角**（中缝 4 角 = 0）· 收藏 = 独立胶囊 · **两档几何逐值相等**（颜色以外不进主题层）· 几何常量落页面局部 `--sf-l-*`（承 `T98`，**不进 `STRUCT`**）。**④ 四处同动读数** —— 真源尾部纯追加 `<section id="item-actionbar-ref-v122">`（**1103 行 / 93,949 B / md5 `7b8780af…0490a5` ⇒ 1172 行 / 102,653 B / md5 `a17919a4…013753`**；`numstat = 69 0`）· `tokens.js` 两档键 **110 ⇒ 112**（同索引 `107` / `108`；`numstat = 12 0`）· `PROV` 新指 **1130 / 1133 行** · `theme-tokens.css` 生成器重生成（先跑零漂移 `cmp = 0`）**8,155 ⇒ 8,275 B**（`numstat = 4 0`）。**⑤ 断言影响 = 零计数常量前推** —— 仓内 token 计数断言全为下限 / 包含式 ⇒ **未改任何测试文件**。**⑥ 未动面** —— `frontend/src/pages/item/**` / `ItemDetailPage` / `shell.css` / `data-sf-region` 集合 / `--sf-l-actionbar-h`(60px) / 任何既有 token 值 / §1–§23 与真源 1–1103 行：**一字未改**。**⑦ 挂账** —— 「收藏」无数据承载 / 无收藏接口 ⇒ 接后端 vs 视觉按钮**待裁**（§24.6 第 1 项）。**未 `git add -A` · 未 commit · 未 push。** |
| **v1.23** | 2026-10-17 | **「首页商品卡片动作胶囊下线」勘误单（只追加 + 状态改写 · 旧字面逐字保留 · 本单只写 `docs/**` + 本单读数）**：**① Kevin 指令** = 「首页商品卡片移除『查看详情』胶囊」（实现 = `RewardCard.jsx` 的 `actionLabelKey` 存在时动作胶囊**整块不渲染**）。**② 口径改写（取代 `T112` 的 CTA 子条）** = **首页卡片不渲染动作胶囊** · **入口由整卡链接承载**（卡根单一 `<a>`，`href` = `buildLocalizedPath(lang,'/item/'+id)`）· **卡内交互元素计数仍 = 0** · **钩子 `reward-card-view` 随胶囊下线**。**③ 落点** = §22.2 `T112` 后勘误段 · §22.6「CTA 形态」取代行 · §22.9 `AC-3 · v1.23 勘误注` · §22.12 `6-勘误（v1.23）` · `docs/OPEN-ITEMS.md` `F32` 状态改写（+ 头部 v2.40 块）。**④ 读数** = 首页卡内 `reward-card-view` **4 → 0**（1440 / 390 同）· 卡根 `a[href]` 仍在 · 卡内交互元素 `0 → 0` · 末行子元素 `2 → 1` · 点标题仍跳 `/item/3041` · 门套 **57 files / 554 tests 前后不变** · CSS 零变化。**⑤ 零变化面** = 零新 token / 零 `STRUCT` / 零 CSS / 零真源（`style-preview.html` 一字未动）/ i18n 零新增零删除（`item.viewDetail` 键保留不删）。**未 `git add -A` · 未 commit · 未 push。** |
| **v1.24** | 2026-10-19 | **Kevin「宽度与列数」两项口径落册（新增 §25 + 规则 `T121` + 三项结构常量链 · 只追加 + 就地指针 · 本单只写 `docs/**`）**：**① 容器最大宽 `1536px`**（`shell-max-w` `1440px ⇒ 1536px`；**「1500 不是标准宽度」已当面说明** ⇒ `1500` 退出候选；承 §22.11 `Q8`「保持 `1440px`」⇒ **被本版取代**、原行一字未删 + 追加指针行）。**② 列数断点 = `≥1280 ⇒ 6` / `768–1279 ⇒ 4` / `<768` 手机档不变**（现 d `2` / n `1` ⇒ 是否调 2/2 挂 `B38`）+ **夜档 `feed-cols` `3 ⇒ 4` 统一**（回归「列数不得按主题变」）。**③ 落点约束 = `shell.css` 只许唯一 `767` 块**（现取 `@media` 计数 `1`）⇒ `1280` 的 6 列规则落 **`src/styles.css` 顶层 `@media (min-width:1280px)`**（承 §14 gutter 先例），只覆盖 `.sf-grid` 的 `grid-template-columns`。**④ 三件链** = `style-preview.html` 纯追加真源块（`max-width:1536px` / `repeat(6,…)` / 夜档 `repeat(4,…)`）⇒ `tokens.js` `STRUCT`/`STRUCT_PROV` 重指（**新键 `feed-cols-xl: 6`** + `shell-max-w` + `feed-cols.n`）⇒ `theme-tokens.css` 重生成（先零漂移 `cmp=0`）。**⑤ 零 i18n / 零颜色 / `TOKEN_KEYS` 不动**；**实现待发（笔 2）**。**★ 编号勘误**：派单写 `T104`，但 `T104` 已被 v1.19 §21 占用 ⇒ 顺延 **`T121`**。 |
| **v1.25** | 2026-10-19 | **Kevin「商品卡固定尺寸」四条逐字落册（新增 §26 + 规则 `T122` + `Q5` 勘误 + route `§41.3` 勘误指针 + data-layer §40.7 · 只追加 + 状态改写 · 本单只写 `docs/**`）**：**① 卡高恒 412**（不随内容；`252` 为测量近似、宽随 `T121` 六列网格 ≈225 @1536）。**② 预览图** = 卡顶通栏 × 高 240 · `object-fit:cover` 居中裁切 · 图源 `media_urls[0] > image_url > url_image > placeholder-item.webp`（机械鱼占位同规格同裁切）。**③ 移除** = 状态徽章（`statusText` 全态 + `getRarityIcon`/`Gift`）·「N 人已领取 / 总数」行 · `limited` 徽章。**④ 保留** = 整卡链接 / `$` 价格块 / 描述 clamp / 剩余时间行（条件）/ CTA（`actionLabelKey` 路径逐字不变）/ 稀有度光斑。**⑤ 卖家栏 48** = 24px 圆头像（`users.avatar_url`〔迁移 `0052`〕null ⇒ 灰底 + 掩码首字符占位）+ `maskWalletAddress` 星号掩码昵称（灰色）+ 右侧信用胶囊（无图标 · 色值不锁）；信用四档由 `rating` 按 `ratee_uid` 均星派生（≥4.5 优秀 / ≥3.5 良好 / <3.5 一般 / 无评分新卖家）、**独立于排序公式**。**⑥ 后端 / i18n** = feed 行键 45→46（`seller` 加性键）· 详情 `seller`+`credit`（顶层仍 46）· `sellerCredit` 4 键（top 129 / flat 1114 / nodes 4456）· 迁移 `0052_users_avatar_url.sql`（无写入口，头像上传另立单）。**⑦ 死键（不删、挂 `B40`）** = `rewardCard.limited` / `common.claimedUnit`；**留活** = `insufficient` / `claimNow` / `claimed` / `timeLimited`（保留面消费）。**⑧ 判负 7 条**（§26.7：卡高≠412 / 图高≠240 / 非 cover / 徽章或领取行出现 / 卖家栏缺失或≠48 / 档位不符 / 明文 EVM）。**⑨ `Q5` 稀有度图标口径作废**（旧句保留 + 行后勘误行）；**route `§41.3`「`…` 掩码」作废 ⇒ 6 星定式**；`statusText` 映射保留、消费点移除。**本笔零代码 · 删行 0 · 未 push**。 |
| **v1.26** | 2026-10-24 | **Kevin「移动底栏恒 4 格（取消【卖闲置】）+ 桌面浮菜单保留【卖闲置】+ STRUCT token `tabbar-cols` `5 → 4`」裁定落册（状态改写式 · 只追加零删行 · 本单只写 `docs/**`）**：**① 底栏（H5）取消【卖闲置】格 ⇒ 恒 4 格**（`home` / `shard` / `messages` / `profile`）⇒ 新规则 **`T123`**；**② 桌面右侧悬浮菜单（`>767`）保留【卖闲置】** ⇒ 仍**五项**（`wage` / `sell` / `messages` / `app` / `support`），**`FM_ITEMS` 一字未改**、`/item/new` 保留可直链；**③ STRUCT token `5 → 4` 四处同动**：真源 `docs/design/style-preview.html` **尾部纯追加块 `L1188–1193`（新真源行 = `L1192`）** · `tokens.js:421` 值 `4` · `STRUCT_PROV['tabbar-cols']`（`tokens.js:465`）指向 **`1192`** · `theme-tokens.css:24`；**旧 `SP:169` 的 `repeat(5,1fr)` 逐字保留为历史、不作应用值**；PROV 硬门已绿；**④ 几何实测**：390 档 `97.5px × 4`、末格贴右、`scrollWidth − clientWidth = 0`；1440/1536 底栏 `display:none` 但 DOM 仍 4 格；1536 浮菜单 `sell` 可见（`72×92`、`href=/item/new`）；**⑤ i18n 零变更**（顶层 `135` / 拍平 `1451` / 四语节点 `5804`，四语相同；`sell` 键保留、仍被浮菜单消费）；**⑥ 新教训 `N54`**（STRUCT token 变更：真源新行只追加、旧行留痕不动）。**⇒ 新增 §27**（`T123` + `N54` + 留痕清单）。**改前快照** = `docs/versions/design-system.spec.v1.25.md`（`cmp=0`；md5 `ffa8cf62fc1180aec1db8b10dff2df4e`）；**本版镜像** = `docs/versions/design-system.spec.v1.26.md`（`cmp=0`）。**未动 `frontend/**` / `backend-ts/**` / `master-plan` / `route-layer.spec`；未启停服务、未占端口。现取基线 = HEAD `806ea51`。** |
| **v1.27** | 2026-10-24 | **Kevin「首页取闲鱼的视觉、不取它的语义欠债」裁定落册（状态改写式 · 只追加零删行 · 本单只写 `docs/**`）**：**① 闲鱼实测（换正常 UA 后真 DOM）** = 首页 `h1` **0** / `h1`–`h6` **0** / 地标 `header` + **`main`×2**（**无 `nav`**）/ 元素 `2648` / 正文 `2581` 字；详情 `/item?id=765416638957` `h1` **0** / `h1`–`h6` **0**。**② 裁定** = 视觉无页面标题 + 保留 **`1×1`** 视觉隐藏 `h1`（容器首子 · 复用 `siteBrand` · `.sf-visually-hidden` 落 `styles.css` 顶层）+ **不得**改【热门任务】`h2` 为 `h1`。**③ 三条理由** = APP 镜像 / 洪布流无主题可做标题 / `<title>` 接管。**④ 差异** = 我站另有 `h1`×1（隐藏）与 `h2`×2 与 `nav`，**有意不同**。**⑤ 新规则 `T125` + 教训 `N55` + 判负 6 条**；**零 token / 零 `STRUCT` / 零 i18n 键 / 零真源改动**。**改前快照** = `docs/versions/design-system.spec.v1.26.md`（`cmp=0`；md5 `f410b532d6ed86b8c17f6c48079ccb1b`）；**本版镜像** = `v1.27.md`（`cmp=0`）。**删行 0**。现取基线 = HEAD `4169140`。 |


### 与上游文件的关系（只读，本册未改一字）

| 文件 | 关系 |
|---|---|
| `docs/design/style-preview.html` | **唯一真源**；本册所有色值/形状值的提取目标（sha256 `b61ad55d…82deb`） |
| `docs/seafood.master-plan.md` §5.3 | 八条裁决逐条落地为 T1–T8、T23–T27、T35、T46、T63、T69 |
| `docs/seafood.master-plan.md` §5 D9 | 「一整套主题体系、两个外观档」→ T1；「形状也进 token 层」→ T3 / §3 |
| `docs/ledger.spec.md` | 编号体系错开（它用 `R1..R108`，本册用 `T1..T74`），互不冲突；本册不涉及账本口径 |
| `frontend/public/brand/logo.svg` | 品牌黄 `#FDE815` / 品牌黑 `#030402` 与比选稿一致（`SP:444` 内联副本 `.cls-1{fill:#fde815}.cls-2{fill:#030402}`）；本册 `--sea-accent`/`--sea-accent-fg` 即此二值 |

### 交付后待 Zang 裁决的两点

1. **N9 / T30**：列数取 A（4 列）⇒ 字号同源取 A ⇒ 放弃 B 的 `26px/30px/52px` 数字。若要求「保留 B 的大数字」，必须一并把列数改回 3 列 —— 二者不可拆分。
2. **N8 / T20**：6 个 `【本册指派】` token（hover / disabled / skeleton / focus-ring / border-strong / border-media）的用途指派是否接受；值本身均已标出处，改用途不动值。


---

## §13 手机竖屏（H5）加固口径 · P0–P4（v1.1 · Kevin 2026-10-11 定档）

**定档**：`seafood` 前端**桌面档不动**，把**手机竖屏（H5）档**做扎实，**P0–P4 全上**。

**依据（可复核，只读）**
- 设备档实测报告：`~/.hermes/profiles/zang/cache/scratch/seafood-mobile-measure/REPORT.md`（Neng 采集 / Zang 复核：40/40 样本零横向溢出；判负实验哈希 `baseline==rerun==restored`；tabbar 真实点击跳转 PASS；1440 档 tabbar `display:none`；console/JS error = 0）。
- 原始读数：同目录 `raw/page_readings.jsonl`（10 页 × {375,390,320,1440}）· `raw/experiments.json`（100vh 消费点）· `raw/experiments2.json`（导航重复的链接集）· `raw/negative_control.json`。

**口径三条**
1. 本册只冻结**口径/判据**，不写实现；数值一律 `文件:行号 + 现取值`（现取命令见各条）。
2. 「**设备档读数 ≠ 真机读数**」：凡只有真机可观测者，一律登记 `NOT_MEASURED`，并在 §13.5 逐条写明「本档只能证到哪一步」。
3. 判据一律**数值读数 + 可复跑命令**，不拄单一计数派单（例：报告 163 个 `<44px` 实例**含 `a` 内嵌 `button` 的成对计数** ⇒ 本册按「控件家族」去重后派单，见 §13.4 前注）。

### 13.1 规则条文（T75–T79）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T75** | 【本册裁定·P0】移动档 `.sf-tabbar` **必须声明 `padding-bottom: env(safe-area-inset-bottom)`**；属**结构层**（非 token：不进主题差集、不进 `STRUCT`）。**不得新增 `@media` 断点**（`shell.css` 必须保持「只有一个 767px 断点块」）。**配对硬要求**（v1.1 原文：真机生效需 `frontend/index.html` 的 `<meta name="viewport">` 含 `viewport-fit=cover`，现状见 §13.4）。**★ v1.2 升级（Zang 裁定）= P0 硬判据**：该 meta **必须**含 `viewport-fit=cover`（缺则 `T75` 不成立）；判据落点见 §13.4 第 2 行 / §13.5。 | `frontend/src/shell/shell.css` 的 `.sf-tabbar` 规则块（L63–69） | 新增 `@media` ⇒ 挂 `theme-shell-isomorphism.test.jsx` L215–229；改主题 token 驱动几何 ⇒ 挂 T69 几何恒等 |
| **T76** | 【本册裁定·P1】移动档顶部**汉堡面板不得包含底部 tab 已有的目标**（底部 tab = `/`、`/reward`、`/task`、`/exchange`；其中 `home` 由 Logo 承担）。即：面板内去 **`/reward`（社区奖励）、`/task`（社区任务）、`/exchange`（碎片市场）** 三项。**桌面档一字不动**（桌面无 tabbar，左侧 nav 保留三项）。 | `frontend/src/components/Header.jsx` 移动面板块（L338–478；菜单项渲染 L341–356）；**不得动** `menuItems`（L118–123）与桌面 `<nav>`（L171–183） | 改共享 `menuItems` ⇒ 连带桌面 nav ⇒ 挂 `theme-shell-isomorphism.test.jsx` L91–103；只改移动面板渲染 ⇒ 桌面断言全绿 |
| **T77** | 【本册裁定·P2 · **v1.2 收窄（Zang 裁定）**】触控目标 **≥44×44**，**只覆盖「主要操作路径」**（覆盖面四项**不变**，原文见下方「T77 留痕」）：① 顶栏全部控件；② 底部 tab 单元（已达标，仅登记）；③ 表单提交与危险操作按钮；④ 页脚语言链接。**★ v1.2 硬约束**：**实施范围一律限在 `@media (max-width: 767px)` 内** —— 所有 `min-height`/`min-width:44px` 追加与 `--sf-*-ctl-h` 改值**必须包在 767 断点块内**（**复用同一个断点值 767**；**不得新增断点类型**如 `pointer: coarse`；`frontend/src/shell/shell.css` 仍必须**只有一个 767 断点块**）。**桌面档几何零变化 = 硬判据〔★ v1.4 改「归因式判据」（反事实归因实验）〕**：**「1440 档差异集必须 100% 归因于 T79 字号提升。验证法 = 反事实归因实验：只在测量期回退 T79 字号（不动仓库）⇒ 差异集必须为空（`仅基线有 = 0` 且 `仅归因有 = 0`）；且差异集中不得存在与字号无关的几何/布局差异。」**；`.btn` 家族与 `--sf-*-ctl-h` 的**桌面使用值**仍 34/40。**〔v1.4 就地更正留痕 · 改前原文（v1.3「例外清单式」· 已作废）〕**：「1440 档逐元素 `getBoundingClientRect()` 相等，唯一允许的例外 = T79 字号提升所覆盖的元素，且例外集必须是当轮现取扫描的完整集（不得有未登记元素；发现任何额外元素 ⇒ 立缺陷）」—— 作废理由（两条）：① **字号变更会级联** —— 改一个 `font-size` 会经**行高**把**块级容器高度**与**下游兄弟/子元素**的定位一并推动 ⇒ 白名单法必须**逐元素枚举**（`/listing` 1440 差异集实测 **243** 条）⇒ 两百多条登记 **不可维护**；② **白名单法会漏掉 `display:none` 子树** —— `/exchange`、`/task/new`、`/task/:id` 各 **23** 个差异元素 = `.sf-tabbar` 子树（1440 `display:none` ⇒ 均 `0×0`）⇒ 既无可见几何影响、又不可能被「元素白名单」优雅覆盖。⇒ 改用**反事实归因**：测量期**整体回退 T79 字号**，若差异集随之**归零**（`仅基线有 = 0` 且 `仅归因有 = 0`）即证「**全部差异 = 字号级联**」，**无需逐元素枚举**。**〔v1.3 就地更正留痕 · 改前原文（已作废）〕**：「1440 档逐控件 `getBoundingClientRect()` 与现状逐值相等」—— 作废理由：现实里 T79 已有 **3 个元素例外**（`/listing .sf-listings-price-unit`、`.sf-listings-tag`、`/task/:id .sf-jobs-tag`，见 §13.2.1），原措词不加例外说明会让下一轮验收**自相矛盾**。手段**仅限**结构常量 `min-height`/`min-width` + `padding`；**不得改主题 token 色值/形状值**；**不得改 `STRUCT.h-btna`（桌面 A 口径 34px 冻结）**。 | 见 §13.4 逐项落点表（**每项均「限 ≤767」**）；断点块落点 = `frontend/src/shell/shell.css`（复用唯一 767 块）+ 各页 `*.css` 内 767 媒体块 | 用主题 token 驱动几何 ⇒ 挂 T69 与 `p6-btn-impl2.test.js` L112–136；抬高页内 `--sf-*-ctl-h` **若未包 767 块** ⇒ 桌面几何变 ⇒ **违「桌面档不动」**；**若已包 767 块** ⇒ `p6-btn-impl2.test.js` L138–155 **可能仍绿**（若红则最小改锚，见 §13.3 第 14 行） |
| **T78** | 【本册裁定·P3】断点**以实现值 767px 为准**（`frontend/src/shell/breakpoints.js:11` `phonePortraitMax: 767`）；§5.3 表 `--sea-bp-mobile-max` **原位更正 `639px→767px`**、邻档 `--sea-bp-tablet-min/max` 连带更正 `640px→768px`，**逐处留痕**（见 §5.3 表内留痕语）。`100vh`（`frontend/src/styles.css:342 .app-container`、`frontend/src/shell/shell.css:15 .sf-shell`）**本轮不动**，登记为「待真机读数后定」（真机读数将由新的 LAN 预览服务提供）。 | §5.3 断点表（`--sea-bp-mobile-max` / `--sea-bp-tablet-min/max` 两行；v1.1 版 = L308–309）；登记者 `docs/OPEN-ITEMS.md` | 改实现值 ⇒ 挂 `theme-shell-isomorphism.test.jsx` L215–229（它读 `BREAKPOINTS.phonePortraitMax`；实现不动即仍真） |
| **T79** | 【本册裁定·P4】**产品页可见文本最小字号 ≥12px**。真源 `docs/design/style-preview.html:170` **就地更正** `font-size:10.5px→12px`（**不改行号、不增删行**）；实现侧 `frontend/src/theme/tokens.js` 的 `STRUCT['tab-font-size']`（L397）与 `STRUCT_PROV['tab-font-size']`（L441，needle）同步为 `12px` / `'font-size:12px'`，生成物 `frontend/src/theme/theme-tokens.css:35` 同步；`frontend/src/pages/listings/listings.css:130`、`:140` 的 `11px→12px`。**★ v1.3 补登（D2 · Zang 裁定：保留 + 入册）**：`T79` 是**全站规则** ⇒ 实现方**另**对 `frontend/src/pages/jobs/jobs.css` 的 `.sf-jobs-tag`（规则块 L195–202，`font-size` = **L201**）做 `11px→12px`（**上轮 §13.4 未列**）⇒ `/task/:id` 在 **1440 档** 该元素 **34×20.5 → 36×22**（桌面侧受影响元素**完整清单（三类）** + 逐元素前后读数见 **§13.2.1**）。 | `tokens.js:397,441` · `theme-tokens.css:35` · `listings.css:130,140` · **`jobs.css:195-202`（v1.3 补）** · `style-preview.html:170` | 值变必须**真源同步**（PROV 硬门：`theme-tokens.test.js` L131–143 逐键回读 `SP` 行号）；只改 JS/CSS 不同步真源 ⇒ 该断言必红。**★ v1.3**：`.sf-jobs-tag` 字号**无真源 needle**（不被 `STRUCT`/`PROV` 消费）⇒ **不入 PROV 硬门**，但其**桌面几何变化必须登记**（§13.2.1）；`T79` 的桌面侧影响**统一按〔v1.4〕「归因式判据」**处理（§13.1 `T77` 行；改前「例外清单式」已作废） |

> **T77 留痕（v1.1 原文 · 一字未改 · 已被 v1.2 取代）**：
> | **T77** | 【本册裁定·P2】触控目标 **≥44×44**，**只覆盖「主要操作路径」**（不追求全站 44px，不得大面积重排）：① 顶栏全部控件；② 底部 tab 单元（已达标，仅登记）；③ 表单提交与危险操作按钮；④ 页脚语言链接。手段**仅限**结构常量 `min-height`/`min-width` + `padding`；**不得改主题 token 色值/形状值**；**不得改 `STRUCT.h-btna`（桌面 A 口径 34px 冻结）**。 | 见 §13.4 逐项落点表 | 用主题 token 驱动几何 ⇒ 挂 T69 与 `p6-btn-impl2.test.js` L112–136；抬高页内 `--sf-*-ctl-h` ⇒ 挂 `p6-btn-impl2.test.js` L138–155（**须改锚**，见 §13.3 第 14 行） |
> **取代理由（v1.2）**：上列口径**未限定媒体档** ⇒ 直接抬 `.btn` 家族 / `--sf-*-ctl-h`（34→44）会**连带抬高桌面控件**，与 Kevin 2026-10-11「桌面档不动」定档冲突。v1.2 以「**限 ≤767 档**」收窄范围，**覆盖面四项一字不变**。

### 13.2 P4 真源就地更正自证（本册已执行）

- **命令与读数**：`git diff --numstat docs/design/style-preview.html` ⇒ `1\t1`（仅 1 行改、0 行删）。
- **改前**：sha256 `9ddebde7fae6b3e7ecf62a3767c0ccfa418a23aa6d915cabe7e9effeba9b5bcd`，`80,291 B`，`982 行`；L170 = `.tabbar .tab{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0 12px;font-size:10.5px;font-weight:600}`。
- **改后**：sha256 `cd09248fb19a99f9598cd18362cd4c2a1fdee1d537409252f4c32b946d6f7da6`，`80,289 B`，`982 行`；L170 = `.tabbar .tab{…gap:3px;padding:8px 0 12px;font-size:12px;font-weight:600}`。
- **自证三读数**：**字节 −2** · **行数 ±0** · **改动行全部落在 L170（`.tabbar .tab` 区块内）**。因**未新增块**，不触发「纯追加到文件尾（`open(path,'ab')`）」分支，故无需 `md5(after[:N])==md5(before)` 三读数。
- **旁证（未改）**：L128 `.avatar.sm{width:19px;height:19px;font-size:10.5px}` **仍在场** —— 该值**不被任何产品 token 消费**（`STRUCT`/`TOKEN_KEYS` 无 `avatar-sm` 字号键），属比选稿**演示框内的值**，登记见 §13.6 / `docs/OPEN-ITEMS.md`，**本轮不动**。

#### 13.2.1 T79 全局字号提升 ⇒ 桌面侧受影响元素完整清单 + 逐元素前后读数（★ v1.3 补登 · D2 · Zang 裁定）

> **背景（D2）**：`T79` 是**全站规则**（产品页可见文本最小字号 ≥12px）。实现方（Kong）在落地时**不止**改了真源 `SP:170` 的 `.tabbar .tab`，还对**所有原 <12px 的可见文本字号**做了 `11px→12px` 提升。**其中 `frontend/src/pages/jobs/jobs.css` 的 `.sf-jobs-tag` 一处上轮 §13.4 未列** ⇒ 后果 = `/task/:id` 在 **1440 档**该元素 **34×20.5 → 36×22**。**Zang 裁定：保留该全局字号变更**（`T79` 是全站规则），**但必须入册**。

- **完整集口径**：本清单 = **`T79` 字号提升在桌面档（1440）真正改变几何的元素全集**。`T79` 的**全部**字号改点（现取，可复跑）：
  ```bash
  git show 4306527 -- frontend/ | grep -E '^[+-].*font-size'
  # ⇒ 11px→12px 恰 3 处（listings.css ×2、jobs.css ×1）+ tab-font-size 10.5px→12px 共 3 处（tokens.js:397,441 / theme-tokens.css:35）
  ```
  `--sf-st-tab-font-size`（底栏 tab 标签）在 **1440 档 `display:none`** ⇒ **不进**桌面几何例外集。⇒ **桌面侧受影响元素 = 三类**。
- **桌面侧受影响元素完整清单（三类 · 1440 档现取）**：

  | # | 页面 | 选择器 | 改前（1440） | 改后（1440） | 样本（文本） | 落点 / 备注 |
  |---|---|---|---|---|---|---|
  | 1 | `/listing` | `.sf-listings-price-unit` | **22 × 16.5** | **24 × 18** | 24 例（单价） | `listings.css:130`；高 由行高（16.5→18）定 |
  | 2 | `/listing` | `.sf-listings-tag` | **1040 × 22.5** | **1040 × 24** | 24 例（已上架） | `listings.css:140`；**宽由容器拉伸决定 ⇒ 仅高变**（22.5→24） |
  | 3 | `/task/:id` | `.sf-jobs-tag` | **34 × 20.5** | **36 × 22** | 1 例（`/task/2`，酬金） | `jobs.css:195–202`（`font-size` = **L201**）；**上轮未列** |

- **现取命令（可复跑 · 本册 v1.3 已跑）**：1440 视口下对每个选择器读 `getBoundingClientRect()`；「改前」= 运行时注入 `.sf-listings-price-unit,.sf-listings-tag,.sf-jobs-tag{font-size:11px !important}` 后复读（**只改运行期、不落盘**）。本册读数与 Neng D2 报的 `.sf-jobs-tag` **34×20.5→36×22 逐值一致**（互证）。
- **后果**：例外集**非空**（3 元素）⇒ 这正是 v1.3 必须把「桌面档不动」硬判据由「**逐控件逐值相等**」改写为「**例外清单式**」的原因（见 §13.1 `T77` 行 / §13.3 第 14 行 / §13.5 `P2 触控` 行）。**例外集之外的任何 1440 元素 rect 变动 ⇒ 立缺陷。**
- **★ v1.4 归因式复核（反事实归因实验 · 本册已跑）**：上表「三类 3 元素」= **v1.3 白名单法**枚举的「**直接字号**改点元素」；但 v1.4 的**反事实归因实验**（测量期**整体回退** T79 字号、**不动仓库**）揭示**真实 1440 差异集远大于 3**：
  - `/listing`：**243** 个 = **直接字号 48** + **级联 172**（`.sf-listings-tag` 高 **22.5→24** ⇒ 卡片/整页下移、页高 **7376.5→7412.5**）+ **未渲染 23**；
  - `/exchange`、`/task/new`、`/task/:id`：各 **23** 个 = **`.sf-tabbar` 子树**（1440 `display:none` ⇒ 均 **`0×0`**，**不产生可见几何影响**；`.sf-jobs-tag` 本轮 1440 未渲染）；
  - **归因实验结论**：**不相等集 ≡ 回退 T79 字号的变化集**（`仅基线有 = 0`、`仅归因有 = 0`）⇒ 差异 **100% 归因于 T79 字号提升**、**无与字号无关的几何差异** ⇒ 这正是 v1.4 弃「白名单法」改「**归因式判据**」的实证依据（见 §13.1 `T77` 行 / §13.5 `P2 触控` 行）。
- **未核实（★ v1.4 已由归因式判据覆盖）**：上述三类以外的产品页（发布 / 详情 / 交易所 / 我的）是否还有 `T79` 覆盖的 <12px 元素 —— v1.3 只证到「源码层面 `11px→12px` 恰 3 处」；**v1.4 起不再需要枚举「全站 1440 现取扫描的完整集」**（白名单法不可维护，见 §13.1 `T77` 行）—— 改为**反事实归因**：**整体回退 T79 字号 ⇒ 差异集归零即证 100% 字号归因**（已跑通，见上条 v1.4 复核）。

### 13.3 断言影响（逐条点名：哪条一字不动 / 哪条需改锚）

| # | 测试 `文件:行号` | 断言语义 | 影响 | 处置与理由 |
|---|---|---|---|---|
| 1 | `theme-shell-isomorphism.test.jsx:215-229` | `shell.css` 只有一个断点块（767px），底栏可见性只在这里翻转 | **一字不动** | P0 只加 `padding-bottom`（结构层），**不加 `@media`**；`.sf-tabbar` 宽屏 `display:none` / 竖屏 `display:grid` 不变 |
| 2 | `theme-shell-isomorphism.test.jsx:231-236` | `shell.css` 无 `[data-theme]` 选择器 | **一字不动** | P0/P2 不引主题选择器 |
| 3 | `theme-shell-isomorphism.test.jsx:91-103` | `.nav-link[href]` = `[/reward,/task,/exchange]`（顶栏=底栏去 home 子序列） | **一字不动** | **前提**：P1 只改**移动面板渲染**（该面板 `Link` 无 `nav-link` 类、且默认收起），**不改** `menuItems` 与桌面 `<nav>`。若误改 `menuItems` ⇒ 桌面 `topHrefs` 变 ⇒ 该断言必红 |
| 4 | `theme-shell-isomorphism.test.jsx:83-89` | 底部 tab 始终在 DOM、与 `visibleNavItems` 同序 | **一字不动** | P1 不动 `shell/nav.js` / `BottomTabBar.jsx` |
| 5 | `theme-shell-isomorphism.test.jsx:205-213` | shell/theme 的 JS 无 `matchMedia/innerWidth` | **一字不动** | P0 走 CSS `env()`，不引入 JS 判定 |
| 6 | `theme-tokens.test.js:131-143` | 结构常量提取证据逐条可回读 | **一字不动**（Kong 须同步） | P4 改 `STRUCT['tab-font-size']='12px'` 时，`STRUCT_PROV['tab-font-size']` 的 needle 必须同步为 `'font-size:12px'`（`tokens.js:441`，d/n 各一）。本册已把真源 L170 同步为 `font-size:12px` ⇒ 回读成立 |
| 7 | `theme-tokens.test.js:119-129` | `STRUCT` 两档同值 / 含 PROV / 不含颜色 | **一字不动** | `tab-font-size` 仍是字符串、无颜色 |
| 8 | `theme-tokens.test.js:167-179` | 生成物 CSS ↔ JS 逐键互校 | **一字不动**（Kong 须同步） | `theme-tokens.css:35` 必须同步为 `--sf-st-tab-font-size: 12px` |
| 9 | `r9-84-profile-entry.test.jsx:205-213` | 左侧 nav 仅 奖励/任务/碎片 | **一字不动** | 该处 `document.querySelector('nav')` 命中的是**桌面 nav**（`Header.jsx:171`）；P1 不动桌面 nav ⇒ 仍 `[reward,task,shard]` |
| 10 | `r9-84-profile-entry.test.jsx:215-232` | 移动面板含 个人资料 / 电量与签到 / 退出登录 | **一字不动** | P1 只删 nav 三项，用户菜单块（`Header.jsx:444-476`）保留 ⇒ 三个 `data-sf-m` 钩子仍在 |
| 11 | `r9-93-points-symbol.test.jsx:101-109` | `Header.jsx` 的 `>$</span>` 计数 = 1、且无 `DashJ` | **一字不动**（Kong 须守） | P1 删移动 `menuItems` 渲染块不得触及 `Header.jsx:267` 的 `$` span、不得引入 `DashJ` |
| 12 | `p6-btn-impl.test.js:140` | `parseFloat(STRUCT['h-btna']) === 34` | **一字不动**（P2 约束） | P2 **不得改 `h-btna`**（桌面 A 口径冻结）；触控下限用**独立 `min-height:44px`** 实现 |
| 13 | `p6-btn-impl.test.js:170-179` | `.btn.btn-a` 含 `height:var(--sf-st-h-btna)` | **一字不动** | P2 只**追加** `min-height:44px`（`min-height` > `height` ⇒ 使用值 44），不改 `height` 声明 |
| 14 | `p6-btn-impl2.test.js:138-155` | 各页 micro 类 `min-height = 页内 ctl-h = STRUCT.h-btna（34px）` | **改锚预期变化（v1.2）**：**若红则最小改锚**〔v1.1 原文 = 无条件「**必须改锚**」，已被本行取代〕 | **v1.2 更正**：`--sf-j/k/l-ctl-h` 抬到 44 **包在 `@media (max-width:767px)` 块内** ⇒ 文件**顶层**仍 `34px`（= `STRUCT.h-btna`）⇒ L155 `expect(parseFloat(m[1])).toBe(h)` **可能仍绿**（取决于该测试解析面是否含媒体块）。**若红则最小改锚（新判据）**：`expect(parseFloat(m[1])).toBeGreaterThanOrEqual(44)`；且用例名/注释（L138）由「= STRUCT.h-btna（34px）」改为「= 触控下限 ≥44px」。理由：手机档触控下限 44 **覆盖**桌面派生 34，且**桌面档几何零变化**为硬判据〔★ v1.4 = **「归因式判据」**：**「1440 档差异集必须 100% 归因于 T79 字号提升。验证法 = 反事实归因实验：只在测量期回退 T79 字号（不动仓库）⇒ 差异集必须为空（`仅基线有 = 0` 且 `仅归因有 = 0`）；且差异集中不得存在与字号无关的几何/布局差异。」**；见 §13.1 `T77` 行 / §13.2.1〕〔**v1.4 留痕**：改前 v1.3 字面 =「例外清单式：1440 档逐元素 `getBoundingClientRect()` 相等，唯一允许的例外 = T79 字号提升所覆盖的元素，且例外集必须是当轮现取扫描的完整集」**已作废**（作废理由见 §13.1 `T77` 行）〕 |
| 15 | `p6-btn-impl2.test.js:112-125` | `.sf-btn` 基类无 hex/rgba、var() 白名单 | **一字不动** | 追加 `min-height: 44px`（px 字面量、无 var）不触该断言；若改走 var，须为 `--sf-st-*` 前缀 |
| 16 | `fix-nav-langshell.test.jsx`（整体） | 语言前缀登录路由 / 链接构造器 | **一字不动** | 全程 `vi.mock('../../components/Header')`，与 P1 无关 |

> **一句话**：P0/P1/P3 **不动任何测试**（前提是 P0 不加 `@media`、P1 只改移动面板渲染）；P4 **不动测试**但须同步 `tokens.js` PROV needle（否则第 6 行断言必红）；**唯一须改锚者 = `p6-btn-impl2.test.js:138-155`**（第 14 行）。 〔**v1.2 更正（Zang 裁定）**：第 14 行已改「**若红则最小改锚**」—— `--sf-*-ctl-h` 抬 44 包在 767 块内后，顶层仍 34 ⇒ L155 **可能仍绿**；上句「唯一须改锚者 = `p6-btn-impl2.test.js:138-155`」据此作废，改为「**若红则最小改锚**」〕 〔**v1.3 追加**：本节第 14 行所引「桌面档几何零变化」判据已**改写为「例外清单式」**（唯一例外 = `T79` 字号提升元素；见 §13.1 `T77` 行）；`T79` 的桌面侧影响**不落任何测试文件**（无断言锚点），故本节**不新增行**，只在 §13.2.1 登记「例外集」〕 〔**v1.4 追加**：本节第 14 行所引判据**再次改写** —— 由 v1.3「例外清单式」**改「归因式判据」（反事实归因实验）**（见 §13.1 `T77` 行）；`T79` 的桌面侧影响**仍不落任何测试文件**（无断言锚点），故本节**仍不新增行**，桌面侧证据只落 §13.2.1〕

### 13.4 Kong 实现清单（逐项 `文件:行号` + 现状值 + 目标值 + 依据条文）

> **前注（去重口径，防拄 163 派单）**：报告 390 档 `<44px` 实例 = **163 个**（含 `a` 与其内嵌 `button` 的**成对计数**），去重 selector = **31 个**；本册按「**控件家族**」收敛为下表 **20 类**。逐类「现状值」均由 `raw/page_readings.jsonl`（390 档）现取；「现取」命令 = 复跑 Neng 脚本 `document.querySelectorAll('a,button,input,select,textarea,[role=button]')` 过滤可见后读 `getBoundingClientRect()`。

**P0 · 底部安全区**

| # | 文件:行号 | 现状值（现取） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 1 | `frontend/src/shell/shell.css:63-69`（`.sf-tabbar` 基块） | 无 `padding-bottom`；计算值 `0px`（375/390/320 三档）；`grep -rn 'env(safe-area-inset' frontend/src` = **0 命中** | 声明 `padding-bottom: env(safe-area-inset-bottom);` | 结构层声明（**不加 `@media`**） | T75 |
| 2 | `frontend/index.html:10` | `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`（**无 `viewport-fit`**） | 追加 `viewport-fit=cover` | meta 属性（真机生效的必要配对） | T75 |

**P1 · 移动端导航去重**

| # | 文件:行号 | 现状值（现取，`raw/experiments2.json`） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 3 | `frontend/src/components/Header.jsx:341-356`（移动面板 `menuItems.map`） | 面板 `a[href]` 含 `/reward`(社区奖励)、`/task`(社区任务)、`/exchange`(碎片市场) —— 与底部 tab 同目标 | 移动面板**不渲染**这三项（`admin`（若有）/注册/登录/语言/主题/用户菜单保留） | **局部过滤**（不得动 `menuItems` L118–123 与桌面 nav L171–183） | T76 |

**P2 · 主要路径触控目标 ≥44×44**（**v1.2 硬约束：下列全部改动一律限在 `@media (max-width: 767px)` 内；桌面档几何零变化为硬判据**）

| # | 文件:行号 | 现状值（现取，390 档） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 4 | `Header.jsx:163`（Logo `a.text-xl.font-bold.text-yellow-600`） | **163.09 × 28** | ≥44 高 | `min-height:44px`（+`inline-flex;align-items:center`） · **限 ≤767** | T77 |
| 5 | `Header.jsx:322-332`（汉堡 `button.p-2.rounded-md`） | **40 × 40** | ≥44 × 44 | `min-height`/`min-width:44px` · **限 ≤767** | T77 |
| 6 | `Header.jsx:188-197`（桌面语言触发器）/`:230-237`（主题）/`:245-254`（用户菜单），共享 `.nav-link` | **派单口径 40×40**（未逐项落 report 表，见 N19） | ≥44 × 44 | 共享 `.nav-link`/按钮 `min-height:44px`（+`min-width`） · **限 ≤767** | T77 |
| 7 | `Header.jsx:387-426`（移动面板语言按钮网格）/`:432-441`（移动主题按钮） | **折叠态未测**（面板收起 ⇒ 不在 report 采样面，见 N19） | ≥44 高 | `min-height:44px` · **限 ≤767** | T77 |
| 8 | `frontend/src/shell/shell.css:71-86`（`.sf-tab` 底部 tab 单元） | **75 / 78 / 64 × 60.75**（**已达标**） | 登记，**不改** | — | T77 |
| 9 | `frontend/src/styles.css:139-159`（`.btn` 默认档） | 高 **40**（首页 96×40 / 登录 240×40） | ≥44 | **追加** `min-height:44px`（使 `.btn.btn-a` 的 `height:34px` 由 `min-height` 抬到 44；**不改** `height` 声明） · **限 ≤767**（桌面档仍 40/34） | T77 |
| 10 | `styles.css:281-298`（`.btn.btn-a` / `.btn.btn-a-alt`） | 高 **34**（首页 82×34、登录 240×34） | ≥44（由 #9 生效） | —（受 #9 覆盖 · **限 ≤767**） | T77 |
| 11 | `styles.css:170-178`（`.btn-md` / `.btn-lg`） | `btn-md` 82×**34**、`btn-lg` 86×**34** | ≥44（由 #9 生效） | —（受 #9 覆盖 · **限 ≤767**） | T77 |
| 12 | `styles.css:189-195`（`.btn-inactive`） | 96 × **40**（「积分不足」） | ≥44（由 #9 生效） | — · **限 ≤767** | T77 |
| 13 | `styles.css:201-208`（`.btn-proceed`） | 96/240 × **40**（「查看全部」/「签名登录」） | ≥44（由 #9 生效） | — · **限 ≤767** | T77 |
| 14 | `frontend/src/pages/jobs/jobs.css:21`（`--sf-j-ctl-h: 34px`） | `34px` | `44px` | 结构常量改值（页内 `--sf-j-*`） · **限 ≤767**（改值包在 767 块内；顶层仍 34） | T77 |
| 15 | `jobs.css:106-113`（`.sf-jobs-btn`：发布招工/审核入口） | **78 × 37.5** | ≥44（由 #14 生效） | — · **限 ≤767** | T77 |
| 16 | `frontend/src/pages/market/market.css:12`（`--sf-k-ctl-h: 34px`） | `34px` | `44px` | 结构常量改值 · **限 ≤767**（改值包在 767 块内；顶层仍 34） | T77 |
| 17 | `market.css:167-180`（`.sf-mkt-input` / `.sf-mkt-select`） | **340 × 37.5 / 340 × 35** | ≥44（由 #16 生效） | — · **限 ≤767** | T77 |
| 18 | `market.css:182-188`（`.sf-mkt-btn`：挂单/全体撤单/刷新） | **52 / 78 × 37.5** | ≥44（由 #16 生效） | — · **限 ≤767** | T77 |
| 19 | `frontend/src/pages/listings/listings.css:18`（`--sf-l-ctl-h: 34px`） | `34px` | `44px` | 结构常量改值 · **限 ≤767**（改值包在 767 块内；顶层仍 34） | T77 |
| 20 | `listings.css:171-185`（`.sf-listings-input`）+ `:192-198`（`.sf-listings-btn`：退款/发货/收货/立即购买） | **276 × 37.5** / **52 / 78 × 37.5** | ≥44（由 #19 生效） | — · **限 ≤767** | T77 |
| 21 | `frontend/src/components/Footer.jsx:80-86`（语言链接 `a.text-sm`） | **28 / 48.03 / 56 / 65.63 × 20**（简体中文/English/粤语/Tiếng Việt） | ≥44 高 | `min-height:44px`（+`inline-flex;align-items:center`） · **限 ≤767** | T77 |

**P3 · 断点**：**无代码改动**（实现值 767 已就位，`breakpoints.js:11`）；本册只更正设计真源 §5.3。依据 T78。
**P4 · 最小字号**

| # | 文件:行号 | 现状值（现取） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 22 | `frontend/src/theme/tokens.js:397` | `'tab-font-size': '10.5px'` | `'12px'` | **就地改值**（行号不变） | T79 |
| 23 | `frontend/src/theme/tokens.js:441` | `'tab-font-size': { d:[170,'font-size:10.5px'], n:[170,'font-size:10.5px'] }` | needle 均改 `'font-size:12px'` | 就地改 needle（真源已同步为 `12px`） | T79 |
| 24 | `frontend/src/theme/theme-tokens.css:35` | `--sf-st-tab-font-size: 10.5px;` | `12px` | 就地改值（生成物 ↔ JS 互校） | T79 |
| 25 | `frontend/src/pages/listings/listings.css:130` | `.sf-listings-price-unit { font-size: 11px; }` | `12px` | 就地改值 | T79 |
| 26 | `frontend/src/pages/listings/listings.css:140` | `.sf-listings-tag { font-size: 11px; }` | `12px` | 就地改值 | T79 |
| 27 | `frontend/src/pages/jobs/jobs.css:195-202`（`.sf-jobs-tag`，`font-size` = **L201**） | `font-size: 11px;` | `12px` | 就地改值 | **T79（★ v1.3 补登 · D2；上轮 §13.4 未列；Zang 裁定：保留该全局字号变更并入册）** |

> **桌面连带声明（需 Kevin 认账）**：`.btn` 家族、`--sf-*-ctl-h` 属**共享结构层**（两档同值）⇒ 抬升 44 会**同时**抬高桌面档同族控件高度。此属**几何**变更（非桌面版式重排、非骨架/列数/顺序变更），与 T69「切档几何恒等」不冲突（两档同值）；「桌面档不动」在此解释为**不动桌面版式/骨架**。
> **★ v1.2 作废（Zang 裁定，原文保留为 v1.1 决策留痕）**：上条已作废 —— v1.2 把 T77 全部改动**收窄在 `@media (max-width: 767px)` 内** ⇒ **桌面档几何零变化**（不再抬高桌面 `.btn` 家族 / `--sf-*-ctl-h` 的桌面使用值），**无需 Kevin 认账桌面几何变更**。
> **★ v1.3 补注**：本块结论**不变**（桌面 `.btn` 家族 / `--sf-*-ctl-h` 桌面使用值仍 34/40）；但「桌面档几何零变化」的判据形态已**改写为「例外清单式」**（唯一例外 = `T79` 字号提升元素，见 §13.1 `T77` 行 / §13.2.1）—— 即桌面几何**并非绝对逐值不变**，而是「**例外集内允许变、例外集外必须逐值相等**」。
> **★ v1.4 补注**：本块结论**仍不变**（桌面 `.btn` 家族 / `--sf-*-ctl-h` 桌面使用值仍 34/40）；「桌面档几何零变化」判据形态**再改写为「归因式判据」（反事实归因实验）**（见 §13.1 `T77` 行 / §13.5 `P2 触控` 行）。**P2 的 D1 修复**（Kong commit **`ebca3ab`**）= ≤767 的变量覆盖**从「只挂主列根」扩到「主列根 + 主列与侧栏共同祖先 `.sf-layout`」**（三个页面 CSS 同改；**34px 基准未动**）⇒ 同根因第 4 面 `/task/:id` 侧栏 `.sf-jobs-status` 也一并覆盖；**修法/判负面**见 §13.5 `P2 侧栏` 行。

### 13.5 Neng 判负清单（每项：怎么判负 + 本档能证到哪一步）

| 项 | 正向判据 | 判负方法（可执行命令/读数） | 本档证据边界 |
|---|---|---|---|
| **P0 安全区（已声明）** | `grep -rn 'env(safe-area-inset' frontend/src` ≥ 1 命中 | 现取 = **0 命中**（`exit 1`）⇒ 改后须 ≥1；含 `padding-bottom` 关键字 | 设备档可判 |
| **P0 未新增断点** | `grep -c '@media' frontend/src/shell/shell.css` 仍 = **1** | 现取 = 1；改后须仍 = 1（新增 ⇒ `theme-shell-isomorphism` L215–229 必红） | 设备档可判 |
| **P0 真机重叠像素** | —— | **不可判**：设备档 `env(safe-area-inset-bottom)` 恒为 `0px`（`raw/experiments.json` `env.pb=0px`、`tabbarPB=0px`）⇒ `.sf-tabbar` 计算 `padding-bottom` **恒 0**，**不能**用「计算值从 0 变非 0」判负 | **`NOT_MEASURED`**：真机（带 Home 指示条 + `viewport-fit=cover`）量重叠量。**本档只能证「源码已声明」+「未新增断点」** |
| **P1 去重** | 展开汉堡面板后，面板 `a[href]` 集合 ∩ 底部 tab `a[href]` 集合 = ∅ | ① 展开后取面板 `a[href]`（现取含 `/reward`,`/task`,`/exchange`）；② 与 `[data-sf-region="tabbar"] a[data-sf-nav]` 的 `href` 求交；交集非空 ⇒ 判负。③ 反向（桌面 1440）：`document.querySelector('nav') a` 文案仍 = [奖励, 任务, 碎片] | 设备档可判 |
| **P2 触控** | 下列控件 `getBoundingClientRect()` 宽高均 ≥44（**v1.2：判据在 ≤767 档复跑**） | 复跑同款脚本：过滤可见后逐类判 `w≥44 && h≥44`；**「主要路径」<44 计数必降**（现取 390 档 = 163 实例 / 31 去重 selector）。**★ v1.4 硬判据（「归因式判据」· 反事实归因实验）**：**「1440 档差异集必须 100% 归因于 T79 字号提升。验证法 = 反事实归因实验：只在测量期回退 T79 字号（不动仓库）⇒ 差异集必须为空（`仅基线有 = 0` 且 `仅归因有 = 0`）；且差异集中不得存在与字号无关的几何/布局差异。」**〔**v1.4 留痕 · 改前原文（v1.3「例外清单式」· 已作废）**：「1440 档逐元素 `getBoundingClientRect()` 相等，唯一允许的例外 = `T79` 字号提升所覆盖的元素，且例外集必须是当轮现取扫描的完整集（不得有未登记元素；发现任何额外元素 ⇒ 立缺陷）」—— 作废理由见 §13.1 `T77` 行〕〔**v1.3 就地更正留痕 · 改前原文（已作废）**：「1440 档同批控件 rect 须逐值等于现状（桌面档几何零变化）」〕 | 设备档可判（含 320/375/390 三档 + 1440 档**归因**复核；**1440 真实差异集结构见 §13.2.1 v1.4 复核**；**可复跑归因配方见本表「P2 归因实验配方」行**） |
| **P2 侧栏（★ v1.3 入册 · 缺陷 `D1` · 根因 + 修法）** | `≤767` 档**全部**消费 `--sf-j-/-k-/-l-ctl-h` 的控件（**不止主列**：须含侧栏 `.sf-layout-side` 子树）rect 宽高均 ≥44 | **缺陷**：Neng 复核发现 **6 个侧栏控件 37.5 < 44**。**根因**：`@media (max-width:767px)` 只把 `--sf-*-ctl-h` 覆盖挂在**主列根** `jobs.css:18-21 .sf-jobs` / `market.css:11-12 .sf-mkt` / `listings.css:17-18 .sf-listings` 上，而侧栏 `.sf-layout-side` 是**兄弟节点**（`shell.css:41-53`：`.sf-layout` > `.sf-layout-main` > `.sf-jobs` ‖ `.sf-layout` > `.sf-layout-side`）⇒ 自定义属性**不跨兄弟继承** ⇒ 侧栏子树 `var()` **取空** ⇒ `min-height` 失效（computed-value time 无效 ⇒ 计算值 `auto`）。**本册 v1.3 现取（390 档 · `/listing`）**：侧栏 `.sf-layout-side` 内 **5 控件**（`.sf-listings-input` ×2、`.sf-btn.sf-listings-btn` ×3「退款/发货/收货」）**均 37.5 高**、`min-height: auto`；同页主列同族 **≥44**（对照）；`getComputedStyle` 读数：`.sf-jobs` = `44px`（@390）/ `34px`（@1440），`.sf-layout-side` = **`""`（@两档）**。**修法**：≤767 的变量覆盖**必须挂到「包含全部消费者（主列 + 侧栏）的共同祖先」**（本例 = 页面根 `.sf-layout`），或改在**消费者自身容器**上分别定义；**不得只挂主列根**。**通用判据见 §13.6 `N25`**。**★ v1.4 已修复（Kong commit `ebca3ab`）**：修法落地 = ≤767 的变量覆盖**从「只挂主列根」扩到「主列根 + 主列与侧栏共同祖先 `.sf-layout`」**（`jobs.css`/`market.css`/`listings.css` 三个页面 CSS 同改；**`--sf-*-ctl-h` 桌面基准 34px 未动**）⇒ 修后 **390 档 6 个侧栏控件 37.5 → 44**；**消费者全扫 = 0**（**动态哨兵法**，非类名清单；`/listing`、`/exchange`、`/task/new`、`/task/1` **均 0** —— 见下行「P2 消费者全扫」）。**同根因第 4 面（★ v1.4 补）**：`/task/:id` 侧栏 `.sf-jobs-status`（`frontend/src/pages/jobs/JobDetailPage.jsx:322`）同属「变量挂主列根、侧栏为兄弟」⇒ **已随同一修法一并覆盖**（改后 **390 档 = 172×44**）。**新副作用（★ v1.4 登记 · 已知后果）**：`/listing` 侧栏 `.sf-listings-status` 高度由 **0 → 44px**（页面总高 **+114px**）—— 这是「**T77 的必然几何后果**」（原 `min-height` 取空 ⇒ 0 高；修后取到 44 ⇒ 恢复应有高度），**归入已知后果类**、非回归 | 设备档可判（原 `NOT_MEASURED` 部分已由 v1.4 全扫收口：**消费者全扫 = 0**） |
| **P2 消费者全扫（★ v1.3 补 · **★ v1.4 升级为「动态哨兵法」可复用判据**）** | —— | **`P2` 验收必须包含「所有消费该变量的消费者全扫，含侧栏兄弟节点」** —— 只扫主列（`.sf-jobs`/`.sf-mkt`/`.sf-listings` 子树）会**漏判** `D1` 类缺陷（变量挂主列根、侧栏是兄弟 ⇒ 侧栏永远吃不到）。**★ v1.4 方法升级（可复用判据 · 明确不用「类名清单」）**：**不得**靠手写「消费类名清单」判（会漏 —— 哪些选择器消费某变量会随 CSS 演进漂移，且 `D1` 缺陷本体恰在「清单扫不到处」）⇒ **改用「动态哨兵法」**：在运行期**遍历全 DOM**，对每个元素 ① 读 `getComputedStyle(el).getPropertyValue('--sf-…')` 核其**祖先链上变量是否真取到**（非空 = 到达）、② 读关键几何（`min-height`/`rect`）核**使用值是否符合预期下限**；凡「祖先链取空但子树预期 ≥44」者即命中。**v1.4 现取读数**：修 `D1` 后**动态哨兵全扫 = 0**（`/listing`、`/exchange`、`/task/new`、`/task/1` **均 0**） | 设备档可判（验收脚本须遍历「变量全部消费点」的 DOM 位置，而非只遍历主列；**通用教训见 §13.6 `N25`**） |
| **P2 归因实验配方（★ v1.4 新增 · 可复跑）** | —— | **反事实归因实验**（判 `T77` 是否引入「与字号无关的桌面几何差异」）：① 在 **1440** 视口对**父版**（改前）与**现版**（改后）分别读**全 DOM** 每元素 `getBoundingClientRect()` 建两张 rect 表；② 求**不对称差集**（`仅基线有` = 父版有、现版无；`仅归因有` = 现版有、父版无）；③ 在**测量期**（devtools 注入，**不动仓库**）**整体回退 4 处 T79 字号** —— `listings.css:130,140`（`.sf-listings-price-unit`/`.sf-listings-tag`）+ `jobs.css:201`（`.sf-jobs-tag`）+ `--sf-st-tab-font-size`（`theme-tokens.css:35`）—— 回退到父版值后**复读**；④ **判据**：`仅基线有 = 0` **且** `仅归因有 = 0` ⇒ 差异集**为空** ⇒ **100% 归因于 T79 字号提升**（PASS）；任一侧 >0 ⇒ 存在与字号无关的几何/布局差异 ⇒ **立缺陷**。**已知事实（★ v1.4 登记）**：1440 下 **`.sf-tabbar` 子树 23 元素为 `0×0`**（`display:none`）⇒ **不产生可见几何影响**（故它们出现在「差异集」内亦不算可见差异） | 设备档可判（本册 v1.4 已跑通：差异集归零、`仅基线有 = 0` 且 `仅归因有 = 0`） |
| **P3 断点** | `grep -n phonePortraitMax frontend/src/shell/breakpoints.js` ⇒ `767` | ① 源码读数 = 767（可复跑）；② 767 视口 `matchMedia('(max-width:767px)')===true` 且 tabbar `display:grid`，768 视口 `display:none`；③ **真源侧**：`grep -n '767px' docs/design/design-system.spec.md` 命中 §5.3 行 | 设备档可判 |
| **P4 字号** | 产品页可见文本 `font-size` ≥12px | TreeWalker 遍历文本节点读父 `font-size`；现取 390 档 `<12px` = **90 节点**（`.sf-tab-label` 10.5px × 36 + `/listing` 等 11px × 54）⇒ 改后必须 = **0**。真源侧 `grep -n '10.5px' docs/design/style-preview.html` 现取 = L128(未消费) + L170(已改 12px) ⇒ 应只剩 L128 | **显式留白**：L128 `.avatar.sm` 10.5px 不在产品页被测集内（不被 token 消费）⇒ 全站扫 `<12px` 若命中它，按 §13.6/N20 口径排除 |
| **100vh** | —— | **本轮不判**：设备档 `100vh == visualViewport.height`（`raw/experiments.json` `vh=844`、`vvh=844`）⇒ 陷阱不可观测 | **`NOT_MEASURED`**：待真机（地址栏收起） |

### 13.6 未核实 / 登记（诚实清单，承接 §11 的 N 序列）

- **N18**：`.sf-tabbar` 安全区**真机重叠像素**未测（设备档 `env()` 恒 0）⇒ P0 判据止步「源码已声明 + 未新增断点」。
- **N19**：顶栏「语言 / 主题 / 用户菜单」的**桌面控件**与**移动面板控件**逐项 rect **未落 report 表**（report 只把汉堡记为 40×40）⇒ §13.4 第 6/7 行标「派单口径 / 折叠态未测」者，Kong 实现后须由 Neng 现取补录。
- **N20**：`style-preview.html:128` `.avatar.sm` `font-size:10.5px` —— 比选稿**演示框内值**、**不被任何产品 token 消费**（`STRUCT`/`TOKEN_KEYS` 无 `avatar-sm` 字号键）⇒ 不属 P4「产品页可见文本」面，本轮**登记不改**（与 §5.3「演示框尺寸非产品 token」同族）。
- **N21**：`100vh` 真机（Safari/Chrome 地址栏）溢出行为 —— `NOT_MEASURED`，待新 LAN 预览服务的真机读数。
- **N22**：非中文档（`/en`、`/hk`、`/vn`）四语版式差异、登录态（`/profile` 正文、tabbar 第 5 格「我的」）未测 ⇒ 与 §11-N 同源登记。
- **N23**：本册 P0–P4 的**设备档**判据可复跑；**真机（实体手机）整体读数**仍为 `NOT_MEASURED`（无实体设备）——P2 的「≥44×44」在真机上的实际命中，须待真机复测。
- **N24**：**`T77` 收窄为「限 ≤767 档」后，各页 `*.css` 新增/包入的 767 媒体块数量未清点**（v1.2 硬约束只锁 `shell.css` 唯一 767 块；`styles.css`/`jobs.css`/`market.css`/`listings.css` 内新增 767 块属实现面）⇒ Kong 实现后须现取 `grep -c '@media (max-width: *767' frontend/src` 并登记；`p6-btn-impl2.test.js:138-155` 是否因「顶层 ctl-h 仍 34」而仍绿，亦待实现后现取（见 §13.3 第 14 行）。
- **N25（★ v1.3 · 可复用教训 · 承 `D1` · 「CSS 变量作用域 = DOM 子孙关系」）**：`@media (max-width:767px)` 只把 `--sf-*-ctl-h` 覆盖挂在**主列根** `.sf-jobs`（`jobs.css:18–21` + 767 块 `:213–215`）/ `.sf-mkt`（`market.css:11–12` + `:261–263`）/ `.sf-listings`（`listings.css:17–18` + `:265–267`）上，而侧栏是**兄弟节点**（`shell.css:35–53`：`.sf-layout` > `.sf-layout-main` > `.sf-jobs` ‖ `.sf-layout` > `.sf-layout-side`）。**教训（可复用 · 一条一句）**：**CSS 变量的作用域 = DOM 子孙关系，兄弟节点不吃** ⇒ 在 ≤767 下覆盖变量，**必须挂在「包含全部消费者的共同祖先」上**（不得只挂主列根）。**本册现取佐证（v1.3）**：390 档 `getComputedStyle(.sf-jobs).getPropertyValue('--sf-j-ctl-h')` = `44px`，同档 `getComputedStyle(.sf-layout-side)` = **`""`**；1440 档分别为 `34px` / **`""`**；`.sf-layout-side` 内控件 `min-height: auto` ⇒ **37.5**（`/listing` 侧栏 5 控件）。**副作用提醒**：同族变量在**桌面档**同样从未到达侧栏（`varOnSide=""` @1440）⇒ 侧栏 `min-height` 在**两档**都失效，属**存量**缺陷、非 `T77` 引入。**通用判据**：任何「在一个节点上定义/覆盖 CSS 变量」的改动，验收必须**枚举该变量的全部消费点并核其 DOM 祖先链**，不得只按「主列」抽样。**末段**：本条同时是 §13.2.1 「全站 1440 现取扫描完整集」与侧栏同族全扫的承接项。**★ v1.4（`D1` 已修复 · Kong commit `ebca3ab`）**：修法 = ≤767 变量覆盖**从「只挂主列根」扩到「主列与侧栏共同祖先 `.sf-layout`」** ⇒ **390 档侧栏 6 控件 37.5 → 44**；**消费者全扫 = 0**（**动态哨兵法**：遍历全 DOM 核「祖先链变量到达 + 几何下限」，**非类名清单**）；**同根因第 4 面** `/task/:id .sf-jobs-status`（`JobDetailPage.jsx:322`）一并覆盖（390 档 **172×44**）；**新副作用** `/listing .sf-listings-status` **0→44**（页高 **+114**）为 **T77 的必然几何后果**、归**已知后果类**。**可复用判据**：本条「枚举变量全部消费点并核 DOM 祖先链」在 v1.4 落为 **§13.5「P2 消费者全扫（动态哨兵法）」行**；本条可复现「设备档 390 档 `varOnSide=""`」的读数方法亦为该行配方之一。
- **N26（★ v1.4 · 承「归因式判据」）**：**反事实归因实验**已在**设备档 1440** 跑通（差异集归零、`仅基线有 = 0` 且 `仅归因有 = 0`），证 `T77` 的桌面几何差异**100% 归因于 `T79` 字号提升**、**无与字号无关的几何/布局差异**；**真机**上此结论仍为 `NOT_MEASURED`（承 `N23`；真机读数待新 LAN 预览服务）。配方见 §13.5「P2 归因实验配方」行；1440 差异集真实结构（`/listing` 243 = 48 直接 + 172 级联 + 23 未渲染；其余页各 23 = `.sf-tabbar` 子树 `0×0`）见 §13.2.1 v1.4 复核。
- **★ N26 就地收口（v1.13 · 原行一字未改）**：`N26` 登记的「**真机读数待新 LAN 预览服务**」**已解除阻塞并定案** —— 新 LAN 预览服务（真机入口 `http://<LAN-IP>:5800/<路径>`，见 `seafood-platform` 作业册「三个本地服务」表）**已在场**，且 `/_preview/colors` 诊断页（`docs/audit/h5-preview-colors-probe.md`）**已在真机取数**：手机（Xiaomi MiuiBrowser / Android 14 / Chrome 135）站内 `html[data-theme]=dark`、`.sf-shell` 背景 `rgb(11,12,14)`、`--sf-page-bg: #0B0C0E`、父页 `prefers-color-scheme` = `false`、**色卡 9/9 回读精确（含 `#FDE815 → rgb(253,232,21)`）** ⇒ 与 `F7` / `N31` 同族**一并从「待查」收口为「已定案」**（手机 = **本站夜档**（`localStorage theme=dark`，按 origin 隔离）+ **屏幕渲染忠实**；「浏览器强制深色」与「色域/屏幕」两假设排除）。**详见 §17.3**。（**诚实边界**：本行只收口 **配色 / 主题归因** 这一族；`N26` 的**真机几何归因实验**（`T79` 字号级联）为**另一条腿**，本轮未跑 = `NOT_MEASURED`，但**阻塞已解除**（新 LAN 预览服务在场）。）

---

## §14 底栏（H5）五项新集合 · 右侧悬浮菜单（仅桌面）· 三弹窗模板位（v1.5 · Kevin/Zang 2026-10-11 定档）

> **★ v1.6 补登（Zang 裁定⑦）**：**§14 的 i18n「值变更键」由 1 键（`shard`）改为 2 键（`shard` + `home`）** —— `home` 值 **`首页` ⇒ `海鲜市场`**（四语：zh「海鲜市场」/ en「Seafood Market」/ hk「海鮮市場」/ vn「Chợ hải sản」；见 §14.10 B / §14.0 / §14.5）。**值变更 = +0 键** ⇒ §14.10 计数（顶层 `119⇒128` / 拍平 `1050⇒1070` / 四语节点 `4200⇒4280`）**逐字不变**。**本册 v1.6 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。
> **★ v1.7 补登（Zang 裁定⑧⑨）**：**§14 新增两条裁定** —— **⑧ 底栏⑤文案键**：`profile` 键值不动、**新增键 `me`**、`frontend/src/shell/nav.js:21` 第五项 `labelKey` 改 `'me'`（见 §14.0 / §14.1 T80 补注 / §14.4 / §14.5 ★① / §14.10 A）；**⑨ 桌面正文右侧 gutter `140px`**（落 `frontend/src/styles.css` 的 `@media (min-width:1024px)`；`shell.css` 不新增 `@media`；`T85` 判据不降级；见 §14.0 / §14.1 T85 补注 / §14.2 / §14.5 ★② / §14.6 / §14.7 / §14.9(b)）。**计数（实取）**：顶层 `119⇒129` / 拍平 `1050⇒1071` / 四语节点 `4200⇒4284`。**本册 v1.7 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。
> **★ v1.8 补登（裁定⑩ + 归因第④类）**：**§14 新增两条裁定** —— **① 裁定⑩ · gutter 生效起点 `1024` ⇒ `768`**（与 `.sf-fm` 显示阈值 `>767` 同界；Kong 实测 **D4**：v1.7 的 `min-width:1024` 使 **`768–1023` 中间档**菜单可见、正文无留白 ⇒ 相交 ≈ **`49920 px²`**，违 `T85`）⇒ 落 `frontend/src/styles.css` 的 `@media (min-width:768px)`；**`shell.css` 仍不得新增 `@media`**；**`T85` 不降级**、**作用域 = 菜单可见的一切档**；**验收面 = 六档 × 三页 + 手机档零影响**（见 §14.0 / §14.1 / §14.2 / §14.5 / §14.6 / §14.7）。**② 归因式判据「允许变更集」 += 第④类「§14 已批准的 locale 值变更引起的文案/宽度面」**（承接 **D3**：桌面左 nav 第 3 项宽 `52↔80`，根因 = `shard` 值 `碎片市场→市场`；每页 5 条差异原无归属），**措词含可判负要求「须给算术语义闭合」**（见 §14.0 / §14.5 / §14.9(b)）。**本册 v1.8 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。
> **★ v1.9 补登（裁定⑪⑫⑬ + 登记项）**：**§14 新增三条裁定 + 一项登记** —— **⑪ 撤 gutter + 允许遮挡 + `T85` 重定义**（Kevin「不要窄 `140px`，恢复原来宽度；右侧悬浮栏可以遮挡其它内容」⇒ (a) 撤销 `styles.css` 的 `@media (min-width:768px){.sf-route-container{padding-right:140px}}`；(b) **`T85` 由「相交 = 0」重定义**为「**可见性（`≤767` 隐藏 / `≥768` 显示）+ 几何（宽 `72` / 单元高 `92` / 图标 `26` / 字号 `12` / 右边距 `16` / `top:45%`）+ 六档（`768`…`1920`）× 多页零横向溢出**；**遮挡 = 已知并接受项**（仅登记实测面积，**不得当 `FAIL`**）」；(c) 验收面**保留六档 × 三页、删去「相交 = 0」**；见 §14.0 裁定⑪ / §14.1 `T85` 行 / §14.2 / §14.5 / §14.6 #16 / §14.7 / §14.9(b)）· **⑫ `profile` 文案全站统一**（`profile` 四语值改 我的/Me/我的/Tôi；底栏⑤ `labelKey` 回 `profile`；**删 `me` 键**；计数回落 顶层 `128` / 拍平 `1070` / 四语节点 `4280`；`r9-84` 等断言需改锚；**取代上轮「一句话可改」**；见 §14.0 裁定⑫ / §14.5 / §14.6 #14/#15 / §14.10）· **⑬ 夜档三 token 收口**（`--sf-fm-*` 夜档推断值**已认可（2026-10-11）**；`N28`/`F8` 由「待裁」转「已认可」；见 §14.0 裁定⑬ / §14.2 / §14.8）· **登记项**（真机与本地 H5 配色差异 · 承 `N26`/`F7` · **待查** ⇒ `N31`；见 §14.8）。**本册 v1.9 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（撤 gutter / `profile` 值 / 删 `me` / `nav.js` `labelKey` 回 `profile` 由 Kong 落地）。
> **本节目性质（写死）**：① **只追加**（不改写 §0–§13 既有行；本册 v1.5 的改动 = 顶部现行版块 + §12 v1.5 行 + **本节（新）** + `docs/versions/design-system.spec.v1.4.md` 改前快照）；② **本册只冻结口径/判据**，不写实现（数值一律 `文件:行号 + 现取值`）；③ **真源** = `docs/design/style-preview.html` 追加区块（**行 983–1042**）；④ **本册 v1.5 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（由 Kong 落地）；⑤ 未实测项一律 `NOT_MEASURED` + 原因（§14.8）。

### 14.0 定档、连锁更正与真源

- **定档（Kevin 2026-10-11）**：① **方案 A（UI 先行，不动后端）** ② **右侧悬浮菜单仅桌面档（`>767`）显示、H5 隐藏** ③ **消息模块占位留空**（后续接驳 **X（推特）私信**）④ **客服/反馈暂做弹窗模板位**。
- **★ 当次连锁更正（Zang 转达 · 落册留痕）**：
  - **(A) 底栏第二项 = 「市场」→ `/exchange`**（key `shard`，图标 `Store`）；**「附近」/`/nearby` 整体移除**，**不新建占位页、`nearby` 键不新增**。
    > **留痕**：原写「`附近`→`/nearby`（key `nearby`，**新占位页**）」**已由 Kevin 当日变更取代**（本轮**不登记 `/nearby` 路由**；`route-layer.spec` v2.27 **只登记 `/messages` 一条新路由**）。
  - **(B) `T76` 去重口径按新底栏集合重算**（见 §14.4；**汉堡排除集 `['reward','task','exchange']` ⇒ `['exchange']`，`reward`/`task` 恢复**）。
- **★ Zang 裁定⑦（2026-10-11 · 本册 v1.6 补登 · 逐字采用）**：**底栏①文案 = Kevin 指定的「海鲜市场」**；实现 `SHELL_NAV_ITEMS[0].labelKey = 'home'` ⇒ 取 `t('home')`，**现值 = 「首页 / Home / 首頁 / Trang chủ」**（**已核：`t('home')` 在仓内唯一消费点 = `frontend/src/shell/nav.js:15`**）⇒ **不满足指定文案** ⇒ **`home` 键值变更为：zh「海鲜市场」/ en「Seafood Market」/ hk「海鮮市場」/ vn「Chợ hải sản」**（与 `siteTitle` 品牌口吻一致）。**值变更 = +0 键**（计数不变，见 §14.10 尾）。**留痕：原写 首页，已由 v1.6 按 Zang 裁定⑦ 与原值消费点唯一性（`nav.js:15`）更正**。（§14.5 ★ = nav 文案断言现取结论）
- **★ Zang 裁定⑧（2026-10-11 · 本册 v1.7 补登 · 逐字采用）**：**底栏（H5）第五格（`/profile`）文案 = Kevin 指定的「我的」**；实现 `SHELL_NAV_ITEMS[4].labelKey = 'profile'`（`frontend/src/shell/nav.js:21`）⇒ 取 `t('profile')`，**现值 = 「个人资料 / Profile / 個人資料 / Hồ sơ」**（**已核：`t('profile')` 在仓内共 3 个消费点 = `frontend/src/shell/nav.js:21`〔底栏⑤〕· `frontend/src/components/Header.jsx:284`〔桌面下拉〕· `frontend/src/components/Header.jsx:460`〔移动面板〕**）⇒ **不满足指定文案**。**裁定**：**`profile` 键值一律不动**（四语保持 个人资料/Profile/個人資料/Hồ sơ），**新增键 `me`**（zh「我的」/ en「Me」/ hk「我的」/ vn「Tôi」），**`nav.js:21` 第五项 `labelKey` 由 `'profile'` 改 `'me'`**（**`key: 'profile'` / `path: 'profile'` / `requiresAuth: true` 逐字不动**）。**理由**：`t('profile')` 的两个非底栏消费点（`Header.jsx:284`/`:460`）与 **`r9-84-profile-entry.test.jsx`（锚定「个人资料」，`:135`/`:226` = `toContain(zh.profile)`）** 都消费 `profile` 值 ⇒ 若改 `profile` 值将**牵连桌面下拉 / 移动面板 / 该测试**（**面外变更**）⇒ 以**新增键**承接。**「一句话可改」（标 Kevin 可选）**：若 Kevin 要**全站统一为「我的」**，则**改 `profile` 值**（四语 ⇒ 我的/Me/我的/Tôi）**并**改锚 `r9-84-profile-entry.test.jsx:135/:226`（`toContain(zh.profile)`）—— 此为**唯一**需动 `profile` 的场景。**值/结构变更 = +1 新键**（计数见 §14.10 尾）。
- **★ Zang 裁定⑨（2026-10-11 · 本册 v1.7 补登 · 逐字采用）**：**1440 档右侧悬浮菜单（`.sf-fm`）与正文卡片重叠** —— **Kong 实测**：1440 档**正文全幅**（首页卡片右缘至 `x = 1388`），而**悬浮菜单占 `x ∈ [1316, 1424]`**（`right:16` + 容器宽 `108`）⇒ **相交面积 ≈ 4.6 万 px²**，**违 `T85`「悬浮菜单边界盒与正文卡片 `getBoundingClientRect()` 相交面积 = 0」硬判据**。**裁定**：**桌面档给正文预留右侧 gutter（宽 `140px` = 菜单 `right:16` + 宽 `108` + 余量 `16`）**，使正文右缘与菜单左缘相隔 `≥16px`（1440 档：正文右缘 ≤ `1300px`、菜单左缘 `1316px`）；**gutter 规则落 `frontend/src/styles.css` 的 `@media (min-width:1024px)`**；**不得在 `frontend/src/shell/shell.css` 新增 `@media` 块**（`theme-shell-isomorphism.test.jsx:215–229` 要求 `shell.css` 仍**只有 1 个 767 块**；现取 `grep -c '@media' frontend/src/shell/shell.css` = `1`，唯一块 = L179 `@media (max-width: 767px)`）⇒ **≤767 零影响**（767 及以下不落入 `min-width:1024`）。**`T85` 判据不降级**（「相交 = 0」逐字不变；gutter 只是**实现取向**，不是判据放宽）。**必须交**：**1440 / 1600 / 1920 三档相交 = 0** 与 **三档 `scrollWidth == clientWidth`**（见 §14.7 新增判负行）。**归因式判据「允许变更集」 += 「gutter 引起的容器/内容宽度变化面」**（见 §14.9(b)）。
- **★ Zang 裁定⑩（2026-10-11 · 本册 v1.8 补登 · 逐字采用）**：**gutter 生效起点由 `1024px` 改 `768px`**。**依据（Kong 实测 · D4 真缺陷）**：v1.7 的 gutter 只写在 `frontend/src/styles.css` 的 `@media (min-width:1024px)` 块内，而 `.sf-fm` 的**隐藏阈值 = `≤767`**（`frontend/src/shell/shell.css` 唯一 767 块内 `.sf-fm{display:none}`）⇒ **`768–1023` 中间档「悬浮菜单可见、正文无留白」** ⇒ 悬浮菜单边界盒与正文卡片 `getBoundingClientRect()` **相交 ≈ `49920 px²`**，**违 `T85`「相交面积 = 0」硬判据**（**判据本身正确，缺陷在实现漏档**）。**裁定**：① **gutter 生效起点 = `768px`**（与 `.sf-fm` 显示阈值 `>767` **同界**）；落 `frontend/src/styles.css` 的 `@media (min-width:768px)`；**`frontend/src/shell/shell.css` 仍不得新增 `@media` 块**（`theme-shell-isomorphism.test.jsx:215–229` 要求其仍**只有 1 个 767 块**；现取 `grep -c '@media' frontend/src/shell/shell.css` = `1`）。② **`T85`（相交 = 0）判据不降级**（「相交面积 = 0」逐字不变；gutter 只是**实现取向**，不是判据放宽），**作用域 = 菜单可见的一切宽度档**（`>767` 全档，不再限于 `≥1024`）。③ **验收面扩为六档 × 三页**：**`768` / `1024` / `1280` / `1440` / `1600` / `1920` 六档 × `/`、`/listing`、`/exchange` 三页**，逐档逐页 `T85` 相交 = `0` 且 `scrollWidth == clientWidth`；**手机档（`390`/`375`/`320`）零影响**（三档均不落入 `min-width:768`；且 `.sf-fm` 在该三档 `display:none`）。**留痕**：v1.7 原文（gutter 起点 = `@media (min-width:1024px)`、适用档 = 「桌面档」、验收面 = 「1440/1600/1920 三档」）**逐字保留于 §14.2 / §14.6 第 16 行 / §14.7**，**本行为现行版**。
- **★ 归因第④类（2026-10-11 · 本册 v1.8 补登 · 逐字采用）**：**「归因式判据」的「允许变更集」由三类扩为四类** —— **第④类 = 「§14 已批准的结构/文案值变更（locale 值变更）引起的文案/宽度面」**（与前三个允许面并列：① `T79` 字号提升的级联；② 新增 `.sf-fm` 子树；③ gutter 引起的容器/内容宽度变化面）。**依据（Kong 实测 · D3 判据漏洞）**：归因差异里**每页 5 条**归不进既有三类允许集 —— 具体 = **桌面左 nav 第 3 项宽度 `52 ↔ 80`**，**根因 = `shard` 键值变更 `碎片市场 → 市场`**（§14.0 连锁更正 (A) / §14.10 B，**§14 已批准的值变更**）⇒ 文案变短 ⇒ 该 nav 项**宽度变化**。**该类差异属合法实现后果、非缺陷**，但**原判据未列** ⇒ 必须补入允许变更集（否则每轮归因实验都会把「已批准的值变更」误判为「与字号/新组件/gutter 均无关的几何差异」）。**措词（含可判负要求）**：第④类差异**除「根因可追溯到 §14 已批准的 locale 值变更」外，须给「算术语义闭合」** —— **字串长度变化 → 宽度变化方向与量级一致**：即 **`newWidth − oldWidth` 的符号 = `(len(newLabel) − len(oldLabel))` 的符号**（值变更**缩短**文案 ⇒ 宽度**只减不增**；**变长** ⇒ **只增不减**），且宽度变化量级须与该字号下文本宽度估算**同阶**（**不得出现「文案缩短而宽度增大」或「文案长度不变而宽度显著变化」**）。**判负**：若第④类差异**无法给出算术语义闭合**（方向相反 / 量级背离 / 根因指不到任何 §14 已批准值变更）⇒ **立缺陷**（不得以「属第④类」豁免）。**留痕**：v1.5（三类）/ v1.7（三类 + gutter，实为「三允许面」）措词**逐字保留于 §14.9(b) 既有行**；**本行为其就地更新，以本行为现行版**。
- **★ Zang 裁定⑪（2026-10-11 · 本册 v1.9 补登 · 逐字采用）**：**撤 gutter + 允许遮挡 + `T85` 重定义**。**依据（Kevin 2026-10-11 明言）**：「**不要窄 `140px`，恢复原来宽度；右侧悬浮栏可以遮挡其它内容**」。**裁定**：**① 撤销 gutter** —— **删除** `frontend/src/styles.css` 的 `@media (min-width:768px){.sf-route-container{padding-right:140px}}`（**实现侧 Kong 做**；连同其上方注释块一并撤除；**`frontend/src/shell/shell.css` 仍不得新增 `@media`**）；⇒ 正文恢复原来宽度（不再预留 `140px` 右 gutter）。**② `T85` 由「相交 = 0」重定义为**：「**悬浮菜单的可见性（`≤767` 隐藏 / `≥768` 显示）、几何（宽 `72` / 单元高 `92` / 图标 `26` / 字号 `12` / 右边距 `16` / `top:45%`）与六档（`768`…`1920`）× 多页零横向溢出**；**遮挡为已知并接受项**（**仅需登记实测面积，不得当 `FAIL`**）」。**③ 各档验收面保留六档 × 三页**（`768`/`1024`/`1280`/`1440`/`1600`/`1920` × `/`、`/listing`、`/exchange`），**删去「相交 = 0」这一条**；「遮挡面积」由**判据**降为**登记项**（Kong/Neng 现取各档实测面积入证据包即可，**不得据此判负**）。**本裁定推翻 v1.7 / v1.8 关于 gutter、`T85` 作用域与验收面的口径** —— 旧措词**逐字保留为改前原文 + 标「已被 v1.9 取代」留痕**（v1.7 裁定⑨ / v1.8 裁定⑩ 全文见下方两条块，**原文一字未修饰**；**尤其中间档 `D4` 与反相复现 `49920` 两段叙述**）。
- **★ Zang 裁定⑫（2026-10-11 · 本册 v1.9 补登 · 逐字采用）**：**`profile` 文案全站统一**（Kevin 同意）。**裁定**：**① `profile` 键四语值改** —— zh「我的」/ en「Me」/ hk「我的」/ vn「Tôi」（**原值 = 个人资料 / Profile / 個人資料 / Hồ sơ**，见 §14.10 B 留痕）。**② 底栏第 5 项 `labelKey` 回 `profile`** —— `frontend/src/shell/nav.js` 第五项 `labelKey: 'me'` ⇒ **`'profile'`**（**`key: 'profile'` / `path: 'profile'` / `requiresAuth: true` 逐字不动**）。**③ 删除上一轮（v1.7 裁定⑧）新增的 `me` 键** —— 四语 locale 删 `me`（避免 `me` 与 `profile` 两键同义）⇒ **键计数回落**为**顶层 `128` / 拍平 `1070` / 四语节点 `4280`**（**本册现取核验 2026-10-11**：上轮 v1.8 基线现盘 = `129`/`1071`/`4284`（含 `me`，4×`1071`）；**本册 v1.9 现取**（Kong 同轮已落地裁定⑫：四语删 `me`、`profile` 值已改）= **`128`/`1070`/`4280`**（4×`1070`；四语逐文件相同）；见 §14.10 尾）。**④ 断言改锚（Kong 执行）**：**`r9-84-profile-entry.test.jsx` 等锤「个人资料」文案的断言需改锚**（该文件 `:114`/`:135`/`:210`/`:211`/`:226` 等以 `zh.profile` / `zh` 字面参与断言；`profile` 键值由「个人资料」变「我的」后须由 Kong **现取并改锚**）；另 `v15-nav-floatmenu.test.jsx`（`:89` `fifth.labelKey` / `:91-98` `me` 四语断言 / `:113` 第五格 `TABLES[lang].me`）须**回改 `profile`**（见 §14.5）。**现取（2026-10-11）：Kong 同轮已落地改锚**（见 §14.5 ★ v1.9 现取）。**⑤ 取代关系**：**本裁定取代上一轮（v1.7 裁定⑧）标注的「一句话可改」选项** —— 即 v1.7 提出的「若 Kevin 要全站统一为『我的』，则改 `profile` 值 + 改锚 r9-84」路径**即为本裁定所采**（「一句话可改」的字面**保留于 §14.0 裁定⑧ / §14.5 ★① / §14.10 A 留痕**，**已被本裁定取代**）。
- **★ Zang 裁定⑬（2026-10-11 · 本册 v1.9 补登 · 逐字采用）**：**夜档三 token 收口**。**依据**：Kevin 回复「**目前看没问题**」。**裁定**：`--sf-fm-bg` / `--sf-fm-fg` / `--sf-fm-divider` 的**夜档推断值**（`#141619` / `#EDEFF2` / `#262A30`，见 §14.2）**经人类认可** ⇒ **`N28`/`F8` 标「已认可（2026-10-11）」**（由「待裁 / 一句话可改」转为**已认可**）。**留痕纪律**：**不得改写历史行**（`N28` 原文 / §14.2「夜（推断）」列 / §14.2 诚实边界**逐字保留**），**只追加 / 就地留痕**（见 §14.2 ★ v1.9 补注 / §14.8 `N28`）。
- **★ 登记项 · 真机与本地 H5 配色差异（2026-10-11 · 本册 v1.9 补登 · 待查）**：承 **`N26`/`F7`**（真机挂账线）**登记为待查** —— **真机（实体手机）呈现的配色与本地 H5（浏览器/设备档）存在差异**，**归因未定**。**三假设**（待逐项排除）：**① 主题档状态**（真机 localStorage/系统偏好 ⇒ 落 `light`/`dark` 与本地不一致）；**② 广色域色彩管理**（`Display P3` 等宽色域下的色彩管理 / 色域映射差异）；**③ iframe vs 独立视口渲染**（H5 在 iframe 内 vs 独立视口下的渲染差异）。**旁证（现取）**：**本仓样式/主题层无 `oklch`/`color-mix` 声明** —— `frontend/src/theme/**` 与 `frontend/src/shell/shell.css` **0 命中**；`frontend/src/styles.css` 命中 **5 行**、**全为注释**（说明 Tailwind v4 默认调色板曾用 `oklch`、本仓已显式覆盖为 `hex`）。⇒ 见 **§14.8 `N31`**。
- **★ v1.13 收口（就地注 · 原行一字未改）**：本登记项（真机与本地 H5 配色差异）**已定案**（不再「待查」）—— **手机真机实测**：站内 `html[data-theme]=dark`、`.sf-shell` 背景 `rgb(11,12,14)`、`--sf-page-bg: #0B0C0E`、父页 `prefers-color-scheme` = `false`、色卡 9/9 回读精确 ⇒ **手机上是本站夜档（`localStorage theme=dark`，按 origin 隔离）+ 屏幕渲染忠实**；**三假设结论** = ①「主题档状态」**成立且已定性**（= 本站自身夜档，非渲染差异）/ ①′「浏览器强制深色（UA forced dark）」**排除** / ②「广色域色彩管理（P3）/ 屏幕」**排除** / ③「iframe vs 独立视口渲染」**排除**（与 iframe 无关，见 `N38`）。**证据 = `/_preview/colors` 诊断页实测**（`docs/audit/h5-preview-colors-probe.md`）。详见 **§17.3**。
- **真源**：`docs/design/style-preview.html` 追加区块（**行 983–1042**；**纯追加**；三读数见 §14.9）。

### 14.1 规则条文（T80–T86）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T80** | 【本册裁定】**底栏（H5）恒 5 格**（`T46` 不破；**主题切换入口不得占底栏格**），**左→右**：`海鲜市场`→`/`（key `home`）· **`市场`→`/exchange`**（key `shard`，**复用既有积分交易所/碎片市场页**）· `卖闲置`→`/listing/new`（key `sell`，**复用既有发布页**）· `消息`→`/messages`（key `messages`，**新占位页**）· `我的`→`/profile`（key `profile`，`requiresAuth`）。**图标（lucide-react，仓内既有）**：`Home` / `Store` / `PlusCircle` / `MessageCircle` / `User`。**单一真源 = `frontend/src/shell/nav.js`（由 Kong 改）**。 | `frontend/src/shell/nav.js`（`SHELL_NAV_ITEMS` L14–20）· `frontend/src/shell/BottomTabBar.jsx` | 改 nav 集合 ⇒ 挂 `theme-shell-isomorphism.test.jsx`（`:88/:106/:107/:91–103/:130–144/:146–153`）+ `route-exchange-rename.test.jsx`（`:86–89/:103`）（见 §14.5） |
| **T80**〔**2026-10-24 取代注**〕 | 【本册裁定】**底栏（H5）恒 4 格**（`T46` 取代注 / `T123` 不破；**主题切换入口不得占底栏格**），**左→右**：`海鲜市场`→`/`（key `home`）· **`市场`→`/exchange`**（key `shard`，**复用既有积分交易所/碎片市场页**）· `消息`→`/messages`（key `messages`）· `我的`→`/profile`（key `profile`）。**图标（lucide-react，仓内既有）**：`Home` / `Store` / `MessageCircle` / `User`（**`PlusCircle` 随【卖闲置】移出底栏，仍由桌面浮菜单 `FM_ITEMS.sell` 消费，未删**）。**同一表上一行的旧句「底栏（H5）恒 5 格」+ 五项 key 清单 + 五项图标清单已被 2026-10-24 裁定取代、旧字面逐字保留** —— 其中「`卖闲置`→`/listing/new`（key `sell`）」**不在底栏**（**路由 `/item/new` 保留、可直链**；旧写 `/listing/new` 亦为该路由历史名）。**单一真源 = `frontend/src/shell/nav.js`（`SHELL_NAV_ITEMS` 现取 4 项）**。 | `frontend/src/shell/nav.js`（`SHELL_NAV_ITEMS` 现取 4 项，L32–37）· `frontend/src/shell/BottomTabBar.jsx` · `frontend/src/shell/FloatingMenu.jsx`（`FM_ITEMS` 五项，**未改**） | 改 nav 集合 ⇒ 挂 `theme-shell-isomorphism.test.jsx` + `route-exchange-rename.test.jsx` + `v15-nav-floatmenu.test.jsx`（`:84–94` nav 真源四项 / `:122` 底栏不含 `sell` / `:145–147` 浮菜单仍五项含 `sell`；见 §27.6） |
| **T81** | 【本册裁定】**右侧悬浮菜单仅桌面档（`>767`）显示**；**`≤767` 必须 `display:none`**。五项**上→下**：`卖闲置`→`/listing/new` · `消息`→`/messages` · `APP`→**弹窗** · `反馈`→**弹窗** · `客服`→**弹窗**。**图标（lucide）**：`PlusCircle` / `MessageCircle` / `Smartphone` / `Gauge` / `Headphones`。**可见性只由 CSS 断点承担**（复用唯一 767 块；**不得新增 `@media`**；**不得用 JS `matchMedia`/`innerWidth`**）。 | `frontend/src/shell/FloatingMenu.jsx`（建议路径）· `frontend/src/shell/shell.css`（唯一 767 块内加 `.sf-fm{display:none}`；桌面默认显示） | 新增 `@media` 块 ⇒ 挂 `theme-shell-isomorphism.test.jsx:215–229`（断 `shell.css` 只有 1 个断点块）；JS 内联断点 ⇒ 挂同文件 `:205–213` |
| **T82** | 【本册裁定】**悬浮菜单形态 = 结构常量/几何**（**两档同值、不进主题差集**，与 `T10①`/`T29` 自洽）：**容器宽 `108px`** · **单元高 `92px`** · **胶囊圆角 = 容器宽/2 = `54px`** · **图标 `26px`** · **文字 `12px`** · **图标与文字间距 `6px`** · **单元间 `1px` 浅灰分隔线（宽 `48px`）** · **右边距 `16px`** · **垂直定位 `top:45%` + `translateY(-50%)`** · **阴影 `0 6px 18px rgba(0,0,0,.07)`**。来源 = Kevin 参考图等比缩放到桌面。 | `FloatingMenu.jsx` / `shell.css` | 几何两档同值 ⇒ **不破 `T69`**；**这些值不进 token 层**（不是可切换值） |
| **T83** | 【本册裁定】**悬浮菜单色值走主题 token**（日/夜两档，**不得用固定白**）：**新 token `--sf-fm-bg` / `--sf-fm-fg` / `--sf-fm-divider`**；**日档（按参考图）** `#FFFFFF` / `#333333` / `#E8E8E8`；**夜档（标「推断」，参考图未展示）** `#141619` / `#EDEFF2` / `#262A30`（**值 = 本仓夜档既有面板/卡片值**：`--sf-panel-bg`/`--sf-card-bg` · `--sf-panel-h4-fg`/`--sf-title-fg` · `--sf-panel-border`/`--sf-hr-bg`）。**新 token 必须能在 `docs/design/style-preview.html` 回读到**（追加区块行 983–1042）。 | `frontend/src/theme/tokens.js`（`TOKEN_KEYS`）· `frontend/src/theme/theme-tokens.css`（`:root` / `[data-theme="dark"]`）· `style-preview.html` 追加区块 | 「主题块只声明 token 变量且键名落在 `TOKEN_KEYS` 内」⇒ 挂 `theme-shell-isomorphism.test.jsx:238–259`（新 token 必须入 `TOKEN_KEYS`，否则 `未登记 token` 判负） |
| **T84** | 【本册裁定】**三个弹窗复用既有 `Modal` 组件**（`frontend/src/components/ui/Modal.jsx`）；**内容 = 模板位**：**APP** = 二维码/下载引导占位；**反馈** = 表单占位（**不落库**）；**客服** = 联系方式占位。**弹窗默认不渲染**（按需挂载 ⇒ 两主题 DOM 形状同值）。 | `FloatingMenu.jsx` + `Modal.jsx` | 弹窗若默认渲染 ⇒ 破 `theme-shell-isomorphism.test.jsx:167–187`（日/夜形状恒等）+ `:77–81`（区域顺序） |
| **T85** | 【本册裁定】在 **1440 档**，悬浮菜单**不得与正文卡片重叠遮挡**：悬浮菜单边界盒与页面内所有正文卡片（`[data-sf-m="listing-card"]`、`.sf-card`/`.sf-listings-card` 等）的 `getBoundingClientRect()` **相交面积 = 0**（判负判据见 §14.7）。**实现取向** = 定位于正文右缘留白（`--sea-content-max` `1440px` 之外的右缘，右边距 `16px`）。 | `FloatingMenu.jsx` / `shell.css` | 相交 > 0 ⇒ 判负 |
| **T86** | 【本册裁定】**`T76`（汉堡去重）口径按新底栏集合重算**（**取代 v1.1 `T76` 的排除集**）：**移动端汉堡面板渲染项 = 顶栏项集 − 底栏目标集**；**本版底栏目标集 = `/`、`/exchange`、`/listing/new`、`/messages`、`/profile`** ⇒ 汉堡**排除 `exchange`**、**恢复 `reward`/`task`**（`/reward`、`/task` 已不在底栏，去重理由消失；**若不恢复 ⇒ 移动端失去「奖励」「任务」两个入口 = 功能回归**）。**桌面左 nav（奖励/任务/市场）一字不动**。 | `frontend/src/components/Header.jsx`（`MOBILE_PANEL_EXCLUDED_PATHS` **L17** + 面板过滤 **L346**）· `menuItems`（**L123**）**不动** | 改共享 `menuItems` ⇒ 连带桌面 nav ⇒ 挂 `theme-shell-isomorphism.test.jsx:91–103`；只改面板过滤 ⇒ 桌面断言全绿 |

> **T76 留痕（v1.1 原文 · 一字未改 · 已被 `T86` 取代）**：
> 【本册裁定·P1】移动档顶部汉堡面板**不得包含底部 tab 已有的目标**（底部 tab = `/`、`/reward`、`/task`、`/exchange`；其中 `home` 由 Logo 承担）⇒ 面板内去 **`/reward`、`/task`、`/exchange`** 三项 ⇒ 实现排除集 = `['reward','task','exchange']`。
> **取代理由（`T86`）**：**底栏集合已由本版变更**（`reward`/`task` 移出底栏；`/listing/new`、`/messages`、`/profile` 移入）⇒ 原排除集 `['reward','task','exchange']` 的**依据已不成立** ⇒ 新排除集 = `['exchange']`。**旧行一字未删。**

> **★ v1.7 补注（Zang 裁定⑧⑨ · 修订 `T80` / `T85` 两行 · 原文逐字保留）**：
> - **修订 `T80`（裁定⑧）**：`T80` 第五项原文「`我的`→`/profile`（key `profile`，`requiresAuth`）」**逐字保留**；**本行就地补充**：底栏⑤文案改取 **新增 `labelKey: 'me'`**（zh「我的」/ en「Me」/ hk「我的」/ vn「Tôi」），**`key` 仍 `profile`、`path` 仍 `profile`、`requiresAuth` 仍 `true`**（`frontend/src/shell/nav.js:21`，现取 `labelKey:'profile'` ⇒ 改 `'me'`）。即 **`T80` 的 route 面 / 可见性面 / 图标面逐字不变，仅第五格 `labelKey` 换键**（`t('profile')` ⇒ `t('me')`）。
> - **修订 `T85`（裁定⑨）**：`T85` 原文「相交面积 = 0」**判据逐字不动、不降级**；**实现取向**由「定位于正文右缘留白（`--sea-content-max` `1440px` 之外的右缘）」**就地细化**为 **「桌面档正文预留右侧 gutter `140px`（落 `frontend/src/styles.css` 的 `@media (min-width:1024px)`；`shell.css` 不新增 `@media`；`≤767` 零影响）」**（几何口径见 §14.2）。
> - **★ v1.8 就地更正（裁定⑩ · 修订 `T85` 的 gutter 起点）**：上条修订中「`@media (min-width:1024px)`」**逐字保留、已作废**；**现行版 = gutter 生效起点 `768px`**（与 `.sf-fm` 隐藏阈值 `≤767` 同界 ⇒ `>767` 全档留白）。**`T85`「相交面积 = 0」判据逐字不动、不降级**，**作用域明确为「菜单可见的一切宽度档」**（`>767`，含 `768–1023` 中间档，不再限于 `≥1024`）；**验收面 = 六档 × 三页**（`768`/`1024`/`1280`/`1440`/`1600`/`1920` × `/`、`/listing`、`/exchange`）+ **手机档（`390`/`375`/`320`）零影响**。**依据 = D4**（v1.7 的 `min-width:1024` 使 `768–1023` 中间档菜单可见而正文无留白 ⇒ 相交 ≈ `49920 px²`，违 `T85`）。见 §14.0 裁定⑩ / §14.2 / §14.6 第 16 行 / §14.7 判负行。

> **★ v1.9 重定义（裁定⑪ · 重定义 `T85` · 原文逐字保留、标「已被 v1.9 取代」）**：
> **`T85`（现行版）** ＝【本册裁定】**悬浮菜单的可见性（`≤767` 隐藏 / `≥768` 显示）、几何（宽 `72` / 单元高 `92` / 图标 `26` / 字号 `12` / 右边距 `16` / `top:45%`）与六档（`768`…`1920`）× 多页零横向溢出**；**遮挡为已知并接受项**（**仅需登记实测面积，不得当 `FAIL`**）。
> **改动面**：**① 删去「悬浮菜单边界盒 ∩ 正文卡片 rect 相交面积 = 0」这一判据**（v1.5 原文的「相交 = 0」硬判据**已被 v1.9 取代**）；**② 删去各档验收面中「相交 = 0」这一条**；**③ 保留可见性（`≤767` 隐藏 / `≥768` 显示）、几何六值、六档 × 三页零横向溢出**；**④ 遮挡面积由「判据」降为「登记项」**（Kong/Neng 现取各档实测面积入证据包，**不得据此判负**）。
> **留痕（改前原文 · 逐字保留 · 已被 v1.9 取代）**：`T85` 行（上表）原文 =「在 **1440 档**，悬浮菜单**不得与正文卡片重叠遮挡**：悬浮菜单边界盒与页面内所有正文卡片（`[data-sf-m=\"listing-card\"]`、`.sf-card`/`.sf-listings-card` 等）的 `getBoundingClientRect()` **相交面积 = 0**（判负判据见 §14.7）。**实现取向** = 定位于正文右缘留白（`--sea-content-max` `1440px` 之外的右缘，右边距 `16px`）。」—— **一字未改**（本行只标取代、不改上表）。
> **几何说明（经手·非修饰）**：本行 `T85` 的几何六值（含**宽 `72`**）= **Kevin 2026-10-11 裁定逐字**；§14.2「几何（结构常量）」表内历史值（含 `108px`）**未改写、留痕**。

> **★ 勘误注（2026-10-19 · 媒体上传单批连带 · `T80` requiresAuth 废除 / 恒 5 格含未登录 · 旧字面逐字保留、以本注为准）**：**`T80` 行原文第五项「`我的`→`/profile`（key `profile`，`requiresAuth`）」与 v1.7 补注「`requiresAuth` 仍 `true`」的可见性语义自本注起作废** —— `requiresAuth` 字段随缺陷单 `9c8a460` **废除**（`shell/nav.js` 删 `visibleNavItems` + 去 profile 项 `requiresAuth`；`BottomTabBar` **恒染 `SHELL_NAV_ITEMS`**）。**现行口径（可判负）** = **底栏恒 5 格、含未登录**：游客态 5 格齐（含【我的】），点【我的】走既有钱包签名登录引导；1440 档 `display:none` 与详情页 `is-detail` 隐藏面**不变**；三测试已改锚 = `theme-shell-isomorphism` / `route-exchange-rename` / `v15-nav-floatmenu:92`（`fifth.requiresAuth` ⇒ `fifth.key==='profile'`）。**底栏①文案微单（进行中）**：`home` 键值四语改短（海鲜 / 海鮮 / Seafood / Hải sản，键数不变，消费点唯一 = `frontend/src/shell/nav.js:20`）。质检 = `ops/batch-1019-2/qa/verdict.json` 8/8 PASS（`AC1` 游客态 5 格含 profile / `AC2` 生产码零引用）。

### 14.2 悬浮菜单几何与色值（逐值表）

**几何（结构常量 · 两档同值 · 不进主题差集）**

| 项 | 值 | 备注 |
|---|---|---|
| 容器宽 | `108px` | 参考图等比缩放 |
| 单元高 | `92px` | 5 单元 |
| 胶囊圆角 | `54px`（= 容器宽 ÷ 2） | 定式：圆角 = 容器宽/2 |
| 图标尺寸 | `26px` | lucide |
| 文字字号 | `12px` | 与 `T79`（全站 ≥12px）一致 |
| 图标-文字间距 | `6px` | — |
| 单元间分隔线 | `1px` 浅灰，宽 `48px` | 居中 |
| 右边距 | `16px` | 贴右缘 |
| 垂直定位 | `top:45%` + `translateY(-50%)` | 视口纵向居中略偏上 |
| 阴影 | `0 6px 18px rgba(0,0,0,.07)` | 固定值（不进主题差集） |

**色值 token（日/夜两档）**

| token | 日（参考图） | 夜（推断） | 取值依据（真源 = `frontend/src/theme/theme-tokens.css` 夜档块 L159+） |
|---|---|---|---|
| `--sf-fm-bg` | `#FFFFFF` | `#141619` | 夜档 = `--sf-panel-bg` / `--sf-card-bg`（`theme-tokens.css:225/189`） |
| `--sf-fm-fg` | `#333333` | `#EDEFF2` | 夜档 = `--sf-panel-h4-fg` / `--sf-title-fg`（`theme-tokens.css:229/198`） |
| `--sf-fm-divider` | `#E8E8E8` | `#262A30` | 夜档 = `--sf-panel-border` / `--sf-hr-bg`（`theme-tokens.css:226/231`） |

> **诚实边界**：日档三值 = 参考图实测；**夜档三值 = 「推断」**（参考图未展示夜间）—— 取本仓夜档**既有**面板/卡片值，**未发明新色**。**回读**：三 token 已写入 `style-preview.html` 追加区块（行 983–1042）。

**桌面正文右侧 gutter（★ v1.7 · 裁定⑨ · 结构常量 · 落 `frontend/src/styles.css`）**

| 项 | 值 | 说明 |
|---|---|---|
| gutter 宽 | `140px` | = 菜单 `right:16` + 容器宽 `108` + 余量 `16` |
| 适用档 | **`>767`（菜单可见的一切宽度档）** —— `@media (min-width:768px)`〔**★ v1.8 就地更正（裁定⑩）**：改前原文 = 「桌面档（`@media (min-width:1024px)`）」，**逐字留痕、已作废**〕 | **落 `frontend/src/styles.css`**；**不得落 `frontend/src/shell/shell.css`**（后者仍只 1 个 767 块，见 §14.6 第 16 行） |
| `≤767` | **零影响** | 767 及以下不落入 `min-width:768`；`.sf-fm` 在该档 `display:none` |
| 与菜单/正文关系（1440 档） | 正文右缘 ≤ `1440−140 = 1300px`；菜单左缘 = `1440−124 = 1316px` | 间距 `≥16px` |
| 硬判据 | **六档（`768`/`1024`/`1280`/`1440`/`1600`/`1920`）× 三页（`/`、`/listing`、`/exchange`）`.sf-fm` ∩ 正文卡片 = `0`** **且** 逐档逐页 `scrollWidth == clientWidth`；**手机档（`390`/`375`/`320`）零影响** | `T85` **不降级**（见 §14.7）〔**★ v1.8 就地更正（裁定⑩）**：改前原文 = 「**1440 / 1600 / 1920 三档** `.sf-fm` ∩ 正文卡片 = `0` 且三档 `scrollWidth == clientWidth`」**逐字留痕、已作废**〕 |

> **诚实边界**：以上为**几何口径**；`styles.css` 的具体 CSS 形态（`padding-right` / 内容 `max-width` 收窄 / 容器 `padding`）由 Kong 按此口径实现 —— **本册只冻结「桌面档预留 `140px` 右 gutter」与三档判据**。
> **★ v1.8 补注（裁定⑩）**：上条「**桌面档**预留 `140px` 右 gutter」**就地更正为「`>767`（菜单可见的一切档）预留 `140px` 右 gutter」**（起点 `1024` ⇒ `768`）；「**三档判据**」**就地更正为「六档（`768`/`1024`/`1280`/`1440`/`1600`/`1920`）× 三页（`/`、`/listing`、`/exchange`）判据 + 手机档零影响」**。**理由 = D4**：`.sf-fm` 在 `768–1023` 已可见，v1.7 的 `min-width:1024` 漏掉该中间档 ⇒ 相交 ≈ `49920 px²`。`T85` 判据（相交 = 0）**仍不降级**。
> **★ v1.9 补注（裁定⑪ · 撤 gutter + 裁定⑬ · 夜档 token 认可 · 原文逐字保留）**：
> - **① 撤 gutter（裁定⑪）**：上表「桌面正文右侧 gutter（`140px`）」**整表（含 v1.7 原文 / v1.8 就地更正 / 诚实边界）逐字保留、已被 v1.9 取代** —— **现行版 = 「不设 gutter」**（撤销 `frontend/src/styles.css` 的 `@media (min-width:768px){.sf-route-container{padding-right:140px}}`）。⇒ 正文**恢复原来宽度**，**右侧悬浮栏可以遮挡其它内容**（**遮挡 = 已知并接受项**）。`T85` **由「相交 = 0」重定义**（见 §14.1 ★ v1.9 重定义 / §14.0 裁定⑪）。
> - **② 夜档三 token 收口（裁定⑬）**：上表「色值 token（日/夜两档）」的**夜（推断）列三值**（`--sf-fm-bg` `#141619` / `--sf-fm-fg` `#EDEFF2` / `--sf-fm-divider` `#262A30`）与「诚实边界」段**逐字保留**；**裁定⑬ 认定该推断值经人类认可**（Kevin「目前看没问题」）⇒ 该列**不再标「待裁」**、**标「已认可（2026-10-11）」**（见 §14.8 `N28`）。
> - **几何说明（经手·非修饰）**：上「几何（结构常量）」表**未改写**（含容器宽 `108px`）；`T85`（现行版，见 §14.1）载几何六值 = **Kevin 裁定逐字**（含宽 `72`）—— 二者并列留痕，**以 §14.1 `T85` 行为现行版**，差异待 Kong 落地时按裁定值统一。

### 14.3 三弹窗模板位（复用既有 `Modal`）

| 弹窗 | 触发 | 内容（模板位） | 硬约束 |
|---|---|---|---|
| **APP** | 悬浮菜单第 3 项 | 二维码图位 + 下载引导文案占位 | 图位为**占位**（无真实码） |
| **反馈** | 悬浮菜单第 4 项 | 表单占位（输入框 + 提交按钮） | **不落库**（本轮不接后端） |
| **客服** | 悬浮菜单第 5 项 | 联系方式占位（如邮箱/账号文字） | 无真实外链亦可 |

- 三弹窗**复用 `frontend/src/components/ui/Modal.jsx`**（`role`/`aria-modal` 已由该组件承担·见 `OPEN-ITEMS` `R1` 收口）。
- **遮罩关闭 + ESC 关闭**：沿用 `Modal` 既有行为（判负见 §14.7）。

### 14.4 T76 去重口径重算（逐格）

| 项 | v1.1 旧口径（留痕） | **v1.5 新口径（`T86`）** |
|---|---|---|
| 底栏目标集 | `/`、`/reward`、`/task`、`/exchange` | **`/`、`/exchange`、`/listing/new`、`/messages`、`/profile`** |
| 顶栏项集（`menuItems`） | 奖励/任务/市场（+管理后台） | **不变**（奖励/任务/市场，+管理后台） |
| 汉堡排除集 = 顶栏 ∩ 底栏 | `['reward','task','exchange']` | **`['exchange']`** |
| 汉堡保留 | — | **`reward`、`task`**（去重理由消失 ⇒ 恢复）+ 用户区各项 |
| 桌面左 nav | 奖励/任务/市场 | **一字不动** |

> **功能回归点名（必写）**：**若沿用旧排除集 `['reward','task','exchange']` ⇒ 移动端 hamburger 面板将不含「奖励」「任务」，而底栏也不再含 ⇒ 移动端彻底失去这两入口** ⇒ 判负。
> **★ v1.6 补注（`home` 值变更 · Zang 裁定⑦）**：本表**底栏目标集第 1 项 = `/`（key `home`）** —— v1.6 的 `home` 变更是**值变更（文案：`首页`⇒`海鲜市场`）、非路由变更** ⇒ **本表底栏目标集（route 面）逐字不变**，`T86` 汉堡排除集 **仍 = `['exchange']`**（上一行「功能回归点名」不变）。`home` 值变更的全部影响面 = 底栏①**文案**（`t('home')`），见 §14.10 B 与 §14.5 ★。
> **★ v1.7 补注（裁定⑧ · `me` 键）**：底栏⑤（`/profile`）的 **`labelKey` 由 `profile` 改 `me`** 是**文案面（labelKey）变更、非 route / 非 `key` 变更** ⇒ **本表底栏目标集（route 面）逐字不变**，`T86` 汉堡排除集 **仍 = `['exchange']`**（上一行「功能回归点名」不变）；`SHELL_NAV_ITEMS` 第五项的 **`key` 仍 `profile`** ⇒ `visibleNavItems(...).map(i => i.key)` **逐字不变**。`me` 键的全部影响面 = 底栏⑤**文案**（`t('me')`），见 §14.10 A 与 §14.5 ★①。

### 14.5 断言影响（逐条点名 + 改锚方案）

| # | 测试 `文件:行号` | 断言语义 | 影响 | 处置 |
|---|---|---|---|---|
| 1 | `theme-shell-isomorphism.test.jsx:88` | 底栏 `a[data-sf-nav]` key 序 == `visibleNavItems(false)` | **一字不动**（用真源计算，自动跟随） | 前提：`visibleNavItems` 仍自 `SHELL_NAV_ITEMS` 派生 |
| 2 | `theme-shell-isomorphism.test.jsx:106-107` | `visibleNavItems(false/true)` key 集字面 | **必须改锚** | 新值 = `['home','shard','sell','messages']` / `+['profile']` |
| 3 | `theme-shell-isomorphism.test.jsx:91-103` | `.nav-link[href]` == nav 项去 home；`:102` 字面 `['/','/reward','/task','/exchange']` | **必须改锚** | 见下「★ 顶栏/底栏分家」 |
| 4 | `theme-shell-isomorphism.test.jsx:130-144` | `SHELL_NAV_ITEMS` 每项 route 在 `App.jsx`、labelKey 在四语 locale | **自动通过**（前提：Kong 加 `/messages` 路由 + `sell`/`messages` 键） | 无需改锚 |
| 5 | `theme-shell-isomorphism.test.jsx:146-153` | `SHELL_NAV_ITEMS[1]/[2]` 字面 `/reward`、`/task` | **必须改锚** | `[1]`=shard→`/exchange`；`[2]`=sell→`/listing/new` |
| 6 | `theme-shell-isomorphism.test.jsx:238-259` | 主题块 token 键名 ∈ `TOKEN_KEYS` | **Kong 须同步** | `TOKEN_KEYS` 增 `fm-bg`/`fm-fg`/`fm-divider`，否则 `未登记 token` 判负 |
| 7 | `theme-shell-isomorphism.test.jsx:261-283` | 四语键集逐文件相同 + siteTitle/siteSlogan | **一字不动**（对称新增 ⇒ 相等仍成立） | 无需改锚 |
| 8 | `theme-shell-isomorphism.test.jsx:215-229` | `shell.css` 只有 1 个断点块 | **一字不动** | 前提：`.sf-fm{display:none}` 加进既有 767 块内 |
| 9 | `theme-shell-isomorphism.test.jsx:205-213` | `shell/theme` JS 无 `matchMedia/innerWidth` | **一字不动** | 前提：`FloatingMenu.jsx` 走 CSS 断点，无 JS 判定 |
| 10 | `theme-shell-isomorphism.test.jsx:167-187/:77-81` | 日/夜 DOM 形状恒等 + 区域顺序 | **一字不动** | 前提：`FloatingMenu` 不挂 `data-sf-region`；三弹窗默认不渲染 |
| 11 | `r9-84-profile-entry.test.jsx:205-213` | 桌面左 nav 标签 = `[reward,task,shard]` | **一字不动** | 桌面 nav 未动；比对值取自 `zh.*` ⇒ 随 `shard` 新值自动跟随 |
| 12 | `r9-84-profile-entry.test.jsx:215-232` | 汉堡面板含 个人资料/电量签到/退出登录 | **一字不动** | 恢复 `reward`/`task` 不删这三项 |
| 13 | `route-exchange-rename.test.jsx:86-89` | `zh/en/hk/vn` 的 `shard` 值 = `碎片市场`/`Shard Market`/`碎片市場`/`Chợ mảnh` | **必须改锚** | 新值 = `市场`/`Market`/`市場`/`Chợ` |
| 14 | `route-exchange-rename.test.jsx:103` | `visibleNavItems(false)` key = `['home','reward','task','shard']` | **必须改锚** | 新值 = `['home','shard','sell','messages']` |
| 15 | `r9-93-points-symbol.test.jsx:185-194` | 键计数 top=119 / flat=1050 | **必须改锚** | 新值 = **top=128 / flat=1070** |
| 16 | `s8-locale-key-coverage.test.js:181-188` | top=119 / flat=1050 / 节点=4200 | **必须改锚** | top=128 / flat=1070 / 节点=4280 |
| 17 | `s9-ledger-kind-closure.test.js:120-128` | 同上 | **必须改锚** | 同上 |
| 18 | `r9-96-dashj-copy.test.jsx:119-130` | top=119 / flat=1050 / 节点=4200 | **必须改锚** | 同上 |
| 19 | `s19-participants-truth-source.test.jsx:103-108` | 同上 | **必须改锚** | 同上 |
| 20 | `s23-participants-headcount.test.jsx:116-121` | 同上 | **必须改锚** | 同上 |
| 21 | `s5-publish-headcount.test.jsx:83-88` | 同上 | **必须改锚** | 同上 |
| 22 | `s7-submissions-panel.test.jsx:298-303` | 同上 | **必须改锚** | 同上 |
| 23 | `i18n-batch-b4a.test.jsx:146` | `counts.zh == {top:119, flat:1050}` | **必须改锚** | `{top:128, flat:1070}` |
| 24 | `i18n-batch-b4b.test.jsx:239/257/323` | 同上（含打印串 `zh: top=119 flat=1050`） | **必须改锚** | 同上 |
| 25 | `i18n-batch-b5.test.jsx:216/242/258` | 同上 | **必须改锚** | 同上 |
| 26 | `i18n-violation-closeout.test.jsx:133` | `[...counts][0]) == 1050` | **必须改锚** | `1070` |
| 27 | `app-routes.test.jsx`（整体） | 渲染 `/`、`/login` | **一字不动** | 与 nav 无关 |
| 28 | `fix-nav-langshell.test.jsx`（整体） | 语言前缀登录路由 / 链接构造器 | **一字不动** | 全程 `vi.mock(Header)`，与 nav 无关 |
| 29 | `frontend/scripts/p4z-fixnav-langlinks.mjs` | login/register 相对路由串 + 语言链接 | **一字不动** | 只断既有串 |
| 30 | `backend-ts/scripts/p7b-03-offline-gates.ts` `AC10-2` | 后端注册点冻结面 = **89** | **一字不动** | `/messages` 是**前端**路由 ⇒ **后端注册点仍 89** |
| 31 | §13.1 `T77` 行 / §13.5 `P2 触控` 行「归因式判据」 | 1440 档差异集 100% 归因 `T79` 字号 | **措词须更新**（**允许变更集 += 新组件**） | 见 §14.9(b) 措词 |
| 32 | `frontend/src/locales/{zh,en,hk,vn}.json` 的 **`home` 值**（现取扫描：是否存在断言 `home` 值 = 「首页」/`Home`/`首頁`/`Trang chủ` 的用例） | **是否有用例断言 nav 文案（底栏① = `t('home')`）为「首页」** | **现取 = 无（0 命中）** | **`home` 值变更（`首页` ⇒ `海鲜市场`）无断言锚定 ⇒ 无需改锚**；**值变更不改任何键计数**（§14.10 尾）；现取命令与命中行见下 ★ |
| 33 | `v15-nav-floatmenu.test.jsx:96-99`（**★ 本轮 Kong 新增测试**；`git` 未跟踪 `??`）| 底栏 5 格文案 `== [TABLES[lang].home, .shard, .sell, .messages, TABLES[lang].profile]`（硬编码）| **必须改锚**（**仅第五格**）| 第五格新值 = `TABLES[lang].me`；其余四格逐字不变（`labelKey` 仅第五项由 `profile`→`me`）|
| 34 | §13.1 `T77` 行 / §13.5 `P2 触控` 行 + §14.9(b)（归因式判据）| 1440 档差异集 ⊆ 允许变更集 | **措词须更新**（**允许变更集 += 「gutter 引起的容器/内容宽度变化面」**）| 见 §14.9(b)（与 `T79` 字号、`.sf-fm` 子树并列）|
| 35 | §14.2 gutter 表 / §14.6 第 16 行 / §14.7 判负行（**★ v1.8 · 裁定⑩**）| gutter 生效起点 `1024` ⇒ `768`；`T85` 验收面 | **措词须更新**（**验收面扩六档 × 三页 + 手机档零影响**）| 见 §14.0 裁定⑩ / §14.2 / §14.6 第 16 行 / §14.7；`T85`「相交 = 0」**判据不降级**、**作用域 = 菜单可见的一切宽度档**（`>767`）；**不改任何测试文件**（属判据/几何口径面）|
| 36 | §14.9(b)（归因式判据）/ §14.7「归因式判据」行（**★ v1.8 · 归因第④类**）| 1440 档差异集 ⊆ 允许变更集（**由三类扩四类**）| **措词须更新**（**允许变更集 += 「§14 已批准的 locale 值变更引起的文案/宽度面」**）| 见 §14.0 归因第④类 / §14.9(b)；**锚点** = 桌面左 nav 第 3 项宽 `52 ↔ 80`（根因 = `shard` 值 `碎片市场→市场`，每页 5 条差异原无归属 = **D3**）；**第④类须给「算术语义闭合」**（`newWidth−oldWidth` 符号 = `(len(new)−len(old))` 符号、量级同阶），**闭合不成立 ⇒ 立缺陷** |
| 37 | `r9-84-profile-entry.test.jsx`（整体 · 锚「个人资料」文案）（**★ v1.9 · 裁定⑫**）| `zh.profile` = 「个人资料」参与断言（`:114` / `:135` / `:210` / `:211` / `:226` 等）| **必须改锚（Kong 执行）** | 裁定⑫：`profile` 键四语值改「我的 / Me / 我的 / Tôi」⇒ 凡以 `zh.profile`（变量）/ 字面「个人资料」参与断言处须由 Kong **现取并改锚**（本节 ★ v1.9 补登 · 顶栏/底栏「分家」条件不变）|
| 38 | `v15-nav-floatmenu.test.jsx:89`（**★ 本轮 Kong 新增测试**）| `SHELL_NAV_ITEMS[4].labelKey === 'me'` | **必须改锚** | 裁定⑫：第五项 `labelKey` 回 `'profile'` |
| 39 | `v15-nav-floatmenu.test.jsx:91-98`（同上）| `me` 四语值断言（`TABLES.{zh,en,hk,vn}.me` = 我的/Me/我的/Tôi）+ `profile` 四语值未变（个人资料/…）| **必须删 / 改锚** | 裁定⑫：**`me` 键删除** ⇒ 该段 `me` 断言须删；`profile` 四语**新值** = 我的/Me/我的/Tôi（与上一轮「未变」断言相反）|
| 40 | `v15-nav-floatmenu.test.jsx:113`（同上）| 底栏 5 格文案 `[..., TABLES[lang].me]` | **必须改锚（仅第五格）** | 裁定⑫：第五格回 `TABLES[lang].profile`（新值 = 我的/Me/我的/Tôi）；其余四格逐字不变 |
| 41 | 按键计数断言（本节第 15–26 行 + `v15-*` 前推注释）（**★ v1.9 · 裁定⑫**）| top / flat / nodes 计数（上轮 = `129`/`1071`/`4284`）| **必须改锚** | 裁定⑫：删 `me` ⇒ 计数**回落**为 **top `128` / flat `1070` / nodes `4280`**（§14.10 尾）|
| 42 | §14.1 `T85` 行 / §14.2 gutter 表 / §14.6 #16 / §14.7 相关行（**★ v1.9 · 裁定⑪**）| gutter 撤销 + `T85` 重定义 + 验收面删「相交 = 0」| **措词须更新** | 见 §14.0 裁定⑪ / §14.1 ★ v1.9 重定义 / §14.2 ★ v1.9 补注 / §14.6 #16 / §14.7；**不改任何测试文件**（属判据/几何口径面）|

> **★ 顶栏 / 底栏「分家」（本版最硬的一处口径）**：`T80` 后 **`SHELL_NAV_ITEMS`（nav.js）= 底栏 5 项**；而**桌面左 nav 仍取 `Header.jsx` 的 `menuItems`（奖励/任务/市场）**（Kevin 明文「桌面左 nav 一字不动」）⇒ **两者不再同集**。因此第 3 行断言（`.nav-link == nav 项去 home`）的**前提失效**，须改锚为两条独立断言：① **底栏**（`[data-sf-region="tabbar"] a[data-sf-nav]` 的 href）= `['/','/exchange','/listing/new','/messages','/profile']`（含前缀档同法）；② **桌面左 nav**（`.nav-link[href]`）= `['/reward','/task','/exchange']`（**现状值，一字不动**）。
> **★ nav 文案现取结论（`home` 值变更 · 本册 v1.6 · Zang 裁定⑦）**：**「凡断言 nav 文案为「首页」的用例」= 现取为「无」**。命令与读数：`grep -rn "首页" frontend/src/test --include='*.js' --include='*.jsx'` ⇒ 命中 **5 行、全为注释**（`listing-market.test.jsx:234`〔游标说明〕· `lang-path-redirect.test.jsx:218` · `i18n-content-wiring.test.jsx:235` · `ledger-flow-behavior.test.jsx:88,148`），**无一条断言底栏①文案**；另按 `labelKey:'home'` / `t('home')` / `.home` 现取，`home` 键**唯一消费点 = `frontend/src/shell/nav.js:15`**（非测试面）。⇒ `home` 值变更（`首页` ⇒ `海鲜市场`）**不挂任何测试、无需改锚**。旁证：唯一 locale-文案类断言 = `theme-shell-isomorphism.test.jsx:266-267`（`siteTitle` = `Seafood 海鲜市场`）**与本键无关、不受影响**；`theme-shell-isomorphism.test.jsx:106-107` 断言的是 **key 集字面**（`'home'` 为 key、非文案）⇒ **不受值变更影响**（其改锚只源于 `T80` 键集变更，见本节第 2 行）。**锚点落地提示（供 Kong/Neng）**：`frontend/src/locales/*.json` 落地 `home` 新值后，底栏① `t('home')` 应渲染「海鲜市场」；**若未来新增「断言底栏①文案 == 首页」的用例 ⇒ 改锚为新值「海鲜市场」**。**值变更 = +0 键**（§14.10 尾计数逐字不变）。
> **★ v1.7 补登（裁定⑧⑨ · 断言影响）**：**① 裁定⑧（`me` 键）** —— **`me` 键不挂任何「既有」断言**（「既有」= 本节第 1–32 行点名者）；**`r9-84-profile-entry.test.jsx`：不动**（**理由**：该测试锚的是 **`Header.jsx:284` / `:460` 两个消费点的 `t('profile')` 文案「个人资料」**〔`:135`/`:226` = `toContain(zh.profile)`〕，而裁定⑧ **不改 `profile` 键值** ⇒ `zh.profile` 仍 = 「个人资料」⇒ **`r9-84` 逐字不动、必须保持绿**）。**唯一挂 `me` 的断言 = 本轮 Kong 新增测试 `v15-nav-floatmenu.test.jsx:96-99`**（硬编码第五格 = `TABLES[lang].profile`）⇒ **属「新增测试」而非「既有断言」，须由 Kong 改锚为 `TABLES[lang].me`**（本节第 33 行）。另 `theme-shell-isomorphism.test.jsx:130-144`（**每项 `labelKey` 必须在四语 locale**）**自动覆盖 `me`**（前提：四语补齐 `me` 键，见 §14.10 A）。**② 裁定⑨（gutter）** —— gutter 属**桌面几何新变更面**：它改变**各页正文容器/内容的宽度几何**（非 `T79` 字号、非 `.sf-fm` 子树）⇒ **必须并入「归因式判据」的允许变更集**（§13.1 `T77` 行 / §13.5 `P2 触控` 行 / §14.9(b)），否则 1600 档（内容 `max-width` 因 gutter 收窄）差异集会被误判为「与字号/新组件均无关的几何差异」；**gutter 不放宽 `T85`**（`T85` 仍「相交 = 0」）。**③ 计数** —— 因新增 `me` 键，本节第 15–26 行「按键计数断言」的**目标新值 +1 键** ⇒ **top `129` / flat `1071` / nodes `4284`**（§14.10 尾）。
> **★ v1.9 补登（裁定⑪⑫⑬ · 断言影响）**：**① 裁定⑫（`profile` 值全站统一 · 删 `me`）** —— **`r9-84-profile-entry.test.jsx` 由「一字不动」翻转为「必须改锚」**（Kong 执行）：该文件以 `zh.profile`（变量，上轮 = 「个人资料」，本裁定后 = 「我的」）参与断言（`:114`/`:135`/`:210`/`:211`/`:226` 等，见本节第 37 行）⇒ **须由 Kong 现取并改锚**；**`v15-nav-floatmenu.test.jsx` 亦须改锚**（`:89`/`:91-98`/`:113`，见本节第 38–40 行；`me` 键删除）。**② 按键计数断言回落**（本节第 41 行）：上轮目标 `129`/`1071`/`4284` ⇒ 本裁定**回落**为 **`128`/`1070`/`4280`**（§14.10 尾）。**③ 裁定⑪（撤 gutter + `T85` 重定义）** 属**判据/几何口径面**，**不改任何测试文件**（本节第 42 行）。**④ 裁定⑬（夜档 token 认可）** 不落测试面（token 值不变，仅「待裁 → 已认可」状态变更）。
> **★ v1.9 现取（2026-10-11 · Kong 同轮已落地改锚）**：本节第 37–41 行的**改锚要求已由 Kong 同轮执行**，现取证据 —— **`r9-84-profile-entry.test.jsx`** 已重写（测试标题/文案由「个人资料」改「我的」；`:135`/`:226` 仍以 `zh.profile` 变量断言 ⇒ 现值「我的」；`:114`/`:210`/`:211` 仍 `not.toContain(zh.profile)`）；**`v15-nav-floatmenu.test.jsx:89`** `fifth.labelKey` = `'profile'`、**`:113`** 第五格 = `TABLES[lang].profile`、`me` 键已删；**按键计数已回 `128`/`1070`/`4280`**。本节上述条目**作为要求留档**（含现取证据）。
> **★ v1.9 取代声明（裁定⑫ · `r9-84` 面）**：上条 v1.7 补登中「**`r9-84-profile-entry.test.jsx`：不动**」的结论**已被 v1.9 裁定⑫ 取代**（**改前原文逐字保留**）；**现行版 = `r9-84` 必须改锚**（Kong 执行）。

### 14.6 Kong 实现清单（文件:行号级）

| # | 文件:行号 | 现状值（现取） | 目标值 | 依据 |
|---|---|---|---|---|
| 1 | `frontend/src/shell/nav.js:14-20` | `SHELL_NAV_ITEMS` = `[home,reward,task,shard,profile]`（icon `Home/Gift/Briefcase/Store/User`） | 改为 `[home(/,\u200bHome), shard(/exchange,\u200bStore), sell(/listing/new,\u200bPlusCircle), messages(/messages,\u200bMessageCircle), profile(/profile,\u200bUser, requiresAuth)]` | `T80` |
| 2 | `frontend/src/shell/nav.js:4-13`（注释块） | 「全部来自既有路由实现…」 | 同步改注：新增项 = `messages`（本轮新路由 `/messages`）；**前提仍成立**（添加后均在 `App.jsx` 内有对应路由） | `T80` |
| 3 | `frontend/src/App.jsx`（LangShell 内层 `<Routes>`，参照 L76–113） | 无 `messages` 路由 | 增 `<Route path="messages" element={<MessagesPage />} />`（**新占位页**；X/推特接驳位预留）；**不得**增 `/nearby` | `T80` + `route-layer.spec v2.27 §37` |
| 4 | `frontend/src/pages/.../MessagesPage.jsx`（新建） | 不存在 | 占位页（标题 + 空态 + X 私信接驳位占位块） | `T80` |
| 5 | `frontend/src/components/Header.jsx:17` | `MOBILE_PANEL_EXCLUDED_PATHS = ['reward','task','exchange']` | **`['exchange']`** | `T86` |
| 6 | `frontend/src/shell/FloatingMenu.jsx`（新建） | 不存在 | 悬浮菜单组件（5 项 · 三项开弹窗）+ `data-sf-m` 钩子（**不得 `data-sf-region`**） | `T81`–`T85` |
| 7 | `frontend/src/shell/AppShell.jsx:22`（`<BottomTabBar />` 之后） | 无悬浮菜单 | 追加 `<FloatingMenu />` | `T81` |
| 8 | `frontend/src/shell/shell.css:104`（唯一 767 块，L123 内） | 767 块含 `.sf-tabbar{display:grid}` | 追加 `.sf-fm{display:none}`（**在既有块内**，不新增 `@media`）；顶层默认 `.sf-fm{display:flex}` | `T81` |
| 9 | `shell.css` 顶部 | 无 `.sf-fm` | 加 `.sf-fm` 几何（`108px`/`92px`/`54px`/`26px`/`12px`/`6px`/`1px 48px`/`right:16px`/`top:45%`/`translateY(-50%)`/阴影） | `T82` |
| 10 | `frontend/src/theme/tokens.js`（`TOKEN_KEYS`，参照 L31+） | 无 `fm-*` | 增 `fm-bg`/`fm-fg`/`fm-divider`（日档值 `#FFFFFF`/`#333333`/`#E8E8E8`） | `T83` |
| 11 | `frontend/src/theme/theme-tokens.css:159+`（`[data-theme="dark"]`） | 无 `fm-*` | 增 `--sf-fm-bg:#141619` / `--sf-fm-fg:#EDEFF2` / `--sf-fm-divider:#262A30` | `T83` |
| 12 | `frontend/src/theme/theme-tokens.css` `:root` | 无 `fm-*` | 增日档三 token（`#FFFFFF`/`#333333`/`#E8E8E8`） | `T83` |
| 13 | `frontend/src/components/ui/Modal.jsx`（复用） | 既有 | 三弹窗复用之（APP/反馈/客服 模板位） | `T84` |
| 14 | `frontend/src/locales/{zh,en,hk,vn}.json` | 119 键/语 | 增 20 键/语（§14.10 逐键）+ 改 **`shard`/`home`** 值（**值变更 2 键**；`home` = `首页`⇒`海鲜市场`，见 §14.10 B） | `T80`/`T81`/§14.10〔**★ v1.6 就地更正**：原写「+ 改 `shard` 值」，Zang 裁定⑦ 补 `home`〕〔**★ v1.7 就地更正**：增 **21** 键/语（原 20 + **新增 `me`**，Zang 裁定⑧）⇒ 计数 顶层 `119⇒129` / 拍平 `1050⇒1071` / 四语节点 `4200⇒4284`〕〔**★ v1.9 回改 · 裁定⑫**：**删除 `me` 键**（四语各删 1 顶叶）⇒ 计数**回落** 顶层 `128` / 拍平 `1070` / 四语节点 `4280`；**`profile` 值改** 转由本行与 item 15 承载〕 |
| 15 | `frontend/src/shell/nav.js:21` | 第五项 `labelKey: 'profile'` | **改 `labelKey: 'me'`**（`key: 'profile'` / `path: 'profile'` / `requiresAuth: true` 不动）| `T80`〔**★ v1.7 补登 · Zang 裁定⑧**：底栏⑤文案 = 「我的」；`profile` 值不动〕〔**★ v1.9 回改 · 裁定⑫**：**`labelKey` 回 `'profile'`**（第五项 `labelKey: 'me'` ⇒ `'profile'`）；**`profile` 键四语值改** 我的/Me/我的/Tôi；**并删 `me` 键**；**改锚** `r9-84` 等断言（见 §14.5 第 37–40 行）〕 |
| 16 | `frontend/src/styles.css`（**新增** `@media (min-width:768px)` 块）〔**★ v1.8 就地更正（裁定⑩）**：改前原文 = 新增 `@media (min-width:1024px)` 块，**逐字留痕、已作废**；理由 = `.sf-fm` 在 `768–1023` 已可见，`min-width:1024` 漏该中间档 ⇒ 相交 ≈ `49920 px²`（**D4**）〕| 无桌面 gutter | **`>767`（菜单可见的一切档）**正文预留右侧 gutter `140px`（`padding-right` / 内容 `max-width` 收窄，几何口径见 §14.2）| `T85`〔**★ v1.7 补登 · Zang 裁定⑨**：**不得落 `shell.css`**（其仍只 1 个 767 块）〕〔**★ v1.8 补登 · 裁定⑩**：起点 `1024` ⇒ **`768`**，与 `.sf-fm` 显示阈值同界；**`shell.css` 仍不得新增 `@media`**〕〔**★ v1.9 撤销 · 裁定⑪**：**本 item 整条撤销** —— **删除** `frontend/src/styles.css` 的 `@media (min-width:768px){.sf-route-container{padding-right:140px}}`（连同注释块）；**不设 gutter**；正文**恢复原来宽度**、**允许遮挡**；由此 **§14.2 gutter 表 / `T85` 旧判据「相交 = 0」/ §14.7 无遮挡判负行 均已被 v1.9 取代**（见 §14.0 裁定⑪ / §14.1 ★ v1.9 重定义）〕 |

### 14.7 Neng 判负清单

| 项 | 正向判据 | 判负方法（可执行） | 证据边界 |
|---|---|---|---|
| **桌面可见性 + 5 项可点** | 1440 档 `.sf-fm` 可见（`getBoundingClientRect` 非 0）且 5 项可点、可跳转 | 1440 档**真实坐标点击**（`elementFromPoint` + `click()`）：`卖闲置`→`/listing/new`、`消息`→`/messages`；`APP`/`反馈`/`客服`→弹窗出现 | 设备档可判 |
| **≤767 隐藏** | `.sf-fm` 计算 `display === 'none'`（390/375/320） | 三档读 `getComputedStyle('.sf-fm').display`；非 `none` ⇒ 判负 | 设备档可判 |
| **底栏五项对拍** | 底栏 `a[data-sf-nav]` 的 label/href 逐项 == `T80` 表（含四语前缀） | 四语前缀各取一次（zh 无前缀 / en / hk / vn）：href ∈ `{/,/exchange,/listing/new,/messages,/profile}` 加对应前缀；label 取自四语 locale | 设备档可判 |
| **三弹窗开关** | 三项各弹窗可开；**遮罩/ESC 可关** | 开 → 点遮罩空白关；再开 → `Escape` 关；关后 DOM 无弹窗节点 | 设备档可判 |
| **四语键集逐文件相同** | 四语 locale `Object.keys` 排序后逐文件相等 | `Object.keys` 相等 + 20 新键齐 + `shard`/`home` 新值〔**★ v1.6**：原写「+ `shard` 新值」，Zang 裁定⑦ 补 `home` 新值〕 | 设备档可判 |
| **390/375/320 零横向溢出** | `scrollWidth <= innerWidth` | 三档各读 `{scrollWidth, innerWidth}` | 设备档可判 |
| **1440 无遮挡（★ v1.9 已被取代 · 裁定⑪：`T85` 重定义后「相交 = 0」不再作判据；遮挡 = 已知并接受项，仅登记实测面积）** | 悬浮菜单 rect 与正文卡片 rect **相交面积 = 0** | 遍历正文卡片选择器取 rect，与 `.sf-fm` rect 求交（含边界）；`> 0` ⇒ 判负 | 设备档可判 |
| **六档 × 三页无遮挡 + 零横向溢出（★ v1.8 · 裁定⑩ 就地扩档；v1.7 三档口径留痕见右）〔★ v1.9 就地更新 · 裁定⑪：**删「相交 = 0」判据**、只留 **六档 × 三页零横向溢出 + 可见性（`≤767` 隐藏 / `≥768` 显示）+ 几何六值**；**遮挡面积降为登记项、不得判负**〕** | **`768` / `1024` / `1280` / `1440` / `1600` / `1920` 六档 × `/`、`/listing`、`/exchange` 三页**，逐档逐页 `.sf-fm` rect ∩ 正文卡片 rect **= `0`** **且** `scrollWidth == clientWidth`；**手机档（`390`/`375`/`320`）零影响**（`.sf-fm` 计算 `display === 'none'` 且正文无 gutter） | 六档 × 三页各遍历正文卡片取 rect 与 `.sf-fm` 求交（含边界）；任一（档 × 页）`> 0` **或** `scrollWidth > clientWidth` ⇒ 判负；手机三档须 `.sf-fm` `display:none` 且正文无 gutter。**`T85` 不降级**（「相交 = 0」逐字不变），gutter 为实现取向。**留痕（v1.7 原文 · 逐字保留 · 已被本行取代）**：「**1440 / 1600 / 1920 三档无遮挡 + 零横向溢出（★ v1.7 · 裁定⑨）**：三档 `.sf-fm` rect ∩ 正文卡片 rect = `0` 且三档 `scrollWidth == clientWidth`」—— **取代理由 = 裁定⑩**：`T85` 作用域 = 菜单可见的一切档（`>767`，含 `768–1023` 中间档），v1.7 三档口径**漏掉该中间档**（实测相交 ≈ `49920 px²` = **D4**）| 设备档可判 |
| **汉堡去重（`T86`）** | 展开汉堡面板：`a[href]` 集 ∩ 底栏 `a[href]` 集 = ∅，**且面板含 `reward`/`task`** | 展开后取面板 `a[href]`；反例：面板缺 `reward`/`task` ⇒ 判负（功能回归） | 设备档可判 |
| **桌面左 nav 未动** | 1440 档桌面 `nav a` 文案 = `[奖励,任务,市场]` | 取 `document.querySelector('nav') a` 文案 | 设备档可判 |
| **归因式判据（允许变更集 += 新组件 + gutter + 第④类）〔★ v1.9 就地更新 · 裁定⑪：**撤销「③ gutter 引起的容器/内容宽度变化面」**（gutter 已撤 ⇒ 该面归零）〕** | 见 §14.9(b) | 差异集 ≠ `T79` 归因集时，须 ⊆ 允许变更集（① `T79` 字号 + ② **新增 `.sf-fm` 子树** + ③ **★ v1.7：gutter 引起的容器/内容宽度变化面**〔**已被 v1.9 撤销**〕 + ④ **★ v1.8：§14 已批准的 locale 值变更引起的文案/宽度面**）；**第④类须给「算术语义闭合」**（字串长度变化 → 宽度变化方向与量级一致；闭合不成立 ⇒ **立缺陷**） | 设备档可判 |

> **★ v1.9 补注（裁定⑪ · §14.7 判负面更新 · 原文逐字保留）**：
> - **① 「相交 = 0」类判负行全体已被 v1.9 取代**：**「1440 无遮挡」行**与**「六档 × 三页无遮挡 + 零横向溢出」行**中的「`.sf-fm` rect ∩ 正文卡片 rect = `0`」**判据删除**（原行**逐字保留**、已标取代）。**现行版** = `T85` 重定义（见 §14.1）：**可见性（`≤767` 隐藏 / `≥768` 显示）+ 几何六值 + 六档 × 三页零横向溢出**；**遮挡面积 = 登记项**（各档逐页现取面积入证据包），**`> 0` 不得判负**。
> - **② 六档 × 三页验收面保留**（`768`/`1024`/`1280`/`1440`/`1600`/`1920` × `/`、`/listing`、`/exchange`），**但判据只剩「`scrollWidth == clientWidth`（零横向溢出）」**（+ 手机档 `390`/`375`/`320` `.sf-fm` `display:none`）。
> - **③ 归因式判据「允许变更集」中「gutter 面」撤销**（gutter 已撤，该面归零）；其余三类（`T79` 字号 / `.sf-fm` 子树 / 第④类 locale 值变更）不变（见 §14.9(b) ★ v1.9 就地更新）。
> - **④ 反相复现 `49920` 的处置**：该数值属 **v1.8 的 gutter 叙事**（**逐字保留于 §14.0 裁定⑩ / §14.2 v1.8 补注 / 本行上方留痕**），**v1.9 不引用为判据**；**原文一字未修饰**（受「不得修饰」约束）。

### 14.8 未核实 / 登记（诚实清单 · 承接 N 序列）

- **N27**：悬浮菜单**真机**（实体手机）上「≤767 隐藏」与桌面「不遮挡」**未在真机复测** ⇒ `NOT_MEASURED`（承 `N23`/§13.6）。设备档（CDP）可判。〔**★ v1.9 就地留痕（裁定⑪）**：其中「桌面『不遮挡』」面**已被 v1.9 取代** —— `T85` 重定义后**遮挡为已知并接受项**（仅登记实测面积、不得判负）；**「≤767 隐藏」面仍为现行判据**（`display:none`）。原文未改写。〕
- **N28**：**夜档 `--sf-fm-*` 三值为「推断」**（参考图未展示夜间）—— 值取自本仓夜档既有面板/卡片值，**未经 Kevin 逐格确认** ⇒ 登记为**一句话可改**（改三格值即可，不动结构）。〔**★ v1.9 就地留痕（裁定⑬ · 已认可 2026-10-11）**：**该三值经人类认可**（Kevin 回复「目前看没问题」）⇒ **状态由「待裁 / 一句话可改」转为「已认可（2026-10-11）」**；`N28` 原文**未改写**（受「不得改写历史行、只追加/就地留痕」约束）。**台账对应 = `F8`**（`docs/seafood.master-plan.md`）。〕
- **N29**：悬浮菜单的**阴影/圆角/间距**在 1440 真机上的**像素级观感**（参考图 → 桌面等比缩放）未逐值复核 ⇒ 由 Neng 设备档现取补录。
- **N30**：`/messages` 占位页与 **X（推特）私信**的真实接驳**未实现**（本轮占位留空）⇒ 属后续单；本册只冻结「占位 + 接驳位预留」。
- **N31（★ v1.9 新增 · 承 `N26`/`F7` · 待查）**：**真机与本地 H5 配色差异** —— 实体手机（真机）呈现的配色与本地 H5（浏览器 / 设备档）**存在差异**，**归因未定**。**三假设（待逐项排除）**：**① 主题档状态**（真机 `localStorage` / 系统偏好 ⇒ 落 `light`/`dark` 与本地不一致）；**② 广色域色彩管理**（`Display P3` 等宽色域下的色彩管理 / 色域映射差异）；**③ iframe vs 独立视口渲染**（H5 在 iframe 内 vs 独立视口下的渲染差异）。**旁证（现取 2026-10-11）**：**本仓样式/主题层无 `oklch`/`color-mix` 声明** —— `frontend/src/theme/**` 与 `frontend/src/shell/shell.css` **0 命中**；`frontend/src/styles.css` 命中 **5 行**、**全为注释**（说明 Tailwind v4 默认调色板曾用 `oklch`、本仓已显式覆盖为 `hex`）。⇒ **待查**；承**真机挂账线** `N26`（反事实归因实验之真机侧 `NOT_MEASURED`）/ **`F7`**（悬浮菜单真机读数挂账，见 `docs/seafood.master-plan.md`）。
- **★ N31 就地收口（v1.13 · 定案 · 原行一字未改）**：`N31`（真机与本地 H5 配色差异 · 三假设）**已定案**：**手机真机实测**（Xiaomi MiuiBrowser / Android 14 / Chrome 135）站内 `html[data-theme]=dark` / `.sf-shell` 背景 `rgb(11,12,14)` / `--sf-page-bg: #0B0C0E` / 父页 `prefers-color-scheme` = `false` / 色卡 9/9 回读精确（含 `#FDE815 → rgb(253,232,21)`） ⇒ **手机看到的是本站夜档（`localStorage theme=dark`，按 origin 隔离）+ 屏幕渲染忠实**；**① 主题档状态 = 成立且已定性**（非缺陷）、**①′ 浏览器强制深色 = 排除**、**② 广色域 / 屏幕 = 排除**、**③ iframe vs 独立视口 = 排除**。**证据** = `/_preview/colors` 诊断页（`docs/audit/h5-preview-colors-probe.md`）；**该诊断页的持久价值已登记**（见 §17.3 尾）。详见 **§17.3**。

### 14.9 style-preview 追加区块自证 + 归因判据措词更新

**(a) 追加区块三读数（本册已执行）**：`docs/design/style-preview.html` **纯追加**（`open(path,'ab')`）——
- **改前**：sha256-less md5 `8885ee39973f52c0e3a8741811a2f028` · `80,289 B` · `982 行`；
- **改后**：md5 `13a845dacb6865ea3fa738663a63159c` · `86,638 B` · `1042 行`；
- **自证三读数**：① `md5(after[:80289]) == md5(before)` ✅（**前缀逐字节不变**）；② **字节增量 = +6349**；③ **新块行号区间 = `983..1042` > 旧最大引用行号 `868`** ✅（`grep -oE 'SP:[0-9]+'` 旧最大 = `868`）。

**(b) §13 桌面「归因式判据」措词更新（★ 允许变更集 += 新组件）**：§13.1 `T77` 行 / §13.5 `P2 触控` 行的**归因式判据**（「1440 档差异集必须 100% 归因于 `T79` 字号提升」）**措词就地更新**为：
> **「1440 档差异集必须 ⊆ 允许变更集 = {`T79` 字号提升的级联；**新增组件 `.sf-fm` 子树（悬浮菜单及其弹窗宿主）**}。验证法 = 反事实归因实验：回退 `T79` 字号 **且** 隐藏 `.sf-fm`（测量期注入，不动仓库）⇒ 差异集必须为空（`仅基线有 = 0` 且 `仅归因有 = 0`）；且差异集中不得存在与字号、与新组件均无关的几何/布局差异。」**
> **留痕**：原措词（仅 `T79` 字号）**逐字保留于 §13.1 / §13.5 既有行**（本册不改写）；**本行为其就地更新，以本行为现行版**。**理由** = `T81` 新增 `.sf-fm` 在 1440 档可见（新增 DOM 元素）⇒ 旧判据的「差异集归零」不再成立。
> **★ v1.7 就地更新（裁定⑨ · 允许变更集 += gutter）**：上条「允许变更集」**再就地扩充**为 —— **「1440 档差异集必须 ⊆ 允许变更集 = {`T79` 字号提升的级联；**新增组件 `.sf-fm` 子树（悬浮菜单及其弹窗宿主）**；**gutter 引起的容器/内容宽度变化面（桌面档正文右侧预留 `140px`）**}。验证法 = 反事实归因实验：回退 `T79` 字号 **且** 隐藏 `.sf-fm` **且** 撤除 gutter（测量期注入，不动仓库）⇒ 差异集必须为空（`仅基线有 = 0` 且 `仅归因有 = 0`）；且差异集中不得存在与字号、与新组件、与 gutter **三者均无关**的几何/布局差异。」**（与 §13.1 `T77` 行 / §13.5 `P2 触控` 行的归因口径**同构** —— 同一「反事实归因 + 差异集 ⊆ 允许变更集」表述。）**留痕**：v1.5 版措词（`T79` + `.sf-fm`）**逐字保留于上一行**；**本行为其就地更新，以本行为现行版**。**理由** = 裁定⑨ 的 gutter 改变了**正文容器/内容宽度几何** ⇒ 未撤除 gutter 前「差异集归零」不成立。
> **★ v1.8 就地更新（裁定⑩ + 归因第④类 · 允许变更集扩为四类）**：上两行「允许变更集」**再就地扩充**为 —— **「差异集必须 ⊆ 允许变更集 = { ① `T79` 字号提升的级联；② 新增组件 `.sf-fm` 子树（悬浮菜单及其弹窗宿主）；③ gutter 引起的容器/内容宽度变化面（`>767` 全档正文右侧预留 `140px`，**起点 `768`**）；④ **§14 已批准的 locale 值变更引起的文案/宽度面** }。验证法 = 反事实归因实验：回退 `T79` 字号 **且** 隐藏 `.sf-fm` **且** 撤除 gutter（测量期注入，不动仓库）⇒ 差异集必须 ⊆ **第④类允许集**（余下差异须**逐条可追溯到 §14 已批准的 locale 值变更**，且**每条须给「算术语义闭合」**：字串长度变化 → 宽度变化方向与量级一致，即 `newWidth − oldWidth` 的符号 = `(len(newLabel) − len(oldLabel))` 的符号、量级同阶）；且差异集中不得存在与字号、与新组件、与 gutter、与 §14 已批准值变更 **四者均无关** 的几何/布局差异。」**
> **留痕**：v1.5（`T79` + `.sf-fm`）与 v1.7（+ gutter，实为「三允许面」）措词**逐字保留于上方两行**；**本行为其就地更新，以本行为现行版**。**理由** = ① **裁定⑩** 的 gutter 起点改 `768` 使 **`768–1023` 中间档**进入验收面（`T85` 作用域 = 菜单可见的一切档）；② **归因第④类**承接 **D3** —— `shard` 值 `碎片市场→市场` 使桌面左 nav 第 3 项宽 **`52 ↔ 80`**，**每页 5 条差异原无归属** ⇒ 补入允许变更集，避免「已批准的值变更」被误判为无关几何差异；**第④类可判负要求 = 算术语义闭合**（见 §14.0 归因第④类 / §14.7 归因式判据行）。
> **★ v1.9 就地更新（裁定⑪ · 允许变更集「gutter 面」撤销）**：上 v1.7 / v1.8 两行「允许变更集」中**第③类「gutter 引起的容器/内容宽度变化面」就地撤销**（**gutter 已撤 ⇒ 该类归零**）。**现行版允许变更集 = { ① `T79` 字号提升的级联；② 新增组件 `.sf-fm` 子树（悬浮菜单及其弹窗宿主）；③ §14 已批准的 locale 值变更引起的文案/宽度面（含本裁定⑫ 的 `profile` 值变更）}**（**三类**）。**验证法** = 反事实归因实验：回退 `T79` 字号 **且** 隐藏 `.sf-fm`（**撤除 gutter 一项作废**，因 gutter 已不存在）⇒ 差异集必须 ⊆ 允许变更集（余下差异须逐条可追溯到 §14 已批准的 locale 值变更，且每条须给「算术语义闭合」）；且差异集中不得存在与字号、与新组件、与 §14 已批准值变更 **三者均无关** 的几何/布局差异。
> **留痕**：v1.5（`T79` + `.sf-fm`）/ v1.7（+ gutter）/ v1.8（+ 第④类）措词**逐字保留于上方各行**；**本行为其就地更新，以本行为现行版**。**理由 = 裁定⑪**：`frontend/src/styles.css` 的 gutter 规则**撤销** ⇒ 该面在归因实验中**必然归零**（不再需要在测量期「撤除 gutter」）。
> **★ v1.9 附注（裁定⑫ · 第④类范围）**：**第④类「§14 已批准的 locale 值变更」的成员扩展** —— 原 = `shard`（`碎片市场→市场`）+ `home`（`首页→海鲜市场`）；**本裁定⑫ 加入 `profile`（`个人资料→我的`）**（并**删 `me` 键**）。凡由该三项值变更引起的桌面文案/宽度面差异，均属第④类允许集，**须给算术语义闭合**（闭合不成立 ⇒ 立缺陷）。

### 14.10 i18n 新增键逐键清单（四语同集 · 非 zh 三条译文标「待复核」）

> **口径**：四语**同集**（`Object.keys` 逐文件相同）；**非 zh 译文标「待复核」**（zh = 原口径）。**名称风格** = 承仓内既有（顶层扁平键用于 nav/菜单标签；camelCase 命名空间用于功能面）。

**A. 顶层扁平键（+5）**〔**★ v1.7 就地更正留痕**：原文 = 「（+5）」（`sell`/`messages`/`app`/`feedback`/`support`），Zang 裁定⑧ 补新增键 **`me`** 后为「（+6）」；本行为现行版，原文保留〕〔**★ v1.9 就地更正（裁定⑫）**：**删 `me` 键** ⇒ **本节计数回落为「（+5）」**（`sell`/`messages`/`app`/`feedback`/`support`）；「（+6）」及 `me` 行**保留为历史留痕**〕

| 键 | zh | en（待复核） | hk（待复核） | vn（待复核） |
|---|---|---|---|---|
| `sell` | 卖闲置 | Sell | 賣閒置 | Bán đồ |
| `messages` | 消息 | Messages | 訊息 | Tin nhắn |
| `app` | APP | App | APP | Ứng dụng |
| `feedback` | 反馈 | Feedback | 反饋 | Phản hồi |
| `support` | 客服 | Support | 客服 | Hỗ trợ |
| `me` | **我的** | **Me** | **我的** | **Tôi** |〔**★ v1.9 删除（裁定⑫）**：本键**一并移除**（避免与 `profile` 两键同义）；其语义**并入 `profile`**（值改 我的/Me/我的/Tôi，见 B 段）〕

> **★ v1.7 补登（Zang 裁定⑧ · 新增 `me`）**：新增顶层扁平键 **`me`**（zh「我的」/ en「Me」/ hk「我的」/ vn「Tôi」）—— **用途 = 底栏⑤（`/profile`）文案**（`frontend/src/shell/nav.js:21` 第五项 `labelKey` 改 `'me'`）；**`profile` 键值不动**（保持「个人资料」，其两个消费点 `Header.jsx:284`/`:460` 与 `r9-84-profile-entry.test.jsx` 均不受影响，见 §14.0 裁定⑧ / §14.5 ★①）。**A 段计数：+5 ⇒ +6**。**「一句话可改」**：若 Kevin 要全站统一为「我的」，则改 `profile` 值 + 改锚 r9-84（见 §14.0 裁定⑧）。
> **★ v1.9 就地更新（裁定⑫ · 删 `me` · 「一句话可改」已采）**：上条 v1.7 补登**逐字保留、已被 v1.9 取代** —— **① `me` 键删除**（四语同删）；**② `profile` 键四语值改** 我的/Me/我的/Tôi；**③ `nav.js` 第五项 `labelKey` 回 `'profile'`**；**④ 改锚 `r9-84-profile-entry.test.jsx` 等断言**（Kong 执行，见 §14.5 第 37–40 行）。**A 段计数：+6 ⇒ +5（回原文）**。**上一轮标注的「一句话可改」选项（上句） = 已被本裁定采为现行版**（§14.0 裁定⑫ ⑤）。
> **★ v1.9 取代声明（裁定⑫ · 「`profile` 键值不动」面）**：上条 v1.7 补登中「**`profile` 键值不动**（保持「个人资料」…）」的结论**已被 v1.9 取代**（**改前原文逐字保留**）；**现行版 = `profile` 键四语值改 我的/Me/我的/Tôi**（原值 个人资料/Profile/個人資料/Hồ sơ 见 B 段留痕）。

**B. 既有键「值」变更（+0 键 · 改 3 值）**〔**★ v1.6 就地更正留痕**：原文 = 「（+0 键 · **改 1 值**）」，Zang 裁定⑦ 补 `home` 后为「**改 2 值**」（`shard` + `home`）；本行为现行版〕〔**★ v1.9 就地更正（裁定⑫）**：**补第 3 值 `profile`** ⇒ 本行现行版 = **「改 3 值」（`shard` + `home` + `profile`）**；「改 2 值」保留为历史留痕〕

| 键 | zh | en（待复核） | hk（待复核） | vn（待复核） | 留痕 |
|---|---|---|---|---|---|
| `shard` | **市场** | **Market** | **市場** | **Chợ** | 原值：`碎片市场` / `Shard Market` / `碎片市場` / `Chợ mảnh`（**全站统一称谓 ⇒ 桌面顶栏同键同步显示「市场」**） |
| `home` | **海鲜市场** | **Seafood Market** | **海鮮市場** | **Chợ hải sản** | 原值：`首页` / `Home` / `首頁` / `Trang chủ`。**留痕：原写 首页，已由 v1.6 按 Zang 裁定⑦ 与原值消费点唯一性（`nav.js:15`）更正**（底栏①文案 = Kevin 指定「海鲜市场」⇒ **与 `siteTitle` 品牌口吻一致**；**全站统一称谓 ⇒ 任一 `t('home')` 消费面（现取唯一 = `nav.js:15` 底栏①）同步显示「海鲜市场」**；**值变更 = +0 键**） |
| `profile`（**★ v1.9 新增 · 裁定⑫**） | **我的** | **Me** | **我的** | **Tôi** | 原值：`个人资料` / `Profile` / `個人資料` / `Hồ sơ`。**留痕：原写 个人资料（v1.7 裁定⑧ 曾以「新增 `me` 键 + `profile` 值不动」承接）**；**本裁定⑫ 转向「`profile` 值全站统一」**（并**删 `me` 键**）⇒ 消费面 `frontend/src/shell/nav.js`（底栏⑤）· `frontend/src/components/Header.jsx:284`（桌面下拉）· `:460`（移动面板）**同步显示「我的」**；**值变更 = +0 键**；**断言改锚**见 §14.5 第 37 行 |

**C. 新占位页命名空间 `messagesPage`（+4）**

| 键 | zh | en（待复核） | hk（待复核） | vn（待复核） |
|---|---|---|---|---|
| `messagesPage.title` | 消息 | Messages | 訊息 | Tin nhắn |
| `messagesPage.empty` | 暂无消息 | No messages yet | 暫無訊息 | Chưa có tin nhắn |
| `messagesPage.xPlaceholder` | X（推特）私信 · 接驳位 | X (Twitter) DM · placeholder | X（推特）私訊 · 接駁位 | Tin nhắn riêng X (Twitter) · vị trí chờ |
| `messagesPage.xNote` | 该区域将用于接入 X（推特）私信，本轮为占位 | Reserved for X (Twitter) DM; placeholder for now | 該區域將用於接入 X（推特）私訊，本輪為佔位 | Khu vực này sẽ dùng để kết nối tin nhắn X (Twitter), hiện là vị trí chờ |

**D. 弹窗命名空间 `appModal`（+4）**

| 键 | zh | en（待复核） | hk（待复核） | vn（待复核） |
|---|---|---|---|---|
| `appModal.title` | 下载 APP | Get the App | 下載 APP | Tải ứng dụng |
| `appModal.qrPlaceholder` | 二维码占位 | QR code placeholder | 二維碼佔位 | Vị trí mã QR |
| `appModal.downloadHint` | 扫码下载（占位） | Scan to download (placeholder) | 掃碼下載（佔位） | Quét mã để tải (vị trí chờ) |
| `appModal.close` | 关闭 | Close | 關閉 | Đóng |

**E. 弹窗命名空间 `feedbackModal`（+4）**

| 键 | zh | en（待复核） | hk（待复核） | vn（待复核） |
|---|---|---|---|---|
| `feedbackModal.title` | 反馈 | Feedback | 反饋 | Phản hồi |
| `feedbackModal.formPlaceholder` | 反馈表单占位（暂不提交） | Feedback form placeholder (not submitted) | 反饋表單佔位（暫不提交） | Biểu mẫu phản hồi (chưa gửi) |
| `feedbackModal.submitNote` | 本轮仅占位，不落库 | Placeholder only this round | 本輪僅佔位，不入庫 | Chỉ là vị trí chờ, không lưu |
| `feedbackModal.close` | 关闭 | Close | 關閉 | Đóng |

**F. 弹窗命名空间 `supportModal`（+3）**

| 键 | zh | en（待复核） | hk（待复核） | vn（待复核） |
|---|---|---|---|---|
| `supportModal.title` | 客服 | Support | 客服 | Hỗ trợ |
| `supportModal.contactPlaceholder` | 联系方式占位 | Contact placeholder | 聯絡方式佔位 | Vị trí liên hệ |
| `supportModal.close` | 关闭 | Close | 關閉 | Đóng |

> **计数影响（Kong 落地后）**：顶层 `119 ⇒ 128`（+5 叶 +4 命名空间）；拍平 `1050 ⇒ 1070`（+20 叶）；四语节点 `4200 ⇒ 4280`。**「四语键集逐文件相同」硬断言**（`theme-shell-isomorphism.test.jsx:261-283`）= **对称新增 ⇒ 自动仍成立**；**按键计数断言**（§14.5 第 15–26 行）= **必须改锚**。**★ v1.6（Zang 裁定⑦）**：**值变更 2 键（`shard` + `home`）= +0 键** ⇒ 上列计数（顶层 `119⇒128` / 拍平 `1050⇒1070` / 四语节点 `4200⇒4280`）**逐字不变**（增量全部来自 +20 新增键；**`home` 值变更不改任何键计数**）。 **★ v1.7（Zang 裁定⑧ · 新增 `me` 键）**：**实取计数** = 顶层 `119 ⇒ 129`、拍平 `1050 ⇒ **1071**`、四语节点 `4200 ⇒ 4284`；**§14.5 第 15–26 行「按键计数断言」新值同步为 top `129` / flat `1071` / nodes `4284`**。**留痕（与补丁单预告的差异）**：补丁单预告「拍平 `1050⇒1072`」**与盘上实测不符** —— 实测 **加 `me` 后拍平 = `1070 + 1 = 1071`**（`me` 为 **1 个顶层扁叶键** ⇒ 拍平 +1，非 +2；且 `4284 = 1071 × 4` 自洽）⇒ **以盘上实测 `1071` 为准**；顶层 `129` / 四语节点 `4284` 与预告一致。**现取命令（可复跑）**：对 `frontend/src/locales/{zh,en,hk,vn}.json` 逐文件 `len(json)` = 顶层、递归叶计数 = 拍平、`× 4` = 四语节点（Kong 落地 `me` 后复跑应得 `129`/`1071`/`4284`）。
> **★ v1.9（裁定⑫ · `profile` 值全站统一 · 删 `me` 键）**：**键计数回落** —— **现行版 = 顶层 `128` / 拍平 `1070` / 四语节点 `4280`**（`4280 = 1070 × 4`）。**本册现取核验（2026-10-11）**：上轮 v1.8 基线现盘（含 `me`）= `129`/`1071`/`4284`；**本册 v1.9 现取**（Kong 同轮已落地裁定⑫：四语删 `me`、`profile` 值改 我的/Me/我的/Tôi、`nav.js` 第五项 `labelKey` 回 `profile`）= **`128`/`1070`/`4280`**（四语逐文件相同；`nodes = flat × 4` 自洽）。**现取命令（可复跑）**：对 `frontend/src/locales/{zh,en,hk,vn}.json` 逐文件 `len(json)` = 顶层、递归叶计数 = 拍平、`× 4` = 四语节点 ⇒ 现得 `128`/`1070`/`4280`。**§14.5 第 41 行「按键计数断言」的现行目标值 = top `128` / flat `1070` / nodes `4280`**（上轮 `129`/`1071`/`4284` 已被取代）。**值变更 3 键（`shard` + `home` + `profile`）= +0 键**（沿用 v1.6 口径；`profile` 值变更不改任何键计数）。**改锚**：既有 12 文件 + `v15-nav-floatmenu.test.jsx` 的计数期望须由 Kong 回改 `128`/`1070`/`4280`。
> **★ 替代关系（诚实登记）**：原计划新增键 `nearby` **已随「附近/`/nearby`」一并移除**（Kevin 当日变更）⇒ **不新增 `nearby`**。

---

## §15 ★★ 闲置物品（`item`）合并页 · 导航入口集合变更 · `reward` 概念移除（v1.10 · Kevin 2026-10-11 裁定 · 逐字采用）

> **本节性质（写死）**：① **只追加 + 就地留痕**（新节；**既有行不改写**，被取代者**逐字引于本节 §15.4** 并标「已被 v1.10 取代」）；② **本册只冻结口径 / 判据 / 键集处置**，不写实现（数值一律 `文件:行号 + 现取值`）；③ **姊妹册（同批交付）** = `docs/route-layer.spec.md` **v2.28 §38**（新路由家族 `/item` + 旧路由硬删 + 「前端概念名 ⇄ 后端路径名」映射表），**本册不重抄**；④ **本册 v1.10 未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**（由 Kong 落地）；⑤ 未实测项一律 `NOT_MEASURED` + 原因（§15.5）。**本册现取时点 = 2026-10-11 20:0x（基线 = HEAD `026b81a`）**；**同轮 Kong 正并发落地实现**（`frontend/src/pages/RewardPage.jsx` 删、`listings/ → item/` 等），**实现面读数不属本册**。

### 15.0 裁定来源（Kevin 2026-10-11 · 逐字采用 · 六条）

| # | 裁定（逐字） | 本册落点 |
|--:|---|---|
| ① | **范围 A = 只改前端**（后端 `/api/prize/*` 与 `prizes` 表名**不动**，册里登记映射） | 姊妹册 `route-layer.spec` v2.28 §38.3（本册只引） |
| ② | **路由 D = `/item` 列表 + `/item/:id` 详情 + 保留 `?id=` 兼容** | 姊妹册 §38.1（本册只引） |
| ③ | **旧路由直接删除，不做 301 / 不做重定向** | 姊妹册 §38.2 + 本节 §15.4 + `docs/OPEN-ITEMS.md` `F11` |
| ④ | **导航删「社区奖励」**（桌面左 nav → `[社区任务, 市场]`） | **`T87`**（入口集合 + 可达性 AC） |
| ⑤ | **奖励页与列表页合并**为同一个「闲置物品」列表页 | **`T89`**（合并页口径）；`T88`（首页入口改挂 `/item` 保可达） |
| ⑥ | （配套）**旧链接硬删后旧收藏会 404 —— Kevin 已知情并裁定不用 301** | 姊妹册 §38.2 + `docs/OPEN-ITEMS.md` `F11` |

### 15.1 规则条文（`T87`–`T90`）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T87** | 【本册裁定】**导航入口集合变更**：桌面左 nav **删「社区奖励」** —— `frontend/src/components/Header.jsx` 的 `menuItems`（现取 `:124`–`:129`：`[{path:'reward',label:t('reward')}, {path:'task',label:t('task')}, {path:'exchange',label:t('shard')}, …(admin) ]`）⇒ **`[任务, 市场]`**（`[{'task'}, {'exchange'}]`，逐字 = 裁定④）；**底栏（`shell/nav.js` 五项）第 3 格「卖闲置」指向由 `/listing/new` 改 `/item/new`**（`nav.js:22` 现取 `path: 'listing/new'`；**`key` / `labelKey` = `sell` 逐字不动** ⇒ 标签仍 `t('sell')` = 「卖闲置」）。 | `frontend/src/components/Header.jsx:124-129`（桌面左 nav）· `frontend/src/shell/nav.js:22`（底栏③）· `frontend/src/App.jsx`（旧 `/reward`、`/listing/new` 路由删，见姊妹册 §38.2） | **★ 可达性 AC（硬判据 · 写死）**：**各导航面（桌面左 nav ∪ 底栏 ∪ 移动汉堡面板 ∪ 悬浮菜单 ∪ 首页 / 各页内入口）⊇ 全部对外页面路由**，**差集 = 0**（与 `frontend-parity-acceptance`「改『导航 / 入口集合』类改动」第 2 条**同源**）。**「无重复」与「可达性」两条并列**；**`T76` 去重排除集须按新集合重算**（`reward` 项已删；**原本因「与底栏重复」被排除、在新集合里已不再重复的项 ⇒ 必须恢复**，否则那一档**彻底无入口**而「无重复」类断言**照样全绿**）。 |
| **T88** | 【本册裁定】**首页入口改挂 `/item` 以保可达**：`frontend/src/pages/HomePage.jsx` 现取三处 `/reward` 目标（`:188` `navigate(buildLocalizedPath(lang, '/reward'))` · `:216` `<Link to={buildLocalizedPath(lang, '/reward')}>`（`homePage.browseRewards`）· `:262` `<Link to={buildLocalizedPath(lang, '/reward')}>`（`homePage.featuredRewards`））⇒ **目标改 `/item`**；**文案键与值本轮不改**（`homePage.browseRewards` = 「查看奖励」/ `homePage.featuredRewards` = 「精选奖励」⇒ 见 `T90` 留表）。 | `frontend/src/pages/HomePage.jsx:188 / :216 / :262` | **这是「删「社区奖励」后功能可达」的唯一承接** ⇒ `T87` 可达性 AC 的「差集 = 0」由本条兑现；**若首页入口漏改 ⇒ 差集 ≠ 0 ⇒ 判负**。　**★ v1.11 回写（D5 · 已知口径 · 非缺陷）**：合并页积分展示（`data-sf-m="home-my-points"` · 现取 `frontend/src/pages/HomePage.jsx:234`）**仅登录态渲染** —— 实现为 `{isAuthenticated && (<Card … data-sf-m="home-my-points">…)}` ⇒ **未登录整块不渲染**（与「未登录不展示个人资产」同口径）⇒ **登记为已知设计口径，不作为缺陷**。 |
| **T89** | 【本册裁定】**合并页口径**（`/item` 列表 = 合并页）：主体 = **闲置物品列表**（现 `frontend/src/pages/listings/ListingsPage.jsx` 的 `data-sf-m="listing-feed-layout"`〔**★ v1.11 回写 · D3**：该锚**已不存在**（随合并落 `home-*`）⇒ **现取列表主体锚 = `data-sf-m="home-item-list"`**（`frontend/src/pages/HomePage.jsx:212`）〕面）**＋ 我的订单**（同页侧栏 `data-sf-m="listing-orders"`）；**并入积分展示**（现 `RewardPage` 的「我的积分」族）；**并入分类筛选 —— 但「能筛才留」**；**领取 / 兑换类一律移除**。 | 合并页 = Kong 落地（建议落 `frontend/src/pages/item/`）；积分展示并入；`frontend/src/components/ClaimRewardModal.jsx` 移除 | **① 「能筛才留」判据（**v1.11 就地更正** · 写死）**：分类筛选**在服务端或客户端侧任一能提供筛选依据时保留**（判据 = **依据已取回的字段**；**本册不发明筛选参数**）—— **服务端**：`GET /api/prize/all`（`backend-ts/src/index.ts:535`）**仍只接** `skip` / `limit`（`DatabaseService.listPrizes(skip, limit)`，**无分类 / 关键字参数**）；**客户端侧**：**Kong 实测**该口**返回字段**含 `points` / `gift_limit` / `time_end`，且 `GET /api/prize-item`（`index.ts:880`）给**已兑换集** ⇒ **客户端侧筛可行** ⇒ **三档分类筛选均保留**：**限量版（`limited`）** · **高价值（`points > 5000`）** · **已兑换（依 `/api/prize-item` 集）**。**改前字面（已被 v1.11 就地更正）逐字见 §15.4**。**② 领取 / 兑换类一律移除（依据后端恒 410 `CLAIM_RETIRED`）**：`index.ts:1003` `CLAIM_RETIRED_REASON='CLAIM_RETIRED'`（`:1004` ref_id `/api/task-progress/claim/:jID`）⇒ 前端**不得**保留领取 / 兑换按钮、弹窗、Tab（现 `ClaimRewardModal.jsx` + `RewardPage.jsx:243` 的 `claimRetiredNotice`「已下线」占位 = **过渡态** ⇒ 合并后**整块移除**，键去向见 `T90`）。 |
| **T90** | 【本册裁定】**i18n 键集处置（删 / 改 / 留 · 逐条）**：① **`listings.*`（37 子键）键名改 `item.*`**（顶层命名空间改名，**子键名逐字不变**）；② **`reward*` 一族按「删 / 改 / 留」逐条处置**（= §15.2）；③ **`adminNav` / `adminRewards` / `dashPage` / `adminSiteText` / `jobs.reward` / `ledger.kind.*` 一律不动**。 | `frontend/src/locales/{zh,en,hk,vn}.json`（四语**同集**、逐文件相同） | **★ 合并后四语键集「新计数基线」= 待 Kong 实测后由本册（Jing）现取回写（不得拄推定值）**：现取基线 = **顶层 `128` / 拍平 `1070` / 四语节点 `4280`**（见 §14.10 尾）；**键名改（`listings.*`⇒`item.*`）= +0 键**（不改计数）；**删键（`reward*` 删除项）= −N 键/语**。**四语键集「逐文件相同」硬断言**（`theme-shell-isomorphism.test.jsx:261-283`）= 对称增删 ⇒ **自动仍成立**；**按键计数断言（12 文件）= 必须改锚**（见 §15.3 #11）。 |

### 15.2 i18n 删 / 改 / 留表（现取 · 基线 = HEAD `026b81a`）

**A. 键名改（+0 键 · 37 子键 · 顶层 `listings` ⇒ `item`）** —— 子键名逐字不变、**值全部不动**、四语同改：

| # | 旧键名 | 新键名 | zh 现值（现取 · 逐字） | 处置 |
|--:|---|---|---|---|
| 1 | `listings.line` | `item.line` | 商品线 | 键名改（**值不动**） |
| 2 | `listings.list` | `item.list` | 商品列表 | 键名改（**值不动**） |
| 3 | `listings.listNote` | `item.listNote` | 以下为在售商品，点开可查看详情与库存。 | 键名改（**值不动**） |
| 4 | `listings.publish` | `item.publish` | 上架商品 | 键名改（**值不动**） |
| 5 | `listings.publishNote` | `item.publishNote` | 上架后商品先是草稿状态，上架成功后买家才能购买。 | 键名改（**值不动**） |
| 6 | `listings.publishOk` | `item.publishOk` | 商品已上架 | 键名改（**值不动**） |
| 7 | `listings.listed` | `item.listed` | 已上架 | 键名改（**值不动**） |
| 8 | `listings.statusLabel` | `item.statusLabel` | {draft:草稿, listed:已上架, delisted:已下架, frozen:…}（嵌套对象） | 键名改（**值不动**） |
| 9 | `listings.listedFail` | `item.listedFail` | 已创建但上架状态迁移失败 | 键名改（**值不动**） |
| 10 | `listings.detail` | `item.detail` | 商品详情 | 键名改（**值不动**） |
| 11 | `listings.title` | `item.title` | 商品标题 | 键名改（**值不动**） |
| 12 | `listings.price` | `item.price` | 标价 | 键名改（**值不动**） |
| 13 | `listings.priceUnit` | `item.priceUnit` | 单价 | 键名改（**值不动**） |
| 14 | `listings.priceRoleNote` | `item.priceRoleNote` | 标价由卖方自行填写，平台不会代改价格。 | 键名改（**值不动**） |
| 15 | `listings.priceServerNote` | `item.priceServerNote` | 购买金额由平台统一结算，无需填写价格或收款方。 | 键名改（**值不动**） |
| 16 | `listings.stock` | `item.stock` | 库存 | 键名改（**值不动**） |
| 17 | `listings.stockNote` | `item.stockNote` | 退款时只退还款项，库存不会自动恢复。 | 键名改（**值不动**） |
| 18 | `listings.cid` | `item.cid` | 币种编号 | 键名改（**值不动**） |
| 19 | `listings.cidNote` | `item.cidNote` | 币种编号请手动填写；社区积分 $ 填 1。 | 键名改（**值不动**） |
| 20 | `listings.description` | `item.description` | 商品说明 | 键名改（**值不动**） |
| 21 | `listings.status` | `item.status` | 状态 | 键名改（**值不动**） |
| 22 | `listings.refresh` | `item.refresh` | 刷新 | 键名改（**值不动**） |
| 23 | `listings.empty` | `item.empty` | 暂无商品 | 键名改（**值不动**） |
| 24 | `listings.myOrders` | `item.myOrders` | 我的商品订单 | 键名改（**值不动**） |
| 25 | `listings.myOrdersEmpty` | `item.myOrdersEmpty` | 暂无购买记录 | 键名改（**值不动**） |
| 26 | `listings.ordersNote` | `item.ordersNote` | 这里只显示你作为买家、已经付款的订单。 | 键名改（**值不动**） |
| 27 | `listings.listingId` | `item.listingId` | 商品编号 | 键名改（**值不动**） |
| 28 | `listings.buy` | `item.buy` | 立即购买 | 键名改（**值不动**） |
| 29 | `listings.buyOk` | `item.buyOk` | 购买成功 | 键名改（**值不动**） |
| 30 | `listings.buyNote` | `item.buyNote` | 购买金额以平台结算为准；重复点击不会重复扣款。 | 键名改（**值不动**） |
| 31 | `listings.quantity` | `item.quantity` | 数量 | 键名改（**值不动**） |
| 32 | `listings.refund` | `item.refund` | 退款 | 键名改（**值不动**） |
| 33 | `listings.refundOk` | `item.refundOk` | 已退款 | 键名改（**值不动**） |
| 34 | `listings.refundNote` | `item.refundNote` | 只有卖家可以发起退款，请填写订单号。 | 键名改（**值不动**） |
| 35 | `listings.refundStockNote` | `item.refundStockNote` | 退款只退还款项，商品库存不会恢复。 | 键名改（**值不动**） |
| 36 | `listings.orderId` | `item.orderId` | 订单号 | 键名改（**值不动**） |
| 37 | `listings.refundNeedId` | `item.refundNeedId` | 请先填订单号 | 键名改（**值不动**） |

> **★ 旁证（现取）**：`frontend/src/locales/{zh,en,hk,vn}.json` 逐文件 `len(d['listings'])` = **37**；`item` 顶层键**现取 = 不存在**。**键名改 = +0 键**（顶层键数不变、拍平叶数不变）⇒ **不影响键计数**。

> **★ 勘误（2026-10-19 · 本表第 18 / 19 行「值不动」作废 · 以本段为准）**：**旧字面逐字保留** —— 第 19 行「币种编号请手动填写；社区积分 $ 填 1。」= **v1.10 时点事实**（当时 `cid` 为手填数字，该句成立）；**Kevin 2026-10-19 指令**「在发布商品的时候，【币种编号】一栏，不要输入编号，而是要在下拉框中选择币种。」⇒ **该句与第 18 / 19 行的「键名改（值不动）」口径自本勘误起作废 · 以本段为准**。**现行口径（写死）**：① `item.cid` / `item.cidNote` **只改值、键数不变**（四语 zh / en / hk / vn 同改；键名不增不减）；② `item.cidNote` **不得再含「手动填写 / 手填」语义**（该语义随数字输入框形态下线）；③ **字段形态（可判负）** = `/item/new` 币种字段**必须是 `<select data-sf-m="item-select-cid">`**、**旧钩子 `item-input-cid` 不得存在**；选项文本 = `symbol · name`（**不显示编号**）；默认 `$`（cid 1）；列表加载失败或为空 ⇒ 仅 `$` 一项且**表单仍可提交**；提交 `cid` 仍为数字、`POST /api/listing` 形状一字不变；④ `jobs.cid` / `jobs.cidNote`（发布任务页）**本单不动**。**正典 = 姊妹册 `docs/route-layer.spec.md` v2.37 §47.3 / §47.4**（判负清单 §47.6 #7–#11 / #14 / #15）。

> **★ 追加勘误（2026-10-19 · 第二单「发布任务页（悬赏）币种同改下拉」· 本表 `jobs.cid*` **零命中** · 以本段为准）**：**① 检索式与零命中（写死）** —— `grep -n 'jobs\.cid\|jobs\.cidNote' docs/design/design-system.spec.md` ⇒ 命中仅出现在**版本头两行 + 上一段勘误的叙述**；**A 表体（第 1389–1408 行）`grep -c 'jobs\.'` = 0** ⇒ **本表无 `jobs.cid` / `jobs.cidNote` 行**，故本单**无行可勘**（不虚构行号、不动表体）。**② 旧句处置** —— 上一段勘误第 ④ 项「`jobs.cid` / `jobs.cidNote`（发布任务页）**本单不动**」**自本段起作废 · 以本段为准**（旧句逐字保留，不删不改）。**③ 现行口径（写死 · 可判负）** —— `jobs.cid` / `jobs.cidNote` **只改值、键数不变**（四语 zh / en / hk / vn 同改；现取键集基线 `128 / 1106 / 4424` 逐字不动）；`jobs.cidNote` **不得再含手填 / 编号提示语义**；`/task/new` 币种字段**必须是 `<select data-sf-m="jobs-select-cid">`**、**旧钩子 `jobs-input-cid` 不得存在**；选项文本 = `symbol · name`（**不带编号**）；默认 `$`（cid 1）、cid 1 不在列表 ⇒ 选首项；加载失败 / 空列表 ⇒ 仅 `$` 一项且**表单仍可提交**；提交 `cid` 仍为数字、`POST /api/job` 形状一字不变。**④ 页面对称** —— `/task/new` 与 `/item/new` 同形同读口（`GET /api/currencies`），差异仅钩子前缀与页面壳类（`.sf-jobs-*` / `.sf-item-*`）。**⑤ 正典** = 姊妹册 `docs/route-layer.spec.md` **v2.38 §47.8**（判负清单 §47.8.5 #16–#25）；**本册零 token 变更 / 零几何变更 / 零新 `T` 规则**。

**B. `reward*` 一族 —— 删 / 改 / 留（逐条 · 现取消费点）**

| 组 | 键（现取） | 处置 | 现取依据 / 消费点 |
|---|---|---|---|
| 顶层 | `reward`（«社区奖励»） | **删** | 唯一消费点 = `frontend/src/components/Header.jsx:125` 桌面左 nav（nav 项删除 ⇒ 键无消费） |
| 顶层 | `rewardCard`（`limited` / `timeLimited` / `insufficient` / `claimNow`，4 叶） | **删** | 消费点 = `frontend/src/components/reward/RewardCard.jsx:72 / :137 / :157 / :160`（领取态卡片） |
| 顶层 | `rewardPage`（整族 · 现取 24 叶） | **删**（**仅「积分展示」并入 ⇒ 见「改」**） | 消费点 = `frontend/src/pages/RewardPage.jsx`（奖励中心页；整页随合并移除） |
| 顶层 | `rewardsList`（«社群福利»） | **删** | 现取 = 无产品消费点（仅 locale）⇒ 随奖励面归零 |
| 顶层 | `chooseReward` / `confirmChooseReward` / `claimReward` / `successClaimReward` / `tasksToClaimReward` | **删** | 领取 / 兑换面（依据后端恒 410 `CLAIM_RETIRED`） |
| 顶层 | `claimRewardModal`（`loadProgressFailed` / `lore`） | **删** | 消费点 = `frontend/src/components/ClaimRewardModal.jsx:83` |
| 顶层 | `claimRetiredNotice`（«该领取入口已下线…»） | **删**（过渡态占位；合并后整块移除） | 消费点 = `frontend/src/components/ClaimRewardModal.jsx:86` + `RewardPage.jsx:243`；**断言影响见 §15.3 #13** |
| 嵌套 | `homePage.noRewards` / `homePage.rewardAlreadyClaimed` / `homePage.rewardOutOfStock` | **删** | 消费点 = `HomePage.jsx:173 / :178`（领取态分支，随领取面移除） |
| 嵌套 | `common.claimReward`（«领取奖励»）/ `common.loadingRewards`（«正在加载奖励…»） | **删** | 领取面 |
| 嵌套 | `profilePage.redeemedRewards`（«已兑换奖励»） | **删** | 兑换记录面 |
| **改** | `rewardPage.myPoints` 等「积分展示」叶 ⇒ **并入 `item.*`**（键名改 + 值不动） | **改** | `T89` 合并页**并入积分展示**；具体叶由 Kong 现取后并入（**本册不发明叶名 / 值**） |
| **留** | `homePage.browseRewards`（«查看奖励»）/ `homePage.featuredRewards`（«精选奖励»） | **留**（值不动） | `T88`：**文案键与值本轮不改**（仅链接目标改 `/item`） |
| **留** | `adminNav.*`（含 `rewards` / `rewardsDesc`） | **留**（不动） | 后台左边 nav（`frontend/src/components/layout/AdminLayout.jsx:55-58`） |
| **留** | `adminRewards.*`（现取 42 叶） | **留**（不动） | 后台奖品管理页 |
| **留** | `dashPage.*`（含 `errRewardStats` / `linkRewardsDesc` / `statRewards`，现取 58 叶） | **留**（不动） | 后台仪表盘 |
| **留** | `adminSiteText.*`（含 `baseRewardBatt` / `rewardLevels` / `streakDay7RewardBatt`，现取 40 叶） | **留**（不动） | 站点文案后台 |
| **留** | `jobs.reward`（«酬金»） | **留**（不动） | 招工酬金（`ledger`/招工线面；与「闲置物品」概念无关） |
| **留** | `ledger.kind.*`（含 `invite_first_task_reward`，现取 24 叶） | **留**（不动） | 账本枚举标签（**枚举值域现取 · 不得随前端改名**） |
| **留** | `adminSettings.labelRewardCooldown` / `adminArbitrationReview.colReward` | **留**（不动） | 后台设置 / 仲裁列 |

> **★★ v1.11 回写 · D1（口径以「消费点在场 ⇒ 保留」为准 · 逐字采用 · 2026-10-11）**：**上表标「删」的键一律改判「保留」** —— **强删会渲染裸键名**（本仓无缺键回退，见 §6 / `seafood-platform`）。**判据 = 非测试消费点是否在场**：**在场 ⇒ 保留**（**保留集** = `rewardCard.limited`/`timeLimited`/`insufficient`/`claimNow`〔`RewardCard.jsx:76/:141/:164/:167`〕· `common.claimReward`〔`ClaimRewardModal.jsx:57` + `TaskPage.jsx:141`〕· `claimRewardModal.lore`〔`ClaimRewardModal.jsx:83`〕· `claimRetiredNotice`〔`ClaimRewardModal.jsx:86`〕）；**不在场 ⇒ 归「待清理批次」**（**本轮不删 · 见下 B″**）。**上表「删」字面逐字保留（未改写）· 标「已被 v1.11 回写取代」。**
> **★ `reward*` 删除面 = 前端「奖励中心 / 领取 / 兑换」；留面 = 后台（`adminNav` / `adminRewards` / `dashPage` / `adminSiteText` / `adminSettings` / `adminArbitrationReview`）+ 账本枚举（`ledger.kind.*`）+ 招工酬金（`jobs.reward`）** —— **留面一律不动**（逐字 = 裁定①③）。
> **★ 计数（诚实边界）**：**删键合计 = −N 键/语（N = 上表「删」项合计；本册不拄推定值）**；**现取基线 = 顶层 `128` / 拍平 `1070` / 四语节点 `4280`**；**新基线待 Kong 落地后由本册现取回写**（登记 `N34` + `docs/OPEN-ITEMS.md` `F12`）。　**★ v1.11 就地更正（回写）**：新基线 = 顶层 `127` / 拍平 `1053` / 四语节点 `4212`（**Kong 实测 · 工作区、未提交**；见本 §15.2 **C** 段）。

**B′. `reward` 文案键保留（v1.11 就地更正 · 裁定登记）** —— 上表标「**删**」的**三键**改「**留**」：

| # | 键（现取） | 上表处置 ⇒ v1.11 处置 | 依据（现取消费点） |
|--:|---|---|---|
| 1 | `common.claimReward`（«领取奖励»） | **删 ⇒ 留** | `frontend/src/components/ClaimRewardModal.jsx:57` + `frontend/src/pages/TaskPage.jsx:141`（`t('common.claimReward')`）；删则**渲染裸键名** |
| 2 | `claimRewardModal.*`（`loadProgressFailed` / `lore`，2 叶） | **删 ⇒ 留** | `frontend/src/components/ClaimRewardModal.jsx:83`（`:86` 同族）；同 #1 |
| 3 | `rewardCard.claimNow`（«立即领取»） | **删 ⇒ 留** | `frontend/src/components/reward/RewardCard.jsx:167`；同 #1 |

> **★ 口径（写死）**：**reward 概念已从前端用户路径移除；已退役的领奖面文案键保留，登记为待清理（`docs/OPEN-ITEMS.md` `F13`）**。**依据** = 上列键**仍被 `TaskPage` / `ClaimRewardModal` / `RewardCard` 消费** —— **只要消费点在场，删键即渲染裸键名**（本仓无缺键回退，见 §6 / `seafood-platform`）⇒ **保留**、**不删**，待领奖面（组件）真正退役后一并清理。**上表「删」字面逐字保留、标「已被 v1.11 就地更正」。**
> **★ 现取消费点补充（诚实边界 · 2026-10-11 现取）**：`rewardCard.*` 的另三叶 **`limited` / `timeLimited` / `insufficient`**（`frontend/src/components/reward/RewardCard.jsx:76 / :141 / :164`）**亦仍有消费点在场**（`RewardCard` 现取仍由 `frontend/src/pages/HomePage.jsx:311` 渲染；`ClaimRewardModal` 现取仍由 `frontend/src/pages/TaskPage.jsx:390` 渲染）⇒ 按**同一口径**（消费点在场 ⇒ 删则渲染裸键名），**完整保留集 = `common.claimReward` + `claimRewardModal.*`（2 叶）+ `rewardCard.*`（4 叶）**；其中 **`claimRewardModal.loadProgressFailed` 现取无非测试消费点**（**可疑残留**，待 Kong 对齐）。**本册按裁定面登记三键为主，并登记上述完整保留集**（**待与 Kong 对齐后收口**；`F13`）。

**B″. 待清理批次（已无任何非测试消费点的死键 · v1.11 回写 · D1 · **本轮不删**）**

> 判据 = **`grep` 全仓 `frontend/src`（排除 `/test/` 与 `locales/`）零消费点**（现取 · 2026-10-11 · 基线 = HEAD `54f906c`）。**以下 11 键全部在册、本轮一律不删**：

| # | 键（现取） | zh 现值（现取 · 逐字） | 处置 |
|--:|---|---|---|
| 1 | `reward`（顶层） | 社区奖励 | **本轮不删**（死键；nav 项已删 ⇒ 键无消费） |
| 2 | `rewardsList`（顶层） | 社群福利 | **本轮不删**（死键） |
| 3 | `tasksToClaimReward`（顶层） | 待领取奖励的任务 | **本轮不删**（死键） |
| 4 | `chooseReward`（顶层） | 选择奖励 | **本轮不删**（死键） |
| 5 | `confirmChooseReward`（顶层） | 确认选择此奖励？ | **本轮不删**（死键） |
| 6 | `successClaimReward`（顶层） | 奖励领取成功！ | **本轮不删**（死键） |
| 7 | `common.loadingRewards` | 正在加载奖励... | **本轮不删**（死键） |
| 8 | `homePage.noRewards` | 暂无可用奖励 | **本轮不删**（死键） |
| 9 | `homePage.rewardAlreadyClaimed` | 这个奖励你已经兑换过了 | **本轮不删**（死键） |
| 10 | `homePage.rewardOutOfStock` | 当前奖励库存不足 | **本轮不删**（死键） |
| 11 | `claimRewardModal.loadProgressFailed` | 加载任务进度失败 | **本轮不删**（死键；同族 `claimRewardModal.lore` 仍被消费 ⇒ 保留） |

> **★ 口径（写死）**：**本轮不删** —— **删则须重算 12 处「按键计数断言」基线**（§15.3 #14：top `128→127` 已是本版读数；再删 11 键 ⇒ top / flat / nodes 三读数与 12 文件的**前推注释同批改锚**）⇒ **另批清理**。**标「一句话可改」**（11 键**四语对称删** + 12 文件改锚，一次性）。登记 `docs/OPEN-ITEMS.md` **`F13`**；与 `N33` / `F10`（内部标识）同族。<br>**★ 保留集 vs 死键集（现取对账）**：**保留集 = 7 键**（`rewardCard` 4 + `common.claimReward` + `claimRewardModal.lore` + `claimRetiredNotice`）· **死键集 = 11 键**（上表）⇒ **reward 族「删」净判定 = 0**（本轮**无键被删**）。

**C. 四语键集新基线（v1.11 回写 · **Kong 实测 · 工作区、未提交**）**

| 读数 | 改前基线（v1.10 现取） | **新基线（Kong 实测）** | 命令（可复跑） |
|---|---|---|---|
| 顶层键 | `128` | **`127`** | 逐文件 `len(json)` |
| 拍平叶 | `1070` | **`1053`** | 递归叶计数 |
| 四语节点 | `4280` | **`4212`**（`= 1053 × 4`） | 拍平 `× 4` |

> **★ 口径**：读数 = **Kong 实测（工作区、未提交）**（对 `frontend/src/locales/{zh,en,hk,vn}.json` 逐文件；四语逐文件相同、`4212 = 1053 × 4` 自洽）。**净减**（对照 v1.10 基线）= **顶层 `−1` / 拍平 `−17` / 四语节点 `−68`**；其中 **`listings.*`⇒`item.*` 键名改 = +0 键**（不改计数）。**待提交后若有变再更正留痕**（**不拄推定值**）。**§15.3 #14「按键计数断言」新目标值 = top `127` / flat `1053` / nodes `4212`**（改前 `128`/`1070`/`4280` 已被取代）。登记 `docs/OPEN-ITEMS.md` `F12`。

### 15.3 断言影响（逐条点名 · 现取 · 须由 Kong 改锚）

| # | 测试 `文件:行号` | 现取断言语义 | 影响 |
|--:|---|---|---|
| 1 | `theme-shell-isomorphism.test.jsx:96` | 底栏 `href` 字面 `['/', '/exchange', '/listing/new', '/messages', '/profile']` | **必须改锚**：`'/listing/new'` ⇒ `'/item/new'`（四语前缀档同法，`:96` 同 `v15-nav-floatmenu.test.jsx:102-105`） |
| 2 | `theme-shell-isomorphism.test.jsx:100` | 桌面左 nav `.nav-link[href]` 字面 `['/reward', '/task', '/exchange']` | **必须改锚**：⇒ `['/task', '/exchange']`（删 `/reward`；`T87`） |
| 3 | `theme-shell-isomorphism.test.jsx:147-150` | `navPathInLang(SHELL_NAV_ITEMS[1], …)` = `/exchange`；`isNavItemActive('/hk/listing/new', SHELL_NAV_ITEMS[2])` | **必须改锚**：`'/hk/listing/new'` ⇒ `'/hk/item/new'` |
| 4 | `theme-shell-isomorphism.test.jsx:132-136 / :142` | `SHELL_NAV_ITEMS` 每项 `route` 须在 `App.jsx` 出现、`labelKey` 须在四语 locale | **自动跟随**（按 `item.route` 动态断言；前提 = Kong 落 `/item/new` 路由 + `sell` 键保留） |
| 5 | `r9-84-profile-entry.test.jsx:211` | `expect(labels).toEqual([zh.reward, zh.task, zh.shard])`（桌面左 nav 文案） | **必须改锚**：⇒ `[zh.task, zh.shard]`（`T87`） |
| 6 | `fix-nav-langshell.test.jsx`（**31 处** `/listing` 字面 + 钩子 `data-sf-m="listing-card"`） | 卡片 `href` = `/en/listing/5`、发布 `.…/listing/listing/new` 判负原形、`buildLangPath('/listing', …)` | **必须改锚**：`/listing/5` ⇒ `/item/5`、`/listing` ⇒ `/item`、重复段判负原形 ⇒ `/item/item/5`；钩子名见 §15.4「内部标识」登记 |
| 7 | `listing-market.test.jsx`（**15 处** `/listing`） | `/api/listing*` 后端路径 + 页面挂载 `'/listing'` / `'/listing/1'` | **部分改锚**：**后端 `/api/listing*` 路径逐字不变**（姊妹册 §38.3 映射表）；**页面路径** `/listing*` ⇒ `/item*` |
| 8 | `listing-publish-redirect.test.jsx`（**24 处** `/listing`） | `navigate(root('/listing/' + id))` 等四条判负 | **必须改锚**：`/listing/<id>` ⇒ `/item/<id>`；`/listing/null` 判负 ⇒ `/item/null` |
| 9 | `lang-path.test.js`（**13 处** `/reward`） | 用例数据 `ROUTED_PATHS` / `STRIP_CASES` / `CANONICAL_CASES` 含 `/reward`、`/vn/reward/` | **必须改锚**：`/reward` ⇒ `/item`（纯字符串工具用例，逐处替换） |
| 10 | `lang-path-redirect.test.jsx`（**4 处** `/reward`） | 路由落点断言 | **必须改锚**：`/reward` ⇒ `/item` |
| 11 | `app-routes.test.jsx:19-21` | `vi.mock('../../pages/RewardPage', …)`（`reward page content`） | **必须改锚**：`RewardPage` 将被删 ⇒ mock 改指合并页（或删该 mock）；`listings` 相关 mock 同法 |
| 12 | `v15-nav-floatmenu.test.jsx:102-105 / :134 / :146` | 底栏 `href` 表（含 `/listing/new`、`/en/listing/new`） | **必须改锚**：⇒ `/item/new`（四语前缀档同法） |
| 13 | `i18n-violation-closeout.test.jsx:109-121` | `flatTables.zh.claimRetiredNotice` 含「已下线」、en 匹配 `retired\|no longer` | **必须改锚 / 删该段**：`claimRetiredNotice` 随合并**删除**（`T90` B 段）⇒ 该断言失去键〔**★★ v1.11 回写 · D2（原写「随合并删除」作废 · 逐字保留）**：`claimRetiredNotice` **实现保留且仍有消费点**（现取 `frontend/src/components/ClaimRewardModal.jsx:86` ⇒ 由 `TaskPage.jsx:390` 渲染）⇒ **不删**（口径同 D1：**消费点在场 ⇒ 保留**）⇒ 该断言**改锚续用、不删该段**〕 |
| 14 | **按键计数断言（12 文件）**：`s5-publish-headcount` · `s7-submissions-panel` · `s8-locale-key-coverage` · `s9-ledger-kind-closure` · `s19-participants-truth-source` · `s23-participants-headcount` · `r9-93-points-symbol` · `r9-96-dashj-copy` · `i18n-batch-b4a` · `i18n-batch-b4b` · `i18n-batch-b5` · `i18n-violation-closeout` | `top 128 / flat 1070 / nodes 4280`（+ 各文件前推注释） | **必须改锚**：新目标值 = **待 Kong 实测**（`T90`：`listings.*`⇒`item.*` = +0；`reward*` 删 = −N；**由本册现取回写**，登记 `N34`） |
| 15 | `r9-93-points-symbol.test.jsx` | 积分符号「$」面 + 计数（`:185-193`） | **必须改锚**（计数部分；符号面视合并页积分展示是否沿用「$」⇒ 待 Kong 现取） |
| 16 | `theme-shell-isomorphism.test.jsx:106-107` | `visibleNavItems(false/true)` key 集字面 | **视 `nav.js` key 集是否变**：`sell` **保留** ⇒ key 集**不变**（`['home','shard','sell','messages']` / `+['profile']`）⇒ **无需改锚**（`T87` 只改 `sell` 的 `path`/`route`） |
| 17 | `route-exchange-rename.test.jsx`（1 处 `/reward`） | `isNavItemActive('/reward', shardItem)` = `false` | **不影响**（该断言仍成立；`/reward` 只是不再被任何 nav 项指向） |
| 18 | `frontend/src/test/e2e/basic.spec.js` | `/reward` 字面（e2e） | **必须改锚**（非 unit 套件；由 Kong 定） |
| 19 | `p7e-tails-beta.test.jsx` / `i18n-content-wiring.test.jsx` / `p6-miscfix.test.jsx` / `p6-btn-impl2.test.js` / `i18n-batch-b4a/b4b/b5` | 含 `/reward` 或 `/listing` 字面（现取 `grep -rc`：5 / 7 / 4 / 4 / 1 / 3 / 3 行） | **逐处现取后改锚**（本册只点名；不代改） |

> **★ 计数口径**：`grep -rc -E "'/reward'|\"/reward\"|/listing" frontend/src/test` 现取总计 **77 行 / 16 文件**（top：`fix-nav-langshell` 31 · `listing-publish-redirect` 24 · `listing-market` 15 · `lang-path.test.js` 13）。**全部由 Kong 改锚；本册只做点名与判据**。

### 15.4 留痕（诚实登记 · 旧措词逐字保留 + 标「已被 v1.10 取代」）

- **★★ 本裁定推翻上几轮关于 `/listing*` 与底栏「卖闲置 → `/listing/new`」的指向**（route 侧留痕 = 姊妹册 §38.4）。**本册侧被取代的既有行（逐字保留 · 未改写）**：
    1. **§14.6 行 1**（`T80`）逐字：「`frontend/src/shell/nav.js:14-20` | `SHELL_NAV_ITEMS` = `[home,reward,task,shard,profile]`（icon `Home/Gift/Briefcase/Store/User`） | 改为 `[home(/,\u200bHome), shard(/exchange,\u200bStore), **sell(/listing/new,\u200bPlusCircle)**, messages(/messages,\u200bMessageCircle), profile(/profile,\u200bUser, requiresAuth)]` | `T80`」—— **⚠ 已被 v1.10 取代**：`sell` 目标 ⇒ **`/item/new`**。
    2. **§14.6 行 2**（`nav.js:4-13` 注释同步）—— **⚠ 已被 v1.10 取代**：注释里 `sell → path="listing/new"` ⇒ `path="item/new"`（`nav.js:10`）。
    3. **§14.5 行 3 / 行 5**（`.nav-link` 字面 / `SHELL_NAV_ITEMS[2]` 字面 `/listing/new`）—— **⚠ 已被 v1.10 取代**（见 §15.3 #2 / #3：桌面左 nav ⇒ `['/task','/exchange']`；`[2]` ⇒ `/item/new`）。
    4. **§14.7 判负行「桌面左 nav 未动」**逐字：「1440 档桌面 `nav a` 文案 = `[奖励,任务,市场]`」—— **⚠ 已被 v1.10 取代**：**现行版 = `[任务, 市场]`**（`T87`；`T76` 去重排除集须按新集合重算）。
- **★ 内部标识（CSS 类前缀 / `data-sf-m` 钩子）本轮不改名（登记为待统一项）**：`frontend/src/pages/listings/listings.css` 现取 `.sf-listings*` 类 **32 个**；`data-sf-m="listing-*"` 钩子 **45 个**（现取 `grep -oE 'data-sf-m="listing[a-z-]*"'` 去重）—— **纯内部标识**（不入 i18n、不进用户可见面）⇒ **本轮不改名**；登记 `N33` + `docs/OPEN-ITEMS.md` `F10`（**待统一项**）。
- **★★ v1.11 回写 · D3（内部标识实际净减 · 现取 · 基线 = HEAD `54f906c`）= 上条数字就地更新 + 留痕**：`data-sf-m="listing-*"` **唯一钩子 `46 → 39`**（**丢 8** = `listing-card` / `listing-feed-empty` / `listing-feed-hero` / `listing-feed-layout` / `listing-grid` / `listing-publish-link` / `listing-refresh` / `listing-thumb`；**增 1** = `listing-orders-section`；**判据 = 对 `026b81a` 现取差集**）；`.sf-listings*` **命中（全仓计次）`159 → 141`**（**唯一类仍 32**，见上条；**判据 ≠ 唯一类数**）；**首页（合并页）列表 / 筛选 / 积分 / 订单改用 `home-*` 钩子**（现取 6 个：`home-items` · `home-item-list`〔`:212`〕· `home-item-filter`〔`:290`〕· `home-my-orders`〔`:335`〕· `home-my-points`〔`:236`〕· `home-publish-link`）。**上条「45」为旧读数（已被取代 · 留痕）；「本轮不改名」待统一项不变**（登记 `N33` / `F10`）。
- **★ 旧链接硬删 ⇒ 404（无 301）**：`/reward`、`/listing`、`/listing/new`、`/listing/:listingId`（含四语前缀档）**不再匹配任何路由** ⇒ **旧收藏 / 外链 404**；**Kevin 已知情并裁定不用 301** ⇒ 登记 `N32` + `docs/OPEN-ITEMS.md` `F11`（**非缺陷，属已接受后果**）。
- **★★ v1.11 就地更正『`T89` ①「能筛才留」判据』（改前逐字保留 · 未改写）**：**改前**逐字 = 「**① 「能筛才留」判据（写死）**：分类筛选**仅在后端读口可提供筛选参数时保留** —— 现取 `GET /api/prize/all`（`backend-ts/src/index.ts:535`）只接 `skip` / `limit`（`DatabaseService.listPrizes(skip, limit)`），**无分类 / 关键字参数** ⇒ **若 Kong 判定「不可筛」⇒ 整块分类筛选移除**，**不保留纯前端假筛**；**本册不发明筛选参数**。」—— **⚠ 已被 v1.11 就地更正**：现口径 = 「**能筛才留（服务端或客户端侧，依据已取回的字段）**」；依据 = **Kong 实测** `GET /api/prize/all` **返回字段**含 `points` / `gift_limit` / `time_end` + `GET /api/prize-item` 给**已兑换集** ⇒ **客户端侧筛可行**、**三档保留**（改后字面见 §15.1 `T89` 行）。
- **★★ v1.11 就地更正『§15.2 B 的 `reward` 文案键处置』（改前逐字保留 · 未改写）**：**改前**处置 = **删**（`common.claimReward` / `claimRewardModal.*` / `rewardCard.claimNow`，见 §15.2 B 表对应行）—— **⚠ 已被 v1.11 就地更正**：现处置 = **留**（消费点仍在场，删则渲染裸键名；口径 = 「已退役的领奖面文案键保留，登记为待清理」，见 §15.2 **B′** + `docs/OPEN-ITEMS.md` `F13`）。
- **★ v1.11 四语键集基线就地更正**：**改前基线** = 顶层 `128` / 拍平 `1070` / 四语节点 `4280`；**现基线 = 顶层 `127` / 拍平 `1053` / 四语节点 `4212`**（**Kong 实测 · 工作区、未提交**；见 §15.2 **C**）。

### 15.5 未核实 / 登记（诚实清单 · 承接 N 序列）

- **N32**：**旧链接（`/reward`、`/listing*`）硬删后旧收藏 404** —— **Kevin 已知情并裁定不用 301** ⇒ **已接受后果（非缺陷）**；**未做**：真实旧链接命中率 / 404 落地形态（属实现面，`NOT_MEASURED`）。登记 `docs/OPEN-ITEMS.md` `F11`。
- **N33**：**内部标识待统一** —— CSS 类前缀 `sf-listings*`（现取 32 个）+ `data-sf-m="listing-*"` 钩子（现取 45 个）**本轮不改名**（纯内部标识、不进用户可见面、不入 i18n）⇒ 登记为**待统一项**（`docs/OPEN-ITEMS.md` `F10`）；**未做**：全仓 `sf-listings*` / `data-sf-m="listing-*"` 面是否另有别的消费点（如 e2e / 探针脚本）—— `NOT_MEASURED`。
- **N34**：**合并后四语键集「新计数基线」未定值** —— `T90`：键名改（`listings.*`⇒`item.*`）= **+0 键**；`reward*` 删 = **−N 键/语**（N 待定）⇒ **新基线须由 Kong 落地后由本册（Jing）现取回写**（**不得拄推定值**）。**现取基线 = 顶层 `128` / 拍平 `1070` / 四语节点 `4280`**。登记 `docs/OPEN-ITEMS.md` `F12`。　**★ v1.11 已回写**：新基线 = **顶层 `127` / 拍平 `1053` / 四语节点 `4212`**（**Kong 实测 · 工作区、未提交**；`= 1053 × 4` 自洽；见 §15.2 **C**）；**待提交后若有变再更正留痕**。
- **N35（可复用教训 · **源码 / 测试注释不得写「路径尾部 + 块注释起始二连」的通配字面**）**：**源码 / 测试注释里不得写**形如 `/api/prize/` 后**紧跟块注释起始符**（`/`＋`*`）**的通配路径字面** —— 仓内审计 / 测试脚本的**块注释剥离器**（现取 `frontend/scripts/p4z-i18nviol-global.mjs` 的 `codeOf`：**非贪婪块注释正则剥离**，用于扫描前 `:235` / 收口点核验 `:265`）会把该二连当成**块注释开始**，**静默吃掉后续代码直到下一个注释结束符**（**实测吞 ≈ 3.2 KB，含 `statusLabel` 查表点 ⇒ unknown-status 兜底断言变红**）。**正解 = 把通配尾改写为 `…` / `<x>` 形式**（如 `/api/prize/…`）—— **剥离逻辑本身正确**（误配由字面量写法触发），故 **不要去改那个脚本的剥离逻辑**（**超范围**）。**适用面** = 全部源码 / 测试注释（本仓已实测踩中一次）。
- **N36（产品观察登记 · Neng 实测 · 2026-10-11）= 合并页三档分类筛选在「当前真实数据」下均为空列表**：**Neng 现取** `GET /api/prize/all`（`backend-ts/src/index.ts:535`）：**8 条** · `points ≤ 200` · `gift_limit = time_end = 0` · 未登录无 `claimed`（`/api/prize-item` 需鉴权）⇒ **「限量版（`limited` = `gift_limit`/`time_end`）/ 高价值（`points > 5000`）/ 已兑换（`claimed`）」三档点开皆空**。〔**Jing 复核（诚实边界）**：prod `https://0xseafood.com/api/prize/all` 现取 = **1 行**（`VPN月卡` · `points=1`）· local dev `127.0.0.1:5788` 现取 = **24 行**（`points` 多为 `1–200`，一处夹具 `1e8`）⇒ **行数随库态浮动**；**定性结论稳定**：**无任何 `gift_limit`/`time_end > 0` 的行 ⇒「限量版」恒空**（本册现取三源一致）。〕**口径**：**高价值阈值 `points > 5000` 继承自既有 `mapRewardsForHome` 的 `rarity` 逻辑**（现取 `frontend/src/pages/HomePage.jsx:85`：`rarity: prize.points > 5000 ? 'epic' : prize.points > 2000 ? 'rare' : 'common'`；**非本单新发**）⇒ 登记为**待定项**（可选：**降阈** 或 **改分位口径**），**标「一句话可改」**；登记 `docs/OPEN-ITEMS.md` **`F14`**。
- **未实测（NOT_MEASURED）**：① 合并页几何 / 各档读数（属实现 + 验收面，本册只冻结口径）；② 可达性 AC 的**差集 = 0 实跑**（须在 Kong 落地后由 Neng 现取；本册只立判据）；③ 分类筛选「能筛才留」的最终裁决（须现取后端读口参数面后定）。**本册零代码 · 零迁移 · 零写入 · 零套件**（**Jing 复核 §15.5 `N36` 经只读 `GET`**；见 `N36`）。

---

## §16 ★★ v1.12 · 四条裁定落册：死键清理（`F13` → 执行中）· 内部标识改名（`F10` 已执行）· catch-all 提示页（新裁定 · `F11` 口径修正）· 主题图标 `T41` 语义（+ 两处渲染分叉教训 `N37`）（**本节只追加 · 依据 = Kevin 2026-10-11 四条裁定 · 逐字采用**）

> **本节性质（写死）**：① **只追加**（承 §13 / §14 / §15 体例）；② **零代码** —— 实现（`frontend/src/App.jsx` 内层 `<Routes>` 的 `<Route path="*">` · `frontend/src/locales/*.json` 的 3 新键 / 11 死键删 · `sf-listings*`→`sf-item*` / `data-sf-m="listing-*"`→`data-sf-m="item-*"` 改名 · 主题图标两处渲染）**一律归 Kong 同轮落地**，本册只承载**口径 / 登记 / 断言影响 / 未核实**；③ **未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**；④ **现取基线 = HEAD `ecbefd1`（= 实现 commit `8e136b9` + `54f906c`）**；⑤ 姊妹册 = `docs/route-layer.spec.md` **v2.29 §39**（catch-all 路由登记 + 路由总数现取）。

### 16.0 裁定来源（Kevin 2026-10-11 · 四条 · 逐字采用 · 不改写）

| # | 裁定（逐字） | 落点 | 执行方 |
|--:|---|---|---|
| ① | **死键清理已批准（`F13` → 执行中）**：11 死键四语同删 ⇒ 键集基线将再次变化；新基线由 Kong 实测、Jing 现取回写（**不得拄推定值**） | §16.2 · §16.3 · `docs/OPEN-ITEMS.md` `F13` | **Kong**（删）/ **Jing**（现取回写） |
| ② | **内部标识一并改名（`F10` → 执行中）**：`sf-listings*` → `sf-item*`、`data-sf-m="listing-*"` → `data-sf-m="item-*"` | §16.3 · `docs/OPEN-ITEMS.md` `F10` | **Kong**（改名 + 交读数） |
| ③ | **补 catch-all 提示页（新裁定）**：内层 `<Routes>` 末位新增 `<Route path="*">`；不得动外层 `LangShell` 的 `/*` 机制；新增 3 个 i18n 键 × 四语（非 zh 待复核） | §16.1 `T91` · §16.2 · 姊妹册 `route-layer.spec` v2.29 §39 | **Kong** |
| ④ | **主题图标语义（`T41` 口径）**：图标 = **将要切到的档位**（日档显月亮 / 夜档显太阳）；Kevin 反馈**真机逻辑正确、本地 H5 应反转** | §16.1 `T92` · §16.4 `N37` | **Kong**（现取两处 + 落地）/ **Jing**（实测后回写一致性结论） |

### 16.1 规则条文（`T91`–`T92`）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T91** | 【本册裁定 · v1.12 新】**catch-all 提示页**：`frontend/src/App.jsx` **内层 `<Routes>` 末位**新增 `<Route path="*">`，渲染**提示页**（含「返回首页」入口）；**不得动外层 `LangShell` 的 `/*` 机制**（`App.jsx:313` `path="/*"` 与 `:309` `${lang}/*` **一字不动**）；**口径 = 旧路径（`/reward`、`/listing*` 及四语前缀档）命中的是「提示页」，而不是「白页」**；**非重定向 · 仍不是 301**（Kevin 裁定③ 未变） | `frontend/src/App.jsx`（LangShell 内层 `<Routes>`）· 文案键 = §16.2 | 修正 §15.4 `N32` 登记的「硬删后白页」；`F11` 口径随之改（§16.3）；路由总数 **+1**（姊妹册 §39.2）；**i18n 键集基线 +3 键/语**（§16.2） |
| **T92** | 【本册裁定 · v1.12 新（**补 `T41`**）】**主题切换图标语义 = 「将要切到的档位」**（`T41` 逐字：**日档显示「月亮（切到夜间）」· 夜档显示「太阳（切到日间）」**）；**同一语义在两处渲染**（**桌面顶栏** · **移动面板**，同文件 `frontend/src/components/Header.jsx`）**必须一致** ⇒ **验收必须两处分别读**（不得用一处代替另一处）；Kevin 反馈 = **真机逻辑正确、本地 H5 应反转** | `frontend/src/components/Header.jsx`（两处 · 桌面顶栏 / 移动面板） | **★ 待 Kong 现取两处现状后、由 Jing 回写一致性结论**（本册**不预先断言哪处错**，见 §16.4 `N37` / §16.5） |

### 16.2 新增 i18n 键（3 键 × 四语 · 非 zh 待复核）

> **口径**：catch-all 提示页需**新增 3 个 i18n 键 ×（zh / en / hk / vn）四语**（**四语同集**，承 §6 硬断言「四语键集逐文件相同」）；**非 zh 译文标「待复核」**。**★ 诚实边界**：**键名与四语译文的值由 Kong 同轮落地后由 Jing 现取回写**（本册**不发明键名 / 值**）；下表只登记**语义面**（3 键用途）。

| # | 键（语义面 · 键名待 Kong 现取回写） | 用途 | zh（口径） | en / hk / vn |
|--:|---|---|---|---|
| 1 | 提示页标题 | 页头文案 | 待 Kong 落地 | **待复核** |
| 2 | 提示页说明 | 正文说明（可含「链接可能已失效」意） | 待 Kong 落地 | **待复核** |
| 3 | 返回首页入口 | 回首页按钮文案 | 待 Kong 落地 | **待复核** |

> **★ v1.14 就地回写（提示页已上线 · 上表一格未改）**：3 键**已落地并回写**（键名与四语值 = 下行「★ v1.13 回写」段的 `notFound.title` / `notFound.description` / `notFound.backHome`）；组件 = `frontend/src/pages/NotFoundPage.jsx`（挂载 = `App.jsx:145` 内层 `<Route path="*">`，commit `d2ad4ef` 已 push）⇒ **「待 Kong 落地」三格全部关闭**；Kevin 裁定（2026-10-12）= **「catch-all 提示页已上线（NotFoundPage，四语 12 例实测，旧路由不再白壳）」**（详见 §18.3）。

> **★ 键集基线（现取 · 不得拄推定值）**：**现取（Jing · HEAD `ecbefd1`）= 顶层 `127` / 拍平 `1053` / 四语节点 `4212`**（`= 1053 × 4` 自洽；现取命令 = 对 `frontend/src/locales/{zh,en,hk,vn}.json` 逐文件 `len(json)` = 顶层、递归叶计数 = 拍平、`× 4` = 四语节点）。**本轮两处变更共同改写基线**：**(a) 裁定③ 新增 3 键/语** ＋ **(b) 裁定① `F13` 删 11 死键/语** ⇒ **新基线须由 Kong 实测、Jing 现取回写**（**本册不预置任何「应然」数值**；`127/1053/4212` 为**改前现取**）。
> **★ v1.13 回写（现取 · 收口 §16.2 · 不得拄推定值）**：**新基线 = 顶层 `122` / 拍平 `1045` / 四语节点 `4180`**（`= 1045 × 4` 自洽；**Jing 现取 · HEAD `d2ad4ef`**；现取 = 对 `frontend/src/locales/{zh,en,hk,vn}.json` 逐文件 `len(json)` / 递归叶计数 / `×4`）。**算式闭合**：拍平 `1053 − 11`（裁定① 删 `F13` 死键）+ `3`（裁定③ 增 `notFound.*`）= `1045`；顶层 `127 − 6`（删顶层死键族 `reward` / `rewardsList` / `tasksToClaimReward` / `chooseReward` / `confirmChooseReward` / `successClaimReward`）+ `1`（增顶层 `notFound`）= `122`。**3 个新键（现取 · 键名与值 · 四语同集）**：**`notFound.title`** = zh「页面不存在」/ en「Page Not Found」/ hk「頁面不存在」/ vn「Không tìm thấy trang」；**`notFound.description`** = zh「您访问的页面可能已被移动或删除，链接可能已失效。」/ en「The page you're looking for may have been moved or deleted, so this link may no longer work.」/ hk「您訪問的頁面可能已被移動或刪除，連結可能已失效。」/ vn「Trang bạn truy cập có thể đã bị di chuyển hoặc xóa, liên kết có thể không còn hiệu lực.」；**`notFound.backHome`** = zh「返回首页」/ en「Back to Home」/ hk「返回首頁」/ vn「Về trang chủ」（**非 zh 译文标「待复核」**）。**待回写面已清**（§16.5 `T91` 的「键名与值」一项由此收口；提示页几何 / 命中率 / HTTP 状态码仍属实现 + 验收面）。见 **§17.1**。

### 16.3 登记状态回写（`F10` / `F11` / `F13` 新字面 · `docs/OPEN-ITEMS.md` 同步）

> **★ 口径**：下列为 **`docs/OPEN-ITEMS.md` §F‴ 三条登记的现行字面**（**旧字面逐字保留 + 标「已被 v1.12 取代」**）。

- **`F13`（死键清理）新字面 = 「死键清理已批准（`F13` → 执行中）」**：11 死键（`reward` · `rewardsList` · `tasksToClaimReward` · `chooseReward` · `confirmChooseReward` · `successClaimReward` · `common.loadingRewards` · `homePage.noRewards` · `homePage.rewardAlreadyClaimed` · `homePage.rewardOutOfStock` · `claimRewardModal.loadProgressFailed`）**四语同删**；**旧字面** = 「本轮不删」（逐字保留 · 标已被 v1.12 取代）。**新基线由 Kong 实测、Jing 现取回写**（见 §16.2 尾）。
- **`F10`（内部标识）新字面 = 「已执行（待 Kong 交读数）+ 几何零变化判据」**：`sf-listings*` → `sf-item*`、`data-sf-m="listing-*"` → `data-sf-m="item-*"` **一并改名**；**判据 = 几何零变化**（纯内部标识 · 不进用户可见面 · 不入 i18n ⇒ **改名前后可见几何逐值相等**；判据形同 §13「桌面档不动 / 归因式判据」）。**现取（Jing · HEAD `ecbefd1` · 改名尚未落地）= `sf-listings*` 命中 `141` / 唯一类 `32`；`data-sf-m="listing-*"` 唯一钩子 `39`** ⇒ **改后读数由 Kong 交**（本册不预置）。**旧字面** = 「本轮不改名（待统一项）」（逐字保留 · 标已被 v1.12 取代）。
- **`F11`（旧链接）新字面 = 「已由 catch-all 提示页收口（非重定向，仍不是 301）」**：**修正** §15.4 `N32` / `F11` 原登记的「**硬删后白页**」⇒ **现行 = 旧路径命中提示页**（`T91` · 姊妹册 `route-layer.spec` v2.29 §39）。**非重定向 · 仍不是 301 逐字不变**（Kevin 裁定③ 未变）。**旧字面** = 「无兜底 ⇒ 已接受后果（非缺陷）／硬删后白页」（逐字保留 · 标已被 v1.12 取代）。
- **★ v1.13 回写（`F10` / `F12` / `F13` 三处收口 · 现取 · 逐条）**：
  - **`F10`（内部标识）= 改名已执行 + 几何零变化判据已交（收口）**：现取（Jing · HEAD `d2ad4ef`）= **`sf-item*` 命中 `144`** / **唯一类 `33`**；**`data-sf-m="item-*"` 唯一钩子 `39`**；**残留 `sf-listings`（全仓） = `0`**。**几何零变化判据已交**（Kong 实测）= **`/item/1` 8 个元素 × `390` / `1440` 两档 = 共 `16` 个 `getBoundingClientRect` 逐值相同** ⇒ 纯内部标识改名**可见几何零变化**（判据形同 §13「归因式判据」）。**改前读数** = `sf-listings*` 命中 `141` / 唯一类 `32`；`data-sf-m="listing-*"` 唯一 `39`（见上行）。⇒ **`F10` 由「已执行（待 Kong 交读数）」收口为「已执行 + 读数已交 + 几何零变化成立」**。见 **§17.2**。
  - **`F12`（键集新基线）= 已回写（收口）**：**新基线 = 顶层 `122` / 拍平 `1045` / 四语节点 `4180`**（见 §16.2 尾 ★ v1.13 回写 + §17.1）。**旧基线**（v1.11 / v1.12）= `127/1053/4212`（逐字保留）。
  - **`F13`（死键清理）= 已执行（收口）**：11 死键（`reward` · `rewardsList` · `tasksToClaimReward` · `chooseReward` · `confirmChooseReward` · `successClaimReward` · `common.loadingRewards` · `homePage.noRewards` · `homePage.rewardAlreadyClaimed` · `homePage.rewardOutOfStock` · `claimRewardModal.loadProgressFailed`）**四语同删已落地** ⇒ 键集基线随之改写（`F12`）。**旧字面** = 「死键清理已批准（`F13` → 执行中）」（逐字保留）。

### 16.4 新增可复用教训（`N37`）

- **`N37`（可复用教训 · 承 `N32`–`N36`）**：**「同一语义在两处渲染」可能分叉，验收必须两处分别读，不得用一处代替另一处** —— 实例 = 主题切换图标（`T41` 语义「图标 = 将要切到的档位」）在 **桌面顶栏** 与 **移动面板** 两处渲染（同文件 `frontend/src/components/Header.jsx`）；**Kevin 反馈「真机逻辑正确、本地 H5 应反转」** ⇒ **两处（乃至真机 vs 本地 H5 两环境）可能并不一致**。**定式**：凡「同一语义 → 多渲染点 / 多环境」面，AC 必须写成**逐点逐环境分别读**（不得只测一处、不得以「同源组件」推定一致）。**未做**：两处现状读数、真机 vs 本地 H5 的分叉定位（**Kong / Neng 现取**；本册 `NOT_MEASURED`，见 `T92`）。

### 16.5 未核实 / 登记（诚实清单 · 承接 N 序列）

- **`T91`（catch-all 提示页）**：**未做** —— 提示页几何 / 四语文案值 / 命中率 / HTTP 状态码实测（属实现 + 验收面，本册只冻结口径；**键名与值待 Kong 现取回写**，见 §16.2）。
- **★ v1.14 收口（`T91` → 已实现 · 已上线 · 上行原字一字未改）**：Kevin 裁定字面（2026-10-12）= 「**catch-all 提示页已上线（`NotFoundPage`，四语 12 例实测，旧路由不再白壳）**」。现取 = 组件 `frontend/src/pages/NotFoundPage.jsx` + `App.jsx:145` `<Route path="*">`（commit `d2ad4ef`；`origin/main == HEAD 07a3927` ⇒ 已 push）；**键名与值已回写**（§16.2 尾 v1.13 段）。**剩余未测腿维持 `NOT_MEASURED`**：旧路由命中率统计 / HTTP 状态码 / 提示页几何（「四语 12 例实测」的判据面以裁定字面为准，本册未另取读数）。
- **`T92`（主题图标）**：**未做** —— **两处现状读数 + 真机 vs 本地 H5 的分叉定位 + 一致性结论**（**本册不预先断言哪处错**；由 Kong 现取两处后、Jing 回写一致性结论）。
- **`F10` / `F13`**：**未做** —— 改名后几何零变化实测、删键后新基线（**Kong 交读数 → Jing 现取回写**）。**★ v1.13 已回写 / 收口（原「未做」字面逐字保留）**：`F10` 读数已交（`sf-item*` 命中 `144` / 唯一类 `33`；`data-sf-m="item-*"` 唯一 `39`；**残留 `sf-listings` = `0`**）+ **几何零变化成立**（`/item/1` **8 元素 × 390/1440 = 16 个 rect 逐值相同**）；`F13` **11 死键四语同删已落地** ⇒ **`F12` 新基线 `122/1045/4180` 已回写**（见 §16.2 尾 · §16.3 · §17.1 · §17.2）。
- **本册 v1.12 零代码 · 零迁移 · 零写入 · 零套件**（Jing 只读现取：`frontend/src/App.jsx` / `frontend/src/components/Header.jsx` / `frontend/src/locales/*.json` / `backend-ts/src/index.ts` 计数面）。

## §17 ★★ v1.13 · 回写单：键集新基线（`122/1045/4180`）· `F10` 内部标识改名收口 · 真机诊断定案（`F7` / `N26` / `N31` 一族）· 新观察 `N38`（同源 iframe 与父页 `prefers-color-scheme` 可相反）· `/item/999999` 口径（**本节只追加 · 依据 = Kong 同轮实测 + Jing 现取复核 · 本单只写 `docs/**`**）

> **本节性质（写死）**：① **只追加**（承 §13 / §14 / §15 / §16 体例）；**非追加改动 = 既有的 `§16.2` / `§16.3` / `§16.5` 三处「收口回写」+ `§13.6 N26` / `§14.8` 两处「就地加注」**（**原地正文一字未动**，只在行后追加留痕）；② **零代码** —— 本单**只写 `docs/**`**，**未动 `frontend/**` / `tools/**` / `ctrl/**`**；③ **未启停任何服务**（**绝不 `pm2 restart`**）· **未 `git add -A`** · **未 commit** · **未 push**；④ **现取基线 = HEAD `d2ad4ef`**（**★ 复跑：现行 HEAD = `f050414`（Kong 主题图标收尾单）⇒ 上列全部读数逐项一致：键集 `122/1045/4180` · `sf-item*` `144`/`33` · `data-sf-m="item-*"` `39` · 残留 `sf-listings` `0` · 路由 `38`/`36`/`33`**）；⑤ **姊妹册** = `docs/route-layer.spec.md` **v2.30**（§39.2 路由总数就地更正 + §40 `/item/999999` 口径）。

### 17.1 键集新基线（现取 · `F12` 收口）

| 读数 | 值 | 口径 / 自洽 |
|---|---|---|
| **顶层键数** | **`122`** | 对 `frontend/src/locales/{zh,en,hk,vn}.json` 逐文件 `len(json.load(…))`；**四语逐文件相同** |
| **拍平叶数** | **`1045`** | 同上，递归叶计数；**四语逐文件相同** |
| **四语节点数** | **`4180`** | `= 1045 × 4`（**自洽**） |

- **算式闭合**：拍平 `1053 − 11`（裁定① 删 `F13` 死键）+ `3`（裁定③ 增 `notFound.*`）= `1045`；顶层 `127 − 6`（删顶层死键族 `reward` / `rewardsList` / `tasksToClaimReward` / `chooseReward` / `confirmChooseReward` / `successClaimReward`）+ `1`（增顶层 `notFound`）= `122`。**改前基线**（v1.11 / v1.12）= 顶层 `127` / 拍平 `1053` / 四语节点 `4212`。
- **3 个新键（`notFound` 顶层对象 · 四语同集 · 键名与值现取）**：`notFound.title` / `notFound.description` / `notFound.backHome`（四语值逐字见 §16.2 尾 ★ v1.13 回写；**非 zh 译文标「待复核」**）。

### 17.2 `F10` 内部标识改名收口（现取 · 几何零变化成立）

| 项 | 改前（`ecbefd1`） | **改后（现取 · HEAD `d2ad4ef`）** |
|---|---|---|
| `sf-item*` / `sf-listings*` **全仓命中** | `141` | **`144`** |
| **唯一类** | `32` | **`33`** |
| `data-sf-m=\"item-*\"` / `listing-*` **唯一钩子** | `39` | **`39`** |
| **残留 `sf-listings`（全仓）** | — | **`0`** |

- **判据 = 几何零变化**（纯内部标识 · 不进用户可见面 · 不入 i18n）：**Kong 实测 = `/item/1` 取 8 个元素、在 `390` 与 `1440` 两档各测 `getBoundingClientRect`，共 `16` 个 `rect` 逐值相同** ⇒ 改名前后**可见几何零变化**（判据形同 §13「桌面档不动 / 归因式判据」）。
- **现取命令**：`grep -rohE 'sf-item[a-z0-9-]*' frontend/src --include='*.{css,jsx,js,ts,tsx}'`（命中 / 去重）；`grep -rohE 'data-sf-m=\"item-[a-z0-9-]*\"' frontend/src …`（去重 = `39`）；`grep -rE 'sf-listings' frontend/src …` = `0`。

### 17.3 真机诊断定案（`F7` / `N26` / `N31` 一族 · 已定案 · 证据 = `/_preview/colors`）

**真机实测（Xiaomi MiuiBrowser / Android 14 / Chrome 135 · 站内自测）**：`html[data-theme]` = **`dark`**；`.sf-shell` computed `backgroundColor` = **`rgb(11,12,14)`**；`--sf-page-bg` = **`#0B0C0E`**；父页 `matchMedia('(prefers-color-scheme: dark)').matches` = **`false`**；**色卡 9/9 回读逐块精确**（含 **`#FDE815 → rgb(253,232,21)`**、`#808080 → rgb(128,128,128)`，`canvas 2d colorSpace=srgb`）。

**结论（定案）**：**手机真机上看到的是本站夜档**（`localStorage theme=dark`，**按 origin 隔离** —— 手机 origin 与本地 H5 不同源 ⇒ 主题态可不同）+ **屏幕渲染忠实**（色卡逐块精确 = 屏幕 / 色域无偏移）。

| 假设（`N31` 三假设） | 结论 |
|---|---|
| ① **主题档状态**（真机 `localStorage` / 系统偏好 ⇒ 落 `light` / `dark` 与本地不一致） | **成立且已定性** —— 手机 = **本站夜档**（非渲染差异、非缺陷） |
| ①′ **浏览器强制深色**（UA forced dark） | **排除** —— 站内 `html[data-theme]=dark` + `.sf-shell` 背景 = 本站夜档底 `rgb(11,12,14)`（非 UA 压暗） |
| ② **广色域色彩管理**（`Display P3` 等）/ **屏幕** | **排除** —— 色卡 9/9 回读精确（含品牌黄 `#FDE815 → rgb(253,232,21)`） |
| ③ **iframe vs 独立视口渲染** | **排除** —— 与 iframe 无关（父页 `prefers-color-scheme=false` 而站内为 `dark`，见 `N38`） |

- **诊断工具的持久价值（登记）**：`/_preview/colors`（`tools/h5-preview/server.mjs` · 工具面归 Kong；说明件 = `docs/audit/h5-preview-colors-probe.md`）为**可复跑、自报数**的诊断页 —— **容器色卡回读（`canvas 2d` `colorSpace=srgb`）+ 同源 iframe 站内自测（`html[data-theme]` / `.sf-shell` 背景 / `--sf-page-bg` / 视口 3 点 `elementFromPoint` 的「真正在画底色者」）+ 一键复制**。**定式**：**以后任何配色差异（真机 / 本地 / 跨 origin）先跑该页取数，不靠口述**（口述不足以回答「同一 hex 在两台设备上究竟渲染成什么」）。
- **收口范围（诚实边界）**：本行收口 **`F7` / `N26` / `N31` 一族的「配色 / 主题归因」**（`N31` 三假设 + `F7` 的真机配色挂账 + `N26` 的「真机读数待新 LAN 预览服务」阻塞）；**`N26` 的几何归因实验（`T79` 字号级联）**与 **`F7` 的悬浮菜单几何读数**为**独立腿**，本轮未跑 = `NOT_MEASURED`（**阻塞已解除** = 新 LAN 预览服务在场）。

### 17.4 `/item/999999` 口径（不存在的 id · **已知口径 / 非缺陷**）

- **口径（Zang 已裁）**：**不存在的 id 走「详情页内空态」** —— 落 `item/:itemId` 动态段（**不命中 catch-all 提示页**），页面渲染**空态容器**（现取钩子 `data-sf-m=\"item-detail-empty\"`，`frontend/src/pages/item/ItemDetailPage.jsx:116`），文案 = 错误链的 `message`（「关联单据不存在」）**兜底** `t('noData')`，并附**「返回列表」入口**（现取钩子 `data-sf-m=\"item-back-link\"` → `t('item.list')`）。

- **★★ v1.16 就地更正（钩子字面过期 · 上行原地一字未改）**：`data-sf-m="item-back-link"` **已被 v1.16 取代** —— 实现 commit `2aee62f` 已把该钩子**改名为 `item-back`**，空态「返回列表」**文字入口已不存在**（现取 = 页面内 `.sf-item-back` 返回箭头，`aria-label={t('item.list')}`，钩子 `data-sf-m="item-back"`），并**新增操作栏钩子** `data-sf-m="item-actionbar"`；空态容器行号现取漂到 `frontend/src/pages/item/ItemDetailPage.jsx:125`（原 `:116`）。**★ 快照口径声明（写死）**：`docs/versions/design-system.spec.v1.15.md:1617` 等**旧快照仍含该过期钩子字面，属历史冻结点、不回改**。
- **明确排除**：**不并入 catch-all 提示页**（catch-all 只承接**不匹配任何内层精确 / 动态段**的路径；`/item/999999` 匹配 `item/:itemId` ⇒ 归详情页空态）。**登记为已知口径（非缺陷）**。
- **姊妹册** = `docs/route-layer.spec.md` **v2.30 §40**（route 侧）；本册只记口径。
- **★ v1.14 依据补记（Kevin 2026-10-12 · 上三条一字未改）**：**依据 = 「详情页内空态带上下文更精确，且非空白」** —— 空态在 `item/:itemId` 详情页内**保留路由上下文**（能给出比 catch-all 提示页更精确的「返回列表」指路），且**不是空白壳**；route 册（`route-layer.spec` v2.30 §40.1）与本册 §17.4 上轮均已登记 ⇒ **本版只补本依据行，口径一字未改**。

### 17.5 新增可复用教训（`N38`）

- **`N38`（可复用教训 · 承 `N31` / `N35`）**：**同源 iframe 与父页的 `matchMedia('(prefers-color-scheme: dark)')` 可出现相反读数** —— 实测（真机 + headless 均观察到）：**父 frame 与同源 iframe 各报一行，二者 `matches` 可相反**（`native` 的 `matchMedia`，非页面自定义）。⇒ **不得拿父页的该值推断 iframe 内站点所处的主题**；**判站点主题只看站内 `html[data-theme]` / `.sf-shell` 背景色**（`--sf-page-bg` 解析值）。**定式**：凡「跨 frame / 跨 origin 的媒体查询（`prefers-color-scheme` 一类）」，**一律以被测 frame 自身的读数与站内状态为准**，不用父页 / 宿主的读数代替。**同族** = `N37`（同一语义多渲染点 / 多环境须逐点逐环境分别读）。
- **★ 计数口径污染观察（承 `N35` 同族 · 姊妹册 `route-layer.spec` v2.30 §39.2）**：用短 token 做**计数口径**时，**注释散文里的字面会抬高读数** —— 实例：`grep -cE '<Route' frontend/src/App.jsx` 会把注释里的字面 `<Routes>` 计入，现取（HEAD `d2ad4ef`）= **`38`**，其中 **2 行为注释**（`App.jsx:27` / `:139` 的散文含字面 `<Routes>`）⇒ **剔除注释行 = `36`**；**精确路由元素**（`grep -oE '<Route[ >]'`）= **`33`**。**定式**：短 token（`<Route` / `/*` / 端口号一类）计数**必须先剔除注释行**（与 `N35`「注释含 `/*` 被剥离器吃掉」同属「注释污染检索」）。

## §18 ★★ v1.14 · 主题初始默认三级优先序（`T93`）+ 配套两条 + catch-all 提示页上线回写 + `/item/999999` 依据补记（**本节只追加 · 依据 = Kevin 2026-10-12 裁定逐字 · 本单只写 `docs/**`**）

> **本节性质（写死）**：① **只追加**（承 §13–§17 体例；本版对既有节的改动全部为**行后就地注**，**原地正文一字未改**）；② **零代码** —— 实现（`frontend/index.html` 内联脚本 · `ThemeProvider` 不落盘语义）**归 Kong 同轮落地与验收**，本册只承载**口径 / 判负 / 断言影响**；③ **未动 `frontend/**` / `tools/**` / `ctrl/**`** · **未启停任何服务**（绝不 `pm2 restart`）· **未 `git add -A`** · **未 commit** · **未 push**；④ **现取基线 = HEAD `07a3927`**（`origin/main` 同步；工作区另有 Kong 同轮改动 `M frontend/index.html` —— 内联脚本已按本裁定在工作区落地，**非本单写面**，读数按「现取 = HEAD + 已知工作区」如实分列）；⑤ 台账面 = `docs/OPEN-ITEMS.md` **`F16`**（新增）+ `F15`（三面已齐，仅补依据）。

### 18.1 `T93`（主裁定 · 三级优先序 · Kevin 2026-10-12 逐字）

| 编号 | 口径 | 落点 | 判负 / 连带 |
|---|---|---|---|
| **T93** | 【本册裁定 · v1.14 新 · Kevin 2026-10-12 逐字】**主题初始默认三级优先序**：**① 用户显式选择**（`localStorage['theme']`，**仅由顶栏/面板的主题开关写入**）＞ **② 首次访问跟随系统** `prefers-color-scheme`（由 `frontend/index.html` 内联脚本在 React 渲染前设 `data-theme`，**不落盘** ⇒ 系统后续变化仍可跟随）＞ **③ 默认日档**（拿不到系统偏好 ⇒ `day`）。**`matchMedia` 只允许出现在 `frontend/index.html` 内联脚本**，**不得进入 `src/theme/**` / `src/shell/**` 的 JS**（**维持既有硬断言** = `theme-shell-isomorphism.test.jsx:205-213`，一字不动）。**`ThemeProvider.readInitialTheme()` 的取值顺序不变**（`data-theme` 属性 > `localStorage` > 默认）⇒ **跟随系统自然生效**。 | `frontend/index.html`（内联脚本 · 全仓唯一 `matchMedia` 位）· `frontend/src/theme/ThemeProvider.jsx`（`readInitialTheme` · 顺序不变） | ① `src/theme/**` / `src/shell/**` 出现 `matchMedia` ⇒ 判负（既有断言，无需新增）；② 初次挂载写 `localStorage['theme']` ⇒ 判负（配套①）；③ 系统偏好不可得时抛错 ⇒ 判负（配套②）；④ 键名变体（`sea.theme` / `mode` 等）⇒ 判负（承 `T42` 判负列；键名按本裁定 = `theme`，见 §6 就地注） |

**配套两条（同批裁定 · 承 `T93` · 逐字）**：

- **配套① 初始应用不落盘**：**`ThemeProvider` 初次挂载只设 `data-theme`；仅用户显式切换才写 `localStorage`** —— 否则「跟随系统」首帧即被粘住，失去跟随语义。
- **配套② 无 `matchMedia` 可用 ⇒ 回退日档**：**无 `matchMedia` 可用（旧 WebView / 异常）⇒ 回退日档，不得抛错**。
- **机制注（Jing 释义 · 非新增裁定）**：「不落盘 ⇒ 系统后续变化仍可跟随」的实现语义 = 内联脚本**每次加载**重读系统档（不落盘 ⇒ 永远不会被首访读数粘住）；**会话内实时监听不在本口径**（`matchMedia` 禁入 `src/**` JS）。用户一旦显式切换（写 `localStorage['theme']`），此后**存储优先于系统**（`readInitialTheme` 顺序中属性＞存储＞默认，存储在无属性时生效）⇒ 自动停止跟随 —— 与 `T43` 判负列「不得永远跟随覆盖用户选择」同向。

### 18.2 现取边界（2026-10-12 · HEAD `07a3927` + 已知工作区）

- **`readInitialTheme()` 顺序现取确认**（`frontend/src/theme/ThemeProvider.jsx:9-20`，已提交）：`data-theme` 属性（`:11-12`）＞ `localStorage[THEME_STORAGE_KEY]`（`:14-15`）＞ `DEFAULT_THEME`（`:19`）—— 与 `T93`「顺序不变」相符；`THEME_STORAGE_KEY = 'theme'`（`frontend/src/theme/tokens.js:23`）、`THEME_ATTR_VALUES = { day:'light', night:'dark' }`（`tokens.js:21`）、`DEFAULT_THEME = 'day'`（`tokens.js:25`）。
- **不落盘语义现取确认**：`persistTheme` 仅被 `setTheme` / `toggleTheme`（`ThemeProvider.jsx:57-67`，用户显式路径）调用；初次应用 = `useState(() => initialTheme || readInitialTheme())` + `useEffect(applyTheme)` **只设 `data-theme` 属性**（`:51-55`）⇒ **配套① 已按裁定成立**；`:28-31` 注释自陈判负判据「无存储 + 系统暗 ⇒ 初始夜档且 `localStorage['theme'] === null`」。
- **内联脚本**：`frontend/index.html` 现取（**Kong 同轮 · 工作区未提交** `M frontend/index.html`）已按三级优先序落地：显式存储（`saved ∈ {dark,light}`）＞ `matchMedia('(prefers-color-scheme: dark)')`（`try/catch`，异常 ⇒ `light` 日档 = 配套②）＞ 日档；**只 `setAttribute('data-theme', mode)`、不写 localStorage**；脚本注释自陈「全仓唯一允许做系统档判定的地方」。**本册以裁定为准登记口径；该文件归 Kong 单验收**（本单不碰 `frontend/**`）。
- **改前现状（诚实留痕）**：HEAD `07a3927` 的 `index.html` **无内联脚本**、全仓产品 JS `matchMedia` **0 命中**（仅 `src/test/setup.js` mock 与 css 注释）⇒ 改前行为 = 无存储即日档、**无系统跟随**；`main.jsx:14-18` 启动读 `localStorage['theme']` 设 `data-theme`（与内联脚本在「有存储」面同值、互不冲突；`main.jsx` 是否去重收敛归 Kong 验收面，本册只登记现状）。
- **★ 复跑（本单收笔前现取）**：HEAD 已进至 **`bb55925`**（Kong：「主题·首次访问跟随系统 —— index.html 内联 prefers-color-scheme 判定 + ThemeProvider 初次应用不落盘（显式切换才持久化）」）⇒ 上行「工作区未提交 `M frontend/index.html`」**已转为已提交**；本节所引行号复跑不变（`tokens.js:23` · `ThemeProvider.jsx:9/32/51` · `App.jsx:145` · `index.html` `matchMedia` 现取 3 处命中〔注释 + 脚本〕）。

### 18.3 catch-all 提示页 = 已实现 · 已上线（回写）

- **Kevin 裁定字面（2026-10-12）**：「**catch-all 提示页已上线（`NotFoundPage`，四语 12 例实测，旧路由不再白壳）**」。
- **现取**：组件 = `frontend/src/pages/NotFoundPage.jsx`（文案键 `notFound.title` / `notFound.description` / `notFound.backHome` · 钩子 `data-sf-m="not-found-*"`）；挂载 = `frontend/src/App.jsx:28`（import）+ `:145`（内层 `<Route path="*" element={<NotFoundPage />} />`）；**commit `d2ad4ef`**（「补 catch-all 提示页（NotFoundPage）+ 3 新 i18n 键 × 四语 + 计数改锚」），**`origin/main == HEAD 07a3927`（0 ahead）⇒ 已 push**，按本仓「push = 上线」口径与裁定「已上线」字面一致。
- **就地注**：§16.5 `T91` 「未做」行与 §16.2 「待 Kong 落地」三格**已在原行后就地注关闭**（原行一字未改）；**键名与四语值已于 v1.13 回写**（§16.2 尾）。
- **诚实边界**：旧路由**命中率统计 / HTTP 状态码 / 提示页几何**本册无实测读数 ⇒ **`NOT_MEASURED`**（「四语 12 例实测」的判据面以裁定字面为准，本册不代为展开）。

### 18.4 `/item/999999` 口径 = 已双册登记（本版只补依据行）

- **route 册** = `docs/route-layer.spec.md` **v2.30 §40.1**（上轮已记）；**design 册** = 本册 **§17.4**（v1.13 已记）；`docs/OPEN-ITEMS.md` **`F15`** 已登记（已知口径 / 非缺陷）⇒ **三面齐**。本版仅在 §17.4 行后补**依据**：「**详情页内空态带上下文更精确，且非空白**」（见 §17.4 ★ v1.14 依据补记；口径一字未改）。

### 18.5 断言影响（本版零改锚）

- **`theme-shell-isomorphism.test.jsx:205-213`**（shell/theme JS 无 `matchMedia`/`innerWidth`）：**一字不动** —— `T93` 明文「维持既有硬断言」；`index.html` 内联脚本不在该断言扫面（`src/**`）内。
- **四语键集基线 `122/1045/4180`**：本版**无新增/删除键** ⇒ 基线不变（`T93` 不引入文案；catch-all 3 键已于 v1.13 计入）。
- **`T42` 键名册面 `sea.theme` 与实现 `theme` 的出入**：以就地注标记（原行一字未改），本版**不产生新断言**；若后续立「键名冻结断言」，冻结值 = `'theme'`（`tokens.js:23`）。
- **快照面**：**改前快照** = `docs/versions/design-system.spec.v1.13.md`（上轮 v1.13 本版镜像原件；本单开工 `cmp` 复核 = **0**；md5 `b6e3685e84441ef582b73f1cbf012d9c` · 1615 行 / 336,436 B）；**本版镜像** = `docs/versions/design-system.spec.v1.14.md`（落笔后建，`cmp=0`）。

### 18.6 台账同步（`docs/OPEN-ITEMS.md`）

- 新增 **`F16`**（§F‴ 表尾 · 只追加）：**主题初始默认三级优先序（`T93`）实现与验收挂账** —— 现取依据 / 现状兜底 / 验收判据见该行；实现归 Kong 同轮（`frontend/index.html` 内联脚本 + `ThemeProvider` 不落盘语义），验收判据 = `T93` 判负列 + 配套①②。
- `F15`（`/item/999999`）维持「零动作：登记为已知口径（非缺陷）」不变；catch-all 上线状态已在 `F11` 行（v1.12 起）承载，本版不另改 `F11` 行。


---

## §19 ★★ v1.15 · `/item/:id` 详情页 UI 改造（**变体 A = 闲鱼结构 × 本站主题**）· 详情页隐藏底栏 · 可达性硬 AC（**本节只追加 · 依据 = Kevin 2026-10-12 拍板逐字 · 本单只写 `docs/**`**）

### 19.0 裁定来源（Kevin 2026-10-12 · 逐字采用 · 五条）

| # | 字面 | 本册落点 |
|---|---|---|
| ① | 按参考图（闲鱼风商品详情页）改 `/item/:id` 的 UI；**只改详情页**（列表 / 首页 / 其它页不动） | `T94`（范围 + 渲染面）· §19.5 |
| ② | 方向 = **变体 A「闲鱼结构 × 本站主题」**：布局层级照参考图；**颜色 / 形状全走既有 token 与既有结构常量体系**（**目标零新主题 token**）；**无数据承载的元素一律不渲染**（承 §15「不造无人消费的空路径 / 无死按钮」） | `T94` · `T98` · `T99` · §19.4 映射表 |
| ③ | **详情页隐藏底部 5 格 tabbar，操作栏独占底部**（**明确推翻「底栏恒 5 格」冻结口径，仅限 `/item/:id`**；其余页面 tabbar 照旧） | `T95`（机制）· §19.3 · §19.10（取代留痕） |
| ④ | 收藏 + 浏览 / 想要计数 = **功能另单**；「聊一聊」= **改接 Telegram**（站内信 vs 站外信待裁；原「接推特 X」计划作废）；「留言」= 商品评论 = 另单 —— **三者本轮一律不渲染** | `T94`（不渲染面）· §19.5 · §19.11 待裁 |
| ⑤ | 站点术语：统一「闲置物品」（en = `item`）；路由 `/item/:id` **不动** | §19.7（i18n 零新增）· `T94` |

**参考图**（随单附上两张，**以图为准**）：图一 = 价格行 + 标题 + 底部栏局部；图二 = 完整闲鱼详情页（逐区见 §19.4 首列）。

### 19.1 现取基线（本单开工 · HEAD `a111b45` · 2026-10-12）

| 项 | 现取读数 | 取法 |
|---|---|---|
| 本册改前行数 / 字节 / md5 | **1673 行 / 354,073 B / `7e67f2cdd95417502148bdff74ee95a2`** | `wc -l` · `wc -c` · `md5` |
| 改前快照 | `docs/versions/design-system.spec.v1.14.md` | `cmp=0`（本单开工复核） |
| 四语键集 | **顶层 122 / 拍平 1045 / 四语节点 4180**（zh/en/hk/vn 逐文件相同） | 逐文件 `len(json)` / 递归叶计数 / `×4` |
| 路由 | `item/new` = `App.jsx:101` · `item/:itemId` = `:102` · `item` = `:103`（同路由 `?id=` 兼容） | `grep -n` |
| 引用 `ItemDetailPage` 的测试 | 5 文件：`listing-market.test.jsx` / `p6-btn-impl2.test.js` / `listing-publish-redirect.test.jsx` / `i18n-content-wiring.test.jsx` / `p7e-tails-beta.test.jsx` | `grep -rln` |
| 底栏 DOM 恒在与五 region | `theme-shell-isomorphism.test.jsx:80-81`（`regions == ['shell','topnav','content','footer','tabbar']`）· `:89`（`visibleNavItems(false).map`）· `:106-107` · `:120-122`；`v15-nav-floatmenu.test.jsx:228` / `:109` 同锚 | `sed -n` |
| `shell.css` 双边断言 | `:216-226`：唯一 `@media` 块 = 767 · `mobileBlock` 含 `.sf-tabbar` + `display: grid` · `widePart` 匹配 `.sf-tabbar{…display: none` | `sed -n` |
| 外壳 JS 无宽度判定 | `:205-213`：`src/shell/**` / `src/theme/**` 的 JS 不得含 `matchMedia` / `innerWidth` / `clientWidth` … | `sed -n` |
| `item.css` 末段 ≤767 覆盖块 | `item.css:271-276`（`.sf-item, .sf-layout` 覆盖 `--sf-l-ctl-h: 44px`） | 已存在 |
| 数据面 | `GET /api/prize/:bID` 返回 prize 遗留字段集（`name` / `points` / `description` / `i18n_status` / shard·claim·market 族…）——**无 owner / seller、无 media_urls 回读、无品牌 / 成色** | `frontend/src/pages/item/item-api.js` + route 册 |

### 19.2 规则条文（`T94`–`T99`）

| 编号 | 【本册裁定】口径 | 落点（文件 / 选择器 / 类） | 挂断言 / 影响面 |
|---|---|---|---|
| **`T94`** | 【本册裁定】**变体 A 落地范围 = 只改 `/item/:id` 详情页**（列表 / 首页 / 发布 / 交易所 / 个人页 / 其它一律不动）；**渲染面 = 白名单（收窄）**：**只渲染** ① 价格行（大号价格 + 单位小字）② 大标题 ③ 详情面板（渐变占位图 + 描述 + 库存 + 数量输入）④ 底部固定操作栏（**仅「立即购买」一个 CTA**）⑤ 页面内顶栏返回箭头 ⑥ **既有** `.sf-item-note`（`物品编号 #{id} · {status}` —— **数据承载面，非渲染面新增，见下**）。**一律不渲染**（本轮）：卖家信息行 / 属性两列 / 集市横幅 / 划线原价 / 比市场价 / 包邮 / 想要·浏览计数 / 留言 / 收藏 / 聊一聊。**判据** = **无数据承载的元素不渲染**（本仓既有裁定：不造无人消费的空路径 / 无死按钮）；`GET /api/prize/:bID` **无** owner/seller、无 media_urls、无品牌/成色 ⇒ 上述槽位**一律无数据源** ⇒ 不渲染。 | `frontend/src/pages/item/ItemDetailPage.jsx`（唯一实现落点） | `p7e-tails-beta.test.jsx`（`.sf-item-note` **必须保留**）· `listing-market.test.jsx:161`（`item.empty` 空态）· `p6-btn-impl2`（家族清单）——逐条见 §19.6 |
| **`T95`** | 【本册裁定】**详情页隐藏底栏的机制 = 「DOM 恒在 + 页面级 `display:none`」**（**二选一裁死**；**否决 DOM 移除**）：① **`BottomTabBar` 恒渲染** `<nav class="sf-tabbar" data-sf-region="tabbar">` 与**全部 5 个** `<a data-sf-nav>`；② **仅**在 `pathname` 命中**详情路由**时，给 `<nav>` 追加 **`is-detail`** 修饰类（`className="sf-tabbar is-detail"`）；③ 隐藏 **只由 CSS 承担**：`.sf-tabbar.is-detail { display: none; }`。**状态挂点** = `frontend/src/shell/BottomTabBar.jsx`（**该文件已有 `useLocation()`** ⇒ 新增**路由串匹配**，**不是宽度判定** ⇒ 不撞 `:205-213`）。**CSS 落点** = **`frontend/src/styles.css` 顶层**（`@import` 段之后、`@theme` 之外；**不入 `@layer`、不入任何 `@media`**）——**不得落 `shell.css`**（该文件挂「唯一 767 断点块」「无 `[data-theme]` 选择器」双边断言；且 `shell.css` 现无第二个「底栏可见性翻转点」，本裁定**不把页面条件写进外壳 CSS**）。**详情路由判定**（剥语言前缀后）：`rest === '/item'`（`?id=` 兼容档）**或** `/^\/item\/[^/]+\/?$/` 命中 **且** `rest !== '/item/new'`（**静态段 `/item/new` = 发布页 ⇒ 不隐藏**）；语言前缀剥离复用既有单一真源 `utils.stripLangPrefix`（`shell/nav.js` 同用）。**具体性**：`.sf-tabbar.is-detail` = (0,2,0) **＞** shell.css `767` 块内 `.sf-tabbar` = (0,1,0) ⇒ **竖屏档亦被隐藏**，无需第二处规则。 | 状态：`frontend/src/shell/BottomTabBar.jsx`；CSS：`frontend/src/styles.css` 顶层 | **五 region 断言零改动**（`theme-shell-isomorphism.test.jsx:80-81` / `:89` / `:106-107` / `:120-122` · `v15-nav-floatmenu.test.jsx:228` / `:109`）；**`shell.css` 一字不动** ⇒ `:216-226` 零改动 |
| **`T96`** | 【本册裁定】**可达性硬 AC（底栏隐藏后的承载）**：**页面内顶栏 = 返回箭头（`‹`）**（闲鱼同款）；**不加搜索框**（参考图② 的搜索框与本轮无功能 ⇒ 不渲染）；**右三图标不渲染**。**返回目标语义裁死 = 固定回首页 `root('/')`**（`<Link to={root('/')}>`；**否决 `history.back()`** —— 直接深链 / 刷新进入详情页时 history 无站内上一页，`navigate(-1)` 会离站或空转；固定回首页在**深链 / 刷新 / 新标签 / 站内跳转**四种入口下行为一致且可判负）。**a11y 名** = **复用既有键 `t('item.list')`**（zh「闲置物品列表」…；**+0 新键**）。**触控目标** = 复用既有 `.sf-tap-sq`（`shell.css` 的 `767` 块内 `min-width/height: 44px`）⇒ ≤767 档 ≥44×44，**>767 档不受其约束**（桌面不需要 44）。 | `frontend/src/pages/item/ItemDetailPage.jsx`（`.sf-item-back` + 既有 `.sf-tap-sq`） | 「入口不丢失」写成**归因式 AC**（§19.8）——**不用元素白名单** |
| **`T97`** | 【本册裁定】**桌面档行为**：桌面档（`>767`）底栏**本就 `display:none`**（`shell.css` 宽屏块）⇒ **桌面详情页导航不受本裁定影响**（`is-detail` 在桌面无额外视觉后果）。**操作栏**：**≤767 档 = `position: fixed` 独占底部**（底栏已隐藏 ⇒ 无竞争）；**>767 档 = 留在内容流（不出 `fixed`）**（`position: static`），与既有 `.sf-layout` 内容同列。断点手段复用**既有唯一断点值 767**（`breakpoints.js`），**仅写在页面文件 `item.css` 内**（`shell.css` 仍不得新增 `@media`）。 | `frontend/src/pages/item/item.css`（`.sf-item-actionbar`） | 桌面归因式判据「允许变更集」见 §19.8 |
| **`T98`** | 【本册裁定】**结构常量落点**：本单**零新主题 token**（`--sf-*` 一个不增）⇒ **`theme/tokens.js` 的 `TOKEN_KEYS` 一字不动**（`theme-shell-isomorphism.test.jsx` 的「未登记 token」判负与 `theme-tokens.test.js` 的 PROV 回读均不受触）。确需新增的**结构常量一律落 `item.css` 的页面局部 `--sf-l-*`**（与 `item.css:18-19` 既有 `--sf-l-ctl-h` / `--sf-l-textarea-h` 同体例）——**不得进 `tokens.js` 的 `STRUCT`**（`STRUCT` / `STRUCT_PROV` 带**溯源硬门**：每个值必须能回读 `docs/design/style-preview.html` 的**行号 + 原文片段**；本单**无新真源块** ⇒ 新增 `STRUCT` 项必判负）。逐项点名（值 / 两档备值 / 声明落点 / 为何不算新主题 token）见 §19.4 末表。 | `frontend/src/pages/item/item.css` | `theme-shell-isomorphism.test.jsx`（token 登记）· `theme-tokens.test.js`（PROV / 差异键 > 90）——**零改动** |
| **`T99`** | 【本册裁定】**变体 A 视觉口径**：**布局层级照参考图**，**颜色 / 形状一律走既有 token 与既有结构常量** ⇒ **逐项映射表见 §19.4**（参考图元素 → 既有 `--sf-*` 槽位 / 既有 `--sf-st-*` 常量 / 既有 `.sf-item-*` 类）；**未被映射的参考图元素一律不渲染**（`T94`）。**层级（自上而下）**：页面内顶栏（返回箭头）→ 价格行 → 大标题 → `.sf-item-note`（副行）→ 详情面板 →（≤767）底部固定操作栏。**字号**：**可见文本 ≥12px**（`T79` 不破）；大标题 / 大号价格取页面局部常量（§19.4 末表）。**触控目标**：**≤767 档 ≥44**（引用点见 `T96` / 操作栏 CTA）。**间距 / 高度**：复用既有 `--sf-st-feed-gap-m`（9px）与 `.sf-item-panel` 既有 `padding: 12px 14px`；操作栏高度取页面局部常量。 | `frontend/src/pages/item/item.css` + `ItemDetailPage.jsx` | `p6-btn-impl2`（`.sf-item-btn` 规则与家族清单）· 归因式 AC（§19.8） |

> **★ 勘误注（2026-10-19 · 媒体上传单 · `T94`「渐变占位图」条款 · 旧句逐字保留、以本注为准）**：`T94` 行渲染面③「详情面板（**渐变占位图** + 描述 + 库存 + 数量输入）」中的**「渐变占位图」形态限定自本注起作废** —— 现行口径 = 详情面板 image 槽 = **`media_urls[0] || 机械鱼占位`**（**渲染面允许真图 / 占位图填充原几何盒**；几何盒 / 槽位 / 其余渲染面白名单逐字不变；媒体上传单落地前维持占位渲染）。契约正典 = `route-layer.spec` **v2.39 §48.6** + `data-layer.spec` **v0.34 §40**；占位资产 = 320×320 q25 WebP 12,616 B（**Kevin 拍板放弃 10KB 线换画质**）。

### 19.3 `T95` 展开 · 二选一裁死（机制对照 + 被否决方案的代价）

| 方案 | 做法 | 断言后果（**现取重锚**） | 裁定 |
|---|---|---|---|
| **A · DOM 恒在 + 页面级 `display:none`**（**采纳**） | `<nav class="sf-tabbar is-detail">` 恒在 DOM；`.sf-tabbar.is-detail{display:none}` | **五 region 断言零改动**：`theme-shell-isomorphism.test.jsx:80-81`（`['shell','topnav','content','footer','tabbar']`）· `:89`（`visibleNavItems(false).map`）· `:106-107`（五项 href）· `:120-122`（未登/登录 tabs）· `v15-nav-floatmenu.test.jsx:228` / `:109` 全部**逐字维持** | ✅ **采纳** |
| **B · DOM 移除**（条件不渲染 `<nav>`） | `BottomTabBar` 在详情路由 return `null` | **会红的断言（若选 B）**：`theme-shell-isomorphism.test.jsx:80-81`（`regions` 少 `tabbar` ⇒ 数组不等）· `:89`（`tabbar` 为 `null` ⇒ `TypeError`）· `:106-107`（同上）· `:120-122`（同上）· `v15-nav-floatmenu.test.jsx:228`（`regions` 不等）· `:109`（同上）。**前移方案**（若 Kevin 坚持 B）：把上述 6 处改成「`regions` 允许缺 `tabbar`」+「`tabbar` 可能为 `null`」——**等于拆掉「横竖屏 / 主题同构 ⇒ DOM 恒在」这块硬核**（同构判据的第一性证据），代价远高于收益 | ❌ **否决** |

**B 的额外代价（登记）**：DOM 移除会让「底栏始终在 DOM（宽屏只是被断点 CSS 隐藏，不是条件渲染）」这条**已入册口径**（`theme-shell-isomorphism.test.jsx` 第 2 例标题逐字）在详情页**局部失效**，须逐页区分「在 DOM / 不在 DOM」，此后每个同构读数都要先问「这一页底栏在不在」。**A 的代价** = 详情页上底栏节点仍占 DOM（恒 `0×0`，因 `display:none`）⇒ 归因式差异集里会出现**恒 `0×0` 子树**（与 §13.4 已登记的 `.sf-tabbar` 子树同族），**测量口径**：只采可见元素（`el.getClientRects().length > 0`）即可自动排除。

### 19.4 `T99` 展开 · 参考图元素 → 既有槽位映射表（**逐项**）

**A. 图二（完整详情页）逐区**

| 参考图元素（图二逐区） | 本轮落法 | 既有槽位 / 常量（**零新主题 token**） |
|---|---|---|
| ① 顶部导航：返回箭头 + 搜索框 + 右三图标 | 只留 **返回箭头**（`.sf-item-back`）；**搜索框不渲染**（`T96`）；**右三图标不渲染**（无功能） | 箭头 = `lucide-react` 既有 `ChevronLeft` · 触控 = 既有 `.sf-tap-sq` · 颜色 = `--sf-title-fg`（既有） |
| ② 卖家信息行（头像 / 昵称 / 信用标 / 来过时间·城市） | **不渲染**（数据面无 owner/seller） | — （挂点建议见 §19.5） |
| ③ 价格区：大号价 + 红字「比市场价低」+ 划线原价 + 黄底荧光标签 + 浅粉底「包邮」+ 灰字「N人想要 \| M人浏览」 | **只渲染大号价格**（`$` + 数字 + 单位）：复用 **既有** `.sf-item-price` / `-cur` / `-num` / `-unit` 三槽与 **既有** 颜色 token `--sf-price-cur-fg` / `--sf-price-num-fg` / `--sf-price-unit-fg` / `--sf-price-bg` / `--sf-price-border`；**颜色观感差异（登记·非缺陷）**：参考图价 = **橙红**，本站 `--sf-price-num-fg` 日档 = `#030402`（墨黑）/ 夜档 = `#FDE815`（亮黄）⇒ **「结构照图 · 颜色走本站 token」的必然结果**。**其余一律不渲染**：划线原价 / 比市场价（无 market 原价字段）· 黄底荧光标签 + 包邮（无品牌 / 成色 / 运费字段）· 想要·浏览计数（`T94` ④ 另单） | 价格槽 = 既有（`shell.css:.sf-price-*` / `item.css:.sf-item-price-*`）；字号 = **页面局部常量**（末表） |
| ④ 浅黄「闲鱼集市」横幅 | **不渲染**（无数据承载 / 无功能）；**另注底色冲突**：本站页面底色本身 = `--sf-page-bg` 日档 `#FDE815`（亮黄）⇒ 黄底横幅与底色同类、形状几乎消失（承 `frontend-parity-acceptance`「参考图底色假设」一节） | — |
| ⑤ 多行描述 + 两列属性（品牌 / 成色） | **描述渲染**（`.sf-item-meta`，`--sf-meta-fg`）；**两列属性不渲染**（无 brand / condition 字段） | 描述 = **既有** `.sf-item-meta` |
| ⑥ 详情长图 | **渐变占位图**（**既有** `.sf-item-thumb`，背景取 **既有**渐变 token `--sf-thumb-1`；**无 media_urls 回读** ⇒ 延续站内「纯 CSS 图占位」口径） | **既有** `.sf-item-thumb` + `--sf-thumb-1` |
| ⑦ 底部固定操作栏四区【留言 / 收藏 / 聊一聊 / 立即购买】+ **无底部 tabbar** | **只渲染「立即购买」一个 CTA**（`sf-btn` 基类 + 既有 `.sf-item-btn` + 新修饰 `.sf-item-cta`）；**其余三项不渲染**（另单 / 无功能）；**无 tabbar** = `T95` | CTA 颜色 = **既有** `--sf-btna-bg #FFE60F` + `--sf-btna-fg #202020` ⇒ **逐字命中参考图「黄底黑字 CTA」⇒ 零新颜色**；形状 = 见末表（圆角） |

**B. 图一（价格行 + 标题 + 底栏局部）**

| 参考图元素 | 本轮落法 | 既有槽位 |
|---|---|---|
| 大号价（橙红，`¥` 与数字同大） | 大号价格行 | 既有 `.sf-item-price-*` 槽 + 页面局部字号常量（**颜色按本站 token，观感差异已登记**） |
| 「包邮」(黑字小) / 「5人想要 \| 83浏览」(右对齐灰字最小) | **不渲染**（无数据 / 另单） | — |
| 多行标题（深灰黑，中等字号，左对齐换行） | **大标题**（`.sf-item-title`，**既有** `--sf-title-fg`）+ 页面局部字号常量 | **既有** `.sf-item-title` |
| 底栏胶囊组合（左黄「聊一聊」+ 右深灰「立即购买」；独立灰胶囊「收藏」） | **只保留 CTA**：「黄底深字」= **既有** `.sf-btn`（`--sf-btna-bg` / `--sf-btna-fg`）**逐字命中**；**胶囊半径** = **既有** `--sf-st-radius-pill`（`999px`）；其余两格不渲染 | **既有** `.sf-btn` + **既有** `--sf-st-radius-pill` |

**C. 确需新增的「结构常量」逐个点名（`T98` · 一律页面局部 `--sf-l-*` · 声明落点 = `item.css`）**

| 常量 | 值 | 两档备值 | 声明落点 | 为何**不算新主题 token** |
|---|---|---|---|---|
| `--sf-l-detail-price-size` | **28px** | 32px（若 Kevin 要更接近参考图比例） | `item.css`（`.sf-item`） | **字号 = 几何量** ⇒ 按本册铁律**不进主题层**（`tokens.js` 注释 12–14 行逐字：`font-size…一律不进主题层`）；进 `STRUCT` 需 `STRUCT_PROV` 回读 `style-preview.html` 行号，本单无新真源块 ⇒ 落页面局部 |
| `--sf-l-detail-title-size` | **18px** | 20px | `item.css`（`.sf-item`） | 同上（`font-size`） |
| `--sf-l-actionbar-h` | **60px** | 56px / 64px | `item.css`（`.sf-item-actionbar`） | **高度 = 几何量** ⇒ 同铁律 |
| `--sf-l-actionbar-safe` | **`env(safe-area-inset-bottom)`** | —（真机生效需 `index.html` `<meta name="viewport">` 含 `viewport-fit=cover`，`T75` 已冻结） | `item.css`（`.sf-item-actionbar`） | **环境量值、非色/形**；与 `shell.css:72` 底栏安全区**同形复刻**（`--sf-tabbar` 的 `padding-bottom: env(safe-area-inset-bottom)`），**不新增 token 也不新增 `STRUCT`** |

> **CTA 胶囊形状（复用既有常量，零新增）**：`border-radius: var(--sf-st-radius-pill)`（`999px`，`STRUCT['radius-pill']` 既有）。**登记**：此**页面局部**偏离 §P6-UI-CONSIST-B「成套形状收敛到 `--sf-st-radius-btna`（8px）」的家族口径 —— 依据 = Kevin 变体 A 拍板（参考图 CTA 为全圆胶囊）；**备选口径**（若 Kevin 要家族一致）= 改用 `--sf-st-radius-btna`（一句话可改）。**注意**：圆角**不得写进 `.sf-item-btn` 规则本体**（`p6-btn-impl2.test.js:135-153` 校验该规则；虽只禁 `background` / `border`，但改本体属动既有契约）⇒ 一律落在**新修饰类 `.sf-item-cta`**。

> **★ v1.16 就地更正（`R-C` 值更正 · 旧表值逐字保留）**：上表 C 段 `--sf-l-detail-price-size` 的现取声明值 **28px ⇒ 32px**（Zang 终审 `R-C`）；上表旧字面「**28px**（32px 为备值）」**已被 v1.16 取代** —— **28px 降为「若 320 档溢出则回落」的备值**（现取 = `frontend/src/pages/item/item.css:24`，`--sf-l-detail-price-size: 32px`；32px 硬门 = 320 档零横向溢出，见 §19.13 `R-C`）。

### 19.5 `T94` 展开 · 本轮渲染面 / 不渲染面 + 将来接入的挂点建议（**不改本轮代码**）

**渲染面（收窄 · 白名单）**：① 价格行（大号价格 + 单位小字）② 大标题 ③ 详情面板（渐变占位图 + 描述 + 库存 + 数量输入）④ 底部固定操作栏（**仅「立即购买」一个 CTA**）⑤ 页面内顶栏返回箭头 ⑥ **既存** `.sf-item-note`（`物品编号 #{id} · {状态}` —— **有数据承载（id + status），且 `p7e-tails-beta` 硬断言锚定，必须保留**）。

> **★ v1.16 白名单补齐（`R-A`/`R-F` 就地回写 · 防误判为负）**：上列**六项**须**扩为「六项 + `R-A` 三键 + `R-F` 的 `item.buyNote`」（共八类）** —— 即渲染面 = ① 价格行 ② 大标题 ③ 详情面板 ④ 操作栏（仅「立即购买」一个 CTA）⑤ 返回箭头 ⑥ `.sf-item-note` **⑦ `R-A` 三键**（`item.line` 小标题 + `item.priceServerNote` + `item.refundStockNote`，同处 `.sf-item-meta-group`）**⑧ `R-F` 的 `item.buyNote`**（同一 meta 组）。**判据后果（实测）**：按 v1.15 旧字面（「六项并集、差集 = 0」）判 ⇒ 上述**四行 meta**（`item.line` / `priceServerNote` / `buyNote` / `refundStockNote`）**都不是六项之一** ⇒ **会误判为负**（质检 `AC-1` 已实测：四行同处 `.sf-item-meta-group`，组内 = 1 个 `h2` + 3 条 `.sf-item-meta`）。⇒ §19.8 AC-1 判据同步补齐（就地注）。

**不渲染面（本轮）** + **将来接入的挂点建议**：

| 不渲染槽位 | 不渲染理由 | 将来接入建议挂点（**本轮不实现**） | 依赖 |
|---|---|---|---|
| 卖家信息行（头像 / 昵称 / 信用标 / 来过·城市） | 数据面无 owner/seller | `.sf-item-seller`（`data-sf-m="item-seller"`）；昵称 / 头像 / 信用 / 城市各一子槽；信用标 = 既有 `.sf-tag` | `GET /api/prize/:bID` 增 owner / seller 字段（后端另单） |
| 属性两列（品牌 / 成色） | 无 brand / condition 字段 | `.sf-item-attr`（`<dl>` 两列）；键值用既有 `.sf-item-label` / `.sf-item-meta` | 后端字段 |
| 集市横幅 | 无数据承载 / 无功能；**且底色冲突**（本站页底色 = 亮黄） | `.sf-item-promo` | 运营位（运营另单） |
| 划线原价 / 「比市场价低」 | 无 market 原价字段 | `.sf-item-price-orig` | 后端原价字段 |
| 包邮标 / 黄底荧光标签 | 无运费 / 成色字段 | 既有 `.sf-tag` 修饰 | 后端字段 |
| 想要 / 浏览计数 | `T94` ④ = 功能另单 | `.sf-item-stats` | 计数服务（另单） |
| 留言（商品评论） | 另单 | **底部操作栏第 1 格**（本轮 CTA 的左侧槽位预留） | 评论服务（另单） |
| 收藏 | 另单 | **底部操作栏第 2 格**（CTA 左侧槽位） | 收藏服务（另单） |
| 聊一聊 | **改接 Telegram**（站内信 vs 站外信**待裁**，§19.11）；原「接推特 X」作废 | **底部操作栏第 3 格**（CTA 左侧槽位） | Telegram 接驳（另单） |

> **槽位预留口径**：底部操作栏按「**N 格 CTA 区 + 主 CTA**」的**单行 flex**结构落；本轮 **N = 0**（**无数据承载的元素一律不渲染**）⇒ **不预埋空槽位 DOM**（承「不造无人消费的空路径」）。将来接格时**只加子节点、不改布局契约**。

> **★ v1.17 就地注（`T100` · 第 3 格激活 · 上行原地一字未动）**：**「聊一聊」行已被 v1.17 激活** —— `Q1` 已裁 = **站内信（A）+ Telegram bot 通知/绑定（C）并行**（Kevin 2026-10-12 逐字「直接 A+C」；「站内信 vs 站外信待裁」字面**已被取代**、原行留痕）⇒ 第 3 格 = **站内「聊一聊」CTA**（消费 `POST /api/messages/conversations` + `GET /api/messages/conversations?listing_id=`，route 册 v2.31 §41.2）。**本轮 N = 0 → 1**（只接第 3 格，第 1 格「留言」/第 2 格「收藏」**仍不渲染、不预埋 DOM**）；**渲染条件 = 登录 ∧ 非卖家本人**（卖家本人不渲染 = Zang 结构 2；未登录点击 = 既有登录引导）；数据依赖 = route 册 §41.3 `F19`（`seller` 对象已进读口，但**卖家行仍不渲染**——`T94` 白名单逐字不变，本格只消费「当前用户 vs seller.uid」判定）。逐条形态 / AC = §20.3 / §20.9。

### 19.6 受影响硬断言清单 + 前移方案（**现取重锚** · 逐条）

> **总判**：本单**零 i18n 键、零主题 token、`shell.css` 零改动、路由零改动、DOM 零移除** ⇒ **下列既有硬断言**中**绝大多数零改锚**；须由 Kong **保持**的「契约型」条目单列「改法 = 保持」。

| # | 文件 : 行（**现取**） | 断言内容 | 改法 / 前移 |
|---|---|---|---|
| 1 | `theme-shell-isomorphism.test.jsx:80-81` | `regions == ['shell','topnav','content','footer','tabbar']` | **保持**（`T95` 选「DOM 恒在」）⇒ **零改锚**；**约束**：禁止 DOM 移除底栏 |
| 2 | `theme-shell-isomorphism.test.jsx:89` | 底栏 `a[data-sf-nav]` == `visibleNavItems(false).map(i=>i.key)` | **保持** ⇒ 零改锚 |
| 3 | `theme-shell-isomorphism.test.jsx:106-107` | 五项 href（含 `/item/new`） | **保持** ⇒ 零改锚 |
| 4 | `theme-shell-isomorphism.test.jsx:120-122` | 未登录 / 登录后 tabs key 集 | **保持** ⇒ 零改锚 |
| 5 | `theme-shell-isomorphism.test.jsx:205-213` | `src/shell/**` / `src/theme/**` 的 JS 无 `matchMedia` / `innerWidth` / `clientWidth` / `offsetWidth` … | **保持** ⇒ `BottomTabBar.jsx` 新增的**只准**是路由串匹配（`stripLangPrefix` + 正则），**不得**借机引入任何宽度判定 |
| 6 | `theme-shell-isomorphism.test.jsx:216-226` | `shell.css` 唯一 `@media`（767）· `mobileBlock` 含 `.sf-tabbar` + `display: grid` · `widePart` 匹配 `.sf-tabbar{…display: none` | **保持**（`T95` 的 CSS 落 `styles.css`，**`shell.css` 一字不动**）⇒ 零改锚 |
| 7 | `v15-nav-floatmenu.test.jsx:228` / `:109` | `regions` 同 #1 / 底栏 `a[data-sf-nav]` | **保持** ⇒ 零改锚 |
| 8 | `p7e-tails-beta.test.jsx:72, 85-115` | `.sf-item-note` 元素存在 · `data-sf-status` · `title` · 文本含 `#{id}` 且**缺省时 `endsWith('-')`** · 未知枚举走四语兜底且**原值不进用户面** | **保持（契约）**：新布局**必须**保留 `.sf-item-note`（含类名 / `data-sf-status` / `title` / `#{id} · {状态}` 文案格式），**置于大标题之下作副行**；**判负**：整块删或改类名 ⇒ 本文件 ① 三例全红 |
| 9 | `listing-market.test.jsx:161, 169` | 详情空态 `t('item.empty')` 渲染（`screen.getByText('item.empty')` + 路由挂载） | **保持**：空态路径（`detail.phase !== 'ok'`）**必须**仍渲染 `item.empty` 文案 |
| 10 | `p6-btn-impl2.test.js:71-84` | 家族清单 **11 个 JSX**（含 `pages/item/ItemDetailPage.jsx`）+ `totalUses ≥ 22` + 每处命中含 `\bsf-btn\b` | **保持**：详情页 CTA **必须**保留 `sf-btn` 基类（去刷新按钮后 ItemDetailPage 的 `sf-btn` 命中由 2 降 1，**仍 ≥1** ⇒ 文件仍在清单内） |
| 11 | `p6-btn-impl2.test.js:135-153` | `.sf-item-btn` 规则：`min-height: var(--sf-l-ctl-h)` · `padding: 8px var(--sf-st-padx-btna)` · `cursor: pointer` · **不得含** `background` / `border`；`--sf-l-ctl-h` 声明值 == `STRUCT['h-btna']`（**34px**） | **保持（一字不动）**：新形状走**新修饰类 `.sf-item-cta`**；`--sf-l-ctl-h` 的 `34px` 基准 + `767` 块内 `44px` 覆盖**均不动** |
| 12 | `p6-btn-impl2.test.js:196-214` | 旧 token `--sf-(btn\|btnsm)-*` 的 `var()` 引用全仓 = 0 | **保持**：新 CSS **只用** `--sf-btna-*` / `--sf-st-*` / `--sf-l-*`；**严禁** `--sf-btn-*` |
| 13 | `p6-btn-impl2.test.js:~226` | 家族 CSS 选择器无 `[data-theme` / `theme-(day\|night)` | **保持**：新 CSS 用常量变量表达两档，**不写主题选择器** |
| 14 | `i18n-content-wiring.test.jsx:248-262` | `WIRED` 含 `pages/item/ItemDetailPage.jsx` 且文件含 `i18n-content` 且无 `_(en\|hk\|vn)\s*\?\?` | **保持**：`import { contentStatus, pickLocalized } from '../../i18n-content'` **逐字保留**；多语取值一律 `\|\|` 链 |
| 15 | i18n 计数断言 **12 文件**（§19.7 列名） | `top 122` / `flat 1045` / `节点 4180` | **零改锚**（**本轮零新增键** ⇒ 计数逐字不变） |
| 16 | `theme-tokens.test.js`（`TOKEN_KEYS ≥ 100` / 日/夜差异键 > 90 / PROV 回读） | token 层不变 | **零改锚**（零新 token） |
| 17 | `i18n-violation-closeout.test.jsx:②`（脚本 `p4z-i18nviol-global.mjs`） | 全量源面 · locale 节点 4180 · 裸命中 0 | **零改锚**；**约束**：`ItemDetailPage.jsx` / `item.css` 新增注释**不得**出现「`/*` 收尾的路径字面」（吞码，见 `N39` / §19.9） |
| 18 | `s8-locale-key-coverage.test.js` / `s9-ledger-kind-closure.test.js` | 键计数 + 检测器自证 | **零改锚** |
| 19 | `app-routes.test.jsx` / `route-exchange-rename.test.jsx` / `listing-publish-redirect.test.jsx:67` | 路由面 / 其自设 probe（`item-detail-probe`，**非本组件**） | **零改锚**（本单不改路由） |

> **须由 Kong 在实现轮**顺带核的两条「契约型」：`p6-btn-impl2` 家族清单（#10）与 `.sf-item-btn` 规则（#11）——**若实现把 CTA 单独改用新类并删掉 `.sf-item-btn` 规则本体 ⇒ 立刻红**。

### 19.7 i18n（**本轮零新增 / 零删除**）

| 项 | 口径 |
|---|---|
| 新增键 | **0**（返回箭头 a11y 名**复用既有键** `item.list`；CTA 文案**复用既有键** `item.buy` = zh「立即购买」/ en「Buy Now」/ hk「立即購買」/ vn「Mua ngay」；状态 / 库存 / 数量 / 描述键**全部既有**） |
| 删除键 | **0**（`item.refresh` 键**保留**；见下「登记」） |
| 键集 | **顶层 122 / 拍平 1045 / 四语节点 4180 —— 逐字不变**（与 §19.1 现取基线同） |
| 四语同补 | **不适用**（零新增 ⇒ 无「漏补某语」风险） |
| **登记（键卫生）** | 去刷新按钮后 **`item.refresh` 暂无常驻消费点**（原唯一消费 = `ItemDetailPage.jsx:111`）。**判定 = 保留键、非死键清理对象**（理由：① 无任何断言强制「零死键」；② 刷新属**可恢复的产品动作**，将来接入详情面板头部即可复用；③ 强删会牵动 `i18n-violation-closeout` 改写集与计数面，收益为零）。**挂账**：若 Kevin 明确「详情页永久不要刷新」⇒ 下一轮按 `F13` 体例（四语同删 + 计数前推）处理。 |

> **★ 硬门复述**：**四语键集逐文件相同**是硬门；本单零改动 ⇒ 该门**自动维持**。**若实现轮违反「零新增」多补了任一键 ⇒ §19.6 #15 的 12 个计数断言会集体红**（且须四语同补，否则渲染裸键名）。

### 19.8 归因式 AC（`T96` / `T97` 展开 · **不用元素白名单**）

**AC-1（详情页渲染面）**：`/item/:id`（四语前缀各一次）上，**可见**元素集合**逐项等于** §19.5「渲染面」六项之并集；**差集 = 0**。**判负**：出现 §19.5「不渲染面」任一项可见元素 ⇒ 判负。

> **★ v1.16 AC-1 判据补齐（就地注 · 旧字面逐字保留）**：「§19.5『渲染面』六项之并集」**改读为「六项 + `R-A` 三键 + `R-F` 的 `buyNote`（共八类）」之并集**（见 §19.5 ★ v1.16 白名单补齐）。**实测佐证**（质检 `AC-1`）：白名单六项齐备 + `R-A` 三键 + `R-F` 一键同处 `.sf-item-meta-group`；**未归因元素 = 3 个，全部可归因**（`svg.lucide-chevron-left` + `path` = ⑥ 返回箭头图标子树、`FORM` = ④ 操作栏表单壳〔无 class，持既有钩子 `data-sf-m="item-buy-form"`〕）⇒ **有效差集 = 0**。**判负阈值不变**（出现「不渲染面」任一项可见元素 ⇒ 判负）；**排除项串扫描命中 = 0**（`刷新/返回列表/卖家/品牌/成色/包邮/想要/浏览/留言/收藏/聊一聊/比市场价`）· **禁用 class 命中 = 0**（`sf-item-seller` / `sf-item-attr` / `sf-item-promo` / `sf-item-stats` / `sf-item-price-orig` / `sf-layout-side` / `sf-item-detail-side`）。

**AC-2（入口不丢失 · 归因式）**：详情页（`/item/:id` + 四语前缀 + `/item?id=` 兼容档）上：① **存在且仅存在一个**页内返回入口 `.sf-item-back`，其 `href ∈ {'/', '/zh/', '/en/', '/hk/', '/vn/'}`（= `root('/')`）；② 该入口**可见且可点**（`display ≠ none`、`rect` 非 `0×0`）；③ **可达路由差集 = 0**：底栏隐藏后，`/item/:id` 上「可达的对外路由集合」经 `返回箭头 → 首页 → 底栏 5 目标` **不减少**（即被隐藏的 5 个目标仍全部可达）。**判负**：任一 target 不可达 ⇒ 功能回归。

> **★ v1.16 AC-2 的 href 字面集改锚（就地注 · 旧字面逐字保留）**：实现产出**无尾斜杠** —— `href ∈ {'/', '/en', '/hk', '/vn'}`（zh 无前缀，语义等价 `root('/')`）；实测 7 种路径形态：`/item/1`→`/`、`/zh/item/1`→`/`、`/en/item/1`→`/en`、`/hk/item/1`→`/hk`、`/vn/item/1`→`/vn`、`/item?id=1`→`/`、`/en/item?id=1`→`/en`。**根因** = `buildLocalizedPath(lang,'/')` 的**既有行为**（非缺陷）⇒ **判据改读为无尾斜杠形态，或明文注明「忽略尾斜杠」**；「规范字面（`/zh/` 等带尾斜杠）vs 实现字面（`/`、`/en` …）差一个 `/`」**登记为字面差异、非缺陷**（react-router 归一，语义等价）。

**AC-3（「只改详情页」的归因式判据）**：**非详情页**（`/`、`/item/new`、`/exchange`、`/messages`、`/profile`、四语前缀档）的 DOM 签名与几何**差异集 = 0**（改前 vs 改后，同脚本对拍）。**允许变更集（详情页）** = 具名枚举：**(i)** 详情页渲染面变更（§19.5 六项 + 删除的占位）· **(ii)** `/item/:id` 上底栏 `display:none` 引起的**该页**文档高度 / 后续元素 y 位移 · **(iii)** 新增页面局部结构常量（§19.4 末表）引起的字号 / 高度位移。**反事实归因实验**：只在测量期恢复 `.sf-tabbar{display:grid}`（不动仓库）⇒ 差异集里 **(ii)** 类条目**必须消失**，其余不变（即 (ii) 类**确实**只归因于底栏隐藏）。**判据**：差异集 ⊆ {(i),(ii),(iii)}，且反事实回退后「仅归因有 / 仅基线有」**均为空**。**不得**用元素白名单替代。

**AC-4（触控与字号）**：≤767 档：返回箭头 ≥44×44（`.sf-tap-sq`）· CTA `min-height ≥ 44`（`--sf-l-ctl-h` 覆盖）· **所有可见文本 ≥12px**。>767 档：`--sf-l-ctl-h` 仍 34px（桌面 `p6-btn-impl2` 冻结值，**不得**连带抬高）。

**AC-5（桌面档行为 · `T97`）**：`>767` 档：`.sf-item-actionbar` **不出 `fixed`**（`position: static`，在内容流内）· 底栏仍 `display:none`（既有）· 详情页导航不受本裁定影响。**判负**：桌面详情页操作栏 `position: fixed` ⇒ 判负。

**AC-6（主题同构不破）**：详情页在日 / 夜两档下，**几何（rect）逐值相等**（一切新增几何量取结构常量 / 页面局部常量，两档同值）；新增 CSS **无** `[data-theme` 选择器、**无** per-theme 颜色字面量。

### 19.9 新增可复用教训（`N39` / `N40` · 承 `N32`–`N38`）

- **`N39`（承接 `N35`）**：**在页面源文件 / CSS 的新增注释里，「`/*` 收尾的路径字面」是禁写项 —— 它就是本仓审计脚本吞码的引信。** 机制：`frontend/scripts/p4z-i18nviol-global.mjs` 的 `codeOf()` 用**非贪婪**正则剥块注释 ⇒ 注释里出现 `/api/xxx/*` 这类**以 `/*` 结尾的路径字面**，剥注释器会把那个 `/*` 当**块注释起点**、**静默吃掉后面约 3 KB 代码** ⇒ 该脚本报的「违例 0」是**假绿**（实测最严重一处从 `App.jsx:16` 起吞掉 16–76 行，含全部路由定义）。**定式**：注释里改写成 `/api/xxx/…` 或 `/api/<name>`；**不得去改剥离逻辑**。**本单适用面**：`ItemDetailPage.jsx`（本轮要在此加注释）与 `item.css`。**自证**：改完全仓复扫并核「脚本报的四语节点数 = 拍平键数 × 4 = `1045 × 4 = 4180`」——**数与冻结断言对不上时，先怀疑吞码，不要先改断言值**。
- **`N40`（新 · 页面级隐藏共享外壳元素的口径）**：**当某页面需要隐藏一个「由外壳渲染、且被同构硬断言锚定 DOM 恒在」的共享元素时，正解 = 该元素恒在 DOM + 由页面路由条件挂一个修饰类 + 隐藏规则落「全局 CSS 顶层」** —— 三件缺一不可：① **DOM 不移除**（保住「同构 ⇒ DOM 恒在」这块硬核与五 region 断言）；② **状态挂点选在那个已持有路由信息的组件**（本单 = `BottomTabBar.jsx` 已有 `useLocation()`；**只准路由串匹配，不得借机引入宽度判定** —— 撞外壳 `matchMedia`/`innerWidth` 硬断言）；③ **CSS 落点避开带断言的外壳文件**（`shell.css` 挂「唯一 767 断点块 + 无 `[data-theme]`」双边断言）⇒ 落 `src/styles.css` **顶层**（不入 `@layer`、不入 `@media`），并**靠具体性**（`.sf-tabbar.is-detail` = (0,2,0) ＞ `.sf-tabbar` = (0,1,0)）压过断点块内的可见性翻转。**反例代价**：DOM 移除 ⇒ 6 处同构断言集体红、且拆掉同构判据的第一性证据。

- **`N41`（新 · v1.16 · 跨文件同具体性覆盖）**：**本仓打包序下，页面 CSS 先于 `shell.css` 落地** ⇒ **页面新增的「单类」形状修饰**（如 `.sf-item-cta`，(0,1,0)）**会被 `shell.css` 里同具体性的 `.sf-btn{border-radius:…}` 后置覆盖**（实测圆角由 `999px` 退回 **`8px`**）。⇒ **页面级形状修饰必须在选择器上取胜**（复合选择器 `.sf-btn.sf-item-cta` = (0,2,0)，或更高）。**判据 = `border-radius` 的计算值**（**不可只看声明** —— 同具体性时后置者赢，声明写对也可能算错）。**实证**（质检 `R-B`）：逐 stylesheet 顺序枚举命中该元素的 `border-radius` 规则 ⇒ `.sf-btn.sf-item-cta`（order **73**）＜ `.sf-btn`（order **216** 与 **1292**）＜ UA `button{0}`（order 245）⇒ **页面 CSS 确实先落地**、靠 (0,2,0) 取胜；打包产物同证（`.sf-btn.sf-item-cta` 字节位 **4836** ＜ `.sf-btn{` 的 **17558 / 95567**）。**判负**：注入同具体性后置 `.sf-btn.sf-item-cta{border-radius:8px}` ⇒ 读回 **`8px`**（质检 `NC2` 已证：规则确在被测量）。**同族** = `N40`（具体性压过断点块）。

- **`N42`（新 · v1.16 · 证据入库 vs `.gitignore`）**：**仓内 `/.*-artifacts/` 通用规则会吞掉新证据目录** ⇒ **用 `git add -f` 入库属已登记口径**（同形**已跟踪**目录 = `frontend/.p7cqa-` · `frontend/.p7dqa-` · `frontend/.p7eqa-artifacts`）。**入库后必须回读两读数自证**：① `git check-ignore`（列举被忽略的路径 ⇒ 确认该目录确实命中 `.gitignore` 规则）；② `git ls-files`（列举已入库文件 ⇒ 确认 `-f` 真的把它们加进来了）。**缺任一读数 ⇒ 证据「以为入库、实则被忽略」**。**定式**：凡把新证据目录落进仓库，先跑 `git status --porcelain` 看它是否出现在 `??`；若不在（被 `.gitignore` 吞掉）⇒ 用 `-f` 强制入库，并交 `check-ignore` + `ls-files` 两读数。

### 19.10 留痕（**取代 · 仅限详情页** · 旧措词逐字保留）

- **被本裁定收窄的旧口径**：`T46` / `T80`（v1.5 §14）**「底栏（H5）恒 5 格」**。**本单 `T95` 就地收窄** = **`/item/:id` 详情页隐藏底栏**；**其余页面 tabbar 照旧（恒 5 格）**。**旧行原文一字未改**（`T46` / `T80` 行内字面保留）。**取代范围 = `T80` 的「恒 5 格」在 `/item/:id` 上失效；`T80` 的五项集合 / 图标 / 目标 / 可见性规则在其余页面**逐字不变**。
- **`T86`（汉堡去重）不受影响**：`T86` 口径基于**底栏目标集**（route 面 = `/`、`/exchange`、`/item/new`、`/messages`、`/profile`）—— 本单**不改集合**（只是详情页不显示底栏）⇒ **`MOBILE_PANEL_EXCLUDED_PATHS = ['exchange']` 逐字不变**。
- **`T75`（底部安全区）复刻**：操作栏 `padding-bottom: env(safe-area-inset-bottom)` 与 `.sf-tabbar` **同形复刻**（`T75` 冻结的 `viewport-fit=cover` 前提不变）。**详情页上底栏隐藏 ⇒ 两处安全区不叠加**（同一时刻只有一个承担底部安全区）。

### 19.11 待裁项（**不得自选** · 交 Kevin 拍板）

| # | 待裁 | 变体 | 代价 |
|---|---|---|---|
| **Q1** | **「聊一聊」= 站内信 vs 站外信** | **(a) 站内信**（复用 `MessagesPage` / 站内私信链路）· **(b) 站外信 = Telegram**（新开外链 / 新接驳层，原「接推特 X」计划作废）· **(c) 站内 + Settings 引导绑 Telegram**（两段式） | (a) 成本 S，但需后端私信链路；(b) 成本 M（外链即离开本站，**可达性 / 隐私 / 归因**三处要重定）；(c) 成本 M+，体验最完整。**本轮一律不渲染**（三选一都不影响本轮） |
| **Q2** | **CTA 胶囊圆角** | **(a) 全圆胶囊** = `--sf-st-radius-pill`（`999px`，**本册默认，照参考图**）· **(b) 家族一致** = `--sf-st-radius-btna`（`8px`，遵 §P6-UI-CONSIST-B） | (a) 与参考图一致，但**页面局部偏离按钮家族形状语言**；(b) 家族一致，但与参考图观感有差。**两者皆零新 token**，一句话可改 |
| **Q3** | **详情页大号价格字号** | **(a) 28px**（本册默认）· **(b) 32px**（更贴参考图比例） | 字号越大越贴参考图，但窄屏（320）长价串有换行风险 ⇒ (b) 须补 `320` 档零横向溢出读数 |

> **★ v1.16 就地回写（`Q2`/`Q3` 已裁 · 旧字面逐字保留）**：**`Q2` 已裁 =（a）全圆胶囊 = `--sf-st-radius-pill`（`999px`）**（⇒ §19.13 `R-B`；上表 `Q2` 的「（a）/（b）」两变体字面**已被 v1.16 的 `R-B` 取代**）。**`Q3` 已裁 =（b）32px + 320 档硬门**（⇒ §19.13 `R-C`；上表 `Q3` 的「（a）28px（本册默认）/（b）32px」两变体字面**已被 v1.16 的 `R-C` 取代**）。**`Q1`（聊一聊 = 站内信 vs 站外 Telegram）维持待裁**（`docs/OPEN-ITEMS.md` `A5` 登记）。裁定来源 = Zang 2026-10-12 终审（`docs/OPEN-ITEMS.md:98` 已记「Q2/Q3 已裁 = 胶囊 999px / 价格 32px + 320 档硬门」）⇒ 本版把 §19.11 由「待裁」就地回写为「已裁」。

> **★ v1.17 就地注（`Q1` 已裁 · 上行原地一字未动）**：**`Q1` 已裁 = (c) 站内 + Telegram bot 绑定/通知**（Kevin 2026-10-12 逐字「直接 A+C」：**站内信最小闭环 + Telegram bot 绑定/通知一步到位，不走分期**）—— 即「聊一聊」= **站内信会话**（变体 (a) 的实现面），**Telegram bot = 通知/绑定面**（`Settings` 发起，变体 (c) 的 Settings 引导段）；「本轮一律不渲染」字面**已被 v1.17 `T100` 取代**（第 3 格激活）；route v2.27 §37 的「X/推特私信接驳位预留」语义**作废 ⇒ Telegram，非 X**。路由/错误码/降级契约 = `route-layer.spec` v2.31 §41；库面 = `data-layer.spec` v0.32 §38；形态/AC = 本册 §20。

### 19.12 未核实 / 登记（诚实清单）

- **本单只写 `docs/**`**：未动 `frontend/**` / `tools/**` / `ctrl/**`；**未启停任何服务**（绝不 `pm2 restart`）；**未 `git add -A` · 未 commit · 未 push**。
- **实现 / 验收面归 Kong**：`BottomTabBar.jsx` 的 `is-detail` 类 · `styles.css` 的一行隐藏规则 · `ItemDetailPage.jsx` 的渲染面收窄 · `item.css` 的页面局部常量与操作栏 —— **全部 NOT_IMPLEMENTED**（本册只冻口径）。
- **几何 / 触控 / 归因读数 = NOT_MEASURED**（本单未起实例、未开浏览器）⇒ §19.8 六条 AC 的**实测**归 Kong / Neng。
- **真机面**：操作栏 `env(safe-area-inset-bottom)` 与底栏隐藏后的底部视觉在**真机 vs 设备档**的差异属已知保真度缺口（`frontend-parity-acceptance`「设备档 ≠ 真机」）⇒ 真机由 Kevin / Kong 验；`env()` 在设备档恒 0。
- **姊妹册同步（**待办 · 交回 Zang**）**：本单**不改路由**，故 `docs/route-layer.spec.md` **本轮无需改**；**若 Kevin 后续裁定「聊一聊 = 站外 Telegram 外链」**，则会**新增一个对外链接面** ⇒ 届时须在 route 册登记（**本册不代改，列成待办交回**）。
- **`docs/seafood.master-plan.md`（台账）与 `docs/OPEN-ITEMS.md`（挂账）** —— 依角色边界**本册不改**（台账归 Zang）；建议 Zang 追加一节并登记本单（`T94`–`T99` / `N39`–`N40` / `Q1`–`Q3` 待裁）。

- **★ v1.16 诚实清单更新（就地追加 · 引质检 `not_measured`）** —— 三项标 **`NOT_MEASURED`**：① **真机 `env(safe-area-inset-bottom)`**：设备档恒 `0` ⇒ 底部安全区的真机表现 `NOT_MEASURED`（入口 `http://<LAN-IP>:5800/...`，由 Kevin / Kong 验；`>767` 档 `computedFootPadBottom ≡ 0px`、操作栏 `static` 已由质检现取）。② **`:has()` 在非 Chrome 浏览器（Safari / Firefox）的实际渲染**：只在 **Chrome**（+ 本机 Chromium）实测；Safari / Firefox 的降级行为是**推理 + caniuse 版本表**（Chrome 105+ / Safari 15.4+ / Firefox 121+），**非本机实测** ⇒ `NOT_MEASURED`。③ **mock 数据面**：本轮页面读数都在 **API mock**（`/api/prize/:id` 单行夹具）下取得 ⇒ **真库数据形态下的几何未测** `NOT_MEASURED`（本仓 dev 库与生产不同源，已知口径）。**★ 另登记**：质检报告 `docs/qa/v115-item-detail-qa.md` + 机器可读读数 `docs/qa/v115-item-detail-qa.readings.json` 为**独立质检方（Neng）交付件**（**入库 commit `4f69080`**；非本单写面）。

- **★ v1.16 快照口径声明（写死）**：`docs/versions/` 里的**旧快照一字不改（历史冻结点）** —— 尤以 `docs/versions/design-system.spec.v1.15.md:1617`（§17.4）含**已过期钩子字面** `data-sf-m="item-back-link"`（实现已改名 `item-back`），**该过期字面属历史、不回改**；现行口径以主件（本册）§17.4 的就地更正 + §19.13 为准。

- **★ 姊妹册同步（v1.16 · 就地更正 1 行）**：`docs/route-layer.spec.md:8042`（§40.1「附入口」行）的钩子字面 `item-back-link` ⇒ `item-back` **就地更正**（route 册本节**只改此 1 行**、不动其它；**路由集合 / 路由数量零改动**，`git diff --numstat` 删除列 = 1 = 局部改正行）；旧快照 `docs/versions/route-layer.spec.v2.30.md` 一字不改。


---

## §19 增量 · v1.16 回写（`R-A`–`R-F` 六条终审裁定 + `Q2`/`Q3` 已裁 + 白名单/AC-2 判据补齐 + `N41`/`N42` + §17.4 钩子更正）（**本节只追加 · 依据 = Zang 2026-10-12 六条终审裁定 + 质检 `docs/qa/v115-item-detail-qa.md`（verdict = PASS）+ 实现 commit `2aee62f`（本地 · 未 push）**）

> **本节性质（写死）**：① **只追加**；对既有节的改动全部为**行后就地注 / 就地更正**，**原地裁定原文一字未改**（旧字面一律逐字保留 + 标「已被 v1.16 取代」）；② **零代码** —— 实现（`ItemDetailPage.jsx` / `item.css` / `BottomTabBar.jsx` / `styles.css`）**已在 commit `2aee62f` 落地**（本地 · 未 push），本册只承载口径 / 判据；③ **未动 `frontend/**` / `tools/**` / `ctrl/**`** · **未启停任何服务**（绝不 `pm2 restart`）· **未 `git add -A`** · **未 commit** · **未 push**；④ **现取基线 = HEAD `2aee62f`（本地 commit · 未 push）**。

### 19.13 `R-A`–`R-F`（Zang 六条终审裁定 · 2026-10-12 · 逐条 · 在 v1.15 §19 冻结口径之后追加）

> **背景**：v1.15 §19 只冻结到 `T94`–`T99` + `Q1`–`Q3` 待裁；其后 Zang 又下**六条终审裁定 `R-A`–`R-F`**，实现已落地（commit `2aee62f`）⇒ 规范文本落后于实现，本条把六条回写进册（**作者义务**）。

| 编号 | 【本册裁定】口径 | 落点（文件 / 选择器 / 类） | 依据 / 判据 |
|---|---|---|---|
| **`R-A`** | 【Zang 终审】**`item.line` / `item.priceServerNote` / `item.refundStockNote` 三键保留**，由 v1.15 的**侧栏列**（`.sf-layout-side`）**折进详情面板 `.sf-item-meta-group`**（小标题 `item.line` + 两条说明行）⇒ 详情页上 `.sf-layout-side` 消失、`.sf-layout` 退化为**单列**。 | `frontend/src/pages/item/ItemDetailPage.jsx:155-160`（`.sf-item-meta-group` = `<h2>{t('item.line')}</h2>` + 三条 `.sf-item-meta`） | **依据 = 既有用户可见内容、零数据依赖、删则成死键**（三键 locale 四语齐备、原由侧栏渲染；删除会让键无常驻消费点 ⇒ 键卫生负）。**判据** = 三键文案在 ≤767 与 >767 均**可见且同处** `.sf-item-meta-group`（320/390/1440 一致）；`.sf-layout-side` / `[data-sf-m="item-detail-side"]` 全仓源码 **0 命中**、渲染面 0 命中。 |
| **`R-B`** | 【Zang 终审】**CTA 胶囊圆角 = `var(--sf-st-radius-pill)`（`999px`）**，落**复合选择器 `.sf-btn.sf-item-cta`**（(0,2,0)），**不得落 `.sf-item-btn` 规则本体**（`p6-btn-impl2` 校验它）。 | `frontend/src/pages/item/item.css:356-359`（`.sf-btn.sf-item-cta{border-radius:var(--sf-st-radius-pill); flex:1 1 auto}`） | 依据 = Kevin 变体 A 拍板（参考图 CTA 为全圆胶囊；**页面局部偏离** `--sf-st-radius-btna` 家族口径，登记）。**判据 = `border-radius` 计算值 = `999px`**（不可只看声明；见 `N41`）。**判负**：注入同具体性后置 `.sf-btn.sf-item-cta{border-radius:8px}` ⇒ 读回 `8px`（质检 `NC2` 已证）。 |
| **`R-C`** | 【Zang 终审】**详情页大号价格字号 = 32px**（`--sf-l-detail-price-size`），**硬门 = 320 档零横向溢出**（`documentElement.scrollWidth == clientWidth`）；**若 320 档溢出则回落 28px**（28px = 备值）。 | `frontend/src/pages/item/item.css:24`（`--sf-l-detail-price-size: 32px`）+ `:330-332`（`.sf-item-price-l .sf-item-price-num{font-size:var(--sf-l-detail-price-size)}`） | **依据** = 更贴参考图比例（v1.15 `Q3` 的 (b)）。**硬门**：320 档 `overflowX = false`（质检 `R-C` 读数 `scrollWidth == clientWidth == 320`，含极端长价串 `123456789.99` + 超长标题 + 120×长描述压测）。**判负**：320 档 `scrollWidth > clientWidth` ⇒ 回落 28px 并重测。 |
| **`R-D`** | 【Zang 终审】**≤767 档：详情容器 `.sf-item-detail` 必须有等量底部内边距**（`calc(var(--sf-l-actionbar-h) + var(--sf-l-actionbar-safe))`）⇒ 文档高较无此内边距 **+60px**。**判据 = 机械量**（见 §19.14「`R-D` / `R-E` 判据分离」）。 | `frontend/src/pages/item/item.css:373-375`（`@media (max-width:767px){.sf-item-detail{padding-bottom:…}}`） | **判据 = 机械量「≤767 文档高 +60px」**（中和后恰减 60px：320 `1277→1217` · 390 `1165→1105` · 767 `1145→1085`；>767 中和无效 = `1009` 不变）。**★ 其「内容不被操作栏遮挡」的效应在「页脚恒在」现状下不可独立复现**（质检 `NC3`：`R-D` 单独中和 ⇒ 遮挡不出现）—— 页脚保护归 `R-E`。 |
| **`R-E`** | 【Zang 终审】**详情页限 `:has()` 页脚补齐**：`.sf-shell:has(.sf-item-detail) .sf-region-foot{padding-bottom:…}` ⇒ ≤767 档给 **shell 页脚**（在路由容器之外）补等量底部内边距。**判据 = 内容级遮挡**（见 §19.14）。 | `frontend/src/pages/item/item.css:382-388`（`@media (max-width:767px){.sf-shell:has(.sf-item-detail){--sf-l-detailbar-h:60px} … .sf-region-foot{padding-bottom:calc(var(--sf-l-detailbar-h)+env(safe-area-inset-bottom))}}`） | **判据** = ≤767 三档（320/390/767）`lastLeafOverlapPx` = **0** 且 `lastLeafCovered` = **false**；**去 `R-E` 必须回 29 / true**（质检 `NC4` 已证）；**>767 档 `computedFootPadBottom ≡ 0px` 且操作栏 `static`**（不误命中）。**只在固定档（`position:fixed`）判定该量**（>767 操作栏在流内 ⇒ 该量恒真无意义）。**`footCoveredPx` 是无效判据**（见 §19.14）。 |
| **`R-F`** | 【Zang 终审】**`item.buyNote` 保留渲染**（并入同一 `.sf-item-meta-group`），文案 = 「购买金额以平台结算为准；重复点击不会重复扣款。」 | `frontend/src/pages/item/ItemDetailPage.jsx:158`（`<p className="sf-item-meta">{t('item.buyNote')}</p>`） | **依据 = 携带幂等告知「重复点击不会重复扣款」**，与 `item.priceServerNote`（「购买金额由平台统一结算，无需填写价格或收款方」）**不冗余** —— 后者讲**结算归属**、前者讲**幂等去重**，对支付 CTA 均是对用户的有效告知。**判据** = 文案在 320/390/1440 三档可见；locale 四语键与计数**一字未动**（`122/1045/4180`）。 |

> **六条共同的落点约束（复述硬口径）**：**零新主题 token**（`TOKEN_KEYS` 一字不动）· 新增几何量一律**页面局部 `--sf-l-*` 落 `item.css`**（不得进 `tokens.js` 的 `STRUCT`）· 新增 CSS **无** `[data-theme` 选择器 · **不改 `.sf-item-btn` 规则本体** · **`shell.css` 一字不动** · 可见文本 **≥12px**（`T79` 不破）。

### 19.14 `R-D` / `R-E` 判据分离（**防后人再次混淆** · 写死）

> **背景**：v1.15 派单把 `R-D` 写成「详情页等量底部内边距（**内容不被操作栏遮挡**）」，措辞把两条裁定的效应混为一谈。质检 `NC3` 实测：**`R-D` 单独中和时遮挡不出现**（被固定操作栏压住的是**页脚**〔文档末元素〕，而页脚保护是 `R-E` 的职责）⇒ **两条判据必须分离**。

| 裁定 | 判据类型 | 判据（写死） | 档位 | 判负 |
|---|---|---|---|---|
| **`R-D`** | **机械量** | ≤767 档 `.sf-item-detail` 计算 `padding-bottom` = `60px`；**中和后文档高恰减 60px**（320 `1277→1217` · 390 `1165→1105` · 767 `1145→1085`）；>767 档 = `0px`（中和无效，`1009` 不变） | ≤767 三档 | 中和后文档高不减 60px ⇒ 判负 |
| **`R-E`** | **内容级遮挡** | ≤767 档 `lastLeafOverlapPx`（页脚最后可见叶子的底 ∩ 操作栏带 = `barTop`）= **0** 且 `lastLeafCovered` = **false**；**去 `R-E` 必须回 `29` / `true`**；>767 档 `computedFootPadBottom ≡ 0px` 且操作栏 `static` | **只在固定档（`position:fixed`）判定**（320/390/767） | `lastLeafOverlapPx > 0` 或 `lastLeafCovered = true` ⇒ 判负 |

- **★ 档位限定（写死）**：`lastLeafCovered` **只在 `position:fixed` 的操作栏档（≤767）成立**；在 `>767` 档操作栏在内容流内（`static`，y `408.5`–`468.5`），`lastLeafBottom(767.5) > barTop(408.5)` 会**恒真** ⇒ **该量在 >767 无意义**，判据**必须限档**。
- **★ `footCoveredPx` 是无效判据（写死 · 这是 `T99` 原判据与我原判据共同踩的坑）**：`footCoveredPx`（页脚盒 ∩ 操作栏盒）**在 / 去 `R-E` 都 ≡ 61**（= 操作栏高）—— 因为**页脚是文档末元素**，滚到底时盒底恒落视口底 ⇒ **该量对 `padding` 不敏感、不是遮挡量**，**不得**作 `R-E`（或 `R-D`）的判据。质检 `R-E` 独立复现（`withAll` / `neutralize_footer` / `neutralize_detail` / `neutralize_both` 四变体 `footCoveredPx` 恒 `61`，`lastLeafOverlapPx` 随 `R-E` 在否 0↔29 变）已证。
- **★ `:has()` 降级量（登记 · 非缺陷）**：不支持 `:has()` 时整条 `R-E` 规则被丢弃 ⇒ 页脚最后可见叶子被固定操作栏压住 **29px**（= `61 − 32` 基础留白）；**余量 = 60 − 29 = 31px**（真机 `env(safe-area-inset-bottom)` 下操作栏与页脚同步抬高 ⇒ 余量不变，真机不翻车）。本机 Chrome `CSS.supports('selector(:has(*))')` = true；主流面 Chrome 105+ / Safari 15.4+ / Firefox 121+ ⇒ **风险定级 = 低**（只影响 2022 年前老浏览器）。**零风险备选**（本单不动）= 给页脚补一条不依赖 `:has()` 的等价规则（需另裁）。





---

## §20 ★★ v1.17 · A5 收口：「聊一聊」第 3 格激活（`T100`）+ `/messages` 占位页转真页（`T101`）+ Settings 绑定/解绑面（`T102`）+ 未读角标（`T103`）+ 教训 `N43`（**本节只追加 · 旧行一字未改** · 依据 = Kevin 2026-10-12 逐字「直接 A+C」+ Zang 结构裁定 1–9（`docs/OPEN-ITEMS.md` `A5` 行 commit `3ae743e`）；姊妹册 = `route-layer.spec` v2.31 §41（路由/错误码/authz）+ `data-layer.spec` v0.32 §38（DDL））

### 20.0 裁定来源（Kevin 2026-10-12 · 逐字采用）

| # | 字面/裁定 | 本节落点 |
|---|---|---|
| K1 | 「直接 A+C」= **站内信最小闭环 + Telegram bot 绑定/通知一步到位**，不走分期 | `T100`–`T103` 全节 |
| K2 | 询价意向单/计数（`D2`/`D4`）**不在本单**（挂账 = `F17`） | 本节不含任何意向单面 |
| Z2 | 登录才能发；**卖家本人看自己商品 ⇒ 「聊一聊」不渲染** | `T100` |
| Z3/Z4 | 通知双语一行不带内容；`users` 只存 `tg_user_id`；解绑即停推 | `T102`（隐私 = 绑定面不显示数字 ID） |
| Z5 | Settings 发起 → code（10 分钟）→ `/start <code>` → webhook 落库 | `T102` |
| Z6/Z7/Z8 | 防刷（20 条/天/会话 + 全局日上限）/ keyset 禁 OFFSET / env-gated 降级 | §20.4（429 文案）· §20.5（降级卡） |

> **★ 勘误就地注（2026-10-15 · 上表 `Z3/Z4` 行 · 旧字面逐字保留、已被本勘误取代）**：上表 `Z3/Z4` 行原字面 =「**通知双语一行不带内容**；`users` 只存 `tg_user_id`；解绑即停推」—— 其中「**不带内容**」**已被 Kevin 2026-10-15 裁定取代** ⇒ **现行 = 双语一行 + 消息开头预览 = 首 6 个显示宽单位**（汉字 / CJK / 全角标点计 2 ⇒ 恰 3 个汉字；拉丁 / 数字计 1；超出加 `…`；恰好满额不加；空正文不追加；emoji 不拆）。**该行其余字面（`users` 只存 `tg_user_id` / 解绑即停推）逐字不变**；**上表原文未改写**（只追加本注 + 标取代，承本册 v1.18 体例）。**同步面** = 姊妹册 `docs/route-layer.spec.md` v2.33 §41.0 裁定列表第 4 项 + §41.7 勘误留痕（同裁定权威落点）；本册另一落点 = §20.8 `telegram.desc` 行（四语）+ §20.11 待裁项 2。**本册判据面**：§20.9 / §20.12 无「通知内容」类判据项 ⇒ **不新造判负**（承 route 册同口径处置）。

### 20.1 现取基线（本单开工 · HEAD `3ae743e` · 2026-10-12）

| 项 | 现取读数 |
|---|---|
| 本册改前行数 / 字节 / md5 | **1923 行 / 422,501 B / `0400a3d9bbcc38b22cae0190b658c8ee`** |
| 四语键集 | **顶层 122 / 拍平 1045 / 四语节点 4180**（逐文件相同） |
| `/messages` | `App.jsx:117` `<Route path="messages">` + 占位页（`MessagesPage.jsx`：钩子 `messages-page` / `messages-x-placeholder`；键 `messagesPage.title`/`empty`/`xPlaceholder`/`xNote`） |
| 详情页操作栏 | §19.5 槽位口径 = 「N 格 CTA 区 + 主 CTA」单行 flex，**本轮 N = 0**；钩子 `data-sf-m="item-actionbar"`（v1.16 现取） |
| 底栏 / 桌面 nav | `nav.js` 五项（第 4 格 `messages` → `/messages`）；桌面悬浮菜单（`T81`）五项含「消息」 |
| ProfilePage | `pages/ProfilePage.jsx`（`data-sf-m="jobs-profile"` 等既有钩子；本节只**新增卡片**，不动既有块） |
| 后端事实 | 无会话/消息表；注册点 89；`LEDGER` 33 码闭集；Telegram 痕迹 0（姊妹册 §41.1 / §38.1 同源现取） |

### 20.2 规则条文（`T100`–`T103`）

| 规则 | 条文（写死） |
|---|---|
| **`T100`** | `/item/:id` 底部固定操作栏**第 3 格**渲染「聊一聊」CTA（复用既有 `.sf-btn` 黄底深字家族 + `--sf-st-radius-pill` 胶囊，`R-B` 口径；零新颜色）。**渲染条件 = 登录 ∧ 非卖家本人**（判定数据 = `seller.uid`（`F19` 读口）vs 当前用户；卖家本人 ⇒ 整格不渲染）；未登录 ⇒ 点击走**既有登录引导**（同 `/profile` 受保护项行为，不新造弹层）。**点击 = `POST /api/messages/conversations`（自然幂等，route §41.2 #1）成功后进入 `/messages` 会话详情**。第 1 格「留言」/ 第 2 格「收藏」**仍不渲染、不预埋 DOM**（N = 0 → 1）。 |
| **`T101`** | `/messages` 由占位页转**真页**，三态：**列表态**（keyset 会话列表：对端掩码标识 + 商品标题 + `last_body_preview` ≤50 字符 + 每行 `unread_count` 角标 + 「加载更多」）、**详情态**（消息流 keyset 按 `msg_id` 倒序 + 顶部返回列表 + 商品上下文行 `aboutItem`）、**输入区**（textarea + 发送按钮；`≤767` 触控 ≥44；空 body 禁发）。**空态**：列表空 = `messagesPage.empty` 既有键复用；详情空 = 新键 `detailEmpty`。**占位区块删除**：钩子 `messages-x-placeholder` 整块移除 + 键 `xPlaceholder`/`xNote` 四语同删（`F13` 体例）；「X/推特」预留语义作废（route v2.27 §37 历史留痕不回改）。路由面零改动（`/messages` 已登记）。 |
| **`T102`** | `ProfilePage`（我的）新增**「Telegram 通知」卡**（新卡片、不动既有块）：三态 —— **① 未配置降级卡**（env 缺 ⇒ 静态降级文案 `telegram.notConfigured`，无操作按钮；判据 = 绑定接口 `503 TG_NOT_CONFIGURED` 形态，route §41.9，**非 500**）；**② 未绑定态**（`telegram.bind` 按钮 → `POST /api/telegram/bind/start` ⇒ 展示 `codeLabel` + `codeSteps`（含 `{{bot}}`/`{{code}}` 插值 + 10 分钟有效）+ 等待回执；成功 = `bindSuccess` → 转态③）；**③ 已绑定态**（`telegram.bound` + `tg_linked_at` 日期 + `telegram.unbind` 按钮 → 二次确认内联（不新造弹窗模板）→ 成功回②）。**隐私（写死）**：绑定面**绝不显示** `tg_user_id` 数值 / 任何 Telegram handle（route §41.5 判负②的读面对应）。 |
| **`T103`** | **未读角标**双挂点 = **底栏第 4 格（`messages`）** + **桌面悬浮菜单「消息」项**（同一取数、同一组件语义）：数字 = `GET /api/messages/unread-count` 的 `unread_total`；**取数时点 = ① 应用/外壳挂载时（登录态）② 发送成功后（#4 回执）③ 进入 `/messages` 后（读水位回执 #5）**，**无轮询、无 WebSocket、无定时器**（一句话可改）；`0` ⇒ 不渲染角标；`>99` ⇒ 显示 `99+`；a11y = `messagesPage.unreadA11y`（`{{count}} 条未读`）。角标**纯展示**，不阻塞导航。 |

> **★ v1.19 就地注（`T101` 收窄 · 旧字面逐字保留、部分已被 §21 取代）**：上表 **`T101`** 原写「`/messages` 由占位页转**真页**，三态…路由面零改动（`/messages` 已登记）」—— **「独立真页」部分已被 v1.19 §21 取代**：`/messages` **不再是独立页面**，改为**内嵌面板**（§21.2 `T104`）；**三态（列表态 / 详情态 / 输入区）、keyset「加载更多」、两空态、`≤767` 触控 ≥44、`T79` 字号逐字保留**（**只换宿主：页面 ⇒ 面板**）。**「路由面零改动」升级为「路由面 + 查询参数面」**（新增 `?msg=1` / `&c=` 口径 = 姊妹册 `route-layer.spec` v2.34 §44）。**`T102`（Telegram 绑定卡）/ `T103`（未读角标）两行逐字不受影响** —— 角标挂点、取数三时点、`>99` 封顶一字未改；**面板打开 / 关闭不构成第 4 个取数时点**（面板内发送成功仍走既有 ②/③）。**已删占位项（钩子 `messages-x-placeholder` + 键 `xPlaceholder`/`xNote`）维持已删状态**（`N43` 体例不破）。

### 20.3 `T100` 展开 · 聊一聊三态判据表

| 态 | 判定 | 行为 | 数据依赖 |
|---|---|---|---|
| 登录 · 他人商品 | `user && user.uid !== seller.uid` | 渲染第 3 格；点击 ⇒ `POST conversations` ⇒ `Navigate` 到会话详情（`/messages?c=<conversation_id>` 形态由实现定，**路由路径不变**） | `F19 seller.uid` + route #1 |
| 登录 · 卖家本人 | `user.uid === seller.uid` | **不渲染**（服务端 #1 仍有 `MSG_SELF_CONVERSATION` 双闸） | `F19 seller.uid` |
| 未登录 | `!user` | **不渲染第 3 格**（与既有登录可见性规则同构）；不存在「点了才登录」的中间态（保持操作栏 N 格语义纯净） | 既有 auth 状态 |

> **★ v1.18 就地更正（未登录口径 · 以 `§20.2` `T100` 为准 · 上表第 3 行原文逐字保留、已被 v1.18 取代）**：上表「未登录」行旧字面 =「**不渲染第 3 格**（与既有登录可见性规则同构）；不存在「点了才登录」的中间态（保持操作栏 N 格语义纯净）」—— **该字面与 §20.2 `T100`「未登录 ⇒ 点击走既有登录引导」互斥**（后者**隐含「渲染」**，否则无从「点击」），**已被 v1.18 取代**。**现行三态口径（裁死 · 写死）**：**① 卖家本人**（`user.uid === seller.uid`）⇒ 第 3 格**不渲染**；**② 未登录**（`!user`）⇒ 第 3 格**渲染**（**不 `disabled`**），**点击走既有登录引导**（同 `/profile` 受保护项行为，不新造弹层）；**③ 登录 ∧ 非卖家本人** ⇒ 渲染第 3 格，点击 ⇒ `POST /api/messages/conversations` ⇒ 进会话详情。**三态互斥且穷尽**（`!user` / `user.uid === seller.uid` / `user.uid !== seller.uid`）；**「不渲染」仅归属卖家本人态**。（承 §20.2 `T100` + §19.11 `Q1` 已裁。）

### 20.4 `T101` 展开 · 钩子与结构（实现面锚点 · 归 AC-2 用）

- 页面容器保留 `data-sf-m="messages-page"`；新增：`messages-list` / `messages-conversation-item` / `messages-conversation-unread`（行内角标）/ `messages-thread` / `messages-msg-item` / `messages-msg-mine` / `messages-msg-theirs` / `messages-input` / `messages-send-btn` / `messages-back` / `messages-load-more`。
- 输入区 `≤767` 高度含 `env(safe-area-inset-bottom)` 复刻口径（`T75` 体例）；页面样式落 `messages.css` 页面局部 `--sf-l-*`（**零新主题 token**、零 `STRUCT` 增项、`shell.css` 一字不动）。
- 429 语义直出：`MSG_RATE_LIMITED` ⇒ 文案键 `messagesPage.rateLimited`（`details.reason` 不进用户面）；发送失败通用态 = `sendFailed`；加载失败 = `loadFailed`。
- **术语**：本页属「站内信」；页面标题键 `messagesPage.title`（「消息」）不动（底栏同键，`T80` 第 4 格文案不变）。

> **★ v1.19 就地注（`§20.4` 钩子面收窄 · 旧字面逐字保留）**：上列钩子清单**全部保留原名**（`messages-list` / `messages-conversation-item` / `messages-conversation-unread` / `messages-thread` / `messages-msg-mine` / `messages-msg-theirs` / `messages-input` / `messages-send-btn` / `messages-back` / `messages-load-more`，逐字不改）—— **唯一例外 = 页面容器钩子 `messages-page`**（上列首句）⇒ 面板化后**改挂 `messages-panel`**（面板**不用** `*-page` 命名）；**新增** `messages-panel-list` / `messages-panel-thread` / `messages-panel-close` 三条（§21.5 表）。**样式落点由「页面 `messages.css`」扩为「页面 `messages.css` + 新文件 `shell/messages-panel.css`」**（**`shell.css` 仍一字不动**；页面局部 `--sf-l-*` 体例与「零新主题 token」逐字维持）。`env(safe-area-inset-bottom)` 复刻口径在**面板全屏档（`≤767`）**继续适用（`T75` 体例不破；`messages.css` 内既有声明不动）。**未登录 ⇒ 面板内既有登录引导逐字保留**（零新造弹层）。

### 20.5 `T102` 展开 · 绑定卡钩子与降级

- 钩子：`tg-bind-card` / `tg-bind-status` / `tg-bind-code` / `tg-bind-steps` / `tg-bind-action` / `tg-unbind-action`（归 AC-4 用）。
- code 展示 = 等宽字族既有槽位（`.sf-tag` 一类，不新造风格）；`codeSteps` 用 `{{bot}}` / `{{code}}` 插值（i18next 既有插值机制，全站已用）。
- 降级判定 = 调 #7 收到 `503 TG_NOT_CONFIGURED` ⇒ 转降级卡（不重试、不轮询 env 状态）；降级卡**不影响** ProfilePage 其余块（归因式 AC-5 覆盖）。

### 20.6 `T103` 展开 · 取数时点与状态归属

- 状态挂点 = 外壳层共享态（`BottomTabBar` 与桌面悬浮菜单同源消费；实现形态由 Kong 定，**判据 = 两挂点同值**）；`unread_total` 唯一真源 = route #6。
- **禁**：`setInterval` / `setTimeout` 轮询 / `visibilitychange` 拉取之外的自动拉取（一句话可改 = Kevin 若要「收 notify 后拉取」另行加挂点）。
- 角标几何：底栏格内右上小圆点/数字徽章（≤12px 文本须 ≥12px ⇒ 数字字号 **12px**，`T79` 硬门）；桌面悬浮菜单项同构。

### 20.7 受影响硬断言清单 + 前移（**现取重锚**）

| # | 断言面 | 影响 | 改法 / 前移 |
|---|---|---|---|
| 1 | **i18n 计数断言 12 文件**（`s5-publish-headcount` / `s7-submissions-panel` / `i18n-batch-b4a` / `i18n-batch-b4b` / `i18n-batch-b5` / `r9-93-points-symbol` / `r9-96-dashj-copy` / `s19-participants-truth-source` / `s23-participants-headcount` / `s8-locale-key-coverage` / `s9-ledger-kind-closure` / `i18n-violation-closeout`） | **计数前推**：顶层 `122 → 123` / 拍平 `1045 → 1078` / 四语节点 `4180 → 4312` | 实现单（Kong）随 locale 落键同步改锚；**判负**：只改实现不改锚 ⇒ 整批红 |
| 2 | 四语键集逐文件相同 | 新增/删除键**四语同补同删** | 硬门维持；缺语 ⇒ 渲染裸键名 |
| 3 | `theme-shell-isomorphism` 五 region / DOM 恒在 / `shell.css` 唯一 767 块 | 底栏 DOM 恒在（角标是第 4 格 `<a>` 的**子节点**） | **零改锚**；角标 DOM 不得移除 `<a data-sf-nav>` |
| 4 | `v15-nav-floatmenu` 桌面悬浮菜单断言 | 消息项增角标子节点 | 就地核对其元素键口径；**若该测试用「结构键含子元素序号」** ⇒ 实现单现取后登记（`NOT_MEASURED` 于本单） |
| 5 | `p7e-tails-beta` / `listing-market` / `p6-btn-impl2`（详情页家族） | 第 3 格新增 CTA（`.sf-btn` 命中 +1） | `p6-btn-impl2 #10` 的 `totalUses ≥ 22` 为**下限断言** ⇒ +1 不红；`.sf-item-cta` 复合类规则（`R-B`）不破 |
| 6 | `i18n-content-wiring` | `MessagesPage` 若进 `WIRED` 家族须带 `i18n-content` import | 实现单现取该文件是否在 `WIRED` 清单；不在 ⇒ 零改锚 |
| 7 | `p4z-i18nviol-global.mjs`（`N39` 吞码红线） | 新页面/新 CSS 注释 | **禁写「`/*` 收尾的路径字面」**（如 `/api/messages/` 尾）；改写为 `/api/messages/…` 形式 |
| 8 | `app-routes.test.jsx` 等路由面 | 路由零改动 | 零改锚 |
| 9 | **`v15-nav-floatmenu.test.jsx:243-251`（`T101` 显式删除项引致）** | `/messages` 占位块删除后，该用例**现取仍断言旧占位钩子共存**（`expect(container.querySelector('[data-sf-m=\"messages-x-placeholder\"]')).not.toBeNull()` + `expect(page.textContent).toContain(TABLES[lang].messagesPage.xPlaceholder)`）⇒ **按现取断言必红** | **改锚（Kong 并行单执行）** = **① 删去两处旧占位断言**（钩子 `messages-x-placeholder` + `xPlaceholder` 文案）；**② 改锚为「占位钩子计数归 0 + 真页钩子在场」**（`[data-sf-m=\"messages-x-placeholder\"]` ⇒ `toBeNull()`；`[data-sf-m=\"messages-page\"]` 与 `messages-list` / `messages-input` 等 `T101` 真页钩子 ⇒ `not.toBeNull()`）；**③ 用例名去掉「X 接驳位占位钩子」措词**。**性质 = 显式删除项引致的合法前推、非语义放宽**（`T101` 明文删该钩子与两键 ⇒ 旧断言与新形态不可能共存，改锚为唯一自洽解，**不得判为放宽**） |

> **★ v1.18 登记（`T101` 显式删除项引致的断言改锚 · 上表 #9）**：`T101` 明文删除占位钩子 `messages-x-placeholder` 与键 `messagesPage.xPlaceholder` / `xNote`（四语同删），而 `frontend/src/test/unit/v15-nav-floatmenu.test.jsx:243-251` **现取实测仍断言旧钩子与旧文案共存**（`:240` 用例名含「X 接驳位占位钩子」；`:250` 断言钩子非空；`:251` 断言 `TABLES[lang].messagesPage.xPlaceholder` 文案在场）⇒ **按现取断言必红**。**改锚口径（写死）** = **「占位钩子计数归 0 + 真页钩子在场」**：旧占位断言由 `not.toBeNull()` 翻为 `toBeNull()`（占位钩子全仓命中 = `0`，承 `N43` 判据），并改锚到 `T101` 真页钩子（`messages-page` / `messages-list` / `messages-input` 等，见 §20.4）在场。**性质声明 = 属显式删除项引致的合法前推、非语义放宽** —— 断言锚点随被审对象（占位 ⇒ 真页）**同步前推**，**不降任何判据强度**（占位钩子仍必须为 `0`、真页钩子仍必须在场，两条都是硬门）。**执行 = Kong 并行单**（本册只登记口径，不改测试文件）。

### 20.8 i18n 键清单（**+35 / −2 · 四语同补同删**）+ 计数算式

**删除（2）**：`messagesPage.xPlaceholder` · `messagesPage.xNote`（占位语义作废；`F13` 四语同删体例）。

**新增（35；zh 为定稿值，en/hk/vn = 初译「待复核」，四语键集相等硬门适用）**：

| 键 | zh | en / hk / vn（初译） |
|---|---|---|
| `item.chat` | 聊一聊 | Chat / 聊一聊 / Nhắn tin |
| `messagesPage.backToList` | 返回消息列表 | Back to conversations / 返回消息列表 / Quay lại danh sách |
| `messagesPage.detailEmpty` | 还没有消息，发第一条吧 | No messages yet. Say hello! / 還沒有消息，發第一條吧 / Chưa có tin nhắn nào |
| `messagesPage.inputPlaceholder` | 输入消息… | Type a message… / 輸入消息… / Nhập tin nhắn… |
| `messagesPage.send` | 发送 | Send / 發送 / Gửi |
| `messagesPage.sendFailed` | 发送失败，请重试 | Failed to send. Please retry. / 發送失敗，請重試 / Gửi thất bại, vui lòng thử lại |
| `messagesPage.rateLimited` | 今天在这里发消息太频繁了，明天再试 | Too many messages here today. Try again tomorrow. / 今天在這裡發消息太頻繁了，明天再試 / Bạn đã gửi quá nhiều tin nhắn hôm nay |
| `messagesPage.aboutItem` | 关于：{{title}} | About: {{title}} / 關於：{{title}} / Về: {{title}} |
| `messagesPage.loadMore` | 加载更多 | Load more / 加載更多 / Tải thêm |
| `messagesPage.loadFailed` | 加载失败，请重试 | Failed to load. Please retry. / 加載失敗，請重試 / Tải thất bại, vui lòng thử lại |
| `messagesPage.notFound` | 会话不存在 | Conversation not found / 會話不存在 / Không tìm thấy hội thoại |
| `messagesPage.unreadA11y` | {{count}} 条未读 | {{count}} unread / {{count}} 條未讀 / {{count}} chưa đọc |
| `telegram.title` | Telegram 通知 | Telegram notifications / Telegram 通知 / Thông báo Telegram |
| `telegram.desc` | 绑定后，收到新消息会通过 Telegram bot 提醒你（含消息开头摘要） | Get Telegram bot reminders for new messages (includes a preview of the message opening) / 綁定後，收到新消息會通過 Telegram bot 提醒你（含訊息開頭摘要）/ Nhận thông báo qua Telegram bot khi có tin nhắn mới (kèm trích đoạn đầu tin nhắn) |
| `telegram.bind` | 绑定 Telegram | Bind Telegram / 綁定 Telegram / Liên kết Telegram |
| `telegram.unbind` | 解除绑定 | Unbind / 解除綁定 / Hủy liên kết |
| `telegram.bound` | 已绑定 | Bound / 已綁定 / Đã liên kết |
| `telegram.notBound` | 未绑定 | Not bound / 未綁定 / Chưa liên kết |
| `telegram.codeLabel` | 你的绑定码 | Your linking code / 你的綁定碼 / Mã liên kết của bạn |
| `telegram.codeSteps` | 打开 Telegram，向 {{bot}} 发送：/start {{code}}（10 分钟内有效） | Open Telegram and send to {{bot}}: /start {{code}} (valid for 10 minutes) / 打開 Telegram，向 {{bot}} 發送：/start {{code}}（10 分鐘內有效）/ Mở Telegram và gửi tới {{bot}}: /start {{code}} (hiệu lực 10 phút) |
| `telegram.notConfigured` | 通知服务暂未配置 | Notifications are not configured yet / 通知服務暫未配置 / Dịch vụ thông báo chưa được cấu hình |
| `telegram.bindSuccess` | 绑定成功 | Linked successfully / 綁定成功 / Liên kết thành công |
| `telegram.bindFailed` | 绑定失败，请重新获取绑定码 | Linking failed. Please get a new code / 綁定失敗，請重新獲取綁定碼 / Liên kết thất bại, vui lòng lấy mã mới |
| `msg.err.MSG_LISTING_NOT_FOUND` | 商品不存在 | Listing not found / 商品不存在 / Không tìm thấy mặt hàng |
| `msg.err.MSG_SELF_CONVERSATION` | 不能给自己发起会话 | You cannot start a conversation about your own item / 不能給自己發起會話 / Không thể tự tạo hội thoại với chính mình |
| `msg.err.MSG_LISTING_NOT_OPEN` | 该商品当前不可发起会话 | This item is not open for conversations / 該商品當前不可發起會話 / Mặt hàng này hiện không mở hội thoại |
| `msg.err.MSG_CONVERSATION_NOT_FOUND` | 会话不存在 | Conversation not found / 會話不存在 / Không tìm thấy hội thoại |
| `msg.err.MSG_NOT_PARTICIPANT` | 你不在该会话中 | You are not a participant of this conversation / 你不在該會話中 / Bạn không thuộc hội thoại này |
| `msg.err.MSG_BODY_INVALID` | 消息内容为空或过长 | Message is empty or too long / 消息內容為空或過長 / Tin nhắn trống hoặc quá dài |
| `msg.err.MSG_RATE_LIMITED` | 发消息太频繁，请稍后再试 | Sending too fast. Please try later / 發消息太頻繁，請稍後再試 / Gửi quá nhanh, vui lòng thử lại sau |
| `tg.err.TG_NOT_CONFIGURED` | 通知服务暂未配置 | Notifications are not configured yet / 通知服務暫未配置 / Dịch vụ thông báo chưa được cấu hình |
| `tg.err.TG_CODE_INVALID` | 绑定码无效或已过期 | Linking code is invalid or expired / 綁定碼無效或已過期 / Mã liên kết không hợp lệ hoặc đã hết hạn |
| `tg.err.TG_TARGET_ACCOUNT_TAKEN` | 该 Telegram 账号已绑定其它站内账号 | This Telegram account is linked to another account / 該 Telegram 帳號已綁定其它站內帳號 / Tài khoản Telegram này đã liên kết với tài khoản khác |
| `tg.err.TG_NOT_LINKED` | 尚未绑定 Telegram | Telegram is not linked yet / 尚未綁定 Telegram / Telegram chưa được liên kết |
| `tg.err.TG_WEBHOOK_UNAUTHORIZED` | 请求未授权 | Request unauthorized / 請求未授權 / Yêu cầu chưa được xác thực |

> **★ 勘误留痕（2026-10-15 · `telegram.desc` 四语文案 · 勘误级就地改，不升版）**：本表 `telegram.desc` 行**改前字面（逐字保留 = 历史）** = zh「绑定后，收到新消息会通过 Telegram bot 提醒你（**不包含消息内容**）」/ en「Get Telegram bot reminders for new messages (**content not included**)」/ hk「綁定後，收到新消息會通過 Telegram bot 提醒你（**不包含消息內容**）」/ vn「Nhận thông báo qua Telegram bot khi có tin nhắn mới (**không kèm nội dung**)」⇒ **已被本勘误取代**，**现行字面见本表本行**（四语）。**依据** = ① **Kevin 2026-10-15 裁定**（通知内容由「零正文」⇒「带消息开头预览 = 首 6 个显示宽单位」；同裁定权威落点 = 姊妹册 `docs/route-layer.spec.md` v2.33 §41.7 勘误留痕）；② **实现现盘（只读现取）** `frontend/src/locales/{zh,en,hk,vn}.json` 的 `telegram.desc` —— commit **`c804ef1`**（`fix(seafood): Telegram 通知文案改「带预览」口径（四语 telegram.desc 含消息开头摘要）`）四语逐字与上表本行**逐字一致**（本单只读现取、未改代码）。**口径关系** = 本键描述与 route 册通知内容口径**同步**：「含消息开头摘要」= 隐私面由「零内容」收窄为「前 6 显示宽单位」（全文 / 联系方式 / handle 仍零出口）。**键计数零变化**（**值变更 1 键 · `+0` 键** ⇒ 顶层 `125` / 拍平 `1078` / 四语节点 `4312` 逐字不变；`telegram` 命名空间键数 11 不变）。**未改 `frontend/**`**；`docs/versions/design-system.spec.v1.18.md` 保留勘误前字面 = 历史（本单未碰 `docs/versions/**`）。

**计数算式（写死 · 可复核）**：顶层 `122 + 1`（新顶层命名空间 `telegram`）= **123**；拍平 `1045 − 2`（删 `xPlaceholder`/`xNote`）`+ 23`（UI 键：`item.chat` 1 + `messagesPage` 11 + `telegram` 11）`+ 12`（`msg.err.*` 7 + `tg.err.*` 5）= **1078**；四语节点 `1078 × 4` = **4312**。**归零自检**：新键 35 = 23 + 12；删键 2；净 +33 flat；顶层 +1 自洽（`telegram` 为新顶层）。

> **★ v1.18 就地更正（顶层键数算式 · 旧字面逐字保留、已被 v1.18 取代）**：上级「计数算式（写死 · 可复核）」段旧字面 =「顶层 `122 + 1`（新顶层命名空间 `telegram`）= **123**；…；**归零自检**：新键 35 = 23 + 12；…顶层 +1 自洽（`telegram` 为新顶层）」—— **「顶层 `+1` / `= 123`」已被 v1.18 取代**：该算式**漏计另两个新顶层错误域** —— `msg`（`msg.err.MSG_*` **7 键**）与 `tg`（`tg.err.TG_*` **5 键**；二者**已含于**旧段「新键 35 = 23 + 12」的 **12** 之内，故仅顶层算式漏计、拍平算式无误）。**现行算式（写死 · 可复核）**：**顶层 `122 + 3`（新顶层命名空间 `telegram` + `msg` + `tg`）= `125`**。**拍平 `1045 − 2 + 23 + 12` = `1078`** 与 **四语节点 `1078 × 4` = `4312`** 原写**正确、不变**。**现取佐证**：四语逐文件 `len(json)` = 顶层 **125**（`zh` 顶层键含 `telegram` / `msg` / `tg` 三者）、递归叶 = 拍平 **1078**、`× 4` = 四语节点 **4312**（四语逐文件相等）。**★ 键名不得改（写死）**：必须保持 **`msg.err.MSG_*`** 与 **`tg.err.TG_*`** 的字面（子路径字面 `err.MSG_*` / `err.TG_*`）—— 与**后端已 commit 的 `i18n_key` 字面对齐**，**改键名会破坏前后端对齐**（后端按该字面回传 `i18n_key`、前端按字面取键 ⇒ 键名漂移 = 渲染裸键名 + 错误码文案丢失）。

### 20.9 归因式 AC（**不用元素白名单** · 承 §19.8 体例）

- **AC-1（聊一聊三态）**：`/item/:id` 上，第 3 格「聊一聊」**可见性**与三态判据表（§20.3）逐一相符；反事实 = 把 `user.uid` 换成 `seller.uid`（仅测量期）⇒ 该格**必须消失**。**判负**：卖家本人可见该格 / 未登录可见该格 / 点击后无 `POST conversations` 网络痕迹。

> **★ v1.18 就地更正（`AC-1` 未登录口径 · 上条原文逐字保留、已被 v1.18 取代）**：上条「**判负**：卖家本人可见该格 / **未登录可见该格** / 点击后无 `POST conversations` 网络痕迹」中的「**未登录可见该格 ⇒ 判负**」**与 §20.2 `T100` / §20.3 现行三态（未登录 ⇒ 渲染且点击走登录引导）互斥**，**已被 v1.18 取代**。**现行 `AC-1`（三态自洽 · 写死）**：`/item/:id` 第 3 格**可见性须与 §20.3 现行三态逐一相符** —— **① 未登录 ⇒ 第 3 格可见**（点击走既有登录引导）；**② 卖家本人 ⇒ 第 3 格不可见**；**③ 登录 ∧ 非卖家 ⇒ 第 3 格可见且点击后出现 `POST /api/messages/conversations` 网络痕迹**。**判负（现行）** = **仅**：**卖家本人可见该格** / **登录 ∧ 非卖家却不可见该格** / **点击后无 `POST conversations` 网络痕迹**。**「未登录可见该格」不再是判负项**（恰为正确行为）。**反事实不变** = 把 `user.uid` 换成 `seller.uid`（仅测量期）⇒ 该格**必须消失**。
- **AC-2（`/messages` 真页可达性 + 入口不丢失）**：底栏第 4 格 + 桌面悬浮菜单「消息」仍可达 `/messages`（路由零改动）；页内**返回列表**入口（`messages-back`）可见可点（`≤767` ≥44×44）；`/messages` 上可达路由集合相对改前**不减**。**判负**：占位钩子 `messages-x-placeholder` 仍存在 ⇒ 判负（`T101` 显式删除项）。
- **AC-3（角标显示与清零）**：登录 + 存在未读 ⇒ 两挂点（底栏第 4 格 + 桌面悬浮菜单消息项）**同值**显示 `unread_total`（>99 ⇒ `99+`）；进入会话详情并触发 #5 后（测量期回执）⇒ 该会话行角标清零且 `unread-count` 重取值下降；**反事实**：未登录 ⇒ 两挂点零角标、零请求。**判负**：出现轮询请求（`>3` 次同 URL 定时重复）⇒ 判负（`T103` 无轮询）。
- **AC-4（绑定面三态）**：① env 缺（`503 TG_NOT_CONFIGURED`）⇒ 降级卡文案 `telegram.notConfigured`、无可用绑定按钮；② 未绑定 ⇒ 点「绑定」出 code + `codeSteps`（含 `{{code}}` 实值与 `{{bot}}`）；③ 已绑定 ⇒ 显示 `tg_linked_at` + 解绑按钮；**全卡不出现** `tg_user_id` 数值或任何 handle 字串。**判负**：503 时整页报错（非卡片内降级）⇒ 判负。
- **AC-5（非目标页归因式零影响）**：非本单页面（`/`、`/item/new`、`/exchange`、`/profile`、`/item/:id` 除第 3 格外区域、四语前缀档）的 DOM 签名与几何**差异集 = 0**；**允许变更集** = (i) 详情页操作栏新增第 3 格及其引致的行内位移（ii) `/messages` 整页由占位变真页（iii) `ProfilePage` 新增 Telegram 卡及其引致的下方位移（iv) 底栏/桌面消息项角标子节点（v) §20.8 键集变更引致的文案面。**反事实归因**：仅在测量期回退 (i)（移除第 3 格 DOM，不动仓库）⇒ (i) 类条目消失、其余不变。**判负**：差异集出现五类之外的条目 ⇒ 判负。
- **AC-6（主题同构 + 触控 + 字号）**：新面日/夜两档几何逐值相等（新常量走页面局部 `--sf-l-*` 两档同值）；无 `[data-theme` 新选择器；`≤767` 触控 ≥44、可见文本 ≥12px（角标数字 12px）；`>767` 桌面档既有控件几何不连带（`p6-btn-impl2` 冻结值不动）。

### 20.10 新增可复用教训（`N43` · 承 `N39`/`N40`/`N41`/`N42`）

- **`N43`（预留槽位激活必须同步回收占位遗物）**：凡「占位页/占位块/预留键」被真实现取代时，**同轮**删除占位钩子与占位键（四语同删）—— 只加新面不删旧占位 ⇒ 占位常驻成死面（本轮 `messages-x-placeholder` + `xPlaceholder`/`xNote` 即按此执行）；同理适用于 `T84` 三弹窗模板位等将来激活场景。**判据**：占位钩子全仓命中 = 0。

### 20.11 待裁项（**不得自选 · 交 Kevin**）

1. **bot 创建**：BotFather 建号 / bot username / `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` **走安全通道**（不入对话/不入仓；env 键名已冻结于 route §41.7）。
2. **通知双语一行**（Zang 暂裁）与 **20 条/天/会话**（Z6）：维持暂裁，**一句话可改**（Jing 建议维持）。
3. Jing 提议初值（均一句话可改，已同步 data/route 册）：全局 200 条/日 · body 2000 字符 · `item.chat` 文案「聊一聊」· `nickname` = EVM 掩码派生 · 角标无轮询取数三时点。

> **★ 勘误就地注（2026-10-15 · 上列第 2 项 · 旧字面逐字保留）**：上列第 **2** 项「**通知双语一行**（Zang 暂裁）与 **20 条/天/会话**（Z6）」—— 其中「**通知双语一行**」的**内容口径部分已不再是暂裁**：Kevin 2026-10-15 裁定 ⇒ **现行 = 双语一行 + 消息开头预览 = 首 6 个显示宽单位**（权威落点 = 姊妹册 `docs/route-layer.spec.md` v2.33 §41.7 勘误留痕）；**「20 条/天/会话」部分维持暂裁（一句话可改）不变**。**本项原文未改写**（只追加本注）。**本册文案面同步** = §20.8 `telegram.desc` 行四语（勘误级就地改）。

### 20.12 未核实 / 登记（诚实清单 · 禁填 0/空）

- 键值四语初译**未经 Kevin 复核**（`待复核` 标注）；`v15-nav-floatmenu` 对角标子节点的元素键口径未现取（§20.7 #4）；`MessagesPage` 是否在 `i18n-content-wiring` 的 `WIRED` 清单未现取（§20.7 #6）；角标两挂点共享态的实现形态未定（只冻判据）；本册未动 `frontend/**` / `backend-ts/**`、未跑任何门、未连库。

> **★ v1.18 就地更新（`§20.7 #4` 现取收口 + 本单边界）**：上条「`v15-nav-floatmenu` 对角标子节点的元素键口径未现取（§20.7 #4）」**仍为 `NOT_MEASURED`**（角标子节点元素键面）；但**同文件 `:243-251` 的占位钩子断言面已现取**（现取仍断言旧钩子共存）并**登记改锚**（§20.7 #9 + 其后就地注）。**本单（v1.18）= 纯 `docs/**` 微回写**：未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`，未跑任何门、未连库；键集现取（`frontend/src/locales/*.json`）属**只读复核**（不改代码）。

### 20.13 快照 + 自证（本节）

- 改前：1923 行 / 422,501 B / md5 `0400a3d9bbcc38b22cae0190b658c8ee`；改后读数见本版 delta 件 `docs/audit/design-system-v1.17-delta.md`（行数/字节/md5 前后 + `git diff --numstat` 删除列 = 0 + 快照 `cmp=0` + 未改代码自证）。

> **★ v1.18 微回写（本节自证）**：改前 = 2078 行 / 450,138 B / md5 `f0d8e248b791330bf1e45ba5cdfba084`；改后读数见本版 delta 件 `docs/audit/design-system-v1.18-delta.md`（行数 / 字节 / md5 前后 + `git diff --numstat` 删除列 = 0 + 快照 `cmp=0` + 未改 `frontend/` 的 grep 自证）。**本单改动 = 仅 `docs/design/design-system.spec.md` + 新建快照 `docs/versions/design-system.spec.v1.18.md` + 新建 delta `docs/audit/design-system-v1.18-delta.md`**（未动代码 / 未动台账 / 未动挂账）。

---

## §21 ★★ v1.19 · 消息面板化（**方案 1「就地叠加」**）落册：`/messages` 由**独立真页** ⇒ **内嵌面板**（左联系人 / 右对话）+ 几何冻结表（面板 `600` / 右偏移 `104` / 让位 `704` / 左栏 `240` / 右栏 `360`）+ 钩子契约 + i18n 键集算式前推（`1103 ⇒ 1104` · 节点 `4412 ⇒ 4416`）+ 断言改锚登记（**本节只追加 · §1–§20 一字未动** · 依据 = **Kevin 2026-10-16 逐字裁定「消息面板化（方案 1 · 就地叠加）」**；姊妹册 = `route-layer.spec` v2.34 §44（`/messages` 语义变更 + `?msg=1` 查询参数口径 + 四入口保全 + 两计数不变））

### 21.0 裁定来源（Kevin 2026-10-16 · 逐字采用 · 六条 + 一句四入口全集）

- **① 消息不做独立页面**：改为**内嵌在其它页面内部的面板** —— 一旦打开消息 ⇒ **原有页面向左压缩**，**页面整体右侧留出 `600px`** 呈现消息界面。
- **② 面板内部两栏**：**左 = 各联系人选择（侧边栏）**，**右 = 对话窗口**。
- **③ 面板外部的右侧** = **当前悬浮按钮面板**（**不遮挡、零几何改动**）〔= 既有 `.sf-fm`，本册 §14.2 / `T81`–`T83` 口径一字不动〕。
- **④ 打开方式 = 不换页**：给**当前路由**加查询参数 **`?msg=1`**（可带 **`&c=<conversation_id>`**），当前页**原地左压**、**挂载态与滚动位置保留**。
- **⑤ `/messages` 路由保留**为**直链落点**（Telegram 通知链接 / 旧链）= **首页 + 面板**（同一面板，底 = 首页）。
- **⑥ 关闭** = **移除 `msg` / `c` 查询参数**（`replace` 保当前页）+ 面板内**左上「×」**；**浏览器后退键天然关面板**。
- **★ 四入口全集（全部要保、全部不改 `href`）**：① 底栏第 4 格 · ② 悬浮菜单「消息」· ③ 详情页「聊一聊」（现取 `ItemDetailPage.jsx:157` navigate `/messages?c=<id>`）· ④ Telegram 通知里的 `/messages` 直链。
- **本册只承载「形态 / 几何 / 钩子 / 断言改锚 / 键集算式」**；**route 侧（路径语义 / 查询参数 / 入口 `href` 保全 / 计数）见姊妹册 `route-layer.spec` v2.34 §44**，本册不重抄。

### 21.1 现取基线（本单开工 · HEAD `fd34ca0` · 2026-10-16 · 只读现取 · 工作区干净）

| 项 | 现取读数 | 取法（可复核） |
|---|---|---|
| 当前形态 | `/messages` = **独立真页**：内层路由 `<Route path="messages" element={<MessagesPage />} />` | `frontend/src/App.jsx:119` |
| 页面文件 | `frontend/src/pages/MessagesPage.jsx` **294 行** · 单栏 · 列表态⇄详情态两态（详情由 query `?c=<conversation_id>` 定位，`MessagesPage.jsx:56`） | `wc -l` / 文件现读 |
| 页面样式 | `frontend/src/pages/messages.css` **186 行**（`sf-msg-*` 家族 20 类） | `wc -l` / `grep -n '^\.'` |
| 壳层 | `AppShell.jsx` = `UnreadProvider` → `.sf-shell[data-sf-shell=app][data-sf-region=shell]` → `.sf-region-top` / `main.sf-route-container[data-sf-region=content]` / `.sf-region-foot` / `<BottomTabBar />` / `<FloatingMenu />` | `AppShell.jsx:15-31` |
| 悬浮菜单几何 | `.sf-fm` = `position:fixed; right:16px; width:72px; top:45%; border-radius:36px`；**≥768 显示 / ≤767 隐藏（由唯一 767 断点块承担）** | `frontend/src/shell/shell.css:113-124` + `:182`（唯一 `@media`，现取 `grep -c '@media' shell.css = 1`） |
| 主内容容器 | `.sf-route-container` = `max-width:var(--sf-st-shell-max-w)`（= `1440px`）· `margin:0 auto` · `padding:0 var(--sf-st-topbar-pad-x)` | `shell.css:26-32` |
| 先例（本单沿，不发明新机制） | **`T95`「DOM 恒在 + 页面级 `display:none`」**：`.sf-tabbar.is-detail{display:none}` 落 `src/styles.css` **顶层**（`:22`），`shell.css` 一字不动；判定 = **路由串匹配**（`BottomTabBar.jsx:18-22` `stripLangPrefix`），**严禁宽度判定** | `styles.css:22` / `BottomTabBar.jsx:12-22` |
| 路由串剥离真源 | `stripLangPrefix` **单一真源** | `frontend/src/utils.js:65` |
| 未读角标 | `UnreadProvider` / `useUnreadCount` / `unreadBadgeText`（`>99` ⇒ `99+`）；两挂点 = `tabbar-unread-badge`（`BottomTabBar.jsx:61`）/ `floatmenu-unread-badge`（`FloatingMenu.jsx:53`） | `shell/unread-context.jsx:22-61` |
| 键集（**现取**，四语逐文件） | 顶层 **`128`** / 拍平 **`1103`** / 四语节点 **`4412`**（`= 1103 × 4`；四语 `top/flat` **逐文件完全相等**） | `frontend/src/locales/{zh,en,hk,vn}.json` JSON 解析（`len(dict)` / 递归叶） |
| 前端路由计数 | `grep -cE '<Route' frontend/src/App.jsx` = **`42`**（字面）· `grep -oE '<Route[ >]' \| wc -l` = **`34`**（精确） | `App.jsx`（口径同 route 册 §40.2 / §42.5） |
| 后端注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` = **`105`**（get 45 / post 56 / put 0 / delete 3 / patch 1） | `index.ts`（口径同 route 册 §43.4） |

> **★ 与册内旧基线的差额（诚实登记 · 不沿用旧字面）**：本册最近一次记的键集基线 = v1.18 §20.8 的 **顶层 `125` / 拍平 `1078` / 节点 `4312`**；**现取 = `128` / `1103` / `4412`** ⇒ 差额 **顶层 `+3` / 拍平 `+25` / 节点 `+100`**，来源 = 本册 §21 之外的**既有批次**（`sf14` 前推：`header` / `profileNav` / `activitiesPage` 三顶层 + `profileNav` 空态 4 + `item.favorite` 族；tg QR 面 `+8`）⇒ **本册一律以「现取」为准，承 `F12` 口径「不得拄推定值」**。

### 21.2 规则条文（`T104`–`T108`）

| 规则 | 条文（写死） |
|---|---|
| **`T104`** | **消息面板化（方案 1 · 就地叠加）**：消息**不做独立页面** ⇒ 改为**内嵌面板** —— 打开消息时**当前页原地左压**、页面整体右侧**让位 `var(--sf-mp-let)`**（≥1024 档 = `704px`）呈现**面板**（宽 `var(--sf-mp-w)`，≥1024 档 = `600px`）；**不换页**（`pathname` 逐字不变，只有 `search` 变化）⇒ **宿主页面组件不得重新挂载、滚动位置保留**。面板外部的右侧**仍是既有 `.sf-fm`**（`T81`–`T83` + §14.2 几何**一字不动**、`shell.css` 一字不动）。 |
| **`T105`** | **打开 / 关闭判据 = 路由串匹配（写死）**：**打开** ⟺ `stripLangPrefix(pathname) === '/messages'` **∨** `new URLSearchParams(search).get('msg') === '1'` **∨** `c` 非空（**会话直链子句** · 保入口③「聊一聊」`/messages?c=<id>` 与「原地形态」自洽 ⇒ 姊妹册 route v2.34 §44.3(1) 逐字同款；**口径外延项 · 一句话可改**，改则须同步 route §44.3(1) 与 `v15-nav-floatmenu.test.jsx:259` 的 URL）；**关闭** = 移除 `msg` / `c` 查询参数（**`replace` 保当前页**）＋ 面板内**左上「×」**（`messages-panel-close`）；**浏览器后退键天然关面板**（参数进 history）。**★ 严禁任何宽度 / `matchMedia` / `innerWidth` 类判定**（外壳 JS 硬断言 **按明文全文扫描**，**注释里写这些词同样判负** ⇒ 面板 JS 与注释一律不得出现 `shell/` 内禁用词表）。**判据单一真源**：一个纯函数（`stripLangPrefix` 之上），`shell/AppShell.jsx` 与面板组件**共用同一份**（承 `utils.js:65` 单真源体例）。 |
| **`T106`** | **几何冻结表**（本册裁定 · 逐值 · 见 §21.3；每项标「一句话可改 / 不可改」）＋ **零断点值新增**：面板可见性与形态**只用既有 `767px`**（`shell.css:182` 现取唯一值）；**≥768 的紧凑由 `min()` 承担、不新增媒体查询**；**≤767 = 面板全屏 + 单栏两态**（联系人 ⇄ 对话，复用既有交互：`?c=` 定位 / `messages-back` 返回列表），**不得新增断点值**。 |
| **`T107`** | **四入口保全 + `/messages` 语义变更**：四入口（底栏第 4 格 / 悬浮菜单「消息」/ 详情页「聊一聊」/ Telegram 通知直链）**全部保留、`href` 一字不改**；`/messages` 由 v1.17 `T101` 的**独立真页** ⇒ **直链落点 = 首页 + 面板**（同一面板，底 = 首页）。**前端 `<Route` 计数与后端注册点两数不变**（现取 `42`/`34` 与 `105`；见姊妹册 route v2.34 §44.5）。 |
| **`T108`** | **落点与钩子契约（写死）**：面板样式落**新文件 `frontend/src/shell/messages-panel.css`**（**`shell.css` 一字不动** ⇒ 「唯一 767 断点块」「无 `[data-theme`」两条硬断言零改动）；**面板一律只用 `data-sf-m`**，**不得新增任何 `data-sf-region`**（五 region 严格相等断言冻结）；壳层状态用**修饰类**（`.sf-shell.sf-shell--msg-open`，挂点 = `AppShell.jsx:17`）；**零新主题 token**（`TOKEN_KEYS` 一字不动）、**零 `STRUCT` 增项**（面板结构常量走**面板局部** `--sf-mp-*`，承 `T98`「`STRUCT_PROV` 带溯源硬门」体例）。 |

### 21.3 `T106` 展开 · 几何冻结表（**逐值 · 现取依据 + 一句话可改**）

| 项 | 冻结值 | 类别 | 一句话可改 | 现取依据 / 派生 |
|---|---|---|---|---|
| **面板宽** `--sf-mp-w` | `min(600px, calc(100vw - 424px))`（**≥1024 档 ⇒ `600px`**） | 【本册裁定】 | ✓ | Kevin 2026-10-16 ①「右侧留出 `600px`」 |
| **面板右偏移** `--sf-mp-right` | `104px` = 浮菜单 `right:16` + 宽 `72` + 间隙 `16` | 【本册裁定·派生】 | ✓（**改则须同步**） | `shell.css:118`（`right:16px`）+ `:120`（`width:72px`）现取 |
| **面板 ↔ 浮菜单间隙** | **恒 `16px`**（**相交 = 0 = 硬判据**，承 ③「不遮挡、零几何改动」） | 【本册裁定】 | ✗ | 上两行派生 |
| **整壳让位** `--sf-mp-let` | `calc(var(--sf-mp-w) + 104px)`（**≥1024 档 ⇒ `704px`**）；落 `.sf-shell.sf-shell--msg-open` 的 **`padding-right`** ⇒ **顶栏 / 正文 / 页脚一起左压** | 【本册裁定】 | ✓ | Kevin ①「页面整体右侧留出」 |
| **面板内左栏**（联系人） | `min(240px, 45%)`（**≥1024 档 ⇒ `240px`**） | 【本册裁定】 | ✓ | Kevin ②「左 = 各联系人选择（侧边栏）」 |
| **面板内右栏**（对话） | 余量 = 面板宽 − 左栏（**≥1024 档 ⇒ `360px`**；`240 + 360 = 600` 自洽） | 【本册裁定·派生】 | ✓ | Kevin ②「右 = 对话窗口」 |
| **面板高度** | **视口全高**（`position:fixed` · `top:0` · `bottom:0`） | 【本册裁定】 | ✗ | Kevin「呈现消息界面」（面板为**浮层**，不改 `.sf-route-container` 的布局语义） |
| **`768–1199` 档** | **允许紧凑、不许溢出**：由 `min()` 自动收窄（无媒体查询）⇒ 硬判据 = `document.documentElement.scrollWidth ≤ clientWidth`（**零横向溢出**）＋ 面板与 `.sf-fm` **相交 = 0**（间隙 `16px`）＋ 正文右缘 ≤ 面板左缘 | 【本册裁定】 | ✗（判据不可改） | Kevin ④ 收敛 + `T85` 体例 |
| **`≤767` 档** | **面板全屏**（`100vw × 100vh`）+ **单栏两态**（联系人 ⇄ 对话）；让位量 = `0`（**原地不压**）；`env(safe-area-inset-bottom)` 复刻（`T75` 体例） | 【本册裁定】 | ✗ | Kevin ⑥ 收敛 + `T78` 断点收口 |
| **断点值** | **零新增**：只用既有 `767px`；`≥768` 的紧凑由 `min()` 承担 | 【硬口径】 | ✗ | `shell.css:182` 现取唯一值 + `T78` |

### 21.4 `T105` 展开 · 宿主挂点与开关机制（**不发明新机制**）

- **壳层状态挂点** = `frontend/src/shell/AppShell.jsx:17`（现取 `.sf-shell` 的元素）⇒ 追加**修饰类** `sf-shell--msg-open`（**命名本册定**，一句话可改）；**判据同 `T105`**（路由串匹配，单一真源）。
- **让位规则落点** = **新文件 `shell/messages-panel.css`** 的 `.sf-shell.sf-shell--msg-open{ padding-right: var(--sf-mp-let) }` —— 具体性 `(0,2,0)` **压过** `shell.css:26` 的 `.sf-route-container{padding: …}` 与 **767 块内**的同名规则（`(0,1,0)`）；**`shell.css` 一字不动**（承 `T95` / `N40` 体例）。
- **≤767 归零**：同文件内 `@media (max-width: 767px){ .sf-shell.sf-shell--msg-open{ padding-right: 0 } }`（**复用既有 `767` 值**，不新增断点值）。
- **面板挂载 = 条件挂载（判据同 `T105`）** —— 本册裁定，理由 = 面板**不在任何冻结的 region / 元素数断言内**，条件挂载可令「未打开」态 DOM 与现盘**逐字相同**（零回归面）；**替代形态（`DOM 恒在` + 修饰类 `display:none`，承 `T95` 体例）登记为「一句话可改」**，实现方若选后者须自证「日/夜 DOM 形状同构 + 元素数下限」两条不破。
- **面板 = 浮层**：`position:fixed` ⇒ **不进 `.sf-route-container` 布局流**；页面左压**只由 `padding-right` 承担**（**不得**改 `max-width` / `margin` / 栅格列数 —— 那会改正文几何语义）。
- **替代手法登记（一句话可改）**：让位规则亦可写为 `.sf-shell:has(.sf-mp){ … }` 形态（仓内既有先例 = `pages/item/item.css:385` `.sf-shell:has(.sf-item-detail)`）；**本册冻结修饰类形态**（不依赖 `:has()` 支持度），二者**不得并用**。

### 21.5 钩子契约（**保留原名优先** · 凡改名 / 移位必进 §21.6 清单 A）

| 钩子 | 处置 | 现取宿主（`file:line`） | 面板化后宿主 |
|---|---|---|---|
| `messages-page` | **改名** ⇒ `messages-panel` | `MessagesPage.jsx:157` · `:167` | 面板根容器（新文件 `shell/MessagesPanel.jsx`） |
| `messages-list` | **保留** | `MessagesPage.jsx:249` | 面板左栏列表 |
| `messages-conversation-item` | **保留** | `MessagesPage.jsx:256` | 面板左栏行 |
| `messages-conversation-unread` | **保留** | `MessagesPage.jsx:264` | 面板左栏行内角标 |
| `messages-thread` | **保留** | `MessagesPage.jsx:190` | 面板右栏消息流 |
| `messages-msg-mine` / `messages-msg-theirs` | **保留** | `MessagesPage.jsx:197` | 面板右栏气泡 |
| `messages-input-row` / `messages-input` / `messages-send-btn` | **保留** | `MessagesPage.jsx:217` / `:220` / `:228` | 面板右栏输入区 |
| `messages-back` | **保留** | `MessagesPage.jsx:173` | 面板右栏（≤767 单栏返回列表；≥768 左栏常显 ⇒ 该键**仍渲染**、由面板 CSS 隐藏） |
| `messages-load-more` | **保留** | `MessagesPage.jsx:207` · `:278` | 两栏各自的「加载更多」 |
| `messages-about` | **保留** | `MessagesPage.jsx:179` | 面板右栏商品上下文行 |
| `messages-list-empty` / `messages-detail-empty` | **保留** | `MessagesPage.jsx:243` / `:188` | 面板两栏空态 |
| `messages-list-status` / `messages-thread-status` / `messages-send-status` | **保留** | `MessagesPage.jsx:245` / `:184` / `:236` | 各态（`data-sf-phase` 逐字保留） |
| `tabbar-unread-badge` / `floatmenu-unread-badge` | **保留（零改动）** | `BottomTabBar.jsx:61` / `FloatingMenu.jsx:53` | 底栏 / 悬浮菜单（`T103` 口径一字不动） |
| **`messages-panel-list`** | **新增** | — | 面板左栏包裹层（≥768 双栏用） |
| **`messages-panel-thread`** | **新增** | — | 面板右栏包裹层 |
| **`messages-panel-close`** | **新增** | — | 面板**左上「×」**（关闭键，Kevin ⑥） |

> **钩子面硬约束（写死）**：**面板不得新增任何 `data-sf-region`**（五 region **严格相等**断言：`theme-shell-isomorphism.test.jsx:81` / `v15-nav-floatmenu.test.jsx:230`）；**底栏第 4 格与悬浮菜单「消息」项必须仍是 `<a href="/messages">`**（`theme-shell-isomorphism.test.jsx:97` · `v15-nav-floatmenu.test.jsx:138` / `:149`）；**`App.jsx` 必须仍字面含 `<Route path="messages" element={<MessagesPage />} />` 与 `import MessagesPage from './pages/MessagesPage'`**（`v15-nav-floatmenu.test.jsx:235` / `:236`）。

### 21.6 受影响硬断言清单（**现取重锚** · 逐条点名到 `文件:行`）

**（A1）真改锚 = 2 处**（钩子改名引致，其余全部为「不变式 / 冻结面」）

| # | 文件:行 | 旧断言（现取逐字） | 新断言 |
|---|---|---|---|
| 1 | `frontend/src/test/unit/v15-nav-floatmenu.test.jsx:245` | 用例名 = `'%s 档 MessagesPage 渲染**真页**（占位钩子 = 0 + 真页钩子在场）'` | 用例名改 = `'%s 档 消息面板（`/messages` 直链落点 = 首页 + 面板）：面板钩子在场 + 占位钩子 = 0'` |
| 2 | `frontend/src/test/unit/v15-nav-floatmenu.test.jsx:260` | `const page = container.querySelector('[data-sf-m="messages-page"]')` ⇒ `expect(page).not.toBeNull()` | `container.querySelector('[data-sf-m="messages-panel"]')` ⇒ `not.toBeNull()`（**新宿主钩子**；如需左栏断言再加 `[data-sf-m="messages-panel-list"]`） |

**（A2）零改锚 = 冻结面 / 不变式**（**改实现时不得顺手改这些锚**）

| # | 文件:行 | 断言（现取） | 为何零改锚 |
|---|---|---|---|
| 3 | `v15-nav-floatmenu.test.jsx:259` | `renderIn(<MessagesPage />, '/messages')` | `MessagesPage` **仍是 `/messages` 的挂载组件**（= 首页 + 面板宿主）⇒ 调用形态不变 |
| 4 | `v15-nav-floatmenu.test.jsx:263` | `expect(page.textContent).toContain(title)`（`messagesPage.title` 四语） | 面板标题**复用既有键**（§21.7 复用清单） |
| 5 | `v15-nav-floatmenu.test.jsx:265-268` | `[data-sf-m="messages-list-empty"]` 非空 + 文案 = `messagesPage.empty` | 空态钩子 + 键**逐字保留** |
| 6 | `v15-nav-floatmenu.test.jsx:271` | `querySelectorAll('[data-sf-m="messages-x-placeholder"]').length === 0` | `T101` 已删项（`N43`）⇒ 维持 |
| 7 | `v15-nav-floatmenu.test.jsx:272-278` | `TABLES[*].messagesPage.xPlaceholder / xNote === undefined`（四语） | 同上 |
| 8 | `v15-nav-floatmenu.test.jsx:235` / `:236` | `App.jsx` 含 `<Route path="messages" element={<MessagesPage />} />` / `import MessagesPage from './pages/MessagesPage'` | **`App.jsx` 一字不改**（`T107`） |
| 9 | `theme-shell-isomorphism.test.jsx:81` | `expect(regions).toEqual(['shell','topnav','content','footer','tabbar'])` | 面板**只用 `data-sf-m`**，**不得新增 `data-sf-region`** |
| 10 | `v15-nav-floatmenu.test.jsx:230` | 同上五 region（AppShell 挂 `FloatingMenu` 用例） | 同上 |
| 11 | `theme-shell-isomorphism.test.jsx:217-222` | `shell.css` 的 `@media` **恰 1 个**且含 `` `${BREAKPOINTS.phonePortraitMax}px` ``（= `767px`） | 面板 CSS 落**新文件**，`shell.css` 一字不动 |
| 12 | `theme-shell-isomorphism.test.jsx:233-238` | `shell.css` 不含 `[data-theme` / `theme-day` / `theme-night` | 同上 |
| 13 | `theme-shell-isomorphism.test.jsx:204-213` | `shell/**` + `theme/**` 的 JS 全文（**含注释**）不得出现 `matchMedia\|innerWidth\|innerHeight\|clientWidth\|offsetWidth\|screen.width` | **约束面板 JS 与注释**（判据 = 路由串匹配） |
| 14 | `theme-shell-isomorphism.test.jsx:169-181` | 日/夜档 `shape(container)` **逐项相等** + 元素数差 == 主题图标子树差 | **面板不得按主题条件渲染**（也不得引入主题分支的新子树） |
| 15 | `theme-shell-isomorphism.test.jsx:97` | `tabHrefs === ['/','/exchange','/item/new','/messages','/profile']` | 底栏 `href` 不改（`T107`） |
| 16 | `v15-nav-floatmenu.test.jsx:138` / `:149` | 悬浮菜单「消息」项 `href` = `'/messages'` / `'/en/messages'` | 同上 |
| 17 | `theme-tokens.test.js` / `theme/tokens.js` `TOKEN_KEYS` | 逐键回读 `style-preview.html` + CSS↔JS 互校；`STRUCT_PROV` 带溯源硬门 | **零新主题 token / 零 `STRUCT` 增项** ⇒ 面板结构常量走**面板局部** `--sf-mp-*`（非 `tokens.js`） |
| 18 | i18n 计数硬断言 **13 文件** | 见 **§21.7（B）** | **+1 键引致前推**（唯一「必然红」面） |

> **★ 改锚执行注意事项（登记 · 交实现方现取）**：`v15-nav-floatmenu.test.jsx:245` 用例的 `fetch` 替身（`:256-262`）**现在同时服务「首页」与「面板」**（`/messages` 落点 = 首页 + 面板）⇒ 改锚时必须确认**首页在空 `rows` 替身下不抛错**（现取该替身返回 `{success:true,data:{rows:[],next_cursor:null}}`）；若首页另有取数需求，须在**同一替身**内按 URL 分支（**不得**新造全局假数据）。

### 21.7 i18n（**+1 键 · 四语同补**）+ 计数算式前推

**（1）现取基线（本单开工 · 只读）**：顶层 **`128`** / 拍平 **`1103`** / 四语节点 **`4412`**（`= 1103 × 4`）；**四语逐文件 `top/flat` 完全相等**（`zh`/`en`/`hk`/`vn` 各 `128 / 1103`）。**取法** = `json.load` 后 `len(dict)`（顶层）/ 递归叶计数（拍平）。

**（2）新增键（恰 1 条 · 四语同补）**：

| 键 | zh（定稿） | en / hk / vn（初译 · 待复核） |
|---|---|---|
| `messagesPage.close` | 关闭消息 | Close messages / 關閉訊息 / Đóng tin nhắn |

**（3）复用清单（零新增 · 现取 13 键全在场）**：`messagesPage.title` · `empty` · `backToList` · `detailEmpty` · `inputPlaceholder` · `send` · `sendFailed` · `rateLimited` · `aboutItem` · `loadMore` · `loadFailed` · `notFound` · `unreadA11y`。**面板不新增**列表 / 详情 / 发送 / 空态 / 加载更多 / 角标 a11y 任何文案键（关闭键是**唯一**新增项）。

**（4）新算式（写死 · 可复核）**：顶层 `128 + 0 = `**`128`**（`messagesPage` 已是既有顶层域 ⇒ **零新顶层**）；拍平 `1103 + 1 = `**`1104`**；四语节点 `1104 × 4 = `**`4416`**。**归零自检**：新增 `1` = 关闭键 `1`；删除 `0`；净 `+1` flat；顶层 `+0` 与「无新顶层域」自洽。

**（5）改锚清单（B）· 13 文件逐行**（**判负**：只改实现不改锚 ⇒ 整批红）：

| # | 文件 | 行 | 旧断言 | 新断言 |
|--:|---|---|---|---|
| B1 | `s5-publish-headcount.test.jsx` | `:86` / `:88` / `:91` | top `128` / flat `1103` / 节点 `4412` | top `128` / flat **`1104`** / 节点 **`4416`** |
| B2 | `s7-submissions-panel.test.jsx` | `:301` / `:303` / `:306` | 同上 | 同上 |
| B3 | `i18n-batch-b4a.test.jsx` | `:148` | `{ top: 128, flat: 1103 }` | `{ top: 128, flat: 1104 }` |
| B4 | `i18n-batch-b4b.test.jsx` | `:260` / `:326` | `{ top: 128, flat: 1103 }` / `'zh: top=128 flat=1103'` | flat **`1104`**（两处） |
| B5 | `i18n-batch-b5.test.jsx` | `:217` / `:261` | 同 B4 两形态 | 同 B4 |
| B6 | `i18n-violation-closeout.test.jsx` | `:88` / `:136` | `'作用域命中节点数 = 4412'` / `toBe(1103)` | **`4416`** / **`1104`** |
| B7 | `r9-93-points-symbol.test.jsx` | `:193` / `:195` | top `128` / flat `1103` | top `128` / flat **`1104`** |
| B8 | `r9-96-dashj-copy.test.jsx` | `:126` / `:129` / `:133` | top `128` / flat `1103` / 节点 `4412` | top `128` / flat **`1104`** / 节点 **`4416`** |
| B9 | `s8-locale-key-coverage.test.js` | `:188` / `:191` | flat `1103` / 节点 `4412` | **`1104`** / **`4416`** |
| B10 | `s9-ledger-kind-closure.test.js` | `:128` / `:131` | flat `1103` / 节点 `4412` | **`1104`** / **`4416`** |
| B11 | `s19-participants-truth-source.test.jsx` | `:106` / `:108` / `:111` | top `128` / flat `1103` / 节点 `4412` | top `128` / flat **`1104`** / 节点 **`4416`** |
| B12 | `s23-participants-headcount.test.jsx` | `:121` / `:124` | flat `1103` / 节点 `4412` | **`1104`** / **`4416`** |
| B13 | `tg-bind-qr.test.jsx` | `:14`（**注释**） | 「拍平 `1095⇒1103` / 四语节点 `4380⇒4412`」 | 「拍平 ⇒**`1104`** / 四语节点 ⇒**`4416`**」（注释同步；承本文件既有体例） |

> **★ 口径（写死）**：13 文件内的**历史前推注释行**（如 `i18n-batch-b4a.test.jsx:146-147`）**一律不改、不删**（历史留痕），**只改断言数值**并在该行尾追加一句「`sf19-msgpanel`：`+1` 键 ⇒ flat `1103⇒1104` / 节点 `4412⇒4416`」。**判负**：任一处遗漏或写成 `1103`/`4412` ⇒ 该文件红。

### 21.8 归因式 AC（**不用元素白名单** · 承 §19.8 / §20.9 体例）

| AC | 判据（可判负） | 现取锚点 |
|---|---|---|
| **AC-1 四入口不减** | 四条入口**全部现取在场且 `href` 字面未改**：① 底栏 href 集合含 `/messages`（`theme-shell-isomorphism.test.jsx:97`）② 悬浮菜单项 href = `/messages` / `/en/messages`（`v15-nav-floatmenu.test.jsx:138` / `:149`）③ 详情页「聊一聊」navigate 字面含 `/messages?c=`（`ItemDetailPage.jsx:157`）④ Telegram 通知正文含 `<site>/messages`（`messages-service.ts:717` / `:718`）。**任一缺 / 任一 `href` 变了 ⇒ 判负。** | 四处现取 |
| **AC-2 不换页 + 原地** | 打开消息前后：`pathname` **逐字相同**；宿主页面组件**未重新挂载**（挂载计数 = `1`）；`window.scrollY` **前后相同**（±0）。**任一不成立 ⇒ 判负。** | 探针两读数 |
| **AC-3 桌面几何** | `1440` 档：面板宽 = `600`；面板右缘 = 视口右 − `104`；**面板 rect 与 `.sf-fm` rect 相交 = `0`**（间隙 `16px`）；正文容器右缘 ≤ 面板左缘；`documentElement.scrollWidth ≤ clientWidth`。 | 探针 rect 读数 |
| **AC-4 手机档** | `≤767`（`390`/`375`/`320`）：面板 = `100vw × 100vh`；**单栏两态**可切（`?c=` 有无）；触控目标 ≥ `44`（`T77`）；`scrollWidth ≤ clientWidth`。 | 探针三档 |
| **AC-5 未打开 ⇒ 零影响（归因式）** | 面板**未打开**时，宿主页在 `1440` / `390` 两档与**改前逐元素差异集 = 0**（禁动画 + 只采可见元素 + 结构键，承 §13 归因配方）；**反事实自证**：打开面板后差异集**必须非空**（否则尺子无效）。 | 归因两读数 |
| **AC-6 结构不变式** | 面板**打开与未打开**两态：`[data-sf-region]` 集合恒 `= ['shell','topnav','content','footer','tabbar']`；`shell.css` `@media` 数恒 `1` 且含 `767px`；`shell.css` 无 `[data-theme`；`shell/**` JS 全文无禁用词表。 | 断言 + `grep` 四读数 |

> **AC-5 的「无效尺子」自证（写死 · 承 `N40` 教训族）**：判据必须**在改前形态下能红**（先跑一次「打开面板」态，差异集必须非空），否则该尺子对本次改动**不敏感 = 无效**，须换锚点再判（口径变更须留痕）。

### 21.9 新增可复用教训（`N44` / `N45` · 承 `N39`–`N43`）

- **`N44`（面板化 vs 页面化：就地叠加的三条落点纪律）**：把一个**已成形的真页**改为**就地叠加面板**时，**页面 CSS 可以复用、外壳约束一条都不能碰** —— ① 面板**不得新增 `data-sf-region`**（五 region 严格相等断言）；② 面板 CSS **不得落 `shell.css`**（该文件「唯一 767 断点块」+「无 `[data-theme`」双边断言）⇒ **新开文件**；③ 壳层状态用**修饰类 + 路由串匹配**（**严禁宽度判定**，外壳 JS 的禁用词表**按明文全文扫描、注释同禁**）；④ 面板**不得按主题条件渲染**（日/夜 DOM 形状逐项相等断言）。**判据** = 四条断言跑完零改动。
- **`N45`（「换宿主」类改动的改锚成本 = 钩子命名策略决定）**：**保留原钩子名**可把改锚面压到「宿主断言」一处；**改名 / 移位必须逐条进改锚清单**（`文件:行` → 旧断言 → 新断言），否则实现方与质检方对「哪些红是应当的」无共识。本单实例：16 条既有 `messages-*` 钩子**逐字保留** ⇒ 真改锚仅 **2 处**（用例名 + 根容器钩子 `messages-page` ⇒ `messages-panel`）；**唯一「必然红」的大面 = i18n 计数硬断言 13 文件**（`+1` 键 ⇒ `flat 1103⇒1104` / 节点 `4412⇒4416`）—— **新增文案键前必须先 `grep` 出全部硬编计数点**（本仓散落 ≥13 文件、三数并存：顶层/拍平/四语节点）。

### 21.10 留痕（就地注 · **原地正文一字未动**）

- **§20.2 表后**就地注：`T101` 的「**独立真页**」部分**已被 v1.19 §21 取代**（改为**内嵌面板**）；**三态 / keyset / 空态 / 触控 / 字号逐字保留**（只换宿主）。
- **§20.4 末**就地注：钩子清单**全部保留原名**，**唯一例外 = `messages-page` ⇒ `messages-panel`**；样式落点由「页面 `messages.css`」**扩为**「+ 新文件 `shell/messages-panel.css`」。
- **`T102`（Telegram 绑定卡）/ `T103`（未读角标）两行一字未动**；**角标不新增取数时点**（面板打开 / 关闭不当成第 4 个时点 —— 面板内发送成功仍走既有 ②/③ 时点）。
- **本册 §14.2 / `T81`–`T83`（悬浮菜单几何与可见性）一字未动**（Kevin ③「不遮挡、零几何改动」）。

### 21.11 待裁项（**不得自选 · 交 Kevin**）

| # | 项 | 现取分歧 | 本册兜底（已冻结，可用） |
|--:|---|---|---|
| **Q4** | 「聊一聊」**落点形态** | 现取 = `navigate('/messages?c=<id>')`（**换页**到直链落点 = 首页 + 面板）vs 方案 1 ④ 的**原地**形态 = 在 `/item/:id` 上加 `?msg=1&c=<id>`（**不换页**、详情页左压） | **本册冻结 = 入口 3 的 `href` 逐字不动**（`T107`「全部不改 `href`」）⇒ 现行 = 换页到直链落点；**原地形态登记为待裁**（改则须同步 `ItemDetailPage.jsx:157` + 清单 A） |
| **Q5** | `768–1199` 的紧凑档**左栏下限** | 本册冻结 `min(240px, 45%)`（`768` 档 ⇒ 左栏 `155px` / 右栏 `189px`） | **一句话可改**（改则须重跑 AC-3/AC-4 读数） |
| **Q6** | 面板**动效**（进场 / 左压过渡） | 本册**未冻结**（零动效 = 现取直出） | 如需：**必须尊重 `prefers-reduced-motion`**（仓内既有 `styles.css:397` / `:545` 体例）+ **归因式判据须禁动画**（§13 配方） |

### 21.12 未核实 / 登记（**诚实清单 · 禁填 0/空**）

- **`NOT_MEASURED`（本单未跑）**：`768`/`1024`/`1199` 三档几何实读数（本册只冻**判据 + 值**，未做浏览器走查）；`≤767` 全屏 + 单栏两态的触控 `≥44` 实读数；AC-2 的「挂载计数 = 1 / `scrollY` 不变」两读数；AC-5 归因两读数（**含尺子灵敏度自证**）；面板**打开时**的真实 `scrollWidth`（零溢出）。**原因 = 本单只写 `docs/**`、零代码、零浏览器动作。**
- **键值四语**（`messagesPage.close`）：en / hk / vn = **初译 · 待 Kevin 复核**（`T9x` 体例）。
- **本册本单未动**：`frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**`；**未跑任何门**（`build` / `test:unit` 未执行）；**未连库、未启停服务、未 `pm2 restart`**；**未 `git add -A` · 未 commit · 未 push**。
- **`docs/versions/design-system.spec.v1.18.md` 对现盘 `cmp` ≠ 0**（现取：`char 38020, line 19`）—— 该快照保留 **2026-10-15 勘误前**字面（其自述「本单未重制 / 未触碰 `docs/versions/**`」）⇒ **本单不重制、不触碰它**（历史留痕）；**本单改前读数以「现盘 live 正文」为准**（见 §21.13）。
- **★ v1.19 生产终验补登（Neng `1cc70d3` · 2026-10-16 · **勘误级不升版 · 纯追加**）**：生产终验 **PASS**（被检面 = 上线版 `da705e2` · 同版 sha256 `f53c130d…`；报告 `docs/qa/v119-msg-panel-prod.md` · **无新增 `spec_drift`**）另采到**两条质检覆盖面差异（非缺陷 · 本册只登记 · 不改产品面）**：
  - **① 未登录态打开面板 = 左栏渲染既有键 `pleaseLogin` 文案，但该文案无 `data-sf-m` 钩子** ⇒ 生产探针读成「左栏空」（`conversation-item` 计数 `0` · `messages-list-empty` 文案 = `null` · 登录引导钩子 `[data-sf-m*="login"/"auth"/"sign"]` 命中 `[]`）。**代码面现取 = `frontend/src/shell/MessagesPanel.jsx:197-198`**（`{!isAuthenticated ? (` ⇒ `<p className="sf-msg-status">{t('pleaseLogin')}</p>`）。**标【可测性小改 · 一句话可改】：后续单可给该文案补 `data-sf-m` 钩子（本单不改）**。与本地质检（探针夹具恒登录态 · `unread_total=250` / 3 会话行）**不矛盾，属覆盖面差异**（**两读数并存、不互相取代**）。
  - **② `NOT_MEASURED` 清单（生产面未采 · 禁填 `0`/空）**：生产 `768` / `1024` / `1199` 中间档几何（派单只要求 `1440` + `≤390` 两档；中间档已由本地质检四档覆盖）· `/hk` `/vn` 两语档几何（本地质检亦未采）· 修饰键 / 中键（新标签）行为（`popup` 读数 `ENV_LIMITED`）· 入口① 底栏第 4 格生产真点击（`1440` 档属既有 `display:none`、≥768 口径 ⇒ 未复点）· 入口③ 详情页「聊一聊」生产真点击（登录态会 `POST /api/messages/conversations` ⇒ 遵**零写纪律未点**；其**入口在场 + `href` 未改 + 落点命中 `T105`** 已由本地质检逐字取证）。
  - **⇒ 两条均登记不改**：`docs/OPEN-ITEMS.md` 新增 **`F27`**（可测性）/ **`F28`**（`NOT_MEASURED` 清单）；**§21.3 几何冻结值 / `T104`–`T108` / `§1`–`§20` 一字未动**。

### 21.13 快照 + 自证 + git 面（本节）

- **改前（现盘 live · 本单开工现取）**：`docs/design/design-system.spec.md` = **2100 行 / 467,793 B / md5 `49b2ebb1cae59d6409b2d3f70e8d9cbf`**；**改后**读数与 `git diff --numstat` 见 delta 件 `docs/audit/design-system-v1.19-delta.md`（**删除列 = 0** 自证 + 快照 `cmp=0` + 「未改 `frontend/`」`grep` 自证）。
- **快照面**：**改前快照** = 现盘 live 正文（**不新建文件**；`design-system.spec.v1.18.md` 为勘误前历史、**不触碰**）；**本版镜像** = **`docs/versions/design-system.spec.v1.19.md`**（落笔后建，`cmp=0`）。
- **两处版本记录同步（写死 · 计数锚点）**：① 头部 = `grep -n '^> \*\*★ 现行版 = v1.19'` **恰 1 命中**；② 正文 = `grep -n '^## §21 '` **恰 1 命中**；**两处同批入库，漏一处 = 不完整**。另 §12 表 = `grep -n '^| \*\*v1.19\*\* |'` **恰 1 命中**。
- **git 面**：只 `git add` 本单文件（`docs/design/design-system.spec.md` + `docs/route-layer.spec.md` + `docs/versions/design-system.spec.v1.19.md` + `docs/versions/route-layer.spec.v2.34.md` + `docs/audit/design-system-v1.19-delta.md` + `docs/audit/route-layer-v2.34-delta.md` + `docs/OPEN-ITEMS.md`）；**本地不 commit · 绝不 push**（收口由 Zang 统一种地）。

> **★ v1.19 勘误补登（勘误级 · 不升版 · 本节纯追加 · 旧字面逐字保留并标「已被本单实测取代」）**：依据 = **Neng 独立质检 `7150278`**（被检面 = 实现 `b776aee`；判决 = **PASS-with-drift**；报告 = `docs/qa/v119-msg-panel-qa.md`，漂移清单 = 报告 **§10 六条**；读数 = `ops/v119-msg-panel/qa/**` 9 件）。**规则条文 `T104`–`T108` 与几何冻结值一字不改**，本节只登记**实测口径取代**。**现取基线 = HEAD `7150278`（2026-10-16 · 工作区干净）**。

**① 入口③「聊一聊」= 就地叠加 ⇒ 取代 `§21.8 AC-1③` 与 `§21.11 Q4` 的「换页」字面**

- **旧字面（逐字保留、标已被取代）**：`§21.8 AC-1③` 写「③ 详情页「聊一聊」navigate 字面含 `/messages?c=`（`ItemDetailPage.jsx:157`）」；`§21.11 Q4` 冻结「本册冻结 = 入口 3 的 `href` 逐字不动 ⇒ 现行 = 换页到直链落点」。
- **实测（报告 §4.2 入口③）**：`ItemDetailPage.jsx` 由 `navigate('/messages?c=<id>')` 改为 `navigate(withPanelParams(location, id))` —— 真点击 ⇒ `pathname` **`/item/123` 逐字不变**、`search = ?msg=1&c=7`、面板开、`aboutText = 关于：FIXTURE 商品 A`、双向气泡各 1、**落点命中 `T105`** ⇒ **入口③ 与 ①/② 同款「就地叠加」**。
- **⇒ 任何 `toContain('/messages?c=')` 型断言锚不得采用**（该型锚由姊妹册 `route-layer.spec` §44.4 入口③「断言锚点」列**建议**、本补登**在该册标记作废**）。入口③ 的**现行验据** = **入口在场**（`data-sf-m="item-chat-btn"`；③ 本就是 `BUTTON`、**无 `href`** ⇒ `T107`「`href` 一字不改」只约束 ①/②/④ 的 `<a href>`）**+ 落点命中 `T105`**。
- **`Q4` 就此关闭**：裁定 = **「方案 1 · 就地叠加」为准**（Kevin 2026-10-16 裁定①）。`§21.11` 旧兜底行字面**保留为历史**、**不得再作现行口径引用**。

**② `/messages` 直链态「×」⇒ 回首页 ⇒ 取代「仅关闭面板、留在 `/messages`」的隐含读法**

- **实测（报告 §4.1 末两行）**：`/messages` 直链态面板内「×」⇒ 关后 `pathname = '/'`、`search = ''`、`panelClosed = true`。
- **依据（本条属性 = `T105` 的必然推论、非条文外延）**：`stripLangPrefix('/messages') === '/messages'` ⇒ **仅移 `msg`/`c` 会让判据仍成立、面板重开（死锁）** ⇒ 实现走 `panelCloseTarget`：**直链态 → `homePath`（首页）；就地态（加参当前页）→ 当前页**。

**③ `≥768` 未选会话右栏空态 = 全档复用既有键 `messages-detail-empty`（非「仅 `≤767` 单栏」）**

- **实测（报告 §5 `M2` / §8）**：`1440_exchange_open_list` 与 `1440_messages_direct` 均产出钩子 **`messages-detail-empty`**（文案 = 既有键 `messagesPage.detailEmpty`「还没有消息，发第一条吧」）⇒ `≥768` 双栏档未选会话时**右栏**亦用该键。
- **⇒ 空态判据 = 全档**（`≥768` 右栏 ＋ `≤767` 对话态）；**零新键** ⇒ `§21.7` 复用清单与键集算式（`1104` / `4416`）**不变**。旧读法「该空态仅属 `≤767` 单栏档」**已被取代**。

**④ 两栏分隔线实现口径（描述性偏差 · 数值不变量不受影响 · 代码无需改）**

- **实测（报告 §10 第 4 条）**：`frontend/src/shell/messages-panel.css` 中 —— **面板左缘** = `.sf-mp{box-shadow: inset 1px 0 0 …}`（**不占盒宽**）；**左栏 ⇄ 右栏分隔线 = `.sf-mp-list{border-right: 1px solid …}`**（**不是** `inset` 阴影）。
- **`600 = 240 + 360` 实测仍成立**（报告 §2.1 四档逐值）：因 **Tailwind preflight 全局 `box-sizing: border-box`** ⇒ 左栏 border-box 恒 `240`（含 1px 边框）。**本仓无全局 `*{box-sizing}` 手写规则** ⇒ 该归零来自**构建产物里的 Tailwind preflight** = **隐式依赖**（**本册登记：若他日 preflight 退场，`600=240+360` 须重测**）。

**⑤ 「零横向溢出」判据 ⇒ 降级为「环境性旁证」（登记 · 非缺陷 · 不承重）**

- **旧字面（逐字保留、标已被取代）**：`§21.3` 的 `768–1199` 行写「硬判据 = `document.documentElement.scrollWidth ≤ clientWidth`（**零横向溢出**）…」；`§21.8 AC-3` 与 `AC-4` 末句亦列该判据。
- **实测（报告 §3 末）**：面板 = **`position:fixed` 浮层** ⇒ **不参与 `scrollWidth`** ⇒ 该读数**全 13 态恒 `0`**（含未打开态）⇒ **对本次改动不敏感**（尺子功能性另证：同页追加 `static` + `width:3000px` 元素 ⇒ `documentElement.scrollWidth 1440 → 3000`）。
- **⇒ 承重的桌面判据 = 五条**：面板宽 `600` / 右偏移 `104` / 面板↔`.sf-fm` 间隙 `16` / 相交 `0` / 正文右缘 ≤ 面板左缘（**均已逐条自证敏感**，报告 §3 扰动臂）；`scrollWidth ≤ clientWidth` **降级为旁证**（读数保留、**不作承重判据**）。

**⑥ `AC-5` 判据口径 ⇒ 采纳「结构键 + 剔 `alt`/`title` 属性值」的声明式归一化 + 噪声源具名**

- **旧字面（逐字保留、标已被取代）**：`§21.8 AC-5` 写「宿主页在 `1440` / `390` 两档与**改前逐元素差异集 = 0**（禁动画 + 只采可见元素 + **结构键**…）」—— 该「raw 差异集 = 0」判据**在本仓结构上不可达**。
- **噪声源具名（独立证实）**：`frontend/src/components/Footer.jsx:12` `const randomCatSloganKey = CAT_SLOGAN_KEYS[Math.floor(Math.random() * CAT_SLOGAN_KEYS.length)]` —— **模块加载期** `Math.random()` 选 `footer.catSlogan1..3`，该值**同时**喂给合作品牌 CAT 的 `<a title=…>` 与内层 `<img alt=…>` ⇒ **每载随机**。**该文件不在本单 diff、sha256 与 `fd34ca0` 逐字相同**（⇒ 属改前既有随机项，**非本单产品面变更**；其余 `alt`/`title` 逐轮恒定 ⇒ 随机项**恰 1 处**）。
- **归一化范围（写死 · 只此一处）**：对**全部可见元素**统一**剔除 `alt` 与 `title` 两个属性的「值」**（**属性在场**仍计）；**其余一切照旧** —— `tag` / **全部 class** / 其它全部语义属性（`href` / `aria-label` / `data-*` / `type` / `role` / `src` / `width` / `height` …）/ **结构路径** / **可见性** 全在键内；**坐标从未进键**。
- **为何不算「放宽判据」（四条 · 逐条可核）**：① 被剔除的是**内容文本**、不是结构 / 几何（该 AC 判「面板未打开时宿主页零影响」，承载面 = DOM 结构 + 几何；`alt`/`title` 的**文案值**既非结构亦非几何，其**属性在场与否**仍被键覆盖）；② 该两项在本仓**结构性不可确定**（噪声源是**模块加载期** `Math.random()` ⇒ 任何把其值纳入键的判据**结构上不可能跨页面加载复现**；**不是把红改绿，而是把恒不可达的判据换成可达且抗噪的判据**）；③ 归一化后的尺子经**证伪检验**（**对偶**：同一页注入 1 个额外可见元素 ⇒ 差异集 **1**；**打开态注入** `.sf-mp{display:none}` ⇒ **24**；**反事实** `/?msg=1` ⇄ `/` ⇒ **34** ⇒ 尺子未瞎）；④ **未把「该有差异的页」抹平**（同一尺子在 `/messages` 上仍报 **89**，逐条列出旧真页子树 / 首页 + 面板子树）。
- **⇒ `AC-5` 现行判据** = **归一化差异集 = 0**（**8/8 页档**：`1440/{home,exchange,item,task,profile}` ＋ `390/{home,exchange,item}`）+ **噪声源具名** + **尺子灵敏度三臂非空**；**原「raw 差异集 = 0」原样保留为 `ENV_LIMITED`（不得改写成 PASS）**。
- **遗留（登记 · 不作缺陷）**：`/hk` `/vn` 两语档几何 `NOT_MEASURED`；`popup`（新标签）读数 `ENV_LIMITED`（headless 只到 `about:blank`）—— 均入 `docs/OPEN-ITEMS.md`。

> **★ 本节自证（勘误补登 · 改后现取）**：见 `docs/audit/design-system-v1.19-delta.md` **§D 勘误补登**（改前 / 改后 行数 · 字节 · md5 + `git diff --numstat` **删除列 = 0** 纯追加自证 + 镜像 `docs/versions/design-system.spec.v1.19.md` 重制至 `cmp=0` + 两处版本锚点命中数）。

---

## §22 首页商品卡片 UI（底色分层 / 价格块版式 / 整卡可点击）

### 22.0 裁定来源（Kevin 2026-10-17 · 逐字三条 + Zang 已裁定口径 Q1–Q3）

**Kevin 原话（逐字三条）**：

1. 「背景色不要用黄色，黄色可以用在顶部菜单栏。」
2. 「严格按照参考图调整 货币符号和金额 处的 UI 设计。其它部分的 UI，请你酌情处理。」
3. 「整张卡片可点击，而不是只有按钮可点击。」

**参考图落盘真身（本单开工前已落盘 · 本单只读、未触碰）**：

| 件 | 路径 | 尺寸 | sha256 |
|---|---|---|---|
| 参考图（闲鱼商品卡片） | `ops/ui-card-ref-20261017/shots/ref-xianyu.png` | **516×838** | `c7a0aa9f11e9d8fdb83eadab16b95a0f6227ac389ebad19a3588d0e2054c9fa0` |
| 本站改前卡片 | `ops/ui-card-ref-20261017/shots/current-seafood.png` | **672×848** | `be25f54209e928df68fd625dfa5ef0769383ca2ca61c72b5911b2e2a19401491` |

**参考图已量取细节（本单复核 · 视觉读数）**：价格 = `¥29.90` 同行同基线、全加粗、橙红 ≈ `#FF4D2E`、**背后无框无底**；`¥` 高度 ≈ 数字的 **75–80%**（明显更小）；小数位 `90` 与整数位同高、只有小数点极小；右侧同行灰色小字「24人想要」。

**Zang 已裁定口径（`Q1`–`Q3` · 本册逐字采用）**：

- **`Q1` 底色分层**（Kevin 原话：「页面底（约 1500 像素固定宽度之外）是 `#F5F7F9`，大容器底（约 1500 像素固定宽度内）是 `#FFFFFF`，卡片底色纯白，hover 状态在卡片的外围略加阴影。完全参考自 `https://www.goofish.com/`」）⇒ 落法 = **新增主题 token `--sf-surface-bg`**（日档 `#FFFFFF` / 夜档 `#101114`）· **`--sf-page-bg` 日档由 `#FDE815` 改 `#F5F7F9`**（夜档 `#0B0C0E` 不变）· **`--sf-topbar-bg` 日档保持 `#FDE815`**（＝ 黄色唯一落点 = 顶部菜单栏）· `.sf-route-container` 挂 `var(--sf-surface-bg)` · `.sf-shell` 继续 `var(--sf-page-bg)`。**★ 容器几何不动**：`--sf-st-shell-max-w` 现取 = `1440px`（Kevin 说「约 1500px」为描述性近似）⇒ **本单不动几何**，登记为「一句话可改」（见 §22.11 `Q8`）。**★ 追加落点**：`.sf-item-actionbar`（详情页底部操作栏）现挂 `var(--sf-page-bg)` ⇒ 页底转灰后它会在白容器内变成一条灰带 ⇒ **一并改挂 `var(--sf-surface-bg)`**。
- **`Q2` 价格块**：「照搬参考图排版（同行 / 符号小 / 数字大 / 同基线 / 无框无底），颜色仍用本站 token（日档墨黑、夜档亮黄）」⇒ **参考图的「小数位更小」规则不适用**（本站积分 = 整数 `points_required`，无小数）· **范围收窄**：只改**首页商品卡片**（`frontend/src/components/reward/RewardCard.jsx`）；**详情页价格块（`pages/item/item.css` 的 `.sf-item-price-l` / `--sf-l-detail-price-size`）本单不动**（Kevin 点名的图 = 卡片，不是详情页）。
- **`Q3` 整卡可点击**：卡片整体 = **一个链接**（带语言前缀走既有构造器 `buildLocalizedPath`，目标 `/item/<id>`）；卡片内 CTA **不得与整卡形成嵌套交互元素**（`<a>` 内不得有 `<button>`）⇒ CTA 降级为**非交互视觉胶囊**（保留文案键 `item.viewDetail` 与钩子 `reward-card-view`）。**硬约束**：`RewardCard` 在**无 Router 上下文**裸渲染时（既有用例 `frontend/src/test/unit/i18n-batch-b2.test.jsx:154/158/170` 直接 `render(<RewardCard reward={{…}} />)`）**不得抛错** ⇒ 链接能力必须可选、缺省回落非链接容器。

**★ 本册只承载「token / 落点 / 交互契约 / 断言影响 / 归因式 AC」；不含 React 代码**（承 §0 阅读约定）。

### 22.1 现取基线（本单开工 · HEAD `d8cb98e` · 2026-10-17 · 只读现取 · 工作区仅多出未跟踪的 `ops/ui-card-ref-20261017/`）

| 项 | 现取读数 | 取法（可复核） |
|---|---|---|
| 卡片价格块（**首页卡片**） | `<div class="text-right ml-4"><div class="text-2xl font-bold text-yellow-600">{points_required}</div><span class="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span></div>` ⇒ **数字与 `$` 上下堆叠**（`<div>` 块级在 `<span>` 之上）、色 = Tailwind `text-yellow-600` / 夜档 `dark:text-yellow-400`、**无外框、无底色、无内边距** | `frontend/src/components/reward/RewardCard.jsx:91-98` |
| 卡片容器与底色 | `variant={reward.variant \|\| 'primary'}` + `hover="glow"` ⇒ 日档解析为 `bg-yellow-50 border-yellow-200`（**奶黄底**）+ `hover:shadow-xl hover:ring-2 hover:ring-yellow-200` | `RewardCard.jsx:46-48` · `components/ui/Card.jsx:9-20` |
| CTA（现为按钮） | `<Button variant={canClaim ? 'success' : 'inactive'} … data-sf-m={actionLabelKey ? 'reward-card-view' : 'reward-card-claim'}>`，文案 = `t('item.viewDetail')`（首页传入） | `RewardCard.jsx:154-169` · `pages/HomePage.jsx:311-317` |
| `--sf-page-bg` 值 | 日档 `#FDE815` / 夜档 `#0B0C0E` | `frontend/src/theme/tokens.js:30` / `:146` |
| `--sf-topbar-bg` 值 | 日档 `#FDE815` / 夜档 `#0B0C0E` | `tokens.js:32` / `:148` |
| `page-bg` 的 PROV 锚 | `{ d: [200, 'background:#FDE815'], n: [273, 'background:#0B0C0E'] }` | `tokens.js:266` |
| `--sf-page-bg` **消费者全集** | **仅 2 处**：`.sf-shell`（`frontend/src/shell/shell.css:16`）· `.sf-item-actionbar`（`frontend/src/pages/item/item.css:349`） | `grep -rn 'var(--sf-page-bg)' frontend/src` |
| `.sf-route-container` | `flex:1 1 auto; width:100%; max-width:var(--sf-st-shell-max-w); margin:0 auto; padding:0 var(--sf-st-topbar-pad-x)` —— **无 `background`** ⇒ 现为「透出页底」 | `shell.css:26-32` |
| `.sf-region-top`（顶部菜单栏） | `background: var(--sf-topbar-bg)` | `shell.css:20-24` |
| `.sf-price` 家族 | `shell.css:283-308`（`.sf-price` / `.sf-price-cur` / `.sf-price-num` / `.sf-price-unit`）；**唯一消费者 = `pages/ThemePreviewPage.jsx:152-155`** | `grep -rn 'sf-price' frontend/src` |
| 详情页价格块（**本单不动**） | `.sf-item-price` / `.sf-item-price-cur`（12px）/ `.sf-item-price-num`（`--sf-st-price-num-size`）/ `.sf-item-price-l .sf-item-price-num`（`--sf-l-detail-price-size` = **32px**） | `item.css:114-140` · `:333-335` · `:24` |
| 链接构造器（唯一真源） | `buildLocalizedPath(lang, path)` ⇒ zh 无前缀、`en/hk/vn` 加前缀 | `frontend/src/utils.js:115-125` |
| 键集（**现取**，四语逐文件相等） | 顶层 **`128`** / 拍平 **`1104`** / 四语节点 **`4416`**（`= 1104 × 4`） | `frontend/src/locales/{zh,en,hk,vn}.json` 解析 |
| 前端路由计数 / 后端注册点 | `<Route` 字面 **`42`** / 精确 **`34`**；后端 **`105`** | `App.jsx` · `backend-ts/src/index.ts` |
| 门套改前基线（**2026-10-17 08:00 现取 · Zang 采**） | `Test Files 54 passed (54)` / `Tests 520 passed (520)`；产物名 `assets/index-C3dRJ_m4.js` + `assets/index-D4sieLPp.css` | `ops/ui-card-ref-20261017/readings/baseline.log` |
| 真源页改前读数 | `docs/design/style-preview.html` = **1042 行 / 86,638 B / md5 `13a845dacb6865ea3fa738663a63159c`** | `wc` / `md5` |

### 22.2 规则条文（`T109`–`T113`）

| 规则 | 条文（写死） |
|---|---|
| **`T109`** | **底色分层（Q1）**：**新增主题 token `--sf-surface-bg`**（日档 `#FFFFFF` / 夜档 `#101114`）；**`--sf-page-bg` 日档 `#FDE815` ⇒ `#F5F7F9`**（夜档 `#0B0C0E` **不变**）；**`--sf-topbar-bg` 日档保持 `#FDE815`**（＝ **黄色唯一落点 = 顶部菜单栏**）；`.sf-shell` 继续挂 `var(--sf-page-bg)`；`.sf-route-container` **新增** `background: var(--sf-surface-bg)`；`.sf-item-actionbar`（`item.css:349`）由 `var(--sf-page-bg)` **改挂** `var(--sf-surface-bg)`。**零几何改动**（不动 `--sf-st-shell-max-w`、不动任何 `--sf-st-*`）。 |
| **`T110`** | **价格块版式（Q2 · 只限首页商品卡片）**：**一行 flex + `align-items: baseline`**；顺序 **`$` → 数字（→ 单位）**；**`$` 小号**（高度 ≈ 数字的 **75–80%**）；**数字大号 + 加粗**（`font-weight ≥ 700`）；**去外框 / 去底色 / 去内边距**（`border-width: 0` / `background: transparent` / `padding: 0`）；**颜色取本站既有 token** `--sf-price-cur-fg` / `--sf-price-num-fg` / `--sf-price-unit-fg`（日档 `#030402` / 夜档 `#FDE815`）⇒ **参考图橙红 `#FF4D2E` 不采纳**；**参考图「小数位更小」规则不适用**（积分恒为整数 `points_required`）；**零新增主题 token / 零 `STRUCT` 增项 / 零新 `--sf-l-*`**（字号与间距一律走既有 `--sf-st-price-num-size`(21px) 相对比例 + Tailwind 既有档，**不得新造结构常量**）。 |
| **`T111`** | **范围收窄（Q2 边界 · 写死）**：本单**只改** `frontend/src/components/reward/RewardCard.jsx`（首页商品卡片）。**详情页价格块本单不动**：`frontend/src/pages/item/item.css` 的 `.sf-item-price` / `.sf-item-price-cur` / `.sf-item-price-num` / `.sf-item-price-unit` / `.sf-item-price-l` 与页面局部常量 `--sf-l-detail-price-size`(32px)、`--sf-l-actionbar-h`(60px) **一字不动**（唯一例外 = `.sf-item-actionbar` 的 `background` 一行改挂 `--sf-surface-bg`，见 `T109`）。`pages/ThemePreviewPage.jsx` + `pages/theme-preview.css` 的 `.sf-price` 家族**一字不动**。Kevin 原话「其它部分的 UI，请你酌情处理」**不等于**放开上述三处。 |
| **`T112`** | **整卡可点击（Q3）**：卡片最外层元素 = **单一 `<a>`**，`href` = **`buildLocalizedPath(lang, '/item/' + id)`**（`utils.js:115` 唯一构造器；zh 无前缀 / `en/hk/vn` 带前缀）；**卡内 `<a>`/`<button>`/`<input>`/`<select>`/`<textarea>` 计数必须 = 0**（禁嵌套交互元素）；既存 CTA 降级为**非交互视觉胶囊**（保留文案键 `item.viewDetail` 与钩子 `reward-card-view`，**钩子挂点由 `<button>` 迁至非交互元素**）；**语言来源 = i18next**，**严禁任何宽度 / `matchMedia` / `innerWidth` 判定**（外壳 JS 硬断言按明文全文扫描，注释同禁）。**★ 不得改用 `.sf-btn` 族**（该族有冻结清单，见 §22.7 `A7`）。 |
| **`T113`** | **无 Router 回落契约（写死 · 硬）**：`RewardCard` 在**无 Router 上下文**裸渲染时**不得抛错**（既有用例 `i18n-batch-b2.test.jsx:154/158/170` 无 `MemoryRouter` 直接渲染）⇒ **链接能力必须可选**、缺省**回落非链接容器**（同 DOM 结构 / 同 class，仅 `tagName` 由 `A` 变 `DIV`、`href` 缺席）；**裸渲染仍产出 `<a href>` 亦判负**。 |

**★ 勘误（2026-10-17 · v1.23 · 上表 `T112` 条中「既存 CTA 降级为**非交互视觉胶囊**（保留文案键 `item.viewDetail` 与钩子 `reward-card-view`，**钩子挂点由 `<button>` 迁至非交互元素**）」= **作废 · 以本段为准**）**：Kevin 2026-10-17 指令 = 「首页商品卡片移除『查看详情』胶囊」；实现 = `frontend/src/components/reward/RewardCard.jsx`（`actionLabelKey` 存在时动作胶囊**整块不渲染**）。**现行口径（`T112` 的 CTA 子条改写为）**：**① 首页商品卡片不渲染任何动作胶囊**（`[data-sf-m="reward-card-view"]` 计数 **必须 = 0**）；**② 入口由整卡链接承载**（卡根单一 `<a>`、`href` = `buildLocalizedPath(lang, '/item/' + id)`）—— `T112` 的**链接子条逐字不变**；**③ 卡内 `<a>` / `<button>` / `<input>` / `<select>` / `<textarea>` 计数仍必须 = 0** —— 该子条**逐字不变**；**④ 钩子 `reward-card-view` 随胶囊一并下线**（**不得渲染、不得改名复用**；测试锚 = 0）。**⑤ 旧路径逐字不变**：不传 `actionLabelKey` 的 `reward-card-claim` / `onClaim` / 三态文案**一字不动**（实测 `claimPill = 1` · `viewPill = 0` · 卡内交互元素 `0`）；文案键 `item.viewDetail` **保留不删**（键集零变化），仅首页路径不再消费。**⑥ 读者须知（防下一轮照旧字面误判）**：§22 内其余提及「保留 `reward-card-view` 钩子 / CTA 降级为视觉胶囊」的旧字面 —— §22.1 `Q3` 段 · §22.3 表 · §22.6「CTA 形态」行 · §22.7 断言影响小结 · §22.9 `AC-3` · §22.12 第 6 / 19 项 —— **一律随之作废**，旧字面**逐字保留、不作口径**（其中 §22.6 / `AC-3` / 第 6 项另设就地勘误行）。**⑦ 实测读数（2026-10-17）** = 首页卡内 `[data-sf-m=reward-card-view]` **4 → 0**（1440 与 390 同）· 卡根 `a[href=/item/<id>]` **仍在** · 卡内交互元素 **0 → 0** · 卡最后一行子元素 **2 → 1（无空洞）** · 点卡片标题仍跳 `/item/3041` · 门套 **57 files / 554 tests 前后不变** · CSS **零变化**（`ops/home-card-remove-cta-20261017/readings/probe-{before,after}.json` · `click-entry-after.json` · `logs/test-{before,after}.log`）。

### 22.3 `T110` 展开 · 参考图元素 → 数据承载 / 落点映射表（**未映射元素一律不渲染**）

| 参考图元素 | 数据承载 | 本站落点 | 处置 |
|---|---|---|---|
| 商品主图 | `reward.image`（可为缺） | 既有 `CardContent` `<img>` | 不变（本单不动） |
| 标题（含省略号） | `reward.title` | 既有 `CardTitle`（`line-clamp-2`） | 不变 |
| 价格 `¥29.90` | `points_required`（**整数**） | 价格块（`T110`） | **照版式、不照色** |
| `¥` 小号 | 同上 | 价格块符号槽 | 采纳（75–80%） |
| 小数位 `90` 更小 | — | — | **不适用**（无小数） |
| 右侧同行灰字「24人想要」 | **无承载**（读口无 想要 / 浏览计数） | — | **不渲染**（承 §19.4 `T99`「无数据承载不渲染」） |
| 卖家行（头像 + 昵称） | **无承载**（无 owner / seller） | — | **不渲染**（同上） |
| 「一周内发布」标签 | 无承载 | — | **不渲染** |
| 价格背后无框无底 | — | 价格块容器 | 采纳（`border-width:0` / `background:transparent` / `padding:0`） |

**★ 勘误（派单描述 ⇄ 现取 · 本单发现 · 逐字保留并标注）**：派单称首页卡片价格块「外套一层黄底黑框胶囊（`.sf-price` 家族：`--sf-price-bg` / `--sf-price-border` / `--sf-price-radius`）」。**现取不符**：`RewardCard.jsx:91-98` 为 **Tailwind `text-yellow-600` + 数字 / `$` 上下堆叠、无框无底**；`.sf-price` 家族（`shell.css:283-308`）在本仓**唯一消费者 = `pages/ThemePreviewPage.jsx:152`**；`item.css:114-140` 是详情页**自带**的同名族 `.sf-item-price*`（非 `.sf-price`）。⇒ **口径按「以现取为准」写**：`T110` 的「去外框 / 去底色 / 去内边距」在首页卡片上为**幂等表述**（现状本就无框无底）⇒ 实义 = **不得新增框 / 底 / 内边距**，且对 `.sf-price` / `.sf-item-price*` 两族**零改动**。**该描述差异由 Jing 现取取证后登记，不作缺陷立案、不改派单**（教训见 §22.10 `N47`）。**另**：现取另证「卡片外层有黄框 + 奶黄内底」的是 **`Card` 的 `variant='primary'`**（`ui/Card.jsx:10`）—— 与 Kevin「背景色不要用黄色 / 卡片底色纯白」的差额见 §22.11 `Q5`。

### 22.4 `T109` 展开 · 底色分层落点表（逐位置 · 含现取消费者全集）

| 位置 | 现取（文件:行） | 改后 | 依据 | 一句话可改 |
|---|---|---|---|---|
| **页面底**（固定宽度之外） | `.sf-shell { background: var(--sf-page-bg) }`（`shell.css:16`）⇒ 日档解析 `#FDE815` | 日档 **`#F5F7F9`**；夜档 `#0B0C0E` **不变** | Kevin `Q1` | ✓（换 hex） |
| **大容器底**（固定宽度之内） | `.sf-route-container`（`shell.css:26-32`）**无 `background`** ⇒ 透出页底 | **新增** `background: var(--sf-surface-bg)`（日 `#FFFFFF` / 夜 `#101114`） | Kevin `Q1` | ✓（换 hex） |
| **顶部菜单栏** | `.sf-region-top { background: var(--sf-topbar-bg) }`（`shell.css:20-24`）；日档 `#FDE815` | **不变** | Kevin ①「黄可以用在顶部菜单栏」 | ✓（若日后要换黄本身） |
| **卡片底** | `RewardCard.jsx:47` `variant={reward.variant \|\| 'primary'}` ⇒ `ui/Card.jsx:10` `bg-yellow-50 border-yellow-200`（**奶黄底**） | **本单落法清单未点名落点** ⇒ **待裁 `Q5`**（Kevin `Q1` 原话含「卡片底色纯白」） | Kevin `Q1` 原话 | ✓（一句话改 `variant`） |
| **卡片 hover** | `RewardCard.jsx:48` `hover="glow"` ⇒ `ui/Card.jsx:19` `hover:shadow-xl hover:ring-2 hover:ring-yellow-200` | **未点名** ⇒ **待裁 `Q6`**（阴影项与 Kevin 原话相符；**黄环**是否保留待裁） | Kevin `Q1` 原话 | ✓（一句话） |
| **详情页底部操作栏** | `.sf-item-actionbar { background: var(--sf-page-bg) }`（`item.css:349`） | **改挂** `var(--sf-surface-bg)` | Zang `Q1` 追加裁定 | ✓ |
| 页脚 | `.sf-region-foot`（`shell.css`）**无 `background`** ⇒ 透出页底 | **不变**（落在灰页底上 = 与 goofish 同构） | —— | —— |

**★ 「日档页底变色」的影响面（现取全集 · 只 2 处）**：`grep -rn 'var(--sf-page-bg)' frontend/src` 命中 **恰好 2 行** = `shell.css:16`（**应留**）与 `item.css:349`（**改挂**）⇒ 改后 `--sf-page-bg` 的消费者**只剩 1 处**。**除此之外全仓无第三处消费者**；`#FDE815` 字面**只出现在 token 值表的两处载体**内（`frontend/src/theme/tokens.js` 的 DAY/NIGHT 值表 + 其生成物 `frontend/src/theme/theme-tokens.css` 的 **29 行**）—— 现取 `grep -rn 'FDE815' frontend/src --include='*.css' --include='*.jsx' --include='*.js' | grep -v 'theme/tokens.js'` ⇒ **29 行全部落在 `theme-tokens.css`** ⇒ `styles.css` / `shell.css` / 各页面 CSS / 各 JSX **零字面**（⇒ 「页底转灰」不会因某处写死黄 hex 而漏改）。

### 22.5 `T110` 展开 · 价格块版式冻结 + 「小数位规则不适用」登记

| 项 | 冻结 | 类别 | 一句话可改 |
|---|---|---|---|
| 排列 | `display: flex` **同行**；顺序 **`$` → 数字（→ 单位）** | 结构 | ✗（照参考图） |
| 基线 | `align-items: baseline`（`$` / 数字 / 单位 **同基线**） | 结构 | ✗ |
| 符号大小 | `$` 高度 ≈ 数字的 **75–80%** | 结构 | ✓（比例区间内） |
| 数字 | **大号 + 加粗**（`font-weight ≥ 700`） | 结构 | ✓ |
| 外框 / 底色 / 内边距 | **全无**（`border-width: 0` / `background: transparent` / `padding: 0`） | 结构 | ✗（照参考图） |
| 颜色 | `--sf-price-cur-fg` / `--sf-price-num-fg` / `--sf-price-unit-fg`（日 `#030402` / 夜 `#FDE815`） | 主题 token | ✓（换值） |
| 参考图橙红 `≈#FF4D2E` | **不采纳**（Zang `Q2` 裁定：「颜色仍用本站 token」） | —— | ✗（除非 Kevin 改口径） |
| 小数位更小 | **不适用**（本站积分为整数 `points_required`，无小数） | —— | ✗ |
| `$` 的 DOM 形态 | 必须仍在 **`<span>`** 内且 `>$</span>` 在 `RewardCard.jsx` 内**恰 1 处** | 结构 · 硬 | ✗（既有断言，见 §22.7 `A1`） |

**★ 「零新增 token」的边界**：价格块三色是**既有 token**（`price-cur-fg` / `price-num-fg` / `price-unit-fg`），本单**不新增**主题 token；几何量一律走既有 `--sf-st-price-num-size`(21px) + 相对比例，**不新增 `STRUCT` 键、不新增 `--sf-l-*`**（`STRUCT_PROV` 带**溯源硬门**：新键必须能回读真源行 ⇒ 本单不提供新结构常量真源行）。若实现方认为必须新增结构常量，**须停下上报**（承 `T98` 体例）。

### 22.6 `T113` 展开 · 整卡可点击的交互契约 + 无 Router 回落契约（写死）

| 项 | 契约 | 判据（可复核） |
|---|---|---|
| 卡片根元素 | **单一 `<a>`**（`tagName === 'A'`） | `container.firstElementChild.tagName`（或卡片根选择器） |
| 链接目标 | `href` = **`buildLocalizedPath(lang, '/item/' + id)`** | zh ⇒ `/item/1`；`/en` ⇒ `/en/item/1`（`utils.js:115`） |
| 语言来源 | **i18next**（`useTranslation()` 的 `i18n.language` / `resolvedLanguage`） | **禁** `matchMedia` / `innerWidth` / `innerHeight` / `clientWidth` / `offsetWidth` / `screen.width`（含注释） |
| 嵌套交互元素 | 卡片 `<a>` 子树内 `a|button|input|select|textarea` **计数 = 0** | `cardRoot.querySelectorAll('a,button,input,select,textarea').length === 0` |
| CTA 形态 | **非交互视觉胶囊**；**文案键 `item.viewDetail` 保留**；**钩子 `reward-card-view` 保留**（挂点由 `<button>` 迁至非交互元素） | `[data-sf-m="reward-card-view"]` 在场且其 `tagName ∉ {BUTTON, A}`；`textContent` = `t('item.viewDetail')` |
| CTA 类族 | **不得引入 `.sf-btn` 族**（该族有 11 文件冻结清单） | `grep -c '\bsf-btn\b' RewardCard.jsx` = **0** |
| **无 Router 回落（硬）** | 裸渲染**不抛错** + **不产出 `<a href>`** | 见 §22.9 `AC-4`（两向判负） |
| a11y 名 | 由**卡内文本**天然提供（标题 + 价格）；**本单零新 i18n 键** | 若实现方另加 `aria-label` ⇒ **须四语同补并前推 13 文件计数**（§21.7 清单 B），本册**不批准**新键 |
| **CTA 形态 · v1.23 勘误（承上行 · 取代上行「CTA 形态」行 · 旧字面逐字保留）** | **首页卡片不渲染动作胶囊**（`actionLabelKey` 存在 ⇒ 动作胶囊整块不渲染）；**入口由整卡链接承载**；**卡内交互元素计数仍 = 0**；**钩子 `reward-card-view` 随胶囊下线** | 卡根 `tagName === 'A'` ∧ `href` 非空 ∧ `querySelectorAll('[data-sf-m="reward-card-view"]').length === 0` ∧ `querySelectorAll('a,button,input,select,textarea').length === 0`（口径依据 = §22.2 `T112` 勘误段） |

### 22.7 受影响硬断言清单（**现取重锚 · 逐条点名到 `文件:行`**）

**清单 A —— 本单**真改面 / 真改锚**（不做即判负）**

| # | 断言（`文件:行`） | 现取口径 | 本单必须做的动作 |
|---|---|---|---|
| **A1** | `frontend/src/test/unit/r9-93-points-symbol.test.jsx:33-38`（`USAGE_FILES['components/reward/RewardCard.jsx'] = 1`）+ `:105-111`（正则 `/>\$<\/span>/g` 计数 `toBe(1)`；同处断言源文不出现 `DashJ`） | `RewardCard.jsx:96` 现为 `<span …>$</span>` | **`$` 必须仍在 `<span>` 内、`>$</span>` 在 `RewardCard.jsx` 内恰 1 处**（改成同行 flex 时**不得**把 `$` 移出 `<span>`、不得出现第二处 `>$</span>`） |
| **A2** | `r9-93-points-symbol.test.jsx:154-160`（`MemoryRouter` 内渲染 `RewardCard reward={{bID:1,title:'R',points_required:66}}` ⇒ `container.textContent` 含 `$`） | 通过 | 改链接后**仍须渲染 `$`**（`$` 不得因版式调整而消失/进 CSS `content`） |
| **A3** | `frontend/src/test/unit/i18n-batch-b2.test.jsx:154 / :158 / :170`（**无 `MemoryRouter`** 直接 `render(<RewardCard reward={{…}} />)`） | 通过 | **加可选链接能力**：无 Router ⇒ 回落非链接容器（`T113`） |
| **A4** | `frontend/src/test/unit/theme-tokens.test.js:68-94`（逐键回读 `PROV[key]` 的 `[行号, 片段, (可选)禁含]`） | `tokens.js:266` `page-bg` 的 `d = [200, 'background:#FDE815']` | **改值 ⇒ 必须同改 PROV 指针**：`page-bg.d` 由 `[200,'background:#FDE815']` ⇒ **`[1069,'background:#F5F7F9']`**；**新增键 `surface-bg`** 的 `d` ⇒ **`[1071,'background:#FFFFFF']`**、`n` ⇒ **`[1073,'background:#101114']`**（`n` 仍 `[273,'background:#0B0C0E']`） |
| **A5** | `theme-tokens.test.js:164-180`（日档块逐键 = JS `day` 表、夜档块逐键 = JS `night` 表；两块键集相同且 `= TOKEN_KEYS.length`） | `theme-tokens.css:50` `--sf-page-bg: #FDE815;`（日）· `:163` `--sf-page-bg: #0B0C0E;`（夜） | **生成物同步**：日档 `:50` 值 ⇒ `#F5F7F9`；**两档各新增 `--sf-surface-bg`**（日 `#FFFFFF` / 夜 `#101114`）；`theme-tokens.css` 头注自称「生成物，勿手改」⇒ **优先重生成**（生成器现存：`backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`），若不可用则手改并给「逐键一致」读数 |
| **A6** | `frontend/src/test/unit/theme-shell-isomorphism.test.jsx:240-258`（主题块内每个 `--sf-*` 必须在 `TOKEN_KEYS` 内） | `tokens.js:261` `TOKEN_KEYS = Object.keys(DAY)` | **`surface-bg` 必须加进 `DAY`**（⇒ 自动进 `TOKEN_KEYS`；`NIGHT` 同键序同位置） |
| **A7** | `frontend/src/test/unit/p6-btn-impl2.test.js:73-89`（`.sf-btn` 家族清单 `toEqual([…11 文件…])` **精确相等** + `≥22` 处用法） | 清单**不含** `components/reward/RewardCard.jsx` | **改造后仍不得在 `RewardCard.jsx` 内出现 `\bsf-btn\b`**（CTA 视觉胶囊**不得**复用 `.sf-btn` 族；一旦引入 ⇒ 该断言当场红） |
| **A8** | `frontend/src/test/unit/p6-miscfix.test.jsx:126-162`（`src/pages` + `src/components` 下 `to="/…"` / `navigate('/…')` 字面残留 **必须 = 0**；构造器使用点 **≥ 10**） | 残留 = 0 | **整卡链接必须走 `buildLocalizedPath`**；**不得**写 `to="/item/…"` 字面（模板字面 ``` to={`/item/${id}`} ``` 亦属「绕过唯一构造器」的自选路径，本册不批准） |

**清单 B —— 冻结面**零改锚**（改动不得碰）**

| # | 断言（`文件:行`） | 本单为何不碰 |
|---|---|---|
| **B1** | `theme-shell-isomorphism.test.jsx:207-215`（`src/shell/**` + `src/theme/**` 的 JS 无 `matchMedia` / `innerWidth` / `innerHeight` / `clientWidth` / `offsetWidth` / `screen.width`，**注释同禁**） | 链接/判据一律走路由与数据；`tokens.js` 只加常量 |
| **B2** | `theme-shell-isomorphism.test.jsx:217-241`（`shell.css` **只有一个 767 断点块**、宽屏无 `[data-theme`、无 `theme-day` / `theme-night` 字面） | 底色分层落 `.sf-shell` / `.sf-route-container` 既有规则，**不新增 `@media`** |
| **B3** | `theme-shell-isomorphism.test.jsx:80-122`（五 `data-sf-region` 恒等 + tabbar `href` 集） | 卡片在路由容器内，**不得新增 `data-sf-region`** |
| **B4** | `theme-tokens.test.js:58-66`（日/夜键集合与**键序**完全相同、`≥100` 键） | 新键两档**同位置**插入 |
| **B5** | `theme-tokens.test.js:96-109`（键名「连字符分段」黑名单 + 值形态白名单 `^#…$` 等） | `surface-bg` 分段 = `surface` / `bg` ⇒ 不触黑名单；值 `#FFFFFF` / `#101114` 命中 hex 分支 |
| **B6** | `theme-tokens.test.js:111-117`（两档差异键 **> 90**；且 `day.page-bg ≠ night.page-bg`） | 新增键日/夜不同值（`#FFFFFF` ≠ `#101114`）；`page-bg` 改后 `#F5F7F9` ≠ `#0B0C0E` ⇒ **零改锚** |
| **B7** | `theme-tokens.test.js:119-133`（`STRUCT` ≥25 键、值不含 `#`/`rgba(`、`STRUCT_PROV` 齐备、与 token 不重名） | 本单**零 `STRUCT` 增项** |
| **B8** | `theme-tokens.test.js:135-150`（`STRUCT_PROV` 逐条可回读；`EXCLUDED_FROM_THEME` ≥8 条且含 `style-preview.html:行号`） | 本单不改结构常量、不改排除表 |
| **B9** | `p6-btn-impl2.test.js:104-131`（`.sf-btn` 基类无 hex/rgba 字面量、`var()` 白名单 = `--sf-st-*` + `btna*`/`btnalt*`） | 价格块颜色走 `--sf-price-*`，**与 `.sf-btn` 族无关** |
| **B10** | `r9-93-points-symbol.test.jsx:113-127`（产品面 `DashJ` 零引用、允许集仍在场） | 本单不涉及 `DashJ` |
| **B11** | `theme-shell-isomorphism.test.jsx:341 / :359`（`T93` 跟随系统三态 + 首帧不落盘） | 本单不碰主题初始化 |

**★ 断言影响小结（供实现方前推）**：**真改锚 1 条**（`A4`：`page-bg` 的 `d` 指针 + 新增 `surface-bg` 的 PROV）；**真改面 4 条**（`A1` / `A3` / `A5` / `A7` 的「不得引入」）；**新增硬契约 2 条**（`T112` 嵌套交互元素 = 0 / `T113` 无 Router 回落）；**冻结面零改锚 11 条**（清单 B）。**「新增 1 键」的既有口径（§21.7 清单 B · 13 文件硬编计数）本单不触发** —— `T112` 明确**零新 i18n 键**。

**★ v1.20 就地注（`Q5`–`Q9` 定案后重取 · 上段字面未改）**：**`Q5`/`Q6`/`Q9` 定案不引致任何断言改锚** —— 全仓测试**无**一条冻结 `RewardCard` 的 `variant` / `hover` / 稀有度渐变底（现取逐条见 §22.12 第 15/16 项）。**且 `Q5`/`Q6` 的「不得改 `ui/Card.jsx` 两张变体表」正是被既有断言**保护**的口径** —— `frontend/src/test/components/Card.test.jsx:17-19` 现取 `expect(card).toHaveClass('bg-yellow-50', 'border-yellow-200')`（`<Card variant="primary">`）· `:62` 注释冻结 `hover` 枚举 `'none'|'lift'|'glow'` ⇒ **改表即红**（故 `Q5`/`Q6` 只能改**消费方** `RewardCard.jsx` 的入参）。**新增 `AC-9` = 新增判据（非改锚）**。

### 22.8 i18n（**零新增 / 零删除**）+ 计数算式

- **本单零新增 / 零删除 i18n 键**：CTA 文案复用既有键 **`item.viewDetail`**（`HomePage.jsx:316` 传入，四语齐备）；整卡链接的可访问名由**卡内既有文本**提供（标题 + 价格）⇒ **不新增 `aria-label` 键**。
- ⇒ **键集逐字不变**：顶层 **`128`** / 拍平 **`1104`** / 四语节点 **`4416`**（`= 1104 × 4`；**2026-10-17 四语逐文件现取相等**）。
- **★ 若实现方另行新增任何文案键 / `aria-label` 键**：必须**四语同补**（非 zh 可标「待复核」）**并前推 §21.7 清单 B 的 13 文件硬编计数**，否则整批红；**本册不批准新键**（口径 = 复用既有键）。

### 22.9 归因式 AC（**不用元素白名单** · 承 §19.8 / §20.9 / §21.8 体例）

| AC | 判据（写死 · 可复核） | 判负 |
|---|---|---|
| **AC-1** 底色分层（`T109`） | 日档：`.sf-shell` computed `backgroundColor` = `rgb(245,247,249)`；`.sf-route-container` = `rgb(255,255,255)`；`.sf-region-top` = `rgb(253,232,21)`。夜档：分别 `rgb(11,12,14)` / `rgb(16,17,20)` / `rgb(11,12,14)`。且 `grep -rn 'var(--sf-page-bg)' frontend/src` 命中 **恰 1 行**（`shell.css:16`） | 任一不等 / 消费者 ≠ 1 处 |
| **AC-2** 价格块版式（`T110`） | `$` 与数字在**同一父 flex** 且该父 `align-items: baseline`；`$` 与数字 `rect` 的基线差 **≤ 1px**；`$` 高度 ÷ 数字高度 ∈ **[0.70, 0.85]**；数字 `font-weight ≥ 700`；价格块容器 `border-width = 0px` + `backgroundColor` 透明 + `padding = 0px`；日/夜两档色分别等于 `--sf-price-cur-fg` / `--sf-price-num-fg` 的解析值 | 堆叠（不同行）/ 符号 ≥ 数字 / 存在框底色内边距 / 色不等于 token 解析值 |
| **AC-3** 整卡可点击（`T112`） | 卡片根 `tagName === 'A'` 且 `href` 逐字 = `buildLocalizedPath(lang, '/item/' + id)`（zh `/item/1`、`/en` `/en/item/1`）；卡内 `querySelectorAll('a,button,input,select,textarea').length === 0`；`[data-sf-m="reward-card-view"]` 在场且 `tagName ∉ {BUTTON, A}`；真点卡片**空白区** ⇒ `pathname` = `/item/<id>` | 根非 `<a>` / `href` 非构造器产物 / 嵌套交互元素 > 0 / 点卡片空白处无跳转 |
| **AC-3 · v1.23 勘误注**（**承上行 · 就地注 · 取代上行「`[data-sf-m="reward-card-view"]` 在场且 `tagName ∉ {BUTTON, A}`」这一条断言** · 依据 = Kevin 2026-10-17 指令 + 实测 `ops/home-card-remove-cta-20261017/readings/probe-{before,after}.json`） | **① `reward-card-view` 不得存在**：`cardRoot.querySelectorAll('[data-sf-m="reward-card-view"]').length === 0`；**② 卡根 `a[href]` 必须存在**：`cardRoot.tagName === 'A'` ∧ `href` 逐字 = `buildLocalizedPath(lang, '/item/' + id)`（zh `/item/1`、`/en` `/en/item/1`）；**③ 卡内交互元素 = 0**：`querySelectorAll('a,button,input,select,textarea').length === 0`；**④ 真点卡片标题 ⇒ `pathname` = `/item/<id>`**（实测 1440 / 390 两档均 = `/item/3041`）。**首页实测** = 卡内 `viewCta` **4 → 0**（1440 与 390 同）· 卡内交互元素 **0 → 0** · 卡最后一行子元素 **2 → 1**（无空洞）· CSS 零变化 | `reward-card-view` 计数 > 0（= 胶囊回流）/ 卡根非 `<a>` 或 `href` 非构造器产物 / 卡内交互元素 > 0 / 点卡片标题无跳转 |
| **AC-4** 无 Router 回落（`T113` · **两向判负**） | **无 `MemoryRouter`** 直接 `render(<RewardCard reward={{…}} />)` ⇒ ① **不抛错**；② `container.querySelectorAll('a').length === 0`（回落非链接容器） | 抛错 **或** 裸渲染产出 `<a href>` |
| **AC-5** 归因式「不动面」（**不用元素白名单**） | `/item/:id` 详情页改前/改后逐元素差异集 **100% 归因于被批准的变更集**（= `T109` 的 `background` 一行 + token 值变更引起的颜色面）；**反事实**：测量期把 `item.css:349` 回改 `var(--sf-page-bg)` 且把 `page-bg` / `surface-bg` 回退旧值 ⇒ 该差异集**为空**。采数口径承 §13（禁动画 + 只采可见元素 + 结构键 + 结构键不入坐标 + 页面加载期随机源具名归一化） | 出现与 token 值/背景无关的几何差异，或反事实回退后差异集非空 |
| **AC-5 · v1.20d 范围补注**（**承上行 · 就地注 · 只补「不动面」的**范围措辞**，判据本身一字未改** · 依据 = Neng 独立质检 `ops/ui-card-ref-20261017/qa/neng-readings-ac5.json`） | **① 承重面点名（防下一轮照旧字面误立案）**：AC-5 的「不动面」承重面 = **真·非首页路由** —— `/item/:id`（`1440`/`390` · 日/夜）＋ `/exchange`（`1440`/`390`）＋ `/task`（`1440`/`390`）＋ `/profile`（`1440`）；上列**逐档差异集 100% 归因**（Neng 实测：归一化差异每档 `2–3`、**未归因 `0` · 几何 `0` · 结构 `0` · 文本 `0`**；**反事实臂 `8/8` 档 `cf = 0`** —— v2 自修后复跑，见 §22.12 第 17 项）。**② ★ 例外点名 = `/messages`（该路由不在「不动面」内）** —— 现取 `frontend/src/pages/MessagesPage.jsx:15` = **`const MessagesPage = () => <HomePage />`** ⇒ `/messages` **不是独立页**，其渲染树 = **首页 + 消息面板**（承 §21 `T104` / `T107`）⇒ **首页卡面（`RewardCard`）的任何改造在该路由上「本来就该」出现差异 ⇒ 该差异集属「被批准的变更集」**，**不得据「非首页路由差异集非空」判负**。Neng 实测（`messages1440` · 静默窗口 + 归一化后）：归一化差异 **`68` = 结构项 `66`（全归因）+ 颜色项 `2`**（`structuralOnlyInParent` = 改前卡 `bg-yellow-50` + `BUTTON.btn`；`structuralOnlyInCurrent` = 改后卡 `A.sf-reward-card` + 非交互胶囊；**`66/66` 命中批准标记**）· **未批准余项 `0` · 几何 `0` · 结构 `0` · 文本 `0`**。**③ 反事实臂不覆盖卡面（口径登记）**：AC-5 的反事实（`T109` 底色三件回退）**只覆盖底色分层** ⇒ 对**含首页渲染树**的路由（`/messages`）**该臂不适用**、**不得**用它要求「差异集为空」（此类路由用 `②` 的归因式判据）。 | 把 `/messages` 算进「非首页路由」并据其差异集判负（= 把已批准变更当回归）；或把 `T109`-only 反事实臂套到含首页的路由并要求差异集为空 |
| **AC-6** 结构不变式 | 改后：`grep -c '@media' frontend/src/shell/shell.css` = **1**；`src/shell/**` + `src/theme/**` JS 无禁用宽度词；五 `data-sf-region` 恒等；`TOKEN_KEYS` 含 `surface-bg`；`theme-tokens.css` 日/夜两块键集相同且逐键 = `tokens.js`；`STRUCT` 键数与 `EXCLUDED_FROM_THEME` 条数**不变** | 任一破 |
| **AC-7** 门套 | `cd frontend && npm run build` ⇒ **exit 0**；`npm run test:unit` ⇒ **例数不减少**（改前基线 **54 files / 520 tests**，2026-10-17 08:00 现取） | 例数下降 / build 非 0 |
| **AC-8** 范围边界（`T111`） | `git diff --name-only` 内**不含** `frontend/src/pages/item/item.css` 的 `.sf-item-price*` / `--sf-l-detail-price-size` 改行，**不含** `pages/ThemePreviewPage.jsx` + `pages/theme-preview.css`；`item.css` 唯一改动 = `.sf-item-actionbar` 的 `background` **一行** | 越界改动 |
| **AC-9** 夜档价格可读性（**新增 · v1.20 就地注 · 归因式** · 采数口径承 §13） | 卡片价格「前景 ÷ 背景」的 **WCAG 2.x 对比度比值 ≥ 4.5:1**，且**必须给「改前 vs 改后」两条对照读数**：**改后 = `#030402` on 白卡 `#FFFFFF` ⇒ 20.546:1 ✓**；**改前 = Tailwind `text-yellow-600`（解析 `rgb(208,135,0)` = `#D08700`）on 奶黄卡 `bg-yellow-50`（`#FEFCE8`）⇒ 2.841:1 ✗（原态本就不达标）**。**归因（写死）**：改后 ≥ 4.5 **100% 归因于两点** —— ① 卡片底 `bg-yellow-50 ⇒ bg-white`；② **卡内子树局部重绑** `--sf-price-cur-fg` / `--sf-price-num-fg` / `--sf-price-unit-fg` 为日档值（`#030402` / `#030402` / `#3A3A2A`）。**反事实臂（灵敏度自证 · 必跑）**：只做 ① 而不重绑 ⇒ 夜档 token 值 `#FDE815` on 白卡 = **1.255:1** ⇒ **判负**（尺子必须对这一臂变红）。**取值口径** = 真页 `getComputedStyle` 的 `color` ÷ 生效 `background-color`（**不得**用声明值代替、**不得**用父页 `matchMedia` 推断站内主题，承 §17.5 / `N38`）；比值算式 = WCAG 2.x `(L₁+0.05)/(L₂+0.05)` | 比值 < 4.5 / 未给「改前 vs 改后」两条读数 / 反事实臂仍 ≥ 4.5（= 尺子不敏感）/ 两向自证缺一（反事实臂恒红而改后臂**结构上不可达**） |
| **AC-9 · v1.20c 勘误注**（**承上行 · 就地注 · 取代上行「改前臂 = 2.841:1」的数值与覆盖范围** · 依据 = Kong 三臂实测 `ops/ui-card-ref-20261017/readings/kong-night-contrast.json` / `.log`） | **① 改前臂更正（夜档）**：价格块**两色不一致** —— 数字 `text-yellow-600` = `#CA8A04` on 奶黄卡 `bg-yellow-50` = `#FEFCE8` ⇒ **2.84:1**；符号 `dark:text-yellow-400` = `#FACC15` on **同一底色** ⇒ **1.48:1** ⇒ **改前臂取最差 = 1.48:1（✗ 远低于 4.5:1）**。〔上行 `2.841:1` **只覆盖数字臂**、漏了符号臂；且上行「夜档仍吃 `text-yellow-600`」的前提**已被实测推翻**（`dark:` 类在**站点夜档**下实测生效）⇒ 口径见 §22.12 第 14 项勘误注 + 教训 `N50`。〕**② 改后臂** = `#030402` on `#FFFFFF` = **20.55:1 ✓**。**③ 反事实臂（灵敏度自证 · 必跑）** = 只改卡底、不重绑子树 ⇒ 夜档 token `#FDE815` on 白卡 = **1.255:1** ⇒ 判负（尺子必须对这一臂变红）。**④ ★ 独立复现（新增判据 · 写死）**：本 AC 的**裁决读数必须由质检方自行取得，不得只读实现方读数** —— `kong-night-contrast.json` / `.log` 只作**旁证 / 交叉核对**、**不作裁决依据**；质检方须在**同一 dist、同一 headless Chrome**上自行跑**三臂**：**臂 A**（站点夜档 `html[data-theme]=dark` + 设备偏好 light）/ **臂 B**（站点夜档 + 设备偏好 dark）/ **臂 C 控制臂**（同设备偏好下**只把 `data-theme` 翻回 `light`**）；**每臂落盘三读数** = `html` 计算 `color-scheme` ＋ `matchMedia('(prefers-color-scheme: dark)').matches` ＋ 目标元素 `getComputedStyle`（`color` ÷ 生效 `background-color`），并**由该回读值自行复算** WCAG 2.x 比值（三者均须可复核）。 | 任一臂缺读数 / 未做三臂独立复现 / 以实现方读数当裁决依据 / **臂 C 未与臂 A/B 取值不同**（= 尺子不敏感 ⇒ 与「恒绿」同罪）/ 改前臂仍只写 `2.841:1`（漏符号臂）/ 比值 < 4.5 |

### 22.10 新增可复用教训（`N46` / `N47` · 承 `N39`–`N45`）

- **`N46` · 「变更既有 token 的取值」也必须同步 PROV 行号锚点，且「新值行」只能落在追加块里。** 机制：`theme-tokens.test.js:68-94` 的 PROV 语义 = 「该 token 的值能在真源的**指定行**上被读到」；旧值那一行（`style-preview.html:200` 的 `background:#FDE815`）在新口径下**不再是该 token 的证据**，而该行又**不得改写**（真源「纯追加」纪律）⇒ **唯一合法解 = 新值在追加块另起一行 + PROV 指针改指该行**。⇒ 规则：**「改值」= 加真源行 + 改 PROV 指针，两件缺一即判负**；只加行不改指针 ⇒ 测试读旧行、断言新值不在该行 ⇒ **红**；只改指针不加行 ⇒ 指针指向不存在的片段 ⇒ **红**。
- **`N47` · 派单描述与现取不符时，先取证再写册；册里「逐字保留派单描述 + 标『与现取不符』+ 给现取读数」，口径按「以现取为准」写。** 本单实测：派单称首页卡片价格块「外套一层黄底黑框胶囊（`.sf-price` 家族）」，而 `RewardCard.jsx:91-98` 实为 **Tailwind `text-yellow-600` + 上下堆叠 + 无框无底**，`.sf-price` 家族的**唯一消费者**是 `ThemePreviewPage.jsx:152`（`item.css` 那族是**另一个**同名族 `.sf-item-price*`）。⇒ 若照派单描述落册：① 规范里会留下一条**对不上代码的现状陈述**（下一轮照它判负/判绿都会错）；② 实现方按册「去框去底」会**多删一层并不存在的框**（幂等操作看不出错，却掩盖了「真问题其实是卡片自身的 `bg-yellow-50`」）。**取证成本 ≈ 1 次 `read_file` + 1 次 `grep`。**
- **`N48` · 派单方给的「候选裁定选项」与其**实际改动面**可能不对称 —— 候选文字不得隐含未声明的视觉变更。** 本单实例：`Q9` 的候选 (a) 写作「**不新增任何常量**：用既有 `--sf-st-price-num-size` 上的相对比例 `0.75–0.8em` 表达」—— 字面是「零新增常量」这一**制度性优点**，但它同时把数字从**现状的 `text-2xl`（24px）** 悄悄压到 **21px（−12.5%）**：**「视觉权重缩小」这件事在候选文字里一次都没出现**。⇒ 规则：凡候选含「**改用既有常量 / 相对比例**」这类**落点替换**，必须**并列声明**「**保持现状权重**」或「**接受缩小（给出比例）**」二者之一，且**裁定文字必须显式接住**；**判据** = 候选行必须同时给出**改前绝对值**（此处 `text-2xl` = 24px）与**改后绝对值**，缺一即视为「隐含变更」，**不得进入裁定**。本单终审取「**数字保持 `text-2xl`(24px) 不变**、只把符号改成数字的 `0.75em`(≈18px)」= 显式「保持现状权重」。
- **`N49` · 「主题无关的浅色卡」× 「主题 token 色」= 结构矛盾，**必然在某一档不可读** ⇒ 定式二选一并写进册。** 机制：卡片底是**静态 Tailwind 浅色**（`bg-yellow-50` / `bg-white`，**不随主题变**），而价格色引用**两档异值的主题 token**（`--sf-price-num-fg`：日 `#030402` / 夜 `#FDE815`）⇒ **夜档必然吃到亮黄**：`#FDE815` on 白卡 = **1.255:1**（**不可读**）。**这是结构性必然、不是配色口味问题** —— 任何「两档异值 token ＋ 单档不变底色」的组合都会在其中一档失读。⇒ **定式（二选一 · 必须写进册）**：**(i) 该组件也随主题**（底色改挂 token ⇒ 两档同源、色对自洽）；**(ii) 组件子树内局部重绑**（如卡根上把 `--sf-price-*` 重绑为日档值，使「浅色卡两档同貌」自洽）。**无论选哪条，都必须给「日档 / 夜档」两档的可读性读数**（本单 = `AC-9` 的 **20.546:1 vs 1.255:1** 对照；`Q7` 的夜档分层可辨性属同族相邻项）。**本单取 (ii)**（卡 = 与主题无关的白卡、两档同貌 ⇒ 不改底、只重绑色）。

- **`N50` · 站点在**根元素**声明了 `color-scheme` ⇒ 产物里的 `@media (prefers-color-scheme: …)` 会随**站点主题**命中 ⇒ Tailwind `dark:` 工具类是**活的**；判某个 `dark:` 类的死活**必须实测三臂（站点档 × 设备偏好）**，不得仅凭「无 `custom-variant dark`」推断。** 机制：`dark:` 只被编成 `@media (prefers-color-scheme: dark)`（本仓产物现取**恰 1 处**）—— 该媒体查询的求值输入**不是 OS 偏好本身**，而是**元素 used `color-scheme`**（根元素声明即全站继承口径）；本仓已声明 `html{color-scheme:light}` ／ `html[data-theme="dark"]{color-scheme:dark}`（落 `frontend/src/styles.css` 顶层 ＋ `frontend/index.html` meta）⇒ **站点切夜档即把根元素 `color-scheme` 置 dark ⇒ 该媒体查询命中 ⇒ 全站 `dark:` 工具类真的生效**。⇒ 本仓此前「`dark:` 是死码」的推断**已被实测推翻**（Kong 三臂实测，`ops/ui-card-ref-20261017/readings/kong-night-contrast.json`）：**两条旧事实链仍成立** —— ① 仓内**无** `@custom-variant dark`（`grep -rn 'custom-variant' frontend/src frontend/index.html` = 0 命中）；② 产物 CSS 里该媒体查询**恰 1 处** —— **错的是由它们推出的结论**（见 §22.12 第 14 项勘误注）。**定式（判死活）= 同一 dist、同一 headless Chrome 跑三臂**：**臂 A**（站点夜档 ＋ 设备偏好 light）/ **臂 B**（站点夜档 ＋ 设备偏好 dark）/ **臂 C 控制臂**（同设备偏好下**只翻 `data-theme`**回 light）；每臂落盘 `html` 计算 `color-scheme` ＋ `matchMedia('(prefers-color-scheme: dark)').matches` ＋ 目标元素 `getComputedStyle` 回读；**臂 C 必须与臂 A/B 取值不同**（否则尺子不敏感 ⇒ 判负）。**★ 另（「修一个 bug 开出另一个变量」实例 · 值得记成定式）**：本仓的 `color-scheme` 声明**当初是**为修「手机 UA 强制深色把日档整体压暗」而**主动加上**的（§17.3 ／ `N26`／`N31` 一族）—— ⇒ **该声明的副作用恰是上面这条行为**（把站点主题接到 `prefers-color-scheme` 的求值输入上，令全站 `dark:` 从死变活）。⇒ 规则：**凡为修某个 UA ／ 环境行为而声明的全局属性，必须同批列出它的旁观副作用面**（此处 = 「令全站 `dark:` 工具类由死码变生效」），并**在同一批里重取一次受影响面的读数** —— 「修好 A」与「A 的声明改变了 B 的求值输入」是**两件都要登记**的事。

- **`N51` · 同一色的「册面 sRGB 值」一律以「真实元素浏览器 `getComputedStyle` 回读」为准；canvas / Node 自算（`oklch` 转换路径）只能作旁证，不得直接当册里的值。** 机制：Tailwind v4 的调色板真源是 `oklch()`（`frontend/node_modules/tailwindcss/theme.css`），把它算成 sRGB 有**两条路** —— ① **浏览器引擎**（元素 `getComputedStyle` ⇒ 引擎按自身色彩管理 + `rgb()` 序列化规则给值）；② **自实现 `oklch` → sRGB 转换**（Node 脚本 / canvas）⇒ **两路结果可以不同**：本仓实测 `--color-yellow-600` 浏览器回读 **`rgb(202,138,4)` = `#CA8A04`** vs Node 自算 **`rgb(208,135,0)` = `#D08700`**（**最大通道差 `6/255`**；`gray-800` 差 `2`；`yellow-50` 相同）⇒ 凡写进册的色值 / 由它复算的比值（对比度等），**必须取自真实元素的浏览器回读**（本仓实例 = `AC-9` 改前臂 **`2.84:1` 用 `#CA8A04`**；自算值那条只作旁证口径 `2.841:1`）；**两条路并列时必须标出通道差量级**，不得单列自算值当口径。**不得**用「四舍五入 / 误差可忽略」抹平：它同时是**取数路径差**与**判据差**（`2.84` ⇄ `2.841`）的混合体。与本条同族的既有纪律 = `N46`（**回读才是证据**）：PROV 指向的真源行要能被读到，**色值也要能在真浏览器里被读到**；本册 §22.12 的 `13-勘误（v1.20d）` 即本条的首个落地实例。

### 22.11 待裁项（**不得自选 · 交 Kevin / Zang**）

| # | 项 | 现取事实 | 候选（均标「一句话可改」） |
|---|---|---|---|
| **`Q5`** | **「卡片底色纯白」的落点**（Kevin `Q1` 原话含此句，但派单落法清单**未点名落点**） | `RewardCard.jsx:47` `variant={reward.variant \|\| 'primary'}` ⇒ `ui/Card.jsx:10` `bg-yellow-50 border-yellow-200` = **奶黄底 + 黄边框**（与「背景色不要用黄色」直接相关） | (a) 传 `variant="default"` ⇒ `bg-white border-gray-200`；(b) 追加覆盖类 `bg-white`。**两案都不得改 `ui/Card.jsx` 变体表**（该件被多面共用）。**另**：`RewardCard.jsx:52-53` 的稀有度条件类（`from-yellow-50 to-yellow-100` / `from-purple-50`）是否同批收敛 ⇒ 一并裁 |
| **`Q6`** | **卡片 hover 的黄环** | `RewardCard.jsx:48` `hover="glow"` ⇒ `ui/Card.jsx:19` `hover:shadow-xl hover:ring-2 hover:ring-yellow-200` | Kevin 原话「hover 状态在卡片的外围略加阴影」⇒ **阴影项已满足**；`ring-yellow-200`（黄环）是否与「黄色唯一落点 = 顶部菜单栏」冲突 ⇒ 裁 (a) 只留阴影（去 `ring-2`）/ (b) 保留 |
| **`Q7`** | **夜档 `--sf-surface-bg = #101114` 的分层可辨性** | 与夜档页底 `#0B0C0E` 差 ≈ `ΔRGB(5,5,6)`；本仓既有夜档面 = `#141619`(`card-bg`/`panel-bg`) / `#111317`(`ticker-bg`) —— **本单新值是第三个夜档面层级** | (a) 保留 `#101114`；(b) 改用既有 `#141619`（分层更明显、且**非新色值**） |
| **`Q8`** | **容器宽 `--sf-st-shell-max-w`** | 现取 = **`1440px`**（`tokens.js:391` + `STRUCT_PROV['shell-max-w'] = [85,'max-width:1440px']`）；Kevin 说「约 1500px」为**描述性近似** | **本单不动几何**（Zang 已裁定）。若要真 `1500px` ⇒ **一句话可改**，但须**同步 `STRUCT_PROV['shell-max-w']`**（溯源硬门：新值必须能回读真源行）⇒ 属**另一单** |
| **`Q9`** | **`$` 小号的具体落点** | 首页卡片价格块现取字号 = Tailwind `text-2xl`(24px) 数字 + `text-sm`(14px) `$`（比例 0.583，**低于 75–80%**）；详情页族另有 `--sf-st-price-num-size`(21px) + `.sf-item-price-cur` 12px | (a) **不新增任何常量**：用既有 `--sf-st-price-num-size` 上的**相对比例**（`0.75–0.8em`）表达；(b) 新增页内局部 `--sf-l-*`（**本册不批准**：页面局部常量须落该页面 CSS 且本单不新增文件面）；(c) 新增 `STRUCT` 键（**本册不批准**：`STRUCT_PROV` 硬门要求真源行，本单无） |

**★ v1.20 就地注（`Q5`–`Q9` **全部已裁** · 上表五行 **旧字面逐字保留** · 不得再据上表判「待裁」）**：本注为**就地注** —— 受本册「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束，**上表五行的字面未改一字**，故「**已裁**」标记由**紧随其后的登记表**承接（**读表口径 = 以登记表为准**；上表 `Q5`–`Q9` 的「(a) / (b) / (c)」候选字面自本注起为**历史**）。**裁定来源 = Zang 终审 2026-10-17**（回答两条连带裁定）+ **Kevin 2026-10-17 追加口径**（见下「夜档另议」块）。

**★ `Q5`–`Q9` 已裁登记（Zang 终审 2026-10-17 · 逐条写死 · 旧字面逐字保留）**

| # | 裁定 | 写死内容（逐条 · 不得自选） |
|---|---|---|
| **`Q5`** | **已裁 = 候选 (a)** | `frontend/src/components/reward/RewardCard.jsx` 的 `variant={reward.variant \|\| 'primary'}` ⇒ 缺省**改 `'default'`**（`ui/Card.jsx:10` = `bg-white border-gray-200`）。**不得改 `ui/Card.jsx` 的变体表**（该件多面共用，且 `Card.test.jsx:17-19` 正冻结 `primary` 的 `bg-yellow-50 border-yellow-200` ⇒ 改表即红）。**另**：`RewardCard.jsx` 的**稀有度渐变底类同批去掉** —— `bg-gradient-to-br from-yellow-50 to-yellow-100`（legendary）与 `bg-gradient-to-br from-purple-50 to-purple-100`（epic）；**稀有度图标（`getRarityIcon`）与 `absolute` 装饰光斑（`opacity-20 blur-xl` 圆）保留**（前者是信息载体、后者是既有效果项，均不涉「黄色落点」）。 |
| **`Q5` ❗ 勘误（v1.25 · 2026-10-19）** | **图标半句作废 · 其余维持** | Kevin 2026-10-19 商品卡改版四条（§26.0）要求**移除状态徽章及其前置礼物图标** ⇒ 上行「**稀有度图标（`getRarityIcon`）与 `absolute` 装饰光斑（`opacity-20 blur-xl` 圆）保留**」中**图标部分作废**：`getRarityIcon` 整函数 + 其默认 `Gift` 图标随状态徽章一并移除（import 清理归实现单）；**装饰光斑保留**（该半句仍有效）。`variant='default'`（候选 a）与上行其余写死内容**不受影响**。**现行口径以 §26（`T122`）为准**；上行字面逐字保留（本册只追加口径）。 |
| **`Q6`** | **已裁 = 候选 (a)（只留阴影）** | 去 `hover="glow"`（其 `hover:shadow-xl hover:ring-2 hover:ring-yellow-200` 含**黄环** `ring-yellow-200`）⇒ 改 **`hover="none"`** + `className` 追加 **`hover:shadow-lg`**；**不位移**（不得引入 `-translate-y-*`、不得改用 `lift` 变体）。**不动 `ui/Card.jsx` 的 hover 变体表**（`none` 已是既有档）。 |
| **`Q7`** | **已裁 = 候选 (a) + 暂定标注** | 夜档 `--sf-surface-bg` **保留 `#101114`**；**PROV 不变**（仍 `docs/design/style-preview.html:1073` ⇒ `tokens.js` 的 `surface-bg.n = [1073,'background:#101114']`）；**同时标注为「暂定值」** —— 随下条「夜档另议」**另立单复核**（与夜档页底 `#0B0C0E` 仅差 ΔRGB(5,5,6)，分层可辨性**未定案**）。 |
| **`Q8`** | **已裁 = 不动** | `--sf-st-shell-max-w` **保持 `1440px`**（`tokens.js:391` + `STRUCT_PROV['shell-max-w'] = [85,'max-width:1440px']` **一字不动**）；Kevin「约 1500 像素」**按描述性近似**处置 ⇒ **零几何改动**。若日后要真 `1500px` ⇒ **另立单**（须同步 `STRUCT_PROV`，溯源硬门）。 |
| **`Q8` ❗ 指针（v1.24 · 2026-10-19）** | **已被 §25 `T121` 取代** | 容器最大宽 **`1440px ⇒ 1536px`**（Kevin 2026-10-19 口径「容器最大宽 **1536px**」；**「1500 不是标准宽度」已当面说明** ⇒ `1500` 退出候选）。上行 `Q8`「已裁 = 不动 · 保持 `1440px` · 若日后要真 `1500px` 须另立单」**字面逐字保留、不作现行口径**；现行落法 = `tokens.js` 的 `shell-max-w` 值 + `STRUCT_PROV['shell-max-w']` 两档指针 + `theme-tokens.css` 生成物 **三件同步**（见 §25.5）。 |
| **`Q9`** | **已裁 = 候选 (a) 的变体（显式「保持现状权重」）** | **数字字号保持既有 Tailwind `text-2xl`（24px）不变**（**不缩小现有视觉权重**）—— 候选 (a) 默认的「用既有 `--sf-st-price-num-size`(21px)」**已被本裁定否决**（理由入册为教训 `N48`）；**`$` 与单位（若有）字号 = 数字的 `0.75em`（≈18px**，命中参考图「`¥` 高 ≈ 数字高 75–80%」）；**数字 `font-weight ≥ 700`**（`font-bold`）；**零新增常量 / 零新 token / 零新 `--sf-l-*`**（`0.75em` 是**相对比例**、非新常量；`18px` 的等价既有 Tailwind 档 = `text-lg` ⇒ 二者取等价形即可，收口判据 = §22.9 `AC-2` 的比值区间 `[0.70,0.85]`）。 |

**★ 夜档另议边界（v1.20 就地注 · **写死边界** · 与上表同批）**

**Kevin 2026-10-17 追加口径（逐字）**：「**日档配色可严格参照 goofish，夜档另议，本项目需要夜档。**」⇒ 两条边界：

- **(A) 日档 = 严格照 goofish** —— 即 §22.2 的 `T109` / `T110` 逐字落（页底 `#F5F7F9` / 大容器 `#FFFFFF` / 卡片底纯白 / 价格深墨）。
- **(B) 夜档不作设计定案** —— 采「**最小改动 + 保可读**」；**除下列三处实际变化外，夜档观感保持现状**：

| # | 夜档实际变化（**仅此三处**） | 改前 ⇒ 改后 |
|---|---|---|
| ① | **卡片底色** | 奶黄 `bg-yellow-50`（`#FEFCE8`）⇒ **纯白** `bg-white`（`#FFFFFF`）（= `Q5` 裁定的直接后果） |
| ② | **新增 `--sf-surface-bg` 的夜档值 `#101114`** | 原**无此 token**（`.sf-route-container` 夜档此前吃 `--sf-page-bg` = `#0B0C0E`）⇒ 新值 **`#101114`（★ 暂定值 · 随「夜档另议」另立单复核）** |
| ③ | **价格色** | Tailwind 黄 `text-yellow-600`（`#D08700`）⇒ **深墨 `#030402`** —— 落法 = **卡内子树局部重绑** `--sf-price-cur-fg` / `--sf-price-num-fg` / `--sf-price-unit-fg` 为**日档值** `#030402` / `#030402` / `#3A3A2A`（**理由**：卡片恒为**浅色白卡、不随主题变** ⇒ 夜档 token 值 `#FDE815` 在白卡上 **1.255:1 不可读**；见教训 `N49` 与 §22.9 `AC-9`） |

**★ 「夜档整卡配色（**是否深色卡 / 价格是否亮黄**）本轮未定，**另立单**」** —— **逐字入册**：本轮**不作设计定案**；`T109` 的夜档分层取值（`#101114` vs 既有 `#141619` / `#111317`）与「卡片在夜档是否为深色卡」**一并挂到该另立单**。**本注不批准任何超出上表三处的夜档改动**（多改即判负）。**Kevin 口径「本项目需要夜档」= 夜档必须存在且可用（不得以「砍夜档 / 只在日档收口」代替）**，**而非**「夜档已定案」。

### 22.12 未核实 / 登记（**诚实清单 · 禁填 0/空**）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | **门套** | **`NOT_RUN`（本单为规范单）** | 本册未跑 `build` / `test:unit`；改前基线 **54 files / 520 tests** 由 Zang 于 2026-10-17 08:00 采集（`ops/ui-card-ref-20261017/readings/baseline.log`）。**实现方必须自跑并落读数** |
| 2 | 改动后的渲染读数（AC-1 / AC-2 / AC-3） | **`NOT_MEASURED`（尚无实现）** | 本单零代码 ⇒ 无改后读数；**禁填 0/空** |
| 3 | 真机（`env(safe-area-inset-bottom)` / 手机档观感） | **`NOT_MEASURED`** | 承 §19.12 / §21.12 同项 |
| 4 | 参考图橙红的**精确取样值** | **`NOT_MEASURED`** | 本单仅有视觉读数 `≈ #FF4D2E`（**未用 PIL 复核**）；因 `Q2` 已裁「颜色用本站 token」⇒ **不影响口径**，仅登记 |
| 5 | 「24人想要 / 卖家行 / 一周内发布」类元素的**数据承载** | **沿用既有结论 · 本单未重新现取** | 依据 = §19.4（`GET /api/prize/:bID` 无 owner/seller / 无 media_urls / 无品牌成色）+ §22.3；**本单未对 `/api/prize/all` 逐字段现取** |
| 6 | `reward-card-view` 钩子的**断言锚** | **全仓现取 = 无** | `grep -rn 'reward-card-view' frontend/src/test` = **0 命中** ⇒ 该钩子**当前无测试锚**；本册仍冻结它（契约面），**实现方不得因「无锚」而删/改名** |
| **6-勘误（v1.23 · 2026-10-17）** | **`reward-card-view` 钩子的设计面状态 = 已下线**（原第 6 项「本册仍冻结它（契约面）· 实现方不得因『无锚』而删/改名」**作废**） | **`RETIRED`（钩子随胶囊下线 · 现行口径 = §22.2 `T112` 勘误段）** | 原第 6 项字面**逐字保留、不作口径**。**现行要求**：首页卡片 `[data-sf-m="reward-card-view"]` **计数必须 = 0**（原「不得因无锚而删/改名」⇒ 改为「**实现方必须不渲染该钩子**」）；**测试面维持 0 命中**（本单现取 `grep -rn 'reward-card-view' frontend/src/test` = **0**，与原读数一致 ⇒ 零改锚）。**仍成立且不受影响的部分** = 第 19 项（回落态 `reward-card-claim` 的 `<span>` 键盘可达性缺口）—— 该路径本单**逐字未变**，缺口仍在、挂账不动（`docs/OPEN-ITEMS.md` `F32`） |
| 7 | `theme-tokens.css` 的**生成器可用性** | **已现取存在、本单未运行** | `backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`（文件在）；该 CSS 头注自称「生成物，勿手改」⇒ 实现方**优先重生成**，不可用则手改 + 给「逐键一致」读数（`A5`） |
| 8 | `reward.variant` 在**真实数据**里是否恒缺 | **未核实** | 现取只有默认分支（`'primary'`）的证据；若数据实际给 `variant='success'` 一类，`Q5` 的落点会随之改变 |
| 9 | 卡片 hover 阴影的**实际渲染值** | **`NOT_MEASURED`** | 「卡片外围略加阴影」的几何量（blur / spread / 颜色）未取 |
| 10 | `/hk` `/vn` 两语档的跳转前缀实测 | **`NOT_MEASURED`（尚无实现）** | 契约由 `utils.js:115-125` + `fix-nav-langshell.test.jsx:80-82` 冻结（`/en/item/5` 等），本单未跑真点击 |
| 11 | **「夜档整卡配色」（是否深色卡 / 价格是否亮黄）** | **`UNRESOLVED` · 挂账（另立单）** | Kevin 2026-10-17「夜档另议，本项目需要夜档」⇒ 本轮**不作设计定案**；**逐字口径见 §22.11 的「夜档另议边界」块**（三处实际变化表）；**本册不预判落法**（既不预设深色卡、也不预设亮黄价格） |
| 12 | **`--sf-surface-bg` 夜档 `#101114` = 暂定值** | **`TENTATIVE`（已裁保留 · 待复核）** | `Q7` 裁定 (a)：**保留**该值 + PROV 仍 `style-preview.html:1073`；**同时标为「暂定」** ⇒ 随第 11 项**另立单复核**（与夜档页底 `#0B0C0E` 仅差 `ΔRGB(5,5,6)`，分层可辨性**未定案**） |
| 13 | **`AC-9` 两条对照读数的**取数性质**** | **值对已精确给定 · 页内渲染实测 `NOT_MEASURED`** | 对比度按**已声明值**精确算得：改前 `#D08700` on `#FEFCE8` = **2.841:1**、改后 `#030402` on `#FFFFFF` = **20.546:1**、反事实 `#FDE815` on `#FFFFFF` = **1.255:1**；**Tailwind 色的 sRGB 由 Chrome 引擎 canvas 回读取真**（`oklch(68.1% .162 75.834)` ⇒ `rgb(208,135,0)`；`oklch(98.7% .026 102.212)` ⇒ `rgb(254,252,232)`；`oklch(97.3% .071 103.193)` ⇒ `rgb(254,249,194)`；`oklch(85.2% .199 91.936)` ⇒ `rgb(253,199,0)`；Chrome/145）⇒ **色值不是估读**；但**页内真渲染取色未做**（本单为规范单、无改后产物）⇒ 由 Kong 在实现后以真页 `getComputedStyle` 复取（承 `N42`：读数须落盘） |
| **13-勘误（v1.20d）** | **值勘误（非口径变更）：上行所指 `text-yellow-600` 的 sRGB 值 `#D08700`（`rgb(208,135,0)`）= 作废** —— 该值取自 **Node / oklch 转换路径自算**（`ops/ui-card-ref-20261017/readings/kong-night-contrast.json` 的 `nodeReadback.--color-yellow-600 = [208,135,0]`）；**两条独立的浏览器 `getComputedStyle` 回读均为 `rgb(202, 138, 4)` = `#CA8A04`**（Kong 同件的 `browserReadback.light.probe.y600` 与 `browserReadback.dark.probe.y600` **均为 `\"rgb(202, 138, 4)\"`**；Neng `ops/ui-card-ref-20261017/qa/neng-readings-ac9.json` 的 `arms.*.parent.num.color` 亦为 `rgb(202, 138, 4)`）⇒ **册面现行值 = `#CA8A04`**（本册凡出现 `#D08700` / `rgb(208,135,0)` 处 —— §22.9 `AC-9` 基行 · §22.11 夜档另议表行 ③ · 本表上行 —— **均为已作废的自算值**，读表以本行为准）。**★ 结论不变 ⇒ 属值勘误、非口径变更**：`#CA8A04` on 奶黄卡 `#FEFCE8` = **2.84:1**（≤ 改后 `#030402` on `#FFFFFF` = **20.55:1**）⇒ `AC-9` 的判负结论 / 改前-改后臂方向 / 反事实臂（`1.255:1`）**逐条不变**，（Kong 交叉核对：同色两路取值 **最大通道差 `6/255`** —— `yellow-600` 浏览器 `202,138,4` vs Node `208,135,0`；`gray-800` `31,41,55` vs `30,41,57` ⇒ 差 `2`；`yellow-50` 两路相同） | **`CONFIRMED`（两路独立浏览器回读一致）** | 定式入册为 **`N51`**（§22.10）：**同一色的册面 sRGB 值一律以「真实元素浏览器 `getComputedStyle` 回读」为准；canvas / Node 自算（oklch 转换路径）只作旁证、不得直接当册里的值**（承 `N46`「回读才是证据」同族） |
| 14 | **`dark:text-yellow-400` 在「OS 深色 × 站点日档」组合下会命中，并把价格对比度**压低**** | **`NOT_MEASURED`（结构推断 · 待 CDP 复取）** | 事实链（三条现取）：① 仓内**无** `@custom-variant dark`（`grep -rn 'custom-variant' frontend/src frontend/index.html` = **0 命中**）；② 站点主题走 `html[data-theme="dark"]`（`main.jsx:15-16`，**全仓不产生 `dark` 类**）；③ `frontend/src/**/*.css` 的 `prefers-color-scheme` 声明 = **0 命中** ⇒ Tailwind v4 默认把 `dark:` 编成 `@media (prefers-color-scheme: dark)`（构建产物 `frontend/dist/assets/index-B0eM_JXL.css` 现取 = **恰 1 处**）。⇒ **① 站点切夜档不触发任何 `dark:` 工具类** ⇒ **`dark:text-yellow-400` 对「本站夜档」无效**（夜档仍吃 `text-yellow-600`，即 `AC-9` 改前臂的 2.841:1）；**② 反向风险（结构后果 · 本单未实测）**：当**操作系统**偏好深色而站点处于**日档**时该媒体查询会命中 ⇒ 价格 `yellow-600 ⇒ yellow-400`，对比度 **2.841 ⇒ 1.521:1**（`#FDC700` on `#FEFCE8`）= **更差** ⇒ **该 `dark:` 类在任何主题组合下都不是可读性保障**（两条结论均登记，复取法 = CDP `Emulation.setEmulatedMedia` 强设 `prefers-color-scheme: dark`，承 `T93` 的干净 origin 技巧） |
| **14-勘误（v1.20c）** | **★ 第 14 项旧行结论「站点切夜档不触发任何 `dark:` 工具类」= 已被实测推翻 · 见本注**（本表后「★ v1.20c 就地注（勘误 · 第 14 项 + 第 16 项收口）」块） | **`MEASURED`（原 `NOT_MEASURED`）** | 三臂实测已就绪（Kong 2026-10-17 读数 = `ops/ui-card-ref-20261017/readings/kong-night-contrast.json` / `.log`）⇒ **本项读表口径以本行为准**；第 14 项旧行的「结构推断 · 待 CDP 复取」不再成立 |
| 15 | **实现面（`frontend/**`）当前状态** | **本单只读现取一次 · 非本单写面 · 非终值** | 现取（2026-10-17 · 工作区未提交）：`RewardCard.jsx` 已见 `variant={reward.variant \|\| 'default'}`（`:67`）· `hover="none"`（`:70`）· 稀有度渐变底已去（`:75-76` 仅余 `border-*`）；**新增未跟踪件** `components/reward/reward-card.css` 内含 `.sf-reward-card` 上的 `--sf-price-*` 重绑 + `.sf-reward-price{font-size:1.5rem}` + `.sf-reward-price-cur{font-size:0.75em}` + `.sf-reward-price-num{font-weight:700}`。**与 `Q5` / `Q6` / `Q9` 裁定一致**；但**该面归 Kong 实现单、会继续变动** ⇒ **本册不据此背书**（终值以 Kong 读数 + Neng 质检为准） |
| 16 | **第 6 项「`reward-card-view` 测试锚 = 全仓 0」的现取复核** | **结论未变（已入库测试面）· 但多出一枚**在飞**锚** | 现取 `grep -rn 'reward-card-view' frontend/src/test` = **1 命中**，落在**未跟踪临时件** `frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx:54`（**Kong 本单自建 · 文件名自标 `tmp`**）⇒ 第 6 项对**已入库测试面**仍成立（**入库面 0 命中**）；★ **该临时件不应随单入库**（登记为**待清理项**，归属 Kong / 收口方） |
| 17 | **质检方 harness 自修项（非产品缺陷）· 反事实臂须「日 + 夜两档同口径回退」** | **`HARNESS_FIXED_BY_QA`（尺子问题 · 非产品缺陷 · 已自修并复跑：`8/8` 档 `cf = 0` · `nonHomeRoutes.ok = true`）** | Neng 的 `AC-5` **夜档臂**（`item1440_night` · `/item/1 @1440 dark`）首轮得 **`cf = 2`**（残项 = `DIV#sf-shell` ＋ `DIV#sf-item-actionbar` 的 `style.backgroundColor`）⇒ **其自曝根因（`qa/neng-probe-ac5.mjs` 的 v2 注释）= 首版 CF CSS 的 `:root,[data-theme=\"light\"]{--sf-page-bg:#FDE815 !important}` 中 `:root` 在**夜档**下同样命中 `html` ⇒ 夜档被强灌**日档旧值** `#FDE815`**（夜档改前真值 = `#0B0C0E`）⇒ 回退的是**错的那一档的值** ⇒ 残差属**尺子错、不是产品缺陷**（**本册不据此判负**）。**v2 自修口径（= 本册写死要求）** = **反事实臂按主题分别回退**（日 → `--sf-page-bg:#FDE815` / `--sf-surface-bg:#FFFFFF`；夜 → `--sf-page-bg:#0B0C0E` / `--sf-surface-bg:#101114`）＋ `.sf-route-container{background:transparent}` ＋ `.sf-item-actionbar{background:var(--sf-page-bg)}`（两处新增落点还原改前形态）；**复跑读数**（`neng-readings-ac5.json` · `startedAt 2026-10-17T00:37:42Z`）= **`8/8` 非首页档 `cf = 0`** · `counterfactualEmptyAllCases = true` · `nonHomeRoutes.ok = true`（`/messages` 档 `cf = 66` 属预期 —— `T109`-only 臂不覆盖卡面，见 §22.9 `AC-5 · v1.20d 范围补注` ③）。⇒ **写死**：**反事实臂必须「日 + 夜」两档同口径回退、且回退后差异集为空**；**只回退一档 / 用 `:root` 跨档灌单档值的臂不得报判负**（承 §21.8「无效尺子」+ `N40` 族） |
| 18 | **稀有度装饰光斑（`.top-0.right-0.w-20.h-20…opacity-20.blur-xl`）与价格块同位重叠** | **`NOT_MEASURED` · 待测 / 挂账（另立单）** | 现取 `frontend/src/components/reward/RewardCard.jsx:80-87`（`absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 blur-xl` · 80×80 圆 · **`Q5` 已裁「保留」**）＋ 价格块 `:119-122`（`div.ml-4.sf-reward-price`，位于 `CardHeader` 内 `flex items-start justify-between` 的**右列**）⇒ **两者同在卡片右上角**；**价格块变宽后（`$` + 大号数字同行）重叠观感更明显**。**本册不自选方案**（候选：光斑改位 / 降 `opacity` / 移出价格区 / 保留现状）⇒ **待测 · 另立单**；**未做任何像素级重叠读数**（`NOT_MEASURED`） |
| 19 | **非链接回落态下 CTA 由 `<button>` 退化为只挂 `onClick` 的 `<span>` ⇒ 丢失键盘可达性与 button 语义** | **`NOT_MEASURED` · 待测 / 挂账（另立单）** | 现取 `frontend/src/components/reward/RewardCard.jsx:183-191`：CTA = `<span className=\"inline-flex …\" data-sf-m={…} onClick={clickable ? undefined : () => onClaim?.(reward)}>` ⇒ **回落态（无 `to` 且无 Router）语义等效 `button`，但无 `role` · 无 `tabIndex` · 无 Enter/Space 键处理**（`T112` 只写「卡内 `a|button|input|select|textarea` 计数 = 0」，**未覆盖键盘可达性**）。**实际影响面（本单未实测）**：生产消费点**仅首页**（`HomePage.jsx:318-320` 恒传 `to={rewardPath(reward)}` ⇒ **恒为链接态**；其余消费点仅两条测试件 `i18n-batch-b2.test.jsx:154/158/170` 与 `r9-93-points-symbol.test.jsx:157`）⇒ 回落态仅存在于**裸渲染用例 / 未来复用**面（**实际影响面以质检方补完单为准**）。**候选（不得自选）**：回落态保留 `<button>` / 补齐 `role` + `tabIndex` + 键处理 / 明确降级为非交互视觉元素 —— **另立单**；**本册未做键盘走查**（`NOT_MEASURED`） |

**★ v1.20 就地注（`Q5`–`Q9` 定案后的断言面重取 · 上表各项字面未改）**：全仓测试**无**一条冻结 `RewardCard` 的 `variant` / `hover` / 稀有度渐变底 ⇒ **`Q5` / `Q6` / `Q9` 定案零断言改锚**；**被保护的口径反而在 `Card.test.jsx`**（`:17-19` 冻结 `primary` 的 `bg-yellow-50 border-yellow-200`、`:62` 冻结 `hover` 枚举）⇒ 这正是「**不得改 `ui/Card.jsx` 两张变体表**」的机器可验理由。**另**：`r9-93-points-symbol.test.jsx:36`（`USAGE_FILES['components/reward/RewardCard.jsx'] = 1`）与 `:105-111`（`>$</span>` 恰 1）在 `Q9` 下**仍成立**（`$` 仍在 `<span>` 内），**零改锚**。**唯一「新增」= §22.9 的 `AC-9`（新增判据，非改锚）**。

**★ v1.20c 就地注（勘误 · 第 14 项 ＋ 第 16 项收口 · **上表各字面一字未改** · 依据 = Kong 实测反证 `ops/ui-card-ref-20261017/readings/kong-night-contrast.json` / `.log`）**

- **勘误对象 = 第 14 项**（**旧行逐字保留** —— 受「`git diff --numstat` 删除列 = 0」硬口径约束 ⇒ 旧行改不了，故以**紧随其后的 `14-勘误（v1.20c）` 行**承接「已被实测推翻 · 见本注」标记；**本项状态由 `NOT_MEASURED` ⇒ `MEASURED`**）。**被推翻的只有推论①**（「站点切夜档不触发任何 `dark:` 工具类」）；第 14 项列的**两条事实链仍成立**：① 仓内**无** `@custom-variant dark`（`grep -rn 'custom-variant' frontend/src frontend/index.html` = **0 命中**）；② 产物 CSS 里 `@media (prefers-color-scheme: dark)` **恰 1 处**（上单已现取）—— **错的是由这两条推出的结论**。
- **三臂实测读数（同一 dist · 同一 headless Chrome · Kong 2026-10-17）**：
  - **臂 A**：站点夜档（`html[data-theme]=dark`）＋ **设备偏好 light**（`matchMedia('(prefers-color-scheme: dark)').matches = false`，而 `html` 计算值 `color-scheme = dark`）⇒ `dark:text-yellow-400` 回读 **`rgb(250,204,21)`**、`dark:bg-gray-800` 回读 **`rgb(31,41,55)`** ⇒ **`dark:` 工具类生效**。
  - **臂 B**：站点夜档 ＋ 设备偏好 dark（`mqDark = true`）⇒ **同上两值**（`rgb(250,204,21)` / `rgb(31,41,55)`）⇒ **同样生效**（⇒ 生效与否**不由设备偏好决定**）。
  - **臂 C（控制臂）**：**同一设备偏好（light）下只把 `data-theme` 翻回 `light`** ⇒ `dark:text-yellow-400` 回读 **`rgb(0,0,0)`**、`dark:bg-gray-800` 回读 **`rgba(0,0,0,0)`**（回落到无 `dark:` 的外观）⇒ **失效**；**臂 C 相对臂 A/B 两键取值皆变** ⇒ **尺子灵敏度已自证**（不是「恒绿」）。
  - **机制（写死）**：浏览器按**根元素 used `color-scheme`** 解析 `prefers-color-scheme` —— 本仓已声明 `html{color-scheme:light}` / `html[data-theme="dark"]{color-scheme:dark}`（落 `frontend/src/styles.css` 顶层 ＋ `frontend/index.html` meta）⇒ **站点切夜档即令该媒体查询命中** ⇒ **全站 Tailwind `dark:` 工具类在站点夜档下真的生效**（**不是死码**）。⇒ **定式入册为 `N50`（§22.10）**；`dark:` 死活的判定**一律不得**只凭「无 `custom-variant dark`」推断。
- **★ 数值更正（改前夜档价格块）**：数字 `text-yellow-600` = **`#CA8A04`** on 奶黄卡 `bg-yellow-50` = `#FEFCE8` ⇒ **2.84:1**；符号另带 `dark:text-yellow-400` = **`#FACC15`** on **同一底色** ⇒ **1.48:1** ⇒ **同一个价格块两色不一致，且符号更差**。⇒ 第 14 项旧行内「夜档仍吃 `text-yellow-600`，即 `AC-9` 改前臂的 2.841:1」**不完整**（漏了符号臂）—— **改前臂的最差值 = 1.48:1**；**同理第 13 项所给 `2.841:1` 只覆盖数字臂**（同一件事实 · **本注补全、不改第 13 项字面**）。**改后臂** = `#030402` on `#FFFFFF` = **20.55:1**（AA 达标 · 常规/大文本均 ✓）。
- **产品后果（写死）**：① 站点夜档下 `dark:` 类**会**参与渲染 ⇒ **任何「主题无关的浅色卡 / 区块」只要带 `dark:` 变体，夜档必被改色**（本单实例 = 价格符号被改成 `#FACC15`，对比度由 2.84:1 ⇒ **1.48:1**，比数字臂**更差**）；② 「加了 `color-scheme` 声明」这一步的**副作用**就是让全站 `dark:` 从死变活 —— 属「**修一个 bug 开出另一个变量**」实例，定式见 `N50`；③ 凡「某个 `dark:` 类是死码 / 不生效」的判断**必须三臂实测**（`AC-9` 勘误注 ④ 已写死为判据：质检方**不得只读实现方读数**）。
- **色值证据链（本注引用的数不是估读）**：`#CA8A04` / `#FACC15` / `#FEFCE8` / `#FFFFFF` / `#030402` 均经**浏览器 canvas 回读**（`fillRect` + `getImageData`）与 **Node oklch 解析双路**取得，**最大通道差 ≤ 6/255**（`yellow-600` = 6 · `gray-800` = 2 · `yellow-50` = 0）且与 Chrome 自身 `rgb()` 序列化**逐字节一致**（见 `kong-night-contrast.json` 的 `crossCheck` / `crossCheckMaxDiff`）。
- **★ 第 16 项挂账收口**：`frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx`（Kong 本单自建临时件 · 文件名自标 `tmp` · 上单登记为「**不应随单入库**」的待清理项）⇒ **已清理 · 现取不存在**（2026-10-17 现取：`ls` = `No such file or directory`；`grep -rn 'zz-kong-ac4-tmp' frontend/src/test` = **0 命中**）⇒ **第 16 项的待清理挂账已闭环**；`reward-card-view` 的**入库测试面仍 0 命中**（第 6 项结论不变）。

### 22.13 快照 + 自证 + git 面（本节）

- **改前（现盘 live · 本单开工现取）**：`docs/design/design-system.spec.md` = **2355 行 / 517,050 B / md5 `1ac3dc50c40cb15d409d008090d02e47`**；`docs/design/style-preview.html` = **1042 行 / 86,638 B / md5 `13a845dacb6865ea3fa738663a63159c`**。
- **真源追加自证（本单实测）**：`style-preview.html` 改后 = **1103 行 / 93,949 B / md5 `7b8780af15802102f9ddf578510490a5`** ⇒ **+61 行 / +7,311 B**；`git diff --numstat docs/design/style-preview.html` = **`61 0`**（**删除列 = 0 ✓ 纯追加**）；`head -n 1042 改后 | cmp - 改前` = **0**（前 1042 行逐字节未动）。
- **新真源块行号锚（本单冻结 · PROV 用）**：追加块 = `style-preview.html` **1044–1103** 行（注释 1044–1061 · `<section id="card-ui-ref-v120">` 1062–1103）；**PROV 指针三处** = `page-bg.d` ⇒ **1069**（`.vstage-a .page{background:#F5F7F9;color:#0A0A0A}`）· `surface-bg.d` ⇒ **1071**（`.vstage-a .surface{background:#FFFFFF}`）· `surface-bg.n` ⇒ **1073**（`.vstage-b .surface{background:#101114}`）。
- **本册改后读数与 `git diff --numstat`** 见 delta 件 **`docs/audit/design-system-v1.20-delta.md`**（**删除列 = 0** 自证 + 快照 `cmp=0` + 「未动 `frontend/**`」`grep` 自证）。
- **快照面**：**改前快照 = `docs/versions/design-system.spec.v1.19.md`**（本单开工复核 **`cmp` = 0**；2355 行 / 517,050 B / md5 `1ac3dc50c40cb15d409d008090d02e47` —— 与现盘 live 逐字节相同）；**本版镜像 = `docs/versions/design-system.spec.v1.20.md`**（落笔后建，`cmp=0`）。**两件均不改旧内容**。
- **两处版本记录同步（写死 · 计数锚点）**：① 头部 = `grep -n '^> \*\*★ 现行版 = v1.20' docs/design/design-system.spec.md` **恰 1 命中**；② 正文 = `grep -n '^## §22 ' docs/design/design-system.spec.md` **恰 1 命中**；另 ③ §12 表 = `grep -n '^| \*\*v1.20\*\* |' docs/design/design-system.spec.md` **恰 1 命中**。**三处同批入库，漏一处 = 不完整**。
- **证据落点（本单）**：`ops/ui-card-ref-20261017/readings/jing-*.{txt,log}`（现取读数 / md5 / 行数字节 / `git diff --numstat` / `cmp` 结果）；参考图 `ops/ui-card-ref-20261017/shots/**` **未触碰**。
- **git 面**：**未 `git add -A` · 未 commit · 未 push**（收口由 Zang 统一处理）；本单只写 `docs/design/design-system.spec.md` · `docs/design/style-preview.html` · `docs/versions/design-system.spec.v1.19.md`（只读校验、未写）· `docs/versions/design-system.spec.v1.20.md`（新建）· `docs/audit/design-system-v1.20-delta.md`（新建）· `ops/ui-card-ref-20261017/readings/jing-*`（新建）；**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `ops/ui-card-ref-20261017/shots/**`；未启停任何服务**。

### 22.14 v1.20 就地注 · Zang 终审（`Q5`–`Q9` 全部已裁 + 夜档另议边界 + 新增 `AC-9` + 教训 `N48`/`N49`）（**本节只追加 · §22.0–§22.13 一字未动** · 依据 = **Zang 终审 2026-10-17**〔回答两条连带裁定〕+ **Kevin 2026-10-17 追加口径**「**日档配色可严格参照 goofish，夜档另议，本项目需要夜档**」；**本单 = 微回写单 · 只写 `docs/**` + 本单读数**）

- **本单性质 = v1.20 的**就地注**（不新开版本、不新开节）** —— 三处版本记录（头部 `^> **★ 现行版 = v1.20` · 正文 `^## §22 ` · §12 表 `^| **v1.20** |`）**各仍恰 1 命中且一字未动**（受「删除列 = 0」硬口径约束 ⇒ **无行被改写**）。
- **落点清单（逐处 · 全部为**插入**，无一行改写）**：① §22.7 断言影响小结后就地注一条（`Q5`/`Q6`/`Q9` 零改锚 + `Card.test.jsx` 才是保护面）；② §22.9 表末插 **`AC-9`** 行；③ §22.10 末插 **`N48` / `N49`** 两条；④ §22.11 表后就地注 **「`Q5`–`Q9` 已裁登记表」+「夜档另议边界」块**（**上表五行旧字面逐字保留**）；⑤ §22.12 表末插第 **11–16** 项 + 一条断言面重取注；⑥ 本 §22.14。
- **真源面 = `docs/design/style-preview.html` **本单零改动****（**预期即零**）：五条裁定**均不产生新真源值** —— `Q5`/`Q6`/`Q9` 是「既有 Tailwind 档 + 既有 token 的**落点 / 相对比例**」，`Q7` **保留**既有值（PROV 仍 `:1073`）、`Q8` 不动几何 ⇒ **现取复核 md5 = `7b8780af15802102f9ddf578510490a5`（1103 行 / 93,949 B，与上单终值逐字相同）**。**若日后必须新增真源值（例如 `Q7` 复核改值 / 夜档另立单定案）⇒ 另立单 + 必走 `N46` 的「加真源行 + 改 PROV 指针」双件**。
- **快照 + 自证（本单终值）**：**改前 live**（本单开工现取）= **2569 行 / 564,194 B / md5 `16f124fc6533770c912e79d6487ebac0`**（= 上单 v1.20 终值）；**改后 live** 的行数 / 字节 / md5 / sha256 见 **`docs/audit/design-system-v1.20-delta2.md` §B**（本单终值）；`git diff --numstat docs/design/design-system.spec.md` **删除列 = 0**；**本版镜像** = `docs/versions/design-system.spec.v1.20.md` **按本单终值重制**（改前该镜像 = `16f124fc6533770c912e79d6487ebac0` 且与改前 live `cmp=0`；重制后对新 live **`cmp=0`**）。
- **证据落点（本单）** = `ops/ui-card-ref-20261017/readings/jing-v120b-readings.txt`（现取读数：`Q9` 改前绝对值 / `dark:` 三条 grep 计数 / `AC-9` 三臂 WCAG 比值 / canvas 回读 sRGB / md5 行数字节 / `cmp` / 三处锚点命中数 / 未动面）＋ `ops/ui-card-ref-20261017/readings/jing-v120b-selfproof.log`（可复跑命令与输出）。**★ 凡 `.log` 后缀会被仓根 `.gitignore` 命中 ⇒ 入库须 `git add -f`**（承 `N42`）。
- **git 面**：**未 `git add -A` · 未 commit · 未 push**（收口由 Zang 统一处理）；本单只写 `docs/design/design-system.spec.md`（**就地注 · 删除列 = 0**）· `docs/versions/design-system.spec.v1.20.md`（**重制**）· `docs/audit/design-system-v1.20-delta.md`（**纯追加一条指向注**）· `docs/audit/design-system-v1.20-delta2.md`（新建）· `ops/ui-card-ref-20261017/readings/jing-v120b-*`（新建）；**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `ops/ui-card-ref-20261017/shots/**`；未启停任何服务**。
- **挂账（另立单 · 逐字）**：**「夜档整卡配色（是否深色卡 / 价格是否亮黄）本轮未定，另立单」** ＋ `--sf-surface-bg` 夜档 `#101114` **暂定值**复核（同单）；两条均在 §22.11 夜档另议块 + §22.12 第 11/12 项。
- **★ v1.20c 勘误单（本单 · 承上 · 「就地注」形态）** —— **依据 = Kong 三臂实测反证**（证据件 `ops/ui-card-ref-20261017/readings/kong-night-contrast.json` / `.log`，本单**先读它再落笔**）：**① §22.12 第 14 项就地更正**（旧行**逐字保留** ＋ 紧随其后的 `14-勘误（v1.20c）` 行标「**已被实测推翻 · 见本注**」；**状态 `NOT_MEASURED` ⇒ `MEASURED`**）＋ 表后新增「**★ v1.20c 就地注（勘误 · 第 14 项 ＋ 第 16 项收口）**」块（三臂读数 ／ 机制 ／ 数值更正 ／ 产品后果 ／ 色值证据链）。**② §22.9 `AC-9` 改前臂同步更正**（**新增 `AC-9 · v1.20c 勘误注` 行**：改前夜档 = **两色不一致 · 最差 `1.48:1`**；改后 = **`20.55:1`**；并**把「独立复现」写进判据** —— 质检方**不得只读实现方读数**，须自行三臂复现）。**③ 新增教训 `N50`**（§22.10 末插入；含「**修一个 bug 开出另一个变量**」定式）。**④ 收口上单挂账** = `frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx` **已清理 · 现取不存在**（§22.12 第 16 项）。**本单新增行 = 4 处插入（`AC-9` 勘误行 ＋ `N50` ＋ `14-勘误` 行 ＋ §22.12 勘误块）＋ 本行**，**`§22.0`–`§22.13` 原正文一行未改**；**真源 `docs/design/style-preview.html` 本单零改动**；**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `ops/ui-card-ref-20261017/shots/**`**；**未 `git add -A` · 未 commit · 未 push**。**改前 live** = `185f9da2ccab9d8779dfec339ee2c23d`（= v1.20b 终值）；**本版镜像** `docs/versions/design-system.spec.v1.20.md` **按本单终值重制**（对新 live **`cmp=0`**）；终值行数 / 字节 / md5 / sha256 / `numstat` **见 `docs/audit/design-system-v1.20-delta3.md` §B**；**证据落点** = `ops/ui-card-ref-20261017/readings/jing-v120c-readings.txt` ＋ `…-jing-v120c-selfproof.log`（**★ `.log` 被 `.gitignore:244 *.log` 命中 ⇒ 入库须 `git add -f`**，承 `N42`）。
- **★ v1.20d 二次勘误微回写单（本单 · 承 v1.20c · 仍为「就地注」形态 · 只写 `docs/**` + 本单读数）** —— **依据 = 两路独立浏览器回读 + 质检方读数**（`ops/ui-card-ref-20261017/readings/kong-night-contrast.json` · `…/qa/neng-readings-ac9.json` · `…/qa/neng-readings-ac5.json`；**本单先读它们再落笔**）：**① 值勘误** —— §22.12 表内**紧接第 13 项**插 **`13-勘误（v1.20d）`** 行：`text-yellow-600` 册面值 **`#D08700` ⇒ `#CA8A04`**（两路独立浏览器 `getComputedStyle` 回读一致），**属值勘误、非口径变更**（`2.84:1` 与 `AC-9` 判负 / 反事实臂方向逐条不变）＋ **新教训 `N51`**（§22.10：「同一色的册面 sRGB 值以**真实元素浏览器回读**为准；canvas / Node 自算（`oklch` 路径）只作旁证」，承 `N46`「回读才是证据」同族）；**② `AC-5` 范围措辞补齐** —— §22.9 AC-5 行后插 **`AC-5 · v1.20d 范围补注`** 行：承重面点名 ＋ **`/messages` 例外**（`pages/MessagesPage.jsx:15` = `const MessagesPage = () => <HomePage />` ⇒ 其渲染树 = **首页 + 面板** ⇒ 卡面差异**属允许变更集**；Neng 实测 `68 = 结构项 66（`66/66` 命中批准标记）+ 颜色项 2`，未批准 `0` · 几何 `0` · 结构 `0` · 文本 `0`）＋ **`T109`-only 反事实臂不覆盖卡面**（对含首页渲染树的路由不得据此臂要求差异集为空）；**③ 质检方 harness 自修项入册** —— §22.12 第 **17** 项：`AC-5` 夜档臂首得 `cf = 2` 的根因 = **首版 CF CSS 的 `:root` 在夜档下同样命中 `html`、把夜档强灌成日档旧值 `#FDE815`**（**尺子灌错档**）⇒ **非产品缺陷**；质检方已自修（**按主题分别回退** + 显式回退 `--sf-surface-bg`）并复跑 ⇒ **`8/8` 非首页档 `cf = 0` · `counterfactualEmptyAllCases = true` · `nonHomeRoutes.ok = true`**；**写死要求 = 反事实臂必须「日 + 夜」两档同口径回退、且回退后差异集为空**；**④ 两条未测观察挂账入册** —— §22.12 第 **18** 项（稀有度装饰光斑 `.top-0.right-0.w-20.h-20…opacity-20.blur-xl` ↔ 价格块 `:119-122` **同位重叠**）＋ 第 **19** 项（非链接回落态 CTA 由 `<button>` 退化为只挂 `onClick` 的 `<span>` ⇒ **丢失键盘可达性 / button 语义**：无 `role` · 无 `tabIndex` · 无 Enter·Space）—— **均标「待测 / 挂账 · 另立单」、不自选方案**。**本单新增行 = 5 处插入（§22.9 `AC-5 · v1.20d 范围补注` 行 ＋ §22.10 `N51` ＋ §22.12 `13-勘误（v1.20d）` 行 ＋ §22.12 第 17/18/19 项 ＋ 本行）**，**`§22.0`–`§22.13` 原正文一行未改**；**真源 `docs/design/style-preview.html` 本单零改动**（本单不产生新真源值）；**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `ops/ui-card-ref-20261017/shots/**`**；**未 `git add -A` · 未 commit · 未 push**。**改前 live** = `bc279e8a7632b87144603755d0106712`（= v1.20c 终值）；**本版镜像** `docs/versions/design-system.spec.v1.20.md` **按本单终值重制**（对新 live **`cmp=0`**）；终值行数 / 字节 / md5 / sha256 / `numstat` **见 `docs/audit/design-system-v1.20-delta4.md` §B**；**证据落点** = `ops/ui-card-ref-20261017/readings/jing-v120d-readings.txt` ＋ `…-jing-v120d-selfproof.log`（**★ `.log` 被 `.gitignore:244 *.log` 命中 ⇒ 入库须 `git add -f`**，承 `N42`）。

## §23 顶栏实黄（`T114`–`T119`）· 日档顶栏实黄且**不透明** · **夜档顶栏冻结 `#1F2937`** · 日档顶栏内前景 **≥4.5:1**（**本节只追加 · §1–§22 一字未动** · 依据 = **Kevin 2026-10-17 逐字三项**「B 顶栏实黄 / 移动档保持全白 / 先把顶栏定下来、改完再一并 push（含生产终验）」+ **Zang 冻结裁定 1–6** · 本单只写 `docs/**` + 本单读数）

### 23.0 裁定来源（Kevin 逐字三项 + Zang 冻结裁定 1–6）

**前序口径（Kevin 2026-10-17 逐字 · 已在 §22.11「夜档另议边界」块）**：「**日档配色可严格参照 goofish，夜档另议，本项目需要夜档。**」

**本轮三项各答（Zang 提问原文字面 ⇒ Kevin 答逐字）**：

| # | 问 | Kevin 答（逐字） | 本册落法 |
|---|---|---|---|
| 1 | 顶栏 | **「B 顶栏实黄」** | §23.2 `T114`–`T117`（日档实黄不透明 / 夜档冻结 / 下边框 token / 前景硬门） |
| 2 | 移动档 | **「保持全白」** | §23.2 `T119` + §23.7 `Q10`（读法解码 = **移动档页底/内容面保持全白**、承「≤767 不露灰页底」= 已知事实 ⇒ **本单零几何改动**；「移动档**顶栏**保持全白」为另一读法 ⇒ 待裁） |
| 3 | 上线时机 | **「先把顶栏定下来、改完再一并 push（含生产终验）」** | §23.8 —— **本单不 commit / 不 push**；push 与生产终验由 Zang 统一走（承「push = 上线」铁律 + §22 同批未 push 面） |

**Zang 冻结裁定（1–6 · 写死 · 不得自选 · 本册逐字转写）**：

1. **日档顶栏渲染色 = `#FDE815`**（= `--sf-topbar-bg` 日档值 · 设计真源原口径）且 **不透明**：`bg-opacity-95` / `backdrop-blur-sm` **必须移除或失效**；`sticky` 滚动时内容**不得穿透**。
2. **夜档顶栏 = 冻结现状 `rgb(31,41,55)`**（`#1F2937` = 现 `dark:bg-gray-800`）—— **本轮不动**；归「**夜档另议**」另立单（连同「夜档整卡配色」一笔挂账）⇒ **机制必须能在日/夜分别落值**。
3. **日档顶栏下边框 = `--sf-topbar-border`（`#030402`）**（设计真源 §A 口径）；**夜档下边框维持现状**。
4. **对比度硬门（日档）**：顶栏内**所有前景 ≥ 4.5:1**（≥18.66px 粗体的大字可 ≥3:1）；现取不达标的至少三处：**logo** ⇒ 改用 `--sf-brand-fg`；**`.nav-link` 的 hover / active**（`#d97706`）⇒ 换深色系；**注册 / 登录 hover**（`hover:text-yellow-600`）⇒ 换。**夜档对应前景维持现状**（已达标）。
5. **移动档（≤767）不露灰页底**（Kevin 已裁）⇒ 本单**不改任何几何**（不动 `max-width`、不动 `padding`）。
6. **零新主题 token**（三个槽位都已存在）；若实现方认为必须新增新值 ⇒ **必须走 `N46` 双件**（加真源行 + 改 PROV 指针）**并停下上报**。

**★ 本册只承载「token / 落点 / 机制 / 断言影响 / 归因式 AC」；不含 React 代码**（承 §0 阅读约定）。

### 23.1 现取基线（本单开工 · HEAD `4b388d0` · 2026-10-17 · 真浏览器 + `localhost:5787` 现取）

**取数法（可复核）**：`goto http://localhost:5787/`（vite dev · 现有实例）⇒ `localStorage.theme` 切档 ⇒ 重载 ⇒ `getComputedStyle` 回读 ⇒ CDP `Emulation.setDeviceMetricsOverride` 定档（390 / 1280 / 1440 / 1600）⇒ WCAG 2.x 复算。**读数落盘** = `ops/ui-card-ref-20261017/readings/jing-v121-readings.txt` / `…-readings.json` / `…-dark.json` / `…-mobile390.json` / `…-sticky.json` / `…-selfproof.log`。

| 项 | 现取读数 | 取法 |
|---|---|---|
| `#header` 根元素（`Header.jsx:166`） | `<header id="header" className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-md backdrop-blur-sm bg-opacity-95">` | `read_file` |
| **日档** `#header` | `backgroundColor = rgba(255,255,255,0.95)` · `backdropFilter = blur(4px)` · `border-bottom = 1px solid rgb(229,231,235)` · `rect = (0,0,W,65)`（W ∈ {390,1280,1440,1600}）| `getComputedStyle` 回读 |
| `.sf-region-top`（`AppShell.jsx:33` · 规则 `shell.css:20-24`） | `backgroundColor = rgb(253,232,21)` · `rect = (0,0,W,65)` = **`#header` rect 逐值相同** | 同上 |
| ⇒ **合成像素** | `0.95` 白 over 实黄 = **`rgb(255,254,243)` = `#FFFEF3`** ⇒ **设计真源里的黄顶栏被 95% 白底盖死** | alpha 合成复算 |
| **夜档** `#header` | `backgroundColor = rgb(31,41,55)`（`#1F2937`）· `border-bottom = 1px solid rgb(55,65,81)` ⇒ ★ `dark:` 工具类在**站点夜档**下生效的**第三次独立确认**（承 §22.12 `N50`）| `getComputedStyle` 回读 |
| 顶栏内**常显前景 7 处** | ① logo「Seafood 海鲜市场」= `rgb(202,138,4)` `20px/700`（`Header.jsx:171` · `text-xl font-bold text-yellow-600 dark:text-yellow-400`）②「社区任务」`nav-link` `rgb(75,85,99)` `14px/500` ③「市场」同上 ④「订单」`rgb(75,85,99)` ⑤「语言」同上 ⑥「注册」同上 ⑦「登录」同上 | 逐元素 `getComputedStyle().color` |
| **夜档**同 7 处 | 全部 `rgba(255,255,255,0.92)` —— 由 **`frontend/src/styles.css:146-147`** 的 `[data-theme="dark"] #header, [data-theme="dark"] #header * { color: rgba(255,255,255,0.92) !important }` 给到 | 同上 |
| `.nav-link` 定义 | base `color:#4b5563`（`HoverMenu.css:8`）· `:hover{color:#d97706}`（`:12`）· `.active{color:#d97706;background-color:#f3f4f6}`（`:16-17`）；**当前在场 `.active` 计数 = 0**（现取 `#header .nav-link.active` = 0）| `read_file` + dist grep + DOM 计数 |
| `.nav-link` 的 `.dark` 一族 | `HoverMenu.css:20-30`（`.dark .nav-link` …）在**本站是死规则**（仓内无 `.dark` 类；站点主题走 `[data-theme="dark"]`）⇒ **夜档实际由 `styles.css:146-147` 给值** | `grep -rn '\.dark' frontend/src` |
| 注册 / 登录 触发按钮 | **`<button>`（非 `<a>`）**；类 = `text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400`（`Header.jsx:324` / `:331`）；dist 逐字 `.hover\:text-yellow-600:hover{color:#ca8a04}` · `.dark\:hover\:text-yellow-400:hover{color:#facc15}` | `read_file` + dist grep |
| 汉堡 / 主题钮 | `text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100`（`Header.jsx:347` · `:373` 族）| `read_file` |
| ★ **两个已声明但全仓零消费者的 token** | `--sf-topbar-border`（日 `#030402` / 夜 `#FDE815`）· `--sf-brand-fg`（日 `#0A0A0A` / 夜 `#F5F6F7`）—— `grep -rn 'topbar-border\|brand-fg' frontend/src` **只命中值表**（`theme/tokens.js:35-36/153-154` + `theme/theme-tokens.css:54-55/168-169`），**无任何选择器消费** ⇒ 设计真源本就为黄顶栏预留 | `grep` |
| 移动面板（`Header.jsx:360-511`） | **在 `#header` 子树内**；面板自带底 `bg-white`（`:361`）实测 = `rgba(255,255,255,0.95)` ⇒ **继承了父级 `bg-opacity-95` 的 95% 语义**（CSS 自定义属性继承）| 真渲染回读 |
| 移动面板「注册 / 登录」胶囊 | 注册 = 白字 on `bg-blue-600`(α .95) ⇒ 底 `rgb(48,106,224)` = **4.94:1 ✓**；**登录 = 白字 on `bg-yellow-600`(α .95) ⇒ 底 `rgb(205,143,5)` = 2.80:1 ✗**（既有 · **与顶栏底色无关**）| 真渲染 + 复算 |
| ★ `#header` 的 `sticky` **声明不生效** | 含块 `.sf-region-top`（`position:relative`）高 = **65px = 顶栏高** ⇒ sticky 无可用粘贴空间 ⇒ **随页滚走**（实测 `scrollY=400` 时 `#header` `rect.y = −400`；390/1440/1600 三档一致）| 真渲染 |
| 门套改前基线（**承 §22.1 · 本册未重采**）| `Test Files 54 passed` / `Tests 520 passed`；产物名 `assets/index-C3dRJ_m4.js` + `assets/index-D4sieLPp.css`（2026-10-17 08:00 · Zang 采 · `readings/baseline.log`）；**现盘 `frontend/dist/assets/` 现取（08:43 后重建）= `index-Dh7Gdrie.js` + `index-B0eM_JXL.css`** | `readings/baseline.log` + `ls` |

### 23.2 规则条文（`T114`–`T119`）

| 规则 | 条文（写死） | 判负 |
|---|---|---|
| **`T114`** | **日档顶栏 = 实黄且不透明**：`#header` 在**日档**的 `backgroundColor` **必须解算为 `rgb(253,232,21)`（= `var(--sf-topbar-bg)`）且 alpha = 1**；`bg-opacity-95` 与 `backdrop-blur-sm` **必须移除或失效**（判据 = 回读 `backgroundColor` alpha = 1 **且** `backdropFilter = 'none'`）；`sticky` 语义下**滚动时内容不得穿透**。**落点 = `frontend/src/styles.css` 顶层**（承 `T95`/`color-scheme` 同族体例：不入 `@layer`、不入 `@media`；**`shell.css` 一字不动**、**`theme-tokens.css`（生成物）一字不动**）。**★ 规则必须限定在非夜档**（见 `T115`）。 | 日档回读 ≠ `rgb(253,232,21)` / alpha < 1 / `backdropFilter ≠ 'none'` / 落点越界（改了 `shell.css` 或 `theme-tokens.css`） |
| **`T115`** | **夜档顶栏冻结现状 `rgb(31,41,55)`（`#1F2937`）**：日档新规则**必须**写成 `:root:not([data-theme="dark"]) …` 形式（或以等价手段显式排除夜档）⇒ **夜档零命中**；夜档继续由既有 `dark:bg-gray-800` 承接（`N50` 机制：站点夜档 ⇒ 根元素 `color-scheme=dark` ⇒ 产物里的 `@media (prefers-color-scheme:dark)` 命中）。**严禁**用宽度断点 / `matchMedia` / `prefers-color-scheme` 直读来分档（承 `theme-shell-isomorphism` 硬断言）。**★ 机制坑（本单实测 · 见 §23.6 `N53`）**：**不加日档限定**的 `#header{background-color: var(--sf-topbar-bg)}` 会**压掉** `dark:bg-gray-800`（未分层 CSS 胜过分层 utilities）⇒ 夜档底变 `rgb(11,12,14)` ⇒ **破冻结**。 | 夜档回读 ≠ `rgb(31,41,55)` / 夜档 `border-bottom` 或 `rect` 发生变化 / 分档判据用了宽度或媒体查询 |
| **`T116`** | **日档顶栏下边框颜色 = `var(--sf-topbar-border)`（`#030402`）**；**夜档下边框维持现状**（`1px solid rgb(55,65,81)`）。**★ 宽度 = 保持现状 `1px`**（几何冻结）：设计真源白天口径为 `border-bottom:2px solid #030402`（`style-preview.html:201`）—— **改宽会把顶栏高 65 ⇒ 66px、全站下移 1px** ⇒ 属**几何变更**、**本单不批准**；如 Kevin/Zang 要求真源逐字（2px）⇒ **另裁**（一句话可改）。 | 日档边框色 ≠ `rgb(3,4,2)` / 夜档边框色变化 / `border-bottom-width` 由 1px 变 2px（越界几何改动） |
| **`T117`** | **日档顶栏内所有前景 ≥ 4.5:1**（≥18.66px 粗体的大字可 ≥ 3:1）。**逐处处置（写死，取值一律用既有 token，零新 token）**：① **logo**（`Header.jsx:171`）由 `text-yellow-600` ⇒ **`color: var(--sf-brand-fg)`（日档解算 `#0A0A0A`）**；② **`.nav-link:hover` 与 `.nav-link.active`**（`HoverMenu.css:12/:16` 的 `#d97706`）⇒ **日档覆盖为 `var(--sf-brand-fg)`**；③ **注册 / 登录 的 `hover:text-yellow-600`**（`Header.jsx:324/:331`）⇒ **日档覆盖为 `var(--sf-brand-fg)`**；④ `.nav-link` **base `#4b5563` 不改**（实黄底上 `6.02:1 ✓`）；⑤ 汉堡 / 主题钮（`text-gray-600` base `6.02:1 ✓`；`:hover` 自带 `hover:bg-gray-100` 底 `16.12:1 ✓`）**不改**。**夜档对应前景维持现状**（由 `styles.css:146-147` 的 `!important` 全局规则保证 —— 该两条**一字不得改**）。**★ 判据作用面界定（写死）**：硬门对象 = **由顶栏底色承载**（自身无底、透出顶栏底）的前景；**自带不透明底的控件**（如移动面板的注册 / 登录胶囊、选中语言态、汉堡 `hover:bg-gray-100` 态）**按其自身合成底评**（逐条见表 §23.3）。 | 表 §23.3 内任一"由顶栏底色承载"的前景 < 阈值 / 改了 `styles.css:146-147` 两条 / 引入新 token |
| **`T118`** | **零新主题 token / 零 `STRUCT` 增项 / 零几何改动**：`TOKEN_KEYS` 一字不动（三个槽位 `topbar-bg` / `topbar-border` / `brand-fg` 均已存在）；**不改任何 `--sf-st-*`、不动 `max-width`、不动 `padding`**（含 ≤767：**移动档不露灰页底**为已知事实，本单不改几何去制造灰底）；**零新 i18n 键**（本单不新增文案）。 | 新增 / 改名 token / `STRUCT` 变更 / 任何 `rect` 变化 / 新增文案键 |
| **`T119`** | **作用面 = 全站顶栏面（写死 · 归因式）**：`Header` 是**全站共享外壳件**（`AppShell.jsx:32-34` ⇒ `.sf-region-top` 内，**全站每一路由上方都在场**）⇒ 归因式不动面的**允许变更集必须扩为「全站顶栏面」**：① `#header` 底色 / 边框色；② 由顶栏底色承载的三处前景色及其 `:hover` / `.active` 态；**其余一律为零**。**移动档（≤767）**：顶栏同样落实黄（`Header` 无宽度分支、本单不新增断点）；**页面底 / 内容面保持全白**（`.sf-route-container` 在 ≤767 满宽 ⇒ 灰页底不可见 = 已知事实、本单不改）；**移动面板与顶栏子树的其它自带底色面**本单不动。 | 全站任一页出现**归不进上述两项**的差异 / 在 ≤767 引入宽度分支 / 为显示灰页底而改几何 |

**★ 条文间的依赖（写死）**：`T115` 的日档限定是 `T114` 的**组成部分**（不是可选优化）—— 少了它 `T114` 会连带破 `T115`（见 §23.6 `N53` 的实测机制坑）。

### 23.3 现取对比度表（**逐元素 · 真渲染回读 + WCAG 2.x 复算**）

**算式** = WCAG 2.x `(L₁+0.05)/(L₂+0.05)`（sRGB 线性化）；**前景 / 底一律取「与底**合成后**的像素」**（承 `N52`；本表**全部**走合成路径，与 Zang 报值并列处标「取数路径差」）。**阈值**：常规文本 **4.5:1**；**≥18.66px 粗体**的大字 **3:1**；非文本（边框一类）**3:1**。

| # | 元素（状态） | 现取前景 | 现取有效底 | 现状比值 | 阈值 | 判 | 改后前景 | 改后有效底 | 改后比值 | 判 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | logo「Seafood 海鲜市场」（日档 · `20px/700` = **大字**） | `text-yellow-600` = `rgb(202,138,4)` | `rgb(255,254,243)` | **2.90:1** | 3:1 | **✗** | **`var(--sf-brand-fg)` = `#0A0A0A`** | `rgb(253,232,21)` | **15.77:1** | ✓ |
| 2 | `.nav-link` base（日档 ×2 在场） | `#4b5563`（`HoverMenu.css:8`）| `rgb(255,254,243)` | **7.45:1** | 4.5:1 | ✓ | **不变** | `rgb(253,232,21)` | **6.02:1** | ✓ |
| 3 | `.nav-link:hover`（日档） | `#d97706`（`HoverMenu.css:12`；dist 逐字 `.nav-link:hover{color:#d97706}`）| `rgb(255,254,243)` | **3.14:1** | 4.5:1 | **✗** | **`var(--sf-brand-fg)`** | `rgb(253,232,21)` | **15.77:1** | ✓ |
| 4 | `.nav-link.active`（现取在场 **0** 处 · 仍冻结） | `#d97706` on `#f3f4f6`（`HoverMenu.css:16-17`）| `rgb(243,244,246)` | **2.89:1** | 4.5:1 | **✗** | **`var(--sf-brand-fg)` on `#f3f4f6` 不变** | `rgb(243,244,246)` | **17.99:1** | ✓ |
| 5 | 注册 / 登录 触发按钮 base（日档 ×2） | `text-gray-600` | `rgb(255,254,243)` | **7.45:1** | 4.5:1 | ✓ | **不变** | `rgb(253,232,21)` | **6.02:1** | ✓ |
| 6 | 注册 / 登录 触发按钮 `:hover`（日档） | `hover:text-yellow-600`（`Header.jsx:324/:331`；dist 逐字 `:hover{color:#ca8a04}`）| `rgb(255,254,243)` | **2.90:1** | 4.5:1 | **✗** | **`var(--sf-brand-fg)`** | `rgb(253,232,21)` | **15.77:1** | ✓ |
| 7 | 汉堡 / 主题钮 base（日档 · 图标） | `text-gray-600` | `rgb(255,254,243)` | **7.45:1** | 4.5:1 | ✓ | **不变** | `rgb(253,232,21)` | **6.02:1** | ✓ |
| 8 | 汉堡 / 主题钮 `:hover`（日档 · **自带底**） | `hover:text-gray-900` = `#111827` on `hover:bg-gray-100` = `#f3f4f6` | `rgb(243,244,246)` | **16.12:1** | 4.5:1 | ✓ | **不变** | `rgb(243,244,246)` | **16.12:1** | ✓ |
| 9 | **夜档全部 7 处前景（冻结状态）** | `rgba(255,255,255,.92)`（`styles.css:146-147`）⇒ 合成 `rgb(237,238,239)` | `rgb(31,41,55)` | **12.63:1** | 4.5:1 | ✓ | **维持现状** | `rgb(31,41,55)` | **12.63:1** | ✓ |
| 10 | **顶栏下边框**（非文本） | `border-gray-200` = `rgb(229,231,235)` | `rgb(255,254,243)` | **1.22:1** | 3:1 | **✗** | **`var(--sf-topbar-border)` = `#030402`**（宽度保持 1px） | `rgb(253,232,21)` | **16.37:1** | ✓ |
| 11 | 移动面板项（社区任务 / 订单 / 语言 / 三语钮） | `text-gray-600` on 面板底 `rgba(255,255,255,.95)` | `rgb(255,254,243)` | **7.45:1** | 4.5:1 | ✓ | **不变**（面板自带底） | `rgb(255,254,243)` | **7.45:1** | ✓ |
| 12 | 移动面板「注册」胶囊 | 白字 on `bg-blue-600`(α .95) ⇒ `rgb(48,106,224)` | 同左 | **4.94:1** | 4.5:1 | ✓ | **不变（本单不批改）** | 同左 | **4.94:1** | ✓ |
| 13 | ★ **移动面板「登录」胶囊**（既有不达标 · **与顶栏底色无关**） | 白字 on `bg-yellow-600`(α .95) ⇒ `rgb(205,143,5)` | 同左 | **2.80:1** | 4.5:1 | **✗** | **不变（本单不批改 · 挂账另立单 · §23.7 第 6 项）** | 同左 | **2.80:1** | **✗** |
| 14 | 移动面板选中语言钮 | `#0A0A0A` on 选中底 `rgba(243,244,246,.95)` ⇒ `rgb(244,243,235)` | 同左 | **17.81:1** | 4.5:1 | ✓ | **不变** | 同左 | **17.81:1** | ✓ |

**★ 取数路径差登记（写死 · 承 `N52`）** —— 本表走**合成后**像素；Zang 报值走**未合成**（以纯白为底）路径：

| 项 | 本表（合成 · 采用） | Zang 报值（未合成） | 差 | 结论 |
|---|---|---|---|---|
| logo 现状 | **2.899:1** | 2.94:1 | 0.04 | 两条均 < 3:1 ⇒ **判负结论一致** |
| `.nav-link` base 现状 | **7.458:1** | 7.56:1 | 0.10 | 均 ≥4.5 ✓ |
| 夜档前景 | **12.636:1** | 14.68:1（= 纯白 on `#1F2937`，忽略 `.92` alpha）| 2.04 | 均 ≥4.5 ✓ |
| `.nav-link:hover` **on 实黄** | **2.538:1** | ≈2.54:1 | 0.00 | **复现一致** ✓ |
| `.nav-link` base **on 实黄** | 6.021:1 | ≈5.66:1 | — | **本单未复现其底/算法**；两条均 ≥4.5 ⇒ 不影响判 |

**★ 分档说明（`T117` 作用面）**：第 5–8、11–14 行属**自带底 / 面板自带底**面（判据按其自身合成底）；第 1–3、6 行为**由顶栏底色承载**面 ⇒ **本次硬门的主要作用面**；第 10 行是非文本项（Zang 裁定未点名，本单**独立登记**并按裁定 3 一并修）。

### 23.4 受影响硬断言清单（**逐条点名到 `文件:行` · 现取重锚**）

**清单 A —— 真改面 / 真依赖面（不做即判负）**

| # | 断言（`文件:行`） | 现取口径 | 本单必须做的动作 |
|---|---|---|---|
| **A1** | `theme-shell-isomorphism.test.jsx:101-102`（`container.querySelectorAll('.nav-link[href]')` 的 href 集合 `toEqual(['/task','/exchange','/profile'])`） | 通过（顶栏内 `.nav-link` 的 href 恰此三项）| **改顶栏时不得增删任何带 `href` 的 `.nav-link`**（只改**颜色**；`nav-link` 控件类可继续复用）|
| **A2** | `theme-shell-isomorphism.test.jsx:78-82` · `:96-98` · `:103-104` · `:118-120`（**五 `data-sf-region` 恒等**：`['shell','topnav','content','footer','tabbar']` + tabbar href 集 + `topnav` 内品牌 `a[href="/"]` 与四语入口 `button`） | 通过 | **不得新增 / 改名任何 `data-sf-region`**；`Header` 仍在 `topnav` 内、品牌链与四语入口挂点不动（本单只改颜色与边框色） |
| **A3** | `v15-nav-floatmenu.test.jsx:226-231`（AppShell 内挂 `[data-sf-m="floatmenu"]` + **regions 恒等**同 A2） | 通过 | 同 A2 |
| **A4** | `v15-nav-floatmenu.test.jsx:199-204` + `theme-shell-isomorphism.test.jsx:217-231`（**`shell.css` 只有一个 `@media`（767px）** 且手机块含 `.sf-tabbar`/`display:grid`）| `grep -c '@media' shell.css` = **1** | **`shell.css` 一字不动** ⇒ 新规则落 `styles.css` 顶层（`T114`） |
| **A5** | `theme-shell-isomorphism.test.jsx:233-238`（`shell.css` **无 `[data-theme`** / 无 `theme-day` / `theme-night`）| 通过 | 同上（日档限定只能落在 `styles.css`，**不得**落 `shell.css`） |
| **A6** | `v15-nav-floatmenu.test.jsx:206-217`（`.sf-fm` 几何 + `widePart` **不得含** `border-radius: 54px`）| 通过 | 本单不碰 `shell.css` ⇒ 自动维持（改动若误落 `shell.css` 会撞此断言）|
| **A7** | `p6-btn-impl2.test.js:73-89`（`.sf-btn` 族 **11 文件冻结清单**精确相等 + 用法 `≥22`）| 清单**不含** `components/Header.jsx` | **不得在 `Header.jsx` 引入 `.sf-btn` 族**（前景色改写只动颜色，不得换控件族）|
| **A8** | `theme-shell-isomorphism.test.jsx:240-261`（`theme-tokens.css` 主题块逐声明必须是 `--sf-*` 且在 `TOKEN_KEYS` 内）| 通过 | **零新 token** ⇒ `theme-tokens.css` / `tokens.js` **一字不动**（`T118`；若实现方要新增 token ⇒ 走 `N46` 双件 + 停下上报）|
| **A9** | `theme-shell-isomorphism.test.jsx:207-215`（`src/shell/**` + `src/theme/**` JS 无 `matchMedia`/`innerWidth`/… · **注释同禁**）| 通过 | 分档**只能**用 CSS（`:root:not([data-theme="dark"])`）；不得在 JS 里读宽度/偏好（`T115`）|
| **A10** | `styles.css:146-147`（夜档全局前景 `!important` 两条）| 在场（夜档 7 处前景的实际来源）| **一字不得改**（改了会连带改夜档前景 ⇒ 破 `T117` 的「夜档维持现状」）|

**清单 B —— 冻结面零改锚（改动不得碰）**

| # | 断言（`文件:行`） | 本单为何不碰 |
|---|---|---|
| **B1** | `theme-tokens.test.js:58-66` / `:96-109` / `:111-117`（键集 / 键序 / 键名分段黑名单 / 两档差异键 > 90）| 零新 token、零值变更 ⇒ 逐条不动 |
| **B2** | `theme-tokens.test.js:68-94`（PROV 逐键回读真源行）| 本单**不产生新真源值** ⇒ `tokens.js` 的 PROV 表一字不动（**若实现方新增 token ⇒ 必走 `N46` 双件**）|
| **B3** | `theme-tokens.test.js:119-150`（`STRUCT` / `STRUCT_PROV` / `EXCLUDED_FROM_THEME`）| 零 `STRUCT` 增项、不改 `--sf-st-*` |
| **B4** | `theme-tokens.test.js:164-180`（生成物日/夜两块逐键 = JS 表）| `theme-tokens.css` 一字不动 |
| **B5** | `theme-shell-isomorphism.test.jsx:84-90` / `:107-113`（底栏五项 DOM 恒在 + key 序）| 与本单无关（顶栏面）|
| **B6** | `theme-shell-isomorphism.test.jsx:263-270`（四语键集相同 + `siteTitle` 字面）| **零 i18n 变更** ⇒ 不动 |
| **B7** | `i18n-batch-b4a/b4b` 的计数断言（`{ top: 128, flat: 1104 }`）| 零新键 ⇒ 不触发 13 文件计数前推 |
| **B8** | **本仓**无一条测试锚定 `#header` 的外观类（`grep -rn 'bg-white\|bg-opacity\|backdrop\|sf-region-top\|#header' frontend/src/test` ⇒ 仅 `Card.test.jsx:13` 的 `bg-white`〔`Card` 组件、与本单无关〕与 `theme-shell-isomorphism.test.jsx:100` 注释）| ⇒ **改 `Header.jsx:166` 的 class 不引致任何断言改锚**（本单**零改锚**）|

**★ 断言影响小结（供实现方前推）**：**真改锚 0 条**（本单无一条冻结值需要前推）；**真改面 3 条**（`A1` 不得动 href 集 / `A2`+`A3` 五 region 恒等 / `A4`+`A5`+`A6` 落点不得越界到 `shell.css`）；**新依赖 2 条**（`A9` 分档只能用 CSS · `A10` 夜档全局前景规则不得改）；**冻结面零改锚 8 条**（清单 B）。

### 23.5 归因式 AC（**不用元素白名单** · 承 §19.8 / §20.9 / §21.8 / §22.9 体例）

| AC | 判据（写死 · 可复核） | 判负 |
|---|---|---|
| **AC-1** 日档顶栏像素（`T114`） | **390 / 1440 / 1600 三档**：`#header` `getComputedStyle().backgroundColor` = **`rgb(253, 232, 21)`** 且 **alpha = 1**；`backdropFilter` = **`none`**；`borderBottomColor` = **`rgb(3, 4, 2)`**；`opacity` = `1`。**取值口径 = 真页 `getComputedStyle` 回读**（承 `N46`/`N51`；**不得**用声明值或自算值代替）。 | 任一档任一值不等 / alpha < 1 / `backdropFilter` 非 `none` |
| **AC-2** 夜档冻结（`T115`） | **夜档**（`html[data-theme="dark"]`）三档：`#header` `backgroundColor` = **`rgb(31, 41, 55)`**、`borderBottom` = **`1px solid rgb(55, 65, 81)`**、`rect` = **改前逐值相同**、`backdropFilter` 仍为 `blur(4px)`（夜档本单不改）。**★ 反向自证（必跑）**：把日档规则**去掉日档限定**（`:root:not([data-theme="dark"])` 拿掉）后，夜档回读**必须**变成 `rgb(11, 12, 14)` ⇒ 证明该限定是**承重件**、也证明尺子有分辨力（本单实测见 §23.6 `N53`）。 | 夜档任一值变化 / 反向自证不变红（= 尺子对该限定不敏感） |
| **AC-3** 前景硬门（`T117`） | 表 §23.3 逐行复算：**由顶栏底色承载**的前景（第 1–3、6 行）改后比值 **≥ 阈值**；**其它行维持现状**；**夜档 7 处前景维持 `rgba(255,255,255,.92)` 且比值不变**。**取数口径** = 真渲染 `color` ÷ **合成后**的有效底（`N52`）；**同一表内不得混用未合成值**。 | 任一行 < 阈值 / 用未合成底 / 夜档前景变化 |
| **AC-4** 不透明且不穿透（`T114`） | ① 三档 `#header` 底色 **alpha = 1**；② 滚动后复读仍 alpha = 1 且 `backdropFilter = none`；③ **真点法**：顶栏在场时，取顶栏内任一点的 `document.elementFromPoint()` **必须命中 `#header` 子树**（不得命中页面内容）。**★ 现状勘误一并登记**：本仓顶栏 `sticky` **声明不生效**（含块高 = 顶栏高 ⇒ 随页滚走，见 §23.1）⇒ **本单不改该机制**（`T118` 零几何）；若将来修成真 sticky ⇒ 本条 ②③ 仍须为绿。 | alpha < 1 / `backdropFilter` 非 none / 顶栏在场时该点命中页面内容 |
| **AC-5** 归因式「不动面」（**作用面 = 全站顶栏面** · 不用白名单）| 全站逐路由（≥ `/`、`/item/:id`、`/exchange`、`/task`、`/profile`、`/messages`）× 档（日 / 夜）× 宽度（390 / 1440 / 1600）的逐元素差异集 **100% 归因于 `T119` 的允许变更集**（① `#header` 底色 + 边框色；② 由顶栏底色承载的三处前景色及其 `:hover`/`.active` 态）；**反事实臂**：只在测量期移除日档规则并复原三处前景值（**日 / 夜两档同口径分别回退**，承 §22.12 第 17 项）⇒ 差异集**必须为空**。采数口径承 §13（禁动画 + 只采可见元素 + 结构键不入坐标 + 加载期随机源具名归一化）。 | 出现归不进两项的差异（含任何 `rect` 变化）/ 反事实回退后差异集非空 / 只回退一档 |
| **AC-6** 结构不变式 | `grep -c '@media' frontend/src/shell/shell.css` = **1**；`grep -c 'data-theme' frontend/src/shell/shell.css` = **0**；五 `data-sf-region` 恒等；`TOKEN_KEYS` / `STRUCT` 键数**不变**；`theme-tokens.css` 与 `tokens.js` **零 diff**；`.nav-link[href]` 集合恒等。 | 任一破 |
| **AC-7** 门套 | `cd frontend && npm run build` ⇒ **exit 0**；`npm run test:unit` ⇒ **例数不减少**（改前基线 **54 files / 520 tests** · 2026-10-17 08:00 现取 · §22.1）；`lint` 无配置（恒 exit 2 · 存量）⇒ 只登记。 | build 非 0 / 例数下降 |
| **AC-8** 尺子灵敏度自证（**必跑 · 两向**）| **负控臂**：把规则里的 `var(--sf-topbar-bg)` 换成 `#FFFFFF` ⇒ 回读**必须**变 `rgb(255,255,255)`（本单实测 ✓）；**复原臂**：移除规则 ⇒ 回读**必须**回到 `rgba(255,255,255,0.95)`（本单实测 ✓）；**AC-2 反向臂**同上。⇒ 证明探针读的是**真渲染**、且对本次改动**敏感**。 | 负控臂 / 复原臂 / 反向臂任一"不变红" ⇒ 尺子无效、判负（承 §21.8「无效尺子」）|
| **AC-9** 零几何（`T118`/`T119`）| 三档（390/1440/1600）× 日/夜：`#header` 与 `.sf-region-top` 的 `getBoundingClientRect()` **改前/改后逐值相同**（现取改前 = `(0,0,W,65)`）；`.sf-route-container` 的 `max-width` / `padding` 与 ≤767 页底表现**不变**（≤767 仍不露灰页底）。 | 任一 rect 变化 / ≤767 出现灰页底 / 改了 `max-width` 或 `padding` |
| **AC-10** 移动档（`T119` · 390/375/320）| ① `#header` 底色 = `rgb(253,232,21)`、alpha = 1（与桌面同口径）；② **汉堡面板展开态**（`[data-sf-m="header-mobile-menu"]` 点击后）：面板自带底上的项与胶囊按表 §23.3 第 11–14 行评（**第 13 行「登录」胶囊为既有 ✗ · 不在本单判负项内**，见 §23.7 第 6 项）；③ 面板展开时 `#header` 的 rect 正常增高、颜色不变（现取 = `(0,0,390,500)`）。**★ 若 Kevin「移动档 = 保持全白」的原意为「移动档顶栏保持全白」**（见 §23.7 `Q10`）⇒ 本条 ① 改为「≤767 顶栏 = 现状」、改法 = 一条 `@media (max-width:767px)` 反向覆盖（**一句话可改**）。 | 顶栏 alpha < 1 / 面板展开态引入新的不达标项 / 在 ≤767 引入几何变更 |

### 23.6 新增可复用教训（`N52` / `N53` · 承 `N39`–`N51`）

- **`N52` · 带 alpha 的前景 / 背景，对比度必须按「与底合成后的像素」算；未合成值只作旁证，且同一张表内不得混用。** 机制：`rgba(255,255,255,0.92)` **不是**白 —— 它压在 `#1F2937` 上实际渲染为 `rgb(237,238,239)` ⇒ 合成路径 **12.63:1**，而未合成（拿纯白当 fg）得 **14.68:1**（**高估 2.05**，正是 Zang 本轮报值）；同族三处实测差：logo `2.90` vs `2.94`、`.nav-link` base `7.45` vs `7.56`。⇒ 规则：**填表前先问「这个值是合成的吗」**；表头写死采用路径；**两路并列时必须标出差量**（本单 = §23.3 的「取数路径差登记」表）。与本条同族的既有纪律 = `N46`（回读才是证据）、`N51`（册面 sRGB 以浏览器回读为准）。
- **`N53` · 给「共享外壳件的单档改造」写覆盖规则时，覆盖规则必须**显式排除另一档**；否则它会连带改掉另一档（且不报错）。** 机制（本单实测 · 同一 dist、同一 headless 浏览器）：本仓已声明 `color-scheme`（修「手机 UA 强制深色」的连带后果，见 `N50`）⇒ `dark:*` 工具类是**活的**，夜档底由 `dark:bg-gray-800` 给值；而 `styles.css` 顶层规则**未分层**，按级联**层序**（未分层 > `@layer utilities`，**层序优先于具体性**）**必胜**任何 Tailwind 工具类 ⇒ 写成 `#header{background-color: var(--sf-topbar-bg)}`（**无日档限定**）时，夜档回读 **`rgb(31,41,55)` ⇒ `rgb(11,12,14)`**（= 破「夜档冻结」，**且 build / test 全绿、无任何报错**）；加上 `:root:not([data-theme="dark"])` 后夜档回读**恒 `rgb(31,41,55)`**。⇒ 规则：**单档覆盖 = 「限定到该档」而不是「不加限定」**；**判据必须含一条反向臂**（去掉限定 ⇒ 另一档必须变红，本单 = `AC-2` 反向自证）。★ 另一面：正因为「未分层 > 分层」，**日档限定规则不必提高具体性**（`#header` 一级即可压过 `bg-white`）—— 但**仍需**让 `bg-opacity-95` / `backdrop-blur-sm` 失效（否则同类里的透明度仍生效，本单用 `background-color` + `backdrop-filter:none` 一并接住）。

### 23.7 待裁 / 未核实（**诚实清单 · 禁填 0/空**）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | **门套** | **`NOT_RUN`（本单为规范单）** | 本册未跑 `build` / `test:unit`；改前基线 **54 files / 520 tests** 承 §22.1（Zang 08:00 采 · `readings/baseline.log`）。**实现方动手前必须自取一次基线并落读数**。 |
| 2 | **真渲染 `:hover` / `.active` 回读** | **`NOT_MEASURED`（环境限制）** | 本单无法取得真 hover 读数：CDP `Input.dispatchMouseEvent` **恒 5s 超时**；`CSS.forcePseudoState` 在本环境**不生效**（强制后读数不变，且注入 `:hover` 规则后仍不变 ⇒ 该态未被激活）。⇒ 表 §23.3 第 3/4/6/8 行的「现状值」取 **dist 声明值**（`grep` 逐字）+ 无 hover 孪生工具的**真渲染回读**（`text-yellow-600` = `rgb(202,138,4)` · `text-gray-900` = `rgb(17,24,39)`）。**⇒ `AC-3` 的 hover 行必须由实现 / 质检方以真 hover 回读补足**（`AC-8` 的灵敏度自证同样适用于 hover 态）。 |
| 3 | `.nav-link.active` 态 | **`NOT_MEASURED`（现取在场 0 处）** | `#header .nav-link.active` 现取计数 = **0**（首页 `/` 无 `menuItems` 命中）⇒ 表 §23.3 第 4 行为**声明值**路径；改后须在命中页（如 `/task`）复取。 |
| 4 | **登录态（已认证）顶栏下拉**（`data-sf-m="header-user-menu"` 族）前景 | **`NOT_MEASURED`（需登录）** | 源码类同 `text-gray-600 dark:text-gray-300`（`Header.jsx:281`/`:373` 族）⇒ **推断**达标，但**本单未取真渲染**；改后须以登录态复取（若其落在顶栏底色上则同受 `T117` 硬门约束）。 |
| 5 | **真机 / UA 强制深色** | **`NOT_MEASURED`（承 §17.3 已定案）** | 本单未复测；口径承 §17.3（本站夜档 + 屏幕忠实）。 |
| 6 | ★ **移动面板「登录」胶囊 = 2.80:1（✗）** | **既有不达标 · `UNRESOLVED` · 挂账（另立单）** | 现取：白字 on `bg-yellow-600`(α .95)（`Header.jsx:400-408`）；**与顶栏底色无关**（自带底）⇒ **本单不批改**（改它 = 改移动面板按钮配色、非 Zang 裁定范围）。**若 Kevin/Zang 要求本单一并修 ⇒ 需追加裁定**（一句话可改）。 |
| 7 | ★ **`Q10` · 「移动档 = 保持全白」的读法** | **`AMBIGUOUS` · 交 Kevin / Zang** | **(i) 页面底 / 内容面保持全白**（= 本册采用：承「≤767 不露灰页底」已知事实 + 裁定 5「不改任何几何」）；**(ii) 移动档**顶栏**保持全白**（⇒ 日档实黄仅限 `>767`，改法 = 加一条 `@media (max-width:767px)` 反向覆盖、**一句话可改**，但**与「零几何 / 零新断点」无冲突**）。**本册按 (i) 写**（派单解码），并**把 (ii) 作为待裁项列出** —— 按 (ii) 执行即 `AC-10` ① 反向。 |
| 8 | **真源 `:201` 的 `border-bottom:2px`** | **登记（本单取 1px · 另裁才改）** | 设计真源白天口径为 `2px`，现状实现为 `1px`；本单**只改颜色**（`T116`）—— 改宽 = 顶栏 65 ⇒ 66px、全站下移 1px = **几何变更**（承 `T118`）。 |
| 9 | **移动面板自带底 `bg-white` 实测为 `rgba(255,255,255,0.95)`** | **登记（本单不动）** | 机制 = `bg-white` 子元素**继承**父级 `bg-opacity-95` 的 95% 语义 ⇒ 顶栏子树内所有白底均半透明（既有行为，改动前后一致）；本单**不批改**（改它 = 移动面板配色变更）。 |
| 10 | **夜档整卡配色 / 夜档顶栏之外的夜档设计** | **`UNRESOLVED` · 挂账（另立单 · 承 §22.11）** | Kevin「夜档另议，本项目需要夜档」⇒ 夜档顶栏本轮**冻结现状**（`T115`）、**不作设计定案**；`--sf-surface-bg` 夜档 `#101114` 暂定值复核**同单挂账**。 |
| 11 | **本轮 `push` 与生产终验** | **`NOT_DONE`（按 Kevin 第 3 项）** | 「先把顶栏定下来、改完再一并 push（含生产终验）」⇒ 本单**不 commit / 不 push**；push 与生产终验由 Zang 统一走（含「同版证明」+ sha256 + 哨兵 + 真浏览器白屏探针）。 |

### 23.8 无新增真源值 + 快照 + 自证 + git 面（本节）

- **真源面 = 零改动（预期即零 · `T118`）**：本单**不产生任何新真源值** —— 三个槽位（`topbar-bg` / `topbar-border` / `brand-fg`）**均已在真源与值表中存在**（PROV：`tokens.js:275` = `topbar-bg{d:[201,'background:#FDE815'], n:[274,'background:#0B0C0E']}` · `:276` = `topbar-border{d:[201,'border-bottom:2px solid #030402'], n:[274,'border-bottom:1px solid #FDE815']}` · `:277` = `brand-fg{d:[203,'color:#0A0A0A'], n:[276,'color:#F5F6F7']}`）⇒ **`docs/design/style-preview.html` 本单零改动**（PROV 硬门不需要新行、指针不动）。若实现方认为必须新增值 ⇒ **走 `N46` 双件 + 停下上报**（裁定 6）。
- **改前快照**：`docs/versions/design-system.spec.v1.20.md`（本单开工复核 **`cmp` = 0**；**2646 行 / 607,188 B / md5 `6fa271687481dd69c70a5ce358b63dc5`** = 现盘 live 逐字节相同）；**本版镜像** = `docs/versions/design-system.spec.v1.21.md`（落笔后建，`cmp=0`）。
- **三处版本记录同步（写死 · 计数锚点）**：① 头部 = `grep -n '^> \*\*★ 现行版 = v1.21' docs/design/design-system.spec.md` **恰 1 命中**；② 正文 = `grep -n '^## §23 ' docs/design/design-system.spec.md` **恰 1 命中**；③ §12 表 = `grep -n '^| \*\*v1.21\*\* |' docs/design/design-system.spec.md` **恰 1 命中**。**三处同批入库，漏一处 = 不完整**。
- **只追加自证**：`git diff --numstat docs/design/design-system.spec.md` **删除列 = 0**；`§1`–`§22` 一行未改。
- **本册改后读数与 `numstat`** 见 **`docs/audit/design-system-v1.21-delta.md`**（删除列 = 0 + 快照 `cmp=0` + 「未动 `frontend/**`」`grep` 自证 + 三处锚点命中数）。
- **证据落点（本单）** = `ops/ui-card-ref-20261017/readings/jing-v121-readings.txt`（现取读数 · 对比度表 · 候选机制自证 · 机制坑实测）＋ `…-readings.json` / `…-dark.json` / `…-mobile390.json` / `…-sticky.json` / `…-light-current.json`（原始逐档 JSON）＋ `…-selfproof.log`（可复跑命令）。**★ `.log` 被仓根 `.gitignore:244 *.log` 命中 ⇒ 入库须 `git add -f`**（承 `N42`）。
- **git 面**：**未 `git add -A` · 未 commit · 未 push**（收口由 Zang 统一处理）；本单只写 `docs/design/design-system.spec.md`（**纯追加**）· `docs/versions/design-system.spec.v1.21.md`（新建）· `docs/audit/design-system-v1.21-delta.md`（新建）· `ops/ui-card-ref-20261017/readings/jing-v121-*`（新建）；**未动 `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html` / `ops/ui-card-ref-20261017/shots/**`；未启停任何服务**（实现 / 验收归 Kong / Neng）。

## §24 `/item/:id` 底部操作栏「goofish 形态」（`T120`）· 组合条 2 段 + 留白 + 独立收藏 · 本轮唯一新增 2 个颜色 token（**本节只追加 · §1–§23 一字未动** · 依据 = **Kevin 2026-10-17 裁定「详情页底部操作栏改成闲鱼（goofish）形态」** + 参考图 `ops/item-actionbar-20261017/ref/goofish-ref.png`（**1128×170** · sha256 `308e2b62c45a2b3c3868d4783a93b19e2308523bb2cc5cece5b8bec4265485cd`）· **本单只冻设计真源与 token 层；UI 实现归下一单**）

### 24.0 裁定来源、范围与「本单不动什么」

> **★ 版本内勘误注（2026-10-17 · 勘误级）**：本节「只追加」这一自述**从本节内部看已不再严格成立** —— v1.22 落册后、**版本号不变**的前提下，本节自身做过 **2 处就地更正**（§24.1-b 与 §24.3 的 `58% : 42%` ⇒ `50% : 50%`），原因 = 原值为**目测**、经**逐像素实测**校正（§24.7）；**对 §1–§23 而言仍是「一字未动」**。逐行删改说明见 §24.7 末「删除行说明」。

| # | 项 | 内容 |
|---|---|---|
| 1 | Kevin 口径 | 「把 `/item/:id` 详情页底部操作栏改成闲鱼形态：`聊一聊`（黄底 + 聊天气泡图标）与 `立即购买`（墨底反相字）拼成一个胶囊条，右侧留白后一个独立 `收藏` 胶囊（浅底 + 星形图标）。」 |
| 2 | 参考图真身 | `ops/item-actionbar-20261017/ref/goofish-ref.png` · **1128×170** · sha256 `308e2b62c45a2b3c3868d4783a93b19e2308523bb2cc5cece5b8bec4265485cd`（**落盘真身已复算一致**；不拿聊天预读当依据，承 SKILL「按参考图改 UI」①） |
| 3 | 本单范围（**Jing · 规范角色**） | ① **新增 2 个颜色 token**（`--sf-cta-solid-bg` / `--sf-cta-solid-fg`）并四处同动（真源追加 / 值表 / PROV / 生成物重生成）；② **形态口径登记**（本节 `T120`）。 |
| 4 | **本单禁区（写死）** | **不改** `frontend/src/pages/item/**`（含 `ItemDetailPage`、`item.css`）· **不改** `frontend/src/shell/shell.css` · **不新增 `data-sf-region`** · **不动** `--sf-l-actionbar-h`(60px) · **不改** 任何既有 token 值 · **不新增第二个 token 之外的任何 token** · **未 `git add -A` · 未 commit · 未 push**。 |
| 5 | 与既有条文的关系 | `T94`（范围 + 渲染面白名单）中「底部固定操作栏」的**形态**由本节细化；`T94` 的**白名单**条文（含「收藏 / 聊一聊 是否渲染」）**本节不改** —— 聊一聊自 `T100`（v1.17）起已激活；**收藏的可用性前提见 §24.6 第 1 项挂账**。`T98`（结构常量落页面局部 `--sf-l-*`）**逐字沿用**。 |

### 24.1 形态条文（`T120` · 逐条可判负）

| 编号 | 条文 | 判负项 |
|---|---|---|
| **`T120`-a · 三段结构** | 操作栏内恒为**三段**：① **组合条**（内部**恰 2 段**：`聊一聊` \| `立即购买`）② **留白** ③ **`收藏` 独立胶囊**。三段**同一行、垂直居中对齐**（不含换行 / 不含第二行） | 出现第 4 个可见操作元素 / 组合条内出现第 3 段 / 收藏被并入组合条 / 换行成两行 |
| **`T120`-b · 组合条内部占比** | `聊一聊` : `立即购买` = **50% : 50%**（两段 flex 分配，和 = 100%，各自随组合条宽度等比伸缩）；两段文本**各自居中**。★ 勘误（v1.22 内 · 2026-10-17）：原 `58% : 42%` 系**目测值、已作废** —— **以 50:50 为准**（逐像素实测见 §24.7；旧字面逐字保留于 §24.7「作废」列） | 任一档任一宽度实测占比偏离 **±1 个百分点**以上（`width` 回读 ÷ 组合条宽） |
| **`T120`-c · 组合条与收藏的留白** | 组合条**右缘**与 `收藏` **左缘**之间存在**严格大于 0 的留白**（两者不得相接 / 不得共享边框） | 留白 **= 0**（融成一根条）/ 留白为负（重叠） |
| **`T120`-d · 两端半圆 + 中缝直角** | 组合条**左端**（`聊一聊` 左两角）与**右端**（`立即购买` 右两角）= **半圆**（半径 = 既有 `--sf-st-radius-pill` = `999px`）；**中缝**（两段相接处）= **直角**（四角 `border-radius: 0`）；`收藏` = **独立胶囊**（四角 `999px`） | 中缝出现圆角（**中缝左右各 2 角合计 4 角必须为 0**）/ 任一端非半圆 / 收藏非胶囊 |
| **`T120`-e · 图标** | `聊一聊` 前置**聊天气泡**图标、`收藏` 前置（或内含）**星形**图标；图标 **`currentColor`** 跟随所属段的文字色 token（**图标颜色不单独进主题层**）；图标为**图形件、零新主题 token** | 图标硬编码白色（亮底档不可见）/ 为图标新增 token / 缺图标 |
| **`T120`-f · 两档几何逐值相等** | **日 / 夜两档 rect 逐值相同**（组合条、两段、收藏、留白全项）；**颜色以外一律不进主题层**（占比 / 圆角 / 留白 / 高度 / 图标尺寸均为两档同值） | 任一档出现 `rect` / `width` / `height` / `border-radius` 差异（判负） |
| **`T120`-g · 颜色映射（零新增除 2 键）** | `聊一聊` = `--sf-btna-bg`(#FFE60F) / `--sf-btna-fg`(#202020)（**日夜同值**）；`立即购买` = **`--sf-cta-solid-bg` / `--sf-cta-solid-fg`**（本轮新增，见 §24.2）；`收藏` = `--sf-btnalt-bg` / `--sf-btnalt-fg` / `--sf-btnalt-border`（夜档自带反相） | 任一元素用硬编码色 / 新增 `--sf-cta-*` 以外的 token / 复用 `--sf-price-*` 等无关槽位 |
| **`T120`-h · 本轮唯一新增 token = 2 键** | `TOKEN_KEYS` **只增 `cta-solid-bg` / `cta-solid-fg` 两枚**（`110 → 112`）；几何常量（占比 / 留白 / 圆角引用 / 图标尺寸）**落页面局部 `--sf-l-*`（承 `T98`）**，**不进 `tokens.js` 的 `STRUCT`**（`STRUCT_PROV` 带真源溯源硬门，本单真源仅承载颜色） | 新增第 3 个 token / 把占比或留白塞进 `STRUCT` / 改动任何既有 token 值 |
| **`T120`-i · 三段横向占比（比例口径 · 禁固定 px）** | **按钮行可用宽** = 操作栏内容盒宽 − 左右外边距（外边距取页面局部 `--sf-l-*`，本册不裁其像素值）⇒ 三段**比例恒等**：**组合条 `72.8%` · 留白 `4.6%` · `收藏` `22.6%`**（和 = 100.0%，±1 个百分点）；实现**只许写比例**（如 `grid-template-columns: 72.8fr 4.6fr 22.6fr`，或等价 flex 比例），**不得换算成固定 px**；三段随可用宽等比伸缩 | 任一段占比偏离 **±1 个百分点**以上（`width` 回读 ÷ 可用宽）/ 出现固定 px 宽（`width: 775px`、`flex: 0 0 240px` 一类）/ 三段和 ≠ 100% / 左右外边距两档不相等 |

### 24.2 token 增项（本轮唯一新增 2 键 · 日 / 夜成对反相）

| token | 日档 | 夜档 | 取值依据 |
|---|---|---|---|
| **`--sf-cta-solid-bg`**（新键） | `#202020` | `#EDEFF2` | 日档 = 参考图的深灰底，**取站点既有 ink 家族 `--sf-btna-fg` 同值**（`#202020`）⇒ **不引入第二套墨色**；夜档 = **反相**（夜档深页上深底会消失 ⇒ 换**亮底**），值与 `--sf-title-fg` 夜档同源（`#EDEFF2`） |
| **`--sf-cta-solid-fg`**（新键） | `#FFFFFF` | `#0A0A0A` | 日档 = 墨底上的**反相白字**；夜档 = 亮底上的**深字**（与日档成对互换） |
| `--sf-btna-bg` / `--sf-btna-fg` | `#FFE60F` / `#202020` | `#FFE60F` / `#202020` | **复用、零变更**（真源 954 / 958 行）：`聊一聊` 段 |
| `--sf-btnalt-bg` / `--sf-btnalt-fg` / `--sf-btnalt-border` | `#FFFFFF` / `#202020` / `#E0E0E0` | `#141619` / `#FFFFFF` / `#E0E0E0` | **复用、零变更**（真源 956 / 960 行）：`收藏` 胶囊（夜档自带反相） |

**★ 两键的键序（写死）**：`DAY` / `NIGHT` 两块内**逐字同索引位置**（现取 `indexOf` = **107 / 108**，两档一致），插在 `btnalt-border` 之后、`fm-bg` 之前 —— `TOKEN_KEYS = Object.keys(DAY)`，`theme-tokens.test.js` 断言两档**键集与键序完全相同**。

**★ 夜档为何必须反相（口径，非审美）**：夜档页底 = `#0B0C0E`、内容面 = `#101114` ⇒ 深底（`#202020`）在夜档上**与背景几乎同色而消失**；故夜档取**亮底深字**（`#EDEFF2` / `#0A0A0A`），与参考图「墨底反相字」的**语义**（强对比主体按钮）一致，而不是照抄它的**明度方向**。

### 24.3 几何口径（颜色以外**不进主题层** · 两档逐值相等）

| 项 | 口径 |
|---|---|
| 三段结构 | 组合条（2 段）+ 留白 + 独立收藏（`T120`-a） |
| 组合条内部占比 | `聊一聊` **50%** / `立即购买` **50%**（和 = 100%，±1 个百分点内 · **以 50:50 为准**；原 `58%` / `42%` 系目测值、已作废，旧字面见 §24.7「作废」列） |
| 组合条 ↔ 收藏 | **留白 > 0**（不得相接 / 不得重叠） |
| 三段横向占比（**比例口径 · 禁固定 px**） | 相对**按钮行可用宽**：组合条 **72.8%** / 留白 **4.6%** / 收藏 **22.6%**（和 = 100.0%，±1 个百分点 · `T120`-i）。实测留痕 = `775 / 49 / 240 px ÷ 1064 px`，**px 仅作取证、不作口径**（见 §24.7） |
| 圆角 | 组合条**两端半圆**（`999px`，复用 `--sf-st-radius-pill`）+ **中缝直角**（0）；收藏 **独立胶囊**（`999px`） |
| 两档 | **日 / 夜几何逐值相等**；分档**只经颜色 token**（`T120`-f） |
| 落点 | 上述几何常量一律落**页面局部** `--sf-l-*`（`frontend/src/pages/item/item.css`，承 `T98`）；**`--sf-l-actionbar-h`(60px) 本单不动**（高度不由本单裁定） |

### 24.4 断言影响（现取 · 零计数常量前推）

| # | 断言 / 门 | 现取判据 | 本单影响 |
|---|---|---|---|
| A1 | `theme-tokens.test.js` · 逐键 PROV 回读 | `for (const key of TOKEN_KEYS)` 自动覆盖新增键 | **无需改断言**（新增两键自动进回读集；本单实测 **33 例全绿**，含 `theme-shell-isomorphism.test.jsx` 20 例） |
| A2 | `theme-tokens.test.js` · 键数下限 | `TOKEN_KEYS.length >= 100`（**下限、非等值**） | **不需要前推**（`110 → 112`） |
| A3 | `p6-btn-impl.test.js:85` · 键数下限 | `TOKEN_KEYS.length >= 106`（**下限、非等值**；注释「授权删 7 键 113→106」为历史留痕） | **不需要前推** |
| A4 | `p6-btn-impl2.test.js:127` | `BTN_VARS` 逐项 `toContain`（**集合包含、非等值**） | **不需要前推**（本单未动任何 `btna*` / `btnalt*` 键） |
| A5 | `theme-shell-isomorphism.test.jsx:240-250` · 「未登记 token」硬门 | `theme-tokens.css` 主题块内每个 `--sf-*` 必须落在 `TOKEN_KEYS` | 两键**已进 `TOKEN_KEYS`**（否则判负）⇒ 已过 |
| A6 | `theme-tokens.test.js` · 日/夜差异键数 | `changed.length > 90`（**下限**） | 两键日≠夜 ⇒ 变化键数 **+2**，下限不受影响 |
| A7 | `theme-tokens.test.js` · 值形态白名单 | 只允许 颜色 / none / transparent / inherit / 圆角 px / 阴影 / 渐变 | 两值均为 hex，键名分段（`cta`/`solid`/`bg`/`fg`）**不含几何属性词** ⇒ 通过 |
| A8 | 生成物一致性 | `theme-tokens.css` 逐键 = JS 值表 | **用仓内既有生成器重生成**（不手改）⇒ 通过 |

**★ 结论（写死）：本单不需要前推任何测试里的计数常量** —— 仓内所有 token 计数断言均为**下限/包含**式（A2 / A3 / A4），唯一等值断言是「两档键集与键序相同」（A1 / A5），由实现本身满足。**若下一单实现方要改这些数为等值式，须另裁。**

### 24.5 四处同动留痕（本单实测读数）

| 件 | 动作 | 读数（改前 ⇒ 改后） |
|---|---|---|
| ① 真源 `docs/design/style-preview.html` | **尾部纯追加** `<section id="item-actionbar-ref-v122">`（[ITEM-ACTIONBAR] 块，含 `background:#202020` / `color:#FFFFFF` / `background:#EDEFF2` / `color:#0A0A0A` 四片段，**PROV 逐字可回读**） | **1103 行 / 93,949 B / md5 `7b8780af15802102f9ddf578510490a5`** ⇒ **1172 行 / 102,653 B / md5 `a17919a495f4bd03bdf2434df8013753`**（`+69` 行 / `+8,704` B）；`git diff --numstat` = **`69 0`**（删除列 = **0**） |
| ② 值表 `frontend/src/theme/tokens.js` | `DAY` / `NIGHT` 各加 2 键（同索引 `107` / `108`）+ `PROV` 加 2 行 | `numstat` = **`12 0`**；`DAY` / `NIGHT` 键数 **110 ⇒ 112**，`orderEqual = true` |
| ③ PROV 指针 | `cta-solid-bg` = `{ d:[1130,'background:#202020'], n:[1133,'background:#EDEFF2'] }`；`cta-solid-fg` = `{ d:[1130,'color:#FFFFFF'], n:[1133,'color:#0A0A0A'] }` | 回读命中（`theme-tokens.test.js` 逐键过） |
| ④ 生成物 `frontend/src/theme/theme-tokens.css` | **用既有生成器重生成**（`backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`），**未手改**；先跑一次**零漂移自证**（`cmp` = 0 才使用） | 8,155 B ⇒ **8,275 B**；日/夜块各 **110 ⇒ 112** 声明；`numstat` = **`4 0`** |

**★ 未动面（自证）**：`frontend/src/pages/item/**` / `ItemDetailPage` / `shell.css` / `data-sf-region` 集合 / `--sf-l-actionbar-h` / `docs/design/style-preview.html` 的 1–1103 行 / `docs/design/design-system.spec.md` 的 §1–§23 —— **一字未改**（`git diff --numstat` 全文件删除列 = 0）。

### 24.6 挂账与待裁（不得自选）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | **「收藏」的数据承载 / 行为** | **`OPEN` · 挂账（另立单）** | 参考图有收藏胶囊，但**本站现取无收藏接口 / 无收藏表**（承 §22「无数据承载不渲染」的**同族风险**）。本单只冻**形态与颜色**；是否接后端收藏能力、或先渲染为**无后端动作的视觉按钮**（点按提示「暂未开放」一类），**须 Kevin / Zang 裁定，本单不自选**。 |
| 2 | 「聊一聊」图标为**聊天气泡**、收藏为**星形** | **已登记（`T120`-e）** | 图形件走 `currentColor`；**图标字体/资产来源另由实现单定**（本单不引入资产）。 |
| 3 | 操作栏**高度** | **不动（`--sf-l-actionbar-h` = 60px 保持）** | 组合条与收藏在既有高度内垂直居中；若实现单发现 44px 触控 + 60px 高度不够 ⇒ **另裁**（承 `T77` 触控 ≥44 的既有口径）。 |
| 4 | 占比之外的**精确 px 留白** | **留给实现单（≥1px 即满足 `T120`-c）** | 本册只冻结「留白 > 0」这一可判负口径与 58/42 占比；**不发明像素值**（承「先冻结口径、不冻结未裁定数值」）。 |

### 24.7 勘误记录：横向几何「目测 → 逐像素实测」（**勘误级不升版** · 2026-10-17）

**★ 一句话**：§24 此前的横向几何（`组合条内部 58% : 42%`）是**目测值**；本节据**列主类逐像素实测**校正为 **`50% : 50%`** 与 **组合条 `72.8%` / 留白 `4.6%` / 收藏 `22.6%`**（均相对按钮行可用宽）。**旧字面逐字保留在本表「作废」列，一律不作口径。**

**★ 实测来源与读数口径（取证可复算）**

| 项 | 取值 |
|---|---|
| 原图真身 | `ops/item-actionbar-20261017/ref/goofish-ref.png` · **1128×170** · sha256 `308e2b62c45a2b3c3868d4783a93b19e2308523bb2cc5cece5b8bec4265485cd`（**只读、未改图**） |
| 取色分类 | 图内只有 4 个主类色：**白 `#FFFFFF`（页底 / 留白）** · **黄 `rgb(255,233,44)` = `#FFE92C`（聊一聊）** · **墨 `rgb(59,59,59)` = `#3B3B3B`（立即购买）** · **浅底 `rgb(246,246,246)` = `#F6F6F6`（收藏）** |
| 方法（**避开文字噪声**） | 逐列取色 ⇒ 归入上述 4 个**列主类** ⇒ 以**无文字行 `y=55`** 判横向分界（该行只有纯色块、无字形笔画）；纵向另以 `x=100 / 600 / 960` 三列扫描。**未使用目测、未使用缩略图预读** |
| 可用宽（分母） | `1128 − 32 × 2 =` **`1064px`**（左右白边各 32px = 2.8%） |
| 横向像素区间 | 白边左 `0..31` · **黄（聊一聊）`32..419` = 388px** · **墨（立即购买）`420..806` = 387px** · **留白 `807..855` = 49px** · **收藏 `856..1095` = 240px** · 白边右 `1096..1127`。**合计 `388 + 387 + 49 + 240 = 1064` ✔**（`806` / `1096` 各为 1px 抗锯齿过渡边，按主类归并） |
| 纵向（**仅供参考，不作口径**） | 条高 `y=34..133` = **100px**，两端全圆角（半径 = 高 / 2）。**该图为放大示意 ⇒ 高度不进本站口径**；高度仍按 `--sf-l-actionbar-h` = 60px（§24.6 第 3 项，本单不动） |

**★ 逐项校正表（旧值保留引用 · 不作口径）**

| # | 项 | **旧值（作废 · 历史留痕，逐字保留）** | **现行口径（以此列为准）** | 实测算式 |
|---|---|---|---|---|
| 1 | 组合条内部占比 | `聊一聊 58% / 立即购买 42%`（即 `58% : 42%`） | **`聊一聊 50%` : `立即购买 50%`** | `388 ÷ 775 = 50.1%` · `387 ÷ 775 = 49.9%` ⇒ **50:50** |
| 2 | 组合条宽（÷ 可用宽） | 未登记（上一单只写「组合条」，未给相对宽） | **`72.8%`** | `775 ÷ 1064 = 72.84%` |
| 3 | 组合条 ↔ 收藏 留白 | 未登记定量（只写「**留白 > 0**」） | **`4.6%`**（且仍 `> 0`，`T120`-c 判据不变） | `49 ÷ 1064 = 4.61%` |
| 4 | 收藏胶囊宽（÷ 可用宽） | 未登记 | **`22.6%`** | `240 ÷ 1064 = 22.56%` |
| — | 三段和 | 无（旧口径只有两段） | **`100.0%`** | `72.84 + 4.61 + 22.56 = 100.01` ⇒ 舍入 **100.0%** ✔ |

**★ 旧字面在文档内的落点（逐字保留 · 均不作口径 · 只认本节与 §24.1-b / `T120`-i / §24.3）**

| 落点 | 旧字面 | 状态 |
|---|---|---|
| 版本头 **v1.22 行**（第 23 行） | `组合条内部占比 聊一聊 58% / 立即购买 42%` | **已被本版勘误行（第 24 行）取代** |
| **§12 表 v1.22 行** | `组合条内部占比 聊一聊 58% / 立即购买 42%` | **版本日志留痕**（本次勘误级不升版 ⇒ 不新增/不改日志行） |
| **§24.6 第 4 项** | `与 58/42 占比` | **该表述作废**；现行见 §24.3 与本节 #1 / `T120`-i |
| **§24.1-b** / **§24.3** | 原 `58% : 42%` / `58% / 42%` | **已就地更正为 50:50**，旧字面转入本表「作废」列 |

**★ 不变面（写死，防连带误改）**：`T120`-a（三段结构）/ -c（留白 > 0）/ -d（两端半圆 + 中缝直角）/ -e（图标）/ -f（两档几何逐值相等）/ -g（颜色映射）/ -h（仅 2 个新 token）与 §24.2 的两键值 **一字未改**；容差 **±1 个百分点** 不变；几何数值仍**不进主题层 / 不进 `STRUCT`**（落页面局部 `--sf-l-*`，承 `T98`）。

**★ 删除行说明（本单 delta · 对改前工作区 `git diff` = 新增 70 行 / 删除 2 行 · 逐行交代）**

| # | 被删（= 被就地更正）的原文行 | 替换后 | 为什么必须改这一行 |
|---|---|---|---|
| 1 | §24.1-b 首句「`聊一聊` : `立即购买` = **58% : 42%**（…）」 | 「= **50% : 50%**（…）+ ★ 勘误注（以 50:50 为准 · 指向 §24.7）」 | 这是**唯一带判负项的强制条文**；不改 ⇒ 验收会按错值判负 / 放行 |
| 2 | §24.3「组合条内部占比 \| `聊一聊` **58%** / `立即购买` **42%**（…）」 | 「`聊一聊` **50%** / `立即购买` **50%**（…以 50:50 为准 · 旧字面见 §24.7）」 | 这是**几何口径表**（实现单直接抄这张表）；不改 ⇒ 实现层照抄错值 |

> 其余改动**全为追加**（版本头勘误行 1 行 · §24.0 版本内勘误注 2 行 · `T120`-i 1 行 · §24.3 三段占比 1 行 · §24.7 / §24.8 整节）：**§1–§24.6 其余正文一字未动**。

### 24.8 已知色差登记（本站 vs 参考图 · **显式登记，不作隐性偏差**）

**★ 口径**：颜色**不按参考图逐字取值**，按**站内 token 家族一致**（不引入第二套墨色 / 第二套黄 / 第二套浅底）⇒ 与参考图之间存在**已知、已登记**色差。下表逐元素写真；每条给 **「一句话可改」**（复刻参考图只需改既有键值，零几何 / 零结构）。

| 元素 | 参考图取样（逐像素） | 本站现取 | 差 | 不照抄的理由 | 一句话可改 |
|---|---|---|---|---|---|
| **立即购买 底** | `rgb(59,59,59)` = **`#3B3B3B`** | `--sf-cta-solid-bg` 日档 **`#202020`** | 明度更低（`#3B3B3B` 更浅一档） | 取站点**既有 ink 家族 `--sf-btna-fg` 同值** ⇒ **不引入第二套墨色**（两套墨会让「立即购买」与站内其它深面不成族，且 §24.2 已按此冻结） | 把 `--sf-cta-solid-bg` **日档**改 `#3B3B3B` 即复刻（**1 个值**） |
| **聊一聊 底（黄）** | `rgb(255,233,44)` = **`#FFE92C`** | `--sf-btna-bg` **`#FFE60F`** | 极近同族黄（`ΔG = −3` / `ΔB = −29`） | `--sf-btna-bg` = **全站主黄**（与顶栏实黄 `T114` 同族）⇒ **不引入第二套黄** | 把 `--sf-btna-bg` 改 `#FFE92C` 即复刻（**1 个值**，但影响全体 `btna` 面 ⇒ 须全站复验） |
| **收藏 底** | `rgb(246,246,246)` = **`#F6F6F6`**（**无描边**，靠浅底与白页底拉开） | `--sf-btnalt-bg` **`#FFFFFF`** + `--sf-btnalt-border` **`#E0E0E0`**（1px 描边） | 底更白 + 多 1px 描边 | 复用 `btnalt` 家族（`T120`-g）；`#F6F6F6` 落在白页底上对比度仅 ≈ `1.07:1` ⇒ 本站以**描边补边界**（语义等价「可辨边界」，手段不同） | 把 `--sf-btnalt-bg` 改 `#F6F6F6` 且 `--sf-btnalt-border` 改 `transparent` 即复刻（**2 个值**，影响全体 `btnalt` 面） |
| 立即购买 字 | `rgb(255,255,255)` = `#FFFFFF` | `--sf-cta-solid-fg` 日档 `#FFFFFF` | **零** | — | 无需改 |
| 聊一聊 字 / 图标 | `rgb(32,32,32)` = `#202020` | `--sf-btna-fg` `#202020` | **零** | — | 无需改 |
| 收藏 字 | `rgb(32,32,32)` = `#202020` | `--sf-btnalt-fg` 日档 `#202020` | **零** | — | 无需改 |
| 操作栏 底 | `rgb(255,255,255)` = `#FFFFFF` | `--sf-surface-bg` 日档 `#FFFFFF` | **零** | — | 无需改 |

**★ 夜档不在本表范围**：参考图只有亮底一档；夜档（`#EDEFF2` 底 / `#0A0A0A` 字）是**本站自定反相**（§24.2 理由：夜档深页上深底会消失）⇒ **无参考图对应值可比**，故不登记色差，也**不许**「为对齐参考图」把夜档改回深底。

**★ 判负（写死）**：实现单**不得**为逼近参考图新增任何 token、也不得在页面里**硬编码**上表参考色（如 `background:#3B3B3B` / `#FFE92C` / `#F6F6F6`）；**若 Kevin 要复刻，只能按「一句话可改」列改 1–2 个既有键的值**，且**改值须另立单 + 全站复验**。

---

## §25 ★★ v1.24 · **宽度与列数**：容器最大宽 `1536px` · `≥1280px` ⇒ **6 列** · `768–1279` ⇒ 4 列 · 夜档列数 `3 ⇒ 4` 统一 · 规则 **`T121`**（**本节只追加 · §1–§24 一字未动** · 依据 = **Kevin 2026-10-19 两项口径**（逐字见 §25.0）· **本笔零代码：契约冻结、实现待发**）

### 25.0 依据与口径（先记住三条）

**Kevin 2026-10-19 逐字两条**：

> ① 「**web 版 UI 要保证每行 6 条商品（目前 4 条）**。」
> ② 「**容器最大宽 1536px**。」

**问答结论（必须留痕，防再次反复）**：Kevin 会上一度以「约 **1500** 像素」描述容器宽（§22.11 `Q1` 原话「约 1500 像素固定宽度」）。今日当面说明 **「1500 不是标准宽度」** ⇒ **`1500` 退出候选值**，取 **`1536px`**（= 1280 断点族上沿 `1280 + 256`，属「标准宽度」序列：`1024 / 1280 / 1536 / 1920`）。

**与既有裁定的关系**：§22.11 `Q8`「已裁 = 不动 · 保持 `1440px` · 若日后要真 `1500px` 须另立单」**字面逐字保留**，其后已追加 **`Q8 ❗ 指针（v1.24）`** 行 ⇒ 现行口径 = **`1536px`**（本节）。**这属于「另立单」的兑现**，不是静默改写。

**实现状态**：**笔 2（宽度与列数）尚未派单** ⇒ 本节 = **契约冻结**；`tokens.js` / `theme-tokens.css` / `style-preview.html` / `styles.css` **本笔一字未动**（归实现单）。

### 25.1 `T121` 条文（三款 · 写死）

| 款 | 条文 | 落点（实现单必须按此） |
|---|---|---|
| **a. 容器宽** | **`--sf-st-shell-max-w` = `1536px`**（日 / 夜同值，结构常量、**不进主题层**） | `tokens.js` `STRUCT['shell-max-w']`（现 `'1440px'` `:410`）⇒ `'1536px'`；`theme-tokens.css` 生成物同步（`:17`） |
| **b. 列数** | **视口 `≥1280px` ⇒ `.sf-grid` 6 列**；**`768–1279px` ⇒ 4 列**（不变）；**`<768px` ⇒ 手机档不变**（现 d `2` / n `1`） | **6 列规则落 `frontend/src/styles.css` 顶层 `@media (min-width:1280px)`**（只覆盖 `.sf-grid` 的 `grid-template-columns`；**`shell.css` 不得新增 `@media`**）；4 列 / 手机档沿用 `shell.css:60` / `:200` **一字不动** |
| **c. 夜档** | **`feed-cols` 夜档 `3 ⇒ 4`**（与日档一致）⇒ 「**列数不进主题层**」 | 真源夜档行改 4 列 + `STRUCT_PROV['feed-cols'].n` **重指新行**；**`STRUCT['feed-cols']` 值不变（`'4'`）** |

**为什么 6 列规则不能进 `shell.css`（硬理由，不是偏好）**：`theme-shell-isomorphism.test.jsx:216-230` 断言 `shell.css` **只有一个 `@media`**（`medias.length === 1`，且必须含 `767px`），并断言宽屏块含 `repeat(var(--sf-st-feed-cols), minmax(0, 1fr))`、手机块含 `repeat(var(--sf-st-feed-cols-m), minmax(0, 1fr))`。把 1280 块塞进 `shell.css` ⇒ **该断言必红**；改断言 = **动冻结面**（判负 #4）。**先例**：§14 桌面 gutter（裁定⑨/⑩，虽已于 v1.9 撤销）当时即裁「断点规则落 `styles.css`、`shell.css` 一字不动」⇒ 本版**同法**。

### 25.2 列数断点表（逐档 · 现取）

| 视口 | 列数 | 生效落点 | 现取状态 |
|---|---|---|---|
| `≥1280px` | **6** | `src/styles.css` 顶层 `@media (min-width:1280px){ .sf-grid{ grid-template-columns: repeat(var(--sf-st-feed-cols-xl), minmax(0, 1fr)) } }` | **待实现**（现 = 4 列 ⇒ 本版是**新增一档**） |
| `768–1279px` | **4** | `shell.css:60`（默认块，`repeat(var(--sf-st-feed-cols), …)`） | **已符合、一字不动**（现取 `@media` 计数 `1`，默认块即宽屏块） |
| `<768px` | **不变** | `shell.css:200`（唯一 `767` 块，`repeat(var(--sf-st-feed-cols-m), …)`） | **不变**；现 d `2` / n `1` ⇒ **是否也调 `2/2` 待 Kevin**（`OPEN-ITEMS` **`B38`**） |

- **与 36 条首屏整除关系（顺带校验，非新约束）**：`36 % 6 = 0`、`36 % 4 = 0` ⇒ 首屏在 6 列档 = **6 行整**、4 列档 = **9 行整**，**无半行空洞**（`route-layer.spec` §49.8 的 `PAGE_SIZE = 36` 由 §25 反推与此一致）。
- **`1280` 这个数字不是新造**：§3 已有建议常量 `--sea-bp-pc-side-min: 1280px`（「≥1280 才显示 320px 侧栏」）⇒ 本版**复用同界**，不新增第二个宽屏断点。

### 25.3 夜档列数统一（`3 ⇒ 4`）—— 现状是一处**真矛盾**，本版即修

**现取事实（必须如实记）**：

- `STRUCT['feed-cols'] = '4'`（`tokens.js:411`）是**单一值**，生成物 `theme-tokens.css:18` 只有一份 `--sf-st-feed-cols: 4`（`:root` 内、**日/夜不分支**）⇒ **应用层日档与夜档实际都是 4 列**。
- 但 `STRUCT_PROV['feed-cols']` 的两档指针**不一致**：`d: [115,'grid-template-columns:repeat(4,minmax(0,1fr))']` / **`n: [291,'grid-template-columns:repeat(3,minmax(0,1fr))']`**（`tokens.js:455`）—— 真源夜档 `style-preview.html:291` 的 `.vstage-b .feed` 写的是 **3 列**。
- ⇒ **真源夜档（3 列）与值表 / 应用实渲（4 列）不一致**；`EXCLUDED_FROM_THEME` 该行 `why` 早已写明「**栅格列数属断点层（本单要求横竖屏也不得按主题变）**」—— 现盘等于**留着一条反例**。

**本版口径（写死）**：**夜档 = 4 列**（与日档一致）；真源追加块内新写一行 `.vstage-b .feed{grid-template-columns:repeat(4,minmax(0,1fr))}`，`STRUCT_PROV['feed-cols'].n` **重指该新行**；**旧 `:291` 行不删**（历史留痕，且其它键 `feed-gap.n` 仍指 `:291`）。**判负**：夜档任一档位实渲列数 ≠ 日档同日同档位 ⇒ 判负。

### 25.4 落点约束（三条禁令）

1. **`frontend/src/shell/shell.css` 不得新增任何 `@media` 块**（现取 `grep -c '@media' shell.css = 1`，唯一块 = `:185` `@media (max-width: 767px)`）⇒ 6 列规则**只能**落 `src/styles.css`。
2. **`styles.css` 的 1280 块只许覆盖 `.sf-grid` 的 `grid-template-columns`**（不得顺手改 `gap` / `padding` / `max-width`；容器宽走 token，不在这里硬编码 `1536px`）。
3. **不得手改 `theme-tokens.css`**（头注「生成物，勿手改」）：必须用既有生成器 `backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`，**先跑一次零漂移自证（`cmp = 0`）**再生成。

**顺带现取（省实现方一轮排查）**：`styles.css:69` 的 `@source inline("… md:grid-cols-6 … xl:grid-cols-6 …")` **已把 `grid-cols-6` 系列列入 Tailwind 安全列白名单** ⇒ 若实现选「工具类」路线**无需补 safelist**；但**口径仍以 `var(--sf-st-feed-cols-xl)` 为准**（token 层是唯一真源，直接写 `repeat(6, …)` 会与 `STRUCT_PROV` 溯源门脱钩）。

### 25.5 三件同步链（token / PROV / 生成物 · 缺一即判负）

| 键 | `tokens.js` 现值 | 目标值 | `STRUCT_PROV` 现指 | 目标指针 |
|---|---|---|---|---|
| `shell-max-w` | `'1440px'`（`:410`） | **`'1536px'`** | `d/n: [85,'max-width:1440px']`（`:454`） | `d/n: [<新行>,'max-width:1536px']` |
| `feed-cols` | `'4'`（`:411`） | **`'4'`（值不变）** | `d: [115,'…repeat(4,…)']` / **`n: [291,'…repeat(3,…)']`**（`:455`） | `d` 不变 / **`n: [<新行>,'grid-template-columns:repeat(4,minmax(0,1fr))']`** |
| **`feed-cols-xl`** | **（无此键）** | **`'6'`（新键）** | — | `d/n: [<新行>,'grid-template-columns:repeat(6,minmax(0,1fr))']` |
| `feed-cols-m` | `'2'`（`:412`） | `'2'`（不变） | `d: [116,…]` / `n: [328,'…minmax(0,1fr)']`（`:456`） | **不动**（`B38` 待裁） |

**真源追加块（`docs/design/style-preview.html`）要求**（现取 **1172 行 / 102,653 B / md5 `a17919a495f4bd03bdf2434df8013753`**）：

- **尾部纯追加** `<section id="layout-width-ref-v124">`，**必须含三行可回读字面**（`theme-tokens.test.js:132-140` 的 `verify` 机制 = 「按行号取该行原文 + 断言含 needle」）：
  1. `max-width:1536px`（容器 / 顶栏内层）
  2. `grid-template-columns:repeat(6,minmax(0,1fr))`（该行须自带 `@media (min-width:1280px)` 语境，可用注释行说明、但 **needle 必须逐字出现**）
  3. 夜档 `.vstage-b .feed{grid-template-columns:repeat(4,minmax(0,1fr))}`
- **旧行一律不删**：`:85` `.tb-inner{…max-width:1440px…}`、`:112` `.layout{…max-width:1440px…}`、`:291` `.vstage-b .feed{…repeat(3,…)}` **逐字保留**（历史 + `feed-gap.n` 仍指 `:291`）⇒ 真源 `numstat` **删除列 = 0**。
- **`theme-tokens.css` 重生成**：预期改动 = `:17` 值 `1440px ⇒ 1536px` + **新增 `--sf-st-feed-cols-xl: 6;`**（`STRUCT` 新增一键 ⇒ 生成物 +1 行）；**不得手改**。

### 25.6 旧条款指针（**涉宽度 / 列数的旧条文一律不删，指针在此**）

| 旧条款 | 现取内容 | 与本版关系 |
|---|---|---|
| §22.11 **`Q8`** | 「已裁 = 不动 · `1440px` 保持」（`design-system.spec` 该行） | **已被本节取代**；原行后已追加 **`Q8 ❗ 指针（v1.24）`** 行（**原行一字未删**） |
| §14 **`T85`** | 悬浮菜单几何（宽 `72` / 单元高 `92` / 图标 `26` / 字号 `12` / 右距 `16` / `top:45%`）+ 六档 × 多页**零横向溢出** | **判据不变、不降级**；容器变宽后**须复跑**六档（`768`/`1024`/`1280`/`1440`/`1600`/`1920`）× 三页 `scrollWidth == clientWidth`（见 §25.7 #7） |
| §21 **`T106`** | 消息面板几何（`600` / `104` / `704` / `240` / `360`）+ 「零断点值新增」 | **不动**（面板 = `position:fixed` 浮层，与容器最大宽解耦；`≥1280` 时容器 1536 不改变面板宽度） |
| §24 **`T120`** | 操作栏三段比例口径 | **不动**（与本版无交集） |
| `EXCLUDED_FROM_THEME` 的 `feed-cols` 行 | `what` = 信息流列数与间距；`why` = 「栅格列数属断点层（横竖屏也不得按主题变）」 | **本版即执行该 `why`**（§25.3 夜档 `3 ⇒ 4`）；登记行**文字不动** |
| §3 `--sea-bp-pc-side-min` | `1280px`（「≥1280 才显示 320px 侧栏」，册内建议 · 一句话可改） | **同界复用、不冲突**（同一断点：侧栏在 + 6 列） |

### 25.7 判负 / AC（8 条 · 质检必带）

| # | 探针 | 期望 | 判负 |
|---|---|---|---|
| 1 | 视口 **1280 / 1440 / 1600 / 1920** 四档取**首页信息流网格节点**的 `grid-template-columns` 计算值（节点 = `.sf-grid`；若实现改为 `[data-sf-m="feed-grid"]` 见 §25.10） | 拆出 **6** 条轨道 | 任一档 ≠ 6 ⇒ **判负** |
| 2 | 视口 **768 / 1024** 两档 | **4** 条轨道 | ≠ 4 ⇒ 判负（回归） |
| 3 | 视口 **390 / 375 / 320** 日档 | **2** 条轨道（手机档不变） | ≠ 2 ⇒ 判负 |
| 4 | **夜档**同档位列数 vs 日档 | **逐档相等**（含 `≥1280` 的 6） | 任一档不等 ⇒ **判负**（列数按主题变 = 违 `EXCLUDED_FROM_THEME` 的 `why`） |
| 5 | `.sf-route-container` 计算 `max-width`（1440 / 1600 两档） | **`1536px`** | ≠ 1536 ⇒ 判负；`≤767` 仍满宽（原口径不变） |
| 6 | `grep -c '@media' frontend/src/shell/shell.css` | **`1`**（且仍 = `max-width:767px`） | 出现第 2 个 `@media` ⇒ **判负**（§25.4 禁令 ①） |
| 7 | 六档（`768`…`1920`）× 三页（`/`、`/item`、`/exchange`） | `scrollWidth == clientWidth`（零横向溢出） | 任一溢出 ⇒ 判负（`T85` 判据不降级） |
| 8 | `theme-tokens.test.js` 的 PROV 回读 + 生成物一致性 | 全绿；`--sf-st-shell-max-w: 1536px` 与 `--sf-st-feed-cols-xl: 6` 均在 `theme-tokens.css` | PROV 指不到 / 生成物手改 / 键缺失 ⇒ **判负** |

### 25.8 现取自证（编制时点 · 2026-10-19）

| 项 | 读数 |
|---|---|
| `STRUCT['shell-max-w']` | `'1440px'`（`tokens.js:410`） |
| `STRUCT['feed-cols']` / `['feed-cols-m']` | `'4'` / `'2'`（`:411` / `:412`） |
| `STRUCT_PROV` 三行 | `shell-max-w` `d/n [85,…1440px]` · `feed-cols` `d [115,…4]` / `n [291,…3]` · `feed-cols-m` `d [116,…2]` / `n [328,…1]`（`:454-456`） |
| 生成物 | `theme-tokens.css:17-19` = `1440px` / `4` / `2`（**日/夜同值、单份**） |
| `shell.css` 断点 | `@media` **1** 块（`:185` `max-width: 767px`）；宽屏 `.sf-grid` = `shell.css:60`；手机档 = `:200`；`max-width` 仅 `:29` 一处 |
| `styles.css` | **无** `min-width:1280` 块（本版为新增）；`:69` `@source inline(...)` 已含 `md/lg/xl:grid-cols-6` |
| 真源 | `style-preview.html` **1172 行 / 102,653 B / md5 `a17919a4…013753`**；`max-width:1440px` 命中 `:85` / `:112`；夜档 3 列 = `:291` |
| 本笔改动 | 只写 `docs/**` + `ops/feed-6col/SPEC-NOTE.md`；**未动 `frontend/**` / `docs/design/style-preview.html`** |

### 25.9 未做 / 诚实边界

- **本节只冻结契约**：`tokens.js` / `theme-tokens.css` / `style-preview.html` / `styles.css` **本笔零改动**（实现归笔 2，**尚未派单**）；§25.7 的八条 AC **一条未跑**（无浏览器几何读数）。
- **手机档列数未定**：现 d `2` / n `1`，是否统一 `2/2` ⇒ **待 Kevin**（`OPEN-ITEMS` `B38`）；本版**不动**。
- **`1536px` 的作用域** = `.sf-route-container`（`shell.css:29`，全站唯一 `max-width` 声明）；若将来出现第二个容器（如后台台面单独定宽）**须另立单**，本节不预设。
- **6 列在 1280 档的观感未验**：容器 1536 时 `≥1280` 视口下 6 列卡宽 ≈ `(min(视口,1536) − 2×20 − 侧栏/间距) / 6`；**1280 档是否偏窄属观感**，读数由实现单 / 质检单采（本笔不预设「观感合格」）。

### 25.10 ★ 实现面观察与冲突登记（2026-10-19 编制时点现取 · **待 Zang 裁定 · 本笔不改契约**）

**观察到的事实**（工作区未提交面，属**笔 1** 在跑，非本笔写面）：

- 首页商品网格已由 `<div className="sf-grid">` 改为 **`<ResponsiveGrid sm={1} md={2} lg={4} gap={6} data-sf-m="feed-grid">`**（`frontend/src/pages/HomePage.jsx:446` 编制时点现取），并给 `ResponsiveGrid` 补了 `...rest` 透传（`frontend/src/components/ui/Responsive.jsx`）。
- `ResponsiveGrid` 的档位映射 = **Tailwind 类名**：`grid-cols-{sm}` + `md:`（≥768）+ `lg:`（≥1024）+ `xl:`（**≥1280**）⇒ 若要 6 列，实现路径应是 **`xl={6}`**（`gridClasses` 已含 `6: 'grid-cols-6'`），**而非** `styles.css` 的 `@media (min-width:1280px)` + `var(--sf-st-feed-cols-xl)`。
- **`.sf-grid` 现取只剩一个消费者** = `frontend/src/pages/ThemePreviewPage.jsx:147`（首页已不用）⇒ **§25.2 那条「6 列规则落 `styles.css` 覆盖 `.sf-grid`」对首页不生效**。
- 有利现取：`frontend/src/styles.css:69` 的 `@source inline(...)` **已含 `xl:grid-cols-6`** ⇒ 走 `xl={6}` 路线**无需补 safelist**。

**两条对齐路径（不得由实现方自选，须 Zang 裁定）**：

| 路径 | 做法 | 代价 / 风险 |
|---|---|---|
| **(A) 回到 token 路径**（本节原文口径） | 首页网格恢复 `.sf-grid`（或 1280 块同时命中 `[data-sf-m="feed-grid"]`）+ `var(--sf-st-feed-cols-xl)` | 与笔 1 已落的分页改造**同批回退网格节点** ⇒ 需重跑首页用例；但 `STRUCT_PROV` 溯源门完整、`xl` 值可回读真源 |
| **(B) 保留 `ResponsiveGrid` + `xl={6}`** | 只改一行 prop；`styles.css` 不需 1280 块 | **与 `STRUCT_PROV` / token 层脱钩**（列数不再由结构常量驱动）⇒ 若选此路，`feed-cols-xl` 键**不必新增**，且 §25.5 的「三件链」需同步缩为「`shell-max-w` 两件 + 夜档 `feed-cols.n` 重指」；本册须出勘误级追补 |

**本笔处置**：**契约按原文冻结（A 路径为默认）**，同时把冲突**登记在此**（不沉默、不擅自改判）。**质检注意**：§25.7 #1 的探针按「**首页信息流网格实际节点**」取（`.sf-grid` 或 `[data-sf-m="feed-grid"]`），**以计算列数为准**，不以选择器名判负。

### 25.11 裁定与落地（2026-10-19 收口 · **路径 A 已采** · `ResponsiveGrid` 不入首页网格 · `B39` 另立单 · 同 v1.24 契约的**实现面回写、不升版**）

> **本节性质**：§25.10 的两条「待 Zang 裁定」**已裁死**（见 A），并把 `T121` 的**落地读数**回写（见 B–D）。**§25.0–§25.10 一字未改**；契约仍以 **v1.24** 为准，本节只补「已实现并上线」的事实与差。实现 = `10ef6b1`；质检 = `f97252d`（6/6 PASS）；上线 = push `b10f3d6..f97252d`；生产终验 = `0d8d15f`。

#### 25.11.1 两条裁定（Zang · 2026-10-19 · 落死）

| # | 待裁项（§25.10） | 裁定 | 依据 / 后果 |
|---|---|---|---|
| ① | 6 列落地走 **(A) token 路径** 还是 **(B) `ResponsiveGrid` + `xl={6}`** | **裁 A = CSS 断点驱动** | 首页商品网格**回 `.sf-grid sf-feed`**（`data-sf-m="feed-grid"` 钩子保留、卡数判据不变），`≥1280` 6 列落 `frontend/src/styles.css` **顶层** `@media (min-width:1280px)`。**否决 B 的硬理由** = `ResponsiveGrid` 走 `useBreakpoint()` 的 `window.innerWidth` + `resize` 监听（`components/ui/Responsive.jsx:4-22`）⇒ 列数由 **JS 宽度读数**驱动，违「断点只在 CSS」；且 B 会把列数与 `STRUCT_PROV` 溯源链脱钩（列数不可再回读真源） |
| ② | `ResponsiveGrid` 组件（`window.innerWidth` 分支）如何处置 | **本批不动 ⇒ `OPEN-ITEMS` `B39` 另立单**（「把该组件断点回 CSS」） | 现取 **9 处** `<ResponsiveGrid` 调用点：`HomePage.jsx:401`（任务区）、`TaskPage.jsx` 4 处、`DashboardPage.jsx` 2 处、`ProfilePage.jsx` 2 处 ⇒ 改动面 = 任务区 / 工作台 / 个人页**三处布局**，须单独质检 + 观感验收，**不并入本批**。**首页商品网格已零 `ResponsiveGrid`**（现取 `grep` 0） |

#### 25.11.2 落地读数（现取 · 文件:行）

| 键 / 落点 | 现行值（现取） | 与 §25.5 目标对齐 |
|---|---|---|
| `STRUCT['shell-max-w']` | `'1536px'`（`tokens.js:412`） | ✅ 目标 `1536px` |
| `STRUCT_PROV['shell-max-w']` | `{ d: [1180,'max-width:1536px'], n: [1180,'max-width:1536px'] }`（`:456`）⇒ **两档同指 `:1180`** | ✅（v1.24 写「d/n 新行」，实为两档共用 `:1180` 一行） |
| `STRUCT['feed-cols']` | `'4'`（`:413`，**值不变**） | ✅ |
| `STRUCT_PROV['feed-cols'].n` | `[1182,'grid-template-columns:repeat(4,minmax(0,1fr))']`（`:457`）⇒ 由 `:291`(3 列) 重指 `:1182`(4 列) | ✅ 夜档 3⇒4 |
| **`feed-cols-xl`** | **（无此键 · 未新增）** | ⚠️ **差**（见 §25.11.3） |
| `STRUCT['feed-cols-m']` | `'2'`（`:414`）· PROV `d:[116]` / `n:[328]`（`:458`） | ✅ 不动（`B38` 待裁） |
| 生成物 `theme-tokens.css` | `:17` `--sf-st-shell-max-w: 1536px` / `:18` `feed-cols: 4` / `:19` `feed-cols-m: 2`（生成器重生成，**仅 `:17` 一行变**） | ✅ 三件同步 |
| 六列规则 | `frontend/src/styles.css:23-27` 顶层 `@media (min-width: 1280px){ .sf-feed{ grid-template-columns: repeat(6, minmax(0,1fr)) } }` | ✅ 落点合规 |
| 首页网格节点 | `HomePage.jsx:451` `<div className="sf-grid sf-feed" data-sf-m="feed-grid">` | — |
| 真源 | `style-preview.html` 尾段纯追加 `<section id="layout-width-ref-v124">`（`:1177` 起）；`max-width:1536px` `:1180` · 夜档 `repeat(4,…)` `:1182` · `@media (min-width:1280px){.sf-feed{…repeat(6,…)}}` `:1184`；现 **1186 行 / 104,094 B / md5 `25b6304afbb8d87f165d7cca7a600d0b`**；旧 `:85` / `:112` / `:291` **一字未删** | ✅ 删除列 0 |
| `shell.css` | `@media` **仍 1 块**（`:185` `max-width: 767px`）；本版**未动** | ✅ §25.1 硬禁令成立 |

#### 25.11.3 ★ 落地差（必须披露 · 不是缺陷，是裁定后果）

- **`feed-cols-xl` 未入 `STRUCT`**：§25.5 原表把 `feed-cols-xl: '6'` 列为「新键 + 新 PROV 指针」，而裁定文字（§25.11.1 ①）为「**≥1280 的 6 列由 `styles.css` 顶层规则统一覆盖**」⇒ **6 列 = 断点层字面值，不进 token 层**。因此：`STRUCT` **无新键**、生成物**无新行**、§25.5 的「三件链」实际收为**两件**（`shell-max-w` 值 + `feed-cols.n` 重指）+ 生成物同步。
- **真源 `:1184`（6 列行）现无 `PROV` 指针引用**：该行存在于真源（可回读字面），但**无 token 键指向它** ⇒ 追源门**不覆盖**该行；现行「6 列」的真源保证 = **`styles.css:23-27` 的字面规则**（不是 token）。若日后要求「列数也进 token 层（可配置 / 可回读）」，须**另立单**（不在 `B39` 范围）；本节不预设。
- **§25.1 b 的选择器写 `.sf-grid`，实现为 `.sf-grid` 基础 4 列 + `.sf-feed` 6 列修饰类** —— 现取仓内并无「`.sf-feed` 由 token 驱动」的规则（`shell.css:58-62` 的选择器是 **`.sf-grid`**），故实现取「基础类给 4 列（token）+ 修饰类给 ≥1280 的 6 列」。**这是作用域收紧**（`ThemePreviewPage.jsx:147` 的 `.sf-grid` 窄容器演示**不被 6 列规则波及**），不是放开；契约文字「6 列落 `styles.css` 覆盖 `.sf-grid`」的**意图**（首页 6 列、`shell.css` 零新增断点）**已满足**。

#### 25.11.4 `T121` 条文 → 实现（逐款回写）

| 款 | 条文（§25.1） | 落地（现取） | 判定 |
|---|---|---|---|
| **a. 容器宽** | `--sf-st-shell-max-w = 1536px`（日/夜同值、结构常量、不进主题层） | `tokens.js:412` `'1536px'` + PROV `d/n [1180]` + 生成物 `theme-tokens.css:17` = `1536px`；`--sf-st-shell-max-w` computed 全档 **1536px** | ✅ 达标 |
| **b. 列数** | `≥1280 ⇒ 6` · `768–1279 ⇒ 4`（不变）· `<768` 不变；6 列落 `styles.css` 顶层 `@media`；`shell.css` 不得新增 `@media` | `styles.css:23-27` 六列；4 列沿用 `shell.css:60`（token `feed-cols: 4`）；手机档 `shell.css:200`（`feed-cols-m: 2`）；`shell.css` `@media` 计数 **1**（未动） | ✅ 达标（选择器见 §25.11.3 第三点） |
| **c. 夜档** | `feed-cols` 夜档 `3 ⇒ 4`；值不变；PROV `.n` 重指新行 | 值 `'4'` 不变；`STRUCT_PROV['feed-cols'].n` `[291]`（3 列）⇒ **`[1182]`**（4 列）；真源 `:291` 旧行不删 | ✅ 达标 |

- **计算列数读数（质检 · 真浏览器 12 行 × 日/夜两档）** = **390 → 2** · **1024 → 4** · **1280 → 6** · **1440 → 6** · **1536 → 6** · **1920 → 6**，**日/夜逐档相等**；网格类 = `sf-grid sf-feed`，`HomePage` 零 `innerWidth` / `matchMedia` 读数。
- **容器读数** = 1920 档 `.sf-route-container` 实宽 **1536**、`left=192`（居中）；12 行 `scrollWidth − clientWidth = 0`；单卡宽 1536 档 **225.33**（= `(1536 − 2×20 − 2×32 − 5×16) / 6`：容器 20px×2 + `ResponsiveContainer` `lg:px-8` 32px×2 后可用 1432，减 5 道 16px 间距再 ÷ 6；属既有内缩，非新增）。
- **门套** = `theme-tokens` + `theme-shell-isomorphism` 2 文件 **33 例**绿（含「生成物与 `STRUCT` 一致」与「`shell.css` 唯一 767 块」双边断言）· `build` exit 0 · `test:unit` **61 文件 / 583 例**。
- **生产** = 同版 sha256 逐字 + CSS marker 3/3（`min-width:1280px` / `repeat(6,minmax(0,1fr))` / `--sf-st-shell-max-w:1536px`）+ 五档列数 **4/6/6/6/6** + 1920 居中 1536 零溢出 + 零异常。

#### 25.11.5 未做 / 诚实边界（不变）

- **手机档 `2/2` 未定** —— 现 d `2` / n `1`，本版**不动**，仍挂 `OPEN-ITEMS` **`B38`**（需 Kevin 一句话）。
- **`ResponsiveGrid` 的 JS 断点仍在**（9 处调用点）—— 归 `B39`，本批不修。
- **1280 档观感未另评** —— 质检只取几何读数（列数 / 宽度 / 溢出 / 卡内截断），**「1280 档是否偏窄」属观感，不预设合格**。
- **6 列作用域** = 仅首页商品网格（`.sf-feed`）；**任何其它网格要 6 列须另立单**，本节不扩面。

## §26 ★★ v1.25 · **商品卡固定尺寸契约**：卡高恒 `412` · 卡顶通栏预览图高 `240`（cover 居中裁切）· 移除状态徽章 / 领取行 / 限量徽章 · 卡底卖家信息栏 `48` —— 规则 **`T122`** + `Q5` 勘误 + route 册 `§41.3` 勘误指针（**本节只追加 · §1–§25 一字未动** · 依据 = **Kevin 2026-10-19 四条逐字**（§26.0）· **本笔零代码：契约冻结，实现归并行实现单**）

### 26.0 依据（Kevin 四条逐字 · 编制时点 2026-10-19）

- ① 「尺寸固定为大约 252*412。不要出现卡片高度变化的情况。」
- ② 「移除【库存不足】提示，移除【0 人已领取 0】提示。以及这两个文字标签前方的代表礼物的图标，都移除掉。」
- ③ 「卡片内的最上方放置商品的预览图片，图片尺寸具体为 240 像素 x240 像素，由于比例不同，预览图片需要在原图的基础上裁剪然后显示。」
- ④ 「商品卡片底部 224×48 显示发布者信息（参考图：左 24px 圆头像 + 灰色脱敏昵称『丽***L』式；右橙色胶囊标签『卖家信用优秀』，浅橙底橙字无图标）。」
- **口径订正（同日追加 · 覆盖 ④ 的昵称示例）**：脱敏昵称**不取「丽***L」中文昵称式** —— 现役口径 = **星号打码钱包地址** `maskWalletAddress(evm) = evm.slice(0,6) + '*'.repeat(6) + evm.slice(-4)`（例 `0x1234******abcd`）；④ 其余字面（24px 圆头像 / 灰色 / 右侧橙色胶囊无图标）不变。
- **`252` 与 `224` 的口径**：两者均为 Kevin **测量近似**，**判负不盯这两个字面**（§26.7）—— 卡宽随 `T121` 六列网格派生（实测锚 ≈225px @1536，见 §25 / master §5.427），卖家栏宽 = **占满卡内宽**（224 ≈ 该内宽实测近似）。若日后要求精确 252：两条路 = 容器加大（≈1624 档，随 gap / 页边距现算）**或改 5 列** —— **已向 Kevin 说明、一句话可改**，本版不裁。

### 26.1 `T122` 条文（写死 · 逐条可判负）

- **a. 卡高恒 `412px`**：`RewardCard` 渲染高度在任何内容 / 任何档位下恒等 412（`getBoundingClientRect().height === 412`）；**不随标题行数 / 描述长度 / 图片有无变化**。落点 = `reward-card.css` 的 `.sf-reward-inner`（flex column + `height:412px` + `overflow:hidden`）。
- **b. 预览图**：卡内**第一个子元素**、**通栏**（占满卡内宽、无侧 padding）· **固定高 `240px`** · `object-fit:cover; object-position:center`（原图任意比例 ⇒ 居中裁切，不拉伸不变形）· 图源 = `image`（`HomePage.jsx:127` 现取链 = `media_urls[0] > image_url > url_image > PLACEHOLDER_IMAGE` 机械鱼占位 `placeholder-item.webp`），无图 / 占位同规格同裁切；圆角只落卡顶两角（卡体 `overflow-hidden`）。
- **c. 412 内部分配**：240（图）+ 48（卖家栏，贴卡底）+ 中部 `flex:1`（标题 `clamp-2` + `$` 价格块 + 描述 clamp + 剩余时间行〔条件〕，**溢出隐藏** —— 中部内容不得撑高卡片）。
- **d. 卖家信息栏**：高 `48px`、占满卡内宽、贴卡底；左 = 头像 `24px` 圆 + 昵称（灰色 · `maskWalletAddress` 星号打码形态）；右 = 信用胶囊（**无图标** · 浅橙底橙字；**具体色值本版不锁** —— Kevin 未给 hex：若引入新色值须走「真源追加 + PROV」四件链，若用既有 Tailwind 橙阶须在质检读数具名登记）。
- **e. 头像**：`users.avatar_url`（新迁移 `0052_users_avatar_url.sql`：`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text` · 可空 · 零写数据 · `0051` 历史文件不动 + `DO $$` 自检；**无写入口**，头像上传另立单 ⇒ `OPEN-ITEMS B41`）非空 ⇒ 显示真图（cover 圆形）；null/空 ⇒ **恒占位**：灰底圆 + 掩码名首字符。

> **❗ 状态改写（2026-10-19 · §26.11 商品卡四行结构）**：本段 `a. 卡高恒 412px` 与 `c. 412 内部分配 = 240 + 48 + 中部 flex:1（124）`**已被 §26.11 取代** —— 现行 = **卡总高 392 = 图 240 + 四行 152（48/32/24/48）**；`b`（图 240 cover / 图源链）/ `d`（卖家栏 48）/ `e`（头像）**继续有效、不变**。旧句逐字保留（历史留痕），判负以 §26.11.5 为准。

### 26.2 移除清单（逐项 · 锚 = HEAD `12a94de` 版 `RewardCard.jsx` 行号，行号会漂）

| # | 移除对象 | 改前锚（HEAD 时点） | 现取状态 |
|---|---|---|---|
| 1 | 状态徽章行 `statusText` 全态（库存不足 / 可兑换 / 已兑换） | `:96-99`（`getRarityIcon` 调用 + `{reward.statusText}`） | 编制时点工作区已见移除（实现单进行中） |
| 2 | `getRarityIcon` 整函数（稀有度默认图标 `Gift` 等） | `:44-50`（def；HEAD `:6` import 的 `Gift/Star/Crown` 随之失义，import 清理归实现单） | 同上 |
| 3 | 卡底「N 人已领取 / 总数」行（含前置 `Gift` 图标） | `:175-176`（`{reward.claimed \|\| 0} {t('common.claimedUnit')}`） | 同上 |
| 4 | `limited` 限量徽章（与徽章行同行 ⇒ 一并移除） | `:100-103`（`reward.limited && … t('rewardCard.limited')`） | 同上 |

- **连带登记（HomePage）**：`HomePage.jsx:124` 的 `statusText` 映射逻辑**保留**（`p6-miscfix` 面），但卡片**不再消费** ⇒ 登记「**映射保留、消费点移除**」（映射仍进归一对象，非死码、非缺陷）。

### 26.3 保留清单（逐项 · 本单不动面）

| # | 保留对象 | 契约锚 |
|---|---|---|
| 1 | 整卡链接（单一 `<a>`/`<Link>` + 无 Router 回落） | `T112` / `T113`（`i18n-batch-b2.test.jsx:154/158/170` 不变） |
| 2 | `$` 价格块（符号 span 恰 1） | `T110` + `r9-93-points-symbol`（`>$</span>` 恰 1 · `USAGE_FILES` 计数 1 不变） |
| 3 | 描述 clamp（`line-clamp-3`）+ 标题 `clamp-2` | 现状保留 |
| 4 | 剩余时间行（条件 `reward.time_end && status==='available'`，含 `t('rewardCard.timeLimited')`） | 现状保留（故 `timeLimited` **非死键**，§26.8） |
| 5 | CTA 逻辑（`actionLabelKey` 路径逐字不变：`reward-card-claim` / `onClaim` / 三态文案 `insufficient / claimed / claimNow`） | v1.23 勘误 + 组件注释口径 |
| 6 | 稀有度**装饰光斑**（`opacity-20 blur-xl` 圆） | §22.11 `Q5` 该半句仍有效（§26.6） |

### 26.4 卖家栏数据面（`seller` 对象契约）

- **昵称** = `maskWalletAddress(evm)`：`evm.slice(0,6) + '*'.repeat(6) + evm.slice(-4)`（16 字符定长形态，例 `0x1234******abcd`）。**现取**：`messages-service.ts:623` 现行 = 前 6 + `…`（省略号）+ 后 4 ⇒ **实现单改星号定式**；详情卖家名与首页 feed 卖家名**同源共用**该派生。**route 册 `§41.3` 的「前 6 + `…` + 后 4」字面同步勘误**（旧句保留 + 勘误留痕行，route 册 `:8204` 后）。`users` 表**现取无 nickname 列**（`messages-service.ts:603-604` 既有注释）⇒ 昵称恒为掩码派生、无明文昵称可泄。
- **头像** = `users.avatar_url`（§26.1e）；null ⇒ 前端占位。
- **信用档位** = `rating` 按 `ratee_uid` 均星（聚合口径与排序 v1 同源）：`≥4.5 ⇒ excellent「卖家信用优秀」` / `≥3.5 ⇒ good「卖家信用良好」` / `<3.5 ⇒ normal「卖家信用一般」` / **无评分 ⇒ new「新卖家」**。★ **标签档位独立于排序公式**（排序无评分仍按中性 3.0，route 册 `§49.2` 不动）。

### 26.5 后端 / i18n 增量（契约数 · 随实现单同批落地 · 本笔零代码）

- `listBrands`（`database.ts`）每行**加性**增 `seller = {uid, nickname, avatar, credit}` ⇒ **feed 行键 45 → 46**；详情行（`GET /api/prize/:bID`）已有 `seller`（46 键）⇒ `seller` 内加 `credit`、**顶层仍 46**。route 册响应键集登记随实现单同批。
- i18n 新命名空间 `sellerCredit` 4 键（excellent / good / normal / new，四语同补）：**top 128→129 / flat 1110→1114 / 四语节点 4440→4456**（base = 编制时点现取 128/1110/4440，python 现算）⇒ 触发 i18n 计数前推家族（约 13 文件，清单现取法见 §21.7）。
- `data-layer.spec` 的 `users.avatar_url` 列登记 = **§40.7**（本批同册落）；迁移 apply 由 Zang（实现单创建文件）。

### 26.6 规范冲突勘误（状态改写式 · 旧句一字未删）

1. **§22.11 `Q5`**（本版已在该行后插勘误行）：「稀有度图标（`getRarityIcon`）…保留」**图标部分作废**，以 §26 为准；**装饰光斑保留**半句仍有效。
2. **route 册 `§41.3`**（`:8203`）：「前 6 + `…` + 后 4」**作废** ⇒ 现行 = 前 6 + `******`（6 星）+ 后 4（`maskWalletAddress`）；route 册已插勘误留痕行（勘误级不升版）。
3. **再收口（同日 · Kevin「①再简短一些，希望用星号」）**：掩码定式再收紧 = **`0x` + 前 2 位 + `**` + 末 2 位**（例 `0x12**cd`；实现 `messages-service.ts maskWalletAddress` 已同步、`frontend` 门套 62 文件 598 例绿）；本册与 §5.428 各处「前 6 + `******` 6 星 + 后 4」旧形态（含 v1.25 版本头 ⑥ / `:3197` / `:3232` / `:3245`）**一并作废，以本条为准**（route 册 §41.3 已有同级再收口行）。
3. **i18n 死键**：见 §26.8 —— **本版不删任何键**（避免键数连锁），死键清理挂 `OPEN-ITEMS B40`。

### 26.7 判负 / AC（7 条 · 质检必带）

| # | 探针 | 期望（违反即判负） |
|---|---|---|
| 1 | 任意内容态（长标题 / 长描述 / 有图无图）下卡片渲染高度 | **恒 = 412**（≠412 即判负） |
| 2 | 预览图元素高度 / 裁切 | **= 240** 且 `object-fit:cover` 居中（高≠240 / 非 cover 即判负） |
| 3 | 徽章 / 领取行 | 卡内**不得存在** `statusText` 渲染点、「人已领取」文案（`common.claimedUnit`）、`limited` 徽章（任一出现即判负） |
| 4 | 卖家栏 | **存在**且高 = 48（缺失或 ≠48 即判负） |
| 5 | 信用档位 | 与夹具评分逐档相符（excellent / good / normal / new 四臂；不符即判负） |
| 6 | 昵称形态 | `0x******abcd` 掩码形态（出现明文 EVM 全量即判负） |
| 7 | 图非 cover 裁切 / 拉伸变形 | cover 居中（`object-position:center`；变形即判负） |

> **❗ 状态改写（2026-10-19 · §26.11）**：本表第 **1** 条「恒 = 412（≠412 即判负）」的 `412` **已被 §26.11 取代** ⇒ 现行判负 = **卡高恒 392** + **四行行高 48/32/24/48**（§26.11.5 九条，含标题截断 / 价格行 / `wants` / service 行 / 卖家行）。第 2/3/5/6/7 条**逐字继续有效**。旧字面保留。

### 26.8 i18n 死键清单（现取 · 2026-10-19 · 不删、挂 `B40`）

| 键 | 现取消费点 | 判定 |
|---|---|---|
| `rewardCard.limited` | 仅 `RewardCard.jsx` 限量徽章（HEAD `:102`）→ 移除面 | **死**（移除落地后无消费点） |
| `common.claimedUnit` | 仅 `RewardCard.jsx` 领取行（HEAD `:176`）→ 移除面 | **死**（同上） |
| `rewardCard.insufficient` / `claimNow` | CTA 三态（HEAD `:200/:203`）→ **保留面** | **活**（派单原列五键，现取复核留活） |
| `common.claimed` | CTA 三态（HEAD `:202`）+ `TaskPage.jsx:131` → 保留面 | **活**（他处仍消费，现取已核） |
| `rewardCard.timeLimited` | 剩余时间行（HEAD `:169`）→ **保留面** | **活**（若后续裁「剩余时间行」移除再入死键清单） |
| `homePage.rewardOutOfStock` | — | **状态不变**：F13（2026-10-12）已删、四语现取无此键，不涉本单 |

### 26.9 落点约束 / 断言影响 / 现取自证 / 未做

- **零新主题 token / 零 `STRUCT` / 零 PROV 改指 / `style-preview.html` 零改动**：412/240/48/24 属几何常量，承 §24「颜色以外不进主题层」先例落 `reward-card.css`；信用胶囊**不锁色值**（§26.1d）—— 若实现单引入新颜色值才触发真源四件链（另记）。
- **断言影响（现取点名）**：`r9-93-points-symbol`（`>$</span>` 恰 1 / `USAGE_FILES` 计数 1）与 `i18n-batch-b2`（无 Router 裸渲染不抛错 / 无 `<a href>`）**零改锚**；引用 `statusText` / `claimedUnit` 渲染的测试（现取 `grep -rln 'statusText\|claimedUnit' frontend/src/test/unit` = `i18n-batch-b2` / `i18n-batch-b3` / `r9-93` / `p6-miscfix` / `r9-90`）属**改锚面**（实现单同批前推）；i18n 计数前推家族（`sellerCredit` +4 键）随实现单。
- **现取自证（编制时点 = 2026-10-19 · HEAD `12a94de`）**：i18n base top **128** / flat **1110** / 四语节点 **4440**（python 现算）；`sellerCredit` 四语 0 命中；backend `avatar` 零命中（列未建，`0052` = 契约号）；`reward-card.css` 48 行且尚无 412/240 常量（实现进行中）；工作区 `M frontend/src/components/reward/RewardCard.jsx` = 实现单未提交面（非本单写面）。
- **未做 / 诚实边界**：本笔零代码、零迁移落盘（`0052` 文件由实现单创建、apply 由 Zang）；§26.7 的 7 条 AC **一条未跑**；`B40`（死键清理）与 `B41`（头像上传能力待立单）挂 `OPEN-ITEMS`；信用胶囊色值未锁（待实现单读数或 Kevin 给色值）。SPEC-NOTE = `ops/card-resize/SPEC-NOTE.md`。

### 26.10 实现回写与生产终验（2026-10-19 收口 · 同 v1.25 契约的**实现面回写、不升版** · 承 §25.11 体例）

> **本节性质**：**§26.0–§26.9 一字未改**；契约仍以 **v1.25** 为准，本节只补「已实现、已质检、已上线、生产终验 PASS」的事实与两处落地差。实现 = `d37a813`；独立质检 = `937b861`（**171 判据 0 红**）；上线 = push `12a94de..937b861`（3 提交 · **迁移先行** schema 0051→0052）；生产终验 = `133ed34`（证据 `ops/card-resize/prod-verify/`）。master 侧登记 = **§5.429 + 版本行 v0.346**。**★ 编号勘误（披露）**：本笔派单写「§26 末追加 **26.8**」，而 **§26.8（i18n 死键清单）/ §26.9（落点约束）已被 v1.25 占用** ⇒ 承 v1.24 `T121` 编号勘误先例**现取顺延 §26.10**，派单编号字面留痕于此。

#### 26.10.1 掩码终态（`maskWalletAddress` 二轮再简短 · 与 §26.7 的作废关系）

- **终态定式（写死）**：`maskWalletAddress(evm) = evm.length >= 8 ? evm.slice(0,4) + '**' + evm.slice(-2) : evm`（`backend-ts/src/messages-service.ts:607` 现取）＝ **`0x` + 前 2 位 + `**` + 末 2 位**，**恰 8 字符**（例 `0x12**cd`）；`evm` 长度不足 8 ⇒ 兜底原样返回（实现注释留痕）。适用面不变：详情卖家名（`getPrizeSellerView`）与首页 feed 行 `seller.nickname` **同源共用**该单源助手。
- **作废关系（状态改写式 · 旧字面不删）**：§26.0 口径订正行、§26.1d、§26.4、**§26.7 #6** 的「前 6 + `******`（6 星）+ 后 4」与「`0x******abcd`」字面**一并作废、以本条为准**（§26.6 #3 再收口行 + route 册 §41.3 再收口行 = 同日正典，随实现 `d37a813` 入库）。**§26.7 #6 的判负实质不变**：期望形态改判 **`0x12**cd` 8 字符定式**，「出现明文 EVM 全量即判负」照旧；质检已按终态执行（恰 8 字符、对 feed 全部卖家以 DB `evm` 单源重算逐一致、不含完整地址）。

#### 26.10.2 几何现取（生产读数 · 1536 档 ×7 卡 · `133ed34`）

| 项 | 契约（§26.1） | 生产现取 |
|---|---|---|
| 卡高 | 恒 412 | **7/7 = 412**（逐卡 `getBoundingClientRect` 恒定） |
| 预览图 | 高 240 · 通栏 · cover 居中裁切 | **7/7 高 240 × 宽 223**、cover；`naturalWidth`：320=占位 ×5 · **960 / 612 = 真实上传图 ×2**（生产首次有真实上传图读数） |
| 卖家栏 | 高 48 · 占满卡内宽 | **7/7 = 48** |
| 头像 | 24px 圆；null ⇒ 灰底 + 掩码名首字符占位 | 生产 `avatar_url` **全 null ⇒ 全占位**：灰底圆 + 掩码首字符、无 `<img>`（dev 读数灰底 `rgb(238,240,242)`；生产探针卖家栏文本首位「0」即 `0x59**b0` 的首字符 = 占位在场实证）；上传能力不存在 ⇒ `B41` 挂账 |
| 移除项 | 徽章 / 领取行 / 前置礼物图标 = 0 | gift=0 · badges=0（QA 侧另证四文案 = 0、稀有度光斑每卡 1 在场） |
| 信用胶囊 | 无图标 · 色值不锁（§26.1d） | 现取既有 Tailwind 阶：excellent `bg-orange-100 text-orange-600` / good `bg-blue-50 text-blue-600` / normal `bg-gray-100 text-gray-500` / new `bg-gray-100 text-gray-400`（`RewardCard.jsx:195-198` 现取）—— **零新 token、零新 hex**，与 §26.1d「不锁色值」相容 |

- **卡内宽 223 与 225 锚的算术**：**223 = 卡内宽**（§26.0 的网格锚 ≈225 − 卡体 1px 边框 ×2），两者相容；**252 仍为 Kevin 测量近似、非判负**（§26.0）。QA 首版以卡外宽为参照得 16 条假红（差恒 2px = 无效尺），已自纠为以 `.sf-reward-inner` `clientWidth` 为参照 + computed border 自洽断言（verdict `judgeCorrections` 留痕，无实现改动）。
- **6 列规则 = `styles.css` 字面（非 token）**：属 **§25.11.3 既有落地差**，商品卡不改列数面 ⇒ 本节不重复登记、仅指针。

#### 26.10.3 数据面 / 质检 / 门套（现取）

- 数据面：feed 行 `seller = {uid, nickname, avatar, credit}`（行键 **45→46**）；详情顶层 46 且 `seller.credit` 在场；`creditFromAvg`（`messages-service.ts:616` 现取）= null ⇒ new / ≥4.5 ⇒ excellent / ≥3.5 ⇒ good / 其余 ⇒ normal，**服务端算好下发、前端不本地算**（独立于排序中性 3.0，route §49.2 不动）。
- 质检 `937b861`：**171 判据 0 红**、六 AC 全 PASS——四组合（有图 / 无图⇒占位 / 长标题 60 字 / 无描述）× 1440/1536 两档 8 读数恒 412（真实 feed 9 卡 + 390 档 9 卡同 412）· 移除项 0 · **插 1 行 5 星评分（ratee=970213）⇒ API credit=excellent + 页面「卖家信用优秀」、其余 8 卡仍「新卖家」，回收零残留**（rating before 0 / after 0、append-only 触发器前中后 `'O'`、四组合夹具 = route 内存拦截零写库）· 门套 build 0 + `test:unit` **62 文件 / 598 例** + `tsc` 0 + `p7b-03` **37/37** `regs=110` + 双库 schema 顶 `0052` · 回归（currencies 2 行 / media 404 / 390 零溢出）。
- 生产终验 `133ed34`：同版 sha256 逐字（js `14eb3c5dab5279b8…` **497,271 B** / css `df93ff44c0bcd0a3…` **125,431 B**）+ **7 卡（生产 listed 4 旧 + 3 新）恒 412** + 图 240×223 cover + 卖家栏 48 + 掩码 `0x59**b0` / `0xf7**da` / `0xb8**27` / `0x9a**2b` 全命中 + gift/徽章 0 + pageerror / console error 0。

#### 26.10.4 诚实边界 / 挂账（本节不裁新契约）

- **信用四档生产仅「new」可见**：生产 `rating` **0 行** ⇒ 全部卖家「新卖家」；**「优秀 / 良好 / 一般」三档生产不可见**，只在 dev 插行取证（插 5 星 ⇒ excellent、回收零残留）——三档的生产可见性待生产出现真实评分后自然可验，**不造假数据**。
- **头像**：`0052` 列已建、**写入口不存在**（`B41` 待立单）⇒ 生产头像全占位形态（见 26.10.2）。
- **死键**：`rewardCard.limited` / `common.claimedUnit` 随移除面死亡、**未删**（`B40`）；保留面（整卡链接 / `$` 价格块 / 描述 clamp / 剩余时间行 / CTA / 稀有度光斑）零回归（AC2 光斑每卡 1 在场；`r9-93` / `i18n-batch-b2` 零改锚）。
- 本节**零新契约 / 零新 token / 零 `STRUCT` / 零真源改动**；不升版依据 = 承 §25.11「实现面回写、不升版」先例。交付件 = `ops/card-resize/SPEC-NOTE-closure.md`。

---

### 26.11 ★ 商品卡四行结构契约（2026-10-19 · Kevin 逐字重定义 · **取代 §26.0 ① / §26.1a / §26.1c 的 `412` 与「240 + 48 + flex-1」内部分配** · 编号现取 = `26.10` 之后 · 本笔只登记，实现另单并行）

#### 26.11.0 依据（Kevin 逐字 · 2026-10-19）

> 「商品卡片实际分为两个部分：image-container 和 content，后者分为四行：row1-wrap-title 内容是商品的标题，如果超出 48 个字符（24 个汉字）则截断，并在后面加'...'，尺寸 224x48；row2-wrap-service 内容放一些标签，目前暂时留空，尺寸 224x32；row3-wrap-price 内容是价格，形如：¥495 20人想要；row4-wrap-seller 内容是卖家信息，非常满意当前的状态，尺寸 224x48。」

- **逐字保留说明**：上文 `¥495` 为 Kevin **示意**；本站计价符号 = **`$`**（master §2 术语冻结 / `r9-93` 价格块）⇒ 落契约按 `$` 记（§26.11.3）；其余字面（类名 / 四行顺序 / 「48 字符 = 24 汉字」/ 各段尺寸 / 卖家行「非常满意当前的状态」= **不变**）逐字采纳。

#### 26.11.1 几何（冻结 · 恒等、不随内容）

| 段 | 类名（Kevin 逐字） | 尺寸（卡内宽 × 高） | 内容 / 约束 |
|---|---|---|---|
| 图片容器 | `image-container` | **224 × 240** | 卡内第一个子元素、通栏、`object-fit:cover` 居中裁切；图源链承 §26.1b |
| 内容容器 | `content` | **224 × 152** | 四行纵向堆叠；`overflow:hidden` |
| 行 1 | `row1-wrap-title` | **224 × 48** | 标题（单行；超 48 显示宽单位截断 + 字面 `...`，见 §26.11.2） |
| 行 2 | `row2-wrap-service` | **224 × 32** | 标签位，**当前留空**；高度恒在（空串也占 32） |
| 行 3 | `row3-wrap-price` | **224 × 24** | `$` + 数字 + 空格 + `{{n}}人想要`（见 §26.11.3） |
| 行 4 | `row4-wrap-seller` | **224 × 48** | 卖家信息，与 §26.1d / §26.1e **逐字不变** |
| **卡总高** | — | **392** | `240 + 48 + 32 + 24 + 48 = 392`（算术：240+48=288 → +32=320 → +24=344 → +48=**392**） |

- **卡高守恒**：392 恒等，不随标题长短 / 标签有无 / 价格位数 / 卖家名变化；`content` 高 152 恒等，四行合计恰 152。
- **卡体不得再加 1px 实边框**：`240 + 152 = 392` 是**内容盒分配**；卡体若保留 1px 实边框且 `box-sizing:border-box`，内容盒只剩 390 ⇒ 四行必被压 2px（结构性判负）。需要描边 ⇒ 用 `inset box-shadow`（零盒占位）。★ 判负读数 = `getBoundingClientRect().height` **恒 392**（边框口径下亦须为 392）。
- **卡宽口径（承 §26.0 / §26.10.2）**：卡内宽 = **224**（Kevin 逐字）；卡外宽随 `T121` 六列网格派生（≈225 @1536；上一轮实测卡内 223 = 边框 1px×2 所致）。**判负只盯卡内宽分配与行高，不盯卡外宽字面**（252 / 225 均为测量近似）。

#### 26.11.2 标题截断（冻结 · 唯一读法）

- **上限 = 48 个显示宽单位**（汉字 / 全角 = 2、拉丁 / 半角 = 1 ⇒ 恰 24 汉字）；显示宽口径与站内既有「显示宽单位」同源（Telegram 预览「首 6 显示宽单位」同法）。
- **超限 ⇒ 截断到 ≤ 48 单位 + 末尾追加字面 `...`**（3 个半角 ASCII 点，**不是** `…` U+2026）。
- **`...` 不计入 48 上限**（最终显示宽 ≤ 48 + 3 = 51 单位）—— 依据 Kevin 逐字「超出 48…则截断，并在后面加 `'...'`」；若要「点也算在 48 内」⇒ **一句话可改**（截断体改 ≤45）。
- **单行**：`white-space:nowrap`；截断由 JS / 文本层按显示宽做，**不得叠加 CSS `text-overflow:ellipsis`**（否则 `...` 后再生 `…` = 双尾，判负）；`overflow:hidden` 只作兜底。
- **未超限 ⇒ 原文逐字、不加点**（未超限却带尾点 = 判负）；**空标题 ⇒ 空行占位、高仍 48**（不得塌高）。
- 字数统计以**渲染后字符**为准（不按字节、不按 UTF-16 长度）；emoji / 代理对按 **2** 单位计（同全角档）。

#### 26.11.3 价格行（冻结）

- **形态** = `$` + 数字 + **一个半角空格** + `{{n}}人想要`（例 `$495 20人想要`）；`$` 与数字紧贴（承 `r9-93` 价格块形态）。
- **符号 = 站内 `$`**：Kevin 示例里的 `¥` **不采纳**；卡面出现 `¥` 即判负（承 master §2「符号只用一个 `$`」）。
- **`n` = `listing_favorite` 该商品的收藏行数**：`COUNT(*) FROM public.listing_favorite WHERE listing_id = bID`（表 = 迁移 `0047`；取消收藏 = 物理 DELETE ⇒ 计数为**实时值**）。
- **服务端算好下发**（feed 行加性键 `wants`，§26.11.4）；前端只渲染、**不在本地算**（承 §26.4 信用档「服务端算、前端只读」先例）。
- **文案键 = `rewardCard.wants`**，四语同补，插值写法 **`{{n}}`**（本仓 i18next 未自定义 prefix/suffix ⇒ 写 `{n}` 不插值）。
- `n = 0` 仍渲染「0人想要」（Kevin 未给 0 的例外；要隐藏 0 ⇒ **一句话可改**，卡高不受影响）。
- 价格数字按整数渲染、不加千分位（与既有价格块一致）。

#### 26.11.4 数据面 / i18n 增量（契约数 · 随实现单同批落地 · 本笔零代码）

- **`listBrands` 行加性键 `wants`**（非负整数）：feed 行键 **46 → 47**（现取 2026-10-19 dev `GET /api/prize/all?limit=1` 行键 = **46**，`seller` 已在场、无 `wants`）。
- **详情口不随**：`GET /api/prize/:bID` 顶层仍 **46** 键；卡面是列表面概念，详情价格行另议（不属本节）。
- **i18n +1 键** `rewardCard.wants`（四语同补）：**top `129` 不变**（命名空间数不变）/ **flat `1114 → 1115`** / **四语节点 `4456 → 4460`**（编制时点 python 现取：四语各 `top 129 / flat 1114` ⇒ `4 × 1114 = 4456`；`4 × 1115 = 4460`）。
- **计数前推家族**（约 13 文件硬编计数，top / flat / 四语节点三数并存）随实现单，清单现取法见 §21.7。
- **读口性能（登记、本版不裁）**：`listing_favorite` 现取索引 = `UNIQUE(fav_uid, listing_id)` + `idx_listing_favorite_fav(fav_uid, time_created DESC, fav_id DESC)`，**无 `listing_id` 前导索引** ⇒ 按行相关子查询 `COUNT(*)` 会逐行扫表；改**聚合 `LEFT JOIN … GROUP BY listing_id` + `COALESCE(…,0)`**（单次分组扫描）在 36 行/页量级可接受。商品上量后加 `(listing_id)` 索引或改 `LATERAL` 聚合 = **另立迁移单（本版零迁移）**。★ 两种写法皆合契约（判负只盯数值正确，不锁 SQL 形态）。

#### 26.11.5 判负 / AC（9 条 · 质检必带）

| # | 探针 | 期望（违反即判负） |
|---|---|---|
| 1 | 卡高（任意内容态：长标题 / 空标签 / 长价格 / 有图无图） | **恒 392** |
| 2 | 四行行高（逐行 `offsetHeight`） | **48 / 32 / 24 / 48**（任一不符即判负） |
| 3 | `image-container` | 存在、高 **240**、`object-fit:cover` 居中 |
| 4 | 标题超 48 显示宽单位 | 必须已截断（渲染文本显示宽 ≤ 48 + `...`） |
| 5 | 截断尾形态 | 末尾**恰为字面 `...`**（`…` / 无尾 / 双尾 / 空白尾 皆判负） |
| 6 | 价格行 | 含 **`$`** 符号（出现 `¥` 即判负）且含「人想要」段 |
| 7 | `wants` | 行内**存在**、为整数、且与 `listing_favorite` 计数**逐行相等**（DB 单源重算） |
| 8 | `row2-wrap-service` | **存在**且高 32（**即使留空也不得缺**；缺失 / 塌高即判负） |
| 9 | `row4-wrap-seller` | 与 §26.1d 逐字一致（48 高 / 24px 圆头像 / 掩码昵称 / 信用胶囊无图标）——**变即判负** |

#### 26.11.6 与 §26 既有条文的关系（状态改写 · 旧字面逐字保留）

1. **作废面**：§26.0 ①「252*412」中的 **`412` 作废**（`252` 仍为测量近似、判负不盯）；§26.1a「卡高恒 `412px`」与 §26.1c「412 内部分配 = 240 + 48 + 中部 `flex:1`（124）」**一并作废** ⇒ 现行 = **240（图）+ 152（四行）= 392**。§26 标题行与 v1.25 版本头内的 `412` 字面**保留**（历史留痕），判负一律以本节为准。
2. **不变面**：§26.1b 图片（240 / 通栏 / cover / 图源链）、§26.1d/e 卖家栏、§26.2 移除清单、§26.4 卖家数据面、§26.7 #2/#3/#5/#6 **继续有效**。
3. **四行 = 封闭枚举（本版按逐字读法落）**：`content` 恰四行 ⇒ **描述行（`line-clamp-3`）与剩余时间行不再在卡面渲染**；`rewardCard.timeLimited` 由「活」转**死键候选**（**不删**；由 `OPEN-ITEMS B42` 登记、`B40` 清理单届时同批复核）。若要在四行内保留剩余时间 ⇒ **一句话可改**（须从标题 / 标签行借高，卡高仍 392）。
4. **CTA**：首页卡自 v1.23 起动作胶囊整块不渲染（`actionLabelKey` 缺省即不渲染），本节不改该逻辑（`T112` / `T113` 零改锚）。
5. **若要保 412**：图片需 **260**（`412 − 152 = 260`）⇒ 与 Kevin「图片 240」冲突 ⇒ **待定**（`OPEN-ITEMS B42`）；本版不裁 260。
6. **落点**：四行结构与类名落 `reward-card.css` / `RewardCard.jsx`（实现单）；**零新主题 token / 零 `STRUCT` / 零 PROV 改指**（240/48/32/24/392 属几何常量，承 §24「颜色以外不进主题层」）。探针锚 = Kevin 逐字类名 + 既有 `data-sf-m="reward-card-seller"`；其余行如新增钩子须为**加性** `reward-card-image` / `reward-card-title` / `reward-card-service` / `reward-card-price`（**不得改类名**）。
7. **现取自证（编制时点 2026-10-19）**：i18n 四语各 `top 129 / flat 1114`（python 现算，节点 `1114 × 4 = 4456`）；dev `/api/prize/all?limit=1` 行键 **46**；`listing_favorite` 表 `0047` 在场（计数源）；注册点 **110**（get 49 / post 57 / put 0 / delete 3 / patch 1）⇒ **零新路由**。★ **并行实现单披露**：编制时点工作区已见实现面 `M`（`database.ts` 的 `wants` / 四语 `rewardCard.wants` / `RewardCard.jsx` + 新 `truncate.js`），**非本单写面**；故「46 / 1114」为**编制时点读数**，判据一律以**契约数 47 / 1115 / 4460** 为准。**未做**：§26.11.5 九条 AC 一条未跑；实现与 i18n 计数前推归并行实现单；本笔零代码、零迁移、不 push。

#### 26.11.7 实现回写与生产终验（2026-10-19 · **追加式回写、不升版** · 实现 `38dcbe5` / F1 `dca495e` / 质检 `49a7d99` / 生产 `1f3f9de`）

> **性质**：本节只回写**实现期实数与生产读数**。§26.11.0–26.11.6 的契约条文（盒高 48 / 内容盒 152 / 卡高 392 / 判负 9 条）**一字未改**；本节新增的是「怎么落成的、实测是多少、哪里偏离」。契约面旧字面（`412` / `224` / 15px 系）全部保留。

1. **实现落点**：`frontend/src/components/reward/RewardCard.jsx`（四行结构 + 稳定类 `sf-reward-card-body`）· `reward-card.css`（几何与字号）· 新增 `truncate.js`（按显示宽截断）· `backend-ts/src/database.ts`（feed 加性键 `wants`）· 四语 `rewardCard.wants`。

2. **标题字号 = `14px`（实数 · 契约只冻盒高、未给字号）**：1440 档卡内宽实测 **207.33**（契约 **224** 为目标值；差 = 六列栅格子像素 + 卡体 2×1px 边框）⇒ `.row1-wrap-title { padding: 0 10px }` 后文本可用 **≈187**；`font-size: 15px` 时「24 汉字 + `...`」实测 `scrollHeight > 48`（**溢到第三行**）。落 **`font-size: 14px` + `line-height: 24px`**（`2 × 24 = 48` 与盒高逐字相等，187px 两行容下 24 汉字 + `...`）。**截断口径不变**：仍按 **48 显示宽单位** + 字面 `...`，由 `truncateByWidth(text, 48)` 前置截断（**不依赖 CSS 行数裁剪**）。实测：24 汉字不截（48 单位）/ 25 汉字 ⇒ 前 24 + `...`（51 显示单位）/ 60 拉丁 ⇒ 48 拉丁 + `...`（无 `…`）；5 夹具卡 × 四组合 `scrollHeight` **全 48**、尾点 Range 盒在行盒内（bottom 976 ≤ 980、right 613.3 ≤ 711.0）。

3. **卡高 392 实算**：`240（图）+ 48 + 32 + 24 + 48 = 392`。**392 是内容盒分配** ⇒ 卡体**不得再加 1px 实边框**（`border-box` 下 2px 会把它压成 390，见 4）。

4. **F1 修法（实边框 → `outline` inset · 不占布局）**：Card 基座恒带 `.border`（1px 实边框）⇒ 修前 **内容盒 390** / `.content` **150** / 卖家行底边 **−1**（被 `overflow:hidden` 裁掉 2px）。**卡体 `rect` 高两态都是 392** ⇒ 卡高判据若只取 rect 则对该缺陷**零分辨力**（首轮几何判据即因此漏它）。修法：

```css
.sf-reward-card .sf-reward-card-body {
  border: 0;                       /* 不吃 2px 布局 */
  outline: 1px solid #e5e7eb;      /* 视觉等同原 border-gray-200 */
  outline-offset: -1px;
}
```

   修后：内容盒 **392** / `.content` **152** / 卖家行底边 **0** / 计算边框 **0px/0px**。**不用 `box-shadow`**（卡体已有 `hover:shadow-lg`，会被该工具类覆盖）；`.sf-reward-card` 前缀保具体性 (0,2,0)，压过 `@layer utilities` 的 `.border` 且不依赖打包顺序。**负控**：把 `border:0` 改回 `1px solid #e5e7eb` ⇒ **20 红**；恢复 ⇒ **189 绿 / 0 红**（同探针同缺陷必红必绿）。

5. **稀有度彩色环副作用（登记 · 未改）**：`RewardCard.jsx:84-85` 的 `border-yellow-400`（`legendary`）/ `border-purple-400`（`epic`）**依赖 1px 实边框着色** ⇒ `border:0` 后**彩色环不再绘制**，现为统一浅灰 `#e5e7eb` inset outline。**要彩色环** = 在同一规则内按类接管 `outline-color`（仍不占布局）—— **未做，待 Kevin**（`OPEN-ITEMS B43`）。稀有度**图标**已于 v1.25 §22.11 `Q5` 作废；卡内徽章 `bg-yellow-400 / bg-purple-400 / bg-blue-400`（`:89-94`）仍在 ⇒ 稀有度**辨识未丢**。

6. **行高 / 内容盒现取表（真浏览器 · 1440 / 1536 × 日/夜 × 5 夹具卡 + 真 feed 9 卡）**：

| 量 | 契约 | 修前（F1 态） | 修后（现行） |
|---|---|---|---|
| 卡体 `rect` 高 | 392 | 392 | **392** |
| `.sf-reward-inner` `clientHeight`（内容盒） | 392 | 390 | **392** |
| `.content` 盒高 | 152 | 150 | **152** |
| 行高 title / service / price / seller | 48 / 32 / 24 / 48 | 48 / 32 / 24 / 48 | **48 / 32 / 24 / 48** |
| 图容器高 | 240 | 240 | **240** |
| 卡内宽（1440 / 1536） | 224（目标） | 207.33 / 223.33 | **209.33 / 225.33** |
| 卖家行底边 − 内容盒底边 | 0 | **−1**（被裁） | **0** |
| 计算 `border-top/bottom-width` | 0（禁实边框） | 1px / 1px | **0px / 0px** |

   注：卡内宽 209.33 / 225.33 与 224 的差 = 六列栅格子像素 + outline 不占宽 ⇒ **判负不盯卡内宽**（承 §26.11.6）；行高、图高、卡高为判负面。

7. **生产终验读数（`ops/card-rows/prod-verify/`）**：同版 sha256 逐字（js **`13a6b63c…`** 497,255 B / css **`7a86f0b8…`** 126,007 B）· **1440 / 1536 两档 × 7 卡**逐卡：卡高 **392** · 图 **240** · 行高 **48 / 32 / 24 / 48** · gift 图标 **0** · 横向溢出 **0** · `pageerror` / console error **0** · 价格行形如 `$20人想要`（左价右「n人想要」、两端对齐）。**诚实边界**：① 生产探针只记 `vw`、**无 theme 字段** ⇒ **夜档生产未单测**（日/夜四组合由本地质检 `rows-qa.json` 覆盖，`distinctHeights=[392]`）；② 生产标题均未超 48 单位（`titleEndsDots=false` 全部）⇒ **截断行为由 dev 夹具取证**，非生产读数。

8. **判负口径增补（只增不改 §26.11.5 九条）**：探针侧加两条**实现约束** —— (a) 卡体计算 **`border-top-width` / `border-bottom-width` 必须 0**（实边框 ⇒ 内容盒 390 ⇒ 判负）；(b) 卡高判据取 **`.sf-reward-inner` `clientHeight = 392` + 卖家行 `rect` 底边 = 内容盒底边（±0.5）**，**不得只取卡体 `rect`**（两态同值、无分辨力）。

#### 26.11.8 三条待定项裁定回写（2026-10-19 · **追加式、不升版** · Kevin 逐字「1、可以 2、暂时不改 3、暂时不改」）

> **性质**：本节只回写**裁定结论**，收口 §26.11.4 #5 与 §26.11.7 第 2·3·5 条中的「待定 / 待 Kevin」。**旧句一字未删**；凡与本节冲突处，**以本段为准**。三条裁定均 = **对现状的确认** ⇒ 契约面（盒高 48 / 内容盒 152 / 卡高 392 / 判负 9 条）**不变**，实现面**零代码改动**。逐字对位：① 标题 14px ⇒ **可以**；② 392 vs 412（保 412 需图 260）⇒ **暂时不改**；③ 稀有度彩环 ⇒ **暂时不改**。

1. **标题 `14px` = 已确认保留（不是临时取舍）**。§26.11.7 第 2 条把 14px 记为「实现实数（契约只冻盒高、未给字号）」；Kevin 裁「**可以**」⇒ **14px 升为已确认的字号定稿**，不再是「为实现妥协、待追认」。**判负口径不变**：只盯**盒高 48** + **48 显示宽单位 + 字面 `...`**，**不以字号判负**；若将来改字号 ⇒ 须重跑「两行 `scrollHeight = 48` 收住」判据。
2. **卡高 `392` + 图 `240` = 定稿**。§26.11.4 #5（「若要保 412 ⇒ 图需 **260** ⇒ 待定（`B42`）」）与 §26.11.7 第 3 条附注**结论收口**：Kevin 裁「**暂时不改**」⇒ **保持 392 + 图 240**；**412 / 图 260 路线关闭**（不挂账、不再作并行候选）。旧句保留，**以本段为准**。**生产补证（`bb7c5ab`）**：`data-theme=dark` × 1440 / 1536 × 7 卡 恒 **392** · 图 **240** · 行高 **48/32/24/48** · 零异常（`ops/card-rows/prod-verify/prod-probe-dark.json`）⇒ 日/夜两档均符。
3. **稀有度彩色环 = 不加回**。§26.11.7 第 5 条的「要彩色环 = 按类接管 `outline-color` —— 未做，待 Kevin（`B43`）」**结论收口**：Kevin 裁「**暂时不改**」⇒ **维持统一浅灰 `#e5e7eb` inset outline**，不做按类着色；`RewardCard.jsx:84-85` 的 `border-yellow-400` / `border-purple-400` 类**保留不动**（无承载体、不产生视觉）。稀有度**辨识**仍由卡内徽章 `bg-yellow-400 / bg-purple-400 / bg-blue-400`（`:89-94`）承担 ⇒ **可辨识性判据不变**。
4. **连带关闭**：`OPEN-ITEMS` **`B42` / `B43`** 各追加一行状态改写（**✅ 已裁 · 本项关闭**；原行逐字保留）· master **§5.432** + 版本行 **v0.349** · 交付件 `ops/card-rows/SPEC-NOTE-decisions.md`。**本节不升 design 版本号**（承 §26.10 / §26.11.7 体例：实现面 / 裁定面回写不升版）。

#### 26.11.9 参考图口径修（2026-10-19 · **追加式勘误、不升版** · Kevin 补交价格行参考图 · 四项 = 色值 / 字号 / 间距 / 基线 ＋ **对齐由「两端对齐」改「左对齐分组」**）

> **性质**：Kevin 补交**「价格行」参考图**（实测口径见 A 表）⇒ 本节对 **§26.11.3（价格行形态）** 与 **§26.11.7 第 7 条（「左价右「n人想要」、两端对齐」）** 的价格行**视觉口径**作勘误。**旧句一字未删、逐字保留为历史字面**：§26.11.3 首条「形态 = `$` + 数字 + **一个半角空格** + `{{n}}人想要`（例 `$495 20人想要`）；`$` 与数字紧贴」· §26.11.7 第 7 条「左价右「n人想要」、两端对齐」· 实现侧注释 `reward-card.css`「左 `$`+数字 / 右「{n}人想要」，两端对齐」**全部保留可检索**；凡与本节冲突处 **以本节为准**。**几何面一字未动**：`row3-wrap-price` 恒 **24** 高、卡高恒 **392**、四行 **48/32/24/48**（§26.11.1 表与 §26.11.5 #1–#2 继续有效）。

**A. 参考图实测 → 本站落值（冻结）**

| # | 项 | 参考图（实测） | 本站落值（冻结） |
|---|---|---|---|
| 1 | 数字色 | 亮橙红 **`#FF4D00`** | 数字**与符号同色** `#FF4D00`（本节前实现取墨色 `#030402` ⇒ 作废） |
| 2 | 数字字号 / 字重 | 加粗大号 | **`17px` / `700`** |
| 3 | 符号 | 同色、字号 ≈ 数字的 **0.5**、**与数字基线对齐** | **`0.6em` / `700`**（= `17 × 0.6` = **10.2px**）；`align-items: baseline` |
| 4 | 「N人想要」 | 浅灰 **`#999999`**、常规小号 | **`12px` / `400` / `#999999`**，与价格**同基线** |
| 5 | 间距 | **紧跟价格右侧**（参考图 **864** 宽下 ≈ **20px**，按 1/4 折算） | **`gap: 8px`**（落到本卡 224 卡内宽；非两端撑开） |
| 6 | 布局 / 装饰 | 单组**左起**；**无图标、无分隔点** | `display:flex` ＋ `align-items:baseline` ＋ **`justify-content:flex-start`**；不渲染图标 / 分隔点 |

**B. 落点与层级（不进主题 token 层）**：色值与字号落 **`frontend/src/components/reward/reward-card.css` 局部常量** —— `--sf-reward-price-fg: #FF4D00`（数字 + 符号共用）、数字 `17px / 700`、符号 `0.6em / 700`、`wants` `12px / 400 / #999999`、`gap: 8px`。**不新增主题 token、不改 `tokens.js` 的 `TOKEN_KEYS`、不改 `theme-tokens.css` 键集、不触发 PROV 改指**：卡片为白底浅卡、**日 / 夜两档同貌**（承 §26.11.7 价格三色「卡片子树内局部重绑」体例），且「颜色以外不进主题层」先例见 §26.11.6 #6（引 §24）。⇒ 本节属**卡片局部样式常量**，不是 `--sf-*` 主题 token 增项。

**C. 符号仍取站内 `$`（不是参考图的 `¥`）**：参考图写 `¥`，本站**计价单位为积分**（master §2「符号只用一个 `$`」· `r9-93` 价格块）⇒ 沿用 **`$`**；卡面出现 `¥` 仍按 §26.11.3 / §26.11.5 #6 **判负**。要改 `¥` ⇒ **一句话可改**（仅符号字符，不动色值 / 字号 / 间距 / 布局）。

**D. 判负追加（4 条 · 与 §26.11.5 九条并存、只增不改；其后判负以本节为准）**

| # | 探针 | 期望（违反即判负） |
|---|---|---|
| 10 | 价格数字 computed `color` | **`rgb(255, 77, 0)` = `#FF4D00`**（非 `#FF4D00` ⇒ 判负；含符号色不同步） |
| 11 | 价格数字 computed `font-weight` | **`700`**（< 700 ⇒ 判负） |
| 12 | `row3-wrap-price` 行高 | **恒 24**（`offsetHeight = 24`；数字 17px 被 `line-height:1.5` 撑到 **25.5px** 溢出 / 行高被抬 ⇒ 判负） |
| 13 | 价格行布局 | **左对齐分组**（`justify-content: flex-start`）；`space-between` / `flex-end` / `wants` 靠右 **= 两端对齐回潮 ⇒ 判负** |

- **不列入主判负的读数（登记项，避免亚像素误判）**：`gap: 8px`（±1px 内计通过）与 `align-items: baseline`（符号 / 数字 / `wants` 三者基线差 ≤ 1px 计通过）——**两项为形态读数，失配先记读数、不与 #10–#13 同权判负**。
- **§26.11.5 原 #6 / #7 不废**：#6（价格行含 `$`、无 `¥`）与 #7（`wants` 与 `listing_favorite` 计量逐行相等）**继续有效**；本节只**追加** #10–#13，不改动原九条。

**E. 已知张力（披露 · 一句话可改）**：符号 `0.6em × 17px = 10.2px`，低于本册 §13「手机档可见文本最小字号 **12px**」。本节按 Kevin 参考图口径锁 **比例 0.6em**（判负只盯**比例 / 基线**、不盯符号绝对字号）；若要同时满足 12px 硬线 ⇒ 符号须 **`0.71em`（= 12.07px）** 或直接 `12px` 绝对——**待裁、一句话可改**，本版不改。

**F. 实现面状态（诚实边界 · 本笔零代码）**：**编制起点（`0c7ca0f` · 工作区干净）**读数为 **5 处不符** —— 数字 `1rem`（16px）/ `#030402`（墨色）· 符号 `0.75em` · `justify-content: space-between` · `wants` `#9CA3AF` + `text-align:right`。**落笔期间并行实现单已把 `reward-card.css` 改到本节口径**（现取：`--sf-reward-price-fg: #FF4D00` · 数字 `17px / 700` · 符号 `0.6em / 700` 同色 · `.sf-reward-price` 与 `row3-wrap-price` 均 `justify-content:flex-start` + `align-items:baseline` · `gap:8px` · `wants` `12px / 400 / #999999` · `line-height:24px` 收住 24 盒）—— **该改动非本单写面（本单未碰、未 add）**，终值与验收以**实现单 / 质检单**为准，本单不背书。本节为**规范先行**：判负 #10–#13 自实现落定起可承重；比对一律取**计算值**（`color` = `rgb(255, 77, 0)`、`offsetHeight` = 24、`justify-content` = `flex-start`）。

**G. 连带与本笔性质**：master **§5.433** ＋ 版本行 **v0.350**；**design 不升版**（承 §26.10 / §26.11.7 / §26.11.8 体例：裁定面 / 实现面回写不升版）。本笔**只写 `docs/**`**、零代码、零迁移、零测试改动、**不 push**；`git diff --numstat` 删除列 **0**（纯追加）。

#### 26.11.9.1 符号字号修正：`0.6em` ⇒ `12px` 绝对值（2026-10-19 · **追加式、不升版** · 「可见文本 ≥12px」硬口径压过参考图比例）

> **性质**：本节**只追加**。§26.11.9 A 表第 3 行与 §26.11.9 E 的旧字面**逐字保留**——A 表第 3 行「符号…**`0.6em` / `700`**（= `17 × 0.6` = **10.2px**）；`align-items: baseline`」· E「符号 `0.6em × 17px = 10.2px`，低于本册 §13「手机档可见文本最小字号 **12px**」…**待裁、一句话可改**，本版不改」——**凡与本节冲突处，以本段为准**。触发 = 实现 `4db0efa` 已按参考图原文落 `0.6em`，该值**低于 §13 / `T79`「产品页可见文本最小字号 ≥12px」硬口径**（本册 §26.11.9 E 已就此披露张力，但当时只「待裁」）；修正提交 **`1c5d03d`**，生产终验 **`376a1db`**。

**A. 裁定（以本段为准）**

| # | 项 | 旧字面（保留可检索 · 作废） | **现行落值（本节）** |
|---|---|---|---|
| 1 | 符号 `font-size` | `0.6em`（`17 × 0.6` = **10.2px**） | **`12px` 绝对值**（不取 `0.71em`，避免随数字字号漂移） |
| 2 | 符号 : 数字 比例 | 参考图 **0.5**；§26.11.9 A 表取 **0.6** | **`12 / 17 ≈ 0.71`** —— **取代参考图的 0.5**（也取代 0.6），比例让位于下限 |

- **理由（一句话）**：§13 / `T79` 的「可见文本 ≥12px」是**硬口径**，参考图的「符号 ≈ 数字 0.5」是**形态偏好** ⇒ **冲突时比例让位**；符号为真实可见文本（`$` 单字符），不属 §13.6 / N20 的装饰性排除项。
- **不取 `0.71em` 的理由**：`em` 会随数字字号联动，将来数字若改（如 16px ⇒ 0.71em = 11.36px）会**再次跌破下限**；绝对值 `12px` 把下限**钉死在字面**上，判负可一眼判。

**B. 未变项（逐项继续有效）**：符号**同色** `#FF4D00`（`var(--sf-reward-price-fg)`）· `font-weight: 700` · **与数字同基线**（父 `.sf-reward-price` `align-items: baseline`）· `gap: 8px` · `justify-content: flex-start` · `wants` `12px / 400 / #999999` · `row3-wrap-price` 恒 **24** · 卡高恒 **392** · 四行 **48/32/24/48**。⇒ §26.11.9 A 表 **#1 / #2 / #4 / #5 / #6** 与 §26.11.5 九条、§26.11.7、§26.11.8 **全部不动**；本节只改 A 表第 3 行的**分母**（字号与比例），符号的色 / 字重 / 基线三项**一字未改**。

**C. 判负追加（第 14 条 · 与 #10–#13 并存、只增不改；其后判负以本节为准）**

| # | 探针 | 期望（违反即判负） |
|---|---|---|
| 14 | 符号 `.sf-reward-price-cur` computed `font-size` | **= `12px` 且 ≥ 12px**；**`font-size` < 12px 即判负**（回退 `0.6em` ⇒ computed **10.2px** ⇒ **必红**） |

- 与 #10–#13 的权重关系：#10（数字色）/ #11（数字 700）/ #12（行高 24）/ #13（左对齐）**同权**；`gap 8px ±1`、三槽基线差 ≤ 1px 仍为**读数登记项**，不与判负同权（承 §26.11.9 D 附注）。

**D. 负控自证（判据有分辨力 · 两层）**

| 层 | 动作 | 观测 |
|---|---|---|
| 探针 | CSS 临时改回 `0.6em`，重跑 `ops/card-rows/price-ref/probe-price-row.mjs` | **`VERDICT=FAIL` · red 8/108**；四相（1440 / 1536 × 日 / 夜）**只红两条** —— `cur-font-size=12px`（实测 **10.2px** ×4）与 `cur-font-size≥12px-floor`（10.2px ×4）；颜色 / 基线差 0 / 行高 24 / `gap` 8 / 左对齐 12 **全绿** ⇒ 不误伤、不恒红 |
| 单测 | CSS 临时改回 `0.6em`，跑 `reward-card-resize.test.jsx` | **`1 failed / 26 passed`**（该断言红）；恢复后 **27 passed** |

- 证据：`ops/card-rows/price-ref/fix-symbol-12px.json` 的 `negativeControl`（探针 + 单测两段，均含 `restored: true`）。

**E. 实现面与生产终验（现取 · 已过）**

- **修正提交 `1c5d03d`**：`frontend/src/components/reward/reward-card.css` 的 `.sf-reward-price-cur` —— `font-size: 0.6em` ⇒ **`font-size: 12px`**（注释同步写「不得回退到 0.6em=10.2px」）；`reward-card-resize.test.jsx` 源码文本锚同步（`toContain('font-size: 0.6em')` ⇒ `toContain('font-size: 12px')` + `not.toMatch(/font-size:\s*[\d.]+em/)` + `parseFloat ≥ 12`）；`probe-price-row.mjs` 断言由「≈10px」改两条（`=12px` ＋ `≥12px floor`）。**未动**：色值 / 字重 / 基线 / `gap` / 左对齐 / `wants` / 行高 / 卡高。
- **生产终验 `376a1db` · PASS**（证据目录 `ops/card-rows/price-ref/prod-verify/`）：**同版 sha256** = js `13a6b63c…`（`index-KeEbxjcR.js` · 497,255 B）/ css `8b9440a7…`（`index-CheJaC-a.css` · 126,147 B）—— 与本地 `HEAD` 构建**逐字相等**（CSS 因 +140 B 修正而换哈希，js 未变 ⇒ 证明本批**只动了 CSS**）。
- **生产读数（1440 日档 / 1536 夜档 × 7 卡）**：数字 **`17px / 700 / rgb(255, 77, 0)`** · 符号 **`12px` / `rgb(255, 77, 0)`** · `wants` **`12px / rgb(153, 153, 153)`** · **基线差 0** · 行 `justify-content = flex-start` · 行高 **24** · 卡高 **392 ×7** · 图 **240 ×7** · `pageerrors` / `consoleErrors` 各 **0**。

**F. 参考图差额（登记 · 已不再「待裁」）**：参考图符号 ≈ 数字 **0.5**，本站实际 **0.71**（12 / 17）⇒ **符号相对参考图偏大**，属**下限约束的必然代价**，本节**接受**该差额、**不再挂待裁**。若 Kevin 仍要 0.5 观感，唯一同时守住 12px 的路径是**缩数字**（17px ⇒ 12px 会毁价格层级，不推荐）或**放宽 §13 / `T79` 下限**（须 Kevin 级裁定）—— 两者均**不在本节授权内**，`0.6em` **不得**作为「恢复参考图比例」的回退方案。

**G. 连带与本笔性质**：master **§5.434** ＋ 版本行 **v0.351**；交付件 `ops/card-rows/SPEC-NOTE-price-prod.md`。**design 不升版**（承 §26.10 / §26.11.7 / §26.11.8 / §26.11.9 体例）。本笔**只写 `docs/**` + `ops/card-rows/**`**、零代码、零迁移、零测试改动、**不 push**；`git diff --numstat` 删除列 **0**（纯追加，新建件为全文新增）。

## §26.12 ★★ v1.25 续 · **商品分类枚举与「包邮」标签**：`item_type = PhysicalFreeShip` ⇒ 卡面 `row1-wrap-title` 内、**标题文字之前**渲染「包邮」（黑字 `#202020` / 黄底 `#FFE60F` / 12px / 圆角 2px / 与标题间距 4px / **不破标题行高 48**）—— **零新 token**（只复用既有 `--sf-btna-fg` / `--sf-btna-bg`）· 发布页 = **2 + 2 两控件**（数字/实物 × 包邮/不包邮，合成单字段 `item_type`）· 判负 **#15–#19**（**本节只追加 · §1–§26.11 一字未动 · 编号现取 = `§26.11.9.1` 之后 · 本笔只登记，实现另单并行**）

#### 26.12.0 依据与作用面

- **需求（逐字转引 · 出处披露）**：商品分类枚举 `ItemType { Digital, PhysicalFreeShip, PhysicalBuyerShip }`；「其中 `PhysicalFreeShip` 在卡片上显示中文标签【包邮】（黑字黄底，位置在**商品标题前面**，参考图：方角/近方角的黄底黑粗字）。」
  - **诚实登记**：以上文字转自本单派单（`ops/item-type/SPEC-NOTE.md`），**原始会话未入仓** ⇒ 与 Kevin 原话若有出入，以 Kevin 后续一句话为准（本节**不伪造逐字引语**）。
- **作用面**：① 卡片 `row1-wrap-title`（§26.11.1 行 1）内新增标签节点；② 发布页商品分类字段（**2 + 2 两控件**：数字/实物 × 包邮/不包邮，见 §26.12.4）。
- **不动的面（逐字保留）**：卡高 **392** · 四行 **48 / 32 / 24 / 48** · 图 **240** · 标题截断口径（§26.11.2，48 显示宽单位 + 字面 `...`）· 价格行（§26.11.3 与 §26.11.9.1）· 卖家行（§26.1d/e）· 主题 token 层（`tokens.js` / `theme-tokens.css`）。

#### 26.12.1 位置与几何（冻结 · 唯一读法）

| 项 | 值 | 判据 / 说明 |
|---|---|---|
| **显示条件** | **仅** `item_type === 'PhysicalFreeShip'` | 其余三态（`Digital` / `PhysicalBuyerShip` / `NULL`）**一律不渲染标签节点**（矩阵见 §26.12.3） |
| **位置** | `row1-wrap-title` **内**、**标题文字之前**（行首第一个 inline 节点） | 判据 = DOM：标签节点须是标题文本节点（或其 `<span>`）的**前一个兄弟**；渲染在 `row2-wrap-service` 里 / 标题之后 / 独立成行 ⇒ 位置错（判负 #18） |
| **文字** | `t('item.freeShipping')`（zh「包邮」） | **四语同键**（§26.12.4）；**不得**硬编中文字面 |
| **字号 / 字重** | **12px / 700** | 12px = §13 / `T79`「可见文本 ≥12px」下限（**不得更小**，承 §26.11.9.1 口径）；700 对参考图「黑粗字」 |
| **字色 / 底色** | **`#202020`** = `var(--sf-btna-fg)` / **`#FFE60F`** = `var(--sf-btna-bg)` | **零新色值**（§26.12.2） |
| **盒** | `display:inline-block` · `height:16px` · `line-height:16px` · `padding:0 4px` · `vertical-align:middle` | 16px 盒 < 24px 行盒 ⇒ **不抬行**；`middle` 使其在行内垂直居中 |
| **圆角** | **2px**（近方角） | 参考图「方角 / 近方角」；**不得**用胶囊 `999px`（`--sf-st-radius-pill`）或按钮 8px（`--sf-st-radius-btna`）—— 二者都会把「贴纸」观感改成「按钮」 |
| **图文间距** | 标签与标题文字 **4px** | `margin-right:4px`（或父级 `gap`），**四邻不叠**：标题文字紧贴 4px 之后 |
| **不换行** | `white-space:nowrap` | 「包邮」两字不得折行；`flex` 行内 `flex:0 0 auto`（不得被压扁） |
| **行高（硬）** | `row1-wrap-title` `offsetHeight` **恒 48** | 标签抬行 / 折行 / `align-items` 变 `flex-start` 撑高 ⇒ **判负 #16** |
| **卡高（硬）** | 卡总高 **恒 392** | 承 §26.11.1；标签不得引发卡高变化 |

- **垂直空间账**：`row1` 盒 48 = **两行 × 24**（§26.11.2 两行截断）；标签 16px 盒夹在第一行 24px 行盒内 ⇒ 行盒不变、行数不变、48 不变。**判负只认 `offsetHeight`**（亚像素不猜）。

#### 26.12.2 颜色 / 字号落点（零新 token · 零新色值）

- **复用既有 token**：`--sf-btna-fg: #202020` / `--sf-btna-bg: #FFE60F` —— 现取 `frontend/src/theme/theme-tokens.css:151-152`（日档）/ `:267-268`（夜档），**两档同值** ⇒ 标签**日夜同貌**（承 §26.11.7「白卡日夜同貌、颜色以外不进主题层」体例）。
- **禁止**：新增 `--sf-*` 颜色变量 / 改 `theme-tokens.css` / 新增 `tokens.js` 的 `TOKEN_KEYS` 项（现取 `frontend/src/theme/tokens.js:273` `TOKEN_KEYS = Object.keys(DAY)`）/ 往 `STRUCT` 塞颜色 / 改 `STRUCT_PROV` 溯源 / 在标签规则里写 `#FFE60F`、`#202020` 以外的颜色字面（含「更亮的黄」「更深的黑」微调）。
- **允许**：`color: var(--sf-btna-fg); background: var(--sf-btna-bg);` 两行取值；如需局部别名，只允许**引用**（`--sf-it-badge-fg: var(--sf-btna-fg)` 之类）**不得引入新字面值**。

#### 26.12.3 显示矩阵（唯一读法 · 四态全覆盖）

| `item_type` | 标签 | 备注 |
|---|---|---|
| `Digital` | **不显示** | 虚拟商品无「包邮」语义 |
| **`PhysicalFreeShip`** | **显示「包邮」** | **唯一**显示值 |
| `PhysicalBuyerShip` | **不显示** | 买家付运费 ⇒ 写「包邮」= 误导（**最严重的一类错误**） |
| `NULL`（未分类 / 存量） | **不显示** | 承 data §40.8 D：`NULL` ≠ `Digital`，但**可见结果相同**（无标签） |
| 闭集外的未知值（库侧 CHECK 兜底，理论不可达） | **不显示** | 读侧 fail-quiet（不抛错、不白屏）；登记即可，不判负 |

#### 26.12.4 发布页字段与 i18n（**2 + 2 两控件** · 契约数 · 四语同补）

> **★ 本节口径 = Kevin 2026-10-20 追加更正**（逐字转引）：「商品分类」改为 **2 选 1：数字商品 / 实物商品**；**另有选项 2 选 1：包邮 / 不包邮**。映射到存储枚举（不变，仍 3 值）：数字商品 ⇒ `Digital`；实物 + 包邮 ⇒ `PhysicalFreeShip`；实物 + 不包邮 ⇒ `PhysicalBuyerShip`。数字商品时「包邮/不包邮」不适用 ⇒ **该控件隐藏、不参与载荷**。校验：类型必选；选实物时运费项必选（前端闸，服务端仍以 `item_type` 为唯一真值）。**本单落笔中间态曾按「必选 3 选 1 单控件」写过草稿，该稿未入库、无历史留痕** ⇒ **以本节 2 + 2 口径为唯一现行读法**（自我披露见 §26.12.6）。

- **控件 A · 商品分类（必选 · 2 选 1）**
  - `<select required>`，钩子 **`data-sf-m="item-select-type"`**（承 `item-select-cid` 命名体例；**不得**复用 `item-input-*` 前缀 —— 它是选择器不是输入框）。
  - 选项**恰 2 项**：`t('itemType.digital')`（值 `digital`）/ `t('itemType.physical')`（值 `physical`）；初始值 = **空**（占位 `—`，`value=""`）⇒ 未选**不可提交**。
  - 提交前闸：空 ⇒ 阻止提交（HTML `required` + JS 双保险；**不得**把 `''` 发给后端 —— 后端按「空串 = 非法」判 400）。
- **控件 B · 运费（条件必选 · 2 选 1）**
  - `<select required>`，钩子 **`data-sf-m="item-select-ship"`**；选项**恰 2 项**：`t('itemType.freeShip')`（值 `free`）/ `t('itemType.buyerShip')`（值 `buyer`）；初始值 = **空**。
  - **显示条件 = 控件 A 选 `physical`**；选 `digital` ⇒ **控件 B 不渲染（`display:none` 不足够 —— 必须不参与表单/不参与载荷）**，且其值**重置为空**（避免「先选实物、再改数字」把 stale 值带进载荷）。
  - 提交前闸：A = `physical` 且 B 为空 ⇒ 阻止提交（提示复用/新增文案键归实现单裁量，**不新增文案键**优先 —— 用浏览器原生 `required` 气泡即可，零新键）。
- **合成（前端唯一职责）= 单字段 `item_type`**

| 控件 A | 控件 B | → `item_type`（载荷逐字） |
|---|---|---|
| `digital` | （隐藏、不参与） | **`Digital`** |
| `physical` | `free` | **`PhysicalFreeShip`** |
| `physical` | `buyer` | **`PhysicalBuyerShip`** |
| 空 | — | **不可提交**（前端闸） |
| `physical` | 空 | **不可提交**（前端闸） |

- **载荷形状**：只发 `item_type`（三值逐字 PascalCase，**不翻译**）；**不发** `shipping` / `free_ship` / `shipping_free` 之类第二字段（服务端不认，见 route §49.11）。`listingPublishFingerprint` 是否纳入 `item_type` 归实现单裁量（route §49.11 ③「服务端指纹不纳入」与之不冲突；前端纳入更安全）。
- **新键（5 条 × 四语 · 键名可按现取微调，数量口径固定 5）**：

| 键 | zh | en | hk | vn |
|---|---|---|---|---|
| `itemType.digital` | 数字商品 | Digital goods | 數字商品 | Hàng kỹ thuật số |
| `itemType.physical` | 实物商品 | Physical goods | 實物商品 | Hàng vật lý |
| `itemType.freeShip` | 包邮 | Free shipping | 包郵 | Miễn phí vận chuyển |
| `itemType.buyerShip` | 不包邮 | Buyer pays shipping | 不包郵 | Người mua trả phí vận chuyển |
| `item.freeShipping` | 包邮 | Free shipping | 包郵 | Miễn phí vận chuyển |

- **非 zh 三语 = 待复核**（承站内既有体例：非中文文案由 Kevin 复核，本表只给可用值、不阻断实现）。
- **键数现取（2026-10-20 · `python3 -c` 逐文件复算改前值）**：**top `129 → 130`**（+1 = 新顶层命名空间 `itemType`）· **flat `1115 → 1120`**（+5 = 4 个选项标签 + 1 个卡面标签）· **四语节点 `4460 → 4480`**（= 1120 × 4；四语各文件 top/flat 现取相等）· `item` 命名空间 **53 → 54**。
- **计数前推家族**：**12 个测试文件**硬编 top / flat / nodes 三数（现取 `grep -rl "4460\|1115" frontend/src/test` = **12** 文件）⇒ 前推归**实现单**，本册不改测试（口径同 §26.11.4 / §26.11.7）。

#### 26.12.5 判负（5 条 · 与 §26.11.5 九条、§26.11.9 #10–#14 并存、只增不改；其后判负以本节为准）

| # | 探针 | 期望（违反即判负） |
|---|---|---|
| **15** | 四态各取一件卡，读 `row1-wrap-title` 内标签节点是否存在 | **仅 `PhysicalFreeShip` 有标签**；`Digital` / `PhysicalBuyerShip` / `NULL` 出现标签 ⇒ **判负**（尤其 `PhysicalBuyerShip` 显示「包邮」= 误导，**零容忍**） |
| **16** | 带标签卡的 `row1-wrap-title` `offsetHeight` | **恒 48**（≠ 48 ⇒ 标签抬行 / 折行 / 撑高，**判负**）；同时卡总高须 **392** |
| **17** | 色值来源 + token 层 diff | 标签底色/字色**必须**来自 `var(--sf-btna-bg)` / `var(--sf-btna-fg)`；**`tokens.js` `TOKEN_KEYS` 新增键 / `theme-tokens.css` 新增颜色变量 / 标签规则出现 `#FFE60F`·`#202020` 以外的颜色字面 ⇒ 判负** |
| **18** | 标签 DOM 位置 | 必须是 `row1-wrap-title` 内**标题文本之前**的兄弟（DOM 顺序可判）；渲染在标题后 / 行 2 / 独立行 / 行外 ⇒ 判负 |
| **19** | 发布页两控件（`item-select-type` / `item-select-ship`）联动 | ① 选 `digital` 时**运费控件仍可见 / 仍进载荷**（含 stale 值带进 `item_type`）⇒ 判负；② 选 `physical` 未选运费即可提交 ⇒ 判负；③ 分类未选即可提交 ⇒ 判负；④ 载荷出现 `item_type` 以外的第二个分类字段（`shipping` / `free_ship` 等）⇒ 判负 |

- **读数登记项（不判负 · 避免亚像素与主观口径误判）**：横向 `padding` **4px ±1**、圆角 **2px ±1**、间距 **4px ±1**、字重 600–700、`vertical-align` 的具体取值（只要求「不抬行」）—— 失配**先记读数**，不与 #15–#19 同权。
- **原判负不废**：§26.11.5 九条（含 #5「尾非字面 `...`」）与 §26.11.9 #10–#14 **继续全额有效**；本节只**追加** #15–#19。

#### 26.12.6 已知张力 / 未做（诚实边界）

- **★ 标签占宽 vs 标题两行容量（登记 · 实测归实现单）**：`row1` 现取 1440 档卡内宽 207 − `padding:0 10px` ×2 = **187px** 可用 ⇒ 14px 字号下两行约 24 汉字（§26.11.2 的 48 显示宽单位正好落在两行）。标签宽 ≈ **32px**（12px × 2 字 + 8px padding）+ 4px 间距 = **36px** ⇒ **首行**可用宽降至 ≈ **151px**（少 ≈ 2.5 汉字），两行总容量可能不足以容纳 48 单位 ⇒ **末尾字面 `...` 有被行盒裁掉的风险**（该风险已由 §26.11.5 **#5** 判负兜底：`...` 被裁即红）。
  - **不改本契约的三种缓解（择一，交实现单实测后定）**：① 标签 `padding:0 3px`（省 2px）；② `row1` `padding` 由 10 改 **8**（省 4px，两行各让 4px）；③ 接受首行少 2–3 汉字（截断上限仍是 48 单位，只是视觉上 `...` 提前出现）。
  - **本册不预选**：三种都满足「行高 48 / 字号 12px / 色值 / 位置」硬项，**判负不区分**；实测读数归实现单 / 质检单。
- **未做（本笔零代码 · 明账）**：卡面标签与发布页两控件**均未实现**、**未跑任何探针 / 单测 / 浏览器实测**；i18n **5 键**未落盘、12 个计数测试文件未前推；`item_type` 未落库（data §40.8、迁移 `0053` 未写）。九条 AC + 本节五条判负**一条未跑**。
- **★ 自我披露（口径变更轨迹 · 不藏）**：本节**落笔中间态**曾按派单原文写作「发布页必选 **3 选 1**（`Digital` / `PhysicalFreeShip` / `PhysicalBuyerShip`）单控件」；**Kevin 在本单执行中追加更正**为 **2 + 2 两控件**（数字/实物 × 包邮/不包邮）⇒ 本册按更正版落定（§26.12.4）。**存储枚举三值不变**、`item_type` 仍是载荷唯一字段、卡面判负 #15–#18 **一字未动**；中间态未入库 ⇒ `git diff` 无「删行」、无历史留痕可查，**故在此登记**。
- **连带**：master **§5.435 + 版本行 v0.352** · route **§49.11 续登** · data **§40.8** · 交付件 `ops/item-type/SPEC-NOTE.md`。**design 不升版**（承 §26.10 / §26.11.7 / §26.11.8 / §26.11.9 / §26.11.9.1 体例：裁定面与契约续登不升版）。本笔**只写 `docs/**` + `ops/item-type/**`**，零代码、零迁移、零测试改动、**不 push**；`git diff --numstat` 删除列 **0**（纯追加）。

#### 26.12.7 上线收口 · `vertical-align: baseline`（2026-10-20 · 追加 · **不升版** · 旧字面逐字保留）

> **以本段为准**：`.sf-reward-ship-tag` 的 `vertical-align` **取 `baseline`**（落盘 `frontend/src/components/reward/reward-card.css:159`）；**§26.12.1「盒」行所写的 `middle` 于现行读法作废**（该行字面**逐字保留、一字不删**，只在本节改写状态）。判据不变 —— 只认 `row1-wrap-title` `offsetHeight` **48** 与卡总高 **392**（§26.12.5 **#16**），实测 1536 日/夜双档两值均成立、横向溢出 0。

- **裁定依据**：「包邮」盒 **16px < 行盒 24px** ⇒ `baseline` 与 `middle` **都不抬行**；`baseline` 使标签与标题**同基线**贴齐，观感与参考图一致（**目视结论，非机读项**）。⇒ **不改落盘、不改判负**：`vertical-align` 的具体取值仍属 §26.12.5 的**读数登记项**（「只要求不抬行」），**不作判负项**、不入 #15–#19。
- **旧字面处置（逐字）**：§26.12.1 表「盒」行 `vertical-align: middle` **保留原文**；要判现行合规只读本节 —— 「以本段为准」。
- **第二处口径差（同批登记）**：**空串口径** —— `ops/item-type/SPEC-NOTE.md` **§5.1 第 1 项**记「落盘：空串 ⇒ `null`」，现行 `normalizeItemType` **先 `trim` 再闭集判定** ⇒ `""` / `"   "` **均 `400`**（`LEDGER_AMOUNT_INVALID` / `reason=NOT_IN_CLOSED_SET` / `allowed` 三值 / 零行写入）⇒ **与 §26.12.4 契约一致，差额结案**（旧记逐字保留）。
- **连带**：master **§5.436 + 版本行 v0.353** · `docs/OPEN-ITEMS.md` **`B44`**（发布页未新增 `item.typeRequired` 错误键）· 交付件 `ops/item-type/SPEC-NOTE-closure.md`。**本笔零代码 / 零测试改动 / 零 HTTP 实测**，只写 `docs/**` 与 `ops/item-type/**`，**纯追加删行 0**、**不 push**。

#### 26.12.8 发布页 **2 + 2 + 2 三控件** ＋ 卡面**两枚标签（黄【包邮】/ 绿【自动发货】）**（四值修订 · 2026-10-20 · 追加 · **不升版** · 旧字面逐字保留）

> **以本段为准**：① §26.12.4 的「**2 + 2 两控件**」在**数字分支**上升级为 **2 + 2 + 2 三控件**（一级 2 选 1 + **按分支各一套** 2 选 1 二级）；② `item_type` 由**三值换四值**（`DigitalAutoDeliver` / `DigitalManualDeliver` / `PhysicalFreeShip` / `PhysicalBuyerShip`），**`Digital` 退役**；③ **卡面标签由「仅 `PhysicalFreeShip`」扩为「两值两色」** —— 新增 **`DigitalAutoDeliver` ⇒【自动发货】（绿底黑字）**，位置与【包邮】**完全一致**。§26.12.1 / §26.12.3 / §26.12.4 的旧字面**逐字保留**（其「仅 `PhysicalFreeShip` 显示」「卡面只消费 `PhysicalFreeShip`」等句**于现行读法作废**，只在本节改写状态）。**本册不升版**（承 §26.10 / §26.12.7 体例）；**头注版本块不改写**。

**A. 三控件 · 唯一读法**

| 控件 | 层级 | 组钩子 | 选项（值 → 标签键） | 何时在场 | 必选 |
|---|---|---|---|---|---|
| **A** | 一级（恒在场） | `item-select-type` | `digital` → `itemType.digital` · `physical` → `itemType.physical` | **恒在场** | **必选** |
| **B1** | 二级 · 数字 | `item-select-deliver` | `auto` → `itemType.autoDeliver` · `manual` → `itemType.manualDeliver` | **仅** A = `digital` | **必选** |
| **B2** | 二级 · 实物 | `item-select-ship` | `free` → `itemType.freeShip` · `buyer` → `itemType.buyerShip` | **仅** A = `physical` | **必选** |

- **两二级控件互斥在场（硬）**：任一时刻**至多一个**在 DOM；未选分支的控件**必须不渲染**（`display:none` 不足够 —— 会留在表单与可达树里，承 §26.12.4）。判负 #21。
- **切换清空（硬）**：切换一级分支（`digital` ↔ `physical`）⇒ **两个二级值都重置为空**；只清「被切走那个」不够 —— 残留会在切回时变 stale 值并污染载荷 / 让提交闸误判（判负 #22）。
- 选项渲染形态 = 每组 `role="radiogroup"` + `aria-required="true"`（现役落盘体例，承 §26.12.4 的「必选语义」；`<select required>` 与 radio 组**等价可接受**，见 E 的读数登记项）；选项钩子 = `item-input-type-<value>` / `item-input-deliver-<value>` / `item-input-ship-<value>`。
- 每级初始值 = **空**（未选）⇒ **不给默认值**（默认值 = 替用户选，静默错分类，承 data §40.8 D 同纪律）。

**B. 合成（前端唯一职责）= 单字段 `item_type`**

| 控件 A | 二级 | → `item_type`（载荷逐字） |
|---|---|---|
| `digital` | `auto` | **`DigitalAutoDeliver`** |
| `digital` | `manual` | **`DigitalManualDeliver`** |
| `physical` | `free` | **`PhysicalFreeShip`** |
| `physical` | `buyer` | **`PhysicalBuyerShip`** |
| 空 | — | **不可提交**（前端闸） |
| `digital` / `physical` | 空 | **不可提交**（前端闸） |

- **载荷形状**：只发 `item_type`（四值逐字 PascalCase，**不翻译**）；**不发** `shipping` / `deliver` / `free_ship` / `shipping_free` 之类第二字段（服务端不认、出现即忽略；route §49.11.1 ⑥）。
- **提交闸位置**：`onSubmit` **最前**、**零网络调用**（先于图片上传等任何动作）；未选一级 / 二级未选 ⇒ 阻断 + 组级 `aria-invalid` + 选项行高亮；提示**复用既有错误键**（`uiError.badRequest`），**不新增文案键**（承 §26.12.4 与 `OPEN-ITEMS B44` 口径）。

**C. i18n（**+2 键 × 四语** · 键数现取复算 · 卡面绿标**不新增键**）**

| 键 | zh | en | hk | vn | 状态 |
|---|---|---|---|---|---|
| `itemType.digital` | 数字商品 | Digital goods | 數字商品 | Hàng kỹ thuật số | **保留** · 语义 = **一级组标签**（**非存储值**，不得再作为 `item_type` 载荷） |
| `itemType.physical` | 实物商品 | Physical goods | 實物商品 | Hàng vật lý | 保留 · 一级组标签 |
| **`itemType.autoDeliver`** | 自动发货 | Auto delivery | 自動發貨 | Giao hàng tự động | **新增**（**同时**用作二级选项文案**与卡面绿标文案，一键两用） |
| **`itemType.manualDeliver`** | 手动发货 | Manual delivery | 手動發貨 | Giao hàng thủ công | **新增**（仅二级选项文案） |
| `itemType.freeShip` | 包邮 | Free shipping | 包郵 | Miễn phí vận chuyển | 不变 |
| `itemType.buyerShip` | 不包邮 | Buyer pays shipping | 不包郵 | Người mua trả phí vận chuyển | 不变 |
| `item.freeShipping` | 包邮 | Free shipping | 包郵 | Miễn phí vận chuyển | 不变（卡面黄标文案，仅 `PhysicalFreeShip` 消费） |

- **卡面绿标文案复用 `itemType.autoDeliver`** —— **不新增第三个键**（Kevin 追加口径逐字：「标签文案复用已存在的 `itemType.autoDeliver` 键（不新增键）」）。
- **★ 键名与存储字面是两层（别混）**：i18n 键名保持 **短名** `itemType.autoDeliver` / `itemType.manualDeliver`（= 派单指定键名），而**存储枚举字面**是 **`DigitalAutoDeliver` / `DigitalManualDeliver`**（Kevin 2026-10-20 定名，带 `Digital` 前缀）；前端 UI 选项 local value 用 `auto` / `manual`（**仅前端本地，不上送、不入库**）⇒ 三者**逐层分开**。若要「键名也带 `Digital` 前缀」（`itemType.digitalAutoDeliver` 一类）= 同名重命名、**键数不变**（flat **1122** / nodes **4488** 不动），**一句话可改**。
- **非 zh 三语 = 待复核**（承 §26.12.4 体例：非中文文案由 Kevin 复核，本表只给可用值、不阻断实现）。
- **键数前推（现取 `python3` 逐文件复算，改前 = 2026-10-20 编制时点）**：**top `130 → 130`**（`itemType` 命名空间**已存在**、不新增顶层）· **flat `1120 → 1122`**（**+2** = `autoDeliver` + `manualDeliver`；**卡面绿标零新增**）· **四语节点 `4480 → 4488`**（= 1122 × 4；四语各文件 top/flat 现取相等）· `itemType` 命名空间 **4 → 6 键** · `item` 命名空间 **54 → 54**（不变）。
- **计数前推家族**：现取 `grep -rlE 'toBe\(1120\)|toBe\(4480\)|flat=1120|flat: 1120' frontend/src/test frontend/scripts` = **13 个文件**（清单以现取为准；§26.12.4 旧记「12」已随加键漂移）⇒ 前推归**实现单**，本册不改测试（承 §26.12.4 / §26.12.7 口径）。

**D. 卡面标签（**两值两色** · 位置与几何同源、只有底色不同 · Kevin 2026-10-20 追加）**

| `item_type` | 标签 | 底色 | 字色 |
|---|---|---|---|
| **`PhysicalFreeShip`** | **【包邮】**（`t('item.freeShipping')`） | **`#FFE60F`** = `var(--sf-btna-bg)`（`rgb(255,230,15)`） | `#202020` = `var(--sf-btna-fg)` |
| **`DigitalAutoDeliver`** | **【自动发货】**（`t('itemType.autoDeliver')`） | **`#4ADE80`** = `var(--sf-reward-tag-auto-bg)`（`rgb(74,222,128)`） | `#202020`（**与包邮同黑**） |
| `DigitalManualDeliver` | **不显示** | — | — |
| `PhysicalBuyerShip` | **不显示**（写「包邮」= 误导，**最严重的一类错误**，承 §26.12.3） | — | — |
| `NULL`（未分类 / 存量） | **不显示** | — | — |

- **位置（两枚同源 · 硬）**：都必须是 `.row1-wrap-title` 内**标题文字之前**的**首子元素**（DOM 首子 = 标签节点，承 §26.12.1「位置」行与判负 #18）；**不得**放进 `row2-wrap-service`、不得置于标题之后、不得独占一行、不得两枚同时出现（一个商品只有一个 `item_type`，结构上不可能两枚同现；若同现 ⇒ 判负 #20 家族）。
- **几何 / 字号 / 字重 / 圆角 / 内边距 / 间距 / 对齐 = 全部沿用包邮标签口径**（承 §26.12.1 与 §26.12.7）：**12px / 700** · `height:16px` + `line-height:16px` · `padding:0 4px` · `border-radius:2px` · `margin-right:4px` · `display:inline-block` · `white-space:nowrap` · **`vertical-align: baseline`**（§26.12.7 现行口径）。**差异只允许「底色」一项。**
- **零新 token（硬）**：绿底落 `frontend/src/components/reward/reward-card.css` 的**卡内局部常量** `--sf-reward-tag-auto-bg: #4ADE80`（**与价格 `#FF4D00` 落局部常量同法**）⇒ **不进** `theme/tokens.js` 的 `TOKEN_KEYS`、**不进** `theme-tokens.css`、**不改** `STRUCT_PROV` / PROV 指针；因此 §26.12.2「禁止新增色值」在本值上是**唯一例外**且**仅限这一个常量名 + 这一个色值**。
- **§26.12.5 #17 的适用面在本段收窄**：#17「标签规则出现 `#FFE60F` / `#202020` 以外的颜色字面 ⇒ 判负」**只对黄标（`PhysicalFreeShip`）成立**；绿标规则里出现 `#4ADE80`（或其 `var()` 引用）**不算违例**，但出现**任何第三个色值**仍判负（承 #17 原意）。以本段为准。
- **行高与卡高不变**：两枚标签均 16px 盒 < 24px 行盒 ⇒ `row1-wrap-title` `offsetHeight` **恒 48**、卡总高 **恒 392**（判负 #16 对两枚同时承重）。
- **★ 占宽张力（登记 · 实测归实现单）**：【自动发货】4 字宽 ≈ **4×12 + 8 = 56px** + 4px 间距 = **60px**（比【包邮】的 32 + 4 = 36px 多 **24px**）⇒ 1440 档首行可用宽由 187 降至 ≈ **127px**（≈ 9 汉字），**两行总容量可能不足 48 显示宽单位** ⇒ 末尾字面 `...` 被行盒裁掉的风险更高（已由 §26.12.5 **#5**「尾非字面 `...`」兜底）。**不改本契约的缓解（择一，交实现单实测）**：① 标签 `padding:0 3px`；② `row1` 横向 `padding` 10 → 8；③ 接受首行少 2–3 汉字；④ 标签字号不得低于 12px（§13 硬口径，**不可**为腾宽而缩字）。

**E. 判负（**#20–#24** · 与 §26.12.5 的 #15–#19、§26.11.5 九条、§26.11.9 #10–#14 **并存、只增不改**）**

| # | 探针 | 期望（违反即判负） |
|---|---|---|
| **20** | 写入路径全链：发布页载荷 / `POST /api/listing` / 库内行 / 读口载荷 | 任一处出现 **`Digital`** ⇒ **判负**（退役值；含「前端仍映射 `digital ⇒ Digital`」这种半改、含库内残留行） |
| **21** | 二级控件在场：`item-select-deliver` 与 `item-select-ship` 的 DOM / 可达 / 表单参与 | **两分支二级控件同时在场**（同时渲染，或一个 `display:none` 但仍参与表单/载荷）⇒ **判负** |
| **22** | **切换一级分支**后读两个二级值的 state / 重投载荷 | **切换未清值**：切到 `digital` 后 `ship` 仍非空、切到 `physical` 后 `deliver` 仍非空，或切换后载荷带上被切走分支的值 ⇒ **判负** |
| **23** | **`DigitalAutoDeliver` 卡的绿标底色**（`getComputedStyle(tag).backgroundColor`） | ≠ **`rgb(74, 222, 128)`** ⇒ **判负**（含「写了 `#4ade80` 但被其它规则覆盖」「沿用黄底」「改了透明度」三种）；同时字色须 `rgb(32, 32, 32)` |
| **24** | **绿标 DOM 位置** | 绿标**不是** `.row1-wrap-title` 的**首子元素**（落在标题文字之后 / 行 2 / 独立行 / 行外 / 无标签）⇒ **判负**；且 `row1` 高仍 **48**、卡高仍 **392** |

- **读数登记项（不判负）**：二级控件的组名 / 选项钩子后缀命名（只要求命名可检索、不与既有钩子冲突）；`<select required>` 与 radio 组**形态二选一皆可**（只要求「必选语义 + `aria-invalid` 可读」）；绿标的 `padding` / 圆角 / 间距 ±1px（承 §26.12.5 读数项）。
- **原判负不废**：§26.12.5 #15–#19 **继续全额有效**，其中 #15（四态标签矩阵）与 #18（标签位置）在四值下**读作本节 D 的五态矩阵**；#19 的「两控件」在数字分支上**读作本节三控件**。

**F. 未做（本笔零代码 · 明账）**

- 三控件与四值 **均未实现**；`itemType.autoDeliver` / `itemType.manualDeliver` **两键未落盘**、13 处计数断言**未前推**；卡面绿标 **未实现**（`--sf-reward-tag-auto-bg` 未落盘）；`0054` **已由并行实现单落盘（未提交）、两库未 apply**（data §40.8.1 F）；**未跑任何探针 / 单测 / 浏览器实测**；本节 #20–#24 **一条未跑**。
- **生产不可自然取证**：两库存量 `item_type` **全 `NULL`**（data §40.8.1 D）⇒ 两枚标签只能靠 `context.route` 注入夹具验证（承既有体例：**不往生产库造测试商品**）。
- **连带**：master **§5.437 + 版本行 v0.354** · data **§40.8.1** · route **§49.11.1** · 交付件 `ops/item-type/delivery/SPEC-NOTE.md`。本笔**只写 `docs/**` + `ops/item-type/delivery/**`**，零代码、零迁移文件、零测试改动、**不 push**；`git diff --numstat` **删除列 0**（纯追加）。

- **★ 实测锁值（2026-10-20 · 上线后现取 · **以本段为准**）**：绿标 `DigitalAutoDeliver` 的底色 **`rgb(74, 222, 128)`**（= `#4ADE80` → `reward-card.css:28` 局部常量 `--sf-reward-tag-auto-bg`）＋ 字色 **`rgb(32, 32, 32)`**（= `#202020`，与黄标同黑）**已实测锁定**；**1536 日档 / 1536 夜档 / 390 手机档三档同值**，同测黄标 `rgb(255, 230, 15)` 亦三档同值。两枚标签均 `.row1-wrap-title` 的**首子元素**（`first_el = true`）、几何逐项相等（`12px` / `700` / `16px` 盒 / `2px` 圆角 / `padding:0 4px` / `margin-right:4px` / `inline-block` / `nowrap` / `vertical-align: baseline`，即 `padding` 与间距实测为 `4px`、圆角 `2px`）——**唯一差异 = 底色**；`row1` **48** / 卡 **392** / 溢出 **0** / `pageerror`·`console` 各 **0**。⇒ 判负 **#23 / #24** 的期望值即本段实测基线（`rgb(74, 222, 128)` 与「首子元素 + 行 48 + 卡 392」），**色值集合仍为「黄底 + 绿底 + 黑字」三者、不得出现第三色**（§26.12.5 #17 的例外面**不扩**）。取证 = `ops/item-type/delivery/prod-verify/prod-probe.json`（5 卡夹具 = 四类型 + `NULL` × 三档全绿）+ 独立质检 `ops/item-type/delivery/qa/verdict.json` AC3（1536 真页 **15 卡**：黄 1 / 绿 1 / 余臂无标签）。**本册不升版**（承 §26.12.8 体例）。

---

### 26.13 发布列表行内动作（【降价】/【编辑】· 行结构 = **链接区 + 动作区** · 降价弹窗 · 编辑页 `/item/:id/edit`）· 2026-10-20 · **加性续登、不升版** · 纯追加

> **依据** = Kevin 2026-10-20 定档（`/profile/trades/published` 行内加【降价】【编辑】；【编辑】⇒ 独立页 `/item/:id/edit` 复用发布页表单并预填；【降价】⇒ 行内弹窗、**必须低于当前价**、改完**当场刷新该行价格**；按钮**仅 `draft`/`listed`**，`sold`/`delisted` 只读无按钮）。**契约面同源** = route **§49.12**（`PATCH` 双模式 / `mine` 加性键 / 零新 API 路由）。本节只冻结**可见性、结构、按钮与弹层的判据**；组件内部类名与文案键名属读数登记项（§26.13.8）。

#### 26.13.1 现状（现取 · 必须改的那一处）

- 现取 `frontend/src/pages/ProfilePage.jsx:138-156`：`published` 行 = **整行 `<Link className="sf-prof-row" data-sf-m="trades-published-item" to="/item/<id>">`**，内含 `.sf-prof-row-title`（标题）+ `.sf-prof-row-meta`（`$价格 · 库存 n · 状态`）。行样式 = `frontend/src/pages/profile.css:101-130`（`display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px`，**无写死高度**、高度由内容与内边距驱动）。
- ⇒ 本节唯一的结构性变更 = **「整行 Link」→「链接区 + 动作区」**；理由是硬性的：**`<button>` 不得嵌在 `<a>` 内**（非法结构 + 点击必然冒泡跳转）。

#### 26.13.2 行结构（硬）

```
<div class="sf-prof-row sf-prof-row--act" data-sf-m="trades-published-item">      ← 行容器（钩子留在此层）
  <a class="sf-prof-row-link" data-sf-m="trades-published-link">                  ← 链接区（原整行 Link 的语义）
     <span class="sf-prof-row-title">…</span><span class="sf-prof-row-meta">…</span>
  </a>
  <div class="sf-prof-actions" data-sf-m="trades-published-actions">              ← 动作区（仅 draft/listed 渲染）
     <button data-sf-m="trades-published-price">【降价】</button>
     <button data-sf-m="trades-published-edit">【编辑】</button>
  </div>
</div>
```

- **`data-sf-m="trades-published-item"` 必须留在行容器**（现取存量断言锚 = `frontend/src/test/unit/sf14-profile-views.test.jsx` 命中该钩子）⇒ 允许的改锚**只有「从 `<Link>` 改到行容器」这一层**，**钩子名不得改**（判负 #32）。
- 链接区**必须仍是 `<a>`/`<Link>`**（可键盘聚焦、可新窗打开），**不得**改成 `div + onClick`；链接区 `flex:1; min-width:0`（标题 ellipsis 口径不变）。
- 动作区**不得**嵌在链接区内部；点任一按钮**不得**触发跳转（判负 #31）；动作区 `flex:none; display:flex; align-items:center; gap:8px; white-space:nowrap`。
- **行高口径**：现取行高**内容驱动、未写死**；动作区按钮高于文字行时会成为最高 flex 子项 ⇒ 行高按按钮抬升。**允许行高变化**（Kevin 未冻结行高），但须满足：① 同一 `status` 的行高**全列表一致**；② `≤767` 档 `scrollWidth == clientWidth`（零横向溢出）；③ 行高与按钮实高**由实现单现取读数登记**（本册不预填数值）。
- 空态/错误态（`trades-published-empty` / `phase=error`）**零改动**。

#### 26.13.3 可见性矩阵（硬 · 仅 `draft`/`listed` 有按钮）

| `status` | 动作区 | 【降价】 | 【编辑】 |
|---|---|---|---|
| `draft` | 渲染 | 有 | 有 |
| `listed` | 渲染 | 有 | 有 |
| `sold` | **不渲染** | — | — |
| `delisted` | **不渲染** | — | — |
| 未知值 / `null` | **不渲染**（fail-closed） | — | — |

- 判负 #25：`sold` / `delisted` 行出现**任一**按钮（含 `disabled` 仍可见、含 `opacity:0`/`visibility:hidden` 的占位、含仅 CSS 隐藏但 DOM 在场）。
- 口径：可见性**只按 `row.status` 判**，不按库存、价格、`item_type` 或「是否本人」猜补（`mine` 口恒本人行）。

#### 26.13.4 两按钮（沿用既有**次按钮** token · 零新 token）

- **颜色/描边/字重一律取既有次按钮口径**：`.btn.btn-a-alt`（或同取 `--sf-btnalt-bg` / `--sf-btnalt-fg` / `--sf-btnalt-border` 的等价类；现取 `frontend/src/styles.css:345-349` + `theme/tokens.js:138-140` 日档 / `:259-262` 夜档）· `font-weight:600` · `border-radius` 沿用该家族。
- **高度不强制 34**：`--sf-st-h-btna` 只在 `.btn.btn-a*` 上生效；行内动作按钮允许 **28（保持行高不变）** 或 **34（行高随之上抬）** 二选一，**但同一列表内必须一致**，且按 §26.13.2「行高口径 ③」登记实测值。
- 文案：【编辑】**复用** `t('common.edit')`（现取 `frontend/src/locales/zh.json` `common.edit` =「编辑」）；【降价】**新增 1 键**（建议 `item.lowerPrice`、四语齐备）⇒ **不得留裸中文**、**不得复用语义不符的既有键**；**键名不冻结**（§26.13.8）。
- **零新 token（硬）**：不得新增 `TOKEN_KEYS` / `theme-tokens.css` / `STRUCT_PROV` 条目；按钮不得引入**第三个色值**（承 §26.12.5 #17 的色值面；黄/绿标签的面不受本节影响）。判负 #33。
- **手机档触达（承 `T77`）**：`≤767` 两按钮 `min-height/min-width ≥ 44px`（`min-height:44px` 等**包在既有 767 块内**；**不得改** `--sf-st-h-btna`、**不得新增断点类型**）；桌面档**几何零变化**（除新增动作区自身占位）。

#### 26.13.5 降价弹窗（**行内选择弹层** or **modal** · 形态二选一、行为不自由）

| 项 | 要求（硬） |
|---|---|
| 载体 | 行内弹层 / modal **二选一皆可**；**不得跳页**、**不得**用 `window.prompt`/`alert` |
| 可访问 | `role="dialog"` + `aria-modal="true"` + `aria-labelledby`；ESC 关闭；打开时焦点入输入框；关闭后焦点回触发按钮 |
| 内容 | **现价（只读展示）** + 输入框（`inputMode="numeric"`）+【确认】+【取消】 |
| **提交闸（硬）** | **新价必须是整数且 `1 ≤ 新价 < 现价`**；**等值（= 现价）与加价（> 现价）一律不可提交** |
| 非法态 | 【确认】**`disabled`** **且**出现**内联提示** `data-sf-m="trades-lower-price-error"` —— **两者缺一即判负**（只置灰无提示 = 用户不知道为什么） |
| 提交 | **单次** `PATCH /api/listing/:listingId`，body **仅** `{ price }`（单字段 ⇒ 字段模式，承 route §49.12.2）；**不得**夹带 `to_status` |
| 成功 | 该行价格文本**当场**变为新价（**不跳页、不整表重取、不刷新浏览器**），弹层关闭；**行内即时更新 = 唯一合格形态** |
| 失败 | 弹层**不关**、错误落在弹层内（同锚或并列锚）；**不得**静默吞错、不得只 `console` |
| 并发 | 提交中【确认】置 `disabled`（防双击双写） |

- **最小价口径（登记 · 与 Kevin 字面差）**：Kevin 原话「必须低于当前价（**≥0.01**）」；**现取** `listing.price` 为**整数 bigint**（`toBigIntLike(..., 'listing.price', 1)` ⇒ 小数入参 400 `NOT_AN_INTEGER`）、`cid=1` `decimals = 0` ⇒ 本节读作「**整数且 `1 ≤ 新价 < 现价`**」（即「至少差一个最小计价单位」）。真要落到 `0.01` = 改列类型 + 引入小数计价 ⇒ **另立单**，本册不授权。前端闸**必须与后端同口径**：前端若放行小数 ⇒ 提交必 400（判负 #26 家族）。
- **弹层不得承载其它编辑**（只改价；改标题/描述/图片 ⇒ 走编辑页）——混装 ⇒ 判负 #35。

#### 26.13.6 编辑页 `/item/:id/edit`

- **表单同源（硬）**：必须复用发布页表单（`frontend/src/pages/item/PublishItemPage.jsx` 的字段集、钩子与校验），**不得另写一套**（复制一份 ⇒ 修一处漏一处）。判负 #34。
- **预填 6 项不漏（硬）**：`title` / `description` / `price` / `stock` / **图片**（`media_urls`：顺序保留、缩略图数 = URL 数）/ **`item_type` 级联三控件**（一级 `digital|physical` + 二级 `auto|manual` 或 `free|buyer` **由 `item_type` 反推**；`NULL` ⇒ 一级未选、二级不渲染）。任一项落成空值/默认值 ⇒ 判负 #29。
- **禁猜补**：`item_type = NULL` 时**不得**替用户默认选一个值（承 data §40.8 E「`NULL` = 未分类、禁猜补」）⇒ 判负 #30。
- 标题与提交按钮用「编辑」语义（复用 `common.edit`），**不得**仍写「发布」。
- 保存 ⇒ **单次** `PATCH` 字段模式；成功后离开编辑页（回 `/item/:id` 或回 `/profile/trades/published`，二选一由实现定）；**不得**留在编辑页且列表不刷新。
- **只读行**：`sold` / `delisted` 行直达该 URL ⇒ **只读提示 + 回列表入口**，**不得**渲染可提交表单（判负 #35）。

#### 26.13.7 判负（**#25–#35** · 与 §26.12.5 #15–#19、§26.12.8 A-E #20–#24 **并存、只增不改**）

| # | 探针 | 期望（违反即判负） |
|---|---|---|
| **25** | 行状态矩阵：`draft` / `listed` / `sold` / `delisted` / `null` 五行 | `sold` / `delisted`（及未知值）行出现**任一**按钮（可见、`disabled` 可见、CSS 隐藏但 DOM 在场）⇒ **判负** |
| **26** | 弹窗输入 = 现价（等值）与 = 现价 + 1（加价） | 【确认】可点 / 请求发出 / 后端 200 ⇒ **判负**（两种都必须被前端闸拦下） |
| **27** | 弹窗输入 `0` / `-1` / `1.5` / 空 / 非数字 | 可提交 ⇒ **判负**（且后端同口径 400） |
| **28** | 合法降价提交成功后的**行内**价格文本（不刷新页面、不跳页） | 价格**未变**，或必须整页刷新/重进列表才变 ⇒ **判负** |
| **29** | 编辑页预填对拍（6 项：`title`/`description`/`price`/`stock`/`media_urls`/`item_type`） | 任一字段为空值/默认值/与库内值不等（含图片数不符、顺序被打乱）⇒ **判负** |
| **30** | `item_type` 级联预填（四值各一行 + `NULL` 一行） | 级联未反推（一级/二级与库内值不符）**或** `NULL` 被替用户默认选中 ⇒ **判负** |
| **31** | 点击【降价】/【编辑】后的 URL 与 history 长度 | 触发整行跳转到 `/item/:id`（冒泡未拦）⇒ **判负**；动作区嵌在 `<a>` 内 ⇒ **判负** |
| **32** | 钩子面：`trades-published-item` 的宿主节点 | 钩子被改名，或不在**行容器**上（如挂在按钮/链接区）⇒ 存量断言无法最小改锚 ⇒ **判负** |
| **33** | 两按钮的 `getComputedStyle` + `tokens.js` / `theme-tokens.css` 增量 | 出现**第三个色值**、或新增 token 条目、或按钮不用 `--sf-btnalt-*` 三色 ⇒ **判负** |
| **34** | 编辑页字段实现来源（组件树 / 钩子集） | 另写一套表单（字段钩子与发布页不同源、或校验逻辑复制一份）⇒ **判负**；保存发出 **2 次**写请求 ⇒ **判负** |
| **35** | `sold`/`delisted` 行直达 `/item/:id/edit`；降价弹层内的字段面 | 渲染可提交表单 ⇒ **判负**；弹层内出现价格以外的可编辑字段 ⇒ **判负** |

- **原判负不废**：§26.12.5 #15–#19、§26.12.8 E #20–#24 **继续全额有效**；本节 #33 与 #17（色值面）**同一口径**、只把作用面扩到动作区按钮。

#### 26.13.8 读数登记项（不判负）

- 弹层形态（行内弹层 / modal）、弹层宽与圆角、内联提示的位置（输入框上方/下方）。
- 两按钮的**先后顺序**（【降价】在前或【编辑】在前皆可，**同页必须一致**）。
- 类名后缀（`sf-prof-actions` / `sf-prof-row-link` / `sf-prof-row--act` 仅为建议）：要求**可检索、不与既有类冲突、不新造 `data-sf-m` 家族前缀**。
- 【降价】文案键名（`item.lowerPrice` 仅为建议）；i18n 计数（top / flat / nodes）**由实现单现取**，**本册不预填**。
- 编辑页标题文案与按钮文案的最终字面。

#### 26.13.9 未做（本笔零代码 · 明账）

- **未实现**：行结构改造、两按钮、降价弹层、`/item/:id/edit` 页面 —— 一行代码未写；**未跑任何浏览器实测 / 单测 / 截图**；§26.13.7 十一位判负**一条未跑**。
- **未取得**：行高与按钮实高的现取读数（`draft`/`listed` 两态、`390`/`1536` 两档）、新增文案键的四语计数 —— 均标 `NOT_MEASURED`，本册不预填。
- **连带**：route **§49.12** · master **§5.439 + 版本行 v0.356** · 交付件 `ops/published-actions/SPEC-NOTE.md`。本笔**只写 `docs/**` 与 `ops/published-actions/**`**，零代码、零迁移、零测试改动、**不 push**；`git diff --numstat` **删除列 0**（纯追加）。**本册不升版**（承 §26.12 / §26.12.8 加性续登体例）。

**★ 补登（2026-10-20 · 去标题单 §26.14）**：编辑页可改字段 = **`description` / `price` / `stock` / `media_urls` / `item_type`**（**无 `title`** —— 标题已退役、由描述首行派生，见 §26.14）；**草稿（`draft`）行库存只读**（库侧 `DL60`「库存变更只允许 `listed`」⇒ 编辑页对 `draft` 禁用库存输入，**不放开写口**；它即 §26.13.6 未决项的裁定 = 取 **(b) UI 侧只读**，不是 (a) 放宽后端）。

### 26.14 去标题：发布页 / 编辑页**单描述框** · 卡面与列表标题用**派生值**（2026-10-20 · 加性续登、不升版 · 纯追加）

> **依据** = Kevin 2026-10-20 数据模型指令「**取消商品标题字段、并入 `description`**：标题 = 描述首个 `\n` 之前；无回车则整段作标题；**显示层 48 显示宽单位截断 + 字面 `...`**；**存储不截**」（逐字转引自本单派单、原始会话未入仓）。**契约面** = `route-layer.spec` **§49.13**（写口拒 `title` / 读口保留派生 `title`）+ `data-layer.spec` **§40.9**（`0055` 回填 / `0056` DROP）。本节只冻**控件形态、派生显示链与判负**；文案键名与类名属读数登记项（§26.14.6）。

#### 26.14.1 现状（现取 · HEAD `421b7c9`）

- **发布页现存两个控件**（`frontend/src/pages/item/PublishItemPage.jsx`）：标题 = `<label>` + `t('item.title')`（「物品名称」，`:367`）+ **`<input required data-sf-m="item-input-title">`**（`:368`）；描述 = `<label>` + `t('item.description')`（「物品说明」，`:473`）+ **`<textarea rows={3} data-sf-m="item-input-note">`**（`:474`）。表单态 `:173` = `{ cid, price, stock, title, description }`；提交载荷 `:296` 含 `title: form.title.trim()`。
- **编辑页复用同一表单**（§26.13.6「表单同源」）⇒ 本节一处改动**同时覆盖发布与编辑两面**。
- **卡面标题链**：`.row1-wrap-title` 行高 **48**、按 **48 显示宽单位**截断 + **字面 `...`**（`frontend/src/components/reward/truncate.js`：`truncateByWidth(text, 48)` / `displayWidthUnits` / `charWidthUnits`；超宽才加 `...`）；卡高 **392**（§26.11 / `references/fixed-geometry-cards.md`）。**现取值源 = `title` 列**。
- ⇒ 本节变更 = **删一个控件（标题 input）+ 换标题取值来源（列 → 描述首行）**；卡面几何、行高、截断单位**一律不变**。

#### 26.14.2 单描述框（硬 · 反回潮）

| 项 | 要求 |
|---|---|
| 控件数量 | 发布页 / 编辑页**各恰一个正文字段**：`<textarea>`（沿用 `data-sf-m="item-input-note"`，钩子名**不变**） |
| 独立标题框 | **不得存在**：`data-sf-m="item-input-title"` **DOM 0 命中**；`<input name="title">` / `<input id="title">` / label 文案为「标题 / 物品名称」的**可编辑控件**同样判负（判负 #36） |
| 控件属性 | `<textarea>`（**不是** `<input>` —— 描述必须能装多行）；`rows ≥ 3`（现值 3，可调，读数登记项）；**不得**改成单行 input |
| label | 沿用 `t('item.description')`（「物品说明」）；**不得**把 label 改成「标题与描述」这类双义文案（首行语义由提示行承载） |
| 必填 | **必填**（与 route §49.13.2 同口径）：空 / 全空白 ⇒ 提交前拦下并给组级 `aria-invalid` + 高亮；**不得**因前端放行而让后端 400 成为唯一闸 |
| 载荷 | **只发 `description`**（不再发 `title`；空串 `title` 也不要发 —— 后端虽容忍 `''`，但发出去就是「意图不明」的噪音） |

#### 26.14.3 框下提示「第一行将作为标题」（硬）

- **位置**：描述框**正下方**（DOM 紧随 textarea 之后、同一 `sf-item-field` 内或其兄弟节点），钩子建议 `data-sf-m="item-desc-firstline-hint"`（**钩子名 / 键名不冻结**，§26.14.6）。
- **文案**：zh = 「第一行将作为标题」；四语齐备（en / hk / vn 译文可标「待复核」）；建议键 `item.descFirstLineHint`（新增 ⇒ i18n 计数 **由实现单现取**，本册不预填）。
- **不得用 `placeholder` 顶替**：placeholder 一输入就消失，用户在**打字过程中**看不到规则；必须是**常驻文本节点**（判负 #39）。
- **字号**：可见文本 **≥ 12px**（承 §13 / `T79` 硬下限，压过任何参考图比例）；颜色用既有弱化色（`--sf-...` 既有弱化槽或卡内局部常量，**零新 token**）—— 不得为了一个提示新增 `TOKEN_KEYS`。
- **编辑页同一提示**：编辑页复用发布表单 ⇒ 提示**自动在场**，不得因「编辑者已熟悉」而省略（判负同 #39）。

#### 26.14.4 派生标题的显示链（硬 · 唯一读法）

```
description（全文，落库不截）
   └─① firstLine：首个 \n 之前、剥行尾 \r、两端 trim；空 ⇒ ''
        └─② truncateByWidth(v, 48)（显示宽单位：汉字/全角 2、拉丁 1）
             └─③ 超宽 ⇒ 前缀 + 字面 `...`（三个半角点，不是 `…`）
```

| 消费面 | 取值 | 截断 | 备注 |
|---|---|---|---|
| 首页商品卡 `.row1-wrap-title` | 派生值（服务端 `title` 键） | **48 单位 + `...`** | 行高 **48**、卡高 **392** 不变；**不得**出现第二行文字（判负 #38） |
| `/profile/trades/published` 行标题 | 派生值 | **48 单位 + `...`**（与卡面同口径） | 行高口径承 §26.13.2（内容驱动） |
| 详情页标题 | 派生值 | **不截**（详情有空间） | 多行首行过长时按容器换行；读数登记项 |
| 编辑页预填 | **`description` 全文** | 不截 | **不得**把派生标题塞回描述框（塞回 = 丢掉第二行以后的内容，判负 #37 家族） |

- **派生不落库、不在前端「造」**：`title` 键由服务端下发（route §49.13.4）；前端**只做②③两步**（截断与加点）。前端**不得**自己取 `description.split('\n')[0]` 绕过服务端键（会导致 `name` 与 `title` 不同源、两处显示不一致）。
- **`firstLine` 必须存在**：现取 `truncateByWidth` 只按宽度截断，**对含 `\n` 的长文本会把换行一起截进来** ⇒ 若前端拿到的是全文（例如直接吃 `description`），必须先取首行再截断；**判负 #38 的「换行 / 溢出」臂正是锤这个漏步**。

#### 26.14.5 判负（**#36–#39** · 与 §26.13.7 #25–#35、§26.12 家族**并存、只增不改**）

| # | 探针 | 违反即判负 |
|---|---|---|
| **36** | 发布页 + 编辑页 DOM 扫描（`item-input-title` / `name="title"` / label「标题」「物品名称」的可编辑控件） | 任一面命中 **≥1** ⇒ 判负（**独立标题框回潮**，含 `display:none` 但 DOM 在场） |
| **37** | 派生对拍（三臂：单行 / 多行 / 空描述）× 卡面 + 列表 + 详情 | 标题 ≠ **描述首行**（含整段描述上屏、含未 `trim`、含空描述时编造文案）；或编辑页描述框被填成**首行**而非全文 ⇒ 判负 |
| **38** | **多行描述**在卡面 / 列表的几何（375 / 390 / 768 / 1440 / 1536 各档） | `.row1-wrap-title` 高 ≠ **48**、卡高 ≠ **392**、标题渲染出**第二行**（`scrollHeight > 行高`）、或 `scrollWidth > clientWidth` ⇒ 判负 |
| **39** | 描述框下方的提示节点（常驻文本，非 placeholder） | 提示**缺失** / 只写在 `placeholder` 里 / 字号 **< 12px** ⇒ 判负 |

- **原判负不废**：§26.13.7 #25–#35、§26.12.5 #15–#19、§26.12.8 E #20–#24 **继续全额有效**；#36 与 #34（表单同源）**互补**：改发布页表单即自动改编辑页，若只改一面 ⇒ #34 + #36 双红。

#### 26.14.6 读数登记项（不判负）

- 描述框 `rows` 值、文本框最大宽度、提示节点的类名与 `data-sf-m` 名。
- 提示文案键名（`item.descFirstLineHint` 仅为建议）与四语最终字面；i18n 计数（top / flat / nodes / `item`）**由实现单现取**。
- `t('item.title')`（「物品名称」）在去标题后是否仍有消费点（详情页标题 / 其它页）—— **有则留、无则留痕不删**（仓内死键留痕体例：删键会连锁十余个计数断言）。
- 详情页长首行的换行表现（几行折、是否溢出容器）。
- 编辑页 `draft` 行库存输入**只读形态**（`disabled` vs `readOnly` + 说明文案）—— **行为硬**（不可提交 `stock`），**形态**登记即可。
- 列表行标题是「CSS ellipsis」还是「JS 48 单位 + `...`」—— 两者皆可，但**必须与卡面同口径**（都用 48 单位或都用 CSS，不得一处 48 一处 `-webkit-line-clamp`）。

#### 26.14.7 未做（本笔零代码 · 明账）

- **未实现**：单描述框改造、提示行、派生显示链、编辑页字段集收敛 —— **一行代码未写**；**未跑任何浏览器几何读数 / 单测 / 截图**；#36–#39 **一条未跑**。
- **未取得**：描述框新 `rows`、提示节点实测字号、四语计数、多行描述在卡面的实测行高与溢出量 —— 均标 `NOT_MEASURED`，本册不预填。
- **连带**：route **§49.13** · data **§40.9** · `master-plan` **§5.440 + 版本行 v0.357** · `ops/title-merge/SPEC-NOTE.md`。本笔只写 `docs/**` 与 `ops/title-merge/**`，零代码 / 零迁移 / 零测试改动 / **不 push**；`git diff --numstat` **删除列 = 0**。**本册不升版**（承 §26.12.8 / §26.13 加性续登体例）。

### 26.15 详情页改版：H5 四段结构 + 底部固定操作栏四件 · Web 闲鱼式两栏 · 标签两级体系（成色卖点 ＋ item_type 派生收敛）（2026-10-20 · 加性续登、不升版 · 纯追加）

> **依据两段（均逐字转引自本单派单、**原始会话未入仓** ⇒ 与 Kevin 原话若有出入以 Kevin 一句话为准）**：① **详情页改版指令**（H5 ≤767 六段：①第一行卖家信息（头像 + 掩码地址 + 信用胶囊）②第二行价格 + 核心标签 ③第三行次要标签（【包邮】【自动发货】等 item_type 派生）+ `x人想要` + `x人浏览` ④然后商品 desc ⑤然后商品图片 ⑥底部固定操作栏（【留言】【收藏（五角星图标）】【立即购买（黑字灰底胶囊）】【聊一聊（聊天图标 + 黑字黄底胶囊）】，**后两者靠右对齐**）；Web ≥768 闲鱼式两栏：顶部卖家信息通栏（头像 + 名字 + 元信息行），主体左 = 缩略图列 + 主图（轮播箭头）、右 = 价格行（橙红大价 + 行右端 `x人想要 x人浏览`）→ 标题 → 次要标签 → desc → 操作区（拼接胶囊：聊一聊黄｜立即购买黑 + 独立收藏胶囊））。② **同日三点追加**：**1）次要标签收敛** = 仅【包邮】（黄）与【自动发货】（绿）两种；`DigitalManualDeliver` / `PhysicalBuyerShip` **无标签**（不是灰字，是彻底不渲染）；**2）新增成色字段**（data §40.10 / route §49.14；四值 `BrandNewSealed`/`LikeNew`/`MinorWear`/`HeavyWear`，中文名逐字 = **全新未拆封 / 几乎全新 / 细微磕碰划痕 / 严重磨损**）；**3）核心标签 = 成色派生卖点标签** = 第二行（H5）/ 右栏价格下（Web）显示当前成色中文名标签（如【全新未拆封】）；**未填成色（数字商品或历史 NULL）⇒ 核心标签区显示【平台结算】+ 状态类标签兜底，不空置**。**配套数据面** = route **§49.14**（详情 `views`＋`condition` 加性键 47→49 + 读路径 +1 + 写口 `item_condition`）+ data **§40.10**（迁移 `0057` 双列）+ `master-plan` **§5.441 / 版本行 v0.358** + `ops/item-detail/SPEC-NOTE.md`。**本笔零代码**（本节 = 契约冻结，实现另单）。

#### 26.15.1 现状（现取 · HEAD `c3e500a`）

- **详情响应**（`GET /api/prize/:bID`）：**47 键**、**无 `views` / 无 `wants` / 无 `condition`**、有顶层 `seller`（`uid/nickname/avatar/credit`，路由层合成）——实测 dev 5788 只读一次现取。
- **H5 详情页现役**（`ItemDetailPage.jsx`）：页内顶栏返回（`item-back`）→ `sf-item-head`（价格行 `sf-item-price-l` + 标题 + note）→ `sf-item-panel`（占位图 + 描述 + 库存 + meta 组 + 数量输入 + buy form）→ **T120 三段底栏**（组合条 `聊一聊` 58% ｜ `立即购买` 42% + 收藏独立胶囊；钩子 `item-actionbar` / `item-chat-btn` / `item-buy-btn` / `fav-toggle`；≤767 `position: fixed` 独占底部，`item.css:374` 注释现取）。**无卖家信息行 / 无标签行 / 无想要·浏览读数**。
- **i18n**（四语 top 130 / flat 1129 现取）：`item.buy`=立即购买 · `item.chat`=聊一聊 · `item.favorite`/`item.favorited`=收藏/已收藏 · `rewardCard.wants`=`{{n}}人想要` 在册；**「留言」「x人浏览」「平台结算」与成色四值中文名均无键**。
- **后端既有承载**：会话五口（`POST /api/messages/conversations` 等，`index.ts:3410-3488` 现取）· 收藏口（`GET/POST /api/favorites` + `DELETE /api/favorites/:listingId`，`:2918-2965`）· `listing_favorite` 表（0047，UNIQUE(fav_uid, listing_id)）· `listing.status` 闭集 = `draft/listed/delisted/frozen`（`0015:137`）。

#### 26.15.2 H5（≤767）四段结构（硬 · 行序冻结）

**内容行序冻结为 ①→②→③→④→⑤（底栏第 ⑥ 段恒固定在视口底）：**

| 行 | 内容 | 数据承载（现取） |
|---|---|---|
| ① 卖家信息行 | 头像 + 掩码地址 + 信用胶囊 | `seller.avatar`（`users.avatar_url`，null ⇒ 灰底占位）+ `seller.nickname`（`maskWalletAddress` 星号 2+2，与 feed 卡**单源同变**）+ `seller.credit`（四档 `new/excellent/good/normal`，§26.11.6 卖家栏同口径） |
| ② 价格行 | 价格 + **核心标签（成色卖点签）** | `price`（橙红大价承 §26.11.9 价格行口径：数字 `#FF4D00`）；核心标签 = **成色派生卖点标签**：`condition` 四值 ⇒ 对应中文名标签（`BrandNewSealed`⇒【全新未拆封】/ `LikeNew`⇒【几乎全新】/ `MinorWear`⇒【细微磕碰划痕】/ `HeavyWear`⇒【严重磨损】）；**`condition` 为 `null`（数字商品 / 未填）⇒ 该区渲染【平台结算】+ 状态类标签兜底，不空置**（判负 #50） |
| ③ 标签读数行 | **次要标签** + `x人想要` + `x人浏览` | 次要标签 = `item_type` 派生**收敛两枚**：`PhysicalFreeShip`⇒【包邮】黄底 `--sf-btna-bg`、`DigitalAutoDeliver`⇒【自动发货】绿底 `#4ADE80`；`DigitalManualDeliver` / `PhysicalBuyerShip` / `NULL` ⇒ **彻底不渲染**（无灰字降级，判负 #48）；`x人想要` = `wants`（详情响应无承载 ⇒ **本槽无承载不渲染**，route §49.14.3 挂账）；`x人浏览` = `views`（route §49.14，+1 自增） |
| ④ desc | 商品描述 | `description`（存储不截；详情显示层截断预算 = 读数登记项，非卡面 48 预算） |
| ⑤ 图片 | 商品图片 | `media_urls`（≤4 张；未传 ⇒ 机械鱼占位 `placeholder-item.webp` 既有口径） |

- 四段**上下顺序**不得互换、不得缺行（判负 #43）；`item_type` 派生签**不得**进第 ② 行、成色卖点签**不得**进第 ③ 行（判负 #44）。
- 行结构与间距的实测值（行高 / gap / 字号）= 读数登记项（26.15.7），本节不预填。

#### 26.15.3 H5 底部固定操作栏（硬 · 四件 + 右对齐）

- **四件**（视觉序左→右）：**【留言】** ｜ **【收藏】**（五角星图标）‖ **【立即购买】**（黑字灰底胶囊）· **【聊一聊】**（聊天图标 + 黑字黄底胶囊）——**后两者（立即购买 + 聊一聊）靠右对齐**，前两者靠左（判负 #42 / #47）。
- **固定**：`position: fixed` 独占底部（既有 `.sf-item-actionbar` ≤767 机制沿用，`item.css:374` 现取）+ `env(safe-area-inset-bottom)`；判负 #41 = 底栏随页滚走 / 非 fixed 落底。
- **配色 / 图标**：黄底黑字 = `--sf-btna-bg` / `--sf-btna-fg`（零新 token）；灰底 = 既有中性/次按钮 token 候选（`--sf-btnalt-*`，实现面现取落值并回写，**零新 token**；若落盘无对应值 ⇒ 参考图定值按「局部常量」体例落 `item.css`，不进主题层）；星形 = lucide `Star`（未收藏空心 / 已收藏 `fill="currentColor"`，既有 `fav-toggle` 形态）；聊天图标 = lucide `MessageCircle`（既有 `item-chat-btn` 在用）。
- **行为映射**：【聊一聊】【留言】→ 既有会话五口（`POST /api/messages/conversations` 等；本站无独立留言板载体 ⇒ 两钮**同走 listing 会话口**，差异 = 入口形态；如需真留言板 = 另立数据面另单）；**未登录 ⇒ 登录提示**（既有登录引导形态；钱包登录页无 `<input>` ⇒ 探针判据 = URL 含 `/login` + 「连接钱包」文案）；【收藏】→ 既有收藏 toggle（`POST`/`DELETE /api/favorites`，`fav-toggle` 钩子与 `data-sf-fav`/`aria-pressed` 语义保留）；【立即购买】→ 本节只冻按钮渲染契约，点击业务面 = 既有 `/api/listing-orders` 家族（实现单另核，**不新开写口**）。
- **卖家本人**：聊一聊不渲染（route §41 口径「卖家本人看自己商品 ⇒ 聊一聊按钮不渲染」沿用）；其余三件在场。
- **状态改写式勘误（旧条文保留）**：§24 `T120` 的「组合条两段（聊一聊 58%｜立即购买 42%）+ 收藏」为详情页**旧形态**；**本节四件形态落定起，详情页底栏以本节为准**（T120 条文逐字保留可检索，不删改）。

#### 26.15.4 Web（≥768）闲鱼式两栏（硬）

- **顶部卖家信息通栏**：头像 + 名字 + 元信息行（元信息行内容 = 按数据承载取：候选 `seller.credit` 信用档 / 掩码地址 / 想要·浏览读数；**只渲染有承载的元素**，具体集 = 实现面回写，`NOT_MEASURED`）。
- **主体两栏**：**左** = 缩略图列 + 主图（**轮播箭头**；图源 `media_urls`，与 H5 第 ⑤ 行同源）；**右** = 价格行（橙红大价 + **行右端** `x人想要 x人浏览`）→ **核心标签（成色卖点签，位置 = 价格行之下**，与标题的先后 = 读数登记项）→ 标题（派生 `title`，48 显示宽单位截断口径同列表）→ 次要标签（同 26.15.2 ③ 收敛两枚）→ desc → 操作区（判负 #45 = 两栏缺失或左右互换）。
- **核心标签兜底（Web 同 H5）**：`condition` 为 `null` ⇒ 价格下渲染【平台结算】+ 状态类标签兜底，不空置。
- **操作区** = **拼接胶囊**（聊一聊黄 ｜ 立即购买黑，中缝直角、两端半圆 —— 承既有 `.sf-item-cta-group` 拼接形态）+ **独立收藏胶囊**；黄底黑字 / 灰底黑字与 H5 同 token 口径。
- **断点纪律**：两档差异一律走 **CSS 767 断点**（`shell.css` 唯一 767 块不动；新增布局规则落 `item.css` / 新修饰类，复合选择器压同具体性）；**禁 JS 宽度读数**（`matchMedia`/`innerWidth` 按明文全文扫描判负 —— `theme-shell-isomorphism` 硬断言）。
- 价格橙红 = `#FF4D00`（承 feed 卡 `--sf-reward-price-fg` 局部常量口径；详情页引用同值，零新 token）。

#### 26.15.5 标签两级体系（判据）

- **核心标签 = 成色派生卖点标签**（位置 = H5 第 ② 行价格行内 / Web 右栏价格下）：`condition` 四值 ⇒ 对应中文名标签（文案真源 = Kevin 原文四词：**全新未拆封 / 几乎全新 / 细微磕碰划痕 / 严重磨损**）；**未填成色（数字商品 / 历史 `NULL`）⇒ 【平台结算】+ 状态类标签兜底，不空置**（状态类标签 = `listing.status` 派生，闭集现取 `draft/listed/delisted/frozen`，渲染态与文案 = 实现面按现取闭集登记回写；【平台结算】为平台签、无行数据承载、按「未填成色」状态渲染）。
- **次要标签 = `item_type` 派生收敛两枚**（位置 = H5 第 ③ 行 / Web 右栏标题下）：仅【包邮】（黄 = `--sf-btna-bg`，`#FFE60F`）与【自动发货】（绿 `#4ADE80`）；几何承 §26.12.8（同位置同几何仅差底色：字 `#202020` / 12px / 700 / 圆角 2px / `padding:0 4px`）；`DigitalManualDeliver` / `PhysicalBuyerShip` / `NULL` ⇒ **彻底不渲染**。
- **两级不得混位**（判负 #44）；次要标签在两档的**几何与配色完全同源**（禁止第二套尺寸）；成色卖点签**不得**渲染四值闭集之外的文案（判负 #49）。

#### 26.15.6 判负（**#40–#50** · 与 §26.14.5 #36–#39、§26.13.7 #25–#35、§26.12 家族**并存、只增不改**）

1. **#40 浏览数不自增**：详情页两次读取 `views` 不变、或响应缺 `views` 键 ⇒ 判负（承 route §49.14 / data §40.10）。
2. **#41 H5 底栏非固定**：≤767 下操作栏随页滚走 / 非 `position: fixed` 独占底部 ⇒ 判负。
3. **#42 后两者未右对齐**：H5 底栏【立即购买】【聊一聊】未靠右（或前两件未靠左）⇒ 判负。
4. **#43 H5 缺四行顺序**：行 ①②③ 或 ④desc / ⑤图片 任缺、乱序 ⇒ 判负。
5. **#44 标签混位**：`item_type` 派生签进价格行 / 成色卖点签进第 ③ 行 ⇒ 判负。
6. **#45 Web 两栏缺失或左右互换** ⇒ 判负。
7. **#46 渲染无数据承载元素**：响应无对应键（`seller`/`views`/`condition`/`item_type`）却渲染对应节点（假数据）⇒ 判负。
8. **#47 底栏四件缺件或分组错**：四件任缺 / 右组顺序非「立即购买·聊一聊」/ 左组顺序非「留言·收藏」⇒ 判负。
9. **#48 次要标签出现「不包邮」「手动发货」字样**：`DigitalManualDeliver` / `PhysicalBuyerShip` / `NULL` 必须彻底不渲染（灰字降级也判负）。
10. **#49 成色非四值**：核心卖点标签渲染四值闭集之外文案、或 `condition` 键值非法 ⇒ 判负。
11. **#50 数字商品 / `condition=null` 出现成色标签、或该态核心标签区空置**（缺【平台结算】+ 状态类兜底）⇒ 判负。

#### 26.15.7 读数登记项（不判负）

橙红大价字号与行高（**≥12px floor**，具体值 `NOT_MEASURED`）· 触控目标 ≥44（限 ≤767）· Web 两栏宽度比与缩略图列宽 · 轮播箭头触达域 · 拼接胶囊中缝与圆角几何 · 灰底落盘色值 · 第 ② ③ 行行高与 gap · desc 截断预算 · 核心卖点签几何（承次要签同族：12px/700/圆角 2px 一族，底色 = 实现面按参考图回写）· i18n 新键计数（top/flat/nodes 按现取复算）· 状态类标签渲染态集 · 详情页多图与单图两态。

#### 26.15.8 未做（本笔零代码 · 明账）

- **未实现**：H5 四段重排 / 底栏四件改造 / Web 两栏 / 标签两级渲染 / `views`+1 与 `views`/`condition` 加性键 / `item_condition` 写口闸（后端另单）——**一行代码未写**；判负 #40–#50 **一条未跑**；未跑任何浏览器几何读数 / 单测 / 截图。
- **「x人想要」挂账**：详情响应无 `wants`（现取实测）⇒ 该槽**无承载不渲染**（行结构在场、读数槽可空）；要渲染 = Kevin 一句话加键（⇒ 详情 50 键，承 route §49.14.3）。
- **i18n 缺键（实现单同批新增 · 四语同补 · 计数断言按现取复算前推；现取 top 130 / flat 1129 / nodes 4516）**，建议键名（仅建议、定名后回写）：`item.message`=留言 · `item.views`=`{{n}}人浏览` · `item.platformSettled`=平台结算 · `itemCondition.brandNewSealed`=**全新未拆封** · `itemCondition.likeNew`=**几乎全新** · `itemCondition.minorWear`=**细微磕碰划痕** · `itemCondition.heavyWear`=**严重磨损**（成色四词 = Kevin 原文，**逐字入键值**）。
- **钩子建议集**（落定后回写）：H5 `item-detail-seller-row` / `item-detail-price-row` / `item-detail-tag-core` / `item-detail-tags-secondary` / `item-detail-desc` / `item-detail-gallery` / `item-detail-msg-btn`；既有 `item-actionbar` / `item-chat-btn` / `item-buy-btn` / `fav-toggle` 保留；Web `item-detail-web-cols` / `item-detail-web-side`。
- **连带**：route **§49.14** · data **§40.10** · `master-plan` **§5.441 + 版本行 v0.358** · `ops/item-detail/SPEC-NOTE.md`。本笔只写 `docs/**` 与 `ops/item-detail/**`，零代码 / 零迁移 / 零测试改动 / **不 push**；`git diff --numstat` **删除列 = 0**。**本册不升版**（承 §26.12.8 / §26.13 / §26.14 加性续登体例）。

#### 26.15.9 实测锁定（2026-10-20 上线后生产实测 · 承 §26.15.1–§26.15.8 **只增不改** · 本节为**读数锁定**，与旧条文并存、以本节为准）

**锁定前提（同版证明）**：push `0a564e2..8d9e48b` 上线后，本地 HEAD 构建产物与线上 HTML 引用**逐字同名** —— js `index-BUJFF7Ji.js` / css `index-DwgaiwBH.css` ⇒ 下列读数是**线上同版**读数（不是本地预览、不是 dev）。样本 = 生产 `/item/9`（`item_type=PhysicalFreeShip`、`condition=NULL`）；读数件 = `ops/item-detail/prod-verify/prod-bar.json` · `prod-detail.json` · `SUMMARY.txt`。

**A. H5 底栏四件（390 档 · `position: fixed` + `bottom: 0` · 栏宽 390 · 四件**同高 44**）**

| 序 | 钩名（`data-sf-m`） | 左缘–右缘 | 宽×高 | 底色 / 字色 |
|---|---|---|---|---|
| ① | `item-detail-msg-btn`（留言） | 12–48 | 36×44 | 透明 / `rgb(10,10,10)` |
| ② | `fav-toggle`（收藏★） | 56–134 | 78×44 | 白 / `rgb(32,32,32)` |
| ③ | `item-buy-btn`（立即购买） | 201–279 | 78×44 | 灰 `rgb(236,236,236)` / `rgb(32,32,32)` |
| ④ | `item-chat-btn`（聊一聊） | 287–378 | 91×44 | 黄 `rgb(255,230,15)` / `rgb(32,32,32)` |

- **分组冻结**：左组 = ①②（`sf-item-bar-left`）、右组 = ③④（`sf-item-bar-right` 内 `.sf-item-cta-group`）；**后两件右缘 378 / 378 逐值相等**（右对齐判据的承重读数）；**四件 `display:flex`、高 44 逐值相等**（承 §13 触控目标 ≥44 硬口径）。
- **DOM 顺序恒 ③→④**（立即购买在前、聊一聊在后）；H5 视觉序与 DOM 同向；**Web 拼接序「聊一聊｜立即购买」由 ≥768 CSS `order` 翻转**，**不得靠改 DOM 顺序实现**（否则 H5 序反）。
- 收藏钮**单行**（图标 18×18 与文字同行、不纵向堆叠）：根因曾是 Tailwind preflight 把 `svg` 置 `display:block` ⇒ 修法 = 底栏四件**通用基础规则**（`.sf-item-bar-msg` / `.sf-item-bar-fav` / `.sf-item-cta-group-seg` 各自 `display:inline-flex; align-items:center; gap; min-height:var(--sf-l-cta-h)`），**选择器必须单类 (0,1,0)**（复合 (0,2,0) 会反压 ≥768 块内同单类的 `.sf-item-bar-msg{display:none}` ⇒ 留言在 Web 复活）。

**B. Web 档（1536 · 底栏 `position: static`、`bottom: auto`、容器宽 592）**

- **留言 Web 隐藏**：`item-detail-msg-btn` 实测 `display:none`、rect 全 0（0–0 / 0×0）⇒ **不是靠不渲染**，是 `.sf-item-bar-msg{display:none}` 落 ≥768 块内（DOM 恒在 ⇒ 外壳同构断言不红）。
- **拼接胶囊 = 单容器**：`.sf-item-cta-group` 一个容器内含 ③④ 两段（**924–1430**，合 506）：`item-chat-btn` 924–1019（宽 95，黄 `rgb(255,230,15)`）｜`item-buy-btn` 1019–1430（宽 411，黑 `rgb(32,32,32)` 底 + 白 `rgb(255,255,255)` 字）；**两段共边 1019 逐值相接**、圆角只在外侧两角。
- **独立收藏胶囊**：`fav-toggle` **1438–1516**（宽 78、白底），与拼接组右缘 1430 的间隙 **8px** ⇒ **收藏不得并进拼接组**（判负 #52）。
- 双档 `overflow = 0`、`pageerrors = []`、`consoleErrors = []`。

**C. 两档差异一律纯 CSS（断点 = 767/768）**

- 差异**全部**由 `pages/item/item.css` 的 `@media (max-width: 767px)` / `@media (min-width: 768px)` 两个块承载；**JS 侧零宽度读数**（`matchMedia` / `innerWidth` / `ResizeObserver` 一律不得用于切布局；`theme-shell-isomorphism` 全文扫描会判负）。
- 同一条 DOM 在两档给出不同几何：底栏 `fixed|static`、留言 `flex|none`、拼接序 `DOM 序|order 翻转`、价格行右端读数 `H5 第三行|Web 价格行` —— 均为**同一份 React 树 + 不同 CSS**，无第二套组件。

**D. 详情页数据/渲染读数（同版）**

- 详情 **50 键**（`views` / `wants` / `condition` 三键均在场）；**一次挂载恰 1 条** `/api/prize/<id>` 请求（`prizeReqs = 1`，双档各 1）。
- 价格 `rgb(255,77,0)` / `32px`（橙红大价，承卡面同源）；【包邮】黄 `rgb(255,230,15)`；`0人想要` + `N人浏览` 灰字。
- `condition = NULL` ⇒ 核心标签区渲染【平台结算】（`item-detail-settle-tag` 在场、`item-detail-condition-tag` 缺席）⇒ **兜底臂实测成立**（不是只验「有签」）。

**E. 判负追加（**#51–#54** · 与 #40–#50 **并存、只增不改**）**

1. **#51 底栏几何锚失守**：H5（≤767）底栏非 `fixed` + `bottom:0`、四件任一件高 ≠44、或**后两件右缘不相等**（实测锚 378/378）⇒ 判负。
2. **#52 拼接胶囊被拆 / 收藏混入**：Web 拼接组不是**单容器**（拆成两个独立胶囊）、或 `fav-toggle` 落进拼接组内（实测应独立在 1438–1516、与组右缘间隙 8px）⇒ 判负。
3. **#53 留言 Web 未隐藏**：≥768 下 `item-detail-msg-btn` 仍可见（`display ≠ none`）⇒ 判负（反之**不得**用「不渲染 DOM」达成 ⇒ 同判）。
4. **#54 断点由 JS 决定**：布局分档依赖 `matchMedia` / `innerWidth` / `ResizeObserver`（源码或产物命中）⇒ 判负。

### 26.16 管理员编辑他人商品：详情页【编辑】入口可见性 ＋ 编辑页「管理员编辑」提示 ＋ 编辑页预填改走新读口（2026-10-20 · **加性续登、不升版**（承 §26.12–§26.15 体例）· 纯追加）

> **依据**：Kevin 2026-10-20 指令 —— **「管理员（如 `09b0`）可以编辑他人发布的商品」**（逐字转引自本单派单，**原始会话未入仓** ⇒ 出入以 Kevin 一句话为准）。**前端实现口径（并行前端单）** = 详情页对**本人 / 管理员**显示【编辑】（管理员编辑他人时界面标「管理员编辑」一类提示）；**编辑页预填统一走新读口** `GET /api/listing/:listingId/edit`。**配套** = `route-layer.spec` **§49.15**（授权矩阵 / 读口 11 键 / `/api/user` 加性 `admin` 块 3 键 / 注册点 111 / 判负 #35–#41）+ `data-layer.spec` **§40.11**（`listing_edit_log`）+ `master-plan` **§5.443 / 版本行 v0.360** + `ops/admin-edit/SPEC-NOTE.md`。**本笔零代码**（本节 = 契约冻结，实现归并行前端单）。

#### 26.16.1 现状（现取 · HEAD `5310a72`）

- **详情页无编辑入口**：`ItemDetailPage.jsx` 现取钩子集 = `item-detail-layout` / `item-back` / `item-detail-empty` / `item-buy-form` / `item-detail-seller-row` / `item-detail-seller-credit` / `item-detail-web-cols` / `item-detail-gallery` / `item-detail-media-thumbs` / `item-detail-media-thumb` / `item-detail-media-prev` / `item-detail-media-next` / `item-detail-thumb` / `item-detail-web-side` / `item-detail-price-row` / `item-detail-counts` / `item-detail-wants` / `item-detail-views` / `item-detail-tags-secondary` / `item-detail-secondary-tag` / `item-detail-tag-core` / `item-detail-condition-tag` / `item-detail-settle-tag` / `item-detail-status-tag` / `item-detail-desc` / `item-input-qty` / `item-actionbar` —— **`*edit*` 零命中**。
- **编辑页已存在**：页面路由 `item/:itemId/edit` → `PublishItemPage mode="edit"`（`App.jsx:111` 现取）；**预填源 = `GET /api/listing/mine`**（`PublishItemPage.jsx:268` 一带现取注释与 `item-api.js`）⇒ **该口只列 `seller_uid = me`** ⇒ **管理员取不到他人行 = 结构上不可预填**（这是必须换读口的硬理由，不是优化）。
- **载荷来源**：`GET /api/user` 现取 **8 键**、**无 `admin` 块** ⇒ 前端今天**无法**判定「我是不是管理员」（只能靠 `is_admin` 顶层键，而 `is_admin = false` 但有 `manage_rewards` 位的账号会漏判）。
- **既有可见性先例**：发布列表行内动作**仅 `draft` / `listed`** 出按钮（§26.13.4 矩阵，`sold` / `delisted` 只读）。

#### 26.16.2 入口可见性判据（硬 · **唯一公式**）

```
isOwner      = String(detail?.seller?.uid) === String(user?.uID)
canEditAny   = admin?.can_access_admin === true
               && (admin?.is_admin === true || (admin?.permissions ?? []).includes('manage_rewards'))
statusEditable = detail?.status === 'draft' || detail?.status === 'listed'
showEdit     = isAuthenticated && (isOwner || canEditAny) && statusEditable
```

| 角色 / 状态 | 【编辑】入口 | 判据 |
|---|---|---|
| 未登录 | **不渲染** | `isAuthenticated = false`（**不是置灰**） |
| 本人 ∧ `draft` / `listed` | **渲染** | `isOwner` |
| 本人 ∧ `sold` / `delisted` / `frozen` | **不渲染** | `statusEditable = false`（承 §26.13.4：进去也只会吃 409） |
| 管理员（非本人）∧ `draft` / `listed` | **渲染** | `canEditAny` |
| 管理员（非本人）∧ `sold` / `delisted` / `frozen` | **不渲染** | 同上（管理员不获得额外状态面，route §49.15.2） |
| 普通用户（非本人） | **不渲染** | 两布尔皆假 |

- **判据单一真源（硬）**：`admin` 块**只从** `GET /api/user` 读，**不得**另开读口、**不得**从 `is_admin` 顶层键或 JWT 自造；公式**必须逐字**如上（`manage_rewards` 位与 `is_admin` 是**或**关系、外层必须带 `can_access_admin`）—— 少一项即越权或漏权（判负 #55 / #58）。
- **卖家 uid 取数**：详情响应 `seller.uid`（路由层合成，现取在场）；**不做本地猜补**（`seller` 缺失 ⇒ 视为非本人）。
- **两处同式的漂移风险（诚实登记）**：本公式与 route §49.15.2 的管理员判定是**同一规则的第二处实现**（中文语义同、语言不同）。已挂账：后端后续可在 `admin` 块加派生布尔 `can_edit_any_listing`（一句话可改），届时本公式收敛为单键读取；**本笔不改** Kevin 给定载荷形状。

#### 26.16.3 入口形态与落点（**不碰两处冻结几何**）

- **落点 = 页头行右端**：与既有 `item-back`（返回箭头）**同一行**、**靠右端**；H5 / Web **同一份 DOM**（禁第二套组件），差异只由 CSS 767/768 断点调尺寸。
- **形态 = 文字按钮**「编辑」（复用既有键 `common.edit` = 「编辑」，**零新文案键**；`item.editTitle` = 「编辑闲置」是编辑页标题，**不复用**）；触控目标 ≤767 **≥44**、可见字号 **≥12px**（承 §13 硬口径）。
- **禁用落点（硬）**：
  - **不得进 H5 底栏四件**（§26.15.9 E 判负 #51 冻结：四件同高 44、后两件右缘 378/378 —— 加第五件即破锚）；
  - **不得进 Web 拼接胶囊**（§26.15.9 E 判负 #52 冻结：`.sf-item-cta-group` 单容器 + 独立收藏 8px 间隙）；
  - **不得**用宽度读数决定落点（`matchMedia` / `innerWidth` 全文扫描判负，判负 #54）。
- **钩子（建议名，落定后回写）**：`item-detail-edit-btn`。**既有 `item-back` / 底栏四件 / 两栏钩子一律不动。**

#### 26.16.4 管理员编辑提示（**进编辑页后**才出现）

- **落点**：编辑页**顶部常驻提示条**（表单之前，非 toast、非 placeholder）；钩子 `item-admin-edit-notice`。
- **出现条件（硬）**：进入 `/item/:id/edit` ∧ **当前用户非该行 owner** ∧ `canEditAny = true`。**本人编辑不显示**（本人看自己的商品不需要被告知「你在编辑他人商品」）。
- **文案**：建议键 `item.adminEditNotice`（zh = 「管理员编辑 · 你正在编辑他人发布的商品」；四语同补、非 zh 可标「待复核」）；**建议名，定名后回写**。**不得**把提示写成 placeholder / tooltip（消失即无痕）。
- **几何**：条高不入冻结面（本页无固定高卡）；字号 **≥12px**、对比度按既有 `--sf-btnalt-*` 家族取值（**零新 token**）。
- **不得做的事**：不得因「管理员编辑」而**改表单本身的可见字段集**（字段集 = route §49.15.3 的 6 项，管理员不多不少）；不得禁用 / 隐藏库存输入以外任何控件（草稿库存只读 = 既有 DL60 前端表现，与身份无关）。

#### 26.16.5 编辑页预填取数源切换（**统一走新读口**）

- **取数口改为** `GET /api/listing/:listingId/edit`（route §49.15.4）：本人与管理员**同一条路径、同一 11 键**；`mine` **不再**作为编辑页预填源（保留为「我发布的」列表口，键面仍 11，不动）。
- **预填 6 项逐字不变**：`description` / `price` / `stock` / `media_urls` / `item_type`（级联反推）/ `condition`（成色四选一，实物分支）；`cid` 只读展示；**`item_type = NULL` 不猜补**、`media_urls` 缺失 = 空列表（承 §26.14 / §26.15 既有口径）。
- **失败态**：403（越权）/ 404（行不存在）⇒ **表单不渲染** + 服务端文案（**不得**渲染空表单可提交）；`loadState.phase='error'` 既有形态沿用。
- **保存**：仍单次 `PATCH /api/listing/:listingId`（字段支），成功后回详情页；管理员保存成功 ⇒ 后端落审计行（data §40.11），**前端不显示「已记录审计」一类文案**（审计是后台面，不在用户界面自证）。

#### 26.16.6 i18n 与计数（现取复算）

- **新增键 1 个**（`item.adminEditNotice`）；**「编辑」按钮复用 `common.edit`** ⇒ **顶层命名空间数不变**（键挂在既有 `item` 域内）。
- **现取（2026-10-20 四语逐文件 python walk）**：top **131** / flat **1136** / 四语节点 **4544**（= 1136 × 4，四语键集逐文件相等）⇒ **+1 键后**：top **131**（不变）/ flat **1137** / nodes **4548**。
- **计数断言按现取复算前推**（约 13 个测试文件的硬编计数，一律等值替换、不得照抄本册数字）；四语同补、缺键会渲染裸键名。

#### 26.16.7 判负（**#55–#58** · 与 §26.15.9 E #51–#54、§26.15.6 #40–#50 等家族**并存、只增不改**）

1. **#55 普通用户见入口**：非本人 ∧ 非管理员在详情页看到【编辑】（或看到置灰态）⇒ 判负。
2. **#56 管理员编辑不落审计**：管理员改他人商品成功后 `listing_edit_log` **0 行**（与 route #37 同源、两册同判据）⇒ 判负。
3. **#57 本人编辑落审计**：本人编辑自己商品后 `listing_edit_log` 出现行（`admin_edit = false` 行 ≠ 0 / `owner_uid = actor_uid` 行 ≠ 0）⇒ 判负。
4. **#58 提示缺失或误示**：管理员编辑他人时编辑页**无**「管理员编辑」提示；或**本人**编辑时出现该提示；或判定公式与 §26.16.2 **不一致**（漏 `can_access_admin` / 漏 `manage_rewards` / 只看 `is_admin`）⇒ 判负。

#### 26.16.8 未做 / 读数登记项（本笔零代码 · 明账）

- **未实现**：详情页入口 / 提示条 / 预填源切换 / `/api/user` `admin` 块 / 后端授权扩展与审计写 —— **一行代码未写**；判负 #55–#58 **一条未跑**；未跑任何浏览器几何读数 / 单测 / 截图。
- **读数登记项（不判负）**：入口按钮的实高 / 间距 / 与 `item-back` 的基线对齐；提示条底色与字色；H5 390 与 Web 1536 两档截图；`admin` 块在四类账号（无权限 / 仅角色行 / `manage_rewards` 位 / `is_admin`）下的实测三键值。
- **连带** = route **§49.15** · data **§40.11** · `master-plan` **§5.443 + 版本行 v0.360** · `ops/admin-edit/SPEC-NOTE.md`。本笔只写 `docs/**` 与 `ops/admin-edit/**`，零代码 / 零迁移 / 零测试改动 / **不 push**；`git diff --numstat` **删除列 = 0**。

#### 26.16.9 同树现状披露（2026-10-20 编制期现取 · 不改 §26.16.1–.8 任何条文）

- **前端零改动**：`git status --porcelain` 现取**无** `frontend/**` 条目 ⇒ 详情页入口、编辑页提示条、预填取数源切换**全部未实现**（判负 #55–#58 一条未跑）。
- **后端已在同工作树、未提交**：`GET /api/listing/:listingId/edit`（11 键同族）、`/api/user` 的 `admin` 3 键、`PATCH` 授权扩展与同语句审计**均已落盘**（**未提交 · 两库未 apply**）⇒ 前端单**可以**按本契约接线，但**不得**据「后端已在」宣称功能可用（未 apply ⇒ 管理员编辑会 `42P01`）。
- **接线前的两条硬提醒**：① `admin` 块只在**登录后**的 `/api/user` 载荷里（游客读不到，也不该读）；② 详情页判「本人」用 `detail.seller.uid`，**不要**用 `listing.seller_uid`（详情响应无该键 —— 现有键面是路由层合成的 `seller` 对象）。

## §26.17 详情页精简与「物品编号」换码（**删数量框** / **删「闲置物品」标题与三段说明** / **编号显示 `itemCode`**）（2026-10-20 · **加性续登、不升版**（承 §26.12–§26.16 体例）· 纯追加）

> **依据**：Kevin 2026-10-20 指令三条 —— ① 商品详情页**删除「数量」输入框**；② **删除文案「闲置物品」与三段说明**（「购买金额由平台统一结算，无需填写价格或收款方。」/「购买金额以平台结算为准；重复点击不会重复扣款。」/「退款只退还款项，商品库存不会恢复。」）；③ **商品 Id 统一**（雪花 + `itemCode` 字母数字混合 7 位 + **页面地址用 `itemCode`**）⇒ 详情页「物品编号」显示改为 `itemCode`。**姊妹册** = `data-layer.spec` **§40.12**（两列 / 字母表 / 迁移 `0060`）+ `route-layer.spec` **§49.16**（`:ref` 双形态 / 四口键数 / 页面路由）+ `master-plan` **§5.444 / 版本行 v0.361** + `ops/item-id/SPEC-NOTE.md`。**本笔零代码**（本节 = 契约冻结，实现归并行前端单）。

#### 26.17.1 删除清单（三项 · 逐项给现取落点）

| # | 删什么 | 现取落点（`ItemDetailPage.jsx` · 2026-10-20 工作树） | 删后 |
|---|---|---|---|
| ① | **「数量」输入框** | `:496-506` —— `label.sf-item-field.sf-item-qty-field` + `span.sf-item-label`(`t('item.quantity')`) + `input[data-sf-m="item-input-qty"]` | **整块移除**；**库存行 `:495`（`t('item.stock')` + `row.stock`）逐字保留** |
| ② | **「闲置物品」标题** | `:510` —— `h2.sf-item-title` + `t('item.line')`（在 `.sf-item-meta-group` 内，注释写「平台告知 meta 组」） | **整块移除** |
| ③ | **三段说明** | `:511` `t('item.priceServerNote')` · `:512` `t('item.buyNote')` · `:513` `t('item.refundStockNote')` | 三行移除；外层 `.sf-item-meta-group`（`:508-514`）**随之空壳 ⇒ 连壳一起移除**（留空 `div` = 白占纵向间距，判负） |

- **三段说明逐字**（供核对，别删错对象）：① 「购买金额由平台统一结算，无需填写价格或收款方。」② 「购买金额以平台结算为准；重复点击不会重复扣款。」③ 「退款只退还款项，商品库存不会恢复。」
- **★ ③ 的键与别处共用**：`item.refundStockNote` 在 `MyOrdersPanel.jsx:132` 也被渲染 ⇒ **本次只删详情页那一处引用，键保留**（见 `26.17.4`）。**删键 = 破别人的页面**，这是本节唯一「看起来该删但不能删」的地方。
- **数量框删除后的购买语义（写死）**：
  1. `quantity` 恒 **`'1'`** —— **保留 state 位**（改成常量初始化即可），**不删** `listingBuyFingerprint({ listingId, quantity })` 的入参位；
  2. 请求体仍是 `{ quantity: '1', create_key }` ⇒ **载荷形状零变化**，服务端**不用改**（`listing-funds-service.ts` 只读 `create_key` + `quantity`）；
  3. 每个商品的幂等指纹**收缩为单值** ⇒ 同商品重复点击 = **同一 `create_key`** = 重复扣款被既有幂等吃掉 —— **第 ② 段文案原本在解释的事，现在由行为保证**（这条是删除三段说明的**正当性依据**，不是顺手删）；
  4. **库存 > 1 的商品单次只买 1 件**（要两件 = 点两次、两次幂等键不同）⇒ **产品口径变更，登记，不当缺陷**。
- **不许留下的残留（判负判别子）**：`item-input-qty` 钩子 · `sf-item-qty-field` 类名 · `t('item.quantity')` 的详情页引用 · `.sf-item-meta-group` 空壳 · `sf-item-title` 在详情页的实例。

#### 26.17.2 保留面（一句话划清，防误删）

- **保留**：`item-detail-desc`（描述全文，首行派生标题）· **库存行**（`t('item.stock')` + 数值）· **编号行**（`t('item.listingId')`，**内容换码**见下节）· 状态签（`data-sf-status` + 四语状态文案，原始枚举不进用户面）· 标签两级（§26.15：成色卖点标签 + `item_type` 派生收敛）· 计数（`item-detail-wants` / `item-detail-views`）· 卖家行（`item-detail-seller-row` / `-credit`）· 底栏四件（§26.15.9 E）· Web 两栏（≥768）。
- **位置不动**：编号行仍在**描述之下、库存行之上**；删除**不触发重排**（不许「既然删了就顺手把库存提到上面」——那是另一个决定，另单）。
- **几何（硬）**：本单删的是**纵向流式块**，**不触碰任何冻结锚** —— 底栏四件同高 44 / 后两件右缘 378/378（#51）、Web 拼接胶囊单容器 + 独立收藏 8px 间隙（#52）⇒ **#51/#52 照旧成立、无需重测**。**「页面变短」≠「锚点变位」**：任何人以「内容变了所以要重量几何」为由改锚点 ⇒ 判负。
- **不许借机做的事**：不许加「数量 = 1」的替代说明文案（那等于把删掉的告知换个说法留下）；不许把库存行改成「库存 5 · 每次限购 1」一类新文案（Kevin 没要）。

#### 26.17.3 「物品编号」展示改为 `item_code`

- **展示形（写死）**：`物品编号 <itemCode>` —— 现取是 `物品编号 #<listing_id>`（`:492`，模板串 `${t('item.listingId')} #${String(row.listing_id ?? row.bID ?? id ?? '-')}`）。
- **去掉 `#`**：`#` 在中文语境里是「数字序号」的前缀，而码首字符是字母 ⇒ `#Ab3XyZ9` 读起来像话题标签；且「编号」二字已在标签里，`#` 是重复修饰。
- **标签文字 `item.listingId` 保留**（值仍「物品编号」）⇒ **零新文案键**（判负判别子：新增 `item.itemCode` 一类键 = 白加四语翻译面）。
- **码缺失时显示 `-`**（`itemCode || '-'`），**禁回落数字 id**（回落 ⇒ 同一行可能显示两种编号，用户与客服对不上账；与 route #46 同源）。
- **状态签仍在同一行**（`<状态文案>`，`data-sf-status` 在同一个 `p` 上、`title` 属性同步）⇒ 既有钩子与属性**一律不动**。
- **数字 `listing_id` 从用户可见文案里彻底退场**：不在详情页任何位置以文本形式出现（仍在下发数据里、仍可作旧链接入口）。这与 §26.14「`title` 列退场但读口保留派生 `title` 键」同体例：**数据留、文案走**。

#### 26.17.4 i18n 影响（**新增 0 / 删除 0**；转死键 3 个）

- **新增 0 键**（复用 `item.listingId`）；**删除 0 键**（四语文件一字不动）。
- **转死键（详情页引用消失，键留在 locales）**：

| 键 | zh 值 | 删后仍被引用？ | 依据（现取 grep） |
|---|---|---|---|
| `item.quantity` | 数量 | **否** ⇒ 转死 | 全文仅 `ItemDetailPage:497` 一处 |
| `item.priceServerNote` | 购买金额由平台统一结算，无需填写价格或收款方。 | **否** ⇒ 转死 | 全文仅 `:511` |
| `item.buyNote` | 购买金额以平台结算为准；重复点击不会重复扣款。 | **否** ⇒ 转死 | 全文仅 `:512` |
| `item.line` | 闲置物品 | **是** ⇒ **不转死** | `PublishItemPage:910`（页标题）· `MarketPage:221`（面包屑） |
| `item.refundStockNote` | 退款只退还款项，商品库存不会恢复。 | **是** ⇒ **不转死** | `MyOrdersPanel:132` |

- **死键处置：不删**（承 §26.8 死键清单体例）。理由三条：① 删键要改四语 + 一批硬编计数的测试，收益为零；② `item.line` / `item.refundStockNote` 的键**还在别处用**，删错一个就是白屏；③ 真死键（`quantity` / `priceServerNote` / `buyNote`）留着也无渲染面 ⇒ 无泄漏、无裸键名风险。
- **计数影响（硬）**：**top / flat / nodes 三项零变化** ⇒ 下游硬编计数的测试文件**一律不动**（本单是**唯一**一个「改了详情页却不动 i18n 计数」的改动，正因为零键增减）。

#### 26.17.5 判负（**#59–#63** · 与 §26.16.7 #55–#58、§26.15.9 E #51–#54、§26.15.6 #40–#50 家族**并存、只增不改**）

1. **#59 数量框回潮**：详情页出现可编辑数量控件（`input` / `select` 承载数量、`item-input-qty` 钩子在场、`sf-item-qty-field` 在场）⇒ 判负。
2. **#60 三段文案回潮**：详情页渲染 `item.priceServerNote` / `item.buyNote` / `item.refundStockNote` 任一 —— **含换皮**（tooltip / placeholder / 折叠面板 / 「一次限购 1 件」替代说明）⇒ 判负。
3. **#61「闲置物品」标题回潮**：详情页出现 `t('item.line')`（任一标题行）或 `.sf-item-meta-group` 以任何名目复活 ⇒ 判负。
4. **#62 编号仍是数字**：编号行显示 `#<listing_id>` / 显示值与 `itemCode` 不一致 / `itemCode` 缺失时回落数字 id ⇒ 判负。
5. **#63 购买载荷被连带改**：请求体缺 `quantity` 或 `create_key`、或 `quantity ≠ '1'`、或 `listingBuyFingerprint` 的入参位被删 ⇒ 判负（「删了个输入框，顺手改了资金链路的载荷」是本单最危险的连带）。

#### 26.17.6 未做 / 读数登记项（本笔零代码 · 明账）

- **未实现**：三项删除、编号换码、链接生成改码 —— **一行前端代码未写**；判负 #59–#63 **一条未跑**；未跑单测 / 浏览器几何读数 / 截图。
- **读数登记项（不判负）**：删后 H5 详情页总高变化；Web 右栏在删除后的留白与内容重心；编号行与库存行间距；编号行在窄屏（390）是否换行。
- **连带**：`data-layer.spec` §40.12 · `route-layer.spec` §49.16 · `master-plan` §5.444 + 版本行 v0.361 · `ops/item-id/SPEC-NOTE.md`。本笔只写 `docs/**` + `ops/item-id/**`，零代码 / 零迁移 / 零测试改动 / **不 push**；`git diff --numstat` **删除列 = 0**。

## §26.18 多件购买授权：发布/编辑页开关（**仅 `stock > 1` 可见 / 默认关 / 降量自动关**）＋ 购买数量确认弹层（2026-10-20 · **加性续登、不升版**（承 §26.12–§26.17 体例）· 纯追加）

> **依据**：Kevin 2026-10-20 口径 —— ① **发布商品时若商品数量（stock）> 1**，用户需填写一个选项「**是否支持一次购买多个**」；② **开启** ⇒ 购买者点【立即购买】后**弹确认购买数量的提示**（数量**默认 1**，上限 = `min(stock, 单次上限)`）；③ **未开启** ⇒ **恒买 1 件、零提示**。**上下文**：同日 §26.17 已把详情页「数量」输入框删除（常显表单 → 购买恒 `quantity=1`）⇒ 本节把「多件购买」改为**卖家授权 + 购买时询问**，是 §26.17 的**配套补口**、不是回潮。**姊妹册** = `data-layer.spec` **§40.13**（列 / 归一 / 迁移 `0061`）+ `route-layer.spec` **§49.17**（写口 + 购买校验矩阵 + 读口键数）+ `master-plan` **§5.445 / 版本行 v0.362** + `ops/multi-buy/SPEC-NOTE.md`。**本笔零代码**（本节 = 契约冻结，实现归并行前端单）。

#### 26.18.1 发布 / 编辑页的开关（可见性 / 默认值 / 形态）

| 项 | 口径（写死） |
|---|---|
| 钩子 | `data-sf-m="item-input-multi-buy"`（承载 `input[type=checkbox]`）。**开关不配提示行**（标签自解释 ⇒ **零额外 i18n 键**；将来若确需说明，单独加键、另单） |
| **可见性** | **仅当 `Number(form.stock) > 1`** 时渲染。判据 = **输入框当前值的数值**（`Number(...)`，非字符串比较 —— `'10' > '9'` 在字符串下为 `false`，是本节最易写错的一处） |
| `stock ≤ 1` | **整块不渲染**（含 label 与提示）；且 **`state.allowMultiBuy` 强制 `false`**（不可见 ≠ 不提交：不可见时 state 仍是 false 才对；只藏控件不清 state = 提交 `true` ⇒ 撞 `W3` 400） |
| `stock` 空 / 非法暂态 | 视同 `≤ 1` ⇒ **不渲染、state `false`**（不报错、不阻塞其余输入；提交闸另有既有 `stock` 校验） |
| 默认值（新建） | **关（未勾选）** —— 与 `DEFAULT false` 一致；**不得**因「库存填了 5」就自动勾上（默认开 = 替卖家授权，静默放大成交件数） |
| 编辑页预填 | 取读口 `allow_multi_buy`（`GET /api/listing/:listingId/edit` 的 **14** 键之一，route §49.17.5）。**行内值为 `true` 但 `stock = 1`**（卖到最后一件的正常终态，`data §40.13.2`）⇒ **控件不渲染、state 归一 `false`、保存时不带该键** |
| 形态 | **单枚 `checkbox` + `<label>`**（原生可达、点文字生效），**不新造 switch / 滑块**：仓内既有表单控件体例就是 `checkbox`（`components/ui/Form.jsx:185`、`admin/SystemSettings.jsx:222/234/246` 等 5 处），新造 switch = 新 CSS 类 + 新触控几何面 + 一套 `role="switch"` 键盘语义，收益为零 |
| 文案 | `item.multiBuyLabel` =「支持一次购买多个」（**四语同补**，见 `26.18.5`） |
| 触控 / 字形 | 命中区（checkbox + label 整块）**≥ 44px**（≤767 档，承 `T77`）；可见文本 **≥ 12px**（`T79`） |
| 落点 | **紧跟「库存」输入框之后**（`item-input-stock`，`PublishItemPage.jsx:683-688`；草稿锁提示 `:691-693` 之后），**在「商品分类」级联之前**（`:724`）。理由：它与库存是同一决策簇（先定数量、再定能不能多买），且**不得进** `item-side`（`:909`）或 `item-status`（`:896`）等右栏/摘要区 |
| 提交 | `stock > 1` ∧ 勾选 ⇒ 载荷带 `allow_multi_buy: true`；未勾选 ⇒ 带 `false`（显式，别依赖缺省）；`stock ≤ 1` ⇒ **带 `false`**（或省略）—— **禁带 `true`**（⇒ `W3` 400） |
| 不进指纹 | 发布指纹仍 4 项（`listingPublishFingerprint`，`item-api.js:161-162`）⇒ 勾不勾选**不影响** `create_key` |

- **不许做的事**：不许在 `stock ≤ 1` 时渲染**置灰**的开关（= 告诉用户「有过这个能力但你不能用」，且置灰控件仍占行高、仍会被误读为可点）；不许把开关做成三态（「跟随库存」一类）；不许在开关旁渲染「买家最多买 N 件」这类**由服务端才能保证**的承诺文案（上限是 UI 收敛值，见 `26.18.3`）。

#### 26.18.2 编辑页降量 ⇒ 开关自动关（**单向**）

- **触发**：编辑页 `stock` 输入变化，其数值 **≤ 1** ⇒ `state.allowMultiBuy` **立即置 `false`**（同步：控件消失 + state 归零 + 提交不带 `true`）。
- **不回涨（写死）**：库存再改回 ≥ 2 ⇒ 开关**保持关闭**，**不自动恢复**上一次勾选。理由：① 「降到 1 又改回 3」多是手误，静默恢复 = 替卖家做了「仍然授权」的决定；② 服务端的 `W5` 归一已经把「未带该键 + `stock ≤ 1`」落成 `false`，若前端偷偷恢复 `true`，卖家看到的现象（勾着）与库里的值（`false`）会分叉 —— 这是最难查的一类账实不符。
- **保存后以读口为准**：`PATCH` 成功 ⇒ 用响应/重取的 `allow_multi_buy` 回填 state（不在前端「记住我认为的值」）。
- **`stock ≤ 1` 且原行为 `draft`**：`stock` 输入本就 `disabled`（DL60，`:688` `disabled={stockLocked}`）⇒ 开关也**不渲染**（可见性判据同样成立：行内 `stock` 若 ≤1 ⇒ 隐藏）；若行内 `stock ≥ 2` 而 `stock` 不可改 ⇒ 开关**可改**（改它不碰 `stock`，不受 DL60 约束，route §49.17.2 末条）。

#### 26.18.3 详情页：购买数量确认弹层（`allow_multi_buy === true` 且 `cap ≥ 2` 才弹）

**判定与闸序（写死）**：点【立即购买】= 触发表单 `submit` ⇒ 既有 `onBuy`（`ItemDetailPage.jsx:199`）**第一段**做三件事，顺序不可换：

| 步 | 判定 | 动作 |
|---|---|---|
| ① | `buy.phase === 'loading'` | 直接返回（既有防连点，一字不改） |
| ② | `row.allow_multi_buy === true` ∧ `cap = min(Number(row.stock), MULTI_BUY_MAX_QUANTITY) >= 2` | **弹层**（`setDialogOpen(true)`）⇒ **本次零请求**（`fetchApiJson` 计数 = 0） |
| ③ | 否则（`allow_multi_buy` 非真 / `cap ≤ 1` / `stock` 非数） | **零提示直接买 1 件**（`quantity = '1'`，走既有 `onBuy` 主体，逐字不变） |

- **`cap` 定义**：`cap = min(Number(stock), MULTI_BUY_MAX_QUANTITY)`；`MULTI_BUY_MAX_QUANTITY = 10` = **前端局部常量**（建议落 `pages/item/item-api.js` 或页面同目录常量文件），**一句话可改**；服务端**不设第三道闸**（route §49.17.4 末条：`quantity ≤ stock` 已由 DB 硬闸兜住）。`stock = 1`（B7 正常终态）⇒ `cap = 1` ⇒ **不弹**（这是「买到最后一件」的正确表现，不是缺陷）。
- **弹层形态（写死）**：**居中遮罩弹层**（`position:fixed` + 半透明背板、`z-index` 高于 `.sf-tabbar`/`.sf-item-actionbar`），**不是**页面内常显控件、**不是**行内展开面板。⇒ 与 §26.17 删除的「常显数量输入框」是**两个东西**：那是「每次购买都要填」，这是「授权后才问一次」（判负 #59 的尺子是「页面正文出现可编辑数量控件」，弹层层内的输入**不算**，见 `26.18.6`）。
- **弹层内容（写死五项）**：
  1. 标题：`item.buyQtyTitle` =「选择购买数量」；
  2. 提示行：`item.buyQtyHint` =「该商品支持一次购买多个，最多 `{{n}}` 件」，`n = cap`（**必须显示** —— 否则买家不知道为什么加到 3 就加不动）；
  3. 数量控件：`input[type=number]`（`data-sf-m="item-buy-qty-input"`），`min=1` / `max=cap` / `step=1`，**默认 `1`**（Kevin 逐字），聚焦时选中 `1` 便于直接改写；
  4. 取消：复用顶层 `cancel`（「取消」）—— `data-sf-m="item-buy-qty-cancel"`；
  5. 确认：复用 `item.buy`（「立即购买」）—— `data-sf-m="item-buy-qty-confirm"`。
  容器钩子 `data-sf-m="item-buy-qty-dialog"`。**不新增 `data-sf-region`**（五 region 恒等断言）。
- **非法值处理**：输入越界（`<1` / `>cap` / 非整数 / 空）⇒ 确认按钮置灰 + 内联提示（复用既有错误键，**不新造文案**）；**不得**静默 clamp 后成交（`clamp` 会让买家以为买了 10 件、实际 3 件 —— 件数直接对应金额）。
- **关闭语义**：点「取消」/ 背板 / `Esc` ⇒ 关层 + `quantity` 复位 `'1'` + **零请求**；焦点回【立即购买】。
- **确认后**：把选定 `n` 写入 `quantity` 再走既有 `onBuy` 主体 ⇒ `createKey = tracker.keyFor(listingBuyFingerprint({ listingId: id, quantity }))`（`listingBuyFingerprint` 含 `quantity`，故**不同件数天然不同 `create_key`**，同件数重复点击仍由幂等吃掉）；请求体仍是 `{quantity, create_key}`（**载荷形状零变化**，route §49.17.4）。
- **几何边界**：弹层是 `fixed` 覆盖层 ⇒ **不进 `scrollWidth`**（零横向溢出判据对本形态不承重，只作旁证），**不触碰 #51/#52 两个底栏几何锚**（不渲进 `.sf-item-bar-left` / `.sf-item-bar-right` / `.sf-item-cta-group` 任一容器）。
- **未登录**：既有 `disabled={... || !isAuthenticated}`（`:553`）在弹层之前生效 ⇒ **未登录点不到弹层**（保持现有登录引导语义，本单不新造）。
- **`buy.phase` 复用**：弹层「确认」后沿用既有 `loading / ok / error` 三态与文案（`item.buyOk` / `t('error')`），**不新增状态机、不新增结果弹层**。

#### 26.18.4 判负（**#64–#69** · 与 §26.17.5 #59–#63、§26.16.7 #55–#58、§26.15.9 E #51–#54 家族**并存、只增不改**）

1. **#64 开关常显**：`stock` 输入为 `1`（或空 / 非法）时 `item-input-multi-buy` **仍在 DOM**（含置灰形态）⇒ 判负。
2. **#65 默认开**：新建表单初始即勾选（或库存填 >1 后自动勾上）⇒ 判负。
3. **#66 降量残留**：编辑页把 `stock` 改成 `1` 后，开关仍勾选可见 **或** 提交载荷仍带 `allow_multi_buy: true` ⇒ 判负；反向臂 = 改回 ≥2 时**自动**恢复勾选 ⇒ 同判（`26.18.2` 单向）。
4. **#67 弹层触发错**：`allow_multi_buy=false` 或 `cap ≤ 1` 时点【立即购买】**出现弹层**（含「一键确认」变体）⇒ 判负；反向臂 = `allow_multi_buy=true` ∧ `cap ≥ 2` 时点【立即购买】**直接发请求、无弹层**（请求计数 = 1）⇒ 判负（两臂都测，只测一臂等于没测）。
5. **#68 弹层参数错**：默认值 ≠ `1`；输入可选值超出 `1..cap`；`cap` 数不显示（提示行缺失或写成固定文案）；「取消 / 背板 / Esc」任一仍发出购买请求 ⇒ 判负。
6. **#69 件数没落到载荷**：弹层确认 `n` 件后请求体 `quantity ≠ 'n'`（仍是 `1`）、或缺 `create_key`、或 `create_key` 与 `n` 无关（把指纹写死成常量）⇒ 判负。

#### 26.18.5 i18n 影响（**+3 键** · 复用 2 键 · 计数现取复算）

| 键 | zh（建议值） | 用途 |
|---|---|---|
| `item.multiBuyLabel` | 支持一次购买多个 | 发布 / 编辑页开关标签 |
| `item.buyQtyTitle` | 选择购买数量 | 弹层标题 |
| `item.buyQtyHint` | 该商品支持一次购买多个，最多 `{{n}}` 件 | 弹层提示（**`{{n}}` 双花括号** —— 本仓 i18next 未自定义 prefix/suffix，写 `{n}` 不插值） |

- **复用（零新增）**：`cancel`（顶层 =「取消」）· `item.buy`（=「立即购买」）。
- **计数（现取 2026-10-20 · `frontend/src/locales/*.json` 四语逐字相等）**：top **131**（不变，三键均落 `item` 下）/ flat **1137 → 1140** / nodes **4548 → 4560** / `item` 命名空间 **65 → 68**。⇒ 下游**硬编计数**的测试文件按**现取复算**等值前推（本仓实测新增键会牵动约 13 个文件；**禁**照抄册内数字）。
- **非 zh 译文**：可先落英文 / 标「待复核」（承既有体例）；**禁**为了凑四语键集而把 zh 值复制进 hk/vn（会被当未翻译漏检）。**键集四语必须同数**（多/少一个键 ⇒ 门套红）。

#### 26.18.6 与 §26.17 的冲突处置（**状态改写式** · 旧字面逐字保留 · 以本段为准）

> **依据**：§26.17 是在「授权开关尚不存在」的前提下冻结的，其中三条字面在本单落地后**必然与实现分叉** ⇒ 本节**定向收窄**，**不删旧句**（旧句仍可检索，用于解释「为什么当时是那样」）。

| 旧字面（§26.17，逐字保留） | 现行口径（以本段为准） |
|---|---|
| §26.17.1「`quantity` 恒 **`'1'`**」 | **收窄**：`allow_multi_buy` 非真 **或** `cap ≤ 1` 时恒 `'1'`；`allow_multi_buy === true` ∧ `cap ≥ 2` ∧ 买家在弹层确认 `n` ⇒ `quantity = 'n'`。**其余场景一律 `'1'`**（不存在第三种入口） |
| §26.17.1「**库存 > 1 的商品单次只买 1 件**（要两件 = 点两次）⇒ 产品口径变更」 | **状态改写**：仅在 `allow_multi_buy = false` 时成立；`true` ⇒ 单次可买 `1..min(stock, 10)` 件（`cap`）。 |
| §26.17.5 **#63**「…或 `quantity ≠ '1'`… ⇒ 判负」 | **该分句作废**。现行 #63 = 「请求体**必含** `quantity` 与 `create_key`；`quantity` 恒**正整数**；**未走弹层时恒 `'1'`**；`listingBuyFingerprint` 的入参位不得被删」。⇒ 判负对象从「值不等于 1」改为「**授权态与件数不匹配**」（授权 false 却 >1 / 授权 true 却恒 1 且弹层被跳过 / 指纹不含件数）。 |
| §26.17.5 #59「数量框回潮：详情页出现可编辑数量控件（`item-input-qty` / `sf-item-qty-field` / 页面正文内 `input`）」 | **不动，照旧生效**：判负对象是**页面正文常显控件**。本节的弹层层内 `input`（`item-buy-qty-input`）**不属于**该判据；但若把弹层做成**页面内常显块**（无遮罩、常驻可见、无需点击即出现）⇒ **#59 与 #67 同时命中**。 |
| §26.17.1「不许加『数量 = 1』的替代说明文案」 | **仍生效**；本单的弹层提示是**授权后的上限说明**（`最多 {{n}} 件`），**不是**「恒为 1」的告知 ⇒ 不违该条。**但**不得在页面正文另加「每次限购 1 件」类静态文案。 |

- **同一空间里的两个「数量」概念必须分清（登记）**：「页面正文的数量框」（已删，禁回潮）vs「弹层里的数量选择」（本单新增，仅授权后出现）。**混为一谈会让质检把目标态判成回潮**，故在此显式并列。

#### 26.18.7 落点约束 / 读数登记项 / 未做（本笔零代码 · 明账）

- **落点约束**：CSS 一律落 `pages/item/item.css`（该文件**不得含 `[data-theme`**，`p6-btn-impl2` 硬扫）；**`shell.css` 一个字节不动**（唯一 767 断点块、无 `[data-theme` 两条双边断言照旧）；弹层若需 z-index / 遮罩 token ⇒ **先用既有 token**，无对应值则落**页面局部常量**（承 §22 的「参考图色不进主题层」体例，**零 `TOKEN_KEYS` 变更、免四处 PROV**）。
- **不许动**：#51 H5 底栏四件几何锚（同高 44 / 后两件右缘 378/378）· #52 Web 拼接胶囊单容器 + 独立收藏 8px 间隙 · 五 `data-sf-region` 恒等 · `item-buy-btn` 既有钩子名与 `type="submit"`（弹层拦截在 `onSubmit` 内，**不改按钮类型**，否则表单回车提交语义丢失）。
- **读数登记项（不判负，供质检取数）**：① 弹层 `z-index` 与底栏实际层叠（`elementFromPoint` 在弹层中心须命中弹层）；② 390×844 下弹层是否溢出（`scrollHeight` vs 视口）；③ 开关命中区实测高度（≥44）与可见文本字号（≥12px）；④ 编辑页 `stock` 改 1 后的 state 快照（`allowMultiBuy === false`）；⑤ `cap` 在 `stock=2/10/25` 三种库存下的取值（`2 / 10 / 10`）。
- **未实现 / 未测**：开关、降量自动关、弹层、上限常量、i18n 三键 —— **一行前端代码未写**；判负 **#64–#69 一条未跑**；零 HTTP 实测、零库写、零截图。
- **连带**：`data-layer.spec` §40.13 · `route-layer.spec` §49.17 · `master-plan` §5.445 + 版本行 v0.362 · `ops/multi-buy/SPEC-NOTE.md`。本笔只写 `docs/**` + `ops/multi-buy/**`，零代码 / 零迁移 / 零测试改动 / **不 push**；`git diff --numstat` **删除列 = 0**。

## §26.19 活动任务体系骨架预留：活动列表 `/campaign` ＋ 活动详情 `/campaign/:ref`（H5/Web 两形态 · **零实现、零 token、零 i18n 键落地**）（2026-10-20 · **加性续登、不升版**（承 §26.12–§26.18 体例）· 纯追加）

> **依据**：Kevin 2026-10-20 活动体系四点定案（逐字转引自本单派单；同日两次 OOB —— Subtask Type 先扩 6 再**删 `poll`** 收敛 **5** 类，本节按 5 类登记）。**本节 = 骨架预留 ＋ 判负**（页面路由建议形、区块语义、判负），**一行前端代码未写**（实现归并行前端单）。**连带** = `data-layer.spec` §40.14（五表）· `route-layer.spec` §49.18（七口路由 · 页面路由不计注册点）· `master-plan` §5.446 ＋ 版本行 v0.363 · `ops/campaign/SPEC-NOTE.md`。

#### 26.19.1 页面路由与骨架（建议形，实现单可调）

- **页面路由两条**：`/campaign`（列表）、`/campaign/:ref`（详情；`:ref` 直传后端 R2，形态语义同 route §49.18.1）。
- **H5 ≤767 列表**：单列卡片流；活动卡 = ①标题 ②时间窗行 ③状态徽标行 ④描述首行（截断体例承 §26.13 显示链）。**禁 >1 列**。
- **Web ≥768 列表**：≥2 列网格（列数实现单定）；卡片同构 H5。
- **详情（两形态）**：**两级结构写死** = 活动头（标题/时间窗/状态）→ 任务卡列表（task，含自身状态与时间窗）→ 子任务清单（subtask：标题 ＋ 类型徽标 ＋ required 标 ＋ content）；**禁拍平成单级列表**。
- **required 承载**：必做/选做必须有视觉区分（建议键 `campaign.requiredTag` / `campaign.optionalTag`）。
- **时间窗显示**：start/end 任一在场即渲染，格式化走 i18n；**禁 ISO 原串直出**。
- **类型徽标（5 类）**：`type_code` → 前端 i18n 键 `campaign.type.<type_code>`（**5 键**：`x_verify`/`onchain_snapshot`/`survey`/`prediction`/`quiz`）优先、后端 seed `label`（中文）兜底；**直出英文 code ⇒ 判负 #74**。
- **ended 终态视觉**：ended 活动卡与 active 有可区分呈现（建议键 `campaign.endedTag`）。
- **组件隔离**：活动卡**独立组件**，**禁复用 `sf-listings-card` 等商品卡类名/组件**（样式与语义双污染）。
- **shell 红线不动**：不新增 `data-sf-region`（五恒等集不动）、`shell.css` 一字节不动（唯一 767 断点块断言照旧）、**零新 token**（新色先落页面局部常量，承 §26.18.7 体例）。

#### 26.19.2 i18n（零键落地 · 建议键清单）

- 建议键族 `campaign.*`（`listTitle` / `taskCount` / `timeWindow` / `requiredTag` / `optionalTag` / `endedTag` / `type.*` **5** 键 等）⇒ **本笔零键落地**，计数 **`NOT_MEASURED`**；落地后 top/flat/nodes 以现取回填（现基线 = multi-buy 后 top **131** / flat **1140** / nodes **4560**，转引自 §5.445，本笔未复测）。

#### 26.19.3 判负（**#70–#76** · 承 #51–#69 家族只增不改）

1. **#70 详情拍平**：详情页无 task→subtask 两级结构（单级列表）⇒ 判负。
2. **#71 required 无承载**：必做/选做不可区分 ⇒ 判负。
3. **#72 时间窗失格**：ISO 原串直出，或 start/end 缺一渲染成残缺行 ⇒ 判负。
4. **#73 组件混用**：活动卡复用商品卡类名（`sf-listings-card` 等）⇒ 判负。
5. **#74 类型直出 code**：无 i18n 键且无 seed label 兜底，页面直出 `x_verify` 等英文 code ⇒ 判负。
6. **#75 终态不可辨**：ended 与 active 卡视觉不可区分 ⇒ 判负。
7. **#76 破坏 shell 红线**：新增 `data-sf-region` / 改 `shell.css` / 新 token 进主题层 ⇒ 判负。

#### 26.19.4 落点约束与未做（本笔零代码 · 明账）

- **落点**：新页面 CSS 落页面级文件（`pages/campaign/…` 建议形）；**零 `TOKEN_KEYS` 变更**（免四处 PROV，承 §26.18.7）。
- **未实现/未测**：两条页面路由、两形态骨架、i18n 键 —— **一行代码未写**；判负 #70–#76 一条未跑；零截图、零 HTTP 实测、零库写。本笔只写 `docs/**` ＋ `ops/campaign/**`，**不 push**；`git diff --numstat` **删除列 = 0**。

#### 26.19.5 prediction（预测）子任务 UI 形态（建议形 · 零实现 · 追加于本节末、不新开节）

- **形态四件**（详情页子任务卡内的 prediction 卡，承 26.19.1 两级结构）：① **题目** = `subtask.title`（＋ `content` 长文行）；② **两枚选项大按钮** = `payload.option_a` / `payload.option_b` 各一枚（**恰两枚、同构等权**，触控目标 **≥44**（≤767 档承 §13）；点击 = 提交 `{choice:'a'|'b'}`，**提交后锁定为已选态、不可再点不可改**（一人一票，data `CP-P4`））；③ **截止时间行** = `payload.deadline` 本地时区格式化（禁 ISO 直出，承 #72）；④ **结算后（settled）** = **正确选项高亮标记** ＋ **个人输赢**（选对 ⇒ 「+N」瓜分额；选错 ⇒ 未中奖态；**N = 服务端派生**（建议 settle/读口透出 `payout`），前端**禁按公式自算金额**（承「客户端只读、永不本地算」纪律））。`deadline_reached` 未 settled 态 = 展示「已截止 · 待结算」（建议键，禁静默无呈现）。
- **i18n**：建议键族 `campaign.prediction.*`（`deadlineRow` / `voteLocked` / `awaitSettle` / `winLabel` / `loseLabel` 等）⇒ **零键落地**、计数 `NOT_MEASURED`，落地后现取回填（基线现取 = §26.19.2 行）。
- **判负（#77–#78 · 承 #70–#76 家族只增不改）**：
  1. **#77 三选项**：渲染三枚及以上选项 ⇒ 判负（数据源 payload 恰 `option_a`/`option_b`、UI 恰两枚大按钮）。
  2. **#78 自由文本**：选项渲染成自由文本输入（`<input>`/`<textarea>` 填空形态）⇒ 判负（投票 = 二选一按钮，非填空）。
- **未做**：零实现（本节为形态预留，实现单可调）；判负 #77–#78 一条未跑；零截图 / 零 i18n 键 / 零代码。

#### 26.19.6 创建/编辑表单奖励口径（建议形 · 零实现 · 追加于本节末、不新开节 · Kevin 2026-10-20 登记 ＋ 同日再裁 · **以本段为准**）

> **状态改写式声明**：派单初稿「subtask 奖励从 task 的 $ 预算中出」旧字面逐字保留于本段 ⇒ **以本段为准（同日再裁覆盖）**：subtask 奖励与 task 预算**相互独立、零扣减呈现**。§26.19.1–§26.19.5 与 §26.18 全文一字未动。**数据面正典** = `data-layer.spec` **§40.14.9**（`CP-R1…R6` ＋ 判负 `CP-N7…N10`）。

- **task 奖励输入（创建/编辑表单）** = **主奖励 $（必填；只渲染 $ 单位，无币种选择位）** ＋ **可选第二奖励（币种下拉 ＋ 金额）**：币种下拉 = 平台货币列表（`status = 'listed'`，**排除 `$`（cid = 1）自身**）；选了币别金额必填、反之亦然——**两字段同现同缺联动**（承 §26.20.2 建页两币联动体例）。
- **subtask 奖励输入只允许 $**：subtask 行（五类通用；prediction 沿 §26.19.5 两选项形态）奖励输入**只渲染 $ 计量、无币种选择位**；**禁把 subtask 奖渲染为 task 预算的扣减项 / 余额分支**（同日再裁 ①：无扣减关系）。
- **两概念分区呈现（同日再裁 ② · 建议形）**：task 完成奖（**全部 subtask 完成后发放 · 延后 · 可含次币**）与 subtask 即时奖（**$ · 几乎即时领取**）在详情页 / 表单中**视觉可区分**（分区或标签），禁混为一个「奖励」概念。
- **i18n**：建议键族沿用 `campaign.*`（`rewardPrimary` / `rewardSecondary` / `rewardCid` / `rewardInstant` / `rewardCompletion` 等）⇒ **零键落地**、计数 `NOT_MEASURED`（基线 = §26.19.2 行，未复测）。
- **判负（#84–#86 · 承 #51–#83 家族只增不改）**：
  1. **#84 奖励输入形态失格**：缺 $ 主奖励必填位 / 次币币别与金额不同现同缺（联动失效）/ 次币下拉含 `$`（cid = 1）⇒ 判负。
  2. **#85 subtask 奖非 $**：subtask 奖励输入出现币种下拉或非 $ 计量 ⇒ 判负。
  3. **#86 预算扣发呈现 / 实现（同日再裁 ③）**：表单或页面把 subtask 奖励实现 / 渲染为从 task 预算扣减 ⇒ 判负（以本段为准：两账独立）。
- **未做**：零实现（创建/编辑面归实现单，写口路由面 = route §49.18 R4/R6/R7）；判负 #84–#86 一条未跑；零截图 / 零 i18n 键 / 零代码。本笔只写 `docs/**` ＋ `ops/campaign/**`，**不 push**；`git diff --numstat` **删除列 = 0**。

#### 26.19.7 prediction 发布 = 只读 Yes/No 芯片 ＋ quiz 发布 = 四选项/正确项多选/奖励 ＋ 参与面只认服务端判分（**已实现** · 追加于本节末、不新开节 · 依据 = Kevin 2026-10-22 两条裁定，逐字转引自本单派单，**原始会话未入仓 ⇒ 出入以 Kevin 一句话为准**）

> **状态**：本节**不是建议形** —— 与 §26.19.5 / §26.19.6 不同，契约所述形态**已在 HEAD `5a1f327` 落码**（`frontend/src/pages/project/ProjectForms.jsx` / `pages/campaign/SubtaskForm.jsx` / `pages/campaign/campaign-util.js` / `project-payload.js` / `campaign.css` ＋43 行 / `project.css` ＋32 行）。**改判关系**：§26.19.5 的「两枚选项大按钮 = `payload.option_a` / `option_b`」与 §26.19.6 的「subtask 行五类通用奖励输入」旧字面**逐字保留** ⇒ 以本节为准（prediction 选项文案不再来自 payload；quiz 的奖励输入是**唯一**必填的 subtask 奖励）。**shell 红线不动**：零新 `data-sf-region`、`shell.css` 一字节未动、**零新 token**（新样式落页面级文件）。**数据面正典** = `data-layer.spec` **§40.14.10**；**接口面** = `route-layer.spec` **§49.18.7**。

**A. 发布 / 编辑表单（`SubtaskRowEditor`，task 表单可多行、subtask 表单单行）**

| 类型 | 字段 | 形态 | 契约 |
|---|---|---|---|
| `prediction` | 选项 | **两枚只读芯片**：容器 `aria-readonly="true"`，逐枚 `<span>`（**不是 `<input>`**、不可点、不可改、无 placeholder），文本恒取自 i18n `campaign.predictionYes` / `campaign.predictionNo` | 芯片**不参与载荷**（载荷恰两键 `{prize_amount, deadline}`）；**禁**再出现 `optionA`/`optionB` 输入框（判负 #87） |
| `prediction` | 奖池 | `input`（`data-sf-field="prize"`，`inputMode="numeric"`），单位 `$` 前缀固定 | 正整数；缺/0/非数 ⇒ **零请求**报错（文案 `project.predictionInvalid`） |
| `prediction` | 截止时间 | `input`（`data-sf-field="deadline"`） | 可解析时间；缺失 ⇒ 同上报错 |
| `quiz` | 四选项 | 四枚 `input`（`data-sf-field="quiz-a…quiz-d"`），占位 `project.fQuizOption`（`{{key}}` = A–D） | **四格全填**（trim 后非空）；缺任一格 ⇒ **零请求**报错 `project.quizInvalid` |
| `quiz` | 正确项 | 四枚 `checkbox`（`data-sf-field="quiz-correct-a…d"`，`label.sf-project-check`） | **1–4 个**、至少 1；0 个 ⇒ 零请求报错 `project.quizInvalid`；**不新造 switch 控件**（承 §26.18 体例：仓内既有体例即 checkbox） |
| `quiz` | 答对奖励 | `input`（`data-sf-field="quiz-reward"`，`inputMode="numeric"`） | **必填、> 0、只 `$`**（**无币种选择位**，承 §26.19.6 ③）；空/0/非数 ⇒ 零请求报错（文案 `project.fQuizReward` 已写明「必填」）；落 `SubtaskInput.reward_amount`（**列**，不进 payload） |

- **零请求校验四类**（提交前一律本地拦，**不发请求**）：① `type_code` 未选；② prediction 奖池/截止缺失或非法；③ quiz 四选项未填满或正确项 0 个；④ quiz 奖励缺失/≤0。错误文案键 `project.predictionInvalid` / `project.quizInvalid` / `project.rewardInvalid` 等（`errorTextOf` 逐 code 映射；`project.fQuizReward` 是字段占位文案，非错误文案）。
- **奖励载体不可混淆**：quiz 奖励**必须**落 `reward_amount` 列；写进 `payload` ⇒ 后端 400 `QUIZ_PAYLOAD_SHAPE`（前端已按列发送，判负 #90）。
- **编辑既有行**：prediction 已结算（payload 带 `correct_option`）⇒ **不可重发**（整组追加时该行跳过，库内原值保留）；quiz 读回缺 `correct`（公开读口已脱敏）或缺 `reward_amount` ⇒ 同样**不发该行**（重发会抹掉答案/奖励）。**这是「宁可少发一行，不静默改写」的形态落点**。

**B. 参与面（任务详情页子任务卡内的面板）**

| 类型 | 形态 | 提交 | 结果展示 |
|---|---|---|---|
| `prediction` | 两枚等权大按钮，主标签 i18n `campaign.predictionYes/No`（触控 ≥44、≤767 档承 §13）；存量四键行另起**副行只读提示**显示 `payload.option_a/option_b` 原文（不参与选项集） | `{choice:'yes'\|'no'}`；提交后**锁定为已选态**（不可再点不可改） | 结算后：**正确项标记**（`campaign.prediction.correct`）＋ **个人输赢**（`campaign.prediction.win` / `lose`）＋ 奖金行（`campaign.prediction.payout`，金额**服务端 `payout` 直出**）；`deadline_reached` 未结算 ⇒ `campaign.prediction.awaitSettle` |
| `quiz` | 四选项**多选**按钮（`aria-pressed`、`data-sf-picked`），键位 A–D 由 `QUIZ_OPTION_KEYS` 固定；选项文本取 `payload.options`（缺格不渲染该格） | `{answers:{picks:[…]}}`；**未选任何项 ⇒ 零请求**＋提示 `campaign.quiz.pickAtLeastOne` | **只认服务端**：`quiz_correct` ⇒ 「答对了 / 答错了」（`campaign.quiz.right` / `wrong`）；`reward_paid > 0` ⇒ 奖金行（`campaign.prediction.payout`）。奖励预告行 = `campaign.quiz.reward`（`答对奖励 ${{amount}}`，amount 取 `subtask.reward_amount` 字符串直出） |

- **不得本地推算答案（硬口径）**：公开读口**不吐 `correct`**（`data §40.14.10 CP-Q4`）⇒ 前端**无答案可算**；任何「按选项文本 / 顺序 / 提交回执」推断对错的实现 ⇒ 判负 #88。判分唯一真源 = 服务端 `quiz_correct` / `reward_paid`（提交响应），与 prediction 的 `payout` 同律（承 §26.19.5「客户端只读、永不本地算」）。
- **无服务端判定 ⇒ 不渲染结果块**：本机回执（`proof-store`）只存 `picks`，**不含** `quiz_correct` ⇒ 刷新后若读口未带判定，结果块**整块不出现**（禁拿「我曾答过」冒充「答对了」）。已答态另由 `campaign.submitted` ＋ 已选区呈现。
- **禁止泄漏答案的承载面**：`correct` 不得出现在 DOM 文本 / `data-*` 属性 / `title` / 隐藏节点 / 前端常量 / 预取请求里（判负 #89）。
- **金额一律直出**：`reward_paid` / `payout` / `reward_amount` 都是**字符串直出**，不做乘法、不做分摊、不做四舍五入（判负 #91）。

**C. i18n（本笔 +12 键 · 四语对称）**

| 键 | zh | 用途 |
|---|---|---|
| `campaign.predictionYes` / `campaign.predictionNo` | Yes / No | prediction 选项标签（**发布芯片与参与按钮共用**） |
| `campaign.quiz.picks` | 选出正确答案（可多选） | 参与面多选区标签 |
| `campaign.quiz.pickAtLeastOne` | 请至少选一个答案 | 空选零请求提示 |
| `campaign.quiz.right` / `campaign.quiz.wrong` | 答对了 / 答错了 | 服务端判分结果 |
| `campaign.quiz.reward` | 答对奖励 ${{amount}} | 奖励预告行 |
| `project.fQuizOptions` / `project.fQuizOption` | 选项 a–d（全填） / 选项 {{key}} | 发布表单四格 |
| `project.fQuizCorrect` | 正确项（1–4 个，可多选） | 正确项多选标签 |
| `project.fQuizReward` | 答对奖励（$，必填） | 奖励输入 |
| `project.quizInvalid` | 答题需填满四个选项并至少选 1 个正确项 | 零请求校验文案 |

- **计数现取**：flat **1369** / nodes **5476** / top **135**（四语逐字相等；`vn` 译文**待复核**，回填以 Kevin 确认为准）。旧基线（§26.19.2 / §26.20.2 记的 top 131 / flat 1140 / nodes 4560）为多件购买时期读数，**已失效**，本行为现行值。
- **键复用**：`campaign.predictionYes/No` 同时服务发布芯片与参与按钮（一处文案、两处消费）⇒ 禁新增 `project.fOptionA/B` 一类键（旧键已转死，禁止复活）。

**D. 判负（#87–#91 · 承 #51–#86 家族只增不改）**

1. **#87 选项回潮**：prediction 发布表单再出现可编辑选项输入框（`optionA`/`optionB` 一类），或参与面渲染第三枚选项；或旧四键行被强制改写成新两键（改口径）⇒ 判负。
2. **#88 本地判分 / 本地推算答案**：前端自行比对 `correct`、按选项文本或顺序推断对错、或把本机回执当服务端判定 ⇒ 判负（负控臂：公开 payload 内 `correct` 零命中、结果块只在 `quiz_correct` 在场时出现）。
3. **#89 正确答案泄漏**：`correct` 出现在 DOM（文本 / `data-*` / `title` / 隐藏节点）、前端常量、或 map 文件里 ⇒ 判负。
4. **#90 奖励/选项形态失格**：quiz 奖励缺失或「可空 / 非 `$` / 带币种选择位 / 写进 payload」；正确项允许 0 个或 5 个；四选项未填满仍可提交（本地未拦）⇒ 判负。
5. **#91 金额本地推算**：`reward_paid` / `payout` / `reward_amount` 由前端按公式计算或换算（含「奖池 ÷ 人数」类自算）⇒ 判负。

**E. 落点与未测（明账）**

- **落点**：`campaign.css` ＋43 行 / `project.css` ＋32 行（页面级文件）；`data-sf-m` 探针钩子：`campaign-quiz-panel` / `campaign-quiz-option` / `campaign-quiz-reward` / `campaign-quiz-result` / `campaign-quiz-submit` / `project-prediction-choices` / `project-quiz-fields` / `project-quiz-correct`。
- **门套现取（作者自报，转引）**：`build` 0 · `test:unit` **76 文件 / 808 例** · 24 处 i18n 计数断言前推；**判负 #87–#91 一条未跑**（无独立探针）。
- **未测**：两档（H5 ≤767 / Web ≥768）真机几何未量；`vn` 译文待复核；quiz 结果块在「读口未带判定」时的空态无截图；`aria-pressed` 的无障碍实测未做。本笔只写 `docs/**`，零代码改动。

**F. 变更注记（2026-10-22 · 值勘误 · 键集零变化）**

- **缘由**：Kevin 裁定 prediction 选项**展示**统一 `Yes / No`（不分语种）。C 段该行值原写「是 / 否」= 落册时点（2026-10-22 前）的 zh 字面留痕，**已漂移**，本行改为 **`Yes / No`**（旧字面在本条留痕，表格行不再保留）。
- **代码侧同期落地**（`35bc4ea`）：zh / hk 由「是 / 否」改 **Yes / No**、vn 由「Có / Không」改 **Yes / No**、en 原即 Yes / No 未动；**只改值、键集零变化**（无新增 / 无删除键 ⇒ i18n 计数不变），单元断言取 locale 值而非字面量 ⇒ 测试零改动。
- **payload 与投票语义零变化**：新行仍只收 `{choice:'yes'|'no'}`；旧存量行（`option_style='ab_legacy'`，payload 带 `option_a` / `option_b`）**仍按 a / b 投票**、参与面副行只读显示原文案照旧（承本条上文与 data §40.14.10）——本勘误**只动展示文案，不动取值域、不动口径判别**。

## §26.20 【招工】→【任务】文案变更登记 ＋ 项目（打工/工资体系）页面骨架预留：`/project` ＋ `/project/create` ＋ `/project/:ref` ＋ `/project/mine`（H5/Web 两形态 · **零实现、零 token、零 i18n 键落地**）（2026-10-20 · **加性续登、不升版**（承 §26.12–§26.19 体例）· 纯追加）

> **依据**：Kevin 2026-10-20 四点 clarify 之③「原 H5【招工】入口文案改为【任务】」＋ 打工/工资体系四点定案（①②④ 落 data §40.15 / route §49.19）。**本节 = 文案变更登记 ＋ 骨架预留 ＋ 判负**（页面路由建议形、区块语义、判负），**一行前端代码未写**（实现归并行前端单）。**连带** = `data-layer.spec` §40.15（四表）· `route-layer.spec` §49.19（七口 · 页面路由不计注册点）· `master-plan` §5.447 ＋ 版本行 v0.364 · `ops/project/SPEC-NOTE.md`。

#### 26.20.1 文案变更登记：【招工】→【任务】（**只改值、不改键、不溢出**）

- **现取（2026-10-20 · 四语 locales 逐值）**：入口/标题键 **`jobs.line`** = zh「招工线」/ en「Jobs」/ hk「招工線」/ vn「Tuyển việc」；消费点现取 = `frontend/src/pages/jobs/PublishJobPage.jsx:192`（h2 `{t('jobs.line')}`）＋ `frontend/src/pages/TaskPage.jsx:230`（招工线入口条）——即 H5 任务页（`/task`，TaskPage）与其发布页标题所用的【招工】文案面。
- **变更 = `jobs.line` 值改「任务」系**：zh = **「任务」**（Kevin 逐字）；en / hk / vn 派单未给 ⇒ 建议 **Tasks / 任務 / Nhiệm vụ**（回填以 Kevin 确认为准，禁实现单自造后冒充定稿）。**键名 `jobs.line` 不改**（只改值 ⇒ 四语键集零漂移：top **131** / flat **1140** 计数不变，现取复算四语逐字相等）。
- **范围 = 只改入口/标题文案**：`jobs.*` 其余「招工」字样（发布招工 / 招工详情 / 招工标题…）与 `adminNav.arbitrationReview`（招工仲裁）等**旧 job 悬赏域文案本单一律不动**（派单只点名「入口」；旧悬赏域零触碰承 data §40.15.5）。**新项目域（project）文案用新键族 `project.*`**，禁复用 `jobs.*`（两域并存，防「项目 = 招工改版」误读）。

#### 26.20.2 项目页面骨架（建议形，实现单可调）

- **页面路由四条**：`/project`（列表）、`/project/create`（创建）、`/project/:ref`（详情）、`/project/mine`（我的打工：在职项目 ＋ 领工资入口 ＋ 窗口累积读数）。
- **H5 ≤767 列表**：单列卡片流；项目卡 = ①标题 ②状态徽标（`recruiting` 招募中 / `working` 进行中 / `ended` 已结束，**三态可区分**）③名额行（在职数/`headcount`）④工资行（batt 一笔必有 ＋ 平台币一笔可选，两币别视觉可区分）⑤间隔行「每 N 小时可领」⑥准入提示（注册 ≥ N 天）。**禁 >1 列**；Web ≥768 ≥2 列网格（承 §26.19 体例）。
- **详情页 = 项目头 ＋ 打工面板**：项目头（标题/描述/owner/状态/名额/工资/间隔/条件）；打工面板按身份切换——**未在职**：申请按钮 ＋ 准入条件明示（不满足时按钮禁点 ＋ 原因）；**在职**：领工资按钮 ＋ 下一窗口倒计时 ＋ 本窗口活跃/离线小时读数；**间隔未到 = 按钮可见禁点 ＋ 原因文案**（禁隐藏、禁静默吞点击）。
- **创建页 = 八字段表单**（承 route R3 闭集）：`interval` 前端拦 1–100、`headcount` ≥ 1、天数 ≥ 0、两币字段**同现同缺联动**（填了币别必填金额，反之亦然）；**建费明示** = 费额读 `project_create_fee` 配置渲染（**禁写死 10000**——管理员改值后前端须随之）；余额不足走 409 reason 文案。
- **时间/间隔禁 ISO 直出**：间隔渲染「每 N 小时」（N = 数值人性化），时间戳格式化走 i18n（承 §26.19 体例）。
- **组件隔离**：项目卡独立组件，**禁复用 `sf-item*` 商品卡类名/组件**；shell 红线不动：不新增 `data-sf-region`、`shell.css` 一字节不动、**零新 token**（新色先落页面局部常量，承 §26.18.7 体例）。
- **i18n（零键落地 · 建议键清单）**：建议键族 `project.*`（`listTitle` / `createTitle` / `mineTitle` / `statusRecruiting` / `statusWorking` / `statusEnded` / `wageBatt` / `wageCurrency` / `intervalPer` / `claimAt` / `applyCta` / `claimCta` / `leaveCta` / `feeNotice` 等）⇒ **本笔零键落地**，计数 **`NOT_MEASURED`**（基线 top 131 / flat 1140，现取复算；落地后现取回填）。

#### 26.20.3 判负（**#77–#83** · 承 #70–#76 家族只增不改）

1. **#77 入口文案回潮**：`/task` 页标题/入口条仍渲染「招工线」系（漏改值或改错键）⇒ 判负（负控臂 = 该面渲染「任务」）。
2. **#78 文案外溢**：`jobs.*` 其余键值或 `adminNav.*` 被连带改动（超出本单范围）、或四语键集计数漂移（top ≠ 131 / flat ≠ 1140）⇒ 判负。
3. **#79 间隔/时间 ISO 直出**：`wage_interval_hours` 或时间戳原串直出 ⇒ 判负。
4. **#80 领工资静默**：间隔未到时按钮隐藏或点击无反馈 ⇒ 判负（必须可见禁点 ＋ 原因）。
5. **#81 建费写死**：创建页费额硬编码 10000 而不读配置 ⇒ 判负。
6. **#82 组件混用**：项目卡复用商品卡类名（`sf-item*` 等）⇒ 判负。
7. **#83 破坏 shell 红线**：新增 `data-sf-region` / 改 `shell.css` / 新 token 进主题层 ⇒ 判负。

#### 26.20.4 落点约束与未做（本笔零代码 · 明账）

- **落点**：新页面 CSS 落页面级文件（`pages/project/…` 建议形）；**零 `TOKEN_KEYS` 变更**（免四处 PROV，承 §26.18.7）。
- **未实现/未测**：四条页面路由、两形态骨架、`jobs.line` 值变更、i18n 键 —— **一行代码未写**；判负 #77–#83 一条未跑；零截图、零 HTTP 实测、零库写。本笔只写 `docs/**` ＋ `ops/project/**`，**不 push**；`git diff --numstat` **删除列 = 0**。

## §27 ★★ v1.26 · **移动底栏恒 4 格（取消【卖闲置】）** · **桌面右侧悬浮菜单保留【卖闲置】** · **STRUCT token `--sf-st-tabbar-cols` `5 → 4`（新 PROV 指向 `style-preview.html` L1192）** —— 规则 **`T123`** + 教训 **`N54`**（**本节只追加 · §1–§26 一字未动** · 依据 = **Kevin 2026-10-24 裁定** · **本笔零代码**：实现已在 HEAD `5a91d0e` 落地，本册只写 `docs/**`）

> **本节读法（状态改写式）**：`T46` / `T80` / §2 token 表 / §7 几何表 / v1.5 版本行里所有「**底栏恒 5 格**」（及 `卖闲置`→`/listing/new`）表述**自 2026-10-24 起作废**、**旧字面逐字保留**（受「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束），**紧随其后的追加行 = 现行口径**。旧行号引用在 §27.9 逐条登记。

### 27.0 裁定原话与范围（Kevin 2026-10-24 · 逐字三条）

1. **移动底栏（H5 `BottomTabBar`）取消【卖闲置】格** ⇒ **底栏恒 4 格**：`home` / `shard` / `messages` / `profile`（**左→右**）。
2. **桌面右侧悬浮菜单（`FloatingMenu`，`>767`）保留【卖闲置】** ⇒ **浮菜单仍五项**（卖闲置 / 消息 / APP / 反馈 / 客服 —— **现取 `FM_ITEMS` 实现序** = `wage`（领工资）/ `sell`（卖闲置）/ `messages`（消息）/ `app`（APP）/ `support`（客服））；**`/item/new` 路由保留、可直链**。
3. **STRUCT token `--sf-st-tabbar-cols` `5 → 4`**，**四处同动**（§27.3）。

- **范围外（本笔一字未动）**：`frontend/**`、`backend-ts/**`、`docs/seafood.master-plan.md`（§5.451 由 Kong 写）、`docs/route-layer.spec.md`（**路由未变**：`/item/new` 仍在、`/listing/new` 历史名不动）。
- **本笔性质**：规范落册 + 改前快照；**零代码、零 i18n 键增删、零服务启停**。

### 27.1 新规则 `T123`（底栏恒 4 格）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T123** | 【本册裁定 · v1.26】 **移动底栏（H5）恒 4 格**，**左→右** = `home`（`/`）· `shard`（`/exchange`）· `messages`（`/messages`）· `profile`（`/profile`）；**图标** = `Home` / `Store` / `MessageCircle` / `User`（lucide-react，仓内既有）；**格数由 STRUCT token `--sf-st-tabbar-cols` 承载 = `4`**（真源 `SP:1192`）；**取消【卖闲置】格 ≠ 下线该功能** —— `/item/new` 路由与 `sell` 文案键**均保留**，入口只在桌面浮菜单（`T124` 口径见 §27.2）；**主题切换入口仍不得占底栏格位**（`T46` 取代注逐字不变）。 | `frontend/src/shell/nav.js`（`SHELL_NAV_ITEMS` 现取 4 项）· `frontend/src/shell/BottomTabBar.jsx`（零内联 style、列数取自 token）· `frontend/src/theme/tokens.js:421` | ① **不得以「删格」代替「移入口」**：底栏格位下线时**必须**同时指认该入口的替代落点并写进 AC（本单 = 浮菜单 `sell`，已存在、一字未改）；② 改格数 ⇒ **四处同动**（§27.3），漏一处 `theme-tokens.test.js` 的 PROV 硬门必红；③ `nav.js` **不得**恢复 `sell` 项（底栏 4 格为契约），浮菜单 `FM_ITEMS.sell` **不得**删 |

### 27.2 桌面浮菜单五项（不变面 · 本单零改动）

| 序 | key | 形态 | 落点 | 文案键 | 本单 |
|---|---|---|---|---|---|
| 1 | `wage` | link | `/wage` | `wage.menuLabel` | 一字不动 |
| 2 | `sell` | link | **`/item/new`** | **`sell`** | **保留**（本次裁定的核心：底栏下线、浮菜单保留） |
| 3 | `messages` | link | `/messages` | `messages` | 一字不动 |
| 4 | `app` | modal | 弹窗模板位 | `app` | 一字不动 |
| 5 | `support` | modal | 弹窗模板位 | `support` | 一字不动 |

- **真源 = `frontend/src/shell/FloatingMenu.jsx` 的 `FM_ITEMS`**（`>767` 显示、`≤767` 隐藏，`T81`–`T83` 几何与 token 逐字不变）。
- **`sell` 文案键仍被消费** ⇒ **i18n 键不得随底栏删格一起删**（§27.5；`v15-nav-floatmenu.test.jsx:89–90` 已有四语非空断言）。
- **「反馈」项历史口径**：旧锚 `['sell','wage','messages','app','support']` 已前移，**【反馈】项连同其弹窗模板位已移除**（见该测试 `:136` 注释）；本文按**现取 `FM_ITEMS`** 记五项，不据旧清单改写。

### 27.3 STRUCT token `--sf-st-tabbar-cols` `5 → 4`：四处同动 + 新 PROV

| # | 位置 | 现值（现取） | 证据 / 判据 |
|---|---|---|---|
| 1 | **真源** `docs/design/style-preview.html` | **新真源行 = `L1192`**（`<section id="tabbar-cols-4-v20261024">` 内 `.tabbar{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,1fr);align-items:end;position:relative;z-index:4}`） | **尾部纯追加块**：注释行 `L1188` + `<section>` `L1189` + `<h3>` `L1190` + `<p>` `L1191` + `<pre>` **`L1192`** + `</section>` `L1193`；**旧 `L169` 的 `.tabbar{…repeat(5,1fr)…}` 逐字保留为历史、不作应用值**（纯追加、零改行） |
| 2 | `frontend/src/theme/tokens.js` | `'tabbar-cols': '4'`（**`:421`**） | STRUCT 段；同处留痕注释 `:419–420` 已写明「5 → 4 + 真源回读 = L1192」 |
| 3 | `frontend/src/theme/tokens.js` 的 `STRUCT_PROV` | `'tabbar-cols': { d: [1192, 'grid-template-columns:repeat(4,1fr)'], n: [1192, 'grid-template-columns:repeat(4,1fr)'] }`（**`:465`**） | **PROV 硬门** `frontend/src/test/unit/theme-tokens.test.js` **逐键回读该行号** ⇒ 新值必须能在 `L1192` 原文里命中所声明的片段（**已绿**） |
| 4 | `frontend/src/theme/theme-tokens.css` | `--sf-st-tabbar-cols: 4;`（**`:24`**） | 生成物与 `STRUCT` 同值（CSS↔JS 互校门） |

- **★ 口径（`N54`）**：**改 STRUCT token 的值时，「真源」只允许在 `style-preview.html` 尾部追加新块、不得改写旧行**；`STRUCT_PROV` 指针从旧行号（`169`）**改指新行号（`1192`）**，旧行留在文件里当历史。**旧行若被就地改值，PROV 会与新值「表面相符」但历史断链**（且 `numstat` 删除列 ≠ 0 ⇒ 违本册只追加口径）。
- **CSS 变量名换代**：本册 §2 token 表的历史行写作 `--sea-tabbar-cols`，实现侧现名 = `--sf-st-tabbar-cols`（`--sf-*` 前缀，`tokens.js` 的 STRUCT 段）；**新行以现名为准，旧行逐字保留**。

### 27.4 几何实测（现取 · 本单复核裁定读数）

| 档位 | 读数 | 判据 |
|---|---|---|
| **390**（H5） | `.sf-tabbar` `grid-template-columns` = **`97.5px × 4`**（= 390 / 4） | **四等宽**；末格（`profile`）右缘贴容器右缘；`documentElement.scrollWidth − clientWidth` = **0**（零横向溢出） |
| **1440 / 1536**（桌面） | `.sf-tabbar` `display:none`，**DOM 仍 4 个 `a[data-sf-nav]`** | 隐藏 ≠ 减格（DOM 恒在与外壳同构断言不破） |
| **1536**（浮菜单） | `sell` 项可见：`w = 72` / `h = 92` / `href = /item/new` | 浮菜单几何（`T82`）与路由可达**同时成立** |

- **触控目标**：390 档单元宽 `97.5` ≥ 44（`T77` 不破）；可见文本仍 `12px`（`T79` 不破）。
- **本册 v1.26 只登记读数**（读数由实现/质检单 `5a91d0e` 同批实测；本笔未起服务、未开户重测）。

### 27.5 i18n：零变更（本单核数）

| 项 | 现取 | 判据 |
|---|---|---|
| 顶层键（每语） | **`135`** | 四语逐文件相同（`zh` / `en` / `hk` / `vn`） |
| 拍平叶子（每语） | **`1451`** | 同上；**本单零增删** |
| 四语节点 | **`5804`**（= 1451 × 4） | 同上 |
| `sell` 键 | **保留**（四语非空） | 底栏下线**不删键**：浮菜单 `FM_ITEMS.sell` 仍消费；`v15-nav-floatmenu.test.jsx:89–90` 四语非空断言 |

- **反例（判负）**：以「底栏不再用 `sell`」为由删 `sell` 键 ⇒ 浮菜单渲染裸键名 + 四语键集断言红。

### 27.6 断言影响（改锚登记 · 实现侧已在 `5a91d0e` 落地）

| # | 文件 / 锚 | 内容 | 口径 |
|---|---|---|---|
| 1 | `frontend/src/test/unit/v15-nav-floatmenu.test.jsx:84–87` | `SHELL_NAV_ITEMS.map(i => i.key)` = 四项、且 `not.toContain('sell')` | **已按 4 格前推**（现取绿） |
| 2 | 同上 `:89–90` | `sell` 文案键四语非空 | **不得删**（§27.5） |
| 3 | 同上 `:94` | 按 `key` 取例（**禁写死索引** —— 删 `sell` 后索引由 4 漂到 3） | 已前推 |
| 4 | 同上 `:122` | 渲染态 `a[data-sf-nav]` **不含 `sell`** | 已前推 |
| 5 | 同上 `:145–147` | 浮菜单 `data-sf-fm` = `['wage','sell','messages','app','support']` | **一字未改**（本单核心取证点） |
| 6 | `theme-shell-isomorphism.test.jsx` / `fix-nav-langshell.test.jsx` | 底栏 `data-sf-nav` 面向断言 | 由 4 项派生，随 nav 真源自动跟随 |
| 7 | `frontend/src/test/unit/theme-tokens.test.js` | `STRUCT_PROV` 逐键回读 `style-preview.html` 行号 | **新指针 `1192` 已绿** |

### 27.7 验收判据（可判负）

1. **390 档**：底栏 `a[data-sf-nav]` 的 key 序 **恰 = `['home','shard','messages','profile']`**，`getComputedStyle(nav).gridTemplateColumns` 拆成 **4 段等宽**（每段 = 容器宽 / 4），`scrollWidth − clientWidth = 0`。
2. **浮菜单（≥768）**：`data-sf-fm` 五项**含 `sell`**，`sell` 的 `href` 解析后路径 = `/item/new`、`w=72 / h=92`。
3. **直链**：`/item/new` 直接访问进入发布页（不被重定向、不落提示页）。
4. **token 溯源**：`grep -n "tabbar-cols" frontend/src/theme/tokens.js` 中 `STRUCT` 值 = `'4'`，`STRUCT_PROV` 两档行号 = **`1192`**；`theme-tokens.test.js` 绿。
5. **i18n**：四语顶层 `135` / 拍平 `1451` 逐语相等；`sell` 四语非空。
6. **反向臂（判负灵敏度）**：把底栏改回 5 项（或把 token 值改回 `5`）⇒ 判据 1（与 PROV 门）**必须变红**。

### 27.8 新教训 `N54`（STRUCT token 变更的真源纪律）

- **`N54` · 改 STRUCT token 的值 = 「尾部追加新真源块 + `STRUCT_PROV` 改指新行号」，**不得就地改写旧真源行**。** 理由链：① 本册与真源都受「**只追加、`git diff --numstat` 删除列 = 0**」约束 ⇒ 就地改值必然产生删行；② `STRUCT_PROV` 是**行号 → 片段**的硬映射，旧行若被就地改值，指针仍指 `169` 也「看起来对」，**历史与现行混在一行**、事后无法区分该行是「一直是 5」还是「被改成 4」；③ 正确形态 = 旧行（`169`，`repeat(5,1fr)`）**逐字留作历史**、新块追加在文件尾（`1188–1193`）、指针指 **`1192`** ⇒ 三处读数各自可查、`numstat` 纯追加。**类级规则**：任何「值变了但文档不许改行」的场景，一律**追加 + 改指针 + 旧行标注为历史**，绝不「原地覆盖 + 声明已同步」。

### 27.9 留痕清单（旧字面逐字保留 · 已被 2026-10-24 裁定取代）

| # | 位置（改前盘面行号 · 现取为 `v1.25` 快照行号） | 旧字面（节录，**逐字保留**） | 现行口径（取代行） |
|---|---|---|---|
| 1 | `:4` 版本头 v1.5 | 「**底栏（H5）五项新集合**〔`T80`〕」 | 「底栏四项集合」→ §27.1 `T123`；**该行为历史留痕，仅追加本行指针、未改一字** |
| 2 | `:15` 版本头 v1.15 | 「就地收窄 `T46`/`T80` 的「底栏恒 5 格」，仅限 `/item/:id`」 | 该收窄仅涉详情页隐藏面，**与格数无关**；格数口径以 §27 为准 |
| 3 | `:28` 勘误行（2026-10-19） | 「现行口径 = **底栏恒 5 格、含未登录**」 | **已被 2026-10-24 裁定取代** ⇒ 底栏恒 **4 格**、含未登录（`T123`）；「含未登录」语义**不变** |
| 4 | `:335` §2 token 表 | 「`--sea-tabbar-cols` \| `5` \| `SP:169 .tabbar{…repeat(5,1fr)}`」 | 紧随其后追加行：`--sf-st-tabbar-cols` = `4`、`SP:1192` |
| 5 | `:437` §5 规则表 `T46` | 「底栏 Tab 恒为 **5 格**（`--sea-tabbar-cols`，`SP:169`）」 | 紧随其后追加行：`T46`〔2026-10-24 取代注〕**恒 4 格** |
| 6 | `:532` §7 几何表 `.tabbar` | 「`grid-template-columns:repeat(5,1fr)`；FAB `46×46`…」 | 紧随其后追加行：`repeat(4,1fr)`（恒 4 格） |
| 7 | `:821` 版本表 **v1.5** 行 | 「复**恒 5 格（`T46` 不破）**」+「`卖闲置`→`/listing/new`（sell）」 | **已被取代**：恒 4 格；`sell` **不在底栏**（路由 `/item/new` 保留、入口在浮菜单）；**本行只对该 v1.5 行加指针、旧字一字未改** |
| 8 | `:1066` §14.1 `T80` 行 | 「**底栏（H5）恒 5 格**…五项 key 清单…五项图标清单」 | 紧随其后追加行：`T80`〔2026-10-24 取代注〕**恒 4 格** + 四项 key/图标清单 |

- **未改写旧字的自证**：本单 `git diff --numstat` 的**删除列 = 0**（§27 全部为追加行；六处就地「改」均以**紧随其后的追加行**实现）。
- **未列入改写面**：`docs/route-layer.spec.md`（路由未变，`/item/new` 一直在）· `docs/seafood.master-plan.md`（Kong 已写 §5.451）· i18n 四语 JSON（零键变更）。

### 27.10 未核实 / 未测（诚实清单）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 真机（iOS Safari / Android Chrome）底栏 4 格渲染 | **`NOT_MEASURED`（本笔）** | 本笔只登记 `5a91d0e` 同批实测的 390 视口读数；真机由 Kevin / Kong 用 5800 局域网入口核 |
| 2 | 320 / 375 档四等宽与末格贴右 | **`NOT_MEASURED`（本笔）** | 结构上等比（`1fr × 4`），但本笔未逐档实测 |
| 3 | `≤767` 浮菜单隐藏面的连带影响 | 现取 = 无 | 浮菜单仍按 767 断点隐藏（`T81` 不变），本单未动其可见性 |
| 4 | 底栏「无【卖闲置】」对移动端发布路径的可达性 | **已给替代落点** | 移动端发布入口 = 浮菜单在 `≤767` **隐藏** ⇒ **移动档发布入口需另核**：现取 `Header` 移动面板 / 首页是否有发布入口**本笔未逐条核实**（**列为待查**，若确无则应另立单，不在本册自选方案） |

---

## §28 ★★ v1.27 · **首页「视觉无标题 + 保留 1×1 视觉隐藏 `h1`」**：标题职责交 `<title>`、heading 层级不承担视觉标题 —— 规则 **`T125`** + 教训 **`N55`**（**本节只追加 · §1–§27 一字未动** · 依据 = **Kevin 2026-10-24 裁定**（§28.2）+ **闲鱼 `www.goofish.com` 真浏览器实测**（§28.1）· **本笔零代码**：实现「首页隐藏 `h1`」已在 HEAD `4169140` 落地）

> **本节读法（状态改写式）**：本节**不改写任何旧行**；若旧条文与本节冲突，**以本节为准**，旧字面**逐字保留**（受「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束）。

### 28.0 依据与取证方法（2026-10-24）

- **取证对象** = `https://www.goofish.com/`（首页）与 `https://www.goofish.com/item?id=765416638957`（商品详情页）。
- **取证方法（可复跑）** = **真浏览器**（非 `curl`、非文本抓取）打开页面 ⇒ 读 `document.title` / `document.querySelectorAll('h1').length` / `document.querySelectorAll('h1,h2,h3,h4,h5,h6').length` / 地标（`header` / `main` / `nav`）/ `document.querySelectorAll('*').length` / 正文长度（`document.body.innerText` 去空白后字数）。
- **反爬干扰与排除（必须披露）** = 首轮以**默认自动化 UA** 访问**被闲鱼反爬拦截**；换**正常浏览器 UA** 后取到**真 DOM**。**判据** = 正文 `2581` 字 + 元素 `2648` + `document.title` 为业务标题（口号／商品名）⇒ **非拦截页**。**本节全部读数来自换 UA 后的真 DOM。**

### 28.1 实测读数（真 DOM · 2026-10-24）

| 页面 | `document.title` | `h1` 计数 | `h1`–`h6` 总数 | 地标 | 元素数 | 正文长度 |
|---|---|---|---|---|---|---|
| 首页 `/` | 「🐴 闲鱼 - 闲不住？上闲鱼！」 | **0** | **0** | `header` + **`main` × 2**（**无 `nav`**） | **2648** | **2581** 字 |
| 商品详情 `/item?id=765416638957` | 「zara 2020Collection系列 尺码S_闲鱼」 | **0** | **0** | 未逐项取（本节只取 heading 面） | — | — |

- **两条硬读数** = ① **`h1` = 0**；② **`h1`–`h6` 全 = 0**（不是「缺 `h1`」，而是**整套 heading 层级不用**）。
- **旁证（语义欠债的信号）** = 首页**两个 `main`**（一页应只有一个 `main`）+ **无 `nav`** ⇒ 地标语义同样未按 Web 规范使用。
- **结论** = 闲鱼是「**Web 视为 APP 渲染容器**」的典型 —— **标题职责全由 `<title>` 承担**、heading 层级整体不用，属**移动优先的语义欠债**，**不是**「逐意设计的无标题方案」（即不是设计者判定「无标题更优」，而是把 Web 当壳、正文由 APP 组件拼装的**副产品**）。

### 28.2 裁定原话（Kevin 2026-10-24 · 逐字）

> 「**本站首页取闲鱼的视觉、不取它的语义欠债**」

拆成可执行三条（**写死**）：

1. **视觉上无页面标题**（与闲鱼一致）—— 用户看到的首页**不得有「页面标题」这一行**。
2. **保留 `1×1` 视觉隐藏 `h1`**（`HomePage.jsx` **容器首子**，文案**复用** `t('siteBrand')`，class `.sf-visually-hidden`；工具类落 `frontend/src/styles.css` **顶层**）作为**读屏锚点**。
3. **不得**把【热门任务】`h2` 改 `h1`（会撞**钩子与探针依赖**，见 §28.6 #4）。

### 28.3 为什么闲鱼这么设计（三条理由）

| # | 理由 | 机制 |
|---|---|---|
| 1 | **APP 镜像** | 闲鱼是**移动 APP 优先**的产品，Web/H5 是 APP 界面的**同构镜像**（同一套「信息流卡片 + 图标底栏」心智）。APP 里**没有「页面标题」**这个概念（顶栏是导航／搜索，不是标题）⇒ 镜像到 Web 也就没有标题。 |
| 2 | **洪布流首页无主题可做标题** | 首页是**洪布流（feeds）** = N 张彼此无主题关联的商品卡。给洪布流起一个「页面标题」在**信息架构上无意义**（用户不是来「找一个页面」，是来刷的）。真正有标题的是**内容页**（商品详情），而详情页的标题就是**商品名**，属于卡片内容本身。 |
| 3 | **`<title>` 接管了标题职责** | 浏览器标签／历史记录／分享卡片需要的那一份标题，`<title>` 已经给了（首页 = 品牌口号、详情 = 商品名）。在**只有一份标题预算**的产品里，把它花在 `document.title` 上、不在 DOM 里重复第二次，是**功能上自洽**的选择。 |

- **★ 注意**：三条理由解释的是「**为什么它这样**」，**不构成**「我们也该这样」的论证 —— 我们要的是**视觉结果**（无标题），不是**语义后果**（heading 层级归零）。这条分界线即 §28.2 裁定的实质。

### 28.4 与本站实现的差异（现取 HEAD `4169140`）

| 面 | 闲鱼（实测 §28.1） | 本站（现取） | 差异性质 |
|---|---|---|---|
| 视觉标题 | 无 | **无**（首页无可见 `h1`） | **取齐**（裁定①） |
| `h1` | **0** | **恰 1**（视觉隐藏 `1×1`） | **有意不同**（裁定②：补读屏锚点） |
| `h1`–`h6` | **0** | `h1` × 1 + `h2` × 2（【热门任务】/【精选奖励】）+ 其余 | **有意不同**（裁定③：`h2` 不动） |
| 地标 | `header` + `main` × 2，**无 `nav`** | `header` + `main` + **`nav`**（底栏；桌面另有两套导航） | **有意不同**（不以欠债对齐） |
| 标题职责 | 仅 `<title>` | `<title>` **+** 视觉隐藏 `h1` | **有意不同**（多给读屏一份） |

**实现落点（现取 · 本笔只登记，亦未改一字）**：

| # | 位置 | 现值 | 说明 |
|---|---|---|---|
| 1 | `frontend/src/pages/HomePage.jsx:458` | `<h1 className="sf-visually-hidden">{t('siteBrand')}</h1>` | **容器首子**（`:454–458` 注释写明口径） |
| 2 | `frontend/src/styles.css:1438` | `.sf-visually-hidden { … }` | **顶层工具类**（不入 `@layer`、不入 `@media`、**不加主题 token / CSS 变量**） |
| 3 | `frontend/src/locales/zh.json:3` | `"siteBrand": "Seafood 海鲜市场"` | **复用现役键** ⇒ **零新增 i18n 键** |
| 4 | `frontend/src/pages/HomePage.jsx:484` / `:516` | `<h2 …>{t('homePage.hotTasks')}</h2>` / `{t('homePage.featuredRewards')}` | **本裁定明令不动** |

### 28.5 新规则 `T125`（首页视觉无标题 + 视觉隐藏 `h1`）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T125** | 【本册裁定 · v1.27】 **首页（`/` 及四语前缀 `/en` `/hk` `/vn`）视觉上不得有页面标题**（不得渲染可见 `h1`/`h2` 充作「页面标题」）；**必须**渲染**恰 1 个**视觉隐藏 `h1`** 作为读屏锚点，形态写死 = **`1×1` 裁剪、不可见但保留在可访问性树内**（`.sf-visually-hidden`）；**文案复用现役键 `t('siteBrand')`**（**零新 i18n 键**）；该 `h1` 必须是**页面容器首子**（大纲起点先于内容）；**不得**把既有【热门任务】`h2`（`homePage.hotTasks`）或【精选奖励】`h2`（`homePage.featuredRewards`）改为 `h1`。**依据** = Kevin 2026-10-24 裁定（§28.2）+ 闲鱼实测（§28.1）：「取视觉、不取语义欠债」。 | `frontend/src/pages/HomePage.jsx:458`（首子 `h1`）· `frontend/src/styles.css:1438`（`.sf-visually-hidden` **顶层**）· `frontend/src/locales/*.json`（`siteBrand`，**不新增键**） | ① 隐藏标题**不得**用 `display:none` / `visibility:hidden` / `aria-hidden`（都会把节点移出可访问性树 ⇒ 读屏锚点失效）；② **不得**内联 `style` 写隐藏样式（绕开工具类、留死样式）；③ 文案**不得**新造 i18n 键（四语键集计数须不变）；④ **不得**用「视觉隐藏 `h2` 当前置」替代（与 `h1` 大纲起点冲突）；⑤ 其它页面（`/item` / `/task` / `/exchange` …）标题口径**不在本条**、逐字照旧 |

### 28.6 断言影响（现取 · 本单零改锚）

| # | 文件 / 锚 | 现取断言 | 口径 |
|---|---|---|---|
| 1 | `frontend/src/test/unit/home-page.test.jsx:331–336` | 首页**恰 1 个 `h1`**、其 `className` 含 `sf-visually-hidden` | **已按裁定前推**（现取绿）；与 `T125` 同形 |
| 2 | 同上 `:318` | 首子定位取 `:scope > :not(.sf-visually-hidden)`（探针**跳过**隐藏 `h1`） | 隐藏 `h1` 为容器首子 ⇒ 该 `:not()` **不得删** |
| 3 | `frontend/src/test/unit/i18n-batch-b1.test.jsx:66–70` | 隐藏标题恰 1、class 含 `sf-visually-hidden`、文案 = `siteBrand` | 同上 |
| 4 | 【热门任务】`h2` 与其区块钩子 | `homePage.hotTasks` 的 `h2` 被探针锚定 | **改 `h1` 必连带红** ⇒ 这是裁定③「不得改」的技术理由 |

### 28.7 验收判据（可判负 · 6 条）

1. **可见面**：首页（`390` / `1440` / `1536` 三档）**任何可见文本都不构成页面标题** —— 判据 = `h1` 的 `getBoundingClientRect()` **宽高 ≤ 1×1**。
2. **语义面**：`document.querySelectorAll('h1').length === 1`，且 `textContent.trim()` = 当语 `siteBrand` 值（**四语各测一次**）。
3. **可访问性面**：该 `h1` **在**可访问性树内（无 `aria-hidden`、`display` 非 `none`）；**反向臂** = 临时加 `aria-hidden="true"` ⇒ 本条**必须变红**。
4. **层级面**：`h2` 计数仍 **2**（【热门任务】/【精选奖励】），无其它标题被提升。
5. **i18n 面**：四语键集计数**逐字不变**（本裁定**零新增键**）。
6. **反向臂（灵敏度）**：删掉隐藏 `h1` ⇒ 判据 2 **必须变红**（对应「首页零 `h1`」的历史缺陷）。

### 28.8 新教训 `N55`（「取视觉、不取欠债」的拆解纪律）

- **`N55` · 参考站的行为必须拆成「视觉结果」与「语义实现」两层分别裁定**，不得整包照抄、也不得整包否决。
- **理由链**：① 参考站（尤其**移动优先的超级 APP**）在 Web 上常有**系统性语义欠债**（`h1` = 0、多 `main`、无 `nav`）—— 那是**工程副产品**、不是设计资产；② 照抄**视觉** = 拿到用户要的观感；照抄**语义** = **把别人的债记到自己账上**（读屏、大纲、SEO 全受影响，且事后极难改：一改就撞既有 `h2` / 钩子 / 探针）；③ 正确形态 = **视觉面对齐参考站 + 语义面按 Web 规范补齐 + 用最小侵入的载体补**（本例 = `1×1` 视觉隐藏 `h1` + 复用现役文案键 ⇒ **视觉零变化 + i18n 零新增 + 断言零改锚**）。
- **类级规则**：任何「参考站这么做、我们也这么做」的裁定，落册时**必须写清取哪一层、不取哪一层、不取的那层由什么补上** —— 只写「照参考站」会留下**无法判负的空口径**。

### 28.9 未测 / 诚实边界

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 真机读屏（iOS VoiceOver / Android TalkBack）朗读隐藏 `h1` | **`NOT_MEASURED`（本笔）** | 只按可访问性树规则判定（§28.7 判据 3）；**未**在真机读屏器上实听 |
| 2 | 闲鱼其它页面（搜索 / 分类 / 卖家页）heading 面 | **未取** | 本笔只取**首页 + 一个商品详情**；「全站 heading 归零」是**两页读数 + 旁证**的推断，**不是全站普查** |
| 3 | 闲鱼详情页地标 / 元素数 / 正文长度 | **未取** | 详情页只取 `document.title` 与 heading 计数 |
| 4 | 四语档隐藏标题的渲染差异 | **`NOT_MEASURED`** | 四语均 LTR；`1×1` 裁剪与语言无关，但未逐语实测 |

### 28.10 留痕与自证

- **本节零删行**：`git diff --numstat docs/design/design-system.spec.md` 的**删除列 = 0**（本节 = **尾追加** + 版本头追加 1 行 + §12 表追加 1 行）。
- **未改写面**：`§1–§27` 一字未动；`frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `docs/design/style-preview.html`（**真源零改动**：本裁定**无新 token、无新 `STRUCT`、无新 PROV**）；i18n 四语 JSON（**零键变更**）。
- **编号现取**：节号 **`§28`**（现盘最大 `§27`）；规则 **`T125`**（现盘最大**已定义** `T123`；`T124` 仅作为 §27.1 `T123` 单元格内的**前向引用**出现、**无条文行** ⇒ 为不与既有引用撞号，顺延取 `T125`）；教训 **`N55`**（现盘最大 `N54`）。
- **快照**：`docs/versions/design-system.spec.v1.26.md`（改前 `cmp` = **0**；md5 `f410b532d6ed86b8c17f6c48079ccb1b`；`4565` 行 / `945,158` B）；**本版镜像** = `docs/versions/design-system.spec.v1.27.md`（落笔后建，`cmp=0`）。

---

---

## §29 ★★ v1.28 · **资金余额变动类操作：成功反馈统一用 Toast**（仅【领工资】＋【任务/子任务/活动一键领奖】）—— 规则 **`T126`**

> **本节读法（状态改写式）**：本节**不改写任何旧行**；与旧条文（三弹窗模板位 / 前端「结果一律内联」类表述）冲突处**以本节为准**，旧字面**逐字保留**（受「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束）。依据 = **Kevin 2026-10-24 裁定**。

### 29.0 裁定口径（Kevin 2026-10-24，逐条转写）

| # | 项 | 口径 |
|---|---|---|
| 1 | 适用族 | **资金余额变动类操作** |
| 2 | 适用清单（**仅两类**） | 【**领工资**】·【**任务 / 子任务 / 活动一键领奖**】 |
| 3 | 成功反馈形态 | **Toast**（顶部轻提示）：**一句话**说清到账金额 / 次币；**不得**再弹模态框；**不得**在卡内 / 行内再写成功文案（成功只剩这一个出口） |
| 4 | 不在范围（**仍内联**） | **充值** · **购买** · **订单退款 · 发货 · 收货** —— 形态逐字照旧，不因本条改 |
| 5 | 失败 | **一律仍内联**（含 `batt_insufficient` / `nothing_to_claim` / 其他错误；登录提示与「加入成功」提示同属内联侧，不改 Toast） |

### 29.1 新规则 `T126`

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T126** | 【本册裁定 · v1.28】 **资金余额变动类操作的成功反馈统一用 `Toast`（顶部轻提示），范围严格限于【领工资】与【任务 / 子任务 / 活动一键领奖】两类**；成功文案**只经 Toast 一条出口**，成功时**不得**弹模态框、**不得**在卡内或行内再渲染成功节点；**充值 / 购买 / 订单退款 / 发货 / 收货不在本条内、仍用内联**；**失败一律仍内联**（不得改 Toast），失败文案须**说清原因**、不得白屏；Toast 时长取 **5000ms**（文案较长，默认 4s 偏短）。**依据** = Kevin 2026-10-24 裁定。 | `frontend/src/pages/wage/WagePage.jsx`（领工资成功 ⇒ `toast.success`，`WageClaimModal.jsx` 已删）· `frontend/src/pages/campaign/ClaimButton.jsx`（单笔 / 一键全领成功 ⇒ `toast.success`，失败仍内联三支）· `frontend/src/main.jsx`（`<Toaster/>` 顶层挂载，跨路由/卸载存活） | ① 不得为「统一」把失败或其它操作族（充值/购买/订单）一并改 Toast —— **失败仍内联**是硬判据；② 不得新造 i18n 键（成功文案复用 `campaign.claim.ok` / `campaign.claim.allOk` 等现役键）；③ 不得新增 toast 主题 token / CSS 变量（沿用既有 `react-hot-toast` 样式与主题壳）；④ 成功侧**不得**保留「内联成功文案 + Toast」双出口；⑤ 本条**不覆盖**「加入成功」「登录提示」等非资金变动提示（仍内联） |

### 29.2 落点与读数（现取 · 本单零代码）

- **`WagePage.jsx`**：成功 ⇒ `toast.success([主文案, 连续奖励句].filter(Boolean).join(' '), { duration: 5000 })`（**一条** toast）；`claimModal` state 与渲染块撤除 ⇒ `WageClaimModal.jsx` **整件删除**（108 行）；卡内零成功文案。
- **`ClaimButton.jsx`**：成功 ⇒ `toast.success(t('campaign.claim.ok' | 'campaign.claim.allOk'), { duration: 5000 })`；**删成功后 900ms 延时**（Toast 不随卸载消失 ⇒ `onClaimed` 立即重拉）；失败内联三支原样。
- **探针读数（本笔现取 · 采信）**：`ops/wage/front/probe-wage.mjs` **exit 0 · 146 判据全 true · `failed = []`**，其中 `claimOk.toastHasBatt` / `countdown.claimOkWithBothCurrencies` / `claimOk.claimModalGone` / `claimFail.noticeErr` 均 true。单测门读数（上一轮实跑）**96 files / 1053 tests / 0 failed** · a11y **16** · components **14** · build **exit 0**（`index--OyWFWGv.js` 667,296 B / `index-DiYi9BAn.css` 188,986 B），四语 flat **1451 × 4**（零增删）。

### 29.3 边界与编号现取

- **本节零删行**：`git diff --numstat docs/design/design-system.spec.md` 删除列 = **0**（本版 = **尾追加** + 版本头追加 1 行）。
- **未改写面**：`§1–§28` 一字未动；`frontend/**` / `backend-ts/**` 本单**零改动**（实现已在上游 commit `77da63c`）；`docs/design/style-preview.html`（真源）**零改动**（无新 token / `STRUCT` / `PROV`）；i18n 四语 JSON **零键变更**（1451 × 4）。
- **编号现取**：节号 **`§29`**（现盘最大 `§28`）；规则 **`T126`**（现盘最大**已定义** `T125`；`T124` 仅作前向引用、无条文行）；教训**不新增**（本单无新教训）；版本行 **`v1.28`**（现盘最大 `v1.27`）。
