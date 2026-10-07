# S44 · 路线图 R1：前端「7 个常红测试」三态定性收口

- 角色：Kong ｜ 仓库：`/Users/kevin/bistro/seafood` ｜ 面：`frontend/`
- 产物：`frontend/.s44-artifacts/s44-r1-20261007T082052/`（`evidence/` 含 before/after/probe/negative-controls/changes.diff）
- 语言：中文 ｜ 结论口径：逐例三态 (a) 真缺陷 /(b) 判据过期 /(c) 环境性·残留件

---

## §0 对锚

```
$ git log --oneline -3
fa9d8ac docs: §5.370/v0.370 —— 后续路线图 R1–R6（现取定稿）…
482059f chore: S42 证据链产物加 .gitignore… + S43…+ ★新登记 B21
0a2b886 docs: §5.368/v0.368 …

$ git status --porcelain      # 开工时
（空）
```

- HEAD 含 `fa9d8ac`：✔（与派单锚一致）。
- 开工前工作树干净：✔。
- 收工时 `git status --porcelain`（**仅允许面**）：

```
 M frontend/src/components/ui/Button.jsx
 M frontend/src/components/ui/Modal.jsx
 M frontend/src/test/accessibility/Accessibility.test.jsx
 M frontend/src/test/components/Card.test.jsx
 M frontend/src/test/performance/VirtualList.test.jsx
 M frontend/vitest.config.js
?? docs/audit/s45-prod-vs-dev-db-identity.md   ← 非本单产物（他人留下，未触碰）
```

> `.s44-artifacts/` 被 `.gitignore:342 **/.*-artifacts/` 命中（`git check-ignore` 已验证），不入 `git status`。
> 未 commit、未 push、未起停任何服务、未 `npm install`、未碰 `.env*`、未用 `pkill/killall`。

复现原始红（现取，自己跑过一遍）：

```
$ frontend $ npx vitest run
 Test Files  4 failed | 50 passed (54)
      Tests  7 failed | 471 passed (478)
```

四类失败文件：`Card.test.jsx`(6) / `VirtualList.test.jsx`(1) / `Accessibility.test.jsx`(0 test, Transform failed) / `e2e/basic.spec.js`(0 test, 误收集)。**与派单一致**。

---

## §1 四类逐例三态定性表

> 行号 = **改动前**原始行号。`实际` 全部来自现取读数（`evidence/probe.txt` / before 报告），非记忆。

