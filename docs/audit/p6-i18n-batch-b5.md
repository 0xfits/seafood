# P6-I18N-LIT-B5 · 组件库 + 开发/比选预览页四语化（末批）+ 三项收口

- **工单**：Unit I18N-LIT-B5（组件库 + 预览页 88 条）+ 必做①（`SystemSettings` 待保存值随界面语言漂移）+ 必做②（`HomePage` 旧三目链收口 / LEGACY 清零）+ ④ i18n 全链路汇总对账
- **真源**：`docs/audit/p6-i18n-literal-recon.md`（本单只读引用，**未改**；既有 audit 件一律未动）
- **口径纪律**：§5.7 ① 退出码**不经管道取值**（用 `>` 落盘后 `echo $?`）；② 先骸架后回填、逐段落盘；③ 报数带口径；④ `NOT_MEASURED` 不填 0；⑤ 预算内收口
- **未动**：`git add/commit/push` 全程未执行（禁写项）；未启停服务、未 `pkill`/`killall`、未读 `.env*`、未 `npm install`、未跑 `vercel`

---

## 0. 一句话结论

**B5（88 条：a 7 / b 33 / c 48）已按 c 栏「不硬翻」原则逐条复核处置完**；两项必做均已落地并有**可判负用例**；`p6-tr2-i18n-locales.mjs` 的 **LEGACY = 0 页**。
`build = 0` / 单测 **172 passed（19 文件，≥158）** / 四语键集逐文件相等 `PASS`（`top=102 / flat=678`）/ 类级断言四项全 `0`。
**652 条需修复集已全部归档**（见 §5 全链路汇总表），无残留条目；残留的只有**口径外**项与**已登记**项（§5.4）。

---

## 1. 交付物（写集，均在本单硬边界内）

### 1.1 代码（`frontend/src/**`）

| 文件 | recon 条数 | 处置 | 处理前 → 处理后（剥注释后 CJK 行） |
|---|---|---|---|
| `components/ui/Advanced.jsx` | 7 | `useTranslation`；2 条改指**既有键** `prev` / `next`，5 条新键 `uiCommon.*` | 7 → 0 |
| `components/ui/DashJ.jsx` | 1 | `title` 走 `uiCommon.dashJPoints`（品牌 token `dashJ` 不译） | 1 → 0 |
| `components/ui/DataDisplay.jsx` | 2 | 空态走**既有键** `noData`；进度标签走 `uiCommon.progress` | 2 → 0 |
| `components/ui/ErrorHandling.jsx` | 25 | `uiError.*`（23 键）；`错误` / `加载中...` 走**既有键** | 27 → 0 |
| `components/ui/Loading.jsx` | 1 | 默认文案走**既有键** `loading`（`message ?? t('loading')`） | 1 → 0 |
| `components/ui/Performance.jsx` | 4 | `uiCommon.*`；`加载中...` 走**既有键** `loading` | 7 → 0 |
| `pages/ThemePreviewPage.jsx` | 25 | **c 栏：演示数据迁出**到 `pages/theme-preview-demo.js`（「演示/校验用」标记） | 28 → 0 |
| `pages/theme-preview-demo.js` | —（新增） | **非产品发布面 · 演示数据登记**（language 不变式） | 22 行登记（豁免，见 §4.2） |
| `theme/tokens.js` | 23 | **c 栏：保留**（`EXCLUDED_FROM_THEME` 开发登记表，UI 零渲染） | 10 行登记（豁免，见 §4.2） |
| `pages/HomePage.jsx` | —（B1 面） | **必做②**：旧三目链 → `pickLocalized` | — |
| `pages/admin/SystemSettings.jsx` | —（B4b 面） | **必做①**：待保存值改为与语言无关 + `placeholder` | — |

