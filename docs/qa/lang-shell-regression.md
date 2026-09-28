# 语言壳重构（中文子页 P0）· 独立回归质检报告（Neng）

> **出具方**：Neng（独立质检）。**不采信实现方（Kong）自报**：本文件一切读数由本机自建探针现场落盘，逐条可核（附录 A）。
> **被检 revision**：**`dbccd89`**（`fix(router): 拆显式语言壳，修中文子页被可选语言段吞掉`）。
> **对锚**：**`073c683`**（`dbccd89` 的父提交；本单「改前」基线，于独立 worktree 中以 `http://localhost:5812` 实地起服对照）。
> **本件不改任何源码**：仅新增本报告文件 + scratch 临时探针；不 commit、不 push。
> **若下表任一文件 sha256 再变，本结论自动失效。**

## 锁定指纹（头部写死）

| 项 | 值 |
|---|---|
| 锁定被检 revision | **`dbccd8966e1a32868f550def1e17bd2a83df3289`**（`main`） |
| 开工 / 收口 `git log --oneline -1` | `dbccd89 fix(router): 拆显式语言壳，修中文子页被可选语言段吞掉`（**未变**） |
| 开工 `git status --porcelain` | `?? docs/audit/`、`?? docs/qa/45c27d8-lang-path.md`、`?? docs/qa/lang-prefix-normalize.md`（**并发他方产物，本单未读取/未修改/未删除**） |
| 收口时刻 | 2026-09-28 08:51 CST |

**7 个文件 sha256**（`git hash-object <file>` 与 `git rev-parse dbccd89:<file>` **逐一相等**，5/5 改动文件 + 2 个红线文件）

| 文件 | sha256 | blob == `dbccd89` |
|---|---|---|
| `frontend/src/App.jsx` | `b6033bf9a5f1fc5045f3980c633df335c4e62060c1ae585c16acf6963e9cd073` | **YES** |
| `frontend/src/utils.js` | `d48b70c321f3828a6cc8f992e9b96a752e385823a70c8152056dca0897857b31` | **YES** |
| `frontend/src/components/Footer.jsx` | `1ba767a696c96c4f3e7ce528ad492d724bc6d39682f0d8bf8b780d3c48e31c79` | **YES** |
| `frontend/src/test/unit/lang-path.test.js` | `eac1b8b975a4410804c6ff42c5fa4969746bef7fd9bfd3621558d92d18d7bb3d` | **YES** |
| `frontend/src/test/unit/lang-path-redirect.test.jsx` | `f9c1aa440367f982bb6efd19c592aea9b1397f48d9a006daeca026c1a49c59c4` | **YES** |
| `frontend/index.html`（红线·未动） | `c44388454902ab8f0ee99ffb74e33732d99230d128352cf5ba340d780cf5938f` | 未在改动面 |
| `frontend/src/components/Header.jsx`（未动） | `f96cab43ebeb8d2ebf38b3c6dc84a0ed7764bd07f8c14035e6ca374a750fb64c` | 未在改动面 |

**HEAD 变动情况**：开工与收口 `git log --oneline -1` 同为 `dbccd89` ⇒ **质检期间 HEAD 未变动**，无需重取对锚。

**改动面**（`git diff --name-only 073c683..dbccd89`，全仓）**恰好 5 个文件，无越界**：
`frontend/src/App.jsx`、`frontend/src/components/Footer.jsx`、`frontend/src/utils.js`、
`frontend/src/test/unit/lang-path.test.js`、`frontend/src/test/unit/lang-path-redirect.test.jsx`。

---

## 结论：**PASS（带条件）**

**P0 主判据（本单核心）通过**：中文首页真指针点「社区奖励 / 社区任务 / shard」⇒ 分别落到 `/reward`、`/task`、`/shard`，`<main>` 渲染的是各自页面，**不再是首页欢迎语**（§2.2）。14 条真浏览器路由读数（C 段 + A 段）0 违规。

**回归面三块（我上轮 §7.4 点名的）全部复检通过**：A2 两轮切语言 **8/8 成功、0 重试、0 违规**（§2.3）；NEG-1 判负自证**改后重做**，中文子页用例**转红且红因恰为首页文案**（§3.1）；`lang-path-redirect.test.jsx` 24 例 + `lang-path.test.js` 16 例 = **40/40 绿**，且我独立复算的 20 行纯函数矩阵 0 失败（§2.7、§2.8）。

**条件（3 条，均不阻塞）**：① 未知路径 `/foobar` 等**渲染空 `<main>`**，与改前**行为不同**（改前渲染首页），属**观察登记**而非按「变差」计缺陷的理由见 §2.6；② D 段「无前缀路由上切语言」因鉴权页**无 Header、无任何语言控件**而**未能实测**（与上轮同一限制，已列 §4）；③ §4 其余各条。

**未按缺陷计入（引用已登记豁免）**：既有 7 例测试失败、jinli 品牌残留、`index.html` 标题、e2e baseURL 5777、**页面正文未本地化**（`/hk`、`/en/reward` 下正文仍为简体中文，本单只登记一句现状，不判 FAIL、不开单）。
**另登记一条既有 UX 观察（非本单引入，已证改前同源）**：react-hot-toast 错误浮层（`z-index:9999`，右上角）会**盖住 Header 的语言切换按钮**，后端未挂时（`加载首页失败: Failed to load prizes`）语言菜单**点不开**；该现象在**改前 `073c683` 上同样复现**（§2.9）。

---

## 1. 逐项判定表

| # | 判定项 | 结果 | 证据 |
|---|---|---|---|
| 1 | **对锚成立**：5 个改动文件 blob == `dbccd89`；HEAD 未变 | **PASS** | `hash-object` == `rev-parse dbccd89:<f>`，5/5 YES；开工/收口 `git log -1` 同为 `dbccd89`（§0 表） |
| 2 | **改动面受控**：恰好 5 文件、无越界 | **PASS** | `git diff --name-only 073c683..dbccd89 \| wc -l` = **5**；全为上述 5 文件（§5） |
| 3 | **P0 正向判据**（真指针点中文首页三个导航） | **PASS** | `/reward`、`/task`、`/shard`，三条 `elementFromPoint` 自证 `isTargetOrInside=true`，`<main>` 各为对应页面，非首页欢迎语（§2.2） |
| 4 | **直访语言子页**（C 段 8 条） | **PASS** | `/reward`、`/task`、`/shard`、`/en/reward`、`/en/task`、`/hk/shard`、`/vn/reward` 全部渲染各自页面；`/zh/reward` 自愈为 `/reward`（§2.2） |
| 5 | **A2 两轮连续切语言 vn→hk→en→zh ×2**（真指针 hover 语文菜单） | **PASS** | **8/8 执行成功、重试 0 次、违规 0/8**；每步 `segs` 长度 ≤1 且首位∈语言表（§2.3） |
| 6 | **query/hash 保真**（`/hk/reward?x=1#y` 切 vn） | **PASS** | → `/vn/reward`，`search='?x=1'`、`hash='#y'` 均保留（§2.4） |
| 7 | **Footer 语言链接**（Kong 自认无单测、无浏览器取证） | **PASS（实测保留 search/hash）** | 3/3 用例真指针点击成功：`/hk/reward?x=1#y`→`/vn/reward?x=1#y`、→`/en/reward?x=1#y`；`/vn/task?a=b`→`/task?a=b`（§2.4） |
| 8 | **无前缀路由未被误伤**（`/login`、`/register`、`/dashboard`、`/dashboard/users`、`/profile`） | **PASS（子情形未测，见 §4）** | `/login`、`/register` 载入后 pathname 原样；三个鉴权页 → `/login`；**均未出现语言前缀**（§2.5） |
| 9 | **未知路径**（`/foobar`、`/reward/extra`、`/en/nope`） | **观察登记（不判 FAIL）** | 改后：pathname 原样、`<main>` 空（len=0）；改前：渲染首页文案。见 §2.6 的「是否变差」裁定 |
| 10 | **坏形态自愈**（7 条） | **PASS** | `/hk/vn→/hk`、`/en/en→/en`、`/zh→/`、`/vn//reward→/vn/reward`、`//hk→/hk`、`/hk//vn→/hk`、`//→/`，**7/7 main 非空**（§2.6） |
| 11 | **`/` 与 `/zh` 均落 zh 且主体非空** | **PASS** | 两者 pathname 均为 `/`，main_len=106（§2.10） |
| 12 | **语言呈现未被壳重构改坏** | **PASS** | `/en`、`/hk`、`/vn` 的 `document.title` / `<html lang>` / 国旗 / 导航文案与改前**逐字段一致**（§2.10） |
| 13 | **两文件单测真实性** | **PASS** | `16 + 24 = 40/40` 绿（§2.7）；请求级断言**非恒真**——NEG-1 下 5 条真转红（§3.1） |
| 14 | **全量测试与基线对照** | **PASS** | 新 `4 failed\|10 passed (14)`、`7 failed\|73 passed (80)`；基线 `073c683` `4 failed\|10 passed (14)`、`7 failed\|61 passed (68)`；**`FAIL_SET_IDENTICAL=YES`**（§2.8） |
| 15 | **`collapseSlashes` 根路径 `//` → `/` 且幂等** | **PASS** | 我的独立探针：`//`、`///`、`////`、`//zh//`、`/zh//` 全部 → `/` 且二次应用不变；显式硬断言 `root_collapse_to_slash`/`root_collapse_idempotent` 均 true（§2.11） |
| 16 | **NEG-1 判负自证（本单重做）** | **PASS** | 独立 worktree 内把外层壳改回 `/:lang?/*`：**5 转红 / 35 通过**，红全部是中文子页与 `/zh/reward` 自愈用例，失败 DOM 里出现的正是 `home page content`（§3.1） |
| 17 | **`npm run build`** | **PASS** | `BUILD_EXIT=0`，1756 modules，`✓ built in 2.15s`（§2.12） |
| 18 | **红线三项未被捎带动过** | **PASS** | diff 中 jinli 品牌串 0 命中；`playwright.config.js` baseURL 仍 `5777` 且未在改动面；`index.html` 未在改动面、标题未变（§5） |

