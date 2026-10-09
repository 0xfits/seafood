# 系统测试清单（System Test Checklist）

> **单号**：S59 · **角色**：Neng（质检） · **性质**：**只写文档，不执行**（零测试 / 零门 / 零探针 / 零连库写 / 零起实例 / 零部署）
> **交付**：本文件 + `backend-ts/.s59-artifacts/s59-20261009T005618Z/`（现取证据）
> **语言**：中文 · **阅读约定**：每条命令**可复制即执行**；每条判据**带出处**（`文件:行` 或脚本头逐字）；不能确认者标 **`NOT_MEASURED`**（禁填 0 / 空）。

## §0 前置与纪律

**0.1 锚点现取（开工必做，不凭记忆）**

```bash
cd /Users/kevin/bistro/seafood
git log --oneline -3          # 期望 HEAD = e95c47c 或更新
git status --porcelain        # 期望空（零未跟踪改动；.s59-artifacts/** 属证据链，可忽略）
git rev-parse --abbrev-ref HEAD   # 期望 main
```

- 本单开工现取：HEAD = **`e95c47c`** · `git status --porcelain` = **空** · 分支 = **`main`**。
- 判据：HEAD 若与 `e95c47c` 不符 ⇒ **以你现取为准**并在记录列写实际 sha（出处：本单开工 `git log --oneline -3`）。

**0.2 端口红线（写死 · 出处 `docs/OPEN-ITEMS.md:57`）**

- 受控实例**只许**起 `5792–5799` 区间。
- **绝不得**碰 `5787` / `5788` / `5555` / `5191`（他人常驻面；见 `docs/seafood.master-plan.md:1734`）。
- **禁 `pkill -f` / `killall`**（硬口径④）；收尾**按精确 PID**（`kill <PID>`）＋ 验端口释放（`lsof -nP -iTCP:5792 -sTCP:LISTEN`）。
- 门 base URL 全经 **env 覆写**（`P8S7_BASE` / `P8S8_BASE` / `P8S10_BASE` / `P8S11_BASE` / `PORT`）⇒ **不得改门**（出处 `docs/OPEN-ITEMS.md:58`）。

**0.3 库面纪律（★ 本单核心）**

- **新库 = 生产**（公开面 0 夹具；出处 `docs/seafood.master-plan.md:1432`、`docs/OPEN-ITEMS.md` B22/B27）⇒ **一切写需 Kevin 授权**（出处 `docs/seafood.master-plan.md:1438`）。
- **禁止在生产库跑夹具 setup**：`backend-ts/scripts/p7b-06-fixture-setup.ts` 会**把夹具真正 INSERT 并提交**（`scripts/p7b-06-fixture-setup.ts:13`「建立后**提交**（并发用例需跨会话可见）」）⇒ 在生产库跑它 = 污染生产（详见 §1.2b）。
- **不可逆面**：`account_guard` 禁 `DELETE` + `ledger_entry_append_only` 禁 `UPDATE|DELETE` ⇒ 账本/账户行**插入后不可逐行回滚**（出处 `docs/OPEN-ITEMS.md` B27 末段；`docs/seafood.master-plan.md:1440` 复盘 5️⃣）。
- **无快照回滚点**：Vercel 已无 `SF_*`、无 Neon API 凭据 ⇒ **无分支 / 无 PITR**（出处 `docs/seafood.master-plan.md:1438`）⇒ 任何写前必须先**事务内预演 + `ROLLBACK`**。

**0.4 只读探针口径**

- 只读探针**只用** `DATABASE_URL_UNPOOLED`（规范名；出处 `backend-ts/src/env.ts:52-55`）。
- **密钥不上屏**（不打印连接串 / token / 完整 evm，硬口径③）。
- 原始输出**不用 `.log`**（硬口径⑥）；用 `.txt` / `.json` / `.tsv`。

---

## §1 环境矩阵（三档）

> **★ 核心问题**：门套的**数据前置来自夹具**，而**夹具只存在于旧库**；生产已切到**新库**（公开面 **0 夹具**、`users 27`、`job 3`）。⇒ 同一份门套在**三档环境**下读数不同，必须分档写清「哪些门能跑、哪些必红、红点是什么」。

| 档位 | 连库 | 起实例 | 库指向 | 夹具在场 | 用途 | 写面风险 |
|---|---|---|---|---|---|---|
| **① 离线/静态档** | 否 | 否 | 无 | — | 静态层 + 门套静态段 | 0（零 IO） |
| **② 受控实例档** | 是 | 是（5792–5799） | (2a) 旧库 / (2b) 新库 | (2a) 全 / (2b) 无 | 门套库面 + http 腿 | 见 2a/2b |
| **③ 生产档** | 是（只读） | 否 | 生产（新库） | 无 | 只读端点烟测 | 0（只读） |

### 1.1 档① 离线/静态档（不连库、不起实例）

- **能跑**：后端 `tsc --noEmit` · `tsc -p tsconfig.scripts.json --noEmit` · 前端 `vitest run` / `build` / 四脚本 · 门套中**纯静态段**（`p8-s1` / `p8-s2` / `p8-s3` / `p8-s3b` / `p8-s4` / `p8-s5-compliance` / `p8-s6` 全门静态；`p8-s7`–`p8-s11` 的 A–H 静态段；`s36-00`；`p7b-03`）。
- **必红（环境性，非回归；出处 `docs/OPEN-ITEMS.md:57,64`）**：
  - **8 处 http 腿红** = `p8-s7 G8/G9/G10` · `p8-s8 H5/H6/H7` · `p8-s10 K8` · `p8-s11 K10`，全 `fetch failed` / `status:-1`；
  - `p8-s5-02-ownership-gate` 退 **`EXIT 2`**（无实例）；
  - 凡**连库腿**的门（`p8-s7`–`p8-s11` 库面段、`s41-00`）**无库不可跑** ⇒ 记 `NOT_MEASURED`（不填 0）。

