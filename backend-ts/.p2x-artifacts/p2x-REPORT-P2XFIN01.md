# P2X 收尾单报告 · 0012「幂等重放前置闸」定位/修复/应用/验收

- run tag：**`P2XFIN01`**（探针/干跑产物一律 run-tagged；另有子 run：`P2XFINDR01`（干跑失败取证）、`P2XFINreproB/reproF/reproB0x/reproF0x`（最小复现）、`P2XFINarr`（数组追加取证）、`P2XFINtG/tH/tI`（上一轮三变体）、`NEG_A/NEG_B`（判负实验，非 artifact 名）
- 开工 HEAD：`32d1745 wip(P2/0012): 幂等重放前置闸迁移【已写好、干跑通过、未应用】+ p2x 探针`
- 角色：Kong（实现者）。**未 commit / 未 push**；**未碰 `frontend/**` 任何文件**（工作树里 `frontend/**` 的改动是另一个子代理的，与本单无关）；未启停任何面板托管服务；全程无 `pkill -f`/`killall`；退出码一律直接取自命令本身（不取自管道之后）。
- 迁移文件：`backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql`
  - 修复前（= `32d1745` 入库内容）：**71033 B / md5 `d2641afe25b8e25ac2e4bc4a38bb525d`**
  - 修复后（本单产物，已应用）：**71238 B / md5 `5b97c96b3e6279799b8781e2222d01e3` / sha256 `2a64483f944f16e3364be822e5ff61e0b95afa0168f937ce5aac6671b561dcbe`**
  - 改动范围：**18 行，全部在 §C 的 apply-time `DO $chk$` 自检块内**；函数体（`CREATE OR REPLACE FUNCTION` → `COMMENT ON FUNCTION`）**逐字未动**（见 §2.3）
- 连接抖动：`Client network socket disconnected before secure TLS connection was established` **共 1 次**（`P2XFINreproB` 第 1 次尝试）⇒ 重试即过；`migrate.ts` 全程未遇抖动。

---

## §0 开工读数（原始）

```
$ git log --oneline -1
32d1745 wip(P2/0012): 幂等重放前置闸迁移【已写好、干跑通过、未应用】+ p2x 探针

$ git status --porcelain   # 开工时（本单改动之前）
（空）

$ md5 -q backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql   # 开工时
d2641afe25b8e25ac2e4bc4a38bb525d
$ wc -c backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql
   71033 backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql

$ command -v timeout gtimeout psql
（三者皆空 —— 本机无 timeout/gtimeout/psql）
```

---

## §1 真前态（0012 未应用）——本 run 实测，与 P1 登记指纹对撞

`P2X_RUN=P2XFIN01 npx ts-node --transpile-only scripts/p2x-01-migration-dry-run.ts migrations/0012_replay_pre_gate_before_balance_gate.sql` 的 `fn_before`
（`.p2x-artifacts/p2x-01-migration-dry-run-P2XFIN01.json`）：

```json
{"schema_version":"0011","prosrc_len":42449,"prosrc_md5":"0cf1bb98ee3a30da55b1620c309d5541",
 "pre_gate_present":false,"pos_pre_gate":-1,
 "pos_c4_account_lock":26825,"pos_c5_balance_section":27572,"pos_r80_balance_gate":29468,"pos_on_conflict_probe":31476,
 "order_ok_gate_after_lock_before_balance":false,"on_conflict_still_after_gate":true,
 "idx_ledger_event_root_key_rows":1,"on_conflict_probe_present":true}
```

- 与 P1 期登记指纹**逐字相同**（`42449 B` / `md5 0cf1bb98ee3a30da55b1620c309d5541`）⇒ 自 P1 以来 `ledger_post_event` 未漂移，`schema_version = 0011`（= `0012` 未应用）。
- **缺陷坐实**：`pos_on_conflict_probe 31476 > pos_r80_balance_gate 29468 > pos_c5_balance_section 27572 > pos_c4_account_lock 26825`，`pre_gate_present = false`
  ⇒ 余额/冻结闸（C5/R80）跑在 R51 的幂等探针**之前**，且**没有任何重放前置闸**。

