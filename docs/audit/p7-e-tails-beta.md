# 小尾巴批-β · 收口报告（占位归零 + R-7E-4 死分支处置 + R-7E-5 只读核查）

> 作者：**Kong** · 仓库 = `/Users/kevin/bistro/seafood` · 本单**只改 `frontend/**`**（+ 本报告）· **未 `git add/commit/push`**（推送即上线）
> 本单 = 三项：**①** 两页数据枚举本地化（`ListingDetailPage` 的 `listing.status` / `MarketPage`「我的挂单」的 `market_order.status`+`side`）收口核验 + 类级观测面；**②**（裁定 R-7E-4）`JobDetailPage.jsx:236` 死分支处置（**禁死代码**）；**③**（追加 R-7E-5）只读核查 `localizeFields` 是否把枚举字段送入翻译管线（**本单只查不改**）。
> 硬口径：错误码闭集 **33 不动**；**禁 stub**；四语**键集必须完全相等**；`footer` 4 条口号（`catSlogan1-3`/`cloudSlogan`）**严禁触动**（P-1 待裁）；未 `npm install`；未碰/未打印 `.env*`；未用 `pkill -f` / `killall`；未启停 5787/5788；**不碰** `backend-ts/**` / `migrations/**` / `docs/*.spec.md` / `docs/seafood.master-plan.md` / `docs/qa/**` / `docs/audit/**` 既有件（除本报告）。
> 读数一律「命令 → 退出码 → 原文摘录」。未测项写原因（§7.5），**禁填 0 或空**。

---

## §0 元信息

### §0.1 开工 / 收尾态（逐字，对锚）

**开工态**（本单开工时的现取工作区 —— 承接上一轮被截断但已落盘的代码）
```
$ git status --porcelain
 M frontend/scripts/p4z-i18nviol-global.mjs
 M frontend/src/locales/en.json
 M frontend/src/locales/hk.json
 M frontend/src/locales/vn.json
 M frontend/src/locales/zh.json
 M frontend/src/pages/listings/ListingDetailPage.jsx
 M frontend/src/pages/market/MarketPage.jsx
 M frontend/src/test/unit/i18n-batch-b4a.test.jsx
 M frontend/src/test/unit/i18n-batch-b4b.test.jsx
 M frontend/src/test/unit/i18n-batch-b5.test.jsx
 M frontend/src/test/unit/i18n-violation-closeout.test.jsx
?? frontend/src/test/unit/p7e-tails-beta.test.jsx
$ git rev-parse HEAD
22b20c51e78c632f2ad5e58bea1668467115542a
$ git branch --show-current
main
```
⇒ 上一轮（被截断）代码**已落盘**（`build` 0 / `test:unit` 31 files 276 passed / 七门全 PASS，本轮 §9 复跑坐实）；**唯一缺口 = 本报告**（本节写作时报告尚未落盘）。本单在其上追加 **R-7E-4 处置**（`JobDetailPage.jsx`）与**门内豁免条目清除**。

**收尾态**（本单完成后）
```
$ git status --porcelain
 M frontend/scripts/p4z-i18nviol-global.mjs
 M frontend/src/locales/en.json
 M frontend/src/locales/hk.json
 M frontend/src/locales/vn.json
 M frontend/src/locales/zh.json
 M frontend/src/pages/jobs/JobDetailPage.jsx
 M frontend/src/pages/listings/ListingDetailPage.jsx
 M frontend/src/pages/market/MarketPage.jsx
 M frontend/src/test/unit/i18n-batch-b4a.test.jsx
 M frontend/src/test/unit/i18n-batch-b4b.test.jsx
 M frontend/src/test/unit/i18n-batch-b5.test.jsx
 M frontend/src/test/unit/i18n-violation-closeout.test.jsx
?? docs/audit/p7-e-tails-beta.md
?? frontend/src/test/unit/p7e-tails-beta.test.jsx
$ git rev-parse HEAD
22b20c51e78c632f2ad5e58bea1668467115542a
$ lsof -nP -iTCP:5796-5799 -sTCP:LISTEN
（空 —— exit=1）
```
⇒ 除本报告外，改动**全部落在 `frontend/**`**；HEAD **未动**；无 5796-5799 监听。

### §0.2 被改面清单（现取）