> 处理前读数说明：recon 对 B5 计 **88 条**（按字面量点）；本班按「剥注释后含 CJK 的行」计，且**逐行复核发现 recon 漏计 8 处**（多行 JSX 文本节点 / 含 `{}` 表达式混排——recon §6 已自曝该口径缺口），已**一并处理**：
> `ThemePreviewPage.jsx` L93（值真源说明）/ L94（拖动窗口说明）/ L162（`token 提取表（{{n}} 键 …）`）；
> `ErrorHandling.jsx` L110（`错误详情`，与「隐藏/显示」同行）/ L192（`重试`，与 `{retryAttempts > 0 && …}` 混排）；
> `Performance.jsx` L330（`渲染时间`）/ L331（`内存使用`）/ L373（`加载失败`，与 `{error.message}` 混排）。
> ⇒ 两类读数并列：**recon 口径 88 条** / **本班实测改写点 96 个**（88 + 8）。

### 1.2 四语 locale（四文件同步 `{zh,hk,en,vn}.json`）

- **新增命名空间 2 个**（命名空间铁律：写入前断言顶层无**字符串**同名键——`uiCommon` / `uiError` 均为新名，未与既有 `home`/`task`/`reward`/`page`/`login`/`register`/`auth`/`common`… 冲突）：
  `uiCommon` **12** 键 / `uiError` **23** 键 = **35 键**，四语齐备。
- **本批复用既有键 5 个**（(a) 一档，零新增键）：`prev` / `next` / `noData` / `error` / `loading`。
- 顶层键 **100 ⇒ 102**；拍平键 **643 ⇒ 678**；四文件键集逐项相等 `PASS`。
- hk 按 `opencc s2t` 风格产繁并校润（抽样断言：`清除篩選` / `出現咗啲問題`）；en/vn 由翻译产出，**en/vn 本批键零 CJK**（脚本 + 单测双断言）。

### 1.3 断言脚本（新建/更新，只读可重复运行）

| 脚本 | 作用 |
|---|---|
| `frontend/scripts/p4z-i18nb5-cjk.mjs`（新建） | **类级断言**：产品可见面写集 CJK `== 0` / 工程口径 `== 0`；非产品面**区间外**命中 `== 0`；locale en-vn CJK + 四语工程口径 `== 0` |
| `frontend/scripts/p4z-i18nb5-locales.mjs`（新建） | 四语 locale 增量写入（形状契约 + 命名空间铁律 + 幂等 + 写盘前自检，`--dry` 只校验） |
| `frontend/scripts/p6-tr2-i18n-locales.mjs`（**仅 LEGACY 名单 + 其打印**） | `const LEGACY = []`；新增一行存量页数读数（0 页），总判并入 `legacyOk` |

### 1.4 单测

- **新增** `frontend/src/test/unit/i18n-batch-b5.test.jsx` → **14 例**（en 档渲染 7 例 / 必做① 2 例 / 必做②+AC③④ 3 例 / 键集 1 例 / 演示数据 language 不变式 1 例）
- **更新**（既有锚点，非产品缺陷）：
  - `i18n-content-wiring.test.jsx`：`LEGACY = []`、`pages/HomePage.jsx` 并入 WIRED（D7 收口后断言更强）
  - `i18n-batch-b4a.test.jsx` / `i18n-batch-b4b.test.jsx`：locale 计数锚点 `top 100⇒102 / flat 643⇒678`（沿用 B4b 改 B4a 的同一条惯例，逐处留注释）

---

## 2. B5 逐条复核（c 栏 48 条「不硬翻」处置）

### 2.1 三类占比（recon 口径）

| 类 | 条数 | 处置 |
|---|---|---|
| (a) 已有键未用 | 7 | 改**代码**改指既有键（零新增键、零翻译） |
| (b) 需新增键 | 33 | 新增 **35 键**（`uiCommon` 12 / `uiError` 23，四语齐备）；**另处理 8 个 recon 漏计点** |
| (c) 不应国际化 | 48 | **逐条复核，不硬翻**（见 2.2） |

### 2.2 c 栏 48 条 —— 逐条复核结论（**两类处置，均不硬翻**）