---

## §2 本单头号任务：干跑为何失败 —— 丢定界符的**层**判定 + 根因 + 修复

### 2.0 失败读数（原始）

```
$ P2X_RUN=P2XFINDR01 npx ts-node --transpile-only scripts/p2x-01-migration-dry-run.ts   # 修复前
exit=1
{"ok":false,
 "dry_run":{"result":null,"error":"invalid hexadecimal integer at or near \"0x\"",
            "error_sqlstate":"42601","error_position":"55219","error_where":"","error_internal_query":"",
            "ms":14144,"rolled_back":true}}
```

`55219` 是 **文件字符坐标**（不是函数体坐标）：文件第 55219 个字符正是**第 1178 行** `SELECT u, '0x' || lpad(...)` 里那个 `0x` 的 `0`
（`grep -bo`/python 实测：`0x` 的 0-based 下标 = `55218`）。⇒ PG 的词法器在那个 `'0x'` 处**认为自己在「代码态」**，说明它前面某个单引号被当成了「收尾」而不是「开头」。

### 2.1 决定性判据：丢引号的层是「干跑探针的语句切分」还是「`migrate.ts`」？—— 两者是**同一条路径**

| 路径 | 读文件 | 发送 | 切分/正则/插值 |
|---|---|---|---|
| `scripts/migrate.ts` | L39 `fs.readFileSync(file,'utf8')` | L94 `await client.query(f.sql)`（**整份一个 query**） | 无（唯一的正则只用来从**文件名**取版本号，L39） |
| `scripts/p2x-01-migration-dry-run.ts` | L18 `fs.readFileSync(file,'utf8')` | L24 `await c.query(sql)`（**整份一个 query**） | 无 |

两者都走 `@neondatabase/serverless` 的 `Pool`（WebSocket 协议），都**没有**按 `;` 切分、没有注释剥离、没有模板插值 —— 送出的字节序列就是磁盘上的文件内容。
**旁证（同错同位）**：同一个文件经两条路径报的是**同一个**错误（`42601 invalid hexadecimal integer at or near "0x"`），且干跑给出的位置精确落在该文件第 1178 行的 `0x` 上。
⇒ 「干跑探针自己丢引号」这一假设**被证伪**（若两条路径的字节流不同，错误形态不会逐字相同、位置不会精确对上）。**缺陷在文件本身。**

### 2.2 一行定位（自写 PG 词法器对拍 + 原始字节）

自写词法器（处理 `--` 行注释、`/* */` 嵌套块注释、`'…'`（`''` 转义）、`"…"`、`$tag$…$tag$`）对拍：

```
whole file : final state = code        （外层 dollar 串闭合正常，无未闭合）
DO body    : final state = sq          OPEN=158  CLOSE=157   ⇒ 单引号数为**奇数**
第一个跨行"字符串" 起于第 1151 行（abs 54141），止于第 1152 行（abs 54210）：
  content = "'''idempotent_replay'' IN v_window) = 0 THEN\n      v_bad := v_bad || "
```

第 1151 行的原始字节（`od -c`）：

```
0000000                    I   F       p   o   s   i   t   i   o   n   (
0000020    '   '   '   i   d   e   m   p   o   t   e   n   t   _   r   e
0000040    p   l   a   y   '   '       I   N       v   _   w   i   n   d
0000060    o   w   )       =       0       T   H   E   N
```

⇒ `IF position('''idempotent_replay'' IN v_window) = 0 THEN`
**收尾只有两个引号，少一个**（对照同块第 1137 行 `position('v_entries->0->>''idempotency_key''' IN v_src)` 收尾是**三个**，写法正确）。
少一个引号 ⇒ 从第 1151 行起引号奇偶翻转 ⇒ 第 1178 行的 `'0x'` 被解析为「代码态的 hex 字面量」⇒ `42601`。

### 2.3 最小复现（原始读数，两条独立复现）

**复现 A（裸语句级）**
```
repro_broken.sql : SELECT position('''idempotent_replay'' IN 'x') AS p;
  ⇒ 42601  unterminated hexadecimal string literal at or near "x') AS p;"      position=117
repro_fixed.sql  : SELECT position('''idempotent_replay''' IN 'x') AS p;
  ⇒ executed=true, error=null
```

