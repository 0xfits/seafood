# delta 件 · `docs/route-layer.spec.md` **v2.4 → v2.5**（批 8 第 3 片（8③）契约冻结：上市保证金「可配置 + 退市退还」）

> **本件性质**：本册 v2.5 的**逐条 delta → 依据 → 落点 → 判据**，以及**只追加机器判据的原始读数**。**主册正文 = 本册 §20（新节）+ §7 追加表〔7-72/7-73/7-74〕+ 补注块 ㊲ + §8.1 表 v2.5 行 + §8.27 + 顶部 v2.5 状态块**。**姊妹册 = `docs/data-layer.spec.md` v0.11 → v0.12（§23）**，其 delta 件 = `docs/audit/data-layer-v0.12-delta.md`。
> **硬口径**：**只追加**（删除列 = 0）；**零代码 / 零迁移 / 库面只读 / 零 HTTP / 零套件**；**未发明** 路径 / 权限键 / 键名 / **保证金数值** / 线格式 / 错误码 / 日期。**零 `git add/commit/push`、未 `npm install`、未碰/打印 `.env*`、未 `pkill -f`/`killall`、未启停 5787/5788。**

## §D0 报数（口径 · 命令 · 读数 · 全部本单现取）

| # | 项 | 命令 | 改前（v2.4） | 改后（v2.5 / 本单完工时点） |
|--:|---|---|---|---|
| 1 | 行数（**`wc -l` = 换行符数**） | `wc -l docs/route-layer.spec.md` | **4589** | **4868** |
| 2 | 行数（**逻辑行数** —— 末行 `---` 不带 `\n` 故 +1） | 行数解析器（`read_file` 的 `total_lines` / `splitlines()`） | **4590** | **4869** |
| 3 | 字节 | `wc -c` | **975847** | **1044962** |
| 4 | 指纹 | `md5 -q` | `f518221361e36c5492df198abdae5c2d`（**= 派单对锚逐字相符** ✅） | **`ec760d0fc29b74e066010d921165a5b8`** |
| 5 | 只追加（git） | `git diff --numstat -- docs/route-layer.spec.md` | — | **`279	0`**（**删除列 = 0** ✅） |
| 6 | 只追加（正交口径） | `difflib.SequenceMatcher(..., autojunk=False)` 对 `docs/versions/route-layer.spec.v2.4.md` | — | **opcodes = `equal` 6 / `insert` 5；`replace` = 0 / `delete` = 0** ✅ |
| 7 | 改后快照 | `cp -n docs/route-layer.spec.md docs/versions/route-layer.spec.v2.5.md` + `cmp` | — | **退出码 0**（**逐字节相同**；1044962 B） |
| 8 | 旧快照计数 / 零改动 | `ls docs/versions/ \| grep -c '^route-layer.spec.v'` + `git status --porcelain docs/versions/` | **24** | **25**（**旧 24 个一字未动**；`git status` 只列**两个新件**：`route-layer.spec.v2.5.md` / `data-layer.spec.v0.12.md`） |
| 9 | 姊妹册 | `wc -l` / `wc -c` / `md5 -q docs/data-layer.spec.md` | `5227775f12ef747cf55001c421814340`（1288 行 / 331129 B，**= 派单对锚相符** ✅） | **`c70df56e8a04b87b9e5b84ccebb259ad`**（1412 行 / 361570 B）；`numstat` = **`124	0`** |
| 10 | 注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | v2.4 记载 **68** | **现取 69**（**本片零新增** ⇒ **69 → 69**；+1 = 8② 读口 `:2036` 已落盘） |
| 11 | 代码锚时点（四件） | `md5 -q` + `wc -l` | — | `index.ts` **`3cf5f00ad112297e1c40a5475252cfa2`**（2130）/ `database.ts` **`5aed34e4f771969004b3f42ddda0bb1d`**（4093）/ `currency-service.ts` **`14c0ed1cda2a4004d60524c649c39e5e`**（449）/ `ledger.ts` **`364825f51089351b37cf6b3ee03d8d10`**（1521） |

> **★ 「4589 vs 4590」判明（派单质询项 · 结论在 §D7）**。

## §D1 对照表（逐条 delta → 依据 → 落点 → 判据）

