# QA · P3-ERRORS-FOLD-FIX（Unit G · Neng 独立质检）· `backend-ts/src/ledger-errors.ts` 分类缺口修复

- 被检件：`backend-ts/src/ledger-errors.ts` 的**非 PG 事件对象族分类缺口修复**（交接件 `docs/audit/p3-errors-fold-fix.md`，Kong / Unit E，`deleg_c3516af3`）
- 被检件工作树 sha256 = `9bc127e4942cb219fc7eeb3cb17997e724d90433b030619f207341bd35ed983d`（**实测**）
- baseline sha256 = `721156cbf296b19c7c4a480264f88b49878d99104b8f87453bafce564745df8b`（**实测**，取自 `git show HEAD^:`；与交接件所载值逐字节一致）
- 角色：**Neng（独立质检）**；单号 **Unit G / QA-ERRORS-FOLD-FIX**
- 环境：Node v18.19.0 · `@neondatabase/serverless` 0.6.1 + `ws` 8.22.0 · Neon PG 18.6
- 本单**禁跑**写库套件（有并行单在跑）；只做**纯函数探针 + 只读 SQL**。

---

## 0. 结论（verdict）：**部分可用**

修复**本身要解决的问题被独立复现为已解决**（真 `ws.ErrorEvent` 与其他 7 种事件对象形态修后一律 500→503、既有 13 类对照逐字节不变、无原始信息外泄、无新码、无新状态、`tsc` 干净、DB 指纹未动、变异判负成立）。**但** L4 的验收条款「除事件族 500→503 外无其它状态变化」被实测**推翻**：判据 ③ 的第二子句过宽，使 **9 类非事件对象**同样发生 500→503（含最现实的 `new Error()`）。该面在交接件里标为 `NOT_MEASURED`（§8），本单补测后**判定为需要收窄**。