**失败项：0。** 观察项 2 条（未知路径空白、toast 遮挡语言按钮，均为**改前同源或环境致因**），条件项见 §4。

---

### 1.1 派单方裁定（Zang；**原文照录，不改写**）

> 以下四条由派单方于收口阶段下达，**逐字照录**；每条下附我的**执行注记**（与裁定分栏，不得混读为裁定原文）。

**裁定 D-1（`/profile` 未登录差异，非退步）**

> 改前 `/:lang?/*` 把 `profile` 当语言段吞掉 ⇒ 内层剩余路径为空 ⇒ 渲染 HomePage（即 P0 同一根因）；改后正确匹配 ProfilePage → `ProtectedRoute` 未登录 → `/login`。⇒ **改后行为正确，不构成回归、不判 FAIL**。依据：`git show 073c683:frontend/src/App.jsx` 外层仍为 `path="/:lang?/*"`。

*执行注记*：我的改前/改后读数与该裁定逐字段吻合 —— 改前 `/profile` 落点**仍为 `/profile`**、`#header` 存在、`main_len=11`（首页占位帧「正在加载精彩内容...」），即被吞成 HomePage；改后落点 **`/login`**、无 `#header`、无 `<main>`（§2.13 D 段行）。**不判 FAIL。**

**裁定 E-1（`/foobar` 未知路径，行为变化但非本次引入的退步）**

> 改前渲染首页**同样是可选段吞路径的副作用**（与 P0 同根，不是一项正当功能）；改后 main 为空。真正的缺口是**全站本就没有 404 兼底页**（新旧 rev 均无）⇒ **登记观察 ＋ 建议另行立项，不判 FAIL、不开修单**。

*执行注记*：读数吻合 —— 改前 `/foobar` 渲染首页文案（`main_len=106`），改后为空（`main_len=0`）；且改前 `/reward/extra`、`/en/nope`、`/nope/deep/path` 三条**因可选段吞掉后内层亦无匹配、本已为空**（§2.13 E 段逐行）⇒「吞路径」在改前是同一副作用的两种表现，**非正当功能**。**登记观察，建议另行立项，不判 FAIL、不开单。**

**裁定 F-1**

> F 段 7/7 自愈（`/vn//reward`、`//hk`、`/hk//vn` 等改前均 main_len=0）⇒ 明确改善，计入本单正面读数。

*执行注记*：读数吻合 —— 该三条改前落点仍为畸形路径（`/vn//reward`、`//hk`、`/hk//vn`）且 `main_len=0`，改后分别自愈为 `/vn/reward`、`/hk`、`/hk` 且 `main_len` 9 / 11 / 106（§2.13 F 段）。**计入本单正面读数。**

**裁定 Q-1（`buildLangPath` 不折叠斜杠的 quirk）**

> 你已裁定不可达（LangShell 先 `<Navigate>` 不渲染 Header/Footer），**维持你的裁定**；报告里只作观察项，不开单。

*执行注记*：维持 §2.11 第 2 条既定裁定，仅作观察项，**不开单**。

---

## 2. 原始读数（run-tagged，真浏览器实例 `http://localhost:5787`，Chrome 154.0.8037.58 headless，视口 1440×900）

> 探针：`cdp_probe.py`（`/usr/bin/python3` + websocket-client 1.9.0）。一切点击走 `Input.dispatchMouseEvent`（`mouseMoved` → `mousePressed` → `mouseReleased`），**按下前必须 `document.elementFromPoint(点击点)` 返回目标元素本身或其子孙**，否则重取 rect 重试（最多 3 次），重试次数如实记入读数。

### 2.1 探针自证能力（先证明尺子会响）

- 首版探针未设视口 ⇒ Header 的 `md:` 桌面导航在 800px 默认视口下 `display:none`，目标 `<a>` 的 rect 为 **`0x0 @ (0,0)`**，点击落在 `DIV.container` 上；**自证字段当场判 FAIL**（`isTargetOrInside=false` ⇒ 我改掉了「祖先也算命中」的宽容判据，新增 `ancestorCovered` 单列）。这说明自证字段**不是恒真**。
- 修正：`Emulation.setDeviceMetricsOverride(1440×900)`；此后 rect 为 `80x37 @ (837,32)`，`elementFromPoint` 返回 `A`，`isTargetOrInside=true`、`ancestorCovered=false`。

### 2.2 A 段（P0 主判据）+ C 段（直访）

`browser-new-A.json`、`browser-new-CDEFG.json`

**A 段 · 真指针点中文首页（起点 pathname = `/`）**

| 点击目标 | 目标 href | rect | `elementFromPoint` 自证 | 点击后 pathname | `<main>` 文案头部 |
|---|---|---|---|---|---|
| 社区奖励 | `/reward` | `80x37 @ (837,32)` | `A`，`isTargetOrInside=true`，`ancestorCovered=false` | **`/reward`** | `奖励中心 用积分兑换精彩礼品和特权 0 可兑换 …` |
| 社区任务 | `/task` | `80x37 @ (921,32)` | `A`，`isTargetOrInside=true` | **`/task`** | `任务中心 参与任务，赚取积分，解锁精彩奖励 …` |
| shard | `/shard` | `62x37 @ (995,32)` | `A`，`isTargetOrInside=true` | **`/shard`** | `碎片市场 持有 1000 碎片可兑换 1 份奖品 市场 交易 我的 …` |

**判据达成**：三条 `<main>` 文案**均非**首页欢迎语（首页为 `欢迎来到 Jinli Club 参与任务，赚取 J，兑换精彩奖励 …`）⇒ **中文子页不再被可选语言段吞掉**。

