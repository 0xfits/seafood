# P6-I18N-LIT-B4b · 后台剩余 5 面四语化 + 两项必做收口

- **工单**：Unit I18N-LIT-B4b（后台管理剩余 ~165 行）+ 必做①（CJK 标点硬编码）＋ 必做②（工程口径不得进用户可见文案）
- **真源**：`docs/audit/p6-i18n-literal-recon.md`（本单只读引用，未改）
- **口径纪律**：§5.7 ① 退出码不经管道；② 先骸架后回填、逐段落盘；③ 报数带口径；④ `NOT_MEASURED` 不填 0；⑤ 预算内收口
- **未动**：`git add/commit/push` 全程未执行（禁写项）；未启停服务、未 `pkill`、未读 `.env*`

---

## 0. 一句话结论

后台管理面（1 个外壳 + 8 个 nav 页）**已全部四语化处理完**；两项必做均已落地并有类级断言兜底；
`build = 0` / `单测 158 passed（18 文件）` / 四语键集相等 `PASS` / 类级 CJK 与工程口径断言 `= 0`。

---

## 1. 交付物（写集）

### 1.1 代码（`frontend/src/**`，仅 B4b 范围 + 必做① 落点）

| 文件 | 处理前 CJK 行 | 处理后 | 说明 |
|---|---|---|---|
| `pages/admin/PermissionsManagement.jsx` | 35 | 0 | +`useTranslation` |
| `pages/admin/PointsManagement.jsx` | 41 | 0 | `formatDateTime(value, t)` |
| `pages/admin/ShardsManagement.jsx` | 26 | 0 | +`useTranslation` |
| `pages/admin/SystemSettings.jsx` | 30 | 0 | 默认站点描述改为 `t()` 求值 |
| `pages/admin/UsersManagement.jsx` | 33 | 0 | `formatDateTime(value, t)` |
| **合计** | **165** | **0** | 与基线读数逐文件一致 |
| `pages/DashboardPage.jsx` | — | — | **必做①**：`errors.join('、')` ⇒ `errors.join(t('common.listSeparator'))` |

### 1.2 四语 locale（四文件同步，`frontend/src/locales/{zh,hk,en,vn}.json`）

- **新增命名空间 5 个**（命名空间铁律：先取 `locales/zh.json` 顶层键确认无冲突后再新建）
  `adminPermissions` 29 / `adminPoints` 27 / `adminShards` 19 / `adminSettings` 25 / `adminUsers` 17 = **117 键**
- **既有命名空间扩容**：`adminCommon` 9 ⇒ **28**（+19：`notLoggedIn` / `noAdminAccess` / `normalUser` / `adminRole` /
  `colUserId` / `colWallet` / `colPoints` / `colUpdated` / `colRole` / `colActions` / `colRegistered` /
  `colLastLogin` / `colBio` / `noMatchingUsers` / `saving` / `readOnlyNotice` / `statUsers` / `statTotalPoints` / `refreshData`）
- **`common.listSeparator`**（必做①）：zh/hk `、`；en/vn `, `
- **本批新增键合计 137**；顶层键 95 ⇒ **100**，拍平键 506 ⇒ **643**

### 1.3 断言脚本（新建，只读/可重复运行）

| 脚本 | 作用 |
|---|---|
| `frontend/scripts/p4z-i18nb4b-apply.mjs` | 172 段锚点替换执行器（逐段命中数断言，不符即退出；`--dry` 只校验） |
| `frontend/scripts/p4z-i18nb4b-locales.mjs` | 四语 locale 增量写入 + **幂等**（新命名空间逐键比对、垃圾键自清、写完自检键集相等） |
| `frontend/scripts/p4z-i18nb4b-cjk.mjs` | **类级断言**：① 写集 CJK 字面量 `== 0`；② 写集「用户可见文案面」工程口径 `== 0`；并入 AC④ |

### 1.4 单测

- **新增** `frontend/src/test/unit/i18n-batch-b4b.test.jsx` → **11 例**（en 档渲染 5 面 / 分隔符 locale-aware 2 例 / 键集与脚本退出码 4 例）
- **修正** `frontend/src/test/unit/i18n-batch-b4a.test.jsx` → B4a 的 locale 计数期望随本批扩容更新
  （`top 95⇒100`、`flat 506⇒643`、`adminCommon 9⇒28`）；**B4a 历史锚点 144 保留**并改为
  `NEW_KEY_TOTAL === B4A_ADDED(144) + B4B_ADDED_TO_ADMINCOMMON(19)`，避免「顺手改大期望值」掩盖键名事故。

---

## 2. 必做① · CJK 标点硬编码 ⇒ locale-aware 分隔符