| # | 文件:行 | 断言 | 实际（现取） | 定性 | 处置 |
|---|---|---|---|---|---|
| 1 | `Card.test.jsx:10` | `card.parentElement` toHaveClass `bg-white`,`border-gray-200` | `card.parentElement` = RTL 容器，`className=""`；Card 根 = `rounded-lg border p-6 transition-all duration-300 bg-white border-gray-200 hover:shadow-lg hover:-translate-y-1` | **(b) 判据过期**（量错元素：尺子对准容器而非组件） | 改期望：断言目标改 `card`（Card 根）；类名 `bg-white,border-gray-200` 本就正确、未动 |
| 2 | `Card.test.jsx:16,20` | `card.parentElement` toHaveClass `bg-yellow-50,border-yellow-200`（及 rerender success `bg-green-50,border-green-200`） | 同上，parentElement 类空；primary 根=`…bg-yellow-50 border-yellow-200…`；success 根=`…bg-green-50 border-green-200…` | **(b) 判据过期**（量错元素） | 改期望：目标改 `card`；色板类**一字未变** |
| 3 | `Card.test.jsx:27` | CardHeader toHaveClass `p-6`,`pb-4` | `flex flex-col space-y-1.5 pb-4` | **(b) 判据过期** | 改期望为实际全类串（`p-6` 从来在 **Card 根**，非 Header） |
| 4 | `Card.test.jsx:34` | CardTitle toHaveClass `text-lg`,`font-semibold`,`text-gray-900` | `font-semibold text-lg leading-none tracking-tight` | **(b) 判据过期** | 改期望为实际全类串（`text-gray-900` 从不在 Title） |
| 5 | `Card.test.jsx:41` | CardContent toHaveClass `p-6`,`pt-0` | `pt-0` | **(b) 判据过期** | 改期望为实际全类串（`p-6` 从来在 Card 根，非 Content） |
| 6 | `Card.test.jsx:61` | `card.parentElement` toHaveClass `hover:shadow-lg`,`transition-shadow` | parentElement 类空；且 `<Card hover>`（**布尔**）⇒ `cardVariants.hover[true]===undefined` ⇒ 连根都无 hover 类 | **(b) 判据过期**（元素错位 + 枚举 prop 被当布尔用 + `transition-shadow` 非现实现，实为 `transition-all`） | 改期望：`hover="lift"` + 断言 Card 根 `hover:shadow-lg`,`hover:-translate-y-1` |
| 7 | `VirtualList.test.jsx:90` | `firstItemBefore` not.toBe `firstItemAfter` | 二者皆为 `<div data-testid="item-0">`（滚动未发生） | **(b) 判据过期**（测试假设存在 `scrollTop` prop，组件自管滚动、**从未有该 prop**） | 改期望：以真实滚动事件驱动（`fireEvent.scroll`），见 §2.7 |
| 8 | `Accessibility.test.jsx`（整文件） | `Transform failed … 202:13 ERROR: Expected ")" but found "id"` + `Tests no tests` | esbuild 转译失败：**199–203 行两枚相邻根 JSX 元素未包 fragment**；其引用的 `@components/ui` 模块 `Button/Card/Modal/Form` **全部存在** | **(c) 残留件/坏文件**（非模块缺失，是文件自身语法错） | 按「修引用」处置：补 fragment 包裹（**不删文件**），见 §2.8 |
| 9 | `e2e/basic.spec.js`（整文件） | `Playwright Test did not expect test.describe() to be called here` + `Tests no tests` | 内容是 **Playwright** spec（`import { test, expect } from '@playwright/test'`），文本为 **jinli 遗留**（`Jinli Club E2E Tests`/`欢迎来到金立俱乐部`）；被 vitest 默认 `*.spec.js` 收集 | **(c) 环境性/残留件**（Playwright spec 被 vitest 误收集） | 从 **vitest 收集面排除**（改 `vitest.config.js`），**不删文件**，见 §2.9 |

**7 红定性小结**：#1–#7 全部 (b) 判据过期（**产品无误**，改的是尺子）；#8/#9 为 (c)（文件级，非断言）。

### §1.b 修好 #8 的**编译**后**新暴露**的断言（次生面，逐条也给了定性）

> 修 `Transform failed` ⇒ 该文件由「0 test」变为「16 test」，其中 6 例立刻红（说明该文件同时还是一份「想当然」的陈旧套件）。逐条定性如下（**均已处置**）：

| # | 文件:行 | 断言 | 实际 | 定性 | 处置 |
|---|---|---|---|---|---|
| 8a | `Accessibility.test.jsx:26` | `<Button loading>` → `aria-busy="true"` | Button **无 `loading` 语义**，原样落 DOM 属性、无 `aria-busy` | **(a) 真缺陷（轻）**：可访问按钮应能播报 busy | 修实现：`Button` 增 `loading` → `aria-busy`，见 §2.10 |
| 8b | `Accessibility.test.jsx:76,88,167` | `getByRole('dialog')` / `aria-modal="true"` / `role="dialog"` | `ui/Modal` 的内容框**无 `role`、无 `aria-modal`** ⇒ `getByRole('dialog')` 直接抛错（3 例） | **(a) 真缺陷**：对话框缺 ARIA 角色；仓内 `LoginModal.jsx:46-47` **已**设同名约定 | 修实现：`ui/Modal` 内容框补 `role="dialog" aria-modal="true"`，见 §2.11 |
| 8c | `Accessibility.test.jsx:115` | `<input required>` → `aria-required="true"` | React 落的是 DOM 属性 `required`，**不会**自动补 `aria-required` | **(b) 判据过期**（断言了对原生元素非真的属性） | 改期望：`toBeRequired()` |
| 8d | `Accessibility.test.jsx:151,156` | 手动 `dispatchEvent(keydown)` 后期望 `onClick` 被调 | jsdom 对「手动 dispatch 的 keydown」**不合成默认动作(click)** ⇒ 未调用 | **(c) 环境性**（jsdom 缺浏览器默认动作） | 改测法：改用 `@testing-library/user-event` 走默认动作 |

