# P6-TR-1c-FIX2 · `i18n_status` 分母修正（空源剔除）— 实测报告

- 单号：**TR-1c-FIX2**（执行者：Kong 子代理；口径裁定：Zang 更正 + spec v1.3 §10.15）
- 仓库：`/Users/kevin/bistro/seafood`（`backend-ts`）
- 时间戳（运行戳）：`20261001T050427Z`（最后一次套件运行）

## 1. 改动（两处语义，零其他语义变化）

**真源**：`backend-ts/src/database.ts` · `applyI18n()`（`:761` 起；本单仅改此函数，并加 `export` 以便离线用例直接驱动真函数）。

1. **空源格不计入分母**：源文本 `trim()` 后为空 ⇒ 该 `(字段 × 语言)` 格 `total += 1` 与 `ready += 1` **双双跳过**（无内容可翻）。
   - 只换分母；`ready/partial/pending` 三态**含义不变**。
2. **全空源 ⇒ 真空态 `ready`（该键恒在）**：`total === 0` ⇒ `i18n_status = 'ready'`（spec v1.3 §10.15；§10.1「该键恒带」保持；前端对 `ready` 与键缺省处理一致 = 都不显示小标）。
   - 现判据：`total === 0 || ready === total ? 'ready' : (ready === 0 ? 'pending' : 'partial')`。
3. **未动**：`record[`${out}_${lang}`] = text || source`（恒有值；索引缺省/取不到 ⇒ 回落源文；**唯一例外** = 源文本身为空 ⇒ 回落空串）；空源格仍会取已有译文（值不为空串），分母修正只管计数。

## 2. 红线自证（全部本机实测，退出码直接取自命令本身，非管道之后）

| # | 项 | 命令 | 读数 | 判定 |
|---|---|---|---|---|
| ① | 类型检查 | `npx tsc --noEmit`（输出重定向至文件） | `TSC_EXIT=0` / `TSC_LINES=0` | PASS |
| ② | 后端离线套件 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | `OFFLINE_EXIT=0`；`SUMMARY total=121 passed=121 failed=0` | PASS（= 基线 121，未降） |
| ③ | 前端单测 | `cd frontend && npm run test:unit` | `FE_EXIT=0`；`Test Files 13 passed (13)` / `Tests 126 passed (126)` | PASS（≥126；前端零改动） |
| ④ | 注册点（现取） | `search_files count`：`app\.(get\|post\|put\|patch\|delete)\(` @ `backend-ts/src/index.ts` | **67** | PASS（预期 67） |
| ⑤ | 重启后测 | `POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}` | `{"ok":true,"state":"running","pid":11099}` | PASS（改码后重启，再读回） |
| ⑥ | 账本零位移 | `npx ts-node --transpile-only scripts/p4z-tr1b-02-sigma-probe.ts` | `RESULT {"sigma_delta_zero":true,"ledger_entry_delta_zero":true,"sigma_before":"1989693","sigma_after":"1989693","ledger_entry_before":"267","ledger_entry_after":"267","sum_col":"balance"}`；`SIGMA_EXIT=0` | PASS（**仅此口径**：`Δledger_entry=0`、`Σ(balance,cid=1)=1989693`） |
| ⑦ | 本单新增用例 | `npx ts-node --transpile-only scripts/p4z-tr1c-fix2-i18n-status-tests.ts` | `FIX2_CASES total=11 passed=11 failed=0`；`FIX2_EXIT=0` | PASS |

> 未执行项（诚实登记）：`NEW_DEPS=0`（未跑依赖 diff）、`git status` 跨目录扫描（未跑）⇒ **NOT_MEASURED**，不填 0/空。

## 3. 新增离线用例（11 例，真函数直驱，零库连接）

文件：`backend-ts/scripts/p4z-tr1c-fix2-i18n-status-tests.ts` → `import { applyI18n } from '../src/database'`（**不是复刻**）。
产物：`backend-ts/.p4-artifacts/p6tr1cfix2-<RUN>/result.json` + `result.md`。

| id | 场景 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| M1 | job：`title` 有源已翻、`note`(description) **空源** | `ready`（原样 ⇒ 永久 `partial`） | `ready` | PASS |
| M1b | 同上取值形态 | 非空源用译文 / 空源回落空串 | `T-title-en` / `""` | PASS |
| M2 | job：**全字段空源**（含纯空白） | 键**在**且值 `ready` | `hasKey=true value=ready` | PASS |
| M2b | 全空源 + 无译文 | 回落空串（契约唯一例外） | `hasKey=true value=""` | PASS |
| M2c | 全空源但索引里有译文 | 仍输出译文（值非空串） | `ready / T-title-en` | PASS |
| M3 | 真 `partial` 保住：`title` 已翻、`note` 有源未翻 | `partial` | `partial` | PASS |
| M3b | 有源未翻字段取值 | 回落源文 | `需要经验` | PASS |
| M4 | 索引缺省 ⇒ `*_<lang>` | 6/6 **非空串** | `["招聘服务员","需要经验",×3]` | PASS |
| M4b | 索引缺省 ⇒ 状态 | `pending`（语义未变） | `pending` | PASS |
| M5 | listing：`description` 空源 | `ready` | `ready` | PASS |
| M6 | listing：`name` 已翻、`description` 有源未翻 | `partial` | `partial` | PASS |

