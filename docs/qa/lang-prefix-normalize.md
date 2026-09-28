# 语言前缀规范化（连续切语言双重前缀空白页）· 独立质检报告（Neng）

> **出具方**：Neng（独立质检）。**不采信实现方自报**：本文件一切读数由本机自建探针现场落盘，逐条可核（附录 A）。
> **被检对象**：revision **`45c27d8`**（`fix(i18n): 语言前缀规范化，修连续切语言产生的双重前缀空白页`）的 7 个文件：
> `frontend/src/utils.js`、`frontend/src/App.jsx`、`frontend/src/components/Header.jsx`、
> `frontend/src/components/Footer.jsx`、`frontend/src/i18n.js`、
> `frontend/src/test/unit/lang-path.test.js`、`frontend/src/test/unit/lang-path-redirect.test.jsx`。
> **对锚**：revision **`969f4bd`**（`45c27d8` 的父提交）。
> **本件不改任何源码**：仅新增本报告文件 + scratch 临时探针。

| 项 | 值 |
|---|---|
| **开工时** `git log --oneline -1` | **`45c27d8 fix(i18n): 语言前缀规范化，修连续切语言产生的双重前缀空白页`**（提交时间 2026-09-28 07:55:38 +08:00） |
| 质检期间 HEAD 变化（**另行核验**） | **`073c683 master-plan v0.33: 5.28 P3 立项与拆解（P1/P2 已闭环）`**（2026-09-28 08:08:41 +08:00），**仅动 `docs/seafood.master-plan.md`** |
| 变化后一致性核验 | `45c27d8` 的 **7 个文件 blob 与 `073c683` 逐一相等**，且**工作区文件 blob == 两个 commit 的 blob**（7/7 SAME，见 §2.0）⇒ **我实测的字节 = 对锚 `45c27d8` 的字节 = 现 HEAD 的字节**，结论不因该 docs 提交失效 |
| 质检时刻 | **2026-09-28 07:59–08:13 CST**（原判读落盘）；**本单收口 08:14–08:20 CST**（补 NEG-2、清理、报告落盘） |
| 被检实例（真浏览器） | **new = `http://localhost:5787`**（面板托管的 seafood dev 实例，PID 43118，`[::1]:5787`）；**old = `http://localhost:5791`**（临时 vite，指向 `969f4bd` 临时 worktree） |
| 读数目录 | `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-lang/` |
| `npm run build`（frontend/） | **exit 0**（`build-new-45c27d8.log`，`BUILD_EXIT=0`） |
| **落盘时 HEAD** | **`073c683bc5b4758784f81e88183ccc300b5d3249`**（`main`），落盘时刻 **2026-09-28 08:19:16 CST** |
| **结论** | **可通过验收（PASS，带条件）** —— 9 项主判据全绿；**本报告只对 `45c27d8` 的 i18n 前缀修复生效**（生效范围见 §0）；四条已知条件见 §6 |

---

## 0. 生效范围声明（**先读这一条**）

1. **本报告的每一个判定都只对 revision `45c27d8` 成立。** 该 revision 的 7 个文件在 HEAD `073c683` 下仍**逐字节相同**（§2.0），所以读数在落盘时点依然对应盘上代码；但**一旦有后续提交改动这 7 个文件中的任何一个，本报告即失效**。
2. **本单之后有另一个子代理正在改 `frontend/src/App.jsx` 的路由（修「中文子页」P0）。** 该改动会触碰本 revision 的自愈/重定向壳（`45c27d8` 在 `App.jsx` 里新增的规范化重定向逻辑）。⇒ **路由壳重构完成后，本报告的「真浏览器 A/C 段」「NEG-1 防御层负控」「lang-path-redirect.test.jsx 14 条」三块必须回归复检**，不可直接沿用本报告结论。
3. 本报告**不覆盖**中文子页 P0 本身：那是另一条线，我既未测也未判。

---

## 1. 逐项判定（PASS / FAIL）

| # | 判定项 | 结果 | 证据（读数 / 路径） |
|---|---|---|---|
| 1 | **对锚成立**：旧版确由 `Header.changeLanguage` 产生双重前缀 | **PASS** | `raw-probe-old-969f4bd.json`：8 步连点 trace 中 **7 步 segs=2**（如 `/vn`→点 hk→`/hk/vn`），`click_sequence_final="/zh/vn"`；`blank_page_derivation.inner_matches_any_route=false` ⇒ 内层路由无匹配、`<main>` 空 ⇒ 空白页（§2.1） |
| 2 | **纯函数矩阵**（20 路径 × lang/strip/canonical/by_lang/idempotent） | **PASS** | `raw-probe-new-45c27d8.json`：`totals {rows:20, check_fails:0, explicit_fails:0, explicit_failing:[]}`；本单复跑 21 行 `check_fails:0`（§2.2） |
| 3 | **真浏览器 8 点击两轮**（起点 `/`，vn→hk→en→zh ×2） | **PASS** | `raw-browser-new-45c27d8.json` A 段 **0 / 8 违规**；对锚同源同序 **7 / 8 违规**（§2.3） |
| 4 | **query + hash 不丢** | **PASS** | B 段：`/hk/reward?x=1#y` 点 vn → `/vn/reward` 且 `search='?x=1' hash='#y'`；**对锚丢成 `search='' hash=''`**（§2.4） |
| 5 | **深链自愈**（直访脏前缀自动规范） | **PASS** | C 段 8 路径 **0 / 8 不匹配**（期望值由质检员自写 Python `canon()` 独立复算，见 `dump.py`）；对锚 **7 / 8 不匹配**（§2.5） |
| 6 | **无前缀路由不被误伤** | **PASS** | D 段 4 条：`/login`、`/register` 载入后 pathname 原样；`/dashboard`、`/dashboard/users` → `/login`（既有鉴权重定向）；**new 与 old 逐字段一致**（§2.6） |
| 7 | **语言完整性**（/hk、/vn 未被改坏） | **PASS** | E 段：`/hk` title `Seafood 海鮮市場｜幣圈人的跳蚤市場` / `html_lang=zh-HK` / flag `hk.svg`；`/vn` title `Seafood｜Chợ đồ cũ của dân crypto` / `html_lang=vi` / flag `vn.svg`；new == old（§2.7） |
| 8 | **删函数零引用**（`buildUrlWithLang`） | **PASS** | new `module_keys` **不含** `buildUrlWithLang`（old 含）；`grep -rn buildUrlWithLang` 全库（排除 `node_modules` / `dist` / master-plan 历史记录）**0 命中**（§2.9） |
| 9 | **测试与基线对照**（7 例既有失败与本次无关） | **PASS** | 新基线 `4 failed | 10 passed (14)`、`7 failed | 61 passed (68)`；旧基线 `4 failed | 8 passed (12)`、`7 failed | 33 passed (40)`；**FAIL 集合逐条完全相同**（§2.8） |
| 10 | **`npm run build` 可过** | **PASS** | `build-new-45c27d8.log`：1756 modules、`dist/index.html 4.64 kB`、**`BUILD_EXIT=0`**；唯一告警为 react-hot-toast 动静态混用（既有）（§2.10） |
| 11 | **判负自证 NEG-1**（App.jsx 自愈判据恒假） | **PASS** | `neg-control.log`：基线 28/28 → 变异 **6 failed / 22 passed**，红全部落在 `lang-path-redirect.test.jsx` 重定向相位，纯函数层 14 条仍绿（§3.1） |
| 12 | **判负自证 NEG-2**（`stripLangPrefix` 只剥一段）**本单补做** | **PASS（能抓出回归）** | 纯函数探针 `check_fails 0 → 12`（4/21 路径局部红）+ `no_double_prefix_after_strip=false`；交付方测试 `28/28 → 9 failed / 19 passed`；工作树未提交、逐字节还原（§3.2） |
| 13 | **清理闭环**（worktree / 5791 / 工作区脏文件） | **PASS** | 清理后 `git worktree list` 只剩主工作区；`lsof -nP -iTCP:5791` 无输出；`git status --porcelain` 仅 `?? docs/audit/`（**他方并发产物，未触碰**）（§7） |

