# P0 地基 · 独立质检报告（Neng）

- 被验提交：`cbb40d1`（HEAD）
- 质检人：Neng（独立第三方，未参与实现）
- 质检时间：2026-09-27（CST）
- 质检对象：`/Users/kevin/bistro/seafood`
- ⚠️ **改名注记（v0.4 追加；本报告的冻结读数一律原样保留、未改一个字符）**：本报告中出现的 `user` 表名（含冻结 JSON 读数里的表名键值、`public_base_tables` 列表中的表名）均为 **migration `0006_user_to_users.sql` 改名前**（`public.user` → `public.users`）的取证快照；**不得据此认为改名未落地**，也不得改写任何读数。
- 纪律声明：本报告所有读数均由质检方**自己重跑**得到，未采信实现方自报数据；未修改任何业务代码（仅新增 `docs/qa/**`）。
- 硬红线遵守：未使用任何按名字/模式的进程杀（无 `pkill -f`/`killall`）；未停面板托管服务；未触碰 jinli 库。

---

## 0. 环境与基线

命令：

```
cd /Users/kevin/bistro/seafood && git log --oneline -3
node -v ; npx ts-node -v
cd backend-ts && node /tmp/qa-probe/recon.js     # 质检方自写的只读侦察脚本（连本项目新库）
```

原始输出（节选）：

```
cbb40d1 P0 地基：事务化 DB 层(Pool/ws)+withTransaction、版本化可重入 migration、new ledger 表、/health、端口迁 5787/5788
998c2be R1: 账本口径裁定书(108 条)+goofish 风格 3 版视觉比选；更正 D7（上市保证金=消耗）；记录 P0 硬缺口（仓库缺 7 张核心表 DDL）
4128020 docs: 冻结 D1-D8 口径（EVM 钱包登录/Vercel+事务池/1-5% 全额返佣/P0→视觉预演）；纳入品牌 logo

node v18.19.0 ; ts-node v10.9.2 (node_modules 内，`@neondatabase/serverless@^0.6.0` + `ws`)
env keys present: DATABASE_URL,DATABASE_URL_UNPOOLED,POSTGRES_URL,POSTGRES_URL_NON_POOLING,PGDATABASE
version(): PostgreSQL 18.6 (6569466) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit
current_database() = neondb ; current_user = neondb_owner ; inet_server_port() = 5432
schema_migration: 0001 / 0002（checksum 与仓库文件 sha256 一致，见 AC3）
public base tables (6): account, currency, ledger_entry, ledger_owner, schema_migration, user
row_counts: account=4, currency=1, ledger_entry=0, ledger_owner=4, schema_migration=2, user=0
```

结论：**基线已独立取得**（`db_version`、`schema_version=0002`、6 张表、各表行数），后续所有断言以该基线为准。
说明：`account`/`currency`/`ledger_owner` 的 4/1/4 行是迁移内置种子（0001 的 `$` 货币 + uid 0/-1/-2/-3 平台账户），非质检写入。

---

### AC1 迁移脚本必须能被 git 真正跟踪

**1) 规则面**

```
cd /Users/kevin/bistro/seafood
grep -n '^\*\.sql$' .gitignore            # 根 .gitignore 的吞掉规则
cat backend-ts/.gitignore                  # 交付方声称新增的例外
```

原始输出：

```
303:*.sql```

（第 303 行位于根 `.gitignore` 的「# Database backups」段 —— 与背景描述一致。）

```
.vercel
.env*.local

# 例外：版本化迁移是源码，必须入库。
# 根 .gitignore 的 `*.sql` 属「Database backups」段（给数据库导出用的），会连迁移脚本一起吞掉，
# 导致「库里建了表、仓库里没有 SQL」——别人 clone 后无法重建 schema（已实测踩到）。
!migrations/*.sql
```

**2) 规则生效性（含已知正例控制，先把 check-ignore 的语义钉死）**

```
git check-ignore -v --no-index backend-ts/.env.local      ; git check-ignore -q --no-index backend-ts/.env.local
git check-ignore -v --no-index backend-ts/migrations/0001_ledger_core.sql ; git check-ignore -q --no-index backend-ts/migrations/0001_ledger_core.sql
git check-ignore -q   --no-index backend-ts/migrations/0003_future.sql     # 未来新增文件
git check-ignore -v --no-index backend-ts/qa_tmp.sql                        # 未被例外覆盖的对照
git check-ignore -v backend-ts/migrations/0001_ledger_core.sql              # 已跟踪文件（不带 --no-index）
```

原始输出：

```
backend-ts/.gitignore:2:.env*.local	backend-ts/.env.local
exit=0
-q exit=0                     <-- 控制组：被忽略
backend-ts/.gitignore:7:!migrations/*.sql	backend-ts/migrations/0001_ledger_core.sql
exit=0
-q exit=1                     <-- 目标文件：未被忽略（未跟踪状态下也如此）
-q exit=1                     <-- 未来文件 0003 同样未被忽略（例外规则对未来文件同样生效）
.gitignore:303:*.sql	backend-ts/qa_tmp.sql
-q exit=0                     <-- 对照：同一目录树里未被例外覆盖的 .sql 仍被吞
exit=1                        <-- 已跟踪文件默认不报 ignored（git 语义，非缺陷）
```

结论：`-q` 退出码 0=被忽略、1=未被忽略（用 `.env.local` 与 `qa_tmp.sql` 双向钉死），故 `migrations/*.sql` 在**未跟踪与未来新增**两种状态下都**不被忽略**。

**3) 已入库证据**