```
$ git diff --stat
 frontend/scripts/p4z-i18nviol-global.mjs           | 88 +++++++++++++++++-----
 frontend/src/locales/en.json                       | 14 ++++
 frontend/src/locales/hk.json                       | 14 ++++
 frontend/src/locales/vn.json                       | 14 ++++
 frontend/src/locales/zh.json                       | 14 ++++
 frontend/src/pages/jobs/JobDetailPage.jsx          |  8 +-
 frontend/src/pages/listings/ListingDetailPage.jsx  | 23 +++++-
 frontend/src/pages/market/MarketPage.jsx           | 64 +++++++++++-----
 frontend/src/test/unit/i18n-batch-b4a.test.jsx     |  2 +-
 frontend/src/test/unit/i18n-batch-b4b.test.jsx     |  6 +-
 frontend/src/test/unit/i18n-batch-b5.test.jsx      |  6 +-
 .../src/test/unit/i18n-violation-closeout.test.jsx |  4 +-
 12 files changed, 208 insertions(+), 49 deletions(-)
```

| 文件 | 归属 | 改动性质 |
|---|---|---|
| `frontend/scripts/p4z-i18nviol-global.mjs` | ①/② | ③ 段由「单点现取」升为**类级**枚举原样渲染扫描；R-7E-4 死分支豁免条目**清除**（`0/0`） |
| `frontend/src/locales/{zh,hk,en,vn}.json` | ① | 新增 `orders.statusLabel.*`（5 键）+ `orders.sideLabel.*`（3 键）= 8 键 ×4 语 |
| `frontend/src/pages/listings/ListingDetailPage.jsx` | ① | `listing.status` 查表 + 未知兜底 + 缺省维持 `-` |
| `frontend/src/pages/market/MarketPage.jsx` | ① | 「我的挂单」`status`/`side` 查表 + 未知兜底 + 缺省空串；`side` 真源行号订正 `:135`⇒`:130`（§7.2） |
| `frontend/src/pages/jobs/JobDetailPage.jsx` | **② R-7E-4** | 删除死分支（恒 `undefined` 字段引用）⇒ 无枚举的常量空态占位 |
| `frontend/src/test/unit/i18n-batch-b4a/b4b/b5.test.jsx`、`i18n-violation-closeout.test.jsx` | ① | 期望订正（flat 737⇒745 / top 102⇒103 / 节点 2948⇒2980）—— **未删断言，仅改期望字面量**（§5） |
| `frontend/src/test/unit/p7e-tails-beta.test.jsx` | ① 新增 | 两页查表/兜底/缺省契约（jsdom 真渲染，8 用例） |
| `docs/audit/p7-e-tails-beta.md` | 交付 | 本报告（新件，未跟踪） |

---

## §1 两页取值域（现取，非猜）+ ★ 订正

### §1.1 `listing.status`（`ListingDetailPage`）

```
$ grep -n "listing_status_enum" backend-ts/migrations/0015_listing.sql
137:  CONSTRAINT listing_status_enum      CHECK (status IN ('draft','listed','delisted','frozen')),
124:  status             text        NOT NULL DEFAULT 'draft',
```
⇒ **值域 = `{draft, listed, delisted, frozen}`（4 值）**，默认 `draft`。前端 `LISTING_STATUS_KEYS = ['draft','listed','delisted','frozen']`（`ListingDetailPage.jsx:15`）逐值一致；标签键 = 既有 `listings.statusLabel.*`（四语齐备，含 `unknown`）。

### §1.2 `market_order.status` + `side`（`MarketPage`「我的挂单」）

```
$ awk 'NR>=115 && NR<=144' backend-ts/migrations/0016_market.sql
115:  side               text        NOT NULL,
121:  status             text        NOT NULL DEFAULT 'open',
...
130:  CONSTRAINT market_order_side_enum         CHECK (side IN ('buy','sell')),
...
144:  CONSTRAINT market_order_status_enum       CHECK (status IN ('open','partial','filled','cancelled')),
```
⇒ **`status` 值域 = `{open, partial, filled, cancelled}`（`0016_market.sql:144`），默认 `open`**；**`side` 值域 = `{buy, sell}`（`0016_market.sql:130`）**。前端 `MARKET_ORDER_STATUS_KEYS` / `MARKET_ORDER_SIDE_KEYS` 逐值一致；标签键 = 本单新增 `orders.statusLabel.*` / `orders.sideLabel.*`。
⇒ 回包行由 `normalizeMarketOrder`（`backend-ts/src/database.ts:711`）产出，`side`/`status` **均实返**（`side` 非 `sell` ⇒ 归一 `buy`；`status` 空 ⇒ 回落 `open`）⇒ **两字段在用户面恒有值**，必须查表。