**失败项：0。** 条件项 4 条见 §6，其中 1 条（D 段切语言子步骤未真正执行）为**探针自身限制**，非实现缺陷。

---

## 2. 原始读数（run-tagged）

### 2.0 HEAD 变化后的字节一致性核验

```
git diff --name-only 45c27d8 073c683
  → docs/seafood.master-plan.md          （唯一变更文件，纯 docs）

7/7 blob 相等（对 7 个被检文件逐一 git rev-parse {45c27d8,073c683}:<path> 与 git hash-object <path> 三方比对）
  SAME 1f1cf0a9208bc133f714838dc958d6f0f3b4e732 frontend/src/App.jsx
  SAME 395d413da4bcffdcd449da6b82c6e72c9a8da472 frontend/src/components/Footer.jsx
  SAME bb1da0f899add7cfc4d1b17a955fd0c02340f5d8 frontend/src/components/Header.jsx
  SAME 88e408b0dc808e12c4a4058ce28664da87cd8a53 frontend/src/i18n.js
  SAME cf928925c01b6eb74a785a5e6fdcdc60f306661a frontend/src/test/unit/lang-path-redirect.test.jsx
  SAME 419533fc0eeaf90f5a4c1daa357de37b21542832 frontend/src/test/unit/lang-path.test.js
  SAME 9b14f02280a540956b69dba2d28e722133ba0034 frontend/src/utils.js
```

**语料文件 sha256（落盘时点、`main` 工作区实测）**

```
1ab6086975143b17cda4bd61f86abedac2292ac8627881d82b43b1e66fec7f51  frontend/src/App.jsx
bcc18cbda08f946ef0a911036ba833724533b65996e9da309fd9f7ca7e85ed6e  frontend/src/components/Footer.jsx
f96cab43ebeb8d2ebf38b3c6dc84a0ed7764bd07f8c14035e6ca374a750fb64c  frontend/src/components/Header.jsx
97b316d8d3f3628cc8927d968ec53ac3d460c2c84256e1454911c3bd28b58d50  frontend/src/i18n.js
aff32da24a9fe41f84634ac6775d704e6d3040d44805d7ad463b96cde633a266  frontend/src/utils.js
017a89481273ae6480fc965df76adba76351844b76ff4a2debd66077175f87e9  frontend/src/test/unit/lang-path.test.js
4540a462d2a0289b2552ac2d97030fa324b6f3a72d828a30dadcd71ac39058f0  frontend/src/test/unit/lang-path-redirect.test.jsx
```

> 注：真实浏览器 new 实例（5787）是**长驻 dev server**，其请求时按磁盘内容即时 transform；配合上表 blob 三方相等，可确认 08:08 的浏览器实测字节即 `45c27d8` 字节。

### 2.1 对锚 `969f4bd`（函数层）

`raw-probe-old-969f4bd.json`

```
module_keys(16) = buildUrlWithLang, cn, debounce, formatDate, formatEvmAddress, generateId,
                  getLanguageFromUrl, getUserFromStorage, isAdmin, isLoggedIn, isValidEvmAddress,
                  removeUserFromStorage, saveUserToStorage, showErrorToast, showSuccessToast, throttle
                  （无 SUPPORTED_LANGS / stripLangPrefix / buildLangPath / canonicalLangPath）
old_header_get_current_lang_of_hkvn = "hk"      ← 旧 getCurrentLang 只看首位段 ⇒ 误判
click_sequence_trace（8 步，起点 '/'）:
  1 /            点 vn → /vn          segs=1
  2 /vn          点 hk → /hk/vn       segs=2   ← 双重前缀诞生
  3 /hk/vn       点 en → /en/vn       segs=2
  4 /en/vn       点 zh → /zh/vn       segs=2
  5 /zh/vn       点 vn → /vn/vn       segs=2
  6 /vn/vn       点 hk → /hk/vn       segs=2
  7 /hk/vn       点 en → /en/vn       segs=2
  8 /en/vn       点 zh → /zh/vn       segs=2
click_sequence_final = "/zh/vn"        double_prefix_rows = 7 条（segs=2）
blank_page_derivation:
  bad_url=/hk/vn   内层 remainder="vn"   内层路由集合=[index,reward,task,shard,profile]
  inner_matches_any_route=false ⇒ 内层 <Routes> 无匹配 ⇒ <main> 渲染为空；外层 Header/Footer 仍在
old_build_path_samples:  (zh,'')→'/'   (vn,'')→'/vn/'   (vn,'reward')→'/vn/reward'
buildUrlWithLang_matrix（5 行，节选）: /vn + en → '/en/vn'（叠加而非替换）
```

