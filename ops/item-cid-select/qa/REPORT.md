# REPORT · 发布商品页「币种编号」改下拉 · QA（Neng）收尾报告

- **单号**：JING-ITEM-CID-SELECT · 质检角色 Neng
- **受证 commit**：`7b597ec`（商品页实现面）。**本报告只证商品页（`frontend/src/pages/item/`）与后端（`backend-ts/src/`）面；任务页（`jobs.*`）由另一质检员并行判定，不在本报告。**
- **收尾时点**：2026-10-19 09:09 CST；**HEAD = `9087c51`**（本报告起步时亦为 `9087c51`，本轮内未再移动）。
- **HEAD 中途推移核实**：`7b597ec → 1d9b415（任务页实现，他人面）→ 9041097（任务页 QA 读数 + REPORT-job）→ 9087c51（docs）`。已亲验 `git diff 7b597ec..HEAD -- frontend/src/pages/item/ backend-ts/src/` = **空** ⇒ 商品页与后端面与受证 commit 逐字节一致，以下判定不受推移影响。
- **本轮不做**：不重做已完成 AC（AC1–AC6 读数直接引用）、不改产品代码 / docs / 实方 `readings/`、不碰 `qa-job/`（并行质检员新落目录）、**不 commit、不 push**。
- **结论：8 / 8 AC 全 PASS**（`verdict.json` 同目录）。

---

## 一、逐 AC 判定与读数路径

| AC | 判定 | 读数（本盘 `ops/item-cid-select/qa/readings/`） | 关键读数 |
|---|---|---|---|
| AC1 表单形状 | **PASS** | `ac1-ac2-ac4-browser-probe.json` | `select[data-sf-m="item-select-cid"]` 在场；`item-input-cid` 全树 **0**；cid 控件 tag=SELECT；选项 11；负控探针可判负（注入后清空） |
| AC2 选项集==DB listed | **PASS** | `ac2-ac3-validated.json`(ac2) · `ac2-db-currencies.json` · `ac1-ac2-ac4-browser-probe.json` | API 11 == DB listed 11，`set_equal=true` 双向差集空；DB 16 行中 draft 5（cid 9/15/22/27/28）确不在选项集 |
| AC3 HTTP/形状契约 | **PASS** | `ac2-ac3-validated.json`(ac3) · `ac3-curl-w.txt` · `ac3-currencies.body.json` | Authorization 显式置空 ⇒ **200**；行键恰 `cid,name,symbol`（逐行，键数恒 3）；cids 升序 1→399；仅 listed |
| AC4 提交语义不变 | **PASS** | `ac4-submit-static.json` · `ac1-ac2-ac4-browser-probe.json` | `publishListing` 函数体与 parent 逐字同；POST 键恰 `[cid,price,stock,title,description,media_urls,create_key]`；调用点 `Number(form.cid)` 未改；POST 探针截获，零业务写 |
| AC5 失败/空回退 | **PASS** | `ac5-fallback-arms.json` | 500 / 网络中断 / 空数组三臂：选项恒 `["1"]`/`["$"]`、无 legacy input、提交不禁用（`submitDisabled=false`）；`all_pass=true`；阳性对照=真后端 11 选项 |
| AC6 i18n | **PASS** | `ac6-i18n.json` | `item.cid`/`item.cidNote` 四语均改值；四语 flat 键数 delta=0、键集相等；`jobs.*` 四语键数 45 不变、变更键 0；变更键恰 `[item.cid, item.cidNote]` |
| AC7 build + test:unit | **PASS** | `ac7-build.log` · **`ac7-test-unit-recheck.log`（本次新采）** · 佐证 实方 `readings/job-build.log` | build **EXIT=0**；`test:unit` 于 09:03 重跑：**Test Files 59 passed (59)、Tests 568 passed (568)、EXIT=0** —— 在**真实 `dist/` 在场**前提下，`p4z-feperf.test.js` 正常载入并通过（其 19 例计入 568） |
| AC8 三页浏览器回归 | **PASS** | **`ac8-browser-pages.json`（本次新采，browser 半边）** · `ac8-home.json` · `ac8-prize-all.json`（API 半边，已存） | 见下节 |

**AC7 补跑说明（本次收尾第 1 项）**：上轮误红根因是**跑法**——把 build 产到 `dist-qa`，导致 `p4z-feperf.test.js` 找不到 `dist/assets/*.css` 而显式抛错（57 通过 + 1 失败 suite、549 例）。本轮先确认 `frontend/dist/` 存在且非空（`assets/index-DnoMyxQu.css` 123,497 B；且现盘 `dist/assets/index-BREoUqs6.js` 与实方 `job-build.log` 的 **BUILD_EXIT=0** 产物同名 ⇒ dist 即 HEAD 源码的构建产物，无陈旧问题），再单跑 `test:unit`（**未与 build 并行**）。结果 59 文件 / 568 例全绿。文件数 58→59、用例数 549→568 的差额 = `1d9b415` 带入的 `publish-job-cid-select.test.jsx`（189 行，任务页面，属他人面）+ `p4z-feperf` 19 例恢复计入。

