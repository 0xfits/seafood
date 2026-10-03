# P9① 终审质检 · 站点文案覆盖层 + P9 配置键（后台可配置面）· 独立质检报告

- **报告路径**：`docs/qa/p9-s1-site-text-overlay-qa.md`
- **角色 / 单号**：Neng（独立质检方）· P9① 终审质检
- **日期**：2026-10-03（CST）
- **被检面（钉）**：`38648c121ccedcfbaaaf11ce0dcf680e6d09f57a`（**本地未推**；现取 `git log -1` 逐字取得，未采信任何转引）
- **被检交付报告**：`docs/audit/p9-s1-site-text-overlay.md`
- **固定副本**：`git worktree add --detach <scratch>/qaP9s1 38648c1` + 软链 `backend-ts/node_modules` / `frontend/node_modules` / `backend-ts/.env.local`（**未打印内容/密钥**）
- **写面纪律**：一切库面写 = 事务内 + 末尾 `ROLLBACK`；`app_config` 两枚 `BEFORE UPDATE` 触发器 ⇒ **严禁 UPDATE + 还原** ⇒ 新键一律**事务内 INSERT**（回滚即净）；**严禁任何生产库真写**；**不 apply 任何迁移**；变异只在**仓外副本**内且复原。

---

## §0 口径与取证时点

- **取证时点**：2026-10-03（CST）。本报告读数为**本单（P9① 终审质检）**一次取证所得；**回填单（极小收尾）不重跑任何门 / 探针**，仅逐节回填既有读数 + 登记 + 收尾。
- **被检面钉**：`38648c1`（当前 `HEAD` = `18f2695` 的父提交；`18f2695` 仅 `docs(p9)` 文档追加，不含代码面）。
- **取证通道（读数来源，全部为原始输出，非转引）**：
  - **L1 硬门**：`run_l1.sh`（退出码**管道外**捕获）⇒ `backend-ts/.p9s1qa-artifacts/20261003T014315Z/L1_*.out` + `L1_summary.txt`。
  - **L2 承重面**：`L2_cover_backend.json`（写/读侧 + 白名单 + `AV1`–`AV4`）· `L2_L3_frontend_probe.json`（前端构件置入 / 合并）· `L2_http.txt`（公开读口 ⇄ 管理读口 真 HTTP）。
  - **L2 反向判负（两路独立互证）**：`p9s1-negctl/`（`p9s1-negctl.sh` · NEGCTL 副本）与 `L2_mut_*.out`（`run_mut.sh` · rsync 副本）。
  - **L3**：前端构件级**自写**探针 `qa9s1-probes/fe-probe.mjs`（bundled `site-text-overlay.bundle.mjs`）。
  - **L5 / L7**：库面只读探针 + 面核 ⇒ `L5_db_readonly.json` / `L7_facets.json`（4 个探针 `.err` 均 0 B ⇒ 无异常行）。
- **本单（极小收尾）口径**：**不重跑任何门 / 探针**（读数已在）· **不改被检件**（代码 / 报告 / 规范）· **不 apply 任何迁移** · **不 `git add/commit/push`** · **不 `npm install`** · **不碰 / 不打印 `.env*`** · **不 `pkill -f` / `killall`** · **不启实例**（本单无需）· 只写 `docs/qa/**`。
- **未测项口径**：报告 §9 逐项列明**未测**与**原因**（**禁填 `0` / 空**）。

---

## §1 结论摘要

**verdict = PASS。**

