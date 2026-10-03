# P9④ · BTTC 平台币全链片 —— 终审质检报告（`p9-s4-bttc-qa`）

- **被检提交**：`eb29831`（`feat(p9-4): BTTC 平台币全链（R-9-36..R-9-46）…` · **26 件**）
- **仓**：`/Users/kevin/bistro/seafood`（**不 commit / 不 push / 不 add**）
- **角色**：**Neng**（独立质检 · 终审收尾单）
- **口径**：库面写一律**事务内 + 末尾 `ROLLBACK`**；受控实例**只用 5796/5797**；精确 PID `kill -TERM`（禁 `pkill -f` / `killall`）；探针放 `backend-ts/.p9s4q/`（不入 `scripts/`）；变异只在**仓外副本**。
- **本单范围**：L0–L3 **已过不重做**（唯一例外 = ① 回滚后表级零残渣对拍**重跑**）；本单做 ② L4 判负 · ③ L5 前端 · ④ 报告回填 + verdict + 收尾。
- **读数来源标注**：`[实跑]` = 本单亲自运行；`[上位]` = 交付/上一单产物或派单方转述（已注明出处）。

---

## §L0 现取对锚

- **开工 HEAD `git log -1` 现取**：`b8764d06fa0fd822546f3ab26c906c181b8df545`（`docs(p9-4): §5.262/v0.262 —— P9④ 终审质检（L0–L3 全绿 + 独立判定配对不变式符号 + 抓出 0034 头注释表述不一致）+ 我裁 R-9-47 + 派质检收尾单`）。`[实跑]`
  - 开工时首现 `f6c9507`；作业期间编排方入库 `b8764d0`（**仅 docs**）⇒ 现取对锚以 `b8764d0` 为准（§漂移已核）。
- **被检面钉**：`eb298313e4005c52d380b61b8a588c6d61bc7bea`；**祖先核** `git merge-base --is-ancestor eb29831 HEAD` = **rc 0**（是祖先）。`[实跑]`
- **漂移（`eb29831..HEAD`）**：`docs/qa/favicon-install-qa.md`（187 行）+ `docs/seafood.master-plan.md`（+71）—— `git diff --stat eb29831 HEAD -- backend-ts/src backend-ts/migrations backend-ts/scripts frontend/src frontend/scripts docs/audit` = **空**。⇒ **漂移仅 docs**（零代码 / 零迁移 / 零被检报告漂移）。`[实跑]`
- **工作树 vs 被检面（受检码面）**：`git diff --stat eb29831 -- backend-ts/src backend-ts/migrations backend-ts/scripts frontend/src` = **空**。`[实跑]`
- **端口 `5796–5799` 全空**：`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` **无输出**（上一单 PID 20396 已随进程组回收）。`[实跑]`

---

## §L1 硬门

> **派单明令「不重做已过部分」** ⇒ 下列硬门读数引 **上一单 / 交付收口产物** `backend-ts/.p9s4-closeout/final-*.out`（`[上位]`）；本单**因 L4 判负需基线**，在**仓外副本**复跑 `p8-s9` 门 **10 次全绿**（`[实跑]`，见 §L4）。

| 门 | 读数 | 来源 |
| --- | --- | --- |
| 后端 `tsc` | **0 字节 / 0 诊断** | `[上位]` `final-tsc.out`（0 B） |
| 后端离线单测 | **126 / 126 · failed 0** | `[上位]` `final-offline126.out` |
| `p8-s1` app-config | **24 / 24** | `[上位]` |
| `p8-s2` fee-rebate | **41 / 41** | `[上位]` |
| `p8-s3` deposit | **45 / 45** | `[上位]` |
| `p8-s3b` address | **38 / 38** | `[上位]` |
| `p8-s4` currency-review | **79 / 79** | `[上位]` |
| `p8-s5` compliance | **117 / 117** | `[上位]` |
| `p8-s6` site-text | **64 / 64** | `[上位]` |
| 前端 `build` | **退出 0** | `[上位]` `final-build.out` |
| **`p8-s9` BTTC 门** | **99 / 99 · failed 0 · `pending_apply=0` · `db=10` · `http=0`** | `[上位]` `final-p8-s9.out` **＋ `[实跑]` 本单副本 10/10 全绿（基线/变异/复原）** |
| 受控实例 | **未启**（L5 为静态脚本面，门 `http=0`） | `[实跑]` |