```
git ls-files backend-ts/migrations/ | wc -l
git ls-tree -r HEAD --name-only | grep -iE 'migrations|\.sql'
git cat-file -p HEAD:backend-ts/migrations/0001_ledger_core.sql | wc -l
git cat-file -p HEAD:backend-ts/migrations/0002_user_identity.sql | wc -l
```

原始输出：

```
       2
backend-ts/migrations/0001_ledger_core.sql
backend-ts/migrations/0002_user_identity.sql
     183
      26
```

（与 `git show --stat HEAD` 的 `+183` / `+26` 一致。）

**4) 真实对抗测试：不修改本仓库工作区的克隆验证**

```
cd /tmp && rm -rf seafood-qa-clone && git clone -q /Users/kevin/bistro/seafood /tmp/seafood-qa-clone
cd /tmp/seafood-qa-clone && git log --oneline -1 && ls -la backend-ts/migrations/
shasum -a 256 backend-ts/migrations/*.sql
shasum -a 256 /Users/kevin/bistro/seafood/backend-ts/migrations/*.sql
```

原始输出：

```
cbb40d1 P0 地基：...（同一提交）
-rw-r--r--  1 kevin  wheel  8703 Sep 27 11:57 0001_ledger_core.sql
-rw-r--r--  1 kevin  wheel  1671 Sep 27 11:57 0002_user_identity.sql
4f902d3c47508d91826925a46765ad728b1a5a9c2773d0fc1c0f2c1e8e2451a4  backend-ts/migrations/0001_ledger_core.sql
688b1935f6bc3006b545ca158ca97324256a117e4f86e69c09bda8bbb01c5990  backend-ts/migrations/0002_user_identity.sql
4f902d3c47508d91826925a46765ad728b1a5a9c2773d0fc1c0f2c1e8e2451a4  /Users/kevin/.../0001_ledger_core.sql
688b1935f6bc3006b545ca158ca97324256a117e4f86e69c09bda8bbb01c5990  /Users/kevin/.../0002_user_identity.sql
```

→ 真实 clone 中两个 SQL 文件**存在且 sha256 与工作区逐字相同**（别人 clone 后可重建 schema）。

**5) 反向控制：在一次性副本里删掉例外规则复现「吞掉」现象**

（只改 `/tmp` 抛掷副本，**未动本仓库**）

```
cd /tmp/seafood-qa-clone
git check-ignore -q --no-index backend-ts/migrations/0003_future.sql ; echo "before -q exit=$?"
cp backend-ts/.gitignore /tmp/qa-probe/gitignore.bak && sed -i '' '$d' backend-ts/.gitignore
git check-ignore -v --no-index backend-ts/migrations/0003_future.sql
git check-ignore -q --no-index backend-ts/migrations/0003_future.sql ; echo "after -q exit=$?"
cp /tmp/qa-probe/gitignore.bak backend-ts/.gitignore
git check-ignore -q --no-index backend-ts/migrations/0003_future.sql ; echo "restored -q exit=$?"
```

原始输出：

```
before -q exit=1
--- 删除第 7 行后 ---
.gitignore:303:*.sql	backend-ts/migrations/0003_future.sql
exit=0
after(无例外规则) -q exit=0 (0=被忽略 ⇒ 现象复现)
=== 还原副本 ===
restored -q exit=1
```

结论：**PASS**。修复真实有效：有例外规则 → 迁移 SQL 不被忽略且已进入 HEAD 树与真实 clone；去掉例外规则 → `*.sql` 立刻吞掉（现象可复现，说明该例外是**必需**而非冗余）。
残留风险（未计为缺陷，登记于末尾）：例外只覆盖 `backend-ts/migrations/*.sql` 这一层；若将来把 migration 放到别的目录（例如 `backend-ts/sql/` 或 `migrations/子目录/`），仍会被根 `*.sql` 吞掉。

---

### AC2 事务回滚真生效（含探针判负能力）

**质检方自写探针**（未引用交付方 `scripts/verify-db-layer.ts`，全文见 `/tmp/qa-probe/ac2.ts`）。
探针直接 import 被测实现 `backend-ts/src/db.ts` 的 `withTransaction`，另用裸 `Pool` 做判负对照；写探针行统一用 `"user"` 表 + 固定 `0xaaa…/0xbbb…/0xccc…/0xddd…` 地址，收尾 DELETE 复原。

```
cd /Users/kevin/bistro/seafood/backend-ts
npx ts-node --transpile-only --compiler-options '{"rootDir":"/","esModuleInterop":true,"module":"commonjs","moduleResolution":"node","target":"ES2020"}' /tmp/qa-probe/ac2.ts
```

原始输出（全文）：

```
tx url kind: direct(unpooled)
baseline "user" count = 0
baseline per-probe = {"A":0,"B":0,"C":0,"D":0}
T1 in-tx visible count = 1; after rollback count = 0; thrown = QA_FORCED_ROLLBACK
PASS :: T1 事务内确实写入过（证明是"写了再滚"，非"压根没写"） :: in-tx count=1
PASS :: T1 抛错被向上传播 :: thrown=QA_FORCED_ROLLBACK
PASS :: T1 回滚后该行不存在 :: after=0
PASS :: T1 总行数回到基线 :: all=0 baseline=0
T2 in-tx count via return = 1; after commit count = 1
PASS :: T2 提交后该行确实存在 :: after=1
PASS :: T2 总行数 = 基线 + 1 :: all=1
PASS :: T3 探针能检出"残留"（autocommit 裸写确实落库） :: after=1
T4 buggy path threw=QA_BUGGY_PATH_ERROR; residual count = 1
PASS :: T4 漏 ROLLBACK 的失误写法确实留下残留（证明判负能力成立） :: residual=1
PASS :: T5 回滚后新事务仍可用 :: PostgreSQL 18.6 (6569466) on aarch64-unk
cleanup deleted rows = 3; final total = 0; baseline = 0
PASS :: 收尾清理成功且回到基线行数 :: final=0 baseline=0
AC2-PROBE-RESULT: ALL-PASS
EXIT=0
```

