# S34 · 台账 `B16`：`p3v-00` 的 `Y3/Y6` 既有漂移 **定性 + 收口**

> 角色：Kong（实现方）· 派单 = `docs/seafood.master-plan.md` §5.353 B（S34）
> 单值：**判「Unit I（`978ea4a`）的收窄 = 有意加严 ⇒ 前推期望」还是「误伤 ⇒ 改判据」，并给证据链；不得为凑绿改期望。**
> 结论（前置）：**(a) 有意加严 · 更正 ⇒ 前推期望**。证据链见 §1/§2。改后 `p3v-00` 的 `verdicts.fixed_green=true`；`tableFpSame=true`、`closed_set 33/33` 未回退（§3）。
> 产物目录：`backend-ts/.s34-artifacts/20261005T005231Z/`。改动面：`backend-ts/scripts/p3v-00-fold-fix-verify.ts`（+本报告 + 产物）。

---

## §0 对锚

```console
$ cd /Users/kevin/bistro/seafood && git log --oneline -3 && git status --porcelain
9cd77c3 docs: §5.352/v0.352 —— S32c 回执与核盘 …（会话开始时 HEAD）
5e8d06a fix(errors): S32c … sendError 同族 16 处迁 R107 …
07c1767 docs: §5.351/v0.351 —— S32 交回码映射表 … + 新登记 B16（p3v-00 Y3/Y6 既有漂移）
```
- **开工时** `HEAD=9cd77c3`（`main`）。**会话中途** 并行代理提交了派单本身：`HEAD` 现为 **`771badc`**
  （`docs: §5.353/v0.353 —— 派 S33（B12 阶段二）∥ S34（B16 …）`）。⇒ 本单对锚以 `9cd77c3` 起、`771badc` 止，二者在 `backend-ts/src/ledger-errors.ts` 上**无差异**（均 = `7c48d8c3…`）。
- **平行工作树改动（非本单）**：`git status` 见 ` M frontend/src/styles.css`（467 删）—— 系并行单 **S33**（B12 阶段二「先解 card/badge 约束 ⇒ 删第二批」）的**在飞改动**（本会话中曾观察其「干净 ↔ 已改」来回，即 S33 正在写）。**本单全程未触碰 `frontend/**`**；本单的 tracked 改动**仅** `backend-ts/scripts/p3v-00-fold-fix-verify.ts`（§7.3）。
- 被测实现现盘：`backend-ts/src/ledger-errors.ts` sha256 = `7c48d8c3a656eb407ed2005691dcafac1d3cb436ddfabcbd68d3b5770174a62a`（= S32b/S31 前推后的锚，本单未动 `src/**`）。
- 基线副本 `9bc127e4…`（旧）在旧产物；`p3v-00` 的 `baseline` 副本 = `721156cb…`（修复前）、`mutated` 副本 = `907a7e61…`。

---

## §1 两者现取（commit diff + 新旧期望**逐字**）

### 1.1 `git show 978ea4a --stat`（Unit I）

```console
$ git show 978ea4a --stat
commit 978ea4a132be9b37581d0a89cb09b97a56395229
Author: Kevin <kevin@BlueSpace.local>
Date:   Tue Sep 29 02:56:04 2026 +0800
    feat(p3): 判据② 收窄为 type=error 且 message 为字符串 + 承重注释更正（Unit I）+ §5.64/v0.67 —— A4/B7 释放回 500、真驱动事件对象仍 503、我亲跑探针完全复现
 .../_impl/mutated-clause2-narrow2-ledger-errors.ts |  657 ++++++
 .../p3w-01-narrow2-verify-20260928T174943Z.json    | 2148 ++++++++++++++++++++
 .../p3w-01-narrow2-verify-20260928T185516Z.json    | 2148 ++++++++++++++++++++
 backend-ts/scripts/p3w-01-narrow2-verify.ts        |  393 ++++
 backend-ts/src/ledger-errors.ts                    |   90 +-
 docs/audit/p3-errors-fold-narrow.md                |  158 ++++
 docs/seafood.master-plan.md                        |   32 +-
```
> 提交信息**逐字**含：「**判据② 收窄为 type=error 且 message 为字符串**」、「A4/B7 释放回 500、**真驱动事件对象仍 503**」——即作者**自陈为「收窄」**且**点名真对象仍应 503**。
> 全文：`backend-ts/.s34-artifacts/20261005T005231Z/out/978ea4a-stat.txt`；对 `src/ledger-errors.ts` 的 diff：`…/out/978ea4a-ledger-errors.diff.txt`。