---

## §L2 库面活体现取（`[实跑]` · 自写只读探针 `.p9s4q/l2-l3.ts` · 产物 `.p9s4q/out/l2-l3.json`）

- `schema_version` = **`0034`** · `schema_migration` 行数 = **33** · 基础表 = **34**。
- **`ledger_kind_enum` CHECK = 23 值**（含 `bttc_mint_fee` / `bttc_burn_fee`）；`ledger_kind_ok` 第一支 = **23 值**、冻结族第二支 = **4 值**（`hold_forfeit / job_payout / purchase / trade`，**不含** bttc）。
- **`ledger_assert_platform_mutation` `−1` credit 白名单 = 8 值**（既有 6：`trade_fee / listing_fee / currency_create_fee / job_fee / listing_deposit / checkin_makeup_fee` ＋ 两新 kind）。
- **`ledger_post_event` `op` 白名单（活体）= 7 值**：`mint / transfer / hold / hold_release / settle / entries / burn` ⇒ **含 `burn`（末位）**；`double_write_mint` = true · `double_write_burn` = true · `PLATFORM_BURN_FORBIDDEN` 在场。
- **`currency.is_platform_coin`** = `boolean` / `NOT NULL` / `DEFAULT false`；`currency` 行数 = **15** · `is_platform_coin=true` 计数 = **0**。
- **三迁移 checksum 双对拍（DB 存储值 == 文件 sha256）全部一致**：
  - `0032_kind_close_set_23.sql` ⇒ `08744e8366d5e6f453ec5137fbd223780cbdc1828612a5e4242a3e74febff563`
  - `0033_currency_platform_coin_flag.sql` ⇒ `a9941c05ed0649723136737b8dc9ae1835cf208b2ee3470c549bdd03ce35bdbd`
  - `0034_ledger_op_burn_and_supply.sql` ⇒ `1413e9f2e88e537a8635be2264ab1486d20e8669f8cdc236c66a76753e92584c`

---

## §L3 四段真链路（自写探针 · 事务内 + 末尾 `ROLLBACK`）

> 手法：自写探针 `backend-ts/.p9s4q/l2-l3.ts`（**不复用实现方产物**）；产物 `.p9s4q/out/l2-l3.json`。**本单重跑**（上一单最后一轮 refine 后未重跑）。

- **① 创建（`ensureBttcCurrency`）**：首调**非空** `{cid:144, symbol:BTTC, name:battcoin, decimals:0, status:listed, total_supply:0, is_platform_coin:true, inserted:true}`；二调 `inserted:false` 且 `cid` 相等 ⇒ **幂等 + 首调确定值（`F-α` 已修）**。
- **② 豁免闸两读数**：非平台行 + `保证金 0` ⇒ `applied=0`（止于审核 · `draft`）；平台行 + `保证金 0` ⇒ **越过审核触达账本腿** `LD016`；平台行 + `保证金 2000` ⇒ `applied=0`（保证金腿对平台行跳过）。
- **③ 铸造**：`applied` · 供应量 `0→1` · `batt 100→0` · `$ 4→3` · 本体腿 `+1 mint` · 费腿 `uid4 −1` / `uid−1 +1`（`bttc_mint_fee`）。
  - 幂等重放：闸可过 ⇒ `replayed`（账本 0 / `batt_entry` 0）；闸不可过 ⇒ `rejected`（0/0）；闸负 `batt=99` / `$=0` ⇒ `rejected` **零副作用**。
- **④ 分解**：`applied` · 供应量 `1→0` · `batt 50→100`（`batt_entry` delta=+50 **封顶丢弃**）· `$ 3→2` · 本体腿 `−1 burn`（**单边负额**）。
- **配对不变式（活体）**：铸后 `{supply:1, Σmint:1, Σburn:0}` ⇒ `1==1+0` **holds**；分解后 `{supply:0, Σmint:1, Σburn:−1}` ⇒ `0==1+(−1)` **holds**（带符号形 · 见 §R-9-47）。
- **平台 burn 兜底**：`uid=−1` 经 `burn` ⇒ 必拒 **`LD021`**（`LEDGER_RESERVED_UID` / `PLATFORM_BURN_FORBIDDEN`）。
- **★ ①-重跑：表级零残渣对拍**：`live_after_rollback` **逐表 ==** `residue_before` ⇒ **`zero_residue = true`**：

  | 表 | before | after(回滚后现取) |
  | --- | --- | --- |
  | `currency` | **15** | **15**（回 15 ✓） |
  | `ledger_entry` | 359 | 359 |
  | `batt_account` | 2 | 2 |
  | `batt_entry` | 2 | 2 |
  | `account` | 39 | 39 |
  | `currency_status_log` | 7 | 7 |
  | `currency_review_log` | 0 | 0 |

  `bttc_rows_after_rollback = 0`（**`symbol='BTTC'` 行 = 0 ✓**）· `qa_currency_rows = 0`。