### 1.2 档② 受控实例档（起 5792–5799，**绝不碰 5787/5788/5555/5191**）

指向**哪个库**由 `.env.local` / 显式 env 决定。**两个子方案**：

**（2a）指向旧库**（含完整夹具 = 27+ 夹具行 / 旧 job 45 等）：

- 参考环境；因旧库是「**生产库的旧版**」且**已非生产** ⇒ 写面风险 = **无**（可安全跑夹具 setup / 库面写探针）。
- 逐门：`p8-s7`–`p8-s11` 库面 leg 应绿；http 腿起实例后绿。
- 用途：**门套数据类验证的推荐环境**（见 2b 结论）。

**（2b）指向新库 / 生产**（公开面 0 夹具、`users 27`、`job 3`）：

- **★ 禁止在此库跑夹具 setup**（`p7b-06-fixture-setup.ts` 会把夹具写进生产并提交 ⇒ 污染生产 + 不可逐行回滚）。
- 逐门「需要哪些前置数据、缺失时怎么红」（数据前置来源 = 夹具）：
  - `p8-s5-02`（归属闸 4 例）：依赖**已终态 `settled` 的 job（employer=uid 11）**（出处 `scripts/p8-s5-02-ownership-gate.ts:6-9`）⇒ 新库无该 job ⇒ 红。
  - `p8-s5-01-real-chains`/`p7b-06` 等**自造 fixture**（出处 `scripts/p8-s5-01-real-chains.ts:12`「自造 fixture · 不复用他人夹具」）⇒ 若指向生产，**不得跑**。
  - `p8-s7`–`p8-s11` 的库面 leg：多为**结构面只读**（约束 / 触发器 / 表 / 索引活体）⇒ 新库应可跑（schema 已 `0044` 齐），但**行为链探针**若依赖夹具行 ⇒ 红。
- **结论（明确建议）**：**门套数据类验证应在隔离环境 / 临时库做，不得在生产库上造夹具**。

### 1.3 档③ 生产档（只读端点烟测）

- 只打**公开只读端点**（`/api/health` / `/api/task/all` / `/api/prize/all` / `/api/user/asset/:uID` / `/api/home`）+ 鉴权/安全面负例（无真凭据）。
- **零写、零 setup、零夹具**。基线读数见 §6。

---

## §2 静态层（逐条命令 + 期望读数 + 判据）

### 2.1 后端类型检查（两条命令，口径不同）

```bash
# ① src 面（不覆盖 scripts/**）
cd /Users/kevin/bistro/seafood/backend-ts && npx tsc --noEmit
# 期望：exit 0（零错误）
```

- 判据：**exit 0**（出处 `backend-ts/.s51-artifacts/...` 家族；`docs/route-layer.spec.md:3985`）。
- `include` 只有 `src/**/*`（出处 `docs/route-layer.spec.md:157`「`npx tsc --noEmit` 不覆盖 `scripts/**`」）。

```bash
# ② scripts 面（硬门第二条命令）
cd /Users/kevin/bistro/seafood/backend-ts && npx tsc -p tsconfig.scripts.json --noEmit
# 计数：npx tsc -p tsconfig.scripts.json --noEmit 2>&1 | grep -cE 'error TS'
# 文件数：npx tsc -p tsconfig.scripts.json --noEmit 2>&1 | grep -oE '^[^(]+\.ts' | sort -u | wc -l
```

- 判据 = **「新增零错」（不是「全量零错」）**：改动面报错集与基线做 **sorted diff** ⇒ **新增行 = 0**；**基线不得推高**（出处 `docs/route-layer.spec.md:3962-3963`）。
- **当前基线 = `77` 条 / `22` 文件**（**Zang 现取** 2026-10-08 亲跑；本仓交叉现取，出处 `docs/route-layer.spec.md:157,3958-3975`、`docs/OPEN-ITEMS.md:111`）。
  - ★ **口径说明（并入）**：**`96` 是 S47 之前的旧值**（`96 = 77 锚 + 19 新增`，19 条落在新加入的 8 个 `p8-s*` 门脚本上）；**S47 已把那 19 条修掉 ⇒ 降至 `77`**（出处 `docs/OPEN-ITEMS.md:111`「S47 清掉 19 条 ⇒ `tsc -p tsconfig.scripts.json` **96 ⇒ 77**」）。
  - 判负形态：`77 ⇒ 78 ⇒ 复原 77`（出处 `docs/OPEN-ITEMS.md:111`）。

### 2.2 前端静态层

```bash
cd /Users/kevin/bistro/seafood/frontend

# 单测（全量）
npx vitest run
# 期望：53 files passed / 494 tests passed（Duration ≈ 8.2s）——【Zang 现取 2026-10-08】

# 构建
npm run build
# 期望：exit 0；产物入口 = dist/assets/index-BR4nlfLC.js + dist/assets/index-BIC8EUbT.css
#       （index-BR4nlfLC.js 与线上同名 ⇒ 可作产物指纹基线）

# 「四脚本」（逐条点名；真源 = backend-ts/.s31-artifacts/run_frontend.sh:12-17）
node scripts/p6-tr2-i18n-locales.mjs      # 四语       期望 exit 0（四语键集相等 PASS）
node scripts/p4z-i18nviol-global.mjs      # 全量口径   期望 exit 0（总判 PASS）
node scripts/p4z-feperf-safelist.mjs      # safelist   期望 exit 0
node scripts/p4z-miscfix-links.mjs        # miscfix-links 期望 exit 0
```

