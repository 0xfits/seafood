# 独立质检报告 — dbccd89「拆显式语言壳，修中文子页被可选语言段吞掉」

- 质检角色：Neng（独立质检）
- 仓库：`/Users/kevin/bistro/seafood`
- 任务：收尾单（接盘上一个因超时终止的同任务核验单）
- 报告状态：**进行中**（每段完成即追加落盘；本文件在核验过程中被多次续写）

---

## 0. 开工基线（head-at-start）

本单开工时**现场实测**（`git log --oneline -1` / `git rev-parse HEAD` / `git status --porcelain`）：

- 开工 **HEAD = `37c368d`**，提交信息 `master-plan v0.37: 5.32 P3 数据层规范 v0.1 终审（C1-C9 九项裁定）+ 5.33 两条库级发现`
- 分支：`main`
- **⚠️ 与 brief 的偏差**：brief 说「现 HEAD `dbccd89`」，但现场 HEAD 已是 `37c368d`。经查 `dbccd89` 是 **HEAD 的祖先提交**（`git cat-file -t dbccd89` ⇒ `commit`），其后的提交都是 master-plan 文档提交与 P3 后端工作。
- **关键取证**：`git diff --stat dbccd89..HEAD -- frontend` ⇒ **空**，即 **HEAD 的 frontend 与 dbccd89 逐字节相同**。因此针对 frontend 的核验结论对 dbccd89 同样成立，不受后续提交影响。
- `dbccd89` 提交本身（`git show --stat`）改动文件：`frontend/src/App.jsx`、`frontend/src/components/Footer.jsx`、`frontend/src/utils.js`、`frontend/src/test/unit/lang-path.test.js`、`frontend/src/test/unit/lang-path-redirect.test.jsx`。
- 主工作区 `git status --porcelain`（只读登记）：
  - ` M backend-ts/src/database.ts`（他方正跑真库修复，本单不碰）
  - 一批 `??` 未跟踪文件，归属 backend-ts / docs（他方文件，本单不碰）
- `git diff --stat -- frontend` ⇒ **空**（主工作区 frontend 干净，全单核验过程中必须保持此状态）。

---

## 1. 待核验缺陷（brief 口径）

从**带前缀子页**（如 `/vn/reward`）切「中文」后：

- URL 规范化成 `/reward`（**对**）
- 但 `htmlLang` 仍 `vi`、`document.title` 仍 vn 标题、正文却是中文页

⇒ 即「**URL / htmlLang / document.title / 正文子页** 四者不一致」。

**判据**：从 `/vn/reward`、`/en/task`、`/hk/shard` 切「中文」后，`location.pathname` 规范化（`/reward` 等）+ `htmlLang == zh-CN` + `document.title == zh 标题` + 正文是对应子页而非首页 ⇒ **四者一致**。

---

## 2. 夹具与陷阱（fixture notes）

**★ 遮挡问题（react-hot-toast 浮层压住语言菜单）**

- 证据：`toastid-out.txt` / `diag-out.txt`（上一轮诊断产物）显示，页面上存在一个 react-hot-toast 容器：`position: fixed`、`z-index: 9999`、类名 `go2072408551`、`getBoundingClientRect() = [16,16,1368,968]`（几乎铺满视口）、文本 `错误: Failed to load prizes`。
- 成因：后端（`/api/prize/all`）当前返回 **500**（他方并发会话的后端工作所致），前端弹 toast，toast 容器覆盖了右上角 header 语言菜单。
- 后果：`document.elementFromPoint(菜单项中心)` 命中 toast DIV 而非菜单按钮 ⇒ 菜单项不可点击。上一轮 `bugfix-out.json.raw` 正是此因导致的 **失败 traceback**（`RuntimeError: menu item 2 occluded: elementFromPoint != self`，`job-bugfix.py:108`），**不是成功读数**。
- 处置（**夹具问题，非产品缺陷**，不写入缺陷结论）：`job-bugfix.py` 已内置 ARM 夹具 —— 给该 `fixed;z-index:9999` 浮层打 id `probe-toast-layer` 并注入 `pointer-events: none !important`，使命中测试/真实指针事件可穿透到达菜单项。点击仍是真实 `Input.dispatchMouseEvent` 指针事件，仅屏蔽浮层的命中拦截。除此之外不动页面任何元素。
- （本节将在后续实测中补充最终采用的处置与证据。）

