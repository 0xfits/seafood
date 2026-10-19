# 媒体单 · 前端阶段 A（读侧展示）· 收口报告

- 基线 revision：`a6d718d`（媒体上传后端）。开工/收尾 `git status --porcelain` 均只含本单文件。
- 日期：2026-10-19。未 push、未改 docs/**、未写库（探针全程内存自截）。

## 改动面（7 文件）

| 文件 | 改动 |
|---|---|
| `frontend/src/images/placeholder-item.webp` | 新增：占位资产落包。`cmp` 字节一致自证；12,616 B；sha256 `df33258e964447072486b376dfd3936d9c99ca89d8d69022cb4c9fac70be74ec`（与 Kevin 拍板档逐字同） |
| `frontend/src/assets/placeholder.js` | `PLACEHOLDER_IMAGE` 由内联 SVG data URI 改为 webp 资产 import（同 `images/*.svg` 体例）；导出名不变 |
| `frontend/src/pages/HomePage.jsx` | 首页卡 `image = prize.media_urls?.[0] \|\| prize.image_url \|\| prize.url_image \|\| PLACEHOLDER_IMAGE`（真图 > 旧字段 > 占位；沿用既有 `url_image` 字段名） |
| `frontend/src/pages/item/ItemDetailPage.jsx` | 详情面板 `.sf-item-thumb` 由渐变 div 换 `<img src={detailImage} alt={title}>`；`detailImage = row.media_urls?.[0] \|\| PLACEHOLDER_IMAGE`；alt 复用本地化标题（零新 i18n 键） |
| `frontend/src/pages/item/item.css` | `.sf-item-thumb` 补 img 形态属性（`display:block; width:100%; object-fit:cover`）；**几何盒声明一字未动**（高/描边/圆角仍取原 var）；无 `[data-theme`、未动 `.sf-item-btn` 规则体、零新断点块 |
| `backend-ts/src/database.ts` | `BrandRecord` 接口 + `normalizeBrand` 输出补 `media_urls: string[]`（`toStringArrayValue` 归一；`listBrands`/`getBrandById` 原本就 `SELECT l.*`，归一层原先丢弃 ⇒ 纯增键、向后兼容） |
| `ops/media-upload/frontend-a/` | 读数与探针（入库证据） |

## 读口现取结论（media_urls 透出）

- 改前实况（代码 + 运行实例双证）：`normalizeBrand` 输出 43 键、**无** `media_urls`；SQL 层 `SELECT l.*` 已带回该列。改后 45 键（+`media_urls`，+2 行注释不计键）。
- 改前先查冻结：`frontend/src/test` 无 prize/all 或 prize/:bID 行键数断言（grep 现取，见下）；后端 `p4z-05-keys-b1c.ts` 比对的是 `.p4-artifacts/` 冻结快照两副本，不 import 现行 `database.ts` ⇒ 不受影响。**零测试锚改动**。
- 现行无注册点变化（零新路由）⇒ p7b-03 AC10-2 常量不动。

## 门套读数（scratch 拷入 logs/，logs 需 `git add -f`）

| 项 | 基线（改前取） | 改后 | 判 |
|---|---|---|---|
| `test:unit` | 59 files / 568 tests passed | 59 / 568 passed（exit 0） | ✓ 只增不减、零锚红 |
| `npm run build` | — | exit 0，✓ built in 1.86s | ✓ |
| 产物资产 | — | `dist/assets/placeholder-item-ChYVGMSM.webp` + bundle 内引用该名 | ✓ |
| backend `tsc --noEmit` | — | exit 0（0 错） | ✓ |
| lint | 恒 exit 2（无配置，存量口径，不拦交付） | 同 | 登记 |

## 浏览器探针（`probe-phase-a.mjs`，体例照 v119 qa 配方）

`context.route` 映射 `http://sf.local/**` → 磁盘 dist（零 dev server）；API 内存自截（零真后端 / 零库写）。
真图分支 = 截 `/api/home` 与 `/api/prize/1` 响应填 `media_urls:['/api/media/1']`，并截该 URL 返 1×1 PNG（夹具 sips 自证 1×1）。8 cells 全 PASS（390/1440 × home/detail × 占位/真图）：

- **占位分支**（未传图存量态）：`img[src*="placeholder-item"]` 计数 = 1，`naturalWidth = 320`（webp 真解码，served 200 `image/webp`），真图计数 0，零 pageerror。
- **真图分支**：卡片/详情 thumb `src = /api/media/1`，`naturalWidth = 1`（PNG 解码），占位计数 0，零 pageerror。
- **几何盒不动**：`.sf-item-thumb` 盒高 = 150px == `--sf-st-card-thumb-h` 计算值（390 与 1440 两档一致），`object-fit: cover`。
- 每页 7 条 console error 均为 **index.html 既有外链字体 CDN**（font-awesome / Google Fonts / SmileySans）被探针离线路由策略 abort —— 与本改动无关、两模式等量，pageerror 恒 0。

## 运行实例验证（dev 5788）

- 面板重启 `seafood-api`（新 pid 42608）后：`/api/prize/all` 行键 45 键含 `media_urls`（dev 夹具行值 `["p4b2c://a.png"]`）；`/api/prize/1` 详情同。读数见 `live-api-readout.json`。
- 已登记（非缺陷）：dev 该夹具行的 `p4b2c://a.png` 非 `/api/media/:id` 形态，按本单链它优先于占位 ⇒ dev 首页该卡会显示破图，属 dev 遗留数据 + 派单链序（真图 > 旧字段）的已知表现；生产行 `media_urls='{}'` ⇒ 走占位，不受影响。

## 断言影响 / 纪律核对

- 断言影响：零（无测试锚改动；59/568 基线 = 改后同数）。
- i18n：零新键（alt/降级全复用既有）。
- commit 只 add 本单 7 面；logs 用 `-f`（仓根 gitignore 命中 `logs`/`*.log`）；未 push；未写库（探针内存自截；5788 重启为服务操作非库操作）。