- 全量扫描（`join(` / `—` / `·` / ` / ` / `；`）本批 6 个文件，**代码级 CJK 标点拼接仅 1 处**：
  `DashboardPage.jsx:140` 的 `errors.join('、')` ⇒ 改为 `t('common.listSeparator')`。
- 新增 `common.listSeparator` 四语键，**四语取值随语言变化**（单测双向断言：`用户统计、任务统计` vs `用户统计, 任务统计`）。
- 回归守卫：单测断言 DashboardPage **源码内不得出现** `join('、')`，且正则
  `/\.join\(['"][^'"]*[\u3000-\u303F\uFF00-\uFFEF]/` 命中 `= false`（即不得再用裸 CJK/全角标点当分隔符）。
- **登记保留（非 CJK 标点 / 非展示分隔符，判定理由）**：
  - `ShardsManagement.jsx` 的 `{b.symbol} — {b.name}`：`—` = U+2014（em dash），**不属 CJK 标点区**
    （U+3000–303F / U+FF00–FFEF），且语义为「符号—名称」配对而非列表拼接 ⇒ 保留。
    同文件 `'—'` 为日期/数量兜底占位符，同上。
  - `PermissionsManagement.jsx:89` 的 `(group.permissions || []).join(', ')`：是**权限输入框的数据序列化格式**
    （与 `permissionsPlaceholder` 的「逗号分隔」一致），非用户可见拼接 ⇒ 保留。

## 3. 必做② · 工程口径不得进用户可见文案

### 3.1 逐条改写（本批）

| 位置 | 改写前（原文） | 改写后 |
|---|---|---|
| `SystemSettings` 页头说明 | 「…（保存按 **§2.4 S1/DL36** 带 `ops:` 幂等键）；「重置为默认值」入口已下线（**§5.1** = **`410`**）。」 | 「当前页面读取并保存站点设置；「重置为默认值」入口已下线，逐项修改后保存即可。」（`adminSettings.intro`） |
| `ShardsManagement` 持仓面板 | 「用户个人持仓可通过 **`/api/shard`** 查询（需认证）。暂无管理员聚合接口，各用户持仓请通过奖品维度订单簿和成交记录推断。」 | 「用户个人持仓需由本人登录后在自己的账户页面查看；此处按奖品维度展示流通情况，可结合订单簿与成交记录了解各奖品的碎片分布。」（`adminShards.holdingsNote`） |

### 3.2 ★ 越界说明（本单唯一一处写集外改动，逐条列明）

`adminTasks.readOnlyNotice` / `adminRewards.readOnlyNotice`（**B4a 已交付键**，四语）原文把
`` `POST /api/admin/task/*` = `410`，§5.1「后台发布招工」行 `` / `` `POST /api/admin/prize/*` = `410`，§5.1 … ``
原文展示给终端用户 —— 与必做② 是同一类缺陷。**处置**：
- 改写为「当前账号为只读模式：管理员端的招工/商品发布、编辑与删除入口已下线。」（四语逐条重译，非照抄）
- **理由**：① 硬边界允许写 `frontend/src/locales/*.json`（四文件同步）；② 纯文案改动，**未触碰任何权限/行为逻辑**；
  ③ 若不改，「后台面已全部处理完 + 必做② 归零」的声明即为不成立。
- 已加**回归守卫单测**（`i18n-batch-b4b.test.jsx`：四语 `readOnlyNotice` 对 `§ / 410 / R107 / api/ / sunset` 全不命中，且四语互异）。

### 3.3 类级断言读数（AC④，`p4z-i18nb4b-cjk.mjs`，退出码 0）

```
① 代码写集：CJK 字面量命中 = 0（断言 == 0）
             工程口径(用户可见文案面)命中 = 0（断言 == 0）
             代码位登记 = 16（fetchApiJson('/api/...') 接口调用路径，非文案面）
             注释登记行 = 22（注释内留 §/410/CJK 属允许）
② locale 文案面：en/vn 残留 CJK = 0；四语工程口径残留 = 0
② 登记豁免：4 处 —— en/vn 的 adminSettings.langZh = 中文、langHk = 繁體中文（语言选择器 endonym）
总判：PASS
```

**口径声明（避免把口径当结论）**
- 「工程口径」token = `§` / `410` / `R107` / `api/` / `sunset`，**只对用户可见文案面成立**；
  含 `fetchApiJson(` / `fetch(` / `import ` / `require(` / `from '` 的行判为**代码位**（接口路径本来就必须写），
  其 token 命中只登记、不计入断言。首轮把 16 处 `fetchApiJson('/api/...')` 判成违规即此口径缺失所致，已更正并写入脚本头部注释。