- 四脚本文件名**逐条点名**（出处 `backend-ts/.s31-artifacts/run_frontend.sh:12`）：
  `p6-tr2-i18n-locales.mjs`（四语）· `p4z-i18nviol-global.mjs`（全量口径）· `p4z-feperf-safelist.mjs`（safelist）· `p4z-miscfix-links.mjs`（miscfix-links）。
  - 册面「四脚本 = 四语 / 全量口径 / safelist / miscfix-links」逐字（出处 `docs/seafood.master-plan.md:1393`）。
- 判据：四脚本**全 PASS**（exit 0）（出处 `docs/seafood.master-plan.md:1883`）。
- `test:all`：

```bash
cd /Users/kevin/bistro/seafood/frontend && npm run test:all   # = ./scripts/test.sh
```

`frontend/scripts/test.sh`（`frontend/package.json:test:all`）**逐段结构**（出处 `frontend/scripts/test.sh:1-104`）：

| 段 | 行 | 调用 | 失败语义 |
|---|---|---|---|
| 1 单元测试 | `:26-33` | `npm run test:unit`（`vitest run src/test/unit`） | 失败 ⇒ `exit 1` |
| 2 组件测试 | `:35-42` | `npm run test:components`（`vitest run src/test/components`） | 失败 ⇒ `exit 1` |
| 3 性能测试 | `:44-51` | `npm run test:performance`（`vitest run src/test/performance`） | 失败 ⇒ `exit 1` |
| 4 可访问性测试 | `:53-60` | `npm run test:accessibility`（`vitest run src/test/accessibility`） | 失败 ⇒ `exit 1` |
| 5 E2E 测试 | `:62-69` | `npm run test:e2e`（`playwright test`） | 失败 ⇒ `exit 1` |
| 6 代码覆盖率 | `:71-77` | `npm run test:coverage`（`vitest run --coverage`） | 失败 ⇒ **仅警告**（不 `exit`） |
| 7 类型检查 | `:79-86` | `npx tsc --noEmit` | 失败 ⇒ `exit 1` |
| 8 代码检查 | `:88-95` | `npm run lint` | 失败 ⇒ `exit 1` |

- 逐段脚本名（出处 `frontend/package.json` `scripts`）：`test:unit` / `test:components` / `test:performance` / `test:accessibility` / `test:e2e` / `test:coverage` / `lint` / `type-check` / `build` / **`test:all`**。
- 退出码语义：`test.sh` 遇任一硬段失败即 `exit 1`；**唯 coverage 段失败仅警告**（`:72-77`）；跑到末段打印「可以安全部署了！」（`:104`）。

> ★ **`lint` 现况（Zang 现取，须入清单）**：`frontend/package.json:10` 有 `lint` 脚本（`eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`）与 eslint devDeps，但**全仓没有 eslint 配置文件**（`git ls-files | grep -i eslint` = **0 条**；`ls -a frontend` 无 `.eslintrc*` / `eslint.config.*`，本单现取）⇒ **`npm run lint` 当前 `exit 2`「couldn't find a configuration file」= 不可用**（**既有状态、非本轮回归**）。
> 两个处置候选（**不替 Kevin 决定**）：**(a) 恢复配置**（补 `.eslintrc*` / `eslint.config.*`，使脚本可用）；**(b) 从清单剔除 + 在册面登记该脚本为死脚本**。⇒ `test.sh` 第 8 段因此**当前会在 `exit 1` 处中止**；执行 `test:all` 前须先定这两候选之一。

---

## §3 门套 16 门（逐门一行）

> **跑法**（真源 = 历史 runner `backend-ts/.s51-artifacts/s51-20261007T045906Z/run_gates_s51.sh:41`）：
> `cd /Users/kevin/bistro/seafood/backend-ts && npx ts-node --transpile-only scripts/<file>`
> **为什么是 `ts-node` 不是 `tsx`**：`backend-ts/package.json` **无 `tsx`**（devDeps 仅 `ts-node ^10.9.0` / `typescript ^5.0.0`）⇒ 本仓 runner 一律用 `npx ts-node --transpile-only`。
> **env 覆写（受控实例相位）**（出处 `run_gates_s40.sh:12-17`）：
> `export P8S7_BASE=http://127.0.0.1:<PORT>` · `P8S8_BASE=…` · `P8S10_BASE=…` · `P8S11_BASE=…` · `export PORT=<5792–5799>` · `export P8S5_HTTP_MODE=after`。
> **门名单（16）**（出处 `docs/OPEN-ITEMS.md:54`）：`p8-s1`·`p8-s2`·`p8-s3`·`p8-s3b`·`p8-s4`·`p8-s5-02-ownership`·`p8-s5`·`p8-s6`·`p8-s7`·`p8-s8`·`p8-s9`·`p8-s10`·`p8-s11`（13）＋ `s36-00`（独立门）＋ `p7b-03-offline-gates` ＋ `s41-00`（只读巡检门）= **16**。