| 承重腿 | 结论 | 一句话读数 |
|---|---|---|
| **L1 硬门独立复跑** | ✅ 全绿 | 18 项 `EXIT=0`；`tsc` 0 错 · 离线 126/126 · 七门合计 **408/408** · `build` 0 错 · `test:unit` **31 文件 / 276**· 七工程门全 0（`p7c` = **真链** · locale 叶子 **3776**） |
| **L2 覆盖层承重面（核心）** | ✅ 全绿 | 白名单 **9 键逐字** · 「在册 ≠ 可写」三例全拒 · 写/读侧 fail-closed · 公开读口 **200** ⇄ 管理口 **401** · 前端覆盖优先 / 缺语回落 · **反向判负三变异全红**且复原 64/64 · `MAIN_ZERO_WRITE: OK` |
| **L3 前端真生效** | ✅ 全绿 | `App.jsx` 接线（init + 语言切换取数 · 覆盖优先 · `document.title` 组合）；覆盖层面 **零** `localStorage/sessionStorage/indexedDB` |
| **L4 逐字比对** | ✅ 全绿 | `siteTitle` / `siteSlogan` 四语逐字 · `roleNames` 四语键集相等（en/vn `Vendor`/`Customer`）· en/vn **零 CJK** · `index.html` = `<title>Seafood</title>` |
| **L5 库面（只读）** | ✅ 全绿 | `app_config` 键集 = **仅 `["system_settings"]`**（count 1）· 新键 **0 行** · **2 枚** `BEFORE UPDATE` 触发器在场 · `schema_version=0027` / 迁移 **26** |
- **L6 报告核** | ✅ 全绿 | 被检报告 **315 行 / 33,163 B / 双下划线占位 = 0** · 锚点全中 · `p8-s5-compliance-review.md` `numstat = 14 7` + 三处订正痕迹均在 |
| **L7 面核** | ✅ 全绿 | 注册点 **76**（逐 verb）· 白名单 **9** · 四语键集相等 · **六类泄漏 = 0** · 错误码 **33 未动** · reason 常量 **3** |
| **L8 未测项 + verdict** | ✅ **PASS** | 未测项逐项列明原因（见 §9） |

- **唯一登记项（非缺陷）**：被检报告 §13 将 `docs/audit/p8-s5-compliance-review.md` 记为「` M` · **未提交**」——**属时点性描述**（报告写于入库前），现取已随 `38648c1` 入库（工作树 clean），**非缺陷**（逐字登记见 §7）。

---

## §2 L1 硬门独立复跑（退出码管道外捕获）

**通道**：`run_l1.sh`（`run()` 子壳捕获 `$?`，`tee` 落 `L1_summary.txt`）。工作树 = 固定副本 `qaP9s1`（detach @ `38648c1`）。**RUN=`20261003T014315Z`**（`L1_summary.txt` 逐字）。

| # | 门 / 命令 | `EXIT` | 读数（现取原文） |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | `L1_tsc.out` = **0 B**（**零错误行**） |
| 2 | 离线测试 `p4z-tr1a-01-offline-tests.ts` | **0** | `SUMMARY total=126 passed=126 failed=0`（**126/126**） |
| 3 | `p8-s1-app-config-gate.ts` | **0** | `total=24 passed=24 failed=0`（**24**） |
| 4 | `p8-s2-fee-rebate-gate.ts` | **0** | `total=41 passed=41 failed=0`（**41**） |
| 5 | `p8-s3-deposit-gate.ts` | **0** | `total=45 passed=45 failed=0`（**45**） |
| 6 | `p8-s3b-address-gate.ts` | **0** | `total=38 passed=38 failed=0`（**38**） |
| 7 | `p8-s4-currency-review-gate.ts` | **0** | `total=79 passed=79 failed=0`（**79**） |
| 8 | `p8-s5-compliance-gate.ts` | **0** | `total=117 passed=117 failed=0`（**117**） |
| 9 | `p8-s6-site-text-gate.ts` | **0** | `total=64 passed=64 failed=0`（**64**） |
| 10 | `npm run build`（frontend） | **0** | `✓ built in 1.55s`（**零错误**） |
| 11 | `npm run test:unit`（frontend） | **0** | `Test Files 31 passed (31)` / `Tests 276 passed (276)`（**31 文件 / 276**） |
| 12 | `p4z-i18nviol-global.mjs` | **0** | 「总判：**PASS**」（locale 裸命中 0 + 源面裸命中 0；locale 作用域 **3776**） |
| 13 | `p6-tr2-i18n-locales.mjs` | **0** | 「总判：**PASS**」（四语拍平键数集合 = `{944}`） |
| 14 | `p4z-miscfix-links.mjs` | **0** | 「总判：**PASS**」（未登记残留 0 / 已登记待办 8） |
| 15 | `p4z-feperf-safelist.mjs` | **0** | safelist 29 ⇄ dynamic 24（PASS，退出码 0） |
| 16 | `p7a-03-errmessage-gate.mjs` | **0** | 「总判：**PASS**」（未登记命中 0） |
| 17 | `p7b-errfallback-gate.mjs` | **0** | 「总判：**PASS**」（判负 0） |
| 18 | `p7c-errmsg-machinecode-gate.mjs` | **0** | 「总判：**PASS**」· **链路体制 = `真链`** · locale 叶子值 = **3776**（**非**镜像） |

