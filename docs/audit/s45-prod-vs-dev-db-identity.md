# S45 · 生产库 vs 本地 dev 库「是否同一个库」只读判定（Kong）

- 轮次：`S45`（路线图 `R2` 只读前置 —— 决定 `B21` 取号源修法能否与生产同批）
- 执行：Kong（只读）
- runid：`s45-20261007T001923Z`
- 产物目录：`backend-ts/.s45-artifacts/s45-20261007T001923Z/`（`.gitignore` 规则 `**/.*-artifacts/`，不入 git）
- 硬口径：**全程只读**；对 prod 只发 `GET`；对本地库只发 `SELECT`/系统目录查询（禁 `INSERT/UPDATE/DELETE/setval/nextval`）；连库**仅进程内 dotenv**；不起实例、不碰 `5787/5788/5555/5191`；不 commit/push；不改任何既有文件。

---

## §0 对锚

**开工时现取**（本单起点，08:19Z 前后）：
```
$ cd /Users/kevin/bistro/seafood && git log --oneline -3
fa9d8ac docs: §5.370/v0.370 —— 后续路线图 R1–R6（现取定稿）：…（含「生产是否同库」只读前置）+ R3 … + R4 … + R5 … + R6 …
482059f chore: S42 证据链产物加 .gitignore … + S43 dev 库 users 只读取证 … + ★新登记 B21（真根因=MAX+1 取号被夹具抬到 971213 …）+ §5.369
0a2b886 docs: §5.368/v0.368 —— Kevin 批准两件收尾 ⇒ 派 S42 … ∥ S43 …

$ git status --porcelain
(空)
```
- 锚点命中：开工 `HEAD` = `fa9d8ac`（任务书要求）✔；开局工作树干净 ✔；分支 `main`。

**收工前复核（会话期间 HEAD 被并发推进）**：
```
$ git log --oneline -4
9768381 docs: §5.371/v0.371 + 台账新增 E 段「后续路线图」—— 按路线图开工：派 S44（…）∥ S45（R2 前置·只读判定生产与 dev 是否同库 …）   ← 新 HEAD
fa9d8ac …（本单锚点）
482059f …
0a2b886 …

$ git merge-base --is-ancestor fa9d8ac HEAD  →  fa9d8ac IS ancestor of HEAD ✔

$ git status --porcelain
 M frontend/src/test/components/Card.test.jsx                 ← S44 并发所致（mtime 08:21:45Z），非本单
 M frontend/src/test/performance/VirtualList.test.jsx         ← S44 并发所致（mtime 08:21:34Z），非本单
?? frontend/src/test/components/zz-s44-probe.test.jsx         ← S44 并发所致（mtime 08:20:58Z），非本单
?? docs/audit/s45-prod-vs-dev-db-identity.md                  ← 本单唯一新增
```
- 锚点仍有效：`fa9d8ac` 是现 `HEAD` 的**祖先** ✔。
- **本单零 tracked 改动**：`M` 的两个测试文件与 `??zz-s44-probe.test.jsx` 均为**并发 S44**（同仓另一会话）所写，mtime 落在我作业时段内但**从未被本单触碰**（我从头到尾只读 `src/`、`vercel.json`、`package.json` 等，未编辑、未写入 frontend）；本单唯一新增 = 报告 `docs/audit/s45-prod-vs-dev-db-identity.md`（`??` 未跟踪）+ 被忽略的产物目录。

---

## §1 部署管线现取 + 「是否自动迁移」结论

### 1.1 现取命令与读数（逐字见 `pipeline-evidence.txt`）

