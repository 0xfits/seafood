# sf-bttc-shortfall · 铸造 BTTC 缺额提示（量化「还差 X 电量 / 差 Y $」）

单号：sf-bttc-shortfall（2026-10-17）· 分支 main · **未 push**（上线由 Zang 排期）
本地提交：main 最新一笔 `feat(seafood): 铸造 BTTC 缺额提示…`（24 files changed），**未 push**
裁定来源：Zang 派单（后端追加 `bttc.usdBalance` + 前端纯展示缺额 + 四语 2 键 + 钩子 `bttc-mint-shortfall`）

---

## 1. 改动清单（按面分）

| 面 | 文件 | 改动 |
|---|---|---|
| 后端读口 | `backend-ts/src/index.ts`（`GET /api/batt` · bttc 子对象） | **追加 1 键** `usdBalance: b.usdBalance`（值取 `getBttcState` 已算出的 `usdBalance`；**零新查询 / 零 SQL 改动**；外层 `batt`/`capBatt`/`floorBatt`/`acceptThresholdBatt`/`canAccept`/`updated_at` 六键一字未动） |
| 前端渲染 | `frontend/src/components/BattCheckinPanel.jsx` | 铸造按钮同一行新增缺额容器 `data-sf-m="bttc-mint-shortfall"`（子节点 `-batt` / `-usd`）；`canMint === false` 且 `status !== null` 时才量化；`batt` 取自外层 `batt.batt`，`policy.mintBattCost` / `policy.mintFeeUsd` 与 `bttc.usdBalance` 做减法；**不触碰** `postBttcMint` 载荷、`disabled={busy || !bttc.canMint}` 原样保留 |
| i18n | `frontend/src/locales/{zh,en,hk,vn}.json` 的 `bttcPanel` | 新增 `mintNeedBatt` / `mintNeedUsd`（四语各 2 键，键集逐文件相等） |
| 单测 | `frontend/src/test/unit/r9-batt-meter.test.jsx` | 新增 describe ④ 共 **3 例**（既有 15 例未动，15⇒18）；`H.t` 增加插值支持（`{{n}}`，与本仓 i18n 约定一致） |
| i18n 硬编计数 | 12 个既有测试文件的 22 处字面 | `flat 1104⇒1106` / `四语节点 4416⇒4424`（顶层 128 不变），逐处追加口径留痕注释 |

### 1.1 缺额口径（与后端 `getBttcState` 同源，纯展示）

```
bttcAvailable = bttc && bttc.status !== null
canMint=true                       ⇒ 不渲染任何缺额
batt < policy.mintBattCost         ⇒ 「还差 {mintBattCost − batt} 电量」
BigInt(usdBalance) < BigInt(mintFeeUsd) ⇒ 「还差 ${mintFeeUsd − usdBalance}」
两项都缺 ⇒ 两条都渲染；都不缺（但 canMint=false，例如 status 不可铸）⇒ 不渲染（不臆测）
```

边界（按派单纪律「显示缺额优先、绝不让按钮变可点」）：
- `policy` 键缺失 / 非法 ⇒ 回落后端同款常量（`MINT_BURN_POLICY_DEFAULTS`：`mintBattCost=100` / `mintFeeUsd=1`），宁可显示缺额也不静默；按钮 `disabled` 恒由 `bttc.canMint` 决定，不受本提示影响。
- `batt` 为 null/缺失 ⇒ 按 0 计（后端 `COALESCE(...,0)` 同构）。
- `usdBalance` 非法字符串 ⇒ `needUsd` 记 0（不渲染 $ 缺额，不崩）。

## 2. 单测（新增 3 例，均在 `r9-batt-meter.test.jsx` describe ④）

1. `仅缺电量：batt 40 / mintBattCost 100 / $ 充足 ⇒ 「还差 60 电量」且无 $ 缺额；按钮仍不可点`
2. `仅缺 $：batt 100 / usdBalance 0 / mintFeeUsd 1 ⇒ 「还差 $1」且无电量缺额；按钮仍不可点`
3. `两项都不缺（canMint=true）⇒ 不渲染 bttc-mint-shortfall，按钮可点`

断言点：`bttc-mint-shortfall-batt` / `-usd` 文案逐字（zh 真词典）+ 另一侧节点不存在 + 铸造按钮 `disabled` 语义未变。

