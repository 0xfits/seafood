# S28 · 把「退役 10 键」从「删除动作」升为被强制执行的不变式

**执行角色**：Kong（实现方）  **日期**：2026-10-04（CST）  **仓库**：`/Users/kevin/bistro/seafood`（React18 + Vite 前端）
**本单范围**：仅 `frontend/src/test/unit/**` 的两条反面护栏改造 + 判负 + 硬门；报告 `docs/audit/s28-retired-key-guards.md`；产物 `frontend/.s28-artifacts/<runid>/`。
**RUNID**：`S28-20261004T132021Z`（`frontend/.s28-artifacts/.latest`）

---

## §0 对锚（开工前现取）

| 项 | 命令 | 读数 |
|---|---|---|
| HEAD | `git log --oneline -3` | `6d2ca98`（docs §5.343/v0.343）← `d579124` ← `815c138` |
| S25 锚点 | 同上 | `815c138 chore(i18n): S25-B7 四语对称退役 10 个死键 …`（= 本单「删除前」基线） |
| 工作树 | `git status --porcelain \| wc -l` | **176** 行，**全部为其它会话的未跟踪产物目录**（`backend-ts/.p*-artifacts/**` 等）；无已修改的跟踪文件 |
| 基线 vitest | `npx vitest run` | `Test Files 4 failed \| 50 passed (54)`；`Tests 7 failed \| 480 passed (487)` |
| 基线四脚本 | `node scripts/{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.mjs` | **全 exit 0 / 全 PASS** |
| 基线 build | `npm run build` | exit 0 |

**基线失败集（逐条，作为本单「不得扩大」的红线）**：
`src/test/accessibility/Accessibility.test.jsx`、`src/test/e2e/basic.spec.js`、`src/test/components/Card.test.jsx`（6 例）、`src/test/performance/VirtualList.test.jsx`（1 例）——均为**与本单无关的既有失败**（Card/VirtualList/Accessibility/e2e）。

**本单改造前的「已退役 10 键」值守现状（现取）**：
- `r9-90-participate-surface.test.jsx`：`:148` 附近**注释留痕**（断言已被 S25 移除）—— 渲染面护栏**消失**。
- `i18n-violation-closeout.test.jsx`：`:45`（REWRITTEN 清单注释）与 `:106-108`（④ 保真底线条目）两处**注释留痕** —— 存在性护栏**不存在**。
- `r9-90-participate-surface.test.jsx`：`§⑥` **已有一条**等价的存在性断言（S25 亲手加，`815c138` diff 现取）：
  `it.each(RETIRED_KEYS)('jobs.%s 已退役：四语均不存在 …')`，10 键 × 4 语 `hasOwnProperty=false`。

---

## §1 两处改造 · 前后逐字对照（证明不是空转）

### §1.1 ① 渲染面反面护栏（`r9-90-participate-surface.test.jsx`）

**旧式（`git show HEAD:…r9-90-participate-surface.test.jsx`，`:144-154`）逐字**：

```jsx
  it('标题 = `completeTask`（不再出现参与面标题 `jobs.apply`）', () => {
    renderModal({ tID: 9, title: 'T', note: 'N' })
    const header = document.querySelector('.modal-header')
    expect(header.textContent).toContain(zh.completeTask)
    // S25（B7）★值依赖型断言处置：原 `expect(header.textContent).not.toContain(zh.jobs.apply)` 的语义
    //   依赖 `jobs.apply` 的**值**（zh「申请报名」）；该键随死键退役四语对称删除 ⇒ 守卫失去可锚对象。
    //   与 `i18n-violation-closeout.test.jsx` 的 `jobs.acceptNote` 同款：**移除该行并留痕（非削弱）**；
    //   详见报告 §1「值依赖型断言」单列 —— 如需保留反面护栏，请 Zang 裁示是否改为硬编旧值「申请报名」。
  })
```

**旧式为何是「空转」的实证**（产物 `probe-literal-provenance.out`）：

```
zh.jobs.apply = undefined (种别: undefined )
旧断言 expect(header).not.toContain(zh.jobs.apply) 实际比较: false => not.toContain 恒 PASS(与 header 无关)
```

即 `text.includes(String(undefined))` ⇒ 恒 `false` ⇒ `not.toContain` 恒 PASS，**与 header 内容无关**（Zang 裁定：「键退役后该式取到 `undefined` ⇒ 空断言」）。

