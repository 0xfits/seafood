# S47 · `scripts/**` 新门 19 条「入职即带错」类型债清收（R3b）

> **单号**：S47（路线图 R3b） · **角色**：Kong · **性质**：**逐条修类型面（零运行时行为改动）**
> **现取时间**：2026-10-07（CST） · **runid**：`s47-20261007T003107Z` · **产物**：`backend-ts/.s47-artifacts/s47-20261007T003107Z/`
> **上游**：`docs/audit/s46-scripts-type-debt-attribution.md`（归因单，只读）+ `added-19-new-files.json`

---

## §0 对锚（动笔前）

| 项 | 命令 | 读数 |
|---|---|---|
| HEAD | `git log --oneline -3` | `aa40462` **chore: S46 R3 归因闭合（96=77+19 …）** ← `7d530ea` ← `0c245d3` ✓ 含「S46 归因」 |
| 工作树（动笔前） | `git status --porcelain` | **空**（脏 0 / untracked 0） |
| 本机时间 | `date` | Wed Oct 7 08:31:07 CST 2026 |
| 基线口径 | `git status --porcelain -- backend-ts/tsconfig*.json` | **空（前后逐字未改）⇒ apples-to-apples** |
| 计数起点 | `cd backend-ts && npx tsc -p tsconfig.scripts.json --noEmit` | **退出码 2 / 96 条 / 30 文件**（与 S46 §1 逐字相符） |
| DB 可达 | 只读探针 | `schema_migration` = **42 行 / 0043**（活体 leg 可跑） |

**基线锚 rev = `39d89b3`**（册内 §13.3「22 文件 / 77 条」同源时点）。

---

## §1 19 条逐条修法（`文件:行:列` · 错码 ⇒ 修法 ⇒ 为何零语义变化）

> **总原则**：全部修法只用**类型面**手段（`as` 到正确形状 / 改**显式返回类型**），**无一处**改判据谓词、改常量、改分支、改实参值。**铁证 = 转译后 JS 逐字节同一**（§2.3）——类型断言与类型标注在 `ts-node --transpile-only` 下**全被擦除**，故 8 个脚本的运行期代码**逐字节不变**。

### A · `scripts/p8-s10-invite-reward-gate.ts`（9 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| A1 | `165:22` | TS2345 | `B(xOf('U1'))` → `B(xOf('U1') as string)` | `as string` 编译期擦除；`B` 收到的实参**值逐字节不变** |
| A2 | `165:37` | TS2345 | 同上（`U2`） | 同上 |
| A3 | `165:53` | TS2345 | 同上（`U2`） | 同上 |
| A4 | `165:68` | TS2345 | 同上（`U3`） | 同上 |
| A5 | `165:84` | TS2345 | 同上（`D1`） | 同上 |
| A6 | `165:99` | TS2345 | 同上（`D2`） | 同上 |
| A7 | `165:115` | TS2345 | 同上（`D2`） | 同上 |
| A8 | `165:130` | TS2345 | 同上（`D3`） | 同上 |
| A9 | `312:5` | TS2322 | 只改**显式返回类型**：`const kg = (…): void => checks.push(…)` → **`: number =>`** | 表达式体与实参**逐字未动**；`kg` 运行期本就返回 `checks.push(…)` 的 `number`，仅被 `void` 标注掩盖 |

> **A1–A8 根因**：`xOf = (label: string): string \| null`（`:134`），`B = (v: number \| string): bigint`（`:83`）。8 个 `B(xOf(…))` 的实参是 `string \| null`。`xOf` 对本门**恒定的 6 个层标签**（`U1..D3`，`:146` 断言 `labels === ['U1'..'D3']`）恒走 `e ? e.x : null` 的 **`e.x`（string）分支**，`null` 为**死路径**。断言 `as string` 只把「已知非 null」写进类型，**不动** `xOf` 的返回类型、不动 `B` 的签名、不动任何值。

### B · `scripts/p8-s11-audit-console-gate.ts`（1 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| B1 | `461:5` | TS2322 | 箭头（起于 `460`）`const kg = (…): void =>` → **`: number =>`** | 同 A9：仅改显式返回类型；表达式体逐字未动 |

