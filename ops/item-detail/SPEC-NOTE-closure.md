# SPEC-NOTE-CLOSURE · 详情页改版**上线收口**（实测锁定 ＋ 同日追加裁定）

- **单号**：`JING-SPEC-ITEM-DETAIL-CLOSURE`（Jing · 制度员 · 收口笔）
- **性质**：**规范收口登记**（只写 `docs/**` + 本文件）。**零代码 / 零迁移文件 / 零测试改动 / 零 HTTP 写 / 零库写 / 不 push**。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = 4ae86d1`（工作区干净）
- **前序件**：`ops/item-detail/SPEC-NOTE.md`（契约登记，起点 `HEAD = c3e500a`）—— 本文件是其**上线后的收口与实测锁定**，**不替换、不改写**前序件。
- **正典（本笔五处）**：
  1. `docs/design/design-system.spec.md` **§26.15.9**（末追加 · 实测锁定 ＋ 判负 #51–#54）
  2. `docs/route-layer.spec.md` **§49.14.7–§49.14.12**（末追加 · 开关口径 / viewer_key / 404 / fail-open / 缓存改判 / 判负 #29–#34 / 实测锁定）
  3. `docs/data-layer.spec.md` **§40.10.9–§40.10.11**（末追加 · `app_config` 键口径 / 缓存张力结案 / 运行态读数）
  4. `docs/seafood.master-plan.md` **§5.442**（前插于 §5.441 之上）＋ **版本行 v0.359**（前插于 v0.358 之上）
  5. 本文件

## 1. 上线事实（本笔的锁定前提）

- **push 范围** = `0a564e2..8d9e48b`（**八笔**）：`46b6da6` P57 后端 → `74fd56f` H5 五段 → `e8f6d81` Web 两栏 → `81560da` P58 去重开关 → `3306688` H5 收藏钮 → `1f71164` 两缺陷 → `58a4d4e` 质检 → `8d9e48b` 成色表单；终验另笔 `4ae86d1`。
- **两库 `schema_version` = `0058`**（`0057` 双列、`0058` 日志表 + 开关行）。
- **同版证明**：线上 HTML 引用 `index-BUJFF7Ji.js` / `index-DwgaiwBH.css` = 本地 HEAD 构建产物**逐字同名** ⇒ 下列读数属**线上同版**，非本地预览 / 非 dev。

## 2. 锁定读数（现取自仓内证据件，非记忆）

| 面 | 读数 | 证据件 |
|---|---|---|
| 详情键 | **50**（+`views` / +`condition` / +`wants`） | `qa/readings/01-read-write-ac13-*.json` |
| feed 键 | **48**（不变） | 同上 |
| `mine` 键 | **11**（+`condition`） | 同上 |
| 注册点 | **110**（get 49 / post 57 / put 0 / delete 3 / patch 1，本笔现取复算） | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\('` |
| H5 底栏 | `fixed` / `bottom:0` / 四件同高 **44** / 后两件右缘 **378/378** | `prod-verify/prod-bar.json` |
| Web 底栏 | `static` / 留言 `display:none`（0×0）/ 拼接组 **924–1430** / 独立收藏 **1438–1516** | 同上 |
| 详情请求 | 一次挂载 **1** 条（双档 `prizeReqs = 1`） | `prod-verify/prod-detail.json` |
| 价格 / 包邮 | `rgb(255,77,0)` **32px** / `rgb(255,230,15)` | 同上 |
| NULL 成色兜底 | `settle-tag` 在场、`condition-tag` 缺席 | 同上 |
| 浏览计数 | `off` 连读三次各 **+1**；`on` 同 viewer 同日只计 1 | `readings/p58-view-dedup-gate-*.json` |
| 门套 | p57 **40/40** · p58 **29/29** · p7b **37/37** `regs=110` · 前端 **65 文件 / 661 例** | `readings/p57-*` / `readings/p58-*` / `qa/logs/qa-p7b03.log` / `front/logs/test-unit-item-condition.log` |

## 3. 本笔追加的三条口径（要点）