- **注释行允许保留**（本单 22 行），已逐文件登记（Permissions 5 / Points 0 / Shards 0 / Settings 14 / Users 3 / Dashboard 0）。
  ⇒ **未处理项登记**：`SystemSettings.jsx` 注释内仍含 `§2.4 S1/DL36`、`§5.1 = 410`、`details.sunset`、`R107` —— 按工单「注释里允许保留（不计入）」保留。
- 语言选择器 endonym 豁免理由：语言名按母语自书（`中文` / `繁體中文` / `Tiếng Việt`）是选择器惯例，
  四语取值相同；除该 2 键外，5 个新命名空间的 **en/vn 全部取值零 CJK**（单测逐键断言）。

### 3.4 判定保留（不属禁用集，管理员需要的领域标识）

`manage_permissions` / `manage_users` / `manage_points` / `manage_rewards` / `publish_prizes`
仍出现在按钮 `title` 与「权限不足」提示中。**理由**：这些是权限键名（管理员排障的正向信息），
不是 `§`/状态码/接口路径/`sunset` 这类实现细节；若改写会**降低**后台可操作性。已在脚本断言集之外显式登记。

---

## 4. AC 读数（全部自跑，退出码不经管道）

| AC | 命令 | 退出码 | 读数 |
|---|---|---|---|
| ① | `npm run build` | **0** | `✓ built in 1.49s`，`dist/assets/index-BEjaFV7x.js 551.52 kB` |
| ② | `npm run test:unit` | **0** | `Test Files 18 passed (18)` / `Tests 158 passed (158)`（≥147，本批 +11 例） |
| ③ | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | 四语 `top=100 flat=643`（取值集合 `{643}`）；`键集相等：PASS`；`总判：PASS` |
| ④ | `node scripts/p4z-i18nb4b-cjk.mjs` | **0** | 见 §3.3：代码 CJK 0 / 代码工程口径 0 / locale en-vn CJK 0 / locale 工程口径 0 |
| ⑤ | 对账（下节） | — | `333 = 153 + 180` 闭合；未处理项逐条列明 |

**新增单测覆盖（AC② 要求的三项）**
1. **en 档渲染英文**：5 个面各 1 例，逐条断言英文串 + **反证简体原文不出现**（如 `queryByText('碎片管理') === null`）；
2. **分隔符 locale-aware**：四语取值断言 + `join(t('common.listSeparator'))` 结果随语言变化 + DashboardPage 源码级反向断言；
3. **类级断言脚本**：`execFileSync` 跑 `p4z-i18nb4b-cjk.mjs` 与 `p6-tr2-i18n-locales.mjs`，**退出码即断言**（测试内可复现 AC③④）。

---

## 5. 总收尾对账（AC⑤）

### 5.1 主对账（recon 口径）

```
333（recon 总真源）= 153（B4a，已入库 28d7b78）+ 180（B4b，recon 表④）     ✅ 闭合
```

### 5.2 本班实测口径（可复现读数，与 recon 口径并列，不替换）

| 口径 | B4b 读数 | 来源 |
|---|---|---|
| **处理前 CJK 行**（剥注释后含表意文字的代码行，一行多字面量记 1） | **165**（35/41/26/30/33） | `node scripts/p4z-i18nb4a-cjk.mjs` ② 段（本单跑前读数，与工单基线一致） |
| **实际替换处数** | **172** 段命中 | `p4z-i18nb4b-apply.mjs`（含 DashboardPage 必做① 1 处） |
| **加：B4a 遗留文案改写** | **+2**（`adminTasks` / `adminRewards` 的 `readOnlyNotice` 四语覆盖） | `p4z-i18nb4b-locales.mjs` LEGACY_FIX |
| 本班改动总数（替换处） | **174** | 172 + 2 |
| 新增/扩容 locale 键 | **137** | 117（新命名空间）+ 19（`adminCommon`）+ 1（`common`） |

**180 vs 165 差额口径**（§5.7 ③ 报数带口径）：recon 表④ 按「字面量点」计
（Permissions 41 / Points 47 / Shards 24 / SystemSettings 29 / Users 39），
本班按「CJK 行」计（35/41/26/30/33）；逐文件差为 **−6 / −6 / +2 / −1 / −6**，
两口径**互非包含关系**（Shards 处 recon 反而更少，因该面有 `Symbol` / `Buy` / `Sell` 等纯 ASCII 文案点未计入 CJK 口径）
⇒ 差额 15 **无法**用「同一行多字面量」单因解释，只能声明为口径差，两类读数各自成立、均已列出。

### 5.3 「后台面已全部处理完」声明

后台管理面共 **9 个面**（1 外壳 + 8 个 nav 页）**已 100% 处理**：