- **硬门合计（后端 7 门）**：`24 + 41 + 45 + 38 + 79 + 117 + 64 = **408/408**`（**零红**）。
- **注册点（`p8-s6` A 组现取）**：**76** = `get:32 / post:41 / put:0 / patch:1 / delete:2`（逐 verb 之和 = 总数，**独立复核成立**：非注释行 `app.get(` = 32 行，`:790` 为注释引用行）。
- **`L1_summary.txt` 逐字**：18 行 `| EXIT=0 |` + `DONE RUN=20261003T014315Z`。

---

## §3 L2 ★★ 覆盖层承重面（本片核心）双证 + 反向判负

### 3.1 白名单（`L2_cover_backend.json` · `legal_keys` 现取 9 键逐字）

```
["system_settings","listing_deposit_policy","batt_policy","checkin_policy",
 "invite_reward_policy","mint_burn_policy","rating_policy","site_text_overrides","role_names"]
```

- `legal_keys_len = 9`；`reasons` = `{unknownKey:SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST, typeInvalid:SETTING_TYPE_INVALID, valueNotObject:SETTING_VALUE_NOT_OBJECT}`。
- `role_name_fields = ["poster","worker","seller","buyer"]`；`site_text_fields = ["siteTitle","siteSlogan","slogan"]`；`overlay_langs = ["zh","en","hk","vn"]`。

### 3.2 写侧：非白名单 / 越界键一律拒（fail-closed）

| 例 | 现取读数 | 结论 |
|---|---|---|
| **A1** 键不在白名单（`qa9s1_bogus_key`） | `ok=false` · `code=LEDGER_AMOUNT_INVALID` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` · `unknown_keys=["qa9s1_bogus_key"]` · `legal_len=9` | ✅ 拒（**稳定常量** + `legal_keys`=9） |
| **A2** 值非对象 | `ok=false` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` | ✅ 拒 |

### 3.3 ★ 「在册 ≠ 可写」三例（白名单内键仍可被拒）

| 例 | 键 | 现取读数 | 结论 |
|---|---|---|---|
| **A3** 未知字段 | `batt_policy` | `ok=false` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` · `legal_keys=["taskCostBatt","capBatt","floorBatt","acceptThresholdBatt"]` | ✅ 拒（字段闭集外的键被当 unknownKey） |
| **A4** 未知字段 | `role_names` | `ok=false` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` | ✅ 拒 |
| **D1** 域外值 | `rating_policy`（数值域违例） | `ok=false` · `reason=SETTING_TYPE_INVALID` | ✅ 拒 |

> **`C5`（门内自证）**：`role_names` 过 `AV1`（`av1_ok=true`，**在册**）但仍须过 `AV2`–`AV4`（`av_value_ok=false`）⇒ 在册 ≠ 可写，**成立**。

### 3.4 覆盖层值：缺语 / 多语 / 空串（写侧 fail-closed）

| 例 | 现取读数 | 结论 |
|---|---|---|
| **B1** 合法四语写 | `ok=true` | ✅ 收 |
| **B2** 缺一语（`seller.hk` 缺） | `ok=false` · `reason=SETTING_TYPE_INVALID` · `field=seller.hk` | ✅ 拒（**四语键集相等** 强制；缺语 fail-closed） |
| **B3** 多一语 | `ok=false` · `reason=SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` | ✅ 拒（语言闭集外 ⇒ unknownKey） |
| **B4** 空串 | `ok=false` · `reason=SETTING_TYPE_INVALID` | ✅ 拒（typeInvalid） |

### 3.5 读侧 fail-closed（`getSiteTextOverlay` 解析）

| 例 | 现取读数 | 结论 |
|---|---|---|
| **C1** 读解析·缺语 | `is_null=true` | ✅ `null` |
| **C2** 读解析·多语 | `is_null=true` | ✅ `null` |
| **C3** 读解析·空串 | `is_null=true` | ✅ `null` |
| **C4** 读解析·合法 | `not_null=true` · 值 `seller={zh:卖家,en:Vendor,hk:賣家,vn:Vendor}` / `buyer={zh:买家,en:Customer,hk:買家,vn:Customer}` | ✅ 取回 |
| **C5** 站点文本·合法 | `site_text_legal` / `not_null` = `true` | ✅ 取回 |
| **C6** 站点文本·缺语 | `is_null=true` | ✅ `null` |

> 读侧非法一律 ⇒ `null` ⇒ **前端回落 locale 基值（绝不空串）**。

### 3.6 ★ HTTP 双证（`L2_http.txt` 逐字）

