# 批 8 首轮契约冻结（route-layer v2.2 + data-layer v0.10）· 独立规范质检报告

- **单号 / 角色**：**质检单 = 批 8 规范质检** · **Neng（质检 · 只读）**
- **被检提交**：**`7f62c98`**（其父 = `9590659`；本报告回填时 `HEAD = 664401a`）
- **被检物（7 件）**：`docs/route-layer.spec.md`（v2.2）+ `docs/data-layer.spec.md`（v0.10）+ `docs/versions/route-layer.spec.v2.2.md` + `docs/versions/data-layer.spec.v0.10.md` + `docs/versions/data-layer.spec.v0.9.md`（补建）+ `docs/audit/route-layer-v2.2-delta.md` + `docs/audit/data-layer-v0.10-delta.md`
- **本单红线（自证）**：**未改任何 spec / 快照 / delta / 代码 / 迁移 / `master-plan`**；**未 `git add/commit/push`**；**未 `npm install`**；**未碰 / 未打印 `.env*`**；**未用 `pkill -f` / `killall`**；**未启停 5787 / 5788**；**未连库、未起实例、零 HTTP**；产物**只落 `docs/qa/**`**（报告 + `docs/qa/p8-spec-artifacts/`，全为 run-tagged `.txt` / `.json`，**无 `.log`**）。
- **★ 取证口径（写死）**：**所有代码 / 迁移行锚一律对 `7f62c98` 的 blob 现取复核**（命令 `git show 7f62c98:<path>`），**不采信工作树** —— 理由见 §1.2（本单质检期间**并发实现单元正在实时改工作树**）。

---

## §0 结论与 verdict

**verdict = 有条件通过（PASS WITH FINDINGS）**：**机器判据全绿，条文与真源逐字对拍基本成立；有 1 条引用锚缺陷（D-1）+ 3 条门禁覆盖性发现（D-2/D-3/D-4），均不影响「只追加 / 十一键 / §17.5 相容」三项核心判据；L3 三条裁定中 1 条已一致、2 条因裁定晚于本提交而尚未落位（按派单只登记、不改 spec）。**

| 层 | 判据 | 结果 | 关键读数 |
|---|---|---|---|
| **L1** | 只追加自证（numstat / difflib / 快照 / 旧快照） | **PASS** | 两册删除列 = 0；`replace` = `delete` = 0；两件改后快照 `cmp` = 0；旧快照 **21 + 8** 零改动 |
| **L2(a)** | 十一权限键 ↔ 三真源逐字 | **PASS**（+1 引用锚缺陷 D-1） | 三源 11/11 **同序逐字相等** |
| **L2(b)** | `AG1`–`AG4` ↔ 真实缺口 | **部分 PASS**（D-2 / D-3 / D-4） | AG1 ✓、AG3② ✓；**AG2 无现取落点**、**AG4 与 AG1 同点**、**AG3① 经本路由不可达** |
| **L2(c)** | §17.5 判据 ↔ `0023` / `0024` 真实列 | **PASS**（+2 条呈现层观察 O-1 / O-2） | `txid` 两表可空、`result` 闭集引文逐字相符、拒绝行 `txid=NULL` 为真 |
| **L3** | 三条裁定执行一致性 | **1 / 3 一致**（R-8-8 ✓；R-8-7 / R-8-9 **未落位**，登记不改） | 见 §6 |
| **L4** | 零发明与范围 | **PASS** | 53 条 `file:line` 引用 **0 未解析**；迁移简写引用 **0 错**；日期仅 2 个且均可溯源；**提交面 = 7 件** |
| **L5** | 未验证清单 | **逐项给原因**（§9，10 项） | **无 0 / 无空**（库面 / 判负实跑 / HTTP 面一律 `NOT_MEASURED`） |

---

## §1 开工锚与现取读数

### 1.1 被检提交面（现取）

```
$ git show --stat 7f62c98
 docs/audit/data-layer-v0.10-delta.md   |   65 +
 docs/audit/route-layer-v2.2-delta.md   |   58 +
 docs/data-layer.spec.md                |  104 +
 docs/route-layer.spec.md               |  190 ++
 docs/versions/data-layer.spec.v0.10.md | 1174 ++++++++++
 docs/versions/data-layer.spec.v0.9.md  | 1070 +++++++++
 docs/versions/route-layer.spec.v2.2.md | 4030 ++++++++++++++++++++++++++++++++
 7 files changed, 6691 insertions(+)
```

**提交面 = 恰好 7 件、`6691 insertions(+)`、`0 deletions`** ⇒ 未触碰其它 spec / 代码 / 迁移 / `master-plan` / 既有 audit·qa·design（`git diff --name-only 7f62c98^ 7f62c98` 现取 = 上述 7 条，无第 8 条）。

### 1.2 ★ 并发漂移警告（本单必须登记的环境事实）

- **开工时**（本单第 1 条命令）`git status --porcelain` = **空**（工作树 clean）。
- **质检期间**（约 22:00）`git status --porcelain` 现取 = **`M backend-ts/src/database.ts`**（`git diff --stat` 由 `+44` 起、复测时已 **`+197 / −5`**）⇒ 随后又出现 **`M backend-ts/src/index.ts`**、**`M frontend/src/pages/market/MarketPage.jsx`**、**`?? docs/audit/p8-s1-app-config.md`** ⇒ **并发单元（批 8① 实现单）正在实时改工作树**。
- **处置（写死）**：① 本报告**全部**代码 / 迁移行锚 = **对 `7f62c98` blob 现取复核**（§3 / §4 / §5 的读数因此与工作树漂移无关）；② 工作树读数**只用于范围核对**（§7.2）；③ `database.ts` blob 现取 = **3895 行**（与 spec 开工时点一致），质检末尾工作树 = **4082 行**（漂移 **+187**）⇒ 验证时点已声明。
- **与 spec 自曝的关系**：`route-layer.spec` **§17.7-1** 逐字已预登记「**注册点 / `index.ts` 行的开工时点现取**……**若并发单元改了 `src/index.ts` ⇒ 该读数作废**」⇒ 该自曝**成立且已被现实验证**（漂移确实发生，只是先落在 `database.ts`）。

### 1.3 两册开工锚（现取复核）