### 2.2 纯函数矩阵（新 revision）

`raw-probe-new-45c27d8.json`（20 路径）

```
module_keys(19) = SUPPORTED_LANGS, buildLangPath, canonicalLangPath, cn, debounce, formatDate,
                  formatEvmAddress, generateId, getLanguageFromUrl, getUserFromStorage, isAdmin,
                  isLoggedIn, isValidEvmAddress, removeUserFromStorage, saveUserToStorage,
                  showErrorToast, showSuccessToast, stripLangPrefix, throttle
totals = {"rows": 20, "check_fails": 0, "explicit_fails": 0, "explicit_failing": []}
explicit（9 条硬断言，全 true）:
  lang_whitelist                       = ["zh","en","hk","vn"]
  root_to_zh_is_slash / not_double_slash / not_zh_prefix        = true / true / true
  trailing_slash_removed_vn_reward / trailing_slash_removed_hk_root = true / true
  dashboard_never_prefixed_by_canonical / login_register_never_prefixed = true / true
  no_double_prefix_after_strip         = true
关键行（actual）:
  /hk/vn     lang=hk  strip=''      canonical=/hk        by_lang={zh:/,en:/en,hk:/hk,vn:/vn}
  /en/en     lang=en  strip=''      canonical=/en        idempotent=true
  /zh        lang=zh  strip=''      canonical=/          （/zh 收敛回根）
  /vn/reward/ lang=vn strip='/reward/' canonical=/vn/reward   （尾斜杠去掉）
  /dashboard lang=zh  strip=/dashboard canonical=/dashboard   （无前缀路由未被强加前缀）
  //         lang=zh  strip='//'    canonical=/
```

**本单复跑（`raw-probe-neg2-main.json`，21 路径——多一条 `/zh/en/hk/vn`）**

```
totals = {"rows": 21, "check_fails": 0, "explicit_fails": 0, "explicit_failing": []}
与上轮 raw-probe-new-45c27d8.json 的 20 条共有路径：actual / checks 逐条完全一致（差异 0 条）
  （唯一差异是上轮采了 module_keys、本复跑探针未采该字段，与本判定无关）
/zh/en/hk/vn  lang=zh strip='' canonical='/' by_lang={zh:/,en:/en,hk:/hk,vn:/vn}   （多段前缀一次剥尽）
```

### 2.3 真浏览器 · A 段（8 点击 = 两轮四语）

`raw-browser-new-45c27d8.json`（`base=http://localhost:5787`，`run=2026-09-28 08:08:04 CST`，Chrome）
`raw-browser-old-969f4bd.json`（`base=http://localhost:5791`，`run=2026-09-28 08:09:53 CST`，同款 Chrome）
判据（质检员自写，见 `dump.py`）：每步 **`pathname == canon(pathname)` 且 `<main>` 文本非空**。

| 步 | 点击 | **new** pathname / segs / main_len | **old** pathname / segs / main_len |
|---|---|---|---|
| 1 | vn | `/vn` / [vn] / **81** | `/vn` / [vn] / **81** |
| 2 | hk | `/hk` / [hk] / **81** | `/hk/vn` / [hk,vn] / **0** |
| 3 | en | `/en` / [en] / **81** | `/en/vn` / [en,vn] / **0** |
| 4 | zh | `/` / [] / **81** | `/zh/vn` / [zh,vn] / **0** |
| 5 | vn | `/vn` / [vn] / **11** | `/vn/vn` / [vn,vn] / **0** |
| 6 | hk | `/hk` / [hk] / **11** | `/hk/vn` / [hk,vn] / **0** |
| 7 | en | `/en` / [en] / **81** | `/en/vn` / [en,vn] / **0** |
| 8 | zh | `/` / [] / **81** | `/zh/vn` / [zh,vn] / **0** |

```
new: A 段违规数 = 0 / 8 步
old: A 段违规数 = 7 / 8 步        （第 1 步 /vn 本来正确，其余 7 步全部 segs=2 且 main_len=0）
```

**诚实注记**：new 的第 5、6 步 `main_text_len=11`，正文首段为 `正在加载精彩内容...`（其余步为 81）。判据是「**非空**」，11 > 0 ⇒ 判 PASS；但这说明此时 `<main>` 处于**加载占位帧**。用户可感知时延未量化，列入 §6。

### 2.4 query + hash（B 段）

```
new: 手工载入 /hk/reward?x=1#y  →  [landed] pathname=/hk/reward search='?x=1' hash='#y' main_len=82
     再点 vn                   →  pathname=/vn/reward search='?x=1' hash='#y' main_len=82   ← 保留
old: 手工载入 /hk/reward?x=1#y  →  [landed] pathname=/hk/reward search='?x=1' hash='#y' main_len=82
     再点 vn                   →  pathname=/vn/reward search=''      hash=''      main_len=82   ← 丢
```

### 2.5 深链自愈（C 段，8 路径直访）

期望 = `dump.py` 里质检员**自写**的 Python `canon()` 独立复算（非转述 JS 结果）。