```
GET /api/role-names      （无 token） ⇒ HTTP_STATUS=200  {"success":true,"message":"OK","data":{"role_names":null,"site_text_overrides":null,"updated_at":null}}
GET /api/admin/settings  （无 token） ⇒ HTTP_STATUS=401  {"error":{"code":"AUTH_UNAUTHORIZED",...,"i18n_key":"auth.err.AUTH_UNAUTHORIZED"}}
```

- **公开读口**（无鉴权）⇒ **200**（`p8-s6 B1` 静态佐证：handler 体内零 `requireAdmin(` / `requireActor(` / `Authorization` / `token`；`unauthenticated_read=true`）。
- **管理读口** ⇒ **401 `AUTH_UNAUTHORIZED`**（对照面，鉴权闸在场）。

### 3.7 ★ 前端覆盖层合并（`L2_L3_frontend_probe.json`）

- `T1_patch` 四语齐（zh/en/hk/vn），`T1_no_empty=true`（**不半生效 / 不空串**）。
- **覆盖优先**：`T3_before_zh_siteTitle="Seafood 海鲜市场"` ⇒ 应用 **4 语** ⇒ `T3_after_zh_siteTitle="海鲜市场·品牌"`、`T3_after_zh_roleNames_poster="超级发单"`、`T3_after_hk_siteSlogan="幣圈人的跳蚤市場"`。
- **缺语回落 locale**：`T2/T4` 现取 zh/hk 标语均取到真值且 `no_empty=true`。
- **overlay = null ⇒ 0 应用**：`T5_applied_on_null=0` · `T5_zh_siteTitle="Seafood 海鲜市场"`（回落 locale 基值，**未被清空**）。
- **`document.title` 组合**：`T6_title_full="Seafood 海鲜市场｜加密人自己的「闲鱼」"` · `T6_title_no_slogan="Seafood"` · `T6_title_empty_slogan="Seafood"` · `T6_title_empty_brand="｜slogan"`。
- 探针导出键逐字：`["OVERLAY_LANGS","ROLE_NAME_KEYS","SITE_TEXT_KEYS","applySiteTextOverlay","buildOverlayPatch","composeDocumentTitle","fetchSiteTextOverlay"]`。

### 3.8 ★★ 反向判负三变异（两路独立路径，均必红）

**（a）NEGCTL 副本（`p9s1-negctl.sh`）** 与 **（b）rsync 副本（`run_mut.sh`）** —— 两路结论**逐字一致**：

| 变异 | NEGCTL（`*.out`）| rsync 副本（`L2_mut_*.out`） | 红项（现取 `gate.json`） |
|---|---|---|---|
| **baseline（未变异）** | `total=64 passed=64 failed=0` | `total=64 passed=64 failed=0` | **NONE** |
| **① 去缺语 fail-closed**（`return rejectType(...)` ⇒ `continue`） | `total=64 passed=62 failed=2` | `total=64 passed=62 failed=2` | **`[C5, E2]`** |
| **② 白名单退回 2 键**（9 ⇒ `[system_settings, listing_deposit_policy]`） | `total=64 passed=59 failed=5` | `total=64 passed=59 failed=5` | **`[C1, C2, C3, C4, C5]`** |
| **③ 读口加鉴权**（注入 `requireAdmin(req,res,'manage_settings')`） | `total=64 passed=62 failed=2` | `total=64 passed=62 failed=2` | **`[B1, B3]`** |
| **各变异复原后** | 三次均 `total=64 passed=64 failed=0` | 三次均 `total=64 passed=64 failed=0` | **NONE** |

- **复原彻底**：副本内变异文件 `cmp` 与主仓目标文件 = `0`（NEGCTL `cmp database.ts / index.ts` 均 `=0`）。
- **★ `MAIN_ZERO_WRITE: OK`**：主仓三目标文件（`database.ts` / `index.ts` / `p8-s6-site-text-gate.ts`）`md5` **前 ⇄ 后逐字相同**：
  `8faeb659e95bf2fd6ed92c89f0737d03` / `6096928c1cf8990636eca7d24e84ebf4` / `294a6c7c3c977785f2ce2708a4bb8ba9`（`L2_mut_main_before.md5` == `L2_mut_main_after.md5`）。NEGCTL 路径另覆盖 6 文件 `md5` 前后 `cmp -s` 亦相同。