**复现 B（复刻全文干跑的 42601 `0x` 形态）**
```
repro_broken_0x.sql（同一少引号 + 后文出现 '0x'）
  ⇒ 42601  invalid hexadecimal integer at or near "0x"                        position=287   ← 与全文干跑**逐字同错**
repro_fixed_0x.sql  ⇒ executed=true, error=null
```

### 2.4 上一轮三变体 t_g / t_h / t_i 的读数（本单实跑）——同时**证伪**了「多字节注释丢定界符」的假设

```
[P2XFINtG] exit=1  error= malformed array literal: "条分录（期望 0）"  sqlstate=22P02   (含多字节注释 ⇒)
[P2XFINtH] exit=1  error= malformed array literal: "条分录（期望 0）"  sqlstate=22P02   (纯 ASCII 注释)
[P2XFINtI] exit=1  error= malformed array literal: "条分录（期望 0）"  sqlstate=22P02   (无注释)
```

三条读数**完全相同** ⇒ ① 多字节字符/注释**不是**根因（否则三者应有差异）；② 三个变体**自身**写坏了：
`v_bad := v_bad || '条分录（期望 0）'` 里的 `v_bad` 是 `text[]`。这暴露了迁移 §C 里的**第二个缺口**（见 2.5）。

### 2.5 缺口②：`text[] || '<裸字符串字面量>'` 在 PG 里解析为 `array_cat`（⇒ `22P02`）

`P2XFINarr` 的五种写法实测（`.p2x-artifacts/p2x-01-migration-dry-run-P2XFINarr.json` 的 `dry_run.error` 原文）：

```
PROBE_RESULT: A:FAILED sqlstate=22P02 msg=malformed array literal: "A_bare_literal"
  ||  B_typed_1_expr      ← v := v || ('B_' || 1 || '_expr')      : ok（RHS 是 text 表达式）
  ||  C_explicit          ← v := array_append(v, 'C_explicit')    : ok
  ||  D_ARRAY_wrap        ← v := v || ARRAY['D_ARRAY_wrap']       : ok
  ||  E_cast              ← v := v || 'E_cast'::text              : ok
```

⇒ 只有「RHS = **裸 unknown 字符串字面量**」这一种写法会被解析成 `anyarray || anyarray`（`array_cat`），右侧 unknown 再被按**数组字面量**解析 ⇒ `22P02`。
`0012` §C 里有 **17 处**是这种写法 ⇒ 自检一旦真要**报错**，它自己会先被 `22P02` 打死（消息被掩盖）。

### 2.6 修复（18 行，全部在 §C 内；函数体逐字未动）

1. 第 1151 行补上缺的那个引号（1 行）。
2. 17 处 `v_bad := v_bad || '<裸字面量>'` → `v_bad := array_append(v_bad, '<裸字面量>')`。

diff 全文：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p2xfin/0012.one-char-and-array-append.diff`（18 条 `-/+`）。
修复后词法器复核：`DO body: OPEN=158 CLOSE=158`、`multi-line-string anomalies: 0`。
修复后文件：**71238 B / md5 `5b97c96b3e6279799b8781e2222d01e3` / sha256 `2a64483f944f16e3364be822e5ff61e0b95afa0168f937ce5aac6671b561dcbe`**。

### 2.7 干跑通过（本 run 的「after-in-tx」对撞读数）

`P2X_RUN=P2XFIN01 … p2x-01-migration-dry-run.ts migrations/0012_…sql` ⇒ **exit 0 / ok=true**：

```json
{"ok":true,
 "dry_run":{"result":{"executed":true},"error":null,"error_sqlstate":null,"error_position":null,"ms":4214,"rolled_back":true},
 "fn_before":              {"prosrc_len":42449,"prosrc_md5":"0cf1bb98ee3a30da55b1620c309d5541","pre_gate_present":false},
 "fn_after_in_tx":         {"schema_version":"0011","prosrc_len":45598,"prosrc_md5":"d94dd902697dfe60aba409d808c6d63a",
                            "pre_gate_present":true,"pos_pre_gate":27698,"pos_c4_account_lock":26917,
                            "pos_c5_balance_section":30721,"pos_r80_balance_gate":32617,"pos_on_conflict_probe":34625,
                            "order_ok_gate_after_lock_before_balance":true,"on_conflict_still_after_gate":true},
 "fn_after_post_rollback": {"prosrc_len":42449,"prosrc_md5":"0cf1bb98ee3a30da55b1620c309d5541","pre_gate_present":false},
 "fn_changed_in_tx":true, "zero_residue_fn_body":true,
 "probe_residue":{"probe_users":"0","probe_currency":"0","probe_ledger":"0","probe_accounts":"0"},"residue_zero":true}