| 位置 | 条数 | 复核结论 | 处置 |
|---|---|---|---|
| `theme/tokens.js:437–446`（`EXCLUDED_FROM_THEME`） | 23 | 是**主题 token 对照表数据**（`what / day / night / why`，含 `style-preview.html:行号` 与收敛理由），仅被 `src/test/unit/theme-tokens.test.js` 消费，**全仓无任何 UI 渲染**（`grep EXCLUDED_FROM_THEME` 命中 = `tokens.js` 自身 + 该测试） | **保留（给理由）**：属开发者登记数据（注释等价物）。类级断言**按区间登记豁免**（10 行 / 23 条），区间外命中 `== 0` |
| `pages/ThemePreviewPage.jsx` | 25 | 是 `/theme-preview` **开发/比选预览页**的自述 + 演示行内容；本页存在的意义就是证明「四语切换与主题切换都不改几何（`getBoundingClientRect` 逐值相等）」 | **改用「演示/校验用」标记**：全部迁出到 `pages/theme-preview-demo.js`（文件头写明归属与不译理由），**取值逐字不变**（**language 不变式**：四语档下相同），**页面组件本身 CJK 归零**；页内真实 UI 面（语言 chip）照旧走 locale 键 |

- 与 **B1 对 c 栏的处置同构**：B1 把 Footer 品牌 slogan 的**四语取值写成同一串源语言原文**（`locales/*.json` 的 `footer.catSlogan*` 四语同值，实测 en/vn 亦为中文）+ 语言名走 endonym 键；本批同样坚持「**值不变 / language 不变式**」，只是载体从 locale 键换成**演示数据模块**（避免为一个非发布面凭空造 25 条四语翻译）。
- **硬边界内**：`pages/ThemePreviewPage.jsx` 属 B5 写集；新增 `pages/theme-preview-demo.js` 在 `frontend/src/**` 内；`theme/tokens.js` **未改一字**。
- 反证（单测）：en 档与 zh 档渲染 `ThemePreviewPage` 的演示 chip 序列**逐字相同**且 = `['招工','商品','积分交易所','终身返佣','全部']`。

---

## 3. 三项收口

### 3.1 ★必做① `SystemSettings` 待保存值随界面语言漂移（缺陷修复）

```diff
-  const defaults = { ...DEFAULT_SETTINGS, siteDescription: t('adminSettings.siteDescription') }
+  const defaults = { ...DEFAULT_SETTINGS }            // siteDescription 恒为 ''（与界面语言无关）
   ...
   <textarea value={settings.siteDescription}
+            placeholder={t('adminSettings.siteDescription')}   // t(...) 只当 placeholder / 说明
```

- **危害（逐条登记）**：① 同一次「未改动即保存」在不同语言界面**落库不同数据**（`saveSettings` 把 `{...settings, ...}` POST 到 `/api/admin/settings`）；② 本仓**翻译管线以 zh 为源**，落库英文后会被「当中文再翻译」产生垃圾。
- **可判负用例**（`i18n-batch-b5.test.jsx`）：mock 的 `/api/admin/settings` **故意不返回 `siteDescription`** ⇒ `{ ...defaults, ...data }` 的取值**完全来自 `defaults`**；断言 `zh 档取值 === en 档取值 === ''`。
  **判负性**：旧实现下 zh 档 = 「去中心化社区奖励平台」、en 档 = 其英译文 ⇒ 两档不同、且非空 ⇒ 该用例在旧代码上**必然红**（本用例在修复前的等价形态已于 B4b §5.4 第 4 条被登记为「已知影响」，本单按 Zang 裁定收敛）。
- 另有源码面断言：`not.toContain('siteDescription: t(')` + `toContain('const defaults = { ...DEFAULT_SETTINGS }')` + `toContain("placeholder={t('adminSettings.siteDescription')}")`。

### 3.2 ★必做② `HomePage` 旧三目链收口（D7 最后一项）