| 项 | 命令 | 读数 |
|---|---|---|
| 改前正文（route v2.1） | `git show 7f62c98^:docs/route-layer.spec.md \| md5` / `wc` | **3840 行 / 828530 B / md5 `3f261af960e3dd4a15ba1b08c3a0eed0`**（= spec §17.1 / delta §D0 自报**逐字相符** ✅） |
| 改前正文（data v0.9） | `git show 7f62c98^:docs/data-layer.spec.md \| md5` | **1070 行 / 284069 B / md5 `f63fffad343e0591934d00ba129c8683`**（= §21.0 / delta §D0 自报**逐字相符** ✅） |
| 改后正文（route v2.2） | `md5 -q` / `wc` | **4030 行 / 866484 B / md5 `55123bd0520d619621d5a66afab3e77b`** |
| 改后正文（data v0.10） | `md5 -q` / `wc` | **1174 行 / 309965 B / md5 `614a39ec40e8a874945a97456e1d1bef`** |
| `DL` 编号域 | `grep -cE "^\| \*\*DL[0-9]+"` 与其去重计数 | **157 / 157**（**未新增 `DL` 条** ✅，与 delta §D2 自报一致） |
| 注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68**（**本单独立现取** ✅；`index.ts` blob = **2060 行**，与 §5.179 E 的现取一致） |

> **说明**：`route-layer.spec` §17.1 把注册点 68 标为**转引**（`p8-p6-recon.md §0`）并登记 `NOT_MEASURED`（未重跑）；**本单已独立现取 = 68**，可作为该转引的旁证（但见 §1.2：实现单落盘后该读数将漂移）。

---

## §2 L1 只追加自证（机器判据）

原始产物：`docs/qa/p8-spec-artifacts/l1-append-only-20261002T220054Z.txt`、`l1-difflib-20261002T215717.txt`

### 2.1 `git diff --numstat`（删除列必须 = 0）

```
$ git diff --numstat 7f62c98^ 7f62c98
65      0       docs/audit/data-layer-v0.10-delta.md
58      0       docs/audit/route-layer-v2.2-delta.md
104     0       docs/data-layer.spec.md
190     0       docs/route-layer.spec.md
1174    0       docs/versions/data-layer.spec.v0.10.md
1070    0       docs/versions/data-layer.spec.v0.9.md
4030    0       docs/versions/route-layer.spec.v2.2.md
```

**7 件全部删除列 = 0**（含两册正文：`190 0` / `104 0`）⇒ **PASS**。

### 2.2 `difflib.SequenceMatcher` 逐行 opcode 普查（只允许 `equal` + `insert`）

| 文件 | 改前行 → 改后行 | opcodes | `replace` | `delete` | 删除行数 | 判定 |
|---|---|---|---|---|---|---|
| `docs/route-layer.spec.md` | 3840 → 4030 | `['equal','insert'] × 5` | **0** | **0** | **0** | **PASS** |
| `docs/data-layer.spec.md` | 1070 → 1174 | `['equal','insert'] × 2` | **0** | **0** | **0** | **PASS** |

- **复核口径**：`autojunk=False`；输入 = `git show 7f62c98^:<path>` 与 `git show 7f62c98:<path>` 的**行序列**（`splitlines(keepends=True)`）。
- **与 delta 自报的一致性**：`route-layer-v2.2-delta.md §D0` 自报 opcodes = `['equal','insert','equal','insert','equal','insert','equal','insert','equal','insert']` ⇒ **与本单独立复跑逐项相同** ✅；`data-layer-v0.10-delta.md §D0` 自报 `['equal','insert','equal','insert']` ⇒ **相同** ✅。
- 两时点 blob 指纹（独立复核）：route `sha256(old)=4638eb31…` / `sha256(new)=1250f59d…`；data `sha256(old)=a6d2a1f6…` / `sha256(new)=07c44146…`。

### 2.3 改后快照 ↔ 本册正文（`cmp` 必须 = 0）

```
$ cmp docs/versions/route-layer.spec.v2.2.md docs/route-layer.spec.md   # 退出码 0（IDENTICAL）
$ cmp docs/versions/data-layer.spec.v0.10.md docs/data-layer.spec.md    # 退出码 0（IDENTICAL）
```

⇒ **两件改后快照与正文逐字节相同**（md5 分别为 `55123bd0…` / `614a39ec…`，与 §1.3 同值）⇒ **PASS**。

### 2.4 改前快照可独立复核（两册各自口径不同，均现取验证）

| 册 | 「改前正文」承担件 | `cmp <(git show 7f62c98^:<path>) <快照>` | md5 |
|---|---|---|---|
| route（约定 = 快照取**新**版本号） | `docs/versions/route-layer.spec.v2.1.md`（**开工前既存，本单未动**） | **退出码 0** | `3f261af960e3dd4a15ba1b08c3a0eed0` |
| data（约定 = 快照取**改前**版本号） | `docs/versions/data-layer.spec.v0.9.md`（**本单补建**） | **退出码 0** | `f63fffad343e0591934d00ba129c8683` |

⇒ **改前正文可独立复核**；`data-layer` v0.9 补建件**内容 = `7f62c98^` 正文逐字节**（不是「声称补建」）⇒ **PASS**。**补建动因**（delta §D0 自曝）也已核实：`7f62c98^` 时点 `docs/versions/` 内 data 最新 = `v0.8.md`，**v0.9 确无快照**。

### 2.5 旧快照零改动（逐一现取）

```
$ git ls-tree 7f62c98^ docs/versions/ | grep -c "route-layer.spec.v"   # 21
$ git ls-tree 7f62c98^ docs/versions/ | grep -c "data-layer.spec.v"    # 8
$ git diff --name-status 7f62c98^ 7f62c98 -- docs/versions/
A  docs/versions/data-layer.spec.v0.10.md
A  docs/versions/data-layer.spec.v0.9.md
A  docs/versions/route-layer.spec.v2.2.md
```

- **route 旧快照 = 21 个**（`v0.1`…`v2.1`）、**data 旧快照 = 8 个**（`v0.1`…`v0.8`）⇒ 与派单给定（21 / 8）**逐数相符** ✅。
- `name-status` 现取 = **仅 3 个 `A`**（新增），**`M` = 0 / `D` = 0** ⇒ **旧快照一字未动**，**只允许新增的三件**（`route v2.2` / `data v0.9` / `data v0.10`）⇒ **PASS**。
- `route-layer.spec` §8.24.5-④ 自报「v0.1–v2.1 **二十一**个快照一字未动」、data delta §D0 自报「只有本单**新建**的 `?? v0.9.md` / `?? v0.10.md`」⇒ **均与现取相符**。

