# P9① 实现第一步 · 站点文案覆盖层 + P9 配置键（后台可配置面）· 实现报告

- **报告路径**：`docs/audit/p9-s1-site-text-overlay.md`
- **角色 / 单号**：Kong（实现方）· P9① 实现第一步 + 极小续跑（报告回填）
- **日期**：2026-10-03（CST）
- **契约真源（已冻结）**：`docs/data-layer.spec.md` **v0.19**（§29 / §30，含 §30.1–§30.8）+ `docs/route-layer.spec.md` **v2.12**（§26 / §27，含 §26.11 / §26.12 / §27.x）
- **裁定（逐字遵守）**：`R-9-13` 载体 = 变体 Ⅰ（`app_config` 键 `role_names` + `site_text_overrides`；Ⅱ / Ⅲ 不采纳）· 读口 = `GET /api/role-names`（无鉴权）⇒ 注册点 `75 → 76` · 四项默认值（`storageDecimals`=4 / `streakDay7RewardBatt`=60 / `siteSlogan` 四语 / `siteTitle` 拆键后）；`R-9-12` 术语 `Vendor`/`Customer`；`R-9-8` 范围更正（四语）+ `R-9-10`（站点标语覆盖层）
- **写面纪律**：一切库面写 = 事务内 + 末尾 `ROLLBACK`；`app_config` 两枚 `BEFORE UPDATE` 触发器 ⇒ 严禁 UPDATE + 还原 ⇒ 新键一律事务内 INSERT（回滚即净）

---

## §0 口径与取证时点

- **本单性质**：P9① 实现第一步 + **极小续跑（只回填本报告）**。**未重跑任何门 / 探针**；**未改一行代码**（仅删两临时探针，见 §9 收尾）；**未 apply 迁移 / 未 `git add/commit/push`**；**未起实例**。
- **读数三类来源（逐类标注，禁混用）**：
  1. **(类 S) 源码现取**：读 `backend-ts/src/{database,index}.ts` / `backend-ts/scripts/p8-s6-site-text-gate.ts` / 四语 locale / 前端页 —— 直接读文件，不执行。
  2. **(类 G) 门产物现取**：`backend-ts/.p8s{1,2,3,3b,4,5,6}-artifacts/*/gate.json`（上一收口单 2026-10-03 01:30–01:34 那一次硬门全量运行的产物）—— 本单**只读产物、不重跑**。
  3. **(类 P) 上一收口单受控实例探针读数**：临时探针 `p9s1-00b-live-probe.ts`（只读 + 无鉴权 HTTP）在受控实例（`127.0.0.1:5796` 一带）上的现取输出 —— 探针**已按本单收尾删除**，读数逐字录入 §4 / §7。
- **时点**：契约冻结面 = `f224aa2`（data v0.19 / route v2.12）；实现落盘 = 工作树未提交态（见 §9 收尾的 `git status --porcelain` 归因）。当前 HEAD = `d7c385e`。

---

## §1 `§29/§30`（data-layer）↔ `§26/§27`（route-layer）逐条对应表

> 口径：data 册 = **键面 / 库面**正文；route 册 = **route / 前端侧**正文。**两册同批给同一组契约**（`§29`↔`§26` 为 v0.18/v2.11 冻结；`§30`↔`§27` 为 v0.19/v2.12 追补落册）。下表按"节号"逐条对位（行号 = 现取 `grep -nE '^#{2,4} *§'` 所得）。