| # | 现取对象 | 命令 | 读数 |
|---|---|---|---|
| 1 | 根 `vercel.json` 顶层键 | `python3 -c "import json;print(list(json.load(open('vercel.json')).keys()))"` | `['version','regions','builds','routes','crons']`（**无 `buildCommand`**） |
| 2 | `backend-ts/vercel.json` 顶层键 | 同上 | `['version','builds','routes']`（**无 `buildCommand`**） |
| 3 | `backend-ts/package.json` scripts | — | `{build:'tsc', start:'node dist/index.js', dev:'ts-node src/index.ts', clean:'rm -rf dist'}`（**无 migrate/postinstall/prebuild**） |
| 4 | `frontend/package.json` scripts | — | `build:'vite build'`；`deploy*:'./scripts/deploy.sh …'`（**无 migrate**） |
| 5 | 全仓 `buildCommand|postinstall|prebuild|"migrate"` | `grep -rn --include='*.json' --include='*.yml' --include='*.yaml' --include='*.toml' …` | **零命中** |
| 6 | `src/` 是否 import/调用 `migrate`（冷启动自动迁移） | `grep -rn -E "import.*migrate|ensureSchema|runMigrations|applyMigration" backend-ts/src` | **零命中** |
| 7 | CI 文件 | `find … .github / .gitlab-ci.yml` | 仅 `frontend/.github/workflows/deploy.yml`（跑 lint / type-check / vitest / playwright / `vite build` + `amondnet/vercel-action`，**无 migrate**）；根无 `.github` |
| 8 | `frontend/scripts/deploy.sh` 是否跑迁移 | `grep -rn -i "migrate|psql|ts-node" frontend/scripts/` | **零命中** |

`backend-ts/scripts/migrate.ts` 的**全部调用点**（`grep -rn 'migrate'`）：仅出现在 `backend-ts/scripts/*.ts` 的**注释与手工脚本**里（如 `p1e-03-apply-0004-raw.ts:5`「定稿后必须再跑一次 `npx ts-node … scripts/migrate.ts`」、`p2w-02`、`p3l-*` 等）—— 均为**人工手动**执行的运维脚本，**不被任何 build/CI/deploy 链路调用**。

### 1.2 结论：部署**不会**自动 apply 迁移（依据见上表 1–8）

- `vercel.json`（根与 `backend-ts`）只声明 `builds`（`@vercel/static-build` + `@vercel/node`）与 `routes`，**没有 `buildCommand` 覆写**；Vercel 对 `@vercel/node` 的默认构建步骤为依赖安装 + 编译**入口文件**，不含本项目自定义迁移。
- 两个 `package.json` **无** `migrate` / `postinstall` / `prebuild`，`build` 目标分别为 `tsc` / `vite build`。
- 唯一 CI（`frontend/.github/workflows/deploy.yml`）只跑前端测试与构建后交由 `vercel-action` 部署，**无任何迁移步骤**。
- 业务运行时（`src/`）**零**迁移调用 ⇒ 冷启动/请求期**不自迁移**；对 `schema_migration` 的唯一引用是 `/api/health` 的**只读 SELECT**（`db.ts:250-255`）。
- ⇒ **推论（对本次判定关键）**：若某库 `schema_migration` 的最新版本为 `0043`，这只能来自**外部显式 apply**（人工运行 `scripts/migrate.ts` / 手工灌入），**不可能**由部署管线自动产生。因此「prod 与本地 `schema_version` 同为 `0043`」**构成本次同一性判据的有效证据**，而非「部署自动迁移造成的假象」。

> 反证风险处置：任务书所列「部署管线会自动跑迁移 ⇒ schema_version 同不构成同库证据」这一假设，经上表**逐条现取被否**；即该反证**不成立**。

---

## §2 可选公开只读端点清单与选择理由

`backend-ts/src/index.ts` 中**无需凭证的 `GET`** 端点（现取，按对本次判定价值排序）：