### §1.3 ★ 逐字登记：父单所指「真源」订正（`market_order` 真源）

> **原（父单）断言逐字**：`MarketPage` 行 `status` 的真源 = 「`0015_listing.sql` 的 `listing_order.status`（`{created,paid,refunded,cancelled}`，`0015_listing.sql:176`）」。
>
> **订正（现取证据链）**：
> - `MarketPage.jsx`「我的挂单」行来源 = `fetchMyOrders`（`frontend/src/pages/market/market-api.js`）⇒ **`GET /api/order`**；
> - 后端 `GET /api/order` ⇒ `backend-ts/src/database.ts:3538 listOrdersByUser`（`SELECT o.* FROM market_order AS o`）；
> - ⇒ 回包 `status`/`side` **来自 `market_order`**，**非 `listing_order`**；`normalizeMarketOrder` 对两字段均实返（§1.2）。
> - **⇒ 父单所指 `0015_listing.sql listing_order.status` 对本页不适用**（那是「商品线 · 订单」`created|paid|refunded|cancelled`；本页是「市场线 · 挂单」`open|partial|filled|cancelled`）。真源 = **`market_order`（`0016_market.sql`）**，两枚举的取值域**互不相同**。

---

## §2 新增键四语表（8 键 ×4 语逐条）

> 顶层新块 `orders`：`statusLabel` 5 键 + `sideLabel` 3 键 = **8 键**。**四语键集完全相等**；**en/vn 零 CJK**。

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `orders.statusLabel.open` | 挂单中 | 掛單中 | Open | Đang mở |
| `orders.statusLabel.partial` | 部分成交 | 部分成交 | Partially filled | Khớp một phần |
| `orders.statusLabel.filled` | 已成交 | 已成交 | Filled | Đã khớp |
| `orders.statusLabel.cancelled` | 已撤销 | 已撤銷 | Cancelled | Đã huỷ |
| `orders.statusLabel.unknown` | 其他状态 | 其他狀態 | Unknown | Không rõ |
| `orders.sideLabel.buy` | 买入 | 買入 | Buy | Mua |
| `orders.sideLabel.sell` | 卖出 | 賣出 | Sell | Bán |
| `orders.sideLabel.unknown` | 其他方向 | 其他方向 | Unknown side | Không rõ chiều |

- **键集相等**：单测 `p7e-tails-beta.test.jsx` ③（`Object.keys` 逐语对拍 hk/en/vn = zh）；门② 拍平键数取值集合 = `{745}`（单值）。
- **en/vn 无 `\p{Script=Han}`**（单测 ③ 断言 + 现取 `JSON.stringify`）；**hk 用繁體**。
- **无 stub**：8 键 ×4 语全部真文案（门② 四语齐备/互异 PASS）。

---

## §3 未知值安全兜底（两页各自的 unknown 回退 + 缺省口径）

### §3.1 `ListingDetailPage`（`listing.status`，现取 `:78-83 / :95-99`）
```js
  const statusRaw = row.status == null || row.status === '' ? '' : String(row.status)
  const statusText = statusRaw === ''
    ? '-'                                                        // 缺省/空串 ⇒ 维持既有口径 `-`
    : (LISTING_STATUS_KEYS.includes(statusRaw)
      ? t(`listings.statusLabel.${statusRaw}`)                    // 已知 ⇒ 四语标签
      : t('listings.statusLabel.unknown'))                       // ★ 未知 ⇒ 本地化兜底（绝不裸渲）
...
            <p
              className="sf-listings-note"
              data-sf-status={statusRaw || undefined}
              title={statusRaw || undefined}
            >{`${t('listings.listingId')} #${String(row.listing_id ?? row.bID ?? listingId ?? '-')} · ${statusText}`}</p>