## 3. 门套读数（证据落 `ops/bttc-mint-shortfall/logs/`）

| 门 | 命令 | 读数 | 证据 |
|---|---|---|---|
| 前端构建 | `cd frontend && npm run build` | **exit 0** · `✓ built in 1.85s`（index-*.js 447.37 kB / gzip 131.95 kB） | `logs/build.log` |
| 前端单测 | `cd frontend && npm run test:unit` | **exit 0** · `Test Files 54 passed (54)` / `Tests 523 passed (523)` | `logs/unit.log` |
| 后端类型 | `cd backend-ts && npx tsc --noEmit` | **exit 0**（零诊断输出） | `logs/backend-tsc.log` |

例数对照：**改前 54 files / 520 tests ⇒ 改后 54 files / 523 tests**（+3，文件数不变，无删减）。

## 4. i18n 计数前推（现取复算，未抄旧基线）

现取（改后，四语逐文件一致、键集零差异）：

```
zh/en/hk/vn flat = 1106 · top = 128 · 四语节点合计 = 4424
（改前实测：flat = 1104 · top = 128 · 四语节点 = 4416）
```

逐处等值替换清单（22 处 / 12 文件，每处已追加 `**sf-bttc-shortfall**：+2 键 ⇒ flat 1104⇒1106 / 四语节点 4416⇒4424` 留痕）：

```
frontend/src/test/unit/s7-submissions-panel.test.jsx:303,306          .toBe(1104→1106) / .toBe(4416→4424)
frontend/src/test/unit/s5-publish-headcount.test.jsx:88,91            同上
frontend/src/test/unit/i18n-batch-b4a.test.jsx:148                    { top: 128, flat: 1104→1106 }
frontend/src/test/unit/r9-96-dashj-copy.test.jsx:129,133              1104→1106 / 4416→4424
frontend/src/test/unit/r9-93-points-symbol.test.jsx:195               1104→1106
frontend/src/test/unit/i18n-batch-b5.test.jsx:217,261                 'zh: top=128 flat=1104→1106' / { top:128, flat:1104→1106 }
frontend/src/test/unit/s19-participants-truth-source.test.jsx:108,111  1104→1106 / 4416→4424
frontend/src/test/unit/s8-locale-key-coverage.test.js:188,191          同上
frontend/src/test/unit/i18n-batch-b4b.test.jsx:260,326                 同上
frontend/src/test/unit/i18n-violation-closeout.test.jsx:88,136         '作用域命中节点数 = 4416→4424' / counts[0] 1104→1106
frontend/src/test/unit/s9-ledger-kind-closure.test.js:128,131          1104→1106 / 4416→4424
frontend/src/test/unit/s23-participants-headcount.test.jsx:121,124     同上
frontend/src/test/unit/tg-bind-qr.test.jsx:14                         仅文件头口径注释追加（该文件无硬编计数断言）
```

复算核一致：`node/py` 直接遍历四语 JSON ⇒ flat 1106 × 4 = 4424，四语键集与 zh 互差为空集；门套全绿 ⇒ 硬编断言与真源同数。

## 5. 纪律遵守

- 只 `git add` 本单改动的文件（含 `git add -f ops/bttc-mint-shortfall/logs/*.log`，`*.log` 被 `.gitignore` 命中）；**未** `git add -A`。
- 未 push；未改 `shell.css` / 未新增主题 token / 未碰路由与导航 / 未动 burn 侧提示。
- 铸造载荷（`{ create_key }`，`cli:<UUID>`）逐字未变；客户端仍不决定任何金额/电量（承 `R-8-5`）。
- 工作区另有他人改动（`docs/OPEN-ITEMS.md`、未跟踪 `ops/bttc-recon-cadence/`）**未纳入本单提交**。

## 6. 未做 / 遗留

- 未做生产端真浏览器验证（需登录态与 BTTC 实数据；本单判定为纯展示层，单测渲染断言 + build + tsc 已覆盖）。
- 四语文案用 `{{n}}` 双花括号（本仓 i18next 默认插值约定，见 `src/i18n.js` 无自定义 prefix/suffix；既有键如 `jobs.depositHint` 同形），派单文中 `{n}` 记法按仓约落地为 `{{n}}`。