---

## §2 逐条处置与证据

### §2.0 硬证据：`getByText` 落在哪、`parentElement` 是谁

现取探针 `evidence/probe.txt`（临时文件 `src/test/components/zz-s44-probe.test.jsx`，**跑完即删**）：

```
PROBE card.tagName= DIV
PROBE card.className= "rounded-lg border p-6 transition-all duration-300 bg-white border-gray-200 hover:shadow-lg hover:-translate-y-1"
PROBE card.parentElement.className= ""
PROBE card.parentElement === container ? true          ← parentElement 恒为 RTL 容器
PROBE primary.className= "… bg-yellow-50 border-yellow-200 …"
PROBE success.className= "… bg-green-50 border-green-200 …"
PROBE header.className= "flex flex-col space-y-1.5 pb-4"
PROBE title.className= "font-semibold text-lg leading-none tracking-tight"
PROBE content.className= "pt-0"
PROBE hover.className= "rounded-lg border p-6 transition-all duration-300 bg-white border-gray-200"   ← <Card hover> 布尔 ⇒ 无 hover 类
```

> 该读数同时钉死 #1/#2/#6 的真因（`parentElement===container`）、#6 的布尔误用、以及 #3/#4/#5 的实现侧真值。

### §2.1–2.5 Card 组件侧证据（判据过期的「尺子 vs 产品」）

**产品未改**的证明：`frontend/src/components/ui/Card.jsx` 样式串自其**建文件提交 `13026fd`（2026-03-25）**起即为现形，`9284fc1`（2026-10-02）只做「形状收敛」（`rounded-xl→rounded-lg`、`border-2→border`、去 `shadow-sm` 色板阴影）——

```
$ git log --oneline -- frontend/src/components/ui/Card.jsx
9284fc1 feat(ui): 第二批形状收敛 B 成套…
13026fd feat: 大幅优化前端UI和用户体验        ← 建文件
$ git show 13026fd^:frontend/src/components/ui/Card.jsx
fatal: … exists on disk, but not in '13026fd^'   ← 确认 13026fd 新建
```

比对 `13026fd` 与当前 `Card.jsx`：`Header/Title/Content` 三段类串**逐字相同**（`flex flex-col space-y-1.5 pb-4` / `font-semibold text-lg leading-none tracking-tight` / `pt-0`）。⇒ **#3/#4/#5 的旧期望在组件存在之初就不成立**，非本次改动所致。测试作者于 `d138b10`（2026-03-26，Card.jsx 建文件次日）写下该文件，此后从未随组件推进（`git log -- Card.test.jsx` 仅该一笔）。

处置（改期望为**实现全类串**，比旧串更紧、非删断言）：

```
- expect(header).toHaveClass('p-6', 'pb-4')
+ expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'pb-4')

- expect(title).toHaveClass('text-lg', 'font-semibold', 'text-gray-900')
+ expect(title).toHaveClass('font-semibold', 'text-lg', 'leading-none', 'tracking-tight')

- expect(content).toHaveClass('p-6', 'pt-0')
+ expect(content).toHaveClass('pt-0')
```

### §2.6 Card：元素错位 + 枚举误用

```
- expect(card.parentElement).toHaveClass('bg-white', 'border-gray-200')
+ expect(card).toHaveClass('bg-white', 'border-gray-200')
…（primary/success 同理去 parentElement）

- render(<Card hover>Hoverable card</Card>)
- expect(card.parentElement).toHaveClass('hover:shadow-lg', 'transition-shadow')
+ render(<Card hover="lift">Hoverable card</Card>)
+ expect(card).toHaveClass('hover:shadow-lg', 'hover:-translate-y-1')
```

`hover` 是**枚举** prop 的证据（产品侧）：

```
$ grep -rn 'hover=' src --include=*.jsx | grep -v /test/
src/components/task/TaskCard.jsx:55:      hover="lift"
src/components/reward/RewardCard.jsx:44:      hover="glow"
```

