# 审计件 · 上架成功 ⇒ 自动跳该商品详情页（小需求单 · Kevin 2026-10-11）

- 角色：Kong（实现）· 小需求单 · **不 push**（push = 上线，另单）
- 仓 / 基线：`/Users/kevin/bistro/seafood` @ `76ecf0d`（改动前工作区除他单的 `docs/design`、`docs/versions` 外干净）
- 落点：`frontend/src/pages/listings/PublishListingPage.jsx`（本单唯一源码改动；**未动路由表、未动后端、未动 i18n 词典**）

## 1. 口径（逐条可判负）

| # | 条件 | 期望 | 实现落点 |
|---|---|---|---|
| ① | `publishListing` 成功 **且** `setListingStatus(…,'listed')` 成功 | 跳该商品详情页；目标 = `root('/listing/' + listingId)`（**带当前语言前缀**，四语一致） | `PublishListingPage.jsx:75-78` |
| ② | `setListingStatus` 抛错 | **不跳**，保持既有错误态 + `return`（R107 文案链） | `:58-61`（既有）+ `:75` 的 `listed` 门 |
| ③ | `publishListing` 抛错 | **不跳**，错误态 | `:79-81`（既有 catch） |
| ④ | `listingId` 为空/缺失（接口未回 id） | **不跳**，保持 ok 态原地停留；**严禁拼 `/listing/null`** | `:75` 的 `listingId` 门（`:66` 的 ok 态文案照旧 `#-`） |

可见反馈（Kevin 硬偏好：保存类操作不得无反馈）：**跳转前**先 `toast.success(...)`（`:76`），文案 = `t('listings.publishOk')` + `#<id>`
—— **复用既有键，未新增 i18n 键**；`main.jsx` 顶层已挂 `<Toaster/>` ⇒ toast 跨路由存活，用户落到详情页仍看得见「上架成功」。
时序 = toast 同步先发、`navigate` 紧随其后（`:76` → `:77`）；**刻意不引延时器**：既无「未清理定时器」面，单测也保持确定性。
本页成功态本来就被跳转取代，故「ok 态文案」不再是用户可见反馈的载体（改由 toast 承担）；文案与状态节点**仍原样保留**（不改口径、不动其它分支）。

## 2. 改动清单（文件:行号 · 最终态）

- `frontend/src/pages/listings/PublishListingPage.jsx:4` —— 新增 `import toast from 'react-hot-toast'`（仓内既有多处同形用法，`main.jsx` 已挂 `<Toaster/>`；**不新增依赖**）。
- `frontend/src/pages/listings/PublishListingPage.jsx:68-78` —— 注释（口径自曝）+ `if (listingId && listed) { toast.success(…); navigate(root('/listing/' + listingId)) }`。
- `frontend/src/test/unit/listing-publish-redirect.test.jsx`（新建，9 例）。

「去列表」按钮（`:105` `data-sf-m="listing-goto-feed"`）**保留**，理由：它挂在页头 `sf-listings-actions`，在 **idle / loading / error 态**均为活入口（也是本页唯一的列表回退入口）；
仅在「成功态」被跳转取代而不可达 ⇒ **不是死代码**。（反选：删它要回算入口集合与可达性、并可能撞 `v15-nav-floatmenu` / `fix-nav-langshell` 一类入口断言，收益为零。）
不删的另一层原因：删按钮属于「导航/入口集合变更」，会牵出 `frontend-parity-acceptance` 的入口丢失回算与 AC 重写，与本单「只做跳转」的范围不符。

## 3. 新增用例名单（`listing-publish-redirect.test.jsx`，9 例）

替身选型（刻意的两点，防「假门」）：
- `react-router-dom` **部分替身**：`useNavigate` = 记录实参 **+ 转发真 hook** ⇒ 「参数正确」与「真路由确实落到详情页（id 未被吃）」两件事同时被钉住（只录不跳则后者无证据）。
- `listing-api` **importOriginal + 只桩两个网络面** ⇒ 幂等 tracker / 指纹仍跑真代码（同 `listing-market.test.jsx` 的 `ledger-api` 替身注释：漏键会把真前置打成 `TypeError` 假红）。
- `t` 取**模块级稳定函数**且回**键名**本身 ⇒ 既避开「每次新建 `t` 闭包 ⇒ 无限重渲染」，又顺带钉住「文案走 i18n 键、不是硬编中文」。