**§2 小结：L1 六项判据全绿。**

---

## §3 L2(a) 十一权限键 ↔ 三真源逐字对拍

原始产物：`docs/qa/p8-spec-artifacts/l2a-eleven-keys-20261002T220054Z.json`

### 3.1 三源逐键对拍表（**逐键 · 逐序**）

| # | spec §17.2(a) 逐字 | 真源 A `database.ts:12-22`（数组体；声明 `:11` / `] as const` `:23`） | 真源 B `0022:51-61`（`INSERT…VALUES` 在 `:50`） | 真源 C `admin-utils.js:41-51`（`permissions: [` `:40` / `],` `:52`） | 差异 |
|--:|---|---|---|---|---|
| 1 | `dashboard_access` | `dashboard_access` | `dashboard_access` | `dashboard_access` | **无** |
| 2 | `manage_tasks` | `manage_tasks` | `manage_tasks` | `manage_tasks` | **无** |
| 3 | `publish_tasks` | `publish_tasks` | `publish_tasks` | `publish_tasks` | **无** |
| 4 | `manage_rewards` | `manage_rewards` | `manage_rewards` | `manage_rewards` | **无** |
| 5 | `publish_prizes` | `publish_prizes` | `publish_prizes` | `publish_prizes` | **无** |
| 6 | `read_users` | `read_users` | `read_users` | `read_users` | **无** |
| 7 | `manage_users` | `manage_users` | `manage_users` | `manage_users` | **无** |
| 8 | `manage_points` | `manage_points` | `manage_points` | `manage_points` | **无** |
| 9 | `manage_permissions` | `manage_permissions` | `manage_permissions` | `manage_permissions` | **无** |
| 10 | `manage_settings` | `manage_settings` | `manage_settings` | `manage_settings` | **无** |
| 11 | `review_tasks` | `review_tasks` | `review_tasks` | `review_tasks` | **无** |

**机器判据（本单独立复跑）**：`A==B = true`、`A==C = true`、`B==C = true`、**`all_equal_spec_order = true`**、`count = 11`。
**⇒ 三真源 11/11 键名 + 顺序 + 逐字全等，且与 spec §17.2(a) 的列举逐字一致。**

> **口径说明（非缺陷）**：spec §17.2(a) 的**引文区间**是「包住键行的块」而非「键行本身」—— `0022:50-61` 含 `INSERT` 语句行（键行在 `:51-61`）；`admin-utils.js:40-52` 含 `permissions: [` / `],`（键行在 `:41-51`）；`database.ts:11-23` 含 `const` / `] as const`（键行在 `:12-22`）。**三者都完整覆盖 11 键、无遗漏无多余** ⇒ 属**区间写法**差异，登记为 O-4，不判缺陷。

### 3.2 三源一致性的**独立旁证**（未采信转引）

- spec §17.2(a) 把「三真源逐键相等」标为**转引** `docs/audit/p6-b6-perm-seed.md §5-④`（`all_three_equal=true`）并登记 `NOT_MEASURED`（未复跑）。**本单不复跑该工具的 `all_three_equal` 判据**，而是**直接现取三源文本逐键建表比对** ⇒ 结论相同（见 §3.1），且**独立于被检物**。
- **apply-time 自检现取**（spec 引 `0022:112-132`）：`DO $$` 块起于 `:106`；① 段「`SELECT count(*)`（`:112`）⇒ `<> 11` 即 `RAISE`（`:113-115`）」+「缺键 ⇒ `RAISE`（`:123-125`）」+「多余键 ⇒ `RAISE`（`:126-132`）」⇒ **spec 的 `:112-132` 与真源区块吻合** ✅（该自检的**语义** = 「多 / 少任一键 ⇒ 整迁移回滚」，与 spec 表述一致）。
- **`0022:48` 自述「逐键来自 src/database.ts:12-22」**，spec 引 `database.ts:11-23` —— 指同一 11 键，属**表述口径差**（登记 O-5），**不构成矛盾**。

### 3.3 ★ 发现 **D-1（中）**：「`§12.1.1:3042` 逐字引文」= **行锚错 + 非逐字**

spec 在**三处**逐字引「先例 = **本册 §12.1.1:3042** 逐字：新权限键须 **4 处同批改**」（`route-layer.spec.md:1798`、`:3922`、`:4030`）。现取核：

```
$ sed -n '3042p' docs/route-layer.spec.md           # 输出为空行
$ sed -n '3040,3044p' docs/route-layer.spec.md      # :3040 空 / :3041 "**C · 审计面真值…**" / :3042 空 / :3043 表头
$ grep -n "处同批改" docs/route-layer.spec.md        # 仅命中 1798 / 3922 / 4030（全为 v2.2 自身新增行）
$ grep -n "^#### 12.1.1" docs/route-layer.spec.md    # 3080
$ sed -n '3096,3097p' ...                            # "「若 Zang 认为应改为新键 ⇒ 代价（不可在本批做）」：新键须 ① 新迁移 ② database.ts:11-23 加键 ③ admin-utils.js:40-52 加键 ④ 0022 apply-time 自检必须同批改"
```

- **① 行锚错**：`§12.1.1` 小节头在 **`:3080`**；「4 处」内容实际在 **`:3096-3097`**；**`:3042` 是空行**（且 `§12.1.1` 前的 `:3036-3039` 是**另一张表**的行）⇒ 引文锚点不可定位。
- **② 引号内文案非逐字**：`§12.1.1` 原文为**四段枚举**（① 新迁移 → ② 真源常量加键 → ③ 前端兜底加键 → ④ `0022` apply-time 自检必须同批改），**并无「新权限键须 4 处同批改」这一句** ⇒ 引号包裹**转述**，违反「逐字引」的可核性口径。
- **实质结论不变**（4 处同批改 = `database.ts:11-23` / `0022` 种子 / `admin-utils.js:40-52` / 消费点，与 §12.1.1 的枚举语义**一致**）⇒ **属引证卫生缺陷，非条文错误**；建议落位时把锚改为 `§12.1.1:3096`（或 `§12.1.1` 节头）并去掉「逐字」或补逐字原文。**（本单只登记、不改）**