1. **去重开关**（route §49.14.7 / data §40.10.9）：键 `detail_view_dedup`；**读法唯一 `value->>'dedup'`**（每请求单行 SELECT、无缓存、改行即生效）；闭集 `on|off`；**缺行 / 缺字段 / 非字符串 / 闭集外 ⇒ fail-safe `on`（去重）**；**代码默认 on、当前配置 off**；值必须是 **jsonb 对象**（`{"dedup":"off"}`，容器 CHECK 逼对象包裹，裸标量必拒；键写在值里 ⇒ `{"detail_view_dedup":"off"}` 是错形）。
2. **viewer_key 三形态**：`uid:<id>`（Bearer 验签零查库）/ `anon:<x-sf-viewer>`（128 上限）/ `anon:<sf_viewer cookie>`（缺失发 uuid4 HttpOnly·Lax·1y）；去重键 = 同 listing + 同 viewer + 同日唯一；**404 零日志**、**fail-open**、冲突分支只读（`view_count + 1` 全仓恰 1 处）。
3. **★ 详情缓存头改判（另单 P59 实施）**：生产实测 `views` **2 → 4 → 4** ⇒ 根因 = `setPublicCache`（`public, s-maxage=30`）使 CDN 命中不落 origin ⇒ 浏览数不增 + 读数跳动。裁定 = **详情口无条件 `setPrivateNoStore`**（`private, no-store`），原「仅新发 cookie 分支 no-store」收窄口径**作废**；`Vary: Authorization` **不作要求**（该路由历史上不设该头、`no-store` 下缓存键区分无意义；另加不判负，但不得用它替代 `no-store`）；**feed / task / home 缓存一字不改**。判负 **#29**：详情 `Cache-Control` 含 `public` / `s-maxage`，或以 `Vary` 替代 `no-store` ⇒ 判负。表述纪律：**浏览量 = 每次打开一次（受去重开关约束）**；**feed 仍可公开缓存** —— 两句不得混写。**实施状态**：落册时 P59 改动已在同工作树、未提交（详情块无条件 `setPrivateNoStore`、块内 `setPublicCache` / `mintedCookie` 零命中）⇒ 响应头实测与门套读数由该单补；本笔不 add 该两件、不代其声明上线。

## 4. 两缺陷（已修，回归即判负）

- **收藏 toggle 未联动 `wants`**：修法 = 本地 ±1（下限 0、不重拉整页；响应带 `wants` 以响应为准）。
- **详情 effect 依赖未收敛**：一次挂载发 2 条 `/api/prize/<id>` ⇒ 依赖收敛 `[id, uidKey]`（`user`/`t` 走 ref）+ `reqSeq` 丢过期响应；判据 = 刷新 3 次每次恰 1 条。

## 5. 纯追加自证（方法可复核）

- 三本 spec 均**文件尾追加**（`>>`），master-plan 为**前插**（新节在 §5.441 之上、新版本行在 v0.358 之上，其后行序 v0.359 → v0.358 → v0.357 逐行递减）。
- 提交前现取 `git diff --numstat` ⇒ **删除列 = 0**（三本 spec 与 master-plan 逐件核，不照抄体例）。
- 结构核：`grep -n '^### 5\.44[0-9]'` ⇒ 1417 / 1439 / 1453（§5.442 → §5.441 → §5.440）；`grep -n '^| v0\.35[5-9] '` ⇒ 9534–9538 递减。
- **只 add 五件**（`git reset -q` 后 pathspec 逐个 add，不用 `git add -A`），**不 push**。

## 6. 挂账（承接、不新增）

1. **缓存改判的实施读数待补**：另单 P59 的代码改动在本笔落册时已在同工作树（未提交）⇒ 须由该单补「详情响应头 `Cache-Control: private, no-store`」实测 + p58 门 A3 臂复跑读数，并把旧「计数为下界（因 CDN）」表述按 route §49.14.10 / data §40.10.10 读。
2. **服务端不强绑「实物 ⇒ 必填成色」**（现为前端闸；一句话可改）。
3. **详情口失去边缘缓存 = 读放大**（已裁接受的代价）。