### C · `scripts/p8-s3-01-effective.ts`（1 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| C1 | `199:43` | TS18046 | `baseline.app_config.agg` → `(baseline.app_config as { agg?: unknown }).agg` | 断言擦除；`baseline` 为 `snapshot(): Promise<Record<string,unknown>>`，属性本就存在。**同文件 `:303` 早已用同形** `(baseline.app_config as { rows: … })` |

### D · `scripts/p8-s4-01-effective.ts`（2 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| D1 | `113:7` | TS18046 | `summary.fixture.cids = …` → `(summary.fixture as Record<string, unknown>).cids = …` | 断言擦除；`summary: Record<string,unknown>`，`:102` 刚写入同一对象 |
| D2 | `114:7` | TS18046 | `summary.fixture.symbols = …` → 同形 | 同上 |

### E · `scripts/p8-s4-currency-review-gate.ts`（2 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| E1 | `211:83` | TS2339 | `${cidA.err.code}` → `${(cidA as { err: { code: string; status: number } }).err.code}` | 断言擦除。`ParsedReview` 是判别联合 `{ok:true;…}` \| `{ok:false; err: VerbErr}`；本支条件为 `reviewed(cidA).ok`，而 `reviewed` 是**恒等函数** `(p)=>p`（`:207`）⇒ 与 `!cidA.ok` 同真值 |
| E2 | `211:100` | TS2339 | `${cidA.err.status}` → 同形 | 同上 |

> **为何不改写成 `cidA.ok`（更自然但**会**丢掉一次 `reviewed()` 调用）**：硬口径要求「不得改运行时行为」。改条件会删掉一次函数调用（虽为纯恒等），故**保守取 `as` 断言**，令**运行期表达式逐字不变**。

### F · `scripts/p8-s5-01-real-chains.ts`（2 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| F1 | `184:41` | TS18046 | `out.migration_assert['db_0026']` → `(out.migration_assert as Record<string, string \| null>)['db_0026']` | 断言擦除；`eq()` 的 `actual` 形参本就是 `unknown` |
| F2 | `186:41` | TS18046 | 同上（`db_0027`） | 同上 |

### G · `scripts/p8-s6-site-text-gate.ts`（1 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| G1 | `273:153` | TS2339 | `g5.details.legal_keys?.length` → `(g5.details.legal_keys as string[] \| undefined)?.length` | 断言擦除 + **保留原可选链**；`unknown?.x` 被 TS 压成 `{}` 才报错，断言后形状正确 |

### H · `scripts/p8-s7-batt-checkin-gate.ts`（1 条）

| # | 位置 | 错码 | 修法 | 为何零语义变化 |
|--:|---|---|---|---|
| H1 | `564:5` | TS2322 | 箭头（起于 `563`）`const tg = (…): void =>` → **`: number =>`** | 同 A9 |

**合计 = 8 文件 / 19 条**（A9 + B1 + C1 + D2 + E2 + F2 + G1 + H1 = 19）✓ 与 `added-19-new-files.json` 逐条一一对应。

---

## §2 8 门读数「改前/改后」逐字对照（★ 防「为消错顺手改判据」）

**跑法**：`cd backend-ts && npx ts-node --transpile-only scripts/<门>.ts`（本仓各门头注写死的用法）。
**受控实例**：起 1 个后端于 **`127.0.0.1:5792`**（PID 记录见 §5；`P8S7_BASE`/`P8S10_BASE`/`P8S11_BASE` 统一指向它）；其余 5 门仅连库（DB 活体）。
**三趟**：`before`（改前原件）· `after`（改后）· `after2`（**改后同一份**再跑一趟，用于分离「改动」与「跑序/库态」）。
产物：`.s47-artifacts/<runid>/gates/{before,after,after2}/`（每门 `*.exit` / `*.stdout.txt` / `*.artifact.json`）。

### 2.1 核心判据（判定 / 计数 / 分母 / 退出码）——**8/8 逐字相同**

