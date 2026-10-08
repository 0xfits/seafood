# S58b · 收拢 Vercel env（删 `SF_*` 族，保留规范名族）+ 补 S58 残留③ `setval`（Kong）

> **单号**：S58b · **runid**：`s58b-20261008T111810Z` · **角色**：Kong
> **授权**：★ Kevin 原话「4、可以」⇒ **授权收拢 env**（保留规范名族 / 删 `SF_*` 族）。
> **产物目录**：`backend-ts/.s58b-artifacts/s58b-20261008T111810Z/`（`**/.*-artifacts/` 已在 `.gitignore`）。
> **硬口径（本单自证）**：写面**仅两条** —— ① Vercel env 的 `SF_*` 删除（18 键）；② 新库一条 `setval('admin_ops_audit_log_log_id_seq',9,true)`。**未写任何表行** · **未部署**（不 `vercel --prod`、不 re部署）· **未 commit / 未 push** · 未起实例 · 未碰 `5787/5788/5555/5191` · 未 `pkill -f`/`killall` · 未 `npm install` · 原始输出不用 `.log` · **不打印任何密钥值**（全文仅键名 / host sha8 / url sha8）。

---

## §0 对锚（开工现取）

| 项 | 读数 |
|---|---|
| `git log --oneline -3` | **`56bd0b7`**（HEAD，§5.397 批四条含「4、可以」）/ `edd913e`（S57b）/ `e2d7657`（S57）— **HEAD 含 `56bd0b7`，对锚成立** ✓ |
| `git status --porcelain` | `?? docs/audit/s58-kevin-backfill-executed.md`（仅此一行未跟踪；交工新增本报告前） |
| 分支 | `main` |
| 开工现时 | **2026-10-08 19:18:10 CST**（UTC `2026-10-08T11:18:10Z`） |
| Vercel 项目 | `alwaysfit/seafood` · projectId `prj_J3McAh3LzHsetTYAGzPQ7U1Qsm9b` · teamId `team_AURp3cDJIwgJT5MM4FjRb4vJ` · CLI **50.42.0** · 账号 `alwaysfit811-3806` |
| 生产库指纹 | 新库 = 生产库；`DATABASE_URL_UNPOOLED` url **sha8 `78a8fe5f`**（取自 `.env.newdb.local`；与 S58 §0 登记一致） |

**两族现状（开工 `vercel env ls` 现取）**：**规范名族**（无前缀，`1d ago` = 2026-10-07 13:00:28）与 **`SF_*` 族**（前缀，`11d ago` = 2026-09-27 10:36:25）**同名列并存**。`src/env.ts` 的 `VERCEL_PREFIX_FALLBACKS`「先到先得」⇒ **规范名优先**，`SF_*` 仅作回退。生产读路径已在**新库**（规范名指向新库）⇒ **删 `SF_*` 不改现行行为**。

---

## §1 待删清单与计数（逐键）

**取数命令**：`vercel env ls production`（另看 `vercel env ls preview`），原始输出 `env-ls-production.txt` / `env-ls-preview.txt`。**只读键名/环境/创建时间，未拉值**（value 列恒 `Encrypted`）。

**待删 `SF_*` 键 = 18 个**（逐键，均为单条记录，目标 = `[preview, production]`；`11d ago` = 2026-09-27 10:36:25 CST）：

| # | 键名 | 环境 | 创建时间（现取「11d ago」/ S55a 精确值） |
|--:|---|---|---|
| 1 | `SF_POSTGRES_HOST` | preview, production | 2026-09-27 10:36:25 |
| 2 | `SF_PGPASSWORD` | preview, production | 2026-09-27 10:36:25 |
| 3 | `SF_POSTGRES_USER` | preview, production | 2026-09-27 10:36:25 |
| 4 | `SF_PGHOST` | preview, production | 2026-09-27 10:36:25 |
| 5 | `SF_NEON_PROJECT_ID` | preview, production | 2026-09-27 10:36:25 |
| 6 | `SF_DATABASE_URL` | preview, production | 2026-09-27 10:36:25 |
| 7 | `SF_POSTGRES_DATABASE` | preview, production | 2026-09-27 10:36:25 |
| 8 | `SF_POSTGRES_PASSWORD` | preview, production | 2026-09-27 10:36:25 |
| 9 | `SF_VITE_NEON_AUTH_URL` | preview, production | 2026-09-27 10:36:25 |
| 10 | `SF_DATABASE_URL_UNPOOLED` | preview, production | 2026-09-27 10:36:25 |
| 11 | `SF_POSTGRES_URL_NON_POOLING` | preview, production | 2026-09-27 10:36:25 |
| 12 | `SF_NEON_AUTH_BASE_URL` | preview, production | 2026-09-27 10:36:25 |
| 13 | `SF_PGHOST_UNPOOLED` | preview, production | 2026-09-27 10:36:25 |
| 14 | `SF_POSTGRES_URL_NO_SSL` | preview, production | 2026-09-27 10:36:25 |
| 15 | `SF_POSTGRES_PRISMA_URL` | preview, production | 2026-09-27 10:36:25 |
| 16 | `SF_POSTGRES_URL` | preview, production | 2026-09-27 10:36:25 |
| 17 | `SF_PGUSER` | preview, production | 2026-09-27 10:36:25 |
| 18 | `SF_PGDATABASE` | preview, production | 2026-09-27 10:36:25 |