**★ 实测采用的处置与证据（本单）**

- 上一轮 `bugfix-out.json.raw` 的 `EXIT` 失败（`menu item N occluded`）**已复现根因并解决**：`job-bugfix.py` 的 `ARM` 夹具在每次页面就绪后给该 `fixed;z-index:9999` 浮层打 id `probe-toast-layer` 并注入 `pointer-events:none !important`。
- 本单复跑证据：`bugfix-live-out.raw` 的 `arm` 数组 **10/10 全部 `armed:1`**（其中 4 条 `toastText` 明示浮层里确有 `错误: Failed to load prizes` 文案，被命中穿透后菜单可点）；`interaction_log` 记录 9 次语言切换**全部点到正确菜单项**（`简体中文`/`簡體中文`/`粤语`/`English`/`Tiếng Việt`），**无一次 `occluded` 抛错** ⇒ 该失败纯属夹具遮挡，非产品缺陷（本报告不将其计为缺陷）。
- 结论：**遮挡已作为夹具问题处置完毕**，不再阻塞任何一段。

**★ 端口偏差（必须披露）**

- brief 与上一轮工具里写的 `BASE = http://127.0.0.1:5877` **在现场已失效**：`5877` 无监听（`curl` ⇒ 000）；`vite.config.js` 的 `server.port = 5787`（`strictPort:true`）。上一轮那个跑在 `5877` 的临时 vite 已随超时终止而消失。
- 现场真源：seafood 前端 dev server = 面板托管服务，监听 **`[::1]:5787`（仅 IPv6 localhost）**，由 vite pid 43118 提供；`127.0.0.1:5787` 会拒连（IPv6-only 绑定陷阱）。后端 proxied 到 `127.0.0.1:5788`。
- 处置：本单**不新起 vite**（避免与面板托管服务冲突），直接**只读加载**面板托管的 `http://localhost:5787` 作为被测源。取证：`git diff dbccd89..HEAD -- frontend` 空 + 固定副本 `src/`、`index.html`、`vite.config.js` 与主工作区**逐字节相同**（`diff -rq` 空；`utils.js` sha256 两边同为 `d48b70c3…`）⇒ 该活服务承载的正是 **dbccd89 的 frontend 代码**，可作被测源。
- 段内 URL 一律用 `SEAFOOD_BASE`（默认 `http://localhost:5787`）注入，不改任何工具对 `5877` 的历史记录。

**★ 浏览器/CDP**

- 平台浏览器 9411 与 9222 均无可用 CDP（`/json/version` 无响应）。本单自起 **headless Chrome（专用 profile）**：`--headless=new --remote-debugging-port=9411 --remote-allow-origins=* --user-data-dir=<scratch>/chrome-profile3`。
- **两个坑**：① Chrome 154 起 CDP **必须带 `--remote-allow-origins`**，否则 websocket 握手 403（`WebSocketBadStatusException`，本单首跑即卡在此）；② 经 `terminal(background=true)` 的裸启进程会被包装器清理掉，须从**持久内核**（`execute_code` 的 `subprocess.Popen`）启，才稳定存活。

**其它夹具口径**

- 主工作区 frontend 与固定副本 `frontend-fixed/` 内容相同（`dbccd89` 版）。判负/单测一律在固定副本内做，主工作区只读。
- 本机**无 `timeout`/`gtimeout`**；禁用 `pkill -f` / `killall`（多会话共用）。防卡采用「拆小 + 每段约 3 分钟无输出则按精确 PID 结束该 driver + 最多重试 1 次 + 如实登记」。

---

## 3. P1 核心缺陷是否真修好

**方法**：复用 `job-bugfix.py`（复制为 `job-bugfix-live.py`，仅把 BASE 改为 `SEAFOOD_BASE` 环境变量，默认 `http://localhost:5787`），**本单现场重跑**，非依赖上一轮数据。
命令：`/usr/bin/python3 cdp-driver.py job-bugfix-live.py 9411` ⇒ **`EXIT=0`**（输出 `bugfix-live-out.raw`，33012 B）。