| # | delta | 依据（派单 / Zang 裁定 / 现取） | 落点（本册） | 判据 |
|--:|---|---|---|---|
| ① | **载体键入册（`AK2` = `listing_deposit_policy`）** | **`R-8-9` 逐字**（四项：键名批准 / 入册时机 = 8③ / 8①·8② 不得先行写入 / 数值待 Kevin）+ 派单 ① | **§20**（本册侧）+ **姊妹册 v0.12 §23.1**（键行六栏正文） | 键行六栏齐；**入册前写入必被拒**（§D4） |
| ② | **下限校验机制（数值待 Kevin）** | **`R-8-5` / `R-7-23` 逐字** | **§20.7** + §20.9 `I-2` | 机制面「读不到 ⇒ fail-closed 到常量」+ 客户端永不决定金额 |
| ③ | **权限键映射** | **`R-8-1` 逐字** | **§20.3** | 三真源逐字十一键；写口 = `manage_settings`；**停报行 = 退市账务面** |
| ④ | **「真生效」四段判据** | **P6 的 AC 原文** | **§20.4** | 四段齐全 + **每段自带判负** + 总判据 6 条（含负对照） |
| ⑤ | **退市退还 ↔ 既有 `hold_release` 路径** | **`R-8-2`(b) 逐字** | **§20.5(a)(b)** | 五处真源逐字；**退还额真源 = `currency.deposit_amount`；退还 ≠ 重算** |
| ⑥ | **`hold_forfeit` 禁线** | **`R-8-2` 逐字** + `DL91` | **§20.5(c)** + **`§7-74`** | 判负三条 + **射程声明**（既有在册件不在射程） |
| ⑦ | **口径冲突登记（`DL67`/`DL88` ↔ `R-8-2`）** | 本单现取（两侧逐字） | **§20.5(d)** + **`§7-73`** | **双向判负**；**本单不择一**；行体一字未动 |
| ⑧ | **读写口判决 + 注册点 69 → 69 + 退市触发口停报** | 派单 ② + 现取 | **§20.2** + **`§7-72`** / **`§7-73`** | 读口「不新增」有理由；**若新增必须登记 69 → N**；**不得自造退市路由** |
| ⑨ | **登记三件 + 变更记录 / 快照 / delta** | 派单 ③ + 硬口径 | **`§7-72`/`§7-73`/`§7-74`** + 补注块 **㊲** + **§8.1 v2.5 行** + **§8.27** + 快照 + 本件 | `numstat` 删除列 = 0；`cmp` = 0 |

## §D2 只追加独立复核（机器判据 · 与 `git` 正交的第二条口径）

```
python3 - <<'EOF'
import difflib
A=open('docs/versions/route-layer.spec.v2.4.md',encoding='utf-8').read().splitlines()
B=open('docs/route-layer.spec.md',encoding='utf-8').read().splitlines()
sm=difflib.SequenceMatcher(None,A,B,autojunk=False)
print({t:sum(1 for o in sm.get_opcodes() if o[0]==t) for t in ('equal','insert','replace','delete')})
EOF
```
**读数（本单完工时点现取）**：`{'equal': 6, 'insert': 5, 'replace': 0, 'delete': 0}` ⇒ **只允许 `equal` + `insert`**（口径同 §8.23.6 / §8.24.6 / §8.25.6 / §8.26.6）。
**★ `cmp`**：`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.5.md` ⇒ **退出码 0**。
**★ 负对照（门自证）**：把 `docs/route-layer.spec.md` 任一行**删掉**再跑 ⇒ `delete` 计数**必 > 0** ⇒ 门有效（**不是假门**）。

## §D3 十一权限键（逐字 · 三真源 · 本单亲读）与映射

**（a）逐字十一键**：`dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · `review_tasks`。
真源 A = `backend-ts/src/database.ts:11-23`（`ALL_ADMIN_PERMISSIONS`）；真源 B = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`（11 行 `INSERT`，含 `('manage_settings',    '系统设置')` @ `:60`）；真源 C = `frontend/src/admin-utils.js:40-52`（11 键）。**本单三档 `sed -n` 亲读，键集逐字一致**（转引件 = `docs/audit/p6-b6-perm-seed.md §5-④` 的 `all_three_equal=true`；**本册未复跑该判据**）。

**（b）映射**：