| 端点 | 行 | 读哪张表 / 数据源 | 无凭证 | 对「区分两库」的价值 |
|---|---|---|---|---|
| **`GET /api/health`** | `:439-440` | `SELECT version()`（`db.ts:245`）+ `SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1`（`db.ts:250`） | ✔ | 服务器版本 + 迁移版本；区分「不同 schema/不同实例」 |
| **`GET /api/task/all`** | `:549` | `DatabaseService.listTasks` ⇒ `FROM job AS t ORDER BY t.job_id LIMIT 100`（+ `job_submission` 计数）`database.ts:2542` | ✔ | **具体行**：`job` 全表逐行（标题/奖励/人数/时间戳） |
| **`GET /api/prize/all`** | `:535` | `listPrizes ⇒ listBrands` ⇒ `FROM listing AS l ORDER BY l.listing_id LIMIT 100` `database.ts:2444/4191` | ✔ | **具体行**：`listing` 全表逐行 |
| `GET /api/task/:tID` | `:563` | `getTask(tID)` ⇒ `FROM job WHERE job_id=$1` `database.ts:2574` | ✔ | 单行点查（作第 4 见证） |
| `GET /api/prize/:bID` | `:592` | `getPrizeById` ⇒ `getBrandById` `database.ts:4161` | ✔ | 单行点查 |
| `GET /api/user/all` | `:1938` | `getAllUsers` | ✖（`requireAdmin`） | 排除（需 admin 令牌） |
| `GET /api/user/stats` | `:1956` | `getUserStats` | ✖（`requireAdmin`） | 排除 |
| `GET /api/tasklist/pending-verification*` | `:1972/:1989` | `listPendingVerification` | ✖（需登录/admin） | 排除 |

**选定 3 个端点（+1 个单行见证）**：
1. `GET /api/health` —— 读 `schema_migration`（迁移版本）。
2. `GET /api/task/all` —— 读 `job` 全表（45 行，含 dev 夹具）。
3. `GET /api/prize/all` —— 读 `listing` 全表（24 行）。
4. （见证）`GET /api/task/2`、`GET /api/task/253`、`GET /api/task/999999`。

**为什么能区分两个库**：`/api/task/all` 与 `/api/prize/all` 逐行吐出**库内真实行内容**（含 `create_key` 生成的 dev 夹具标题、到秒的创建/更新时间戳、`headcount`、`reward/price`）。若两侧是**两张不同的库**，除非被逐行逐字段复制（含墙钟时间戳），否则不可能 45×6 + 24×4 个字段全部相等。默认分页 `limit=100`（`index.ts:190-193`），而 `job`=45 行、`listing`=24 行均 <100 ⇒ **实际取到全表**，非抽样。

---

## §3 两侧读数与逐字段对拍

### 3.1 本地 dev 库连接目标（进程内 dotenv，非 shell source）
```
ENV_LOCAL = /Users/kevin/bistro/seafood/backend-ts/.env.local      # dotenv.config({path}) 进程内加载
resolved  = DATABASE_URL（resolveReadUrl 口径，db.ts:44-50）
host      = ep-holy-forest-b3fi7u3u-pooler.c-4.ap-southeast-1.aws.neon.tech
db        = neondb      user = neondb_owner      password = ***MASKED***（绝不打印）
```
> 敏感字段口径：仅打印 host/db/user（均非凭据本体）；**密码与完整连接串从未落盘/落屏**。host 是否算敏感由上级判断——此处按任务书「host 可打印」处理并**显式说明**。

### 3.2 prod 端点读数（`GET` only；DNS 被本机改写为保留段 `198.18.16.129` ⇒ 按任务书 `--resolve …:443:76.76.21.21`）
```
$ curl -sS --resolve ssseafood.vercel.app:443:76.76.21.21 https://ssseafood.vercel.app/api/health
{"ok":true,"db_version":"PostgreSQL 18.6 (c021049) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit",
 "schema_version":"0043","time":"2026-10-07T00:20:12.314Z"}        [HTTP 200]

$ curl … /api/task/all   → 45 行   [HTTP 200, 20895 B]
$ curl … /api/prize/all  → 24 行   [HTTP 200, 25471 B]
```