逐项对照验收要求：

| 要求 | 实测 | 结论 |
|---|---|---|
| 事务内插一行 → 抛错回滚 → 断言行不存在、计数回基线 | T1：事务内自读 `count=1`（**证明确实写进去了**），抛 `QA_FORCED_ROLLBACK` 后外部连接读到 `0`，总行数 0=基线 | PASS |
| 对照组：同操作但提交 → 断言确实存在 | T2：提交后 `count=1`，总行数 = 基线+1 | PASS |
| 判负能力：故意不回滚的裸连接/失误写法 → 断言留下残留 | T3 autocommit 裸写残留 1；T4 等价失误写法（BEGIN→INSERT→抛错后**漏 ROLLBACK 反而 COMMIT**）残留 1 | PASS（探针能区分两种情况） |

额外读数：`tx url kind: direct(unpooled)` —— 证明 `withTransaction` 确实走 `DATABASE_URL_UNPOOLED` 直连（与 `src/db.ts:33-41` 的 R56 口径一致），而非 pooler。

结论：**PASS**。回滚是服务端真实回滚（有「写进去 → 滚掉」的双读证据），且我的探针具备判负能力（同一套计数逻辑在失误写法下会报残留，所以 T1 的 `0` 不是假阴性）。
副作用披露：探针共插入 3 行、收尾 DELETE 3 行，`"user"` 表最终行数 = 基线 0（已在输出中给出 before/after）。

---

### AC3 migration 幂等

质检方自写指纹采集脚本 `/tmp/qa-probe/fingerprint.js`（只读：`version()`、`schema_migration` 全列、`pg_class` 的 **oid/relfilenode**、索引名、触发器名、各表行数）——用 oid/relfilenode 作为「表是否被重建」的硬指纹（真被 DROP/CREATE 会换 oid）。

```
cd /Users/kevin/bistro/seafood/backend-ts
node /tmp/qa-probe/fingerprint.js /tmp/qa-probe/ac3-before.json
npx ts-node --transpile-only scripts/migrate.ts ; echo "MIGRATE_EXIT=$?"
node /tmp/qa-probe/fingerprint.js /tmp/qa-probe/ac3-after1.json
npx ts-node --transpile-only scripts/migrate.ts ; echo "MIGRATE_EXIT2=$?"
node /tmp/qa-probe/fingerprint.js /tmp/qa-probe/ac3-after2.json
diff /tmp/qa-probe/ac3-before.json /tmp/qa-probe/ac3-after1.json && echo DIFF1_EMPTY=yes
diff /tmp/qa-probe/ac3-after1.json /tmp/qa-probe/ac3-after2.json && echo DIFF2_EMPTY=yes
```

原始输出（migrate 第一次全文，第二次逐字相同）：

```
{
  "ok": true,
  "applied_now": [
    { "version": "0001", "name": "0001_ledger_core.sql", "action": "skipped", "reason": "already applied, checksum match", "applied_at": "Sun Sep 27 2026 11:48:15 GMT+0800 (China Standard Time)" },
    { "version": "0002", "name": "0002_user_identity.sql", "action": "skipped", "reason": "already applied, checksum match", "applied_at": "Sun Sep 27 2026 11:48:20 GMT+0800 (China Standard Time)" }
  ],
  "schema_version": "0002",
  "schema_migration_rows": [ { "version": "0001", ... }, { "version": "0002", ... } ],
  "public_base_tables": ["account","currency","ledger_entry","ledger_owner","schema_migration","user"],
  "public_base_table_count": 6
}
MIGRATE_EXIT=0
MIGRATE_EXIT2=0
DIFF1_EMPTY=yes
DIFF2_EMPTY=yes
```

指纹逐项（`ac3-before.json`，三份指纹 JSON **完全一致**）：

```
db_version     : PostgreSQL 18.6 (6569466) on aarch64-unknown-linux-gnu, ...
schema_version : 0002
schema_migration:
  0001  0001_ledger_core.sql   checksum=4f902d3c47508d91826925a46765ad728b1a5a9c2773d0fc1c0f2c1e8e2451a4  applied_at=2026-09-27T03:48:15.617Z
  0002  0002_user_identity.sql checksum=688b1935f6bc3006b545ca158ca97324256a117e4f86e69c09bda8bbb01c5990  applied_at=2026-09-27T03:48:20.093Z
public_tables (name/oid/relfilenode):
  account 24657/24657 ; currency 24621/24621 ; ledger_entry 24682/24682 ;
  ledger_owner 24723/24723 ; schema_migration 24604/24604 ; user 24750/24750
indexes  : 19 个（account_pk, currency_pkey, currency_symbol_uniq, idx_account_cid_balance, idx_account_frozen,
           idx_currency_owner, idx_currency_status, idx_ledger_kind_time, idx_ledger_ref, idx_ledger_uid_cid_txid,
           idx_user_evm_lower, ledger_entry_pkey, ledger_idem_uniq, ledger_owner_pkey, ledger_reversal_of_uniq,
           schema_migration_pkey, schema_migration_version_key, user_evm_uniq, user_pk）
triggers : trg_account_guard, trg_ledger_entry_append_only
row_counts: account=4, currency=1, ledger_entry=0, ledger_owner=4, schema_migration=2, user=0
```