| # | 门（脚本文件） | 命令 | 期望读数（2026-10-05 基线） | 判据 / 退出码 | 两相位差异 |
|---|---|---|---|---|---|
| 1 | `p8-s1 app_config` · `scripts/p8-s1-app-config-gate.ts` | `npx ts-node --transpile-only scripts/p8-s1-app-config-gate.ts` | `24/24` | 全绿 exit 0；任一 FAIL ⇒ exit 1（头 `:1-40`） | 零 DB/网络/HTTP ⇒ **两相位同** |
| 2 | `p8-s2 费率/返佣` · `scripts/p8-s2-fee-rebate-gate.ts` | `npx ts-node --transpile-only scripts/p8-s2-fee-rebate-gate.ts` | `44/44` | 同上（头 `:1-40`） | 零 DB/网络/HTTP ⇒ **两相位同** |
| 3 | `p8-s3 保证金` · `scripts/p8-s3-deposit-gate.ts` | `npx ts-node --transpile-only scripts/p8-s3-deposit-gate.ts` | `45/45` | 同上；迁移文件数经 `readdirSync`（纯离线 `docs/OPEN-ITEMS.md:40`） | **两相位同**（纯离线） |
| 4 | `p8-s3b 键级寻址` · `scripts/p8-s3b-address-gate.ts` | `npx ts-node --transpile-only scripts/p8-s3b-address-gate.ts` | `38/38` | 同上 | **两相位同** |
| 5 | `p8-s4 自建币审核` · `scripts/p8-s4-currency-review-gate.ts` | `npx ts-node --transpile-only scripts/p8-s4-currency-review-gate.ts` | `79/79` | 同上（`0025` 只文本断言，不 apply） | **两相位同** |
| 6 | `p8-s5-02 归属闸 HTTP` · `scripts/p8-s5-02-ownership-gate.ts` | `PORT=5796 P8S5_HTTP_MODE=after npx ts-node --transpile-only scripts/p8-s5-02-ownership-gate.ts` | `6/6`（实例在） | 4 例：401/403/404/409/200 形态；**离线相位退 `EXIT 2`** | ★ **两相位不同**：离线 `EXIT 2`；实例相位 `6/6` |
| 7 | `p8-s5 合规审核` · `scripts/p8-s5-compliance-gate.ts` | `npx ts-node --transpile-only scripts/p8-s5-compliance-gate.ts` | `117/117` | 全绿 exit 0 | **两相位同**（静态） |
| 8 | `p8-s6 站点文案` · `scripts/p8-s6-site-text-gate.ts` | `npx ts-node --transpile-only scripts/p8-s6-site-text-gate.ts` | `64/64` | 全绿 exit 0 | **两相位同** |
| 9 | `p8-s7 batt/签到` · `scripts/p8-s7-batt-checkin-gate.ts` | `PORT=<P> P8S7_BASE=http://127.0.0.1:<P> npx ts-node --transpile-only scripts/p8-s7-batt-checkin-gate.ts` | `60/60`（实例在；分母只增不减） | A–F 静态 + G 库面/HTTP；`status:-1`（fetch failed）**一律判负** | ★ **离线**：`G8/G9/G10` 红（fetch failed）；实例绿 |
| 10 | `p8-s8 评分/时效` · `scripts/p8-s8-rating-timeliness-gate.ts` | `PORT=<P> P8S8_BASE=http://127.0.0.1:<P> npx ts-node --transpile-only scripts/p8-s8-rating-timeliness-gate.ts` | `92/92`（实例在） | A–H；G 库面 leg + 四段真链路（事务内 + 末尾 ROLLBACK）+ 受控实例 HTTP | ★ **离线**：`H5/H6/H7` 红；实例绿 |
| 11 | `p8-s9 BTTC` · `scripts/p8-s9-bttc-gate.ts` | `npx ts-node --transpile-only scripts/p8-s9-bttc-gate.ts` | `100/100` | A–L；K 库面活体只读（**零 HTTP**）；`schema_migration 43·0044` | **两相位同**（只连库，不连实例） |
| 12 | `p8-s10 邀请奖励` · `scripts/p8-s10-invite-reward-gate.ts` | `PORT=<P> P8S10_BASE=http://127.0.0.1:<P> npx ts-node --transpile-only scripts/p8-s10-invite-reward-gate.ts` | `49/49`（实例在） | A–H 静态 + K 库面/HTTP；库面写事务内 + ROLLBACK | ★ **离线**：`K8` 红；实例绿 |
| 13 | `p8-s11 审计台` · `scripts/p8-s11-audit-console-gate.ts` | `PORT=<P> P8S11_BASE=http://127.0.0.1:<P> npx ts-node --transpile-only scripts/p8-s11-audit-console-gate.ts` | `87/87`（实例在） | A–J 静态 + K 库面/HTTP；401/200/400 三态 | ★ **离线**：`K10` 红；实例绿 |
| 14 | `s36-00 同表双形态` · `scripts/s36-00-identity-pk-form-gate.ts` | `npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts` | 受体 188 / 命中 30 / 基线 30（`docs/OPEN-ITEMS.md:56`；基线 json `baseline_count=30`） | **exit 0** 绿（无新增命中）/ **3** 红 / **2** 致命；受体=0 或命中=0 ⇒ 断言无效（头 `:44-48`） | **两相位同**（零 DB/零网络） |
| 15 | `p7b-03 离线判据` · `scripts/p7b-03-offline-gates.ts` | `npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts` | **EXIT 0**（`37/37 · red=[]`） | exit 0；**不连库**（头 `:1-9`） | **两相位同**（零 DB/网络） |
| 16 | `s41-00 序列撞号` · `scripts/s41-00-identity-seq-collision-gate.ts` | `npx ts-node --transpile-only scripts/s41-00-identity-seq-collision-gate.ts` | 受体 23 列 / 读数 / 违例 0（基线 json `column_count=23`） | **0 GREEN / 3 撞态 / 4 WARN / 5 断言无效 / 2 致命**（头 `:31-38`）；env `S41_GAP_THRESHOLD`（默认 1000） | ★ **离线**：无库 ⇒ `NOT_MEASURED`；实例相位 GREEN |

