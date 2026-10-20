# REPORT · 管理员编辑（0059）前端收尾 —— 7 红定性修正 + 五臂探针

- **仓 / 分支**：`/Users/kevin/bistro/seafood` · `main` · 起点 HEAD `e48c567`（本单前端改动此前未提交）
- **范围**：前端（`frontend/**`）＋ 本线探针/读数（`ops/admin-edit/front/**`）。**零后端改动、零迁移、零 docs 改动、零 push、零库写**。
- **日期**：2026-10-20

## 1. 结论

| 项 | 读数 |
|---|---|
| `npm run test:unit` | **66 files / 678 tests / 0 failed**（改前 65 files / 661 tests / 7 failed；例数 +17、零减少） |
| `npm run build` | **exit 0** · `✓ built in 1.67s` · `dist/assets/index-CSvIG4nJ.js` / `index-CeuScJSt.css` |
| 浏览器五臂探针 | **verdict = PASS**（6/6：AC-1 三态 / AC-2 / AC-3 / AC-4 / AC-5@390 / AC-5@1536） |
| 探针负控（灵敏度自证） | **verdict = SENSITIVE**（5/5 反事实注入后判据均翻红） |

## 2. 7 红逐例定性：**全部是夹具（测试替身）缺陷，产品零改动**

### 2.1 根因（一条，覆盖全部 7 例）

`admin-edit-front.test.jsx` 把 `vi.mock('../../auth')` 的缝合点放在 **`fetchApiJson` 的导出**上，
但 `auth.js` 里的 `fetchCurrentUser` 调用的是**同模块内绑定**的 `fetchApiJson`
（ESM 内部引用不经过模块命名空间对象）⇒ 替换导出**拦不到**那次内部调用。

实测自证（本次当场跑的对照）：

```
$ npx vitest run <一次性探针>   # 只 mock 导出，调 fetchCurrentUser
ERR= Failed to parse URL from /api/user   VAL= null
CALLS= 0        # 模块导出的 spy 调用数 = 0
```

后果链：`/api/user` 走**真传输**（jsdom 无 server ⇒ `Failed to parse URL`）⇒
`item-edit-access.loadListingEditAdmin` 按设计 **fail-safe** 回 `null`（不猜补管理员能力）⇒
`canEditAny = false`。于是：

| # | 红例（改前） | 定性 | 处置 |
|---|---|---|---|
| 1 | A · 陌生人（负向臂）：`expected spy to be called with ['/api/user', …]` | 夹具：spy 挂错缝合点（实际首个调用是 `/api/favorites`） | 改夹具（缝合点移到 `fetchCurrentUser`，并令其显式**经过** `fetchApiJson` 替身） |
| 2 | A · 管理员看他人商品 ⇒ `item-edit-link` 在场（`expected null not to be null`） | 同上（能力位恒 false） | 同上 |
| 3 | A · 管理员 ∧ status=delisted ⇒ 入口不渲染 | 同上（断言里的「探测真的发生过」前提不成立） | 同上 |
| 4 | A · `can_access_admin=true` 但无 `manage_rewards` ⇒ 不渲染 | 同上 | 同上 |
| 5 | D · 管理员 ∧ 行不在「我发布的」⇒ `item-admin-note` 在场 | 同上（提示条是管理员能力 ∧ 归属判定的复合条件，第一段恒 false） | 同上 |
| 6 | D · 管理员 ∧ 行在「我发布的」⇒ 提示条不渲染（`fetchMyListings` 未被调用） | 同上 | 同上 |
| 7 | E · 管理员改价 ⇒ `PATCH {price:15}` | 同上（先 `waitFor(item-admin-note)` 超时） | 同上 |

### 2.2 顺带修掉的两条「假绿/假红」断言

- `expect(fetchApiJson).not.toHaveBeenCalled()`（本人臂 / 未登录臂）**本身是坏尺子**：详情页同一次挂载里
  还会经 `trades-api` 读 `/api/favorites`（收藏态初始化，与本品无关的既有读口）⇒ 整条 spy 恒有调用。
  改成 `userProbeCount()`（**只数 `/api/user`**），断言意图（「本人/游客臂不白发一条管理员探测」）一字未改、判据更准。
- 负向臂改前对「本就不存在的元素」调 `page.getAttribute`（探针侧同类错，见 §4.1）。

**产品代码本轮零改动**（`item-edit-access.js` / `ItemDetailPage.jsx` / `PublishItemPage.jsx` / `item-api.js` / `item.css` 均为上一单已落盘内容，本单只做定性 + 提交）。

## 3. 五臂探针（`ops/admin-edit/front/probe-five-arms.mjs`）

零 dev server（`context.route` 把 `http://sf.local/**` 映射到 `frontend/dist`）、
零真后端（API 全部内存自截）、零库写；登录态 = `addInitScript` 预置 `localStorage.user`；
禁动画 + rAF 双帧稳态采样。读数 = `readings/five-arms.json`，日志 = `logs/probe-five-arms.log`。