**计数**：`SF_*` 待删 = **18 键**。每键目标含 `preview` + `production`，但因是**单条多目标记录**，实测**一次 `rm <key> production` 即整条移除**（见 §3）。⇒ 计划 `rm` 次数 = 18×2 = 36，实得**有效删除 18 / `env_not_found` 18**。

**不得触碰的规范名族（点名，人工核对）**：
`DATABASE_URL` · `DATABASE_URL_UNPOOLED` · `POSTGRES_URL` · `POSTGRES_URL_NON_POOLING` · `PGHOST` · `PGUSER` · `PGDATABASE` · `PGPASSWORD` · `PGHOST_UNPOOLED` · `POSTGRES_HOST` · `POSTGRES_USER` · `POSTGRES_PASSWORD` · `POSTGRES_DATABASE` · `POSTGRES_PRISMA_URL` · `POSTGRES_URL_NO_SSL` · `NEON_PROJECT_ID` · `NEON_AUTH_BASE_URL` · `VITE_NEON_AUTH_URL` · `SECRET_KEY` · `CRON_SECRET` · `DEEPSEEK_API_KEY`。
（本单删除脚本含**硬守卫**：键名不以 `SF_` 开头即 `exit 9`，不执行。）

---

## §2 仓内消费点核查（删前必做）

**命令**：`grep -rn "SF_" --include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.json .`（排 `node_modules` / `dist` / `.next` / `.git`）。另跑 `process.env.SF` / `env.SF_` / `SF_DATABASE_URL|SF_POSTGRES_URL` 专项 grep。

**逐处清单与「删后行为」**：

| # | 位置 | 类别 | 删后行为 |
|--:|---|---|---|
| 1 | `backend-ts/src/env.ts:37-38` | **注释**（说明文档，提及 SF_ 名字） | 静态文本，与运行无关 ⇒ **无影响** |
| 2 | `backend-ts/src/env.ts:52-55`（`VERCEL_PREFIX_FALLBACKS`） | **唯一运行期映射表**（回退） | ★ 规则「先到先得」仅当**规范名缺失**且前缀名存在才赋值；生产/预览**规范名恒在**（§4 点名）⇒ 该表**根本不进入赋值分支** ⇒ **删除无害**（既不改现行行为，也不影响该表静态内容）。**预期唯一命中，成立**。 |
| 3 | `backend-ts/scripts/p4z-p6vs-env-probe.ts:3,12,22-39` | **独立开发/验证探针脚本** | 未被运行期 import（全仓 `import`/`require` 无指向它）；不在 `package.json` scripts；不在 `vercel.json` 构建路径（构建仅 `frontend/package.json` + `backend-ts/src/index.ts`）。其内 `SF_*` 为**硬编码字符串**用于探测回退是否触发；本地本就无 `SF_*`（本地期望 `fallback_fired=[]`）⇒ **删后该脚本本地读数不变** ⇒ **无害**。 |
| 4 | `backend-ts/scripts/p4z-d1p-02-negative-arm.ts:95` | **注释**（`// …含 jinli_*/SF_* 变体`）；逻辑按 `/DATABASE_URL\|POSTGRES/i` 摘除库变量 | 非 SF_ 专属消费 ⇒ **无影响** |
| 5 | `backend-ts/.s45-artifacts/…/probe-readonly.cjs` · `…/local-readings.json` | **历史产物/读数**（隐藏目录，非代码） | 非运行期消费 ⇒ **无影响** |
| 6 | `backend-ts/.p4-artifacts/p6vs-…/*.json`（3 文件） | **历史探针读数** | 非运行期消费 ⇒ **无影响** |
| 7 | `backend-ts/.s55a-artifacts/…/vercel-env-and-deploys.json` | **S55a 历史名单快照** | 非运行期消费 ⇒ **无影响** |