- `mapTasksForHome` / `mapRewardsForHome` 的 4 处旧三目链（`_en/_hk/_vn` + `??`，共 12 个 `??` 命中）⇒ 改为 `pickLocalized(row, key, lang)`（`src/i18n-content.js`，**只读引用**，未改该文件）。
- **语义是实质修复**：后端「未翻译时 `*_<lang>` 有值且等于原文、但字段可能缺省 / 误给空串」⇒ `??` 只兜 `null`/`undefined`，**空串会穿透**；`pickLocalized` 用 `||`，空串回落原文。
- `p6-tr2-i18n-locales.mjs`：`const LEGACY = []`；输出 `存量登记（…）页面数 = 0 页`，`总判：PASS`。
- 登记位置同步更正：`src/test/unit/i18n-content-wiring.test.jsx` 的 `LEGACY` 清零、`pages/HomePage.jsx` 并入 `WIRED`（与脚本口径一致）。

### 3.3 ★必做③ i18n 全链路汇总对账

见 **§5**（汇总表 + 652 条归档声明）。

---

## 4. AC 读数（全部自跑；退出码**不经管道取值**）

| AC | 命令 | 退出码 | 读数（口径随行） |
|---|---|---|---|
| ① | `npm run build` | **0** | `✓ built in 1.46s`；`dist/assets/index-G8ue5koU.js 555.32 kB`（gzip 165.16 kB） |
| ② | `npm run test:unit` | **0** | `Test Files 19 passed (19)` / `Tests 172 passed (172)`（≥158；本批 +14 例，另更新 3 个既有锚点） |
| ③ | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | 四语 `top=102 flat=678`（取值集合 `{678}`）；`键集相等：PASS`；`存量登记… = 0 页`；`总判：PASS` |
| ④ | `node scripts/p4z-i18nb5-cjk.mjs` | **0** | 见 §4.2：四项全 `0`；`总判：PASS` |
| ⑤ | 全链路对账（§5） | — | `652 = 44 + 132 + 55 + 153 + 180 + 88` 闭合；未处理项 0；口径外/登记项逐条列明 |

### 4.1 单测新增覆盖（AC② 要求的三项）

1. **en 档渲染英文**：Advanced（占位 / 筛选面板 / 分页）· DataDisplay（空态 / 进度）· DashJ（`title`）· ErrorHandling（回退页 + 404）· Loading（默认文案）· Performance（节流提示）· ThemePreviewPage（语言 chip）——均带**简体原文反证** `queryByText(...) === null`；
2. **必做① 可判负**：zh/en 两档待保存值相同且为空（判负性见 §3.1）+ 源码面三断言；
3. **类级断言**：`execFileSync` 跑 `p4z-i18nb5-cjk.mjs` 与 `p6-tr2-i18n-locales.mjs`，**退出码即断言**（测试内可复现 AC③④）。

### 4.2 类级断言读数（AC④，`p4z-i18nb5-cjk.mjs`，退出码 0）

```
① 产品可见面写集（9 文件）：CJK 字面量命中 = 0（断言 == 0）
                            工程口径(用户可见文案面)命中 = 0（断言 == 0）
                            代码位登记 = 0；注释登记行 = 71
② 批内**非产品面**登记（豁免，逐条给理由）
   pages/theme-preview-demo.js: 登记保留行 = 22（区间外命中 = 0）—— 演示/校验用数据（language 不变式）
   theme/tokens.js:             登记保留行 = 10（区间外命中 = 0）—— EXCLUDED_FROM_THEME 开发登记表
③ locale 面（uiCommon/uiError 全键 + prev/next/noData/error/loading）：
   en/vn 残留 CJK = 0；四语工程口径残留 = 0
总判：PASS（代码 CJK=0 / 代码工程口径=0 / locale CJK(en,vn)=0 / locale 工程口径=0 / 非产品面区间外命中=0）
```

**口径声明（避免把口径当结论）**

