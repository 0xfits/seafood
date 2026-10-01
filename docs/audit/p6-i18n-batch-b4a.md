# P6-I18N-LIT-B4a · 后台管理面前半（~150 条四语化）交付报告

- **单号**：I18N-LIT-B4a（Kong）｜**范围**：recon 表④ **B4** 的**前半**，按「后台管理里用户最先打开的面」排序取到 ~150 条即停手
- **总真源**：`docs/audit/p6-i18n-literal-recon.md` 表④/§4.B4（652 条分 5 批；B4 共 **333** 条，本批切半）
- **前序**：B1 44 条（`4e8651d`）｜B2 135 条（`ccb5f10`）｜B3 55 条（已交）⇒ 本批起点 = 四语 `top=89 / flat=362`、单测 142 passed
- **本批终点**：四语 `top=95 / flat=506`（+6 命名空间 / **+144 键 × 4 语**）、单测 **147 passed / 17 files**、写集用户可见面 CJK = **0**

## §1 AC 读数（全部自跑，退出码不取自管道之后）

| # | 断言 | 命令 | 退出码 | 读数 |
|---|---|---|---|---|
| ① | build 通过（0） | `npm run build` | **0** | `✓ built in 1.59s`（仅既有 chunk>500kB 提示） |
| ② | 单测 ≥ 142 | `npm run test:unit` | **0** | **17 files / 147 passed**（新增 5 例，含 en 档后台页面渲染英文） |
| ③ | 四语键集相等 | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | `zh/en/hk/vn: top=95 flat=506`；键集相等 **PASS**；**总判 PASS** |
| ④ | 写集用户可见面 CJK = 0 | `node scripts/p4z-i18nb4a-cjk.mjs` | **0** | 写集 4 文件 **命中 = 0**；注释内保留中文行 = 21（登记，不计命中）；**总判 PASS** |
| ⑤ | 条数对账三列 | 见 §5 | — | 已处理 **153**（recon 条目级）/ 判定不改 **0** / 漏检补充 **17** |

口径声明（§5.7 ②③）：①「键数」= 顶层键数 + 拍平键路径数；②「CJK 命中」= 字符级状态机剥注释后**行级**残留 CJK（U+4E00–9FFF / U+3400–4DBF / U+F900–FAFF，纯标点如「、」「：」「。」不计）；③ recon 条数 = **条目（occurrence）级**，行级读数按行计，两者口径不同（见 §5）。

## §2 取数规则（本单自行判定，未另给清单）

- 以 recon 表④ **B4 文件清单为序**，按「后台管理里**用户最先打开的面**」重排：**布局骨架 → 总览（Dashboard）→ 任务管理 → 奖品管理** 打住；
- 累计 **153 条**（22+66+21+44），落在「~150 条」预算内 ⇒ 停手，其余交 **B4b** 接力（§4）。
- 说明：admin 面板的**入口面**就是 `AdminLayout`（侧边导航）→ `DashboardPage`（总览 + 待审队列）⇒ 用户打开后台的头两屏即本批；任务/奖品管理是总览「管理入口」卡片的**前两张卡**，故紧随其后。

## §3 ① 本单已处理文件 + 条数（153 条 / 4 文件）

| 文件 | recon 条数 | 本单实测行级命中 | 本次改写键命名空间 | 状态 |
|---|---|---|---|---|
| `frontend/src/components/layout/AdminLayout.jsx` | 22 | 22 行 | `adminNav`(16) + `adminLayout`(5) | ✅ CJK 0 |
| `frontend/src/pages/DashboardPage.jsx` | 66 | 62 行 | `dashPage`(58) + `adminNav`/`adminCommon` 复用 | ✅ CJK 0 |
| `frontend/src/pages/admin/TasksManagement.jsx` | 21 | 21 行 | `adminTasks`(14) + `adminNav`/`adminCommon` 复用 | ✅ CJK 0 |
| `frontend/src/pages/admin/RewardsManagement.jsx` | 44 | 51 行 | `adminRewards`(42) + `adminNav`/`adminCommon` 复用 | ✅ CJK 0 |
| **合计** | **153** | **156 行** | **6 命名空间 / 144 新键** | **写集 CJK = 0** |