---

## §4 L2(b) 门禁 `AG1`–`AG4` ↔ `normalizeSystemSettings` 真实缺口

原始产物：`docs/qa/p8-spec-artifacts/l2b-ag-vs-gap-20261002T220054Z.txt`

### 4.1 现行写路径**逐字**（真源现取，blob = `7f62c98`）

```
:664  const normalizeSystemSettings = (value: unknown): SystemSettingsRecord => {
:665    const payload = value && typeof value === 'object' ? value as RawRow : {};
:667-675  siteName/siteDescription/maintenance/allowRegistration/emailNotifications/
          defaultLanguage/pointsPerTask/maxDailyTasks/rewardCooldown
          = 各自 toStringValue|toBooleanValue|toNumberValue( getValue(payload, '<field>'),
                                                           DEFAULT_SYSTEM_SETTINGS.<field> )
:676  };

:2878  static async saveSystemSettings(input: Partial<SystemSettingsRecord>, updatedBy = 0) {
:2879    const current = await this.getSystemSettings();
:2880    const next = normalizeSystemSettings({ ...current, ...(input || {}) });
:2887-2888  INSERT INTO public.app_config (key, value, updated_by, time_updated)
            VALUES ('system_settings', <JSON.stringify(next)>::jsonb, <uid>::bigint, NOW())
            ON CONFLICT (key) DO UPDATE SET …
```

**先删后建（关键）**：`:665` 支持 `typeof value !== 'object'` ⇒ 裸标量被**静默换成 `{}`**；`:667-675` 只取**白名单 9 字段**、其余 object 成员**不读不报**；类型 helpers（`:106-139`）**强转 / 回落默认**而非报错。⇒ **「未知键静默丢弃、类型不符静默强转、无逐键白名单」的现取缺口成立**。

### 4.2 四条规则 ↔ 缺口 逐条判定（派单口径：**无对应缺口 ⇒ 报「过度规制 / 无落点」**）

| 条目 | spec 规则 | 现取缺口（真源） | 判定 |
|---|---|---|---|
| **`AG1`** | **未知键 ⇒ 拒** | ✅ **真实**：请求体任何非白名单键被 `:665`/`:667-675` **静默丢弃**（`payload` 只按名取 9 字段）；`AG1` 期望 `400 + details.unknown_keys` 正是治它 | **有落点** ✓ |
| **`AG2`** | **越权面 ⇒ 拒**（写 `app_config` 只允许落在 `saveSystemSettings` 一处） | ❌ **无现取缺口**：`git grep -nE 'INSERT INTO public\.app_config\|UPDATE public\.app_config\|DELETE FROM public\.app_config' 7f62c98 -- backend-ts/src/` 现取 = **恰 1 处**（`database.ts:2887`）；`resetSystemSettings`（`:2899`）只调 `saveSystemSettings`，**不是第二条写路径** | **★ 无对应静默吸收点 ⇒ 报「无落点 / 预防性不变量」**（其价值 = 防回归的**类级约束**，spec 自己也写明「现取 = 1 处」；但按派单口径**不构成一条「被门禁治住的现取缺口」**） |
| **`AG3`** | **类型不符 ⇒ 拒** | ⚠️ **① 无当前落点 / ② 有落点** | **部分有落点** |
| `AG3`① | `value` 传裸标量 ⇒ DB `23514` ⇒ 转译 `400` | DB 约束**真实存在**（`0017:77` `CHECK (jsonb_typeof(value) IN ('object','array'))`；`0017:323-324` apply-time 自检以 `'0'::jsonb` 触发 `check_violation`）—— **但经唯一写口不可达**：`:2880` 恒以 `{...current, ...input}` 构造对象 ⇒ `JSON.stringify(object)` **永不产出裸标量** | **★ 经本路由不可达 ⇒ 「防直连 / 防未来」型条款，非现取缺口** |
| `AG3`② | 9 字段类型不符 ⇒ `400 + SETTING_TYPE_INVALID` | ✅ **真实**：`toNumberValue`（`:120-127`）取 `Number(v)` 非有限即**跳过 ⇒ 回落 `DEFAULT`**（`pointsPerTask:"abc"` ⇒ 静默 `100`）；`toBooleanValue`（`:130-139`）把 `1` **强转** `true`（`typeof number ⇒ value !== 0`）；`toStringValue`（`:106-113`）**`String(v)` 强转**（`siteName: 123 ⇒ "123"`） | **有落点** ✓ |
| **`AG4`** | **不得静默放行（元规则）** | ✅ 缺口同上（`AG1` / `AG3`② 的**同一**静默吸收点） | **有落点，但 = 元规则、与 `AG1` 判负用例重叠**（`AG1` 判据「HTTP 400 + `unknown_keys` 非空 + 合法字段不得落库」与 `AG4` 的三条判据**同点**）⇒ **非独立缺口** |

### 4.3 §4 结论

- **四条规则中 = 2 条有独立真实缺口（`AG1` / `AG3`②）**、**1 条无现取落点（`AG2`）**、**1 条无独立落点（`AG4` 元规则，与 `AG1` 同点）**、**1 条经本路由不可达（`AG3`①）**。
- **是否为「过度规制」**：**均非凭空立法** —— 每条的**真源对象**都真实存在（`AG1`/`AG3`② 治静默吸收；`AG2` 的 **1 处写路径**与「唯一入口」不变量可复算；`AG3`① 的 DB CHECK 与自检**逐字可引**）。**但按派单「是否分别对应一个真实静默吸收点」的口径，`AG2` 与 `AG4` 不满足「各有独立落点」** ⇒ 判为 **D-2 / D-4**，**建议**：`AG2` 明确标注「**类级不变量 / 防回归**（现取无违反）」、`AG4` 标注「**元规则**（判负用例与 `AG1` 合并）」。
- **★ 连带发现 O-3**：`ops:` 幂等键在 `index.ts:1147` **写死键名** `'system_settings'`（`resolveAdminOpsKey(req, uid, 'setting', 'system_settings')`）⇒ **新增第二个合法键（如 §17.4 的载体键）时，其 `ops:` 键仍落在同一命名空间**；`§17.3` / `AR2` / `AG1`–`AG4` **均未覆盖**「跨键幂等键须按目标键分化」这一面（`AG2` 只约束「写语句落点」，不约束「键名字面」）。