结论：**PASS**。连跑两次 migrate 均为 `skipped / already applied, checksum match`，退出码 0，无报错；`schema_migration` 仍只有 0001/0002 两条且 checksum、`applied_at` 均未变；6 张表的 **oid/relfilenode 未变**（证明**未重建表**）；行数、索引、触发器全部不变；`public` 表数 6→6。
附：`schema_migration` 里的 checksum 与仓库 SQL 文件的实际 sha256 **逐字相同**（`4f902d…` / `688b19…`，见 AC1 第 4 步）——即校验和是文件真实哈希，漂移检测有实际意义。

---

### AC4 `GET /health` 真实 HTTP 且真查库

**1) 自己启动后端（只占 5788，精确 PID 记录）**

```
cd /Users/kevin/bistro/seafood/backend-ts
./node_modules/.bin/ts-node --transpile-only src/index.ts      # 后台
lsof -nP -iTCP:5788 -sTCP:LISTEN
ps -o pid,ppid,command -p 24283
```

原始输出：

```
COMMAND   PID  USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    24283 kevin   15u  IPv6 0xb5f83421294d2f12      0t0  TCP *:5788 (LISTEN)
  PID  PPID COMMAND
24283 45060 node ./node_modules/.bin/ts-node --transpile-only src/index.ts
```

**2) 正例：HTTP 返回 vs 我自己直连数据库的读数逐字对比**

脚本 `/tmp/qa-probe/ac4.js`（自写：node http 取 `/health`，再用**同一连接串**分别以 unpooled / pooler 直连读 `select version()` 与 `schema_migration` 的 `max(version)`）。

```
cd /Users/kevin/bistro/seafood/backend-ts && node /tmp/qa-probe/ac4.js http://127.0.0.1:5788/health ; echo "EXIT=$?"
```

原始输出：

```
HTTP status = 200
HTTP headers.cache-control = undefined
HTTP body = {"ok":true,"db_version":"PostgreSQL 18.6 (6569466) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit","schema_version":"0002","time":"2026-09-27T03:59:30.424Z"}
live db read = {
  "unpooled": { "db_version": "PostgreSQL 18.6 (6569466) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit", "schema_version": "0002" },
  "pooler":   { "db_version": "PostgreSQL 18.6 (6569466) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit", "schema_version": "0002" }
}
PASS :: HTTP 200
PASS :: body.ok === true
PASS :: body.db_version 含 "PostgreSQL 18.6"
PASS :: body.db_version 与直连 select version() 逐字一致
PASS :: body.schema_version 与直连 schema_migration max(version) 逐字一致 (0002)
AC4-POSITIVE: ALL-PASS
EXIT=0
```

**3) 反例（证明不是硬编码）：把 DB 串指向不可达主机后重启，同一端点必须判负**

```
# 先停掉正例实例（精确 PID）
kill -TERM 24283 ; sleep 2
ps -o pid,command -p 24283        # 输出只有表头 ⇒ 已退出
lsof -nP -iTCP:5788 -sTCP:LISTEN  # lsof_exit=1 ⇒ 5788 已无监听

# 用不可达 DB 串在 5788 再起一个实例（PID 25995）
cd backend-ts && env DATABASE_URL_UNPOOLED=... DATABASE_URL=... POSTGRES_URL=... POSTGRES_URL_NON_POOLING=... \
  ./node_modules/.bin/ts-node --transpile-only src/index.ts
curl -s -o /tmp/qa-probe/health-neg.txt -w 'HTTP_STATUS=%{http_code}\n' --max-time 25 http://127.0.0.1:5788/health
```

原始输出：

```
node    25995 kevin   15u  IPv6 0xbc52a0c8752344b2      0t0  TCP *:5788 (LISTEN)
HTTP_STATUS=503
{"ok":false,"db_version":"unknown","schema_version":null,"time":"2026-09-27T04:00:23.406Z"}
```

（反例用的连接串刻意写成 `postgresql://qa:qa@127.0.0.1:<不可达端口>/qa_bogus`，仅在本进程环境变量中生效，**未打印也未修改 `.env.local`**。）

**4) 收尾：按精确 PID 停掉自己启的后端，并断言端口已释放**

```
kill -TERM 25995 ; sleep 2
ps -o pid,command -p 25995         # 只有表头 ⇒ 已退出
lsof -nP -iTCP:5788 -sTCP:LISTEN   # 无输出，lsof_exit=1
```

原始输出：

```
  PID COMMAND
lsof_exit=1 (1=无监听)
```

结论：**PASS**。`/health` 返回 200，body 含真实 `db_version`（`PostgreSQL 18.6`）与 `schema_version=0002`，且与质检方直连读数（unpooled 与 pooler 两条路径）**逐字一致**；反例中 DB 不可达时立即返回 503 / `db_version:"unknown"`，**证明该端点是真查库而非硬编码**。
进程纪律：启/停全部用记录在案的精确 PID（24283 → 25995），**未使用任何 `pkill -f`/`killall`**；5788 最终无监听。

---

### AC5 端口配置

**1) 前端 `frontend/vite.config.js`（当前值 + 本提交的 diff）**

```
cd /Users/kevin/bistro/seafood
cat frontend/vite.config.js
git show cbb40d1 -- frontend/vite.config.js
```

原始输出：

```
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5787,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5788',
```

```
diff --git a/frontend/vite.config.js b/frontend/vite.config.js
@@ -4,11 +4,11 @@
   server: {
-    port: 5777,
+    port: 5787,
     strictPort: true,
     proxy: {
       '/api': {
-        target: 'http://localhost:5778',
+        target: 'http://localhost:5788',
```

**2) 后端 `backend-ts/src/index.ts` 的 PORT 默认值**

```
git show cbb40d1 -- backend-ts/src/index.ts | grep -n 'PORT'
```

原始输出：