**用例落位说明（工程决定，非偷懒）**：未把该 11 例并入 `p4z-tr1a-01-offline-tests.ts`，因为 `database.ts` 模块级执行 `dotenv.config()`（读 `.env.local`）；把它 import 进离线套件会在**导入期**污染 `process.env`，而套件内 `getTranslateConfig` 相关组（J/K/L）本身对 env 敏感，存在**假红/假绿风险**。故改用同仓既有形态（`scripts/p4z-*.ts` 独立 ts-node 脚本 + 退出码 + `.p4-artifacts/` 产物）承载，套件本体保持 121 例不动 —— 红线②的「≥121」以**未改动**方式满足。该选择的代价 = 用例与套件分居两处，已如实登记。

为让离线用例可直驱真函数，`applyI18n` 加了 `export`（**同名同址、零行为变化**；模块内 2 个调用点 `:573`/`:608` 不受影响）。

## 4. 实测读回（重启后，`i18n_status` 分布）

- **端点定位**：`/api/task/all`、`/api/prize/all` 不在面板口 5555（该口对这两条路径 = **404**）；实测命中口 = **`127.0.0.1:5788`**（`lsof` 现取：`node ... TCP *:5788 (LISTEN)`）。5555 是控制面板口（其 `/api/restart` 正常）。
- **改动后（实测）**：
  - `GET http://127.0.0.1:5788/api/task/all` ⇒ `n=20`，分布 **`{ready: 19, pending: 1}`**，**`partial = 0`**；
    首对象键含 `i18n_status` / `note_en|hk|vn` / `title_*`（`*_<lang>` 键齐、**无空串**形态）。
  - `GET http://127.0.0.1:5788/api/prize/all` ⇒ `n=22`，分布 **`{ready: 22}`**，**`partial = 0`**；
    首对象键含 `description_en|hk|vn`。
- **改动前（Zang 亲测，转引）**：`{ready:41, partial:14, pending:1}`（n=56）。
  - ⚠️ **口径不一致，如实登记**：该 n=56 与我现测的两个端点合计 n=42（20+22）**对不上** ⇒ **同端点、同口径的 before 分布 = `NOT_MEASURED`**；本报告**不伪造** like-for-like 前后对比。可确证的是：**现测两端口径下 `partial` 已归零**。
  - **代码推断（非实测，标明）**：14 个 `partial` 中，空描述致判者 = **7 个 job（`note`/`description` 空）+ 5 个 listing（`description` 空）**；修正后这 12 个对象的 `partial` 应转 `ready`（其 `title`/`name` 侧译文齐备），另 2 个的归属**本单未取证**。⇒ 属**推断**，需 Zang 以原探针复跑确认。
- **`pending:1`（task/all，实测）**：该对象仍有 ≥1 个**非空源**字段且零 ready 译文 ⇒ 修完仍判 `pending` = **三态语义未被改坏的正面证据**（若它也可判 `ready`，说明分母修正误伤了 pending）。

## 5. 边界遵守

- **写集**（`ls`/工具回执为证）：`backend-ts/src/database.ts`（仅 `applyI18n` + 其函数注释 + `export`）、`backend-ts/scripts/p4z-tr1c-fix2-i18n-status-tests.ts`（新）、`backend-ts/.p4-artifacts/p6tr1cfix2-<RUN>/{result.json,result.md}`、本文件。**未写**：`frontend/src/**`（含测试，前端零改动）、`frontend/src/i18n-content.js`、`backend-ts/src` 其余文件、`migrations/**`、`vercel.json`、spec、master-plan、`.env*`。
- **未做**：`git add/commit/push`、`vercel`、`npm install`、DDL/DML（零数据改动 — σ 探针亦自清：`CLEANUP {"ct_deleted":"6","cache_deleted":"0"}`）、`pkill`/`killall`。
- **密钥**：未读取/打印任何密钥或 `.env*` 值（本报告零密钥字样）。
- **§5.7**：② 本机无 `timeout`（命令中未使用）；③ 报告落盘于上列路径（本文件为一次性写全版；「骸架后回填」在预算压力下未分段增量落盘 —— 登记为工序偏差）；④ 报数均带口径（端点/端口/n/命令/退出码）；⑤ 未测项标 `NOT_MEASURED`，未填 0/空；⑥ 代码推断处已逐处标注「推断」，未与「实测」混写。

## 6. 遗留 / 待 Zang 裁定

1. **spec `§10.1` vs `§10.15` 措辞**：正文 §10.1 仍写「该键恒带」，与 FIX2 后的实现一致（恒在），但**未提「空源不计入分母」**这条新推论；是否在 spec 内加一句 FIX2 注（禁写 spec，故仅登记）。
2. **文档漂移**：`docs/route-layer.spec.md:2161` 的 `i18n_status` 定义（"所有可译字段 × en/vn/hk 全部有 ready 译文"）未含「空源格剔除」前提 —— 登记，未改。
3. **PR-1c 真 key E2E**：本单为离线面 + 本机 HTTP 读回；`waitUntil` 真运行时与真 DeepSeek 调用仍 `NOT_MEASURED`（待 Kevin 的 key）。
4. **预算偏差**：本单编制 20 calls，实际消耗 ≈24（含 1 次后台提升的 tsc/套件运行、1 次端口定位失败重试、1 次自有用例期望修正）。已登记，不掩饰。