**断言「四者一致」= `location.pathname` 规范 + `htmlLang == zh-CN` + `document.title == zh 标题` + 正文是对应子页而非首页**：

| 用例 | pathname | htmlLang | document.title | 正文 | 四者一致 |
|---|---|---|---|---|---|
| `/vn/reward` --[中文]--> | `/reward` ✅ | `zh-CN` ✅ | `Seafood 海鲜市场｜加密人自己的「闲鱼」` ✅ | `正在加载奖励...`（**非首页**：无 `欢迎来到 Jinli Club`）✅ | ✅* |
| `/en/task` --[中文]--> | `/task` ✅ | `zh-CN` ✅ | zh 标题 ✅ | `正在加载任务...`（非首页）✅ | ✅* |
| `/hk/shard` --[中文]--> | `/shard` ✅ | `zh-CN` ✅ | zh 标题 ✅ | `碎片市场持有 1000 碎片可兑换 1 份奖品市场交易我的暂无奖品数据`（**碎片市场子页本体**）✅ | ✅ |

- \* `/vn/reward`、`/en/task` 的正文本体处于 `正在加载…` 态（见下「后端 500 夹具限制」），故子页**终态 marker**（`奖励中心`/`任务中心`）取不到 ⇒ `body_is_target_subpage=false`；但正文明确**不是首页**、且加载文案按子页区分（`奖励`/`任务`），足以证明「切中文后落到的仍是该子页的壳而非首页」。`/hk/shard` 因该页数据不依赖 500 接口，取到了子页本体 ⇒ `all_four_consistent=true`。

**反向与 Footer 交叉验证（同一次 EXIT=0 运行）**：

- 反向 6 例（`/reward→hk/en/vn`、`/task→hk/vn`、`/shard→en`）：`url_pathname_ok / htmlLang_ok / document_title_ok / body_is_NOT_home / body_not_blank` **全 true**。
- Footer 语言链接（`Footer.jsx` 也是本提交改动文件）：`/vn/shard?tab=mine#top` 点页脚「中文」⇒ `/shard?tab=mine#top`、`htmlLang=zh-CN`、zh 标题、正文 `碎片市场`、**search+hash 均保留** ⇒ checks 全 true。

**结论（P1）：缺陷确已修好。** 从带前缀子页切「中文」后，URL 规范化与 `htmlLang`/`document.title` **同步切换**（修复前 `htmlLang` 停在 `vi`、标题停在 vn 标题），正文落到对应子页而非首页。

**后端 500 夹具限制（不属产品缺陷）**：`/api/prize/all` 当前返回 **500**（他方后端会话在跑），使 `RewardPage`/`TaskPage` 长期停在 `正在加载…`。这**降低**了「正文本体」类断言的可达性，但**不**影响 URL / htmlLang / title / 是否首页 四项。已在 `not_verified` 登记「reward/task 子页终态正文 marker 因后端 500 未取到」。

---

## 4. P2 四语回归 / 自愈 / 无前缀不误伤

**拆分与防卡**：原 `job-l4.py`（单进程跑三段）是上一轮卡死点。本单将其**拆为 3 次独立命令**，共用新写的 `l4common.py`（BASE 走 `SEAFOOD_BASE`，默认 `http://localhost:5787`）：`job-l4a.py`（四语）/`job-l4b.py`（自愈）/`job-l4c.py`（无前缀），**每段一个输出文件**，逐段落盘结论。

### 4.1 ① 四语标题/头部（`job-l4a.py`，EXIT=0）

`all_pass = true`。四语根路径的 `document.title` 逐字全等（含**全角 `｜` U+FF5C**）、头部短品牌逐字全等、头部不含完整句、主内容非空（mainLen=81）：