**C 段 · 直访（`Page.navigate`，settle 1.6s）**

| 直访 | 落点 pathname | segs | main_len | `<main>` 文案头部 |
|---|---|---|---|---|
| `/reward` | `/reward` | `[reward]` | 102 | `奖励中心 用积分兑换精彩礼品和特权 …` |
| `/task` | `/task` | `[task]` | 9 | `正在加载任务...`（无后端，占位帧） |
| `/shard` | `/shard` | `[shard]` | 42 | `碎片市场 持有 1000 碎片可兑换 1 份奖品 …` |
| `/en/reward` | `/en/reward` | `[en,reward]` | 102 | `奖励中心 …` |
| `/en/task` | `/en/task` | `[en,task]` | 99 | `任务中心 …` |
| `/hk/shard` | `/hk/shard` | `[hk,shard]` | 42 | `碎片市场 …` |
| `/vn/reward` | `/vn/reward` | `[vn,reward]` | 102 | `奖励中心 …` |
| `/zh/reward` | **`/reward`**（自愈） | `[reward]` | 102 | `奖励中心 …` |

> `/task` 的 `main_len=9` 是**加载占位帧**（后端未挂），**不是空白**；同一探针下改前基线 `/task` 的落点见 §2.6 对照。

### 2.3 A2 段 · 两轮连续切语言（R1：Kong 称 8/8、0 重试）

`browser-new-A2B.json`

| 步 | 目标语言 | pathname | segs | segs 数≤2 | 首位∈语言表 | main_len | 自证 | **尝试次数** |
|---|---|---|---|---|---|---|---|---|
| 1 | vn | `/vn` | `[vn]` | ✔ | ✔ | 11 | ok | **1** |
| 2 | hk | `/hk` | `[hk]` | ✔ | ✔ | 11 | ok | **1** |
| 3 | en | `/en` | `[en]` | ✔ | ✔ | 11 | ok | **1** |
| 4 | zh | `/` | `[]` | ✔ | ✔（空首位合规） | 11 | ok | **1** |
| 5 | vn | `/vn` | `[vn]` | ✔ | ✔ | 11 | ok | **1** |
| 6 | hk | `/hk` | `[hk]` | ✔ | ✔ | 11 | ok | **1** |
| 7 | en | `/en` | `[en]` | ✔ | ✔ | 11 | ok | **1** |
| 8 | zh | `/` | `[]` | ✔ | ✔ | 11 | ok | **1** |

```
违规数（segs>2 或首位非语言表）= 0 / 8
实际执行成功（自证通过并已按下）= 8 / 8      重试次数 = 0 / 8
```

**⇒ R1 独立复核结论：Kong 所称「8/8、0 重试」成立。** 但**必须写明我这一轮为拿到该读数做了什么**（否则该读数不可信）：

- 首版探针对**第 7、8 步**报 `proof_ok=false`（菜单压根没打开）、`segs` 不变 ⇒ 那两轮「0 违规」是**空转**，不能算通过。我据此追查，定位到真因：**react-hot-toast 的错误浮层盖住了语言触发按钮**（§2.9）。
- 探针据此增加「先轮询到 `elementFromPoint(触发点)` 就是语言按钮为止，再 hover」的前置步骤；加入后 **8/8 一次成功、0 重试**。
- 该前置**不改变被测行为**（只等待环境自带的 4 秒浮层消失），且该遮挡在**改前 `073c683` 上同样复现**（§2.9）⇒ 非本单引入。

### 2.4 B / B2 段 · query + hash 保真

```
B（Header 语言菜单，真指针 hover → 点「越南语」）
  landed : pathname=/hk/reward  search='?x=1'  hash='#y'  main_len=102   （自证 ok，尝试 1 次）
  after  : pathname=/vn/reward  search='?x=1'  hash='#y'  main_len=9
  ⇒ search 保留 = True，hash 保留 = True
```

**B2（Footer 语言链接，Kong 自认无单测、无浏览器专项取证）** — 真指针，逐个自证：

| 起点 | 点页脚 | 页脚该链接 href | 自证 | 实测落点 pathname | search | hash | 结论 |
|---|---|---|---|---|---|---|---|
| `/hk/reward?x=1#y` | 粵語→Tiếng Việt | `/vn/reward?x=1#y` | `A`, isTgt=true, ancCover=false（1 次成功） | **`/vn/reward`** | `?x=1` | `#y` | **保留** |
| `/hk/reward?x=1#y` | English | `/en/reward?x=1#y` | `A`, isTgt=true（1 次成功） | **`/en/reward`** | `?x=1` | `#y` | **保留** |
| `/vn/task?a=b` | 简体中文 | `/task?a=b` | `A`, isTgt=true（1 次成功） | **`/task`** | `?a=b` | `` | **保留** |

```
起点 /hk/reward?x=1#y 时页脚四个链接的 href 实测：
  简体中文 -> /reward?x=1#y      English -> /en/reward?x=1#y
  粵語     -> /hk/reward?x=1#y   Tiếng Việt -> /vn/reward?x=1#y
⇒ Footer.jsx:87 补的 `${location.search}${location.hash}` 口径**已生效**（源码口径生效，非我点错元素）
```

> **诚实注记**：该组首个用例在我**未加浮层前置**的上一轮探针里曾失败一次（`elementFromPoint` 返回 `IMG`，`isTargetOrInside=false`，pathname 未变）。加入浮层前置后 **3/3 一次成功**；同一失败形态在改前基线亦出现 ⇒ 判为**环境浮层所致，非 Footer 源码口径问题**，源码口径已由「页脚四个 href 均带 `?x=1#y`」＋「三条真指针落点均保留 search/hash」双向证明。

### 2.5 D 段 · 无前缀路由（防误伤）

`browser-new-CDEFG.json`

| 请求 | 载入后 pathname | 是否含语言前缀 | `<main>` 是否存在 | `#header` 是否存在 | 该页语言控件数 |
|---|---|---|---|---|---|
| `/login` | `/login` | **否** | 否（AuthPage 无 `<main>`） | **否** | `{img_buttons:0, flag_links:0, text_langs:0}` |
| `/register` | `/register` | **否** | 否 | **否** | `{0,0,0}` |
| `/dashboard` | `/login`（既有鉴权重定向） | **否** | 否 | **否** | `{0,0,0}` |
| `/dashboard/users` | `/login`（同上） | **否** | 否 | **否** | `{0,0,0}` |
| `/profile` | `/login`（未登录） | **否** | 否 | **否** | `{0,0,0}` |

**`ProtectedRoute` 行为与 HEAD 前一致**：未登录访问 `/profile`、`/dashboard`、`/dashboard/users` 一律 `Navigate → /login`，且落点**不含语言前缀** ⇒ 未被新壳误加前缀。

**未执行子步骤（如实标注）**：任务书要求「在这些页上切语言」。实测这 5 条路由**均无 `#header`，且全文档 `button>img` / 国旗链接 / 语言文案控件计数均为 0** ⇒ **这些页上不存在语言切换控件**，该子情形**无从执行**（是「不适用」，不是「通过」）。已列 §4 第 2 条。

### 2.6 E 段 · 未知路径（改前/改后对照）+ F 段 · 坏形态自愈

**E 段 · 改后（`dbccd89`，5787）**

| 请求 | 最终 pathname | 是否重定向 | `<main>` 存在 | main_len | `<main>` 文案 |
|---|---|---|---|---|---|
| `/foobar` | `/foobar` | 否 | 是 | **0** | 空 |
| `/reward/extra` | `/reward/extra` | 否 | 是 | **0** | 空 |
| `/en/nope` | `/en/nope` | 否 | 是 | **0** | 空 |
| `/nope/deep/path` | `/nope/deep/path` | 否 | 是 | **0** | 空 |

**E 段 · 改前（`073c683`，5812 独立 worktree 实例）** — 见 §2.13 对照表。