### 1.2 Unit I 对「非 PG 事件对象族」判据的**逐字**变更（`src/ledger-errors.ts` `isEventObjectFamily`）

```diff
-  const EventCtor = (globalThis as { Event?: unknown }).Event;
-  if (typeof EventCtor === 'function' && e instanceof (EventCtor as …) ) return true;          // ① 裸 instanceof
-  const o = e as { type?: unknown; message?: unknown };
-  if (o.type === 'error') return true;                                                         // ② 裸 type==='error'
-  const desc = Object.getOwnPropertyDescriptor(e, 'message');
-  if (desc !== undefined && desc.get !== undefined && desc.set === undefined && typeof o.message === 'string') return true;  // ③ own getter-only
-  if (desc === undefined && typeof o.message === 'string') return true;                         // ④ message 非 own 数据属性
-  return false;
+  const EventCtor = (globalThis as { Event?: unknown }).Event;
+  if (typeof EventCtor === 'function') {
+    let isEvent = false;
+    try { isEvent = e instanceof (EventCtor as …); } catch { isEvent = false; }
+    if (isEvent && safeRead(e, 'type') === 'error') return true;        // ①' instanceof **且** type==='error'
+  }
+  if (safeRead(e, 'type') === 'error' && typeof safeRead(e, 'message') === 'string') return true;  // ②' 裸 type → 加 message 合取
+  let desc: PropertyDescriptor | undefined;
+  try { desc = Object.getOwnPropertyDescriptor(e, 'message'); } catch { return false; }
+  if (desc !== undefined && desc.get !== undefined && desc.set === undefined && typeof safeRead(e, 'message') === 'string') return true;  // ③' own getter-only（不变）
+  return false;                                                          // ④ **已删除**
```

**三条判据变更（逐条给「更严/更正」理由）**：

| # | 旧子句 | 新子句 | 效果 | 为何「更严 · 更正」 |
|---|---|---|---|---|
| ① | `e instanceof globalThis.Event` | `… && type === 'error'` | **收窄**：`new Event('message')` / `new Event('open')`（非错误事件）不再命中 | 旧裸判据把**非错误**事件也吃进 503 面（探针 X2/X3 实测）；加 `type` 后释放，DOM 形误差事件仍命中 |
| ② | `type === 'error'` | `type === 'error' && typeof message === 'string'` | **收窄**：`{type:'error'}`（无 message）这类**业务信封**回 500 | 真 `ws.ErrorEvent` 恒有字符串 `message`（`ws` 构造器 `this[kMessage] = options.message === undefined ? '' : options.message`）⇒ 承重路径**不丢**；仅释放无 message 信封 |
| ④ | `desc === undefined && typeof message === 'string'` | **删** | **收窄**：`new Error()`/`new TypeError()`/无参子类/`Object.create(Error.prototype)` 等继承空串 `message` 者不再命中 | `Error.prototype.message === ''` 是字符串 ⇒ 旧末句把「message 非 own 数据属性」**等同于**「是事件对象」，是 9 例误捕中 7 例的唯一来源（把 R108 的 500 缺陷告警静默降级成 503） |

> **承重判定**：Unit I 注释**逐字**声明「真 `ws.ErrorEvent` **只能由**子句② 命中」「**删除本条即回归 LD024 缺陷**」。⇒ 收窄的**唯一目的**是**在不丢真对象的前提下**去误捕 —— 这正是「有意加严」，而非顺手削弱。

### 1.3 现盘 `p3v-00` 里 `Y3/Y6` 的**期望定义与判据式**（改前，逐字）