| data-layer（v0.19） | route-layer（v2.12） | 主题 | 现行读法（节号对位） |
|---|---|---|---|
| `§29`（`:2500`）| `§26`（`:6001`）| 批 9 第 1 片（P9①）契约冻结（后台可配置面）| 同批姊妹节；`§29` = 键面 / 库面，`§26` = route / 前端面 |
| `§29.0`（`:2506`）| `§26.0`（`:6007`）| 本节性质（与 §21–§24 / §17–§25 的关系）| 逐条对位 |
| `§29.1`（`:2510`）| `§26.1`（`:6011`）| 现取锚（`文件:行` / 命令）| 逐条对位；两侧锚点集不同（各自册面） |
| `§29.2`（`:2531`）P9 数值项 → 配置键一次列全（白名单 `2 → 9`）| `§26.3`（`:6063`）P9 配置写口契约（复用 · 注册点不动）| **数值键面 ↔ 写口**| `§29.2(B)` 列 `B1`–`B5`（数值）+ `B6`/`B7`（文案）；`§26.3` 承唯一写口 `POST /api/admin/settings`（形态 B）|
| `§29.3`（`:2588`）角色文案覆盖层载体三变体（不择一）| `§26.2`（`:6027`）读写口契约 + 实时生效机制 + 注册点增量 + 前端页数 | **载体 ↔ 读口/生效机制**| `§30.2`/`§27.2` 收口为**变体 Ⅰ** |
| `§29.4`（`:2623`）与 8① `app_config` 机制衔接 | `§26.3`（`:6063`）| **衔接 ↔ 写口复用**| 逐字承 `AV1–AV5` / `ops:` 派生 / reason 三常量 / `DL76` 触发器 |
| `§29.5`（`:2634`）「小数位契约」（存储位数 / 展示口径）| （**无 route 对位节**）| 数据层独有 | `storageDecimals` / `displayDecimals` 为键面；「格式化到整数口径」= 渲染机制（归实现单，`§29.5` 分层注）|
| `§29.6`（`:2647`）真生效判据（②库内落值）| `§26.5`（`:6091`）真生效**四段**判据 | **② 段 ↔ 四段**| 四段 = ①后台写→②库内落值→③业务读口→④行为随之；`§29.6` 只承载 ② |
| `§29.7`（`:2657`）权限键映射（11 键闭集内选）| `§26.4`（`:6076`）权限键映射 | 逐条对位 | 读口 = **无闸（公开读）**；写口 = `manage_settings` |
| `§29.8`（`:2671`）六类禁漏（数据层侧）| `§26.6`（`:6105`）后台页契约 + 四语文案面 + **禁工程口径泄漏六类** | 逐条对位 | 六类同枚举（见 §7）|
| `§29.9`（`:2678`）`NOT_MEASURED`（9 项）| `§26.7`（`:6118`）`NOT_MEASURED` | 逐条对位 | 各自册面未测项 |
| `§29.10`（`:2692`）指纹自证（不内嵌自身 md5）| `§26.9`（`:6146`）指纹自证 | 逐条对位 | 快照 `cmp` = 0 |
| `§29.11`（`:2699`）与既有条文的引用关系 | `§26.10`（`:6153`）同 | 逐条对位 | 旧文一字未动 |
| `§29.12`（`:2712`）★ `R-9-10` 追加登记（角色名 + 站点标语）| `§26.11`（`:6165`）★ `R-9-10` 追加登记 | 追加登记 | `siteTitle` 拆键 + `siteSlogan` 四语 + `index.html` 中性占位（承 §29.12(c)(e) / §26.11⑥）|
| `§29.13`（`:2735`）★ `R-9-8` 范围更正 + `R-9-11` 定案 | `§26.12`（`:6191`）★ `R-9-8` 更正 + `R-9-11` 定案 | 范围更正 | 四角色名 = **四语**（非 `zh`/`vn`）；`vn` = 英文 = 正式口径 |
| （**无 data 对位节**）| `§26.8`（`:6130`）待办登记（`J-1`–`J-11`）| route 独有 | 本报告 §9 门侧兑现 |
| `§30`（`:2753`）| `§27`（`:6209`）| 追补落册（`R-9-12` 术语 + `R-9-13` 三裁）| 同批姊妹节 |
| `§30.0`（`:2758`）| `§27.0`（`:6214`）| 本节性质（与 §29 / §26 的关系）| 逐条对位 |
| `§30.1`（`:2762`）★ `R-9-12` 术语更正 | `§27.1`（`:6218`）同 | 逐字照录 | `Seller`/`Buyer` → **`Vendor`/`Customer`** |
| `§30.2`（`:2790`）★ `R-9-13` 三项裁定 | `§27.2`（`:6247`）同 | 逐字照录 | 载体 Ⅰ / 读口注册点 `75→76` / 四项默认值 |
| `§30.3`（`:2810`）★ 更正块（`C1`–`C5`）| `§27.3`（`:6265`）★ 更正块（`C1`–`C5`）| append-only 覆盖读法 | 旧行一字不改；右列 = 现行读法唯一入口 |
| `§30.4`（`:2822`）★ 待办收口（`W1`–`W4`）| `§27.4`（`:6277`）★ 待办收口（`W1`–`W5`）| 定案值 | `storageDecimals`=4 / `streakDay7RewardBatt`=60 / `siteSlogan` 四语 / `siteTitle` 拆键 |
| `§30.5`（`:2831`）★ 术语统一待办登记（`T1`–`T6`）| `§27.5`（`:6287`）同（`T1`–`T6`）| 另单 · 不阻塞 | `en.json` 含 `Seller`/`Buyer` 六键**本次不改** |
| `§30.6`（`:2847`）`NOT_MEASURED` | `§27.6`（`:6303`）`NOT_MEASURED` | 逐条对位 | 规范单零代码 ⇒ 未实跑 |
| `§30.7`（`:2855`）指纹自证 | `§27.7`（`:6311`）指纹自证 | 逐条对位 | 快照 `cmp` = 0 |
| `§30.8`（`:2862`）与既有条文的引用关系 | `§27.8`（`:6318`）同 | 逐条对位 | 旧文一字未动 |

> **对位口径（写死）**：`§29`↔`§26`、`§30`↔`§27` 为"节号同位"；两处**无对位节**（`§29.5` 数据侧独有；`§26.8` route 侧独有），已在上表显式标注。

---

## §2 ① 白名单 `2 → 9`（逐字 9 键）+「在册 ≠ 可写」仍成立

**类 S 现取**（`backend-ts/src/database.ts:68-78` `APP_CONFIG_LEGAL_KEYS`）——逐字 9 键（顺序即代码面）：

1. `system_settings`（`AK1`）· 2. `listing_deposit_policy`（`AK2`）· 3. `batt_policy`（`B1`）· 4. `checkin_policy`（`B2`）· 5. `invite_reward_policy`（`B3`）· 6. `mint_burn_policy`（`B4`）· 7. `rating_policy`（`B5`）· 8. `site_text_overrides`（`B6` · `R-9-10` 追加）· 9. `role_names`（`B7` · `R-9-8` 更正追加）。