**F 段 · 坏形态自愈（改后，5787）**

| 直访 | 最终 pathname | segs | main_len | main 非空 |
|---|---|---|---|---|
| `/hk/vn` | **`/hk`** | `[hk]` | 11 | ✔ |
| `/en/en` | **`/en`** | `[en]` | 106 | ✔ |
| `/zh` | **`/`** | `[]` | 106 | ✔ |
| `/vn//reward` | **`/vn/reward`** | `[vn,reward]` | 9 | ✔ |
| `//hk` | **`/hk`** | `[hk]` | 11 | ✔ |
| `/hk//vn` | **`/hk`** | `[hk]` | 106 | ✔ |
| `//` | **`/`** | `[]` | 106 | ✔ |

```
7/7 自愈到规范路径；7/7 main 非空（最小 9 = 「正在加载奖励...」占位帧，非空白）
```

### 2.7 测试真实性（亲自跑，禁裸 `npm test`）

命令：`cd frontend && npx vitest run src/test/unit/lang-path.test.js src/test/unit/lang-path-redirect.test.jsx --reporter=basic`

```
RUN  v0.34.6 /Users/kevin/bistro/seafood/frontend
 ✓ src/test/unit/lang-path.test.js  (16 tests) 6ms
 ✓ src/test/unit/lang-path-redirect.test.jsx  (24 tests) 130ms
 Test Files  2 passed (2)
      Tests  40 passed (40)
   Duration  1.45s
EXIT=0
```

**⇒ Kong 自称「+16 → 16 例」「+47 → 24 例」「40/40 绿」三项全部与我的实测一致。**
**用例是否真咬住行为（逐项核）**：`lang-path-redirect.test.jsx` **mocks 掉 12 个业务组件后仍真实挂载 `App` 与真实 `react-router` 的 `MemoryRouter`**（`vi.mock` 只替换页面/Header/Footer/LoginModal/AdminLayout/admin-utils/auth-context），**断言落在 `location.pathname` 与页面文案上，没有把路由本身 mock 掉**，也没有恒真断言（`expect(screen.getByText(...))` 会因元素缺失而抛错——已由 NEG-1 实测转红证明）。`lang-path.test.js` 是纯函数表驱动，期望值逐条写死。

### 2.8 全量测试与基线对照

```
新建基线（main @ dbccd89）  : Test Files  4 failed | 10 passed (14)   Tests  7 failed | 73 passed (80)
旧基线  （worktree @ 073c683）: Test Files  4 failed | 10 passed (14)   Tests  7 failed | 61 passed (68)

差值：唯一变化 = 通过数 +12（新增 lang-path.test.js +2 例、lang-path-redirect.test.jsx +10 例）
FAIL 集合逐条 diff（文件级 + 用例级，各 9 行）：FAIL_SET_IDENTICAL=YES
```

失败集合（与已登记豁免**逐条对应**，无新增）：

```
src/test/accessibility/Accessibility.test.jsx [ 收集失败 ]            ← 已登记
src/test/e2e/basic.spec.js [ 收集失败 ]                               ← 已登记
src/test/components/Card.test.jsx  6 例（default props/variants/Header/Title/Content/hover）
src/test/performance/VirtualList.test.jsx  1 例（updates visible items on scroll）
```

### 2.9 环境浮层（改前同源，登记为观察）

```
场景：后端未挂（/src/auth.js 500）⇒ 首页 fetch 失败 ⇒ react-hot-toast 弹出错误浮层
浮层实测：div.go2072408551，position:fixed，z-index:9999，文案「加载首页失败: Failed to load prizes」
位置实测：恰好压住 Header 右侧的语言切换按钮（触发点 rect 80x37 @ (1106,32) 附近）

改后 5787 实测：elementFromPoint(触发点) = SPAN(语言)      isTargetOrInside=true   ← 浮层已自动消失时
                某些时刻          = DIV.go2072408551      isTargetOrInside=false  ← 浮层在档时
改前 5812 实测：elementFromPoint(触发点) = DIV.go2072408551 isTargetOrInside=false ← 同一现象
⇒ 该遮挡**在改前 `073c683` 上同样存在** ⇒ 非本单引入 ⇒ 登记为观察，不开单
```

### 2.10 G 段 · 语言完整性 + `/` 与 `/zh`

| 直访 | 落点 pathname | `document.title` | `<html lang>` | Header 国旗 | Header 导航文案 |
|---|---|---|---|---|---|
| `/` | `/` | `Seafood 海鲜市场｜加密人自己的「闲鱼」` | `zh-CN` | `cn.svg` | `["社区奖励","社区任务","shard"]` |
| `/zh` | **`/`** | 同上 | `zh-CN` | `cn.svg` | 同上 |
| `/en` | `/en` | `Seafood｜The crypto crowd's own flea market` | `en` | `us.svg` | `["Rewards","Tasks","shard"]` |
| `/hk` | `/hk` | `Seafood 海鮮市場｜幣圈人的跳蚤市場` | `zh-HK` | `hk.svg` | `["社區獎勵","社區任務","shard"]` |
| `/vn` | `/vn` | `Seafood｜Chợ đồ cũ của dân crypto` | `vi` | `vn.svg` | `["Phần thưởng","Nhiệm vụ","shard"]` |

（`/hk` 与 `/vn` 的 title 以 §2.13 的改前对照为准；两处逐字段一致性见该表。）

### 2.11 `collapseSlashes` 根路径专核（我的独立探针）

`raw-probe-func-corrected.json` / `raw-probe-func.json`（探针 `probe-func.mjs`）

```
totals = {"rows": 20, "check_fails": 0, "idem_fails": 0, "explicit_fails": []}
explicit = {"lang_whitelist":true, "root_collapse_to_slash":true, "root_collapse_idempotent":true,
            "no_trailing_slash_except_root":true, "canonical_of_canonical_stable":true}
rootCases:
  //      -> '/'  (二次应用 '/')        ///   -> '/'  ('/')
  ////    -> '/'  ('/')                //zh// -> '/' ('/')
  /zh//   -> '/'  ('/')                /./  -> '/.'  ('/.')   ← 点段未归一化，见下
rootOk = True（全部幂等）
⇒ 根路径 `//` 确实归成 `/`，且幂等。**17 行 …共 20 行逐字段与我的自写期望一致。**
```

**两处诚实披露（我的期望写错，非实现错）**：

1. 首次运行 `check_fails=4`，全部落在 `/vn//reward`、`//hk`、`/hk//vn`、`/vn//reward//` 四行的 `strip`/`by_lang` 字段。**经核是我的期望写错**：`stripLangPrefix`/`buildLangPath` 的契约是**只剥语言段、不折叠重复斜杠**（折叠是 `canonicalLangPath` 独有的职责），故 `buildLangPath('//hk','zh')='//hk'` 是**正确契约**。我保留该次读数原件为 `probe-func-wrong-expectation.mjs` + `raw-probe-func.json`（`check_fails=4`），修正期望后复跑得 `check_fails=0` ⇒ **证明该探针会因期望写错而变红，非恒真**。
2. **可达性裁定（重要，避免把不可达 quirk 报成缺陷）**：`buildLangPath` 保留重复斜杠这一 quirk 在真实应用中**不可达** —— 使用它的只有 `Header.changeLanguage` 与 `Footer` 语言链接，二者都读 `location.pathname`；而 `LangShell` 在路径不规范时**先 `return <Navigate>` 而根本不渲染 Header/Footer**（`App.jsx:50-52`）⇒ 畸形 pathname 永远到不了这两个调用点。故**只登记为观察，不判缺陷**。
3. `/./` ⇒ `canonicalLangPath('/.')='/'`? **实测为 `'/.'`**（点段未归一化）⇒ 该形态不触发自愈、内层无匹配 ⇒ `<main>` 空。但 **Chrome 在导航时自行把 `/./` 归一化为 `/`**，地址栏/链接都不会把 `/./` 送进来 ⇒ 亦列为观察（未在真实浏览器中以 `/./` 独立取证，见 §4）。