**结论**：仓内**无**「规范名缺失时真依赖 `SF_*`」的运行期消费点 —— 唯一运行期引用是 `src/env.ts:52-55` 的**回退表**，且该表在规范名存在时**不生效**。★ **未发现仓内别处真消费 `SF_*` ⇒ 允许执行删除**（未触发「停下报回」条件）。前端的 `SF_` 命中 = **0**。

---

## §3 逐键删除结果

**命令**：`vercel env rm <NAME> <env> --yes`，逐键逐环境，脚本 `rm-sf-envs.sh`（含 `SF_*` 硬守卫），输出落 `rm-results.txt`。

| # | 键名 | `rm ... production` | `rm ... preview` |
|--:|---|---|---|
| 1 | `SF_POSTGRES_HOST` | **rc=0 Removed** | rc=1 `env_not_found`（已随整条移除） |
| 2 | `SF_PGPASSWORD` | **rc=0 Removed** | rc=1 `env_not_found` |
| 3 | `SF_POSTGRES_USER` | **rc=0 Removed** | rc=1 `env_not_found` |
| 4 | `SF_PGHOST` | **rc=0 Removed** | rc=1 `env_not_found` |
| 5 | `SF_NEON_PROJECT_ID` | **rc=0 Removed** | rc=1 `env_not_found` |
| 6 | `SF_DATABASE_URL` | **rc=0 Removed** | rc=1 `env_not_found` |
| 7 | `SF_POSTGRES_DATABASE` | **rc=0 Removed** | rc=1 `env_not_found` |
| 8 | `SF_POSTGRES_PASSWORD` | **rc=0 Removed** | rc=1 `env_not_found` |
| 9 | `SF_VITE_NEON_AUTH_URL` | **rc=0 Removed** | rc=1 `env_not_found` |
| 10 | `SF_DATABASE_URL_UNPOOLED` | **rc=0 Removed** | rc=1 `env_not_found` |
| 11 | `SF_POSTGRES_URL_NON_POOLING` | **rc=0 Removed** | rc=1 `env_not_found` |
| 12 | `SF_NEON_AUTH_BASE_URL` | **rc=0 Removed** | rc=1 `env_not_found` |
| 13 | `SF_PGHOST_UNPOOLED` | **rc=0 Removed** | rc=1 `env_not_found` |
| 14 | `SF_POSTGRES_URL_NO_SSL` | **rc=0 Removed** | rc=1 `env_not_found` |
| 15 | `SF_POSTGRES_PRISMA_URL` | **rc=0 Removed** | rc=1 `env_not_found` |
| 16 | `SF_POSTGRES_URL` | **rc=0 Removed** | rc=1 `env_not_found` |
| 17 | `SF_PGUSER` | **rc=0 Removed** | rc=1 `env_not_found` |
| 18 | `SF_PGDATABASE` | **rc=0 Removed** | rc=1 `env_not_found` |

**汇总**：有效删除 = **18 / 18**（rc=0，逐条回显 `Removed Environment Variable`）。后一轮 `preview` 的 18 次 `env_not_found` **非失败** —— 证明每键是**单条多目标**记录，`production` 一删即整条消失 ⇒ **键的每个环境都已消失**。逐字样本：
```
rc=0 key=SF_POSTGRES_HOST env=production :: Retrieving project… Removing Removed Environment Variable [375ms]
rc=1 key=SF_POSTGRES_HOST env=preview :: Retrieving project… { "status": "error", "reason": "env_not_found", "message": "Environment Variable SF_POSTGRES_HOST was not found." }
```
★ **只删 `SF_*`**：脚本硬守卫（非 `SF_` 前缀 ⇒ `exit 9`）全程未触发；规范名族**零触碰**（§4 点名仍在佐证）。

---

## §4 删后复核

**命令**：`vercel env ls production` / `vercel env ls preview`（现取），原始输出 `env-ls-production-after.txt` / `env-ls-preview-after.txt`。

### §4.1 `SF_*` 遗留 = 0

| 视图 | `grep -c "SF_"` |
|---|--:|
| `env-ls-production-after.txt` | **0** ✓ |
| `env-ls-preview-after.txt` | **0** ✓ |

