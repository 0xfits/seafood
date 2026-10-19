# SPEC-NOTE · 商品卡固定尺寸契约登记（卡高恒 `412` · 卡顶 `240` 通栏 cover 图 · 移除徽章 / 领取行 · 卡底卖家栏 `48`）

- **单号** = `JING-SPEC-CARD-RESIZE` · **角色** = Jing（Specifier · 制度员）
- **日期** = 2026-10-19 · **仓** = `/Users/kevin/bistro/seafood` · **基线 HEAD** = `12a94de`
- **交付性质** = **只登记契约**（`docs/**` 五册 + 本件）；**零代码、零迁移落盘、零真源（`style-preview.html`）改动、零服务启停**
- **状态** = 契约冻结 · **实现归并行实现单**（编制时点工作区 `M frontend/src/components/reward/RewardCard.jsx` = 实现单进行中，非本单写面）· 本笔**不 push**
- **正典位置** = `docs/design/design-system.spec.md` **v1.25 §26（规则 `T122`）** · `docs/seafood.master-plan.md` **§5.428 + 版本行 v0.345** · `docs/OPEN-ITEMS.md` **v2.46 + `B40`/`B41`** · `docs/route-layer.spec.md` **§41.3 勘误留痕** · `docs/data-layer.spec.md` **v0.37 §40.7**

## 1. Kevin 口径（四条逐字 + 同日订正）

> ① 「尺寸固定为大约 252*412。不要出现卡片高度变化的情况。」
> ② 「移除【库存不足】提示，移除【0 人已领取 0】提示。以及这两个文字标签前方的代表礼物的图标，都移除掉。」
> ③ 「卡片内的最上方放置商品的预览图片，图片尺寸具体为 240 像素 x240 像素，由于比例不同，预览图片需要在原图的基础上裁剪然后显示。」
> ④ 「商品卡片底部 224×48 显示发布者信息（参考图：左 24px 圆头像 + 灰色脱敏昵称『丽***L』式；右橙色胶囊标签『卖家信用优秀』，浅橙底橙字无图标）。」

**同日订正（覆盖 ④ 昵称示例）**：昵称 = `maskWalletAddress(evm) = evm.slice(0,6) + '*'.repeat(6) + evm.slice(-4)`（例 `0x1234******abcd`）；「丽***L」中文昵称式**不采**（`users` 无昵称列；`messages-service.ts:623` 现为 `…` 掩码 ⇒ 改星号定式，route 册 §41.3 已勘误、旧句保留）。**再收口（同日 · Kevin 改口径）**：掩码格式再改为 **`0x`+前 2 位+`**`+末 2 位**（例 `0x12**cd`），6 星定式随之作废；route 册 §41.3 勘误行已同步再收口，本段旧字面保留。

## 2. 冻结契约（`T122` · 细则 = design §26.1）

| 款 | 契约 | 判负 |
|---|---|---|
| a | 卡高**恒 412px**（`.sf-reward-inner`：flex column + `height:412px` + `overflow:hidden`），不随内容/档位变 | 卡高 ≠412 即判负 |
| b | 预览图 = 卡**第一个子元素** · 通栏（占满卡内宽）· **高 240px** · `object-fit:cover; object-position:center` · 图源 `media_urls[0] > image_url > url_image > placeholder-item.webp`（占位同规格同裁切） | 图高 ≠240 / 非 cover 即判负 |
| c | 412 内部分配 = 240（图）+ 48（卖家栏，贴卡底）+ 中部 flex-1（标题 clamp-2 + `$` 价格块 + 描述 clamp，溢出隐藏） | 中部撑高卡片即判负 |
| d | **移除**：`statusText` 全态徽章（库存不足/可兑换/已兑换）+ `getRarityIcon` 整函数（前置 `Gift`）+「N 人已领取 / 总数」行 + `limited` 徽章（同行一并） | 任一出现即判负 |
| e | **保留**：整卡链接（T112/T113）· `$` 价格块（r9-93，`>$</span>` 恰 1）· 描述 clamp · 剩余时间行（条件）· CTA（`actionLabelKey` 路径逐字不变）· 稀有度光斑 | — |
| f | 卖家栏：高 **48**、占满卡内宽；左 24px 圆头像（`users.avatar_url`〔迁移 `0052`〕非空 ⇒ 真图 cover 圆形；null ⇒ 灰底 + 掩码首字符占位）+ 灰色掩码昵称；右信用胶囊（**无图标** · 色值不锁） | 缺失 / 高 ≠48 即判负 |
| g | 信用档位 = `rating` 按 `ratee_uid` 均星：≥4.5 excellent「卖家信用优秀」/ ≥3.5 good「卖家信用良好」/ <3.5 normal「卖家信用一般」/ 无评分 new「新卖家」；**独立于排序公式**（排序无评分仍按中性 3.0） | 档位与夹具评分不符 / 昵称明文 EVM 全量即判负 |