### 3.3 逐字段对拍（脚本 `compare.py`；结果 `compare-result.json`）

#### A. `/api/health`（对 `schema_migration` + `version()`）
| 字段 | prod | 本地 dev 库 | 判定 |
|---|---|---|---|
| `db_version` | `PostgreSQL 18.6 (c021049) … aarch64-unknown-linux-gnu …` | `PostgreSQL 18.6 (c021049) … aarch64-unknown-linux-gnu …`（逐字同串） | **相同** |
| `schema_version` | `0043` | `0043` | **相同** |
| `schema_migration` 行数 | —（端点不吐） | `42` | 参考 |

#### B. `GET /api/task/all` ↔ 本地 `SELECT * FROM job ORDER BY job_id LIMIT 100`
| 项 | prod | 本地 dev 库 | 判定 |
|---|---|---|---|
| 行数 | `45` | `45` | **相同** |
| `tID` 序列（升序） | `[2,3,4,5,8,9,10,11,12,13,14,15,16,17,18,19,20,22,23,24,136,214,215,216,217,218,230,232,236,237,238,239,240,241,242,243,245,246,247,248,249,250,251,252,253]` | 同左，**逐元素相等** | **相同** |
| 逐行字段 `points↔reward` / `title↔title` / `note↔description` / `headcount↔headcount` / `time_created↔time_created` / `time_updated↔time_updated` | 45 行 | 45 行 | **失配 0** |
| 行样例 `tID=2` | `points=137, title="p4b2:fixture:A", headcount=1, time_created=1790683967, time_updated=1791075784` | `reward=137, title="p4b2:fixture:A", headcount=1, time_created=2026-09-29T12:12:47.578Z, time_updated=2026-10-04T01:03:04.090Z`（秒级一致） | **相同** |

#### C. `GET /api/prize/all` ↔ 本地 `SELECT * FROM listing ORDER BY listing_id LIMIT 100`
| 项 | prod | 本地 dev 库 | 判定 |
|---|---|---|---|
| 行数 | `24` | `24` | **相同** |
| `bID` 序列 | `[1..24]` | `[1..24]` | **相同** |
| 逐行字段 `points↔price` / `name↔title` / `description↔description` / `time_created↔time_created` | 24 行 | 24 行 | **失配 0** |
| 行样例 `bID=1` | `points=137, name="p4b2c:listing A", description="p4b2c desc", time_created=1790690723` | `price=137, title="p4b2c:listing A", description="p4b2c desc", time_created=2026-09-29T14:05:23.401Z` | **相同** |

#### D. 单行见证 `GET /api/task/:tID`
| 端点 | prod 读数 | 本地 dev 库对应行 | 判定 |
|---|---|---|---|
| `/api/task/2` | `tID=2, title="p4b2:fixture:A", points=137` | `job_id=2, create_key="cli:p4b2:job:A"`（dev 夹具） | **相同** |
| `/api/task/253` | `tID=253, title="p3j-settle-noref", points=100, time_created=1791078408` | `job_id=253, reward=100, time_created=2026-10-04T01:46:48.076Z, create_key="cli:p3j-S17BHEAD20261004T094635-p3j-settle-n"` | **相同** |
| `/api/task/999999` | `404 LEDGER_REF_NOT_FOUND` | 本地无此行 | **一致** |

> **关键观察**：prod 端点正返回**本地 dev 夹具行**（`title` 含 `p4b2:fixture`、`p3j-settle-noref`，`create_key`=`cli:p4b2:job:A` / `cli:p4b2c:listing:L1` / `cli:p3j-…`）——即 dev 专属、仅存在于本地 dev 库的夹具，在 prod 上**逐字可见**。

---

## §4 三态结论与证据链

## 结论：**同库**（生产 `ssseafood.vercel.app` 与本地 dev 库指向**同一个 Neon 库**：`neondb @ ep-holy-forest-b3fi7u3u`）