**类 G 现取**（`p8-s6` gate.json `checks` · C 组 `whitelist`）：

| 判据 | 期望 | 现取 | 结果 |
|---|---|---|---|
| `C1` | 顶层合法键**恰 9 键** | `APP_CONFIG_LEGAL_KEYS.length` = 9 | 绿 |
| `C2` | 白名单逐字 = 冻结 9 键 | `[...] ` 逐字相等 | 绿 |
| `C3` | 9 键**逐键**皆过 `AV1`（`validateAppConfigKey` ⇒ ok）| 9/9 `ok=true` | 绿 |
| `C4` | 清单外键 ⇒ 拒（`reason` = 稳定常量 `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` + `legal_keys` = 9 键）| `made_up_key` ⇒ `ok=false` + reason/legal_keys 相符 | 绿 |
| `C5` | ★「在册 ≠ 可写」：`role_names` 过 `AV1`（在册）**但仍须过** `AV2`–`AV4`（缺语值 ⇒ 拒）| `av1_ok=true` 且 `av_value_ok=false` | 绿 |

> **「候选 < 在册 < 可写」三级递进仍成立**（承 `§29.2(D)` / `R-8-19`）：入册（写进 `APP_CONFIG_LEGAL_KEYS`）≠ 免检 —— 入册键仍须过 `AV1–AV5` + `ops:<uid>:setting:<目标键名>` 键级寻址 + 闸 `manage_settings`。`C5` = 该口径的正面用例（非例外）。

---

## §3 ② 覆盖层键校验（四语键集相等 + 缺语 fail-closed + 字段/语言双闭集）

**类 S 现取**（`backend-ts/src/database.ts`）：

- `ROLE_NAMES_KEY = 'role_names'`（`:148`）· `SITE_TEXT_OVERRIDES_KEY = 'site_text_overrides'`（`:150`）。
- **字段闭集（显式枚举 · 禁任意 i18n 键）**：`ROLE_NAME_FIELDS = ['poster','worker','seller','buyer']`（`:153`）；`SITE_TEXT_FIELDS = ['siteTitle','siteSlogan','slogan']`（`:155`）。
- **语言闭集**：`OVERLAY_LANGS = ['zh','en','hk','vn']`（`:157`）。
- **写侧** `validateAppConfigValue` 分派（`:1570-1590`）：`site_text_overrides` / `role_names` ⇒ `validateOverlayValue(targetKey, 字段闭集, value)`；其它键 ⇒ fail-closed 拒（不可达）。
- **读侧 fail-closed**：`parseRoleNamesOverride`（`:302`）/ `parseSiteTextOverridesOverlay`（`:316`）—— 非法 / 缺语 / 多语 / 未知字段 / 非 object ⇒ `null`（调用方回落 locale 基值，**绝不空串**）。

**类 G 现取**（`p8-s6` gate.json · `overlayShape` `D` / `overlayAV` `E` / `readFailClosed` `F` / `numericPolicy` `G` 组）：

| 组 | 判据读数（逐条绿） |
|---|---|
| `D1`–`D4` | 两键名常量逐字；`role_names` 字段闭集 = 四角色；`site_text_overrides` 字段闭集 = 三键；语言闭集 = `zh/en/hk/vn` |
| `E1`–`E7` | 四角色 × 四语齐 ⇒ 过；**缺语 ⇒ `ok=false`（`reason=typeInvalid` · field 以 `poster.` 起）**；多语（`jp`）⇒ 拒（`unknownKey`）；未知字段（`ghost`）⇒ 拒；非 object ⇒ 拒（`valueNotObject`）；空白串语值 ⇒ 拒；部分补丁（仅 `poster`）⇒ 合法 |
| `F1`–`F7` | 合法 ⇒ 原样解析；缺语 / 多语 / 未知字段 / 非 object ⇒ `null`（读侧 fail-closed）|
| `G1`–`G5` | `rating_policy.storageDecimals=4` 合法；域外（`displayDecimals=5`）⇒ 拒；`batt_policy.capBatt=-1` ⇒ 拒；清单外字段 ⇒ 拒；非策略键 ⇒ 拒（`legal_keys` = 9 键）|

> **双闭集口径（写死）**：覆盖层 = **字段闭集（显式枚举）× 语言闭集（`{zh,en,hk,vn}`）**；**"文案键 × 四语"，无"部分语言"特例**（承 `§29.12(d)` / `§29.13①`）。四语键集**必须相等**；缺语 ⇒ fail-closed 回落 locale + 机读 reason。

---

## §4 ③ 公开读口 `GET /api/role-names`（无鉴权）+ 注册点 `75 → 76`

**类 S 现取**（`backend-ts/src/index.ts`）：

- `:1161` `app.get('/api/role-names', async (_req, res) => { ... })` —— 取数 `DatabaseService.getSiteTextOverlay()`（`:1163`）；成功 `sendSuccess(res, overlay)`；基础设施异常 ⇒ `sendInfraMapped(res, 'roleNames.get', error)`（既 §14 分类器）。
- handler 体内**零鉴权闸**（无 `requireAdmin(` / `requireActor(` / `Authorization` / `token`）= 无 token 请求必达 handler。
- 注册点 **76** 逐 verb 现取：`get 32 / post 41 / put 0 / patch 1 / delete 2`（和 = 76）；P9① 公开读口 +1（`get 31 → 32`）。