**s41-00 口径（逐字，出处 `docs/OPEN-ITEMS.md:55`）**：撞号判据 = 「**`nextval` 落在已占用集合内**」（**不是** `seq ≤ max`）；三态 **FAIL（已撞）/ WARN（`gap ≤ 1000`，env `S41_GAP_THRESHOLD` 可覆写）/ OK**；退出码 **0 GREEN / 3 撞态 / 4 WARN**；**纯只读**（门内 6 条 SQL 全 `SELECT`）。
**术语口径（出处 `docs/OPEN-ITEMS.md:56`）**：既有门里「**命中**」= **违例**；`s41-00` 输出用 **读数数 / 违例数**（`readings` / `violations`），**无效判据锚 = 读数数 0**（不是违例数 0）。
**s7 G9 口径（出处 `docs/OPEN-ITEMS.md:59`）**：数据态感知四分支各断言**状态码 + 形状**；`status:-1` 判负；**分母只增不减**；新增数据态分支必须入 `selftest`。

---

## §4 受控实例跑法（精确命令 + 端口 + PID 记录 + 收尾验释放）

**4.1 起实例（只许 5792–5799）**

```bash
cd /Users/kevin/bistro/seafood/backend-ts
RUNID=s59-20261009T005618Z
PORT=5792 nohup npx ts-node --transpile-only src/index.ts \
  > .s59-artifacts/$RUNID/instance-5792.stdout 2>&1 &
echo "instance bg pid=$!"
```

- 就绪判据：stdout 出现横幅 **`TypeScript backend running on port 5792`**（本仓上一轮实测逐字，出处 `backend-ts/.s40-artifacts/s40-20261005T112247Z/instance-5792.stdout`；形态「TypeScript backend running on port <PORT>」）。
- `src/index.ts` 读 `process.env.PORT`（`frontend/package.json` 无涉；`backend-ts/package.json` `dev = ts-node src/index.ts`）。**启动 incantation 若与本仓既有口径不符，以你现取为准**；就绪横幅为判据。
- **逐 PID 记录**：

```bash
lsof -nP -iTCP:5792 -sTCP:LISTEN        # 记 LISTEN PID = <A>
ps -o pid,ppid,command -p <A>           # 记 npm 父 <B>
```

**4.2 跑 16 门（env 覆写 · 逐门一进程）**

```bash
export PORT=5792
export P8S5_HTTP_MODE=after
export P8S7_BASE=http://127.0.0.1:5792
export P8S8_BASE=http://127.0.0.1:5792
export P8S10_BASE=http://127.0.0.1:5792
export P8S11_BASE=http://127.0.0.1:5792
# 逐门：npx ts-node --transpile-only scripts/<file>；记 exit
```

**4.3 15 门全绿基线（照引 C 段 2026-10-05 实测 · 出处 `docs/OPEN-ITEMS.md:57`）**

`s1 24/24` · `s2 44/44` · `s3 45/45` · `s3b 38/38` · `s4 79/79` · `s5-02 6/6` · `s5 117/117` · `s6 64/64` · `s7 60/60` · `s8 92/92` · `s9 100/100` · `s10 49/49` · `s11 87/87` · `s36-00 GREEN` · `p7b-03 EXIT 0`。
（另 `s41-00` 落地后为第 16 门；S51 `16/16 门全绿` 逐门 = `docs/seafood.master-plan.md:1764`。）

**4.4 收尾（按精确 PID · 禁 `pkill -f` / `killall`）**

```bash
kill <A> <B> 2>/dev/null           # 精确 PID，不用 -f/-9 批量
sleep 1
lsof -nP -iTCP:5792 -sTCP:LISTEN   # 期望空
lsof -nP -iTCP:5793-5799 -sTCP:LISTEN 2>/dev/null  # 期望空（5792–5799 全空）
lsof -nP -iTCP:5787 -sTCP:LISTEN; lsof -nP -iTCP:5788 -sTCP:LISTEN
lsof -nP -iTCP:5555 -sTCP:LISTEN; lsof -nP -iTCP:5191 -sTCP:LISTEN  # 期望四条目无恙
```

- 判据：`5792–5799` **全空** ∧ 他人 `5787/5788/5555/5191` **4/4 仍在听**（出处 `docs/seafood.master-plan.md:1734,1845`）。

---

## §5 数据层不变量与已知差额口径

> 权威口径 = `docs/data-layer.spec.md`（v0.28）+ `docs/seafood.master-plan.md` §5.400。

**5.1 不可变面（append-only）**

- `account_guard` **禁 `DELETE`** + `ledger_entry_append_only` **禁 `UPDATE|DELETE`**（出处 `docs/OPEN-ITEMS.md` B27 末段；`docs/seafood.master-plan.md:1440` 复盘 5️⃣）⇒ 账本 / 账户行**插入后不可逐行回滚**。
- `ledger_entry` 三性（出处 `docs/data-layer.spec.md:4505`）：`trg_ledger_entry_append_only`（`BEFORE UPDATE OR DELETE`）· PK=`txid` · 排序键=`(time_created DESC, txid DESC)`。
- `TRUNCATE` 守卫（出处 `backend-ts/migrations/0043_truncate_guard.sql:1-45`）：**15 张 append-only 表**各补一枚 `BEFORE TRUNCATE`（`FOR EACH STATEMENT`）守卫，函数名 `<table>_no_truncate()`、原生 `RAISE EXCEPTION`（`P0001`，不借账本码）。逐表清单：`ledger_entry` / `referral` / `commission_policy` / `market_trade` / `currency_status_log` / `admin_ops_audit_log` / `admin_refund_audit_log` / `currency_review_log` / `listing_review_log` / `job_arbitration_log` / `batt_entry` / `checkin_log` / `checkin_makeup_log` / `rating` / `listing_order_event`（`0043:22-38`）。实测 `TRUNCATE rating` ⇒ `P0001`（出处 `docs/OPEN-ITEMS.md:88`）。
- 说明：「15 面」中 **`app_config` 非 append-only**（`tgtype=19` = `BEFORE UPDATE`）；**真 append-only = 14 面**（出处 `docs/data-layer.spec.md:5,4525`）。