| 门 | 退出码 b/a/a2 | total b/a/a2 | passed b/a/a2 | failed b/a/a2 | 判定序列 `(id,group,pass)` b==a | a==a2 |
|---|---|---|---|---|---|---|
| `p8-s3-01-effective` | 1/1/1 | 34/34/34 | 23/23/23 | 11/11/11 | **True** | **True** |
| `p8-s4-01-effective` | 0/0/0 | 31/31/31 | 31/31/31 | 0/0/0 | **True** | **True** |
| `p8-s4-currency-review-gate` | 0/0/0 | 79/79/79 | 79/79/79 | 0/0/0 | **True** | **True** |
| `p8-s5-01-real-chains` | 1/1/1 | 69/69/69 | 67/67/67 | 2/2/2 | **True** | **True** |
| `p8-s6-site-text-gate` | 0/0/0 | 64/64/64 | 64/64/64 | 0/0/0 | **True** | **True** |
| `p8-s7-batt-checkin-gate` | 0/0/0 | 60/60/60 | 60/60/60 | 0/0/0 | **True** | **True** |
| `p8-s10-invite-reward-gate` | 0/0/0 | 49/49/49 | 49/49/49 | 0/0/0 | **True** | **True** |
| `p8-s11-audit-console-gate` | 0/0/0 | 87/87/87 | 87/87/87 | 0/0/0 | **True** | **True** |

> **AC2 达成**：8 门的**退出码 / 分母（total）/ 判定（每条 `pass` + 判定序列）/ 计数**在 `before`·`after` 间**逐字相同**；`after2`（同一份改后码）亦**完全相同**。
> 另：`p8-s3-01` 与 `p8-s5-01` **改前即红（exit 1）**，**改后仍同一红**（非本单引入、亦未被本单消掉）。

### 2.2 完整 JSON 的残差——**全部为库态 / RUN token**，无一与改动相关

对 `before` vs `after` 的完整 `*.artifact.json` 做叶级差分，**唯一** differ 的路径全部是：

| 门 | 残差路径（示例） | 性质 |
|---|---|---|
| `s3-01` | `…/detail/ledger_entry/n 502→504` · `max_txid 2470→2651` · `digest` · `max_created` | **活库行数前移**（两趟之间库被外部写入） |
| `s4-01` | `…/fixture/cids 900172251→900081041` · `symbols p8s4…` | **RUN 派生夹具 id**（`RUN` 每次跑不同） |
| `s4-currency-review` | `/run` | RUN token |
| `s5-01` | `job_id 276→281` · `txid 2648→2673` · `listing_id 45→47` | **活库序列号前移** |
| `s6` | `/run` | RUN token |
| `s7` | `…/makeup_state/branch a_applied→b_replayed` · `balance 7500→7400` · `key_row false→true` | **库数据态**（本门自称「数据态感知」，观测 `2026-10-06` 既有补签行） |
| `s10` | `/run` · `…/in_tx/ft_method/s1/jobId 277→282` | RUN token + 活库序列号 |
| `s11` | `/run` | RUN token |

⇒ **5 门的完整 JSON 不能逐字节全等**（含活库序列号 / RUN 夹具 id），**但差分面 100% 落在库态与 RUN**，**无一条落在判据常量 / 谓词 / 分支 / 计数**上。

### 2.3 ★ 铁证：转译后 JS 逐字节同一（本单「零语义改动」的构造性证明）

各门实际**执行**的是 `ts-node --transpile-only` 的转译产物。用**同一个 `typescript` 5.x**、以 tsconfig 的口径（`target ES2020 / module commonjs / esModuleInterop`）对**改前**与**改后**源各 `ts.transpileModule` 一次：

```
（proof-transpile-identity.out.txt）
IDENTICAL  p8-s3-01-effective.ts        js_sha(before)=4311c7c931a97999 js_sha(after)=4311c7c931a97999
IDENTICAL  p8-s4-01-effective.ts        js_sha(before)=96efd0a8920d12f0 js_sha(after)=96efd0a8920d12f0
IDENTICAL  p8-s4-currency-review-gate.ts js_sha(before)=147f2622cfdefb5c js_sha(after)=147f2622cfdefb5c
IDENTICAL  p8-s5-01-real-chains.ts      js_sha(before)=4c06a63d0e6196f5 js_sha(after)=4c06a63d0e6196f5
IDENTICAL  p8-s6-site-text-gate.ts      js_sha(before)=00ea42cec0c67c22 js_sha(after)=00ea42cec0c67c22
IDENTICAL  p8-s7-batt-checkin-gate.ts   js_sha(before)=63bf775712811082 js_sha(after)=63bf775712811082
IDENTICAL  p8-s10-invite-reward-gate.ts js_sha(before)=78583bd1a77c663f js_sha(after)=78583bd1a77c663f
IDENTICAL  p8-s11-audit-console-gate.ts js_sha(before)=56cb1cf03defce05 js_sha(after)=56cb1cf03defce05
ALL_TRANSPILED_JS_IDENTICAL = true
```