- 「工程口径」token = `§` / `410` / `R107` / `api/` / `sunset`，**只对用户可见文案面成立**：含 `fetchApiJson(` / `fetch(` / `import ` / `require(` / `from '` 的行判为**代码位**（接口路径本来就必须写），命中只登记。**本批写集代码位登记 = 0**（HomePage / SystemSettings 的 `/api/...` 均落在 `fetchApiJson(` 调用行内 ⇒ 计为代码位，未计入文案面）。
- **注释行允许保留**（本批 71 行，逐文件：Advanced 2 / DashJ 4 / DataDisplay 1 / ErrorHandling 13 / Loading 1 / Performance 17 / ThemePreviewPage 9 / HomePage 4 / SystemSettings 20），不计入断言。
- 「非产品面登记」不是放宽断言：**只有两个**具名对象被豁免，且都要求「**区间外命中 == 0**」；豁免行逐行列出行号（22 + 10 = 32 行），理由见 §2.2。

---

## 5. 全链路 i18n 汇总对账（AC⑤）

### 5.1 汇总表（B1–B5：各批条数 / 已处理 / 未处理含理由）

| 批次 | 主题 | recon 表④ 条数 | (a) 已有键 | (b) 需新键 | (c) 不译 | **已处理** | **未处理（含理由）** |
|---|---|---|---|---|---|---|---|
| **B1** | 首屏 · 全局骨架（Header / HomePage / Footer / App / shell） | **44** | 4 | 30 | 10 | **44** | 0 —— c 栏 10 条已由 locale 键承载（四语同值 / endonym 键，**值不变**） |
| **B2** | 主线三页 · 任务/奖励/我的 + 卡片与弹窗 | **132** | 13 | 119 | 0 | **132** | 0 |
| **B3** | 登录 / 认证 / 钱包 + 工坊·商品·交易所三线核验 | **55** | 0 | 55 | 0 | **55** | 0 |
| **B4a** | 后台管理（外壳 + 总览 + 任务/奖品 2 面） | **153** | 25\* | 308\* | 0 | **153** | 0 |
| **B4b** | 后台管理（剩余 5 面） | **180** | —\* | —\* | 0 | **180** | 0 |
| **B5** | 组件库 + 开发/比选预览页（本批） | **88** | 7 | 33 | 48 | **88** | 0 —— c 栏 48 条见 §2.2（保留 / 演示标记，**不硬翻**） |
| — | **合计** | **652** | **49** | **545** | **58** | **652** | **0** |

\* B4 的 (a) 25 / (b) 308 为 recon 对 **B4 整批**（= B4a 153 + B4b 180）的三分口径，不逐子批拆分。

### 5.2 **归档声明**

> **652 条需修复集（口径 A = 含中文的字符串字面量，不含注释与测试）已全部归档，无一条残留未处置。**
> 组成：`44 (B1) + 132 (B2) + 55 (B3) + 333 (B4 = 153 + 180) + 88 (B5) = 652` **(a) 49 + (b) 545 + (c) 58 = 652** ✅ 双口径闭合。
> 其中 **(c) 58 条按「不应国际化」归档**（B1 10 条：品牌 slogan 4 / 联系邮箱标签 2 / 语言 endonym 4；B5 48 条：主题 token 对照表 23 + 预览页演示数据 25），**全部未硬翻**，载体为 locale 键（四语同值）或演示数据模块 / 开发登记表（`language 不变式`，取值逐字不变）。

### 5.3 口径差（并列，不替换）

| 项 | recon 读数 | 工单「已入库」读数 | 说明 |
|---|---|---|---|
| B2 条数 | **132** | 135 | 差 **+3**，属口径差（recon 表④ 与入库班的计数点不同）；本报告归档按 recon 表④，两读数并列 |
| B5 条数 | **88**（字面量点） | — | 本班按「剥注释后 CJK 行」复核，**另发现 recon 漏计 8 处**（§1.1），本班实测改写点 **96**；两类读数并列 |
| 后台 B4 | 153 + 180 = **333** | 153 + 180 = **333** | 一致 |