### §4.2 规范名族 + `SECRET_KEY` 逐键点名（仍在）

| 键名 | production 视图 | preview 视图 |
|---|:--:|:--:|
| `DATABASE_URL` | **在** ✓ | **在** ✓ |
| `DATABASE_URL_UNPOOLED` | **在** ✓ | **在** ✓ |
| `POSTGRES_URL` | **在** ✓ | **在** ✓ |
| `POSTGRES_URL_NON_POOLING` | **在** ✓ | **在** ✓ |
| `SECRET_KEY` | **在** ✓（Production） | **在** ✓（Preview） |
| 旁证 `CRON_SECRET` | **在** ✓ | **在** ✓ |
| 旁证 `DEEPSEEK_API_KEY` | **在** ✓ | **在** ✓ |

（另 15 个规范名 `PGHOST/PGUSER/PGDATABASE/PGPASSWORD/PGHOST_UNPOOLED/POSTGRES_HOST/USER/PASSWORD/DATABASE/PRISMA_URL/URL_NO_SSL/NEON_PROJECT_ID/NEON_AUTH_BASE_URL/VITE_NEON_AUTH_URL` 亦逐条现取仍在，见 after 列表。）**规范名族 4 键 + `SECRET_KEY` 全部点名在册。**

### §4.3 ★基线哨兵（逐字；口径：删 env 不触发部署 ⇒ 读数 = 「旧部署 + 旧 env 集合」，登记为基线）

**哨兵 1**：`curl -s -m 30 -w "\n[HTTP %{http_code} | %{time_total}s]\n" https://ssseafood.vercel.app/api/user/asset/100`
```
{"success":true,"message":"OK","data":{"index_id":0,"uID":100,"points":4292,"lucks":0,"time_update":1791075784}}
[HTTP 200 | 0.681672s]
```
⇒ **`points=4292`** ✓（与 S58 §5 逐字一致）。

**哨兵 2**：`curl -s -m 30 -w "\n[HTTP %{http_code} | %{time_total}s]\n" https://ssseafood.vercel.app/api/task/all`
```
{"success":true,"message":"OK","data":[{"tID":136,…},{"tID":230,…},{"tID":232,…}]}
[HTTP 200 | 0.577616s]
```
⇒ **恰 3 行 = tID `136`/`230`/`232`** ✓（承 S58 §5/§8-10 口径订正：基线 = 3 行，**非** 0 行）。

---

## §5 ★补 S58 残留③ —— `setval('admin_ops_audit_log_log_id_seq', 9, true)`

**性质**：本任务书**明确授权的新增写**（S58 §8-3 登记的残留）。**除这一条 `setval` 外，本单未写任何行。**

**库指针**：新库 = 生产库；脚本 `setval-residual3.py`，连 `.env.newdb.local` 的 `DATABASE_URL_UNPOOLED`（url sha8 **`78a8fe5f`**，与 §0 一致 ⇒ 确认命中新库）。产物 `setval-residual3.json`。

| 读数 | 值 |
|---|---|
| `admin_ops_audit_log` 现况（只读上下文） | `max(log_id)=9 · count=1`（与 S58 §4「仅 log_id=9」吻合） |
| **`setval` 前** | `last_value=1 · is_called=false` ★（与 S58 §8-3「实为 `last_value=1, is_called=false`」实测一致；下一 `nextval` 会得 `1`） |
| **`setval` 语句** | `SELECT setval('admin_ops_audit_log_log_id_seq', 9, true)` → **返回 `9`** |
| **`setval` 后** | `last_value=9 · is_called=true` ⇒ **下一 `nextval` = `10`** |

**判据**：现序列推进到 9 且 `is_called=true` ⇒ 未来自动审计写入从 **10** 起，**正好避开**已存在的 `log_id=9`（S58 显式写入行）⇒ **S58 残留③「第 9 次自动审计写入撞唯一键」已消除**。