```
-const PORT = Number(process.env.PORT || 5778);
+const PORT = Number(process.env.PORT || 5788);
```

（当前文件 `backend-ts/src/index.ts:20` = `const PORT = Number(process.env.PORT || 5788);`，与 AC4 实测「不设 PORT 时 5788 起服务」一致。）

**3) 「5777/5778 未被改动」的严格核对（只读）**

```
git show --name-only cbb40d1 -- frontend/            # 本提交在 frontend/ 下只碰了 1 个文件
grep -n 'port\|target' /Users/kevin/bistro/jinli/frontend/vite.config.js
grep -n 'PORT' /Users/kevin/bistro/jinli/backend-ts/src/index.ts
git -C /Users/kevin/bistro/jinli log --oneline -1
lsof -nP -iTCP:5787 -iTCP:5788 -iTCP:5777 -iTCP:5778 -sTCP:LISTEN
```

原始输出：

```
frontend/vite.config.js                      <-- 本提交在 frontend/ 下唯一改动的文件
7:    port: 5777,
11:        target: 'http://localhost:5778',
19:const PORT = Number(process.env.PORT || 5778);
de354754 fix(frontend): repair ui barrel re-exports that blanked dev page
COMMAND   PID  USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    13019 kevin   15u  IPv6 0xf12d2846a516237c      0t0  TCP *:5778 (LISTEN)   <-- jinli 后端，未受影响
node    69222 kevin   31u  IPv6 0x27d4d9cb88f5fa7c      0t0  TCP [::1]:5777 (LISTEN) <-- jinli 前端，未受影响
5787_exit=1   <-- 5787 空闲
5788_exit=1   <-- 5788 空闲（我方测试实例已全部退出）
```

结论：**PASS（附一条需要 Zang 知悉的语义澄清）**。
- 严格逐字读「5777/5778 的配置未被本提交改动」→ **该句为假**：本提交确实把 `seafood/frontend/vite.config.js` 里的 `5777→5787`、`5778→5788` 改了。但这不是越界，而是**修正越界**：改动前 seafood 自己的 dev 前端佔用了 jinli 的 5777（且 `strictPort: true`），后端默认占用 jinli 的 5778 —— 属端口撞车隐患；本提交把 seafood 迁到 5787/5788 后**彻底避开** 5777/5778。
- jinli 侧文件（`jinli/frontend/vite.config.js`、`jinli/backend-ts/src/index.ts`）**一字未动**（仍 5777/5778），且有 jinli 与 jinli-api 在 5777/5778 正常监听（见 AC7）；本提交的改动集里**不含任何 jinli 路径**。
- 5787/5788 当前均空闲，与面板已登记端口（5555/5163-5199/5701/5777/5778/3100 等）无冲突。

---

### AC6 越界核对（第三方判定实现方是否守红线）

**1) 文件集 / 新增删除（显式钉住 `cbb40d1`）**

```
cd /Users/kevin/bistro/seafood
git show --name-status cbb40d1
git show --diff-filter=D --name-only cbb40d1
git show --stat cbb40d1 | tail -20
```

原始输出：

```
M	backend-ts/.gitignore
A	backend-ts/migrations/0001_ledger_core.sql
A	backend-ts/migrations/0002_user_identity.sql
M	backend-ts/package-lock.json
M	backend-ts/package.json
A	backend-ts/scripts/inspect-schema.ts
A	backend-ts/scripts/migrate.ts
A	backend-ts/scripts/probe-tx.ts
A	backend-ts/scripts/verify-db-layer.ts
A	backend-ts/src/db.ts
M	backend-ts/src/index.ts
M	docs/seafood.master-plan.md
M	frontend/vite.config.js

backend-ts/package-lock.json                 |  33 +++-
backend-ts/package.json                      |  12 +-
backend-ts/scripts/inspect-schema.ts         |  75 ++++++++
backend-ts/scripts/migrate.ts                | 139 ++++++++++++++
backend-ts/scripts/probe-tx.ts               | 229 ++++++++++++++++++++++++
backend-ts/scripts/verify-db-layer.ts        | 263 +++++++++++++++++++++++++++
backend-ts/src/db.ts                         | 243 +++++++++++++++++++++++++
backend-ts/src/index.ts                      |  20 +-
docs/seafood.master-plan.md                  |  19 ++
frontend/vite.config.js                      |   4 +-
13 files changed, 1241 insertions(+), 10 deletions(-)
```

**2) 无删除文件**

`git show --diff-filter=D --name-only cbb40d1` → **输出为空**（无 D 条目，与上文 13 行 name-status 无 `D` 一致）。

**3) `frontend/src/**` 未被触碰**

```
git show --stat cbb40d1 -- frontend/src
git show --name-only cbb40d1 -- frontend/
```

原始输出：

```
（第一条为空 —— 未改动 frontend/src 下任何文件）
frontend/vite.config.js
```

结论：`frontend/src/**` **未改**（PASS）；本提交在 `frontend/` 下只改了 `vite.config.js`。

**4) 关键文档 sha256（与 R1 交付值比对）**

```
shasum -a 256 docs/ledger.spec.md docs/design/style-preview.html
git show --name-only cbb40d1 -- docs/ledger.spec.md docs/design/style-preview.html
```

原始输出：

```
c56421aa5bf9ad419330b870093d1a0c6f6ee15317d2bfb303d7cc0c1c760ead  docs/ledger.spec.md
b61ad55d36211958b65d086d09fb79f57d0494b01c8cf6bc79dd84c622982deb  docs/design/style-preview.html
（第二条为空 —— 两个文件均不在被验提交的改动集内）
```