**类 G 现取**（`p8-s6` gate.json · `registration` `A` / `publicRead` `B` 组）：`A1` 注册点 = 76；`A2` 逐 verb 逐字相符；`A3` 逐 verb 之和 = 76；`A4` 读口在场；`A5` 取数 = `DatabaseService.getSiteTextOverlay(`；`A6` 成功面 = `sendSuccess(res,`；`A7` 异常 = `sendInfraMapped(res, 'roleNames.get',`；`A8`（负对照）缩进注入一条路由 ⇒ 76→77（判断真计数）；`B1` handler 零鉴权 ⇒ 无 token 应 200；`B2` 读口 = GET（无 POST 孪生）；`B3`（负对照）注入鉴权闸 ⇒ 谓词转红。

**类 P 现取**（受控实例探针 · HTTP 两读数对照）：

| 口 | 请求 | 读数 |
|---|---|---|
| **公开读口** `GET /api/role-names` | **无 token** | **HTTP 200**，`data` = `{ role_names: null, site_text_overrides: null, updated_at: null }`（三键在场、值为 `null`）|
| **受鉴权口**（对照）`GET /api/admin/settings` | **无 token** | **HTTP 401** |

> **口径**：读口 = **公开读**（角色名 / 站点标语 = 全站 UI 文案，须无鉴权取用，与写口分离 · 承 `§26.4`）。两键 `null` 系**真库无行**（见 §7 ★）⇒ 前端 fail-closed 回落 locale 基值（`source='locale'`），**绝不空串**。

---

## §5 ④ 四角色名 i18n 基键（命名空间 `roleNames` · 四语齐 · `Vendor`/`Customer`）

**类 S 现取**（`frontend/src/locales/{zh,en,hk,vn}.json` · 新增顶层 `roleNames`，四键 × 四语）：

| 角色（键名不变 · 结构标识）| `zh` | `en` | `hk` | `vn` |
|---|---|---|---|---|
| `poster` | 悬赏家 | Poster | 懸賞家 | Poster |
| `worker` | 工人 | Worker | 工人 | Worker |
| `seller` | 店家 | **Vendor** | 店家 | **Vendor** |
| `buyer` | 顾客 | **Customer** | 顧客 | **Customer** |

> **术语（`R-9-12`）**：`Seller` → **`Vendor`** / `Buyer` → **`Customer`**（仅改**展示文案**，键名 `seller`/`buyer` 不变）。**`vn` = 英文 = 正式口径（非占位）**（`R-9-11`）；`vn` 与 `en` 同批逐字相同 = **合法非缺陷**（零 CJK 纪律：`en`/`vn` 无 CJK）。

**类 G 现取**（`p8-s6` gate.json · `i18n` `H` 组）：`H1` `roleNames` 键集 = 四角色；`H2.{zh,en,hk,vn}` 四语键集齐 + 非空 + `siteSlogan` 在场非空；`H3.{en,vn}` 五处新文案面零 CJK；`H4` `hk` 为繁體（`roleNames.buyer` 与 `zh` 逐字不同 + `siteSlogan` 含 CJK 且与 `zh` 不同）；`H6` `adminNav` 新 2 键四语齐。

> **新增键（非复用）**：现取证实四角色名在原 locale **无专用键**（只存语义不同的碎片，如 `adminShards.thSeller='卖方'`）⇒ 四角色名 = **新增键**（承 `§29.13②`）。

---

## §6 ⑤ `siteTitle` 拆键 + `siteSlogan` 四语 + `index.html` 中性占位 + `document.title` 组合

**类 S 现取**：

- `siteTitle` **拆键后仅品牌名**：`zh` = `Seafood 海鲜市场` / `en` = `Seafood` / `hk` = `Seafood 海鮮市場` / `vn` = `Seafood`。
- **新键 `siteSlogan`（四语）**：`zh` = `加密人自己的「闲鱼」` / `en` = `The crypto crowd's own flea market` / `hk` = `幣圈人的跳蚤市場` / `vn` = `Chợ đồ cũ của dân crypto`（= 原 `siteTitle` 后半段逐字）。
- `frontend/index.html:10` = **中性占位** `<title>Seafood</title>`（替代原硬编码复合串）。
- `frontend/src/App.jsx:145` = `document.title = composeDocumentTitle(t('siteTitle'), t('siteSlogan'))` —— 运行时真源 = 「品牌名｜标语」组合，接覆盖层（覆盖值优先）。

**类 G 现取**：`H2.{l}`（`siteSlogan` 四语在场非空）· `H4`（`hk` slogan 繁體且与 `zh` 不同）· `H3.{en,vn}`（零 CJK）全绿。

> **测试连带（承 §10）**：`theme-shell-isomorphism.test.jsx` 的「`siteTitle` 为硬编码站名」断言 ⇒ **期望订正**（`siteTitle` = 品牌名 + `siteSlogan` 四语 + `index.html` 中性占位），**未删断言**。

---

## §7 ⑥ 后台页 ×1（角色文案 + 站点标语 + 数值项）+ 四语命名空间 + 禁工程口径泄漏六类 + ★「`GET /api/admin/settings` 不能读新键」现取结论

**类 S 现取**（后台页 + 导航 + 路由）：