**5.2 守恒 / 配对不变量**

- `account ↔ ledger_entry`：全局失配应 = **0**（`docs/seafood.master-plan.md:1467`）。
- `batt_account ↔ batt_entry`：`batt` 余额 = 对应 `batt_entry` 之和（S58 预演读数 `batt 90` = 3 行之和，`docs/seafood.master-plan.md:1465`）。
- 禁绕过账本写余额（`DL5`，出处 `docs/data-layer.spec.md:119`）：`account` 唯一合法写者 = `ledger_post_event`。

**5.3 ★ 已知差额口径（守卫须换算）**

- 新库 `total_supply = 2,010,200` − 新库账本净额 `Σmint−Σburn = 10,200` = **`2,000,000` = 未搬的纯夹具 mint/burn 净额**（几乎全为 `970001` 的 `mint 2,000,000`）（出处 `docs/seafood.master-plan.md:1435`；`docs/OPEN-ITEMS.md` B25/B27）。
- **`total_supply` 保持币种级 `2,010,200`**（裁：差额可解释、非漂移）（出处 `docs/seafood.master-plan.md:1435`）。
- ⇒ **对账守卫在新库必须按此已知差额换算**：`expected_net = Σmint − Σburn`，而 `total_supply = expected_net + 2,000,000`（**不得**用 `total_supply == Σmint−Σburn` 直接判负，否则**恒红**）。

**5.4 巡检门（数据层）**

- `s41-00` 撞号巡检：受体 = 全库带 identity/serial 的**列**；判据 = 「`nextval` 落在已占用集合内」（§3 表 #16）；基线 = 首次巡检 **23 列**（出处 `backend-ts/scripts/s41-00-identity-seq-collision-gate.baseline.json` meta `column_count=23`）。env `S41_GAP_THRESHOLD`（默认 1000）。
- `s36-00` 同表双形态：基线残差 **30**（`baseline_count=30`）+ `unreachable_floor = 900_000_000`（出处 `backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json`）；**新增命中 = 零容忍 ⇒ 红**（头 `:44-48`）。
- `s7`/`s8`/`s9`/`s10`/`s11` 的库面 leg：`schema_migration` **43 行 / max `0044`**（出处 `docs/OPEN-ITEMS.md:40`、`docs/seafood.master-plan.md:1731`）。

---

## §6 生产面烟测（只读 · 用本轮现取终态做基线）

> 以下读数**以台账现取终态**为基线（**本单不重取**；执行方如重取，须与本基线逐字对齐）：

| 端点（GET） | 期望读数 | 出处 |
|---|---|---|
| `/api/health` | `status: ok` / `schema_version: 0044`（`200`） | `docs/seafood.master-plan.md:1452,1485`；`backend-ts/src/index.ts:421-440` |
| `/api/task/all` | **恰 3 行**，`tID = [136, 230, 232]` | `docs/seafood.master-plan.md:1482,1498` |
| `/api/prize/all` | **0 行** | `docs/seafood.master-plan.md:1485` |
| `/api/user/asset/100` | `{"uID":100,"points":4382,…}`（`200`）★**基线就地更正**（`4292`→`4382`，「数据态漂移、非回归」，见 §5.401） | `docs/seafood.master-plan.md:1498` · `§5.401` |
| `/api/home` | 空态形状（公开只读面；失败降级匿名） | `backend-ts/src/index.ts:837-844` |
| 夹具串（对 siteName / 公开面） | 命中 **0** | `docs/seafood.master-plan.md:1462`；`docs/OPEN-ITEMS.md` B22 |

**6.1 命令（只读）**

```bash
# 生产规范 host = https://0xseafood.com（2026-10-09 起，变体 B 一刀切；出处 §5.401）
# ★ 本机把该域 DNS 劫持到 fake-IP 段 ⇒ 必须 --resolve 强指 Vercel anycast，否则读数是假的
HOST=https://0xseafood.com
RES="--resolve 0xseafood.com:443:76.76.21.21"
curl -s $RES "$HOST/api/health"            # 期望：ok / schema_version 0044
curl -s $RES "$HOST/api/task/all" | jq 'length'    # 期望：3
curl -s $RES "$HOST/api/task/all" | jq '[.[].tID]' # 期望：[136,230,232]
curl -s $RES "$HOST/api/prize/all" | jq 'length'   # 期望：0
curl -s $RES "$HOST/api/user/asset/100"    # 期望：points=4382（★2026-10-09 由 4292 就地更正）
curl -s $RES "$HOST/api/home"              # 记录空态形状
```

- 判据：与上表逐项相等；**只读**，不带凭证，**零写**。
- 夹具串扫描：对 `/api/home` / 公开面响应做夹具串关键字（如 `fixture`）扫描 ⇒ **命中 0**。

**6.2 产物指纹法（线上 ⇄ 本地 `dist/`）**

```bash
# 本地（Zang 现取）：入口 = dist/assets/index-BR4nlfLC.js
shasum -a 256 /Users/kevin/bistro/seafood/frontend/dist/assets/index-BR4nlfLC.js
# 线上：取同名资源 sha256
curl -s "$HOST/assets/index-BR4nlfLC.js" | shasum -a 256
# 判据：两侧 sha256 逐字相同（同名 + 同哈希 ⇒ 线上=本地）
```

- 出处：`docs/seafood.master-plan.md:2383`（线上 `index-*.js` sha256 与本地 `cmp` 0 的先例）。

---

## §7 鉴权 / 安全面

