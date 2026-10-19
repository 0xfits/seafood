# 商品卡四行结构 · 独立质检报告

- **仓 / 分支 / HEAD**：`/Users/kevin/bistro/seafood` · `main` · **`38dcbe5`**（`origin/main..HEAD` = 2 笔，**未 push**）
- **契约**：`docs/design/design-system.spec.md` **§26.11**（design v1.25）
- **结论**：**PASS** —— AC1–AC7 逐条自取读数全部通过（**AC 判据 720 条 0 红**；门套 4 项全绿；`wants` 真库往返含回收）。另登记 **1 条契约文字面偏离（F1，非 AC 判据、不阻断判定，需裁定）**。
- **本单纪律**：零 commit / 零 push / 零产品代码与 docs 改动；写库仅 1 行 `listing_favorite`（已 DELETE 回收，表回 0 行）。

---

## 取证方式（不依赖实现方探针）

| 件 | 作用 |
|---|---|
| `probe-rows-qa.mjs` | 自写浏览器探针：`context.route` 把 `http://cardqa.local/**` 映射到磁盘 `frontend/dist`（**零 dev server / 零后端 / 零库写**），API 全在内存自截；5 张夹具卡 × 4 组合（1440/1536 × 日/夜）；含**判负自证臂 + 复原臂** |
| `db-wants-roundtrip.mjs` | 真 dev 库往返：插 1 行收藏 → 读 API → **DELETE 回收** → 复读；每份读数打 `neon.project_id` 自证库 |
| `probe-regressions.mjs` | 真 dev 实例（5787+5788）回归：币种 / media miss / `/item/1` 零异常 / 390 首页零横向溢出（旁证：1440 真 feed 9 卡几何） |
| `readings/*.json` `logs/*.log` | 全部原始读数与门套日志（本报告每个数字都能在这四份里回读） |

夹具 = 短标题 `短标题` · **24 汉字**（48 单位，恰不截）· **25 汉字**（应截 24 + `...`）· **60 拉丁**（63 字符）· **无图卡**（`.image-container` 必须仍在）。

---

## AC1 几何（PASS · 280 判据 0 红）

| 读数 | 1440 档 | 1536 档 | 判据 |
|---|---|---|---|
| 卡高 `reward-card` rect | **392** | **392** | 恒 392 |
| `.sf-reward-inner` 高 | 392 | 392 | — |
| 四行 `offsetHeight` | **48 / 32 / 24 / 48** | **48 / 32 / 24 / 48** | 逐行 |
| 四行合计 | 152 | 152 | — |
| `.image-container` 高 | **240** | **240** | 240 |
| 图宽 vs 卡内宽 | 207.33 / 207 | 223.33 / 223 | 相等（差 0.33 = 栅格子像素） |
| `object-fit / -position` | cover / 50% 50% | 同 | cover 居中 |
| 页面横向溢出 | **0** | **0** | 0 |
| 网格列数 | 6 | 6 | — |
| 页面异常 | 0 | 0 | 0 |

- 四个组合（1440 日 / 1440 夜 / 1536 日 / 1536 夜）**逐卡同值**，无内容态差异（长标题 / 无图 / 长价格都不动几何）。
- 旁证（真 dev feed，1440 档 9 卡）：全部 `392 / [48,32,24,48] / 图 240`，见 `readings/regressions.json#realFeed1440`。
- 行宽 = 卡内宽。**`content` 纵向溢出 2px**（内容盒 150 ≠ 152，见 F1 —— 不计入 AC1，原因见该节）。

### 判负自证（尺子有分辨力）

- **注入**：`.sf-reward-card .row3-wrap-price{height:25px!important;flex:0 0 25px!important}`（页面内 `addInitScript` 注入 style，**未改仓库文件**）⇒ 重测 **25 条判据变红**，且红在预期位置：`row3.h24=25`（×5）、`rows.stackSum=152` 实读 **153**（×5）、`price.singleLine` scrollH=25（×5）、`content` 溢出 153>150（×5）。
- **复原**：无注入复测 ⇒ AC 判据**全绿**（仅剩 F1 的 4 条 SPEC 读数，见下）。
- **诚实边界**：`card.h392` 在注入臂**仍为 392**（卡高由 CSS 定高承重，对"行高被改"本就不敏感）⇒ 灵敏度锚取「行高 / 四行合计 / 价格单行」三条，不拿卡高冒充灵敏度。