- `frontend/src/pages/admin/SiteTextPage.jsx` —— 三段合一：**角色文案**（`role_names` 覆盖层）+ **站点标语**（`site_text_overrides` 覆盖层）+ **数值项**（`B1`–`B5` 策略键，键名逐字 = `app_config` 合法键 / 值对象字段名；默认值 = 契约默认值初值）。
- `frontend/src/components/layout/AdminLayout.jsx:131-134` —— 菜单项 `adminNav.siteText`（`title`）/ `adminNav.siteTextDesc`（`description`）⇒ `path: '/dashboard/site-text'`。
- `frontend/src/App.jsx:273` —— 路由 `site-text`，闸 `adminOnly` + `requiredPermission="manage_settings"`。

**四语命名空间（类 S 现取）**：新增顶层 `adminRoleNames`（**11 键**：`title`/`intro`/`saveButton`/`saving`/`saved`/`saveFailed`/`loadFailed`/`unsaved`/`noChanges`/`roleField`/`langField`）+ `adminSiteText`（**40 键**）四语齐；`adminNav` 28 键四语齐。

**禁工程口径泄漏六类 = 0**（`p8-s6` gate.json `H5` · 四语 × 五处新文案面，枚举）：① 章节号 / 条号（`§` / `R-\d` / `DL\d` / `LD\d`）② HTTP 状态码（400/401/…/504）③ 接口路径 / 方法（`/api/` / `GET|POST|… /`）④ 内部批次名 / 单号（`8①…⑥` / `P6/P7/P9` / `JING-SPEC` / `BE-AUDIT`）⑤ 机读码 / 裸 i18n 键（`[A-Z][A-Z0-9_]{5,}` / `adminRoleNames.` …）⑥ 表名 / 列名 / 函数名（`app_config` / `role_names` / `site_text_overrides` / `siteSlogan` / `roleNames`）。

### ★ 「`GET /api/admin/settings` 不能读新键」——现取结论（数值项读回 = `NOT_MEASURED`）

**类 S 现取（负向坐实）**：

- `index.ts:1171` `GET /api/admin/settings` 的取数 = `DatabaseService.getSystemSettings()`（`:1176`），**不**调 `getSiteTextOverlay()`。
- `getSystemSettings()`（`database.ts:3982-3992`）只执行 `SELECT value FROM public.app_config WHERE key = 'system_settings' LIMIT 1` —— **只读 `system_settings` 单键**；返回值 = 9 个 `system_settings` 字段（`siteName` / `siteDescription` / `maintenance` / `allowRegistration` / `emailNotifications` / `defaultLanguage` / `pointsPerTask` / `maxDailyTasks` / `rewardCooldown`）。

**类 P 现取（受控实例探针 · admin token）**：

| 项 | 现取读数 |
|---|---|
| `GET /api/admin/settings`（admin token）状态 | **HTTP 200** |
| 响应 `data` 键集（`data_keys`）| **仅 9 个 `system_settings` 字段**（= 上列 9 项）|
| `has_role_names` / `has_site_text_overrides` / `has_batt_policy` | 三者皆 **`false`** |
| `getSystemSettings()` 现取返回键集 | 9 个 `system_settings` 字段（同上）|
| 库内 `app_config` 键（只读 · `SELECT key FROM public.app_config ORDER BY key`）| **仅 `["system_settings"]`**（`listing_deposit_policy` / `batt_policy` / … / `role_names` / `site_text_overrides` 皆**无行**）|

> **⇒ 结论（写死）**：**`GET /api/admin/settings` 不能读新键**。该口取数 = `getSystemSettings()`，只 `WHERE key = 'system_settings'`；真库 `app_config` 亦**仅 `system_settings` 一行** ⇒ P9 新增键（`B1`–`B7`）既不在口径内、也**未入真库**。
> **⇒ 数值项读回 = `NOT_MEASURED`**（**逐字原因**）：① **无专用数值读口** —— 只有公开读口 `GET /api/role-names`（`role_names` + `site_text_overrides`）与 `GET /api/admin/settings`（仅 `system_settings`）；② `getSystemSettings()` **口径不含**新键；③ 新键**未入真库**（`app_config` 仅 1 行）。故后台页数值项**以契约默认值初值呈现**（contract defaults），真库读回归 P9②–⑤ 各自实现单。
> **对照读数**：公开读口（无 token）= **HTTP 200**（`role_names`/`site_text_overrides` 皆 `null`，因真库无行 · 见 §4）；受鉴权口（无 token）= **HTTP 401**。

---

## §8 ⑦ 前端取覆盖层合并（覆盖值优先 · 不本地持久缓存）

**类 S 现取**（`frontend/src/site-text-overlay.js` · `frontend/src/App.jsx`）：

- `fetchSiteTextOverlay()` ⇒ `fetchApiJson('/api/role-names')`（**公开读口 · 无鉴权**）；失败（网络 / 非 2xx / 形状非法 / 无 `fetch`）⇒ **`null`**（fail-closed）。
- `buildOverlayPatch(overlay)` ⇒ **覆盖值优先**：按语言遍历四语，空串 / 缺语 / 非法形状一律**不入补丁** ⇒ 该键保留 locale 基值（缺语 fail-closed）。
- `applySiteTextOverlay(i18n, overlay)` + `composeDocumentTitle(brand, slogan)`；`OVERLAY_LANGS` / `ROLE_NAME_KEYS` / `SITE_TEXT_KEYS` 与后端同序。
- `App.jsx:131-148`：**应用初始化 + 语言切换**时取覆盖层，合并进内存 i18n resources（`overlayTick` 触发 `document.title` 重算）；**不本地持久缓存**（只在内存 resources 内合并）。