⇒ 应用侧一律用字符串枚举；`<Card hover>`（布尔）⇒ `cardVariants.hover[true]===undefined` ⇒ **不落 hover 类**（探针已复现）。测试误用，产品无错。`transition-shadow` 亦非现实现（基础类为 `transition-all duration-300`，已覆盖阴影过渡）。

### §2.7 VirtualList：测试假设了不存在的 `scrollTop` prop

产品侧证据 —— `src/components/ui/Performance.jsx` 的 `VirtualList` 签名与实现（**与建文件提交 `07360a3` 逐字相同**）：

```jsx
const VirtualList = ({ items, itemHeight=50, containerHeight=400, renderItem, className }) => {
  const [scrollTop, setScrollTop] = useState(0)          // 自管
  …
  const handleScroll = useCallback((e) => setScrollTop(e.target.scrollTop), [])
  …
  <div ref={containerRef} className={cn('overflow-auto', className)} style={{height: containerHeight}} onScroll={handleScroll}>
```

```
$ git show 07360a3:frontend/src/components/ui/Performance.jsx | grep -A4 'const VirtualList'
（同上，无 scrollTop prop）
```

探针复现（`evidence/probe.txt`）：

```
PROBE before ids= item-0,item-1,item-2,item-3,item-4
PROBE after rerender(scrollTop=500) ids= item-0,…  ← prop 无效
PROBE after fireEvent.scroll(500) ids= item-10,item-11,item-12,item-13,item-14  ← 真实滚动
```

处置（改为驱动**真实**滚动容器）：

```
- const { rerender } = render(<VirtualList … />)
- rerender(<VirtualList … scrollTop={500} … />)
+ const { container } = render(<VirtualList … />)
+ const scroller = container.querySelector('.overflow-auto')
+ fireEvent.scroll(scroller, { target: { scrollTop: 500 } })
```

断言（`length` 相等 + 首项不同）**保留未删**。

### §2.8 Accessibility：模块存在 ⇒ 只修引用（补 fragment）

被引用模块**全部存在**：

```
$ ls -la src/components/ui/{Button,Card,Modal,Form}.jsx
-rw … Button.jsx   -rw … Card.jsx   -rw … Modal.jsx   -rw … Form.jsx
$ grep -n 'export { Button }' etc → src/components/ui/index.js 第 2/3/25/32 行全部在位
```

真因是**文件自身语法**（非缺失模块）：

```
$ npx vitest run src/test/accessibility/Accessibility.test.jsx
Error: Transform failed with 1 error:
/…/src/test/accessibility/Accessibility.test.jsx:202:13: ERROR: Expected ")" but found "id"
```

第 199–203 行原为两枚相邻根元素（`<Button>…</Button>` 紧跟 `<div id="help-text">…`）——JSX 不允许「一个表达式两个根」。处置（**最小修引用**，不动任何断言）：

```
 render(
-  <Button aria-describedby="help-text">Help</Button>
-  <div id="help-text">Click for help</div>
+  <>
+    <Button aria-describedby="help-text">Help</Button>
+    <div id="help-text">Click for help</div>
+  </>
 )
```

修后该文件 16/16 全绿（次生面另见 §1.b / §2.10–2.11 / §2.12）。

### §2.9 e2e/basic.spec.js：从 vitest 收集面排除（不删文件）

`vitest.config.js` 是 vitest 的**生效**配置（优先于 `vite.config.js`）。改 `test.exclude`（附 `configDefaults.exclude` 以保留 node_modules/dist 等默认排除，避免误伤正当单测）：

```
-import { defineConfig } from 'vitest/config'
+import { defineConfig, configDefaults } from 'vitest/config'
   test: {
     environment: 'jsdom',
     setupFiles: ['./src/test/setup.js'],
-    globals: true
+    globals: true,
+    exclude: [...configDefaults.exclude, 'src/test/e2e/**']
   },
```

- 排除面**精确到 `src/test/e2e/**`**（Playwright 的 `testDir`），不触及任何 `*.test.js(x)` 单测。
- **文件保留**：`src/test/e2e/basic.spec.js` 仍在盘上（`5461` 字节，mtime 未变）——不作废历史路径引用；`playwright.config.js` 的 `testDir: './src/test/e2e'` 不受影响。
- 该文件非本单删改对象 ⇒ **无删除类** ⇒ §「存档+cmp+revert+零引用」硬要求**不触发**（`deleted/` 目录为空）。

