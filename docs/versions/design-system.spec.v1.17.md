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
> **★ v1.10 姊妹册（同批交付）** = `docs/route-layer.spec.md` **v2.28 §38**（`/item` 家族 + 旧路由硬删 + 「前端概念名 ⇄ 后端路径名」映射表）；本册只承载 **形态 / 入口集合 / 可达性 AC / 合并页口径 / i18n 删改留表 / 断言影响**，**不重抄**。
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

### 20.3 `T100` 展开 · 聊一聊三态判据表

| 态 | 判定 | 行为 | 数据依赖 |
|---|---|---|---|
| 登录 · 他人商品 | `user && user.uid !== seller.uid` | 渲染第 3 格；点击 ⇒ `POST conversations` ⇒ `Navigate` 到会话详情（`/messages?c=<conversation_id>` 形态由实现定，**路由路径不变**） | `F19 seller.uid` + route #1 |
| 登录 · 卖家本人 | `user.uid === seller.uid` | **不渲染**（服务端 #1 仍有 `MSG_SELF_CONVERSATION` 双闸） | `F19 seller.uid` |
| 未登录 | `!user` | **不渲染第 3 格**（与既有登录可见性规则同构）；不存在「点了才登录」的中间态（保持操作栏 N 格语义纯净） | 既有 auth 状态 |

### 20.4 `T101` 展开 · 钩子与结构（实现面锚点 · 归 AC-2 用）

- 页面容器保留 `data-sf-m="messages-page"`；新增：`messages-list` / `messages-conversation-item` / `messages-conversation-unread`（行内角标）/ `messages-thread` / `messages-msg-item` / `messages-msg-mine` / `messages-msg-theirs` / `messages-input` / `messages-send-btn` / `messages-back` / `messages-load-more`。
- 输入区 `≤767` 高度含 `env(safe-area-inset-bottom)` 复刻口径（`T75` 体例）；页面样式落 `messages.css` 页面局部 `--sf-l-*`（**零新主题 token**、零 `STRUCT` 增项、`shell.css` 一字不动）。
- 429 语义直出：`MSG_RATE_LIMITED` ⇒ 文案键 `messagesPage.rateLimited`（`details.reason` 不进用户面）；发送失败通用态 = `sendFailed`；加载失败 = `loadFailed`。
- **术语**：本页属「站内信」；页面标题键 `messagesPage.title`（「消息」）不动（底栏同键，`T80` 第 4 格文案不变）。

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
| `telegram.desc` | 绑定后，收到新消息会通过 Telegram bot 提醒你（不包含消息内容） | Get Telegram bot reminders for new messages (content not included) / 綁定後，收到新消息會通過 Telegram bot 提醒你（不包含消息內容）/ Nhận thông báo qua Telegram bot khi có tin nhắn mới (không kèm nội dung) |
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

**计数算式（写死 · 可复核）**：顶层 `122 + 1`（新顶层命名空间 `telegram`）= **123**；拍平 `1045 − 2`（删 `xPlaceholder`/`xNote`）`+ 23`（UI 键：`item.chat` 1 + `messagesPage` 11 + `telegram` 11）`+ 12`（`msg.err.*` 7 + `tg.err.*` 5）= **1078**；四语节点 `1078 × 4` = **4312**。**归零自检**：新键 35 = 23 + 12；删键 2；净 +33 flat；顶层 +1 自洽（`telegram` 为新顶层）。

### 20.9 归因式 AC（**不用元素白名单** · 承 §19.8 体例）

- **AC-1（聊一聊三态）**：`/item/:id` 上，第 3 格「聊一聊」**可见性**与三态判据表（§20.3）逐一相符；反事实 = 把 `user.uid` 换成 `seller.uid`（仅测量期）⇒ 该格**必须消失**。**判负**：卖家本人可见该格 / 未登录可见该格 / 点击后无 `POST conversations` 网络痕迹。
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

### 20.12 未核实 / 登记（诚实清单 · 禁填 0/空）

- 键值四语初译**未经 Kevin 复核**（`待复核` 标注）；`v15-nav-floatmenu` 对角标子节点的元素键口径未现取（§20.7 #4）；`MessagesPage` 是否在 `i18n-content-wiring` 的 `WIRED` 清单未现取（§20.7 #6）；角标两挂点共享态的实现形态未定（只冻判据）；本册未动 `frontend/**` / `backend-ts/**`、未跑任何门、未连库。

### 20.13 快照 + 自证（本节）

- 改前：1923 行 / 422,501 B / md5 `0400a3d9bbcc38b22cae0190b658c8ee`；改后读数见本版 delta 件 `docs/audit/design-system-v1.17-delta.md`（行数/字节/md5 前后 + `git diff --numstat` 删除列 = 0 + 快照 `cmp=0` + 未改代码自证）。