> **生效机制（写死）**：覆盖值 **>** locale 文件；**不本地持久缓存**；读取失败 ⇒ fail-closed 回落 locale 基值（`source='locale'`），**绝不空串**（承 `§26.2` / `§27.2`）。

---

## §9 ⑧ 门 + 判负（新门 `p8-s6-*`）+ ① `adminNav` 三处同步

### §9.1 新门 `p8-s6-site-text-gate.ts` = **64/64**

- **脚本**：`backend-ts/scripts/p8-s6-site-text-gate.ts`；**零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / locale 文本，同「离线 126/126」族）。
- **产物（类 G 现取 · 上一收口单硬门全量运行）**：`backend-ts/.p8s6-artifacts/p8s6-20261003T013128Z/gate.json` 与 `…013140Z/gate.json` —— 两者 `total=64 / passed=64 / failed=0`。
- **判据 A–K**（每条**可判负**）：A 注册点 76 逐 verb + 公开读口在场（+ 缩进注入负对照）· B 公开读口无鉴权（+ 注入闸负对照）· C 白名单 9 键逐字 +「在册 ≠ 可写」· D 覆盖层字段 / 语言闭集逐字 · E `AV2`–`AV4` 四语键集相等 + 缺语 fail-closed · F 读侧 fail-closed · G 数值策略键 `AV2`–`AV4` · H 四语键齐 + 六类泄漏 = 0 · I `adminNav` 冻结 28 三处同步 · J 零新增错误码（闭集仍 33）+ 零新增 reason 常量 · K 门自证（谓词喂错值必转红）。

### §9.2 判负三变异（仓外副本 · 主仓零写入）—— 逐字红点

**方法**：`rsync` 建**仓外副本**（排除 `node_modules`/`.git`/`.*-artifacts`，软链 `node_modules`）⇒ 在副本上施三变异、各跑一次门 ⇒ 复原再跑。基线 + 三变异 + 三复原的现取读数（逐字）：

| 变异 | 改动 | 门读数（副本）| **红点（failed check id）** | 复原 |
|---|---|---|---|---|
| 基线 | 副本未变异 | `total=64 passed=64 failed=0` | **NONE** | —— |
| **① 去 fail-closed** | `database.ts` 把「缺语 ⇒ `rejectType`」改 `continue` | `total=64 passed=62 failed=2` | **`C5,E2`** | 复原 ⇒ `64/64`（NONE）|
| **② 白名单退回 2 键** | `database.ts` `APP_CONFIG_LEGAL_KEYS` 收回 `['system_settings','listing_deposit_policy']` | `total=64 passed=59 failed=5` | **`C1,C2,C3,C4,C5`** | 复原 ⇒ `64/64`（NONE）|
| **③ 读口加鉴权** | `index.ts` 给 `GET /api/role-names` 注入 `requireAdmin(req, res, 'manage_settings')` | `total=64 passed=62 failed=2` | **`B1,B3`** | 复原 ⇒ `64/64`（NONE）|

- **基线与三复原全绿**（64/64）；三变异**均转红且红点集精确可判**（非空、非全红）⇒ 门**真能抓**（非假门）。
- **主仓零写入（逐字自证）**：判负前 / 后对**主仓**下列 **6 文件**取 md5、`cmp` 前后**逐字相同**（`MAIN_ZERO_WRITE: OK`）：

| # | 主仓文件 | md5（前 = 后 · 现取复核相同）|
|---|---|---|
| 1 | `backend-ts/src/database.ts` | `8faeb659e95bf2fd6ed92c89f0737d03` |
| 2 | `backend-ts/src/index.ts` | `6096928c1cf8990636eca7d24e84ebf4` |
| 3 | `backend-ts/scripts/p8-s6-site-text-gate.ts` | `294a6c7c3c977785f2ce2708a4bb8ba9` |
| 4 | `backend-ts/scripts/p8-s5-compliance-gate.ts` | `90226ce3df183453586eab03cc030049` |
| 5 | `backend-ts/scripts/p8-s2-fee-rebate-gate.ts` | `941ba84d9a57892f612bbc5a85537c59` |
| 6 | `frontend/src/test/unit/i18n-batch-b4a.test.jsx` | `b03d2cea1bcff1ffd39d3ef5337e6f5b` |

### §9.3 ① `adminNav` `26 → 28` 三处同步（逐处给出处）

**三处冻结位（逐处）**：

| # | 文件 | 出处（现取）| 冻结值 |
|---|---|---|---|
| ① | `backend-ts/scripts/p8-s5-compliance-gate.ts` | 注释锚 `:73`（4 行 · 记 `adminNav 26 → 28`）· **常量本体 `:76`** `const NAV_KEYS_FROZEN = 28;` | 28 |
| ② | `backend-ts/scripts/p8-s2-fee-rebate-gate.ts` | 注释锚 `:186`（记 `adminNav 26 → 28`）· **常量本体 `:187`** `NS_KEYS = { adminFeeRate: 18, adminWeightMatrix: 21, adminNav: 28 }` | 28 |
| ③ | `frontend/src/test/unit/i18n-batch-b4a.test.jsx` | **`:108`** `const NEW_NS = { adminNav: 28, ... }`（注释 `:122` 记 P9① +2）| 28 |