---

## §5 L2(c) §17.5 判据 ↔ `0023` / `0024` 真实列形状

原始产物：`docs/qa/p8-spec-artifacts/l2c-tables-20261002T220054Z.txt`

### 5.1 真表列形状（现取 · 逐列）

| 面 | `0023 admin_ops_audit_log` | `0024 admin_refund_audit_log` |
|---|---|---|
| 建表行 | `0023:64` | `0024:48` |
| 列集（self-check 断言逐字） | `log_id, actor_uid, action, target_uid, cid, op, amount, balance_before, balance_after, request_fingerprint, idempotency_key, result, txid, memo, time_created`（`:301`，**15 列**） | `log_id, actor_uid, order_id, seller_uid, buyer_uid, cid, amount, result, txid, idempotency_key, request_fingerprint, memo, time_created`（`:268`，**13 列**） |
| **`txid`** | `:79  txid bigint,`（**可空**）注释逐字「依据账本回执 `txid`（**成功时；拒绝行 = NULL**）」 | `:57  txid bigint,`（**可空**）注释逐字「照抄 `0023:79`（账本回执 txid；**拒绝行 = NULL**）」 |
| **`result` 闭集** | `:89  CHECK (result IN ('applied', 'rejected_daily_cap'))`；注释 `:108` 逐字「`rejected_daily_cap` …… **零资金分录**、`balance_before`/`balance_after`/`txid` 皆 NULL、`memo=OVER_MAX_DAILY_AMOUNT`」 | `:68  CHECK (result IN ('applied', 'rejected_state'))`；注释 `:79` 逐字「`rejected_state` = …… **零资金分录**、`txid=NULL`、`memo=reason`。**闸前拒绝（401/403）与 404/400 一律不写本表**」 |
| 成功行 `txid` 来源 | `:249  v_txid := v_ledger->>'txid';` → `:265  …… 'applied', v_txid::bigint, v_reason`（**同一函数 / 同一语句**内） | `:205  v_txid := v_ledger->>'txid';` → `:232  …… 'applied', v_txid::bigint, …`（同一函数 / 同一语句内） |
| 拒绝行 `txid` 来源 | 拒绝分支自带 `OFFSET`——`:108` 注释「拒绝行 `txid` 皆 NULL」（成功分支**只在 `NOT v_replay` 时写**，`:258-265`） | **代码级写死**：`:185  …… 'rejected_state', NULL, v_key, v_fp, v_reason` ⇒ **显式 `NULL`** |
| `ledger_entry.txid` 真身 | `0001:56  txid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` ⇒ 与审计表 `txid` **同域（bigint 标识）** | 同 |

### 5.2 两条判据的相容性判定

| 判据 | spec §17.5 写法 | 与真表相容性 |
|---|---|---|
| **① 每条 admin 动作锚 `ledger_entry.txid`** | 「凡有资金移动的 admin 动作，其审计行的 `txid` 必须与 `ledger_entry` 的对应行逐字相同」+ 只对 `result='applied'` 生效 | **相容** ✅ —— 两表 `applied` 行的 `txid` 均**取自同一函数内 `ledger_post_event` 回执**（`0023:249/265`、`0024:205/232`），`ledger_entry.txid` = 身份 PK（`0001:56`），域一致；「反向孤儿」判据（applied 行 `txid` 查无此钱）**可判负、可复算** |
| **② 拒绝行 `txid = NULL` 豁免** | 「`result='rejected_*'` 的行允许 `txid` 为 `NULL`（拒绝 = 零资金分录）」 | **相容** ✅ 且**被真表证实**——`0023:79`/`:108` 注释逐字「拒绝行 = NULL / `balance_before`/`balance_after`/`txid` 皆 NULL」；`0024:57`/`:79` 同款；`0024:185` **代码显式写 `NULL`** ⇒ 豁免**不是发明**，是**真表既有语义**（spec 自己也把该边界的依据逐字引到 `0023:79` / `:108` / `:196` + `0024:57` / `:79`，**全部核对无误**） |

**引文逐条核对（§17.5 引用的每一条都现取命中）**：`0023:64`（表）✓、`0023:79`（`txid`）✓、`0023:108`（`result` 注释）✓、`0023:196`（「拒绝尝试的审计行与成功行同形」）✓、`0023:249` / `:265`✓、`0024:48`（表）✓、`0024:57`（`txid`）✓、`0024:79`（`result` 闭集语义）✓ —— **0 处引文落空**。

**§5 结论：`§17.5` 的两条核心判据与 `0023` / `0024` 真表 `相容`（不相容项 = 0）。** 仅两条**呈现层**观察：

- **O-1（呈现映射不完备）**：§17.5(b) 的「统一行形状」列集含「**动作**」，但 **`0024` 表既无 `action` 也无 `op` 列**（列集见 §5.1）；反之 `0023` 的 `op`（`mint`/`burn`）**不在**统一形状列里。⇒ 「动作」对 `0024` 只能**派生**，而**派生规则未写死**（不相容项 = 0，但呈现层需补一条映射规则；同理 `request_fingerprint` / `order_id` 亦未入统一形状）。
- **O-2（正向孤儿的算子缺封闭判据）**：§17.5(c)-2 以「`kind` 属 **admin 面**」为算子，而 `ledger_entry.kind` 是 **20 值闭集**（`0003:60-69`），其中 `mint` / `burn` / `transfer` **同时被非 admin 面使用**（`0019` 的平台账户白名单把 uid `0/-1` 的 credit 族含 `mint` / `transfer` / `reversal`）⇒ **单靠 `kind` 无法判定「该行由 admin 动作产生」**。建议把算子写成**联合键**（`kind` ∈ {`mint`,`burn`,`purchase_refund`} **且** `idempotency_key` 前缀 ∈ {`ops:`,`biz:listing:refund:`} 或 `ref_type/ref_id`），否则「正向孤儿」判据**不可判定**（这一条属**判据可执行性**，不影响与真表的列相容性）。

---

## §6 L3 三条裁定（R-8-7 / R-8-8 / R-8-9）执行一致性