---

## §L4 判负 ≥3 处（仓外副本 + 复原回绿 + 主仓 `cmp`）

> **副本**：`git worktree add --detach <scratch>/p9s4q-copy eb29831` + 软链 `node_modules`（前后端）+ `backend-ts/.env.local`。**基线 = 99 / 99**（`l4-out/baseline.out`）。逐变异 ⇒ 必红；复原 ⇒ 回绿；`cmp` 主仓 **SAME**。

| 变异 | 位置（副本内） | 触红（逐字） | rc | 复原 |
| --- | --- | --- | --- | --- |
| **M1** 去 `total_supply` 双写 | `migrations/0034…sql`（删 burn `UPDATE … − v_amount`） | **`F1`**（`98/99`） | 1 | 99/99 · `cmp` **SAME** |
| **M2 ★** 去 `ledger_post_event` **真白名单** `burn` | `migrations/0034…sql` 真白名单（单引号形） | **旧形态**（仅锚自检串）⇒ **假绿 99/99**；**加严后** ⇒ **`E1`** `{old6_selfcheck:true, new7_selfcheck:true, real_whitelist:false}`（`98/99`） | 1 | 99/99 · `cmp` **SAME** |
| **M3** 去豁免谓词 | `src/database.ts`（去 `OR c.is_platform_coin = true`） | **`D4`（静态）+ `KE3`（活体）**（`97/99`） | 1 | 99/99 · `cmp` **SAME** |
| **M4** `F-α` 回归 | `src/database.ts` `ensureBttcCurrency`（`cid` 列回旧取数形·撤 `ins` 同快照兜底） | **`KC1b`** `{first_call:null}`（`98/99`） | 1 | 99/99 · `cmp` **SAME** |

**★ 判负 4 / 4 逐条成立（≥3 达标）。逐字红点原文**（`l4-out/m*-mutated.out`）：

- `M1` ⇒ `RED F1 | actual={"double_write":true}`（注：`F1` 的 **pass 谓词** = `/UPDATE currency SET total_supply = total_supply - v_amount, time_updated = now\(\)/`（已随删行消失）；其 **`actual` 展示项**用较弱的子串正则（自检串行内仍含 `total_supply = total_supply - v_amount`）⇒ 展示值仍为 `true` 而 `pass=false`。**判据正确转红，唯展示诊断偏弱**——登记一条门质量小项，非缺陷）。
- `M2` ⇒ `RED E1 | actual={"old6_selfcheck":true,"new7_selfcheck":true,"real_whitelist":false}` —— **这是「假绿已被斜正」的关键证据**：旧形态 `E1`（仅锚双引号自检串 `V_NEW`）在真白名单被去掉 `burn` 后**仍报 99/99 全绿**；加严后的 `E1`（新增单引号**真白名单** `V_REAL` 锚）⇒ `real_whitelist:false` **必红**。
- `M3` ⇒ `RED D4 | actual={"wrapped_gate":true}`（同 `F1` 的展示项偏弱现象；pass 谓词要求 `OR c.is_platform_coin = true`）+ `RED KE3 | actual={"ok":true,"applied":0,"cur_status":"draft"}`（平台行**不再**越过审核触达 `LD016` ⇒ 活体同红）。
- `M4` ⇒ `RED KC1b | actual={"first_call":null}` —— 回旧形态后 `ensureBttcCurrency` **首调返回 `null`**（PG 数据修改型 CTE 同快照不可见）⇒ `R-9-45` 回归判据必红。

**★ M1 活体佐证（`[实跑]` 自写探针 `.p9s4q/m1-live-supply.ts` · 事务内 `CREATE OR REPLACE` + 末尾 `ROLLBACK`）**：证 `0034` 头注释所载判负「**去双写 ⇒ 供应量断言必红**」在活体亦成立：