| 路径 | htmlLang | `document.title`（逐字） | 头部品牌 | title 全等 | brand 全等 | 全角｜ | 头部无完整句 | 主内容 |
|---|---|---|---|---|---|---|---|---|
| `/` | `zh-CN` | `Seafood 海鲜市场｜加密人自己的「闲鱼」` | `Seafood 海鲜市场` | ✅ | ✅ | ✅ | ✅ | 81 ✅ |
| `/hk` | `zh-HK` | `Seafood 海鮮市場｜幣圈人的跳蚤市場` | `Seafood 海鮮市場` | ✅ | ✅ | ✅ | ✅ | 81 ✅ |
| `/en` | `en` | `Seafood｜The crypto crowd's own flea market` | `Seafood` | ✅ | ✅ | ✅ | ✅ | 81 ✅ |
| `/vn` | `vi` | `Seafood｜Chợ đồ cũ của dân crypto` | `Seafood` | ✅ | ✅ | ✅ | ✅ | 81 ✅ |

四例 `checks` 失败集合均为 **空**；`main_is_home`（欢迎语）四例均 true（根路径应渲染首页，符合预期）。

### 4.2 ② 脏前缀直访自愈（`job-l4b.py`，EXIT=0）

`all_pass = true`，7 例全过（含提交显式新增的重复斜杠折叠）：

| 请求 | 落定 pathname | 单前缀 | 期望 | 标题/语言 | search/hash | 正文非空 |
|---|---|---|---|---|---|---|
| `/hk/vn` | `/hk` | ✅ | `/hk` | hk 标题 / `zh-HK` ✅ | — | ✅ |
| `/en/en` | `/en` | ✅ | `/en` | en 标题 / `en` ✅ | — | ✅ |
| `/zh` | `/` | ✅ | `/` | zh 标题 / `zh-CN` ✅ | — | ✅ |
| `/vn/hk/reward` | `/vn/reward` | ✅ | `/vn/reward` | vn 标题 / `vi` ✅ | — | ✅（正文=**奖励中心**子页） |
| `/hk/vn/reward?tab=open#top` | `/hk/reward` | ✅ | `/hk/reward` | hk 标题 / `zh-HK` ✅ | `?tab=open` + `#top` **均保留** ✅ | ✅（正文=**奖励中心**） |
| `/vn//reward`（重复斜杠） | `/vn/reward` | ✅ | `/vn/reward` | vn 标题 | — | ✅（正文=**奖励中心**） |
| `//hk`（重复斜杠） | `/hk` | ✅ | `/hk` | hk 标题 | — | ✅ |

- 每例 `checks` 失败集合均为 **空**。`single_prefix_only` 全 true（无双重前缀残留）。
- 注意：本次 `RewardPage` **完整渲染**（正文 `奖励中心用积分兑换精彩礼品和特权…`），说明上一条「后端 500 ⇒ 停在加载态」是**间歇性**的；本次运行中 `/vn/reward`、`/vn//reward` 均取到了奖励页本体，进一步佐证自愈后落到的是正确子页。

### 4.3 ③ 无前缀路由不误伤（`job-l4c.py`，EXIT=0）

`all_pass = true`，5 例全过。无一例被加上语言前缀；页面非空；标题/语言保持 zh：

| 请求 | 落定 pathname | 是否加语言前缀 | `htmlLang` | 标题=zh | 正文字节 | 正文特征 |
|---|---|---|---|---|---|---|
| `/login` | `/login` | **否** ✅ | `zh-CN` | ✅ | 294 | `JINLI CLUB 连接钱包继续探索 …钱包签名登录` |
| `/register` | `/register` | **否** ✅ | `zh-CN` | ✅ | 288 | `完成首次绑定并补全资料 …` |
| `/dashboard` | `/login` | **否** ✅ | `zh-CN` | ✅ | 294 | 未登录 ⇒ 跳登录页（路径内无语言前缀） |
| `/dashboard/tasks` | `/login` | **否** ✅ | `zh-CN` | ✅ | 294 | 同上（auth 守卫） |
| `/dashboard/users` | `/login` | **否** ✅ | `zh-CN` | ✅ | 294 | 同上 |

- `no_lang_prefix_added` 五例全 true。`/dashboard*` 因未登录跳 `/login` —— 与对锚（`45c27d8` 已验收的语言前缀规范化层）一致：**未登录跳转不会往路径里塞语言前缀**，符合提交说明「login/register/dashboard 仍先于壳精确匹配」。
- 注：本仓库已改为**钱包签名登录**，故 `input[type=password]` 数为 0（非缺陷）；判据用 `not_blank`（bodyLen>0）而非密码框存在性。