### 2.12 构建

`build-dbccd89.log`（`frontend/`，退出码取自 npm 进程本身，不经管道）

```
✓ 1756 modules transformed.
(!) react-hot-toast/dist/index.mjs is dynamically imported by src/utils.js … but also statically imported by 18 个文件…
dist/assets/hk-DJjlsSdH.svg       4.61 kB │ gzip:   2.01 kB
dist/index.html                   4.64 kB │ gzip:   2.30 kB
dist/assets/us-BUggRluv.svg       7.87 kB │ gzip:   1.24 kB
dist/assets/index-Dmk27wGY.css   48.70 kB │ gzip:  10.85 kB
dist/assets/index-DrJRFa44.js   423.04 kB │ gzip: 124.06 kB
✓ built in 2.15s
BUILD_EXIT=0
```

唯一告警仍是既有的 react-hot-toast 动/静态混用 chunking 提示（`utils.js` 未新增 import，与本次改动无关）。

### 2.13 改前 / 改后对照表（`073c683` @5812 ↔ `dbccd89` @5787）

**数据源（均为本机探针落盘原件）**：
- **改前列**：`browser-old-CDEFG.json` —— **取读 revision `073c683`**，实例 **`http://localhost:5812`**（于独立 worktree `wt-073c683` 内起服；该 worktree 与 `wt-neg1` 均已于 §6 清理）。
- **改后列**：`browser-new-CDEFG.json` —— **取读 revision `dbccd89`**，实例 `http://localhost:5787`。

两列**同一探针**（`cdp_probe.py`）、**同一视口** 1440×900、**同一 settle 时长**；改前列每段表头写死「revision ＋ 端口」，避免两列混读。

**C 段 · 直访语言子页**

| 直访 | **改前 `073c683` @5812** · 落点 / segs / main_len / `<main>` 文案 | **改后 `dbccd89` @5787** · 落点 / segs / main_len / `<main>` 文案 | 判定 |
|---|---|---|---|
| `/reward` | `/reward` / `[reward]` / **11** / `正在加载精彩内容...`（**首页占位帧**） | `/reward` / `[reward]` / **102** / `奖励中心 用积分兑换精彩礼品和特权…` | **修正**（改前被吞成首页） |
| `/task` | `/task` / `[task]` / **11** / 首页占位帧 | `/task` / `[task]` / **9** / `正在加载任务...` | **修正** |
| `/shard` | `/shard` / `[shard]` / **11** / 首页占位帧 | `/shard` / `[shard]` / **42** / `碎片市场 持有 1000 碎片…` | **修正** |
| `/en/reward` | `/en/reward` / `[en,reward]` / 102 / `奖励中心…` | `/en/reward` / `[en,reward]` / 102 / `奖励中心…` | 一致 |
| `/en/task` | `/en/task` / `[en,task]` / 99 / `任务中心…` | `/en/task` / `[en,task]` / 99 / `任务中心…` | 一致 |
| `/hk/shard` | `/hk/shard` / `[hk,shard]` / 42 / `碎片市场…` | `/hk/shard` / `[hk,shard]` / 42 / `碎片市场…` | 一致 |
| `/vn/reward` | `/vn/reward` / `[vn,reward]` / 102 / `奖励中心…` | `/vn/reward` / `[vn,reward]` / 102 / `奖励中心…` | 一致 |
| `/zh/reward` | 自愈 → `/reward` / `[reward]` / **106** / **首页文案**（`欢迎来到 Jinli Club…`） | 自愈 → `/reward` / `[reward]` / **102** / `奖励中心…` | **修正**（改前自愈后仍被吞） |

**D 段 · 无前缀路由（防误伤）**

| 请求 | **改前 `073c683` @5812** · 落点 / `<main>` / `#header` | **改后 `dbccd89` @5787** · 落点 / `<main>` / `#header` | 判定 |
|---|---|---|---|
| `/login` | `/login` / 无 / 无 | `/login` / 无 / 无 | 一致 |
| `/register` | `/register` / 无 / 无 | `/register` / 无 / 无 | 一致 |
| `/dashboard` | `/login`（既有鉴权重定向） / 无 / 无 | `/login` / 无 / 无 | 一致 |
| `/dashboard/users` | `/login` / 无 / 无 | `/login` / 无 / 无 | 一致 |
| **`/profile`** | **`/profile`** / **有**（`main_len=11`，首页占位帧） / **有** | **`/login`** / 无 / 无 | **差异 —— 见裁定 D-1（非退步、不判 FAIL）** |

**E 段 · 未知路径**

| 请求 | **改前 `073c683` @5812** · 落点 / main_len / `<main>` 文案 | **改后 `dbccd89` @5787** · 落点 / main_len / `<main>` 文案 | 判定 |
|---|---|---|---|
| `/foobar` | `/foobar` / **106** / **首页文案**（`欢迎来到 Jinli Club…`） | `/foobar` / **0** / 空 | 行为变化 —— 见裁定 E-1（观察，不判 FAIL） |
| `/reward/extra` | `/reward/extra` / 0 / 空 | `/reward/extra` / 0 / 空 | 一致 |
| `/en/nope` | `/en/nope` / 0 / 空 | `/en/nope` / 0 / 空 | 一致 |
| `/nope/deep/path` | `/nope/deep/path` / 0 / 空 | `/nope/deep/path` / 0 / 空 | 一致 |

**F 段 · 坏形态自愈**

| 直访 | **改前 `073c683` @5812** · 落点 / main_len / main 非空 | **改后 `dbccd89` @5787** · 落点 / main_len / main 非空 | 判定 |
|---|---|---|---|
| `/hk/vn` | `/hk` / 11 / ✔ | `/hk` / 11 / ✔ | 一致 |
| `/en/en` | `/en` / 106 / ✔ | `/en` / 106 / ✔ | 一致 |
| `/zh` | `/` / 106 / ✔ | `/` / 106 / ✔ | 一致 |
| **`/vn//reward`** | **`/vn//reward`** / **0 / ✗** | **`/vn/reward`** / **9 / ✔** | **改善（裁定 F-1）** |
| **`//hk`** | **`//hk`** / **0 / ✗** | **`/hk`** / **11 / ✔** | **改善（裁定 F-1）** |
| **`/hk//vn`** | **`/hk//vn`** / **0 / ✗** | **`/hk`** / **106 / ✔** | **改善（裁定 F-1）** |
| `//` | `/` / 11 / ✔ | `/` / 106 / ✔ | 一致（均自愈到 `/`） |

```
改前：4/7 main 非空（/hk/vn、/en/en、/zh、//），3/7 main_len=0 且落点仍为畸形路径
      （/vn//reward → /vn//reward、//hk → //hk、/hk//vn → /hk//vn）
改后：7/7 自愈到规范路径 + 7/7 main 非空
⇒ 净改善；/vn//reward、//hk、/hk//vn 三条由「畸形保留 + 空白」变为「规范路径 + 有内容」
```

**G 段 · 语言完整性（`document.title` / `<html lang>` / Header 国旗 / Header 导航文案，逐字段并排）**

| 直访 | **改前 `073c683` @5812** | **改后 `dbccd89` @5787** | 逐字段 |
|---|---|---|---|
| `/` | `/` · `Seafood 海鲜市场｜加密人自己的「闲鱼」` · `zh-CN` · `cn.svg` · `["社区奖励","社区任务","shard"]` | `/` · 同左逐字段 | **一致** |
| `/zh` | 落点 → `/` · 同 `/` | 落点 → `/` · 同 `/` | **一致** |
| `/en` | `/en` · `Seafood｜The crypto crowd's own flea market` · `en` · `us.svg` · `["Rewards","Tasks","shard"]` | `/en` · 同左逐字段 | **一致** |
| `/hk` | `/hk` · `Seafood 海鮮市場｜幣圈人的跳蚤市場` · `zh-HK` · `hk.svg` · `["社區獎勵","社區任務","shard"]` | `/hk` · 同左逐字段 | **一致** |
| `/vn` | `/vn` · `Seafood｜Chợ đồ cũ của dân crypto` · `vi` · `vn.svg` · `["Phần thưởng","Nhiệm vụ","shard"]` | `/vn` · 同左逐字段 | **一致** |