- `docs/ledger.spec.md` = `c56421aa5bf9ad419330b870093d1a0c6f6ee15317d2bfb303d7cc0c1c760ead` → **与 R1 实测值逐字一致**（口径未被 P0 偷偷改动）。
- `docs/design/style-preview.html` = `b61ad55d36211958b65d086d09fb79f57d0494b01c8cf6bc79dd84c622982deb`（**质检方本次实测值，登记供后续比对**；该文件不在本提交改动集内）。

**5) 附属文件改动定性（不算越界，但登记）**

```
git show cbb40d1 -- backend-ts/package.json      # 仅新增 ws / @types/ws，其余为字母序重排
git show cbb40d1 -- backend-ts/package-lock.json # 同步新增 node_modules/ws@8.22.0 与 @types/ws@8.18.1
git show cbb40d1 -- backend-ts/src/index.ts      # 仅 PORT 5778→5788、新增 /health、日志文案 Jinli→Seafood
```

`package.json` 的实际语义变更只有 2 条依赖（`ws`、`@types/ws`，与 `src/db.ts` 注入 WebSocket 构造器一致），其余 12 行 diff 是键的字母序重排（无版本回退）。
`docs/seafood.master-plan.md`（+19）为设计文档，且**在提交信息中显式声明**（「D9 主题体系裁决 + §5.3」），非静默改动；但严格说它超出「P0 地基」的代码范围，**是否属本提交职责请 Zang 裁定**（质检方按规则只读、未改动它）。
`backend-ts/scripts/{probe-tx,verify-db-layer,inspect-schema}.ts` 为新增验证脚本（交付方自证用，未参与运行时代码路径；质检方**未采信**其读数）。

**6) 质检期间 HEAD 发生位移（第三方事实披露）**

质检中途另一个代理提交了 `3a37424 design: 一整套主题体系规范…`（只含 `docs/design/design-system.spec.md` 与 `docs/seafood.master-plan.md`），使 `cbb40d1` 从 HEAD 变为 HEAD~1。本报告所有 AC 断言均已改用**显式提交号 `cbb40d1`** 复核（见上文命令），不受影响；该位移不是本报告作者所为（本报告作者未执行任何 commit/push）。

结论：**PASS**。改动面与提交信息自述一致，无删除文件，无 `frontend/src/**` 改动，无 jinli 路径改动，口径文档 sha256 未被篡改；仅 1 项（master-plan 顺手改动）登记待 Zang 裁定。

---

### AC7 面板盘面未被破坏

**在质检全部动作（起/停后端两次、迁移两轮、指纹采集、守卫探针）之后**读取盘面：

```
date '+%Y-%m-%d %H:%M:%S %Z'        # 2026-09-27 12:02:05 CST
curl -s -o /tmp/qa-probe/panel2.json http://127.0.0.1:5555/api/status   # 用质检方脚本统计（不打印连接串）
```

原始输出（逐条）：

```
total= 14 running= 14 portOpen= 14
not-fully-up= []
  jiazu-api    port=3100  running=True portOpen=True pid=1450
  jiazu        port=5199  running=True portOpen=True pid=69132
  xiai-api     port=5191  running=True portOpen=True pid=69133
  shu          port=5164  running=True portOpen=True pid=68307
  feicui-api   port=5196  running=True portOpen=True pid=69134
  feicui-web   port=5195  running=True portOpen=True pid=69135
  xiai         port=5163  running=True portOpen=True pid=97724
  jinli-api    port=5778  running=True portOpen=True pid=13005
  jinli        port=5777  running=True portOpen=True pid=69138
  cat          port=5701  running=True portOpen=True pid=69139
  aranya-api   port=5181  running=True portOpen=True pid=69140
  liwu-proxy   port=3020  running=True portOpen=True pid=69141
  liwu-web     port=5175  running=True portOpen=True pid=69142
  liwu-app     port=5176  running=True portOpen=True pid=69143
```

另：`lsof -nP -iTCP:5777 -iTCP:5778 -sTCP:LISTEN` 显示 5777/5778 仍由 node(69222)/node(13019) 正常监听，与面板上报一致。

结论：**PASS**。**14/14 且逐条 `running:true` / `portOpen:true`**，`jinli`(5777) 与 `jinli-api`(5778) 均 running，`not-fully-up` 为空。
**未发生任何事故、无需披露复原动作**：质检全程只启动/停止过我自己记录的精确 PID（24283、25995），**未执行任何 `pkill -f` / `killall`**，未停/重启任何面板托管服务，未触碰 5555/5777/5778/5779 等他人端口，未连接旧 jinli 库。

---

### AC8 静态度量与诚实清单

**静态类型检查（真实读数）**

```
cd /Users/kevin/bistro/seafood/backend-ts
npx tsc --noEmit ; echo "TSC_EXIT=$?"
npx tsc --noEmit 2>&1 | grep -c 'error TS'
```

原始输出：

```
TSC_EXIT=0
0
```

结论：**0 error，退出码 0**（`--noEmit` 不产出 `dist/`，未污染工作区）。

**质检方自认为未覆盖 / 无法验证的项**（详见文末清单）：Vercel 生产运行时、交付方自证脚本的并发/锁读数、死锁重试与超时路径、前端 vite 实际起服、业务路由与事务层的端到端接线、`migrate --status` 分支。

---

### 附加检查（超出 AC 清单，质检方主动补做）

**A1 迁移内的两个守卫触发器是否真的生效**（`/tmp/qa-probe/guard.js`，全部用例在显式事务内并强制 ROLLBACK）

```
cd /Users/kevin/bistro/seafood/backend-ts && node /tmp/qa-probe/guard.js ; echo "EXIT=$?"
```

原始输出：

