# 小尾巴批（批 7-E）· 三项收尾 · 交付报告

> 作者：**Kong** · 仓库 = `/Users/kevin/bistro/seafood` · 本单**只改 `frontend/**`**（+ 本报告）· **未 `git add/commit/push`**（推送即上线）
> 本单 = 「小尾巴批」3 项（收尾性）：**③** `p7c` 门 D/G 段升**真链**（落实 R-7D-3 纪律）/ **①** `ListingsPage` 数据状态枚举本地化（收口核验 + 门「残余发现」归 0）/ **②** en·vn 存量 8 处 CJK 逐条判定（口号列**交 Zang 裁**）
> 硬口径：未 `npm install`；未碰/未打印 `.env*`；未用 `pkill -f` / `killall`；未启停 5787/5788；**不碰** `backend-ts/**` / `migrations/**` / `docs/*.spec.md` / `docs/seafood.master-plan.md` / `docs/qa/**` / `docs/audit/**` 既有件（除本报告）；**判负自证只在仓外副本内做**（零仓内污染）。
> 读数一律「命令 → 退出码 → 原文摘录」。未测项写原因（§6.4），**禁填 0 或空**。

---

## §0 元信息

### §0.1 开工 / 收尾态（逐字，对锚）

**开工态**
```
$ git status --porcelain
（空 —— 工作区干净）
$ git branch --show-current
main
$ git log --oneline -3
5726467 docs: 批 7-D 生产终验（health 0024 + bundle 字节级一致 e86377c6 + 四语新文案线上 grep 命中）+ §5.173 D 补读
03794e9 docs: 批 7-D 终审 PASS + 我两条裁定（R-7D-2prime … / R-7D-4 en-vn 存量 CJK 归小尾巴批）…
12162ed test(qa): 批 7-D 终审质检 PASS（… 坐实镜像门不回放 …）
```

**收尾态**
```
$ git status --porcelain
 M frontend/scripts/p4z-i18nviol-global.mjs
 M frontend/scripts/p7c-errmsg-machinecode-gate.mjs
?? docs/audit/p7-e-tails.md
$ git rev-parse HEAD
5726467…（未变 —— 本单不提交）
```
⇒ 除本报告外，**只改了 2 个门脚本**（均在 `frontend/**`）；HEAD 未动。

### §0.2 被改面清单（现取）

```
$ git diff --stat
 frontend/scripts/p4z-i18nviol-global.mjs         |  31 +++-
 frontend/scripts/p7c-errmsg-machinecode-gate.mjs | 176 +++++++++++++----------
 2 files changed, 129 insertions(+), 78 deletions(-)
```

| 文件 | 归属 | 改动性质 |
|---|---|---|
| `frontend/scripts/p7c-errmsg-machinecode-gate.mjs` | ③ | D/F/G 由「链式决策**镜像**」改为**真链**（`import` 真 `apiErrorMessage`） |
| `frontend/scripts/p4z-i18nviol-global.mjs` | ① | 「③ 残余发现」由**硬编码陈旧登记**改为**现取核验**（残留 = 0） |
| `docs/audit/p7-e-tails.md` | 交付 | 本报告（新件，未跟踪） |

**未改**：任何 locale（`src/locales/*.json` 一字未动）、`src/auth.js`、任何页面/组件、任何单测。故四语 flat 键数仍 **737**、单测仍 **268**（§4）。

---

## §1 ③ `p7c` 门 D/G 段升**真链**（R-7D-3 纪律落实）

### §1.1 升级前（镜像级）与根因（终审质检已独立坐实）

`p7c` 门此前是**纯 node 门**（升级前自身注释逐字：「本脚本是**纯 node 门**（无 vite 解析器，故 `src/i18n.js` 的 `./utils` 无扩展名导入在 node 下不可解析）⇒ D/F 采用**链式决策镜像**」）。镜像 = 门内**自己重写一遍** `resolveI18nMessage` / `extractApiErrorMessage` 的决策次序（旧 `chainOutcome` 内联 `const suffix = v.reason && !containsMachineCode?.(v.reason) ? \` (${v.reason})\` : ''`）。

⇒ **根因**：把 `auth.js` 的 reason 判据改回旧口径时，**门不回放被改代码** ⇒ 门仍绿，只有真链单测红（批 7-D 终审质检 v0.173 §L4 已逐字坐实）。**本单把 D/F/G 升为真链**。

### §1.2 升级方式与「真链 / 镜像级」认定