> **诚实附注（唯一一处字段差异，非语义）**：`/en` 的 `main_len` 改前 **106**、改后 **11**；两者 `<main>` 文案**同为首页欢迎语**（改前 `欢迎来到 Jinli Club…`，改后 `正在加载精彩内容...`）⇒ 差异只是**无后端下的加载占位帧时序**（§4 第 4 条已登记）。§2.10 的 G 段四项判据（title / html lang / 国旗 / 导航文案）**逐字段一致**，故语言呈现**无回归**。

---

## 3. 判负自证（negative control）

### 3.1 NEG-1（**本单自己重做**）：把外层壳改回 `path="/:lang?/*"`

**合规**：在独立 worktree `$HERMES_HOME/profiles/zang/cache/scratch/lang-shell-regression/wt-neg1`（`git worktree add --detach … dbccd89`）内改 `frontend/src/App.jsx`；**主工作区源码零改动、未 commit、未 push**。保留新 `utils.js` 与新测试。

变异（worktree 内 `git diff --stat` → `frontend/src/App.jsx | 9 ++-------`，1 file changed, 2 insertions(+), 7 deletions(-)）：

```diff
-      {/* 显式语言壳路由：/en/*、/hk/*、/vn/*、/zh/* … */}
-      {SUPPORTED_LANGS.map((lang) => (
-        <Route key={lang} path={`/${lang}/*`} element={<LangShell />} />
-      ))}
-
-      {/* 无前缀兜底壳（中文口径…） */}
-      <Route path="/*" element={<LangShell />} />
+      {/* NEG-1 变异：外层壳改回可选语言段 `/:lang?/*`（保留新 utils 与新测试） */}
+      <Route path="/:lang?/*" element={<LangShell />} />
```

**(a) 我的复跑读数**（`neg1-mutated.log`）

```
 ✓ src/test/unit/lang-path.test.js            (16 tests)        ← 纯函数层 16 条仍全绿（分层可分辨）
 ❯ src/test/unit/lang-path-redirect.test.jsx  (24 tests | 5 failed)
 Test Files  1 failed | 1 passed (2)
      Tests  5 failed | 35 passed (40)
```

**5 条转红用例（逐条）**：

```
语言前缀规范化重定向（防御层）> 把 /zh/reward 自愈为 /reward 并渲染奖励页
语言前缀规范化重定向（防御层）> 规范路径 /reward 保持原样（不额外加重定向）且渲染奖励页
中文无前缀子路径渲染（P0）    > /reward 渲染 /reward 对应的页面内容
中文无前缀子路径渲染（P0）    > /task   渲染 /task   对应的页面内容
中文无前缀子路径渲染（P0）    > /shard  渲染 /shard  对应的页面内容
```

**红因自证（最关键的一条）**：失败 DOM 里出现的正是**首页文案**，即原 P0 症状被精确复现：

```
TestingLibraryElementError: Unable to find an element with the text: reward page content.
            home page content                                   ← 渲染到的是首页
    133|     expect(screen.getByText('reward page content')).toBeInTheDocument()
（/task、/shard 两条同形，`home page content` 分别对应 task/shard 两条用例）
```

**(b) 还原取证**

```
$ cd wt-neg1 && git checkout -- frontend/src/App.jsx
$ git -C wt-neg1 status --porcelain  →  ?? frontend/node_modules（仅软链，源码无 diff）
restored App.jsx sha256 = b6033bf9a5f1fc5045f3980c633df335c4e62060c1ae585c16acf6963e9cd073
                          ⇒ 与 §0 表中 dbccd89 的 App.jsx sha256 **逐字节相同**
$ npx vitest run … （还原后）  Test Files 2 passed (2)   Tests 40 passed (40)   ← 复回全绿
```

**NEG-1 判定：判负自证成立。** 变异后**只有**中文子页 + `/zh/reward` 这 5 条转红，纯函数层 16 条全绿 ⇒ **分层可分辨、局部红、非恒真**；且**红因与 P0 原始症状同形**（子页渲染成首页文案）⇒ 该套件对「壳被拆」有真实分辨力。

---

## 4. 未验证清单（明确「我没验」的部分）

| # | 未验证项 | 说明 | 风险 |
|---|---|---|---|
| 1 | **未知路径的「是否变差」判定为观察而非缺陷** | `/foobar`、`/reward/extra`、`/en/nope`、`/nope/deep/path` 在改后渲染**空 `<main>`**；改前渲染首页文案（§2.13）。两者都无 404 页 ⇒ **不判 FAIL、不开单**，仅登记 | 低 |
| 2 | **D 段「无前缀路由上切语言」** | `/login`、`/register`、`/dashboard*`、`/profile` **无 `#header`，且全文档语言控件计数为 0** ⇒ 该子情形**无从执行**（不适用，非通过）。与上轮同一限制 | 低（探针/产品形态限制） |
| 3 | **`/./` 点段路径** | 仅在函数层测得 `canonicalLangPath('/./')='/./'`；**未在真实浏览器中以 `/./` 独立取证**（Chrome 导航时会自行归一化，探针无法稳定送入） | 低 |
| 4 | **语言切换的加载占位帧时长** | A2 各步 `main_len=11`（`正在加载精彩内容...`）、`/task` 为 `正在加载任务...`（无后端）。判据「非空」通过，用户可感知时延**未量化** | 低（环境致因） |
| 5 | **有后端时的行为** | 两侧实例均未挂后端（`/src/auth.js` 500 + `Failed to load prizes`）⇒ **未验证**挂后端时前缀/自愈/语言呈现是否变化 | 低 |
| 6 | **Firefox / WebKit** | 全程仅 Chrome 154 headless（macOS）；未跑 Gecko/WebKit | 低 |
| 7 | **官方 E2E（Playwright）** | 未跑 `npm run test:e2e`；`basic.spec.js` 被 vitest 收集而失败为**已登记豁免** | 中（测试基建） |
| 8 | **移动端断点（<768px）** | 探针固定 1440×900 桌面视口；**未验证** `md:hidden` 移动端语言切换路径 | 低 |
| 9 | **`dist/` 产物在真实服务器上的行为** | 只验证 build 可过并产出；**未部署**、未跑生产 CSP/缓存复验 | 低 |
| 10 | **HMR 中间态** | 5787 为长驻 dev server（PID 43118），读取时按磁盘即时 transform；**未**验证热更新半更新状态下的前缀行为 | 低 |
| 11 | **react-hot-toast 遮挡语言按钮**（观察项） | 已证改前同源；**未**测量遮挡持续时长与误点率，也**未**评估是否需要在产品侧调整 toast 位置 | 低（既有/非本单） |
| 12 | **并发 `docs/` 写者的产物归属** | `docs/audit/`、`docs/qa/45c27d8-lang-path.md`、`docs/qa/lang-prefix-normalize.md` 为**并发他方产物**，本单**未读取、未修改、未删除**，其 HEAD 归属**本报告不下断言** | — |
| 13 | **本件未做的动作（合规声明）** | 未改任何源码；未 commit / 未 push；未启停 5787/5778 面板服务；未触碰他方 `docs/` 产物与 `backend-ts/**` | — |

---

## 5. 红线复核

