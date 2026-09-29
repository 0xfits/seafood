# 路由层与资金编排契约（ROUTE-LAYER-SPEC）

> **状态：v0.5（已完成 · 批 3b「招工资金」折入 + ★新增 §1.8「已实现·未注册清单」（Zang §5.85 新纪律）+ 两条既有路径行为 delta 定案）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v0.4（763 行 / md5 `e8b3ceffd98ef82fb37c77c2b13b6108` / 166747 字节）是本册直接前身**，快照 `docs/versions/route-layer.spec.v0.4.md` **本单新建**（与其逐字节相同，`cmp` 自证）。v0.3（716 行 / md5 `fa91425ed380423d0f01f577f0f53aa6` / 143415 字节）快照 `docs/versions/route-layer.spec.v0.3.md` **未动**（与本册前身主体逐字节相同）。v0.2（668 行 / md5 `0c587183a66ae39b597370acc08ac2fc` / 115905 字节）、v0.1（498 行 / sha256 `6f27b4add4b79da36602f20ba93f6edd2d93dcdc4d9164c00293909a697b5018`）快照亦**未动**。
> 本册是**批 3 / 批 4 实现的唯一依据**。实现（Kong）与质检（Neng）一律以本册条文为口径；冲突交 Zang 终审。
> **v0.5 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.5-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本册逐处标注「依据 = Zang §5.8x」；**本单无一处与裁定冲突**，两条行为 delta 与「已实现·未注册清单」均已获 §5.85 批准）。
> **★★ v0.5 本单要点（先说结论，不含糊）**：① **★新增 §1.8「已实现·未注册清单」（本轮最重要 · 依据 = Zang §5.85 裁定① 新纪律）** —— 表头 = **路径 / 服务层落点（`文件:行号`）/ 为何未注册 / 由哪一批注册**。**本册做了一次真扫描**（`grep` 五个服务编排文件的导出 × 对照 `src/index.ts` 的已注册路径表，逐 verb 核调用点）⇒ **实测清单 = 8 条 + 1 附注**：Zang 首批点名的 3 条（`POST /api/job/:jobId/apply`、`/accept`、`POST /api/listing`）**全部命中且被包含（无遗漏、无冲突）**；**本册实测多出 5 条**（`publishJob`→`POST /api/job`、`settleJob`→`/api/job/:jobId/review`、`refundJob`→`/review`·`/cancel`、`updateListing`·`transitionListingStatus`→`POST|PATCH /api/listing/:listingId`）⇒ **差异已在 §1.8 与 delta 件逐条写明，以本册实测为准**。**此清单的目的 = 防止「已实现但未注册」的路径被两片互推而永久遗忘**（先例 = `admin/assets/init` 在 2a/2b 两份报告里都写「归同批其它片」、无人执行；见 Zang §5.78）。② **折入批 3b 已落地事实（带真源）**：新建 `src/job-funds-service.ts`（**330 行 / sha256 `7b808634…`**；`publishJob` `:149`/`settleJob` `:218`/`refundJob` `:237`/`verifyJobSubmission` `:308`）；`src/database.ts` **+3 method**（`jobPostEvent` = **唯一资金写路径** `:1665` `SELECT public.job_post_event($1::jsonb)`；`resolveReviewTarget` 只读；`reviewJobSubmission` = **单条 SQL**：`WITH ev AS (job_post_event)` + `sub AS (UPDATE job_submission)` + 末 `SELECT` ⇒ 「结论位 + 资金同语句」）；`src/index.ts` **只改接** 1 条既有路由 `POST /api/tasklist/:jID/verify`；**注册点 53 → 53**；报告 `docs/audit/p4-b3c-job-funds.md`（见 **§1.9**）。③ **DL86 两形态实测事实**：无邀请人 ⇒ `job_fee` 入 `-1`（`-2` 命中 **0**）；真链 `depth=2` ⇒ **8 腿** = `job_payout`×2 + `job_fee`×2 + **`commission`×4**，`-2` 进 **+10** / 出 **−10** 守恒、`-1` 命中 **0**；**每个事件 `Σ(delta+frozen_delta) = 0`**；托管/退款 = **同账户 2 腿** `balance↔frozen`。④ **两条既有路径行为 delta 定案（Zang §5.85 裁定② 已批准）**：**非数字 `:jID` `400` → `404`（`R107`）**（对齐 detail-miss 统一 404）；**撤除「admin 提交不进面板队列」的 bespoke `400` 守卫**（读口已结构性排除 + §3.3-8）；两条均**登记回归项**「前端是否依赖旧 `400`」= **§2.4 S9 / §7-27**（真源 = 前端调用体，本册现取）。⑤ **登记（裁定未落者标 `待 Zang`）** = **§7-25**（`create_key` 缺失时**派生兜底 vs fail-loud** 两套口径：**3b 面已定**〔Zang §5.85 裁定③ 批准 fail-loud〕；**2a 面 = 审计件 `docs/audit/p4-aud-jobkey.md` 本单现取已落盘（246 行）⇒ 结论 = 「碰撞不成立」** —— 2a 派生键 = **自然标识的单射**（`fallbackParts` 不含内容）⇒ 异实体必不同键（实测 T1/T2/A1/A2 均落新行）、同实体异内容 ⇒ **409 响亮拒绝**（非静默）；**但改法 = 审计的 A/B/C 三选项仍待 Zang 裁定**〔审计自述「只取证不裁决」〕⇒ 由 v0.6 定案）+ **§7-26**（§1.8 清单的**维护责任**——**机制已定、责任人待 Zang**）+ **§7-27**（前端旧 `400` 依赖的全量回归核验）。⑥ **§7 状态列**：**新增 7-25 / 7-26 / 7-27**；**7-1…7-24 逐条保留**（未得裁定者一字不动）。
> **v0.4 修订入口（历史）**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.4-delta.md`。
> **★★ v0.4 本单要点（历史，仍在册 · 其中「注册点仍 53」与「金额已改服务端取数」两句仍成立）**：**批 3a 真收官** —— `migrations/0019_listing_deposit_platform_credit.sql`（`listing_deposit` 入 **DB 侧 `-1` credit 白名单**）+ `migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（把 `listing_deposit` 从 **`ledger_post_event` 函数体** hold 家族 IN 列表摘除）**两迁移均已应用**（`/health` 自报 **`schema_version=0020`**、`schema_migration` = **19**、`0018` 无文件勿补）；`src/ledger.ts` 的 `HOLD_KINDS` **5→4**（`:178` 现取）；C2 最终入账形状 = **4 腿全在 `balance`**（上市费 `currency_create_fee` ×2 + 保证金 `listing_deposit` ×2，**贷方 = `uid=-1`**、**`frozen` 零变动**）/ C1 同族；回执含 `deposit_consumed` / `deposit_credit_uid:'-1'` / `deposit_refundable:false`（真源 = `src/currency-service.ts:433,439,440`）；**注册点仍 53**（本片未增删对外路径）。**金额已改服务端取数 + 下限校验**（`FIX-B` 落地：`currency-service.ts:140-142` 三个 `*_FLOOR` 常量，逐条标 **`TODO: Kevin 定值`** = 占位非经济值）；**低于下限借码 = `LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`**（Zang §5.84 ① 裁定，本册正式化进 §3.2/§4.4）。**Zang §5.82 四项裁定逐条折入**：**7-15 定案**（`DL38` 以 **读法①「旧查询函数调用数 = 0」** 为准 + 三条补强：具名函数清单 / 同核 5 组端点 200·404·410 / 类级扫描）、**7-16 定案**（**采纳 (A) 删除**自拟 `FEE_RATE_KEY_PATTERNS`；真源唯一改由**读取侧纪律**保证；登记「`app_config` 合法键清单/写入门禁」为**批 6 配置面规格**）、**7-23 定案**（机制已落地、**数值待 Kevin**）。**401/403 取证口径精化**（Zang §5.84 ③）：本仓**不落 access log** ⇒ 正解 = **响应体（`R107` + `reason`）+ 零分录**取证 + 显式 **`NOT_MEASURED`**（**禁把「查不到」当「无异常」**）。
> **★★ v0.3 本单要点（历史，仍在册）**：**v0.2 §7-3 的「保证金 = 冻结可退」是错误推断**（v0.2 采信的是 `HOLD_KINDS` 那一侧），**由 Zang §5.81 纠正**（`docs/seafood.master-plan.md:1435`）。**最终裁定 = `listing_deposit` 上市即消耗 → 贷 `uid = -1`（不可退、无退还 kind、无罚没）**。**真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时漏删）⇒ 代码里「同一 kind 两种口径并存」。**FIX-A 已落盘**：① `migrations/0019_listing_deposit_platform_credit.sql`（167 行；**加法式**扩展 DB 侧 `-1` credit 白名单；**kind 关闭集仍 20**）；② `src/ledger.ts` 手术：`HOLD_KINDS` 现 = `['hold','hold_release','job_escrow','job_escrow_refund']`（**`:178`** 现取，已移除 `listing_deposit`）；③ `ledger.spec` v0.13 已回写。**FIX-B 亦已落地**（见上「v0.4 要点」）。
> **★★ v0.3 本单要点（原始措辞 · 留痕；其中「FIX-A 报告行数 / 占位」与「FIX-B 状态」已由 v0.4 更新，**以 v0.4 要点与 §1.7 为准**）**：**v0.2 §7-3 的「保证金 = 冻结可退」是错误推断**（v0.2 采信的是 `HOLD_KINDS` 那一侧），**由 Zang §5.81 纠正**（`docs/seafood.master-plan.md:1390-1399`）。**最终裁定 = `listing_deposit` 上市即消耗 → 贷 `uid = -1`（不可退、无退还 kind、无罚没）**。**真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时漏删）⇒ 代码里「同一 kind 两种口径并存」。**FIX-A 已落盘（v0.3 收尾时现取核实）**：① 新增迁移 `backend-ts/migrations/0019_listing_deposit_platform_credit.sql`（167 行；**加法式**扩展 DB 侧 `-1` credit 白名单，`CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation`，其余每格逐字不变；**kind 关闭集仍 20**）；② `backend-ts/src/ledger.ts` 手术：`HOLD_KINDS` 现 = `['hold','hold_release','job_escrow','job_escrow_refund']`（**`:178`**，已移除 `listing_deposit`）、`-1` credit 白名单已加 `listing_deposit`；③ **迁移已应用**：`GET /health` 自报 **`schema_version=0019`**（`2026-09-29T17:44:45Z`）；④ 交付件 `docs/audit/p4-b3a-fix-ledger-whitelist.md`（**v0.4 复核：198 行、§0–§7 全在、无「待回写」占位** —— Zang §5.82 查盘结论）+ 产物 `backend-ts/.p4-artifacts/b3afix-20260930T014132/{b3afix-00-probe.json,b3afix-01-verify.json}`。**FIX-B 已落地**（v0.4：C2 消耗入 `-1` + 金额服务端取数；见 v0.4 要点 / **§1.7**）。

## §0 元信息与口径

| 项 | 值 |
|---|---|
| 版本 | **v0.5**（2026-09-30 CST / UTC+08:00；v0.4 = 同日）；v0.3 = v0.2 = 2026-09-30；v0.1 = 2026-09-29 |
| 仓库 | `/Users/kevin/bistro/seafood`（后端 `backend-ts`，前端 `frontend`） |
| 服务 | `seafood-api`（端口 5788，cwd `backend-ts`）；前端 Vite 5787 |
| 库 | Neon PostgreSQL 18.6，`public` schema；**批 3a 真收官现取**：`/health` 自报 **`schema_version=0020`**、`schema_migration` = **19**（`0018` 无文件、**勿补**）；**★ v0.5（批 3b）**：**未新增迁移**（`migrations/` 文件数仍 **19**）⇒ `schema_version` 仍 **0020** |
| 本单性质 | **纯规范写作（v0.5 · 批 3b 折入单）**：只写 `docs/route-layer.spec.md`（就地升 **v0.5**）+ 快照 `docs/versions/route-layer.spec.v0.5.md` + 审计件 `docs/audit/route-layer-v0.5-delta.md`。**本单未写 `docs/data-layer.spec.md` / `docs/ledger.spec.md`，未建任何 data-layer 快照**（本轮无 data-layer 规则变更；判定理由见 §8.7.1）。**零代码改动（`backend-ts/**` 只读）、零库写、零库连接、无 git 写操作、未跑任何服务/套件** |
| 端点锚口径 | 对 `backend-ts/src/index.ts` 用 `app\.(get\|post\|put\|delete\|patch)\(` 匹配（每个注册点 = 1 端点）。**批 2 口径 = 51 个**（GET 25 / POST 24 / DELETE 2，无 PUT/PATCH；三片实测复算一致：`p4-b2a-http.md:29`、`p4-b2b-listing-write.md:96`、`p4-b2c-admin-write.md:98`）。**★ 批 3（v0.3 立、v0.4 复核）：51 → 53** —— 新增 `POST /api/currency`、`POST /api/currency/:cid/list`（`backend-ts/src/index.ts:1160/1179`）；**批 3a 真收官复核** = `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` 仍 = **53**（FIX-A / FIX-B / FIX-RS 全程**未增删对外路径**）⇒ **批 3 起不再有「51 冻结」**（Zang §5.80 D 片逐字：「本片允许注册新路径（积分交易所是核心功能）但**须显式报 51 → N**」）。**★ v0.5 现取复核（批 3b 末态）**：按本行命令 `grep` ⇒ **仍 = 53**（批 3b **只改接既有路由、未增删对外路径**；`src/index.ts` 现 **1216 行**）⇒ **注册点 53 → 53**；**★ 行号漂移登记（v0.5 现取 vs v0.4 记载）**：`POST /api/currency` `:1160 → **:1166**`、`POST /api/currency/:cid/list` `:1179 → **:1185**`（批 3b 改接 verify 区使其后行号整体下移）⇒ **§1.5 的行号口径由「三分」升为「四分」**（v0.1 live / 批 2 末态 / 批 3a 末态 / **批 3b 末态**），**任何逐行断言前必须现取** |
| 册内批次 | **批 1** = GET 面止血（已完成）；**批 2** = 2a 招工 / 2a-HTTP 鉴权闭合 / 2b 商品 / 2c 权限・设置（已完成）；**批 3** = 资金编排（**批 3a 币种面 = 真收官**：`0019`/`0020` 已应用 + `ledger.ts` 手术 + C1/C2 正确入账 + 金额服务端下限 + FIX-RS 重置键修复，见 §1.6；**批 3b = 招工资金 · 已交付**（Zang §5.85 A 定名；产物 tag = `p4-b3c`，见 §1.9）—— `src/job-funds-service.ts` 新建 + `database.ts` +3 method + `POST /api/tasklist/:jID/verify` 改接 + DL86 两形态实测；**批 3c/3d 待**）；**批 4** = 路径切换 + 前端迁移；**批 6** = 权限种子迁移 + `isAdminAddress` 收敛（见 §6.5） |

### 0.1 权威输入清单（本册的一切结论只能来自这八处）