| leg | 读数（run `20260928T160137Z`，除注明者） | 判定 |
|---|---|---|
| **L1** 判据覆盖 | 8/8 事件对象族 → `LEDGER_TX_TIMEOUT`/**503**（含**真** `ws.ErrorEvent`，`ctor.name=ErrorEvent`、`instanceof globalThis.Event=false`）；`RED_set(fixed)=[]` | **绿** |
| **L2** 对照不变 | 13/13 既有形态 `code`/`status`/`details` 逐字段**逐字节相同**（`control_mismatches=[]`） | **绿** |
| **L3** R107 | 敏感文本/栈帧 **0 泄漏**（`r107_detail_leaks=[]`，4/4）；服务端诊断面 4/4 **可取到**原始 message（含栈帧原文） | **绿** |
| **L4** 对外语义 | 闭集 `33` 不变、`LEDGER_ERROR_TABLE`/`BUCKETS` 指纹**相同**；**但**「除事件族外无其它状态变化」**为假**：19 处状态变化中 **11 处非事件族申报**（其中 9 处为真正的**非事件对象**） | **红** |
| **L5** 误捕面（交接件 `NOT_MEASURED`） | 已实测：7/20 误捕形态命中 + 2 个**非错误** `globalThis.Event` 命中；方向**恒为 500⇒503**；漏捕侧 4/4 未命中（含 1 例分类器整体抛） | **黄 · 须收窄** |
| **L6** 变异判负 | `RED(baseline)=7` → `GREEN(fixed)=[]` → `RED(mutated)=7`，三态各有 sha256（`721156cb…` / `9bc127e4…` / `907a7e61…`） | **绿** |
| **L7** `tsc` + 库侧 | `npx tsc --noEmit` **exit 0 / 输出 0 行**（退出码直接取，未经管道）；DB 侧 29 函数 + 4 触发器 md5 与交接件所载**逐个相同**；`public` 非 internal 触发器 **43**（非 `O`=**0**）；`migrate` = **17 skipped**（exit 0） | **绿** |

**一句话**：修复在它**申报的范围**内全部成立且可复制；失败的只有一条**范围口径**——判据把「`message` 不是 own 数据属性」等同于「是事件对象」，于是任何**没有自己 `message` 的 `Error`**（`Error.prototype.message === ''`）也被判成事件对象族，把 R108 的 500 缺陷告警降级成 503 瞬时故障。

---

## 1. 被检对象与**独立性硬声明**

### 1.1 会话内环境变动（影响 baseline 取法，如实报出）

- 本会话**开始时**：`HEAD=0367935`，工作树 `M backend-ts/src/ledger-errors.ts`，`git show HEAD:…` = `721156cb…`（= 交接件所载 baseline）。
- **质检中途**：并行单元把该修复**提交**为 `ade3376`（"fix(ledger-errors): classify the event-object family as a driver connection error (503) …"），`HEAD` 变为 `ade3376`、其父 `88783a2`。
- ⇒ 我改用 **`git show HEAD^:`（`88783a2`）** 取 baseline，实测 sha256 = `721156cb…` **与交接件所载 baseline 逐字节一致**；`git diff --numstat HEAD^ HEAD -- backend-ts/src/ledger-errors.ts` = `134 / 0`；`git cat-file -p HEAD:…` 的 sha256 = 工作树 sha256 = `9bc127e4…` ⇒ **被提交的内容与我被检的工作树内容完全一致**。
- 副作用：`git status` 期间还出现并行单元对 `scripts/p1o-00-escape-sweep.ts`、`scripts/p2w-00-p2fix-verify.ts` 的改动，以及 `public.currency` 行数在我两次只读读数之间 **123 → 124**。**本单未触碰这些文件、未写库**；这正好印证「禁跑写库套件」的必要性。

### 1.2 独立性：哪些读数自建、哪些只读引用

| 类别 | 内容 |
|---|---|
| **本单自建（全部判定依据）** | 探针 `backend-ts/scripts/p3v-00-fold-fix-verify.ts`（纯函数，零 DB/网络 I/O）、只读哨兵 `backend-ts/scripts/p3v-01-db-readonly.ts`、变异副本生成器 `backend-ts/.p3v-artifacts/_impl/make-mutated.js`、全部夹具（事件对象族 8 例、对照 13 例、误捕 20 例、漏捕 4 例、反例 3 例、R107 4 例）与本报告所有读数 |
| **只读引用的对照基线**（**不作本单证据**） | 交接件 `docs/audit/p3-errors-fold-fix.md`（比对「自报」是否成立）；`.p3t-artifacts/**`（Kong 的读数，仅用于判断是否被我独立复现）；`docs/audit/p3-p1o-500-rca.md` 标题级引用 |
| **未复用** | 未运行、未引用 Kong 的 `p3t-00-fold-fix-verify.ts` 作证据；未使用其 8 例事件族夹具、13 例对照夹具的**任何代码**；`p3t-*` 的 sha256 未进入我的判据 |
| **不可比声明** | 我的 8 例事件族夹具与 Kong 的 8 例**不是同一组输入**（我的 message 刻意**不含**既有正则关键词）⇒ 修前 `RED` 计数为 **7**（Kong 自报 5，其 E2/E6/E8 本就绿）。**只对我的夹具负责**；Kong 的逐例读数我未逐例复现。 |

---

## 2. L1 判据覆盖（自建夹具 + 自证）

**真实 `ws.ErrorEvent` 的正解与自证**（探针现场读数）：

| 自证项 | 读数 |
|---|---|
| `require('ws').ErrorEvent` | `undefined`（`ws` 的 `package.json#exports` 只导出 `"."` 与 `"./package.json"`） |
| 绝对路径 `node_modules/ws/lib/event-target.js` 的导出 | `["CloseEvent","ErrorEvent","Event","EventTarget","MessageEvent"]` |
| `new ErrorEvent('error',{message,error}).constructor.name` | **`ErrorEvent`** |
| `Object.getOwnPropertyDescriptor(ee,'message')` | **`null`**（无 own `message`） |
| 原型 `message` 描述符 | `get` 存在 / **`set` 不存在** |
| `ee instanceof globalThis.Event` | **`false`**（`ws` 用自带 `Event`） |

⇒ 交接件 §1 关于 `ws` 形状的三条事实（含「`require('ws').ErrorEvent` 不存在」「`instanceof Event === false`」）**独立成立**。

事件对象族逐例（修后 / 修前）：

| # | 夹具 | 修后 `classify` / `code` / `status` | 修前 | 判定 |
|---|---|---|---|---|
| Y1 | **真 `ws.ErrorEvent`**（绝对路径） | `driver_connection_error` / `LEDGER_TX_TIMEOUT` / **503** | `unclassified_non_pg_error` / `…` / 500 | 绿 |
| Y2 | DOM 形（`extends globalThis.Event` + 原型 getter） | `driver_connection_error` / `LEDGER_TX_TIMEOUT` / **503** | 500 | 绿 |
| Y3 | `{type:'error'}`（**无 message**） | `driver_connection_error` / `LEDGER_TX_TIMEOUT` / **503** | 500 | 绿 |
| Y4 | `Object.freeze({type:'error',message})` | `driver_connection_error` / `LEDGER_TX_TIMEOUT` / **503** | 500 | 绿 |
| Y5 | 自有 getter-only `message`（无 setter、无 type） | `driver_connection_error` / `LEDGER_TX_TIMEOUT` / **503** | 500 | 绿 |
| Y6 | 仅原型 getter 提供 `message`（无 type） | `driver_connection_error` / `LEDGER_TX_TIMEOUT` / **503** | 500 | 绿 |
| Y7 | 外层无 `code`、内层 `e.error.code='ECONNRESET'` | `driver_connection_error` / `LEDGER_TX_TIMEOUT` / **503** | 500 | 绿 |
| Y8 | 事件对象且 message 命中池超时正则 | `pool_connection_timeout` / `LEDGER_TX_TIMEOUT` / **503** | 同左 | 绿（既有更精确 reason 优先） |

`RED_set(fixed) = []`；`RED_set(baseline) = [Y1..Y7]`。

**关键反例（§5.7⑧，构造形态给定）**：

| # | 构造形态（逐字） | 读数 | 结论 |
|---|---|---|---|
| X1 | `new (require('…/ws/lib/event-target.js').ErrorEvent)('error',{message:'boom',error:Object.assign(new Error('boom'),{code:'ECONNRESET'})})` | `instanceof globalThis.Event = false`；**仍被命中** → 503 | ✅ **仅靠判据 ① 必漏**；②/③ 兜住 ⇒ 「只依赖 `instanceof Event`」的担心在**真物**上成立且已被覆盖 |
| X2 | `new globalThis.Event('message')`（**非错误**事件，无 message） | **被命中** → **503** | ❌ 判据 ① **过捕**：任何 `Event` 实例都被当事件对象族 |
| X3 | `new globalThis.Event('open')`（`type` 连 `error` 都不是） | **被命中** → **503** | ❌ 同上，① 不看 `type` |

---

## 3. L2 对照不变（逐字节对拍）

13 例既有形态，`baseline` vs `fixed` 对 `classify`/`code`/`status`/`details`（键排序后 JSON）**逐字节比较**：

- `control_mismatches = []` ⇒ **13/13 完全不变**（含 PG `22003` 两形态、`LD016`、`ECONNRESET`、池超时、`socket hang up`、`08P01`、`23514+account_bal_guard`、`23505+ledger_idem_uniq`、`57014`、`53000`、命名码直通、无 `name` 裸对象）。
- 与交接件 §4.3 的「13 例逐字节相同」**独立复现为真**；且我读到 C13 的 `details` 与交接件 §2.2 表**逐字符相同**（`{"cause":"non_pg_error","error_code":"none","error_name":"Error","reason":"unclassified_non_pg_error"}`）⇒ 交接件 §4.3 的 `error_name:"Error"` 一处与我实测一致。
- 因此「残余未知类仍折 500」的既有行为在 C1/C2/C3/C13 上**未变**。

---

## 4. L3 R107（对外不泄 + 服务端可取）

夹具 message 统一为 `password=s3cr3t-T0P-secret-9914 at LedgerPost (/app/src/ledger.ts:12:9)`。

| # | 形状 | 对外 `details` | 含敏感串/栈帧 | 服务端 `ledgerErrorDiagnostics()` |
|---|---|---|---|---|
| S1 | 真 `ws.ErrorEvent` | `{"error_code":"none","reason":"driver_connection_error"}` | 否 / 否 | `message`=**原文**（含密码与栈帧文本）、`constructor_name=ErrorEvent`、`event_object_family=true`、`cause_chain_len=1` |
| S2 | `{type:'error',message}` | 同上 | 否 / 否 | 同原文可取 |
| S3 | own 数据 `message`（走 500 兜底） | `{cause,error_code,error_name,reason}`（**无 message/stack 键**） | 否 / 否 | 同原文可取 |
| S4 | `new Error(敏感串)`（真栈） | 同上 | 否 / 否 | 同原文可取 + `stack_head_len=5` |

- `r107_detail_leaks = []`（4/4；判据 = `details` 的 JSON 含敏感串 / 含 `.ts:\d+` 或 `at \w+ \(` / 含 own `message` 键 / 含 own `stack` 键）。
- `details_keys` 实测只出现 `cause`/`error_code`/`error_name`/`reason` 四类非敏感标量；**无** `message`、**无** `stack`。
- **服务端可取 4/4**（否则「诊断丢失」未修）：交接件「② 原始信息只进服务端」**成立**；`ledgerErrorDiagnostics` 只读、无副作用（我未观察到它对输入的任何写入，`Object.freeze` 用例亦未抛）。
- 交接件 §4.2 的 `r107_detail_leaks=[]` **独立复现为真**。

---

## 5. L4 对外语义（**本单唯一的红**）

| 子项 | 读数 | 判定 |
|---|---|---|
| 闭集大小 | baseline **33** / fixed **33** | 未新增码 |
| `LEDGER_ERROR_TABLE` + `LEDGER_ERROR_BUCKETS` + `LEDGER_ERROR_CODES` + `DEFECT_ERROR_CODES` + `LEDGER_BENIGN_CODES` 合并指纹 | 两侧 sha256 **相同** | 状态映射表未改 |
| **状态变化面** | 19 处 `code`/`status` 变化；其中 **11 处**不在「事件族」申报内 | **违反「除事件族 500→503 外无其它状态变化」** |

11 处非申报变化里，2 处（`S1`/`S2`）**实质上就是事件对象**（我的 R107 组复用了事件夹具，只是分组标签不同，非申报项），故**真正非事件对象的变化 = 9 处**：

| 输入 | 修前 | 修后 |
|---|---|---|
| `new Error()` | `LEDGER_TRANSACTION_REQUIRED` / **500** | `LEDGER_TX_TIMEOUT` / **503** |
| `new TypeError()` | 500 | 503 |
| `class X extends Error {}` 且 `new X()` | 500 | 503 |
| `Object.create(Error.prototype)` | 500 | 503 |
| `Object.create({message:'x'})` | 500 | 503 |
| 类实例（`message` 定义在**原型**上） | 500 | 503 |
| 业务信封 `{type:'error', payload}` | 500 | 503 |
| `new globalThis.Event('message')` | 500 | 503 |
| `new globalThis.Event('open')` | 500 | 503 |

**根因**（代码行 `backend-ts/src/ledger-errors.ts:377`）：判据 ③ 第二子句 `desc === undefined && typeof o.message === 'string'` 把「`message` 不是 own 数据属性」等同于「事件对象」。而 `Error.prototype.message === ''` ⇒ **任何没有自己 `message` 的 `Error` 子类实例**都命中（判据 ① 另外独立地过捕全部 `Event` 实例）。

---

## 6. L5 ★ 误捕 / 漏捕矩阵（交接件 `NOT_MEASURED`，本单补测）

`own` 列 = `Object.getOwnPropertyDescriptor(input,'message')` 的形态；`命中` = 独立复算的「事件对象族」判据结果。
**方向**：所有误捕的对外变化**一律是 500⇒503**（无 400/409 误判、无崩溃、无泄漏）。

### 6.1 误捕（命中但非基础设施对象）

| # | 构造形态（逐字） | own | 命中 | 修前 | 修后 | 误报? |
|---|---|---|---|---|---|---|
| P1 | `Object.create({message:'x'})` | `none` | **是** | 500 | **503** | ❌ 否（普通对象） |
| P3 | 类实例，`message` 挂在 `X.prototype`（数据属性） | `none` | **是** | 500 | **503** | ❌ 否 |
| P4 | `{type:'error', payload:{a:1}}` | `none` | **是** | 500 | **503** | ❌ 业务信封 |
| **P5** | **`new Error()`** | `none` | **是** | 500 | **503** | ❌ **最现实的一例** |
| P7 | `new TypeError()` | `none` | **是** | 500 | **503** | ❌ |
| P14 | `class X extends Error{}` + `new X()` | `none` | **是** | 500 | **503** | ❌ |
| P17 | `Object.create(Error.prototype)` | `none` | **是** | 500 | **503** | ❌ |
| X2/X3 | `new globalThis.Event('message'/'open')` | `none` | **是** | 500 | **503** | ❌ 非错误事件（判据 ①） |

### 6.2 未误捕（正确放行 / 边界）

| # | 构造形态 | own | 命中 | 读数 |
|---|---|---|---|---|
| P2 | `{message:'x'}` | `data` | 否 | 500（不变） |
| P6 | `new Error('boom')` | `data` | 否 | 500（不变） |
| P8 / P9 / P10 | `{}` / `[]` / `Object.create(null)` | `none` | 否 | 500（不变；无字符串 `message`） |
| **P11** | 真业务对象 `new LedgerError('LEDGER_AMOUNT_INVALID',…)` | `data` | 否 | **400**（不变，未受污染） |
| P12 | 普通 DTO `{id,kind,amount}` | `none` | 否 | 500（不变） |
| P13 / M1 | 自有 getter **+ setter** 的 `message` | `accessor(get,set)` | 否 | 500（不变；判据 ③a 要求无 setter） |
| P15 | pg 形 `{code:'23514',constraint:'account_bal_guard',message}` | `data` | 否 | `LEDGER_NEGATIVE_BALANCE_GUARD`/500（不变） |
| P16 / P18 / P19 | `Buffer` / 函数值 / 字符串原始值 | `none`/`n/a` | 否 | 500（不变） |
| P20 | `Object.freeze({message:'x'})` | `data` | 否 | 500（不变） |
| M2 | `{type:'Error', message:'x'}`（大小写不同） | `data` | 否 | 500（不变） |
| M4 | `{message:'write EPIPE'}` | `data` | 否 | 500（不变） |

### 6.3 漏捕侧

| # | 现象 | 读数 | 判定 |
|---|---|---|---|
| M3 | `message` getter **抛异常** | 分类器**整体抛**（`classifyNonPgError` = THREW；`normalizeLedgerError` = THREW） | **修前修后同**（非本单引入）；`ledgerErrorDiagnostics` 有 `safeMessage` 守卫，但**分类路径没有** ⇒ 残余健壮性缺口，建议记档 |
| — | 真 `ws.ErrorEvent` | 命中 | **未漏**（X1） |

### 6.4 误捕是否「安全失真方向」

- **对调用方：偏安全。** 全部误捕都是 500⇒503，即「实现缺陷」被改述成「暂时不可用、可重试」，没有把 4xx 说成 5xx、没有把错误说成成功。
- **对运维/告警：偏危险。** `500` 类码的契约是「**只允许由不变式被破坏触发且必须告警**」（R108）。误捕把这些**真缺陷**降级成 503 ⇒ **R108 告警丢格**；同时调用方会对一个**确定性**失败做重试放大。
- **影响面（必须指出）**：凡「`throw`/`reject` 一个**没有自己的 `message`** 的 `Error`（含 `new Error()`、`new TypeError()`、无参子类构造、`Object.create(Error.prototype)`）或「任何 `Event` 实例」落到 `normalizeLedgerError` 的路径，都会把 500 缺陷告警静默成 503。**`new Error()` 在真实代码里是常见写法**，因此这不是纯理论边界。
- **无法量化**：生产路径上这些形态的实际出现频率 = **`NOT_MEASURED`**（本单不做在线故障注入、不做全量 `node_modules` 扫描）。

### 6.5 收窄建议（**不改被检件**，仅建议）

以我的读数支撑的最小收窄（每条都有上表读数）：

1. **判据 ① 加 `type==='error'`**：`instanceof Event` 单独成立会把 `new Event('message')`/`new Event('open')`（X2/X3）也吃进来；加 `type` 条件后 X2/X3 **释放**，Y2（DOM 形，`type='error'`）**仍命中**。
2. **删判据 ③ 第二子句**（`desc === undefined && typeof message === 'string'`）：它是 9 例误捕中 7 例（P1/P3/P5/P7/P14/P17 + P4 之外的）的唯一来源。删后 **Y1（真 `ws.ErrorEvent`）不受影响** —— 实测真物 `type==='error'` ⇒ 由判据 ② 命中（X1 读数即支撑）；**Y6**（「仅原型 getter、连 `type` 都没有」）会随之释放，而 Y6 是我构造的**非生产形态**（`ws.ErrorEvent` 恒带 `type='error'`）。
3. 保留判据 ③ 第一子句（自有 getter-only 访问器，Y5）：它不误捕（P13/M1 因有 setter 而正确放行）。

> 即：`事件对象族 ≜ (instanceof Event ∧ type==='error') ∨ type==='error' ∨ (自有 getter-only 字符串 message)`。此式在**我的 8 例**上仍 8/8 绿、在**我的 9 例误捕**上全部释放。是否采纳由 Zang/仲裁裁定；**本单不实施**。

---

## 7. L6 变异判负（必须在**副本**上做）

三份实现副本同进程加载、同一套夹具、同一套断言（`RED` = 事件对象族里任一未落 503）：

| 副本 | 来源 | sha256 | `RED_set` | 判定 |
|---|---|---|---|---|
| **fixed** | 工作树 `src/ledger-errors.ts`（= HEAD 提交内容） | `9bc127e4…983d` | `[]` | **绿** |
| **baseline** | `git show HEAD^:…` | `721156cb…df8b` | `[Y1…Y7]`（7 例） | **红** |
| **mutated** | fixed 删掉 `  if (isEventObjectFamily(e)) return 'driver_connection_error';` 一行（64 字符） | `907a7e61…08af` | `[Y1…Y7]`（7 例） | **红** |

- `diff mutated fixed` = 恰好 1 行（`391a392`）⇒ 变异**只**削弱这一行判据，非「改了别处」。
- **「逐字节还原后回绿」的证明**：fixed 副本的 sha256 `9bc127e4…` 与 `git cat-file -p HEAD:backend-ts/src/ledger-errors.ts | shasum -a 256` **完全相同**，且与工作树 sha **完全相同** ⇒ 红态→绿态之间的差异**只可能**来自那 +134 行；`git diff --numstat HEAD^ HEAD` = `134 / 0`。**我没有原地改过 `src/ledger-errors.ts`**（全程只读；`git status` 中该文件既不 `M` 也无新改动）。
- 交接件 §5 的三段自证（红/绿/恢复）**独立复现为真**（用副本而非 `cp` 覆盖工作树，比其做法更保守）。
- **单次绿不足以推翻多次观测**（§5.7⑨）：本单同一进程内**一次**跑三态即得红/绿/红，且 sha256 三态互异 ⇒ 判负有效；但我只有**一次** run（`20260928T160137Z`），未做重复 run 的稳定性统计。

---

## 8. L7 `tsc` 与库侧

| 项 | 命令 / 口径 | 读数 | 判定 |
|---|---|---|---|
| `tsc` | `npx tsc --noEmit > .p3v-artifacts/p3v-tsc-fixed.log 2>&1; echo $?`（**退出码直接取，未经管道**，§5.7②） | **`TSC_EXIT=0`**，日志 **0 行** | 0 error |
| DB 函数 | 只读 `SELECT … md5(pg_get_functiondef(oid))`，`public` + `proname LIKE '%ledger%'` | **29** 个；关键指纹 `ledger_post_event e784a58681ae971bcd97f3043f293002`、`ledger_error_for_sqlstate fc8330a039afa6255d226c7bca5baf81`、`ledger_raise 6cb815387f24a65c8a9caac62981b26a`、`ledger_check_budget aca4376617c1a20b816f2ee7ce846669` | **与交接件 §7.2 逐个相同** |
| DB 触发器 | 同上，`NOT tgisinternal AND tgname LIKE '%ledger%'` | **4** 个；`trg_ledger_entry_append_only 7bc22ddc2081b6a89e8f95ba9190a2ff`、`trg_ledger_entry_commission_conservation 84589204d2cef4937c6b2bf98e960c1a` | **与交接件 §7.2 逐个相同** |
| 已知真库自测 | `public` 触发器计数（口径两版） | 全量 **175** / **非 internal = 43** / 非 `O` = **0** | 与「43（非 `O` = 0）」**吻合** |
| 迁移 | `npx ts-node --transpile-only scripts/migrate.ts > log 2>&1; echo $?` | **`MIGRATE_EXIT=0`**；`"action": "skipped"` 出现 **17** 次 | **17 skipped** |
| 行数（只读，显式 `public.`） | `public.users 583` / `account 387` / `ledger_entry 3201` / `referral 293` / `commission_policy 25`；`currency 123→124`（两次读数之间被**并行单**写） | `ledger_entry=3201` 恒定；`neon_auth.account=0`（同名不同 schema，已显式限定） | 与已知真库现状一致 |
| 补充 | `public.schema_migration` 行数 | **17** | 交接件 §7.3 注记的「`schema_migrations` 读数为 `null`」是**其探针表名口径缺口**；本单用正确表名读到 **17**，与 `17 skipped` 自洽 |

---

## 9. 我的自建夹具 / 探针清单

| 文件 | 性质 | 说明 |
|---|---|---|
| `backend-ts/scripts/p3v-00-fold-fix-verify.ts` | 自建探针（**纯函数 · 零 DB/网络 I/O**） | 同进程加载 fixed/baseline/mutated 三副本，跑 L1–L6；唯一落盘 = 自己的 run-tagged artifact |
| `backend-ts/scripts/p3v-01-db-readonly.ts` | 自建只读哨兵 | 只 `SELECT`：行数（显式 `public.`）/ 函数与触发器 md5 / 触发器计数 / `schema_migration` 行数 |
| `backend-ts/.p3v-artifacts/_impl/make-mutated.js` | 自建变异生成器 | 从 `src` 读、向 `_impl/` 写；删一行判据，找不到即抛 |
| `backend-ts/.p3v-artifacts/_impl/baseline-ledger-errors.ts` | baseline 副本 | `git show HEAD^:…`，sha `721156cb…` |
| `backend-ts/.p3v-artifacts/_impl/mutated-ledger-errors.ts` | 变异副本 | sha `907a7e61…` |
| `backend-ts/.p3v-artifacts/p3v-00-fold-fix-verify-20260928T160137Z.json` | **有效读数**（L1–L6 全量） | 判定依据 |
| `backend-ts/.p3v-artifacts/p3v-00-fold-fix-verify-20260928T160003Z.json` | **作废读数**（保留可回溯，不参与判定） | 见 §11.1 |
| `backend-ts/.p3v-artifacts/p3v-01-db-readonly-neng22-{post,final}-*.json` | 只读 DB 读数 | `final` = 补 `NOT tgisinternal` 口径后 |
| `backend-ts/.p3v-artifacts/p3v-{tsc-fixed.log,migrate.log,p3v-01-stdout-*.log}` | 命令原始输出 | 退出码由调用方直接取 |

夹具构造要点（逐字）：真 `ws.ErrorEvent` 走**绝对路径** `node_modules/ws/lib/event-target.js`（并自证 `ctor.name==='ErrorEvent'`）；敏感串 `password=s3cr3t-T0P-secret-9914` + 栈帧文本 `at LedgerPost (/app/src/ledger.ts:12:9)`；事件族 8 例、对照 13 例、误捕 20 例、漏捕 4 例、反例 3 例、R107 4 例。

---

## 10. 未验证清单（`NOT_MEASURED`，**禁填 0/空数组占位**）

| 项 | 状态 | 原因 / 口径 |
|---|---|---|
| **在线端到端复现**（把连接层逼到事件对象形态 → 穿路由层 → 观察 HTTP 503） | `NOT_MEASURED` | 本单**禁跑**写库套件（`p1o-00-escape-sweep` / `p2w-00-p2fix-verify` 及任何写库套件）；不做在线故障注入 |
| 交接件自报的 **`unexpected_500 = 0/0/0`** 与 `expectation_mismatches` 三读数 | `NOT_MEASURED` | 同上（端到端套件读数**未独立复现**）；我只独立复现了**纯函数层**的对照与事件族判定 |
| Kong 的 8 例事件族 / 13 例对照夹具**逐例**读数 | `NOT_MEASURED` | 未复用其夹具代码（独立性要求）⇒ 无法逐例对拍；我的手写 13 例对照**语义等价**于交接件 §2.2 表（读数一致），但非同一实现 |
| §6.3 那格抖动（`E-W4_unfreeze/over_bigint_far` ⇒ 503） | `NOT_MEASURED` | 归「环境抖动」另一单；本单不评 |
| 生产路径上误捕形态（尤其 `new Error()`）的**出现频率** | `NOT_MEASURED` | 无生产流量数据；本单只证「形态可命中」 |
| `isEventObjectFamily` 对 `node_modules` **其它依赖**的误捕面 | `NOT_MEASURED` | 未做全依赖扫描（交接件 §8 同样标的 `NOT_MEASURED`）；我只覆盖了 `ws` 的 5 个事件类与手写形态 |
| 修前「服务端诊断面」读数 | `NOT_MEASURED` | 修前 `ledgerErrorDiagnostics` **不存在**（函数缺失）⇒ 不填 0 |
| `DIAG_MESSAGE_MAX=200` / `DIAG_LINE_MAX=300` 的**截断分支** | `NOT_MEASURED` | 我的敏感串 <200 字符，未构造超长 message 用例 |
| 真 `ws.ErrorEvent` 的 `stack_head` 内容 | `NOT_MEASURED` | 事件对象自身无 `stack`（实测 `stack_head_len=null`）；只有 `Error` 实例测到 5 帧 |
| 变异判负的**重复 run 稳定性** | `NOT_MEASURED` | 只有 1 次 run（三态同进程）；未做多次重复统计 |
| 我未核的部分 | `NOT_MEASURED` | `errName` 是否改 `constructor.name`（交接件 §4.4 自述「未执行、待仲裁」）——**本单只核其未执行**（`errName` 行位于 baseline 与 fixed 的公共区段，`git diff` 无该行改动；C13 读数两态相同） |

---

## 11. 我自曝的探针缺陷（§5.7④：读数异常先怀疑自己的探针）

1. **作废一整次 run（最严重）**：`p3v-00-…-20260928T160003Z.json` 的 baseline 副本取自 `git show HEAD:`，而 **HEAD 在中途被并行单元推进到含修复的 `ade3376`** ⇒ baseline 副本内容 = fixed（两者 sha 均为 `9bc127e4…`），该次所有**对拍**读数（`control_mismatches=[]`、`500→503=[]`、`RED_set(baseline)==RED_set(fixed)`）**全部无效**。artifact **保留未删**以便回溯，不进入本报告任何判定。修正：baseline 改取 `HEAD^`（`721156cb…`，与交接件一致）。**教训：baseline 必须用「内容 sha」自证，不能靠「HEAD 这个符号」自证。**
2. **L1 谓词首版过严**：要求 8 例全部 `classify==='driver_connection_error'`，把**合法**的 `pool_connection_timeout`（Y8）误标 RED。已改为「reason ∈ 既有 `TRANSIENT_NON_PG_REASONS`」。
3. **L3 段变量误用**：首版对「行」调用 `r.make()`（`make` 只在 `Case` 上）⇒ 诊断面全读成 `THREW/NOT_MEASURED`。已改为按 `id` 回查 `CASES`。
4. **跨模块 `instanceof` 假差异**：P11（`LedgerError` 实例）首版恒用 **fixed 模块**的构造函数生成，导致被 baseline 模块观测时 `isLedgerError` 为 false ⇒ 制造了一格**假差异**（曾出现在 `status_diffs`）。已改为按副本 `makeFor` 自建。
5. **毒 getter 打崩我自己的自证段**：`M3`（`message` getter 抛）使 `fixture_selfcheck` 里的 `typeof fx.message` 抛异常并中断整个探针（第一次 run 就这么死的）。已加 `safeRead` 守卫。
6. **展示层口径 bug**：`L5_false_positive_ids` 把 `M3` 计入——因为 `captured_as_event_family` 在毒 getter 下返回字符串 `'THREW'`（truthy）。M3 实际是「**分类器整体抛**」而非「被捕获」。本报告按实测语义归类（§6.3），不按该字段。
7. **DB 口径错**：`p3v-01` 首版 `public_triggers_total=175` **未排除 internal**，与已知口径 43 不符。已补 `NOT tgisinternal`（= **43**，非 `O` = **0**）。
8. **「独立判据」的独立性有限（必须声明）**：我复算的那套判据（`instanceof Event` / `type==='error'` / 非 own 数据属性 两分支）是**实现逻辑的同构重写**，它只能校验接线、**不能证伪判据形状本身**。本单真正的独立性来自：① 跨三副本观测；② 手工构造的**反例**（X1 真物、X2/X3 非错误事件、P5 `new Error()`、P13 带 setter 访问器）；③ 与交接件读数**不一致处的主动追查**（正是 §11.1 与 §5 的来源）。
9. **样本量与范围诚实声明**：L1–L6 只有 **1 次** run；本单**不做**在线故障注入、**不跑**任何写库套件；「修复在生产上有效」这一命题**超出本单可测范围**，我只对「纯函数层的分类行为」下判定。
10. **进程/边界纪律**：未 `git add/commit/push`；未改 `src/**`（被检件全程只读，`git status` 中该文件无 `M`）；未跑写库套件；未起长驻 server；未 `npm install`；未用 `execute_code`；**未使用** `pkill -f` / `killall`（本单无需 kill 任何进程）；唯一写落盘 = 本报告 + `scripts/p3v-*.ts` + `.p3v-artifacts/**`。
11. **未与并行单交互**：期间观察到 `scripts/p1o-00-escape-sweep.ts`、`scripts/p2w-00-p2fix-verify.ts` 被并行单修改、`public.currency` 被写；我未触碰、未回退这些改动。

**报告章节**：`## ` 级标题共 **12** 节（0–11）。