- **`B9S1_ADDED_TO_ADMINNAV = 2`**：`b4a` `:124`（本片新增键计数 = 2）。
- **门现取（类 G）**：`p8-s6` `I1`（四语 `adminNav` 键数 = 28）· `I2`/`I3`/`I4`（三处冻结 = 28）· `I5`（三处旧值 `26` **零残留** = 同步彻底）全绿。

**★ 逐字登记实际键名 = `siteText` / `siteTextDesc`**（现取 `frontend/src/locales/zh.json:511-512`：`"siteText": "站点文案"` / `"siteTextDesc": "角色名称与站点标语配置"`；四语齐）。**注**：派单描述的 `roleNames` **不在 `adminNav` 内** —— `adminNav` 本片实际新增的是 `siteText` / `siteTextDesc`（**以现取为准**）。

---

## §10 ⑨ 测试连带（`theme-shell-isomorphism` 期望订正 + 四个 i18n 计数测试前推 + 额外修复）

**① `theme-shell-isomorphism.test.jsx`（期望订正 · 未删断言）**：`siteTitle` 断言 `Seafood 海鲜市场｜加密人自己的「闲鱼」` ⇒ **`Seafood 海鲜市场`**（拆键后仅品牌名）；新增 `siteSlogan` 四语断言；`index.html` 断言 `<title>Seafood 海鲜市场｜…</title>` ⇒ **`<title>Seafood</title>`**；`App.jsx` 断言 `document.title = t('siteTitle')` ⇒ `t('siteTitle')` + `t('siteSlogan')` + `document.title =`。**断言条数净增，未删任何断言**。

**② 四个 i18n 计数测试前推（`top 108 → 112` / `flat 886 → 944`）**：新增顶层 `roleNames`(4) + `siteSlogan`(1) + `adminRoleNames`(11) + `adminSiteText`(40) + `adminNav` 2 键 ⇒ **拍平 +58**（`886 ⇒ 944`）/ **顶层 +4**（`108 ⇒ 112`）。落点：`i18n-batch-b4a.test.jsx:143`（`{ top: 112, flat: 944 }`）· `i18n-batch-b5.test.jsx:215/241/256`（`zh: top=112 flat=944`）。`numstat`：`b4a` `6 3` / `b4b` `3 3` / `b5` `3 3`（皆期望订正，**未删断言**）。

**③ 额外修复（`i18n-violation-closeout.test.jsx` 期望 `3544 ⇒ 3776` · 未删断言）**：本片新增 58 拍平键 ⇒ locale 节点 `944 × 4 = 3776`（原 `886 × 4 = 3544`）。落点两处：`:81` 断言 `作用域命中节点数 = 3544` ⇒ **`= 3776`**（注释在 `:80` · 记 `拍平 886⇒944 ⇒ 节点 3544⇒3776`）+ `:127` 拍平计数 `toBe(886)` ⇒ **`toBe(944)`**。**未删断言**（逐字登记，仅订正期望值）。

---

## §11 AC / 硬门读数（退出码管道外捕获）

**硬门全量（类 G 现取 · 上一收口单 2026-10-03 01:30–01:34 那一次全量运行 · 本单不重跑）**：

| 门 | 产物（`.p8s*-artifacts/…/gate.json`）| total | passed | failed | 退出码 |
|---|---|---|---|---|---|
| `p8-s1`（app-config）| `.p8s1-artifacts/p8s1-20261003T013137Z/gate.json` | 24 | 24 | 0 | 0 |
| `p8-s2`（fee-rebate）| `.p8s2-artifacts/p8s2-gate-20261003T013017Z/gate.json` | 41 | 41 | 0 | 0 |
| `p8-s3`（deposit）| `.p8s3-artifacts/p8s3-20261003T013138Z/gate.json` | 45 | 45 | 0 | 0 |
| `p8-s3b`（address）| `.p8s3b-artifacts/p8s3b-20261003T013138Z/gate.json` | 38 | 38 | 0 | 0 |
| `p8-s4`（currency-review）| `.p8s4-artifacts/p8s4-20261003T013139Z/gate.json` | 79 | 79 | 0 | 0 |
| `p8-s5`（compliance）| `.p8s5-artifacts/p8s5-gate-20261003T013017Z/gate.json` | 117 | 117 | 0 | 0 |
| **`p8-s6`（P9① 新门）** | `.p8s6-artifacts/p8s6-20261003T013128Z|013140Z/gate.json` | **64** | **64** | **0** | 0 |
| **合计** | —— | **408** | **408** | **0** | 全 0 |

- **`tsc`** = **0**（类型检查无错）。
- **离线族** = **`126/126`**（离线纯函数门套件全绿）。
- **`p8-s1` 自证复跑**：上一收口单以临时探针 `p9s1-00-selftest-probe.ts` 复跑 `p8-s1` 的 B1/B2/B3 自证（谓词与门内 B1/B2 逐字同形 · 含 `B1 wrongInput` 错值喂入必转红）；探针**已按本单收尾删除**，其读数 =「判据错值喂入 ⇒ 必 `false`」（与 `p8-s6` K 组 + `selfTest` 同族口径）。

