# FEED-PAGING-v1 · 首页商品分页（36/页 · 无限加载 · 只列 listed）

**日期**：2026-10-19 · **仓**：`/Users/kevin/bistro/seafood` · **基线 revision**：`0fe454a`
**本单范围（冻结）**：只做**数据面** —— 首屏 36 条 + 滚动续页 + 只列可展示商品。
**不做（另一单）**：每行 6 列 / 容器宽度（等 Kevin 定 1440 / 1500 / 1536）；本单未动任何列数与宽度 token。

---

## 1. 改动清单

| 文件 | 改动 |
|---|---|
| `backend-ts/src/database.ts` | `listBrands` 内层子查询加 `WHERE l.status = 'listed'`（+注释登记行为变更）。该函数同时供 `/api/home` 与 `/api/prize/all` ⇒ **两口同批生效**。详情读口 `getBrandById` 不过滤（下架商品详情仍可看），未动。 |
| `frontend/src/pages/HomePage.jsx` | 商品改**统一分页读口** `GET /api/prize/all?skip=<n>&limit=36`；`FEED_PAGE_SIZE=36`；首屏 36 + sentinel 触发续页；按 `bID` 去重；`<36` 终止；失败即停 + 「重试」按钮（复用同一 skip）；并发防重（同一时刻只一个在飞）；卸载 abort + `ctx.cancelled`。`/api/home` 仍取 tasks / user_points / claimed_prize_ids（**响应形状不动**），其 `prizes` 不再被消费。 |
| `frontend/src/components/ui/Responsive.jsx` | `ResponsiveGrid` 加 `...rest` 透传（只为挂 `data-sf-m="feed-grid"` 钩子；纯加性、零布局影响）。 |
| `frontend/src/test/unit/home-page.test.jsx` | 两条既有用例的 mock/断言随读口改为 `/api/prize/all?skip=0&limit=36`。 |
| `frontend/src/test/unit/home-feed-paging.test.jsx` | **新增 6 例**：首屏 36 且不用 `/api/home.prizes`、skip 36→72、`<36` 终止、bID 去重、卸载后不再发请求、失败即停 + 重试复用 skip。 |

### 可测钩子
- `data-sf-m="feed-grid"`（商品容器，新增；卡数 = 子节点 `reward-card` 数）
- `data-sf-m="feed-sentinel"`（底部锚点，新增）
- `data-sf-m="feed-loading"`（续页在飞，新增；仓内无同义旧钩子）
- `data-sf-m="feed-end"`（到底，新增）
- `data-sf-m="feed-error"` / `data-sf-m="feed-retry"`（失败态与重试按钮，新增）
- 复用：`home-items`（区块）、`reward-card`（卡片）、`home-item-filter`（筛选）

### 文案
**零新增 i18n 键**（避免 ~13 个计数断言连锁前推）：加载态 `loading`、失败 `uiCommon.loadFailed`、重试 `uiError.retry`、到底 `uiCommon.noMoreData` —— 全部为既有四语键。

---

## 2. ⚠️ 行为变更登记（需入台账）

`listBrands` 加 `status='listed'` 过滤后，**`/api/home` 与 `/api/prize/all` 都不再返回 `draft` / `delisted` 行**。
- dev 实测：`listing` 共 26 行 = listed 9 / draft 15 / delisted 2；
- 改前 `/api/prize/all` 返 26 行（含 15 draft + 2 delisted，用户面露出未上架商品），改后 **9 行**；
- 详情页 `/api/prize/:bID` 不受影响（未加过滤）。

---

## 3. 读数（全部落盘，可复核）

| 项 | 读数 | 文件 |
|---|---|---|
| 单测基线（改动前） | **60 files / 577 tests / EXIT=0** | `qa/logs/test-unit-baseline.log` |
| 单测（改动后） | **61 files / 583 tests passed / EXIT=0**（+1 文件 / +6 例，零减少） | `qa/logs/test-unit.log` |
| `frontend build` | **EXIT=0** · `assets/index-DWU2QdXv.js` + `assets/index-Bwuo40gV.css` | `qa/logs/build.log` |
| 后端 `tsc --noEmit` | **EXIT=0** | `qa/logs/tsc-noemit.log` |
| `p7b-03-offline-gates` | **37/37 passed · failed 0**（`AC10-2` 注册点仍 **110**，零新路由） | `qa/readings/p7b-03-offline-gates.json` |
| 后端「只列 listed」 | 37/37 判据：`prize/all` bID 集 == DB listed 集、`skip=36` 空、`/api/home` prizes 全 listed、非 listed 泄漏 **0** | `qa/readings/backend-listing-filter.json` |
| 真浏览器 | 四臂全 PASS（见下） | `qa/readings/probe-feed-paging.json` |

### 真浏览器（Chromium headless · dev 5787 / 5800 + 真 dev 后端 5788）

| 臂 | 视口 | 读数 | 判据 |
|---|---|---|---|
| real（零拦截） | 390×844 | 首屏 **9** 卡（= dev listed 实际 9 < 36 ⇒ 终止）；滚到底仍 9；`feed-end` 在场；`feed-loading` / `feed-retry` 不在场；卡片 bID ⊆ `/api/prize/all` 返回集 | ✅ |
| real（零拦截） | 1440×900 | 同上（9 卡） | ✅ |
| paged（拦截 `/api/prize/all`） | 390×844 | 36 → 72 → **80** 卡；请求 skip `0 → 36 → 72`；重复 bID **0**；`feed-end` 在场；无 loading/retry | ✅ |
| paged（拦截） | 1440×900 | 同上（80 卡） | ✅ |

四臂 `pageerror=0`、`window.error=0`、`console.error=0`。

**披露（三件，均非缺陷）**
1. **分页臂只能以拦截形态取证**：dev 库 listed 仅 **9** 行（< 36）⇒ 真网络下不存在第 2 页。拦截臂夹具 = `{0: 1..36, 36: 35..70, 72: 71..80}`（第 2 页故意与第 1 页重叠 2 行），其余 `/api/home` 等仍走真后端；`real` 臂则零拦截，验真后端过滤与首屏卡数。
2. **dev 有 `React.StrictMode`** ⇒ 挂载期首屏请求双发（skip=0 两条，首条被 abort）。判据因此取「首见 skip 序 = 0,36,72」并允许 skip=0 出现 2 次；生产构建无此双发。
3. **重启了 dev 后端**：5788 原被手工 `ts-node` 进程（pid 42348，面板判为 foreign）占用，面板 restart 无法接管 ⇒ 先 `kill 42348` 再由面板 `POST :5555/api/start {"sid":"seafood-api"}` 启动（新 pid 61495）。重启后 `/api/health` 200、`schema_version=0051`。

---

## 4. 复跑方式

```bash
# 后端读数（只读）
cd backend-ts && node ../ops/feed-paging/qa/read-backend-listing-filter.mjs

# 真浏览器四臂
cd /Users/kevin/bistro/seafood && node ops/feed-paging/qa/probe-feed-paging.mjs

# 门套
cd frontend && npm run build && npm run test:unit
cd backend-ts && npx tsc --noEmit && npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts
```

---

## 5. 未做 / 后续

- 每行 **6 列** 与容器宽度：**本单未动**（等 Kevin 定 1440 / 1500 / 1536）。当前 grid 仍 `sm=1 md=2 lg=4`，36 条在 1440 档为 9 行 × 4 列。
- 未改 `docs/**`（本单只交付代码 + 读数；行为变更与本单口径需由规范单入册）。
- 未 push（本单口径：只 commit）。