| 直访 | new 落点 | 独立复算期望 | new | old 落点 | old |
|---|---|---|---|---|---|
| `/hk/vn` | `/hk` | `/hk` | **OK**（main 81） | `/hk/vn` | **MISMATCH**（main 0） |
| `/zh` | `/` | `/` | **OK**（81） | `/zh` | **MISMATCH**（main 11） |
| `/en/en` | `/en` | `/en` | **OK**（81） | `/en/en` | **MISMATCH**（main 0） |
| `/vn/reward/` | `/vn/reward` | `/vn/reward` | **OK**（82） | `/vn/reward/` | **MISMATCH** |
| `/zh/reward` | `/reward` | `/reward` | **OK**（81） | `/zh/reward` | **MISMATCH** |
| `/en/` | `/en` | `/en` | **OK**（81） | `/en/` | **MISMATCH** |
| `/vn//` | `/vn` | `/vn` | **OK**（81） | `/vn//` | **MISMATCH** |
| `/reward` | `/reward` | `/reward` | **OK**（81） | `/reward` | OK（对照：本来就对） |

```
new: C 段不匹配数 = 0 / 8        old: C 段不匹配数 = 7 / 8
```

### 2.6 无前缀路由（D 段，防误伤）

| 请求 | new 载入后 pathname | old 载入后 pathname | 说明 |
|---|---|---|---|
| `/login` | `/login` | `/login` | 未被强加语言前缀（new==old） |
| `/register` | `/register` | `/register` | 同上 |
| `/dashboard` | `/login` | `/login` | 鉴权重定向（既有行为，非本次引入） |
| `/dashboard/users` | `/login` | `/login` | 同上 |

`main_text_len=-1` 表示这两个鉴权页**不存在 `<main>` 元素**（非空判据不适用），`body_innerText_len` 306/300/306/306 **new 与 old 逐字相同**。
**探针限制（如实标注）**：D 段每条的「载入后尝试切 en」子步骤**全部未能执行**，首因 `{"attempt":0,"trigger":{"err":"no #header"}}`（鉴权页无 `#header`，语言菜单不存在）⇒ **「无前缀路由下切语言」这一子情形本轮未被真正验证**，已列入 §6。

### 2.7 语言完整性（E 段，判「没被改坏」）

| 语言 | title | html_lang | flag | nav |
|---|---|---|---|---|
| `/hk` | `Seafood 海鮮市場｜幣圈人的跳蚤市場` | `zh-HK` | `/src/images/hk.svg` | `["社區獎勵","社區任務","shard"]` |
| `/vn` | `Seafood｜Chợ đồ cũ của dân crypto` | `vi` | `/src/images/vn.svg` | `["Phần thưởng","Nhiệm vụ","shard"]` |

**new 与 old 在 E 段逐字段一致**（仅 `body_innerText_len` 有 295/296 一类 ±1 的无关抖动）⇒ 本次改动**未改坏**既有语言呈现。

**控制台对照**：new / old 两侧 `exceptions` 均为 **0**；`console_msgs` 均为 **60** 条，分布同为 `warning 31 / debug 14 / info 7 / log:error 6 / error 2`。其中 `log:error` 6 条为 `/src/auth.js` 的 500（**临时/托管实例均未挂后端**，环境噪声，两侧同因）。

### 2.8 测试与基线对照

```
test-new-two.log   （仅两个新测试文件，主工作区）
  ✓ src/test/unit/lang-path.test.js            (14 tests) 
  ✓ src/test/unit/lang-path-redirect.test.jsx  (14 tests)
  Test Files  2 passed (2)      Tests  28 passed (28)

test-new-full.log  （全量，主工作区 / 45c27d8）
  Test Files  4 failed | 10 passed (14)
       Tests  7 failed | 61 passed (68)
test-old-full.log  （全量，对锚 969f4bd worktree）
  Test Files  4 failed |  8 passed (12)
       Tests  7 failed | 33 passed (40)
```

**7 例失败逐条相同（diff 结果：FAIL 集合完全一致，`FAIL_SET_IDENTICAL`）**

```
FAIL src/test/components/Card.test.jsx > Card Components > renders Card with default props
FAIL src/test/components/Card.test.jsx > Card Components > renders Card with different variants
FAIL src/test/components/Card.test.jsx > Card Components > renders CardHeader
FAIL src/test/components/Card.test.jsx > Card Components > renders CardTitle
FAIL src/test/components/Card.test.jsx > Card Components > renders CardContent
FAIL src/test/components/Card.test.jsx > Card Components > applies hover effect when enabled
FAIL src/test/performance/VirtualList.test.jsx > VirtualList Performance > updates visible items on scroll
```

```
另有 2 个「收集失败」文件（两侧相同，非本改动引入）：
  src/test/accessibility/Accessibility.test.jsx  → esbuild: Accessibility.test.jsx:202:13 ERROR: Expected ")" but found "id"
  src/test/e2e/basic.spec.js                     → Playwright Test did not expect test.describe() to be called here
```

**读法**：新基线比旧基线**多 2 个测试文件**（14 vs 12），即本次新增的 `lang-path.test.js` + `lang-path-redirect.test.jsx`，这两个文件 **28/28 全绿**；而**既有失败 7 例一条不多一条不少**，且失败文件集合一致 ⇒ **这 7 例与本次 i18n 改动无关**（其原因是 Card 组件类名断言与 VirtualList 滚动断言，属既有问题/环境）。

### 2.9 删函数零引用

```
new module_keys 不含 buildUrlWithLang（old 含）          ⇒ 函数已删
grep -rn "buildUrlWithLang" frontend/src                 → 0 命中
grep -rn "buildUrlWithLang" 全库（--include js/jsx/ts/tsx/html/md，排除 node_modules 与 frontend/dist）
                                                         → 0 命中
（docs/seafood.master-plan.md 中亦 0 命中）
```

### 2.10 `npm run build`

`build-new-45c27d8.log`（frontend/，退出码取自 npm 进程本身，不经管道）

```
vite v5.4.20 building for production...
✓ 1756 modules transformed.
[plugin:vite:reporter] (!) .../react-hot-toast/dist/index.mjs is dynamically imported by
    src/utils.js, src/utils.js but also statically imported by 18 个文件, dynamic import will not move module into another chunk.
rendering chunks...
computing gzip size...
dist/assets/hk-DJjlsSdH.svg       4.61 kB │ gzip:   2.01 kB
dist/index.html                   4.64 kB │ gzip:   2.30 kB
dist/assets/us-BUggRluv.svg       7.87 kB │ gzip:   1.24 kB
dist/assets/index-Dmk27wGY.css   48.70 kB │ gzip:  10.85 kB
dist/assets/index-C6psSxcx.js   423.05 kB │ gzip: 124.07 kB
✓ built in 2.27s
BUILD_EXIT=0
```