---

## AC2 标题截断（PASS · 140 判据 0 红）

期望值由契约读法**现算**（≤48 单位 ⇒ 原文；>48 ⇒ 逐字累积至 ≤48 + 字面 `...`），再与 DOM 文本**逐字相等**比对：

| 夹具 | 渲染文本 | 显示宽 | 判定 |
|---|---|---|---|
| 24 汉字（48 单位） | `汉×24` | 48 | **逐字相等、无尾点**（不误截） |
| 25 汉字（50 单位） | `汉×24` + `...` | 51 | 前 24 字 + 字面 `...` |
| 60 拉丁（63 字符） | 48 字符前缀 + `...` | 51 | 以 `...` 收尾，**不含 `…`(U+2026)**、非双尾、非空白尾 |

- **两行内不溢出**：三档 `scrollHeight` 全 = **48**（= 行盒高），无第 3 行。
- **末尾 `...` 不被裁（可见）**：用 Range 取最后 3 个点的盒 —— bottom **976 ≤ 行盒 bottom 980**、right **613.3 ≤ 711.0**（1440 档；拉丁卡 802.8 ≤ 936.3），即点在行盒内、未被 `overflow:hidden` 裁掉。
- 未超限卡（短标题 / 24 汉字 / 无图卡）**不加点**，同样有断言。

---

## AC3 价格行（PASS · 160 判据 0 红）

- `$` **确实在 `<span class="sf-reward-price-cur">` 内**（元素级校验，不是纯文本匹配）；卡面 `¥` 计数 **0**。
- 数字 = 夹具 `points`：495 / 12 / 8888 / 7 / 1 逐卡相等。
- 右侧 `^\\d+人想要$`：`20人想要` · `0人想要`（0 也渲染，符合 §26.11.3）· `1234人想要` · `3人想要`。
- **`$` 与数字紧贴**：两者 rect 间隙 **0px**（5 卡 × 4 组合）；`wants` 在数字右侧。
- **单行不换行**：row3 `offsetHeight=24`、`scrollHeight=24`。

---

## AC4 `wants` 数据面真库往返（PASS · 10 步 0 红）

库自证：`neon.project_id = quiet-math-65207667`（dev）。

| 步 | 读数 |
|---|---|
| 前 | `listing_favorite` = **0 行**；`/api/prize/all` 9 行、行键 **47**、该行 `wants=0` |
| 插 | `listing_id=13`（listed）+ `fav_uid=1`（既有 uid），`ON CONFLICT DO NOTHING` ⇒ **1 行**（fav_id=7） |
| 后 | `/api/prize/all` 行键 **47**、该行 **`wants=1`**（number）、9 行形状一致（无逐行形状漂移） |
| 详情 | `/api/prize/13` = **46 键、无 `wants`**；`/api/prize/1` = **46 键、无 `wants`**（wants 不进详情 ✓） |
| 回收 | `DELETE` **1 行** ⇒ 表回 **0 行**、该行 `wants=0`（行键仍 47） |

> 注：`/api/prize/all` 带 `Cache-Control: public, s-maxage=30` ⇒ 每次读都带 cache-busting 查询参数，避免读到旧载荷。

---

## AC5 移除面 / 保留面（PASS · 140 判据 0 红）

- **移除面 = 0**：夹具描述文本命中 **0**；`svg.lucide-clock` / `[data-sf-m="reward-card-time"]` 计数 **0**；`line-clamp-3` 节点 **0**。`content` 子节点恰 **4**。
- **保留面在场**：`.sf-reward-price`（`$` 块）· 卖家栏 + 信用胶囊 `reward-card-seller-tier` · 整卡链接 `a[href="/item/<数字>"]`（9101…9105 逐卡）· 卡内嵌套交互元素 **0**（无 a 套 a / 无残留 button）。
- 补充：`row2-wrap-service` **存在且高 32**，文本为空（`textContent === ''`，空占位恒在场）。

---

## AC6 门套（PASS）