**实现方式**（自选，仓内现成、**不新增依赖**）：
1. 用 **`esbuild`（v0.21.5，vite 传递依赖）** 把 `src/auth.js` 打成**临时 ESM**：
   - 入口用 **`stdin`**（不落仓内文件），内容 = `export * from './auth.js'` + `export { default as i18n } from './i18n.js'`，`resolveDir = <ROOT>/src`；
   - `bundle:true, format:'esm', platform:'node', outfile = os.tmpdir()/p7c-realchain-XXXX/auth-chain.mjs`，`nodePaths = [<ROOT>/node_modules, <脚本目录>/../node_modules]`（仓外副本兜底）；
   - `src/auth.js` 的动态 `import('./i18n')` 被 esbuild 一并收进同包 ⇒ 链内 `i18n` 与门导出的 `i18n` **同一实例**（真 locale JSON、真 i18next）。
2. 导入前设 **`window` 垫片**（`src/i18n.js` 导入期读 `window.location.pathname`）：`globalThis.window = { location: { pathname: '/zh/' }, addEventListener(){} }`。
3. `import()` 后取真导出：`realChain = { apiErrorMessage, i18n }`；**用后即删**（`finally { fs.rmSync(tempDir, {recursive:true, force:true}) }`）。
4. **D/F/G 全部改真调用**（镜像已删除）：
   ```js
   const chainOutcome = async (lang, v) => {
     await realChain.i18n.changeLanguage(lang)          // 真语言切换
     return realChain.apiErrorMessage(payloadOf(v), v.status)   // ★ 真链，无镜像
   }
   const t = (lang, key, vars) => realChain.i18n.getFixedT(lang)(key, vars)  // 断言 oracle = 同实例
   ```
   `payloadOf(v)` 把向量还原成 `R107` 真体形状（`{ error: { code, message, i18n_key, details.reason } }`）。
5. 门**自己的那份 i18next init 已整段删除**；A 段仍读源码文本（证「接线在场」，与真链互补），B/C/E 不依赖链。

**「真链 / 镜像级」认定（给 QA 复核的机读标准，三条同时成立 = 真链）**：
- 门输出首行 = `【真链】真 import src/auth.js#apiErrorMessage + 真 i18n 实例（esbuild 临时 ESM 载入；不再镜像重写链逻辑）`；
- 作用域读数行含 `链路体制 = 真链`；
- D/F/G 节点读数非 0（`D …/16`、`F …/16`、`G …/36`）。

**真链不可用时的诚实标注**（防「静默判绿」）：若 `esbuild` 缺失 / 打包失败 ⇒ 打印 `【镜像级】真链不可用 ⇒ D/F/G 无读数（不得读作「零违例」）。原因：<逐字>`，**并判负**（`fail(...)` ⇒ EXIT=1）。即：**门不再存在「镜像级但绿」的形态**。

### §1.3 判负自证（仓外副本，零仓内污染）

副本根 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/p7e-neg/frontend`（**仓外**；复制 `src/ scripts/ package.json vite.config.js vitest.config.js`，`node_modules` 软链回主仓）。

**变异**（副本内 `src/auth.js:187`，reason 判据回**旧口径**）：
```diff
-      const suffix = reason && !containsMachineCode(reason) ? ` (${reason})` : ''
+      const suffix = reason ? ` (${reason})` : ''
```

**【A】旧（镜像级）门 × 变异副本 ⇒ 预期绿（坐实「镜像门不回放」）**
```
$ node …/p7e-neg/frontend/scripts/p7c-errmsg-machinecode-gate.mjs …/p7e-neg/frontend
EXIT=0
[P7C-MACHINE-CODE] 总判：PASS（判负 0 …；A=PASS / … / G 机读码出现次数=0/36 违例=0 / E 样本=19）
```
⇒ 旧门把 reason 旧口径**判成了绿**（链逻辑被门内镜像掩盖）—— 与 v0.173 §L4 结论一致。

**【B】升级「真链」门 × **同一**变异副本 ⇒ 预期红（逐字红读数）**
```
$ node …/p7e-neg/frontend/scripts/p7c-errmsg-machinecode-gate.mjs …/p7e-neg/frontend
EXIT=1
  【真链】真 `import` `src/auth.js#apiErrorMessage` + 真 `i18n` 实例（esbuild 临时 ESM 载入；不再镜像重写链逻辑）
  · ③ stateConflict() · reason=LISTING_STATE_INVALID（`listing-service.ts:55`）⇒ 不得附加后缀
      [zh] ⇒ "Business state transition rejected (LISTING_STATE_INVALID)"  ! 机读码出现 1 次；谓词判定含机读码；产出含后缀/码 LISTING_STATE_INVALID；应 = "Business state transition rejected"，实际 "Business state transition rejected (LISTING_STATE_INVALID)"
      [hk] ⇒ "Business state transition rejected (LISTING_STATE_INVALID)"  ! …（同）
      [en] ⇒ "Business state transition rejected (LISTING_STATE_INVALID)"  ! …（同）
      [vn] ⇒ "Business state transition rejected (LISTING_STATE_INVALID)"  ! …（同）
  …（JOB_STATE_INVALID / JOB_APPLICATION_STATE_INVALID / CURRENCY_STATE_INVALID / STATEMENT_TIMEOUT 各 4 语同形）
  ★ 机读码出现次数合计 = 20（必须 = 0）/ 节点 36；违例向量-语 = 20（必须 = 0）
