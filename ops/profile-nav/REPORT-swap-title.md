# REPORT · 交易区改名「我的置换」（profileNav.title 四语只改值）

- 日期：2026-10-21 · 基线 HEAD `f5108b4` · 执行：zang（子代理）
- 需求：`/profile/trades/`（交易区）名称改为【我的置换】，页面标题形如「我的置换·我买到的」。**只改值不改键**，不改路径、不改钩子；`profileNav.published/sold/bought` 不动；不 push。

## 改动（5 个源文件 + 探针/读数）

| 文件 | 改动 |
|---|---|
| `frontend/src/locales/zh.json` | `profileNav.title`: 我的交易 → **我的置换**（仅此 1 行） |
| `frontend/src/locales/en.json` | `profileNav.title`: My Trades → **My Swaps**（仅此 1 行） |
| `frontend/src/locales/hk.json` | `profileNav.title`: 我的交易 → **我的置換**（仅此 1 行） |
| `frontend/src/locales/vn.json` | `profileNav.title`: Giao dịch của tôi → **Trao đổi của tôi**（仅此 1 行；**待复核译名**，派单标注） |
| `frontend/src/test/unit/sf14-profile-views.test.jsx` | 锚点同步（非放宽）：`:394` `expect(zh.profileNav.title).toBe('我的交易')` → `'我的置换'` |

消费点（grep 全集）：`profileNav.title` 仅 `ProfilePage.jsx` 消费（三页 h1 `:190/:319/:350` + 侧栏组名 `:1029` + nav `aria-label` `:1021`）⇒ 三页标题自动成为「我的置换·我发布的/我卖出的/我买到的」，侧栏组名/aria 同步。`Header.jsx` 只消费 `profileNav.assets`（未动）。

## 「只改值」自证（readings/swap-key-parity-proof.json）

- `json.load` 对拍 HEAD：四语键集彼此相等且与 HEAD 逐键相等（拍平 **1355** 键不变，与 `i18n-batch-b4a/b4b` 断言一致）；每语变更叶 = **恰 1 个**（`profileNav.title`）；`published/sold/bought` 四语逐值与 HEAD 相等。

## 门套

| 项 | 改前基线 | 改后 | 结论 |
|---|---|---|---|
| `npm run build` | exit 0（1.92s） | exit 0（1.95s） | ✅ |
| `npm run test:unit` | **73 files / 801 tests** 全过 | **73 / 801** 全过（0 减） | ✅ |

日志：`readings/swap-build-baseline.log`、`swap-test-baseline.log`、`swap-build-after.log`、`swap-test-after.log`。

补记：收口 staging 时同树兄弟单已写入 market 组改动（`MarketPage.jsx` / `market-api.js` / `market.css` / 两测试改动 + 新 `market-base-combobox.test.jsx`，**不在本 commit 内**）；当前混合工作树复跑 `test:unit` = **74 files / 808 tests 全过**（≥ 73/801 不减，含兄弟单新文件），录于 `/tmp/sf-mixed-tree-test.log`（临时件，不入库）。

## 探针（`probe-profile-nav-swap.mjs`，复用本目录静态 dist + localStorage 种子 + API 自截体例）

正向（`readings/probe-swap-profile-nav.json`）：**125/125 PASS**（exit 0）
- ① 侧栏组名（`.sf-prof-nav-title`）+ nav aria-label + 三页 h1 在 zh/en/hk/vn 各等于新值；h1 同时含未动的 `published/sold/bought` 值（组成式未变）；侧栏钩子序不变。
- ② 旧值零命中（旧值由 `git show HEAD:locales/<lang>.json` 现取）：四语 × trades 三页 + zh settings/assets，`#root` 文本内旧名 0 命中。
- ③ 1536 与 390：目标页 `scrollWidth - clientWidth = 0`；零 pageerror / 零 console error。

负控（`readings/probe-swap-neg.json`）：`PROBE_NEG=1` 把「我的交易」塞回 DOM ⇒ **恰 10 条零命中判据转红、零附带误伤**（`NEG_ARM_RED_AS_EXPECTED`）——尺子有分辨力。

## 已知问题（存量，父版对照归档，非本批引入）

- 既有 `probe-profile-nav.mjs` 的 `/task/new` 组 13 条判据 FAIL：本批改后与 **HEAD 父版（worktree 构建 f5108b4）读数逐条相同**（`readings/probe-parent-attribution.json`，55 检查 / 42 过 / 同一 failed 集）。归因 = 该探针写于「招工→任务」改名验收时点，其「旧文案取自 HEAD」如今等于已上线的现值；且 `/task/new` 现有「无在管项目 ⇒ 不渲染发布表单」闸（`publish-job-project-gate`），探针夹具用户无项目 ⇒ 表单不渲染。属探针陈旧，不动它、不放宽，留待探针维护单处理。

## 纪律

- 只 `git add` 本单路径（locales ×4 + 测试锚点 + `ops/profile-nav/` 探针与读数，`*.log` 用 `-f`）；未 push；未动后端 / docs。