### §2.10 Button：补 `loading` → `aria-busy`（真缺陷，轻）

```
   size = 'md',
   disabled = false,
+  loading = false,
   children,
   …props
       disabled={Component === 'button' ? disabled : undefined}
       aria-disabled={disabled || undefined}
+      aria-busy={loading || undefined}
       {...props}
```

- 非破坏：`loading` 默认 `false` ⇒ 现有 `<Button>` 行为逐字不变；应用侧 `disabled={loading}` 写法不受影响。
- 使 `<Button loading>` 的 `aria-busy` 语义真成立（原实现把 `loading` 原样透传到 DOM，无 `aria-busy`）。

### §2.11 ui/Modal：补 `role="dialog"` + `aria-modal="true"`（真缺陷）

```
       <div
         ref={modalRef}
+        role="dialog"
+        aria-modal="true"
         className={cn('relative bg-white rounded-xl shadow-2xl …')}
```

- 依据仓内**既有约定**（同一仓另一模态已如此）：

```
$ grep -rn 'role="dialog"\|aria-modal' src --include=*.jsx | grep -v /test/
src/components/LoginModal.jsx:46:      role="dialog"
src/components/LoginModal.jsx:47:      aria-modal="true"
```

- 仅供 ARIA 语义，不改类串/结构；`ui/Modal` 的真实消费者（`PointsManagement`/`RewardsManagement`/`TasksManagement`/`PermissionsManagement`）视觉不变。

### §2.12 Accessibility 的两处「改测法」（8c / 8d）

```
- expect(input).toHaveAttribute('aria-required', 'true')
+ expect(input).toBeRequired()                        // <input required> 落的是 required

- it('…', () => { button.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',…})) … })
+ it('…', async () => {
+   const user = userEvent.setup()
+   await user.keyboard('{Enter}')  …  await user.keyboard('[Space]')
+ })
```

---

## §3 全量判据 · 前后对照

| 判据 | 前（现取） | 后（现取） | 结论 |
|---|---|---|---|
| ① `npx vitest run` | **4 failed \| 50 passed (54)** ；**Tests 7 failed \| 471 passed (478)** | **53 passed (53)** ；**Tests 494 passed (494)** | 7 红全消；文件数 54→53（e2e 从收集面移除）；测试数 478→494（`Accessibility` 由 0→16） |
| ↳ Card 单文件 | 7 tests / 6 failed | 7/7 pass | ✔ |
| ↳ VirtualList 单文件 | 5 tests / 1 failed | 5/5 pass | ✔ |
| ↳ Accessibility 单文件 | 0 test（Transform failed） | 16/16 pass | ✔ |
| ↳ e2e/basic.spec.js | 被收集 → FAIL | **不再被收集**（文件仍在盘） | ✔ |
| ② `npx vitest run src/test/unit/s22-decor-cleanup.test.js` | （未复跑前值） | **9 passed (9)** | 「仍 9/9」✔；本单 diff 未触 `styles.css` |
| ③ `npm run build` | （未复跑前值） | `exit=0`，`✓ built in 1.62s` | ✔ |
| ④ 四脚本 | （未复跑前值） | 全 `PASS`/`exit=0` | ✔ |

四脚本逐条读数（后）：

```
p4z-feperf-safelist   → VERDICT=PASS          (exit 0)
p4z-i18nviol-global   → [I18N-VIOL] 总判：PASS (locale 裸命中 0 + 源面裸命中 0)   (exit 0)
p4z-miscfix-links     → [MISC-FIX-LINKS] 总判：PASS（残留全部已登记）             (exit 0)
p6-tr2-i18n-locales   → [TR-2] 总判：PASS                                          (exit 0)
```

---

## §4 判负（负对照：每处改动「反向改回 ⇒ 必红」）

一次性脚本：自 `HEAD` 取回原文件覆盖 → 跑 → 恢复 → `cmp` 自证一致。全程读数见 `evidence/negative-controls.txt`。