```

- **`fn_after` 已按要求改成「同一事务内、执行之后」读**（`scripts/p2x-01-migration-dry-run.ts`，Zang 补料 ③）：现在 `fn_before` 与 `fn_after_in_tx` 真的可对撞（`42449/d94dd902…` vs 新 `45598`，闸出现、位置全绿）；`fn_after_post_rollback` 与 `fn_before` 逐字相同 ⇒ **回滚后零残留**的另一重自证。
- 干跑判据也升级为：`error=null` **且** 事务内指纹必须显示「闸在 C4 加锁之后 / C5 余额闸之前 / ON CONFLICT 探针仍在闸之后」（否则 exit 1）—— 避免再出现「干跑报绿但其实什么也没做」的假绿。

---

## §3 应用迁移（applied / 幂等 skipped / schema_version）

```
$ npx ts-node --transpile-only scripts/migrate.ts          # 第 1 次
exit=0   ok=true
  actions: {skipped: '0001..0011 (11)', applied: ['0012']}
  APPLIED: {"version":"0012","name":"0012_replay_pre_gate_before_balance_gate.sql",
            "action":"applied","checksum":"2a64483f944f","ms":1420}
  schema_version = 0012     public_base_table_count = 8

$ npx ts-node --transpile-only scripts/migrate.ts          # 第 2 次（幂等）
exit=0   ok=true
  actions: {skipped: '0001..0012 (12)'}
  schema_version = 0012
```

- **首次 applied**：checksum `2a64483f944f…`（= 文件 sha256 前缀）、耗时 **1420 ms**、`schema_version = 0012`。
- **重跑全 skipped（12/12，含 0012）** ⇒ 幂等成立、无 checksum drift。

---

## §4 after 相位，与三份 before 并列

`P2X_PHASE=after npx ts-node --transpile-only scripts/p2x-00-idempotency-replay-order.ts --assert` ⇒ 产物 `p2x-00-replay-order-P2XFIN01.{json,txt}`：

| run | phase | fn 指纹（prosrc_len / md5 / 闸在不在） | red_cases |
|---|---|---|---|
| P2XBEF01 | before | 42449 / 0cf1bb98… / **无** | 1,2,3,4,5,5b |
| P2XBEF02 | before | 42449 / 0cf1bb98… / **无** | 1,2,3,5,5b |
| P2XBEF03 | before | 42449 / 0cf1bb98… / **无** | 1,2,3,5,5b |
| **P2XFIN01** | **after** | **45598 / d94dd902… / 有（order_ok=true）** | **5**（见 §6.5 说明） |

`P2XBEF01` 比 02/03 多红一个 `4`：其读数里用例 4 的夹具条件没立住（首写没落），属该次观测的夹具噪声；02/03 两次一致 ⇒ 以 02/03 为准。

三处**同一位置**的 before→after 对照（同一脚本、同一判据、同一载荷形状）：

| 用例 | before 读数 | after 读数 |
|---|---|---|
| 1 头号（托管花光后同键同载荷） | `ok=false, sqlstate=LD002`（第二次、第三次都是） | `ok=true, idempotent_replay=true, txid=5243`（与首写逐字同） |
| 3 同键异指纹（托管已花光） | `ok=false, sqlstate=LD002` | `ok=false, sqlstate=**LD003** LEDGER_IDEMPOTENCY_CONFLICT` |
| 5b 分阶段竞态（B 阻塞后重试） | `ok=false, sqlstate=LD002, blocked_ms=963` | `ok=true, idempotent_replay=true, txid=5263 == A 的 txid, blocked_ms=936` |

after 相位 `34/37 GREEN`、`red_cases=['5']`（原因与处置见 §6.5）。

---

## §5 apply-time `DO` 自检的**判负能力**（三步，全部原始读数）

### 第 1 步：临时改坏 → 跑迁移 ⇒ **必须失败**

**变体 A（Zang 指定的改坏法：把前置闸段整段挪到余额闸之后）**
闸段被整段搬到 `C6 写入段` 之前（文件里 `0012-REPLAY-PRE-GATE-BEGIN` 行号 735 > `R80：库内先判` 行号 710）；改坏后 `md5=932209455450cb1571e54d61f080a011 / 71359 B`：

```
$ npx ts-node --transpile-only scripts/migrate.ts
[NEG_A] migrate.ts exit=4
{"ok":false, "schema_version":"0011",
 "applied_now":[..., {"version":"0012","name":"0012_replay_pre_gate_before_balance_gate.sql",
                      "action":"FAILED","message":"LEDGER_INSUFFICIENT_FROZEN","code":"LD002"}],
 "schema_migration_rows": 11   ← 未写 0012 版本行}