```
ledger_entry baseline = 0
UPDATE 改 append-only 表: 事务内 ledger_entry=1 ; 报错=ledger_entry is append-only: UPDATE forbidden (txid=14)
DELETE 删 append-only 表: 事务内 ledger_entry=1 ; 报错=ledger_entry is append-only: DELETE forbidden (txid=15)
account 非 0/0 开户: 事务内 ledger_entry=0 ; 报错=new account must start at 0/0 (uid=9999, cid=1)
ledger_entry after rollbacks = 0 (基线 0 ) ; account 残留 uid=9999 = 0
GUARD-PROBE: ALL-PASS
EXIT=0
```

→ `ledger_entry` 的 append-only 触发器对 UPDATE/DELETE 都真实拦截；`account` 非 0/0 开户被拦；回滚后无残留。**PASS**

**A2 migrate 的判负能力：checksum 漂移检测 + 失败整文件回滚**（在 `/tmp` 一次性副本里做，**未动本仓库**）

```
cd /tmp/seafood-qa-clone/backend-ts && ln -sfn <仓库>/backend-ts/node_modules node_modules
printf '\n-- QA drift probe\n' >> migrations/0001_ledger_core.sql
env DATABASE_URL_UNPOOLED="$DATABASE_URL_UNPOOLED" npx ts-node --transpile-only scripts/migrate.ts ; echo "DRIFT_EXIT=$?"
git checkout -- backend-ts/migrations/0001_ledger_core.sql
printf 'CREATE TABLE qa_bad (this is not valid sql);\n' > migrations/0003_bad.sql
env DATABASE_URL_UNPOOLED="$DATABASE_URL_UNPOOLED" npx ts-node --transpile-only scripts/migrate.ts ; echo "BAD_EXIT=$?"
cd <仓库>/backend-ts && node /tmp/qa-probe/fingerprint.js /tmp/qa-probe/ac3-after-bad.json >/dev/null
diff /tmp/qa-probe/ac3-before.json /tmp/qa-probe/ac3-after-bad.json && echo FINGERPRINT_UNCHANGED=yes
```

原始输出（节选）：

```
{ "ok": false, "applied_now": [ { "version": "0001", "action": "ABORT", "reason": "checksum drift: file changed after apply" } ],
  "schema_version": "0002", ... "public_base_table_count": 6 }
DRIFT_EXIT=3

{ "ok": false, "applied_now": [ {0001 skipped}, {0002 skipped},
  { "version": "0003", "name": "0003_bad.sql", "action": "FAILED", "message": "syntax error at or near \"valid\"", "code": "42601" } ],
  "schema_version": "0002", "schema_migration_rows": [0001, 0002], "public_base_table_count": 6 }
BAD_EXIT=4
FINGERPRINT_UNCHANGED=yes
```

→ 文件改过 → **退出码 3 / ABORT，不静默重放**；坏迁移 → **退出码 4，失败整文件回滚，不写版本行，无残留表**。**PASS**（这条也证明「skipped」不是脚本偷懒的假象——它确实会检出并拒绝异常输入。）

**A3 质检副作用自查：数据库指纹回到基线**

```
node /tmp/qa-probe/fingerprint.js /tmp/qa-probe/ac-final.json >/dev/null
diff /tmp/qa-probe/ac3-before.json /tmp/qa-probe/ac-final.json && echo DB_FINGERPRINT_UNCHANGED=yes
```

原始输出：

```
DB_FINGERPRINT_UNCHANGED=yes
```

→ 质检期间对库的全部写入（AC2 探针 3 行、守卫探针 3 次事务写入）**均已回滚/删除**：6 张表 oid/relfilenode、索引、触发器、行数（`user=0`、`ledger_entry=0`、`account=4`）与质检前基线**逐字一致**，无遗留 QA 数据、无 schema 变更。

---

## 总结表格

| AC | 项目 | 结论 | 关键证据 |
|---|---|---|---|
| AC1 | 迁移 SQL 可被 git 真正跟踪 | **PASS** | `check-ignore -q` exit=1（未忽略）；`git ls-files` 2 个；HEAD 树含 2 blob（183/26 行）；**真实 clone 到 /tmp 后文件存在且 sha256 一致**；副本内删掉例外规则后现象复现（证明修复必需） |
| AC2 | 事务回滚真生效 + 探针判负能力 | **PASS** | 自写探针 10/10 PASS：事务内可见=1 → 抛错 → 外部读 0；提交组=1；autocommit 残留=1；漏 ROLLBACK 失误写法残留=1；`tx url = direct(unpooled)` |
| AC3 | migration 幂等 | **PASS** | 连跑两次均 `skipped/checksum match`、exit 0；两条版本行 checksum 与 applied_at 未变；**6 表 oid/relfilenode 未变**（未重建）；表数 6→6；指纹 diff 为空。附加：漂移检测 exit 3、坏迁移 exit 4 且不写版本行 |
| AC4 | `GET /health` 真实 HTTP 且真查库 | **PASS** | HTTP 200 + `PostgreSQL 18.6` + `schema_version=0002`，与质检方直连（unpooled/pooler）读数逐字一致；DB 不可达时 503/`unknown`（证明非硬编码）；收尾按精确 PID 停止，5788 无监听 |
| AC5 | 端口配置 | **PASS**（附语义澄清） | vite `port:5787` / proxy→`5788`；后端 `PORT` 默认 5788；jinli 侧仍 5777/5778 且**本提交未含任何 jinli 路径**。注：本提交确实改了 seafood 自己配置里的 5777/5778 数字（方向是**迁离** jinli 端口，非越界） |
| AC6 | 越界核对 | **PASS**（1 项待裁定） | 13 文件全与提交信息自述一致；**无删除文件**；`frontend/src/**` 未改（frontend 下只改 vite.config.js）；`docs/ledger.spec.md` sha256 = R1 值；`docs/design/style-preview.html` = `b61ad55d…`（本次登记） |
| AC7 | 面板盘面未被破坏 | **PASS** | 全部动作后 **14/14 running & portOpen**，`not-fully-up=[]`，jinli(5777)/jinli-api(5778) 正常；无事故、无需复原披露 |
| AC8 | 静态度量 | **PASS** | `npx tsc --noEmit` 退出码 0、**0 error** |