夹具（`CASES[]`，逐字）：
```ts
{ id: 'Y3_type_error_no_message',        group: 'L1_event_family', desc: "{type:'error'}（无 message）",
  make: () => ({ type: 'error' }), expected_event_family: true },
{ id: 'Y6_proto_getter_only_message',    group: 'L1_event_family', desc: '仅原型 getter 提供 message（无 type）',
  make: () => protoGetterOnly(POISON), expected_event_family: true },
// protoGetterOnly = (msg) => Object.create(Object.defineProperty({}, 'message', { get: () => msg, enumerable: true }))
```
闸门（驱动 `fixed_green`，逐字）：
```ts
const L1_ROWS = caseRows.filter((r) => r.group === 'L1_event_family');
const L1_GREEN = (o) => (o.classify === 'driver_connection_error' || o.classify === 'pool_connection_timeout') && o.code === 'LEDGER_TX_TIMEOUT' && o.status === 503;
const red = (label) => L1_ROWS.filter((r) => !L1_GREEN(r.per_impl[label])).map((r) => r.id);
verdicts: { fixed_green: red('fixed').length === 0, … }
```
⇒ Y3/Y6 在 `L1_event_family` 组内，**期望 = 判定为事件族（classify∈{driver_connection_error, pool_connection_timeout} ∧ code=LEDGER_TX_TIMEOUT ∧ status=503）**。此即**旧期望（过期）**。

### 1.4 旧产物 `20260928T160137Z`（`fixed=9bc127e4…`，pre-Unit I）当时两用例的期望与读数（逐字）

```console
$ node -e "…读取 backend-ts/.p3v-artifacts/p3v-00-fold-fix-verify-20260928T160137Z.json…"
L6.verdicts = {"fixed_green": true, "baseline_red": true, "mutated_red": true}      # fixed_green=true
L6.RED_set_fixed = []
impl_sha256.fixed = 9bc127e4942cb219fc7eeb3cb17997e724d90433b030619f207341bd35ed983d
Y3 : group=L1_event_family  expected_event_family=true  per_impl.fixed = driver_connection_error/LEDGER_TX_TIMEOUT/503  green=true
Y6 : group=L1_event_family  expected_event_family=true  per_impl.fixed = driver_connection_error/LEDGER_TX_TIMEOUT/503  green=true
L4.closed_set = 33 / 33 ; tableFpSame = true
```
> 旧盘此时**期望 = 读数**（都 503）⇒ 两用例 green。**旧期望是按 pre-Unit-I 的判据②/末句④ 写的**（`{type:'error'}` 无 message 命中裸判据②；proto getter message 命中末句④）。

### 1.5 现盘（`fixed=7c48d8c3…`，post-Unit I）读数

```console
$ node_modules/.bin/ts-node --transpile-only scripts/p3v-00-fold-fix-verify.ts
L6 verdicts={"fixed_green": false, "baseline_red": true, "mutated_red": true}
L1 RED_set fixed=["Y3_type_error_no_message","Y6_proto_getter_only_message"]
Y3 : classify=unclassified_non_pg_error  code=LEDGER_TRANSACTION_REQUIRED  status=500  green=False
Y6 : classify=unclassified_non_pg_error  code=LEDGER_TRANSACTION_REQUIRED  status=500  green=False
```
⇒ **同一期望（503）在新判据下读数为 500** ⇒ 探针判 Y3/Y6 红。**差异 100% 来自 Unit I 的判据收窄**（§1.2），与 `message` 契约（S31）无关。

---

## §2 定性 + 证据链

### 判：**(a) Unit I 的收窄 = 有意加严 · 更正** ⇒ 现盘 `false` 是**旧期望过期** ⇒ **前推期望**（非改判据）

证据链（每条 = 出处 + 读数）：

1. **作者自陈意图**：`978ea4a` 提交信息逐字 = 「**判据② 收窄**为 type=error 且 message 为字符串」「A4/B7 **释放回 500**、**真驱动事件对象仍 503**」；`src/ledger-errors.ts` 承重注释逐字 = 「`message` 合取＝**收窄**：放行 `{type:'error'}` … 这类**业务信封**（它们不是事件对象）⇒ 回到 500」。
2. **承重路径未被削弱（关键的「非误伤」反证）**：收窄后真 `ws.ErrorEvent`（探针 **Y1**）**仍绿**
   （`Y1: driver_connection_error/LEDGER_TX_TIMEOUT/503`，`fixture_selfcheck = {ctor_name:'ErrorEvent', own_message_descriptor:'none', type_value:'error', typeof_message:'string'}`）⇒ 它由**收窄后的**子句② 命中。**若真对象被误伤，Y1 必红——但 Y1 绿。**
