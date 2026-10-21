# REPORT · /exchange「标的币种」combobox（Kevin 2026-10-21）

## 改了什么

`/exchange`（`frontend/src/pages/market/MarketPage.jsx`）挂单表单的「标的币种编号」纯数字输入框改为**自定义 combobox**（未用 datalist）：

- **选项源** = `GET /api/currencies`（公开只读，仅 listed；`market-api.js` 本线自包装 `fetchCurrencies`，不跨线 import）。选项行文案 = `symbol · name · #cid`；**cid 1 恒不在选项**（§5.103 退化币对，页面层既有拦截不变）。
- **过滤** = 输入词对 `symbol`/`name`/cid 数字不区分大小写包含（`bttc` ⇒ BTTC；纯数字同时匹配 cid 串）。
- **提交动作**：点选（mousedown）或 Enter（↑↓ 高亮项，无高亮取第一项）⇒ `base = 该币 cid`，同时写回 URL `?base=`（`replace`，不刷历史栈）并关面板；**纯数字直输 + 失焦** ⇒ 既有行为（base = 该 cid，404/无效走现兜底）；**Esc / 失焦** ⇒ 关面板、放弃搜索、**零请求**。
- **回显**：关面板态输入框显示已提交 base 对应行的 `symbol`（查全量表，`?base=1` 也回显 `$`）；无对应 ⇒ 回显数字；面板打开即清显全文便于改搜。
- **A11y**：input `role=combobox` + `aria-expanded/aria-controls/aria-activedescendant/aria-autocomplete`；面板 `role=listbox`、行 `role=option`+`aria-selected`（站内首例，此前无 combobox 体例）。面板不置于 `<label>` 内（label 内容模型限制），改 `htmlFor`+`id` 关联。
- **样式**（`market.css`）：面板 absolute 锚定输入框、`z-index:30` 高于表单其余字段、`max-height:240px` 可滚动；颜色/描边/圆角全部既有 token（`--sf-panel-*`、`--sf-btna-*`、`--sf-jobcard-bg`），**零新色值、零新断点、无 `[data-theme]`**；行高走 `--sf-k-ctl-h`（桌面 34 / ≤767 档 44 ⇒ 触控 ≥44 自动生效）。

## 行为变化披露（与旧行为的差异有意识变更）

1. **提交时点**：旧输入框 onChange 即写 base（每击键都发 orderbook/trades 请求）；现输入只进过滤 query，**失焦/选择才提交**（派单口径「直接输入数字并失焦 ⇒ 保持既有行为」）。受影响既有用例 `listing-market.test.jsx` §5.103 ①② 补 `fireEvent.blur` 适配，断言未削弱（退化闸/请求形态原样）。
2. **移动端键盘**：去掉 `inputMode="numeric"`（名称搜索需要文本键盘；纯数字直输仍可用）。
3. **URL**：新增 `?base=` 读写（此前 base 无 URL 来源）；`setSearchParams` 用 `replace`（一句话可改 push）。
4. **回显用 symbol**：BTTC 行按迁移 0066 现状 `symbol='₿'`、`name='BTTC'` ⇒ 输入框回显 `₿`（任务示例写作 `BTTC`，以「回显 symbol」的字面口径为准；面板行 `₿ · BTTC · #4` 两段都在）。

## 门套读数

| 门 | 改前基线 | 改后 | 结论 |
|---|---|---|---|
| `npm run build` | — | exit 0（`✓ built in 1.85s`） | ✅ |
| `npm run test:unit` | 73 files / 801 tests 全绿 | **74 files / 808 tests 全绿**（+1 文件 +7 例） | ✅ 不减 |
| lint | 无配置恒 exit 2（存量） | 未跑（不拦交付） | N/A |

新增单测 `frontend/src/test/unit/market-base-combobox.test.jsx`（7 例）：全量列出/cid1 不在列、bttc 过滤命中、Enter 写回（URL+订单簿+回显 symbol+零 POST）、键盘 a11y（↑↓/aria-activedescendant）、点选写回、纯数字直输旧行为、Esc/失焦零请求、`?base=N` 直进回显（有对应 symbol / 无对应数字）。

既有替身适配：`p7e-tails-beta.test.jsx` 的 market-api mock 补 `fetchCurrencies`（与真模块导出面对齐）。

## 探针读数（`readings/probe-result.json`，跑法 = dist 静态映射 + 内存 API，零后端零库写）

- **臂①（390）**：选项 3 行 `₿ · BTTC · #4` / `Ω · Omega Coin · #10` / `T · Test Coin · #21`；`data-sf-cid="1"` 不在场；行高 min = **44px**；溢出（关/开面板）= **0 / 0**。
- **臂②（390）**：输入 `bttc` ⇒ 过滤剩 **1** 项（cid 4）；Enter ⇒ URL `http://sf.local/exchange?base=4`、输入框回显 `₿`、面板关闭、订单簿请求恰 1 条打 `/api/market/4/orderbook`。
- **臂③（1536）**：溢出（关/开面板）= **0 / 0**；键盘 ArrowDown+Enter ⇒ `?base=4`、回显 `₿`。
- **pageerror / console.error（三臂合计）= 0**。

verdict 九项全 true（`allGreen: true`）。

## 边界与已知代价

- 挂载多一次公开 `GET /api/currencies`（发布页同款读口，公开面零闸）。
- 选项源加载失败/为空 ⇒ 面板无可选项，**纯数字手填路径照旧可用**（不白屏、未新增任何 i18n 键）。
- commit = `fcaa069`（实现+单测）+ 本 ops 件一笔；**未 push**。