| # | 输入 | 版本 / 规模 | 用途 |
|---|---|---|---|
| I1 | `docs/data-layer.spec.md` | **v0.6 →（本单追加式加注 ⇒ v0.7）**；改前 = **v0.6**（**实测 1011 行 / 265649 B / md5 `7b86b8119bea359327b5c9d616ca3505`**，快照 `docs/versions/data-layer.spec.v0.6.md` **本单新建**） | 规则号 `DL1..DL157`：`DL20`/`DL35`/`DL36`/`DL38`/`DL67`/`DL71`/`DL72`/`DL75`/`DL78`/`DL84`/`DL85`/`DL88`/`DL91`/`DL93..DL95`/`DL99`/`DL104`/`DL105`/`DL119`/`DL122`/`DL124`/`DL125`/`DL126`/`DL140`/`DL141..DL144`/`DL147`/`DL151`/`DL155..DL157` |
| I2 | `docs/ledger.spec.md` | **v0.13**（v0.3 单就地升版；`R1..R109` **编号不动**）；改前 = **v0.12**（2010 行 / md5 `8ffb5fd5b711731ea65c317f18ec0f0d`，快照 `docs/versions/ledger.spec.v0.12.md`） | `R28`/`R31`/`R33`/`R40`/`R47`/`R51`/`R52`/`R79`/`R101`/`R103`/`R104..R109` |
| I3 | `docs/commission.spec.md` | **v0.2**（经 `backend-ts/src/commission.ts:5-7` 引用） | 十级返佣：`CR*` / §5.3 顺序铁律 / §6.2 最大余数法 / §13 借码 |
| I4 | `migrations/0001..0017` + **`0019`/`0020`**（`backend-ts/migrations/`） | **已应用**：`/health` ⇒ **`0020`**、`schema_migration` = **19**（**`0018` 无文件、勿补**）；`0019_listing_deposit_platform_credit.sql`（**167 行**，加法式扩展 DB 侧 `-1` credit 白名单；sha256 `48a9a4e2…`）+ `0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（**1115 行**，函数体 IN 列表摘除 `listing_deposit`、**仅删 18 字节**；sha256 `228127d8…`）；交付件 `docs/audit/p4-b3a-fix-ledger-whitelist.md`（198 行）+ `p4-b3a-fix2-ledger-post-event-shape.md`（322 行） | 表 / 状态机白名单 / **四个编排函数**的唯一真源；**★ 批 3a 的 C1/C2 未走编排函数**（迁移冻结 ⇒ 用**单语句 CTE** = 一个隐式事务，见 `p4-b3a-currency-funds.md §3.2`） |
| I5 | `docs/audit/p4-route-inventory.md`（296 行）+ `docs/audit/p4-b1-get-triage.md`（750 行） | 已定案，直接引用 | 路由现状 / 关系映射 / 批 1 读侧换表读数与 key 集夹具 |
| I6 | `backend-ts/src/{index.ts,database.ts,ledger.ts,commission.ts,ledger-errors.ts,db.ts,job-service.ts,listing-service.ts,admin-service.ts,**currency-service.ts**,**job-funds-service.ts**}` | 工作树当前态（批 3a 末态） | 端点行号 / mapper 键集来源 / 错误码表（33 码）/ 幂等与金额工具 / **批 2/批 3a 新增 service** |
| **I7（v0.2 新增）** | **批 1 / 批 2 审计四件**：`p4-b2a-job-write.md`（213 行）/ `p4-b2a-http.md`（148 行）/ `p4-b2b-listing-write.md`（271 行）/ `p4-b2c-admin-write.md`（283 行） + **Zang 裁定** `docs/seafood.master-plan.md` §5.73 / §5.74 / §5.76 / §5.77 / §5.78 | 已定案 | v0.2 全部 delta 的**实测依据**（HTTP 状态 + 库侧 `COUNT(*)`/dump hash）与**裁定依据** |
| **I8（v0.3 新增 · v0.4 扩充）** | **批 3a 审计四件**：`p4-b3a-currency-funds.md`（251 行）+ **`p4-b3a-fix-ledger-whitelist.md`**（198 行）+ **`p4-b3a-fix2-ledger-post-event-shape.md`**（322 行）+ **`p4-b3b-currency-funds-fix.md`**（225 行 / sha256 `dfbff4ac…`）+ **Zang 裁定** `docs/seafood.master-plan.md` **§5.80**（切片 + 资金不变量 + token 新口径）/**§5.81**（**重大勘误：§5.80 对 §7-3 的批准作废**）/**§5.82**（FIX-A 验收 + 授权 `0020` + **裁定 7-15/7-16/7-23**）/**§5.83**（`0020` 验收）/**§5.84**（**FIX-B 验收 + 三裁定：借码 / 期望变更 / 401 无 access log 的取证口径**） | 已定案 | v0.4 全部 delta 的**实测依据**（注册点 53 / C2 4 腿全 `balance` / 金额下限 / 24 例 HTTP 读数 / Σ 与 `ledger_entry` 不变量）与**裁定依据** |
| **I9（v0.5 新增）** | **批 3b 审计件**：`docs/audit/p4-b3c-job-funds.md`（**263 行 / sha256 `5a17fe1c…` / 9 节**）+ 产物 `backend-ts/.p4-artifacts/b3c-20260930T021741/**`（`b3c-01-snapshot-pre.json`/`-post.json`/`post/e2e.json`/`post/b3c-03-chain.json`/`frontend-api-paths.txt`）+ 探针 `scripts/p4z-b3c-0{1,2,3}-*.ts`；**Zang §5.85**（批 3b 验收 + **三项裁定** + ★ 新纪律「已实现未注册清单」） | 已定案 | v0.5 全部 delta 的**实测依据**（8 条未注册清单 / 两条行为 delta / DL86 两形态 / `Σtotal` 第三次复算 / 注册点 53→53）与**裁定依据** |
| **I10（v0.5 新增）** | **AUD-JOBKEY 审计件**：`docs/audit/p4-aud-jobkey.md`（**246 行 / 6 节**；HEAD `8f2974c`）+ 产物 `backend-ts/.p4-artifacts/audjk-20260929T182652Z/**`（`results.json` / `before-counts.json` / `after-counts.json` / `fixture-ledger.json` / `probe.log`）+ 探针 `scripts/p4z-audjk-01-probe.ts`；**派单依据 = Zang §5.85 裁定③（FIX-JOBKEY）** | 已落盘（**本单现取**） | §7-25 的**实测依据**（2a 派生键单射 / T1–T4 / A1–A3 / 前端零键取证 / `POST /api/job/12/apply ⇒ 404`）——**注意：该报告自述「只取证不裁决」，其 §4 三选项不构成裁定** |

### 0.2 口径约定（全册生效）

1. **引用规则**：凡引用代码 / 端点 / 函数 / 规则，**必须给 `文件:行号`**；凡引用迁移，给 `migrations/<file>:行号` 或 `docs/audit/*` 节号。
2. **实测 vs 推断**：本册所有「实测」均可由产物 `grep` 到支撑读数（§0.3 清单）；无支撑读数的一律标 **推断** 并给依据；`NOT_MEASURED`（未测）一律**不得**当 0/空使用。
3. **保留字 / 带引号对象必须加引号**：真表名是 `users`（`migrations/0006_user_to_users.sql:75/127` 由 `"user"` 改名而来）；裸 `user` 会被解析成 `current_user` 而**静默不报错**。
4. **新数据层所有 SQL 显式限定 `public.`**（`DL151`；`public.account` 7 列 vs `neon_auth.account` 13 列）。
5. **退出码不得取自管道之后**（§5.7 ②）；本机**无 `timeout`/`gtimeout`**（§5.7 ③）；读数异常**先怀疑自己的探针**（§5.7 ④）。
6. **安全红线**：本仓**绝对禁止** `pkill -f <模糊词>` / `killall <名>`；只按精确 PID kill。
7. **`500` 类码只能由不变式被破坏触发且必须告警**（`DL126` / `R108`）；业务状态机非法转移一律 `409` + 借码（`DL119` / C5）。
8. **凡涉钱**必须写清「谁出钱 / 谁收钱 / 平台费与佣金的来源与分配」——本册 §4 每条业务事件强制四栏。
9. **（v0.2 新增）行号口径三分**：本册 §1 的端点行号 = **v0.1 时点 live 行号（批 2 改动前）**；批 2 后 `src/index.ts` 已漂移（b2c 末态 `1087` 行），**复核必须现取**（`grep -nE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts`）⇒ 对照见 **§1.5**。**四处**行号（inventory 基线 / v0.1 live / 批 2 末态 live / **批 3b 末态 live**）**必须注明口径**，否则出现伪矛盾（**v0.5 由三分升为四分**；批 3b 末态的现取读数见 §0 端点锚口径行）。

### 0.3 「实测」的支撑读数清单（本册可 grep 到的读数）

| 读数 | 支撑 | 取值 |
|---|---|---|
| 端点数 = 51（批 2 全期不变） | 三片补丁器断言 + 独立复算 `grep -cE '^app\.(get\|post\|put\|delete\|patch)\('` | `p4-b2a-http.md:29` / `p4-b2b-listing-write.md:96` / `p4-b2c-admin-write.md:98` |
| 前言「51 端点」的**行号漂移** | 本册 §1 行号（v0.1 live） vs `p4-route-inventory.md:34-84`（B1 前基线） vs §1.5（批 2 末态） | 例：`POST /api/auth/register` v0.1 = :228（inventory :223）；`GET /api/admin/me` 批 2 末态 = **:709**（v0.1 :718） |
| 前端 `/api` 消费面 | `search_files '/api/' frontend/src` ⇒ **97 行命中 / 23 文件** | 与父单「49 条去重路径 / 23 文件」的**文件数一致** |
| 33 码 + HTTP status | `backend-ts/src/ledger-errors.ts:28-70`（`LEDGER_ERROR_TABLE`） | §3 逐码引用 |
| `401`/`403` 非账本域码（**已落地**） | `p4-b2c-admin-write.md §2`（IX2/IX3）+ `§3.1 T05/T06/T19/T25/T27` + `§4.2-3` | `AUTH_UNAUTHORIZED`/`AUTH_FORBIDDEN` + `details.reason`；`src/index.ts` `requireActor`/`requireAdmin` |
| 批 2 的 13 个 `410` 面（**实测 + `sunset`**） | `p4-b2a-job-write.md §3.1:91-93`、`p4-b2b-listing-write.md §3.1:116-119`、`p4-b2c-admin-write.md §3.1 T13/T14/T33-T39` | 见 §1.4 |
| 后台三处边界裁定 | `docs/data-layer.spec.md:343`（C3） | `/api/admin/prize/*` 删除、`settings/reset` 删除、`points/adjust` 保留但锁死 |
| 四柱 kind 白名单 | `migrations/0013_job.sql:9,375-397`、`0015_listing.sql:11-15,643-649`、`0016_market.sql:14-18,589-686` | §4 逐事件 |
| 零资金不变量（批 2a/2b/2c 三片） | `p4-b2a-job-write.md §3.5`、`p4-b2b-listing-write.md §3.4`、`p4-b2c-admin-write.md §3.3` | `ledger_entry` **0→0**；`account`/`currency` 全行 dump hash 不变 |
| **批 3a 注册点 53**（v0.3 新增 · **实测**） | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` = 53 | `docs/audit/p4-b3a-currency-funds.md §0:13,§8:236`（新增 `POST /api/currency`、`POST /api/currency/:cid/list`） |
| **批 3a 资金不变量**（v0.3 新增 · **实测**） | Σ(balance+frozen)（全账户含 `0/-1/-2/-3`）pre→post 变化量 == 净铸/销额度；`ledger_entry` 增量 == 事件数×分录条数 | `p4-b3a-currency-funds.md §5.1-§5.4`（run2 `b3a-20260930T013647`：Σ 1,000,000→2,000,000 全归 fixture mint；`ledger_entry` 9→18 = 1+2+4+2） |
| **C1/C2 幂等键形态**（v0.3 新增 · **实测**） | 调用方键优先、缺省**确定性派生** `biz:currency:create:<symbol>` / `biz:currency:list:<cid>` | `backend-ts/src/currency-service.ts:82,193,299`；`p4-b3a-currency-funds.md §3.3,§5.5` |
| **两迁移已应用**（v0.4 新增 · **实测**） | `migrations/0019_listing_deposit_platform_credit.sql`（167 行）+ `0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（1115 行，函数体 IN 列表摘除 `listing_deposit`）；`/health` 自报 **`schema_version=0020`**、`schema_migration` = **19** | `p4-b3a-fix-ledger-whitelist.md`；`p4-b3a-fix2-ledger-post-event-shape.md`；`p4-b3b-currency-funds-fix.md §1.1,§6`；Zang §5.82/§5.83 |
| **C2 最终入账形状**（v0.4 新增 · **实测**） | C2 成功事件 = **4 腿全在 `balance`**（`currency_create_fee` ×2 + `listing_deposit` ×2）；保证金两腿 = owner `balance −d` / **`uid=-1` `balance +d`**；**`frozen` 零变动**；回执 `deposit_consumed` / `deposit_credit_uid:'-1'` / `deposit_refundable:false`；ΔΣ=0、Δ审计行 +1 | `p4-b3b-currency-funds-fix.md §4.3`（`b3b-03-legs.json` 逐腿）；真源 = `src/currency-service.ts:433,439,440` + `src/database.ts` `listCurrencyWithDeposit`；Zang §5.84 |
| **金额下限 + 借码**（v0.4 新增 · **实测**） | 未传金额 ⇒ **服务端常量**（`fee_source=server_default`）；低于下限 ⇒ **400 `LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`**（`{field,value,min}`）；常量 = `currency-service.ts:140-142`（`1000`/`1000`/`1000`）逐条标 **`TODO: Kevin 定值`**（占位非经济值） | `p4-b3b-currency-funds-fix.md §3,§5`（C1-T05/T12、C2-T16/T17/T23）；Zang §5.82 7-23 + §5.84 ① |
| **401/403 的取证口径**（v0.4 新增 · **实测边界**） | 本仓**不落请求级 access log**（`panel-logs-after.json` 1199 行内 `/api/currency` = 0 行、`403` = 0 行）⇒ **服务端日志逐条归因 = `NOT_MEASURED`**；替代取证 = **响应体（`R107` `code` + `details.reason`）+ 事件键下零分录** | `p4-b3b-currency-funds-fix.md §5.1`（1199 行窗口）；**Zang §5.84 ③**；结构性前提 = P4-SEC 后 `resolveActor` 已把 infra 分类为 **503** |
| **批 3b 注册点 53→53**（v0.5 新增 · **实测**） | 按 §0 端点锚口径命令 `grep` ⇒ **53 行**（批 3b 只改接既有路由）；`src/index.ts` 现 **1216 行**；`POST /api/tasklist/:jID/verify` 现取 **:1061** | `p4-b3c-job-funds.md §1.3`；**Zang §5.85 A ⑤**；本册现取 |
| **批 3b 已实现·未注册 = 8 条 + 1 附注**（v0.5 新增 · **实测**） | 五个服务编排文件导出 × `src/index.ts` 调用点逐 verb 核对（`\b<verb>\b` 命中 0 ⇒ 未接线）；7 个已接线 verb 作正向对照 | **§1.8**（含扫描命令与负向排除）；依据 = **Zang §5.85 裁定①** |
| **`ledger_entry` 42 → 76（Δ34 枚举等式闭合）**（v0.5 新增 · **实测**） | `job_escrow` 10 / `job_escrow_refund` 4 / `job_payout` 6 / `job_fee` 6 / `commission` 4 / `transfer`（夹具）4 ⇒ 4+10+4+6+6+4 = **34** ✅；`Σtotal` **2,000,000** 第三次独立复算、逐位相同 | `p4-b3c-job-funds.md §3,§5`；**Zang §5.85 A ①/②** |

## §1 端点处置表（51 个注册点 · 逐条）

**锚口径**：`app.<verb>(` 注册点 = 1 端点；**行号 = v0.1 时点 live 行号**（`backend-ts/src/index.ts`，批 2 改动前；批 2 末态对照见 §1.5）。处置词表：

- **【保留·改接】** 保留路径，查询/写入改接新 schema（对外**键集不得变**，见 §2）
- **【保留·改语义】** 保留路径，语义/状态码按本册改（明示）
- **【弃用→410】** 保留路径，一律 `410` + `R107` 形状错误体（`DL35` 的过渡条，**必须登记过期日**）
- **【弃用→空态】** 保留路径，`200` + 空态 + 顶层 `deprecated:true`（读口专用，已由 B1-c 落地）
- **【删除】** 路径下线（走 §1.3 的 404 兜底）
- **【不动】** 无库依赖或经判定不动

| # | 端点（`index.ts:行号`） | 处置 | 目标表与字段映射 | 依据 |
|--:|---|---|---|---|
| 1 | `GET /` **:180** | **【不动】** | —（纯内存；:186-187 的 `prizes/tasks` 是**键名文案**，非 SQL） | `p4-b1-get-triage.md:485`（B-c1 第 14 条） |
| 2 | `GET /health` **:200** | **【保留·改接】** | `schema_migration` → **`public.schema_migration`**（`DL155`；**已闭合**，见 §7-11） | `DL155`（`docs/data-layer.spec.md:1011`）；`backend-ts/src/db.ts:252` |
| 3 | `GET /api/test/data` **:217** | **【不动】** | —（纯内存调试） | 现状实测 `200`（`p4-route-inventory.md:173`） |
| 4 | `POST /api/auth/register` **:228** | **【弃用→410】** | —（形状对齐 `R107`，**批 2 未实测** ⇒ 见 §1.4 注） | §4.1 #9–#10 口径 + `DL35`（`data-layer.spec.md:325`） |
| 5 | `POST /api/auth/challenge` **:232** | **【保留·改接】** | `auth.ts:startWalletAuthChallenge`（无库） | `p4-route-inventory.md:38` |
| 6 | `POST /api/auth/verify` **:241** | **【保留·改接】** | `users`（`uid/evm`）+ `account(cid=1)`；**首次发币 = 资金 ⇒ 批 3** | `DL107`（钱包签名登录）；`migrations/0002_user_identity.sql:15` |
| 7 | `POST /api/auth/login` **:264** | **【弃用→410】** | —（现状为 `req.url` 改写转发到 verify ⇒ **必须拆掉双路径**） | §4.1 #10「**删除 `login`**，只留 `verify`」（`data-layer.spec.md:248`） |
| 8 | `GET /api/prize/all` **:269** | **【保留·改接】** | `prize`→**`listing`**（`listing_id→bID`、`title→name`、`price→points`；聚合列恒 0） | B1-c（`p4-b1-get-triage.md:469-471,503-517`）；`migrations/0015_listing.sql:115` |
| 9 | `GET /api/task/all` **:281** | **【保留·改接】** | `task`→**`job`**（`job_id→tID`、`reward→points`、`description→note`）；参与者 = `job_application` 计数 | B1-b（`p4-b1-get-triage.md:315-316,361-374`）；`migrations/0013_job.sql:79` |
| 10 | `GET /api/task/:tID` **:293** | **【保留·改语义】** | `job`（同上） | **detail-miss ⇒ `404`（撤销 B1-b 的 200 空态）**，**批 2a 已落地**（`p4-b2a-job-write.md §3.1:89` 实测 `404` + `R107`）；见 §3.1 / §1.4 |
| 11 | `GET /api/prize/:bID` **:311** | **【保留·改接】** | `listing`（同上）；miss ⇒ `404`（**批 2b 回归实测** `404`） | B1-c（`p4-b1-get-triage.md:573`）；`p4-b2b-listing-write.md §3.1:110` |
| 12 | `GET /api/user` **:331** | **【保留·改接】** | `users` + `account`（派生余额） | `DL24` 要求带 `cid` 集合 ⇒ **与前端键集冻结冲突，已裁 §7-2** |
| 13 | `POST /api/user/profile` **:344** | **【保留·改接】** | `users.bio`（列名大小写修复，**批 2a-HTTP 已落**） | §4.1 #16（`data-layer.spec.md:254`）；`p4-b2a-http.md §1` |
| 14 | `GET /api/user/asset/:uID` **:367** | **【保留·改接】** | `asset`→**`account`**(`WHERE uid=$1 AND cid=1`)；**纯读**（删 `upsertAsset` 副作用） | B1-a（`p4-b1-get-triage.md:260-263`）；`DL32`/§4.1 #17 |
| 15 | `GET /api/home` **:383** | **【保留·改接】** | `job` + `listing` + `account`（四路并行读，**纯读**） | `DL39`（禁写副作用）；B1-c 锚点（`p4-b1-get-triage.md:49`） |
| 16 | `GET /api/prize-item` **:420** | **【保留·正式化】** | `prize_item`→**`listing_order`**（`order_id→gID`、`listing_id→bID`、`buyer_uid→uID`、谓词 `status='paid'`） | B1-c（`p4-b1-get-triage.md:474,519-530`）；**本册裁定：不再标 `deprecated`**（它有真实语义）——**批 2b 实测该端点本已无 `deprecated`**（`p4-b2b-listing-write.md §1.3-3,§3.1:114`）⇒ **本项 = 已满足（无需改码）** |
| 17 | `GET /api/task-progress` **:434** | **【保留·改接】** | `task_progress`→`job_application`（`worker_uid` 轴） | B1-b（`p4-b1-get-triage.md:318`） |
| 18 | `GET /api/task-progress/:jID` **:448** | **【保留·改接】** | `job_application` + `LATERAL` 最新 `job_submission`；miss ⇒ `404` | B1-b（`p4-b1-get-triage.md:317`）；§3.1 |
| 19 | `POST /api/task-progress/:identifier/submit` **:467** | **【保留·改接】** | `job_submission`（`create_key` 幂等；`review_status='pending'`）+ `job.status→'submitted'`；**无分录** | `DL99`/`DL56`（`migrations/0014_job_flow.sql:115-133`）；**批 2a-HTTP 已端到端落地**（`p4-b2a-http.md §3.1 B3-B7`：首投 200、同键重投 200 `idempotent_replay:true` 不多行、403/404/409） |
| 20 | `POST /api/task-progress/claim/:jID` **:505** | **【保留·改语义】** | 拆分 `apply`（无分录）/`accept`（无分录）/`settle`（**有分录**） | §4.1 #23（`data-layer.spec.md:261`）；**资金 ⇒ 批 3**；`apply`/`accept` 的 service 半边已交付（§1.1） |
| 21 | `GET /api/shard` **:557** | **【弃用→空态】** | 无对应表（持仓 = `account`） | B1-c（`p4-b1-get-triage.md:538`）；`DL69` |
| 22 | `GET /api/shard/transfer` **:572** | **【弃用→空态】** | 无对应表（转让 = `ledger_entry` 派生） | B1-c（`p4-b1-get-triage.md:539`）；§4.1 #25 |
| 23 | `POST /api/shard/redeem` **:587** | **【弃用→410】** | —（写动作，**不得**用空态 200 冒充成功） | §4.1 #26 **驳回**（`data-layer.spec.md:264`）；**批 2b 已落地**（`p4-b2b-listing-write.md §3.1:117`） |
| 24 | `POST /api/chest/:bID/open` **:605** | **【弃用→410】** | —（凭空调入余额，与 `DL5` 冲突） | §4.1 #27 **驳回**（`data-layer.spec.md:265`）；**批 2b 已落地**（`p4-b2b-listing-write.md §3.1:118`） |
| 25 | `GET /api/order` **:623** | **【保留·改接】** | `market_order`（列名已重写：`owner_uid`/`base_cid`/`amount`/`amount_filled`） | B1-d（`p4-b1-get-triage.md:631,649-659`） |
| 26 | `POST /api/order` **:637** | **【保留·改接】** | `market_post_event(op='order')` ⇒ `hold` ×2 | `migrations/0016_market.sql:589-616`；**资金 ⇒ 批 3** |
| 27 | `DELETE /api/order` **:656** | **【保留·改语义】** | 全撤 ⇒ `op='cancel'`（逐单）；**入参一律走 query，不得读 body** | §4.1 #30 理由（`data-layer.spec.md:268`）+ 前端消费 `frontend/src/pages/ShardPage.jsx:328-329` ⇒ **保留路径，改造入参**（已裁 §7-5） |
| 28 | `DELETE /api/order/:oID` **:669** | **【保留·改接】** | `market_post_event(op='cancel')` ⇒ `hold_release` ×2 | `migrations/0016_market.sql:667-685`；**资金 ⇒ 批 3** |
| 29 | `GET /api/market/:bID/orderbook` **:687** | **【保留·改接】** | `market_order` 聚合（`SUM(amount-amount_filled)`） | B1-d 锚点（`p4-b1-get-triage.md:65`） |
| 30 | `GET /api/market/:bID/trades` **:702** | **【保留·改接】** | `market_trade` + `LEFT JOIN market_order` 合成 `buyer_uID/seller_uID` | B1-d（`p4-b1-get-triage.md:630`） |
| 31 | `GET /api/admin/me` **:718** | **【保留·改接】** | `users.is_admin` + `admin_user_role` ⇒ `permissions[]` | §4.1 #34（`data-layer.spec.md:272`）；**批 2c 已落地 + 保留 6 键**（§6.4 / §1.4） |
| 32 | `GET /api/admin/settings` **:724** | **【保留·改接】** | `app_config`（key/value，**无 privacy 列**）；**响应必须在 `message` 标注「费率不在本表」**（**不改 data 键集**） | §4.1 #35（`data-layer.spec.md:273`）；`migrations/0017_platform_config.sql:69`；**批 2c 已落地**（`p4-b2c-admin-write.md §3.1 T04`） |
| 33 | `POST /api/admin/settings` **:737** | **【保留·改接】** | `app_config` upsert（**补 `updated_by`**）；`ops:<admin_uid>:<action>:<key>` 键（**请求侧强校验、不落库**，见 §4.5/§7-14）；**禁写费率键** | `DL36`（`data-layer.spec.md:326`）；CR23/CR25；**批 2c 已落地**（T08/T09/T11） |
| 34 | `POST /api/admin/settings/reset` **:750** | **【弃用→410】** | — | **C3 ② 裁定删除**（`data-layer.spec.md:343`）；**批 2c 已落地**（`p4-b2c-admin-write.md §3.1 T13/T14`） |
| 35 | `GET /api/admin/permissions` **:763** | **【保留·改接】** | `permission_group`→`admin_role*` 三表；**撤销 B1-c 打的 `deprecated`**（**批 2c 已落**） | B1-c（`p4-b1-get-triage.md:477,548`）；`migrations/0017_platform_config.sql:93-132`；`p4-b2c-admin-write.md §3.1 T15` |
| 36 | `POST /api/admin/permissions/save` **:779** | **【保留·改接】** | `admin_role`/`admin_role_permission`；`ops:` 键 + **自锁守卫** + `admin_permission` 存在性前置闸 | §4.1 #39（`data-layer.spec.md:277`）；**批 2c 已落地**（T16/T17） |
| 37 | `POST /api/admin/permissions/delete` **:800** | **【保留·改接】** | 同上；**必须校验该角色下无在用用户** | §4.1 #40（`data-layer.spec.md:278`）；**批 2c 已落地**（T18/T19） |
| 38 | `POST /api/admin/user/update` **:821** | **【保留·改接】** | `users.is_admin`/`users.bio`/`admin_user_role`；**禁 `evm`/`uid`/任何余额字段**（⇒ `400`） | `DL16`/`DL104`/§4.1 #41（`data-layer.spec.md:279`）；**批 2c 已落地**（T20–T23） |
| 39 | `POST /api/admin/task/create` **:842** | **【弃用→410】** | —（管理员不再发布招工） | §4.1 #42 **采纳删除**（`data-layer.spec.md:280`）+ 用户需求③；**批 2a 已落地**（`p4-b2a-job-write.md §3.1:91`） |
| 40 | `POST /api/admin/task/update` **:855** | **【弃用→410】** | — | §4.1 #43（`data-layer.spec.md:281`）；**批 2a 已落地**（`:92`） |
| 41 | `POST /api/admin/task/delete` **:876** | **【弃用→410】** | — | §4.1 #44（`data-layer.spec.md:282`）；**批 2a 已落地**（`:93`） |
| 42 | `POST /api/admin/prize/create` **:894** | **【弃用→410】** | — | **C3 ① 裁定删除**（`data-layer.spec.md:343`）；**批 2b 已落地**（`p4-b2b-listing-write.md §3.1:116`） |
| 43 | `POST /api/admin/prize/update` **:907** | **【弃用→410】** | — | C3 ①（`data-layer.spec.md:343`）；批 2b 已落地（同上） |
| 44 | `POST /api/admin/prize/delete` **:928** | **【弃用→410】** | —（合规下架另立 P6 `/api/admin/listing/:id/takedown`） | C3 ① + §4.1 #47（`data-layer.spec.md:285`）；批 2b 已落地（同上） |
| 45 | `GET /api/user/all` **:946** | **【保留·改接】** | `public."users"`（**必须分页 + 只出非敏感列**；禁 token）；元素 **6 键** | §4.1 #48（`data-layer.spec.md:286`）；**批 2c 已落地**（T24/T25，`p4-b2c-admin-write.md §3.1 注`） |
| 46 | `GET /api/user/stats` **:960** | **【保留·改接】** | `users` + `account`（**`message` 必须标注「账本派生」**，**不改 data 键集**） | §4.1 #49（`data-layer.spec.md:287`）；**批 2c 已落地**（T26，5 键不变） |
| 47 | `GET /api/tasklist/pending-verification/count` **:973** | **【保留·改语义】** | `job_submission`（`review_status='pending'`）+ `job_application`；**队列归雇主视角** | **C7 裁定**（`data-layer.spec.md:347`）；B1-b 谓词（`p4-b1-get-triage.md:319-320`） |
| 48 | `GET /api/tasklist/pending-verification` **:986** | **【保留·改语义】** | 同上 | C7（`data-layer.spec.md:347`） |
| 49 | `POST /api/tasklist/:jID/verify` **:1000**（**批 3b 末态现取 = `:1061`**） | **【保留·改接】** | `job_submission.review_status` + `job_post_event(op='settle'\|'refund')` | **`approve` = 结算（资金）⇒ 整条端点归批 3**（§4 J5/J6、§4.0 硬口径 R4）；**★ v0.5：批 3b 已改接落地**（服务层 = `job-funds-service.ts:308` `verifyJobSubmission`，经 `database.ts:1723` `reviewJobSubmission` 的**单条 SQL** ⇒ 结论位与资金同语句；**注册点不变**）；**行为 delta**：非数字 `:jID` `400` → **`404`**（§3.1 / §2.4 S9） |
| 50 | `POST /api/admin/assets/init` **:1056** | **【弃用→410】** | —（账户由 DB 按需 0/0 开户；**该端点无 `requireAdmin` 守卫**） | §4.1 #53 **删除**（`data-layer.spec.md:291`）；`R75`；**批 2c 补齐落地**（改前 500 ⇒ `410`；`p4-b2c-admin-write.md §3.1 T39 / §4.2-1`） |
| 51 | `POST /api/admin/points/adjust` **:1066** | **【保留·改接】** | `ledger_post_event(op='mint'\|'burn')`，**仅 `$`(cid=1)**；`ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | **C3 ③**（`data-layer.spec.md:343`）+ §4.1 #54（`:292`）；**资金 ⇒ 批 3** |

**分布（本册机读口径）**：【保留·改接】30 ·【保留·改语义】5 ·【保留·正式化】1 ·【弃用→410】13 ·【弃用→空态】2 ·【不动】3 = **51**（含 1 条同时属保留与改语义者按主处置计一次 ⇒ 以本表逐行为准）。

### 1.1 新增端点（用户需求 + `data-layer.spec.md` §4.1 的「修正」目标态）

> 依据：`docs/data-layer.spec.md:249-293`（§4.1 逐行目标路径）+ 用户需求 1/2/4/5。**新增端点不改变 §1 的 51 条既有路径**（双轨：先别名后切换，见 §5.4）。

| 端点 | 编排 / 服务入口 | 批（v0.2 改标） | 依据 |
|---|---|---|---|
| `POST /api/job`（招工发布+托管） | **★ 服务层已实现（批 3b）：`src/job-funds-service.ts:149` `publishJob` → `database.ts:1662` `jobPostEvent`**；路由层**未注册**（**§1.8 #1**） | **批 3b = 服务层已落地；路由层随批 4** | `migrations/0013_job.sql:431`；§4 J1 |
| `POST /api/job/:jobId/apply` | 直 DML（`job_application`，**无分录**） | **服务层已实现（`src/job-service.ts:175` `applyToJob`）、路由层随批 4 注册**（v0.2 改标；旧标「批 2」= 错；**v0.5 现取行号 + 入清单 §1.8 #2**） | `DL99`；`migrations/0014_job_flow.sql:79`；**实测** `p4-b2a-http.md §3:74`（`POST /api/job/2/apply` ⇒ **404**，路径未注册）+ **裁定 Zang §5.74/§5.76**（「偏差成立，以我的裁定为准」） |
| `POST /api/job/:jobId/accept` | 直 DML（`status='accepted'` + `uniq_job_application_accepted`） | **服务层已实现（`src/job-service.ts:208` `acceptApplication`）、路由层随批 4 注册**（v0.2 改标；**v0.5 现取行号 + 入清单 §1.8 #3 = ★ 集成缺口 F-1，见 §1.9 K11**） | `migrations/0014_job_flow.sql:102`；**实测** `p4-b2a-http.md §3:74`（`/accept` ⇒ **404**）+ 裁定 Zang §5.76 |
| `POST /api/job/:jobId/submit` | 直 DML（`job_submission`） | **服务层已实现（`src/job-service.ts:125` `submitWork`）、路由层随批 4 注册**（**§1.8 #4：功能已由既有 `/api/task-progress/:identifier/submit`〔已注册 `:581`〕承载**）（同族口径：批 2 内一切「§4.1 新路径」= 内部 service，不注册对外） | §4.1 #22（`data-layer.spec.md:260`）；`p4-b2a-job-write.md §1.1 A3`（「本片不注册对外路径」） |
| `POST /api/job/:jobId/review` | `job_post_event(op='settle'\|'refund')`；**★ 服务层已实现（批 3b）：`src/job-funds-service.ts:218` `settleJob` / `:237` `refundJob`，既有 `/api/tasklist/:jID/verify` 已改接** | **批 3b（既有路径已改接；本新路径随批 4 = §1.8 #5）** | §4.1 #52（`data-layer.spec.md:290`）；C7 |
| `POST /api/job/:jobId/cancel` | `job_post_event(op='refund')`；**★ 服务层已实现（批 3b）：`src/job-funds-service.ts:237` `refundJob`** | **批 3b（服务层已落地；路由随批 4 = §1.8 #6）** | `migrations/0013_job.sql:427` |
| `POST /api/listing`（商品上架/编辑/下架） | 直 DML（**无分录**，`create_key` 幂等） | **服务层已实现（`src/listing-service.ts`：`createListing` `:164` / `updateListing` `:222` / `transitionListingStatus` `:286`）、路由层随批 4 注册**（**v0.5 现取行号 + 入清单 §1.8 #7/#8**）（v0.2 改标；旧标「批 2」= 错） | `DL99`/`listing` 表注（`migrations/0015_listing.sql:142-143`）；**实测** `p4-b2b-listing-write.md §3.1:120`（`POST /api/listing` ⇒ **404**）+ **裁定 Zang §5.77**（「批准」） |
| `POST /api/listing/:listingId/buy` | `listing_post_event(op='buy')` | **批 3** | `migrations/0015_listing.sql:449`；§4 P2 |
| `POST /api/listing/order/:orderId/refund` | `listing_post_event(op='refund')` | **批 3** | `migrations/0015_listing.sql:437`；§4 P4 |
| `POST /api/market/order` | `market_post_event(op='order')` | **批 3** | §4.1 #29（`data-layer.spec.md:267`） |
| `DELETE /api/market/order/:orderId` | `market_post_event(op='cancel')` | **批 3** | §4.1 #31（`data-layer.spec.md:269`） |
| `GET /api/market/:baseCid/candles` | `candle_view`（**视图，只读**） | **服务层可选、路由层随批 4 注册**（对外新路径 ⇒ §1.2 母约束） | `DL66`/`DL150`；`migrations/0016_market.sql:200`；`p4-b2c-admin-write.md §1.2:69` |
| `POST /api/referral/bind` | `referral_bind(child,parent)`（**无分录**） | **服务层可选、路由层随批 4 注册** | §4.1（返佣）`data-layer.spec.md:315`；`migrations/0007_referral_and_commission_policy.sql:241`；`p4-b2c-admin-write.md §1.2:69` |
| `GET /api/referral/earnings` | `ledger_entry`（`kind='commission'` 派生，只读） | **路由层随批 4 注册** | `DL2`（只读真源）；`p4-b2c-admin-write.md §1.2:69` |
| `POST /api/admin/commission_policy` | `insertCommissionPolicy`（**插行，无分录**）；**服务层已实现（`backend-ts/src/commission.ts:240`）** | **非本批三片范围（返佣政策面）、路由层随批 4 注册**（**§1.8 附注行**） | `backend-ts/src/commission.ts:240`；CR23/CR25；`p4-b2c-admin-write.md §1.2:68` |
| `GET /api/user/points` / `GET /api/user/ledger` | `account` / `ledger_entry`（只读派生） | **路由层随批 4 注册** | §4.1 #17/#25；`DL24`；`p4-b2c-admin-write.md §1.2:69` |
| `POST /api/currency`（建单位） | **★ 已实现（批 3a）**：`src/currency-service.ts`（`createCurrencyVerb`）+ `DatabaseService.createCurrencyWithFee`（单语句 CTE）；**已注册**（`src/index.ts:1160`） | **批 3a（已落地）** | `p4-b3a-currency-funds.md §1 C1,§3.1`；kind `currency_create_fee`（`ledger.ts:158` / `migrations/0001_ledger_core.sql:13-38`） |
| `POST /api/currency/:cid/list`（上市→收上市费 + 保证金） | **★ 已实现（批 3a）**：`listCurrencyWithDeposit`（单语句 CTE）；**已注册**（`src/index.ts:1179`） | **批 3a（已落地形态）；★ C2 语义待 FIX-B 返工** | **Zang §5.81 最终裁定**：上市费 `currency_create_fee`→`-1`（消耗）+ 保证金 `listing_deposit` = **上市即消耗 → 贷 `uid = -1`**（**不可退、无退还 kind、无罚没**）；**v0.2 旧写法（错，留痕）**：「保证金 = `listing_deposit` 冻结可退 + 罚没 `hold_forfeit`→`-3`，裁定 = Zang §5.73 7-3」⇒ **已由 §5.81 推翻**。依据：`ledger.ts:174-175`（`HOLD_KINDS` 误含 `listing_deposit` = 真根因）vs `:541`（`-1` credit 白名单**当时不含**它）⇒ **FIX-A 已修正两处**：`HOLD_KINDS` `:178` 移除、`-1` credit 加入（**现取核实**） |

### 1.2 与 `docs/data-layer.spec.md` §4.1 的**命名张力**（登记，不推翻）+ 母约束理由（v0.2 补强）

`§4.1` 的目标态把路径改名（`/api/prize/all→GET /api/listing`、`/api/task/all→GET /api/job`、`/api/task/:tID→/api/job/:jobId` …）。而**用户原始需求 + 前端 49 条消费面**要求既有路径**必须保留**（删则前端 404）。二者不冲突，但**必须排期**：

- **批 2 / 批 3：既有路径 = 唯一对外路径**（键集冻结，§2）；`§4.1` 的新命名**只作内部 service 命名与文档口径**，**不新增对外路径**。
- **批 4（前端迁移后）：** 新路径上线为**别名**，旧路径转 **410 + `R107` 形状**（`DL35` 的过渡条），**过期日见 §5.1**（已裁 §7-1）。
- 质检判据：批 2 / 批 3 期间，任何**既有路径**的响应**键集变化** ⇒ 判负（§2）。

**★ v0.2 补强：为什么「批 2 不新增对外路径」= 硬约束（注册点冻结 51）**——理由两条，均由批 2 三片实测与 Zang 裁定支撑：

1. **前端零调用**：`frontend/src` 的 49 条去重路径里**没有** `/api/job/*`、**没有** `POST /api/listing`（`p4-b2a-job-write.md §4.6` 与 `p4-b2b-listing-write.md §1.3-1` 的「前端零调用」口径；§2.2 消费面清单）。⇒ 注册 = 无人消费的空路径，纯增维护面。
2. **冻结口径**：批 2 全程**注册点必须恒为 51**（三片补丁器断言 + 独立复算：`p4-b2a-http.md:29`、`p4-b2b-listing-write.md:96`、`p4-b2c-admin-write.md:98`）。增 1 个注册点即破坏该验收判据。

⇒ 故 `§1.1` 表中标「批 2」的**新增路径**（`/api/job/{apply,accept,submit}`、`POST /api/listing`）**一律以内部 service 交付**（`src/job-service.ts` / `src/listing-service.ts`），**对外路径随批 4 与前端的迁移一并注册**。**依据 = Zang §5.74 / §5.76 / §5.77 裁定**（「偏差成立，以我的裁定为准」；「批准」）。**★ v0.5**：这批「**服务层已交付、路由层未注册**」的路径**已集中登记在 §1.8**（**8 条 + 1 附注**），并成为**每批复核的强制项**（Zang §5.85 裁定① 新纪律）⇒ **§1.8 是本清单的唯一权威**（散落在 §1.1/§4.2/§4.6 的旧记法**以 §1.8 为准**）。

### 1.3 404 兜底（`USE` 兜底）

保留 404 兜底，但**响应形状必须与 `R107` 对齐**（`{error:{code,message,i18n_key,details}}`），**不得回 HTML**；兜底码 = `LEDGER_REF_NOT_FOUND`（`404`）。依据：§4.1 #55（`docs/data-layer.spec.md:293`）。**批 2 实测**：未注册路径（`POST /api/listing`、`POST /api/job/2/apply`）落 **404 `Not found`**（`p4-b2b-listing-write.md §3.1:120-121`）——**注意**：该兜底体在批 2 实测为**裸文案**，**尚未对齐 `R107`**（登记为批 4 收口项）。

### 1.4 批 2 已落地事实（v0.2 新增 · 全部实测）

> 口径：以下均为**批 2 三片的 HTTP 实测读数**（真 token；`GET /health` 200 后开测），**不是**设计意图。支撑锚点逐条给出。

| # | 事实 | 实测读数 | 依据锚点 |
|--:|---|---|---|
| F1 | 鉴权面**已解锁**（`users` 列名映射修复） | `GET /api/user`：无 token **401** / 有 token **200**（键集 8 键不变）；`/api/task-progress` 有 token **200** | `p4-b2a-http.md §1,§2:48-49`；Zang §5.76 亲核 |
| F2 | `POST /api/task-progress/:identifier/submit`（J4）**端到端可用** | 首投 **200**（`job_submission` 0→1、`review_status='pending'`）→ 同键重投 **200 + `idempotent_replay:true`**（**仍 1 行**）；他人 **403**、未知 id **404**、`applied` ⇒ **409 `JOB_APPLICATION_STATE_INVALID`** | `p4-b2a-http.md §3:61-71`；`p4-b2b-listing-write.md §3.1:122-124` |
| F3 | `/api/task/:tID` detail-miss ⇒ **404**（撤销 B1-b 的 200 空态） | `GET /api/task/999999999` ⇒ **404** + `R107`（`ref_type:'job'`） | `p4-b2a-job-write.md §3.1:89` |
| F4 | `/api/prize/:bID` miss ⇒ **404**（现状保持） | `GET /api/prize/999999999` ⇒ **404** | `p4-b2b-listing-write.md §3.1:110`；`p4-b2c-admin-write.md §3.1 T32` |
| F5 | **13 个 `410` 面**（`R107` 形状 + `details.sunset`）**全部落地** | `admin/task/{create,update,delete}` ⇒ **410×3**；`admin/prize/{create,update,delete}` + `shard/redeem` + `chest/:bID/open` ⇒ **410**（无 token / 有 token **均 410**，不伪装 401）；`settings/reset` ⇒ **410**（无 token 亦 410）；`admin/assets/init` ⇒ **410**（**改前 500**） | `p4-b2a-job-write.md §3.1:91-93`；`p4-b2b-listing-write.md §3.1:116-119`；`p4-b2c-admin-write.md §3.1 T13/T14/T33-T39` |
| F6 | `GET /api/prize-item` **正式化（无 `deprecated`）** | 实测顶层**无** `deprecated`（`data: []`）；`grep -n "deprecated" src/index.ts` ⇒ 仅 shard ×2 + 注释 | `p4-b2b-listing-write.md §1.3-3,§3.1:114,§3.6:211`（⇒ **本项已满足，无需改码**） |
| F7 | **`/api/admin/me` 保留 6 键** | 实测 `data` = **6 键**（`uID,EVM,is_admin,permissions,can_access_admin,preferred_admin_path`）；`is_admin=true` ⇒ `permissions` = **11 键全量**；非 admin ⇒ `[]` | `p4-b2c-admin-write.md §3.1 T02/T03,§3.4`；裁定 Zang §5.78 ⑤ |
| F8 | **`GET /api/admin/settings`** 写→读回同值 | `POST`（带 `ops:` 键）⇒ 200（`app_config` 0→1）；读回 `data.siteName="p4b2c:siteA"`；缺 `ops:` 键 ⇒ **400 `LEDGER_IDEMPOTENCY_KEY_REQUIRED`**；带费率键 ⇒ **400 `FEE_RATE_KEY_NOT_IN_APP_CONFIG`** | `p4-b2c-admin-write.md §3.1 T08-T11` |
| F9 | **权限/用户面** 落地 | `permissions/save` 有键 ⇒ **404 `LEDGER_REF_NOT_FOUND`**（`ref_type=admin_permission`，0 行表前置闸，**未落裸 `23503`**）；`user/update` 带 `evm`/`points` ⇒ **400 `FORBIDDEN_FIELD`**；`uID` miss ⇒ **404** | `p4-b2c-admin-write.md §3.1 T17,T21-T23` |
| F10 | **非资金不变量**（批 2 全期） | `ledger_entry` **0→0**；`account` 全行 dump hash 不变；`currency` 全行 dump hash 不变；写入落点仅 `users`/`job`/`job_application`/`job_submission`/`listing`/`app_config` | `p4-b2a-job-write.md §3.5`；`p4-b2b-listing-write.md §3.4`；`p4-b2c-admin-write.md §3.3` |
| F11 | 端点注册点 **51 全线不变** | 三片补丁器断言 + 独立复算 | `p4-b2a-http.md:29`；`p4-b2b-listing-write.md:96`；`p4-b2c-admin-write.md:98` |

> **注（`POST /api/auth/register` 的`410` 形状）**：§1 #4 要求「保留 `410` 但把响应体改为 `R107` 形状」；批 2 三片**均未触及**该端点 ⇒ 其形状对齐状态 = **`NOT_MEASURED`**（登记为批 4 收口项，见 §7-19）。

### 1.5 批 2 后 live 行号对照（v0.2 新增 · 防「同一端点两个行号」的伪矛盾）

> `src/index.ts` 在批 2 三片累计改动后（b2c 末态 **1087** 行）行号已漂移。下表 = **批 2 末态 live 行号**（现取口径 `grep -nE '^app\.(get|post|put|delete|patch)\('`）。**§1 表用 v0.1 行号（批 2 前）**；不复算者不得据此判「行号矛盾」。

| 端点 | v0.1 行号（§1 表） | 批 2 末态 live | 依据 |
|---|---|---|---|
| `GET /api/prize-item` | :420 | **:431** | `p4-b2b-listing-write.md §1.1 L6` |
| `POST /api/task-progress/.../submit` | :467 | **（B2a 改接区）** | `p4-b2a-job-write.md §2` |
| `GET /api/shard` / `/api/shard/transfer` | :557 / :572 | **:579 / :589** | `p4-b2b-listing-write.md §1.2:65` |
| `POST /api/shard/redeem` | :587 | **:596** | `p4-b2b-listing-write.md §1.1 L4` |
| `POST /api/chest/:bID/open` | :605 | **:609** | `p4-b2b-listing-write.md §1.1 L5` |
| `GET /api/admin/me` | :718 | **:709** | `p4-b2c-admin-write.md §1.1 A1` |
| `GET /api/admin/settings` | :724 | **:715** | `p4-b2c-admin-write.md §1.1 A2` |
| `POST /api/admin/settings` | :737 | **:728** | `p4-b2c-admin-write.md §1.1 A3` |
| `POST /api/admin/settings/reset` | :750 | **:741** | `p4-b2c-admin-write.md §1.1 A4` |
| `GET /api/admin/permissions` | :763 | **:754** | `p4-b2c-admin-write.md §1.1 A5` |
| `POST /api/admin/permissions/save` | :779 | **:770** | `p4-b2c-admin-write.md §1.1 A6` |
| `POST /api/admin/permissions/delete` | :800 | **:791** | `p4-b2c-admin-write.md §1.1 A7` |
| `POST /api/admin/user/update` | :821 | **:812** | `p4-b2c-admin-write.md §1.1 A8` |
| `POST /api/admin/prize/create` | :894 | **:875** | `p4-b2b-listing-write.md §1.1 L1` |
| `POST /api/admin/prize/update` | :907 | **:888** | `p4-b2b-listing-write.md §1.1 L2` |
| `POST /api/admin/prize/delete` | :928 | **:909** | `p4-b2b-listing-write.md §1.1 L3` |
| `GET /api/user/all` | :946 | **:875**（注：与 prize/create 同值 = 两表口径不同批，**以现取为准**） | `p4-b2c-admin-write.md §1.1 A9` |
| `GET /api/user/stats` | :960 | **:889** | `p4-b2c-admin-write.md §1.1 A10` |
| `POST /api/admin/assets/init` | :1056 | **:985** | `p4-b2c-admin-write.md §1.1 A12` |
| `POST /api/admin/points/adjust` | :1066 | **:995** | `p4-b2c-admin-write.md §1.2:66` |

> **口径自曝**：上表由两片报告各自的「live 行号」栏拼合；`GET /api/user/all`（b2c 记 :875）与 `POST /api/admin/prize/create`（b2b 记 :875）**同值**系两片在不同中间版本上取值 ⇒ **任何逐行断言前必须现取**，不得用上表做行号相等性判据。

### 1.6 批 3a 已落地事实（v0.3 新增 · 全部实测 · **= FIX-B 前之历史读数，保留不删**）

> 口径：以下均为 P4-B3a 片（批 3 第一片 · **第一批真资金动作**）的**实测读数**（不是设计意图）。产物 = `backend-ts/.p4-artifacts/b3a-20260930T013647/{snapshot-pre.json,snapshot-post.json,e2e.json}`（run2 主口径）+ run1 `…T013122`（同构三件）。**★ 重要限定（v0.4 更新）**：本片按 v0.2 §7-3 的**错误裁定**（保证金 = 冻结可退）实现 ⇒ **G3 的 `frozen` 形态已被 FIX-B 取代**（见 §7-3）；下表如实记**改前的已落地形态**（**保留以留痕**），**当前生效读数 = §1.7**。

| # | 事实 | 实测读数 | 依据锚点 |
|--:|---|---|---|
| **G1** | 注册点 **51 → 53** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts` = **53**（新增 `POST /api/currency`、`POST /api/currency/:cid/list`，位于 404 兜底之前；`src/index.ts:1160/1179`）；既有 51 条**未删改** | `p4-b3a-currency-funds.md §0:13,§6.2,§8:236` |
| **G2** | C1 建单位 **端到端可用** | 首建 **200**（`currency` 行落库 `status=draft`；事件 **2 条分录** = `currency_create_fee` ×2：owner `balance −fee` / `-1` `+fee`；`ΔΣ=0`）；同键重投 **200 + `idempotent_replay:true`**（Δentries=0）；同键异载荷 **409 `LEDGER_IDEMPOTENCY_CONFLICT`**；异键同符号 **409 `LEDGER_CURRENCY_SYMBOL_TAKEN`**(`LD033`)；余额不足 **409 `LD001`**（**无孤儿 `currency` 行**） | `p4-b3a-currency-funds.md §4 C1-T01..T11` |
| **G3** | C2 上市 **端到端可用（★ 语义待返工）** | HAPPY **200**（事件 **4 条分录** = 上市费 `currency_create_fee` ×2 + 保证金 `listing_deposit` ×2〔owner `balance −dep` / owner `frozen +dep`〕；`currency_status_log` +1；行变 `listed`、`deposit_amount` 落库）；未知 cid / `cid=0` **404 `LEDGER_CURRENCY_NOT_FOUND`**；非 owner **403 `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`**（`condition=not_currency_owner`）；重复上市 **409 `LEDGER_CURRENCY_INVALID_TRANSITION`**；保证金不足 **409**（状态/审计/分录**三零残留**） | `p4-b3a-currency-funds.md §4 C2-T12..T22` |
| **G4** | **资金不变量（批 3 判据）** | Σ(balance+frozen)（全账户含 `0/-1/-2/-3`）pre→post 变化量 **== 该事件组净铸/销额度**：run2 **1,000,000 → 2,000,000**（Δ = +1,000,000 = **唯一** fixture `mint` 票面；C1/C2 九个读数逐例 `delta_sigma` = **0**）；`ledger_entry` **9 → 18**（= 1 mint + 2 C1 + 4 C2 + 2 C1-T21）；**批 2 的「增量 = 0 才绿」在批 3 作废**（判据反转为「== 预期条数」，**不得再把 0 当绿灯**） | `p4-b3a-currency-funds.md §5.1-§5.4`；**Zang §5.80 B** |
| **G5** | 冻结面自证 | `src/ledger.ts` / `ledger-errors.ts` / `commission.ts` / `migrations/**`（**17 个文件，无 `0018`**）sha256 **改前 = 改后**；`tsc --noEmit` = **0**；产物**零 token/密钥字节**（`grep -c 'eyJ'` = 0） | `p4-b3a-currency-funds.md §6.1,§6.2,§8` |
| **G6** | **未落地（登记）** | **退市 / 罚没**两条资金支路**未实现**（§4.2 无事件行、§1.1 无端点、无幂等键、无失败语义 ⇒ 按「禁半实现」停手）⇒ v0.3 于 §4.2 新增 **C3** 行并在 §7-22 定案；`-1`/`-3` 白名单与 `HOLD_KINDS` **本片未改**（FIX-A 归属）；C2 的 `frozen`/`delisted` 两支**未测** | `p4-b3a-currency-funds.md §7 N1/N2,§6.1` |

**★ 与 v0.2 §7-3 的偏差（Zang §5.81 已裁 → FIX-A / FIX-B 均已完成）**：G3 的保证金分录**曾为 `HOLD_KINDS` 形态（owner `frozen +dep`，纯冻结）**，而**最终口径 = 消耗 → 贷 `-1`**（**不得出现任何 `frozen` 变动**）⇒ FIX-B **已改**（见 §1.7）；同时 **C1/C2 的费用/保证金金额曾由客户端必填（`body.fee` / `body.deposit_amount`）** ⇒ 已被 Zang §5.81 判为**资金面的洞**（**可传 `fee=1` 绕过**），FIX-B **已改为服务端取数**（见 §4.4-11 / §7-23）。**★ 本节 G1–G6 = 批 3a 首片（FIX-B 前）的历史读数，保留不删**。

### 1.7 批 3a 真收官事实（v0.4 新增 · 全部实测；FIX-A → A2 → B → RS 四单）

> 口径：P4-B3a 片经 **FIX-A（`0019` + `ledger.ts` 手术）→ FIX-A2（`0020`）→ FIX-B（C2 消耗入 `-1` + 金额服务端取数）→ FIX-RS（重置键修复）** 四单后**真收官**（Zang §5.84）。产物 = `backend-ts/.p4-artifacts/{b3afix-20260930T014132,b3afix2-20260930T014937,b3b-20260930T020359+0800,rs-before,rs-after}/**`。

| # | 事实 | 实测读数 | 依据锚点 |
|--:|---|---|---|
| **H1** | **两迁移已应用** | `0019_listing_deposit_platform_credit.sql`（**167 行**；**加法式**扩展 DB 侧 `-1` credit 白名单；sha256 `48a9a4e2…`）+ `0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（**1115 行**；从 `ledger_post_event` **函数体** IN 列表删 `listing_deposit`，**仅删 18 字节**、含 `prosrc` md5 硬断言；sha256 `228127d8…`）；`/health` 自报 **`schema_version=0020`**、`schema_migration` = **19**（`0018` 无文件、**勿补**） | `p4-b3a-fix-ledger-whitelist.md`；`p4-b3a-fix2-ledger-post-event-shape.md`；Zang §5.82 裁定① / §5.83 |
| **H2** | **源码手术（`HOLD_KINDS` 5→4）** | `src/ledger.ts` **2 hunk / +13−4**：`:178` `HOLD_KINDS = ['hold','hold_release','job_escrow','job_escrow_refund']`（**已移除 `listing_deposit`**，**现取 = 4 项**）；`:541` 一带 `-1` credit 收录 `listing_deposit`、**`debit` 仍空**；`0/-2/-3` 逐字未动 | Zang §5.82；`backend-ts/src/ledger.ts:178` |
| **H3** | **C2 最终入账形状（★ 4 腿全在 `balance`）** | 成功事件 = **4 腿**：`currency_create_fee` ×2（owner `balance −fee` / `-1` `balance +fee`）+ `listing_deposit` ×2（owner `balance −d` / **`uid=-1` `balance +d`**）；**逐腿 `frozen_delta=0`**、事件内 Σδ=0、Σfrozen=0（**「不得出现任何 `frozen` 变动」已兑现**）；回执 `deposit_consumed` / `deposit_credit_uid:'-1'` / `deposit_refundable:false`；`currency_status_log` +1（`draft→listed`） | `p4-b3b-currency-funds-fix.md §4.3`（`b3b-03-legs.json` txid 42–45）+ §2.2 形状对照；真源 = `src/currency-service.ts:433,439,440` |
| **H4** | **C1 同族形状** | 建单位成功 = **2 腿**（owner `balance −fee` / `-1` `balance +fee`，kind `currency_create_fee`）；`fee_source` ∈ `{client_ge_floor, server_default}` | `p4-b3b-currency-funds-fix.md §4.2,§5`（C1-T07/T12） |
| **H5** | **金额服务端取数 + 下限校验** | `resolveServerAmount`（`currency-service.ts:233/346/348`）：**未传** ⇒ 服务端常量（`fee_source=server_default`）；**传了** ⇒ 形状闸后须 `≥ 下限`、**低于 ⇒ 400 `LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`**（`{field,value,min}`）；三个下限常量 = `currency-service.ts:140-142`（**1000 / 1000 / 1000**），逐条标 **`TODO: Kevin 定值`**（**占位非经济值**）；旧 `toRequiredPositive`（洞的载体）**已删** | `p4-b3b-currency-funds-fix.md §1.2,§3,§5`；**Zang §5.82 7-23 + §5.84 ①** |
| **H6** | **资金不变量（真收官复核 · Zang 亲算）** | `Σtotal = Σbalance + Σfrozen` **恒 2,000,000**（Zang `zang-sigma.js` 亲算，与 FIX-B 前逐位相同 ⇒ 纯转移、ΔΣ = 0）；`Σfrozen` **零变动**（4002→4002）；`ledger_entry` 30→42；逐 kind：`currency_create_fee` 20（+8）、`listing_deposit` 16（+4）、**`hold` 仍 = 4（未新增）**、`mint` 2；负值行 0 | `p4-b3b-currency-funds-fix.md §4.1,§4.2`；Zang §5.84 B |
| **H7** | **端点 24/24 PASS + 回归** | 24/24 用例（成功 / 幂等重投 **+0 行 +0 分录** / **低于下限 400** / 余额不足 409 且无孤儿行·审计行·分录 / 非本人 403 `ACTOR_NOT_ALLOWED` / 未知 cid·`cid=0` 404 / 无 token 401）；`/health`·`/api/home`·`/api/prize/all`·`/api/task/all` 200；**410 面 6/6**；**注册点 53**（未增删对外路径）；`tsc --noEmit` = **0**；`eyJ` = 0 | `p4-b3b-currency-funds-fix.md §5,§6` |
| **H8** | **未测（登记，禁当 0/空）** | ① `frozen`/`delisted` 币种状态闸两支仍**未测**（库内无该状态行 + 禁改 `currency`，见 §7-17/§8.3）；② **401/403 的服务端日志逐条归因 = `NOT_MEASURED`**（**本仓不落 access log**，见 §3.4 / §7-24）；③ 并发同键双发（真竞态）与账本 `details` 逐字未验证；④ **既有「旧形状」残留数据**（cid 4/10 的 `deposit_amount=2000` 与 4002 的 `frozen` 余额）= 修前 hold 形状的历史残留，**本单不改历史数据**（清理口径待裁） | `p4-b3b-currency-funds-fix.md §5.1,§7,§8`；`p4-b3a-currency-funds.md §7 N2/N3` |

### 1.8 ★ 已实现·未注册清单（v0.5 新增 · **Zang §5.85 裁定① 新纪律**）

> **依据 = Zang §5.85 裁定①**（逐字：「spec 增设 **「已实现·未注册清单」**（**路径/服务层落点/为何未注册/由哪批注册**；**首批 = `POST /api/job/:jobId/{apply,accept}`、`POST /api/listing`**）⇒ 交 Jing v0.5（**`assets/init` 那类「互推无人认领」的结构性解药**）」）。
> **本清单的目的**：**防止「已实现但未注册」的路径被两片互推而永久遗忘**。**先例** = `POST /api/admin/assets/init` 在 **2a / 2b 两份报告里都写「归同批其它片」、无人执行**（见 **Zang §5.78**；该路径最终由批 2c 补齐为 `410`，见 §1.4 F5）。
> **准入判据（写死 —— 本册加，见 §8.7.3-20）**：**同时**满足三条才入本清单 —— ① **服务编排层有具名导出**（端点级 verb，**非** helper）；② `src/index.ts` **无对应注册点**（`grep` 现取）；③ 该能力的目标对外路径在 §1.1 / §4.2 有**明文命名**。**不满足 ①**（helper 导出）、**无 TS 服务层**（如 `referral_bind` 直调 DB）、**已接线**（如 `submitWork` 经既有路径）三类**分别见下文三个边界块**。

**扫描口径（可复算 · 本册现取）**：

- 服务层导出：`grep -nE '^export (async )?function|^export const [a-zA-Z]+ = (async )?\(' src/{job-service,listing-service,job-funds-service,currency-service,admin-service}.ts`
- 已注册路径表：`grep -nE '^app\.(get|post|put|delete|patch)\(' src/index.ts` ⇒ **53 行**
- 交叉核对：逐个 verb 名 `grep -nE '\b<verb>\b' src/index.ts` ⇒ **调用点 = 0 ⇒ 未接线**

| # | 路径（**未注册**） | 服务层落点（`文件:行号`） | 为何未注册 | 由哪一批注册 |
|--:|---|---|---|---|
| 1 | `POST /api/job`（招工发布 + 托管） | `src/job-funds-service.ts:149`（`publishJob`） | 前端对 `/api/job*` **零调用**（`p4-b3c-job-funds.md §1.1` 反证读数；同 `p4-aud-jobkey.md §2.5`）；批 2 / 批 3 保「注册点 53」；**Zang §5.85 裁定① 接受现状** | **批 4** |
| 2 | `POST /api/job/:jobId/apply` | `src/job-service.ts:175`（`applyToJob`） | 同上；**实测** `POST /api/job/2/apply` ⇒ **404**（`p4-b2a-http.md §3:74`）、`POST /api/job/12/apply` ⇒ **404 `Not found`**（`p4-aud-jobkey.md §2.5`，即 `src/index.ts:24` 只引了 `sendGone/sendVerbError/submitWork`） | **批 4** |
| 3 | `POST /api/job/:jobId/accept` | `src/job-service.ts:208`（`acceptApplication`） | 同上；**★ 集成缺口 F-1**（未注册 ⇒ 批 4 前前端 verify 走不通完整资金链；见 §1.9 K11） | **批 4（优先级最高）** |
| 4 | `POST /api/job/:jobId/submit` | `src/job-service.ts:125`（`submitWork`） | **§4.1 新命名未上线**；功能**已由既有** `POST /api/task-progress/:identifier/submit`（**已注册** `:581`）**承载** ⇒ 「**服务已接线、仅新路径名未注册**」 | **批 4（可选别名）** |
| 5 | `POST /api/job/:jobId/review` | `src/job-funds-service.ts:218`（`settleJob`）/ `:237`（`refundJob`） | 前端零调用；**approve / reject 已由既有 `/api/tasklist/:jID/verify` 改接承载**（§1.9 K2/K5） | **批 4** |
| 6 | `POST /api/job/:jobId/cancel` | `src/job-funds-service.ts:237`（`refundJob`） | 前端零调用（`p4-b3c-job-funds.md §1.3`） | **批 4** |
| 7 | `POST /api/listing` | `src/listing-service.ts:164`（`createListing`） | 前端零调用（`p4-b2b-listing-write.md §1.3-1`）；**实测** ⇒ **404** | **批 4** |
| 8 | `POST\|PATCH /api/listing/:listingId`（编辑 / 下架） | `src/listing-service.ts:222`（`updateListing`）/ `:286`（`transitionListingStatus`） | **整个商品写口未接线**：`src/index.ts` **无** `from './listing-service'` 导入（本册现取 `grep`） | **批 4** |
| 附 | `POST /api/admin/commission_policy` | `src/commission.ts:240`（`insertCommissionPolicy`） | **非本轮 5 文件扫描面**（§1.1 既有登记为「服务层可选」）；非本批三片范围 | **批 4** |

**★ 本册实测 vs Zang §5.85「首批」3 条的差异（**以本册实测清单为准**）**：

- Zang 首批 3 条 = `POST /api/job/:jobId/apply`（本表 **#2**）、`/accept`（**#3**）、`POST /api/listing`（**#7**）⇒ **3 条全部命中、逐条被本表包含**（**无遗漏、无冲突**）。
- **本册实测多出 5 条**（**#1** `publishJob`、**#5** `settleJob`、**#6** `refundJob`、**#8** 的 `updateListing` 与 `transitionListingStatus`）—— **不是**「Zang 漏了」，而是**首批只点名 3 条**（Zang §5.85 逐字为「**首批** = …」）⇒ 本册按「真扫描」纪律**补全并如实标注差异**。
- **本册新增的三块（Zang 表头四栏未要求，本册加）**：**准入判据 / 扫描口径 / 负向排除 + 正向对照** —— 目的是让清单**可复算、可负向排除**（否则清单会随扫描口径漂移而失去意义）。**若与 Zang 意图不符 ⇒ 以 Zang 为准**（登记 **§7-26**）。

**负向排除（**不得**登记进本清单者）**：

1. **helper 导出**（非端点级）：`ledgerErrorBody`（`job-service.ts:21`）、`sendGone`（`:36`）、`sendVerbError`（`:76`）、`resolveJobCreateKey`（`:90`）、`resolveJobCreateKeyRequired`（`job-funds-service.ts:84`）、`resolveListingCreateKey`（`listing-service.ts:75`）、`resolveCurrencyKey`（`currency-service.ts:92`）、`pickIdempotencyKeyRaw`（`:107`）、`adminVerbError`（`admin-service.ts:24`）、`canonicalAdminOpsKey`（`:43`）、`resolveAdminOpsKey`（`:51`）、`findFeeRateKey`（`:99`）。
2. **无 TS 服务层**：`POST /api/referral/bind`（**直调 DB** `public.referral_bind(child,parent)`，`migrations/0007_referral_and_commission_policy.sql:241`）、`GET /api/market/:baseCid/candles`（视图 `candle_view` 只读）⇒ **本清单只收「服务层有、路由层无」**，故**不入表**（但**在 §1.1 / §4.2 已登记**）。
3. **已接线的服务 verb（正向对照 · 证明扫描无漏）**：`submitWork`（`job-service.ts:125` → `index.ts:602`）、`verifyJobSubmission`（`job-funds-service.ts:308` → `:1076`）、`createCurrencyVerb`（`currency-service.ts:194` → `:1171`）、`listCurrencyVerb`（`:327` → `:1190`）、`adminPermissionSaveVerb`（`admin-service.ts:121` → `:899`）、`adminPermissionDeleteVerb`（`:177` → `:929`）、`adminUserUpdateVerb`（`:211` → `:951`）⇒ **7 / 7 有注册点**。

**同域但不同清单（并案登记）**：`DatabaseService.markTaskProgressChecked`（`src/database.ts:1249`）、`rejectPendingTaskProgress`（`:2029`）—— **旧直写路径、现无调用方**（`grep` 现取：`index.ts` 命中 **0**）⇒ **归批 4 收口**（`p4-b3c-job-funds.md §2.3 注`）。**本清单不收**（非「端点级服务 verb」），但**同属「没人认领就会被遗忘」的族** ⇒ **并案登记**。

**维护责任（**机制已定、责任人待 Zang**）**：本清单是**每批复核的强制项** —— 复核人须重跑上表扫描命令并把**新增 / 消除**项逐条登记；**有新增项而未登记 ⇒ 复核不通过**；**不得**以「归同批其它片」结案（`assets/init` 先例）。详见 **§7-26**。

### 1.9 批 3b 已落地事实（v0.5 新增 · 全部实测；**Zang 定名 = 批 3b**，报告 tag = `p4-b3c`）

> **口径**：**批 3b = 招工资金三段**（J1 托管 / J5 发放 + 手续费 + 返佣 / J6 退托管）。**命名**：**Zang §5.85 A 定名 = 批 3b**；产物 tag = **`p4-b3c`**（报告 `docs/audit/p4-b3c-job-funds.md`，**263 行 / 9 节 / sha256 `5a17fe1c…`**；run tag `b3c-20260930T021741`）—— **两者指同一片**（§8.7.3-16）。**本节读数 = 转引该报告**（**本册不连库、未实跑**；**Zang §5.85 A 已亲验其中 5 项**）。

| # | 事实 | 实测读数 | 依据锚点 |
|--:|---|---|---|
| **K1** | **交付面** | **新建** `src/job-funds-service.ts`（**330 行 / sha256 `7b808634c615e7467bcfe71d51c38d2c9dce1fd1c1f4eababfde781190b3d53d`**；`publishJob` `:149` / `settleJob` `:218` / `refundJob` `:237` / `verifyJobSubmission` `:308` / `resolveJobCreateKeyRequired` `:84`）；`src/database.ts` **+3 method**；`src/index.ts` **只改接 1 条既有路由** | `p4-b3c-job-funds.md §2.1`；`src/job-funds-service.ts`（本册现取行数/sha256） |
| **K2** | **唯一资金写路径 + 「结论位与资金同语句」** | `DatabaseService.jobPostEvent` = **`SELECT public.job_post_event($1::jsonb)`**（**`:1665`**）；`reviewJobSubmission`（`:1723`）= **单条 SQL**：`WITH ev AS (…)`（`:1732-1733`）+ `sub AS (UPDATE public.job_submission …)`（`:1734-1735`）+ 末 `SELECT … submissions_reviewed`（`:1750`）；`resolveReviewTarget`（`:1677`）**只读** | §1.9 K1 同源；**Zang §5.85 A ③/④ 亲读** |
| **K3** | **注册点 53 → 53** | 只改接 `POST /api/tasklist/:jID/verify`（**现取 `:1061`**）；**未增删对外路径**；`src/index.ts` 现 **1216 行**；**未新增迁移**（`migrations/` 仍 **19**）⇒ `/health` 仍 `schema_version=0020` | `p4-b3c-job-funds.md §1.3,§6`；**本册现取**；**Zang §5.85 A ⑤** |
| **K4** | **J1 托管（service）** | `200`；`job_escrow` **2 腿全在 uid 2**（`(−400,0)` / `(0,+400)`，`frozen_after=400`）；同键重投 ⇒ `200` 重放、**分录仍 2 腿**、业务行未重写；缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`、坏前缀 ⇒ `400 …_INVALID`（`PREFIX_REQUIRED`）、代他人出资 ⇒ `403 AUTH_FORBIDDEN`、余额不足 ⇒ `409 LEDGER_INSUFFICIENT_BALANCE`、未知 cid ⇒ `404 LEDGER_CURRENCY_NOT_FOUND` | `p4-b3c-job-funds.md §4.1 E2/E3/E4` |
| **K5** | **J5 结算（HTTP · 无邀请人）** | `200`；**4 腿** = `job_payout` uid2 `(0,−396)` → uid3 `(+396,0)` + `job_fee` uid2 `(0,−4)` → **uid −1 `(+4,0)`**；**`-2` 命中 0**；job → `settled`、`settle_txid=54`；**结论位与 4 条分录同一次调用落库**（`review_status='approved'` / `reviewed_by=1` / `review_memo='job settle:5'`）；同键重投 ⇒ `200 + idempotent_replay:true`、**txid 集合逐字相同** | `p4-b3c-job-funds.md §4.1 E5/E6/E7` |
| **K6** | **★ DL86 两形态（均实测）** | **① 无邀请人** ⇒ `job_fee` 入 **`-1`**、**`-2` 命中 0**；**② 真链 `depth=2`**（经迁移既有 `public.referral_bind(child,parent)` 建链）⇒ **8 腿** = `job_payout`×2 + `job_fee`×2 + **`commission`×4**；`-2` **进 +10 / 出 −10**、受益人合计 **+10** ⇒ **`-2` 进出守恒**；**`-1` 命中 0**（有链 ⇒ 不得写 `-1`，DL86 逐字） | `p4-b3c-job-funds.md §4.1 E8,§7 N8②`；**Zang §5.85 A 采信** |
| **K7** | **逐事件守恒** | **每个事件 `Σ(delta+frozen_delta) = 0`**（escrow 2 腿 / settle 4 腿 / 链 settle 8 腿 / refund 2 腿 **逐事件为 0**）；**托管 / 退款 = 同账户 2 腿 `balance↔frozen`**；**`Σtotal` = 2,000,000**（**第三次独立复算、与前两次逐位相同**）、**负值行 0**；`Σfrozen` 4002→4002 | `p4-b3c-job-funds.md §4.3,§5 I1/I2/I4`；**Zang §5.85 A ①** |
| **K8** | **`ledger_entry` 42 → 76（Δ34 · 枚举等式闭合）** | 逐 kind：`job_escrow` **10** / `job_escrow_refund` **4** / `job_payout` **6** / `job_fee` **6** / `commission` **4** / `transfer` **4**（**夹具供资，已声明非资金事件**）⇒ 4+10+4+6+6+4 = **34** ✅；`hold` 4→4、`listing_deposit` 16→16、`currency_create_fee` 20→20、`mint` 2→2（**本片零 mint**） | `p4-b3c-job-funds.md §3`；**Zang §5.85 A ②** |
| **K9** | **成功面键集冻结** | approve = **11 键**、reject = **9 键**，**与改接前逐键一致**；唯一新增 = 重放时**顶层** `idempotent_replay:true`（非 `data` 键） | `p4-b3c-job-funds.md §4.4`；§4.4-17 |
| **K10** | **未测（登记，禁当 0/空）** | ① `/api/job*` 六条未注册路径的 **HTTP 面**（按设计不存在）；② `disputed` 状态分支；③ J1 的 `draft`/`frozen`/`delisted` 三态币种闸；④ `job_escrow_missing`（防凭空退款）；⑤ 并发双 settle；⑥ **401/403 的日志逐条归因**（无 access log ⇒ 同 §7-24 口径） | `p4-b3c-job-funds.md §7 N1/N3/N4/N6/N7`；§8.7.2-19/20/21 |
| **K11** | **★ 集成缺口 F-1（已由 Zang 裁定接受现状）** | settle 要求 `job.worker_uid` **已选定**，而「选定」的唯一入口 `/api/job/:jobId/accept` **未注册**（§1.8 #3）⇒ **批 4 前前端 verify 走不通完整资金链**（本片 e2e 的 apply / accept / submit **全走 service 层**，非假数据）。**Zang §5.85 裁定① = 接受现状**（前端对 `/api/job*` 零调用 + 保「53」），**并以 §1.8 的新纪律为结构性解药** | `p4-b3c-job-funds.md §7 N2`；**Zang §5.85 裁定①** |

## §2 前端契约冻结（响应 key 集来源 + 不得变）

**母约束（本册裁定 F1）**：批 2 / 批 3 期间，**任何既有端点的响应 key 集不得变化**（增键亦视为变化，除非本册明文批准）。键集的**唯一来源** = 下表的 mapper / 组装函数；**改 SQL、换表、换列名都不构成改键集的理由**（mapper 里加「回退键」是既有手法：旧列名在前、新列名在后）。

### 2.1 逐端点 → key 集来源

| 端点（`index.ts:行号`） | key 集来源（唯一真源） | 键数 | 批 1 / 批 2 夹具读数（可 grep） |
|---|---|---|---|
| `GET /api/user/asset/:uID`（:367） | `database.ts:457 normalizeAsset` → `AssetRecord` | 5（`index_id/uID/points/lucks/time_update`） | `b1a-…/post/fixture-keys.json` 10/10 EQ（`p4-b1-get-triage.md:121`） |
| `GET /api/user`（:331） | `database.ts:465 normalizeUser` + `index.ts` 的 `buildUserPayload` | `UserRecord` 键集（**8 键**含 `points/requires_profile_completion`） | `p4-b2a-http.md §1,§2:48`（实测 8 键，`uID=970001` 非零 ⇒ mapper 真取到新列） |
| `GET /api/prize/all`（:269）、`GET /api/prize/:bID`（:311） | `database.ts:474 normalizeBrand` → `BrandRecord` | **45**（真实行） | `b1c-…/post/fixture-keys.json` 8/8 EQ（`p4-b1-get-triage.md:128`）；批 2b 三口径 43/43/43 EQ（合成行；`p4-b2b-listing-write.md §3.5`） |
| `GET /api/prize-item`（:420） | `database.ts:573 normalizePrizeItem` → `PrizeItemRecord` | **6** | `p4-b2b-listing-write.md §3.5`（6/6/6 EQ） |
| `GET /api/task/all`（:281）、`GET /api/task/:tID`（:293） | `database.ts:582 normalizeTask` → `TaskRecord` | **21** | `b1b-…/post/fixture-keys.json` 9/9 EQ（`p4-b1-get-triage.md:124,351-353`） |
| `GET /api/task-progress`（:434）、`/api/task-progress/:jID`（:448） | `database.ts:611 normalizeTaskProgress` → `TaskProgressRecord` | **9** | 同上（`p4-b1-get-triage.md:352`）；批 2a-HTTP 提交响应实测 9 键（`p4-b2a-http.md §3:65`） |
| `GET /api/tasklist/pending-verification(/count)`（:973/:986） | `normalizeTaskProgress` + enrich（`task`/`user`） | **11** | 同上（`p4-b1-get-triage.md:353`） |
| `GET /api/order`（:623） | `database.ts:670 normalizeMarketOrder` → `MarketOrderRecord` | **12** | `b1d-…/post/fixture-keys.json` 9/9 EQ（`p4-b1-get-triage.md:133`） |
| `GET /api/market/:bID/trades`（:702） | `database.ts:699 normalizeMarketTrade` → `MarketTradeRecord` | **10** | 同上（`p4-b1-get-triage.md:133`） |
| `GET /api/market/:bID/orderbook`（:687） | `database.ts:690 normalizeOrderBookRow`（export）→ `MarketOrderBookRow` | **3**（`side/price/volume`） | 同上（`p4-b1-get-triage.md:133`） |
| `GET /api/shard`（:557） | `database.ts:654 normalizeShardHolding`（**现恒空数组**） | 键集冻结，值恒空 | B1-c（`p4-b1-get-triage.md:476,538`） |
| `GET /api/shard/transfer`（:572） | `database.ts:715 normalizeShardTransfer`（**现恒空数组**） | 键集冻结，值恒空 | B1-c（`p4-b1-get-triage.md:539`） |
| `GET /api/admin/settings`（:724） | `database.ts:623 normalizeSystemSettings` → `SystemSettingsRecord` | **9**（不变） | `p4-b2c-admin-write.md §3.1 T04,§3.4` |
| `GET /api/admin/permissions`（:763） | `database.ts:639 normalizePermissionGroup` → `PermissionGroupRecord` | **8**（不变；**批 2c 换数据源，键集不变**） | `p4-b2c-admin-write.md §3.4` |
| `GET /api/admin/me`（:718） | `index.ts` `buildAdminAccess` → `AdminAccessRecord` | **6**（见 §6.4） | `p4-b2c-admin-write.md §3.4`（返回键名逐字相等） |
| `GET /api/user/all`（:946） | `normalizeUser` | 元素 **6 键** | `p4-b2c-admin-write.md §3.1 注`（`body_head` 逐字） |
| `GET /api/user/stats`（:960） | `database.ts getUserStats` | **5**（`user_count/admin_count/asset_count/total_points/avg_points`） | `p4-b2c-admin-write.md §3.1 T26,§3.4` |
| `POST /api/admin/user/update`（:821） | `normalizeUser` | **6 键** | `p4-b2c-admin-write.md §3.1 T20` |
| `GET /api/home`（:383） | `index.ts` 内联组装 | 5（`tasks/prizes/claimed_prize_ids/user_points/is_authenticated`） | B1-c 实测体（`p4-b1-get-triage.md:49`）；批 2c T28 回归 200 |
| `GET /health`（:200） | `db.ts:healthCheck` | `ok/db_version/schema_version/time` | 实测（`p4-route-inventory.md:172`） |

**B1-a..B1-d / 批 2 的 key 集等值证明方式**（可复核）：零依赖内存夹具或静态源码口径，把同一组合成行分别喂**改动前** mapper 与**改动后** mapper，**逐 key 比对（只比 key 集，不比值）**。批 1 四次均 `all_key_sets_equal: true`（10/10、9/9、8/8、9/9）。批 2b 三口径 43/43/43、6/6/6 EQ；批 2c 静态口径 5 函数三版本 sha 相等（`p4-b2c-admin-write.md §3.4` `all_key_sets_equal:true`）。**自曝**：合成行键数可能少于真实行（43 vs 45，条件键），**该读数只用于「三口径相等」**，绝对键数以真实行为准。

### 2.2 前端消费面（**本册实测**：97 行命中 / **23** 文件）

口径：`search_files '/api/' frontend/src` ⇒ 97 行；文件数 23（与父单「49 条去重路径 / 23 文件」**文件数一致**）。**高频路径**（父单口径）：`/api/prize/all` 11、`/api/task/all` 9、`/api/user/asset/:p` 6、`/api/tasklist/pending-verification(/count)` 4+4、`/api/shard` 4、`/api/prize-item` 4、`/api/order` 3、`/api/home` 3。

代表性消费点（`文件:行号`，本册实测）：

- `frontend/src/pages/ProfilePage.jsx:77` `/api/user/asset/${uID}`；`:92` `/api/shard`；`:105` `/api/task-progress`；`:106` `/api/prize-item`
- `frontend/src/pages/HomePage.jsx:105` `/api/task/all?limit=`；`:106` `/api/prize/all?limit=`；`:119` `/api/prize-item`；`:120` `/api/user/asset/${user.uID}`；`:140` `/api/home?task_limit=&prize_limit=`
- `frontend/src/pages/RewardPage.jsx:49` `/api/prize/all`；`:56` `/api/prize-item`；`:58` `/api/shard`；`:109` `/api/task-progress/${q_jID}`；`:112` `/api/task/${tID}`；`:152` `/api/task-progress/claim/${jID}`；`:196` `/api/shard/redeem`；`:217` `/api/chest/${reward.bID}/open`
- `frontend/src/pages/TaskPage.jsx:90` `/api/task/all`；`:109` `/api/task-progress`
- `frontend/src/pages/ShardPage.jsx:42-43` `/api/market/${bID}/orderbook|trades`；`:176` `POST /api/order`；`:301` `/api/shard`；`:302` `/api/order`；`:303` `/api/shard/transfer`；`:314` `DELETE /api/order/${oID}`；`:328-329` `DELETE /api/order`（**body 式全撤**）
- `frontend/src/components/Header.jsx:71` `/api/user/asset/${userData.uID}`；`frontend/src/components/ActiveTaskModal.jsx:50` `/api/task-progress/${...}/submit`；`frontend/src/components/ClaimRewardModal.jsx:24` `/api/task-progress/${jID}`、`:49` `/api/task-progress/claim/${jID}`
- `frontend/src/auth.js:105` **401/403 读 `payload?.message \|\| payload?.error`**（v0.2 新增，见 §2.4）；`:113` `/api/auth/challenge`；`:123` `/api/auth/verify`；`:142` `/api/user`；`:153` `/api/user/profile`
- `frontend/src/admin-utils.js:27` `/api/admin/me`；`:78` `/api/user/asset/${uID}`；`:88-89` `/api/user/stats`、`/api/user/all`
- `frontend/src/pages/admin/*`：`TasksManagement.jsx:52,130,140,177`；`RewardsManagement.jsx:56,154,164,201`；`PermissionsManagement.jsx:55,75,89-98,132-135,176`；`PointsManagement.jsx:114`；`UsersManagement.jsx:103-107`；`SystemSettings.jsx:46,84-88,123`；`ShardsManagement.jsx:44,60,74`
- `frontend/src/pages/DashboardPage.jsx:121-125` `/api/user/stats`、`/api/task/all`、`/api/prize/all`、`/api/tasklist/pending-verification(/count)`；`:223` `/api/tasklist/${jID}/verify`

### 2.3 前端消费但后端**没有**的路径

**结论：0 条**（本册实测）。把 `frontend/src` 的 97 条命中逐个比对 §1 的 51 条注册点 ⇒ **每个非测试路径都有对应后端注册点**。仅以下两处**不是真端点**（**不得**当缺口）：

1. `frontend/src/test/e2e/basic.spec.js:123` `page.route('**/api/**', …abort)`、`:133` `**/api/tasks` —— **Playwright 路由 mock 模式**，非真实请求；
2. `frontend/src/test/unit/*.test.{js,jsx}` 的 `/api/...` 字符串 —— **vitest mock 表键**（例 `home-page.test.jsx:54-58`）。

**登记**：`frontend/src/test/unit/auth.test.js:75` 断言 `/api/auth/register` 抛 `deprecated endpoint` ⇒ §5.3 处置该端点时**必须同步此测试**，否则单测必红。

### 2.4 批 4 前端同步清单（v0.2 新增 · 由批 2 实测代价产生，**必须实现方认领**）

> 口径：批 2 因「禁改 `frontend/**`」未能处理，**统一登入下表**，随批 4（前端迁移）一并落地。每条的「代价」= 不改则前端在批 2 后端下会**立即异常**或**文案退化**。

| # | 同步项 | 必改点 | 触发原因（实测依据） |
|--:|---|---|---|
| S1 | **`ops:` 强校验的 4 个写口** | `admin/SystemSettings.jsx:84-88`（`POST /api/admin/settings`）、`admin/PermissionsManagement.jsx:89-98`（save）、`:132-135`（delete）、`admin/UsersManagement.jsx:103-107`（`user/update`）——**须补幂等键**（`body.create_key`/`body.idempotency_key`/`Idempotency-Key` 头，`ops:` 前缀） | `DL36` 落为**请求侧强校验**（§4.5/§7-14）；**旧前端不带键 ⇒ 这 4 个写口一律 `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（`p4-b2c-admin-write.md §1.3-3,§4.2-2`）；裁定 Zang §5.78 ② |
| S2 | **`R107` 的 401/403 形状** | `frontend/src/auth.js:105`（`payload?.message \|\| payload?.error` ⇒ R107 下 `payload.error` 是**对象** ⇒ 文案退化成 `[object Object]`）**须改读 `payload.error.message`** | `requireActor`/`requireAdmin` 已改 `R107`（`AUTH_UNAUTHORIZED`/`AUTH_FORBIDDEN` + `reason`）⇒ 所有需鉴权端点的 401/403 形状变化（`p4-b2c-admin-write.md §4.2-3`）；裁定 Zang §5.78 ③ |
| S3 | **四语 locale** | `frontend/src/locales/{zh,en,hk,vn}.json` **各加 2 键**：`auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`（现 **0 命中**，实测） | §3.3-6（`data-layer.spec.md:769`）；§3.4 |
| S4 | **`DELETE /api/order` 入参改 query** | `frontend/src/pages/ShardPage.jsx:328-329`（**带 body 的全撤**）改为**入参走 query** | §1 #27（后端将不再读 body）；已裁 §7-5 |
| S5 | **`410` 面的 UI 分支下线（只读化）** | `RewardPage.jsx:196,217`；`admin/TasksManagement.jsx:130,140,177`；`admin/RewardsManagement.jsx:154,164,201`；`admin/SystemSettings.jsx:123` | §5.1（13 面 `410` 已落地，F5）；页面**只读化**不整页删 |
| S6 | **单测断言同步** | `frontend/src/test/unit/auth.test.js:75`（`/api/auth/register` 的 `deprecated endpoint` 断言） | §2.3 登记 |
| S7 | **键集冻结（全 23 文件）** | 批 2/批 3 期间不得依赖任何**新增**响应键 | 本册 §2 母约束 F1 |
| S8 | **`/api/user` 新形状迁移（批 4）** | `auth.js:142`、`Header.jsx:71` 消费的既有键集 ⇒ 批 4 切 `/api/user/points`（集合形状）时同步 | §7-2（`DL24` 履约时点 = 批 4） |
| S9 | **「前端是否依赖旧 `400`」回归核验**（v0.5 新增 · 由批 3b 两条行为 delta 产生；**Zang §5.85 裁定② 要求**） | ① `frontend/src/pages/DashboardPage.jsx:223-236`（verify 的**唯一**真实调用点）—— **本册现取读数 = 不对该 `400` 做分支**：成功走 `fetchApiJson`、失败一律 `toast.error(操作失败: ${error.message})` 泛化呈现 ⇒ **无「按 400 文案/状态分支」的依赖**；② `jID` 来源 = 面板队列数据（`application_id`，数字）⇒ **前端不会主动发非数字 `jID`**；③ 撤除的 bespoke `400`（admin 提交）**前端不可达**（读口结构性排除，见 §3.1/§1.9 K2 注） | `p4-b3c-job-funds.md §2.3 Δ1/Δ2`；**Zang §5.85 裁定②**；**残留 = 前端 23 文件未全量扫 ⇒ `NOT_MEASURED`（§7-27 / §8.7.2-18）** |

> **v0.1 §2 已列的前端冻结面差异**（承接，不重复）：`§2.3` 的 `auth.test.js:75`；`§5.2` 的「按调用点删除按钮」清单 —— 本表 S5 与 §5.2 为同一组改动的两种视角（**以本表为准：本表补上了 S1/S2/S3 三条 v0.1 未列项**）。

## §3 detail-miss 与错误语义

### 3.1 统一 `404`（本册裁定 E1）

**默认口径**：**detail-miss（单资源读不到 / 写目标不存在）一律 `404`**。例外必须逐条说明；本册**不设任何 200 空态例外**（撤销 B1-b 在 `/api/task/:tID` 上的临时 200 空态）。

| 端点 | 现状（实测） | 本册口径 | 落地状态 |
|---|---|---|---|
| `GET /api/task/:tID`（:293） | **404** ✓（批 2a 已改回） | **`404`**。依据：父单「detail-miss 语义统一为 `404`」+ Zang §5.73 7-1 | **已落地**（`p4-b2a-job-write.md §3.1:89`） |
| `GET /api/prize/:bID`（:311） | `404` ✓ | 保持 `404` | **已落地**（`p4-b2b-listing-write.md §3.1:110`） |
| `GET /api/task-progress/:jID`（:448） | `404` ✓ | 保持 `404` | 批 1 已落 |
| `GET /api/order/:oID`（无 GET 单条）/ `POST/DELETE` 的资金动作 | 未测 | 目标不存在 ⇒ `404 LEDGER_REF_NOT_FOUND` + `details.ref_type/ref_id` **必填** | 批 3 |
| `POST /api/listing`（未注册） | **404 `Not found`**（裸文案） | 保留 404 兜底，但**形状须对齐 `R107`**（§1.3） | **待批 4**（`p4-b2b-listing-write.md §3.1:120`） |
| `POST /api/tasklist/:jID/verify`（现取 `:1061`） | **非数字 `:jID` 曾 `400 Invalid jID`**（改前 = `git show 9d40b17:backend-ts/src/index.ts:1064-1067`） | **`404 LEDGER_REF_NOT_FOUND` + `details.reason=jID_not_found`**（`R107`；对齐 detail-miss 统一 404 + `cid` 形状闸同族口径：非整数 ⇒ **该对象不存在**） | **已落地（批 3b）**（`p4-b3c-job-funds.md §2.3 Δ1,§4.2`：`HTTP_verify_nonnumeric_404` ⇒ 实测 404）+ **Zang §5.85 裁定② 批准**；回归项 = §2.4 S9 |

**`404` 三类必须可区分**（`DL124`，`docs/data-layer.spec.md:751`）——**禁止**把三类混成一个 404 文案：

| 类 | 码 | 触发 | `details` |
|---|---|---|---|
| 记账主体不存在 | `LEDGER_ACCOUNT_NOT_FOUND` | `account` 无该 `(uid,cid)` 且不可创建 | `{uid,cid}` |
| 币种不存在 | `LEDGER_CURRENCY_NOT_FOUND` | `currency` 无该 `cid`（**含 `cid<=0` 与负数**，v0.5 裁定） | `{cid}`（十进制字符串） |
| 业务对象不存在 / **越权隐藏** | `LEDGER_REF_NOT_FOUND` | 单资源 miss；**以及无权限可见性**（`DL111`①–④，**不泄露存在性**） | `{ref_type,ref_id}` **必填** |

> **批 2 实测补充**：`LEDGER_REF_NOT_FOUND` 的 `ref_type` 取值已实测出现：`job`（`p4-b2a-job-write.md §3.1:89`）、`listing`（`p4-b2b-listing-write.md §3.2:151`）、`users` / `admin_role` / `admin_permission`（`p4-b2c-admin-write.md §3.1 T17/T18/T23`）⇒ **`ref_type` 是开放取值域**（业务对象名），**不得**被误当作 §4.1 的 8 值 `ref_type` 关闭集（后者是**账本分录**的 `ref_type`，二者同名不同域）。

### 3.2 状态码适用条件（逐码）

| 码 | 适用条件 | 依据（唯一真源） |
|---|---|---|
| **`400`** | 入参**形状 / 语义非法**：缺幂等键（`LEDGER_IDEMPOTENCY_KEY_REQUIRED`）、键格式非法（`LEDGER_IDEMPOTENCY_KEY_INVALID`）、金额非法（`LEDGER_AMOUNT_INVALID` / `LEDGER_AMOUNT_NOT_POSITIVE`）、小数位溢出（`LEDGER_DECIMALS_OVERFLOW`）、自转账（`LEDGER_SELF_TRANSFER`）、平台保留 uid 出现在不该出现的位（`LEDGER_RESERVED_UID`）、kind 不在关闭集（`LEDGER_UNKNOWN_KIND`）、币种不一致（`LEDGER_CURRENCY_MISMATCH`） | `ledger-errors.ts:34-35,43,49-52,55,57`；**批 2 实测**：`ops:` 缺键（`p4-b2c T08/T16`）、坏前缀（`p4-b2b §3.2:136`）、费率键（`p4-b2c T11`）、`FORBIDDEN_FIELD`（`p4-b2c T21/T22`） |
| **`400`（★ v0.4 借码正式化）** | **金额低于服务端下限** ⇒ 借码 **`LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`**（`details = {field,value,min}`）；**Zang §5.84 ① 裁定**（`reason` 已能判别 ⇒ **不开新单、不新造码**）。**「未传金额 ⇒ 服务端默认 ⇒ 200」**（Zang §5.84 ② 批准）⇒ **随之 C1-T05 / C2-T17 的期望由 `400` 改 `200`**（见 §4.4-12） | `p4-b3b-currency-funds-fix.md §3,§5`（C1-T05/T12、C2-T16/T17/T23）；`src/currency-service.ts:169`；**Zang §5.84 ①/②** |
| **`401`** | 无 / 坏 token；`resolveActor` 判凭据无效（**≠ DB 故障**：DB 故障必须 `500/503`） ⇒ **`AUTH_UNAUTHORIZED`**（非账本域码） | `DL122`+§11.3.1（`data-layer.spec.md:754,766`）；**已落地**（§3.4） |
| **`403`** | ① 有 actor 但 `can_access_admin=false`（`reason=NOT_ADMIN`）；② admin 但未命中 `requiredPermission`（`reason=PERMISSION_NOT_GRANTED`）；③ **「已参与但无该动作权限」**（`reason=ACTOR_NOT_ALLOWED`）⇒ **`AUTH_FORBIDDEN`**。**例外**：账本层权限语义（铸币权 / 手动冻结权）仍用 `LEDGER_UNAUTHORIZED_MINT` / `LEDGER_HOLD_NOT_ALLOWED`（**新面业务路由不得返回它们**，C6 明确禁止再借 `LEDGER_HOLD_NOT_ALLOWED`） | `DL122`/`DL147`/§11.3.2（`data-layer.spec.md:754-755,766-778`）；`ledger-errors.ts:46-47`；**已落地**（§3.4） |
| **`404`** | 见 §3.1（三类 + detail-miss 默认） | `DL124`（`data-layer.spec.md:751`） |
| **`409`** | **业务状态冲突**（**不是 400**）：可用余额不足 `LEDGER_INSUFFICIENT_BALANCE`、在冻不足 `LEDGER_INSUFFICIENT_FROZEN`、幂等同键异指纹 `LEDGER_IDEMPOTENCY_CONFLICT`、币种未上市 `LEDGER_CURRENCY_NOT_LISTED`、币种已下架 `LEDGER_CURRENCY_DELISTED`、**业务状态机非法转移**（借码 `LEDGER_CURRENCY_INVALID_TRANSITION` + `details.field` + `reason` 大写）、符号占用 `LEDGER_CURRENCY_SYMBOL_TAKEN`、发行上限 `LEDGER_SUPPLY_CAP_EXCEEDED` | `DL123`（`data-layer.spec.md:750`）+ `DL119`（`:708`）+ C5（`:345`）；`ledger-errors.ts:30-33,38,40-42,45`；**批 2 实测**：`LISTING_STATE_INVALID`/`JOB_APPLICATION_STATE_INVALID`/`application_already_exists`（`p4-b2b §3.2:144`；`p4-b2a-http §3.1 B7`） |
| **`410`** | 仅用于 §5 的**弃用面过渡**（`DL35` 的过渡条：410 + `{error:{code:'LEDGER_REF_NOT_FOUND'}}` + **登记过期日**） | `DL35`（`data-layer.spec.md:325`）；**批 2 实测**：13 面（见 §1.4 F5） |
| **`422`** | **本册裁定：不启用。** 理由：`ledger.spec` §14.1 的 **33 码关闭集里没有任何 422**（`ledger-errors.ts:28-70` 全表无 422）；本仓用 `400` 表达「入参形状/语义非法」、`409` 表达「业务状态冲突」（`DL123`）。**任何** `422` 都必须先开新裁定（不得「顺手用」） | `ledger-errors.ts:28-70`；`DL123`/`DL119`；已裁 §7-9 |
| **`423`** | 单位被合规冻结 ⇒ `LEDGER_CURRENCY_FROZEN`（`DL125` 附） | `ledger-errors.ts:39`；`DL125`（`data-layer.spec.md:752`） |
| **`500`** | **只允许由「不变式被破坏」触发，且必须告警（R108）**：`LEDGER_NEGATIVE_BALANCE_GUARD` / `LEDGER_APPEND_ONLY_VIOLATION` / `LEDGER_ACCOUNT_GUARD_VIOLATION` / `LEDGER_FEE_RATE_INVALID` / `LEDGER_TRANSACTION_REQUIRED`；`LEDGER_RECONCILE_MISMATCH`（表内 `status=null`，**HTTP 层必须兜底 500**）。**业务状态机非法转移不得用 500** | **`DL126`**（`data-layer.spec.md:753`）+ `R108`（`ledger-errors.ts:79-87`）+ `httpStatusOf`（`ledger-errors.ts:190-193`） |
| **`503`** | 重试类：`LEDGER_LOCK_TIMEOUT` / `LEDGER_TX_TIMEOUT` / `LEDGER_DEADLOCK_RETRY_EXHAUSTED`（含连接池过载 / 驱动连接级错误 / infra SQLSTATE 的归一；**含事件对象族** `ErrorEvent`，Unit E 修复） | `ledger-errors.ts:60-62,631-637`；`p3-errors-fold-fix.md` |
| **`200`（良性）** | `LEDGER_IDEMPOTENCY_REPLAY` **不是错误**（R106）：同键同指纹 ⇒ 200 + `idempotent_replay:true`；**不得**落 500 兜底 | `ledger-errors.ts:170,190-193`；**批 2 实测**（`p4-b2a-http.md §3.1 B4`、`p4-b2b-listing-write.md §3.1:123`） |

### 3.3 响应形状与**必须遵守的收尾规则**（R107 · 逐条强制）

1. **统一错误体**：`{ error: { code, message, i18n_key, details } }`；`i18n_key = ledger.err.<CODE>`（`ledger-errors.ts:10-13,219,243-253`）。
2. **`details` 只放非敏感上下文**（`cid`/`symbol`/期望值/实际值/关联键）；**禁止**放 SQL、**约束名**、**堆栈**、**表名**、连接串（`R107`，`ledger-errors.ts:10-12`）。**原始 `message` / `stack` 只准进服务端日志（R108 诊断载荷）**：`ledgerErrorDiagnostics()`（`ledger-errors.ts:531`）是那个载荷，**永不进对外 `details`**（`:462-471` 裁定逐字；Unit E 复证 `p3-errors-fold-fix.md §3`）。
3. **HTTP 状态一律取 `err.httpStatus`（= `status ?? 500`）**，**不得**直写 `err.status`（`status=null` 是脚本退出码语义，透传会得到「缺状态码」的响应）。真实例：`0007` 的佣金守恒断言抛 `LD032`（`ledger-errors.ts:236-242`；`migrations/0007_referral_and_commission_policy.sql:317`）。
4. **不得吐未映射的原始 SQLSTATE**：一律经 `normalizeLedgerError`（`ledger-errors.ts:568`）；`23505` 只对 `constraint='ledger_idem_uniq'` 映射为 `LEDGER_IDEMPOTENCY_CONFLICT`，**其余**唯一冲突落 `400 LEDGER_AMOUNT_INVALID` ⇒ 因此**业务级唯一键**（如 `job_application_job_worker_uniq`、`uniq_job_application_accepted`、各 `*_create_key_uniq`）**必须在应用层先判、并映射为 409/幂等 200**，不得让裸 `23505` 变成 400（`ledger-errors.ts:604-606`）。**批 2 实测**：b2b 对 `listing.create_key` 重投在应用层判 409/200，**未落裸 `23505`**（`p4-b2b-listing-write.md §3.2:134,§4.2-1`）。
5. **非账本错误的 `reason` 必须可机读**（不得只留 `cause='non_pg_error'`）（`ledger-errors.ts:639-649`）。
6. **`AUTH_*` 的 `i18n_key` = `auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`（需新增键）**：`frontend/src/locales/{zh,en,hk,vn}.json` 现**无任何 auth/error 键**（实测 0 命中）⇒ 前端四语 locale 必须各加两条（`data-layer.spec.md:769`）＝ **§2.4 S3**。
7. **`AUTH_*` 不得与 `LEDGER_*` 混用**：33 码关闭集**不增不减**（`DL147④`）。
8. **（v0.2 新增）错误分支用 `R107`、成功分支键集**逐字**冻结**：批 2 三片统一的实现口径 = 错误面 `R107` 统一体、成功面 `data` 键集不变（`p4-b2a-job-write.md §1.3-3`、`p4-b2b-listing-write.md §3.5`、`p4-b2c-admin-write.md §3.4`）⇒ 与 §2 母约束 F1 **不冲突**（F1 约束的是**成功响应**的 `data` 键集）。

### 3.4 401/403 统一 `R107`（v0.2 新增 · **已落地**）

**事实**：批 2c 把 `requireActor` / `requireAdmin` 的响应体由 `{success:false,message,error}` **改为 `R107`**（`p4-b2c-admin-write.md §2 IX2/IX3`）⇒ **所有需鉴权端点的 401/403 形状变化**（跳 51 端点）。

| 场景 | 码 | `details.reason` | 实测锚点 |
|---|---|---|---|
| 无 token | `401 AUTH_UNAUTHORIZED`（**不触 DB、日志无记录**） | — | `p4-b2c-admin-write.md §3.1 T06,§3.2:152` |
| 坏签名 | `401 AUTH_UNAUTHORIZED`（日志 `Invalid token signature`） | — | `p4-b2c-admin-write.md §3.1 T07,§3.2:152` |
| 有 actor 但非 admin | `403 AUTH_FORBIDDEN` | `NOT_ADMIN` | `p4-b2c-admin-write.md §3.1 T05/T19/T25` |
| admin 但未命中 `requiredPermission` | `403 AUTH_FORBIDDEN` | `PERMISSION_NOT_GRANTED` | §6.2 步 4（`admin_permission` 0 行 ⇒ 代码常量真源） |
| 业务角色守卫（非雇主/非打工人/非卖家） | `403 AUTH_FORBIDDEN` | `ACTOR_NOT_ALLOWED` | `p4-b2b-listing-write.md §3.2:147`；`p4-b2a-job-write.md §3.2:109` |

**前端同步（必做）**：`frontend/src/auth.js:105` 读 `payload?.message \|\| payload?.error` ⇒ R107 下 `payload.error` 是**对象** ⇒ 文案退化成 `[object Object]`；四语 locale 需各加 2 键 —— **登记为 §2.4 S2/S3**。依据：`p4-b2c-admin-write.md §4.2-3`；裁定 **Zang §5.78 ③**。

> **登记（v0.4 更新：风险已由 P4-SEC 结构性下降）**：`resolveActor` **曾**把**一切 DB 异常吞成 401**（实测 Neon 抖动令合法 token 也 401）⇒ **P4-SEC 已落**（`src/index.ts` 新增 `unwrapInfraCause`，把 infra 分类为 **503**；实测：受控实例真 token ⇒ **503**、公开常量 token ⇒ **401**；`p4-sec-auth-gate.md`；Zang §5.79）。**残留登记**：`/api/home` 保持**匿名降级**而非 fail-closed。
> **★ v0.4 取证口径精化（Zang §5.84 ③ 裁定）**：本仓**不落请求级 access log** ⇒ 「凡 `401`/`403` 必须核服务端日志逐条归因」**在本仓不可执行**（实测：`panel-logs-after.json` **1199 行**窗口内 `/api/currency` = **0 行**、`403` = **0 行**；仅 2 处 `401` 系**栈帧行号** `src/index.ts:401`）⇒ **正解 = 响应体证据（`R107` 的 `code` + `details.reason`）+ 事件键下零分录取证 + 显式 `NOT_MEASURED`**；**严禁把「日志查不到」写成「日志确认无异常」**。**结构前提** = P4-SEC 后 `resolveActor` 已把 infra 分类为 **503**（吞 401 的风险下降）。依据：`p4-b3b-currency-funds-fix.md §5.1`；**裁定 = Zang §5.84 ③**；登记见 **§7-24 / §8.3-14**。

## §4 资金编排契约（**本规范的核心**）

### 4.0 硬口径（批 2 / 批 3 一律遵守）

| # | 规则 | 依据 |
|---|---|---|
| **R1** | **一切资金动作必须走账本**（**两层口径 · v0.5 精化**）：**禁止**任何 `INSERT/UPDATE` 写 `account.balance` / `account.frozen`。**① 账本层唯一写路径 = `SELECT ledger_post_event($1::jsonb)`**（一个业务事件 = **一条语句** = 一个隐式事务）。**② 业务层唯一入口 = 三个编排函数** `job_post_event` / `listing_post_event` / `market_post_event`（见 R2）—— **服务层不得自拼分录**：批 3b 的 `DatabaseService.jobPostEvent` **只**发 `SELECT public.job_post_event($1::jsonb)`（`src/database.ts:1665`），且 `src/job-funds-service.ts` 内**唯一** `./ledger` 引用是 `:30` 的错误映射助手（**Zang §5.85 A ④ 亲核**）⇒ **「零自拼分录」是结构保证、不是纪律声明** | `DL1`/`DL5`/`DL20`；`backend-ts/src/ledger.ts:866-890`（§5b 写路径）；`src/database.ts:1654-1666`；**Zang §5.85 A ④** |
| **R2** | **业务行 + 分录必须同一事务**：有分录的业务动作**必须**经**业务编排函数**（`job_post_event` / `listing_post_event` / `market_post_event`）——函数内「锁业务行（主键升序）→ 派生分录 → 调 `ledger_post_event` → 回写引用列」，**不改** `ledger_post_event` 函数体 | `DL20` + C1 四条硬约束（`data-layer.spec.md:341`）；`DL141`–`DL144` |
| **R3** | **无分录的写不得借账本幂等**（邀请绑定 / 商品发布 / 纯状态迁移）：其幂等靠**业务侧** `create_key text NOT NULL UNIQUE` + 业务状态机，**绝不**写一条 `ledger_entry` 占位 | **`DL99`**（`data-layer.spec.md:559`）；**批 2 实测**（`p4-b2b-listing-write.md §3.2:134`；`p4-b2a-job-write.md §3.2:105`） |
| **R4** | **「审核通过 → 发放」必须原子**：`approve` 与**发放**（`job_payout`+`job_fee`+`commission`）**必须**在 `job_post_event(op='settle')` 的**同一条语句**内完成。**批 2 不得交付任何 approve 路径**（否则 = 状态落了 `approved`、钱没出 = **静默欠款**）。结论：`/api/tasklist/:jID/verify`（:1000）与 `POST /api/job/:jobId/review` **整条归批 3**；批 2 的 `reject` 分支若实现，**必须**同样经 `op='refund'`（`job_escrow_refund`）在同一语句内退托管 | 父单定案③ + `DL20`；`migrations/0013_job.sql:617-634,650-687`；**批 2 实证「未半实现」**（`p4-b2a-job-write.md §2,§4.1`） |
| **R5** | **批 2 只做非资金写入与状态机**：一切余额/冻结变动（`job_escrow`/`job_payout`/`job_fee`/`commission`/`purchase`/`sale`/`purchase_refund`/`hold`/`hold_release`/`trade`/`trade_fee`/`mint`/`burn`/`listing_fee`/`listing_deposit`/`currency_create_fee`）留批 3 | 父单定案③；**批 2 三片实证** `ledger_entry` **0→0**（§1.4 F10） |
| **R6** | **编排函数自派生幂等键，调用方不得自造**（`DL95`）；**创建类**动作多一个调用方传入的 `create_key`（`cli:` 前缀，`DL94`）。同键同指纹 ⇒ **200 重放**（`idempotent_replay:true`，**不重写业务行**、**不追加 `ledger_event_keys` 项**）；同键异指纹 ⇒ **409** | `DL93`/`DL94`/`DL95`/`DL143`/`DL144`/`DL149`；`commission.ts:117-120` |
| **R7** | **事件级 kind 白名单是硬闸**：每个 op 只允许上表列出的 kind，越界 = **`LEDGER_ACCOUNT_GUARD_VIOLATION`（500，defect，必须告警）** —— 例如 `job` 的 `publish` 只许 `job_escrow`（`migrations/0013_job.sql:637-645`） | `DL84`；`migrations/0013_job.sql:638-644` |
| **R8（v0.2 新增）** | **批 2 交付 = 非资金 service（`src/{job-service,listing-service,admin-service}.ts`）**：三 service 的 `./ledger` / `./commission` **import 实测 = 0/0**（`p4-b2a-job-write.md §2`、`p4-b2b-listing-write.md §2`、`p4-b2c-admin-write.md §2`）⇒ 「零资金」是**结构保证**，不是纪律要求 | 三片 §2 的 `grep` 双口径 + §1.4 F10 的库面 dump hash |

### 4.1 关闭集（**不得扩展**；改集合必须走 migration + 回写 spec）

| 集合 | 取值 | 真源 |
|---|---|---|
| **kind（恰好 20）** | `mint` `burn` `transfer` `hold` `hold_release` `hold_forfeit` `job_escrow` `job_escrow_refund` `job_payout` `job_fee` `commission` `purchase` `sale` `purchase_refund` `trade` `trade_fee` `listing_fee` `listing_deposit` `currency_create_fee` `reversal` | `backend-ts/src/ledger.ts:153-160`（`LEDGER_KINDS`）；`migrations/0003_kind_close_set_20.sql:65-66`；`R40` |
| **`ref_type`（账本分录域，恰好 8）** | `job` `listing` `listing_order` `market_order` `market_trade` `currency` `commission_payout` `system` | `ledger.ts:164-167`；`migrations/0001_ledger_core.sql:84-86`（`ledger_ref_type_enum`）；**注**：与 §3.1 的 `LEDGER_REF_NOT_FOUND.details.ref_type`（业务对象名，开放取值域）**同名不同域** |
| **平台保留 uid** | `0` 平台主体（`$` 铸币源）· `-1` 手续费归集（**只进不出**，`R103`）· `-2` 佣金池（唯一入口 `job_fee`、唯一出口 `commission`）· `-3` 罚没 | `ledger.ts:128-137`；`migrations/0001_ledger_core.sql:96-107`（`ledger_owner`） |
| **hold 家族（同账户 2 条）** | `hold` `hold_release` `job_escrow` `job_escrow_refund`（**★ v0.3 更正：不含 `listing_deposit`**；**★ v0.4 双处兑现**：源码侧 `HOLD_KINDS` **+ DB 侧 `0020` 函数体 IN 列表**均已摘除） | `ledger.ts:178`（`HOLD_KINDS`，**FIX-A 已落地、现取核实 = 4 项**）+ **`migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql`**（函数体 IN 列表**仅删 18 字节**、`prosrc` md5 硬断言；**已应用**）〔**v0.2 旧写法（错，留痕）**：含 `listing_deposit` —— 该成员是 **P1c 漏删**（删 `listing_deposit_forfeit` 时未一并移除），**已由 FIX-A/FIX-A2 两处手术修正**（最小 diff；依据 = **Zang §5.81 / §5.82 裁定① / §5.83**）〕 |
| **冻结可直接结算给对方的 kind** | `job_payout` `purchase` `trade` `hold_forfeit` | `ledger.ts:178-180`（`FROZEN_SETTLE_KINDS`） |
| **`-1` 可 credit 的 kind** | `trade_fee` `listing_fee` `currency_create_fee` `job_fee` + **★ `listing_deposit`（v0.3 新增）**（**`debit` 恒空**） | `ledger.ts:541`（**FIX-A 已落地、现取核实含 `listing_deposit`**）；`migrations/0008_platform_revenue_job_fee.sql:49` + **`migrations/0019_listing_deposit_platform_credit.sql`**（加法式扩展，其余每格逐字不变；**kind 关闭集仍 20**；**已应用** ⇒ `/health` `schema_version=0020`），依据 = **Zang §5.81**；真源复核 = `ledger.spec` §13.2（`−1` 行**已**含 `listing_deposit`）、R101（v0.13 已回写） |
| **`-2` 的进出** | credit：`job_fee`；debit：`commission` | `ledger.ts:542` |
| **`-3`（罚没）可 credit 的 kind** | `hold_forfeit` | 真源 = `ledger.ts:544`（`-3` 白名单含它）；**★ v0.3 更正**：`hold_forfeit` **P3 不启用**（`DL91`，`data-layer.spec.md:533` 逐字「罚没的标的物是**在冻资金**，而 P3 招工争议路径（C7）只做「退回托管」」）⇒ 该格**保留、但不被任何 P3 事件使用**（**无退市罚没**：保证金属消耗、无可罚没标的物）。〔**v0.2 旧写法**：标「裁定 = **Zang §5.73 7-3**（\`-3\` 白名单含它）」〕 |

### 4.2 业务事件总表（触发端点 → 编排函数 → kind → 必需字段 → 幂等键 → 失败/回滚 → 期望码）

> 「期望码」只列**主要**码；完整逐路由码面见 `docs/data-layer.spec.md:719-742`（§11.2）。

| # | 事件 | 触发端点 | 编排函数 / 入口 | 事件 kind（**必须在 §4.1 关闭集内**） | 必需字段 | 幂等键 | 失败 / 回滚语义 | 期望码 | 批 |
|---|---|---|---|---|---|---|---|---|---|
| **J1** | 招工发布 + 托管 | `POST /api/job` | `job_post_event(op='publish')`（`0013:431`） | `job_escrow` **×2** | `create_key`(`cli:`)、`employer_uid`、`cid`、`reward`、`title?`、`description?`、`request_fingerprint` | **create_key** = `job.create_key`（UNIQUE）；**事件根键** = `biz:job:escrow:<job_id>`（函数派生，`0013:555`） | 单语句隐式事务：业务行 + 2 条分录**同生同灭**；任何闸失败 ⇒ 整事件回滚（**不留孤儿 job 行**） | `400` LD005/LD016/LD017/LD022；`404` LD007/LD023；`409` LD001/LD008（未上市，`0013:562-565`）/LD011/LD003 | **批 3b（服务层已落地：`job-funds-service.ts:149` `publishJob`）· 路由层随批 4（§1.8 #1）** |
| **J2** | 申请报名 | `POST /api/job/:jobId/apply`（**路由层随批 4**；service 已实现） | **直 DML**（无分录，R3） | **无** | `job_id`、`worker_uid`、`create_key`(`cli:`) | `job_application.create_key`（UNIQUE）+ `UNIQUE(job_id,worker_uid)`（`0014:91`） | 单语句事务；`job.status<>'open'` ⇒ 拒 | `409` LD011 + `not_open_job`/`self_application_not_allowed`；同键 ⇒ 200 重放；**异键同人** ⇒ `409` LD003 + `application_already_exists`（**不得**让裸 `23505` 落 400） | 批 2（service 已实测） |
| **J3** | 雇主选定打工人 | `POST /api/job/:jobId/accept`（**路由层随批 4**；service 已实现） | **直 DML** | **无** | `job_id`、`application_id`、`actor=employer` | 业务侧：`job_application.status` 状态机 + **部分唯一索引** `uniq_job_application_accepted`（`0014:102`） | 单语句事务；并发「同时选定」由部分唯一索引**结构性**挡 | `403` `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED`（非雇主）；`409` LD011 + `JOB_STATE_INVALID`/`application_already_accepted` | 批 2（service 已实测） |
| **J4** | 提交交付物 | `POST /api/task-progress/:identifier/submit`（:467；**§4.1 新路径 `/api/job/:jobId/submit` 随批 4**） | **直 DML** | **无** | `job_id`、`worker_uid`、`deliverable`、`create_key`(`cli:`) | `job_submission.create_key`（UNIQUE）（`0014:127`） | 单语句事务；`job.status` → `submitted` | `403` `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED`（非打工人）；`409` LD011 + `not_job_worker` | **批 2（HTTP 端到端已实测）** |
| **J5** | **审核通过 → 发放 + 手续费 + 10 级返佣** | `POST /api/tasklist/:jID/verify`（:1000）/ `POST /api/job/:jobId/review` | `job_post_event(op='settle')`（`0013:591-592,632-633`） | `job_payout` **×2** + `job_fee` **×2**（`fee>0` 时）+ `commission` **×2N**（每层减方 `-2` / 增方受益人；`x_L=0` 的层**不建分录**） | `job_id`、`request_fingerprint`；（`gross` = `job.reward`，`worker_uid` 必须已选定） | **事件根键** = `biz:job:settle:<job_id>`（`= commission.ts:119 jobSettleKey`，**只由 job_id 派生**） | 单语句：`job_payout`→`job_fee`→`commission` 全在同一事件；**任一失败 ⇒ 全部回滚**（**不存在「状态 settled 但没发放」**）；重放 ⇒ 不重写业务行 | `409` LD002（在冻不足）/LD011 + `JOB_STATE_INVALID`；`500` LD032（**佣金守恒断言**）/LD030 | **批 3b（服务层 `settleJob` `:218` / `refundJob` `:237` 已落地；既有 `/api/tasklist/:jID/verify` 已改接、单条 SQL 原子；新路径随批 4 = §1.8 #5）** |
| **J6** | 拒绝 / 取消 → 退托管 | `POST /api/job/:jobId/cancel` / `review(reject)` | `job_post_event(op='refund')`（`0013:583-589,624-630`） | `job_escrow_refund` **×2** | `job_id`、`to_status ∈ {cancelled, rejected}` | `biz:job:refund:<job_id>` | 单语句回滚；`escrow_txid IS NULL` ⇒ **拒**（防凭空退款，`0013:618-623`） | `400` LD016 + `not_a_refund_target`；`409` LD011 + `JOB_STATE_INVALID`/`job_escrow_missing` | **批 3b（拒 / 退分支已由既有 verify 路径承载；`/api/job/:jobId/cancel` 随批 4 = §1.8 #6）** |
| **P1** | 商品上架 / 编辑 / 下架 | `POST /api/listing`（**路由层随批 4**；service 已实现 `createListing`/`updateListing`/`transitionListingStatus`） | **直 DML**（`DL99`：无分录） | **无** | `seller_uid`、`cid`、`price`、`stock`、`title`、`create_key`(`cli:`) | `listing.create_key`（UNIQUE）（`0015:131`） | 单语句事务；状态机 `draft→listed→{delisted,frozen}→listed`（`delisted` 终态） | `409` LD011 + `listing_state_invalid`；`400` LD016/LD017 | 批 2（service 已实测 26 条） |
| **P2** | 商品下单（付款即交付） | `POST /api/listing/:listingId/buy` | `listing_post_event(op='buy')`（`0015:449`） | `purchase` **×1** + `sale` **×1**（**恰好两条**，`DL85`） | `create_key`(`cli:`)、`listing_id`、`buyer_uid`、`quantity`、`request_fingerprint` | **create_key** = `listing_order.create_key`；**事件根键** = `biz:listing:buy:<order_id>`（`0015:624`） | 单语句：`listing` 行锁 → `listing_order` 落行 → 2 条分录 → 回写 `pay_txid`；**超卖靠行锁 + `stock>=0` CHECK** | `409` LD001 + `listing_stock_insufficient`/LD008 + `listing_not_listed`/LD011；`400` LD019 + `self_purchase_not_allowed`/LD018/LD020；`404` LD023 + `listing_not_found` | 批 3 |
| **P3** | 交付 | （无独立端点） | — | — | — | — | 「付款即交付」：`listing_order.status` 由 `buy` 事件置 `paid` 并回写 `pay_txid` | — | — |
| **P4** | 退款 | `POST /api/listing/order/:orderId/refund` | `listing_post_event(op='refund')`（`0015:661-726`） | `purchase_refund` **×2** | `order_id` | `biz:listing:refund:<order_id>`（`0015:667`） | 单语句；`status<>'paid'` / `pay_txid IS NULL` ⇒ 拒；**库存不回滚**（`DL62` 未定 ⇒ 不发明，已裁 §7-7） | `409` LD001/LD011 + `order_not_refundable`/`order_pay_missing`；`404` LD023 | 批 3 |
| **M1** | 交易所挂单 | `POST /api/market/order` / `POST /api/order`（:637） | `market_post_event(op='order')`（`0016:393`） | **`hold` ×2**（同 uid 同 cid） | 买单：`create_key`(`cli:`)、`owner_uid`、`side='buy'`、`base_cid`、`quote_cid`、`price`、`amount`；卖单同（`side='sell'`） | **create_key 即事件根键**（`cli:<uuid>`，`0016:545`） | 单语句；冻结额 = 买单 `amount×price` / 卖单 `amount`；`quote_cid` **恒 1**；base≠quote；`currency` 必须 `listed`（`0016:560-565`） | `400` LD016（`QUOTE_CID_MUST_BE_ONE`/`BASE_QUOTE_CID_EQUAL`）/LD017/LD022；`404` LD007；`409` LD001/LD008 | 批 3 |
| **M2** | 撤单 | `DELETE /api/market/order/:orderId` / `DELETE /api/order/:oID`（:669）/ `DELETE /api/order`（:656，入参走 query） | `market_post_event(op='cancel')`（`0016:618-685`） | **`hold_release` ×2** | `order_id` | `biz:market:cancel:<order_id>`（`0016:625`） | 单语句；释放剩余在冻额（`(amount−amount_filled)×price` / `amount−amount_filled`）；`≤0` ⇒ 拒；状态 `open/partial → cancelled` | `409` LD011 + `MARKET_ORDER_STATE_INVALID`/`market_order_nothing_to_release`；`404` LD023 + `order_not_found` | 批 3 |
| **M3** | 撮合成交 | （撮合服务调用；批 3 新端点） | `market_post_event(op='trade')`（`0016:687-...`） | **`trade` ×4** + **`trade_fee` ×2**（`fee=0` ⇒ 只 4 条） | `buy_order_id`、`sell_order_id`、`taker_order_id`、`amount`、`price`、`fee?` | `biz:market:trade:<taker_order_id>:<fill_no>`（`0016:382`） | 6 条分录同一事件；**成交价必须等于买单限价**（否则拒，`0016:58-63`）；`amount_filled` 单调且 `≤ amount` | `400` LD016 + `TAKER_NOT_A_PARTY`/`MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`；`409` LD001/LD002 | 批 3 |
| **C1** | 自定义积分创建（建单位） | `POST /api/currency`（**已注册**：`src/index.ts:1160`） | **单语句 CTE**（迁移冻结 ⇒ 不新增编排函数）：`src/currency-service.ts` `createCurrencyVerb` + `DatabaseService.createCurrencyWithFee`（一条 `SELECT` = 隐式事务） | `currency_create_fee` **×2**（owner `balance −fee` / `-1` `balance +fee`） | `symbol`、`name`、`decimals`、`owner_uid`（**须 = actor**）、**`fee`（★ v0.4：服务端取数 + 下限校验，`FIX-B` 已落地，见 §4.4-11）**——未传 ⇒ 服务端常量，传值须 `≥ 下限` | 调用方 `create_key`/`idempotency_key`/`Idempotency-Key`（`cli:`/`biz:`/`ops:`/`cm:`）；**缺省派生** `biz:currency:create:<symbol>` | 单语句隐式事务：业务行 + 2 条分录**同生同灭**（**实测**：余额不足 ⇒ `currency` 插入整条回滚、**无孤儿行**）；门控 CTE ⇒ 重放 / 符号占用 / 越权**一律零分录** | `401` AUTH_UNAUTHORIZED；`403` AUTH_FORBIDDEN(+`ACTOR_NOT_ALLOWED`)；`400` LD005/LD016/LD017/**LD018(`LEDGER_AMOUNT_NOT_POSITIVE`+`BELOW_SERVER_FLOOR`)**；`409` LD001/LD003/LD033 | **批 3a（已落地 · 真收官）** |
| **C2** | 上市 → 收上市费 + **消耗保证金** | `POST /api/currency/:cid/list`（**已注册**：`src/index.ts:1179`） | **单语句 CTE**：`src/currency-service.ts` `listCurrencyVerb` + `DatabaseService.listCurrencyWithDeposit` | **★ Zang §5.81 最终口径（v0.4 已兑现 = FIX-B 落地）**：上市费 `currency_create_fee` **×2** → `-1`（消耗）+ 保证金 `listing_deposit` **×2** → **贷 `uid = -1`**（**上市即消耗**）。**4 腿全在 `balance`、`frozen` 零变动**（§1.7 H3）。**不可退、无退还 kind（`listing_deposit_refund` 不存在）、无罚没** | `cid`、`actor`（**必须 = 该币 `owner_uid`**）、**`fee`/`deposit_amount`（★ v0.4：服务端取数 + 下限校验，`FIX-B` 已落地）**——未传 ⇒ 服务端常量 | 调用方键优先；**缺省派生** `biz:currency:list:<cid>` | 单语句隐式事务；状态迁移 `draft→listed` **必须同事务写 `currency_status_log`**（**实测** +1 行）；保证金不足 ⇒ 状态/审计/分录**三零残留** | `401`；`403` AUTH_FORBIDDEN + `reason=ACTOR_NOT_ALLOWED`（`condition=not_currency_owner`）；`400` LD005/LD017/**LD018(`BELOW_SERVER_FLOOR`)**；`404` LD007（含 `cid<=0`）；`409` LD001/LD003/LD011(`LEDGER_CURRENCY_INVALID_TRANSITION`) | **批 3a（已落地 · 真收官；★ FIX-B 已把保证金改为消耗入 `-1`、金额改服务端取数）** |
| **C3** | 退市 / 罚没 | **（P3 无此动作 ⇒ 不建端点）** | — | **无** | — | — | **★ Zang §5.81 + `DL67`(`data-layer.spec.md:454`) / `DL88`(`:530`) / `DL91`(`:533`)：P3 退市「**无账务动作**」（保证金已在上市时消耗 ⇒ **不退**）；强制下架**亦无账务动作**（**不存在可罚没的标的物**）⇒ 不退、不罚、不建端点、不建幂等键**；**将来若做「强制下架罚款」= 新语义新 kind，须单独裁定**（见 §7-22） | — | **批 3a（登记：不实现）** |
| **R1** | 邀请绑定（**终身绑定**） | `POST /api/referral/bind`（**路由层随批 4**） | `referral_bind(child,parent)`（`0007:241`） | **无分录**（`DL99`/CR19 明令） | `child_uid`、`parent_uid`（`depth` **不得**作入参，`0007:187`） | 业务侧：`referral` PK(`child_uid`) ⇒ **一 child 一 parent 且不可变**（`0007:67` append-only 触发器） | 单语句；串行化 = `users` 两行 `FOR UPDATE`（uid 升序，`0007:205-206,255-256`） | 同 (C,P) ⇒ 200 重放；C 已绑他人 ⇒ `409` LD003 + `REFERRAL_ALREADY_BOUND`；自指 ⇒ `400` LD016 + `REFERRAL_SELF_BIND`；成环 ⇒ `400` LD016 + `REFERRAL_CYCLE_REJECTED` | 批 2（service）；路由批 4 |
| **R2** | 打工酬金 → 平台费 → **10 级返佣按权重分发** | （由 J5 触发，无独立端点） | `job_settle_plan(...)`（`0013:250`）+ `job_post_event(op='settle')` | `job_payout` `job_fee` `commission` | `fee_rate_bp ∈ [100,500]`（**= 1%–5%**）、`levels ∈ [1,10]`、`weights_bp`（Σ ≤ 10000） | `biz:job:settle:<job_id>` | **最大余数法**：`Σx_L == P` **构造保证**（`D = P − Σq` 按 `(r_L DESC, L DESC)` 补 1）；**分配失败 = 500 defect**（`0013:342-360`） | 见 J5 | 批 3 |
| **R3** | 变更佣金政策（后台可设） | `POST /api/admin/commission_policy`（**路由层随批 4**） | `insertCommissionPolicy`（`commission.ts:240`） | **无分录**（插一行政策） | `fee_rate_bp`、`levels`、`weights_bp`、`effective_from?`、`created_by` | 无（INSERT-only 表；`effective_from` **严格递增**） | 单语句 `INSERT ... WHERE NOT EXISTS(≥ now())`；失败 ⇒ 无行 ⇒ 400 | `400` LD016 + `FEE_RATE_OUT_OF_RANGE`/`POLICY_SHAPE_INVALID`/`WEIGHTS_SUM_EXCEEDS_10000`/`POLICY_WEIGHTS_ALL_ZERO`/`POLICY_EFFECTIVE_BACKDATED` | 批 2（service）；路由批 4 |
| **A1** | 管理员调分（**保留但锁死**） | `POST /api/admin/points/adjust`（:1066） | `ledger_post_event(op='mint'\|'burn')` | `mint` / `burn`（**仅 `$` = cid 1**） | `target_uid`、`cid=1`、`amount`、**必填原因码** | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | 单语句；**禁止**直接 UPDATE `account`；`burn` 受 `R25` 限制 | `403` `AUTH_FORBIDDEN`；`400` LD022/LD016 + `points_adjust_amount_invalid`/`reason_code_missing`；`500` LD031 | 批 3 |

### 4.3 资金四栏（**谁出钱 / 谁收钱 / 平台费的来源 / 佣金的来源与分配**）

| 事件 | **谁出钱** | **谁收钱** | **平台费的来源** | **佣金的来源与分配** |
|---|---|---|---|---|
| **J1 发布托管** | 雇主（`employer_uid`）**可用余额** `−reward` | **无人**（转为雇主自己的**冻结** `+reward`） | — | —。**★ 批 3b 实测**：`job_escrow` **×2 全在 uid 2**（`(−400,0)` / `(0,+400)`，`frozen_after=400`）；事件 **`Σ(delta+frozen_delta) = 0`**；同键重投 ⇒ 分录**仍 2 腿**、业务行未重写（`p4-b3c §4.1 E2/E3`） |
| **J5 结算（R2 核心）** | 雇主（从**冻结额**出）`−net`（`job_payout`）+ `−fee`（`job_fee`） | 打工人 `+net`（`job_payout`） | **`fee = (gross×fee_rate_bp + 5000)/10000`**（**全项目唯一取整点**，半进位；`fee_rate_bp ∈ [100,500]` ⇒ **1%–5%**，后台可设）。**有邀请人 ⇒ 全额入 `-2`（佣金池，`D6` 平台不抽成）**；**无邀请人 ⇒ 全额入 `-1`（平台收入）** | **来源 = 佣金池 `-2` 的全额 `fee`**（不是额外再收）；**分配** = 沿 `referral` 链上溯 `M = min(levels, chain_depth)` 层，按 `weights_bp[1..M]` **重归一化**（`W = Σ_{L≤M} w_L`，**不是 10000**）用**最大余数法**分配 ⇒ **`Σx_L == fee` 逐分不差**；`x_L = 0` 的层**不建分录**。**★ 批 3b DL86 两形态均实测**：**① 无邀请人** ⇒ `job_fee` 入 **`-1`**、**`-2` 命中 0**（4 腿：uid2 `−396`/uid3 `+396` + uid2 `−4`/**uid −1 `+4`**）；**② 真链 `depth=2`** ⇒ **8 腿** = `job_payout`×2 + `job_fee`×2 + **`commission`×4**，`-2` **进 +10 / 出 −10**（受益人合计 +10 ⇒ **池进出守恒**）、**`-1` 命中 0**（有链 ⇒ 不得写 `-1`，DL86 逐字）（`p4-b3c §4.1 E5/E8`；**Zang §5.85 A 采信**） |
| **J6 退托管** | 雇主（从**冻结额**出 `−reward`） | 雇主自己（可用余额 `+reward`） | — | —。**★ 批 3b 实测**：`job_escrow_refund` ×2 全在 uid 2（`(+300,0)` / `(0,−300)`）、**同账户 `balance↔frozen` 2 腿**、事件 `Σ=0`；`escrow_txid IS NULL` ⇒ **拒**（防凭空退款）（`p4-b3c §4.1 E9/E10/E11`） |
| **P2 商品下单** | 买家（**可用余额** `−amount`，`amount = listing.price × quantity`） | 卖家 `+amount`（`sale`） | **无平台费**（`DL85` 钉死**恰好两条**：`purchase`+`sale`；商品柱不抽成） | — |
| **P4 退款** | 卖家（**可用余额** `−amount`） | 买家 `+amount`（`purchase_refund` ×2） | — | — |
| **M1 挂单** | 挂单人（买单：`$` 可用 → 冻结 `amount×price`；卖单：base 币 `amount`） | **无人**（冻结） | — | — |
| **M2 撤单** | 挂单人（冻结 → 可用） | 挂单人自己 | — | — |
| **M3 成交** | 买方 `−quote`、卖方 `−base`（**均从各自冻结额结算**；`trade` ×4） | 买方 `+base`、卖方 `+quote` | **`trade_fee` = `amount × 费率`**，**承担方 = taker**，**币种恒 `$`（cid=1）**，**是消耗不是冻结**（`撤单不退`，`DL87`）；**全额入 `-1`** | — |
| **R1 邀请绑定** | **无人出钱**（`DL99`/CR19 明令不得写分录） | — | — | — |
| **A1 调分** | 平台（`mint`）或目标用户（`burn`） | 目标用户（`mint`）或（`burn` ⇒ 无受款方，净减发） | — | — |
| **C2 上市（★ v0.3 更正 = Zang §5.81）** | 币种 `owner_uid`（可用余额 `$`）：**上市费** `currency_create_fee`（消耗 1 笔）+ **保证金** `listing_deposit`（**消耗** 1 笔） | **两者都入平台收入 `-1`**（保证金 = **上市即消耗**、**计入平台收入**）；**无罚没** | 上市费（消耗性）→ `-1`；**保证金（消耗性）→ 亦入 `-1`** | — 〔**v0.2 旧写法（错，留痕）**：保证金入「**自己的冻结**」、违约罚没 `hold_forfeit`→`-3`〕 |

### 4.4 逐条补充判决（写死，实现方不得自选）

1. **J5 的 `fee = 0` 退化**：`fee = 0` ⇒ 事件**只有** `job_payout` ×2（**不写** `job_fee`、**不写** `commission`、**不报错**）；派生键集合 = `{K, K#2}`。依据：`commission.ts:20-22`（CR51）。
2. **J5 的 DB 侧后置断言（第二道防线）**：`migrations/0007_referral_and_commission_policy.sql:317` 的 `trg_ledger_entry_commission_conservation` 对同一 `event_root_key` 断言 `Σcommission 出 -2 == Σjob_fee 入 -2`，失败抛 **`LD032` ⇒ `LEDGER_RECONCILE_MISMATCH` ⇒ 500 defect + R108 告警**（`0021:37` 的诚实边界：**只**断言 `-2` 池进出守恒，**不**断言「受益人分对了人」）。
3. **归属闸（应用层，落账前）**：`assertReferralChainInvariants`（`commission.ts:360`）对邀请链做**结构断言硬拒**（`no_duplicate_uid` / `contiguous_levels` / `all_user_uids`），失败 ⇒ `500` + `reason=COMMISSION_CHAIN_ASSERTION_VIOLATED`（**环污染时 Σ 守恒仍成立**，DB 侧断言会**放行** ⇒ 必须在应用层拦，`commission.ts:340-359`）。
4. **锁序不依赖传序、但数组顺序必须确定性可复现**：R79 全序由 DB 内部 `SELECT DISTINCT uid,cid ORDER BY 1,2` 决定（「数组顺序不影响锁序」）；**但**数组顺序决定**派生键序号与错误优先级** ⇒ 分录数组必须由模块按 `idx` 重建（`commission.ts:28-32`）。
5. **`DL141` 加锁全序**：**业务行（主键升序）→ `currency`（cid 升序）→ `account`（uid 升序）**；编排函数**必须**在调 `ledger_post_event` **之前**持有业务行锁；**禁止**「先锁 account 再锁业务行」（`data-layer.spec.md:341` ①）；**批 2 实证**（`p4-b2b-listing-write.md §2`：单语句 CTE + `FOR UPDATE` 业务行先锁）。
6. **币种状态闸**：招工酬金 / 商品标价 / 交易所挂单**只允许 `listed` 单位**（`R28`）；`draft`⇒`409 LD008`、`frozen`⇒`423 LD009`、`delisted`⇒`409 LD010`；**平台/保留 uid 前置闸** ⇒ `400 LD022`。**这两道闸必须在路由层先跑**（`DL125`）。**批 2b 落点偏差登记**：商品路径未注册（§1.2）⇒ 闸落在 **service + 单语句 CTE 内**（原子、一次往返），错误码仍一一对应；**待 Zang 复核**（见 §7-17）。
7. **`-1` 只进不出（`R103`）**：任何把 `-1` 当付款方的动作**一律拒**（`LEDGER_RESERVED_UID` + `PLATFORM_DEBIT_FORBIDDEN`，`ledger.ts:548-558`）；`platform_withdraw` **未实现且未获批准**（`DL153`）。**（v0.3）**：白名单现含 **`listing_deposit`**（`0019`，FIX-A）—— 保证金是**进 `-1` 的消耗** ⇒ `-1` 的**收入口径** = `trade_fee` + `listing_fee` + `currency_create_fee` + `job_fee` + **`listing_deposit`**（`ledger.spec` §13.2 已如此登记）。
8. **`platform` mint 授权**：`$` 的 `owner_uid=0`，只有平台受信任路径可铸（`R23`/`LD014`）。
9. **单笔金额上限** `1e15`（`MAX_SINGLE_AMOUNT`，`ledger.ts:143`）；金额一律**最小单位整数**（入参十进制字符串走 DB 换算，`R66`/`R70`）；**批 2 实证**（`p4-b2b-listing-write.md §3.2:139`：`price="200"` 十进制字符串落库 200）。
10. **`job_fee` 入 `-1` 的分支已在 DB 白名单**（`0008`）：无邀请人时 `job_fee` credit 到 `-1` 走的是 `0008` 加白的通道（`ledger.ts:538-541`），**不是**例外。
11. **（v0.3 新增）费率 / 保证金金额必须服务端取数（标 `FIX-B 落地`）**：批 3a 现为**客户端必填** `fee` / `deposit_amount`（`src/currency-service.ts:188,292,294`；`toRequiredPositive`）⇒ 调用方可传 `fee=1` **绕过** ⇒ 已被 **Zang §5.81** 判为**资金面的洞**（逐字：「现客户端传 `fee`/`deposit_amount` ⇒ **可传 `fee=1` 绕过 = 资金面真洞**」）。**本册口径**：**金额必须服务端取数（配置真源或下限校验），不得由调用方决定**；`FIX-B` 落地时改为服务端取数并补「下限校验」的判负用例。费率真源 = `commission_policy.fee_rate_bp`（**唯一真源**，`ledger.spec` §14.1 #32 / §5.20 #3）；**保证金下限（数值）待 Kevin 给数 ⇒ 见 §7-23**。
12. **（v0.4 新增）金额取值口径 = 服务端取数 + 下限校验（`FIX-B` 已落地）**：C1/C2 的 `fee`/`deposit_amount` **不得由客户端决定** —— **未传** ⇒ 取**服务端常量**（`fee_source = server_default`）；**传了** ⇒ 形状闸（正整数 · `≤ 1e15`）后须 **`≥ 下限`**，**低于 ⇒ `400 LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason = BELOW_SERVER_FLOOR`**（`details = {field,value,min}`；**Zang §5.84 ① 正式化**；备选码 `LEDGER_AMOUNT_INVALID` **未采纳**）；事实入参与**请求指纹**一律用**生效值**（服务端值）。**随之的期望变更（Zang §5.84 ② 批准）**：`p4-b3a-currency-funds.md` 的 **C1-T05 / C2-T17**（原文「缺值 ⇒ 400」）期望**改为 `200`**（**注意与 `p4-b3b` 报告里同号不同案的 C1-T05/C2-T17 区分** —— 后者是「`fee=999`/`deposit_amount=999` < 下限 ⇒ 400」）。下限常量 = `currency-service.ts:140-142`（**1000 / 1000 / 1000**），逐条标 **`TODO: Kevin 定值`**（**占位非经济值**）。依据：`p4-b3b-currency-funds-fix.md §3,§5,§8`；**Zang §5.82 7-23 + §5.84 ①/②**。
13. **（v0.5 新增）J5/J6 的金额零客户端输入（批 3b · D1）**：J5/J6 的 payload **不含任何金额** —— `gross = job.reward`（`migrations/0013_job.sql:632`）、`fee = f(reward, commission_policy.fee_rate_bp)` 由 DB `job_settle_plan` 派生 ⇒ §4.4-11/12 的「客户端传 `fee=1` 绕过」在**招工面结构上不存在**（**不是**「已校验」，是**没有该入参**）；J1 的 `reward` 是**雇主自定的业务约定额**（`DL50`：`job.reward` 是业务约定额、不是余额/费率）⇒ **不适用**「金额服务端取数」。**本片未引入任何下限常量、未发明任何数值**。依据：`p4-b3c-job-funds.md §2.2 D1`。
14. **（v0.5 新增）J1 的 `create_key` 缺失 ⇒ fail-loud（不派生）**：与批 2a `resolveJobCreateKey`（`src/job-service.ts:90`）的**内容派生兜底**口径**不同** —— 理由：该键是创建面**唯一权力**，内容派生会让「同内容的两条不同招工」相互碰撞成 `200` 重放（**静默丢单**）。实测：`J1_neg_no_key ⇒ 400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`、`J1_neg_bad_prefix ⇒ 400 …_INVALID`（`PREFIX_REQUIRED`）。真源 = `src/job-funds-service.ts:84` `resolveJobCreateKeyRequired`（§4.5）。**Zang §5.85 裁定③ 批准「fail-loud 优于 2a 派生兜底」并立案审 2a 是否同类静默重放（FIX-JOBKEY）** ⇒ **3b 面 = 已定；2a 面与连带前端同步项 = 待 Zang**（**§7-25**）。依据：`p4-b3c-job-funds.md §2.2 D2`。
15. **（v0.5 新增）「审核通过 → 发放」原子 = 一条 SQL 语句（批 3b · D4）**：`DatabaseService.reviewJobSubmission` = `WITH ev AS (SELECT public.job_post_event(…))` + `sub AS (UPDATE public.job_submission …)` + 末 `SELECT`（**`src/database.ts:1732-1750`**）⇒ **`job_submission.review_status` 的结论位与全部分录同生同灭**（`migrations/0014_job_flow.sql:209-248` 的不可变守卫把结论位做成一次性写定；本片在同一 UPDATE 内一次写全 `review_status/reviewed_by/reviewed_at/review_memo`）⇒ **R4 兑现**（连「已审核但没发放」也不可能）。实测 = E6（`review_status='approved'` / `reviewed_by=1` / `review_memo='job settle:5'` 与 4 条分录**同一次调用**落库）；**Zang §5.85 A ③ 亲读**。
16. **（v0.5 新增）路由入口 `:jID` 的语义 = `job_application.application_id`（容错兼收 `job_id`）（批 3b · D5）**：前端读口 `getTaskProgress`（`src/database.ts:1144`）与 `listPendingVerification`（`:1851`）都返回 `a.application_id AS "jID"` ⇒ **必须先解析到 `job_id` 再调编排函数**（§4.2 J5 的「必需字段 = `job_id`」是**编排入参**、不是 URL 参数）。实现 = `resolveReviewTarget`（**只读**；`src/database.ts:1677`）。依据：`p4-b3c-job-funds.md §2.2 D5`。
17. **（v0.5 新增）成功面键集冻结（批 3b · D6）**：`POST /api/tasklist/:jID/verify` 实测 **approve = 11 键**（`jID,tID,uID,info_input,time_created,time_submitted,time_checked,time_claimed,points_claimed,task,user`）、**reject = 9 键**（同前 9 键）—— **与改接前逐键一致**（改接前 = `TaskProgressRecord` 9 键 + `task` + `user`）；唯一新增 = **重放时顶层** `idempotent_replay:true`（§3.2「200（良性）」/ R106 的既有标记手法，**非 `data` 键**）⇒ 与 §2 母约束 F1 / §3.3-8 **不冲突**。依据：`p4-b3c-job-funds.md §2.2 D6,§4.4`。

### 4.5 幂等键总表（创建键 vs 事件根键）

| 动作 | 创建键（调用方传，`cli:`） | 事件根键（**函数派生**） | 真源 |
|---|---|---|---|
| 招工发布 | `job.create_key` = `cli:<uuid-v4>`（**★ v0.5：缺省 ⇒ fail-loud 不派生**，§4.4-14 / §7-25） | `biz:job:escrow:<job_id>` | `0013:555`；`src/job-funds-service.ts:84,149` |
| 招工结算 | — | `biz:job:settle:<job_id>` | `0013:592` = `commission.ts:119` |
| 招工退款 | — | `biz:job:refund:<job_id>` | `0013:589` |
| 商品上架/编辑/下架（P1） | `listing.create_key` = `cli:<uuid-v4>`（**或函数派生**） | **无**（无分录，`DL99`） | `0015:131`；`p4-b2b-listing-write.md §3.2:135` |
| 商品下单 | `listing_order.create_key` = `cli:<uuid-v4>` | `biz:listing:buy:<order_id>` | `0015:624` |
| 商品退款 | — | `biz:listing:refund:<order_id>` | `0015:667` |
| 交易所挂单 | `market_order.create_key` = `cli:<uuid>`（**即**事件根键） | 同左 | `0016:545` |
| 交易所撤单 | — | `biz:market:cancel:<order_id>` | `0016:625` |
| 交易所成交 | — | `biz:market:trade:<taker_order_id>:<fill_no>` | `0016:382` |
| 管理员调分 | — | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | §4.1 #54（`data-layer.spec.md:292`） |
| **建单位（C1，v0.3 新增）** | 调用方 `create_key`/`idempotency_key`/`Idempotency-Key`（`cli:`/`biz:`/`ops:`/`cm:`，**须过 §4.5 校验序**） | **缺省确定派生** `biz:currency:create:<symbol>` | `backend-ts/src/currency-service.ts:82,193`；`p4-b3a-currency-funds.md §3.3,§5.5` |
| **上市（C2，v0.3 新增）** | 同上 | **缺省确定派生** `biz:currency:list:<cid>` | `backend-ts/src/currency-service.ts:82,299`；`p4-b3a-currency-funds.md §3.3,§5.5` |
| **后台设置写（★ v0.2 落定）** | 请求侧 `ops:<admin_uid>:<action>:<key>`（**强校验、不落库**） | **无**（`app_config` 无幂等键列） | `DL36`（`data-layer.spec.md:326`）；**实测** `p4-b2c-admin-write.md §4.2-2`（T08/T16 缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）；裁定 **Zang §5.78 ②** |
| 邀请绑定 | 无账本键（业务侧 `referral` PK） | **无** | `DL99`/`0007:241` |
| 报名 / 提交 | 各表 `create_key` = `cli:<uuid>` | **无** | `DL99`/`0014:89,127` |

**规则**：键前缀**只允许** `biz:` `cm:` `cli:` `ops:`（`ledger.ts:404`）；键**不得**含 `#`（内部派生分隔符）与控制字符；校验顺序固定 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`（`ledger.ts:419-451`，与 DB 侧 `0005` **同序同码**）。**批 2 实测**：坏前缀 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_INVALID` + `reason=PREFIX_REQUIRED`（`p4-b2b-listing-write.md §3.2:136`；`p4-b2c-admin-write.md §3.1 T12`）。

> **★ v0.2 新增：`ops:` 键的落地形态（`DL36`）** —— **请求侧强校验、不落库**。实现口径（`p4-b2c-admin-write.md §4.2-2`）：接收 `body.create_key` / `body.idempotency_key` / `Idempotency-Key` 头（须 `ops:` 前缀）；缺失 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`；前缀非法 ⇒ `400 ..._INVALID` + `PREFIX_REQUIRED`。**四表（`app_config`/`admin_role*`）无幂等键列（`0017` 逐列契约冻结）** ⇒ **不实现「同键重放」**（无指纹列可比）—— 键在此是**形状契约**（fail-loud），**不是**重放机制。**代价登记**：冻结的旧前端 3 页 4 个写口会 `400` ⇒ **§2.4 S1**。裁定 **Zang §5.78 ②**（「批准；fail-loud 优于静默重复写」）。

### 4.6 批 2 / 批 3 切分（**实现交付清单**）

| 批 | 交付内容（本册口径） | 理由 | 批 2 实际交付（v0.2 实测） |
|---|---|---|---|
| **批 2** | ① J2/J3/J4（报名 / 选定 / 提交；**无分录**）；② P1（商品上架/编辑/下架；**无分录**）；③ R1 邀请绑定；④ R3 佣金政策插行；⑤ 后台与读口换源：`/api/admin/permissions*`→`admin_role*`、`/api/admin/settings*`→`app_config`（**撤 `settings/reset`**）、`/api/user/all|stats`、`/api/user/profile`、`/api/market/*/candles`、`/api/user/points|ledger`、`/api/referral/earnings`；⑥ `GET /api/task/:tID` miss ⇒ **404**；⑦ `DL155` 收口；⑧ §5 弃用面落地 | **一切资金动作留批 3**（父单定案③）；批 2 的副作用面只有**业务行状态与引用列** | **service 已交付、对外路径随批 4**：`job-service.ts`（J2/J3/J4）、`listing-service.ts`（P1）；**已落地**：`/api/admin/permissions*`、`/api/admin/settings*`、`/api/user/{all,stats,profile}`、`GET /api/task/:tID` miss 404、13 个 `410` 面、401/403→`R107`、`/api/admin/me` 6 键；**`DL155` 早已闭合**（§7-11）；**未注册** = `/api/job/*`、`POST /api/listing`、`/api/referral/*`、`/api/user/points|ledger`、`/api/market/*/candles`（§1.2 + 证据见 §1.4） |
| **批 3** | J1/J5/J6、P2/P4、M1/M2/M3、A1、C1/C2（**C2 = 上市费 + 保证金；★ v0.3 更正口径：保证金 = 消耗入 `-1`**，见 §7-3）、`/api/tasklist/:jID/verify` 与 `/api/job/:jobId/review` 的 approve 分支；全部经 §4.2 的编排函数（**C1/C2 例外：迁移冻结 ⇒ 单语句 CTE**） | 涉及资金守恒、幂等、重放 ⇒ 必须端到端（含 P1/P2 套件回归） | **批 3a（币种面）已交付 22/22 e2e**（§1.6 G1–G5）；**★ FIX-A 已落地**（`ledger.ts` 从 `HOLD_KINDS` 移除 `listing_deposit`（`:178`）+ `0019` 加白 + `/health` 自报 `schema_version=0019`）**批 3a（币种面）= 真收官**（§1.7 H1–H8：`0019`/`0020` 已应用 + C2 4 腿全在 `balance` + 金额服务端下限）；**★ 批 3b（招工资金）= 已交付**（§1.9：`job-funds-service.ts` 330 行 + `database.ts` +3 method + `POST /api/tasklist/:jID/verify` 改接 + DL86 两形态实测 + **注册点 53→53**）；**未交付** = P2/P4、M1/M2/M3、A1 与 §1.8 的 8 条未注册路径 |
| **批 4** | 路径切换（§4.1 目标命名）+ 前端迁移（§2.4）+ 弃用面 410→删除 | 需前端先迁（§5.4） | — |
| **批 6** | 权限种子迁移（数据层补遗）+ `isAdminAddress` 第三真源收敛 + §5.78 的 `NOT_MEASURED` 面补测 | §6.5 顺序依赖 | — |

## §5 弃用面与前端同步（**最终处置 = 本册裁定**）

### 5.1 逐项最终处置表

| 面 | 端点（`index.ts:行号`，v0.1 口径） | 现状（**批 2 实测**） | **本册最终处置** | 前端消费点（`文件:行号`） | 前端改造要求 | 过期日 |
|---|---|---|---|---|---|---|
| 碎片读口 ① | `GET /api/shard`（:557） | 令牌下 `200` 空数组 + 顶层 `deprecated:true`（**保留**） | **保留路径 + 保持空态 + `deprecated:true`**（读口不返回错）；语义由 `/api/user/points`（`account` 按 cid）取代 | `ProfilePage.jsx:92`、`RewardPage.jsx:58`、`ShardPage.jsx:301` | 迁移到 `GET /api/user/points`（批 4）；**禁止**新代码再调 `/api/shard` | **批 4 前端迁移验收通过之日**（§7-1）→ 转 410 → 删除 |
| 碎片读口 ② | `GET /api/shard/transfer`（:572） | 同上（**保留**） | **保留路径 + 空态 + `deprecated:true`**；语义由 `GET /api/user/ledger?kind=transfer` 取代 | `ShardPage.jsx:303` | 迁移到 `/api/user/ledger` | 同上 |
| 碎片写口 ① | `POST /api/shard/redeem`（:587） | **`410` + `R107` + `details.sunset`**（无 token / 有 token **均 410**） | **`410` 已落地**（写动作**不得**用空态 200 冒充成功） | `RewardPage.jsx:196` | **删除该按钮/分支**（碎片兑换在 `cid` 模型里无对应语义；等值动作 = 交易所 `trade` 或 `transfer`） | 批 4 删路径 |
| 宝箱写口 | `POST /api/chest/:bID/open`（:605） | **`410` + `R107` + `sunset`** | **`410` 已落地**（「凭空调入余额」与 `DL5` 双分录正面冲突） | `RewardPage.jsx:217` | **删除该按钮/分支**；若未来要做 ⇒ 走 `mint`/`purchase` 且**单独裁定** | 批 4 删路径 |
| 商品持有读口 | `GET /api/prize-item`（:420） | 令牌下读 `listing_order`（**真实语义**）；**顶层无 `deprecated`**（实测） | **保留且正式化：不删路径、不标 `deprecated`**（B1-c 已接到新 schema，硬删会丢真实读口且前端 3 处消费）⇒ **本项已满足** | `ProfilePage.jsx:106`、`HomePage.jsx:119`、`RewardPage.jsx:56` | **无需迁移**（键集 6 键冻结）；批 4 可另开 `/api/listing/order/mine` 作别名 | 无（长期保留） |
| 登录别名 | `POST /api/auth/login`（:264） | 内部 `req.url` 改写转发 verify（**隐藏双路径**）；**批 2 未改** | **改 `410`**（同一实现两条路径 = 两套指纹面）：§4.1 #10 逐字「**删除 `login`**，只留 `verify`」⇒ **待批 4** | **0 处**（本册实测：`frontend/src` 内 `auth/login` **0 命中**） | 无（前端无消费） | 批 4 删路径 |
| 注册残件 | `POST /api/auth/register`（:228） | 固定发 `410`（形状未对齐 `R107`）；**批 2 未触及** ⇒ `NOT_MEASURED` | **保留 `410` 但响应体须改 `R107` 形状**（`DL35` 过渡条）；**待批 4** | **仅测试**：`frontend/src/test/unit/auth.test.js:75`（断言抛 `deprecated endpoint`） | **必须同步该测试**（否则单测必红）＝ §2.4 S6 | 批 4 删路径 |
| 后台发布招工 | `POST /api/admin/task/{create,update,delete}`（:842/:855/:876） | **`410` + `R107` + `sunset` ×3**（实测） | **`410` 已落地**（用户需求③：管理员不再发布 task/reward） | `admin/TasksManagement.jsx:130,140,177` | **页面只读化**（删三个写按钮）；列表仍可用 `GET /api/task/all` ＝ §2.4 S5 | 批 4 删路径 |
| 后台发布商品 | `POST /api/admin/prize/{create,update,delete}`（:894/:907/:928） | **`410` + `R107` + `sunset` ×3**（实测） | **`410` 已落地**（**C3 ① 终审「整体删除」**）；合规下架另立 P6 `/api/admin/listing/:id/takedown` | `admin/RewardsManagement.jsx:154,164,201` | **页面只读化**；列表仍可用 `GET /api/prize/all` ＝ §2.4 S5 | 批 4 删路径 |
| 一键重置设置 | `POST /api/admin/settings/reset`（:750） | **`410` + `R107` + `sunset`**（无 token 亦 410，**不伪装 401**） | **`410` 已落地**（**C3 ② 终审「删除」**：无审计的批量破坏写） | `admin/SystemSettings.jsx:123` | **删除该按钮**；逐项改走 `POST /api/admin/settings`（每条一键 + 一条留痕） ＝ §2.4 S5 | 批 4 删路径 |
| 资产初始化 | `POST /api/admin/assets/init`（:1056） | **改前 `500`**（`relation "asset" does not exist`）⇒ **批 2c 补齐为 `410` + `R107` + `sunset`**（实测） | **`410` 已落地**（§4.1 #53 删除；账户由 DB 按需 0/0 开户，`R75`） | **0 处**（本册实测） | 无 | 批 4 删路径 |
| 权限面板弃用标 | `GET /api/admin/permissions`（:763） | 批 2c **撤销 `deprecated`**（实测顶层无 `deprecated`）+ 撤 3 个内置合成组 | **撤销 `deprecated` 已落地**（批 2 换数据源到 `admin_role*` 后即正式口） | `admin/PermissionsManagement.jsx:55` | 无需改（键集 8 键不变）；`:133/:176` 的 save/delete 继续用 | 无 |

**统一要求（对全部 13 个 `410` 面）**：`410` 响应体**必须**是 `R107` 形状（`{error:{code,message,i18n_key,details}}`），`code` = `LEDGER_REF_NOT_FOUND`，**`details` 必须含 `sunset`（过期日）**；**禁止**回 HTML、禁止 200 空态、禁止裸文本。依据：`DL35`（`data-layer.spec.md:325`）逐字「若确需过渡，只能用 410 + `{error:{code:'LEDGER_REF_NOT_FOUND'}}` 且**登记过期日**」。**实测范例**：`details = {ref_type:"endpoint", ref_id:"/api/admin/prize/create", http_status:410, sunset:"批 4 删路径（未决 §7-1…）"}`（`p4-b2b-listing-write.md §3.1:116`）。

> **★ v0.2 补充：弃用面撤守卫（实测纪律）**：`410` 面**撤掉 `requireActor`/`requireAdmin` 前置** ⇒ 无 token / 有 token **均为 `410`**（实测），**不得**把「已下线」伪装成「未授权」（本仓 `resolveActor` 把 DB 异常也吞成 401）—— `p4-b2b-listing-write.md §4.2-4`、`p4-b2c-admin-write.md §3.1 T14`。
> **★ 过期日口径（Zang §5.73 7-1 定死）**：13 个 `410` 面的过期日 = **批 4 前端迁移验收通过之日**，且**每批复核必须点名**（禁止无限期 410）。

### 5.2 前端同步清单（按文件，**批 2 门禁**）

> **v0.2 说明**：本表 = v0.1 的**按文件最小改造要求**；v0.2 另在 **§2.4** 增补三条 v0.1 未列项（`ops:` 强校验 4 写口 / `R107` 401・403 形状 / 四语 locale）。两表**互补**，以 §2.4 为**新增项**的权威。

| 文件 | 必改点 | 触发原因 |
|---|---|---|
| `frontend/src/pages/RewardPage.jsx` | 删 `:196`（`/api/shard/redeem`）、`:217`（`/api/chest/:bID/open`）两条写调用与其 UI 分支 | §5.1（410）＝ §2.4 S5 |
| `frontend/src/pages/admin/TasksManagement.jsx` | 删 `:130` / `:140` / `:177` 三条写调用（页面只读化） | §5.1（410）＝ §2.4 S5 |
| `frontend/src/pages/admin/RewardsManagement.jsx` | 删 `:154` / `:164` / `:201` 三条写调用（页面只读化） | §5.1（410）＝ §2.4 S5 |
| `frontend/src/pages/admin/SystemSettings.jsx` | 删 `:123`（reset）按钮；**`:84-88` 的 POST 补 `ops:` 键** | §5.1（410）+ §2.4 S1 |
| `frontend/src/pages/admin/PermissionsManagement.jsx` | **`:89-98`（save）/`:132-135`（delete）补 `ops:` 键** | §2.4 S1（DL36） |
| `frontend/src/pages/admin/UsersManagement.jsx` | **`:103-107`（`user/update`）补 `ops:` 键** | §2.4 S1（DL36） |
| `frontend/src/auth.js` | **`:105` 改读 `payload.error.message`**（R107 形状） | §2.4 S2（`R107` 401/403） |
| `frontend/src/test/unit/auth.test.js` | `:75` 断言与 `410` 形状对齐（批 4 随路径删除改断言） | §2.3 登记 ＝ §2.4 S6 |
| `frontend/src/locales/{zh,en,hk,vn}.json` | **各加 2 键**：`auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`（现 0 命中，实测） | §3.3-6（`data-layer.spec.md:769`）＝ §2.4 S3 |
| `frontend/src/pages/ShardPage.jsx` | `:328-329` 的 `DELETE /api/order`（**带 body 的全撤**）必须在批 3 前改为**入参走 query** 的形态（后端将不再读 body） | §1 #27 + §7-5 ＝ §2.4 S4 |
| 全部 23 个文件 | **键集冻结**：批 2 / 批 3 期间不得依赖任何**新增**响应键（本册 §2 母约束 F1） | §2 ＝ §2.4 S7 |

### 5.3 `deprecated` 标记的**当前实况**（**批 2 实测，防误读**）

顶层 `deprecated:true` 现由 `sendSuccess` 的第 5 参下发（`index.ts:26`，B1-c 新增**可选**参数，**不改 `data` 形状**）；**批 2 末态实测仅 2 处**：`/api/shard`（`index.ts:604`）、`/api/shard/transfer`（`:619`）＋ 1 处注释文字（`:46`）。依据：`p4-b2c-admin-write.md §3.5`（`grep -n "deprecated"`）。⇒ **本册要求**：`/api/admin/permissions` 的 `deprecated` **已在批 2c 撤销**（§5.1 末行，实测）；`/api/shard` 与 `/api/shard/transfer` 的保留到批 4。

> **v0.1 → v0.2 变更**：v0.1 记「当前 3 处传 `deprecated`」（含 `admin/permissions`）；批 2c 撤销其一 ⇒ **现 2 处**（行号亦漂移，见 §1.5）。

### 5.4 三阶段时序（**写死**）

1. **批 2**：13 个面转 `410`（形状对齐 `R107`）——**已落地**（§1.4 F5）；401/403 转 `R107`——**已落地**（§3.4）；`/api/admin/permissions` 撤 `deprecated`——**已落地**；`/api/prize-item` 正式化——**已满足**；**前端按 §2.4/§5.2 删除调用（批 2 未做，归批 4）**；`/api/auth/login` 拆掉转发——**待批 4**。
2. **批 3**：后端上线规范读口（`/api/user/points|ledger`、`/api/referral/earnings`、`/api/market/:baseCid/candles`）⇒ 前端把 `/api/shard*` 的读调用迁过去。
3. **批 4**：前端迁移验收后，13 个 `410` 路径**删除**（走 §1.3 404 兜底）；`/api/shard`、`/api/shard/transfer` 同批删除；**新增路径注册**（`/api/job/*`、`POST /api/listing`、`/api/referral/*`、`/api/user/points|ledger`、`/api/market/*/candles`、`/api/admin/commission_policy`）；测试断言同步。**上线日 = §7-1 口径（批 4 前端迁移验收通过之日）**。**★ v0.5 补充**：批 4 的「新增路径注册」清单**以 §1.8「已实现·未注册清单」为准**（现 **8 条 + 1 附注**）—— **注册时不得只挑其中几条**（`assets/init` 先例：互推 ⇒ 无人执行）；且**必须先解决 §7-25 的 `create_key` 口径**（若 2a 改为 fail-loud ⇒ 前端必须传键）。**优先级**：§1.8 #3（`/api/job/:jobId/accept`）**最高** —— 不注册则该链在批 4 前走不通（§1.9 K11）。

## §6 权限单一真源（`users.is_admin` × `admin_role*`）

### 6.1 单一真源（唯一口径，**禁止双源**）

```
can_access_admin(uid) := users.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = :uid)
```

- **真源位置**：`migrations/0017_platform_config.sql:88-90`（DL72 逐字）；该口径是**数据层可验证查询**，`0017` **不自创函数**（`:31-32`）。
- **`users.is_admin` = 总开关**：`boolean NOT NULL DEFAULT false`（`migrations/0002_user_identity.sql:15`）；`0017` **绝不 ALTER `users`**（`:29`），其自检**断言该列必须在场**（`:329-333`）。
- **旧 `permission_group` 已废弃**（DL72「不复用」，`:110`）；**旧 `isAdminAddress` 双源禁止**（`:33`）——**收敛顺序见 §6.5**。
- **（v0.2）** 真源实现已落地：`backend-ts/src/database.ts` 的 `resolveAdminAccess`（两分支并行取 `users.is_admin` OR `admin_user_role`）；**权限键的代码侧真源 = `database.ts:11-23` 的 `ALL_ADMIN_PERMISSIONS`（11 键）**，与前端 `frontend/src/admin-utils.js:40-52` **逐键 0 差异**（裁定 Zang §5.77/§5.78）。

### 6.2 判定顺序（**写死**，实现方不得重排）

| 步 | 条件 | 结果 | 码 / `details.reason` | 批 2 实测 |
|--:|---|---|---|---|
| 1 | `requireActor`：无 / 坏 token | **`401`** | `AUTH_UNAUTHORIZED` | `p4-b2c-admin-write.md §3.2:152`（T06 无 token 不触 DB；T07 坏签名日志坐实） |
| 2 | 有 actor 但 `can_access_admin = false` | **`403`** | `AUTH_FORBIDDEN` + `reason=NOT_ADMIN` | T05/T19/T25 |
| 3 | `is_admin = true`（总开关命中） | **放行**（**不再查 `requiredPermission`**） | — | T02（`permissions` = 11 键全量） |
| 4 | 否则必须命中 `requiredPermission`（数组 = **OR** 语义） | 命中 ⇒ 放行；未命中 ⇒ **`403`** | `AUTH_FORBIDDEN` + `reason=PERMISSION_NOT_GRANTED` | 非 admin 经角色位放行支 = `NOT_MEASURED`（禁写种子） |
| 附 | 「已参与但无该动作权限」（业务角色守卫） | **`403`** | `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`（**C6 裁定：不得借 `LEDGER_HOLD_NOT_ALLOWED`**） | `p4-b2b-listing-write.md §3.2:147`；`p4-b2a-job-write.md §3.2:109` |

依据：`DL105`（`data-layer.spec.md:607`）+ `DL122`/`DL147`（`:754-755`）+ §11.3.2（`:771-778`）。

### 6.3 四张表的角色与守卫

| 表 | 主键 | 语义 | 守卫（`0017`） | 批 2 库态 |
|---|---|---|---|---|
| `admin_role`（`:93`） | `role_key` | 角色定义（`name` 可空文本） | 可变引用表：**PK 列不可变**、**DELETE 允许**（撤销角色定义） | **0 行**（预期；批 6 种子） |
| `admin_permission`（`:103`） | `permission_key` | 权限定义（`name` 可空文本） | 同上 | **0 行**（预期） |
| `admin_role_permission`（`:112`） | `(role_key, permission_key)` | 角色→权限（2 条 FK） | PK 对不可变；DELETE 允许（移除一项权限） | **0 行**（预期） |
| `admin_user_role`（`:123`） | `(uid, role_key)` | 用户→角色（`uid` **FK `users(uid)`**） | PK 对不可变；DELETE 允许（**撤销角色分配必须可删行**） | **0 行**（预期） |

**守卫函数（3 个，`0017` 的「守门函数」）**：`platform_config_key_immutable`（`:161`，PK/键列被 UPDATE ⇒ 原生 `P0001`）、`platform_config_touch_updated`（`:181`，`app_config.time_updated` 由触发器刷新，**不接受客户端传时间**）、`currency_status_log_append_only`（`:192`，`BEFORE UPDATE OR DELETE` 无条件 RAISE）。
**诚实边界**：`TRUNCATE` 不触发行触发器、超管 `DISABLE TRIGGER USER` 可旁路 ⇒ **不得**表述为「绝对不可变」（`:59-60`）。
**（v0.2）批 2c 实测**：`admin_role*` 四表 **0→0**（**禁写种子是硬口径**，`admin_permission` 表 0 行 ⇒ 权限写口**成功落行**在库上**结构不可达**（`admin_role_permission.permission_key` FK 必拒）⇒ 实测只到 `404`；登记 `NOT_MEASURED`，**批 6 落地后补测**）。

### 6.4 `GET /api/admin/me` 的目标形状（§4.1 #34）— **★ v0.2 更正为 6 键**

**更正结论**：`GET /api/admin/me` 的响应形状 = **`AdminAccessRecord` 6 键**：

```
{uID, EVM, is_admin, permissions[], can_access_admin, preferred_admin_path}
```

- **不是** 4 键。v0.1 引用的 `docs/data-layer.spec.md:272` 写的 `{uid, evm, is_admin, permissions[]}`（4 键）**是数据层 spec 的目标描述**，而**前端契约（`frontend/src/admin-utils.js:16-35` 读 `data.is_admin/data.permissions/data.can_access_admin/data.preferred_admin_path`）要求 6 键** ⇒ **键集冻结优先于 spec 描述**（§2 母约束 F1）。
- **真源**：`backend-ts/src/database.ts` `buildAdminAccess`（批 2c 增 `hasRoleRow` 形参，**返回键集不变**）。
- **`permissions[]` 语义（已满足）**：`permissions[]` = `admin_role_permission ⋈ admin_user_role`；**`is_admin = true` 时按「全权限」语义处理**，= **11 键全量**（`ALL_ADMIN_PERMISSIONS`），**不得**回空数组；非 admin ⇒ `[]`。
- **依据**：`p4-b2c-admin-write.md §3.1 T02/T03,§3.4,§4.2-5`；裁定 **Zang §5.78 ⑤**（「保留 6 键，要求 v0.2 把 §6.4 更正为 6 键（改规格、不改码）」）。
- **登记缺口**：`0017` **只建表、不插种子**（`admin_permission` 0 行）⇒ `requiredPermission` 的**库侧**权限键取值集合未落库；**批 2 的真源 = 代码侧常量 `ALL_ADMIN_PERMISSIONS`（11 键，与前端 0 差异）**；`admin_permission` 种子**留批 6**（见 §7-8）。

### 6.5 `isAdminAddress` 第三真源的收敛顺序依赖（v0.2 新增）

**事实（实测）**：`backend-ts/src/index.ts:98-129`（`resolveActor`，v0.1 行号）仍把 `isAdminAddress(user.EVM)` 传入 `buildAdminAccess` ⇒ `is_admin` 实际 = `users.is_admin` **OR** 硬编码地址命中 **OR** `admin_user_role` 存在 ⇒ **第三真源仍在**（`p4-b2c-admin-write.md §1.3-6`）。前端同款支路 = `frontend/src/admin-utils.js:3-14`。

**★ 顺序依赖（Zang §5.78 ④ 裁定，v0.2 显式记录）**：

> **收敛第三真源（删两处硬编码地址支路）必须先有「批 6 的权限种子迁移」** —— 即**必须**先保证运营管理员在库里有 `users.is_admin=true` 或 `admin_user_role` 行，**再**删代码支路。理由：收敛所需的**库写正是批 2/批 3 被禁的**（批 2c 硬口径 #3「禁写 admin 种子」）⇒ 若「先删代码支路再补数据」会把运营管理员**当场锁在后台外**。

⇒ **本册口径**：批 3 一律**不动** `isAdminAddress`（保持第三真源在场）；**批 6 = 权限种子迁移 + `isAdminAddress` 收敛 + §6.3 的 `NOT_MEASURED` 面补测**（一条线收口）。依据：`p4-b2c-admin-write.md §1.3-6`；裁定 **Zang §5.78 ④**（「批准其登记，并要求 v0.2 显式记录这条顺序依赖」）。

## §7 未决项（含 §5.73 十三项终审状态 + §5.78 本节新裁定）

> **状态列口径**：**已定** = Zang 已给裁定（附裁定出处）；**仍待** = 尚无裁定 / 明确留在 Zang（实现方**不得自选**）。
> 凡与 Zang 裁定冲突处**以 Zang 为准**；**确实无法调和 ⇒ 停在此表并标 `待 Zang`**。

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-1** | 旧路径 → `§4.1` 新命名的切换时点（含 13 个 `410` 面的过期日与批 4 上线日） | **已定** | **Zang §5.73 7-1**：批 2 / 批 3 **保留既有路径**；批 4 在前端迁移验收后切换。**过期日 = 批 4 前端迁移验收通过之日**，且**每批复核必须点名**（禁止无限期 410） |
| **7-2** | `GET /api/user` 的响应形状 | **已定** | **Zang §5.73 7-2**：批 2 **保持现有键集**（前端契约优先，实测 8 键）；`DL24` 的「集合形状 + 禁裸数字」由**新增 `/api/user/points`** 满足；**登记「`DL24` 履约时点 = 批 4」**，不得静默丢弃 |
| **7-3** | 自定义积分「上市 → 收保证金」的资金口径 | **已定（★ v0.3 全面更正 · v0.4 补 §5.80 留痕）** | ★ **v0.4 留痕（Zang §5.81 的自我勘误同步）**：**Zang §5.80 曾显式批准「保证金 = `HOLD` 冻结、可退、不进 `-1` credit 白名单、无需迁移」** ⇒ **该批准已由 Zang §5.81 作废并纠正**（`docs/seafood.master-plan.md:1435` A 节逐字「我错在哪」+ B 节「真根因」）；**v0.3 已把 v0.2 的『冻结可退』登记为错误推断，与本留痕口径一致**。★★ **Zang §5.81（2026-09-30）最终裁定**：**`listing_deposit` = 上市即消耗 → 贷 `uid = -1`**（**不可退、无退还 kind、无罚没**）；上市费 = `currency_create_fee` → `-1`（消耗）。**kind 关闭集仍 20**（`R40`，**不新增 kind**）；`0019` 只做**加法式**扩展 DB 侧 `-1` credit 白名单。<br>**★ 显式登记（v0.2 的错误推断）**：**v0.2 §7-3 的「保证金 = 冻结可退 + 罚没 `hold_forfeit`→`-3`」是错误推断，由 Zang §5.81 纠正**；**真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时漏删）⇒ 代码里两种口径并存，v0.2 采信了 `HOLD_KINDS` 那一侧。<br>**铁证（Zang §5.81 逐条，本册复核过）**：`docs/ledger.spec.md:79`（D7 行「保证金『冻结可退』❌ 已于 v0.2 被 **Kevin 原文推翻**」）、`:12`/`:13`/`:191`（消耗不可退 / 无退还 kind / 删 `_forfeit`）、`docs/data-layer.spec.md:454`/`:530`/`:533`（`DL67`/`DL88`/`DL91`【已冻结】）、`backend-ts/src/ledger.ts:148-150` 与 `migrations/0003_kind_close_set_20.sql:5-8`（注释逐字「上市时即消耗、**进平台收入 `uid=-1`**」）。<br>**返工归属**：**FIX-A（★ 已落地：`ledger.ts` `:178` 移除 `HOLD_KINDS` 成员 + `0019` 加白 + `/health` ⇒ `schema_version=0019`）** → **FIX-B（仍待：C2 改为消耗入 `-1`，**不得出现 `frozen` 变动**；C1/C2 金额改服务端取数）**。**v0.2 旧写法（错，留痕）**：「保证金 = `listing_deposit`（`HOLD_KINDS` 内）**纯冻结、可退**（`hold_release`）；违约罚没 = `hold_forfeit` → `-3`；**禁止新增 kind / 禁改白名单 / 不开 `0018`**；裁定 = Zang §5.73 7-3」 |
| **7-4** | 撮合算法（价格—时间优先 / 价差改善）归谁 | **已定** | **Zang §5.73 7-4**：批 3 **不得发明**；成交必须由撮合服务显式给出 5 字段；**成交价 = 买单限价**；撮合服务属 **P5**，本批不实现 |
| **7-5** | `DELETE /api/order`（带 body 的全撤）最终形态 | **已定** | **Zang §5.73 7-5**：保留路径、入参改 **query**（后端不再读 body）；前端 `ShardPage.jsx:328-329` 同步改造 = §2.4 S4 |
| **7-6** | `/api/admin/task/*` 与 `/api/admin/prize/*` 的 `410` 生效时点 / 后台页面是否整页下线 | **已定** | **Zang §5.73 7-6**：`410` 随批 2 生效（**已落地**，§1.4 F5）；后台页面**只读化**（不整页删）；**仲裁面 `/api/admin/arbitration/*` 排 P6** |
| **7-7** | 退款是否回滚 `listing.stock` | **已定（默认不回滚）** | **Zang §5.73 7-7**：**不发明、不回滚**；列为**需 Kevin 一句话**的产品项（默认不回滚），批 3 前未表态 ⇒ 按不回滚实现并登记 |
| **7-8** | `requiredPermission` 的权限键取值集合（`admin_permission` 种子） | **已定（★ 已被 §5.77 修正）** | **Zang §5.73 7-8 原裁定** = 批 2 落最小集并补种子；**★ 由 Zang §5.77 修正**：**真源放代码侧**（`src/database.ts` 的 `ALL_ADMIN_PERMISSIONS`，11 键）+ **对齐前端 `admin-utils.js`（0 差异，实测）**；`admin_permission` 表种子**留批 6（走迁移）**，本批**不写库种子**（保护「重置键」设计） |
| **7-9** | `422` 的启停 | **已定** | **Zang §5.73 7-9**：`422` **不启用**（与 33 码闭集一致） |
| **7-10** | `time_claimed` / `points_claimed` 的「无对应列」语义（现恒 `NULL` / `0`） | **已定** | **Zang §5.73 7-10**：保留至批 4；归还语义由 `/api/job/:jobId/review` 结算事件承载 |
| **7-11** | `GET /api/health` 的 `public.` 收口归属（`DL155`） | **已定（★ 修正为「早已闭合」）** | **Zang §5.73 7-11**：`DL155` **早已闭合**（`src/db.ts` 的 `getSchemaVersion` 已加 `public.`，入库 `3b8e379`）⇒ **不需要再改代码**；批 2 只需把「**裸表名扫描**」纳入验收判据防回归 |
| **7-12** | 错误文案的四语化时点 | **已定** | **Zang §5.73 7-12**：批 2 / 批 3 只保证 **`i18n_key` 契约**（`R107` 四件套），文案暂 zh-only；四语文案属 **P7** 前端呈现层（但 §2.4 S3 的 2 个键必须补，见 §3.3-6） |
| **7-13** | `/api/task-progress/claim/:jID`（:505）的拆分落点与端点命名 | **已定** | **Zang §5.73 7-13**：拆为 `apply`（无分录）/ `accept`（无分录）/ `settle`（有分录，随 `approve`）；**旧路径批 4 前保留**；批 2 只做 `apply`/`accept`（service 已交付，§1.1） |
| **7-14** | 判分 `ops:` 键的语义（服务端自派生 vs 调用方传入） | **已定（§5.78 新裁定）** | **Zang §5.78 ②**：按 `DL36` 落为**请求侧强校验、不落库**（`ops:` 前缀；缺失 ⇒ `400`）；代价登记 = §2.4 S1 |
| **7-15** | `DL38`「查询层不得继续引用旧 `database.ts`」的**落点读法** | **已定（★ v0.4 定案 · Zang §5.82）** | **★ Zang §5.82 裁定 = 以读法① 为准**（`master-plan:1429`）：**「旧查询函数调用数 = 0」** —— 因 `data-layer.spec.md:328` **原文自带该判据**（「重写验收 = 「旧查询函数调用数为 0」」）⇒ **读法① 采纳、读法②（代码结构迁移）不采纳**（原文未要求、会造成无谓重构）。**三条补强（Zang 加）**：① 判据**必须带具名函数清单**（= P4-0/批 1 定的 **A 类 jinli 遗留函数**：引用 `asset`/`permission_group`/`prize`/`prize_item`/`shard`/`shard_transfer`/`task`/`task_progress` 者）；② **同时**核那 **5 组端点自身 `200/404/410` 语义正确** ⇒ **不得为清零而删功能**；③ 判据用**类级扫描**而非 `grep` 单点。**★ v0.4 落地状态**：读法① 下**已满足**（2c 取此读法，`p4-b2c-admin-write.md §4.2-6`；`grep` 命中 0 + SQL 零 `permission_group` + 新语句显式 `public.`）。<br>**▼ 以下为 v0.3 的实证材料（保留不删）**：**★ v0.3 补齐 Zang 要的两项**：<br>**(a) 原文落点** = `docs/data-layer.spec.md:328` 逐字：「**`DL38`** 保留类路由的重写必须换掉数据源：`/health`、`/api/admin/settings*`、`/api/admin/permissions*`、`/api/user/all`、`/api/user/stats` 的查询层**不得**继续引用旧 `database.ts`（`DL17`）；**重写验收 = 「旧查询函数调用数为 0」**」（状态 = 【本册裁定】）。<br>**(b) 两读法实证差异**（**读法② 与 读法① 的区别 = 「计数为 0」vs「代码结构迁移」**）：<br>① **「旧引用数 = 0」读法**：判据 = 旧 `database.ts` 查询函数名（如 `getSystemSettings`/`getPermissionGroup` 旧实现）在调用侧 `grep` 命中 **0**，且 SQL 层零 `permission_group` 引用 + 新语句显式 `public.`。**2c 取此读法**（`p4-b2c-admin-write.md §4.2-6`）⇒ **本读法下已满足**。<br>② **「把 SQL 迁出 `DatabaseService`」读法**：判据 = 被点名的五类端点的 SQL **不再位于 `DatabaseService` 类内**（迁到独立查询层/模块）。**实证差异 = 2c 未做**：新 SQL 仍以**新增方法**形式落在 `backend-ts/src/database.ts`（同一 `DatabaseService`）；**批 3a 同款**（`createCurrencyWithFee`/`listCurrencyWithDeposit` 亦为 `database.ts` 新方法，`p4-b3a-currency-funds.md §3.1`）。⇒ **二读法在「是否已满足」上结论相反**；本册**不自行裁定**，登记待 Zang（**建议**：若取读法②，则 `database.ts` 需再拆一层，属**结构重构**、与"换数据源"的立法意图{防 `column_missing` 回归}未必等价 —— **该建议不构成裁定**） |
| **7-16** | **费率键黑名单**（`FEE_RATE_KEY_PATTERNS`）为 2c **自拟**（spec 只写「禁写费率键」，未给键名集合） | **已定（★ v0.4 定案 · Zang §5.82）** | **★ Zang §5.82 裁定 = 采纳选项 (A) 删除**（`master-plan:1430`）：**删除整个 `FEE_RATE_KEY_PATTERNS` 黑名单**（批 2c 自拟）；依据 = `0017:81` 表注释的立场（「费率键不在此表权威（真源 = `commission_policy.fee_rate_bp`）；**若历史键存在 ⇒ 保留但标注「不参与计费」、不得删键**」）⇒ 「从 `0017` 派生键名闭集」**不可能**，而平台既有立场是**容忍 + 标注**而非硬拒。**「真源唯一」改由读取侧纪律保证**：**任何计费只读 `commission_policy`，永不读 `app_config`**。⇒ **本册口径 = 删除该黑名单要求**（写入侧只做「不得新写费率键」的**命名提示**，**非硬拒**）。**登记（批 6 配置面规格）**：「**`app_config` 合法键清单 / 写入门禁**」（现在**无键名枚举** ⇒ **硬造即自拟**）⇒ 归**批 6 配置面**。<br>**▼ 以下为 v0.3 的实证材料（保留不删）**：**★ Zang §5.81 方向裁定**：**必须从 `0017` 派生或删除**（不得维持 2c 自拟集）。<br>**本册实证（供 Zang 定案）**：`0017` **没有**任何费率键名枚举 —— 全文件只 **1 处**提及费率，即 `backend-ts/migrations/0017_platform_config.sql:81` 的表注释：「⚠️ **费率键不在此表权威**（真源 = `commission_policy.fee_rate_bp`，§5.20 #3）：**若历史键存在 ⇒ 保留但标注「不参与计费」、不得删键**」（`grep -n 'fee\|rate\|费率\|佣金' 0017_platform_config.sql` 仅此 1 命中 + 头注 `:45` 复述）。⇒ **「从 `0017` 派生」无法产出一个键名闭集**（0017 只给「权威在别处 + 旧键保留不删」的**规则**，不给**键名**）。**两个可执行选项**（**由 Zang 选，本册不选**）：**(A) 删除**整个 `FEE_RATE_KEY_PATTERNS` 黑名单，改由 `0017:81` 的规则口径承接（**旧键可保留但须标「不参与计费」**；写入侧只做「不得新写费率键」的**命名提示**而非硬拒）；**(B) 从 0017 的权威声明派生**一个**最小**闭集（只含真源名族 `fee_rate_bp`，弃 2c 自拟的 `/费率/`/`/佣金/` 等宽匹配）。现状 = 2c 自拟集（`src/admin-service.ts:89`：`/fee_?rate/i`、`/rate_?bp/i`、`/commission_?rate/i`、`/commission_?policy/i`、`/费率/`、`/佣金/`），错误码 = `400 FEE_RATE_KEY_NOT_IN_APP_CONFIG`（`p4-b2c-admin-write.md §4.2-7` T11 实测） |
| **7-17** | 币种状态闸（`draft/frozen/delisted`）的**落点** | **仍待（待 Zang；★ 批 3a 追加实证）** | §4.4-6 要求「必须在**路由层**先跑」（`DL125`），但商品路径**未注册**（§1.2）⇒ 2b 把闸落在 service + 单语句 CTE（原子、一次往返），错误码一一对应 ⇒ **登记待 Zang 复核**（`p4-b2b-listing-write.md §1.3-2,§4.2-2`）。**★ 批 3a 同款且更彻底**：C2 的 `draft→listed` 状态闸落在 **`currency-service.ts` 的领域守卫 + 单语句 CTE**（`currency-service.ts:348-353`），实测 `listed` 重复上市 ⇒ `409 LEDGER_CURRENCY_INVALID_TRANSITION`；**`frozen`/`delisted` 两支仍未测**（库内无该状态行、且禁改 `currency`）⇒ `p4-b3a-currency-funds.md §7 N2`） |
| **7-18** | `delisted` 终态下的「改」语义 + 创建指纹「排除可变列（`stock`/`status`）」的可重构口径 | **仍待（待 Zang）** | ① `delisted` 终态禁改 = **读码推断**（迁移守卫未闸 `price/title`），2b 按 §4.2 P1「终态」字面实现；② 指纹口径 = 不变子集（`seller_uid,cid,price,title,description,media_urls`）⇒ 代价「先建后改库存再拿原键重投会判重放而非冲突」（未实测）。登记待 Zang（`p4-b2b-listing-write.md §1.3-4,§4.2-1`） |
| **7-19** | `title` 非空校验（33 码关闭集内**无**「必填字段缺失」专用码） | **仍待（待 Zang）** | 2b **未做**（不自创码 = 正确行为），缺失 ⇒ 落 `''`（`DB NOT NULL DEFAULT ''`）；登记待裁（`p4-b2b-listing-write.md §4.1-7`；Zang §5.77「照登」） |
| **7-20** | `POST /api/auth/register` 的 `410` 形状对齐（v0.1 §5.1 要求改 `R107`） | **仍待（`NOT_MEASURED`）** | 批 2 三片**均未触及**该端点 ⇒ 形状对齐状态 = **`NOT_MEASURED`**；登记为批 4 收口项（§1.3 / §1.4 注） |
| **7-21** | 404 兜底的**形状**（未注册路径实测为**裸 `Not found`**，未对齐 `R107`） | **仍待** | `p4-b2b-listing-write.md §3.1:120-121` 实测；§1.3 要求对齐 `R107` ⇒ 待批 4 实现方处理 |
| **7-22（v0.3 新增）** | 退市 / 罚没的**资金口径与端点** | **已定（P3 无此动作）** | **Zang §5.81**（`listing_deposit` = 上市即消耗）⇒ 退市「**无账务动作**」（**保证金不退**）、强制下架**亦无账务动作**（**不存在可罚没的标的物**）⇒ **`§4.2 C3` = 不建端点、不建幂等键、不建分录**（批 3a 已按此**不实现**：`p4-b3a-currency-funds.md §7 N1`；实测 `-3` 账户 0→0、不动，`§5.3`）。依据 = `DL67`(`data-layer.spec.md:454`)/`DL88`(`:530`)/`DL91`(`:533`【已冻结】) + `ledger.spec` §7.2 #14(`:492`)。**★ 将来若做「强制下架罚款」= 新语义、新 kind ⇒ 须单独裁定**（`ledger.spec` §19.8.B 同口径：**不得复活已删名**） | 
| **7-23（v0.3 新增 · v0.4 定案）** | **费率 / 保证金金额的来源**（服务端取数 vs 客户端必填） | **已定（Zang §5.82 7-23 + §5.84；★ 机制已落地）· 数值待 Kevin** | **★ Zang §5.82 7-23（`master-plan:1431`）= 机制先落地、数值待 Kevin**：**必须实现「服务端取数 + 下限校验」**（客户端传值只允许 `≥ 下限`，**低于 ⇒ `400`**；**不得**由客户端决定金额）；下限取**可配置 + 代码常量兜底**，兜底值**标 `TODO: Kevin 定值`**；**数值本身不由子代理发明**（经济参数属 Kevin 拍板）。**★ v0.4 落地状态（`FIX-B` 已交付）**：`currency-service.ts:140-142` 三个 `*_FLOOR` = **1000/1000/1000**（逐条 `TODO: Kevin 定值`）；未传 ⇒ 服务端默认（`200`）；低于下限 ⇒ **`400 LEDGER_AMOUNT_NOT_POSITIVE` + `reason=BELOW_SERVER_FLOOR`**（**Zang §5.84 ① 接受**）。**费率**真源 = `commission_policy.fee_rate_bp`（`ledger.spec` §14.1 #32 **唯一真源**；读取侧纪律见 §7-16）；**保证金下限的数值与载体**（新增 `app_config` 键？抑或用 `currency.deposit_amount` 既有语义？）**待 Kevin/Zang 给数** ⇒ **不得自选**；改「从平台配置取数」归**批 6 配置面**（真源键名待定、**不得从 `app_config` 硬造键名**）。**详细口径见 §4.4-11 / §4.4-12** |
| **7-24（v0.4 新增）** | **`401`/`403` 的取证口径**（本仓**不落 access log**） | **已定（Zang §5.84 ③）** | **裁定 = 正解为「响应体证据 + 零分录取证 + 显式 `NOT_MEASURED`」**：本仓**不落请求级 access log**（实测 1199 行窗口内 `/api/currency` = 0 行、`403` = 0 行）⇒「凡 `401`/`403` 必须核服务端日志逐条归因」**在本仓不可执行**，改为 **`R107` 响应体（`code` + `details.reason`）+ 事件键下零分录** 取证，并对**日志归因**显式标 **`NOT_MEASURED`**；**严禁把「日志查不到」写成「日志确认无异常」**（Zang 逐字）。**结构前提** = P4-SEC 后 `resolveActor` 已把 infra 分类为 **503**（吞 401 风险结构性下降）。**登记**：§3.4 / §8.3-14。依据：`p4-b3b-currency-funds-fix.md §5.1`；**Zang §5.84 ③** |
| **7-25（v0.5 新增）** | **`create_key` 缺失时的口径**（**派生兜底 vs fail-loud**：2a 派生 vs 3b fail-loud） | **3b 面已定 · 2a 面待 Zang** | **★ 3b 面 = 已定**（**Zang §5.85 裁定③** 逐字：「`create_key` 缺失 ⇒ **fail-loud 不派生**（优于 2a 派生兜底）⇒ 批准并**立案审 2a 是否同类静默重放** ⇒ 派 **FIX-JOBKEY**」）⇒ J1 取 fail-loud（§4.4-14；真源 `src/job-funds-service.ts:84`）。**2a 面 = 待 Zang（但审计已落盘、结论明确）**：审计件 **`docs/audit/p4-aud-jobkey.md` 本单现取 = 已落盘**（**246 行 / 21165 字节 / 6 节**；HEAD `8f2974c`；run tag `audjk-20260929T182652Z`；产物 `.p4-artifacts/audjk-20260929T182652Z/**`；探针 `scripts/p4z-audjk-01-probe.ts`）。**其结论（审计自述 = 取证、非裁决）**：`resolveJobCreateKey`（`src/job-service.ts:90`；公式 `cli:p4b2a:<fallbackParts.join(':')>:<sha256(fallbackParts.join('|'))[:16]>`）的 `fallbackParts` **只含自然标识**（J4 = `['submit', identifier, workerUid]`，`:133`；J2 = `['apply', jobId, workerUid]`，`:180`）、**不含任何内容字段** ⇒ 派生键 = **自然标识的单射** ⇒ **不同实体不可能同键**（**实测** T1/T2 各落 1 行、`sub` 6→7→8；A1/A2 各落 1 行、`app` 9→10→11）；同实体同内容 ⇒ 200 `idempotent_replay:true`（设计内幂等）；同实体**异内容** ⇒ **409 `LEDGER_IDEMPOTENCY_CONFLICT` / `REPLAY_FINGERPRINT_MISMATCH`**（**响亮拒绝、非静默**）⇒ **「2a 属同类静默重放」不成立**；两口径差异**语义上可解释**（**3b 的 J1 无自然键可用**，2a 两处都有）。**★ 但「改法」未定**：审计 §4 给出 **A（服务层 fail-loud + 同单补前端键）/ B（保持派生，把过渡口径升为显式契约）/ C（路由层必填、服务层保留派生）** 三个**互斥**选项，**自述「只取证不裁决」⇒ 待 Zang 裁定**，由 **v0.6 定案**（**本册不自选**）。**★★ 硬事实（对批 4 有约束力 · 审计 §3 取证）**：`frontend/**` 的 `create_key|createIdempoten` 命中 = **0**（静态 `grep`）；**2a 的 J4 `POST /api/task-progress/:identifier/submit` 是前端唯一在用的该面写口、且从不传键**（`frontend/src/components/ActiveTaskModal.jsx:50-58` 只传 `info_input`、无 `Idempotency-Key` 头）⇒ **取 A 或 C 必须同单改前端**（否则该端点 **100% `400`**、招工提交整体失效）；**J2 `applyToJob` 无前端调用者** ⇒ 对它 fail-loud **零前端影响**（见 §1.8 #2）。 |
| **7-26（v0.5 新增）** | **§1.8「已实现·未注册清单」的维护责任**（谁在每批复核时更新） | **机制已定 · 责任人待 Zang** | **★ 机制 = 已定**（**Zang §5.85 裁定①**：spec 须增设该清单、表头四栏、目的 = 「`assets/init` 那类『互推无人认领』的结构性解药」）⇒ 本册以 **§1.8** 落地并配「准入判据 / 扫描口径 / 负向排除」使其**可复算**。**责任人指派 = 待 Zang**（**本册不自选**）。**▼ 本册建议（不构成裁定）**：① **每批复核强制项** —— 复核人须重跑 §1.8 的扫描命令，把**新增/消除**项逐条登记；**有新增项而未登记 ⇒ 复核不通过**；② 清单项**不得**以「归同批其它片」结案（`assets/init` 先例）；③ 批 4 每注册一条**必须从清单划掉**并在 §8 变更记录留痕。 |
| **7-27（v0.5 新增）** | **前端是否依赖旧 `400`** 的全量回归核验 | **部分已取证 · 残留 `NOT_MEASURED`** | **已取证部分**（本册现取）：verify 的**唯一**真实调用点 `frontend/src/pages/DashboardPage.jsx:223-236` **不对 `400` 做分支**（失败一律 `toast.error` 泛化）；`jID` 来源 = 面板队列的 `application_id`（数字）⇒ 前端不发非数字 `jID`；被撤除的 bespoke `400`（admin 提交）**前端不可达**。**残留 = `NOT_MEASURED`**：前端 **23 文件 + 单测**未全量扫 ⇒ **批 4 前端迁移时必须全量核**（是否断言旧 `400 Invalid jID` / admin-queue 文案）。依据：`p4-b3c-job-funds.md §2.3 Δ1/Δ2`；**Zang §5.85 裁定②**（「须登记规格 + 核前端是否依赖旧 400」）；§2.4 S9 / §8.7.2-18 |

## §8 变更记录与自曝

### 8.1 v0.2 变更记录（**折入 P4 批 1 / 批 2 实测 + Zang 裁定**）

| 版本 | 日期 | 作者 | 内容 |
|---|---|---|---|
| **v0.1** | 2026-09-29 | **Jing** | **首版。八节**：§0 元信息/口径/权威输入（六处）+ 支撑读数；§1 **51 端点逐条处置**（live 行号）+ 18 条新增端点 + 命名张力 + 404 兜底；§2 **前端契约冻结**（mapper key 集 + 23 文件 + 「后端没有的路径 = 0」）；§3 detail-miss 统一 404 + 逐码条件 + `R107` 七条；§4 **资金编排契约**（R1–R7 + 7 关闭集 + 18 事件 + 资金四栏 + 10 判决 + 幂等键总表 + 批切分）；§5 **弃用面最终处置**（13 面 `410` + 过期日）+ 三阶段时序；§6 权限单一真源 + 5 步判定 + 4 表守卫 + 3 守门函数；§7 未决 13 项；§8 本表 + `NOT_MEASURED` + 自曝 |
| **v0.2** | 2026-09-30 | **Jing** | **修订单**。折入 P4 批 1/批 2 实测与 Zang §5.73/§5.74/§5.76/§5.77/§5.78 裁定，**共 9 组 delta**（逐条见 `docs/audit/route-layer-v0.2-delta.md`）：① **路径改标 ×2**（`/api/job/:jobId/{apply,accept}`、`POST /api/listing` ⇒ **服务层已实现、路由层随批 4**）+ §1.2 母约束补 **「批 2 不新增对外路径（注册点冻结 51）」理由**；② §6.4 更正为 **6 键**；③ §6.5 **`isAdminAddress` 顺序依赖**（先批 6 种子、后收敛）；④ **401/403 统一 `R107` 已落地**（§3.4）+ 前端同步；⑤ **`ops:` 幂等键请求侧强校验**（§4.5）；⑥ **§2.4 批 4 前端同步清单**（新增）；⑦ §7-15/§7-16 **`DL38` 落点读法 + 费率键黑名单 ⇒ 待 Zang**；⑧ **§1.4 批 2 已落地事实**（13 个 `410` + `prize-item` 正式化 + 两处 `404`）；⑨ **§7 十三项终审状态逐条给出（已定/仍待）** + §5.78 新裁定的落地；另增 §1.5 行号对照、§5.3 更新（3 处→2 处）、§4.6 批 2 实交、7-14 与 7-17..7-21 新增未决 |
| **v0.3** | 2026-09-30 | **Jing** | **§7-3 校正单（折入批 3a 实测 + Zang §5.80/§5.81）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v0.3-delta.md`）：① **§7-3 全面更正**（`listing_deposit` = **上市即消耗 → 贷 `-1`**；不可退/无退还 kind/无罚没）+ **显式登记「v0.2 的『冻结可退』是错误推断，由 Zang §5.81 纠正，根因 = `HOLD_KINDS` 误含 `listing_deposit`（P1c 漏删），已由 `0019` + `ledger.ts` 手术修正」**；② **§4.2 新增事件行 C1/C2（改为已落地形态）+ 新增 C3（退市/罚没 = P3 无此动作）**，并把「将来若做强制下架罚款 = 新语义新 kind，须单独裁定」写进 §7-22；③ **§4.5/§4.2 幂等键由「待定」正式化为批 3a 落地形态**（`biz:currency:create:<symbol>` / `biz:currency:list:<cid>`，真源 = `currency-service.ts` + `p4-b3a-currency-funds.md`）；④ **§4.4-11 新增「金额必须服务端取数」硬口径**（标 `FIX-B 落地`）+ §7-23；⑤ **非 owner 的码统一为 `403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED`**（§4.2 C2 期望码列删 `LD014`，与 §3.2「禁返回」一致）；⑥ **§4.1 关闭集校正**（`hold` 家族**移除** `listing_deposit`；`-1` credit 白名单**加入** `listing_deposit`）＋ §4.3/§4.4-7 同步；⑦ **新增 §1.6「批 3a 已落地事实」**（G1–G6）+ §0.3 三条实测读数 + §0.1 新增 **I8**；⑧ **§7 状态列更新**：**7-3 更正**、**7-15 补齐 `DL38` 原文落点 + 两读法实证差异**（仍待 Zang）、**7-16 记 Zang 方向裁定 + `0017` 无键名枚举的实证**（仍待 Zang）、7-17 追加批 3a 实证、**新增 7-22/7-23**；另 **§5.3/§1.1 的 C1/C2 行改标已落地**、§4.6 批 3 行更新 |
| **v0.4** | 2026-09-30 | **Jing** | **批 3a 真收官折入 + Zang §5.82/§5.84 四裁定落地**，**共 10 组 delta**（逐条见 `docs/audit/route-layer-v0.4-delta.md`）：① **§7-3 补 Zang §5.80 留痕**（「§5.80 曾批准『冻结可退』，已由 §5.81 作废并纠正」）；② **§7-15 定案**（读法①「旧查询函数调用数 = 0」为准 + 三补强：具名函数清单 / 同核 5 组端点 200·404·410 / 类级扫描）；③ **§7-16 定案**（采纳 (A) **删除**自拟 `FEE_RATE_KEY_PATTERNS`；真源唯一改由读取侧纪律保证；登记「`app_config` 合法键清单/写入门禁」为**批 6 配置面规格**）；④ **§7-23 定案**（机制已落地、数值待 Kevin）；⑤ **低于下限借码正式化**进 §3.2/§4.4-12（`LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`）+ **C1-T05/C2-T17 期望改 `200`**；⑥ **新增 §7-24**（401/403 无 access log 的取证口径）；⑦ **§1.7 新增**（批 3a 真收官 H1–H8：`0019`/`0020` 已应用 / `HOLD_KINDS` 5→4 / C2 4 腿全在 `balance` / 金额服务端下限）+ §1.6 改标「历史读数，保留不删」；⑧ **§0 / §0.1 / §0.3 同步**（`schema_version=0020`、注册点 53 复核、`migrations` I4 / 审计四件 I8、4 条新读数）；⑨ **§4.1 / §4.2 / §4.3 同步**（hold 家族双处摘除、`-1` 白名单已应用、C1/C2 真收官形状 + 下限码）；⑩ **§3.4 取证口径精化**（P4-SEC 已把 infra 分类 **503**）；另 **`data-layer.spec.md` 追加式加注（§18，就地升 v0.7）+ 快照 `data-layer.spec.v0.6.md` 新建** |
| **v0.5** | 2026-09-30 | **Jing** | **批 3b「招工资金」折入 + ★新纪律落地（「已实现·未注册清单」）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v0.5-delta.md`）：① **★新增 §1.8「已实现·未注册清单」**（**真扫描实测 8 条 + 1 附注**；Zang 首批 3 条全含 + **本册多出 5 条并写明差异**；附「准入判据 / 扫描口径 / 负向排除 / 7 个已接线 verb 正向对照」）—— 依据 = **Zang §5.85 裁定① 新纪律**；② **新增 §1.9「批 3b 已落地事实」K1–K11**（330 行 / sha256 `7b808634…`；`database.ts` +3 method 与**单条 SQL** CTE；**注册点 53→53**；J1/J5/J6 读数；**DL86 两形态**；`ledger_entry` 42→76 枚举等式；**集成缺口 F-1**）；③ **两条既有路径行为 delta 定案**（非数字 `:jID` `400`→`404` 落 §3.1；撤 bespoke `400` 守卫）—— **Zang §5.85 裁定② 批准**，并登记回归项 **§2.4 S9 / §7-27**；④ **§4.4 新增判决 13–17**（J5/J6 零金额入参 / J1 fail-loud / 「结论位+资金同语句」原子 / `:jID` = `application_id` / 成功面 11·9 键冻结）；⑤ **§4.0 R1 精化**（账本层 vs 业务层两层口径 + 「零自拼分录」是**结构保证**）；⑥ **§4.2/§4.3/§4.5/§4.6/§5.4/§1.1/§1 #49 同步**（J1/J5/J6 批次改「批 3b 服务层已落地、路由随批 4」+ 资金四栏补实测读数 + 幂等键表补 fail-loud）；⑦ **§0/§0.1/§0.3 同步**（注册点 53 现取复核 + **行号漂移登记**〔`:1160→:1166`、`:1179→:1185`〕+ `migrations` 仍 19 ⇒ `schema_version` 仍 0020 + **I9** 批 3b 审计件 + 3 条新读数 + **行号口径由三分升为四分**）；⑧ **§7 新增 7-25 / 7-26 / 7-27**（`create_key` 口径〔3b 已定 · 2a 待审计 · `p4-aud-jobkey.md` **未落盘 ⇒ 审计在飞**〕/ §1.8 维护责任〔机制已定 · 责任人待 Zang〕/ 前端旧 `400` 全量核验）⇒ **7-1…7-24 一字未动**；另 **`docs/data-layer.spec.md` 本单未写、未建快照**（无 data-layer 规则变更，理由见 §8.7.1） |

### 8.2 v0.1 → v0.2 关键裁定对照（便于质检对拍）

| 项 | v0.1 表述 | v0.2 更正 | 依据 |
|---|---|---|---|
| `/api/job/:jobId/{apply,accept}` 批次 | 「**批 2**」（§1.1:125-126） | **服务层已实现、路由层随批 4 注册**（实测 404） | `p4-b2a-http.md §3:74`；Zang §5.74/§5.76 |
| `POST /api/listing` 批次 | 「**批 2**」（§1.1:130） | **服务层已实现、路由层随批 4 注册**（实测 404） | `p4-b2b-listing-write.md §1.3-1,§3.1:120`；Zang §5.77 |
| `/api/admin/me` 形状 | 4 键（`§6.4`，引自 `data-layer.spec.md:272`） | **6 键**（键集冻结优先） | `p4-b2c-admin-write.md §3.1 T02,§4.2-5`；Zang §5.78 ⑤ |
| `deprecated` 实况 | 3 处（含 `admin/permissions`） | **2 处**（`admin/permissions` 已撤） | `p4-b2c-admin-write.md §3.5` |
| 401/403 形状 | 计划改 `R107`（§3.2 表） | **已落地**（跨 51 端点） | `p4-b2c-admin-write.md §2,§3.1`；Zang §5.78 ③ |
| `ops:` 键 | 仅在 §1 #33 / §4.5 提及 | **请求侧强校验、不落库**（形态已定） | `p4-b2c-admin-write.md §4.2-2`；Zang §5.78 ② |
| `isAdminAddress` | 「双源禁止」（§6.1） | **+ 收敛顺序依赖**（先批 6 种子） | `p4-b2c-admin-write.md §1.3-6`；Zang §5.78 ④ |
| `DL155` | 「待收紧点」（§0.3 / §7-11） | **早已闭合**，只需裸表名扫描防回归 | Zang §5.73 7-11 |
| 7-8 权限种子 | 「批 2 须补种子」 | **真源 = 代码常量；种子留批 6** | Zang §5.77 修正 |

### 8.2b v0.2 → v0.3 关键裁定对照（便于质检对拍）

| 项 | v0.2 表述 | v0.3 更正 | 依据 |
|---|---|---|---|
| **§7-3 保证金语义** | 「`listing_deposit` = 纯**冻结、可退**（`hold_release`）+ 违约罚没 `hold_forfeit`→`-3`」（裁定 = Zang §5.73 7-3） | **「上市即消耗 → 贷 `uid = -1`；不可退、无退还 kind、无罚没」** | **Zang §5.81**（`master-plan` `:1390-1399`）；铁证 = `ledger.spec.md:79/12/13/191`、`data-layer.spec.md:454/530/533`、`ledger.ts:148-150`、`0003:5-8` |
| **§4.1 `hold` 家族** | 含 `listing_deposit` | **移除 `listing_deposit`**（P1c 漏删；FIX-A 手术） | Zang §5.81；`ledger.ts:174-175` |
| **§4.1 `-1` credit 白名单** | `trade_fee`/`listing_fee`/`currency_create_fee`/`job_fee` | **+ `listing_deposit`**（`0019`；照 `0008` 加法式） | Zang §5.81；`ledger.spec` §13.2 |
| **§4.2 C1/C2** | 「未实现（无编排函数）」/「上市收保证金（冻结可退）」 | **已实现（批 3a，单语句 CTE）**；C2 语义待 FIX-B 返工为消耗入 `-1`；**新增 C3（P3 无退市/罚没动作）** | `p4-b3a-currency-funds.md`；Zang §5.81 |
| **§4.5 C1/C2 幂等键** | 「待定」 | **`biz:currency:create:<symbol>` / `biz:currency:list:<cid>`**（缺省派生；调用方键优先） | `currency-service.ts:82,193,299`；`p4-b3a-currency-funds.md §3.3` |
| **§4.2 C2 非 owner 码** | `409 LD011/LD014 + not_currency_owner` | **`403 AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`**（`condition=not_currency_owner`） | §3.2 明文「新面业务路由不得返回 `LEDGER_UNAUTHORIZED_MINT`」；§6.2 附表；实测 C2-T15 |
| **金额来源** | 未规定 | **必须服务端取数**（§4.4-11，标 `FIX-B 落地`） | Zang §5.81（客户端必填 = 资金面的洞） |
| **端点注册点** | 51（批 2 冻结） | **51 → 53**（批 3a 起取消冻结） | `p4-b3a-currency-funds.md §0:13,§8:236`；Zang §5.80 D |
| **批 3 资金判据** | 「`ledger_entry` 增量 = 0 才绿」（批 2 口径） | **「增量 == 预期条数」**（**不得再把 0 当绿灯**） | Zang §5.80 B；`p4-b3a-currency-funds.md §5.2:141` |

### 8.3 NOT_MEASURED（**未测项，禁止当 0/空使用**）

| # | 项 | 原因 |
|--:|---|---|
| 1 | 批 2 三片的**部分 HTTP 业务分支** | `POST /api/listing`、`POST /api/job/:jobId/{apply,accept}` **未注册**（§1.2）⇒ HTTP 层只能实测 **404**；其 200/400/403/409 分支由 **service 直调**给出（`p4-b2b-listing-write.md §4.1-1`；`p4-b2a-http.md §5-1`） |
| 2 | 权限写口的**成功落行**路径、`delete` 的 `deleted`/`in_use` 两支、自锁守卫触发支、`admin_user_role` 那支的 `can_access_admin` | **因禁写种子而结构性不可测**（`admin_permission` 0 行 + FK）⇒ 批 6 权限种子迁移落地后**必须补测**（`p4-b2c-admin-write.md §4.1-1..4`） |
| 3 | 币种状态闸的 `draft`/`frozen`/`delisted` 三支 | 库内 `currency` 只 1 行且 `status='listed'`，且**禁改 `currency`** ⇒ `409 LD008`/`423 LD009`/`409 LD010` 三支 **未测**（`p4-b2b-listing-write.md §4.1-2`） |
| 4 | `media_urls` 落库值与读口回显；`delisted` 上的 `stock` 编辑优先 reason；并发/竞态 | `p4-b2b-listing-write.md §4.1-3..5` |
| 5 | `app_config` 的 `app_config_value_is_container` CHECK（标量被拒支）；`updated_by` 无 FK 的语义面（uid=0 / 不存在 uid） | `p4-b2c-admin-write.md §4.1-6,7` |
| 6 | 前端 23 个文件的**上下文**（只看 `/api/` 命中行） | 未读页面全文 ⇒ §5.2/§2.4 的「删除按钮」是**按调用点**给的最小改造要求 |
| 7 | 编排函数的**运行时**行为（重放幂等、`ledger_event_keys` 不追加、守恒断言触发） | 属批 3 套件范围，本册只引用 migration 源码与既有交付读数 |
| 8 | `docs/data-layer.spec.md` 的 md5 复算 | 只引用父单给定前缀 `7b86b811…` |
| 9 | `POST /api/auth/register` 的 `R107` 形状对齐状态 | 批 2 三片均未触及 ⇒ 见 §7-20 |
| 10 | 批 2c 的 5 个 `410` 面的**独立复测** | Zang §5.77 登记：其亲测命令被安全层拦下 ⇒ 该面仅**单元读数**，**待补测**（`seafood.master-plan.md` §5.77 末段） |
| 11 | **批 3a 的 `frozen`/`delisted` 币种状态闸两支**（C2 的 `423`/`409` 面） | 库内无 `frozen`/`delisted` 行 + 禁改 `currency` ⇒ 只测到 `draft→listed` 与「重复上市（`listed`）」；`p4-b3a-currency-funds.md §7 N2`（同款见 §8.3-3） |
| 12 | **批 3a 的并发同键双发**（真并发竞态）与**账本 `details` 逐字形状** | 本片为串行用例 ⇒ `LD006` 探针分支**未构造**（`§7 N3`）；HTTP 驱动不搬运 PG `DETAIL` ⇒ `details` 逐字未验证（`§7 N4`；码 + status 已验证） |
| 13 | ~~**`0019` 迁移与 `ledger.ts` 手术的实际落盘**~~ ✅ **已不再是未测项（v0.3 收尾更正）** | **FIX-A 已落盘，且本册收尾时现取核实**：`migrations/0019_listing_deposit_platform_credit.sql`（167 行）**在盘**；`HOLD_KINDS` = 4 项（`ledger.ts:178`）；`-1` credit 白名单含 `listing_deposit`（`:541`）；`GET /health` 自报 **`schema_version=0019`**。**仍未测（禁当 0/空）**：FIX-A 报告 `docs/audit/p4-b3a-fix-ledger-whitelist.md` 的 **§2–§7 是「待回写」占位** ⇒ 其正向/负对照逐条读数、`tsc` 读数、注册表 17→18 的具体行**本册未取到**；`b3afix-01-verify.json` 未由本册解析 |

### 8.4 探针自曝（本册的口径缺陷与更正）

1. **行号口径切换（重要）**：`p4-route-inventory.md:32-84` 的 §1 行号 = **B1-a..B1-d 改动前**基线；本册 §1 = **v0.1 时点 live（批 2 前）**；§1.5 = **批 2 末态 live**。三处引用**必须注明口径**，否则出现「同一端点两个行号」的伪矛盾。**§1.5 自曝**：`GET /api/user/all` 与 `POST /api/admin/prize/create` 两片都记 `:875` ⇒ 系两片在不同中间版本取值，**任何逐行断言前必须现取**。
2. **§1 的「分布」计数**含一处口径妥协（1 条同时属「保留」与「改语义」按主处置计一次）⇒ **以逐行为准**，不得用该汇总数做质检判据。
3. **`R107`/`R108` 的正文出处**：本册引用 `backend-ts/src/ledger-errors.ts:2-13` 与 `:79-87,462-471`；`docs/ledger.spec.md` 内以 `R107`/`R108` 为检索词的命中**集中在文首版本记录** ⇒ 本册**不**声称逐字抄读其 §14.1 原文。
4. **`§4.1 #9`（`/api/auth/register`）的裁定文字**未在读到的区间内（`data-layer.spec.md:248` 起为 #10）⇒ §1 #4 的处置依据标注为「#9–#10 口径 + `DL35`」，其中 #9 属**推断**。
5. **`/api/order` 的方法级消费**已实测（`:176/:302/:328` 的 `method` 字段），但**未**逐条读其请求体形状 ⇒ §1 #27 的「入参走 query」是**裁定**而非现状描述。
6. **v0.2 的 delta 依据全部来自四份审计件与 Zang 裁定**（I7）；**未**复算 `p4-b2c` 的 PDF/JSON 产物本体，只引用其报告节号与读数 ⇒ 属**转引**；批 3 落地前应自行复验。
7. **v0.2 新增的 §1.5 / §1.4 断言**均由两片报告拼合 ⇒ 若两片报告本身有误，本册同步继承（**继承其 `grep` 锚点，可回溯**）。
8. **（v0.3）§1.6 / §4.1-§4.5 的批 3a 读数属「转引」**：本册**未实跑**该片 e2e（不连库），只引用 `docs/audit/p4-b3a-currency-funds.md` 的节号与读数；**该报告自曝的边界**（两轮 run、fixture mint 是本片唯一 ΔΣ≠0、行序展示问题、`details` 未逐字）本册**一并继承**。
9. **（v0.3）`0019` / `ledger.ts` 手术的状态在写作中途由「待落盘」翻转为「已落盘」（口径事故留痕）**：本册 §4.1 / §1.1 / §7-3 / §8.3-13 的**初稿**按「**FIX-A 待落盘**」写（依据 = 开工时现取 `ls backend-ts/migrations/0019*` ⇒ 无文件）；**收尾核实**（同一 `ls` + `grep HOLD_KINDS` + `GET /health`）翻转为「**已落盘**」（FIX-A 由并行单完成）⇒ **正文各处均已就地更正**；本项留痕，以免读者把两版措辞读成矛盾。**残留未测** = FIX-A 报告的 §2–§7 占位（见 §8.3-13）。
10. **（v0.3）7-15/7-16 是「给 Zang 的实证材料」，不是本册裁定**：7-15 的原文落点取自 `data-layer.spec.md:328`（本册 `grep` 现取）；7-16 的「0017 无键名枚举」取自 `grep -n 'fee\|rate\|费率\|佣金' 0017_platform_config.sql`（仅 `:81` + 头注 `:45`）⇒ **两处读法/选项均未裁定**，状态保持 `待 Zang`。
11. **（v0.3）`data-layer.spec.md` 与 `ledger.spec.md` 的行号**：本册引用的 `data-layer.spec.md:454/530/533/328`、`ledger.spec.md:79/12/13/191/492/827/844` 均为**本单现取**读数（`grep`/`sed` 口径）；`data-layer.spec.md` 的 md5 **未复算**（沿用父单，见 §8.3-8），⇒ 若该册被并行改动，行号可能漂移，**以内容/规则号为准**。

### 8.5 声明

本单**只写**五个文件：`docs/route-layer.spec.md`（就地升 v0.3）、`docs/versions/route-layer.spec.v0.3.md`（快照，与之一致，`cmp` 自证）、`docs/audit/route-layer-v0.3-delta.md`（审计件）、**`docs/ledger.spec.md`**（就地升 v0.13；**只做 `listing_deposit` 白名单相关的追加式修正 + 变更记录，不动 `R1..R109` 编号与既有条文**）、**`docs/versions/ledger.spec.v0.12.md`**（改前快照，本单新建）。**未**改 `docs/versions/route-layer.spec.v0.1.md` / `v0.2.md`（**两个既有快照一字未动**）、**未**改 `docs/seafood.master-plan.md`、**未**改 `docs/data-layer.spec.md`、**未**改其它 `docs/audit/*`、**未**改 `backend-ts/**`（含 `src`/`migrations`/`scripts`/`.p4-artifacts`）、**未**改 `frontend/**`、**未**改其它 `*.spec.md`；**未**做任何 SQL（**零库连接**）；**未**跑任何服务/套件；**未** `npm install`；**未**用 `execute_code`；**未** `git add/commit/push`；**未**用 `pkill -f`/`killall`；**未**用 `timeout`（本机无）。**★ 安全红线自证**：本单**未启停任何进程**、**未 kill 任何 PID**。

### 8.6 v0.4 变更记录与声明（**本节对 v0.4 生效；上文 §8.1–§8.5 的 v0.3 措辞为历史留痕**）

**8.6.1 本单声明（v0.4）**：本单**只写**五个文件：`docs/route-layer.spec.md`（就地升 **v0.4**）、`docs/versions/route-layer.spec.v0.4.md`（快照，与之一致，`cmp` 自证）、`docs/audit/route-layer-v0.4-delta.md`（审计件）、**`docs/data-layer.spec.md`**（就地升 **v0.7**；**只做追加式加注 §18 + 版本头一句，`DL*` 正文一字未改**）、**`docs/versions/data-layer.spec.v0.6.md`**（**改前基线快照，本单新建**）。**未**改 `docs/versions/route-layer.spec.v0.1.md` / `v0.2.md` / `v0.3.md`（**三个既有快照一字未动**）、**未**改 `docs/versions/data-layer.spec.v0.1.md`–`v0.5.md`、**未**改 `docs/ledger.spec.md`（v0.13 原样）、**未**改 `docs/seafood.master-plan.md`、**未**改其它 `docs/audit/*`、**未**改 `backend-ts/**`（含 `src`/`migrations`/`scripts`/`.p4-artifacts`）、**未**改 `frontend/**`、**未**改其它 `*.spec.md`；**未**做任何 SQL（**零库连接**）；**未**跑任何服务/套件；**未** `npm install`；**未**用 `execute_code`；**未** `git add/commit/push`；**未**用 `pkill -f`/`killall`；**未**用 `timeout`（本机无）。**★ 安全红线自证**：本单**未启停任何进程**、**未 kill 任何 PID**。

**8.6.2 §8.3 `NOT_MEASURED` 的 v0.4 增补（禁当 0/空）**：

| # | 项 | 原因 |
|--:|---|---|
| 14 | **`401`/`403` 的服务端日志逐条归因** | **本仓不落请求级 access log**（实测 1199 行窗口内 `/api/currency` = 0 行、`403` = 0 行）⇒ **结构性不可测**；替代取证 = 响应体 `R107` + 零分录（§3.4 / §7-24）；**Zang §5.84 ③ 接受该处置** |
| 15 | **`0020` 迁移的 `prosrc`/改前改后逐字 diff 读数** | 本册**转引** Zang 亲验（`p4-b3a-fix2-ledger-post-event-shape.md`；`0020` sha256 `228127d8…`、`0020:30` 的 IN 列表）⇒ 本册**未**连库复算 |
| 16 | **`frozen`/`delisted` 币种状态闸两支**（承接 §8.3-11） | **v0.4 仍为未测**（批 3a 真收官未触及这两支；库内无该状态行 + 禁改 `currency`） |

**8.6.3 §8.4 探针自曝的 v0.4 增补**：

| # | 项 |
|--:|---|
| 12 | **（v0.4）§1.6 与 §1.7 并存是刻意的**：§1.6 = **FIX-B 前**历史读数（**保留不删**）、§1.7 = **真收官**读数；**读者不得据 §1.6 的 `frozen` 形态判当前口径** |
| 13 | **（v0.4）本册对批 3a 读数为「转引」**：本册**未实跑**该片 e2e（不连库），只引用 `docs/audit/{p4-b3a-currency-funds,p4-b3a-fix-ledger-whitelist,p4-b3a-fix2-ledger-post-event-shape,p4-b3b-currency-funds-fix}.md` 的节号与读数 ⇒ **继承其自曝边界**（b3b 探针的 `entries`/`kinds_ok`/`both_legs_owner_and_neg1` 三字段已声明作废、`sql()` 调用式坑、`details` 未逐字） |
| 14 | **（v0.4）裁定原文落点**：本册引 `master-plan` **§5.82 的 7-15/7-16/7-23 = `:1429/1430/1431`**、**§5.84 三裁定 = `:1401`**（`grep` 现取）⇒ 行号若因并行写作漂移，**以节号/内容为准** |
| 15 | **（v0.4）`C1-T05`/`C2-T17` 的「同号异案」风险**：`p4-b3a` 报告与 `p4-b3b` 报告的用例号**重号但不同案**（前者「缺值 ⇒ `400`」→ 现「`200`」；后者「`999` < 下限 ⇒ `400`」）⇒ 本册 §4.4-12 **显式区分**；引用时**必须带报告名** |

### 8.7 v0.5 增补（NOT_MEASURED / 自曝 / 声明）

**8.7.1 本单声明（v0.5）**：本单**只写**三个文件：`docs/route-layer.spec.md`（就地升 **v0.5**）、`docs/versions/route-layer.spec.v0.5.md`（快照，与之一致，`cmp` 自证）、`docs/audit/route-layer-v0.5-delta.md`（审计件）。**未**改 `docs/data-layer.spec.md`（**本单未写该册、未建任何 data-layer 快照**）、`docs/ledger.spec.md`（v0.13 原样，**`R1..R109`/33 码一字未动**）、`docs/versions/route-layer.spec.v0.1/v0.2/v0.3/v0.4.md`（**四个既有快照一字未动**）、`docs/versions/data-layer.spec.v0.1–v0.6.md`、`docs/seafood.master-plan.md`、其它 `docs/audit/*`、`backend-ts/**`（含 `src`/`migrations`/`scripts`/`.p4-artifacts`）、`frontend/**`。**未**做任何 SQL（**零库连接**）；**未**启停任何服务/进程、**未**跑任何套件；**未** `npm install`；**未**用 `execute_code`；**未** `git add/commit/push`（**只跑只读 `git status/log/show/diff`**）；**未**用 `pkill -f`/`killall`；**未**用 `timeout`（本机无）。**★ 安全红线自证**：本单**未启停任何进程**、**未 kill 任何 PID**。

**★ 关于 `docs/data-layer.spec.md` 未写的显式判定（本单 delta 与 data-layer 的关系）**：本单全部 delta 落在**路由 / 服务编排层**（未注册清单 + 两条行为 delta + 批 3b 落地事实 + `create_key` 口径登记）⇒ **没有任何 `DL*` 规则需要修改**：`DL86` 的两形态是**实测验证既有条文**（不是改条文）；`create_key` 口径若最终裁定「2a 也改 fail-loud」，那属 **§4.5/§4.4 的编排口径**（本册），**不构成 data-layer 变更**。⇒ **本单守「只许追加式」的上限 = 一次都不用追加**（该册现取 = **1023 行 / md5 `ad657c0a5068e91cb57d935bb34fd86b`**，v0.7 含 §18 加注，**本单未触碰**）。

**8.7.2 §8.3 `NOT_MEASURED` 的 v0.5 增补（禁当 0/空）**：

| # | 项 | 原因 |
|--:|---|---|
| 17 | **审计 `p4-aud-jobkey.md` 自身的未测项**（承接其 §2.4/§5.5；其读数已折入 §7-25） | ① **「不同 worker 对同一 job」**的键碰撞**未造夹具**（其 §2.4 标 `NOT_MEASURED`，只有**代码推断**）；② 前端「不传键」= **静态 `grep` 取证、非运行时抓包**；③ 其 §4 的 **A/B/C 三选项未被选择** ⇒ **改法未定 = 待 Zang**（**禁止**把「碰撞不成立」当成「2a 无需改」的裁定） |
| 18 | **前端旧 `400` 依赖的全量核验** | 只现取了 `DashboardPage.jsx:223-236` 一个调用点 ⇒ 前端 **23 文件 / 单测**未全量扫（§2.4 S9 / §7-27） |
| 19 | **`/api/job*` 六条未注册路径的 HTTP 面** | 路径未注册 ⇒ HTTP 层**按设计不存在**（落 §1.3 兜底 404）；其 200/400/403/409 分支由 **service 直调**给出（`p4-b3c-job-funds.md §7 N1`） |
| 20 | **`disputed` 状态分支 / J1 的 `draft`·`frozen`·`delisted` 三态币种闸 / `job_escrow_missing` 防凭空退款 / 并发双 settle** | 批 3b **未构造**（`p4-b3c-job-funds.md §7 N3/N4/N6/N7`）⇒ 承接为未测 |
| 21 | **`401`/`403` 的日志逐条归因（批 3b 面）** | 同 §8.3-14：本仓不落 access log ⇒ `p4-b3c-job-funds.md §4.2` 亦只做「响应体 + 零分录」双取证 |
| 22 | **批 3b 报告本体与其产物的复算** | 本册**转引** `p4-b3c-job-funds.md` 的节号与读数（**未连库**、未解析 `e2e.json`）；**Zang §5.85 A ①–⑤ 已亲验其中 5 项**（守恒复算 / 逐 kind / 原子性 / 单写路径 / 注册点） |

**8.7.3 §8.4 探针自曝的 v0.5 增补**：

| # | 项 |
|--:|---|
| 16 | **（v0.5）「批 3b」与「`p4-b3c`」= 同一片的两个名字**：**Zang §5.85 A 定名 = 批 3b（招工资金）**，而产物 tag / 报告名 = **`p4-b3c`**（`docs/audit/p4-b3c-job-funds.md`、run tag `b3c-20260930T021741`）⇒ **不得**据名字差异判为两片；本册统一写「**批 3b（报告 tag `p4-b3c`）**」。**同款第三人证**：审计 `p4-aud-jobkey.md:191` 把 verify 面记为「批 **3c**」（按产物 tag 命名）⇒ **三处命名并存**（**Zang 定名 = 3b** / 报告 tag = `b3c` / 审计内称 = 3c）⇒ **一律以 Zang §5.85 的「批 3b」为准** |
| 17 | **（v0.5）§1.8 是「现取扫描」，不是转引**：清单由本册**实跑**扫描命令得出（服务层导出 `grep` × `index.ts` 已注册路径表 + 逐 verb 核调用点），并与 Zang §5.85 首批 3 条**逐条比对**；**扫描命令与命中数写进 §1.8**，可复算 |
| 18 | **（v0.5）行号口径**：§1.5 的「批 2 末态」列**沿用 v0.4 读数**；**本册只新增「批 3b 末态」现取三处**（`/api/currency` `:1166`、`/api/currency/:cid/list` `:1185`、`/api/tasklist/:jID/verify` `:1061`）⇒ **未**重刷全表（**不做未测的批量回填**）；**现取 vs v0.4 记载的漂移已逐条登记**（§0 端点锚口径行） |
| 19 | **（v0.5）`git` 只读用法（改前锚点可复算）**：两条行为 delta 的「改前」取自 `git show 9d40b17:backend-ts/src/index.ts`（`9d40b17` = 批 3b 的**前一 commit**；`Invalid jID` 命中 3 → `8f2974c` 后 2）；`git status --porcelain` **现取 = 空**（工作树干净 ⇒ 批 3b 已提交）⇒ 本册**未**用工作树状态推断改动面 |
| 20 | **（v0.5）本册新增的 §1.8「准入判据」是本册口径、非 Zang 原文**：Zang §5.85 只给了**表头四栏**与**目的**；三条准入判据、扫描口径块、负向排除与正向对照表 = **本册为实现可复算而加**，若与 Zang 意图不符 ⇒ **以 Zang 为准**（登记 §7-26） |

**8.7.4 v0.4 → v0.5 关键 delta 对照（便于质检对拍）**：

| 项 | v0.4 表述 | v0.5 | 依据 |
|---|---|---|---|
| 「已实现·未注册」路径 | 散落 §1.1/§1.2/§4.6，**无集中清单** | **§1.8 集中清单（8 条 + 1 附注）+ 准入判据 + 扫描口径** | **Zang §5.85 裁定①（新纪律）**；§7-26 |
| 清单条目数 | Zang 首批 = **3 条** | **本册实测 = 8 条 + 1 附注**（3 条全含 + 本册多出 5 条，差异已写明） | §1.8 扫描读数 |
| `POST /api/job`（J1）批次 | 「**批 3**」 | **批 3b 服务层已落地（`publishJob`）；路由随批 4** | `p4-b3c §1.3`；**Zang §5.85 裁定①** |
| J5/J6（新路径） | 「**批 3**」 | **既有 `/api/tasklist/:jID/verify` 已改接（批 3b）；新路径随批 4**（§1.8 #5/#6） | `p4-b3c §2.1`；§1.9 K2/K5 |
| 非数字 `:jID` | **未规定** | **`404 LEDGER_REF_NOT_FOUND` + `reason=jID_not_found`**（原 `400 Invalid jID`，改前 = `9d40b17:index.ts:1064-1067`） | `p4-b3c §2.3 Δ1`；**Zang §5.85 裁定② 批准** |
| admin-queue bespoke `400` | **未规定** | **撤除**（读口结构性排除 = `database.ts:1979/2024` 的 `COALESCE(u.is_admin,false)=false`） | `p4-b3c §2.3 Δ2`；**Zang §5.85 裁定②** |
| `create_key` 缺失 | **未规定** | **J1 = fail-loud（不派生）**（§4.4-14）；**2a = 审计结论「碰撞不成立」（非同类静默重放）**，**改法（A/B/C）待 Zang ⇒ §7-25** | **Zang §5.85 裁定③**；`p4-aud-jobkey.md §0.1/§1/§2.3,§3,§4` |
| `ledger_entry` 42 → 76 | 未记载 | **Δ34 枚举等式闭合**（escrow 10 / refund 4 / payout 6 / fee 6 / commission 4 / transfer 4） | **Zang §5.85 A ②**；`p4-b3c §3` |
| `Σtotal` | 2,000,000（批 3a） | **2,000,000（第三次独立复算、逐位相同）**，负值行 0 | **Zang §5.85 A ①** |
| 注册点 / 迁移 | 53 / `schema_version=0020` | **53 → 53**（只改接既有路由）/ **未新增迁移**（文件数仍 19）⇒ `schema_version` 仍 **0020** | `p4-b3c §1.3,§6`；本册现取 |