**新城（现取 `:144-170`）逐字**：

```jsx
  it('标题 = `completeTask`（不再出现参与面标题 `jobs.apply`；硬编退役旧值反面护栏）', () => {
    renderModal({ tID: 9, title: 'T', note: 'N' })
    const header = document.querySelector('.modal-header')
    expect(header.textContent).toContain(zh.completeTask)

    // S28-①（Zang 裁，硬编已退役字面量）：… 原 `expect(header.textContent).not.toContain(zh.jobs.apply)` 取的是
    //   `jobs.apply` 的**值**；该键随 S25-B7 四语对称退役 ⇒ 取值 `undefined` ⇒ `not.toContain(undefined)` **恒真（空转）**。
    //   裁：改钉**退役前旧值**；值随 S25 退役，此钉旧值作反面护栏（否则键已不存在 ⇒ 断言空转）。
    //   旧值出处：`git show 815c138^:frontend/src/locales/{zh,hk,en,vn}.json`（815c138 = S25-B7，取删除前一刻）。
    //   字面量按本仓纪律**拼接书写**（见 `p4z-feperf.test.js:30-33`：测试文件里的字面量可能被内容探测/扫描器当真实用法）。
    const RETIRED_APPLY_LITERAL = {
      zh: '申请' + '报名', // = S25 前 `jobs.apply`（zh）
      hk: '申請' + '報名', // = S25 前 `jobs.apply`（hk）
      en: 'Ap' + 'ply', // = S25 前 `jobs.apply`（en）
      vn: 'Ứng' + ' tuyển', // = S25 前 `jobs.apply`（vn）
    }
    // 非空转自证：① 拼接结果逐条非空（防拼错 ⇒ 又变空转）；② header 文本本身非空（否则 `not.toContain` 恒真）。
    expect(
      Object.values(RETIRED_APPLY_LITERAL).every((s) => s.trim().length > 0),
      '拼接字面量不得为空（否则反面断言空转）',
    ).toBe(true)
    expect(header.textContent.trim().length, 'header 文本不得为空（否则反面断言空转）').toBeGreaterThan(0)
    for (const [lang, literal] of Object.entries(RETIRED_APPLY_LITERAL)) {
      expect(header.textContent, `已退役措辞 ${lang}「${literal}」不得出现在标题渲染`).not.toContain(literal)
    }
  })
```

**「硬编字面量 = S25 删除前旧值」的出处自证**（产物 `probe-literal-provenance.out`，命令 `git show 815c138^:frontend/src/locales/<l>.json`）：

| 语 | S25 前 `jobs.apply`（git 旧值） | 本单硬编（拼接书写） | 相等 |
|---|---|---|---|
| zh | `"申请报名"` | `"申请报名"` | ✅ |
| hk | `"申請報名"` | `"申請報名"` | ✅ |
| en | `"Apply"` | `"Apply"` | ✅ |
| vn | `"Ứng tuyển"` | `"Ứng tuyển"` | ✅ |

四语全等 = **true**。

> **拼接书写纪律现取依据**：`frontend/src/test/unit/p4z-feperf.test.js:30-33` ——「`src/test` 里测试文件里的类名字面量会被当成真实用法**注入产物**。故判负用的越界类名与承重探针一律**以字符串拼接书写**，避免自己污染自己」。本单照该纪律拼接四语退役旧值。

### §1.2 ② 存在性负断言（`i18n-violation-closeout.test.jsx`）

**旧式（`git show HEAD:…i18n-violation-closeout.test.jsx`）逐字**：

```jsx
// :44-45（REWRITTEN 清单）
const REWRITTEN = [
  // S25（台账 B7 死键退役）：`jobs.acceptNote` 已随四语对称删除退役（产品面零引用）⇒ 自本改写集移出；改写集 33⇒32 键。
```
```jsx
// :107-108（④ 保真底线）
    // S25（B7）：`jobs.acceptNote` 已退役（四语对称删除）⇒ 该「只有雇主」保真锚失去守护对象，移除并留痕，**非削弱**：
    //   同族真信息锚（权限/已下线/手续费不退）仍在下方逐条断言（listings.refundNote / market.mineNote / claimRetiredNotice）。
```

两处均为**散文「已删除」** ⇒ 有人把退役键加回 locale，**无断言拦截**。

**新城**：两处注释**保留并指向单一归口**（`:46` / `:110`），并**新增** `it ⑥`（现取 `:137-171`）：