唯一告警是 react-hot-toast 的动/静态混用 chunking 提示，**属既有构建告警，与本次改动无关**。

---

## 3. 判负自证（negative control）

### 3.1 NEG-1（上轮已做）：把 `App.jsx` 的自愈判据改成恒假

`neg-control.log`（临时 worktree `wt-45c27d8-neg` @ `45c27d8`）

```
--- 0) 基线（未改任何东西） ---        Test Files 2 passed (2)      Tests 28 passed (28)
--- 1) 负控 A：App.jsx 自愈判据 → if (false && ...) ---
    ❯ src/test/unit/lang-path-redirect.test.jsx  (14 tests | 6 failed)
    Test Files  1 failed | 1 passed (2)      Tests  6 failed | 22 passed (28)
    失败 6 条：
      把 /hk/vn 自愈为 /hk 并渲染主体内容
      把 /en/en 自愈为 /en 并渲染主体内容
      把 /zh 自愈为 / 并渲染主体内容
      把 /zh/reward 自愈为 /reward，主体不再是空白
      把 /vn/reward/ 自愈为 /vn/reward 并渲染主体内容
      重定向时保留 query 与 hash
```

**判定**：能抓出回归，且**分层可分辨**——红全部落在 `lang-path-redirect.test.jsx`（防御层/重定向相位），纯函数层 `lang-path.test.js` 14 条**仍全绿**。说明该套件对「壳被拆」有分辨力，非同义反复。

### 3.2 NEG-2（**本单补做**）：`stripLangPrefix` 只剥一段（`while` → `if`）

**做法（合规）**：在**临时 worktree**（`git worktree add --detach ... 45c27d8`）内改 `frontend/src/utils.js`，**主工作区源码零改动**、**未 commit**。

变异（worktree 内 `git diff --stat` → `frontend/src/utils.js | 3 ++-`，1 file changed, 2 insertions(+), 1 deletion(-)）：

```diff
   const parts = (pathname || '/').split('/')
   let index = 1
-  while (index < parts.length && SUPPORTED_LANGS.includes(parts[index])) {
+  if (index < parts.length && SUPPORTED_LANGS.includes(parts[index])) {   // 只剥一段
     index += 1
   }
```

**(a) 我的纯函数探针读数**（`probe-neg2.mjs`，期望与上轮 `probe-new.mjs` 逐字同源）

```
                                基线(45c27d8 原始)          变异(只剥一段)
totals.check_fails              0                          12
totals.explicit_fails           0                           1
explicit_failing                []                          ["no_double_prefix_after_strip"]
受影响路径数                     —                           4 / 21
```

逐路径（只列变红者，其余 17 条**逐字段不变**）：

| 路径 | 基线 strip / canonical | 变异 strip / canonical | 变红断言 |
|---|---|---|---|
| `/hk/vn` | `''` / `/hk` | `'/vn'` / `/hk/vn` | strip, canonical, by_lang |
| `/en/en` | `''` / `/en` | `'/en'` / `/en/en` | strip, canonical, by_lang |
| `/hk/vn/reward` | `'/reward'` / `/hk/reward` | `'/vn/reward'` / `/hk/vn/reward` | strip, canonical, by_lang |
| `/zh/en/hk/vn` | `''` / `/` | `'/en/hk/vn'` / `/en/hk/vn` | strip, canonical, by_lang |

**未受影响**（保持绿）：`/`、`/vn`、`/hk`、`/zh`、`/en/`、`/zh/`、`/reward`、`/zh/reward`、`/vn/reward`、`/vn/reward/`、`/dashboard`、`/dashboard/users`、`/login`、`/register`、`/en?q=1#h`、`//`、`/vn//`。
⇒ **是局部红，不是整体红**：变异恰好复现了原 P0 的成因（两段前缀不再被剥尽），且 `idempotent` 因变异自洽而仍为 true（说明**单看 idempotent 抓不出这个回归**，必须靠 strip/canonical/by_lang 三组断言）。

**(b) 交付方测试读数**（worktree 内 `npx vitest run` 两个文件）

```
neg2b-tests-baseline.log      Test Files  2 passed (2)                 Tests 28 passed (28)
neg2b-tests-single-strip.log  Test Files  2 failed (2)                 Tests  9 failed | 19 passed (28)
    ❯ src/test/unit/lang-path.test.js            (14 tests | 6 failed)
        stripLangPrefix > 剥离所有前导语言段，返回剩余路径
        stripLangPrefix > 多个语言段会被一次剥掉
        buildLangPath   > 先剥离再按目标语言重建，不产生双重前缀与尾斜杠
        buildLangPath   > 每个路径 × 每个目标语言的重建结果
        canonicalLangPath > 返回规范路径用于判定是否重定向
        canonicalLangPath > 裁定口径给出的六个样例
    ❯ src/test/unit/lang-path-redirect.test.jsx  (14 tests | 3 failed)
        把 /hk/vn 自愈为 /hk 并渲染主体内容
        把 /en/en 自愈为 /en 并渲染主体内容
        重定向时保留 query 与 hash
```

**(c) 逐字节还原取证**

```
neg2b-utils.sha256.pre.txt     27140a94a29760b419efa8f78567a1cf180900ec6fa17280521ef224ee5e8f01
neg2b-utils.sha256.post.txt    27140a94a29760b419efa8f78567a1cf180900ec6fa17280521ef224ee5e8f01   ← 相等 ⇒ BYTE_IDENTICAL_RESTORED
（两文件内记录的目标 sha256 均为 aff32da24a9fe41f84634ac6775d704e6d3040d44805d7ad463b96cde633a266
  ＝ §2.0 语料表里 utils.js 的 sha256）
neg2b-utils.sha256.mutated.txt 32a82b972bc79ad0b879ba33d513397381cbc219002352a7b075c38a621644f5
  （内容记录的变异后 sha256 = 661f68ba3d105d88449118c880c5584bf80b0ea38ab4ee2121c8cc06faa0aed3）
还原后复跑探针 raw-probe-neg2-post-restore.json → check_fails 0（与基线逐字段相等）
变异探针两次独立运行 raw-probe-neg2-single-strip.json 与 ...-rerun.json → actual 全等（可复现）
```