**7.1 无凭证负例（不触库 / 不触真凭据）**

```bash
HOST=https://0xseafood.com     # 2026-10-09 起（出处 §5.401）；本机须加 --resolve 0xseafood.com:443:76.76.21.21
# ① 挑战：空 body ⇒ 400「Invalid EVM address」（纯计算，不触库）
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$HOST/api/auth/challenge" \
  -H 'content-type: application/json' -d '{}'     # 期望：400
# ② 验证：空 body ⇒ 401 AUTH_UNAUTHORIZED
curl -s -X POST "$HOST/api/auth/verify" \
  -H 'content-type: application/json' -d '{}'     # 期望：401 + error.code=AUTH_UNAUTHORIZED
# ③ 受保护口未带凭证 ⇒ 401
curl -s -o /dev/null -w '%{http_code}\n' "$HOST/api/user/all"   # 期望：401
```

- 判据出处：`POST /api/auth/challenge {}` ⇒ `400 Invalid EVM address`（`backend-ts/src/index.ts:457-463` + `backend-ts/src/auth.ts:135-138`，纯计算、不触库）；`POST /api/auth/verify {}` ⇒ `401 AUTH_UNAUTHORIZED`（`backend-ts/src/index.ts:289-310`）；受保护口（`/api/user/all` 等）未带凭证 ⇒ `401` 形状（`backend-ts/src/index.ts:1938-1941` 走 `requireAdmin`）。

**7.2 公开读口白名单（应 200）**

- `/api/health` · `/api/task/all` · `/api/prize/all` · `/api/user/asset/:uID` · `/api/home`（公开只读面；`backend-ts/src/index.ts:837-844` 注「`/api/home` 是公开只读面」）。
- 判据：无 token ⇒ **200**（非 401）。

**7.3 admin 闸（应 403）**

- 带**非 admin 凭证**访问 admin 面 ⇒ `403 AUTH_FORBIDDEN` + `details.reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`（出处 `backend-ts/src/index.ts:289-345`；无凭证则前置 401）。
- **不得用真账号 / 真钱包 / 真密码**：本面只用**构造性负例**（空 body / 无 token / 假 token），**不注入任何真实凭据**。

---

## §8 判负与负对照（证明「判据是活的」）

> 原则：**仓外副本注入 ⇒ 应红；复原 ⇒ 绿**。逐门/逐探针给出最少一条可实施的判负。

| 面 | 判负手法 | 期望 |
|---|---|---|
| `tsconfig.scripts.json` 报错计数 | 新增 1 处类型错 | `77 ⇒ 78 ⇒ 复原 77`（出处 `docs/OPEN-ITEMS.md:111`） |
| `s36-00` | 仓外副本把号段改回 `900xxx` | 新增命中 7 处 ⇒ **exit 3**；复原 md5 逐字节一致 ⇒ 绿（出处 `docs/OPEN-ITEMS.md:78`） |
| `s41-00` | `--selftest`（内存合成数据判负，不连库） | 合成 FAIL/WARN/OK 三态复现（头 `:29-38`） |
| `p8-s1..s11` 类级门 | 谓词喂错值 / 注入违规 | 扫描器**必须转红**（不转红 = 假门；各门头「门自证（负对照）」段） |
| 四脚本 | i18n 注入 1 键 / safelist 抽 1 类 / links 改 1 链接 | 对应脚本 **exit ≠ 0**；复原 ⇒ exit 0 |
| 前端 `build` | 引入 1 处语法错 | `build` 非 0；复原 ⇒ 0 |
| `s7 G9` 数据态 | 构造 `status:-1` 分支 | **一律判负**（出处 `docs/OPEN-ITEMS.md:59`） |
| 过授权写 | 只在**事务内预演 + 哨兵抛错 ROLLBACK**（先例 `scripts/p8-s5-01-real-chains.ts:10`） | 预演后复核回到写前计数 |

- 判负铁律：`s36-00` / `s41-00` / `p4z` 家族 ⇒ **受体 = 0 或读数 = 0 ⇒ 自标「断言无效」**（禁当「零违例」）。
- 副本纪律：**副本用完即清**（出处 `docs/OPEN-ITEMS.md:61`）。

---

## §9 禁止清单（逐条）