**AC8 三页回归明细（本次收尾第 2 项，未登录态，Playwright/Chrome for Testing，沉降 3.5 s）**

| 页 | `#root` 子节点数 | pageerror | console error（分类计数） | 终态证据 |
|---|---|---|---|---|
| `/` | 2 | **0** | **0**（各类全零） | 渲染首页真实内容（欢迎语 / 热门任务） |
| `/item/new`（未登录） | 2 | **0** | **0** | 渲染「请先登录」闸，**无重定向**（final URL 不变） |
| `/item/1`（bID=1 由 `GET /api/prize/all` 现取） | 2 | **0** | **0** | 渲染详情真实内容（物品编号 #1 · $137 · p4b2c:listing），非卡加载态 |

API 半边核对：`GET /api/home` `data.prizes` len=8；`GET /api/prize/all` `data` len=25 —— 与 08:59 存档 `ac8-home.json` / `ac8-prize-all.json` **逐一相符**（`crosscheck` 双 true；键集形状：home 信封 `success/message/data`、data 含 `prizes` 数组；prize 行 45 键含 `bID/symbol/points/…`）。

---

## 二、三栏单列

### ① 实现方自报 vs 本方读数差异

- **无实质差异。** 实方（Kong）自报落点在 `SPEC-NOTE.md` §2 对照清单，其中第 9/10/12 行标注「只到代码形状相符，HTTP/DOM 行为实测归 Neng」——本轮前后累计的实测（AC1/AC2/AC4/AC5 浏览器探针、AC3 HTTP、AC6 i18n）**全部与其代码形状自报一致**，未出现自报形状与实测行为相悖的行。
- 实方 `readings/` 中 `job-build.log`（BUILD_EXIT=0）与 `job-test-unit.log`（TEST_EXIT=0）属**任务页面**自测；本方 AC7 独立复跑得到同向结果（59/59、568/568），互不冲突。
- 一处**口径级**注意（非缺陷、非差异）：`GET /api/currencies` 的 `cid` 在 JSON 里是**字符串**（`"cid":"1"`），契约未规定 JSON 类型；前端以 `Number(form.cid)` 收口（AC4 已证）⇒ 提交侧为 number，形状成立。如实方后续契约要求数字字面量，另行立单，不在本单判负范围。

### ② 未证项与原因

1. **`/item/new` 登录态的端到端提交**（真实落库）：AC4 用探针截获 POST、零业务写，这是**有意的口径**（质检不产生业务写）；真实写路径由后端门套与业务验收覆盖，本单未证。
2. **`/item/new` 登录态表单渲染**：AC8 按指令采**未登录态**；登录态形状已由 AC1 的 localStorage 注入探针覆盖（11 选项 + select 形状），本轮未重采，不重复计证。
3. **任务页（`jobs.*`）一切判定**：并行质检员范围（其 `qa-job/`、`REPORT-job.md` 已在落盘过程中出现），本方按指令不碰。
4. **`/item/:id` 的多 id 抽样**：AC8 按指令采 1 个现取 id（bID=1）；25 个 prize 的逐 id 详情页回归未做（不在指令内）。
5. **移动端视口 / 其他 locale 下三页回归**：AC8 固定 1440×900、默认 zh；i18n 文案面由 AC6 四语静态核对覆盖，浏览器四语切换未重采。
6. **push / commit**：按指令显式不做（本目录与 `verdict.json`/`REPORT.md` 均未提交）。

### ③ 环境噪声（不影响判定，如实登记）

1. **并发会话推移 HEAD**：本报告跨度内 HEAD 处于 `9087c51`（起步与收尾一致）；更早一轮内曾由 `7b597ec` 推进到 `1d9b415`。已用 scope diff（=空）兜底，判定只锚定商品页/后端面。
2. **并行质检员的门套运行**：另一质检员在独立 worktree 跑门套；为避免本机争用，本轮 `test:unit` **未与 build 并行**、后台单跑（09:02:59–09:03 约 47 s 完成，无异常时长）。
3. **共享长驻服务**：前端 dev（5787）与后端（5788）为早前会话遗留、本轮复用未重启；AC3/AC8 的 HTTP 读数基于该后端实例。
4. **`qa-job/` 目录中途出现**（并行质检员落盘）：与本方目录隔离，未读取其内容作判定依据。
5. **AC8 探针自身两处脚本修正**（非产品问题）：① about:blank 上相对 fetch 报错 → 先落到同源页再采 API；② 首采 `/item/1` 沉降仅 1.2 s 命中「加载中」中间态 → 沉降加至 3.5 s 并加 `still_loading` 探针复核，终态为真实内容。读数以最终 `ac8-browser-pages.json`（第二次运行产物）为准。
6. **dist provenance**：现盘 `dist/` 由实方 `job-build.log`（BUILD_EXIT=0，含 `1d9b415` 前端源）产出；`p4z-feperf` 只断言 safelist 类在产物 CSS 中的可寻性，本轮通过即为当前源码下的有效结论。