**NEG-2 判定：能抓出回归。** 我的探针（12 条断言 + 1 条显式硬断言）与交付方测试（9 条用例）**同时变红**，且两侧都是**局部红**；同时**未能被 `idempotent` 单独捕获**——这一点已如实记录，提醒后续不要依赖单一自洽性断言。

---

## 4. 判定口径的自证与「期望写错」的诚实披露（对应交付项 ③）

探针的价值全在**期望值是不是独立、正确的**。此处把两类「假红」情况分开写清楚。

### 4.1 上一轮的 4 条期望写错（**据实标注：无盘上物证**）

任务书载明：上一轮我首跑时有 **4 条期望写错，随后修正**。我必须如实说明证据状态：

- **盘上可核的部分**：上一轮首跑确有失败痕迹——`raw-probe-new-20260928T000053Z.json` 与 `raw-probe-old-20260928T000053Z.json` 均为 **0 字节**（08:00），而修正后的探针产物为 `raw-probe-new-45c27d8.json`（08:02，`check_fails=0`）；`probe-new.mjs` 源码头注释亦自述「期望值由质检员独立拟定后写死在此」。
- **盘上不可核的部分**：**那 4 条具体是哪 4 条路径、错成什么样，scratch 里没有任何物证**（首跑产物是 0 字节，未落盘中间态）。**我不编造这 4 条的内容。**
- 可确认的**性质**：那 4 条最终被判定为**我的期望写错**而非实现错——依据是同一 revision 下，逐条与「源码语义 + `dump.py` 里独立 Python `canon()`」三方比对后收敛，且收敛后的 `explicit` 9 条硬断言全绿。

**这是本报告最弱的一环，如实置于此处供复核。**

### 4.2 本单新发生的一起同类事件（**有盘上物证，可复现**）

本单首跑 `probe-neg2.mjs` 时，我为新增路径 `/zh/en/hk/vn` 写的期望是错的（我按「只剥到首个非语言段」写，实际语义是「**剥尽所有前导语言段**」）。当次读数为 `check_fails = 3`，我**先把它判为期望错误而非实现错误**并修正。

为留下可核物证，我把那份**错误期望原样保留**成独立探针 `probe-neg2-wrong-expectation.mjs`（**源码未改，仅期望写错**），实测：

```
raw-probe-neg2-wrong-expectation.json   （utils.js = 主工作区 45c27d8 原始字节，sha256 aff32da2…）
totals = {"rows": 21, "check_fails": 3, "explicit_fails": 0, "explicit_failing": []}
  [/zh/en/hk/vn] 我写错的期望 strip='/en/hk/vn' canon='/en/hk/vn'
                 实际         strip=''        canon='/'        failed=['strip','canonical','by_lang']
explicit 9 条硬断言仍全绿 = true
```

**这条自证说明三件事**：(i) 探针**不是恒真探针**——期望写错会真变红；(ii) 错误期望的红是**逐条可定位**的（3 条断言全部落在该条路径），可与实现错的红区分；(iii) 我的**纠错依据**是源码语义 + 独立复算，不是「迁就实现」。

---

## 5. 可否验收意见

**可以验收（PASS，带条件）。** 只对 `45c27d8` 有效（§0）。

1. **同类问题已闭环**：真浏览器 A 段 **0/8 违规**（对锚 7/8）、C 段深链自愈 **0/8 不匹配**（对锚 7/8）、`/hk/vn` 类双重前缀不再出现（`no_double_prefix_after_strip=true`）。
2. **无回归**：E 段语言呈现 new==old；D 段无前缀路由未被误伤；query+hash **由丢变保**（附带改好）。
3. **判负自证两条都成立**（NEG-1 壳层 6 红、NEG-2 函数层 12 红 + 9 用例红），且都是**局部红**⇒ 排除了「恒真探针」。
4. **改动面受控**：`buildUrlWithLang` 已删且全库零引用；新增 2 个测试文件 28/28 全绿；既有 7 例失败与本次无关（失败集合逐条相同）。
5. **发行路径可用**：`npm run build` **exit 0**。

**条件（不构成阻塞，但必须随行）**：§6 第 1 条（**另一子代理正在改 `App.jsx` 路由 ⇒ 路由壳重构后本报告三块内容必须回归复检**）为**最强条件**；其余为探针/环境限制。

---

## 6. 未验证清单（明确「我没验」的部分）

| # | 未验证项 | 说明 | 风险 |
|---|---|---|---|
| 1 | **路由壳重构后的行为**（本单之后另一子代理正在改 `App.jsx` 修中文子页 P0） | 本报告全部读数仅对 `45c27d8` 有效；**`App.jsx` 一旦再改，A/C 段、NEG-1、`lang-path-redirect.test.jsx` 三块结论失效** | **中–高（必须回归复检）** |
| 2 | **D 段「无前缀路由下切语言」** | 4 条路由的 `switch_en` 子步骤**全部未执行**，首因 `no #header`（鉴权页无语言菜单）⇒ 该子情形未被真正验证 | 中（探针自身限制） |
| 3 | **A 段第 5/6 步的加载占位帧** | `main_text_len=11`、正文 `正在加载精彩内容...`；判据「非空」通过，但**未量化**该帧时长与用户可感知性 | 低 |
| 4 | **Firefox / WebKit** | 全程仅 Chrome（`/Applications/Google Chrome.app`）；未跑 Gecko/WebKit | 低 |
| 5 | **挂后端时的行为** | 两侧实例均未挂后端（`/src/auth.js` 6 条 500 + 2 条 error）；**未验证**有后端时前缀/自愈行为是否变化（理论上无关） | 低 |
| 6 | **`dist/` 产物在真实服务器上的行为** | 只验证了 build 可过并产出；**未部署**、未跑生产 CSP/缓存复验 | 低 |
| 7 | **官方 E2E（`npm run test:e2e` / Playwright）** | 本轮未跑该套件（另有 `playwright.config.js` 的 baseURL 复用风险，详见 `docs/qa/title-i18n.md` §3） | 中（测试基建） |
| 8 | **NEG-2 只在函数层 + jsdom 层做** | **未**在真浏览器层做 `stripLangPrefix` 单段负控（需要再造一个变异 dev server） | 低 |
| 9 | **上一轮那 4 条写错期望的具体内容** | scratch 无物证，见 §4.1；**不编造** | 低（影响可追溯性，不影响新 revision 的判定） |
| 10 | **5787 长驻 dev server 的 HMR 中间态** | 读取时按磁盘即时 transform；**未**验证热更新过程中（半更新状态）前缀行为 | 低 |
| 11 | **本件未做的动作（合规声明）** | 未改任何源码；未 commit / 未 push；未启停 5787/5788 面板服务；未触碰 `docs/audit/`（他方并发产物）与 `backend-ts/**` | — |

