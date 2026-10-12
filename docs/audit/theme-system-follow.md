# 主题系统 · 首次访问跟随系统（prefers-color-scheme）· 实施读数

- 日期：2026-10-12 · 实现：Kong · 口径：Zang（可判负判据见 §2）
- 单据：「首次访问（未显式选过主题）跟随系统 prefers-color-scheme」
- 基线：`07a3927`（工作区干净）

## 1. 改动清单（文件:行号）

| 文件 | 位置 | 内容 |
| --- | --- | --- |
| `frontend/index.html` | 15–38 行 | 首帧内联脚本（React 渲染之前）：显式存储 `theme ∈ {dark,light}` ⇒ 沿用；否则 `matchMedia('(prefers-color-scheme: dark)')` ⇒ 设 `data-theme`；matchMedia 不可用/抛错 ⇒ try/catch 回退 `light`。**跟随系统的结果不落盘** |
| `frontend/src/theme/ThemeProvider.jsx` | 22–26 行 | `applyTheme` 收敛为「只设 `data-theme` 属性」（原内联的 localStorage 写入移出） |
| `frontend/src/theme/ThemeProvider.jsx` | 28–38 行 | 新增 `persistTheme`（落盘 = 仅用户显式选择；写失败静默，语义同原实现） |
| `frontend/src/theme/ThemeProvider.jsx` | 57–67 行 | `setTheme` / `toggleTheme` 显式调用 `persistTheme(next)`；初次挂载 effect 只 `applyTheme` 不落盘 |
| `frontend/src/test/unit/theme-shell-isomorphism.test.jsx` | 287–381 行 | 新增 describe「主题 · 首次访问跟随系统」6 例（§4） |

- `readInitialTheme()` **一字未改**（fromAttr 优先，天然吃到 index.html 从系统写下的属性值）。
- `src/main.jsx` 启动读值**一字未改**（无存储时两分支都不触发，不会覆盖 index.html 写下的属性）。
- 未新增依赖；未动 `src/shell/**`、`docs/design/**`、`ctrl/**`、i18n/路由/`/item` 家族/catch-all 页。

## 2. 可判负判据核对

「无存储 + 系统暗 ⇒ 初始夜档，且 `localStorage['theme'] === null`」——CDP 读数①逐字满足（§3）。

## 3. 真浏览器 CDP 读数（四条）

> ⚠ origin 偏差说明：任务指定 `127.0.0.1:5787`，但该 dev server **只绑 IPv6 `[::1]`**（lsof：`TCP [::1]:5787`；`curl http://127.0.0.1:5787/` 连接拒绝，正文为空）。改用 **`http://[::1]:5787`** —— 与 `http://localhost:5787` 是**不同 origin 字符串** ⇒ localStorage 独立命名空间，「首访态」语义完全等价。开始前 `localStorage.clear()`，该 key 此前即无值（pre-existing = null）。
>
> 方法：CDP `Emulation.setEmulatedMedia` `features:[{name:'prefers-color-scheme', value:…}]` + `location.reload()`；每态读 `documentElement.getAttribute('data-theme')`、`getComputedStyle(documentElement).colorScheme`、`localStorage.getItem('theme')`。

| # | 操作 | data-theme | colorScheme | localStorage['theme'] |
| --- | --- | --- | --- | --- |
| ① | 模拟 `prefers-color-scheme: dark` + 刷新（无存储） | `dark` | `dark` | **`null`（未落盘 ✓）** |
| ② | 模拟 `light` + 刷新（无存储） | `light` | `light` | `null` |
| ③a | 系统仍模拟 light，**真点**主题钮（Header `button.nav-link[aria-label="深夜模式"]`） | `light → dark` | `dark` | **出现 `"dark"`（= 切换后值 ✓）** |
| ③b | ③a 后刷新（系统仍 light） | `dark`（用户档压过系统档） | `dark` | `"dark"` |

- 收尾：测试 origin 的 `localStorage.clear()` 已执行并复核（`stored = null`），`Emulation.setEmulatedMedia` 已解除（`features:[]`），刷新复核干净首访态 = `attr:'light', stored:null`。

## 4. 单测（jsdom · 既有主题测试文件内新增 6 例）

文件：`src/test/unit/theme-shell-isomorphism.test.jsx` describe「主题 · 首次访问跟随系统（…2026-10-12 单）」

1. ① 无存储 + `data-theme="dark"`（模拟 index.html 跟随系统）⇒ `readInitialTheme() = 'night'`
2. ② 无存储 + 无属性 ⇒ `'day'`（DEFAULT_THEME 语义不变）
3. ③ 有存储 ⇒ 存储决定档位（`dark ⇒ night` / `light ⇒ day` 各一）
4. ④ 初次渲染只设 `data-theme`、**不写 `localStorage['theme']`**（跟随系统不得首帧变粘）
5. ⑤ `toggleTheme()` ⇒ 落盘且值正确（day→night ⇒ `theme='dark'`，attr 同步）
6. ⑥（加码）`setTheme('day')` 显式落盘（attr 值 `light`）；非法值 `sepia` 不落盘不改档

注：setup.js 把 `global.localStorage` 换成了 `vi.fn()` 替身，本组用例给替身装 Map 后端实现（无键 ⇒ null）模拟真实语义，`afterEach` `mockReset` 还原；matchMedia 替身只存在于 setup.js/index.html 层，theme JS 无任何 matchMedia。

## 5. 门套两读数

- `npm run test:unit`：**51 文件 / 494 例全过**（基线 488 ⇒ +6，无例数减少）。
- `npm run build`：**exit 0**（管道外捕，`vite build ✓ built in 2.00s`）。

## 6. 断言影响

- `theme-shell-isomorphism.test.jsx`「shell/theme 的 JS 里不出现内联断点判定」：扫描范围 = `src/shell/*` + `src/theme/*` + `src/pages/ThemePreviewPage.jsx`（现取核实），**不含 main.jsx / index.html** ⇒ 系统判定只落在 index.html 内联脚本，断言不受影响，仍绿。
- `v15-nav-floatmenu.test.jsx` 的 FloatingMenu 静态断言：仅扫 `FloatingMenu.jsx`，本单未触碰。
- 新增例不触碰既有 488 例的任何断言（只追加 describe + 两条 import）。