---

## 5. P3 单测（固定副本内）

**命令**（在固定副本 `frontend-fixed/` 内，未动主工作区）：
`cd frontend-fixed && npx vitest run src/test/unit` ⇒ **`EXIT=0`**（输出 `vitest-run1.txt`）。

```
 Test Files  9 passed (9)
      Tests  61 passed (61)
   Duration  3.18s
```

**基线对照**（`vitest-baseline.txt`，采于主工作区 `frontend`，与本提交同源）：
```
 Test Files  9 passed (9)
      Tests  61 passed (61)
```

**逐条比对失败集合**（按 brief「比集合不比总数」）：

- 基线失败集合 = **∅**（9 文件 61 例全绿）。
- 复跑失败集合 = **∅**（9 文件 61 例全绿）。
- **两集合逐条相同（均为空）⇒ 无不一致。**

覆盖本提交的两个新测试文件均在列且全绿：`lang-path.test.js`（`utils` 单一真源：`SUPPORTED_LANGS`/`getLanguageFromUrl`/`stripLangPrefix`/`buildLangPath`/`canonicalLangPath`，含「折叠重复斜杠」「折叠后仍幂等」）与 `lang-path-redirect.test.jsx`（防御层重定向 15 例 + **中文无前缀子路径渲染（P0）8 例**，含 `/reward`、`/task`、`/shard`、`/en/reward`、`/en/task`、`/hk/shard`、`/vn/reward`）。

---

## 6. P4 判负自证

**范围**：全部在固定副本 `frontend-fixed/` 内做（**主工作区一行未动**）。文件级备份 + sha256，两轮变异。

**基线与回滚锚**：`frontend-fixed/src/utils.js` 改前 sha256 = `d48b70c321f3828a6cc8f992e9b96a752e385823a70c8152056dca0897857b31`（与 `fixedcopy-hashes.txt` 记录、与主工作区 `frontend/src/utils.js` **三方一致**）。备份 `utils.js.orig-backup`（`cmp` 与原件逐字节相同）。

### 6.1 变异 A —— 改坏 `getLanguageFromUrl`

把 `return SUPPORTED_LANGS.includes(lang) ? lang : 'zh'` 改为**无条件 `return 'zh'`**（不再识别任何语言段）。

- 结果：`Test Files 2 failed | 7 passed (9)`、**`Tests 17 failed | 44 passed (61)`**、`EXIT=1` ⇒ **变红**（输出 `vitest-negA.txt`）。
- 17 条变红逐条：
  1. `lang-path.test.js > getLanguageFromUrl > 只识别首位语言段，含 zh，其余默认 zh`
  2. `lang-path.test.js > canonicalLangPath > 返回规范路径用于判定是否重定向`
  3. `lang-path.test.js > canonicalLangPath > 裁定口径给出的六个样例`
  4. `lang-path.test.js > canonicalLangPath > 折叠重复斜杠（中段多余斜杠也要自愈…）`
  5. `lang-path-redirect.test.jsx > 把 /hk/vn 自愈为 /hk 并渲染主体内容`
  6. `lang-path-redirect.test.jsx > 把 /en/en 自愈为 /en 并渲染主体内容`
  7. `lang-path-redirect.test.jsx > 把 /vn/reward/ 自愈为 /vn/reward 并渲染主体内容`
  8. `lang-path-redirect.test.jsx > 把 /vn//reward 自愈为 /vn/reward 并渲染主体内容`
  9. `lang-path-redirect.test.jsx > 把 //hk 自愈为 /hk 并渲染主体内容`
  10. `lang-path-redirect.test.jsx > 规范路径 /hk 不触发重定向且渲染内容`
  11. `lang-path-redirect.test.jsx > 规范路径 /vn 不触发重定向且渲染内容`
  12. `lang-path-redirect.test.jsx > 规范路径 /vn/reward 不触发重定向且渲染内容`
  13. `lang-path-redirect.test.jsx > 重定向时保留 query 与 hash`
  14. `lang-path-redirect.test.jsx > 中文无前缀子路径渲染（P0） > /vn/reward 渲染 /vn/reward 对应的页面内容`
  15. `lang-path-redirect.test.jsx > 中文无前缀子路径渲染（P0） > /en/reward 渲染 /en/reward 对应的页面内容`
  16. `lang-path-redirect.test.jsx > 中文无前缀子路径渲染（P0） > /en/task 渲染 /en/task 对应的页面内容`
  17. `lang-path-redirect.test.jsx > 中文无前缀子路径渲染（P0） > /hk/shard 渲染 /hk/shard 对应的页面内容`