3. **真对象结构上不会丢**：`ws` 构造器 `this[kMessage] = options.message === undefined ? '' : options.message` ⇒ 真 `ws.ErrorEvent.message` **恒为字符串**，故子句② 的 `message` 合取对真对象**无损失**；`ws` 的 `Event.prototype.type` 恒为 `'error'`。
4. **同行夹具自证「旧口径错」**：探针**自己**把 `P4_business_type_error = {type:'error', payload}` 归入 `L5_false_positive`（`误捕矩阵` = **不该**被当事件族）；而 `Y3 = {type:'error'}` 与 P4 **只差一个 payload、同判别位、同无 message**。旧口径下二者**都**被 503 误捕（旧产物 `P4 captured_by_impl_fixed=true`）⇒ **Y3 该不该是事件族，探针内部本就自相矛盾**；Unit I 的子句② 合取把 Y3/P4 一并释放，**与 P4 的组标注一致**。
5. **末句④ 的删除有独立依据**：旧末句把 `new Error()`/`new TypeError()`/无参子类/`Object.create(Error.prototype)`（`Error.prototype.message === ''` 为字符串）误判成事件族 —— 旧产物中 `P5/P7/P14/P17 captured_by_impl_fixed=true`（9 例误捕中 7 例）。Y6（proto getter-only message、**无 type**）与 `new Error()` 在此判据下**不可区分**（都「own 无 message、读得字符串 message」），且 **真事件对象恒有 `type`**（ws 的 `Event.prototype.type`）⇒ Y6 的形态**本就不是**真事件对象族。
6. **无其它解释**（排除 S31/`message`）：S31 只改 `LEDGER_ERROR_TABLE` 的 message **文本**（33 条中文句⇒英文句），不动 `isEventObjectFamily`；`tableFpSame=true` 两侧恒真可证。差异必来自 `978ea4a`。

**结论**：Unit I 的收窄**有意识、有依据、且不损承重路径**；探针 `Y3/Y6` 的旧期望（须 503）**建立于 pre-Unit-I 判据之上，已过期** ⇒ 按 (a) **前推期望**。
**为何不选 (b)**：(b) 要求「旧口径对 ⇒ 改回判据」。但旧口径**已被证明错**（证据 4/5：把业务信封与 `new Error()` 族误判成事件族，污染 503 面、静默降级 500 告警），改回 = 退回 LD024 缺陷；且 `977…` 明令**不得动 `src/**`**。故 (b) 不成立。

---

## §3 改后读数（前 / 后 + 其余用例逐条不变）

### 3.1 改动（`backend-ts/scripts/p3v-00-fold-fix-verify.ts`，逐处出处）

| 处 | 改前 | 改后 | 出处 |
|---|---|---|---|
| `CASES` Y3 | `group:'L1_event_family'`, `expected_event_family:true`, 在 L1 闸门内（须 503） | `group:'L1_released_non_event'`, `expected_event_family:false`, `note:'S34 前推…'`, 入新闸门（须 500） | Unit I `978ea4a` 判据②（`type==='error' && message 字符串`） |
| `CASES` Y6 | 同上（须 503） | `group:'L1_released_non_event'`, `expected_event_family:false`（须 500） | Unit I `978ea4a` 删末句 `desc===undefined && typeof message==='string'` |
| 新闸门 | 无（Y3/Y6 只在 L1 闸门下要求 503） | `REL_GREEN = classify==='unclassified_non_pg_error' && code==='LEDGER_TRANSACTION_REQUIRED' && status===500`；`verdicts.fixed_green` 增补 `relRed('fixed').length===0` | **加**闸门（非放宽） |
| `independent_event_family_verdict` oracle | 裸 `instanceof Event` / 裸 `type==='error'` / 末句 `desc===undefined && …` | 三处同步前推为收窄后口径 | 同上（否则探针自相矛盾：Y3/Y6 会既「期望释放」又「oracle 称事件族」） |
| `M3` desc | `…分类器整体抛（修前修后同）` | `…修前抛；Unit H/I 安全读后 fixed 落 500（baseline THREW / fixed 500）` | 同提交 `978ea4a`（含 `safeRead` 守卫） |