| 面 | → 既有键 | 现取依据 |
|---|---|---|
| 保证金配置**写口**（`AK2` 唯一写入面） | **`manage_settings`** | `index.ts:1158`（`requireAdmin(req, res, 'manage_settings')`）；`0022:60` |
| **退市退还**（账务面） | **★ 无 ⇒ 停报** | **现取无退市路由**（69 条注册点内无 `delist` 一族；`grep -rn 'delist' backend-ts/src/index.ts` = 仅 `:1925` 注释） |
| 后台页（**若**搬上系统设置页） | `manage_settings` + `dashboard_access` | 同族先例（§19.5(d) / §19.3(b)） |

> **★ `R-8-1` 履约**：**零新增键 / 零删除键**（11 键闭集逐字不动）。
> **★ 判负**：退市账务面若被硬造一个键（如自拟 `manage_currency`）⇒ **判负**（`R-8-1` 逐字「找不到合适键 ⇒ 停下报裁、严禁硬造」；跨批项走「4 处同批改」流程 = `§18.2`）。

## §D4 「真生效」四段判据（细目 · 见主册 §20.4）

**项 = `listing_deposit_policy`**：**① 改键** = `POST /api/admin/settings`（闸 `manage_settings`，`index.ts:1157-1158`）→ **② 库内落值** = 表 **`public.app_config`** / 列 **`key` = `'listing_deposit_policy'`**、**`value`（jsonb object）**、`updated_by`、`time_updated`（写落点 = `database.ts:3085`；容器硬约束 = `0017:77`）→ **③ 业务读口取数** = **`backend-ts/src/currency-service.ts:350`**（落地后须先读 `AK2` 键、读不到 / 非法 ⇒ **fail-closed 到常量**（`:144`））→ **④ 行为随之** = **`currency.deposit_amount`（`database.ts:1888`）+ `ledger_entry` 两腿 `listing_deposit`（`:1919` / `:1923`）的改动前 / 后两读数**（退还面 = `hold_release` 两腿金额，`0020:381-382`）。

**判负（逐条）**：**(i)** `POST` 返回 200 但 `SELECT value FROM public.app_config WHERE key = 'listing_deposit_policy'` 无行 / 未变 ⇒ 判负（**封堵「只验后台能存」**）；**(ii)** 键值已变而**下一次上市**的 `deposit_amount` / `listing_deposit` 金额与改动前相等 ⇒ 判负；**(iii)** 键值非法而上市仍按客户端传入值成交 ⇒ 判负。
**执行面**：**只许 DB 直造 + 读库**；**不得**为验收新增路由（同 §19.2(e) 口径）。**本单不实跑**（零库连接 / 零 HTTP）⇒ 主册 §20.8-2 = `NOT_MEASURED`。

## §D5 退市退还 ↔ 既有 `hold_release` 路径（细目）+ 口径冲突登记

**（a）五处真源（逐字）**：① `ledger.ts:1394`（`export const unfreeze`）→ `:1399` `op: 'hold_release',`；注释头 `:1385-1387`「高层动作 ④：unfreeze 冻结 → 可用（hold_release，同账户 2 条分录）」。② `0020:381-382` 两腿 `ledger_norm_entry(v_uid, v_cid, 0, -v_amount, 'hold_release', …)` + `(v_uid, v_cid, v_amount, 0, 'hold_release', …)` ⇒ **`frozen −amount` / `balance +amount`** = **`frozen → balance` 冻结口径**。③ `0020:573`（`HAVING count(*) <> 2`，列表 `('hold','hold_release','job_escrow','job_escrow_refund')` —— **不含 `listing_deposit`**）。④ `ledger.ts:203`（`hold_release: { draft: true, listed: true, frozen: true, delisted: true }` ⇒ **`delisted` 可解冻**）。⑤ `0016:670` + `:674`（撤单 `hold_release` ×2 = 同族先例）。

**（b）对应关系（冻结）**：退还 = 调 `unfreeze` ⇒ `op='hold_release'`；**金额真源 = `currency.deposit_amount`**；**退还 ≠ 重算**（配置键只决定上市时金额）。

