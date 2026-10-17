# 首页商品卡片移除「查看详情」胶囊（Kevin 2026-10-17 指令）

- **单号/线名**：`home-card-remove-cta-20261017`
- **实现方**：Zang（子代理）
- **改动文件**：`frontend/src/components/reward/RewardCard.jsx`（唯一）
- **状态**：已改 + 已跑门套 + 已取两档改前/改后读数；**未 commit、未 push**
- **开工 HEAD**：`e8be9be`（工作区开工前已有一处与本事无关的未提交改动：`ops/item-actionbar-20261017/readings/prod-final-verify-20261017.json`，**本单未触碰**）

## 1. 结论

首页卡片最后一行右侧的「查看详情」胶囊**已不再渲染**；**入口可达性零损失** ——
**卡根本身已经是单一 `<Link>`/`<a>`（`const Root = clickable ? (inRouter ? Link : 'a') : 'div'`），入口由整卡承载，删胶囊不丢入口**。
实测点卡片标题区 ⇒ `pathname = /item/3041`（1440 / 390 两档均如此）。

## 2. 实现口径（最小改动）

`RewardCard.jsx`：

1. **prop 注释**：`actionLabelKey` 增补「2026-10-17 Kevin 指令：首页卡片不再显示动作胶囊，入口由整卡链接承载；此参数保留为语义标记」。
2. **渲染处**：动作胶囊整块包进 `{!actionLabelKey && ( … )}` ⇒ 首页（恒传 `item.viewDetail`）**整块不渲染**；
   注释注明原钩子 `reward-card-view` 随胶囊下线、规范面由 Jing 另单勘误。
3. `data-sf-m` 由 `{actionLabelKey ? 'reward-card-view' : 'reward-card-claim'}` 收为字面量 `"reward-card-claim"`
   （**该分支在闸内恒不可达**，保留三元式即死码）；被删的 `actionLabelKey ? t(actionLabelKey)` 同为不可达分支。
4. `actionLabelKey` prop **定义未动**、`HomePage.jsx` **传参未动**（HomePage 零改动）。

**不传 `actionLabelKey` 的路径逐字不变**：`reward-card-claim` 钩子、`onClaim`、三态文案
（`rewardCard.insufficient` / `common.claimed` / `rewardCard.claimNow`）全保留，实测见 §4 表 ②。
**非链接回落态不受影响**：无 `to` / 无 Router 时根元素仍回落 `<div>`（实测 `rootTag=div`、`rootHref=null`、无 `<a href>`）。
`justify-between` 保留；删除后最后一行只剩「x 人已领取 / y」单子元素 ⇒ **无空洞**（截图 `shots/after-home-*.png` 目视确认）。

## 3. 读数（同一探针，改前/改后；`context.route` 映射 `frontend/dist`，零 dev server、零后端、零库写）

探针 = `probes/probe-home-card-cta.mjs`（配方照 `ops/v119-msg-panel/qa/probe-geometry-qa.mjs`）。
夹具 = 4 条真实感商品（山地自行车 / iPad Air 5 / 实木书桌 / 手冲咖啡套装），固定在 `probe-*.json` 内，无网络。

| 读数 | 1440 改前 | 1440 改后 | 390 改前 | 390 改后 | 判据 |
|---|---|---|---|---|---|
| ① 卡内 `[data-sf-m=reward-card-view]` 计数 | **4** | **0** | **4** | **0** | 改前 ≥1、改后 = 0 ✅ |
| ② 卡根 tag | `a` ×4 | `a` ×4 | `a` ×4 | `a` ×4 | 两态均在 ✅ |
| ② 卡根 `href` | `/item/3041…3044` | `/item/3041…3044` | 同 | 同 | 均指向 `/item/<id>` ✅ |
| ③ 卡内交互元素计数（`a,button,input,select,textarea,role=button,tabindex`，剔除卡根） | 0 | 0 | 0 | 0 | 必须 = 0 ✅ |
| 最后一行子元素数 | 2（进度 + 胶囊） | 1（仅进度） | 2 | 1 | 无空洞 ✅ |
| `[data-sf-m=reward-card-claim]` 计数 | 0 | 0 | 0 | 0 | 首页不传该路径 ✅ |
| `pageerror` | 0 | 0 | 0 | 0 | ✅ |

原始读数：`readings/probe-before.json` / `readings/probe-after.json`；截图：`shots/before-home-{1440,390}.png`、`shots/after-home-{1440,390}.png`
（改前截图目视确认「查看详情」灰胶囊在场，改后确认消失且右侧无空档）。

**补充读数（入口可达性）**：`readings/click-entry-after.json` —— 点卡片 `<h3>` 标题区 ⇒
`pathname = /item/3041`（1440 与 390 两档同值），证明入口仍由整卡链接承载。

**claim 路径（不传 `actionLabelKey`）逐字核对**：`readings/claim-path-probe.json`（临时 vitest 探针，**跑完即删、未入库**）

| 项 | 读数 |
|---|---|
| 根 tag / href | `div` / `null`（无 Router 裸渲染回落态，符合 `T113`） |
| `reward-card-claim` 胶囊 | **1** |
| `reward-card-view` 胶囊 | 0 |
| 三态文案分支 | `rewardCard.insufficient` / `common.claimed` / `rewardCard.claimNow`（三条分支各自命中；探针无 i18n 实例 ⇒ 读出裸键名，分支选择正确） |
| `onClaim` 点击 | 调用 1 次（行为保留） |
| 传 `actionLabelKey` 时 | view 胶囊 0、claim 胶囊 0（首页路径已无胶囊） |