[P7C-MACHINE-CODE] 总判：FAIL（判负 20 必须 = 0；链=真链 / A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=20/36 违例=20 / E 样本=19）
```
⇒ 升级后**门对 auth.js 被改代码必红**（G 命中 20）。红面 = `stateConflict()` 四种 reason（`listing-service.ts:55` / `job-service.ts:122` / `job-funds-service.ts:61` / `currency-service.ts:59`）+ `STATEMENT_TIMEOUT`，共 5 向量 × 4 语 = 20。

**复原回绿**（副本 `auth.js` 撤回变异后）：
```
$ node …/p7e-neg/frontend/scripts/p7c-errmsg-machinecode-gate.mjs …/p7e-neg/frontend
EXIT=0
[P7C-MACHINE-CODE] 总判：PASS（… 链=真链 / … / G 机读码出现次数=0/36 违例=0 / E 样本=19）
```

---

## §2 ① 状态枚举本地化（收口核验 + 门「残余发现」归 0）

### §2.1 ★ 订正：父单描述为**陈旧件**；该项**已实装**

父单 ① 逐字 = 「`ListingsPage.jsx:127` 数据状态枚举未译（`String(row.status ?? t('listings.listed'))` …），现有键集内**无** draft 等标签键可用」。**现取实测：与事实不符**：
- `git show 9c6d076:frontend/src/pages/listings/ListingsPage.jsx` 第 127 行 **确为** `<span className="sf-listings-tag">{String(row.status ?? t('listings.listed'))}</span>` ⇒ ① 的**来源**是该门内一条**硬编码「残余登记」**（`p4z-i18nviol-global.mjs` 旧 line 206）；
- 但 **`3b1bc12`（P6-MISC-FIX ①，2026-10-01，晚于 `9c6d076`）已把该行改为查表**：`LISTING_STATUS_KEYS` + `listings.statusLabel.<value>` + 未知兜底，并自带 3 条单测（`p6-miscfix.test.jsx` describe ①）；
- ⇒ 「残余登记」在 `9c6d076` 登记后**未被 `3b1bc12` 清理**，批 7-D 质检（v0.173 §R-7D-4/§C）读到的仍是这条**陈旧登记** ⇒ 小尾巴批 ① 实为「**清陈旧登记 + 升为现取核验**」，**无需新增键**（键已于 `3b1bc12` 落地）。

### §2.2 `listing.status` 真实取值域（**现取，非猜**）

```
$ grep -n "listing_status_enum" backend-ts/migrations/0015_listing.sql
137:  CONSTRAINT listing_status_enum      CHECK (status IN ('draft','listed','delisted','frozen')),
124:  status             text        NOT NULL DEFAULT 'draft',
$ grep -n "case 'draft'\|case 'frozen'\|case 'delisted'" backend-ts/src/listing-service.ts
135:    case 'draft':  137:    case 'frozen':  139:    case 'delisted':
```
- **值域 = `{draft, listed, delisted, frozen}`（4 值）**，默认 `draft`；
- 状态机（`0015_listing.sql` §A1 注释逐字）：`draft → listed → {delisted | frozen}`，`frozen → listed`，`delisted` 终态；
- 后端 `listing-service.ts:135-139` 消费同集。
- ⇒ 与前端 `LISTING_STATUS_KEYS = ['draft','listed','delisted','frozen']`（`ListingsPage.jsx:9`，注释亦逐字引 `0015_listing.sql:137`）**逐值一致**。

### §2.3 标签键四语表（键已落地于 `3b1bc12`；本单**未新增键**）

| 键（`listings.statusLabel.*`） | zh | hk | en | vn |
|---|---|---|---|---|
| `draft` | 草稿 | 草稿 | Draft | Bản nháp |
| `listed` | 已上架 | 已上架 | On sale | Đang bán |
| `delisted` | 已下架 | 已下架 | Removed | Đã gỡ bán |
| `frozen` | 已冻结 | 已凍結 | Suspended | Đã tạm khóa |
| `unknown`（兜底） | 其他状态 | 其他狀態 | Unknown | Không rõ |

- **键集四语完全相等**（5 键）；
- **en/vn 零 CJK**（现取：`en.listings.statusLabel` / `vn.listings.statusLabel` 无 `\p{Script=Han}`）；
- hk 用繁體（`已凍結` / `其他狀態`）。

### §2.4 未知值安全回退 + 判负

**查表与回退（`ListingsPage.jsx:121-126` 现取）**：
```js
const statusRaw = row.status == null || row.status === '' ? '' : String(row.status)
const statusText = statusRaw === ''
  ? t('listings.statusLabel.listed')                                  // 缺省/空串 ⇒ 维持既有口径
  : (LISTING_STATUS_KEYS.includes(statusRaw)
    ? t(`listings.statusLabel.${statusRaw}`)                          // 已知 ⇒ 四语标签
    : t('listings.statusLabel.unknown'))                             // ★ 未知 ⇒ 本地化兜底（绝不裸渲）
