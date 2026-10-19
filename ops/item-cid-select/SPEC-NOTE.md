# SPEC-NOTE · 发布商品页「币种编号」改下拉选择器 + 新公开只读口 `GET /api/currencies`

- **单号**：JING-ITEM-CID-SELECT（seafood 仓 · Jing 角色 · **只写 `docs/**` + `ops/**`**）
- **Kevin 指令原文（逐字）**：「在发布商品的时候，【币种编号】一栏，不要输入编号，而是要在下拉框中选择币种。」
- **冻结契约（逐字）**：见下 §2「与实现的对照清单」；实现方 = Kong（同批），质检 = Neng。
- **本单零代码**：不碰 `backend-ts/**`、`frontend/**`；不跑前后端门套；不 push。

---

## 1. 改了哪几处（节号 / 版本号 / numstat）

| # | 文件 | 位置（节号 / 版本号） | 改动性质 | numstat |
|--:|---|---|---|---|
| 1 | `docs/route-layer.spec.md` | **顶部版本块 v2.37**（紧随 v2.36 块 ⑤ 行之后） | 前插新版本块（状态行 + 修订入口 + 本单要点 ①–⑥） | **`122 0`** |
| 2 | `docs/route-layer.spec.md` | **新 §47**（§47.0–§47.7，接在 §46.7 之后，`---` 分隔） | 新增节（读口契约 / 注册点逐 verb / 前端消费面 / locale / 既有登记处置 / 判负 15 条 / 自证） | 同上行合计 |
| 3 | `docs/seafood.master-plan.md` | **新 §5.418**（前插在 §5.417 之上） | 新增节（A 指令原文 / B 契约 / C 注册点现取 / D 分工 / E 既有登记处置 / F 判负汇总） | **`15 0`** |
| 4 | `docs/seafood.master-plan.md` | **版本表新行 `v0.336`**（前插在 `v0.335` 之上，表内最新在上） | 新增行 | 同上行合计 |
| 5 | `docs/design/design-system.spec.md` | **版本头勘误块（2026-10-19 · 勘误级不升版）**（紧随 `v1.23` 块之后） | 前插勘误块（旧句保留 + 「作废 · 以本段为准」） | **`3 0`** |
| 6 | `docs/design/design-system.spec.md` | **§15.2 A 表后就地勘误段**（第 18 / 19 行之后，「旁证」行下） | 就地追加勘误段（表体与旁证行**一字未动**） | 同上行合计 |
| 7 | `ops/item-cid-select/SPEC-NOTE.md` | 本文件 | 交付说明 | 新增文件 |

**纯追加自证（`git diff --numstat` 现取，删除列全部 = 0）**

```
3	0	docs/design/design-system.spec.md
122	0	docs/route-layer.spec.md
15	0	docs/seafood.master-plan.md
```

> 三册**均无口径订正型替换**（不含「替换旧句」），故不适用「含 N 行订正」声明：**删除行 = 0 是字面事实**。design 册的「旧句作废」采用**状态改写式**：旧行逐字保留 + 紧随其后追加勘误段（非删除、非替换）。

**锚点自证（现取）**

| 检查 | 命令 | 结果 |
|---|---|---|
| 版本块唯一 | `grep -c '^> \*\*状态：v2.37' docs/route-layer.spec.md` | **1** |
| 节号唯一且无跳号 | `grep -c '^## §47 ' docs/route-layer.spec.md`（前值最大 = §46） | **1** |
| 册内最大节号 | `grep -oE '^### 5\.[0-9]+' docs/seafood.master-plan.md \| sed 's/### 5\.//' \| sort -n \| tail -1` | **418** |
| 版本表首行 | `grep -n '^| v0.33[0-9] ' docs/seafood.master-plan.md \| head -2` | `v0.336`（新）在上、`v0.335` 在下 |
| 注册点现取 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **108**（get 48 / post 56 / put 0 / delete 3 / patch 1） |

---

## 2. 与实现的对照清单（契约 ⇄ 现盘）