**（c）★★ 口径冲突（登记 · 本单不择一）**：**A 侧** = `DL67`（**v0.11 基线 `:459`** ⇒ **本版现取 `:460`**）「下架无账务动作（保证金不退；不存在罚没）」+ `DL88`（**v0.11 基线 `:535`** ⇒ **本版现取 `:536`**）「上市即消耗……不可退、无罚没、无退还 kind ⇒ 交易所路由不得提供「退还保证金」按钮或接口」（**均【已冻结】**）；**B 侧** = `R-8-2`(b)「退市退还走既有 `hold_release` 路径」⇒ **字面互斥**。**处置**：**行体一字未动**；**停报 = `§7-73`**；**双向判负**（据 `DL88` 拒绝实现 = 判负；据 `R-8-2` 改写 `DL67`/`DL88` 行体 = 判负）；**读法落定前不得实现退还路径**。

## §D6 `hold_forfeit` 禁线（细目 · 见主册 §20.5(c) / `§7-74`）

**真源（三处）**：`DL91`（`data-layer.spec:538`）「**`hold_forfeit` 在 P3 不启用**……**登记为待裁决**、**不预先启用**」；`ledger.ts:149-150`「`listing_deposit_forfeit`：P1c 新裁定删（保证金在上市时即消耗、进平台收入 `uid=-1`……」；`DL67`/`DL88` 的「**无罚没**」。
**判负三条**：① **本片新增件出现 `hold_forfeit`** ⇒ 判负（**射程 = 新增件**；**既有在册件**（`0001`/`0003`/`0004`/`0008`/`0012`/`0019`/`0020` 与 `ledger.ts:154`）**不在射程、不得据此删改** —— `migrations/**` 已 apply 禁改）；② **退还额被配置键二次改写** ⇒ 判负；③ **退还走非 `hold_release` 的分录组合 / 新增 kind** ⇒ 判负（**kind 关闭集 20 个**恒不动，`0019:155-158` 现取）。

## §D7 ★★ 「4589 vs 4590」判明（派单质询项 · 逐字 · 可复算）

**结论：两个数都对；差 1 的全部原因 = 「末行不带换行符」。**

| # | 命令（现取） | 读数 |
|--:|---|---|
| 1 | `wc -l docs/route-layer.spec.md`（改前 v2.4） | **4589**（`wc -l` **只数 `\n` 个数**；末行 `---` **不带 `\n`** ⇒ 不计） |
| 2 | `tail -c 3 docs/route-layer.spec.md \| xxd` | **`00000000: 2d2d 2d`**（逐字 = `---`，**其后无 `0a`**） |
| 3 | `sed -n '4590p' docs/route-layer.spec.md \| wc -l` | **0**（该行不自带换行 ⇒ `sed` 打印不带 `\n`） |
| 4 | 逻辑行数（行数解析器 `total_lines` / `splitlines()`） | **4590**（末行内容逐字 = `---`） |

**★ 由此改变的一条落盘手法（写死 · 本单自曝 ②）**：**本册的追加一律插在末行 `---` 之前**，**不是**在其后追加 —— 理由 = **机器判据**：在「不带换行」的末行之后追加，会把该行由「无换行」改写成「带换行」⇒ `git diff --numstat` **必记 1 个删除**。**本单已用最小复现件实测**：

```
mkdir t && cd t && git init -q . && printf 'aaa\nbbb\n\n---' > f.md && git add f.md && git commit -qm i
printf 'aaa\nbbb\n\n---\n\n## X\nb\n' > f.md ; git diff --numstat f.md      # => 4  1   （1 删除）
git checkout -q f.md
python3 -c "p='f.md';r=open(p,'rb').read();open(p,'wb').write(r[:-3]+b'## X\nb\n\n---')" ; git diff --numstat f.md  # => 3  0
```
⇒ **本单取后者**（`278 0`）；**本册此后凡报行数必须注明口径**（`wc -l` / 逻辑行数）。
**★ 引用纪律加成（承 §18.6 / §19.6(d)）**：本判明的**每一条读数均已给「命令 + 版本 + 期望输出」三件**。

## §D8 键寻址面缺口 + 注册口判决（细目 · 见主册 §20.1 / §20.2 / §20.6 与 `§7-72`）