```
原值**不入文案面**，只留排查面：`data-sf-status={statusRaw || undefined}` `title={statusRaw || undefined}`。

**① 判负（仓外副本；两处，均回绿）**：

①-a **单测级**（真 jsdom 渲染）—— 副本内把 tag 换回旧形态 `>{String(row.status ?? t('listings.listed'))}</span>`：
```
$ vitest run src/test/unit/p6-miscfix.test.jsx        # 副本内
EXIT=1
 FAIL  … > 未知取值 ⇒ 本地化兜底（不渲染原始枚举、不空白）…
AssertionError: expected [ 'draft', 'delisted', …(2) ] to not include 'sunset-value'
 FAIL  … > 四语各自渲染本地化标签（判负：四语取值互不相同）
AssertionError: expected [ 'draft', 'delisted', …(2) ] to include '草稿'
 Test Files  1 failed (1)     Tests  2 failed | 6 passed (8)
```
⇒ 注入未知枚举 `sunset-value` **裸渲**被抓住。

①-b **门级**（本单新升的现取核验）—— 同一副本：
```
$ node …/p4z-i18nviol-global.mjs          # 副本内、变异后
  现取核验：pages/listings/ListingsPage.jsx 状态标签收口 ⇒ 残留登记 = 1 条（原 1 条已由小尾巴批 ① 收口）
  ? src/pages/listings/ListingsPage.jsx :: 状态枚举又出现原样渲染 / 查表或未知兜底缺失（P6-MISC-FIX ① 收口被回退）
