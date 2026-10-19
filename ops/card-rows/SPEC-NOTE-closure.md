# SPEC-NOTE-closure · 商品卡四行结构（`card-rows`）收口

- **单号**：`JING-SPEC-CARD-ROWS-CLOSURE`（Jing · 制度员）
- **性质**：**收口回写**（只写 `docs/**` + 本文件）。**零代码、零迁移、零 HTTP、不 push**。
- **编制时点**：2026-10-19 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main`
- **现取**：`origin/main = 49a7d99` · `HEAD = 1f3f9de` · **ahead 1** · 工作区干净（本笔之前）
- **正典（本笔新增/追加）**：`docs/seafood.master-plan.md` **§5.431** + 版本行 **v0.348** · `docs/design/design-system.spec.md` **§26.11.7**（追加，不升版）· `docs/OPEN-ITEMS.md` **`B43`**

## 1. 四段闭环（逐段带提交）

| 段 | 提交 | 内容 | 规模 |
|---|---|---|---|
| ① 契约 | `b2c6b5e` | design v1.25 §26.11 / master §5.430 / 版本行 v0.347 / route §49.10 / `B42` | 5 文件 |
| ② 实现 | `38dcbe5` | 四行结构 + `truncate.js` + feed `wants` + 四语 `rewardCard.wants` + 13 文件计数前推 | 26 文件 `+3,072 −306` |
| ③ F1 修正 | `dca495e` | 卡体实边框 → `outline` inset + 探针加 4 判据 | 5 文件 `+527 −250` |
| ④ 独立质检 | `49a7d99` | verdict PASS（7 条 AC 全绿）+ 报告 + 读数 + 门套日志 | 14 文件 `+10,249 −0` |
| ⑤ 生产终验 | `1f3f9de` | 同版 sha256 + 两档 × 7 卡读数 + 证据副本 | 6 文件 `+383 −0` |

- **本批零迁移**（schema 仍 `0052`）· **零新路由**（注册点 **110**）· 唯一响应形状变化 = `/api/prize/all` 加性键 `wants`（行键 **46→47**，详情口不动）。

## 2. 质检读数（`ops/card-rows/qa/verdict.json` · PASS）

| AC | 面 | checks | 红 |
|---|---|---|---|
| AC1 | 几何：卡高 392 / 行高 48·32·24·48 / 图 240 / 图宽 = 卡内宽 / 零横向溢出 | 280 | 0 |
| AC2 | 标题截断（24 汉字不截 / 25 ⇒ 前 24 + `...` / 60 拉丁 ⇒ `...` 尾 / 两行不溢 / 尾点可见） | 140 | 0 |
| AC3 | 价格行（`$` 在 span 内 / 数字 = points / 右 `^\d+人想要$` / 单行 24 / 无 `¥`） | 160 | 0 |
| AC4 | `wants` 真库往返（dev，含回收） | 10 | 0 |
| AC5 | 移除面 / 保留面（描述行 0 · 时间行 0 · `line-clamp-3` 0 · 价格块/卖家栏/整卡链接在） | 140 | 0 |
| AC6 | 门套（`build` 0 · `test:unit` 62 文件 609 例 · 后端 `tsc` 0 · `p7b-03` 37/37 `regs=110`） | 4 | 0 |
| AC7 | 回归（`/api/currencies` 2 行 · `/api/media/999` 404 · `/item/1` 200 零异常 · 390 档 2 列 9 卡零溢出） | 12 | 0 |

- **AC4 关键读数**：dev `listing_favorite` **0 行** ⇒ 插 1 行（`listing_id=13` + `fav_uid=1`）⇒ feed 该行 `wants=1`（number）⇒ DELETE 回收 ⇒ `wants=0`、行键仍 47（**往返零残留**）；`/api/prize/13` = **46 键且无 `wants`**（加性只落 feed）。
- **负控自证（AC 之外）**：注入 `.row3-wrap-price{height:25px!important}` ⇒ **25 红**；无注入复测复原全绿。
- ★ **口径差（如实登记、不改 verdict）**：`verdict_basis` 字面写「AC 判据 **720** 条 0 红」，而 AC 表逐项 `checks` 合计 = **746**（AC1–AC5 **730** + 门套 4 + 回归 12）⇒ 两者口径不同，本册以**逐项 checks 为准**，不据 720 复算。

## 3. 四条工程取舍 / 修正（须如实入册）

1. **标题 14px（原 15px）**：1440 档实卡内宽 **207**（≠ 契约 224）⇒ `padding: 0 10px` 后文本可用 **≈187**；15px 下「24 汉字 + `...`」实测溢到**第三行**（`scrollHeight > 48`）；落 **14px + `line-height: 24px`**（2×24 = 48 = 盒高）⇒ 两行收住，AC2 五卡 × 四组合 `scrollHeight` 全 48。**截断口径未变**（48 显示宽单位 + 字面 `...`，`truncateByWidth` 前置截断，不靠 CSS 行数裁）。
2. **卡高 392（非 412）**：图 **240**（Kevin 具体值）+ 四行 **152** = 392；保 412 需图 **260**（412 − 152），与「图 240」互斥 ⇒ 挂 `B42` 待 Kevin（本笔不裁）。
3. **F1 修正（实边框 → `outline` inset）**：Card 基座 `.border` 1px 实边框在 `border-box` 下吃 2px ⇒ 内容盒 **390** / `.content` **150** / 卖家行底边 **−1**（被 `overflow:hidden` 裁 2px）；**卡体 `rect` 两态均 392 ⇒ 只看总高看不见该缺陷**。修法 `.sf-reward-card-body{border:0; outline:1px solid #e5e7eb; outline-offset:-1px}`（不用 `box-shadow`，被 `hover:shadow-lg` 覆盖）⇒ **392 / 152 / 底边 0 / 边框 0px**；**负控**：加回边框 ⇒ **20 红**、恢复 ⇒ **189 绿**。**副作用（登记）**：稀有度 `border-yellow-400` / `border-purple-400` 色环**不再绘制**（现统一浅灰 outline）；要彩色环可用 `outline-color` 按类接管 —— **未做、待 Kevin**（`B43`）。
4. **移除面（`content` 四行封闭枚举）**：描述行与剩余时间行**不再渲染**（AC5：描述文本 0 / `svg.lucide-clock` 0 / `[data-sf-m=reward-card-time]` 0 / `line-clamp-3` 0）；`rewardCard.timeLimited` 转**死键候选**（**不删**，`B40` 清理单届时复核）。保留面全在：价格块 / 卖家栏 + 信用胶囊 / 整卡链接 / 卡内嵌套交互元素 0。

## 4. 生产终验（`ops/card-rows/prod-verify/` · PASS）

- **同版 sha256 逐字**：js **`13a6b63c9ddc53da…`**（`index-BZDLiVL8.js` **497,255 B**）/ css **`7a86f0b8a65a7bff…`**（`index-CSAoTEI9.css` **126,007 B**）；prod == 本地 HEAD 构建。
- **1440 / 1536 两档 × 7 卡**逐卡：卡高 **392** · 图 **240** · 行高 **48 / 32 / 24 / 48** · gift **0** · 横向溢出 **0** · `pageerror` / console error **0** · `wantsOk=true` · 价格行形如 `$20人想要` / `$400人想要`。
- **诚实边界**：① 生产探针只记 `vw`、**无 theme 字段** ⇒ **夜档生产未单测**（日/夜四组合由本地质检 `rows-qa.json` 覆盖，`distinctHeights=[392]`）；② 生产标题均未超 48 单位（`titleEndsDots=false` 全部）⇒ **截断由 dev 夹具取证**（25 汉字 / 60 拉丁），非生产读数。

## 5. 现取几何表（修前 F1 态 → 修后现行）

| 量 | 修前 | 修后 |
|---|---|---|
| 卡体 `rect` 高 | 392 | **392** |
| `.sf-reward-inner` `clientHeight` | 390 | **392** |
| `.content` 盒高 | 150 | **152** |
| 行高 48 / 32 / 24 / 48 | 48 / 32 / 24 / 48 | **48 / 32 / 24 / 48** |
| 图容器高 | 240 | **240** |
| 卡内宽（1440 / 1536） | 207.33 / 223.33 | **209.33 / 225.33** |
| 卖家行底边 − 内容盒底边 | **−1** | **0** |
| 计算 border-top/bottom | 1px / 1px | **0px / 0px** |

> 卡内宽与契约 224 的差 = 六列栅格子像素 + outline 不占宽 ⇒ **判负不盯卡内宽**；判负面 = 卡高 / 行高 / 图高 / 内容盒 / 无实边框。

## 6. 本笔改动清单（4 件 · 纯追加）

| # | 文件 | 动作 |
|---|---|---|
| 1 | `docs/seafood.master-plan.md` | **前插 §5.431**（倒序、最新在上）+ 版本表**前插 v0.348** |
| 2 | `docs/design/design-system.spec.md` | 文末追加 **§26.11.7**（实现回写与生产终验；§26.11.0–26.11.6 一字未改、不升版） |
| 3 | `docs/OPEN-ITEMS.md` | `B` 表追加 **`B43`**（稀有度彩色环可选接管，待 Kevin） |
| 4 | `ops/card-rows/SPEC-NOTE-closure.md` | 本文件（新） |

- **自证**：`git diff --numstat` 上述四件**删除列 = 0**；`commit` 只 `add` 上述四件；**不 push**；未启停服务、未碰真库、未跑迁移。