---

## 7. 清理取证与欠账（对应交付项 ②③ 的收口）

### 7.1 `git worktree`

```
########## 清理前（2026-09-28 08:14 CST 前后）##########
/Users/kevin/bistro/seafood                                              073c683 [main]
/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-lang/wt-45c27d8-neg  45c27d8 (detached HEAD)
/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-lang/wt-969f4bd      969f4bd (detached HEAD)

  另有残留未跟踪符号链接：
  wt-45c27d8-neg/frontend/node_modules -> /Users/kevin/bistro/seafood/frontend/node_modules
  （`git -C wt-45c27d8-neg status --porcelain` → `?? frontend/node_modules`；App.jsx 等已还原，无 diff）

########## 执行 ##########
$ git worktree remove --force /Users/kevin/.hermes/profiles/zang/cache/scratch/qa-lang/wt-969f4bd      rc=0
$ git worktree remove --force /Users/kevin/.hermes/profiles/zang/cache/scratch/qa-lang/wt-45c27d8-neg rc=0
$ git worktree prune                                                                                  rc=0
（NEG-2 期间新建的临时 worktree wt-neg2b @45c27d8 亦已 remove --force，rc=0）

########## 清理后 ##########
/Users/kevin/bistro/seafood  073c683 [main]                 ← 只剩主工作区
$ ls -d .../qa-lang/wt-*      → No such file or directory   ← scratch 无 worktree 残留
$ ls .git/worktrees           → (.git/worktrees 不存在)
```

### 7.2 5791 临时 vite

```
清理前：lsof -nP -iTCP:5791        → (无输出)
清理前：pgrep -fl 5791             → (无输出)
清理后：lsof -nP -iTCP:5791        → (无输出)
```

**判定：5791 端口的临时 vite 早已终止，端口无监听 ⇒ 本单未发出任何 `kill`/`pkill`/`killall`。**

同时确认**未误伤面板托管服务**：

```
PID 43118  node .../seafood/frontend/node_modules/.bin/vite   （父 42891 = `npm run dev`，起于 2026-09-27 12:11:08）
           → 监听 [::1]:5787   ← 即本报告 new 侧被检实例，**保持运行、未触碰**
PID 45770  → 监听 *:5788（面板另一实例），未触碰
```

### 7.3 主仓库工作区状态

```
清理前：git status --porcelain →  ?? docs/audit/
清理后：git status --porcelain →  ?? docs/audit/
```

`docs/audit/` 是**本单开始后由另一并发子代理新写入的未跟踪目录，不是我的产物，我未读取、未修改、未删除**。
**除它之外没有任何脏文件**：我本单只新增 `docs/qa/lang-prefix-normalize.md` 与 scratch 探针，**未改任何源码**。`git worktree list` 只剩主工作区；未 commit、未 push。

### 7.4 剩余未完成项（如实列出）

| # | 项 | 状态 |
|---|---|---|
| 1 | **NEG-2 的真浏览器层变体** | **未做**（只在函数层 + jsdom 层做了；见 §6 第 8 条） |
| 2 | **上一轮 4 条写错期望的具体内容** | **无法补齐**（scratch 无物证，不编造；见 §4.1） |
| 3 | **中文子页 P0** | **不属于本单**，由另一子代理进行中；其路由壳改动后本报告需回归复检（见 §0） |
| 4 | 其余 §6 各条（Firefox/WebKit、挂后端、E2E 套件、产物部署） | 未做，已逐条标注 |

### 7.5 观察项（非本单产物，未处置）

```
PID 1020  `npm test`（cwd=/Users/kevin/bistro/seafood/frontend，父 1002 `npm test`，起于 2026-09-28 08:14:36）
          → 其子 vitest 监听 *:24678
```
该进程**不是本单启动的**（本单的 vitest 全部用 `npx vitest run` 且已正常退出），无法归因，**故未处置**，仅记录待他方确认。

---

## 附录 A · 读数文件清单（全部位于 `/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-lang/`）

