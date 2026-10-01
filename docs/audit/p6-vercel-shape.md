# P6-VERCEL-SHAPE —— 部署形态三处收口（骸架先行 · 逐段回填）

> 状态：**骸架已立**，正文逐段回填中。未取到的读数一律写 `NOT_MEASURED`（**不填 0、不填空**）。
> 单号：P6-VERCEL-SHAPE（Kong 派单）· 执行：P6 子代理 · 仓：`/Users/kevin/bistro/seafood`
> 臂架时点：2026-10-01 08:0x（CST）；本文所有读数均带**命令出处**，可 `grep` 复现。

## 0. 章节目录（回填顺序）

- §1 现场引证（外部 vantage + 本机复现）
- §2 逐处 diff（三件，仅此三件）
- §3 逐项读数（硬 AC ①–⑥ 对账）
- §4 `vercel.json` 区域配置的形状裁定（含 schema 引证与手改面板步骤）
- §5 探针自曝（本单探针可能怎么骗我）
- §6 边界自证（未碰清单 · 并发写者 · 口径）
- §7 `NOT_MEASURED` 登记（禁填 0/空）

## §1 现场引证（外部 vantage + 本机复现）

| # | 引证 | 命令 / 出处 | 读数 |
|---|---|---|---|
| 1.1 | 线上 `/api/health` = 404、`/api/home` = 500、`/` = 200 | 外部 vantage（派单现场）+ 本机 `vercel inspect https://seafood-opal.vercel.app` | 部署 `seafood-s321tbsj1-alwaysfit.vercel.app`（production, Ready, 2026-09-28 12:31） |
| 1.2 | Vercel 库变量**全带 `SF_` 前缀** | **本人现取**：`vercel env ls`（只读） | 20 行全量；`SF_DATABASE_URL` / `SF_DATABASE_URL_UNPOOLED` / `SF_POSTGRES_URL` / `SF_POSTGRES_URL_NON_POOLING` 均 `Preview, Production`，`4d ago`；另有 `SF_POSTGRES_URL_NO_SSL` / `SF_POSTGRES_PRISMA_URL` / `SF_PGDATABASE` / `SF_PGHOST` / `SF_PGUSER` / `SF_PGPASSWORD` / `SF_PGHOST_UNPOOLED` / `SF_POSTGRES_{DATABASE,USER,PASSWORD}` / `SF_NEON_PROJECT_ID` / `SF_NEON_AUTH_BASE_URL` / `SF_VITE_NEON_AUTH_URL` |
| 1.3 | `SECRET_KEY` 已以**不带前缀**名写入（Production 4m ago / Preview 2m ago） | 同上 | 列表**无**任何不带前缀的 `DATABASE_URL` / `POSTGRES_URL` / `PG*` 行 ⇒ 根因 1 成立 |
| 1.4 | 代码只读**不带前缀**的规范名 | 本机 `grep`：`process.env.*` 直方图（`src/` 全量） | DB 面只出现 `DATABASE_URL`(4) / `POSTGRES_URL`(3) / `DATABASE_URL_UNPOOLED`(1) / `POSTGRES_URL_NON_POOLING`(1) / `SECRET_KEY`(4)；其余为 `SEAFOOD_*` `PORT` `AUTH_*` `ADMIN_EVM_ADDRESSES` `ACCESS_TOKEN_EXPIRE_MINUTES` `VERCEL`。**零** `process.env.PG*` / `NEON*` / `VITE*` 读点 ⇒ 4 对映射即覆盖业务面全部连接串键 |
| 1.5 | serverless 无 dotenv 兜底 | `backend-ts/.env.local` 存在（`DATABASE_URL` 等 9 键）；`.vercelignore` 第 5–9 行 `.env` / `.env.*` / `**/.env.local` ⇒ 不入包 | — |
| 1.6 | 改前函数落 **iad1**（美东），库在 **ap-southeast-1** | `vercel inspect https://seafood-opal.vercel.app` 现取 | `Builds: λ backend-ts/src/index.ts (609.18KB) [iad1]` |
| 1.7 | `vercel.json` 转发**保留原路径** | 仓根文件现取 | `routes[0] = { src: "/api/(.*)", dest: "backend-ts/src/index.ts" }`（无 `rewrite`/无路径剥离）⇒ 函数收到 `/api/health` |