**★ 命名空间铁律遵守**：开工前现取 `locales/zh.json` 顶层键（89 个）确认 `home.*`/`task.*`/`reward.*`/`page.*`/`login`/`register`/`auth` 等**已是顶层字符串键** ⇒ 一律**不碰**这些前缀，新键全部落在不冲突的新命名空间：

- `adminNav`（16）后台导航标题 + 描述（`AdminLayout` 与 `DashboardPage` 管理入口卡**共用标题**）
- `adminLayout`（5）管理面板 / 退出登录 / 系统管理 / 管理员 / 在线
- `adminCommon`（9）刷新 / 刷新中... / 加载中... / 关闭 / 暂无描述 / 查看详情 / 登录状态已失效… / `{{value}} 积分` / 未设置
- `dashPage`（58）总览标题·卡片·待审队列·角色·空态·错误聚合
- `adminTasks`（14）任务管理页只读告示 / 模态框 / 表单标签 / 开关态
- `adminRewards`（42）奖品管理页只读告示 / 徽标 / 结算信息格 / 表单标签 / 生命周期态

（`adminCommon.pointsValue` 等 9 个跨页共用键，供 B4b 直接复用，避免同文案多键漂移。）

## §4 ② 剩余文件清单 + 估计条数（供 B4b 接力）

排序仍按「用户最先打开的面」：**权限/角色面 → 用户面 → 积分面 → 碎片面 → 系统设置**（总览的「管理入口」卡序为 任务→奖品→用户→权限→积分→系统设置；任务/奖品已在本批完成，故剩余从**用户/权限**起）。

| 文件 | recon 条数 | 本单只读实测行级命中（`p4z-i18nb4a-cjk.mjs` §②） | 注释保留中文行 | 估计工作量 |
|---|---|---|---|---|
| `frontend/src/pages/admin/PermissionsManagement.jsx` | 41 | 35 行 | 5 | 大（权限组/角色/审核权限，含 `manage_*` 行为文案） |
| `frontend/src/pages/admin/PointsManagement.jsx` | 47 | 41 行 | 0 | 大（积分调整 + 弹窗 + 列表） |
| `frontend/src/pages/admin/ShardsManagement.jsx` | 24 | 26 行 | 0 | 中（碎片持仓/挂单/成交） |
| `frontend/src/pages/admin/SystemSettings.jsx` | 29 | 30 行 | 14 | 中（站点/注册/积分规则表单，注释多） |
| `frontend/src/pages/admin/UsersManagement.jsx` | 39 | 33 行 | 3 | 大（用户列表/权限状态/搜索） |
| **剩余合计** | **180** | **165 行** | **22** | 建议再切 **B4b（~120 条：用户+权限+积分）** 与 **B4c（~60 条：碎片+系统设置）** |

> 建议给 B4b 的现成抓手：`adminCommon`（刷新/加载/关闭/暂无描述/查看详情/失效登录/`{{value}} 积分`）与 `adminNav`（导航标题）**已就位可直接复用**；B4b 只需新增 `adminPermissions` / `adminPoints` / `adminUsers` 三个命名空间。

## §5 ⑤ 条数对账三列（333 = 已处理 + 剩余）

| 列 | 读数 | 说明 |
|---|---|---|
| **已处理** | **153** 条（4 文件，recon 条目级；行级 156 行） | 全部改写为 `t()`；写集用户可见面 CJK = 0（类级断言实测） |
| **判定不改（含理由）** | **0** 条 | 本批 4 文件**无** recon 表③(c)「非产品面/品牌文案/开发预览」类条目（那批在 B5 与首页脚注）；仅**注释内的中文**按 §5.7 登记不改（AdminLayout 7 行 / Tasks 8 行 / Rewards 6 行 = 21 行），注释不属用户可见面 |
| **漏检补充** | **17** 条（recon 未列出、本单行级复核新增，**已全部改写**） | 逐条列于下 |

**漏检补充逐条（recon §7 自曝「自建启发式解析器、多行 JSX 文本/含 `{}` 插值的文本会漏计 ⇒ 会有漏检」——本单实测确认并补齐）**：

