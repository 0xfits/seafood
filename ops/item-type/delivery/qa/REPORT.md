# 数字商品拆分批次 · 独立质检报告

- 批次：`f5cdc26`（规范）/ `df14c53`（后端四值闭集 + 迁移 0054）/ `2688187`（前端级联三控件 + 双标签）
- 数据库：dev 与生产均 `schema_version=0054`；`listing_item_type_check` = 四值闭集，无裸 `Digital`
- verdict：**PASS（7/7 AC）**（`verdict.json`）

## AC1 写口边界（14/14 臂，真钱包登录）
- 四值各建 1 件 ⇒ 200，库内逐字一致。
- 裸 `Digital` ⇒ 400 `LEDGER_AMOUNT_INVALID` / `reason=NOT_IN_CLOSED_SET`、`allowed` = 四值，**零行写入**。
- `''` / `'   '` / `'digital'` / `'physicalfreeship'` / `'AutoDeliver'`（旧短名）⇒ 全 400、零写入。
- 缺省与显式 `null` ⇒ 库 `NULL`；`PATCH` 带 `item_type` ⇒ 库值不变（纯 item_type ⇒ 400；带 `to_status` ⇒ 200 且类型/状态按预期）。

## AC2 读口
- feed **48 键** / 详情 **47 键**（差集仅 `wants`）；15 行逐行对拍 **mismatch 0**；详情抽检 6 行 `item_type` 全等。

## AC3 全链 E2E（1536 真页）
- 15 卡；**黄标 1**（`rgb(255,230,15)`，`PhysicalFreeShip`，文本「包邮」）、**绿标 1**（`rgb(74,222,128)`，`DigitalAutoDeliver`，文本「自动发货」）。
- `DigitalManualDeliver` / `PhysicalBuyerShip` 无标签。
- 两标签均为 `.row1-wrap-title` 的**首子元素 + 首节点**，位于标题文字之前；几何逐条相同，仅差底色；行 48 / 卡 392；零 pageerror。

## AC4 发布页
- 三闸（无一级 / 数字无二级 / 实物无二级）均 **0 请求** + `data-sf-miss=1` / `aria-invalid` / 组高亮 + 提示。
- 数字分支仅 deliver 控件、实物分支仅 ship 控件（互斥在场）；切实物后 ship 未选、切回数字 deliver 已清空（stale 清除）。
- 四组合真提交 ⇒ 载荷与库内四值一一对应（id 103–106，HTTP 200，各 4 请求）。

## AC5 门套
- build exit 0（`index-D1DS-jMh.js` / `index-D6DXS34q.css`，2.00s）；`test:unit` **63 文件 / 634 例**。
- backend `tsc --noEmit` 0；`p7b-03` **37/37** `registration_points=110`；s54 **45/45**；s53 **50/50**。

## AC6 回归
- `/api/currencies` 2 行；`/api/media/999` 404；390×844 `overflow_x=0`、零 pageerror、底栏 5 格；存量 26 行 `item_type` 全 NULL。

## AC7 回收
- `listing` 26 → 40（质检期）→ **26（回基线）**；删自建 14 件（93–106）+ 首跑中断 6 件（87–92）。
- `listing_order` / `conversation` / `message` / `ledger_entry` / `favorite` / `review_log` 前后 **0 差**；`content_translation` 414 → 354（夹具译文，回基线）；触发器 `O→D→O` 复原，残留 0 行。

## 待查项结案（父代理补测）
- 质检末尾观察到 390 档 19 卡 vs 桌面 15 卡，怀疑 draft 泄漏。
- 复测（`feed-vs-status.cjs`）：dev 库 26 行 = listed **9** / draft **15** / delisted **2**；`/api/prize/all` 分页取全 = **9 张**，`LEAKED=[]`、`listedMissing=[]`。
- 结论：**无泄漏**；19 vs 15 是质检期间自建商品（后转 listed）造成的时序差，非 `item_type` 缺陷。

## 门套污染记录（不判负）
- s53 / s54 首跑各有 2 红（P3/Q4、P3/D4），归因 = 质检自建 12 行非空 `item_type` 顶红「存量面」与「退回三值」负控臂；回收后复跑 50/50、45/45。两轮日志均保留。

## 纪律
- 未改产品代码 / 文档 / 他人读数；未 commit、未 push（证据由父代理入库）。