---

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因 |
|---|---|---|
| 部署 / re部署 / `vercel --prod` | **未做** | 硬口径；删 env 不触发部署（现行生产部署未变） |
| commit / push | **未做** | 硬口径 |
| 旧库任何接触 | **未做** | 本单不涉旧库 |
| Vercel env **值拉取** | **未做** | 硬口径：只读键名（value 恒 `Encrypted`） |
| 建**新部署**验证「删 SF_ 后新部署仍读新库」 | **`NOT_MEASURED`（且未做）** | 硬口径禁部署 ⇒ 只能以「现行部署 + 静态推理（规范名优先）」作证；须由放行部署的单复核 |
| `SF_*` 删除对**已存在 preview 部署**的运行时影响 | **`NOT_MEASURED`** | 无 preview 部署重跑；且规范名优先 ⇒ 预期无影响（未实测） |
| Vercel 项目 env 总量（含 development 目标） | **`NOT_MEASURED`** | 本单只核对 `production`/`preview` 两视图；未单列 `development` |
| `admin_ops_audit_log_log_id_seq` 在**其他分支/库**的取值 | **`NOT_MEASURED`** | 只连新库（生产库）单点 |

---

## §7 自曝

1. **★ 关键事实口径**：本单哨兵是「**旧部署 + 旧 env 集合**」下的读数（删 env **不触发部署**）⇒ 它证明的是「现行生产未变、`SF_*` 删除**未扰当前读路径**」，**不**等价于「新部署已用新 env 集合」——后者须放行部署的单复核（§6 已登记 `NOT_MEASURED`）。
2. **「逐键每环境都删」的实现差异（如实登记）**：任务书设「每键每环境都删」= 36 次；实测每键是**单条多目标（preview+production）记录**，`rm` 一次 `production` 即整条消失 ⇒ **有效删除 18 次 + 18 次 `env_not_found`**。键的**两个目标都已消失**（§4.1 `SF_` 遗留 = 0 佐证），**未漏删**；差异仅来自 Vercel 的记录粒度，**非笔误**。
3. **删除脚本含硬守卫**：键名不以 `SF_` 开头即 `exit 9` 中止 ⇒ 结构性防止误删规范名族；全程未触发。规范名族删后逐键点名仍在（§4.2）为止证。
4. **`setval` 是唯一新增写**：本单写面 = 「Vercel `SF_*` 删除」+「新库一条 `setval`」。**唯一 SQL 写为 `setval`**，**零表行写**（上下文 `SELECT` 只读）。已明确**标注为新增写**（承 Kevin 授权 / S58 §8-3 建议）。
5. **`setval` 非事务性但此次无碍**：本单 autocommit 单条 `setval`，无回滚需求；读数「前 1/false → 后 9/true」为**前后两读**（非事务内），精确。
6. **仓内消费点结论**：唯一运行期引用（`src/env.ts:52-55` 回退表）在规范名存在时**不生效**；余为注释/独立探针/历史产物 ⇒ **未发现真消费 ⇒ 允许删**（未触发「停下报回」）。
7. **零表行写 / 未部署 / 未 push**：仓内落盘仅**新增本报告**（`.s58b-artifacts/` 已在 `.gitignore`）；**未 commit / 未 push**（完整 `git status` 见 §7-9）。
8. **脱敏**：全文无密钥值 / 无连接串 / 无完整 evm；仅键名与 url **sha8 `78a8fe5f`**（§0/S58 一致，作命中新库佐证）。
9. **多 agent 并发**：开工对锚 HEAD = **`56bd0b7`**（含 `56bd0b7`，成立）；作业期 HEAD **未再前移**（交工仍 `56bd0b7`）。★ 交工 `git status --porcelain` = `M docs/seafood.master-plan.md`（**非本单所改，系并发他 agent**）+ `?? docs/audit/s58-kevin-backfill-executed.md`（S58 报告）+ `?? docs/audit/s58b-env-collapse.md`（**本报告**）。**本单未 commit / 未 push**；本单仓内落盘仅**新增 1 个报告**（`.s58b-artifacts/` 已在 `.gitignore`）。

---

### 产物清单（`backend-ts/.s58b-artifacts/s58b-20261008T111810Z/`）

| 文件 | 内容 |
|---|---|
| `.last-runid` | `s58b-20261008T111810Z` |
| `env-ls-production.txt` · `env-ls-preview.txt` · `env-ls-all.txt` | 删前名单（18 `SF_*` + 规范名族） |
| `rm-sf-envs.sh` · `rm-results.txt` | 逐键删除脚本（含守卫）+ 逐条结果（rc/回显） |
| `env-ls-production-after.txt` · `env-ls-preview-after.txt` | 删后名单（`SF_*`=0；规范名族点名在册） |
| `sentinel-asset100.txt` · `sentinel-taskall.txt` | 两条基线哨兵逐字响应 |
| `setval-residual3.py` · `setval-residual3.json` | ★残留③ `setval` 前后读数（新增写） |