⇒ 8 个脚本的**运行期代码逐字节不变** ⇒ **一切读数差异（§2.2）在构造上不可能由本单改动产生**。（断言 `as …` 与返回类型标注 `: number` 均被擦除。）

### 2.4 抽验 `s36-00` / `s41-00`（无漂移）

| 门 | 命令 | 退出码 | 自证读数 |
|---|---|--:|---|
| `scripts/s36-00-identity-pk-form-gate.ts` | `npx ts-node --transpile-only …` | **0** | 受体 188 · 命中 30 · 基线 30 · **新增 0** |
| `scripts/s41-00-identity-seq-collision-gate.ts` | `npx ts-node --transpile-only …` | **0** | 受体 23 · 读数 23 · 违例 0 · 基线 23 · **新增 0** |

两门**未在改动面内**（`git diff --name-only HEAD` 不含），且**自证 新增=0** ⇒ **无漂移**。

---

## §3 数值判据

### 3.1 总数（`cd backend-ts && npx tsc -p tsconfig.scripts.json --noEmit`）

| 时点 | 命令 | 退出码 | 条数 | 文件数 |
|---|---|--:|--:|--:|
| 基线 `39d89b3`（册内 §13.3） | 重建现跑（S46） | 2 | **77** | **22** |
| 本单改前（HEAD `aa40462`） | 现跑 | 2 | **96** | **30** |
| 本单改后 | 现跑 | 2 | **77** | **22** |

**96 ⇒ 77（−19）**，**文件数 30 ⇒ 22**。

**错码分布对账（改后 vs 册内基线）——逐码逐字相同**：

| 错码 | 改前 | 改后 | 册内基线 | 判 |
|---|--:|--:|--:|---|
| `TS2339` | 24 | **21** | 21 | ✓ |
| `TS18046` | 21 | **16** | 16 | ✓ |
| `TS2322` | 18 | **15** | 15 | ✓ |
| `TS2352` | 11 | **11** | 11 | ✓ |
| `TS2345` | 12 | **4** | 4 | ✓ |
| `TS18047` | 2 | **2** | 2 | ✓ |
| `TS2367` | 2 | **2** | 2 | ✓ |
| `TS2559/2551/2362/2363/2353/2724` | 各 1 | **各 1** | 各 1 | ✓ |
| **Σ** | **96** | **77** | **77** | ✓ |

### 3.2 逐文件对账（被清 8 文件各降到位 · 其余 22 文件 **Δ=0**）

**被清的 8 个脚本**（条数恰 = `added-19-new-files.json`）：

| 文件 | 改前 | 改后 | Δ |
|---|--:|--:|--:|
| `scripts/p8-s10-invite-reward-gate.ts` | 9 | **0** | −9 |
| `scripts/p8-s4-01-effective.ts` | 2 | **0** | −2 |
| `scripts/p8-s4-currency-review-gate.ts` | 2 | **0** | −2 |
| `scripts/p8-s5-01-real-chains.ts` | 2 | **0** | −2 |
| `scripts/p8-s3-01-effective.ts` | 1 | **0** | −1 |
| `scripts/p8-s6-site-text-gate.ts` | 1 | **0** | −1 |
| `scripts/p8-s7-batt-checkin-gate.ts` | 1 | **0** | −1 |
| `scripts/p8-s11-audit-console-gate.ts` | 1 | **0** | −1 |
| **Σ** | **19** | **0** | **−19** |