| # | 用例 | 钉住 |
|---|---|---|
| ① | zh（无前缀）⇒ `/listing/123` | 目标 = 无前缀；先 toast 后 navigate（`invocationCallOrder` 比对） |
| ① | en ⇒ `/en/listing/123` | 语言前缀 |
| ① | hk ⇒ `/hk/listing/123` | 语言前缀 |
| ① | vn ⇒ `/vn/listing/123` | 语言前缀 |
| ② | `setListingStatus` 抛错 ⇒ 不跳 | 错误态 + `listings.listedFail` + 非 `[object Object]` + 零 navigate / 零 toast / 页面仍挂载 |
| ③ | 接口回 `{}` ⇒ 不跳 | ok 态 + `#-` + 零 `setListingStatus` + 零 navigate + 实参无 `null`/`undefined` |
| ④ | `publishListing` 抛错 ⇒ 不跳 | 错误态文案 + 零 navigate / 零 toast |
| ⑤ | 回包只有 `bID` ⇒ `/en/listing/987` | 同源兜底字段走同一跳转口径（不漏跳） |
| ⑥ | 「去列表」按钮的可见态 | idle 态可见 ⇒ 跳转后随本页卸载（证明其**不是死代码**、也不残留） |

① 四例内均断言：`navigate` 恰 1 次、实参逐字等于目标、真路由渲染出 `DETAIL:<id>`、`toast.success` 恰 1 次且实参含 `listings.publishOk` 与 `#123`。

## 4. 门套读数（改动前 → 改动后）

| 门 | 改前 | 改后 | 判 |
|---|---|---|---|
| `npm run test:unit` | `50 files / 479 tests / 0 failed` | **`51 files / 488 tests / 0 failed`** | 例数不降（+1 文件 / +9 例）✅ |
| `npm run build` | — | **exit 0**（管道外捕获：`npm run build > log; echo $?` ⇒ `0`；`✓ built in 1.83s`，`dist/assets/index-BdXUKnm_.js`） | ✅ |
| 前端 `tsc` | 前端无 `tsconfig` | **N/A**（如实标注，未跑、不得假称跑过） | — |

## 5. 判负自证（反向对照：把实现改坏 ⇒ 用例必须红）

三次**临时**改坏源码后重跑本单测试文件（改后已**逐字还原**，见 §2 最终态）：

| 改坏法 | 实测读数 | 结论 |
|---|---|---|
| 整段跳转短路（`if (false && …)`） | `6 failed | 3 passed`（①×4 + ⑤ + ⑥ 红） | 「不跳 ⇒ 不红」不成立，非空门 ✅ |
| 只去掉语言前缀构造器（`navigate('/listing/'+id)`） | `4 failed | 5 passed`（① en/hk/vn + ⑤ 红；**zh 仍绿**） | 前缀这一条真被判负；zh 无前缀档不动 ✅ |
| 去掉「无 id 不跳」门（`if (listingId || true)`） | `1 failed | 8 passed`（**恰 ③ 红**） | ④ 分支真被判负，且**不外溢**到其它用例 ✅ |

## 6. 未测 / 挂账（如实标注）

- **真端到端（浏览器 + 真写库）未测**：上架需钱包登录 + 真写 `POST /api/listing` 与 `PATCH /api/listing/:listingId`，
  本机无该条件、**不伪造**。本单证据面 = 单测（jsdom + 真路由 + 真 utils 前缀构造器）+ 构建产物。
- 语言前缀真源 = `utils.getLanguageFromUrl` + `buildLocalizedPath`（`root` 唯一构造器），本单未新增第二处拼接。
- 四语词典**未改**（复用 `listings.publishOk`）⇒ 四语键集硬断言（逐文件相同）不受影响，实测亦未红。
- **不 push**（push = 上线）：本单只本地 commit。

## 7. 顺带（只读，未改）：`PublishJobPage` 是否同形

**是** —— `frontend/src/pages/jobs/PublishJobPage.jsx:66` 发布成功后只 `setState({ phase:'ok', … })` 就**停留原地**；
该文件 `react-router-dom` 只 import `Link, useLocation`（`:2`），**全文无 `useNavigate`、无 `navigate(`**
⇒ 「发布招工成功 ⇒ 自动跳招工详情页」是同形缺口。**本单不改它**，仅供参考与后续派单。