## §2 逐处 diff（仅此三件；`git diff --stat` 现取：3 files changed, 44 insertions(+), 2 deletions(-)）

### 2.1 `backend-ts/src/env.ts`（+32）

在既有三次 `dotenv.config(...)` **之后**、`export const ENV_REPO_ROOT` **之前**插入单点小表 + 条件赋值：

```ts
const VERCEL_PREFIX_FALLBACKS: ReadonlyArray<readonly [string, string]> = [
  ['DATABASE_URL', 'SF_DATABASE_URL'],
  ['DATABASE_URL_UNPOOLED', 'SF_DATABASE_URL_UNPOOLED'],
  ['POSTGRES_URL', 'SF_POSTGRES_URL'],
  ['POSTGRES_URL_NON_POOLING', 'SF_POSTGRES_URL_NON_POOLING'],
];

for (const [canonical, vercelName] of VERCEL_PREFIX_FALLBACKS) {
  if (!process.env[canonical] && process.env[vercelName]) {
    process.env[canonical] = process.env[vercelName];
  }
}
```

- 判据逐字满足派单：**仅当** `!canonical && prefixed` 才赋值 ⇒ 已有值**永不覆盖**（本地 `.env.local` 优先）。
- 表旁注释逐条引证来源：Vercel 环境变量名单（§1.2/1.3）+ `vercel.json` 转发形态（§1.7）+ 代码读点（§1.4）。
- `SECRET_KEY` **未入表**（1.3 已证明它以规范名存在）；**未**把它写进表以免制造假绑定。
- 位置保证：本模块是 `src/index.ts:4` 的**首 import** ⇒ 映射早于 `./auth`（`auth.ts:3` 模块期读 `SECRET_KEY`）与 `./database` / `./db` / `./ledger` 的取值。

### 2.2 `backend-ts/src/index.ts`（+13 / −2）

```diff
-app.get('/health', async (req, res) => {
+const sendHealthReport = async (req: Request, res: Response) => {
   // 健康检查不得被 CDN / 中间缓存（否则会长期报陈旧状态）
   res.setHeader('Cache-Control', 'no-store');
   ...
-});
+};
+
+// 两个注册点共用**同一 handler**（`/health` 既有面 + `/api/health` Vercel 转发面）
+app.get('/health', sendHealthReport);
+app.get('/api/health', sendHealthReport);
```

- 只把**匿名 handler 提成一个常量**并**多加一个注册点**；handler 体（`healthCheck()` 报告对象、`no-store`、503 兜底体）**逐字未动** ⇒ 响应体形状不变。
- 未改 `routes`/中间件/`app.use` 的 404 兜底、未改 `PORT`、未改 `if (!process.env.VERCEL)` 门。

### 2.3 `vercel.json`（+1）

```diff
 {
   "version": 2,
+  "regions": ["sin1"],
   "builds": [ ... 未动 ... ],
   "routes": [ ... 未动 ... ]
 }
```

- 现取校验：`python3 -c "json.load(...)"` ⇒ `JSON_OK regions= ['sin1'] keys= ['version','regions','builds','routes']`（语义键集不变，只多 `regions`）。
- 形状裁定见 §4。

## §3 逐项读数（硬 AC ①–⑥ 对账）