```

⇒ 迁移**失败**（exit 4），且判负来自文件**自带的**行为探针①（「托管花光后同键重放必须 200 R52①」）——语义上正是「闸在余额闸之后 ⇒ 重放被 LD002 挡住」这件事本身。

**变体 B（只删闸的 END 标记行：函数行为逐字不变，隔离**结构性位置断言**）**
改坏后 `md5=ac8f327a77c76e7f6da3accaa54b58d9 / 71310 B`：

```
[NEG_B] migrate.ts exit=4
{"ok":false,"schema_version":"0011",
 "applied_now":[...,{"version":"0012","action":"FAILED","code":"P0001",
   "message":"0012 self-check failed: 重放前置闸标记缺失或错位（BEGIN/END） | 闸体缺 R52② 分支（同键异指纹 ⇒ LD003 409） | 闸体缺 R52① 分支（idempotent_replay 返回） | 闸体未按 event_root_key = v_key 归属查询 | 闸体未标注既有索引用途（idx_ledger_event_root_key）"}]}
```

⇒ 结构性断言同样判负，且**消息可读**（修复②之后不再被 `22P02` 掩盖 —— 这正是修复②的价值）。

### 第 2 步：改回 ⇒ 逐字还原自证
```
[NEG_A] restored md5=5b97c96b3e6279799b8781e2222d01e3 bytes=71238
[NEG_B] restored md5=5b97c96b3e6279799b8781e2222d01e3 bytes=71238
```

### 第 3 步：改回后跑迁移 ⇒ **必须通过**
即 §3 的 `applied`（checksum `2a64483f944f` / 1420 ms / `schema_version=0012`）。三步齐全。

---

## §6 六项恢复矩阵（每条：最小复现 + 原始读数）

命令统一为 `P2X_RUN=P2XFIN01 P2X_PHASE=after npx ts-node --transpile-only scripts/p2x-00-idempotency-replay-order.ts --assert`
（用例 1/2/3/4/6 在**回滚事务**内 ⇒ 零残留；用例 5/5b 需提交）。原始 JSON 见 `p2x-00-replay-order-P2XFIN01.json`。

**① 头号用例：事件落账（托管已花光）→ 同键同载荷再发 ⇒ 200 + `idempotent_replay:true` + 结果与首次逐字相同**（前态本应是 LD002）
```
夹具: mint 1000000 + hold 90000（托管恰 90000）
第 1 次（4 分录: 雇主 frozen −89000−1000 / 打工人 +89000 / 平台 −2 +1000）:
  {"ok":true,"idempotent_replay":false,"txid":"5243","entries_n":4,
   "extra":{"symbol":"p2xr960197","entries":"4"},"sqlstate":null}
  frozen_after_first = "0"           ← 托管恰花光（= before 相位必红的前态）