**总体结论：P0 地基 8/8 AC 全部 PASS，未发现 P0 阻断级缺陷。** 但有 3 条非阻断问题/待裁定项必须回传（见下）。

### 缺陷与非阻断问题清单（不修，仅登记）

1. **【P2】只读路由未实现 + 死代码**：`backend-ts/src/db.ts:44` 的 `resolveReadUrl()` **全仓无任何引用**（`grep -rn resolveReadUrl src/ scripts/` 只命中定义行）；`readQuery()`（`src/db.ts:204-213`）直接复用 `getTransactionPool()`，即**所有只读单语句也走 UNPOOLED 直连池**。这与该文件顶部注释「R56 只读单语句可走 DATABASE_URL（pooler）」及同文件第 203 行注释（称旧 neon() HTTP 驱动仍可承担只读）不一致。影响：在 Vercel 上读路径不吃 pooler 而吃直连（交付方自报直连上限 112），高并发读有耗尽风险。**当前仅 `/health` 调用它**（业务路由仍走 `src/database.ts` 的 `neon()` 驱动），故未阻断 P0。复现：`grep -rn "resolveReadUrl" backend-ts/src` → 仅 1 处定义。
2. **【P3】`.gitignore` 例外覆盖面窄**：`backend-ts/.gitignore:7` 的 `!migrations/*.sql` 只对 `backend-ts/migrations/` 的**直接子文件**生效。今后若把迁移/DDL 放到其他路径（如 `backend-ts/sql/`、`migrations/0001/`），仍会被根 `.gitignore:303` 的 `*.sql` 静默吞掉（质检方已在 /tmp 副本复现该吞掉现象）。建议在根 `.gitignore` 改为按目录白名单（如 `!**/migrations/`）或删掉 `*.sql`。
3. **【P3·待 Zang 裁定】非 P0 范围的文档改动**：`cbb40d1` 一并改了 `docs/seafood.master-plan.md`（+19，D9 主题体系裁决 + §5.3）。虽在提交信息中显式声明（非静默），但超出「P0 地基」代码范围，是否属本提交职责请 Zang 裁定。
4. **【P3·观察】`/health` 无缓存头**：实测 `headers.cache-control = undefined`（同库的 `/api/prize/all` 等有 `public, s-maxage` 头）。健康检查建议显式 `no-store`，避免 CDN 缓存陈旧状态。

---

## 已知未验证项

| # | 未验证项 | 原因 |
|---|---|---|
| 1 | **Vercel/serverless 生产运行行为**：`src/index.ts:1095` 的 `if (!process.env.VERCEL)` 分支、`neonConfig.webSocketConstructor = ws` 在 Vercel Node runtime 下的可用性、Edge runtime 下 `ws` 不可用问题 | 本机 Node 18 实测通过，未做真实部署 |
| 2 | 交付方自报的 `scripts/probe-tx.ts` 读数（pooler 上 `pg_advisory_xact_lock` 可用、直连 8/8 并发、`max_connections=112`） | 属交付方自证脚本，质检方**未复跑**（既未采信也未否证） |
| 3 | 死锁/序列化失败重试（R60：40001/40P01 + 50/200/800ms 退避）与 `lock_timeout`/`statement_timeout`（R82）的真实触发行为 | 未构造真实死锁/锁等待场景 |
| 4 | 前端 dev server 实际在 5787 起服 | 只做配置读取与端口占用核对（5787 空闲），未启动 vite |
| 5 | 业务路由与事务层的端到端接线 | 本提交未把写路径接进 `withTransaction`（业务仍走 `src/database.ts` 的 `neon()` HTTP 驱动）；能力已单测但**无真实调用方** |
| 6 | R1 记录的「仓库缺 7 张核心表 DDL」缺口 | 不在本 P0 提交范围，未核 |
| 7 | `migrate.ts --status` 分支 | 未跑（仅跑了应用分支） |
| 8 | 迁移 SQL 的**业务口径**正确性（表结构是否严格符合 `docs/ledger.spec.md` 逐条） | 超出本次质检范围（本次只验证可入库、可重入、守卫生效）；建议 P1 由口径侧（Jing）单独对照 spec 审 |

---

## 质检方操作边界自查

- **只写 `docs/qa/**`**：本报告为唯一新增文件；`git status --porcelain` 显示工作区改动仅 `?? docs/qa/`（未改任何业务代码/规范/设计文件）。
- **数据库**：全程只连本项目新库（`version()` = PostgreSQL 18.6 / db=neondb）；**未连旧 jinli 库**；未打印、未修改 `backend-ts/.env.local`（仅在 shell 内 `source` 用于向 `/tmp` 副本传环境变量，输出中无连接串）。
- **进程**：只用记录在案的精确 PID（24283 → 25995）`kill -TERM`；**零次 `pkill -f`/`killall`**；未停/重启面板托管服务；测试结束 5788/5787 均无监听。
- **git**：未 commit、未 push、未 reset/checkout --/stash/clean；未 `git add -A`/`.`；仅在 `/tmp` 一次性克隆内做破坏性实验（仓库本身零改动）。
- **报告落盘方式**：先落骨架、再逐章 patch 追加（非一次性大写入）。