| AC | 判据 | 命令（可复现） | 读数 | 结论 |
|---|---|---|---|---|
| ① | `tsc` = 0 | `cd backend-ts && npx tsc --noEmit`（**直接取退出码，无管道**） | tool `exit_code = 0`，stdout 空 | ✅ |
| ② | 本地重启后 `/health` `/api/health` `/api/home` 全 200 | 面板重启后 `curl -s -o <file> -w '%{http_code}' http://127.0.0.1:5788<path>` | `/health`=**200**、`/api/health`=**200**、`/api/home`=**200**（body 全文存档） | ✅ |
| ②′ | 重启只走面板 `{sid}` | `POST http://127.0.0.1:5555/api/restart -d '{"sid":"seafood-api"}'` | `{"sid":"seafood-api","ok":true,"state":"running","pid":28931,"msg":"已启动"}`；监听者 `node 28945 TCP *:5788 (LISTEN)` | ✅ 未 `pkill`/`killall` |
| ③ | `Δledger_entry` = 0 | `npx ts-node scripts/p4z-p6vs-ledger-count.ts before\|after`（**只读 `count(*)`**） | before `{"ledger_entry":"267"}` → after `{"ledger_entry":"267"}` ⇒ **Δ = 0**；`ledger_tx` 表不存在 ⇒ 探针回 `ERR:relation "ledger_tx" does not exist`（不静默填 0） | ✅ |
| ④ | 注册点现取 | `grep -c '^app\.\(get\|post\|patch\|delete\|put\)(' src/index.ts` | 改前 **65** → 改后 **66**（净 +1 = 新增的 `/api/health`；`grep -c "sendHealthReport"` = 2 个注册点共用同一 handler） | ✅ 与预期 66 一致 |
| ⑤ | 未碰禁写清单 | `git status --porcelain` | 仅 `M backend-ts/src/env.ts` / `M backend-ts/src/index.ts` / `M vercel.json`；未碰 `.env.local`、`migrations/**`、`frontend/**`、任何 spec、`docs/seafood.master-plan.md`、既有 audit/qa 件 | ✅ |
| ⑥ | 本地零变化 | 见 §3.1 | 逐键摘要**完全相同** | ✅ |

### 3.1 「本地零变化」的证据（改前/改后 **同一命令** 读数对比）

同一条命令跑两次，被测模块分别指向「改前模块」与「改后模块」：
`npx ts-node scripts/p4z-p6vs-env-probe.ts head|cur <label>`（`head` = `git show HEAD:backend-ts/src/env.ts` 的逐字副本，sha256 `9468194c…7764`）

| 键 | 改前(HEAD) 值摘要 | 改后(现文件) 值摘要 |
|---|---|---|
| `DATABASE_URL` | `7e2652d3d90c` | `7e2652d3d90c` |
| `DATABASE_URL_UNPOOLED` | `3e493a432bb0` | `3e493a432bb0` |
| `POSTGRES_URL` | `7e2652d3d90c` | `7e2652d3d90c` |
| `POSTGRES_URL_NON_POOLING` | `3e493a432bb0` | `3e493a432bb0` |
| `SECRET_KEY` | `b1ec01afb2eb` | `b1ec01afb2eb` |
| `SF_*` ×4 | `null` | `null` |
| `overwrote_existing` | `[]` | `[]` |
| `canonical_filled_from_prefixed` | `[]` | `[]` |
| `env_repo_root` | `/Users/kevin/bistro/seafood/backend-ts` | 同值 |

（值摘要 = 明文 sha256 前 12 位；**明文与密钥一律不落盘**。）
⇒ 本地：规范名由 `.env.local` 提供、`SF_*` 不存在 ⇒ 回退**一次都没触发**，`process.env` 逐键不变。

**阳性对照（回退真会触发，证明探针不是恒假）**：把 `src/env.ts` 逐字拷到**没有 `.env.local` 的 repoRoot**（`…/cache/scratch/p6vs-ctl/repo/sub/env.ts`，`env_repo_root = …/p6vs-ctl/repo`），进程启动时 `-u DATABASE_URL …` 清空 4 个规范名、注入 4 个哨兵 `SF_*`：
`canonical_filled_from_prefixed = [4 对全部]`、`canonical_equals_prefixed_after = [4 键全部]`、`overwrote_existing = []`。