### 6.2 变异 B —— 改坏 `canonicalLangPath`（关掉本提交新增的重复斜杠折叠）

把 `const collapsed = collapseSlashes(pathname)` 改为 `const collapsed = pathname`。

- 结果：`Tests 3 failed | 58 passed (61)`、`EXIT=1` ⇒ **变红**（输出 `vitest-negB.txt`）。
- 3 条变红逐条（**恰好就是本提交新增的折叠判据**）：
  1. `lang-path.test.js > canonicalLangPath > 折叠重复斜杠（中段多余斜杠也要自愈，否则规范化后与自身相等而不触发重定向）`
  2. `lang-path-redirect.test.jsx > 把 /vn//reward 自愈为 /vn/reward 并渲染主体内容`
  3. `lang-path-redirect.test.jsx > 把 //hk 自愈为 /hk 并渲染主体内容`

### 6.3 逐字节恢复自证

| 项 | 证据 |
|---|---|
| 恢复后 sha256 == 改前 sha256 | 两轮恢复后均为 `d48b70c321f3828a6cc8f992e9b96a752e385823a70c8152056dca0897857b31` = 备份 = 记录值 ✅ |
| `cmp` 原件 vs 备份 | `CMP_IDENTICAL`（两轮）✅ |
| 变异残留 | `grep -c "NEGATIVE-CONTROL"` ⇒ **0**（两轮）✅ |
| 恢复后回归 | `vitest-final.txt` ⇒ `Test Files 9 passed (9)` / `Tests 61 passed (61)` / **`EXIT=0`**（回到绿）✅ |
| 主工作区未被波及 | `git diff -- frontend` **空**；`git status --porcelain -- frontend` **空**；主工作区 `frontend/src/utils.js` sha256 仍 = `d48b70c3…` ✅ |

> 说明：固定副本位于仓库外的 scratch 目录，非 git 工作树，故「`git diff -- <文件>` 空」这条自证施加于**主工作区** `frontend/src/utils.js`（证明未污染主工作区）；固定副本内部以 **sha256 相等 + `cmp` 逐字节** 自证。

---

## 7. 结论与未验证清单

**可否验收**：**有条件可验收**

**理由（指到 §3–§6 读数）**：本提交要修的核心缺陷（「拆显式语言壳、修中文子页被可选语言段吞掉」）在盘上读数中**已确证修好** —— §3（`bugfix-live-out.raw`，`EXIT=0`）给出 `/vn/reward`、`/en/task`、`/hk/shard` 三例的 URL 规范化 + `htmlLang=zh-CN` + zh 标题 + 正文非首页**四项同步一致**（`/hk/shard` 且取到子页本体；同次运行的反向 6 例与 Footer 语言链 checks 全 true）；§4.1 四语根路径逐字全等（含全角 `｜`）、§4.2 脏前缀自愈 7/7（其中 `/vn/reward` 完整渲染出 `奖励中心` 本体）、§4.3 无前缀路由 5/5 零误伤；§5 固定副本单测 `Test Files 9 passed / Tests 61 passed` 且失败集合与同源基线**逐条相同（均 ∅）**；§6 判负两轮（改坏 `getLanguageFromUrl` / `canonicalLangPath`）分别变红 17 例与 3 例、`EXIT=1`，随后 sha256 + `cmp` 逐字节恢复、`NEGATIVE-CONTROL` 残留 0、回归回绿（`EXIT=0`）、主工作区未受波及。**唯一未闭合**的是 `/en/task`（及 P1 路径下的 `/vn/reward`）的**子页终态正文 marker**：因他方后端 `/api/prize/all` 返回 **500**（他方会话在制，见 §2 与 §3 末段）而停在 `正在加载…`，**不属本提交缺陷**，也不改变上述前端逻辑判据。故给「**有条件可验收**」，条件即下列第 ①②③ 条。