| 臂 | 判据 | 实测读数 |
|---|---|---|
| **AC-1** 入口可见性 | 本人 / 陌生人 / 管理员看他人商品 | `present = true / false / true`；`href = /item/9/edit`；`/api/user` 探测数 = **0 / 1 / 1**（本人臂零请求，符合设计） |
| **AC-2** 管理员预填 + 提示条 | 五项 + `item-admin-note` | description `旧描述首行\n旧描述第二行` · price `9` · stock `4` · 级联 `physical + 包邮`（数字/自动发货/买家付运费均未选）· condition `LikeNew` · 既有图 1 张 · cid 只读 · 提示条文案 `管理员编辑` |
| **AC-3** 管理员保存 | PATCH 恰一次、回列表 | `patch = [{price:15}]`（键数 1、无 `title`/`cid`）；表单已卸载；URL = `/profile/trades/published` |
| **AC-4** 普通用户直访他人编辑页 | 403 不白屏 | `item-edit-load-error` 在场、文案 `权限不足` ＋ 回列表出口；`item-form` 不存在；`#root` 2 个子节点；零 pageerror |
| **AC-5@390×844** | 不压底栏/胶囊 · 零溢出 | 入口 `{left:278,right:330,top:81,bottom:125,w:52,h:44}`；与操作栏相交 **0**；横向溢出 **0**；字号 12px（≥12 下限）；触控高 44（≥44） |
| **AC-5@1536×900** | 同上 | 入口 `{left:1468,right:1516,top:73,bottom:107,w:48,h:34}`；与操作栏（`924..1516 × 546..606`）相交 **0**；横向溢出 **0**；右缘距视口 20px |

**两条口径披露（不粉饰）**：

1. **详情页底栏本就 `display:none`**（`.sf-tabbar.is-detail` = 设计口径「详情页隐藏底栏」）⇒
   「入口不压底栏」在该页**结构性成立**（`tabbarDisplay = none`、相交恒 0），**承重的是操作栏臂**（AC-5 已实测 0）。
2. `AC-1` 本人臂断言的是「**不补取** `/api/user`」（=0），不是「一次网络都不发」——收藏读数会发 `/api/favorites`，属既有行为。

## 4. 探针负控（`probe-negative-controls.mjs`）—— 尺子灵敏度自证

绿读数只有在「反事实能让它变红」时才算证据。5 条反事实注入（零改仓内源码，仅页面内联样式 / 内存夹具）：

| 负控 | 注入 | 期望 | 结果 |
|---|---|---|---|
| NC-1 | `/api/user` 三键改成非管理员（卖家仍是他人） | 入口消失 | `linkPresent=false`、`/api/user` 探测 = 1 ⇒ **SENSITIVE** |
| NC-2 | `GET /api/listing/mine` 含该商品 | 提示条消失、表单仍在 | `noteText=null`、`formPresent=true` ⇒ **SENSITIVE** |
| NC-3@390 | 页面内联样式把入口 fixed 到**实测操作栏矩形**上 | 相交面积 0 → > 0 | `before=0` → `after>0` ⇒ **SENSITIVE** |
| NC-3@1536 | 同上（1536 的操作栏在右栏内，不在视口底部） | 同上 | `before=0` → `after>0` ⇒ **SENSITIVE** |
| NC-4 | 读口改 404 | 文案走 notFound 分支、不含「权限不足」 | 文案含「未找到」、无「权限不足」、无表单 ⇒ **SENSITIVE** |

★ NC-3 首版写死 `bottom:8px` 时 **1536 档假阴性**（操作栏在右栏中段、碰不到视口底部）⇒ 已改成按**实测矩形**落点。
这条同时是「反事实本身也可能不生效」的实例：注入没打中，负控就会误报「尺子没分辨力」。

## 5. 文件

**改（本单）**
- `frontend/src/test/unit/admin-edit-front.test.jsx` —— 替身缝合点修正（`fetchCurrentUser` 经 `fetchApiJson` 替身）＋ `userProbeCount()` 收窄两条坏尺子断言
- `frontend/src/locales/{zh,en,hk,vn}.json` —— `item.adminEditing`（四语同补）
- `frontend/src/test/unit/` 的 i18n 计数断言 14 件 —— 按 `adminEditing` 新键**现取复算**等值前推
- `frontend/src/pages/item/{item-api.js,item-edit-access.js,ItemDetailPage.jsx,PublishItemPage.jsx,item.css}` —— 上一单已落盘内容，本单只提交
- `ops/admin-edit/front/` —— `probe-five-arms.mjs` / `probe-lib.mjs` / `probe-negative-controls.mjs` / `readings/*.json` / `logs/*.log`

**未动**：`docs/**`（同树兄弟单 item-id 的 spec 改动，**不在本单范围**）、`backend-ts/**`（`0060` 迁移属兄弟单）、`ops/item-id/**`。

## 6. 已知边界

- 探针的 API 面为内存夹具 ⇒ 它证明的是**前端行为**（可见性 / 预填 / 载荷 / 分流 / 几何），不证明后端 403/台账行数；
  后端面读数见 `ops/admin-edit/p59-*.ts` 与 `ops/admin-edit/readings/`（上一单已入库）。
- 详情页 `seller.uid` 与当前 `uID` 的归属判定在探针里用**数字 vs 字符串双形态**由组件 `String()` 归一；未单独造字符串 id 臂（单测覆盖）。