## 4. 门套（同一份 `test:unit` 脚本，改前当基线）

| 项 | 改前 | 改后 | 判据 |
|---|---|---|---|
| `npm run test:unit` — Test Files | 57 passed | **57 passed** | ≥57 ✅ |
| 同上 — Tests | 554 passed | **554 passed** | ≥554 ✅ |
| 同上 — failed | 0 | **0** | ✅ |
| `npm run build` | exit 0 | **exit 0** | ✅ |
| 产物 `assets/index-*.js` | `index-Dn7dGQcz.js` | `index-Dn2YXFRS.js` | 变了（预期） |
| 产物 `assets/index-*.css` | `index-DnoMyxQu.css` | `index-DnoMyxQu.css` | **哈希同名 ⇒ 零 CSS 变化** |

日志：`logs/test-before.log` / `logs/test-after.log` / `logs/build-before.log` / `logs/build-after.log`
（`logs/` 与 `*.log` 被仓根 `.gitignore` 命中 ⇒ 收口入库时须 `git add -f`）。

**断言影响 = 0 条**：全仓 `grep -rn 'reward-card-view' frontend/src/test` = **0 命中**（改前改后同）；
`i18n-batch-b2.test.jsx` / `r9-93-points-symbol.test.jsx` 的裸渲染用例只走不传 `actionLabelKey` 的路径，全部通过。
⇒ 未改任何测试断言、未删断言。

## 5. 禁区核对

- `frontend/src/components/reward/reward-card.css` **未改**（产物 CSS 哈希同名可自证）：该文件只有
  `.sf-reward-card` token 局部重绑与 `.sf-reward-price*` 三条规则，**胶囊样式原本全是 Tailwind 工具类** ⇒ **无孤儿样式**，
  无需删任何规则。
- `item` 详情页 / `HomePage.jsx` / `docs/**` / `backend-ts/**` **零改动**（`git diff --numstat` 仅 RewardCard.jsx）。
- locale 四语 `item.viewDetail` **未删未改**（现取 zh `查看详情` / en `View details` / hk `查看詳情` / vn `Xem chi tiết`）；
  `i18n-batch-b2` 的键集清单照旧命中（57/554 不变即证）。未新增任何 locale 键。

## 6. 须披露的规范面冲突（**本单不处理，转 Jing 另单勘误**）

`docs/design/design-system.spec.md` §22 现仍**冻结**该胶囊：

- `T112`：「既存 CTA 降级为**非交互视觉胶囊**（保留文案键 `item.viewDetail` 与钩子 `reward-card-view`，钩子挂点由 `<button>` 迁至非交互元素）」；
- §22 冻结面第 6 项：「`reward-card-view` 钩子**当前无测试锚**，本册仍冻结它（契约面），**实现方不得因「无锚」而删/改名**」；
- `AC-3` / §22.6 判据行：「`[data-sf-m="reward-card-view"]` 在场且 `tagName ∉ {BUTTON, A}`」。

本单按 Kevin 2026-10-17 指令**把该胶囊与钩子一并下线**，上述三条**已与实现不符**，须由 Jing 另单勘误
（口径建议：`T112` 保留「整卡可点击 + 卡内交互元素 = 0」，删去「胶囊 + `reward-card-view`」两处契约；
`AC-3` 第三条判据改为「卡内无动作胶囊」；§22 冻结面第 6 项作废）。`design-system.spec` 本单**未改一字**。

关联挂账 `docs/OPEN-ITEMS.md` **F32**（非链接回落态 CTA 由 `<button>` 退化为 `<span>` ⇒ 丢键盘可达性）：
本单未改变它的成立范围 —— 首页恒链接态、生产影响面仍为 0；改动后该 `<span>` 只在**不传 `actionLabelKey`** 的路径出现，
F32 描述里的 `data-sf-m={actionLabelKey ? …}` 写法已过期（同批勘误时一并订正）。

## 7. 证据清单

```
ops/home-card-remove-cta-20261017/
├── REPORT.md
├── readings/
│   ├── probe-before.json        改前两档读数（含每卡 rect / 卡内交互元素清单）
│   ├── probe-after.json         改后两档读数（同口径）
│   ├── claim-path-probe.json    不传 actionLabelKey 路径逐项核对（临时 vitest 探针产物）
│   └── click-entry-after.json   点标题区 ⇒ /item/3041（两档）
├── shots/
│   ├── before-home-1440.png / before-home-390.png
│   └── after-home-1440.png  / after-home-390.png
├── logs/
│   ├── test-before.log / test-after.log      （57/554 · 0 failed）
│   └── build-before.log / build-after.log    （exit 0 · 产物名）
└── probes/
    ├── probe-home-card-cta.mjs   （主探针，可复跑：node … before|after）
    └── probe-click-entry.mjs     （入口可达性）
```

## 8. 未做 / 未 commit

- **未 commit、未 push**（本单只落工作区改动 + 证据目录）。
- 未启停任何服务；未写库；探针全程 `context.route` 内存自截。
- 卡片删胶囊后若需「右侧视觉配重」（例如右对齐进度条 / 补箭头图标），**本单未做** —— 派单口径是「不得留空洞」，
  现形态单子元素 + 卡片内边距无空洞；如需形态微调请另裁。