| 文件 | recon 未列出的行 | 内容 | 条数 |
|---|---|---|---|
| `AdminLayout.jsx` | — | 无 | 0 |
| `DashboardPage.jsx` | L421 | 「如需处理提交审核，请让管理员把你加入具备 `review_tasks` 的权限组。」（多行 JSX 文本） | 1 |
| | L427 | 「当前显示 … 条，匹配 … 条，待审核总数 …。仅展示普通用户提交的 Task Progress。」（`{}` 插值混排） | 1 |
| | L454 | `{points} 积分`（插值 + 文本混排） | 1 |
| | L467 | `提交时间: {…}`（插值 + 文本混排） | 1 |
| | L543 | `进入{item.title}`（插值 + 文本混排） | 1 |
| `TasksManagement.jsx` | L114–115 | 只读告示（多行 JSX 文本，1 条跨 2 行） | 1 |
| | L139 | `{task.points} 积分` | 1 |
| | L144 | `更新时间: {…}` | 1 |
| `RewardsManagement.jsx` | L204–205 | 只读告示（多行 JSX 文本，1 条跨 2 行） | 1 |
| | L229 | `{reward.points} 积分` | 1 |
| | L230 / L231 / L232 / L233 / L235 | `总量: {…}` / `库存: {…}` / `已兑换: {…}` / `当前碎片: {…}` / `保底价: {…} J/片` | 5 |
| | L244 | `免费碎片: {…}%` | 1 |
| | L381 | `免费碎片比例 (%)`（表单 label） | 1 |
| **合计** | 14 行 | | **17** |

**另有 recon 行号漂移（非漏检，只作登记）**：`DashboardPage` 6 条、`TasksManagement` 2 条、`RewardsManagement` 3 条 —— recon 记的行号比实际**少 1**（例：recon `L294` ↔ 实际 `L295`）；同文件 recon 条目数 > 去重行数（如 Tasks 21 条 / 17 行、Rewards 44 条 / 41 行）属「一行多条目」的正常口径差。**行号漂移的逐条溯源未做 → NOT_MEASURED**。

**总计对账**：`333（B4 总）= 153（B4a 已处理）+ 180（B4b 剩余）` ⇒ **平**。若按「recon 条目 + 本单漏检补充」计，B4a 实际改写面为 **170 条**（153 + 17），B4 的真实规模 ≥ 350 条（recon 对 B4b 5 文件亦可能同样低估，B4b 请以 `p4z-i18nb4a-cjk.mjs` §② 的 **165 行**做基线而非 180）。

## §6 改动清单（硬边界内）

| 文件 | 改动 |
|---|---|
| `frontend/src/components/layout/AdminLayout.jsx` | 接 `useTranslation`；8 条导航 + 面板名/角色/在线/退出登录 走 `t()`；**`useMemo` deps `[access]` → `[access, t]`**（见下「行为说明」） |
| `frontend/src/pages/DashboardPage.jsx` | 接 `useTranslation`；总览标题/统计卡/待审队列/角色徽标/空态/错误聚合/`toast`/`window.confirm`/`aria-label` 走 `t()`；`formatTimestamp(value)` → `formatTimestamp(value, t)`（**纯展示**，调用点 1 处） |
| `frontend/src/pages/admin/TasksManagement.jsx` | 接 `useTranslation`；只读告示/刷新/列表徽标/模态框标题与表单标签 走 `t()`；`formatDateTime(value)` → `formatDateTime(value, t)` |
| `frontend/src/pages/admin/RewardsManagement.jsx` | 接 `useTranslation`；只读告示/徽标（总量·库存·已兑换·当前碎片·保底价·生命周期·免费碎片）/结算信息格 8 项/表单标签 10 项/校验与删除确认 `toast` 走 `t()` |
| `frontend/src/locales/{zh,en,hk,vn}.json` | 追加 6 命名空间 × 每文件 **+144 键**（`top 89→95`、`flat 362→506`，四文件逐键相等） |
| `frontend/src/test/unit/i18n-batch-b4a.test.jsx` | **新增**：en 档渲染英文 3 例（AdminLayout / TasksManagement / RewardsManagement）+ 键集 144 键四语齐备 2 例 |
| `frontend/src/test/unit/dashboard-page.test.jsx` | **1 行级改动**：补 `import '../../i18n'`（该页已接 `t()`，测试须挂真实 i18n 实例；jsdom 路径 `/` ⇒ zh 档，既有中文断言逐字不变） |
| `frontend/scripts/p4z-i18nb4a-cjk.mjs` | **新增**：写集类级 CJK 断言 + B4b 剩余面只读读数 |