第 2 次（同键同载荷同指纹）:
  {"ok":true,"idempotent_replay":true,"txid":"5243","entries_n":4,
   "entries_sha256" == 首写, "accounts_sha256" == 首写, "extra":{},"sqlstate":null}
第 3 次: raw_json 与第 2 次**逐字相同**（幂等）
键下分录数 = 4（重放零写入）
before 对照（同一位置）: P2XBEF02 {"ok":false,"sqlstate":"LD002"}  ← 被修复的缺陷
```

**② 仍有足额 frozen 时重放 ⇒ 行为不变**
```
frozen_after_first = "90000"（对照条件成立）
首写 {"txid":"5250","idempotent_replay":false} → 重放 {"ok":true,"idempotent_replay":true,"txid":"5250"}; 键下 4 行
形状与用例 1 的闸路径逐字相同（result_keys / extra 对撞 GREEN）
```

**③ 同键 + 不同指纹（托管已花光）⇒ 409 `LEDGER_IDEMPOTENCY_CONFLICT`（不再 LD002）**
```
首写 {txid 5257, frozen_after_first="0"}
异指纹调用 ⇒ {"ok":false,"sqlstate":"LD003","entries_n":0}      ← LEDGER_IDEMPOTENCY_CONFLICT（before 这里是 LD002）
冲突调用零写入：键下仍 4 行；随后同键同指纹 ⇒ 仍是 200 重放（txid 5257）
```

**④ 全新事件 + 余额/冻结不足 ⇒ 仍 LD002 / LD001（闸没被拆掉）**
```
全新键 + 冻结不足 ⇒ {"ok":false,"sqlstate":"LD002"}   被拒事件键下 0 行
全新键 + 余额不足 ⇒ {"ok":false,"sqlstate":"LD001"}   被拒事件键下 0 行
（before 同位置读数一致：LD002 / LD001 ⇒ 行为未变）
```

**⑤ 真并发同键（≥2 连接、同时在飞）⇒ 恰一次落账 + 其余重放 + 不双扣**
—— 权威读数来自本单新增的 `scripts/p2x-02-concurrency-same-key.ts`（13/13 GREEN）：
```
两连接同时在飞（同键同载荷）；胜者 B 先返回 230ms ⇒ **立刻 COMMIT**（不等败者）；败者 A 等锁 476ms 后被解锁
胜者: {"ok":true,"idempotent_replay":false,"txid":"5278","at_ms":230}
败者: {"ok":true,"idempotent_replay":true, "txid":"5278","at_ms":476}   ← 200 重放，txid 与胜者相同
landed_count=1  replay_count=1  error_count=0
胜者提交后键下已 2 行；败者重放后仍 2 行（extra_rows_added = 0）
entries_sha256 / accounts_sha256 胜者与败者逐字相同
balance = 910000（= 1000000 − 90000）、frozen = 0  ⇒ 恰扣一次，不双扣
两次 COMMIT 均成功（无 DEFERRED 约束在 COMMIT 判负）
moneyGuard: cid=1 哈希前后一致；平台 0/-1/-2/-3（排除本 run 新建 cid）哈希前后一致
```
> ⚠️ **`p2x-00` 自带的用例 5 在 after 相位仍红（red_cases=['5']），但根因是那个探针的**顺序**、不是 0012**：
> 它写的是 `await Promise.all([call_A, call_B])` **之后**才提交 A ⇒ 胜者在败者放弃之前**不可能**提交 ⇒ 败者只能等锁等到 R82 的 3s `lock_timeout`
> （`ledger_lock_timeout_ms() = 3000`）⇒ `LD025 lock_timeout @3217ms`。**before 三份读数是同一个 LD025（3694 / 3215 / 3203 ms）** ⇒ 与 0012 无关，
> 是「先等两边都返回再提交胜者」这一构造造成的假红。为保持 before/after 可比，我**没有**改 `p2x-00`，而是新增 `p2x-02` 复刻真实事务时序（胜者一返回就提交）。

**⑤b 分阶段竞态（A 持锁未提交，B 同键重试阻塞 ⇒ A 提交后 B 必须 200 重放）**
```
A 首写 {"ok":true,"txid":"5263","idempotent_replay":false}（未提交，持账户行锁）
B 同键重试: blocked_ms=936（真的阻塞过）
A 提交后 B ⇒ {"ok":true,"idempotent_replay":true,"txid":"5263"}  txid 相同；键下 2 行；balance 910000 / frozen 0
before 对照: {"ok":false,"sqlstate":"LD002","blocked_ms":968}
```

**⑥ 事件未落账 / 键不存在 ⇒ 行为不变**
```
新键 ⇒ {"ok":true,"idempotent_replay":false,"txid":"5266"}（闸不误报重放）
同一载荷换新键 ⇒ {"ok":true,"idempotent_replay":false,"txid":"5268" ≠ 5266}（不误伤新事件）
再次用首个新键 ⇒ {"ok":true,"idempotent_replay":true,"txid":"5266"}（200 重放且 txid 与首写相同）
两个键各 2 行
```

---

## §7 R63 未被破坏（行为读数 + `prosrc` 位置断言）

**行为读数**（§6④）：全新键 + 冻结不足 ⇒ `LD002`；全新键 + 余额不足 ⇒ `LD001`；两者被拒后键下 **0** 行。⇒ 「新事件仍必须过余额/冻结闸」成立。

**位置断言**（after 相位 `fnFingerprint`，`.p2x-artifacts/p2x-00-replay-order-P2XFIN01.json` 的 `fn_fingerprint`）：
```
pos_c4_account_lock   = 26917
pos_pre_gate          = 27698     ← 闸：26917 < 27698 ✓（在 FOR UPDATE 行锁之后）
pos_c5_balance_section= 30721     ← 余额闸段首
pos_r80_balance_gate  = 32617     ← R80 余额/冻结判据点：27698 < 30721 < 32617 ✓（闸在余额闸之前）
pos_on_conflict_probe = 34625     ← R51 首条分录 `ON CONFLICT … DO NOTHING` 探针：32617 < 34625 ✓ 且 27698 < 34625 ✓
order_ok_gate_after_lock_before_balance = true
on_conflict_still_after_gate            = true
```
⇒ **余额/冻结校验仍在「同一事务内 + `FOR UPDATE` 行锁之后」**（R63）；**R51 的 `ON CONFLICT` 探针仍在闸之后、未被取代**（仍是并发全新事件的唯一权威）。
闸体只读由 apply-time `DO` 自检④（剥掉 SQL 行注释后查 `insert|update|delete|for update|for share|lock table|set constraints`）在干跑与应用时**均通过**背书。

---

## §8 未验证清单 / 残余风险（诚实登记）

1. **`p2x-02` 的 before 相位对照未实测**：0012 已应用且不可回退（无降级迁移）⇒ 「修正版并发探针在 before 会红」只有**同类旁证**（`p2x-00` 用例 5b before = LD002），没有同脚本的 before 原始读数。
2. **`p2x-00` 用例 5 仍是 red**（原因见 §6⑤，是探针顺序而非 0012 缺陷）。我未改该脚本以保持 before/after 可比 —— 代价是 after 相位 `ok=false`（35 项里 1 个用例 3 条判据红）。
3. **`extra` 字段不逐字**：首写返回 `extra={"symbol":…,"entries":…}`，**重放**返回 `extra={}`（`'extra','{}'::jsonb`）。这是**0012 之前就有的形状**（before `P2XBEF02` 用例 6 经 C7 重放路径的读数同为 `extra={}`；C7 与闸的重放返回体都写 `'extra','{}'::jsonb`）⇒ **非 0012 引入**，但严格按「重放结果与首次逐字相同」读，`extra` 不逐字。**未修**：0012 已应用并被 checksum 锁住，改文件会让 `migrate.ts` 报 drift（exit 3）；要做只能另开 0013。
4. **未测「未传指纹」分支（§19.6：未传指纹 ⇒ 同键一律按重放）**：本单所有同键重放都带了指纹；干跑自检也只覆盖「同指纹 / 异指纹」两支。
5. **未测历史行（`event_root_key IS NULL`）的键归属**：闸按 `event_root_key = v_key` 归属，历史行（0005 之前的数据）不走闸；本单未构造此类数据（`0005` 已说明该分支由 C7 回退处理）。
6. **并发强度有限**：真并发只做了 2 连接、共 2 次可判读运行（`p2x-02` 两次，胜者分别是 A / B）；未做 ≥3 连接、未做压力/长跑。
7. **未测 pooler（`DATABASE_URL` 池化端点）路径**：本单全部经 `DATABASE_URL_UNPOOLED`（WebSocket）。R63 的 `lock_timeout` 在池化路径下的行为（0005 已注明 pooler 明确拒绝该启动参数）未在本单复核。
8. **未测 `op = settle / hold_release / transfer` 等其它 op 的重放**：矩阵只覆盖 `op = entries`（与缺陷场景一致）。
9. 环境噪声：本单期间有另一子代理在同一仓库改 `frontend/**`（**与本单无交集，我未动该目录**）；`git status` 中 `frontend/**` 的 M 不是本单产生的。

---

## §9 残留登记（append-only ⇒ 不清理）+ 交付物清单

**已知残留（未清理，登记即可）**
```
上一轮三套提交式夹具（Zang 已登记）：uid 起 960379 / 960519 / 960645（各 4 users + 2 currency + 账户 + ~10 行 ledger_entry）
本单 after 相位（P2XFIN01 用例 5 / 5b，必须提交）：
  uid 960203/960204/960205/960206；currency p2xc960197 / p2xd960197；cid 228 / 229
  keys ops:p2x:960197:{c5, c5b, c5:mint, c5:hold, c5b:mint, c5b:hold}；job ref 960199 / 960200
本单 p2x-02（必须提交）：uid 960453–960456；currency p2xq960453；cid 236；keys ops:p2x:960453:{conc, mint, hold}
0012 自检的行为探针：子事务哨兵回滚 ⇒ 零残留（干跑读数 probe_users/currency/ledger/accounts 全 "0"）
ledger_entry 总行数：after 相位前 2116 → 后 2126（+10 = 用例 5/5b 两个提交式夹具）
moneyGuard：cid=1 账户哈希前后一致、平台 0/-1/-2/-3 哈希前后一致（未碰他人余额）
```

**交付物**
```
改：backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql      （§C 18 行修复；71238 B / md5 5b97c96b…）
改：backend-ts/scripts/p2x-01-migration-dry-run.ts                          （fn_after 改在同一事务内读 + 判据收紧）
新：backend-ts/scripts/p2x-02-concurrency-same-key.ts                       （真并发同键：胜者一返回就提交）
新：backend-ts/.p2x-artifacts/p2x-REPORT-P2XFIN01.md                        （本报告）
产物：.p2x-artifacts/p2x-01-migration-dry-run-P2XFIN01.json（干跑通过）
      .p2x-artifacts/p2x-01-migration-dry-run-P2XFINDR01.json（修复前失败取证 42601@55219）
      .p2x-artifacts/p2x-01-migration-dry-run-P2XFINrepro{B,F,B0x,F0x}.json（最小复现）
      .p2x-artifacts/p2x-01-migration-dry-run-P2XFINarr.json（数组追加 5 写法取证）
      .p2x-artifacts/p2x-01-migration-dry-run-P2XFINtG,tH,tI.json（上一轮三变体读数）
      .p2x-artifacts/p2x-00-replay-order-P2XFIN01.{json,txt}（after 相位，与三份 before 并列）
      .p2x-artifacts/p2x-02-concurrency-same-key-P2XFIN01.{json,txt}（真并发同键 13/13 GREEN）
scratch 证据（复核用）：/Users/kevin/.hermes/profiles/zang/cache/scratch/p2xfin/
      0012.broken_committed.sql / 0012.fixed_pristine.sql / 0012.tampered_A2.sql / 0012.tampered_B2.sql
      repro_broken(.sql) repro_fixed / repro_broken_0x / repro_fixed_0x / probe_array_append.sql
      0012.one-char-and-array-append.diff / run_dry.sh / run_neg.sh
```
**未 commit / 未 push**（按硬约束）；`frontend/**` 一字未碰；未启停任何面板托管服务。