| # | 冻结契约 | 现盘（只读现取） | 结论 |
|--:|---|---|---|
| 1 | `GET /api/currencies` 存在，**仅 GET**、**无鉴权闸** | `backend-ts/src/index.ts` 有 `app.get('/api/currencies', …)` 注册行（改后 grep = 108），handler 无 `requireActor` / `requireAdmin` | ✅ 相符 |
| 2 | `data` = 行数组，行键集**恰** `{cid, symbol, name}` | `DatabaseService.listListedCurrencies()` 只 `SELECT c.cid, c.symbol, c.name` | ✅ 相符 |
| 3 | 仅 `status='listed'` | 同函数 `WHERE c.status = 'listed'` | ✅ 相符 |
| 4 | `ORDER BY cid` | 同函数 `ORDER BY c.cid` | ✅ 相符 |
| 5 | 纯读零写 / 零 DDL / 零迁移 | 函数只有一条 `SELECT`；本单无 `migrations/**` 改动 | ✅ 相符 |
| 6 | 成功 `sendSuccess` / 失败 `sendInfraMapped`、零新错误码 | handler `return sendSuccess(res, rows, …)` / `catch → sendInfraMapped(res, 'currencies.list', error)` | ✅ 相符 |
| 7 | 与 `GET /api/admin/currency` 是两个口 | 后台口独立存在（闸 `review_tasks`），公开口无闸 | ✅ 相符（已在 §47.0 / §47.1 写死「不得合并」） |
| 8 | 注册点 **107 → 108**（get 47 → 48，其余不变） | 会话开工时现取 = 107（get 47）；改后现取 = 108（get 48 / post 56 / put 0 / delete 3 / patch 1） | ✅ 相符 |
| 9 | 前端 `/item/new` = `select[data-sf-m="item-select-cid"]`，**`item-input-cid` 不得存在** | 现盘 `PublishItemPage.jsx:174` = `<select className="sf-item-input" data-sf-m="item-select-cid">`；全树 `grep -n 'item-input-cid' frontend/src/pages/item/PublishItemPage.jsx` = **0**（旧 input 已删） | ✅ 相符（Kong 同批 · 工作树未提交） |
| 10 | 选项文本 `symbol · name`、默认 `$`(cid 1)、失败/空回退仅 `$` 且可提交 | `currencyLabel()` = `` `${symbol}${name ? ' · '+name : ''}` ``（`name` 空 ⇒ 仅 `symbol`；无编号）；`DEFAULT_CID='1'`；`FALLBACK_CURRENCIES=[{cid:1,symbol:'$',name:''}]`；`catch` 与空列表均回退、**不禁用提交** | ✅ 相符（判负见 §47.6 #9–#11） |
| 11 | 提交 `cid` 仍为数字、`POST /api/listing` 形状不变 | `onSubmit` 走既有 `Number(form.cid)` 路径（未改）；后端 `POST /api/listing` 零改动 | ✅ 相符 |
| 12 | locale `item.cid` / `item.cidNote` **只改值、键数不变**；`jobs.*` 不动 | 四语现值 = zh `币种` / `请从下拉框选择计价币种`；en `Currency` / `Select the currency from the dropdown.`；hk `幣種` / `請從下拉框選擇幣種。`；vn `Tiền tệ` / `Chọn tiền tệ từ danh sách.` —— **手填语义全部清除**；`item` 键数四语均 **49**、`jobs` 键数均 **45**（键数不变）；`jobs.cidNote` 四语逐字未动 | ✅ 相符 |
| 13 | `jobs.cid` / `jobs.cidNote` 本单不动 | `frontend/src/pages/jobs/PublishJobPage.jsx:13` 注释仍在，`jobs.*` 文案未动 | ✅ 本单不动（注释部分过时已登记，见 §3） |

> **诚实边界**：第 9 / 10 / 12 行的「现盘」是**只读阅读 Kong 工作树 diff** 得来（开工时前端未改，收尾时已落盘、**未提交**）。本单**未运行**任何前端 / 后端门套与探针（Jing 不跑门套）⇒ 这三行的正确性只到「**代码形状与契约相符**」，**HTTP / DOM 行为实测归 Neng**。本单 commit **不含** `backend-ts/**` / `frontend/**`（那些是 Kong 的实现面）。

---

## 3. 既有登记的检索与处置（逐条）

**检索式 1**（规范 + 前端）：

```
grep -rn 'item-input-cid\|item-select-cid\|币种读口未注册\|GET /api/currency' docs/ frontend/src
```

命中与处置：