- 控制链（双写在）：铸 `0→1` · 分解 `1→0` ⇒ `supply=0`，`Σmint=1 / Σburn=−1` ⇒ **`eq_plus:true`（holds）**。
- 变异链（事务内替换函数，去 burn 双写）：铸 `1` · 分解 ⇒ **DB `supply_after_burn=1`**（**未随本体腿回减**）而 `Σmint=2 / Σburn=−2` ⇒ **`eq_plus:false`（断言必然破裂）**。
- `verdict = {control_invariant_holds:true, mutated_invariant_broken:true, claim_去双写_供应量断言必红:true}`；**回滚后 `symbol='BTTC'` 行 = 0**（零残渣，DDL 事务内可回滚）。

**副本隔离自证**：四次变异后全复原 ⇒ `git -C <copy> status --porcelain -- backend-ts/src backend-ts/migrations backend-ts/scripts frontend/src frontend/scripts` = **空**；逐文件 `cmp` 主仓 **SAME**（`0034…sql` / `p8-s9-bttc-gate.ts` / `src/database.ts`）。

---

## §L5 前端四语与计数前推（`[实跑]`）

- **`bttcPanel` = 12 键 × 4 语、键集逐语相等**：`actionFail · balanceLabel · burnButton · burnHint · burnOk · mintButton · mintHint · mintOk · noData · symbol · title · unavailable`。
- **六类工程口径泄漏 = 0**（`bttcPanel` 值面 × 4 语；章节号 / HTTP 动词+路径 / 接口路径 / HTTP 状态码 / 机读码 / 表列名 六类逐类命中 **0**）；`en` / `vn` 的 `bttcPanel` **零 CJK**。
- **`p6-tr2-i18n-locales.mjs`（实跑）**：`rc=0`；**四语 `top=118 / flat=1000` 单值**；键集相等 **PASS**；总判 **PASS**。
- **`p4z-i18nviol-global.mjs`（实跑）**：`rc=0`；**作用域命中节点数 = 4000**（键 1000 × 语 4）；**locale 裸命中 = 0 · 源面裸命中 = 0**；总判 **PASS**。
- **载体单测 `i18n-violation-closeout.test.jsx`（实跑）**：**5 / 5 passed**（断言 `节点=4000` / `flat=1000` / `top=118`）。
- 产物：`.p9s4q/l5-out/p6-tr2.out` · `.p9s4q/l5-out/p4z-i18nviol-global.out`。

---

## §R-9-47 ★ 配对不变式两种约定（口径区分 · 不改已 apply 迁移）

- **★ 存在两种等价书写约定，二者不矛盾、不属缺陷**：
  - **幅度约定 `Σmint − Σburn`**：出现在 `0034` 文件**头部注释**（`:14` / `:17`）、`p8-s9` 门头注释（`:24`）、`data-layer.spec` §33 判据 4。
  - **带符号约定 `Σmint + Σburn`**：即 `p8-s9` 门 `KI1` / `KI2` 的**实际判定**（`p8-s9-bttc-gate.ts:662` / `:687`），亦为本单独立复取的**库面真值**（见 §L3 配对不变式）。
- **根因**：存库 **`burn` 本体腿为单边负额**（`delta = −v_amount` ⇒ `Σburn = −1`）⇒ 带符号约定下 `Σmint + Σburn` 自然等于 `total_supply`；而幅度约定 `Σmint − Σ|burn|` 与其**等价**（`a − |−b| = a + (−b)`）。`§L3` 实测：分解后 `{supply:0, Σmint:1, Σburn:−1}` ⇒ `eq_plus`（`+`）**true** / `eq_minus`（`−`）**false** ⇒ **带符号形为库面真值**。
- **处置（按纪律）**：`0034` **已 apply**（`schema_version=0034`）⇒ **不得改已 apply 迁移**；故**不以改文件方式斜正**，**以带符号约定 `Σmint + Σburn` 为准**登记于本报告。头注释的幅度写法属**表述口径**，非缺陷。

---

## §L6 自证