```
$ git diff --name-only 073c683..dbccd89          → 恰好 5 个文件（见 §0），无越界
$ git diff --name-only 073c683..dbccd89 | wc -l  → 5

红线 1 · jinli 品牌残留
  git diff 073c683..dbccd89 -- frontend/src | grep -iE "JINLI CLUB|contact@jinli\.club|jinli"  → 0 命中
  现状（未被本单改动）：Footer.jsx:111-114 仍为 `contact@jinli.club`（zh/en/hk/vn 四行原样）
  ⇒ 未被本单捎带动过（且属**已登记豁免**）

红线 2 · e2e baseURL
  frontend/playwright.config.js **不在改动面**；实测 baseURL 仍为 `http://localhost:5777`（行 11、行 39）
  ⇒ 未被本单捎带动过（且属**已登记豁免**）

红线 3 · index.html 标题
  frontend/index.html **不在改动面**；实测 `<title>Seafood 海鲜市场｜加密人自己的「闲鱼」</title>`（行 8）
  ⇒ 未被本单捎带动过（且属**已登记豁免**）

结论：三处红线均未被触碰；改动面**只落在任务书列明的 5 个文件** ⇒ 不触发 FAIL。
```

---

## 6. 清理取证

```
（见 §6.1–§6.4 正表 · 清理前/后原始输出齐备）
```

> **清理原则**：先验后清、按**精确 PID/路径**；全程**未使用** `pkill -f` / `killall`；**未 kill 任何进程**（端口与 PID 在收口前已随本单终止 —— 见 6.1）。仅删本单自有产物：`chrome-profile/` 目录 ＋ 两个 worktree（`wt-073c683`、`wt-neg1`）。**他方产物一律未动**（见 6.4 归属表）。

**前置：HEAD 前移与本单锁定面的关系（派单方现场更新）**

收口期间**并发线（P3 数据层）持续在推 HEAD**，故 HEAD 为**移动靶**：本单收口窗口内现取两次 —— 首次 `fab9d32`、末次 **`0da1cea`**（两次之间已含派单方点名的 `adebd4a`）。**本单锁定的被检面 `dbccd89` 不受影响**，现取复核：

```
$ git log --oneline -5          （末次现取）
0da1cea master-plan v0.36: 5.31 自我更正 —— v0.35 的读不再写下得过宽
fab9d32 master-plan v0.35: 5.30 P3 Step 1 验收通过（读不再写，库回到 == 0012）
4e978e3 P3 Step 1: 摘掉运行时 DDL，库回到 == 0012（读不再写）
adebd4a master-plan: 5.29 追加并发会话冲突与跨会话纪律（Kevin 裁定全部归本会话）
dbccd89 fix(router): 拆显式语言壳，修中文子页被可选语言段吞掉

$ git log dbccd89..HEAD -- frontend/ | wc -l
       0
