# 后台两页下架收口（/dashboard/listing-review 与 /dashboard/rewards）

Kevin 2026-10-22 · 前端下架单。基线 commit `1a6994b`（路由/页面/侧栏主体删除 + `dashboard-pages-removed.test.jsx` 新增）已入库；本报告收口补齐：闲置清理 + 判据同步 + 探针取证。

## 改动面（本收口单）

| 文件 | 改动 |
| --- | --- |
| `frontend/src/components/layout/AdminLayout.jsx` | 退役 `Gift` / `ClipboardList` 两个 lucide import（仅被已删侧栏项引用，grep 零残留后删） |
| `frontend/src/pages/DashboardPage.jsx` | 总览页「管理入口」卡片组删 `/dashboard/rewards` 死链项 + 对应权限过滤行（`Gift` import 保留，空态图标 L356 仍在用）；`dashPage.linkRewardsDesc` 键保留不删 |
| `frontend/src/test/unit/i18n-batch-b4a.test.jsx` | describe 标题「三个页面」→「两个页面（rewards 页下架）」 |
| `frontend/src/test/unit/project-page.test.jsx` | 保留段抽样：`rewards` / `listing-review` 从「路由面现取」组移入「语义保留」组（断言强度不变，注释口径还原诚实） |
| `frontend/src/project-slug.js` | 仅注释同步：两段在 A（App.jsx 现取）→ B（语义保留）的降级登记；**数组一字未动**（37 段，与后端同表逐字对齐不动） |
| `frontend/scripts/p4z-i18nb4a-cjk.mjs` | WRITE_SET 移出已删的 `pages/admin/RewardsManagement.jsx`（否则脚本下次跑 ENOENT） |
| `ops/project/p68-00-slug-campaign-gate.ts` | `SEMANTIC_RESERVED` 补 `rewards` / `listing-review`（26 App 现取段 ∪ 13 语义段 = 37 = 前后端两表，A5/A10 三方对拍保持绿；后端表不动） |
| `ops/dashboard/remove-review-rewards.mjs` | 新增收尾探针（本目录） |

## 行为定性（探针实测，两档 1536/390 一致）

- `/dashboard/rewards` 与 `/dashboard/listing-review`：**不是 404、也不是重定向** —— 父路由 `/dashboard/*` 仍匹配（比 `/*` catch-all 更具体）、子路由无匹配 ⇒ **AdminLayout 壳照常渲染（侧栏 13 项），`<main>` 空（Outlet 渲染 null）**。按现路由树行为如实判定（派单口径「404/重定向或 catch-all，行为写明」）。
- 侧栏：`/dashboard/rewards`、`/dashboard/listing-review` 两 href 零出现；dashboard/tasks/shards/users/permissions/points/settings/fee-rate/weight-matrix/currency-review/arbitration-review/site-text/audit-console 十三项全在场。
- `/dashboard/tasks` 正常：`/api/campaign/all` 恰 1 次、主区「任务管理」在场。
- 几何/稳定：三被访 URL × 两档 **overflowPx 全 0**（无 scrollContained 干扰）、**零 pageerror**。
- 构建产物判据（删页标准）：`dist/assets/*.js` 对 `/dashboard/rewards`、`/dashboard/listing-review`、`RewardsManagement`、`ListingReviewPage` 四串 **全部 0 命中**。

## 门套读数

- `build`：✓（1.97s；新 `index-B1j4-0zw.js`）。
- `test:unit`：**86 文件 / 902 例全绿**（基线 85/898 ⇒ 新增 `dashboard-pages-removed.test.jsx` +5 例、删 RewardsManagement 专属 1 例，净 +4，**删例不计减**）。
- 探针：`TOTAL PASS`（10/10 臂），读数见 `readings/remove-review-rewards.json`。

## 后端零改动声明

`GET /api/admin/listing`、takedown 写口、`/api/prize/all`、`prizes` 表、审核日志表**全部保留不动**（无 UI 后属闲置，无害）；locale `adminNav.rewards/rewardsDesc/listingReview/listingReviewDesc` 与 `adminRewards.*`(42)、`dashPage.linkRewardsDesc` 键**四语全保留**（i18n 计数零变化：top 135 / flat 1394 不动）。