裁定原文 = `docs/seafood.master-plan.md` §5.180 C（`:1433-1435`）。被检提交 `7f62c98` 的**父** = `9590659`（R-8-1..6），**三条裁定出自其后一提交 `664401a`** ⇒ 「**未落位**」在本案 = **裁定晚于本提交**（属时序，非违约）；按派单**只登记、不改 spec**。

| 裁定 | 裁定要求 | spec 现取（`7f62c98`） | 一致性 |
|---|---|---|---|
| **R-8-8** | 8④⑤ = **确认临时复用 `review_tasks`** | `§17.2(b)`：8④⑤ 行 → **`review_tasks`**（「唯一候选 · **须 Zang 确认**」；`§7-63` 同） | **✅ 一致**（spec 给的值 = 裁定值；状态格仍写「须确认」= 裁定前的措辞，**非矛盾**） |
| **R-8-7** | 8⑦ 审计读口 = **复用 `manage_points`**（并明确**不选** `read_users`；独立只读审计键 ⇒ 跨批） | **未落位**。`§7-62` 状态 = 「★ 待 Zang 裁（**本册停报** · 不硬造）」；**候选（不构成裁定）= `read_users` / `manage_users`**；`§17.2(b)` 8⑦ 行 = 「**★ 无 ⇒ 停报 Zang**」；`§17.5(d)` = 「权限键 = 停报项」；`§17.6 AT-R5` 同 | **⚠️ 不一致（实质）**：spec **只把 `manage_points` 当作 11 键之一列出**（`§7-62` 键表 / `§17.2(a)`），**未在任何 8⑦ 语境下把它作为选键**；且 spec 的候选格里列了裁定**明确排除**的 `read_users`。⇒ **须在下一版把 `§7-62` 状态改「已裁 = `manage_points`」、`§17.2(b)` 8⑦ 行填键、删 `read_users` 候选**（本单**不改**） |
| **R-8-9** | **键名批准 `listing_deposit_policy`**；**由 Jing 在 8③ 冻结时正式入 `AK1` 清单**；**★ 8①/8② 实现单不得先行写入该键**；数值仍待 Kevin | **未落位**。`§17.4` / `data §21.4` 仍写「**候选（不构成裁定 · 供一句话拍板）= `listing_deposit_policy`**」「**键名 = 待 Zang / Kevin 定（本册不发明）**」；**无**「已批准」字样、**无** `AK1` 入册动作、**无**「8①/8② 不得先行写入」的禁止句。现取：`route-layer.spec.md` 全文 **`AK1` 命中 = 0**；`AK1` 仅存在于 `data-layer.spec.md §21.1` + 两件 delta | **⚠️ 未落位（三项子要求全缺）**；另 **切片标签不一致**：R-8-9 用 §5.179 编号称「**8③** 冻结时入 `AK1`」，而 spec `§17.2` 把保证金片标为「**8⑤ 保证金规则**」（口径注里又说 `8⑧` 同物）⇒ 落位时须统一编号，否则「8③ 冻结时入册」在册内**无法直接定位** |

### 6.1 ★ 附：R-8-7 理由句的现取偏差（属**裁定文本**，非 spec 条文缺陷）

R-8-7 理由写「……（**且两条动作路由本就以 `manage_points` 为闸**）」。现取：

| 动作路由 | 闸（现取） | 结论 |
|---|---|---|
| 退款（`POST /api/listing-orders/:orderId/refund`，v1.6 Z1） | `manage_points` | 成立 |
| A1 后台调分（`POST /api/admin/points/adjust`，`index.ts:1472`） | **无键** `requireAdmin`（册内 **`§7-52` 逐字登记**同一事实） | **不成立** |

⇒ 「**两条**动作路由本就以 `manage_points` 为闸」**只对其中一条成立**。**只登记**（供 Zang 判断理由句是否需改字），**不动 spec**。

---

## §7 L4 零发明与范围

原始产物：`docs/qa/p8-spec-artifacts/l4-invention-20261002T220054Z.txt`

### 7.1 引用可解析性（发明检测的机器口径）

| 检查 | 口径 | 读数 |
|---|---|---|
| `file:line` 引用 | 从两册**新增行**抽 `*.ts\|js\|jsx\|sql\|md\|json\|mjs\|cjs : <line>`，逐个在多根目录解析并核对行数 ≥ 引用行 | **total = 53，未解析 = 0**（**无发明路径 / 无越界行号**） |
| 迁移简写引用 | 抽 `00NN:<line>` 形式，核对存在 `00NN_*.sql` 且行数 ≥ 引用行 | **错项 = 0** |
| 迁移文件集 | `ls backend-ts/migrations/` | `0001–0017` + `0019–0024`（**`0018` 无文件** ✅ = 两册自报口径）；`0023 = 391 行` ✅、`0024 = 401 行`、`0022 = 177 行` ✅、`0017 = 454 行` |
| 键名 / 标识符 | 抽两册新增行的**全部 `snake_case` 词元**并逐一归位 | 全部落在**真实标识符**（`app_config` / `ledger_entry` / `commission_policy` / `deposit_amount` / `fee_rate_bp` / `weights_bp` / `rejected_state` / `rejected_daily_cap` / `trg_app_config_*` / `create_key` / `ledger_event_keys` / `0017:323` 的 apply-time 自检键（双下划线包裹的 `p3p_selfcheck`）…）或**本单新立的编号域**（`AK1` / `AG1-4` / `AT1-4` / `AT-R1..R5` / `AR1-4`）—— **无发明键名** |
| 权限键 | 11 键逐字 | 见 §3（三源全等，**无第 12 键、无删除键**） |
| 候选载体键 | `grep -rn "listing_deposit_policy" backend-ts/ frontend/` | **命中 = 0** ⇒ 该名**未进代码**，与「候选、未入册、现写必被拒」自述**一致** ✅ |
| 数值 | `50000`（`currency-service.ts:144`）/ `10000`（`:142`/`:143`）/ `68`（注册点）/ `11`（键数） | **全部现取命中**；`50000` 逐字 = `const CURRENCY_LIST_DEPOSIT_FLOOR = 50000;` ✅；`68` = 本单独立现取 ✅ |
| 日期字面量 | 两册新增行的 `\d{4}-\d{2}-\d{2}` | **仅 2 个**：`2026-10-02`×3（= 提交日 / 版本日）/ `2026-09-30`×1（**引自代码注释** `currency-service.ts:134` 「Kevin 2026-09-30 定值」）⇒ **无发明日期** |