| NC | 反向动作 | 必红读数（现取） | 恢复后 `cmp` |
|---|---|---|---|
| 1 | `Card.test.jsx` → 旧期望（`parentElement` + 布尔 `hover`） | `Tests 6 failed \| 1 passed (7)` | identical |
| 2 | `VirtualList.test.jsx` → 旧期望（prop `scrollTop`） | `Tests 1 failed \| 4 passed (5)`（`updates visible items on scroll`） | identical |
| 3 | `Modal.jsx` → 去 `role/aria-modal` | `Tests 3 failed \| 13 passed (16)`（trap focus / ARIA labels / escape） | identical |
| 4 | `Button.jsx` → 去 `aria-busy` | `Tests 1 failed \| 15 passed (16)`（`should announce loading state`） | identical |
| 5 | `Accessibility.test.jsx` → 去 fragment | `Transform failed with 1 error` + `Tests no tests` | identical |
| 6 | `vitest.config.js` → 去 `exclude` | `FAIL src/test/e2e/basic.spec.js` + `Tests no tests` | identical |

⇒ **改期望者反向改回必红；改实现者（Button/Modal）插回旧形态必红；配置改动反向必红。** 六项全绿前均先证「红」。

（末次全量复跑，确认恢复无误：`Test Files 53 passed (53)`；`Tests 494 passed (494)`。）

---

## §5 未做与 NOT_MEASURED

- `NOT_MEASURED`：`npm run build` / 四脚本 / s22 的**「前值」未复跑**（改动不触及构建链与 `styles.css`，且属派单给定前提）；本单只取「后值」。若需严格前后，请裁。
- `NOT_MEASURED`：`e2e/basic.spec.js` 的 **Playwright 实跑真伪**。仅验证「不被 vitest 收集」；实跑需起 `5777` 服务 —— **硬口径禁起服务**，故不做。
- **未做**：任何删除。`frontend/.s44-artifacts/<runid>/deleted/` 为空 ⇒ 无删除类，故未出「存档 + `cmp` + revert 清单 + 零引用自证」。
- **未做**：`docs/*.spec.md`、`docs/OPEN-ITEMS.md`、`docs/seafood.master-plan.md`、`backend-ts/**`、`migrations/**` 一律未动。
- **未做**：`ui/Modal` 的 **focus-trap 实现**（测试名 `should trap focus within modal` 实际只断言 `aria-modal`；未引入 focus 循环，避免超范围）。
- 非本单产物 `docs/audit/s45-prod-vs-dev-db-identity.md`（`??`）**未触碰**。

## §6 自曝（边界判断与判准）

1. **`Button` 加 `loading→aria-busy` 的定性存在边界**：严格看它更像「补一个此前从未存在的 prop」，我按 **(a) 真缺陷（轻——可访问按钮应能播报 busy）** 处置；选它的核心理由是**「严禁为凑绿删断言」**（替代方案是把该 `it` 的 `aria-busy` 断言删/改，反而更差），且仓内确有大量 `disabled={loading}` 的按钮。若主审认为应归 (b) 改测，请裁。
2. **`ui/Modal` 加两枚 ARIA 属性是产品行为变更**（DOM 多两属性）；依据是与仓内既有 `LoginModal.jsx:46-47` 约定一致、且属纯语义增益。若视为超范围，可回退（回退即 NC-3 必红）。
3. **Card #3/#5 的期望被「收紧为实际全类串」**：`p-6` 从 `Header/Content` 的期望中**消失**——这不是删断言凑绿，而是「`p-6` 从来在 **Card 根**」（`13026fd` 建文件起即如此，`Header/Content` 段落逐字未变）；反向改回必红（NC-1）。
4. **`card.parentElement` 之错系测试自写即错**：Card 两版实现（`13026fd`/`9284fc1`）均把 children 直接放进样式根 ⇒ `getByText` 返回根、`parentElement` 恒为 RTL 容器（探针 `parentElement===container` 已证）。
5. **`Accessibility.test.jsx` 定性为本单「次生面」**：派单只要求它「能编译」，但修好编译后立刻暴露 6 例断言问题，我一并逐条定性/处置；其中 Modal/Button 触发了组件改动（均在允许写面内）。若认为次生面应留作独立单，可只保留 §2.8 的 fragment 修复。
6. 未 commit / 未 push；未起停服务；未 `npm install`；未碰 `.env*`。