- 本报告（落盘后现取）：**行数 168 · 字节 16967 · 双下划线占位符命中行 = 0 · 骨架占位标记命中 = 0**。
- 本单自写探针均在 `backend-ts/.p9s4q/`（**不入 `backend-ts/scripts/`**）：`l2-l3.ts`（L2/L3）· `m1-live-supply.ts`（M1 活体佐证）· `l4-out/*.out`（判负原始输出 · 非 `.log`）· `l5-out/*.out`。
- 主仓代码面（`backend-ts/src` · `backend-ts/migrations` · `backend-ts/scripts` · `frontend/src`）**零改动**；本单仅新增 `docs/qa/p9-s4-bttc-qa.md`（本报告）与 `backend-ts/.p9s4q/**`（探针/产物）。

---

## §Verdict

**verdict = PASS**（收尾单四件全绿）：

- **① 回滚后表级零残渣对拍（重跑）**：`zero_residue=true` · `currency` 回 **15** · `symbol='BTTC'` 行 **0** · `ledger_entry`/`batt_account`/`batt_entry` 四表 **before == after** ✓。
- **② L4 判负**：**4 / 4**（`M1→F1` · `M2→E1`（**旧形态假绿 99/99 ⇄ 加严必红**）· `M3→D4+KE3` · `M4→KC1b`）逐条必红 + 复原回绿 + 主仓 `cmp` SAME ✓；另附 **M1 活体供应量断言必红** 佐证 ✓。
- **③ L5 前端**：`bttcPanel` 12 键 ×4 相等 · 六类泄漏 **0** · `top 118` / `flat 1000` / 节点 **4000** · `p6-tr2` 与 `p4z-i18nviol-global` 实跑 **PASS** ✓。
- **④ 报告回填 + `R-9-47` 口径区分 + 收尾**：`p8-s9` 门 **99/99 · pending_apply=0**；端口 `5796–5799` **全空**；`R-9-47` 两约定已登记 ✓。

---

## §未测项逐项原因（禁填 0/空）

1. **L0–L3 其余已过面（含 `tsc` / 离线 126 / `p8-s1..s6` 八门 / 前端 `build`+`test:unit`）本单不重做**：派单明令「不重做已过部分」，读数引 `[上位]` `backend-ts/.p9s4-closeout/final-*.out`（已注明出处）。**原因**：非本单范围，且指令显式排除。
2. **前端浏览器实渲染与四语目视**：本单为**无头 / 只读脚本面**，**未起浏览器**；仅以两脚本实跑 + 载体单测（5/5）+ 键集/泄漏静态断言覆盖，**未做像素级 / 交互级目视**。
3. **平台币经 `listCurrencyWithDeposit` 完成上市（`F-β` / `LD016` 零额保证金分录入径）**：`§L3②` 实测平台行越过审核后触达账本腿 `LD016`；**已裁 `R-9-44` 属预期行为、非缺陷**（平台币由系统引导创建、不开放上市申请入口）。**原因**：**非本片范围**（若未来开放平台币上市申请须另修）。
4. **`pages/jobs/JobDetailPage.jsx:238` 工程口径硬编码 1 处**：`p4z-i18nviol-global` 子面③ 现取命中 **1 / 35**。**原因**：**存量**源面文案（非 P9④ 写集），另单收口；`总判` 仅以「locale 裸命中 0 + 源面裸命中 0」判 PASS（不受此存量项影响）。
5. **`p8-s9` K 段活体 leg 依赖 DB（Neon）**：本单 DB 可达 ⇒ `db=10 / http=0` 全绿；**若 DB 不可达则 `K0` 转红**（属环境性，非本单验证项）。**原因**：库面 leg 天然需活体连接。
6. **两新增写口（`POST /api/bttc/mint` · `/burn`）的「合法写」HTTP 端到端**：本单**未启受控实例**（L5 为静态脚本面）⇒ 未跑真实 HTTP 往返；**合法写路径已由 §L3 库面四段真链路事务内覆盖**。**原因**：无实例场景下不伪造 HTTP 读数。

---

## §收尾（进程 / 端口 / 副本）

- **受控实例**：本单**未启用受控实例**（L5 无 HTTP 需求），故**无精确 PID 可 `kill -TERM`**；上一单 PID 20396 已随进程组回收。
- **端口**：`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**（开工 / 收尾两次现取一致）。
- **副本**：`git worktree remove --force <scratch>/p9s4q-copy`（回收后 `git worktree list` 无残留）。