**未改动/未触碰**（硬边界自查，`git status --short` 实测）：

- 只有上述 8 个 M + 2 个 ?? 条目；**未碰** `pages/{jobs,listings,market}/**`、B1/B2/B3/B5 已验收文件、`components/i18n/TranslatingBadge.jsx`、`i18n-content.js`、`backend-ts/**`、`migrations/**`、`vercel.json`、spec、`docs/seafood.master-plan.md`、`.env*`、既有 audit 件；
- **未执行** `git add/commit/push`、`npm install`、起停服务、`vercel`、`pkill`/`killall`（未使用任何 kill 类命令）。

## §7 行为说明（安全红线：只改文案，不动权限/行为）

1. **权限面零改动**：`hasAdminPermission` / `allowedTabs` / 路由守卫 / 条件渲染分支**一行未动**；`adminNav.*` 只替换导航的**标题与描述串**，`requiredPermission` 原值原样保留（8 条逐条对拍，见 §3 键表）。
2. **写口零新增**：三页均**未新增任何 fetch/写调用**；`TasksManagement`/`RewardsManagement` 的「只读化」（`POST /api/admin/{task,prize}/*` 已 410）语义与按钮可见性**未变**。
3. **`toast`/`confirm` 语义未变**：只把中文字面量换成 `t()`，文案含义逐字对应（zh 词典取值与原文一致，见测试用例「zh 词典取值与改写前原文逐字一致」）。
4. **一处渲染正确性修正（必要且最小）**：`AdminLayout` 的 `visibleMenuItems = useMemo(..., [access])` 会把**旧语言的菜单标题缓存下来**（切语言不重算 ⇒ 后台导航残留中文）。改为 `[access, t]` 后切语言即重算。**不涉权限判定**（过滤条件仍用 `hasAdminPermission(access, requiredPermission)`）。
5. **纯展示函数的形参扩展**：`formatTimestamp` / `formatDateTime` 由「无参闭包」改为显式接 `t`（模块级函数拿不到 Hook 的 `t`），调用点各 1 处、均为展示层；返回值除「未知/未设置」文案外**不变**。

## §8 新增键清单（6 命名空间 / 144 键 × 4 语）

| 命名空间 | 键数 | 组 |
|---|---|---|
| `adminNav` | 16 | 8 标题 + 8 描述 |
| `adminLayout` | 5 | `panelTitle` `logout` `systemAdmin` `adminRole` `online` |
| `adminCommon` | 9 | `refresh` `refreshing` `loading` `close` `noDescription` `viewDetail` `sessionExpired` `pointsValue` `notSet` |
| `dashPage` | 58 | 标题·副标题·统计卡 6·错误聚合 6·待审队列（标题/搜索/汇总/收起/展开/卡片 5 字段/按钮 4/空态 4）·权限态 4·管理入口（入口名 + `进入{{title}}` + 6 描述）·`toast`/`confirm` 8 |
| `adminTasks` | 14 | 只读告示·加载失败·更新时间·模态框 3·表单 5·任务开启·开启/关闭 |
| `adminRewards` | 42 | 只读告示·`toast` 4·校验 2·删除确认·兜底名·徽标 7·生命周期 3·模态框 3·表单 10·保底价提示 3·结算格 8 |

四语质量口径：**en/vn 无 CJK 表意文字**（单测逐键断言）；**hk 为繁体**（抽查 `儀表板` / `系統管理` / `已過期`）；zh 为源语言、取值与改写前原文逐字一致（既有 zh 断言/基线不受影响）。翻译为**初稿**，未做母语者回译（见 §10）。

## §9 复现命令（只读）

```bash
cd frontend
npm run build                              # 期望 exit 0
npm run test:unit                          # 期望 17 files / 147 passed
node scripts/p6-tr2-i18n-locales.mjs       # 期望 总判 PASS（top=95 flat=506 四语相等）
node scripts/p4z-i18nb4a-cjk.mjs --list     # 期望 总判 PASS（写集命中 0）；§② 给 B4b 基线 165 行
```