```
- **已知取值** ⇒ `listings.statusLabel.<value>`；**未知取值** ⇒ `listings.statusLabel.unknown`（**绝不裸渲**）；**缺省 / 空串** ⇒ `-`（**维持既有口径**：现网 `GET /api/prize/:bID` 读侧不返回 `status` ⇒ 与本页原有 `String(row.status ?? '-')` 的缺省面**一致**）。
- 原值**不入文案面**，仅留排查面：`data-sf-status` / `title`。

### §3.2 `MarketPage`（`market_order.status` / `side`，现取 `:358-370`）
```js
              const statusRaw = row.status == null || row.status === '' ? '' : String(row.status)
              const statusText = statusRaw === ''
                ? ''                                                  // 缺省/空串 ⇒ 空串（维持既有口径）
                : (MARKET_ORDER_STATUS_KEYS.includes(statusRaw)
                  ? t(`orders.statusLabel.${statusRaw}`)
                  : t('orders.statusLabel.unknown'))                  // ★ 未知 ⇒ 本地化兜底
              const sideRaw = row.side == null || row.side === '' ? '' : String(row.side)
              const sideText = sideRaw === ''
                ? ''
                : (MARKET_ORDER_SIDE_KEYS.includes(sideRaw)
                  ? t(`orders.sideLabel.${sideRaw}`)
                  : t('orders.sideLabel.unknown'))                    // ★ 未知 ⇒ 本地化兜底
```
- **已知** ⇒ `orders.statusLabel.<value>` / `orders.sideLabel.<value>`；**未知** ⇒ `.unknown`（绝不裸渲）；**缺省 / 空串** ⇒ **空串**（维持既有口径 —— 原文即 `String(row.side ?? '')` / `String(row.status ?? '')`）。
- 原值仅留 `data-sf-status` / `data-sf-side` + `title`。

---

## §4 门「类级化」前后读数（门① ③ 段）

```
$ node scripts/p4z-i18nviol-global.mjs
[I18N-VIOL] ③ 残余发现（**类级现取**；不计命中，另单收口）
  类级作用域 = 63 个源文件（pages/components/shell 全部）；字段集 = {status, job_status, review_status, side}；形态 = F1/F2/F3
  形态命中 = 0 处；属性位排除（key= 属性，非文案位）= 1 处；显式豁免（死分支，登记）= 0/0 处
  类级残余（活体）= 0 条（必须 = 0）
