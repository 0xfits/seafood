# 商品分类四值（迁移 0054）· 前端拆分单 —— 交付 report

**单**：数字商品拆分前端（发布页级联三控件 ⇒ 四值 + 卡面双标签 + i18n 2 键 + 注释订正 + 探针）
**仓**：`/Users/kevin/bistro/seafood`　**基线**：`df14c53`（后端四值闭集已落地，迁移 `0054` **未 apply**）
**规范**：design §26.12.8 / route §49.11.1 / data §40.8.1　**Kevin 口径**：发布页级联 2+2+2；卡面两枚标签同位置（标题文字前）只差底色
**状态**：本地 commit **不 push**、`0054` **不 apply**、`docs/**` 未改

---

## 1 · 结论（一句话）

前端已与 `df14c53` 的四值闭集对齐：发布页不再可能上送裸 `Digital`（级联三控件合成单字段四值），卡面「包邮」黄标之外新增「自动发货」绿标（同位置同几何、只差底色 `#4ADE80`），`itemType` 两键四语补齐并使 i18n 计数前推 **top 130 / flat 1122 / nodes 4488**。⇒ 迁移 `0054` apply 后数字发布不再 400。

## 2 · 改动清单

| 面 | 文件 | 改动 |
|---|---|---|
| 发布页 | `frontend/src/pages/item/PublishItemPage.jsx` | 一级「商品分类」（`item-select-type`，`item-input-type-digital/physical`）+ 二级互斥：数字 ⇒「自动发货/手动发货」（`item-select-deliver`，`item-input-deliver-auto/manual`）、实物 ⇒「包邮/不包邮」（`item-select-ship`，`item-input-ship-free/buyer`）；切换一级**两个二级值都清空**；必选闸（一级 / 数字二级 / 实物二级）在 `onSubmit` **最前**、零网络调用、组高亮 `sf-item-choice-miss` + `aria-invalid` + 复用 `uiError.badRequest`（零新文案键）；载荷单字段四值映射，**无裸 `Digital`** |
| 卡面 | `frontend/src/components/reward/RewardCard.jsx` | `DigitalAutoDeliver` ⇒ `<span class="sf-reward-auto-tag" data-sf-m="reward-card-auto-tag">`（文案 `t('itemType.autoDeliver')`，`row1-wrap-title` 内标题文字之前）；`DigitalManualDeliver` / `PhysicalBuyerShip` / NULL ⇒ 无标签；`PhysicalFreeShip` 黄标现役不变 |
| 卡面样式 | `frontend/src/components/reward/reward-card.css` | 新规则 `.sf-reward-card .sf-reward-auto-tag`（与黄标声明集**逐条相同**，仅 `background` 不同）+ 卡内局部常量 `--sf-reward-tag-auto-bg: #4ADE80`（**不进**主题 token 层：未改 `tokens.js` / `theme-tokens.css`）；行高 48 / 卡高 392 未动 |
| i18n | `frontend/src/locales/{zh,en,hk,vn}.json` | 新增 `itemType.autoDeliver` / `itemType.manualDeliver`（zh 自动发货/手动发货 · en Auto-delivery/Manual delivery · hk 自動發貨/手動發貨 · **vn `Giao hàng tự động`/`Giao hàng thủ công` — 待复核**） |
| 计数前推 | 12 个硬编断言的测试文件（`s5` / `s7` / `s8` / `s9` / `s19` / `s23` / `r9-93` / `r9-96` / `i18n-batch-b4a` / `b4b` / `b5` / `i18n-violation-closeout`） | `flat 1120⇒1122` / `四语节点 4480⇒4488`（**top 130 不变**），逐处等值替换并追加出处注释 |
| 存量发布测试 | `publish-item-image` / `publish-item-cid-select` / `listing-publish-redirect`（单测） | 过闸辅助补选「数字商品 + 自动发货」（旧辅助只选一级 ⇒ 新二级闸会拦） |
| 单测重写 | `frontend/src/test/unit/item-type-front.test.jsx` | 四值映射 / 分支互斥 / 切换清空 / 三闸零请求 / 五行标签矩阵（黄 1 · 绿 1 · 总 2）/ CSS 同几何 / i18n 6 键与计数 |
| 后端注释 | `backend-ts/src/index.ts:2724`、`backend-ts/src/database.ts:1135` | 「三值 / 裸 `Digital`」⇒ 四值定名（**纯注释，零行为改动**；`listing-service.ts` 的 `ITEM_TYPES` 段上游已四值，无需再改） |
| 注释同步 | `frontend/src/pages/item/item-api.js`、`frontend/src/pages/HomePage.jsx` | 同上（前端侧旧「三值 `Digital`」注释 ⇒ 四值） |
| 探针 | `ops/item-type/delivery/front/probe-four-values.mjs` + `readings/` + `logs/` | 见 §4 |