## §4 `vercel.json` 区域配置的形状裁定

**裁定：用**仓库根的**顶层 `"regions": ["sin1"]`**；**不用** `builds[].config.regions`（也不叠加 `functions.*.regions`）。

现取依据（官方 schema <https://openapi.vercel.sh/vercel.json>，HTTP 200 / 453,658 bytes，本机副本 `…/cache/scratch/vercel.schema.json`）：

- `/properties/regions` 的**原文描述** = *"An array of the regions the deployment's Serverless Functions should be deployed to"* ⇒ 这是**部署级函数区域**的官方开关，与 `builds` / `functions` 概不冲突。
- `/properties/builds` 被标 **`"deprecated": true`**；`builds[].config` 的原文描述 = *"arbitrary metadata to be passed to the Builder"*（`type: object`，无 `properties` 约束）⇒ **schema 里根本没有 `builds[].config.regions` 这条路径**：写在那里最多是"传给 Builder 的任意元数据"，**不是**任何文档化的区域开关。
- `regions` 在 schema 里的**唯一另外一处**出现是 `/properties/functions/patternProperties/^.{1,256}$/properties/regions`（按函数 glob 定制）。本仓只有一个函数（`backend-ts/src/index.ts`，`builds` 提供），顶层 `regions` 已覆盖它；**刻意不加** `functions` 项，以免与旧式 `builds` 的 src 解析规则产生第二处口径。

**诚实边界**：本单元**禁止任何 `vercel` 部署** ⇒ 「改动后线上函数真的落在 `sin1`」**无法实测**（见 §7）。配置形状层面的证据 = 上述官方 schema + 部署前/后的键集自证；**线上生效**需一次重新部署（区域属构建期属性，旧部署不会因配置文件变更而迁移）。

**若线上仍落 `iad1` 时的手动面板步骤（退路，须由有部署权的人执行）**：
1. 打开 <https://vercel.com/alwaysfit/seafood/settings/functions>；
2. `Function Region` 选 **Singapore (sin1)** → **Save**；
3. **Redeploy** 最近的 production 部署（Deployments → 最新 → ⋯ → Redeploy，取消 "Use existing Build Cache" 更稳）；
4. 部署完成后现取复核：`vercel inspect https://seafood-opal.vercel.app`，Builds 行应显示 `[sin1]`（现读数 = `[iad1]`，见 §1.6）。
   注：控制台里同时存在的 `SF_*`（Neon 集成生成）**不要**改；区域与 env 是两件事。

## §5 探针自曝（本单探针可能怎么骗我）

1. **首轮探针字段名误导（已修）**：第一版把「启动时缺失 → 加载后已设」命名为 `fallback_fired`，于是**改前模块**也报 4 对"触发"——那其实是 **dotenv 从 `.env.local` 加载**的贡献，与回退映射无关。已把口径拆成 `canonical_filled_from_prefixed`（真回退：`before[prefixed]` 存在且 `after[canonical] === before[prefixed]`）与 `absent_at_start_filled_after`（dotenv + 回退的合计）。**首轮误读留档在 `env-before-head.json` 的旧版本里已覆盖**（该文件现为修口径后的读数）。
2. **端点 200 ≠ 业务正确**：`curl -w '%{http_code}'` 只证状态码；三个端点的 **body 全文**已存 `.body` 文件（`/health` 见 `db_version` 实串、`/api/home` 见 `{"success":true,…,"tasks":[{"tID":2,…`）。
3. **本地面不覆盖 Vercel 转发形态**：本机 5788 **没有** `/api/(.*)` 重写。`/api/health` = 200 只证明「应用注册了这条路径」，**不**证明「Vercel 转发后函数收到同一条路径并返回 200」——后者需部署才能测（§7）。
4. **账本探针走被测同一入口**（`../src/env`）：若 env 面坏，探针以 `NO_URL` / `PROBE_FAIL` **显式失败**，不会静默回 0；`ledger_tx` 不存在时输出 `ERR:…` 而非 `0`。
5. **`tsc` 作用域**：`npx tsc --noEmit` 按 `backend-ts/tsconfig.json` 运行（exit 0）；本单三件交付中改动的两个 `.ts` 均在 `src/`（必在作用域内），新增 `scripts/p4z-p6vs-*.ts` 是否被 `include` 覆盖**未逐字核** ⇒ 计入 §7。
6. 退出码纪律：所有涉及判定退出码的命令均为 `out=$(cmd); rc=$?; …` 形式（**不取管道后的 `$?`**）；本机无 `timeout` ⇒ 未使用它。