```

**复原回绿**：副本两处复原后 ⇒ 单测 `Test Files 1 passed / Tests 8 passed (8)`；门 `残留登记 = 0 条`。

**门改动（`p4z-i18nviol-global.mjs` §③）**：把旧**硬编码数组**改为**现取**——
```js
const RESIDUAL = []
const code = raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'')   // 去注释，防注释提及误命中
if (/sf-listings-tag[\s\S]{0,240}?String\(row\.status/.test(code)   // 旧形态回归
    || !/listings\.statusLabel\./.test(code)                        // 查表被移除
    || !/listings\.statusLabel\.unknown/.test(code))                // 未知兜底被移除
  RESIDUAL.push([...])
```
主工作区现取读数：`现取核验：pages/listings/ListingsPage.jsx 状态标签收口 ⇒ 残留登记 = 0 条`。

---

## §3 ② en/vn 存量 8 处 CJK 逐条判定

现取：`en` 与 `vn` 各 **8** 个含 CJK 叶子（**键集相同**、与改前逐字相同）。

### §3.1 逐条判定表

| # | 键 | en 值 | vn 值 | 判定 | 理由 |
|---|---|---|---|---|---|
| 1 | `chinese` | `简体中文` | `简体中文` | **保留（有意）** | **language endonym**：语言选择器按「该语言自称」显示；译成 `Simplified Chinese` 反而使懂中文者认不出。既有显式豁免（`EXEMPT_LOCALE_KEYS`）。 |
| 2 | `cantonese` | `粤语` | `粵語` | **保留（有意）** | language endonym（同上）。 |
| 3 | `adminSettings.langZh` | `中文` | `中文` | **保留（有意）** | language endonym（后台语言项标签）。 |
| 4 | `adminSettings.langHk` | `繁體中文` | `繁體中文` | **保留（有意）** | language endonym。 |
| 5 | `footer.catSlogan1` | `猫猫大使团｜不止一份报酬，更加一份经验。` | 同 | **交裁（产品口径）** | 品牌口号，非功能文案；本单**不擅自改**（§3.2 草稿）。 |
| 6 | `footer.catSlogan2` | `猫猫大使团｜你的声音，值得被品牌听见。` | 同 | **交裁（产品口径）** | 同上。 |
| 7 | `footer.catSlogan3` | `你的代言，从猫猫大使团开始。` | 同 | **交裁（产品口径）** | 同上。 |
| 8 | `footer.cloudSlogan` | `云朵计划｜播种童年梦想，浇灌美和希望。` | 同 | **交裁（产品口径）** | 同上。 |

⇒ **真降级（误留中文、应译而未译）0 条** ⇒ 本单**无需直接译任何键**（① 类「误留中文」不存在）。

### §3.2 交 Zang 裁清单（口号）+ 拟译草稿（**一句话可改**）

> 口径：这 4 键是**品牌口号**（既有 `EXEMPT_LOCALE_KEYS` 已按「产品口径」豁免）。**本单不改**，仅呈草稿供裁。若裁定「译」，需同步：① 落 4 键 en/vn 值；② 视情移除对应豁免条目；③ 重跑 §4 七门 + 单测（键数不变 ⇒ 期望不变）。

| 键 | 拟译 **en**（草稿） | 拟译 **vn**（草稿） |
|---|---|---|
| `footer.catSlogan1` | `Cat Ambassador Team \| More than pay — it's experience.` | `Đội Đại sứ Mèo \| Không chỉ là thù lao — mà còn là trải nghiệm.` |
| `footer.catSlogan2` | `Cat Ambassador Team \| Your voice deserves to be heard by brands.` | `Đội Đại sứ Mèo \| Tiếng nói của bạn xứng đáng được thương hiệu lắng nghe.` |
| `footer.catSlogan3` | `Your endorsement starts with the Cat Ambassador Team.` | `Sự đại diện của bạn bắt đầu từ Đội Đại sứ Mèo.` |
| `footer.cloudSlogan` | `Cloud Plan \| Sow childhood dreams, water beauty and hope.` | `Kế hoạch Mây \| Gieo ước mơ tuổi thơ, vun đắp vẻ đẹp và hy vọng.` |

（`hk` 现为中文口号、`zh` 同值；若裁定「hk 用粤语书面」，需另拟 hk 草稿 —— 本单未擅动。）

---

## §4 验收读数（AC）

| 项 | 命令 | EXIT | 读数（原文摘录） |
|---|---|---|---|
| build | `npm run build` | **0** | `✓ built in 1.77s` |
| 单测 | `npm run test:unit` | **0** | `Test Files 30 passed (30)` / `Tests 268 passed (268)`（≥268 **不掉**） |
| 门① | `node scripts/p4z-i18nviol-global.mjs` | **0** | `总判：PASS（locale 裸命中 0 + 源面裸命中 0 …；locale=2948 / source=37）`；**③ 残余发现 = 0 条** |
| 门② | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | `[TR-2] 总判：PASS` |
| 门③ | `node scripts/p4z-miscfix-links.mjs` | **0** | `总判：PASS（残留全部已登记）` |
| 门④ | `node scripts/p4z-feperf-safelist.mjs` | **0** | `VERDICT=PASS`（**先 build 后跑**，依赖 `dist/`） |
| 门⑤ | `node scripts/p7a-03-errmessage-gate.mjs` | **0** | `总判：PASS（… 命中 0 / 基线 0）` |
| 门⑥ | `node scripts/p7b-errfallback-gate.mjs` | **0** | `总判：PASS（… D 节点=132 需护栏=0 已本地化=132 …）` |
| 门⑦ | `node scripts/p7c-errmsg-machinecode-gate.mjs` | **0** | `总判：PASS（… 链=真链 / A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）` |

**七门全 PASS**；退出码**管道外捕获**（`for g in …; do out=$(node scripts/$g.mjs 2>&1); ec=$?; …`）。

**错误码闭集 33 不动**（本单未碰 `auth.js` / `ledger.err.*` / 任何码面）；**四语键集相等**（门②：`四文件拍平键数取值集合 = {737}`）；**无 stub**（门①/② 判据；本单未写任何 locale 值）。

---

## §5 判负自证汇总（≥2 处，仓外副本 + 复原回绿 + 主工作区首尾 `git status`）

副本 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/p7e-neg/frontend`（仓外；`node_modules` 软链）。

| # | 对象 | 变异（副本内） | 判负读数 | 复原 |
|---|---|---|---|---|
| 1 | **③ 门 G 段真链** | `auth.js` reason 判据 → 旧口径 | **EXIT=1**；G `机读码出现次数=20/36 违例=20`（同变异下**旧镜像门 EXIT=0** = 坐实旧洞） | EXIT=0（0/36） |
| 2 | **① 状态枚举** | `ListingsPage` tag → 原样渲染 | **单测 EXIT=1**（2 failed，`sunset-value` 裸渲）+ **门 残留登记=1** | 单测 8/8 绿；门 残留=0 |

主工作区 `git status`：**开工 = 空**（§0.1）／**收尾 = 2 门脚本 M + 1 报告 ??**（§0.1），**全程无仓内临时污染**。

---

## §6 期望订正 / 自曝

### §6.1 期望订正
**无。** 本单**未新增/删改任何 locale 键**（flat 仍 737），单测期望（键数/断言）**一字未改**；`npm run test:unit` 读数为 `268 passed`，与基线**逐字相同** ⇒ 无「期望订正」事项。

### §6.2 自曝 1（★ 关键订正）：父单 ① 的描述是**陈旧件**
父单 ① 与批 7-D 质检（v0.173 §R-7D-4/§C）据以判「未译」的，是 `p4z-i18nviol-global.mjs` 内一条**硬编码「残余登记」**（登记于 `9c6d076` = P6-I18N-VIOL closeout）。而 **`3b1bc12`（P6-MISC-FIX ①，晚于 `9c6d076`）已实装**状态标签查表 + 未知兜底 + 3 条单测，但**未清该登记** ⇒ 登记**陈旧**。本单动作 = **清陈旧登记 + 把该段升为「现取核验」**（回归即重新登记，不再陈旧）。**未新增任何键**（父单「新增标签键」的前提不成立）。

### §6.3 自曝 2：同类「原样渲染 `row.status`」**另有 2 处**，本单**未改**（交裁）
现取全仓 `pages/**`：
```
frontend/src/pages/listings/ListingDetailPage.jsx:78  `… · ${String(row.status ?? '-')}`      ← listing 状态原样渲染
frontend/src/pages/market/MarketPage.jsx:353          `… · ${String(row.status ?? '')}`       ← 市场行 status 原样渲染
```
二者**从未在门内登记**，且**不在本单 ① 的指派面**（指派面逐字 = `ListingsPage.jsx:127`）⇒ 本单**未擅改**（避免越界 + 连带其它门/单测）。**建议前进项**：按 ① 同法收口（各页各有独立取值域，须分别现取——如 `MarketPage` 行 status 疑为 `listing_order.status ∈ {created,paid,refunded,cancelled}`，`0015_listing.sql:176`）。

### §6.4 自曝 3 / 未测项
- **真链依赖 `esbuild`**（vite 传递依赖，非 `package.json` direct）。本环境 `esbuild@0.21.5` 在场。若某环境缺 ⇒ 门打印 `【镜像级】` + 逐字原因 + **判负**（EXIT=1，**不静默判绿**）。
- **门内临时 ESM 写 `os.tmpdir()` 下**（`mkdtempSync`）并**即时删除**；仓内**零临时件**。
- **未测**：`npm run test:components` / `test:e2e` / `lint` / `type-check` —— **不在本单 AC**，未跑（不填 0）。① 的行为面由 `p6-miscfix.test.jsx`（jsdom **真渲染**）覆盖（§2.4）。**未做浏览器端 5787/5788 验证**（本单禁启停）。
- **② 的 slogan 在 en/vn 仍显示中文**（线上可见，未译）—— 本单**不擅自改**（产品口径），仅交裁（§3.2）。
