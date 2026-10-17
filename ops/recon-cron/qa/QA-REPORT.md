# 独立质检 · 对账 cron 三笔（Neng）

- 被检 revision：`3423a4b`（HEAD）· 批次 = `a201cb3` / `3423a4b` / `34d736b`，基线 `0537ea8`
- 质检方：Neng（只读被检对象、自跑探针、自落读数；未改仓内实现/测试、未写库、未 push）
- **结论：`PASS-with-drift`**（AC1–AC8 PASS；AC9 只登记不判负；4 条 drift + 3 条 ENV_LIMITED）
- 机器可读裁决：`verdict.json`（每条 AC 的 status/evidence 由 `readings/*.json` 的 `pass` 机械汇总）

## 复跑方式（cwd = `backend-ts`）

```bash
node ../ops/recon-cron/qa/probe/qa-static.mjs                     # AC1/AC2静态/AC4静态/AC7
TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-behavior.ts   # AC2行为/AC3/AC5/AC6
TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-real-read.ts   # AC8（dev 只读）
TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-ac9-disclosures.ts  # AC9①
TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-kind-coverage.ts    # AC9 旁证
node ../ops/recon-cron/qa/probe/qa-ac4-gates.mjs && node ../ops/recon-cron/qa/probe/qa-verdict.mjs
```

> ★ `TS_NODE_PROJECT=tsconfig.json` 必须给：从仓外路径跑 ts-node 时它按仓根配置编译，会报 `TS5109`（实现方日志里没这条，属环境态变化，不是代码缺陷）。

## 逐 AC 读数（全部落盘，自报不算）

| AC | 结论 | 关键读数 | 文件 |
|---|---|---|---|
| AC1 只读性 | PASS | 剥注释后 DML/事务/`ledger_post_event` 命中 0；三条 SQL 均 `SELECT` 单语句；`readQuery` 3 次、无 `getPool`/`withTransaction` | `readings/AC1-readonly.json` |
| AC2 符号与基线 | PASS | `COALESCE(sum_mint,0)+COALESCE(sum_burn,0)`（减号 0 命中）；基线 `{'1':'2000000','21':'1'}` 冻结常量、未登记 ⇒ 0；判据 `parsed.big === baseline`；差 1／基线错配／小数残差 ⇒ FAIL，命中基线／`2000000.0` ⇒ PASS；**真数据 Σmint+Σburn=2010200 == total_supply**（减法得 2410352） | `AC2-symbol-baseline.json` + `AC2-judgement.json` |
| AC3 鉴权五态 | PASS | 503 / 401 / 401 / 401 / 200（Bearer 与 x-cron-secret 两种对头均 200）+ 错路径 404 + 同路径 POST 404；8/8 响应体不含密钥（密钥进程内随机生成） | `AC3-auth-states.json` |
| AC4 端点形态 | PASS | 仅 1 处注册且为 `app.get`；`grep -cE '^app\.(get\|post\|put\|delete\|patch)\('` = **107**；p7b-03 **37/37** red=[]、AC10-2 `registration_points=107`；`tsc --noEmit` exit **0** | `AC4-endpoint-static.json` + `AC4-gates.json` + `logs/` |
| AC5 样本修复 | PASS | 25 行、第 22 行 cid=9021 偏离 ⇒ FAIL、`diff=1`、`sample_len=20`、`sample[0].cid=9021`；全 PASS ⇒ PASS/`diff='0'`/rows 25；全 FAIL 25 行 ⇒ cap 20 全失败行；**反向对照**：旧策略同夹具丢失 9021（末位 9019、has_9021=false），且旧/新 status·diff·rows 逐项相同 | `AC5-sample-two-phase.json` |
| AC6 灵敏度 | PASS | 5 臂：diff 偏移 / cid21 基线错配 / account 漂移 1 行 / batt 漂移 1 行 ⇒ 全 `ok=false`；反向臂全净 ⇒ `ok=true`；另加基线命中 ⇒ true、小数残差 ⇒ false | `AC6-sensitivity-arms.json` |
| AC7 零副作用 | PASS | `0537ea8..HEAD`：迁移 0 / frontend 0 / i18n 0；`vercel.json` numstat `4 0`（删行 0）、JSON 合法、crons 恰 2 条、`0 18 * * *` 未动 | `AC7-zero-side-effects.json` |
| AC8 真库只读 | PASS | dev（`quiet-math-65207667`，非生产）三条 SQL 原文各执行成功（15/0/0 行）+ `runLedgerRecon` 888ms；5 表齐备、schema 顶 0048；全程仅 SELECT | `AC8-real-dev-readonly.json` |
| AC9 披露 | REGISTERED | 漂移三臂 HTTP 全 200 且各 1 条 `[recon]` 日志（干净臂 0）；dev ok=false 归因构造性；legacy builds ⇒ ENV_LIMITED | `AC9-disclosures.json` + `AC9-kind-coverage.json` |

## Drift（登记，不判负）

1. **D1 漂移仍 200**：Vercel cron 面板不会红，告警面 v1 仅 `console.error` 一条；若无人看日志可长期无人处置（建议另立单接外部告警）。
2. **D2 dev `ok=false` 属构造性**：基线取生产（cid1 = 2000000），dev 实测 diff=0 ⇒ 严格相等必 FAIL；同批 dev 上 account/batt 两条 0 行判据均 PASS。
3. **D3 口径覆盖**：检查①只聚合 `mint`/`burn`（`ledger_kind_enum` 实有 20 kind）。dev 逐 cid 实测「非 mint/burn 净额 + frozen == 0」（cid1 −16745+16745、cid21 −1+1）、orphan 分录 0 ⇒ **口径自洽、无覆盖缺口**；建议生产侧按同式复核一次。
4. **D4 基线 `'21': '1'`** 属本轮新增登记值，dev 现取 diff=0（故 dev 判 FAIL）；登记值需生产侧对拍确认。

## ENV_LIMITED（原样保留）

1. `vercel.json` 为 legacy `builds`+`routes` 形态 ⇒ cron 是否真按 `30 18 * * *` 注册/触发**离线不可证**，只能上线后现证（面板 + 一次真实触发日志）。
2. Hobby 档 cron 名额已用满 **2/2**（每条每天至多 1 次、非准点）⇒ 加第三条前必须先合并调度器。
3. dev 库与生产不可比 ⇒ AC8 只证「SQL 在真 schema 上可执行」，不证生产值。

## 质检侧自证（防坏尺子）

- **分辨率**：AC5 反向对照证明旧实现必丢定位行（用例不是恒绿）；AC6 反向臂证明判定不是恒 FAIL。
- **取数路径**：`runReport` 首版读 `r.json` 得 undefined（回执被 `sendSuccess` 包一层）⇒ 全部臂假红；改为 `r.json.data ?? r.json` 后才有有效读数（属探针自纠，不是实现缺陷）。
- **未采信实现方**：日志/读数未用于结论；`ops/recon-cron/{readings,logs,probe}/` 仅作对照，结论全部来自本目录探针。