⇒ 本单锁定面 frontend/** 在 dbccd89 之后**零改动**（两次现取均成立）。

7 个指纹文件现取复核（git hash-object <f> == git rev-parse dbccd89:<f>）：
  frontend/src/App.jsx                              dce14d6b… == dce14d6b…   YES
  frontend/src/utils.js                             9578df4d… == 9578df4d…   YES
  frontend/src/components/Footer.jsx                e7c4ab96… == e7c4ab96…   YES
  frontend/src/test/unit/lang-path.test.js          b2bc491f… == b2bc491f…   YES
  frontend/src/test/unit/lang-path-redirect.test.jsx 5150f6c1… == 5150f6c1…  YES
  frontend/index.html                               05437382… == 05437382…   YES
  frontend/src/components/Header.jsx                bb1da0f8… == bb1da0f8…   YES
⇒ 7/7 相等 ⇒ §0 指纹未失效，对锚仍成立。
```

### 6.1 进程与端口（清理前 → 清理后 · 原始输出）

**清理前**
```
$ lsof -nP -iTCP:9335 -sTCP:LISTEN
（空 · exit=1）
$ lsof -nP -iTCP:5812 -sTCP:LISTEN
（空 · exit=1）
$ ps -p 40677,40682 -o pid,ppid,stat,etime,command
  PID  PPID STAT ELAPSED COMMAND
（仅表头 · exit=1）
$ pgrep -fl 'lang-shell-regression/chrome-profile'
（无匹配）
⇒ Chrome(9335)、vite(5812) 及 PID 40677/40682 均已随本单终止 ⇒ **无进程可 kill，未执行任何 kill**。
```

**清理后**
```
$ lsof -nP -iTCP:9335 -sTCP:LISTEN
（空）
$ lsof -nP -iTCP:5812 -sTCP:LISTEN
（空）
$ ps -p 40677,40682 -o pid,ppid,stat,etime,command
  PID  PPID STAT ELAPSED COMMAND
（仅表头）
```

### 6.2 `chrome-profile` 目录

```
$ du -sh …/scratch/lang-shell-regression/chrome-profile
131M    …/scratch/lang-shell-regression/chrome-profile

$ rm -rf …/scratch/lang-shell-regression/chrome-profile        → exit=0

$ ls -d …/scratch/lang-shell-regression/chrome-profile
ls: …/chrome-profile: No such file or directory
⇒ 已删（记账释放 131M）；删前已确认零进程占用（6.1 的 pgrep 无匹配）。
```

### 6.3 worktree（`--force` 精确路径 · 无通配）

**清理前**
```
$ git worktree list
/Users/kevin/bistro/seafood                                                        fab9d32 [main]
/Users/kevin/.hermes/profiles/zang/cache/scratch/lang-shell-regression/wt-073c683  073c683 (detached HEAD)
/Users/kevin/.hermes/profiles/zang/cache/scratch/lang-shell-regression/wt-neg1     dbccd89 (detached HEAD)
```

**执行**
```
$ git worktree remove --force …/scratch/lang-shell-regression/wt-073c683    → exit=0
$ git worktree remove --force …/scratch/lang-shell-regression/wt-neg1      → exit=0
$ git worktree prune                                                        → exit=0

$ ls …/scratch/lang-shell-regression/wt-073c683 …/scratch/lang-shell-regression/wt-neg1
ls: …/wt-073c683: No such file or directory
ls: …/wt-neg1: No such file or directory
```

**清理后**
```
$ git worktree list
/Users/kevin/bistro/seafood  fab9d32 [main]
⇒ 只余主工作区，符合预期。
```

### 6.4 收口工作区状态与逐项归属

**原始输出（收口末次现取 · 2026-09-28 08:57:36 CST）**
```
$ git status --porcelain
 M backend-ts/src/database.ts
?? docs/data-layer.spec.md
?? docs/qa/45c27d8-lang-path.md
?? docs/qa/lang-prefix-normalize.md
?? docs/qa/lang-shell-regression.md

$ git diff --stat
 backend-ts/src/database.ts | 34 ----------------------------------
 1 file changed, 34 deletions(-)

$ git diff -- frontend | wc -c   →  0
$ git diff -- frontend           →  （空）
$ git diff --cached | wc -c      →  0
$ git diff --cached              →  （空）
$ git diff --name-only | grep -c frontend   →  0
```

> 说明：HEAD 为移动靶（见前置），故 `git status` 也会随之变。本单**首次现取（`fab9d32` 时）**该行尚未出现（当时并发线刚把 `backend-ts/**` 提交掉）；**末次现取（`0da1cea` 时）**并发线又在其工作区重开 ` M backend-ts/src/database.ts`（34 行删除）。两种情况**均与本单无关**，本单对其**未读、未写、未暂存**。

**逐项归属**

| `git status` 行 | 归属 | 处置 |
|---|---|---|
| ` M backend-ts/src/database.ts` | 并发他方产物（P3 数据层线，**非 frontend**） | **未触碰 / 未暂存 / 未纳入本单改动面** |
| `?? docs/data-layer.spec.md` | 并发他方产物（P3 数据层线） | **未读取 / 未修改 / 未删除** |
| `?? docs/qa/45c27d8-lang-path.md` | 并发他方产物 | **未读取 / 未修改 / 未删除** |
| `?? docs/qa/lang-prefix-normalize.md` | 并发他方产物 | **未读取 / 未修改 / 未删除** |
| `?? docs/qa/lang-shell-regression.md` | **本单产物**（本报告） | 本单**唯一**新增文件 |

**关于派单方点名、但两次现取归属不同的其余项**：`backend-ts/.p3s1-artifacts/`、`backend-ts/scripts/p3s1-0{0,1,2}-*.ts` 在**首次现取**时已由并发线自身 commit 进 `4e978e3`（3 个 p3s1 脚本 ＋ 5 个 `.p3s1-artifacts/` 文件），故不再出现在 `git status`；`docs/audit/` 亦已由他方 tracked 入库（3 个文件）。**本单未触碰其中任何一个。**

**收口断言（按派单方更新后的口径）**
```
① frontend/** 零改动 ：git diff -- frontend 为空 ✔  ；git diff --cached 为空 ✔
② 本单产物在位     ：docs/qa/lang-shell-regression.md 存在 ✔
③ 他方文件零触碰   ：未动 / 未删 / 未纳入本单改动面 ✔
⇒ 收口成功。
```

---

## 附录 A · 读数文件清单（`/Users/kevin/.hermes/profiles/zang/cache/scratch/lang-shell-regression/`）

**A.1 仓库内被检面 7 个指纹文件**（`git hash-object <f>` == `git rev-parse dbccd89:<f>`；收口现取复核 **7/7 YES**）

| 文件 | sha256 | blob == `dbccd89` |
|---|---|---|
| `frontend/src/App.jsx` | `b6033bf9a5f1fc5045f3980c633df335c4e62060c1ae585c16acf6963e9cd073` | **YES** |
| `frontend/src/utils.js` | `d48b70c321f3828a6cc8f992e9b96a752e385823a70c8152056dca0897857b31` | **YES** |
| `frontend/src/components/Footer.jsx` | `1ba767a696c96c4f3e7ce528ad492d724bc6d39682f0d8bf8b780d3c48e31c79` | **YES** |
| `frontend/src/test/unit/lang-path.test.js` | `eac1b8b975a4410804c6ff42c5fa4969746bef7fd9bfd3621558d92d18d7bb3d` | **YES** |
| `frontend/src/test/unit/lang-path-redirect.test.jsx` | `f9c1aa440367f982bb6efd19c592aea9b1397f48d9a006daeca026c1a49c59c4` | **YES** |
| `frontend/index.html`（红线·未动） | `c44388454902ab8f0ee99ffb74e33732d99230d128352cf5ba340d780cf5938f` | 未在改动面 |
| `frontend/src/components/Header.jsx`（未动） | `f96cab43ebeb8d2ebf38b3c6dc84a0ed7764bd07f8c14035e6ca374a750fb64c` | 未在改动面 |

**A.2 scratch 探针读数原件**（22 个文件 · 收口清理后仍在位 · `shasum -a 256`）

| # | 文件 | sha256 | 对应报告节 |
|---|---|---|---|
| 1 | `browser-new-A.json` | `85c30a595ae755b10828ef12f9f508d52a1009461e7da9e749b51ce34d30c8a9` | §2.2 A 段 |
| 2 | `browser-new-A2.json` | `82349666535ea5130d5d909d280f16ebcca89cb88386815d5a570ae45a6e7d4d` | §2.3 首版 A2 |
| 3 | `browser-new-A2B.json` | `f2c7698dc554f737fe500b827cbf73756c17c5df9abf8eaa71b9fa9516cd2cea` | §2.3 A2（含浮层前置） |
| 4 | `browser-new-CDEFG.json` | `1bb9cdc0c16b01e3d33d62f2a991e8156b11bea346b004389feae202f085563b` | §2.2 C / §2.5 D / §2.6 E·F / §2.10 G / **§2.13 改后列** |
| 5 | `browser-old-CDEFG.json` | `5cb9f3f9d6fc53867e881cb3107823bfe78909ae9e40253d7945d51e977d2a77` | **§2.13 改前列（`073c683` @5812）** |
| 6 | `build-dbccd89.log` | `bf389c6329f08a4f3a2d64f0f6880c5e66271c43145ca7a73f83adfe370c7c65` | §2.12 |
| 7 | `cdp_probe.py` | `9bf685c805e39b5f938a31284f8229f6d4ed54a7b1585746b9464748b0de27d5` | §2 探针本体 |
| 8 | `diag_a2.py` | `dd032629e608a6e7e21466a666a1a459d3c2f1fc534d2162ee6b461337bb51ee` | §2.3 诊断脚本 |
| 9 | `diag_after_load.py` | `0ae50c780ad967049e0ce3be91f339b46817d589c46aee94add6a5205b5e8495` | §2.3 / §2.9 诊断 |
| 10 | `diag_hover.py` | `5b4cd12c124cb96d0484b277dd570d9f856940b4fac265f4b5f5aa681a4d204b` | §2.9 浮层诊断 |
| 11 | `failset-test-full-baseline-073c683.txt` | `a1fb7db70db588f1000b85d449cdca6a8bd05b8e6529b31d977db0184c52ae52` | §2.8 失败集合（基线） |
| 12 | `failset-test-full-new.txt` | `a1fb7db70db588f1000b85d449cdca6a8bd05b8e6529b31d977db0184c52ae52` | §2.8 失败集合（新） |
| 13 | `neg1-baseline-worktree.log` | `69471e0de4649c8411d34e0c77e7de8a01fffc5192202b782577421b3c48dd56` | §3.1 基线 |
| 14 | `neg1-mutated.log` | `d21b93345d2c4ff37021bf01fbeeb26aeaa0959620f651150a5c5357f3fd481c` | §3.1 变异复跑 |
| 15 | `probe-func.mjs` | `fcc8c286f90395372b12e0e2a580f797bb9b1650ed673a889b6796a8bab06c43` | §2.11 |
| 16 | `probe-func-wrong-expectation.mjs` | `976e19155d700a1e521265dd7d39528010408a93ba99008d588bee97fd092528` | §2.11 诚实披露 1 |
| 17 | `probe-func.stderr.log` | `7b2a8009c4ad5c580f11e87e576c687f482bd88cfa1564abdd3b183920f4038a` | §2.11 |
| 18 | `raw-probe-func.json` | `53a2330d7944a195c4053f9f6352368ce5d1d99e9c57e63a01536aa6d09c10de` | §2.11（`check_fails=4` 原件） |
| 19 | `raw-probe-func-corrected.json` | `fb37300a9de837eac827f9c475d7e2504df5145c2273fe3b56b775ab6040fedc` | §2.11（`check_fails=0`） |
| 20 | `test-full-baseline-073c683.log` | `87ed68cbdae6a6c17b6b9ae6fba151e37e065bfcdb036dd5403963f019a1500f` | §2.8 |
| 21 | `test-full-new.log` | `222b210e13536e4a9a43800608141aab993233a6ca7374583d043fd6696999bd` | §2.8 |
| 22 | `test-two-new.log` | `7202ac84e67d735de94c8e6ca4874bb1ba3c78d5cd3ee822369b5c60a2d6d8f8` | §2.7 |

**A.3 佐证与已清理项**

- **#11 与 #12 sha256 完全相同**（`a1fb7db7…`）⇒ 失败集合**逐字节一致**，与 §2.8 的 `FAIL_SET_IDENTICAL=YES` 互相佐证。
- **已清理（§6.2）**：`chrome-profile/`（131M 的 Chrome headless 用户目录）—— 已 `rm -rf`，非读数原件。
- **已清理（§6.3）**：worktree `wt-073c683`、`wt-neg1` —— 已 `git worktree remove --force` ＋ `git worktree prune`；其内源码改动早已由 §3.1(b) 还原取证（`App.jsx` sha256 与 §0 逐字节相同）。