**其余 22 文件（基线内）Δ 逐个 = 0**（机器读数：`非目标文件 Δ 绝对值和 = 0`）：
`p1f-02-f2-malformed`1 · `p2x-00-idempotency-replay-order`1 · `p3l-00-post`1 · `p3s1-00-db-state`1 · `p3w-00-fold-narrow-verify`1 · `p4z-03-keys`1 · `p4z-05-keys-b1c`4 · `p4z-08-keys-b1d`6 · `p4z-a1cap-01-e2e`3 · `p4z-a1li-01-e2e`3 · `p4z-audjk-01-probe`24 · `p4z-b2a-01-fixture`2 · `p4z-b2ahttp-03-e2e`11 · `p4z-b2b-01-patch`3 · `p4z-b2b-02-listing`2 · `p4z-b2c-02-probe`3 · `p4z-b3c-02-e2e`1 · `p4z-d1p-01-classifier-unit`2 · `p4z-d1p-04-sweep-negative-arm`1 · `qa-p1b-01-setup`1 · `qa-p1e-01-concurrency`4 · `qa-p1e-05-neon-ab`1（Σ=77）。

> 机器可读对账：`.s47-artifacts/<runid>/reconciliation.json`。

### 3.3 主 `tsc`（`npx tsc --noEmit`，`tsconfig.json`）

**退出码 0 / 0 行输出**（改后）。`tsconfig.json` 不含 `scripts/**` ⇒ 未受影响，仍 exit 0。

### 3.4 口径面（apples-to-apples）

`git status --porcelain -- backend-ts/tsconfig.json backend-ts/tsconfig.scripts.json backend-ts/tsconfig.scripts.probe.json` = **空** ⇒ **未改任何 tsconfig**。

---

## §4 判负（反向改回 ⇒ 错数必回；复原 ⇒ 回 77）

**取 `scripts/p8-s6-site-text-gate.ts`（1 条）做负对照**：

1. 存证：改后件 = `5c9a7580…b24c5`；改前原件 = `d1638e49…004c46`。
2. **反向改回**（以 `git show HEAD:` 的原件覆盖该文件）⇒ 现跑：
   ```
   NEGCOUNT=78
   scripts/p8-s6-site-text-gate.ts(273,153): error TS2339: Property 'length' does not exist on type '{}'.
   ```
   ⇒ **77 ⇒ 78（+1）**，且**原错误（`273:153` TS2339）逐字回**。**红** ✓
3. **复原**（把改后件拷回）：
   ```
   cmp scripts/p8-s6-site-text-gate.ts /tmp/…/s6_fixed.ts   → 无输出（CMP-OK：逐字节相同）
   cmp scripts/p8-s6-site-text-gate.ts /tmp/…/s6_orig.ts     → differ: char 21932, line 273（≠原件，符合预期）
   RESTORE_COUNT=77
   ```
   ⇒ **回 77**，且 `sha256` 与改后件逐字节相同。**绿** ✓

**判负成立**：修法**方向可逆且可观测**（−1 ⇄ +1），证明这 19 条**确由本单修法消掉**、非掩盖。

---

## §5 未做与 `NOT_MEASURED`

### 5.1 环境 / 进程（逐 PID）

| 项 | 读数 |
|---|---|
| 起的受控实例 | `PORT=5792 npx ts-node --transpile-only src/index.ts` —— 后台会话 `proc_c24c86b32c04`（`pid 9324`，监听子进程 `node pid 9710`） |
| 收尾释放 | `lsof -nP -iTCP:5792-5799 -sTCP:LISTEN` = **空**（已释放）；经 `process_manage(kill)` 回收（**非** `pkill -f`/`killall`） |
| 未触碰 | `5191 / 5787 / 5788 / 5555` 监听者**原 PID 不变**（56716 / 56865 / 56867 / 61000） |
| 仅起过的端口 | **5792**（**且仅此一个**；5793–5799 全程未起） |

### 5.2 未做

- **未** `commit` / `push` / `stash` / `checkout` / `reset` / `worktree`（`git status` 仅 8 个 `M`）。
- **未** `npm install`。
- **未**改 `backend-ts/src/**` · `migrations/**` · `frontend/**` · `docs/*.spec.md` · `docs/OPEN-ITEMS.md` · `docs/seafood.master-plan.md` · 任何 `tsconfig*.json`（guard 命令见 §3.4；`git status --porcelain -- <上述>` = 空）。
- 原始输出**未**用 `.log` 后缀（用 `.txt` / `.out.txt` / `.json` / `.exit`）。
- 只改了**这 8 个脚本** —— `git diff --name-only HEAD` 恰为该 8 条。