> **门内自证（非空转）**：各自证项（门内 id = 字母数字 + **双下划线** + `selftest` 后缀）**B1**（注入鉴权 ⇒ 无鉴权谓词转红）· **C2** · **E2** · **F2** · **H5**（带章节号文案 ⇒ 泄漏谓词转红）· **I2** · **J1**（自造码喂入 ⇒ 闭集谓词转红）**均 `pass=true`**。

---

## §4 L3 前端真生效（构件级 / 自写探针）

**通道**：自写构件探针 `qa9s1-probes/fe-probe.mjs` + bundled `site-text-overlay.bundle.mjs`。

### 4.1 `App.jsx` 接线（`frontend/src/App.jsx` 现取）

- **导入**：`import { applySiteTextOverlay, composeDocumentTitle, fetchSiteTextOverlay } from './site-text-overlay'`（`:43`）。
- **应用初始化 + 语言切换取数**：`useEffect(..., [i18n, lang])` 内 `fetchSiteTextOverlay().then((overlay) => { if (cancelled || !overlay) return; if (applySiteTextOverlay(i18n, overlay) > 0) setOverlayTick((n) => n + 1) })`（`:134-141`）⇒ **覆盖层改动触发一次重渲染**。
- **覆盖优先**：`applySiteTextOverlay` 以 `deep=true, overwrite=true` 合并（覆盖值 > locale）。
- **`document.title` 组合**：`document.title = composeDocumentTitle(t('siteTitle'), t('siteSlogan'))`（`:145`）；唯一运行时写入点；依赖 `i18n.language` 覆盖首次加载 + 两条语言切换路径。
- **单一真源**：`siteTitle` 拆键后仅品牌名（`R-9-13`-3）。

### 4.2 零本地持久化

- `frontend/src/site-text-overlay.js` 明写「**不本地持久缓存**（只在内存 i18n resources 内合并）；读取失败 ⇒ fail-closed 回落 locale 基值（**绝不空串**）」。
- 现取扫描 `App.jsx` / `site-text-overlay.js` / `pages/admin/SiteTextPage.jsx`：**零** `localStorage` / `sessionStorage` / `indexedDB` 命中。

---

## §5 L4 `siteTitle` 拆键与 `siteSlogan` 四语（逐字比对）

### 5.1 `siteTitle` 四语逐字（`frontend/src/locales/*.json` 现取）

| 语 | `siteTitle` |
|---|---|
| zh | `Seafood 海鲜市场` |
| en | `Seafood` |
| hk | `Seafood 海鮮市場` |
| vn | `Seafood` |

### 5.2 `siteSlogan` 四语逐字

| 语 | `siteSlogan` |
|---|---|
| zh | `加密人自己的「闲鱼」` |
| en | `The crypto crowd's own flea market` |
| hk | `幣圈人的跳蚤市場` |
| vn | `Chợ đồ cũ của dân crypto` |

### 5.3 `roleNames` 四语键集相等（en/vn = `Vendor`/`Customer`）

| 语 | `roleNames` |
|---|---|
| zh | `{poster:悬赏家, worker:工人, seller:店家, buyer:顾客}` |
| en | `{poster:Poster, worker:Worker, seller:Vendor, buyer:Customer}` |
| hk | `{poster:懸賞家, worker:工人, seller:店家, buyer:顧客}` |
| vn | `{poster:Poster, worker:Worker, seller:Vendor, buyer:Customer}` |

- **四语键集相等** = `["poster","worker","seller","buyer"]`（**现取**）。
- **en/vn 零 CJK**：五处新文案面（`roleNames` / `siteSlogan` / `adminRoleNames` / `adminSiteText` / `adminNav` 新 2 键）扫描 ⇒ `H3.en=[]` / `H3.vn=[]`。
- **hk 为繁體**（`roleNames.buyer` = `顧客` ≠ zh `顾客`；`siteSlogan` 与 zh 不同且含 CJK）。

### 5.4 `index.html` 中性占位

- `frontend/index.html` = `<title>Seafood</title>`（**中性占位**，逐字现取）。

---

## §6 L5 库面（只读）

**通道**：只读探针 ⇒ `L5_db_readonly.json`（`.err` = 0 B）。