> 逐字 diff：§1.2、本报告同目录产出 `…/out/978ea4a-ledger-errors.diff.txt`；脚本 diff 见 §7 附。

### 3.2 前 / 后读数（`p3v-00`，纯函数·零 DB）

```console
$ node_modules/.bin/ts-node --transpile-only scripts/p3v-00-fold-fix-verify.ts
```
| 轮次 | 产物 | `verdicts` | `RED_set_fixed` | `tableFpSame` | `closed_set` |
|---|---|---|---|---|---|
| **before**（S34 改前） | `…/probe-artifacts/p3v-00-…-20261005T005000Z.json` | `{fixed_green:false, baseline_red:true, mutated_red:true}` | `[Y3, Y6]` | **true** | **33/33** |
| **after**（改后） | `…/probe-artifacts/p3v-00-…-20261005T005446Z.json` | `{fixed_green:**true**, baseline_red:true, mutated_red:true, released_group_green:**true**}` | **`[]`** | **true** | **33/33** |
| 判负·红（§4） | `…/probe-artifacts/p3v-00-…-20261005T005416Z.json` | `{fixed_green:false, …}` | `[Y3, Y6]` | true | 33/33 |
| 改后·首绿 | `…/probe-artifacts/p3v-00-…-20261005T005339Z.json` | 同 after | `[]` | true | 33/33 |

改后关键 stdout：
```
L1 RED_set fixed=[] baseline=["Y1","Y2","Y4","Y5","Y7"] mutated=["Y1","Y2","Y4","Y5","Y7"]
L1 released_non_event 组闸门 RED fixed=[]（组=["Y3_type_error_no_message","Y6_proto_getter_only_message"]）
L4 closed_set baseline=33 fixed=33 tableFpSame=true (stable 投影；message-inclusive same=false)
L6 verdicts={"fixed_green":true,"baseline_red":true,"mutated_red":true,"released_group_green":true}
```
- **AC2 达成**：`fixed_green=true`；`tableFpSame=true`、`closed_set 33/33` **未回退**（与 S32b 的稳定投影一致）。
- **判负侧仍红**：`baseline_red=true`（`baseline` 副本 5 例落 500）、`mutated_red=true`（删 `if (isEventObjectFamily(e)) return …` ⇒ 5 例落 500）。

### 3.3 「其余用例逐条不变」（取证）

对 `before` 与 `after` 两份产物的 `all_cases[].per_impl.{baseline,fixed,mutated}` **逐字节对拍**：
```console
$ node -e "…比对 p3v-00-…-20261005T005000Z.json vs …005446Z.json 的 per_impl…"
per_impl classify changes: 0        # 52 个用例的实现读数（三副本）逐字节全等
n_all_cases: 52 / 52
```
⇒ **实现读数零变化**（本单未动 `src/**`）；变化的**仅**探针侧的**期望/oracle/desc** —— 且仅涉及 §1.2 判据变更所指向的用例（Y3/Y6 期望 + 8 例 oracle + M3 desc）。其余字段（L2 对照、L3 R107、L5 矩阵记录、L4 稳定投影/闭集）**逐条不变**（`L2_control_mismatches=[]`、`L3_r107_detail_leaks=[]` 前后同）。

---

## §4 判负（红 → 绿）

**主控**：把**被前推的期望临时反向** —— 将 Y3/Y6 的 `group` 由 `L1_released_non_event` **改回** `L1_event_family`（= 恢复旧期望「须 503」）：
```console
$ # 临时反向：Y3/Y6 group := 'L1_event_family'（desc 标 NC 临时反向）
$ node_modules/.bin/ts-node --transpile-only scripts/p3v-00-fold-fix-verify.ts
L1 RED_set fixed=["Y3_type_error_no_message","Y6_proto_getter_only_message"]
L6 verdicts={"fixed_green":false, "baseline_red":true, "mutated_red":true, "released_group_green":true}
#           ↑ 必红 ✅（新判据下 Y3/Y6 落 500，不再满足「须 503」）
$ # 复原：Y3/Y6 group := 'L1_released_non_event'
$ node_modules/.bin/ts-node --transpile-only scripts/p3v-00-fold-fix-verify.ts
L1 RED_set fixed=[]
L6 verdicts={"fixed_green":true, "baseline_red":true, "mutated_red":true, "released_group_green":true}
#           ↑ 回绿 ✅
```
- 产物：`probe-artifacts/…-20261005T005416Z.json`（NC 红）与 `…-20261005T005446Z.json`（复原绿）；stdout：`…/out/p3v-00-NC-red.stdout.txt`、`…/out/p3v-00-after-restored.stdout.txt`。
- **主仓零残留**：复原后 `git diff backend-ts/scripts/p3v-00-fold-fix-verify.ts` **不含** NC 字样（`NC 临时反向` 已消失）；`grep -n "NC 临时反向" scripts/p3v-00-fold-fix-verify.ts` 空（§7 附）。
- **副证**：新闸门本身可判负 —— 若把 `REL_GREEN` 的 `status===500` 临时改成 `status===503`，`released_group_green` 立刻转 `false`（因为现盘 Y3/Y6 = 500）。**未**执行此支（避免与主控重复改文件）；若需另轮可加。