## 3 · 门套读数（本单终态）

| 门 | 读数 | 判定 |
|---|---|---|
| `frontend` `npm run build` | `✓ built in 1.85s`，产物 `assets/index-D1DS-jMh.js` / `index-D6DXS34q.css` | exit 0 |
| `frontend` `npm run test:unit` | **63 files / 634 tests passed**（改前基线 63/631 ⇒ +3 例，例数不减少） | 0 failed |
| `backend-ts` `npx tsc --noEmit` | `TSC_EXIT=0` | 0 error |
| `backend-ts` `p7b-03-offline-gates.ts` | **37/37 passed** · `red: []` · `AC10-2` 注册点 `regs === 110`（本单零新路由） | green |
| `lint` | 存量无配置（恒 exit 2），未纳入门套（既有口径） | 登记 |

日志：`ops/item-type/delivery/front/logs/`（`probe-final.log` / `probe-negative-control.log`）。

## 4 · 探针（真浏览器 · dist 映射 · 零后端零库写）

`node ops/item-type/delivery/front/probe-four-values.mjs` —— `context.route` 把 `http://sf.local/**` 映射到 `frontend/dist`，API 全内存自截、登录态 `addInitScript` 预置。

| AC | 判据 | 读数（`readings/probe-four-values.json`） |
|---|---|---|
| ① 四组合载荷 | 4 次真提交各 1 条 `POST /api/listing` | `DigitalAutoDeliver` / `DigitalManualDeliver` / `PhysicalFreeShip` / `PhysicalBuyerShip`；每单 `secondFieldKeys=[]`；`≠ 'Digital'` |
| ② 分支互斥 | 数字分支无运费控件 / 实物分支无交付控件 | 四组合 `deliverGroup/shipGroup` 各为 `1/0` 或 `0/1`；初始两二级组皆 `0` |
| ③ 切换一级清空 | 实物+包邮 ⇒ 切数字 | `shipGroup 1→0`、`deliverChecked=[false,false]`、切后提交 **0 条** `POST /api/listing`（stale 不进载荷） |
| ④ 必选闸零请求 | 一级未选 / 数字二级未选 / 实物二级未选 | 三例均 `listingPosts=0`、`mediaPosts=0`、对应组 `aria-invalid=true` + `sf-item-choice-miss`；提示文案三例同为既有键渲染值（零新键） |
| ⑤ 标签矩阵 | 五行夹具（四值 + NULL） | `yellowCount=1` / `greenCount=1` / `totalCount=2`；`901` 黄标、`902` 绿标、`903/904/905` 零标签；两标均 `row1.firstElementChild` |
| ⑥ computed | 黄 / 绿 / 字 / 字号 / 行 / 卡 | 黄 `rgb(255,230,15)`、绿 `rgb(74,222,128)`、字 `rgb(32,32,32)`、`12px`、`row1=48`、`card=392`；两标几何 10 项全等（`diff=[]`，仅底色不同） |
| ⑦ 负控（尺子灵敏度） | 绿标底色改回黄 ⇒ 必红后恢复 | **双层**：a) 运行时 `--sf-reward-tag-auto-bg` 重绑 `#FFE60F` ⇒ 绿断言读到 `rgb(255,230,15)`（N1 pass=「确实变红」），移除后回绿（N2）；b) **源码负控**：`reward-card.css` 真改为 `#FFE60F` + 重建 ⇒ 探针 `FAIL 42/44`（`A13_greenBg`、`N2_restored_greenAgain` 红，`readings/probe-negative-control-yellow.json`、`logs/probe-negative-control.log`），`cp` 还原（`cmp` 逐字节相同）+ 重建 ⇒ 复跑 `PASS 44/44` |

合计 **44/44 checks PASS**；`pageErrors=[]`（`consoleErrors` 仅 `net::ERR_FAILED` —— 探针对非 `sf.local` 主机名 `abort`，属配方预期，非缺陷）。

## 5 · 已知边界 / 未做

- **迁移 `0054` 未 apply**（按单约定）：dev/生产在 apply 前仍收三值；本单只保证「apply 后前端不 400」。
- **引用 `item-type-front.test.jsx` 曾断言裸 `Digital`**：已整文件重写为四值口径（旧断言作废）。
- **vn 两键为待复核译文**（`Giao hàng tự động` / `Giao hàng thủ công`）；四语键集逐文件相同、en/vn 无 CJK 已由单测钉住。
- **未改 `docs/**`**（规范真源待父单收口）；未新增主题 token（绿为卡内局部常量）；未新增文案键（必选提示复用 `uiError.badRequest`）。
- 存量 `ops/item-type/front/` 旧探针（打 5787 dev）保留未动，本单新探针落 `ops/item-type/delivery/front/`。