1. **禁**执行本单之外的测试 / 门 / 探针（本单是**清单**，不是执行单）。
2. **禁**在生产库（新库）跑夹具 setup（`p7b-06-fixture-setup.ts` 会把夹具写进生产并提交）。
3. **禁**在生产库造任何夹具 / 逐行写（含 `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`setval`）—— **写需 Kevin 授权**。
4. **禁**起 `5787` / `5788` / `5555` / `5191` 端口；**只许** `5792–5799`。
5. **禁** `pkill -f` / `killall`（收尾只用 `kill <精确 PID>`）。
6. **禁** `vercel env`（读或写）—— 本单**不碰 env 面**。
7. **禁**打印任何密钥 / 连接串 / token / **完整 evm**（密钥不上屏）。
8. **禁** `commit` / `push` / `git add`（本单**零仓改动**，除新增本文档）。
9. **禁**原始输出用 `.log`（用 `.txt` / `.json` / `.tsv`）。
10. **禁**用真账号 / 真钱包 / 真密码（鉴权面只用构造性负例）。
11. **禁**改门脚本 / 迁移 / `src`（本单**只写 `docs/qa/`**）。
12. **禁**把 `total_supply == Σmint−Σburn` 当判据（新库**须换算** `2,000,000`，否则恒红）。

---

## §10 执行表（勾选 + 预计耗时 + 记录列）

> 记录列三栏：**实测值 / 判定（PASS·FAIL·NOT_MEASURED）/ 证据路径**。

| ✓ | 项 | 命令（简） | 档 | 预计 | 实测值 | 判定 | 证据路径 |
|---|---|---|---|---|---|---|---|
| [ ] | 锚点 | `git log --oneline -3` | ① | 5s | | | |
| [ ] | 工作树 | `git status --porcelain` | ① | 5s | | | |
| [ ] | 后端 tsc | `npx tsc --noEmit` | ① | ~20s | | | |
| [ ] | scripts tsc | `npx tsc -p tsconfig.scripts.json --noEmit` | ① | ~30s | | | |
| [ ] | 前端 vitest | `npx vitest run` | ① | ~8s | | | |
| [ ] | 前端 build | `npm run build` | ① | ~20s | | | |
| [ ] | 四脚本 | `node scripts/{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.mjs` | ① | ~30s | | | |
| [ ] | test:all | `npm run test:all`（★ lint 段现况不可用） | ① | ~2min | | | |
| [ ] | 门 1–5 | `p8-s1/s2/s3/s3b/s4` | ① | ~1min | | | |
| [ ] | 门 6 | `p8-s5-02`（离线 `EXIT 2`） | ① | 10s | | | |
| [ ] | 门 7–8 | `p8-s5/s6` | ① | ~40s | | | |
| [ ] | 门 14–15 | `s36-00` / `p7b-03` | ① | ~30s | | | |
| [ ] | 起实例 | `PORT=5792 npx ts-node --transpile-only src/index.ts` | ② | 15s | | | |
| [ ] | PID 记录 | `lsof -nP -iTCP:5792 -sTCP:LISTEN` | ② | 5s | | | |
| [ ] | 门 9–13 | `p8-s7/s8/s9/s10/s11`（env 覆写） | ② | ~2min | | | |
| [ ] | 门 16 | `s41-00` | ② | 15s | | | |
| [ ] | 收尾 | `kill <PID>` + 验端口释放 | ② | 10s | | | |
| [ ] | 生产 health | `curl $HOST/api/health` | ③ | 5s | | | |
| [ ] | 生产 task/all | `curl $HOST/api/task/all` | ③ | 5s | | | |
| [ ] | 生产 prize/all | `curl $HOST/api/prize/all` | ③ | 5s | | | |
| [ ] | 生产 asset/100 | `curl $HOST/api/user/asset/100` | ③ | 5s | | | |
| [ ] | 生产 home 空态 | `curl $HOST/api/home` | ③ | 5s | | | |
| [ ] | 夹具串扫描 | 公开面关键字扫描 | ③ | 5s | | | |
| [ ] | 产物指纹 | 线上 ⇄ 本地 sha256 | ③ | 10s | | | |
| [ ] | 鉴权负例 | challenge/verify/user-all 401/400 | ③ | 10s | | | |
| [ ] | 判负 | §8 逐条红→绿 | ②/外 | 视项 | | | |

---

## §11 已知非回归红点（环境性 / 数据态）

> 以下红点**不是回归**，是**环境或数据态**所致；**切库后部分数据态红点会变**。

**11.1 环境性红点（离线相位）**

- **8 处 http 腿红**：`p8-s7 G8/G9/G10` · `p8-s8 H5/H6/H7` · `p8-s10 K8` · `p8-s11 K10`，全 `fetch failed` / `status:-1`（出处 `docs/OPEN-ITEMS.md:57,64`）。
- `p8-s5-02` 退 `EXIT 2`（无实例）。
- 成因：**无受控实例**；起 `5792–5799` 即绿（S19 复核 4 门 = `56/59`、`70/74`、`48/49`、`86/87`，红点逐条定位为 http 腿，出处 `docs/OPEN-ITEMS.md:64`）。
- **切库不影响**（纯环境性）。

**11.2 数据态红点（切库后会变）**

- **门套数据前置来自夹具，夹具只在旧库**；新库公开面 **0 夹具**（`users 27` / `job 3`）⇒ 依赖夹具行的门（尤其 `p8-s5-02` 依赖 `settled` job、各门四段真链路）**在新库会因前端数据缺失而红**。
- **`s41-00`**：旧库有夹具残差固定号（如 `900001`）⇒ 撞号对在多；新库该残留已随分库清除 ⇒ **读数集合会变**（执行方须重取，与基线 23 列对拍）。
- **`s36-00`**：基线残差 30 含「号段上移」后的夹具面；**切库后 scripts/migrations 面不变**（该门只读仓内文本，不连库）⇒ **不随切库变**。
- **对账守卫**：`total_supply == Σmint−Σburn` 在**新库恒差 `2,000,000`**（未搬纯夹具 mint/burn，§5.3）⇒ 守卫**须换算**，否则恒红。
- 判据：以上均**须在隔离环境 / 旧库参考环境**复核；**生产库不得造夹具**。

**11.3 既有状态红点（非本轮回归）**

- 前端 `npm run lint` **当前不可用**（无 eslint 配置，`exit 2`；§2.2）⇒ `test:all` 第 8 段会中止；处置候选 (a)/(b) 待 Kevin。
- `frontend/dist/assets/index-BR4nlfLC.js` 与线上同名（指纹基线）；若线上已前推，**以线上现取为准**。

---

> **本清单性质**：**只读、可手跑、逐条可复制**。执行时**锚点现取、读数为准**；不能确认者标 `NOT_MEASURED`，**不填 0 / 不填空**。
> **出处索引**：`docs/OPEN-ITEMS.md` C 段 · `docs/route-layer.spec.md` §13 · `docs/data-layer.spec.md` §35 / DL5 / DL76 / DL156 · `docs/seafood.master-plan.md` §5.398–§5.400 / §5.152 · 各门脚本头注释 · `backend-ts/scripts/*.baseline.json`。