| 检项 | 现取读数 | 结论 |
|---|---|---|
| `app_config` 键集 | `[{"key":"system_settings","time_updated":"2026-10-02 14:14:07.502017+00"}]` ⇒ **仅 `["system_settings"]`** | ✅ |
| `app_config` 计数 | `n = 1`（**count 1**） | ✅ |
| 新键**行数** | `role_names → rows=0` · `site_text_overrides → rows=0` ⇒ **新键 0 行** | ✅ **零真写** |
| **2 枚 `BEFORE UPDATE` 触发器** | ① `trg_app_config_key_immutable`（`platform_config_key_immutable('key')` · `tgenabled=O`）② `trg_app_config_touch_updated`（`platform_config_touch_updated` · `tgenabled=O`） | ✅ 在场 |
| `getSystemSettings` 谓词 | `WHERE key = 'system_settings' LIMIT 1`（`database.ts:3982-3992`）⇒ 返回**仅 9 字段** `[allowRegistration, defaultLanguage, emailNotifications, maintenance, maxDailyTasks, pointsPerTask, rewardCooldown, siteDescription, siteName]` | ✅ |
| **数值项读回** | `batt_policy` / `checkin_policy` / `invite_reward_policy` / `mint_burn_policy` / `rating_policy` 数值策略**不在** `getSystemSettings` 9 字段内 ⇒ 经此读口**读不回** ⇒ **`NOT_MEASURED`** | 标注 |
| `getSiteTextOverlay` 三键 | `{role_names:null, site_text_overrides:null, updated_at:null}` ⇒ **三键皆 null** | ✅ |
| `schema_version` | `0027` | ✅ |
| 迁移数 | `migrations_n = 26` | ✅ |

> **触发器 ⇒ 写面纪律**：两枚 `BEFORE UPDATE` ⇒ 严禁「UPDATE + 还原」；本单库面**仅只读**，**零真写**。

---

## §7 L6 报告核（份数 / 行数 / 字节 / 占位 / 锚点）

### 7.1 被检报告（`docs/audit/p9-s1-site-text-overlay.md`）

| 项 | 现取读数 |
|---|---|
| 行数 | **315** |
| 字节 | **33,163 B** |
| 占位符（双下划线）计数 | **0** |
| 探针删除 | §13 记 `rm -f backend-ts/scripts/p9s1-00-selftest-probe.ts backend-ts/scripts/p9s1-00b-live-probe.ts`（仅此两件） |

### 7.2 锚点逐一现取（**全中**）

| 锚点 | 现取原文（节选） | 命中 |
|---|---|---|
| `p8-s5-compliance-gate.ts:73` | `// ★ P9① … adminNav **26 → 28**（+2 键 = siteText / siteTextDesc…` | ✅ |
| `p8-s5-compliance-gate.ts:76` | `const NAV_KEYS_FROZEN = 28;` | ✅ |
| `p8-s2-fee-rebate-gate.ts:186` | `// ★ P9①： adminNav **26 → 28**（+2 键 siteText / siteTextDesc…` | ✅ |
| `p8-s2-fee-rebate-gate.ts:187` | `const NS_KEYS: Record<string, number> = { adminFeeRate: 18, adminWeightMatrix: 21, adminNav: 28 };` | ✅ |
| `i18n-batch-b4a.test.jsx:108` | `const NEW_NS = { adminNav: 28, adminLayout: 5, … }` | ✅ |
| `i18n-batch-b4a.test.jsx:124` | `const B9S1_ADDED_TO_ADMINNAV = 2` | ✅ |
| `frontend/src/locales/zh.json:511-512` | `"siteText": "站点文案"` / `"siteTextDesc": "角色名称与站点标语配置"` | ✅ |
| `backend-ts/src/database.ts:3982-3992` | `static async getSystemSettings(): … WHERE key = 'system_settings' LIMIT 1` | ✅ |

### 7.3 既有报告 `p8-s5-compliance-review.md` 微修量 + 订正痕迹

| 项 | 现取读数 |
|---|---|
| `38648c1` 对该文件 `numstat` | **`14  7`**（+14 / −7） |
| 三处订正痕迹**均在** | ① `§10` 桶 A 本体（`:256` / `:258`）② 合批微修 §10 桶 B + §4(B)（`:295`）③ P9① 收口单 ②（`:297`，含「原文行逐字留痕」+ 就地订正） |

### 7.4 ★ 登记项 ②（逐字登记 · 非缺陷）