### 5.3 `NOT_MEASURED`

| 项 | 状态 | 因 |
|---|---|---|
| 5 门（`s3-01`/`s4-01`/`s5-01`/`s7`/`s10`）完整 `*.artifact.json` 的**逐字节全等** | **`NOT_MEASURED`** | 同库两趟之间**活库序列号前移**（`txid`/`job_id`/`listing_id`/行数）+ **RUN 派生夹具 id** 必然变化；这是**环境**而非改动面（§2.3 已构造性证明改动面零差异）。**判据/计数/分母/退出码**已逐字相同（§2.1）。 |
| `s7` `G9` 的 `branch=a_applied→b_replayed` | **`NOT_MEASURED`（判为库数据态）** | 本门自带「数据态感知」，读 `2026-10-06` 既有补签行；**两条分支 `pass` 均 True**（改前/改后 `pass` 序列相同）。 |
| 5792 之外端口、其他 26 个「零错」脚本 | 未跑 | 不在本单改动面。 |
| 8 门在**生产实例** 5787/5788 上的读数 | **未做**（硬口径禁触碰） | 用受控 5792 替代。 |

---

## §6 自曝

1. **我把 `void`→`number` 当作「类型面」修法，而非改成块体 `{ … }`**：`p8-s10:312` / `p8-s11:461` / `p8-s7:564` 的标准修法也可写成「表达式体 → 块体」（与本仓 `t` 助手同形，且块体**运行期会**把返回 `number` 变为 `undefined`）。硬口径写「修法限**类型面** …… **不得改运行时行为**」，故我取**只改显式返回类型**（`: void` → `: number`）——它令运行期**逐字节**不变（§2.3）。**代价**：`kg`/`tg` 的声明返回类型由 `void` 变 `number`，与该门 `t` 助手的 `: void` **不再同形**。若 Zang 更看重「与 `t` 同形」而非「运行期零差」，可换块体（读数不变，§2.1 已证），但那就**不是纯类型面**了。**此处由我裁，已标明。**
2. **AC2 我按「判定/计数/分母/退出码逐字相同」判过，未按「整份 JSON 逐字节」判过**：完整 JSON 有 5 门不等（§2.2），差在活库序列号与 RUN 夹具 id。我**没有**把「整份 JSON 不等」如实说成「完全逐字相同」——**不等的面全部落在库态/RUN**，并另用**转译 JS 同一性**（§2.3）作构造性铁证。若验收口径要求「整份 JSON 逐字节」，则该面 `NOT_MEASURED`（同库连跑不可得），**须另起一份独立库/快照**方可。
3. **`s3-01` 与 `s5-01` 改前即红（exit 1），我未修**：本单只清**类型债**、不碰判据。两门红是**既存**状态（改前=改后），若需消红须另立单（且很可能触发「改判据」禁区）。
4. **`s7` G9 的 `a_applied→b_replayed` 起初让我一度怀疑「改坏了判据」**：查证为本门**数据态感知**设计（观测既有补签行），两条分支 `pass` 均 True，且 `after2`（同一份改后码）仍为 `b_replayed` ⇒ **跑序/库态**，非改动。**如实记录，不隐。**
5. **临时件位置**：探针/原件/转译对比脚本落在 `/tmp/s47probe/**`；**入库产物**只落 `backend-ts/.s47-artifacts/s47-20261007T003107Z/**` + 本报告。**零写 `src` / `migrations` / `frontend` / spec**。
6. **`xOf` 的 `null` 分支我没删**：`xOf` 仍返 `string | null`，`null` 分支仍是**死路径**（`labels` 恒定 6 层）。我**只**在 8 个 `B(…)` 实参处断言 `as string`。**没有**顺手把 `xOf` 的返回类型收窄成 `string`（那会动 `xOf` 的签名与 `null` 分支的语义——即便等价，也超出「只修报错点」的最小面）。

---

*（S47 · Kong · 修 8 文件 / 19 条 · 96⇒77 · 零语义改动（转译 JS 逐字节同一）· runid `s47-20261007T003107Z`）*