| 面 | 文件 | 批次 | 现状 |
|---|---|---|---|
| 管理外壳（侧栏/顶栏/账号区） | `components/layout/AdminLayout.jsx` | B4a | ✅ CJK 0 |
| 管理总览 | `pages/DashboardPage.jsx` | B4a + **本批必做①** | ✅ CJK 0；分隔符 locale-aware |
| 任务管理 | `pages/admin/TasksManagement.jsx` | B4a + **本批必做②**（`readOnlyNotice`） | ✅ CJK 0；工程口径 0 |
| 奖品管理 | `pages/admin/RewardsManagement.jsx` | B4a + **本批必做②**（`readOnlyNotice`） | ✅ CJK 0；工程口径 0 |
| 碎片管理 | `pages/admin/ShardsManagement.jsx` | **B4b** | ✅ CJK 0；`/api/shard` 文案已改写 |
| 用户管理 | `pages/admin/UsersManagement.jsx` | **B4b** | ✅ CJK 0 |
| 权限管理 | `pages/admin/PermissionsManagement.jsx` | **B4b** | ✅ CJK 0 |
| 积分管理 | `pages/admin/PointsManagement.jsx` | **B4b** | ✅ CJK 0 |
| 系统设置 | `pages/admin/SystemSettings.jsx` | **B4b** | ✅ CJK 0；`§2.4/§5.1/410/ops:` 文案已改写 |

### 5.4 仍未处理项（逐条 + 理由，未用 `NOT_MEASURED` 冒填）

1. **`pages/HomePage.jsx`**：仍处旧三目链 + `??`（`p6-tr2-i18n-locales.mjs` 登记 12 处命中）。
   → **非后台面**，属前台存量收口，不在本批写集；本单只读登记，未改（改写会超出硬边界）。
2. **注释内工程口径 22 行**（含 `§2.4`/`§5.1`/`410`/`R107`/`sunset` 字样）：工单明确「注释里允许保留（不计入）」⇒ 保留并逐文件登记行数。
3. **语言选择器 endonym 4 处**（`adminSettings.langZh` / `langHk` 的 en/vn 取值）：见 §3.3 豁免理由。
4. **`SystemSettings` 默认站点描述**（`DEFAULT_SETTINGS.siteDescription`）：由字面量改为 `t()` 求值
   ⇒ 未改动即保存时，**落库值 = 当前界面语言文案**。这是文案四语化的必然结果，**不涉及权限/行为逻辑**；
   如需「落库恒为某一语」须另立工单（本单不擅自改保存语义）。**登记为已知影响**。
5. **代码位 `/api/...` 16 处**：接口调用路径，非文案面（口径见 §3.3）。

---

## 6. 落地记录（可复现）

```bash
# 1) 替换（逐段断言命中数，172/172 全中）
node scripts/p4z-i18nb4b-apply.mjs            # --dry 为只校验
# 2) 四语 locale 增量（幂等，可重复运行）
node scripts/p4z-i18nb4b-locales.mjs
# 3) AC
npm run build                                  # 0
npm run test:unit                              # 0（18 files / 158 passed）
node scripts/p6-tr2-i18n-locales.mjs           # 0（键集相等 PASS，top=100 flat=643）
node scripts/p4z-i18nb4b-cjk.mjs               # 0（类级断言 PASS）
```

### 6.1 过程中的两次自我纠正（登记，避免同类复发）

1. **`COMMON_SEP` 写成裸字符串** ⇒ `Object.entries(', ')` 展开为 `[['0',','],['1',' ']]`，
   把 `common['0']` / `common['1']` 垃圾键写进四语文件（首轮键集自检即 `FAIL`、`flat=643` 仍成立但因垃圾键不可比）。
   **处置**：① 形状契约断言（`SHARED.<ns>.<lang]` 必须是对象，否则 `exit 2`）；
   ② 脚本加**垃圾键自清**与**新命名空间逐键比对跳过** ⇒ 幂等；③ 重跑后自检 `PASS`。
2. **类级断言脚本只按「行含 token」判定** ⇒ 把 16 处 `fetchApiJson('/api/admin/...')` 误判为文案面违规。
   **处置**：引入「代码位」口径（见 §3.3），并把该口径写进脚本头部注释，而不是放宽断言到不报。
3. **单测首轮 4 红**（均为用例写法问题，非产品缺陷，已写入测试头注释）：
   同一 `<p>` 内多个 `{}` 子节点 ⇒ `getNodeText` 是拼接串，必须用正则；
   `System Settings` 同时是页头与卡片标题 ⇒ 改 `getAllByText`；
   本仓 `Tabs` 不渲染非激活页签内容 ⇒ holdings 面板文案改「locale 取值 + 源码面」断言。
