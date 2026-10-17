# 登记单：「铸造 BTTC 缺额提示」对比度漂移 + Vercel Hobby 档位约束入册

- 角色 / 边界：**只落册**。本单**只改 `docs/**`**（1 文件）＋本目录证据；**零代码、零迁移、零 HTTP、零套件**。
- 现取基线 = **HEAD `e1283da`**（开工时 `git status --porcelain` 为空；写作过程中并行会话在工作区留下 `M backend-ts/src/index.ts` / `M backend-ts/scripts/p7b-03-offline-gates.ts`，**非本单**，未 `git add`）。
- 落册面：`docs/OPEN-ITEMS.md` 新增 **`B31`** 行 + 顶部一个 **★ v2.36** 追加块（放在既有最后一个 `★` 块〔v2.35〕之下）。

## 1. 条目一：缺额红字对比度 4.44:1（`B31`）

| 项 | 内容 |
|---|---|
| 面 | `/activities` 页 BTTC 区块，`canMint=false` 时的缺额提示「还差 N 电量 / 还差 $M」 |
| 节点 | `<span class="text-sm text-red-600">` · 前景 `rgb(220, 38, 38)` · 14px |
| 有效底色 | `rgb(239, 246, 255)` = 父级 `Card variant=secondary` 的 `bg-blue-50`（**不是** `.sf-shell` 夜档底 `rgb(11,12,14)`） |
| 合成对比度 | **4.44:1**（< 4.5:1 · AA 阈值） |
| 对照读数 | 按 AC 字面压 `.sf-shell` 夜档底 = `4.05:1`（**非有效底色**，只作对照）；`Header` 登出钮 `rgba(255,255,255,0.92)` on `rgb(31,41,55)` = `12.63:1` |
| 归因 | ① 底色来自 `Card` 的 secondary 既有定义（**2026-10-02 后未改、本单零触及**）；② **日档复量同值**（`lightTheme.ratio = 4.44`）⇒ **与主题无关**；③ 类名层面同款（`Header` 登出钮）真渲染被覆盖 ⇒ **不能当豁免证据** ⇒ 判 **「父版同形的既有面、非本单回归」** |
| 裁定 | **Kevin 已裁：不改色，登记为漂移项**（不阻断） |
| 可选处置（一句话可改，本轮不做） | 改 `text-red-700` 一类更深档；或改主题危险色 token（后者须走主题 token 链路 + `STRUCT_PROV` 溯源，不得硬编）。改后须复量合成比 ≥ 4.5:1（日 / 夜两档）并补 `< 4.5` 判负断言 |
| 证据 | `ops/bttc-mint-shortfall/qa/verdict.json`（AC9 · `PASS-with-drift`）· `ops/bttc-mint-shortfall/qa/AC9-dark-contrast.json`（`composited.ratio = 4.44` · `ratioVsShellBackground = 4.05` · `lightTheme.ratio = 4.44`） |
| 上线事实 | 实现 `eebe883` · 质检证据 `745a4ea` · 生产终验 `e1283da` |

## 2. 条目二：Vercel Hobby 档位约束（写入同一 ★ 块 ②）

平台 = **Vercel Hobby**（生产部署档位）。**2026-10-17 现取官方页原文**（见 `readings/vercel-docs-quotes.txt`）：

| 约束 | 官方读数 | 来源 |
|---|---|---|
| cron 频率 | **每条每天最多 1 次**；`0 * * * *` / `*/30 * * * *` **部署即失败**（`Hobby accounts are limited to daily cron jobs`） | `vercel.com/docs/cron-jobs/usage-and-pricing` |
| cron 精度 | **按小时窗口，非准点**：`0 1 * * *` ⇒ `01:00–01:59` 之间任一刻（表头 `Per-hour (±59 min)`） | 同上 |
| cron 条数 | **100 条/项目** | 同上（页脚 `Last updated July 15, 2026`） |
| 函数时长（fluid compute） | **Hobby 默认 300s、上限 300s**（Pro 300s 默认 / 800s 上限 / 1800s 扩展 β） | `vercel.com/docs/functions/limitations` |
| 用途 | **Hobby 仅限非商业个人用途**；`All commercial usage of the platform requires either a Pro or Enterprise plan`；commercial 逐字含「Any method of requesting or processing payment from visitors of the site」「Advertising the sale of a product or service」 | `vercel.com/docs/limits/fair-use-guidelines` + `/legal/terms` |

