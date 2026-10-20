# 发布 / 编辑页 · 商品成色四选一（前端实现单）

**日期** 2026-10-20 · **仓** `/Users/kevin/bistro/seafood` · **基线** HEAD `58a4d4e`（本地未 push）
**口径** route §49.14.3 / design §26.15 · 后端契约（迁移 0057）：`POST /api/listing` 可选 `item_condition`，
仅实物两分类允许非空（数字 / 未分类带值 ⇒ 400 `ITEM_CONDITION_NOT_APPLICABLE`），闭集四值
`BrandNewSealed` / `LikeNew` / `MinorWear` / `HeavyWear`；`PATCH /api/listing/:id` 字段支第 6 可改字段；
`GET /api/listing/mine` 行键 `condition`。

## 缺口与修法

改前：后端已支持成色，前端发布/编辑表单**完全没有成色控件**（`PublishItemPage.jsx` 零命中；编辑页预填
只覆盖描述 / 价格 / 分类级联）⇒ 用户无法填写成色、编辑页也无法改。i18n 键已存在
（`itemCondition.brandNewSealed|likeNew|minorWear|heavyWear`，四语齐备）⇒ **本单零新增文案键**。

实现：

- 控件：组容器 `item-select-condition`（`role=radiogroup` + `aria-required`）＋ 选项
  `item-input-condition-brandNewSealed` / `-likeNew` / `-minorWear` / `-heavyWear`。
- **仅实物分支渲染**（`itemTypeSel === 'physical'` 条件渲染，数字 / 未分类 ⇒ 整个控件不渲染、不是 `display:none`）。
- **切换一级分类即清空成色值**（与两个二级值同批清），stale 值不进载荷。
- **实物下必选**：闸在 `onSubmit` 最前（先于图片上传与任何网络动作）⇒ 未选 = 零请求；组高亮
  `sf-item-choice-miss` + `aria-invalid` + `data-sf-miss`；文案复用既有 `uiError.badRequest`。
- 载荷：`item-api.publishListing` 增 `itemCondition` ⇒ `item_condition`（**只在有值时进载荷**，
  null/'' ⇒ 字段缺省落 NULL）。
- 编辑页（`mode="edit"`）：预填 `/api/listing/mine` 行键 `condition`（闭集外 / 缺键 ⇒ 未选，不猜补）；
  **实变才进 PATCH**；草稿 / 在售均可改（后端无状态限制）；存量实物行 `condition = NULL` ⇒ 控件未选且
  **不强制补选**（否则会连带锁死改价 / 改描述）。

## 门套（本机现取）

| 项 | 改前基线 | 改后 | 判 |
|---|---|---|---|
| `npm run build` | exit 0（`✓ built in 1.73s`） | exit 0（`✓ built in 1.76s`） | 绿 |
| `npm run test:unit` | **64 files / 642 tests**（`logs/test-unit-baseline.log`） | **65 files / 661 tests / 0 failed**（`logs/test-unit-item-condition.log`） | 例数只增不减 |
| `tsc` | 前端无 tsconfig ⇒ N/A | N/A | — |
| `npm run lint` | 无配置（恒 exit 2，存量） | 同前 | 未参与 |

新增单测 = `frontend/src/test/unit/item-condition-front.test.jsx`（19 例）：四值载荷映射 / 数字分支零控件
且不送字段 / 实物未选拦截零请求 + 组高亮 / 实物→数字切换清 stale / 编辑预填 + 只传实变字段 / 存量 NULL
不强制补选 / 闭集外不猜补 / i18n 四键四语。

★ 既有 `item-type-front.test.jsx` 两处实物提交用例**同批补选成色**（成色变必选后的连带，非放宽断言）：
`③ 实物+包邮/不包邮` 与 `B 实物二级补选后可提交`。

## 浏览器探针（`probe-condition-form.mjs` · 390 / 1536 两档）

配方：`context.route` 把 `http://sf.local/**` 映射到 `frontend/dist`（零 dev server / 零真后端 /
**零库写**）；API 全内存自截；`POST /api/listing` 的**请求体在 Node 侧记账**（判据不看页面自报）。
读数 = `readings/front-condition-probe.json`。

两档全部绿（`verdict`）：

- ① `physicalGroupShown` = true：4 个 radio、四值顺序、四个中文标签 `全新未拆封 / 几乎全新 / 细微磕碰划痕 / 严重磨损`
  （H5 组 rect `340×51` @x25 / Web `1128×34` @x35）。
- ② `payloadLikeNew` = true：实测拦截载荷 `{"item_type":"PhysicalFreeShip","item_condition":"LikeNew",…}`
  （两档各 1 条 POST）。
- ③ `editPrefillLikeNew` = true（`/item/501/edit` 预填后 `checkedValues=["LikeNew"]`）；
  另 `editPatchConditionOnly` = true —— 改「严重磨损」后 PATCH body **恰** `{"item_condition":"HeavyWear"}`。
- ④ `digitalZeroControls` = true：数字分支与一级未选态下 `[data-sf-m^="item-input-condition-"]` + 组容器 = **0**。
- ⑤ `pageErrorCount` = **0**；两档 `overflowPx` = 0。

## 边界 / 未做

- 不改后端、不改 `docs/**`（规范侧待另单登记「发布/编辑页成色四选一」条文与钩子名）。
- 编辑模式**不强制**补选成色（存量 NULL 行可继续改价/改描述）—— 若裁定「编辑也必须补选」，一句话可改。
- 成色不进上架幂等指纹（与 `item_type` 同口径，指纹仍 4 项 cid/price/stock/description）。
- 未 push（push = 上线，须独立质检 + 生产终验）。
