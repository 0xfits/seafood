# 媒体上传单 · 独立质检报告（AC 逐条判定）

> 聚合方声明：本 REPORT 与 `verdict.json` 由 **Zang 依盘上读数手工聚合**。Neng 两轮质检均撞到工具迭代上限（第一轮 AC1–AC5、第二轮 AC5-S6/AC6/AC7/AC8 读数均已落盘），未及写收尾件。**断言未改、失败项未删、环境性项原样保留。**
>
> 基线：`a6d718d`（后端）· `c70800e`（前端 A）· `224775f`（dev 数据态清理）· `eb62f7a`（前端 B），全部未 push。

## 结论

**8 条 AC 全 PASS（0 FAIL / 0 NOT_MEASURED）**。Kevin 三条硬口径均被实证：
1. 可上传（≤4 张、客户端压缩、sha256 去重）；
2. 未传图 ⇒ 首页卡与详情页都显示机械鱼占位（naturalWidth=320 真解码，非破图）；
3. **上传失败 ⇒ 发布取消**：拦截上传 500 后，`POST /api/listing` 调用计数 **0**、库内零半截商品，页面给明确报错。

## 逐 AC

| AC | 判定 | 读数 | 关键证据 |
|---|---|---|---|
| AC1 迁移与表结构 | PASS (14/14) | `readings/ac1-migration.json` | 库身份 `quiet-math-65207667` 自证；`schema_migration` 顶 0050 恰 1 行；`media` 7 列 + UNIQUE(sha256,size_bytes) + `size_bytes ≤ 2097152` CHECK + content_type 三值 CHECK + FK→users + 索引全在场；既有表零变（DDL/DML 计数 0，列数抽查 5 表一致） |
| AC2 上传负例 | PASS (5/6 断言) | `readings/ac2-negative.json` | 401 `AUTH_UNAUTHORIZED` · 400 `MEDIA_CONTENT_TYPE_INVALID` / `MEDIA_BASE64_INVALID` / `MEDIA_SIZE_EXCEEDED` / `MEDIA_MAGIC_MISMATCH`。**观察项 N6**：3MiB 载荷先撞 `express.json` 4mb ⇒ **413**，契约仍拒收、形状分叉已登记（不判负） |
| AC3 正例 + 去重 + 读口 | PASS (6/6) | `readings/ac3-positive.json` | 64×64 webp 128B ⇒ 200 `deduplicated:false`；同字节重传 ⇒ `deduplicated:true` 同 `media_id`、DB 该 sha256 恰 1 行；无鉴权 `GET /api/media/1` ⇒ 200 + `image/webp` + `Cache-Control: public, max-age=31536000, immutable`；miss/非数字 id ⇒ 404 R107 |
| AC4 发布 E2E | PASS (6/6) | `readings/ac4-publish-e2e.json` | listing 72（带图）`media_urls=['/api/media/1']` + listed；`/api/prize/all`、`/api/prize/72` 透出逐字一致；listing 73（无图）`[]` |
| AC5 失败即取消 | PASS | `readings/ac5-fail-cancel.json` + `ac5-s6-rerun.json` | 拦截上传 500 ⇒ error 态 +「图片上传失败，发布已取消」；**`POST /api/listing` 计数 = 0**、库内该标题 0 行；恢复后重提 ⇒ `/item/74` listed。**首轮 S6 子项误红过一次**（探针无条件 `img` 命中 `order.svg`），改 `img[src*="/api/media/"]` 重跑 5/5 PASS —— 首轮 FAIL 原样留在 `ac5-fail-cancel.json`，以 `s6_rerun` 段为准 |
| AC6 展示两分支 | PASS (14/14) | `readings/ac6-display.json` | 390/1440 × 首页卡/详情页：带图 ⇒ `img[/api/media/1]` naturalWidth=64；无图 ⇒ `img[placeholder-item.webp]` **naturalWidth=320**；四臂 pageerror=0。口径披露：`/api/home` 固定 skip=0/limit≤16 ⇒ 首页臂走 `/api/prize/all?skip=24&limit=8` 取真实行 |
| AC7 门套 | PASS | `logs/ac7-build.log` / `ac7-unit.log` / `ac7-tsc.log` / `ac7-p7b03.log` | build exit 0；test:unit **60 文件 / 574 例全绿**；backend `tsc --noEmit` 0 错；`p7b-03` **37/37**、`registration_points=110`；正则现算 get 49/post 57/delete 3/patch 1 = **110** |
| AC8 i18n | PASS (8/8) | `readings/ac8-i18n.json` | 三新键四语在场非空；flat **1109×4** / nodes **4436** / top **128**；四语两两键集差 0；旧值 1106/4424 的 13 处命中全为注释留痕，可执行断言残值 **0** |

## 三栏

**① 与实现方自报的差异**：无实质差异。唯一口径注意 = 实现方报「≤2MiB 400」，实测 3MiB 档先被 `express.json` 4mb 拦成 **413**（拒收成立，但码不同）；已登记为观察项 N6。

**② 未证项**：无。全部 8 条均有独立读数文件。

**③ 环境噪声（记录不洗白）**：
- 首轮 S6 误红 = 探针选择器缺陷（已修 + 重跑，旧读数保留）；
- `/api/home` 分页上限使 QA 行不在首页 feed ⇒ 首页臂改走 prize/all 真实行；
- dev 库 QA 随机钱包用户被 `batt_account`/`batt_entry` 引用（登录即建），故保留不删。

## 数据回收（Zang 收口执行）

单事务：`DISABLE trg_listing_no_delete` → 删 4 条 QA 商品（72/73/74/75，`title LIKE 'QA媒体单-%'`）→ 删仅被其引用的 media 行（1/3）→ `ENABLE` 触发器 → 断言 `tgenabled='O'`。

结果：`deleted_listings=[72,73,74,75]` · `deleted_media=[1,3]` · listing 总数回 **25** · media 归 **0** · 触发器事务内与事后均 `O`。6 个 QA 用户保留并披露（被 batt 派生行引用；无 bio、无积分、界面不可见）。