**证据链（逐条，均可复现）**
1. **排除「部署自动迁移」这一唯一反证**（§1）：`vercel.json` 无 `buildCommand`；两 `package.json` 无 `migrate/postinstall/prebuild`；唯一 CI 无迁移；`src/` 零迁移调用 ⇒ `schema_version` 相同**是同库的有效证据**。
2. **库标识相同**（§3.3-A）：`schema_version` `0043`=`0043`；`db_version` 逐字同串（Neon PG 18.6）。
3. **具体行相同**（§3.3-B/C）：`job` 45 行、`listing` 24 行，**tID/bID 序列逐元素相等**，且 `points/title/note/headcount/time_created/time_updated`（task）与 `points/name/description/time_created`（prize）**逐字段失配 0**。
4. **dev 夹具在 prod 可见**（§3.3-D）：prod 返回含 `create_key` 为 `cli:…` 的 **dev 夹具行**（`p4b2:fixture:A` 等）——这些行只由本地夹具脚本写入本地 dev 库；它们在 prod 逐字出现 ⇒ 两侧读同一批物理行。
5. **单行点查一致**（§3.3-D）：`/api/task/2`、`/api/task/253` 命中且字段同；`/api/task/999999` 两侧皆无 ⇒ 命中/落空边界一致。

**反证概率评估**：若 prod 与本地是**两张不同库**，要解释上述需同时满足：45×6 + 24×4 ≈ 366 个字段（含**到秒的墙钟时间戳**、`create_key` 派生的夹具标题、`headcount`、`reward/price`）逐字相等，且 `db_version` 与 `schema_version` 同 ⇒ 概率实质为 0。故判 **同库**，非「证据不足」。

---

## §5 若「证据不足」的下一步方案

**本单判定为「同库」，不适用。** 备查方案（供未来若出现疑似不同库时复用）：
1. **直取 host 比对**：请 Kevin 从 Vercel 项目 `alwaysfit/seafood`（`prj_J3McAh3LzHsetTYAGzPQ7U1Qsm9b`）导出 prod 环境变量 `SF_DATABASE_URL`（或 `SF_POSTGRES_URL`）的**主机名**，与本地 `.env.local` 的 `ep-holy-forest-b3fi7u3u-…neon.tech` 对比（只比 host，不比凭据）。
2. **增补高熵只读端点**：如 `GET /api/rating/summary`、`GET /api/timeliness`、`GET /api/role-names`（本单未用），读各自表；跨端点行级一致 ⇒ 进一步加固。
3. **写入时序见证**：由 Kevin 授权后，在**本地库**做一次受控只读可见的写入（如运维夹具），观察 prod 端点是否即时反映——**本单硬口径禁写，未做**。

---

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 说明 |
|---|---|---|
| prod 实际连接串 host | `NOT_MEASURED` | 需 prod 凭据 / Vercel 导出；本单只读、未取。**行级同一性已间接证明同库** |
| Vercel 控制台「Build Command」覆写 | `NOT_MEASURED` | 需登控制台；仓内 `vercel.json` 无 `buildCommand`（已现取）。因行级证据充分，此点不影响结论 |
| prod 侧 pooler vs 直连 | `NOT_MEASURED` | 本地为 pooler 主机；prod 侧未测（端点不吐） |
| `prod /api/health` 的 `schema_migration` 行数 | `NOT_MEASURED` | 端点不吐该值（本地=42） |
| 高熵端点（rating/timeliness/role-names） | 未做 | §2 已列可选；本单取 `health/task/all/prize/all` 三点已足 |
| 本地库写入型验证 | **不做（硬口径禁写）** | 全程零写 |

---

## §7 自曝（Kong 视角）