| 项 | 读数 | 判据 |
|---|---|---|
| `npm run build` | **exit 0**，产物 `index-iMtQQD5W.js` / `index-CpH22ErQ.css` | 0 |
| `npm run test:unit` | **Test Files 62 passed (62) / Tests 609 passed (609) / 0 failed** | ≥62 / ≥609 |
| `backend-ts npx tsc --noEmit` | **exit 0**（日志仅 `EXIT=0`，无诊断） | 0 |
| `p7b-03-offline-gates.ts` | **total 37 / passed 37 / failed 0**；`AC10-2 registration_points = **110**` | failed=0 且 regs 110（111 判负） |

i18n 实测（四语逐文件现算）：`top 129 / flat 1115` 逐语一致 ⇒ **四语叶子 4460**；`rewardCard.wants` = `{{n}}人想要` / `{{n}} want it` / `{{n}}人想要` / `{{n}} người muốn`（四语同补）。

---

## AC7 回归（PASS · 12 判据 0 红）

- `/api/currencies` = **2 行**：`1:$`、`399:BTTC`。
- `/api/media/999` = **404**。
- `/item/1`（真 dev 实例）：HTTP 200、`#root` 11837 字符、**pageerror 0 / console error 0**。
- **390×844 首页**：`scrollWidth − clientWidth = **0**`，2 列、9 卡、卡高 **392**（宽度 164.5）、零页面异常。

---

## F1（需裁定 · 契约文字面偏离，不是 AC 判据）

**卡体保留 1px 实边框 ⇒ `content` 内容盒 = 150 ≠ 契约 152；四行合计 152 溢出 2px 被卡体 `overflow:hidden` 裁掉。**

实测（5 卡 × 4 组合一致）：

```
cardRectH 392 · innerOffsetH 392 · innerClientH 390 · boxSizing border-box
innerBorderTop/Bottom 1px · contentRectH 150 · sellerBottom 1084 > innerBottom 1083
```

- **成因**：`Card` 基座类 `border`（1px）未被 RewardCard 覆盖；`.sf-reward-inner{height:392px; box-sizing:border-box}` ⇒ 内容盒 390 ⇒ `.image-container` 240 + `.content` flex:1 = **150**；四行 `flex:0 0 48/32/24/48`（不收缩）合计 152 ⇒ 溢出 2px，被 `.sf-reward-inner{overflow:hidden}` 裁掉（卖家行底部 2px 不可见）。
- **为何没判 AC 红**：AC1 的判据（卡高 392 / 逐行 48·32·24·48 / 图 240 / 图宽=卡内宽 / 零横向溢出）**全部成立** —— 行高是被 flex-basis 固定、没有被压扁；§26.11.1 自己给的判负读数也是 `rect.height === 392`（成立）。
- **契约原文（§26.11.1）**：「卡体**不得**再加 1px 实边框……若保留 1px 实边框且 `box-sizing:border-box`，内容盒只剩 390 ⇒ 四行必被压 2px（**结构性判负**）。需要描边 ⇒ 用 `inset box-shadow`（零盒占位）。」
- **影响**：视觉 0（卖家栏 24px 内容居中于 48px，裁掉的是底部空边）；结构上 `content` 不等于 152。
- **交叉印证**：实现方自己的 `readings/probe-result.json` 里也记着 `contentH: 150`（同一读数，非本探针伪影），只是他们没有对该值断言。
- **若裁定要收口**（本单未改产品代码）：`.sf-reward-inner` 去 `border` 改 `box-shadow: inset 0 0 0 1px …`，则内容盒回 392、`content` = 152，且卡高仍 392。

---

## 纪律与现场

- `git status`：仅 `?? ops/card-rows/qa/`（本单证据）；产品代码 / docs **零改动**；未 commit、未 push。
- 写库：仅 `listing_favorite` 1 行，已 DELETE 回收；**回收后表 0 行**（`cleanup.zeroRows` PASS）。
- 复跑：`node ops/card-rows/qa/probe-rows-qa.mjs`（需先 `cd frontend && npm run build`）· `node ops/card-rows/qa/db-wants-roundtrip.mjs` · `node ops/card-rows/qa/probe-regressions.mjs`（需 5787/5788 在跑）。
- 探针退出码口径：只看 **AC 判据 + 判负自证臂**；SPEC/F1 读数单列，不冒充 AC 红、也不被静默吞掉。