### 5.4 未处理项（逐条 + 理由，**未用 `NOT_MEASURED` 冒填**）

1. **注释内 CJK 71 行**（写集内）：工单明确「注释允许保留」，逐文件登记行数（§4.2）。
2. **非产品面登记 32 行**：`pages/theme-preview-demo.js` 22 + `theme/tokens.js` 10（§2.2 逐条理由）。
3. **class ④（注释）577 条 / class ⑤（测试夹具）264 条**：recon §0 明确**不在需修复集（口径 A）**⇒ 全部保留、不计入 652。
4. **`Advanced.jsx` 的 `DatePicker.formatDate` 仍硬编码 `toLocaleDateString('zh-CN')`**：**非 CJK 字面量**（纯 ASCII），不在 652 集内，故**本单未改**（改它属行为变更、超出本批硬边界）。**登记为已知残留**，建议另立单点工单（`zh-CN` ⇒ 随 `i18n.language` 变化）。
5. **语言选择器 endonym 4 处**（`adminSettings.langZh` / `langHk` 的 en/vn 取值）：B4b 已登记的豁免（语言名按母语自书），本单沿用。
6. **权限标识 / 接口路径等非 CJK 品牌与代码符号**（`manage_points`、`dashJ`、`Jinli Club`、`EVM`、`contact@jinli.club` …）：recon §3 已判「一律不国际化」，本单沿用（`DashJ` 的 `title` 只译中文部分）。

### 5.5 NOT_MEASURED（未测项 —— **禁填 0/空**）

- **未做真浏览器逐条切语言复核**（recon §6 同项仍未测）：本批的「en 档渲染英文」是 **jsdom 渲染断言 7 例 + 四语 locale 取值断言**，不是 CDP 真机取证；652 条中除本批 14 例覆盖外，其余仍为**静态存在性推断**。
- **`/theme-preview` 是否对外发布未测**：已知 `App.jsx:92` 注册了 `path="theme-preview"` 路由，但**未查生产可达性 / 未在 prod 实测**；若该面确为对外发布，`theme-preview-demo.js` 应改判 ②-b 并接 i18n（判断已在模块头与本节双重登记）。
- **en/hk/vn 四语翻译质量未评测**：本批 35 键为**初稿**（hk 经 s2t 风格产繁后校润，en/vn 由翻译产出），**未经母语者 / 术语表校验、未做回译核验**。
- **后端 UGC 的 `_en/_hk/_vn` 覆盖面未测**：属翻译线 TR-* 范围，本单不覆盖。

---

## 6. 落地记录（可复现）

```bash
cd frontend
node scripts/p4z-i18nb5-locales.mjs        # 0  四语增量写入（幂等；--dry 只校验）；读数 top=102 / flat=678
npm run build                              # 0  ✓ built in 1.46s
npm run test:unit                          # 0  19 files / 172 passed
node scripts/p6-tr2-i18n-locales.mjs       # 0  键集相等 PASS；存量登记 = 0 页；总判 PASS
node scripts/p4z-i18nb5-cjk.mjs            # 0  类级断言 PASS（四项全 0；登记豁免 32 行）
```

### 6.1 过程中的自我纠正（登记，避免同类复发）

1. **两处新注释踩了断言正则**：`HomePage.jsx` 的注释里写了 `` `_en ?? base` ``、`SystemSettings.jsx` 的注释里写了 `` `siteDescription: t('…')` `` ⇒ `i18n-content-wiring.test.jsx` / 新 B5 单测的**源码面正则**把它们当成真命中（首轮 3 红）。**处置**：改注释措辞（写成「语言后缀 + 空值合并运算符」「`t(...)` 的求值结果」），**不是放宽正则**——正则本身就是这批的验收判据。
2. **`theme-preview-demo.js` 的 `$410/天`**：若留在写集页内，会被类级断言的「工程口径 token `410`」命中 ⇒ 迁出演示数据同时消掉了这个假阳性面（登记豁免区内仍逐行列出，不掩盖）。