```jsx
  it('⑥ 退役键不得回归：S25-B7 退役 10 键 × 4 语一律不存在（存在即红）', () => {
    // S25-B7 退役清单（S25 删除前的 `jobs.*`；出处 `git show 815c138^:frontend/src/locales/*.json`）
    const RETIRED_JOBS_KEYS = [
      'apply', 'applyOk', 'accept', 'acceptNote', 'acceptOk',
      'applicationId', 'submitNeedApply', 'applyPrompt', 'applyWaiting', 'pick',
    ]
    const present = []
    for (const k of RETIRED_JOBS_KEYS) {
      for (const l of LANGS) {
        const full = `jobs.${k}`
        const has = Object.prototype.hasOwnProperty.call(flatTables[l], full)
        if (has) present.push(`${l}.${full} = ${JSON.stringify(flatTables[l][full])}`)
        expect(has, `${l}.${full} 已退役（S25-B7），不得回归`).toBe(false)
        expect(flatTables[l][full], `${l}.${full} 取值应为 undefined`).toBeUndefined()
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[I18N-VIOL] 退役键不得回归：… 节点；回归命中 = ${present.length}`)
    // 覆盖面自证：必须恰为 10 键 × 4 语 = 40 节点（防清单被误缩 ⇒ 断言空转）
    expect(RETIRED_JOBS_KEYS.length).toBe(10)
    expect(RETIRED_JOBS_KEYS.length * LANGS.length).toBe(40)
    expect(present).toEqual([])
  })
```

**去重（Zang「不重复建两份」之裁）**：S25 曾在 `r9-90-participate-surface.test.jsx §⑥` 建过**完全等价**的 10 键 × 4 语存在性断言（`hasOwnProperty=false`）⇒ 本单**合并归口**至 closeout ⑥（`r9-90 §⑥` 的重复移除，留下指针注释；见 §2 与 §6 自曝）。守卫**未削弱**：等价断言仍是 40 节点，且每节点由「1 条」升为「2 条」（`has=false` + `toBeUndefined`）。

---

## §2 退役键缺失断言的覆盖面（10 × 4 = 40）

**清单源**：S25-B7 退役 10 键（以 `815c138^` 为唯一真源）。
`jobs.apply / applyOk / accept / acceptNote / acceptOk / applicationId / submitNeedApply / applyPrompt / applyWaiting / pick`

**单一归口后，两处护栏合成的覆盖**（现取读数）：

| 维度 | 位置 | 键 × 语 | 断言形式 | 现取读数 |
|---|---|---|---|---|
| **键面**（存在性负断言） | `i18n-violation-closeout.test.jsx` §⑥ | **10 × 4 = 40 节点** | `hasOwnProperty=false` + `toBeUndefined()`（双条/节点） | `退役键不得回归：10 键 × 4 语 = 40 节点；回归命中 = 0` |
| **渲染面**（硬编旧值反面） | `r9-90-participate-surface.test.jsx` §① | 4 语 × 1 渲染面 | `header.textContent` 不得含 `申请报名`/`申請報名`/`Apply`/`Ứng tuyển` | 20 例全绿（`:144` 用例） |

- **四语对称**：`LANGS = ['zh','hk','en','vn']`（取自 `s8-locale-key-coverage` 同源口径）。
- **覆盖面自证**：⑥ 内 `expect(RETIRED_JOBS_KEYS.length).toBe(10)` + `… * LANGS.length).toBe(40)` ⇒ 清单被误缩会**立即红**（防空转）。
- **归口变更**：`r9-90 §⑥` 旧 `it.each(RETIRED_KEYS)`（10 沿用例，仅覆盖 `jobs.*` 子对象）→ 迁入 closeout ⑥（单用例，40 节点，走**拍平表**，并额外断言 `undefined`）。净用例数 −10 +1 = **−9**（见 §4 与 §6）。

---

## §3 判负 · 两读数（必做）

判负一律**只做产品 locale 的临时变异**（硬口径允许面）+ **立即复原**，并给出 `zh.json` 前后 sha256 相同。其余文件零改动。

### §3.1 判负 ①（渲染面）——把退役措辞注入被守护 header

- **变异**：`zh.json:65` `"completeTask": "完成任务"` → `"completeTask": "申请报名"`（使 header `<h3>{t('completeTask')}</h3>` 渲染出退役措辞）。
- **命令**：`npx vitest run src/test/unit/r9-90-participate-surface.test.jsx`
- **读数（红）**：`EXIT=1`；`Test Files 1 failed (1)`；`Tests 1 failed | 19 passed (20)`；
  ```
  AssertionError: 已退役措辞 zh「申请报名」不得出现在标题渲染: expected '申请报名✕' to not include '申请报名'
  ```
- **复原后（绿）**：`cp` 回备份 ⇒ sha256 `0835f5a78c8fe3bc938813a4d6027f4b29f796e9db984af579874fa1dd6727d8`（与 §0 前值 `diff` **IDENTICAL ✓**）；`npx vitest run …r9-90…` ⇒ `EXIT=0`，`Tests 20 passed (20)`。

### §3.2 判负 ②（键面存在性）——把退役键加回 zh

- **变异**：`zh.json:82` `"jobs": {` ⇒ 其后插入 `"pick": "选为提交对象",`（S25 前旧值）。
- **命令**：`npx vitest run src/test/unit/i18n-violation-closeout.test.jsx`
- **读数（红）**：`EXIT=1`；`Tests 3 failed | 3 passed (6)`；命中 = **⑥（本单新断言）** + ⑤（键数 1050 前推） + ②（脚本作用域节点数 4200 前推）：
  ```
  FAIL … > ⑥ 退役键不得回归：S25-B7 退役 10 键 × 4 语一律不存在（存在即红）
  AssertionError: zh.jobs.pick 已退役（S25-B7），不得回归: expected true to be false // Object.is equality
  ```
  即：**把「已删除」升为「不得复发」后，任一退役键回归都被 ⑥ 直接拦截**（且顺带撞 ⑤/② 的计数前推）。
- **复原后（绿）**：`cp` 回备份 ⇒ sha256 **IDENTICAL ✓**；`npx vitest run …closeout…` ⇒ `EXIT=0`，`Tests 6 passed (6)`，`退役键不得回归：10 键 × 4 语 = 40 节点；回归命中 = 0`。

**两处复原后 `zh.json` sha256 前后相同**（`0835f5a7…6727d8`）：主仓零残留、四语 locale 零改动。

---

## §4 硬门

**改动面（`git status --porcelain` 现取）**：仅
```
 M frontend/src/test/unit/i18n-violation-closeout.test.jsx
 M frontend/src/test/unit/r9-90-participate-surface.test.jsx
?? frontend/.s28-artifacts/
```
（其余 176 行未跟踪项为**开工前既有**、非本单产物；无 `M src/locales/**`、无产品页面/后端/spec/master-plan 改动；未 `npm install`；未触 `.env*`；未启停 5787/5788；**未 commit / 未 push**。）

| 门 | 命令 | 基线 | 本单 | 判定 |
|---|---|---|---|---|
| 单测 | `npx vitest run` | `4 failed \| 50 passed (54)`；`7 failed \| 480 passed (487)` | `4 failed \| 50 passed (54)`；`7 failed \| 471 passed (478)` | **failed ≤ 基线**；失败集 `diff` **逐条相同** ✅（唯一差异 = 用例总数 −9，见下） |
| 失败集 | `diff baseline-failed.txt final-failed.txt` | — | 空 | **IDENTICAL FAILED SET ✓** |
| 构建 | `npm run build` | exit 0 | **exit 0**（`✓ built in 1.65s`） | ✅ |
| 四脚本 | `node scripts/{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.mjs` | 全 PASS | **全 exit 0 / 全 PASS** | ✅ |
| 退役键覆盖 | ⑥ 打印 | — | `10 键 × 4 语 = 40 节点；回归命中 = 0` | ✅ |

四脚本末行（现取）：
`[TR-2] 总判：PASS` · `[I18N-VIOL] 总判：PASS（… 作用域节点数 locale=4200 / source=48）` · `VERDICT=PASS` · `[MISC-FIX-LINKS] 总判：PASS（残留全部已登记）`。

**用例总数 −9 的构成（自曝，非削断言）**：`−10`（`r9-90 §⑥` 旧 `it.each(RETIRED_KEYS)` 的 10 个用例随去重迁出）+ `+1`（closeout ⑥）= **−9**。等价断言仍覆盖同一 **40 节点**，且每节点由 1 条升为 2 条 —— 见 §6。

---

## §5 未做与 NOT_MEASURED

**未做**：
- 未新建任何代码文件（硬口径：新文件只允许报告与产物）—— 未引入共享键清单模块，去重改为「单一归口现有文件」。
- 未改 `frontend/src/locales/**`（**零残留**，sha256 复原相同）；未碰产品页面 / `backend-ts/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`。
- 未 commit / 未 push；未 `pkill -f` / `killall`；未 `npm install`；未触 `.env*`；未启停 5787/5788。

**NOT_MEASURED**：
- `npm run lint` / `npx eslint`：**frontend 根无 ESLint 配置文件**（`--report-unused-disable-directives` 亦无 config）⇒ 退出码 2 且为**开工前既有**，非本单引入。未作为本单门（不在 Zang 指定四脚本内）。
- 其它测试分面（`test:e2e` Playwright / `test:coverage`）未跑（非本单门）。
- 后端 `backend-ts` 全量门未跑（本单零后端改动）。
- 判负仅覆盖「渲染面 ①（zh 注入）」与「存在性 ②（zh 加回 `jobs.pick`）」两条路径；**未**逐语（hk/en/vn）各做一次注入判负 —— 四语路径按同一代码路径（`for…of LANGS` / `Object.entries`）覆盖，属**代码推断**而非逐语实测。

---

## §6 自曝

1. **净用例数 −9 是「去重」而非「删断言」**：`r9-90 §⑥` 旧 `it.each(RETIRED_KEYS)`（S25 亲手加，`815c138`）与本单 closeout ⑥ **完全等价**（10 键 × 4 语存在性负断言）。按 Zang「若 S25 已建等价断言 ⇒ 合并去重，不重复建两份」之裁，将唯一真源**归口**至 closeout ⑥（`r9-90 §⑥` 留指针注释）。等价断言**仍在**，覆盖 40 节点不变，且每节点断言由 1 条（`hasOwnProperty=false`）升为 2 条（+ `toBeUndefined`）。**若 Zang 认为应保留 `r9-90 §⑥` 就地双写**，本单可回退该合并 —— 但那样即构成「两份」，与裁定相悖。
2. **判负的变异面是产品 locale**：硬口径只允许 `src/locales/**` 作临时变异 ⇒ ① 的注入走 `zh.completeTask`（使 header 真渲染出退役措辞），② 的注入走 `zh.jobs.pick`。二者均已 `cp` 复原，sha256 前后相同。**未**改产品页面/测试源作注入。
3. **① 的四语硬编字面量对 hk/en/vn 是「防御性冗余」**：该用例 `H.lang='zh'`（header 实际渲染 zh），故 hk/en/vn 三条 `not.toContain` 目前恒真 —— 但其作用在于「一旦任何语言渲染出这四族退役措辞即红」，且与 `LANGS` 同族口径一致；已在 §5 标注未逐语注入。
4. **`RETIRED_JOBS_KEYS` 清单在两文件间靠注释互指而非代码共享**（硬口径禁新建代码文件）⇒ 存在**漂移**风险；缓解：⑥ 内 `toBe(10)` + `toBe(40)` 自证，且两处注释互相指名。
5. **`r9-90 §⑥` 的 describe 标题**由「B7：10 键退役 / 未退役存量键仍在」改为「B7：未退役存量键仍在」—— 与该处现存断言一致（退役键断言已迁出）。

---

## 附 · 交付物与产物

**改动文件**：
- `frontend/src/test/unit/r9-90-participate-surface.test.jsx` — sha256 `7497532c321d87ac536e41c9ffb3b6bae519f090047422f9b74fcf5515c18718`
- `frontend/src/test/unit/i18n-violation-closeout.test.jsx` — sha256 `970db9cb37f8a9c45fa07daf5ebfe12d03e3b2d43be50121d5c470cd0a7e136e`

**产物目录** `frontend/.s28-artifacts/S28-20261004T132021Z/`：
`baseline-vitest.out` `baseline-failed.txt` `baseline-<4 脚本>.out` · `final-vitest.out` `final-failed.txt` `final-build.out` `final-<4 脚本>.out` · `pos-two-files.out` · `nc1-r9-90.out` `nc1-restored-green.out` · `nc2-closeout.out` `nc2-restored-green.out` · `probe-literal-provenance.out` · `sha-locales-before.txt` `sha-zh-after-restore.txt` `sha-zh-after-restore2.txt` `sha-testfiles-new.txt` · `zh.json.bak`（判负备份）
（原始输出一律 `.out`，**未用 `.log` 后缀**。）