### 7.2 范围（未触碰其它件）

| 检查 | 读数 |
|---|---|
| 提交面 | `git show --stat 7f62c98` = **7 件**（两册正文 + 三快照 + 两 delta），`0 deletions` ⇒ **未触碰** 其它 spec（`ledger` / `commission`）/ 代码（`backend-ts/**` / `frontend/**`）/ `migrations/**` / `master-plan` / 既有 audit·qa·design ✅ |
| 工作树（质检时点） | `M backend-ts/src/database.ts`（`+197/−5`，起手 clean，**质检期间被并发单元改动**）、`M backend-ts/src/index.ts`、`M frontend/src/pages/market/MarketPage.jsx`、`?? docs/audit/p8-s1-app-config.md`、`?? backend-ts/.p4-artifacts/…`、`?? docs/qa/p8-spec-artifacts/`（**本单产物**）⇒ 上述 `M` / 非本单 `??` **均非 `7f62c98` 所为**（该提交的 `name-status` 已核，见 7.2 上栏）→ **属并发实现单元（批 8①）的在飞改动**（见 §1.2 / O-6） |
| 本单自身 | 只新增 `docs/qa/p8-spec-v22-v010-review.md` + `docs/qa/p8-spec-artifacts/**` ⇒ **只读被检物** ✅ |

### 7.3 §7 结论

**零发明与范围 = PASS**（53 条引用 0 未解析 / 0 迁移简写错 / 0 发明键名 / 0 发明日期 / 提交面 7 件）。**唯一扣分点 = §3.3 的 `D-1`（引用锚错 + 「逐字」实为转述）**，属**引证卫生**而非发明。

---

## §8 发现清单（分级 · 逐条带现取证据）

| # | 级别 | 发现 | 现取证据 | 建议（本单不改） |
|---|---|---|---|---|
| **D-1** | **中** | `route-layer.spec` 三处引「`§12.1.1:3042` 逐字：新权限键须 4 处同批改」——**① 行锚 `:3042` 是空行；② 引号内文案非逐字** | `sed -n '3042p'` 空；`§12.1.1` 节头 `:3080`；真实内容 `:3096-3097`；`grep -n "处同批改"` 仅命中 v2.2 自身新增行（`:1798`/`:3922`/`:4030`） | 落位时把锚改 `§12.1.1:3096`（或节头），并**去掉「逐字」**或补原文枚举 |
| **D-2** | **中** | **`AG2`「越权面 ⇒ 拒」无对应的现取静默吸收点**（现取写 `app_config` = **1 处**、无越权面违反）⇒ 按派单口径应报「**无落点**」 | `git grep -nE 'INSERT\|UPDATE\|DELETE … public\.app_config' 7f62c98 -- backend-ts/src/` = 恰 1 处（`database.ts:2887`）；`resetSystemSettings`（`:2899`）只是 `saveSystemSettings` 的包装 | 在 `§21.2 AG2` 明标「**类级不变量 / 防回归（现取无违反）**」，避免与「治现取缺口」的三条并列 |
| **D-3** | **低** | **`AG3`① 经唯一写口不可达**（`value` 裸标量 `23514` 路径走不通；`:2880` 恒以对象入 `JSON.stringify`） | `database.ts:2880-2888` 现取；DB CHECK `0017:77` 与自检 `0017:323-324` **真实存在** | 标注「**DB 层兜底（防直连 / 防未来写路径）**」，闭环归 `AG3`② |
| **D-4** | **低** | **`AG4` 无独立落点**（元规则；其三条判据与 `AG1` 判负用例**同点**） | `AG1` 期望 = `400` + `details.unknown_keys` + 合法字段不得落库；`AG4` = 同三项 + 「二者择一」 | 合并判负用例或标注「元规则，判据覆盖 `AG1`/`AG3`②」 |
| **O-1** | 观察 | `§17.5(b)` 统一行形状含「**动作**」，但 `0024` **无 `action` / 无 `op` 列**（`0023` 的 `op` 亦未入形状） | 两表列集断言 `0023:301` / `0024:268` | 补一条「动作」派生/映射规则 |
| **O-2** | 观察 | `§17.5(c)-2`「正向孤儿」的算子「`kind` 属 admin 面」**无封闭判据**（`kind` 20 值闭集，`mint`/`burn`/`transfer` 非 admin 独占） | `0003:60-69`；`0019:63-68`（uid `0/-1` credit 白名单含 `mint`/`transfer`/`reversal`） | 改**联合算子**（`kind` + `idempotency_key` 前缀 / `ref_type`），否则判据不可判定 |
| **O-3** | 观察 | `POST /api/admin/settings` 的 `ops:` 键**写死键名** `'system_settings'` ⇒ 新键（§17.4 载体键）的 `ops:` 键落同一命名空间；`AR2` / `AG*` **未覆盖** | `index.ts:1147`（blob 现取） | 在 `§17.3`/`AR2` 补「`ops:` 键须随目标键分化」 |
| **O-4** | 口径 | 4 处「区间 vs 键行」错开一行（**非错误**，见 §3.1 / `0022:50-61`、`admin-utils.js:40-52`、`SystemSettings.jsx:12-20`（实为 `:11-20`，8 键在 `:12-19`）、`currency-service.ts:133-138`（「批 6 登记」在 `:139`）） | 逐条 `sed`/`grep -n` 现取 | 无需改；登记口径 |
| **O-5** | 口径 | `0022:48` 自述真源 `database.ts:12-22` vs 两册引 `11-23`（同一 11 键，含 `const`/`] as const`） | `0022:48`；`database.ts:11-23` | 无需改 |
| **O-6** | 环境 | **质检期间并发单元实时改工作树**（`database.ts` → `index.ts` → `MarketPage.jsx`），行锚开始漂移；spec `§17.7-1` 已**预先登记**该风险 | `git status --porcelain` 三时点对比（clean → `M database.ts` → `+index.ts`/`+MarketPage.jsx`） | 实现单落盘后**重锚**两册行号（或改内容锚） |

---

## §9 L5 未验证清单（`NOT_MEASURED` · 逐项原因 · 禁填 0 / 空）