**未验证清单**：

- ① **`/en/task` 的子页终态正文 marker `任务中心` 未取到（如实登记，不得写作已验）**。盘上四份读数（`bugfix-live-out.raw` / `l4a-out.raw` / `l4b-out.raw` / `l4c-out.raw`）中，`任务中心` **仅**出现在 `expected.marker`（期望值）字段，**从未**出现在任何 observed 正文；P1 该用例实测正文为 `正在加载任务...`。
- ② **`/vn/reward` 的终态 marker `奖励中心` 只在 P2 自愈段取到，P1 判据路径下未取到**：`l4b-out.raw` 三例 `main_head` = `奖励中心用积分兑换精彩礼品和特权…`（完整渲染）；而 `bugfix-live-out.raw` 的 P1「切中文后 `/vn/reward`」用例正文为 `正在加载奖励...` ⇒ **间歇性**（§4.2 亦已注明该 500 是间歇的）。故「切中文后 `/vn/reward` 落到奖励页本体」这一终态断言**未在 P1 判据路径下取到**。
- ③ **缺失成因属他方在制，非本提交缺陷**：`/api/prize/all` 返回 **500**（`bugfix-live-out.raw` 内 `http://localhost:5787/api/prize/all` 与 `Error loading rewards: Error: Failed to load prizes` @ `RewardPage.jsx`；同类 `Failed to load tasks` @ `HomePage.jsx` 见于 `l4c-out.raw`）⇒ 他方后端会话在制，本报告不计为缺陷（与 §2 遮挡夹具同性质）。故「500 在制期间无法取到 reward/task 终态正文」这一**不可达性**本身留作未验证，留待后端恢复后可选补验。
- ④ **「四者一致」的正文项只在 1/3 判据用例上取到子页本体**：`/hk/shard` 取到本体（`碎片市场…`），`/vn/reward`、`/en/task` 仅取到「非首页 + 子页专属加载文案」（`body_is_target_subpage=false`）。盘上证据**不支持**「三例正文均落到子页本体」的完整断言，只能支撑 §3 注 * 的**部分成立**（非首页）；更强的正文断言未验证。
- ⑤ **核验对象 ≠ 当前 HEAD 整体**：本单结论只覆盖 **frontend 的 `dbccd89` 版**（依据 §0：`git diff dbccd89..HEAD -- frontend` 空 ⇒ 与 HEAD 逐字节相同）。当前 HEAD `37c368d` 的 **backend-ts / docs / 构建产物** 未经本单核验；「前端可放行」**不等于**「HEAD 整体可发布」。
- ⑥ **未验产物形态**：全程只读 dev server（`http://localhost:5787`，面板托管、本单未新起 vite）与副本内单测；**`vite build` / dist / 生产路径 / 真实非 headless 浏览器** 均未验。
- ⑦ **未做负控的改动点**：判负自证（§6）只变异 `utils.js` 的 `getLanguageFromUrl` 与 `canonicalLangPath` 两处；本提交另两个改动文件 **`App.jsx`、`Footer.jsx` 的壳层组装逻辑未做变异负控**，其行为仅由正向读数与单测间接覆盖。
- ⑧ **判据覆盖边界**：P1 只逐例验了 `/vn/reward`、`/en/task`、`/hk/shard` 三例 + 反向 6 例；**其余带前缀子页组合**（如 `/hk/reward`、`/en/shard`、`/vn/task`）切中文后的四者一致**未逐例验**。
- ⑨ **单测基线的比对域有限**：§5 的「失败集合逐条相同」只与**同源基线**（主工作区 `frontend` 的 9 文件 61 例）比对；**未**与其他分支/历史提交基线比对，故「本提交未引入回归」只在同源口径下成立。
- ⑩ **防卡口径下的证据边界**：本机无 `timeout`/`gtimeout`（§2），探针防卡靠「约 3 分钟无输出则按精确 PID 结束该 driver + 最多重试 1 次 + 如实登记」；**超出该窗口的慢路径/静默挂起用例可能未被捕获**，本节读数是在该防卡口径下取得的全部证据。