| 命中 | 旧字面（摘要） | 处置 |
|---|---|---|
| `frontend/src/pages/jobs/PublishJobPage.jsx:13`（**代码注释**） | 「币种：`cid` 手填（平台 $ = 1）—— **币种读口未注册**（已注册表内无 `GET /api/currency*`）⇒ 不作为读面依赖，登记见报告。」 | **自本批起部分过时**：公开读口已存在 ⇒「未注册」不成立；发布任务页仍未接 ⇒「不作为读面依赖」对任务页仍成立。**代码归 Kong，本单只在 `route-layer.spec` §47.5 与 master-plan §5.418 E 登记。** |
| `frontend/src/pages/item/PublishItemPage.jsx:125` | `data-sf-m="item-input-cid"` 的数字输入框 | **待 Kong 改**；本册断言「该钩子不得存在」（§47.6 #7）。 |
| `docs/audit/p4-b4c-ii-a-jobs-profile.md:145` / `:155` | 「币种列表/详情读口 **未注册**（`GET /api/currency*` 不在 65 行路径表内）」 | **历史时点读数**，审计件不改；现状以 §47 为准（已在 §47.5 登记）。 |
| `docs/audit/p8-p6-recon.md:76` | 「`grep -rn "/api/currency" frontend/src` = 1 命中，且为注释」 | 同上 = 历史时点。 |
| `docs/audit/p6-i18n-violation-closeout.md:44` | `listings.cidNote` 旧文案（「币种编号手填（币种读口未注册）」） | 历史留痕，不改。 |
| `docs/data-layer.spec.md:238` | 早期表中出现 `GET /api/currency`（计划面命名） | **不是**已注册路由（当时未实现）；本批实际路径 = `GET /api/currencies`（复数、公开）。两处命名并存属历史，已在本节注明。 |

**检索式 2**（台账挂账行）：

```
grep -n '币种读口未注册\|GET /api/currency' docs/OPEN-ITEMS.md
```

⇒ **0 命中**：`docs/OPEN-ITEMS.md` **无相关挂账行** ⇒ **无状态可改写**，本单**不新增挂账**（读口已落地，不属未闭环项）。故本单**未改 `docs/OPEN-ITEMS.md`**。

**检索式 3**（design 册是否冻结过发布页表单字段形态）：

```
grep -n 'cid\|币种\|发布商品\|PublishItem' docs/design/design-system.spec.md
```

⇒ **命中 7 行**，其中**冻结表单字段形态的条款 = §15.2 A 表第 18 / 19 行**（`item.cid` / `item.cidNote`「**值不动**」，且第 19 行值内含「请**手动填写**」）⇒ **有命中，已同批勘误**（状态改写式，见 §1 第 5 / 6 行）。**其余命中**（`T80` / `T81` 底栏菜单、§19.5 渲染面白名单等）与币种字段无关，未动。

---

## 4. 判负口径（本单写入规范的部分 · 摘要）

完整 15 条见 `docs/route-layer.spec.md` §47.6。四条硬判据（Kevin 契约直接对应）：

1. **无 `Authorization` 头 ⇒ 必须 `200`**（401 / 403 / 404 即判负）。
2. **非 `listed` 币种不得返回**（`draft` / `frozen` / `delisted` 的 `cid` 不在集合内）。
3. **行键多于三键即判负**（`Object.keys(row).sort().join(',') === 'cid,name,symbol'` 逐行断言；少键亦判负）。
4. **`item-input-cid` 存在即判负**（DOM 计数必须 = 0）；配套：`select[data-sf-m="item-select-cid"]` 必须在场。

---

## 5. 未做项（显式登记，不冒充已做）

1. `docs/versions/route-layer.spec.v2.37.md` / `design-system.spec` 快照 **未建** —— 快照重制归版本收口单（承 §45 / §46 先例）。
2. 读口 HTTP 实测、前端 DOM 实测、四语键数实测 **未由本单执行** ⇒ 归 Kong（实现自测）与 Neng（独立质检）。
3. 四语 `item.cidNote` 的**精确字面**未由本单落笔（实现单落笔后回写）。
4. 发布任务页（`/jobs/publish`）**未接**读口 —— 本单范围外；其注释「未注册」已登记为部分过时。
5. **未 commit 代码、未 push、未跑门套**（Jing 写面 = `docs/**` + `ops/**`）。