> **登记**：被检报告 `docs/audit/p9-s1-site-text-overlay.md` §13（`:307`）称 `docs/audit/p8-s5-compliance-review.md` 为「**` M`**（工作树微修态）… **未提交**」。
>
> **现取事实**：该报告**已随 `38648c1` 入库** —— `git show --numstat 38648c1 -- docs/audit/p8-s5-compliance-review.md` = **`14  7`**（= 该提交**引入量**）；`git status --porcelain docs/audit/p8-s5-compliance-review.md` = **空**（**工作树 clean**，非 ` M`、非 `??`）。
>
> **判定**：被检报告该行**属时点性描述**（**报告写于入库前**）⇒ **非缺陷**。**逐字登记**，**不判负**。

---

## §8 L7 面核（注册点 / 白名单 / 四语键集 / 泄漏 / 错误码）

| 检项 | 现取读数 | 结论 |
|---|---|---|
| **注册点 76 逐 verb** | `{get:32, post:41, put:0, patch:1, delete:2}`（`p8-s6 A2` 逐字）· 逐 verb 之和 = 总数（`A3`）· 缩进注入一条 ⇒ 76→77（`A8` 负对照）· 公开读口 `GET /api/role-names` 在场（`A4`）· 取数 = `getSiteTextOverlay(` 单一真源（`A5`）· 成功面 `sendSuccess`（`A6`）· 基础设施异常映射 `roleNames.get`（`A7`） | ✅ **76** |
| **白名单 9 键** | 见 §3.1；`C1=9` · `C3` 9 键**逐键**过 `AV1` · `C4` 清单外键拒（`legal_keys=9`） | ✅ **9** |
| **四语键集相等** | `adminNav = 28`（`[28,28,28,28]`，`I1`/`H6`）· `adminRoleNames = 11`（`{zh:11,en:11,hk:11,vn:11}`）· `adminSiteText = 40`（`{zh:40,en:40,hk:40,vn:40}`） | ✅ 相等 |
| **六类泄漏 = 0** | 判据 = 六类工程口径（①章节号/条号 ②HTTP 状态码 ③接口路径/方法 ④内部批次名/单号 ⑤机读码/裸 i18n 键 ⑥表名/列名/函数名）× 四语 × 五处新文案面 ⇒ `H5 actual = []`（**0**）；`H5` 自证项转红自证 | ✅ **0** |
| **错误码 33 未动** | `J1 = 33`（`L7_facets.json`：`ledger_error_codes_len=33` · `ledger_error_table_len=33`） | ✅ **33** |
| **reason 常量 = 3** | `J2 = ["SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST","SETTING_VALUE_NOT_OBJECT","SETTING_TYPE_INVALID"]`（`settings_write_reasons_len=3`） | ✅ **3** |

- **三处冻结同步现取**：`I2` `p8-s5` `NAV_KEYS_FROZEN=28` · `I3` `p8-s2` `NS_KEYS.adminNav=28` · `I4` `b4a` `NEW_NS.adminNav=28`；`I5` 旧值 `26` **零残留**。
- **覆盖层失败码 ⊆ 既有 §14 闭集**：`J3 = ["LEDGER_AMOUNT_INVALID"]`（**零新增码**）。

---

## §9 L8 未测项 + verdict

### 9.1 未测项（逐项 · 原因）

1. **数值策略键（`batt_policy` / `checkin_policy` / `invite_reward_policy` / `mint_burn_policy` / `rating_policy`）的真实库值读回** —— **原因**：`getSystemSettings` 谓词 `WHERE key='system_settings'` 仅返回 9 字段，数值策略**不在此读口内**；且本单**零真写 / 零 apply 迁移**，无合法读口 ⇒ **`NOT_MEASURED`**（非 `0`、非空）。
2. **覆盖层数据的真实库落库 / 读回端到端**（`role_names` / `site_text_overrides` 各 **0 行**）—— **原因**：被检面为**规则层 + 读侧解析**实现；库内两键**空表**，端到端落库需真写（本单禁止）；写侧已由 `L2_cover_backend.json` 的 `AV2`–`AV4` **规约级**覆盖，读侧已由 C 组 fail-closed 覆盖 ⇒ 真库端到端**未测**。
3. **后台页 `SiteTextPage.jsx` 的真实浏览器渲染 / 交互**（保存按钮流转 / 四语表格渲染）—— **原因**：本单**不启实例**（无需）；L3 为**构件级**（自写探针 bundle），非浏览器端到端 ⇒ 真实渲染**未测**。
4. **公开读口在真实运行实例的并发 / 缓存 / 限流面** —— **原因**：L2 HTTP 双证为**受控实例**单次读（`L2_http.txt`），非压测面 ⇒ 并发面**未测**。
5. **`18f2695` 之后的推送 / 远端一致性** —— **原因**：硬口径禁 `git push`；被检面 `38648c1` **本地未推** ⇒ 远端**未测**（本单不判）。