---

## §5 同族扫面（`p3v-00` 里与 `Y3/Y6` **同源**（即 Unit I 收窄/删句/守卫 所致）的用例，逐条判定 + 登记）

**扫描口径**：对拍「旧盘 `fixed=9bc127e4…`（`20260928T160137Z`）」vs「现盘 `fixed=7c48d8c3…`」的 `per_impl.fixed` 三元组 `classify/code/status`，取**有变化**者。结果 **12 例**（`out/s34-triage-evidence.json#same_origin_scan`）：

| # | 用例 | 组（现） | 旧盘 fixed（9bc127e4） | 现盘 fixed（7c48d8c3） | 归因（Unit I 子句） | 判定 / 处置 |
|---|---|---|---|---|---|---|
| 1 | **Y3_type_error_no_message** | `L1_released_non_event` | 503 | 500 | ②（`message` 合取） | **期望已过期 ⇒ 前推**（§3） |
| 2 | **Y6_proto_getter_only_message** | `L1_released_non_event` | 503 | 500 | ④（删末句） | **期望已过期 ⇒ 前推**（§3） |
| 3 | X2_globalEvent_non_error | `L1_counterexample` | 503 | 500 | ①（加 `type`） | **登记**：期望 `expected_event_family=false` 现**已被满足**（旧盘 ① 裸判据误捕 `new Event('message')`；现释放）⇒ **无需改**，随 Unit I **自动转正** |
| 4 | X3_globalEvent_open | `L1_counterexample` | 503 | 500 | ①（加 `type`） | 同上（`new Event('open')`） |
| 5 | P1_Object_create_proto_message | `L5_false_positive` | 503 | 500 | ④（删末句） | **登记**：组标注「不应误捕」现**已满足**（旧盘误捕）；oracle 由 `true→false`（本次已同步） |
| 6 | P3_class_proto_data_message | `L5_false_positive` | 503 | 500 | ④ | 同上 |
| 7 | P4_business_type_error | `L5_false_positive` | 503 | 500 | ②（`message` 合取） | 同上（**Y3 的同形兄弟**，Unit I 一并释放） |
| 8 | P5_new_Error_no_args | `L5_false_positive` | 503 | 500 | ④ | 同上（`Error.prototype.message==='' ） |
| 9 | P7_new_TypeError_no_args | `L5_false_positive` | 503 | 500 | ④ | 同上 |
| 10 | P14_custom_error_no_message | `L5_false_positive` | 503 | 500 | ④ | 同上 |
| 11 | P17_object_create_Error_prototype | `L5_false_positive` | 503 | 500 | ④ | 同上 |
| 12 | M3_throwing_message_getter | `L5_miss` | **THREW** | 500 | `safeRead` 守卫（同提交 978ea4a） | **登记 + 已前推 desc**（本案 `desc` 原文「修前修后同」现为**假**：baseline THREW / fixed 500）；读数改善（不再整体抛） |

**逐条结论**：
- **需前推期望者 = 2 例**（Y3/Y6）—— 因其**被置于 L1 绿闸门下**且期望（503）与新判据冲突 ⇒ 本单已处置。
- **其余 10 例「同源但未被前推」者，逐条判定为「无需改期望」**：X2/X3 的 `expected_event_family=false`、P1/P3/P4/P5/P7/P14/P17 的组标注「误捕·不应捕获」**现已被实现满足**（读数由 503→500，即**转正**）；其原「`captured_as_event_family=true`」记录来自**探针的 stale oracle**（本次已随 ③ 同步前推；前推后 `L5 captured_as_event_family=["X1_ws_true_not_instanceof_globalEvent"]`，与现盘实现一致）。M3 的 desc 文字已前推。
- **未发现其它**被置于绿闸门下、却因 Unit I 而失配的用例（绿闸门 `L1_event_family` 现 6 例全绿：Y1/Y2/Y4/Y5/Y7/Y8）。
- **同源但属「探针自身机制」的一处**：`independent_event_family_verdict` oracle（旧编码了裸①/裸②/末句④）—— 已按 ③ 前推；旧口径读数留痕 = `20260928T160137Z.json`。

---

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因 |
|---|---|---|
| 全项目 `tsc -p tsconfig.json` | **未跑**（`NOT_MEASURED`） | 单文件改动，用 `ts.transpileModule` 语法检查 = **诊断 0**；项目级 tsc 与并行单 S33（`frontend/**`）交叉，跑全量会掺入他单噪声 ⇒ 未跑 |
| `p3v-00` 连库/网络面 | **不适用** | 探针自称「纯函数·零 DB/网络 I/O」（顶部注释逐字）⇒ 无 DB 面可测 |
| `mutated` 副本 `907a7e61…` 的**重新生成** | **未做**（登记） | 该副本 = **旧盘同一 sha**（`before`/`after` 均 `907a7e61…`），即生成于 pre-S31/Unit I，**未**随 `fixed` 前推重造。本单判负只需「删承重子句⇒红」，与 message 表是否最新**无关**（`mutated` 不参与 `tableFp`/闭集）。登记为已知陈旧 |
| 其余探针/脚本 | **未改** | 派单面 = `p3v-00` 单探针；`grep` 证实**无其它**文件引用 `Y3/Y6` 或 `fixed_green`（除 docs 叙述） |
| `frontend/**`、`src/**`、`migrations/**`、`docs/*.spec.md`、`docs/OPEN-ITEMS.md`、`docs/seafood.master-plan.md` | **未触碰** | 硬口径①；本单仅改 `backend-ts/scripts/**` + 报告 + 产物 |
| `B16` 台账行（`docs/OPEN-ITEMS.md`）的**状态翻转** | **未改** | 该文件在硬口径① 禁改面内 ⇒ **留给归位人**（见 §7.5） |

---

## §7 自曝（诚实面）

1. **oracle 前推 ⇒ 独立性下降（已披露）**：③ 把 `independent_event_family_verdict` 同步为收窄后口径后，它与 `isEventObjectFamily` **同规格**，作为「独立第二意见」的交叉验证价值**降低**（变为「规格复述」）。选择前推而非保留，是因**保留会让产物自相矛盾**（Y3/Y6 会既「期望释放」又「oracle 称事件族」）；旧口径读数已**留痕**于 `20260928T160137Z.json`。**oracle 不参与任何红/绿闸门** ⇒ 此改动**不可能**用于凑绿。
2. **`RED_set_baseline` / `RED_set_mutated` 组成变化**：由旧 `[Y1,Y2,Y3,Y4,Y5,Y6,Y7]` 变为 `[Y1,Y2,Y4,Y5,Y7]` —— 系「Y3/Y6 在**新口径**下期望 500，而 baseline/mutated 读数**本就是 500**」的**直接后果**（非断言减少）：新增闸门 `REL_GREEN` 只在 fixed 侧要求 500，在 baseline/mutated 侧**恒绿**（Y3/Y6 在旧副本里本就是 500）。`baseline_red`/`mutated_red` 仍 `true`。**净断言数增加**（+1 组闸门）。
3. **`frontend/**` 非本单**：` M frontend/src/styles.css` 为并行单 **S33** 的**在飞改动**（本会话中「干净↔已改」来回出现，即 S33 正在写），**非本单**。本单 tracked 改动**仅** `backend-ts/scripts/p3v-00-fold-fix-verify.ts`（`git diff --name-only` 中另见 `frontend/src/styles.css` 请归 S33）。
4. **HEAD 中途移动**：开工 `9cd77c3` → 现 `771badc`（并行代理提交本派单）。对锚已锁 `src/ledger-errors.ts` 无差异（均 `7c48d8c3…`）。
5. **台账 `B16` 未在本单翻转**：`docs/OPEN-ITEMS.md`（禁改面）内的 `B16` 行仍为「未决」措辞；**归位/收口人**应据本报告把 `B16` 标为「已闭环：有意加严⇒已前推」。同理 `docs/seafood.master-plan.md` 未改。
6. **我改动/挪动的文件**：① 改 `backend-ts/scripts/p3v-00-fold-fix-verify.ts`（唯一 ` M` 代码面）；② 新建 `backend-ts/.s34-artifacts/20261005T005231Z/**`（报告产物 + 我的 6 份探针运行产物 stdout/json）；③ 把**我这次**运行落进 `.p3v-artifacts/` 的 6 份 `p3v-00-…-20261005T005{000,233,339,416,446,611}Z.json` **迁入** `.s34-artifacts/<runid>/probe-artifacts/`（工作树不留我的散件）；**未动** S32b 遗留的 `.p3v-artifacts/…-20261005T00{0252,1748}Z.json`（他单产物）。
7. **未执行「副证判负」支**（改 `REL_GREEN` 期望 503）—— 与主控判负重合并，避免多轮改文件（§4 已注）。
8. **`expected_worktree_sha256='7c48d8c3…'`**：本单未动 `src/**`，故该锚**未变**且仍**不参与** red/green（仅留痕）——与 S31b/S32b 判定一致。

---

### 附：产物清单（`backend-ts/.s34-artifacts/20261005T005231Z/`）
```
out/978ea4a-stat.txt                              # git show 978ea4a --stat
out/978ea4a-ledger-errors.diff.txt                # Unit I 对 src/ledger-errors.ts 的逐字 diff
out/s34-triage-evidence.json                      # 期望逐字对照 + 同源 12 例扫描 + 三盘 verdicts
out/p3v-00-after.stdout.txt                       # 改后首绿
out/p3v-00-NC-red.stdout.txt                      # 判负·红
out/p3v-00-after-restored.stdout.txt              # 复原·绿
out/p3v-00-final-confirm.stdout.txt               # 最终确认·绿
probe-artifacts/p3v-00-…-20261005T005000Z.json    # S34 before（fixed_green=false, RED={Y3,Y6}）
probe-artifacts/p3v-00-…-20261005T005233Z.json    # 改后（中间轮）
probe-artifacts/p3v-00-…-20261005T005339Z.json    # 改后首绿
probe-artifacts/p3v-00-…-20261005T005416Z.json    # 判负·红
probe-artifacts/p3v-00-…-20261005T005446Z.json    # 复原·绿
probe-artifacts/p3v-00-…-20261005T005611Z.json    # 最终确认·绿（终态）
probe-artifacts/p3v-00-…-20261005T001748Z.S32b-crossref.json  # S32b 前推件（对照副本）
p3v-00.after.ts / p3v-00.final.ts                 # 改后脚本快照（after=含更正注释前的中间态；final=最终）
```

---

## §8 一页结论

- **定性**：Unit I（`978ea4a`）题 ②「`type==='error'` ⇒ 追加 `message` 为字符串」+ 删末句④ = **有意加严 · 更正**（承重路径 Y1 真对象仍绿；释放的是业务信封与 `new Error()` 族误捕）。
- **处置**：**前推期望**（Y3/Y6 移出 `L1_event_family` ⇒ 新组 `L1_released_non_event`，期望 500），**加**组闸门 `REL_GREEN` 并计入 `fixed_green`；oracle/M3 desc 同步前推。**未改任何 `src/**` 判据、未删断言、未放宽闸门。**
- **读数**：`fixed_green` `false → true`；`RED_set_fixed` `[Y3,Y6] → []`；`tableFpSame=true`、`closed_set 33/33` **未回退**；实现读数（52 例 ×3 副本）**逐字节不变**。
- **判负**：反向改回期望 ⇒ `fixed_green=false`（红）；复原 ⇒ `true`（绿）；主仓零残留。
- **同族**：同源 12 例，2 例需前推（已做）、10 例判定「无需改」（其中 oracle 已同步、M3 desc 已前推）。