改写执行器（一次性、带「命中次数 == 预期」硬断言，失败即不写盘）落在 scratch：`~/.hermes/profiles/zang/cache/scratch/b4a-transform.mjs`（`--dry` 可空跑；本轮 `136 条替换 / 失败 0 条`）。

## §10 NOT_MEASURED（禁填 0/空）

- **运行时四语渲染未全测**：仅**3 个后台页在 en 档**经 jsdom 真渲染验收（AdminLayout / TasksManagement / RewardsManagement）+ 既有 `DashboardPage` zh 档 3 例；**hk / vn 档运行时渲染未测**（仅键值静态齐备断言）。
- **真浏览器未测**：未起服务、未跑 e2e；「切语言后后台面全部变字」只有单测级证据，**未做浏览器实测**。
- **recon 行号漂移未逐条溯源**（14 处，见 §5）：判定为 recon 解析器记账偏移，**未核对原始 run_tag 中间产物**。
- **B4b 剩余条数为静态行级读数**（165 行 / recon 180 条），**未逐条人工复核**是否与 B4b 实际改写面一致。
- **翻译质量未评测**：144 键 × 4 语为**初稿**，未回译核验、未过术语表；`hk` 用词（如「重新整理」「檢視」）未与站内既有 hk 文案全量对齐核验。
- **`dashPage.queueSummary` 的插值改写未在 hk/vn 档实测**：i18next `{{}}` 与本页变量名一致（`visible/matched/total`），**仅静态可读，未运行断言四语都正确替换**。
- **`.jsx` 之外的中文未测**：`index.html`、CSS `content:`、`public/**` 不在本单范围（同 recon §6）。
- **发布面未测**：未做 `vercel` 部署/预览核验（本单硬边界禁止）。

## §11 自曝（可能的错判）

1. **`adminNav.*` 描述按「文件自洽」而非全局共用**：`AdminLayout` 的导航描述（如「创建和管理任务」）与 `DashboardPage` 管理入口描述（「查看任务列表、维护任务状态和任务配置。」）**语义不同、故各自成键**；6 个**标题**（任务/奖品/用户/权限/积分/系统设置管理）在 `adminNav` 内**共用**。若产品要求标题也可按页文案分叉，B4b 需拆键。
2. **只读告示里的 `§5.1`/`` `410` `` 等工程口径原样进了用户可见文案**（zh/en/hk/vn 皆是）。这是**沿用原文**（原文已如此展示），我未删改；若产品认为不该给终端用户看，需单独派单改文案（属内容决策，非本单技术判断）。
3. **`dashPage` 的 4 条错误聚合标签**（用户统计/任务统计/奖励统计/待审核数量/待审核列表）被我**保留为同一句拼接**（`errors.join('、')`），只把每项换成 `t()`。分隔符「、」是 CJK 标点（不计入 CJK 断言），**en 档会呈现 "…: User statistics、Task statistics"** —— 标点未本地化，是**已知取舍**（改分隔符需动拼接逻辑，超本单最小改动口径）。**建议 B4b 顺手收口**。
4. **`adminCommon` 的跨页共用是我对 B4b 的接口约定**：若 B4b 各页对「刷新」「查看详情」有不同语域诉求，需拆分；本单按现状统一。
5. **行级 vs 条目级两套口径**：本报告同时给出两套读数（§3/§5），**不得混用**；AC ④ 的类级断言以**行级**为准。
6. 本单**未改任何权限/行为逻辑**（§7），但确实改了 `AdminLayout` 的 `useMemo` deps（§7-4）——这是本批唯一超出「纯文案」的改动，**已单列**，若 Zang 认为越界可回退该行（回退后切语言时侧栏标题会残留旧语）。

---

_报告生成：Unit I18N-LIT-B4a（Kong）。改写执行器 `b4a-transform.mjs`（136 条替换 / 失败 0）→ 验收脚本 `scripts/p4z-i18nb4a-cjk.mjs` + `scripts/p6-tr2-i18n-locales.mjs` + `src/test/unit/i18n-batch-b4a.test.jsx`（均可复跑对账）。_