1. `db_version`（`PostgreSQL 18.6 …`）**单独不是**判别器（同大版本 Neon 实例串相同）；本单把它与**行级对拍**并联使用，未单凭它下判。
2. 本单未直连 prod 读 `current_database()`/host ⇒ prod 的**物理连接串**是推断（由行级同一性 + 同 `schema_migration` 反推），非直接读出；已在 §6 标 `NOT_MEASURED`。若上级要求「物理 host 逐字相等」这一更强口径，需走 §5-1。
3. 本机 DNS 将 `ssseafood.vercel.app` 解析到保留段 `198.18.16.129`（疑本机 DNS 改写），直接 `curl` 会 `SSL_ERROR_SYSCALL`；已按任务书用 `--resolve …:76.76.21.21` 取数 ⇒ **路径可信，但非默认解析路径**，一并披露。
4. 对拍脚本对时间字段做了「本地 timestamptz 去毫秒 ↔ prod unix 秒」的**秒级归一**再比较（`compare.py` `iso_trim`/`ts_to_iso`）；毫秒位本地有、prod 无 ⇒ 未纳毫秒，**未掩盖差异**（若时间差 ≥1 秒会报失配）。
5. 端点响应带 `setPublicCache`（`Cache-Control`）⇒ prod 读数可能来自 CDN 缓存；因其反映的仍是库内行，且 45/24 行全量一致，不影响判定。缓存 TTL 未测。
6. 全程**零写**：探针 `probe-readonly.cjs` 的全部 SQL 实参仅 `SELECT` / `pg_sequences` / `information_schema`（见 `零写自证` grep 输出，写关键字只出现在注释）；对 prod 仅 `GET`。
7. **零 tracked 改动**：`git status --porcelain` 仅新增报告 `docs/audit/s45-prod-vs-dev-db-identity.md`（+ 未跟踪、被 `**/.*-artifacts/` 忽略的产物目录）。
8. 未 commit / 未 push / 未 `npm install` / 未起实例 / 未碰 `5787/5788/5555/5191`。

---

### 附：产物清单（`backend-ts/.s45-artifacts/s45-20261007T001923Z/`）
| 文件 | 内容 |
|---|---|
| `probe-readonly.cjs` | 严格只读本地探针（进程内 dotenv；零写自证） |
| `local-readings.json` | 本地 dev 库全部读数（health 三源 + job/listing 全行 + 序列 + 列清单） |
| `prod-health.json` / `prod-task-all.json` / `prod-prize-all.json` | prod 三端点原始响应 |
| `prod-task-2.json` / `prod-task-253.json` / `prod-task-999999.json` | prod 单行见证 |
| `compare.py` / `compare-result.json` | 逐字段对拍脚本与结论 |
| `pipeline-evidence.txt` | 部署管线现取证据（§1） |

### 复用「对拍用的端点 + 本地查询语句 + 两侧读数」（逐字备查）
```
# prod（只读 GET；本机 DNS 异常时加 --resolve …:443:76.76.21.21）
curl -sS --resolve ssseafood.vercel.app:443:76.76.21.21 https://ssseafood.vercel.app/api/health
curl -sS --resolve ssseafood.vercel.app:443:76.76.21.21 https://ssseafood.vercel.app/api/task/all
curl -sS --resolve ssseafood.vercel.app:443:76.76.21.21 https://ssseafood.vercel.app/api/prize/all
curl -sS --resolve ssseafood.vercel.app:443:76.76.21.21 https://ssseafood.vercel.app/api/task/253

# 本地 dev 库（进程内 dotenv，绝不 shell source/export .env*）——见 probe-readonly.cjs 的等价 SQL：
#   SELECT version()                                                       -- /api/health db_version
#   SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1   -- /api/health schema_version
#   SELECT * FROM job     ORDER BY job_id     LIMIT 100                    -- /api/task/all 数据源
#   SELECT * FROM listing ORDER BY listing_id LIMIT 100                    -- /api/prize/all 数据源
#   SELECT sequencename, last_value, data_type FROM pg_sequences WHERE schemaname='public'  -- 只读序列面
```