---

## §12 未测项（逐项原因 · 禁填 0 / 空）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位）|
|--:|---|---|
| 1 | **`GET /api/admin/settings` 读回 P9 新键** | **该口不能读新键** —— 取数 = `getSystemSettings()`，只 `WHERE key = 'system_settings'`；真库 `app_config` 仅 `system_settings` 一行（见 §7 ★）。**数值项读回 = `NOT_MEASURED`**（无专用数值读口 + 口径不含新键 + 新键未入真库）。|
| 2 | **覆盖层（`role_names` / `site_text_overrides`）的真库写落值** | 本片**零库面写**（写面纪律：新键一律事务内 INSERT + `ROLLBACK`；`app_config` 两枚 `BEFORE UPDATE` 触发器 ⇒ 严禁 UPDATE 还原）；真库无行 ⇒ 覆盖层 HTTP 两键现取皆 `null`（§4）。写侧 `AV2`–`AV4` 已以门/纯函数读数覆盖（§3），**真库落值未跑**。|
| 3 | **覆盖层经公开读口的「非空」读回** | 承上：真库无行 ⇒ 读口现取 = `{role_names:null, site_text_overrides:null, updated_at:null}`；**非空读回未测**（需先有库面写，本片不做）。|
| 4 | **浏览器真实渲染**（`SiteTextPage` 四语命名空间 / `document.title` 实时生效）| **本单未起实例 / 未做浏览器渲染验收**（本单为极小续跑，无需）。四语键齐 + 六类泄漏 = 0 已以离线门（`p8-s6` H 组）覆盖。|
| 5 | **`test:unit` 明细用例清单** | 只读**总数**（承上单）；**未逐例列名**（非本报告口径要求）。|
| 6 | **P9②–⑤ 数值键的实际写入 / 读回（`B1`–`B5`）** | 归**后续片**（各自实现单）；本片只落键面 + 校验 + 后台页默认值初值呈现。|
| 7 | **术语统一待办六键的批量改** | **另单 · 不阻塞**（承 `§30.5` / `§27.5`）；本片**未改**（`en.json` 逐字现值已登记）。|

---

## §13 收尾（本单 ③：删两临时探针 + 端口 + `git status` 归因）

- **删探针**：`rm -f backend-ts/scripts/p9s1-00-selftest-probe.ts backend-ts/scripts/p9s1-00b-live-probe.ts`（**仅此两件**）。删除前后 `ls`：前 = 两件在场（`2226 B` / `3630 B`）；后 = `No such file or directory`，`ls backend-ts/scripts/p9s1-*` = 无匹配。
- **端口**：`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**（`rc=1`）。
- **`git status --porcelain` 首尾对照**：**108 行 → 106 行**；唯一差异 = 上述两行 `?? backend-ts/scripts/p9s1-*`（探针）消失，**其余逐条不变**（22 个 ` M` 恒等）。

**归因（106 行 · 三桶）**：

**桶 1 · 本单（P9① 极小续跑）**：`?? docs/audit/p9-s1-site-text-overlay.md`（**本报告** · 新建）· ` M docs/audit/p8-s5-compliance-review.md`（8⑤ 合批微修既有 ` M` 底欠 + **本单 ② 订正**〔§10 桶 A 本体 1 处 + 订正记录追加 1 行〕；**未提交**）。

**桶 2 · P9① 交付面（上一收口单实现 · 未提交）**：` M` 后端 `backend-ts/src/database.ts`（白名单 2→9 · 覆盖层校验 · 读侧解析 · `getSiteTextOverlay`）· `backend-ts/src/index.ts`（公开读口 + 注册点 76）｜` M` 六门脚本 `p8-s1`/`p8-s2`/`p8-s3`/`p8-s3b`/`p8-s4`/`p8-s5`（冻结计数前推）｜` M` 前端 `index.html`（中性占位）· `App.jsx`（`document.title` + 覆盖层）· `AdminLayout.jsx`（`siteText` 菜单）· 四语 `en/hk/vn/zh.json`｜` M` 测试 `i18n-batch-b4a/b4b/b5.test.jsx` · `i18n-violation-closeout.test.jsx` · `theme-shell-isomorphism.test.jsx`｜`??` 新建 `backend-ts/scripts/p8-s6-site-text-gate.ts` · `frontend/src/pages/admin/SiteTextPage.jsx` · `frontend/src/site-text-overlay.js` · `backend-ts/.p8s6-artifacts/`。

**桶 3 · 历史产物 / 它单（非本单源码面 · 未触碰）**：` M backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json`（历史件漂移）｜`??` `.p4-artifacts/p6tr1a-*`（11 件 · P6 翻译面产物）｜`??` `.p8s1-artifacts/`…`.p8s5-artifacts/`（硬门套件运行产物 · 12+13+13+13+9+5 件，含本次全量运行目录）｜`?? backend-ts/scripts/p8-s5-00-recon{,2,3}.ts`（8⑤ 临时侦察 3 件）。

---

*—— 报告完（本报告 = P9① 实现第一步读数回填；本单零门重跑 / 零代码改动〔仅删两临时探针〕/ 零迁移 / 零 apply / 零 commit / 零实例）。*