- **缺口的现取证据（逐字）**：`index.ts:1192` `screenSystemSettingsWrite(body)` ⇒ `database.ts:863`（剥离 `SETTING_CONTROL_FIELDS`）⇒ `:775` `validateSystemSettingsPatch`（**判据真源 = `SYSTEM_SETTINGS_FIELD_TYPES` 的 9 字段**（`:50-60`）；字段名关闭集 = `SYSTEM_SETTINGS_FIELDS`（`:63`））；写落点 `key` 字面写死 `'system_settings'`（`:3085`）；读侧 `WHERE key = 'system_settings'`（`:3063`）；合法键常量 `APP_CONFIG_LEGAL_KEYS = ['system_settings']`（`:47`）⇒ **无键维通道**。
- **落地两件事（属实现单）**：**(i)** 键级寻址（线格式**待定**，候选三形**不构成裁定**）；**(ii)** `APP_CONFIG_LEGAL_KEYS` 同轮加键（**否则「在册」而永不可写**）。
- **判负四条** = 主册 §20.6（自造线格式未回写 / 把键塞成 `system_settings` 的字段 / 常量加键而门禁仍按字段级判 / **`database.ts:41-45` 的注释块不同轮更新**）。
- **注册口判决**：**写口复用**（不新增）；**读口判「不新增」**（8③ 的 AC = 业务侧真生效，不要求后台可见）；**退市触发口 = 现取无 ⇒ 停报、不得自造** ⇒ **注册点 69 → 69**（现取基线 = 69；v2.4 记载 68 + 8② 读口 `:2036` 已落盘）。**若 Zang 裁定确需新增退市入口 ⇒ 必须回写本册 + 登记 69 → N**。

## §D9 未测项 / 自曝 / 登记（与主册 §20.8 / §20.9 / §8.27.3 逐条同源）

**`NOT_MEASURED`（八项 · 见主册 §20.8）**：① 入册前后写入被拒的 HTTP 实跑；② 四段判据判负实跑；③ 退市触发口（无对象）；④ `ops:` 按 key 派生后的键形态（未实现）；⑤ `AK2` 键内形态 / 线格式（待定）；⑥ 现库 `app_config` 行集（零库连接）；⑦ 冲突收口结果（待裁）；⑧ 代码锚在实现单落盘后的有效性。
**自曝（六项 · 见主册 §8.27.3）**：①「就地加注 ↔ 删除列 = 0」不可兼得（取机器判据）；② **末行无换行 ⇒ 行数双口径 + 落盘手法**；③ 派单「若新增读口 ⇒ 69 → N」而本单判「不新增」（**理由 + 判负已给**）；④ 新发现缺口（键寻址 / 退市触发）与**已冻结条文 ↔ 本轮裁定的字面互斥**；⑤ 判据未实跑；⑥ `hold_forfeit` 判负的**射程声明**。
**登记（`§7-72` / `§7-73` / `§7-74` + §20.9 `I-1`…`I-8`）**：逐条见主册。

## §D10 未触碰清单（逐条 · 与主册 §8.27.1 同源）+ 复算命令

**未触碰**：任何代码（`backend-ts/**` / `frontend/**` 只读：`grep` / `sed -n` / `wc` / `md5` / `ls`）、`migrations/**`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**`（**既有件**；本单只**新建**本件与 `data-layer-v0.12-delta.md`）、`docs/design/**`、`docs/ledger.spec.md`、`docs/commission.spec.md`（真源册 · 只读）。
**复算命令（可直接跑）**：
```
cd /Users/kevin/bistro/seafood
git diff --numstat -- docs/route-layer.spec.md docs/data-layer.spec.md     # => 279 0 / 124 0
cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.5.md        # => exit 0
cmp docs/data-layer.spec.md  docs/versions/data-layer.spec.v0.12.md        # => exit 0
grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts     # => 69
sed -n '1157,1162p;1192p' backend-ts/src/index.ts
sed -n '47p;775,790p;863,870p;3063p;3085p' backend-ts/src/database.ts
sed -n '144p;155,172p;350p' backend-ts/src/currency-service.ts
sed -n '1394,1408p' backend-ts/src/ledger.ts ; sed -n '381,382p;573p' backend-ts/migrations/0020_*.sql
grep -rn 'delist' backend-ts/src/index.ts                                   # => 仅 :1925 注释
ls docs/versions/ | grep -c '^route-layer.spec.v'                           # => 25（旧 24 + 新 1）
```