### 9.2 verdict

**verdict = PASS。**

- 所有**承重腿**（L1–L7）**全绿**；核心承重面（L2）经**双证**（写侧规约 + HTTP）与**两路独立反向判负**（三变异全红、复原 64/64、主仓零写 `MAIN_ZERO_WRITE: OK`）验证。
- **唯一登记项**（§7.4）为**时点性描述**，**非缺陷**。
- **未测项**（§9.1）**逐项列明原因**，无 `0` / 空填充。

---

## §10 收尾（副本回收 / 端口 / `git status` 首尾）

### 10.1 回收两副本

| 副本 | 手法 | 现取结果 |
|---|---|---|
| `scratch/qaP9s1`（**worktree** @ `38648c1`） | 先删内部 node_modules 软链（`frontend/node_modules` + `backend-ts/node_modules`，指向主仓）⇒ `git worktree remove --force` | `rc=0`；目录消失（`ls: qaP9s1: No such file or directory`） |
| `scratch/qa9s1-mut`（**rsync 普通副本** · 变异用） | `rm -rf` | `rc=0`；目录消失（`ls: qa9s1-mut: No such file or directory`） |

- **`.env.local` 软链**：随 worktree 目录一并移除（**未打印内容 / 密钥**）。

### 10.2 端口

- `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**（`rc=1`，**无输出**）。⇒ 本单（及前单）实例**已全回收**；`5787/5788` **未触碰**（外部 PID）。

### 10.3 剩余 worktree 列表（**仅登记** · 均非本单）

```
/Users/kevin/bistro/seafood                                      18f2695 [main]
/Users/kevin/.hermes/profiles/zang/cache/scratch/p7d-neg         f0bd336 (detached HEAD)
/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-p7a-09362ad  09362ad (detached HEAD)
/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-p7a-final    ae46297 (detached HEAD)
/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-p7b          39d89b3 (detached HEAD)
```

- `qaP9s1` **已移除**（不再列）；余 4 条为**历史质检 worktree**（P7 族），**非本单产物** ⇒ **仅登记，不动**。

### 10.4 末次 `git status --porcelain`（**83 行** · 逐条归因）

**结构**：` M` = **1** 行；`??` = **82** 行。

**桶 1 · 历史产物漂移（非本单源码面 · 未触碰）· 1 行**：

```
 M backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json
```

**桶 2 · 硬门运行产物（`??` · 非源码面 · 未触碰）· 77 行**：

- `?? backend-ts/.p4-artifacts/p6tr1a-*` —— **11** 件（P6 翻译面产物）
- `?? backend-ts/.p8s1-artifacts/*` —— **12** 件
- `?? backend-ts/.p8s2-artifacts/*` —— **13** 件
- `?? backend-ts/.p8s3-artifacts/*` —— **13** 件
- `?? backend-ts/.p8s3b-artifacts/*` —— **13** 件
- `?? backend-ts/.p8s4-artifacts/*` —— **9** 件
- `?? backend-ts/.p8s5-artifacts/*` —— **5** 件
- `?? backend-ts/.p8s6-artifacts/` —— **1** 件
- 小计 = `11+12+13+13+13+9+5+1` = **77** 件

**桶 3 · 本单质检产物（`??` · 未触碰被检件）· 4 行**：

- `?? backend-ts/.p9s1qa-artifacts/` —— **1** 行（本单 L1/L2/L5/L7 读数落盘目录）
- `?? backend-ts/scripts/p8-s5-00-recon{,2,3}.ts` —— **3** 行（8⑤ 临时侦察 3 件）

- **归因总数核对**：`1（桶1）+ 77（桶2）+ 1（p9s1qa）+ 3（recon） + 1（本报告）` = **83** ✅（其中 `??` = 82、` M` = 1）。
- **本报告自身**：`?? docs/qa/p9-s1-site-text-overlay-qa.md`（**本单唯一新建**）。
- **被检件未动**：代码 / 被检报告 / 规范**零改动**；`docs/audit/` 下**无新增 ` M`**（`p8-s5-compliance-review.md` 现取 **clean**，见 §7.4）。

---

*—— 报告完（本报告 = P9① 终审质检读数回填 + 时点性描述登记 + 副本收尾；本单零门重跑 / 零代码改动 / 零迁移 / 零 apply / 零 commit / 零实例）。*