| 文件 | 用途 | sha256（落盘时） |
|---|---|---|
| `raw-probe-new-45c27d8.json` | 主纯函数矩阵 20 行、0 失败 | `a5cee8072f657f228d853366374d08b6e9ac58b3748aa150457a8b323da5dff9` |
| `raw-probe-old-969f4bd.json` | 对锚 `969f4bd` 函数层 + 旧 Header 复刻 + 空白页推导 | `f3bd0bdf77ff5d528ecd5151d1c31eb55224ad4892d202dbde07e46c0c355f9d` |
| `raw-probe-neg2-baseline.json` | **本单** NEG-2 基线（neg worktree，21 行 0 失败） | `b38a9ddf43d01cefafa2c11c132207e8dbc28c2b3577e628c359926ce423dd54` |
| `raw-probe-neg2-main.json` | **本单** 主工作区复跑（与上轮 20 行逐条一致） | `5db6c8420a5780f36307706779a69827678b4c61063ef3df132d47f5cecd520e` |
| `raw-probe-neg2-single-strip.json` | **本单** NEG-2 变异读数（12 条断言红） | `e71ed7f63b0d8036baeb183b93ce8e45c78beee85836007b31fcef9f3da7cafd` |
| `raw-probe-neg2-single-strip-rerun.json` | **本单** 变异读数独立复现（与上条 actual 全等） | `acdbbf89e3a7c67a18ab1008ae335daa8b574347fbdeeb9f85ca368aee9dbe3e` |
| `raw-probe-neg2-post-restore.json` | **本单** 还原后复跑（0 失败） | `28b53b5e27d811090108aab63f3c75468ea0967190b47835d4e2ea8b1499cf6e` |
| `raw-probe-neg2-wrong-expectation.json` | **本单** §4.2 错误期望自证（3 条假红） | `aa9cc9cecfd54337fcc9223f1197c1fca06c9e696b2a4650afb3f7ee13e9f53c` |
| `raw-browser-new-45c27d8.json` | 真浏览器主读数（5787） | `cfc93b702cf6f2ab440febf779d031b34de2de554ed2ad8c6c92a16888943af9` |
| `raw-browser-old-969f4bd.json` | 真浏览器对锚读数（5791） | `b8a8788d7ef47ac6cc12f24d2bb40d3c0dc3ce051bb38cdf5d5e6d67168a1cb2` |
| `raw-browser-new-45c27d8.dump.txt` | 上条的人类可读摘要（含独立复算判定） | `eda306caaf513a0df62fe37014e2f5c97bd3fcdaa704de4dcef1a1d6c0b972f8` |
| `raw-browser-old-969f4bd.dump.txt` | 同上的对锚摘要 | `2863abc2d0b42a6b7355a65d31a36a2cb8c6ebdffb95f907c8bf8bb49a556c0f` |
| `test-new-two.log` | 新增 2 个测试文件 28/28 | `157e0a5aa5dae52171693465c5a75b63229a56b32fe23e851e13a066c9d9016f` |
| `test-new-full.log` | 新基线全量（4 failed / 7 failed） | `19649235864519e2f3dde83e47db18643acdfdd97fc5dff3c6f573a502f0e409` |
| `test-old-full.log` | 旧基线全量（4 failed / 7 failed，集合相同） | `6066a0b4e1ee7b2fe8a2f06cd08596fb89dd839e6c21590ba8e08e751b48a7b9` |
| `neg-control.log` | NEG-1（App.jsx 恒假）基线+变异 | `4d678e020c7f91b1af869e0858e96acf618bd379cae9634c62c2d30b07e31790` |
| `neg2b-tests-baseline.log` | **本单** NEG-2 交付方测试基线 28/28 | `eae31c354043ba7d1b8131ca76db1f77ca702b6a1376b400e146322bb24c1487` |
| `neg2b-tests-single-strip.log` | **本单** NEG-2 交付方测试变异 9 failed / 19 passed | `038af730e5959a6cbc232823cf529ab13daf704681f0b2557046e131a7429787` |
| `build-new-45c27d8.log` | `npm run build` 原始输出 + `BUILD_EXIT=0` | `bb6e66734e22ecc81f4a2a5b1287b8088c2068b496944b19395353f7bc96f838` |
| `neg2b-utils.sha256.{pre,post}.txt` | 变异前后同值（逐字节还原取证） | `27140a94a29760b419efa8f78567a1cf180900ec6fa17280521ef224ee5e8f01`（两文件同值） |
| `neg2b-utils.sha256.mutated.txt` | 变异后 sha256 记录 | `32a82b972bc79ad0b879ba33d513397381cbc219002352a7b075c38a621644f5` |
| `probe-new.mjs` / `probe-old.mjs` | 上轮函数层探针 | `f4b2c65b57efb32ca4b322f5b4ae3f6e2b4b43a700afae9fa1a11d3b065594a7` / `9c8eb5b96ff4609b6f6cbbf8ed268eb273d82b46b763bc34ad37137e536bf43f` |
| `probe-neg2.mjs` | **本单** NEG-2 探针（可切换 import 目标） | `0bab67835a3bf2a1ea1706ed96b38d2cad0aebb727975c409812253532661ce4` |
| `probe-neg2-wrong-expectation.mjs` | **本单** §4.2 错误期望版（同一探针，仅期望不同） | `d4d3502254a07b83427c5a4195113779341d009761d908c2bf94cbd3628cb176` |
| `cdp-qa.py` / `dump.py` | 真浏览器探针 / 摘要+独立复算脚本 | `974effca403decb8d1ae5eae67bee3e08091f43469bcb0cd721ea328893df343` / `5d437ebae2d4d28d1ebe492385db8de2307b53fd87e08ae4a14e5bd8b4538707` |

> 探针运行方式（可复现）：`node --experimental-specifier-resolution=node probe-neg2.mjs <utils.js 绝对路径> <tag>`
> （`utils.js` 内含 `from './auth'` 的无扩展名导入，需该 flag；stderr 含一条 `ExperimentalWarning`，与读数无关）

---

## 附录 B · 判负自证 B 表（两轮 NEG 速览）

| | 变异对象 | 变异点 | 我的探针 | 交付方测试 | 是否局部红 |
|---|---|---|---|---|---|
| **NEG-1**（上轮） | `frontend/src/App.jsx` | 自愈判据 → `if (false && ...)`（恒假） | —（该层未被函数探针覆盖） | `lang-path-redirect.test.jsx` **6 failed**；`lang-path.test.js` 14 条**仍全绿** | **是**（只红防御层） |
| **NEG-2**（本单） | `frontend/src/utils.js` | `stripLangPrefix`：`while` → `if`（只剥一段） | `check_fails 0 → 12`，4/21 路径红，`no_double_prefix_after_strip=false` | `9 failed / 19 passed`（6 + 3） | **是**（只红 4 条含多段前缀的路径） |

两轮 NEG 均在**临时 worktree** 内进行，**主工作区源码零改动、零 commit**，变异后**逐字节还原并复核 sha256**。