### 2.1 必须留痕的口径差（本单现取纠正，不静默沿用）

- 派单 / 台账沿用的「**cron 最多 2 条/项目**」**与官方现页不符**：官方表列 **100 条/项目**。旧值可追溯至 `vercel.com/blog/cron-jobs`（beta 期「Hobby: 2 cron jobs total」）与第三方转述。
- 处置：**以官方 docs 表为准**写入（100），**旧值「2 条」在册内留痕标明来源并声明不改**；硬约束落在「**每天 1 次 + 非准点 + 300s**」三条 —— 这三条两版一致，**不因条数口径变动而变**。
- 影响：后续 cron 类派单**不得以条数上限（2 或 100）作为可行性否决理由**；真正的否决面是「**日 1 次 / 非准点 / 300s / 非商业**」。

### 2.2 待裁定风险（已入册，未处置）

- 本站存在**积分 `$`、商品交易与悬赏押款** ⇒ 按 Fair Use / ToS 逐字**落在「commercial usage」定义内** ⇒ Hobby 档位在条款面不成立；**价格与处置（升 Pro / 迁出 / 其它）未定**。
- 补充事实（未在派单里，现取补登）：ToS 明载 Hobby 项目 Vercel **可在无通知情形下停用或删除**（「We may shut down and terminate projects or deployments using the Hobby plan without notice for any reason or no reason」）。

## 3. 同批在办项（只记「已派单 / 在办、未入库」）

- 事实：`/api/translate/backfill` **原先只注册 `app.post`**，而 Vercel cron 以 **GET** 调用 ⇒ 该日级任务**此前从未生效**。
- 修法（已裁）：**同一 handler 双注册（POST / GET）** + 离线门注册点常量前推。
- 状态：**Kong 在办、未入库**。现取证据 —— `git show HEAD:backend-ts/src/index.ts` 仅见 `app.post('/api/translate/backfill', …)`（HEAD `e1283da`）；工作区已有 `M backend-ts/src/index.ts`（含 `app.get('/api/translate/backfill', translateBackfillHandler)`）与 `M backend-ts/scripts/p7b-03-offline-gates.ts`。
- 册面写法：**「已派单 / 在办、未入库」**，**不写「已修复」、不写 commit 号**（入库后补登），避免账实错位。

## 4. 未做 / 为什么不写 `route-layer.spec.md`

- 复核 `docs/route-layer.spec.md`（8634 行，末节 = **§45 v2.35**）：既有节位里**没有**承接「同一 handler 挂多 verb / cron 触发方法与注册 verb 错配」的节。最近的两处 —— §10.7（`backfill` 端点与运维：只登记「`POST` + `HOST cron 每日 1 次`」）与 §45（缺额提示的读口增量）—— **都不是**该事实的归属节。
- 按派单「**找不到合适既有节位就不要硬插新 §**（宁缺不破倒序结构）」，本单**不动 route 册**；该在办项在 `docs/OPEN-ITEMS.md` 的 ★ 块 ③ 与 `B31` 相邻说明里写清。入库后如派单要求，另起 §46 单条登记（届时可写实现细节与注册点常量读数）。

## 5. 改动与核验

| 文件 | numstat（增 / 删） |
|---|---|
| `docs/OPEN-ITEMS.md` | `2 / 0`（+1 顶部 ★ 块 · +1 `B31` 表行） |

- **删除行 = 0**（`git diff --numstat -- docs/` = `2 0`；`git diff -- docs/ | grep -c '^-[^-]'` = `0`）⇒ 存量行一字未动，编号 `B30` 及 `F*` 全序未动。
- 顶部 ★ 块位置：放在既有 **最后一个** ★ 块（v2.35）**之下**，未打乱既有块顺序（v1.10 → … → v1.20/v1.21 → v2.35 → **v2.36**）。
- 未改 `docs/route-layer.spec.md`；未改任何代码 / 迁移 / 前端；未 push。
- 读数留痕：`readings/numstat.txt`、`readings/numstat-total.txt`、`readings/vercel-docs-quotes.txt`。