| # | 未验证项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **现库读数**：`app_config` 实际行集（除 `system_settings` 是否残留历史键）、`0023`/`0024` 行数与 `txid` 非空率、`schema_version` 终态 | **本单硬口径 = 不连库、不起实例** ⇒ 库面一律未取；spec 侧的 `NOT_MEASURED`（`§17.7-4`、`§21.6-1/-4/-6`）**无法由本单补齐**（补齐需只读探针单） |
| 2 | **`AG1`–`AG4` / `AR1`–`AR4` / `§17.5(c)` 的判负实跑** | 本单为**只读规范质检、零代码** ⇒ 门禁与判据**未被实现**，无对象可判负；转交实现单 + 后续质检单 |
| 3 | **十一键「三真源逐键相等」的 `all_three_equal` 工具复跑** | 本单**不采信转引**（`p6-b6-perm-seed.md §5-④`）而**直接逐键现取三源文本比对**（§3.1，结论 = 全等）；**该工具本体未运行** ⇒ 工具面 `NOT_MEASURED`（**结论面已由独立方法覆盖**） |
| 4 | **前端 `SystemSettings.jsx` 渲染行为** / 其 8 键与后端 9 键的**实际交互**（缺 `siteName` 的后果） | 需启实例 + 浏览器；本单零 HTTP / 零实例 ⇒ 仅**现取登记**该 1 键差（与 `§21.6-5` 自报一致：`DEFAULT_SETTINGS` 现取 = 8 键、无 `siteName`），**行为未实测** |
| 5 | **`POST /api/admin/settings` 对未知键 / 类型不符的真实 HTTP 行为**（是否真的 200 静默） | 零 HTTP / 零库 ⇒ **只做静态推断**（`database.ts:665/667-675/2880` 代码路径），**端到端未实测** |
| 6 | **`0017` apply-time 自检在现库是否真的执行过**（「实测过该拒绝」的时态） | 需 `schema_migrations` / 现库；本单零库连接 ⇒ spec `§21.1` 该句的**实测性未复核**（文本层 = `0017:323-324` 存在 ✅，**执行层未测**） |
| 7 | **`p6-b6-audit-live.md` 的「资金 `txid` 与审计行 `txid` 逐字相同」实测**（`§17.5(c)-1` 的依据） | spec 自标**转引**；本单未复跑该审计件、未连库 ⇒ 转引面 `NOT_MEASURED`（**表结构相容性已独立核**，见 §5） |
| 8 | **`§17.5(c)-2`「正向孤儿」的零差异读数** | 需库 + 并联查询；且该判据的**算子本身待补**（O-2）⇒ 双重不可测（判据 + 库面） |
| 9 | **`§7-16` 黑名单删除 / `data §21` 门禁是否已被某实现单认领** | 本单未查认领清单；**但已在飞**（`docs/audit/p8-s1-app-config.md` 于质检期间出现 = 实现单已开工的证据）⇒ **认领状态未登记**（不与「已排期」混淆） |
| 10 | **两册行锚在实现单落盘后的有效性** | 见 §1.2 / O-6：`database.ts` 已于质检期间漂移（blob 3895 行 → 工作树 4082 行）⇒ **当前工作树上的行锚一律不作数**；本单结论只对 `7f62c98` blob 成立 |

---

## §10 产物与复算命令

**产物（全部 run-tagged `.txt` / `.json`，无 `.log`）**：`docs/qa/p8-spec-artifacts/`

| 文件 | 内容 |
|---|---|
| `l1-append-only-20261002T220054Z.txt` | numstat / difflib 普查 / `cmp` / 改前快照同一性 / 旧快照普查 |
| `l1-difflib-20261002T215717.txt` | 早一轮 difflib 独立复跑（含 sha256 两时点） |
| `l2a-eleven-keys-20261002T220054Z.json` | 三真源（A/B/C）逐键数组 + `A==B==C==spec_order` 判据 |
| `l2b-ag-vs-gap-20261002T220054Z.txt` | `normalizeSystemSettings` / 写路径 / 类型 helpers **逐字** + `AG2` 类级判据现取 |
| `l2c-tables-20261002T220054Z.txt` | `0023` / `0024` DDL 行号 + 列集断言 + 拒绝行 `txid` 证据 + `ledger_entry` 真身 |
| `l4-invention-20261002T220054Z.txt` | 53 条引用解析结果 + 提交面 + 工作树状态 + 日期字面量 |

**复算命令（逐条可直接现取）**：

```bash
cd /Users/kevin/bistro/seafood
git diff --numstat 7f62c98^ 7f62c98
git diff --name-status 7f62c98^ 7f62c98 -- docs/versions/
cmp docs/versions/route-layer.spec.v2.2.md docs/route-layer.spec.md
cmp docs/versions/data-layer.spec.v0.10.md docs/data-layer.spec.md
cmp <(git show 7f62c98^:docs/route-layer.spec.md) docs/versions/route-layer.spec.v2.1.md
cmp <(git show 7f62c98^:docs/data-layer.spec.md)  docs/versions/data-layer.spec.v0.9.md
git ls-tree 7f62c98^ docs/versions/ | grep -c "route-layer.spec.v"   # 21
git ls-tree 7f62c98^ docs/versions/ | grep -c "data-layer.spec.v"    # 8
git show 7f62c98:backend-ts/src/database.ts | sed -n '11,23p;664,678p;2865,2890p'
git show 7f62c98:backend-ts/migrations/0022_admin_permission_seed.sql | sed -n '50,61p'
git show 7f62c98:frontend/src/admin-utils.js | sed -n '40,52p'
git show 7f62c98:backend-ts/migrations/0023_admin_points_audit_daily_cap.sql | sed -n '64,89p;249p;265p;301p'
git show 7f62c98:backend-ts/migrations/0024_admin_refund_audit.sql | sed -n '48,68p;185p;205p;232p;268p'
sed -n '3042p;3080p;3096,3097p' docs/route-layer.spec.md      # D-1 现取
grep -n "处同批改" docs/route-layer.spec.md
```

**收尾自证**：本报告为**骨架先落盘、再逐节回填**；回填后占位符计数（连续两条下划线）`grep -c '_[_]' docs/qa/p8-spec-v22-v010-review.md` = **0**（该计数命令自身即本行）。本单**未改任何被检物**（spec / 快照 / delta / 代码 / 迁移全未触碰），**未 `git add/commit/push`**。
