# REPORT · 发布任务页（悬赏）币种改下拉选择

commit `1d9b415`（代码 + 门套读数）· 本件另有探针/读数随附（不 push）。仓：`/Users/kevin/bistro/seafood`。

## 1. 改动表

| 文件 | 改动 |
|---|---|
| `frontend/src/pages/jobs/job-api.js` | 新增 `fetchCurrencies = (user) => getJson('/api/currencies', user)`；注释注明公开只读 / 仅 `listed` / 行键恰三键 / 无键面；**不跨线 import `item-api`** |
| `frontend/src/pages/jobs/PublishJobPage.jsx` | ① 头部注释 :13 改写（旧「读口未注册」已过时）；② `input[data-sf-m="jobs-input-cid"]` → `select.sf-jobs-input[data-sf-m="jobs-select-cid"]`，选项 `symbol · name`（不带编号），`fetchCurrencies` 挂载一次，默认 `'1'`，默认不在列表 ⇒ 首项，失败/空数组 ⇒ 仅 `$`(1) 一项；③ **提交 `cid: Number(form.cid)` 等其余逻辑一字未改** |
| `frontend/src/locales/{zh,hk,en,vn}.json` | 只改值（键数不变）：`jobs.cid` → 币种 / 幣種 / Currency / Tiền tệ；`jobs.cidNote` → 「请从下拉框选择悬赏币种」/「請從下拉框選擇幣種。」/「Select the currency from the dropdown.」/「Chọn tiền tệ từ danh sách.」（vn 待复核）。`item.*` 一字未动 |
| `frontend/src/test/unit/publish-job-cid-select.test.jsx` | 新增 7 例（见 AC-4） |

CSS **未动**：`.sf-jobs-input` 在 `select` 上视觉可用（探针回读 computed = `min-height 34px` / `border-radius 8px` / `width 511.5px` / 字号 13px）。`jobs.css` / `.sf-jobs-btn` 规则体零改动。

## 2. 逐 AC 读数

| AC | 判据 | 读数（件） |
|---|---|---|
| AC-1 形态 | 产品代码 `jobs-input-cid` = 0；`jobs-select-cid` = 1 | `readings/job-source.log` §1/§2：非注释非测试命中 **0**、新钩子 **1**（旧名仅剩 :13 注释与单测负断言选择器） |
| AC-2 选项来源 | 选项数 = 接口条数；文本不带编号 | `readings/job-probe.json`：`/api/currencies` 真实后端 200 / `rowCount 11`；select `options 11`；`bareNumericPrefix []`、`anyTextStartsWithDigit []`；默认选中 `1`/`$ · 平台积分` |
| AC-3 提交载荷 | 换选后 `cid` = 所选数字值 | `job-probe.json` → `change.target "4" applied true`；`submit_payload.cid 4`（`typeof number`）、`cid_matches_selected true`；单测 ③ 另测 7 与 21 两次两值 |
| AC-4 单测 | 四类断言 + 边界 | `job-test-unit.log`：**59 files / 568 tests passed，0 failed**（新增文件 7 例全绿；改前基线 58 / 561，见 `job-test-unit-baseline.log`） |
| AC-5 失败回退 | 失败 ⇒ 仅 `$`、可提交 | 单测 ④（rejected）/④b（空数组）/⑤（默认不在列表）；`job-probe.json` 的 `negative_control.probe_is_sensitive true` 证明「legacy 计数」尺子非恒 0 |
| AC-6 i18n | 四语只改值、键数不变、黑名单 0 | `job-source.log` §4/§5：四语 `top 128 / flat 1106 / item 49 / jobs 45` 逐文件相同；新值黑名单命中 **0** |
| AC-7 后端零改动 | `backend-ts/` 空 + 注册点 108 | `job-source.log` §6：`[]` / `108` |
| AC-8 门套 | build exit 0 + 新产物；例数不减 | `job-build.log`：`BUILD_EXIT=0`，`index-BREoUqs6.js`（改前 `index-CfFASwXH.js`；CSS 未变 `index-DnoMyxQu.css` 属预期） |

## 3. 边界 / 披露

- **未真发任务**：探针把 `POST /api/job` 就地截获回包（`writes` 1 条仅内存记录）⇒ 后端与库零业务写。
- **dev 库夹具行**：`/api/currencies` 只读真实 dev 库（11 行，含历史 QA 夹具 `P4B3A*` / `N1*` / `qap7*`）；本单只读不写。
- 探针为受保护页渲染预置了**假会话**（`localStorage.user/token`，非真实凭据，token payload 仅 `exp`）。
- vn 译文按派单给定值落地，标**待复核**。
- 未改 `docs/**`、未 push。