[I18N-VIOL] 总判：PASS（locale 裸命中 0 + 源面裸命中 0 必须 = 0；作用域节点数 locale=2980 / source=37）
EXIT=0
```

| 维度 | 升类级前（单点） | 升类级后（本单） |
|---|---|---|
| 作用域 | `ListingsPage.jsx` **单文件** | **63 个源文件**（`pages/**`+`components/**`+`shell/**` 全 `.js/.jsx`） |
| 字段集 | 无（硬编码 `row.status` 单形态） | **`{status, job_status, review_status, side}`**（各表 CHECK 白名单列现取） |
| 形态 | 1（`String(row.status …)`） | **F1** `String(<obj>.<field> ?? …)` / **F2** `${<obj>.<field>}` / **F3** `{<obj>.<field> || …}` |
| 属性位排除 | 无 | F2 落在 `key=` 属性位不计（本仓现取 = **1 处**，逐条计数打印） |
| 豁免条目 | 无 | 升类级后曾列 **1 条**（`JobDetailPage:236` 死分支）⇒ **R-7E-4 处置后 = 0 条**（`0/0`，不留陈旧登记） |
| **类级残余（活体）** | —— | **0 条**（必须 = 0；命中即 `fail` ⇒ EXIT=1） |

**收口点在场判据（3 处查表 + unknown 兜底）**：`ListingsPage.jsx`（`listings.statusLabel.*`+`.unknown`）/`ListingDetailPage.jsx`（同）/`MarketPage.jsx`（`orders.statusLabel.*`+`.unknown`）；任一被静默回退 ⇒ 重新登记（§6 判负坐实）。

---

## §5 ★ 期望订正（逐字：原断言 → 新断言，证明未删断言）

> 本单新增 `orders` 8 键 ⇒ 拍平键数 737⇒745、顶层键 102⇒103、门① locale 节点 2948⇒2980。以下 **9 行**（7 断言 + 2 `it` 标题）**仅改字面量**，`git diff -U0` 读数 = **9 删 / 9 增**（一一对应），**断言结构一条未删**。

| # | 文件:行 | 原（逐字） | 新（逐字） |
|---|---|---|---|
| 1 | `i18n-batch-b4a.test.jsx:130` | `expect(counts.zh).toEqual({ top: 102, flat: 737 })` | `expect(counts.zh).toEqual({ top: 103, flat: 745 })` |
| 2 | `i18n-batch-b4b.test.jsx:237`（`it` 标题） | `...（B5 末批 + 批 7-A + 批 7-D 后 top=102 / flat=737）` | `...（B5 末批 + 批 7-A + 批 7-D + P7-E 后 top=103 / flat=745）` |
| 3 | `i18n-batch-b4b.test.jsx:252` | `expect(counts.zh).toEqual({ top: 102, flat: 737 })` | `expect(counts.zh).toEqual({ top: 103, flat: 745 })` |
| 4 | `i18n-batch-b4b.test.jsx:315` | `expect(out).toContain('zh: top=102 flat=737')` | `expect(out).toContain('zh: top=103 flat=745')` |
| 5 | `i18n-batch-b5.test.jsx:213` | `expect(out).toContain('zh: top=102 flat=737')` | `expect(out).toContain('zh: top=103 flat=745')` |
| 6 | `i18n-batch-b5.test.jsx:237`（`it` 标题） | `四文件拍平键集逐文件相等（top=102 / flat=737）；…` | `四文件拍平键集逐文件相等（top=103 / flat=745）；…` |
| 7 | `i18n-batch-b5.test.jsx:250` | `expect(counts.zh).toEqual({ top: 102, flat: 737 })` | `expect(counts.zh).toEqual({ top: 103, flat: 745 })` |
| 8 | `i18n-violation-closeout.test.jsx:78` | `expect(out).toContain('作用域命中节点数 = 2948')` | `expect(out).toContain('作用域命中节点数 = 2980')` |
| 9 | `i18n-violation-closeout.test.jsx:121` | `expect([...counts][0]).toBe(737)` | `expect([...counts][0]).toBe(745)` |

「未删断言」自证（逐字读数）：
```
$ git diff -U0 frontend/src/test/unit/ | grep -E "^-" | grep -vE "^---" | wc -l
9
$ git diff -U0 frontend/src/test/unit/ | grep -E "^\+" | grep -vE "^\+\+\+" | wc -l
9
```
⇒ 每处均为 **1 删除行（旧字面量）↔ 1 新增行（新字面量）**，行内仍含 `expect(...)` / `toEqual` / `toContain` / `toBe`（#2/#6 为 `it` 标题串，同族订正、非断言）。单测结构（用例数/`describe` 树）**一字未动** ⇒ `test:unit` 仍 **31 files 276 passed**（§9，与基线逐字相同）。

---

## §6 ★ 判负自证（逐字红读数；仓外副本 + 复原回绿 + 零仓内污染）

副本根 = `/Users/kevin/.hermes/profiles/zang/cache/scratch/p7e-beta-neg/frontend`（**仓外**；复制 `src/ scripts/ package.json vite.config.js vitest.config.js`，`node_modules` **软链回主仓** —— 仓内零临时件）。

| # | 对象 | 变异（副本内） | 判负读数（逐字） | 复原（副本内） |
|---|---|---|---|---|
| **1** | 门①③ 类级 + 单测① （回退 `ListingDetail` 为原样渲染） | 删 `statusRaw/statusText` 块；`<p>` 恢复 `· ${String(row.status ?? '-')}` | **门 EXIT=1**：`形态命中 = 1 处`／`类级残余（活体）= 2 条`：① `src/pages/listings/ListingDetailPage.jsx:83 :: [F1 …] "String(row.status ??"`；② `src/pages/listings/ListingDetailPage.jsx :: 枚举查表或未知兜底缺失（收口被回退）`。**单测 EXIT=1**：`Tests 3 failed | 5 passed (8)` —— `expected '商品编号 #5 · draft' to include '草稿'` ／ `expected 'Listing #5 · sunset-value' to include 'Unknown'` ／ 缺省用例 `expected false to be true` | 复制回绿 ⇒ 门 EXIT=0（残余 0）；单测 `8 passed (8)` |
| **2** | 门①③ 类级 + 单测②（回退 `Market` 为原样渲染） | 删 `statusRaw/statusText/sideRaw/sideText` 块；JSX 恢复 `String(row.side ?? '')` / `String(row.status ?? '')` | **门 EXIT=1**：`形态命中 = 2 处`／`类级残余（活体）= 3 条`：`MarketPage.jsx:359 :: [F1 …] "String(row.side ??"` ＋ `MarketPage.jsx:364 :: [F1 …] "String(row.status ??"` ＋ `MarketPage.jsx :: 枚举查表或未知兜底缺失（收口被回退）`。**单测 EXIT=1**：`Tests 2 failed | 6 passed (8)` —— `expected '5/5 · filled' to include '已成交'` ／ `expected '5/0 · sunset-value' to include 'Unknown'` | 复制回绿 ⇒ 门 EXIT=0；单测 `8 passed (8)` |
| **3** | 门①③（删 `unknown` 兜底） | `MarketPage` 的 `t('orders.statusLabel.unknown')` ⇒ `t('orders.statusLabel.open')`（`unknown` 兜底消失） | **门 EXIT=1**：`形态命中 = 0 处`／`类级残余（活体）= 1 条`：`src/pages/market/MarketPage.jsx :: 枚举查表或未知兜底缺失（收口被回退）`。**单测 EXIT=1**：`Tests 1 failed | 7 passed (8)` —— `expected '5/0 · Open' to include 'Unknown'` | 复制回绿 ⇒ 门 EXIT=0（残余 0）；单测 `8 passed (8)` |

**主工作区首尾 `git status`**：**开工见 §0.1** / **收尾见 §0.1**；判负自证**全程只在仓外副本内做** —— 三次变异与三次复原均**未触碰主工作区**（收尾 `git status --porcelain` 与开工仅差 `JobDetailPage.jsx` + 本报告，见 §0.1）。

---

## §7 自曝 + 未测项

### §7.1 自曝 1（★ 关键订正）：`market_order` 真源 —— 父单所指 `listing_order.status` **不适用**
见 §1.3 逐字证据链。**结论**：本页真源 = `market_order`（`0016_market.sql`）；父单所指 `0015_listing.sql:176 listing_order.status` 属「商品线订单」，取值域 `{created,paid,refunded,cancelled}` 与本页 `{open,partial,filled,cancelled}` **不同域**，不可援引。

### §7.2 自曝 2：`side` 真源行号订正（`:135`⇒`:130`）
上一轮（被截断）在 `MarketPage.jsx` 注释中把 `side` 的 CHECK 记作 `0016_market.sql:135`。**现取：`:135` 是 `-- §6.4：price bigint >0` 注释行**；`side` CHECK 真源 = **`:130`**（`CONSTRAINT market_order_side_enum CHECK (side IN ('buy','sell'))`）。本单已在 `MarketPage.jsx` 注释内逐字订正（`frontend/**` 允许改）。`status` CHECK `:144` 现取**无误**。

### §7.3 自曝 3（★ R-7E-4 处置）：`job_status` 死分支
见 §7.3 下文「R-7E-4 处置」与 §4 门读数。

**不可达证明（现取真源）**：
- `JobDetailPage.jsx:52` `fetchMyApplications(user)` ⇒ `job-api.js:44` **`GET /api/task-progress`**；
- 后端 `index.ts:833-842` ⇒ `DatabaseService.listTaskProgressByUser(actor.user.uID, …)`；
- `database.ts:1432 listTaskProgressByUser` 的 **SELECT 列集逐字** = `a.application_id AS "jID"` / `a.job_id AS "tID"` / `a.worker_uid AS "uID"` / `s.deliverable AS info_input` / `a.time_created` / `s.time_created AS time_submitted` / `s.reviewed_at AS time_checked` / `NULL::timestamptz AS time_claimed` / `0::int AS points_claimed` —— **不含 `status` / `job_status`**；
- 行映射 `database.ts:652 normalizeTaskProgress` **输出键集逐字** = `{jID, tID, uID, info_input, time_created, time_submitted, time_checked, time_claimed, points_claimed}`（`TaskProgressRecord` `:364-374` 同集）—— **不含 `status` / `job_status`**；
- ⇒ 前端 `item.job_status` 与 `item.status` **两字段恒 `undefined`** ⇒ 原分支 `{item.job_status || item.status || '—'}` **恒渲染 `—`、永不输出枚举** ⇒ **死分支确证不可达**。
- 诚实边界：`job_application.status` **确实存在于库**（`0014_job_flow.sql:93` `CHECK (status IN ('applied','withdrawn','rejected','accepted'))`），但**不随本读口回包**；要让该分支持真值须改后端读口（`database.ts` SELECT）—— **本单禁改 `backend-ts/**`**。

**处置选择与依据（逐字）**：
- 本仓裁定**禁死代码** ⇒ **删除该死分支**。
- `—` 占位本身是**产品口径**（同页 `jobNote = pickLocalized(job,'note',lang) || '—'` 即用 `—` 作空态占位）⇒ 按裁定第二路径，**改为无枚举的常量占位并注释**，**不再引用任何不存在的字段**：
  ```jsx
  {/* P7-E 小尾巴批-β · R-7E-4（裁定：本仓禁死代码）：原 `{item.job_status || item.status || '—'}`
      为**死分支** ……（证明见上）……
      处置：删除死分支，保留**产品口径的空态占位** `—`（常量，不再引用任何不存在的字段）。 */}
  <div className="sf-jobs-meta">{'—'}</div>
  ```
- **门内豁免同步清除**：`p4z-i18nviol-global.mjs` 的 `EXEMPT_ENUM_SITES` 由 `1 条` 改为 **空 Map**（`= 0/0 处`），doc-comment 逐字记「该豁免条目作废并清除（不留陈旧登记）」。
- **删后门内无死登记 + 残余仍 0** 读数（§4 现取）：`形态命中 = 0 处；… 显式豁免（死分支，登记）= 0/0 处；类级残余（活体）= 0 条` ⇒ `总判：PASS` EXIT=0。
- **未发现可达路径**（若发现则须建键本地化 —— 见上不可达证明，**不瞒报**）。

### §7.4 自曝 4：`localizeFields` 交互（R-7E-5 只读核查）
见 §8。

### §7.5 未测项（逐项原因，**禁填 0 或空**）
- **`npm run test:components` / `test:e2e` / `test:performance` / `test:accessibility` / `lint` / `type-check`** —— **不在本单 AC**；**未跑**（不填 0）。①「行为面」由 `p7e-tails-beta.test.jsx`（jsdom **真渲染**，8 用例）覆盖；②R-7E-4 的「恒 `—`」为**静态源码结论**（后端契约现取），未跑浏览器端到端。
- **浏览器端 5787/5788 未验证** —— 本单**禁启停** 5787/5788；无真机截图/交互读数。
- **真库未连** —— 本单只读源码/迁移（`migrations/**` 只读），未连库验证 `market_order` / `job_application` 实际行分布（取值域以 CHECK 白名单为准）。
- **R-7E-5 为只读核查** —— `localizeFields` 是否被其它**未跟踪/未来**分支调用未穷举（现取 `frontend/src` 内调用面 = 1 处，§8）。

---

## §8 ★ 追加只读核查 R-7E-5：`localizeFields`（TR-1b 管线）是否把枚举字段送入翻译

**结论（两段式，逐字证据）**：

**(A) `localizeFields` 被以枚举字段调用，但它本身不发起任何翻译（纯本地读）。**
- 调用面（现取 `frontend/src`，非 test）—— **唯一 1 处**：
  ```
  $ grep -rn "localizeFields" frontend/src --include=*.js --include=*.jsx | grep -v test
  frontend/src/i18n-content.js:51:export const localizeFields = (obj, keys, lang) => {
  frontend/src/pages/market/MarketPage.jsx:6:import { contentStatus, localizeFields } from '../../i18n-content'
  frontend/src/pages/market/MarketPage.jsx:208:  // …（注释）
  frontend/src/pages/market/MarketPage.jsx:211:  const mineRows = mine.rows.map((row) => localizeFields(row, ['name', 'title', 'side', 'status'], lang))
  ```
  ⇒ **`keys` = `['name','title','side','status']` 含枚举 `side` / `status`**。
- 本体（`frontend/src/i18n-content.js:51-63`）：
  ```js
  export const localizeFields = (obj, keys, lang) => {
    if (!obj || typeof obj !== 'object') return obj
    const suffix = langSuffix(normalizeLang(lang))
    if (!suffix) return obj                                      // zh ⇒ 原行直返
    const next = { ...obj }
    for (const key of keys) {
      if (next[`${key}${suffix}`] === undefined && next[key] === undefined) continue
      next[key] = pickLocalized(next, key, lang)                // 只读：obj[<key>_<lang>] || obj[key]
    }
    return next
  }
  ```
  ⇒ **无字段白名单/黑名单、无实体类型过滤**；亦**不调用任何翻译 API**（是**读侧取值**，只回显已存在的 `*_<lang>` 列）。⇒ **`localizeFields` 本身不把字段「送入翻译」**。

**(B) 真翻译管线（TR-1b 写侧 + 存量扫描）白名单**均**不含任何枚举字段** —— 已有排除。
- 读侧真源解析器白名单（`backend-ts/src/translate-service.ts:912-916`）：
  ```
    job: { table: 'job', idCol: 'job_id', fields: { title: 'title', description: 'description' } },
    listing: { table: 'listing', idCol: 'listing_id', fields: { title: 'title', description: 'description' } },
    user: { table: 'users', idCol: 'uid', fields: { bio: 'bio' } },
    currency: { table: 'currency', idCol: 'cid', fields: { name: 'name' } },
  ```
- 存量扫描白名单（`translate-service.ts:1134-1139` `TRANSLATABLE_SPECS`）：**同域**（`job{title,description}` / `listing{title,description}` / `user{bio}` / `currency{name}`）。
- 写侧登记调用面（`backend-ts/src/index.ts`）：`listing` title/description（`:85-94`）、`user` bio（`:582`）、`currency` name（`:1610`）、`job` title/description（`:1697`）—— **均无 `status`/`side`/`job_status`/`listing.status`**。
- ⇒ **现网任何枚举字段都不会被登记/翻译**（`status`/`side`/`job_status`/`listing.status` 全部落在白名单之外）。**排除点 = `translate-service.ts:912-916` + `:1134-1139`**。

**(C) ★ 潜在耦合（登记为下一批必修项，本单不修）**：
- `MarketPage.jsx:211` 把枚举 `side`/`status` 列为**本地化读字段** —— 这与后端翻译白名单**不同域**。当前后端不产出 `side_en`/`status_en` ⇒ **零行为变化**；但**一旦后端白名单扩域**（或历史上某环境曾写入 `*_<lang>`），`localizeFields` 会把枚举换成译文值（`obj['status_en'] || obj['status']`）。
- **下一批必修项（建议）**：把 `MarketPage.jsx:211` 的 `keys` 收敛为非枚举字段（或加实体类型过滤），消除「白名单扩域 ⇒ 枚举被换译」的隐患。**本单只查不改**（R-7E-5 明确「本单不修」）。

---

## §9 AC 验收读数

| 项 | 命令 | EXIT | 读数（原文摘录） |
|---|---|---|---|
| build | `npm run build` | **0** | `✓ 1783 modules transformed` / `✓ built in 1.62s` |
| 单测 | `npm run test:unit` | **0** | `Test Files 31 passed (31)` / `Tests 276 passed (276)`（≥276 **不掉**） |
| 门① | `node scripts/p4z-i18nviol-global.mjs` | **0** | `总判：PASS（… locale=2980 / source=37）`；`类级作用域 = 63 个源文件`；`形态命中 = 0 处`；`显式豁免 …= 0/0 处`；**`类级残余（活体）= 0 条`** |
| 门② | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | `键集相等：PASS（四文件拍平键数取值集合 = {745}）` / `四语齐备=PASS；四语互异取值数=4/4` / `总判：PASS` |
| 门③ | `node scripts/p4z-miscfix-links.mjs` | **0** | `总判：PASS（残留全部已登记）` |
| 门④ | `node scripts/p4z-feperf-safelist.mjs` | **0** | `VERDICT=PASS`（**先 build 后跑**，依赖 `dist/`） |
| 门⑤ | `node scripts/p7a-03-errmessage-gate.mjs` | **0** | `总判：PASS（未登记命中 0 必须 = 0；扫描文件 77 / 受体 6 / 命中 0 / 基线 0）` |
| 门⑥ | `node scripts/p7b-errfallback-gate.mjs` | **0** | `总判：PASS（… D 节点=132 需护栏=0 已本地化=132 …）` |
| 门⑦ | `node scripts/p7c-errmsg-machinecode-gate.mjs` | **0** | `链路体制 = 真链`；`总判：PASS（… 链=真链 / … D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）` |

**七门全 PASS**；退出码**管道外捕获**（`for g in …; do out=$(node scripts/$g.mjs 2>&1); ec=$?; …`）。

**错误码闭集 33 不动**（本单未碰 `auth.js` / `ledger.err.*` / 任何码面）；**四语键集相等**（门② `{745}`）；**无 stub**（门①/② 判据）；**`footer` 4 条口号未触动**（本单未改其键值，§3 表格不含之）。**`p7c` 仍 `链路体制 = 真链`**（门⑦ 逐字）；**删 `job_status` 分支后门内无死登记 + 残余仍 0**（门① `形态命中=0` / `豁免 0/0` / `残余 0`，§7.3）。