## §6 边界自证

- **只写了允许面**：`backend-ts/src/env.ts`、`backend-ts/src/index.ts`、`vercel.json`、报告 `docs/audit/p6-vercel-shape.md`、产物 `backend-ts/.p4-artifacts/p6vs-20261001-075853/**`、脚本 `backend-ts/scripts/p4z-p6vs-{env-probe,env-head-baseline,ledger-count}.ts`。禁用面**逐条未碰**：`.env.local`、`migrations/**`、`src/ledger.ts`、`src/ledger-errors.ts`、`src/commission.ts`、`src/currency-service.ts`、`frontend/**`、任何 spec、`docs/seafood.master-plan.md`、既有 audit/qa 件。
- `git status --porcelain` 里出现一条**非本单产物**：`?? .vercelignore`（mtime 2026-10-01 07:58，文件内署名 "Zang 2026-09-30"）——本单**未创建/未修改**它，登记为**并发写者**痕迹。
- **未执行**：`git add/commit/push`、任何 `vercel deploy` / `vercel env add|rm` / `vercel pull`（只用了只读的 `vercel inspect` 与 `vercel env ls`）、删除型 SQL、新 kind/新码、`npm install`、`execute_code`、常驻 server、`pkill`/`killall`。
- 探针脚本对 DB **只发 `SELECT count(*)`**（无事务、无锁、无写）。
- 产物中不含任何连接串 / token / 密钥明文（env 探针只出 sha256 前 12 位）。
- 时间口径：机内读数 UTC（`at` 字段，例 `2026-09-30T23:59:16Z`）；报告叙述用 CST（UTC+8）。**注**：同批读数里 `date` 与探针 `new Date()` 差 8 小时（机器时区设置），只影响显示，不影响计数。

## §7 `NOT_MEASURED` 登记（禁填 0/空）

1. **线上部署后：`/api/health` 是否 = 200、`/api/home` 是否 = 200** —— 禁部署 ⇒ 未测。（本地等价面已 200，但转发形态未被覆盖，见 §5.3）
2. **线上函数改动后的实际区域** —— 禁部署 ⇒ 未测（现读数只有改前基线 `[iad1]`）。需 §4 的手动/redeploy 步骤后复取。
3. **`regions` 在旧式 `builds` 布局下的运行时生效性** —— 只能以官方 schema（§4）作配置形状证据；运行时生效性未测（同上）。
4. **`npx tsc --noEmit` 是否覆盖 `backend-ts/scripts/**`** —— 未逐字核 `tsconfig.json` 的 `include`；对三件交付无影响（改动均在 `src/`）。
5. **`.env.local` 未被写的机器证据** —— 未取改前/改后 mtime 对比；仅有"本单未发出任何写该文件的命令"这一过程性证据。
6. **`vercel env ls` 的 20 行为完整列表** —— 依据是 CLI 表格输出完整结束（未触 `head -30` 的 30 行上限、末尾即 "Common next commands"）；未再用 `--json` 复核行数。