## 3. 252 / 224 vs 225 算术（口径说明，**非判负项**）

- 卡**宽**随 `T121` 六列网格派生（`≈ (容器 1536 − 页内缩 − 5×gap) / 6`），实测锚 **≈225px @1536**（§25 / §5.427 读数）；**252 为 Kevin 测量近似**、**不在判负清单**。若日后要求精确 252：两条路 = 容器加大（≈1624 档，随 gap / 页边距现算）**或改 5 列** —— 一句话可改，本版不裁。**224**（卖家栏）同理 = 卡内宽实测近似，判负只盯「高 48 + 占满卡内宽」。

## 4. 数据面 / 后端 / i18n（契约数，随实现单同批）

- `listBrands` 行**加性**增 `seller = {uid, nickname, avatar, credit}` ⇒ feed 行键 **45 → 46**；详情行 `seller` 加 `credit`（顶层仍 46）；route 册键集登记随实现单同批。
- 迁移 **`0052_users_avatar_url.sql`**：`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text`（可空 · 零写数据 · `0051` 历史文件不动 + `DO $$` 自检；**无写入口** —— data-layer §40.7；实现单创建文件、apply 由 Zang）。
- i18n 新命名空间 `sellerCredit` 4 键（excellent / good / normal / new，四语同补）⇒ **top 128→129 / flat 1110→1114 / 四语节点 4440→4456**（base = 编制时点现取）；计数前推家族（约 13 文件）随实现单。

## 5. i18n 死键清单（现取 · **不删**、挂 `OPEN-ITEMS B40`）

| 键 | 判定 | 依据 |
|---|---|---|
| `rewardCard.limited` | **死** | 唯一消费点 = HEAD `:102` 限量徽章 → 移除面 |
| `common.claimedUnit` | **死** | 唯一消费点 = HEAD `:176` 领取行 → 移除面 |
| `rewardCard.insufficient` / `claimNow` | **活** | CTA 三态（HEAD `:200/:203`）在保留面 |
| `common.claimed` | **活** | CTA（HEAD `:202`）+ `TaskPage.jsx:131`（他处仍消费） |
| `rewardCard.timeLimited` | **活** | 剩余时间行（HEAD `:169`）在保留面 |
| `homePage.rewardOutOfStock` | 状态不变 | F13（2026-10-12）已删、四语现取无此键，不涉本单 |

## 6. 规范冲突勘误（状态改写式 · 旧句一字未删）

1. **design §22.11 `Q5`**：稀有度**图标**（`getRarityIcon`）保留口径**作废**（该行后已插勘误行）；**装饰光斑保留**半句仍有效。
2. **route `§41.3`**：「前 6 + `…` + 后 4」**作废** ⇒ `maskWalletAddress` 6 星定式（行后已插勘误留痕行、勘误级不升版）。**再收口（Kevin 2026-10-19）**：6 星定式亦**作废** ⇒ 以 `0x`+前 2 位+`**`+末 2 位为准（例 `0x12**cd`）；勘误行已再收口、上行字面保留。
3. **`statusText` 映射**（`HomePage.jsx:124`）：**映射保留、消费点移除**（`p6-miscfix` 面，非缺陷）。

## 7. 现取自证（2026-10-19 · HEAD `12a94de`）

| 项 | 读数 |
|---|---|
| i18n base | top **128** / flat **1110** / 四语节点 **4440**（python 现算）；`sellerCredit` 四语 0 命中 |
| backend | `avatar` 全仓 0 命中（列未建，`0052` = 契约号）；`getPrizeSellerView` = `messages-service.ts:607`（`:623` 现为 `…` 掩码） |
| 组件（HEAD 版） | 徽章行 `:96-99` / `getRarityIcon` `:44-50` / limited `:100-103` / 领取行 `:175-176`；工作区该文件 `M`（实现单进行中） |
| css | `reward-card.css` 48 行、尚无 412/240 常量（实现进行中） |
| 本单改动 | 五册**纯插入**（`git diff --numstat` 删除列 = 0）+ 本件新建；**未动 `frontend/**` / `backend-ts/**` / `docs/design/style-preview.html`** |

## 8. 未做（诚实边界）

- 实现归并行实现单（JSX 已见改版进行中；css 常量 / `0052` 迁移 / `sellerCredit` 键 / `seller` 行键均未落盘）。
- design §26.7 的 **7 条 AC 一条未跑**；`B40`（死键清理另立单）与 `B41`（头像上传能力待立单）挂 `OPEN-ITEMS`。
- 信用胶囊色值未锁（Kevin 未给 hex；若引入新色值须走「真源追加 + PROV」四件链）。
