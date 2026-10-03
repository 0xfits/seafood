# 路由层与资金编排契约（ROUTE-LAYER-SPEC）

> **状态：v0.8（历史 · **已被 v0.9 取代**，正文原样保留）** · 原文：**（已完成 · **Zang §5.89 裁定①/② + §5.90 裁定①–⑤ 折入**：★ **`LD001`–`LD033` 全键普查 + 33 键真值表写全 + 9 键逐键表态** + **8 处期望码格类级订正**（`400 LD022`×4 / `400 LD020`×1 ⇒ **`LD021`**；`LD018` 误标金额码 ×2 ⇒ **`LD017`**）+ **★ 金额来源二分立法**〔新 §4.8〕+ **`sunset` 日期口径**〔新 §5.5〕+ **★ 批 4 施工清单**〔新 §9〕；**本单只追加、就地订正 10 处（逐处保留旧写法）**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v0.8 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.8-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = Zang §5.89 / §5.90 …」；**无一处与之冲突**；**唯一无法从裁定直接推出的一项 = A1 的金额归类，已标 `待 Zang 复核`**）。
> **★★ v0.8 本单要点（先说结论，不含糊）**：
> ① **★ `LD001`–`LD033` 全键普查 + 33 键真值表写全**（依据 = **Zang §5.89 裁定① + §5.90 裁定①**；真源 = `backend-ts/src/ledger.ts:1029-1063`〔`:1030` `LD001` … `:1062` `LD033`〕+ `src/ledger-errors.ts:28-70`）⇒ **v0.7 §4.7.1 的 5/33 覆盖补齐为 33/33**，并对 spec 全程未提及的 **9 键**（`LD004`/`LD012`/`LD013`/`LD015`/`LD025`/`LD026`/`LD027`/`LD028`/`LD029`）**逐键表态**；正文 = **§4.7.4**（**残余明写**：`503` 家族在本 spec 内无状态码条文 ⇒ 只登记、不发明）。
> ② **★ 类级订正 8 处（合并 Neng D1/D2/D6 + §7-31）**：`400 LD022` ×4（§4.2 J1/M1/A1 + §4.4-6）**⇒ `LD021`**（依据 Zang §5.89 裁定①）；§4.2 P2 的 `400 … LD020` **⇒ `LD021`**（D1）；§4.2 C1/C2 的 `LD018(`LEDGER_AMOUNT_NOT_POSITIVE`)` **⇒ `LD017`**（D2/D6）—— **逐处就地改、旧写法留痕**（§4.7.4.3）。
> ③ **★★ 金额来源二分 = 规则（立法）**（依据 = **Zang §5.90 裁定②**，**推翻 Neng D3 的定性**）：**招工酬金 `reward` = 雇主自主出价（客户端供给侧，不是缺陷）**；**平台侧金额（`fee`/`deposit_amount`/`fee_rate_bp` 及其下限）必须服务端取数** ⇒ 正文 = **§4.8**（三问归类判据 + 逐事件表 + 判负 5 条）；**任何新金额字段必须先归类**。
> ④ **`sunset` 日期口径**（依据 = **Zang §5.90 裁定④**，Neng D5）：13 面**要么给日期、要么显式写「随批 4 移除」**；**具体日期 = `待 Kevin`**（**本册不得自定日期，未写任何 `YYYY-MM-DD`**）⇒ 正文 = **§5.5**。
> ⑤ **★ 批 4 施工清单** = 新 **§9**（元信息 = **项目 / 真源锚点 / 行动 / 前置依赖 / 验收判据**）：**A 栏** §1.8 十条未注册路径 + 1 附注（逐条「由批 4 注册」）；**B 栏** §2.4 `S1`–`S10` + **`S-b3e-1/2/3`**；**C 栏** 两条既有路径行为 delta 的回归核；**D 栏** DL68 残余加固（**必带判负**）；**E 栏** 旧直写函数收口 / 注释更正 / 兜底形状 / 13 面删除。
> ⑥ **路径正典**（依据 = **Zang §5.89 裁定②**）：`POST /api/listing-orders/:orderId/refund` ⇒ **§4.2 P4 路径格已就地同步**（旧写法留痕），§1.2「命名张力」关闭（**§7-37**）。
> ⑦ **只追加、未重写**：**非追加改动只有 10 处就地订正**（8 期望码格 + 1 路径格 + 1 状态列 §7-31），**§4.1–§4.6 其余 / §4.7.1–§4.7.3 / §5.1–§5.4 / §6 / §7-1…7-33 正文一字未动**；**§7 只追加 7-34…7-40 + 补注块**；**纪律自检见 §8.10.5**。
> **状态：v0.7（历史 · **已被 v0.8 取代**，正文原样保留）** · 原文：**（已完成 · **Zang §5.88 裁定 ②/③/④ 折入**：★ **类级订正 `LD023` → `LD022`（4 处；**§4.2/§4.4 期望码格内 `LD023` 现取命中 = 0**）** + **退款发起人 = 仅卖方**〔§4.2 P4 actor 口径〕+ **§1.8 补两条（3c 落地）** + **§4.7 / §7 新登记**；**本单只追加、未重写任何已有节**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v0.7 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.7-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = Zang §5.88 …」；**无一处与之冲突**）。
> **★★ v0.7 本单要点（先说结论，不含糊）**：① **★ 类级订正 `LD023` → `LD022`（4 处）** —— 依据 = **Zang §5.88 裁定④**；真源 = `backend-ts/src/ledger.ts:1051`（`LD022: 'LEDGER_REF_NOT_FOUND'`、**404**）/`:1052`（`LD023: 'LEDGER_UNKNOWN_KIND'`、**400**）+ `src/ledger-errors.ts:56-57` ⇒ spec 原写「`404` LD023」的 4 处（§4.2 **J1 / P2 / P4 / M2**）**语义 = 关联单据不存在** ⇒ **一律订正为 `LD022`**；**类级扫描全表 + 逐处改/不改及理由 + `LDxxx` 真值表 = §4.7.1 / delta 件 §D2**（**另一类 `400 LD022`（4 处）= 反向同类缺陷，本单不擅改、登记 §7-31**）。
> ② **退款发起人 = 仅「卖方」**（**Zang §5.88 裁定②**）：**依据 = 资金从卖方余额出 ⇒ 由出资方发起**；**若允许买方单方退款 = 对卖方的单向掠夺向量**；写入 **§4.2 P4 的 actor 口径**（真源 = `src/listing-funds-service.ts:62`）；**「管理员可发起」登记为后续能力（批 6，随权限模型）** ⇒ **§7-32**。
> ③ **§1.8 补两条（3c 落地）**：`POST /api/listing/:listingId/buy`（`src/listing-funds-service.ts:191` `buyListing`）/ `POST /api/listing-orders/:orderId/refund`（`:261` `refundListingOrder`）⇒ **§1.8 清单 8 条 → 10 条 + 1 附注**（**兑现 §7-29**；本册**真扫描**复算 = 服务层具名导出 **29**（6 文件）、`src/index.ts` 注册点 **53**、未注册 verb 调用点 **0 × 10**）。
> ④ **折入批 3c（商品资金）已落地事实 = 新开 §4.7**（**带真源 + 带报告锚点**）：`listing-funds-service.ts` **317 行** + 两常量单点（`:55` `REFUND_ROLLS_BACK_STOCK=false` / `:62` `REFUND_ACTOR_IS_SELLER_ONLY=true`）；`src/database.ts` **+68/−0**（`listingPostEvent:1773` = **单语句** `SELECT public.listing_post_event($1::jsonb)`；`resolveListingOrder:1788` **只读**）；**注册点 53 → 53**；报告 `docs/audit/p4-b3d-listing-funds.md` **309 行**；**资金不变量 `Σtotal` 恒 2,000,000** + `ledger_entry` **76 → 86**（`purchase 2/sale 2/purchase_refund 2` + **夹具供资 `transfer` 4→8 单列**）；伪造 `price/seller_uid/buyer_uid` **被忽略**。
> ⑤ **只追加、未重写**：**除 4 处 `LD023`→`LD022` 与 P4 actor 口径两处「类级订正」外，§4.2 商品事件行 / §4.5 幂等键总表 / §1.8 清单表体与编号 / §7-1…7-30 一字未动**（因另一单元 **Kong · 交易所资金 3d** 正并发阅读 **§4.2 / §4.5 / §1.8 / §3**）；**§7 只追加 7-31/7-32/7-33 + 补注块**；**纪律自检（措辞修正）见 §8.9.6**。
> **状态：v0.6（历史 · 已被 v0.7 取代，原样保留）** · **Zang §5.86 两条裁定折入**：★ 幂等键契约「选项 B」升为**显式契约**〔§4.5 追加块〕+ §1.8 清单维护责任**三方分工**〔§1.8 追加块 / §7-26〕；**该单只追加、未重写任何已有节**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v0.5（881 行 / md5 `7493f410b30de2ff042a3b137eeb0615` / 210464 字节）是本册直接前身**（内容 = 批 3b「招工资金」折入 + ★新增 §1.8「已实现·未注册清单」（Zang §5.85 新纪律）+ 两条既有路径行为 delta 定案），快照 `docs/versions/route-layer.spec.v0.5.md` 与本册前身**逐字节相同**（`cmp` 自证）。
> **v0.4（763 行 / md5 `e8b3ceffd98ef82fb37c77c2b13b6108` / 166747 字节）**（v0.5 的直接前身），快照 `docs/versions/route-layer.spec.v0.4.md` **未动**。v0.3（716 行 / md5 `fa91425ed380423d0f01f577f0f53aa6` / 143415 字节）快照 `docs/versions/route-layer.spec.v0.3.md` **未动**（与本册前身主体逐字节相同）。v0.2（668 行 / md5 `0c587183a66ae39b597370acc08ac2fc` / 115905 字节）、v0.1（498 行 / sha256 `6f27b4add4b79da36602f20ba93f6edd2d93dcdc4d9164c00293909a697b5018`）快照亦**未动**。
> 本册是**批 3 / 批 4 实现的唯一依据**。实现（Kong）与质检（Neng）一律以本册条文为口径；冲突交 Zang 终审。
> **v0.6 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.6-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（**本单两条 delta 直接来自 Zang §5.86 裁定①/②，无一处与之冲突**）。
> **★★ v0.6 本单要点（先说结论，不含糊）**：① **★ 幂等键契约定案 = 采纳「选项 B」（零改码，把过渡口径升为显式契约）**（**Zang §5.86 裁定①**）—— **契约 = 派生键 = 实体自然标识的单射**：2a 两处（**本册现取逐字**）`resolveJobCreateKey(params.createKeyRaw, ['submit', params.identifier, params.workerUid])`（`backend-ts/src/job-service.ts:133`）与 `(…, ['apply', params.jobId, params.workerUid])`（`:180`）⇒ **入参只有实体标识、不含内容**（已实测 + Zang 亲读源码复核）；**行为矩阵 = 同标识 + 同内容 ⇒ `200` replay（零新增分录）/ 同标识 + 异内容 ⇒ `409`（`LEDGER_IDEMPOTENCY_CONFLICT` + `details.reason=REPLAY_FINGERPRINT_MISMATCH`）/ 异标识 ⇒ 新实体、落新行（即使内容逐字相同）**；**另一条口径 = 无自然键可用的实体（如 3b 的 `job`，`job_id` 是 IDENTITY）必须 fail-loud、不派生**。**永久回归项** = **409 面必须持续为 409、不得退化为静默 replay**（**§7-28**）；**批 4 前端同步项（条件触发）= §2.4 S10**（若前端将来需要「同实体重复提交且内容已变」⇒ **必须先传 `create_key`**）。依据 = `docs/audit/p4-aud-jobkey.md`（**248 行**；T1/T2/A1/A2 ⇒ 均落新行；**T3 ⇒ replay**；**T4 ⇒ 409**）+ **Zang §5.86 裁定①**；正文 = **§4.5 追加块**。
> ② **★ §1.8「已实现·未注册清单」的维护责任 = 三方分工（已定）**（**Zang §5.86 裁定②**）：**Kong（实现方）每片收尾**扫「本片新增的已实现·未注册路径」并报「**认领 N 条 / 未认领 M 条**」；**Jing 维护 §1.8 表**（**每次 spec 版本刷新真扫描一遍**：`grep` 服务编排文件导出 × 对照 `src/index.ts` 已注册路径表）；**Zang 批末做差集**（**全量服务层导出 − 已注册 − §1.8 已登记 = ∅**）。正文 = **§1.8 追加块 / §7-26**。
> ③ **AUD-JOBKEY 审计件入册** = 新开 **§1.10**（审计件 + 产物 4 文件 + 探针 + **零 `modified`** 取证 + 三选项去向下沉）。
> ④ **本单只追加、未重写**：**§4.2 商品事件行 / §4.5 幂等键总表 / §1.8 清单四栏表体与编号 —— 一字未动**（因另一单元 **Kong · 3c 商品资金**正并发改 `backend-ts/src/**` 并阅读 §4.2 / §4.5 / §1.8）；**§7-1…7-24 与 7-27 一字未动**（v0.6 只改 **7-25 / 7-26 的状态列**并**追加** 7-28/7-29/7-30 与补注块）。
> **v0.5 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.5-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本册逐处标注「依据 = Zang §5.8x」；**本单无一处与裁定冲突**，两条行为 delta 与「已实现·未注册清单」均已获 §5.85 批准）。
> **★★ v0.5 本单要点（先说结论，不含糊）**：① **★新增 §1.8「已实现·未注册清单」（本轮最重要 · 依据 = Zang §5.85 裁定① 新纪律）** —— 表头 = **路径 / 服务层落点（`文件:行号`）/ 为何未注册 / 由哪一批注册**。**本册做了一次真扫描**（`grep` 五个服务编排文件的导出 × 对照 `src/index.ts` 的已注册路径表，逐 verb 核调用点）⇒ **实测清单 = 8 条 + 1 附注**：Zang 首批点名的 3 条（`POST /api/job/:jobId/apply`、`/accept`、`POST /api/listing`）**全部命中且被包含（无遗漏、无冲突）**；**本册实测多出 5 条**（`publishJob`→`POST /api/job`、`settleJob`→`/api/job/:jobId/review`、`refundJob`→`/review`·`/cancel`、`updateListing`·`transitionListingStatus`→`POST|PATCH /api/listing/:listingId`）⇒ **差异已在 §1.8 与 delta 件逐条写明，以本册实测为准**。**此清单的目的 = 防止「已实现但未注册」的路径被两片互推而永久遗忘**（先例 = `admin/assets/init` 在 2a/2b 两份报告里都写「归同批其它片」、无人执行；见 Zang §5.78）。② **折入批 3b 已落地事实（带真源）**：新建 `src/job-funds-service.ts`（**330 行 / sha256 `7b808634…`**；`publishJob` `:149`/`settleJob` `:218`/`refundJob` `:237`/`verifyJobSubmission` `:308`）；`src/database.ts` **+3 method**（`jobPostEvent` = **唯一资金写路径** `:1665` `SELECT public.job_post_event($1::jsonb)`；`resolveReviewTarget` 只读；`reviewJobSubmission` = **单条 SQL**：`WITH ev AS (job_post_event)` + `sub AS (UPDATE job_submission)` + 末 `SELECT` ⇒ 「结论位 + 资金同语句」）；`src/index.ts` **只改接** 1 条既有路由 `POST /api/tasklist/:jID/verify`；**注册点 53 → 53**；报告 `docs/audit/p4-b3c-job-funds.md`（见 **§1.9**）。③ **DL86 两形态实测事实**：无邀请人 ⇒ `job_fee` 入 `-1`（`-2` 命中 **0**）；真链 `depth=2` ⇒ **8 腿** = `job_payout`×2 + `job_fee`×2 + **`commission`×4**，`-2` 进 **+10** / 出 **−10** 守恒、`-1` 命中 **0**；**每个事件 `Σ(delta+frozen_delta) = 0`**；托管/退款 = **同账户 2 腿** `balance↔frozen`。④ **两条既有路径行为 delta 定案（Zang §5.85 裁定② 已批准）**：**非数字 `:jID` `400` → `404`（`R107`）**（对齐 detail-miss 统一 404）；**撤除「admin 提交不进面板队列」的 bespoke `400` 守卫**（读口已结构性排除 + §3.3-8）；两条均**登记回归项**「前端是否依赖旧 `400`」= **§2.4 S9 / §7-27**（真源 = 前端调用体，本册现取）。⑤ **登记（裁定未落者标 `待 Zang`）** = **§7-25**（`create_key` 缺失时**派生兜底 vs fail-loud** 两套口径：**3b 面已定**〔Zang §5.85 裁定③ 批准 fail-loud〕；**2a 面 = 审计件 `docs/audit/p4-aud-jobkey.md` 本单现取已落盘（246 行）⇒ 结论 = 「碰撞不成立」** —— 2a 派生键 = **自然标识的单射**（`fallbackParts` 不含内容）⇒ 异实体必不同键（实测 T1/T2/A1/A2 均落新行）、同实体异内容 ⇒ **409 响亮拒绝**（非静默）；**但改法 = 审计的 A/B/C 三选项仍待 Zang 裁定**〔审计自述「只取证不裁决」〕⇒ 由 v0.6 定案）+ **§7-26**（§1.8 清单的**维护责任**——**机制已定、责任人待 Zang**）+ **§7-27**（前端旧 `400` 依赖的全量回归核验）。⑥ **§7 状态列**：**新增 7-25 / 7-26 / 7-27**；**7-1…7-24 逐条保留**（未得裁定者一字不动）。
> **v0.4 修订入口（历史）**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.4-delta.md`。
> **★★ v0.4 本单要点（历史，仍在册 · 其中「注册点仍 53」与「金额已改服务端取数」两句仍成立）**：**批 3a 真收官** —— `migrations/0019_listing_deposit_platform_credit.sql`（`listing_deposit` 入 **DB 侧 `-1` credit 白名单**）+ `migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（把 `listing_deposit` 从 **`ledger_post_event` 函数体** hold 家族 IN 列表摘除）**两迁移均已应用**（`/health` 自报 **`schema_version=0020`**、`schema_migration` = **19**、`0018` 无文件勿补）；`src/ledger.ts` 的 `HOLD_KINDS` **5→4**（`:178` 现取）；C2 最终入账形状 = **4 腿全在 `balance`**（上市费 `currency_create_fee` ×2 + 保证金 `listing_deposit` ×2，**贷方 = `uid=-1`**、**`frozen` 零变动**）/ C1 同族；回执含 `deposit_consumed` / `deposit_credit_uid:'-1'` / `deposit_refundable:false`（真源 = `src/currency-service.ts:433,439,440`）；**注册点仍 53**（本片未增删对外路径）。**金额已改服务端取数 + 下限校验**（`FIX-B` 落地：`currency-service.ts:140-142` 三个 `*_FLOOR` 常量，逐条标 **`TODO: Kevin 定值`** = 占位非经济值）；**低于下限借码 = `LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`**（Zang §5.84 ① 裁定，本册正式化进 §3.2/§4.4）。**Zang §5.82 四项裁定逐条折入**：**7-15 定案**（`DL38` 以 **读法①「旧查询函数调用数 = 0」** 为准 + 三条补强：具名函数清单 / 同核 5 组端点 200·404·410 / 类级扫描）、**7-16 定案**（**采纳 (A) 删除**自拟 `FEE_RATE_KEY_PATTERNS`；真源唯一改由**读取侧纪律**保证；登记「`app_config` 合法键清单/写入门禁」为**批 6 配置面规格**）、**7-23 定案**（机制已落地、**数值待 Kevin**）。**401/403 取证口径精化**（Zang §5.84 ③）：本仓**不落 access log** ⇒ 正解 = **响应体（`R107` + `reason`）+ 零分录**取证 + 显式 **`NOT_MEASURED`**（**禁把「查不到」当「无异常」**）。
> **★★ v0.3 本单要点（历史，仍在册）**：**v0.2 §7-3 的「保证金 = 冻结可退」是错误推断**（v0.2 采信的是 `HOLD_KINDS` 那一侧），**由 Zang §5.81 纠正**（`docs/seafood.master-plan.md:1435`）。**最终裁定 = `listing_deposit` 上市即消耗 → 贷 `uid = -1`（不可退、无退还 kind、无罚没）**。**真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时漏删）⇒ 代码里「同一 kind 两种口径并存」。**FIX-A 已落盘**：① `migrations/0019_listing_deposit_platform_credit.sql`（167 行；**加法式**扩展 DB 侧 `-1` credit 白名单；**kind 关闭集仍 20**）；② `src/ledger.ts` 手术：`HOLD_KINDS` 现 = `['hold','hold_release','job_escrow','job_escrow_refund']`（**`:178`** 现取，已移除 `listing_deposit`）；③ `ledger.spec` v0.13 已回写。**FIX-B 亦已落地**（见上「v0.4 要点」）。
> **★★ v0.3 本单要点（原始措辞 · 留痕；其中「FIX-A 报告行数 / 占位」与「FIX-B 状态」已由 v0.4 更新，**以 v0.4 要点与 §1.7 为准**）**：**v0.2 §7-3 的「保证金 = 冻结可退」是错误推断**（v0.2 采信的是 `HOLD_KINDS` 那一侧），**由 Zang §5.81 纠正**（`docs/seafood.master-plan.md:1390-1399`）。**最终裁定 = `listing_deposit` 上市即消耗 → 贷 `uid = -1`（不可退、无退还 kind、无罚没）**。**真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时漏删）⇒ 代码里「同一 kind 两种口径并存」。**FIX-A 已落盘（v0.3 收尾时现取核实）**：① 新增迁移 `backend-ts/migrations/0019_listing_deposit_platform_credit.sql`（167 行；**加法式**扩展 DB 侧 `-1` credit 白名单，`CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation`，其余每格逐字不变；**kind 关闭集仍 20**）；② `backend-ts/src/ledger.ts` 手术：`HOLD_KINDS` 现 = `['hold','hold_release','job_escrow','job_escrow_refund']`（**`:178`**，已移除 `listing_deposit`）、`-1` credit 白名单已加 `listing_deposit`；③ **迁移已应用**：`GET /health` 自报 **`schema_version=0019`**（`2026-09-29T17:44:45Z`）；④ 交付件 `docs/audit/p4-b3a-fix-ledger-whitelist.md`（**v0.4 复核：198 行、§0–§7 全在、无「待回写」占位** —— Zang §5.82 查盘结论）+ 产物 `backend-ts/.p4-artifacts/b3afix-20260930T014132/{b3afix-00-probe.json,b3afix-01-verify.json}`。**FIX-B 已落地**（v0.4：C2 消耗入 `-1` + 金额服务端取数；见 v0.4 要点 / **§1.7**）。

> **状态：v0.9（已完成 · **批 4a 注册切片落地 + QA-B4 独立质检（7 腿全 PASS）折入**：★ **§1.8 十一条全部注册 ⇒ 注册点 53 → 65** + **F-1 集成缺口关闭** + **A5 新路径键集 = `jobEventView`（15 键）**〔旧路径 `11/9` 键集不变、**两者不得串**〕+ **A6/A11 权限点名** + **§4.8 金额来源二分 ⇒ 三分（新增 ②「授权主体意图额」）** + **§4.5 点名 C1 派生输入 = `symbol`**；**本单只追加，就地更新仅限「状态列 / 已注册事实」**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v0.9 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v0.9-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = Zang §5.91 / §5.92 / §5.93」；**无一处与之冲突**；**唯一口径细化项 = `jobEventView` 本体 14 键 vs A5 面 15 键，标 `待 Zang 复核`**〔§7-42〕）。
> **★★ v0.9 本单要点（先说结论，不含糊）**：
> ① **★ 注册点 53 → 65（+12）**（依据 = **Zang §5.92**；真源 = `docs/audit/p4-b4a-route-registration.md` §4）—— 逐条路径 → 行号（**本册现取复核，逐条相符**）：`POST /api/job` `:1289` / `/:jobId/apply` `:1305` / `/accept` `:1327` / `/submit` `:1352` / `/review` `:1380` / `/cancel` `:1404` / `POST /api/listing` `:1422` / `POST /api/listing/:listingId` `:1448` / `PATCH /api/listing/:listingId` `:1475` / `/buy` `:1499` / `POST /api/listing-orders/:orderId/refund` `:1520` / `POST /api/admin/commission_policy` `:1540`；`src/index.ts` 现 **1575 行**；**§1.8 清单 = 已清空 / 无遗留**。
> ② **★ F-1 集成缺口已关闭**（同一 job 走通 **A1→A2→A3→A4→A5**；真源 = 4a 报告 §3 + QA-B4 §0 腿 3）。
> ③ **★ 腿归因真差额 = 0**：`ledger_entry` **189 → 213** = **QA-B3 夹具 8 + 4a 16**（与 Zang 自算完全对齐；真源 = QA-B4 §2.2）。
> ④ **`fee>0` 结算形态实测通过**：`reward=100000 ⇒ fee=1000`；`job_payout` ×2 + `job_fee` ×2（**`-1` `+1000`**）；无链 ⇒ `commission` **0 腿**；**「有链 ⇒ 入 `-2`」的 HTTP 级形态 = `NOT_MEASURED`**（§8.11.2-40；后续低优先抽查 = **§7-41**）。
> ⑤ **migrations 19/19 checksum 匹配**（`mismatches:[]`）+ **`Σtotal` 恒 2,020,100** + 负值行 **0** + `23514` 未触发（QA-B4 §5/§6）。
> ⑥ **4a 的 `git diff --numstat` = `+323/−2`**（**被替换 2 行 = import 重导入**，**既有路径零影响**，已由 QA 用 `comm -23` = **0** 取证；**本册现取 = 工作树已提交、`git status --porcelain` 干净** ⇒ 该读数**转引 QA-B4 §2.1**，见 §8.11.3-38）。
> ⑦ **★ A5 新路径键集 = `jobEventView`（15 键）**（**Zang §5.92 裁定**）：**旧路径 `/api/tasklist/:jID/verify` 的 `11 键/9 键` 冻结键集不变**，**两者不得串** ⇒ **§2 追加块 + §4.2 追加块**。
> ⑧ **A6/A11 权限点名**（**Zang §5.92**）：`/cancel` = `requireAdmin(review_tasks)`、`/api/admin/commission_policy` = `manage_settings`；**原则 = 复用既有权限键、不新造**（正文 = §1.11 Q8 / §4.2 追加块）。
> ⑨ **★ §4.8 金额来源二分 ⇒ 三分**（**Zang §5.91**）：新增第 **②** 类 **「授权主体意图额」**（客户端可传，**但必须权限校验 + 服务端上限校验（上限标 `TODO: Kevin 定值`）+ 审计留痕**）；逐事件表内 **A1 归入该②类**（§7-36 的 `待 Zang 复核` 由此收口）。
> ⑩ **§4.5 点名 C1 的派生输入 = `symbol`**（**Zang §5.93**：C1 有自然标识 ⇒ 属「可派生」侧、**与 §4.5 契约一致**；QA-B4 实测 `POST /api/currency` **不 fail-loud 而自派生 = 非缺陷**）。
> ⑪ **只追加、未重写**：**非追加改动 = 状态列 / 已注册事实的就地更新**（§1.8 表头 + 11 行「由哪一批注册」格 + §1.8 扫描口径的「53 行」+ §1.8/§9.A 标题 + §4.8 标题 + §4.8.2 A1 行归类格 + §7-29/§7-40 状态列），**逐处保留旧写法留痕**；**§4.1–§4.7 / §5 / §6 / §7-1…7-40 正文其余一字未动**；**§7 只追加 7-41/7-42 + 补注块 ⑪–⑬**；**纪律自检见 §8.11.5**。
> **状态：v1.0（已完成 · **Zang §5.95③ / §5.96④ / §5.99 / §5.101 / §5.102 / §5.103④ 折入**：★ **§4.5 幂等键硬规则**（服务端已确定性派生键的面 ⇒ 前端不得自造键）+ **D1'' 错误体口径约束**（不得依赖 DB `DETAIL`/`constraint`；API 一律用项目级 `reason`）+ **A1 后台调分落定**（有符号 `amount` / ±100000 / `requireAdmin` 先于金额校验 / `ops:` 键）+ **数值定值**（10,000 / 10,000 / 50,000 / 100,000）+ **★ `/api/prize-item` 归类更正**（**非 sunset 面**）+ **「缺表族」7 表与批 5 登记 + D1'**（非 400 驱动错误 ⇒ 归 **503**、归批 6）+ **前端接线映射表**〔新 §2.5〕+ **§1/§1.8 现取复核**〔新 §1.12〕；**本单只追加，就地更新仅 1 处（§5.1 归类格）**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.0 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.0-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = Zang §5.95 / §5.96 / §5.99 / §5.101 / §5.102 / §5.103」；**无一处与之冲突**；**唯一口径差 = `ADMIN_POINTS_ADJUST_MAX_PER_CALL` 行号现取 `:1182` vs Zang §5.97 记 `:1180`**〔§4.10 / §8.12.3-41〕）。
> **★★ v1.0 本单要点（先说结论，不含糊）**：
> ① **★ §4.5 新增硬规则（依据 = Zang §5.96④ + §5.100 逐面实测）**：**服务端已确定性派生幂等键的面，前端不得自造键**（自造键 = 新标识 = 重试/重投**落第二行**）。逐面：**发布 = 前端供 `cli:`**（服务端 fail-loud，`backend-ts/src/job-funds-service.ts:84`）；**申请 = 服务端派生**（`src/job-service.ts:180`）；**提交 = 服务端派生**（`:133`）；**接受 = 无键面**；**审核 = 事件根键派生**（`migrations/0013_job.sql:592`）；**纯读面不传键** ⇒ 正文 = **§4.5 v1.0 追加块**。
> ② **★★ D1'' 错误体口径约束（依据 = Zang §5.102）**：驱动**恒不搬运 `DETAIL`/`constraint`**（**12/12** 端到端 `409` 体带 `details.detail_unavailable='driver_did_not_carry_detail'`）⇒ **规格不得依赖 DB `DETAIL`/约束名**；**API 一律用项目级 `reason`**（机读）⇒ 正文 = **§3.5**。
> ③ **★ A1（后台调分）落定（依据 = Zang §5.101）**：`POST /api/admin/points/adjust` = **有符号 `amount`**（`> 0` ⇒ `op='mint'` + `platform=true`；`< 0` ⇒ `op='entries'` + **单腿 `kind='burn'`**）；上限 **±100000**（绝对值）；**`requireAdmin` 先于金额校验**；幂等键 = **`ops:` 系**；`uID<0` / 库无此用户 ⇒ **400 `LEDGER_RESERVED_UID`**；**注册点不变（仍 65）** ⇒ 正文 = **§4.10**。
> ④ **数值定值（依据 = Zang §5.95③ + §5.101）**：建币费 `currency_create_fee` = **10,000**、上市费 `listing_fee` = **10,000**、上市保证金 `listing_deposit` = **50,000**、**A1 上限 = 100,000**（逐条标「**Kevin 2026-09-30 定值**，起始值、可配置」）⇒ 正文 = **§4.9**（**取代** §4.4-11/12 与 §4.7.3 B10 的 `1000/1000/1000` 占位读数；**旧写法留痕**）。
> ⑤ **★ 归类更正（依据 = Zang §5.103④）**：**`GET /api/prize-item` 不是 sunset 面** —— 实测 = `listing_order` **买家轴**读口 + 退款 `order_id` 的**唯一已注册来源** ⇒ **保留 + 改语义**；正文本册凡可能被读成「弃用面」处 **就地加注 + 留痕** ⇒ 正文 = **§5.6**。
> ⑥ **「缺表族」与批 5 登记（依据 = Zang §5.99）**：代码引用而库内**不存在**的 **7 张表**（`asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer`）+ 受影响的**活路由**（`POST /api/auth/verify` 现取 **:354**、`POST /api/task-progress/claim/:jID` 现取 **:635**）；并登记 **D1'**（**非 400 驱动错误 ⇒ 应归 `503`**、归批 6）⇒ 正文 = **§4.11**。
> ⑦ **前端接线映射表（新 §2.5）**：页面 ↔ 路径 ↔ 真源行号，四条线（**招工 / 商品 / 交易所 / 我的**）；真源 = `docs/audit/p4-b4c-ii-a-jobs-profile.md`（171 行）+ `docs/audit/p4-b4c-ii-b-listings-market.md`（230 行）+ `frontend/src/pages/{jobs,listings,market}/**`。
> ⑧ **§1 端点处置表 / §1.8 状态列与注册点现取复核**：注册点 **65（不变 ✓）**；**行号已漂移**（`src/index.ts` **1575 → 1645 行**；`POST /api/job` `:1289 → :1359` …）⇒ **以现盘为准、旧读数留痕** ⇒ 正文 = **§1.12**。
> ⑨ **只追加、未重写**：**非追加改动 = 就地更新 1 处**（§5.1「商品持有读口」行的「本册最终处置」格加注归类更正，**旧文逐字保留**）；**§4.1–§4.8 / §5.1–§5.5 / §6 / §7-1…7-42 正文其余一字未动**；**§7 只追加 7-43…7-46 + 补注块 ⑭–⑯**；**纪律自检见 §8.12.5**。

> **状态：v1.1（已完成 · **Zang §5.105 / §5.106 折入**：★★ **新硬规则「登录必须验签」**（`POST /api/auth/verify` **必须**对签发时给出的**原文消息**做 **EIP-191 `personal_sign`** 恢复、与声明地址**大小写不敏感**比对 ⇒ 不匹配/签名非法 = **`401`**；**四条判据**）+ **依赖入册**（服务端新增运行依赖 **`ethers@^6.17.0`**）+ **登录端点取余额口径**（`getUserAsset ∥ emptyAsset(uID)`；`asset` 表**不存在且永不创建**）+ **收尾项登记**（两条新 `401` 文案的**四语覆盖**）+ **§9.E · E9 锚点刷新 + 新增 E10（`claim` 面 B5-2）** + **§1.12 行号现取复核（今日多次改线）+ `auth.ts` 漂移** + **不变项复核**（注册点 **65** / `410` 面 **6/6** / `Σ(cid=1)` / kind 关闭集 **20**）；**本单只追加，就地更新仅限「状态列 / 已注册事实 / 行号锚点」**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.1 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.1-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = Zang §5.105 / §5.106」；**无一处与之冲突**）。
> **★★ v1.1 本单要点（先说结论，不含糊）**：
> ① **★★ 新硬规则 = §3.6（登录必须验签）**（依据 = **Zang §5.106**；实现/取证 = `docs/audit/p5-sig-verify.md`，**164 行**）：`consumeWalletAuthChallenge`（`backend-ts/src/auth.ts:182`）**必须**用 `verifyMessage`（`:221`）对**签发时给出的那份原文**（`challengeRecord.message`，同存于 `:52` 字段 / `:156` 构造 / `:158-163` 落 Map）做 **EIP-191 `personal_sign`** 恢复，并与**声明地址**做**大小写不敏感**比对（`recoveredAddress.toLowerCase() !== challengeAddress`）⇒ 不匹配 / 签名非法一律 **`401`**（`:223` `Invalid wallet signature` / `:227` `Signature does not match the claimed address`，经既有 `src/index.ts:379` catch 出口，**零新码 / 零新 reason / 零新 kind**）。**四条判据（硬）**：真签名 `200` / 垃圾签名 `401` / 他人签名（地址不匹配）`401` / 重放（同 challenge 二次）`401`。**两层关系（写死）**：**token 层见 P4-SEC（兜底密钥已移除）· 签名层见 P5-SIG-VERIFY（本单）** —— 两层**各管一段、不得互推**。
> ② **依赖入册 = §1.13**：后端新增运行依赖 **`ethers@^6.17.0`**（`backend-ts/package.json:17`；`package-lock.json` 同批 `+98/−0`）⇒ **部署必须带 lockfile**；**注**：与「前端 Tailwind CDN」那条债务**不是同一件事**（本条为**服务端包**）。
> ③ **登录端点口径 = §3.7**（依据 = **Zang §5.105**；实现/取证 = `docs/audit/p5-fix-login.md`，**159 行**）：`POST /api/auth/verify` 的取余额步骤 = **`getUserAsset ∥ emptyAsset(uID)`**（`src/index.ts:364`）⇒ **不得回退到写 `asset` 表**（该表**不存在且永不创建**）；**无 `account` 行的新钱包 ⇒ `200` + 空态 `0`**；**`42P01` 归零**。
> ④ **收尾项登记 = §9.B · B14**：前端需为两条新 `401` 文案（`Invalid wallet signature` / `Signature does not match the claimed address`）做**四语覆盖**（`frontend/src/locales/{zh,en,hk,vn}.json`）—— **本册现取 = 前端 0 命中**（两串全文检索 = 0 行）；**HTTP 展示面 = `NOT_MEASURED`**。
> ⑤ **§9.E 门面刷新 + 新增**：**E9 的锚点就地刷新**（`src/index.ts:1197` 起 ⇒ 入参不完整分支现取 **`:1206-1208`**；**旧读数 `:1200-1202` 留痕**）+ **新增 E10**（`claim` 面 B5-2：默认退役 `410` + 前端停止调用显「已下线」，**Kevin 一句话可改**）。
> ⑥ **行号现取复核 = §1.12 v1.1 追加块**：`src/index.ts` **1645 → 1651** 行（**+6 = P5-FIX-LOGIN 的 `+7/−1`**）；**18 条端点行号整体 +6**（`POST /api/auth/verify` **仍 `:354`**、其后 17 条逐条 +6）；`src/auth.ts` **240 → 261** 行（**+21 = SIG-VERIFY `+24/−3`**）⇒ **auth.ts 侧锚点一并刷新**。
> ⑦ **不变项复核（四项，全部现取）**：注册点 **65**（`grep -cE`）/ 已落 `410` 面 **6/6**（`src/index.ts:1025/1029/1033/1037/1044/1051`）/ `Σ(cid=1)` **1,989,693** 与 `ledger_entry` **267**（**转引** `docs/audit/p5-sig-verify.md §4 ⑨`，本册未连库）/ **kind 关闭集 `20`**（`backend-ts/src/ledger.ts:153-160`）。
> ⑧ **只追加、未重写**：**非追加改动 = 行号 / 状态锚点的就地刷新**（§9.E · E9 一行）；**§1–§8 其余正文一字未动**；**§1.12 / §1.13 / §3.6 / §3.7 / §8.13 为新追加**；**§7 只追加 7-47/7-48 + 补注块 ⑰–⑲**；**纪律自检见 §8.13.5**。

> **状态：v1.2（已完成 · **「多语言用户内容（UGC）翻译线」P6-TR 已落地事实折入**：★★ **读侧载荷契约**（`*_en`/`*_hk`/`*_vn` **恒有值** + 有 ready 译文用译文否则**回落原文**、**永不空串**；新增 **`i18n_status: ready|partial|pending`**）+ **两张新表（迁移 `0021`，已 apply）**（`content_translation` / `translation_cache`，**零触发器**）+ **引擎口径**（en/vn = DeepSeek、**hk = OpenCC 确定性转换（不付费/不走 LLM）**、**`stub` 仅显式**、**缺 key 一律不翻**）+ **写入形态 B1**（前台只登记 `pending`、后台 `waitUntil` 补齐、**HTTP 响应不因翻译变慢**）+ **失败与成本策略**（`MAX_ATTEMPTS=5` / 2000 / 500）+ `POST /api/translate/backfill` + cron `0 18 * * *` + **注册点 65 ⇒ 67**；**本单只追加**（新增 §10 + §8.14；**§1–§9 既有条文一字未动**））** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.2 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.2-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标依据 = P6-TR 已落地报告 + 派单 JING-TR；**无一处与之冲突**）。
> **★★ v1.2 本单要点（先说结论，不含糊）**：
> ① **★★ 载荷契约 = §10.1**：内容面 `*_en`/`*_hk`/`*_vn` **恒有值**（有 `status='ready'` 译文用译文，否则**回落原文 zh**、**永不空串**）+ **`i18n_status ∈ {ready, partial, pending}`**（缺省 ⇒ 前端不显示「翻译中」小标）。**旧行为（缺键 ⇒ 前端拿空串）是本线消除的缺陷**；**造键点位于 mapper 层**（`backend-ts/src/database.ts:762` `applyI18n`）。
> ② **内容面 = §10.2**：`job(title,description)` / `listing(title,description)` / `users.bio` / `currency.name`；**`market_order` / `market_trade` 无用户文本**（逐键取证：非「用户录入的自然语言内容」）；**发布表单不本地化**（输入即原文）；**`bio` 编辑态持原文**（防译文写回原文）。
> ③ **两张新表 = §10.3**（迁移 `0021`，**已 apply**，**164 行 / 零触发器**）：`content_translation`（PK = 前四列 = 幂等键；★ 结构级兜底 `status='ready'` ⇒ `"text"` 非空）/ `translation_cache`（PK = 前三列，**命中即不付费**、不自动过期）。
> ④ **引擎口径 = §10.4**：en/vn = DeepSeek（OpenAI 兼容 `/chat/completions`；`response_format={"type":"json_object"}` ⇒ **提示词自带 JSON 要求**）；**hk = OpenCC 确定性简繁转换**；**`stub` 只能显式启用**；**未显式启用且缺 `DEEPSEEK_API_KEY` ⇒ 一律不翻译**（标 `pending` + `reason='NO_API_KEY'`、**不写译文 / 不写缓存** —— 防 stub 假译文污染缓存）；三重校验含**源无 CJK / 单字源豁免**。
> ⑤ **写入形态 B1 = §10.5**：5 条写路径（6 个登记点）**前台只登记 `pending`（`text=NULL`，批量 1 次 DB 往返、`ON CONFLICT`）**，后台 `waitUntil` 补齐；**HTTP 响应不得因翻译变慢**（实测引擎挂起 15s 时写响应 **1995ms / 1287ms**）；**任何翻译失败不得影响写响应状态码 / 语义**。
> ⑥ **失败与成本 = §10.6**：绝不阻塞提交；失败留空 + `status` + 后台重试；`pending`/`deferred` **不烧 attempts**（`MAX_ATTEMPTS=5`）；日限额 / 超长 ⇒ 整批 `deferred`；单条 2000 字符 / 日 500 条。
> ⑦ **端点与运维 = §10.7**：`POST /api/translate/backfill`（`CRON_SECRET` 走 Bearer 或 `x-cron-secret`；**未配 ⇒ `503` fail-loud，绝不默认放行**；`limit` 默认 20 / 上限 100；回执 `{ok,processed,ready,failed,skipped,deferred,reason}`）+ `vercel.json` cron **`0 18 * * *`**（UTC18 = 北京 02:00 = DeepSeek 低峰；Vercel **Hobby** cron 每日 1 次）；**注册点 65（v1.1 记载）⇒ 67（本册现取）**（本线 +1 = `/api/translate/backfill`；派单口径 66 → 67）。
> ⑧ **与账本无关 = §10.8**：翻译属**内容更新** ⇒ **`Δledger_entry` 恒 `0`**；迁移与写回均不碰账本。
> ⑨ **只追加、未重写**：**非追加改动 = 0 处**；**§1–§9 既有条文一字未动**；**§10（新）与 §8.14（新）同批落**；**v0.1–v1.1 快照一字未动**；**纪律自检见 §8.14.5**。
> **状态：v1.3（已完成 · **翻译线（P6-TR-1c-B / P6-TR-1c-FIX）已落地事实折入**：★★ **DEF-02 长度比阈值改「按目标语言分表」**（`en`/`vn` `[0.3, 6.0]`、**`hk` `[0.5, 2.5]` 收紧**；**旧口径 `[0.3, 3.0]` 作废** —— 旧上限使 `vn` **永远无法 `ready`**）+ **★ stub 写库守卫（结构性拒绝）**（`stub` 引擎**默认拒绝写库**；仅 `TRANSLATE_ALLOW_STUB_WRITES=1` 显式放行；未放行 ⇒ `store=null` + `store_write_blocked=true` + `store_block_reason='STUB_WRITE_BLOCKED'`）+ **`backfill` 三 mode**（`scan_translate` 缺省 / `scan` 零付费 / `translate` 旧行为；`limit` 默认 **20 ⇒ 100**、上限 100）+ **DEF-01 校验字段集口径**（完整字段集校验、只取该语言字段 ⇒ 部分缓存命中不误判 `KEY_SET_MISMATCH`）+ **缺 key 口径复核不漂移** + **模型 id `deepseek-flash` 实证** + **真引擎实测读数**（三语 + `327/581` tokens）；**本单就地订正 3 处（逐处留痕）+ 追加 §10.10–§10.14 + §8.15**；**§1–§9 既有条文一字未动**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.3 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.3-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标依据 = `docs/audit/p6-tr1c-b-real-engine.md` / `docs/audit/p6-tr1c-fix.md`；**无一处与之冲突**）。
> **★★ v1.3 本单要点（先说结论，不含糊）**：
> ① **★★ DEF-02 = §10.10**：长度比闸**按目标语言分表** —— `LENGTH_RATIO_BOUNDS`（`translate-service.ts:220-224`）：`en` `[0.3, 6.0]` / `vn` `[0.3, 6.0]` / **`hk` `[0.5, 2.5]`（同文转换 ⇒ 反而收紧）**；**旧口径（`[0.3, 3.0]` 一元闸，`LENGTH_RATIO_MIN/MAX`）作废**（句义 = 旧上限对 zh→en/vn 短文本**系统性误杀**，实测比 3.7–5.2 ⇒ `vn` 永无法 `ready`）；`LENGTH_RATIO_MIN/MAX` 旧导出名**保留但 = en 口径**（`:226-227`）。
> ② **★★ stub 写库守卫 = §10.12（本节重点）**：`stub` 引擎**默认拒绝写库**（fail-closed）；**仅 `TRANSLATE_ALLOW_STUB_WRITES=1` / `opts.allowStubWrites=true` 放行**；未放行 ⇒ `store=null`（不读缓存 / 不写 `pending` / 不落译文 / 不写缓存）+ 机读 `store_write_blocked=true` / `store_block_reason='STUB_WRITE_BLOCKED'`（`:602-614`）。**立法目的 = 把「测试用假翻译不得进真库」从调用方纪律升级为结构性拒绝**（假译文 `^\[(en|vn)\] ` 曾落真库被当 `ready` 对外提供并污染 `translation_cache`）。
> ③ **★ `backfill` 三 mode = §10.11**：`scan_translate`（**缺省**：先扫存量补 `pending` 再翻译 ⇒ **cron 自愈**）/ `scan`（只登记、**零 API 付费**）/ `translate`（旧行为）；**`limit` 默认 20 ⇒ 100、上限 100**（`src/index.ts:1747`；真闸 = `TRANSLATE_DAILY_ITEM_CAP=500`）；回执**旧键逐字保留** + 新增 `mode / scan_scanned / scan_registered / scan_existing / scan_by_entity`（`:1760-1778`）；存量扫描 = **真库推导**（`TRANSLATABLE_SPECS :1134-1139` + **单语句** `INSERT…SELECT…ON CONFLICT DO NOTHING RETURNING 1` `:1149-1173`）；**幂等实证**：候选 **276**（job 99 / listing 117 / user 21 / currency 39）⇒ 首轮 `registered=276`、二轮 `registered=0` 且零付费（`0 → 276 → 276`）。
> ④ **★ DEF-01 = §10.13**：`translateFields` 必须以**本次请求的完整字段集**调 `validateFieldSet`（`:710`），再**只取该语言需要的字段**合流 ⇒ **部分缓存命中不得误判 `KEY_SET_MISMATCH`**（旧实现逐语言用字段子集校验 ⇒ 误杀 `description.en`）。
> ⑤ **缺 key 口径复核 = §10.14①（不漂移）**：非显式 stub 且无 `DEEPSEEK_API_KEY` ⇒ **一律不翻译**（`status='pending'` + `reason='NO_API_KEY'`、**不写译文 / 不写缓存**；`:634-644`）；**「缺 key 自动回落 stub」仍属作废**（§10.4 留痕）。
> ⑥ **模型 id + 真引擎读数 = §10.14② ③**：`DEFAULT_MODEL = 'deepseek-flash'`（`:239`）**已由真调用实证可用**（`p6-tr1c-fix.md §5.2`：`engine=deepseek` / `llm_calls=1`）；CJK 源 listing ⇒ `en` `Seafood Gift Box Test C: Shrimp and Crab Duo` / `vn` `Hộp quà hải sản thử nghiệm C: Combo tôm và cua` / `hk` `海鮮禮盒測試丙：蝦蟹雙拼`；单次调用 **prompt 327 / completion 581** tokens。
> ⑦ **变更记录 = §8.15**（写盘范围 / `NOT_MEASURED` 66–70 / 自曝 70–73 / delta 对照 / 纪律自检）；**§8.14 及以前为历史留痕**。
> ⑧ **★ 文档漂移已修**：`docs/audit/route-layer-v1.2-delta.md` 与本册 §10.7 的「`limit` 默认 20」**均为旧读数** ⇒ 本版**就地订正正文**（留痕）+ **在该 v1.2 delta 件末尾追加修正条**（不改旧内容）。
> ⑨ **就地订正 3 处 + 只追加**：**非追加改动 = §10.4（② 阈值口径 + stub/缺 key 两条指针）、§10.7（端点行号 / `limit` / 回执键）**，逐处**保留旧写法留痕**；**§10.10–§10.15 与 §8.15 为新追加**；**§1–§9 既有条文一字未动**；**v0.1–v1.2 快照一字未动**；**纪律自检见 §8.15.5**。
> ⑩ **★ `i18n_status` 分母定义 = §10.15（Zang 追加口径 · 优先级高）**：**源文本为空 / 空白的字段（该语言格）不计入 `total`**；**全部可译字段源皆空 ⇒ 取真空态 `ready`**（**「不输出该键」的选项未采纳** —— §10.1 已写死该键**恒带**）；**为何** = 空源**无内容可翻**，计入分母 ⇒ 对象**永久判 `partial`** ⇒ **「翻译中」小标永挂（假信号）**。依据 = Zang 实测（`content_translation` 字段覆盖 job 60/39、listing 66/51 ⇒ 7 招工 + 5 商品描述为空；生产分布 `{ready:41, partial:14, pending:1}`），本册**转引**。

> **状态：v1.4（已完成 · **批 6（管理面治理 + 错误语义 + 前端构建期化）已落地事实折入**：★★ **权限种子 `0022` + `isAdminAddress` 单一真源收敛（★「先 apply 后部署」顺序依赖）** + **★★ 审计 `0023`（`admin_ops_audit_log` + 编排函数 `admin_points_adjust_post_event` + 日累计闸 `1,000,000/日` 标 `TODO: Kevin 定值`；只计 `result='applied'`；被拒留痕且资金零残留；`UNIQUE(idempotency_key,result)`）** + **★★ 错误语义 D1'（`code==null` ⇒ `503` + `driver_connection_error`；401 只用于凭据面且必在 DB 调用前；26 面收口；2 处「假成功」改 `throw`）** + **★ 前端实现纪律（新 §11.4）**；**本单只追加、就地更新 = 0 处（§1–§10 一字未动）**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.4 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.4-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = Zang §5.137–§5.151」；**无一处与之冲突**）。
> **★★ v1.4 本单要点（先说结论，不含糊）**：
> ① **★ 权限面 = §11.1**：迁移 `0022`（**177 行 · 纯 DML 幂等 · 已 apply**）种下 `admin_permission` **11** / `admin_role` **1** / `admin_role_permission` **11** / `admin_user_role` **1**（绑原第三真源地址持有人 uid `970213`）；`isAdminAddress` **第三真源已删**、收敛为**单一真源**（`users.is_admin` OR ∃ `admin_user_role`；三真源逐键相等 `all_three_equal=true`）；**★ 顺序依赖：必须先 apply `0022`、后部署收敛代码**（否则当场锁死运营管理员 —— 反证 uid `970213` `200→403`）。
> ② **★★ 审计与日累计 = §11.2**：迁移 `0023`（**391 行 · 已 apply**）交付表 `admin_ops_audit_log`（只增不删 + append-only 触发器）+ DB 编排函数 `admin_points_adjust_post_event(jsonb)`（**取锁 → 存在性闸 → 日累计闸 → `ledger_post_event` → 写审计行 → 回执**，**同函数同语句**）；阈值 **`1,000,000/日`**（按操作人 + 自然日 UTC，标 `TODO: Kevin 定值`）；**日累计只计 `result='applied'`**（改前口径 `3200000 > cap 1000000` 实测可刷爆）；**被拒必须留痕**（`result='rejected_daily_cap'`）且**资金零残留** ⇒ **函数不得 `RAISE`**；**`UNIQUE(idempotency_key,result)`**（幂等键不得被「拒绝」消费，三向实测）。
> ③ **★★ 错误语义 = §11.3**：**无 SQLSTATE（`code==null`）的驱动/传输错 ⇒ `503 LEDGER_TX_TIMEOUT` + `reason='driver_connection_error'`**（复用、零新码）；**401 只用于凭据面且必在 DB 调用前**（唯一处 `src/index.ts:419`）；**26 个 IO 出口统一走分类器**（含 2 处 `database.ts` 裸 catch「假成功」改 `throw`：`getUserAsset`/`getAllUsers`）；**保留 500 的 2 面**（`/api/shard*`，常量空态零 IO）；新 reason `OVER_MAX_DAILY_AMOUNT`（复用 `LD016`）。
> ④ **★ 前端实现纪律 = §11.4（新建一节）**：禁重引 Tailwind 运行期 CDN（现为构建期 v4）；兼容层手写工具类**必须进 `@layer`**；运行期拼接类名**必须进 safelist**；类名字面量在测试/探针里**必须拼接书写**；按钮口径（日档 A″ / 夜档 A′、`btna-*`/`btnalt-*`、比例 0.222/0.359、扁平化、`.sf-btn` 已纳入）。
> ⑤ **只追加、未重写**：**非追加改动 = 0 处**；**§1–§10 既有条文一字未动**；唯一新增 = 顶部 v1.4 状态块 + **§11**（新）+ **§8.16**；**v0.1–v1.3 快照一字未动**。
> ⑥ **★ 数据层同步**：`0023` 涉表 / 触发器 / 函数 / 约束 ⇒ 已在 **`docs/data-layer.spec.md` v0.9 §20** 追加式登记（同批）。
> ⑦ **纪律自检见 §8.16.5**。

> **状态：v1.5（已完成 · **§7-32「管理员退款发起」契约化（**只写契约、零代码**）**：★★ **第三个 actor 面钉成可实现契约 = §12**（actor 面 / 权限闸 / 鉴权失败面 / 审计留痕硬项 + **A·B 两变体** / 幂等 / **可证伪 AC 10 条** / 注册面两变体 / 日累计取舍 / **待 Zang 终审 Z1–Z8**）；★★ **全部前提由本册「只读取证」现取（非转引）**：`0022`/`0023` **已 apply 真值**（`schema_migration` 行 id **21**/**22**）+ `admin_permission` **11 键** + `admin_role_permission` **11** + `admin_user_role` **1 行（uid `970213` / `is_admin=false` / `super_admin`）** + `admin_ops_audit_log` **4 个 CHECK 闭集**（`action='points_adjust'` / `op IN ('mint','burn')` / `amount<>0` / `result IN ('applied','rejected_daily_cap')`）+ 编排函数**无 `RAISE`**（`position('RAISE') = 0`）+ `listing_order` **现成可退门面（`order_id=3`：`paid` / seller `7` / buyer `8` / `100×1`）** + `ledger_entry` **271 行 / `purchase_refund` 6**；**本单只追加**（**非追加改动 = 0 处** —— **既有表格 / 单元格一字未动（含 §7-32 的状态格）**；本能力的读法更新 = **追加表 + 补注块**）；新增 = 顶部 v1.5 状态块 + §7 v1.5 追加表 + **§12（新）** + §8.1 表 v1.5 行 + §8.17）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.5 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.5-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = 派单 JING-REFUND-ADMIN + Zang §5.88 ② / §5.145 ① / §5.146 ④」；**待 Zang 终审 8 条逐条编号见 §12.10**）。
> **★★ v1.5 本单要点（先说结论，不含糊）**：
> ① **★ actor 面（§12.1）**：退款合法发起人 = **卖方 ∪ 管理员**（管理员 = `can_access_admin` ∧ **`manage_points`**）；**管理员兼买方 ⇒ 禁止**（`403 AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`；依据 = Zang §5.88 ② 的立法意图「防对卖方的单向掠夺」）；**两 actor 面的差异仅准入** ⇒ 资金腿 / 幂等键 / 指纹 / 回执键集**逐字相同**。
> ② **★ 权限闸 = `manage_points`（唯一 · 逐键候选表见 §12.1.1）**：**零新造键**（11 键之内；`0022` 已 apply ⇒ 键集真值现取 = 11/11 对齐）；现取 = 该键在 `requireAdmin` 的调用面 **0 处**（**首次启用**）⇒ 采用理由 = **语义最贴（用户资产/额度治理）** + **细粒度**；**「无键」口径不采纳**（现取 `src/index.ts:299-317`：`hasRequiredPermission(actor, undefined) === true` ⇒ 无键时 `requireAdmin` 的实际闸退化为「凡 `can_access_admin` 者可动用户钱」）。**两种口径对现库唯一运营管理员（uid `970213`，`is_admin=false` + `super_admin`）**都放行**（`admin_role_permission` 现取 = 11 键全量）⇒ 选键**不影响**现账号可用性。
> ③ **★ 资金腿冻结（§12.2）**：`purchase_refund` **×2**（`0015:718-724`）· **不回滚库存**（§7-7 + `listing-funds-service.ts:55`；`0015:775-781` 只 `UPDATE public.listing_order`）· `frozen_delta = '0'` · 金额 / 卖方 / 买方 / `cid` **全部服务端取数**（`0015:711`/`:718`/`:721`/`:707`；客户端传值一律丢弃）。
> ④ **★ 审计留痕硬项 + 落点两变体（§12.4）⇒ 交 Zang 终审（本册不二选一）**：每次管理员退款**必须**留 actor 痕迹（`actor_uid` / `order_id` / `cid` / 金额 / 结果 / `txid` / 幂等键 = `biz:listing:refund:<order_id>` / 指纹）；**「零残留」= 资金零残留，不是「不得有表行」**（Zang §5.145 ① 教训逐字）。**★ 现取关键读数**：`0023:207-211` 的日累计求和**无 `action` 过滤** ⇒ 变体 A 直插 `result='applied'` 的退款审计行会被计入 A1 的「`1,000,000 点/日`」额度（**一次大额退款吃掉当日调分额度**）。
> ⑤ **★「资金与审计同一次 DB 调用」= 可达（§12.6）**，且**必须照盘上既有模式** —— 新增 `public.listing_refund_post_event(jsonb)`（与 `admin_points_adjust_post_event` **同构**：同函数内「调 `public.listing_post_event` → 写审计行 → 回执」，**不改 `listing_post_event` 函数体**）；**「路由层两段」被 `0023` 的设计取向① 逐字否决**（「**不得**写成『先调资金、再插入审计行』」）。**两变体 + 各自风险 ⇒ 交 Zang 终审（§12.6 / Z4）**。
> ⑥ **★ 幂等（§12.5）**：键 = `biz:listing:refund:<order_id>`（**服务端派生**，`0015:667`）+ 指纹 = `sha256('listing.refund' | <order_id>)`（`listing-funds-service.ts:300` 现取）⇒ **两者均与 actor 无关** ⇒ 同订单换 actor 重投 = `200` + `idempotent_replay:true` + **零 delta** + **审计行不新增**；**判负用例** = 若实现把 actor 编入键或指纹 ⇒ 同订单第二 actor 产生第二对分录（**双退向量**）。
> ⑦ **★ 注册面两变体（§12.7）**：**倾向复用同路径** `POST /api/listing-orders/:orderId/refund`（闸按 actor 分流；**注册点不变**）；**新路径**变体给代价 ⇒ 交 Zang 终审（Z6）。
> ⑧ **★ 可证伪 AC 10 条（§12.8）** + **日累计闸取舍（§12.9）：倾向「不需要」**（退款**不造币**、单笔受既有 `ledger_max_single_amount()` 与订单行约束、同订单幂等唯一 ⇒ 无「反复发起」的累计敞口）⇒ 阈值与取舍交 Zang（若采纳 ⇒ `TODO: Kevin 定值`；Z8）。
> ⑨ **只追加、未重写**：**非追加改动 = 0 处**（**§7-32 行一字未动** —— 本单对该能力的读法更新**全部**由 **§7 v1.5 追加表（§7-49 / §7-50 / §7-51）+ 补注块 ⑳** 承载；`git diff --numstat` 删除列 = **0**，见 §8.17.5）；**§1–§11 既有条文一字未动**；**§12（新）+ §7 v1.5 追加表 + §8.1 表 v1.5 行 + §8.17（新）**；**v0.1–v1.4 十四个快照一字未动**；**纪律自检见 §8.17.5**。

> **状态：v1.6（已完成 · **Zang 对 §12「管理员退款发起」Z1–Z8 的终审逐字落位（**只追加 · 零代码 · 零迁移 · 库面只读**）**：★★ **Z1 = 权限键 `manage_points`（终审定 · 零新造键 · 后端路由闸面首次启用）**；★★ **Z2 = 变体 B（新建审计表 `admin_refund_audit_log`）** —— 依据（`0023` 源码亲证，逐字）= ① `0023:86` `CHECK (action = 'points_adjust')` 是**单值**约束；② 🔴 **`0023:207-212` 的日累计求和**无 `action` 过滤** ⇒ 退款审计行会**静默计入 A1 的 1,000,000 点/日额度**（跨特性静默污染）；③ 复用须 `CREATE OR REPLACE` 改**已 apply** 的 `admin_points_adjust_post_event` 函数体 ⇒ **作废 `0023` 质检的字节级锚**；④ 该表列语义属**调分中心**（`op IN ('mint','burn')` / 单一 `target_uid` + `balance_before/after`）⇒ 退款（seller + buyer + `order_id`，既非 mint 亦非 burn）塞入必被**信息压缩**；★ **Z2b = N/A（未选变体 A）** + 登记（将来选 A 的前提四条 + 「不改已 apply 函数体」的替代路径要求）；★ **Z3 = 留痕（`result = 'rejected_state'`）+ 三条附加**（函数不得 `RAISE` / 同键重投 `ON CONFLICT (idempotency_key, result) DO NOTHING` / 行放大风险面有界）；★ **Z4 = 新增编排函数 `public.listing_refund_post_event(jsonb)`（新迁移 `0024`，同构 `admin_points_adjust_post_event`）· ★硬约束 = 必须复用既有资金路径（同一语句内调既有 `listing_post_event(op='refund')`）· 严禁复制退款资金腿**；★ **Z4b = 不取 `pg_advisory_xact_lock`**（以**实测兼现**补偿，见 Z8）；★ **Z5 = 闸前拒绝（401/403）不留痕**（依据 = `0023:215-228` 的拒绝留痕发生在函数体内 + 本仓不落 access log 为既有事实）；★ **Z6 = 复用同路径 `POST /api/listing-orders/:orderId/refund`（闸按 actor 分流 · 注册点 68 不变 · 前端零改动）· actor 分流顺序写死（admin 权限闸 → 卖方闸 → 403）+ 给判负用例**；★ **Z8 = 不需要日累计闸**（退款**不造币**；单笔受订单行约束、同订单幂等唯一 ⇒ 无累计敞口）· **以实测补偿 = 并发两笔同订单 ⇒ 恰一次生效（另一笔 `409 / LEDGER_CURRENCY_INVALID_TRANSITION`）+ 资金腿恰一次**（写成可证伪 AC，含判负自证要求 = §12.11.6 · AC-11）。**本单只追加**：**非追加改动 = 0 处**（**判据 = `git diff --numstat` 删除列 = 0**；§12 的 Z1–Z8 落位 = **就地加注**（插在对应小节末，**原地正文一字未动**）+ **§12.11（新）**；**§7-32 状态格与 §12 既有表格 / 单元格一字未动**）；新增 = 顶部 v1.6 状态块 + **§12.1.1 / §12.3 / §12.4 / §12.6 / §12.7 / §12.9 六处 v1.6 就地加注** + **§12.11（新）** + **§7 v1.6 追加表（7-52…7-56）** + §8.1 表 v1.6 行 + **§8.18（新）**） · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.6 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.6-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang 终审的逐字落位**，**未改写任何裁定、未发明任何规格值**；**需补细节处一律先只读取证同族对象照抄**，**确实无先例者**列 **§12.11.5 待 Zang 确认（3 条 · 带两变体 + 代价 + 倾向）**）。
> **★★ v1.6 本单要点（先说结论，不含糊）**：
> ① **★ Z1（权限键 · §12.1.1 就地加注 + §12.11.1）**：闸 = `requireAdmin(req, res, 'manage_points')`（**终审定**）。依据：`manage_points` 是 `0022` 十一键之一；前后端真源已齐（`backend-ts/src/database.ts:19` 键表 / `:3854` 首页分流 / `frontend/src/admin-utils.js:48` / `components/layout/AdminLayout.jsx:80` / `App.jsx:242` 已是 `/dashboard/points` 路由权限）；**零新造键**；**后端路由闸面首次启用**。**附加**：**不动 A1 既有的「无键 `requireAdmin`」面**；「**A1 无键面与新契约不一致**」⇒ **登记为下一轮 spec 收口项（§7-52）**，**本批不扩面**。
> ② **★★ Z2（审计落点 = 变体 B · §12.4 就地加注 + §12.11.2）**：**新建表 `public.admin_refund_audit_log`**。四条依据逐字（见状态行）；**表的契约**（列**按退款语义、不压缩**）= `actor_uid / order_id / seller_uid / buyer_uid / cid / amount / result / txid / idempotency_key / request_fingerprint / memo / time_created`（**列类型与约束命名风格照抄 `0023` 的 `admin_ops_audit_log`**·**先只读取证再照抄**）+ **只增不删 + append-only 触发器**（手法同 `referral` / `market_trade`；**诚实边界同 `DL65`**：拦不住 `TRUNCATE` 与 `DISABLE TRIGGER USER`，是**护栏非铁律**）+ **`UNIQUE (idempotency_key, result)`**（沿用「幂等键不得被拒绝消费」裁定）+ **`result` 闭集 = `{'applied','rejected_state'}`** + **任何求和 / 额度判据只计 `result='applied'`**（写成纪律，即便本批无闸）。**登记**：**审计面分裂（两张审计表）** ⇒ **P6 审计台立项时定**是否合并为通用表 / 视图，**本批不扩面（§7-53）**。
> ③ **★ Z2b = N/A（未选变体 A）（§7-54）**：登记 —— 将来若有人选 A，**必须先解决上述四条**，且须给出「**不改已 apply 函数体**」的替代路径。
> ④ **★ Z3（留痕 · §12.4 就地加注 + §12.11.2/§12.11.6）**：被拒尝试 `result = 'rejected_state'`；**附加三条** = ① **函数不得 `RAISE`**（异常会把同一函数内已写的审计行一并回滚）⇒ **返回拒绝回执、由路由映射 409**；② 同键重投 `ON CONFLICT (idempotency_key, result) DO NOTHING` ⇒ **不放大**；③ 行放大风险面**有界**（路径在权限闸之后）。
> ⑤ **★★ Z4（编排函数 · §12.6 就地加注 + §12.11.3）**：新增 **`public.listing_refund_post_event(jsonb)`**（**新迁移 `0024`**，同构 `admin_points_adjust_post_event`）。**★ 硬约束（防双真源）**：该函数**必须复用既有资金路径**（**同一语句内**调用既有 `listing_post_event(op='refund')`），**严禁复制退款资金腿**（`purchase_refund` ×2 / 金额服务端取数 / 不回滚库存全在 `0015` 里；**复制 = 造第二套真相**）；审计行 `INSERT` 必须与该资金调用**同函数、同一次 DB 调用**。
> ⑥ **★ Z4b（§12.6 就地加注）**：**不取 `pg_advisory_xact_lock`**（本批无日累计闸 ⇒ 无跨行读-改-写聚合；同订单串行性由**既有状态机守卫**承担 ⇒ **以实测兼现**，见 Z8 · AC-11）。
> ⑦ **★ Z5（§12.3 就地加注 + §7-55）**：**闸前拒绝（401/403）不留痕**（闸在编排之前；`0023` 的拒绝留痕发生在函数体内）；登记「**本仓不落 access log**」为既有事实；将来若要留痕须另立规范。
> ⑧ **★ Z6（§12.7 就地加注 + §12.11.4）**：**复用同路径** `POST /api/listing-orders/:orderId/refund`（闸按 actor 分流；**注册点 68 不变**；前端零改动；无双入口风险）。**必须写死 actor 分流顺序**：先判 admin 权限闸（`manage_points`）→ 否则卖方闸 → 否则 **403**；并给**判负用例**（§12.11.6 · AC-13）。
> ⑨ **★ Z8（§12.9 就地加注 + §12.11.6）**：**不需要日累计闸**（退款**不造币**；单笔受订单行约束、同订单幂等唯一 ⇒ 无累计敞口）。**以实测补偿**：**并发两笔同订单退款 ⇒ 恰一次生效**（另一笔 **409 / `LEDGER_CURRENCY_INVALID_TRANSITION`**）+ 资金腿恰一次 ⇒ **写成可证伪 AC（含判负自证要求）**（AC-11）。
> ⑩ **★ 另四条硬约束同步落位（§12.11.4 / §12.11.6）**：① **可退门面现值 = `listing_order` 唯一现成可退行 `order_id 3`**（seller 7 / buyer 8 / `100×1` / `paid`）⇒ **E2E 优先用它**；**不得为测试修改真库既有行**；**自建夹具 uid ≥ 900000**；② **错误码闭集 33 不动**（409/404 全部复用既有码 + 项目级 `details.reason`；**不得依赖 DB 的 `DETAIL`**）；③ `REFUND_ACTOR_IS_SELLER_ONLY`（`src/listing-funds-service.ts:62`）单点须**随本单从「仅卖方」升级为「卖方 ∨ 管理员」** —— 口径从单点常量**升级为权限闸驱动的 actor 分流**，**不得让常量与权限闸并存成为第二真源**；④ 迁移 `0024` 自带 **apply-time 自检**（列集 / 约束 / 触发器启用态 / 键集），失败整体回滚（沿用 `DL48`）。
> ⑪ **只追加、未重写**：**非追加改动 = 0 处**（**§7-32 状态格一字未动**（读法同 v1.5 补注块 ⑳）；**§12 既有正文 / 表格 / 单元格一字未动** —— Z1–Z8 落位**全部**由**新增加注行 + §12.11** 承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.18.5）；**v0.1–v1.5 十五个快照一字未动**；**纪律自检见 §8.18.5**。

> **状态：v1.7（已完成 · **§12.11.5 三条待确认（T-1 / T-2 / T-3）的终审逐字落位 + 四条附加硬约束（禁 `WHEN OTHERS` / 注入 `53300`·`XX000` 判负 / 拒收回执与审计行一起提交 / 对外不新增顶层键）逐字入 spec**（**只追加 · 零代码 · 零迁移 · 库面只读**））** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.7 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.7-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **§12.11.5 三条待确认 + 四条附加硬约束的逐字落位**，**未改写任何裁定、未发明任何规格值**；**需补细节处一律先只读取证同族对象照抄**；**确实无先例者**列 **§12.12.7**）。
> **★★ v1.7 本单要点（先说结论，不含糊）**：
> ① **★ T-1 = 变体①（§12.11.2 加注 + §12.12.1）**：**审计表保留 `log_id` 身份证 PK**（照抄 `0023:65`）⇒ 表 = **12 语义列 + 1 结构列（共 13 列）**。依据（含 Zang 认账）= **「12 列」指语义列、不含 PK 结构列** ⇒ 与「列按退款语义、不压缩」**不矛盾**；与既有 `admin_ops_audit_log` **同构** ⇒ 将来审计台可统一处理；append-only 触发器手法可**直接照抄**（`COALESCE(OLD.log_id,0)` 变体**无须**）。
> ② **★★ T-2 = 变体①（§12.11.3 加注 + §12.12.2）**：捕获机制 = **`BEGIN … EXCEPTION WHEN SQLSTATE 'LD011' THEN … END`**（现成先例 `0008:87/98/103`；另 `0004:1048` / `0005:1318`）⇒ 写 `result='rejected_state'` 审计行 ⇒ 返回拒收回执（**路由映射 409**）。**变体②（编排函数内预读 `listing_order.status` 复制状态守卫）予以否决** —— 它造**第二真源**，直接违反 Z4。
> ③ **★★ 附加硬约束①（白名单式捕获 · 逐字）**：**只捕「明确列举」的状态机拒绝码**（`order_not_refundable` ⇒ `LD011`；**`order_pay_missing` 若同码则按 `reason` 区分** ⇒ 本册现取 = **确系同码**）；**严禁 `WHEN OTHERS`** —— 理由逐字：**否则基础设施错误（`53300` / `XX000` 一类）会被吞成「被拒」**，正是本仓 **D-04 / 真库「假成功」**那类真缺陷。**依据锚点（现取）**：`53300` ⇒ `src/ledger-errors.ts:338`（`INFRA_SQLSTATE_REASONS`）⇒ 归 **`LEDGER_TX_TIMEOUT`（503）**；`XX*` 在 `:331-333` 的**同集同码**桶 ⇒ 亦 **503**。**必须配可证伪判负用例 = §12.12.6 · AC-14**（注入 `53300` / `XX000` ⇒ `result` **不得**为 `rejected_state`、**必须向上抛 ⇒ 503**）。
> ④ **★★ 附加硬约束②（§12.11.3 加注 + §12.12.3）**：捕获后**同一函数内**写审计行 + 返回回执 ⇒ **拒收回执与审计行一起提交**；**资金腿因子事务回滚而「不留分录」**（**零资金残留**）。
> ⑤ **★ 附加硬约束③（§12.11.3 加注 + §12.12.3）**：**子事务回滚不得波及其他已写对象** ⇒ 审计行 `INSERT` **必须**落在 `EXCEPTION` 处理器内（失败子事务**之外**）。
> ⑥ **★ T-3 = 变体①（§12.11.4/§12.11.5 加注 + §12.12.4）**：**404 不留痕**；**射程写死** = **留痕面仅「已进入资金编排且被状态机拒绝（409）」**；**不留痕面 = 401/403（权限闸前）+ 404（存在性前置闸）+ 400（形状 / 参数非法）**（**与 Z5 同源**）；**H6 的「已经进入资金编排」读作「函数体内、资金腿之前的状态机拒绝」**。
> ⑦ **★ 回执键集裁定（§12.11.3/§12.11.4 加注 + §12.12.5）**：① 编排函数**内部**回执**必须**含 `result`（`applied` 或 `rejected_state`）/ `txid`（**拒绝时 `null`**）/ `audit_logged`；② **对外一律走既有 `sendSuccess` / `ledgerErrorBody` 口径、不得新增对外顶层键**（**除既有 `extra` 机制**）；③ **与 F10 的 `23 键` 关系 = 两层**（内部编排回执 vs 对外路由回执）⇒ **禁止把 23 键回执原样透传给前端**。
> ⑧ **★ AC-11 的判负自证 —— 已在位（§12.11.6 加注）**：现取行号 = **`0015:670`**（`SELECT * INTO v_order FROM public.listing_order o WHERE o.order_id = v_order_id FOR UPDATE;`）+ **`0015:677-678`**（只读根键探测 `SELECT 1 INTO v_seen … WHERE e.event_root_key = v_key LIMIT 1;` / `v_replay := FOUND;`）⇒ **判负可构造 = 移除该 `FOR UPDATE` ⇒ 并发两笔必得 +4（双重退款）**。**本单只补出处行号现取、未改该行一字**。
> ⑨ **只追加、未重写**：**非追加改动 = 0 处**（**§12.11.2–§12.11.6 既有表格 / 单元格与 §12.11.5 三行待确认表一字未动** —— 终审落位**全部**由**新增加注行 + §12.12** 承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.19.5）；**v0.1–v1.6 十六个快照一字未动**；**纪律自检见 §8.19.5**。

> **状态：v1.8（已完成 · **批 7-A 四条事实 / 纪律回写（**只追加 · 零代码 · 零迁移 · 库面只读**）**：★★ **注册点 65 → 68 全量回写**（真源 = 本册现取 `grep -cE`；独立质检亲数 **68 = get 27 / post 38 / put 0 / patch 1 / delete 2**）+ **★ 新纪律「脚本类硬门口径」**（`npx tsc --noEmit` **不覆盖** `scripts/**`）+ **两条前端纪律 / 登记**（错误文案必须过 `apiErrorMessage`〔**已立为可判负的门**〕/ 两套取数入口并存 ⇒ P6/P7 合并待办）+ **★ 错误形状口径（R107 · 同一端点 400 类只许一种形状）**；**承载 = §1.14（注册点回写）+ §13 / §14 / §15（三项纪律与口径）**）** · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.8 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.8-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单逐处标「依据 = Zang §5.162 A·R-3① / C / D」；**无一处与之冲突**；**未发明任何规格值**）。
> **★★ v1.8 本单要点（先说结论，不含糊）**：
> ① **★★ 注册点 65 → 68 全量回写（正文 = 新 §1.14）**：`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` **本册现取 = 68**（`wc -l backend-ts/src/index.ts` = **1981**）；质检方给出的九处应改行号（**v1.7 时点 :419 / :544 / :593 / :623 / :483 / :524 / :539 / :765 / :770**）**本册逐处独立现取复核、逐处相符（不转抄）**；其中 **:765 / :770（§4 表）** 旧写「`/api/user/ledger` = **未注册**（65 行路径表内 0 命中）」⇒ **v1.8 读数 = 已注册（`src/index.ts:633`）**（**T2 复取 = `:656`**；两次现取注册点**均 = 68** —— 见 §1.14 计数真源表后注）；**:544 / :593（不变项复核 · 注册点 65）** ⇒ **v1.8 读数 = 68** 并**旧写法就地留痕**（形如「（v1.8：批 7-A 已注册 ⇒ 65→68）」）；**另新增三条消费点行**：`ProfilePage.jsx`（**全流水**）/ `market/MarketPage.jsx` 的「账本流水」面板（`data-sf-m="mkt-ledger"`）/ **碎片口径** `?kind=transfer`；并注明 **`ShardPage.jsx:303` 已不存在**（现为 **17–19 行薄壳 `export default MarketPage`**）—— **旧行号 = 转抄错误**。
> ② **★★ 新纪律：脚本类硬门口径（正文 = 新 §13）**：**`npx tsc --noEmit` 不覆盖 `scripts/**`**（`backend-ts/tsconfig.json` 的 `include` **只有** `src/**/*`）⇒ **新增 / 改动脚本必须过 `npx tsc -p tsconfig.scripts.json --noEmit`，且要求「新增零错」**（**而非全量零错**）；**存量债 = 22 文件 / 77 条**（本册现取）⇒ **逐条登记为既有债、本批不修**；**★ 旧读数作废声明（必写 · 逐字）**：**此前所有「`tsc` 0」读数对脚本改动无效**。
> ③ **★ 两条前端纪律 / 登记（正文 = 新 §14）**：**(a)** 「**错误文案必须过全站统一链路 `apiErrorMessage`**」—— 真源 `frontend/src/auth.js:177-187`（`error.i18n_key` → i18n → `auth.err.REQUEST_FAILED` 四语兜底）；**已立为可判负的门**：`frontend/scripts/p7a-03-errmessage-gate.mjs`（类级扫描 + **基线 3 条存量登记** + **仓外镜像判负**）；**(b)** 「**两套取数入口并存**」（`fetchApiJson` 要丢顶层 `next_before_txid` ⇒ 账本读口另立 `frontend/src/ledger-api.js`）⇒ 登记为 **P6/P7 统一时合并**的待办（**路径②已终审选定；路径①改全站共用件被否决**）。
> ④ **★ 错误形状口径（承接 L7④ · 正文 = 新 §15）**：**同一端点内 400 类必须只有一种形状（R107）**；**形状非法 ⇒ 400 + 既有码 + `details.field` / `details.reason`**（依 **Zang §5.16 裁定**）；**旧 `sendError` 形态 `{success:false,message,error}` 判为非 R107**。同族面清单以同批 Kong 收口五报告 `docs/audit/p7-a-ledger-read-fix2.md` 为准（**转引，本单不复算**）；**该件开工时尚未落盘 ⇒ 清单 = `NOT_MEASURED`**（§15.2 + §8.20.2）。
> ⑤ **只追加、未重写**：**非追加改动 = 0 处**（**九处应改行号一律「不改字、只追加承载」** —— 「就地加注」与「删除列 = 0」在同一行内冲突 ⇒ **取机器判据优先**（读法同 v1.5 补注块 ⑳ / v1.7 补注块 ㉓）；**旧写法逐字引在 §1.14 表内 ⇒ 旧写法留痕成立、v1.7 正文一字未删**）；`git diff --numstat docs/route-layer.spec.md` **删除列 = 0**（见 §8.20.5）；**v0.1–v1.7 十七个快照一字未动**；**纪律自检见 §8.20.5**。


> **状态：v1.9（已完成 · **两批落地事实与 Zang 终审回写（**只追加 · 零代码 · 零迁移 · 库面只读**）**：★★ **§12.3 G2 就地订正**（**本仓自身发现的真矛盾** —— 同一输入「非卖方非 admin」，G2 旧写 `reason='NOT_ADMIN'` vs §12.11.6 AC-13④ / §12.12 写 `ACTOR_NOT_ALLOWED`；**Zang 终审：以 AC-13（可证伪验收表）为准** —— 非卖方非 admin ⇒ `ACTOR_NOT_ALLOWED`；admin 但缺 `manage_points` ⇒ `PERMISSION_NOT_GRANTED`；**`NOT_ADMIN` 不在本路由使用**（属既有 admin 面）；**不可达分支已删除**〔本仓禁死代码〕；**旧写法逐字留痕**）＋ ★★ **AC-11 判负口径改可复现三条**（原判负「移除 `0015:670` 的 `FOR UPDATE` ⇒ 必得 `Δpurchase_refund=+4`」**需第二个库 / 需改已应用迁移 ⇒ 结构性不可行** ⇒ 改为：① **源码级** `position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0`；② **竞争实测** 两会话同订单并发 ⇒ 受害者阻塞时长 > 0；③ **正向** 并发两笔同订单 ⇒ 恰一次生效〔另一笔 `409 LEDGER_CURRENCY_INVALID_TRANSITION`〕+ 资金腿恰一次 + 审计行恰 1 行；**`+4` 判负登记归 P8 前可选**）＋ ★ **回退护栏（`ledger.err.*`）纪律 + 132 键登记**（错误文案链：`t(i18n_key)` **未命中〔回裸键形态〕⇒ 落四语通用兜底**；**用户可见文案不得出现 `x.y.z` 类裸键**；真源 = `frontend/src/auth.js`；可判负门 = `frontend/scripts/p7b-errfallback-gate.mjs`；**132 键〔33 码 × 4 语〕逐码本地化 = 产品/文案决策 ⇒ 登记 P6/P7 待定**；护栏让位语义写死）＋ ★ **同族 `sendError` 26 处登记**（**转引** `docs/audit/p7-a-ledger-read-fix2.md`；**全部属既有面、本批只登记不修**；**点名** `/api/admin/points/adjust` 的 message 为**硬编码中文「参数不完整」**、**非 R107 形状**；**行号以该报告现取 `:1482`（注册行 `:1472`）为准**〔先前引的 `:1477` 系早期 artifact 行号，已作废〕）＋ ★ **迁移 `0024`（`admin_refund_audit_log` + `listing_refund_post_event`）已 apply 事实**（`schema_version=0024`、checksum `b2495845…`、`post_event_functions` **5→6**、触发器 **44→45**、`Σbalance(cid=1)` **零位移**；**注册点仍 68**；**前端零改动**）。**本单只追加**：**非追加改动 = 0 处**（判据 = `git diff --numstat docs/route-layer.spec.md` 删除列 = 0）；**§12.3 / §12.11.6 / §15.2 三处就地加注**（**原地正文一字未动**）+ **§12.13 / §14.3 / §15.4（新）** + **§8.1 表 v1.9 行** + **§8.21（新）**） · 作者角色 = **Jing（Specifier · 制度员）**
> **v1.9 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v1.9-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang 终审 + 两批落地事实的逐字回写**，**未改写任何裁定、未发明任何规格值**；**确实无先例者**列 **§8.21.2**）。
> **★★ v1.9 本单要点（先说结论，不含糊）**：
> ① **★★ §12.3 G2 就地订正（Zang 终审 · 以 AC-13 为准 · 就地点 §12.3 v1.9 加注）**：**G2 旧写法作废** —— 非卖方非 admin ⇒ **`ACTOR_NOT_ALLOWED`**；admin 缺 `manage_points` ⇒ **`PERMISSION_NOT_GRANTED`**；**`NOT_ADMIN` 不在本路由使用**；**AC-13⑥ 不可达分支已删除**；**`reason` 闭集仍 3 值、不新增**；**G2 / AC-13⑥ 表体一字未动、旧写法逐字引在加注内**。
> ② **★★ AC-11 判负改可复现三条（就地点 §12.11.6 v1.9 加注）**：**原「`+4` 判负」结构性不可行**（需第二个库 + 需改已应用迁移）⇒ **源码级 `position('FOR UPDATE' …)` + 竞争实测〔阻塞时长 > 0〕+ 正向〔恰一次生效〕**；**`+4` 判负登记归 P8 前可选**；**原判负行保留不删**。
> ③ **★ 回退护栏纪律 + 132 键登记（正文 = §14.3〔新〕）**：**错误文案链 `t()` 未命中 ⇒ 四语通用兜底、用户可见文案不得出现裸键**；真源 = `frontend/src/auth.js`；可判负门 = `frontend/scripts/p7b-errfallback-gate.mjs`（转引 PASS 读数）；**132 键〔33 码 × 4 语〕逐码本地化 = 产品/文案决策 ⇒ 登记 P6/P7 待定**；**护栏让位语义写死**（locale 补 `ledger.err.<CODE>` 后 `t()` 命中即用真文案、无需改代码）。
> ④ **★ 同族 `sendError` 26 处登记 + `:1482` 勘误（正文 = §15.4〔新〕+ §15.2 加注）**：**转引** `docs/audit/p7-a-ledger-read-fix2.md §5`（**本册不复算、不转抄 26 行**）；**全部属既有面、只登记不修**；**点名** `POST /api/admin/points/adjust`（注册行 `:1472`）在 **`:1482`** 抛硬编码中文「参数不完整」、**非 R107**；**`:1477` 作废**。
> ⑤ **★ 迁移 `0024` 已 apply 事实（正文 = §12.13〔新〕）**：**`schema_version=0024` / checksum `b2495845…` / 表 `admin_refund_audit_log` 在场 / 函数 `listing_refund_post_event` 在场〔`post_event_functions` 5→6〕/ 触发器 44→45 / `Σbalance(cid=1)` 零位移 / 注册点 68 / 前端零改动**；**实现面其余项落地与否 = `NOT_MEASURED`**。
> ⑥ **只追加、未重写**：**非追加改动 = 0 处**（**§12.3 / §12.11.6 / §15.2 的正文与表格 / 单元格一字未动** —— 订正与更新**全部**由**新增加注行 + 新小节**承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.21.5）；**v0.1–v1.8 十八个快照一字未动**；**纪律自检见 §8.21.5**。

> **状态：v2.0（已完成 · **两条小订正 + 一条确认 —— Zang 自我更正 + 载体定层 + 措辞确认（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP**）**：★★ **AC-11 期望订正**（**Zang 自我更正 · 派单 ①**）—— 并发两笔同订单退款的「**另一笔**」**原写 `409 LEDGER_CURRENCY_INVALID_TRANSITION` 作废**；**正确期望 = `200` + `idempotent_replay:true`（且 `txid` 与首笔逐字相同）**（真因 = **退款幂等键由 `order_id` 派生** ⇒ 两笔同订单**必同键** ⇒ 第二笔是**幂等重放**；**比 `409` 更好**：不报错、不双扣）；**保留**「**资金腿恰一次**」+「**审计行恰 1 行**」两条判据；**实测佐证（本册现取 · 转引）** = `backend-ts/.p7b-artifacts/p7b-07-ac11-collect1.json`：`criterion_iii_concurrent = { a:{result:"applied", idempotent_replay:false, txid:"341"}, b:{result:"applied", idempotent_replay:true, txid:"341"} }` + `deltas = { purchase_refund:2, audit_applied:1, audit_rejected:0, sum_cid1_shift:"0" }`；**旧写法逐字留痕** ＋ ★★ **「同键异内容 ⇒ 409」的载体定层**（**派单 ②**）—— **正式载体 = DB 层**（实测 `backend-ts/.p7b-artifacts/p7b-08-e2e-http-collect1.json` 的 `item8_same_key_diff_content_db` ⇒ `LD003` / `LEDGER_IDEMPOTENCY_CONFLICT`）；**HTTP 面 = `NOT_APPLICABLE`**（键与指纹**同由 `order_id` 派生** ⇒ 同键异内容**构造不出**）；**旧写法留痕** ＋ ★ **AC-13⑥ 措辞确认**（**派单 ③**）—— **确认正确**：**路由分支已删除**（本仓禁死代码）**且** **`NOT_ADMIN` 常量仍保留**（属**既有 admin 面**的 `reason`、**不在本路由使用**）。**本单只追加**：**非追加改动 = 0 处**（判据 = `git diff --numstat docs/route-layer.spec.md` 删除列 = 0）；**§12.5 / §12.11.6 两处就地加注**（**原地正文一字未动**）+ **§8.1 表 v2.0 行** + **§8.22（新）**） · 作者角色 = **Jing（Specifier · 制度员）**
> **v2.0 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.0-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang 自我更正 + 载体定层 + 措辞确认的逐字落位**，**未改写任何裁定、未发明任何规格值**；**确实无先例者**列 **§8.22.2 / §8.22.3**）。
> **★★ v2.0 本单要点（先说结论，不含糊）**：
> ① **★★ AC-11 期望订正（Zang 自我更正 · 就地点 §12.11.6 v2.0 加注）**：**「另一笔 `409` `LEDGER_CURRENCY_INVALID_TRANSITION`」作废** ⇒ **正确期望 = 另一笔 `200` + `idempotent_replay:true`（`txid` 与首笔逐字相同）**；**保留**「资金腿恰一次（`Δpurchase_refund` 恰 `+2`，**不是 +4**）」+「审计行恰 1 行」两条；**旧写法逐字引在加注内 ⇒ 留痕成立、AC-11 表体一字未动**。
> ② **★★ 「同键异内容 ⇒ `409`」载体定层（就地点 §12.5 v2.0 加注）**：**正式载体 = DB 层**（实测 `LD003` `LEDGER_IDEMPOTENCY_CONFLICT`；构造入参 `request_fingerprint = 'p7b:DIFFERENT-FP'`，同键）；**HTTP 面 = `NOT_APPLICABLE`**（**结构性不可达**，原因 = 键与指纹**同源派生**）；**旧写法留痕**。
> ③ **★ AC-13⑥ 措辞确认（承 §12.3 / §12.11.6 v1.9 加注）**：**确认正确** —— 「**路由分支已删除**（本仓禁死代码）」与「**`NOT_ADMIN` 常量保留供既有 admin 面**」**= 两句并列、不矛盾**（前者删的是**本退款路由内**的不可达死分支；后者保的是 `src/index.ts:254` 的 **`AUTH_REASONS` 常量**本身）。
> ④ **只追加、未重写**：**非追加改动 = 0 处**（**§12.5 / §12.11.6 的正文与表格 / 单元格一字未动** —— 订正与定层**全部**由**新增加注行 + 新小节**承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.22.5）；**v0.1–v1.9 十九个快照一字未动**；**纪律自检见 §8.22.5**。

> **状态：v2.1（已完成 · **R107 `message` 字段语义写死 + 存量偏离登记 + 前端错误文案链四跳 / 机读码判据 / 33 码已本地化回写（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**）**：★★ **R107 `message` 语义写死**（**正文 = §3.3 v2.1 就地加注〔条款 9′〕+ §15.5**）—— `code` = **机读唯一真源**；`i18n_key` = **本地化真源**（形如 `ledger.err.<CODE>`）；**`message` = 人类可读的稳定英文句（供日志 / 调试 / 非本地化客户端）**，**严禁填机读码** ＋ ★★ **存量偏离清单（登记 · 技术债 · 分批实现 · 非阻塞）**（**正文 = §15.5**：`fail(...)` 第 4 参缺省回退 `message || code`（**7 处回退位**）/ `fromLedgerError` 以 `message = mapped.code`（**4 处 · 8 赋值点**）/ `sendAuthError` 以 `message = code`（`index.ts:256-263`）/ `sendError` 同族旧形状（**26 处实调用** · 转引 `docs/audit/p7-a-ledger-read-fix2.md §5` 逐条判定表）；**已测面 = 前端护栏已把「机读码当文案」抑制 ⇒ 用户可见面已干净**；**服务端改写属契约卫生、可分批量**）＋ ★★ **前端错误文案链四跳 + 机读码判据 + 33 码已本地化**（**正文 = §14.3 v2.1 就地加注 + §16**：候选链 ① `t(i18n_key)` → ② 服务端原文 → ③ 四语通用兜底 → ④ ASCII；**② 的 `message` 与 `details.reason` 命中「全大写下划线机读码」⇒ 视为不可用**〔批 7-C / 批 7-D〕；**33 码闭集逐码本地化 `ledger.err.<CODE>`、四语键集相等、每语 33 键 / `flat = 737`**）＋ ★ **正向约束（类级可判负门）**：**新增错误面不得把码塞进 `message`**（正文 = §15.6）。**本单只追加**：**非追加改动 = 0 处**（判据 = `git diff --numstat docs/route-layer.spec.md` 删除列 = 0）；**§3.3 / §14.3 两处就地加注**（**原地正文一字未动**）+ **§15.4 v2.1 加注 + §15.5 / §15.6 / §16（新）** + **§8.1 表 v2.1 行** + **§8.23（新）**） · 作者角色 = **Jing（Specifier · 制度员）**
> **v2.1 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.1-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang §5.171 C「批 7-E 降级为规范澄清」的逐字落位 + 批 7-C / 7-D 成果回写**，**未改写任何裁定、未发明任何规格值**；**确实无先例者**列 **§8.23.2**）。
> **★★ v2.1 本单要点（先说结论，不含糊）**：
> ① **★★ R107 `message` 语义写死（就地点 §3.3 v2.1 加注〔条款 9′〕+ 正文 §15.5）**：`{error:{code,message,i18n_key,details}}` 中 —— **`code` = 机读唯一真源**（`LEDGER_*` **33 码闭集** / `AUTH_*` 域，闭集**不增不减**）；**`i18n_key` = 本地化真源**（`ledger.err.<CODE>` / `auth.err.<CODE>`）；**`message` 必须是人类可读的稳定英文句**（供日志 / 调试 / 非本地化客户端），**严禁填入机读码**。
> ② **★★ 存量偏离清单（正文 = §15.5）**：`fail(status, code, details, message?)` 第 4 参缺省回退（`message: message || code`，**现取 7 处回退位**）/ `fromLedgerError` 以 `message = mapped.code`（**现取 4 处 · 8 赋值点**，**F-1 真体来源**）/ `sendAuthError` 以 `message = code`（`index.ts:256-263`，**3 个调用点**）/ `sendError` 同族（**26 处**，**转引** `docs/audit/p7-a-ledger-read-fix2.md §5`）—— **全部属既有面（非本册所增）**，**登记为技术债、分批实现、非阻塞**。
> ③ **★★ 前端错误文案链四跳（正文 = §14.3 v2.1 加注 + §16）**：候选链 = **① `t(i18n_key)` → ② 服务端原文 → ③ 四语通用兜底（`auth.err.REQUEST_FAILED`）→ ④ ASCII（`Request failed (status)`）**；**② 的 `message` 与 `details.reason` 命中「全大写下划线机读码」⇒ 视为不可用**（`MACHINE_CODE_TOKEN_RE` · 批 7-C / 批 7-D R1′）；**33 码闭集已逐码本地化**（`ledger.err.<CODE>` · **四语键集相等** · 每语 **33** 键 / `flat = 737`；门读数 `p7b` 「**需护栏 132 → 0 / 已本地化 0 → 132**」）。
> ④ **★ 正向约束（正文 = §15.6）**：**新增错误面不得把码塞进 `message`** ⇒ 由类级门 `frontend/scripts/p7c-errmsg-machinecode-gate.mjs`（G 段）+ `frontend/scripts/p7a-03-errmessage-gate.mjs` 判负（**可作为后继可判负的类级门**）。
> ⑤ **只追加、未重写**：**非追加改动 = 0 处**（**§3.3 / §14.3 / §15.4 的正文与表格 / 单元格一字未动** —— 加注与更新**全部**由**新增加注行 + 新小节**承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.23.5）；**v0.1–v2.0 二十个快照一字未动**；**纪律自检见 §8.23.5**。

> **状态：v2.2（已完成 · **批 8 首轮契约冻结（服务切片 8①：`app_config` 管理 + 合法键清单 + 写入门禁）**：★★ **权限映射表（先现取逐字十一键，再给「本片/后续片所需权限 → 既有键」映射）** + ★★ **写口准入（`GET`/`POST /api/admin/settings` 现取 + `AR1`–`AR4`）** + ★★ **载体键名约定（保证金金额键 · 与数据层现取风格一致）** + ★★ **审计台并联对账（`R-8-3`：并联读取 + 统一呈现 + `txid` 对账判据；`§7-53` 的兑现）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-1**
> **v2.2 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.2-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **`R-8-1` / `R-8-3` / `R-8-4` / `R-8-5` 的逐字落位**，**未改写任何裁定、未发明任何规格值**；**确实无先例者**列 **§8.24.3 / §8.24.4**）。**★ 姊妹册（同批交付）**：`docs/data-layer.spec.md` **v0.10 §21**（`app_config` 合法键清单 + 写入门禁），**本册不重抄其条文、只指路**。
> **★★ v2.2 本单要点（先说结论，不含糊）**：
> ① **★ 权限映射表（`R-8-1`）**：**先现取逐字十一键**（真源 A = `database.ts:11-23` ↔ 真源 B = `0022:50-61` ↔ 真源 C = `frontend/src/admin-utils.js:40-52`）⇒ **本片 8① = `manage_settings`（唯一）**；**8 ⑦ 审计读口 = 「无 ⇒ 停报」**（11 键内**无**「只读审计」语义的键 ⇒ **严禁硬造** ⇒ **§7-62**）；**8 ④⑤ = 临时复用 `review_tasks`、须 Zang 一句话确认**（**§7-63**）。**正文 = §17.2**。
> ② **★ 写口准入（现取）**：`GET /api/admin/settings`（`index.ts:1125`，闸 = `:1126`）/ `POST /api/admin/settings`（`:1142`，闸 = `:1143` + `ops:` 键 `:1147`）；**现取 = 整块 `system_settings` 单键 upsert、未知键被静默吸收**（`database.ts:2880-2888`）⇒ 门禁四条硬规则（**未知键 ⇒ 拒 / 越权面 ⇒ 拒 / 类型不符 ⇒ 拒 / 不得静默放行**）= **姊妹册 §21.2 的 `AG1`–`AG4`**。**正文 = §17.3**。
> ③ **★ 载体键名约定（`R-8-5`）**：保证金金额**载体 = `app_config` 合法键**（**不新增列 / 不改已 apply 迁移**）；**名称风格从现取唯一先例 `system_settings` 反推**（顶层 `snake_case` / `value` = jsonb object / 字段 `camelCase` / 词根取自既有域词）；**键名与数值待 Zang / Kevin**（候选 = `listing_deposit_policy`，**候选、不构成裁定**；**该候选未入册 ⇒ 现在写入必被拒**）。**正文 = §17.4**。
> ④ **★ 审计台并联对账（`R-8-3`）**：**以 `ledger_entry` 为主轴左联 `0023`/`0024` 两表只读**（**不合并表、不迁移**）；**统一呈现**（行形状统一 + 来源表作可见列 + 拒绝行可见）；**判据 = 每条 admin 动作必须能锚到 `ledger_entry.txid`**（**只对 `result='applied'` 行生效**；**拒绝行 `txid = NULL` 为显式豁免**，写死防假红）。**正文 = §17.5 + 7-62 + 补注块 ㉛**（`§7-53` 的兑现）。
> ⑤ **只追加、未重写**：**非追加改动 = 0 处**（**`§7-1…7-61` / `§7-16` / `§7-23` / `§7-53` / `§1`–`§16` 一字未动** —— 全部落位由**新增节 §17 + 追加行 + 补注块**承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.24.5）；**v0.1–v2.1 二十一个快照一字未动**；**纪律自检见 §8.24.5**。

> **状态：v2.3（已完成 · **批 8 首轮冻结「补正单」：`R-8-7` / `R-8-8` / `R-8-9` 落位 + 勘误块（`D-1`）+ 新纪律「引用纪律」+ `AG1`/`AG3` 借码映射入册**：★★ **三条裁定落位（§18.2–§18.4）** + ★★ **勘误块（§18.5：三处 `§12.1.1:3042` 错引锚 —— 逐字给错引位置 / 错因 / 正确锚与逐字原文）** + ★★ **「引用纪律」（§18.6 · 可判负）** + ★★ **借码映射（§18.7：`AG1`/`AG3` = 借 `LEDGER_AMOUNT_INVALID`(400)；驳回 `LEDGER_UNKNOWN_KIND`；闭集 33 不动）** + ★★ **切片编号对齐（§18.8：以 Zang §5.179 C 定稿为准 = 8①..8⑥）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-1R**
> **v2.3 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.3-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang §5.180 C 的三条裁定 `R-8-7` / `R-8-8` / `R-8-9`** 与 **独立质检单 `docs/qa/p8-spec-v22-v010-review.md` 的 `D-1` / `O-3` / `D-2` / `D-3` / `D-4`** 的**逐字落位与登记**；**未改写任何裁定、未发明任何规格值**）。**★ 姊妹册（同批交付）**：`docs/data-layer.spec.md` **v0.11 §22**（`AG1`/`AG3` 借码映射 + `R-8-9` 命名批准与入册时机），**本册不重抄其条文、只指路**。
> **★★ v2.3 本单要点（先说结论，不含糊）**：
> ① **★ `R-8-7` 落位（8 ⑦ 审计台读口权限键 = 复用 `manage_points`）**：审计台内容 = **积分调账审计（`0023`）+ 退款审计（`0024`）** = 该键的**动作面**；「**能调账者才看调账审计**」= **最小权限一致**；**`read_users` 标【已排除】**（**理由**：读人域与资金审计面不符）；**独立「只读审计」键 ⇒ 跨批登记**（新键须 **4 处同批改** ⇒ 本批不可行）。**收口 `§7-62`**（**行体一字未动** ⇒ 补注块 ㉝）。**正文 = §18.2 + 新增 7-65**。
> ② **★ `R-8-8` 落位（8 ④⑤ = 确认临时复用 `review_tasks`）**：**已落位者补一句** —— 「**若 ⑤ takedown 后续成独立动作面 ⇒ 再报 Zang 裁**」。**收口 `§7-63`**（**行体一字未动** ⇒ 补注块 ㉞）。**正文 = §18.3 + 新增 7-66**。
> ③ **★ `R-8-9` 落位（键名批准 = `listing_deposit_policy`）**：顶层 `snake_case` / `value` = jsonb object / 字段 `camelCase`（**风格同 `system_settings`**）；**由本册在 8③ 冻结时正式入 `AK1` 清单**；**★ 8①/8② 实现单不得先行写入该键**；**数值仍待 Kevin**（实现期兜底常量标 `TODO: Kevin 定值`；**下限校验机制先落地**）。**★ 本单只声明「批准与入册时机」，不得把该键当成已入册**（现取合法键清单仍 = **恰 1 键 `system_settings`** ⇒ **现在写入仍必被拒 = `AG1` 正面用例不变**）。**收口 `§7-64`**（**行体一字未动** ⇒ 补注块 ㉟）。**正文 = §18.4 + 新增 7-67**。
> ④ **★ 勘误块（`D-1`：三处引 `§12.1.1:3042`）**：**现取** —— **`:3042` 是空行**；`§12.1.1` 节头 = **`:3080`**；「4 处同批改」的真实内容在 **`:3096`**（原文是 **①②③④ 枚举**，**无**「新权限键须 4 处同批改」这一句）。**逐字给出三处错引位置 / 错因 / 正确锚与逐字原文；原行一字未改**（删除列 = 0）。**正文 = §18.5**。
> ⑤ **★ 新纪律「引用纪律」（本册已犯一次 = `D-1`）**：**权威册中凡「`文件:行` / 引文」必须现取且逐字**；**空行 / 不存在行 / 非逐字引文 = 缺陷**；**可判负形态写死**（抽全部 `文件:行` 引用逐条现取 ⇒ 该行必须非空；引号内文本必须与真源逐字相等 —— **任一失败即判负**）。**正文 = §18.6 + 新增 7-68**。
> ⑥ **★ 借码映射入册（`AG1` / `AG3`）**：**报错码 = 借 `LEDGER_AMOUNT_INVALID`（`400`）**（**授权 = `ledger.spec` §14.3 明载其为「参数形状非法」借用码**）；`details.reason` = **稳定常量**（未知键 = `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` + `details.unknown_keys` 逐键）；**驳回 `LEDGER_UNKNOWN_KIND`**（其语义 = **账务 kind 闭集**，与 `app_config` 键面无关）；**不得新增码（闭集 33 不动）**。**正文 = §18.7**（姊妹册 `data-layer.spec` **v0.11 §22** 同批入册）。
> ⑦ **只追加、未重写**：**非追加改动 = 0 处**（**`§7-1…7-64` / `§17` / `§1`–`§16` 一字未动** —— 全部落位由**追加行（7-65…7-68）+ 补注块 ㉝–㉟ + 新增节 §18 + §8.25** 承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.25.6）；**v0.1–v2.2 二十二个快照一字未动**；**纪律自检见 §8.25.5**。


> **状态：v2.4（已完成 · **批 8 第 2 片（8②）契约冻结：费率配置 + 返佣权重矩阵（**合片**）—— 读写口契约 + 新增 admin 读口注册点登记 + 权限键映射 + 「真生效」四段判据 + 后台页数据契约与四语文案面 + `R-8-14` 基线声明**：★★ **读写口契约（§19.2：写口现取 + **读口现取 = 无 ⇒ 本单冻结新增 `GET /api/admin/commission_policy`、注册点 68 → 69**）** + ★★ **权限键映射（§19.3：现取逐字十一键 ⇒ 写口 / 读口 / 两页 = `manage_settings`，零新增键）** + ★★ **「真生效」四段判据（§19.4：①后台写→②库内落值→③业务读口取数→④行为随之；每段判负）** + ★★ **后台页数据契约 + 四语文案面（§19.5：禁工程口径泄漏六类 + 正则判负）** + ★★ **`R-8-14` 基线声明（§19.6：`§18.5` 行锚 = v2.2 基线 / 4030 行；现行行号已漂）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-2**
> **v2.4 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.4-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang 已裁 `R-8-1` / `R-8-6` / 「真生效」判据（P6 的 AC 原文）/ `R-8-14`** 的**逐字落位与登记**；**未改写任何裁定、未发明任何费率数值 / 权重数值 / 四语文案值 / 日期**）。**★ 姊妹册（同批）**：`docs/data-layer.spec.md` = **本单判「无须动」**（**不升 v0.12、不建快照、不建 delta**；理由逐字见本单 delta 件 §D7）。
> **★★ v2.4 本单要点（先说结论，不含糊）**：
> ① **★ 读写口契约（正文 = §19.2）**：**写口现取** = `POST /api/admin/commission_policy`（`index.ts:1999`）、闸 = `:2000` `requireAdmin(req, res, 'manage_settings')`、**真写库点** = `src/commission.ts:240` `insertCommissionPolicy`（`:247` 单条 `INSERT INTO commission_policy … WHERE NOT EXISTS(…)` = **CR8 INSERT-only / 永不 `UPDATE`**）、**`ops:` 幂等键现取 = 无**（该端点**未调** `resolveAdminOpsKey`；与同族 `POST /api/admin/settings`（`:1161`）**不一致** ⇒ **登记缺口 `§7-69`**）。**读口现取 = 无**（全仓**无** `GET /api/admin/commission_policy`；`src/commission.ts:201` 的 `getCommissionPolicy` **只被模块内部消费**（`:615`）⇒ **本单冻结新增 admin 读口**：`GET /api/admin/commission_policy`（**同路径同族先例** = `GET|POST /api/admin/settings`）、**闸 = `manage_settings`**、**注册点 68 → 69（逐字登记，`§7-70`）**。**★ 为何属功能需求而非为验收凑数（逐字）**：`R-8-6` 只禁「**为验收新增路由**」；运营后台**展示矩阵与现行费率**必须有读口 ⇒ 属**产品功能需求**，与「验收用 DB 直造 + 读库」**两条线不得混同**（§19.2(e) 给**双向判负**）。
> ② **★ 权限键映射（正文 = §19.3）**：先**现取逐字十一键**（`backend-ts/src/database.ts:11-23` ↔ `backend-ts/migrations/0022_admin_permission_seed.sql:50-61` ↔ `frontend/src/admin-utils.js:40-52`），再给映射 —— **写口 = `manage_settings`（现取 `index.ts:2000`，与 §17.2(b) 的 8 ② 行一致）**、**新增读口 = `manage_settings`**、**两页 = `manage_settings` + `dashboard_access`**。**`R-8-1` 履约 = 零新增键 / 零删除键**（11 键闭集逐字不动）。
> ③ **★ 「真生效」四段判据入册（正文 = §19.4）**：每项配置给**四段可判负读数** —— **① 后台写 → ② 库内落值（给表 / 列）→ ③ 业务读口取数（给 `文件:行`）→ ④ 行为随之（改动前 / 改动后两读数）**；**每段必须能判负**（改开关 / 改值 ⇒ 读数必变）。**不得只验「后台能存」**（「`POST` 返回 200」= 零证据）。逐项 = **`fee_rate_bp`**（⇒ 下一笔结算 `job_fee` 金额随之变）/ **`weights_bp`**（⇒ `commission` 各层分配额 `x_L` 随之变，且 `Σx_L == fee` 与 `-2` 池守恒仍绿）。
> ④ **★ 后台页数据契约与四语文案面（正文 = §19.5 + `§7-71`）**：费率页 / 权重矩阵页的**字段 = 现取 `CommissionPolicy` 8 键**（`src/commission.ts:122-131`）；**四语文案必须走 i18n**（`frontend/src/locales/{zh,en,hk,vn}.json`，四语命名空间清单逐字相同；命名空间承既有 `admin*` 先例）⇒ **禁工程口径泄漏六类**（`§章节号` / HTTP 状态码 / 接口路径 / 内部批次名与单号 / 机读码与裸 i18n 键 / 表名列名函数名），**判负 = 四语键值正则扫描 + 负对照**。
> ⑤ **★ `R-8-14` 基线声明（正文 = §19.6 + 补注块 ㊱）**：`§18.5` 的三处行锚 + 「现取命令」`sed -n '3042p'` **全部只属 `v2.2` 基线（`docs/versions/route-layer.spec.v2.2.md`，4030 行）** ⇒ **补版本基线声明 + 逐条 `v2.2 → v2.3` 漂移对照表**（`7-63` 行 `:1798 → :1810`（+12）；节头 `:3080 → :3136`；内容行 `:3096 → :3152`；闭集注 `:3922 → :3978`；§17.8 末行 `:4030 → :4086`（+56）；`grep -n '§12.1.1:3042'` 现取 = `1810` / `3978` / `4086`）；**旧文一字未改**（勘误式追加，守「删除列 = 0」）；**★ 漂移不均匀 ⇒ 不得按统一 `+Δ` 推算**。
> ⑥ **只追加、未重写**：**非追加改动 = 0 处**（**`§7-1…7-68` / `§17` / `§18` / `§1`–`§16` 一字未动** —— 全部落位由**追加行（7-69…7-71）+ 补注块 ㊱ + 新增节 §19 + §8.26** 承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.26.6）；**v0.1–v2.3 二十三个快照一字未动**；**纪律自检见 §8.26.5**。

> **状态：v2.5（已完成 · **批 8 第 3 片（8③）契约冻结：上市保证金「可配置 + 退市退还」**：★★ **载体键入册（`AK2` = `listing_deposit_policy` · 键行正文 = 姊妹册 `data-layer.spec` v0.12 §23.1）** + ★★ **下限校验机制（机制已在代码面落地；**数值待 Kevin** ⇒ 兜底常量标 `TODO: Kevin 定值`；**客户端永不决定金额**）** + ★★ **权限键映射（现取逐字十一键 ⇒ 写口 = `manage_settings`；退市账务面 = **无 ⇒ 停报**）** + ★★ **「真生效」四段判据（§20.4：①改键→②库内落值→③业务读口取数→④行为随之；**每段自带判负**）** + ★★ **退市退还 ↔ 既有 `hold_release` 路径（§20.5：逐字引五处现取真源 + **口径冲突登记** = `DL67`/`DL88`「不可退」↔ `R-8-2`「退市退还」**须 Zang 一句话收口**）** + ★★ **`hold_forfeit` 禁线（`R-8-2`：严禁实现 / 严禁复活已删名；`DL91` 未启用、无可罚没标的物；**判负三条含射程声明**）** + ★ **注册点 69 → 69（本片零新增对外路径）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-3**
> **v2.5 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.5-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang 已裁 `R-8-2` / `R-8-1` / `R-8-5` / `R-8-9`** 与 **P6 的「真生效」AC 原文** 的**逐字落位与登记**；**未改写任何裁定、未发明任何规格值 / 数值 / 路径 / 权限键**）。**★ 姊妹册（同批交付）**：`docs/data-layer.spec.md` **v0.12 §23**（`AK2` 入册 + 入册前写入必被拒的可判负形 + 新键的 `AG1`–`AG4` 适配 + 下限机制），**本册不重抄其条文、只指路**。
> **★★ v2.5 本单要点（先说结论，不含糊）**：
> ① **★ 载体键入册（正文 = §20 + 姊妹册 v0.12 §23.1）**：**`listing_deposit_policy` 正式入 `AK1` 清单**（清单现取 = 恰 1 键 `system_settings` ⇒ **入册后 = 恰 2 键**）；**键行六栏（键名 / 值类型 / 容器形态 / 语义 / 许可写入方 / 是否参与资金与计费）= 姊妹册 §23.1 逐字给出**；**本册只给「读写口 + 权限键 + 判据 + 退还对应关系」**。**★ 入册前写入必被拒**（现取代码面判据 = `database.ts:775` 未知键分支 + `:47` `APP_CONFIG_LEGAL_KEYS` ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason='SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'` + `details.unknown_keys`）。
> ② **★ 下限校验机制（正文 = §20.7）**：机制**已在代码面**（`currency-service.ts:155` `resolveServerAmount` + `:165-172` 的 `BELOW_SERVER_FLOOR`）⇒ 本片只需把 `floor` 的**来源**改为「**先读 `AK2` 键 · 读不到 / 非法 ⇒ 回落常量**」（**fail-closed 到常量**）；**数值 = 待 Kevin**（**本单不写任何数值**）；**客户端永不决定金额**（判负三条）。
> ③ **★ 权限键映射（正文 = §20.3）**：先**现取逐字十一键**（`database.ts:11-23` ↔ `0022:50-61` ↔ `frontend/src/admin-utils.js:40-52`，**本单三档亲读**），再映射 —— **写口 = `manage_settings`**（现取 `index.ts:1158`）；**退市退还（账务面）= 无 ⇒ 停报**（现取**无退市路由**）；**`R-8-1` 履约 = 零新增键 / 零删除键**。
> ④ **★ 「真生效」四段判据（正文 = §20.4）**：**① 改键（后台写）→ ② 库内落值（表 `public.app_config` / 列 `key`=`'listing_deposit_policy'` / `value` / `updated_by` / `time_updated`）→ ③ 业务读口取数（`currency-service.ts:350`，给 `文件:行`）→ ④ 行为随之（`currency.deposit_amount` + `ledger_entry` 两腿 `listing_deposit` 的**改动前 / 改动后两读数**）**；**每段自带判负**；**不得只验「后台能存」**（**「`POST` 返回 200」= 零证据**）。
> ⑤ **★ 退市退还 ↔ 既有 `hold_release` 路径（正文 = §20.5）**：**既有路径逐字真源五处** = `ledger.ts:1394`（`unfreeze` ⇒ `op: 'hold_release'` @ `:1399`）/ `0020:381-382`（**同账户两腿** `frozen −amount` / `balance +amount`，**恰 = 冻结口径 `frozen → balance`**）/ `0020:573`（同账户恰 2 腿守卫）/ `ledger.ts:203`（`hold_release` **四态全可**，含 `delisted`）/ `0016:670`+`:674`（撤单同族先例）。**⇒ 对应关系**：**退还金额真源 = `currency.deposit_amount`；退还 ≠ 重算**（配置键只决定上市时金额）。**★ 口径冲突登记（诚实登记）**：`DL67`（**v0.11 基线 `:459`** ⇒ **本版现取 `:460`**）/ `DL88`（**v0.11 基线 `:535`** ⇒ **本版现取 `:536`**）**已冻结**「**保证金不退 / 不得提供退还接口**」↔ **`R-8-2` 的「退市退还」** ⇒ **字面互斥**；**本单不择一**（`DL67`/`DL88` 行体一字未动），**登记 `§7-73` 请 Zang 一句话收口**；收口前**实现方不得实现退还路径**；**双向判负**（据 `DL88` 拒绝实现 = 判负；据 `R-8-2` 改写 `DL67`/`DL88` 行体 = 判负）。
> ⑥ **★ `hold_forfeit` 禁线（正文 = §20.5(c)）**：**严禁实现 `hold_forfeit`、严禁复活任何已删名**（真源 = `DL91`（**v0.11 基线 `:538`** ⇒ **本版现取 `:539`**）「**不预先启用**」+ `ledger.ts:149-150`「`listing_deposit_forfeit`：P1c 新裁定删」+ `DL67`/`DL88`「无罚没」）；**判负三条**（本片新增件出现 `hold_forfeit` / 退还额被配置键二次改写 / 退还走非 `hold_release` 的组合）+ **射程声明**（既有在册件里的 `hold_forfeit` 字面**不在射程**、**不得**去删改 —— `migrations/**` 已 apply 禁改）。
> ⑦ **★ 注册点 69 → 69（写死）**：**本片零新增对外路径**（写口复用 `POST /api/admin/settings`；**读口判「不新增」**；**退市触发口 = 现取无 ⇒ 停报，不得自造路由**）。**★ 现取基线 = 69**（v2.4 记载 **68** ⇒ **差 +1 = 8② 的读口 `GET /api/admin/commission_policy`（`:2036`）已落盘**）；**若退市入口经 Zang 裁定确需新增 ⇒ 登记 69 → N**（`§7-73` + §20.9 `I-4`）。
> ⑧ **只追加、未重写**：**非追加改动 = 0 处**（**`§7-1…7-71` / `§17` / `§18` / `§19` / `§1`–`§16` 一字未动** —— 全部落位由**追加行（7-72…7-74）+ 补注块 ㊲ + 新增节 §20 + §8.27** 承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.27.6）；**v0.1–v2.4 二十四个快照一字未动**；**纪律自检见 §8.27.5**。
> **★ 行数口径（本单起写死 · 见 §20 节首判明）**：本册 `wc -l` = **换行符数**（末行 `---` **不带换行** ⇒ v2.4 = **4589**），**逻辑行数 = `wc -l` + 1 = 4590**；**凡报行数必须注明用的是哪一种**。

> **状态：v2.6（已完成 · **批 8 第 3 片下半（8③b）契约冻结：`app_config` **键级寻址线格式** + HTTP 写面（闭合 `R-8-19`「在册 ≠ 可写」）+ ★★ **`R-8-17` 更正块**（`§20.5` 退市退还部分标「作废（由 `R-8-17` 更正）」+ 更正 `R-8-2` 表述）**：★★ **键级寻址线格式（键面正文 = 姊妹册 `data-layer.spec` v0.13 §24；本册只给 route 侧三件）** + ★★ **`AK1`/`AK2` 校验叠加与错误形状（§21.2 · R107 一致 · 零新增码 / 零新增 `reason` 常量）** + ★★ **`ops:` 幂等键按 target key 派生（§21.3 · 闭合 `O-3` · 四条可判负形）** + ★★ **写面真生效四段判据（§21.4 · ④ 读数口径按 `R-8-17` 订正为「消耗额」）** + ★★ **★ 更正块（§21.5）**（`R-8-17` 射程收缩：8③ = 仅 (a) 金额可配置；**(b) 退市退还正式作废**；`DL67`/`DL88`/`R31` 逐字引为依据）；**注册点 69 → 69**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-3B**
> **v2.6 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.6-delta.md`（**同批姊妹册** = `docs/audit/data-layer-v0.13-delta.md`）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **`R-8-19` / `R-8-17`** 的**逐字落位与登记**；**未改写任何裁定、未发明任何规格值 / 数值 / 路径 / 权限键**）。
> **★★ v2.6 本单要点（先说结论，不含糊）**：
> ① **★ 键级寻址线格式冻结 =「单键 · 显式信封」**（**键面正文 = 姊妹册 `data-layer.spec` v0.13 §24.1**）：请求体两形态 —— **形态 A**（既有裸值对象；隐含目标键 = `system_settings`；**逐字兼容**）+ **形态 B**（新；`{"key": "<合法键名>", "value": {…}}`；判别 = 请求体含自有属性 `key`）；**多键明确不采纳**；本册侧只给三件（写口复用 / 请求体判别锚 / 读面不新增），见 §21.1。
> ② **★ `ops:` 幂等键按 target key 派生（§21.3 · 闭合 `O-3`）**：`ops:<admin_uid>:setting:<目标键名>` —— 形态 A ⇒ `system_settings`（**键形逐字不变**）；形态 B ⇒ 请求体 `key` 值（**必先过顶层键白名单**）；**四条判负 + 两条正面判据**。**`O-3` 的行体一字未动**（其「待办登记」自此兑现）；`§7-72` 随之收口（§7 v2.6 追加表 + 补注块 ㊳）。
> ③ **★★ 更正块（`R-8-17` · 本册 §21.5）**：**`§20.5` 的「退市退还」部分标「作废（由 `R-8-17` 更正）」**（**§20.5 正文一字未动**）+ **更正 `R-8-2` 的 (b) 项表述**；**逐字引 `DL67` / `DL88` / `R31`（+ 三条同族补强）为依据**；**`R-8-2` 的「严禁 `hold_forfeit` / 严禁复活已删名」半句仍然有效**（**不在作废射程**）。
> ④ **注册点 69 → 69（写死）**：**本片零新增对外路径**（写口复用 `POST /api/admin/settings`；读口判「不新增」）；**`§7-73` 的(一)项（退市触发面缺失）随 `R-8-17` 一并 moot**（下架无账务动作 ⇒ **无需 `delist` 路由**）。
> **★ 行数口径（承 v2.5 · 写死）**：本册 `wc -l` = **换行符数**（末行 `---` **不带换行** ⇒ v2.5 = **4868**；本版开工时同值），**逻辑行数 = `wc -l` + 1 = 4869**；**凡报行数必须注明用的是哪一种**。**★ 追加手法（写死）**：本册末行无换行符 ⇒ **一切追加一律插在末行 `---` 之前**（否则该行由「无换行」改写为「带换行」⇒ `git diff --numstat` 必记 1 个删除行，违「删除列 = 0」硬口径）。
> **状态：v2.7（已完成 · **批 8 第 4 片（8④）契约冻结：自建单位审核闸** —— 读写口契约 + 注册点登记（`review_tasks`）+ 真生效四段判据 + 后台页数据契约与四语文案面**：★★ **审核面读写口契约（§22.2：读口现取 = 无 ⇒ 本单冻结新增 `GET /api/admin/currency`、**注册点 69 → 70**；动作口 = **依变体（姊妹册 §25.3）· 本单只登记候选不自选**〔`POST /api/admin/currency/:cid/review` ⇒ 69 → 71〕）** + ★★ **权限键 `review_tasks`（§22.3 · `R-8-8` 现取逐字十一键 + 消费面 5 处）** + ★★ **「真生效」四段判据（§22.4：①后台审→②库内落值→③业务读口取数→④行为随之；每段自带判负；不得只验「后台能存」）** + ★★ **后台页数据契约 + 四语文案面（§22.5：`adminCurrencyReview` 命名空间 + 禁工程口径泄漏六类 + 正则判负）** + ★★ **★ 现取冲突登记（§22.1(d)：`currency_status_log` 「零写入」与现取 2 命中冲突 ⇒ 现取为准；详见姊妹册 §25.2）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-4**
> **状态：v2.8（已完成 · **批 8 第 4 片（8④）**裁定落册**：取变体 Ⅱ（旁路台账型）—— 动作口 / 读口契约冻结 + 注册点登记 + 真生效四段 + 权限键 `review_tasks` + 后台页数据契约**：★★ **裁定落位（§23.1：`R-8-21` 取变体 Ⅱ ⇒ `§22.2(a2)` 的「动作口依变体 · 只登记候选」收口 = **动作口存在**，路径 = `POST /api/admin/currency/:cid/review`）** + ★★ **读口契约（§23.2：`GET /api/admin/currency`，闸 `review_tasks`，**注册点 69 → 70**）** + ★★ **动作口契约（§23.3：`action ∈ {approve, reject}` + `reason`；`ops:<admin_uid>:currency_review:<cid>`；R107；**非法入参 ≥6 条判负 + 通过/驳回各自判负〔含「驳回必须落台账」〕**；**注册点 69 → 71**）** + ★★ **「真生效」四段判据（§23.5 · 按变体 Ⅱ 细化 · 含「审核动作成功而台账无行 ⇒ 判负」与反向 · 事务内 + `ROLLBACK` 取证按 `R-8-15`/`R-8-18`）** + ★★ **权限键 `review_tasks`（§23.6 · 11 键零增删 · 消费面 5 处）** + ★★ **后台页数据契约（§23.7 · `adminCurrencyReview` + 禁工程口径泄漏六类）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-4R**
> **v2.8 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.8-delta.md`（**同批姊妹册** = `docs/audit/data-layer-v0.15-delta.md`）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 `R-8-21` 的**逐字落位与登记**；**未改写任何裁定、未发明任何规格值 / 数值 / 路径 / 权限键** —— 表名 / 列 / 类型 / 约束 / 索引**逐项溯源自 `0023`/`0024`/`0017`**，正文 = 姊妹册 `data-layer.spec` v0.15 §26.7）。
> **★★ v2.8 本单要点（先说结论，不含糊）**：① **★ 裁定落位 = 变体 Ⅱ**（§23.1 · `R-8-21` 四条理由逐字见姊妹册 §26.1）；**Ⅰ / Ⅲ 不采纳**（判负口径写死）；② **★ 动作口自此确定**（§23.3 · 收口 `§22.2(a2)` 的「依变体 · 不择一」）；③ **★ 注册点 69 → 70（读口）+ → 71（动作口）逐字登记**（§23.4）；④ **★ 真生效四段按 Ⅱ 细化**（§23.5 · ② 段含台账行 + `currency.status` + `currency_status_log`）；⑤ **权限键 = `review_tasks`**（§23.6 · 零新增键）；⑥ **后台页 = `adminCurrencyReview`**（§23.7 · 六类禁项 + 正则判负 + 负对照）。

> **状态：v2.9（已完成 · **批 8 第 5 片（8⑤）契约冻结：合规审核（商品 / 招工）** —— 两路径读写口契约 + 注册点登记 + 权限键 `review_tasks` + 真生效四段 + 审计面并联对账 + 后台页数据契约**：★★ **两路径读写口契约（§24.2：路径 A 商品 `takedown` —— 读口 `GET /api/admin/listing` + 动作口 `POST /api/admin/listing/:listingId/takedown`；路径 B 招工仲裁 —— 族名逐字 `/api/admin/arbitration/*`，子路径 = 候选人）** + ★★ **注册点逐字登记（§24.4：现取 71 ⇒ 应然 71 → 75；依变体可减至 74）** + ★★ **权限键映射（§24.5：现取逐字 11 键 ⇒ 四口两页全落 `review_tasks`；★ `R-8-8` 附带条件「takedown 独立动作面」触发 ⇒ 报 Zang 裁）** + ★★ **「真生效」四段判据（§24.6：①后台审→②库内落值→③业务读口取数→④行为随之；未审商品不可购买 / 未审招工不可承接；每段自带判负）** + ★★ **审计面并联对账（§24.7：`R-8-3`；每条 admin 动作锚 `ledger_entry.txid`；拒绝行 `txid=NULL` 显式豁免；商品无分录豁免）** + ★★ **后台页数据契约 + 四语文案面（§24.8：`adminListingReview` + `adminArbitrationReview` + 六类禁项 + 正则判负）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-5**
> **v2.9 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.9-delta.md`（**同批姊妹册** = `docs/audit/data-layer-v0.16-delta.md`）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 `R-8-1` / `R-8-3` / `R-8-8` / `R-8-15` / `R-8-18` 的**逐字落位与登记**；**未改写任何裁定、未发明任何状态值 / 路径 / 权限键 / 决定字段名 / 表名 / 数值 / 日期**）。
> **★★ v2.9 本单要点（先说结论，不含糊）**：① **两路径 = 三册「待定义」（`takedown` 逐字待定义 / `arbitration` 仅族名）**（§24.1；原文 = 姊妹册 §27.1）；② **读写口契约（§24.2）**：读口 ×2 + 动作口 ×2，全闸 `review_tasks`；商品 `ops:<admin_uid>:listing_takedown:<listingId>` / 招工 `ops:<admin_uid>:job_arbitrate:<job_id>`（**既有逐字**）；③ **注册点 71 → 75（依变体可减）逐字登记**（§24.4）；④ **权限键 = `review_tasks`（11 键零增删）**（§24.5）；⑤ **真生效四段**（§24.6）；⑥ **审计面并联对账 + 拒行豁免**（§24.7）；⑦ **后台页 `adminListingReview` / `adminArbitrationReview`**（§24.8）。

> **状态：v2.10（已完成 · **批 8 第 5 片（8⑤）**裁定落册**：取**变体 Ⅱ（旁路台账 + 既有状态边）** —— 4 路由读写口契约 + 注册点 `71 → 75` 逐字登记 + **归属闸契约形态**（雇主本人 或 持键）+ 真生效四段判据（按 Ⅱ 细化）+ 审计面并联对账 + 后台页数据契约**：★★ **五条裁定 `R-8-23`..`R-8-27` 逐字入册**（§25.1）** + ★★ **4 路由读写口契约（§25.2：商品 读口 `GET /api/admin/listing` + 动作口 `POST /api/admin/listing/:listingId/takedown`；招工 读口 `GET /api/admin/arbitration` + 动作口 `POST /api/admin/arbitration/:jobId`）** + ★★ **注册点逐字登记（§25.4：现取 71 ⇒ 应然 71 → 75）** + ★★ **权限键映射（§25.5：四口两页全落 `review_tasks`；11 键零增删）** + ★★ **归属闸契约形态（§25.6：`R-8-25`/`R-8-26` 准入判定式〔雇主本人 或 持键〕+ 拒绝形态〔码 + `details.reason` 稳定常量〕+ **不得删除既有 admin 通道** + `disputed` 与仲裁关系）** + ★★ **「真生效」四段判据（§25.7：按 Ⅱ 细化 · 改动前 / 改动后两读数 · 含「审核动作成功而台账无行 ⇒ 判负」与反向）** + ★★ **审计面并联对账（§25.8：`R-8-3`；拒绝行 `txid=NULL` 显式豁免；商品无分录 ⇒ `txid` 恒 `NULL` 防假红）** + ★★ **后台页数据契约 + 四语文案面（§25.9：`adminListingReview` + `adminArbitrationReview` + 六类禁项）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-B8-5R**
> **v2.10 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.10-delta.md`（**同批姊妹册** = `docs/audit/data-layer-v0.17-delta.md`）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 `R-8-23`..`R-8-27` 的**逐字落位与登记**；**未改写任何裁定、未发明任何状态值 / 路径 / 权限键 / 决定字段名 / 表名 / 数值 / 日期**）。
> **★★ v2.10 本单要点（先说结论，不含糊）**：① **五条裁定逐字入册**（§25.1；真源 = Zang `§5.210` B）；② **变体 Ⅱ 定案**（§25.1(a)：Ⅰ/Ⅲ 均「不采纳」+ 理由）；③ **4 路由读写口契约**（§25.2）；④ **注册点 71 → 75**（§25.4）；⑤ **归属闸契约形态**（§25.6）；⑥ **真生效四段按 Ⅱ 细化**（§25.7）；⑦ **对账判据**（§25.8）；⑧ **后台页 `adminListingReview` / `adminArbitrationReview`**（§25.9）。

> **状态：v2.11（已完成 · **批 9 第 1 片（P9①）契约冻结：后台可配置面** —— 角色文案覆盖层（四语）+ 站点标语覆盖层（四语）读写口 + 实时生效机制 + P9 配置写口复用 + 权限键映射 + 真生效四段 + 后台页契约与四语文案面**：★★ **覆盖层读写口契约（§26.2：三变体 + 代价 · 不择一）** + ★★ **实时生效机制（§26.2 / §26.11⑥：覆盖值 > locale · 须覆盖 `document.title`）** + ★★ **P9 配置写口复用（§26.3：形态 B · `ops:<uid>:setting:<键>` · **注册点 75 → 75 零新增**）** + ★★ **权限键映射（§26.4：现取逐字 11 键 ⇒ 全落 `manage_settings`；公开读口无闸 · 零新增）** + ★★ **「真生效」四段判据（§26.5 · 含改动前/后两读数 · 每段判负）** + ★★ **后台页契约 + 四语命名空间 + 禁工程口径泄漏六类（§26.6）** + ★★ **`R-9-10` 追加（§26.11：站点标语四语 · 显式白名单 · 拆键 `siteSlogan` · `index.html:8` 中性占位 · `document.title` 接覆盖层 · 测试断言订正〔`J-6`〕）** + ★★ **`R-9-8` 更正 / `R-9-11` 定案（§26.12：四角色名 = 四语新增键 · `vn` = 英文正式口径 · 四语键集相等 + 缺语 fail-closed）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-P9-1**
> **v2.11 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.11-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang `§5.217` D 派单 + `R-9-10` + `R-9-8` 更正 + `R-9-11` 定案 + Kevin 三答 + `R-9-6`/`R-9-8`** 的**逐字落位与登记**；**未改写任何裁定、未发明任何路径 / 数值 / 权限键 / 文案值**）。**★ 姊妹册（同批）**：`docs/data-layer.spec.md` **v0.18 §29**，**本册不重抄其条文、只指路**。
> **★★ v2.11 本单要点（先说结论，不含糊）**：① **覆盖层 = 两类**（角色名四语 + 站点标语四语）；② **三变体不择一**（§26.2）；③ **配置写口复用**（§26.3 · 注册点不动）；④ **权限键 11 键内**（§26.4）；⑤ **真生效四段 + 两读数**（§26.5）；⑥ **后台页 + 六类禁漏**（§26.6）；⑦ **`R-9-10` 站点标语面**（§26.11）；⑧ **`R-9-8` 更正 / `R-9-11` `vn` 定案**（§26.12）。
> **状态：v2.12（已完成 · **批 9 第 1 片（P9①）**追补落册**：Kevin 术语更正 `Vendor`/`Customer`（`R-9-12`）+ 我裁 P9① 三待裁项（`R-9-13`：取变体 Ⅰ · 公开读口 `GET /api/role-names` 注册点 75 → 76 · 四项默认值）+ 更正块（覆盖 §26.12 的 en/vn 两列与「待裁」字样 · **旧行一字不改**）+ 术语统一待办登记 + 待办收口（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-P9-1R**
> **v2.12 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.12-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang `§5.222` B/C** 的**逐字落位与登记**；**未改写任何裁定、未发明任何路径 / 数值 / 文案值**）。**★ 姊妹册（同批）**：`docs/data-layer.spec.md` **v0.19 §30**，**本册不重抄其条文、只指路**。
> **★★ v2.12 本单要点（先说结论，不含糊）**：① **`R-9-12` 术语更正**（店家 = `Vendor` / 顾客 = `Customer`；en/vn 同改 · `Poster`/`Worker` 不变）；② **`R-9-13` 三项裁定**（载体取变体 Ⅰ · 读口 `GET /api/role-names` 注册点 `75 → 76` · 四项默认值）；③ **更正块**（覆盖 §26.12 旧行读法 · 旧行一字不改）；④ **术语统一待办**（逐键 · 另单）；⑤ **待办收口**。

> **状态：v2.13（已完成 · **批 9 第 2 片（P9②）契约冻结：batt 电量 + 签到 / 补签** —— 读 / 动作口清单（预命名 + 逐口形态）+ 权限键映射 + **注册点 `76 → 80`（变体Ⅰ）/ `79`（Ⅱ）/ `78`（Ⅲ）逐 verb 预登记** + 错误码（**既有闭集优先 · 零新增**）+ 错误形状 `R107` + 真生效四段判据（①③④ 段）+ 后台页契约与四语文案面 + 禁工程口径泄漏六类**：★★ **三变体 + 每案代价 · 不择一（§28.8）**+ ★★ **借码 + `reason` 稳定常量候选（§28.5(b) · 零新增码）** + ★★ **承接闸在 SQL 内（姊妹册 §31.3(c)）⇒ 路由闸 / 权限键零变化**+ ★★ **真生效四段（§28.6 · 含改动前 / 改动后两读数 · 每段判负）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-P9-2**
> **v2.13 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.13-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 P9② 契约冻结；**未改写任何裁定、未发明任何路径 / 数值 / 权限键 / 文案值**）。**★ 姊妹册（同批）**：`docs/data-layer.spec.md` **v0.20 §31**，**本册不重抄其条文、只指路**。
> **★★ v2.13 本单要点（先说结论，不含糊）**：① **读 / 动作口 4 候选口（2 读 + 2 动作）**；② **权限键 11 键内（用户面无 admin 键 / 配置面 `manage_settings`）**；③ **注册点 `76 → 80`（Ⅰ）/ `79`（Ⅱ）/ `78`（Ⅲ）**；④ **错误码零新增（借码 + `reason` 稳定常量）**；⑤ **R107 单形状**；⑥ **真生效四段（含改动前 / 后两读数）**；⑦ **后台页 + 六类禁漏 + 派生布尔**；⑧ **三变体不择一**。

> **状态：v2.14（已完成 · **批 9 第 2 片（P9②）裁定落册**：**Zang 七裁定 `R-9-14`..`R-9-20` ⇒ §28 各对应小节就地加注** —— **4 新口逐字**（`GET /api/batt` · `GET /api/checkin` · `POST /api/checkin` · `POST /api/checkin/makeup`）+ **注册点 `76 → 80` 逐 verb 定案** + 权限键映射（11 键内 · 用户面无 admin 键 / 配置面 `manage_settings`）+ 真生效四段判据 + 后台页契约 + 四语命名空间 + ★ **变体 Ⅰ 采纳 · Ⅱ/Ⅲ 不采纳**（`R-9-19`）**（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**） · 作者角色 = **Jing（Specifier · 制度员）** · 单号 = **JING-SPEC-P9-2R**
> **v2.14 修订入口**：逐条 delta → 依据锚点 → 改动点 = `docs/audit/route-layer-v2.14-delta.md`。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准**（本单为 **Zang `§5.230` B 七裁定 `R-9-14`..`R-9-20`** 的**逐字落位与登记**；**未改写任何裁定、未发明任何路径 / 数值 / 权限键 / 文案值**）。**★ 姊妹册（同批）**：`docs/data-layer.spec.md` **v0.21 §31**，**本册不重抄其条文、只指路**。
> **★★ v2.14 本单要点（先说结论，不含糊）**：① **4 新口定案**（§28.2）；② **权限键映射确认**（§28.4）；③ **注册点 `76 → 80` 定案逐 verb**（§28.5）；④ **真生效四段**（§28.6）；⑤ **后台页契约 + 四语命名空间**（§28.7）；⑥ **变体 Ⅰ 采纳 · Ⅱ/Ⅲ 不采纳**（§28.8）。

> **v1.1 一页纸（历史，仍在册）**：见下（`状态：v1.1` 块）。

## §0 元信息与口径

| 项 | 值 |
|---|---|
| 版本 | **v0.6**（2026-09-30 CST / UTC+08:00；v0.5 = v0.4 = 同日）；v0.3 = v0.2 = 2026-09-30；v0.1 = 2026-09-29 |
| 仓库 | `/Users/kevin/bistro/seafood`（后端 `backend-ts`，前端 `frontend`） |
| 服务 | `seafood-api`（端口 5788，cwd `backend-ts`）；前端 Vite 5787 |
| 库 | Neon PostgreSQL 18.6，`public` schema；**批 3a 真收官现取**：`/health` 自报 **`schema_version=0020`**、`schema_migration` = **19**（`0018` 无文件、**勿补**）；**★ v0.5（批 3b）**：**未新增迁移**（`migrations/` 文件数仍 **19**）⇒ `schema_version` 仍 **0020** |
| 本单性质 | **纯规范写作（v0.6 · **Zang §5.86 两条裁定折入单**）**：只写 `docs/route-layer.spec.md`（就地升 **v0.6**）+ 快照 `docs/versions/route-layer.spec.v0.6.md` + 审计件 `docs/audit/route-layer-v0.6-delta.md`；**只追加、未重写已有节**（**§4.2 商品事件行 / §4.5 幂等键总表 / §1.8 清单表体与编号一字未动** —— 另一单元 Kong · 3c 正并发阅读这三节）。**v0.5（历史）**：只写 spec v0.5 + 快照 v0.5 + `docs/audit/route-layer-v0.5-delta.md`（批 3b 折入单）。**本单未写 `docs/data-layer.spec.md` / `docs/ledger.spec.md`，未建任何 data-layer 快照**（本轮无 data-layer 规则变更；判定理由见 §8.7.1）。**零代码改动（`backend-ts/**` 只读）、零库写、零库连接、无 git 写操作、未跑任何服务/套件** |
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

> **★ v0.8 追加块（命名张力的关闭 · 依据 = Zang §5.89 裁定②）**：本节登记的 `/api/listing/order/:orderId/refund` ↔ `/api/listing-orders/:orderId/refund` 张力**已关闭** —— **正典 = `POST /api/listing-orders/:orderId/refund`**（RESTful；与 §1.8 `#10` 既有写法一致），**§4.2 P4 的路径格已就地订正**（旧写法留痕，见 §4.7.4.3 处 ⑧）。**其余路径命名张力（§4.1 目标态 vs 既有路径）不变**（仍以本节上文 + §5.4 时序为准）。登记 = **§7-37**。
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

### 1.8 ★ 已实现·未注册清单（v0.5 新增 · **Zang §5.85 裁定① 新纪律**；**★ v0.9 现况 = 清单已清空 / 无遗留**〔依据 = Zang §5.92 / §5.93〕）

> **依据 = Zang §5.85 裁定①**（逐字：「spec 增设 **「已实现·未注册清单」**（**路径/服务层落点/为何未注册/由哪批注册**；**首批 = `POST /api/job/:jobId/{apply,accept}`、`POST /api/listing`**）⇒ 交 Jing v0.5（**`assets/init` 那类「互推无人认领」的结构性解药**）」）。
> **本清单的目的**：**防止「已实现但未注册」的路径被两片互推而永久遗忘**。**先例** = `POST /api/admin/assets/init` 在 **2a / 2b 两份报告里都写「归同批其它片」、无人执行**（见 **Zang §5.78**；该路径最终由批 2c 补齐为 `410`，见 §1.4 F5）。
> **准入判据（写死 —— 本册加，见 §8.7.3-20）**：**同时**满足三条才入本清单 —— ① **服务编排层有具名导出**（端点级 verb，**非** helper）；② `src/index.ts` **无对应注册点**（`grep` 现取）；③ 该能力的目标对外路径在 §1.1 / §4.2 有**明文命名**。**不满足 ①**（helper 导出）、**无 TS 服务层**（如 `referral_bind` 直调 DB）、**已接线**（如 `submitWork` 经既有路径）三类**分别见下文三个边界块**。

**扫描口径（可复算 · 本册现取）**：

- 服务层导出：`grep -nE '^export (async )?function|^export const [a-zA-Z]+ = (async )?\(' src/{job-service,listing-service,job-funds-service,currency-service,admin-service}.ts`
- 已注册路径表：`grep -nE '^app\.(get|post|put|delete|patch)\(' src/index.ts` ⇒ **65 行**（**★ v0.9 现取复核 = 65**；**旧写法（留痕）：「53 行」**）
- 交叉核对：逐个 verb 名 `grep -nE '\b<verb>\b' src/index.ts` ⇒ **调用点 = 0 ⇒ 未接线**

| # | 路径（**未注册** · **★ v0.9 现况 = 已注册（批 4a）**） | 服务层落点（`文件:行号`） | 为何未注册（**★ v0.9：该列对 11 条均已失效 ⇒ 以文末 v0.9 追加块为准；旧写法留痕**） | 由哪一批注册（**★ v0.9 已就地改为「已注册（批 4a）+ 注册行号」**） |
|--:|---|---|---|---|
| 1 | `POST /api/job`（招工发布 + 托管） | `src/job-funds-service.ts:149`（`publishJob`） | 前端对 `/api/job*` **零调用**（`p4-b3c-job-funds.md §1.1` 反证读数；同 `p4-aud-jobkey.md §2.5`）；批 2 / 批 3 保「注册点 53」；**Zang §5.85 裁定① 接受现状** | **已注册（批 4a）**：`src/index.ts:1289`〔**旧写法（留痕）**：**批 4**〕 |
| 2 | `POST /api/job/:jobId/apply` | `src/job-service.ts:175`（`applyToJob`） | 同上；**实测** `POST /api/job/2/apply` ⇒ **404**（`p4-b2a-http.md §3:74`）、`POST /api/job/12/apply` ⇒ **404 `Not found`**（`p4-aud-jobkey.md §2.5`，即 `src/index.ts:24` 只引了 `sendGone/sendVerbError/submitWork`） | **已注册（批 4a）**：`src/index.ts:1305`〔**旧写法（留痕）**：**批 4**〕 |
| 3 | `POST /api/job/:jobId/accept` | `src/job-service.ts:208`（`acceptApplication`） | 同上；**★ 集成缺口 F-1**（未注册 ⇒ 批 4 前前端 verify 走不通完整资金链；见 §1.9 K11） | **已注册（批 4a）**：`src/index.ts:1327`（**★ F-1 集成缺口已关闭**）〔**旧写法（留痕）**：**批 4（优先级最高）**〕 |
| 4 | `POST /api/job/:jobId/submit` | `src/job-service.ts:125`（`submitWork`） | **§4.1 新命名未上线**；功能**已由既有** `POST /api/task-progress/:identifier/submit`（**已注册** `:581`）**承载** ⇒ 「**服务已接线、仅新路径名未注册**」 | **已注册（批 4a）**：`src/index.ts:1352`（**别名面**，与既有路径键集逐键一致）〔**旧写法（留痕）**：**批 4（可选别名）**〕 |
| 5 | `POST /api/job/:jobId/review` | `src/job-funds-service.ts:218`（`settleJob`）/ `:237`（`refundJob`） | 前端零调用；**approve / reject 已由既有 `/api/tasklist/:jID/verify` 改接承载**（§1.9 K2/K5） | **已注册（批 4a）**：`src/index.ts:1380`（`settleJob`/`refundJob` 双分支）〔**旧写法（留痕）**：**批 4**〕 |
| 6 | `POST /api/job/:jobId/cancel` | `src/job-funds-service.ts:237`（`refundJob`） | 前端零调用（`p4-b3c-job-funds.md §1.3`） | **已注册（批 4a）**：`src/index.ts:1404`〔**旧写法（留痕）**：**批 4**〕 |
| 7 | `POST /api/listing` | `src/listing-service.ts:164`（`createListing`） | 前端零调用（`p4-b2b-listing-write.md §1.3-1`）；**实测** ⇒ **404** | **已注册（批 4a）**：`src/index.ts:1422`〔**旧写法（留痕）**：**批 4**〕 |
| 8 | `POST\|PATCH /api/listing/:listingId`（编辑 / 下架） | `src/listing-service.ts:222`（`updateListing`）/ `:286`（`transitionListingStatus`） | **整个商品写口未接线**：`src/index.ts` **无** `from './listing-service'` 导入（本册现取 `grep`） | **已注册（批 4a · 2 注册点）**：`src/index.ts:1448`（`POST`）/ `:1475`（`PATCH`）〔**旧写法（留痕）**：**批 4**〕 |
| 附 | `POST /api/admin/commission_policy` | `src/commission.ts:240`（`insertCommissionPolicy`） | **非本轮 5 文件扫描面**（§1.1 既有登记为「服务层可选」）；非本批三片范围 | **已注册（批 4a）**：`src/index.ts:1540`〔**旧写法（留痕）**：**批 4**〕 |
| 9 | `POST /api/listing/:listingId/buy` | `src/listing-funds-service.ts:191`（`buyListing`） | **批 3c 新增服务层 verb、未接线**（**本册现取**：`grep -c '\bbuyListing\b' src/index.ts` = **0**；`grep -c 'listing-funds-service' src/index.ts` = **0** ⇒ 该模块**整体未导入**）；前端 `/api/listing*` **零命中**（**本册现取**：`grep -rn '/api/listing' frontend/src` = **0**，口径同 #7/#8）；批 2 / 批 3 保「注册点 53」 | **已注册（批 4a）**：`src/index.ts:1499`〔**旧写法（留痕）**：**批 4**〕 |
| 10 | `POST /api/listing-orders/:orderId/refund`（**★ 命名张力**：§4.2 P4 的目标命名写作 `POST /api/listing/order/:orderId/refund`〔**★ v0.8：该张力已关闭 —— Zang §5.89 裁定② 定名 = `/api/listing-orders/:orderId/refund`；§4.2 P4 路径格已就地同步（旧写法留痕）**；见 §7-37〕） | `src/listing-funds-service.ts:261`（`refundListingOrder`） | 同上（**本册现取**：调用点 = **0**、模块未导入、前端零命中）；**Zang §5.88 裁定③ 点名登记** | **已注册（批 4a）**：`src/index.ts:1520`（**路径正典**，§7-37）〔**旧写法（留痕）**：**批 4**〕 |

**★ v0.7 现取复算（Jing 依本追加块第 2 行「每次 spec 版本刷新真扫描」的强制项，v0.7 重跑一遍）**：扫描面由 v0.6 的 **5 文件**扩为 **6 文件**（**加入 3c 的 `listing-funds-service.ts`**）⇒ 具名导出 = **29**（`job-service` **7** / `listing-service` **4** / `job-funds-service` **5** / `currency-service` **4** / `admin-service` **7** / `listing-funds-service` **2**；**v0.6 记的 27 是 5 文件面**，差 **+2** 即 #9/#10）；`src/index.ts` 已注册路径表 = **53**（`src/index.ts` 现 **1216 行**）；**未注册 verb 调用点逐个 `grep` = 0**（10 条：`publishJob` / `settleJob` / `refundJob` / `applyToJob` / `acceptApplication` / `createListing` / `updateListing` / `transitionListingStatus` / **`buyListing`** / **`refundListingOrder`**）；正向对照 = 7 个已接线 verb（`submitWork` / `verifyJobSubmission` / `createCurrencyVerb` / `listCurrencyVerb` / `adminPermissionSaveVerb` / `adminPermissionDeleteVerb` / `adminUserUpdateVerb`）**7 / 7 有注册点** ⇒ **§1.8 = 10 条 + 1 附注（v0.6 的 8 条 + 1 附注 + 本单新增 2 条；无消除）**；**兑现 §7-29**（登记 **§7-33**）。

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

> **★★ v0.6 追加块（**Zang §5.86 裁定② · 维护责任 = 三方分工，已定**；**本节只追加，上文任何一句未改**）**：上段「**责任人待 Zang**」已定案 ⇒ **三方分工**（**本节是 §1.8 的唯一维护条款**）：
>
> | 角色 | 责任 | 触发时点 | 交付物 / 判据 |
> |---|---|---|---|
> | **Kong（实现方）** | 扫**本片新增的「已实现·未注册路径」**并**报数** | **每片收尾** | 报告须写「**认领 N 条 / 未认领 M 条**」（N + M = 本片新增数；**「未认领 M 条」必须逐条进本表**，不得留白） |
> | **Jing（规范方 · 本表维护人）** | **维护 §1.8 表**（新增 / 消除逐条登记） | **每次 spec 版本刷新**（**强制**） | **真扫描一遍**：`grep` 服务编排文件导出 × 对照 `src/index.ts` 已注册路径表（= 上文「扫描口径」三条命令，可复算）；**有新增项未登记 ⇒ 复核不通过** |
> | **Zang（终审）** | 做**差集**收口 | **批末** | 判据 = **全量服务层导出 − 已注册 − §1.8 已登记 = ∅**（**非空 ⇒ 有人未认领，不得结批**） |
>
> **★ 本单（v0.6）现取复算（Jing 依上表第 2 行真扫描一遍）**：服务编排 5 文件（`job-service`/`listing-service`/`job-funds-service`/`currency-service`/`admin-service`）具名导出 = **27**；`src/index.ts` 已注册路径表 = **53**（`src/index.ts` 现 **1216 行**）；`from './listing-service'` 导入 = **0**；**8 条未注册 verb 逐个 `grep` 调用点 = 0**（`publishJob` / `settleJob` / `refundJob` / `applyToJob` / `acceptApplication` / `createListing` / `updateListing` / `transitionListingStatus`）；正向对照 = `verifyJobSubmission` **2** / `submitWork` **2** ⇒ **§1.8 条目与 v0.5 一致（8 条 + 1 附注）：本单无新增、无消除**。
> **★ 边界声明**：另一并发单元（**Kong · 3c 商品资金**）**正在改 `backend-ts/src/**`**；其在途改动若新增导出或注册点（或把 §1.8 某条**注册掉**）⇒ **由 3c 收尾按上表第 1 行报数**，再由 Jing 在下次刷新时增删本表行。**本单不代 3c 推导**（登记 **§7-29**）。

**★ v0.8 追加块（本清单的路径正典 + 批 4 收口 · 依据 = Zang §5.89 裁定② / §5.90）**：① `#10` 的路径正典**已定** = **`POST /api/listing-orders/:orderId/refund`** ⇒ 该行的「命名张力」注降为**历史留痕**（§4.2 P4 路径格已同步；登记 **§7-37**）。② **本清单 10 条 + 1 附注的「由批 4 注册」逐条行动**已汇总为可执行表 = **§9 · A 栏**（元信息 = 项目 / 真源锚点 / 行动 / 前置依赖 / 验收判据）⇒ **本清单不再只写「批 4」两字**。③ **本册现取复算（v0.8）**：服务层扫描面**未再扩**（仍 **6 文件 / 具名导出 29**）、`src/index.ts` 注册点仍 **53**、**10 条未注册 verb 调用点 = 0** ⇒ **§1.8 无新增、无消除**（维护责任 = 本节追加块的三方分工）。
**★★ v0.9 追加块（★ 本清单的收口：**11 条全部注册 ⇒ 清单已清空 / 无遗留**；**依据 = Zang §5.92 / §5.93**）**：

| # | 路径（**v0.9 现况：已注册（批 4a）**） | 注册行号（**本册现取**） | 状态 |
|--:|---|---|---|
| 1 | `POST /api/job` | `src/index.ts:1289` | **已注册（批 4a）**〔旧写法（留痕）：**批 4**〕 |
| 2 | `POST /api/job/:jobId/apply` | `:1305` | **已注册（批 4a）** |
| 3 | `POST /api/job/:jobId/accept` | `:1327` | **已注册（批 4a）· ★ F-1 集成缺口已关闭** |
| 4 | `POST /api/job/:jobId/submit` | `:1352` | **已注册（批 4a）· 别名面** |
| 5 | `POST /api/job/:jobId/review` | `:1380` | **已注册（批 4a）** |
| 6 | `POST /api/job/:jobId/cancel` | `:1404` | **已注册（批 4a）** |
| 7 | `POST /api/listing` | `:1422` | **已注册（批 4a）** |
| 8 | `POST\|PATCH /api/listing/:listingId` | `:1448`（`POST`）/ `:1475`（`PATCH`） | **已注册（批 4a · 2 注册点）** |
| 9 | `POST /api/listing/:listingId/buy` | `:1499` | **已注册（批 4a）** |
| 10 | `POST /api/listing-orders/:orderId/refund` | `:1520` | **已注册（批 4a · 路径正典）** |
| 附 | `POST /api/admin/commission_policy` | `:1540` | **已注册（批 4a）** |

- **清单结论 = 已清空 / 无遗留**：原 **10 条 + 1 附注**（= **11 条 / 12 注册点** —— #8 含 `POST`+`PATCH` 两 verb）**全部由批 4a 注册**，**无残余、无被删除项**；差集判据（**全量服务层导出 − 已注册 − §1.8 已登记 = ∅**）**在本片后成立**（认领报数 = **认领 10 条 + 1 附注 / 未认领 0 条**；真源 = 4a 报告 §1）。
- **注册点 53 → 65（+12）**：`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` **本册现取 = 65**；**既有 53 条零删除**（QA-B4 §2.1/§3：`git diff -U0 … | grep -cE '^-app\.'` = **0**、`comm -23`（旧 ∖ 新）= **0**、抽 5 条状态未变）。
- **不得读成「相邻面也全清」**：§1.8 负向排除块（helper 导出 / 无 TS 服务层 / 已接线正向对照）与**并案登记**的两条旧直写函数（`markTaskProgressChecked` / `rejectPendingTaskProgress`）**仍属 §9 · E 栏（E2）**；§5.4 第 3 阶段其它片路径（`/api/referral/*`、`/api/user/points|ledger`、`/api/market/*/candles`）**本片不认领**（真源 = 4a 报告 §1）。
- **真源锚点**：`docs/audit/p4-b4a-route-registration.md` §4（逐条路径 → 行号）+ §8（Kong 交本册的待补行 11 行）+ `docs/qa/p4-b4a-route-registration-qa.md` §3（注册面回归）⇒ **明细见 §1.11**。

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

### 1.10 AUD-JOBKEY 审计件入册（v0.6 新增 · **只登记，不改码**；**Zang §5.86 裁定① 的取证来源**）

> **性质**：本节**只做入册登记**（审计件 + 产物 + 探针 + 零改码取证）与**三选项去向**，**不重述结论** —— 结论已升为契约（**§4.5 追加块**）；未决残留见 **§7-25 / §7-28 / §8.8.2**。**登记依据 = Zang §5.86 A**（「交付：报告 248 行 + 探针 + 产物；`git status` 零 modified ⇒ 零改码声明为真」）。

| # | 项 | 现取读数（**本册现取**） | 口径 / 锚点 |
|--:|---|---|---|
| **A1** | **审计件** | `docs/audit/p4-aud-jobkey.md` = **248 行 / 21502 字节 / md5 `99f535e0ffa18e16c8d34d7e40be9c4e`**；节结构 = §0 待判 / §0.1 结论摘要 / §1 源码取证（`:31`；派生函数本体 `:33`、两调用点 `fallbackParts` `:60`、落行 SQL 判据 `:78`、对照 3b `:86`）/ §2 实测（`:93`；夹具 `:98`、逐笔读数 `:108`、判据结论 `:138`、**分情形表 `:145`**、路由面 `:156`）/ §3 前端取证（`:165`）/ **§4 修法三选项（`:198`，A `:202` / **B `:209`** / C `:216`）** / §5 自曝（`:225`）/ §6 交付物（`:239`） | `wc -l` / `wc -c` / `md5 -q`（本册现取）；**Zang §5.86 A 亦记 248 行**。**★ 口径更正**：**v0.5 的 `§7-25` 曾记「246 行 / 21165 字节」= 审计中途落盘读数**（该审计自曝「初稿列了未生成的 `probe.log` ⇒ 已改正文」）⇒ **一律以现取 248 行 / 21502 字节为准**（自曝 §8.8.3-23） |
| **A2** | **产物** | `backend-ts/.p4-artifacts/audjk-20260929T182652Z/` = **4 文件**：`before-counts.json`（321 B）/ `after-counts.json`（323 B）/ `fixture-ledger.json`（760 B）/ `results.json`（12345 B） | `ls -la`（本册现取）；run tag = **`audjk-20260929T182652Z`**（与 Zang §5.86 逐字一致）；**`results.json` = 「实测」唯一真值**（审计自曝：`stdout` 未落盘、`probe.log` 不存在 ⇒ **不要去找 `probe.log`**） |
| **A3** | **探针** | `backend-ts/scripts/p4z-audjk-01-probe.ts` = **17025 字节** | `ls -la`（本册现取）；命名 tag 前缀 `p4z-audjk-01` |
| **A4** | **★ 零改码** | **`git status --porcelain` 现取 = 仅 1 行 untracked：`?? backend-ts/scripts/p4z-b3d-00-probe.ts`**；**`modified` = 0** ⇒ **「该审计零改码（`git status` 零 modified）」成立且可复算**（**口径 = 本单动笔前现取**；本单自身的产物（本册 v0.6 + 快照 v0.6 + delta 件 v0.6）随后会另以 ` M` / `??` 出现在同一输出里，**属本单交付面，不是该审计、也不是 3c 的改动**）。HEAD = **`f5a8bb3`**（=「AUD-JOBKEY 审计 + route-layer v0.5 + §5.86/v0.86」提交） | 本册现取（**只读** `git status --porcelain` / `git log --oneline -3`；**未做任何 git 写操作**）。**★ 边界**：该 untracked 行**属另一并发单元 Kong · 3c 商品资金**（报告 tag `p4-b3d`）的在途产物，**非本单、非该审计所造** ⇒ **不得**把它算作本单产物（登记 **§7-29**；自曝 §8.8.3-24） |
| **A5** | **三选项去向（审计不自选 ⇒ Zang 选）** | 审计 §4 给**三个互斥**选项：**A** = 服务层 fail-loud + 同单补前端键（`:202`）/ **B** = 保持派生（零改码）、把过渡口径升为**显式契约**（`:209`）/ **C** = 双轨：路由层必填、服务层保留派生（`:216`）⇒ **Zang §5.86 裁定① = 采纳「选项 B」**（理由：碰撞假设已证否、A/C 均要改**冻结前端**、现行为已**响亮拒绝**） | `p4-aud-jobkey.md §4`；**Zang §5.86 裁定①**（`docs/seafood.master-plan.md:1390-1398`；v0.86 记录 `:2004`）；**契约正文 = §4.5 追加块** |
| **A6** | **未测项（禁当 0/空）** | ① **「不同 worker 对同一 job」**的键碰撞**未造夹具**（`§2.4:153`；仅代码推断）；② 前端「不传键」= **静态 `grep` 取证、非运行时抓包**（`§3:167`）；③ 审计写「`frontend/**` 0 命中」⇒ **本册复算 = 应用代码面 0 / 全树 26（全在 `node_modules/**`）**（口径见 §8.8.3-25） | `p4-aud-jobkey.md §2.4/§3/§5`；§8.3-23 / §8.8.2 |

### 1.11 批 4a 注册切片已落地事实 + QA-B4 独立质检（v0.9 新增 · **全部带真源锚点**）

> **口径**：**批 4a = 「已实现·未注册路径接线」（§1.8 十一条 / §9-A 栏）**。**实现方 = Kong**（报告 `docs/audit/p4-b4a-route-registration.md`，**198 行 / 9 节**；run tag `b4a-20260930T030859`；产物 `backend-ts/.p4-artifacts/b4a-20260930T030859/**`；探针 `backend-ts/scripts/p4z-b4a-01-http-e2e.ts`）；**质检方 = Neng**（报告 `docs/qa/p4-b4a-route-registration-qa.md`，**326 行**；run tag `qab4-20260929T191832Z`；**7 腿全 PASS / 无 FAIL**，其 §0 速览）。**本节读数 = 转引两报告 + 本册现取**（**本册不连库、未实跑、未启停任何进程**）。**依据 = Zang §5.92**（4a 验收 + 三处口径更正 + A5/A6/A11 三项裁定）**+ §5.93**（QA-B4 验收 + 两条诚实登记裁定）。

| # | 事实 | 实测读数 | 依据锚点 |
|--:|---|---|---|
| **Q1** | **注册面** | 注册点 **53 → 65**（+12）；`src/index.ts` **1254 → 1575 行**；**本册现取复核 = `grep -cE '^app\.(get\|post\|put\|delete\|patch)\('` = 65、`wc -l` = 1575**，12 条新行号逐条相符 | 4a 报告 §0/§4；**QA-B4 §3**（65 / 旧 53 / `comm -23` = 0 / `^-app\.` = 0）；**本册现取** |
| **Q2** | **★ 集成缺口 F-1 关闭** | **同一 job 走通 A1→A2→A3→A4→A5**（`200` + 2 分录 + `status=settled`）；此前 `/accept` 未注册 ⇒ 前端 verify 走不通完整资金链（§1.9 K11） | 4a 报告 §3（F-1 关闭证据行）；**QA-B4 §0 腿 3**（A1/A2/A3/A4/A5 全 `200`）；**Zang §5.92** |
| **Q3** | **★ 腿归因真差额 = 0** | `ledger_entry` **189 → 213**（**+24**）= **QA-B3 夹具 8**（4 事件 × 2 腿：`currency_create_fee ×2` + `hold ×2` ×2 + `hold_release ×2`）+ **4a 16 腿**（6 `job_escrow` + 2 `job_payout` + 4 `job_escrow_refund` + 1 `purchase` + 1 `sale` + 2 `purchase_refund`）；**与 Zang 自算完全对齐**；4a 自报的「差额 2」= **其 pre 基线取在 A1 落账之后**（读成 199、应为 197）⇒ **非真缺口** | **QA-B4 §2.2**（分桶时间轴 + txid 205–220 逐笔归因表）；4a 报告 §5/§7 事项 5；**Zang §5.92/§5.93** |
| **Q4** | **★ `fee>0` 结算形态（实测）** | `reward=100000`（`fee_rate_bp=100`）⇒ **`fee=1000`**；分录 = `job_payout` ×2（雇主 `frozen −99000` → 打工人 `balance +99000`）+ `job_fee` ×2（`−1000` → **`uid=-1` `balance +1000`**）；**无链 ⇒ `commission` 0 腿**；`Σtotal` 不变 | **QA-B4 §2.3**（逐步 HTTP + `WHERE event_root_key='biz:job:settle:19'` 逐笔分录）；**Zang §5.93 ②** |
| **Q5** | **不变量 / 冻结面** | `Σtotal = SUM(balance+frozen)` **2,020,100**（pre = post 恒等）；负值行 **0**；`23514` **未触发**；**`migrations/0001..0020` sha256 × `schema_migration.checksum` = 19/19 匹配**（`mismatches:[]` / `missing_in_db:[]` / `db_files_not_on_disk:[]`）；`ledger.ts`/`ledger-errors.ts`/`commission.ts`/`frontend/**`/`.env.local` 自 HEAD **SAME** | **QA-B4 §5/§6**；4a 报告 §5/§6；**Zang §5.92**（第六次自算守恒） |
| **Q6** | **4a 的改动面** | `git diff --numstat backend-ts/src/index.ts` = **`+323/−2`**；**被替换的 2 行 = import 重导入**（`./job-service` 的 4 符号行 + `./job-funds-service` 的 `verifyJobSubmission` 行；**5 符号同名同模块原样重导入 = 超集**）⇒ **既有路径零影响**（`^-app\.` 删除 = **0**、`comm -23` = **0**）；`tsc --noEmit` = **0**；重启走面板 `POST :5555/api/restart`（**未用 `pkill`/`killall`**） | **QA-B4 §2.1**（原始命令与读数逐字）+ §3；4a 报告 §0/§6；**Zang §5.92 ①**。**★ 本册现取**：该 diff **已提交、工作树干净**（`git status --porcelain` 仅 1 行 untracked = `?? backend-ts/.p4-artifacts/QA_B4_RUN_TAG.txt`）⇒ **`+323/−2` 为转引读数**（§8.11.3-38） |
| **Q7** | **★ A5 新路径键集 = `jobEventView`（15 键）** | `POST /api/job/:jobId/review` 成功面 **15 键**（逐键见 **§2 追加块**）；**旧路径 `/api/tasklist/:jID/verify` 的 `11 键/9 键` 冻结键集不变**；**两者不得串**；A6 `/cancel` 面 = **14 键**、A1 `/api/job` 面 = **17 键** | **Zang §5.92 ③**；4a 报告 §3（A5 逐键枚举）/ §7 事项 1（自曝「11/9 需服务层读口，本片禁改」）；§4.4-17 / §1.9 K9；**§7-42** |
| **Q8** | **★ A6/A11 权限点名** | `POST /api/job/:jobId/cancel` = **`requireAdmin(review_tasks)`**（与 J6 唯一既有触发面 `verify` 同权限；**不传 `reviewerUid`** ⇒ 不写结论位）；`POST /api/admin/commission_policy` = **`manage_settings`**；**原则 = 复用既有权限键、不新造**；`/api/job/:jobId/review` 亦为 `requireAdmin(review_tasks)` | **Zang §5.92 ②**；4a 报告 §2（权限列）+ §7 事项 2（自曝「spec 未点名」）；§6 单一真源 |
| **Q9** | **4a 的未覆盖面（`NOT_MEASURED`）** | ① A5 **`fee>0` 非退化形态**（4a 本 run `reward=5 ⇒ fee=0`，命中 §4.4-1 退化）；② `POLICY_EFFECTIVE_BACKDATED` / `WEIGHTS_SUM_EXCEEDS_10000`；③ A2 `not_open_job` / `self_application`；④ A9 `listing_stock_insufficient` / `self_purchase`；⑤ `details.reason` 逐字（探针只记 `code/message`）；⑥ 401/403 服务端日志归因（无 access log） | 4a 报告 §7 事项 3–6；§3.4 / §7-24 口径（**禁把「查不到」当「无异常」**）。**其中 ① 已由 QA-B4 §2.3 补测**（见 Q4） |
| **Q10** | **QA-B4 的 4 条 `NOT_MEASURED`（其 §7 N1–N4）** | **N1** A4 ↔ 既有别名面键集逐键一致（QA 只测新路径侧；**4a 侧实测 `identical=true`**）；**N2** 「有链 ⇒ `job_fee` 入 `-2`」的 HTTP 级形态（造链需 `/api/referral/bind`，超其写库允许面）⇒ **Zang §5.93 ③ 裁定「不算缺口」**，仅留抽查项 = **§7-41**；**N3** 4a 的 `details.reason` 逐字；**N4** A6/A7/A8/A8-b/A9/A10 的 QA 独立复测（**其 4a 期分录已在 QA §2.2 逐笔归因**） | QA-B4 §7；**Zang §5.93 ②③**；§8.11.2-40…43 |

**★ 边界声明（写死）**：本节**只登记** —— **未覆盖面一律 `NOT_MEASURED`**（§8.11.2），**不得**读成「全形态已验」；**本册不改任何代码**（`backend-ts/**` 只读）、**不改任何 QA/audit 件**。

### 1.12 ★ v1.0 现取复核：§1 端点处置表 / §1.8 状态列与注册点（v1.0 新增 · **只追加；旧读数保留为历史留痕**）

> **依据** = 派单 delta ⑧（「§1 端点处置表 / §1.8 状态列与注册点：现取复核；若与现盘不符 ⇒ 以现盘为准并留痕」）。**命令（逐字 · 退出码一律管道外取）**：`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` ⇒ **65**；`wc -l backend-ts/src/index.ts` ⇒ **1645**（**本册现取**）。
> **复核面声明（写死 · 防误读）**：本表复核的是 **①注册点计数 ②逐条注册行号 ③路径存在性**；**HTTP 响应码面（13 个 `410` / 各面 200·400·403·409）本册未复跑** ⇒ 那部分 = **`NOT_MEASURED`**（§8.12.2-45）。

| 项 | v0.9 记载（**历史留痕**） | **v1.0 现取（以现盘为准）** | 结论 |
|---|---|---|---|
| 注册点 | 53 → 65（批 4a） | **65**（`grep -cE` 现取） | **不变 ✓** |
| `src/index.ts` 行数 | 1575 行 | **1645 行** | **已漂移（+70 行）** |
| `POST /api/job` | `:1289` | **`:1359`** | 漂移 |
| `POST /api/job/:jobId/apply` | `:1305` | **`:1375`** | 漂移 |
| `POST /api/job/:jobId/accept` | `:1327` | **`:1397`** | 漂移 |
| `POST /api/job/:jobId/submit` | `:1352` | **`:1422`** | 漂移 |
| `POST /api/job/:jobId/review` | `:1380` | **`:1450`** | 漂移 |
| `POST /api/job/:jobId/cancel` | `:1404` | **`:1474`** | 漂移 |
| `POST /api/listing` | `:1422` | **`:1492`** | 漂移 |
| `POST /api/listing/:listingId` | `:1448` | **`:1518`** | 漂移 |
| `PATCH /api/listing/:listingId` | `:1475` | **`:1545`** | 漂移 |
| `POST /api/listing/:listingId/buy` | `:1499` | **`:1569`** | 漂移 |
| `POST /api/listing-orders/:orderId/refund` | `:1520` | **`:1590`** | 漂移 |
| `POST /api/admin/commission_policy` | `:1540` | **`:1610`** | 漂移 |
| `POST /api/tasklist/:jID/verify` | `:1061`（批 3b 末态） | **`:1109`** | 漂移 |
| `POST /api/currency` | `:1160`（v0.1）/ `:1166`（批 3b） | **`:1282`** | 漂移 |
| `POST /api/currency/:cid/list` | `:1179`（v0.1）/ `:1185`（批 3b） | **`:1301`** | 漂移 |
| `POST /api/admin/points/adjust` | `:1066`（v0.1）/ `:995`（批 2 末态） | **`:1191`** | 漂移（A1-LEDGER-IMPL 改接后；§4.10） |
| `POST /api/admin/assets/init` | `:1056`（v0.1）/ `:985`（批 2 末态） | **`:1173`** | 漂移 |

- **★ 行号口径由「四分」升为「五分」**：v0.1 live / 批 2 末态 / 批 3a 末态 / 批 3b 末态 / **v1.0 现取（当前 HEAD）** —— §0.2-9 的「任何逐行断言前必须现取」不变。
- **★ 留痕声明（写死）**：**§0 端点锚口径行的「`src/index.ts` 现 1575 行」**与 **§1.8 v0.9 追加块的 12 个注册行号（`:1289`…`:1540`）**、**§1 §49 行的「批 3b 末态现取 = `:1061`」** = **v0.9 时点读数 ⇒ 一律为历史留痕，不得当现盘使用**；判据取本表「v1.0 现取」列。
- **§1 端点处置表的「处置」列（v0.1 51 条 + 新增 + 13 个 `410` 面 + 保留面）逐条复核 = 注册与路径面与现盘一致 ⇒ 无处置列订正**；其中 `GET /api/prize-item` 现取 **`:546`** = **保留面（非 sunset，§5.6）**、`GET /api/shard` `:687` / `/api/shard/transfer` `:702` = **sunset 保留面（`deprecated:true` + 恒空态）**。
- **§1.8 状态列复核**：**「已注册（批 4a）」11 行 + 1 附注 = 与现盘一致**（注册点 65 现取）；**清单结论「已清空 / 无遗留」成立** ⇒ **无状态列订正**（只登记行号漂移）。
- **本单不改任何代码**（`backend-ts/**` 只读：`grep`/`grep -c`/`wc -l`/`sed -n`）。

### 1.13 ★ 运行依赖登记（v1.1 新增 · **只登记，不改码**；依据 = **Zang §5.106** + `docs/audit/p5-sig-verify.md §3`）

| 项 | 值（**本册现取**） | 口径 / 依据 |
|---|---|---|
| 包名 | **`ethers`** | 服务端（`backend-ts`）**直接依赖** |
| 版本 | **`^6.17.0`** | `backend-ts/package.json:17`（**现取逐字** `"ethers": "^6.17.0",`） |
| 已装实版 | **`6.17.0`** | `docs/audit/p5-sig-verify.md §3 ⑤`（`node_modules/ethers/package.json` ⇒ `"version": "6.17.0"`；**转引**） |
| lockfile | **`backend-ts/package-lock.json`（`+98 / −0`）** | 同上 §3 ⑥（新增 `ethers` + `@noble/curves` / `@noble/hashes` / `@adraffy/ens-normalize` / `aes-js` / 嵌套 `ws` / 嵌套 `@types/node` / `undici-types`） |
| **部署约束（写死）** | **部署必须带 lockfile**（`package-lock.json` 随 `package.json` 同批提交） | 传递依赖**非显式安装**；不带 lockfile ⇒ 解析版本可能漂移 |
| 用法面 | **仅一个顶层 API**：`import { verifyMessage } from 'ethers'`（`src/auth.ts:2`）⇒ 调用点 `src/auth.ts:221`（`grep -c verifyMessage src/auth.ts` = **2**） | §3.6（登录必须验签） |
| **债务归属（防混同）** | 本条 = **服务端包**（`backend-ts`）；**与前端的「Tailwind CDN」那条债务不是同一件事**（该条**不在本册登记面内** ⇒ 本册不引其锚点、不合并处理） | 派单 delta ② |
| 引入理由 | 本仓**确无** EVM 恢复原语（`package.json` 无 `ethers`/`viem`/`web3`/`secp256k1`/`ethereumjs-*`；`node_modules` 嵌套查 `*secp*`/`*noble*` = 0 命中）；Node 内置 `crypto` 无 `secp256k1` **公钥恢复**、`sha3-256` ≠ Keccak-256 ⇒ **不可自造** | `docs/audit/p5-sig-verify.md §3 ①–③`（**转引**） |

- **判负（写死）**：① 任何「自造 secp256k1 恢复」或改走 `crypto` 近似实现的方案 ⇒ **复核不通过**（Keccak-256 不可替代）；② 部署不带 lockfile ⇒ **复核不通过**；③ 把本条与前端 Tailwind CDN 债务并案处理 ⇒ **复核不通过**（**服务端包 vs 前端外链债，两件事**）。
- **`NOT_MEASURED`**：`npm install` 的当次输出（`added 9 packages`）与 lockfile diff 计数 = **转引**审计件（**本册未安装任何包**，§8.13.2）。

---

> **★★ §1.12 v1.1 追加块（现取复核 · **同日第二次改线**；**不并入上表、只追加**；**上表 21 行一字未动**；依据 = 派单 delta ⑥ + 本册现取）**
> **命令（逐字 · 退出码一律管道外取）**：`wc -l backend-ts/src/index.ts` ⇒ **1651**；`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` ⇒ **65**；`wc -l backend-ts/src/auth.ts` ⇒ **261**。**本块复核面 = 行号 / 计数**；**HTTP 响应码面仍未复跑** ⇒ `NOT_MEASURED`（§8.13.2）。

| 项 | v1.0 记载（**历史留痕**） | **v1.1 现取（以现盘为准）** | 结论 |
|---|---|---|---|
| 注册点 | 65 | **65**（`grep -cE` 现取） | **不变 ✓** |
| `src/index.ts` 行数 | 1645 行 | **1651 行** | **+6**（= **P5-FIX-LOGIN** 的 `+7/−1`，落在 `:359-364`） |
| `src/auth.ts` 行数 | （v1.0 未记） | **261 行** | **+21**（= **P5-SIG-VERIFY** 的 `+24/−3`；改前 = 240 行） |
| `POST /api/auth/verify` | `:354` | **`:354`**（**唯一不漂移的端点** —— 本单改动全落在其后 `:359-364`） | **不变 ✓** |
| `POST /api/job` | `:1359` | **`:1365`** | 漂移 +6 |
| `POST /api/job/:jobId/apply` | `:1375` | **`:1381`** | 漂移 +6 |
| `POST /api/job/:jobId/accept` | `:1397` | **`:1403`** | 漂移 +6 |
| `POST /api/job/:jobId/submit` | `:1422` | **`:1428`** | 漂移 +6 |
| `POST /api/job/:jobId/review` | `:1450` | **`:1456`** | 漂移 +6 |
| `POST /api/job/:jobId/cancel` | `:1474` | **`:1480`** | 漂移 +6 |
| `POST /api/listing` | `:1492` | **`:1498`** | 漂移 +6 |
| `POST /api/listing/:listingId` | `:1518` | **`:1524`** | 漂移 +6 |
| `PATCH /api/listing/:listingId` | `:1545` | **`:1551`** | 漂移 +6 |
| `POST /api/listing/:listingId/buy` | `:1569` | **`:1575`** | 漂移 +6 |
| `POST /api/listing-orders/:orderId/refund` | `:1590` | **`:1596`** | 漂移 +6 |
| `POST /api/admin/commission_policy` | `:1610` | **`:1616`** | 漂移 +6 |
| `POST /api/tasklist/:jID/verify` | `:1109` | **`:1115`** | 漂移 +6 |
| `POST /api/currency` | `:1282` | **`:1288`** | 漂移 +6 |
| `POST /api/currency/:cid/list` | `:1301` | **`:1307`** | 漂移 +6 |
| `POST /api/admin/points/adjust` | `:1191` | **`:1197`** | 漂移 +6（⇒ 其入参不完整分支 `:1200-1202 → **`:1206-1208`**，§9.E · E9） |
| `POST /api/admin/assets/init` | `:1173` | **`:1179`** | 漂移 +6 |
| `POST /api/task-progress/claim/:jID` | `:635`（v1.0 §4.11.1） | **`:641`** | 漂移 +6（§9.E · E10） |
| `GET /api/prize-item` / `GET /api/shard` | `:546` / `:687` | **`:552` / `:693`** | 漂移 +6（**prize-item 仍 = 保留面非 sunset**，§5.6） |

**★ `auth.ts` 锚点现取刷新（本单新增面 · 旧无记载）**：`import { verifyMessage } from 'ethers'` **`:2`**；`AuthChallengeRecord.message` 字段 **`:52`**；`activeAuthChallenges` **`:60`**；`buildWalletSignMessage` **`:110`**；`startWalletAuthChallenge` **`:141`**（`message` 构造 **`:156`**、落 Map **`:158-163`**、`challenge_token` **`:165`**）；`consumeWalletAuthChallenge` **`:182`**（record get **`:210`**、`verifyMessage` **`:221`**、`Invalid wallet signature` **`:223`**、地址比对 **`:226`**、`Signature does not match the claimed address` **`:227`**、`delete` 消费 **`:230`**）；`createSessionToken` **`:237`**。

**★ 不变项复核（四项 · v1.1 现取）**：

| 不变项 | 现取读数 | 真源（现取） |
|---|---|---|
| **注册点** | **65** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` |
| **已落 `410` 面** | **6/6** | `src/index.ts:1025` / `:1029` / `:1033`（`admin/task/{create,update,delete}`）+ `:1037` / `:1044` / `:1051`（`admin/prize/{create,update,delete}`）⇒ 六条**逐条在位**（**行号 v1.1 现取**；v1.0/§1.4 旧读数整体 −6 前的同六条） |
| **`Σ(cid=1)` / `ledger_entry`** | **1,989,693** / **267**（**Δ=0**） | **转引** `docs/audit/p5-sig-verify.md §4 ⑨`（**本册零库连接**；同单 §5.3 另证 `asset_absent=true`） |
| **kind 关闭集** | **20** | `backend-ts/src/ledger.ts:153-160`（`LEDGER_KINDS`，**本册现取**：`grep -o "'[a-z_]*'"` 计数 = **20**）；`migrations/0003_kind_close_set_20.sql:65-66` |

- **口径**：**行号口径由「五分」升为「六分」**（v0.1 live / 批 2 末态 / 批 3a 末态 / 批 3b 末态 / v1.0 现取 / **v1.1 现取**）；§0.2-9「任何逐行断言前必须现取」不变。
- **留痕声明（写死）**：**§1.12 上表全部读数**（`1645` 行 / `:1359`…`1161` 族）与 **§0 端点锚口径行、§1.8 v0.9 追加块**的注册行号 = **v1.0 及更早时点读数 ⇒ 一律历史留痕，不得当现盘使用**；判据取本块「v1.1 现取」列。
- **本单不改任何代码**（`backend-ts/**` 只读：`grep` / `grep -c` / `wc -l` / `sed -n`）。

### 1.14 ★★ v1.8 注册点 65 → 68 全量回写（**v1.8 新增 · 本节只追加；九处上位行一字未动**；**编号接 v1.1 的 §1.13「运行依赖登记」之后**）

> **依据** = **Zang §5.162 C / D**（`docs/seafood.master-plan.md:1439` / `:1443`：派单「**① 注册点 65→68 全量回写**（含 §4 表两行 `未注册` ⇒ `已注册（src/index.ts:633）`、三条消费点行、并注明「**`ShardPage.jsx:303` 已不存在** = 旧行号转抄错误」）；② 脚本类硬门口径；③ 两条前端纪律；④ 400 形状口径」）。**质检方给出的九处应改行号（`:419 / :544 / :593 / :623 / :483 / :524 / :539 / :765 / :770`）本册一律自行现取复核、逐处相符，未转抄**（L7②见 `docs/seafood.master-plan.md:1435`）。
> **★ 只追加口径（写死）**：九处**一律不改字** —— 「就地加注」与「**删除列 = 0**」在同一行内**结构冲突** ⇒ **取机器判据优先**（同 v1.5 补注块 ⑳「§7-32 行未改」、v1.7 补注块 ㉓）。**旧写法逐字引在下表第二列 ⇒ 留痕成立**；**读那九行时以本表第三列（v1.8 读数）为准**。

**★ 计数真源（本册现取 · 命令逐字 · 退出码不取管道之后）**：

| 项 | 命令 | **本册现取（v1.8）** | 独立质检亲数（**转引** L7①） | 旧读数（留痕） |
|---|---|---|---|---|
| **注册点合计** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68** | **68** ✓ | v1.1 记 `65`（§1.12）/ v1.2 记 `67`（§10.7）/ v1.3 起 `:2511` 行仍写 `67` / v1.6·v1.7 的 Z6 文字写「`68` 不变」（**预期值，非现取**） |
| **GET** | `grep -cE "^\s*app\.get\(" backend-ts/src/index.ts` | **27** | 27 ✓ | — |
| **POST** | 同模式 `app\.post\(` | **38** | 38 ✓ | — |
| **PUT** | 同模式 `app\.put\(` | **0** | 0 ✓ | — |
| **PATCH** | 同模式 `app\.patch\(` | **1** | 1 ✓ | — |
| **DELETE** | 同模式 `app\.delete\(` | **2** | 2 ✓ | — |
| `wc -l` | `wc -l backend-ts/src/index.ts` | **T1 = 1981** / **T2 = 2047**（见下表后注） | —（L7① 未给） | v1.0 记 `1645`（§1.12）/ v0.9 记 `1575` |

> **★★ 并发写者与「两次现取」（写死 · 必读）**：`backend-ts/src/index.ts` **正被并发单元（Kong · 收口五）改写**（本册开工时工作树已含其未提交改动）⇒ **本册做了两次现取**：**① T1（首次现取）= 注册点 `68` / `wc -l` = `1981` / `/api/user/ledger` = `:633`**；**② T2（复取 · 时间戳 `2026-10-02T15:34:31+0800`）= 注册点 `68` / `wc -l` = `2047` / `/api/user/ledger` = `:656`**。⇒ **★ 材料事实 = 「`/api/user/ledger` 已注册」且「注册点 = 68」，两次读数一致、稳定**；**行号锚点随写者漂移 ⇒ 一律以现盘为准**（§0.2-9「任何逐行断言前必须现取」**不变**）。**本册按派单 / 裁定记 `:633`（= Zang §5.160 B 亲核值），并同时给出 T2 现取 `:656`** —— **两值都留、不择一埋掉**。

> **★ 68 的取得口径（写死 · 防误读）**：**本册现取**（`grep -cE` 直数）；**与独立质检亲数 68 逐 verb 相符**（get 27 / post 38 / put 0 / patch 1 / delete 2）。**v1.1（65）→ v1.2（67）→ v1.8（68）的每一步本册只证 68**；中间步**转引**各册记载（**不得**据任一旧值反推）。
> **★ 未测项**：**批 7-A 新增的注册点具体是哪一条**（`67 → 68` 那一步的路径名）**本册未取证 ⇒ `NOT_MEASURED`**（理由 = 派单未给该锚点、本册不做 `git log -p` 归因；**不得自编路径名**，登记 §8.20.2-①）。

**★ 九处应改行号 · 逐处现取复核（行号 = **v1.7 时点**；本册逐处 `sed -n '<N>p'` 亲读）**：

| # | v1.7 行号 | v1.7 原文（**逐字节选 · 留痕**） | **v1.8 读数（本册现取）** | 所在节 |
|--:|---|---|---|---|
| 1 | `:419` | `已注册路径表：grep -nE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts ⇒ `**`65 行`**`（★ v0.9 现取复核 = 65；旧写法（留痕）：「53 行」）` | **68 行**（`grep -nE` **同模式**现取 = **68 行**，与 `grep -cE` 口径一致） | §1.8「扫描口径」 |
| 2 | `:483` | `- 注册点 53 → 65（+12）：grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' … 本册现取 = `**`65`**`；既有 53 条零删除（…）` | **注册点 65 → 68**（`grep -cE` 现取 = **68**） | §1.8 v0.9 追加块 |
| 3 | `:524` | `\| **Q1** \| **注册面** \| 注册点 **53 → 65**（+12）；src/index.ts **1254 → 1575 行**；本册现取复核 = … = `**`65`**`、wc -l = `**`1575`**`，12 条新行号逐条相符 \| …` | **注册点 = 68**；`wc -l` = **1981 行**（**行号已整体漂移**，v1.0 时点 `1645`、v1.8 现取 `1981`） | §1.10 · Q1 |
| 4 | `:539` | `… ⇒ `**`65`**`；wc -l backend-ts/src/index.ts ⇒ `**`1645`**`（本册现取）。` | **68** / `wc -l` = **1981** | §1.12 |
| 5 | `:544` | `\| 注册点 \| 53 → 65（批 4a） \| `**`65`**`（grep -cE 现取） \| **不变 ✓** \|` | **68**（**v1.8：批 7-A 已注册 ⇒ 65→68**）〔**旧写法留痕 = 本行原文如上**〕 | §1.12 复核表 |
| 6 | `:593` | `\| 注册点 \| 65 \| `**`65`**`（grep -cE 现取） \| **不变 ✓** \|` | **68**（**v1.8：批 7-A 已注册 ⇒ 65→68**）〔**旧写法留痕 = 本行原文如上**〕 | §1.12 v1.1 追加块（**v1.0 → v1.1 对照表 · 首行「注册点」**；物理位置在 §1.13 之后） |
| 7 | `:623` | `\| **注册点** \| `**`65`**` \| grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts \|` | **68**（**命令不变** ⇒ 同一命令现取 = 68） | **「不变项复核（四项 · v1.1 现取）」表 · 注册点行**（v1.1 追加；引名见本册 §8.13.4 ⑦） |
| 8 | `:765` | `\| profile（账本流水） \| /api/user/ledger \| `**`未注册`**`（65 行路径表内 0 命中） \| ProfilePage.jsx:341-350 \| 空态 + 登记、不自造（归批 6/7） \|` | **已注册（`src/index.ts:633`；**T2 现取 = `:656`** —— 见计数真源表后注「并发写者与两次现取」）** —— **批 7-A 接线落地 ⇒ 该行不再是「未注册」**；**前端行号锚点已漂移**（`ProfilePage.jsx` 现 **`376`** 载「流水 = 已注册读口 `GET /api/user/ledger`」） | §4 面表 |
| 9 | `:770` | `★ 判据（可复算 · 复核必跑）：① 上表每一条路径必须在「已注册 `**`65`**` 行路径表」内（§1.12），否则 = 前端在调未注册面 —— 现值 = 仅 /api/user/ledger 与 /api/user/points 两条，且两报告自证前端为「零请求空态」…` | **判据改为「已注册 68 行路径表」**；**`/api/user/ledger` 已注册 ⇒ 不再是缺口** ⇒ **残余 = 仅 `/api/user/points` 一条**（本册现取：`grep -c 'user/points' backend-ts/src/index.ts` = **0**）；**判据②③④ 原文不变**（服务端派生面不传键 / `/api/prize-item` 非 sunset / `/api/shard` 系 sunset） | §4 判据块 |

**★★ 三条消费点行（v1.8 新增 · 批 7-A 落地后 `/api/user/ledger` 的**真实消费面**）：**

| # | 消费点 | 路径 / 口径 | 真源锚点（本册现取） | 备注 |
|--:|---|---|---|---|
| **C1** | **`ProfilePage.jsx`（「我的」· **全流水**）** | `GET /api/user/ledger`（**不带 `kind`** ⇒ 全流水） | `frontend/src/pages/ProfilePage.jsx:19`（`import { fetchMyLedger, LEDGER_PAGE_SIZE } from '../ledger-api'`）/ `:113`（`loadLedger`）/ `:376`（界面注「流水 = **已注册读口** `GET /api/user/ledger`」）/ 取数本体 = `frontend/src/ledger-api.js:32`（`fetchMyLedger`） | **登录闸** = `isAuthenticated`（收口四 R-2） |
| **C2** | **`market/MarketPage.jsx`「账本流水」面板** | `GET /api/user/ledger?kind=transfer` | `frontend/src/pages/market/MarketPage.jsx:369`（`<div className="sf-mkt-panel" data-sf-m="mkt-ledger">`）/ `:123-125`（`fetchMyLedger({ …, kind: 'transfer' })`）/ `:21`（import） | **面板标记 = `data-sf-m="mkt-ledger"`**（行 = `mkt-ledger-item` / 空态 = `mkt-ledger-empty` / 列表 = `mkt-ledger-list` / 翻页 = `mkt-ledger-more`） |
| **C3** | **碎片口径 `?kind=transfer`** | 同 C2（**每次请求都带**） | `frontend/src/pages/market/MarketPage.jsx:125`（`kind: 'transfer'`）；语义来源 = §5.1「碎片读口 ②」 | **取代** sunset 面 `GET /api/shard/transfer`（`ShardPage.jsx:9-10` 注文逐字：批 7-A 该读口语义已由**已注册**路径 `GET /api/user/ledger?kind=transfer` 取代） |

**★ 行号声明（必写 · 防转抄）**：

- **`ShardPage.jsx:303` 已不存在** —— 该行号 = **旧实现**（sunset 面调用面）时点读数，**批 7-A 后 `ShardPage.jsx` 已整体换成薄壳**：**现取 = 19 行**（`wc -l frontend/src/pages/ShardPage.jsx` = **19**），**17–19 行 = `import MarketPage from './market/MarketPage'` + `export default MarketPage`**（本册现取）。⇒ **凡引用 `ShardPage.jsx:303` 的读数 = 转抄错误**，一律作废。
- **`ProfilePage.jsx:341-350`（§4 表旧锚点）亦已漂移** ⇒ **v1.8 现取锚点 = `:376`**（见 C1）。**旧锚点留痕、不删**（同 §1.12「留痕声明」）。
- **行号口径由「六分」升为「七分」**：v0.1 live / 批 2 末态 / 批 3a 末态 / 批 3b 末态 / v1.0 现取 / v1.1 现取 / **v1.8 现取**。§0.2-9「任何逐行断言前必须现取」不变。

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

**★ §2 追加块（v0.9 · A5 新路径键集点名 · 依据 = Zang §5.92 ③）**：`POST /api/job/:jobId/review`（**新路径**，`src/index.ts:1380`）的**成功面键集 = `jobEventView`**（**15 键**，本册现取逐键）：

`job_id`、`status`、`created`、`idempotent_replay`、`txid`、`ledger_idempotency_key`、`escrow_txid`、`settle_txid`、`ledger_event_keys`、`entry_count`、`kinds`、`entries`、`accounts`、`fee_credit_uid`、`submissions_reviewed`

- **真源**：`backend-ts/src/job-funds-service.ts:119` 的 `jobEventView`（**14 键本体**）+ A5 专属 **`submissions_reviewed`** ⇒ **合 15 键**（实测 = 4a 报告 §3 的 A5 行 + QA-B4 §2.3/§4 的 A5 行）。**键数口径细化见 §7-42**（Zang §5.92 记「15 键」= A5 面；本体 14 键）。
- **★ 旧路径 `/api/tasklist/:jID/verify` 的冻结键集（**11 键（approve）/ 9 键（reject）**）不变**（§4.4-17 / §1.9 K9）—— 该键集载体 = `job_application` 读口（9 键 `TaskProgressRecord` + `task` + `user`）。
- **★ 两者不得串（写死）**：新路径入参 = `job_id`；**要产出 11/9 键需服务层反向解析 `job_id → application_id` 的读口**（4a 禁改服务层 ⇒ 未产出；真源 = 4a 报告 §7 事项 1）⇒ **新路径按上列 15 键验收，旧路径按 11/9 验收**。
- **同族各面（逐面计数 · 现取）**：A1 `POST /api/job` = **17 键**（14 键本体 + `employer_uid`/`cid`/`reward`）；A6 `POST /api/job/:jobId/cancel` = **14 键**（无 `submissions_reviewed`）。
- **判据（可复算 · 批 4 复核必跑）**：**把新路径读成 11/9 键、或把旧路径读成 15 键 ⇒ 复核不通过**；**键集冻结母约束 F1 对本条的解释 = 旧路径键集不得变（新路径是新增面，不构成对旧面的变更）**（4a 报告 §3 实测：A4 别名面与既有 `POST /api/task-progress/:identifier/submit` **同 9 键、`identical=true`**）。

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
| S10 | **2a 写口补 `create_key` 的条件性同步项**（v0.6 新增 · 由 **Zang §5.86 裁定①「选项 B」** 的契约边界产生） | **条件触发**：**若**将来前端需要「**同一实体重复提交且内容已变**」（现契约下该动作 = `409 LEDGER_IDEMPOTENCY_CONFLICT` + `details.reason=REPLAY_FINGERPRINT_MISMATCH`）⇒ **必须先传 `create_key`**（`body.create_key` / `Idempotency-Key` 头，`cli:` 前缀；路由侧现取真源 = `backend-ts/src/index.ts:587` 的 `createKeyRaw`，派生/落行 = `src/job-service.ts:133`）。**现状不改**（Zang 裁 A/C 不采纳） | **本册现取**：前端**应用代码面** `create_key\|createKey\|idempoten` 命中 = **0**（`frontend/src` + `frontend/package.json`）；2a 唯一前端写口 `frontend/src/components/ActiveTaskModal.jsx:50` 的 body **仅 `{info_input}`**（`:56-58`，无键、无 `Idempotency-Key` 头）；`frontend/` 全树命中 26 文件**全在 `node_modules/**`**（排除后 = 0）。**本项 = 契约边界提示、非本批必改**（现行为 = 设计内幂等 ⇒ `200 idempotent_replay:true`）。依据 = `p4-aud-jobkey.md §3:186,§4 选项 B:212`；**Zang §5.86 裁定①** |

> **v0.1 §2 已列的前端冻结面差异**（承接，不重复）：`§2.3` 的 `auth.test.js:75`；`§5.2` 的「按调用点删除按钮」清单 —— 本表 S5 与 §5.2 为同一组改动的两种视角（**以本表为准：本表补上了 S1/S2/S3 三条 v0.1 未列项**）。

### 2.5 ★ 前端接线映射表（v1.0 新增 · **页面 ↔ 路径 ↔ 真源行号**）

> **依据** = 派单 delta ⑦。**真源** = `docs/audit/p4-b4c-ii-a-jobs-profile.md`（**171 行**）+ `docs/audit/p4-b4c-ii-b-listings-market.md`（**230 行**）+ `frontend/src/pages/{jobs,listings,market}/**`（**本册现取目录清单**：`jobs/` **5 文件** = `PublishJobPage.jsx`/`JobDetailPage.jsx`/`JobReviewPage.jsx`/`job-api.js`/`jobs.css`；`listings/` **5 文件** = `ListingsPage.jsx`/`ListingDetailPage.jsx`/`PublishListingPage.jsx`/`listing-api.js`/`listings.css`；`market/` **3 文件** = `MarketPage.jsx`/`market-api.js`/`market.css`）。
> **口径（写死）**：**后端行号 = `backend-ts/src/index.ts` v1.0 现取**（§1.12）；**前端落点行号 = 转引 4c-ii-a / 4c-ii-b 两报告**（**本册未跑前端** ⇒ 运行读数一律标「转引」，§8.12.2-44）。**「页面名不得自造」**：两报告自证路由名**全部由已注册 API 路径 + 既有路由族派生**（4c-ii-a §1.3）。

**① 招工线**（真源 = 4c-ii-a §1.1/§1.2/§2/§3）

| 页面（路由） | 调用路径 | 后端行号（**现取**） | 前端落点（`文件:行号`，**转引**） | 幂等键口径（§4.5 v1.0 追加块） |
|---|---|---|---|---|
| `task/new`（发布 J1） | `POST /api/job` | **`:1359`** | `pages/jobs/PublishJobPage.jsx:21-45` · `job-api.js:88-90` | **前端供 `cli:`**（服务端 fail-loud） |
| `task/:jobId`（详情） | `GET /api/task/:tID` | **`:406`** | `JobDetailPage.jsx:29-47` | 无键（读） |
| `task/:jobId`（申请 J2） | `POST /api/job/:jobId/apply` | **`:1375`** | `JobDetailPage.jsx:70-74` · `job-api.js:63-64` | **服务端派生**（`job-service.ts:180`） |
| `task/:jobId`（接受 J3） | `POST /api/job/:jobId/accept` | **`:1397`** | `JobDetailPage.jsx:76-80` | **无键面** |
| `task/:jobId`（提交 J4） | `POST /api/task-progress/:identifier/submit` | **`:593`** | `JobDetailPage.jsx:82-87` | **服务端派生**（`job-service.ts:133`） |
| `task/:jobId`（提交·别名） | `POST /api/job/:jobId/submit` | **`:1422`** | 仅探针验证（4c-ii-a §2 #5） | 同 service verb |
| `task/review`（队列） | `GET /api/tasklist/pending-verification`（+ `/count`） | **`:1095`** / **`:1082`** | `JobReviewPage.jsx:20-33` | 无键（读） |
| `task/review`（通过/驳回 J5/J6） | `POST /api/job/:jobId/review` | **`:1450`** | `JobReviewPage.jsx:35-47` | **事件根键服务端派生**（`migrations/0013_job.sql:592` / `:589`） |
| `task`（列表） | `GET /api/task/all` | **`:394`** | `TaskPage.jsx:231-241`（入口条） | 无键（读） |

**② 商品线**（真源 = 4c-ii-b §1.1；路由挂载 = `App.jsx:20-22` 导入 / `:83-85`）

| 页面（路由） | 调用路径 | 后端行号（**现取**） | 前端落点（**转引**） | 幂等键 / 金额 |
|---|---|---|---|---|
| `listing/new`（上架 P1） | `POST /api/listing` | **`:1492`** | `listing-api.js:65` · `PublishListingPage.jsx:41` | **前端供 `cli:`**（服务端**可派生、非 fail-loud**）／A 类自主出价 |
| `listing/new`（状态迁移） | `PATCH /api/listing/:listingId` | **`:1545`** | `listing-api.js:77` · `PublishListingPage.jsx:56` | 无键面 |
| `listing`（列表） | `GET /api/prize/all` | **`:382`** | `listing-api.js:52` · `ListingsPage.jsx:38` | 无键（读） |
| `listing/:listingId`（详情） | `GET /api/prize/:bID` | **`:433`** | `listing-api.js:55` · `ListingDetailPage.jsx:33` | 无键（读） |
| `listing`（我的商品订单） | `GET /api/prize-item` | **`:546`** | `listing-api.js:58` · `ListingsPage.jsx:53` | 无键（读）· **非 sunset（§5.6）** |
| `listing/:listingId`（购买 P2） | `POST /api/listing/:listingId/buy` | **`:1569`** | `listing-api.js:84` · `ListingDetailPage.jsx:49` | **前端必供**（fail-loud）／金额**服务端取数** |
| `listing`（退款 P4） | `POST /api/listing-orders/:orderId/refund` | **`:1590`** | `listing-api.js:88` · `ListingsPage.jsx:73` | **服务端派生**（`migrations/0015_listing.sql:667`） |

**③ 交易所线**（真源 = 4c-ii-b §1.2；**经 `src/pages/ShardPage.jsx` 薄壳挂在既有 `/shard`**）

| 页面（路由） | 调用路径 | 后端行号（**现取**） | 前端落点（**转引**） | 幂等键 |
|---|---|---|---|---|
| `/shard`（挂单 M1） | `POST /api/order` | **`:751`** | `market-api.js:63` · `MarketPage.jsx:109` | **前端必供**（fail-loud；`market-service.ts:154`） |
| `/shard`（单撤 M2） | `DELETE /api/order/:oID` | **`:805`** | `market-api.js:74` · `MarketPage.jsx:128` | **服务端派生**（`migrations/0016_market.sql:625`） |
| `/shard`（全撤） | `DELETE /api/order`（**query-only、不发 body**） | **`:782`** | `market-api.js:77` · `MarketPage.jsx:139` | 服务端派生（逐单） |
| `/shard`（订单簿） | `GET /api/market/:base_cid/orderbook` | **`:829`** | `market-api.js:52` · `MarketPage.jsx:62` | 无键（读） |
| `/shard`（成交流水） | `GET /api/market/:base_cid/trades` | **`:844`** | `market-api.js:55` · `MarketPage.jsx:63` | 无键（读） |
| `/shard`（我的挂单） | `GET /api/order` | **`:729`** | `market-api.js:45` · `MarketPage.jsx:83` | 无键（读） |

**④ 「我的」**（真源 = 4c-ii-a §1.2/§2 与 4c-ii-b §2②）

| 页面（路由） | 调用路径 | 后端行号（**现取**） | 前端落点（**转引**） | 备注 |
|---|---|---|---|---|
| `profile`（余额） | `GET /api/user/asset/:uID` | **`:489`** | `ProfilePage.jsx:333-351` · `job-api.js:50` | 5 键冻结键集 |
| `profile`（账本流水） | `/api/user/ledger` | **未注册**（65 行路径表内 0 命中） | `ProfilePage.jsx:341-350` | **空态 + 登记、不自造**（归批 6/7） |
| `profile`（积分集合） | `/api/user/points` | **未注册** | 同族（4c-ii-b §2②） | 空态 + 登记 |
| `profile`（碎片持仓） | `GET /api/shard` | **`:687`** | `ProfilePage.jsx`（4c-ii-b §2④ 已**移除调用**） | **sunset 面**（`deprecated:true` + 恒空态） |
| `home`（奖品持有） | `GET /api/prize-item` | **`:546`** | `HomePage.jsx:119`（保留 + `.catch(()=>[])` 空态容忍） | **非 sunset（§5.6）** |

**★ 判据（可复算 · 复核必跑）**：① **上表每一条路径必须在「已注册 65 行路径表」内**（§1.12），否则 = 前端在调未注册面 —— **现值 = 仅 `/api/user/ledger` 与 `/api/user/points` 两条，且两报告自证前端为「零请求空态」**（4c-ii-a §2 #8 / 4c-ii-b §2②）；② **服务端派生面（申请 / 提交 / 审核 / 退款 / 单撤 / 全撤）前端一律不传键**（§4.5 v1.0 追加块）；③ **`/api/prize-item`（`:546`）不得被当 sunset 面处置**（§5.6）；④ **`/api/shard` 系确为 sunset ⇒ 前端调用须全移除**（4c-ii-b 已移除）。

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

> **★★ §3.3 v2.1 就地加注（R107 `message` 字段语义写死 · 2026-10-02 · 依据 = Zang §5.171 C「批 7-E 降级为规范澄清」；**本节正文 1–8 条与 §3.2 / §3.4 / §3.5 一字未动**）**：
>
> **（v2.1 新增条款 9′ · 语义写死 · 可判负）** 对 `{ error: { code, message, i18n_key, details } }` 四键，**语义分工如下（写死，实现方与质检方共同适用）**：
> - **`code` = 机读唯一真源**：调用方**只按 `code` 分支**（§5.17 R-2；§3.5-2）。取值域 = `LEDGER_*` **33 码闭集**（§3.3-7 / `DL147④`；本册现取 `backend-ts/src/ledger-errors.ts` 表内条目 = **33**）或 `AUTH_*` 域（§3.3-6）。
> - **`i18n_key` = 本地化真源**：形如 `ledger.err.<CODE>`（真源 = `backend-ts/src/job-service.ts:30` 的 `` `${i18nDomain}.err.${code}` ``；另 `ledger-errors.ts:10-13`），`auth` 域同理 `auth.err.<CODE>`。**本地化只认 `i18n_key`** —— **不得**据 `message` 做本地化，**不得**新增本地化域。
> - **`message` = 人类可读的稳定英文句**：定位 = **日志 / 调试 / 非本地化客户端**的可读串；**必须**是人类可读文本、**必须**稳定（同一 `code` 同一语义，不得漂移成机读码）。
> - **★ 严禁把机读码填进 `message`** —— 机读码（`LEDGER_*` / `AUTH_*` 一类「全大写下划线码」）**只准进 `code`**；`details.reason` 是**机读面**（§3.5-2），**不得**被当人类可读文案。违反 ⇒ **判负**（本仓现有反例 = 退款拒收回执 `message = 'LEDGER_CURRENCY_INVALID_TRANSITION'`，**F-1 真体**，见 §16.2）。
>
> **★ 存量偏离声明（写死 · 非阻塞）**：上列语义对**本仓既有实现**构成偏离（`fail` 第 4 参缺省 / `fromLedgerError` / `sendAuthError` / `sendError` 同族）⇒ **全部登记为存量技术债、分批实现、非阻塞**（清单 = **§15.5**；证据 = **转引** `docs/audit/p7-a-ledger-read-fix2.md §5` 的 26 处逐条判定表）。**已测面 = 前端护栏已将「机读码当文案」抑制 ⇒ 用户可见面已干净**（§14.3 v2.1 加注 / §16.3）。
>
> **★ 正向约束（v2.1 新增 · 类级可判负门）**：**新增错误面（新端点 / 新分支 / 新码）不得把码塞进 `message`**（详见 **§15.6**）。

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

### 3.5 ★ 错误体口径约束（**D1''** · v1.0 新增 · 依据 = **Zang §5.102**）

> **裁定逐字（Zang §5.102）**：「**真缺口 D1''（已实测）**：驱动**恒不搬运 `DETAIL`/`constraint`** ⇒ `409` 体带 `details.detail_unavailable='driver_did_not_carry_detail'`（**12/12**）⇒ **我裁定：规格不得依赖 `detail`，API 用项目级 `reason`；交 Jing v1.0 写入**」。真源 = `docs/audit/p4-err-fidelity.md`（**218 行**；**本册转引、未连库**）。

**本册口径（写死 · 全册适用）**：

1. **规格不得依赖 DB `DETAIL` / `constraint`**：任何**期望码 / 判据 / 复核判据**不得写成「看 `details` 里的 `DETAIL` 文案」或「看 `constraint` 名」—— **驱动层不搬运它们**（`@neondatabase/serverless` 的 `DETAIL` 不进入对外 `details`；**12/12 端到端 `409` 体实测**）。
2. **API 一律用项目级 `reason`**（机读、大写、稳定）：错误的**可判别部分** = **`error.code`**（`LDxxx` 或非账本域码）+ **`details.reason`**（+ 必要的 `field` / `ref_type` / `ref_id`）。
3. **`detail_unavailable` 是「合法登记项」，不是错误**：当某处语义本应靠 DB `constraint`/`DETAIL` 表达时，响应体以 `details.detail_unavailable = 'driver_did_not_carry_detail'`（**12/12 实测**）**显式登记**，并**由项目级 `reason` 承担可判别性** ⇒ **不得**把它读成「信息丢失 = 判负」，也**不得**据此新造码 / 新造 `reason`。
4. **与既有条文的关系（不冲突 · 同立场补强）**：§3.3-2 早已**禁止**把 **SQL / 约束名 / 堆栈**放进对外 `details`（`R107`）⇒ 本条是**同一立场的取证面补强**（「不搬运」是**结构性**的、不是纪律）；§3.3-4 的「不得吐未映射的原始 SQLSTATE」不变。
5. **判负（必带）**：复核时**以 `constraint` 名或 DB `DETAIL` 文案作为判据** ⇒ **复核不通过**（该判据在本仓**不可执行**）。
6. **`NOT_MEASURED` 边界**：本仓**不落请求级 access log**（§3.4 / §7-24）；D1'' 的读数为 **12/12 端到端 `409` 体** —— **本册转引** `p4-err-fidelity.md`，**未复跑**（§8.12.2）。
7. **与 D1 的区别（写死 · 防混批）**：**D1（「驱动丢码 ⇒ 归 500」）已由 Zang §5.102 勘误作废**（驱动**不丢码**：`LD0nn` 与标准 SQLSTATE 同形、`code` **逐字正确**）⇒ 见 **§4.11.2**；本条（D1''）**只**约束「`DETAIL`/`constraint` 不得作为判据」。

### 3.6 ★★ 新硬规则：**登录必须验签**（EIP-191 `personal_sign`）（**v1.1 新增 · 依据 = Zang §5.106**）

> **依据** = **Zang §5.106**（派单 delta ①）；**实现与取证** = `docs/audit/p5-sig-verify.md`（单号 **SIG-VERIFY** / 角色 Kong / **164 行** / run tag `b5sv-20260930T231433`，**本册转引、未复跑**）。**锚点全部为本册现取**（`backend-ts/src/auth.ts` / `src/index.ts`）。

**规则（写死）**：`POST /api/auth/verify`（`src/index.ts:354`）内的 `consumeWalletAuthChallenge`（`src/auth.ts:182`）**必须**：

1. 用 **EIP-191 `personal_sign`** 对**签发时给出的那份原文消息**做**公钥恢复** —— 原文 = `challengeRecord.message`（**与 challenge 同存**：字段 `src/auth.ts:52`、构造 `:156`、落 Map `:158-163`），恢复调用 = `verifyMessage(challengeRecord.message, signature)`（`src/auth.ts:221`，`import { verifyMessage } from 'ethers'` = `:2`）；
2. 把恢复出的地址与**声明地址**做**大小写不敏感**比对 —— `recoveredAddress.toLowerCase() !== challengeAddress`（`src/auth.ts:226`）；
3. **不匹配 / 签名非法 ⇒ `401`** —— 经既有出口 `sendError(res, 401, error.message)`（`src/index.ts:379`）产出 **`401`**；两条文案逐字 = **`Invalid wallet signature`**（`src/auth.ts:223`，恢复抛异常分支）/ **`Signature does not match the claimed address`**（`src/auth.ts:227`，地址不匹配分支）。

**四条判据（硬 · 任一 FAIL ⇒ 该面复核不通过）**：

| # | 判据 | 期望 | 证据（**转引** `docs/audit/p5-sig-verify.md §4`；真 HTTP + 真库，`pre`/`post` 同脚本同口径） |
|--:|---|---|---|
| ① | **真签名**（探针内新造私钥签真 challenge） | **`200`** + `token_present:true` | §4 ①/⑤（改前改后均 `200`） |
| ② | **垃圾签名**（`0xdeadbeef`） | **`401`** `message:"Invalid wallet signature"` | §4 ②（**改前 `200` + 真 JWT ⇒ 改后 `401`**；本单核心回归判据） |
| ③ | **他人签名**（B 私钥签 A 的 challenge ⇒ 地址不匹配） | **`401`** `message:"Signature does not match the claimed address"` | §4 ③（改前 `200` ⇒ 改后 `401`） |
| ④ | **重放**（同一 challenge 第二次投递） | **`401`** `message:"Challenge has been consumed or expired"` | §4 ④（改前改后**保持 `401`**，**不得削弱**） |

**★ 两层关系（写死 · 不得互推）**：
- **token 层 = P4-SEC**（`challenge_token` 的 HMAC 验签 / `typ` 校验 / `exp` 过期 / 兜底密钥已移除）—— **管「带没带一张合法票据」**；
- **签名层 = P5-SIG-VERIFY（本单）**（对**原文消息**的 EVM 恢复与地址比对）—— **管「这张票据是不是地址主人自己换的」**；
- **两层各管一段**：token 层通过 **≠** 签名层通过（本单修复前正是「token 层通过、签名层**空缺**」⇒ 任意地址 + 任意垃圾签名换真 JWT = **完整身份冒充**）；反之签名层通过也不得替代 token 层。

**★ 顺序即语义（写死）**：验签**先于** nonce 消费 —— **`:221`（验签）在 `:230`（`activeAuthChallenges.delete`）之前** ⇒ 坏签名**不消费** challenge（合法用户一次误签不打掉自己的 nonce）；成功路径仍 `delete`（**单次消费语义不变**）。反证 = 审计件 §4 AC-S1。

**★ 零新增面（写死）**：**不新造错误码 / 不新造 `reason` / 不新造 `kind` / 不改任何 SQL** —— 两条新文案走**既有** `sendError` 401 出口，与邻近 `auth` 面 401（如 `evm_address, signature and challenge_token required` `src/auth.ts:192`、`Challenge address mismatch` `:206`、`Challenge has been consumed or expired` `:212`）**同形同层**；`401/403` 若要并入 §3.4 的 `R107` 统一面，属**另一件事**（**本单不裁、不新立收口项**）。

- **判负（必带）**：① 验签**先消费后比对**（把 `delete` 提到验签之前）⇒ **复核不通过**（坏签名会误消费 challenge）；② 用**重算**原文代替**签发时同存的原文**（模板漂移时在途 challenge 静默全废）⇒ **复核不通过**（本条即「同存」的立法理由，审计件 §5.2）；③ 比对用**大小写敏感**（校验和变体被误杀）⇒ **复核不通过**（判据 ① 的 `lower` 申领 / `checksum` 提交用例）；④ 以「token 层已验」为由省略签名层 ⇒ **复核不通过**（两层关系条）。
- **`NOT_MEASURED`**：「**过期 challenge ⇒ `401`**」专项 = **`NOT_MEASURED`**（需 ≥300s 等待或改未授权常量）；该分支由**未改动**的 `verifySignedToken` `exp` 检查覆盖（审计件 §5.7 / §6；本册未复跑）。
- **前身关系**：同端点上一单 **B5-FIX-LOGIN**（`docs/audit/p5-fix-login.md`）解决的是**取余额口径**（§3.7）；该单 §6.3 逐字登记「签名内容不校验」为**既有行为、该单不修** ⇒ 本条正是它的**收口**。

### 3.7 ★ 登录端点取余额口径（`getUserAsset ∥ emptyAsset`）（**v1.1 新增 · 依据 = Zang §5.105**）

> **依据** = **Zang §5.105**（派单 delta ③）；**实现与取证** = `docs/audit/p5-fix-login.md`（单号 **B5-FIX-LOGIN** / **159 行** / run tag `b5l-20260930T145112Z`，**本册转引**）。**锚点本册现取**。

**规则（写死）**：`POST /api/auth/verify`（`src/index.ts:354`）的取余额步骤 = **`(await DatabaseService.getUserAsset(uID)) || DatabaseService.emptyAsset(uID)`**（`src/index.ts:364`）——

1. **只读账本真源 `account`**：`getUserAsset`（`src/database.ts:861`，纯读 `account WHERE uid AND cid=1`）；
2. **无行 ⇒ 空态 0**：`emptyAsset(uID)`（`src/database.ts:879`，零值 + 完整键集 `{index_id,uID,points,lucks,time_update}`）⇒ **无 `account` 行的新 EVM 钱包 ⇒ `200` + `points = 0`**（**不是 `401`**）；
3. **不得回退到写 `asset` 表**：原 `|| upsertAsset(uID, 0)` 回退（`src/database.ts:889`，`:895 UPDATE asset` / `:910 INSERT INTO asset`）**必须保持摘除** —— 该表 **不存在且永不创建**（`docs/data-layer.spec.md:166`）⇒ 触发即 `42P01`，被本函数 catch 吞成 `401`（**新钱包 100% 登不进站**）；
4. **`42P01` 归零**：登录链**零建表 / 零隐式写库**；账户行由既有账本机制在**首次入账**时建立（**登录事务内不建户**）。

**同族先例（结构一致性）**：读端点 `GET /api/user/asset/:uID` 早已同款收口（`src/index.ts:502` 逐字「P4-B1-a: 纯读端点，禁止隐式写库（原 `|| upsertAsset(uID, 0)` 回退已移除）」）⇒ 本条 = **登录端点补齐同族写法**，**不是新语义**。

- **★ 与 §4.11.1「缺表族」的关系（状态就地说明 · **§4.11.1 原文不改、留痕**）**：本单口径落地后，**`POST /api/auth/verify` 不再落 `asset` 缺表族受影响面** —— §4.11.1 该行「**需 Kevin 一句话**」对 **verify** 已由本条关闭（该单默认值「不复活、按 sunset 处置」**对登录链已无对象**：登录**不再触该表**）；**`claim` 面的同族残项见 §9.E · E10**。读 §4.11.1 时以本条为准。
- **判负（必带）**：① 重新引入任何 `upsertAsset` / 直写 `asset` / 直写 `account` 的回退 ⇒ **复核不通过**（违 `R1`「零表写入」/ `ledger.spec:821` §13.1「不建第二套账」）；② 把「无行」当错误（`401`/`404`/`500`）⇒ **复核不通过**（正确语义 = **空态 0**）；③ 在登录事务内建 `account` 行 ⇒ **复核不通过**（登录**不是价值事件**：`mint` 会改供给、`entries` 需对腿语义，二者皆错）。
- **`NOT_MEASURED`**：① 改前/改后的 HTTP 读数（`401 → 200`、`points=0`、`42P01_in_body=false`）= **转引**审计件 §3-①；② 前端 `auth/verify` 消费面 = **转引**（本册未跑前端）。

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
| **J1** | 招工发布 + 托管 | `POST /api/job` | `job_post_event(op='publish')`（`0013:431`） | `job_escrow` **×2** | `create_key`(`cli:`)、`employer_uid`、`cid`、`reward`、`title?`、`description?`、`request_fingerprint` | **create_key** = `job.create_key`（UNIQUE）；**事件根键** = `biz:job:escrow:<job_id>`（函数派生，`0013:555`） | 单语句隐式事务：业务行 + 2 条分录**同生同灭**；任何闸失败 ⇒ 整事件回滚（**不留孤儿 job 行**） | `400` LD005/LD016/LD017/**LD021**〔**v0.8 订正：旧写 `LD022`**（依据 = Zang §5.89 裁定①；真源 `ledger.ts:1050`）〕；`404` LD007/LD022；`409` LD001/LD008（未上市，`0013:562-565`）/LD011/LD003 | **批 3b（服务层已落地：`job-funds-service.ts:149` `publishJob`）· 路由层随批 4（§1.8 #1）** |
| **J2** | 申请报名 | `POST /api/job/:jobId/apply`（**路由层随批 4**；service 已实现） | **直 DML**（无分录，R3） | **无** | `job_id`、`worker_uid`、`create_key`(`cli:`) | `job_application.create_key`（UNIQUE）+ `UNIQUE(job_id,worker_uid)`（`0014:91`） | 单语句事务；`job.status<>'open'` ⇒ 拒 | `409` LD011 + `not_open_job`/`self_application_not_allowed`；同键 ⇒ 200 重放；**异键同人** ⇒ `409` LD003 + `application_already_exists`（**不得**让裸 `23505` 落 400） | 批 2（service 已实测） |
| **J3** | 雇主选定打工人 | `POST /api/job/:jobId/accept`（**路由层随批 4**；service 已实现） | **直 DML** | **无** | `job_id`、`application_id`、`actor=employer` | 业务侧：`job_application.status` 状态机 + **部分唯一索引** `uniq_job_application_accepted`（`0014:102`） | 单语句事务；并发「同时选定」由部分唯一索引**结构性**挡 | `403` `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED`（非雇主）；`409` LD011 + `JOB_STATE_INVALID`/`application_already_accepted` | 批 2（service 已实测） |
| **J4** | 提交交付物 | `POST /api/task-progress/:identifier/submit`（:467；**§4.1 新路径 `/api/job/:jobId/submit` 随批 4**） | **直 DML** | **无** | `job_id`、`worker_uid`、`deliverable`、`create_key`(`cli:`) | `job_submission.create_key`（UNIQUE）（`0014:127`） | 单语句事务；`job.status` → `submitted` | `403` `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED`（非打工人）；`409` LD011 + `not_job_worker` | **批 2（HTTP 端到端已实测）** |
| **J5** | **审核通过 → 发放 + 手续费 + 10 级返佣** | `POST /api/tasklist/:jID/verify`（:1000）/ `POST /api/job/:jobId/review` | `job_post_event(op='settle')`（`0013:591-592,632-633`） | `job_payout` **×2** + `job_fee` **×2**（`fee>0` 时）+ `commission` **×2N**（每层减方 `-2` / 增方受益人；`x_L=0` 的层**不建分录**） | `job_id`、`request_fingerprint`；（`gross` = `job.reward`，`worker_uid` 必须已选定） | **事件根键** = `biz:job:settle:<job_id>`（`= commission.ts:119 jobSettleKey`，**只由 job_id 派生**） | 单语句：`job_payout`→`job_fee`→`commission` 全在同一事件；**任一失败 ⇒ 全部回滚**（**不存在「状态 settled 但没发放」**）；重放 ⇒ 不重写业务行 | `409` LD002（在冻不足）/LD011 + `JOB_STATE_INVALID`；`500` LD032（**佣金守恒断言**）/LD030 | **批 3b（服务层 `settleJob` `:218` / `refundJob` `:237` 已落地；既有 `/api/tasklist/:jID/verify` 已改接、单条 SQL 原子；新路径随批 4 = §1.8 #5）** |
| **J6** | 拒绝 / 取消 → 退托管 | `POST /api/job/:jobId/cancel` / `review(reject)` | `job_post_event(op='refund')`（`0013:583-589,624-630`） | `job_escrow_refund` **×2** | `job_id`、`to_status ∈ {cancelled, rejected}` | `biz:job:refund:<job_id>` | 单语句回滚；`escrow_txid IS NULL` ⇒ **拒**（防凭空退款，`0013:618-623`） | `400` LD016 + `not_a_refund_target`；`409` LD011 + `JOB_STATE_INVALID`/`job_escrow_missing` | **批 3b（拒 / 退分支已由既有 verify 路径承载；`/api/job/:jobId/cancel` 随批 4 = §1.8 #6）** |
| **P1** | 商品上架 / 编辑 / 下架 | `POST /api/listing`（**路由层随批 4**；service 已实现 `createListing`/`updateListing`/`transitionListingStatus`） | **直 DML**（`DL99`：无分录） | **无** | `seller_uid`、`cid`、`price`、`stock`、`title`、`create_key`(`cli:`) | `listing.create_key`（UNIQUE）（`0015:131`） | 单语句事务；状态机 `draft→listed→{delisted,frozen}→listed`（`delisted` 终态） | `409` LD011 + `listing_state_invalid`；`400` LD016/LD017 | 批 2（service 已实测 26 条） |
| **P2** | 商品下单（付款即交付） | `POST /api/listing/:listingId/buy` | `listing_post_event(op='buy')`（`0015:449`） | `purchase` **×1** + `sale` **×1**（**恰好两条**，`DL85`） | `create_key`(`cli:`)、`listing_id`、`buyer_uid`、`quantity`、`request_fingerprint` | **create_key** = `listing_order.create_key`；**事件根键** = `biz:listing:buy:<order_id>`（`0015:624`） | 单语句：`listing` 行锁 → `listing_order` 落行 → 2 条分录 → 回写 `pay_txid`；**超卖靠行锁 + `stock>=0` CHECK** | `409` LD001 + `listing_stock_insufficient`/LD008 + `listing_not_listed`/LD011；`400` LD019 + `self_purchase_not_allowed`/LD018/**LD021**〔**v0.8 订正：旧写 `LD020`**（依据 = Zang §5.90 裁定①/D1；真源 `ledger.ts:1049` + `0015_listing.sql:538`）〕；`404` LD022 + `listing_not_found` | 批 3 |
| **P3** | 交付 | （无独立端点） | — | — | — | — | 「付款即交付」：`listing_order.status` 由 `buy` 事件置 `paid` 并回写 `pay_txid` | — | — |
| **P4** | 退款 | `POST /api/listing-orders/:orderId/refund`〔**v0.8 订正·路径格：旧写 `POST /api/listing/order/:orderId/refund`**（依据 = Zang §5.89 裁定②；见 §7-37）〕 | `listing_post_event(op='refund')`（`0015:661-726`） | `purchase_refund` **×2** | `order_id`（**★ v0.7 actor 口径：`actor` = 仅「卖方」`listing_order.seller_uid`**，依据 = **Zang §5.88 裁定②** + 资金从卖方余额出 ⇒ 由出资方发起；真源 = `src/listing-funds-service.ts:62` 的 `REFUND_ACTOR_IS_SELLER_ONLY = true`；「**管理员可发起**」= **后续能力（批 6，随权限模型）** ⇒ **§7-32**） | `biz:listing:refund:<order_id>`（`0015:667`） | 单语句；`status<>'paid'` / `pay_txid IS NULL` ⇒ 拒；**库存不回滚**（`DL62` 未定 ⇒ 不发明，已裁 §7-7） | `409` LD001/LD011 + `order_not_refundable`/`order_pay_missing`；`404` LD022 | 批 3 |
| **M1** | 交易所挂单 | `POST /api/market/order` / `POST /api/order`（:637） | `market_post_event(op='order')`（`0016:393`） | **`hold` ×2**（同 uid 同 cid） | 买单：`create_key`(`cli:`)、`owner_uid`、`side='buy'`、`base_cid`、`quote_cid`、`price`、`amount`；卖单同（`side='sell'`） | **create_key 即事件根键**（`cli:<uuid>`，`0016:545`） | 单语句；冻结额 = 买单 `amount×price` / 卖单 `amount`；`quote_cid` **恒 1**；base≠quote；`currency` 必须 `listed`（`0016:560-565`） | `400` LD016（`QUOTE_CID_MUST_BE_ONE`/`BASE_QUOTE_CID_EQUAL`）/LD017/**LD021**〔**v0.8 订正：旧写 `LD022`**（依据 = Zang §5.89 裁定①；真源 `ledger.ts:1050`）〕；`404` LD007；`409` LD001/LD008 | 批 3 |
| **M2** | 撤单 | `DELETE /api/market/order/:orderId` / `DELETE /api/order/:oID`（:669）/ `DELETE /api/order`（:656，入参走 query） | `market_post_event(op='cancel')`（`0016:618-685`） | **`hold_release` ×2** | `order_id` | `biz:market:cancel:<order_id>`（`0016:625`） | 单语句；释放剩余在冻额（`(amount−amount_filled)×price` / `amount−amount_filled`）；`≤0` ⇒ 拒；状态 `open/partial → cancelled` | `409` LD011 + `MARKET_ORDER_STATE_INVALID`/`market_order_nothing_to_release`；`404` LD022 + `order_not_found` | 批 3 |
| **M3** | 撮合成交 | （撮合服务调用；批 3 新端点） | `market_post_event(op='trade')`（`0016:687-...`） | **`trade` ×4** + **`trade_fee` ×2**（`fee=0` ⇒ 只 4 条） | `buy_order_id`、`sell_order_id`、`taker_order_id`、`amount`、`price`、`fee?` | `biz:market:trade:<taker_order_id>:<fill_no>`（`0016:382`） | 6 条分录同一事件；**成交价必须等于买单限价**（否则拒，`0016:58-63`）；`amount_filled` 单调且 `≤ amount` | `400` LD016 + `TAKER_NOT_A_PARTY`/`MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`；`409` LD001/LD002 | 批 3 |
| **C1** | 自定义积分创建（建单位） | `POST /api/currency`（**已注册**：`src/index.ts:1160`） | **单语句 CTE**（迁移冻结 ⇒ 不新增编排函数）：`src/currency-service.ts` `createCurrencyVerb` + `DatabaseService.createCurrencyWithFee`（一条 `SELECT` = 隐式事务） | `currency_create_fee` **×2**（owner `balance −fee` / `-1` `balance +fee`） | `symbol`、`name`、`decimals`、`owner_uid`（**须 = actor**）、**`fee`（★ v0.4：服务端取数 + 下限校验，`FIX-B` 已落地，见 §4.4-11）**——未传 ⇒ 服务端常量，传值须 `≥ 下限` | 调用方 `create_key`/`idempotency_key`/`Idempotency-Key`（`cli:`/`biz:`/`ops:`/`cm:`）；**缺省派生** `biz:currency:create:<symbol>` | 单语句隐式事务：业务行 + 2 条分录**同生同灭**（**实测**：余额不足 ⇒ `currency` 插入整条回滚、**无孤儿行**）；门控 CTE ⇒ 重放 / 符号占用 / 越权**一律零分录** | `401` AUTH_UNAUTHORIZED；`403` AUTH_FORBIDDEN(+`ACTOR_NOT_ALLOWED`)；`400` LD005/LD016/LD017/**LD017**(`LEDGER_AMOUNT_NOT_POSITIVE`+`BELOW_SERVER_FLOOR`)〔**v0.8 订正：旧写 `LD018`**（依据 = Zang §5.90 裁定①/D2；真源 `ledger.ts:1046`）〕；`409` LD001/LD003/LD033 | **批 3a（已落地 · 真收官）** |
| **C2** | 上市 → 收上市费 + **消耗保证金** | `POST /api/currency/:cid/list`（**已注册**：`src/index.ts:1179`） | **单语句 CTE**：`src/currency-service.ts` `listCurrencyVerb` + `DatabaseService.listCurrencyWithDeposit` | **★ Zang §5.81 最终口径（v0.4 已兑现 = FIX-B 落地）**：上市费 `currency_create_fee` **×2** → `-1`（消耗）+ 保证金 `listing_deposit` **×2** → **贷 `uid = -1`**（**上市即消耗**）。**4 腿全在 `balance`、`frozen` 零变动**（§1.7 H3）。**不可退、无退还 kind（`listing_deposit_refund` 不存在）、无罚没** | `cid`、`actor`（**必须 = 该币 `owner_uid`**）、**`fee`/`deposit_amount`（★ v0.4：服务端取数 + 下限校验，`FIX-B` 已落地）**——未传 ⇒ 服务端常量 | 调用方键优先；**缺省派生** `biz:currency:list:<cid>` | 单语句隐式事务；状态迁移 `draft→listed` **必须同事务写 `currency_status_log`**（**实测** +1 行）；保证金不足 ⇒ 状态/审计/分录**三零残留** | `401`；`403` AUTH_FORBIDDEN + `reason=ACTOR_NOT_ALLOWED`（`condition=not_currency_owner`）；`400` LD005/LD017/**LD017**(`BELOW_SERVER_FLOOR`)〔**v0.8 订正：旧写 `LD018`**（同 C1；真源 `ledger.ts:1046`）〕；`404` LD007（含 `cid<=0`）；`409` LD001/LD003/LD011(`LEDGER_CURRENCY_INVALID_TRANSITION`) | **批 3a（已落地 · 真收官；★ FIX-B 已把保证金改为消耗入 `-1`、金额改服务端取数）** |
| **C3** | 退市 / 罚没 | **（P3 无此动作 ⇒ 不建端点）** | — | **无** | — | — | **★ Zang §5.81 + `DL67`(`data-layer.spec.md:454`) / `DL88`(`:530`) / `DL91`(`:533`)：P3 退市「**无账务动作**」（保证金已在上市时消耗 ⇒ **不退**）；强制下架**亦无账务动作**（**不存在可罚没的标的物**）⇒ 不退、不罚、不建端点、不建幂等键**；**将来若做「强制下架罚款」= 新语义新 kind，须单独裁定**（见 §7-22） | — | **批 3a（登记：不实现）** |
| **R1** | 邀请绑定（**终身绑定**） | `POST /api/referral/bind`（**路由层随批 4**） | `referral_bind(child,parent)`（`0007:241`） | **无分录**（`DL99`/CR19 明令） | `child_uid`、`parent_uid`（`depth` **不得**作入参，`0007:187`） | 业务侧：`referral` PK(`child_uid`) ⇒ **一 child 一 parent 且不可变**（`0007:67` append-only 触发器） | 单语句；串行化 = `users` 两行 `FOR UPDATE`（uid 升序，`0007:205-206,255-256`） | 同 (C,P) ⇒ 200 重放；C 已绑他人 ⇒ `409` LD003 + `REFERRAL_ALREADY_BOUND`；自指 ⇒ `400` LD016 + `REFERRAL_SELF_BIND`；成环 ⇒ `400` LD016 + `REFERRAL_CYCLE_REJECTED` | 批 2（service）；路由批 4 |
| **R2** | 打工酬金 → 平台费 → **10 级返佣按权重分发** | （由 J5 触发，无独立端点） | `job_settle_plan(...)`（`0013:250`）+ `job_post_event(op='settle')` | `job_payout` `job_fee` `commission` | `fee_rate_bp ∈ [100,500]`（**= 1%–5%**）、`levels ∈ [1,10]`、`weights_bp`（Σ ≤ 10000） | `biz:job:settle:<job_id>` | **最大余数法**：`Σx_L == P` **构造保证**（`D = P − Σq` 按 `(r_L DESC, L DESC)` 补 1）；**分配失败 = 500 defect**（`0013:342-360`） | 见 J5 | 批 3 |
| **R3** | 变更佣金政策（后台可设） | `POST /api/admin/commission_policy`（**路由层随批 4**） | `insertCommissionPolicy`（`commission.ts:240`） | **无分录**（插一行政策） | `fee_rate_bp`、`levels`、`weights_bp`、`effective_from?`、`created_by` | 无（INSERT-only 表；`effective_from` **严格递增**） | 单语句 `INSERT ... WHERE NOT EXISTS(≥ now())`；失败 ⇒ 无行 ⇒ 400 | `400` LD016 + `FEE_RATE_OUT_OF_RANGE`/`POLICY_SHAPE_INVALID`/`WEIGHTS_SUM_EXCEEDS_10000`/`POLICY_WEIGHTS_ALL_ZERO`/`POLICY_EFFECTIVE_BACKDATED` | 批 2（service）；路由批 4 |
| **A1** | 管理员调分（**保留但锁死**） | `POST /api/admin/points/adjust`（:1066） | `ledger_post_event(op='mint'\|'burn')` | `mint` / `burn`（**仅 `$` = cid 1**） | `target_uid`、`cid=1`、`amount`、**必填原因码** | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | 单语句；**禁止**直接 UPDATE `account`；`burn` 受 `R25` 限制 | `403` `AUTH_FORBIDDEN`；`400` **LD021**〔**v0.8 订正：旧写 `LD022`**（依据 = Zang §5.89 裁定①；真源 `ledger.ts:1050`）〕/LD016 + `points_adjust_amount_invalid`/`reason_code_missing`；`500` LD031 | 批 3 |

**★ §4.2 追加块（v0.9 · J5/`review` 面键集点名 · 依据 = Zang §5.92 ③）**：**本条对应上表 J5 行**（其触发端点含 `POST /api/job/:jobId/review`）：

- **新路径 `POST /api/job/:jobId/review` 的成功面 = `jobEventView` 15 键**（逐键见 **§2 追加块**；真源 `src/job-funds-service.ts:119` + A5 专属 `submissions_reviewed`）—— **不是** `job_application` 读口的 11/9 键。
- **既有路径 `POST /api/tasklist/:jID/verify`（同表 J5 行）的 `11 键（approve）/ 9 键（reject）` 冻结键集不变**（§4.4-17）⇒ **两条路径 `200` 语义同、键集不同 ⇒ 不得互推**（把新路径读成 11/9、或把旧路径读成 15 ⇒ 复核不通过）。
- **A6 `POST /api/job/:jobId/cancel`（同表 J6 行新增触发面）** = **14 键**；**A6 权限 = `requireAdmin(review_tasks)`**、**A11 权限 = `manage_settings`**（**Zang §5.92 ②**；**原则 = 复用既有权限键、不新造**；真源 = 4a 报告 §2 + §1.11 Q8）。
- **§4.8 金额来源**：4a 的 `reward`/`price`/`quantity` **一律原样透传、路由层零计算/零默认/零派生**（4a 报告 §2）⇒ 与 **§4.8 / §4.8.4** 一致。

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
6. **币种状态闸**：招工酬金 / 商品标价 / 交易所挂单**只允许 `listed` 单位**（`R28`）；`draft`⇒`409 LD008`、`frozen`⇒`423 LD009`、`delisted`⇒`409 LD010`；**平台/保留 uid 前置闸** ⇒ `400 LD021`〔**v0.8 订正：旧写 `LD022`**（依据 = Zang §5.89 裁定①；真源 `ledger.ts:1050`）〕。**这两道闸必须在路由层先跑**（`DL125`）。**批 2b 落点偏差登记**：商品路径未注册（§1.2）⇒ 闸落在 **service + 单语句 CTE 内**（原子、一次往返），错误码仍一一对应；**待 Zang 复核**（见 §7-17）。
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

> **★★ v0.6 追加块：2a 面幂等键**契约**正式化 = Zang §5.86 裁定①（采纳「选项 B」· 零改码，把过渡口径升为显式契约）** —— **本块只追加；上表 14 行、`ops:` 注、规则段与「校验序」一字未改。**
>
> **契约 1（派生键 = 实体自然标识的单射）**：调用方**未传** `create_key` 时，`resolveJobCreateKey`（`backend-ts/src/job-service.ts:90`）按 `cli:p4b2a:<fallbackParts.join(':')>:<sha256(parts.join('|'))[:16]>` **派生** ⇒ **派生输入只含实体自然标识、不含任何内容字段**。2a 两处落点（**本册现取逐字**）：
>
> - J4 提交：`resolveJobCreateKey(params.createKeyRaw, ['submit', params.identifier, params.workerUid])` —— **`src/job-service.ts:133`**
> - J2 报名：`resolveJobCreateKey(params.createKeyRaw, ['apply', params.jobId, params.workerUid])` —— **`src/job-service.ts:180`**
>
> ⇒ **异标识 ⇒ 必不同键（与内容无关）**；实测库内键真值（`p4-aud-jobkey.md §2.2 db_truth`）：`cli:p4b2a:submit:10:1:ea7b65ad17e2fdc1` ≠ `cli:p4b2a:submit:11:1:c8ec5abb119e9fe5`、`cli:p4b2a:apply:12:1:02d10f10b9dc5da4` ≠ `cli:p4b2a:apply:13:1:c3a6715c5d024a07`（**同一内容、不同标识 ⇒ 两把键、两行**）。
>
> **契约 2（行为矩阵 · 写死 · 实现方不得自选）**：
>
> | 情形（同一实体标识 vs 内容） | 期望（**冻结**） | 实测 / 真源 |
> |---|---|---|
> | **同标识 + 同内容** | **`200` replay**：`idempotent_replay:true`、**零新增分录**、业务行不重写 | 实测 **T3**（`job_submission +0`）/ **A3**（`job_application +0`）；R106 |
> | **同标识 + 异内容** | **`409`**：码 = **`LEDGER_IDEMPOTENCY_CONFLICT`**、`details.reason = **REPLAY_FINGERPRINT_MISMATCH**`、`details.ref_id` = 该派生键（**响亮拒绝、非静默**；**零落行**） | 实测 **T4**（其 `ref_id` 与 T1 落行键**逐字相同** ⇒ 反证「键不含内容」）；真源 = `src/job-service.ts:156`（409 分支）+ `ledger-errors.ts:33`（`LEDGER_IDEMPOTENCY_CONFLICT` ⇒ 409，§3.2）；同族亦见 `src/listing-service.ts:210`、`src/currency-service.ts:284,410` |
> | **异标识**（**即使内容逐字相同**） | **新实体、落新行**（键不同） | 实测 **T1/T2**（`job_submission` 6→7→8）、**A1/A2**（`job_application` 9→10→11）；全 8 笔 `ledger_entry` 增量 **0**、`account` before=after |
>
> **契约 3（与 3b 的关系 · 判据 = 有无自然键 ⇒ 两套口径自洽）**：**无自然键可用的实体「必须 fail-loud、不派生」** —— **不是**「可派生但选了不派生」：3b 的 **`job` 表无自然键**（`job_id` 是 IDENTITY）⇒ 内容派生**必碰撞** ⇒ J1 取 `resolveJobCreateKeyRequired`（`src/job-funds-service.ts:84`）⇒ **`400`**（`LEDGER_IDEMPOTENCY_KEY_REQUIRED` / `…_INVALID`，§4.4-14）。**2a 两处都有自然标识**（`identifier`/`application_id`（J4）、`jobId`（J2）+ `worker_uid`）⇒ **派生安全**。**判据（可判负）**：**有自然标识 ⇒ 派生；无自然键 ⇒ fail-loud**。
>
> **★ 永久回归项（写死；不得因版本刷新而消失）**：**「同标识 + 异内容」面必须持续为 `409`、不得退化为静默 replay** —— 回归用例 = **T4 形态**（同 `(application, worker)`、异 `deliverable` ⇒ 409 + 零落行）；同族现成判负 = **T1/T2 与 A1/A2**（异标识同内容 ⇒ **都落新行**）。**登记 = §7-28**；审计给出的现成用例见 `p4-aud-jobkey.md §4 选项 B:214`（「本次 §2.2 的 T1/T2 与 A1/A2 即现成判负用例，可固化为回归」）。
>
> **★ 批 4 前端同步项（**条件触发**）= §2.4 S10**：**若**将来前端需要「同一实体重复提交且内容已变」⇒ **必须先传 `create_key`**（现契约下该动作 = `409`）。**现状零改动**：前端**应用代码面** `create_key|createKey|idempoten` **0 命中**（`frontend/src` + `frontend/package.json`）、2a 唯一前端写口 `frontend/src/components/ActiveTaskModal.jsx:50` 的 body **仅 `{info_input}`**（`:56-58`）⇒ **选项 A / C 因「必改冻结前端」已由 Zang 裁定不采纳**（`p4-aud-jobkey.md §3:186,§4:212`）。
>
> **依据锚点汇总**：`docs/audit/p4-aud-jobkey.md`（**248 行 / 21502 字节 / md5 `99f535e0…`**；**T1/T2/A1/A2 ⇒ 均落新行**、**T3 ⇒ replay**、**T4 ⇒ 409**）+ **Zang §5.86 裁定①**（`docs/seafood.master-plan.md:1390-1398`；v0.86 记录 `:2004`）+ 本册 **§1.10**（审计件入册）/**§7-25 / §7-28 / §2.4 S10**。**本单未改任何代码**（`backend-ts/**` 只读、零库连接）。

> **★★ v0.9 追加块（★ 点名 C1 的派生输入 = `symbol` · **依据 = Zang §5.93 ③**；**上表 14 行与 v0.6 追加块一字未改**）**：
>
> **① 建单位（C1）的派生输入 = `symbol`**：上表「建单位（C1）」行的缺省派生键 = **`biz:currency:create:<symbol>`**（真源 = `backend-ts/src/currency-service.ts:82,193`）⇒ **`symbol` = 该实体的自然标识** ⇒ 依 **v0.6 追加块「契约 3」的判据**（**有自然标识 ⇒ 派生；无自然键 ⇒ fail-loud**）⇒ **C1 属「可派生」侧、与契约一致**。
> **② QA-B4 的诚实登记（已由 Zang §5.93 ③ 裁定）**：其 `POST /api/currency` 的**「预期 400 负例」实际 `200` 并自派生键+真实落账 2 条 `currency_create_fee` 分录** ⇒ **不是回归、不是缺陷**（**既有 53 条路径的既有行为**；4a **未改** `src/currency-service.ts`）—— **成因即本条①：C1 有自然标识 `symbol`**。
> **③ 附带口径（写死）**：**C2（上市）的派生输入 = `cid`**（`biz:currency:list:<cid>`，真源 `currency-service.ts:82,299`）⇒ **同属「可派生」侧**；**3b 的 `job`（`job_id` = IDENTITY、无自然键）是唯一 fail-loud 面**（§4.4-14 / §7-25）。
> **④ 与 §7-25 的关系**：本块**只点名 C1/C2 的派生输入**，**不改** §7-25 已定的「选项 B」契约，**不新增**任何口径。

> **★★ v1.0 追加块（★ 幂等键硬规则 = 「**服务端已确定性派生键的面，前端不得自造键**」 · 依据 = **Zang §5.96④ + §5.100 逐面实测**；**上表 14 行与 v0.6 / v0.9 追加块一字未改**）**：
>
> **规则（写死 · 全册适用 · 实现方与前端共同遵守）**：**凡服务端**已确定性派生**幂等键的面**（**事件根键** / **实体自然标识的派生键**），**前端不得自造键**。**理由**：**自造键 = 新标识** ⇒ **重试 / 重投落第二行**（「同标识 + 同内容 ⇒ `200` 重放」的幂等保证失效）。**例外仅一**：**服务端无自然键可用而 fail-loud 的面，前端必须供键**（否则 `400`）。
>
> | 面（§4.2） | 判定 | 真源（`文件:行号`；标「转引」者 = 本册未现取） | 前端行为 | 依据 |
> |---|---|---|---|---|
> | **J1 发布** `POST /api/job` | **前端供键**（`cli:`）—— 服务端 **fail-loud**（无自然键可用 ⇒ 不派生） | `backend-ts/src/job-funds-service.ts:84`（`resolveJobCreateKeyRequired`；缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）**本册现取** | **必传**；**同一次操作重试须复用同一键**，成功后才 `reset()` | §4.4-14；**Zang §5.85 裁定③ + §5.96④** |
> | **J2 申请** `POST /api/job/:jobId/apply` | **服务端派生** | `backend-ts/src/job-service.ts:180`（`resolveJobCreateKey(params.createKeyRaw, ['apply', jobId, workerUid])`）**本册现取** | **不传键** | v0.6 追加块「契约 1 / 契约 3」 |
> | **J3 接受** `POST /api/job/:jobId/accept` | **无键面** | `migrations/0014_job_flow.sql:102`（`uniq_job_application_accepted` 部分唯一索引 + 业务状态机） | **不传键** | §4.2 J3（`R3`） |
> | **J4 提交** `POST /api/task-progress/:identifier/submit`（+ 别名 `POST /api/job/:jobId/submit`） | **服务端派生** | `backend-ts/src/job-service.ts:133`（`['submit', identifier, workerUid]`）**本册现取** | **不传键**（body 仅 `{info_input}`）；**唯一例外** = 「同实体 + 改内容」需求出现时须补 `create_key`（**§2.4 S10**） | v0.6 追加块「契约 2 / 契约 3」 |
> | **J5 / J6 审核** `POST /api/job/:jobId/review`（`settle` / `refund`） | **事件根键服务端派生** | `migrations/0013_job.sql:592`（`biz:job:settle:<job_id>`）/ `:589`（`biz:job:refund:<job_id>`）**本册现取** | **不传键** | §4.2 J5 / J6 |
> | **P2 购买** `POST /api/listing/:listingId/buy` | **前端必供**（服务端 **fail-loud**） | `src/listing-funds-service.ts:111-114`（**转引** 4c-ii-b §3） | **必传**（同操作同键） | 4c-ii-b §3 |
> | **P4 退款** `POST /api/listing-orders/:orderId/refund` | **服务端派生**（事件根键 `biz:listing:refund:<order_id>`） | `migrations/0015_listing.sql:667` | **不传键**（**自造键 = 新标识 = 第二次退款**） | 4c-ii-b §3；上表「商品退款」行 |
> | **P1 上架** `POST /api/listing` | **前端供键**（`cli:`）—— 服务端**缺键可派生**（**非** fail-loud） | `src/listing-service.ts:75-81`（**转引** 4c-ii-b §3；上表「商品上架」行已写「**或函数派生**」） | 供键（同操作同键） | 4c-ii-b §3 |
> | **M1 挂单** `POST /api/order` | **前端必供**（fail-loud） | `src/market-service.ts:154`（**转引** 4c-ii-b §3 / §9.B B11） | **必传** | §9.B B11 |
> | **M2 撤单 / 全撤** `DELETE /api/order/:oID` · `DELETE /api/order` | **服务端派生** | `migrations/0016_market.sql:625`（`biz:market:cancel:<order_id>`） | **不传键**；**全撤不发 body**（query-only，§2.4 S4） | §4.2 M2 |
> | **纯读面**（列表 / 详情 / 我的订单 / 订单簿 / 成交流水 / 我的挂单 / 我的余额） | **无键** | — | **不传键** | 4c-ii-a §2 / 4c-ii-b §3 |
>
> - **逐面实测（真源 = `docs/audit/p4-b4c-ii-a-jobs-profile.md` §2；标「转引」）**：该片**自证「前端零自造键」** —— 新增代码内 `create_key` **只出现在 1 处**（**发布面**），其余写面 body 均为 `{}` / `{info_input}` / `{application_id}` / `{approved}`（`job-api.js:61-79`）；其 §2 #9 实测**服务端派生键真值** = `cli:p4b2a:apply:23:12:a596caa2fd2d3385`（`key_derived_by_server=true`）。
> - **与 §2.4 S10 的关系（不冲突 · 是它的上位规则）**：S10 = **条件触发**项（「同实体 + 改内容」需求出现时才补键）；**本块是其一般化规则**（**派生 ⇒ 不传键**），S10 是该规则在**提交面**的**唯一例外条件**。**A / C 两选项（前端一律供键 / 路由层必填）仍未采纳**（v0.6 追加块「依据锚点汇总」）。
> - **判负（必带 · 追加进 §4.8.3 的族里）**：**在服务端确定性派生键的面上，前端自造键 ⇒ 复核不通过**（判据 = 该面请求体含 `create_key` / `Idempotency-Key`；**现成反证** = `cli:` 自造键会让重试落第二行）。
> - **依据锚点**：**Zang §5.96④**（采信 4b-i 的分歧裁定，逐字：「该面已有服务端确定性派生键，前端自造 `cli:<uuid>` 会把重试变第二行」⇒ 「要求 Jing v1.0 在 §4.5 补『服务端已确定性派生键的面，前端不得自造键』」）+ **Zang §5.100**（4c-ii-a「幂等键逐面声明」完全守住该裁定）+ `docs/audit/p4-b4c-ii-a-jobs-profile.md` §2 / `docs/audit/p4-b4c-ii-b-listings-market.md` §3。**落点表 = §2.5**。**本单不改任何代码 / 不改前端**。

### 4.6 批 2 / 批 3 切分（**实现交付清单**）

| 批 | 交付内容（本册口径） | 理由 | 批 2 实际交付（v0.2 实测） |
|---|---|---|---|
| **批 2** | ① J2/J3/J4（报名 / 选定 / 提交；**无分录**）；② P1（商品上架/编辑/下架；**无分录**）；③ R1 邀请绑定；④ R3 佣金政策插行；⑤ 后台与读口换源：`/api/admin/permissions*`→`admin_role*`、`/api/admin/settings*`→`app_config`（**撤 `settings/reset`**）、`/api/user/all|stats`、`/api/user/profile`、`/api/market/*/candles`、`/api/user/points|ledger`、`/api/referral/earnings`；⑥ `GET /api/task/:tID` miss ⇒ **404**；⑦ `DL155` 收口；⑧ §5 弃用面落地 | **一切资金动作留批 3**（父单定案③）；批 2 的副作用面只有**业务行状态与引用列** | **service 已交付、对外路径随批 4**：`job-service.ts`（J2/J3/J4）、`listing-service.ts`（P1）；**已落地**：`/api/admin/permissions*`、`/api/admin/settings*`、`/api/user/{all,stats,profile}`、`GET /api/task/:tID` miss 404、13 个 `410` 面、401/403→`R107`、`/api/admin/me` 6 键；**`DL155` 早已闭合**（§7-11）；**未注册** = `/api/job/*`、`POST /api/listing`、`/api/referral/*`、`/api/user/points|ledger`、`/api/market/*/candles`（§1.2 + 证据见 §1.4） |
| **批 3** | J1/J5/J6、P2/P4、M1/M2/M3、A1、C1/C2（**C2 = 上市费 + 保证金；★ v0.3 更正口径：保证金 = 消耗入 `-1`**，见 §7-3）、`/api/tasklist/:jID/verify` 与 `/api/job/:jobId/review` 的 approve 分支；全部经 §4.2 的编排函数（**C1/C2 例外：迁移冻结 ⇒ 单语句 CTE**） | 涉及资金守恒、幂等、重放 ⇒ 必须端到端（含 P1/P2 套件回归） | **批 3a（币种面）已交付 22/22 e2e**（§1.6 G1–G5）；**★ FIX-A 已落地**（`ledger.ts` 从 `HOLD_KINDS` 移除 `listing_deposit`（`:178`）+ `0019` 加白 + `/health` 自报 `schema_version=0019`）**批 3a（币种面）= 真收官**（§1.7 H1–H8：`0019`/`0020` 已应用 + C2 4 腿全在 `balance` + 金额服务端下限）；**★ 批 3b（招工资金）= 已交付**（§1.9：`job-funds-service.ts` 330 行 + `database.ts` +3 method + `POST /api/tasklist/:jID/verify` 改接 + DL86 两形态实测 + **注册点 53→53**）；**未交付** = P2/P4、M1/M2/M3、A1 与 §1.8 的 8 条未注册路径 |
| **批 4** | 路径切换（§4.1 目标命名）+ 前端迁移（§2.4）+ 弃用面 410→删除 | 需前端先迁（§5.4） | — |
| **批 6** | 权限种子迁移（数据层补遗）+ `isAdminAddress` 第三真源收敛 + §5.78 的 `NOT_MEASURED` 面补测 | §6.5 顺序依赖 | — |

### 4.7 `LDxxx` 类级订正 + 批 3c（商品资金）已落地事实（**v0.7 新增 · 全部带真源；只追加**）

> **本节只追加**：不动 §4.1–§4.6 任何节的正文（**唯一例外 = §4.2 P4 的 actor 口径，依据 = Zang §5.88 裁定② 明令写入**）；**并发提示**：另一单元（**Kong · 交易所资金 3d**）正阅读 **§4.2 / §4.5 / §1.8 / §3**。

#### 4.7.1 ★★ `LDxxx` 类级订正（`LD023` → `LD022`）+ **类级扫描全表**（依据 = **Zang §5.88 裁定④**）

**扫描口径（可复算）**：`grep -nE 'LD02[0-9]' docs/route-layer.spec.md` ⇒ **v0.6 现取 = 7 行 / 8 处命中**（`LD023` **4 处** = §4.2 **J1 `:534` / P2 `:541` / P4 `:543` / M2 `:545`**；`LD022` **4 处** = §4.2 **J1 `:534` / M1 `:544` / A1 `:553`** + **§4.4-6 `:578`**）。**`LDxxx` = DB 自定义 SQLSTATE 键**，真源 = `backend-ts/src/ledger.ts:1029-1063` 的 `LEDGER_SQLSTATE_TO_CODE`（**33 键**，逐键 ↔ 码名；**与 `migrations/0004` 的 `ledger_sqlstate_of` 两侧必须同步** —— `ledger.ts:1028` 注释逐字）。**状态 ↔ 码**真源 = `src/ledger-errors.ts:28-70`（`LEDGER_ERROR_TABLE`）。

| `LDxxx` | `ledger.ts` 真值（码名） | HTTP 状态（`ledger-errors.ts`） | 语义 |
|---|---|---|---|
| `LD020` | `LEDGER_ACCOUNT_NOT_FOUND`（`:1049`） | **404** | 账户不存在 |
| `LD021` | `LEDGER_RESERVED_UID`（`:1050`） | **400** | 目标账户无效（**平台/保留 uid 前置闸**） |
| **`LD022`** | **`LEDGER_REF_NOT_FOUND`（`:1051`）** | **404** | **关联单据不存在** |
| **`LD023`** | **`LEDGER_UNKNOWN_KIND`（`:1052`）** | **400** | **不支持的账务类型** |
| `LD024` | `LEDGER_TRANSACTION_REQUIRED`（`:1053`） | 500 | 必须包在事务内 |

**逐处判定（命中 8 / 改 4 / 不改 4）**：

| 处（v0.6 行号 · 行） | v0.6 写法 | 该处语义（读法依据） | 判定 | 依据 |
|---|---|---|---|---|
| **§4.2 J1 `:534`** | `404` LD007/**LD023** | 「job 行不存在 ⇒ 关联单据不存在」，真源 = `migrations/0013_job.sql` 3 处 `ledger_raise('LEDGER_REF_NOT_FOUND'`（含 `:503` 同段） | **改** ⇒ `404 LD007/LD022` | **Zang §5.88 裁定④**；`ledger.ts:1051` |
| **§4.2 P2 `:541`** | `404` **LD023** + `listing_not_found` | **明写 `listing_not_found`** ⇒ 关联单据不存在（真源 = `0015_listing.sql` **6 处** `LEDGER_REF_NOT_FOUND`） | **改** ⇒ `404 LD022` | 同上 |
| **§4.2 P4 `:543`** | `404` **LD023** | 退款 `order_id` 不存在 ⇒ 关联单据不存在 | **改** ⇒ `404 LD022` | 同上 |
| **§4.2 M2 `:545`** | `404` **LD023** + `order_not_found` | **明写 `order_not_found`** ⇒ 关联单据不存在（真源 = `0016_market.sql` **5 处** `LEDGER_REF_NOT_FOUND`） | **改** ⇒ `404 LD022` | 同上 |
| §4.2 J1 `:534` | `400` …/**LD022** | `LD022` = **404** 语义 ⇒ 与其所在的 `400` 列表**自相矛盾**；该处 = 「平台/保留 uid 前置闸」（`employer_uid`）⇒ 真值应为 **`LD021`**（真源 = `0013_job.sql:503-505` `LEDGER_RESERVED_UID` + `reason=PLATFORM_EMPLOYER_FORBIDDEN`） | **不改（本单）** | **候补码系本册推定**（未经 Zang 裁定）⇒ 按「**不得自选**」登记 **§7-31** |
| §4.2 M1 `:544` | `400` LD016…/**LD022** | 同上；该处 = 平台/保留 `owner_uid` 闸（真源 = `0016_market.sql:481` `LEDGER_RESERVED_UID`） | **不改（本单）** | 同上（**§7-31**） |
| §4.2 A1 `:553` | `400` **LD022**/LD016 | 同上；`target_uid` 为保留 uid 时（真源 = 同族 `LEDGER_RESERVED_UID`） | **不改（本单）** | 同上（**§7-31**） |
| §4.4-6 `:578` | `400` **LD022**（**平台/保留 uid 前置闸**逐字） | 同上；**该行自己写明是「平台/保留 uid 前置闸」** ⇒ 真值应为 **`LD021`**（`ledger-errors.ts:55` = 「目标账户无效」**400**） | **不改（本单）** | 同上（**§7-31**） |

**改后复算（本册现取 · 口径写死 · 防自指陷阱）**：**在「期望码」面内** —— 命令 `grep -nE '^\| \*\*(J1|P2|P4|M1|M2|A1)\*\*|^6\. \*\*币种状态闸' docs/route-layer.spec.md | grep -o 'LD02[0-9]' | sort | uniq -c` ⇒ **`LD022` = 8 处 / `LD023` = 0 处**（**= 4 处已订正 + 4 处待裁**）⇒ **§4.2 / §4.4 面内 `LD023` 已清零**。**全文计数口径（必须分开报）**：`grep -c 'LD023'` = **16 行** / `grep -c 'LD022'` = **30 行** —— **其中绝大多数是本节「v0.6 旧写法」的引文**（描述订正必然引用旧字符串）⇒ **判据一律用「期望码面内」计数，全文计数不得当判据**（**这是本单的口径自曝**，见 §8.9.3）。**改动的 4 处逐字与 `ledger.ts:1051` 一致**（`LD022: 'LEDGER_REF_NOT_FOUND'`）。**★ 纪律声明**：本单**只改 Zang 裁定的那一类**（`404 LD023`→`404 LD022`）；**反向同类缺陷（`400 LD022`，4 处）不擅改** —— 候选码 `LD021` 系**从三处迁移 raise 普查推定**（`0013:503` / `0015:538` / `0016:481` **每文件各 1 处 `LEDGER_RESERVED_UID`**），**给 Zang 一句话即可落**（**现取可行改法：4 处 `400 LD022` → `400 LD021`**）。

#### 4.7.2 退款发起人 = **仅「卖方」**（actor 口径 · 依据 = **Zang §5.88 裁定②**）

- **口径（写死）**：`POST /api/listing/order/:orderId/refund` 的 `actor` = **仅 `listing_order.seller_uid`（卖方）**。**依据 = 资金从卖方余额出 ⇒ 由出资方发起**；**若允许买方单方退款 = 对卖方的单向掠夺向量**（**Zang §5.88 裁定② 逐字口径**）。
- **落点**：**§4.2 P4 的「必需字段」格已就地写入**（本单唯一为裁定而改的 §4.2 单元格）+ 服务层单点 `backend-ts/src/listing-funds-service.ts:62`（`export const REFUND_ACTOR_IS_SELLER_ONLY = true;`，**本册现取**）。
- **「管理员可发起」= 后续能力**：登记 **§7-32**，**归批 6**（随权限模型；§6 权限单一真源落地时一并处理）⇒ **本批不得实现、不得自选**。

#### 4.7.3 批 3c（商品资金）= **已落地**事实（**只登记 + 转引报告；本册不连库、未实跑**）

| # | 事实 | 读数 / 落点（**本册现取者标「现取」，其余转引报告**） | 锚点 |
|--:|---|---|---|
| **B1** | **交付面** | **新建** `backend-ts/src/listing-funds-service.ts` = **317 行**（现取；sha256 `e1948bb667897608c337191c3b62abf65825987fa40b85257850062e2bef2157`，转引）；verb = **`buyListing`（`:191`）/ `refundListingOrder`（`:261`）**（现取） | 报告 `p4-b3d-listing-funds.md §2`（`:57`） |
| **B2** | **两处单点常量（spec 未定义处 · 均「一句话可改」）** | ① `REFUND_ROLLS_BACK_STOCK = false`（**`:55`**，现取）⇒ **退款不回滚 `listing.stock`**；② `REFUND_ACTOR_IS_SELLER_ONLY = true`（**`:62`**，现取） | 报告 `§2`（`:99`/`:103`）；真源 = 同文件 **现取** |
| **B3** | **`src/database.ts` +68/−0** | `listingPostEvent`（**`:1773`**，现取）= **单语句**：`SELECT public.listing_post_event(${…}::jsonb) AS r`（`:1774-1776`，现取）；`resolveListingOrder`（**`:1788`**，现取）**只读**（返回 order 视图，不写） | 报告 `§2`；`src/database.ts` **现取** |
| **B4** | **注册点 53 → 53** | 未增删对外路径；`src/index.ts` 现 **1216 行**（现取）；`from './listing-funds-service'` **导入 = 0**（现取）⇒ 商品 buy/refund 服务层**已实现但未注册**（**§1.8 #9/#10**） | 本册现取；§1.8 |
| **B5** | **报告** | `docs/audit/p4-b3d-listing-funds.md` = **309 行 / 28904 字节**（现取，`wc -l` / `ls -la`） | 本册现取 |
| **B6** | **资金不变量（★ 第四次独立自算）** | **`Σtotal` 恒 `2,000,000`**（pre → post2 **不变**；**Zang 第四次自算、逐位相同**）；`Σbalance = 1,995,998` + `Σfrozen = 4,002`（**转引**逐账户 dump：960000/960000、970000/10000、970001/0、1000000… 口径见报告 §3） | 报告 `§3/§4`（`:115-123`、`:230`）；**Zang §5.88** |
| **B7** | **`ledger_entry` 76 → 86（Δ10，逐 kind 关闭）** | `purchase` **0→2** / `sale` **0→2** / `purchase_refund` **0→2** / **`transfer` 4→8（★ 夹具供资 `fundFromResidual`，已单列，不是买卖事件分录）** ⇒ **4 + 2 + 4 = 10 = Δ 总数** ✅；其余 9 kind 逐位不变 | 报告 `§5③`（`:244-256`）；口径 = **夹具供资单列**（报告 `:242` 探针自曝 3） |
| **B8** | **伪造入参被忽略（服务层 / DB 双向结构保证）** | `P2_buy_spoof_attempt`：请求带 **`price:'1'` / `seller_uid=THIRD` / `buyer_uid=THIRD`** ⇒ **全部被忽略**（`amount = price × quantity` 由 DB 函数从 `listing` 行取：`0015:590`；`seller_uid` 取 `0015:647`；`buyer_uid` 由服务层注入 `String(actor.uid)`，客户端值只留审计痕迹 `client_buyer_uid_ignored`），2 条分录仍正确落在 uid 8/7 | 报告 `§7`（`:175-176`、`:80-82`） |
| **B9** | **7-7 现取状态** | **不回滚**（**仍待 Kevin 一句话可改**；单点 = `listing-funds-service.ts:55`；**观测投影** = 回执含 `stock_rolled_back:false`，改常量即变）；**本单未发明产品决策** | 报告 `§2`（`:99-101`）；**§7-7 / §7 补注块** |
| **B10** | **7-23 现取状态** | 商品面金额下限仍 = **占位常量 `1000`** + 逐条 `TODO: Kevin 定值`（与 §4.4-11 的 `currency-service.ts:140-142` 同口径）⇒ **数值仍待 Kevin** | §4.4-11 / §7-23 |

#### 4.7.4 ★★ `LD001`–`LD033` 全键普查 + **33 键真值表写全** + **8 处期望码格类级订正**（依据 = **Zang §5.89 裁定① + §5.90 裁定①/⑤**）

> **本节 = §4.7.1 的续节（**只追加**，**§4.7.1 / §4.7.2 / §4.7.3 一字未动**）**。**v0.7 自曝的最大未覆盖面**（§8.9.2-26：「类级扫描只扫 `LD02x` 段，**非全 33 键**」）**由本节收口**。**独立质检读数 = `docs/qa/p4-b3-funds-qa.md §6`**（Neng 全键普查 33/33 = PASS；**§4.7.1 旧表只覆盖 5/33**；spec 全程未提及 **9 键**）。**逐条 delta = `docs/audit/route-layer-v0.8-delta.md §D2`**。
> **★ 本单唯一的「非追加」改动 = 就地下表 8 处「期望码格」+ 1 处「路径格」（§4.2 P4）+ 1 个状态列（§7-31）** —— **每一处都保留旧写法**（表格「v0.7 旧写法」列 + 正文内联 `〔v0.8 订正：旧写 …〕` 双重留痕）。依据 = Zang §5.89 裁定①/② + §5.90 裁定①。

**扫描口径（可复算 · 现场命令逐字）**：

```
for i in $(seq -w 1 33); do printf "LD0%s %s\n" "$i" "$(grep -c "LD0$i" docs/route-layer.spec.md)"; done
grep -nE '^\| \*\*(J1|P2|P4|M1|M2|A1|C1|C2)\*\*|^6\. \*\*币种状态闸' docs/route-layer.spec.md | grep -o 'LD02[0-9]' | sort | uniq -c
```

**真源（本册现取 · 逐字）**：`backend-ts/src/ledger.ts:1029-1063` 的 `LEDGER_SQLSTATE_TO_CODE`（**33 键，无缺号**；`LD001` = `:1030` … `LD033` = `:1062`）+ **状态 ↔ 码**真源 `src/ledger-errors.ts:28-70` 的 `LEDGER_ERROR_TABLE`（`:30` = `LEDGER_INSUFFICIENT_BALANCE` … `:69` = `LEDGER_RECONCILE_MISMATCH`）。**两侧键数差 = 0**（QA `§6.1`；本册现取 33 / 33 一致）。

##### 4.7.4.1 ★ 33 键真值表（**全键写全**；`spec 面计数` = v0.7 本体的 `grep -c 'LD0nn'` 现行读数）

| `LDxxx` | 码名（`ledger.ts:行号`） | HTTP（`ledger-errors.ts:行号`） | 语义 | v0.7 spec 面计数 | 路由层使用 / 本册表态 |
|---|---|---|---|---:|---|
| `LD001` | `LEDGER_INSUFFICIENT_BALANCE`（`:1030`） | **409**（`:30`） | 可用余额不足 | 9 | **在用**（§4.2 G2/P2/J5/J6/M1… 期望码格） |
| `LD002` | `LEDGER_INSUFFICIENT_FROZEN`（`:1031`） | **409**（`:31`） | 冻结余额不足 | 2 | **在用**（§4.2 J5/M3） |
| `LD003` | `LEDGER_IDEMPOTENCY_CONFLICT`（`:1032`） | **409**（`:33`） | 同键异内容 | 5 | **在用**（§4.5 追加块「契约 2」+ §7-28 永久回归项） |
| `LD004` | `LEDGER_IDEMPOTENCY_KEY_REQUIRED`（`:1033`） | **400**（`:34`） | 缺幂等键 | **0** | **★ 在用（实测）· 键号面缺口** —— §4.4-14 实测 `J1_neg_no_key ⇒ 400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`；§2.4 S1 的 4 个 `ops:` 写口同族。spec 只写**码名**未写**键号** ⇒ 键号面由本表补登（**补登，非新增口径**） |
| `LD005` | `LEDGER_IDEMPOTENCY_KEY_INVALID`（`:1034`） | **400**（`:35`） | 键格式非法 | 3 | **在用**（§4.2 J1/C1/C2；`PREFIX_REQUIRED`） |
| `LD006` | `LEDGER_IDEMPOTENCY_REPLAY`（`:1035`） | **200**（`:32`） | 重放（**非错误**，R106） | 1 | **在用**（重放语义；**永不进错误分支**） |
| `LD007` | `LEDGER_CURRENCY_NOT_FOUND`（`:1036`） | **404**（`:37`） | 该单位不存在 | 4 | **在用**（§4.2 J1/M1/C2 + §3.1 三类 404） |
| `LD008` | `LEDGER_CURRENCY_NOT_LISTED`（`:1037`） | **409**（`:38`） | 未上市 | 5 | **在用**（§4.2 P2/M1/C1…） |
| `LD009` | `LEDGER_CURRENCY_FROZEN`（`:1038`） | **423**（`:39`） | 合规冻结 | 2 | **在用（未测）**（§4.4-6 三支；库内无该状态行 ⇒ §8.3 未测） |
| `LD010` | `LEDGER_CURRENCY_DELISTED`（`:1039`） | **409**（`:40`） | 已下架 | 2 | **在用（未测）**（同上） |
| `LD011` | `LEDGER_CURRENCY_INVALID_TRANSITION`（`:1040`） | **409**（`:41`） | 状态机非法转移（借码） | 12 | **在用**（§4.2 J2/J3/J4/J5/J6/P1/P2/P4/M2 + §3.2 409 行） |
| `LD012` | `LEDGER_CURRENCY_MISMATCH`（`:1041`） | **400**（`:43`） | 币种不一致 | **0** | **★ 路由层未直接使用** —— 仅 §3.2 的 `400` 行**逐字写了码名**；路由面的「base=quote」由 `BASE_QUOTE_CID_EQUAL`（真源 `0016_market.sql`）承载 ⇒ **键号面属历史缺口、本表补登，不新增口径** |
| `LD013` | `LEDGER_SUPPLY_CAP_EXCEEDED`（`:1042`） | **409**（`:45`） | 发行上限 | **0** | **★ 路由层未使用** —— 仅 §3.2 的 `409` 行**逐字写了码名**；上限闸在账本层 `mint` 面，本批 C1/C2/G1–G6 **未触发** ⇒ 键号面补登；**未测**（§8.3） |
| `LD014` | `LEDGER_UNAUTHORIZED_MINT`（`:1043`） | **403**（`:46`） | 无铸币权 | 3 | **★ 在用但明令禁返回** —— §3.2 逐字「**新面业务路由不得返回 `LEDGER_UNAUTHORIZED_MINT`**」（C6）；v0.3 已从 §4.2 C2 期望码列删除 ⇒ **保留为账本层语义** |
| `LD015` | `LEDGER_HOLD_NOT_ALLOWED`（`:1044`） | **403**（`:47`） | 不支持手动冻结 | **0** | **★ 同上（禁返回）** —— §3.2 逐字「C6 明确禁止再借 `LEDGER_HOLD_NOT_ALLOWED`」⇒ 键号面补登 |
| `LD016` | `LEDGER_AMOUNT_INVALID`（`:1045`） | **400**（`:49`） | 金额格式非法 | 12 | **在用**（§4.2 多行 + §3.2 400 行） |
| `LD017` | `LEDGER_AMOUNT_NOT_POSITIVE`（`:1046`） | **400**（`:50`） | 金额必须 > 0（**亦为「低于下限」借码** §3.2 v0.4） | 5 | **在用**（§3.2 借码行 + §4.4-12；**本单把 C1/C2 的 `LD018` 订正为本键**，见 §4.7.4.3） |
| `LD018` | `LEDGER_DECIMALS_OVERFLOW`（`:1047`） | **400**（`:51`） | 小数位不足 | 3 | **在用**（§4.2 P1/P2）—— **★ 本单把 C1 `:558` / C2 `:559` 的误标改走 `LD017`** |
| `LD019` | `LEDGER_SELF_TRANSFER`（`:1048`） | **400**（`:52`） | 转给自己 | 1 | **在用**（§4.2 P2 `self_purchase_not_allowed`） |
| `LD020` | `LEDGER_ACCOUNT_NOT_FOUND`（`:1049`） | **404**（`:54`） | 账户不存在 | 3 | **在用（404 面）** —— **本单把 §4.2 P2 `:552` 的 `400 … LD020` 订正为 `LD021`**（§4.7.4.3 处 ⑤） |
| `LD021` | `LEDGER_RESERVED_UID`（`:1050`） | **400**（`:55`） | 目标账户无效（**平台/保留 uid 前置闸**） | 8 | **★ 在用（本单新增 5 处期望码格）** —— §4.2 J1/M1/A1/P2 + §4.4-6（依据 = Zang §5.89 裁定① 批准 `LD021`） |
| `LD022` | `LEDGER_REF_NOT_FOUND`（`:1051`） | **404**（`:56`） | 关联单据不存在 | 31 | **在用（404 面）** —— v0.7 已订正 4 处 §4.2 J1/P2/P4/M2；**本单撤掉 4 处误置于 `400` 列者**（§4.7.4.3） |
| `LD023` | `LEDGER_UNKNOWN_KIND`（`:1052`） | **400**（`:57`） | kind 不在关闭集 | 17 | **在用（关闭集闸）** —— v0.7 已订正 4 处；**全文 17 行绝大多数是 §4.7.1 的旧写法引文**（§8.9.3-30 口径） |
| `LD024` | `LEDGER_TRANSACTION_REQUIRED`（`:1053`） | **500**（`:59`） | 必须包在事务内 | 1 | **不用（实现缺陷告警族）** —— 路由层不得主动返回；§3.2 的 `500` 行未列本键 ⇒ 键号面补登 |
| `LD025` | `LEDGER_LOCK_TIMEOUT`（`:1054`） | **503**（`:60`） | 系统繁忙 | **0** | **★ 路由层未使用 · 口径缺口** —— **§3.2「状态码适用条件（逐码）」无 `503` 行** ⇒ 本键**既无键号、也无状态码条目**；属 DB/驱动级 ⇒ **登记为缺口，本册不发明新条文**（§7-34） |
| `LD026` | `LEDGER_TX_TIMEOUT`（`:1055`） | **503**（`:61`） | 系统繁忙 | **0** | **★ 同上（503 家族 · 无 spec 条文）** |
| `LD027` | `LEDGER_DEADLOCK_RETRY_EXHAUSTED`（`:1056`） | **503**（`:62`） | 死锁重试耗尽 | **0** | **★ 同上**；**代码侧在用**：`ledger.ts` 的 `RETRYABLE_SQLSTATES` **含 `'LD027'`**（**本册现取：`backend-ts/src/ledger.ts:1076`** = `new Set(['40001', '40P01', 'LD027'])`；P1i 口径：0005 起 DB 把 `40001`/`40P01` 归一化后抛 `LD027`，裸码不再逃出）⇒ **路由层依赖其可重试语义（间接）** |
| `LD028` | `LEDGER_NEGATIVE_BALANCE_GUARD`（`:1057`） | **500**（`:64`） | 负余额守卫 | **0** | **★ 路由层不得主动返回** —— §3.2 的 `500` 行**逐字列了码名**（R108 告警族）⇒ 键号面补登 |
| `LD029` | `LEDGER_APPEND_ONLY_VIOLATION`（`:1058`） | **500**（`:65`） | 追加写违规 | **0** | **★ 同上（R108 告警族）** |
| `LD030` | `LEDGER_ACCOUNT_GUARD_VIOLATION`（`:1059`） | **500**（`:66`） | 账户守卫违规 | 1 | **在用（500 面）**（§4.2 J5 期望码格） |
| `LD031` | `LEDGER_FEE_RATE_INVALID`（`:1060`） | **500**（`:67`） | 费率配置异常 | 1 | **在用（500 面）**（§4.2 A1 期望码格） |
| `LD032` | `LEDGER_RECONCILE_MISMATCH`（`:1061`） | **`null` ⇒ HTTP 兜底 500**（`:69`） | 对账不一致 | 3 | **在用（500 defect + R108）** —— §4.4-2 / §4.6-2；**非缺陷**（QA `§6.5` 已人工排除） |
| `LD033` | `LEDGER_CURRENCY_SYMBOL_TAKEN`（`:1062`） | **409**（`:42`） | 符号已占用 | 3 | **在用**（§4.2 G2/C1 期望码格） |

##### 4.7.4.2 ★ spec 全程**未提及的 9 键**：逐键表态（依据 = Zang §5.90 裁定①「对 spec 未提及的 9 键逐键表态」）

> **事实（本册现取，可复算）**：`LD004` / `LD012` / `LD013` / `LD015` / `LD025` / `LD026` / `LD027` / `LD028` / `LD029` 在 v0.7 全文中 `grep -c` = **0**（与 QA `§6.1` 的 9 键清单**逐键相同**）。⇒ **不是错误，是协议面覆盖缺口**；下表**逐键给「路由层是否使用 + 理由」**（**本册只补登键号，不新造任何码/状态**）。

| 键 | 路由层是否使用 | 理由（一条一句） | 本册动作 |
|---|---|---|---|
| `LD004` | **是（已实测）** | 缺幂等键 = 路由层**请求侧强校验**的直接产物（§4.4-14 实测；§2.4 S1 四写口） | 补登于 §4.7.4.1；**不新增条文** |
| `LD012` | **否（由同名业务闸承载）** | 「base=quote」在路由面由**业务码** `BASE_QUOTE_CID_EQUAL` 表达（真源 `0016_market.sql`）⇒ 本键属账本层 | 补登；**不改 §4.2 M1 期望码格** |
| `LD013` | **否（账本层铸币闸）** | 发行上限闸在 `mint` 面；本批 C1/C2 全流程**未触发**（§8.3 未测） | 补登；**保持未测登记** |
| `LD015` | **否（明令禁返回）** | §3.2 逐字「新面业务路由**不得**返回 `LEDGER_UNAUTHORIZED_MINT` / `LEDGER_HOLD_NOT_ALLOWED`」（C6） | 补登；**口径不变** |
| `LD025` | **否** | 属 DB/驱动级 503；**§3.2 无 `503` 行** ⇒ 缺口（**本册不发明新条文**） | 补登 + **登记 §7-34** |
| `LD026` | **否** | 同上 | 补登 + **登记 §7-34** |
| `LD027` | **间接（是）** | 路由层**依赖其可重试语义**：`ledger.ts` 的 `RETRYABLE_SQLSTATES` 含 `'LD027'`（同键重试，R60）；`40001`/`40P01` 仅作函数外兜底 | 补登 + **登记 §7-34** |
| `LD028` | **否（R108 告警族）** | §3.2 的 `500` 行**逐字列了码名**（「只允许由不变式被破坏触发，且必须告警 R108」）⇒ 路由层不得主动返回 | 补登 |
| `LD029` | **否（R108 告警族）** | 同上 | 补登 |

##### 4.7.4.3 ★ 8 处「期望码格」类级订正（**就地改 · 每处保留旧写法**；依据 = Zang §5.89 裁定① + §5.90 裁定①/⑤）

| # | 处（v0.7 行号 · 面） | **v0.7 旧写法（留痕）** | 订正为 | 判据（真源） | 依据 |
|--:|---|---|---|---|---|
| ① | §4.2 **J1** `:545` | `400` LD005/LD016/LD017/**LD022** | `400 … /**LD021**` | `LD022` = **404** ⇒ 与所在 `400` 列自相矛盾；该处语义 = **平台/保留 uid 前置闸** ⇒ 真值 `LD021`（`ledger.ts:1050` / `ledger-errors.ts:55` **400**）；raise 真源 = `migrations/0013_job.sql:503`（`PLATFORM_EMPLOYER_FORBIDDEN`） | **Zang §5.89 裁定①** |
| ② | §4.2 **M1** `:555` | `400` LD016（…）/LD017/**LD022** | `400 … /**LD021**` | 同上；raise 真源 = `migrations/0016_market.sql:481`（`LEDGER_RESERVED_UID`） | 同上 |
| ③ | §4.2 **A1** `:564` | `400` **LD022**/LD016 | `400` **LD021**/LD016 | 同上；`target_uid` 为保留 uid 时 | 同上 |
| ④ | §4.4-**6** `:589` | 「平台/保留 uid 前置闸」⇒ `400` **LD022** | ⇒ `400` **LD021** | **该行自己写明是「平台/保留 uid 前置闸」** ⇒ 真值 `LD021` | 同上 |
| ⑤ | §4.2 **P2** `:552` | `400` LD019 + `self_purchase_not_allowed`/**LD018/LD020** | `400 … LD018/**LD021**` | `LD020` = `LEDGER_ACCOUNT_NOT_FOUND` = **404**（`ledger.ts:1049`）⇒ 与 `400` 列自相矛盾（**Neng `§6.4 F1` 新发现**，v0.7 的 `LD02x` 扫描口径**漏了 `LD020`**）；`LD020` 语义在商品买入路径 = 平台/保留买方闸 ⇒ 真值 `LD021`（真源 `0015_listing.sql:538` `PLATFORM_BUYER_FORBIDDEN`）；**`LD018` 保留**（`LEDGER_DECIMALS_OVERFLOW` 是**真 400**，与所在列不矛盾） | **Zang §5.90 裁定①（D1 并入）** |
| ⑥ | §4.2 **C1** `:558` | `LD018(`LEDGER_AMOUNT_NOT_POSITIVE`+`BELOW_SERVER_FLOOR`)` | `**LD017**(`LEDGER_AMOUNT_NOT_POSITIVE`+`BELOW_SERVER_FLOOR`)` | **键↔码名错配**：`LEDGER_AMOUNT_NOT_POSITIVE` 的真键 = **`LD017`**（`ledger.ts:1046`）；`LD018` = `LEDGER_DECIMALS_OVERFLOW`（`:1047`）；代码实际抛码 = `LEDGER_AMOUNT_NOT_POSITIVE`（`src/currency-service.ts` 借码）⇒ **旧写法把两键错位** | **Zang §5.90 裁定①（D2/D6 并入）** |
| ⑦ | §4.2 **C2** `:559` | `LD018(`BELOW_SERVER_FLOOR`)` | `**LD017**(`BELOW_SERVER_FLOOR`)` | **同形（类级）** —— QA 探针的机制只捕捉到 `:558` 一处（`:559` 未带码名），**人工核对补上**（QA `§6.4 F2` 自述） | 同上 |
| ⑧ | §4.2 **P4** `:554`（**路径格**） | `POST /api/listing/order/:orderId/refund` | `**POST /api/listing-orders/:orderId/refund**` | **路径正典**：§1.8 `#10` 已用 RESTful 写法；Zang 定名 = **`/api/listing-orders/:orderId/refund`** ⇒ §4.2 P4 路径格同步（§1.2 的「命名张力」随之关闭） | **Zang §5.89 裁定②** |

**改后复算（本册现取 · 口径写死 · 防自指陷阱）**：**「期望码面」= §4.2 的 8 个事件行 + §4.4-6 行** —— 命令同 §4.7.4 抬头第二条 ⇒ **改前 = `LD022` 8 处 / `LD020` 1 处 / `LD023` 0 处**；**改后（v0.8 现取）** = **「去引文」口径**（把每行 `〔…〕` 的订正留痕剔除后计数）：**`LD021` = 5 处 / `LD022` = 4 处（**全在 `404` 列**）/ `LD020` = 0 处 / `LD023` = 0 处** ✅；**「含引文」口径（同一批行）= `LD021` 5 处 / `LD022` **8** 处 / `LD020` **1** 处 / `LD023` 0 处** —— **差异 100% 来自本单自己的订正留痕**（旧写法就写**在同一行内**）⇒ **「引文污染」第二次出现，且这次落在「期望码面内部」** ⇒ **本册自曝 = §8.10.3-36**。**可复算命令（去引文口径 · Python 单行 · 本册现取输出 `rows matched = 22` ⇒ `{'LD021': 5, 'LD022': 4}`）**：`python3 -c "import re,io,collections;s=io.open('docs/route-layer.spec.md',encoding='utf-8').read();rows=re.findall(r'^\| \*\*(?:J1|P2|P4|M1|M2|A1|C1|C2)\*\*.*$|^6\. \*\*币种状态闸.*$', s, re.M);t=''.join(re.sub(r'〔[^〕]*〕','',r) for r in rows);print(dict(collections.Counter(re.findall(r'LD02[0-9]', t))))"`。**全文计数（`grep -c`）= `LD022` 31 行、`LD023` 17 行、`LD021` 8 行** —— **其中绝大多数是「旧写法引文」**（描述订正必然引用旧字符串）⇒ **判据一律用「期望码面内」计数，全文计数不得当判据**（沿用 §8.9.3-30 的既有口径，本单再次自曝于 §8.10.3）。

##### 4.7.4.4 ★ 本节的**残余未覆盖面**（明写，防误读为「全键已实测」）

- **键号 ↔ 码名 ↔ 状态 三源一致 = 静态取证**（本册现取 `ledger.ts` / `ledger-errors.ts` 原文 + QA 探针 `p4z-qa-b3-04-ld-census.ts` 的 33/33 对拍）；**运行时（HTTP 面）逐键触发验证**只在批 3 已交付面上成立（`LD001`…`LD033` 中路由面实际可触发的子集），**其余 = `NOT_MEASURED`**（§8.10.2）。
- **`503` 家族（`LD025`/`LD026`/`LD027`）在本 spec 内无状态码条文** ⇒ 本册**只登记、不发明**（§7-34）。

---

### 4.8 ★★ 金额来源二分 ⇒ **三分**（**立法** · 依据 = **Zang §5.90 裁定② + §5.91 裁定**；**旧写「二分」留痕**）

**背景（Neng D3 的定性已被 Zang 推翻）**：QA `§4.2` 把「J1 的 `reward` 由客户端 body 原样透传」列为**需登记的例外**；**Zang §5.90 裁定② 推翻其定性**：**招工酬金本就该由雇主自主出价** —— 这是**供给侧自主定价**，**不是缺陷**。**本节的立法目的** = 把「客户端可传的金额」与「必须服务端取数的金额」**写成规则**，使**将来任何新金额字段必须先归类**、不得再靠个案裁量。

#### 4.8.1 ★ 规则（写死 · 实现方与质检方**共同**适用）

1. **A 类 = 客户端可传（供给侧自主业务约定额）**：**只**允许「**出资人自己出的价 / 自己标的价 / 自己挂的限价**」—— 即**改动它只改变该用户自己的风险敞口**，**不可能**改变「钱付给谁」「平台收多少」「对手方收多少」。
   **A 类闭集（当前）** = §4.2 **J1 `reward`**（雇主自主出价）· §4.2 **M1 `price`/`amount`**（限价单条款）· §4.2 **P1 `price`/`stock`**（卖方自定标价与库存）· §4.2 **A1 `amount`**（**管理员意图额**，受 §6 权限闸 + 必填原因码约束）。
2. **B 类 = 服务端取数（平台侧金额）**：**平台费 / 保证金 / 费率及其下限 / 成交额 / 退款额 / 发放额** —— 一律**由服务端或 DB 从权威行取数**；**客户端传值一律丢弃**，必要时**登记为审计痕迹**（`client_*_ignored`）。
3. **归类判据（三问 · 写死）**：拿到一个新金额字段，依次问 ——
   ① 改它是否**只**改变**出资人自己**的敞口？② 改它能否间接改变**平台收入 / 收款人 / 对手方 / 成交价**？③ 客户端传的值是否被服务端**丢弃或降为审计痕迹**？
   **判定**：②答「能」或③答「是」⇒ **必属 B 类**（服务端取数）；三问全为「只影响自己」⇒ 才可入 A 类。
   **强制**：**任何新金额字段必须先在本节表内归类**（登记 = 本表新增一行）；**未归类即实现 ⇒ 复核不通过**（判负项，见 §4.8.3）。
4. **A 类不是「校验宽」而是「语义不同」**：A 类金额**不适用** §4.4-11/12 的「服务端取数 + 下限」；B 类金额**不适用**「客户端必填」。**两类不得互推**（把 A 类改成必填校验、或把 B 类改成客户端可传，**均属回归**）。

#### 4.8.2 逐事件「金额字段 → 归类 → 真源」（`文件:行号`）

| 事件（§4.2） | 金额 / 定价字段 | **归类** | 真源（**服务端取数处**；A 类给**客户端来源处**） | 客户端值的处理 | 依据 |
|---|---|---|---|---|---|
| **J1** 招工发布 + 托管 | `reward` | **A**（供给侧自主出价） | 客户端 body 直传 ⇒ `src/job-funds-service.ts:174-189`；语义 = **业务约定额**（`DL50`：`job.reward` 不是余额/费率） | 直接采用（出资人 = actor 本人，冻结的是**自己的钱**） | **Zang §5.90 裁定②**；QA `§4.2`（**定性已更正**） |
| **J2/J3/J4** 申请 / 选定 / 提交 | —— **无金额字段** | — | — | — | §4.2 J2/J3/J4 |
| **J5** 结算（发放 + 手续费 + 返佣） | `gross` | **B** | `gross = job.reward`，从 **`job` 行**取（`migrations/0013_job.sql:632`） | **客户端零金额入参**（§4.4-13） | §4.4-13 |
| **J5** | `fee` | **B** | DB `job_settle_plan` 由 `f(reward, commission_policy.fee_rate_bp)` 派生；费率唯一真源 = `commission_policy.fee_rate_bp`（`ledger.spec` §14.1 #32；§7-16 读取侧纪律） | 同上（**无该入参**） | §4.4-13；Zang §5.89 裁定② |
| **J6** 拒绝 / 取消 → 退托管 | 退款额 | **B** | 由 DB 从 `job_escrow` 现存托管额取；`escrow_txid IS NULL ⇒ 拒`（`0013:618-623`） | 客户端只传 `to_status` | §4.2 J6 |
| **P1** 上架 / 编辑 / 下架 | `price`、`stock` | **A**（卖方自定标价 / 库存） | 客户端（`src/listing-service.ts:164` `createListing` / `:222` `updateListing`） | 直接采用（卖方对自己的商品定价） | §4.2 P1 |
| **P2** 商品下单 | 成交额（`amount = price × quantity`） | **B** | DB 从 **`listing` 行**算（`migrations/0015_listing.sql:590`）；`seller_uid` 取 `:647` | 伪造的 `price`/`seller_uid`/`buyer_uid` **全部被忽略**（`buyer_uid` 由服务层注入 actor；客户端值只留 `client_buyer_uid_ignored`） | **§4.7.3 B8**（第四方独立实测） |
| **P4** 退款 | 退款额 | **B** | 由 DB 从 `listing_order` 行取；`actor` = **仅卖方**（§4.7.2） | 客户端只传 `order_id` | §4.2 P4；Zang §5.88 裁定② |
| **M1** 挂单 | `price`、`amount` | **A**（限价单条款） | 客户端（`src/market-service.ts:277-281`）；文件头已明记（**非缺陷**） | 直接采用（用户自己的限价）；`quote_cid` **恒 1**、必须 `listed` | **Zang §5.90 裁定②**；QA `§4.2` ② |
| **M1** | `owner_uid` | **B**（身份，非金额） | 服务端 = actor（客户端值丢弃 + 登记 `client_owner_uid_ignored`） | 丢弃 + 登记 | QA `§4.1`（**HTTP 实测 T14**） |
| **M2** 撤单 | 释放额 `(amount − amount_filled) × price` / `amount − amount_filled` | **B** | DB 从 `market_order` 行算（`migrations/0016_market.sql:618-685`）；`≤0 ⇒ 拒` | 客户端只传 `order_id` | §4.2 M2 |
| **M3** 撮合成交 | `price`（成交价）、`fee`、对手方 | **B** | `src/market-service.ts:498-522`（对手方选择）/`:524-527`（定价 = 买单限价）/`:529-537`（费率取数 + 公式 `fee = round(成交额 × bp / 10000)`） | 客户端传 `price`/`buy_order_id`/`sell_order_id`/`fee` **一律丢弃**并登记 `client_inputs_ignored`（`:539-545`） | Zang §5.89 裁定②（A 类采纳） |
| **C1** 建单位 | `fee` | **B** | 服务端常量 + **下限校验**：`src/currency-service.ts:140-142`（`*_FLOOR` = 1000/1000/1000，逐条 `TODO: Kevin 定值`）；`:188` 走服务端取数 | 未传 ⇒ 服务端默认（`200`）；传值须 `≥ 下限`，**低于 ⇒ `400 LD017` + `reason=BELOW_SERVER_FLOOR`** | §4.4-11/12；Zang §5.82 7-23 + §5.84 ① |
| **C2** 上市 | `fee`（上市费）、`deposit_amount`（保证金） | **B** | 同 C1 同源（`:292`/`:294`）；保证金 = **消耗入 `-1`**（不可退，§7-3） | 同 C1 | 同上 + Zang §5.81 |
| **R3** 变更佣金政策 | `fee_rate_bp`、`weights_bp` | **B**（**管理面写入 + 运行时只读**） | 写入端点 = `POST /api/admin/commission_policy`（`src/commission.ts:240`，**权限闸 + `effective_from` 严格递增**）；**运行时计费只读** `commission_policy.fee_rate_bp`（永不读 `app_config`，§7-16） | 管理面入参属**配置写入**，**不得**被任何业务路由复用为计费来源 | §7-16 / §7-23；Zang §5.89 裁定② |
| **A1** | 管理员调分 | `amount` | **②（授权主体意图额）**〔**v0.9 就地更新**：旧写法（留痕）= **A′（待 Zang 复核）**〕 | 客户端传入（`src/index.ts:1066` 既有注册点），**受 §6 权限闸 + 必填原因码约束**；`cid` 恒 1 | 采用（**管理员显式意图额**）；**须权限闸 + 服务端上限校验（`TODO: Kevin 定值`）+ 审计留痕**（§4.8.4） | **Zang §5.91 裁定 = ② 类**〔**v0.9 就地更新**：旧写法（留痕）= **本册分类**；**若 Zang 认定「平台侧金额」应含此项 ⇒ 以 Zang 为准**（原标 `待 Zang 复核`，§7-36）〕⇒ **已收口** |

#### 4.8.3 判负（**必带** · 任一不成立即复核不通过）

1. **B 类字段由客户端决定 ⇒ 判负**：C1/C2 传 `fee=1` / `deposit_amount=1`（< 下限）**必须** `400 LD017` + `details.reason=BELOW_SERVER_FLOOR`（现成判负 = `p4-b3b-currency-funds-fix.md`；真源 `currency-service.ts:140-142`）。
2. **P2 / M3 的伪造入参必须被忽略**：带 `price`/`seller_uid`/`buyer_uid`（P2）或 `price`/`fee`/对手方（M3）**必须** `200` 且**分录落在服务端取值上**（判负 = §4.7.3 B8、`market-service.ts:539-545`）。
3. **A 类字段被改成服务端必填 ⇒ 判负**（回归；例如把 `reward` 改成平台常量 = 改变产品语义）。
4. **新金额字段未在 §4.8.2 归类 ⇒ 复核不通过**（§4.8.1-3 的强制项）。
5. **客户端值被采纳进「受款人 / 平台费 / 成交价」任一栏 ⇒ 判负**（越权向量，最高优先级）。

#### 4.8.4 ★ v0.9：三类定式（**二分 ⇒ 三分** · 依据 = **Zang §5.91 裁定**）

> **本节只追加**：§4.8.1–§4.8.3 的正文（含「二分」措辞与 `A′` 标记）**原样保留为历史留痕**；**读本节时以下列三类为准**。

| 类 | 名称 | 定义（写死） | 客户端值的处理 | 强约束 |
|--:|---|---|---|---|
| **①** | **客户端可传**（供给侧自主约定额） | 改动它**只**改变**出资人自己**的敞口 | 直接采用 | **不适用**「服务端取数 + 下限」（§4.8.1-4） |
| **②** | **★ 授权主体意图额（v0.9 新增）** | **授权主体**（管理员 / 后台角色）**显式表达的金额意图** | **客户端可传** | **必须三条同时成立**：① **权限校验**（§6 单一真源；**复用既有权限键、不新造**）② **服务端上限校验**（**上限值 = `TODO: Kevin 定值`**，**占位非经济值**，**不得由子代理发明**）③ **审计留痕**（每次写入必留 actor + 变更前后值） |
| **③** | **服务端取数**（平台侧金额） | 平台费 / 保证金 / 费率及其下限 / 成交额 / 退款额 / 发放额 | **一律丢弃**（必要时登记 `client_*_ignored`） | 不得由客户端决定（§4.8.1-2） |

- **② 类的闭集（当前）= §4.8.2 的最后一行 A1 `amount`**（`POST /api/admin/points/adjust`，`src/index.ts:1066`；依据 = **Zang §5.91 裁定**）⇒ 该行归类格**已就地更新为 ② 并留痕**。
- **② 与 ①/③ 的区别（写死 · 不得互推）**：**② ≠ ①** —— ② 的意图额会**改变其他账户的净头寸**（增发/销毁）⇒ **必须**过权限闸 + 上限闸 + 审计；**② ≠ ③** —— ② 的意图额**由授权主体表达**，服务端**只做上限约束**、**不得**用服务端常量悄悄替代（否则 = 语义回归）。
- **判负（必带 · 追加进 §4.8.3 的族里）**：② 类金额 **缺权限闸 / 缺上限校验 / 缺审计留痕** ⇒ **复核不通过**（三项逐条判负）；**② 类的上限数值不得由子代理发明**（`TODO: Kevin 定值`，纪律同 §4.4-11/12 与 §7-23）。
- **与 §7-36 的关系**：§7-36 的「唯一 `待 Zang 复核` 项 = A1」**由 Zang §5.91 收口**（= **② 类**）⇒ 该项在**状态列层面已关闭**；**§7-36 行本体不改**（读法与 §7 补注块 ⑪–⑬ 同款）。

> **★ 本节的更正登记（**不改代码**）**：`src/job-funds-service.ts:18-19` 文件头自述「本面 payload **无任何金额入参**」**与代码不符**（payload 实含 `reward`，QA `§4.2` 实测；Zang §5.90 裁定② 要求更正该注释）⇒ **该注释更正归批 4（实现方）**，登记 = **§9 施工清单 · E 栏**。**本册不连库、不改 `backend-ts/**`（只读）**。
### 4.9 ★ 数值定值（v1.0 新增 · **Kevin 2026-09-30 定值** · 依据 = Zang §5.95③ + §5.101）

> **裁定逐字（Zang §5.95③）**：「**7-23 数值（Kevin 授权我定）**：以「1% 佣金下 10 万酬金 ⇒ 1000 手续费」为锚的阶梯，且 `$` **目前无 faucet** ⇒ 现为有量级感的**起始值**、关键是**从占位改成定值 + 留在可配置位置**」⇒ 建币费 `currency_create_fee` = **10,000 `$`**、上市费 `listing_fee` = **10,000 `$`**、上市保证金 `listing_deposit` = **50,000 `$`**、**A1 后台调分单笔上限 = 100,000 `$`/笔**（+ 权限 + 审计；日累计留后续）。

| 项 | 值 | 真源（`文件:行号`，**本册现取**） | 口径 |
|---|---:|---|---|
| 建币费 `currency_create_fee` | **10,000** | `backend-ts/src/currency-service.ts:142`（`CURRENCY_CREATE_FEE_FLOOR = 10000`） | **Kevin 2026-09-30 定值**；**起始值、可配置**（同行注释逐字「起始值：阶梯锥定；`$` 无 faucet ⇒ 待首次铸币后重估」） |
| 上市费 `listing_fee` | **10,000** | `backend-ts/src/currency-service.ts:143`（`CURRENCY_LIST_FEE_FLOOR = 10000`） | 同上 |
| 上市保证金 `listing_deposit` | **50,000** | `backend-ts/src/currency-service.ts:144`（`CURRENCY_LIST_DEPOSIT_FLOOR = 50000`） | 同上 |
| A1 单笔上限 | **100,000**（**绝对值**） | `backend-ts/src/index.ts:1182`（`ADMIN_POINTS_ADJUST_MAX_PER_CALL = 100000`） | 同上；**日累计上限留后续（批 6）**（`index.ts:1181` 注释逐字） |

- **★ 取代关系（写死 · 旧写法留痕）**：本表**取代**本册下列三处的**旧占位读数** —— **§4.4-11 / §4.4-12**（原写「`currency-service.ts:140-142` = **1000 / 1000 / 1000**，逐条 `TODO: Kevin 定值`，**占位非经济值**」）与 **§4.7.3 B10**（商品面「下限仍 = **占位常量 `1000`**」）；**§7-23 的机制面（服务端取数 + 下限校验）不变**（机制在、数值面 = 本表）。**旧读数保留为历史留痕、不得再当现盘使用**（**本册为守「只追加」未改旧文** ⇒ 读者若只读 §4.4-11/12 会看到已失效的 `1000`，**判据一律取本表**；自曝 = §8.12.3-44）。
- **★ 精确行号订正（旧写法留痕）**：三常量的**真名** = `CURRENCY_CREATE_FEE_FLOOR` / `CURRENCY_LIST_FEE_FLOOR` / `CURRENCY_LIST_DEPOSIT_FLOOR`，**行号 = `:142` / `:143` / `:144`**（**本册现取**；旧写法 `:140-142` 系**批 3a 时点读数**，已漂移）。
- **低限语义不变**：`< 下限 ⇒ `400` `LD017`（`LEDGER_AMOUNT_NOT_POSITIVE`）+ `details.reason=BELOW_SERVER_FLOOR`（`{field,value,min}`）`；**未传 ⇒ 服务端默认 ⇒ `200`**（`fee_source=server_default`）。
- **判负（必带）**：**数值改动必须同单回写本表**（否则「规格不得依赖占位」失效）；**实现方不得自选数值**（经济参数属 Kevin）。
- **`NOT_MEASURED`**：数值的**运行时边界 9/9**（`9999 → 400` / `10000 → 200` / `49999 → 400` / `50000 → 200`）**本册转引 Zang §5.96**（NUM-1 验收），**未复跑**（§8.12.2-47）。
- **真源交叉核对（本册现取 · 逐字）**：`currency-service.ts:142-144` 三行**均**含逐字「**Kevin 2026-09-30 定值**」（本册 `sed -n '142,144p'` 现取）⇒ 与 **§5.95③ / §5.96（NUM-1）** 口径一致。

### 4.10 ★ A1 后台调分落定（v1.0 新增 · 依据 = **Zang §5.101**）

> **裁定（Zang §5.101 · A1-LEDGER-IMPL 验收通过）**：`POST /api/admin/points/adjust` **改接账本**（**选 A**）—— **不建 `asset` 表**（与 `data-layer.spec:166/:217`、`ledger.spec:821` 正面冲突 ⇒ 会造**双真源**，且只解 404、不解审计）；**C（删路由退役 #54）仅作 Kevin 不要此功能时的备选**。

| 项 | 落定口径 | 真源（**本册现取**，`backend-ts/src/index.ts`） |
|---|---|---|
| 路由 | `POST /api/admin/points/adjust` | `:1191`（**注册点不变**：`grep -cE` 现取仍 **65**，§1.12） |
| 权限 | **`requireAdmin` 先于金额校验** | `:1192`（函数体**第一条**语句） |
| 金额方向 | **有符号 `amount`**：`> 0` ⇒ `op='mint'` + `platform=true`；`< 0` ⇒ `op='entries'` + **单腿 `kind='burn'`** | 账本侧 = `DatabaseService.adjustPoints`（调用点 `:1244`）；**leg 形状**（`0020:156` 的 op 白名单**无 `burn`** ⇒ 负向取 `op='entries'` + **单腿 `kind='burn'`**）**转引 Zang §5.101**（其亲核 `:963` / `:975` / `:977` / `:989`） |
| 上限 | **±100,000（绝对值）**；`0` ⇒ 拒；越限 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason=OVER_MAX_SINGLE_AMOUNT` | `:1182`（常量）；`:1217-1223`（`0` ⇒ `reason=NOT_A_POSITIVE_INTEGER`）；`:1225-1231`（越限，`details={field,reason,max,provided}`） |
| 保留 uid | `uID < 0` ⇒ **`400 LEDGER_RESERVED_UID`**（`details={field:'uid',uid}`；与 DB 侧 `ledger_uid_arg` 同形状） | `:1207-1213` |
| 库无此用户 | 路由**不调账本、不造幽灵账户** ⇒ **`400 LEDGER_RESERVED_UID`** | `:1246-1254`（`result.user_found !== 1`） |
| 幂等键 | **`ops:` 系** = `ops:<admin_uid>:points_adjust:<target_uid>:<cid=1>:<seq>`（既有助手 `resolveAdminOpsKey`；缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`） | `:1234-1237`（`DL36` / `DL97` / `DL146②`） |
| 指纹 | `sha256(['points_adjust', uid, '1', amount, reason].join('|'))`（`DL96`：**业务字段集合**，不含派生量） | `:1240-1242` |
| `cid` | **恒 `1`（`$`）** | `:1259` |
| 成功面 | `sendSuccess` ⇒ `{uID, cid, op, amount, new_points, timestamp, reason, txid}`（**8 键**）；重放 ⇒ **顶层** `idempotent_replay:true` | `:1257-1267` |
| 零新造码 | **只用既有码**（`LD016` / `LD021` / `LD005` / `AUTH_*`）与**既有 `reason`** | `:1190` 注释逐字 + §5.101 |
| 审计留痕 | 库内**无**审计表 ⇒ **登记为批 6 迁移项**（`admin_audit_log` + 触发器手法）；**本批不得建表** | **Zang §5.101③ / §5.99**（审计表 P6 尚不存在） |

- **★ 现取差异登记（口径差 · 以现盘为准）**：① **常量行号 = `:1182`**（**Zang §5.97 记 `:1180`** ⇒ 差 2 行）；② **路由行号 = `:1191`**（v0.1 §1 表记 `:1066`、批 2 末态 `:995`）⇒ 均属**行号漂移**（§1.12「五分」口径）。
- **★ 形状偏离登记（本册现取 · 判负项）**：`:1200-1202` 的**入参不完整**分支走 `sendError(res, 400, '参数不完整')` ⇒ **不是 `R107` 形状**（与 §3.3-1 统一错误体冲突）⇒ **登记为批 4 收口项 = §9.E · E9**；**本册不改代码**。
- **与 §4.8 的关系（已收口）**：A1 `amount` = **② 类「授权主体意图额」**（§4.8.4）⇒ **权限闸 + 上限闸 + 审计留痕三件齐**（**权限** `:1192` ✓ / **上限** `:1225` ✓ / **审计** = 批 6 登记）。
- **`NOT_MEASURED`**：A1 的 **15/15 两轮读数**、`Σ(cid=1)` **差额恰等**、**幂等重投零分录** ⇒ **转引 Zang §5.101**；**leg 形状本册未复现**（§8.12.2-46）。

### 4.11 ★ 「缺表族」与批 5 登记 + D1'（v1.0 新增 · 依据 = **Zang §5.99 + §5.102**）

#### 4.11.1 缺表族（代码引用而库内**不存在**的 7 张表）

> **依据 = Zang §5.99**：迁移侧 **20 真表（+ `users` 由 `0006:75` RENAME）= 21 名字**；差集真项 8、**7 项真缺**；**`asset` 在迁移面命中 0（双口径）**。**真源** = `docs/audit/p4-a1ledger-design.md`（**261 行 / 41.7 KB**）+ Zang §5.97 的独立取证（`grep -rniE 'create table[^;]*\basset\b' migrations/` **空**，**本册现取 = 0 行**）。

| # | 缺表 | 本册现取 / 现取补充 | 触达面（后端行号现取） |
|--:|---|---|---|
| 1 | **`asset`** | `grep -rniE 'create table[^;]*\basset\b' backend-ts/migrations/` ⇒ **0 行**（**本册现取**）；代码侧 = `database.ts:861`（`getUserAsset`）/ `:889`（`upsertAsset`；`:895 UPDATE asset` / `:910 INSERT INTO asset`）⇒ 恒 `42P01` | **A1 成功面**（改接前）；`GET /api/user/asset/:uID`（`:489`） |
| 2 | `task` | 迁移面无 `create table … task`；B1-b 已把读口换源到 `job` | 旧读口（**已换源**） |
| 3 | `task_progress` | 同上；换源到 `job_application` / `job_submission` | `POST /api/task-progress/claim/:jID`（**`:635`**） |
| 4 | `prize` | 同上；换源到 `listing` | 旧读口（**已换源**） |
| 5 | `prize_item` | 同上；换源到 `listing_order` | `GET /api/prize-item`（**`:546`**）—— **已换源、非 sunset（§5.6）** |
| 6 | `shard` | 无对应表（持仓 = `account`） | `GET /api/shard`（**`:687`**，sunset / 空态） |
| 7 | `shard_transfer` | 无对应表（转让由 `ledger_entry` 派生） | `GET /api/shard/transfer`（**`:702`**，sunset / 空态） |

**受影响的活路由（**必须点名** · 依据 = Zang §5.99 逐字）**：

| 路由 | 后端行号（**现取**） | 现象（Zang §5.99 逐字） | 处置 |
|---|---|---|---|
| `POST /api/auth/verify` | **`:354`** | 「在无 `cid=1` account 行时撞 `42P01` → **吞成 `401`**」 | **归批 5**；**需 Kevin 一句话**（牵动「旧积分体系是否复活」） |
| `POST /api/task-progress/claim/:jID` | **`:635`** | 同上（两条**在册活路由**被牵动） | **同上** |

- **批 5（「缺表族清理」）口径（依据 = Zang §5.99④）**：**默认按 spec 的 sunset 口径处理**（退役 / `410` / 空态）；**唯上述两条活路由需 Kevin 一句话**；**Zang 给的默认值 = 不复活、按 sunset 处置（一句话可改）**。
- **★ 本册现取补充（前端影响 · Zang §5.99 原留「待 4c-ii 回执后扫」）**：**两条活路由均有前端消费** ⇒ **退役前必须先改前端**：`POST /api/auth/verify` = `frontend/src/auth.js:123`（**登录主链**）；`/api/task-progress/claim/:jID` = `frontend/src/components/ClaimRewardModal.jsx:49` / `frontend/src/pages/RewardPage.jsx:152`（**§2.2 既有读数**）⇒ **不得**当「无消费」退役。**本册只登记、不改码 / 不改前端**。
- **旧表族多为 `410` 死写**（`admin/task/*` `:1019/:1023/:1027`、`admin/prize/*` `:1031/:1038/:1045` 等）⇒ 不误伤；**三个 GET 零命中**（Zang §5.99）⇒ 读面无误伤。

#### 4.11.2 ★ D1'（**非 400 驱动错误 ⇒ 应归 `503`** · 归批 6）

> **依据 = Zang §5.102**：「**真缺口 D1'（结构性、未触发）**：**非 400 分支丢 `code`** ⇒ 落 `500`（**12/12 全走 400**、`driver_http_status_leak` 全 `null`）⇒ **我裁定归批 6、且这类传输类错误应归 `503`（不是 500）、先补只读观测面**」。

| 项 | 口径 |
|---|---|
| 结构事实 | `@neondatabase/serverless` **只在 HTTP 400 分支**读 `{message, code}`；**非 400** 抛 `Server error (HTTP status N)`、`code` 恒 `null`（真源 = `@neondatabase/serverless/index.js:1542-1544`，Zang §5.102 **亲核**；**本册转引**） |
| 现状 | 非 400 传输类错误 ⇒ **归一化成 `500`**（与本册 §3.2 的 `503` 语义——**重试类**——不符） |
| 裁定 | **这类传输类错误应归 `503`**（**不是 `500`**）；**归批 6**；**先补只读观测面** |
| ★ 更正（**D1 已作废**） | **原 D1（「驱动丢自定义 SQLSTATE 码 ⇒ 归 500」）= 已由 Zang §5.102 勘误作废**：驱动**不丢码**（`LD0nn` 与标准 SQLSTATE **同形**、`code` **逐字正确**）；且 `uID=-1` 案**在 HEAD 不可复现** —— **现取 = `400 LEDGER_RESERVED_UID`**，来自**路由前置闸** `index.ts:1207-1213`（**请求根本没到驱动**）⇒ **症状不是成因** |
| 与 §3.2 的关系 | §3.2 的 `503` 行（`LD025` / `LD026` / `LD027` = 重试类）**不变**；D1' 的处置 = **把「非 400 传输类」补进 `503` 语义**（**归批 6 实现**） |
| 判负（必带） | **把非 400 传输类错误当 `500` 交付 ⇒ 复核不通过**（`500` 只允许由**不变式被破坏**触发且必须告警，§3.2 / `DL126` / `R108`） |
| `NOT_MEASURED` | D1' **结构性、未触发** ⇒ **无运行时读数**（12/12 全走 400）；`psql` 直连对照 = 本机**无 `psql`**（Zang §5.102 自曝）⇒ **`NOT_MEASURED`**（**禁当 0/空**） |

- **与批 6 的关系（写死）**：D1' 的**实现**（`503` 归一 + 只读观测面）与**审计留痕**（`admin_audit_log`，§4.10）**同归批 6** ⇒ **本批不得实现、不得建表**。

## §5 弃用面与前端同步（**最终处置 = 本册裁定**）

### 5.1 逐项最终处置表

| 面 | 端点（`index.ts:行号`，v0.1 口径） | 现状（**批 2 实测**） | **本册最终处置** | 前端消费点（`文件:行号`） | 前端改造要求 | 过期日 |
|---|---|---|---|---|---|---|
| 碎片读口 ① | `GET /api/shard`（:557） | 令牌下 `200` 空数组 + 顶层 `deprecated:true`（**保留**） | **保留路径 + 保持空态 + `deprecated:true`**（读口不返回错）；语义由 `/api/user/points`（`account` 按 cid）取代 | `ProfilePage.jsx:92`、`RewardPage.jsx:58`、`ShardPage.jsx:301` | 迁移到 `GET /api/user/points`（批 4）；**禁止**新代码再调 `/api/shard` | **批 4 前端迁移验收通过之日**（§7-1）→ 转 410 → 删除 |
| 碎片读口 ② | `GET /api/shard/transfer`（:572） | 同上（**保留**） | **保留路径 + 空态 + `deprecated:true`**；语义由 `GET /api/user/ledger?kind=transfer` 取代 | `ShardPage.jsx:303` | 迁移到 `/api/user/ledger` | 同上 |
| 碎片写口 ① | `POST /api/shard/redeem`（:587） | **`410` + `R107` + `details.sunset`**（无 token / 有 token **均 410**） | **`410` 已落地**（写动作**不得**用空态 200 冒充成功） | `RewardPage.jsx:196` | **删除该按钮/分支**（碎片兑换在 `cid` 模型里无对应语义；等值动作 = 交易所 `trade` 或 `transfer`） | 批 4 删路径 |
| 宝箱写口 | `POST /api/chest/:bID/open`（:605） | **`410` + `R107` + `sunset`** | **`410` 已落地**（「凭空调入余额」与 `DL5` 双分录正面冲突） | `RewardPage.jsx:217` | **删除该按钮/分支**；若未来要做 ⇒ 走 `mint`/`purchase` 且**单独裁定** | 批 4 删路径 |
| 商品持有读口 | `GET /api/prize-item`（:420） | 令牌下读 `listing_order`（**真实语义**）；**顶层无 `deprecated`**（实测） | **保留且正式化：不删路径、不标 `deprecated`**（B1-c 已接到新 schema，硬删会丢真实读口且前端 3 处消费）⇒ **本项已满足**〔**★ v1.0 归类更正（依据 = Zang §5.103④）**：本行位于 §5.1「弃用面」处置表内 ⇒ **易被读成 sunset 面**；**实测非 sunset** —— 数据源 = `listing_order` **买家轴**（`buyer_uid=me AND status='paid'`）+ 它是**退款面 `order_id` 的唯一已注册来源** ⇒ **保留 + 改语义**、**不得退役 / `410` / 空态化**；详见 **§5.6**；**旧读法留痕**（原样保留，不删）〕 | `ProfilePage.jsx:106`、`HomePage.jsx:119`、`RewardPage.jsx:56` | **无需迁移**（键集 6 键冻结）；批 4 可另开 `/api/listing/order/mine` 作别名 | 无（长期保留） |
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

### 5.5 ★ `sunset` 字段的日期口径（**v0.8 新增 · 依据 = Zang §5.90 裁定④**；**只追加，§5.1–§5.4 一字未动**）

> **裁定逐字（Zang §5.90 裁定④）**：「**D5（`sunset` 无日期）⇒ 13 个弃用面要么给日期、要么写「随批 4 移除」**」。
> **Neng 的读数（转引 + 本册现取）**：QA `p4-b3-funds-qa.md §7` 的 **6/6 PASS** 只证明**形状**成立（`410` + `code=LEDGER_REF_NOT_FOUND` + `details.sunset` **存在**）；**值面**未给日期（**D5**）。**本册现取范例**（§5.1 统一要求行 `:731`）：`details = {ref_type:"endpoint", ref_id:"/api/admin/prize/create", http_status:410, sunset:"批 4 删路径（未决 §7-1…）"}` ⇒ **「未决」= 无日期、无动作** 的占位形态（转引 `p4-b2b-listing-write.md §3.1:116`）。

**本册口径（写死 · 13 个 `410` 面一律适用）**：

1. **`sunset` 的值面形态**（三选一，**不得**留空、**不得**写「未决…」）：
   - **(i) 显式写「随批 4 移除」** —— 即 `sunset: "批 4 删路径"`（**已定形态**，**无需 Kevin**）；
   - **(ii) 给具体日期** —— **仅当 Kevin 给定日期**；本形态 = `sunset: "批 4 删路径（= <YYYY-MM-DD>）"`；
   - **(iii) 建议形（**不是裁定**）** —— `sunset: "批 4 删路径（= 批 4 前端迁移验收通过之日；§7-1）"`，给 Kevin 一句话即可落。
2. **★ 不得自定日期**：**具体日期 = `待 Kevin`**（本册**不发明**任何时间参数；安全线同「不发明经济参数」）。**本册未写任何 `YYYY-MM-DD`**。
3. **映射关系（写死）**：13 面的**实际过期日**仍 = **Zang §5.73 7-1** 的「**批 4 前端迁移验收通过之日**」（§7-1 / §5.4 第 3 阶段）⇒ `sunset` 字段**只是该口径的投影**，**不得**被读成「一个独立的新日期」。
4. **判据（可复算 · 批 4 复核必跑）**：13 面逐个取 `410` 响应体 ⇒ ① `details.sunset` **非空**；② **不含**「未决」字样；③ 形态 ∈ {(i), (ii), (iii)} 之一。**任一不成立 ⇒ 本项复核不通过**。
5. **状态**：**形态 (i) = 已定**；**(ii) 的具体日期 = `待 Kevin`**（登记 **§7-35**）。**本册不改任何代码**（`410` 面的响应体修改属实现方，归批 4 = §9 施工清单 · E 栏）。
### 5.6 ★ 归类更正登记：`/api/prize-item` **不是弃用面**（v1.0 新增 · 依据 = **Zang §5.103④**；**只追加**）

> **裁定逐字（Zang §5.103④）**：「**它纠正我误登记（`/api/prize-item` 非 sunset）**」；Zang §5.103 追述：「**实测**该路径 `200`、数据源 = `listing_order`（`database.ts:1066`，`buyer_uid=me AND status='paid'`），且是**退款面 `order_id` 的唯一已注册来源**（读数 `O_mine_buyer_axis`：`contains_my_order=true`）⇒ 判为**保留路径 + 改语义（商品订单读面）**，**不移除**」。**Zang 同处自曝**：「`/api/prize-item` 的『sunset 面』标签是我**凭归类推的、未复现**」⇒ 教训已进纪律（§5.7 ⑧）。

**本册口径（写死 · 与既有条文一致）**：

1. **`GET /api/prize-item`（现取 `:546`）= 保留路径 + 改语义（商品订单读面）**：数据源 = `listing_order`（**买家轴**：`buyer_uid = actor` 且 `status = 'paid'`）；**它是退款面 `order_id` 的唯一已注册来源** ⇒ **不得退役、不得标 `deprecated`、不得 `410`、不得空态化**。
2. **就地订正 + 留痕（本册唯一为该项动的既有格）**：**§5.1「商品持有读口」行的「本册最终处置」格已就地加注**（**旧文逐字保留**，注 = 「本行位于『弃用面』处置表内 ⇒ 易被读成 sunset 面；**实测非 sunset**」）。**其余出现处**（§1 `#16` 处置 = 【保留·正式化】、§1.4 F6、§2.1、§2.2、§5.4-1）**本册现取复核 = 口径已正确、无需改** ⇒ **逐处留痕于此登记**。
3. **判负（必带）**：**把 `/api/prize-item` 当 sunset 面处置**（退役 / `410` / 空态 / 删前端调用） ⇒ **复核不通过**；前端 3 处消费 = `ProfilePage.jsx:106` / `HomePage.jsx:119` / `RewardPage.jsx:56`（**§2.2**），4c-ii-b 已**保留 + 空态容忍**（`HomePage.jsx:119` 的 `.catch(() => [])`）。
4. **与 `/api/shard` 系的区别（写死 · 防混批）**：`/api/shard`（现取 `:687`）与 `/api/shard/transfer`（`:702`）**确为 sunset**（`deprecated:true` + 恒空态 + §5.2 明令禁止新代码调用）⇒ 4c-ii-b **全部移除调用**；**两族不得混为一谈**（**这正是原误登记的来源**：派单把 `prize-item` 与 `shard` 并列为「旧碎片/奖品面、已 sunset」）。
5. **真源**：`docs/audit/p4-b4c-ii-b-listings-market.md` §2④（**4 文件 / 6 处**逐条处置表 + 「**★ 与派单前提不符的实测登记（`/api/prize-item` 不是 sunset 面）**」段）+ §5.1 的 `O_mine_buyer_axis` 读数（`contains_my_order=true`）；**本册现取** = §1 `#16` / §5.1 行 / §5.4-1 三处原文 + `index.ts:546` 注册行。
6. **`NOT_MEASURED`**：该路径的**运行时**读数（`200` + `contains_my_order=true`）**本册转引** 4c-ii-b §5.1，**未复跑**（§8.12.2）。

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
| **7-25（v0.5 新增 · ★ v0.6 定案）** | **`create_key` 缺失时的口径**（**派生兜底 vs fail-loud**：2a 派生 vs 3b fail-loud） | **已定（★ v0.6：Zang §5.86 裁定① = 采纳「选项 B」；契约正文 = §4.5 追加块）** | **★ 3b 面 = 已定**（**Zang §5.85 裁定③** 逐字：「`create_key` 缺失 ⇒ **fail-loud 不派生**（优于 2a 派生兜底）⇒ 批准并**立案审 2a 是否同类静默重放** ⇒ 派 **FIX-JOBKEY**」）⇒ J1 取 fail-loud（§4.4-14；真源 `src/job-funds-service.ts:84`）。**2a 面 = 待 Zang（但审计已落盘、结论明确）**：审计件 **`docs/audit/p4-aud-jobkey.md` 本单现取 = 已落盘**（**246 行 / 21165 字节 / 6 节**；HEAD `8f2974c`；run tag `audjk-20260929T182652Z`；产物 `.p4-artifacts/audjk-20260929T182652Z/**`；探针 `scripts/p4z-audjk-01-probe.ts`）。**其结论（审计自述 = 取证、非裁决）**：`resolveJobCreateKey`（`src/job-service.ts:90`；公式 `cli:p4b2a:<fallbackParts.join(':')>:<sha256(fallbackParts.join('|'))[:16]>`）的 `fallbackParts` **只含自然标识**（J4 = `['submit', identifier, workerUid]`，`:133`；J2 = `['apply', jobId, workerUid]`，`:180`）、**不含任何内容字段** ⇒ 派生键 = **自然标识的单射** ⇒ **不同实体不可能同键**（**实测** T1/T2 各落 1 行、`sub` 6→7→8；A1/A2 各落 1 行、`app` 9→10→11）；同实体同内容 ⇒ 200 `idempotent_replay:true`（设计内幂等）；同实体**异内容** ⇒ **409 `LEDGER_IDEMPOTENCY_CONFLICT` / `REPLAY_FINGERPRINT_MISMATCH`**（**响亮拒绝、非静默**）⇒ **「2a 属同类静默重放」不成立**；两口径差异**语义上可解释**（**3b 的 J1 无自然键可用**，2a 两处都有）。**★ 但「改法」未定**：审计 §4 给出 **A（服务层 fail-loud + 同单补前端键）/ B（保持派生，把过渡口径升为显式契约）/ C（路由层必填、服务层保留派生）** 三个**互斥**选项，**自述「只取证不裁决」⇒ 待 Zang 裁定**，由 **v0.6 定案**（**本册不自选**）。**★★ 硬事实（对批 4 有约束力 · 审计 §3 取证）**：`frontend/**` 的 `create_key|createIdempoten` 命中 = **0**（静态 `grep`）；**2a 的 J4 `POST /api/task-progress/:identifier/submit` 是前端唯一在用的该面写口、且从不传键**（`frontend/src/components/ActiveTaskModal.jsx:50-58` 只传 `info_input`、无 `Idempotency-Key` 头）⇒ **取 A 或 C 必须同单改前端**（否则该端点 **100% `400`**、招工提交整体失效）；**J2 `applyToJob` 无前端调用者** ⇒ 对它 fail-loud **零前端影响**（见 §1.8 #2）。 |
| **7-26（v0.5 新增 · ★ v0.6 定案）** | **§1.8「已实现·未注册清单」的维护责任**（谁在每批复核时更新） | **已定（★ v0.6：Zang §5.86 裁定② = 三方分工〔Kong 报数 / Jing 维护 / Zang 差集〕；正文 = §1.8 追加块）** | **★ 机制 = 已定**（**Zang §5.85 裁定①**：spec 须增设该清单、表头四栏、目的 = 「`assets/init` 那类『互推无人认领』的结构性解药」）⇒ 本册以 **§1.8** 落地并配「准入判据 / 扫描口径 / 负向排除」使其**可复算**。**责任人指派 = 待 Zang**（**本册不自选**）。**▼ 本册建议（不构成裁定）**：① **每批复核强制项** —— 复核人须重跑 §1.8 的扫描命令，把**新增/消除**项逐条登记；**有新增项而未登记 ⇒ 复核不通过**；② 清单项**不得**以「归同批其它片」结案（`assets/init` 先例）；③ 批 4 每注册一条**必须从清单划掉**并在 §8 变更记录留痕。 |
| **7-27（v0.5 新增）** | **前端是否依赖旧 `400`** 的全量回归核验 | **部分已取证 · 残留 `NOT_MEASURED`** | **已取证部分**（本册现取）：verify 的**唯一**真实调用点 `frontend/src/pages/DashboardPage.jsx:223-236` **不对 `400` 做分支**（失败一律 `toast.error` 泛化）；`jID` 来源 = 面板队列的 `application_id`（数字）⇒ 前端不发非数字 `jID`；被撤除的 bespoke `400`（admin 提交）**前端不可达**。**残留 = `NOT_MEASURED`**：前端 **23 文件 + 单测**未全量扫 ⇒ **批 4 前端迁移时必须全量核**（是否断言旧 `400 Invalid jID` / admin-queue 文案）。依据：`p4-b3c-job-funds.md §2.3 Δ1/Δ2`；**Zang §5.85 裁定②**（「须登记规格 + 核前端是否依赖旧 400」）；§2.4 S9 / §8.7.2-18 |
| **7-28（v0.6 新增）** | **「同标识 + 异内容」的 `409` 面（派生键面）是否持续为 `409`**（**永久回归项**） | **已定（永久回归项）** | **★ Zang §5.86 裁定① 逐字要求：「登记**永久回归项**（409 面）」** ⇒ **该面必须持续 `409`、不得退化为静默 replay**。**判据（可复算）** = 实测 **T4** 形态：同 `(application, worker)`、**异 `deliverable`** ⇒ **`409 LEDGER_IDEMPOTENCY_CONFLICT` + `details.reason=REPLAY_FINGERPRINT_MISMATCH` + 零落行**（`p4-aud-jobkey.md §2.2 T4`）；同族现成判负 = **T1/T2 / A1/A2**（异标识 + **同内容** ⇒ **都落新行**、键不同）。真源 = `src/job-service.ts:156`（409 分支）+ `src/job-service.ts:133/180`（派生入参只含标识）；契约正文 = **§4.5 追加块「契约 2 + 永久回归项」**；审计件入册 = **§1.10** |
| **7-29（v0.6 新增）** | **§1.8 条目在 3c（商品资金）落地后的变动**（新增导出 / 新增或消除注册路径） | **已定（★ v0.9：4a 已注册 11 条 / 注册点 53→65 / §1.8 清单已清空·无遗留；本单已按实更新）**〔**旧状态（留痕）**：**待（3c 收尾后按分工报数 ⇒ 由 Jing 下次刷新登记）**〕 | **本单不代 3c 推导**（**增量登记纪律**）：3c **正并发改 `backend-ts/src/**`**（在途 untracked = `backend-ts/scripts/p4z-b3d-00-probe.ts`，见 **§1.10 A4**）⇒ 按 **Zang §5.86 裁定② 第 1 行**（**Kong 每片收尾报「认领 N 条 / 未认领 M 条」**）报数后，由 **Jing 在下次 spec 刷新时真扫描**并逐条增删 §1.8 行。**本单现取（3c 未提交态）**：服务层具名导出 **27**、注册点 **53**、8 条未注册 verb 调用点 **0** ⇒ **§1.8 无变动**（§1.8 追加块「现取复算」）。**触发条件** = 3c 提交后「注册点 ≠ 53」或「5 文件具名导出 ≠ 27」或「§1.8 某条被注册掉」 |
| **7-30（v0.6 新增）** | **§7-25 依据格原文「改法（A/B/C）待 Zang ⇒ 由 v0.6 定案」的兑现**（该格正文 v0.6 **未改写**，见下表后补注） | **已定** | **兑现 = Zang §5.86 裁定① 采纳「选项 B」**：契约 = **§4.5 追加块**（契约 1/2/3 + 行为矩阵 + 永久回归项）/ 审计入册 = **§1.10**（A5 三选项去向）/ 前端口径 = **§2.4 S10**。**A / C 不采纳**（均要求改**冻结前端**）。**本单因并发纪律（Kong 正阅读 §4.2 / §4.5 / §1.8）未改写 §7-25、§7-26 依据格的既有正文** ⇒ 只改**状态列**并在本表后**追加**补注块；**差异显式登记于此**（自曝 §8.8.3-21） |

> **★ §7 追加补注块（v0.6 · **不改上表任何既有行的正文**）**：
> ① **7-25**：**状态列**已改「**已定**」（**本单唯一被改动的单元格之一**）；其**依据格原文**（写于 v0.5）含「**改法未定 … 由 v0.6 定案（本册不自选）**」⇒ **v0.6 已兑现**：**定案 = Zang §5.86 裁定① 采纳「选项 B」**（零改码 + 升为显式契约），契约正文见 **§4.5 追加块**。**该依据格原文保留不删、未重写**（历史留痕 + 守并发纪律）；**读该行时以状态列为准**。
> ② **7-26**：**状态列**已改「**已定**」（另一方格）；其依据格原文含「**责任人指派 = 待 Zang（本册不自选）**」⇒ **已由 Zang §5.86 裁定② 定案 = 三方分工**（正文 = **§1.8 追加块**：Kong 每片报「认领 N / 未认领 M」/ **Jing 每次 spec 刷新真扫描** / Zang 批末差集 = ∅）。原文同样**保留不删**。
> ③ **7-23 保持原状**（「已定 · **数值待 Kevin**」= 数值仍未给；**本单未发明任何数值**）；**7-1…7-24 与 7-27 一字未动**（**7-25 / 7-26 仅状态列改动**）。

**★★ §7 v0.7 追加表（**不插入上表 · 只追加 · 上表 7-1…7-30 一字未动**；表头同上四栏）**：

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-31（v0.7 新增）** | **`400 LD022`（4 处）的**反向同类缺陷** —— 真值应为 `LD021`（`LEDGER_RESERVED_UID`）** | **已定（★ v0.8：Zang §5.89 裁定① 批准 `LD021`；本单已就地订正 4 处）**（原状态 = 「**待 Zang（一句话可落）**」，留痕；读法同 §7 补注块⑧） | **发现过程（本单类级扫描副产物）**：`LD022` = `LEDGER_REF_NOT_FOUND`（**404**，`src/ledger.ts:1051`）⇒ 出现在 **`400` 列表**里属**自相矛盾**（§4.2 J1 `:534` / M1 `:544` / A1 `:553` + §4.4-6 `:578`）。**候补码 = `LD021`**（`ledger.ts:1050`；`ledger-errors.ts:55` ⇒ **400**「目标账户无效」），**语义契口** = 四处所指均为「**平台/保留 uid 前置闸**」（§4.4-6 逐字），**raise 真源 = `migrations/0013_job.sql:503`（`PLATFORM_EMPLOYER_FORBIDDEN`）/ `0015_listing.sql:538`（`PLATFORM_BUYER_FORBIDDEN`）/ `0016_market.sql:481`**（**每文件各 1 处 `LEDGER_RESERVED_UID`**）。**本单不改**（**Zang §5.88 裁定④ 只裁 `LD023`→`LD022` 一类**；候补码系本册推定 ⇒ 按「不得自选」登记）。**现取可行改法** = 4 处 `400 LD022` → `400 LD021`（**改后须同步 §4.7.1 真值表**）。**全表见 §4.7.1**；自曝 = **§8.9.3** |
| **7-32（v0.7 新增）** | **退款的「管理员可发起」能力**（第三个 actor 面） | **已定（= 后续能力，不属本批）** | **★ Zang §5.88 裁定②**：**退款发起人 = 仅卖方**（现批写死，见 §4.7.2）；**「管理员可发起」登记为后续能力 —— 批 6（随权限模型）** ⇒ **本批不得实现**；实现时的前置 = §6 权限单一真源（`users.is_admin` × `admin_role*`）+ 审计面（每次管理员退款必留 actor 痕迹）。真源 = `src/listing-funds-service.ts:62`（现批为 `true` = 仅卖方；将来放开须改此单点 **且** 过权限闸） |
| **7-33（v0.7 新增）** | **§7-29 的兑现**：3c（商品资金）落地后 §1.8 的条目变动 | **已定（本单已兑现）** | **★ 兑现 = Zang §5.88 裁定③**（点名两条待补行）+ **§1.8 追加块 v0.7 现取复算**：**新增 2 条**（`#9` `buyListing` `:191` / `#10` `refundListingOrder` `:261`，**均由批 4 注册**）；**无消除**；具名导出 **29**（**扫描面 5 → 6 文件**）、注册点仍 **53**；**7-29 的触发条件**（「注册点 ≠ 53」或「导出 ≠ 27」或「某条被注册掉」）**已命中「导出 ≠ 27（27 → 29）」** ⇒ **7-29 由本单收口**（**其原表述「本单不代 3c 推导」在 3c 已收尾后不再适用**） |

**★★ §7 追加补注块（v0.7 · **不改上表任何既有行的正文，只追加**）**：
> ④ **7-7（退款是否回滚库存）**：**状态仍 = 「已定（默认不回滚）· 仍待 Kevin 一句话」** —— **v0.7 折入 3c 现取事实**：**不回滚已落地**，单点 = `backend-ts/src/listing-funds-service.ts:55`（`REFUND_ROLLS_BACK_STOCK = false`，**本册现取**），**观测投影** = 回执 `stock_rolled_back:false`（改常量即变）⇒ **Kevin 一句话即可改，改后须新迁移或同语句补 `UPDATE listing SET stock = stock + n`（禁跨事务）**（真源 = 报告 `§2:99-101`）。**本条不构成产品裁定**（**未发明任何决策**）。
> ⑤ **7-23（金额来源 / 数值）**：**状态仍 = 「已定（机制）· 数值待 Kevin」** —— **v0.7 折入 3c 现取事实**：商品面下限仍 = **占位常量 `1000` + `TODO: Kevin 定值`**（§4.7.3 B10；与 §4.4-11 同口径）⇒ **数值仍未被任何子代理发明**。
> ⑥ **7-29 收口声明**：**已由 7-33 兑现**（**本单是 3c 之后的下一次 spec 刷新 ⇒ 依 Zang §5.86 裁定②「Jing 每次刷新真扫描」的强制项执行**）；**上表 7-29 原文（写于 3c 未提交态）保留不删**，读法与 §7-30 同（**先读状态列 / 补注块，再读依据格原**文）。

**★★ §7 v0.8 追加表（**不插入上表 · 只追加 · §7-1…7-33 一字未动；唯一例外 = 7-31 的「状态列」单元格**；表头同上四栏）**：

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-34（v0.8 新增）** | **`LD001`–`LD033` 全键普查 + 33 键真值表写全 + 9 键逐键表态**（v0.7 §8.9.2-26 的「只扫 `LD02x`」未覆盖面收口；合并 Neng D1/D2/D6 + §7-31） | **已定（★ 本单已兑现）** | **★ Zang §5.89 裁定①**（采纳「把类级扫描扩为 `LD001`–`LD033` 全键普查」）+ **§5.90 裁定①**（「`LD001`–`LD033` 全键普查 + 33 键真值表写全 + 对 spec 未提及的 9 键逐键表态」）⇒ 正文 = **§4.7.4**（真值表 33 行 + 9 键表态表 + 8 处订正表 + 改后复算）。真源 = `backend-ts/src/ledger.ts:1029-1063`（**`:1030` `LD001` … `:1062` `LD033`**）+ `src/ledger-errors.ts:28-70`。**残余（明写）**：**`503` 家族 `LD025`/`LD026`/`LD027` 在本 spec 内既无键号、也无状态码条文**（§3.2 无 `503` 行）⇒ **本册只登记、不发明**（§4.7.4.4）；**运行时逐键触发验证 = `NOT_MEASURED`**（§8.10.2） |
| **7-35（v0.8 新增）** | **13 个弃用面 `sunset` 的日期**（Neng **D5**：形状有、**值面无日期**） | **形态 = 已定 · 具体日期 = `待 Kevin`** | **★ Zang §5.90 裁定④**「要么给日期、要么显式写『随批 4 移除』」⇒ 正文 = **§5.5**：**(i) 显式「批 4 删路径」= 已定形态**；**(ii) 具体日期 = `待 Kevin`**（**本册不得自定日期**；**本册未写任何 `YYYY-MM-DD`**）；(iii) **建议形**（不构成裁定）= `"批 4 删路径（= 批 4 前端迁移验收通过之日；§7-1）"`。**实际过期日仍 = §7-1**（§5.5-3 写死映射关系）。判据 = 13 面 `details.sunset` 非空 + **不含「未决」字样**；真源 = §5.1 统一要求行 `:731` 的范例句（转引 `p4-b2b-listing-write.md §3.1:116`）+ QA `§7`（6/6 只证形状） |
| **7-36（v0.8 新增）** | **金额来源二分**（Neng **D3** 的定性**已被 Zang 推翻**：`reward` 客户端传入**不是缺陷**） | **已定（立法 = §4.8）· 一行 `待 Zang 复核`（A1）** | **★ Zang §5.90 裁定②**逐字：「**招工酬金本就该由雇主自主出价**（供给侧）；**只有平台侧费/保证金/费率必须服务端取数**」+「**spec 显式区分『客户端可传金额』与『服务端取数金额』**」⇒ 正文 = **§4.8**（规则三条 + 逐事件表 + 判负 5 条 + 三问归类判据）。**唯一 `待 Zang 复核` 项** = **A1 的 `amount`**（本册归 A′「管理员意图额」；**若 Zang 视其为平台侧金额 ⇒ 以 Zang 为准**）。**连带**：`src/job-funds-service.ts:18-19` 的自述注释与代码不符 ⇒ **更正归批 4（实现方）**（§4.8.3 更正登记；§9 施工清单 · E 栏） |
| **7-37（v0.8 新增）** | **`POST /api/listing-orders/:orderId/refund` 路径正典**（§1.2「命名张力」的关闭） | **已定（本单已就地订正）** | **★ Zang §5.89 裁定②**：「**§1.8 `#10` 路径正典 = `/api/listing-orders/:orderId/refund`（RESTful），§4.2 P4 路径格同步**」⇒ **已就地改 §4.2 P4 `:554` 的路径格**（**旧写法 `POST /api/listing/order/:orderId/refund` 保留留痕**，见 §4.7.4.3 处 ⑧）；§1.2 追加块 + §1.8 `#10` 的张力注保留为历史。**依赖** = §4.1 目标命名表（`§4.1` 与 `data-layer.spec` §4.1 的差异口径见 §1.2） |
| **7-38（v0.8 新增）** | **DL68 残余：对手方选择在锁外 ⇒ 「撮合决策新鲜度」**（Zang §5.89 **B①**） | **已定（= P5/批 4 加固项 · `必带判负`）** | **★ Zang §5.89 B①**逐字：DL68 残余「对手方选择在锁外 ⇒ 决策新鲜度」⇒ **P5/批 4 加固项 + 必带判负**。**真源 = `docs/audit/p4-b3e-market-funds.md:96`**（残余陈述）+ **`:147`（§7 待裁 1 = 方案 B）**：「把『锁 → 选择 → 写』放进 `src/db.ts` 的交互式事务（R55/R56 已存在）⇒ 残余归零；代价 = 多一次事务往返 + 需在 `database.ts` 承载选择 SQL」。**已成立的部分（不得回退）** = 锁与事件**同语句**（`src/database.ts:1809-1813` 的 `WITH l AS (SELECT pg_advisory_xact_lock(...)) SELECT public.market_post_event(...) FROM l`；Zang §5.89 A③ 亲读）。**加固项 + 判负 = §9 施工清单 · D1**（本册不实现、不改码） |
| **7-39（v0.8 新增）** | **质检 / 探针**夹具幂等键前缀**纪律**（Neng **D4** = **派单 brief 自身之错**） | **已定（纪律 · 永久回归项族）** | **★ Zang §5.90 裁定③**逐字：「**D4（我 brief 给的夹具前缀 `qa-b3:` 违反 §4.5 ⇒ 实测 `400 PREFIX_REQUIRED`）= 我自己的 brief 错**（正解 `cli:qa-b3-*`）⇒ **纪律：今后质检/探针单夹具前缀必须用 `cli:`/`biz:`/`ops:`**」。**实测真源** = QA `§5`（`T11`：`create_key='qa-b3:probe'` ⇒ `400 LEDGER_IDEMPOTENCY_KEY_INVALID` / `reason=PREFIX_REQUIRED`；同表 `T07`/`T12` 用 `cli:qa-b3-*` 全部 `200`）+ **§4.5 前缀强制**（`cli:`/`biz:`/`ops:`/`cm:`） |
| **7-40（v0.8 新增）** | **§1.8 十条未注册路径 + 全部前端同步项的「批 4 收口」**（谁认领、按什么判据） | **已定（清单 = §9）· ★ v0.9：注册面 A1–A11 已关闭（批 4a，注册点 65）；残余 = §9.B/C/D/E（**不得读成「批 4 已全部完成」**）** | **依据** = Zang §5.86 裁定②（Kong 报数 / Jing 维护 / **Zang 批末差集 = 全量服务层导出 − 已注册 − §1.8 已登记 = ∅**）+ **§5.4**（「**不得只挑其中几条**」；**必须先解决 §7-25 的 `create_key` 口径**）+ **§5.90**（下一步 = 「Jing v0.8 + 批 4」）⇒ 正文 = **§9 施工清单**（元信息 = 项目 / 真源锚点 / 行动 / 前置依赖 / 验收判据） |

**★★ §7 追加补注块（v0.8 · **不改上表任何既有行的正文，只追加**）**：
> ⑦ **7-31（`400 LD022` 4 处 ⇒ `LD021`）**：**状态列已改**（**本单唯一被改动的单元格**）—— 由「**待 Zang（一句话可落）**」⇒「**已定（★ v0.8：Zang §5.89 裁定① 批准 `LD021`；本单已就地订正 4 处）**」；**其依据格原文（写于 v0.7，含「本单不改 / 候补码系本册推定」）保留不删、未重写**（历史留痕）—— **读该行时以状态列为准**（读法与 **7-25 / 7-26 / 7-29 / 7-30** 完全同款，见上两处补注块）。
> ⑧ **7-32（管理员发起退款）**：**保持原状**（**已定 = 后续能力，归批 6**，随权限模型）—— 本单**未改**、**未提前实现**；与 §4.7.2（现批 `actor` = 仅卖方）**不冲突**。
> ⑨ **7-7 / 7-23（待 Kevin 两条）**：**状态一律不变** —— 7-7 = 「已定（默认不回滚）· **仍待 Kevin 一句话**」（单点 `src/listing-funds-service.ts:55`）；7-23 = 「已定（机制）· **数值待 Kevin**」（下限 `1000` 仍为占位 + `TODO: Kevin 定值`）。**本单未发明任何数值 / 未改任何产品决策**（§5.5 的「不得自定日期」同此纪律）。
> ⑩ **7-27 的残留**（前端 23 文件未全量扫 ⇒ `NOT_MEASURED`）**在 §9 · C 栏被重申为批 4 必跑项**（判据 = 全量核前端是否断言旧 `400 Invalid jID` / admin-queue 文案）。
**★★ §7 v0.9 追加表（**不插入上表 · 只追加 · §7-1…7-40 一字未动；唯一例外 = **7-29 / 7-40 的「状态列」单元格**；表头同上四栏）**：

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-41（v0.9 新增）** | **「有链 ⇒ `job_fee` 入 `-2`」的 HTTP 级形态抽查**（QA-B4 的 `NOT_MEASURED` 项之一） | **已定（= 后续低优先 QA 项，非缺口）** | **★ Zang §5.93 ③**：QA-B4 的 `-2` 形态 `NOT_MEASURED`（造链需 `/api/referral/bind`，超其写库允许面）⇒ **不算缺口**（**3b 已在服务层实测两形态**：无邀请人 ⇒ `-1`；真链 `depth=2` ⇒ `-2` **进 +10 / 出 −10**，§1.9 K6 / §4.3）⇒ **仅留「HTTP 级 `-2` 抽查」为后续低优先项**。**登记 = §1.11 Q10 / §8.11.2-40** |
| **7-42（v0.9 新增）** | **`jobEventView` 的键数口径**（**Zang §5.92 记「新路径成功面 = `jobEventView` 15 键」；本册现取该函数本体 = 14 键**） | **口径细化已定（面 15 键与裁定一致）· 数值面标 `待 Zang 复核`** | **本册现取**：`backend-ts/src/job-funds-service.ts:119` 的 `jobEventView` 本体 = **14 键**（`job_id,status,created,idempotent_replay,txid,ledger_idempotency_key,escrow_txid,settle_txid,ledger_event_keys,entry_count,kinds,entries,accounts,fee_credit_uid`）；**A5 面（`POST /api/job/:jobId/review`）= 14 + `submissions_reviewed` = 15 键**（= **Zang 裁定的「15 键」✔**，也是 4a 报告 §3 的逐键枚举）；**A6 面（`/cancel`）= 14 键**；**A1 面（`POST /api/job`）= 17 键**（14 + `employer_uid`/`cid`/`reward`）。**★ 两报告计数分歧（如实登记）**：4a 报告 §3 = A5 **15 键**（逐键枚举）、QA-B4 §4 = A5「**16 键**」（文字计数、正文用省略号）⇒ **以逐键枚举的 15 键为准**（与 Zang §5.92 一致），QA 侧 16 为**报数误差**，**标 `待 Zang 复核`**（**不影响「新路径 ≠ 旧路径 11/9」这一决定性判据**）。**登记 = §2 追加块 / §1.11 Q7 / §8.11.3-39** |

**★★ §7 追加补注块（v0.9 · **不改上表任何既有行的正文，只追加**）**：
> ⑪ **7-29（§1.8 清单的变动）**：**状态列已就地更新**（**本单改动的两个状态列之一**）—— 由「**待（3c 收尾后按分工报数 ⇒ 由 Jing 下次刷新登记）**」⇒「**已定（★ v0.9：4a 已注册 11 条 / 注册点 65 / 清单已清空·无遗留）**」；**其依据格原文（写于 v0.6：含「本单不代 3c 推导」+ 触发条件）保留不删、未重写** ⇒ **读该行时以状态列为准**（读法与 **7-25 / 7-26 / 7-30 / 7-31** 同款）。**其触发条件之一「§1.8 某条被注册掉」已命中**（11 条全部注册）。
> ⑫ **7-40（批 4 收口）**：**状态列已就地更新**（另一方格）—— **注册面 A 栏（A1–A11）已关闭（批 4a）**；**残余 = §9.B（前端同步）/ §9.C（行为回归）/ §9.D（加固）/ §9.E（收口）** ⇒ **本栏不得读成「批 4 已全部完成」**（**依据格原文保留不删**）。
> ⑬ **本单未改的既有行**：**§7-1…7-28 与 7-30…7-39 正文一字未动**；**7-36（A1 归类）** 的 `待 Zang 复核` 由 **§4.8.4 / §4.8.2 的地更新**兑现（**7-36 行本体不改**，读法同 7-25/7-26）；**7-7 / 7-23（待 Kevin 两条）保持原状**（**本单未发明任何数值、未自定任何日期**）。

**★★ §7 v1.0 追加表（**不插入上表 · 只追加 · §7-1…7-42 一字未动**；表头同上四栏）**：

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-43** | **幂等键硬规则** = 「**服务端已确定性派生键的面，前端不得自造键**」 | **已定（本单已立法）** | **★ Zang §5.96④**（采信 4b-i 的分歧裁定，逐字：「该面已有服务端确定性派生键，前端自造 `cli:<uuid>` 会把重试变第二行」⇒「要求 Jing v1.0 在 §4.5 补…」）+ **§5.100 逐面声明**（4c-ii-a：①发布 = 前端供 `cli:`〔服务端 fail-loud〕②申请 = 服务端派生③接受 = 无键面④提交 = 服务端派生⑤审核 = 事件根键派生⑥余额/流水 = 纯读 ⇒ **②③④⑤ 前端一律不传键**）⇒ 正文 = **§4.5 v1.0 追加块**（逐面表 + 判负）；**逐面落点** = **§2.5**。**适用** = 前端已按此接线（4c-ii-a 自证「前端零自造键」：新增代码 `create_key` **只出现在发布面 1 处**） |
| **7-44** | **错误体口径约束（D1''）**：规格**不得依赖 DB `DETAIL`/`constraint`**；API **一律用项目级 `reason`** | **已定（本单已立法）** | **★ Zang §5.102**（逐字：「驱动**恒不搬运 `DETAIL`/`constraint`** ⇒ `409` 体带 `details.detail_unavailable='driver_did_not_carry_detail'`（**12/12**）⇒ **规格不得依赖 `detail`，API 用项目级 `reason`；交 Jing v1.0 写入**」）⇒ 正文 = **§3.5**；真源 = `docs/audit/p4-err-fidelity.md`（**218 行**；**本册转引**）。**与 §3.3-2 同立场**（禁把 SQL / 约束名 / 堆栈放进对外 `details`） |
| **7-45** | **A1 落定 + 数值定值**（有符号 `amount` / ±100,000 / `requireAdmin` 先于金额校验 / `ops:` 键 / 10,000 · 10,000 · 50,000） | **已定（本单已落定）** | **★ Zang §5.101**（A1-LEDGER-IMPL 验收通过：**15/15 两轮** + `Σ(cid=1)` **差额恰等** + **幂等重投零分录**；`requireAdmin` 未动且**先于金额校验**；**零新造码**）+ **§5.95③**（Kevin 授权定值）⇒ 正文 = **§4.10**（A1 落定表）+ **§4.9**（数值定值表）。**A1 归类 = ② 类**（§4.8.4，已收口）。**登记**：审计留痕 ⇒ **批 6 迁移项**（`admin_audit_log`）；**该路由的入参不完整分支形状偏离 `R107`**（`:1200-1202`）⇒ 收口项 **§9.E · E9** |
| **7-46** | **「缺表族」7 表 + 批 5 + D1'** | **已定（登记 + 归批）** | **★ Zang §5.99④**（「`asset` 缺表族立为**批 5『缺表族清理』**：默认按 spec sunset 口径处理；**唯 `POST /api/auth/verify` 与 `POST /api/task-progress/claim/:jID` 两处需 Kevin 一句话** ⇒ 我给的默认值 = **不复活、按 sunset 处置**」）+ **§5.102**（**D1'** = 非 400 驱动错误应归 **`503`**、归批 6；**D1 已勘误作废**）⇒ 正文 = **§4.11**（7 表 + 两条活路由 + D1'）。**本册现取补充** = 两条活路由**均有前端消费**（`auth.js:123` / `ClaimRewardModal.jsx:49` / `RewardPage.jsx:152`）⇒ **退役前必须先改前端**（§4.11.1） |

**★★ §7 追加补注块（v1.0 · **不改上表任何既有行的正文，只追加**）**：
> ⑭ **7-7 / 7-23（待 Kevin 两条）**：**7-23 的「数值面」已由 Kevin 2026-09-30 定值 —— 见 §4.9**（**10,000 / 10,000 / 50,000 / 100,000**；上表与 §7 补注块 ⑤ / ⑨ 的「**数值待 Kevin**」措辞**保留为历史留痕**）；**7-7（退款是否回滚库存）状态不变**（仍「**不回滚** · 待 Kevin 一句话」，单点 `listing-funds-service.ts:55`）。**本单未发明任何数值**（§4.9 四个值**逐条挂「Kevin 2026-09-30 定值」+ `文件:行号`**）。
> ⑮ **7-42（`jobEventView` 键数口径）**：**状态不变**（面 15 键 = 裁定口径；本体 14 键 = 现取）—— 本单**未改该行**。
> ⑯ **本单未改的既有行**：**§7-1…7-42 正文一字未动**（**本单无状态列改动** —— 四处新增全部落在本追加表）；**§4.4-11 / §4.4-12 / §4.7.3 B10 的 `1000` 占位读数**由 **§4.9「取代关系」条**处理（**旧文未改、留痕**）；**§5.1 一行的归类加注**见 **§5.6**（**本册唯一非追加改动**）。

**★★ §7 v1.1 追加表（**不插入上表 · 只追加 · §7-1…7-46 一字未动**；表头同上四栏**）：

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-47** | `POST /api/task-progress/claim/:jID` 的**同族残项**（`getUserAsset ∥ upsertAsset` 回退 / 首领取 `upsertAsset(rewardPoints)`；**B5-2**）：**默认退役**（`410` + 前端停止调用并显「已下线」）**vs** 保留并按 §3.7 同族收口 | **待 Kevin 一句话**（**默认口径 = 退役**） | **★ Zang §5.105 / §5.99④**（缺表族默认「不复活、按 sunset 处置」）+ `docs/audit/p5-fix-login.md §4` 表 #2/#3（`src/index.ts:665` / `:676`，**v1.1 现取**；路由 `:641`）⇒ 正文 = **§9.E · E10**（含两条去向的行动与判据）。**一句话可改**：若 Kevin 改口径 ⇒ 按 **§3.7** 同族收口（无 `account` 行 ⇒ `emptyAsset`），**不得**回到写 `asset` 表 |
| **7-48** | 两条新 `401` 文案的**四语覆盖**（`Invalid wallet signature` / `Signature does not match the claimed address`） | **待做（收尾项）· 现测 = 前端 0 命中** | **依据 = Zang §5.106** + `docs/audit/p5-sig-verify.md §6`（该单硬边界**禁改 `frontend/**`** ⇒ 登记为后续回归核验项）⇒ 正文 = **§9.B · B14**（`frontend/src/locales/{zh,en,hk,vn}.json` 各 2 键）。**本册现取** = 两串在 `frontend/src` **全文 0 命中**；**HTTP 展示面 = `NOT_MEASURED`** |

**★★ §7 追加补注块（v1.1 · **不改上表任何既有行的正文，只追加**）**：
> ⑰ **7-46（缺表族）**：**状态就地说明**（**该行正文保留不删**）—— 缺表族两条活路由里，**`POST /api/auth/verify` 一面已由 §3.7 关闭**（本单口径落地后登录链**不再触 `asset` 表** ⇒ 「需 Kevin 一句话」**对 verify 已无对象**）；**`claim` 面的残项改由 §9.E · E10 承接**（7-47）。
> ⑱ **7-45（A1）**：**E9 的锚点已刷新**（入参不完整分支 `:1200-1202` ⇒ **`:1206-1208`**，**旧读数留痕**）；**7-45 行正文不改**（§9.E · E9 为准）。
> ⑲ **本单未改的既有行**：**§7-1…7-46 正文一字未动**（**本单无状态列就地更新** —— 7-47/7-48 为新增行）；**7-7 / 7-23（待 Kevin 两条）保持原状**（**本单未发明任何数值、未自定任何日期**）；**7-44（D1''）** 与 **§3.6 的「零新增面」条**为**两件事**（前者管 `DETAIL`/`constraint` 不得作为判据；后者管错误码 / `reason` / `kind` 不得新造）。

**★★ §7 v1.5 追加表（**不插入上表 · 只追加 · §7-1…7-48 一字未动**（**含 7-32 的状态格 —— 本单**未**就地对它加注**，理由见补注块 ⑳：为守「删除列 = 0」的机器判据；读法更新由本表 + 补注块 ⑳ 承载）；表头同上四栏）**：

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-49（v1.5 新增）** | **§7-32「管理员退款发起」的契约化兑现**（第三个 actor 面：actor / 权限闸 / 鉴权面 / 审计 / 幂等 / AC / 注册面） | **已定（契约）· 实现仍待批** | **契约正文 = §12**（v1.5 本单交付：只写契约、**零代码**）；**前提已全部由本册只读取证现取**（§12.0：`0022`/`0023` 已 apply + 11 键 + 4 个 CHECK 闭集 + 无 `RAISE` + 现成可退门面）；**实现** = 新批（**需新迁移 + `listing-funds-service.ts` 单点 + 路由**，见 §12.10「实现面登记」）⇒ **本批不得实现**（§7-32 原文口径不变：现批 `REFUND_ACTOR_IS_SELLER_ONLY = true` 继续生效） |
| **7-50（v1.5 新增）** | **管理员退款的权限闸选键**（11 键之内选**唯一**） | **已定（=`manage_points`）· 收 Zang 一句话确认 / 改字** | **逐键候选 + 现取调用面 = §12.1.1**；**采用理由** = ① **零新造键**（11 键之内）② 语义最贴（本仓唯一「用户资产 / 额度治理」键；退款 = 改动用户余额，与 A1 调分同族）③ **细粒度优于「无键」**（无键口径现取 = `hasRequiredPermission(actor, undefined) === true`，`src/index.ts:299-317` ⇒ 闸退化为 `can_access_admin`）；**未采纳备选** = `manage_settings`（A11 佣金政策的「同域兜底」先例 `src/index.ts:1876`）/ 无键（A1 调分先例 `:1402`）⇒ **若 Zang 改选 ⇒ 只改 §12.1 / §12.1.1 / §12.3 三处与 AC-3 一行**。**★ 不新增键**（新键须迁移 + 前后端三真源同步，本批禁改 `migrations/**`） |
| **7-51（v1.5 新增）** | **审计落点：复用 `admin_ops_audit_log`（变体 A）vs 新表（变体 B）** | **待 Zang 终审（本册不二选一；倾向 = B）** | **两变体逐项代价 = §12.4.1**（迁移面 / 既有行兼容 / **日累计是否受影响** / R107 面 / 单列语义挤压 / 自检面）。**★ 现取决定性读数**：`0023:207-211` 的日累计求和**无 `action` 过滤** ⇒ 变体 A 的 `result='applied'` 退款行**会被计入 A1 的 `1,000,000 点/日`**（除非同批改**已 apply 的**函数体）⇒ 变体 A 的迁移面 ≥ 4 项 + 1 项函数体改动。**登记** = §12.10 · Z2 |

**★★ §7 追加补注块（v1.5 · **不改上表任何既有行的正文，只追加**）**：
> ⑳ **7-32（管理员发起退款）**：**该行本体一字未动**（含「状态」格 —— 本单**未**就地对它加注；**理由**：派单把「就地加注」与「`git diff --numstat` 删除列 = **0**」并列 ⇒ 二者在**同一行内加注**时冲突（改一行即产生 `1` 个删除行）⇒ **本单取机器判据优先**，把读法更新**全部**落在 **§7-49 / §7-50 / §7-51 + 本补注块**；**旧状态格「已定（= 后续能力，不属本批）」保留为历史读数**）—— **读该行时以 §7-49 为准**（读法与 7-25 / 7-26 / 7-29 / 7-30 / 7-31 同款，差别仅在本单不再改动单元格）。**与 §4.7.2（现批 `actor` = 仅卖方）不冲突**：本单**未改** `REFUND_ACTOR_IS_SELLER_ONLY`、**未实现**、**未连库写**；§12 是**将来时的契约**。
> ㉑ **本单未动的既有行**：**§7-1…7-48 依据格一字未动**；**7-7（退款不回滚库存）/ 7-23（数值待 Kevin）保持原状**（**本单未发明任何数值、未自定任何日期、未改任何产品决策**）；**7-44（D1''）** 与 **§12.3 的「reason 不得作唯一判据」** 同立场（§12.3 的 reason 列全部标「驱动相关 ⇒ `NOT_MEASURED` 边界」）。
> ㉒ **§12 与 §7-18 / §7-19 / §7-24 的关系**：不冲突、不覆盖 —— §12 只新增「管理员 actor 面」的准入与留痕，**不得**被读成「§4.7.2 的卖方口径被撤销」（撤销须 Zang 一句话 + 改 §4.7.2，**本单未做**）。

**★★ §7 v1.6 追加表（**不插入上表 · 只追加 · §7-1…7-51 一字未动**（**含 7-32 / 7-49 / 7-50 / 7-51 的状态格 —— 本单**未**就地加注任何单元格**，理由同补注块 ⑳：守「删除列 = 0」的机器判据；读法更新由本表 + 补注块 ㉓–㉕ 承载）；表头同上四栏）**：

| # | 未决项 | 状态 | 裁定 / 依据 |
|--:|---|---|---|
| **7-52（v1.6 新增）** | **A1 既有的「无键 `requireAdmin`」面与新契约不一致** | **待下一轮 spec 收口（本批不扩面）** | **★ Zang Z1 附加**：**不动 A1 既有的无键 `requireAdmin` 面**（`src/index.ts:1402` 现取）；「**A1 无键面与新契约不一致**」（新契约要求**命名权限键** = `manage_points`；A1 现取为**无键** ⇒ 闸实际退化为 `can_access_admin`，§12.1.1 候选表末行）⇒ **登记为下一轮 spec 收口项**；**本批禁改码 / 禁改 `migrations/**` ⇒ 不扩面** |
| **7-53（v1.6 新增）** | **审计面分裂（两张审计表：`admin_ops_audit_log` + `admin_refund_audit_log`）** | **待 P6 审计台立项时定** | **★ Zang Z2 登记**：变体 B（新建表）的已知代价 = 「谁对用户资产做过什么」需**扫两张表** ⇒ **P6 审计台立项时定**是否**合并为通用表 / 视图**；**本批不扩面**（缓解手段 = **同前缀命名** + spec/data-layer **双登记** + 检索视图（可选）） |
| **7-54（v1.6 新增）** | **Z2b = N/A（未选变体 A）· 将来若有人选 A 的前提** | **登记（不适用本批）** | **★ Zang Z2b**：本批**未选变体 A** ⇒ N/A；**将来若有人选 A ⇒ 必须先解决上述四条**（① `0023:86` 单值约束；② `0023:207-212` 日累计无 `action` 过滤的**静默污染**；③ 复用须 `CREATE OR REPLACE` 改**已 apply** 函数体 ⇒ 作废 0023 质检字节锚；④ 列语义属调分中心 ⇒ 信息压缩），**且须给出「不改已 apply 函数体」的替代路径** |
| **7-55（v1.6 新增）** | **闸前拒绝（401/403）是否留痕 + 本仓不落 access log** | **已定（不留痕 · 登记）** | **★ Zang Z5**：**闸前拒绝（G1–G5）不写审计行**（依据 = 闸在编排之前 + `0023` 的拒绝留痕发生在**函数体内**）；「**本仓不落 access log**」= **既有事实**（§7-24 同口径）；**将来若要留痕 ⇒ 须另立规范**（不得在本契约内私开写入路径） |
| **7-56（v1.6 新增）** | **§12.11.5 三条待 Zang 确认（T-1 `log_id` / T-2 拒绝捕获机制 / T-3 404 留痕边界）** | **待 Zang 一句话** | **本册不自行二选一**：三条各带**两变体 + 代价 + 倾向**（倾向不构成裁定）；其中 **T-2 无「零捕获」先例**（`0023` 的闸在本函数内、退款的状态机闸在被调方 `0015:682-686`）⇒ 倾向 = 照 `0008:87` 的 `EXCEPTION WHEN SQLSTATE` 先例 **捕获 `LD011`** |

**★★ §7 追加补注块（v1.6 · **不改上表任何既有行的正文，只追加**）**：
> ㉓ **7-51（审计落点）**：**状态格一字未动**（仍写「待 Zang 终审（倾向 = B）**」）—— **本单未就地加注任何单元格**（理由 = 「就地加注」与「删除列 = 0」在同一行内冲突 ⇒ 取机器判据优先，口径同 v1.5 补注块 ⑳）；**读法更新 = §7-53 / §7-54 + §12.4 就地加注 + §12.11.2**（**Z2 = 变体 B 终审采纳**）。**读该行时以本补注块与 §12.11.1 为准**。
> ㉔ **7-50（权限闸选键）**：**状态格一字未动**（仍写「已定（=`manage_points`）· 收 Zang 一句话确认」）—— **Z1 终审已确认 `manage_points`**（§12.11.1）；**读法更新 = §12.1.1 就地加注 + §12.11.1**。
> ㉕ **本单未动的既有行 / 未发明项**：**§7-1…7-51 依据格一字未动**；**7-7（退款不回滚库存）/ 7-23（数值待 Kevin）保持原状**（**本单未发明任何数值、未自定任何日期、未改任何产品决策**）；**§12.0–§12.10 一字未动**（Z1–Z8 落位**全部**由**加注行 + §12.11** 承载）；**T-1 / T-2 / T-3 三条无先例细节一律不自行二选一**。

**★★ §7 v1.7 追加表（**不插入上表 · 只追加 · §7-1…7-56 一字未动**（**含 7-56 的状态格 —— 本单**未**就地加注任何单元格**，理由同补注块 ㉓ 与 v1.5 补注块 ⑳：守「删除列 = 0」的机器判据；读法更新由本表 + 补注块 ㉖–㉗ 承载）；表头同上四栏）**：

| # | 未决项 | 状态 | 依据 / 落点 |
|--:|---|---|---|
| **7-57（v1.7 新增）** | **§12.11.5 三条待 Zang 确认（T-1 `log_id` / T-2 拒绝捕获机制 / T-3 404 留痕边界）** | **★ 已定（终审收口）** | **★ Zang T-1 / T-2 / T-3 终审逐字落位**：T-1 = 变体①（保留 `log_id` ⇒ 13 列）；T-2 = 变体①（`EXCEPTION WHEN SQLSTATE 'LD011'` 捕获；**变体②否决**）；T-3 = 变体①（404 不留痕、射程写死）。**落点 = §12.11.2 / §12.11.3 / §12.11.4 / §12.11.5 加注 + §12.12.1–§12.12.4**（**⇒ 本行收口 7-56**；**7-56 状态格一字未动**） |
| **7-58（v1.7 新增）** | **回执键集：编排函数内部回执 vs 对外路由回执 vs F10 的 23 键** | **已定（Zang 裁定）** | **★ 两极口径**：① 内部回执须含 `result` / `txid`（拒绝 `null`）/ `audit_logged`；② **对外零新增顶层键**（走既有 `sendSuccess` / `ledgerErrorBody` + 既有 `extra`）；③ 与 **F10 的 23 键** = **两层**、**禁止原样透传**。**落点 = §12.11.3 / §12.11.4 加注 + §12.12.5**（**§12.11.7 · I-11 由此收口**） |

**★★ §7 追加补注块（v1.7 · **不改上表任何既有行的正文，只追加**）**：
> ㉖ **7-56（三条待确认）**：**状态格一字未动**（仍写「待 Zang 一句话」）—— **本单未就地加注任何单元格**（理由同补注块 ㉓）；**读法更新 = §7-57 + §12.11.5 加注 + §12.12.1–§12.12.4**（**T-1 / T-2 / T-3 全部终审收口**）。
> ㉗ **本单未动的既有行 / 未发明项**：**§7-1…7-56 依据格一字未动**；**7-7（退款不回滚库存）/ 7-23（数值待 Kevin）保持原状**（**本单未发明任何数值、未自定任何日期、未改任何产品决策**）；**§12.0–§12.11 一字未动**（终审落位**全部**由**加注行 + §12.12** 承载）；**AC-14 的注入载体 = 本单未指定**（属测试实现细节 ⇒ 登记归实现批 / 质检批，见 §12.12.7）。

**★★ §7 v1.8 追加表（**不插入上表 · 只追加 · §7-1…7-58 一字未动**；表头同上四栏）**：

| # | 未决项 | 状态 | 依据 / 落点 |
|--:|---|---|---|
| **7-59（v1.8 新增）** | **两套取数入口并存**（`fetchApiJson` vs `ledger-api.fetchMyLedger`） | **已登记 · 待 P6/P7 统一时合并** | **依据 = Zang §5.162 D③**（`docs/seafood.master-plan.md:1443`）+ A · R-1（`:1422`）：`fetchApiJson` 的契约**一字未动**（**路径②**）⇒ 账本读口因需读**顶层 `next_before_txid`**（游标不在 `data` 里）而**另立** `frontend/src/ledger-api.js`（55 行，本册现取）。**落点 = §14.2**；**并入时机 = P6/P7 取数入口统一**（**本单不合并、不扩面**） |
| **7-60（v1.8 新增）** | **脚本类存量类型债**（`scripts/**` 的 `tsc` 基线） | **已登记（既有债 · 本批不修）** | **依据 = Zang §5.162 A · R-3①**（`:1424`）：**22 文件 / 77 条**（本册现取）⇒ **逐条登记为既有债**；**判据 = 任何脚本改动「新增零错」、基线不得推高**（推高 ⇒ 判负）。**落点 = §13.2 / §13.3** |
| **7-61（v1.8 新增）** | **「同一端点内 400 类形状不齐」的同族面清单**（哪些面仍有旧 `sendError` 形态） | **口径已定（Zang §5.162 C）· 清单 = `NOT_MEASURED`** | **依据 = Zang §5.162 C**（`:1439`）：**口径** = 同一端点内 400 类**只许一种形状（R107）**、**形状非法 ⇒ 400 + 既有码 + `details.field` / `details.reason`**（依 **§5.16 裁定**）、**同族 `sendError` 面只登记不扩面**。**清单来源 = 同批 Kong 收口五报告 `docs/audit/p7-a-ledger-read-fix2.md`（转引、本单不复算）**；**该件开工时尚未落盘 ⇒ 本册不得自编清单、不得留占位** ⇒ **`NOT_MEASURED`**（§15.2 / §8.20.2-②）。**落点 = §15** |

**★★ §7 追加补注块（v1.8 · **不改上表任何既有行的正文，只追加**）**：
> ㉘ **7-59（两套取数入口）**：**并入时机未到** —— 本单只**登记**，**不合并**（合并会改 `fetchApiJson` 契约 ⇒ 越本单射程）。**路径②（另立 `ledger-api.js`）已终审选定**；**路径①（改全站共用件）被否决**（依据 = `docs/seafood.master-plan.md:1422` 逐字「`fetchApiJson` 契约**一字未动**（*路径②*）」）。
> ㉙ **7-60（脚本存量债）**：**22 文件 / 77 条 = 本册现取**（命令见 §13.2-④）；**本批不修一条**（登记为既有债）。**★ 与之配套的作废声明**：**此前所有「`tsc` 0」读数对脚本改动无效**（§13.2-③）—— 读旧册里任何「`tsc` 0」时，**必须先确认它测的命令面**。
> ㉚ **本单未动的既有行 / 未发明项**：**§7-1…7-58 依据格与状态格一字未动**；**7-23（数值待 Kevin）/ 7-56（三条待确认）保持原状**；**§1.1–§1.12 / §2–§6 / §8.1–§8.19 / §9 / §10 / §11 / §12 一字未动**（v1.8 全部落位由**新增节 + 追加行 + 本补注块**承载）；**本单未发明任何路径名 / 行号 / 数值 / 日期**（无先例处见 §8.20.2）。


**★★ §7 v2.2 追加表（**不插入上表 · 只追加 · §7-1…7-61 一字未动**；表头同上四栏）**：

| # | 未决项 | 状态 | 依据 / 落点 |
|--:|---|---|---|
| **7-62（v2.2 新增）** | **★ 审计台读口（批 8 ⑦）的权限键**（11 键内**无**「只读审计」语义的键） | **★ 待 Zang 裁（本册停报 · 不硬造）** | **`R-8-1` 逐字**：**只在既有 11 权限键内选键，零新增 / 零删除**；**找不到合适键 ⇒ 停下报裁、严禁硬造**。**现取事实**：`0022:50-61` 十一键（`dashboard_access` / `manage_tasks` / `publish_tasks` / `manage_rewards` / `publish_prizes` / `read_users` / `manage_users` / `manage_points` / `manage_permissions` / `manage_settings` / `review_tasks`）**无一**语义 = 「读审计台」⇒ **本册不选、不造**。**候选（不构成裁定）** = **`read_users`**（读人域、最小面）/ **`manage_users`**（管理域、面更大）。**★ 收口 `§7-53`**（`R-8-3` 的审计台立项 = **§17.5** + 本行）。**落点 = §17.2(b) 的 8 ⑦ 行 + §17.5(d) + §17.6 `AT-R5`** |
| **7-63（v2.2 新增）** | **批 8 ④⑤「自建单位审核 / 合规审核」的权限键**（`review_tasks` 面语义不完全吻合） | **★ 待 Zang 一句话确认（本册临时结论 = 复用 `review_tasks`）** | **本批「新键不可行」**（先例 = 本册 **§12.1.1:3042** 逐字：新权限键须**4 处同批改** —— `database.ts:11-23` 常量 / `0022_admin_permission_seed.sql` 种子 / `frontend/src/admin-utils.js:40-52` 兜底 / 消费点）⇒ **临时结论 = 复用 `review_tasks`**（`0022:61`，中文名「任务审核」；消费面现取 = `index.ts:1350/1365/1381/1784/1808`）；**须 Zang 确认**（**不得**由实现方自定）。**落点 = §17.2(b) 的 8 ④⑤ 行** |
| **7-64（v2.2 新增）** | **保证金金额的 `app_config` 载体键名 + 数值** | **★ 待 Zang / Kevin（本册不发明）** | **`R-8-5`**：载体**已定 = `app_config` 合法键**（**不新增列 / 不改已 apply 迁移**）；**键名待定**（候选 = `listing_deposit_policy`，**候选、不构成裁定**）、**数值待 Kevin 定值**、**兜底常量标 `TODO: Kevin 定值`**。**依据 = 本册 §7-23 逐字「保证金下限的数值与载体（新增 `app_config` 键？…）待 Kevin/Zang 给数 ⇒ 不得自选」**。**落点 = §17.4 + `data-layer.spec` v0.10 §21.4** |
| **7-65（v2.3 新增 · 收口 `7-62`）** | **★ 审计台读口（批 8 ⑦）的权限键**（`R-8-7` 已裁） | **★ 已裁 = 复用 `manage_points`（Zang §5.180 C · `R-8-7` 逐字）** | **裁定**：8 ⑦ 审计台读口 = **`manage_points`**（**零新增键**）。**理由（逐字）**：审计台内容 = **积分调账审计（`0023`）+ 退款审计（`0024`）** = 该键的**动作面**；「**能调账者才看调账审计**」= **最小权限一致**。**★ `read_users` 标【已排除】**（**理由（逐字）**：**读人域与资金审计面不符**）。**★ 独立「只读审计」键 ⇒ 跨批登记**（新权限键须 **4 处同批改**：`database.ts:11-23` 常量 / `0022_admin_permission_seed.sql` 种子 / `frontend/src/admin-utils.js:40-52` 兜底 / 消费点 —— **4 处逐字锚见 §18.2**）⇒ **本批不可行**。**`7-62` 行体一字未动**（守「删除列 = 0」）⇒ **读法以本行 + §18.2 + 补注块 ㉝ 为准**。 |
| **7-66（v2.3 新增 · 收口 `7-63`）** | **批 8 ④⑤「自建单位审核 / 合规审核」的权限键**（`R-8-8` 已确认） | **★ 已确认 = 临时复用 `review_tasks`（Zang §5.180 C · `R-8-8` 逐字）** | **确认口径（逐字）**：8 ④⑤ = **临时复用 `review_tasks`** —— 两片本质均为**审核 / 审批**面（④ 自建单位审批、⑤ 合规审核 / 下架）。**★ 附带条件（逐字 · 本行新增的那一句）**：「**若 ⑤ 的 takedown 后续落成独立动作面 ⇒ 再报 Zang 裁**」—— **不得**由实现方自定义新键。**独立键**（`manage_currency` 等）⇒ **跨批**（4 处同批改）。**`7-63` 行体一字未动** ⇒ **读法以本行 + §18.3 + 补注块 ㉞ 为准**。 |
| **7-67（v2.3 新增 · 收口 `7-64`）** | **保证金金额的 `app_config` 载体键名 + 数值**（`R-8-9`：**键名已批准** / **数值仍待 Kevin**） | **★ 键名已批准 = `listing_deposit_policy`；入册时机 = 8③ 冻结时（本单不入册）；数值 = 待 Kevin** | **`R-8-9` 逐字落位（四项）**：① **键名批准 = `listing_deposit_policy`**（**顶层 `snake_case` / `value` = jsonb object / 字段 `camelCase`**，**风格与 `system_settings` 一致**）；② **由本册在 8③ 冻结时正式入 `AK1` 清单**（= `data-layer.spec` §21.1 的合法键清单；「8③」的定稿切片号见 §18.8）；③ **★ 8①/8② 实现单不得先行写入该键**；④ **数值仍待 Kevin**（实现期兜底常量标 `TODO: Kevin 定值`；**下限校验机制先落地**）。**★ 本单只声明「批准与入册时机」，不得把该键当成已入册**（**现取合法键清单仍 = 恰 1 键 `system_settings`**）⇒ **现在写入仍必被拒**（`AG1` **正面用例保持不变**）。**`7-64` 行体一字未动** ⇒ **读法以本行 + §18.4 + 补注块 ㉟ 为准**。 |
| **7-68（v2.3 新增）** | **★ 新纪律「引用纪律」**（**本册自身已犯一次 = `D-1`**） | **★ 已立（本单）** | **规则（写死）**：**权威册中凡「`文件:行` / 引文」必须现取且逐字**；**空行 / 不存在行 / 非逐字引文 = 缺陷**（**不是「口径差」**）。**可判负形态 = §18.6**（抽本册全部 `文件:行` 引用 → 逐条现取 → 断言「该行非空」＋「引号内文本与真源逐字相等」⇒ **任一失败即判负**）。**适用范围 = 本册 + 姊妹册 `data-layer.spec` 的后续修订**（**新增引用一律适用**；**不溯及既往改写旧行** —— 守「删除列 = 0」）。 |


**★★ §7 v2.4 追加表（**不插入上表 · 只追加 · `§7-1…7-68` 一字未动**）**：

| # | 未决项 | 状态 | 依据 / 落点 |
|--:|---|---|---|
| **7-69（v2.4 新增）** | **★ 8② 写口 `POST /api/admin/commission_policy` 的 `ops:` 幂等键缺口**（现取 = **无**） | **★ 已登记（本单现取发现）** | **现取（逐字）**：该端点（`backend-ts/src/index.ts:1999`）**未调** `resolveAdminOpsKey`（`grep -n 'ops:' backend-ts/src/index.ts` 现取命中 = `:44` / `:1160` / `:1248` / `:1278` / `:1300` / `:1513` / `:1559`，**无 `:1999` 区**；`resolveAdminOpsKey` 调用面现取 = `:1161` / `:1249` / `:1279` / `:1301` / `:1560`）⇒ **与同族 `POST /api/admin/settings`（`:1161`，形态 = `ops:<admin_uid>:setting:<key>`）不一致**。**后果**：页面保存**无幂等保障**（**非资金面** ⇒ **不破幂等协议**；属**运维写卫生**缺口）。**候选形态（不构成裁定）= `ops:<admin_uid>:commission_policy:<effective_from>`**（承 `data-layer.spec:591` 的**既有命名法**）⇒ **由实现单 / Zang 定**（**本册不发明**）。**落点 = §19.2(a) + §19.5(f) + §19.8 `I-4`**。 |
| **7-70（v2.4 新增）** | **★ 8② 新增 admin 读口（运营后台展示现行费率 + 权重矩阵）** | **★ 已冻结（本单）· 属功能需求（`R-8-6`）** | **冻结值（逐字）**：**`GET /api/admin/commission_policy`**；闸 = **`manage_settings`**（11 键内，`R-8-1`）；**注册点 68 → 69**；**响应形状 = R107 口径**（成功 `{success:true,message,data}`；失败 `{error:{code,message,i18n_key,details}}`）；**`data` 键集 = `CommissionPolicy` 8 键**（`backend-ts/src/commission.ts:122-131` 现取）。**★ 性质（逐字）**：`R-8-6` 只禁「**为验收新增路由**」；**运营后台需要读口才能展示矩阵 ⇒ 功能需求、允许新增、必须在本册冻结并登记注册点** —— **与「行为验收只许 DB 直造 + 读库」两条线不得混同**（§19.2(e) 给**双向判负**）。**落点 = §19.2(b) + §19.3(b) + §19.8 `I-3`**。 |
| **7-71（v2.4 新增）** | **★ 后台页四语文案面（费率页 / 权重矩阵页）与「禁工程口径泄漏」** | **★ 已立（本单）** | **语言面（现取）= 四语** `frontend/src/locales/{zh,en,hk,vn}.json`（四文件顶层键数均 = 103，命名空间清单逐字相同）；**命名空间约定（不得自拟新风格）** = 承既有 `admin*` 先例（现取 = `admin_panel` / `adminNav` / `adminLayout` / `adminCommon` / `adminTasks` / `adminRewards` / `adminPermissions` / `adminPoints` / `adminShards` / `adminSettings` / `adminUsers`）⇒ **本片新增 = `adminFeeRate`（费率页）/ `adminWeightMatrix`（权重矩阵页）**，词根取自既有域词（`fee_rate_bp` / `weights_bp` / `commission_policy`）；**四语必须逐键齐**（缺任一语 ⇒ 判负）。**★ 禁泄漏六类（写死）**：`§章节号` / HTTP 状态码 / 接口路径 / 内部批次名与单号 / 机读码与裸 i18n 键 / 表名与列名函数名 —— **用户可见文案不得出现任一**；**判负形态 = 四语 locale 键值正则扫描 + 负对照**（§19.5(c)）。**★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写**（登记 §19.8 `I-2`）。**★ 工程口径可现于 `message` 面**（承 §3.3 条款 9′ / §15.5）。**落点 = §19.5(c) + §19.8 `I-7`**。 |


**★★ §7 追加补注块（v2.2 · **不改上表任何既有行的正文，只追加**）**：
> ㉛ **`§7-53`（审计面分裂：`admin_ops_audit_log` + `admin_refund_audit_log`）**：**该行体一字未动**（仍写「待 P6 审计台立项时定」）—— **本单**未就地加注任何单元格（理由同补注块 ⑳ / ㉓ / ㉖：守「删除列 = 0」的机器判据）。**`R-8-3` 的兑现在 = §17.5**（**并联读取 + 统一呈现 + `txid` 对账判据 + 拒绝行 `txid = NULL` 豁免**）+ **7-62**；**读该行时以 §17.5 与本节为准**。**★ 结论（写死）**：审计台**不合并表、不迁移**（`§7-53` 的「分裂」**保持**），**只消除其代价**（呈现层统一；存储层两表并存）。
> ㉜ **`§7-16` / `§7-23` 里的「归**批 6** 配置面」字样**：**两行体一字未动**。**口径**：那两处是**立项时点**的切片归属；**`R-8-3` / `R-8-4` 已把该面的执行切片重新指派为「批 8 首片（8①）」（8① 是第一批，其它片依赖它）** ⇒ **归属物不变（同一配置面）、变的是切片号**。**读法以 §17 + `data-layer.spec` v0.10 §21 为准**（**不得**据「归批 6」的旧字样认为该面已闭合）。**本单未发明任何键名 / 数值 / 权限键 / 日期**（`§7-23` 的「数值待 Kevin」**保持原状**）。
> ㉝ **`§7-62`（审计台读口权限键 · 停报项）**：**该行体一字未动**（仍写「★ 待 Zang 裁（本册停报 · 不硬造）」+「候选（不构成裁定）= `read_users` / `manage_users`」）。**`R-8-7` 已裁**（Zang §5.180 C）⇒ **读法更新 = §18.2 + 新增 7-65**：**8 ⑦ 读口 = `manage_points`**；**候选 `read_users` 已【排除】**（读人域与资金审计面不符）；**独立只读审计键 ⇒ 跨批**。**★ 行体内「候选」二字作废** —— **不得**据它继续把 `read_users` / `manage_users` 当作可选项；**行体原文保留不删**（守「删除列 = 0」）。
> ㉞ **`§7-63`（8 ④⑤ 权限键 · 待确认）**：**该行体一字未动**（仍写「★ 待 Zang 一句话确认（本册临时结论 = 复用 `review_tasks`）」）。**`R-8-8` 已确认** ⇒ **读法更新 = §18.3 + 新增 7-66**：**确认临时复用 `review_tasks`** + **附带条件**（**⑤ 的 takedown 若后续成独立动作面 ⇒ 再报 Zang 裁**）。**「须 Zang 确认」字样已兑现**（**不再是待办**）。
> ㉟ **`§7-64`（载体键名 + 数值 · 待 Zang / Kevin）**：**该行体一字未动**（仍写「★ 待 Zang / Kevin（本册不发明）」+「候选 = `listing_deposit_policy`，**候选、不构成裁定**」）。**`R-8-9` 已裁** ⇒ **读法更新 = §18.4 + 新增 7-67**：**键名 = 已批准（`listing_deposit_policy`，「候选」二字作废）**；**入册时机 = 8③ 冻结时**（**本单不入册**）；**8①/8② 不得先行写入**；**数值仍待 Kevin**。**★ 「本册不发明」的自我限制仍然成立** —— 本单把「批准」落在**本册 §18.4 的声明**与**姊妹册 `data-layer.spec` v0.11 §22.1** 上，**未**在 `data-layer.spec` §21.1 清单里追加任何键行（**现取清单仍 = 恰 1 键**）。
> ㊱ **`§18.5` / `§18.1` 的行锚版本基线（`R-8-14`）**：**两节正文一字未动**。**口径（写死）**：**两节全部 `:NNNN` 行锚与「现取命令」`sed -n '3042p'` 的读数 = `v2.2` 基线**（`docs/versions/route-layer.spec.v2.2.md`，**4030 行**）；**现行 v2.3（4253 行）行号已漂、且漂移不均匀**（`7-63` 行 `:1798 → :1810`（**+12**）；节头 `:3080 → :3136`；内容行 `:3096 → :3152`；闭集注 `:3922 → :3978`；§17.8 末行 `:4030 → :4086`（**+56**）；`grep -n '§12.1.1:3042' docs/route-layer.spec.md` 本单现取 = `1810` / `3978` / `4086`）⇒ **读法以 §19.6（含逐条漂移对照表 + 可判负形态）为准**。**★ `sed -n '3042p'` 的「空行」读数在 v2.3 不复现**（本单现取 = 正文行 `- **★ 26 个 IO 出口统一走分类器**（转引 …`；该空行的 v2.3 对应位 = `:3098`）。**★ 不得**据「统一 `+Δ`」推算（**v2.3 在 `:1798 → :3080` 之间另有插入** ⇒ 漂移**两段不同**）。




**★★ §7 v2.5 追加表（**不插入上表 · 只追加 · `§7-1…7-71` 一字未动**）**：

| # | 未决项 | 状态 | 依据 / 落点 |
|--:|---|---|---|
| **7-72（v2.5 新增）** | **★ `app_config` 的「键寻址面」缺口** —— 第二个合法键（`AK2` = `listing_deposit_policy`）入册后，**写入面在现取代码内仍不可达** | **★ 已登记（本单现取发现）** | **现取（逐字）**：`POST /api/admin/settings` 的**请求体 = `system_settings` 的值对象**（`index.ts:1192` `screenSystemSettingsWrite(body)` ⇒ `database.ts:863` 剥离信封控制字段后交 `:775` `validateSystemSettingsPatch` **逐字段**判白名单 / 类型；**判据真源 = `SYSTEM_SETTINGS_FIELD_TYPES` 的 9 字段**）；**写落点的 `key` 字面写死** `'system_settings'`（`database.ts:3085`）；**读侧同**（`:3063` `WHERE key = 'system_settings'`）；**合法键常量现取 = 恰 1 键**（`database.ts:47` `APP_CONFIG_LEGAL_KEYS = ['system_settings']`）⇒ **现取面内没有「指定 `app_config.key`」的通道**。**⇒ 落地两件事（均属实现单）**：**(i)** 键级寻址（线格式**待定**，候选形见 §20.6，**本单不选不发明**）；**(ii)** `APP_CONFIG_LEGAL_KEYS` 同轮加键。**★ 判负三条 = §20.6**（自造线格式未回写 / 把键塞成 `system_settings` 的字段 / 常量加键而门禁仍按字段级判）。**★ 与 `O-3` 的连接点**：`ops:` 键现取写死 `'system_settings'`（`index.ts:1162`）⇒ **`AK2` 正是「第二个合法键」**，其 `ops:` 键会落同一命名空间（`O-3` 已登记缺口，本单只重申、不新增条目）。**落点 = §20.1 / §20.6 + §20.9 `I-1` / `I-7`**。 |
| **7-73（v2.5 新增 · 停报项）** | **★ 8③「退市退还」的触发面缺失 + `DL67`/`DL88` 与 `R-8-2` 的**口径冲突**（两件事同条登记，因其解必须一起给） | **★ 停报 Zang（本单不裁定、不择一）** | **（一）触发面**：**69 条注册点内无 `delist` 一族路径**（`grep -rn 'delist' backend-ts/src/index.ts` 现取 = 仅 `:1925` 注释行）；唯一现取注文 = `index.ts:1637` 逐字「**退市 / 罚没（`hold_release` / `hold_forfeit`）本片不实现**（§4.2 无对应事件行 ⇒ 报告 §7-1）」⇒ **「退市退还」在现取面内没有触发器**；**本单不发明** 路径 / 方法 / 闸 / 请求体 / 发起方；**若确需新增入口 ⇒ 属本册冻结事项**（三件：路径 + 闸 + **注册点 69 → N**）。**（二）口径冲突（两侧均逐字现取）**：**A 侧** = `data-layer.spec` **`DL67`（**v0.11 基线 `:459`** ⇒ **本版现取 `:460`**）**「**下架无账务动作**（保证金不退；**不存在罚没**，v0.3 裁定）」+ **`DL88`（**v0.11 基线 `:535`** ⇒ **本版现取 `:536`**）**「**上市即消耗**……**不可退、无罚没、无退还 kind** ⇒ 交易所路由**不得**提供「退还保证金」按钮或接口」（**均标【已冻结】**）；**B 侧** = **`R-8-2` 的 (b) 项**「**退市退还走既有 `hold_release` 路径**」⇒ **字面互斥**。**处置（写死）**：`DL67`/`DL88` **行体一字未动**（只追加口径）；**本单不裁定谁取代谁**；**须 Zang 明确读法**（二者择一 或 给「并存条件」）；**读法落定前实现方不得实现退还路径**。**★ 双向判负（写死）**：(i) 据 `DL88` 拒绝实现 ⇒ 违反 `R-8-2`（判负）；(ii) 据 `R-8-2` 改写 `DL67`/`DL88` 行体 ⇒ 违反只追加 + 已冻结条文不可静默重写（判负）。**落点 = §20.2(c) + §20.5(d) + §20.9 `I-4` / `I-6`；姊妹册同批登记 = `data-layer.spec` v0.12 §23.8**。 |
| **7-74（v2.5 新增）** | **★ `hold_forfeit` 禁线（`R-8-2` 冻结 · 本片最易踩雷）** | **★ 已立（本单）** | **裁定（逐字）**：**严禁实现 `hold_forfeit`、严禁复活任何已删名**；**冻结口径 = `hold_forfeit` 未启用、无可罚没标的物**。**真源（现取三处）** = `data-layer.spec` **`DL91`（**v0.11 基线 `:538`** ⇒ **本版现取 `:539`**）**「**`hold_forfeit` 在 P3 不启用**……**登记为待裁决**、**不预先启用**」+ `backend-ts/src/ledger.ts:149-150` 「**`listing_deposit_forfeit`：P1c 新裁定删**（保证金在上市时即消耗、进平台收入 `uid=-1`……」+ `DL67`/`DL88` 的「**无罚没**」。**★ 判负三条（写死）**：① **本片新增件（代码 / 迁移 / 路由 / 测试）出现 `hold_forfeit` 字面 ⇒ 判负** —— **★ 射程声明**：**既有在册件**（`0001` / `0003` / `0004` / `0008` / `0012` / `0019` / `0020` 的 kind 关闭集与账户守卫、`ledger.ts:154` 的 kind 字面数组）**属历史事实、不在射程**⇒ **不得**据本条去删 / 改（`migrations/**` 已 apply ⇒ **禁改**）；② **退还额被配置键二次改写 ⇒ 判负**（**退还 = 退回**，金额真源 = `currency.deposit_amount`，**不是**按新配置重算）；③ **退还走非 `hold_release` 的分录组合 ⇒ 判负**（只允许 `0020:381-382` 的同账户两腿 + **既有** kind `hold_release`；**不得新增 kind** —— 关闭集 **20 个**恒不动，`0019:155-158` 现取）。**落点 = §20.5(c) + §20.9 `I-5`**。 |


**★★ §7 追加补注块（v2.5 · **不改上表任何既有行的正文，只追加**）**：
> ㊲ **`§7-64` / `§7-67` / `§17.4`（保证金金额的载体键名 + 数值 · 待 Zang / Kevin）**：**三处行体一字未动**（仍写「候选 = `listing_deposit_policy`，**候选、不构成裁定**」/「**本册不发明**」/「**数值待 Kevin**」）。**8③ 已入册** ⇒ **读法更新 = §20 + 姊妹册 `data-layer.spec` v0.12 §23.1 的 `AK2` 行**：**键名 = `listing_deposit_policy`（「候选」二字自入册版起作废）**；**入册时点 = 本版（v2.5 / v0.12）**；**数值仍待 Kevin**（兜底常量标 `TODO: Kevin 定值`）；**★ 新增的两条边界**（本片现取发现，均须随本片读）：**(i)** **「在册」≠「可写」** —— 现取代码面**无键级寻址**且 `APP_CONFIG_LEGAL_KEYS` 仍 = 1 键（`database.ts:47`）⇒ **实现单必须先落 §20.6 的两件事**（`§7-72`）；**(ii)** **退市退还的触发面仍缺**，且与 `DL67`/`DL88` **口径相抵** ⇒ **停报**（`§7-73`）。


**★★ §7 v2.6 追加表（**不插入上表 · 只追加 · `§7-1…7-74` 一字未动**）**：

| # | 未决项 | 状态 | 依据 / 落点 |
|--:|---|---|---|
| **7-75（v2.6 新增）** | **★ `app_config` 键级寻址线格式**（承接 `§7-72` 的缺口：第二个合法键入册后写入面不可达） | **★ 已冻结（本单）+ 实现待 8③b 实现单** | **线格式（键面正文）= 姊妹册 `data-layer.spec` v0.13 §24.1**：请求体两形态 —— **形态 A**（既有裸值对象 · 隐含目标键 = `system_settings` · **逐字兼容**）+ **形态 B**（显式信封 `{"key": "<合法键名>", "value": {…}}` · 判别 = 请求体含自有属性 `key`）；**单键寻址 · 多键明确不采纳**（三条理由）；本册侧三件 + 三条判负 = **§21.1**；**写口复用 / 注册点 69 → 69**。**★ 落地两件事（均属 8③b 实现单）**：**(i)** 形态 B 解析 + 按目标键选字段闭集；**(ii)** 写落点参数化（现取 `database.ts:3190` / `:3167` 的 `'system_settings'` 字面）。**收口 `§7-72`**（见补注块 ㊳）。 |
| **7-76（v2.6 新增）** | **★ `ops:` 幂等键必须按目标 key 派生**（姊妹册 `data-layer.spec` §22.5 的 **`O-3`** · 与 `§7-69` 同族） | **★ 已冻结（本单）+ 实现待 8③b 实现单** | **冻结式 = `ops:<admin_uid>:setting:<目标键名>`**（§21.3(b)）；**形态 A ⇒ 键形逐字不变**（`ops:<uid>:setting:system_settings`）；**现取写死者 = `index.ts:1162`**（`O-3` 行体记的 `HEAD:index.ts:1147` 为 8① 时点，**已漂**）；**判负六条 = §21.3(c)**；**零新增码 / 零新增 `reason` 常量**。 |
| **7-77（v2.6 新增 · 收口项）** | **★ `§7-73` 的 (二) 项（`DL67`/`DL88` ↔ `R-8-2` 的口径冲突）** | **★ 已收口（Zang `R-8-17`）** | **裁断（逐字）= `R-8-17` 第 2 条**：「**`R-8-2` 的 (b)「退市退还」正式作废** —— 依 `DL67`/`DL88`/`R31` 冻结口径：「下架**无账务动作**、保证金**不退**、**无罚没**、**不得提供退还接口**」；**`hold_release` 与 `listing_deposit` 无关**」（`docs/seafood.master-plan.md:1523`）；**正文 = §21.5 更正块**（**`§20.5` 正文一字未动**）；**★ 同时 moot 其 (一) 项（退市触发面缺失）** —— `R-8-17` 第 4 条：**下架无账务动作 ⇒ 无需 `delist` 路由**（`moot`）。**`§7-73` 行体一字未动**（见补注块 ㊳）。 |


**★★ §7 追加补注块（v2.6 · **不改上表任何既有行的正文，只追加**）**：
> ㊳ **`§7-72` / `§7-73` / `§7-74`（v2.5 三行 · 本片收口口径）**：**三行行体一字未动**。**读法更新（写死）**：**(1)** **`§7-72`（键寻址面缺口）**：**已收口** —— 线格式**已冻结**（姊妹册 `data-layer.spec` v0.13 §24.1 + 本册 §21.1）；**其「本单不选、不发明」与 `§20.9 I-1` 的「线格式待定」自此作废**（读法以 §21.1 为准）；**(2)** **`§7-73`**：**(一) 项（退市触发面缺失）= moot**（`R-8-17` 第 4 条）；**(二) 项（口径冲突）= 已收口**（`R-8-17` 第 2 条；正文 = §21.5）；**⇒ 该行整体自本版起「已关闭」，不再是停报项**；**(3)** **`§7-74`（`hold_forfeit` 禁线）**：**仍然有效、射程不变**（`R-8-17` **未**收缩它；它属 `R-8-2` 的**未被推翻**半句）；**(4)** **`§7-64` / `§7-67` / `§17.4`（保证金载体键名 + 数值）**：**载体已入册**（姊妹册 `data-layer.spec` §23.1 的 `AK2`）+ **线格式已冻结**（本片）⇒ **仅剩「数值待 Kevin」一项**（`TODO: Kevin 定值`）；**三处行体一字未动**；**(5)** **本片对 `§7-69`（`commission_policy` 写口无 `ops:`）不涉**（该面归属 8② 面，`R-8-15` 已裁）。

## §8 变更记录与自曝

### 8.1 v0.2 变更记录（**折入 P4 批 1 / 批 2 实测 + Zang 裁定**）

| 版本 | 日期 | 作者 | 内容 |
|---|---|---|---|
| **v0.1** | 2026-09-29 | **Jing** | **首版。八节**：§0 元信息/口径/权威输入（六处）+ 支撑读数；§1 **51 端点逐条处置**（live 行号）+ 18 条新增端点 + 命名张力 + 404 兜底；§2 **前端契约冻结**（mapper key 集 + 23 文件 + 「后端没有的路径 = 0」）；§3 detail-miss 统一 404 + 逐码条件 + `R107` 七条；§4 **资金编排契约**（R1–R7 + 7 关闭集 + 18 事件 + 资金四栏 + 10 判决 + 幂等键总表 + 批切分）；§5 **弃用面最终处置**（13 面 `410` + 过期日）+ 三阶段时序；§6 权限单一真源 + 5 步判定 + 4 表守卫 + 3 守门函数；§7 未决 13 项；§8 本表 + `NOT_MEASURED` + 自曝 |
| **v0.2** | 2026-09-30 | **Jing** | **修订单**。折入 P4 批 1/批 2 实测与 Zang §5.73/§5.74/§5.76/§5.77/§5.78 裁定，**共 9 组 delta**（逐条见 `docs/audit/route-layer-v0.2-delta.md`）：① **路径改标 ×2**（`/api/job/:jobId/{apply,accept}`、`POST /api/listing` ⇒ **服务层已实现、路由层随批 4**）+ §1.2 母约束补 **「批 2 不新增对外路径（注册点冻结 51）」理由**；② §6.4 更正为 **6 键**；③ §6.5 **`isAdminAddress` 顺序依赖**（先批 6 种子、后收敛）；④ **401/403 统一 `R107` 已落地**（§3.4）+ 前端同步；⑤ **`ops:` 幂等键请求侧强校验**（§4.5）；⑥ **§2.4 批 4 前端同步清单**（新增）；⑦ §7-15/§7-16 **`DL38` 落点读法 + 费率键黑名单 ⇒ 待 Zang**；⑧ **§1.4 批 2 已落地事实**（13 个 `410` + `prize-item` 正式化 + 两处 `404`）；⑨ **§7 十三项终审状态逐条给出（已定/仍待）** + §5.78 新裁定的落地；另增 §1.5 行号对照、§5.3 更新（3 处→2 处）、§4.6 批 2 实交、7-14 与 7-17..7-21 新增未决 |
| **v0.3** | 2026-09-30 | **Jing** | **§7-3 校正单（折入批 3a 实测 + Zang §5.80/§5.81）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v0.3-delta.md`）：① **§7-3 全面更正**（`listing_deposit` = **上市即消耗 → 贷 `-1`**；不可退/无退还 kind/无罚没）+ **显式登记「v0.2 的『冻结可退』是错误推断，由 Zang §5.81 纠正，根因 = `HOLD_KINDS` 误含 `listing_deposit`（P1c 漏删），已由 `0019` + `ledger.ts` 手术修正」**；② **§4.2 新增事件行 C1/C2（改为已落地形态）+ 新增 C3（退市/罚没 = P3 无此动作）**，并把「将来若做强制下架罚款 = 新语义新 kind，须单独裁定」写进 §7-22；③ **§4.5/§4.2 幂等键由「待定」正式化为批 3a 落地形态**（`biz:currency:create:<symbol>` / `biz:currency:list:<cid>`，真源 = `currency-service.ts` + `p4-b3a-currency-funds.md`）；④ **§4.4-11 新增「金额必须服务端取数」硬口径**（标 `FIX-B 落地`）+ §7-23；⑤ **非 owner 的码统一为 `403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED`**（§4.2 C2 期望码列删 `LD014`，与 §3.2「禁返回」一致）；⑥ **§4.1 关闭集校正**（`hold` 家族**移除** `listing_deposit`；`-1` credit 白名单**加入** `listing_deposit`）＋ §4.3/§4.4-7 同步；⑦ **新增 §1.6「批 3a 已落地事实」**（G1–G6）+ §0.3 三条实测读数 + §0.1 新增 **I8**；⑧ **§7 状态列更新**：**7-3 更正**、**7-15 补齐 `DL38` 原文落点 + 两读法实证差异**（仍待 Zang）、**7-16 记 Zang 方向裁定 + `0017` 无键名枚举的实证**（仍待 Zang）、7-17 追加批 3a 实证、**新增 7-22/7-23**；另 **§5.3/§1.1 的 C1/C2 行改标已落地**、§4.6 批 3 行更新 |
| **v0.4** | 2026-09-30 | **Jing** | **批 3a 真收官折入 + Zang §5.82/§5.84 四裁定落地**，**共 10 组 delta**（逐条见 `docs/audit/route-layer-v0.4-delta.md`）：① **§7-3 补 Zang §5.80 留痕**（「§5.80 曾批准『冻结可退』，已由 §5.81 作废并纠正」）；② **§7-15 定案**（读法①「旧查询函数调用数 = 0」为准 + 三补强：具名函数清单 / 同核 5 组端点 200·404·410 / 类级扫描）；③ **§7-16 定案**（采纳 (A) **删除**自拟 `FEE_RATE_KEY_PATTERNS`；真源唯一改由读取侧纪律保证；登记「`app_config` 合法键清单/写入门禁」为**批 6 配置面规格**）；④ **§7-23 定案**（机制已落地、数值待 Kevin）；⑤ **低于下限借码正式化**进 §3.2/§4.4-12（`LEDGER_AMOUNT_NOT_POSITIVE` + `details.reason=BELOW_SERVER_FLOOR`）+ **C1-T05/C2-T17 期望改 `200`**；⑥ **新增 §7-24**（401/403 无 access log 的取证口径）；⑦ **§1.7 新增**（批 3a 真收官 H1–H8：`0019`/`0020` 已应用 / `HOLD_KINDS` 5→4 / C2 4 腿全在 `balance` / 金额服务端下限）+ §1.6 改标「历史读数，保留不删」；⑧ **§0 / §0.1 / §0.3 同步**（`schema_version=0020`、注册点 53 复核、`migrations` I4 / 审计四件 I8、4 条新读数）；⑨ **§4.1 / §4.2 / §4.3 同步**（hold 家族双处摘除、`-1` 白名单已应用、C1/C2 真收官形状 + 下限码）；⑩ **§3.4 取证口径精化**（P4-SEC 已把 infra 分类 **503**）；另 **`data-layer.spec.md` 追加式加注（§18，就地升 v0.7）+ 快照 `data-layer.spec.v0.6.md` 新建** |
| **v0.5** | 2026-09-30 | **Jing** | **批 3b「招工资金」折入 + ★新纪律落地（「已实现·未注册清单」）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v0.5-delta.md`）：① **★新增 §1.8「已实现·未注册清单」**（**真扫描实测 8 条 + 1 附注**；Zang 首批 3 条全含 + **本册多出 5 条并写明差异**；附「准入判据 / 扫描口径 / 负向排除 / 7 个已接线 verb 正向对照」）—— 依据 = **Zang §5.85 裁定① 新纪律**；② **新增 §1.9「批 3b 已落地事实」K1–K11**（330 行 / sha256 `7b808634…`；`database.ts` +3 method 与**单条 SQL** CTE；**注册点 53→53**；J1/J5/J6 读数；**DL86 两形态**；`ledger_entry` 42→76 枚举等式；**集成缺口 F-1**）；③ **两条既有路径行为 delta 定案**（非数字 `:jID` `400`→`404` 落 §3.1；撤 bespoke `400` 守卫）—— **Zang §5.85 裁定② 批准**，并登记回归项 **§2.4 S9 / §7-27**；④ **§4.4 新增判决 13–17**（J5/J6 零金额入参 / J1 fail-loud / 「结论位+资金同语句」原子 / `:jID` = `application_id` / 成功面 11·9 键冻结）；⑤ **§4.0 R1 精化**（账本层 vs 业务层两层口径 + 「零自拼分录」是**结构保证**）；⑥ **§4.2/§4.3/§4.5/§4.6/§5.4/§1.1/§1 #49 同步**（J1/J5/J6 批次改「批 3b 服务层已落地、路由随批 4」+ 资金四栏补实测读数 + 幂等键表补 fail-loud）；⑦ **§0/§0.1/§0.3 同步**（注册点 53 现取复核 + **行号漂移登记**〔`:1160→:1166`、`:1179→:1185`〕+ `migrations` 仍 19 ⇒ `schema_version` 仍 0020 + **I9** 批 3b 审计件 + 3 条新读数 + **行号口径由三分升为四分**）；⑧ **§7 新增 7-25 / 7-26 / 7-27**（`create_key` 口径〔3b 已定 · 2a 待审计 · `p4-aud-jobkey.md` **未落盘 ⇒ 审计在飞**〕/ §1.8 维护责任〔机制已定 · 责任人待 Zang〕/ 前端旧 `400` 全量核验）⇒ **7-1…7-24 一字未动**；另 **`docs/data-layer.spec.md` 本单未写、未建快照**（无 data-layer 规则变更，理由见 §8.7.1） |

| **v1.5** | **2026-10-02** | **Jing** | **§7-32「管理员退款发起」契约化单（**只写契约、零代码**）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v1.5-delta.md`）：① **新增 §12**（actor 面 / 权限闸 / 资金腿冻结 / 鉴权失败面 / 审计留痕硬项 + A·B 两变体 / 幂等 / 同语句可达性 / 注册面两变体 / **可证伪 AC 10 条** / 日累计取舍 / **待 Zang 终审 Z1–Z8**）；② **新增 §12.0 只读取证**（`0022`/`0023` 已 apply 真值 + 11 键 + 4 CHECK 闭集 + 无 `RAISE` + 现成可退门面 + `ledger_entry` 271）；③ **§7-32 行未改**（**不加注** —— 「就地加注」与「删除列 = 0」在同一行内冲突 ⇒ 取机器判据优先；读法更新 = §7-49 / §7-50 / §7-51 + 补注块 ⑳）；④ **新增 §7-49 / §7-50 / §7-51**（契约化兑现 / 权限闸选键 / 审计落点待裁）+ **补注块 ⑳–㉒**；⑤ **新增顶部 v1.5 状态块**（要点 ①–⑨）；⑥ **新增 §8.17**（声明 / `NOT_MEASURED` / 自曝 / delta 对照 / 纪律自检）；⑦ **审计落点与注册面两变体一律「交 Zang 终审、不二选一」**；⑧ **只追加自证**：**非追加改动 = 0 处**（**既有表格 / 单元格一字未动，含 §7-32**）、`git diff --numstat` 删除列 = **0**；**v0.1–v1.4 十四个快照一字未动**。**★ 与 v0.1–v0.5 行不同**：本行为**追加行**（v0.6–v1.4 未在该表补行，其变更记录见各自 §8.7–§8.16 节） | 

| **v1.6** | **2026-10-02** | **Jing** | **Zang 对 §12「管理员退款发起」Z1–Z8 终审的逐字落位单（**只追加 · 零代码 / 零迁移 / 库面只读**）**，**共 6 组 delta**（逐条见 `docs/audit/route-layer-v1.6-delta.md`）：① **§12 六处 v1.6 就地加注**（§12.1.1 · Z1 权限键；§12.3 · Z5 闸前拒绝不留痕；§12.4 · Z2 = 变体 B + Z2b = N/A + Z3 = 留痕；§12.6 · Z4 编排函数硬约束 + Z4b 不取 advisory lock；§12.7 · Z6 复用同路径 + actor 分流顺序；§12.9 · Z8 不需要日累计闸）；② **新增 §12.11**（Z1–Z8 终审逐字落位表 + **审计表契约 `admin_refund_audit_log` 逐列 / 约束 / 触发器 / 索引 / apply-time 自检（照抄 `0023`）** + **编排函数契约 `listing_refund_post_event(jsonb)`** + 路由 / 准入 / 错误码闭集 33 / `:62` 单点升级 + **3 条待 Zang 确认（T-1…T-3）** + **新增 AC-11/12/13（含判负自证）** + **实现面登记 I-9…I-15**）；③ **新增 §7-52…7-56 + 补注块 ㉓–㉕**（A1 无键面收口登记 / 审计面分裂 / Z2b 前提 / 闸前拒绝不留痕 / 三条待确认）；④ **新增顶部 v1.6 状态块**（要点 ①–⑪）；⑤ **新增 §8.18**（声明 / `NOT_MEASURED` / 自曝 / delta 对照 / 纪律自检）；⑥ **只追加自证**：**非追加改动 = 0 处**（**§7-32 / §7-49/50/51 状态格与 §12 既有表格 / 单元格一字未动** —— Z1–Z8 落位由**加注行 + §12.11** 承载）、`git diff --numstat` 删除列 = **0**；**v0.1–v1.5 十五个快照一字未动** |

| **v1.7** | **2026-10-02** | **Jing** | **§12.11.5 三条待确认（T-1/T-2/T-3）终审 + 四条附加硬约束的逐字落位单（**只追加 · 零代码 / 零迁移 / 库面只读**）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v1.7-delta.md`）：① **T-1 = 变体①**（审计表保留 `log_id` 身份证 PK，照抄 `0023:65` ⇒ 表 = **12 语义列 + 1 结构列（共 13 列）**；「12 列」= 语义列、不含 PK 结构列）；② **T-2 = 变体①**（`BEGIN … EXCEPTION WHEN SQLSTATE 'LD011' THEN … END` 捕获，先例 `0008:87/98/103`；**变体②预读 `status` 复制守卫否决** —— 第二真源 ⇒ 违反 Z4）；③ **附加硬约束①**（**白名单式捕获、严禁 `WHEN OTHERS`** —— 理由逐字 = 否则 `53300`/`XX000` 一类基础设施错误被吞成「被拒」，即本仓 D-04 / 真库「假成功」那类真缺陷；**AC-14 判负**：注入 `53300`/`XX000` ⇒ `result` 不得为 `rejected_state`、必须向上抛 ⇒ 既有分类器 **503**）；④ **附加硬约束②**（捕获后同函数内写审计行 + 返回回执 ⇒ 拒收回执与审计行一起提交；资金腿因子事务回滚而不留分录 = 零资金残留）；⑤ **附加硬约束③**（子事务回滚不得波及其他已写对象 ⇒ 审计行 `INSERT` 落在 `EXCEPTION` 处理器内）；⑥ **T-3 = 变体①**（404 不留痕；**射程写死** = 留痕面仅 409、不留痕面 = 401/403 + 404 + 400，与 Z5 同源；H6 读作函数体内、资金腿之前的状态机拒绝）；⑦ **回执键集裁定**（内部回执含 `result`/`txid`（拒绝 `null`）/`audit_logged`；对外零新增顶层键；与 F10 的 23 键 = 两层、禁止原样透传）；⑧ **新增 AC-14 / AC-15 + I-16…I-18**（白名单捕获判负 / 拒绝面零残留 + 同提交 + 子事务不波及其他对象 / 自检与注入夹具登记）。**★ 另**：**AC-11 的判负自证复核在位**（现取 `0015:670` `FOR UPDATE` + `0015:677-678` 只读根键探测；**本单未改该行一字**）。**本单只追加**：**非追加改动 = 0 处**（**§12.11.2–§12.11.6 既有表格 / 单元格一字未动**）、`git diff --numstat` 删除列 = **0**；**v0.1–v1.6 十六个快照一字未动** |
| **v1.8** | **2026-10-02** | **Jing** | **批 7-A 四条事实 / 纪律回写单（**只追加 · 零代码 · 零迁移 · 库面只读**）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v1.8-delta.md`）：① **注册点 65 → 68 全量回写**（正文 = **新 §1.14**：计数真源表 + 九处应改行号逐处现取复核表 + **三条消费点行 C1/C2/C3** + `ShardPage.jsx:303` 已不存在声明 + 行号口径升「七分」）；② **★ 新纪律「脚本类硬门口径」**（正文 = **新 §13**：`tsc --noEmit` 不覆盖 `scripts/**`／必须过 `tsc -p tsconfig.scripts.json --noEmit`／**新增零错**／存量债 **22 文件 77 条**登记／**旧读数作废声明**）；③ **错误文案必须过 `apiErrorMessage`**（正文 = **§14.1**：真源 `frontend/src/auth.js:177-187`；**已立为可判负门** `frontend/scripts/p7a-03-errmessage-gate.mjs`：类级扫描 + 基线 3 条 + 仓外镜像判负）；④ **两套取数入口并存 ⇒ P6/P7 合并待办**（正文 = **§14.2** + **§7-59**）；⑤ **错误形状口径（R107）**（正文 = **新 §15**：同一端点 400 类只许一种形状／形状非法 ⇒ 400 + 既有码 + `details.field` / `details.reason`（**§5.16 裁定**）／旧 `sendError` 形态判为非 R107；**同族面清单 = 转引 `docs/audit/p7-a-ledger-read-fix2.md`（未落盘 ⇒ `NOT_MEASURED`）**）；⑥ **新增 §7-59 / §7-60 / §7-61 + 补注块 ㉘–㉚**；⑦ **新增顶部 v1.8 状态块**（要点 ①–⑤）；⑧ **新增 §8.20**（声明 / `NOT_MEASURED` / 自曝 / delta 对照 / 纪律自检）。**本单只追加**：**非追加改动 = 0 处**（**九处应改行号「不改字、只追加承载」** —— 守「删除列 = 0」的机器判据；读法更新由 **§1.14 + §13/§14/§15** 承载）、`git diff --numstat` 删除列 = **0**；**v0.1–v1.7 十七个快照一字未动** | 


| **v1.9** | **2026-10-02** | **Jing** | **两批落地事实与 Zang 终审回写（**只追加 · 零代码 · 零迁移 · 库面只读**）**，**共 6 组 delta**（逐条见 `docs/audit/route-layer-v1.9-delta.md`）：① **§12.3 G2 就地订正**（**本仓自身发现的真矛盾**：非卖方非 admin 的 G2 旧写 `reason='NOT_ADMIN'` vs AC-13④ `ACTOR_NOT_ALLOWED`；**Zang 终审以 AC-13 为准** —— 非卖方非 admin ⇒ `ACTOR_NOT_ALLOWED`、admin 缺 `manage_points` ⇒ `PERMISSION_NOT_GRANTED`、**`NOT_ADMIN` 不在本路由使用**、**AC-13⑥ 不可达分支已删除**；**旧写法逐字留痕**）；② **AC-11 判负改可复现三条**（原「移除 `0015:670` 的 `FOR UPDATE` ⇒ `+4`」需第二个库 / 需改已应用迁移 ⇒ 结构性不可行 ⇒ **源码级 `position('FOR UPDATE' …)` + 竞争实测〔阻塞 > 0〕+ 正向〔恰一次生效〕**；`+4` 判负登记归 **P8 前可选**）；③ **回退护栏（`ledger.err.*`）纪律 + 132 键登记**（正文 = **§14.3（新）**：`t()` 未命中 ⇒ 四语通用兜底 / 用户可见文案不得出现裸键 / 真源 `frontend/src/auth.js` / 可判负门 `frontend/scripts/p7b-errfallback-gate.mjs` / **132 键〔33 码 × 4 语〕逐码本地化 = 产品文案决策 ⇒ 登记 P6/P7 待定** / 护栏让位语义写死）；④ **同族 `sendError` 26 处登记 + `:1482` 勘误**（正文 = **§15.4（新）** + **§15.2 加注**：**转引** `docs/audit/p7-a-ledger-read-fix2.md §5` / 只登记不修 / 点名 `/api/admin/points/adjust` message 硬编码中文「参数不完整」非 R107、行号 `:1482`（注册行 `:1472`）· `:1477` 作废）；⑤ **迁移 `0024` 已 apply 事实**（正文 = **§12.13（新）**：`schema_version=0024` / checksum `b2495845…` / 表 `admin_refund_audit_log` / 函数 `listing_refund_post_event`（`post_event_functions` 5→6）/ 触发器 44→45 / `Σbalance(cid=1)` 零位移 / 注册点 68 / 前端零改动）；⑥ **新增顶部 v1.9 状态块 + §8.21**（声明 / `NOT_MEASURED` 六项 / 自曝 5 条 / delta 对照 / 纪律自检）。**本单只追加**：**非追加改动 = 0 处**（**§12.3 / §12.11.6 / §15.2 的正文与表格 / 单元格一字未动** —— 订正与更新**全部**由**新增加注行 + 新小节**承载）、`git diff --numstat` 删除列 = **0**；**v0.1–v1.8 十八个快照一字未动** |
| **v2.0** | **2026-10-02** | **Jing** | **两条小订正 + 一条确认 —— Zang 自我更正 + 载体定层 + 措辞确认（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP**）**，**共 4 组 delta**（逐条见 `docs/audit/route-layer-v2.0-delta.md`）：① **AC-11 期望订正（Zang 自我更正 · 派单 ①）** —— 「并发两笔同订单 ⇒ 另一笔 `409 LEDGER_CURRENCY_INVALID_TRANSITION`」**作废**（真因 = **退款幂等键由 `order_id` 派生** ⇒ 第二笔是**幂等重放**）⇒ **正确期望 = 另一笔 `200` + `idempotent_replay:true`（`txid` 与首笔逐字相同）**；**保留**「资金腿恰一次（`Δpurchase_refund` 恰 `+2`）」+「审计行恰 1 行」；**旧写法逐字留痕**（就地点 = **§12.11.6 v2.0 加注**；实测佐证 = `p7b-07-ac11-collect1.json`）；② **「同键异内容 ⇒ `409`」载体定层 = DB 层（派单 ②）** —— **正式载体 = DB 层**（实测 `LD003` `LEDGER_IDEMPOTENCY_CONFLICT`，`p7b-08-e2e-http-collect1.json` · `item8_same_key_diff_content_db`）；**HTTP 面 = `NOT_APPLICABLE`**（键与指纹同由 `order_id` 派生 ⇒ 构造不出）；**旧写法留痕**（就地点 = **§12.5 v2.0 加注**）；③ **AC-13⑥ 措辞确认（派单 ③）** —— **确认正确**：**路由分支已删除〔本仓禁死代码〕** 与 **`NOT_ADMIN` 常量保留供既有 admin 面** **= 两句并列、不矛盾**（就地点 = **§12.11.6 v2.0 加注**）；④ **新增顶部 v2.0 状态块 + §8.22**（声明 / `NOT_MEASURED` / 自曝 / delta 对照 / 纪律自检）。**本单只追加**：**非追加改动 = 0 处**（**§12.5 / §12.11.6 正文与表格 / 单元格一字未动** —— 订正与定层**全部**由**新增加注行 + 新小节**承载）、`git diff --numstat` 删除列 = **0**；**v0.1–v1.9 十九个快照一字未动** |
| **v2.1** | **2026-10-02** | **Jing** | **R107 `message` 语义写死 + 存量偏离登记 + 批 7-C/7-D 成果回写（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**）**，**共 6 组 delta**（逐条见 `docs/audit/route-layer-v2.1-delta.md`）：① **R107 `message` 语义写死**（正文 = **§3.3 v2.1 就地加注〔条款 9′〕** + §15.5：`code` 机读唯一真源 / `i18n_key` 本地化真源 / **`message` = 人类可读稳定英文句、严禁机读码**）；② **存量偏离清单**（正文 = **§15.5〔新〕· A–F 六类**：`fail` 第 4 参缺省回退〔现取 7 处回退位〕/ `fromLedgerError` 以 `message = mapped.code`〔现取 4 处 × 2 支 = 8 赋值点〕/ `sendAuthError` 以 `message = code`〔`index.ts:256-263`〕/ `sendError` 同族〔**26 处** · 转引 `p7-a-ledger-read-fix2.md §5` 逐条判定表〕/ `sendVerbError` 通道〔非偏离〕/ `LEDGER_ERROR_TABLE` 中文 message〔语言面 · 待 Zang〕）—— **全部既有面 · 技术债 · 分批实现 · 非阻塞**；③ **前端错误文案链四跳 + 机读码判据**（正文 = **§14.3 v2.1 就地加注** + **§16.1/§16.2**：① `t(i18n_key)` → ② 服务端原文 → ③ 四语通用兜底 → ④ ASCII；**② 的 `message` 与 `details.reason` 命中「全大写下划线机读码」⇒ 视为不可用**〔批 7-C `message` 面 / 批 7-D R1′ `reason` 面〕）；④ **33 码闭集已逐码本地化**（正文 = **§16.3**：`ledger.err.<CODE>` · **四语键集相等** · 每语 **33** 键 / `flat = 737`；门读数 `p7b`「需护栏 132→0 / 已本地化 0→132」· `p7a-03`「命中 0 / 基线 0」）；⑤ **正向约束**（正文 = **§15.6〔新〕**：新增错误面不得把码塞进 `message` · 类级可判负门）；⑥ **新增顶部 v2.1 状态块 + §8.23**（声明 / `NOT_MEASURED` 八项 / 自曝 6 条 / delta 对照 / 纪律自检）。**本单只追加**：**非追加改动 = 0 处**（**§3.3 / §14.3 / §15.4 的正文与表格 / 单元格一字未动** —— 加注与更新**全部**由**新增加注行 + 新小节**承载）、`git diff --numstat` 删除列 = **0**；**v0.1–v2.0 二十个快照一字未动** |
| **v2.2** | **2026-10-02** | **Jing** | **批 8 首轮契约冻结（服务切片 8①：`app_config` 管理 + 合法键清单 + 写入门禁）—— `R-8-1` / `R-8-3` / `R-8-4` / `R-8-5` 逐字落位单（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP**）**，**共 6 组 delta**（逐条见 `docs/audit/route-layer-v2.2-delta.md`）：① **权限映射表**（正文 = **§17.2**：先现取逐字十一键〔`database.ts:11-23` ↔ `0022:50-61` ↔ `admin-utils.js:40-52`〕，再给「8 片所需权限 → 既有键」映射；**8① = `manage_settings`**；**8 ⑦ = 「无 ⇒ 停报」**〔§7-62〕；**8 ④⑤ = 临时复用 `review_tasks`、须确认**〔§7-63〕）；② **写口准入**（正文 = **§17.3**：`GET /api/admin/settings`〔`index.ts:1125`，闸 `:1126`〕/ `POST /api/admin/settings`〔`:1142`，闸 `:1143` + `ops:` 键 `:1147` + 费率键闸 `:1155`〕+ `AR1`–`AR4`）；③ **载体键名约定**（正文 = **§17.4**：保证金金额**载体 = `app_config` 合法键**；命名风格从现取唯一先例 `system_settings` 反推；**键名 / 数值待 Zang / Kevin**，候选 = `listing_deposit_policy`，**候选不构成裁定**）；④ **审计台并联对账**（正文 = **§17.5** + **7-62** + 补注块 ㉛：以 `ledger_entry` 为主轴左联 `0023`/`0024` 两表只读、**不合并表不迁移**、统一呈现、**判据 = 每条 admin 动作锚到 `ledger_entry.txid`**、**拒绝行 `txid = NULL` 豁免**）；⑤ **`app_config` 键清单 / 门禁**（姊妹册 = `data-layer.spec` **v0.10 §21**，本册**只指路不重抄**）；⑥ **新增顶部 v2.2 状态块 + §7 v2.2 追加表〔7-62/7-63/7-64〕+ 补注块 ㉛/㉜ + §8.24**（声明 / `NOT_MEASURED` / 自曝 6 条 / delta 对照 / 纪律自检 / 只追加自证）。**本单只追加**：**非追加改动 = 0 处**（**`§7-1…7-61` / `§7-16` / `§7-23` / `§7-53` / `§1`–`§16` 一字未动** —— 全部落位由**新增节 §17 + 追加行 + 补注块**承载）、`git diff --numstat` 删除列 = **0**；**v0.1–v2.1 二十一个快照一字未动**；**同批** `docs/data-layer.spec.md` **v0.9 ⇒ v0.10（§21）** + 快照 + delta。 |
| **v2.3** | **2026-10-02** | **Jing** | **批 8 首轮冻结「补正单」—— `R-8-7` / `R-8-8` / `R-8-9` 落位 + 勘误块（`D-1`）+ 新纪律「引用纪律」+ `AG1`/`AG3` 借码映射入册（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v2.3-delta.md`）：① **`R-8-7` 落位**（正文 = **§18.2** + **新增 7-65** + 补注块 ㉝：**8 ⑦ 审计台读口 = 复用 `manage_points`**；**`read_users` 【已排除】**；**独立只读审计键 ⇒ 跨批**；**收口 `§7-62`**）；② **`R-8-8` 落位**（正文 = **§18.3** + **新增 7-66** + 补注块 ㉞：**确认 8④⑤ = 临时复用 `review_tasks`** + **附带条件「⑤ takedown 后续成独立动作面 ⇒ 再报 Zang 裁」**；**收口 `§7-63`**）；③ **`R-8-9` 落位**（正文 = **§18.4** + **新增 7-67** + 补注块 ㉟：**键名批准 = `listing_deposit_policy`**；**入册时机 = 8③ 冻结时**；**★ 8①/8② 不得先行写入**；**数值仍待 Kevin**；**★ 本单只声明批准与入册时机、未把该键当已入册**；**收口 `§7-64`**）；④ **★ 勘误块 `D-1`**（正文 = **§18.5**：三处错引 **`:1798` / `:3922` / `:4030`** 的**逐字位置 / 错因 / 正确锚 `§12.1.1:3080`（节头）· `:3096`（内容行） / 逐字原文**；**原行一字未改**）；⑤ **★ 新纪律「引用纪律」**（正文 = **§18.6** + **新增 7-68**：**现取且逐字**；**空行 / 不存在行 / 非逐字引文 = 缺陷**；**可判负形态**）；⑥ **★ 借码映射入册（`AG1`/`AG3`）**（正文 = **§18.7**：**借 `LEDGER_AMOUNT_INVALID`(400)**，授权 = `ledger.spec` §14.3；`details.reason` = **稳定常量**；**驳回 `LEDGER_UNKNOWN_KIND`**；**闭集 33 不动**）；⑦ **切片编号对齐 + 其余登记**（正文 = **§18.8**：**以 Zang §5.179 C 定稿为准 = 8①..8⑥**；`O-3` / `D-2` / `D-3` / `D-4` 逐条入 delta 件）；⑧ **新增顶部 v2.3 状态块 + §8.1 表 v2.3 行 + §8.25**（声明 / `NOT_MEASURED` 六项 / 自曝 4 条 / delta 对照 / 纪律自检 / 只追加自证）。**本单只追加**：**非追加改动 = 0 处**（**`§7-1…7-64` / `§17` / `§1`–`§16` 一字未动** —— 全部落位由**追加行 + 补注块 + 新增节 §18 + §8.25** 承载）、`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**；**v0.1–v2.2 二十二个快照一字未动**；**同批** `docs/data-layer.spec.md` **v0.10 ⇒ v0.11（§22）** + 快照 + delta。 |
| **v2.4** | **2026-10-02** | **Jing** | **批 8 第 2 片（8②）契约冻结：费率配置 + 返佣权重矩阵（**合片**）—— 读写口契约 + 新增 admin 读口注册点 + 权限键映射 + 「真生效」四段判据 + 后台页数据契约与四语文案面 + `R-8-14` 基线声明（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**）**，**共 8 组 delta**（逐条见 `docs/audit/route-layer-v2.4-delta.md`）：① **读写口契约**（正文 = **§19.2**：写口现取 `POST /api/admin/commission_policy`〔`index.ts:1999`，闸 `:2000` `manage_settings`〕+ 真写库点 `src/commission.ts:240`（`:247` 单条 `INSERT … SELECT … WHERE NOT EXISTS` = **CR8 INSERT-only**）+ **`ops:` 键现取 = 无**；**读口现取 = 无** ⇒ **冻结新增 `GET /api/admin/commission_policy`**（**同路径同族先例** = `GET|POST /api/admin/settings`）+ **注册点 68 → 69** + **`data` = `CommissionPolicy` 8 键** + **`R-8-6` 双向判负**〔`§7-70`〕）；② **权限键映射**（正文 = **§19.3**：先现取逐字十一键〔`backend-ts/src/database.ts:11-23` ↔ `backend-ts/migrations/0022_admin_permission_seed.sql:50-61` ↔ `frontend/src/admin-utils.js:40-52`〕，再映射 —— **写口 / 读口 / 两页 = `manage_settings`**（+ `dashboard_access` 进面板）；**零新增键**）；③ **「真生效」四段判据**（正文 = **§19.4**：①后台写→②库内落值〔给表 / 列〕→③业务读口取数〔给 `文件:行`〕→④行为随之〔改动前后两读数〕；**每段带判负**；**不得只验「后台能存」**；逐项 = `fee_rate_bp` ⇒ 下一笔 `job_fee` 金额随之变 / `weights_bp` ⇒ `commission` 各层 `x_L` 随之变且 `Σx_L == fee` 与 `-2` 池守恒仍绿）；④ **后台页数据契约 + 四语文案面**（正文 = **§19.5** + **`§7-71`**：两页字段 = 现取 `CommissionPolicy` 8 键；**四语 `admin*` 命名空间承先例**〔`adminFeeRate` / `adminWeightMatrix`〕；**禁工程口径泄漏六类 + 正则判负 + 负对照**）；⑤ **`R-8-14` 落位**（正文 = **§19.6** + 补注块 ㊱：**`§18.5` / `§18.1` 行锚 = v2.2 基线（4030 行）**；**逐条漂移对照表（`+12` / `+56`）** + **可判负形态** + **「引 `sed -n` 须给命令 + 版本 + 期望输出三件」**）；⑥ **`ops:` 缺口登记**（正文 = **`§7-69`**：`POST /api/admin/commission_policy` 现取**无** `ops:` 键；候选形态**不构成裁定**）；⑦ **`data-layer.spec` 判「无须动」**（理由逐字见 delta 件 §D7 ⇒ **不升 v0.12 / 不建快照 / 不建 delta**）；⑧ **新增顶部 v2.4 状态块 + §8.1 表 v2.4 行 + §19〔新〕+ §8.26**（声明 / `NOT_MEASURED` 七项 / 自曝 5 条 / delta 对照 / 纪律自检 / 只追加自证）。**本单只追加**：**非追加改动 = 0 处**（**`§7-1…7-68` / `§17` / `§18` / `§1`–`§16` 一字未动** —— 全部落位由**追加行（7-69…7-71）+ 补注块 ㊱ + 新增节 §19 + §8.26** 承载）、`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**；**v0.1–v2.3 二十三个快照一字未动**。 |
| **v2.5** | **2026-10-02** | **Jing** | **批 8 第 3 片（8③）契约冻结：上市保证金「可配置 + 退市退还」—— 载体键入册（`AK2`）+ 下限校验机制（数值待 Kevin）+ 权限键映射 + 「真生效」四段判据 + 退市退还 ↔ 既有 `hold_release` 路径 + `hold_forfeit` 禁线（**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**）**，**共 9 组 delta**（逐条见 `docs/audit/route-layer-v2.5-delta.md`）：① **载体键入册**（正文 = **§20** + **姊妹册 `data-layer.spec` v0.12 §23.1 的 `AK2` 键行**：键名 = `listing_deposit_policy`；清单现取 = 恰 1 键 ⇒ **入册后 = 恰 2 键**；**入册前写入必被拒的可判负形 = 现取代码面判据**〔`database.ts:775` 未知键分支 + `:47` `APP_CONFIG_LEGAL_KEYS`〕）；② **下限校验机制**（正文 = **§20.7**：机制已在〔`currency-service.ts:155` + `:165-172`〕，本片只把 `floor` 来源改为「先读 `AK2` · 读不到 / 非法 ⇒ **fail-closed 到常量**」；**数值 = 待 Kevin**；**客户端永不决定金额** + 判负三条）；③ **权限键映射**（正文 = **§20.3**：先现取逐字十一键〔`database.ts:11-23` ↔ `0022:50-61` ↔ `frontend/src/admin-utils.js:40-52`，本单三档亲读〕⇒ **写口 = `manage_settings`**；**退市账务面 = 无 ⇒ 停报**；零新增键）；④ **「真生效」四段判据**（正文 = **§20.4**：①改键→②库内落值〔表 `public.app_config` / 列 `key` / `value` / `updated_by` / `time_updated`〕→③业务读口取数〔`currency-service.ts:350`〕→④行为随之〔`currency.deposit_amount` + `ledger_entry` 两腿 `listing_deposit` 的改动前 / 后两读数〕；**每段自带判负**；**不得只验「后台能存」**）；⑤ **退市退还 ↔ 既有 `hold_release` 路径**（正文 = **§20.5**：逐字真源五处〔`ledger.ts:1394`/`:1399`、`0020:381-382`、`0020:573`、`ledger.ts:203`、`0016:670`+`:674`〕；**退还金额真源 = `currency.deposit_amount`；退还 ≠ 重算**；**★ 口径冲突登记** = `DL67`/`DL88`「不可退」↔ `R-8-2`「退市退还」⇒ **本单不择一，停报 Zang**，**双向判负**）；⑥ **`hold_forfeit` 禁线**（正文 = **§20.5(c)** + **新增 `§7-74`**：`R-8-2` 逐字 + `DL91`/`ledger.ts:149-150` 真源 + **判负三条** + **射程声明**）；⑦ **注册口判决**（正文 = **§20.2**：写口**复用** `POST /api/admin/settings`；读口**判「不新增」**；**注册点 69 → 69**；**退市触发口现取无 ⇒ 停报，不得自造路由**）；⑧ **三项登记**（= **`§7-72`〔键寻址面缺口〕/ `§7-73`〔退市触发面 + 口径冲突 · 停报〕/ `§7-74`〔`hold_forfeit` 禁线〕** + 补注块 **㊲**）；⑨ **新增顶部 v2.5 状态块 + §8.1 表 v2.5 行 + §20〔新〕+ §8.27 + §20 节首的行数口径判明（`wc -l` = 4589 / 逻辑行数 = 4590；差 1 = 末行 `---` 不带换行）**。**本单只追加**：**非追加改动 = 0 处**（**`§7-1…7-71` / `§17` / `§18` / `§19` / `§1`–`§16` 一字未动** —— 全部落位由**追加行（7-72…7-74）+ 补注块 ㊲ + 新增节 §20 + §8.27** 承载）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**（见 §8.27.6）；**v0.1–v2.4 二十四个快照一字未动**；**同批** `docs/data-layer.spec.md` **v0.11 ⇒ v0.12（§23）** + 快照 + delta。 |


> **★ 上表口径注（v1.5 追加）**：**v0.6–v1.4 的变更记录不在上表**（各自成节：§8.7 / §8.8 / §8.9 / §8.10 / §8.11 / §8.12 / §8.13 / §8.14 / §8.15 / §8.16）；**本节（§8.1）表体除本追加行外一字未动**（**不追溯补齐** —— 补行会改动历史节的表体，违反只追加纪律）。

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

### 8.8 v0.6 增补（声明 / NOT_MEASURED / 自曝 / delta 对照）

**8.8.1 本单声明（v0.6）**：本单**只写**三个文件：`docs/route-layer.spec.md`（就地升 **v0.6**）、`docs/versions/route-layer.spec.v0.6.md`（快照，与本体一致，`cmp` 自证）、`docs/audit/route-layer-v0.6-delta.md`（审计件）。**未**改 `docs/data-layer.spec.md`（**本单未写该册、未建任何 data-layer 快照**；判定见 8.8.1b）、`docs/ledger.spec.md`、`docs/versions/route-layer.spec.v0.1–v0.5.md`（**五个既有快照一字未动**）、`docs/seafood.master-plan.md`、其它 `docs/audit/*`、`backend-ts/**`（**只读**）、`frontend/**`。**未**做任何 SQL（**零库连接**）；**未**启停任何服务/进程（**未 kill 任何 PID**）；**未**跑任何套件；**未** `npm install`；**未**用 `execute_code`；**未** `git add/commit/push`（只跑只读 `git status/log`）；**未**用 `pkill -f`/`killall`；**未**用 `timeout`（本机无）。

**8.8.1b 关于 `docs/data-layer.spec.md` 未写的显式判定**：本单两条 delta 均落在**路由 / 幂等契约**面（§4.5 追加块 + §1.8 追加块 + §1.10 入册 + §7 登记）⇒ **没有任何 `DL*` 规则需要修改**（「2a 派生键 = 自然标识的单射」是**服务编排层契约**，不是数据层规则）⇒ **本单守「只许追加式」的上限 = 一次都不用追加**（该册现取 = **1023 行 / md5 `ad657c0a5068e91cb57d935bb34fd86b`**，**本单未触碰**）。

**8.8.2 §8.3 `NOT_MEASURED` 的 v0.6 增补（禁当 0/空）**：

| # | 项 | 原因 |
|--:|---|---|
| 23 | **「不同 worker 对同一 job」的键碰撞**（同一 2a 派生面） | 审计 `p4-aud-jobkey.md §2.4:153` **未造夹具**（`uniq_job_application_accepted` 限每 job 一条 accepted app，需另建 job）⇒ 只有**代码推断**（`worker_uid` 在 `fallbackParts` 内 ⇒ 键必不同）；**本单未补测**（只读、零库连接） |
| 24 | **前端「不传键」= 静态取证，非运行时抓包** | 审计 `§3:167` 自述；本单复算 = `frontend/src` + `frontend/package.json` **0 命中**，但 `frontend/` **全树命中 26 文件全在 `node_modules/**`（第三方依赖）** ⇒ 若要「运行时无键」证明仍须抓包（**未做**） |

**8.8.3 §8.4 探针自曝的 v0.6 增补**：

| # | 项 |
|--:|---|
| 21 | **（v0.6）§7-25 / §7-26 只改「状态」列，未改「依据」格正文** ⇒ 两格仍写着「待 Zang / 责任人待 Zang」。**定案内容在同一表后的追加补注块 + §1.8/§4.5 追加块**。**原因 = 并发纪律**（另一单元 Kong · 3c 正阅读 §4.2 / §4.5 / §1.8 ⇒ 本单**不得重写**这些节的既有正文）。**读法**：先读**状态列**，再读补注块，**不要**只读依据格（登记 §7-30） |
| 22 | **（v0.6）§4.5 / §1.8 的 v0.6 内容一律是「追加块」**：**表体 / 表头 / 编号未动**（§4.5 幂等键总表 **14 行**、§1.8 清单 **8 条 + 1 附注 + 四栏表头**）⇒ 质检对拍时**先对表体（应与 v0.5 逐字相同），再对追加块** |
| 23 | **（v0.6）审计件读数以现取为准、v0.5 的读数是中途读数**：v0.5 `§7-25` 记「**246 行 / 21165 字节**」= **审计中途落盘读数**（该审计自曝「初稿列了未生成的 `probe.log` ⇒ 已改正文」）⇒ **现取 = 248 行 / 21502 字节 / md5 `99f535e0ffa18e16c8d34d7e40be9c4e`**（§1.10 A1）。**该差异不是审计不实，而是 v0.5 抄了中途读数**（**Zang §5.86 A 亦记 248 行**）；**本单未改 §7-25 依据格正文**（同上并发纪律） |
| 24 | **（v0.6）本单 `git status` 现取非空**：仅 `?? backend-ts/scripts/p4z-b3d-00-probe.ts`（**另一并发单元 Kong · 3c 的在途产物**）⇒ 本单**零 `modified`**（「零改码」成立），但**不得**把该 untracked 行算作本单产物（§1.10 A4 / §7-29） |
| 25 | **（v0.6）前端 grep 口径精确化**：审计写「`frontend/**` 0 命中」；本单复算 ⇒ **应用代码面 0**、**全树 26（全在 `node_modules/**`）** ⇒ **两说法不冲突**，差别只在**是否含依赖树**（§8.8.2-24） |

**8.8.4 v0.5 → v0.6 关键 delta 对照（便于质检对拍）**：

| 项 | v0.5 表述 | v0.6 | 依据 |
|---|---|---|---|
| 2a 幂等口径（7-25 2a 面） | 「**改法（A/B/C）未定 ⇒ 待 Zang**」 | **定案 = 采纳「选项 B」**（零改码）：**派生键 = 实体自然标识的单射**；行为矩阵（同标识同内容 `200` replay / 同标识异内容 `409` / 异标识落新行）；**无自然键者 fail-loud** | **Zang §5.86 裁定①**；`p4-aud-jobkey.md §2.2/§4:209`；正文 = **§4.5 追加块** |
| `409` 面（`REPLAY_FINGERPRINT_MISMATCH`） | 仅作 §7-25 的**取证一句** | **永久回归项**（**不得退化为静默 replay**）+ 判据 / 真源 / 现成用例 | **Zang §5.86 裁定①**；**§7-28** |
| 批 4 前端同步 | 「**取 A 或 C 必须同单改前端**」 | **A / C 不采纳** ⇒ 改为**条件触发项 S10**：**若**要「同实体重复提交且内容已变」⇒ **必须先传 `create_key`** | **Zang §5.86 裁定①**；**§2.4 S10** |
| §1.8 清单维护责任（7-26） | 「机制已定 · **责任人待 Zang**」 | **三方分工（已定）**：Kong 每片报「认领 N / 未认领 M」/ **Jing 每次 spec 刷新真扫描** / Zang 批末差集 = ∅ | **Zang §5.86 裁定②**；**§1.8 追加块 / §7-26** |
| 审计件 | 散记于 §7-25（**246 行**中途读数） | **入册 §1.10**：**248 行 / 21502 B / md5 `99f535e0…`** + 产物 4 文件 + 探针 17025 B + **零 `modified`** 取证 + 三选项去向 | 本册现取；**Zang §5.86 A** |
| 注册点 / §1.8 条目 | 53 / 8 条 + 1 附注 | **53 → 53（本单未增删）** / **8 条 + 1 附注（无新增、无消除）**；3c 落地后按 **§7-29** 处理 | 本册现取（`grep` **53**；8 verb 调用点 **0**；服务层导出 **27**） |
| `docs/data-layer.spec.md` | 未动 | **未动**（同前，递增额度一次未用） | 本册现取 md5 `ad657c0a…` |

**8.8.5 本单自报读数（交付时现取）**：`docs/route-layer.spec.md` = **v0.6**（**行数 / 字节 / md5 见 delta 件 §D0** —— 本册不内嵌自身指纹以免自指）；**改前 = v0.5 = 881 行 / 210464 字节 / md5 `7493f410b30de2ff042a3b137eeb0615`**；快照 `docs/versions/route-layer.spec.v0.6.md` = 与本体 **`cmp` 相同**；审计件 = `docs/audit/route-layer-v0.6-delta.md`。

### 8.9 v0.7 增补（声明 / NOT_MEASURED / 自曝 / delta 对照 / 纪律自检）

**8.9.1 本单声明（v0.7）**：本单**只写**三个文件：`docs/route-layer.spec.md`（就地升 **v0.7**）、`docs/versions/route-layer.spec.v0.7.md`（快照，与本体一致，`cmp` 自证）、`docs/audit/route-layer-v0.7-delta.md`（审计件）。**未**改 `docs/data-layer.spec.md`、`docs/ledger.spec.md`（**两册本单均未触碰** —— 判定见 8.9.1b）、`docs/versions/route-layer.spec.v0.1–v0.6.md`（**六个既有快照一字未动**）、`docs/seafood.master-plan.md`、其它 `docs/audit/*`、`backend-ts/**`（**只读**：仅 `grep`/`sed -n`/`wc` 读源码与迁移）、`frontend/**`。**未**写库 / **零库连接**、**未**启停任何服务或进程、**未** `npm install`、**未**用 `execute_code`、**未** `git add/commit/push`（**未跑任何 git 命令**）、**未**用 `pkill -f`/`killall`、**未**用 `timeout`（本机无）。**本单对已有正文的唯二就地改动 = ① 4 处 `LD023`→`LD022`（Zang §5.88 裁定④）② §4.2 P4「必需字段」格写入 actor 口径（Zang §5.88 裁定②）**；**其余全部为追加**（v0.7 头部块 / §1.8 两行 + 复算 / §4.7 新节 / §7 追加表 + 补注块 / 本节）。

**8.9.1b 关于 `docs/ledger.spec.md` / `docs/data-layer.spec.md` 未写的显式判定**：本单 delta 全落在**路由层与资金编排契约**面（§4.2 期望码 + §4.7 + §1.8 + §7）⇒ **没有任何 `DL*` / 账本规则需要修改**：`LDxxx` 是**实现侧 SQLSTATE 键**（真源在代码 `src/ledger.ts`，**不在 spec 册**），spec 只是**引用**它 ⇒ **本单「只许追加式」的额度一次未用**（两册本单**零触碰**；若日后要改，仍须**只追加 + 新快照 + 说明理由**）。

**8.9.2 §8.3 `NOT_MEASURED` 的 v0.7 增补（禁当 0/空）**：

| # | 项 | 原因 |
|--:|---|---|
| 25 | **`400 LD022` → `LD021`** 的**运行时**确认 | **无 HTTP 面可测**（该码所在路径：J1/M1/A1 + §4.4-6 闸 —— `POST /api/job`、`/api/market/order`、`/api/admin/points/adjust` **本批未注册或非本册交付面**）；**本单只做静态取证**（迁移 raise 普查 + `ledger-errors.ts` 状态表）⇒ **判据 = 静态一致，非实测 200/400** |
| 26 | **退款「非卖方」发起**的 HTTP 反证（`403`） | 3c **未做端到端**（`/api/listing*` **未注册** ⇒ 无 HTTP 面；报告 `§6.4 待裁项 2` 自述「待 Zang 确认」）⇒ **本单未补测**（只读、零库连接）；**现状仅服务层单点可读**（`listing-funds-service.ts:62`） |
| 27 | **`Σbalance`/`Σfrozen` 的逐账户读数** | §4.7.3 B6 **系转引报告**（`p4-b3d-listing-funds.md §3`），**本册未连库复算**；**只有 `Σtotal = 2,000,000` 一句是 Zang 第四次自算背书**（**不得**把转引读当本册实测） |

**8.9.3 §8.4 探针自曝的 v0.7 增补**：

| # | 项 |
|--:|---|
| 26 | **（v0.7）`LDxxx` 的「类级扫描」范围 = 只扫 `LD02x` 段，非全 33 键**：扫描口径 = `grep -nE 'LD02[0-9]'`（命中 8 处全在 §4.2/§4.4，见 §4.7.1）；**未逐个普查 `LD001`–`LD033` 在 spec 内的全部写法** ⇒ **若还有别段错号，本单未覆盖**（**建议下次刷新扩为全键普查**）—— **这是本单最大的未覆盖面，明写在此以免误读为「全键已核」** |
| 27 | **（v0.7）`400 LD022` 的候补码 `LD021` 是推定、不是裁定**：证据 = 三迁移**各 1 处** `LEDGER_RESERVED_UID` + §4.4-6 行文「平台/保留 uid 前置闸」；**若 Zang 认为该四处本意是别的码（如 `LD016`/`LD020`），以 Zang 为准**（登记 §7-31，**本单未改**） |
| 28 | **（v0.7）§1.8 #10 的路径名与 §4.2 P4 目标命名不一致**：Zang §5.88 裁定③ 写 `POST /api/listing-orders/:orderId/refund`，本册 §4.2 P4 既有行写 `POST /api/listing/order/:orderId/refund` ⇒ **本单两处写法都保留、差异显式登记**（§1.8 #10 括注 + §1.2 命名张力族），**不擅改任一侧** |
| 29 | **（v0.7）本单 P4 actor 口径只落「必需字段」格**：§4.2 P4 的其余格（失败/回滚 / 期望码 / 幂等键）**一字未动**；actor 的**行为矩阵**（非卖方 ⇒ `403` + `reason`）**未写入**（3c 未端到端取证 ⇒ 不得凭空写死） |
| 30 | **（v0.7）★ 订正类工作自带「引文污染计数」陷阱**：本单为描述 `LD023`→`LD022` 必须**引用旧字符串** ⇒ 全文 `grep -c 'LD023'` 回落 **16 行**（**非 0**）⇒ **判据必须限定在「期望码面」**（§4.7.1 写死该口径）；**已把 §4.7.1 / §8.9.4 / §8.9.5 / 头部 ① 的计数声明全部改为面内口径** —— **任何后续质检若用全文计数核对，会得到假阳性** |

**8.9.4 v0.6 → v0.7 关键 delta 对照（便于质检对拍）**：

| 项 | v0.6 表述 | v0.7 | 依据 |
|---|---|---|---|
| `404 LD023`（4 处） | §4.2 J1 / P2 / P4 / M2 写 `404 LD023` | **一律订正为 `404 LD022`**（**§4.2/§4.4 期望码面内 `LD023` = 0 处**；**全文 16 行是本节引文，勿当判据** —— §8.9.3-30） | **Zang §5.88 裁定④**；`src/ledger.ts:1051`；**§4.7.1** |
| `400 LD022`（4 处） | 同上四处为 `400 LD022` | **原样保留 + 登记 §7-31**（**候选 `LD021`**，一句话可落） | **不得自选**（Zang 只裁另一类）；§4.7.1 |
| 退款发起人（P4） | **未定义 actor**（必需字段仅 `order_id`） | **`actor` = 仅卖方**（写进 P4 必需字段格）+ **管理员可发起 = 批 6** | **Zang §5.88 裁定②**；§4.7.2 / §7-32 |
| §1.8 条目 | **8 条 + 1 附注**（导出 27 / 5 文件面） | **10 条 + 1 附注**（**+`buyListing`/`refundListingOrder`**；导出 **29** / **6 文件面**；注册点仍 **53**） | **Zang §5.88 裁定③**；**§1.8 追加块 / §7-33** |
| 3c 事实 | 无（3c 未收尾） | **新开 §4.7**（交付面 / 两单点 / `database.ts` +68−0 / 53→53 / 报告 309 行 / `Σtotal` 2,000,000 / `ledger_entry` 76→86 / 伪造入参被忽略） | 报告 `p4-b3d-listing-funds.md`；本册现取 |
| 7-7 / 7-23 | 「默认不回滚」/「数值待 Kevin」（无现取单点） | **折入现取单点**（`:55` / 占位 `1000`）⇒ **状态不变，仍待 Kevin** | §7 追加补注块 ④⑤ |
| 纪律措辞 | 无（未立法） | **§8.9.6 措辞修正**：「要求登记进规格 ⇒ 一律写『产出按规格表格式的待补行、交规格方落』」 | **Zang §5.88 裁定③** |

**8.9.5 本单自报读数（交付时现取）**：`docs/route-layer.spec.md` = **v0.7**（**行数 / 字节 / md5 见 delta 件 §D0** —— 本册不内嵌自身指纹以免自指）；**改前 = v0.6 = 983 行 / 236644 字节 / md5 `5424645a3def7d6fe405edbd25c6ab64`**（本单动笔前现取，与派单给定值逐位相同）；快照 `docs/versions/route-layer.spec.v0.7.md` = 与本体 **`cmp` 相同**（自证见 delta 件 §D0）；审计件 = `docs/audit/route-layer-v0.7-delta.md`。**本册改后复算（口径 = 「期望码面」· §4.7.1）**：`LD023` = **0 处**、`LD022` = **8 处**（4 订正 + 4 待裁）；**全文计数 = 16 / 30 行**（**含本节引文 ⇒ 判据一律用面内计数**，自曝 §8.9.3-30）。

**8.9.6 纪律自检（v0.7 · **Zang §5.88 裁定③ 的措辞修正 · 本册立法**）**：

- **★ 措辞规则（写死）**：**凡「要求登记进规格」的指令，一律写作「产出按规格表格式的待补行、交规格方落」** —— 即**由产出方给出「与规格表逐栏对齐的待补行」（可直接粘进表里），由规格方（Jing / 本册）决定落位与版本**；**不得**写成「由 X 补进规格」这种**责任转移式**措辞（**依据 = Zang §5.88 裁定③**）。
- **本册自检（逐条对照本单）**：① **只追加** —— ✅（除裁定明令的 4 处 `LD023`→`LD022` 与 P4 actor 格，其余全为追加）；② **不改代码** —— ✅（`backend-ts/**` 仅只读 `grep`/`sed -n`/`wc`）；③ **不启停进程** —— ✅；④ **快照不动 v0.1–v0.6** —— ✅；⑤ **凡「实测」可 `grep`** —— ✅（§8.9.2/§8.9.3 的未测项已显式标 `NOT_MEASURED`；转引读数逐处标「转引」）；⑥ **不发明数值 / 不擅改裁定外条文** —— ✅（`400 LD022` 只登记、未改）。

### 8.10 v0.8 增补（声明 / NOT_MEASURED / 自曝 / delta 对照 / 纪律自检）

**8.10.1 本单声明（v0.8）**：本单**只写**三个文件：`docs/route-layer.spec.md`（就地升 **v0.8**）、`docs/versions/route-layer.spec.v0.8.md`（快照，与本体一致，`cmp` 自证）、`docs/audit/route-layer-v0.8-delta.md`（审计件）。**未**改 `docs/ledger.spec.md`、`docs/data-layer.spec.md`（**两册本单均未触碰**，**无需改** ⇒ 结论见 delta 件 §D7）、`docs/versions/route-layer.spec.v0.1–v0.7.md`（**七个既有快照一字未动**）、`docs/seafood.master-plan.md`、其它 `docs/audit/*`、`docs/qa/p4-b3-funds-qa.md`（**QA 报告只读**）、`backend-ts/**`（**只读**：仅 `grep`/`sed -n`/`wc` 读源码与迁移）、`frontend/**`。**未**写库 / **零库连接**、**未**启停任何服务或进程、**未** `npm install`、**未**用 `execute_code`、**未** `git add/commit/push`（**未跑任何 git 写命令**）、**未**用 `pkill -f`/`killall`、**未**用 `timeout`（本机无此命令）。
**本单对已有正文的「非追加」改动 = 就地订正 10 处、逐处保留旧写法**：**8 处期望码格**（§4.2 J1 `:545` / M1 `:555` / A1 `:564` / P2 `:552` / C1 `:558` / C2 `:559` + §4.4-6 `:589`；**其中 5 处 `→LD021`、2 处 `LD018→LD017`**）· **1 处路径格**（§4.2 P4 `:554`，Zang §5.89 裁定②）· **1 个状态列**（§7-31）。**其余全部为追加**（v0.8 头部块 / §4.7.4 / §4.8 / §5.5 / §7 追加表 + 补注块 / §9 / 本节）。

**8.10.2 NOT_MEASURED（**未测项，禁止当 0/空使用**）**：

| # | 未测项（v0.8 新增或重申） | 口径 |
|--:|---|---|
| 34 | **`LD001`–`LD033` 的运行时逐键触发验证** | 本单 = **静态三源对拍**（`ledger.ts:1029-1063` + `ledger-errors.ts:28-70` + spec 面 `grep`）；**HTTP 面逐键触发 = 未测**（批 3 只管已交付面）。QA `§6` 亦为**普查/对拍**性质 ⇒ **不得**读成「33 键全运行时验证过」 |
| 35 | **`503` 家族（`LD025`/`LD026`/`LD027`）的行为** | spec 内**无状态码条文**（§3.2 缺 `503` 行）⇒ **本册未发明**；`LD027` 仅在代码侧 `RETRYABLE_SQLSTATES` 有登记（可重试语义）⇒ **运行时未构造** |
| 36 | **13 面 `sunset` 的「值面」修正** | 本单只给**形态口径**（§5.5）；**响应体改动 = 批 4 实现方**（未落地）⇒ 「13 面已给日期」**不成立**（现状仍含「未决 …」占位，见 §5.5 现取范例） |
| 37 | **`job-funds-service.ts:18-19` 注释与代码不符的更正** | **归批 4（实现方）**；**本单只登记**（§4.8.3）⇒ 现状注释仍未改（**不得**读成已修） |
| 38 | **DL68 残余加固**（对手方选择在锁外） | **归 P5/批 4**（§7-38）；**本单不实现** ⇒ 「残余已消除」**不成立**（真源 = `p4-b3e-market-funds.md:96`） |
| 39 | **旧直写函数的「无调用方」取证深度** | **本册现取口径** = `grep -rn 'placeOrder\|cancelOrder\|cancelAllOrders' backend-ts/src/*.ts` ⇒ **命中 4 行，全在 `database.ts`**（3 处定义 `:3268`/`:3360`/`:3422` + 1 处内部互调 `:3428`）⇒ **顶层 `src/*.ts` 无外部调用方**；**递归扫已扩（本册现取）**：`grep -rn 'placeOrder\|cancelOrder\|cancelAllOrders' backend-ts/src backend-ts/scripts frontend/src` ⇒ **除 `database.ts` 的 4 行外，仅前端 `frontend/src/pages/ShardPage.jsx:312`/`:395` 命中 —— 那是同名**局部箭头函数**（碎片面客户端 handler），**不是** `DatabaseService.cancelOrder`** ⇒ **外部调用方 = 0**；**残留 `NOT_MEASURED`** = 未扫 `backend-ts/__tests__` 与仓库其余路径（本单只读上述三处目录）（§9 · E1 已写明） |

**8.10.3 自曝（本单的口径缺陷与更正）**：

- **31（引文污染计数 · 第二次遇到）**：本单为描述 8 处订正**必须引用旧字符串** ⇒ 全文 `grep -c 'LD022'` 仍为 **31 行**（**非 0**）、`LD023` **17 行**、`LD021` **8 行** ⇒ **判据一律限定在「期望码面」**（§4.7.4 抬头写死该口径）。**与 Zang §5.89 的口径差再次出现**（Zang 全文 `grep -c 'LD023'` = **17**、v0.7 报 **16**）：本册**现取** = **17 行**（**以现盘为准**；标 `待 Zang 复核`）—— 差异成因 = 统计时点不同（v0.7 落盘前 vs 落盘后），**不影响「期望码面内 `LD023` = 0」这一决定性判据**。
- **32（`seq -w` 口径）**：本单的 33 键普查命令用 `seq -w 1 33`（`01…33`）+ `grep -c "LD0$i"` ⇒ **计的是「行数」不是「处数」**（同一行出现两次只算一行）⇒ 与 QA `§6` 的「处数」口径**不可直接比较**；本册凡引用 QA 处数处**均标「转引」**。
- **33（`ledger.ts` 的真值表行号一律现取）**：本表 `:1030`–`:1062`（33 键）与 `ledger-errors.ts:28-70` 均为**本册现取**（`sed -n '1029,1040p'` + `sed -n '26,75p'` 两条命令的输出）；**Zang §5.90 亲核的 `:1046/:1047/:1049/:1050` 四行与本册现取逐字一致**（交叉互证成立）。**`RETRYABLE_SQLSTATES` 只引常量名、行号见 delta 件 §D3**（本册不内嵌未现取的行号）。
- **34（A1 的归类是本册判断）**：§4.8.2 的最后一行（A1 `amount`）**标 `待 Zang 复核`** —— 理由：该项**既非典型供给侧定价、也非平台费**，本册按「管理员显式意图额」归类，**若 Zang 认为应入 B 类 ⇒ 以 Zang 为准**（本单**不擅改** §4.2 A1 的任何格子）。
- **35（本册不改码）**：§4.7.4.3 的 8 处订正**只改 spec 文本**；**代码侧是否与订正后的 spec 一致**（例如 P2 的 `LD020` 在实现里究竟抛什么）**本单未验证** ⇒ **不得**读成「代码已核」（真源仅到迁移 `raise` 语句层）。
- **36（引文污染 · 第二次出现 · 这次落在「期望码面内部」）**：本单的订正留痕 `〔v0.8 订正：旧写 …〕` **写在同一条表行的格子里** ⇒ 用**旧的**面内 `grep -o 'LD02[0-9]'` 口径复核会读到 **`LD022` 8 处 / `LD020` 1 处 / `LD021` 5 处**（= **订正后的真值 + 旧写法引文**），**看起来像「没改干净」**。⇒ **本册把 §4.7.4 的真值判据改为「去引文口径」并给出可复算的 Python 单行**（现取输出 = `{'LD021': 5, 'LD022': 4}`）⇒ **任何后续质检若只用旧 `grep` 口径，会得到假阳性**（与 §8.9.3-30 同源、但更隐蔽：**污染与真值在同一行内**）。**纪律** = 凡「就地订正并留痕」的格子，**计数判据必须先去引文**。

**8.10.4 v0.8 delta 对照（便于质检对拍 · 逐条 delta 见 delta 件）**：

| delta（本单） | 依据 | 改动点 |
|---|---|---|
| `400 LD022` ×4 ⇒ `LD021`（§4.2 J1/M1/A1 + §4.4-6） | **Zang §5.89 裁定①**；`ledger.ts:1050` | §4.7.4.3 处 ①–④（就地订正 + 留痕） |
| `400 … LD020` （§4.2 P2 `:552`）⇒ `LD021` | **Zang §5.90 裁定①**（Neng D1 并入）；`ledger.ts:1049` | §4.7.4.3 处 ⑤ |
| `LD018(`LEDGER_AMOUNT_NOT_POSITIVE`)`（§4.2 C1 `:558` / C2 `:559`）⇒ `LD017` | **Zang §5.90 裁定①**（Neng D2/D6 并入）；`ledger.ts:1046` | §4.7.4.3 处 ⑥/⑦ |
| 33 键真值表写全 + 9 键逐键表态 | **Zang §5.89 裁定① + §5.90 裁定①** | §4.7.4.1 / §4.7.4.2（**新增**） |
| 金额来源二分 = **规则**（原 Neng D3 定性被推翻） | **Zang §5.90 裁定②** | §4.8（**新增**） |
| 13 面 `sunset`：日期或「随批 4 移除」 | **Zang §5.90 裁定④** | §5.5（**新增**） |
| §4.2 P4 路径正典 = `/api/listing-orders/:orderId/refund` | **Zang §5.89 裁定②** | §4.7.4.3 处 ⑧（就地订正 + 留痕） |
| 批 4 施工清单（十条未注册 + 全部前端同步项 + 加固项 + 收口项） | **Zang §5.86 裁定② / §5.89 B① / §5.90** | **§9（新增）** |
| DL68 残余 = 批 4 加固项 + **必带判负** | **Zang §5.89 B①** | §7-38 + §9 · D1 |
| 夹具前缀纪律（`cli:`/`biz:`/`ops:`） | **Zang §5.90 裁定③**（D4 = brief 自身之错） | §7-39 |

**8.10.5 纪律自检（逐条对照本单）**：① **只追加** —— ✅（**唯一非追加 = 8 期望码格 + 1 路径格 + 1 状态列，均就地订正并留旧写法**；§4.1–§4.6 其余、§4.7.1–§4.7.3、§5.1–§5.4、§6、§7-1…7-33 正文**一字未动**）；② **不改代码** —— ✅（`backend-ts/**` 仅只读 `grep`/`sed -n`；**未** `npm`/`tsc`/建连库）；③ **不启停进程** —— ✅（**未**用 `pkill -f`/`killall`）；④ **快照不动 v0.1–v0.7** —— ✅（**七个快照未触碰**；本单只**新增** v0.8 快照）；⑤ **凡「实测」可 `grep`** —— ✅（§8.10.2/§8.10.3 的未测项已显式标 `NOT_MEASURED`；转引读数逐处标「转引」）；⑥ **与裁定冲突 ⇒ 以 Zang 为准** —— ✅（逐处标「依据 = Zang §5.8x/§5.90」；**A1 归类一项无法从裁定直接推出 ⇒ 标 `待 Zang 复核`**）；⑦ **不发明数值/日期** —— ✅（**未写任何 `YYYY-MM-DD`、未写任何经济数值**）；⑧ **自报读数带口径** —— ✅（delta 件 §D0 报改前/改后行数·字节·md5 + `cmp` 自证）。

---

### 8.11 v0.9 增补（声明 / NOT_MEASURED / 自曝 / delta 对照 / 纪律自检）

**8.11.1 本单声明（v0.9）**：本单**只写**三个文件：`docs/route-layer.spec.md`（就地升 **v0.9**）、`docs/versions/route-layer.spec.v0.9.md`（快照，与本体逐字节相同，`cmp` 自证）、`docs/audit/route-layer-v0.9-delta.md`（审计件）。**未**改 `docs/ledger.spec.md` / `docs/data-layer.spec.md`（**两册本单均无需改**，理由见 delta 件 §D7）、`docs/versions/route-layer.spec.v0.1–v0.8.md`（**八个既有快照一字未动**）、`docs/seafood.master-plan.md`、其它 `docs/audit/*`、`docs/qa/p4-b4a-route-registration-qa.md`（**QA 报告只读**）、`backend-ts/**`（**只读**：仅 `grep`/`wc`/`sed -n`/`git diff`/`git status` 等只读命令）、`frontend/**`。**未**写库 / **零库连接**、**未**启停任何服务或进程、**未** `npm install`、**未**用 `execute_code`、**未** `git add/commit/push`（**未跑任何 git 写命令**）、**未**用 `pkill -f`/`killall`、**未**用 `timeout`（本机无此命令）。
**本单对已有正文的「非追加」改动 = 状态列 / 已注册事实的就地更新，逐处保留旧写法**：① 头部 v0.8 状态行（加「历史 · 已被 v0.9 取代」）② §1.8 标题 ③ §1.8 表头（路径列/为何未注册列/注册列加 v0.9 现况注）④ §1.8 十一行「由哪一批注册」格 ⑤ §1.8 扫描口径的「53 行」⇒「65 行」⑥ §4.8 标题（二分 ⇒ 三分）⑦ §4.8.2 A1 的两格（归类 / 依据）⑧ §7-29 状态列 ⑨ §7-40 状态列 ⑩ §9.A 标题 + 通配判据行。**其余全部为追加**（v0.9 头部块 / §1.8 追加块 / §1.11 / §2 追加块 / §4.2 追加块 / §4.5 追加块 / §4.8.4 / §7 追加表 + 补注块 / §9.A 追加表 / 本节）。

**8.11.2 NOT_MEASURED（**未测项，禁止当 0/空使用**）**：

| # | 未测项（v0.9 新增或重申） | 口径 |
|--:|---|---|
| 40 | **「有链 ⇒ `job_fee` 入 `-2`」的 HTTP 级形态** | QA-B4 §2.3 造链需 `/api/referral/bind`（超其写库允许面）⇒ `NOT_MEASURED`；**服务层两形态已在批 3b 实测**（§1.9 K6）⇒ **Zang §5.93 ③ 裁定「不算缺口」**，仅留低优先抽查（**§7-41**）。**不得**读成「`-2` 形态已在 HTTP 面验过」 |
| 41 | **A4 别名面 ↔ 既有 `POST /api/task-progress/:identifier/submit` 的键集逐键一致** | **4a 侧已实测 `identical=true`（同 9 键，4a 报告 §3 `A4_keySet_parity`）**；**QA-B4 未跑对照侧**（其 §7 N1）⇒ **QA 独立复算 = `NOT_MEASURED`** |
| 42 | **4a 的 `details.reason` 逐字**（A3/A6/A8-b/A11 负例） | 4a 探针只记 `code/message`；QA-B4 未复跑其负例集（其 §7 N3）⇒ 沿用 4a 自报的 `NOT_MEASURED`（4a 报告 §7 事项 5） |
| 43 | **A6/A7/A8/A8-b/A9/A10 的 QA 独立复测** | 不在 QA-B4 必做 3 条抽样内（其 §7 N4）；**其 4a 期分录已在 QA-B4 §2.2 逐笔归因**（`listing_order/6` 的 `purchase`/`sale`/`purchase_refund`）⇒ **只差 QA 自跑一遍** |

**8.11.3 自曝（本单的口径缺陷与更正）**：

- **37（`jobEventView` 键数：本体 14 vs 面 15）**：Zang §5.92 记「新路径成功面 = `jobEventView` **15 键**」；**本册现取该函数本体 = 14 键** ⇒ **两者不矛盾**：**15 = 14 键本体 + A5 专属 `submissions_reviewed`**（A6 面 = 14、A1 面 = 17）。**本册在 §2/§4.2 一律写「A5 面 15 键」并附本体 14 键的现取读数**（口径细化，**标 `待 Zang 复核` = §7-42**；**不构成与裁定冲突**）。
- **38（`+323/−2` 本册无法复算）**：该 `git diff --numstat` 读数（= QA-B4 §2.1 原始命令输出）**成于 4a 改动尚未提交时**；**本册现取**：工作树**干净**（`git status --porcelain` 仅 `?? backend-ts/.p4-artifacts/QA_B4_RUN_TAG.txt`）⇒ `+323/−2` 为**转引读数**（**双锚点**：4a 报告 §0/§2 + QA-B4 §2.1）。**本册未做任何 git 写操作**（只读 `git diff`/`git status`/`git log`）。
- **39（QA-B4 §4 的 A5「16 键」）**：QA-B4 §4 的 A5 行写「**16 键**」（`…submissions_reviewed`，正文用省略号）；**4a 报告 §3 逐键枚举 = 15 键**（与本册现取 14+1 一致）⇒ **以 15 键为准**，QA 侧 16 = **报数误差**（**标 `待 Zang 复核`**；登记 = **§7-42**）。**纪律** = 键集断言**必须逐键枚举**，不得用文字计数。
- **40（留痕与计数口径 · 同 §8.10.3-36 的族）**：本单在 **§1.8 的 11 行内**就地写入「**旧写法（留痕）：批 4**」⇒ 若用 `grep -c '批 4'` 复核会读到旧值 ⇒ **判据必须去引文**（认「**已注册（批 4a）**」计数 = **11** 行 + 附块 11 行）。**本册不把任何 `grep -c` 的原始值当判据**。

**8.11.4 v0.9 delta 对照（便于质检对拍 · 逐条 delta 见 delta 件）**：

| delta（本单） | 依据 | 改动点 |
|---|---|---|
| §1.8 十一条「未注册 ⇒ **已注册（批 4a）**」+ 注册行号 + **注册点 53 → 65** + 清单结论「**已清空 / 无遗留**」 | **Zang §5.92 / §5.93** | §1.8 表头 + 11 行「由哪一批注册」格 + 扫描口径 + **§1.8 v0.9 追加块**（**就地 + 留痕**） |
| 批 4a / QA-B4 事实登记（**新节**） | **Zang §5.92 / §5.93** | **§1.11**（Q1–Q10） |
| **A5 新路径键集 = `jobEventView`（15 键）**；旧路径 `11/9` **不变、两者不串** | **Zang §5.92 ③** | **§2 追加块** + **§4.2 追加块** + §7-42 |
| **A6 = `requireAdmin(review_tasks)` / A11 = `manage_settings`**（复用既有键、不新造） | **Zang §5.92 ②** | §1.11 Q8 + §4.2 追加块 |
| **§4.8 二分 ⇒ 三分**（新增 ② 授权主体意图额：权限闸 + 上限校验〔`TODO: Kevin 定值`〕+ 审计留痕）；**A1 归 ②** | **Zang §5.91** | §4.8 标题 + §4.8.2 A1 两格 + **§4.8.4**（**就地 + 留痕 + 新增**） |
| **§4.5 点名 C1 派生输入 = `symbol`**（QA-B4 的 `/api/currency` 不 fail-loud = **非缺陷**） | **Zang §5.93 ③** | **§4.5 追加块** |
| §7：**7-29 / 7-40 状态列**按实更新 + 新增 **7-41**（HTTP 级 `-2` 抽查）/ **7-42**（键数口径）+ 补注块 ⑪–⑬ | Zang §5.92 / §5.93 | §7（**追加表 + 补注块**） |
| §9.A 栏**同步改「已关闭」** + 逐条注册行号 | **Zang §5.92**（11 条全注册） | §9.A 标题 + 通配判据行 + **§9.A 追加表** |
| 声明 / NOT_MEASURED / 自曝 / delta 对照 / 纪律自检 | — | **§8.11**（本节） |

**8.11.5 纪律自检（逐条对照 §5.7 硬口径与派单纪律）**：① **带引号断言加引号** ✅（码名/键名/路径/命令一律反引号或原引号）｜② **退出码不取自管道之后** ✅（本册不使用管道后 `$?`；`git diff`/`grep` 读数均为原始输出）｜③ **本机无 `timeout`** ✅（未用）｜④ **读数异常先怀疑自己** ✅（`jobEventView` 14 vs 15 键、QA「16 键」、`+323/−2` 三条**均登记为口径差并标 `待 Zang 复核`**，见 §8.11.3-37/38/39）｜⑤ **先骸架后回填** ✅（v0.9 各节均**一次成文、无占位态**；落盘后即跑 `cmp`/`grep` 复核）｜⑥ **报数带口径** ✅（行数 / 字节 / md5 三口径 + 「就地改动 / 追加」逐处计数）｜⑦ **凡写「实测」必须能 `grep` 到支撑读数** ✅（§1.11 每行带 `文件:行号` 或报告 §号；未测项显式 `NOT_MEASURED`）｜⑧ **只追加** ✅（**非追加 = 上述 10 处状态列/已注册事实的地更新，逐处留痕**；**未重写任何其它节**；`v0.1–v0.8` 快照未动）｜⑨ **不改代码 / 不启停 / 不写库** ✅｜⑩ **写盘范围** ✅（只写本册 + v0.9 快照 + v0.9 审计件）。

### 8.12 v1.0 增补（声明 / NOT_MEASURED / 自曝 / delta 对照 / 纪律自检）

**8.12.1 本单声明（v1.0）**：本单**只写**三个文件：`docs/route-layer.spec.md`（就地升 **v1.0**）、`docs/versions/route-layer.spec.v1.0.md`（快照，与本体**逐字节相同**，`cmp` 自证）、`docs/audit/route-layer-v1.0-delta.md`（审计件）。**未**改 `docs/ledger.spec.md` / `docs/data-layer.spec.md`（**两册本单均无需改** —— 四条 delta 全落在路由 / 编排 / 前端面，**无 `DL*` / `R*` 规则变更**）、`docs/versions/route-layer.spec.v0.1–v0.9.md`（**九个既有快照一字未动**）、`docs/seafood.master-plan.md`、其它 `docs/audit/*`（含 `p4-b4c-ii-a/b` 两件，**只读**）、`docs/qa/*`、`backend-ts/**`（**只读**：仅 `grep` / `grep -c` / `wc` / `sed -n`）、`frontend/**`（**只读目录清单**）。**未**写库 / **零库连接**、**未**启停任何服务或进程（**未 kill 任何 PID**）、**未** `npm install`、**未**用 `execute_code`、**未** `git add/commit/push`、**未**用 `pkill -f` / `killall`、**未**用 `timeout`（本机无此命令）。
**本单对已有正文的「非追加」改动 = 就地更新 1 处**：**§5.1「商品持有读口」行的「本册最终处置」格**（加注归类更正，**旧文逐字保留**）⇒ 其余**全部为追加**（v1.0 头部块 / §1.12 / §2.5 / §3.5 / §4.5 v1.0 追加块 / §4.9 / §4.10 / §4.11 / §5.6 / §7 追加表 + 补注块 ⑭–⑯ / §9.E·E9 / 本节）。

**8.12.2 NOT_MEASURED（**未测项，禁止当 0/空使用**）**：

| # | 未测项（v1.0 新增或重申） | 口径 |
|--:|---|---|
| 44 | **前端的运行时读数**（build / 单测 / HTTP 链 / 几何同构） | §2.5 全部读数 = **转引** `p4-b4c-ii-a-jobs-profile.md` 与 `p4-b4c-ii-b-listings-market.md`；**本册未跑前端**（只读目录 + 两报告）⇒ **不得**读成「本册实测前端」 |
| 45 | **13 个 `410` 面的响应码面** | §1.12 **只复核注册与路径面**（`grep -cE '^app\.…'` 现取 = **65** + 逐条行号）；**未复跑 HTTP** ⇒ 响应码面 = `NOT_MEASURED` |
| 46 | **A1（§4.10）的运行时 15/15 与 `Σ(cid=1)` 差额** | **转引 Zang §5.101**；**本册现取**只到**路由层代码形状**（`requireAdmin` 先于金额校验 / 有符号 / 上限 / `ops:` 键 / 保留 uid / 幽灵 uid **六处**）⇒ **leg 形状（`op='entries'` + 单腿 `kind='burn'`）本册未复现**（转引 Zang §5.101 亲核） |
| 47 | **数值边界 9/9**（`9999→400` / `10000→200` / `49999→400` / `50000→200`） | **转引 Zang §5.96**（NUM-1 验收）；**本册未复跑** |
| 48 | **D1'（非 400 驱动错误 ⇒ `503`）** | **结构性、未触发** ⇒ **无运行时读数**（12/12 全走 400）；`psql` 直连对照 = 本机**无 `psql`**（Zang §5.102 自曝） |
| 49 | **缺表族的库面差集复算** | §4.11 的 7 表清单 = **转引 Zang §5.99**（其走 `neon()` 只读探针 + 报告 `p4-a1ledger-design.md`）；**本册只现取一项**（`grep -rniE 'create table[^;]*\basset\b' migrations/` ⇒ **0 行**）⇒ **其余 6 表未由本册独立复算**（禁当 0/空） |
| 50 | **前端是否在调 `auth/verify` / `claim` 的全量扫** | §4.11.1 的两处消费点取自 **§2.2 既有读数**（`auth.js:123` / `ClaimRewardModal.jsx:49` / `RewardPage.jsx:152`）⇒ **未全量扫**（同 §7-27 / §8.3-18 的残留） |
| 51 | **13 个 `410` 面与各面 `200/400/403/409` 的响应体** | 本册**零 HTTP 调用**（不连库、不启服务）⇒ 全部响应读数 = **转引**既有报告；**未复跑**（同 #45） |

**8.12.3 自曝（本单的口径缺陷与更正）**：

- **41（`ADMIN_POINTS_ADJUST_MAX_PER_CALL` 行号差 +2）**：**本册现取 = `src/index.ts:1182`**；**Zang §5.97 记 `:1180`** ⇒ **口径差 2 行**（成因 = 统计时点 / 前后注释行数）⇒ **以现盘为准**（**标 `待 Zang 复核`**，**不构成与裁定冲突**；§4.10 已登记）。
- **42（A1 路由内 `op` 是「响应标签」、不是「账本 op」）**：`:1256` 的 `const op = amount > 0 ? 'mint' : 'burn'` **只进成功面响应体**（`:1257-1267`）；**账本 op 在 `DatabaseService.adjustPoints` 内**（负向 = `op='entries'` + **单腿 `kind='burn'`**，§5.101）⇒ **两者同名不同层**，**不得**据 `:1256` 读成「账本用 `op='burn'`」（**本册现取 + §5.101 交叉核对**）。
- **43（A1 入参不完整分支形状偏离 `R107`）**：`:1200-1202` 走 `sendError(res, 400, '参数不完整')` ⇒ **非 `R107` 形状**（与 §3.3-1 冲突）⇒ **本册只登记**（§4.10 / §7-45 / **§9.E · E9**），**不改代码**；**该分支是否可被前端触发 = `NOT_MEASURED`**（未跑 HTTP）。
- **44（本单**未改** §4.4-11 / §4.4-12 / §4.7.3 B10 的 `1000` 占位旧文）**：为守「只追加」，**旧文原样保留**，**数值取代关系**写在 **§4.9「取代关系」条** ⇒ **读者若只读 §4.4-11/12 会看到已失效的 `1000`**（**这是刻意的留痕**；**判据一律取 §4.9**）。登记 = **§7 补注块 ⑯**。
- **45（`grep -c` 口径）**：注册点复核用 `grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts`（**本册现取 = 65**）；行号表用 `grep -nE` **同模式**（现取 **65 行**）⇒ **两条命令同模式、口径一致**；**未用任何管道后 `$?`**。
- **46（`sed` 区间口径）**：§4.9 三常量 = `sed -n '142,144p'` **本册现取**；§4.10 A1 六处守卫 = `sed -n '1180,1294p'` **本册现取** ⇒ **两者均为原始输出**（非转引）。

**8.12.4 v1.0 delta 对照（便于质检对拍 · 逐条 delta 见 delta 件）**：

| delta（本单） | 依据 | 改动点 |
|---|---|---|
| **§4.5 幂等键硬规则**（服务端已确定性派生键 ⇒ 前端不得自造键）+ 逐面表 + 判负 | **Zang §5.96④ + §5.100** | **§4.5 v1.0 追加块**（追加） |
| **D1'' 错误体口径约束**（不得依赖 DB `DETAIL`/`constraint`；一律项目级 `reason`） | **Zang §5.102** | **§3.5**（新增） |
| **A1 落定**（有符号 / ±100,000 / `requireAdmin` 先行 / `ops:` 键 / 保留 uid / 幽灵 uid ⇒ 400 `LD021`） | **Zang §5.101** | **§4.10**（新增） |
| **数值定值**（10,000 / 10,000 / 50,000 / 100,000） | **Zang §5.95③ + §5.101** | **§4.9**（新增 · **取代** §4.4-11/12 与 §4.7.3 B10 的占位） |
| **`/api/prize-item` 归类更正**（非 sunset） | **Zang §5.103④** | **§5.6**（新增）+ **§5.1 该行就地加注 + 留痕** |
| **缺表族 7 表 + 批 5 + 两条活路由 + D1'**（非 400 ⇒ `503`、归批 6） | **Zang §5.99 + §5.102** | **§4.11**（新增） |
| **§1 / §1.8 现取复核**（注册点 65 不变；`src/index.ts` 1575→1645、逐条行号漂移） | 派单 delta ⑧ | **§1.12**（新增） |
| **前端接线映射表**（招工 / 商品 / 交易所 / 我的 四线） | 派单 delta ⑦ | **§2.5**（新增） |
| **§9.E 新增 E9**（A1 入参不完整分支形状对齐 `R107`） | §4.10 现取 | §9.E（追加一行） |
| §7 追加 **7-43…7-46** + 补注块 ⑭–⑯ | 上列各条 | §7（**追加表 + 补注块**） |
| 声明 / NOT_MEASURED / 自曝 / delta 对照 / 纪律自检 | — | **§8.12**（本节） |

**8.12.5 纪律自检（逐条对照 §5.7 硬口径与派单纪律）**：① **带引号断言加引号** ✅（码名 / 键名 / 路径 / 命令 / 常量名一律反引号）｜② **退出码不取自管道之后** ✅（本册不用管道后 `$?`）｜③ **本机无 `timeout`** ✅（未用）｜④ **读数异常先怀疑自己** ✅（常量行号差 +2、`op` 同名不同层、QA「16 键」三条**均登记为口径差**，§8.12.3-41/42）｜⑤ **先骸架后回填** ✅（各节一次成文、无占位态；落盘后跑 `cmp` / `md5` / `wc`）｜⑥ **报数带口径** ✅（行数 / 字节 / md5 + 「就地改动 1 处 / 追加 N 处」逐处计数）｜⑦ **凡写「实测」必须能 `grep` 到支撑读数** ✅（§1.12 / §2.5 / §4.9 / §4.10 / §4.11 逐行带 `文件:行号` 或报告 §号；未测项显式 `NOT_MEASURED`）｜⑧ **立案 / 标签前必须自己复现一次** ✅（**数值三常量** = 本册 `sed -n '142,144p'` 现取；**A1 六处守卫** = 本册 `sed -n '1180,1294p'` 现取；**`asset` 缺表** = 本册 `grep` 现取 **0 行**；**注册点 65** = 本册 `grep -c` 现取；**`/api/prize-item` 非 sunset** = 本册 `grep -n` 现取 + 4c-ii-b §5.1 实测）｜⑨ **只追加** ✅（**非追加 = §5.1 一行的归类加注，旧文留痕**；`v0.1–v0.9` 快照未动）｜⑩ **不改代码 / 不启停 / 不写库 / 无 git 写** ✅｜⑪ **写盘范围** ✅（只写本册 + v1.0 快照 + v1.0 审计件）。

### 8.13 v1.1 增补（声明 / NOT_MEASURED / 自曝 / delta 对照 / 纪律自检）

> **本节对 v1.1 生效**；上文 §8.1–§8.12 的措辞为**历史留痕**（不改一字）。

#### 8.13.1 声明

- 本单**只写三个文件**：`docs/route-layer.spec.md`（就地升 **v1.1**）、快照 `docs/versions/route-layer.spec.v1.1.md`（`cmp` 逐字节相同）、审计件 `docs/audit/route-layer-v1.1-delta.md`。
- **非追加改动 = 1 处**：**§9.E · E9 一行的锚点就地刷新**（`:1200-1202` ⇒ **`:1206-1208`**，**旧写法留痕**）；其余**全部为追加**（v1.1 头部块 / **§1.12 v1.1 追加块 + §1.13** / **§3.6** / **§3.7** / §7 追加表 + 补注块 ⑰–⑲ / **§9.B · B14** / **§9.E · E10** / 本节）。**§0.1–§0.3 / §1.1–§1.11 / §2 / §4 / §5 / §6 / §7-1…7-46 / §9.A / §9.C / §9.D 一字未动。**
- **未触碰**：`docs/ledger.spec.md`、`docs/data-layer.spec.md`（**两册无需改** —— 本单四条 delta 全落**路由 / 鉴权 / 前端收尾**面，**无 `DL*` / `R*` 变更**）、`docs/versions/route-layer.spec.v0.1–v1.0.md`（**十个既有快照一字未动**）、`docs/seafood.master-plan.md`、其余 `docs/audit/*`（**只读**）、`docs/qa/*`、`backend-ts/**`（**只读**：`grep`/`grep -c`/`wc -l`/`sed -n`）、`frontend/**`（**只读检索**）。
- **本册不内嵌自身 md5 / 行数**（防自指）；指纹**只在 `docs/audit/route-layer-v1.1-delta.md §D0`**。

#### 8.13.2 NOT_MEASURED（**未测项，禁止当 0/空使用**；编号承 v1.0 的 44–51）

| # | 未测项 | 为何未测 / 转引锚点 |
|--:|---|---|
| 52 | §3.6 **四条判据**的 HTTP 面（真签名 `200` / 垃圾 `401` / 他人签名 `401` / 重放 `401`） | **转引** `docs/audit/p5-sig-verify.md §4`（该单真 HTTP + 真库、`pre`/`post` 同脚本）；**本册零 HTTP 调用** |
| 53 | 「**过期 challenge ⇒ `401`**」专项 | **`NOT_MEASURED`**（同审计件 §5.7/§6：需 ≥300s 或改未授权常量）；本册未构造 |
| 54 | §3.7 的 HTTP 面（改前 `401` ⇒ 改后 `200`、`points=0`、`42P01_in_body=false`） | **转引** `docs/audit/p5-fix-login.md §3-①`；本册未复跑 |
| 55 | §1.13 的安装面（`npm install ethers` ⇒ `added 9 packages`、lockfile `+98/−0`、实版 `6.17.0`） | **转引** `docs/audit/p5-sig-verify.md §3 ④–⑥`；**本册未安装任何包** |
| 56 | 两条新 `401` 文案在前端的**展示 / 四语覆盖** | **本册现取只有静态读数**（`frontend/src` 两串 **0 命中**、`locales` 无对应键）；**运行展示面 = `NOT_MEASURED`**（§9.B · B14） |
| 57 | `Σ(cid=1)` / `ledger_entry` 的**库面**现值 | **转引** `docs/audit/p5-sig-verify.md §4 ⑨`（`1,989,693` / `267`，`Δ=0`）；**本册零库连接** |
| 58 | 全册 **HTTP 响应码面**（13 个 `410` / 各面 200·400·403·409） | **未复跑**（§1.12 v1.1 追加块只复核**行号 / 计数**） |
| 59 | §9.E · E10（`claim` 面）的 HTTP 读数与前端调用面 | 本单**未跑该端点**（该面去向待 Kevin 一句话，7-47） |

#### 8.13.3 探针自曝 / 本册自曝（口径缺陷与更正）

| # | 项 | 口径 |
|--:|---|---|
| 60 | **「`:1206-1208`」的取得方式** | 由 **`:1197` 路由现取 + `sed -n '1197,1215p'`** 读出（入参不完整分支 `if (!uID \|\| Number.isNaN(amount) \|\| !reason) return sendError(res, 400, '参数不完整')`）；**非**由旧 `:1200-1202` 加偏移推得 |
| 61 | **`auth.ts` 改前行数 = 240** | **反推**（261 − 24 + 3，依据 `docs/audit/p5-sig-verify.md §2` 的 `git diff --numstat` = `24 / 3`）⇒ **本册未持有改前盘文件**，该数为**推断**（不影响任何判据） |
| 62 | **§1.12 「+6」的归因** | **推断**（`src/index.ts` 单点改动 `+7/−1` ⇒ 其后整体 +6；§1.12 v1.1 表的**逐条行号本身是 `grep` 现取**） |
| 63 | **两条新 `401` 未并入 §3.4 `R107`** | **本册不裁**（§3.6「零新增面」条）—— 该面与邻近 `auth` 面同形，**是否统一属另一件事**；**不为它新立 §9.E 行**（避免发明裁定） |
| 64 | **`Send`/`SendError` 形状** | 本册**未跑 HTTP** ⇒ 两条新文案的**响应体形状**取**代码面**（`src/index.ts:379` 出口）为判据，**响应体实读 = `NOT_MEASURED`**（#52） |
| 65 | **先骸架后回填** | 本节及其余新增节**一次成文、无占位态**；**未出现任何 `待回填` 字样** |

#### 8.13.4 v1.1 delta 对照（派单 7 条 → 落点）

| 派单 delta | 依据 | 落点 |
|---|---|---|
| ① 新硬规则「登录必须验签」（四条判据 + 两层关系） | Zang §5.106；`docs/audit/p5-sig-verify.md` | **§3.6**（新）+ §7-48 + §9.B · B14 |
| ② 依赖入册 `ethers@^6.17.0` | Zang §5.106；审计件 §3 | **§1.13**（新） |
| ③ 登录端点口径 `getUserAsset ∥ emptyAsset` | Zang §5.105；`docs/audit/p5-fix-login.md` | **§3.7**（新）+ §7 补注 ⑰ |
| ④ 收尾项：两条新 `401` 文案四语覆盖 | Zang §5.106；审计件 §6 | **§9.B · B14**（新行）+ §7-48 + §8.13.2-56 |
| ⑤ §9.E 补 E9 行 + `claim` 面状态（B5-2） | 派单 ⑤；审计件 §4 表 #2/#3 | **§9.E · E9**（锚点刷新）+ **§9.E · E10**（新行）+ §7-47 |
| ⑥ 行号刷新（§1.12 状态列复核 + `auth.ts` 漂移） | 派单 ⑥；本册现取 | **§1.12 v1.1 追加块**（新） |
| ⑦ 不变项复核（注册点 65 / `410` 面 6/6 / `Σ(cid=1)` / kind 关闭集 20） | 派单 ⑦；本册现取 + 审计件 | **§1.12 v1.1 追加块「不变项复核」表** |

#### 8.13.5 纪律自检

① 带引号断言加引号 ✅（`'参数不完整'` / `"ethers": "^6.17.0",` / 两条 401 文案逐字加引号）｜② 退出码不取管道后 ✅（本单无管道后 `$?`）｜③ 本机无 `timeout` ✅｜④ 读数异常先怀疑自己 ✅（#60/#61/#62 登记为推断与取得口径）｜⑤ 先骸架后回填 ✅（#65）｜⑥ 报数带口径 ✅（行数 / 字节 / md5 + 非追加 1 处 / 追加 N 处，见 delta 件 §D0）｜⑦ 凡「实测」可 `grep` 到 ✅（注册点 65 / 六条 `410` 行号 / `LEDGER_KINDS` = 20 / `frontend/src` 0 命中 / 各锚点行号 —— **均本册现取**）｜⑧ **立案 / 标签前必须自己复现一次** ✅（kind 关闭集 20 / `410` 面 6/6 / `upsertAsset` 全部调用点 / `ethers` 行 / 两条 401 文案前端命中数 —— **五项本册亲跑**）｜⑨ 只追加 ✅（非追加仅 §9.E · E9 锚点一处）｜⑩ 不改代码 / 不启停 / 不写库 / 无 `git` 写 ✅（§8.13.1 + delta 件 §D10）。
### 8.14 v1.2 变更记录与自曝（**本节对 v1.2 生效；上文 §8.1–§8.13 为历史留痕**）

**8.14.1 本单写盘范围（逐字）**：
- **只写四个文件**：`docs/route-layer.spec.md`（**就地升 v1.2**，只追加 §10 + §8.14 + 顶部 v1.2 状态块）、`docs/versions/route-layer.spec.v1.2.md`（快照；**改前先行副本 + 交付时与本体 `cmp` 相同**，见 delta §D0）、`docs/audit/route-layer-v1.2-delta.md`（本件）、**`docs/data-layer.spec.md` + `docs/versions/data-layer.spec.v0.7.md`**（**数据面同步**：新增两表 `content_translation` / `translation_cache` 入册，见 §8.14.1b）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.1.md`（**十一个既有快照一字未动**）、`docs/ledger.spec.md`、`docs/commission.spec.md`、`docs/seafood.master-plan.md`、其余 `docs/audit/*`（**只读**）、`docs/qa/*`、**`backend-ts/**`（只读：`grep`/`sed -n`/`wc`）**、**`frontend/**`（只读检索）**、`migrations/**`、`vercel.json`、`.env*`。
- **零动作**：**未**改任何代码 / 迁移 / `vercel.json`；**未**连库（零 DDL/DML）；**未** `npm install`；**未** `vercel`；**未**启停任何进程（**未** `pkill -f` / `killall`）；**未** `git add/commit/push`；**未**用 `timeout`（本机无）。

**8.14.1b 关于 `docs/data-layer.spec.md`（数据面同步判定 = **需要**）**：v1.2 折入的**两张新表**（`content_translation` / `translation_cache`，迁移 `0021`）**是数据层对象** ⇒ **数据面必须同步**：`docs/data-layer.spec.md` **v0.7 → v0.8**（**追加式加注 §19**，正文 `DL*` 条文**一字未改**）+ 改前快照 `docs/versions/data-layer.spec.v0.7.md`（**该册自有约定 = 「改前快照」命名取旧版本号**，见 `docs/seafood.master-plan.md:1809`）。**本册 route-layer 的 v1.2 delta 件 §D9 同批登记该同步**。

**8.14.2 NOT_MEASURED（**未测项，禁止当 0 / 空使用**；编号承 v1.1 的 52–59）**

| # | 未测项 | 为何未测 / 转引锚点 |
|--:|---|---|
| 60 | 真 **DeepSeek** 调用（网络 + 真 key + 真模型名） | **转引** `docs/audit/p6-tr1a-translate-service.md` §6-①（`NOT_MEASURED`：本机与 Vercel **目前无任何 `DEEPSEEK_*` 环境变量**）；**本册零 HTTP / 零引擎调用** |
| 61 | `0021` **apply 后的真实库读数**（表 / 索引 / 行数 / `triggers.non_internal=43`） | **本册零库连接**（禁 DDL/DML）⇒ 库面**未复读**；`triggers` 期望不变由 `0021` **零触发器**（`p6-tr1a` §2.4）**代码事实**支撑，**非**本册实测 |
| 62 | **Vercel 真运行时**的 `waitUntil`「响应返回后仍执行」保证 | **转引** `docs/audit/p6-tr1c-a-waituntil.md` §128（本机 `process.env.VERCEL` 非真运行时；本机 `waitUntil` **不抛**、后台执行由 fire-and-forget 兜底完成）；**平台契约，本机未实测** |
| 63 | 前端「翻译中」小标的**运行展示面**（HTTP / 渲染） | **转引** `docs/audit/p6-tr2-frontend-i18n-wiring.md` §5（`npm run test:unit` **123 passed**、`npm run build` 退出 0 为静态/单测面）；**本册零 HTTP 调用** |
| 64 | **读侧 payload 的实读**（`*_<lang>` + `i18n_status` 的线上形状） | **本册零 HTTP**；§10.1 的形状取**代码面**（`database.ts:762` `applyI18n`）为判据 ⇒ **响应体实读 = `NOT_MEASURED`** |
| 65 | 注册点 **65 → 66** 那一步（v1.1 记载 65，派单给 66） | **本册只有现取 = 67**；**65 → 66 的中间一步本册未复算**（转引派单口径），**不得**据 v1.1 的 65 反推 66 |

**8.14.3 本册自曝（口径缺陷与更正）**

| # | 项 | 口径 |
|--:|---|---|
| 66 | **「5 条写路径」的计数口径** | 派单口径 = **5 条写路径**（`profile` / `currency` / `job` / `listing create·edit·patch`）；**本册现取的实际登记点 = 6 个**（`listing` 一族含 `create` / `edit`(POST) / `status`(PATCH) **三个 verb**，逐条落号见 §10.5 表）。**差异 = 计数口径（按路由 vs 按 verb），非事实冲突** |
| 67 | **`TRANSLATE_MODEL` 默认值口径** | 代码默认 = `deepseek-flash`（`translate-service.ts:23` 注释 / `:296` 兜底）；第三方站写的 `deepseek-v4-flash` **存疑、未经真调用验证** ⇒ **不得**把 `deepseek-flash` 写成「已验证可用」（§8.14.2-60） |
| 68 | **「`market_order` / `market_trade` 无用户文本」的取证深度** | 依据 = `docs/audit/p6-i18n-content-triage.md`（`0016_market.sql:112,159` 表用途 + 注释）；该件**自曝** `market_trade` 的**逐列列名未现取**（预算内未跑列清单探针，见该件 §末）。⇒ 本册**转引**其结论，**沿其 `NOT_MEASURED` 边界**，**不**据「逐列未测」下「已逐列取证」的断言 |
| 69 | **先骸架后回填** | §10 与 §8.14 **一次成文、无占位态**；**未出现任何 `待回填` 字样** |

**8.14.4 v1.2 delta 对照（派单 8 条已落地事实 → 落点）**

| 派单事实 | 依据 / 真源 | 落点 |
|---|---|---|
| ① 载荷契约（`*_<lang>` 恒有值 + 回落 + `i18n_status`；旧空串 = 缺陷） | `backend-ts/src/database.ts:762`(`applyI18n`)/`:746`(`I18N_SPECS`)/`:798`(`loadI18nIndex`)；P6-TR-0/1b | **§10.1**（新） |
| ② 内容面（4 字段 + `market_*` 无文本 + 发布表单不本地化 + `bio` 编辑态持原文） | `p6-i18n-content-triage.md`；`frontend/src/pages/ProfilePage.jsx:47` | **§10.2**（新） |
| ③ 两张新表（迁移 `0021`） | `backend-ts/migrations/0021_content_translation.sql`（164 行） | **§10.3**（新）+ **data-layer v0.8 §19** |
| ④ 引擎口径（DeepSeek / OpenCC / stub 仅显式 / 缺 key 不翻 / 三重校验） | `translate-service.ts:291-307`/`:472`/`:208-211`/`:366-374`/`:692`；`p6-tr1a`、`p6-trfix` | **§10.4**（新） |
| ⑤ 写入形态 B1（5 路径 / 前台 pending / 后台 `waitUntil` / 响应不变慢） | `index.ts:65/84/536/1356/1443/1588/1617/1641`；`p6-tr1c-a §3.2` | **§10.5**（新） |
| ⑥ 失败与成本（`MAX_ATTEMPTS=5` / 2000 / 500 / `deferred`） | `translate-service.ts:213/298-299/609-616` | **§10.6**（新） |
| ⑦ 端点与运维（`backfill` / `CRON_SECRET` / cron / 注册点 67） | `index.ts:1722-1751`；`vercel.json:34-37`；本册 `grep -cE` 现取 = 67 | **§10.7**（新） |
| ⑧ 与账本无关（`Δledger_entry = 0`） | `p6-tr1c-a §5`、`p6-tr1b §5`（`267→267`） | **§10.8**（新） |

**8.14.5 纪律自检（逐条对照 §5.7 硬口径与派单纪律）**：① **带引号断言加引号** ✅（码名 / 键名 / 路径 / 命令 / 常量一律反引号）｜② **退出码不取自管道之后** ✅（本册无管道后 `$?`）｜③ **本机无 `timeout`** ✅（未用）｜④ **读数异常先怀疑自己** ✅（注册点 65/66/67 三口径差登记为 §8.14.3-66、§8.14.2-65）｜⑤ **先骸架后回填** ✅（§8.14.3-69）｜⑥ **报数带口径** ✅（行数 / 字节 / md5 + 非追加 0 处 / 追加 2 节，见 delta 件 §D0）｜⑦ **凡「实测」可 `grep` 到** ✅（§10 每行带 `文件:行号` 或报告 §号；未测项显式 `NOT_MEASURED`）｜⑧ **立案 / 标签前必须自己复现一次** ✅（注册点 **67** / `MAX_ATTEMPTS=5` / `0 18 * * *` / 两表 PK 与 CHECK / `0021` = 164 行 —— **均本册现取**）｜⑨ **只追加** ✅（**非追加改动 = 0 处**；§1–§9 正文一字未动）｜⑩ **不改代码 / 不启停 / 不写库 / 无 `git` 写** ✅（§8.14.1）。

### 8.15 v1.3 变更记录与自曝（**本节对 v1.3 生效；上文 §8.1–§8.14 为历史留痕**）

**8.15.1 本单写盘范围（逐字）**：
- **只写四个文件**：`docs/route-layer.spec.md`（**就地升 v1.3**：顶部 v1.3 状态块 + §10 就地订正 3 处 + 追加 §10.10–§10.15 + 本 §8.15）、`docs/versions/route-layer.spec.v1.3.md`（**快照 = 新版本号 + 改后正文 + `cmp`=0**）、`docs/audit/route-layer-v1.3-delta.md`（本单 delta 件）、`docs/audit/route-layer-v1.2-delta.md`（**仅在末尾追加**一条「`limit` 默认 20 ⇒ 100」的漂移修正，**旧内容一字未改**）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.2.md`（**十二个冻结快照一字未动**）、其余 spec / 快照（含 `data-layer.*`）、`docs/seafood.master-plan.md`、其余 `docs/audit/*`（**只读**）、`docs/qa/*`、**任何 `src/**` / `migrations/**` / `frontend/**` / `backend-ts/**` / `vercel.json` / `.env*`**。
- **零动作**：**未**改代码 / 迁移 / `vercel.json`；**未**连库（零 DDL/DML）；**未** `npm`；**未** `vercel`；**未**启停任何进程（**未** `pkill -f` / `killall`）；**未** `git add/commit/push`；**未**用 `timeout`（本机无）。

**8.15.2 NOT_MEASURED（**未测项，禁止当 0 / 空使用**；编号承 v1.2 的 60–65）**

| # | 未测项 | 为何未测 / 转引锚点 |
|--:|---|---|
| 66 | `limit` 默认分支的**运行时效果**（省略 `limit` ⇒ 真跑 100 行） | **转引** `docs/audit/p6-tr1c-fix.md §9.5`（该单硬边界只放行 ≤6 行复验；**本册零库连接 / 零 HTTP**）⇒ 本册只证**静态代码行**（`src/index.ts:1747` 现取） |
| 67 | 真 **DeepSeek** 调用的**本册复读**（网络 + 真 key） | **本册零 HTTP / 零引擎调用** ⇒ 只**转引** `p6-tr1c-fix.md §5.2` 的三语读数与 `327/581` tokens；**不得**写成「本册实测」 |
| 68 | 清洗 / 守卫的**库面复读**（`content_translation` 270 / `translation_cache` 25） | **本册零库连接** ⇒ 转引 `p6-tr1c-fix.md §1` |
| 69 | 存量回填的**推进末期读数**（`i18n_status` 分布仍在变） | 转引 `p6-tr1c-fix.md §9.4`（取样窗口内有**外部真译进程**并发写同一批格子）⇒ 分布 / 行数**均为时点值** |
| 70 | `mode=scan_translate` **缺省分支的端点级实测** | 本册现取仅得 `mode` 三态**代码面**（`src/index.ts:1749-1755`）与**回执形状**（`:1760-1778`）⇒ **HTTP 实读 = `NOT_MEASURED`** |
| 71 | **`i18n_status` 分母缺陷的库面复核**（字段覆盖行数 / 生产分布 `{ready:41, partial:14, pending:1}`） | **本册零库连接 / 零 HTTP** ⇒ **转引 Zang 追加口径（其自身实测读数）**；正文 §10.15 按该口径立法，**不得**把转引读数写成「本册实测」 |

**8.15.3 本册自曝（口径缺陷与更正）**

| # | 项 | 口径 |
|--:|---|---|
| 72 | **`docs/audit/route-layer-v1.2-delta.md` 的「`limit` 默认 20」漂移** | v1.2 delta 件 §D7 与本册 v1.2 §10.7 均记「默认 20」；**现盘真值 = 100**（`src/index.ts:1747` 现取；`p6-tr1c-fix.md §9.1`）⇒ 本版**已在 v1.2 delta 件末尾追加修正条**（§D14；**不改旧内容**）+ 本册 §10.7 **就地订正并留痕** + 新增 §10.11。**同族残留 = `docs/audit/p6-tr1b-mapper-and-backfill.md:89` 仍记 20**（属该件面、**本册不动**，仅登记） |
| 73 | **`§8.14.3-67`「`deepseek-flash` 未经验证」** | 该条为 v1.2 的**诚实保留**；**本版已由真调用读数收口**（§10.14②）⇒ **状态更新、非删除**（留痕） |
| 74 | **先骸架后回填** | §10.10–§10.14 与 §8.15 **一次成文、无占位态**；**未出现任何 `待回填` 字样** |

**8.15.4 v1.3 delta 对照（派单 6 条已落地事实 → 落点）**

| 派单事实 | 依据 / 真源（本册现取） | 落点 |
|---|---|---|
| ① DEF-02 分语言阈值表（替换 `[0.3, 3.0]`） | `translate-service.ts:220-224`（+ 注释 `:216-219`）/ `:226-227` / `:424`；`p6-tr1c-fix.md §4`；`p6-tr1c-b §5 DEF-TR1C-B-02` | **§10.10**（新）+ **§10.4 ② 就地订正** |
| ② `backfill` 三 mode + `limit` 默认 100 + 存量扫描 | `index.ts:1730/1747/1749-1755/1760-1778`；`translate-service.ts:1134-1139/1149-1173/1192/1219-1222`；`p6-tr1c-b §1.3`；`p6-tr1c-fix §9.1` | **§10.11**（新）+ **§10.7 就地订正**（端点行号 / `limit` / 回执键） |
| ③ **stub 写库守卫（结构性）** | `translate-service.ts:89/177-178/191-195/339-344/602-614`；`p6-tr1c-fix.md §1/§2` | **§10.12**（新 · 本节重点）+ §10.4 指针 |
| ④ DEF-01 校验字段集口径 | `translate-service.ts:437/704-719`（`validateFieldSet(subset, t, raw)` `:710`）；`p6-tr1c-b §5 DEF-TR1C-B-01`；`p6-tr1c-fix §3` | **§10.13**（新） |
| ⑤ 缺 key 口径确认不漂移 | `translate-service.ts:319-326/634-644` | **§10.14①**（新）+ §10.4 指针 |
| ⑥ 真引擎实测读数（三语 + tokens）+ 模型 id | `p6-tr1c-fix.md §5.2/§5.3`；`translate-service.ts:239` | **§10.14②③④**（新） |
| ⑦ **`i18n_status` 分母定义（Zang 追加口径）** | **Zang 追加口径（实测，本册转引）**；消费面锚点**转引 §10.1 / v1.2 时点读数**（`database.ts:762/784`、`:737-739`、`:798`；**本册未复读**） | **§10.15**（新）+ **§10.1 追加口径指针** |

**8.15.5 纪律自检（逐条对照 §5.7 硬口径与派单纪律）**：① **带引号断言加引号** ✅（码名 / 键名 / 路径 / 命令 / 常量 / 英文与越南语读数一律反引号）｜② **退出码不取自管道之后** ✅（本册无管道后 `$?`）｜③ **本机无 `timeout`** ✅（未用）｜④ **读数异常先怀疑自己** ✅（注册点现取 = 67、与 v1.2 一致；`limit` 20/100 两读数差已登记为 §8.15.3-72）｜⑤ **先骸架后回填** ✅（§8.15.3-73）｜⑥ **报数带口径** ✅（行数 / 字节 / md5 + 非追加 3 处 / 追加 6 节，见 delta 件 §D0）｜⑦ **凡「实测」可 `grep` 到** ✅（§10.10–§10.14 每行带 `文件:行号` 或报告 §号；未测项显式 `NOT_MEASURED`）｜⑧ **立案 / 标签前必须自己复现一次** ✅（阈值三元组 / `stubWritesAllowed` 仅 `=== '1'` / `limit` 默认 100 行 / 回执五新键 / `TRANSLATABLE_SPECS` 四类 / `validateFieldSet(subset,…)` / 注册点 67 —— **均本册现取**）｜⑨ **只追加 + 就地订正留痕** ✅（**非追加改动 = 3 处**：§10.4 ×2 指针 + ② 阈值、§10.7 ×3；**§1–§9 一字未动**）｜⑩ **不改代码 / 不启停 / 不写库 / 无 `git` 写** ✅（§8.15.1）。

### 8.16 v1.4 变更记录与自曝（**本节对 v1.4 生效；上文 §8.1–§8.15 为历史留痕**）

**8.16.1 本单写盘范围（逐字）**：
- **只写 5 个文件**：`docs/route-layer.spec.md`（**就地升 v1.4**：顶部 v1.4 状态块 + **追加 §11** + 本 §8.16）、`docs/versions/route-layer.spec.v1.4.md`（**快照 = 新版本号 + 改后正文 + `cmp`=0**）、`docs/audit/route-layer-v1.4-delta.md`（本单 delta 件）、`docs/data-layer.spec.md`（**就地升 v0.9**：新状态行 + **追加 §20**）、`docs/audit/data-layer-v0.9-delta.md`（数据层 delta 件）。
- **改前快照（数据层）** = `docs/versions/data-layer.spec.v0.8.md`（**本册开工前既存**；开工时 `wc -l -c` + `md5` 现取 = **1046 行 / 274767 B / md5 `bdee0a8f6f5871fbc4512e1dab39f523`**，与该册**改前正文逐字节相同**〔`cmp`=0〕⇒ 数据层「改前快照命名取**改前**版本号」之约定已满足，**本单未新建、未改动它**）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.3.md`（**十三个冻结快照一字未动**）、其余 spec / 快照（含 `data-layer.spec.v0.1–v0.7.md`）、`docs/seafood.master-plan.md`、其余 `docs/audit/*`（**只读**）、`docs/qa/*`、**任何 `backend-ts/**` / `migrations/**` / `frontend/**` / `vercel.json` / `.env*`**。
- **零动作**：**未**改代码 / 迁移；**未**连库（零 DDL/DML）；**未** `npm`；**未** `vercel`；**未** `git add/commit/push`；**未**启停任何进程（**未** `pkill -f` / `killall`）；**未** heredoc。

**8.16.2 NOT_MEASURED（**未测项，禁止当 0 / 空使用**；编号承 v1.3 的 66–71）**

| # | 未测项 | 为何未测 / 转引锚点 |
|--:|---|---|
| 75 | 生产（`https://ssseafood.vercel.app`）面**本册复读** | **本册零 HTTP / 零部署**（红线）⇒ 只**转引** `docs/seafood.master-plan.md §5.148`（生产域名已变更 + 复核 200）；**不得**写成「本册实测」 |
| 76 | 迁移 `0022` / `0023` **apply 后真库终态**本册复读 | **本册零库连接** ⇒ 转引 `docs/audit/p6-b6-perm-seed.md` §5（`schema_version=0022`）与 `docs/audit/p6-b6-audit-live.md` §0（`schema_version=0023`、`schema_migration=22`、链尾 `0023`）|
| 77 | `isAdminAddress` 收敛后**全站** admin 端点回归面 | 转引 `p6-b6-perm-seed.md §7`（该单只跑 `/api/admin/settings`、`/api/admin/me` 两个代表端点 + 401/403 负例）|
| 78 | 日累计拒绝的 **HTTPS 生产面**（`400 + LD016 + reason=OVER_MAX_DAILY_AMOUNT`）| **真库 live 未触发**（触发需真造百万点 ⇒ 污染真账本，红线②）⇒ 转引 `p6-b6-audit-live.md §6/§8`（DB 层事务内已实证；route 映射仅有静态源码取证）|
| 79 | 前端「用户可见差异 = 0」在 **640–1023px 断点**与**暗色档**的读数 | 转引 `docs/audit/p6-fe-perf.md §15.7`（AC 只要求 `390/1280/1600` 日档）|
| 80 | **未渲染 palette 类（约 70 个）**与 `hover:*` / `focus:*` / `dark:*` 变体的调色板等价 | 转引 `p6-fe-perf.md §15.7`（5 条 AC 路由上未渲染 ⇒ 无生产实测证据 ⇒ **未覆盖、未搬全表**）|
| 81 | `app_config` 化日累计阈值 | **未决**（本批按 Zang 口径用**服务端常量** `CONSTANT bigint := 1000000`）⇒ 转引 `docs/audit/p6-b6-audit-and-cap.md §7.4-5` / `p6-b6-audit-live.md §8` |

**8.16.3 本册自曝（口径缺陷与更正）**

| # | 项 | 口径 |
|--:|---|---|
| 82 | **「本册现取」vs「转引」的分界** | §11 中**本册现取**的仅有：`migrations/0022` = **177 行**、`migrations/0023` = **391 行**（`wc -l`）、`0023` 的关键行号（`:82-99` 表 / `:114/:125` 触发器 / `:157` 函数 / `:162` 阈值 / `:214-228` 拒绝分支）、`src/index.ts:419`（唯一 401）/`:1299`（`ADMIN_POINTS_ADJUST_MAX_PER_DAY`）/`:1498`（`sendInfraMapped`）、`src/ledger-errors.ts:487/500/514/519`、各审计件行数（`wc -l`）。**其余读数（逐面状态码 / `Σ` 合计 / 探针值 / 差异键 106 / safelist 29·24 等）一律转引对应审计件**，**未把转引写成「本册实测」** |
| 83 | **`§5.7③ 引用行号现取` 的诚实边界** | 批 6 多单在同日内多次改 `backend-ts/src/index.ts`（D1' 拆 401 段、SWEEP 批量改 catch、AUDIT 改接调分）⇒ **本册未对 `index.ts` / `ledger-errors.ts` 全量逐行复核**（仅节选上述关键行号现取）；凡审计件与本册行号不一致处，**以批 6 各审计件的 `文件:行号` 现取为准** |
| 84 | **先骸架后回填** | §11 与 §8.16 **一次成文、无占位态**；**未出现任何 `待回填` 字样** |

**8.16.4 v1.4 delta 对照（4 条已上线事实 → 落点）**

| 派单事实 | 依据 / 真源（本册现取） | 落点 |
|---|---|---|
| ① 权限种子 `0022` + `isAdminAddress` 单一真源 + 「先 apply 后部署」顺序依赖 | `backend-ts/migrations/0022_admin_permission_seed.sql`（**177 行**）；`p6-b6-perm-seed.md` §1/§4/§5；`master-plan §5.138` | **§11.1**（新）|
| ② 审计表 / 日累计 `0023`（阈值 `TODO: Kevin`、只计 `applied`、被拒留痕但不计入累计、`UNIQUE(idempotency_key,result)`、函数不得 `RAISE`） | `migrations/0023_…:82-99/157/162/214-228`（**391 行**）；`p6-b6-audit-and-cap.md` §7/§8；`p6-b6-audit-live.md` §5/§6；`master-plan §5.144–§5.146` | **§11.2**（新）|
| ③ 错误语义 D1'（`code==null` ⇒ 503 + `driver_connection_error`；401 只在凭据面且在 DB 调用前；26 面收口；2 处假成功改 `throw`） | `src/ledger-errors.ts:487/500/514/519`；`src/index.ts:419/1498`；`p6-d1prime-errclass.md`；`p6-d1prime-sweep.md`；`master-plan §5.147/§5.149/§5.150` | **§11.3**（新）|
| ④ 前端实现纪律（禁重引 CDN / 兼容层必进 `@layer` / 动态类名必 safelist / 测试字面量必拼接 / 按钮口径）| `p6-fe-perf.md` §1–§15；`master-plan §5.132/§5.135/§5.138–§5.142/§5.151` | **§11.4**（新）|

**8.16.5 纪律自检（逐条对照 §5.7 硬口径与派单纪律）**：① **带引号断言加引号** ✅（码名 / 键名 / 路径 / 命令 / 常量 / 值一律反引号）｜② **退出码不取自管道之后** ✅（本册无管道后 `$?`）｜③ **引用行号现取** ✅（§8.16.3-82 列清「现取」清单）｜④ **报数带口径** ✅（行数 / 字节 / md5 见 §8.16.1 与本单报告）｜⑤ **只追加 + 自证「既有节零删除」** ✅（**非追加改动 = 0 处**；`git diff --numstat` 对 `docs/route-layer.spec.md` / `docs/data-layer.spec.md` 的**删除数 = 0**，见本单报告）｜⑥ **`NOT_MEASURED` 禁填 0/空** ✅（§8.16.2 七项逐条）｜⑦ **未测不冒充实测** ✅（§8.16.3-82）｜⑧ **不改代码 / 不启停 / 不写库 / 无 `git` 写 / 无 heredoc** ✅（§8.16.1）｜⑨ **预算** ✅（见本单报告）。

### 8.17 v1.5 变更记录与自曝（**本节对 v1.5 生效；上文 §8.1–§8.16 为历史留痕**）

**8.17.1 本单写盘范围（逐字）**：
- **只写 4 个文件**：`docs/route-layer.spec.md`（**就地升 v1.5**：顶部 v1.5 状态块 + **§7 v1.5 追加表 + 补注块 ⑳–㉒** + **§12（新）** + §8.1 表 v1.5 行 + 本 §8.17）、`docs/versions/route-layer.spec.v1.5.md`（**快照 = 新版本号 + 改后正文**，`cmp` 读数见本单报告）、`docs/audit/route-layer-v1.5-delta.md`（本单 delta 件）、`.p6jing-artifacts/p6jing-00-probe.<run>.json`（**只读取证产物**，run-tagged）。
- **非追加改动 = 0 处**（**§7-32 行本体未改** —— 本单**未**就地加注该单元格；本能力的读法更新 = **§7 v1.5 追加表（§7-49 / §7-50 / §7-51）+ 补注块 ⑳**；**理由见补注块 ⑳**（「就地加注」与「删除列 = 0」在同一行内冲突 ⇒ 取机器判据优先））；**其余全部为追加**（`git diff --numstat` 删除列 = **0**）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.4.md`（**十四个冻结快照一字未动**）、`docs/data-layer.spec.md`、`docs/ledger.spec.md`、`docs/commission.spec.md`、`docs/seafood.master-plan.md`、`docs/design/**`、其余 `docs/audit/*`（**只读**）、`migrations/**`、`backend-ts/src/**`、`frontend/**`、`.env*`、`vercel.json`。
- **零动作**：**未改任何代码 / 迁移**；**未** `git add/commit/push`；**未** `npm install`；**未**启停任何进程（**未** `pkill -f` / `killall`）；**未**启停 5787/5788；**未** heredoc；**未** `timeout`（本机无）。**★ 库面 = 只读**：仅 `SELECT` / `pg_catalog` / `information_schema` 读取（探针 `.p6jing-artifacts/p6jing-00-probe.cjs`，零 DDL / 零 DML / 零事务写）。

**8.17.2 NOT_MEASURED（**未测项，禁止当 0 / 空使用**；编号承 v1.4 的 75–81）**

| # | 未测项 | 为何未测 / 转引锚点 |
|--:|---|---|
| 82 | **管理员退款面的 HTTP 级读数**（`200` / `403` / `404` / `409` / 幂等重投 / 审计行与资金行 `txid` 逐字相同） | **该能力尚未实现**（`REFUND_ACTOR_IS_SELLER_ONLY = true` 现取未改；盘上无 `listing_refund_post_event`）⇒ 本册**零 HTTP、零服务启停** ⇒ 全部标 `NOT_MEASURED`（**不得**用 §12.8 的期望值冒充实测） |
| 83 | **`409` 面的 `details.reason`（`order_not_refundable` / `order_pay_missing`）逐字可观测性** | **驱动相关**：`pool`/`direct`（WS）路径**搬运** `DETAIL`（`src/ledger.ts:1101-1112` 现取）；`neon` HTTP 路径 ⇒ `details.detail_unavailable='driver_did_not_carry_detail'`（`:1111`）⇒ **本册未跑 HTTP、未定驱动** ⇒ `NOT_MEASURED`、**判据一律以 `code` 为准**（§3.5 同立场） |
| 84 | **`listing_post_event` 对**多余 payload 键**（如新面要传的 `actor_uid`）是否宽容** | **只读函数体推断**（现取：函数只取 `payload->>'op'` / `order_id` 等它自用的键）⇒ **未实测** ⇒ 若变体落地须实测；**不得**以推断当结论（§12.6 已标） |
| 85 | **变体 A（复用审计表）落地后的日累计干扰量化**（一笔退款吃多少额度） | **变体未落地 ⇒ 无对象可测**；本册只给**结构性判据**（`0023:207-211` 无 `action` 过滤）+ 量化口径（`Δdaily_used = abs(退款额)`） |
| 86 | **`admin_permission` 11 键在**生产库**与 `backend-ts/src/database.ts:11-23` 与 `frontend/src/admin-utils.js:40-52` 的**逐键相等** | **本册只读真库 11 键（现取 ✓）+ 两个代码真源（现取 ✓）**；**三方差集 = 0** 由 v1.4 §11.1 转引（`p6-b6-perm-seed.md §5-④` `all_three_equal=true`）⇒ **本册未复跑机器判据** |
| 87 | **`admin_ops_audit_log` 的 `result='rejected_daily_cap'` 分支在真库的形态** | 现取真库**只有 4 行 `applied`、0 行拒绝**（触发需真造百万点 ⇒ 红线）⇒ 转引 `p6-b6-audit-and-cap.md §7.2/§8.2`（事务内合成） |

**8.17.3 本册自曝（口径缺陷与更正）**

| # | 项 | 口径 |
|--:|---|---|
| 88 | **「本册现取」vs「转引」的分界** | **本册现取** = §12.0 全部读库读数（探针产物 `p6jing-00-probe.<run>.json`）+ 全部 `文件:行号`（`migrations/0022` 177 行 / `0023` 391 行 / `listing-funds-service.ts` 317 行 / `index.ts` 1981 行 / `docs/route-layer.spec.md` 改前 2459 行 530839 B md5 `4ba6b8a1554accc2808086606a1bf37d`）+ 逐键候选表的 `requireAdmin` 调用面计数。**转引** = 权限三真源机器判据（v1.4 §11.1）、`p4-err-fidelity.md`（D1'' 12/12）、`p4-b4a-route-registration.md §3`（A10 回执 23 键）。**未把转引写成「本册实测」** |
| 89 | **★ 行号漂移（并发在途）** | **本册现取时 `backend-ts/src/index.ts` = 1981 行**，且 `git status` 显示 **`M backend-ts/src/index.ts` / `M backend-ts/src/database.ts`（另一单元在途）** ⇒ **本册的 `index.ts` 行号（`:254` / `:299` / `:1402` / `:1855` / `:1860` / `:1876`）为「本册现取时点」读数**，比 v1.4 §11 与 `p4-b4a` 的读数（`:1520`）已漂移 ⇒ **复核必须现取**（口径同 §0.2-9） |
| 90 | **§0「版本」行 = `v0.6`（陈旧）** | **现取**：§0 元信息表的「版本」格仍写 **v0.6**（v0.7–v1.4 均未就地更新它）⇒ 本册**只登记、不改**（改它属就地改历史单元格；**版本真源 = 顶部状态块 + §8.xN**）。**这是既有口径缺陷，不是本单引入** |
| 91 | **§12 的 AC 夹具「不可重复」风险** | 真库现成**唯一** `paid` 订单 = `order_id=3`；**一旦跑退款即变 `refunded`**（幂等键 `biz:listing:refund:3` 被消费 ⇒ 不可重置） ⇒ AC 执行方**必须先用 `POST /api/listing/:listingId/buy` 造新 `paid` 订单**（`cli:` 键，§4.5）；**本册零库写 ⇒ 未造夹具** |
| 92 | **先骸架后回填** | §12 与 §8.17 **一次成文、无占位态**；**未出现任何 `待回填` 字样** |

**8.17.4 v1.5 delta 对照（派单 8 条 + 4 条只读取证 → 落点）**

| 派单项 | 依据 / 真源（本册现取，除标注外） | 落点 |
|---|---|---|
| ①权限闸选键（逐键候选 + 选唯一） | `0022` 11 键（库现取）+ `requireAdmin` 调用面（`index.ts:299-317`；逐键计数 + `hasRequiredPermission` 语义） | **§12.1.1** + §7-50 |
| ②审计面 A/B 两变体（交 Zang） | `admin_ops_audit_log` 4 CHECK + UNIQUE + 索引 4 + append-only 1（**库现取**）+ `0023:207-211` 日累计求和无 `action` 过滤 | **§12.4 / §12.4.1** + §7-51 + Z2 |
| ③同语句可达性（两变体） | `0023` 设计取向① 逐字；`admin_points_adjust_post_event` 现取在场 + 无 `RAISE`；盘上**无** `listing_refund_post_event` | **§12.6** + Z4 |
| ④日累计闸是否需要 | `0023:161-162`（cap = A1 造币域）/ `ledger_max_single_amount()`（`0004:160` = `1e15`）/ 幂等唯一性 | **§12.9** + Z8 |
| ⑤actor 面 + 权限 | Zang §5.88 ②（防单向掠夺）；`listing-funds-service.ts:62/286-294` | **§12.1 / §12.3** |
| ⑥资金腿冻结 | `0015:661-726`（`667`/`707`/`711`/`718-724`/`747-756`/`775-781`）；`listing-funds-service.ts:55` | **§12.2** |
| ⑦幂等 + 判负 | `0015:667` + `listing-funds-service.ts:300`；§4.5 硬规则（§7-43） | **§12.5** |
| ⑧可证伪 AC + 注册面 | `p4-b4a §3`（24/23 键，转引）+ 库真值基线（kind 计数 / order 3） | **§12.8 / §12.7** |
| 取证 A（0022/0023 apply） | `schema_migration` 行 id 21/22（**库现取**）| §12.0-A |
| 取证 B（审计表逐列/约束/索引/触发器/CHECK 闭集） | `pg_constraint` / `pg_indexes` / `pg_trigger`（**库现取**）| §12.0-B |
| 取证 C（`listing_post_event` 结构；编排函数是否在场） | `pg_proc`（5 个 `*_post_event`，**无** refund 编排）（**库现取**）| §12.0-C |
| 取证 D（可退门面 + 账本基线） | `listing_order` 5 行 / `ledger_entry` 271 / `account(cid=1)` 18 行 Σ`1,989,693`（**库现取**）| §12.0-D |

**8.17.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（§12 全文；探针 SQL 亦 `public.users`）｜② **SQL 显式 `public.`** ✅（探针全部语句）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**（**既有单元格零改动**）；`git diff --numstat docs/route-layer.spec.md` = **`336 / 0`**，见本单报告）｜④ **快照惯例已先校验** ✅（`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.4.md` = **0**（开工前，即快照 = 「新版本号 + 改后正文」）⇒ 本单照做）｜⑤ **v0.1–v1.4 十四个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 追加 v1.5 行 + §8.17）；**区间声明同步** ✅（**现取 = 本册无「§1–§N」形式的索引/区间声明**（§0 只有权威输入清单 I1–I10；§x–§y 字样均为历史变更描述句）⇒ **无对象需同步**；**未重排任何编号**）｜⑦ **不得改**：代码 / `migrations/**` / `docs/data-layer.spec.md` / `ledger.spec.md` / `commission.spec.md` / `master-plan.md` / `docs/design/**` ✅（**全部零改动**）｜⑧ **无 git 写 / 无 `npm install` / 无 `pkill -f` `killall` / 未启停 5787-5788 / 未碰 `.env*`** ✅｜⑨ **原始输出不用 `.log`** ✅（产物 = `.json`）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（§8.17.2 六项；**无 0 / 无空**）｜⑪ **不确定处不二选一** ✅（Z1–Z8 逐条编号，带两变体 + 代价 + **标明倾向不构成裁定**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / 库读数见 §12.0 与本单报告）｜⑬ **「实测」可复算** ✅（探针脚本 + run 目录路径落盘）。

### 8.18 v1.6 变更记录与自曝（**本节对 v1.6 生效；上文 §8.1–§8.17 为历史留痕**）

**8.18.1 本单写盘范围（逐字）**：
- **只写 3 个文件**：`docs/route-layer.spec.md`（**就地升 v1.6**：顶部 v1.6 状态块 + **§12 六处就地加注** + **§12.11（新）** + **§7 v1.6 追加表 + 补注块 ㉓–㉕** + §8.1 表 v1.6 行 + **本 §8.18**）、`docs/versions/route-layer.spec.v1.6.md`（**快照 = 新版本号 + 改后正文**，`cmp` 读数见 delta 件 §D0）、`docs/audit/route-layer-v1.6-delta.md`（本单 delta 件）。
- **非追加改动 = 0 处**（**§7-32 / §7-49 / §7-50 / §7-51 状态格一字未动**；**§12.0–§12.10 一字未动**）⇒ **`git diff --numstat docs/route-layer.spec.md` 删除列 = 0**（见 §8.18.5）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.5.md`（**十五个冻结快照一字未动**）、`docs/data-layer.spec.md`、`docs/ledger.spec.md`、`docs/commission.spec.md`、`docs/seafood.master-plan.md`、`docs/design/**`、其余 `docs/audit/*`（**只读**）、`backend-ts/**`（**含 `migrations/**` 与 `src/**` —— 正被另一子代理并发改写、一律禁碰**）、`frontend/**`、`.env*`、`vercel.json`。
- **零动作**：**未改任何代码 / 迁移**；**未** `git add/commit/push`；**未** `npm install`；**未**启停任何进程（**未** `pkill -f` / `killall`）；**未**启停 5787 / 5788；**未** heredoc。**★ 库面 = 只读（本单未连库）**：本单取证**全部来自仓内源码只读**（`backend-ts/migrations/0023_*.sql` 全文 391 行 / `0015_listing.sql` 退款分支 991 行 / `0007` / `0016` / `0017` / `0008` / `0004` 等）；**库面读数一律转引 v1.5 §12.0**（**本单不运行读库探针** —— 既有探针 `.p6jing-artifacts/p6jing-00-probe.cjs` 经 `dotenv` 读 `.env*`，与「**不得碰 `.env*`**」硬约束冲突 ⇒ **不运行**）。

**8.18.2 NOT_MEASURED（**未测项，禁止当 0 / 空使用**；编号承 v1.5 的 82–87）**

| # | 未测项 | 为何未测 / 转引锚点 |
|--:|---|---|
| 93 | **`0024` / `admin_refund_audit_log` / `listing_refund_post_event` 的**库面在场真值** | **本单未连库**（不运行读 `.env*` 的探针，§8.18.1）⇒ 全部标 `NOT_MEASURED`；**结构真值 = 仓内源码照抄**（`0023` 全文现取） |
| 94 | **Z3 的 `result='rejected_state'` 分支在真库的形态** | **变体 B 未落地 ⇒ 表不存在、无对象可测**；判据只给**结构与语义**（同 `0023` 的拒绝留痕在真库亦只有 0 行，§8.17.2-87 转引） |
| 95 | **AC-11（并发两笔同订单）的现状读数 + AC-11 判负自证** | **能力未实现 + 本单零库写 ⇒ 无对象可测**；**判负自证明确禁止在本批做**（须改 `migrations/**` 的 `FOR UPDATE` 守卫）⇒ **归质检批**；**不得**把期望值当实测 |
| 96 | **AC-12 / AC-13 的现状读数** | 同 95（能力未实现）；AC-12 / AC-13 的判据 = **源码级可复算**（`position(... IN def)` / 六场景状态码） |

**8.18.3 本册自曝（口径缺陷与更正）**

| # | 项 | 口径 |
|--:|---|---|
| 97 | **「就地加注」的实现形态 = 插行、非改行** | 派单要求 ①「需更正处就地加注（形如「（v1.6：Zang Z2 终审——…）」）并保留原文」②「判据 = `git diff --numstat` 删除列 = 0」。二者在**同一行内加注**时冲突（改一行即产生 1 个删除行，v1.5 已实测 `336 1`）。**本单取机器判据优先** ⇒ 六处「就地加注」**全部**落为**紧邻原文的新增行**（**位于对应小节末**），**原有行一字未动**。**读法 = 先读原文、再读紧邻的 `（v1.6：…）` 行** |
| 98 | **§12.11.5 三条待确认（T-1 / T-2 / T-3）· 无先例细节未自行二选一** | 三条均**先只读取证**同族对象：T-1 照 `0023:65`；T-2 照 `0008:87/98/103`（`EXCEPTION WHEN SQLSTATE`）；T-3 无先例（H6 措辞两读法均可解释）⇒ **列待 Zang 确认（带两变体 + 代价 + 倾向）**。**本册未二选一** |
| 99 | **库面读数 = 0（本单未连库）** | 本单**未运行**读库探针（理由 = 探针经 `dotenv` 读 `.env*` ⇒ 与硬约束冲突）；**Z1–Z8 的裁定落位不依赖新库读数**（`0022` / `0023` 已 apply 的真值 = v1.5 §12.0 现取，**转引**）；**结构照抄 = 源码**（非库）⇒ 无「把推断当实测」 |
| 100 | **§0「版本」行 = `v0.6`（陈旧）· 承 v1.5 自曝 90** | §0 元信息表「版本」格仍写 `v0.6`（v0.7–v1.6 均未就地更新）⇒ **本册只登记、不改**（改它属就地改历史单元格）；**版本真源 = 顶部状态块 + §8.xN** |
| 101 | **行号漂移（并发在途）** | `backend-ts/src/index.ts` **1981 行**（`git status` 显示 `M`）；本单引 `:1855`（退款路由注册）/ `:1402`（A1 无键面）/ `:254`（reason 闭集）为**现取时点**读数 ⇒ **复核必须现取**（口径同 §0.2-9）；**本单未改任何代码** |

**8.18.4 v1.6 delta 对照（Z1–Z8 九条 + 四条硬约束 → 落点）**

| 裁定 | 依据 / 真源（本单现取，除标注外） | 落点（改后行号） |
|---|---|---|
| Z1 权限键 `manage_points` | `0022:58`（键）/ `database.ts:19`（键表）/ `:3854`（首页分流）/ `admin-utils.js:48` / `AdminLayout.jsx:80` / `App.jsx:242` / `index.ts:1402`（A1 无键面） | §12.1.1 加注 + §12.11.1 + §7-50 / §7-52 |
| Z2 变体 B（新审计表） | `0023:86`（单值 CHECK）/ `:207-212`（无 `action` 过滤的求和）/ `:64-99`（列 / 约束风格）/ `:114-127`（append-only）/ `:133-136`（索引）/ `:292-390`（自检） | §12.4 加注 + §12.11.2 + §7-51 / §7-53 |
| Z2b N/A | —— | §12.4 加注 + §7-54 |
| Z3 留痕 `rejected_state` | `0023:17-21`（不得 `RAISE`）/ `:219-225`（拒绝 INSERT + `ON CONFLICT`）/ `:210`（只计 `applied`） | §12.4 加注 + §12.11.2 / §12.11.3 |
| Z4 编排函数 | `0023:157-275`（同构对象）/ `0015:661-726`（资金腿）/ `:747-756`（白名单）/ `:775-781`（回写） | §12.6 加注 + §12.11.3 + §12.11.7 · I-10 |
| Z4b 不取 advisory lock | `0015:670`（`FOR UPDATE`）/ `:677-678`（幂等探测） | §12.6 加注 + §12.11.6 · AC-11 |
| Z5 闸前拒绝不留痕 | `0023:215-228`（拒绝留痕在函数体内）；§7-24（不落 access log） | §12.3 加注 + §7-55 |
| Z6 复用同路径 + actor 分流 | `index.ts:1855`（注册点）/ `:254`（reason 闭集）/ `listing-funds-service.ts:62` · `:286-294` | §12.7 加注 + §12.11.4 + §12.11.6 · AC-13 |
| Z8 不需要日累计闸 + 并发实测 | `0004:160`（`1e15`）/ `0015:711`/`:713-716`（金额来源 + 单笔上限）/ `:667`（键） | §12.9 加注 + §12.11.6 · AC-11 |
| 硬约束① 可退门面 / 夹具 | `0015` `listing_order` 建表；v1.5 §12.0-D（`order_id 3`，**转引**） | §12.11.4 / §12.11.6 |
| 硬约束② 错误码闭集 33 | `src/ledger.ts:1029-1063`（33 键）/ `ledger-errors.ts:41`（409）；§7-44（不依赖 `DETAIL`） | §12.11.4 |
| 硬约束③ `:62` 单点升级 | `listing-funds-service.ts:62`（现取 `true`） | §12.11.4 + §12.11.7 · I-12 |
| 硬约束④ 迁移自检 | `0023:281-391`（§D）；`DL48` | §12.11.2-E |

**8.18.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（§12.11 全文 / 照抄 `0023` 的 FK 目标）｜② **SQL 显式 `public.`** ✅（§12.11.2 的 DDL 逐条 `public.`）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` = **`259 / 0`**，见 delta 件 §D0）｜④ **快照惯例已先校验** ✅（开工前 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.5.md` = **0**（identical）⇒ 惯例 = 「新版本号 + 改后正文」⇒ 本单照做；改后 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.6.md` = **0**）｜⑤ **v0.1–v1.5 十五个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 追加 v1.6 行 + §8.18）；**区间声明同步** ✅（**现取 = 本册无「§1–§N」形式的索引 / 区间声明** ⇒ **无对象需同步**；**未重排任何编号**）｜⑦ **不得改**：代码 / `migrations/**` / `docs/data-layer.spec.md` / `ledger.spec.md` / `commission.spec.md` / `master-plan.md` / `docs/design/**` ✅（**全部零改动**）｜⑧ **无 git 写 / 无 `npm install` / 无 `pkill -f` `killall` / 未启停 5787-5788 / 未碰 `.env*`** ✅｜⑨ **原始输出不用 `.log`** ✅（本单无原始输出产物；若有则用 `.json` / `.txt`）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（§8.18.2 四项 93–96；**无 0 / 无空**）｜⑪ **不确定处不二选一** ✅（**T-1 / T-2 / T-3 三条**逐条编号，带两变体 + 代价 + **标明倾向不构成裁定**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 delta 件 §D0）｜⑬ **未发明任何规格值** ✅（列类型 / 约束名 / 触发器 / 索引 / 自检结构**全部照抄 `0023`**；`order_id` 无先例处**明写照抄边界**；无先例的三条 → 待 Zang）。

### 8.19 v1.7 变更记录与自曝（**本节对 v1.7 生效；上文 §8.1–§8.18 为历史留痕**）

**8.19.1 本单写盘范围（逐字）**：
- **只写 4 个文件**：`docs/route-layer.spec.md`（**就地升 v1.7**：顶部 v1.7 状态块 + **§12.11.2 / §12.11.3 / §12.11.4 / §12.11.5 / §12.11.6 五处 v1.7 就地加注** + **§12.12（新）** + **§7 v1.7 追加表（7-57 / 7-58）+ 补注块 ㉖–㉗** + §8.1 表 v1.7 行 + **本 §8.19**）、`docs/versions/route-layer.spec.v1.7.md`（**快照 = 新版本号 + 改后正文**，`cmp` 读数见 delta 件 §D0）、`docs/audit/route-layer-v1.7-delta.md`（本单 delta 件）、本单**原始输出**（若有 ⇒ 用 `.json` / `.txt`，**不用 `.log`**）。
- **新节行号（改后 · `wc -l` 现取）**：顶部 v1.7 状态块 **:140–151**；**§7 v1.7 追加表 :1661–1670**（7-57 `:1665` / 7-58 `:1666`；补注块 ㉖–㉗ `:1669–1670`）；§8.1 表 v1.7 行 **:1689**；**§8.19 :2295–2336**（8.19.1 `:2297` / 8.19.2 `:2304` / 8.19.3 `:2313` / 8.19.4 `:2323` / 8.19.5 `:2336`）；**§12.11.2 加注 :3072–3075** / **§12.11.3 加注 :3089–3095** / **§12.11.4 加注 :3107–3110** / **§12.11.5 加注 :3124–3130** / **§12.11.6 加注 :3146–3149**；**§12.12 :3164–3253**（12.12.1 `:3168` / 12.12.2 `:3180` / 12.12.3 `:3190` / 12.12.4 `:3211` / 12.12.5 `:3221` / 12.12.6 `:3231` / 12.12.7 `:3242`）。
- **非追加改动 = 0 处**（**§12.11.5 三条待确认表 / §12.11.6 AC-11…AC-13 表 / §12.11.2–§12.11.4 表格与单元格一字未动**）⇒ **`git diff --numstat docs/route-layer.spec.md` 删除列 = 0**（见 §8.19.5）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.6.md`（**十六个冻结快照一字未动**）、`docs/data-layer.spec.md`、`docs/ledger.spec.md`、`docs/commission.spec.md`、`docs/seafood.master-plan.md`、`docs/design/**`、其余 `docs/audit/*`（**只读**）、`backend-ts/**`（**含 `migrations/**` 与 `src/**` —— 正被另一子代理并发改写、一律禁碰**）、`frontend/**`、`.env*`、`vercel.json`。
- **零动作**：**未改任何代码 / 迁移**；**未** `git add/commit/push`；**未** `npm install`；**未**启停任何进程（**未** `pkill -f` / `killall`）；**未**启停 5787 / 5788；**未** heredoc。**★ 库面 = 只读（本单未连库）**：本单取证**全部来自仓内源码只读**（`backend-ts/migrations/0023_*.sql`（`:60-99` 表体）/ `0015_listing.sql`（`:661-690` 退款分支）/ `0008_*.sql`（`:80-115`）/ `0004_ledger_post_event.sql`（`:87-108` SQLSTATE 映射 / `:130-152` `ledger_raise` / `:1048-1100` 异常分类）/ `0005` / `src/ledger-errors.ts`（`:331-338` infra 桶 / `:60` 503 码）/ `src/job-service.ts:21`（`ledgerErrorBody`）/ `src/index.ts:98`（`sendSuccess`）/ `src/listing-funds-service.ts:80-85`（`extra`））；**库面读数一律转引 v1.5 §12.0**（**本单不运行读库探针** —— 既有探针经 `dotenv` 读 `.env*`，与「**不得碰 `.env*`**」硬约束冲突 ⇒ **不运行**）。

**8.19.2 NOT_MEASURED（**未测项，禁止当 0 / 空使用**；编号承 v1.6 的 93–96）**

| # | 未测项 | 为何未测 / 转引锚点 |
|--:|---|---|
| 102 | **AC-14 的注入读数（`53300` / `XX000`）** | **能力未实现 + 本册零 HTTP / 零库写 ⇒ 无对象可测**；**注入载体本册未指定**（属测试实现细节）⇒ **归实现批 / 质检批**；**不得**把期望值（503）当实测 |
| 103 | **AC-15 的拒绝面读数（零资金残留 / 审计行同提交 / 子事务不波及其他对象）** | 同 102（变体 B 未落地 ⇒ 审计表不存在、无对象可测）；**子事务语义 = 契约判据**（PostgreSQL `BEGIN … EXCEPTION` 即子事务），**本册未跑真库事务** ⇒ `NOT_MEASURED` |
| 104 | **`0024` / `admin_refund_audit_log` / `listing_refund_post_event` 的库面在场真值** | **本单未连库**（不运行读 `.env*` 的探针）⇒ 全部标 `NOT_MEASURED`；**结构真值 = 仓内源码照抄**（`0023` 全文现取） |
| 105 | **AC-11 判负自证（移除 `0015:670` 的 `FOR UPDATE` ⇒ `Δpurchase_refund = +4`）的实测读数** | **能力未实现 + 判负自证明确禁止在本批做**（须改 `migrations/**` 的 `FOR UPDATE` 守卫）⇒ **归质检批**（§12.11.6 AC-11 判负自证行原文口径不变）；**本单只复核其出处行号现取（`0015:670` / `:677-678`）** |

**8.19.3 本册自曝（口径缺陷与更正）**

| # | 项 | 口径 |
|--:|---|---|
| 106 | **「就地加注」的实现形态 = 插行、非改行** | 派单要求 ①「需更正处**就地加注**（形如「（v1.7：Zang T-2 终审——…）」）并**保留原文**」②「**判据 = `git diff --numstat` 删除列 = 0**」。二者在**同一行内加注**时冲突（改一行即产生 1 个删除行）。**本单取机器判据优先** ⇒ 五处「就地加注」**全部**落为**紧邻原文的新增行**（**位于对应小节末**），**原有行一字未动**。**读法 = 先读原文、再读紧邻的 `（v1.7：…）` 行** |
| 107 | **§12.11.5 三条待确认表的读法** | 该表体**未改**（T-1 / T-2 / T-3 三行的「变体」「代价」「本册倾向」「为何不能照抄」列仍在）⇒ **读该表时以 §12.11.5 加注 + §12.12.1–§12.12.4 为准**（口径同 §7-56 → §7-57 的补注块 ㉖） |
| 108 | **`reason` 的读取载体与驱动可见性（T-2 白名单要求「按 `reason` 区分」）** | `reason` 载体 = `ledger_raise` 的 `DETAIL`（`0004:148` `DETAIL = COALESCE(p_details,'{}')::text`）；**`DETAIL` 的实际可见性依驱动**（`pool` / `direct` 搬运、`neon` HTTP 路径 ⇒ `detail_unavailable`，§12.3 尾注同口径）⇒ **编排函数侧读 `DETAIL` 的可行性 = `NOT_MEASURED`**（本册零 HTTP / 零库写）；**判据一律以 `code` 为准**（§3.5 同立场）。**该细节已登记 → §12.12.7** |
| 109 | **库面读数 = 0（本单未连库）** | 本单**未运行**读库探针（理由 = 探针经 `dotenv` 读 `.env*` ⇒ 与硬约束冲突）；**T-1 / T-2 / T-3 的落位不依赖新库读数**（结构照抄 = 源码，非库）⇒ 无「把推断当实测」 |
| 110 | **行号漂移（并发在途）** | `backend-ts/src/index.ts` 等**在途修改中**（`git status` 显示 `M`）；本单引 `src/index.ts:98`（`sendSuccess`）/ `src/job-service.ts:21`（`ledgerErrorBody`）/ `src/ledger-errors.ts:331-338`、`:60` / `0015:661-690` / `0008:80-115` / `0004:87-108`、`:130-152`、`:1048-1100` 为**本单现取时点**读数 ⇒ **复核必须现取**（口径同 §0.2-9）；**本单未改任何代码** |

**8.19.4 v1.7 delta 对照（T-1/T-2/T-3 三条终审 + 四条附加硬约束 → 落点）**

| 裁定 | 依据 / 真源（本单现取，除标注外） | 落点（改后行号） |
|---|---|---|
| T-1 保留 `log_id`（表 13 列） | `0023:65`（身份证 PK）/ `0023:82`（PK 约束）/ `0023:114-119`（append-only 的 `COALESCE(OLD.log_id,0)`） | §12.11.2 加注（**:3072–3075**）+ §12.11.5 加注（**:3124–3130**）+ §12.12.1（**:3168**） |
| T-2 捕获 = `EXCEPTION WHEN SQLSTATE 'LD011'` | `0008:87/98/103`（先例）/ `0004:1048` / `0005:1318` / `0015:683-685`（`order_not_refundable`）/ `0015:688-690`（`order_pay_missing` **同码**） | §12.11.3 加注（**:3089–3095**）+ §12.11.5 加注（**:3124–3130**）+ §12.12.2（**:3180**） |
| 硬约束① 白名单捕获 / 禁 `WHEN OTHERS` + 可证伪判负 | `src/ledger-errors.ts:338`（`53300` ⇒ 503）/ `:331-333`（`53*`/`58*`/`XX*` 桶）/ `:60`（`LEDGER_TX_TIMEOUT` = 503）/ `0004:148`（`DETAIL`）/ `0004:1094` / `0008:88` | §12.11.3 加注（**:3089–3095**）+ §12.12.3-①（**:3190**）+ §12.12.6 · AC-14（**:3231 / :3237**）+ §12.12.7 · I-16 / I-18（**:3242 / :3249 / :3251**） |
| 硬约束② 拒收回执与审计行一起提交（零资金残留） | §12.11.3（同函数同语句）；`0015:718-724`（`purchase_refund` ×2 随子事务回滚） | §12.11.3 加注（**:3089–3095**）+ §12.12.3-②（**:3190**）+ §12.12.6 · AC-15（**:3231 / :3238**） |
| 硬约束③ 子事务回滚不波及其他已写对象 | PostgreSQL `BEGIN … EXCEPTION` = 子事务（**契约判据** · `NOT_MEASURED`） | §12.11.3 加注（**:3089–3095**）+ §12.12.3-③（**:3190**）+ §12.12.6 · AC-15（**:3231 / :3238**） |
| T-3 404 不留痕（射程写死） | `0015:663-665` / `:671-673`（`LEDGER_REF_NOT_FOUND` = `LD022`，见 `0004:108`）；§12.3 加注（Z5）；§7-55 | §12.11.4 加注（**:3107–3110**）+ §12.11.5 加注（**:3124–3130**）+ §12.12.4（**:3211**） |
| 回执键集（内部 vs 对外 vs F10 的 23 键） | `src/index.ts:98`（`sendSuccess`）/ `src/job-service.ts:21`（`ledgerErrorBody`）/ `src/listing-funds-service.ts:80-85`（`extra`）；F10 = §12.2（23 键，**转引**） | §12.11.3 加注（**:3089–3095**）+ §12.11.4 加注（**:3107–3110**）+ §12.12.5（**:3221**）+ §12.12.7 · I-17（**:3250**） |
| AC-11 判负自证复核 | `0015:670`（`FOR UPDATE`）/ `0015:677-678`（只读根键探测）—— **已在位，只补出处行号现取** | §12.11.6 加注（**:3146–3149**） |

**8.19.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（§12.12 全文 / 照抄 `0023` 的 FK 目标 `public.users(uid)`）｜② **SQL 显式 `public.`** ✅（§12.11.2 / §12.12 的 DDL 与 `pg_get_functiondef('public.listing_refund_post_event(jsonb)'::regprocedure)` 逐条 `public.`）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 见 delta 件 §D0）｜④ **快照惯例已先校验** ✅（开工前 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.6.md` = **0**（identical）⇒ 惯例 = 「新版本号 + 改后正文」⇒ 本单照做；改后 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.7.md` = **0**）｜⑤ **v0.1–v1.6 十六个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 追加 v1.7 行 + §8.19）；**区间声明同步** ✅（**现取 = 本册无「§1–§N」形式的索引 / 区间声明** ⇒ **无对象需同步**；**未重排任何编号**）｜⑦ **不得改**：代码 / `migrations/**` / `docs/data-layer.spec.md` / `ledger.spec.md` / `commission.spec.md` / `master-plan.md` / `docs/design/**` / `docs/audit/**` 既有件 ✅（**全部零改动**）｜⑧ **无 git 写 / 无 `npm install` / 无 `pkill -f` `killall` / 未启停 5787-5788 / 未碰 `.env*`** ✅｜⑨ **原始输出不用 `.log`** ✅（本单无原始输出产物；若有则用 `.json` / `.txt`）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（§8.19.2 四项 102–105；**无 0 / 无空**）｜⑪ **不确定处不二选一** ✅（**T-1 / T-2 / T-3 全部终审已给** ⇒ 本单无需二选一；**唯一未指定细节 = AC-14 注入载体** ⇒ **登记归实现批 / 质检批、未自行指定**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 delta 件 §D0）｜⑬ **未发明任何规格值** ✅（列类型 / 捕获先例 / 分类器口径 / 回执口径**全部照抄既有源码**；`LD011` / `LD022` / `53300` / `XX000` 的映射均带现取行号；**无先例处未自造**）。

### 8.20 v1.8 变更记录与自曝（**本节对 v1.8 生效；上文 §8.1–§8.19 为历史留痕**）

**8.20.1 声明（写盘范围 · 逐条）**：本单**只写四个文件**：`docs/route-layer.spec.md`（**就地升 v1.8**：顶部 v1.8 状态块 + **§1.14（新）** + **§7 v1.8 追加表（7-59 / 7-60 / 7-61）+ 补注块 ㉘–㉚** + §8.1 表 v1.8 行 + **§8.20（本节的 §8.20.5 见下）** + **§13 / §14 / §15（新，追加于文末）**）、`docs/versions/route-layer.spec.v1.8.md`（**快照 = 新版本号 + 改后正文**；惯例已先校验，见 8.20.5-④）、`docs/audit/route-layer-v1.8-delta.md`（本单 delta 件）、本单**原始输出**（若有 ⇒ 用 `.json` / `.txt`，**不用 `.log`**）。

**8.20.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：

| # | 未测项 | 原因 |
|--:|---|---|
| ① | **批 7-A `67 → 68` 那一步的注册点路径名** | **派单未给该锚点**，本册**不做 `git log -p` 归因**（越本单射程）⇒ **不得自编路径名**（§1.14 计数真源表的「未测项」注） |
| ② | **「同一端点内 400 类形状不齐」的同族面清单**（哪些面仍有旧 `sendError` 形态） | **真源 = 同批 Kong 收口五报告 `docs/audit/p7-a-ledger-read-fix2.md`（转引、本单不复算）**，而**该件开工时尚未落盘**（本册现取：`find docs -name 'p7-a-ledger-read-fix2*'` = **0**）⇒ **不得自编清单、不得留占位**（§15.2） |
| ③ | **68 条注册点的 HTTP 响应码面** | 本册**零 HTTP**；只复核**计数与路径存在性** ⇒ 响应码面 `NOT_MEASURED`（口径同 §1.12「复核面声明」） |
| ④ | **`apiErrorMessage` 门的**当日**判负实跑读数**（门在 3 条基线下的 PASS 读数） | 本册**不跑前端套件**（只读源码取真源行号）⇒ 门的三条判负自证（收口四 R-4 / 三件判负）**转引**（`docs/seafood.master-plan.md:1425-1426`） |
| ⑤ | **22 文件 / 77 条的「逐条」列名清单** | 本册**现取 = 计数（77 / 22）**（§13.3）；**逐条文件名 × 行号的完整枚举**未在 spec 内贴全（贴全会使本节膨胀且与报告重复）⇒ **计数已实测、清单枚举 `NOT_MEASURED`**（**不写 0、不写空**） |

**8.20.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得** | 派单给了九处「应改行号」并说「旧写法就地留痕」；但硬口径 ② 判据 = **`git diff --numstat` 删除列 = 0** ⇒ **两条在同一行内结构冲突**。**本册取机器判据优先**（先例 = v1.5 补注块 ⑳ 的「§7-32 行未改」、v1.7 补注块 ㉓）；**旧写法逐字引在 §1.14 表第二列 ⇒ 留痕成立**。**读那九行时以 §1.14 第三列为准**。 |
| ② | **九处行号是「v1.7 时点」** | 本册在 :151 之后插入了 v1.8 状态块 ⇒ **v1.7 时点行号 ≠ v1.8 时点行号**（整体下移）。**本册把九处标为「v1.7 时点行号」并同时给引文**（引文在 v1.8 下仍可 `grep` 到）⇒ **不把 v1.7 行号当现盘用**。 |
| ③ | **`ShardPage.jsx:303` 是转抄错误** | 本册现取 = **19 行**、**17–19 = 薄壳**（`import MarketPage` + `export default MarketPage`）⇒ **凡引用 `:303` 者作废**（§1.14 行号声明）。 |
| ④ | **`ProfilePage.jsx:341-350`（§4 表旧锚点）亦已漂移** | v1.8 现取锚点 = **`:376`**（界面注行）；**旧锚点留痕不删**。 |
| ⑤ | **编号冲突（本册自纠）** | 本册初次落笔用过 `§1.13`，与 **v1.1 的 §1.13「运行依赖登记」（现 `:579`）冲突** ⇒ **已改名为 §1.14**（**v1.1 的 §1.13 一字未动**；改的只是本册自己新增的行）。 |
| ⑥ | **并发写者 ⇒ 行号锚点是移动靶** | `backend-ts/src/index.ts` **正被并发单元（Kong · 收口五）改写**（开工时工作树已含其未提交改动：`git diff --numstat backend-ts/src/index.ts` = **`75 / 9`**）⇒ 本册**两次现取**：**T1 = 注册点 `68` / `1981` 行 / `/api/user/ledger` `:633`**；**T2（`2026-10-02T15:34:31+0800`）= 注册点 `68` / `2047` 行 / 同路径 `:656`**。**计数稳定、行号漂移** ⇒ **两值都留**（§1.14 计数真源表后注）；**不以任一静态行号冒充现盘**。 |

**8.20.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（Zang / 派单） | 落点（本册） |
|---|---|---|
| ① 注册点 65 → 68 全量回写（含 §4 表两行 `未注册` ⇒ `已注册（src/index.ts:633）`） | **§5.162 D①**（`docs/seafood.master-plan.md:1443`）；L7①/L7②（`:1435`） | **§1.14**（新增） |
| ② 三条消费点行（`ProfilePage.jsx` / `mkt-ledger` / `?kind=transfer`） | **§5.162 D①**（`:1443`） | **§1.14**（C1 / C2 / C3） |
| ③ 「`ShardPage.jsx:303` 已不存在 = 旧行号转抄错误」 | **§5.162 D①**（`:1443`） | **§1.14 行号声明** + §8.20.3-③ |
| ④ 脚本类硬门口径（`tsc --noEmit` 不覆盖 `scripts/**` / 必须过 `tsconfig.scripts.json` / 新增零错 / 22 文件 77 条登记 / 旧读数作废声明） | **§5.162 D②**（`:1443`）+ A · R-3①（`:1424`） | **§13**（新增）+ **§7-60** |
| ⑤ 错误文案必须过 `apiErrorMessage`（已成可判负门） | **§5.162 D③**（`:1443`）+ A · R-1 / R-4（`:1422` / `:1425-1426`） | **§14.1**（新增） |
| ⑥ 两套取数入口并存 ⇒ P6/P7 合并待办 | **§5.162 D③**（`:1443`）+ A · R-1（`:1422`） | **§14.2**（新增）+ **§7-59** |
| ⑦ 400 形状口径（同端点只许一种形状 = R107 / 形状非法 ⇒ 400 + 既有码 + `details.field`+`details.reason` / 旧 `sendError` 判非 R107 / 同族清单转引 fix2） | **§5.162 C**（`:1439`）+ L7④（`:1436`）+ **§5.16 裁定**（`:383`） | **§15**（新增）+ **§7-61** |
| ⑧ 变更记录 / 快照 / delta 件 | 派单硬口径 ③④ | **§8.1 v1.8 行** + §8.20 + 快照 `docs/versions/route-layer.spec.v1.8.md` + `docs/audit/route-layer-v1.8-delta.md` |

**8.20.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**；新增文本无表名引用，唯一相关处 = 转引 `public.` 口径）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**，读数见 delta 件 §D0）｜④ **快照惯例已先校验** ✅（开工前 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.7.md` = **0**（identical）⇒ 惯例 = 「新版本号 + 改后正文」⇒ 本单照做；改后 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.8.md` = **0**）｜⑤ **v0.1–v1.7 十七个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 追加 v1.8 行 + §8.20）；**区间声明同步** ✅（**现取 = 本册无「§1–§N」形式的索引 / 区间声明** ⇒ **无对象需同步**；**未重排任何编号**）｜⑦ **不得改**：任何代码（`backend-ts/**` 正被 Kong 并发改写 / `frontend/**`）/ `migrations/**` / `docs/data-layer.spec.md` / `ledger.spec.md` / `commission.spec.md` / `docs/design/**` / `docs/seafood.master-plan.md` / `docs/audit/**` 既有件 / `docs/qa/**` ✅（**全部零改动**；本单只新建 `docs/audit/route-layer-v1.8-delta.md`）｜⑧ **无 `git add/commit/push` / 无 `npm install` / 未碰 `.env*` / 未用 `pkill -f`·`killall` / 未启停 5787·5788** ✅｜⑨ **原始输出不用 `.log`** ✅（本单无原始输出产物；若有则用 `.json` / `.txt`）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（8.20.2 五项 ①–⑤；**无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（**本单无「二选一」型未决** —— 派单第 ③(b) 的路径①/②**已终审**（路径②）；**唯一无先例项 = 无** ⇒ 故**无 `待 Zang 确认` 条目**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 delta 件 §D0；注册点**逐 verb** 读数见 §1.14）｜⑬ **未发明任何规格值** ✅（68 与逐 verb 计数 = **本册现取**；22 / 77 = **本册现取**；`apiErrorMessage` 行号 `auth.js:177-187` = **本册现取**；`data-sf-m="mkt-ledger"` = **本册现取**；`src/index.ts:633` = **本册现取**；**无一处来自转抄或推断**）。


### 8.21 v1.9 变更记录与自曝（**本节对 v1.9 生效；上文 §8.1–§8.20 为历史留痕**）

**8.21.1 声明（写盘范围 · 逐条）**：本单**只写四个文件**：`docs/route-layer.spec.md`（**就地升 v1.9**：顶部 v1.9 状态块 + **§12.3 / §12.11.6 / §15.2 三处 v1.9 就地加注** + **§12.13 / §14.3 / §15.4（新）** + **§8.1 表 v1.9 行** + **§8.21（本节）**）、`docs/versions/route-layer.spec.v1.9.md`（**快照 = 新版本号 + 改后正文**；惯例已先校验，见 8.21.5-④）、`docs/audit/route-layer-v1.9-delta.md`（本单 delta 件）、本单**原始输出**（若有 ⇒ 用 `.json` / `.txt`，**不用 `.log`**）。

**8.21.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：

| # | 未测项 | 原因 |
|--:|---|---|
| ① | **`0024` apply 后的 HTTP 行为面** | 本册**零 HTTP**（只读源码 / 只读 recon 产物）⇒ 行为面 `NOT_MEASURED` |
| ② | **服务层 `listing-funds-service.ts:62` 单点是否已升级（卖方 ∨ 管理员）** | 本册**未改、未测代码**；`backend-ts/**` **正被并发单元改写**（行号是移动靶）⇒ `NOT_MEASURED` |
| ③ | **`docs/data-layer.spec.md` 是否已登记 `0024` 涉表** | 本册**禁改**该件、**未读改** ⇒ `NOT_MEASURED` |
| ④ | **26 处 `sendError` 的逐条行号 / message 现取复核** | **转引** `docs/audit/p7-a-ledger-read-fix2.md §5`（本册只转引计数结论 + 点名 1 处）⇒ 逐条 `NOT_MEASURED` |
| ⑤ | **回退护栏门的当日判负实跑读数** | 本册**不跑前端套件**（只读源码取真源行号）⇒ 门读数**转引** `docs/audit/p7-b-errfallback.md §4/§5` |
| ⑥ | **AC-11 竞争实测（两会话阻塞时长 / 并发恰一次）** | 需实现批 / 质检批在**测试环境**执行；本册**零库写** ⇒ `NOT_MEASURED` |

**8.21.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得（承 v1.8 §8.20.3-①）** | 派单说「§12.3 G2 **就地订正**」；硬口径 ② 判据 = **删除列 = 0** ⇒ **取机器判据优先**：**G2 / AC-13⑥ 表体一字未动**，**订正由就地加注行承载** + **旧写法逐字引在加注内 ⇒ 留痕成立**（先例 = v1.5 补注块 ⑳ / v1.7 补注块 ㉓ / v1.8 §8.20.3-①）。 |
| ② | **§15.2 的 `NOT_MEASURED` 前提已消失** | v1.8 载「该件开工时尚未落盘 ⇒ 清单 = `NOT_MEASURED`」；**本单现取 = `docs/audit/p7-a-ledger-read-fix2.md` 已落盘** ⇒ **§15.2 加注就地更新读法**（**§15.2 正文一字未动**；**不删 `NOT_MEASURED` 旧文**）。 |
| ③ | **`:1477` 是早期 artifact 行号** | 本册现取 = **`:1482`（注册行 `:1472`）**（转引 fix2 §5 点名）；**旧引 `:1477` 作废**（§15.4）。 |
| ④ | **AC-11 原判负「`+4` 自证」结构性不可行** | 需第二个库 + 需改已应用迁移 ⇒ **改可复现三条**；**原判负行保留不删**（§12.11.6 加注 + §8.21.2-⑥）。 |
| ⑤ | **并发写者 ⇒ 行号锚点是移动靶（承 v1.8 §8.20.3-⑥）** | `backend-ts/src/index.ts` 正被并发单元改写 ⇒ 本册**只现取注册点计数（68）**，**不把任一静态行号冒充现盘**；**点名行号（`:1472` / `:1482`）标「转引 fix2 §5、以该报告现取为准」**。 |

**8.21.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（Zang / 派单） | 落点（本册） |
|---|---|---|
| ① §12.3 G2 就地订正（以 AC-13 为准 · 删不可达分支 · 旧写法留痕） | Zang 终审（本单派单 ①） | **§12.3 v1.9 加注** |
| ② AC-11 判负改可复现三条 + `+4` 判负登记归 P8 前可选 | Zang 终审（本单派单 ②） | **§12.11.6 v1.9 加注** |
| ③ 回退护栏纪律 + 132 键登记 | 批 7-B（本单派单 ③） | **§14.3（新）** |
| ④ 同族 `sendError` 26 处登记 + `:1482` 勘误 | **转引** `docs/audit/p7-a-ledger-read-fix2.md §5`（本单派单 ④） | **§15.4（新）+ §15.2 加注** |
| ⑤ 迁移 `0024` 已 apply 事实 | 批 7-B 现取（本单派单 ⑤） | **§12.13（新）** |
| ⑥ 变更记录 / 快照 / delta 件 | 派单硬口径 ③④ | **§8.1 v1.9 行** + §8.21 + 快照 `docs/versions/route-layer.spec.v1.9.md` + `docs/audit/route-layer-v1.9-delta.md` |

**8.21.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**，读数见 delta 件 §D0）｜④ **快照惯例已先校验** ✅（开工前 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.8.md` = **0**（identical）⇒ 惯例 = 「新版本号 + 改后正文」⇒ 本单照做；改后 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.9.md` = **0**）｜⑤ **v0.1–v1.8 十八个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 追加 v1.9 行 + §8.21）｜⑦ **不得改**：任何代码（`backend-ts/**` 正被 Kong 并发改写 / `frontend/**`）/ `migrations/**` / `docs/data-layer.spec.md` / `ledger.spec.md` / `commission.spec.md` / `docs/design/**` / `docs/seafood.master-plan.md` / `docs/audit/**` 既有件 / `docs/qa/**` ✅（**全部零改动**；本单只新建 `docs/audit/route-layer-v1.9-delta.md`）｜⑧ **无 `git add/commit/push` / 无 `npm install` / 未碰 `.env*` / 未用 `pkill -f`·`killall` / 未启停 5787·5788** ✅｜⑨ **原始输出不用 `.log`** ✅｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（8.21.2 六项 ①–⑥；**无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（**派单 ①②③④⑤ 的裁定 / 事实已给全** ⇒ **无「二选一」型未决**；**确实无先例处见 §8.21.2**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 delta 件 §D0）｜⑬ **未发明任何规格值** ✅（`0024` 读数 = **本册现取**（recon 两件 + `shasum`）；26 处 = **转引** fix2 §5；护栏门读数 = **转引** p7-b；**无一处来自推断**）。

### 8.22 v2.0 变更记录与自曝（**本节对 v2.0 生效；上文 §8.1–§8.21 为历史留痕**）

**8.22.1 声明（写盘范围 · 逐条）**：本单**只写四个文件**：`docs/route-layer.spec.md`（**就地升 v2.0**：顶部 v2.0 状态块 + **§12.5 / §12.11.6 两处 v2.0 就地加注** + **§8.1 表 v2.0 行** + **§8.22（本节）**）、`docs/versions/route-layer.spec.v2.0.md`（**快照 = 新版本号 + 改后正文**；惯例已先校验，见 8.22.5-④）、`docs/audit/route-layer-v2.0-delta.md`（本单 delta 件）、本单**原始输出**（若有 ⇒ 用 `.json` / `.txt`，**不用 `.log`**）。

**8.22.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：

| # | 未测项 | 原因 |
|--:|---|---|
| ① | **AC-11 期望订正的 HTTP 行为面** | 本册**零 HTTP**（只读既有批 7-B 产物）⇒ 行为面 `NOT_MEASURED`（实测证据为**函数调用层**，非 HTTP） |
| ② | **`p7b-07-ac11-collect1.json` 派生布尔 `verdict_iii.exactly_one_effective = false` 的成因** | 该布尔与同一件的 `deltas` **不自洽**；脚本 `p7b-07-ac11.ts` 正被并发改写 ⇒ **不解释**，归因 `待 Zang 确认` |
| ③ | **「同键异内容」在 HTTP 面的正向探测（是否真在路由层不可达）** | 本册**零 HTTP**；结论「`NOT_APPLICABLE`」由**派生同源（键 ∧ 指纹皆由 `order_id` 派生）** 静态得出 ⇒ 运行时探测 `NOT_MEASURED` |
| ④ | **服务层 `listing-funds-service.ts:62` / 路由闸的当前落点** | `backend-ts/**` **正被 Kong 并发改写**（行号是移动靶）⇒ **不现取行号** |
| ⑤ | **`docs/data-layer.spec.md` 是否登记 `LD003` 载体口径** | 本册**禁改**该件、**未读改** ⇒ `NOT_MEASURED` |

**8.22.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得（承 v1.8 §8.20.3-① / v1.9 §8.21.3-①）** | 派单说「就地订正」；硬口径 ② 判据 = **删除列 = 0** ⇒ **取机器判据优先**：**§12.5 / §12.11.6 表体与正文一字未动**，订正由就地加注行承载 + **旧写法逐字引在加注内 ⇒ 留痕成立**。 |
| ② | **AC-11 的 `409` 是「派单写错」而非「实现走偏」（Zang 自我更正）** | **原期望行（含 `409`）保留不删**（`:3314`）；**订正由 §12.11.6 v2.0 加注承载**；**不改判据列、不改判负自证行**。 |
| ③ | **同源旧写法散落 4 处未逐处改**（§12.6 `:3082` / §12.9 `:3128` / 顶部 v1.6 块 ⑨ `:136` / §12.11.7 · Z8 行 `:3175`） | **一律以 §12.11.6 v2.0 加注为准**（**4 处原文逐字未动**，各在原位加注其行号；**避免多处重写破坏只追加**）。 |
| ④ | **`verdict_iii.exactly_one_effective = false` 与自件 `deltas` 不自洽** | **不解释、不发明原因**（脚本被并发改写）⇒ 登记为本册 §8.22.2-②；**AC-11 口径只取 `criterion_iii_concurrent` + `deltas`**。 |
| ⑤ | **并发写者 ⇒ 行号锚点是移动靶（承 v1.8 §8.20.3-⑥ / v1.9 §8.21.3-⑤）** | 本册**不把任一 `backend-ts/**` 静态行号冒充现盘**；引用的行号（`src/index.ts:254` / `listing-funds-service.ts:300` / `p7b-07`·`p7b-08` 脚本行）**均标「转引 / 现取于产物」**。 |

**8.22.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（Zang 自我更正 / 裁定 · 派单） | 落点（本册） |
|---|---|---|
| ① AC-11 期望订正（`409` 作废 ⇒ `200` + `idempotent_replay:true`；保留两条判据；旧写法留痕） | Zang 自我更正（本单派单 ①） | **§12.11.6 v2.0 加注** |
| ② 「同键异内容 ⇒ `409`」载体定层 = DB 层（`LD003`）+ HTTP 面 `NOT_APPLICABLE` + 旧写法留痕 | Zang 裁定（本单派单 ②） | **§12.5 v2.0 加注** |
| ③ AC-13⑥ 措辞确认（「路由分支删除」与「`NOT_ADMIN` 常量保留」两句并列） | Zang 确认（本单派单 ③） | **§12.11.6 v2.0 加注** |
| ④ 变更记录 / 快照 / delta 件 | 派单硬口径 ③④ | **§8.1 v2.0 行** + §8.22 + 快照 `docs/versions/route-layer.spec.v2.0.md` + `docs/audit/route-layer-v2.0-delta.md` |

**8.22.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**；引用的实测键 `SELECT public.listing_refund_post_event($1::jsonb)` 逐条 `public.`）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**，读数见 delta 件 §D0）｜④ **快照惯例已先校验** ✅（开工前 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.9.md` = **0**（identical）⇒ 惯例 = 「新版本号 + 改后正文」⇒ 本单照做；改后 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.0.md` = **0**）｜⑤ **v0.1–v1.9 十九个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 追加 v2.0 行 + §8.22）｜⑦ **不得改**：任何代码（`backend-ts/**` 正被 Kong 并发改写 / `frontend/**`）/ `migrations/**` / 其它 spec（`data-layer` / `ledger` / `commission`）/ `docs/design/**` / `docs/seafood.master-plan.md` / `docs/audit/**` 既有件 / `docs/qa/**` ✅（**全部零改动**；本单只新建 `docs/audit/route-layer-v2.0-delta.md`）｜⑧ **无 `git add/commit/push` / 无 `npm install` / 未碰 `.env*` / 未用 `pkill -f`·`killall` / 未启停 5787·5788** ✅｜⑨ **原始输出不用 `.log`** ✅（本单**无新原始输出**，只转引既有 `.json` 产物）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（8.22.2 五项 ①–⑤；**无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（**派单 ①②③ 的更正 / 裁定 / 确认已给全**；**确实无先例者见 §8.22.2-②③ / §8.22.3-④**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 delta 件 §D0）｜⑬ **未发明任何规格值** ✅（`LD003` / `idempotent_replay` / `txid` 逐字 = **转引 `backend-ts/.p7b-artifacts/*.json` 现取**；**无一处来自推断**）。

### 8.23 v2.1 变更记录与自曝（**本节对 v2.1 生效；上文 §8.1–§8.22 为历史留痕**）

**8.23.1 声明（写盘范围 · 逐条）**：本单**只写三个文件**：`docs/route-layer.spec.md`（**就地升 v2.1**：顶部 v2.1 状态块 + **§3.3 / §14.3 两处 v2.1 就地加注** + **§15.4 v2.1 加注 + §15.5 / §15.6 / §16（新）** + **§8.1 表 v2.1 行** + **§8.23（本节）**）、`docs/versions/route-layer.spec.v2.1.md`（**快照 = 新版本号 + 改后正文**；惯例已先校验，见 8.23.5-④）、`docs/audit/route-layer-v2.1-delta.md`（本单 delta 件）。**零代码 · 零迁移 · 零库连接 · 零 HTTP · 零套件**。

**8.23.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：

| # | 未测项 | 原因 |
|--:|---|---|
| ① | **门当日判负实跑**（`p7c-errmsg-machinecode-gate` / `p7b-errfallback-gate` / `p7a-03-errmessage-gate`） | 本册**不跑前端套件**（只读源码 + 只读 locale）⇒ 门读数**转引** `docs/seafood.master-plan.md §5.171 A`（Zang 亲跑七门），**不转引冒充实测** |
| ② | **33 码 × 4 语文案的语言质量**（逐条） | 归**产品 / 文案**面；本册**只取键数（33 / 语）与键集相等（`flat` 737 × 4）**；语言面读数**转引** §5.171 A |
| ③ | **§15.5 A 类「省略第 4 参」的调用点逐点枚举** | 需逐调用点判读 / AST；本册只给**定义面** 7 处回退位 ⇒ **不把「7」当偏离调用点计数** |
| ④ | **§15.5 D 类 26 处的逐条行号 / message** | **转引** `docs/audit/p7-a-ledger-read-fix2.md §5`；本册**不复算、不转抄** |
| ⑤ | **后端 `message` 面「新增违规点」的全量扫描** | 属**实现批**扫描面（本册不持该类级命令面） |
| ⑥ | **`frontend/src/**` 其余页面直拼错误串的现状** | 归 §14.1 的门（`p7a-03`）；本册**不重取其扫描面** |
| ⑦ | **服务端存量偏离的改写排期 / 分批切分** | **未定**（归**实现批**；本册**只登记为技术债 + 非阻塞**） |
| ⑧ | **§15.5 F 类（`LEDGER_ERROR_TABLE` 中文 `message`）是否并入本技术债批次** | **待 Zang**（本册**不自行裁定**；只登记现取读数 = 33 条 message 为中文句） |

**8.23.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得（承 v1.8 §8.20.3-① / v1.9 §8.21.3-① / v2.0 §8.22.3-①）** | 派单说「就地加注」；硬口径判据 = **删除列 = 0** ⇒ **取机器判据优先**：**§3.3 / §14.3 / §15.4 正文与表格 / 单元格一字未动**，加注与更新**全部**由**新增加注行 + 新小节**承载 + **旧写法逐字引在加注内 ⇒ 留痕成立**。 |
| ② | **`sendError` 计数在两时点不同（转引 27 / 本册 50 行命中）** | 差异源 = **注释行**（批 7-A 之后新增多处「修前：本 catch 硬编码 `sendError(res, 500, …)`」注释）⇒ 本册给**同口径复核**（50 命中 − 24 注释行 = **26**，与 fix2 §5 的 26 处逐条表**一致**）；**两时点 sha256 均已列出**（`c4db3627…` / `9b90bed4…`），**不掩盖**。 |
| ③ | **行号是移动靶（承 v1.8 §8.20.3-⑥ / v1.9 §8.21.3-⑤ / v2.0 §8.22.3-⑤）** | 本册引用的 `frontend/src/auth.js` 行号系 **v2.1 现取**（该件现 **373 行**；`resolveI18nMessage` = `:256-279`、机读码判据 = `:155-166`），与 v1.9 §14.3 所引 `auth.js:177-187` **不同时点** ⇒ **两者并存、以现取为准**；`backend-ts/**` 行号均标时点 sha。 |
| ④ | **`docs/audit/p7-d-errmsg-i18n.md` 不存在** | 批 7-D 回执称已落盘、**实际无该件**（本册现取 `ls` = 0；转引 §5.171 B · D-2）⇒ **本册 7-D 成果不引该件**，改以「门读数 + Zang 亲核 + 本册现取」三源承载（§16.3）。 |
| ⑤ | **「本地化」两口径易混（33 键 vs 132 节点）** | **33 = 每语键数**；**132 = 33 码 × 4 语的「需护栏节点数」** ⇒ 本册 §16.3 **显式分标**（承 §5.171 B · D-1 的失真教训）。 |
| ⑥ | **§15.5 的「7 处」是回退位、不是偏离调用点数** | 本册在 §15.5 A 行**显式写明**，避免被读成「偏离 7 处」。 |

**8.23.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（Zang §5.171 / 批 7-C·7-D / 派单） | 落点（本册） |
|---|---|---|
| ① **R107 `message` 语义写死**（`code` 机读唯一真源 / `i18n_key` 本地化真源 / `message` 人类可读稳定英文句 · 严禁机读码） | Zang §5.171 C（**批 7-E 降级为规范澄清**）+ 本单派单 ① | **§3.3 v2.1 就地加注〔条款 9′〕** + **§15.5** |
| ② **存量偏离清单**（登记 · 技术债 · 分批实现 · 非阻塞） | 派单 ② + 证据 = `docs/audit/p7-a-ledger-read-fix2.md §5` | **§15.5〔新〕A–F** + **§15.4 v2.1 加注** |
| ③ **前端错误文案链四跳 + 机读码判据**（`message` 面 = 批 7-C / `reason` 面 = 批 7-D R1′） | 派单 ③ + `docs/audit/p7-c-errmsg-scope.md` + `docs/qa/p7-c-errmsg-scope-review.md` + §5.171 A | **§14.3 v2.1 就地加注** + **§16.1 / §16.2** |
| ④ **33 码闭集已逐码本地化**（四语键集相等 · 每语 33 键 · `flat = 737`） | Zang §5.171 A（亲核）+ 本册现取复核 | **§16.3** |
| ⑤ **正向约束**（新增错误面不得把码塞进 `message`） | Zang §5.171 C 逐字 + 派单 ③ | **§15.6〔新〕** |
| ⑥ **变更记录 / 快照 / delta 件** | 派单硬口径 | **§8.1 v2.1 行** + §8.23 + 快照 `docs/versions/route-layer.spec.v2.1.md` + `docs/audit/route-layer-v2.1-delta.md` |

**8.23.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**；`difflib.SequenceMatcher` 独立复核 = **只见 `equal` + `insert`（0 `replace` / 0 `delete`）**，读数见 delta 件 §D0/§D2）｜④ **快照惯例已先校验** ✅（开工前 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.0.md` = **0**（identical）⇒ 惯例 = 「新版本号 + 改后正文」⇒ 本单照做；改后 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.1.md` = **0**）｜⑤ **v0.1–v2.0 二十个快照未触碰** ✅｜⑥ **变更记录** ✅（§8.1 追加 v2.1 行 + §8.23）｜⑦ **不得改**：任何代码（`backend-ts/**` / `frontend/**`，**只读引用**）/ `migrations/**` / 其它 spec（`data-layer` / `ledger` / `commission`）/ `docs/design/**` / `docs/seafood.master-plan.md` / `docs/audit/**` 既有件 / `docs/qa/**` ✅（**全部零改动**；本单只新建 `docs/audit/route-layer-v2.1-delta.md` + `docs/versions/route-layer.spec.v2.1.md`）｜⑧ **无 `git add/commit/push` / 无 `npm install` / 未碰 `.env*` / 未用 `pkill -f`·`killall` / 未启停 5787·5788** ✅｜⑨ **原始输出不用 `.log`** ✅（本单**无新原始输出**）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（8.23.2 八项 ①–⑧；**无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（§15.5 F 类是否并入批次**交 Zang**、不自行裁定）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 delta 件 §D0；两时点 sha256 并列见 8.23.3-②）｜⑬ **未发明任何规格值** ✅（判据正则 / 键数 / `flat` / 门读数逐字 = **转引或现取**，**无一处来自推断**）。

### 8.24 v2.2 变更记录与自曝（**本节对 v2.2 生效；上文 §8.1–§8.23 为历史留痕**）

**8.24.1 声明（写盘范围 · 逐条）**：本单**只写三个文件**：`docs/route-layer.spec.md`（**就地升 v2.2**：顶部 v2.2 状态块 + **§7 v2.2 追加表〔7-62/7-63/7-64〕+ 补注块 ㉛/㉜** + **§17〔新〕** + §8.1 表 v2.2 行 + 本节）；快照 `docs/versions/route-layer.spec.v2.2.md`（**与正文 `cmp` = 0**）；delta 件 `docs/audit/route-layer-v2.2-delta.md`。**★ 同批姊妹册**（另一册 · 本单范围内）= `docs/data-layer.spec.md` **v0.10 §21** + 其快照（`v0.9.md` 改前 / `v0.10.md` 改后）+ 其 delta 件 `docs/audit/data-layer-v0.10-delta.md`。**未碰**：任何代码（`backend-ts/**` / `frontend/**` 只读）、`migrations/**`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**`（**既有件**）、`docs/design/**`、**其它 spec（含 `ledger.spec.md` —— 未获批，本单不碰）**、`docs/audit/commission.spec.md`（若在，只读不碰）。**零 `git add/commit/push`、未 `npm install`、未碰/打印 `.env*`、未用 `pkill -f`/`killall`、未启停 5787/5788。**

**8.24.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：见 **§17.7**（**五项**逐条；另 **`§7-62` 的「11 键内无合适键」是「停报」不是「未做完」**）。

**8.24.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得（承 v1.5 §8.17.3-① / v1.6 §8.18.3 / v1.7 §8.19.3 / v2.x §8.22.3-①）** | 派单把「R-8-3 写入 `§7-53`」与「`git diff --numstat` 删除列 = 0」并列 ⇒ **在同一行内加注即产生 1 个删除行** ⇒ **取机器判据优先**：**`§7-53` 行体一字未动**，`R-8-3` 的条款**落在新增 §17.5 + 新增 7-62 + 补注块 ㉛**（口径同 v1.5 补注块 ⑳ / v1.6 ㉓ / v1.7 ㉖）。**本单未改任何既有单元格。** |
| ② | **`§7-16` / `§7-23` 行内的「归**批 6** 配置面」字样与 `R-8-4`（8① = 批 8 第一批）字面不一致** | **不就地改写**（守删除列 = 0）⇒ **只登记**（补注块 ㉜）：**「归批 6」= 立项时点口径**；`R-8-3`/`R-8-4` 已把**执行切片**重新指派为 **批 8 首片（8①）** —— **归属物不变、切片号变了**。**读法以 §17 + `data-layer.spec` v0.10 §21 为准。** |
| ③ | **权限映射表里「8 ⑦ 审计读口」= 无合适键 ⇒ 停报** | **按 `R-8-1` 停下报裁、不硬造键**；登记 **§7-62**；**裁定前不得实现**。**★ 本项是「停报」而非「未做完」**（`R-8-1` 逐字允许且要求）。 |
| ④ | **审计台对账判据的「拒绝行 `txid = NULL`」边界（本册新增 · 无先例）** | `R-8-3` 的判据若**不写边界会产生假红**（`result='rejected_*'` 的行**本无 `txid`** —— 依据 = `0023:79` 逐字「依据账本回执 `txid`（成功时；**拒绝行 = NULL**）」+ `0023` 注释 `:108`/`:196` 与 `0024:57/:79` 同款）⇒ 本册**显式写死豁免**（§17.5(c)-3），并**登记为「本册新增的边界」**（属**无先例处**，落 **§8.24.4**）。 |
| ⑤ | **`§7-16` 黑名单删除的认领状态未知** | **`NOT_MEASURED`**（§17.7-5）⇒ **不假设已有认领方**；登记 `AT-R1`，**不把「已登记」写成「已排期」**。 |
| ⑥ | **本单的「权限映射表」覆盖 8 片中的 6 片，2 片（④⑤ / ⑦）为待裁** | **非疏漏**：②③⑥ 可直接映射（`manage_settings` / `manage_settings` / `read_users`+`manage_permissions`），**④⑤⑦ 需裁定**（新键本批不可行 ⇒ 见 `7-62` / `7-63`）；**映射表逐行给死、不凑数**（`R-8-1`）。 |

**8.24.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（Zang 裁定 / 派单） | 落点（本册） |
|---|---|---|
| ① **权限映射表**（先现取逐字十一键，再给「所需权限 → 既有键」映射；无合适键 ⇒ 显式「停报」） | **`R-8-1`** | **§17.2** + **7-62** / **7-63** |
| ② **写口准入**（现取 `GET`/`POST` 两闸 + `ops:` 键 + 费率键闸现行；`AR1`–`AR4`） | `R-8-1` / `DL36` / `§7-16` | **§17.3** |
| ③ **载体键名约定**（保证金金额键 · 与数据层现取风格一致） | **`R-8-5`** / `§7-23` | **§17.4** + **7-64** |
| ④ **审计台并联对账条款**（并联读取 + 统一呈现 + `txid` 对账判据） | **`R-8-3`**（`§7-53` 已留位） | **§17.5** + **7-62** + 补注块 ㉛ |
| ⑤ **`app_config` 键清单 / 写入门禁**（姊妹册 → 本册引用，不重抄） | `R-8-3` / `R-8-4` | `data-layer.spec` **v0.10 §21**（本册 §17.2 / §17.3 / §17.4 **指路**） |
| ⑥ **变更记录 / 快照 / delta 件** | 派单 ③ | **§8.1 v2.2 行** + §8.24 + `docs/versions/route-layer.spec.v2.2.md` + `docs/audit/route-layer-v2.2-delta.md` |

**8.24.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**；所引既有 SQL 均带 `public.`）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` = **`190  0`**，见 delta §D0 + §8.24.6）｜④ **旧快照零改动** ✅（`v0.1`–`v2.1` **二十一**个快照**一字未动**；本单**新建** = `v2.2.md`）｜⑤ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑥ **未发明项** = **权限键 / 键名 / 数值 / 路径名 / 日期** 一律**未发明**（候选名标「候选、不构成裁定」；无合适键处**停报**）｜⑦ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`/`killall` / 未启停 5787-5788** ✅。

**8.24.6 只追加自证（机器判据）**：`git diff --numstat docs/route-layer.spec.md` ⇒ **`190  0`**（**本单完工时点现取**；本版 **3840 → 4030 行**、**净增 190 行 / 零删除**）；**逐 opcode 复核**（`difflib.SequenceMatcher`）⇒ **只允许 `equal` / `insert`，`replace` 与 `delete` 计数 = 0**（口径同 v2.1 §8.23.5）。**★ 同批姊妹册** `docs/data-layer.spec.md` 同样满足（其 delta 件 §D0 报数）。

### 8.25 v2.3 变更记录与自曝（**本节对 v2.3 生效；上文 §8.1–§8.24 为历史留痕**）

**8.25.1 声明（写盘范围 · 逐条）**：本单**只写四个文件**：`docs/route-layer.spec.md`（**就地升 v2.3**：顶部 v2.3 状态块 + **§7 v2.3 追加表〔7-65/7-66/7-67/7-68〕+ 补注块 ㉝/㉞/㉟** + §8.1 表 v2.3 行 + **§8.25（本节）** + **§18〔新〕**）；快照 `docs/versions/route-layer.spec.v2.3.md`（**与正文 `cmp` = 0**）；delta 件 `docs/audit/route-layer-v2.3-delta.md`；**★ 同批姊妹册**（另一册 · 本单范围内）= `docs/data-layer.spec.md` **v0.11 §22** + 其快照 `docs/versions/data-layer.spec.v0.11.md`（**改前快照 = `v0.10.md`，开工前既存、本单未动**）+ 其 delta 件 `docs/audit/data-layer-v0.11-delta.md`。**未碰**：任何代码（`backend-ts/**` / `frontend/**` **只读**）、`migrations/**`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**`（**既有件**；本单只**新建**两个 delta 件）、`docs/design/**`、**其它 spec（含 `ledger.spec.md` —— 只读引用 §14.3 的借用码授权，未改其一字）**、`commission.spec`。**零 `git add/commit/push`、未 `npm install`、未碰/打印 `.env*`、未用 `pkill -f`/`killall`、未启停 5787/5788。**

**8.25.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：见 **§18.9**（**六项**逐条；另 **`§7-62` / `§7-63` 的「停报 / 待确认」在本单已由裁定闭合，不属未测项**）。

**8.25.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **★ `D-1`：本册 v2.2 的三处引用锚错（`§12.1.1:3042` = 空行）+ 引号内非逐字** | **本册自身已犯「引用纪律」首例** ⇒ **不改旧行**（守「删除列 = 0」），**改以勘误块承载**（**§18.5**：错引位置 / 错因 / 正确锚 `:3080`（节头）· `:3096`（内容行） / **逐字原文**）；**并据此立「引用纪律」为长期条款**（§18.6 + 7-68）。**★ 属引证卫生缺陷，非条文错误**（§12.1.1 枚举的实质 = 4 处同批改，与本册引用处语义一致）。 |
| ② | **「就地加注」与「删除列 = 0」不可兼得（承 v1.5 §8.17.3-① / v1.6 §8.18.3 / v1.7 §8.19.3 / v2.x §8.22.3-① / §8.24.3-①）** | 本单同样把「裁定写入 `§7-62` / `§7-63` / `§7-64`」与「删除列 = 0」并列 ⇒ **取机器判据优先**：**三行行体一字未动**，裁定落在**新增 §18.2–§18.4 + 新增 7-65/7-66/7-67 + 补注块 ㉝/㉞/㉟**。**本单未改任何既有单元格。** |
| ③ | **切片编号两套标法并存（本册 §17.2(b) 的 8①…8⑧ vs Zang §5.179 C 定稿 8①..8⑥）** | **不就地改写本册 §17.2(b) / §17.8 的任何一行**（守「删除列 = 0」）⇒ **以新增 §18.8 的对照表统一读法**（**以 Zang §5.179 C 为准**）。**特别提示**：`R-8-9` 的「**8③ 冻结时**入 `AK1`」= **定稿 8③ = 上市保证金片** = 本册 §17.2(b) 末行的「8 ⑤ 保证金规则 / 8 ⑧」**同物**。 |
| ④ | **`D-1` 的行锚在并发实现单落盘后可能再次漂移（承 §8.24.3 与 Neng `O-6`）** | `database.ts` / `index.ts` 在本轮**仍在被并发单元改动**（§18.1 现取：`index.ts` blob md5 ≠ 工作树 md5）⇒ **本单全部行锚 = 对本册自身工作树现取**（**spec 文件未被并发单触碰**），**代码行锚 = 对 `HEAD` 现取**；**实现单落盘后须重锚**（`NOT_MEASURED`，§18.9-4）。 |

**8.25.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（Zang 裁定 / 质检发现） | 落点（本册） |
|---|---|---|
| ① **`R-8-7` 落位**（8⑦ 读口 = `manage_points`；排除 `read_users`；独立键跨批） | **Zang §5.180 C · `R-8-7` 逐字** | **§18.2** + **7-65** + 补注块 ㉝ |
| ② **`R-8-8` 落位**（8④⑤ = 确认 `review_tasks` + takedown 附带条件） | **Zang §5.180 C · `R-8-8` 逐字** | **§18.3** + **7-66** + 补注块 ㉞ |
| ③ **`R-8-9` 落位**（键名批准 / 入册时机 / 不得先行写入 / 数值待 Kevin） | **Zang §5.180 C · `R-8-9` 逐字** | **§18.4** + **7-67** + 补注块 ㉟ |
| ④ **勘误块 `D-1`**（错引位置 / 错因 / 正确锚 / 逐字原文） | 质检单 **`D-1`**（`§3.3` / `§8`） | **§18.5** |
| ⑤ **新纪律「引用纪律」+ 可判负形态** | 质检单 **`D-1`** 的制度化 | **§18.6** + **7-68** |
| ⑥ **借码映射（`AG1`/`AG3`）** | 质检单 `D-2` / `D-3` + 派单 ④；授权锚 = `ledger.spec` §14.3 | **§18.7**（姊妹册 `data-layer.spec` v0.11 §22 同批入册） |
| ⑦ **切片编号对齐 / `O-3` / `D-2` / `D-3` / `D-4` 登记** | 质检单 `§6`（R-8-9 行的切片标签不一致）+ `O-3` + `D-2`/`D-3`/`D-4` + 派单 ⑤ | **§18.8**（对照表）+ **delta 件 §D4/§D5/§D6**（逐条细目） |
| ⑧ **变更记录 / 快照 / delta 件** | 派单硬口径 | **§8.1 v2.3 行** + §8.25 + `docs/versions/route-layer.spec.v2.3.md` + `docs/audit/route-layer-v2.3-delta.md` |

**8.25.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**；所引既有 SQL 均带 `public.`）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**，见 §8.25.6 + delta §D0）｜④ **`difflib` 独立复核 0 replace / 0 delete** ✅（见 §8.25.6 + delta §D0）｜⑤ **快照 `cmp` = 0** ✅（`docs/versions/route-layer.spec.v2.3.md` 与正文**逐字节相同**）｜⑥ **旧快照零改动** ✅（`v0.1`–`v2.2` **二十二**个快照**一字未动**；本单**新建** = `v2.3.md`）｜⑦ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑧ **未发明项** = **权限键 / 键名 / 数值 / 路径名 / 日期 / 错误码 / reason 常量**一律**未发明**（**借码 = 既有闭集内的既有码**；`reason` 常量取自 `data-layer.spec` §21.2 既有写法与 `ledger.spec` §14.3 **既有词表**；**不做第三个 reason**）｜⑨ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`·`killall` / 未启停 5787-5788** ✅｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（**§18.9 六项；无 0 / 无空 / 无占位**）｜⑪ **★ 勘误处置合规** ✅（**旧行一字未改、删除列 = 0**；勘误以**新增块**承载 —— 与「订正旧写法时不许改写它」的既有纪律一致）｜⑫ **★ 未越权** ✅（**本单未把 `listing_deposit_policy` 写成已入册** —— `data-layer.spec` §21.1 清单**未追加任何键行**；`AK2` 号**未占用**）。

**8.25.6 只追加自证（机器判据）**：`git diff --numstat docs/route-layer.spec.md` ⇒ 删除列 = **0**（**本单完工时点现取**；行数 **4030 → 4253**（净增 **223** 行 / 零删除），见 delta §D0）；**逐 opcode 复核**（`difflib.SequenceMatcher`，`autojunk=False`）⇒ **只允许 `equal` / `insert`，`replace` 与 `delete` 计数 = 0**（口径同 §8.23.5 / §8.24.6）。**★ 同批姊妹册** `docs/data-layer.spec.md` 同样满足（其 delta 件 §D0 报数）。**★ 行锚现状警告**：`backend-ts/src/index.ts` 的 `HEAD` blob 与工作树**已不同**（§18.1 现取）⇒ 本册对**代码**的行锚一律注明取自 `HEAD`，**实现单落盘后作废**（§18.9-4）。

### 8.26 v2.4 变更记录与自曝（**本节对 v2.4 生效；上文 §8.1–§8.25 为历史留痕**）

**8.26.1 声明（写盘范围 · 逐条）**：本单**只写三个文件**：`docs/route-layer.spec.md`（**就地升 v2.4**：顶部 v2.4 状态块 + **§7 v2.4 追加表〔7-69 / 7-70 / 7-71〕+ 补注块 ㊱** + §8.1 表 v2.4 行 + **§8.26（本节）** + **§19〔新〕**）；快照 `docs/versions/route-layer.spec.v2.4.md`（**与正文 `cmp` = 0**）；delta 件 `docs/audit/route-layer-v2.4-delta.md`。**★ 姊妹册 `docs/data-layer.spec.md` = 本单判「无须动」⇒ 不升 v0.12、不建快照、不建 delta**（理由逐字见 delta 件 §D7）。**未碰**：任何代码（`backend-ts/**` / `frontend/**` **只读**：`grep` / `sed -n` / `wc`）、`migrations/**`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**`（**既有件**；本单只**新建**一个 delta 件）、`docs/design/**`、`docs/ledger.spec.md`、**`docs/commission.spec.md`（真源册 · 只读 · 一字未改）**。**零 `git add/commit/push`、未 `npm install`、未碰/打印 `.env*`、未用 `pkill -f` / `killall`、未启停 5787/5788。**

**8.26.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：见 **§19.7**（**七项**逐条；**无 0 / 无空 / 无占位**）。

**8.26.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得（承 v1.5 §8.17.3-① / v1.6 §8.18.3-② / v1.7 §8.19.3 / v2.x §8.22.3-① / §8.23.5 / §8.24.3-① / §8.25.3-②）** | 本单同样**不改任何既有行**（`§17.2(b)` 的 8 ② / 8 ③ 行、`§18.5`、`§18.1`、`§1.14`、`§1.11 Q8`、`§4.2` R2/R3 行**一字未动**）⇒ 全部由**新增节 §19 + 追加行（7-69…7-71）+ 补注块 ㊱** 承载。**取机器判据优先**（`git diff --numstat` 删除列 = 0）。 |
| ② | **派单给的「真源册」路径 `docs/audit/commission.spec.md` 现取不存在** | **逐字登记**：`ls docs/audit/` 现取**无** `commission.spec.md`（该目录为审计件目录）；**实际真源 = `docs/commission.spec.md`**（**226740 B**；`docs/versions/commission.spec.v0.1.md` / `v0.2.md` 两快照在场）⇒ **本单按现行路径读**（**只读，未改一字**）；**不作静默改写、不据旧路径造件**。 |
| ③ | **`R-8-14` 的实质：`§18.5` 自身缺版本基线 ⇒ 其「错引位置」列表同样是 v2.2 基线读数** | **§18.5 正文一字未改**（守「删除列 = 0」），**以 §19.6 + 补注块 ㊱ 补声明**；**并承认 `§18.5(a)` 的三处「错引位置」（`:1798` / `:3922` / `:4030`）在现行 v2.3 亦不复现**（**v2.3 现取 = `:1810` / `:3978` / `:4086`**）⇒ **读该表时须连带按版本读**。**★ 属引证卫生缺陷的第二次暴露，非条文错误。** |
| ④ | **新增读口 = 本单「新增」的唯一路径名** | **逐字声明**：路径 **`GET /api/admin/commission_policy`** **非凭空发明** —— **同名路径已在既有注册表内**（`backend-ts/src/index.ts:1999` = `POST /api/admin/commission_policy`），本单**只换 verb**；**先例 = `GET` + `POST /api/admin/settings` 同路径对**（`:1127` / `:1156` 现取）。**★ 除该路径（含其 verb 面）外，本单未新增任何路径 / 权限键 / 表键名 / 错误码 / 日期。** |
| ⑤ | **§19.4 判据的实跑面** | **零库连接 / 零 HTTP / 零套件** ⇒ **判据已写死、未实跑**（§19.7-3）；**不得**读作「已验证生效」。**四段 + 每段判负形态 = 已给；实跑读数 = 未给（`NOT_MEASURED` + 原因）**。 |

**8.26.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（派单 / Zang 裁定） | 落点（本册） |
|---|---|---|
| ① **读写口契约 + 新增 admin 读口（路径 / R107 形状 / 权限键 / 注册点 68 → 69）** | 派单 ① + **`R-8-6` 逐字** | **§19.2** + **`§7-70`** |
| ② **权限键映射（先现取逐字十一键，再给映射）** | 派单 ② + **`R-8-1` 逐字** | **§19.3** |
| ③ **「真生效」四段判据入册（每段可判负）** | 派单 ③ + **「真生效」判据（P6 的 AC 原文）** | **§19.4** |
| ④ **后台页数据契约 + 四语文案面（禁工程口径泄漏）** | 派单 ④ | **§19.5** + **`§7-71`** |
| ⑤ **`R-8-14` 基线声明（v2.2 基线 / 4030 行 / 行号已漂）** | **`R-8-14` 逐字** | **§19.6** + **补注块 ㊱** |
| ⑥ **`ops:` 幂等键缺口登记** | 本单现取发现（§19.1 末行 / §19.2(a)） | **`§7-69`** |
| ⑦ **变更记录 / 快照 / delta 件** | 派单硬口径 | **§8.1 v2.4 行** + §8.26 + `docs/versions/route-layer.spec.v2.4.md` + `docs/audit/route-layer-v2.4-delta.md` |
| ⑧ **`data-layer.spec`「无须动」判定（含逐字理由）** | 本单判定（依据 = **`DL2` / `DL70` / `DL74` / `DL152`** 均不涉新增表 / 列 / 索引） | delta 件 **§D7** |

**8.26.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**；新增文本无表名引用，唯一相关处 = 转引 `public.` 口径）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**；所引既有 SQL 均带 `public.`）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**，见 §8.26.6 + delta §D0）｜④ **`difflib` 独立复核 0 replace / 0 delete** ✅（见 §8.26.6 + delta §D0/§D2）｜⑤ **快照 `cmp` = 0** ✅（`docs/versions/route-layer.spec.v2.4.md` 与正文**逐字节相同**）｜⑥ **旧快照零改动** ✅（`v0.1`–`v2.3` **二十三个**快照**一字未动**；本单**新建** = `v2.4.md`）｜⑦ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑧ **未发明项** ✅（**费率数值 / 权重数值 / 四语文案值 / 权限键 / `ops:` 键形态 / i18n 键清单**一律**未发明**；**唯一新增路径 = 既有路径换 verb**，见自曝 ④）｜⑨ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`·`killall` / 未启停 5787-5788** ✅｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（**§19.7 七项；无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（`I-1` 的 `data` 形态 A / B **交实现单 + Zang**，本单**不裁定**；`I-4` 的 `ops:` 形态**只给候选、不构成裁定**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 §8.26.6 与 delta 件 §D0）｜⑬ **未发明任何规格值** ✅（费率 / 权重「预期组合」= **转引** `data-layer.spec` §17.2 `DL152` 现取，**已标来源**；`CommissionPolicy` 8 键 = **现取** `src/commission.ts:122-131`；注册点 **68** = **本单现取**；十一键 = **本单现取**三处；**无一处来自推断**）。

**8.26.6 只追加自证（机器判据）**：`git diff --numstat docs/route-layer.spec.md` ⇒ **`337	0`**（**删除列 = 0**；**本单完工时点现取**；行数 **4253 → 4589**（净增 **336** 行 / **零删除**），见 delta §D0）；**逐 opcode 复核**（`difflib.SequenceMatcher`，对照 `docs/versions/route-layer.spec.v2.3.md`，`autojunk=False`）⇒ **只允许 `equal`（6）/ `insert`（6），`replace` 与 `delete` 计数 = 0**（口径同 §8.23.6 / §8.24.6 / §8.25.6）。**★ 姊妹册 `docs/data-layer.spec.md` = 本单未动**（判据 = `git diff --numstat docs/data-layer.spec.md` ⇒ **`0\t0`**）。**★ 行锚现状警告**：`backend-ts/src/index.ts` 行号随并发单元漂移（本单现取 `wc -l` = **2105**）⇒ 本单所引**代码**行锚一律注明**本单现取时点**，**实现单落盘后作废、须重锚**；**本册自身的 `:NNNN` 锚**（§19.6 的漂移对照表）**以 `docs/route-layer.spec.md` 现盘为准**。


### 8.27 v2.5 交付声明 / `NOT_MEASURED` / 自曝 / delta 对照 / 纪律自检 / 只追加自证（**批 8 第 3 片（8③）**）

**8.27.1 声明（写盘范围 · 逐条）**：本单**只写三个文件**：`docs/route-layer.spec.md`（**就地升 v2.5**：顶部 v2.5 状态块 + **§7 v2.5 追加表〔7-72 / 7-73 / 7-74〕+ 补注块 ㊲** + §8.1 表 v2.5 行 + **§8.27（本节）** + **§20〔新〕**）；快照 `docs/versions/route-layer.spec.v2.5.md`（**与正文 `cmp` = 0**）；delta 件 `docs/audit/route-layer-v2.5-delta.md`。**★ 同批姊妹册（另一册 · 本单范围内）= `docs/data-layer.spec.md` v0.12 §23** + 其快照 `docs/versions/data-layer.spec.v0.12.md`（**改前快照 = `v0.11.md`，开工前既存、本单未动**）+ 其 delta 件 `docs/audit/data-layer-v0.12-delta.md`。**未碰**：任何代码（`backend-ts/**` / `frontend/**` **只读**：`grep` / `sed -n` / `wc` / `md5` / `ls`）、`migrations/**`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**`（**既有件**；本单只**新建**两个 delta 件）、`docs/design/**`、`docs/ledger.spec.md`、**`docs/commission.spec.md`（真源册 · 只读 · 未改一字）**。**零 `git add/commit/push`、未 `npm install`、未碰 / 打印 `.env*`、未用 `pkill -f` / `killall`、未启停 5787/5788。**

**8.27.2 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）**：见 **§20.8**（**八项**逐条；**无 0 / 无空 / 无占位**）。

**8.27.3 自曝（本册的口径缺陷与更正）**：

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得（承 v1.5 §8.17.3-① / v1.6 §8.18.3-② / v1.7 §8.19.3 / v2.x §8.22.3-① / §8.23.5 / §8.24.3-① / §8.25.3-② / §8.26.3-①）** | 本单同样**不改任何既有行**（`§7-64` / `§7-67` / `§7-23` / `§7-1` / `§17.4` / `§17.3` / `§19.x` 的引用行**一字未动**）⇒ 全部由**新增节 §20 + 追加行（7-72…7-74）+ 补注块 ㊲** 承载。**取机器判据优先**（`git diff --numstat` 删除列 = 0）。 |
| ② | **★ 末行无换行符 ⇒ 「行数」有两个口径（派单质询项）** | **逐字登记**：`docs/route-layer.spec.md` 的**末行（`---`）不带换行符** ⇒ **`wc -l` = 4589（换行数）**、**逻辑行数 = 4590**；**两个数都成立**（差 1 的全部原因 = 末行无换行）。**★ 且本单据此改变了自己的落盘手法**：**新增内容插在末行 `---` 之前**（**不是**在其后追加），**理由 = 机器判据**（在无换行末行之后追加会把它改写成「带换行」⇒ `git diff --numstat` 必记 **1 个删除**；本单已用最小复现件实测：**追加法 = `4 1`** vs **插前 = `3 0`**）⇒ 取后者以守「删除列 = 0」。**★ 读者注意**：本册今后凡报行数，**必须注明用的是哪一种口径**。 |
| ③ | **★ 派单要求「若需新增读口 ⇒ 登记注册点 69 → N」，本单的判决是「不新增」** | **逐字声明**：**现取基线 = 69**（与 v2.4 记载的 **68** 差 +1 = 8② 的 `GET /api/admin/commission_policy`（`:2036`）已落盘）⇒ **本片零新增对外路径 ⇒ 69 → 69**。**判决理由（可判负）**：8③ 的 AC = 「真生效」（**业务层读该键**），**不**要求后台能看见该键；且**任何**新增 admin 读口**必须**先回写本册（路径 / 方法 / 闸 / `data` 键集）+ **登记 69 → N** ⇒ 若实现单私自增口即判负（§20.2(b)）。 |
| ④ | **★ 发现并登记了两处「现取缺口」与一处「已冻结条文 ↔ 本轮裁定的字面互斥」** | **逐字登记**：**(i)** 键寻址面缺口（`§7-72`）；**(ii)** 退市触发面缺失（`§7-73`）；**(iii)** `DL67` / `DL88`（**已冻结**「保证金不退 / 不得提供退还接口」）↔ **`R-8-2`（退市退还）** 的**字面互斥** ⇒ **本单不择一、不停留在「以裁定为准」的模糊话术**，而是**明写双向判负 + 请 Zang 一句话收口**（`§20.5(d)`）。**★ 属「口径冲突登记」，非条文错误**（两侧均逐字现取、均未被改写）。 |
| ⑤ | **§20.4 判据的实跑面** | **零库连接 / 零 HTTP / 零套件** ⇒ **判据已写死、未实跑**（§20.8-2）；**不得**读作「已验证生效」。**四段 + 每段判负形态 = 已给；实跑读数 = `NOT_MEASURED` + 原因**。 |
| ⑥ | **`hold_forfeit` 判负的射程风险** | **逐字声明**：该判据**只**射本片**新增件**；**既有在册件**（`0001` / `0003` / `0004` / `0008` / `0012` / `0019` / `0020` 与 `ledger.ts:154`）的 `hold_forfeit` 字面**不在射程**、**不得**据本条去删改（**防「照判据清历史」这类过度执行**）。 |

**8.27.4 delta 对照（逐条 → 依据 → 落点）**：

| delta | 依据（派单 / Zang 裁定） | 落点（本册） |
|---|---|---|
| ① **载体键入册（`AK2`）+ 入册前写入必被拒的可判负形** | 派单 ① + **`R-8-9` 逐字**（「由 Jing 在 8③ 冻结时正式入 `AK1` 清单」） | **§20**（本册侧）+ **姊妹册 v0.12 §23.1 / §23.2**（键行正文） |
| ② **下限校验机制（数值待 Kevin · 机制先落地 · 客户端永不决定金额）** | 派单 ① + **`R-8-5` / `R-7-23` 逐字** | **§20.7** + §20.9 `I-2` |
| ③ **权限键映射（先现取逐字十一键，再给映射）** | 派单 ② + **`R-8-1` 逐字** | **§20.3** |
| ④ **「真生效」四段判据（含每段判负）** | 派单 ② + **P6 的 AC 原文** | **§20.4** |
| ⑤ **退市退还与既有 `hold_release` 路径的对应关系（逐字引现取真源）** | 派单 ② + **`R-8-2` 逐字** | **§20.5(a)(b)** |
| ⑥ **`hold_forfeit` 禁线** | **`R-8-2` 逐字** + **`DL91`** | **§20.5(c)** + **`§7-74`** |
| ⑦ **口径冲突登记（`DL67`/`DL88` ↔ `R-8-2`）** | 本单现取发现（两侧逐字现取） | **§20.5(d)** + **`§7-73`** |
| ⑧ **读/写口判决 + 注册点 69 → 69（含退市触发口停报）** | 派单 ②（「若新增必须登记注册点 69 → N」） | **§20.2** + **`§7-72`** / **`§7-73`** |
| ⑨ **变更记录 / 快照 / delta 件 + 行数口径判明** | 派单 ③ + 硬口径 | **§8.1 v2.5 行** + **§8.27** + **§20 节首** + `docs/versions/route-layer.spec.v2.5.md` + `docs/audit/route-layer-v2.5-delta.md` |

**8.27.5 纪律自检（逐条对照硬口径与派单纪律）**：① **身份表写 `users`** ✅（**本单零 SQL、零库连接**；新增文本无表名引用）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**；所引既有 SQL 均带 `public.`，如 `public.app_config` / `public.currency_status_log`）｜③ **只追加 / 删除列 = 0** ✅（**非追加改动 = 0 处**；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**，见 §8.27.6 + delta §D0）｜④ **`difflib` 独立复核 0 replace / 0 delete** ✅（见 §8.27.6 + delta §D0/§D2）｜⑤ **快照 `cmp` = 0** ✅（`docs/versions/route-layer.spec.v2.5.md` 与正文**逐字节相同**）｜⑥ **旧快照零改动** ✅（`v0.1`–`v2.4` **二十四个**快照**一字未动**；本单**新建** = `v2.5.md` + `docs/versions/data-layer.spec.v0.12.md`）｜⑦ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑧ **未发明项** ✅（**保证金数值 / 线格式 / 退市路径名 / 权限键 / `ops:` 键形态 / 键内字段名与类型**一律**未发明** —— 全部标「待实现单 / 待 Zang / `TODO: Kevin 定值`」）｜⑨ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`·`killall` / 未启停 5787-5788** ✅｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（**§20.8 八项；无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（`DL67`/`DL88` ↔ `R-8-2` 的冲突**只登记、不择一**；键寻址线格式**只给候选、不裁定**）｜⑫ **报数带口径** ✅（行数**双口径**（`wc -l` 4589 / 逻辑行 4590）+ 字节 + md5 + `numstat`，见 §20.0 / §8.27.6 / delta §D0）｜⑬ **未发明任何规格值** ✅（`50000` = **现取** `currency-service.ts:144`；十一键 = **本单三档现取**；注册点 **69** = **本单现取**；`CommissionPolicy` 类比照读数不在本片使用；**无一处来自推断**）｜⑭ **引用纪律（§18.6 / §19.6(d)）** ✅（本节全部引用**现取且逐字**；代码锚注明「§20.0 末行四件指纹时点」；册内锚注明版本）。

**8.27.6 只追加自证（机器判据）**：`git diff --numstat docs/route-layer.spec.md` ⇒ 见 delta 件 §D0（**删除列 = 0**；**本单完工时点现取**）；**逐 opcode 复核**（`difflib.SequenceMatcher`，对照 `docs/versions/route-layer.spec.v2.4.md`，`autojunk=False`）⇒ **只允许 `equal`（n）/ `insert`（m），`replace` 与 `delete` 计数 = 0**（口径同 §8.23.6 / §8.24.6 / §8.25.6 / §8.26.6）。**★ 姊妹册 `docs/data-layer.spec.md` = 本单**同批**改**（v0.11 → v0.12；其 delta 件 §D0 给该册的 `numstat` 与 `difflib` 读数）。**★ 行锚现状警告**：`backend-ts/src/index.ts`（2130 行）/ `database.ts`（4093 行）/ `currency-service.ts`（449 行）/ `ledger.ts`（1521 行）的行号随并发单元漂移（本单现取 md5 见 §20.0 末行）⇒ 本单所引**代码**行锚一律注明**本单现取时点**，**实现单落盘后作废、须重锚**；**本册自身的 `:NNNN` 锚**以 `docs/route-layer.spec.md` 现盘为准。

### 8.28 v2.6 交付声明 / 只追加自证 / 行号漂移表 / 纪律自检（**v2.6 新增 · 本节只追加**）

**8.28.1 声明（写盘范围 · 逐条）**：本单**只写六个文件**：`docs/route-layer.spec.md`（**就地升 v2.6** = 顶部状态块区**新增 v2.6 块〔8 行，插在 v2.5 块之后、`v1.1 一页纸` 锚行之前〕** + **§7 v2.6 追加表〔7-75 / 7-76 / 7-77〕+ 补注块 ㊳** + **§21〔新〕** + 本节）+ `docs/versions/route-layer.spec.v2.6.md`（**新建** · `cmp` = 0）+ `docs/audit/route-layer-v2.6-delta.md`（**新建**）+ **同批姊妹册** `docs/data-layer.spec.md`（**就地升 v0.13** = 顶部状态块**新增 1 行** + **§24〔新〕**）+ `docs/versions/data-layer.spec.v0.13.md`（**新建** · `cmp` = 0）+ `docs/audit/data-layer-v0.13-delta.md`（**新建**）。**未碰**：`backend-ts/**` / `frontend/**` / `migrations/**` / `docs/seafood.master-plan.md` / `docs/qa/**` / `docs/audit/**` 既有件 / `docs/design/**` / 其它 spec。

**8.28.2 只追加自证（写死 · 可复算）**：`git diff --numstat docs/route-layer.spec.md` ⇒ **`203	0`**（**删除列 = 0** ✅）；`difflib.SequenceMatcher` 独立复核 ⇒ **0 replace / 0 delete**（新增 `203` 行）；**★ 追加手法（写死）**：**§21 插在本册末行 `---` 之前** —— 本册末行**无换行符**，直接在其后追加会把该行由「无换行」改写为「带换行」⇒ `git diff --numstat` 必记 **1 个删除行**（最小复现：**追加法 = `4 1`** vs **插前 = `3 0`**）⇒ **违「删除列 = 0」硬口径** ⇒ 本单取后者。

**8.28.3 行号漂移表（写死 · 承 `R-8-14` / §18.6 · 可复算）**：本版共 **三处新增**（均在既有行**之间**插入、零删除）：**(i)** 状态块 **+8 行 +1 空行 = +9**（在 `§0` 之前）⇒ 影响 `§0` 之后一切；**(ii)** §7 v2.6 追加表 + 补注块 **+13**（在 `§8` 之前）⇒ 影响 `§8` 之后一切；**(iii)** 本节 **+24**（在 `§9` 之前）⇒ 影响 `§9` 之后一切。**⇒ 两段位移量**：**`§0`–`§7` 区 = +9**；**`§8` 之前的 `§7-72/73/74` = +9**（实测 `:1865`/`:1866`/`:1867` ⇒ **`:1874`/`:1875`/`:1876`**）；**`§9` 之后（含 `§20.x` / `§21`）合计 = +9+13+24 = +46**。**逐条实测对照（本版现取）**：

| 对象 | v2.5 基线（`:N`） | **本版现取（`:N+46`）** |
|---|--:|--:|
| `§20.4` 节头（真生效四段） | `:4741` | **`:4787`** |
| `§20.4(b)` 表 ④ 行（「退还面」半句） | `:4761` | **`:4807`** |
| `§20.5` 节头（退市退还 ↔ `hold_release`） | `:4779` | **`:4825`** |
| `§20.5` 节首「裁定锚」行 | `:4781` | **`:4827`** |
| `§20.5(b)`「（b）⇒ 对应关系」行 | `:4793` | **`:4839`** |
| `§20.5(d)`「（d）口径冲突登记」行 | `:4804` | **`:4850`** |
| `§20.9` 的 `I-4` 行 | `:4848` | **`:4894`** |
| `§20.9` 的 `I-5` 行 | `:4849` | **`:4895`** |
| `§20.9` 的 `I-6` 行 | `:4850` | **`:4896`** |

**⇒ 口径（写死）**：**本册此后凡引上列行锚，一律写「基线 `:N` ⇒ 本版现取 `:N+46`」两件**（承 `R-8-14`；**只给一个数的引法 = 缺陷**，§18.6）。**★ §21 自身 = 新增节、无基线**（其行号即本版现取）。

**8.28.4 纪律自检（逐条对照硬口径与派单纪律）**：① **只追加 / 删除列 = 0** ✅（`203	0`）；② **`difflib` 0 replace / 0 delete** ✅；③ **快照 `cmp` = 0** ✅（两册新快照）；④ **旧快照零改动** ✅（route `v0.1`–`v2.5` **二十五个** + data-layer `v0.1`–`v0.12` **十二个**，**一字未动**；本单**新建** = `v2.6.md` + `data-layer.spec.v0.13.md`）；⑤ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅；⑥ **未发明项** ✅（**数值 / 保证金金额 / 权限键 / 路径名 / 错误码一律未发明**；**★ 本单唯一新造物 = 键级寻址线格式**，归属 = 姊妹册 §24.1 —— 属 **`R-8-19` 明派职权**，非硬造）；⑦ **未 `git add` / `commit` / `push` · 未 `npm install` · 未碰 / 未打印 `.env*` · 未 `pkill -f` / `killall` · 未启停 5787/5788** ✅；⑧ **未测项 = `NOT_MEASURED` + 逐项原因**（§21.6 七项；**无 0 / 无空 / 无占位**）✅；⑨ **引用纪律（§18.6）** ✅（本节全部引用**现取且逐字**；**册内行锚一律两件**）；⑩ **★ 更正块不改原行** ✅（`§20.5` 正文 / `§20.4` 正文 / `§20.9` 各行 / `§7-72`·`§7-73`·`§7-74` **一字未动**；作废声明只由 §21.5 追加块承载）。

### 8.29 v2.7 交付声明 / 只追加自证 / 行号漂移表 / 纪律自检（**v2.7 新增 · 本节只追加**）

**8.29.1 声明（写盘范围 · 逐条）**：本单**只写 6 个文件** —— `docs/route-layer.spec.md`（**就地升 v2.7** = 顶部状态块区**新增 v2.7 块〔1 行，插在 v2.6 块之后〕** + **本节 §8.29** + **§22〔新〕**）+ `docs/versions/route-layer.spec.v2.7.md`（**新建** · `cmp` = 0）+ `docs/audit/route-layer-v2.7-delta.md`（**新建**）+ **同批姊妹册** `docs/data-layer.spec.md`（**就地升 v0.14** = 顶部状态块**新增 1 行** + **§25〔新〕**）+ `docs/versions/data-layer.spec.v0.14.md`（**新建** · `cmp` = 0）+ `docs/audit/data-layer-v0.14-delta.md`（**新建**）。**未碰**：`backend-ts/**` / `frontend/**` / `migrations/**` / `docs/seafood.master-plan.md` / `docs/qa/**`（**本刻有质检单在读 · 未触碰**）/ `docs/audit/**` 既有件 / `docs/design/**` / 其它 spec。**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**启停 5787 / 5788。

**8.29.2 只追加自证（写死 · 可复算）**：`git diff --numstat docs/route-layer.spec.md` ⇒ 见 delta 件 §D0（**删除列 = 0**）；`difflib.SequenceMatcher` 独立复核 ⇒ **0 replace / 0 delete**。**★ 追加手法（写死）**：本册末行（逐字 `---`）**不带换行符** ⇒ **一切追加插在末行 `---` 之前**（直接追加会把该行由「无换行」改写为「带换行」⇒ `git diff --numstat` 必记 **1 个删除行**）。**★ 姊妹册 `docs/data-layer.spec.md` = 本单同批改**（v0.13 → v0.14；其末行**带换行符** ⇒ 直接追加于末行之后 = 0 删除行；其 delta 件 §D0 给该册读数）。

**8.29.3 行号漂移表（写死 · 承 `R-8-14` / §18.6）**：本版共 **三处新增**（均在既有行**之间**插入、零删除）：**(i)** 状态块 **+1 空行 +1 行 = +2**（在 `§0` 之前）⇒ 影响 `§0` 之后一切；**(ii)** §8.29 **+N₁**（在 `§9` 之前）⇒ 影响 `§9` 之后一切；**(iii)** §22 **+N₂**（在末行 `---` 之前）⇒ 文件尾部。**★ 精确定量 = 见 delta 件 §D0 的现取读数**（本节不预估）。

**8.29.4 纪律自检（逐条对照硬口径与派单纪律）**：① **只追加 / 删除列 = 0** ✅（见 §8.29.2 + delta §D0）｜② **`difflib` 独立复核 0 replace / 0 delete** ✅｜③ **快照 `cmp` = 0** ✅（`docs/versions/route-layer.spec.v2.7.md` 与正文**逐字节相同**）｜④ **旧快照零改动** ✅（`v0.1`–`v2.6` **二十六个**快照一字未动；本单**新建** = `v2.7.md` + `docs/versions/data-layer.spec.v0.14.md`）｜⑤ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑥ **未发明项** ✅（**状态值 / 新表名 / 新列名 / 审核文案值 / 变体选型**一律**未发明** —— 全部标「待 Zang / 待实现单 / `NOT_MEASURED`」）｜⑦ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`·`killall` / 未启停 5787-5788** ✅｜⑧ **未测项 = `NOT_MEASURED` + 原因** ✅（§22.7；**无 0 / 无空 / 无占位**）｜⑨ **不确定处不二选一** ✅（审核闸三变体**只登记、不择一**；动作口**只登记候选、不裁定**；**选型 = Zang**）｜⑩ **报数带口径** ✅（行数**双口径**（`wc -l` = 换行符数 / 逻辑行 = `wc -l` + 1）+ 字节 + md5 + `numstat`，见 delta 件 §D0）｜⑪ **引用纪律** ✅（本节全部引用**现取且逐字**；代码锚注明「本单现取时点」；册内锚注明版本）｜⑫ **现取冲突已登记且不改他人行** ✅（`currency_status_log` 零写入 ↔ 现取 2 命中 ⇒ §22.1(d) + 姊妹册 §25.2；`p8-p6-recon.md` 与 `master-plan` 该行**一字未改**）。

## §9 ★★ 批 4 施工清单（**v0.8 新增 · 本轮重要交付物**；元信息 = **项目 / 真源锚点 / 行动 / 前置依赖 / 验收判据**）

> **本节的性质**：把**散落在 §1.8 / §2.4 / §3.1 / §5.1 / §5.4 / §7 / §8.3 的「批 4 要做的事」汇总成一张可执行清单**，**每条带真源锚点**。**依据** = Zang §5.86 裁定②（三方分工）+ §5.89 裁定②/B① + §5.90；**判据** = §5.4 逐字「**不得只挑其中几条**（`assets/init` 先例：互推 ⇒ 无人执行）」+ 「**必须先解决 §7-25 的 `create_key` 口径**」。
> **本册只汇总、不实现**（**不改任何代码**）；**每条的实施者 = 实现方（Kong/批 4）；关闭判据由 Zang 批末差集收口**（全量服务层导出 − 已注册 − §1.8 已登记 = ∅）。

### 9.A 注册面 —— §1.8「已实现·未注册清单」十条 + 1 附注（**逐条「由批 4 注册」的具体行动**；**★ v0.9：A1–A11 已全部注册（批 4a）⇒ 本栏已关闭**〔依据 = Zang §5.92〕）

| # | 项目（路径） | 真源锚点 | 行动 | 前置依赖 | 验收判据 |
|--:|---|---|---|---|---|
| **A1** | `POST /api/job`（招工发布 + 托管） | §1.8 `#1`；`src/job-funds-service.ts:149`（`publishJob`） | 注册路由 + 接线 verb | `create_key` **必传**（fail-loud：§4.4-14；缺 ⇒ `400 LD004`）；`reward` = **A 类客户端值**（§4.8） | `200` + `job_escrow` **×2**（§1.9 K4）；缺键 ⇒ `400 LD004`；段 1.8 `#1` 划掉 |
| **A2** | `POST /api/job/:jobId/apply` | §1.8 `#2`；`src/job-service.ts:175`（`applyToJob`） | 注册 | — | 现测 404 → `200`；同键重放 `200`；异键同人 ⇒ `409 LD003` + `application_already_exists`（§4.2 J2） |
| **A3** | `POST /api/job/:jobId/accept` | §1.8 `#3`；`src/job-service.ts:208`（`acceptApplication`） | 注册（**★ 优先级最高**） | — | **§1.9 K11 的集成缺口 F-1 关闭**（批 4 前前端 verify 走不通完整资金链）；并发同时选定由**部分唯一索引**结构性挡（`0014:102`） |
| **A4** | `POST /api/job/:jobId/submit` | §1.8 `#4`；`src/job-service.ts:125`（`submitWork`） | 注册（**可选别名**） | 功能已由既有 `POST /api/task-progress/:identifier/submit`（`:581`）承载 | 两路径**键集一致**（§2 母约束 F1） |
| **A5** | `POST /api/job/:jobId/review` | §1.8 `#5`；`src/job-funds-service.ts:218`/`:237` | 注册（approve = `settleJob` / reject = `refundJob`） | 既有 `/api/tasklist/:jID/verify` 已改接承载（§1.9 K2/K5） | approve **11 键** / reject **9 键**（§4.4-17）；重放 ⇒ 顶层 `idempotent_replay:true`（非 `data` 键） |
| **A6** | `POST /api/job/:jobId/cancel` | §1.8 `#6`；`:237`（`refundJob`） | 注册 | — | §4.2 J6：`escrow_txid IS NULL ⇒ 拒`（防凭空退款，`0013:618-623`） |
| **A7** | `POST /api/listing` | §1.8 `#7`；`src/listing-service.ts:164`（`createListing`） | 注册 | — | §4.2 P1 状态机（`draft→listed→…`）；`409 LD011 + listing_state_invalid` |
| **A8** | `POST\|PATCH /api/listing/:listingId`（编辑 / 下架） | §1.8 `#8`；`:222`（`updateListing`）/`:286`（`transitionListingStatus`） | 注册 —— **整个商品写口未接线**（`src/index.ts` **无** `from './listing-service'` 导入） | 同上 | 同上；`delisted` 终态禁改（§7-18） |
| **A9** | `POST /api/listing/:listingId/buy` | §1.8 `#9`；`src/listing-funds-service.ts:191`（`buyListing`） | 注册 | **须先导入整个模块**（本册现取：`grep -c 'listing-funds-service' src/index.ts` = **0**） | §4.7.3 B8：伪造 `price`/`seller_uid`/`buyer_uid` **被忽略**、分录落服务端取值 |
| **A10** | `POST /api/listing-orders/:orderId/refund`（**路径正典**） | §1.8 `#10`；`:261`（`refundListingOrder`）；**§7-37** | 注册（**路径名按正典**） | `actor` = **仅卖方**（§4.7.2；真源 `listing-funds-service.ts:62`） | 非卖方 ⇒ `403 AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED` |
| **A11** | （附注）`POST /api/admin/commission_policy` | §1.8 附注；`src/commission.ts:240`（`insertCommissionPolicy`） | 注册 | §7-16 读取侧纪律（计费只读 `commission_policy`） | `effective_from` **严格递增**；`400 FEE_RATE_OUT_OF_RANGE` / `POLICY_SHAPE_INVALID` 族 |

> **★ v0.9 追加注（本栏状态）**：**A1–A11 已由批 4a 全部注册（注册点 53 → 65）⇒ 本栏关闭**；逐条注册行号见下表追加块；**残余项**（差集复算 / 划条留痕）**属 §9.E（E8）**；**注册面关闭 ≠ 批 4 完成**（B/C/D/E 栏仍在）。
> **A 栏通配判据（不得跳条）**：**注册时不得只挑其中几条**（§5.4 逐字）；**每注册一条必须从 §1.8 划掉**并在 §8 变更记录留痕（§7-26 建议③）；**§7-25 的 `create_key` 口径必须先行定案**（§5.4）；**差集收口** = Zang 批末（§1.8 追加块第 3 行）。

**★★ §9.A v0.9 追加表（本栏收口 · **不插入上表 · 只追加 · A1–A11 原文一字未动**）**：

| # | 项目（路径） | 状态（**v0.9**） | 注册行号（**本册现取**） | 真源锚点 |
|--:|---|---|---|---|
| **A1** | `POST /api/job` | **已关闭**（批 4a） | `src/index.ts:1289` | 4a 报告 §4；QA-B4 §4（`200` + `job_escrow ×2`） |
| **A2** | `POST /api/job/:jobId/apply` | **已关闭**（批 4a） | `:1305` | 4a 报告 §4；QA-B4 §4 |
| **A3** | `POST /api/job/:jobId/accept` | **已关闭**（**★ F-1 关闭**） | `:1327` | 4a 报告 §3/§4；QA-B4 §2.3（全链走通） |
| **A4** | `POST /api/job/:jobId/submit` | **已关闭**（别名面；**键集逐键一致 = 9 键**） | `:1352` | 4a 报告 §3（`A4_keySet_parity`）；§8.11.2-41 |
| **A5** | `POST /api/job/:jobId/review` | **已关闭**（**键集 = `jobEventView` 15 键**） | `:1380` | 4a 报告 §3/§7 事项 1；**§2 追加块 / §7-42** |
| **A6** | `POST /api/job/:jobId/cancel` | **已关闭**（权限 = `requireAdmin(review_tasks)`） | `:1404` | 4a 报告 §2；**§1.11 Q8** |
| **A7** | `POST /api/listing` | **已关闭**（批 4a） | `:1422` | 4a 报告 §4；QA-B4 §4 |
| **A8** | `POST\|PATCH /api/listing/:listingId` | **已关闭（2 注册点）** | `:1448` / `:1475` | 4a 报告 §4/§3（`delisted` 终态 `409`） |
| **A9** | `POST /api/listing/:listingId/buy` | **已关闭**（伪造入参被忽略） | `:1499` | 4a 报告 §3/§4（`purchase ×1` + `sale ×1`） |
| **A10** | `POST /api/listing-orders/:orderId/refund` | **已关闭**（路径正典；`actor` = 仅卖方） | `:1520` | 4a 报告 §4；QA-B4 §2.2（`purchase_refund ×2`） |
| **A11** | `POST /api/admin/commission_policy` | **已关闭**（权限 = `manage_settings`） | `:1540` | 4a 报告 §2/§4；QA-B4 §4（含 `effective_from` 严格递增核对） |

- **差集复算（写死 · §9.E-E8 收口）**：**全量服务层导出 − 已注册 − §1.8 已登记 = ∅** —— 本片后**注册面**成立（**未认领 0 条**）；**§1.8 表体已按 §1.8 v0.9 追加块就地划条**（11 行格内改「已注册（批 4a）+ 行号」）。
- **本栏不得读成「批 4 全清」**：**§9.B（前端同步，含 `S9` 的键集冻结回归）/ §9.C（行为回归）/ §9.D（DL68 加固）/ §9.E（收口）** 均**仍开**。

### 9.B 前端同步面 —— §2.4 `S1`–`S10` + `S-b3e-1/2/3`

| # | 项目 | 真源锚点 | 行动 | 前置依赖 | 验收判据 |
|--:|---|---|---|---|---|
| **B1** | `ops:` 强校验的 **4 个写口补幂等键**（`S1`） | §2.4 S1；`admin/SystemSettings.jsx:84-88`、`PermissionsManagement.jsx:89-98`/`:132-135`、`UsersManagement.jsx:103-107` | 四写口补 `body.create_key`/`idempotency_key`/`Idempotency-Key`（**`ops:` 前缀**） | `DL36` 落为**请求侧强校验**（§7-14） | 四写口**不带键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（现测；带键 ⇒ `200`） |
| **B2** | `R107` 的 **401/403 形状**（`S2`） | §2.4 S2；`frontend/src/auth.js:105` | 改读 `payload.error.message`（现读 `payload?.message \|\| payload?.error` ⇒ **文案退化成 `[object Object]`**） | 无 | 401/403 文案**不再出现 `[object Object]`** |
| **B3** | **四语 locale**（`S3`） | §2.4 S3；`frontend/src/locales/{zh,en,hk,vn}.json` | 各加 **2 键**：`auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`（**现 0 命中，实测**） | 无 | 四文件各 2 键、键名逐字一致 |
| **B4** | `DELETE /api/order` 入参**改 query**（`S4`） | §2.4 S4；`ShardPage.jsx:328-329`；§7-5 | 全撤调用改**入参走 query**（后端**不再读 body**） | 后端已落地（`0016` 面） | 全撤 `200` + `hold_release ×2`（T17 用 query 通路已成功） |
| **B5** | `410` 面的 **UI 分支下线（只读化）**（`S5`） | §2.4 S5；`RewardPage.jsx:196,217`；`admin/TasksManagement.jsx:130,140,177`；`admin/RewardsManagement.jsx:154,164,201`；`admin/SystemSettings.jsx:123` | 删写按钮 / 分支（**页面只读化、不整页删**） | 无 | 13 面**前端零调用**（`grep` 现取） |
| **B6** | 单测断言同步（`S6`） | §2.4 S6；`frontend/src/test/unit/auth.test.js:75` | 随 `/api/auth/register` 的 `410` 形状/路径删除同步改断言 | 与 `A 栏` 的路径删除同批 | 单测**全绿**（不改 ⇒ 必红） |
| **B7** | **键集冻结**（`S7`） | §2.4 S7；§2 母约束 F1 | 批 4 期间**不得依赖任何新增响应键** | 无 | 23 文件 × 键集对拍（唯一允许的新增 = 顶层 `idempotent_replay`） |
| **B8** | `/api/user` **新形状迁移**（`S8`） | §2.4 S8；`auth.js:142`、`Header.jsx:71`；§7-2（`DL24` 履约时点 = 批 4） | 切 `/api/user/points`（集合形状）时同步两处消费点 | §5.4 第 3 阶段（规范读口已上线） | 两处消费点键集与新端点一致 |
| **B9** | **「前端是否依赖旧 `400`」回归核**（`S9`） | §2.4 S9；§7-27；`DashboardPage.jsx:223-236` | **全量核**前端是否断言旧 `400 Invalid jID` / admin-queue 文案 | 无 | **23 文件 + 单测全量扫** ⇒ 无依赖（现测部分 = 无分支、`jID` 来自数字 `application_id`、撤除的 bespoke `400` 前端不可达；**残留 = `NOT_MEASURED`**） |
| **B10** | 2a 写口补 `create_key`（**条件触发**）（`S10`） | §2.4 S10；`ActiveTaskModal.jsx:50-58`（body 仅 `{info_input}`）；真源 `src/job-service.ts:133` | **仅当**前端需要「同实体重复提交且内容已变」⇒ **必须先传 `create_key`**（`cli:`） | **§7-25 口径**（Zang §5.86 裁定① = 选项 B，**现状不改**） | 条件未触发 ⇒ 现行为 = 设计内幂等（`200 idempotent_replay:true`） |
| **B11** | `S-b3e-1`：`POST /api/order` 的 `create_key` **必填** | §2.4 待补项；**`docs/audit/p4-b3e-market-funds.md:31`,`:64`**；调用点 `frontend/src/pages/ShardPage.jsx:176` | 前端**补 `create_key`**（同 `S1`/`S10` 族） | 无 | **实测现状 = 旧前端形状（无键）⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`（T04）**；补键后 ⇒ `200` + `hold ×2`（T12） |
| **B12** | `S-b3e-2`：`DELETE /api/order` 的 **body 式全撤** | **`p4-b3e-market-funds.md:31`**；§2.4 S4 | 与 `B4` 同一件事（**两个锚点**）：改 query 通路 | 后端已不读 body | T17（query 通路）**已成功** ⇒ 前端照改 |
| **B13** | `S-b3e-3`：`POST /api/order` **成功面键集已变** | **`p4-b3e-market-funds.md:31`,`:159`** | 登记 + 核前端消费点（旧 = `MarketOrderRecord` 12 键族；新 = 该片 view 键集） | 无 | 前端**仅 toast、无键依赖** ⇒ 风险低但**必须登记**（**判据 = 逐键对拍**，不得以「风险低」结案） |
| **B14** | **两条新 `401` 文案的四语覆盖**（**v1.1 新增**） | **§3.6**（新硬规则）；真源 = `backend-ts/src/auth.ts:223`（`Invalid wallet signature`）/ `:227`（`Signature does not match the claimed address`）；依据 = **Zang §5.106**；`docs/audit/p5-sig-verify.md §6` | 在 `frontend/src/locales/{zh,en,hk,vn}.json` 各加 **2 键**（键名逐字一致；文案 = 两串的**本语种**提示，**不得**直接把英文串当四语） | 无 | 四文件各 2 键、键名逐字一致；**现测 = 两串在 `frontend/src` 全文 0 命中**（**本册现取**）⇒ **不得以「英文文案已可用」结案**；**HTTP 展示面 = `NOT_MEASURED`**（§8.13.2-56）；登记行 = **§7-48** |

### 9.C 行为回归面（两条既有路径行为 delta 的**回归核**）

| # | 项目 | 真源锚点 | 行动 | 前置依赖 | 验收判据 |
|--:|---|---|---|---|---|
| **C1** | **非数字 `:jID`：`400` → `404`** 的回归核 | §3.1 `:454`（**已落地（批 3b）**）；`p4-b3c-job-funds.md §2.3 Δ1`；**Zang §5.85 裁定②**；§2.4 S9 / §7-27 | 前端**不得**依赖旧 `400 Invalid jID` | 无 | 非数字 `:jID` ⇒ **`404 LEDGER_REF_NOT_FOUND` + `details.reason=jID_not_found`**（`R107`）；**前端 23 文件全量扫无该断言** |
| **C2** | **撤除 bespoke `400`**（admin 提交不进面板队列）的回归核 | §1.9 K2 注；**Zang §5.85 裁定②**；§7-27 | 同上 | 无 | 该 `400` **前端不可达**（读口结构性排除 + §3.3-8）⇒ 无回归面；**仍须全量扫凭证**（不得只凭推断） |
| **C3** | **§5.4 的批 4 三件事**（前端迁移验收 / 13 面删除 / 新路径注册 + 测试断言同步） | §5.4 第 3 阶段 | 逐项执行 | 前端迁移**先于**路径删除 | 上线日 = **§7-1 口径**（批 4 前端迁移验收通过之日） |

### 9.D 加固面

| # | 项目 | 真源锚点 | 行动 | 前置依赖 | 验收判据（**必带判负**） |
|--:|---|---|---|---|---|
| **D1** | **DL68 残余：对手方选择在锁外 ⇒ 「撮合决策新鲜度」** | **§7-38**；**Zang §5.89 B①**；`docs/audit/p4-b3e-market-funds.md:96` + **`:147`（§7 待裁 1 方案 B）**；`src/database.ts:1809-1813`（锁与事件同语句） | 把「**锁 → 选择 → 写**」放进 `src/db.ts` 的**交互式事务**（R55/R56 已存在；代价 = 多一次事务往返 + 选择 SQL 上移 `database.ts`） | 无（P5/批 4） | **判负（必带）**：① 并发同币对两笔 Taker ⇒ **恰 1 成功**（现测 `successes = 1`，另一笔 `404 no_matchable_counterparty`）；② **`amount_filled ≤ amount`、无超额成交**（现测 `oversell=false`）；③ **同币对同键阻塞仍成立**（现测 +961ms）；④ **加固后不得回退**「锁与事件同语句」（`database.ts:1809-1813`） |

### 9.E 收口面（无调用方的旧路径 / 注释 / 兜底形状 / 日期）

| # | 项目 | 真源锚点 | 行动 | 前置依赖 | 验收判据 |
|--:|---|---|---|---|---|
| **E1** | **旧直写函数收口**：`placeOrder` / `cancelOrder` / `cancelAllOrders` | `src/database.ts:3268`（`placeOrder`）/`:3360`（`cancelOrder`）/`:3422`（`cancelAllOrders`，`:3428` 内部互调）；**本册现取** = `grep -rn … backend-ts/src/*.ts` **命中 4 行、全在 `database.ts`** | **删除或封死**（无调用方 ⇒ 与「资金唯一写路径 = `*_post_event`」纪律冲突的**遗留直写**） | 无 | **顶层 `src/*.ts` 调用点 = 0**；**本册现取递归读数** = 除 `database.ts` 的 4 行外，仅 `frontend/src/pages/ShardPage.jsx:312`/`:395` 命中（**同名局部箭头函数**，非 `DatabaseService` 方法）⇒ **外部调用方 = 0**；**残留 `NOT_MEASURED`** = `backend-ts/__tests__` 与仓库其余路径未扫 ⇒ 收口前**必须**复扫（§8.10.2-39） |
| **E2** | 同族旧路径收口：`markTaskProgressChecked` / `rejectPendingTaskProgress` | §1.8 并案登记（`:319`）；`src/database.ts:1249` / `:2029` | 收口（**现无调用方**；`index.ts` 命中 **0**） | 无 | 同上（递归复扫 = 0） |
| **E3** | **13 个 `410` 面删除 + `sunset` 值面** | §5.1 / §1.4 F5；**§5.5（本单新增）**；§7-35 | 前端迁移验收后**删路径**（走 §1.3 404 兜底）；`sunset` 值面按 §5.5 三形态 | **前端迁移先完成**（§5.4-1/3） | 13 面 `details.sunset` **非空 + 不含「未决」字样** + 形态 ∈ {(i),(ii),(iii)}；**具体日期 = 待 Kevin** |
| **E4** | **404 兜底形状对齐 `R107`** | §7-21；§1.3；`p4-b2b-listing-write.md §3.1:120-121`（现测 = **裸 `Not found`**） | 兜底体改 `{error:{code,message,i18n_key,details}}` | 无 | 未注册路径 ⇒ `R107` 形状 + `code=LEDGER_REF_NOT_FOUND`（**不得**回 HTML / 裸文本） |
| **E5** | `/api/auth/register` 的 `410` **形状对齐 `R107`** | §7-20（**`NOT_MEASURED`**）；§5.1 注册残件行 | 形状对齐（**批 2 三片均未触及**） | 无 | 响应体 = `R107` 形状（现测 = 固定 `410` 但形状未对齐） |
| **E6** | `/api/auth/login` **拆掉转发** | §5.1 登录别名行；§4.1 #10「删除 `login`，只留 `verify`」 | 拆转发（现 = 内部 `req.url` 改写，**隐藏双路径**） | 无 | 前端**零消费**（现测 `auth/login` **0 命中**）⇒ 可直接 410/删除 |
| **E7** | `job-funds-service.ts:18-19` **注释更正**（自述「无任何金额入参」与代码不符） | **§4.8.3 更正登记**；**Zang §5.90 裁定②**；QA `§4.2` | 注释改为「金额 = 出资人自定的**业务约定额**（同 M1 限价单条款）」 | 无 | 注释与实际 payload（含 `reward`）一致；**本单未改**（归实现方） |
| **E8** | §1.8 **划条 + 留痕 + 复算** | §1.8 追加块（三方分工）；**Zang §5.86 裁定②** | 每注册一条**划掉** + §8 变更记录留痕；Jing **每次刷新真扫描** | A 栏每条 | 差集 = **全量服务层导出 − 已注册 − §1.8 已登记 = ∅**（**非空 ⇒ 不得结批**） |
| **E9** | **A1 入参不完整分支的形状对齐 `R107`**（**v1.0 新增 · v1.1 锚点就地刷新**） | **§4.10**（**v1.1 现取**：`src/index.ts:1206-1208` 走 `sendError(res, 400, '参数不完整')` ⇒ **非 `R107` 形状**；**★ 旧读数 `:1200-1202`（v1.0 时点）留痕不删**）；§3.3-1；§7-45 / §7 补注 ⑱ | 改为 `R107` 统一错误体（`{error:{code,message,i18n_key,details}}`；`code` 取既有入参码 + **项目级 `reason`**，见 §3.5） | 无 | 该分支响应体 = `R107` 形状（**现测 = 文本 `参数不完整`，非 R107**；**行号判据取 v1.1 现取**）；**该分支是否可被前端触发 = `NOT_MEASURED`**（§8.12.2 / §8.13.2-58） |
| **E10** | **`claim` 面的同族残项**（`POST /api/task-progress/claim/:jID` 的 `getUserAsset ∥ upsertAsset` 回退 + 首领取 `upsertAsset(rewardPoints)`；**B5-2**）（**v1.1 新增**） | **§3.7**（同族口径）；**本册现取** = 路由 `src/index.ts:641`、两处调用 `:665` / `:676`；真源 = `docs/audit/p5-fix-login.md §4` 表 #2/#3（`database.ts:889` 定义、`:895 UPDATE asset`、`:910 INSERT INTO asset`）；依据 = **Zang §5.105 + §5.99④**；§7-47 | **默认口径 = 退役**：该端点转 **`410` + `sunset`**（`sunset` 值面按 §5.5 三形态），前端**停止调用**并在原入口显「已下线」；**Kevin 一句话可改** ⇒ 若改「保留」则按 **§3.7 同族收口**（`getUserAsset ∥ emptyAsset`，**不得**写 `asset` 表） | **前端先停调用**（`frontend/src/components/ClaimRewardModal.jsx:49` / `frontend/src/pages/RewardPage.jsx:152`，§4.11.1 既有读数） | **默认口径判据** = 该端点 `410` + `frontend/src` 零调用（`grep` 现取）+ `sunset` 非空且不含「未决」字样；**改口径判据** = 无 `cid=1` `account` 行 ⇒ `200` + `points=0`、`42P01` 归零、零写库。**两向均不得回写 `asset` 表**；**本单未跑该端点** ⇒ HTTP 面 = `NOT_MEASURED`（§8.13.2-59） |

---

## §10 多语言用户内容（UGC）翻译线（**v1.2 新增 · v1.3 就地订正 + 追加 §10.10–§10.15** · 依据 = P6-TR 已落地事实 + 派单 JING-TR）

> **本节性质**：把**已落地**的「多语言用户内容翻译线」（P6-TR-0 / TR-1a / TR-1b / TR-1c-A + TR-FIX）写成**契约**。**本节断言逐条带代码落点（行号 = 本册 `grep -n` / `sed -n` 现取）**；本册**只写规格、零代码改动、零库连接**（§8.14.1）。
> **口径**：本线**不碰账本** ⇒ **`Δledger_entry` 恒 `0`**（§10.8）。**本节不新增错误码 / 不新增 `kind` / 不改 §1–§9 既有条文**（**只追加**）。

### 10.1 载荷契约（**读侧 · 跨片交接面**）

**规则（写死）**：内容面 API 载荷中，用户内容对象的 **`*_en` / `*_hk` / `*_vn` 三键恒有值** ——
① 该字段该语言有 `status='ready'` 译文 ⇒ 用**译文**；② 否则 ⇒ **回落源文（中文 `zh`）**；③ **永不空串**（唯一例外 = 源文本身为空 ⇒ 回落空串）。
④ 并新增 **`i18n_status: "ready" | "partial" | "pending"`**；**字段缺省 ⇒ 前端不显示「翻译中」小标**。

- **真源（**造键点位于 mapper 层**）** = `backend-ts/src/database.ts`：`I18N_SPECS`（可译字段规格，`job` / `listing` 两族，`:746`）、**`applyI18n()`（造键点：写 `*_<lang>` + 回退源文 + 定 `i18n_status`，`:762`；恒有值赋值句 `record[\`${spec.out}_${lang}\`] = text || source;` `:784`）**、`loadI18nIndex()`（批量读 `status='ready'` 且 `text IS NOT NULL` 的行建索引，`:798`，SQL `:803-810`）。
- **`i18n_status` 定义**（`:737-739` 注释逐字）：`'ready'` = 该对象**所有可译字段** × en/vn/hk **全部**有 ready 译文；`'pending'` = **一个都没有**；否则 `'partial'`；**字段缺省 ⇒ 前端不显示小标**（`job` / `listing` 记录**恒带**此键）。**★ v1.3 追加口径（分母定义）**：**源文本为空 / 空白的字段（该语言格）不得计入 `total`**；**全部可译字段源皆空 ⇒ 取真空态 `ready`**（**键仍恒带**）⇒ 见 **§10.15**。
- **本册现取的键位**：`BrandRecord.i18n_status`（`:301`）/ 另一内容记录 `i18n_status`（`:337`）；`listing` 记录 `name_*`/`description_*`（`:572` 注释）；`job` 记录 `title_*`/`note_*`（`:607` 注释）。**语言后缀仅 `en`/`hk`/`vn`；`zh` 是源语言，永不入表**（`:740-741`）。
- **读失败 / 读不到 ⇒ 全部回落源文**（`loadI18nIndex` `try/catch` + `warn`，`:816-820`），**绝不让内容面 500**。
- **★ 旧行为（空串）= 缺陷，且**已被本线消除****：改动前 `*_en`/`*_hk`/`*_vn` **列在库与迁移面均不存在**（P6-TR-0 勘误逐字：**API 载荷出现三语键 ≠ 库有列**；真库 `trilingual_cols: []`，`job` / `listing` 的内容列就是**单语** `title` / `description`）⇒ 前端按 `name_<lang>` 取值**必然拿到空串**（内容面「切语言即空白」）。**其根因 = 缺口在 mapper 层**（无造键点）；**本线在 mapper 层新增「恒有值」造键点把空串缺陷消除**（`database.ts:762` `applyI18n`）。

### 10.2 内容面（可译字段 + 非内容面 + 两条编辑态口径）

- **内容对象与字段**：`job(title, description)`（API 出键 = `title_*` / `note_*`，`description` 列 → field 候选 `note`/`description`）、`listing(title, description)`（API 出键 = `name_*` / `description_*`，`title` 列 → field 候选 `name`/`title`）、`users.bio`、`currency.name`（`database.ts:746-756` `I18N_SPECS`；`users` / `currency` 由各自读点接，见 `docs/audit/p6-tr1b-mapper-and-backfill.md`）。
- **`market_order` / `market_trade` 无用户文本**（**逐键取证**）：两表**非「用户录入的自然语言内容」** —— 挂单 / 成交 = 币对、金额、`uid`、状态机（`backend-ts/migrations/0016_market.sql:112,159` 表用途与注释；`docs/audit/p6-i18n-content-triage.md`）⇒ **不入翻译线**（本册沿该件的 `NOT_MEASURED` 边界，见 §8.14.3-68）。
- **发布表单不本地化（输入即原文）**：招工 / 商品的**发布输入框**不做本地化 —— 用户提交的是**原文**；翻译只作用于**展示载荷**（`*_<lang>` 是**读侧派生键**，**不写回业务表**）。
- **★ `bio` 编辑态持原文（防译文写回）**：`frontend/src/pages/ProfilePage.jsx:47` 口径逐字 —— `bio` / `tempBio` **一律持原文**（种子 = `user.bio`），**只有展示**走 `pickLocalized(user,'bio',lang)`；否则 `updateMyProfile({bio: tempBio})` 会把**译文当原文写回**。

### 10.3 两张新表（迁移 `0021` · **已 apply**）

**真源** = `backend-ts/migrations/0021_content_translation.sql`（**164 行** · 两个表 + 索引 · **零触发器**）。

| 表 | 列（顺序） | PK / 约束 | 要点 |
|---|---|---|---|
| **`public.content_translation`**（表 1，`:71`） | `entity_type, entity_id, field, lang, text, status, attempts, last_error, updated_at` | **PK = `(entity_type, entity_id, field, lang)`**（`:83-84`）**= 幂等键**；`content_translation_status_enum`：`status IN ('pending','ready','failed','deferred')`（`:87-88`）；`content_translation_lang_enum`：`lang IN ('en','vn','hk')`（`:91-92`）；`attempts >= 0`（`:95-96`）；**★ 结构级兜底 `content_translation_ready_has_text`：`status <> 'ready' OR ("text" IS NOT NULL AND btrim("text") <> '')`（`:101-102`）** | `entity_type` / `field` **故意不加 CHECK**（将来新增内容类型免 ALTER，`:110` 注释）；`status='failed'|'deferred'` 时 `text` 为 NULL（失败留空，`:113-114`）；写入者 = 翻译服务层（`:105-107`） |
| **`public.translation_cache`**（表 2，`:122`） | `src_hash, src_lang, tgt_lang, text_out, engine, created_at` | **PK = `(src_hash, src_lang, tgt_lang)`**（`:131-132`）；`translation_cache_text_out_nonempty`（`:135`） | **命中即不付费**（写前按源文本 `sha256` × `tgt_lang` 查，命中直接用 ⇒ 不再调用引擎）；**不自动过期**（无 TTL）；`engine` = `deepseek` \| `opencc` \| `stub` |

- **幂等 / 可重入**：全部 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`（`0021:65`）。
- **零触发器**：`0021` **不建任何触发器** ⇒ `p3x` 重建脚本的 `triggers.non_internal = 43` 期望值**不变**（`docs/audit/p6-tr1a-translate-service.md` §2.4；本册未连库，见 §8.14.2-61）。
- **数据面同步**：本两张表**同批写入 `docs/data-layer.spec.md` v0.8 §19**（追加式加注，见 §8.14.1b）。

### 10.4 引擎口径

- **en / vn = DeepSeek**（OpenAI 兼容 `POST {base}/chat/completions`；`DEEPSEEK_BASE_URL` 默认 `https://api.deepseek.com`、`DEEPSEEK_MODEL` 默认 `deepseek-flash`，`translate-service.ts:22-23`）。**★ `response_format={"type":"json_object"}` ⇒ 提示词必须自带 JSON 要求**（该参数落点 `:472`；它只保证「输出是 JSON」、**不保证结构**，故结构校验见下）。
- **hk = OpenCC 确定性简繁转换**（`opencc-js`；`toTraditional()`；缓存行 `engine='opencc'`，`:243-244` / `:680-692`）—— **不付费、不走 LLM**。语言集：走 LLM 的目标 = `TRANSLATE_TARGETS = ['en','vn']`（`:218`）；全部目标 = `TARGET_LANGS = ['en','vn','hk']`（`:220`）。
- **`stub` 只能显式启用**（`TRANSLATE_ENGINE=stub`，`:291-293`）—— 它是**测试替身**（输出 `[en] ` + 原文、**刻意跳过三重校验**，`:279`）。**★ v1.3：stub 写库已改为「结构性拒绝」（缺省不放行）** ⇒ 见 **§10.12**。
- **★ 未显式启用且缺 `DEEPSEEK_API_KEY` ⇒ 一律不翻译**（`:294-307` `fallbackReason = 'NO_API_KEY: …'`）：该批标 `pending` + `reason='NO_API_KEY'`（`pending` 不烧 attempts）、**不写译文（`text` 保持 NULL）· 不写缓存**（`:588-589`）—— **因为 stub 的假译文一旦写进 `translation_cache` 会按内容长期命中、污染真库**（一次污染长期生效）。**★ v1.3 复核 = 不漂移**（真源 + 实证见 **§10.14① / §10.12**）。
  ▸ **口径留痕**：P6-TR-1a 曾写「缺 key ⇒ 自动回落 `engine='stub'`」（`p6-tr1a-translate-service.md:136`）—— **该写法已被 TR-FIX / TR-1c-A 反转、作废**（现口径 = **缺 key 一律不翻**）。
- **三重校验**（任一不过 ⇒ `failed`、不落库；`:14-18`）：① **JSON 结构**（可解析 + 顶层键集 == 输入字段集 + 每值非空）；② **长度比 ∈ 按目标语言分表的界**（**★ v1.3 就地订正**：`en`/`vn` `[0.3, 6.0]`、`hk` `[0.5, 2.5]`，`LENGTH_RATIO_BOUNDS :220-224` ⇒ 见 **§10.10**；**旧写法留痕 = 原记 `[0.3, 3.0]` / `LENGTH_RATIO_MIN/MAX = 0.3/3.0` / `:208-209`（v1.2 时点，已作废）**）；③ **字符集特征**（vn 必须含越南语拉丁扩展字符；en 非 ASCII 占比 > `0.3` 判负，`EN_NON_ASCII_MAX = 0.3`，`:211`）。**★ 豁免**（`:366-374`）：**源无 CJK** 或 **单字源** ⇒ 豁免 ③。`stub` **跳过**三重校验（测试替身）。

### 10.5 写入形态（B1：**前台 pending + 后台 `waitUntil`**）

**规则（写死）**：**前台只登记 `pending` 行**（`text=NULL`）——**批量 1 次 DB 往返**、`INSERT … ON CONFLICT (entity_type, entity_id, field, lang) DO UPDATE`（`translate-service.ts:758`）；**后台**（`waitUntil` / fire-and-forget）调 `translateFields` 补齐（`index.ts:61-62`）。**本条覆盖 5 条写路径（6 个登记点）**：

| # | 写路径（路由） | 路由行 | 前台登记点 |
|--:|---|---|---|
| ① | `POST /api/user/profile` | `src/index.ts:520` | `enqueueTranslation({user, bio, reset:true})` `:536` |
| ② | `POST /api/currency` | `:1339` | `enqueueTranslation({currency, name, reset:true})` `:1356` |
| ③ | `POST /api/job` | `:1425` | `enqueueTranslation({job, fields})` `:1443` |
| ④ | `POST /api/listing`（**create**） | `:1571` | `enqueueListingTranslation(result.view)` `:1588` |
| ⑤ | `POST /api/listing/:listingId`（**edit**） | `:1598` | `enqueueListingTranslation(result.view, true)`（**reset**）`:1617` |
| ⑥ | `PATCH /api/listing/:listingId`（**status**） | `:1626` | `enqueueListingTranslation(result.view)`（**不 reset**）`:1641` |

- **helper**：`enqueueTranslation()`（`index.ts:65`）/ `enqueueListingTranslation()`（`:84`）—— **两步各自 `try/catch`、同步绝不抛**（`:61` 注释逐字）。
- **硬规则 ①：HTTP 响应不得因翻译变慢**。**实测**（`docs/audit/p6-tr1c-a-waituntil.md §3.2`，**引擎挂起 15s** vs `REQUEST_TIMEOUT_MS=15000`）：`POST /api/listing` **`200 @ 1995ms`**、`POST /api/user/profile` **`200 @ 1287ms`** ⇒ **写响应未被翻译拖慢**；`stub` 对照 = `1969ms` / `1276ms`（差异在 DB 往返、**非翻译**）。
- **硬规则 ②：任何翻译失败不得影响写响应的状态码 / 语义**（`index.ts:61` 注释逐字；`enqueueTranslation` 双 `try/catch` 兜底）。

### 10.6 失败与成本策略

- **绝不阻塞提交**：失败留空 + `status` 标记 + **后台重试**（`p6-tr1a-translate-service.md` §表 3）。
- **`pending` / `deferred` 不烧 `attempts`**；仅真失败烧。重试闸 = `attempts < MAX_ATTEMPTS`，**`MAX_ATTEMPTS = 5`**（`translate-service.ts:213`；`listPending(limit, MAX_ATTEMPTS)` `:1003`）。
- **日限额 / 超长 ⇒ 整批 `deferred`**（**不烧 attempts**）：超单条字符 ⇒ `ITEM_TOO_LONG`（`:600-606`）；触日条数上限 ⇒ `DAILY_CAP_REACHED`（`:609-616`）。
- **限额（环境变量可覆盖）**：单条字符上限 `TRANSLATE_MAX_CHARS_PER_ITEM`（默认 **2000**）、日条数上限 `TRANSLATE_DAILY_ITEM_CAP`（默认 **500**）（`:298-299`）；**日用量派生**自 `content_translation` 当日行数，**不新建计数表**（`:140` / `:610`）。
- 请求超时 = `REQUEST_TIMEOUT_MS = 15000`（`:215`）；`429` 与 `5xx` 按**可重试**处理（`:541`）。

### 10.7 端点与运维

- **`POST /api/translate/backfill`**（注册点 = `src/index.ts:1730`，位于 404 catch-all 之前；**★ v1.3 就地订正行号**，**旧读数 `:1722`（v1.2 时点）留痕**；**`mode` 三态、缺省 = `scan_translate`** ⇒ §10.11）：
  - **鉴权**：`Authorization: Bearer <CRON_SECRET>` **或** `x-cron-secret: <CRON_SECRET>`（**二者取一**，`:1729-1731`）。
  - **★ 未配 `CRON_SECRET` ⇒ `503` fail-loud，绝不默认放行**（`:1723-1726`；安全红线）；凭证错 / 缺 ⇒ `401`。
  - **`limit`**：默认 **100** / 上限 **100**（`src/index.ts:1747`；**★ v1.3 就地订正**，**旧写法留痕 = 默认 20 / `:1735`（v1.2 时点）**；**真正的成本闸 = `TRANSLATE_DAILY_ITEM_CAP=500`**）⇒ 见 **§10.11**。
  - **回执（机读）**：`{ok, processed, ready, failed, skipped, deferred, reason}`（+ `scanned, retried, engine`，`:1740-1750`）；**★ v1.3 新增键** = `mode / scan_scanned / scan_registered / scan_existing / scan_by_entity`（`src/index.ts:1762-1767`）⇒ 见 **§10.11**。
- **`vercel.json` cron**（`:34-37`）：`{"path":"/api/translate/backfill","schedule":"0 18 * * *"}` ⇒ **UTC 18:00 = 北京 02:00 = DeepSeek 低峰**（省钱）。**配额登记**：Vercel **Hobby 套餐** cron 仅支持「每日 1 次」（需更密如 `0 */6 * * *` 须 **Pro**）（`docs/audit/p6-tr1b-mapper-and-backfill.md §4`）。
- **注册点**：`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` **现取 = 67**；本线 +1（`/api/translate/backfill`）。**v1.1 曾记 65**（§1.12）⇒ **派单口径 66 → 67**、**本册只证 67**（§8.14.2-65）。

### 10.8 与账本无关（不变量）

- 翻译属**内容更新**，与资金无关 ⇒ **`Δledger_entry` 恒 `0`**；**迁移（`0021`）与写回（mapper / 服务层）均不碰账本**。
- **实测**（`docs/audit/p6-tr1c-a-waituntil.md §5` / `p6-tr1b-mapper-and-backfill.md §5`）：`ledger_entry` **`267 → 267`**、`Σ(balance, cid=1)` **不变**。

### 10.9 报告与产物（**只读引用**）

| 单号 | 报告（`docs/audit/`） | 本册取其 |
|---|---|---|
| **P6-TR-0** | `p6-i18n-content-triage.md` | 内容面取证、`trilingual_cols: []`、`market_*` 非内容面 |
| **P6-TR-1a** | `p6-tr1a-translate-service.md` | 服务层 + 迁移 `0021`（未 apply 时点）、引擎口径、三重校验、零触发器 |
| **P6-TR-1b** | `p6-tr1b-mapper-and-backfill.md` | mapper 读侧回落 + `i18n_status`、`backfill` 端点、`vercel.json` cron |
| **P6-TR-1c-A** | `p6-tr1c-a-waituntil.md` | B1 写入形态、挂起/非阻塞实测（`1995ms`/`1287ms`）、`Δledger_entry = 0` |
| **P6-TR-FIX** | `p6-trfix.md` | **引擎回落反转**（`stub` 仅显式、缺 key 不写脏数据 / 缓存） |
| **P6-TR-2** | `p6-tr2-frontend-i18n-wiring.md` | 前端四语接线 + 「翻译中」小标（`i18n_status` 消费面；`123 passed`） |
| **P6-VERCEL-SHAPE** | `p6-vercel-shape.md` | `vercel.json` 形状与 cron 配额登记 |
| **P6-TR-1c-B** | `p6-tr1c-b-real-engine.md` | 存量登记 `mode` 三态 + **幂等实证**（候选 276；`0 → 276 → 276`）、两闸缺陷登记（DEF-01 / DEF-02）、真引擎 e2e（533 tokens） |
| **P6-TR-1c-FIX** | `p6-tr1c-fix.md` | 假译文 / 假缓存清洗（14 + 14）、**stub 写库守卫**、DEF-01 / DEF-02 修复（阈值表 `en/vn [0.3,6.0]` / `hk [0.5,2.5]`）、**`limit` 默认 20 ⇒ 100**、真引擎读数（`327 / 581` tokens） |

---

## §10.x v1.3 追加节（**本节只追加；§10.1–§10.9 表体与正文除上列 3 处就地订正外一字未动**）

### 10.10 DEF-02 · 长度比阈值表（**按目标语言分表** · v1.3 就地订正原「`[0.3, 3.0]`」一元口径）

**规则（写死）**：长度比闸**按目标语言**取界；**分母 = 源文本码点数**（`Array.from(src).length`，`translate-service.ts:421-423`）；越界 ⇒ `reason='LENGTH_RATIO'`（**判负、不落 `ready`**，`:425-430`）。

| 目标 | 下界 | 上界 | 语义（真源 = `translate-service.ts:216-219` 注释逐字） |
|---|---:|---:|---|
| `en` | **0.3** | **6.0** | zh→拉丁短文本自然比**实测 3.7–5.2** ⇒ 旧上限 3.0 **系统性误杀**合法英译 |
| `vn` | **0.3** | **6.0** | 越南语同口径（含变音符号，字符数天然偏长） |
| `hk` | **0.5** | **2.5** | **繁体 = 同文转换**（OpenCC，**1:1 级**，实测比 ≈1.05）⇒ **反而收紧**（防「转繁顺带改写」） |

- **真源（本册现取）**：`LENGTH_RATIO_BOUNDS`（`backend-ts/src/translate-service.ts:220-224`；`en :221` / `vn :222` / `hk :223`）；消费点 `validateValue`（`:416-434`；`bounds` 取 `:424`）。
- **旧导出名保留**：`LENGTH_RATIO_MIN = LENGTH_RATIO_BOUNDS.en.min`（`:226`）/ `LENGTH_RATIO_MAX = LENGTH_RATIO_BOUNDS.en.max`（`:227`）⇒ **= en 口径**（兼容既有引用，**不是**独立阈值）。
- **★ 旧口径（v1.2 §10.4 ②）作废**：原写「长度比 ∈ `[0.3, 3.0]`（`LENGTH_RATIO_MIN/MAX = 0.3/3.0`，`:208-209`）」⇒ 本版**就地订正**、旧写法在 §10.4 与本节**双处留痕**。
- **为什么必须改（缺陷证据）**：zh→en/vn **短文本**实测比 **3.7–5.2**（`docs/audit/p6-tr1c-b-real-engine.md §5 · DEF-TR1C-B-02` 读数：`vn_title 3.933`、probe `4.133 / 4.200 / 4.667`、desc en `4.600`）⇒ 旧上限 3.0 下 **`vn` 行永远无法 `ready`**（「存量登记 + 回填」跑完仍大量 `failed`、`i18n_status` 长期停 `partial`）；修复与最终阈值表见 `docs/audit/p6-tr1c-fix.md §4`。
- **闸未失效（判负仍在）**：离线断言 `Q7 / Q9`（中文 2 字源 + `'x'.repeat(40)` ⇒ 比 **20×**）**必须判负**（`p6-tr1c-fix.md §4`）。

### 10.11 `POST /api/translate/backfill` 三 mode + `limit` 默认 100 + 存量扫描

**规则（写死）**：`mode` **三态**，**缺省 = `scan_translate`**：

| `mode` | 行为 | 付费 |
|---|---|---|
| **`scan_translate`（缺省）** | **先扫存量补 `pending` 行，再翻译** ⇒ **cron 自愈** | 翻译面付费（`hk` 走 OpenCC ⇒ 0） |
| `scan` | **只扫存量登记**（零翻译、零 API 调用） | **零付费** |
| `translate` | 只翻译（**旧行为**，不扫） | 翻译面付费 |

- **入参兼容**：`scan=1` 显式请求 ⇒ 与 `mode=translate` 合并为 `scan_translate`；非法 `mode` ⇒ 回落缺省（`src/index.ts:1749-1755`；`wantScan :1754` / `wantTranslate :1755`）。
- **`limit`：默认 100 / 上限 100**（`src/index.ts:1747`：`Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, Math.floor(parsedLimit)) : 100`）。**★ 旧口径（v1.2 §10.7）作废**：原「默认 **20** / 上限 100（`:1735`）」—— 默认值由 **P6-TR-1c-FIX-FIN** 改为 **100**（`p6-tr1c-fix.md §9.1`；**上限 `Math.min(100, …)` 逐字未动**）。**真正的成本闸 = `TRANSLATE_DAILY_ITEM_CAP=500`**（每日条目上限），非单次 `limit`。
- **回执（机读 · 旧键逐字保留 + 新增扫描面）**（`src/index.ts:1760-1778`）：**旧键** = `ok / processed / ready / failed / skipped / deferred / reason / scanned / retried / engine`（`:1761,1769-1777`）；**新增** = `mode`（`:1762`）、`scan_scanned`（`:1764`）、`scan_registered`（`:1765`）、`scan_existing`（`:1766`）、`scan_by_entity`（`:1767`）；未扫 ⇒ `scan_* = null`；`mode=scan` ⇒ `processed=0`、`engine=null`（三态可区分）。
- **存量扫描 = 真库推导（非硬编码）**：白名单 `TRANSLATABLE_SPECS`（`translate-service.ts:1134-1139`：`job(title,description)` / `listing(title,description)` / `users(bio)` / `currency(name)`）+ **单语句** `INSERT … SELECT … ON CONFLICT (entity_type,entity_id,field,lang) DO NOTHING RETURNING 1`（`buildScanInsertSql` `:1149-1173`；**语句内无 DELETE/UPDATE**，`:1147`）；生产实现 `createDbContentScanner()`（`:1192`）；入口 `scanRegisterPending()`（`:1219-1222`，`scanner` **端口可注入**）。
- **幂等实证（真库 + 真 HTTP）**：候选 **276** 条 `(entity,field,lang)`（**job 99 / listing 117 / user 21 / currency 39**）⇒ 首轮 `scanned=276 / registered=276 / existing=0`、**二轮 `registered=0 / existing=276`、行数不增、零 API 付费**（`0 → 276 → 276`）（`docs/audit/p6-tr1c-b-real-engine.md §1.3`）。
- **鉴权口径不变**：`Bearer` **或** `x-cron-secret`（二者取一）；**未配 `CRON_SECRET` ⇒ `503` fail-loud**（`src/index.ts:1731-1740`）。

### 10.12 ★★ stub 写库守卫（**结构性拒绝** · v1.3 新增 · 本节重点）

**规则（写死）**：`stub` 引擎**默认拒绝写库** —— **仅 `TRANSLATE_ALLOW_STUB_WRITES=1`**（或 `opts.allowStubWrites === true`）**显式放行**；未放行时：

- `store = null` ⇒ **不读缓存、不写 `pending` 行、不落译文、不写 `translation_cache`**（只在**内存**返回 `texts` / `statuses`）；
- 输出机读标记：**`store_write_blocked = true`** + **`store_block_reason = 'STUB_WRITE_BLOCKED'`**。

**真源（本册现取）**：`REASON.STUB_WRITE_BLOCKED`（`translate-service.ts:89`）；`stubWritesAllowed()`（`:342-344`，**仅 `=== '1'` ⇒ true；未设 / `'0'` ⇒ false**，注释 `:339-341`）；出参字段（`:191-195`）；**守卫落点**（`:602-614`：`store = null` `:611` / `store_write_blocked = true` `:612` / `store_block_reason` `:613`）；`opts.allowStubWrites`（`:177-178`）。**离线断言** = `p4z-tr1a-01-offline-tests.ts` 的 `stub-guard` 组（默认路径 `store.rows.size === 0 && store.cache.size === 0`，`p6-tr1c-fix.md §2`）。

**为什么必须写成「真会中断」而不是「事后告警」（根因教训 · 写死理由）**（`docs/audit/p6-tr1c-fix.md §2`）：

1. 上一轮 TR-1c 的端到端测试**用 stub 跑通**并写入真表 ⇒ 库面出现 `^\[(en|vn)\] ` **假译文**，**且被 `i18n_status` 计入 `ready`**、前端**当译文渲染**；
2. 假译文**同时污染 `translation_cache`**（缓存命中即跳过付费调用）⇒ **一次污染长期生效**；
3. 若守卫只「打日志 / 告警」，测试脚本照样写库 ⇒ **污染可再现**，等于没修 ⇒ **必须在唯一的写库落点上直接短路**；
4. 开关**默认关（fail-closed）**：默认值即安全值 ⇒ 线上 / 离线路径都不会意外开启；造假测试必须**显式**声明意图。

⇒ **本条立法目的 = 把「测试用假翻译不得进真库」从「调用方纪律」升级为「结构性拒绝」**。

**清洗实证（已执行 · 读数）**（`p6-tr1c-fix.md §1`）：`content_translation` **270 → 270 行**（**不删行**：命中 stub 模式 **14 → 0**、`status='ready'` **39 → 25**、`pending` **231 → 245**）；`translation_cache` **39 → 25 行**（`engine='stub'` **14 → 0**；`engine='opencc'` 14 与 `engine='deepseek'` 11 **不在清洗范围**）。**口径**：`content_translation` 的主键即幂等键 ⇒ 复位不删行（删行会让「待译」变「未登记」）；假缓存**必须删**（留着 = 永久固化假译文）。

### 10.13 DEF-01 · 校验字段集口径（**部分缓存命中不得误判 `KEY_SET_MISMATCH`**）

**规则（写死）**：`translateFields` 调引擎后，必须以**本次请求的完整字段集**（`subset`）调 `validateFieldSet`（`:710`），**再只取该语言需要的字段**合流（`:707-717`）—— **不得**用「只带该语言单字段」的子集去校验。

- **真源（本册现取）**：`validateFieldSet(subset, t, raw)`（`backend-ts/src/translate-service.ts:710`；定义 `:437`）；合流循环 `:707-719`；注释逐字 `:704-706`。
- **缺陷（旧实现 · 作废）**：原按「只带该语言单字段」调 `validateFieldSet` ⇒ 引擎按提示词返回**全部请求字段**、校验却只认单字段子集 ⇒ **部分缓存命中**（重试 / 部分成功后的自然态）时**误判 `KEY_SET_MISMATCH`**、**误杀 `description.en`**（`docs/audit/p6-tr1c-b-real-engine.md §5 · DEF-TR1C-B-01`：`targetSubset = { f : misses[f].includes(t) }`，该件旧行号 `:657-663`）。
- **修法（已验收）**：判定「这一批译文整体是否合规」用**全字段集**；**写库只落单语言字段**（`p6-tr1c-fix.md §3`）。

### 10.14 缺 key 口径（**复核不漂移**）+ 模型 id 实证 + 真引擎实测读数

**① 缺 key 口径 = 与 §10.4 一致（本版复核，不漂移）**：非显式 stub 且无 `DEEPSEEK_API_KEY` ⇒ **一律不翻译** —— 该批标 `status='pending'` + `reason='NO_API_KEY'`（`pending` **不烧 `attempts`**）、**不写译文（`text` 保持 NULL）· 不写缓存**。
真源（本册现取）：`getTranslateConfig` 派生 `fallback_reason`（`translate-service.ts:319-326`；注释逐字 `:319-321`）；`translateFields` **闸 ⓪**（`:634-644`：`markAll('pending', REASON.NO_API_KEY)` `:642` / `return` `:643`；注释 `:634-637`）。**「缺 key ⇒ 自动回落 `engine='stub'`」仍属作废**（§10.4 口径留痕不删）。

**② 模型 id 实证（v1.2 的「存疑」由此收口）**：代码默认 = **`deepseek-flash`**（`DEFAULT_MODEL`，`translate-service.ts:239`）；该 id **已由真引擎调用实证可用**（`docs/audit/p6-tr1c-fix.md §5.2`：`engine=deepseek` / `model=deepseek-flash` / `api_key_present=true`（**只判存在、不打印值**）/ `llm_calls=1`）。第三方站写的 **`deepseek-v4-flash` 不存在**（本册现取 `grep`：`backend-ts/src` + `backend-ts/scripts` 命中 **2 处**、`docs/route-layer.spec.md` 命中 **1 处** —— **全部为注释 / 自曝文本，无任何代码把它当默认值或可用模型**；`translate-service.ts:238` 注释逐字已标「存疑」）⇒ **§8.14.3-67 的状态由「存疑」更新为「已实证」（非删除、留痕）**。

**③ 真引擎实测读数（可引用 · 定向真译 · **CJK 源 listing**）**（`p6-tr1c-fix.md §5.2`）：

| 项 | 读数 |
|---|---|
| engine / model | `deepseek` / `deepseek-flash` |
| `title` en | `Seafood Gift Box Test C: Shrimp and Crab Duo` |
| `title` vn | `Hộp quà hải sản thử nghiệm C: Combo tôm và cua` |
| `title` hk | `海鮮禮盒測試丙：蝦蟹雙拼`（OpenCC 确定性繁体，**0 付费**） |
| tokens（**单次调用**） | **prompt 327 / completion 581**（`elapsed_ms=14588`；`llm_calls=1`） |
| 断言 | `vn_title_status_ready` / `en_majority_non_cjk` / `vn_has_diacritics` / `hk_is_traditional` / `hk_no_latin_only` / `no_stub_prefix` **全 true**；`stub_rows_in_listing_ct = 0` |
| 端点内 tokens（路径 A） | **`NOT_MEASURED`**（调用发生在服务进程内、客户端不可观测）—— **非 0、非空**（§8.15.2-67） |

**④ 清洗后读回面**：`GET /api/task/all` 的 **`^\[(en|vn)\] ` 前缀命中 = 0**（两次取样均 0）；`i18n_status` 分布随真译推进（`{ready:3,partial:5,pending:12}` ⇒ `{ready:3,partial:7,pending:10}`）（`p6-tr1c-fix.md §5.3`；**分布 / 行数均为时点值** —— 取样期存在外部真译进程，`p6-tr1c-fix.md §9.4`）。

### 10.15 `i18n_status` 的**分母定义**（**Zang 追加口径** · v1.3 新增 · 优先级高）

**规则（写死）**：

- **① 空源格不进分母**：`i18n_status` 的 `total` **只计「源文本非空非空白」的字段格** —— **源文本为空 / 空白的字段（该语言格）不得计入 `total`**（**该格本来就无内容可翻**）。
- **② 全空源对象 ⇒ 取真空态 `ready`**：某对象的**全部可译字段源都为空** ⇒ **`i18n_status = 'ready'`**（vacuous ready）。
  ▸ **★ 二选一的另一选项（「不输出 `i18n_status` 键」）未采纳**，理由 = **§10.1 已写死「`job` / `listing` 记录**恒带**此键」** ⇒ 取 `ready` **不破例**，且**前端同样不显示「翻译中」小标**（前端只在 `partial` / `pending` 挂标）。**两选项的行为差 = 键在 / 键缺**，故必须择一并写明。
- **③ 与 §10.1 的关系（不冲突）**：§10.1 管「载荷三语键**恒有值** + 回落源文 + `i18n_status` **键恒在**」；**本节补齐「分母怎么算 / 全空源怎么办」**（§10.1 原**未定义**）。

**为何（写死理由）**：**空源字段无内容可翻**；把空源格计入分母 ⇒ 该对象**永远凑不满 ready 格** ⇒ 被**永久判 `partial`** ⇒ **「翻译中」小标永挂** —— 这是**永不消失的假信号**（用户看到「翻译中」，实际**无任何内容待译**）。

**依据（★ Zang 追加口径 · 实测读数由本册转引）**：`content_translation` 字段覆盖 = `job` title **60** / description **39** 行、`listing` title **66** / description **51** 行 ⇒ 有 **7 个招工**与 **5 个商品**的**描述为空**；而 mapper 的 `I18N_SPECS` 对 `job` **固定出 `title` + `note` 两字段 × 3 语言 = 6 格** ⇒ **空源字段仍进分母** ⇒ 对象被**永久判 `partial`**；**Zang 实测生产分布 = `{ready: 41, partial: 14, pending: 1}`**。

- **修法（已在并行派单 · **本册只写口径、零代码改动**）**：`applyI18n` **剔除空源格**（不入 `total`）；**`total === 0` ⇒ 按本节 ② 取 `ready`**（派单原文「或置 `ready`」= 本节选定项；「不输出该键」**未采纳**，见 ②）。
- **口径消费面锚点（**转引 §10.1 · v1.2 时点读数；本册未复读、零代码读取**）**：`applyI18n()` 造键点 = `backend-ts/src/database.ts:762`（恒有值赋值 `:784`）；`i18n_status` 定义注释 `:737-739`；`loadI18nIndex()` `:798`（SQL `:803-810`）。
- **回归判据（给实现方 / 质检）**：**空源字段不再进分母**（对象不再因空描述被判 `partial`）；**全空源对象** ⇒ 该键 = `ready`（**键仍在**）；**无空源对象的行为逐字不变**。

---

## §11 批 6 已落地事实（**v1.4 新增 · 本节只追加 · 依据 = Zang §5.137–§5.151 + 批 6 审计件**）

> **本节纪律**：只登记**已上线**的裁定与实测；**§1–§10 既有条文一字未动**（**非追加改动 = 0 处**；本单唯一新增 = 顶部 v1.4 状态块 + 本节 + §8.16）。**行号为「本册现取」或「转引」，逐条标注**（分界见 §8.16.3-82）；凡转引一律给审计件锚点，**不把转引写成「本册实测」**。

### 11.1 权限面：迁移 `0022` + `isAdminAddress` **单一真源**收敛（★ 顺序依赖）

- 迁移 `backend-ts/migrations/0022_admin_permission_seed.sql`（**177 行** · **纯 DML、幂等** · **已 apply** ⇒ `/health` `schema_version` 报 **`0022`**）—— 种下：`admin_permission` **11** / `admin_role` **1**（`super_admin`）/ `admin_role_permission` **11** / `admin_user_role` **1**（绑定**原第三真源地址持有人** uid `970213`；`0022` §④ 按 `lower(u.evm)=<原 DEFAULT_ADMIN_ADDRESS>` **库内匹配**而非硬编码 uid）。**apply-time 自检**（`DO $$`）：键集多 / 少任一 ⇒ `RAISE` ⇒ **整迁移回滚、不写版本行**。
- **权限键三真源逐键相等**（机器判据 `all_three_equal=true`；转引 `docs/audit/p6-b6-perm-seed.md` §5-④）：后端常量 `ALL_ADMIN_PERMISSIONS`（`backend-ts/src/database.ts:11-23`，11 键） ↔ 前端兜底数组（`frontend/src/admin-utils.js:40-52`，11 键） ↔ `0022` §①（11 键）。**消费点** = `database.ts:646`（`normalizePermissionGroup`）/ `:3718`（`buildAdminAccess`：`is_admin=true` ⇒ 全量 11 键）。
- **★ `isAdminAddress` 第三真源已删除、收敛为单一真源**：单一真源 = **`users.is_admin` OR ∃ `admin_user_role` 行**；`src/auth.ts` 删 `DEFAULT_ADMIN_ADDRESS` / `ADMIN_EVM_ADDRESSES`（原 `:35-44`）与 `isAdminAddress()`（原 `:136-139`）；`src/database.ts:2588`（`resolveAdminAccess`，去形参 ⇒ `const bypass = user.is_admin;`）与 `:3709/3716`（`buildAdminAccess`，`const isAdmin = user.is_admin;`）去分支；`src/index.ts:13` 去 import、`:238` 改调用。**行为变更（有意、非回归）**：env `ADMIN_EVM_ADDRESSES` 运维旁路**移除** ⇒ 新增管理员**只能**走 `users.is_admin` 或 `admin_user_role`（`DL72` 单一真源）。
- **★★ 顺序依赖（不得颠倒，否则当场锁死运营管理员）**：**必须先 apply `0022`、后部署收敛代码**。反证（转引 `p6-b6-perm-seed.md` §4）：原地址持有人 uid `970213`（`is_admin=false`）在**收敛已部署、种子未 apply** 时 = **`403 NOT_ADMIN`**（实测 `200→403`）；种子 apply 后经 `admin_user_role → super_admin` 恢复 `can_access_admin=true`。**已遵守**：DB 先 apply（`APPLY_EXIT=0`、`applied_at 2026-10-02T00:41:05Z`、checksum `069a0090…`、`admin_user_role` 绑 uid `970213`），收敛代码随后随批上线。

### 11.2 审计留痕与日累计闸：迁移 `0023`

- 迁移 `backend-ts/migrations/0023_admin_points_audit_daily_cap.sql`（**391 行** · **已 apply** ⇒ `/health` `schema_version` 报 **`0023`**）交付三件：① 表 `public.admin_ops_audit_log`（**15 列**；PK×1 / FK×3 / CHECK×4 / **UNIQUE×1** / 索引×4；`0023:82-99`）；② **append-only 触发器** `trg_admin_ops_audit_log_append_only`（`BEFORE UPDATE OR DELETE` 无条件 RAISE，手法同 `0017` 的 `currency_status_log_append_only`；`0023:114/:125`）；③ **DB 编排函数** `public.admin_points_adjust_post_event(jsonb)`（`0023:157`；**唯一资金写路径**）。
- **★ 函数定序（同一函数同一语句 ⇒ 天然原子）**：`pg_advisory_xact_lock(hashtextextended('admin_points_adjust:'||actor,0))`（**首句即取锁** ⇒ 同操作人两笔**跨会话串行**，实测阻塞 `2148ms` 后 `55P03`）→ **目标存在性闸** → **日累计闸** → `ledger_post_event` → **INSERT 审计行** → 回执。**资金分录与审计行同语句 ⇒ 同生同灭**（原子性反证：预塞同键审计行 ⇒ `23505` ⇒ `ledger 2→2` 一并回滚；转引 `p6-b6-audit-and-cap.md` §4）。
- **★★ 阈值 `1,000,000 / 日`，标 `TODO: Kevin 定值`**：函数体 `v_daily_cap CONSTANT bigint := 1000000`（`0023:161-162`，常量旁 `-- TODO: Kevin 定值`）。**按「操作人 + 自然日（UTC）」**；阈值为**服务端常量、客户端永不参与**。同额 TS 常量 `ADMIN_POINTS_ADJUST_MAX_PER_DAY = 1000000`（`src/index.ts:1299`，本册现取，带 `// TODO: Kevin 定值`）**仅供 `details.max` 兜底回填、不参与判定**（判定真值在 DB 函数内）。
- **★★ 日累计只计 `result='applied'`**（防「反复发超限请求把当日额度刷爆」）：求和判据逐字 `AND a.result = 'applied'`（`0023` 求和块，闸条件 `IF v_used + abs(v_amount) > v_daily_cap`）。**量化实测**（转引 `p6-b6-audit-and-cap.md` §7.2-E6）：改后口径（只计 `applied`）= **`800000` 恒定**；改前口径（含拒绝行**全部**行）= **`3200000` > cap `1000000`** ⇒ 6 笔被拒即把当日额度刷爆、管理员当天再也调不出分。
- **★★ 被拒必须留痕且资金零残留**：拒绝分支写审计行 `result='rejected_daily_cap'`（`0023:215-228`；`balance_before/balance_after/txid` 皆 NULL、`memo='OVER_MAX_DAILY_AMOUNT'`），**与「零资金分录」一起提交**；**「零残留」= 资金零残留（不得有 ledger 分录），不是「不得有表行」**（Zang §5.145 裁定①，纠正 AC 措辞）。**★ 函数不得 `RAISE`**（`0023:153` 注释；静态判据 `has_raise = -1`）—— `RAISE` 会把同函数内**已写的**审计行一并回滚 ⇒ 改**返回拒绝回执** `{ok:false, reason:'OVER_MAX_DAILY_AMOUNT', …}`，**路由层据此回 `400` + 既有码 `LD016`（`LEDGER_AMOUNT_INVALID`）+ 机读 reason `OVER_MAX_DAILY_AMOUNT`**（与 `OVER_MAX_SINGLE_AMOUNT` 同族；**零新造码 / 零新造 reason**）。`op` 在闸**前**派生（`>0⇒mint` / `<0⇒burn`，防拒绝行撞 `CHECK (op IN ('mint','burn'))`）。
- **★★ 唯一约束 `UNIQUE(idempotency_key, result)`**（`0023:99`；旧写法 `UNIQUE (idempotency_key)` 作废并留痕于 `:91-98`）—— **幂等键不得被「拒绝」消费**（Zang §5.146 裁定四）：① 同键被拒两次 ⇒ `(key,'rejected_daily_cap')` 冲突 ⇒ `DO NOTHING`（**拒绝行不放大**）；② 同键**先拒后成** ⇒ `result` 不同 ⇒ **允许成功**（既有拒绝行保留）；③ 同键成功两次 ⇒ 冲突 ⇒ **拦住**（真幂等保护不弱化）。**三向逐条实测**（转引 `p6-b6-audit-and-cap.md` §8.2）+ **二次自证**（改回旧写法 ⇒ 第②向必败 `23505` ⇒ 整条语句回滚 ⇒ 改动确实承重，§8.3）。
- **live 线上实证 11/11**（转引 `docs/audit/p6-b6-audit-live.md` §1–§7，真 HTTP `:5788`）：成功路径 ⇒ **200** + 资金分录 txid **277** 与审计行 `log_id 5` / `txid 277` **逐字相同 ⇒ 两表行级同源**（「钱动了但没痕迹」不可能）；幂等重投 ⇒ **200 + `idempotent_replay:true`** + 两表 delta **0** + txid 首投 / 重投逐字相同；单次上限回归 ⇒ **400 + `LD016` + `reason=OVER_MAX_SINGLE_AMOUNT`** 零残留；非 admin ⇒ **403** / 无 token ⇒ **401**，两表 delta **0**；资金净位移 **0**（`Σ(account.balance, cid=1) 1989693 → 1989693`）。**★ 声明（逐字）：真库 live 未触发日累计拒绝**（触发需真造百万点 ⇒ 污染真账本，红线②）；拒绝面替代取证 = **事务内**合成额度占用 → 调函数 → 回执 `{ok:false, reason:'OVER_MAX_DAILY_AMOUNT', daily_used:1000004}` + 留痕行 `result='rejected_daily_cap'` + 资金 delta **0** → **ROLLBACK 后零残留**。

### 11.3 错误语义：D1'（无 SQLSTATE ⇒ 503）+ 全量收口

- **★★ 无 SQLSTATE（`code == null`）的驱动 / 传输错 ⇒ `503 LEDGER_TX_TIMEOUT` + `reason='driver_connection_error'`**（**复用既有 503 通路与既有 reason、零新码**）。判据 = **无码**（`code` 为 `null` / `undefined` / `''`）**且**（`message` 命中驱动 / 传输形态 **或** `cause` / `sourceError` / `error` 链内命中 `ECONNREFUSED` / `ECONNRESET` / `ENOTFOUND` / `ETIMEDOUT` / `EHOSTUNREACH` / `ENETUNREACH` / `EPIPE` / `EAI_AGAIN`）。真源（本册现取）= `backend-ts/src/ledger-errors.ts`：`isNullCodeDriverTransportError` 定义 **`:487`**、在 `classifyNonPgError`（**`:500`**）**末尾** **`:514`** 加一行；`TRANSIENT_NON_PG_REASONS`（**`:519`**）含 `driver_connection_error` ⇒ 走既有 `LEDGER_TX_TIMEOUT`(LD025) / `503`。**顺序保证 400 分支不变**（带 `code` 的错误在 `:446` 被挡回老路径，本条**只在无码时生效**）；**判负铁律**：裸 `TypeError('bug')` / `Error('boom')` 等**无传输信号**者**仍 500**（`unclassified_non_pg_error`，DL126 不被静默降级）。驱动侧现取实证：`node_modules/@neondatabase/serverless/index.js:1544` 非 400 时**不搬 `code`**（`code` 恒 `null`）。
- **★ 401 只用于凭据面、且必须在触碰数据库之前**：`/api/auth/verify`（`src/index.ts:401-451`）拆两段 —— ① 凭据面（格式 / HMAC / nonce 过期 / EIP-191 恢复不符）⇒ **唯一一处 `sendError(res, 401, …)` 位于 `src/index.ts:419`（本册现取），在 DB 调用之前**（纯计算、零 IO）；② 落库面（`findOrCreateUserByEvm` / `getUserAsset`）⇒ 走既有分类器 ⇒ **503 + R107 形状**（原始信息只进服务端日志）。`/api/auth/login`（`:452-455`）经同一 handler 同口径。**负向臂实测**（转引 `p6-d1prime-errclass.md` §3.3）：真签名 + 库不可达 ⇒ **修前 `401` → 修后 `503`**（`a3_401_violation=false`）。
- **★ 26 个 IO 出口统一走分类器**（转引 `docs/audit/p6-d1prime-sweep.md` §1.1/§2）：`src/index.ts` 内**「碰库（IO）却硬编码 `sendError(res, 500, …)`」的 22 处** ⇒ 改走**既有** helper `sendInfraMapped`（`src/index.ts:1498`，本册现取；`normalizeLedgerError(unwrapInfraCause(e))` ⇒ `res.status(normalized.httpStatus)`）—— 逐处行号（**修后**）：`:480/494/523/545/560/588/606/649/665/681/702/746/830/933/951/974/1031/1165/1181/1196/1212`（+ `:1873` `translate.backfill`）。**参数校验类 400 / 真凭据 401 / 健康 503 / 兜底 404 / `CRON_SECRET` 闸**一律**保留**（转引同件 §1.4）。
- **★ 2 处 `database.ts` 裸 catch「假成功」改 `throw`**（同族、**比 500 更糟**）：`getUserAsset`（原 `:969-972` ⇒ `return null`）/ `getAllUsers`（原 `:875-877` ⇒ `return []`）⇒ 改 `throw`（保留 `console.error` 供 R108 诊断面）。**实测**（转引 `p6-d1prime-sweep.md` §1.2/§3.1）：库不可达时 `GET /api/user/asset/1` **修前 `200` + 余额 0（用户会以为钱没了）→ 修后 `503`**；`GET /api/task/all` / `GET /api/home` **`500 → 503`**。
- **★ 保留 500 的 2 面（判定正确、未改）**：`GET /api/shard`、`GET /api/shard/transfer` —— handler 内**常量空态、零 IO** ⇒ catch 只可能见代码缺陷，500 正确。（**诚实更正入册**：实测这两面在库不可达时返 **503**，但那是**前置 `requireActor` 的既有 infra 分流**所致，与未改的 catch 无关 —— 转引 `p6-d1prime-sweep.md` §3.2「预判不是实测」。）
- **负向臂逐面读数**（转引 `p6-d1prime-sweep.md` §3.1/§4）：`must503` **26/26**、`must401` **5/5**、`must410` **1/1**（`claim` 仍 `410 LEDGER_REF_NOT_FOUND` / `reason=CLAIM_RETIRED`）、违约 **0**；`tsc` **0 行**、离线 **126/126**、分类器 **41/41**、注册点 **67**、账本 **271 / Σ 1989693** 零位移。
- **★ 新 reason `OVER_MAX_DAILY_AMOUNT`**（§11.2）**复用 `LD016`**（`LEDGER_AMOUNT_INVALID`）—— 符合「机读走项目级 `reason`、不新造错误码」纪律。

### 11.4 前端实现纪律（**新建一节 · 交实现方与质检共同遵守**）

> **依据** = `docs/audit/p6-fe-perf.md` §1–§15 + `docs/seafood.master-plan.md` §5.132 / §5.135 / §5.138–§5.142 / §5.151。**本节为规则**（不展开读数处一律指审计件）。

- **① 禁止重新引入 Tailwind 运行期 CDN**：现为**构建期 v4**（`@import "tailwindcss"` + `@theme`；`index.html` 中 `cdn.tailwindcss.com` = **0**）。**回归判据**：`index.html` 无 `script[src*=tailwind]`；CDN 拦截判负实验 `diff_elems = 0`（改后；改前生产站 `964/964`）。保留的 CDN 仅 **FontAwesome（cdnjs）** 与字体链（jsDelivr / Google Fonts），**属有意保留**。
- **② 兼容层手写工具类规则必须进 `@layer`**（`frontend/src/styles/tailwind-compat.css`）：**无层规则会压过 `@layer utilities`**（同特异性下无层 > 任何 `@layer`）⇒ 把 `.grid-cols-*` / `.md\:grid-cols-*` / `.lg\:grid-cols-3` / `.container` / `.py-*` / `.p-*` / `.pt-*` / `.shadow*` / `.border-yellow-200` / `.text-xs…4xl`（含 `.text-6xl`）/ `.space-x-*` / `.space-y-*` 兜底**整块搬入 `@layer components`**（`@layer base` 用于 v4 破坏性默认值回补，如 `border-color:#e5e7eb`）。**层序机器读数**：`@layer components` **先于** `@layer utilities`。**已知例外（不得分层）**：`.shadow-sm` **保持无层胜出**（复刻 v3 真值 `rgba(0,0,0,.05) 0 1px 2px 0`）。**为何**：旧 CDN 后注入的 `<style>` 长期**掩盖**了这些无层规则的胜出，构建期化后暴露 —— 见 §5.139–§5.141 记录的「网格列数 / `container` / 页高 / 边框默认色」3+ 类回退。
- **③ 运行期拼接的类名必须进 safelist**：`@source inline(...)`（`frontend/src/styles.css:32`）为**单一真源**；**清单与取数脚本现取** = `frontend/scripts/p4z-feperf-safelist.mjs`（`safelist_count=29`、`dynamic_count=24`、`dynamic_missing_from_safelist=[]`、`dynamic_missing_in_dist=[]`、`VERDICT=PASS`）。**承重证据**：`xl:grid-cols-4` 在 `src/**` 字面量 **0 次** 而产物 CSS **存在** ⇒ 只可能来自 safelist；运行时探针在 1280 视口下真生效。
- **④ 类名字面量在测试 / 探针里必须拼接书写**：Tailwind v4 自动内容探测**会扫 `src/**`（含 `src/test`）并注入产物** ⇒ 测试 / 探针里的判负 token 若写字面量会**自毁判负**（实测：写成字面量后产物各出现 1 次，改拼接后 = **0** ⇒ 判负与承重探针均必须拼接）。既有防护 = `src/styles.css:38-40` 的 `@source not "../scripts"/"../dist"/"../../docs"`。
- **⑤ 按钮口径**（Kevin §5.132 拍板「日档 A″ / 夜档 A′」）：命名 **`btna-*`（主）/ `btnalt-*`（次）**；**几何** = 圆角比 **`0.222`**（21.3px ÷ 96px）、水平内边距比 **`0.359`**（34.5px ÷ 96px；`JING-BTN-SRC-FIX` 最小二乘圆拟合复采）；**扁平化**（`box-shadow:none` / `background-image:none`，**同删三重渐变**）；`day≠night` **差异键 >90**（实测 **103 → 106**，档间差 3 键 = `btna-border` / `btnalt-bg` / `btnalt-fg`，**未删键凑数**）；**`.sf-btn` 家族已纳入**（现取 **9 JSX 文件 / 22 处**，基类改挂 `--sf-btna-*` + `--sf-st-*`，**基类体内 hex/rgba = 0**）；**切档 `rect` 逐值相等**（只变 `borderColor` / `bg` / `color`）。**两处「推断项」（参考图无、属推断）**：**日档 主按钮描边色 = 站点 ink `rgb(3,4,2)`**（= **推断**；整页亮黄底 ⇒ 无描边按钮形状会消失 ⇒ Kevin 已确认）、**夜档 次按钮底色 = 站点 token（深底）**（= **推断**）。**已知偏差（登记不改）**：`.sf-btn` 实高 **37.5px**（`min-height 34` 未绑定）⇒ 相对实高比例 `0.213/0.320` vs 真源 `0.222/0.359`，偏差 **≤1.5px**（视觉不可辨）。

### 11.5 本批入册的审计件与真源锚点（**只读引用**）

| 面 | 审计件（行数 = 本册 `wc -l` 现取） | 关键真源 |
|---|---|---|
| 权限种子 `0022` | `docs/audit/p6-b6-perm-seed.md`（**167 行**） | `migrations/0022_admin_permission_seed.sql`（**177 行**）|
| 审计 + 日累计 `0023` | `docs/audit/p6-b6-audit-and-cap.md`（**302 行**） | `migrations/0023_admin_points_audit_daily_cap.sql`（**391 行**）|
| 线上实证 | `docs/audit/p6-b6-audit-live.md`（**213 行**） | `:5788` 真 HTTP **11/11** |
| D1' 分类器 | `docs/audit/p6-d1prime-errclass.md`（**174 行**） | `src/ledger-errors.ts:487/500/514/519` |
| D1' 全量收口 | `docs/audit/p6-d1prime-sweep.md`（**205 行**） | `src/index.ts:1498`（`sendInfraMapped`）|
| 前端构建期化 | `docs/audit/p6-fe-perf.md`（**522 行**） | `frontend/src/styles.css:32/38-40` |

**★ 数据层同步**：本批 `0023` 涉**表 / 触发器 / 函数 / 约束** ⇒ 已同批在 **`docs/data-layer.spec.md` v0.9 §20**（`AN8`–`AN13`）**追加式登记**（本册不重复条文）；`0022` 为纯 DML ⇒ 同处 `AN12` 登记。

---

## §12 ★★ §7-32「管理员退款发起」· **可实现契约**（**v1.5 新增 · 本节只追加；§1–§11 既有一字未动**）

> **本节性质**：把 §7-32 从「已定（= 后续能力，不属本批）」**钉成可实现、可证伪的契约**。**本册只写契约、零代码、零迁移、零库写**（库面 = 只读，§12.0）；**实现归新批**（§12.10）。**依据** = 派单 JING-REFUND-ADMIN + `Zang §5.88 ②`（退款发起人立法意图）+ `Zang §5.145 ①`（「零残留」口径教训）+ `Zang §5.146 ④`（幂等键不被拒绝消费）。**待 Zang 终审 8 条 = Z1–Z8（§12.10）**；凡本册给出「倾向」处，**一律不构成裁定**（派单口径：不自行二选一）。

### 12.0 只读取证（**本册现取、非转引**；产物 = `.p6jing-artifacts/p6jing-00-probe.<run>.json`，run-tagged；探针 = `.p6jing-artifacts/p6jing-00-probe.cjs`，**只 SELECT / 只读目录，零 DDL / 零 DML / 零事务写**）

**A · 迁移 `0022` / `0023` 的 apply 真值（推翻「采信派单」的口径 —— 本册独立复核）**

| 读数 | 值（本册现取） |
|---|---|
| `public.schema_migration` 行（**降序前 2 行**） | `id=22, version='0023', name='0023_admin_points_audit_daily_cap.sql', checksum='fe7bb504fd91a6c611345f950e742dd708264f64fd76dc48acabdd8d2f68f467', applied_at='2026-10-02T01:58:54.688Z'` |
| 同上（次行） | `id=21, version='0022', name='0022_admin_permission_seed.sql', checksum='069a00905c2821b846f0efc24673abe7dfb89acd3e73e260e0108f0c0bd24112', applied_at='2026-10-02T00:41:05.838Z'` |
| 结论 | **两者均已 apply**（本册现取；与派单陈述一致，但**不构成对派单的采信**）。`0022` 的 checksum 与 v1.4 §11.1 转引的 `069a0090…` **逐字相同** ✓ |

**B · 权限面真值（`0022` apply 后）**

| 读数 | 值（本册现取） |
|---|---|
| `admin_permission` | **11 行**，键集逐键 = `dashboard_access / manage_permissions / manage_points / manage_rewards / manage_settings / manage_tasks / manage_users / publish_prizes / publish_tasks / read_users / review_tasks` |
| `admin_role` | **1 行** = `super_admin` |
| `admin_role_permission` | `super_admin` ⇒ **11** 行（全量） |
| `admin_user_role` | **1 行** = `uid 970213 / role_key super_admin`；同 `uid` 在 `public.users.is_admin` = **`false`** ⇒ **该账号完全依赖角色行获得 `can_access_admin`**（对 §12.1.1 的选键有决定性影响：**任何「无键」口径也不影响它**（`hasRequiredPermission(undefined) === true`），任何「命名键」口径也不影响它（`super_admin` 有 11 键）） |
| `public.users` | **37 行**；`is_admin = true` = **3** 行 |

**C · 审计面真值（`admin_ops_audit_log`；变体 A 的代价取证）**

| 面 | 读数（本册现取） |
|---|---|
| 列 | **15 列**：`log_id, actor_uid, action, target_uid, cid, op, amount, balance_before, balance_after, request_fingerprint, idempotency_key, result, txid, memo, time_created` |
| CHECK（**闭集 4 个**） | `action = 'points_adjust'` **（单值闭集）** / `op = ANY('mint','burn')` / `amount <> 0` / `result = ANY('applied','rejected_daily_cap')` |
| UNIQUE | `admin_ops_audit_log_idem_uniq UNIQUE (idempotency_key, result)`（**复合、非部分索引**） |
| FK | ×3（`actor_uid`→`users(uid)` / `target_uid`→`users(uid)` / `cid`→`currency(cid)`）；另 `target_uid` / `cid` / `actor_uid` / `amount` / `result` / `idempotency_key` / `request_fingerprint` 皆 **`NOT NULL`** |
| 索引 | **4**：`_pk` / `_idem_uniq` / `admin_ops_audit_log_actor_day_idx (actor_uid, time_created)` / `admin_ops_audit_log_target_idx (target_uid, time_created)` |
| 触发器 | **1**：`trg_admin_ops_audit_log_append_only`，`tgenabled='O'`，`BEFORE DELETE OR UPDATE`（append-only） |
| 行 | **4 行，全部 `result='applied'`**（**0 行拒绝** ⇒ 「拒绝留痕」分支在真库未触发，§8.17.2-87） |
| **★ 对变体 A 的决定性读数** | `0023:207-211` 的**日累计求和**逐字 = `WHERE a.actor_uid = v_actor AND a.result = 'applied' AND a.time_created >= v_day_start AND a.idempotency_key <> v_key` ⇒ **无 `action` 过滤** ⇒ **任何**落入本表的 `result='applied'` 行（含将来的退款行）都会被计入 A1 的 `1,000,000 点/日` 额度 |

**D · 编排函数与可退门面真值**

| 读数 | 值（本册现取） |
|---|---|
| `public.*_post_event` 全集 | **5 个**：`admin_points_adjust_post_event` / `job_post_event` / `ledger_post_event` / `listing_post_event` / `market_post_event` ⇒ **盘上无任何退款类编排函数**（`listing_refund_post_event` **不存在**） |
| `admin_points_adjust_post_event(jsonb)` | 在场（oid `246122`，`def_len=6058`）；**`position('RAISE' in def) = 0`** ⇒ 现取复核 = 与该迁移的自检断言一致（**拒绝分支不得 `RAISE`**） |
| `listing_post_event(jsonb)` | 在场（`def_len=16666`）；退款分支 = `0015:661-726` |
| `listing_order` | **5 行**：`created 1 / paid 1 / refunded 3`；**现成可退门面 = `order_id=3`**（`listing_id=13` / `seller_uid=7` / `buyer_uid=8` / `price=100` / `quantity=1` / `status='paid'` / `pay_txid` 非空 / `refund_txid` NULL） |
| `ledger_entry` | **271 行**；`purchase_refund = 6`（= 3 事件 × 2 腿）；事件根键 `biz:listing:refund:{2,6,7}` **各 2 行** |
| `account (cid=1)` | **18 行**；`Σbalance = 1,989,693`、`Σfrozen = 10,507` |
| 结构基线 | `public` 基表 **24**、非内部触发器 **44**（= v1.4 §11 转引的「23 / 43」**+1/+1**，即 `0023` 建表与 append-only 触发器 ⇒ **自洽**） |

### 12.1 ① actor 面定义（**写死**）

| 项 | 契约（写死） | 依据 |
|---|---|---|
| **合法发起人集合** | **卖方 ∪ 管理员**（本次新增的第三 actor 面 = 管理员） | 派单 + §7-32（「实现时的前置 = §6 权限单一真源 + 审计面」**均已落地**，§12.0-A/B） |
| **「管理员」的定义** | `can_access_admin = true`（§6.1 单一真源：`users.is_admin` OR ∃ `admin_user_role`）**且** 命中命名权限键 **`manage_points`**（§12.1.1） | §6.1 / §6.2（步 2 / 步 4）+ `src/index.ts:299-317` |
| **管理员兼买方** | **禁止** ⇒ `403 AUTH_FORBIDDEN` + `details.reason='ACTOR_NOT_ALLOWED'`（零资金动作） | **★ 立法意图 = Zang §5.88 ②**（「允许买方单方退款 = **对卖方的单向掠夺向量**」）—— 管理员若同时是该单买方，其发起的退款在**动机与效果上等同买方单方退款** ⇒ 必须落在同一禁令内 |
| **管理员兼卖方** | **允许**（与卖方面重合，无额外闸） | 卖方面本就合法（§4.7.2） |
| **管理员与订单无关（第三方）** | **允许**（本能力的**目的** = 平台治理：争议/误单的处置） | §7-32「管理员可发起」的登记语义 |
| **actor 的来源** | **只来自 token**（`actor.user.uID`，`src/index.ts:1860` 现取）；**客户端不得声明 actor**（无 `actor_uid`/`seller_uid`/`buyer_uid` 入参面可影响 actor） | §4.2 P4「必需字段只有 `order_id`」+ §4.8.1 规则 1/2 |
| **两 actor 面的差异** | **仅准入** —— **资金腿 / 幂等键 / 指纹 / 回执键集 / 状态回写 逐字相同**（§12.2 冻结） | 结构保证：**编排函数根本不接受 actor**（`listing_post_event` 的 payload 只有 `op`/`order_id`/`request_fingerprint`/`memo`，`listing-funds-service.ts:297-302` 现取） |
| **单点改造（实现批）** | `src/listing-funds-service.ts:62` 的 `REFUND_ACTOR_IS_SELLER_ONLY = true`（**本册现取未改**）⇒ 须改为**三分口径**常量（例：`REFUND_ACTOR_SCOPE = 'seller_or_admin'`）+ 闸判据（`:286-294`）改为「**actor = seller ∨ (can_access_admin ∧ `manage_points`) ∨ …（兼买方 ⇒ 拒）**」 | §4.7.2 落点 + §7-32 真源格（「只需改本函数判据一处」） |
| **★ 与现状的关系** | **本契约不是现状描述**：现批（`true`）继续生效，**管理员发起 = 仍 `403 ACTOR_NOT_ALLOWED`**；本契约是**将来时** | §7-32 + §12.10 |

#### 12.1.1 权限闸候选：11 键逐键（**现取调用面**）+ 「无键」口径 ⇒ 选**唯一**

现取方法：`grep -o "requireAdmin(req, res, '<key>')" backend-ts/src/index.ts | sort | uniq -c`（本册现取；`index.ts` = **1981 行**，**在途修改中** ⇒ 行号为现取时点，§8.17.3-89）。

| 键（`0022` 现取 11 键之内） | 中文名（`0022:50-61`） | 现取 `requireAdmin` 调用面 | 语义贴合度（本能力的语义 = **管理员改动用户余额 / 处置在途资金**） | 结论 |
|---|---|---:|---|---|
| **`manage_points`** | 积分管理 | **0 处**（**首次启用**） | **高** —— 本仓唯一「用户资产 / 额度治理」键；退款与 A1 后台调分同族（两者都直接改 `account.balance`） | **★ 选中（唯一）** |
| `manage_settings` | 系统设置 | 3 处（`:1055` / `:1072` / `:1876`——其中 `:1876` = A11 佣金政策，spec 未点名时取「同域兜底」先例） | 中 —— 兜底可用，但语义偏移（退款不是「设置」） | 备选（若 Zang 守 A11 兜底先例 ⇒ 改字，见 Z3/Z1） |
| `manage_users` | 用户管理 | 1 处（`:1181`） | 中低 —— 语义 = 用户资料/账号 CRUD，非资金 | 否 |
| `manage_permissions` | 权限管理 | 3 处（`:1110` / `:1129` / `:1159`） | 低 —— 治理权限本身，非资金 | 否 |
| `review_tasks` | 任务审核 | 5 处（`:1279` / `:1294` / `:1310` / `:1713` / `:1737`） | 低 —— 招工域审核，与商品资金无关 | 否 |
| `manage_tasks` / `publish_tasks` / `manage_rewards` / `publish_prizes` / `read_users` / `dashboard_access` | 任务管理 / 发布任务 / 奖励管理 / 发布奖品 / 用户查看 / 控制台访问 | **0 处（各）** | 低（其中 `read_users` 是只读语义 ⇒ **用它做资金闸 = 语义反向**） | 否 |
| **（无键）`requireAdmin(req, res)`** | —— | **3 处**（`:1247` / `:1263` / `:1402`——其中 `:1402` = **A1 后台调分**，本仓唯一的既有「管理员资金动作」先例） | —— | **不采纳**（现取 `src/index.ts:299-317`：`hasRequiredPermission(actor, undefined) === true` ⇒ 无键时 `requireAdmin` 的**实际闸 = `can_access_admin`**，即「凡能进后台者皆可动用户钱」⇒ 与 §4.8.4 ② 类「授权主体意图额必须**权限闸**」的精神不符） |

**结论（唯一）**：**权限闸 = `requireAdmin(req, res, 'manage_points')`**。
- **零新造键**（`0022` 已 apply 的 11 键之内）；**现取对库无影响**（`admin_role_permission` = 11 键全量 ⇒ uid `970213` 与任一 `is_admin=true` 账号**均放行**，§12.0-B）。
- **若 Zang 认为应改为新键** ⇒ **代价（不可在本批做）**：新键须 ① 新迁移（`admin_permission` + `admin_role_permission` 种子）② 后端真源 `backend-ts/src/database.ts:11-23` 的 `ALL_ADMIN_PERMISSIONS`（11 键）加键 ③ 前端兜底数组 `frontend/src/admin-utils.js:40-52`（11 键）加键 ④ `0022` 的 apply-time 自检断言（`<> 11 ⇒ RAISE`）**必须同批改**，否则**迁移自检必失败** ⇒ **三真源 + 迁移面 4 处** ⇒ 本批 **禁改 `migrations/**` 与代码** ⇒ **不可行**（登记 = §12.10 · Z1）。

**★★ §12.1.1 v1.6 就地加注（**Zang Z1 终审 · 本节正文与候选表一字未动**）**：

> **（v1.6：Zang Z1 终审——权限闸 = `manage_points`，**不变**）** 依据 = `manage_points` 系 `0022` **十一键之一**；**前后端真源已齐**：后端键表 `backend-ts/src/database.ts:19`（`ALL_ADMIN_PERMISSIONS` 11 键）/ `:3854`（首页分流 `manage_points ⇒ /dashboard/points`）、前端兜底键集 `frontend/src/admin-utils.js:48`、`frontend/src/components/layout/AdminLayout.jsx:80`（`requiredPermission: 'manage_points'`）、`App.jsx:242`（`path="points"` 路由权限 = `manage_points`）⇒ **零新造键**；**后端路由闸面首次启用**（该键在 `requireAdmin` 的调用面现取 = **0 处**，本节候选表同款）。
> **★ Z1 附加（本批不扩面）**：**不动 A1 既有的「无键 `requireAdmin`」面**（`src/index.ts:1402` 现取）；「**A1 无键面与新契约不一致**」⇒ **登记为下一轮 spec 收口项**（**§7-52**），**本批禁改码 / 禁改 `migrations/**` ⇒ 不扩面**。

### 12.2 ② 资金腿**不变项（冻结）**—— 实现方与质检方**共同**适用

> **冻结口径**：以下**逐字不变**（**含管理员发起面**）。任何一条被改 ⇒ **复核不通过**。真源 = `migrations/0015_listing.sql:661-726`（退款分支，**本册现取**）+ `src/listing-funds-service.ts:297-302`。

| # | 冻结项 | 冻结值 | 真源（现取） |
|--:|---|---|---|
| F1 | 分录 kind 与条数 | **`purchase_refund` ×2（恰好两条）** | `0015:718-724`；事后白名单核对 `0015:747-756`（`op='refund'` ⇒ 只允许 `purchase_refund`，否则 `LEDGER_ACCOUNT_GUARD_VIOLATION`） |
| F2 | 卖方腿 | `uid = listing_order.seller_uid`，`delta = −amount`，`frozen_delta = '0'`，`kind='purchase_refund'` | `0015:718-720` |
| F3 | 买方腿 | `uid = listing_order.buyer_uid`，`delta = +amount`，`frozen_delta = '0'`，`kind='purchase_refund'` | `0015:721-723` |
| F4 | 金额来源 | **服务端取数**：`amount = listing_order.price × listing_order.quantity`（DB 从订单行算）；**客户端传值一律丢弃** | `0015:711`；§4.8.2 **B 类**（「退款额」）逐字 |
| F5 | 对手方来源 | 卖方 = `listing_order.seller_uid`；买方 = `listing_order.buyer_uid`；`cid` = `listing_order.cid` —— **全部服务端取数** | `0015:718`/`:721`/`:707` |
| F6 | **不触发库存回滚** | **`listing.stock` 不变**（§7-7 裁定不变）；`0015:775-781` 的退款分支**只** `UPDATE public.listing_order`（`status='refunded'` / `refund_txid` / `ledger_event_keys`），**不 UPDATE `public.listing`** | `0015:775-781`；`src/listing-funds-service.ts:55`（`REFUND_ROLLS_BACK_STOCK = false`，现取） |
| F7 | 幂等键（事件根键） | **`biz:listing:refund:<order_id>`**（DB 派生）；**前端/客户端不得自造键** | `0015:667`；§4.5 硬规则（§7-43）+ §4.5 表「商品退款」行 |
| F8 | 请求指纹 | **服务端派生**：`sha256('listing.refund' | <order_id>)`；**不含 actor、不含客户端值** | `src/listing-funds-service.ts:300`（`fingerprintOf(['listing.refund', orderIdText])`，现取） |
| F9 | 无平台费 / 无新 kind / 无 hold 家族 | 退款**不收平台费**、**不新增 kind**、**不动 `frozen`**（两腿 `frozen_delta=0`） | §4.2 P4 + §4.3 + `0015:718-724` |
| F10 | 回执键集 | 成功面 = **23 键**（= 24 键的 buy 面去 `buyer_uid`/`quantity`/`client_buyer_uid_ignored`、补 `actor_uid`/`seller_uid`）—— **键集冻结（§2 母约束 F1）** | `p4-b4a-route-registration.md §3`（**转引**，非本册实测） |
| F11 | **`actor_uid` 的取值** | = **真实发起人**（管理员发起 ⇒ 该值为管理员 uid；卖方发起 ⇒ 卖方 uid）⇒ **唯一随 actor 变化的字段**（键集不变、值变），**这是设计内行为、不是回归** | `src/listing-funds-service.ts:305`（`view: { ...view, actor_uid: String(actor.uid), seller_uid: … }`，现取） |

### 12.3 ③ 鉴权失败面（**逐场景 · 零残留判据**）

> **统一形状** = `R107`：`{error:{code, message, i18n_key, details}}`；`AUTH_*` 域的 `i18n_key` = `auth.err.AUTH_FORBIDDEN` / `auth.err.AUTH_UNAUTHORIZED`（§3.3-6；前端四语键 = §2.4 S3）；**`reason` 值域是闭集**（`src/index.ts:254` 现取：`['ACTOR_NOT_ALLOWED','NOT_ADMIN','PERMISSION_NOT_GRANTED']`）⇒ **本契约不得新增 reason 值**（新增 = 改码，超出契约范围；AC-10 判负）。
> **★ `reason` 的诚实边界**：`reason` 的实际可见性**依驱动** —— `pool`/`direct`（WS）路径搬运 `DETAIL`（`src/ledger.ts:1101-1112` 现取），`neon` HTTP 路径 ⇒ `details.detail_unavailable='driver_did_not_carry_detail'`（`:1111`）⇒ **判据一律以 `code` 为准**（§3.5 同立场；本册未跑 HTTP ⇒ `NOT_MEASURED`，§8.17.2-83）。

| # | 场景 | 期望（状态码 / 码 / reason） | 零残留判据 | 依据 |
|--:|---|---|---|---|
| G1 | **无 token / 坏 token** | **`401` `AUTH_UNAUTHORIZED`**（**不触库**） | `ledger_entry` Δ=0、`listing_order` 未变、审计表 Δ=0 | §3.4 表第 1/2 行；`src/index.ts:256-262` + `:272-276`（`sendAuthError`，现取） |
| G2 | **有 actor，`can_access_admin=false`** | **`403` `AUTH_FORBIDDEN` + `reason='NOT_ADMIN'`** | 同上（Δ=0） | §6.2 步 2；`src/index.ts:305-308`（现取） |
| G3 | **admin 但未命中 `manage_points`**（`is_admin=false` 且 `permissions` 无该键） | **`403` `AUTH_FORBIDDEN` + `reason='PERMISSION_NOT_GRANTED'`** | 同上（Δ=0） | §6.2 步 4；`src/index.ts:311-314`（现取） |
| G4 | **管理员兼该单买方**（§12.1 禁令） | **`403` `AUTH_FORBIDDEN` + `reason='ACTOR_NOT_ALLOWED'`** | 同上（Δ=0） | Zang §5.88 ② 立法意图；§6.2「附」；现批非卖方支同码（`listing-funds-service.ts:286-294`） |
| G5 | 非卖方且非 admin（现批已生效行为） | **`403` `AUTH_FORBIDDEN` + `reason='ACTOR_NOT_ALLOWED'`** | 同上（Δ=0） | §4.7.2 + `:286-294` |
| G6 | 闸的**先后序** | **鉴权面（`requireActor` → admin 权限闸 → 服务层 actor 闸）必须早于任何资金调用**；**不得**出现「先动钱再判权限」 | 上列四场景的 Δ=0 即判据 | §4.10③ 先例（`requireAdmin` **先于**金额校验）+ `0023` 设计取向① |

> **★ 哪一类「被拒」需要留痕（与 §12.4 的分界）**：**G1–G5 的拒绝发生在任何资金编排之前** ⇒ **不写审计行**（依据 = `0023:215-228` 的「拒绝留痕」**发生在编排函数体内**；本仓不落 access log ⇒ 闸前拒绝**无痕**是既有事实，本契约**不改变**它，**只登记**）⇒ **待 Zang 确认（Z5）**。
> **★ 而「订单状态不可退」（409）发生在编排函数内** ⇒ 属 `0023` 裁定① 的射程（**被拒尝试最该留痕**）⇒ 见 §12.4 硬项 H6 + **Z3**（`result` 令牌取值 ⇒ 可能触发变体 A 的 CHECK 扩展）。

**★★ §12.3 v1.6 就地加注（**Zang Z5 终审 · 本节 G1–G6 表一字未动**）**：

> **（v1.6：Zang Z5 终审——闸前拒绝（401/403）不留痕）** 口径 = **G1–G5 的四类拒绝一律不写审计行**；依据 = ① 闸在编排**之前**（G6 已写死「鉴权面必须早于任何资金调用」）；② `0023` 的「拒绝留痕」**发生在编排函数体内**（`0023:215-228`）；③ **本仓不落 access log**（既有事实，§7-24 同口径）。**⇒ 闸前拒绝无痕 = 既有事实，本契约不改变它，只登记**（**§7-55**）。**将来若要留痕** ⇒ 须**另立规范**（不得在本契约内私开写入路径）。
> **★ 与 §12.4 H6 / Z3 的分界（不变）**：「**已经进入资金编排**」的拒绝（= 订单状态不可退 `409`）**必须留痕**（`result='rejected_state'`）；「**闸前拒绝**」（G1–G5）**不写审计行**。

**★★ §12.3 v1.9 就地订正（**Zang 终审 · 本仓自身发现的真矛盾 · 本节 G1–G6 表一字未动**）**：

> **（v1.9：Zang 终审 —— G2 旧写法作废，以 AC-13 为准）** **★ 矛盾（本仓自身发现 · 逐字）**：**§12.3 G2 行**（`:2918`）对「**有 actor、`can_access_admin=false`**」写 `reason='NOT_ADMIN'`；而 **§12.11.6 · AC-13④**（`:3255`）与 **§12.12** 对**同一输入**（**非卖方且非 admin**）写 `reason='ACTOR_NOT_ALLOWED'` ⇒ **二者对同一输入给出两种 reason = 真矛盾**；且 **AC-13⑥**（**非 admin 但有 `manage_points`**）**构造上不可达**（Zang 裁定）。
> **★ 裁定（Zang · 逐字）**：**以 AC-13（可证伪验收表）为准** ——
>   ① **非卖方非 admin** ⇒ `403 AUTH_FORBIDDEN` + `reason='ACTOR_NOT_ALLOWED'`（**取代 G2 旧写法**）；
>   ② **有 admin 但缺 `manage_points`** ⇒ `403 AUTH_FORBIDDEN` + `reason='PERMISSION_NOT_GRANTED'`（= G3，**不变**）；
>   ③ **`NOT_ADMIN` 不在本路由使用**（它**属既有 admin 面**）；
>   ④ **不可达分支已删除（本仓禁死代码）**。
> **★ 旧写法逐字留痕（不删）**：**G2 行原文** = 「**有 actor，`can_access_admin=false`** | **`403` `AUTH_FORBIDDEN` + `reason='NOT_ADMIN'`** | 同上（Δ=0） | §6.2 步 2；`src/index.ts:305-308`（现取）」；**AC-13⑥ 行原文** = 「⑥ 非 admin 但**有 `manage_points`**（不可能：`can_access_admin=false`）⇒ `403` + `'NOT_ADMIN'`」。⇒ **读 G2 / AC-13⑥ 时一律以本加注为准**（**G2 表体与 AC-13 表体一字未动**）。
> **★ `reason` 闭集不变（写死）**：`src/index.ts:254` 的 `AUTH_REASONS` 仍为 **3 值** `['ACTOR_NOT_ALLOWED','NOT_ADMIN','PERMISSION_NOT_GRANTED']`（`NOT_ADMIN` **保留供既有 admin 面使用**）⇒ **本路由不得返回 `NOT_ADMIN`**；**响应出现第 4 个 `AUTH_*` `reason` 值 / 任何新错误码 ⇒ 判负**（与 **AC-10** 同源，§12.8）。
> **★ 与 G5 的关系（不变）**：**G5「非卖方且非 admin」**（`:2921`）本就写 `reason='ACTOR_NOT_ALLOWED'` ⇒ **与本订正一致**（矛盾**仅在 G2 行**）⇒ **G5 行一字未动**。

### 12.4 ④ 审计留痕（**硬项**） + 落点两变体（**A / B，交 Zang 终审**）

**12.4.1 硬项（**与落点变体无关 · 任何实现都必须满足**）**

| # | 硬项 | 取值 / 判据 | 依据 |
|--:|---|---|---|
| H1 | **每次管理员退款必须留 actor 痕迹**（"钱动了但没痕迹"不可能） | `actor_uid` = **发起人 uid**（token 侧；**不得**由客户端声明） | §7-32 原文「每次管理员退款必留 actor 痕迹」 |
| H2 | 目标与金额 | `order_id`（目标订单）+ `cid` + `amount = |price × quantity|`（**服务端取数**，同 F4） | F4/F5；`0015:711` |
| H3 | **结果位 + 证据** | `result`（成功 = `applied`；拒绝令牌见 **Z3**）+ `txid` = **账本回执 `txid`**（成功行）；拒绝行 `txid = NULL` | `0023` 表设计（`result` / `txid` 两列）+ `0023:224` |
| H4 | **审计行与资金行同源判据** | 审计行的 `idempotency_key` = **资金事件的根键逐字相同** = `biz:listing:refund:<order_id>`；审计行 `txid` = 资金回执 `txid`（**逐字**） | `0023` 的 `idempotency_key` 列语义 + §11.2「两表行级同源」（`log_id 5` / `txid 277` 逐字相同的实测先例，**转引**） |
| H5 | 时间 | `time_created` 由 **DB 生成**（`now()`；不得客户端传） | `0023:82-99`（`DEFAULT now()`） |
| H6 | **被拒尝试的留痕范围** | **「已经进入资金编排」的拒绝**（= 订单状态不可退 `409`、单笔上限等）⇒ **必须留痕**（`0023` 裁定①）；**「闸前拒绝」**（G1–G5）⇒ 不写审计行（§12.3 尾注） | Zang §5.145 ①；`0023:215-228`（拒绝分支在**函数体内**） |
| H7 | **★「零残留」口径（逐字防歧义）** | **「零残留」= 资金零残留（`ledger_entry` 无分录、业务行未变）**，**不是**「不得有表行」—— 被拒尝试**恰恰应该**留下审计行 | **Zang §5.145 ①**（`0023` 注释 `:17-20` 同口径）；**本仓已有这条教训**（派单逐字） |
| H8 | 重放 | 同键重放 ⇒ **不写第二行审计**（判据 = 资金回执 `idempotent_replay`；结构兜底 = 审计表唯一约束） | `0023` ⑥ 段注释（`IF NOT v_replay THEN INSERT …`）+ `LOG_ID` 唯一/复合唯一 |
| H9 | **不得以异常中止** | 编排函数体内 **不得 `RAISE`**（`RAISE` 会把同函数内**已写的拒绝审计行**一并回滚）⇒ **返回拒绝回执 + 由路由映射既有码** | **`0023` 裁定① 逐字**；现取复核 = `admin_points_adjust_post_event` 的 `position('RAISE') = 0`（§12.0-D） |

**12.4.2 落点变体 A（**复用 `public.admin_ops_audit_log` + 扩展**）逐项代价**

| 项 | 代价 / 事实（本册现取） |
|---|---|
| 迁移面 | **≥ 4 项**：① `admin_ops_audit_log_action_ck` 由 **单值** `action = 'points_adjust'` ⇒ 须扩为 `IN ('points_adjust','listing_refund')`；② `admin_ops_audit_log_op_ck` 由 `IN ('mint','burn')` ⇒ 退款**不是** mint/burn（它是**用户间转移**）⇒ 须扩（新值，例如 `'refund'`）；③ `admin_ops_audit_log_result_ck` ⇒ 若拒绝令牌取新值（Z3）**须再扩**；④ **`admin_points_adjust_post_event` 函数体**须加 `AND a.action = 'points_adjust'`（**否则日累计被污染**，见下行）—— 而该函数是 **已 apply 迁移（`0023`）** 的对象 |
| 既有行兼容 | **对现有 4 行 `applied` 无影响**（扩 CHECK 是**放宽**，不改既有值）；但**改约束 = 改已 apply 迁移对象** ⇒ 必须**新迁移**（本批禁改 `migrations/**`） |
| **日累计是否受影响** | **★ 受影响**（本册现取判据）：`0023:207-211` 的求和**无 `action` 过滤** ⇒ 直插 `result='applied'` 的退款行 ⇒ **`daily_used` 增加 `abs(退款额)`** ⇒ 极端例：一笔 `1,000,000` 的退款即可**吃掉 A1 当日全部调分额度**（DoS 式副作用）。**必须**同批改函数体（第 ④ 项）才能消除 |
| R107 面 | **无影响**（R107 = 响应形状；本表只影响落库） |
| **单列语义挤压** | `target_uid NOT NULL` / `balance_before`+`balance_after`（单账户一对）**无法同时表达两方**（退款 = 卖方 −N **且** 买方 +N）⇒ 必须二选一（建议：`target_uid` = **卖方**（被扣款方）、`balance_*` = **卖方**账户前后值，**买方进 `memo`**）—— **这是一个需要 Zang 认可的口径压缩**（**Z2b**） |
| 自检面 | `0023` 的 apply-time 自检断言（15 列逐名 / PK1 FK3 CHECK4 UNIQUE1 / 索引 ≥4 / 触发器 1）⇒ 扩 CHECK 后**须保持 `CHECK 计数 = 4`**（改名/替换，不得净增）⇒ 自检文本须同步 |
| 与既有纪律的关系 | 与「不改 `ledger_post_event` 函数体」**不同条**（后者是 CR81/#14 的冻结对象）；但**改已 apply 的 `0023` 函数体**仍属高代价动作（须新迁移 + 全链 checksum 重放核） |
| 总代价 | **迁移 ≥1 个 + 约束改写 3 项 + 函数体改写 1 项 + 自检同步 + 单列语义压缩待认可** |

**12.4.3 落点变体 B（**新建审计表**，例：`public.admin_listing_refund_audit`）逐项代价**

| 项 | 代价 / 事实 |
|---|---|
| 迁移面 | **1 个新迁移**（`0024+`）：新表（逐列贴合：`log_id / actor_uid / order_id / seller_uid / buyer_uid / cid / amount / refund_txid / idempotency_key / request_fingerprint / result / memo / time_created`）+ **append-only 触发器**（手法照 `0023:114-127`）+ 索引（`actor_uid,time_created` / `order_id`）+ apply-time 自检。**零改写既有对象** |
| 既有行兼容 | **无对象受影响**（`0023` 一行不改） |
| **日累计是否受影响** | **不受影响**（A1 求和只读 `admin_ops_audit_log`）—— **零耦合** |
| R107 面 | **无影响** |
| 单列语义挤压 | **无**（可逐列表达两方 + 订单 + 结果） |
| 自检面 | 新增自检（不替换旧断言） |
| 与既有纪律的关系 | 完全符合「**新增**而非改写」的既有纪律（同 `0023` 对 `ledger_post_event` 的处置：**只新增调用方，不改被调方**） |
| 代价 / 风险 | ① **审计面分裂**（两张表 ⇒ 「谁对用户资产做过什么」需扫两表）；② 需**新 DB 编排函数**把「资金 + 本表审计行」压进同语句（§12.6 · 变体①）；③ `docs/data-layer.spec.md` 须**同批追加登记**（本批禁改 ⇒ 归实现批） |
| 总代价 | **迁移 1 个（纯新增）+ 编排函数 1 个 + data-layer 登记 1 处**；**零既有对象改动、零日累计耦合、零语义压缩** |

**★ 本册倾向（**不构成裁定**）**：**变体 B** —— 决定性理由 = **变体 A 会污染 A1 的日累计闸**（本册现取的结构性判据，非推测），且变体 A 需要**单列语义压缩**（需要额外裁定）；变体 B 的代价（审计面分裂）可用「同前缀命名 + spec/data-layer 双登记 + 检索视图（可选）」缓解。**⇒ 交 Zang 终审（Z2）**。

**★★ §12.4 v1.6 就地加注（**Zang Z2 / Z2b / Z3 终审 · 本节硬项 H1–H9 与 A/B 两变体表一字未动**）**：

> **（v1.6：Zang Z2 终审——**落点 = 变体 B**：新建审计表 `admin_refund_audit_log`）** 决定性依据（**`0023` 源码亲证，逐字进 spec**）：
> ① **`0023:86`** 的 `CONSTRAINT admin_ops_audit_log_action_ck CHECK (action = 'points_adjust')` 是**单值**约束（**不是** `IN (...)`）⇒ 复用必须放宽它；
> ② 🔴 **`0023:207-212`** 的日累计求和（`SELECT COALESCE(sum(abs(a.amount)),0) … WHERE a.actor_uid = v_actor AND a.result = 'applied' AND a.time_created >= v_day_start AND a.idempotency_key <> v_key`）**无 `action` 过滤** ⇒ 任何落入该表的 `result='applied'` 行（**含将来的退款行**）都会被计入 A1 的 **1,000,000 点/日**额度（**跨特性静默污染**：一笔大额退款即可吃掉 A1 当日调分额度）；
> ③ 复用须 `CREATE OR REPLACE` 改**已 apply** 的 `public.admin_points_adjust_post_event(jsonb)` 函数体（加 `AND a.action = 'points_adjust'`）⇒ **作废 `0023` 质检的字节级锚**（`0023` 已 apply、checksum 已入库 `fe7bb504…`）；
> ④ 该表列语义是**调分中心**的（`op IN ('mint','burn')` / 单一 `target_uid` + `balance_before`/`balance_after`）⇒ **退款**（seller + buyer + `order_id`，**既非 mint 亦非 burn**）塞进去必被**信息压缩**（两方无法同时表达）。
> **⇒ 变体 B（纯新增）终审采纳**；**变体 A 落选**（其代价与其四条硬伤见 §12.4.2，**保留不删**）。
> **（v1.6：Zang Z2b 终审——N/A（未选变体 A））** 登记 = **§7-54**：将来若有人选 A，**必须先解决上述四条**，且须给出「**不改已 apply 函数体**」的替代路径。
> **（v1.6：Zang Z3 终审——留痕，`result = 'rejected_state'`）** 附加三条：① **函数不得 `RAISE`**（异常会把同一函数内**已写的审计行**一并回滚）⇒ **返回拒绝回执、由路由映射 409**；② 同键重投 **`ON CONFLICT (idempotency_key, result) DO NOTHING`** ⇒ **不放大**；③ 行放大风险面**有界**（路径在权限闸之后）。**⇒ 硬项 H6 / H8 / H9 由此收口**（H2 的 `result` 令牌取值 = **`rejected_state`**）。

### 12.5 ⑤ 幂等（**键 / 指纹 / 三向行为 / 判负**）

| 项 | 契约 | 真源 |
|---|---|---|
| 幂等键 | **`biz:listing:refund:<order_id>`**（**服务端确定性派生**，DB 内构造）；**客户端不得传键**（本面既无 `create_key` 也无 `ops:` 键参数） | `0015:667`；§4.5 硬规则（§7-43：「服务端已确定性派生键的面，前端不得自造键」）；§4.5 表「商品退款」行（创建键 = `—`） |
| 请求指纹 | `sha256('listing.refund' | <order_id>)`，**服务端派生**；**不含 actor / 不含客户端值** | `src/listing-funds-service.ts:300` |
| **★ 两 actor 的幂等等价性** | **同订单 + 同键 + 同指纹** ⇒ 无论发起人是卖方还是管理员，**第二次发起必落 `200` 重放**（不得产生第二对分录） | 结构保证（F7/F8 与 actor 无关）+ `0015:673-676`（只读根键探测 `ledger_entry.event_root_key = v_key` ⇒ `v_replay`） |
| 同键同内容（重投） | **`200` + `idempotent_replay:true`**；**资金 delta = 0**（`Δledger_entry = 0`）；**业务行不重写**（不追加 `ledger_event_keys`、不改 `refund_txid`）；**审计行不新增** | `0015:758-763`（`IF NOT v_replay THEN UPDATE …`）；H8 |
| 同键异内容 | **`409` `LEDGER_IDEMPOTENCY_CONFLICT`**（`details.reason = 'REPLAY_FINGERPRINT_MISMATCH'`；`i18n_key = ledger.err.LEDGER_IDEMPOTENCY_CONFLICT`） | `ledger-errors.ts:33`（409）+ §4.5 契约 2（行为矩阵，v0.6 追加块） |
| **★ 同键异内容在本面的可达性（诚实边界）** | **结构性不可达**：指纹只由 `order_id` 派生，而键也由 `order_id` 派生 ⇒ **同一订单 ⇒ 同键必同指纹**。可达的唯一途径 = 实现方**改了**指纹/键的派生输入（**这正是 AC-10 的判负对象**） | `:300` + `0015:667`（本册现取）+ **`NOT_MEASURED`**（未跑 HTTP，§8.17.2-82） |
| **判负用例 1（双退向量）** | 若实现把 **actor 编入幂等键或指纹** ⇒ 同订单换 actor 发起 ⇒ **`Δpurchase_refund = +2`（出现第二对）** ⇒ **判负**（该实现判负；不是「用例失败」） | Zang §5.88 ② 立法意图 + F7/F8 |
| **判负用例 2（客户端自造键）** | 若实现要求/接受客户端传 `idempotency_key`/`create_key` ⇒ **判负**（违反 §4.5 硬规则；且「自造键 = 新标识 = 第二次退款」，`p4-b4c-ii-b` 同款判据 **转引**） | §4.5 硬规则 + §7-43 |
| 键校验序（若将来出现客户端键参数） | `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`（`cli:`/`biz:`/`ops:`/`cm:` 前缀；禁 `#` 与控制字符） | §4.5 规则段 + `listing-funds-service.ts:104-131` |

**★★ §12.5 v2.0 就地加注（**「同键异内容 ⇒ `409`」载体定层 = DB 层 · HTTP 面 = `NOT_APPLICABLE` · 本节表一字未动**）**：

> **（v2.0：Zang —— 「同键异内容 ⇒ `409`」的正式载体 = DB 层）** **★ 旧写法（保留不删 · 逐字）**：本节表「**同键异内容** ⇒ **`409` `LEDGER_IDEMPOTENCY_CONFLICT`**（`details.reason = 'REPLAY_FINGERPRINT_MISMATCH'`；`i18n_key = ledger.err.LEDGER_IDEMPOTENCY_CONFLICT`）」行（v1.9 现取 `:3058`）+「**★ 同键异内容在本面的可达性（诚实边界）**」行（v1.9 现取 `:3059`：**「结构性不可达」：指纹只由 `order_id` 派生，而键也由 `order_id` 派生 ⇒ 同一订单 ⇒ 同键必同指纹**）。
> **★ 定层（Zang · 逐字）**：**该 `409` 的正式载体 = DB 层**（编排函数 `public.listing_refund_post_event(jsonb)` 入口的幂等指纹闸 —— 同键异指纹 ⇒ `LD003`）⇒ **可实测、且已实测**。
> **★ 实测（本册现取 · 转引）**：`backend-ts/.p7b-artifacts/p7b-08-e2e-http-collect1.json` 的 `item8_same_key_diff_content_db` ⇒ `{ error: { sqlstate: "LD003", message: "LEDGER_IDEMPOTENCY_CONFLICT", detail: "{\"actual\": \"p7b:DIFFERENT-FP\", \"expected\": \"77b48b2e62c4c75ae34ee50d268294aec1a43ec3b864587ec8ed8f10ec2934a4\", \"idempotency_key\": \"biz:listing:refund:8\"}" } }` ⇒ **`LD003` = `LEDGER_IDEMPOTENCY_CONFLICT`（§3.2 映射 `409`）**；**构造载体 = 直呼函数并显式传异指纹**（`SELECT public.listing_refund_post_event($1::jsonb)`，入参 `request_fingerprint = 'p7b:DIFFERENT-FP'`、同键 `biz:listing:refund:8`；转引 `backend-ts/scripts/p7b-08-e2e-http.ts:82-92` 其行内注「⑧ 同键异内容 ⇒ 409：HTTP 面 fp 由服务端派生 ⇒ DB 层等价构造」）。
> **★ HTTP 面 = `NOT_APPLICABLE`（写死 · 带原因）**：**本路由的幂等键与请求指纹同由 `order_id` 派生**（键 `biz:listing:refund:<order_id>` `0015:667`；指纹 `sha256('listing.refund' | <order_id>)` `src/listing-funds-service.ts:300`）⇒ **同订单 ⇒ 必同键且必同指纹 ⇒ 同键异内容在 HTTP 面构造不出** ⇒ **该面在 HTTP 层判为 `NOT_APPLICABLE`**（≠「未测」、≠「契约不成立」）。
> **★ 契约仍成立且可判负（不变）**：**判负对象 = 实现方改了键 / 指纹的派生输入**（**这正是 AC-10 的判负对象**；`src/listing-funds-service.ts:300` + `0015:667`）。
> **★ 与本节既有「可达性」行的关系**：该行结论「**结构性不可达**」**方向正确、予以保留**；本加注只**补定层**（DB 层可实测 / HTTP 面 `NOT_APPLICABLE`）与**实测读数**，**判据不变**。

### 12.6 ③′「资金与审计**同一次 DB 调用**」——**可达性**与两变体

> **问题**：`0023` 的取向① 要求「审计行与资金事件压成**一次 DB 调用**」（= 同一函数 / 同一语句 ⇒ 天然同事务）⇒ 本能力做到这点需要什么？

| 变体 | 形态 | 原子性 | 风险 | 与既有模式的关系 | 本册倾向 |
|---|---|---|---|---|---|
| **①（新编排函数 · 照盘上模式）** | 新增 **`public.listing_refund_post_event(jsonb)`**：同一函数体内 = `pg_advisory_xact_lock`（**可选**，见下）→ 调 **`public.listing_post_event(payload)`**（**函数体不改**）→ 取 `txid` / `idempotent_replay` → **若非重放** ⇒ `INSERT` 审计行（`ON CONFLICT DO NOTHING`，H8）→ 回执。调用方 = 一条 `SELECT public.listing_refund_post_event($1::jsonb)`（经 `DatabaseService` 新方法） | **达成**（同函数 = 同隐式事务） | ① 新增 DB 对象 ⇒ **须新迁移**（本批禁改 ⇒ 归实现批）；② **`listing_post_event` 对多余 payload 键的宽容度 = 只读推断、未实测**（§8.17.2-84） | **完全同构**于 `admin_points_adjust_post_event`（`0023:157-…`：同函数内「闸 → `ledger_post_event` → 写审计行 → 回执」）⇒ **盘上已有模式，照拄** | **★ 倾向（不构成裁定）** |
| **②（路由层两段）** | 路由/服务层先 `SELECT public.listing_post_event(...)`，**再**发第二条语句 `INSERT` 审计行 | **不达成**（两条独立语句；TS 侧无外层事务 ⇒ 第一条已提交） | **与 `0023` 设计取向① 逐字冲突**：「**不得**写成『先调资金、再插入审计行』」；失败模式 = **资金已落、审计未落**（进程崩溃 / 连接断 / 映射异常）⇒ **「管理员动过卖方的钱而零痕迹」** | 与 A1 面不一致 | **判负倾向（交 Zang · Z4）** |
| **②′（TS 交互式事务包裹两句）** | 用既有 `src/db.ts` 的交互式事务（R55/R56 既有）在应用层包住「资金 + 审计」两句 | **达成**（应用层事务） | ① 多一次事务往返 + 破坏「单语句」纪律（§4.0 R2）；② 与 A1 的 DB 内编排**不同构** ⇒ 两套原子性机制并存（维护/审计成本）；③ `DatabaseService` 需新增事务方法（代码面更大） | 与 `0023` 的取向不同（取向 = **DB 内**编排） | 不作首选（登记备选） |

**编排函数的建议定序（**照 `admin_points_adjust_post_event` 照拄**，键名不新造结构）**：`pg_advisory_xact_lock(hashtextextended('listing_refund:' || order_id, 0))` → `public.listing_post_event(payload)` → 取 `txid`/`idempotent_replay` → `IF NOT v_replay THEN INSERT <审计表> … ON CONFLICT DO NOTHING` → 回执 `{ ok, order_id, txid, idempotent_replay, audit_logged, … }`。
- **并发闸是否必要**：**可选加固** —— 同一订单的并发已被 `0015:675` 的 `SELECT … FROM public.listing_order … FOR UPDATE`（行锁）串行化，且账本侧有幂等兜底；**A1 之所以必需 advisory lock**，是因为它的**日累计闸**需要按操作人串行。⇒ 本能力若**不设日累计闸**（§12.9），advisory lock 属**冗余加固**；**若设**则必需。**登记 = Z4b**。
- **函数体内不得 `RAISE`**（H9）：拒绝一律**正常返回回执** + 由路由映射既有码。
- **不动被调方**：`public.listing_post_event` 的**函数体一字不改**（同 `0023` 对 `ledger_post_event` 的处置）。

**★★ §12.6 v1.6 就地加注（**Zang Z4 / Z4b 终审 · 本节三变体表与建议定序一字未动**）**：

> **（v1.6：Zang Z4 终审——形态 = 变体 ①：新增编排函数 `public.listing_refund_post_event(jsonb)`）** **新迁移 `0024`**（同构 `admin_points_adjust_post_event`）。**★★ 硬约束（防双真源 · 逐字）**：该函数**必须复用既有资金路径** —— **同一语句内**调用既有 `public.listing_post_event(payload)`（`op='refund'`）；**严禁复制退款资金腿**（`purchase_refund` ×2 / 金额服务端取数（`0015:711`）/ 不回滚库存（`0015:775-781`）**全在 `0015` 里**；**复制 = 造第二套真相**）；审计行 `INSERT` **必须与该资金调用同函数、同一次 DB 调用**。**⇒ 变体 ②（路由层两段）判负倾向成立**；**②′（TS 交互式事务）登记备选**（均**保留不删**）。
> **（v1.6：Zang Z4b 终审——不取 `pg_advisory_xact_lock`）** 依据 = 本批**无日累计闸**（§12.9）⇒ **无跨行读-改-写聚合**；同订单**串行性由既有状态机守卫承担**（`0015:670` 的 `SELECT … FROM public.listing_order … FOR UPDATE` 行锁 + `0015:677-678` 的只读根键探测）⇒ **以实测兼现**（**§12.11.6 · AC-11**：并发两笔同订单 ⇒ 恰一次生效；**含判负自证** = 移除该守卫必得 +4）。

### 12.7 ⑦ 注册面：**复用同路径 vs 新路径**（两变体 + 代价；**倾向 = 复用**，终审 = Zang）

| 变体 | 形态 | 代价 | 优点 | 共同硬项 |
|---|---|---|---|---|
| **①（倾向）复用同路径** `POST /api/listing-orders/:orderId/refund`（`src/index.ts:1855` 现取） | 单注册点；闸按 actor **分流**：先 `requireActor`；若 actor = 卖方 ⇒ 卖方路；否则 ⇒ `requireAdmin(req,res,'manage_points')` ⇒ 管理员路（含兼买方禁令） | ① 闸分叉（两条准入路径在同一 handler 内，**复核面变复杂**）；② 必须保证「管理员路不得绕过服务层 actor 派生」（否则 actor 混淆）；③ 服务层单点 `:62` **三分化**（§12.1） | ① **路径正典不变**（§7-37）；② **注册点不变**（§0 端点锚口径 ⇒ 无「+1 注册点」的连带登记）；③ 前端单点接线（`frontend/src/api/listing-api.js` 侧无新增）；④ §1 / §1.8 无新增行 | **无论哪条路径，资金编排必须唯一**（**同一 DB 函数 + 同一幂等键**）⇒ 否则双入口 = **双退向量** |
| **② 新路径**（例：`POST /api/admin/listing-orders/:orderId/refund`） | 新注册点；前置 `requireAdmin(req,res,'manage_points')` | ① 注册点 **+1** ⇒ 须同步 §0/§1 端点表 + §1.8 + §9 清单 + 部署面；② 前端需新增调用（若要有 UI）；③ **双入口风险**（两处都可能触发退款 ⇒ 必须共用同一资金编排 + 必须保证两入口的幂等键一致） | ① **闸分离清晰**（admin 面单独 `requireAdmin`，无分叉）；② 审计语义天然区分；③ 实现方更不易混淆 actor | 同上 |

**★ 本册倾向（**不构成裁定**）**：**变体①（复用同路径）** —— 与派单倾向一致；理由 = 路径正典已裁（§7-37）、注册点零增长、前端零改动；闸分叉的复杂度由 §12.1 的**准入表**（单一准入真源）控制。**终审 = Zang（Z6）**。

**★★ §12.7 v1.6 就地加注（**Zang Z6 终审 · 本节两变体表一字未动**）**：

> **（v1.6：Zang Z6 终审——形态 = 变体 ①：复用同路径）** 路径 = `POST /api/listing-orders/:orderId/refund`（注册点现取 = `src/index.ts:1855`；§7-37 路径正典）；**闸按 actor 分流** ⇒ **注册点不变（68）**、**前端零改动**、**无双入口风险**（**新路径变体②落选**，其代价保留不删）。
> **★ 必须写死 actor 分流顺序（逐字）**：**先判 admin 权限闸（`manage_points`）→ 否则卖方闸 → 否则 `403`**。即：`requireActor`（token 侧取 actor）之后 —— ① 若 actor = 该单 **seller_uid** ⇒ **卖方路**（**不要求** admin 闸）；② 否则若 `can_access_admin ∧ manage_points` ⇒ **管理员路**（**含兼买方禁令** ⇒ `403 AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`）；③ 否则 ⇒ **`403 AUTH_FORBIDDEN`**（`reason='PERMISSION_NOT_GRANTED'`（admin 但缺键）/ `'NOT_ADMIN'`（非 admin）/ `'ACTOR_NOT_ALLOWED'`（非卖方非 admin）—— 逐场景见 §12.3 G2–G5）。**判负用例 = §12.11.6 · AC-13**。

### 12.8 ⑥ **可证伪 AC 清单**（10 条 · 逐条可复算）

> **执行口径**：本册**零 HTTP、零库写** ⇒ 下表为**契约判据**（不是本册实测）；执行归**实现批 / 质检批**。**★ 夹具前置**：真库现成 `paid` 订单只有 `order_id=3`，**一旦退款即不可重置**（幂等键被消费，§8.17.3-91）⇒ 执行方**必须先用** `POST /api/listing/:listingId/buy`（`cli:` 建键）**造新 `paid` 订单**。**★ 基线（本册现取）**：`ledger_entry` = **271**（`purchase_refund` = 6）；17 个 kind 的计数见下 AC-1。

| # | 场景 | 期望（码 / 状态） | 判据（可复算） | 依据 / 现取基线 |
|--:|---|---|---|---|
| **AC-1** | **管理员发起退款 ⇒ 资金腿与卖方发起**逐字相同** | `200`；`purchase_refund ×2` | 逐 kind 计数等式：`Δpurchase_refund = +2`，**其余 16 kind 逐位不变**（基线：`hold 54 / currency_create_fee 38 / trade 32 / job_escrow 24 / listing_deposit 22 / trade_fee 16 / hold_release 12 / transfer 12 / mint 11 / job_payout 10 / job_fee 8 / job_escrow_refund 8 / burn 6 / purchase_refund 6 / commission 4 / sale 4 / purchase 4`，**Σ = 271** ✓）；两腿逐字 = `(−amount @ seller_uid)` / `(+amount @ buyer_uid)`、`frozen_delta='0'`；`event_root_key='biz:listing:refund:<order_id>'`、`ref_type='listing_order'`、`ref_id=<order_id>`；回执键集 = **23 键** | F1–F3/F7/F10；基线 = 本册现取（§12.0-D）+ `p4-b4a §3`（键集，转引） |
| **AC-2** | **不回滚库存** | `200` + 回执 `stock_rolled_back=false` | 退款前后 `SELECT stock FROM public.listing WHERE listing_id=<该单>` **逐字相等** | F6；§7-7；`listing-funds-service.ts:55`；`p4-b4c-ii-b §R_ok`（`stock_before=2 / stock_after=2`，**转引**） |
| **AC-3** | **非 admin ⇒ `403` 零残留** | `403 AUTH_FORBIDDEN`（`reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`） | `Δledger_entry = 0`；`listing_order.status` 不变；**审计表 Δ=0**（G1–G5 不写审计行，§12.3 尾注） | §6.2 步 2/4；§12.3 G2/G3 |
| **AC-4** | **无 token ⇒ `401`** | `401 AUTH_UNAUTHORIZED` | 三表 Δ=0；且**不触库**（日志面无 access log ⇒ 用「无 DB 往返」的间接判据：`Δledger_entry=0` + 不产生 `listing_order` 行锁等待） | §3.4 第 1 行；`src/index.ts:272-276` |
| **AC-5** | **订单不存在 / 形状非法** | `404 LEDGER_REF_NOT_FOUND` | `details.ref_type='listing_order'`、`details.ref_id=<入参>`；非数字/`0` ⇒ **同一码**（服务层形状闸） | §3.1；`listing-funds-service.ts:84`（`ref404`）+ `:276-280`；`0015:665-668`（`v_order_id < 1` ⇒ `LEDGER_REF_NOT_FOUND`） |
| **AC-6** | **已退款 / 非 `paid` 订单** | **`409` `LEDGER_CURRENCY_INVALID_TRANSITION`**（`details.field='listing_order.status'`；`reason='order_not_refundable'` ⇒ **驱动相关、`NOT_MEASURED`**） | 状态码 + `code` 为硬判据；`Δledger_entry = 0`；**审计行 = 是否落痕见 Z3（H6）** | `0015:683-686`（`ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION', …'order_not_refundable')`）；`ledger-errors.ts:36`（409）；§8.17.2-83 |
| **AC-7** | **幂等：同键重投（同 actor / 换 actor）** | `200` + `idempotent_replay:true` | `Δledger_entry = 0`；`listing_order.refund_txid` 与首投**逐字相同**；`ledger_event_keys` 不新增项；**审计行不新增**；`txid` 与首投逐字相同 | §12.5；`0015:673-676`/`:758-763`；§11.2 的 A1 面同款实测（**转引**） |
| **AC-8** | **审计与资金同源** | —— | 审计行 `txid` **逐字等于**该次资金回执 `txid`；审计行 `idempotency_key` **逐字等于** `biz:listing:refund:<order_id>`；审计行 `actor_uid` = 真实发起人；两表按该键**各恰 1 行**（成功面） | H4；`0023` 表；§11.2「两表行级同源」（转引） |
| **AC-9** | **客户端传值一律丢弃（判负）** | `200` 且响应体与「不传」**逐字相同** | 请求体带 `{amount, seller_uid, buyer_uid, request_fingerprint, idempotency_key}` ⇒ 分录金额/对手方/键/指纹**逐字不变**（指纹**必须**仍 = `sha256('listing.refund'|<order_id>)`） | F4/F5/F8；§4.8.2「退款额 = B 类」；`0015:711`（金额从订单行取） |
| **AC-10** | **判负：键/指纹含 actor、或新增 reason/错误码** | —— | ① 同订单换 actor 发起 ⇒ 若 `Δpurchase_refund = +2`（第二对）⇒ **判负**（双退向量）；② 响应出现**第 4 个** `AUTH_*` `reason` 值或**任何新错误码** ⇒ **判负**（`reason` 闭集 = 3 值（`src/index.ts:254` 现取）；错误码闭集 = 33 码（§4.7.4.1）） | §12.5 判负 1/2；§3.3-7；`src/index.ts:254` |

**★ 未测项**：**AC-1…AC-10 的现状读数一律 `NOT_MEASURED`**（能力未实现 + 本册零 HTTP，§8.17.2-82）—— **不得**把上表期望值当实测。

### 12.9 ④′ 日累计闸：**是否需要**（倾向 = 不需要；阈值与取舍 = Zang）

| 项 | 结论（**倾向 · 不构成裁定**） | 依据 |
|---|---|---|
| 是否需要同类闸 | **不需要** | ① `0023` 的日累计闸守的是「**凭空造币**」（A1 的 `mint`/`burn` 改动**总供应**）；退款是**用户间转移**（卖方 −N / 买方 +N，`Σ` 不变）⇒ **无发行敞口**；② 单笔敞口已由既有闸限住：`amount = price × quantity`（订单行）且 ≤ `ledger_max_single_amount()` = **`1e15`**（`0004:160` 现取）+ DB 侧 `OVER_MAX_SINGLE_AMOUNT` 检查（`0015:713-716`）；③ **同一订单只能退一次**（幂等键 order-scoped）⇒ **不存在「反复发起」的累计路径**（G4/G5 的闸前拒绝更是零资金） |
| 若 Zang 仍要「每日管理员退款总额上限」 | 则：阈值 = **服务端常量 + `TODO: Kevin 定值`**（照 `0023:161-162` 的处置）；**必须**同批解掉与变体 A 的耦合（`action` 过滤）**或**改读变体 B 的新表；且需 advisory lock（§12.6） | `0023:161-162`（`v_daily_cap CONSTANT bigint := 1000000` + `TODO: Kevin 定值`）；本册**未发明任何数值** |
| **登记** | **Z8**（是否需要 + 若需要则阈值） | 派单口径：「倾向：不需要；但阈值与取舍交 Zang 裁、标 `TODO: Kevin 定值`」 |

**★★ §12.9 v1.6 就地加注（**Zang Z8 终审 · 本节取舍表一字未动**）**：

> **（v1.6：Zang Z8 终审——不需要日累计闸）** 依据**不变**：退款**不造币**（用户间转移，`Σ` 不变）；单笔受**订单行**约束（`amount = price × quantity`）+ `ledger_max_single_amount()`（`0004:160` = `1e15`）+ DB 侧 `OVER_MAX_SINGLE_AMOUNT`（`0015:713-716`）；同订单**幂等唯一**（键 order-scoped）⇒ **无累计敞口**。**⇒ 本节表「若 Zang 仍要阈值」一支 = 不适用（不作废、保留不删）**；**未发明任何数值**。
> **★ Z8 的「以实测补偿」要求（逐字）**：因不设日累计闸 ⇒ **跨行聚合不存在** ⇒ **改用并发实测替代**：**并发两笔同订单退款 ⇒ 恰一次生效**（另一笔 **`409` / `LEDGER_CURRENCY_INVALID_TRANSITION`**）+ **资金腿恰一次** ⇒ **写成可证伪 AC（含判负自证要求）** = **§12.11.6 · AC-11**。

### 12.10 待 **Zang 终审**（Z1–Z8）与**实现面登记**

**12.10.1 待 Zang 终审（逐条：变体 + 代价 + 本册倾向**（倾向不构成裁定）**）**

| # | 待裁项 | 变体 A | 变体 B | 代价对比 | **本册倾向** |
|--:|---|---|---|---|---|
| **Z1** | **权限闸选键** | **`manage_points`**（本册写入契约的键：语义最贴 + 细粒度 + 零新造键） | 备选 = `manage_settings`（A11 兜底先例 `:1876`）/ 无键（A1 先例 `:1402`） | 三者**对现库账号均放行**（§12.0-B）；改字代价 = §12.1 / §12.1.1 / §12.3 三处 + AC-3 一行；**新键不可行**（§12.1.1 结论） | **`manage_points`（已写入）· 收一句话确认** |
| **Z2** | **审计落点：复用 vs 新建** | 复用 `admin_ops_audit_log` + 扩 CHECK（**≥4 迁移项 + 函数体改写 + 日累计污染**） | **新建表**（纯新增 + 零耦合 + 零语义压缩） | §12.4.2 vs §12.4.3（逐项对照） | **B** |
| **Z2b** | （仅当选 A 时）**单列语义压缩** | `target_uid` / `balance_*` 二选一（建议 = 卖方，"买方进 `memo`"） | 不适用（B 表逐列表达） | 需 Zang 认可「审计行只记一方余额」这一信息压缩 | **建议 = 记卖方（被扣款方）** |
| **Z3** | **被拒尝试的 `result` 令牌**（订单状态不可退 `409` 是否留痕、留什么值） | 新增 `result` 值（如 `'rejected_state'`）⇒ 变体 A 的 `result_ck` **须再扩** | 变体 B 新表自定值域（无既有闭集约束） | 留痕 = `0023` 裁定① 的精神（被拒尝试最该留痕）；不留痕 = 与裁定① 的射程判断不同（拒绝发生在**编排函数内**） | **留痕**（H6）+ 令牌 `rejected_state`（命名待 Zang 定） |
| **Z4** | **「资金 + 审计同一次 DB 调用」的形态** | ① 新编排函数 `listing_refund_post_event`（同构 `admin_points_adjust_post_event`） | ② 路由层两段（**与 `0023` 取向① 冲突**）/ ②′ TS 交互式事务 | §12.6 三行对照 | **①**（照盘上模式） |
| **Z4b** | **编排函数是否取 `pg_advisory_xact_lock`** | 取（冗余加固） | 不取（依赖 `listing_order` 行锁 + 账本幂等） | 若采纳 Z8 的日累计闸 ⇒ **必需**；否则可选 | **不取**（若不设日累计闸） |
| **Z5** | **闸前拒绝（401/403）是否留痕** | 不留痕（本册契约：闸在编排之前，`0023:215-228` 的拒绝留痕在函数体内） | 留痕（须为 `AUTH_*` 失败另开写入路径 ⇒ 与「单一资金写路径」纪律冲突） | 本仓不落 access log ⇒ 闸前拒绝**无痕是既有事实**；改它 = 新机制 | **不留痕**（只登记） |
| **Z6** | **注册面** | ① 复用同路径（闸分流） | ② 新路径 `/api/admin/listing-orders/:orderId/refund` | §12.7 两行对照 | **①**（与派单倾向一致） |
| **Z8** | **日累计闸是否需要（+ 若需要则阈值）** | 不需要 | 需要（阈值 = 服务端常量 + `TODO: Kevin 定值`；须解耦合） | §12.9 | **不需要** |

**12.10.2 实现面登记（**归新批 · 本册零代码**）**

| # | 交付项 | 前置（本契约条款） | 判据 |
|--:|---|---|---|
| I-1 | **新迁移**（审计落点：Z2 定案后 = 变体 A 的 ALTER 组 / 变体 B 的新表 + append-only 触发器 + 索引 + 自检） | Z2 / Z2b / Z3（`result` 值域） | 迁移 apply-time 自检通过；`0022`/`0023` 的 checksum **不变**（不得改写既有迁移链） |
| I-2 | **新 DB 编排函数** `public.listing_refund_post_event(jsonb)`（同语句「资金 + 审计」；**不改 `listing_post_event` 函数体**） | Z4 / Z4b / H9 | 函数体内**无 `RAISE`**（照 `0023` 自检手法）；资金与审计**同语句**（预塞冲突 ⇒ 一并回滚的反证） |
| I-3 | `backend-ts/src/database.ts` 新方法（单语句 `SELECT public.listing_refund_post_event($1::jsonb)`） | I-2 | 单语句（§4.0 R2） |
| I-4 | `backend-ts/src/listing-funds-service.ts`：`:62` 单点**三分化** + `:286-294` 准入判据（含兼买方禁令）+ 走新编排 | §12.1 / §12.3 G4 | AC-10 判负两向不得命中 |
| I-5 | 路由（Z6 定案：复用 `src/index.ts:1855` 加闸分流 / 或新注册点） | Z6 / G6 | 闸必早于资金调用；401/403 三表 Δ=0 |
| I-6 | 前端（如需 UI 入口） | Z6 | 端点接线与 §2 键集冻结一致（**本册未定前端口径** —— 现批前端对本面**零调用**，`p4-b4c-ii-b` 转引） |
| I-7 | **spec 回写**（`§7-32` / `§7-49` 状态 ⇒ 已落地；`§4.2 P4` 的 actor 格；本节 §12 状态） | 全部 | 落地后由 Jing 刷新（**本册不预写**；口径 = §7-32 状态格加注的「实现仍待批」） |
| I-8 | `docs/data-layer.spec.md` 追加登记（迁移对象面） | I-1 | 同批登记（**本批禁改** ⇒ 归实现批） |

### 12.11 ★★ v1.6 · **Zang Z1–Z8 终审逐字落位**（**本节只追加 · §12.0–§12.10 既有一字未动**）

> **本节性质**：把 **Zang 对 Z1–Z8 的终审**逐字落位成**可实现、可证伪的契约**。**本册只写契约、零代码、零迁移、库面只读**；**实现归新批**（§12.11.7）。**依据** = 逐字落位这九条裁定（Z1 / Z2 / Z2b / Z3 / Z4 / Z4b / Z5 / Z6 / Z8）+ 四条硬约束（可退门面 / 错误码闭集 33 / `:62` 单点升级 / 迁移自检）。**凡裁定需补细节处，一律先只读取证同族对象（`0023` 的 `admin_ops_audit_log` / `admin_points_adjust_post_event`）再照抄**；**确实无先例者**列 **§12.11.5 待 Zang 确认（3 条）**；**本册未发明任何规格值**。

#### 12.11.1 Z1–Z8 终审（**逐字落位** · 与 §12.10.1「待终审」表对读）

| # | 终审判定（逐字） | 落点 |
|--:|---|---|
| **Z1** | **权限键 `manage_points`**（终审定）。依据 = `0022` 十一键之一；前后端真源已齐（`backend-ts/src/database.ts:19` 键表 / `:3854` 首页分流 / `frontend/src/admin-utils.js:48` / `AdminLayout.jsx:80` / `App.jsx:242` 已是 `/dashboard/points` 路由权限）；**零新造键**；**后端路由闸面首次启用**。**附加**：不动 A1 既有的**无键 `requireAdmin`**；「A1 无键面与新契约不一致」⇒ 登记为下一轮 spec 收口项（**§7-52**），**本批不扩面** | §12.1 / §12.1.1（加注）/ §7-50 / §7-52 |
| **Z2** | **变体 B：新建审计表 `admin_refund_audit_log`**。四条依据 = ① `0023:86` `CHECK (action='points_adjust')` 单值；② 🔴 `0023:207-212` 日累计求和无 `action` 过滤 ⇒ 退款审计行**静默计入 A1 的 1,000,000 点/日额度**；③ 复用须 `CREATE OR REPLACE` 改**已 apply** 函数体 ⇒ 作废 0023 质检字节锚；④ 表列语义属**调分中心** ⇒ 退款必被**信息压缩**。**登记**：审计面分裂 ⇒ P6 审计台立项时定（**§7-53**） | §12.4（加注）/ §12.11.2 / §7-51 / §7-53 |
| **Z2b** | **N/A（未选变体 A）**。登记：将来若有人选 A ⇒ **必须先解决上述四条**，且须给出「**不改已 apply 函数体**」的替代路径 | §12.4（加注）/ §7-54 |
| **Z3** | **留痕**，`result = 'rejected_state'`。**附加三条**：① 函数不得 `RAISE` ⇒ 返回拒绝回执、**由路由映射 409**；② 同键重投 `ON CONFLICT (idempotency_key, result) DO NOTHING` ⇒ 不放大；③ 行放大风险面有界（路径在权限闸之后） | §12.4（加注）/ §12.11.2 / §12.11.6 |
| **Z4** | **新增编排函数 `public.listing_refund_post_event(jsonb)`**（新迁移 `0024`，同构 `admin_points_adjust_post_event`）。**★ 硬约束（防双真源）**：必须复用既有资金路径（同一语句内调既有 `listing_post_event(op='refund')`）；**严禁复制退款资金腿**；审计行 `INSERT` 必须与该资金调用**同函数、同一次 DB 调用** | §12.6（加注）/ §12.11.3 / §12.11.7 |
| **Z4b** | **不取 `pg_advisory_xact_lock`**（本批无日累计闸 ⇒ 无跨行读-改-写聚合；同订单串行性由**既有状态机守卫**承担 ⇒ **以实测兼现**） | §12.6（加注）/ §12.11.6 · AC-11 |
| **Z5** | **闸前拒绝（401/403）不留痕**（闸在编排之前；`0023` 的拒绝留痕发生在函数体内）。登记「本仓不落 access log」为既有事实；将来若要留痕须另立规范 | §12.3（加注）/ §7-55 |
| **Z6** | **复用同路径 `POST /api/listing-orders/:orderId/refund`**（闸按 actor 分流；注册点 **68** 不变；前端零改动；无双入口风险）。**必须写死 actor 分流顺序**：先判 admin 权限闸（`manage_points`）→ 否则卖方闸 → 否则 **403**；并给**判负用例** | §12.7（加注）/ §12.11.4 / §12.11.6 · AC-13 |
| **Z8** | **不需要日累计闸**（退款不造币；单笔受订单行约束、同订单幂等唯一 ⇒ 无累计敞口）。**以实测补偿**：并发两笔同订单退款 ⇒ **恰一次生效**（另一笔 **409 / `LEDGER_CURRENCY_INVALID_TRANSITION`**）+ **资金腿恰一次** ⇒ 写成**可证伪 AC（含判负自证要求）** | §12.9（加注）/ §12.11.6 · AC-11 |

#### 12.11.2 审计表契约 `public.admin_refund_audit_log`（**Z2 变体 B · 逐列照抄 `0023`**）

> **照抄口径（逐字）**：**列类型 / 约束命名风格 / append-only 手法 / 索引形态 / apply-time 自检结构** 全部照抄 `0023_admin_points_audit_daily_cap.sql` 的 `public.admin_ops_audit_log`（本册**先只读取证该迁移源码再照抄**，**未另创风格**）。**列集 = 退款语义、不压缩**（**恰 12 语义列**，与 §12.4.2 变体 A 的「单列语义挤压」相对）。

**A · 列集与类型（照抄 `0023:64-99`；「照抄锚点」= 被照抄处）**

| 语义列（**恰 12**） | 类型 | 照抄锚点 | 语义 |
|---|---|---|---|
| `actor_uid` | `bigint NOT NULL` | `0023:66` | **发起人 uid**（token 侧；管理员发起 = 管理员 uid；**不得**由客户端声明） |
| `order_id` | `bigint NOT NULL` | 业务目标列（**无先例 · 见下注**） | 退款目标订单（`listing_order.order_id`） |
| `seller_uid` | `bigint NOT NULL` | `0023:70`（「对谁」位） | **卖方**（被扣款方，`−amount`） |
| `buyer_uid` | `bigint NOT NULL` | `0023:70` 手法 | **买方**（收款方，`+amount`） |
| `cid` | `bigint NOT NULL` | `0023:71` | 币种 |
| `amount` | `bigint NOT NULL` | `0023:73` | = `price × quantity`（**服务端取数**，同 F4） |
| `result` | `text NOT NULL` | `0023:78` | **闭集 = `{'applied','rejected_state'}`** |
| `txid` | `bigint`（可空） | `0023:79` | 账本回执 `txid`（成功行）；**拒绝行 = NULL** |
| `idempotency_key` | `text NOT NULL` | `0023:77` | = `biz:listing:refund:<order_id>`（**逐字同资金事件根键**） |
| `request_fingerprint` | `text NOT NULL` | `0023:76` | = `sha256('listing.refund' \| <order_id>)`（服务端派生，同 F8） |
| `memo` | `text`（可空） | `0023:80` | 照抄（拒绝 = `reason`） |
| `time_created` | `timestamptz NOT NULL DEFAULT now()` | `0023:81` | **DB 生成**（不得客户端传） |
| **结构列（非语义）**：`log_id` | `bigint GENERATED BY DEFAULT AS IDENTITY` | `0023:65`（**身份证 PK**） | **照抄**；**是否保留 = §12.11.5 · T-1**（倾向 = 保留） |

> **注（`order_id` 的照抄边界）**：`0023` 的 `admin_ops_audit_log` **无任何业务表 FK**（其 `target_uid` 指向 `users`）；**全库 `REFERENCES public.listing_order` 命中 = 0**（本册现取）⇒ **本表亦不加业务表 FK**（照抄「无业务表 FK」先例）—— `order_id` 的存在性由**编排函数内**的资金腿（`0015:670`/`:672-673`）保证。

**B · 约束（照抄 `0023:82-99`）**

```
CONSTRAINT admin_refund_audit_log_pk          PRIMARY KEY (log_id),                                    -- 照抄 0023:82
CONSTRAINT admin_refund_audit_log_actor_fk    FOREIGN KEY (actor_uid)  REFERENCES public.users(uid),   -- 照抄 0023:83
CONSTRAINT admin_refund_audit_log_seller_fk   FOREIGN KEY (seller_uid) REFERENCES public.users(uid),   -- 照抄 0023:83 手法
CONSTRAINT admin_refund_audit_log_buyer_fk    FOREIGN KEY (buyer_uid)  REFERENCES public.users(uid),   -- 照抄 0023:83 手法
CONSTRAINT admin_refund_audit_log_cid_fk      FOREIGN KEY (cid)        REFERENCES public.currency(cid), -- 照抄 0023:85
CONSTRAINT admin_refund_audit_log_amount_ck   CHECK (amount <> 0),                                     -- 照抄 0023:88
CONSTRAINT admin_refund_audit_log_result_ck   CHECK (result IN ('applied', 'rejected_state')),         -- 照抄 0023:89 手法（闭集换值 = Z3）
CONSTRAINT admin_refund_audit_log_idem_uniq   UNIQUE (idempotency_key, result)                         -- 照抄 0023:99（沿用「幂等键不得被拒绝消费」裁定）
```

> **计数** = **PK×1 / FK×4 / CHECK×2 / UNIQUE×1**（照抄 `0023` 的「具名约束齐」结构；`0023` = PK×1 / FK×3 / CHECK×4 / UNIQUE×1）。
> **★ 无 `op` 列**（退款**既非 mint 亦非 burn** ⇒ 不引入 `op`；这正是变体 B 免于**信息压缩**的点）。
> **★ 纪律（逐字）**：**任何求和 / 额度判据只计 `result='applied'`**（即便本批无闸；`0023:210` 同款 —— 防「拒绝行把额度刷爆」）。

**C · 只增不删 + append-only 触发器（手法同 `referral` / `market_trade`）**

- 触发器函数 `public.admin_refund_audit_log_append_only()`：`BEFORE UPDATE OR DELETE` **无条件 `RAISE`**（`RAISE EXCEPTION 'admin_refund_audit_log is append-only: % forbidden (log_id=%)', TG_OP, COALESCE(OLD.log_id, 0)`）—— **手法逐字同** `0023:114-119`（`admin_ops_audit_log_append_only`）/ `0007:67-71`（`referral_append_only`）/ `0016:313`（`market_trade_append_only`）；**原生 `P0001`、不借账本错误码**（不建账本类对象）。
- 触发器 `trg_admin_refund_audit_log_append_only`：`DROP TRIGGER IF EXISTS … ; CREATE TRIGGER … BEFORE UPDATE OR DELETE … FOR EACH ROW EXECUTE FUNCTION …`（幂等挂载，照抄 `0023:124-127`）。
- **★ 诚实边界（同 `DL65`）**：**拦不住 `TRUNCATE` 与 `ALTER TABLE … DISABLE TRIGGER USER`** ⇒ **是护栏、非铁律**（`0023:103` / `0017:153` 同口径、逐字登记）。

**D · 索引（照抄 `0023:133-136` 形态）**

| 索引 | 列 | 照抄锚点 | 用途 |
|---|---|---|---|
| `admin_refund_audit_log_pk` | `(log_id)` | `0023:82`（约束自带） | 身份证 |
| `admin_refund_audit_log_idem_uniq` | `(idempotency_key, result)` | `0023:99`（约束自带） | 幂等兜底 |
| `admin_refund_audit_log_actor_day_idx` | `(actor_uid, time_created)` | `0023:133-134` 手法 | 按发起人 + 时间检索 / 将来额度判据 |
| `admin_refund_audit_log_order_idx` | `(order_id)` | `0023:135-136` 手法（`target_uid, time_created` ⇒ 换「订单轴」） | 按订单检索（谁退过这单） |

> **计 4 个索引**（= `0023` 的 idx×4 同款）。

**E · apply-time 自检（照抄 `0023` §D 结构 · 沿用 `DL48`：不通过 ⇒ 整迁移回滚、不写版本行）**

| 判据 | 断言（照抄 `0023:292-390` 手法） |
|---|---|
| **列集** | `pg_constraint` + `information_schema.columns` **逐名串** = `log_id,actor_uid,order_id,seller_uid,buyer_uid,cid,amount,result,txid,idempotency_key,request_fingerprint,memo,time_created`（照抄 `0023:298-303`） |
| **约束** | `pg_constraint`：PK×1 / FK×4 / `conname LIKE 'admin_refund_audit_log_%_ck'` = **2** / UNIQUE `admin_refund_audit_log_idem_uniq` ×1（照抄 `0023:306-313`） |
| **键集** | `pg_get_constraintdef` **逐字 = `UNIQUE (idempotency_key, result)`** + `pg_index` `indnkeyatts=2 AND indpred IS NULL`（照抄 `0023:317-331`） |
| **触发器启用态** | `pg_trigger` `tgenabled='O'` = **恰 1** 且 `(tgtype & 2)<>0 AND (tgtype & 8)<>0 AND (tgtype & 16)<>0`（**覆盖 UPDATE OR DELETE**）（照抄 `0023:342-350`） |
| **索引** | `pg_indexes` ≥ **4**，且 `admin_refund_audit_log_actor_day_idx` 在场（照抄 `0023:334-339`） |
| **编排函数** | `to_regprocedure('public.listing_refund_post_event(jsonb)')` 非空 + 体内 **`position('listing_post_event' IN def) <> 0`**（**复用资金路径 = Z4 硬约束**）+ **`position('RAISE' IN def) = 0`**（**Z3①**）+ `position('admin_refund_audit_log' IN def) <> 0`（同语句审计）（照抄 `0023:353-382`） |
| **指纹守卫** | `listing_post_event` 的签名 / 返回类型**未变**（`payload jsonb` ⇒ `jsonb`）（照抄 `0023:384-388`：**只新增调用方、不改被调方**） |

**★★ §12.11.2 v1.7 就地加注（**Zang T-1 终审 · 本节 A–E 五张表与正文一字未动**）**：

> **（v1.7：Zang T-1 终审——审计表 PK 列 = 变体①：保留 `log_id` 身份证 PK）** 表 = **12 语义列 + 1 结构列（共 13 列）**；`log_id` 逐字照抄 **`0023:65`**（`bigint GENERATED BY DEFAULT AS IDENTITY`）。**依据（含 Zang 认账，逐字）**：① **Zang 原话「12 列」指的是语义列、不含 PK 结构列** ⇒ 与「**列按退款语义、不压缩**」**不矛盾**（本节开头的「恰 12 语义列」读法由此**收口**）；② 与既有 **`admin_ops_audit_log` 同构**（`0023:65` 同款身份证 PK）⇒ **将来审计台可统一处理**；③ **append-only 触发器手法可「直接照抄」** —— 即 `0023:118` 的 `COALESCE(OLD.log_id, 0)` 变体**无须**改（**变体②「以 `(idempotency_key, result)` 作 PK」的触发器改写代价由此消失**）。
> **★ 落点核对（本册现取）**：**A** 末行「结构列（非语义）：`log_id`」与 **B** 的 `admin_refund_audit_log_pk PRIMARY KEY (log_id)`（照抄 `0023:82`）**与 T-1① 一致**；**E** 的列集断言串**本就以 `log_id` 起首**（`log_id,actor_uid,order_id,seller_uid,buyer_uid,cid,amount,result,txid,idempotency_key,request_fingerprint,memo,time_created`，**共 13 名**）⇒ **逐字相符、本单未改一字**。**⇒ 变体②（不保留、恰 12 列）落选**（其代价与触发器改写要求**保留不删**，见本节 A 表末行注与 §12.11.5）。


#### 12.11.3 编排函数契约 `public.listing_refund_post_event(jsonb)`（**Z4 · 同构 `admin_points_adjust_post_event`**）

- **调用形态**（照抄 `0023:142`）：调用方**一条语句** `SELECT public.listing_refund_post_event($1::jsonb)`（经 `DatabaseService` **新方法**）。
- **函数体三段（同一函数、同一条语句 = 一个隐式事务）**：① （**无 advisory lock** · Z4b）→ ② **调既有 `public.listing_post_event(payload)`**（`op='refund'`；**函数体一字不改** —— 同 `0023` 对 `ledger_post_event` 的处置）→ ③ **写审计行** `INSERT INTO public.admin_refund_audit_log … ON CONFLICT (idempotency_key, result) DO NOTHING` → 回执。
- **★ 硬约束（防双真源 · 逐字）**：**必须复用既有资金路径**（② 调 `listing_post_event`），**严禁复制退款资金腿**（`purchase_refund` ×2 / 金额服务端取数 / 不回滚库存**全在 `0015` 里**；**复制 = 造第二套真相**）。**⇒ 函数体内不得出现 `purchase_refund` 字面量**（判负 = §12.11.6 · AC-12）。
- **审计行取值**（照 `0023:260-265` 手法）：`actor_uid` = payload 里的 actor（**token 侧**，§12.1）；`order_id` / `seller_uid` / `buyer_uid` / `cid` / `amount` = **由资金回执 / 订单行服务端取数**；`result` = `'applied'`（成功）｜`'rejected_state'`（拒绝）；`txid` = 资金回执 `txid`（**逐字**；拒绝行 = `NULL`）；`idempotency_key` = **资金事件根键逐字** = `biz:listing:refund:<order_id>`；`request_fingerprint` = 服务端派生（同 F8）；`memo` = `reason`（拒绝）/ 备注；`time_created` = **DB `now()`**。
- **重放不写第二行**：`IF NOT v_replay THEN INSERT …`（照抄 `0023:258` 的 DL144① 精神）。
- **★ 函数不得 `RAISE`**（Z3①）⇒ 拒绝一律**正常返回回执**、由路由映射既有码（**闭集 33 不动**，§12.11.4）。
- **回执形状**（照抄 `0023:146-149` 形态）：`{ ok, order_id, txid, idempotent_replay, audit_logged, result, … }`（**具体键集归实现批**，与既有资金回执 `23 键`（F10）的关系 = 由实现批裁定 —— **登记** §12.11.7 · I-11）。
- **拒绝回执与中断点**：见 §12.4（H9）与 **§12.11.5 · T-2**（「函数不得 `RAISE`」如何与 `listing_post_event` 的 `ledger_raise`（`LD011` 异常）共存 ⇒ **待 Zang 确认**，**本册不二选一**）。

**★★ §12.11.3 v1.7 就地加注（**Zang T-2 终审 + 三条附加硬约束 + 回执键集裁定 · 本节正文一字未动**）**：

> **（v1.7：Zang T-2 终审——拒绝留痕的捕获机制 = 变体①：`BEGIN … EXCEPTION WHEN SQLSTATE 'LD011' THEN … END` 捕获）** 现成先例（本册现取）= **`0008:87/98/103`**（`EXCEPTION WHEN SQLSTATE 'LD021' THEN …`）+ **`0004:1048`**、**`0005:1318`** 的 `EXCEPTION` 块。**⇒ 写 `result='rejected_state'` 审计行 ⇒ 返回拒收回执（路由映射 409）**。**★ 变体②（编排函数内预读 `listing_order.status` 复制状态守卫）予以否决** —— 它造**第二真源**（状态机守卫在 `0015:682-686` 与编排函数内**两处并存**），**直接违反 Z4**（防双真源）。
> **（v1.7：Zang 附加硬约束①——白名单式捕获 · 逐字）** **只捕「明确列举」的状态机拒绝码**：`order_not_refundable` 对应 **`LD011`**（`0015:683-685`：`ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION', … 'reason','order_not_refundable', …)`）；**`order_pay_missing` 若同码则按 `reason` 区分**（**本册现取 = 确系同码**：`0015:688-690` 亦 `LEDGER_CURRENCY_INVALID_TRANSITION` = `LD011`，`reason='order_pay_missing'`）⇒ **白名单 = 「`SQLSTATE = 'LD011'` ∧ `reason ∈ {order_not_refundable, order_pay_missing}`」**（`reason` 载体 = `ledger_raise` 的 `DETAIL`，`0004:148`；读取手法照抄 **`0004:1094`** 的 `GET STACKED DIAGNOSTICS … v_detail = PG_EXCEPTION_DETAIL` / **`0008:88`** 的 `RETURNED_SQLSTATE, MESSAGE_TEXT` 先例）。**★ 严禁 `WHEN OTHERS`** —— 理由逐字：**否则基础设施错误（`53300` / `XX000` 一类）会被吞成「被拒」**，正是本仓 **D-04 / 真库「假成功」**那类真缺陷。**依据锚点（现取）**：`53300` ⇒ 既有分类器 `INFRA_SQLSTATE_REASONS`（`src/ledger-errors.ts:338` = `too_many_connections`）⇒ 归 **`LEDGER_TX_TIMEOUT`（503）**（`:60`）；`XX*`（内部错误）在 `:331-333` 的**同集同码**桶（`53*` / `58*` / `XX*`）⇒ 亦 **503**。**必须配可证伪判负用例（逐字入 AC）= §12.12.6 · AC-14**：注入 `53300` / `XX000` ⇒ `result` **不得**为 `rejected_state`，**必须向上抛、由既有分类器映射 503**。
> **（v1.7：Zang 附加硬约束②——拒收回执与审计行一起提交 · 零资金残留）** 捕获后**同一函数内**写审计行 + 返回回执 ⇒ **拒收回执与审计行一起提交**（同函数、同一次 DB 调用 = 一个隐式事务）；**资金腿因子事务回滚而「不留分录」（零资金残留）**（子事务 = `BEGIN … EXCEPTION … END`，其回滚**只**撤销块内已写对象 ⇒ `listing_post_event` 的两条 `purchase_refund`（`0015:718-724`）随子事务回滚、`ledger_entry` 该事件根键无残留）。
> **（v1.7：Zang 附加硬约束③——子事务回滚不得波及其他已写对象）** **审计行的 `INSERT` 必须落在 `EXCEPTION` 处理器内**（即失败子事务**之外**）⇒ 子事务回滚**不得**波及该审计行与块外任何已写对象。**依据**：PostgreSQL 中 `BEGIN … EXCEPTION … END` 即一个**子事务**（savepoint），异常路径回滚**仅**覆盖块内 ⇒ 处理器内写入**存活**、块外写入**不受影响**。（**本册零库写** ⇒ 该语义 = **契约判据**、现状读数 = `NOT_MEASURED`，见 §8.19.2-103。）
> **（v1.7：Zang 回执键集裁定——两级口径）** ① **编排函数内部回执必须含** `result`（`applied` 或 `rejected_state`）/ `txid`（**拒绝时 `null`**）/ `audit_logged`；② **对外一律走既有 `sendSuccess` / `ledgerErrorBody` 口径、不得新增对外顶层键**（**除既有 `extra` 机制**）—— 现取锚点：`sendSuccess = src/index.ts:98`、`ledgerErrorBody = src/job-service.ts:21`（R107 `{error:{code,message,i18n_key,details}}`）、`extra` 机制 = `src/listing-funds-service.ts:80-85`（`...extra` 展开进 `details`）；③ **与 F10 的 `23 键` 回执的关系 = 两层**（内部编排回执 vs 对外路由回执）⇒ **禁止把 23 键回执原样透传给前端**。**⇒ 本节末条的「具体键集归实现批」与 §12.11.7 · I-11 的登记由此收口**（**本册未改该两处一字**）。


#### 12.11.4 路由与准入契约（**Z1 / Z6 · 另四条硬约束 ②③**）

- **路径（Z6）**：`POST /api/listing-orders/:orderId/refund`（**复用同路径**；注册点现取 = `src/index.ts:1855`；**注册点 68 不变** ⇒ §0 / §1 无新增行）。**前端零改动**（无双入口风险）。
- **actor 分流顺序（写死 · 逐字）**：`requireActor`（token 侧取 actor，**客户端不得声明 actor**）⇒ ① **卖方路**（`actor.uid = listing_order.seller_uid`）⇒ 放行；② 否则 **admin 权限闸** `requireAdmin(req, res, 'manage_points')`（`manage_points` = Z1 终审定）；③ **否则 `403`**（`AUTH_FORBIDDEN` + `reason` ∈ 既有闭集 `{NOT_ADMIN, PERMISSION_NOT_GRANTED, ACTOR_NOT_ALLOWED}`）。**闸必早于任何资金调用**（§12.3 G6）。
- **★ 单点升级（硬约束③ · 逐字）**：`src/listing-funds-service.ts:62` 的 `REFUND_ACTOR_IS_SELLER_ONLY = true`（**本册现取未改**）须**随本单**从「**仅卖方**」升级为「**卖方 ∨ 管理员**」—— 口径从**单点常量**升级为**权限闸驱动的 actor 分流**；**不得让常量与权限闸并存成为第二真源**（⇒ 该常量**必须**由权限闸驱动的分流**取代** / 或成为闸的**输出**，**不得**作为并行真源）。**具体载体形态归实现批**（本册不发明）。
- **错误码（硬约束② · 逐字）**：**闭集 33 不动** —— `409` / `404` **全部复用既有码** + 项目级 `details.reason`；**不得依赖 DB 的 `DETAIL`**（驱动不搬运它，§3.5 / §7-44 同立场）。本面用到的既有码 = `LEDGER_CURRENCY_INVALID_TRANSITION`（`LD011` · 409）/ `LEDGER_REF_NOT_FOUND`（`LD022` · 404）/ `AUTH_FORBIDDEN`（403，`AUTH_*` 域、**不进 33 码闭集**）。**禁新增码 / 禁新增 `reason` 值**。
- **可退门面（硬约束① · 逐字）**：`listing_order` 现成唯一可退行 = **`order_id 3`**（seller 7 / buyer 8 / `100×1` / `status='paid'`）⇒ **E2E 优先用它**；**不得为测试修改真库既有行**；**自建夹具 uid ≥ 900000**。
- **迁移自检（硬约束④）**：`0024` 自带 **apply-time 自检**（**列集 / 约束 / 触发器启用态 / 键集**，见 §12.11.2-E），**失败整体回滚**（沿用 `DL48`）。

**★★ §12.11.4 v1.7 就地加注（**Zang T-3 终审 + 附加硬约束④ · 本节正文一字未动**）**：

> **（v1.7：Zang T-3 终审——404 不留痕；射程写死）** **留痕面 = 「已进入资金编排且被状态机拒绝（409）」**（= `result='rejected_state'`）；**不留痕面 = 401/403（权限闸前）+ 404（存在性前置闸）+ 400（形状 / 参数非法）**（**与 Z5 同源**）。**H6 的「已经进入资金编排」读作「函数体内、资金腿之前的状态机拒绝」**（**不是**「`listing_post_event` 已被调用」的存在性面）。**⇒ 本节错误码面读法不变**：`409 LEDGER_CURRENCY_INVALID_TRANSITION`（`LD011`）**留痕**；`404 LEDGER_REF_NOT_FOUND`（**`LD022`**，现取 `0004:108`；`0015:663-665` 的 `v_order_id < 1` 与 `:671-673` 的 `NOT FOUND` 两处均借它）**不留痕**；`400`（形状闸）**不留痕**。
> **（v1.7：Zang 附加硬约束④——对外不新增顶层键 · 逐字）** **对外一律走既有 `sendSuccess` / `ledgerErrorBody` 口径**；**不得新增对外顶层键**（**除既有 `extra` 机制**）；**错误码闭集 33 与 `AUTH_*` `reason` 闭集（3 值）一概不动**。**现取锚点** = `sendSuccess`（`src/index.ts:98`）、`ledgerErrorBody`（`src/job-service.ts:21`）、`extra`（`src/listing-funds-service.ts:80-85`）；**判负 = 若响应出现新顶层键 / 新错误码 / 第 4 个 `AUTH_*` `reason` 值 ⇒ 判负**（与 **AC-10** 同源，本单不新增判负编号）。


#### 12.11.5 ★ 待 Zang 确认（**3 条 · 本册不自行二选一**；各带两变体 + 代价 + 倾向（倾向不构成裁定））

| # | 需补细节 | 变体 | 代价 | 本册倾向 | 为何不能照抄 |
|--:|---|---|---|---|---|
| **T-1** | 审计表是否保留 `log_id`（**身份证 PK**） | ① 保留（照抄 `0023:65`） | 表 = **13 列**（12 语义 + 1 结构）；自检列名串含 `log_id` | **①（保留）** | 裁定给的是 **12 语义列**（未点名 `log_id`）；照抄 `0023` 风格则含它 ⇒ 二读法冲突 |
| | | ② 不保留（以 `(idempotency_key, result)` 作 PK） | 表 = **恰 12 列**（**与裁定列集逐字相等**）；**无代理 PK**；append-only 触发器照 `0023:118` 的 `COALESCE(OLD.log_id, 0)` 须改（`OLD` 无 `log_id`） | | |
| **T-2** | 「**函数不得 `RAISE`**」（Z3①）如何与 `listing_post_event` 的 **`ledger_raise`（`LD011` 异常）** 共存 —— 即**拒绝留痕的捕获机制** | ① `BEGIN … EXCEPTION WHEN SQLSTATE 'LD011' THEN … END` **捕获** 409 状态位拒绝 ⇒ 写 `result='rejected_state'` 审计行 ⇒ 返回拒收回执（路由映射 409）。**有现成先例** = `0008:87/98/103/110/115`（`EXCEPTION WHEN SQLSTATE 'LD021'`）+ `0004:1048` / `0005:1318` 的 `EXCEPTION` 块 | ① 照抄先例、**零复制资金腿、零第二真源**；代价 = 子事务回滚该次 `listing_post_event` 内已写状态（**正是所要**）；**只捕 `LD011` 一类** ⇒ 其他账本错（`LD022` 等）保持既有传播 | **①** | ❌ **无「零捕获」先例**：`0023` 的 A1 把闸**放在本函数内**（可直接 `RETURN` 拒收回执、不调任何会 `RAISE` 的函数）；退款的状态机闸在**被调方**（`0015:682-686`）⇒ 照抄 `0023` 的「零 `RAISE` + 直接返回」**不可直接搬** |
| | | ② 编排函数内**预读 `listing_order.status`** 复制状态守卫（`status <> 'paid'` ⇒ 写留痕 + 拒收回执） | ② 不捕获异常；代价 = **第二真源**（状态机守卫在 `0015:682-686` 与编排函数**两处并存**）⇒ 与「**防双真源**」（Z4 硬约束）**同向冲突** | | |
| **T-3** | 「**已经进入资金编排**」的拒绝（§12.4 H6）**是否含存在性面（`LD022` 404）** —— 即**404 是否留痕** | ① **不留痕**（保持既有 404 传播）：Z3 逐字射程 = **409 状态位**；404 = 订单不存在 ⇒ 近似**闸面** | ① 与 Z3 逐字一致、改动面最小 | **①** | ❌ H6 的措辞（「**已经进入资金编排**的拒绝 … 等」）可读为**含 404**（`listing_post_event` 已被调用）⇒ 两读法均可解释 |
| | | ② **留痕**（同 `result='rejected_state'`）：H6 的立法精神 = 「被拒尝试最该留痕」 | ② 与 H6 精神一致；代价 = ① 编排函数须**另捕 `LD022`** ⇒ 捕获面扩大；② 404 面**同样落在权限闸后**（Z3③ 的「有界」仍成立） | | |

**★★ §12.11.5 v1.7 就地加注（**Zang 对 T-1 / T-2 / T-3 的终审 · 本节三行表与两变体代价一字未动**）**：

> **（v1.7：Zang 终审——本节三条「待确认」全部收口，不再待确认）**
> **T-1 ⇒ 变体①（保留 `log_id` 身份证 PK）**：表 = **13 列**（12 语义 + 1 结构，照抄 `0023:65`）；「12 列」= **语义列**、不含 PK 结构列；**与既有 `admin_ops_audit_log` 同构 ⇒ 审计台可统一处理**；**append-only 触发器手法直接照抄**（`COALESCE(OLD.log_id,0)` 变体**无须**）。**落点 = §12.11.2 加注 + §12.12.1**。
> **T-2 ⇒ 变体①（`EXCEPTION WHEN SQLSTATE 'LD011'` 捕获）**；**变体②（预读 `status` 复制守卫）否决**（第二真源 ⇒ 违反 Z4）。**另加三条硬约束逐字落位**：① **白名单式捕获、严禁 `WHEN OTHERS`**（否则 `53300`/`XX000` 一类基础设施错误被吞成「被拒」）+ **可证伪判负用例（AC-14）**；② **拒收回执与审计行一起提交**（资金腿因子事务回滚而零分录）；③ **子事务回滚不得波及其他已写对象**（审计行 `INSERT` 落在 `EXCEPTION` 处理器内）。**落点 = §12.11.3 加注 + §12.12.2 / §12.12.3**。
> **T-3 ⇒ 变体①（404 不留痕）**；**射程写死**：留痕面 = **409（已进入资金编排且被状态机拒绝）**；不留痕面 = **401/403 + 404 + 400**（与 Z5 同源）；H6 读法 = **函数体内、资金腿之前的状态机拒绝**。**落点 = §12.11.4 加注 + §12.12.4**。
> **★ 登记项（回执键集）= Zang 裁定**：内部回执含 `result` / `txid`（拒绝 `null`）/ `audit_logged`；**对外零新增顶层键**（走 `sendSuccess` / `ledgerErrorBody` + 既有 `extra`）；与 **F10 的 23 键** = **两层**、**禁止原样透传**。**落点 = §12.11.3 加注 + §12.12.5**（**§12.11.7 · I-11 的登记由此收口**）。


#### 12.11.6 可证伪 AC（**新增 AC-11 / AC-12 / AC-13**；与 §12.8 AC-1…AC-10 并读，**编号接续**）

> **执行口径**：本册**零 HTTP、零库写** ⇒ 下表为**契约判据**（不是本册实测）；**执行归实现批 / 质检批**。**★ 夹具前置（硬约束①）**：**可退门面 = `order_id 3`**（**E2E 优先用它**）；**不得为测试修改真库既有行**；**自建夹具 uid ≥ 900000**；**★ 若用 `order_id 3`，一旦退款即不可重置**（幂等键被消费，§8.17.3-91）⇒ 执行方**必须先用** `POST /api/listing/:listingId/buy`（`cli:` 建键）**造新 `paid` 订单**（uid ≥ 900000）。

| # | 场景 | 期望（码 / 状态） | 判据（可复算） | 依据 |
|--:|---|---|---|---|
| **AC-11** | **★ 并发两笔同订单退款（Z8 的「以实测补偿」· Z4b 的「以实测兼现」）** | **恰一次生效**：恰一笔 `200`（`purchase_refund ×2`）+ 另一笔 **`409` `LEDGER_CURRENCY_INVALID_TRANSITION`**（`details.field='listing_order.status'`；`reason='order_not_refundable'` ⇒ 驱动相关、`NOT_MEASURED`）**或** `200` + `idempotent_replay:true`（若第二笔落在首笔提交后 ⇒ 只读根键探测命中，`0015:677-678`） | ① `Δpurchase_refund` **恰 +2**（**不是 +4**）；② `listing_order.status` 恰转 `refunded` **一次**（`refund_txid` 恰 1 个）；③ 审计表该 `order_id` 的 `result='applied'` 行**恰 1 行**；④ **Σ(cid=1) 不变**（不造币） | Z8 / Z4b；`0015:670`（`FOR UPDATE` 行锁）/ `:677-678`（幂等探测）/ `:682-686`（状态机闸）；§12.6 |
| **AC-11 判负自证** | **★ 硬要求 · 可证伪：「恰一次」是否真由既有守卫承担** | —— | ① 形态 ①：**同一隔离级（READ COMMITTED）下并发两笔** ⇒ 必得「恰一次」（否则用例判负）；② **判负自证**：临时**移除 / 停用** `0015:670` 的 `SELECT … FOR UPDATE` 行锁（**仅测试环境、仅本用例、跑完必须还原**）⇒ **必得 `Δpurchase_refund = +4`**（第二对分录）；**若移除后仍 +2 ⇒ 说明判据无效、用例判负**。**★ 注**：该自证**不得在本批做**（**禁改 `migrations/**`**）⇒ **登记为质检批执行项** | Z4b「以实测兼现」；§12.6；**纪律** = 判负用例必须能**证伪**（不只是「正向通过」） |
| **AC-12** | **★ 判负：复制退款资金腿（Z4 硬约束「防双真源」）** | —— | ① 编排函数体内 **`position('purchase_refund' IN def) = 0`**（**不得**出现资金腿字面量）；② **`position('listing_post_event' IN def) <> 0`**（**必须**复用资金路径）；③ 事件根键仍 = `biz:listing:refund:<order_id>`（`0015:667` 派生，**不得**由编排函数自造）；**任一不满足 ⇒ 判负**（该实现判负，非「用例失败」） | Z4 硬约束（防双真源）；§12.11.3；照 `0023` 自检手法（`position(... IN def)`） |
| **AC-13** | **★ actor 分流顺序（Z6 写死）· 含判负用例** | 见判据列 | **正向**：① 卖方（**非 admin**）⇒ `200`（**不经 admin 闸**）；② 管理员（**非卖方、非买方**）⇒ `200`；③ 管理员**兼买方** ⇒ `403 AUTH_FORBIDDEN` + `reason='ACTOR_NOT_ALLOWED'`；④ 非卖方非 admin ⇒ `403` + `'ACTOR_NOT_ALLOWED'`；⑤ admin 但**缺 `manage_points`** ⇒ `403` + `'PERMISSION_NOT_GRANTED'`；⑥ 非 admin 但**有 `manage_points`**（不可能：`can_access_admin=false`）⇒ `403` + `'NOT_ADMIN'`。**★ 判负用例**：若实现**把卖方路也要求 admin 权限**（= 未做 actor 分流、直接 `requireAdmin('manage_points')` 全覆盖）⇒ **① 卖方（非 admin）被 `403` 拦下 = 回归**（卖方路本应 `200`）⇒ **判负** | Z6；§12.3 G2–G5；§12.11.4；`listing-funds-service.ts:286-294`（现批同码） |

**★ 未测项**：**AC-11 / AC-12 / AC-13 的现状读数一律 `NOT_MEASURED`**（能力未实现 + 本册零 HTTP / 零库写）—— **不得**把上表期望值当实测（口径同 §12.8 尾注）。

**★★ §12.11.6 v1.7 就地加注（**AC-11 判负自证复核 + 新增 AC-14 / AC-15 · 本节 AC-11…AC-13 表与正文一字未动**）**：

> **（v1.7：AC-11 的判负自证——已在位，本单只补出处行号现取）** 该行逐字已含：**移除 / 停用 `0015:670` 的 `SELECT … FOR UPDATE` 行锁（仅测试环境、仅本用例、跑完必须还原）⇒ 必得 `Δpurchase_refund = +4`**，且「**若移除后仍 +2 ⇒ 说明判据无效、用例判负**」。**现取行号（本册现取）** = **`0015:670`**（`SELECT * INTO v_order FROM public.listing_order o WHERE o.order_id = v_order_id FOR UPDATE;`）+ **`0015:677-678`**（只读根键探测：`SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;` / `v_replay := FOUND;`）⇒ **AC-11 的判负可构造性成立（移除该 `FOR UPDATE` ⇒ 并发两笔必得 +4 = 双重退款）**。**本单未改该行一字**（**删除列 = 0**）。
> **（v1.7：新增可证伪 AC——AC-14 / AC-15；编号接续 AC-13，落点 = §12.12.6）** ① **AC-14**：**白名单捕获判负** —— 注入 `53300` / `XX000` ⇒ `result` **不得**为 `rejected_state`、**必须向上抛、由既有分类器映射 503**（`LEDGER_TX_TIMEOUT`）；附带**静态判据** `position('WHEN OTHERS' IN pg_get_functiondef('public.listing_refund_post_event(jsonb)'::regprocedure)) = 0`。② **AC-15**：**拒绝面零资金残留 + 拒收回执与审计行一起提交 + 子事务回滚不波及其他已写对象**。**★★ 现状读数一律 `NOT_MEASURED`**（能力未实现 + 本册零 HTTP / 零库写）—— **不得**把期望值当实测（口径同本节尾注）。


**★★ §12.11.6 v1.9 就地加注（**AC-11 判负改可复现三条 + AC-13⑥ 不可达分支订正 · 本节 AC-11…AC-13 表与正文一字未动**）**：

> **（v1.9：AC-11 判负口径 —— 原「`+4` 判负」结构性不可行 ⇒ 改为三条可复现判据）** **原判负（保留不删 · 逐字）** = 「临时**移除 / 停用** `0015:670` 的 `SELECT … FOR UPDATE` 行锁（**仅测试环境、仅本用例、跑完必须还原**）⇒ **必得 `Δpurchase_refund = +4`**（第二对分录）；**若移除后仍 +2 ⇒ 说明判据无效、用例判负**」。
> **★ 改版理由（结构性不可行 · Zang 裁定 · 逐字）**：该自证**需第二个库**（主库**不得改既有行**）**且需改已应用迁移**（`0015` 已 apply ⇒ 禁改）⇒ **不可复现**。
> **★ 改版（**三条可复现判据** · 逐字）**：
>   ① **源码级**：`position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0`（**守卫在函数体内 · 静态可复算**）；
>   ② **竞争实测**：**两会话同订单并发**（同一隔离级）⇒ **受害者阻塞时长 > 0**（行锁串行化的**正向证据**）；
>   ③ **正向**：**并发两笔同订单** ⇒ **恰一次生效**（另一笔 `409 LEDGER_CURRENCY_INVALID_TRANSITION`）+ **资金腿恰一次** + **审计行恰 1 行**。
> **★ 登记（写死）**：「**`+4` 判负需第二个库 ⇒ 归 P8 前可选**」—— **不再作为本 AC 的硬判负要求**；**原判负行保留不删**（其行号现取 `0015:670` / `:677-678` 与 §12.11.6 v1.7 加注（`:3261`）**不变**）。
> **（v1.9：AC-13⑥ 不可达分支订正 · 与 §12.3 v1.9 加注同源）** **AC-13⑥**（**非 admin 但有 `manage_points`**）**构造上不可达**（Zang 裁定）⇒ **该分支已删除（本仓禁死代码）**；**`NOT_ADMIN` 不在本退款路由使用**（其映射**保留供既有 admin 面**）。**⇒ 本路由 403 实际只用两值**：`ACTOR_NOT_ALLOWED`（非卖方非 admin · **AC-13④**）/ `PERMISSION_NOT_GRANTED`（admin 缺键 · **AC-13⑤**）。**AC-13 表体一字未动**（**⑥ 行留痕**）。
> **★ 判据 ① 的现取确认（本册现取 · 追加）**：`backend-ts/.p7b-artifacts/p7b-04-recon2-collect1.json` ⇒ `for_update = { has_for_update: true, pos: 4183, has_for_update_regproc: true, pos_regproc: 4183 }` ⇒ **`position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) = 4183 > 0`**（**判据 ① 已证**；该件为批 7-B 现取产物，非本册计算）。
> **★ 判据 ②③ 的现状 = `NOT_MEASURED`**（**竞争实测需两个会话 + 测试环境**；本册**零库写 / 零 HTTP** ⇒ 归实现批 / 质检批，见 §8.21.2-⑥）。

**★★ §12.11.6 v2.0 就地加注（**AC-11 期望订正〔Zang 自我更正〕+ AC-13⑥ 措辞确认 · 本节 AC-11…AC-13 表与正文一字未动**）**：

> **（v2.0：Zang 自我更正 —— 原写 `409` 作废 ⇒ 正确期望 = `200` + `idempotent_replay:true`）** **★ 旧写法（保留不删 · 逐字）**：**AC-11 行期望列原文**（v1.9 现取 `:3314`）= 「**恰一次生效**：恰一笔 `200`（`purchase_refund ×2`）+ 另一笔 **`409` `LEDGER_CURRENCY_INVALID_TRANSITION`**（`details.field='listing_order.status'`；`reason='order_not_refundable'` ⇒ 驱动相关、`NOT_MEASURED`）**或** `200` + `idempotent_replay:true`（若第二笔落在首笔提交后 ⇒ 只读根键探测命中，`0015:677-678`）」。**同源旧写法（不删、不逐处改）** 亦见 **§12.6 v1.6 加注 `:3082`** / **§12.9 v1.6 加注 `:3128`** / **顶部 v1.6 块 ⑨ `:136`** / **§12.11.7 · Z8 登记行 `:3175`**（均写「另一笔 `409` / `LEDGER_CURRENCY_INVALID_TRANSITION`」）⇒ **一律以本加注为准**。
> **★ 作废（Zang · 逐字）**：**「另一笔 `409 LEDGER_CURRENCY_INVALID_TRANSITION`」这一预期作废**。
> **★ 真因（逐字）**：**退款幂等键由 `order_id` 派生**（`biz:listing:refund:<order_id>`，`0015:667`）⇒ **并发两笔同订单 ⇒ 必同键 ⇒ 第二笔是幂等重放**（`0015:673-676` 只读根键探测命中 ⇒ `v_replay`），**不是状态机拒绝**。
> **★ 正确期望（写死 · 逐字）**：**「另一笔 = `200` + `idempotent_replay:true`（且 `txid` 与首笔逐字相同）」** —— **比 `409` 更好**：不报错、不双扣。
> **★ 实测佐证（本册现取 · 转引）**：`backend-ts/.p7b-artifacts/p7b-07-ac11-collect1.json` ⇒ `criterion_iii_concurrent = { a: { outcome:"ok", result:"applied", idempotent_replay:false, txid:"341" }, b: { outcome:"ok", result:"applied", idempotent_replay:true, txid:"341" } }` + `deltas = { purchase_refund:2, rootkey_rows:2, audit_applied:1, audit_rejected:0, sum_cid1_shift:"0", order_status_after:{status:"refunded", refund_txid:"341"} }` ⇒ **首笔 `applied`（txid `341`）/ 第二笔 `replay`（`txid` **逐字相同** = `341`）**；**资金腿恰一次**（`Δpurchase_refund = +2`，**不是 +4**）+ **审计表 `result='applied'` 恰 1 行** + **`Σ(cid=1)` 零位移** + **订单恰转 `refunded` 一次**（`refund_txid` 恰 1 个）⇒ **AC-11 判据 ①②③④ 与本订正一致**（实测载体 = **DB 函数调用层**：`SELECT public.listing_refund_post_event($1::jsonb)`，两会话并发，转引 `backend-ts/scripts/p7b-07-ac11.ts:27-28,78-79`）。
> **★ 保留（逐字）**：AC-11 判据两条**原样保留** —— **「资金腿恰一次」**（判据 ① `Δpurchase_refund` 恰 `+2`）+ **「审计行恰 1 行」**（判据 ③ `result='applied'` 恰 1 行）。
> **★ 不涉本订正（不变）**：**`AC-11 判负自证` 行（`:3315`）与其 v1.9 可复现三条加注（`:3327–3338`）一字不变** —— 本订正**只改「另一笔」的期望**，**不改判据列、不改判负自证**。
> **★ 产物内部自洽登记（诚实 · 不发明原因）**：`p7b-07-ac11-collect1.json` 自带布尔 `verdict_iii.exactly_one_effective = false`，**与其实测 `deltas`（`rootkey_rows:2` / `audit_applied:1` / `audit_rejected:0` / `sum_cid1_shift:"0"` / `status:"refunded"`）不自洽**（该布尔取自 `backend-ts/scripts/p7b-07-ac11.ts` 的**已改动脚本**；`backend-ts/**` **正被 Kong 并发改写**）⇒ **本册不解释、`NOT_MEASURED` 归因 = `待 Zang 确认`**；**本订正口径只取 `criterion_iii_concurrent` + `deltas` 两组原始读数**（**不采信该派生布尔**）。
> **（v2.0：AC-13⑥ 措辞确认 —— 「路由分支删除」与「`NOT_ADMIN` 常量保留」两句并列）** **★ 确认（Zang · 逐字）**：v1.9 里 **AC-13⑥** 的落法措辞**正确** —— ① **路由分支已删除（本仓禁死代码）**；**且** ② **`NOT_ADMIN` 常量仍保留**（它属**既有 admin 面**的 `reason`、**不在本路由使用**）。
> **★ 两句不矛盾、须并列读（就地补此一句 · 不改小节）**：**删的是「本退款路由内」的不可达死分支**（AC-13⑥ 这一条构造上不可达 ⇒ 禁死代码）；**保的是 `AUTH_REASONS` 闭集常量本身**（`src/index.ts:254`，**3 值**，`NOT_ADMIN` 供**既有 admin 面**使用）。**⇒ 本路由实际只返两 `reason`**：`ACTOR_NOT_ALLOWED`（非卖方非 admin · **AC-13④**）/ `PERMISSION_NOT_GRANTED`（admin 缺 `manage_points` · **AC-13⑤**）。**AC-13 表体一字未动**（**⑥ 行留痕**）。

#### 12.11.7 实现面登记（**归新批 · 本册零代码 · 承 §12.10.2 的 I-1…I-8**）

| # | 交付项 | 前置（本契约条款） | 判据 |
|--:|---|---|---|
| **I-9** | **新迁移 `0024`**（`admin_refund_audit_log` + append-only 触发器 + 索引 + **apply-time 自检**，照抄 `0023`） | Z2 / Z2b / Z3 / 硬约束④ | 迁移 apply-time 自检通过（列集 / 约束 / 触发器启用态 / 键集）；**`0022` / `0023` 的 checksum 不变**（不得改写既有迁移链） |
| **I-10** | **新 DB 编排函数** `public.listing_refund_post_event(jsonb)`（同函数「资金 + 审计」；**复用 `listing_post_event`、不复制资金腿、不改其函数体**；**无 advisory lock**；**无 `RAISE`**） | Z4 / Z4b / Z3① / T-2 | **`position('purchase_refund' IN def) = 0`** 且 **`position('listing_post_event' IN def) <> 0`**（AC-12）；函数体内无 `RAISE`；同键重投 `ON CONFLICT … DO NOTHING` |
| **I-11** | `backend-ts/src/database.ts` 新方法（单语句 `SELECT public.listing_refund_post_event($1::jsonb)`） | I-10 | 单语句（§4.0 R2）；**回执键集**由实现批裁定（**登记**：与 F10 的 `23 键` 关系） |
| **I-12** | `backend-ts/src/listing-funds-service.ts`：`:62` 单点**由权限闸驱动的 actor 分流取代**（**不得与闸并存为第二真源**）+ `:286-294` 准入判据（含**兼买方禁令**）+ 走新编排 | 硬约束③ / Z6 / §12.1 | AC-13 判负用例不得命中；单点常量**不得**成为并行真源 |
| **I-13** | 路由 `src/index.ts:1855` **加 actor 分流闸**（**注册点 68 不变**） | Z1 / Z6 / §12.11.4 | 闸必早于资金调用；401/403 三表 Δ=0；`reason` 值闭集不动 |
| **I-14** | `docs/data-layer.spec.md` 追加登记（`0024` 涉表 / 触发器 / 函数 / 约束） | I-9 | 同批追加（**本批禁改** ⇒ 归实现批） |
| **I-15** | **spec 回写**（§7-32 状态 ⇒ 已落地；§4.2 P4 的 actor 格；§12 状态） | 全部 | 落地后由 Jing 刷新（**本册不预写**） |

## §12.12 ★★ v1.7 · **§12.11.5 三条待确认（T-1 / T-2 / T-3）终审 + 四条附加硬约束逐字落位**（**v1.7 新增 · 本节只追加；§12.0–§12.11 既有正文 / 表格 / 单元格一字未动**）

> **本节性质**：把 **Zang 对 §12.11.5 三条「待确认」的终审** + **四条附加硬约束**（**禁 `WHEN OTHERS` / 注入 `53300`·`XX000` 判负 / 拒收回执与审计行一起提交 / 对外不新增顶层键**）逐字落位成**可实现、可证伪的契约**。**本册只写契约、零代码、零迁移、库面只读**；**实现归新批**。**凡需补细节处，一律先只读取证同族对象（`0023` / `0008` / `0004` / `0015`）再照抄**；**确实无先例者**列 **§12.12.7**；**本册未发明任何规格值**。**★ 与 §12.11.5 的关系**：§12.11.5 的两变体表**保留不删**（历史留痕），**读法以本节为准**。

#### 12.12.1 T-1 终审：审计表 PK 列 = 变体①（**保留 `log_id` 身份证 PK** ⇒ 表 13 列）

| 项 | 终审（逐字） | 依据 / 落点 |
|---|---|---|
| **判定** | **保留 `log_id`**（照抄 `0023:65`）⇒ 表 = **12 语义列 + 1 结构列（共 13 列）** | Zang T-1 终审（**本节**） |
| **列定义** | `log_id bigint GENERATED BY DEFAULT AS IDENTITY` | **照抄锚点 = `0023:65`**（`admin_ops_audit_log.log_id`，身份证 PK） |
| **为何「12 列」不冲突** | **Zang 原话「12 列」指语义列、不含 PK 结构列**（**Zang 认账**）⇒ 与「**列按退款语义、不压缩**」**不矛盾** | Zang T-1 终审 |
| **同构收益** | 与既有 **`admin_ops_audit_log` 同构** ⇒ **将来审计台可统一处理**（§7-53「审计面分裂」的缓解项之一） | Zang T-1 终审；`0023:65`；§7-53 |
| **触发器手法** | **直接照抄** `0023:118` 的 `RAISE EXCEPTION '…', TG_OP, COALESCE(OLD.log_id, 0)` ⇒ **无需**改成「无 `log_id`」的变体 | `0023:114-119`；§12.11.2-C |
| **落点核对（本册现取）** | **§12.11.2-A** 末行结构列 + **§12.11.2-B** 的 `admin_refund_audit_log_pk PRIMARY KEY (log_id)`（照抄 `0023:82`）+ **§12.11.2-E** 列集断言串（**本就以 `log_id` 起首**、共 13 名）⇒ **逐字相符** | §12.11.2-A / B / E（**本单未改一字**） |
| **变体②（不保留）** | **落选**：代价 = 无代理 PK + 触发器须改（`OLD` 无 `log_id`）；**保留不删**（§12.11.5 表原文） | §12.11.5 · T-1 变体② |

#### 12.12.2 T-2 终审：拒绝留痕的捕获机制 = 变体①（**子事务 + `EXCEPTION WHEN SQLSTATE 'LD011'`**）

| 项 | 终审（逐字） | 依据 / 落点 |
|---|---|---|
| **判定** | **`BEGIN … EXCEPTION WHEN SQLSTATE '<状态机拒绝码，即 LD011 一族>' THEN … END` 捕获** ⇒ 写 `result='rejected_state'` 审计行 ⇒ 返回拒收回执（**路由映射 409**） | Zang T-2 终审 |
| **现成先例** | **`0008:87/98/103`**（`EXCEPTION WHEN SQLSTATE 'LD021' THEN …`）；另 **`0004:1048`** / **`0005:1318`** 的 `EXCEPTION` 块 | 本册现取（`0008_*.sql` / `0004` / `0005`） |
| **为何变体②否决** | 变体②（编排函数内**预读 `listing_order.status`** 复制状态守卫）造 **第二真源**（守卫同时在 `0015:682-686` 与编排函数内**两处并存**）⇒ **直接违反 Z4**（防双真源） | Zang T-2 终审；Z4 硬约束；§12.11.5 |
| **白名单（见 §12.12.3-①）** | 只捕 **`SQLSTATE = 'LD011'` ∧ `reason ∈ {order_not_refundable, order_pay_missing}`** | `0015:683-685` / `0015:688-690`（本册现取） |
| **与 Z3① 的关系** | Z3① 的「**函数不得 `RAISE`**」= **函数自身不得主动抛**；**捕获被调方的 `LD011`** 与此**不冲突**（捕获后**正常返回**回执 ⇒ 同函数内审计行**不被回滚**） | Z3①；§12.4 · H9 |

#### 12.12.3 ★ 附加硬约束①②③（**逐字**）

**① 白名单式捕获（**严禁 `WHEN OTHERS`**）**

- **只捕「明确列举」的状态机拒绝码**：`order_not_refundable` ⇒ **`LD011`**（`0015:683-685`）；**`order_pay_missing` 若同码则按 `reason` 区分**（**本册现取 = 确系同码**：`0015:688-690` 亦 `LEDGER_CURRENCY_INVALID_TRANSITION` = `LD011`，`reason='order_pay_missing'`）⇒ **白名单 = 「`SQLSTATE = 'LD011'` ∧ `reason ∈ {order_not_refundable, order_pay_missing}`」**。
- **`reason` 的读取手法（照抄先例，不新造）**：`ledger_raise` 的 `DETAIL` 承载 `reason`（`0004:148` `DETAIL = COALESCE(p_details, '{}'::jsonb)::text`）⇒ 读取照抄 **`0004:1094`**（`GET STACKED DIAGNOSTICS … v_detail = PG_EXCEPTION_DETAIL`）/ **`0008:88`**（`RETURNED_SQLSTATE, MESSAGE_TEXT`）先例。（**本册零库写** ⇒ 现状读数 = `NOT_MEASURED`。）
- **★ 严禁 `WHEN OTHERS`** —— **理由逐字**：**否则基础设施错误（`53300` / `XX000` 一类）会被吞成「被拒」**，正是本仓 **D-04 / 真库「假成功」**那类真缺陷。
- **依据锚点（本册现取）**：`53300` ⇒ `src/ledger-errors.ts:338`（`INFRA_SQLSTATE_REASONS`，`too_many_connections`）⇒ 既有分类器归 **`LEDGER_TX_TIMEOUT`（503）**（`:60`）；`XX*`（内部错误）在 `src/ledger-errors.ts:331-333` 的**同集同码**桶（`53*` / `58*` / `XX*`；另 `57*` 除 `57014` / `08*` 除 `08P01` + `25006` / `3D000`）⇒ 亦 **503**。
- **★ 必须配可证伪判负用例（逐字入 AC）= §12.12.6 · AC-14**：**注入 `53300` / `XX000` ⇒ `result` 不得为 `rejected_state`，必须向上抛、由既有分类器映射 503**。

**② 拒收回执与审计行一起提交（**零资金残留**）**

- 捕获后**同一函数内**写审计行 + 返回回执 ⇒ **拒收回执与审计行一起提交**（同函数、同一次 DB 调用 = 一个隐式事务；与 §12.11.3「资金 + 审计同一次 DB 调用」同源）。
- **资金腿因子事务回滚而「不留分录」（零资金残留）**：子事务 = `BEGIN … EXCEPTION … END` ⇒ `listing_post_event` 内已写的两条 `purchase_refund`（`0015:718-724`）随子事务回滚；`ledger_entry` 该 `event_root_key` 无残留。

**③ 子事务回滚不得波及其他已写对象**

- **审计行的 `INSERT` 必须落在 `EXCEPTION` 处理器内**（即失败子事务**之外**）⇒ 子事务回滚**不得**波及该审计行与块外任何已写对象。
- **依据**：PostgreSQL 中 `BEGIN … EXCEPTION … END` 即一个**子事务**（savepoint）；异常路径的回滚**仅**覆盖块内 ⇒ 处理器内写入**存活**、块外写入**不受影响**（**契约判据**；现状读数 = `NOT_MEASURED`）。
- **判负（写入 AC-15）**：若审计行 `INSERT` 落在 `BEGIN` 块**内** ⇒ `LD011` 抛出时子事务回滚会把审计行一并撤销 ⇒ `result='rejected_state'` 行 = **0** ⇒ **判负**。

#### 12.12.4 T-3 终审：404 不留痕（**射程写死**）

| 面 | 判定 | 依据 / 现取锚点 |
|---|---|---|
| **留痕面** | **「已进入资金编排且被状态机拒绝（409）」** ⇒ 写 `result='rejected_state'` | Zang T-3 终审；§12.4 · H6 |
| **不留痕面** | **401 / 403（权限闸前）+ 404（存在性前置闸）+ 400（形状 / 参数非法）** | **与 Z5 同源**（§12.3 加注 / §7-55） |
| **H6 读法** | 「**已经进入资金编排**」**读作「函数体内、资金腿之前的状态机拒绝」**（**不是**「`listing_post_event` 已被调用」的存在性面） | Zang T-3 终审 |
| **404 的码** | **`LEDGER_REF_NOT_FOUND`（`LD022`）**：现取 `0004:108`；两处借它 = `0015:663-665`（`v_order_id < 1`）/ `0015:671-673`（`NOT FOUND`）⇒ **保持既有传播、不留痕** | 本册现取；§12.11.4 |
| **变体②（404 留痕）** | **落选**（代价 = 须**另捕 `LD022`** ⇒ 捕获面扩大；**保留不删**） | §12.11.5 表原文 |

#### 12.12.5 回执键集裁定（**两级口径 · Zang 裁定**）

| # | 条款（逐字） | 现取锚点 |
|--:|---|---|
| ① | **编排函数「内部」回执必须含** `result`（`applied` 或 `rejected_state`）/ `txid`（**拒绝时 `null`**）/ `audit_logged` | §12.11.3 回执形状（照抄 `0023:146-149` 形态） |
| ② | **对外一律走既有 `sendSuccess` / `ledgerErrorBody` 口径；不得新增对外顶层键**（**除既有 `extra` 机制**） | `sendSuccess` = `src/index.ts:98`（`(res, data?, message='OK', statusCode=200, extra?)`）；`ledgerErrorBody` = `src/job-service.ts:21`（R107 `{error:{code,message,i18n_key,details}}`）；`extra` = `src/listing-funds-service.ts:80-85`（`...extra` 展开进 `details`） |
| ③ | **与 F10 的 `23 键` 回执的关系 = 两层**（内部编排回执 vs 对外路由回执）⇒ **禁止把 23 键回执原样透传给前端** | F10 = §12.2 回执键集（23 键，`p4-b4a §3` **转引**）；§2.4 前端同步面（`S1`–`S10`） |
| **收口** | **§12.11.3 末条「具体键集归实现批」与 §12.11.7 · I-11 的登记由此收口** | §12.11.3 / §12.11.7（**本单未改该两处一字**） |
| **判负** | 若响应出现**新顶层键** / **新错误码** / **第 4 个 `AUTH_*` `reason` 值** ⇒ **判负** | 与 **AC-10** 同源（§12.8）；`src/index.ts:254`（`reason` 闭集 = 3 值） |

#### 12.12.6 ★ 新增可证伪 AC（**AC-14 / AC-15**；编号接续 AC-13，与 §12.11.6 并读）

> **执行口径**：本册**零 HTTP、零库写** ⇒ 下表为**契约判据**（不是本册实测）；**执行归实现批 / 质检批**。**夹具前置同 §12.11.6**（可退门面 `order_id 3`；**不得为测试修改真库既有行**；**自建夹具 uid ≥ 900000**）。**★ 注入法**：AC-14 的 `53300` / `XX000` 注入须在**测试环境**内构造（**不得**改真库既有对象）；**本册不指定注入载体**（⇒ 归实现批 / 质检批，见 §12.12.7 · I-18）。

| # | 场景 | 期望（码 / 状态） | 判据（可复算） | 依据 |
|--:|---|---|---|---|
| **AC-14** | **★ 判负：白名单捕获（禁 `WHEN OTHERS`）** —— 注入 `53300`（`too_many_connections`）/ `XX000`（内部错误） | **`503` `LEDGER_TX_TIMEOUT`**（既有分类器口径）；**绝不得** `409` / `rejected_state` | ① **`result` 不得为 `rejected_state`**（审计表该 `order_id` 的 `rejected_state` 行 **Δ = 0**）；② **必须向上抛**（`Δledger_entry = 0`；`listing_order.status` 不变；无审计行 ⇒ 零资金 + 零痕迹）；③ **静态判据** = `position('WHEN OTHERS' IN pg_get_functiondef('public.listing_refund_post_event(jsonb)'::regprocedure)) = 0`；**任一不满足 ⇒ 判负**（该实现判负，非「用例失败」） | Zang 附加硬约束①（**逐字**）；`src/ledger-errors.ts:338`（`53300`）/ `:331-333`（`53*`/`58*`/`XX*` 桶）/ `:60`（`LEDGER_TX_TIMEOUT` = 503） |
| **AC-15** | **★ 拒绝面：零资金残留 + 同提交 + 子事务不波及其他对象** —— 对**非 `paid` 订单**（如已 `refunded`）发起退款（单发，非并发） | **`409` `LEDGER_CURRENCY_INVALID_TRANSITION`**（`details.field='listing_order.status'`；`reason='order_not_refundable'` ⇒ **驱动相关、`NOT_MEASURED`**）**且**审计表该 `order_id` 的 `result='rejected_state'` 行**恰 1** | ① `Δpurchase_refund = 0`（**零资金残留**）；② 审计表该 `order_id` 的 `rejected_state` 行 **Δ = +1**（**拒收回执与审计行一起提交**）；③ `txid` 列 = **`NULL`**（拒绝行）；④ `listing_order.status` 不变、`refund_txid` 不变；⑤ **子事务不波及其他对象**：审计行在场（**若实现把 `INSERT` 放进 `BEGIN` 块内 ⇒ 该行 Δ = 0 ⇒ 判负**）；**判据 ⑤ 不满足 ⇒ 判负** | Zang 附加硬约束②③（**逐字**）；`0015:682-686`（状态机闸）/ `0015:677-678`（幂等探测）；§12.11.2（`result` 闭集 / `txid` 可空） |

**★ 未测项**：**AC-14 / AC-15 的现状读数一律 `NOT_MEASURED`**（能力未实现 + 本册零 HTTP / 零库写）—— **不得**把上表期望值当实测（口径同 §12.8 / §12.11.6 尾注）。

#### 12.12.7 待 Zang 确认与实现面登记补充

- **待 Zang 确认（**本册不自行二选一**）**：**无新增条目** —— 本单为 **§12.11.5 三条终审的逐字落位**，**裁定已给全**；**唯一未指定细节** = **AC-14 的 `53300` / `XX000` 注入载体**（本册**未指定**注入方式 / 端点 / 探针形态 —— 属**测试实现细节**、**不得**由规格发明）⇒ **登记归实现批 / 质检批**（与 §12.11.6「AC-11 判负自证不得在本批做」同处置）。
- **实现面登记补充（承 §12.11.7 · I-9…I-15）**：

| # | 交付项 | 前置（本契约条款） | 判据 |
|--:|---|---|---|
| **I-16** | **`0024` 的 apply-time 自检增补**：编排函数体内 **`position('WHEN OTHERS' IN def) = 0`**（**禁 `WHEN OTHERS`**）+ **`position('EXCEPTION' IN def) <> 0`**（须有捕获块）+ 白名单 `LD011` 在场 | 附加硬约束①；§12.11.2-E / §12.11.4（硬约束④） | 自检断言逐条通过；**失败整体回滚**（沿用 `DL48`） |
| **I-17** | **编排函数内部回执**含 `result` / `txid`（拒绝 `null`）/ `audit_logged`；**对外零新增顶层键**（走 `sendSuccess` / `ledgerErrorBody` + 既有 `extra`） | §12.12.5；Zang 回执键集裁定 | AC-10 判负不得命中；**响应无新顶层键 / 无新错误码 / 无第 4 个 `AUTH_*` `reason`** |
| **I-18** | **AC-14 / AC-15 的注入夹具与执行**（`53300` / `XX000` 注入载体） | 附加硬约束①；§12.12.6 | 归实现批 / 质检批（**本册不指定载体**） |


## §12.13 ★ v1.9 · 迁移 `0024` 已 apply 事实（**v1.9 新增 · 本节只追加 · 依据 = 批 7-B 后端退款单现取产物**）

> **本节性质**：把**管理员退款契约（§12）**落地为**已 apply 的迁移 `0024`** 所产生的**事实**逐条登记（**本册只读取证、零库写**）。**真源 = 本册现取**（`backend-ts/.p7b-artifacts/p7b-00-recon-*.json` 两次现取 + `backend-ts/migrations/0024_admin_refund_audit.sql`）。**本单未发明任何规格值**。

| # | 事实 | 现取读数 | 现取锚点 |
|--:|---|---|---|
| **F-0024-1** | **迁移 `0024` 已 apply** | `schema_version = 0024`（`schema_migration` 行含 `0024_admin_refund_audit.sql`，`applied_at = 2026-10-02T08:01:41.542Z`） | `p7b-00-recon-20261002T080201Zmk5d.json`（本册现取） |
| **F-0024-2** | **checksum** | **`b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d`** | 同上 + `shasum -a 256 backend-ts/migrations/0024_admin_refund_audit.sql`（本册现取，**逐字相符**） |
| **F-0024-3** | **审计表 `admin_refund_audit_log` 在场**（Z2 = 变体 B · §12.11.2） | recon（改前 `T075406Z0yd6`）= `audit_tables_present: null` ⇒ recon（改后 `T080201Zmk5d`）= `"admin_refund_audit_log"` | 同上两件（改前 vs 改后） |
| **F-0024-4** | **编排函数 `listing_refund_post_event` 在场**（Z4 · §12.11.3）；**`post_event_functions` 5 → 6** | 改前 = `[admin_points_adjust_post_event, job_post_event, ledger_post_event, listing_post_event, market_post_event]`（**5**）⇒ 改后 = 同列 **+ `listing_refund_post_event`**（**6**） | 同上两件 |
| **F-0024-5** | **触发器数 44 → 45** | 改前 `structure.triggers = "44"` ⇒ 改后 `"45"`（**+1** = `admin_refund_audit_log` 的 append-only 触发器） | 同上两件 |
| **F-0024-6** | **`Σbalance(cid=1)` 零位移**（不造币 / 不残留） | 改前 / 改后**逐字相同**：`sum_balance = "1989693"`、`sum_frozen = "10507"`、`rows = "18"` | 同上两件 |
| **F-0024-7** | **注册点仍 68**（Z6 复用同路径 · §12.11.4） | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` = **68**（本册现取） | 本册现取（承 §1.14） |
| **F-0024-8** | **前端零改动**（Z6 · `POST /api/listing-orders/:orderId/refund` 复用同路径） | 本单**未改前端**；端点路径正典 §7-37 不变 | Z6 终审（§12.7）/ §12.11.4 |

> **★ 只是事实行（不构成新契约）**：上列 8 条**替代** §12.11.7 · I-9 / I-10 / I-13 的「**待实现**」态 —— 迁移 `0024` 与编排函数 `listing_refund_post_event` **已落地**；**实现面登记（I-9…I-18）的其余项（服务层 `:62` 分流 / 路由闸分流 / 数据层 spec 登记）落地与否 = `NOT_MEASURED`**（**本册未取该面读数**，**不填 0 / 不填「已完成」**）。
> **★ 未测项（`NOT_MEASURED` + 原因 · 禁填 0 / 空）**：① **`0024` apply 后的 HTTP 行为面** —— 本册**零 HTTP**；② **服务层 `listing-funds-service.ts:62` 单点是否已升级（卖方 ∨ 管理员）** —— 本册**未改、未测代码**，`backend-ts/**` 正被并发单元改写；③ **`docs/data-layer.spec.md` 是否已登记 `0024` 涉表** —— 本册**禁改**该件、**未读改**。
> **★ F-0024-9（追加 · 本册现取）**：**迁移链 `0001–0024` 重跑 = 幂等**（不重复 apply）—— `backend-ts/.p7b-artifacts/p7b-ac04-migrate-idempotent-ac04.json` ⇒ `ok = true`，`0024` 条目 = `{ action: "skipped", reason: "already applied, checksum match" }`（`0022` / `0023` 同形）⇒ **`0024` 的 apply 是幂等的、checksum 未漂移**（**佐证 F-0024-1 / F-0024-2**）。

## §13 脚本类硬门口径（**v1.8 新增 · 本节只追加 · 依据 = Zang §5.162 A·R-3① / D②**）

> **性质**：**新纪律**（不是实现项）。自 v1.8 起，**凡新增 / 改动 `backend-ts/scripts/**` 的脚本，硬门必须跑到「脚本面」**。依据 = `docs/seafood.master-plan.md:1424`（A · R-3①：「`tsc -p tsconfig.scripts.json` 全量 **86→77**，sorted diff 仅 9 行删除、零新增 ⇒ **「新增零错」成立**；余 22 文件 77 条**登记为既有债**」）+ `:1443`（D② 派单逐字）。**本册不转抄该读数** —— 下方 `77 / 22` = **本册现取**（§13.3）。

### 13.1 缺口的成因（现取 · 写死）

| # | 事实 | 现取锚点（**本册亲跑**） |
|--:|---|---|
| ① | **`npx tsc --noEmit` 不覆盖 `scripts/**`** —— `backend-ts/tsconfig.json` 的 `include` **只有** `src/**/*` | `backend-ts/tsconfig.json`（**本册现取**：`"include": ["src/**/*"]`、`"exclude": ["node_modules","dist"]`） |
| ② | ⇒ **脚本里的类型错误对既有硬门结构上不可见** | 由 ① 推出（`tsc --noEmit` 的输入文件集不含 `scripts/**`） |
| ③ | **必须新增第二条命令**：`npx tsc -p tsconfig.scripts.json --noEmit` | `backend-ts/tsconfig.scripts.json` **在场**（**本册现取**：`extends ./tsconfig.json` + `include: ["scripts/**/*"]` + `noEmit: true`） |

### 13.2 口径（写死 · 可判负）

- **① 判据 = 「新增零错」（不是「全量零错」）**：改后 `npx tsc -p tsconfig.scripts.json --noEmit` 的报错集，与**改前基线**做 **sorted diff** ⇒ **新增行必须 = 0**（既有行可原样保留）。先例读数（**转引**）= 收口四 R-3① 的「**86 → 77**、sorted diff 仅 **9 行删除、零新增**」。
- **② 存量债 = 既有基线、本批不修**：**22 文件 / 77 条**（§13.3 本册现取）⇒ **逐条登记为既有债**（§7-60）；**任何脚本改动都不得把该数字推高**（**推高 ⇒ 判负**）。
- **③ ★ 旧读数作废声明（必写 · 逐字）**：**「此前所有『`tsc` 0』读数对脚本改动无效」**。理由 = 那些读数测的命令面（`tsc --noEmit`）**结构上不含 `scripts/**`** ⇒ 对脚本改动**零覆盖**（读旧册里「`tsc` 0」时，**必须先确认它测的命令面**）。
- **④ 命令（逐字 · 退出码一律不取管道之后）**：
  - `cd backend-ts && npx tsc -p tsconfig.scripts.json --noEmit`
  - 计数：`npx tsc -p tsconfig.scripts.json --noEmit 2>&1 | grep -cE 'error TS'`
  - 文件数：`npx tsc -p tsconfig.scripts.json --noEmit 2>&1 | grep -oE '^[^(]+\.ts' | sort -u | wc -l`
- **⑤ 适用范围**：**新增脚本 / 改动既有脚本 / 改动 `tsconfig.scripts.json`** 三种改动**一律**触发本条；**纯 `src/**` 改动**不受影响（仍走 `tsc --noEmit`）。

### 13.3 存量债（**本册现取** · 逐条登记为既有债 · 本批不修一条）

| 项 | 命令（逐字） | **本册现取** | 转引（收口四 R-3①） |
|---|---|---|---|
| 报错条数 | `npx tsc -p tsconfig.scripts.json --noEmit 2>&1 \| grep -cE 'error TS'` | **77** | 77 ✓（改前 86） |
| 涉及文件数 | 同上输出 `grep -oE '^[^(]+\.ts' \| sort -u \| wc -l` | **22** | 22 ✓ |
| 报错形态举例（**样本，非全量清单**） | 同上输出 | `scripts/qa-p1e-01-concurrency.ts(97,47)` **TS2322**（`bigint` 不可赋给 `string \| number`，×4 处）；`scripts/qa-p1e-05-neon-ab.ts(15,10)` **TS2724**（`'./qa-p1e-lib'` 无导出成员 `accountOf`，疑为 `accountsOf`） | —（R-3① 只给计数） |

> **★ 与「77 条」的关系（写死）**：**22 / 77 = 本册现取、逐 verb 无涉**；**逐条文件名 × 行号的完整枚举 = `NOT_MEASURED`**（§8.20.2-⑤）—— 本表只给**计数 + 两个样本**，**不冒充全量清单**。
> **★ 已知收口面（转引）**：收口四 R-3① 已把 `scripts/p7a-01-http.ts` 的 **TS18046 9→0** ⇒ **该面不在 77 条内**（**不得**把 9 再加回去）。

### 13.4 与既有硬门口径的关系（写死 · 防误读）

- **`tsc --noEmit`（`src` 面）= 仍有效**：本条**不改**它；只**补**一条脚本面命令。
- **「硬门全绿」的完整表述** = **`npx tsc --noEmit` 0** ∧ **`npx tsc -p tsconfig.scripts.json --noEmit` 新增 0**。**只说前半句 ⇒ 对脚本改动不成立**（§13.2-③）。

## §14 前端两条纪律与登记（**v1.8 新增 · 本节只追加 · 依据 = Zang §5.162 A·R-1 / R-4 / D③**）

### 14.1 (a) **错误文案必须过全站统一链路 `apiErrorMessage`**（**已立为可判负的门**）

**★ 纪律（写死）**：**凡把错误转换成「给用户看的文案」的代码，一律必须走全站统一链路 `apiErrorMessage`** —— **不得**自造错误串、**不得**直拼 `data.message` / `data.error`（后者可能是**对象** ⇒ 出 `[object Object]`）。

**★ 链路真源（本册现取）**：`frontend/src/auth.js:177-187`（`export const apiErrorMessage = async (payload, status) => { … }`）。**优先级（源码注释逐字）** = ① **`error.i18n_key`**（`R107` 契约键）② 服务端原文映射表 ③ `extractApiErrorMessage` 兜底（未登记错误 ⇒ 原样服务端文案；连文案都没有 ⇒ **`auth.err.REQUEST_FAILED` 四语兜底**，i18n 不可用时为 ASCII 的 `Request failed (status)`）。

**★ 两处消费（本册现取）**：`frontend/src/auth.js:190`（`fetchApiJson` 的 `!response.ok || !payload?.success` 分支 ⇒ `throw new Error(await apiErrorMessage(payload, response.status))`）/ `frontend/src/ledger-api.js:49`（`fetchMyLedger` 同形 ⇒ **收口四 R-1 把账本读口并入同链**）。

**★ 已立为可判负的门（本册现取）**：`frontend/scripts/p7a-03-errmessage-gate.mjs`（**144 行**）——

| 门构件 | 现取读数 / 内容 |
|---|---|
| **类级扫描** | 扫 `frontend/src/**` 的 `.js/.jsx`（**排除 `test/`**）；受体正则 = `^\s*(?:const\|let\|var)\s+(\w+)\s*=\s*await\s+[^\n]*?\.json\s*\(\s*\)`；命中面 = 受体后读 `.error.message` / `.message` |
| **唯一出口豁免（逐条列名，不得通配）** | `CHAIN_IMPL = [['auth.js', '错误文案链实现本体…本文件即全站唯一出口']]` |
| **基线 = 3 条存量登记** | `components/ActiveTaskModal.jsx` / `components/ClaimRewardModal.jsx` / `pages/TaskPage.jsx`（**逐条带理由**；**未登记命中 ⇒ `VERDICT=FAIL`（退出码 1）**） |
| **仓外镜像判负** | 门接受**首个位置参数当扫描根**（`process.argv[2]` ⇒ `SRC`）⇒ **可给参对仓外镜像判负**（源码注释逐字：报告 §4 的判负自证即用此形，**零仓内污染**） |
| **作用域读数（防「空断言」）** | 打印**扫描文件数 / 受体数 / 命中数 / 基线项数**；**命中 0 或受体 0 ⇒ 断言无效** |

**★ 判负自证（转引 · 本册不跑前端套件 ⇒ `NOT_MEASURED`，见 §8.20.2-④）**：收口四 R-4 的类级门在**仓外镜像**注入 1 处真违例 ⇒ `EXIT=1 / FAIL（未登记命中 1）`，去注入 ⇒ PASS（`docs/seafood.master-plan.md:1426`）。
**★ 附带登记（本册现取）**：判负单测 = `frontend/src/test/unit/p7a-ledger-error-i18n.test.js`（**真 auth 链 + 真 i18n + 真 zh 查表**；转引 R-4 的「6 例」）；**基线 3 条 = 存量债**，**本单不修**。

### 14.2 (b) **两套取数入口并存** ⇒ 登记为 **P6/P7 统一时合并**的待办

**★ 事实（写死）**：前端现有**两套**取数入口：

| # | 入口 | 形态 | 关键差异 |
|--:|---|---|---|
| **①** | `frontend/src/auth.js:190` **`fetchApiJson`** | `fetch` → `response.json()` → `!ok \|\| !success` ⇒ 抛 `apiErrorMessage`；**返回 `payload.data`** | **契约一字未动**（收口四 R-1 逐字）⇒ **丢弃顶层 `next_before_txid`** |
| **②** | `frontend/src/ledger-api.js:32` **`fetchMyLedger`** | `fetch('/api/user/ledger?…')` → 原始响应 ⇒ **同时取 `data` + 顶层游标**（`:53` `payload.next_before_txid`） | **另立**（55 行）；**为取游标而绕过 `fetchApiJson`**；错误分支**复用同链** `apiErrorMessage`（`:49`）；**`getAuthToken` 前置**（无 token ⇒ 抛本地化 `auth.err.NO_CREDENTIAL`、**零请求**） |

**★ 终审（写死 · 不二选一）**：**路径②已终审选定**（⇒ 账本读口**另立** `ledger-api.js`）；**路径①（改全站共用件 `fetchApiJson` 加游标支持）被否决**。依据 = `docs/seafood.master-plan.md:1422` 逐字「`fetchApiJson` 契约**一字未动**（**路径②**）」。

**★ 登记（待办）**：**两入口合并 ⇒ `P6/P7` 取数入口统一时处理**（**本单不合并、不扩面**）⇒ **§7-59**。**判据（写死）**：**合并前**，任何新读口若需**顶层游标 / 顶层非 `data` 键** ⇒ **照 ② 的形态另立**（**不得**为它改 ① 的契约）；**合并后**此条作废（由 P6/P7 统一票决定形态）。

### 14.3 ★ (c) **回退护栏（`ledger.err.*`）纪律 + 132 键登记**（**v1.9 新增 · 本节只追加 · 依据 = 批 7-B 前端单现取**）

**★ 新纪律（逐字 · 写死）**：**错误文案链必须保证：`t(i18n_key)` 未命中（返回裸键形态）时落四语通用兜底；用户可见文案不得出现 `x.y.z` 类裸键。**

**★ 真源（本册现取）**：`frontend/src/auth.js` —— `resolveI18nMessage`（末道闸 · 四跳候选链：① `t(i18n_key)` 可用 ⇒ 用真文案 → ② 服务端原文 → ③ 四语通用兜底 `auth.err.REQUEST_FAILED` → ④ ASCII `Request failed (status)`）+ `isUsableText`（准入闸：非空 ∧ ≠所查键名 ∧ **不含裸键 token**）+ `looksLikeBareI18nKey` / `containsBareI18nKey`（**整串 / token 判据 · 具名导出**）。

| 项 | 现取读数 / 内容 | 锚点 |
|---|---|---|
| **可判负门** | `frontend/scripts/p7b-errfallback-gate.mjs`（**A 护栏在场 / B locale 文案面 / C 兜底键四语齐备 / D 33 码 × 4 语行为节点 / E 判据自证**；**只读**） | 本册现取 |
| **门读数（转引）** | `总判：PASS（A=PASS / B 含裸键值=0 / C 兜底键=2×4 / D 节点=132 需护栏=132 已本地化=0 / E 样本=17）` | `docs/audit/p7-b-errfallback.md §4 G8`（**转引**） |
| **132 键 = 33 码 × 4 语** | 键名 `ledger.err.<CODE>`；`<CODE>` 真源 = `backend-ts/src/ledger-errors.ts` 的 `LEDGER_ERROR_TABLE`（**33 键关闭集**）；四语 = `zh / hk / en / vn` | 本册现取（门 D 段：`节点=132`；`需护栏=132 / 已本地化=0`） |
| **登记（产品/文案决策）** | **132 键逐码本地化 = 产品/文案决策 ⇒ 登记 P6/P7 待定**（**本单不补**；今日 **132/132 全依赖护栏**） | 批 7-B 裁定④（**转引**） |
| **护栏让位语义（写死）** | 任何 (码, 语) 一旦在 locale 里补上 `ledger.err.<CODE>` 真文案 ⇒ `resolveI18nMessage` ① 行 `t()` **命中即用真文案** ⇒ **护栏自动让位、无需改代码**；门 D 段把它从「需护栏」改读为「**已本地化登记**」而**不判负**（门不红，只读数变化） | 批 7-B §6-②（**转引**） |
| **既有面回归不受影响** | 未本地化键 + 真人可读 `message` ⇒ **保留服务端原文**（既有 `auth.test.js` S6 语义）；**② 先于 ③** 的理由 = 否则 S6 从「保留服务端文案」退化为通用兜底 ⇒ 既有验收面回归 | 批 7-B §2（**转引**） |

> **★ 与 §14.1 的关系（写死）**：**§14.1(a)**（错误文案必须过 `apiErrorMessage`）与本条 **(c)** 同属**错误文案链**：**§14.1 = 入口唯一**（不得自造错误串）、**本条 = 出口兜底**（**裸键不得出用户**）。**两者叠加 ⇒ 用户可见文案既不为裸键、也不为 `[object Object]`**（§14.1 附带收口：`extractApiErrorMessage` 的 `error.code` 不再当服务端文案）。
> **★ 两套取数入口登记补充（承 §14.2）**：本条护栏**不改** §14.2「两入口并存」事实 —— **`ledger-api.js` 错误分支已复用** `apiErrorMessage`（`:49`）⇒ **护栏对两入口同时生效**；**合并仍归 P6/P7**（§7-59）。
> **★ 未测项（`NOT_MEASURED` + 原因）**：本册**不跑前端套件**（只读源码取真源行号）⇒ **门的当日判负实跑读数转引**批 7-B §4/§5（**不转引冒充实测**）。

> **★★ §14.3 v2.1 就地加注（批 7-C / 批 7-D 成果回写：文案链**四跳**定式 + **机读码判据** + **33 码已本地化**；**本节正文与表格一字未动，旧读数保留为历史留痕**）**：
>
> **① 四跳候选链（写死）**：`resolveI18nMessage`（`frontend/src/auth.js` **现取 `:256-279`**）按序取第一个**可用**候选 —— **① `t(i18n_key)`**（`:270-272`）→ **② 服务端原文 `message`**（`:274-275`）→ **③ 四语通用兜底 `auth.err.REQUEST_FAILED`**（`:277-278`）→ **④ ASCII 兜底 `Request failed (status)`**（`:279`）；**每一跳都要过准入闸 `isUsableText`**（`:235-240` = 非空 ∧ ≠所查键名 ∧ 不含裸键 token）。**与 v1.9 本节所载链同形**（v1.9 引 `auth.js:177-187` = **旧时点行号**）⇒ **以本节现取行号为准**。
>
> **② 机读码判据（写死 · 可判负 · 批 7-C / 批 7-D）**：**服务端 `message` 与 `details.reason` 命中「全大写下划线机读码」⇒ 视为不可用**（⇒ 链下沉到 ③ / 或**不附加 `(reason)` 后缀**）。
> - 判据（两个正则 · 逐字）= `MACHINE_CODE_RE = /^(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}$/`（整串即码）与 `MACHINE_CODE_TOKEN_RE`（文案中**出现**码 token；边界集与 `BARE_I18N_KEY_TOKEN_RE` **逐字同一集**、**不含 `.`**）—— 真源 `frontend/src/auth.js:155-156`；谓词 = `looksLikeMachineCode`（`:159-161`）/ `containsMachineCode`（`:164-166`）。
> - 落点（`message` 面 · **批 7-C**）= `extractApiErrorMessage` **三处**收口：对象面 `error.message`（`:179`）/ 旧字符串面 `error`（`:192`）/ 顶层 `payload.message`（`:193`）。
> - 落点（`details.reason` 面 · **批 7-D · R1′**）= `:187` `const suffix = reason && !containsMachineCode(reason) ? \` (${reason})\` : ''`（**复用同一判据、禁另写正则**）；**未命中（真人串如 `too_many_connections`）⇒ 仍保留后缀**（**O-1 边界不回归**）。
> - **F-1 真体**：退款拒收回执 `message = 'LEDGER_CURRENCY_INVALID_TRANSITION'` + `details.reason='order_not_refundable'` ⇒ **改前**四语用户可见串 = 英文机读码 `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`（**缺陷**）；**改后** = 该语通用兜底（`docs/audit/p7-c-errmsg-scope.md §1/§3`，**转引**）。
>
> **③ 33 码已逐码本地化（写死 · 批 7-D）**：`ledger.err.<CODE>` 四语键**已建齐** ⇒ **① 行 `t(i18n_key)` 命中** ⇒ **本节「护栏让位」语义正式生效**（承本节「护栏让位语义（写死）」行）。**本册现取复核**：`frontend/src/locales/{zh,en,hk,vn}.json` **每语 `ledger.err.*` = 33 键**、**拍平 `flat = 737`**（四语**同值**、**键集完全相等**）。**门读数（转引 `docs/seafood.master-plan.md §5.171 A`）**：`p7b-errfallback-gate` = 「D 节点=132 **需护栏 0**（**改前 132**）/ **已本地化 132**（**改前 0**）」；`p7a-03-errmessage-gate` = 「**命中 0 / 基线 0**」（**改前基线 3 ⇒ 归零**）；`p7c-errmsg-machinecode-gate` = 「D 0/16、F 0/16、**G 机读码出现次数 = 0/36 违例 = 0**」。⇒ **本节表内 v1.9 旧读数（`需护栏=132 / 已本地化=0`）读法更新**（**旧文保留不删**）；**两口径分标**：**33 = 每语键数**、**132 = 33 码 × 4 语的「需护栏节点数」**（承 §5.171 B · D-1）。
>
> **④ 本册口径（不冒充）**：本册**不跑前端套件 / 不跑门** ⇒ 门读数**转引** §5.171 A；**33 码 × 4 语的语言质量逐条审 = `NOT_MEASURED`**（转引 Zang 亲审结论，见 §16.3 / §8.23.2-②）。**明细与登记 = §16**。

## §15 错误形状口径：同一端点内 400 类只许一种形状（R107）（**v1.8 新增 · 本节只追加 · 依据 = Zang §5.162 C**）

### 15.1 口径（写死 · 可判负）

| # | 条款（**逐字**） | 依据 / 现取锚点 |
|--:|---|---|
| ① | **同一端点内 400 类必须只有一种形状（`R107`）** —— **不得**一个端点内并存「`R107` 形状」与「旧形状」两套 400 面 | `docs/seafood.master-plan.md:1439`（Zang §5.162 C）；L7④ 真发现 `:1436` |
| ② | **形状非法 ⇒ `400` + 既有码 + `details.field` / `details.reason`**（**不新增码**） | `docs/seafood.master-plan.md:1439`（Zang §5.162 C）+ **§5.16 裁定**（`:383` 逐字：「**形状非法**（非十进制整数 / 空 / 超 `bigint` / 缺失）⇒ **400** `LEDGER_AMOUNT_INVALID` + `details.reason ∈ {NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}` + `details.field`；… **不新增错误码**（关闭集不变）」） |
| ③ | **旧 `sendError` 形态** `{success:false,message,error}` **判为非 `R107`** ⇒ **在同一端点内出现即判负** | `docs/seafood.master-plan.md:1436`（L7④：`kind` 非法走 `sendVerbError` ⇒ **R107**；`cid` / `before_txid` 非法走 `sendError` ⇒ **旧形状 · 非 R107**）+ 本册 §3.3-1（统一错误体 `{ error: { code, message, i18n_key, details } }`，`:816`） |
| ④ | **同族 `sendError` 面「只登记不扩面」** —— 本单只修**本端点**（`GET /api/user/ledger`），**其余同族面登记、不顺手改** | `docs/seafood.master-plan.md:1439`（Zang §5.162 C 逐字「**同族 `sendError` 面只登记不扩面**（本单只修本端点）」） |
| ⑤ | **判负可得**（口径不靠自觉）：**同一端点内 400 类的形状集合大小必须 = 1** | 由 ①③ 直接给出；**实测归实现批 / 质检批**（本册零 HTTP） |

> **★ 与 §3.4 的关系（写死 · 防误读）**：§3.4（`:827`）记载批 2c 已把 `requireActor` / `requireAdmin` 的响应体由 `{success:false,message,error}` **改为 `R107`** ⇒ **鉴权面早已统一**；本条管的是**业务参数面（400 类）在同一端点内是否只有一种形状**。

### 15.2 同族面清单（**转引 · 本单不复算**）⇒ `NOT_MEASURED`

- **清单真源 = 同批 Kong 收口五报告 `docs/audit/p7-a-ledger-read-fix2.md`（同批）** —— 本册**不复算、也不转抄其条目**。
- **落盘状态（本册现取）**：**该件开工时尚未落盘**（`find docs -name 'p7-a-ledger-read-fix2*'` = **0**）⇒ 本册**只写口径与纪律**（15.1 / 15.3），**清单 = `NOT_MEASURED`**（§7-61 / §8.20.2-②）。
- **★ 纪律（写死）**：**不得自编清单、不得留占位**（不写「待补」「TBD」「（略）」，也不写「0 条」「无」）。清单落盘后，**读 `docs/audit/p7-a-ledger-read-fix2.md`（同批）**。

**★★ §15.2 v1.9 就地加注（**同族面清单已落盘 ⇒ 由 `NOT_MEASURED` 转为现取 · 本节 15.2 正文一字未动**）**：**`docs/audit/p7-a-ledger-read-fix2.md` 现已落盘**（本册现取：该件在场 · **30205 B** · mtime `2026-10-02 15:43`）⇒ **原「该件开工时尚未落盘 ⇒ 清单 = `NOT_MEASURED`」的落盘前提消失**；**同族面清单 = 26 处**（**转引该件 §5**，**本册不复算**；逐条登记见 **§15.4**）。**⇒ 本节 15.2 第二 / 第三条（`NOT_MEASURED` 与「不得自编清单」）读法更新**：**清单现取可得**（来源 = 报告 §5），**仍不得由本册自编**（**只转引计数结论 + 点名 1 处**）。**★ 本节 15.2 正文一字未动、`NOT_MEASURED` 旧文保留不删。**

### 15.3 实现面登记（承 15.1 · 归实现批 / 质检批）

| # | 交付项 | 前置（本契约条款） | 判据 |
|--:|---|---|---|
| **I-19** | **`GET /api/user/ledger` 的 400 类形状统一为 `R107`**（`cid` / `before_txid` 非法分支由旧 `sendError` 形态改为 `R107` + `details.field` / `details.reason`） | 15.1 ①②③；§3.3-1 | 同端点 400 类形状集合 = **1**（判负面 = 出现 `{success:false,message,error}`） |
| **I-20** | **同族面清单**（哪些端点仍有旧 `sendError` 400 形态） | 15.1④；真源 = `docs/audit/p7-a-ledger-read-fix2.md`（同批） | **清单入册**；**本册不代其枚举**（`NOT_MEASURED`） |

### 15.4 ★ 同族 `sendError` 26 处登记 + `:1482` 行号勘误（**v1.9 新增 · 本节只追加 · 依据 = 转引 `docs/audit/p7-a-ledger-read-fix2.md §5`**）

**★ 口径（转引 · 本册不复算）**：`sendError` 定义 `backend-ts/src/index.ts:116-120` = `res.status(statusCode).json({ success:false, message, error:message })` ⇒ **旧形状 `{success,message,error}`（非 R107）**。全仓**实调用 = 26 处**（`grep -rn '\bsendError\(' backend-ts/src --include=*.ts` ⇒ **27 命中**，其中 `:464` 为**注释行**、`const sendError` 为**定义行**）。

**★ 登记结论（写死）**：**全部 26 处属既有面、本批只登记不修**（依据 = §15.1④「同族 `sendError` 面只登记不扩面」）。**逐条清单**（路由 / 调用行 / status / message）**转引** `docs/audit/p7-a-ledger-read-fix2.md §5 表` —— **本册不转抄其 26 行**（避免与报告重复、避免陈旧行号）。

**★ 点名（逐字）**：`POST /api/admin/points/adjust`（**注册行 `:1472`**）的守卫 `:1481`（`if (!uID || Number.isNaN(amount) || !reason)`）在 **`:1482`** 抛 `sendError(res, 400, '参数不完整')` ⇒ message = **硬编码中文字面量「参数不完整」**、走**旧形状** ⇒ **非 R107 形状**。
**★ 行号勘误（写死）**：**先前引的 `:1477` 系早期 artifact 行号，已作废**；**行号以该报告现取 `:1482`（注册行 `:1472`）为准**（差异源 = `P7A-FIX5-001/senderror-inventory.json` 系早期版本所产、其 `:600` 之后行号整体 `−5`）。

**★ 与 §9.E · E9（A1 入参不完整分支）的关系**：**E9**（`:2540`）与本条点名的 `:1482` 是**同一分支**（§4.10 / §7-45 的 A1 形状偏离）；**E9 = 收口项、本条 = 同族面登记**（**本单不改代码**）。

**★ 未测项（`NOT_MEASURED` + 原因）**：26 处的**逐条行号 / message** 本册**未逐条现取复核**（**转引**报告 §5）⇒ 读该表时以报告为准；**本册只转引「26」这个计数结论 + 点名 1 处**（**不填 0 / 不填空**）。

**★★ §15.4 v2.1 就地加注（`sendError` 同族 · 存量偏离归口 + 本册现取复核 · **本节正文一字未动**）**：**26 处转引读数不变**（口径 = 报告 §5；时点 sha256 = `c4db3627…`）；**本册现取复核（v2.1 时点 · 同口径 `grep -n 'sendError(res,' backend-ts/src/index.ts`）= 50 行命中 ⇒ 剔除 24 行注释行 = 26 行实调用**（`backend-ts/src/index.ts` 现 **2060 行**、sha256 = `9b90bed4…`）⇒ **与报告 §5 的 26 处逐条表一致**。**处置升级（承 §15.1④ · v2.1）**：这 26 处**除「旧形状」外，其 `message` 面亦属 R107 `message` 语义存量偏离**（§15.5 D 类）⇒ **登记为技术债、分批实现、非阻塞**（**不再是「只登记不扩面」式的搁置**，而是**有归口、有正向约束**的存量面：**存量只登记、新增受 §15.6 约束**）。**仍未测**：26 处的逐条行号 / message **本册不复算**（**转引**报告 §5）⇒ `NOT_MEASURED`（§8.23.2-④）。

### 15.5 ★★ R107 `message` 语义**存量偏离清单**（**v2.1 新增 · 只登记 · 技术债 · 分批实现 · 非阻塞** · 依据 = Zang §5.171 C）

**★ 口径（写死）**：本节登记的**全部**为**既有面**（**非**本册所增、**非**批 7 读口所增）；**只登记、本批不修一条**；**处置 = 分批实现、非阻塞**。**依据逐字（Zang §5.171 C）**：「批 7-C + 7-D 后**用户可见面已干净**（132 节点全本地化 + 机读码双面抑制）⇒ 服务端 `message` 把码当文案**不再是用户可见缺陷，而是契约卫生问题** ⇒ 降级为**「规范澄清 + 存量登记、分批实现、非阻塞」**」。

**★ 判据（正面锚）**：**§3.3 v2.1 就地加注 · 条款 9′** —— `message` 必须是**人类可读的稳定英文句**、**严禁机读码**。

| # | 存量偏离面 | 现取锚点（`文件:行号`，本册现取） | 口径 / 计数 | 偏离性质 |
|--:|---|---|---|---|
| **A** | `fail(status, code, details, message?)` **第 4 参缺省 ⇒ 回退 `code`** | 6 处定义：`currency-service.ts:39`（回退位 `:48`）/ `job-funds-service.ts:37`（`:46`）/ `listing-funds-service.ts:146`（`:155`）/ `listing-service.ts:35`（`:44`）/ `market-service.ts:104`（`:113`）/ `job-service.ts:61`（`:70`）；另 `admin-service.ts:33` 同形回退 | 回退位 `message: message || code` 现取 = **7 处**（`grep -n 'message: message || code' backend-ts/src/*.ts`）；**只有「省略第 4 参」的调用点**落入偏离面 | **缺省路径**把机读码当 `message`；**显式传英文句**的调用点（如 `shapeError` → `'Request shape is invalid'`、`ref404` → `'Referenced object not found'`、`currency404` → `'Currency not found'`）**不偏离** |
| **B** | `fromLedgerError` 以 **`message = mapped.code`**（兜底支 = `norm.code`） | 4 处：`currency-service.ts:66` / `job-funds-service.ts:64` / `listing-funds-service.ts:169` / `market-service.ts:131` | 每处 **2 支**（`mapped.code` + `norm.code`）⇒ **8 个赋值点** | **★ F-1 真体来源**（退款拒收回执 `message = 'LEDGER_CURRENCY_INVALID_TRANSITION'` 即此路径） |
| **C** | `sendAuthError` 以 **`message = code`** | `index.ts:256-263` → `ledgerErrorBody(code, code, details, 'auth')`（**第 2 参 = `code`**）；调用点 `:274` / `:307` / `:313` | `code ∈ {AUTH_UNAUTHORIZED, AUTH_FORBIDDEN}` ⇒ 401 / 403 的 `message` = 机读码；**3 个调用点** | 鉴权面把域码当 `message` |
| **D** | `sendError` 同族**旧形状** `{success:false,message,error}` | 定义 `index.ts:116-120`；逐条清单 = **转引** `docs/audit/p7-a-ledger-read-fix2.md §5`（26 处 → 路由 / 调用行 / status / message 逐条判定表） | **26 处实调用**（**转引**读数；时点 sha256 = `c4db3627…`）；**本册复核** = 同口径命令命中 **50 行** ⇒ 剔除 **24 行注释行** = **26**（现取时点 sha256 = `9b90bed4…`） | **整形状**偏离（非 R107 · §15.1③）+ **部分 `message` 偏离**（硬编码英文 / **1 处硬编码中文 `:1482`「参数不完整」** / 若干 `error.message` 回显） |
| **E** | `sendVerbError` / `ledgerErrorBody` 是**正确通道**，但其报文由 A–C 产出 | `job-service.ts:76-77`（`sendVerbError` 透传 `err.message`）/ `:21-33`（`ledgerErrorBody(code, message, details, i18nDomain)` · `i18n_key = \`${i18nDomain}.err.${code}\`` 于 `:30`） | — | **非偏离**（通道正确；偏离在**上游** `err.message` 的构造，见 A–C） |
| **F** | `LEDGER_ERROR_TABLE` 的 `message` 为**中文句**（非英文句） | `ledger-errors.ts:30-69`（表内 **33** 条目，现取 `grep -cE '^  LEDGER_[A-Z_]+: \{ status:'` = **33**）；例 `:30` `'可用余额不足'` | **33 条 message 逐条为中文句**（现取） | **语言面**偏离（**非机读码** ⇒ **不属 F-1 缺陷面**；`data-layer.spec` §11.3.1 早已登记为「需新增键 / 四语化」工作项）；**是否并入本技术债批次 = 待 Zang**（本册**不自行裁定**） |

**★ 证据（转引，本册不复算）**：**26 处逐条判定表** = `docs/audit/p7-a-ledger-read-fix2.md §5`（该表**全部属既有面**、报告自陈「本单一律不修」，并给出三条理由：授权面 = 报告 + 判负取证 / 这些面**均非**批 7-A 读口改动面〔读口 `:633-716` 现取零 `sendError(`〕/ 「`sendError` 旧形状面收敛为 R107」是**类级工作项**、应在独立单内按类推进）。**本册只转引计数结论 + 点名 1 处**（`POST /api/admin/points/adjust`：注册行 `:1472` / 调用行 `:1482`，`message` = 硬编码中文**「参数不完整」**），**不转抄其 26 行**。

**★ 为什么「非阻塞」（写死 · 防误读为「缺陷未修」）**：**前端护栏已将「机读码当文案」在用户可见面**结构性抑制**（批 7-C = `message` 面；批 7-D R1′ = `details.reason` 面）⇒ **四语用户可见串不再出现机读码**（读数见 §16.3）；因此**本条不是用户可见缺陷**，而是**契约卫生**问题 ⇒ **与实现批的其它工作并列、分批推进**。**禁止**据此把本册读作「线上仍有英文机读码外泄」。

**★ 未测项（`NOT_MEASURED` + 原因）**：**A 类中「省略第 4 参」的调用点逐点枚举** = `NOT_MEASURED`（需逐调用点判读 / AST；本册只给**定义面**的 7 处回退位读数，**不把「7」当作偏离调用点计数**）｜**D 类 26 处的逐条行号 / message** = `NOT_MEASURED`（**转引** fix2 §5，**本册不复算**）｜**A–D 四类的服务端改写切分（改哪几处 / 几批）** = **未定**（归**实现批**；本册**只登记**）。

### 15.6 ★ 正向约束：**新增错误面不得把码塞进 `message`**（**v2.1 新增 · 类级可判负门**）

**★ 约束（写死 · 逐字）**：**凡新增 / 改动的错误面**（新端点、新分支、新错误码路径）**不得**把机读码（`LEDGER_*` / `AUTH_*` 一类「全大写下划线码」）填进 `message` —— **码只进 `code`、本地化只认 `i18n_key`、`message` 是人类可读稳定英文句**（§3.3 v2.1 加注 · 条款 9′）。

| 项 | 内容 |
|---|---|
| **性质** | **类级门**（**规则**，非存量登记）—— 与 §15.5 的「存量偏离」**分层**：**新增面**受本约束、**存量面**只登记（**存量不回溯改造**） |
| **判据（正面）** | 新错误体的 `message` **不含**「全大写下划线机读码」token（正则 `MACHINE_CODE_TOKEN_RE`，真源 `frontend/src/auth.js:156`） |
| **可判负门（现取 · 门件在场）** | ① `frontend/scripts/p7c-errmsg-machinecode-gate.mjs`（**G 段**：33 码 × 4 语机读码面违例 = 0）/ ② `frontend/scripts/p7a-03-errmessage-gate.mjs`（**命中 0 / 基线 0**） |
| **门读数（转引）** | `p7c`「D 0/16、F 0/16、**G 机读码出现次数 = 0/36 违例 = 0**」/ `p7a-03`「命中 0 / 基线 0」（**改前基线 3 ⇒ 归零**）—— **转引** `docs/seafood.master-plan.md §5.171 A`（**本册不跑前端套件**，见 §8.23.2-①） |
| **射程** | 本约束**不回溯**改造存量（存量见 §15.5 · 分批 · 非阻塞）；**新增面违反 ⇒ 判负** |

## §16 ★★ v2.1 · 前端错误文案链四跳 + 机读码判据 + 33 码已本地化（**v2.1 新增 · 本节只追加 · 依据 = 批 7-C / 批 7-D 成果 + Zang §5.171**）

### 16.1 候选链四跳（**写死**）

**★ 链路（真源 = `frontend/src/auth.js` 的 `resolveI18nMessage`，现取 `:256-279`）**：错误文案链**按序**取第一个**可用**者 ——

| 跳 | 候选 | 现取真源 | 说明 |
|--:|---|---|---|
| **①** | **`t(i18n_key)`** | `auth.js:270-272`（`fromI18n` = `:264-268`） | `R107` 的 `i18n_key`（`ledger.err.<CODE>` / `auth.err.<CODE>`）**命中即用真文案** ⇒ **本地化真源** |
| **②** | **服务端原文**（`message`） | `auth.js:274-275`（`if (isUsableText(fallback, i18nKey)) return fallback`） | **既有验收面**（`auth.test.js` S6 / O-1 边界）**逐字依赖** ⇒ **必须先于 ③**，否则 S6 从「保留服务端文案」退化为通用兜底 = **既有验收面回归** |
| **③** | **四语通用兜底** `auth.err.REQUEST_FAILED` | `auth.js:277-278` | ①② 都不可用时（键未命中 ∧ 无原文 / **原文本身即裸键或即机读码**） |
| **④** | **ASCII 兜底** `Request failed (status)` | `auth.js:279` | 连 i18n 都不可用时（**绝不空白、绝不 `[object Object]`**） |

**★ 准入闸（每跳都要过）**：`isUsableText`（`auth.js:235-240`）= **非空 ∧ ≠所查键名 ∧ 不含裸键 token**（裸键判据 `BARE_I18N_KEY_TOKEN_RE` = `auth.js:224`）。

### 16.2 ★★ 机读码判据（批 7-C / 批 7-D · 写死）

**★ 规则（写死 · 可判负）**：**② 的 `message` 与 `details.reason` 命中「全大写下划线机读码」⇒ 视为不可用**（⇒ 链下沉到 ③ / 或**不附加 `(reason)` 后缀**）。

| 项 | 现取读数 / 内容 | 锚点 |
|---|---|---|
| **判据（两个正则 · 逐字）** | 整串即码 `MACHINE_CODE_RE = /^(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}$/`；token 出现 `MACHINE_CODE_TOKEN_RE`（边界集 = 串首 / 尾 / 空白 / 括号 / 引号 / 逗号 / 分号 / 冒号 / 斜杠 / 反斜杠 / 竖线，**不含 `.`**） | `frontend/src/auth.js:155-156` |
| **谓词（具名导出）** | `looksLikeMachineCode`（`:159-161`）/ `containsMachineCode`（`:164-166`） | 同件 |
| **落点（`message` 面 · 批 7-C）** | `extractApiErrorMessage` **三处**收口：对象面 `error.message`（`:179`）/ 旧字符串面 `error`（`:192`）/ 顶层 `payload.message`（`:193`）⇒ 命中即 `undefined` ⇒ 下沉 ③ | `auth.js:168-196` |
| **落点（`details.reason` 面 · 批 7-D · R1′）** | `:187` `const suffix = reason && !containsMachineCode(reason) ? \` (${reason})\` : ''` —— **复用同一判据、禁另写正则**；**未命中（真人串如 `too_many_connections`）⇒ 仍保留后缀**（**O-1 边界不回归**） | `auth.js:180-188` |
| **判据边界（写死）** | 独立 token：① 整 token ∈ `[A-Z0-9_]`（天然排小写与非 ASCII）② 含 **≥ 1 个下划线** ③ 长度 **≥ 4**；**不含 `.`** ⇒ 与裸键判据（`BARE_I18N_KEY_TOKEN_RE`）**互补**（点分键归旧判据、无点下划线码归新判据） | `docs/audit/p7-c-errmsg-scope.md §2.1`（**转引**） |
| **F-1 真体（缺陷复现 → 已修）** | 退款拒收回执 `message = 'LEDGER_CURRENCY_INVALID_TRANSITION'` + `details.reason='order_not_refundable'` ⇒ **改前**四语用户可见串 = 英文机读码 `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`；**改后** = 该语通用兜底 | `docs/audit/p7-c-errmsg-scope.md §1/§3`（**转引**） |
| **残余（登记 · 非本册裁定）** | 「英文句 + `details.reason` 为大写机读码」的**业务状态机族**（`stateConflict()`：`listing-service.ts:55` / `job-service.ts:122` / `job-funds-service.ts:61` / `currency-service.ts:59`）⇒ 批 7-D R1′ **已把 `reason` 面收口**（不附加后缀）；**服务端 `message` 本体改动**归「错误文案面收口」批（= §15.5） | **转引** `docs/qa/p7-c-errmsg-scope-review.md §3.4/§5` + 批 7-D R1′ |

**★ 质检（转引）**：`docs/qa/p7-c-errmsg-scope-review.md` 结论 = **PASS（建议入库）**（逐条重取读数；硬门七门 `EXIT=0`；两处判负自证逐字复现后复原回绿；**误杀面未发现**；其新采残余 = 本表末行）。

### 16.3 ★★ 33 码闭集已逐码本地化（批 7-D · 写死）

| 项 | 现取 / 转引读数 | 锚点 |
|---|---|---|
| **键名 / 值** | `ledger.err.<CODE>`；`<CODE>` = `LEDGER_*` **33 码闭集**（**闭集不动**，只加文案键） | `backend-ts/src/ledger-errors.ts` 表（现取条目 = **33**）；四语 = `zh / hk / en / vn` |
| **★ 本册现取复核** | 每语 `ledger.err.*` = **33 键**（`zh / en / hk / vn` **各 33**）；每语**递归拍平后** `flat = 737`（四语**同值**） | 本册现取（`frontend/src/locales/{zh,en,hk,vn}.json`） |
| **四语键集相等** | **完全相等**（`flat = 737` × 4；零 stub / 零空值 / 零「值 == 码名」/ 零纯机读码值） | **转引** `docs/seafood.master-plan.md §5.171 A`（Zang 亲核）+ 本册现取（键数 / `flat`） |
| **★ 两口径必须分标（承 D-1 失真教训）** | **33** = **每语键数**（码 × 语 = **132 文案值**）；**132** = **门 D 段的「代码里需护栏的节点数」**（33 × 4）—— **两个数口径不同，禁混用** | **转引** `§5.171 B · D-1`（回执 `keys_enumerated: 132` 实为**抄数**，实交 **33 键**） |
| **门读数（转引）** | `p7b-errfallback-gate` = 「D 节点=132 **需护栏 0** / **已本地化 132**」（**改前 = 需护栏 132 / 已本地化 0**）；`p7a-03-errmessage-gate` = 「**命中 0 / 基线 0**」（**改前基线 3 ⇒ 归零**）；`p7c` = 「D 0/16、F 0/16、**G 机读码出现次数 = 0/36 违例 = 0**」 | **转引** `docs/seafood.master-plan.md §5.171 A`（**Zang 亲跑七门**；**本册不跑前端套件**） |
| **护栏让位（写死 · 承 §14.3）** | ① 行 `t(i18n_key)` **命中即用真文案** ⇒ 护栏**自动让位、无需改代码**；门 D 段只**读数变化**、**不判负** | §14.3 + 批 7-B §6-② |
| **文案语言质量** | **本册未逐条审**（**转引** Zang 亲审：语义准确 / hk 全粤语书面 / vn 全越南语 / en·vn 零 CJK / 3 处同值皆同义码 ⇒ 判合理） | **转引** `§5.171 A` ⇒ **本册不冒充**（§8.23.2-②） |

**★ 7-D 报告落盘状态（现取 · 诚实标注）**：**`docs/audit/p7-d-errmsg-i18n.md` = 未落盘**（本册现取 `ls` = 0；**转引** `§5.171 B · D-2`「回执称报告已落盘、**实际文件不存在**」）⇒ **本节 7-D 成果以「门读数 + Zang 亲核读数 + 本册现取」三源为准**，**不引不存在的报告**。

**★★ §16.3 v2.1 落盘更正与补证（**完工时点现取** · 上面「未落盘」读数为**开工时点** ⇒ 本节更正）**：**`docs/audit/p7-d-errmsg-i18n.md` 已由并行「批 7-D 收口单」落盘**（本册**完工时点现取**：该件 **37200 B / 439 行**、mtime `2026-10-02 19:44`；交付 sha = **`f0bd336`**〔本地入库，其后紧接 docs 提交 `17f4a23`〕）⇒ **原「本节 7-D 成果不引报告」的限制解除 ⇒ 现可引该件**。**本册现读该件、逐条转引其读数**：
> - **门读数（该件 §0.4 · 亲跑七门 · 逐门 `EXIT 0`）**：`p7b-errfallback-gate` = 「**D 节点=132 需护栏=0 已本地化=132 / G 键不可用=0/132**」；`p7c-errmsg-machinecode-gate` = 「A=PASS / B 含机读码值=0 / C 兜底键=4 / **D 类级违例=0/16** / **F 反例违例=0/16** / **G 机读码出现次数=0/36 违例=0**」；`p7a-03-errmessage-gate` = 「**扫描 77 / 受体 6 / 命中 0 / 基线 0**」；`p6-tr2-i18n-locales` = 「`zh: top=102 flat=737` / **键集相等 PASS（四文件拍平键数取值集合 = {737}）**」；`build` **EXIT 0**；`test:unit` **30 files 268 passed**。
> - **★★ 33 键已从「登记」升为「类级判据」（写死）**：门 `p7b` **G 段**对 **132 节点**（33 码 × 4 语）逐条断言「**存在 / 非空 / ≠键名 / ≠码本身 / 不含裸键 token / 不含机读码 token**」⇒ `不可用 = 0/132` —— 即 §14.3（v1.9）「132 键逐码本地化 = **登记 P6/P7 待定**」在 **v2.1 已收口为「已落地 + 判据」**。
> - **判负自证（该件 §6 · 仓外副本 · 逐字红读数）**：**(a)** 删 `en.json` 一个新加的可达键 `ledger.err.LEDGER_AMOUNT_INVALID` ⇒ 门 `p7b` **`EXIT=1`**（`G 键不可用=1/132`）+ 单测 **4 红**（`Test Files 3 failed` / `Tests 4 failed | 15 passed`）⇒ **复原回绿**；**(b)** 把 R1′ 的 `reason` 判据**改回旧口径**（`return reason ? \`${base} (${reason})\` : base`）⇒ **真链类级单测 2 红**（`p7a-ledger-error-i18n.test.js` ③ / `p7c-errmsg-machinecode.test.js` ⑧）⇒ **复原回绿**。
> - **★ 口径边界（登记 · 诚实标注）**：**同一「改回旧口径」下，纯 node 镜像门 `p7c` 仍 `EXIT 0`**（该门 D/F/G 段用**链式决策镜像**而非真跑 `apiErrorMessage`，仅 A 段读 `auth.js` 源码）⇒ **「R1′ 的 `reason` 判据」的可判负落点 = 真链类级单测（`p7a` ③ / `p7c` ⑧），不是纯 node 镜像门**（该件 §6.2 / §7.2-2 **自行登记为口径边界**；本册**照录**，**不据它判负该门**，也**不据此新立收口项**）。
> - **该件未测项（转引 §7.2 · 七项）**：门是否真跑链（已知边界）/ 镜像门对 R1′ 无判负覆盖 / e2e 未跑 / 无线上读数（`f0bd336` **未推送**）/ 四语「语言学家级」审校未做 / `LEDGER_IDEMPOTENCY_REPLAY`（R106 良性码）运行时可达性未验 / `frontend/**` 之外的下游消费者未扫。
> ★ **本册口径不变**：上列**全部转引**（**本册不跑前端套件**，见 §8.23.2-①/②）；**该件为并行单（Kong · 批 7-D 收口）交付物、本册未触碰（零改动）**。

### 16.4 与 §14.3（v1.9）的关系（写死 · 防误读）

- **§14.3（v1.9）** 的「132 键逐码本地化 = **产品 / 文案决策 ⇒ 登记 P6/P7 待定**」与其门读数「**需护栏 = 132 / 已本地化 = 0**」= **v1.9 时点**的读数；**v2.1 时点**已由批 7-D 落地 ⇒ **以 §14.3 v2.1 就地加注 + 本节为准**（**§14.3 正文一字未动、旧读数保留为历史留痕**）。
- **护栏与 §14.1 的关系不变**（**入口唯一 / 出口兜底**）；**机读码判据**是**出口兜底的第二次收口**（`message` 面 + `reason` 面），**两项叠加 ⇒ 用户可见文案既不为裸键、也不为机读码、也不为 `[object Object]`**。

### 16.5 未测项（`NOT_MEASURED` + 原因）

| 项 | 状态 | 原因 |
|---|---|---|
| 门当日**判负实跑**（`p7c` / `p7b` / `p7a-03` 的仓内本日读数） | `NOT_MEASURED`（**本册**） | 本册**不跑前端套件 / 不跑门**（只读源码 + 只读 locale）⇒ 门读数**转引** `§5.171 A`（**不转引冒充实测**） |
| 33 码 × 4 语**文案语言质量**逐条审 | `NOT_MEASURED`（**本册**） | 归**产品 / 文案**面；本册**只取键数与键集相等**（**转引** Zang 亲审，见 §16.3） |
| 「`message` 面在后端还有多少**新增**违规点」 | **未定** | 属**实现批**扫描面；本册只给存量（§15.5）与正向约束（§15.6） |
| `frontend/src/**` 其余页面是否仍**直拼**错误串 | `NOT_MEASURED`（**本册**） | 归 §14.1 的门（`p7a-03`）；本册**不重取其扫描面** |

---

## §17 ★★ v2.2 · 批 8 首轮契约冻结：`app_config` 写口准入 + 载体键名约定 + 审计台并联对账（**v2.2 新增 · 本节只追加 · 依据 = 批 8 首轮契约冻结单 8① + Zang 裁定 `R-8-1` / `R-8-3` / `R-8-4` / `R-8-5`**）

> **本节性质**：把 **`§7-16`** 预登记的「**`app_config` 合法键清单 / 写入门禁**」从**未决登记**升为**可执行契约**（**数据层条文 = `data-layer.spec` v0.10 §21，同批交付；本节不重抄**）；并**首次**把 **`R-8-3`** 的**审计台并联读取 + 统一呈现 + `txid` 对账判据**落成条文（= **`§7-53` 的兑现**，见 §17.5 + §7 的 **7-62** + 补注块 ㉛）。
> **纪律（写死）**：① **只追加**（**非追加改动 = 0 处**；`git diff --numstat` 删除列 = **0**，见 §8.24.5/§8.24.6）；② **零代码 / 零迁移 / 库面只读 / 零 HTTP**；③ **不发明**路径名 / 权限键 / 键名 / 数值 / 日期（无先例处一律**停报**并登记 `待 Zang / Kevin`）；④ **`R-8-1` 硬口径**：**只在既有 11 权限键内选键，零新增 / 零删除**；**找不到合适键 ⇒ 停下报裁、严禁硬造**。

### 17.1 开工锚（现取 · 逐项）

| 项 | 命令 | 本单现取读数 |
|---|---|---|
| 本册开工版本 | `grep -c '^> \*\*状态：v2.1' docs/route-layer.spec.md` | **v2.1**（命中 **1** 行；状态块位于 `:180-190` 区） |
| 本册开工行数 / 字节 / md5 | `wc -l` / `wc -c` / `md5 -q` | **3840 行 / 828530 B / md5 `3f261af960e3dd4a15ba1b08c3a0eed0`**（**= 与派单给定对锚逐字相符** ✅） |
| 最新快照 | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.1.md` | **退出码 0**（`v2.1.md` 与现档**逐字节相同** ⇒ 改前正文可独立复核）。**本册约定 = 快照命名取「新版本号」+ 改后正文** ⇒ 本单**新建** `docs/versions/route-layer.spec.v2.2.md`（与改后正文 `cmp` = 0） |
| 注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68**（**转引** `docs/audit/p8-p6-recon.md §0`，与本册同值；**本单未重跑** ⇒ 见 §17.7-1） |
| 姊妹册 / 其它册开工锚（**逐册各自现取 · 不沿用任何 §5.179 转引**） | `wc -l` / `wc -c` / `md5 -q` | `docs/data-layer.spec.md` = **1070 行 / 284069 B / md5 `f63fffad343e0591934d00ba129c8683`**（v0.9，**本单改它**）；`docs/ledger.spec.md` = **2028 行 / 461344 B / md5 `eee9f165704e100c98b3655d742d1ac2`**（v0.13，**本单不碰** —— 未获批） |

### 17.2 ★★ 权限映射表（**先现取逐字十一键，再给映射**）

**（a）既有十一权限键（逐字 · 现取 · 三真源）**：

> **真源 A（后端唯一真源）** = `backend-ts/src/database.ts:11-23` 的 `const ALL_ADMIN_PERMISSIONS = [ … ] as const`，**逐键现取**：
> `dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · `review_tasks`
> **真源 B（迁移种子）** = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`（11 行 `INSERT INTO public.admin_permission (permission_key, name) VALUES …`；**键集逐键相等**；apply-time 自检 `:112-132` = 「多 / 少任一键 ⇒ `RAISE` ⇒ 整迁移回滚、不写版本行」）。
> **真源 C（前端兜底）** = `frontend/src/admin-utils.js:40-52`（11 键）。
> **★ 三真源逐键相等**（机器判据 `all_three_equal=true`）= **转引** `docs/audit/p6-b6-perm-seed.md §5-④`（**本册未复跑该判据** ⇒ 该读数 = **转引**，见 §17.7-2）。
> **★ 闭集（写死）**：**恰好 11 键，不增不减**（`R-8-1`）。**新增权限键在本批不可行** —— 先例 = **本册 §12.1.1:3042** 逐字：「新权限键须 **4 处同批改**」（`database.ts:11-23` 常量 / `0022` 种子 / `frontend/src/admin-utils.js:40-52` 兜底 / 消费点）⇒ **本批一律在 11 键内选**。

**（b）本片（8①）与后续片「所需权限 → 既有键」映射表**：

| 切片 | 所需权限（语义） | → **既有键（11 键内）** | 依据 / 说明（现取） |
|---|---|---|---|
| **8① `app_config` 管理（本片）** | 读写平台配置 | **`manage_settings`**（**唯一**） | **现取**：`GET /api/admin/settings`（`index.ts:1125`）闸 = `:1126` `requireAdmin(req, res, 'manage_settings')`；`POST /api/admin/settings`（`:1142`）闸 = `:1143` 同键。`0022:60` 中文名 = 「系统设置」 |
| 8 ② 费率配置（`commission_policy` 写口） | 写费率政策 | **`manage_settings`** | **现取**：`POST /api/admin/commission_policy`（`index.ts:1954`）闸 = `:1955` `manage_settings`；与本册 **§1.11 Q8** 一致（「**复用既有权限键、不新造**」） |
| 8 ③ 返佣权重矩阵（10 级 × 时间权重） | 同 ②（**同口同 `INSERT`**） | **`manage_settings`** | 同上（`levels` / `weights_bp` 随同一政策行插入，无独立写口） |
| 8 ⑥ 用户与权限 | 读用户 / 管权限 | **`read_users`** / **`manage_permissions`**（+ `manage_users`） | **现取**：`GET /api/admin/permissions`（`index.ts:1180`）闸 = `manage_permissions`；`POST /api/admin/user/update`（`:1251`）属 `manage_users` 族；逐端点行号见 §1 表（**本表不重抄**） |
| 8 ⑦ 资产与流水审计台 | **读审计 + 对账**（只读） | **★ 无 ⇒ 停报 Zang** | **停报项**：11 键内**没有**「读审计台」语义的键 ⇒ **本册不选、不硬造**（`R-8-1` 逐字「找不到合适键 ⇒ 停下报裁、严禁硬造」）。**候选（不构成裁定）** = `read_users`（读人域、最小面）/ `manage_users`（管理域、面更大）。**登记 = §7-62**；**裁定前不得实现** |
| 8 ④⑤ 自建单位审核 / 合规审核 | 审核闸 | **`review_tasks`**（**唯一候选 · 须 Zang 确认**） | **现取**：`review_tasks` 现消费面 = `index.ts:1350/1365/1381/1784/1808`；`0022:61` 中文名 = 「任务审核」。**⚠️ 语义不完全吻合**（单位/合规审核是**新审核面**）⇒ **本批新键不可行**（4 处同批改）⇒ **临时结论 = 复用 `review_tasks`**，**须 Zang 一句话确认**。**登记 = §7-63** |
| **8 ⑤ 保证金规则（`R-8-5` 片）** | 写保证金配置键 | **`manage_settings`** | **载体 = `app_config` 合法键**（`R-8-5`）⇒ 写入面 = `POST /api/admin/settings` ⇒ 同 `manage_settings`；**不得**新开「改保证金」业务路由（见 §17.4 + `data-layer.spec` §21.4 / `AG2`） |

> **★ 映射表口径（写死）**：本表「所需权限 → 既有键」**逐行给死**；凡**找不到合适键**的行，**显式写「无 ⇒ 停报」**（**不得**填一个「看起来像」的键凑数）。**本表里「停报」行 = 8 ⑦**；**「须 Zang 确认」行 = 8 ④⑤**。
> **★ `R-8-1` 履约声明**：本表**零新增键 / 零删除键**（11 键闭集**逐字不动**）；**未出现的键 = 不存在**。
> **★ 未在本文出现的「切片」**：`§5.178 C` 的切片编号与 §5.177 B 的枚举顺序不同（**转引** `docs/audit/p8-p6-spec-inventory.md §0.2`）；本表按 **8 片（①…⑧）** 组织，**8 ⑧ = 上市保证金规则**与 **8 ⑤ 保证金规则**同物（`R-8-5`），**合并列在末行**。

### 17.3 写口准入（**8① 的写口面 · 现取现状 + 准入规则**）

**（a）现取现状（逐字 · 代码）**：

| 面 | 现取锚（`backend-ts/src/index.ts`） | 逐字要点 |
|---|---|---|
| **读口** | `GET /api/admin/settings` = `:1125` | 闸 = `:1126` `manage_settings`；成功 = `:1133` `sendSuccess(res, settings, 'OK（费率不在 app_config；真源 = commission_policy.fee_rate_bp）')` ⇒ **「费率不在本表」用 `message` 承载、**`data` 键集不变**（= `SystemSettingsRecord` 9 键）；异常 = `sendInfraMapped(res, 'admin.settings.get', error)` |
| **写口** | `POST /api/admin/settings` = `:1142` | 闸 = `:1143` `manage_settings`；**`ops:` 键** = `:1147` `resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings')` ⇒ 规范形状 `ops:<admin_uid>:setting:<key>`（`DL36` / 本册 §11.2:581）；**无键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**；成功 = `:1165` `sendSuccess(res, settings, 'System settings saved')` |
| **费率键闸（现取仍在）** | `:1155` `findFeeRateKey(body)` | 真源 = `src/admin-service.ts:89` `FEE_RATE_KEY_PATTERNS`（**6 条正则**：`/fee_?rate/i`、`/rate_?bp/i`、`/commission_?rate/i`、`/commission_?policy/i`、`/费率/`、`/佣金/`）；命中 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason='FEE_RATE_KEY_NOT_IN_APP_CONFIG'`。**★ 本册 `§7-16` 的裁定 = 删除该黑名单**（真源唯一改由读取侧纪律）⇒ **删除属待办**（§17.6 `AT-R1`） |
| **已下线面（保留 `410`）** | `POST /api/admin/settings/reset` = `:1176` | `sendGone(...)`（`ADMIN_SETTINGS_RESET_SUNSET`）—— **本单不改**（`§7-1` 的过期日待 Kevin） |
| **写入落点** | `src/database.ts:2878` `saveSystemSettings` | `:2887-2888` `INSERT INTO public.app_config (key, value, updated_by, time_updated) VALUES ('system_settings', <normalized>::jsonb, <uid>::bigint, NOW())` —— **整块单键 upsert**（`normalizeSystemSettings` 按白名单 9 字段吸收、**其余静默忽略** ⇒ **无逐键白名单**，**现取事实**，即 `p8-p6-recon.md` 条目 8 的「半成品」缺口） |

**（b）准入规则（写死 · 可判负）**：

| 条目 | 规则 | 判负形态 |
|---|---|---|
| **`AR1`** | **读口**（`GET /api/admin/settings`）：准入 = `manage_settings`；`data` 键集 = `SystemSettingsRecord` 9 键（`database.ts:394-403`，现取）；**费率永不出现**（`§7-16` 读取侧纪律） | 响应出现费率键 ⇒ 判负 |
| **`AR2`** | **写口**（`POST /api/admin/settings`）：准入 = `manage_settings` **且** `ops:` 键合法（`DL36`）**且** 请求体**逐键落在** `data-layer.spec` v0.10 **§21.1 合法键清单**内（其 **`AG1`**） | 未知键 / 类型不符 / 越权面 ⇒ **必须 4xx**（**不得静默放行**，其 `AG4`）；**判负用例必带** |
| **`AR3`** | **载体键写入面**（保证金金额键等新增合法键）：**一律复用本写口**（`manage_settings`）；**不得新开业务路由** | 类级扫描：写 `app_config` 的语句**只**允许出现在 `saveSystemSettings`（其 `AG2`） |
| **`AR4`** | **注册点不变** | 本批**零新增对外路径** ⇒ `grep -cE '^app\.(get\|post\|put\|delete\|patch)\('` = **68**；新增键 = 一条 `INSERT`（**零 DDL / 零路由**） |

### 17.4 ★★ 载体键名约定（**保证金金额键 · 与数据层 §21.1 现取风格一致**）

- **裁定锚（逐字）**：`R-8-5` = 「**载体一律走 `app_config` 合法键**（**不新增列、不改已 apply 迁移**）；**保证金金额由常量 `50000`（`currency-service.ts:144`）改为读键**；**下限校验机制先落地**（沿 `R-7-23`：**数值待 Kevin 定值、兜底常量标 `TODO: Kevin 定值`，不得由客户端决定金额**）」。
- **命名约定（写死 · 从数据层「现取唯一先例」反推，不得自拟新风格）**：
  ① **顶层键名 = `snake_case`**（**现取唯一先例 = `system_settings`**，`database.ts:2870` / `:2888`）；
  ② **`value` = `jsonb` 对象**（**逐字引既有约束**：`0017:77` `CHECK (jsonb_typeof(value) IN ('object','array'))`；现实现只写 `object`）；
  ③ **对象内字段名 = `camelCase`**（现取 9 字段 `siteName` … `rewardCooldown` 即此风格）；
  ④ **词根必须取自既有域名词**（**不得造新词**）：保证金域词 = `listing_deposit`（`DL67` / `DL88` / `0019_listing_deposit_platform_credit.sql` / `currency-service.ts:144` 的 `CURRENCY_LIST_DEPOSIT_FLOOR` **同源**）。
- **★ 键名 = 待 Zang / Kevin 定（本册不发明）**：`R-8-1` 逐字「找不到合适键 ⇒ **停下报裁、严禁硬造**」+ **本册 §7-23** 逐字「**保证金下限的数值与载体**（新增 `app_config` 键？抑或用 `currency.deposit_amount` 既有语义？）**待 Kevin/Zang 给数 ⇒ 不得自选**」。**⇒ 本册只给约定 + 一个候选名（标「候选、不构成裁定」）**。
  - **候选（供一句话拍板 · 不构成裁定）= `listing_deposit_policy`** —— **构词法（可复算）** = `listing_deposit`（**既有域词**）+ `_policy`（**既有名词 `commission_policy` 的后缀**）；**值形状（建议）** = `{"amount": "<整数 · 最小单位>"}`（**字段名 `camelCase`**）。**★ 该候选名尚未入册 ⇒ 按 `data-layer.spec` §21.1 / `AG1`，它现在写入必被拒**（**这是 `AG1` 的正面用例，不是例外**）。
  - **数值（逐字承接 `R-8-5` / `R-7-23`）** = **待 Kevin 定值**；**兜底常量保留并标 `TODO: Kevin 定值`**。
  - **机制（本单可冻结的部分 · 写死）**：① **读口** = 在保证金下限解析处（`currency-service.ts:350`）**先读该键**、**读不到 / 非法 ⇒ 回落兜底常量**（**fail-closed 到常量**，**不是** fail-open 到客户端值）；② **下限校验不变**（低于下限 ⇒ `400 LEDGER_AMOUNT_NOT_POSITIVE` + `reason='BELOW_SERVER_FLOOR'`，`currency-service.ts:171`）；③ **客户端永不决定金额**；④ **该键一旦入册，其许可写入方 = `POST /api/admin/settings`（闸 `manage_settings`）**（§17.2 末行 + §17.3 `AR3`）。
- **注册点不变 / 零迁移**：新增键 = **一条 `INSERT`**（键值表 ⇒ **零 DDL、零迁移、零路由**）⇒ 注册点仍 **68**（`AR4`）。**登记 = §7-64**。

### 17.5 ★★ 审计台并联对账契约（**`R-8-3` 逐字落位 · `§7-53` 的兑现**）

> **裁定锚（逐字引 `R-8-3`）**：审计台采**并联读取 + 统一呈现**（**不合并表、不迁移**；以 `ledger_entry` 为主轴左联 `0023`/`0024` 两张审计表**只读**）；**对账判据 = 审计台每条 admin 动作必须能锚到 `ledger_entry` 的 `txid`**。

**（a）并联读取（写死）**：
- **主轴 = `public.ledger_entry`**（**只读**）；**左联**两张审计表（**均只读**）：`public.admin_ops_audit_log`（建表 = `0023:64`；`txid` 列 = `0023:79`）+ `public.admin_refund_audit_log`（建表 = `0024_admin_refund_audit.sql:48`；`txid` 列 = `:57`）。
- **★ 不合并表、不迁移（写死）**：**不得**为审计台新建「统一审计表」、**不得**改 `0023` / `0024` 已 apply 的迁移、**不得** `CREATE OR REPLACE` 既有函数体（口径同 `§7-53` / **7-54** 的四条依据 + **§12.11.2** 的「照抄 `0023`」纪律）。**呈现层统一、存储层保持分裂** —— `§7-53` 的「审计面分裂」**不改**，本契约**只消除其代价**。
- **逻辑关联键（现取）= `txid`**：两表各有 `txid bigint`（`0023:79` 注释逐字「依据账本回执 `txid`（成功时；**拒绝行 = NULL**）」；`0024:57` = 「照抄 `0023:79`」）⇒ **并联的锚点 = `txid`**（**不是** `actor_uid` / `time_created` 一类软键）。

**（b）统一呈现（写死 · 呈现契约）**：
- 审计台对外**行形状统一**（**不因来源表不同而变**）：**来源表 / 动作 / 操作人（`actor_uid`）/ 目标（`target_uid` 或退款面 `seller_uid`+`buyer_uid`）/ `cid` / 金额 / 结论位（`result`）/ `txid` / `idempotency_key` / 时间**；**「来源表」必须是可见列**（**不得**把两张表混成「来源不明」的行）。
- **`result='rejected_*'` 的行必须可见、且与成功行可区分**（口径承 `0024:79` 的 `result` 闭集 `{'applied','rejected_state'}` 与 `0023` 的 `{'applied','rejected_daily_cap'}`）；**任何求和 / 额度判据只计 `result='applied'`**（承既有裁定，**不得**把拒绝行算进任何额度）。
- **只读（写死）**：审计台**只 SELECT**，**不得**在审计台引入任何写路径（**不得**借读口补写、回填、修正审计行）。

**（c）★★ 对账判据（`R-8-3` 逐字 · 可判负）**：
- **判据（写死）**：**审计台里每一条「admin 动作」行，必须能锚到一条 `ledger_entry.txid`** —— 即：**凡有资金移动的 admin 动作，其审计行的 `txid` 必须与 `ledger_entry` 的对应行逐字相同**（**同源同语句**）。
- **可判负形态（三条，逐条必带）**：
  1. **反向孤儿**：存在一条 `result='applied'` 的审计行，其 `txid` 在 `ledger_entry` 里**查无此行** ⇒ **判负**（「痕迹指向不存在的钱」）。**依据（现取先例）**：`0023` 的成功路径**已实测**「资金分录 `txid` 与审计行 `txid` 逐字相同」（**转引** `docs/audit/p6-b6-audit-live.md §1–§7`；`0023:265` 写 `txid = v_txid::bigint`，`v_txid := v_ledger->>'txid'` 于 `:249`）⇒ 本判据 = 把它**升为审计台级**的类级判据。
  2. **正向孤儿**：存在一条 admin 动作产生的 `ledger_entry` 行（`kind` 属 admin 面），在审计台呈现里**无对应审计行** ⇒ **判负**。
  3. **结论位豁免（写死 · 防假红 · 本册新增的边界）**：**`result='rejected_*'` 的行允许 `txid` 为 `NULL`**（**拒绝 = 零资金分录**）⇒ 对账判据**只对 `result='applied'` 行生效**。**依据**：`0023:79` / `:108` / `:196`（「被拒尝试的审计行与成功行同形（只差 `result` / `txid` / 余额两列）」）+ `0024:57` / `:79`。**不得**因拒绝行的 `txid` 为 `NULL` 判负。
- **★ 闸前拒绝的射程（承 `§7-55` / **7-55**）**：`401` / `403` / `404` / `400`（闸前 / 存在性前置闸 / 形状闸）**不留痕**（既有事实）⇒ 审计台**不承诺**呈现这些面；对账判据**射程只覆盖「已进入编排、产生审计行的 admin 动作」**（**不得**因「某次被拒的请求审计台查不到」判负）。

**（d）实施登记**：审计台的**路由 / 页面 / 读口** = **批 8 ⑦ 切片**（**本单不实现**）；**权限键 = 停报项**（§17.2(b) 的 8 ⑦ 行 + **7-62**）；**读口 = 只读**。

### 17.6 本单待办登记（**交「接该面的实现单」，本册不实现**）

| 条目 | 待办 | 依据 |
|---|---|---|
| **`AT-R1`** | **删除 `FEE_RATE_KEY_PATTERNS` 黑名单**（现取仍在：`admin-service.ts:89` 定义 / `:101` 使用 + `index.ts:1155` 调用）；「真源唯一」改由**读取侧纪律**保证 | **`§7-16`**（Zang §5.82 采纳选项 (A)）；与 `data-layer.spec` §21.5 `AT1` **同物** |
| **`AT-R2`** | **`app_config` 写口逐键白名单 + 门禁落地**（`data-layer.spec` §21.2 的 `AG1`–`AG4`）；准入仍 = `manage_settings` | `data-layer.spec` §21.2 / 本节 §17.3 |
| **`AT-R3`** | **保证金金额改读键 + 兜底常量标 `TODO: Kevin 定值`**（**键名 / 数值待 Zang / Kevin**） | **`R-8-5`** / `§7-23` / 本节 §17.4 |
| **`AT-R4`** | **审计台并联读取 + 统一呈现 + `txid` 对账判据**（`R-8-3`）；**权限键待裁** | 本节 §17.5 / **7-62** |
| **`AT-R5`** | **审计读口权限键裁定**（11 键内无合适键 ⇒ **停报**） | **`R-8-1`**；见 **7-62** |

### 17.7 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因 |
|--:|---|---|
| 1 | **注册点 / `index.ts` 行的开工时点现取** | 本单**只读**（未重跑 `grep` / `wc` 于 `src/index.ts`；**行号取本单 `sed -n` 现读**，注册点 `68` = **转引** `p8-p6-recon.md §0`）；**若并发单元改了 `src/index.ts` ⇒ 该读数作废**（须重取） |
| 2 | **十一键「三真源逐键相等」的复跑** | **转引** `docs/audit/p6-b6-perm-seed.md §5-④` 的 `all_three_equal=true`；**本册未复跑该判据** |
| 3 | **`AG1`–`AG4` / `AR1`–`AR4` / §17.5(c) 判据的判负实跑** | **本单为规范单、零代码** ⇒ 判据**已写死、未实跑**（归实现单 + 质检单） |
| 4 | **`0023` / `0024` 两表在现库的行数与 `txid` 非空率** | **本册零库连接** ⇒ 转引 `p6-b6-audit-live.md`（`0023` 面 11/11）+ 批 7-B 产物（`0024` 面）；**审计台级读数 = `NOT_MEASURED`** |
| 5 | **`§7-16` 黑名单删除 / `data-layer §21` 门禁是否已被某实现单认领** | **本册未查认领清单** ⇒ `NOT_MEASURED`（**不假设已有认领方**；登记 `AT-R1`/`AT-R2`） |

### 17.8 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§7-16`**（费率键黑名单 ⇒ 删除；登记「`app_config` 合法键清单 / 写入门禁」归配置面） | **兑现** = 本节 §17.2 / §17.3 + `data-layer.spec` v0.10 §21（**`§7-16` 行体一字未动**；读法以本节 + §21 + 补注块 ㉜ 为准） |
| **`§7-23`**（保证金金额：机制先落地、数值待 Kevin；载体 `app_config` 键？待定） | **裁定更新** = `R-8-5`（**载体已定 = `app_config` 合法键**）+ 本节 §17.4（**键名 / 数值仍待定**；**`§7-23` 行体一字未动**） |
| **`§7-53`**（审计面分裂 · 待 P6 审计台立项时定） | **兑现** = 本节 §17.5（**并联读取 + 统一呈现 + `txid` 对账**；**不合并表、不迁移**）+ **7-62**（**`§7-53` 行体一字未动**；读法以本节 + 补注块 ㉛ 为准） |
| **`§1.11 Q8`**（复用既有权限键、不新造） | **承**：本节 §17.2 的映射表**零新增键** |
| **`§11.1`**（`0022` 十一键 · 单一真源） | **承**：本节 §17.2(a) 逐字引出十一键；**未改** `§11.1` 正文 |
| **`§11.2`**（`ops:` 键形状 `:581`；审计 + 日累计） | **承**：§17.3 的 `ops:<admin_uid>:setting:<key>`；§17.5 的 `result` 闭集与「只计 `applied`」 |
| **`§12.13`**（`0024` 已 apply 事实） | **承**：§17.5 引 `0024` 的表 / `txid` 列 |
| **`§12.1.1:3042`**（新权限键须 4 处同批改） | **承**：§17.2(a) 的「新增权限键本批不可行」 |

## §18 ★★ v2.3 · 批 8 首轮冻结「补正单」：`R-8-7` / `R-8-8` / `R-8-9` 落位 + 勘误块（`D-1`）+ 引用纪律 + 借码映射（**v2.3 新增 · 本节只追加 · 依据 = Zang §5.180 C 三条裁定 `R-8-7`/`R-8-8`/`R-8-9` + 独立质检单 `docs/qa/p8-spec-v22-v010-review.md`**）

> **本节性质**：把 **Zang §5.180 C 的三条裁定**从「已裁、未落位」升为**册内可定位的条文**（**收口 §7-62 / §7-63 / §7-64**）；把**质检单 `D-1`** 从「发现」升为**勘误块 + 长期纪律**；把 **`AG1`/`AG3` 的报错码与 `reason` 常量**钉死在**既有闭集**内（**零新增码**）；并把**两套切片编号**统一到 **Zang §5.179 C 定稿**。**本节不改任何既有行**（**`§7-62` / `§7-63` / `§7-64` / `§17` / `§12.1.1` 一字未动** —— 守「`git diff --numstat` 删除列 = 0」）。

### 18.1 开工锚（现取 · 逐项）

| 项 | 命令（现取） | 本单读数 |
|---|---|---|
| 上游对锚 | `git log --oneline -1` | **`664401a`**（= Zang §5.180 提交，含本单三条裁定原文）；被检提交 = **`7f62c98`**（v2.2 冻结） |
| 本册开工版本 / 规模 | `wc -l` / `wc -c` / `md5 -q docs/route-layer.spec.md` | **v2.2 · 4030 行 / 866484 B / md5 `55123bd0520d619621d5a66afab3e77b`** |
| 姊妹册开工版本 / 规模 | 同上（`docs/data-layer.spec.md`） | **v0.10 · 1174 行 / 309965 B / md5 `614a39ec40e8a874945a97456e1d1bef`** |
| **旧快照计数（现取 · 对 `HEAD`）** | `git ls-tree HEAD docs/versions/ \| awk '{print $4}' \| grep -c 'route-layer.spec.v'` / `… 'data-layer.spec.v'` | **route = 22**（`v0.1`…`v2.2`）；**data-layer = 10**（`v0.1`…`v0.10`）。**★ 诚实登记**：派单述「route 应已 22 个、**data-layer 应已 9 个**」；**现取 = 10**（`v0.10.md` 已于批 8 首轮随 v0.10 正文同批新建，见 `data-layer.spec` §21.7）⇒ **本单以现取为准**，**不做任何删除**。 |
| `docs/versions/` 未跟踪件 | `git status --porcelain docs/versions/` | **空**（无未跟踪快照） |
| **`D-1` 现取（三处错引的行锚）** | `sed -n '3042p' docs/route-layer.spec.md` | **空行**（**逐字读数 = 空**） |
| 同上 · 节头 | `sed -n '3080p' docs/route-layer.spec.md` | `#### 12.1.1 权限闸候选：11 键逐键（**现取调用面**）+ 「无键」口径 ⇒ 选**唯一**` |
| 同上 · 真实内容行 | `sed -n '3096p' docs/route-layer.spec.md` | **非空**（**逐字原文见 §18.5**）；`:3097` = **空行** |
| 同上 · 三处错引的命中行 | `grep -n '§12.1.1:3042' docs/route-layer.spec.md` | **`1798` / `3922` / `4030`**（**恰三处**） |
| **`O-3` 现取（`ops:` 幂等键写死）** | `git show HEAD:backend-ts/src/index.ts \| sed -n '1147p'` | `  const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings');` |
| **代码行锚的漂移警告（现取）** | `git show HEAD:backend-ts/src/index.ts \| md5 -q` vs `md5 -q backend-ts/src/index.ts` | **HEAD blob = `8116d88d918f0afac92cd6c95cb158f8`（2060 行）** vs **工作树 = `2feaa9547149e0a6aafd917547583159`** ⇒ **已不同**（并发实现单元在飞）。**⇒ 本节一切代码行锚一律注明「对 `HEAD` 现取」，实现单落盘后作废**（§18.9-4）。 |

### 18.2 ★★ `R-8-7` 落位：8 ⑦ 审计台读口 = **复用 `manage_points`**（**收口 `§7-62`**）

- **裁定（逐字引 Zang §5.180 C · `R-8-7`）**：**`R-8-7`** —— 8⑦ 审计台读口权限键 ⇒ **✅ 复用 `manage_points`**。
- **理由（逐字）**：**审计台内容 = 积分调账审计（`0023`）+ 退款审计（`0024`）**，正是 `manage_points` 的**动作面**；「**能调账者才看调账审计**」= **最小权限一致**。
- **★ `read_users` 标【已排除】（逐字）**：**不选 `read_users`**（**理由 = 读人域与资金审计面不符**）。⇒ **本册 v2.2 §7-62 行内的「候选」二字作废**（**行体原文保留不删** ⇒ 补注块 ㉝）；**不得**再把 `read_users` / `manage_users` 当可选项。
- **★ 独立「只读审计」键 ⇒ 跨批登记（写死）**：新权限键**须 4 处同批改**（`R-8-1` 的既有先例口径）—— **4 处逐字锚**：① `backend-ts/src/database.ts:11-23` 的 `ALL_ADMIN_PERMISSIONS`（11 键）常量；② `backend-ts/migrations/0022_admin_permission_seed.sql` 种子；③ `frontend/src/admin-utils.js:40-52` 兜底；④ **消费点**。**本批禁改 `migrations/**` 与代码 ⇒ 不可行** ⇒ **登记跨批**（**不在本批造键**）。
- **落点（写死）**：**8 ⑦ 审计台读口闸 = `requireAdmin(req, res, 'manage_points')`**；**读口 = 只读**（承 §17.5(b)「审计台只 SELECT」）；**路由 / 页面 = 批 8 ⑦ 切片**（**本单不实现**）。**§17.5(d) 的「权限键 = 停报项」自此读作「已裁 = `manage_points`」**（**旧行一字未动**）。
- **零新增键声明**：**本片零新增 / 零删除权限键**（11 键闭集**逐字不动**，`R-8-1`）。

### 18.3 ★★ `R-8-8` 落位：8 ④⑤ = **确认临时复用 `review_tasks`**（**收口 `§7-63`**）

- **裁定（逐字引 Zang §5.180 C · `R-8-8`）**：**✅ 确认临时复用 `review_tasks`** —— 两片本质均为**审核 / 审批**面（④ 自建单位审批、⑤ 合规审核 / 下架）。
- **★ 本单**新增的那一句（**补入「已落位者」**，逐字）：**「若 ⑤ 的 takedown 后续落成独立动作面 ⇒ 再报 Zang 裁」**。⇒ **实现方不得自行**为 takedown 造键 / 造权限面；**一经判定「独立动作面」⇒ 停手报裁**。
- **独立键 ⇒ 跨批**：`manage_currency` 等 ⇒ **跨批**（4 处同批改，锚同 §18.2）。
- **落点**：**8 ④⑤ 闸 = `review_tasks`**（现取消费面 = `index.ts:1350/1365/1381/1784/1808`，**转引本册 §17.2(b) 行** —— 该读数为 v2.2 现取；**本单未重跑**，见 §18.9-5）；**§7-63 的「须 Zang 确认」字样自此兑现**（**旧行一字未动** ⇒ 补注块 ㉞）。

### 18.4 ★★ `R-8-9` 落位：键名批准 = `listing_deposit_policy` + **入册时机**（**收口 `§7-64`**）

- **裁定（逐字引 Zang §5.180 C · `R-8-9` · 四项）**：
  ① **✅ 键名批准 = `listing_deposit_policy`**（**顶层 `snake_case`** / **`value` = jsonb object** / **字段 `camelCase`**，**风格与 `system_settings` 一致**）；
  ② **由 Jing 在 8③ 冻结时正式入 `AK1` 清单**（= `data-layer.spec` §21.1 的合法键清单条目域）；
  ③ **★ 8①/8② 实现单不得先行写入该键**；
  ④ **数值仍待 Kevin**（实现期**兜底常量标 `TODO: Kevin 定值`**；**下限校验机制先落地**）。
- **风格合规（承本册 §17.4 的四条命名约定 · 逐条相符，可复算）**：① 顶层 `snake_case` ✅（对照现取唯一先例 `system_settings`）；② `value` = jsonb object ✅（逐字引 `0017:77` 容器 CHECK；现实现只写 object）；③ 对象内字段 `camelCase` ✅；④ 词根取自既有域词 ✅（`listing_deposit` 为既有域词 + `_policy` 为既有名词 `commission_policy` 的后缀）⇒ **批准名不引入新风格、不造新词**。
- **★ 本单的边界（写死 · 防越权）**：**本单只声明「批准与入册时机」**：
  - **不得把该键当成已入册**：**现取合法键清单仍 = 恰 1 键 `system_settings`**（`data-layer.spec` §21.1）；**`AK2` 号本单不占用**；**`data-layer.spec` §21.1 未追加任何键行**。
  - ⇒ **该键现在写入仍必被拒**（`data-layer.spec` §21.2 `AG1`）—— **此即 `AG1` 的正面用例，本单不改其口径**。
  - **★ 8①/8② 禁写令**：**8①（`app_config` 管理）与 8②（费率 + 返佣权重）实现单不得先行写入 `listing_deposit_policy`**（**写入即 `400`**）。
- **入册动作的时机与承载（写死）**：**8③（= 定稿「上市保证金」片，见 §18.8）冻结时**，由**本册（Jing）**在 `data-layer.spec` §21.1 清单**追加一行**（键名 / 值类型 / 语义 / 许可写入方 / 是否参与计费）⇒ **该键自入册那一版起**才成为合法键（`data-layer.spec` §21.3 规则②）。**本单不入册。**
- **数值面**：**仍待 Kevin**（**本单不发明数值**）；实现期**兜底常量保留并标 `TODO: Kevin 定值`**；**下限校验机制先落地**（§17.4 已写死：读不到 / 非法 ⇒ **fail-closed 到常量**；低于下限 ⇒ `400 LEDGER_AMOUNT_NOT_POSITIVE` + `reason='BELOW_SERVER_FLOOR'`）。

### 18.5 ★★ 勘误块（`D-1`）：三处引「`§12.1.1:3042`」= **错锚点 + 非逐字引文**

> **本块性质**：**勘误**（**非改写**）。**三处旧行一字未改**（守「删除列 = 0」）⇒ 读该三行时**以本块为准**。

**（a）错引位置（逐字现取 · 恰三处）**：

| # | 位置（行锚） | 错引文案（逐字） |
|--:|---|---|
| ① | `docs/route-layer.spec.md:1798`（**§7 追加表 `7-63` 行内**） | 「**本批「新键不可行」**（先例 = 本册 **§12.1.1:3042** 逐字：新权限键须**4 处同批改** —— …）」 |
| ② | `docs/route-layer.spec.md:3922`（**§17.2(a) 闭集注**） | 「**新增权限键在本批不可行** —— 先例 = **本册 §12.1.1:3042** 逐字：「新权限键须 **4 处同批改**」（…）」 |
| ③ | `docs/route-layer.spec.md:4030`（**§17.8 引用关系表末行**） | 「**`§12.1.1:3042`**（新权限键须 4 处同批改） | **承**：§17.2(a) 的「新增权限键本批不可行」 |」 |

**（b）错因（逐条 · 现取）**：

1. **行锚错**：`sed -n '3042p' docs/route-layer.spec.md` ⇒ **输出 = 空行**（**逐字读数 = 空**）⇒ 该锚**不可定位任何内容**。
2. **引号内文案非逐字**：`§12.1.1` 的原文是 **①②③④ 四段枚举**（见下 (d)）；**原文中并无「新权限键须 4 处同批改」这一句** ⇒ ①②两处的**引号包裹的是转述**，**违反「逐字引」的可核性口径**（**正是本单新立的「引用纪律」所禁止的形态**，见 §18.6）。

**（c）正确锚点（现取 · 写死）**：**节头 = `§12.1.1` @ `:3080`**；**真实内容行 = `:3096`**（**单行**；`:3097` = **空行**）。⇒ **今后引该内容一律写 `§12.1.1:3096`**（或写节头 `§12.1.1`）。

**（d）逐字原文（`docs/route-layer.spec.md:3096` · **逐字** · 现取）**：

```
- **若 Zang 认为应改为新键** ⇒ **代价（不可在本批做）**：新键须 ① 新迁移（`admin_permission` + `admin_role_permission` 种子）② 后端真源 `backend-ts/src/database.ts:11-23` 的 `ALL_ADMIN_PERMISSIONS`（11 键）加键 ③ 前端兜底数组 `frontend/src/admin-utils.js:40-52`（11 键）加键 ④ `0022` 的 apply-time 自检断言（`<> 11 ⇒ RAISE`）**必须同批改**，否则**迁移自检必失败** ⇒ **三真源 + 迁移面 4 处** ⇒ 本批 **禁改 `migrations/**` 与代码** ⇒ **不可行**（登记 = §12.10 · Z1）。
```

**（e）实质结论不变（写死）**：**「4 处同批改」的语义与 `§12.1.1` 的枚举一致**（① 新迁移 → ② 真源常量加键 → ③ 前端兜底加键 → ④ `0022` apply-time 自检同批改）⇒ **本缺陷属「引证卫生」缺陷，非条文错误**；**三处旧行的结论（本批不可行）仍然成立**。

**（f）处置（写死）**：**不改旧行**（**三行原文一字未动**）；**读法以本块为准**；**今后凡引该内容 ⇒ 写 `§12.1.1:3096` 且逐字**（§18.6）。

### 18.6 ★★ 新纪律「引用纪律」（**本册已犯一次 = `D-1`**）

**（a）规则（三条 · 写死）**：

1. **现取**：权威册（本册 / `data-layer.spec` / `ledger.spec` / `commission.spec`）中**凡写「`文件:行`」**（含迁移简写 `00NN:<line>` 与册内 `§X.Y:<line>`），**必须对真源现取该行**（`sed -n '<行>p'` 或 `git show <rev>:<path>`），**且该行必须非空**。
2. **逐字**：**凡用引号包裹的内容，必须与真源逐字相等**；**转述不得放进引号** —— 转述可以写，但**必须显式标「转述」并同时给出可定位锚点**。
3. **缺陷判据（否定式 · 写死）**：**空行 / 不存在行（行数 < 引用行）/ 非逐字引文 —— 任一命中 = 缺陷**（**不是「口径差」，不享受「非阻塞」豁免**）。

**（b）可判负形态（写死 · 可机读 · 后人可据此做门）**：

| # | 断言（逐条必带） | 判负条件 |
|--:|---|---|
| ① | 抽取本册全部 `文件:行` 引用（含 `00NN:<line>` 与 `§X.Y:<line>`） | 抽取集**为空** ⇒ 门无效（**须显式声明「本册无此类引用」**，不得静默跳过） |
| ② | 逐条现取（**真源版本须写明：`HEAD` blob 或工作树**；两者不同时**必须声明取哪一个**） | **任一引用行 = 空行 / 不存在** ⇒ **判负** |
| ③ | 对**引号包裹**的文本，与真源做「**去 `**` 强调符 + 去首尾空白**」后**逐字比对** | **任一不等 ⇒ 判负**（**允许的差异仅为 `**` 强调符与首尾空白**；标点差异**不允许**） |
| ④ | 负对照（门自证有效性） | 把任一条引用的行号**改成 `+1`**（或把引文**改一个字**）⇒ 门**必须转红**；**不转红 = 门是假门** |

**（c）首例与追溯**：**首例 = `D-1`**（本册 v2.2 的三处 `§12.1.1:3042`）⇒ 处置见 **§18.5**（**勘误块承载、旧行不改**）。**追溯口径（写死）**：**新引用一律适用**；**旧行不因本纪律被改写**（守「删除列 = 0」）—— 但**旧行若被本纪律命中**（如 `D-1`），**必须由勘误块或后续版本的对照表给出正确锚**。

**（d）适用范围**：**本册 + 姊妹册 `data-layer.spec`**（其 v0.11 §22.3 同批登记）；**上游三册**（`ledger` / `commission` / `master-plan`）**被本册引用时同样适用本条纪律**。

### 18.7 ★★ 借码映射入册：`AG1` / `AG3` 的报错码 = **借 `LEDGER_AMOUNT_INVALID`（`400`）**

> **入册口径**：`data-layer.spec` §21.2 的 `AG1` 原文写「`400` + **既有码**（**不新造码**；具体码由实现单在既有入参类码内选定、并写明依据）」—— 本单**把该选择钉死**（**不留待实现单选**），**同批写入姊妹册 `data-layer.spec` v0.11 §22.2**（本册指路）。

| 条目 | 报错码（写死） | **授权锚（逐字）** | `details.reason`（**稳定常量**） | 附 |
|---|---|---|---|---|
| **`AG1`**（未知键 ⇒ 拒） | **`LEDGER_AMOUNT_INVALID`（`400`）** | **`ledger.spec` §14.3**（`:914` 节标题「参数非法 / 守卫情形的错误码映射（**P1a 借用方案**…已裁定）」+ `:942` 逐字「**`LEDGER_AMOUNT_INVALID` 是历史码名，本册不新增错误码**……自 v0.4 起被**兼用**作「**参数形状非法**」码」） | **`SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST`**（**逐字承 `data-layer.spec` §21.2 `AG1` 的占位写法**，**去掉尖括号占位符** ⇒ 成为稳定常量） | 另带 **`details.unknown_keys`（逐键列出，便于判负）** + `details.field` = **首个未知键** |
| **`AG3`②（类型不符 ⇒ 拒）** | **`LEDGER_AMOUNT_INVALID`（`400`）** | 同上 | **`SETTING_TYPE_INVALID`**（逐字承 §21.2 `AG3`② 已写死的常量） | 另带 `details.{field, expected, got}` |
| **`AG3`①（`value` 裸标量 ⇒ DB `23514`）** | **`LEDGER_AMOUNT_INVALID`（`400`）** | 同上 + `ledger.spec` §14.3 附「其余 `23514` ⇒ `input` / `LEDGER_AMOUNT_INVALID`」（逐字） | **本单不发明第三个常量** —— **在 `ledger.spec` §14.3 既有 `reason` 词表内由实现单选定并写明依据**（**沿用「禁裸 `500`」口径**） | **`AG3`① 经唯一写口不可达**（`database.ts:2880` 恒以对象入 `JSON.stringify`）⇒ 属**防直连 / 防未来**型（见 §18.8 与 delta §D5） |

- **★ 驳回 `LEDGER_UNKNOWN_KIND`（写死 · 附理由）**：该码的语义 = **账务 `kind` 闭集**（`ledger.spec` §14.3 附逐字：「`ledger_kind_enum` ⇒ **`input`**（`LEDGER_UNKNOWN_KIND` `400`）」）⇒ **与 `app_config` 的键面无关**；**借用它会把「配置键名非法」误报成「账务 kind 非法」**（**误导排查方向、污染闭集语义**）⇒ **明确驳回**。
- **★ 不得新增码（写死）**：**闭集 33 不动**（`ledger.spec` §14.1 的 33 个错误码关闭集**不增不减**；`LEDGER_AMOUNT_INVALID` = 该闭集内的**既有码**，本单**只借用、不新造**）。
- **一致性核对（可复算）**：`AG1` / `AG3` 的**码**与**状态类**（`400`）与 `ledger.spec` 的 `bucket ↔ 状态类` 冻结映射相符（`input ⇒ 400 类`）⇒ **不破映射**。

### 18.8 补正登记（切片编号对齐 + 其余细目指路）

**（a）★ 切片编号对齐（写死 · 以 Zang §5.179 C 定稿为准）**：本册 v2.2 §17.2(b) 用的是**八片标法（8①…8⑧）**，而 **Zang §5.179 C 的定稿切片编号 = 8①..8⑥（六片，⑥ 用户与权限不成片）** ⇒ **今后一律按定稿编号读**（**本册 §17.2(b) / §17.8 的旧标法一字未改** ⇒ 守「删除列 = 0」；读法以本表为准）：

| 本册 v2.2 旧标法（**未改**） | **Zang §5.179 C 定稿** | 说明 |
|---|---|---|
| 8 ① `app_config` 管理（本片） | **8①** | 同物 |
| 8 ② 费率配置 **+** 8 ③ 返佣权重矩阵 | **8②**（**合为一片**） | 同一 `commission_policy` 写口 + 同一后台页 ⇒ 定稿合并 |
| 8 ④ 自建单位审核 | **8④** | 同物 |
| 8 ⑤ 合规审核 | **8⑤** | 同物 |
| 8 ⑥ 用户与权限 | **—（不成片）** | `R-8-6`：降为 `R-7E-6`（keys 收敛）+ 权限闸复用 |
| 8 ⑦ 资产与流水审计台 | **8⑥** | **定稿 8⑥ = 审计台**（`R-8-7` 的读口键按此片读） |
| 8 ⑧ ＝ 8 ⑤ 保证金规则（§17.2(b) 口径注自注**同物**） | **8③** | **定稿 8③ = 上市保证金「可配置 + 退市退还」** ⇒ **`R-8-9` 的「8③ 冻结时入 `AK1`」= 本片**（**§17.4 / §7-64 的「候选」与「8 ⑤/8 ⑧」标法按本表读**） |

> **★ 一句话（写死）**：**凡本册出现「8③ 冻结」⇒ 指「上市保证金片」**；**凡出现「8⑦ 审计台」⇒ 定稿 8⑥**；**「8⑤ / 8⑧ 保证金」= 定稿 8③**。

**（b）其余登记（**逐条细目写入 delta 件 §D4–§D6**，本节只给指路）**：

| 条目 | 摘要 | 细目 |
|---|---|---|
| **`O-3`** | **新键的 `ops:` 幂等键必须按 key 派生、不得写死常量** —— 现取 `index.ts:1147` **写死** `'system_settings'`（**已现取逐字**，见 §18.1）⇒ 新增第二个合法键时 `ops:` 键会落**同一命名空间** | delta §D4（含「须随目标键分化」的判据与判负形态） |
| **`D-2`** | **`AG2`（越权面 ⇒ 拒）无现取静默吸收点** ⇒ **预防性不变量标注**（**现取写 `app_config` 恰 1 处**） | delta §D5 |
| **`D-3`** | **`AG3`① 经唯一写口不可达** ⇒ **预防性不变量标注**（DB 层兜底 / 防直连 / 防未来写路径） | delta §D5 |
| **`D-4`** | **`AG4`（不得静默放行）= 元规则**，判负用例与 `AG1` 同点 ⇒ **预防性不变量标注** | delta §D5 |
| **★ 共同口径** | **`D-2` / `D-3` / `D-4` 一律标为「预防性不变量（现取无违反）」** —— **不得**当成「已证违规」、**不得**据此开缺陷单；其价值 = **防回归的类级约束**（**各有可复算真源**：`AG2` 的写语句 1 处 / `AG3`① 的 `0017:77` CHECK 与 `0017:323-324` 自检 / `AG4` 的判负用例） | delta §D5 |

### 18.9 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **8 ⑦ 审计台读口（`manage_points` 闸）的实现面** | **本单为规范单、零代码** ⇒ **键已裁、未实现**（路由 / 页面 / 读口归「接该面的实现单」）；**无对象可测** |
| 2 | **`manage_points` 是否已在现库 `admin_role_permission` 面覆盖审计台读口** | **本册零库连接** ⇒ **无现库读数**（键在 `0022` 十一键内 + `admin_role_permission` 全量 = **转引**，非本单现取） |
| 3 | **`AG1` / `AG3` 借码与 `reason` 常量的判负实跑** | **零代码** ⇒ **码 / 常量已写死、未实跑**（归实现单 + 质检单） |
| 4 | **`D-1` 三处行锚与 `§12.1.1:3096` 在实现单落盘后是否仍指向同一行** | **行锚漂移风险**：`backend-ts/src/index.ts` 的 `HEAD` blob 与工作树**已不同**（§18.1）⇒ 代码行锚**必然漂移**；**本册自身 spec 文件未被并发单触碰**（**本单 spec 现值成立**）⇒ **实现单落盘后须重锚** |
| 5 | **`review_tasks` 现消费面行号（`index.ts:1350/1365/1381/1784/1808`）的复核** | **转引**本册 §17.2(b) 的 v2.2 现取；**本单未重跑该 `grep`**（且 `index.ts` 已漂移）⇒ **该读数按 `HEAD`/时点成立，工作树面 = `NOT_MEASURED`** |
| 6 | **「引用纪律」的判负门本体（机读扫描脚本）** | **本单只立纪律与判负形态（§18.6）** ⇒ **门未实现、未跑**（**§18.6(b) 的第 ④ 条负对照未执行**） |

### 18.10 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§7-62`**（审计台读口权限键 · 停报） | **兑现** = 本节 §18.2 + 新增 **7-65** + 补注块 ㉝（**行体一字未动**；「候选 `read_users` / `manage_users`」**作废**） |
| **`§7-63`**（8 ④⑤ 权限键 · 待确认） | **兑现** = 本节 §18.3 + 新增 **7-66** + 补注块 ㉞（**行体一字未动**；**补入 takedown 附带条件**） |
| **`§7-64`**（载体键名 + 数值 · 待 Zang / Kevin） | **兑现** = 本节 §18.4 + 新增 **7-67** + 补注块 ㉟（**行体一字未动**；「候选」**作废**、**数值仍待 Kevin**、**本单不入册**） |
| **`§17.2(b)` 的 8 ⑦ 行 / 8 ④⑤ 行 / 末行（保证金）** | **读法更新** = **§18.8(a) 的切片编号对照表**（**旧标法按定稿编号读**；**表体一字未动**） |
| **`§17.5(d)`**（「权限键 = 停报项」） | **读法更新** = 本节 §18.2（**已裁 = `manage_points`**；**旧行一字未动**） |
| **`§12.1.1`**（新权限键须 4 处同批改） | **★ 勘误** = 本节 **§18.5**（正确锚 **`:3080`（节头）· `:3096`（内容行）**；**该节一字未改**） |
| **`§17.8` 末行 `§12.1.1:3042`** | **同上**：**该行一字未动**，**读法以 §18.5 为准**（**错锚已勘误**） |
| **`data-layer.spec` §21.1 / §21.2 / §21.4**（合法键清单 / `AG1`–`AG4` / 载体键登记） | **同批姊妹册 v0.11 §22**：`AG1`/`AG3` 借码与 `reason` 常量**入册** + `R-8-9` 命名批准与入册时机；**本册只指路、不重抄**（清单**仍 = 恰 1 键**） |
| **`ledger.spec` §14.3 / §14.1** | **只读引用**（借用码授权 + 33 码闭集）；**本单未改其一字** |
| **`§1.11 Q8`**（复用既有权限键、不新造） | **承**：`R-8-7` / `R-8-8` 均在 11 键内选键，**零新增键** |



## §19 ★★ v2.4 · 批 8 第 2 片（8②）契约冻结：费率配置 + 返佣权重矩阵（**合片**）—— 读写口契约 + 新增 admin 读口注册点登记 + 权限键映射 + 「真生效」四段判据 + 后台页数据契约与四语文案面 + `R-8-14` 基线声明（**v2.4 新增 · 本节只追加 · 依据 = 批 8 第 2 片（8②）派单 + Zang 已裁 `R-8-1` / `R-8-6` / 「真生效」判据（P6 的 AC 原文）/ `R-8-14`**）

> **本节性质**：把 **8②**（**定稿切片号 = 8②**；「费率配置」+「返佣权重矩阵」**定稿合为一片**，真源 = 本册 **§18.8(a)** 的切片编号对照表；**本册 v2.2 §17.2(b)** 用的**旧标法「8 ② + 8 ③」= 同物**）的**读写口**从**半成品**升为**可执行契约**。
> **★ 盘点结论（本单现取 · 三条）**：**① 费率配置 = 半成品**（**写口已在、真写库在、缺后台页**）；**② 返佣权重矩阵 = 半成品**（**同一写口 + 守卫 + 算法已在、缺矩阵 UI**）；**③ 读口（两片共用）= 现取无 ⇒ 本单冻结新增**。三册里**只有分配口径**（本册 §4.2 的 R2 / R3 行 + `data-layer.spec` 的 `DL2` / `DL70` / `DL152`）⇒ **读写口契约 = 本单首立**。
> **★ 真源册（逐字 · 含路径勘误）**：派单写「真源册 = `docs/audit/commission.spec.md`（只读）」；**本单现取 = 该路径不存在**（`docs/audit/` 现取为**审计件目录**，无 `commission.spec.md`）⇒ **实际真源 = `docs/commission.spec.md`**（**226740 B**；`docs/versions/commission.spec.v0.1.md` / `v0.2.md` 在场）。**两者指向同一册，本单按现行路径读，只读、未改一字**（登记 = §8.26.3-②）。
> **纪律（写死）**：① **只追加**（**非追加改动 = 0 处**；`git diff --numstat` 删除列 = **0**，见 §8.26.5 / §8.26.6）；② **零代码 / 零迁移 / 库面只读 / 零 HTTP / 零套件**；③ **不发明**路径名 / 权限键 / 键名 / **费率数值** / **权重数值** / **四语文案值** / 日期 / 错误码（无先例处一律**停报**并登记 `待 Zang / Kevin`）；④ **`R-8-1` 硬口径**：**只在既有 11 权限键内选键，零新增 / 零删除**；**找不到合适键 ⇒ 停下报裁、严禁硬造**；⑤ **`R-8-6` 硬口径**：**返佣的行为验收只许 DB 直造 + 读库**；**不得为验收新增路由**（**运营后台读口 ≠ 验收路由** —— **两者不得混同**，判负见 §19.2(e)）；⑥ **★ 数值一律现取或待给**（**费率 / 权重数值** = 由**既有表值现取**（`data-layer.spec` §17.2 `DL152` 的「预期组合」= 现取读数，**已标来源、非本单发明**）或**待 Kevin**；**本单不写入任何新数值**）。

### 19.0 开工锚（现取 · 逐项）

| 项 | 命令 | 本单现取读数 |
|---|---|---|
| 本册开工版本 | `grep -c '^> \*\*状态：v2.3' docs/route-layer.spec.md` | **v2.3**（命中 **1** 行；状态块位于 `:199-208` 区） |
| 本册开工行数 / 字节 / md5 | `wc -l` / `wc -c` / `md5 -q` | **4253 行 / 910180 B / md5 `8965216101d970173a5311a41a5dd688`**（**= 与派单给定对锚逐字相符** ✅） |
| 最新快照 | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.3.md` | **退出码 0**（`v2.3.md` 与现档**逐字节相同** ⇒ 改前正文可独立复核）。**本册约定 = 快照命名取「新版本号」+ 改后正文** ⇒ 本单**新建** `docs/versions/route-layer.spec.v2.4.md`（与改后正文 `cmp` = 0） |
| 注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68**（**本单现取**；与派单给定基线 **68** 逐字相符；`wc -l backend-ts/src/index.ts` = **2105**） |
| 姊妹册 / 真源册开工锚（**逐册各自现取 · 不沿用任何转引**） | `wc -l` / `wc -c` / `md5 -q` | `docs/data-layer.spec.md` = **1288 行 / 331129 B / md5 `5227775f12ef747cf55001c421814340`**（v0.11；**= 与派单给定对锚逐字相符** ✅；**本单判「无须动」**，理由逐字见 delta 件 §D7）；`docs/commission.spec.md` = **226740 B**（**真源册 · 只读 · 本单未改一字**） |
| 旧快照计数 | `ls docs/versions/ \| grep -c '^route-layer.spec.v'` / `... \| grep -c '^data-layer.spec.v'` | **route = 23** / **data-layer = 11**（**= 与派单给定逐字相符** ✅） |
| 后备锚（旧快照零改动判据用） | `git status --porcelain docs/versions/` | **本单未删 / 未改任何既有快照**（新建 `v2.4.md` 一个新快照） |

### 19.1 ★★ 现取盘点（结论 · 逐项带锚）

| 面 | 现取锚（本单 `sed -n` / `grep` 亲读） | 现取读数 | 盘点结论 |
|---|---|---|---|
| **费率配置 · 写口** | `grep -nE "^app\.(get\|post\|put\|delete\|patch)\('/api/(admin\|referral)" backend-ts/src/index.ts` 现取 | 命中 **`:1999`** `app.post('/api/admin/commission_policy', …)` | **已在** ⇒ **半成品 · 写口成品** |
| **费率配置 · 真写库** | `src/commission.ts:240` `insertCommissionPolicy` → `:247` `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by) SELECT $1::integer, $2::smallint, $3::smallint[], COALESCE($4::timestamptz, now()), $5::bigint WHERE NOT EXISTS (SELECT 1 FROM commission_policy WHERE effective_from >= COALESCE($4::timestamptz, now()))` | **在**（**单条 `INSERT … SELECT … WHERE NOT EXISTS`**；**CR8：INSERT-only、永不 `UPDATE`**） | **成品** |
| **费率配置 · 后台页** | `ls frontend/src/pages/admin/` 现取 = `PermissionsManagement.jsx` / `PointsManagement.jsx` / `RewardsManagement.jsx` / `ShardsManagement.jsx` / `SystemSettings.jsx` / `TasksManagement.jsx` / `UsersManagement.jsx`（**恰 7 个**）；`grep -n 'path="' frontend/src/App.jsx` 现取 admin 路由段 = `:237`–`:243`（**7 条，无费率 / 佣金页**） | **无** | **★ 缺口 = 后台页** |
| **返佣权重矩阵 · 写口** | **同** `POST /api/admin/commission_policy`（`levels` / `weights_bp` 随**同一政策行**插入；服务层入参 `InsertPolicyInput` = `{ fee_rate_bp, levels, weights_bp, effective_from?, created_by }`，`src/commission.ts:224-232`） | **同一写口**（**无独立写口** ⇒ **合片的结构依据**） | **半成品** |
| **返佣权重矩阵 · 守卫** | `src/commission.ts:167-192` `guardCommissionPolicy`（写时 `stage='write'` ⇒ **`400`**）；DB 侧 `backend-ts/migrations/0007_referral_and_commission_policy.sql:120` `commission_policy_weights_guard()`（**`23514`** 兜底） | **在**（逐条：`fee_rate_bp ∈ [100,500]` / `levels ∈ [1,10]` / `weights_bp.length == levels` / 逐元素非负整数 / `Σ weights_bp ≤ 10000` / `Σ = 0` ⇒ 拒 / `weights_bp[0] = 0` ⇒ 拒） | **成品** |
| **返佣权重矩阵 · 算法** | `src/commission.ts:432` `splitPool(pool, weights)`（**最大余数法**，`Σx_L == P` **构造保证**）；`src/commission.ts:391` `computeFee`（`fee = (gross × fee_rate_bp + 5000) / 10000`）；DB 侧同核 = `backend-ts/migrations/0013_job.sql:250` `public.job_settle_plan(...)`（`:292` 逐字 `SELECT cp.fee_rate_bp, cp.levels, cp.weights_bp`） | **在** | **成品** |
| **返佣权重矩阵 · 矩阵 UI** | 同上（**7 个 admin 页无矩阵页**） | **无** | **★ 缺口 = 矩阵 UI** |
| **读口（费率 / 权重）** | `grep -n 'commission_policy' backend-ts/src/index.ts` 现取 = 命中 `:1133` / `:1135` / `:1171` / `:1179`（**均 `app_config` 面的「费率不在本表」注文**）+ `:1999` / `:2019`（**写口**）⇒ **无任何 `GET` 读口**；`grep -rn 'getCommissionPolicy' backend-ts/src/` 现取 = 命中 `src/commission.ts:10`（头注）/ `:201`（定义）/ `:615`（**模块内消费**）⇒ **导出面只被模块内部消费** | **无** | **★ 缺口 = admin 读口** |
| **`ops:` 幂等键（写口）** | `grep -n 'ops:' backend-ts/src/index.ts` 现取 = `:44` / `:1160` / `:1248` / `:1278` / `:1300` / `:1513` / `:1559`（**无 `:1999` 区**）；`resolveAdminOpsKey` 调用面现取 = `:1161` / `:1249` / `:1279` / `:1301` / `:1560`（**无 commission_policy**） | **无** | **★ 缺口（登记 `§7-69`）** |
| **权限键（写口）** | `src/index.ts:2000` `const actor = await requireAdmin(req, res, 'manage_settings');` | **命名键 `manage_settings`**（**非无键 `requireAdmin`**） | **成品** |

> **★ 本表口径（写死）**：**「结果」列每一项均有本单独立现取锚，未转引任何批次报告**；**「无」= 本单 `grep` 现取命中 0**（**不是**「未查」）。

### 19.2 ★★ 读写口契约

**（a）写口契约（现取 · 逐字）**

| 项 | 逐字读数 | 锚（本单现取） |
|---|---|---|
| 路径 / 方法 | `POST /api/admin/commission_policy` | `backend-ts/src/index.ts:1999` |
| 闸 | `requireAdmin(req, res, 'manage_settings')`（**命名权限键**） | `backend-ts/src/index.ts:2000` |
| `ops:` 幂等键形态 | **现取 = 无**（该端点**未调** `resolveAdminOpsKey`）；**同族对照** = `POST /api/admin/settings` 形态 `resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings')` ⇒ 规范形 `ops:<admin_uid>:setting:<key>` | `backend-ts/src/index.ts:1161`（同族） |
| 入参（服务层） | `InsertPolicyInput` = `{ fee_rate_bp, levels, weights_bp, effective_from?, created_by }` | `backend-ts/src/commission.ts:224-232` |
| 真写库点 | 单条 `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by) SELECT … WHERE NOT EXISTS (SELECT 1 FROM commission_policy WHERE effective_from >= COALESCE($4::timestamptz, now()))` | `backend-ts/src/commission.ts:247-253` |
| 写入语义 | **INSERT-only / 永不 `UPDATE`**（CR8）；`effective_from` **只准严格递增**（CR25，禁止回填）；**无分录**（政策表非账本）；DB 侧 `trg_commission_policy_append_only`（`BEFORE UPDATE OR DELETE`）兜底 | `backend-ts/src/commission.ts:236-238`；`migrations/0007_referral_and_commission_policy.sql:102-112` |
| 失败面 | 应用层守卫先判（`stage='write'` ⇒ **`400`** `LEDGER_AMOUNT_INVALID` + `details.reason` ∈ 既有常量集）；DB 侧 `23514` ⇒ `input` ⇒ **`400`**（**同码同 status**） | `src/commission.ts:167-192`；`migrations/0007:120-140` |
| 成功形状 | `sendSuccess(res, policy, 'Commission policy inserted')` ⇒ `{success:true, message, data:<CommissionPolicy 8 键>}` | `src/index.ts:2017`；`sendSuccess` = `src/index.ts:100-115` |
| 错误形状 | **R107**：`{error:{code, message, i18n_key, details}}` | 本册 §3.3（条款 9′）/ §15.5 / §15.6 |
| 幂等（业务面） | **`effective_from` 唯一性**（DB `UNIQUE`）+ **同刻重投** ⇒ 无行 ⇒ **`400` `POLICY_EFFECTIVE_BACKDATED`** ⇒ 结构上不产生重复生效版本 | `migrations/0007:97`；`src/commission.ts:257-263` |

**（b）读口契约 —— ★ 本单冻结新增（逐字登记 · **新增读口，非为验收凑数**；依据 = §19.2(e)）**

| 项 | 冻结值（本单钉死） | 依据 / 先例（现取） |
|---|---|---|
| 路径 / 方法 | **`GET /api/admin/commission_policy`** | **★ 非发明**：路径名**逐字取自既有已注册路径** `backend-ts/src/index.ts:1999`（**只换 verb**）；**同路径同族先例** = `GET /api/admin/settings`（`:1127`）+ `POST /api/admin/settings`（`:1156`）**读 / 写对**（本册 §17.3(a) 同款用法） |
| 闸 | **`requireAdmin(req, res, 'manage_settings')`**（与写口**同键**；`R-8-1` 的 11 键内） | 本册 §17.2(b) 的 **8 ② 行**；`§1.11 Q8`（复用既有权限键、不新造） |
| 注册点 | **68 → 69**（**逐字登记**：`grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` 现取 = **68** ⇒ 本读口落地后 = **69**） | 本册 **§1.14** 计数真源；本节 §19.0 |
| 响应形状（**R107 口径**） | **成功** = `{success:true, message, data:{…}}`（`sendSuccess` 形状）；**失败** = **R107** `{error:{code, message, i18n_key, details}}` —— `code` = **机读唯一真源** / `i18n_key` = **本地化真源**（`ledger.err.<CODE>`）/ `message` = **人类可读稳定英文句**（**严禁填机读码**） | `sendSuccess` = `src/index.ts:100-115`；本册 §3.3 条款 9′ / §15.5 / §15.6 |
| `data` 形状（**逐键冻结**） | **`CommissionPolicy` 恰 8 键（现取 · 不得增删）**：`policy_id`(string) / `fee_rate_bp`(number) / `levels`(number) / `weights_bp`(number[]) / `effective_from`(string ISO) / `created_by`(string) / `time_created`(string) / `weights_sum_bp`(number，**归一化 Σ，读时算一次**) | **唯一真源** = `backend-ts/src/commission.ts:122-131`（`interface CommissionPolicy`）+ `:145-155`（`mapPolicy`）**逐键现取**；**承本册 §2 母约束 F1**（端点响应 key 集冻结；本口为**新增端点** ⇒ **键集自本单起冻结**） |
| `ops:` 幂等键 | **无**（读口无副作用 ⇒ **不需** `ops:` 键；先例 = `GET /api/admin/settings`（`:1127-1135`）亦无） | 本册 §17.3(a) 读口行 |
| 只读纪律 | **只 `SELECT`**；**不得**引入任何写路径、**不得**借读口补写 / 回填 / 修正政策行（政策表 **append-only**） | `migrations/0007:102-112`；口径同本册 §17.5(b) |
| 索引 | **不得**为读口新增索引（政策表 **19 行**量级 = `data-layer.spec` §17.2 `DL152` 现取读数；承 `DL70` / `DL74` 的「**不为这些读口新增索引**」口径） | `data-layer.spec` §17.2 `DL152`；`DL70`；`DL74` |
| 迁移面 | **零迁移 / 零 DDL**（表 `commission_policy` 与两列均在既有迁移 `0007` 内） | `migrations/0007:81-99` |

**（c）读口取数口径（写死 · 与业务读口同一真源）**：读口取「当前生效政策」= **`policy(T) := SELECT * FROM commission_policy WHERE effective_from <= T ORDER BY effective_from DESC LIMIT 1`**（**`T` = DB `now()`**；**CR4：事件时刻不得由调用方传入**）—— **逐字照抄** `src/commission.ts:196-201` 的 `getCommissionPolicy` 语义（**读口必须复用该函数或其 SQL，不得自写第二套取数**）；**`at` 参数不得暴露为对外查询参数**（`src/commission.ts:199` 逐字：「传值仅供应质检脚本复现…**不是**服务层可用参数」）。

**（d）响应 `data` 的两种可接受形态（**本单只钉死键集，不钉死包装**）**：
- **形态 A（推荐 · 零新增键）**：`data` = **`CommissionPolicy` 8 键本体**（即与写口成功响应的 `data` **同形**）⇒ **费率页与权重矩阵页共用同一读口** —— **这正是「合片」的数据面依据**。
- **形态 B（若实现单需历史列表）**：`data = { effective: <8 键>, history: <8 键数组> }` ⇒ **须在实现单显式声明**，且 `history` 元素**必须**与 `effective` **同键集**（**不得两套键**）。
- **★ 本单不裁定 A / B**（**属实现选型**；两者**键集来源同一** ⇒ 与 §2 母约束 F1 **均相符**）；**登记 = §19.8 `I-1`**。

**（e）★ 为何新增读口属「功能需求」而非「为验收凑数」（逐字 · 防混同）**：
- **`R-8-6` 逐字**：「返佣的**行为验收只许 DB 直造 + 读库**；**不得为验收新增路由**。（但**运营后台需要读口才能展示矩阵** ⇒ 那是**功能需求**，允许新增，**必须在本册冻结并登记注册点 68 → N** —— 两者不得混同。）」
- **本单落位**：**行为验收路线（§19.4）= DB 直造 + 读库，零新增路由**；**运营后台读口（§19.2(b)）= 功能需求，本单冻结并登记注册点 68 → 69**。**两条线在所有权、载体与判据上完全分离**（**验收线** = `psql` 直连 / `INSERT` 政策行 / `SELECT` 账本；**功能线** = HTTP `GET` + 后台页）。
- **★ 双向判负（写死）**：**(i)** 若把 §19.4 的任一段验收读数写成**依赖 `GET /api/admin/commission_policy`** ⇒ **违反 `R-8-6`**（**验收不得依赖新增路由**）；**(ii)** 反之，若以「`R-8-6` 禁止新增路由」为由**拒绝实现该读口** ⇒ **即把「验收路由」与「功能读口」混同**（**两句必须同时成立**）。

**（f）本读口**不**改变任何既有端点的响应键集**：**新增端点**，**既有 68 条注册点的 key 集一字未动**（承 §2 母约束 F1）。

### 19.3 ★★ 权限键映射（**先现取逐字十一键，再给映射；`R-8-1` 履约**）

**（a）既有十一权限键（逐字 · 现取 · 三真源）**：

> **真源 A（后端唯一真源）** = `backend-ts/src/database.ts:11-23` `const ALL_ADMIN_PERMISSIONS = [ … ] as const`，**逐键现取**：
> `dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · `review_tasks`（**恰 11 键**）
> **真源 B（迁移种子）** = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`（**11 行** `INSERT INTO public.admin_permission (permission_key, name) VALUES …`；**键集逐键相等**；apply-time 自检 `:112-132` = `count(*) <> 11 ⇒ RAISE` + 缺键 / 多键各自 `RAISE` ⇒ **整迁移回滚、不写版本行**）。
> **真源 C（前端兜底）** = `frontend/src/admin-utils.js:40-52`（**11 键**，逐键现取）。
> **★ 三真源逐键相等**：**机器判据 `all_three_equal=true` = 转引** `docs/audit/p6-b6-perm-seed.md §5-④`（**本册未复跑该判据**）；**本单独立现取复核 = 三处键集逐键相同**（`sed -n` 亲读三档）⇒ **本单现取结论与转引一致**。
> **★ 闭集（写死）**：**恰好 11 键，不增不减**（`R-8-1`）。**新增权限键在本批不可行**（**4 处同批改**：`database.ts:11-23` 常量 / `0022` 种子 / `frontend/src/admin-utils.js:40-52` 兜底 / 消费点 —— **正确锚 = §12.1.1 节头 `:3136`、内容行 `:3152`**，见 §19.6）。

**（b）8②「所需权限 → 既有键」映射表**：

| 口 | 所需权限（语义） | → **既有键（11 键内）** | 依据 / 说明（现取） |
|---|---|---|---|
| **写口** `POST /api/admin/commission_policy` | 写费率政策 + 权重矩阵（**同口同 `INSERT`**） | **`manage_settings`** | **现取**：`src/index.ts:1999`（注册行）/ `:2000`（闸）；与 §17.2(b) 的 **8 ② 行**（`manage_settings`）**逐字一致**；`0022:60` 中文名 = 「系统设置」 |
| **新增读口** `GET /api/admin/commission_policy` | 读现行费率 + 权重矩阵（**只读**） | **`manage_settings`** | **同键**（**读写同权**）；先例 = `GET` + `POST /api/admin/settings` **同闸 `manage_settings`**（`src/index.ts:1127-1128` / `:1156-1157` 现取） |
| **后台页**（费率页 + 权重矩阵页） | 进入管理后台 + 读写上述两口 | **`manage_settings`** + **`dashboard_access`**（进面板） | 先例 = `frontend/src/App.jsx:243` `<Route path="settings" … requiredPermission="manage_settings">`（**同族**）；`dashboard_access` = `ALL_ADMIN_PERMISSIONS` 首键（面板入口） |

> **★ 映射表口径（写死）**：**逐行给死**；**凡找不到合适键 ⇒ 显式写「无 ⇒ 停报」**（**不得**填一个「看起来像」的键凑数）。**本表无「停报」行**（**读写两口 + 两页均落在 `manage_settings`**）。
> **★ `R-8-1` 履约声明（写死）**：本表**零新增键 / 零删除键**（11 键闭集**逐字不动**）；**未出现的键 = 不存在**。
> **★ 与 §17.2 的关系（写死）**：本表是 §17.2(b) 的 **8 ② 行 / 8 ③ 行**（**旧标法**）的**定稿编号重述 + 读口补全**（**§17.2(b) 表体一字未动** —— 守「删除列 = 0」；「8② / 8③」**合为 8②** 的依据 = 本册 **§18.8(a)** 对照表）。

### 19.4 ★★ 「真生效」四段判据（**每项配置四段可判负读数；不得只验「后台能存」**）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**本单把它落成四段**：**① 后台写 → ② 库内落值（给表 / 列）→ ③ 业务读口取数（给 `文件:行`）→ ④ 行为随之（改动前 / 改动后两读数）**；**每段必须能判负**（**改开关 / 改值 ⇒ 读数必变**）。**★ 不得只验「后台能存」**（**「`POST` 返回 200」= 零证据**）。

**（a）判据模板（四段 · 逐段必带「判负形态」）**：

| 段 | 读数内容（必给） | **判负形态（必带）** |
|--:|---|---|
| **① 后台写** | 写口路径 + 方法 + 闸 + 请求体（逐字）+ 响应（status + `data` 键集） | **缺闸 / 闸降级 ⇒ 判负**；**响应 `data` 键集 ≠ 冻结键集 ⇒ 判负** |
| **② 库内落值** | **表名 + 列名 + 该行取值**（逐字 SQL / `SELECT` 读数） | **表 / 列处该值未随之变 ⇒ 判负**（**「后台能存但库内没落」= 判负**） |
| **③ 业务读口取数** | **业务侧取数函数 / SQL 的逐字锚**（`文件:行`）+ 其读数 | **业务读口取到的仍是旧值 ⇒ 判负**（**「库内有新值但业务不读」= 判负**） |
| **④ 行为随之** | **同一个可直接观察的业务量**（金额 / 分录 / 分配额），**改动前 / 改动后两读数** | **改动后该业务量不变 ⇒ 判负**（**这正是「非只在后台显示」的正面判据**） |

**（b）判据 ① · 项 = `fee_rate_bp`（费率）**：

| 段 | 内容 | 依据（现取锚） |
|--:|---|---|
| ① 后台写 | `POST /api/admin/commission_policy`（闸 `manage_settings`），body 含 `fee_rate_bp` | `src/index.ts:1999-2000` |
| ② 库内落值 | **表 `commission_policy` / 列 `fee_rate_bp`（`integer`，CHECK `BETWEEN 100 AND 500`）**；取现行 = `SELECT fee_rate_bp FROM commission_policy ORDER BY effective_from DESC LIMIT 1` | `migrations/0007:92`（列 + CHECK）；`migrations/0007:84-99`（表体）；`src/commission.ts:208`（读列逐字） |
| ③ 业务读口取数 | **`src/commission.ts:201` `getCommissionPolicy`**（`:207-215` 的 `SELECT … FROM commission_policy WHERE effective_from <= COALESCE($1::timestamptz, now()) ORDER BY effective_from DESC LIMIT 1`）与 **DB 侧 `public.job_settle_plan`**（`migrations/0013_job.sql:292` `SELECT cp.fee_rate_bp, cp.levels, cp.weights_bp`） | `src/commission.ts:201-215`；`migrations/0013_job.sql:250,292` |
| ④ 行为随之 | **`fee = (gross × fee_rate_bp + 5000) / 10000`**（**全项目唯一取整点**，CR38）⇒ **下一笔招工结算**（`job_post_event(op='settle')`）的 **`job_fee` 分录金额随之变**（`fee > 0` 时；`fee = 0` 退化 ⇒ **不写** `job_fee` / **不写** `commission` / **不报错**，CR51） | `src/commission.ts:391-393`；`migrations/0013_job.sql:242`（同式逐字）；本册 §4.2 的 J5 行 |

> **判负（写死 · 至少两条）**：**(i)** 同一 `gross`、改 `fee_rate_bp` 前后**两次结算的 `job_fee` 金额相等 ⇒ 判负**；**(ii)** 后台 `POST` 返回 **200** 但 `SELECT fee_rate_bp … ORDER BY effective_from DESC LIMIT 1` **未变 ⇒ 判负**（**此条正面封堵「只验后台能存」**）。
> **★ 数值纪律（写死）**：**本单不写入任何费率数值**；「预期组合」`fee_rate_bp = 100` = **现取读数**（`data-layer.spec` §17.2 `DL152` 逐字；`docs/data-layer.spec.md:114`）⇒ **引用即标明来源**，**不得**当作本单的发明或新裁定。

**（c）判据 ② · 项 = `weights_bp`（返佣权重矩阵）**：

| 段 | 内容 | 依据（现取锚） |
|--:|---|---|
| ① 后台写 | **同一写口** `POST /api/admin/commission_policy`，body 含 `levels` + `weights_bp` | `src/index.ts:1999-2000` |
| ② 库内落值 | **表 `commission_policy` / 列 `weights_bp`（`smallint[]`）** + 列 `levels`（`smallint`）；DB 约束 = `array_length(weights_bp, 1) = levels` / `0 <= ALL(weights_bp)`；**★ 类型事实**：`weights_bp` **实测 = `smallint[]`**（**按 `int[]` 比较会报 `operator does not exist: smallint[] = integer[]`**） | `migrations/0007:93-95`；**类型事实 = `data-layer.spec` §17.2 `DL152` 逐字** |
| ③ 业务读口取数 | **`src/commission.ts:432` `splitPool(pool, weights)`**（**最大余数法**：`q_L = P·w_L/W`（整除）/ `r_L = P·w_L mod W` / `D = P − Σq_L` 按 `(r_L DESC, L DESC)` 补 1 ⇒ **`Σx_L == P` 构造保证**）；DB 侧同核 = `job_settle_plan` | `src/commission.ts:12-14,432-483`；`migrations/0013_job.sql:250,336-360` |
| ④ 行为随之 | **`commission` 分录各层分配额 `x_L`** + 分录 `weight_bp` 字段（`src/commission.ts:634` `weight_bp: String(weights[i])`）**随之变**；**不变量仍成立** = `Σx_L == fee` **逐分不差**（构造保证）**且** `-2` 池进出守恒（`migrations/0007:317` `trg_ledger_entry_commission_conservation`，失败抛 `LD032` ⇒ 500 defect + 告警） | `src/commission.ts:620-660`；`migrations/0007:317`；本册 §4.2 的 R2 行 |

> **判负（写死 · 至少两条）**：**(i)** 同一 `fee`、改 `weights_bp` 前后**两次结算的 `commission` 各层 `x_L` 逐层相等 ⇒ 判负**；**(ii)** 改 `weights_bp` 后 **`Σx_L != fee`** 或 **`-2` 池进出不守恒（`LD032` 触发）⇒ 判负**（**守恒断言必须仍绿**）。
> **★ 权重数值纪律（写死）**：**本单不写入任何权重数值**；「预期组合」`weights_bp = {3000,2000,1500,1000,800,600,500,300,200,100}` / `levels = 10` = **现取读数**（`data-layer.spec` §17.2 `DL152`；`docs/data-layer.spec.md:114`）⇒ **引用即标明来源**。

**（d）★★ 四段的「可判负」总判据（写死 · 机读形态）**：

| # | 断言 | 判负条件 |
|--:|---|---|
| ① | **四段齐全**（①→②→③→④） | **只给 ①②（或只给「后台 200」）⇒ 判负**（**「只验后台能存」的形态**） |
| ② | ② 段**必须给表名 + 列名**（**不得**只写「已保存」） | ② 段无表 / 列 ⇒ **判负** |
| ③ | ③ 段**必须给业务侧取数的 `文件:行` 锚** | 只给后台读口（HTTP）当「业务读口」⇒ **判负**（**后台读口 ≠ 业务读口**，§19.2(e)） |
| ④ | ④ 段**必须给「改动前 / 改动后」两读数**，且**为同一业务量** | 只给改动后单读数 ⇒ **判负** |
| ⑤ | **每段各带判负形态**（上表 ①② 项下已逐条给出） | 任一段无判负形态 ⇒ **判负** |
| ⑥ | **负对照（门自证）**：把任一段的读数**改成常量**（如把 ④ 段写死为改动前的值）⇒ 该门**必须转红** | **不转红 = 门是假门** |

**（e）执行面（`R-8-6` 逐字 · **验收路线**）**：**本判据的实跑只许 DB 直造 + 读库** —— **政策行直造**（`INSERT INTO commission_policy …`，走既有 `append-only` + `weights_guard` 两道 DB 闸）/ **账本直读**（`SELECT … FROM ledger_entry WHERE event_root_key = 'biz:job:settle:<job_id>'`）；**不得**为验收新增 HTTP 路由、**不得**以 `GET /api/admin/commission_policy` 承载验收读数（§19.2(e)）。**★ 本单不实跑**（**零库连接**）⇒ 判据**已写死、未实跑** ⇒ 登记 `NOT_MEASURED`（§19.7-3）。

**（f）`NOT_MEASURED` 与「待给」（逐项 · 禁填 0 / 空）**：
- **费率 / 权重的「当前生效值」** = **转引现取读数**（`data-layer.spec` §17.2 `DL152`；**本单零库连接 ⇒ 未复取现库**）⇒ **若现库末行 ≠ 该读数 ⇒ 须以现库为准并登记**（**本单不假定**）。
- **后台页不得内嵌具体经济数值**（**本单不写任何费率 / 权重数值**；页面展示的数值 = **运行时从读口取**）。

### 19.5 ★★ 后台页数据契约与四语文案面

**（a）费率页（`FeeRatePage`）数据契约**：

| 字段（页面用） | 来源（**唯一 = §19.2(b) 读口**） | 说明 |
|---|---|---|
| `fee_rate_bp` | 读口 `data.fee_rate_bp` | **整数基点**（`100–500`）⇒ **展示层换算为百分比**（`fee_rate_bp / 100` %）—— **换算在展示层，不改变数值语义**（**bp = 唯一存储真源**） |
| 可编辑范围 | **写口守卫**（`[100,500]`） | **前端不得自造范围** ⇒ 逐字承 `src/commission.ts:175` |
| `effective_from` | 读口 `data.effective_from` | 现行政策生效时刻（**只读展示**） |
| `created_by` / `time_created` / `policy_id` | 读口同名键 | **审计面展示**（**只读**） |
| `weights_sum_bp` | 读口 `data.weights_sum_bp` | **归一化 Σ**（读时算一次）—— 费率页**只展示、不编辑** |

**（b）权重矩阵页（`ReferralWeightMatrixPage`）数据契约**：

| 字段（页面用） | 来源 | 说明 |
|---|---|---|
| `levels` | 读口 `data.levels` | **层数**（`1–10`）⇒ 矩阵**行数** |
| `weights_bp[1..levels]` | 读口 `data.weights_bp` | **逐层权重**（bp；`smallint[]` **原序**）⇒ 矩阵每行的权重单元格 |
| `weights_sum_bp` | 读口 `data.weights_sum_bp` | **Σ 校验显示**（**上限 = 10000**，逐字承 `src/commission.ts:188`） |
| **归一化分母 `W`（各层）** | **页面派生** = `Σ_{L≤M} w_L`（`M = min(levels, chain_depth)`） | **★ 不是读口字段** —— 它是**分配时**的派生量（`src/commission.ts:660` / `migrations/0013_job.sql`）；页面**可预演、不得当存储值** |
| **`weights_bp[1] > 0`** | **写口守卫**（`src/commission.ts:191`：`weights_bp[0] === 0 ⇒ POLICY_WEIGHTS_ALL_ZERO`） | **前端表单必须同判**（防提交必被拒的值） |
| 退化分母面 | **写口 guard + DB guard 双闸** | `Σ = 0` ⇒ 拒（`src/commission.ts:190`）；`Σ > 10000` ⇒ 拒（`:188`） |

**（c）★ 四语文案面（写死 · **禁工程口径泄漏**）**：

- **语言面（现取）= 四语**：`frontend/src/locales/{zh,en,hk,vn}.json`（**逐文件现取**：`ls frontend/src/locales/` = `en.json` / `hk.json` / `vn.json` / `zh.json`；**四文件顶层键数均 = 103**，**命名空间清单逐字相同**）。
- **命名空间约定（写死 · 不得自拟新风格）**：承**既有 `admin*` 前缀先例**（现取 = `admin_panel` / `adminNav` / `adminLayout` / `adminCommon` / `adminTasks` / `adminRewards` / `adminPermissions` / `adminPoints` / `adminShards` / `adminSettings` / `adminUsers`；**四语一致**）⇒ **本片新增命名空间 = `adminFeeRate`（费率页）+ `adminWeightMatrix`（权重矩阵页）**；**词根取自既有域词**（`fee_rate_bp` / `weights_bp` / `commission_policy`）。
  - **★ 键名 = 待实现单按本条约定落**（**本单只给约定 + 命名空间 + 必须存在的键语义；不发明键名清单** —— 与 §17.4 的「键名 / 数值待 Zang / Kevin」**同口径**：**本单给约定、不给可用清单**）；**登记 = §19.8 `I-2`**。
  - **★ 四语必须逐键齐**（承 §16.3 的「四语键集相等」口径）：`zh` / `en` / `hk` / `vn` 四文件**同名键同在**，**缺任一语 ⇒ 判负**。
- **★ 禁工程口径泄漏（写死 · 可判负）**：**用户可见文案**（`t(...)` 的**值**面）**不得**出现下列任一：

  | # | 禁项 | 例（**不得出现在文案里**） |
  |--:|---|---|
  | ① | **本册章节号 / 条号** | `§19.2` / `§7-16` / `R-8-1` |
  | ② | **HTTP 状态码** | `400` / `403` / `500` |
  | ③ | **接口路径 / 方法** | `/api/admin/commission_policy` / `POST` |
  | ④ | **内部批次名 / 单号** | `8②` / `P6` / `B8` / `JING-SPEC-B8-2` |
  | ⑤ | **机读码 / 裸 i18n 键** | `POLICY_SHAPE_INVALID` / `adminFeeRate.title`（**承 §14.3 / §15.6 / §16**） |
  | ⑥ | **表名 / 列名 / 函数名** | `commission_policy` / `weights_bp` / `job_settle_plan` |

  - **判负形态（写死）**：**对四语 locale 的 `adminFeeRate*` / `adminWeightMatrix*` 键值做正则扫描**（命中上述六类任一模 = **判负**）；**负对照** = 人为把一条文案改成 `"费率（§19.2）"` ⇒ **扫描必须转红**（**不转红 = 假门**）。**登记 = §19.8 `I-7`**。
  - **★ 文案「值」= 产品 / 文案决策**（**本单不写四语文案内容**）。
  - **★ 工程口径可现于「开发者可见面」**：日志 / 调试 / **非本地化客户端**（**即 R107 的 `message` 面**）**不受本条约束**（**逐字承 §3.3 条款 9′ / §15.5**）。

**（d）页面 → 权限 → 路由（写死 · 与 §19.3(b) 一致）**：`frontend/src/App.jsx` 的 admin 路由段（现取 `:237-243`，**7 条**）**追加两条**：费率页 = `requiredPermission="manage_settings"`、权重矩阵页 = **同键**；**★ 前端路由行号 = 待实现单现取**（**本单零代码**）；**先例逐字** = `:243` `<Route path="settings" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><SystemSettings /></ProtectedRoute>} />`。

**（e）页面「保存」面（写死）**：**唯一写口 = `POST /api/admin/commission_policy`**（闸 `manage_settings`）；**页面不得另开写路径**；**两页共用同一写口**（**合片的结构依据**：`levels` / `weights_bp` 与 `fee_rate_bp` **同属一行政策**）。

**（f）★ `ops:` 键（写死 · 登记缺口）**：写口现取**无** `ops:` 键（§19.2(a)）⇒ **页面保存的幂等性 = 现取无保障**；**本单不改代码** ⇒ **登记 `§7-69`**（**候选形态（不构成裁定）** = `ops:<admin_uid>:commission_policy:<effective_from>`，**承 `data-layer.spec:591` 的既有命名法**；**由实现单 / Zang 定**）。

**（g）`NOT_MEASURED`**：**页面本体尚未存在** ⇒ **逐页的字段级实现面 = `NOT_MEASURED`**（**本单只冻结契约，零代码**；见 §19.7-5）。

### 19.6 ★★ `R-8-14` 基线声明（**攒批项 · 本单落**）

> **`R-8-14` 逐字**：`route-layer.spec` **§18.5** 的「现取命令」`sed -n '3042p'` **只在 v2.2 基线成立**、在 v2.3 正文不复现，而该节**未声明版本基线** —— 恰是它自己 **§18.6(a)2** 所立纪律所要求者 ⇒ **补版本基线声明**（锚点属 v2.2 基线、4030 行；并说明现行版行号已漂）。

**（a）声明（写死 · 版本基线）**：**`§18.5` 与 `§18.1` 的全部 `:NNNN` 行锚及「现取命令」读数的基线 = `docs/versions/route-layer.spec.v2.2.md`（4030 行 = v2.2 时点的本册正文）**；**该两节未声明基线 ⇒ 本单补此声明**（**两节正文一字未改** —— 勘误 / 声明**只由本节 + 补注块 ㊱ 承载**，守「删除列 = 0」）。

**（b）逐条 `v2.2 → v2.3` 漂移对照（**本单现取 · 逐条亲读两档**）**：

| # | `§18.5` / `§18.1` 引的锚 / 命令 | **v2.2 基线读数（4030 行）** | **现行 v2.3 读数（4253 行）** | 漂移 |
|--:|---|---|---|---|
| ① | `docs/route-layer.spec.md:1798`（**§18.5(a)①** 的「§7 追加表 `7-63` 行内」） | `\| **7-63（v2.2 新增）** \| …`（**命中**） | **`:1810`** = 同文（`sed -n '1810p'` 现取 = `\| **7-63（v2.2 新增）** \| …`） | **+12** |
| ② | `sed -n '3042p'`（**§18.5(b)1** 的「现取命令」） | **空行**（`sed -n '3042p' docs/versions/route-layer.spec.v2.2.md` 输出 = **空**；两侧 `:3041` = `**C · 审计面真值（…）**`、`:3043` = `\| 面 \| 读数（本册现取） \|`） | **`:3042` = 正文行**（现取 = `- **★ 26 个 IO 出口统一走分类器**（转引 …`）⇒ **「空行」读数在 v2.3 不复现**；**该空行的 v2.3 对应位 = `:3098`**（现取空行；两侧 `:3097` = `**C · 审计面真值（…）**`、`:3099` = `\| 面 \| 读数（本册现取） \|`） | **不复现**（同一命令在 v2.3 = **输出正文行**）；对应空行 **`:3042 → :3098`（+56）** |
| ③ | `§12.1.1` **节头** `:3080`（**§18.5(c)** 的「正确锚」） | `#### 12.1.1 权限闸候选：11 键逐键（**现取调用面**）+ 「无键」口径 ⇒ 选**唯一**`（**命中**） | **`:3136`** = 同文 | **+56** |
| ④ | `§12.1.1` **内容行** `:3096`（**§18.5(c)/(d)** 的「逐字原文」行） | `- **若 Zang 认为应改为新键** ⇒ **代价（不可在本批做）**：新键须 ① …`（**命中**） | **`:3152`** = 同文 | **+56** |
| ⑤ | `docs/route-layer.spec.md:3922`（**§18.5(a)②** 的「§17.2(a) 闭集注」） | `> **★ 闭集（写死）**：**恰好 11 键，不增不减**（`R-8-1`）…`（**命中**） | **`:3978`** = 同文 | **+56** |
| ⑥ | `docs/route-layer.spec.md:4030`（**§18.5(a)③** 的「§17.8 引用关系表末行」） | `\| **`§12.1.1:3042`**（新权限键须 4 处同批改） \| **承**：§17.2(a) 的「新增权限键本批不可行」 \|`（**命中**） | **`:4086`** = 同文 | **+56** |
| ⑦ | **`§18.1` 现取**的 `grep -n '§12.1.1:3042' docs/route-layer.spec.md` = **`1798` / `3922` / `4030`（恰三处）** | **`1798` / `3922` / `4030`**（**v2.2 时点**） | **本单现取同一命令 = `1810` / `3978` / `4086`（恰三处）** | **+12 / +56 / +56** |

> **★ 结论（写死 · 三条）**：**(i)** §18.5 / §18.1 的**全部 `:NNNN` 行锚 = v2.2 基线**（**两节均未声明**，本单补）；**(ii)** 漂移**不均匀**（`7-63` 行 **+12**，其后各锚 **+56**）⇒ **不得**用「统一 `+Δ`」推算（**原因 = v2.3 在 `:1798 → :3080` 之间另有插入**：§7 v2.3 追加表 4 行 + §8.1 表 1 行 + §8.25 新节）；**(iii)** **同一命令的语义读数会变**（`sed -n '3042p'`：v2.2 = **空行** / v2.3 = **正文行**）⇒ **这正是 §18.6(a)2「真源版本须写明」的直接后果**（**未写版本 ⇒ 引证不可复现**）。

**（c）可判负形态（写死 · 承 §18.6(b)）**：
- 断言 **`sed -n '3042p' docs/versions/route-layer.spec.v2.2.md` 输出 = 空行**（**v2.2 基线成立**）｜**判负 = 输出非空**。
- 断言 **`sed -n '3042p' docs/route-layer.spec.md` 输出 = 非空行**（**v2.3 = 正文行**）｜**判负 = 输出为空**（**即：若某日后本册行数回落致该声明失效 ⇒ 必须重取**）。
- 断言 **`grep -n '§12.1.1:3042' docs/route-layer.spec.md` = 恰三处、行号 `1810` / `3978` / `4086`**｜**判负 = 处数 ≠ 3 或任一不等**（**本单现取读数**）。
- **负对照**：把上表任一「v2.3 读数」列改成 `+1` ⇒ 断言**必须转红**。

**（d）后续版本纪律（写死 · 承 §18.6 + 本条）**：**凡引「`文件:行`」，必须写明真源版本**（`HEAD` blob / 工作树 / **具体快照文件名**）；**册内锚另须写「本册 vX.Y 时点」**；**凡引 `sed -n '<行>p'` 的读数，必须同时给「命令 + 版本 + 期望输出（空 / 非空）」三件**。

### 19.7 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **新增读口（`GET /api/admin/commission_policy`）的实现面** | **本单为规范单、零代码** ⇒ **路径 / 形状 / 闸已冻结，未实现**（路由 / 承载函数归「接该面的实现单」）；**无对象可测** |
| 2 | **注册点 69 的实取读数** | **本册零代码** ⇒ **68 → 69 为「预期」而非现取**（**现取基线 = 68**，本单现取）；**读口落地前无 69 可数** |
| 3 | **§19.4 四段判据的判负实跑** | **零代码 / 零库连接** ⇒ 判据**已写死、未实跑**（归实现单 + 质检单）；**四段 + 每段判负形态 = 已给，实跑 = 未做** |
| 4 | **费率 / 权重的「当前生效值」在现库的现取复核** | **本册零库连接** ⇒ 现取值 = **转引** `data-layer.spec` §17.2 `DL152`（**该册 v0.2 时点读数**）；**本单未连库复取**；**若现库末行 ≠ 该读数 ⇒ 以现库为准并登记** |
| 5 | **页面本体（费率页 / 权重矩阵页）与 `adminFeeRate*` / `adminWeightMatrix*` 键的实际落键** | **本单零代码** ⇒ **命名空间约定已给、键清单未落**（**本单不发明键名清单**）；**文案「值」= 产品决策，本单不写** |
| 6 | **写口 `ops:` 键缺口的修复** | **本单只登记**（`§7-69`）⇒ **修复归实现单**；**修复后若键形态落定，须回写本节 §19.2(a) 的读数** |
| 7 | **`data-layer.spec` 是否须动** | **本单判定 = 无须动**（理由逐字见 delta 件 §D7）⇒ **该判定未由第三方复核**（**转引型风险**）；**若 Zang 认为读口须在数据层登记 ⇒ 另开 `data-layer` 追加单**（**本单不擅自升 v0.12**） |

### 19.8 实施登记（**交「接该面的实现单」，本册不实现**）

| 条目 | 待办 | 依据 |
|---|---|---|
| **`I-1`** | **读口响应 `data` 形态 A / B 的选型**（§19.2(d)）；**选定后回写本节** | `R-8-6`；§19.2(d) |
| **`I-2`** | **后台页四语文案（`adminFeeRate*` / `adminWeightMatrix*`）的文案值 + 键清单** | §19.5(c)；**产品 / 文案决策**（**本单不写**） |
| **`I-3`** | **新增 admin 读口落地**（`GET /api/admin/commission_policy`；闸 `manage_settings`；**注册点 68 → 69**） | 本节 §19.2(b)；`R-8-6`（**功能需求**） |
| **`I-4`** | **写口 `ops:` 幂等键补齐**（§19.2(a) 现取 = 无；形态待定） | **`§7-69`**；同族 = `src/index.ts:1161` |
| **`I-5`** | **费率页 + 权重矩阵页两页实现**（**共用同一写口**；读口取数） | 本节 §19.5；`R-8-6` |
| **`I-6`** | **§19.4 四段判据的实跑**（**DB 直造 + 读库**，**不得新增路由**） | **`R-8-6` 逐字**；§19.4(e) |
| **`I-7`** | **§19.5(c)「禁工程口径泄漏」扫描门落地**（四语 locale 键值正则 + 负对照） | §19.5(c)；承 §15.6 |
| **`I-8`** | **本单 §19.6 的漂移对照表在实现单落盘后的重取**（代码行锚必漂；册内锚以现盘为准） | §19.6(b)/(d)；本册 §18.9-4 同口径 |

### 19.9 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§17.2(b)` 的 8 ② / 8 ③ 行**（费率配置 / 返佣权重矩阵 → `manage_settings`） | **定稿编号重述 + 读口补全** = 本节 §19.3(b)（**旧标法按 §18.8(a) 对照表读 = 8②**；**表体一字未动**） |
| **`§17.3` 的 `AR1`–`AR4`**（`app_config` 面写口准入） | **同构承接**：本节 §19.2(b) 的读口契约**承同一先例族**（`GET` + `POST` 同路径对）；**`AR` 条目本身不动**（**其作用域 = `app_config`**，本节**不扩其射程**） |
| **`§1.11 Q8`**（复用既有权限键、不新造） | **承**：本节 §19.3 的映射表**零新增键** |
| **`§1.14`**（注册点计数真源 68） | **承**：本节 §19.2(b) 的 **68 → 69** = 对 §1.14 计数真源的**增量登记**（**§1.14 表体一字未动**） |
| **`§18.5`**（`D-1` 勘误块）· **`§18.1`**（v2.3 开工锚表） | **★ 补版本基线声明** = 本节 §19.6 + **补注块 ㊱**（**两节正文一字未动**；**读法以本节为准**） |
| **`§18.6`**（引用纪律） | **承 + 加严**：§19.6(d) 追加「引 `sed -n` 读数须给**命令 + 版本 + 期望输出**三件」 |
| **`§4.2` 的 R2 / R3 行**（返佣分配 / 变更佣金政策） | **只读引用**（算法与守卫锚）；**本单未改其一字** |
| **`§7-16`**（费率真源唯一 + 读取侧纪律） | **承**：本节**费率真源 = `commission_policy.fee_rate_bp`**，**永不读 `app_config`**；**`§7-16` 行体一字未动** |
| **`data-layer.spec` §17.2 `DL152`**（政策表回归判据 + 夹具禁令） | **只读引用**（费率 / 权重「预期组合」的现取读数来源）；**本单未改其一字** |
| **`data-layer.spec` §21 / §22**（`app_config` 合法键面 / `AG1`–`AG4` / `R-8-9`） | **无涉** —— 本节**不碰 `app_config` 面**（**费率真源 = `commission_policy`**，§7-16 读取侧纪律）；**`listing_deposit_policy` 与本片无关**（其入册时机 = 8③，`§7-67`） |
| **`docs/commission.spec.md`（真源册 · 只读）** | **只读引用**（分配口径 / CR8 / CR23 / CR25 / CR38 / CR39 / CR51）；**本单未改其一字**。**★ 路径勘误**：派单写 `docs/audit/commission.spec.md` ⇒ **现取不存在**；**实际 = `docs/commission.spec.md`**（本节开头已声明；登记 = §8.26.3-②） |

## §20 ★★ v2.5 · 批 8 第 3 片（8③）契约冻结：上市保证金「可配置 + 退市退还」—— 载体键入册（`AK2`）+ 下限校验机制（数值待 Kevin）+ 权限键映射 + 「真生效」四段判据 + 退市退还 ↔ 既有 `hold_release` 路径 + `hold_forfeit` 禁线（**v2.5 新增 · 本节只追加 · 依据 = 批 8 第 3 片（8③）派单 + Zang 已裁 `R-8-2` / `R-8-1` / `R-8-5` / `R-8-9` + P6 的「真生效」AC 原文**）

> **本节性质**：把 **8③**（**定稿切片号 = 8③** = 「**上市保证金（可配置 + 退市退还）**」；旧标法「8 ⑤ 保证金规则」「8 ⑧ ＝ 8 ⑤」**同物** —— 真源 = 本册 **§18.8(a)** 切片编号对照表 + **§19** 的读法）从**未决登记**升为**可执行契约**；并**兑现 `R-8-9` 的入册时机**（键名 = `listing_deposit_policy`；**入册动作落在姊妹册 `data-layer.spec` v0.12 §23.1 的 `AK2` 行**，**本册只指路、不重抄**）。
> **纪律（写死）**：① **只追加**（**非追加改动 = 0 处**；`git diff --numstat` 删除列 = **0**，见 §8.27.6）；② **零代码 / 零迁移 / 库面只读 / 零 HTTP / 零套件**；③ **不发明** 路径名 / 权限键 / 键名 / **保证金数值** / 错误码 / 日期（无先例处一律**停报**并登记 `待 Zang / Kevin`）；④ **`R-8-1` 硬口径**：**只在既有 11 权限键内选键，零新增 / 零删除**；**找不到合适键 ⇒ 停下报裁、严禁硬造**；⑤ **`R-8-2` 硬口径（本片最易踩雷的一条 · 逐字）**：保证金片**仅**做「**(a) 上市保证金金额可配置 + (b) 退市退还走既有 `hold_release` 路径**」；**严禁实现 `hold_forfeit`、严禁复活任何已删名**（冻结口径：**`hold_release` = `frozen → balance`**；**`hold_forfeit` = `DL91` 未启用、无可罚没标的物**）；⑥ **数值一律现取或待给**（**本单不写入任何保证金数值**；兜底常量标 `TODO: Kevin 定值`）。
> ★ **开工对锚判明（本单第一件事 · 逐字 · 派单要求判明「4589 vs 4590」）**：派单述「派单方亲测 `wc -l` = **4589**、而交付方自报 **4590** ⇒ 差 1 请判明」。**判明结论（现取 · 可复算）= 两个数都对，差 1 的全部原因 = 「末行不带换行符」**：`wc -l` **只数换行符（`\n`）个数** ⇒ 末行（逐字 = `---`）**不带 `\n`** ⇒ 报 **4589**；而**逻辑行数计法**（编辑器 / 行数解析器）把这条无换行的末行**也计为 1 行** ⇒ 报 **4590**。**逐条现取读数（本单亲取）**：① `wc -l docs/route-layer.spec.md` = **4589**；② `wc -c` = **975847 B**；③ `md5 -q` = **`f518221361e36c5492df198abdae5c2d`**；④ `tail -c 3 docs/route-layer.spec.md | xxd` = **`00000000: 2d2d 2d`**（逐字 = `---`，**其后无 `0a`**）；⑤ `sed -n '4590p' docs/route-layer.spec.md | wc -l` = **0**（**该行不自带换行 ⇒ `sed` 打印不带 `\n`**）；⑥ **逻辑行数 = 4590**（本单以行数解析器现读，返回 `total_lines = 4590`，末行内容 = `---`）。⇒ **本册此后一切「行数」读数一律写清口径**（`wc -l` = 换行数 / 逻辑行数），**且本册自身的追加一律插在末行 `---` 之前**（**理由 = 机器判据**：直接「在末行之后追加」会把该行由「无换行」改写为「带换行」⇒ `git diff --numstat` **必记 1 个删除**（本单已用最小复现件实测：**追加法 = `4 1`**（1 删除）vs **插在 `---` 之前 = `3 0`**（零删除））⇒ **违「删除列 = 0」硬口径** ⇒ **本单取后者**）。

### 20.0 开工锚（现取 · 逐项）

| 项 | 命令（现取） | 本单读数 |
|---|---|---|
| 上游对锚 | `git log --oneline -1` | **`679d87a`**（= 8② 契约冻结 route v2.4 的提交） |
| 本册开工版本 / 规模 | `grep -c '^> \*\*状态：v2.4' docs/route-layer.spec.md` + `wc -l` / `wc -c` / `md5 -q` | **v2.4**（状态块命中 **1** 行）；**`wc -l` = 4589 行 / 975847 B / md5 `f518221361e36c5492df198abdae5c2d`**（**= 与派单给定对锚逐字相符** ✅）；**逻辑行数 = 4590**（口径见节首判明） |
| 姊妹册开工版本 / 规模 | `wc -l` / `wc -c` / `md5 -q docs/data-layer.spec.md` | **v0.11 · 1288 行 / 331129 B / md5 `5227775f12ef747cf55001c421814340`**（**= 与派单给定对锚逐字相符** ✅；**本单改它** ⇒ 就地升 **v0.12** + 快照 + delta） |
| **旧快照计数（现取）** | `ls docs/versions/ \| grep -c '^route-layer.spec.v'` / `… \| grep -c '^data-layer.spec.v'` | **route = 24**（`v0.1` … `v2.4`）/ **data-layer = 11**（`v0.1` … `v0.11`）—— **与派单给定（route 应 24 / data-layer 应 11）逐字相符** ✅。**★ 对照**：批 8② 单 §19.0 现取时为 **23 / 11** ⇒ **route 的 +1 = `v2.4.md`**（已随 8② 同批新建）⇒ **本单以现取为准，不做任何删除**；**改前快照 = `v2.4.md` / `v0.11.md`（开工前既存、本单未动）** |
| `docs/versions/` 与 `docs/` 未提交件 | `git status --porcelain docs/` | **空**（本册开工时点 ⇒ 无并发单正在改 spec / 快照） |
| **注册点（现取）** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **69**（`wc -l backend-ts/src/index.ts` = **2130**）。**★ 与 v2.4 记载（68 / 2105 行）不同，差 = +1 条路由**：现取命中 = **`app.get('/api/admin/commission_policy', …)` @ `:2036`**（**= 8② 的 `§7-70` 冻结读口已落盘**）⇒ **本单的注册点基线现取 = 69**（**v2.4 §19.2(b) 的「68 → 69」已由实现单兑现**；本单**零新增对外路径** ⇒ **69 → 69**，§20.2(b)） |
| 四件源码的现取指纹（代码行锚时点） | `md5 -q` + `wc -l`（`index.ts` / `database.ts` / `currency-service.ts` / `ledger.ts`） | `index.ts` = **`3cf5f00ad112297e1c40a5475252cfa2`（2130 行）** / `database.ts` = **`5aed34e4f771969004b3f42ddda0bb1d`（4093 行）** / `currency-service.ts` = **`14c0ed1cda2a4004d60524c649c39e5e`（449 行）** / `ledger.ts` = **`364825f51089351b37cf6b3ee03d8d10`（1521 行）** ⇒ **本节一切代码行锚 = 上述四件「本单现取时点」**；**实现单落盘后作废、须重锚**（承 §19.6(d) 的「引 `sed -n` 须给命令 + 版本 + 期望输出」） |
| **册内行锚基线（本单实遇 · 承 `R-8-14` 的基线纪律 · 写死）** | `grep -n '^| \*\*DL67\*\*\|^| \*\*DL88\*\*\|^| \*\*DL91\*\*' docs/{,versions/}data-layer.spec.md` | **本单现取的两组读数**：`docs/data-layer.spec.md`（**v0.12 现盘**）⇒ `DL67` @ **`:460`** / `DL88` @ **`:536`** / `DL91` @ **`:539`**；`docs/versions/data-layer.spec.v0.11.md`（**v0.11 基线**）⇒ `DL67` @ **`:459`** / `DL88` @ **`:535`** / `DL91` @ **`:538`** ⇒ **差 = 恰 +1**（原因 = 姊妹册 v0.12 在**顶部插入 1 行状态块**）。⇒ **本节凡引这三条的册内行锚，一律写「v0.11 基线 `:N` ⇒ 本版现取 `:N+1`」两件**（承 `R-8-14`：**引 `文件:行` 必须写明真源版本**）；**只给一个数的引法 = 缺陷** |

### 20.1 现取盘点（读写口 / 键寻址面 / 退市面 · 逐项带锚）

| 面 | 现取锚（本单 `sed -n` / `grep` 亲读） | 现取读数 | 盘点结论 |
|---|---|---|---|
| **保证金配置的写口** | `backend-ts/src/index.ts:1157` | `app.post('/api/admin/settings', async (req, res) => {`；闸 = `:1158`；`ops:` 键 = `:1162`；费率键闸 = `:1175`；门禁 = `:1192` | **已在** ⇒ **复用 · 不新增**（`data-layer.spec` §21.2 `AG2`：**其它面一律不得写 `app_config`**） |
| **写落点（唯一）** | `backend-ts/src/database.ts:3085` | `INSERT INTO public.app_config (key, value, updated_by, time_updated)`（`key` 字面写死 `'system_settings'`）；定义 = `:3075` `saveSystemSettings`；写侧断言 = `:852` `assertSystemSettingsPatch` | **已在** ⇒ **本片零新落点** |
| **合法键清单（代码面 · 现取）** | `backend-ts/src/database.ts:47` | `export const APP_CONFIG_LEGAL_KEYS = ['system_settings'] as const;` | **现取 = 恰 1 键** ⇒ **`AK2` 入册后须由实现单同轮改该常量**（**否则在册 ≠ 放行** ⇒ §20.4 判负） |
| **门禁判据本体（★ 字段级）** | `database.ts:775`（`validateSystemSettingsPatch`）/ `:863`（`screenSystemSettingsWrite`）/ `:77-82`（`SETTINGS_WRITE_REASONS`） | 未知键分支 ⇒ 逐键 `unknown_keys` + `code='LEDGER_AMOUNT_INVALID'` + `reason = 'SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'`（**`R-8-10`：稳定常量、不随键名插值**）；路由层 helper 先剥离信封控制字段（`create_key` 一类） | **已在（= 8① 已落盘）**；**★ 但判据真源 = `SYSTEM_SETTINGS_FIELD_TYPES` 的 9 个**字段**（`database.ts:50-60`；字段名关闭集 = `SYSTEM_SETTINGS_FIELDS` @ `:63`）⇒ **它是「字段级」白名单、没有「键维」寻址** ⇒ 见下行 |
| **★ 键寻址面（缺口 · 本单现取发现）** | `index.ts:1192` + `database.ts:863-870` + `:3063` | 请求体**即** `system_settings` 的**值对象**（body 的每个属性被当作**字段**判定）；读侧同为 `WHERE key = 'system_settings'` | **★ 缺口** ⇒ **`AK2` 入册后「如何寻址该键」在现取面内不可达** ⇒ **待实现单（须一并回写本册 §20.6）**；**本单不发明线格式**（登记 = `§7-72` + §20.9 `I-1`） |
| **费率键黑名单（现取仍在）** | `index.ts:1175`（`findFeeRateKey(plainBody)`）+ `admin-service.ts:89`（`FEE_RATE_KEY_PATTERNS`） | 命中 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason='FEE_RATE_KEY_NOT_IN_APP_CONFIG'`（`index.ts:1179` 现取） | **本片不改**（删除属接该面的实现单，`§17.6 AT-R1`）；**本行只登记现取事实**（`§7-16` 的裁定射程 = 费率键；**本键词根 = `listing_deposit`**） |
| **退市面（触发口）** | `grep -rn 'delist' backend-ts/src/index.ts` 现取 = 命中 **`:1925`（注释）**；69 条注册点**无** `delist` 一族路径 | **无** | **★ 缺口（= 停报项）**：**「退市」这个动作现取没有任何 HTTP 入口**（唯一现取注文 = `index.ts:1637` 逐字：「**退市 / 罚没（`hold_release` / `hold_forfeit`）本片不实现**（§4.2 无对应事件行 ⇒ 报告 §7-1）」）⇒ 见 §20.2(c) |
| **保证金金额解析点（业务侧）** | `backend-ts/src/currency-service.ts:350`（`listCurrencyVerb` 定义 = `:329`） | `const deposit = resolveServerAmount(body.deposit_amount ?? body.deposit, 'deposit_amount', CURRENCY_LIST_DEPOSIT_FLOOR);` | **已在** ⇒ **= 「真生效」四段判据的 ③ 段锚**（§20.4(b)） |
| **兜底常量（现取 · 非本单发明）** | `backend-ts/src/currency-service.ts:144` | `const CURRENCY_LIST_DEPOSIT_FLOOR = 50000; // Kevin 2026-09-30 定值（同上）` | **已在**；**读键接在它之前 ⇒ 该常量降为兜底（标 `TODO: Kevin 定值`）**（§20.7） |
| **下限校验机制（现取 · 已在）** | `currency-service.ts:155`（`resolveServerAmount`）/ `:165-172` | 低于下限 ⇒ `fail(400, 'LEDGER_AMOUNT_NOT_POSITIVE', { field, value, min, reason: 'BELOW_SERVER_FLOOR' }, 'Amount is below the server-side floor')` | **已在** ⇒ **本片不动**（`R-8-5` 的「机制先落地」已在代码面兑现） |
| **上市入账（现形态 · 现取）** | `database.ts:1888` / `:1897` / `:1919` / `:1923` | `deposit_amount = ${input.depositAmount}::bigint`（写 `currency` 行）/ `INSERT INTO public.currency_status_log (cid, from_status, to_status, actor_uid, memo)` / 两腿 `listing_deposit`：`'delta', ${String(-input.depositAmount)}`（用户币）与 `'delta', ${String(input.depositAmount)}`（`'uid', '-1'`） | **现形态 = 「上市即消耗」**（`-1` credit 白名单接纳 `listing_deposit` = `0019`；hold 家族已剔除它 = `0020`）⇒ **与 `R-8-2` 的「退市退还」并存时的读法 ⇒ §20.5(e) 的口径冲突登记（停报 Zang）** |
| **权限键（写口 / 读口）** | `index.ts:1129`（GET）/ `:1158`（POST） | 两口**同键** = `requireAdmin(req, res, 'manage_settings')` | **已在** ⇒ §20.3 映射 = **`manage_settings`**（**11 键内**） |
| **既有 admin 读口（现取）** | `index.ts:1128`（`app.get('/api/admin/settings'`）；读库点 = `database.ts:3058` `getSystemSettings` | `WHERE key = 'system_settings'`（`:3063`）⇒ **只读 1 个键** | **可复用但不覆盖 `AK2`** ⇒ **本单判「不新增读口」**（§20.2(b)） |

> **★ 本表口径（写死）**：**每一行的读数均有本单独立现取锚，未转引任何批次报告**；**「无」= 本单 `grep` 现取命中 0**（**不是**「未查」）。**代码行锚 = §20.0 末行四件现取时点**。

### 20.2 读写口契约（**写口复用 · 读口不新增 ⇒ 注册点 69 → 69 · 退市触发口停报**）

**（a）写口（保证金配置的唯一合法面 · 逐字）**

| 项 | 逐字读数 | 锚（本单现取） |
|---|---|---|
| 路径 / 方法 | `POST /api/admin/settings` | `index.ts:1157` |
| 闸 | `requireAdmin(req, res, 'manage_settings')` | `index.ts:1158` |
| 准入（`data-layer.spec` §21.2 `AR2` 同族） | 闸 **且** `ops:` 键合法（`DL36`）**且** 请求体**逐键落在** §21.1 合法键清单内（其 `AG1`） | `index.ts:1157-1192`；`database.ts:775` / `:863` |
| `ops:` 幂等键 | `:1162` = `resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings')` ⇒ 规范形 `ops:<admin_uid>:setting:<key>`（**键名字面现取 = 写死 `'system_settings'`**） | `index.ts:1162` |
| 写落点（唯一） | `INSERT INTO public.app_config (key, value, updated_by, time_updated) VALUES ('system_settings', …::jsonb, …::bigint, NOW())` | `database.ts:3085` |
| **★ 不新增写口（写死 · `AG2`）** | **不得**为保证金另开业务路由 / 后台专用口 / 前端直连 DB；**不得**把该键写成 `system_settings` 的一个**字段**（**键 ≠ 字段**，§20.6 判负 (ii)） | `data-layer.spec` §21.2 `AG2`；本册 §17.3 `AR3` |
| 失败面 | `AG1` ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason='SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'` + `details.unknown_keys`；`AG3`① ⇒ `reason='SETTING_VALUE_NOT_OBJECT'`；`AG3`② ⇒ `reason='SETTING_TYPE_INVALID'` + `details.{field,expected,got}`；DB `23514`（容器 CHECK `0017:77`）⇒ 转译 `400`（**禁裸 `500`**） | `index.ts:1192-1213`；`database.ts:775-832` / `:77-82`；`0017:77` |

**（b）读口 —— ★ 本单判决：不新增（注册点 = 69 → 69）**

| 项 | 冻结值（本单钉死） | 依据（现取） |
|---|---|---|
| 后台读口 | **不新增**（**沿用**既有 `GET /api/admin/settings`，`index.ts:1128`，闸 `:1129` `manage_settings`） | **8③ 的 AC = 「真生效」**（配置必须被**业务层**真实读取，§20.4）—— **后台页能不能看见该键不属本片 AC**；且现取 `getSystemSettings` **只读 `system_settings` 一个键**（`database.ts:3063`） |
| **注册点** | **69 → 69**（**逐字登记**：`grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` 现取 = **69** ⇒ **本片零新增对外路径**） | §20.0「注册点」行（**现取基线 = 69**；与 v2.4 记载的 **68** 差 1 = 8② 读口 `GET /api/admin/commission_policy`（`:2036`）已落盘） |
| ★ 附带判负（写死） | 若实现单为「让后台看得见保证金键」而**新增** admin 读口 ⇒ **必须**先回写本册冻结其 路径 / 方法 / 闸 / `data` 键集，**并登记注册点 69 → N**；**不得**以「页面要展示」为名**私自增口** | `R-8-1` / `R-8-6`；本册 §19.2(e)（**功能读口 ≠ 验收路由**，两者不得混同） |

**（c）★ 退市触发口 = 现取无 ⇒ 停报（实现方不得自造路由）**

- **现取事实（逐字）**：**69 条注册点内无任何 `delist` 一族路径**（`grep -rn 'delist' backend-ts/src/index.ts` 现取 = 仅 `:1925` 的注释行）；唯一现取注文 = `index.ts:1637` 逐字「**退市 / 罚没（`hold_release` / `hold_forfeit`）本片不实现**（§4.2 无对应事件行 ⇒ 报告 §7-1）」。
- **⇒ 登记（写死 · 停报形态）**：**「退市退还」在现取面内没有触发器**。**本单不发明**路由名 / 方法 / 闸 / 请求体 / 发起方；**若实现单判定必须新增该入口 ⇒ 属本册冻结事项**，须由 Zang 拍板（发起方 = 币种 owner？平台 admin？）+ 本册追加冻结「路径 / 闸 / **注册点 69 → N**」三件 ⇒ **登记 = `§7-73` + §20.9 `I-4`**。
- **★ 判负（写死）**：**实现单在未获本册冻结前新增任何「退市」路由 ⇒ 判负** —— `R-8-2` 冻结的只是**退还所走的账务机制**（= `hold_release`），**未**冻结任何 HTTP 入口；`§7-1` 的欠账**不得**由实现方自行销账。

### 20.3 权限键映射（**先现取逐字十一键，再给映射；`R-8-1` 履约**）

**（a）既有十一权限键（逐字 · 现取 · 三真源 · 本单亲读三档）**：

> **真源 A（后端唯一真源）** = `backend-ts/src/database.ts:11-23`（`const ALL_ADMIN_PERMISSIONS = [ … ] as const`，`as const` 收于 `:23`），**逐键现取**：
> `dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · `review_tasks`（**恰 11 键**）
> **真源 B（迁移种子）** = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`（`INSERT INTO public.admin_permission (permission_key, name) VALUES` + **11 行**；逐字含 `('manage_settings',    '系统设置')` @ `:60`）。
> **真源 C（前端兜底）** = `frontend/src/admin-utils.js:40-52`（**11 键**，逐键现取）。
> **★ 三真源逐键相等 = 本单独立现取复核**（三档 `sed -n` 亲读，键集逐字一致）；**转引件 = `docs/audit/p6-b6-perm-seed.md §5-④`**（其机器判据 `all_three_equal=true`；**本册未复跑该判据**）。

**（b）8③「所需权限 → 既有键」映射表**：

| 面 | 所需权限（语义） | → **既有键（11 键内）** | 依据 / 说明（现取） |
|---|---|---|---|
| **写口**（保证金金额配置 · `AK2` 的唯一写入面） | 读写平台配置 | **`manage_settings`**（**唯一**） | **现取**：`index.ts:1158`（POST 闸 = `manage_settings`）；`0022:60` 中文名 = 「系统设置」；与 §17.2(b) 的 **8① 行**、§19.3(b) 的 **8② 行**逐字一致 |
| **退市退还**（账务面） | **—（现取无 HTTP 面）** | **★ 无 ⇒ 停报** | **理由**：退市**现取无路由**（§20.2(c)）⇒ **无闸可映射**；**不得**为此硬造键（`R-8-1` 逐字「找不到合适键 ⇒ 停下报裁、严禁硬造」） |
| **后台页**（**若**实现单把该键搬上系统设置页） | 进后台 + 读写设置 | **`manage_settings`** + **`dashboard_access`**（进面板） | 先例 = `frontend/src/pages/admin/SystemSettings.jsx` 对应路由（`requiredPermission="manage_settings"`，同族先例见 §19.5(d)）；**本片不实现页面**（§20.2(b) 判「不新增读口」） |

> **★ 映射表口径（写死）**：**逐行给死**；**凡找不到合适键 ⇒ 显式写「无 ⇒ 停报」**（**不得**填一个「看起来像」的键凑数）。**本表「停报」行 = 退市退还（账务面）**。
> **★ `R-8-1` 履约声明（写死）**：本表**零新增键 / 零删除键**（11 键闭集**逐字不动**）；**未出现的键 = 不存在**。

### 20.4 ★★ 「真生效」四段判据（**改键 ⇒ 库内落值 ⇒ 业务读口取数 ⇒ 行为随之 · 每段自带判负**）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**本单把它落成四段**：**① 改键（后台写）→ ② 库内落值（给表 / 列 / 该行取值）→ ③ 业务读口取数（给 `文件:行`）→ ④ 行为随之（同一业务量的改动前 / 改动后两读数）**。**★ 不得只验「后台能存」**（**「`POST` 返回 200」= 零证据**）。

**（a）判据模板（四段 · 逐段必带「判负形态」）**

| 段 | 读数内容（必给） | **判负形态（必带）** |
|--:|---|---|
| **① 改键（后台写）** | 写口路径 + 方法 + 闸 + 请求体（逐字）+ 响应（status + `data` 键集） | **缺闸 / 闸降级 ⇒ 判负**；**响应 `data` 键集 ≠ 冻结键集 ⇒ 判负**；**写入未过 `AG1`–`AG4`（未知键被静默吸收 / 类型不符回落默认值 / 越权面写成）⇒ 判负** |
| **② 库内落值** | **表 `public.app_config` + 列 `key` / `value` / `updated_by` / `time_updated`** 与该行取值（逐字 SQL 与 `SELECT` 读数）：`SELECT key, value, updated_by, time_updated FROM public.app_config WHERE key = 'listing_deposit_policy'` | **写成功但库值未变 ⇒ 判负**（**「后台能存但库内没落」**）；**该行不存在 ⇒ 判负** |
| **③ 业务读口取数** | **业务侧取数点的逐字锚（`文件:行`）+ 其读数**（`currency-service.ts:350` 一带的解析结果：**取自键 / 回落常量**，含来源标记） | **业务读口取到的仍是兜底常量（或旧值）⇒ 判负**（**「库内有新值但业务不读」**）；**只给后台读口（HTTP）当「业务读口」⇒ 判负**（**后台读口 ≠ 业务读口**） |
| **④ 行为随之** | **同一个可直接观察的业务量**：**保证金金额** —— `public.currency.deposit_amount`（行值）+ `public.ledger_entry` 的 `listing_deposit` 两腿 `delta`（金额）；**退还面（若已实现）** —— `hold_release` 两腿（`frozen −amount` / `balance +amount`）金额。**改动前 / 改动后两读数** | **改动后该业务量不变 ⇒ 判负**（**这正是「非只在后台显示」的正面判据**）；**只给改动后单读数 ⇒ 判负** |

**（b）判据 · 项 = `listing_deposit_policy`（上市保证金金额）**

| 段 | 内容 | 依据（现取锚） |
|--:|---|---|
| ① 改键（后台写） | `POST /api/admin/settings`（闸 `manage_settings`），请求体寻址 `listing_deposit_policy`（**线格式待实现单**，§20.6）；`ops:` 键按 `DL36` | `index.ts:1157-1192`；`database.ts:863` / `:775` |
| ② 库内落值 | **表 `public.app_config` / 列 `key` = `'listing_deposit_policy'`、列 `value` = jsonb object**（容器硬约束 = `0017:77`） | `database.ts:3085`（唯一写落点）；`0017:77`（逐字 CHECK） |
| ③ 业务读口取数 | **`backend-ts/src/currency-service.ts:350`** —— 落地后**必须先读 `AK2` 键、读不到 / 非法 ⇒ 回落兜底常量**（**fail-closed 到常量**，**不是** fail-open 到客户端值） | `currency-service.ts:350`（现取）；`currency-service.ts:144`（兜底常量）；§17.4 机制行；`data-layer.spec` §21.4 |
| ④ 行为随之 | **上市保证金金额随之变**：`currency.deposit_amount`（`:1888`）+ `ledger_entry` 两腿 `listing_deposit`（`:1919` / `:1923`）；**退还面**：`hold_release` 两腿金额（`0020:381-382`） | `database.ts:1888` / `:1919` / `:1923`；`0020:381-382`；`ledger.ts:1394-1408` |

> **判负（写死 · 至少三条）**：**(i)** 后台 `POST` 返回 **200** 但 `SELECT value FROM public.app_config WHERE key = 'listing_deposit_policy'` **无该行 / 值未变 ⇒ 判负**（**此条正面封堵「只验后台能存」**）；**(ii)** 键值已变但**下一次上市**的 `deposit_amount` / `listing_deposit` 分录金额**与改动前相等 ⇒ 判负**；**(iii)** 键值写成**非法**（非正整数 / 越下限）而**上市仍按客户端传入值**成交 ⇒ 判负（**客户端永不决定金额**，§20.7）。
> **★ 数值纪律（写死）**：**本单不写入任何保证金数值**；现取常量 **`50000`**（`currency-service.ts:144`）= **现取读数**（引用即标来源），**不得**当作本单的发明或新裁定；**任何新数值 ⇒ `TODO: Kevin 定值`**。

**（c）★★ 四段的「可判负」总判据（写死 · 机读形态）**

| # | 断言 | 判负条件 |
|--:|---|---|
| ① | **四段齐全**（①→②→③→④） | **只给 ①②（或只给「后台 200」）⇒ 判负**（**「只验后台能存」的形态**） |
| ② | ② 段**必须给表名 + 列名 + 该行取值**（**不得**只写「已保存」） | ② 段无表 / 列 / 值 ⇒ **判负** |
| ③ | ③ 段**必须给业务侧取数的 `文件:行` 锚** | 只给后台读口（HTTP）当业务读口 ⇒ **判负** |
| ④ | ④ 段**必须给「改动前 / 改动后」两读数**，且**为同一业务量** | 只给改动后单读数 ⇒ **判负** |
| ⑤ | **每段各带判负形态** | 任一段无判负形态 ⇒ **判负** |
| ⑥ | **负对照（门自证）**：把任一段的读数**改成常量**（如把 ④ 段写死为改动前的值）⇒ 该门**必须转红** | **不转红 = 门是假门** |

**（d）执行面（**写死 · 与 §19.4(e) 同口径**）**：**实跑只许 DB 直造 + 读库**（`psql` 直连 / 直造或直改 `app_config` 键行 / `SELECT` `currency.deposit_amount` 与 `ledger_entry` 行）；**不得**为验收新增 HTTP 路由、**不得**以任何后台读口承载验收读数。**★ 本单不实跑**（**零库连接 / 零 HTTP**）⇒ 判据**已写死、未实跑** ⇒ 登记 `NOT_MEASURED`（§20.8-2）。

### 20.5 ★★ 退市退还 ↔ 既有 `hold_release` 路径（**逐字引现取真源 · 含口径冲突登记**）

> **裁定锚（逐字 · `R-8-2` 的 (b) 项）**：**退市退还走既有 `hold_release` 路径**；**冻结口径 = `hold_release` = `frozen → balance`**（**同账户搬运、2 条分录**）。

**（a）既有 `hold_release` 路径的逐字真源（现取 · 五处）**

| # | 真源（现取锚） | 逐字 / 读数 |
|--:|---|---|
| ① **TS 高层动作**（「既有路径」的入口） | `backend-ts/src/ledger.ts:1394`（`export const unfreeze`） | 函数体 `:1399` = `op: 'hold_release',`（入参 `uid, cid, amount` + `businessFrozenCap`）；注释头 `:1385-1387` 逐字「**高层动作 ④：unfreeze 冻结 → 可用（hold_release，同账户 2 条分录）**」 |
| ② **DB 分录形状**（live 定义 = `0020`） | `backend-ts/migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql:381-382` | `ledger_norm_entry(v_uid, v_cid, 0, -v_amount, 'hold_release', …)` + `ledger_norm_entry(v_uid, v_cid, v_amount, 0, 'hold_release', …)` ⇒ **同账户两腿**：`frozen −amount` / `balance +amount`（**恰 = 冻结口径 `frozen → balance`**） |
| ③ **同账户两腿守卫**（结构保证） | 同文件 `:573`（+ 自检 `:1051-1052`） | `WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund')` + `HAVING count(*) <> 2` ⇒ **hold 家族 kind 每个 `(uid,cid,kind)` 组恰 2 条**（`HOLD_PAIR_REQUIRED`）；**★ 现取事实**：该列表**不含** `listing_deposit`（`0020` 的改动即「去 `listing_deposit`」；自检逐字断言列表 = `('hold','hold_release','job_escrow','job_escrow_refund')`） |
| ④ **币种状态矩阵**（为何「退市」可解冻） | `backend-ts/src/ledger.ts:203` | `hold_release: { draft: true, listed: true, frozen: true, delisted: true }`（`CURRENCY_STATUSES` = `ledger.ts:170`：`['draft','listed','frozen','delisted']`）⇒ **`delisted` 态下 `hold_release` 放行** ⇒ **「退市退还」在账务侧无障碍** |
| ⑤ **同族先例**（同一路径的非-退市用法 · 可作实现单形态先例） | `backend-ts/migrations/0016_market.sql:670` / `:674` | 撤单 = `hold_release` ×2（`'kind', 'hold_release'`；`frozen_delta −v_freeze` 与 `delta +v_freeze`） |

**（b）⇒ 对应关系（本单冻结的推论 · 写死）**：**「退市退还」= 在该币种退市时，对「上市时冻结的保证金」调用 ①（`unfreeze` ⇒ `op='hold_release'`）** ⇒ 由 ② 落**同账户两腿**（`frozen −dep` / `balance +dep`），**金额 = 上市时冻结的同一金额**（`public.currency.deposit_amount`，现取列 @ `database.ts:1888`）。**⇒ 两条口径（写死）**：**(i) 退还金额真源 = `currency.deposit_amount`**（**不是**退还时重新解析配置键）；**(ii) 退还 ≠ 重算** —— 配置键（`AK2`）**只决定上市时的金额**，**不得**在退还时二次取数（否则「改键会把历史在冻额改掉」⇒ 判负，见 (d)-2）。

**（c）★★ `hold_forfeit` 禁线（`R-8-2` 逐字 · 本片最易踩雷）**

- **裁定（逐字）**：**严禁实现 `hold_forfeit`；严禁复活任何已删名**；**冻结口径 = `hold_forfeit` 未启用、无可罚没标的物**。
- **真源（现取 · 三处）**：① `data-layer.spec` **`DL91`（**v0.11 基线 `:538`** ⇒ **本版现取 `:539`**）**逐字「**`hold_forfeit` 在 P3 不启用**：罚没的标的物是在冻资金……⇒ 本册**登记为待裁决**（§12），**不预先启用**」；② `backend-ts/src/ledger.ts:149-150` 现取注文逐字「**`listing_deposit_forfeit`：P1c 新裁定删**（保证金在上市时即消耗、进平台收入 `uid=-1`……」；③ `data-layer.spec` **`DL67`（**v0.11 基线 `:459`** ⇒ **本版现取 `:460`**）/ `DL88`（**v0.11 基线 `:535`** ⇒ **本版现取 `:536`**）**逐字「**不存在罚没**、**无罚没、无退还 kind**」（**已冻结**）。
- **★ 判负（写死 · 三条）**：
  1. **`hold_forfeit` 出现在本片新增件即判负**（类级扫描 = `grep -rn 'hold_forfeit' backend-ts/src/ backend-ts/migrations/002{1,2,3,4}*` **之于本片新增文件** ⇒ 命中 ⇒ 判负）。**★ 射程声明（写死 · 防误伤）**：**既有在册件**（`0001` / `0003` / `0004` / `0008` / `0012` / `0019` / `0020` 里的 kind 关闭集与账户守卫、以及 `ledger.ts:154` 的 kind 字面数组）**属历史事实、不在本判据射程** ⇒ **不得**据本条去删 / 改它们（`migrations/**` 已 apply ⇒ **禁改**）。
  2. **退还额被配置键二次改写即判负**：改 `AK2` 键值后，**已上市 / 已冻结**的币种其退还额**随之变** ⇒ 判负（**退还 = 退回**，不是**按新配置重算**）。
  3. **退还走非 `hold_release` 的分录组合即判负**：退还若落成「`uid = -1` 的 debit」/「新增 kind」/「借道 `purchase_refund` 一族」⇒ 判负（**只允许** ② 的同账户两腿 + **既有** kind `hold_release`；**不得新增 kind** —— 关闭集 **20 个**恒不动，`0019:155-158` 现取）。

**（d）★★ 口径冲突登记（诚实登记 · 必须由 Zang 一句话收口 · 本单不择一）**

- **冲突事实（两侧均逐字现取）**：
  - **A 侧 = 已冻结的数据层条文**：`DL67`（`docs/data-layer.spec.md` —— **v0.11 基线 `:459`** ⇒ **本版现取 `:460`**）逐字「**下架无账务动作**（保证金不退；**不存在罚没**，v0.3 裁定）」；`DL88`（**v0.11 基线 `:535`** ⇒ **本版现取 `:536`**）逐字「**`listing_deposit` 的语义**：**上市即消耗**（`balance → uid −1`），**不可退、无罚没、无退还 kind**（R31 / v0.3）⇒ 交易所路由**不得**提供「退还保证金」按钮或接口。」（两条状态栏均标 **【已冻结】**）。
  - **B 侧 = 本片的裁定锚**：**`R-8-2` 的 (b) 项 = 「退市退还走既有 `hold_release` 路径」**。
  - ⇒ **A / B 在字面上互斥**（一边「不得提供退还接口」，另一边要求「退市退还」）。
- **本单处置（写死 · 不擅改、不择一、不静默）**：**①** `DL67` / `DL88` 的**行体一字未动**（只追加口径；姊妹册侧同批登记 = `data-layer.spec` v0.12 §23.8）；**②** 本单**不裁定谁取代谁**；**③** 登记 = **`§7-73`（停报项）** ⇒ **须由 Zang 明确读法**（二者择一，或给「并存条件」：例如「`DL88` 的『不可退』指 8③ **之前的**实现面；8③ 起按 `R-8-2` 读」—— **此例仅为说明形态，不是本单的裁定**）；**④** **读法落定前，实现方不得实现退还路径**（否则即踩 `DL88` 的现取硬约束）。
- **★ 判负（写死 · 双向，防两种极端）**：**(i)** 实现方**据 `DL88` 拒绝实现**退还 ⇒ **违反 `R-8-2`**（判负）；**(ii)** 实现方**据 `R-8-2` 改写 `DL67` / `DL88` 的行体** ⇒ 违反**只追加硬口径 + 已冻结条文的不可静默重写**（判负）；**唯一合法路径 = Zang 明确读法 ⇒ 由规范方以追加节登记**（本单已把它登记为待收口项 = `§7-73` + §20.9 `I-6`）。

### 20.6 ★★ 键寻址面（缺口 · 待实现单 · **本单不发明线格式**）

- **现取事实（逐字）**：`POST /api/admin/settings` 的**请求体 = `system_settings` 的值对象**（`:1192` `screenSystemSettingsWrite(body)` ⇒ `database.ts:863` 先剥离信封控制字段、再交 `validateSystemSettingsPatch`（`:775`）**逐字段**判白名单 / 类型）；写落点的 `key` 字面**写死** `'system_settings'`（`:3085`）；读侧同（`:3063`）。⇒ **现取面内没有任何「指定 `app_config.key`」的通道**。
- **⇒ 结论（写死）**：**`AK2` 入册后，「写该键」这件事在现取代码面仍不可达** —— **这不是缺陷，是 `AG1` 的正面语义**（**在册 ≠ 已实现**）。**落地所需两件事（均属实现单）**：**(i)** 代码侧**键级寻址**（线格式**待定**；**候选（不构成裁定）** = `{"key":"<key>","value":{…}}` 形 / `{ "<key>": {…} }` 形 / 路径参数形 —— **本单不选、不发明**）；**(ii)** `APP_CONFIG_LEGAL_KEYS`（`database.ts:47`）**同轮加键**（否则 `AK2` 在册仍被 `AG1` 拒）。
- **★ 判负（写死 · 四条）**：**(i)** 实现单**自造**一套线格式而**未回写本册** ⇒ 判负（跨册不一致）；**(ii)** 实现单**改 `key` 字面、把 `listing_deposit_policy` 塞进 `system_settings` 的 9 字段**（即**不**走 `AK2`）⇒ **判负**（**键 ≠ 字段**：`AK2` 是**顶层键**，其值**另成一个** jsonb object）；**(iii)** `APP_CONFIG_LEGAL_KEYS` 加了键而**门禁仍只按字段级白名单判** ⇒ 判负（**在册不等于放行**）；**(iv)** **该常量旁的注释块（`database.ts:41-45`）不同轮更新** ⇒ **判负**（**注释现取仍写「顶层合法键（`app_config.key` 取值）**恰好 1 个**」+「§21.4 候选载体键在入册前」⇒ 与入册后的清单（2 键）自相矛盾；**同族先例** = `currency-service.ts:133-138` 的「单点常量形态」注文（§21.4 已登记其须同步改）；**本项属「注释即证据源」的卫生要求**，登记 = 姊妹册 v0.12 `AR6`）。
- **★ 与 `O-3` 的关系（承姊妹册 §22 + 本册 §18.8(b)）**：`ops:` 键现取**写死** `'system_settings'`（`index.ts:1162`）⇒ **第二个合法键的 `ops:` 键会落同一命名空间** —— **`AK2` 正是「第二个合法键」**，故本片**同样命中该缺口** ⇒ **本单只重申该缺口已由 `O-3` 登记、不新增条目**（`§7-72` 记其与本片的连接点）。

### 20.7 ★★ 下限校验机制与数值纪律（**机制已落地 · 数值待 Kevin · 客户端永不决定金额**）

- **机制现取（已在 · 本片不动 · 逐字）**：`currency-service.ts:155` `resolveServerAmount(raw, field, floor)` —— **未传（`undefined` / `null` / `''`）⇒ 取服务端值（= `floor` 兜底）**；**传了 ⇒ 先形状闸（正整数）再必须 `>= floor`**，低于 ⇒ `fail(400, 'LEDGER_AMOUNT_NOT_POSITIVE', { field, value, min, reason: 'BELOW_SERVER_FLOOR' }, 'Amount is below the server-side floor')`（`:165-172`）。
- **本片需补的一环（写死）**：**`floor` 的来源**从「常量」改为「**先读 `AK2` 键 · 读不到 / 非法 ⇒ 回落常量**」（`currency-service.ts:144` 的 `CURRENCY_LIST_DEPOSIT_FLOOR` **降为兜底**）；**回落方向 = fail-closed 到常量**（**绝不是** fail-open 到客户端值）。
- **数值（逐字承接 `R-8-5` / `R-7-23`）**：**待 Kevin 定值**；实现期**兜底常量保留并标 `TODO: Kevin 定值`**（`currency-service.ts:139-143` 的现取注文逐字已自称「**批 6（配置面）登记**：改为**从平台配置取数**（真源键待 Kevin 给……）**届时本常量降为兜底**」⇒ **本片 = 该登记的兑现**，**不是新发明**）。
- **★ 判负（写死）**：**(i)** 客户端传入低于下限的金额而**成交** ⇒ 判负；**(ii)** 键值非法（非正整数 / 越界）而**业务按客户端值**走 ⇒ 判负；**(iii)** 用**前端展示值**（百分比 / 换算后值）当金额提交 ⇒ 判负（**金额语义 = 最小单位整数**；换算只许在展示层 —— 同 §19.5(a) 的费率换算口径）。
- **★ 本单不写入任何数值**：`50000` = **现取读数**（`currency-service.ts:144`）；**新值 ⇒ `TODO: Kevin 定值`**。

### 20.8 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **`AK2` 写入在入册前 / 后被拒的实跑两态** | **本单为规范单、零代码 / 零库连接 / 零 HTTP** ⇒ 判据**已写死、未实跑**；**现取可证的只有「代码面判据本体在册」**（`database.ts:775` 的未知键分支 + `:47` 的 `APP_CONFIG_LEGAL_KEYS`）⇒ **HTTP 实跑读数 = `NOT_MEASURED`** |
| 2 | **§20.4 四段判据的判负实跑** | **零代码 / 零库连接** ⇒ **判据已写死、未实跑**（归实现单 + 质检单）；**四段 + 每段判负形态 = 已给；实跑读数 = 未给** |
| 3 | **退市触发口的实现面** | **现取无该路由**（§20.2(c)）⇒ **无对象可测**；**且其形态属停报项**（`§7-73`）⇒ **本单不假定任何形态** |
| 4 | **`ops:` 键「按目标键派生」后的实际键形态**（`O-3`） | **本单只重申登记**（§20.6）⇒ **该面未实现 ⇒ 无读数**（**不得**填示例值冒充实测） |
| 5 | **`AK2` 键值的内部形态（字段名 / 类型规格 / 线格式）** | **待实现单 + Zang 定**（§20.6 只给候选、不构成裁定）⇒ **无读数**；**本单不发明** |
| 6 | **现库 `app_config` 的行集（`listing_deposit_policy` 是否已被误写）** | **零库连接**（红线）⇒ 转引 `data-layer.spec` §21.6-1 / §22.6-1 的口径；**实测现值 = `NOT_MEASURED`**（**不得**把「理论上无」写成「实测无」） |
| 7 | **`DL67` / `DL88` 与 `R-8-2` 的口径冲突的收口结果** | **属待裁**（§20.5(d)）⇒ **无读数**；**本单只登记、不择一** |
| 8 | **本单代码行锚在实现单落盘后的有效性** | 四件源码指纹已现取（§20.0 末行）⇒ **实现单落盘后必然漂移**；**本册自身 spec 未被并发单触碰**（开工时 `git status --porcelain docs/` = **空**）⇒ **本单 spec 现值成立** |

### 20.9 实施登记（**交「接该面的实现单」，本册不实现**）

| 条目 | 待办 | 依据 |
|---|---|---|
| **`I-1`** | **`AK2` 的键级寻址落地 + `APP_CONFIG_LEGAL_KEYS`（`database.ts:47`）同轮加键**（**线格式须回写本册 §20.6**，实现前先冻结） | §20.6；`data-layer.spec` §21.3 规则② |
| **`I-2`** | **保证金下限改读 `AK2` 键 + 兜底常量标 `TODO: Kevin 定值`**（读不到 / 非法 ⇒ **fail-closed 到常量**） | §20.7；`R-8-5` / `R-7-23`；`data-layer.spec` §21.4 `AT3` |
| **`I-3`** | **§20.4 四段判据的实跑**（**DB 直造 + 读库**；**不得新增路由**） | §20.4(d)；P6 的 AC 原文 |
| **`I-4`** | **退市触发口**：形态（路径 / 方法 / 闸 / 请求体）与**发起方**裁定 ⇒ 落定后**必须回写本册并登记注册点 69 → N** | §20.2(c)；**停报 = `§7-73`** |
| **`I-5`** | **退市退还的账务接线**（走 `unfreeze` ⇒ `op='hold_release'`；金额 = `currency.deposit_amount`；**禁 `hold_forfeit`**） | §20.5；`R-8-2`；`ledger.ts:1394-1408`；`0020:381-382` |
| **`I-6`** | **`DL67` / `DL88` 与 `R-8-2` 的口径收口**（Zang 一句话）⇒ 落定后由规范方追加节登记 | §20.5(d)；**停报 = `§7-73`** |
| **`I-7`** | **`ops:` 幂等键按目标键派生**（现取写死 `'system_settings'`） | §20.6；`O-3`（与 `§7-69` 同族） |
| **`I-8`** | **本单的代码行锚重取**（四件 md5 / 行数） | §20.0 末行；§20.8-8 |

### 20.10 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§7-64` / `§7-67`**（保证金金额的 `app_config` 载体键名 + 数值 · **待 Zang / Kevin**） | **兑现** = 本节 + **姊妹册 `data-layer.spec` v0.12 §23.1 的 `AK2` 行**（**键名已批准且已入册**；**数值仍待 Kevin**）；**两行行体一字未动** |
| **`§17.4`**（载体键名约定 · 候选 = `listing_deposit_policy`，「**候选、不构成裁定**」） | **升格** = 本节（**候选 → 已入册键**）；**`§17.4` 行体一字未动**（「候选」二字自此作废，读法以本节 + `data-layer.spec` v0.12 §23 为准） |
| **`§7-23`**（保证金下限的数值与载体：待 Kevin / Zang 给数） | **载体已定**（`app_config` 合法键 = `listing_deposit_policy`）+ **数值仍待 Kevin** + **机制已在代码面落地**（§20.7）；**`§7-23` 行体一字未动** |
| **`§7-1`**（退市 / 罚没本片不实现 · 欠账） | **部分兑现 + 部分仍欠**：**机制面**已由 `R-8-2` 冻结（§20.5）；**触发面**仍缺（§20.2(c)）⇒ **欠账未销，转登记 `§7-73`** |
| **`§17.3` 的 `AR1`–`AR4`**（`app_config` 写口准入） | **承**：本节 §20.2(a) **复用**同写口与 `AR2` 的逐键白名单；**本片零新落点、零新路径** |
| **`§19.2(e)`**（「功能读口 ≠ 验收路由」双向判负） | **承**：本节 §20.2(b) 的附带判负 + §20.4(d) 的「验收只许 DB 直造 + 读库」 |
| **`§18.6`**（引用纪律）+ **`§19.6(d)`**（引 `sed -n` 须给「命令 + 版本 + 期望输出」三件） | **承**：本节全部引用**现取且逐字**；**代码锚 = §20.0 末行四件指纹时点**；**册内锚 = 本册 v2.5（本节之前的行号未变）** |
| **`data-layer.spec` §21 / §22 / **§23（v0.12）**（`app_config` 合法键面 / `AG1`–`AG4` / `AK2` 入册） | **同批姊妹册**；**本册只指路、不重抄**（`AK2` 键行正文 = 其 §23.1） |
| **`ledger.spec` §14.3 / §14.1** | **只读引用**（借码授权 + 33 码闭集）；**本单未改其一字** |
| **`docs/commission.spec.md`（真源册 · 只读）** | **无涉本片**（本片不碰费率 / 分配口径）；**只读 · 未改一字** |


## §21 ★★ v2.6 · 批 8 第 3 片下半（8③b）契约冻结：`app_config` **键级寻址线格式** + HTTP 写面（闭合 `R-8-19`）+ ★★ **`R-8-17` 更正块**（**v2.6 新增 · 本节只追加 · 依据 = 批 8 第 3 片下半（8③b）派单（`docs/seafood.master-plan.md:1436`）+ 裁定 `R-8-19`（同文件 `:1497`）+ 裁定 `R-8-17`（同文件 `:1521-1525`）；键面正文 = 姊妹册 `data-layer.spec` v0.13 §24**）

> **本节性质（与 §17–§20 的关系，先说清）**：§17 = 8① 键清单 / 门禁 / 载体键名约定；§18 = 补正单（`R-8-7/8/9` + 引用纪律）；§19 = 8② 费率 + 返佣；§20 = 8③ 契约（**含已作废的「退市退还」部分**）；**本节 = 8③ 的下半（8③b）** ⇒ **① 键级寻址线格式的「本册侧连带面」**（键面正文在姊妹册 `data-layer.spec` §24，**本册只指路、不重抄**）+ **② `ops:` 幂等键按 key 派生的收口** + **③ 写面真生效四段判据（route 侧）** + **④ ★★ 更正块（`R-8-17`）**。
> **纪律（写死 · 承 §20 开篇口径）**：① **只追加**（**非追加改动 = 0 处**；`git diff --numstat` 删除列 = **0**，见 §8.28）；② **零代码 / 零迁移 / 库面只读 / 零 HTTP / 零套件**；③ **不发明** 路径名 / 权限键 / 键名 / 数值 / 错误码 / 日期；④ **★ 更正块不改原行**（**§20.5 正文一字未动**；作废声明只由**追加块**承载 —— 守「删除列 = 0」）；⑤ **`R-8-2` 的 (a) 项与「禁 `hold_forfeit`」半句仍然有效**（本片射程收缩 ≠ `R-8-2` 整体作废）。

### 21.0 开工锚（现取 · 逐项）

| 项 | 命令（现取） | 本单读数 |
|---|---|---|
| 上游对锚 | `git log --oneline -1` | **`692626a`**（= 8③a 验收通过 + 上线 + 生产终验 + 派 8③b 线格式冻结） |
| 本册开工版本 / 规模 | `grep -c '^> \*\*状态：v2.5' docs/route-layer.spec.md` + `wc -l` / `wc -c` / `md5 -q` | **v2.5**（状态块命中 **1** 行）；**`wc -l` = 4868 行 / 1044962 B / md5 `ec760d0fc29b74e066010d921165a5b8`**（**= 与派单给定对锚逐字相符** ✅）；**逻辑行数 = 4869**（口径见 §21.0 末行） |
| 姊妹册开工版本 / 规模 | `wc -l` / `wc -c` / `md5 -q docs/data-layer.spec.md` | **v0.12 · 1412 行 / 361570 B / md5 `c70df56e8a04b87b9e5b84ccebb259ad`**（**= 与派单给定对锚逐字相符** ✅；**本单改它 ⇒ 就地升 v0.13** + 快照 + delta） |
| **★ 行数口径（写死 · 派单 ④）** | `wc -l` vs 逻辑行数；`tail -c 1 \| xxd` | **本册**：末行（逐字 `---`）**不带换行符**（`tail -c 1 docs/route-layer.spec.md \| xxd` 现取 = `00000000: 2d`）⇒ **`wc -l` = 4868（换行符数）/ 逻辑行数 = 4869，差 1 是正常的**；**姊妹册**：末行 `:1412` **带换行符**（`00000000: 0a`）⇒ **`wc -l` = 逻辑行数 = 1412**（两口径同值）。**⇒ 一切行数读数必须注明口径**；**⇒ 本册追加一律插在末行 `---` 之前**（最小复现 `/tmp` 实测：**追加法 = `4 1`（1 删除）vs 插前 = `3 0`（零删除）**；承 v2.5 的方法论） |
| 旧快照计数（现取） | `ls docs/versions/ \| grep -c '^route-layer.spec.v'` / `… '^data-layer.spec.v'` | **route = 25**（`v0.1` … `v2.5`）/ **data-layer = 12**（`v0.1` … `v0.12`）—— **= 与派单给定（route 25 / data-layer 12）逐字相符** ✅；**旧快照零改动由本单保证**（本单只**新建** `v2.6.md` + `data-layer.spec.v0.13.md`） |
| `docs/` 未提交件 | `git status --porcelain docs/` | **空**（本单开工时点 ⇒ 无并发单正在改 spec / 快照） |
| **注册点（现取）** | `grep -cE '^[ \t]*app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **69**（`wc -l backend-ts/src/index.ts` = **2130**）⇒ **本片零新增对外路径 ⇒ 69 → 69** |
| 四件源码的现取指纹（代码行锚时点） | `md5 -q` + `wc -l`（`index.ts` / `database.ts` / `currency-service.ts` / `admin-service.ts`） | `index.ts` = **`3cf5f00ad112297e1c40a5475252cfa2`（2130 行）** / `database.ts` = **`81592e009df1a880094ad5d28b0e464c`（4197 行）** / `currency-service.ts` = **`c6ce9e728f6909f0069fd940f2f880cc`（487 行）** / `admin-service.ts` = **`54a588f7552e36b523d4073ba9a641ea`（269 行）** ⇒ **本节一切代码行锚 = 上述四件「本单现取时点」`HEAD` `692626a`**；**实现单落盘后作废、须重锚**（承 §19.6(d) 的「引 `sed -n` 须给命令 + 版本 + 期望输出」） |
| **★ 册内行锚基线（现取 · 承 `R-8-14`）** | `grep -n '^### 20\.5 \|^| \*\*`I-5`\*\*\|^### 20\.4 ' docs/route-layer.spec.md`；`grep -n '^| \*\*DL67\*\*' docs/{,versions/}data-layer.spec.md` | **本册内**：`§20.5` 节头 = **v2.5 基线 `:4779`**⇒ **本版现取 `:4825`**（**本版三处插入合计 `k = +46`；逐条漂移表 = §8.28.3**）；**姊妹册内**：`DL67` **v0.12 基线 `:460`** ⇒ **其 v0.13 现取 `:461`**；`DL88` **v0.12 基线 `:536`** ⇒ **其 v0.13 现取 `:537`**（差 = 恰 +1）。⇒ **本节凡引册内行锚，一律写「基线 `:N` ⇒ 本版现取 `:N+k`」两件**（`R-8-14` / §18.6）；**只给一个数的引法 = 缺陷** |
| **★ 本版行号漂移声明（写死 · 诚实登记）** | `git --no-pager diff --no-index docs/versions/route-layer.spec.v2.5.md docs/route-layer.spec.md` | 本版在**状态块区末尾**（末条状态块之后、`v1.1 一页纸` 锚行之前）**插入 v2.6 状态块**（**新增行、零删除**）⇒ **其后的全部行号整体后移 `k` 行**（**本版位移两段：`§7` 区 = +9、`§9` 之后（含 `§20.x` / `§21`）= +46**；**逐条漂移表 = §8.28.3**）；**本册内**的既有引用行锚（如 `§7-72`/`§7-73`/`§20.x`）**一律以「基线 `:N` ⇒ 本版现取 `:N+k`」两件引**；**`§21` 本节自身的行锚 = 本版现取、无基线**（新增节） |

### 21.1 键级寻址线格式（**键面正文 = 姊妹册 `data-layer.spec` v0.13 §24.1 · 本册只给 route 侧三件**）

> **口径（写死 · 防重抄）**：**线格式的冻结正文在姊妹册**（`data-layer.spec` **v0.13 §24.1**：请求体两形态 A/B 的逐字定义、判别规则、多键不采纳的三条理由、向后兼容声明与三条判负、冻结表 `AW1`–`AW10`）；**本册不重抄**（承 §18.10 / §20.10 的「同批姊妹册 · 只指路」纪律）。

| # | route 侧三件（写死） | 现取锚 / 依据 |
|--:|---|---|
| ① | **写口 = 复用 `POST /api/admin/settings`**（`index.ts:1157`）；**闸 = `manage_settings`**（`:1158`）；**★ 不新增写口 / 不新增任何对外路径** ⇒ **注册点 69 → 69** | `index.ts:1157` / `:1158`；`grep -cE '^[ \t]*app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` 现取 = **69** |
| ② | **请求体 = 姊妹册 §24.1 的两形态**（形态 A = 既有裸值对象 · 形态 B = 显式信封 `{"key":…,"value":…}`）；**由「请求体是否存在自有属性 `key`」判别**；**形态 A 逐字兼容** | 姊妹册 §24.1；**现取判别锚** = `index.ts:1192` `screenSystemSettingsWrite(body)` ⇒ `database.ts:1014-1022`（**先剥 `SETTINGS_CONTROL_FIELDS`（`database.ts:76`）再交 `database.ts:926` `validateSystemSettingsPatch`**） |
| ③ | **读面：不新增**（**沿用** `GET /api/admin/settings`，闸 `manage_settings`；**现取只读 `system_settings` 一个键** = `database.ts:3167` `WHERE key = 'system_settings'` —— 本片**不因此改读口**） | `index.ts:1128` 一带；`database.ts:3162-3172`；承 §20.2(b) 的「不新增读口」判决 |

- **★ 判负（写死 · route 侧三条）**：**(i)** 为 `AK2` 另开写口 / 专用路由 / 新 verb ⇒ **判负**（`AG2`；且注册点必变 ⇒ 亦违本片「零新增路径」）；**(ii)** 用「路径参数形」或「查询串形」承载目标键（`/api/admin/settings/:key`、`?key=…`）⇒ **判负**（**线格式已冻结为请求体信封**；改形须先改冻结）；**(iii)** 形态 A 的行为 / 键形 / 响应出现任何差异 ⇒ **判负**（向后兼容，姊妹册 §24.1(f)）。

### 21.2 校验叠加与错误形状（**R107 一致 · 零新增码 / 零新增 `reason` 常量**）

> **口径（写死）**：**逐层校验的正文 = 姊妹册 `data-layer.spec` v0.13 §24.2**（`AV1` 顶层键 ⊆ 恰 2 键清单 → `AV2` 逐键字段闭集 → `AV3` 逐键类型 → `AV4` `amount` 语义域 → `AV5` 容器硬约束兜底；`details.field` / `reason` 稳定常量的对应表；层序短路）；**本册只给 route 侧的形状面**。

- **（a）期望码（逐字承 §18.7 · 不变）**：**`LEDGER_AMOUNT_INVALID`（`400`）**（`ledger.spec` §14.1 **既有码**；**★ 闭集 33 不增不减**）；`reason` = **稳定常量**（零新增第 4 个）：顶层键非法 / 字段名非法 ⇒ **`SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST`**（现取 `database.ts:86`）；类型不符（**含 `amount` 非正整数**）⇒ **`SETTING_TYPE_INVALID`**（`:88`）；`value` 非 object ⇒ **`SETTING_VALUE_NOT_OBJECT`**（`:90`）。
- **（b）`details` 形状（逐字承现取 · 不增不减）**：`{ field, reason, unknown_keys[], legal_keys[] }`（键 / 字段名非法）· `{ field, reason, expected, got }`（类型 / 容器）。**★ 层级区分手段 = `legal_keys` 的内容**（顶层 ⇒ 恰 2 键清单；字段层 ⇒ 该键的字段闭集）⇒ **同一常量 + 同一字段集即可区分层级 ⇒ 零新增字段、零新增常量**（现取锚 = `database.ts:952-959` / `:972-977` / `:933-938`）。
- **（c）R107 一致（写死）**：**同一端点（`POST /api/admin/settings`）的 400 类只许一种形状**（承本册 **§15** 的 R107 口径）；新增的「顶层键非法」分支**必须复用既有 `sendVerbError` + `adminVerbError(400, …)` 形状**（现取 = `index.ts:1194`）。
- **（d）判负（写死 · 三条）**：**(i)** 新分支返回**非 R107 形状**（裸 `{error:…}` / 裸 `500`）⇒ 判负；**(ii)** `reason` 采用**逐键插值形**（如 `'listing_deposit_policy_NOT_IN_APP_CONFIG_WHITELIST'`）⇒ **判负**（违 `R-8-10` 稳定常量口径 —— 现取 `database.ts:79-86` 逐字：「`reason` 是**稳定机读面**（要**能枚举** + **能映射 i18n**）⇒ 未知键**不得**用 `<KEY>_NOT_IN_APP_CONFIG_WHITELIST` 插值形」）；**(iii)** 新增第 4 个 `reason` 常量 / 新错误码 ⇒ **判负**（**闭集 33 + 三常量**为本片冻结面）。

### 21.3 ★★ `ops:` 幂等键按 target key 派生（**闭合 `O-3`** · 收口 `§7-72`）

> **缺口原文（现取 · 逐字）**：姊妹册 `data-layer.spec` §22.5 的 **`O-3`** 行逐字：「**`ops:` 幂等键必须按目标 key 派生、不得写死常量** —— 现取 `HEAD:backend-ts/src/index.ts:1147` **写死** `'system_settings'`（`resolveAdminOpsKey(req, uid, 'setting', 'system_settings')`）⇒ **新增第二个合法键时，其 `ops:` 键会落同一命名空间**（`§21.2` / `AR2` / `AG1`–`AG4` **均未覆盖**该面 —— `AG2` 只约束「写语句落点」、不约束「键名字面」）」。**⇒ 本片把它闭合。**

**（a）现取（本单 · 工作树 = `HEAD` `692626a`）**

| # | 现取锚 | 逐字 / 读数 |
|--:|---|---|
| ① | `backend-ts/src/index.ts:1162` | `  const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings');` ⇒ **第 4 实参 = 字面量 `'system_settings'`** ⇒ **`O-3` 现取仍开**（**★ 行号已漂**：`O-3` 行体记 `HEAD:index.ts:1147` 是 8① 时点；**现盘 = `:1162`** —— `R-8-14` 型漂移，**非缺陷**，但**本节起以 `:1162` 为准**） |
| ② | `backend-ts/src/admin-service.ts:39` / `:43-44` | `const ADMIN_KEY_PREFIX = 'ops:';` / `export const canonicalAdminOpsKey = (actorUid: number, action: string, businessId: string \| number) => \`${ADMIN_KEY_PREFIX}${actorUid}:${action}:${businessId}\`;` ⇒ **规范形 = `ops:<uid>:<action>:<businessId>`**；**第 4 参就是「目标键」的槽位** |
| ③ | `admin-service.ts:51-56` / `:61` / `:63-72` | 签名 = `resolveAdminOpsKey(req, actorUid, action, businessId)`；`:61` `const expected = canonicalAdminOpsKey(actorUid, action, businessId);`；`:63-72` 无键 ⇒ `adminVerbError(400, 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', { field: 'create_key', expected_prefix: ADMIN_KEY_PREFIX, canonical_key: expected }, 'Idempotency key is required for admin writes')` |
| ④ | **同族先例（证明「第 4 参按目标对象派生」是本仓既有形态）** | `index.ts:1250`（`'permission_save', String(req.body?.id ?? 'new')`）/ `:1280`（`'permission_delete', String(req.body?.id ?? '')`）/ `:1302`（`'user_update', String(req.body?.target_uid ?? req.body?.uID ?? '')`）/ `:1561`（`'points_adjust', \`${uID}:1\``）⇒ **四处均按目标对象派生**；**settings 一处 = 全仓唯一写死者** |

**（b）冻结（写死 · 闭合 `O-3`）**

| 项 | 冻结值 |
|---|---|
| 派生式 | **`ops:<admin_uid>:setting:<目标键名>`** —— 即 `resolveAdminOpsKey(req, actor.session.uID, 'setting', <目标键名>)`；**`action` 常量 `'setting'` 不变** |
| `<目标键名>` 的定义 | = **姊妹册 §24.1 解出的目标键**：**形态 A ⇒ 常量 `'system_settings'`**（⇒ **键形与现取逐字相同**）；**形态 B ⇒ 请求体 `key` 的取值**（**必先过 `AV1` 顶层键白名单**） |
| 次序（写死） | ① 闸（`manage_settings`）→ ② 信封形状 + 目标键解出 → ③ **`AV1` 顶层键判定** → ④ **`ops:` 键派生 + 校验** → ⑤ `AV2`–`AV5` → ⑥ 写落点。**★ 形态 A 下 ③ 恒通过 ⇒ 错误优先级退化为「闸 → `ops:` → 门禁」= 现取次序逐字不变** ✅ |
| **不得** | **不得**用**未过 `AV1` 的原始串**构造 `ops:` 键；**不得**把 `<目标键名>` 换成任何常量（**除形态 A 的目标键本身**）；**不得**改 `action` 常量 `'setting'`（改了破既有键形） |

**（c）可判负形（写死 · 可机读）**

| # | 断言 | 判负条件 |
|--:|---|---|
| ① | **正面判据（类级可复算）**：`grep -n "resolveAdminOpsKey(req, actor.session.uID, 'setting'" backend-ts/src/index.ts` ⇒ 该行**第 4 实参必须是「解出的目标键」变量**（如 `targetKey`） | 仍是 `…, 'setting', 'system_settings')` 字面 ⇒ **判负**（**`O-3` 未闭合**） |
| ② | **命名空间不相交（行为面）**：写 `system_settings` 的 `create_key` = `ops:<uid>:setting:system_settings`；写 `listing_deposit_policy` 的 = `ops:<uid>:setting:listing_deposit_policy` ⇒ **两个必须互不接受** | 把 A 的 `create_key` 用在 B 上而**被放行**（或反之）⇒ **判负**（**两键共用同一命名空间 ⇒ 幂等面串键，重放 / 冲突判定错位**） |
| ③ | **正确键被接受**：形态 B 写 `listing_deposit_policy`、传 `ops:<uid>:setting:listing_deposit_policy` ⇒ **必须过 `ops:` 闸** | 报 `LEDGER_IDEMPOTENCY_KEY_INVALID` ⇒ **判负**（派生式错） |
| ④ | **键形不得漂**：形态 A ⇒ `details.canonical_key` 必须**逐字** = `ops:<uid>:setting:system_settings` | 任何非该形（含 `setting:` 后为空 / 带引号 / 大小写变体）⇒ **判负** |
| ⑤ | **不得泄漏未校验串**：形态 B 传非法 `key`（不在清单）⇒ **必须先报 `AV1`**（`reason='SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'`），**不得**把该非法串拼进 `canonical_key` | 先报 `ops:` 缺键 / `canonical_key` 含清单外串 ⇒ **判负**（次序错，把「键非法」伪装成「缺幂等键」） |
| ⑥ | **零新增码 / 零新增常量** | 为 `ops:` 派生新增错误码或第 4 个 `reason` 常量 ⇒ **判负** |

**（d）`§7-72` 收口（写死 · 不重写上表）**：`§7-72` 原写「**★ 已登记（本单现取发现）**」（键寻址面缺口）⇒ **本版起读法 = 「缺口已由姊妹册 v0.13 §24 冻结线格式 + 本册 §21.1 / §21.3 收口；实现待 8③b 实现单」**；**`§7-72` 行体一字未动**（见 §7 v2.6 追加表 + 补注块 ㊳）。

### 21.4 ★★ 写面「真生效」四段判据（**route 侧 · ④ 读数口径按 `R-8-17` 订正 = 「消耗额」**）

> **裁定锚（逐字 · P6 的 AC 原文，承 §20.4）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**四段 = ① 改键（后台写）→ ② 库内落值 → ③ 业务读口取数 → ④ 行为随之**；**每段自带判负**；**★ 不得只验「后台能存」**（**「`POST` 返回 200」= 零证据**）。**段义正文 = 本册 §20.4（其一字未动）；本节的增量 = ④ 段的读数口径订正 + route 侧锚。**

| 段 | 读数内容（必给） | 现取锚 | **判负形态（必带）** |
|--:|---|---|---|
| **① 改键（后台写）** | `POST /api/admin/settings`（闸 `manage_settings`）+ 请求体（**显式信封形态**：`{\"key\":\"listing_deposit_policy\",\"value\":{\"amount\":<正整数>}}`）+ `ops:` 键（`ops:<admin_uid>:setting:listing_deposit_policy`）+ 响应（status + `data` 键集 = `{key, value}`） | `index.ts:1157` / `:1158` / `:1162`；姊妹册 §24.1 / §24.5 | **缺闸 / 闸降级** ⇒ 判负；**写未过 `AG1`–`AG4`**（未知键被静默吸收 / 类型不符回落默认值 / 越权面写成）⇒ 判负；**形态 A 的行为出现任何差异** ⇒ 判负（向后兼容，姊妹册 §24.1(f)） |
| **② 库内落值** | **表 `public.app_config` + 列 `key` / `value` / `updated_by` / `time_updated`** 与该行取值：`SELECT key, value, updated_by, time_updated FROM public.app_config WHERE key = 'listing_deposit_policy'` | 写落点 = `database.ts:3189-3196`（**`saveSystemSettings` 内的 `INSERT … ON CONFLICT (key) DO UPDATE`**）—— **★ 现取该处 `key` 字面仍写死 `'system_settings'`**（`:3190`）⇒ **实现单须参数化**（姊妹册 §24.7 `AS1`） | **写成功但库值未变 / 无该行** ⇒ 判负（**「后台能存但库内没落」**） |
| **③ 业务读口取数** | **业务侧取数点的逐字锚 + 读数**（**含来源标记 `floor_source ∈ {config, constant}`**）：`currency-service.ts:387-388`（`resolveListingDepositFloorFromDb()` ⇒ `database.ts:2038` `getListingDepositPolicyValue()` ⇒ `database.ts:117` `parseListingDepositPolicyAmount`） | `currency-service.ts:387-388` / `:170-177`；`database.ts:2038` / `:117` | **业务读口取到的仍是兜底常量（`source='constant'`）** ⇒ 判负（**「库内有新值但业务不读」**）；**只给后台读口（HTTP）当业务读口** ⇒ 判负（**后台读口 ≠ 业务读口**） |
| **④ 行为随之** | **同一可直接观察的业务量 = `listing_deposit` 的消耗额**：走**既有** `POST /api/currency/:cid/list`（`index.ts:1667`）⇒ 读 **(a)** `public.currency.deposit_amount` 行值 + **(b)** `public.ledger_entry` 的 `listing_deposit` 两腿 `delta`（**owner `balance` 减少额** + **`uid = −1` `balance` 增加额**）；**改动前 / 改动后两读数** | `index.ts:1667`（**现取 · 可达**）；`database.ts:1888`（列）/ `:1919` / `:1923`（两腿，行锚 = §20.1 现取，**本册不改其读数**） | **改动后该业务量不变** ⇒ 判负（**这正是「非只在后台显示」的正面判据**）；**只给改动后单读数** ⇒ 判负；**★ 若仍以「冻结额 / `frozen` 两腿」为 ④ 读数** ⇒ **判负**（`R-8-17` 订正口径，见 §21.5(e)-5） |

- **（b）执行面（写死 · 承 §19.4(e) / §20.4(d)）**：**实跑只许 DB 直造 + 读库**（`psql` 直连 / 直造或直改 `app_config` 键行 / `SELECT` `currency.deposit_amount` 与 `ledger_entry` 行）；**被测对象若落 append-only / 新行即生效的表 ⇒ 一律走「事务内造数 + 末尾 `ROLLBACK`」**（`R-8-15` 同族纪律；`app_config` 为 upsert 表，风险面低于 `commission_policy`，但**执行面纪律同口径**）；**不得**为验收新增 HTTP 路由、**不得**以任何后台读口承载验收读数。**★ 本单不实跑**（**零库连接 / 零 HTTP**）⇒ 判据**已写死、未实跑** ⇒ 登记 `NOT_MEASURED`（§21.6-2）。
- **（c）机读总判据（承 §20.4(c) 六条 · 本册不改其条文）**：① 四段齐全；② ② 段必给表 + 列 + 该行取值；③ ③ 段必给业务侧 `文件:行`；④ ④ 段必给改动前后两读数且同一业务量；⑤ 每段各带判负形态；⑥ **负对照（把任一段读数改成常量 ⇒ 该门必须转红；不转红 = 假门）**。**★ 本节只改 ④ 段的读数口径**（见上表 ④ 行 + §21.5(e)-5）。

### 21.5 ★★ 更正块（落实 `R-8-17`）—— `§20.5` 的「退市退还」部分标「**作废（由 `R-8-17` 更正）**」+ 更正 `R-8-2` 表述（**本册不改原行 · 由本块封堵误读**）

> **本块的效力（写死）**：**不改 `§20.5` 任何一行**（原文逐字保留，见其 (a)(b)(c)(d)）；**读法一律以本块为准**。**本块 = 更正块，不是新裁定** —— 裁定来源 = **`R-8-17`**（Zang）。**★ 依据 `R-8-17` 第 3 条（逐字）**：「spec 侧由 **Jing 下一轮以「追加更正块」**（不改原行）把 `route-layer.spec` **§20.5 的退还部分标为「作废（由 R-8-17 更正）」**；**同一轮**追加更正我在 **§5.186 的 R-8-2** 表述。（**注**：本轮已落地的 §20.5 正文一字不改 ⇒ 守只追加；由更正块封堵误读。）」（`docs/seafood.master-plan.md:1524`）

**（a）被更正的对象（逐字 · 现取 · 原样保留）**

| # | 对象（现取锚） | 逐字原文（**在册 · 本块不改一字**） | 本块处置 |
|--:|---|---|---|
| ① | **`§20.5` 节首裁定锚**（**v2.5 基线 `:4781`** ⇒ **本版现取 `:4827`** · 见 §21.0 漂移声明 + §8.28.3） | 「**退市退还走既有 `hold_release` 路径**；**冻结口径 = `hold_release` = `frozen → balance`**（**同账户搬运、2 条分录**）」 | **★ 作废（由 `R-8-17` 更正）** |
| ② | **`§20.5(b)` 的「对应关系」块**（**v2.5 基线 `:4793`** ⇒ **本版现取 `:4839`**） | 「**「退市退还」= 在该币种退市时，对「上市时冻结的保证金」调用 ①（`unfreeze` ⇒ `op='hold_release'`）** ⇒ 由 ② 落**同账户两腿**（`frozen −dep` / `balance +dep`），**金额 = 上市时冻结的同一金额**（`public.currency.deposit_amount` …）」 | **★ 作废（由 `R-8-17` 更正）** |
| ③ | **`§20.4(b)` 的 ④ 段「退还面」读数**（**v2.5 基线 `:4761`** ⇒ **本版现取 `:4807`**） | 逐字（节选）：「**退还面**：`hold_release` 两腿金额（`0020:381-382`）」 | **★ 作废（由 `R-8-17` 更正）**；**④ 段读数口径订正 = §21.4** |
| ④ | **`§20.9` 的 `I-5`**（**v2.5 基线 `:4849`** ⇒ **本版现取 `:4895`**） | 「**退市退还的账务接线**（走 `unfreeze` ⇒ `op='hold_release'`；金额 = `currency.deposit_amount`；**禁 `hold_forfeit`**）」 | **★ 作废（由 `R-8-17` 更正）**（**射程收缩后无此待办**） |
| ⑤ | **`§20.9` 的 `I-4`**（**v2.5 基线 `:4848`** ⇒ **本版现取 `:4894`**） | 「**退市触发口**：形态（路径 / 方法 / 闸 / 请求体）与**发起方**裁定 ⇒ 落定后**必须回写本册并登记注册点 69 → N**」 | **★ moot（随 `R-8-17` 第 4 条）** |
| ⑥ | **`§20.5(c)`（`hold_forfeit` 禁线）+ `I-5` 的「禁 `hold_forfeit`」半句** | 「**严禁实现 `hold_forfeit`；严禁复活任何已删名**」 | **★ 仍然有效（不在作废射程）** —— **本块不改其读法**（见 (e)-7） |

**（b）错在哪（根因 · 逐字承 Zang §5.190 B 的认账）**

- Zang **`§5.190 B`**（`docs/seafood.master-plan.md:1515-1519`）**认账逐字**（三件）：① **`DL67`**（已冻结，R31/§19.8.B）：「上市账务 = … + `listing_deposit`（**消耗、入 `uid = −1`**）；**下架无账务动作（保证金不退；不存在罚没）**」；② **`DL88`**（已冻结）：「`listing_deposit` = **上市即消耗（`balance → uid −1`）**、**不可退、无罚没、无退还 kind** ⇒ **路由不得提供「退还保证金」按钮或接口**」；③ **`AN1`/`AN2`**：「`listing_deposit` **不属于 hold 家族**（`0019`/`0020` 已 apply；hold 家族现只 4 个 = `hold`/`hold_release`/`job_escrow`/`job_escrow_refund`）；其账务 = **跨账户消耗**（借 owner `balance`、贷 `uid = −1` `balance`，**`frozen` 零变动**）」。
- **⇒ 错处（逐条）**：**(i)** `R-8-2` 的 (b)「退市退还走既有 `hold_release` 路径」**与 `DL67` / `DL88` 的字面互斥**（一边「不得提供退还接口」、一边要求「退市退还」）；**(ii)** 它**复活的正是 `§5.80` 被推翻的「保证金冻结可退」错误推断**；**(iii)** **根因** = 裁 `R-8-2` 时用的是**盘点件的项名转述**（`hold_release` / `hold_forfeit` 与保证金并列），**未现取 `DL67` / `DL88` 原文**（`R-8-2` 的定义处 `:1759` 的「冲突」栏恰记着这个「项名雷」——**它治了 `hold_forfeit` 一侧，漏了 `hold_release` 一侧**）。
- **★ 本册自身的连带（诚实登记）**：`§20.5(d)` 当时**已把该冲突登记为停报项 `§7-73` 并给出双向判负**（**未静默、未擅改**）⇒ **该停报的裁断已到**（= `R-8-17`），**停报项就此关闭**（§7 追加表 7-77 + 补注块 ㊳）。

**（c）正确口径（`R-8-17` 逐字 · `docs/seafood.master-plan.md:1522-1525`）**

> **①** 8③ 射程收缩为「**(a) 上市保证金金额可配置**」（+ **fail-closed 下限机制** + **真生效四段**）；**④「行为随之」的读数口径订正为**：走既有 **`POST /api/currency/:cid/list`**（`index.ts:1667`，**可达**）⇒ 改键后**上市的 `listing_deposit` 消耗额随之变**（读数 = owner `balance` 减少额 + **`uid = −1` balance 增加额**；**不是**冻结额）。**②** **`R-8-2` 的 (b)「退市退还」正式作废** —— 依 **`DL67`/`DL88`/`R31` 冻结口径**：「下架**无账务动作**、保证金**不退**、**无罚没**、**不得提供退还接口**」；**`hold_release` 与 `listing_deposit` 无关**。**③** 连带：spec 侧由 **Jing 下一轮以「追加更正块」**（不改原行）…… **④** **退市触发口「不存在」一事随之 moot**（下架无账务动作 ⇒ 本片**无需**新增 `delist` 路由）。

**（d）依据（逐字 · 现取 · 行锚两件）**

| 依据 | 现取锚 | 逐字原文 |
|---|---|---|
| **`DL67`** | `docs/data-layer.spec.md` —— **v0.12 基线 `:460`** ⇒ **本版现取 `:461`** | 『**单位上市（`draft → listed`）不需要新表**：`currency` 已有 `status` / `listed_at` / `deposit_amount` / `deposit_cid`（`0001`）。上市事务的账务 = `currency_create_fee`（若适用）+ `listing_fee` + `listing_deposit`（**消耗、入 `uid = −1`**，R31）。**下架无账务动作**（保证金不退；**不存在罚没**，v0.3 裁定）。』（**状态栏 = 【已冻结】**） |
| **`DL88`** | 同上 —— **v0.12 基线 `:536`** ⇒ **本版现取 `:537`** | 『**`listing_deposit` 的语义**：**上市即消耗**（`balance → uid −1`），**不可退、无罚没、无退还 kind**（R31 / v0.3）。⇒ 交易所路由**不得**提供「退还保证金」按钮或接口。』（**状态栏 = 【已冻结】**） |
| **`R31`** | `docs/ledger.spec.md:288`（现取） | 『① `listing_deposit` = **消耗** `deposit_amount` 的 `$`（**不可退** ⇒ 记 `delta` 负数，转入平台手续费归集账户 `uid = −1`，即**计入平台收入**）……✅ **v0.2 更正（依据 Kevin 原文）**：Kevin 原文「用户自定义的社区积分如需上市，需要**消耗**一定的积分作为保证金」⇒ **保证金是消耗、计入平台收入；不存在可退保证金；`listing_deposit_refund` 这个 kind 不存在**』 |
| 同族补强 ① | `docs/ledger.spec.md:273`（现取） | 『`listed / frozen → delisted` | 下架（创建者申请或平台强制） | 正常下架：**无账务动作**（保证金已在上市时消耗，**不退**）』 |
| 同族补强 ② | `docs/ledger.spec.md:192`（现取） | 『-- v0.2 更正：移除 'listing_deposit_refund'（保证金改为消耗不可退，不存在退还 kind，见 §3.1 R31 / §19.0）』 |
| 同族补强 ③（代码面） | `backend-ts/src/ledger.ts:149-150`（现取） | 『`listing_deposit_forfeit`：P1c 新裁定删（保证金在上市时即消耗、进平台收入 `uid=-1`……』 |
| 同族补强 ④（已 apply 迁移） | `backend-ts/migrations/0019_listing_deposit_platform_credit.sql`（**`-1` credit 白名单接纳 `listing_deposit`**）+ `0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（**把 `listing_deposit` 从 hold 家族 IN 列表摘除**） | **两迁移均已 apply**（`/health` `schema_version=0024`；承 §20.1 现取）⇒ **`listing_deposit` 现取不在 hold 家族** |

**（e）更正后的读法（写死 · 逐条 · 可判负）**

| # | 命题 | 更正后的读法（**本块为准**） | 判负（出现即缺陷） |
|--:|---|---|---|
| 1 | **`§20.5` 的退还路径** | **作废**；`hold_release` 与 `listing_deposit` **无关**（`listing_deposit` **不在 hold 家族** = `0019`/`0020` 已 apply 的事实） | 实现方按 `§20.5(a)(b)` 实现「退市 ⇒ 调 `unfreeze` ⇒ `hold_release`」⇒ **判负** |
| 2 | **下架 / 退市的账务** | **无账务动作**（保证金已在上市时消耗、**不退**；**无罚没**） | 为退市新增任何 `ledger_entry` 腿 / 新 kind / `hold_release` 调用 ⇒ **判负** |
| 3 | **退还接口** | **不得提供**（`DL88` 逐字：**不得**提供「退还保证金」按钮或接口） | 新增任何「退还保证金」路由 / 按钮 / 后台动作 ⇒ **判负**（**注册点仍 69**） |
| 4 | **8③ 的射程** | **仅 (a) 上市保证金金额可配置**（+ fail-closed 下限 + 真生效四段） | 把范围外扩到「退还」⇒ **判负** |
| 5 | **④ 段（行为随之）的读数** | 走 **`POST /api/currency/:cid/list`（`index.ts:1667`）** ⇒ 读 **`listing_deposit` 的消耗额**（owner `balance` 减少额 + `uid = −1` `balance` 增加额）；**不是冻结额** | 仍以「冻结额 / `frozen` 两腿」为 ④ 读数 ⇒ **判负**（正文本册 §21.4） |
| 6 | **退市触发口（`§7-73` 的 (一) 项）** | **moot**：下架无账务动作 ⇒ **本片无需新增 `delist` 路由** | 为实现「退市退还」而新增 `delist` 路由 ⇒ **判负** |
| 7 | **`hold_forfeit` 禁线（`§20.5(c)` + `§7-74`）** | **仍然有效**（**不在作废射程**）：**严禁实现 `hold_forfeit`、严禁复活任何已删名** | 见 `§20.5(c)` 判负三条（**射程声明不变**：既有在册件里的 `hold_forfeit` 字面不在射程） |
| 8 | **`§20.5(d)` 的停报项 `§7-73`** | **已收口**（裁断 = `R-8-17`）；**`§7-73` 行体一字未动**，读法以本块为准 | 仍按 `§20.5(d)` 的「不择一 / 待 Zang 收口」处置 ⇒ **判负**（拖住已裁事项） |

**（f）同批更正：`R-8-2` 表述的引证卫生（**本册现取发现 · 一并登记**）**

- **★ 现取核对（承 `R-8-14` / §18.6 引用纪律）**：`grep -n 'R-8-2' docs/seafood.master-plan.md` 现取命中 = **`docs/seafood.master-plan.md:1759`**（**`R-8-2` 定义处 · §5.179 B 六条裁定表**）/ **`:1554`**（§5.189 E 行文「**严禁 `hold_forfeit`／严禁复活已删名**（R-8-2）」）/ **`:1509`**（§5.190 节标题）/ **`:1519`**（§5.190 B 认账）/ **`:1523`**（§5.190 C.2 作废声明）；**⇒ `§5.186` 节内（`:1595`–`:1611`）`R-8-2` 命中 = 0**（该节是「8② 实现交回（未完工…）+ `R-8-15`」节）。
- **⇒ 更正（写死 · 引证卫生）**：派单（`:1436`）与 `§5.190 C.3`（`:1524`）所述「**§5.186 的 `R-8-2` 表述**」，**在本仓现取面内不存在** ⇒ **本更正块以 `:1759` 的定义处为准**（**更正实体不受影响**：`R-8-2` 的 (b) 项作废）；**并对 `:1554` 的行文一并给更正读法**。**★ 本册不修改 `master-plan` 任何一行**（其属**只读引用**的上位册；本块以**追加**承载更正读法）。
- **★ `R-8-2` 定义处逐字（`docs/seafood.master-plan.md:1759`）**：『| **R-8-2** | **C-5 项名雷**：派单项名把 `hold_release`/`hold_forfeit` 与上市保证金并列，而冻结口径相反（`hold_release` = frozen→balance；**`hold_forfeit` = DL91 未启用、无可罚没标的物**）。 | ✅ **批 8 保证金片 = 仅「(a) 上市保证金金额可配置 + (b) 退市退还走既有 `hold_release` 路径」**；**严禁实现 `hold_forfeit`、严禁复活任何已删名**（照项名实现 = 复活 §5.81 已推翻的推断）。 |』
- **⇒ 逐项更正读法（写死 · 三件）**：**(i)** 该格的「**(a) 上市保证金金额可配置**」**= 仍然有效**；**(ii)** 该格的「**(b) 退市退还走既有 `hold_release` 路径**」**= 作废**（由 `R-8-17` 第 2 条）；**(iii)** 该格的「**严禁实现 `hold_forfeit`、严禁复活任何已删名**」**= 仍然有效** —— **★ 且这正是本错误最刺眼处**：**禁令与违规出现在同一格内**（同一格要求「退市退还」又要求「严禁复活已删名」，而「退市退还走 `hold_release`」恰恰是**复活** `hold_release` 与保证金的错误关联）。
- **★ `:1554` 行文的更正读法（写死）**：该行「**严禁 `hold_forfeit`／严禁复活已删名**（R-8-2）」**与作废无关、仍然有效**；**但该行句首的「上市保证金『可配置 + 退市退还』」短语，其「+ 退市退还」部分须按 `R-8-17` 读为「**已作废**」**（该行**一字未改**；读法以本块为准）。

### 21.6 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **形态 B 写入的实跑两态（入册前 / 后）** | **本单为规范单、零代码 / 零库连接 / 零 HTTP** ⇒ 判据**已写死、未实跑**；**现取可证的只有「代码面判据本体在册」**（`database.ts:54` 恰 2 键 + `:926` 未知键分支 + `:1162` 的写死 `ops:` 键）⇒ **HTTP 实跑读数 = `NOT_MEASURED`** |
| 2 | **§21.4 四段判据的判负实跑** | **零代码 / 零库连接** ⇒ **判据已写死、未实跑**（归 8③b 实现单 + 质检单）；**四段 + 每段判负 = 已给；实跑读数 = 未给** |
| 3 | **`ops:` 按 key 派生后的实际键形态**（`O-3` 闭合的形态面） | **未实现** ⇒ **无读数**（**不得**填示例值冒充实测；§21.3(b) 的派生式 = **冻结式**，非实测） |
| 4 | **形态 B 改造后的实际响应体** | **未实现** ⇒ **无读数**（姊妹册 `AW8` 为**冻结值**，不是实测值） |
| 5 | **现库 `app_config` 的行集（`listing_deposit_policy` 是否已被误写）** | **零库连接**（红线）⇒ 转引姊妹册 §21.6-1 / §22.6-1 / §23.6-1 / §24.8-4 的口径；**实测现值 = `NOT_MEASURED`**（**不得**把「理论上无」写成「实测无」） |
| 6 | **`R-8-17` 后「退市退还」在现取面内的残留面** | **不作断言**：**本单只登记「作废」这一读法**；**现取未逐一扫描「其它册内是否仍有『退市退还』行文」**（**§20 状态块 / §7-73 / §8.27 等处的历史行文按「旧行不改」处理**）⇒ **残留清单 = `NOT_MEASURED`** |
| 7 | **本单代码行锚在实现单落盘后的有效性** | 四件源码指纹已现取（§21.0 末行）⇒ **实现单落盘后必然漂移**；**本册自身 spec 未被并发单触碰**（开工时 `git status --porcelain docs/` = **空**）⇒ **本单 spec 现值成立** |

### 21.7 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§20.5`（退市退还 ↔ `hold_release`）** | **★ 退还部分作废**（由 `R-8-17` 更正，正文 = §21.5）；**`§20.5` 行体一字未动**（含 (a)(b)(c)(d)）；**`§20.5(c)` 的 `hold_forfeit` 禁线仍然有效** |
| **`§20.4`（真生效四段）** | **承 + ④ 段订正**：段义不变；**④ 段读数口径 = 「消耗额」（走 `POST /api/currency/:cid/list`，`index.ts:1667`）**（正文 = §21.4）；**`§20.4` 正文一字未动** |
| **`§20.6`（键寻址面：缺口 · 待实现单 · **本单不发明线格式**）** | **★ 兑现**：**线格式已冻结**（姊妹册 v0.13 §24.1；本册 §21.1 指路）；**其「本单不选、不发明」与 §20.9 `I-1` 的「线格式待定」自此作废**（**该节行体一字未动**） |
| **`§20.9` 的 `I-1`** | **部分兑现**：线格式已冻结 ⇒ **实现单可直接落地**；`I-1` 行体**一字未动** |
| **`§20.9` 的 `I-4`** | **★ moot**（`R-8-17` 第 4 条：下架无账务动作 ⇒ 无需 `delist` 路由）；行体**一字未动** |
| **`§20.9` 的 `I-5`** | **★ 作废**（退市退还作废 ⇒ 无该账务接线待办）；行体**一字未动** |
| **`§20.9` 的 `I-6`** | **★ 收口**：`DL67`/`DL88` ↔ `R-8-2` 的收口 = `R-8-17`（正文 = §21.5）；行体**一字未动** |
| **`§20.9` 的 `I-7`** | **★ 兑现**（`ops:` 按目标键派生 = §21.3）；行体**一字未动** |
| **`§17.3` 的 `AR1`–`AR4`（写口准入）** | **承**：本节 §21.1 复用同写口与逐键白名单；**本片零新落点、零新路径** |
| **`§18.6`（引用纪律）+ `§19.6(d)`** | **承**：本节全部引用**现取且逐字**；**代码锚 = §21.0 末行四件指纹时点**；**册内锚一律两件**（基线 `:N` ⇒ 本版现取 `:N+k`，见 §21.0 漂移声明） |
| **`§18.7`（借码映射）** | **承**：`AG1`/`AG3` 借 `LEDGER_AMOUNT_INVALID`（`400`）**不变**；本节**零新增码 / 零新增 `reason` 常量**（§21.2） |
| **`§7-72` / `§7-73` / `§7-74`** | **读法更新 = §7 v2.6 追加表（7-75…7-77）+ 补注块 ㊳**；**三行行体一字未动** |
| **`data-layer.spec` v0.13 §24（键面正文）** | **同批姊妹册**：其 §24.1–§24.6 = **线格式 / 校验叠加 / `ops:` 派生 / 类型下限 / 四段 / 权限键**正文；**本册只指路、不重抄** |
| **`ledger.spec` §14.3 / §14.1** | **只读引用**（借码授权 + 33 码闭集）；**本单未改其一字** |
| **`docs/commission.spec.md`（真源册 · 只读）** | **无涉本片**（本片不碰费率 / 分配口径）；**只读 · 未改一字** |

## §22 ★★ v2.7 · 批 8 第 4 片（8④）契约冻结：**自建单位审核闸** —— 读写口契约 + 注册点登记 + 权限键（`review_tasks`）+ 真生效四段判据 + 后台页数据契约与四语文案面（**v2.7 新增 · 本节只追加 · 依据 = 批 8 第 4 片（8④）派单 + 已裁 `R-8-8` / `R-8-3`；状态 / 载体 / 留痕正文 = 姊妹册 `data-layer.spec` v0.14 §25**）

> **★ 本节硬约束（写死）**：**不得发明状态值 / 路径风格 / 权限键**；**新路由必须逐字登记注册点增量**；**权限键必须在既有 11 键内选**（`R-8-1`）；**变体不择一**（选型 = Zang）。

### 22.0 开工锚（现取 · 逐项）

| 项 | 现取读数 | 锚（本单现取时点） |
|---|---|---|
| 仓库 HEAD | `main`（`git status --porcelain docs/` = 仅 `?? docs/qa/p8-s3b-write-path-review.md`（**他人在读 · 未碰**）） | 本单 |
| 本册改前（v2.6） | **`wc -l` 5095（逻辑 5096）/ 1095779 B / md5 `91c66773cca09e361c6cb9b1b1b4ed0f`** | `wc` / `md5 -q docs/route-layer.spec.md` |
| 本册末行 | **不带换行符**（末字节 = `2d` = `-`）⇒ **追加插在末行 `---` 之前** | `tail -c 1 | od` |
| **注册点现取** | **69**（`grep -cE '^app\.(get|post|put|patch|delete)\(' backend-ts/src/index.ts` = **69**；分布 = **get 28 / post 38 / put 0 / patch 1 / delete 2**） | `backend-ts/src/index.ts` |
| 姊妹册（data-layer） | **v0.14 · 1621 → N 行 / 403715 B → N B / md5 `fa6822fc…`**；末行**带换行符** | `wc` / `md5` |
| 旧快照（改前既存） | `docs/versions/route-layer.spec.v0.1…v2.6` = **26 件**（一字未动）；`docs/versions/data-layer.spec.v0.1…v0.13` = **13 件** | `ls docs/versions | grep -c` |
| 库 / HTTP | **零库连接 / 零 HTTP / 零套件** | — |

### 22.1 现取盘点（C1 / C2 现状 · 逐字带锚）

**（a）C1 `POST /api/currency`（建单位 · 现状）（现取）**：

| 项 | 逐字读数 | 锚 |
|---|---|---|
| 路径 / 方法 | `POST /api/currency` | `backend-ts/src/index.ts:1685` |
| 闸 | `requireActor(req, res)`（**仅登录校验 · 无 admin 闸 / 无权限键**） | `backend-ts/src/index.ts:1686` |
| 服务层 | `createCurrencyVerb({ actorUid, body, headerKey })` | `backend-ts/src/currency-service.ts:230` |
| 真落库 | `DatabaseService.createCurrencyWithFee`（单语句 CTE） | `backend-ts/src/database.ts:2119` |
| 入账 | `currency_create_fee` **×2**（owner `balance −fee` / `uid = −1` `balance +fee`） | `database.ts:2154` / `:2157` |
| 落地状态 | `status: 'draft'`、`deposit_amount: '0'`、`deposit_cid: '1'` | `currency-service.ts:336-338` |
| 幂等键 | 调用方键优先；缺省派生 `biz:currency:create:<symbol>` | `currency-service.ts:274` |

**（b）C2 `POST /api/currency/:cid/list`（上市 · 现状）（现取）**：

| 项 | 逐字读数 | 锚 |
|---|---|---|
| 路径 / 方法 | `POST /api/currency/:cid/list` | `backend-ts/src/index.ts:1713` |
| 闸 | `requireActor` + 服务层 **owner 守卫**（非 owner ⇒ `403 AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`） | `index.ts:1714`；`currency-service.ts:441-448` |
| 服务层 | `listCurrencyVerb({ cidRaw, actorUid, body, headerKey })` | `currency-service.ts:363` |
| 状态迁移 | `draft → listed`（`UPDATE … SET status='listed', listed_at=now(), deposit_amount=$3 WHERE status='draft' AND owner_uid=$4`） | `database.ts:210-221`（`LIST_CURRENCY_WITH_DEPOSIT_SQL`） |
| 入账 | `currency_create_fee` ×2 + `listing_deposit` ×2 → **贷 `uid = −1`**（上市即消耗，不可退） | `database.ts:236-250` |
| 审计留痕 | **同事务** `INSERT INTO public.currency_status_log (cid, from_status, to_status, actor_uid, memo)`（硬编码 `'draft'` / `'listed'`） | `database.ts:222-227` |
| 重复上市 | `409 LEDGER_CURRENCY_INVALID_TRANSITION` | `currency-service.ts:454` |

**（c）现状结论（写死）**：**现状 = 无 admin 审核闸** —— `currency` **由 owner 自迁状态**（C1 落 `draft` ⇒ C2 由 owner 迁 `listed`）；**审核闸 / 后台待审页 / 权限闸三者现取全缺**（承 `docs/audit/p8-p6-recon.md:92` 逐字「审核闸 / `currency_status_log` 写入 / 后台待审页三者全缺」）；★ **但「`currency_status_log` 写入」一句与现取冲突**（见 (d)）。

**（d）★ 现取冲突登记（诚实登记 · 不改他人行）**：`docs/audit/p8-p6-recon.md:87/219` 与 `docs/seafood.master-plan.md:1817/1843` 记「`currency_status_log` **表零写入 / 0 命中**」；**本单现取 = `grep -rn 'currency_status_log' backend-ts/src/` 2 命中**（`database.ts:223` 写 + `:2189` 注释）⇒ **以现取为准**；**该两件之行一字未改**（本单只登记）；**准确表述 = 「单边写入（恰 `draft → listed` 一条边）」而非「零写入」**；**表 DB 行数 = `NOT_MEASURED`**（零库连接）。**逐条现取核对表 = 姊妹册 `data-layer.spec` v0.14 §25.2**（正文不重抄）。

### 22.2 ★★ 审核面读写口契约

**（a）读口（待审 / 全部单位「只读列表」）—— ★ 本单冻结新增（逐字登记）**：

| 项 | 冻结值（本单钉死） | 依据 / 先例（现取） |
|---|---|---|
| 路径 / 方法 | **`GET /api/admin/currency`** | **★ 非发明**：**admin 命名空间 + 既有资源名词 `currency`**（`index.ts:1685` 逐字）；**同族先例** = `GET /api/admin/commission_policy`（`index.ts:2082`）/ `GET /api/admin/settings`（`:1133`） |
| 闸 | **`requireAdmin(req, res, 'review_tasks')`**（`R-8-8` 临时复用 · 11 键内） | 本单 §22.3；`R-8-8`（`docs/seafood.master-plan.md:1803`） |
| **注册点** | **69 → 70**（**逐字登记**：`grep -cE '^app\.(get|post|put|patch|delete)\('` 现取 = **69** ⇒ 本读口落地后 = **70**） | 本单 §22.0 |
| 响应形状（**R107 口径**） | **成功** = `{success:true, message, data:{…}}`（`sendSuccess` 形状）；**失败** = **R107** `{error:{code, message, i18n_key, details}}` | `sendSuccess` = `index.ts:100-115`；§3.3 条款 9′ / §15.5 / §15.6 |
| `data` 形状（**键集自本单起冻结**） | **单位行数组**，逐键 = **现取 `currency` 列**：`cid` / `symbol` / `name` / `status` / `owner_uid` / `time_created` / `listed_at`（**可选**：`deposit_amount` / `deposit_cid` —— 依实现单）；**★ 键集自本单起冻结、不得增删** | `0001_ledger_core.sql:13-38`（`currency` 列现取） |
| 否可选 `status` 过滤 | **允许**（`?status=<四值之一>`）；**非法值 ⇒ `400`**（**不得静默回落**，见 (c)） | §3.1（形状非法 = 400 口径） |
| 幂等键 | **无**（读口无副作用 ⇒ 不需 `ops:` 键；先例 = `GET /api/admin/commission_policy` 亦无） | 本册 §19.2(b) |
| 只读纪律 | **只 `SELECT`**；**不得**借读口补写 / 回填 / 修正 `currency` 或 `currency_status_log` | `DL23` 同向 |
| 迁移面 | **零迁移 / 零 DDL**（`currency` 表在既有迁移 `0001` 内） | `0001:13-38` |

**（a2）动作口（审核「通过 / 驳回」）—— ★ 依变体（姊妹册 §25.3）· 本单只登记候选、不自选**：

- **候选（不构成裁定）** = **`POST /api/admin/currency/:cid/review`**（请求体含审核决定字段；**字段名 = 待实现单 / Zang 定，本册不发明**）⇒ **注册点 69 → 71**（读口 +1、动作口 +1）。
- **★ 变体 Ⅲ（纯闸 · 复用上市边）⇒ 不新增动作口**（复用 C2 的 `draft → listed` 语义，admin 身份触发）⇒ **注册点 69 → 70**（仅读口）。
- **★ 本单不择一**：动作口的「是否存在 / 路径名 / 决定字段」**均依 Zang 选型**（**登记 = §22.6**）。
- **闸（若存在）= `review_tasks`**（同读口，`R-8-8`）。

**（b）通过 / 驳回 两条路径各自的可判负形（写死）**：

| 路径 | 正向（必给） | **判负形态（必带）** |
|---|---|---|
| **通过** | ① 动作口返回 200 + `data` 键集；② 库内落值 = `currency.status` 迁移 + `currency_status_log` 恰 1 行（`from_status` = 决策前态 / `to_status` = 决策后态 / `actor_uid` = admin uid）；③ 业务读口读新值；④ 行为 = 该单位**可上市 / 可挂单标价酬金** | **仅 `currency.status` 变而 `currency_status_log` 无新行 ⇒ 判负**；**仅日志有行而 `status` 未变 ⇒ 判负**；**「通过」返回值 200 但库内两处均未变 ⇒ 判负**（「写成功但库值未变」）；**`actor_uid` 记成 owner 而非 admin ⇒ 判负** |
| **驳回** | ① 动作口返回 200（或既有语义）；② 库内落值 = **依变体**（Ⅰ = `⟨待审⟩ → delisted`；Ⅱ = 新表落 `⟨驳回⟩` 行；**Ⅲ = 无落值 ⇒ 本路径判负**）；③ 业务读口仍拒（单位不可上市）；④ 行为 = 该单位**不可上市**（C2 拒） | **驳回后面仍可上市 ⇒ 判负**；**驳回路径无任何库内落值（变体 Ⅲ）⇒ 判负**（② 段缺失）；**驳回后 `currency.status` 落入模糊态（既非 `draft` 亦非 `listed` 且与闭合集不符）⇒ 判负** |

**（c）未知 / 非法入参不得静默（写死 · 可判负）**：

| # | 输入 | 期望 | 判负 |
|--:|---|---|---|
| 1 | `:cid` 非数字 | **`404` + `LD007 LEDGER_CURRENCY_NOT_FOUND`**（先例 = §3.1「非数字 `:jID` `400 → 404`」统一口径） | **静默按 0 处理 / 返回 200 空列表 ⇒ 判负** |
| 2 | `:cid` 不存在（`cid <= 0` 或该行不在） | **`404` + `LD007`**（依据 = `ledger.spec` §14.3 v0.5：`cid<=0` = 形状合法但不存在 ⇒ `404`） | **`400` / `500` ⇒ 判负** |
| 3 | `?status=` 非四值之一 | **`400` + 既有码 + `details.field` / `details.reason`**（R107 形状） | **静默忽略该过滤参数 / 回落全量 ⇒ 判负** |
| 4 | 动作口决定字段缺失 / 非枚举值 | **`400`**（形状闸；**不得静默取默认决定**） | **缺字段被当「通过」/「驳回」⇒ 判负** |
| 5 | 无 token / 非 admin / 缺 `review_tasks` | **`401`（无 token）/ `403` + `reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`**（`AUTH_REASONS` 现取） | **落到业务 200 / 500 ⇒ 判负** |
| 6 | 数据库基础设施错误（`code == null`） | **`503` + `driver_connection_error`**（D1′ 口径） | **吞成 `400` / 静默 ⇒ 判负** |

**（d）R107 形状（写死 · 逐字承 `§3.3` 条款 9′ / `§15.5`）**：`{error:{code, message, i18n_key, details}}` —— `code` = **机读唯一真源**；`i18n_key` = **本地化真源**（形如 `ledger.err.<CODE>`）；`message` = **人类可读稳定英文句（严禁填机读码）**。**同端点内 400 类只许一种形状**（R107）。**零新增错误码 / 零新增 `reason` 常量**（33 码闭集不动）。

**（e）为何新增读口属「功能需求」而非「为验收凑数」（双向判负 · 逐字承 `R-8-6`）**：后台审核页**必须**有读口才能展示待审单位 ⇒ **功能需求，允许新增、须冻结并登记注册点 69 → 70**；而**行为验收**（§22.4 的 ④ 段读数）**只许 DB 直造 + 读库，不得依赖该读口**。**(i)** 若把验收读数写成依赖 `GET /api/admin/currency` ⇒ **判负**；**(ii)** 若以「验收不得新增路由」为由拒绝实现读口 ⇒ **混同二者 ⇒ 判负**。

### 22.3 ★★ 权限键映射（**先现取逐字十一键，再给映射；`R-8-1` / `R-8-8` 履约**）

**（a）既有十一权限键（现取 · 三真源逐字 · 不增不减）**：
- **真源 A（后端唯一真源）** = `backend-ts/src/database.ts:11-23` `ALL_ADMIN_PERMISSIONS`：`dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · `review_tasks`（**恰 11 键**）。
- **真源 B（迁移种子）** = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`（11 行 `INSERT INTO public.admin_permission`；键集逐键相等；apply-time 自检 `:112-132`）。
- **真源 C（前端兜底）** = `frontend/src/admin-utils.js:40-52`（11 键）。
- **★ 闭集（写死）**：**恰好 11 键，不增不减**（`R-8-1`）。

**（b）8④「所需权限 → 既有键」映射表**：

| 口 | 所需权限（语义） | → **既有键（11 键内）** | 依据 / 说明（现取） |
|---|---|---|---|
| **读口** `GET /api/admin/currency` | 读待审 / 全部自建单位（**只读**） | **`review_tasks`** | **`R-8-8` 逐字**（见 (c)）；语义 = **审核 / 审批面** |
| **动作口**（若存在，依变体） | 通过 / 驳回自建单位上市 | **`review_tasks`** | 同键（**读写同权**） |
| **后台页**（审核页） | 进面板 + 读 / 审 | **`review_tasks`** + **`dashboard_access`**（进面板） | `dashboard_access` = `ALL_ADMIN_PERMISSIONS` 首键（面板入口） |

> **★ 映射表口径（写死）**：**逐行给死**；**凡找不到合适键 ⇒ 显式写「无 ⇒ 停报」**（**不得**填一个「看起来像」的键凑数）。**本表无「停报」行**。

**（c）★ `R-8-8` 逐字（`docs/seafood.master-plan.md:1803`）**：『**`R-8-8`** | **8④⑤ 审核面权限键**（`review_tasks` 语义不完全吻合） | ✅ **确认临时复用 `review_tasks`**：两片本质均为**审核/审批**面（④ 自建单位审批、⑤ 合规审核/下架）；**若 ⑤ 的 takedown 后续落成独立动作面 ⇒ 再报我裁**。独立键（`manage_currency` 等）⇒ 跨批。』

**（d）★ `review_tasks` 现取消费面（5 处 · 逐字带锚 · 语义核对）**：

| # | 消费点（现取） | 锚 |
|--:|---|---|
| ① | `GET /api/tasklist/pending-verification/count` 闸 | `backend-ts/src/index.ts:1442` |
| ② | `GET /api/tasklist/pending-verification` 闸 | `backend-ts/src/index.ts:1457` |
| ③ | `POST /api/tasklist/:jID/verify` 闸 | `backend-ts/src/index.ts:1473` |
| ④ | `POST /api/job/:jobId/review` 闸（结算审核） | `backend-ts/src/index.ts:1876` |
| ⑤ | `POST /api/job/:jobId/cancel` 闸 | `backend-ts/src/index.ts:1900` |

⇒ **全部 5 处皆为「审核 / 裁决」面**（任务提交核验、招工结算审核、招工取消）⇒ **语义与自建单位审核吻合**（临时复用成立）；**独立键 `manage_currency` ⇒ 跨批**（`R-8-8` 逐字）。

### 22.4 ★★ 「真生效」四段判据（route 侧 · **每段自带判负 · 不得只验「后台能存」**）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**本单把它落成四段**：**① 后台审 → ② 库内落值（表 / 列）→ ③ 业务读口取数（`文件:行`）→ ④ 行为随之（改动前 / 改动后两读数）**；**每段必须能判负**。**★ 不得只验「后台能存」**（**「审核 `POST` 返回 `200`」= 零证据**）。

| 段 | 读数内容（必给） | **判负形态（必带）** |
|--:|---|---|
| **① 后台审** | 动作口路径 + 方法 + 闸 + 请求体（逐字）+ 响应（status + `data` 键集） | **缺闸 / 闸降级（非 `review_tasks`）⇒ 判负**；**响应 `data` 键集 ≠ 冻结键集 ⇒ 判负** |
| **② 库内落值** | **表 `public.currency` 列 `status`**（依变体）+ **表 `public.currency_status_log` 的 `cid` / `from_status` / `to_status` / `actor_uid` / `time_created`（逐字 `SELECT` 读数 · 审一次恰 1 行）** | **表 / 列处该值未随之变 ⇒ 判负**（**「后台能存但库内没落」= 判负**）；**`status` 变而日志无行 / 日志有行而 `status` 未变 ⇒ 判负** |
| **③ 业务读口取数** | **`assertCurrencyOperable`**（`backend-ts/src/ledger.ts:644-650`）+ **`assertCurrencyTransition`**（`:630`）+ **market 侧读 `currency.status`**（`migrations/0016_market.sql:951` / `:977`）；**DB 直取** = `SELECT status FROM currency WHERE cid = …` | **业务读口取到的仍是旧值 ⇒ 判负**（**「库内有新值但业务不读」= 判负**；后台读口 ≠ 业务读口） |
| **④ 行为随之** | **同一个可直接观察的业务量** —— 未审核（`draft`）单位**不可上市**（C2 的 `stateConflict('currency.status','CURRENCY_STATE_INVALID', …)` @ `currency-service.ts:454`）+ **不可挂单 / 标价 / 计酬**（`R28` ⇒ `LEDGER_CURRENCY_NOT_LISTED`）；**审核通过后**上述动作**放行** —— **改动前 / 改动后两读数** | **改动后该业务量不变 ⇒ 判负**；**只给改动后单读数 ⇒ 判负**；**「审核通过」后单位仍不可上市 / 「未审核」单位仍可上市 ⇒ 判负** |

**（a）总判据（写死 · 机读形态）**：**① 四段齐全**（缺任一段 ⇒ 判负）；**② ②段必须给表名 + 列名**（不得只写「已保存」）；**③ ③段必须给业务侧取数的 `文件:行` 锚**；**④ ④段必须给「改动前 / 改动后」两读数且为同一业务量**；**⑤ 每段各带判负形态**；**⑥ 负对照（门自证）**：把任一段读数改成常量 ⇒ 该门**必须转红**（**不转红 = 假门**）。

**（b）执行面（`R-8-6` · 逐字）**：**行为验收只许 DB 直造 + 读库**（造 `currency` 行 / 读 `ledger_entry` 与 `currency_status_log`）；**不得**为验收新增路由、**不得**以 `GET /api/admin/currency` 承载验收读数。**★ 本单不实跑**（零库连接）⇒ 判据**已写死、未实跑**（登记 §22.7）。

### 22.5 后台页数据契约与四语文案面（**本册只给契约与命名空间 · 不写实现**）

**（a）页面定位**：新增管理后台页（命名依实现单；现取 `frontend/src/pages/admin/**` = **9 页**：`FeeRatePage` / `PermissionsManagement` / `PointsManagement` / `ReferralWeightMatrixPage` / `RewardsManagement` / `ShardsManagement` / `SystemSettings` / `TasksManagement` / `UsersManagement` —— **无审核页**）。

**（b）页面数据契约（字段 → 来源）**：

| 字段（页面用） | 来源（**唯一 = §22.2(a) 读口**） | 说明 |
|---|---|---|
| `cid` / `symbol` / `name` | 读口 `data` 同键 | 单位标识（`symbol` 唯一，`0001:28`） |
| `status` | 读口 `data.status` | **四值之一**（`draft` / `listed` / `frozen` / `delisted`）；**展示映射在展示层，不改数值语义** |
| `owner_uid` | 读口 `data.owner_uid` | 创建者（自建单位 = `owner_uid > 0`，`ledger.spec R3`） |
| `time_created` / `listed_at` | 读口同名键 | 审计面展示（**只读**） |
| `deposit_amount` / `deposit_cid` | 读口同名键（**可选**） | 上市保证金口径（`0001:23-24`；**只读**） |
| 审核决定 | **动作口**（依变体 `§22.2(a2)`，**字段名待实现单**） | **★ 本册不发明决定字段名** |

**（c）★ 四语文案面（写死 · 禁工程口径泄漏）**：
- **语言面（现取）= 四语** `frontend/src/locales/{zh,en,hk,vn}.json`（**顶层键数现取 = 105**，以 `zh.json` 计；**与 §19.5 记的 103 差 +2 ⇒ 漂移登记**）。
- **命名空间约定（写死 · 不得自拟新风格）**：承既有 **`admin*` 前缀先例** ⇒ **本片新增命名空间 = `adminCurrencyReview`**（词根 = 既有域词 `currency`）；**四语必须逐键齐**（缺任一语 ⇒ 判负）；**★ 键名 = 待实现单按本条约定落**（本单只给约定 + 命名空间，**不发明键名清单**）。
- **★ 禁工程口径泄漏六类（写死 · 可判负）**：**用户可见文案**（`t(...)` 的**值**面）**不得**出现：① 本册 / 姊妹册**章节号 / 条号**；② **HTTP 状态码**；③ **接口路径 / 方法**；④ **内部批次名 / 单号**；⑤ **机读码 / 裸 i18n 键**；⑥ **表名 / 列名 / 函数名**（逐字表体 = 姊妹册 `data-layer.spec` v0.14 §25.5(c)）。
  - **判负形态（写死）**：对四语 locale 的 `adminCurrencyReview*` 键值做**正则扫描**（命中六类任一模 = **判负**）；**负对照** = 人为把一条文案改成 `"审核（§22.2）"` ⇒ **扫描必须转红**（**不转红 = 假门**）。
  - **★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写四语文案内容**；**★ 工程口径可现于 `message` 日志面**（承 §3.3 条款 9′ / §15.5）。

**（d）页面 → 权限 → 路由（写死 · 与 §22.3(b) 一致）**：审核页 = `requiredPermission="review_tasks"`（+ 面板入口 `dashboard_access`）；**先例逐字** = `frontend/src/App.jsx:243`（`<Route path="settings" element={<ProtectedRoute adminOnly=… requiredPermission="manage_settings">…)} />`）。**★ 前端路由行号 = 待实现单现取**（本单零代码）。

### 22.6 本单待办登记（**交「接该面的实现单」，本册不实现**）

| # | 待办 | 归属 |
|--:|---|---|
| **I-1** | **审核闸三变体选型**（姊妹册 §25.3 的 Ⅰ / Ⅱ / Ⅲ） | **Zang**（`p8-p6-recon.md:93` 逐字「须 Zang 裁定，不得自选」） |
| **I-2** | **动作口是否存在 / 路径名 / 决定字段名**（依变体） | Zang（选型后 ⇒ 实现单） |
| **I-3** | **新增状态值名 / 新表名 / 新列名**（变体 Ⅰ/Ⅱ 若入选） | Zang + 新迁移（**需授权 apply**） |
| **I-4** | **`GET /api/admin/currency` 读口实现**（注册点 69 → 70）+ 后台页 + 四语文案 | 实现单 |
| **I-5** | **判负门落地**（§22.2(b) 两路径判负 + §22.2(c) 六条入参 + §22.5(c) 六类泄漏正则 + 负对照） | 实现单 / 质检单 |
| **I-6** | **`currency_status_log` 「零写入」冲突收口**（`p8-p6-recon.md` / `master-plan` 旧句 vs 现取 2 命中） | **Zang**（本单只登记，未改他人行） |

### 22.7 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **读口 / 动作口 HTTP 实跑两态** | **未实现**（本单为规范单、零代码 / 零库 / 零 HTTP）⇒ 判据**已写死、未实跑** |
| 2 | **四段判据的判负实跑** | 同上（归实现单 + 质检单） |
| 3 | **注册点增量 70 / 71 的实际落盘** | **未实现** ⇒ 无读数（**不得**填「已 70」；本单只冻结应然值） |
| 4 | **`currency_status_log` 现库行数 / `currency` 各 `status` 分布** | **零库连接**（红线）⇒ 无读数 |
| 5 | **变体选型（Ⅰ/Ⅱ/Ⅲ）** | **待 Zang** |
| 6 | **动作口路径 / 决定字段名** | **待 Zang / 实现单定**（**本册不发明**） |
| 7 | **审核页字段级实现面** | **页面尚未存在**（现取 `frontend/src/pages/admin/**` = 9 页，无审核页） |

### 22.8 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **§4.2 C1 / C2 行** | **承**：C1 / C2 现状逐字引（(a)(b)）；**该两行行体一字未动** |
| **§1.8「已实现·未注册清单」** | **承**：本单新增读口属「功能需求」⇒ 须注册（§22.2(e)）；`R-8-6` 双向判负 |
| **§4.5 幂等键总表** | **承**：读口无 `ops:` 键；动作口（若存在）幂等键 = **待实现单 / Zang 定** |
| **§7-17（币种状态闸落点 · 待 Zang）** | **读法更新**：本单把审核闸的**状态 / 载体 / 留痕**面交姊妹册 §25；**`§7-17` 行体一字未动** |
| **§19.4（真生效四段模板）** | **复用**：§22.4 逐字承该模板；`§19.4` 正文一字未动 |
| **§19.5(c)（禁工程口径泄漏六类）** | **复用**：§22.5(c) 逐类承；`§19.5` 正文一字未动 |
| **`data-layer.spec` v0.14 §25** | **同批姊妹册**：其 §25.1–§25.5 = 状态 / 载体 / 留痕 / 数据侧四段 / 命名空间正文；**本册只承载 route 侧** |
| **`ledger.spec` R10 / R27 / §3.2 / R28 / R29 / R30 / R31** | **只读引用**；本单未改其一字 |

## §23 ★★ v2.8 · 批 8 第 4 片（8④）**裁定落册**：取**变体 Ⅱ（旁路台账型）** —— 动作口 / 读口契约冻结 + 注册点 **69 → 70（读口）+ → 71（动作口）** 逐字登记 + 真生效四段判据（按 Ⅱ 细化）+ 权限键 `review_tasks` + 后台页数据契约（**v2.8 新增 · 本节只追加 · 依据 = Zang `§5.198` C 的裁定 `R-8-21`（`docs/seafood.master-plan.md:1430-1440`）+ 派单「8④ 裁定落册单」；状态 / 载体 / 留痕 / **迁移内容契约**正文 = 姊妹册 `data-layer.spec` v0.15 §26**）

> **★★ 本节硬约束（写死）**：**不得发明状态值 / 路径风格 / 权限键 / 决定字段名**；**新路由必须逐字登记注册点增量**；**权限键必须在既有 11 键内选**（`R-8-1`）；**`ops:` 幂等键形态沿既有 admin 先例（现取）**。

### 23.0 开工锚（现取 · 逐项）

| 项 | 现取读数 | 锚（本单现取时点） |
|---|---|---|
| 仓库 HEAD | `main`（`git status --porcelain docs/` = 仅 `?? docs/qa/p8-s3b-write-path-review.md`（**他人在读 · 本单未碰**）） | 本单 |
| 本册改前（v2.7） | **`wc -l` 5304（逻辑 5305）/ 1124763 B / md5 `70dfa43bacd96f0bc5f46e1372ef2b55`** | `wc` / `md5 -q docs/route-layer.spec.md` |
| 本册末行 | **不带换行符**（末字节 = `2d` = `-`）⇒ **一切追加插在末行 `---` 之前** | `tail -c 1 \| od` |
| **注册点现取** | **69**（`grep -cE '^app\.(get\|post\|put\|patch\|delete)\(' backend-ts/src/index.ts` = **69**） | `backend-ts/src/index.ts` |
| 姊妹册（data-layer） | **v0.15 · 1814 → N 行 / 429600 B → N B / md5 `6379d1dd…`**；末行**带换行符** | `wc` / `md5` |
| 旧快照（改前既存） | `docs/versions/route-layer.spec.v0.1…v2.7` = **27 件**（一字未动）；`docs/versions/data-layer.spec.v0.1…v0.14` = **14 件** | `ls docs/versions \| grep -c` |
| 库 / HTTP | **零库连接 / 零 HTTP / 零套件** | — |

### 23.1 ★ 裁定落位（`R-8-21` 取变体 Ⅱ ⇒ **动作口自此确定** · 收口 §22.2(a2)）

**★ 我（Zang）已在 `§5.198` 裁定 `R-8-21`：取变体 Ⅱ（旁路台账型）**。**四条理由逐字 = 姊妹册 `data-layer.spec` v0.15 §26.1**（**逐字引 · 本册不重抄**）：

| # | 理由（**要点 · 逐字见姊妹册 §26.1**） |
|--:|---|
| ① | **不动已 apply 的闭合集**（Ⅰ 要扩 `currency_status_enum`；Ⅱ 是**加法式新表**，沿用 `0023`/`0024` 先例） |
| ② | **Ⅲ 不可接受**（其「驳回」**无落点 ⇒ 拒绝不留痕**，与「拒绝必须留痕」纪律直接冲突） |
| ③ | **审批通过走既有边**（Ⅱ 下通过仍走**既有** `draft → listed`） |
| ④ | **顺带补留痕缺口**（审核动作落台账 + 状态迁移仍写 `currency_status_log`） |

**★ 代价（已登记 · 逐字）**：**需一条新迁移**（审核台账表 + 索引；**apply 由 Zang 执行**，参照 `0024` 流程）；**注册点 69 → 70（读口）+ → 71（动作口）**；前端后台页 1 个。

**（a）★ 对 §22.2(a2) 的收口（写死）**：`§22.2(a2)` 记「动作口 = **依变体**（姊妹册 §25.3）· **本单只登记候选、不自选**」（候选 = `POST /api/admin/currency/:cid/review`）。**本案（`R-8-21` = Ⅱ）⇒ 动作口存在、路径 = `POST /api/admin/currency/:cid/review`**，**注册点 = 69 → 71**（读口 +1、动作口 +1）。**`§22.2(a2)` 行体一字未动**（其「本单不择一」句为**冻结时点**的表述，**不是**第二现行版）。

**（b）★ 变体 Ⅱ 下不选的两支（写死 · 判负）**：
- **Ⅰ（状态机扩展型）**：**不采纳** ⇒ 若实现单扩 `currency_status_enum` / 新增 `currency.status` 值 ⇒ **判负**（违 `R-8-21` 理由①）；
- **Ⅲ（纯闸 · 复用上市边）**：**不采纳** ⇒ 若动作口「驳回」**无任何库内落值** ⇒ **判负**（违 `R-8-21` 理由②；② 段缺失）。

### 23.2 ★★ 读口契约 `GET /api/admin/currency`（闸 `review_tasks` · data 键集 · R107 · **注册点 69 → 70**）

> **本单 = 定案**（承 `§22.2(a)` 逐字；`§22.2(a)` 的「冻结新增」自此为**裁定确认**，不再待裁）。**`§22.2(a)` 行体一字未动**。

| 项 | 冻结值（本单钉死） | 依据 / 先例（现取） |
|---|---|---|
| 路径 / 方法 | **`GET /api/admin/currency`** | **★ 非发明**：admin 命名空间 + 既有资源名词 `currency`（`index.ts:1685` 逐字）；同族先例 = `GET /api/admin/commission_policy`（`index.ts:2083`）/ `GET /api/admin/settings`（`:1134`） |
| 闸 | **`requireAdmin(req, res, 'review_tasks')`**（`R-8-8` 临时复用 · 11 键内） | `index.ts:307`（`requireAdmin` 现取）；§22.3 / §23.6 |
| **注册点** | **69 → 70**（**逐字登记**；现取 = `grep -cE` ⇒ **69** ⇒ 本读口落地后 = **70**） | §23.0 / §23.4 |
| 响应形状（**R107 口径**） | **成功** = `{success:true, message, data:{…}}`（`sendSuccess`）；**失败** = **R107** `{error:{code, message, i18n_key, details}}` | `sendSuccess` = `index.ts:108-122`（现取）；§3.3 条款 9′ / §15.5 / §15.6 |
| `data` 形状（**键集自本单起冻结**） | **单位行数组**，逐键 = 现取 `currency` 列：`cid` / `symbol` / `name` / `status` / `owner_uid` / `time_created` / `listed_at`（**可选**：`deposit_amount` / `deposit_cid` —— 依实现单）；**★ 键集自本单起冻结、不得增删** | `0001_ledger_core.sql:13-38`（`currency` 列现取） |
| `status` 过滤（**可选**） | **允许**（`?status=<四值之一>`）；**非法值 ⇒ `400`**（**不得静默回落**，见 §23.3(c) 同口径） | §3.1（形状非法 = `400`） |
| 幂等键 | **无**（读口无副作用 ⇒ 不需 `ops:` 键；先例 = `GET /api/admin/commission_policy` 亦无） | §19.2(b) |
| 只读纪律 | **只 `SELECT`**；**不得**借读口补写 / 回填 / 修正 `currency` 或 `currency_status_log` 或台账表 | `DL23` 同向 |
| 迁移面 | **零迁移 / 零 DDL**（`currency` 表在既有迁移 `0001` 内） | `0001:13-38` |

### 23.3 ★★ 动作口契约 `POST /api/admin/currency/:cid/review`（**通过 / 驳回 双路径** · 依变体 Ⅱ）

**（a）线格式（写死）**：

| 项 | 冻结值 | 依据 / 先例（现取） |
|---|---|---|
| 路径 / 方法 | **`POST /api/admin/currency/:cid/review`** | 承 `§22.2(a2)` 候选（**非发明**）；admin 命名空间 + 既有资源 `currency` |
| 闸 | **`requireAdmin(req, res, 'review_tasks')`** | §23.6；`R-8-8` |
| 请求体（冻结） | **`{ "action": "approve" \| "reject", "reason": <string> }`** —— `action` **必填 / 闭集恰 2 值**；`reason` **必填 / 非空字符串**（**驳回必须给 reason**） | 派单 ③（`action ∈ {approve, reject}` + `reason`）；**字段名 = 派单给定**（非本单发明） |
| **`ops:` 幂等键** | **规范形 `ops:<admin_uid>:currency_review:<cid>`** | **沿既有 admin 先例（现取）**：`DL36` 规范形 `ops:<admin_uid>:<action>:<business_id>`（`data-layer.spec.md:334`）；**同资源先例** = `ops:<admin_uid>:currency_status:<cid>:<to_status>`（`data-layer.spec.md:595`）⇒ action 词 `currency_review` = `<资源 currency>_<动作 review>`（**按先例派生 · 非自由发明**）；前缀闭集 `^(biz\|cm\|cli\|ops):`（`DL93`，`data-layer.spec.md:561`）；**★ 无键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（`DL36`）；**解析来源优先级 = `body.create_key` → `body.idempotency_key` → `Idempotency-Key` 头**（`admin-service.ts:47` 现取） |
| 幂等语义（照抄 `0023` 裁定四） | 同键同 `action` 重投 ⇒ `ON CONFLICT (idempotency_key, result) DO NOTHING`（**幂等重放**）；同键异 `action` ⇒ `result` 不同 ⇒ **允许**（先驳后成 / 先成后驳各留一行） | `0023:99` / `0024:72`；姊妹册 §26.7(c) |
| 事务（写死） | **台账行 + （通过时）`draft→listed` + `currency_status_log` 同一次 DB 调用（同一隐式事务）**；**全成或全回滚** | `DL157②`；`R-8-15`/`R-8-18` |
| 响应（R107） | **成功** = `{success:true, message, data:{…}}`；`data` 键集自本单起冻结 = 至少含 `cid` / `status`（决策后 `currency.status`）/ `result`（`approved`\|`rejected`）；**失败 = R107** `{error:{code, message, i18n_key, details}}` | `sendSuccess` = `index.ts:108-122`；§3.3 条款 9′ |
| 注册点 | **69 → 71**（读口 +1、动作口 +1） | §23.4 |
| 错误码 | **零新增码**（33 码闭集不动）；非法状态 ⇒ 借 `LD011`（`409`）；不存在 ⇒ 借 `LD007`（`404`） | `ledger.ts:1037`；姊妹册 §26.5 |

**（b）通过 / 驳回 两条路径各自的可判负形（写死 · 按变体 Ⅱ）**：

| 路径 | 正向（必给） | **判负形态（必带）** |
|---|---|---|
| **通过（`approve`）** | ① 动作口返回 200 + `data` 键集；② 库内落值 = **台账表 `currency_review_log` 恰 1 行**（`result='approved'` / `actor_uid` = admin / `cid` / `memo`=reason）+ **`currency.status` `draft → listed`** + **`currency_status_log` 恰 1 行**（`from_status='draft'` / `to_status='listed'` / `actor_uid` = admin）；③ 业务读口读新值；④ 行为 = 该单位**可上市 / 可挂单标价酬金** | **仅 `currency.status` 变而 `currency_status_log` 无新行 ⇒ 判负**；**仅日志有行而 `status` 未变 ⇒ 判负**；**「通过」返回 200 但库内三处（台账 / `status` / 日志）任一未变 ⇒ 判负**（「写成功但库值未变」）；**`actor_uid` 记成 owner 而非 admin ⇒ 判负** |
| **驳回（`reject`）** | ① 动作口返回 200 + `data` 键集；② 库内落值 = **台账表恰 1 行**（`result='rejected'` / `actor_uid` = admin / `memo`=reason）；**`currency.status` 仍 `draft`**、**不写 `currency_status_log`**；③ 业务读口仍拒（单位不可上市）；④ 行为 = 该单位**不可上市**（C2 拒） | **★ 驳回后 `currency_review_log` 无行 ⇒ 判负**（`R-8-21` 理由② · **驳回必须落台账**）；**驳回后仍可上市 ⇒ 判负**；**驳回后 `currency.status` 落入模糊态（既非 `draft` 亦非闭合集内值）⇒ 判负**；**驳回路径写 `currency_status_log`（无状态迁移却留状态日志）⇒ 判负** |

**（c）未知 / 非法入参不得静默（写死 · 可判负 · ≥6 条）**：

| # | 输入 | 期望 | 判负 |
|--:|---|---|---|
| 1 | `:cid` 非数字 | **`404` + `LD007 LEDGER_CURRENCY_NOT_FOUND`**（先例 = §3.1「非数字 `:jID` `400 → 404`」统一口径） | **静默按 0 处理 / 返回 200 ⇒ 判负** |
| 2 | `:cid` 不存在（`cid <= 0` 或该行不在） | **`404` + `LD007`**（依据 = `ledger.spec` §14.3 v0.5：`cid<=0` = 形状合法但不存在 ⇒ `404`） | **`400` / `500` ⇒ 判负** |
| 3 | `action` 缺失 / 非枚举（∉ `{approve,reject}`） | **`400` + 既有码 + `details.field`/`details.reason`**（R107 形状；**不得静默取默认决定**） | **缺字段被当「通过」/「驳回」⇒ 判负** |
| 4 | `reason` 缺失 / 空串（**尤其驳回**） | **`400`**（形状闸） | **驳回缺 `reason` 被静默放行 ⇒ 判负** |
| 5 | 无 token / 非 admin / 缺 `review_tasks` | **`401`（无 token）/ `403` + `reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`**（`AUTH_REASONS` 现取 = `['ACTOR_NOT_ALLOWED','NOT_ADMIN','PERMISSION_NOT_GRANTED']`） | **落到业务 200 / 500 ⇒ 判负** |
| 6 | 单位状态非 `draft`（如已 `listed`） | **借 `LD011 LEDGER_CURRENCY_INVALID_TRANSITION`（`409`）** | **对非 `draft` 单位静默通过 ⇒ 判负**；**新造码 ⇒ 判负**（33 码闭集） |
| 7 | 缺 `ops:` 幂等键 | **`400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（`DL36`） | **无键静默放行 ⇒ 判负** |
| 8 | 数据库基础设施错误（`code == null`） | **`503` + `driver_connection_error`**（D1′ 口径） | **吞成 `400` / 静默 ⇒ 判负** |

**（d）R107 形状（写死 · 逐字承 §3.3 条款 9′ / §15.5）**：`{error:{code, message, i18n_key, details}}` —— `code` = **机读唯一真源**；`i18n_key` = **本地化真源**（形如 `ledger.err.<CODE>`）；`message` = **人类可读稳定英文句（严禁填机读码）**。**同端点内 400 类只许一种形状**（R107）。**零新增错误码 / 零新增 `reason` 常量**（33 码闭集不动；`AUTH_REASONS` 三值不动）。

### 23.4 ★ 注册点 **69 → 70（读口）+ → 71（动作口）** 逐字登记（**写死 · 可判负**）

| # | 路由 | 闸 | 落地后注册点 | 判据 |
|--:|---|---|---|---|
| — | **（改前现取）** | — | **69** | `grep -cE '^app\.(get\|post\|put\|patch\|delete)\(' backend-ts/src/index.ts` = **69**（§23.0） |
| 1 | **`GET /api/admin/currency`**（读口 · §23.2） | `requireAdmin(req,res,'review_tasks')` | **70** | 读口注册后 `grep -cE` 必须 = **70** |
| 2 | **`POST /api/admin/currency/:cid/review`**（动作口 · §23.3） | `requireAdmin(req,res,'review_tasks')` | **71** | 读 + 动作两口注册后 `grep -cE` 必须 = **71** |

> **★ 注册点判据（写死）**：① **两条路由各注册一次**（不得合并 / 不得少注册）；② **两条均须 `requireAdmin` 前置**（缺闸 ⇒ 判负）；③ **`grep -cE '^app\.(get|post|put|patch|delete)\('` 的现取读数 = 冻结依据**（容忍前置空白口径 = `R-8-20`）；④ **本单只冻结应然值 70 / 71，不实改**（零代码）⇒ 实际落盘 = 实现单（`NOT_MEASURED`，§23.8）。

### 23.5 ★★ 「真生效」四段判据（**按变体 Ⅱ 细化** · 每段自带判负 · 不得只验「后台能存」）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**四段 = ① 后台审 → ② 库内落值（表 / 列）→ ③ 业务读口取数（`文件:行`）→ ④ 行为随之（改动前 / 改动后两读数）**；**每段必须能判负**。**★ 不得只验「后台能存」**（**「审核 `POST` 返回 `200`」= 零证据**）。**★ 本单不实跑**（零库连接）⇒ 判据**已写死、未实跑**（§23.8）。

| 段 | 读数内容（必给 · **按 Ⅱ**） | **判负形态（必带）** |
|--:|---|---|
| **① 后台审** | **动作口 `POST /api/admin/currency/:cid/review`** + 闸 `requireAdmin(req,res,'review_tasks')` + 请求体（逐字 `{action,reason}`）+ 响应（status + `data` 键集） | **缺闸 / 闸降级（非 `review_tasks`）⇒ 判负**；**响应 `data` 键集 ≠ 冻结键集 ⇒ 判负** |
| **② 库内落值** | **表 `public.currency_review_log`**（`cid` / `actor_uid` / `result` / `memo` / `time_created`；**审一次恰 1 行**）+ **表 `public.currency` 列 `status`**（**Ⅱ = 通过时 `draft→listed`；驳回时仍 `draft`**）+ **表 `public.currency_status_log`**（**仅通过时恰 1 行**：`from_status='draft'` / `to_status='listed'` / `actor_uid`=admin） | **★ 「审核动作成功而台账表无行 ⇒ 判负」**（正向）；**★ 反向：「台账表有行而审核动作未成功 / 无提交 ⇒ 判负」**；**通过时 `status` 变而 `currency_status_log` 无行 ⇒ 判负**；**驳回时写了 `currency_status_log` ⇒ 判负**；**表 / 列处该值未随之变 ⇒ 判负**（「后台能存但库内没落」） |
| **③ 业务读口取数** | **`assertCurrencyOperable`**（`backend-ts/src/ledger.ts:644-650`）+ **`assertCurrencyTransition`**（`:630`）+ **market 侧读 `currency.status`**（`migrations/0016_market.sql:951` / `:977`）；**DB 直取** = `SELECT status FROM currency WHERE cid = …` | **业务读口取到的仍是旧值 ⇒ 判负**（「库内有新值但业务不读」= 判负；后台读口 ≠ 业务读口） |
| **④ 行为随之** | **同一个可直接观察的业务量** —— 未审（`draft`）单位**不可上市**（C2 的 `stateConflict('currency.status','CURRENCY_STATE_INVALID', …)` @ `currency-service.ts:454`）+ **不可挂单 / 标价 / 计酬**（`R28` ⇒ `LD008 LEDGER_CURRENCY_NOT_LISTED`）；**审核通过后**上述动作**放行** —— **改动前 / 改动后两读数** | **改动后该业务量不变 ⇒ 判负**；**只给改动后单读数 ⇒ 判负**；**「审核通过」后单位仍不可上市 / 「未审核」单位仍可上市 ⇒ 判负** |

**（a）总判据（写死 · 机读形态）**：**① 四段齐全**（缺任一段 ⇒ 判负）；**② ②段必须给表名 + 列名**（不得只写「已保存」）；**③ ③段必须给业务侧取数的 `文件:行` 锚**；**④ ④段必须给「改动前 / 改动后」两读数且为同一业务量**；**⑤ 每段各带判负形态**；**⑥ 负对照（门自证）**：把任一段读数改成常量 ⇒ 该门**必须转红**（**不转红 = 假门**）。

**（b）执行面（写死 · 按 `R-8-15` / `R-8-18`）**：**凡涉状态改写的一切取证一律「事务内 + `ROLLBACK`」**（造 `currency` 行 / 写台账 / 读 `ledger_entry` / `currency_status_log` / 台账表，**取证后事务整体回滚**，**生产库零净写**）；**★ 真 HTTP 写面（真 POST 审核）** 若跑须**先证「恢复路径可逐字节复原」**，否则**禁跑真写**（`§5.197` 口径：`app_config` 时间戳漂移事故的教训）；**行为验收只许 DB 直造 + 读库**，**不得**为验收新增路由、**不得**以 `GET /api/admin/currency` 承载验收读数（`R-8-6` 双向判负）。

### 23.6 权限键 = `review_tasks`（**11 键零增删** · `R-8-1` / `R-8-8` 履约）

**（a）既有十一权限键（现取 · 三真源逐字 · 不增不减）**：真源 A = `backend-ts/src/database.ts:11-23` `ALL_ADMIN_PERMISSIONS`；真源 B = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`；真源 C = `frontend/src/admin-utils.js:40-52` ⇒ **恰 11 键**：`dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · **`review_tasks`**。**★ 闭集（写死）：恰好 11 键，不增不减**（承 `§22.3(a)`；**`§22.3` 行体一字未动**）。

**（b）8④「所需权限 → 既有键」映射表（写死）**：

| 口 | 所需权限（语义） | → **既有键（11 键内）** | 依据 |
|---|---|---|---|
| **读口** `GET /api/admin/currency` | 读待审 / 全部自建单位（只读） | **`review_tasks`** | `R-8-8` 逐字；§22.3 |
| **动作口** `POST /api/admin/currency/:cid/review` | 通过 / 驳回自建单位上市 | **`review_tasks`** | 同键（**读写同权**）；§23.3 |
| **后台页**（审核页） | 进面板 + 读 / 审 | **`review_tasks`** + **`dashboard_access`**（进面板） | `dashboard_access` = `ALL_ADMIN_PERMISSIONS` 首键 |

> **★ 零新增键（写死 · 判负）**：**本片两个口 + 一页全部落在既有 11 键内**；**不得新增权限键**（`R-8-1`）；新增键（如 `manage_currency`）⇒ **跨批**（`R-8-8` 逐字）⇒ **本片新造键 ⇒ 判负**。

**（c）`review_tasks` 现取消费面（5 处 · 逐字带锚）**：① `GET /api/tasklist/pending-verification/count` 闸 `index.ts:1442`；② `GET /api/tasklist/pending-verification` 闸 `:1457`；③ `POST /api/tasklist/:jID/verify` 闸 `:1473`；④ `POST /api/job/:jobId/review` 闸 `:1876`；⑤ `POST /api/job/:jobId/cancel` 闸 `:1900`。⇒ **全部 5 处皆「审核 / 裁决」面 ⇒ 语义与自建单位审核吻合**（临时复用成立 · 承 `§22.3(c)(d)`）。

### 23.7 后台页数据契约与四语文案面（**本册只给契约与命名空间 · 不写实现**）

**（a）页面定位**：新增管理后台页（命名依实现单；现取 `frontend/src/pages/admin/**` = **9 页** —— `FeeRatePage` / `PermissionsManagement` / `PointsManagement` / `ReferralWeightMatrixPage` / `RewardsManagement` / `ShardsManagement` / `SystemSettings` / `TasksManagement` / `UsersManagement` —— **无审核页**）。

**（b）页面数据契约（字段 → 来源）**：承 `§22.5(b)`（**`§22.5` 行体一字未动**）：`cid` / `symbol` / `name` / `status` / `owner_uid` / `time_created` / `listed_at`（+ 可选 `deposit_amount` / `deposit_cid`）**来源 = §23.2 读口 `data` 同键**；**审核决定**（`action` / `reason`）**来源 = §23.3 动作口**，**字段名 = 派单给定**（`action ∈ {approve,reject}` + `reason`），**本册不发明其余决定字段名**。

**（c）★ 命名空间约定（写死 · 不得自拟新风格）**：承既有 `admin*` 前缀先例（`admin_panel` / `adminNav` / `adminLayout` / `adminCommon` / `adminTasks` / `adminRewards` / `adminPermissions` / `adminPoints` / `adminShards` / `adminSettings` / `adminUsers` / `adminFeeRate` / `adminWeightMatrix`）⇒ **本片新增命名空间 = `adminCurrencyReview`**（词根 = 既有域词 `currency`）；**四语（`zh`/`en`/`hk`/`vn`）必须逐键齐**（缺任一语 ⇒ 判负）；**★ 键名 = 待实现单按本条约定落**（本单只给约定 + 命名空间，**不发明键名清单 / 不写四语文案值**）。

**（d）★ 禁工程口径泄漏六类（写死 · 可判负 · 逐字承 §22.5(c) / 姊妹册 §25.5(c)）**：**用户可见文案**（`t(...)` 的**值**面）**不得**出现：① 本册 / 姊妹册**章节号 / 条号**（例 `§23.3` / `R-8-21` / `DL157`）；② **HTTP 状态码**（`409` / `403` / `423`）；③ **接口路径 / 方法**（`/api/admin/currency` / `POST`）；④ **内部批次名 / 单号**（`8④` / `P6` / `JING-SPEC-B8-4R`）；⑤ **机读码 / 裸 i18n 键**（`LEDGER_CURRENCY_INVALID_TRANSITION` / `adminCurrencyReview.title`）；⑥ **表名 / 列名 / 函数名**（`currency` / `currency_review_log` / `assertCurrencyTransition`）。
- **判负形态（写死）**：对四语 locale 的 `adminCurrencyReview*` 键值做**正则扫描**（命中六类任一模 = **判负**）；**负对照** = 人为把一条文案改成 `"审核（§23.3）"` ⇒ **扫描必须转红**（**不转红 = 假门**）。
- **★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写四语文案内容**；**★ 工程口径可现于 `message` 日志面**（承 §3.3 条款 9′ / §15.5）。

**（e）页面 → 权限 → 路由（写死 · 与 §23.6 一致）**：审核页 = `requiredPermission="review_tasks"`（+ 面板入口 `dashboard_access`）；**先例逐字** = `frontend/src/App.jsx:243`。**★ 前端路由行号 = 待实现单现取**（本单零代码）。

### 23.8 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **读口 / 动作口 HTTP 实跑两态** | **未实现**（本单为规范单、零代码 / 零库 / 零 HTTP）⇒ 判据**已写死、未实跑** |
| 2 | **四段判据的判负实跑** | 同上（归实现单 + 质检单） |
| 3 | **注册点增量 70 / 71 的实际落盘** | **未实现** ⇒ 无读数（**不得**填「已 71」；本单只冻结应然值） |
| 4 | **`currency_review_log` 的 apply 落盘 / 现库结构** | **未实现**（**零迁移 · 零 DDL · 零 apply**；本册只冻内容 = 姊妹册 §26.7） |
| 5 | **`currency_status_log` 现库行数 / `currency` 各 `status` 分布** | **零库连接**（红线）⇒ 无读数 |
| 6 | **`request_fingerprint` 的具体派生式 / 下一步可用迁移编号** | **待实现单现取**（本册**不发明拼接式 / 不发明文件编号**） |
| 7 | **审核页字段级实现面 / 四语键名清单** | **页面尚未存在**（现取 `frontend/src/pages/admin/**` = 9 页，无审核页） |

### 23.9 交付声明 / 只追加自证 / 行号漂移表 / 纪律自检（**v2.8 新增 · 本节只追加**）

**23.9.1 声明（写盘范围 · 逐条）**：本单**只写 6 个文件** —— `docs/route-layer.spec.md`（**就地升 v2.8** = 顶部状态块区**新增 v2.8 块〔3 行，插在 v2.7 块之后、`v1.1 一页纸` 锚行之前〕** + **§23〔新〕**）+ `docs/versions/route-layer.spec.v2.8.md`（**新建** · `cmp` = 0）+ `docs/audit/route-layer-v2.8-delta.md`（**新建**）+ **同批姊妹册** `docs/data-layer.spec.md`（**就地升 v0.15** = 顶部状态块**新增 1 行** + **§26〔新〕**）+ `docs/versions/data-layer.spec.v0.15.md`（**新建** · `cmp` = 0）+ `docs/audit/data-layer-v0.15-delta.md`（**新建**）。**未碰**：`backend-ts/**` / `frontend/**` / **`migrations/**`（不得新建迁移文件 · 不得 apply）** / `docs/seafood.master-plan.md` / `docs/qa/**`（**本刻有质检单在读 · 未触碰**）/ `docs/audit/**` 既有件 / `docs/design/**` / 其它 spec。**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**启停 5787 / 5788。

**23.9.2 ★ 行数口径（承 §21.0 末行 · 写死）**：本册 **`wc -l` = 换行符数**（末行 `---` **不带换行**）⇒ **逻辑行 = `wc -l` + 1**；**凡报行数必须注明用的是哪一种**。**★ 追加手法（写死）**：本册末行无换行符 ⇒ **一切追加一律插在末行 `---` 之前**（否则该行由「无换行」改写为「带换行」⇒ `git diff --numstat` 必记 **1 个删除行**，违「删除列 = 0」硬口径）。姊妹册（data-layer）末行**带换行符** ⇒ **直接追加于末行之后**（0 删除行）。

**23.9.3 行号漂移（诚实登记 · 可复算）**：本版共 **两处新增**（均在既有行**之间 / 之末**插入、零删除）：**(i)** 状态块 **+3 行**（在 `§0` 之前）⇒ 影响 `§0` 之后一切；**(ii)** §23 本节 **+N 行**（在末行 `---` 之前）⇒ **末行 `---` 行号整体后移 N**；**册内既有引用行锚（如 §22.x）一律以「基线 `:N` ⇒ 本版现取 `:N+k`」两件引**（`R-8-14` 口径）。

**23.9.4 纪律自检（逐条对照硬口径与派单纪律）**：① **只追加 / 删除列 = 0** ✅（见 delta §D0）｜② **`difflib` 独立复核 0 replace / 0 delete** ✅｜③ **快照 `cmp` = 0** ✅｜④ **旧快照零改动** ✅（route `v0.1`–`v2.7` **二十七个** + data-layer `v0.1`–`v0.14` **十四个**，一字未动；本单**新建** = `v2.8.md` + `data-layer.spec.v0.15.md`）｜⑤ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑥ **未发明项** ✅（**表名 / 列名 / 类型 / 约束 / 索引逐项溯源自 `0023`/`0024`/`0017`**；**数值 / 日期 / 迁移文件编号 / 文案值**一律未发明，标「待实现单 / `NOT_MEASURED`」）｜⑦ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`·`killall` / 未启停 5787-5788** ✅｜⑧ **未测项 = `NOT_MEASURED` + 原因** ✅（§23.8；无 0 / 无空 / 无占位）｜⑨ **不确定处不二选一** ✅（**变体已由 `R-8-21` 定 = Ⅱ**，本册只落位、未自行二选一）｜⑩ **报数带口径** ✅（行数双口径 + 字节 + md5 + `numstat`）｜⑪ **引用纪律** ✅（本节全部引用**现取且逐字**；代码锚注明「本单现取时点」）。

### 23.10 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§22`（8④ 冻结 · 三变体未择一）** | **★ 读法更新 = 由 `R-8-21` 定案取 Ⅱ**（本案）：`§22.2(a2)` 的「动作口依变体 · 只登记候选」**收口**（§23.1）；`§22.2(a)` 读口「冻结新增」**确认为裁定**（§23.2）；**`§22` 各行行体一字未动** |
| **`§22.2(a2)`（动作口候选）** | **★ 兑现**：候选路径 `POST /api/admin/currency/:cid/review` **成裁定**（注册点 69 → 71）；**其行体一字未动** |
| **`§22.3`（权限键映射）** | **承**：`review_tasks` 复用 · 11 键零增删；**`§22.3` 行体一字未动** |
| **`§22.4`（真生效四段模板）** | **★ 按 Ⅱ 细化**：② 段 = 台账行 + `currency.status` + `currency_status_log`（通过时）；**`§22.4` 行体一字未动** |
| **`§22.5`（后台页 + 六类禁项）** | **承**：`adminCurrencyReview` + 六类；**`§22.5` 行体一字未动** |
| **`§22.6`（待办 I-1…I-6）** | **★ 兑现**：`I-1`（选型）/ `I-2`（动作口路径）/ `I-3`（表名）由 `R-8-21` + 姊妹册 §26 收口；`I-4`（读口）/ `I-5`（判负门）归实现单；**`§22.6` 行体一字未动** |
| **`§4.2 C1 / C2 行** | **承**：C1 落 `draft` / C2 由 owner 触发 `draft→listed`（同事务写日志）；**该两行行体一字未动** |
| **`§1.8`（已实现·未注册清单）/ `R-8-6`** | **承**：读口 + 动作口属「功能需求」⇒ 须注册；行为验收**只许 DB 直造 + 读库** |
| **`§4.5` 幂等键总表 / `DL36` / `DL93`** | **承**：动作口 `ops:` 键 = `ops:<admin_uid>:currency_review:<cid>`（沿先例）；读口无键；**行体一字未动** |
| **`§19.4` / `§19.5(c)`** | **复用**：§23.5 承四段模板 / §23.7 承六类禁项；**两节正文一字未动** |
| **`data-layer.spec` v0.15 §26** | **同批姊妹册**：其 §26.1–§26.8 = **`R-8-21` 逐字 + 状态机 / 载体 / 留痕 / 迁移内容契约**正文；**本册只承载 route 侧** |
| **`ledger.spec` `R10` / `R27` / `§3.2` / `R28` / `R29` / `R30` / `R31` / `R3`** | **只读引用**；本单未改其一字 |

## §24 ★★ v2.9 · 批 8 第 5 片（8⑤）契约冻结：**合规审核（商品 / 招工）** —— 两路径读写口契约 + 注册点登记 + 权限键（`review_tasks`）+ 真生效四段判据 + 审计面并联对账 + 后台页数据契约与四语文案面（**v2.9 新增 · 本节只追加 · 依据 = 批 8 第 5 片（8⑤）派单 + 已裁 `R-8-1` / `R-8-3` / `R-8-8` / `R-8-15` / `R-8-18`；状态 / 载体 / 留痕 / 三查正文 = 姊妹册 `data-layer.spec` v0.16 §27**）

> **★ 本节硬约束（写死）**：**不得发明状态值 / 路径风格 / 权限键 / 决定字段名**；**新路由必须逐字登记注册点增量**；**权限键必须在既有 11 键内选**（`R-8-1`）；**变体不择一**（选型 = Zang）；**`ops:` 幂等键形态沿既有 admin 先例（现取）**。

### 24.0 开工锚（现取 · 逐项）

| 项 | 现取读数 | 锚（本单现取时点） |
|---|---|---|
| 仓库 HEAD | `main`（`git status --porcelain docs/` = 仅 ` M docs/audit/p8-s4-currency-review.md`（**8④ 微修单在写 · 本单未碰**）） | 本单 |
| 本册改前（v2.8） | **`wc -l` 5490（逻辑 5491）/ 1156810 B / md5 `76309806805a4b1128b36f79c53d15e7`** | `wc` / `md5 -q docs/route-layer.spec.md` |
| 本册末行 | **不带换行符**（末字节 = `2d` = `-`）⇒ **一切追加插在末行 `---` 之前** | `tail -c 1 \\| od` |
| **注册点现取** | **71**（`grep -cE '^app\\.(get\\|post\\|put\\|patch\\|delete)\\(' backend-ts/src/index.ts` = **71**；容前置空白口径亦 = **71**） | `backend-ts/src/index.ts`（2243 行） |
| 姊妹册（data-layer） | **v0.15 · 2025 行 / 457083 B / md5 `3e954622…`**；末行**带换行符** | `wc` / `md5` |
| 旧快照（改前既存） | `docs/versions/route-layer.spec.v0.1…v2.8` = **28 件**（一字未动）；`docs/versions/data-layer.spec.v0.1…v0.15` = **15 件** | `ls docs/versions \\| grep -c` |
| 库 / HTTP | **零库连接 / 零 HTTP / 零套件** | — |

### 24.1 现取盘点（商品面 / 招工面 · 逐字带锚）

> **两条「待定义」路径的逐字原文 = 姊妹册 `data-layer.spec` v0.16 §27.1**（**本册不重抄**；要点：路径 A `takedown` 在 `data-layer` 逐字「待定义」；路径 B `arbitration/*` 三册仅族名）。

**（a）商品面（现取 · 4 条既有路由）**：

| 路由 | 闸 | 服务层 | 锚 |
|---|---|---|---|
| `POST /api/listing`（发布 → `draft`） | `requireActor` | `createListing`（`listing-service.ts:164`） | `index.ts:1926` |
| `POST /api/listing/:listingId`（编辑） | `requireActor` | `updateListing`（`:222`） | `index.ts:1953` |
| `PATCH /api/listing/:listingId`（状态迁移） | `requireActor` | `transitionListingStatus`（`:286`；非卖家 ⇒ `403 ACTOR_NOT_ALLOWED` `:302`；非法组合 ⇒ `409 LISTING_STATE_INVALID` `:305`） | `index.ts:1981` |
| `POST /api/listing/:listingId/buy`（购买） | `requireActor` | `buyListing`（`listing-funds-service.ts:191`） | `index.ts:2006` |

**（b）招工面（现取 · 6 条既有路由）**：

| 路由 | 闸 | 服务层 | 锚 |
|---|---|---|---|
| `POST /api/job`（发布 → `open`） | `requireActor` | `publishJob`（`job-funds-service.ts:149`） | `index.ts:1780` |
| `POST /api/job/:jobId/apply` | `requireActor` | `applyToJob`（`job-service.ts:175`） | `index.ts:1809` |
| `POST /api/job/:jobId/accept` | `requireActor` | `acceptApplication`（`:208`） | `index.ts:1831` |
| `POST /api/job/:jobId/submit` | `requireActor` | `submitWork` | `index.ts:1856` |
| `POST /api/job/:jobId/review` | **`requireAdmin(req,res,'review_tasks')`** | `settleJob` / `refundJob`（`job-funds-service.ts:218`/`:237`） | `index.ts:1884`（闸 `:1885`） |
| `POST /api/job/:jobId/cancel`（退托管） | **`requireAdmin(req,res,'review_tasks')`** | `refundJob`（`to_status='cancelled'`） | `index.ts:1908`（闸 `:1909`） |

**（c）★ 现状结论与现取冲突登记（诚实登记 · 不改他人行）**：
1. **两路径现取均无 admin 合规审核入口** —— 无 `takedown` 路由、无 `arbitration` 路由（`grep -rn 'takedown\|arbitration' backend-ts/src/ frontend/src/` 现取 = **0 命中**）⇒ **两路径 = 全新面**（新路径 + 新注册点 + 新读口）。
2. **★ 现取冲突（招工审核方）**：`data-layer §5-C7`（`:356`/`:813`）/ `DL106` 裁「**招工审核方 = 雇主，管理员不审**」；而现取 `POST /api/job/:jobId/review`（`:1884`）与 `POST /api/job/:jobId/cancel`（`:1908`）**闸皆为 `requireAdmin(...,'review_tasks')`** ⇒ **「雇主审」这一口径在现取代码面 = 未兑现**（该两路由为**管理员**面）。**本册如实登记该差异，不改一行**（处置 = 姊妹册 §27.10 / 本节 §24.9 待办 `I-3`）。

### 24.2 ★★ 两路径读写口契约

> **共同口径**：**成功** = `{success:true, message, data:{…}}`（`sendSuccess` = `index.ts:108-122`）；**失败** = **R107** `{error:{code, message, i18n_key, details}}`（§3.3 条款 9′ / §15.5 / §15.6）。**读口无 `ops:` 键**（无副作用；先例 = `GET /api/admin/currency` 亦无）；**动作口必带 `ops:` 键**（`DL36`；缺 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）。

**（a）路径 A · 商品合规（`takedown`）**：

| 口 | 路径 / 方法（**★ 非发明**） | 闸 | 依据 / 先例（现取） |
|---|---|---|---|
| **读口** | **`GET /api/admin/listing`** | `requireAdmin(req,res,'review_tasks')` | **★ 非发明**：admin 命名空间 + 既有资源名词 `listing`；同族先例 = `GET /api/admin/currency`（`index.ts:2114`）/ `GET /api/admin/settings`（`:1133`） |
| **动作口** | **`POST /api/admin/listing/:listingId/takedown`** | `requireAdmin(req,res,'review_tasks')` | **★ 逐字源自 `data-layer §4.1 #47`**（`data-layer.spec.md:294`：`/api/admin/listing/:id/takedown`）；★ 参数名取**既有路由风格 `:listingId`**（现取 `PATCH /api/listing/:listingId` `index.ts:1981`），**非发明** |
| 请求体（**字段名待实现单 / Zang 定，本册不发明**） | 候选 = 审核决定字段 + 原因字段（**★ 待定**） | — | 依变体（姊妹册 §27.4）；**决定字段名 = 派单候选，不构成裁定** |
| `ops:` 幂等键 | **规范形 `ops:<admin_uid>:listing_takedown:<listingId>`** | — | **沿既有 admin 先例（现取）**：`DL36` 规范形 `ops:<admin_uid>:<action>:<business_id>`（`data-layer.spec.md:334`）；**同资源先例** `ops:<admin_uid>:currency_status:<cid>:<to_status>`（`data-layer.spec.md:509`）⇒ 动作词 = `<资源 listing>_<动作 takedown>`（**按先例派生**） |
| 响应 `data` 键集（**自本单起冻结**） | 成功 = 至少含 `listing_id` / `status`（决策后 `listing.status`）/ `result` | — | 先例 = 8④ §23.3 `data` = `{cid, status, result}` |
| 迁移面 | **零迁移 / 零 DDL**（`listing` 表在既有 `0015` 内） | — | `0015:113-137` |

**（b）路径 B · 招工合规仲裁（`arbitration`）**：

| 口 | 路径 / 方法（**★ 族名逐字；子路径 = 候选人，待 Zang**） | 闸 | 依据 / 先例（现取） |
|---|---|---|---|
| **读口** | **`GET /api/admin/arbitration`**（**候选**） | `requireAdmin(req,res,'review_tasks')` | **★ 族名逐字**：`data-layer §4.1 #52`（`:299`）/ `§5-C7`（`:356`）/ `route §7-6`（`:1689`）皆写 `/api/admin/arbitration/*`；**子路径（读口无子段 / 动作口 `:jobId`）= 候选人**（承族名 + 既有参数风格 `:jobId`），**待 Zang / 实现单定** |
| **动作口** | **`POST /api/admin/arbitration/:jobId`**（**候选**） | `requireAdmin(req,res,'review_tasks')` | **★ 非发明**：admin 命名空间 + 族名 `arbitration` + 既有参数名 `:jobId`（现取 `POST /api/job/:jobId/*`） |
| **★ 替代（复用既有边 · 变体依）** | **`POST /api/job/:jobId/cancel`（现取 `index.ts:1908`，闸已 = `review_tasks`）** | 既有 | 若选**变体 Ⅲ**（姊妹册 §27.4(c)）⇒ 招工动作口可**复用既有退单路由**（`refundJob` `to_status='cancelled'`），**注册点增量 = +0** |
| `ops:` 幂等键 | **规范形 `ops:<admin_uid>:job_arbitrate:<job_id>`** —— **★ 既有逐字（非发明）** | — | **逐字源自 `data-layer §7.1 ①招工 仲裁强制退单`（`data-layer.spec.md:509`）**：键 = `ops:<admin_uid>:job_arbitrate:<job_id>`；账务 = `job_escrow_refund` ×2 |
| 响应 `data` 键集（**自本单起冻结**） | 成功 = 至少含 `job_id` / `status`（决策后 `job.status`）/ `result` | — | 先例 = 8④ §23.3 |
| 迁移面 | **零迁移 / 零 DDL**（`job` 表在既有 `0013` 内） | — | `0013:79-100` |

**（c）★ 为何新增读口属「功能需求」而非「为验收凑数」（双向判负 · 逐字承 `R-8-6`）**：后台合规页**必须**有读口才能展示待审 / 违规队列 ⇒ **功能需求，允许新增、须冻结并登记注册点**；而**行为验收**（§24.6 的 ④ 段读数）**只许 DB 直造 + 读库，不得依赖读口**。**(i)** 若把验收读数写成依赖读口 ⇒ **判负**；**(ii)** 若以「验收不得新增路由」为由拒绝实现读口 ⇒ **混同二者 ⇒ 判负**。

### 24.3 通过 / 驳回 两条路径各自的可判负形 + 非法入参（≥6 条）

**（a）两路径 通过 / 驳回 判负（写死 · **★ 驳回必须留痕、不得静默**）**：

| 路径 | 通过（正向必给） | **判负形态（必带）** | 驳回（正向必给） | **判负形态（必带）** |
|---|---|---|---|---|
| **A 商品 `takedown`** | ① 动作口 200 + `data` 键集；② 库内落值 = `listing.status` 迁移（依变体：Ⅰ/Ⅲ = `listed→frozen` 或 `listed→delisted`；Ⅱ = 不动作 + 新表行）+ **留痕**（新表恰 1 行 / 或既有边）；③ 业务读口读新值；④ 行为 = 该商品**不可购买** | **仅 `listing.status` 变而留痕无行 ⇒ 判负**；**留痕有行而 `status` 未变 ⇒ 判负**；**动作口 200 但库内未变 ⇒ 判负**；`actor` 记成 seller ⇒ **判负** | 依变体：Ⅰ = 状态回退（`frozen→listed`）；Ⅱ = 新表落「驳回」行；**Ⅲ = 无落值 ⇒ 本路径判负** | **★ 驳回后留痕无行 ⇒ 判负**（`R-8-8` 家族：拒绝必须留痕）；**驳回后商品仍可购买（若变体 Ⅱ 未前置闸）⇒ 判负**；**变体 Ⅲ 驳回无落值 ⇒ 判负** |
| **B 招工 `arbitration`** | ① 动作口 200；② 库内落值 = `job.status` 迁移（`submitted→disputed→settled/cancelled`）+ 留痕 + **资金腿** `job_escrow_refund` ×2（`txid`）；③ 业务读口读新值；④ 行为 = 争议单**不可再承接 / 已结算** | **状态变而留痕无行 ⇒ 判负**；**有资金腿而 ledger 无对应 `job_escrow_refund` 分录 ⇒ 判负**；**动作口 200 但库内未变 ⇒ 判负** | 依变体：Ⅰ/Ⅱ = 结论落 `cancelled`（退单）+ 留痕；Ⅲ = 复用既有 `cancel` 路由 | **★ 驳回后留痕无行 ⇒ 判负**；**退单无 `job_escrow_refund` 腿（托管未退）⇒ 判负** |

**（b）未知 / 非法入参不得静默（写死 · 可判负 · ≥6 条）**：

| # | 输入 | 期望 | 判负 |
|--:|---|---|---|
| 1 | `:listingId` / `:jobId` 非数字 | **`404` + 既有 detail-miss 形状**（先例 = §3.1「非数字 `:jID` `400 → 404`」统一口径；现取 `index.ts:1814`/`:1889`） | **静默按 0 处理 / 返回 200 ⇒ 判负** |
| 2 | `:listingId` / `:jobId` 不存在（`<=0` 或该行不在） | **`404`** | **`400` / `500` ⇒ 判负** |
| 3 | 审核决定字段缺失 / 非枚举值 | **`400` + 既有码 + `details.field`/`details.reason`**（R107 形状；**不得静默取默认决定**） | **缺字段被当「通过」/「驳回」⇒ 判负** |
| 4 | 原因字段缺失 / 空串（**尤其驳回**） | **`400`**（形状闸） | **驳回缺原因被静默放行 ⇒ 判负** |
| 5 | 无 token / 非 admin / 缺 `review_tasks` | **`401`（无 token）/ `403` + `reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`**（`AUTH_REASONS` 现取） | **落到业务 200 / 500 ⇒ 判负** |
| 6 | 商品 / 招工状态非「可审」（如商品已 `delisted` 终态 / 招工非 `submitted`） | **借既码 `LD011 LEDGER_CURRENCY_INVALID_TRANSITION`（`409`）+ `reason = LISTING_STATE_INVALID`（`0015:202`）/ `JOB_STATE_INVALID`（`0013:126`）** | **对非可审态静默通过 ⇒ 判负**；**新造码 ⇒ 判负**（33 码闭集） |
| 7 | 缺 `ops:` 幂等键 | **`400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（`DL36`） | **无键静默放行 ⇒ 判负** |
| 8 | 数据库基础设施错误（`code == null`） | **`503` + `driver_connection_error`**（D1′ 口径） | **吞成 `400` / 静默 ⇒ 判负** |

**（c）R107 形状（写死 · 逐字承 §3.3 条款 9′ / §15.5）**：`{error:{code, message, i18n_key, details}}` —— `code` = **机读唯一真源**；`i18n_key` = **本地化真源**（形如 `ledger.err.<CODE>`）；`message` = **人类可读稳定英文句（严禁填机读码）**。**同端点内 400 类只许一种形状**（R107）。**零新增错误码 / 零新增 `reason` 常量**（33 码闭集不动；`AUTH_REASONS` 三值不动）。

### 24.4 ★ 注册点 **71 → N** 逐字登记（**写死 · 可判负**）

| # | 路由 | 闸 | 落地后注册点 | 判据 |
|--:|---|---|---|---|
| — | **（改前现取）** | — | **71** | `grep -cE '^app\\.(get\\|post\\|put\\|patch\\|delete)\\(' backend-ts/src/index.ts` = **71**（§24.0） |
| 1 | **`GET /api/admin/listing`**（商品读口 · §24.2(a)） | `review_tasks` | **72** | 读口注册后 `grep -cE` 必须 = **72** |
| 2 | **`POST /api/admin/listing/:listingId/takedown`**（商品动作口 · §24.2(a)） | `review_tasks` | **73** | 商品两口注册后 `grep -cE` 必须 = **73** |
| 3 | **`GET /api/admin/arbitration`**（招工读口 · §24.2(b)） | `review_tasks` | **74** | 招工读口注册后 `grep -cE` 必须 = **74** |
| 4 | **`POST /api/admin/arbitration/:jobId`**（招工动作口 · §24.2(b)） | `review_tasks` | **75** | 招工两口注册后 `grep -cE` 必须 = **75** |

> **★ 注册点判据（写死 · 依变体）**：① **本片对外路径应然集 = 4 条**（两读口 + 两动作口）⇒ **71 → 75**；② **依变体可减**：**若招工动作口复用既有 `POST /api/job/:jobId/cancel`（`:1908`）⇒ 71 → 74**；**若两读口合并为单口 `GET /api/admin/compliance` ⇒ 71 → 74/~73**（**★ 合并属设计选择，本单不择一**）；③ **两条动作口均须 `requireAdmin` 前置**（缺闸 ⇒ 判负）；④ **`grep -cE '^app\\.(get|post|put|patch|delete)\\('` 的现取读数 = 冻结依据**（容前置空白口径 = `R-8-20`）；⑤ **本单只冻结应然值，不实改**（零代码）⇒ 实际落盘 = 实现单（`NOT_MEASURED`，§24.10）。

### 24.5 ★★ 权限键映射（**先现取逐字十一键，再给映射；`R-8-1` / `R-8-8` 履约**）

**（a）既有十一权限键（现取 · 三真源逐字 · 不增不减）**：真源 A = `backend-ts/src/database.ts:11-23` `ALL_ADMIN_PERMISSIONS`；真源 B = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`；真源 C = `frontend/src/admin-utils.js:40-52` ⇒ **恰 11 键**：`dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · **`review_tasks`**。**★ 闭集（写死）：恰好 11 键，不增不减**（`R-8-1`）。

**（b）8⑤「所需权限 → 既有键」映射表（写死）**：

| 口 | 所需权限（语义） | → **既有键（11 键内）** | 依据 |
|---|---|---|---|
| **商品读口** `GET /api/admin/listing` | 读商品合规队列（只读） | **`review_tasks`** | `R-8-8` 逐字（审核 / 审批面） |
| **商品动作口** `POST /api/admin/listing/:listingId/takedown` | 商品合规下架 / 冻结 | **`review_tasks`** | 同键（**读写同权**） |
| **招工读口** `GET /api/admin/arbitration` | 读仲裁队列（只读） | **`review_tasks`** | 同键 |
| **招工动作口** `POST /api/admin/arbitration/:jobId` | 招工强制退单 / 仲裁结论 | **`review_tasks`** | 同键 |
| **两后台页** | 进面板 + 读 / 审 | **`review_tasks`** + **`dashboard_access`**（进面板） | `dashboard_access` = `ALL_ADMIN_PERMISSIONS` 首键 |

> **★ 映射表口径（写死）**：**逐行给死**；**凡找不到合适键 ⇒ 显式写「无 ⇒ 停报」**（**不得**填一个「看起来像」的键凑数）。**本表无「停报」行** —— 现取 `review_tasks` 语义 = **审核 / 审批 / 裁决**面，与 8⑤（合规审核 / 下架 / 仲裁）**吻合**。

**（c）★ `R-8-8` 逐字（`docs/seafood.master-plan.md:2058`）**：『**`R-8-8`** | **8④⑤ 审核面权限键**（`review_tasks` 语义不完全吻合） | ✅ **确认临时复用 `review_tasks`**：两片本质均为**审核/审批**面（④ 自建单位审批、⑤ 合规审核/下架）；**若 ⑤ 的 takedown 后续落成独立动作面 ⇒ 再报我裁**。独立键（`manage_currency` 等）⇒ 跨批。』

> **★★ 附带条件触发登记（写死 · 停报项）**：本片 **`takedown` 落成「独立动作面」**（自有路径 `POST /api/admin/listing/:listingId/takedown`）⇒ 命中 `R-8-8` 附带条件「**若 ⑤ 的 takedown 后续落成独立动作面 ⇒ 再报 Zang 裁**」⇒ **本单只登记、报 Zang 裁**（**登记 = §24.9 `I-1`**）；**裁决前实现方不得**为 takedown 自定义新键（**造键 ⇒ 判负**，违 `R-8-1`）。

**（d）★ `review_tasks` 现取消费面（7 处 · 逐字带锚 · 语义核对）**：

| # | 消费点（现取） | 锚 |
|--:|---|---|
| ① | `GET /api/tasklist/pending-verification/count` 闸 | `backend-ts/src/index.ts:1451` |
| ② | `GET /api/tasklist/pending-verification` 闸 | `backend-ts/src/index.ts:1466` |
| ③ | `POST /api/tasklist/:jID/verify` 闸 | `backend-ts/src/index.ts:1482` |
| ④ | `POST /api/job/:jobId/review` 闸（结算审核） | `backend-ts/src/index.ts:1885` |
| ⑤ | `POST /api/job/:jobId/cancel` 闸 | `backend-ts/src/index.ts:1909` |
| ⑥ | `GET /api/admin/currency` 闸（8④ 读口） | `backend-ts/src/index.ts:2114` |
| ⑦ | `POST /api/admin/currency/:cid/review` 闸（8④ 动作口） | `backend-ts/src/index.ts:2134` |

⇒ **全部 7 处皆为「审核 / 裁决 / 审批」面**（任务提交核验、招工结算审核、招工取消、自建单位审核）⇒ **语义与商品 / 招工合规审核吻合**（临时复用成立 · 承 `§22.3` / `§23.6`）；**独立键（`manage_currency` / `manage_rewards` 商品合规等）⇒ 跨批**（`R-8-8` 逐字）。

### 24.6 ★★ 「真生效」四段判据（**每段自带判负 · 不得只验「后台能存」**）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**四段 = ① 后台审 → ② 库内落值（表 / 列）→ ③ 业务读口取数（`文件:行`）→ ④ 行为随之（改动前 / 改动后两读数）**；**每段必须能判负**。**★ 不得只验「后台能存」**（**「审核 `POST` 返回 `200`」= 零证据**）。**★ 本单不实跑**（零库连接）⇒ 判据**已写死、未实跑**（§24.10）。

| 段 | 读数内容（必给 · 商品 / 招工两路径） | **判负形态（必带）** |
|--:|---|---|
| **① 后台审** | **动作口** `POST /api/admin/listing/:listingId/takedown`（商品）/ `POST /api/admin/arbitration/:jobId`（招工）+ 闸 `requireAdmin(req,res,'review_tasks')` + 请求体（逐字）+ 响应（status + `data` 键集） | **缺闸 / 闸降级（非 `review_tasks`）⇒ 判负**；**响应 `data` 键集 ≠ 冻结键集 ⇒ 判负** |
| **② 库内落值** | **商品** = 表 `public.listing` 列 `status`（`0015:137`）（依变体：Ⅰ/Ⅲ = `frozen`/`delisted`；Ⅱ = 不变 + 新表行）+ **留痕行**（新表恰 1 行，§27.5）；**招工** = 表 `public.job` 列 `status`（`0013:100`）+ 留痕行 + **资金腿** `job_escrow_refund` ×2 | **★ 「审核动作成功而台账无行 ⇒ 判负」**（正向）；**★ 反向：「台账有行而审核动作未成功 / 无提交 ⇒ 判负」**；**表 / 列处该值未随之变 ⇒ 判负**（「后台能存但库内没落」）；**招工退单无 `job_escrow_refund` 腿 ⇒ 判负** |
| **③ 业务读口取数** | **商品** = `transitionListingStatus`（`listing-service.ts:286`；闸 `:302`/`:305`）+ `buyListing`（`listing-funds-service.ts:191`）读 `listing.status`；**DB 直取** = `SELECT status FROM listing WHERE listing_id = …`。**招工** = `acceptApplication`（`job-service.ts:208`）/ `job_post_event`（`0013`）；**DB 直取** = `SELECT status FROM job WHERE job_id = …` | **业务读口取到的仍是旧值 ⇒ 判负**（「库内有新值但业务不读」= 判负；后台读口 ≠ 业务读口） |
| **④ 行为随之** | **同一个可直接观察的业务量** —— **商品**：未审 / 已冻结商品**不可购买**（`POST /api/listing/:listingId/buy` 前置闸 `buyListing`：非 `listed` ⇒ 拒）；**招工**：争议 / 未审招工**不可承接**（`POST /api/job/:jobId/accept` 前置闸 `acceptApplication`：非 `open` ⇒ 拒）—— **改动前 / 改动后两读数** | **改动后该业务量不变 ⇒ 判负**；**只给改动后单读数 ⇒ 判负**；**「审核通过 / 下架」后商品仍可购买 / 「未审」招工仍可承接 ⇒ 判负** |

**（a）总判据（写死 · 机读形态）**：**① 四段齐全**（缺任一段 ⇒ 判负）；**② ②段必须给表名 + 列名**（不得只写「已保存」）；**③ ③段必须给业务侧取数的 `文件:行` 锚**；**④ ④段必须给「改动前 / 改动后」两读数且为同一业务量**；**⑤ 每段各带判负形态**；**⑥ 负对照（门自证）**：把任一段读数改成常量 ⇒ 该门**必须转红**（**不转红 = 假门**）。

**（b）执行面（写死 · 按 `R-8-15` / `R-8-18`）**：**凡涉状态改写 / 资金腿的一切取证一律「事务内 + `ROLLBACK`」**（造 `listing`/`job` 行 / 写留痕 / 读 `ledger_entry`，**取证后事务整体回滚**，**生产库零净写**）；**★ 真 HTTP 写面（真 POST 审核）** 若跑须**先证「恢复路径可逐字节复原」**，否则**禁跑真写**（`§5.197` 口径）；**行为验收只许 DB 直造 + 读库**，**不得**为验收新增路由（`R-8-6` 双向判负）。

### 24.7 ★ 审计面与对账（**`R-8-3` 落实 · 本片台账与既有四张表的并联关系**）

**（a）本片台账与既有表的并联关系（写死 · 照 `R-8-3`）**：

| 表（现取） | 列数 | 含 `txid`? | 与本片台账的关系 |
|---|---|---|---|
| `0017` `currency_status_log` | 7 | ❌ | 币种侧状态日志（**不同资源**）—— 并联轴上的旁支 |
| `0023` `admin_ops_audit_log` | 15 | ✅（成功 = 回执 `txid`；拒绝行 = `NULL`） | 积分调账审计 |
| `0024` `admin_refund_audit_log` | 13 | ✅（同上） | 退款审计 |
| `0025` `currency_review_log` | 8 | ❌（8④ 无资金腿） | 自建单位审核台账 |
| **本片台账（新表 · 依变体）** | 待实现单 / Zang 定 | **商品行 = `NULL`（无分录，见 (c)）** / **招工行 = 回执 `txid`** | **并联读取轴**：以 `ledger_entry` 为主轴左联各表**只读**（**不合并表 / 不迁移**） |

**（b）对账判据（逐字 · 写死）**：**每条 admin 动作必须能锚到 `ledger_entry` 的 `txid`**（**只对 `result='applied'` 行生效**）；**拒绝行 `txid = NULL` 为显式豁免**（**写死防假红**）。

**（c）★ 本片两条路径的锚账口径（写死 · 防假红）**：
- **商品 `takedown`**：商品下架 / 冻结**无账务分录**（`DL59`：「商品发布不收费」；`ledger.spec` ②商品无「下架」账务动作）⇒ 商品合规行 `txid` **恒 `NULL`** ⇒ **属 (b) 的显式豁免**（**不得因商品行无 `txid` 判红**）。
- **招工 `arbitration`**：仲裁强制退单**有资金腿** `job_escrow_refund` ×2（`data-layer.spec.md:509`）⇒ 成功行 `txid` **必须 = 该回执 `txid`**，且该 `txid` 必须能在 `ledger_entry` 逐条对上（**对不上 ⇒ 判负**）；拒绝行 = `NULL`（豁免）。

**（d）统一呈现（承 `R-8-3` · 本片只登记、不实现）**：行形状统一 + **来源表作可见列** + **拒绝行可见**；实现归 **8⑥ 审计台**（`R-8-3` 已裁；本片只把新台账纳入并联轴）。

### 24.8 后台页数据契约与四语文案面（**本册只给契约与命名空间 · 不写实现**）

**（a）页面定位**：新增管理后台页（命名依实现单；现取 `frontend/src/pages/admin/**` = **10 页** —— `CurrencyReviewPage` / `FeeRatePage` / `PermissionsManagement` / `PointsManagement` / `ReferralWeightMatrixPage` / `RewardsManagement` / `ShardsManagement` / `SystemSettings` / `TasksManagement` / `UsersManagement` —— **无商品合规页 / 无招工仲裁页**）。

**（b）页面数据契约（字段 → 来源）**：

| 字段（页面用） | 来源（**唯一 = §24.2 读口**） | 说明 |
|---|---|---|
| 商品页：`listing_id` / `seller_uid` / `cid` / `price` / `stock` / `title` / `status` / `time_created` | 读口 `GET /api/admin/listing` `data` 同键 | `status` = **四值之一**（`draft`/`listed`/`delisted`/`frozen`）；展示映射在展示层，**不改数值语义** |
| 招工页：`job_id` / `employer_uid` / `worker_uid` / `cid` / `reward` / `title` / `status` / `time_created` | 读口 `GET /api/admin/arbitration` `data` 同键 | `status` = **七值之一**；`disputed` = 仲裁路径态 |
| 审核决定 | **动作口**（字段名待实现单 / Zang 定） | **★ 本册不发明决定字段名** |

**（c）★ 命名空间约定（写死 · 不得自拟新风格）**：承既有 `admin*` 前缀先例 ⇒ **本片新增命名空间 = `adminListingReview`（商品合规）+ `adminArbitrationReview`（招工仲裁）**（词根 = 既有域词 `listing` / `arbitration`）；**四语（`zh`/`en`/`hk`/`vn`）必须逐键齐**（缺任一语 ⇒ 判负）；**★ 键名 = 待实现单按本条约定落**（本单只给约定 + 命名空间，**不发明键名清单 / 不写四语文案值**）。

**（d）★ 禁工程口径泄漏六类（写死 · 可判负 · 逐字承 §19.5(c) / 姊妹册 §27.6(c)）**：**用户可见文案**（`t(...)` 的**值**面）**不得**出现：① 本册 / 姊妹册**章节号 / 条号**（例 `§24.3` / `R-8-8` / `DL60`）；② **HTTP 状态码**（`409` / `403` / `423`）；③ **接口路径 / 方法**（`/api/admin/listing/:id/takedown` / `POST`）；④ **内部批次名 / 单号**（`8⑤` / `P6` / `JING-SPEC-B8-5`）；⑤ **机读码 / 裸 i18n 键**（`LEDGER_CURRENCY_INVALID_TRANSITION` / `adminListingReview.title`）；⑥ **表名 / 列名 / 函数名**（`listing` / `job_status_transition_ok` / `listing_status_guard`）。
- **判负形态（写死）**：对四语 locale 的 `adminListingReview*` / `adminArbitrationReview*` 键值做**正则扫描**（命中六类任一模 = **判负**）；**负对照** = 人为把一条文案改成 `"审核（§24.3）"` ⇒ **扫描必须转红**（**不转红 = 假门**）。
- **★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写四语文案内容**；**★ 工程口径可现于 `message` 日志面**（承 §3.3 条款 9′ / §15.5）。

**（e）页面 → 权限 → 路由（写死 · 与 §24.5 一致）**：两页 = `requiredPermission="review_tasks"`（+ 面板入口 `dashboard_access`）；**先例逐字** = `frontend/src/App.jsx:243`。**★ 前端路由行号 = 待实现单现取**（本单零代码）。

### 24.9 本单待办登记（**交「接该面的实现单」，本册不实现**）

| # | 待办 | 归属 |
|--:|---|---|
| **I-1** | **`R-8-8` 附带条件裁决**（⑤ `takedown` 已落成独立动作面 ⇒ 是否需独立权限键） | **Zang**（`R-8-8` 逐字「再报我裁」） |
| **I-2** | **审核闸三变体选型**（姊妹册 §27.4 的 Ⅰ / Ⅱ / Ⅲ） | **Zang** |
| **I-3** | **招工审核方现取冲突收口**（`§5-C7`「雇主审」vs 现取 `:1884`/`:1908` 皆 admin 闸） | **Zang**（本单只登记，未改一行） |
| **I-4** | **路径 B 子路径定名**（`/api/admin/arbitration/*` 子段 + 动作口是否复用既有 `cancel`） | Zang / 实现单 |
| **I-5** | **决定字段名 / 新表名 / 新列名 / 迁移文件编号**（依变体） | Zang + 新迁移（**需授权 apply**） |
| **I-6** | **读口 / 动作口实现**（注册点 71 → 75/74）+ 两后台页 + 四语文案 | 实现单 |
| **I-7** | **判负门落地**（§24.3 两路径判负 + ≥6 入参 + §24.8(c) 六类泄漏正则 + 负对照） | 实现单 / 质检单 |

### 24.10 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **读口 / 动作口 HTTP 实跑两态** | **未实现**（本单为规范单、零代码 / 零库 / 零 HTTP）⇒ 判据**已写死、未实跑** |
| 2 | **四段判据的判负实跑** | 同上（归实现单 + 质检单） |
| 3 | **注册点增量 72–75 的实际落盘** | **未实现** ⇒ 无读数（**不得**填「已 75」；本单只冻结应然值） |
| 4 | **本片台账（新表）的 apply 落盘 / 现库结构** | **未实现**（**零迁移 · 零 DDL · 零 apply**；本册只冻内容 = 姊妹册 §27.3） |
| 5 | **`listing` / `job` 各 `status` 分布 / 台账现库行数** | **零库连接**（红线）⇒ 无读数 |
| 6 | **变体选型（Ⅰ/Ⅱ/Ⅲ） / 路径 B 子路径 / 决定字段名** | **待 Zang / 实现单定**（**本册不发明**） |
| 7 | **两后台页字段级实现面 / 四语键名清单** | **页面尚未存在**（现取 `frontend/src/pages/admin/**` = 10 页，无合规审核页） |

### 24.11 交付声明 / 只追加自证 / 行号漂移表 / 纪律自检（**v2.9 新增 · 本节只追加**）

**24.11.1 声明（写盘范围 · 逐条）**：本单**只写 6 个文件** —— `docs/route-layer.spec.md`（**就地升 v2.9** = 顶部状态块区**新增 v2.9 块** + **§24〔新〕**）+ `docs/versions/route-layer.spec.v2.9.md`（**新建** · `cmp` = 0）+ `docs/audit/route-layer-v2.9-delta.md`（**新建**）+ **同批姊妹册** `docs/data-layer.spec.md`（**就地升 v0.16** = 顶部状态块**新增 1 行** + **§27〔新〕**）+ `docs/versions/data-layer.spec.v0.16.md`（**新建** · `cmp` = 0）+ `docs/audit/data-layer-v0.16-delta.md`（**新建**）。**未碰**：`backend-ts/**` / `frontend/**` / **`migrations/**`（不得新建迁移文件 · 不得 apply）** / `docs/seafood.master-plan.md` / `docs/qa/**` / `docs/audit/**` 既有件（**含 `p8-s4-currency-review.md` —— 此刻有微修单在写 · 未触碰**）/ `docs/design/**` / 其它 spec。**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**启停 5787 / 5788。

**24.11.2 ★ 行数口径（承 §20/§23 末行 · 写死）**：本册 **`wc -l` = 换行符数**（末行 `---` **不带换行**）⇒ **逻辑行 = `wc -l` + 1**；**凡报行数必须注明用的是哪一种**。**★ 追加手法（写死）**：本册末行无换行符 ⇒ **一切追加一律插在末行 `---` 之前**（否则该行由「无换行」改写为「带换行」⇒ `git diff --numstat` 必记 **1 个删除行**，违「删除列 = 0」硬口径）。姊妹册（data-layer）末行**带换行符** ⇒ **直接追加于末行之后**（0 删除行）。

**24.11.3 行号漂移（诚实登记 · 可复算）**：本版共 **两处新增**（均在既有行**之间 / 之末**插入、零删除）：**(i)** 状态块 **+N 行**（在 `§0` 之前）⇒ 影响 `§0` 之后一切；**(ii)** §24 本节 **+N 行**（在末行 `---` 之前）⇒ **末行 `---` 行号整体后移**；**册内既有引用行锚（如 §22.x / §23.x）一律以「基线 `:N` ⇒ 本版现取 `:N+k`」两件引**（`R-8-14` 口径）。

**24.11.4 纪律自检（逐条对照硬口径与派单纪律）**：① **只追加 / 删除列 = 0** ✅（见 delta §D0）｜② **`difflib` 独立复核 0 replace / 0 delete** ✅｜③ **快照 `cmp` = 0** ✅｜④ **旧快照零改动** ✅（route `v0.1`–`v2.8` **二十八个** + data-layer `v0.1`–`v0.15` **十五个**，一字未动；本单**新建** = `v2.9.md` + `data-layer.spec.v0.16.md`）｜⑤ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑥ **未发明项** ✅（**状态值溯自 `0013`/`0015` `CHECK`；权限键逐字三真源；`job_arbitrate` 键逐字溯自 `data-layer:509`**；**决定字段名 / 子路径 / 表名列名 / 迁移编号 / 文案值**一律未发明，标「待实现单 / Zang / `NOT_MEASURED`」）｜⑦ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`·`killall` / 未启停 5787-5788** ✅｜⑧ **未测项 = `NOT_MEASURED` + 原因** ✅（§24.10；无 0 / 无空 / 无占位）｜⑨ **不确定处不二选一** ✅（**变体 / 子路径 / 决定字段名** 一律「登记 + 待裁」）｜⑩ **报数带口径** ✅（行数双口径 + 字节 + md5 + `numstat`）｜⑪ **引用纪律** ✅（本节全部引用**现取且逐字**；代码锚注明「本单现取时点」）。

### 24.12 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§1.1 #44`（`route-layer.spec.md:368`）** | **★ 兑现**：其「合规下架另立 P6 `/api/admin/listing/:id/takedown`」由本节 §24.2(a) 补全（路径 / 闸 / 键 / 注册点）；**行体一字未动** |
| **`§5.1 后台发布商品行`（`:1547`）** | **★ 兑现**：同上；**行体一字未动** |
| **`§7-6`（`:1689`）** | **★ 兑现**：其「仲裁面 `/api/admin/arbitration/*` 排 P6」由本节 §24.2(b) 补全；**行体一字未动** |
| **`§7-63` / `7-66`（`:1849` 等）· `R-8-8`** | **★ 兑现**：`review_tasks` 临时复用成立（§24.5）；**★ 附带条件（takedown 独立动作面）触发 ⇒ 报 Zang 裁**（§24.5 附带条件触发登记 + `I-1`）；**行体一字未动** |
| **`§4.2 C1 / C2`（商品事件行）** | **承**：商品发布不收费（`DL59`）、下架无账务动作；**该行行体一字未动** |
| **`§22` / `§23`（8④ 读写口 / 裁定落册）** | **承 + 复用**：读口 / 动作口契约形态（`sendSuccess` / R107 / `ops:` 键 / 注册点登记法）逐字承；**两节正文一字未动** |
| **`§19.4`（真生效四段模板） / `§19.5(c)`（禁工程口径泄漏六类）** | **复用**：§24.6 承四段模板 / §24.8 承六类禁项；**两节正文一字未动** |
| **`§17.5`（审计台并联对账 · `R-8-3`）** | **承**：§24.7 把本片台账纳入并联轴 + 对账判据（含拒绝行 `txid=NULL` 豁免 + 商品无分录豁免）；**`§17.5` 正文一字未动** |
| **`§1.8`（已实现·未注册清单） / `R-8-6`** | **承**：两读口 + 两动作口属「功能需求」⇒ 须注册；行为验收**只许 DB 直造 + 读库** |
| **`§4.5` 幂等键总表 / `DL36` / `DL93`** | **承**：商品动作口 `ops:<admin_uid>:listing_takedown:<listingId>`（沿先例）；招工动作口 `ops:<admin_uid>:job_arbitrate:<job_id>`（**既有逐字**）；读口无键；**行体一字未动** |
| **`data-layer.spec` v0.16 §27** | **同批姊妹册**：其 §27.1–§27.10 = **两条「待定义」原文 + 状态闭合集 + 三查 + 三变体 / 载体 / 留痕 + 留痕缺口**正文；**本册只承载 route 侧** |
| **`ledger.spec` `R3` / `R5` / §14.1（33 码）** | **只读引用**（风险面 / 错误码闭集）—— **本单未改其一字** |

## §25 ★★ v2.10 · 批 8 第 5 片（8⑤）**裁定落册**：取**变体 Ⅱ（旁路台账 + 既有状态边）** —— 4 路由读写口契约 + **注册点 `71 → 75`** 逐字登记 + **归属闸契约形态**（雇主本人 或 持键）+ 真生效四段判据（按 Ⅱ 细化）+ 审计面并联对账 + 后台页数据契约与四语文案面（**v2.10 新增 · 本节只追加 · 依据 = Zang `§5.210` B 五条裁定（`docs/seafood.master-plan.md:1426-1432`）+ 派单「8⑤ 裁定落册单」；状态 / 载体 / 留痕 / **迁移内容契约**正文 = 姊妹册 `data-layer.spec` v0.17 §28**）

> **★ 本节硬约束（写死）**：**不得发明状态值 / 路径风格 / 权限键 / 决定字段名**；**新路由必须逐字登记注册点增量**；**权限键必须在既有 11 键内选**（`R-8-1`）；**`ops:` 幂等键形态沿既有 admin 先例（现取）**；**归属闸不得删除既有 admin 通道**（`R-8-25①`）。

### 25.0 开工锚（现取 · 逐项）

| 项 | 现取读数 | 锚（本单现取时点） |
|---|---|---|
| 仓库 HEAD | `main`（`git status --porcelain docs/` = **无脏 spec**；8④ 微修件已随 `3efa171` 入库） | 本单 |
| 本册改前（v2.9） | **`wc -l` 5742（逻辑 5743）/ 1195524 B / md5 `763e6058fe7693943f312df02479c05a`** | `wc` / `md5 -q docs/route-layer.spec.md` |
| 本册末行 | **不带换行符**（末字节 = `2d` = `-`）⇒ **一切追加插在末行 `---` 之前** | `tail -c 1 docs/route-layer.spec.md \| od` |
| **注册点现取** | **71**（`grep -cE '^app\.(get\|post\|put\|patch\|delete)\(' backend-ts/src/index.ts` = **71**） | `backend-ts/src/index.ts`（2243 行） |
| 姊妹册（data-layer） | **v0.16 · 2227 行 / 485323 B / md5 `72060376b2e7c99326e6821fb98513b6`**；末行**带换行符** | `wc` / `md5` |
| 旧快照（改前既存） | `docs/versions/route-layer.spec.v0.1…v2.9` = **29 件**（一字未动）；`docs/versions/data-layer.spec.v0.1…v0.16` = **16 件** | `ls docs/versions \| grep -c` |
| 库 / HTTP | **零库连接 / 零 HTTP / 零套件** | — |

### 25.1 ★★ 五条裁定 `R-8-23`..`R-8-27` 逐字入册（**逐字 · 不得改写**）

> **真源（现取）** = `docs/seafood.master-plan.md` **`§5.210` B**（`:1426-1432`）。下表**逐字**照录（**不改写一字**）；同表亦见姊妹册 `data-layer.spec` v0.17 §28.1。

| # | 裁定（**逐字**） | 依据（**逐字**） |
|---|---|---|
| **`R-8-23`**（载体） | 取**变体 Ⅱ「旁路台账 + 既有状态边」**（同 8④）：① **默认另建台账表**（**各资源一张**，避免信息压缩）；② **通过 / 驳回都必须落台账行**（**驳回不得静默**）；③ **状态迁移一律走既有已白名单边**（**不新增状态值、不动已 apply 闭合集**）。**变体 Ⅲ（纯闸）不采纳** —— 其驳回**无落值 ⇒ ② 段天然判负**，与「**拒绝必须留痕**」的既定纪律冲突（同 8④ 理由②）。 | 8④ Ⅱ 先例 + `R-8-21` 理由② + 三查结论 |
| **`R-8-24`**（`takedown` 独立动作面）**= 批准** | `POST /api/admin/listing/:listingId/takedown`（逐字源自 `data-layer:294`）+ 读口 `GET /api/admin/listing`；**权限键 = `review_tasks`**。 | **下架 = 发布后处置**，与**发布前审核**是**两个动作面**（语义、留痕、判据均不同）⇒ 不是同一动作的重复；`R-8-8` 附带条件已报我 ⇒ 我裁准 |
| **`R-8-25`**（招工验收人） | **按已冻结 D5 执行「雇主自审 + 平台仲裁兜底」（双通道）**：① `POST /api/job/:jobId/review`（`:1884`）准入改为「**该 job 的雇主本人** **或** 持 `review_tasks` 的管理员」（**不得删除既有 admin 通道** ⇒ 零回归）；② **新增仲裁动作口** `POST /api/admin/arbitration/:jobId`（admin + `review_tasks`）= **平台仲裁兜底**，落仲裁台账。 | 我**自行现取**：`master-plan:106` **D5** = 「招工验收人 = **雇主自审 + 平台仲裁兜底**（管理员不再发布、也不逐单审核）」；现取 `index.ts:1884` **实为** `requireAdmin('review_tasks')` 且它就是**验收=结算** ⇒ **D 系列是与 Kevin 定档的决策表 ⇒ 不得由我改** ⇒ 按 D5 兑现并保留既有 admin 通道 |
| **`R-8-26`**（`cancel` 归属闸）**= 批准**（同族） | `POST /api/job/:jobId/cancel`（`:1908`）准入改为「**雇主本人** **或** 持 `review_tasks`」。 | 该路由注释里**已登记**「雇主可取消自己的招工 = 需归属闸 ⇒ **不在本片自选**，登记待 Zang 裁定」⇒ **我在此裁定并纳入 8⑤**（跨轮待裁项收口） |
| **`R-8-27`**（注册点与迁移编号） | 注册点 **71 → 75 逐字登记**（4 新路由）；**迁移编号 0026（商品审核台账）/ 0027（招工仲裁台账）**（若最终合表 ⇒ 仅 0026）；**apply 由我执行**。**I-4：动作口 = `POST /api/admin/arbitration/:jobId`，候选人/标的物走 body 显式字段**（路径不再加层级；与 `ops:` 的 `job_id` 派生一致）。 | 注册点增量与 `R-8-22`「前推必须给出处」同族；迁移编号沿 `0025` 顺延 |

**（a）★ 变体定案与「不采纳」（写死 · 收口 `§24`）**：

- **取变体 Ⅱ**「旁路台账 + 既有状态边」（`R-8-23`）—— 即 `§24` 冻结时登记之 **Ⅱ（纯旁路台账型）**，本案在其上叠加 `R-8-23③`「通过亦走既有已白名单边」（同 8④）。**`§24` 的「变体不择一（选型 = Zang）」自此由本案收口**；**`§24` 行体一字未动**。
- **变体 Ⅰ（状态机既有态型）⇒ 不采纳**。理由：`R-8-23` 明取 **Ⅱ 的「旁路台账 + 既有状态边」组合** ⇒ Ⅰ 的「无台账表、状态机自身承载待审」面**与 Ⅱ 的载体定性不相容**；且 `§24`/姊妹册 `§27.4(a)` 已自证 Ⅰ 之缺陷 —— **「待审」态不可区分**（商品发布即 `listed`；招工 `submitted→disputed` 是**发布后**动作、非**发布前**审核）+ Ⅰ 仍需**另建留痕表** ⇒ 与 Ⅱ 相比**无收益**。
- **变体 Ⅲ（纯闸 · 复用既有边型）⇒ 不采纳**。理由（`R-8-23` 逐字）：**其驳回无落值 ⇒ ② 段天然判负**，与「**拒绝必须留痕**」的既定纪律冲突（同 8④ 理由②）。

**（b）★ 三处「附带条件 / 跨轮待裁」的收口（写实）**：

- **`R-8-8` 附带条件**（`§24.5` 附带条件触发登记 / `I-1`）⇒ **`R-8-24` 已裁：`takedown` 独立动作面 = 批准、键 = `review_tasks`** ⇒ **停报项收口**（`§24.5` 行体一字未动）。
- **招工审核方现取冲突**（`§24.1(c)2` / `I-3`）⇒ **`R-8-25`/`R-8-26` 已裁：按 D5 双通道** ⇒ **收口**（细则 = §25.6）。
- **路径 B 子路径**（`I-4`）⇒ **`R-8-27` 已裁：动作口 = `POST /api/admin/arbitration/:jobId`（路径不加层级；候选人 / 标的物走 body 显式字段）** ⇒ **收口**（细则 = §25.2 / §25.6）。

### 25.2 ★★ 4 路由读写口契约（**路径 / 闸 / `ops:` 键 / `data` 键集 · 自本单起冻结**）

> **共同口径**：**成功** = `{success:true, message, data:{…}}`（`sendSuccess` = `index.ts:108-122`）；**失败** = **R107** `{error:{code, message, i18n_key, details}}`（§3.3 条款 9′ / §15.5 / §15.6）。**读口无 `ops:` 键**（无副作用；先例 = `GET /api/admin/currency`（`index.ts:2113`）亦无）；**动作口必带 `ops:` 键**（`DL36`；缺 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）。

| 口 | 路径 / 方法 | 闸 | `ops:` 幂等键 | 响应 `data` 键集（**自本单起冻结**） | 依据 / 先例（现取） |
|---|---|---|---|---|---|
| **商品读口** | **`GET /api/admin/listing`** | `requireAdmin(req,res,'review_tasks')` | **无** | 商品行数组（键集承 `§24.8(b)`） | **★ 非发明**：admin 命名空间 + 既有资源名词 `listing`；同族先例 = `GET /api/admin/currency`（`index.ts:2113`） |
| **商品动作口** | **`POST /api/admin/listing/:listingId/takedown`** | `requireAdmin(req,res,'review_tasks')` | **规范形 `ops:<admin_uid>:listing_takedown:<listingId>`** | 至少含 `listing_id` / `status` / `result` | **★ 逐字源自 `data-layer §4.1 #47`**（`data-layer.spec.md:294`）；键形沿 `DL36`（`data-layer.spec.md:334`）+ 同资源先例（`data-layer.spec.md:509`） |
| **招工读口** | **`GET /api/admin/arbitration`** | `requireAdmin(req,res,'review_tasks')` | **无** | 招工行数组（键集承 `§24.8(b)`） | **★ 族名逐字** `/api/admin/arbitration/*`（`data-layer.spec.md:299`/`:356`）；子路径 = `R-8-27` 定（读口无子段） |
| **招工动作口** | **`POST /api/admin/arbitration/:jobId`** | `requireAdmin(req,res,'review_tasks')` | **规范形 `ops:<admin_uid>:job_arbitrate:<job_id>`**（**★ 既有逐字**） | 至少含 `job_id` / `status` / `result` | **`R-8-25②` + `R-8-27`（I-4）**；键形逐字源自 `data-layer §7.1 ①招工 仲裁强制退单`（`data-layer.spec.md:509`）：`ops:<admin_uid>:job_arbitrate:<job_id>` |

- **★ 请求体字段（决定字段 / 原因字段）= 待实现单 / Zang 定**（本册**不发明决定字段名**；承 `§24.2`）。**招工动作口候选人 / 标的物走 body 显式字段**（`R-8-27` 逐字：路径不再加层级）。
- **读口属「功能需求」而非「为验收凑数」**（逐字承 `§24.2(c)` / `R-8-6`）：后台合规页**必须**有读口；**行为验收只许 DB 直造 + 读库**（§25.7）。
- **迁移面**：**零迁移 / 零 DDL**（`listing` 表在 `0015`；`job` 表在 `0013`；两新台账表 = 姊妹册 §28.6 内容契约，**本片不建文件**）。

### 25.3 通过 / 驳回 两条路径各自的可判负形 + 非法入参（≥6 条 · **按变体 Ⅱ 细化**）

**（a）两路径 通过 / 驳回 判负（写死 · **★ 驳回必须留痕、不得静默**）**：

| 路径 | 通过（正向必给 · Ⅱ） | **判负形态（必带 · Ⅱ）** | 驳回（正向必给 · Ⅱ） | **判负形态（必带 · Ⅱ）** |
|---|---|---|---|---|
| **A 商品 `takedown`** | ① 动作口 200 + `data` 键集；② **台账表 `listing_review_log` 恰 1 行**（`result='approved'`）+ **同事务** `listing.status` 走**既有边**（`listed→delisted` / `listed→frozen`）；③ 业务读口读新值；④ 行为 = 该商品**不可购买** | **动作口 200 而台账无行 ⇒ 判负**；**台账有行而动作未成功 ⇒ 判负**；**`status` 未随既有边变 ⇒ 判负**；`actor_uid` 记成 seller ⇒ **判负** | 依 Ⅱ：**台账落 `rejected` 行**；`listing.status` **不动** | **★ 驳回后台账无行 ⇒ 判负**（`R-8-23②`：拒绝必须留痕）；**驳回而 `listing.status` 落入非闭合集值 ⇒ 判负**；**驳回后商品仍可购买（若前置闸缺失）⇒ 判负** |
| **B 招工 `arbitration`** | ① 动作口 200；② **台账表 `job_arbitration_log` 恰 1 行**（`result='approved'`）+ 同事务 `job.status` 走**既有边**（`submitted→disputed→settled`/`disputed→cancelled`）+ **资金腿** `job_escrow_refund` ×2（`txid`）；③ 业务读口读新值；④ 行为 = 争议单**不可再承接 / 已结算** | **状态变而台账无行 ⇒ 判负**；**有资金腿而 `ledger_entry` 无对应 `job_escrow_refund` 分录 ⇒ 判负**；**动作口 200 而库内未变 ⇒ 判负** | 依 Ⅱ：**台账落 `rejected` 行** + 状态走 `disputed→cancelled`（退单）+ 资金腿 | **★ 驳回后台账无行 ⇒ 判负**；**退单无 `job_escrow_refund` 腿（托管未退）⇒ 判负** |

**（b）未知 / 非法入参不得静默（写死 · 可判负 · ≥6 条）**：

| # | 输入 | 期望 | 判负 |
|--:|---|---|---|
| 1 | `:listingId` / `:jobId` 非数字 | **`404` + 既有 detail-miss 形状**（先例 = §3.1「非数字 `:jID` `400 → 404`」统一口径；现取 `index.ts:1814`/`:1889`） | **静默按 0 处理 / 返回 200 ⇒ 判负** |
| 2 | `:listingId` / `:jobId` 不存在（`<=0` 或该行不在） | **`404`** | **`400` / `500` ⇒ 判负** |
| 3 | 审核决定字段缺失 / 非枚举值 | **`400` + 既有码 + `details.field`/`details.reason`**（R107 形状；**不得静默取默认决定**） | **缺字段被当「通过」/「驳回」⇒ 判负** |
| 4 | 原因字段缺失 / 空串（**尤其驳回**） | **`400`**（形状闸） | **驳回缺原因被静默放行 ⇒ 判负** |
| 5 | 无 token / 非 admin / 缺 `review_tasks` | **`401`（无 token）/ `403 AUTH_FORBIDDEN` + `details.reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`**（`AUTH_REASONS` 现取 = `['ACTOR_NOT_ALLOWED','NOT_ADMIN','PERMISSION_NOT_GRANTED']`，`index.ts:271`） | **落到业务 200 / 500 ⇒ 判负** |
| 6 | 商品 / 招工状态非「可审」（如商品已 `delisted` 终态 / 招工非 `submitted`·非 `disputed`） | **借既码 `LD011 LEDGER_CURRENCY_INVALID_TRANSITION`（`409`）+ `reason = LISTING_STATE_INVALID`（`0015:202`）/ `JOB_STATE_INVALID`（`0013:126`）** | **对非可审态静默通过 ⇒ 判负**；**新造码 ⇒ 判负**（33 码闭集） |
| 7 | 缺 `ops:` 幂等键 | **`400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（`DL36`） | **无键静默放行 ⇒ 判负** |
| 8 | 数据库基础设施错误（`code == null`） | **`503` + `driver_connection_error`**（D1′ 口径） | **吞成 `400` / 静默 ⇒ 判负** |

**（c）R107 形状（写死 · 逐字承 §3.3 条款 9′ / §15.5）**：`{error:{code, message, i18n_key, details}}` —— `code` = **机读唯一真源**；`i18n_key` = **本地化真源**（形如 `ledger.err.<CODE>`）；`message` = **人类可读稳定英文句（严禁填机读码）**。**同端点内 400 类只许一种形状**（R107）。**零新增错误码 / 零新增 `reason` 常量**（33 码闭集不动；`AUTH_REASONS` 三值不动）。

### 25.4 ★ 注册点 **71 → 75** 逐字登记（**写死 · 可判负**）

| # | 路由 | 闸 | 落地后注册点 | 判据 |
|--:|---|---|---|---|
| — | **（改前现取）** | — | **71** | `grep -cE '^app\.(get\|post\|put\|patch\|delete)\(' backend-ts/src/index.ts` = **71**（§25.0） |
| 1 | **`GET /api/admin/listing`**（商品读口 · §25.2） | `review_tasks` | **72** | 读口注册后 `grep -cE` 必须 = **72** |
| 2 | **`POST /api/admin/listing/:listingId/takedown`**（商品动作口 · §25.2） | `review_tasks` | **73** | 商品两口注册后 `grep -cE` 必须 = **73** |
| 3 | **`GET /api/admin/arbitration`**（招工读口 · §25.2） | `review_tasks` | **74** | 招工读口注册后 `grep -cE` 必须 = **74** |
| 4 | **`POST /api/admin/arbitration/:jobId`**（招工动作口 · §25.2） | `review_tasks` | **75** | 招工两口注册后 `grep -cE` 必须 = **75** |

> **★ 注册点判据（写死）**：① **本片对外路径应然集 = 4 条**（两读口 + 两动作口）⇒ **71 → 75**（`R-8-27` 逐字）；② **`R-8-25①` 的「`review`/`cancel` 准入放宽」= 既有路由改闸、非新增路由 ⇒ 注册点 +0**；③ **两条动作口均须 `requireAdmin` 前置**（缺闸 ⇒ 判负）；④ **`grep -cE '^app\.(get|post|put|patch|delete)\('` 的现取读数 = 冻结依据**（容前置空白口径 = `R-8-20`）；⑤ **本单只冻结应然值，不实改**（零代码）⇒ 实际落盘 = 实现单（`NOT_MEASURED`，§25.11）。

### 25.5 ★★ 权限键映射（**先现取逐字十一键，再给映射；`R-8-1` / `R-8-8` / `R-8-24` 履约**）

**（a）既有十一权限键（现取 · 三真源逐字 · 不增不减）**：真源 A = `backend-ts/src/database.ts:11-23` `ALL_ADMIN_PERMISSIONS`；真源 B = `backend-ts/migrations/0022_admin_permission_seed.sql:50-61`；真源 C = `frontend/src/admin-utils.js:40-52` ⇒ **恰 11 键**：`dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · `manage_settings` · **`review_tasks`**。**★ 闭集（写死）：恰好 11 键，不增不减**（`R-8-1`）。

**（b）8⑤「所需权限 → 既有键」映射表（写死 · 逐行给死）**：

| 口 | 所需权限（语义） | → **既有键（11 键内）** | 依据 |
|---|---|---|---|
| **商品读口** `GET /api/admin/listing` | 读商品合规队列（只读） | **`review_tasks`** | `R-8-8` / `R-8-24`（权限键 = `review_tasks`） |
| **商品动作口** `POST /api/admin/listing/:listingId/takedown` | 商品合规下架 / 冻结 | **`review_tasks`** | 同键（**读写同权**） |
| **招工读口** `GET /api/admin/arbitration` | 读仲裁队列（只读） | **`review_tasks`** | 同键 |
| **招工动作口** `POST /api/admin/arbitration/:jobId` | 招工仲裁兜底 | **`review_tasks`** | 同键（`R-8-25②`） |
| **`POST /api/job/:jobId/review`（改准入）** | 雇主自审 **或** admin 兜底 | **`review_tasks`**（admin 支）**＋ 雇主本人**（归属支 · 无键） | `R-8-25①` |
| **`POST /api/job/:jobId/cancel`（改准入）** | 雇主本人 **或** admin | **`review_tasks`**（admin 支）**＋ 雇主本人**（归属支 · 无键） | `R-8-26` |
| **两后台页** | 进面板 + 读 / 审 | **`review_tasks`** + **`dashboard_access`**（进面板） | `dashboard_access` = `ALL_ADMIN_PERMISSIONS` 首键 |

> **★ `R-8-8` 附带条件收口（写死）**：`§24.5` 的「★ 附带条件触发登记（写死 · 停报项）」⇒ **`R-8-24` 已裁：`takedown` 独立动作面 = 批准、键仍 = `review_tasks`**（**不新造键**）⇒ **`§24.5` 行体一字未动**；**实现方仍不得**为 takedown / arbitration 自定义新键（**造键 ⇒ 判负**，违 `R-8-1`；独立键 ⇒ 跨批）。

**（c）★ `review_tasks` 现取消费面（7 处 · 逐字带锚 · 语义核对）**：① `GET /api/tasklist/pending-verification/count` 闸 `index.ts:1451`；② `GET /api/tasklist/pending-verification` 闸 `:1466`；③ `POST /api/tasklist/:jID/verify` 闸 `:1482`；④ `POST /api/job/:jobId/review` 闸 `:1885`；⑤ `POST /api/job/:jobId/cancel` 闸 `:1909`；⑥ `GET /api/admin/currency` 闸 `:2113`；⑦ `POST /api/admin/currency/:cid/review` 闸 `:2133`。⇒ **全部 7 处皆为「审核 / 裁决 / 审批」面** ⇒ 与商品 / 招工合规审核吻合（临时复用成立 · 承 `§24.5(d)`）。

### 25.6 ★★ 归属闸契约形态（`R-8-25` / `R-8-26` · **准入判定式 + 拒绝形态 + 不得删除既有 admin 通道 + `disputed` 与仲裁的关系**）

**（a）准入判定式（写死）**：`POST /api/job/:jobId/review`（`:1884`）与 `POST /api/job/:jobId/cancel`（`:1908`）准入——

```
准入 ⇔ (actor.uid == job.employer_uid)                     // 雇主自审（归属支 · 无键）
      ∨ (actor 为 admin ∧ actor 持 'review_tasks')         // 既有 admin 通道（★ 不得删除）
```

- **判定顺序（写死）**：**① 无 token ⇒ `401`**（既有 `requireActor` 先例）；**② `:jobId` 非数字 / job 不存在 ⇒ `404`**（先例 `index.ts:1889`）；**③ `actor.uid == job.employer_uid` ⇒ 放行**（雇主支）；**④ 否则走既有 `requireAdmin(req,res,'review_tasks')` 分支**（**★ 不得删除既有 admin 通道** · `R-8-25①` 逐字「不得删除既有 admin 通道 ⇒ 零回归」）；**⑤ 皆不满足 ⇒ 拒绝**（见 (b)）。

**（b）拒绝形态（写死 · 码 + `details.reason` 稳定常量 · **零新增码**）**：

| 情形 | 码 | `details.reason`（**稳定常量 · 既有闭集**） |
|---|---|---|
| 无 token | **`401`** | `AUTH_UNAUTHORIZED`（既有） |
| 有 token、非雇主、且非 admin | **`403 AUTH_FORBIDDEN`** | **`NOT_ADMIN`**（既有 `AUTH_REASONS` 三值内 · `index.ts:324`） |
| 有 token、admin 但缺 `review_tasks` | **`403 AUTH_FORBIDDEN`** | **`PERMISSION_NOT_GRANTED`**（既有 · `index.ts:330`） |

- **★ 零新增码（写死 · 判负）**：**错误码闭集 33 不动**；**`reason` 值域 = 既有 `AUTH_REASONS` 三值**（`['ACTOR_NOT_ALLOWED','NOT_ADMIN','PERMISSION_NOT_GRANTED']`，`index.ts:271`）—— **不得新增 reason 常量**；**新造码 / 新造 reason ⇒ 判负**。
- **★ 同族可替代登记（诚实）**：业务角色守卫先例用 `403 ACTOR_NOT_ALLOWED`（`job-service.ts:218`（`not_employer`）/ `listing-service.ts:302`（非 owner））—— **本册冻结取 `requireAdmin` 既有形态**（`NOT_ADMIN` / `PERMISSION_NOT_GRANTED`），因 `R-8-25①` 是**在既有 `requireAdmin` 上加一条 OR 分支（准入放宽）**，拒绝语义沿用**既有 admin 闸**而非新建业务守卫；**若实现单现取认为归属支拒绝应用 `ACTOR_NOT_ALLOWED` ⇒ 报 Zang**（两值皆在既有闭集内）。

**（c）★「不得删除既有 admin 通道」（写死 · 判负）**：现取 `:1885` / `:1909` 的 `requireAdmin(req,res,'review_tasks')` **保留为 (a) 判定式的 OR 一支**（**不是替换**）⇒ **admin 仍可 `review`（`:1884`）/ `cancel`（`:1908`）**（**零回归**）。**判负**：**若实现把 admin 通道删掉 / 降级（改键 / 去闸）⇒ 判负**（违 `R-8-25①`）。

**（d）`disputed` 状态与仲裁的关系（写死）**：

- **`disputed` 已在闭合集内 + 相应边已在白名单内**（`0013:100` / `0013:60-70`：`submitted → disputed`、`disputed → {settled, cancelled}`）—— **本册不新增状态值、不动闭合集**（`R-8-23③`）。
- **现取无任何路由把 `job.status` 迁到 `disputed`**（姊妹册 `§27.2(b)③`）⇒ **平台仲裁动作口 `POST /api/admin/arbitration/:jobId` = 唯一把 job 迁入 / 迁出 `disputed` 的平台侧动作面**（`R-8-25②` = 平台仲裁兜底）。
- **两通道分工（写死）**：**① 雇主自审 / admin 兜底**（`/api/job/:jobId/review` · `:1884`）= 常规验收（`submitted` 态：`approve ⇒ settle` / `reject ⇒ refund`（`to_status='rejected'`）），**不经 `disputed`**；**② 平台仲裁**（`/api/admin/arbitration/:jobId`）= **争议兜底**（`disputed` 态：`approve ⇒ disputed→settled`（支持雇主）/ `reject ⇒ disputed→cancelled`（退单 / 支持打工人）），**落仲裁台账**（姊妹册 §28.6 `0027`）。

### 25.7 ★★ 「真生效」四段判据（**按变体 Ⅱ 细化** · 每段自带判负 · 不得只验「后台能存」）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**四段 = ① 后台审 → ② 库内落值（表 / 列）→ ③ 业务读口取数（`文件:行`）→ ④ 行为随之（改动前 / 改动后两读数）**；**每段必须能判负**。**★ 不得只验「后台能存」**（**「审核 `POST` 返回 `200`」= 零证据**）。**★ 本单不实跑**（零库连接）⇒ 判据**已写死、未实跑**（§25.11）。

| 段 | 读数内容（必给 · **按 Ⅱ**） | **判负形态（必带）** |
|--:|---|---|
| **① 后台审** | **动作口** `POST /api/admin/listing/:listingId/takedown`（商品）/ `POST /api/admin/arbitration/:jobId`（招工）+ 闸 `requireAdmin(req,res,'review_tasks')` + 请求体（逐字）+ 响应（status + `data` 键集） | **缺闸 / 闸降级（非 `review_tasks`）⇒ 判负**；**响应 `data` 键集 ≠ 冻结键集 ⇒ 判负** |
| **② 库内落值** | **商品** = 表 `public.listing_review_log`（`listing_id` / `actor_uid` / `result` / `memo` / `txid`〔`NULL`〕/ `time_created`；**审一次恰 1 行**）+ 表 `public.listing` 列 `status`（**Ⅱ = 通过时走既有边 `listed→delisted`/`listed→frozen`；驳回时不变**）；**招工** = 表 `public.job_arbitration_log`（**恰 1 行**）+ 表 `public.job` 列 `status`（走既有边）+ **资金腿** `job_escrow_refund` ×2 | **★ 「审核 / 仲裁动作成功而台账无行 ⇒ 判负」**（正向）；**★ 反向：「台账有行而审核动作未成功 / 无提交 ⇒ 判负」**；**表 / 列处该值未随之变 ⇒ 判负**（「后台能存但库内没落」）；**招工退单无 `job_escrow_refund` 腿 ⇒ 判负** |
| **③ 业务读口取数** | **商品** = `transitionListingStatus`（`listing-service.ts:286`；闸 `:302`/`:305`）+ `buyListing`（`listing-funds-service.ts:191`）读 `listing.status`；**DB 直取** = `SELECT status FROM listing WHERE listing_id = …`。**招工** = `acceptApplication`（`job-service.ts:208`）/ `job_post_event`（`0013`）；**DB 直取** = `SELECT status FROM job WHERE job_id = …` | **业务读口取到的仍是旧值 ⇒ 判负**（「库内有新值但业务不读」= 判负；后台读口 ≠ 业务读口） |
| **④ 行为随之** | **同一个可直接观察的业务量** —— **商品**：未审 / 已冻结商品**不可购买**（`POST /api/listing/:listingId/buy` 前置闸 `buyListing`：非 `listed` ⇒ 拒）；**招工**：争议 / 未审招工**不可承接**（`POST /api/job/:jobId/accept` 前置闸 `acceptApplication`：非 `open` ⇒ 拒）—— **改动前 / 改动后两读数** | **改动后该业务量不变 ⇒ 判负**；**只给改动后单读数 ⇒ 判负**；**「审核通过 / 下架」后商品仍可购买 / 「未审」招工仍可承接 ⇒ 判负** |

**（a）总判据（写死 · 机读形态）**：**① 四段齐全**（缺任一段 ⇒ 判负）；**② ②段必须给表名 + 列名**（不得只写「已保存」）；**③ ③段必须给业务侧取数的 `文件:行` 锚**；**④ ④段必须给「改动前 / 改动后」两读数且为同一业务量**；**⑤ 每段各带判负形态**；**⑥ 负对照（门自证）**：把任一段读数改成常量 ⇒ 该门**必须转红**（**不转红 = 假门**）。

**（b）执行面（写死 · 按 `R-8-15` / `R-8-18`）**：**凡涉状态改写 / 资金腿的一切取证一律「事务内 + `ROLLBACK`」**（造 `listing`/`job` 行 / 写两台账 / 读 `ledger_entry`，**取证后事务整体回滚**，**生产库零净写**）；**★ 真 HTTP 写面（真 POST 审核 / 仲裁）** 若跑须**先证「恢复路径可逐字节复原」**，否则**禁跑真写**（`§5.197` 口径）；**行为验收只许 DB 直造 + 读库**，**不得**为验收新增路由、**不得**以两读口承载验收读数（`R-8-6` 双向判负）。

### 25.8 ★ 审计面与对账（**`R-8-3` 落实 · 本片两台账与既有四张表的并联关系**）

**（a）本片两台账与既有表的并联关系（写死 · 照 `R-8-3`）**：

| 表（现取） | 列数 | 含 `txid`? | 与本片台账的关系 |
|---|---|---|---|
| `0017` `currency_status_log` | 7 | ❌ | 币种侧状态日志（**不同资源**）—— 并联轴上的旁支 |
| `0023` `admin_ops_audit_log` | 15 | ✅（成功 = 回执 `txid`；拒绝行 = `NULL`） | 积分调账审计 |
| `0024` `admin_refund_audit_log` | 13 | ✅（同上） | 退款审计 |
| `0025` `currency_review_log` | 8 | ❌（8④ 无资金腿） | 自建单位审核台账 |
| **本片 `0026` `listing_review_log`** | 9 | ✅ 列在 · **本轴恒 `NULL`**（商品无分录 · 见 (c)） | 商品合规审核台账 |
| **本片 `0027` `job_arbitration_log`** | 9 | ✅（**成功行 = 回执 `txid`**；拒绝行 = `NULL`） | 招工仲裁台账 |

> **并联读取轴（写死）**：以 `ledger_entry` 为主轴**左联**各表（**只读**）—— **不合并表 / 不迁移**；**来源表作可见列**；**拒绝行可见**（统一呈现归 **8⑥ 审计台** · `R-8-3` 已裁）。

**（b）对账判据（逐字 · 写死）**：**每条 admin 动作必须能锚到 `ledger_entry` 的 `txid`**（**只对 `result='applied'` 行生效**）；**拒绝行 `txid = NULL` 为显式豁免**（**写死防假红**）。

**（c）★ 本片两条路径的锚账口径（写死 · 防假红）**：

- **商品 `takedown`（`0026`）**：商品下架 / 冻结**无账务分录**（`DL59`：「商品发布不收费」；`ledger.spec` ②商品无「下架」账务动作）⇒ 商品合规行 `txid` **恒 `NULL`** ⇒ **属 (b) 的显式豁免**（**不得因商品行无 `txid` 判红**）。
- **招工 `arbitration`（`0027`）**：仲裁强制退单**有资金腿** `job_escrow_refund` ×2（`data-layer.spec.md:509`）⇒ 成功行 `txid` **必须 = 该回执 `txid`**，且该 `txid` 必须能在 `ledger_entry` 逐条对上（**对不上 ⇒ 判负**）；拒绝行 = `NULL`（豁免）。

### 25.9 后台页数据契约与四语文案面（**本册只给契约与命名空间 · 不写实现**）

**（a）页面定位**：新增管理后台页（命名依实现单；现取 `frontend/src/pages/admin/**` = **10 页** —— `CurrencyReviewPage` / `FeeRatePage` / `PermissionsManagement` / `PointsManagement` / `ReferralWeightMatrixPage` / `RewardsManagement` / `ShardsManagement` / `SystemSettings` / `TasksManagement` / `UsersManagement` —— **无商品合规页 / 无招工仲裁页**）。

**（b）页面数据契约（字段 → 来源）**：承 `§24.8(b)`（**`§24.8` 行体一字未动**）—— 商品页 / 招工页字段**来源 = §25.2 读口 `data` 同键**；**审核决定**（决定字段 + 原因）**来源 = §25.2 动作口**，**字段名 = 待实现单 / Zang 定**（**本册不发明决定字段名**）。

**（c）★ 命名空间约定（写死 · 不得自拟新风格）**：承既有 `admin*` 前缀先例（`admin_panel` / `adminNav` / `adminLayout` / `adminCommon` / `adminTasks` / `adminRewards` / `adminPermissions` / `adminPoints` / `adminShards` / `adminSettings` / `adminUsers` / `adminFeeRate` / `adminWeightMatrix` / `adminCurrencyReview`）⇒ **本片新增命名空间 = `adminListingReview`（商品合规）+ `adminArbitrationReview`（招工仲裁）**（词根 = 既有域词 `listing` / `arbitration`）；**四语（`zh`/`en`/`hk`/`vn`）必须逐键齐**（缺任一语 ⇒ 判负）；**★ 键名 = 待实现单按本条约定落**（本单只给约定 + 命名空间，**不发明键名清单 / 不写四语文案值**）。

**（d）★ 禁工程口径泄漏六类（写死 · 可判负 · 逐字承 §19.5(c) / 姊妹册 §28 / `§24.8(d)`）**：**用户可见文案**（`t(...)` 的**值**面）**不得**出现：① 本册 / 姊妹册**章节号 / 条号**（例 `§25.4` / `R-8-25` / `DL59`）；② **HTTP 状态码**（`409` / `403` / `423`）；③ **接口路径 / 方法**（`/api/admin/listing/:listingId/takedown` / `POST`）；④ **内部批次名 / 单号**（`8⑤` / `P6` / `JING-SPEC-B8-5R`）；⑤ **机读码 / 裸 i18n 键**（`LEDGER_CURRENCY_INVALID_TRANSITION` / `adminListingReview.title`）；⑥ **表名 / 列名 / 函数名**（`listing_review_log` / `job_arbitration_log` / `job_status_transition_ok`）。
- **判负形态（写死）**：对四语 locale 的 `adminListingReview*` / `adminArbitrationReview*` 键值做**正则扫描**（命中六类任一模 = **判负**）；**负对照** = 人为把一条文案改成 `"审核（§25.4）"` ⇒ **扫描必须转红**（**不转红 = 假门**）。
- **★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写四语文案内容**；**★ 工程口径可现于 `message` 日志面**（承 §3.3 条款 9′ / §15.5）。

**（e）页面 → 权限 → 路由（写死 · 与 §25.5 一致）**：两页 = `requiredPermission="review_tasks"`（+ 面板入口 `dashboard_access`）；**先例逐字** = `frontend/src/App.jsx:243`。**★ 前端路由行号 = 待实现单现取**（本单零代码）。

### 25.10 本单待办登记（**交「接该面的实现单」· 收口情况标注**）

| # | 待办（承 `§24.9`） | 归属 | 本单收口 |
|--:|---|---|---|
| **I-1** | `R-8-8` 附带条件裁决（`takedown` 独立动作面 ⇒ 是否需独立权限键） | ~~Zang~~ | **★ 已收口**：`R-8-24` = 批准、键 = `review_tasks`（不新造键） |
| **I-2** | 审核闸三变体选型（Ⅰ / Ⅱ / Ⅲ） | ~~Zang~~ | **★ 已收口**：`R-8-23` = 取 Ⅱ；Ⅰ/Ⅲ = 不采纳 |
| **I-3** | 招工审核方现取冲突收口（`§5-C7`「雇主审」vs 现取 admin 闸） | ~~Zang~~ | **★ 已收口**：`R-8-25`/`R-8-26` = 按 D5 双通道（§25.6） |
| **I-4** | 路径 B 子路径定名（`/api/admin/arbitration/*` 子段 + 动作口） | ~~Zang / 实现单~~ | **★ 已收口**：`R-8-27` = 动作口 `POST /api/admin/arbitration/:jobId`（候选人 / 标的物走 body 显式字段） |
| **I-5** | 决定字段名 / 新表名 / 新列名 / 迁移文件编号 | Zang + 新迁移（**需授权 apply**） | **表名 / 列 / 编号已收口**（`0026`/`0027` · 姊妹册 §28.6）；**决定字段名 + 请求体形态 = 待实现单 / Zang** |
| **I-6** | 读口 / 动作口实现（注册点 71 → 75）+ 两后台页 + 四语文案 | 实现单 | 待实现 |
| **I-7** | 判负门落地（§25.3 两路径判负 + ≥6 入参 + §25.9(d) 六类泄漏正则 + 负对照） | 实现单 / 质检单 | 待实现 |

### 25.11 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **读口 / 动作口 HTTP 实跑两态** | **未实现**（本单为规范单、零代码 / 零库 / 零 HTTP）⇒ 判据**已写死、未实跑** |
| 2 | **四段判据的判负实跑** | 同上（归实现单 + 质检单） |
| 3 | **注册点增量 72–75 的实际落盘** | **未实现** ⇒ 无读数（**不得**填「已 75」；本单只冻结应然值） |
| 4 | **两新表（`0026`/`0027`）的 apply 落盘 / 现库结构** | **未实现**（**零迁移 · 零 DDL · 零 apply**；本册只冻内容 = 姊妹册 §28.6） |
| 5 | **`listing` / `job` 各 `status` 分布 / 两台账现库行数** | **零库连接**（红线）⇒ 无读数 |
| 6 | **`review`/`cancel` 归属支的拒绝 `reason` 取值 / 决定字段名** | **待实现单 / Zang**（本册冻结形态与既有闭集，**不发明字面**） |
| 7 | **两后台页字段级实现面 / 四语键名清单** | **页面尚未存在**（现取 `frontend/src/pages/admin/**` = 10 页，无合规审核页） |

### 25.12 交付声明 / 只追加自证 / 行号漂移表 / 纪律自检（**v2.10 新增 · 本节只追加**）

**25.12.1 声明（写盘范围 · 逐条）**：本单**只写 6 个文件** —— `docs/route-layer.spec.md`（**就地升 v2.10** = 顶部状态块区**新增 v2.10 块〔4 行，插在 v2.9 要点之后、`v1.1 一页纸` 锚行之前〕** + **§25〔新〕**）+ `docs/versions/route-layer.spec.v2.10.md`（**新建** · `cmp` = 0）+ `docs/audit/route-layer-v2.10-delta.md`（**新建**）+ **同批姊妹册** `docs/data-layer.spec.md`（**就地升 v0.17** = 顶部状态块**新增 1 行** + **§28〔新〕**）+ `docs/versions/data-layer.spec.v0.17.md`（**新建** · `cmp` = 0）+ `docs/audit/data-layer-v0.17-delta.md`（**新建**）。**未碰**：`backend-ts/**` / `frontend/**` / **`migrations/**`（不得新建迁移文件 · 不得 apply）** / `docs/seafood.master-plan.md` / `docs/qa/**` / `docs/audit/**` 既有件 / `docs/design/**` / 其它 spec。**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**启停 5787 / 5788。

**25.12.2 ★ 行数口径（承 §24.11.2 · 写死）**：本册 **`wc -l` = 换行符数**（末行 `---` **不带换行**）⇒ **逻辑行 = `wc -l` + 1**；**凡报行数必须注明用的是哪一种**。**★ 追加手法（写死）**：本册末行无换行符 ⇒ **一切追加一律插在末行 `---` 之前**；姊妹册（data-layer）末行**带换行符** ⇒ **直接追加于末行之后**（0 删除行）。

**25.12.3 行号漂移（诚实登记 · 可复算）**：本版共 **两处新增**（均在既有行**之间 / 之末**插入、零删除）：**(i)** 状态块 **+4 行**（在 `§0` 之前）⇒ 影响 `§0` 之后一切；**(ii)** §25 本节 **+N 行**（在末行 `---` 之前）⇒ **末行 `---` 行号整体后移**；**册内既有引用行锚（如 §24.x）一律以「基线 `:N` ⇒ 本版现取 `:N+k`」两件引**（`R-8-14` 口径）。

**25.12.4 纪律自检（逐条对照硬口径与派单纪律）**：① **只追加 / 删除列 = 0** ✅（见 delta §D0）｜② **`difflib` 独立复核 0 replace / 0 delete** ✅｜③ **快照 `cmp` = 0** ✅｜④ **旧快照零改动** ✅（route `v0.1`–`v2.9` **二十九个** + data-layer `v0.1`–`v0.16` **十六个**，一字未动；本单**新建** = `v2.10.md` + `data-layer.spec.v0.17.md`）｜⑤ **零代码 / 零迁移 / 零库写 / 零 HTTP / 零套件** ✅｜⑥ **未发明项** ✅（**表名 / 列 / 类型 / 约束 / 索引逐项溯源自 `0023`/`0024`/`0025`·姊妹册 §28.6；状态值溯自 `0013`/`0015` `CHECK`；权限键逐字三真源；`job_arbitrate` 键逐字溯自 `data-layer:509`**；**决定字段名 / 请求体字段名 / 归属支 reason 字面 / 数值 / 日期 / 文案值**一律未发明，标「待实现单 / Zang / `NOT_MEASURED`」）｜⑦ **未 `git add/commit/push` / 未 `npm install` / 未碰 `.env*` / 未 `pkill`·`killall` / 未启停 5787-5788** ✅｜⑧ **未测项 = `NOT_MEASURED` + 原因** ✅（§25.11；无 0 / 无空 / 无占位）｜⑨ **不确定处不二选一** ✅（**变体已由 `R-8-23` 定 = Ⅱ**；**决定字段名 / 请求体字段名** 一律「登记 + 待裁」）｜⑩ **报数带口径** ✅（行数双口径 + 字节 + md5 + `numstat`）｜⑪ **引用纪律** ✅（本节全部引用**现取且逐字**；代码锚注明「本单现取时点」）。

### 25.13 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法更新（**旧文一字未动**） |
|---|---|
| **`§24`（8⑤ 冻结 · 三变体未择一）** | **★ 读法更新 = 由 `R-8-23` 定案取 Ⅱ**（本案）；**`§24` 各行行体一字未动** |
| **`§24.1(c)2` / `§24.9 I-3`（招工审核方冲突）** | **★ 兑现**：`R-8-25`/`R-8-26` 按 D5 双通道收口（§25.6）；**其行体一字未动** |
| **`§24.2`（两路径读写口契约 · 候选）** | **★ 兑现**：4 路由成裁定（§25.2）；`§24.2` 行体一字未动 |
| **`§24.3`（通过 / 驳回判负 + ≥6 入参）** | **★ 按 Ⅱ 细化**：§25.3 落实；`§24.3` 行体一字未动 |
| **`§24.4`（注册点 71 → 75）** | **★ 兑现**：§25.4 逐字登记；`§24.4` 行体一字未动 |
| **`§24.5`（权限键映射 + `R-8-8` 附带条件停报）** | **★ 兑现 + 收口**：附带条件由 `R-8-24` 裁准（键仍 `review_tasks`）；`§24.5` 行体一字未动 |
| **`§24.6`（真生效四段模板）** | **★ 按 Ⅱ 细化**：§25.7 落实；`§24.6` 行体一字未动 |
| **`§24.7`（审计面并联对账 · 拒行豁免）** | **承 + 坐实**：§25.8 + 商品 `txid` 恒 `NULL`；`§24.7` 行体一字未动 |
| **`§24.8`（后台页 `adminListingReview` / `adminArbitrationReview` + 六类）** | **承**：§25.9；`§24.8` 行体一字未动 |
| **`§23`（8④ 裁定落册） / `§19.4` / `§19.5(c)`** | **承 + 复用**：读写口 / 注册点 / 四段模板 / 六类禁项写法逐字承；**三节正文一字未动** |
| **`§17.5`（审计台并联对账 · `R-8-3`）** | **承**：§25.8 把两台账纳入并联轴 + 对账判据（含拒绝行 `txid=NULL` 豁免 + 商品无分录豁免）；**`§17.5` 正文一字未动** |
| **`§4.5` 幂等键总表 / `DL36` / `DL93`** | **承**：两动作口 `ops:` 键（商品 `listing_takedown` / 招工 `job_arbitrate` · **既有逐字**）；读口无键；**行体一字未动** |
| **`§1.8`（已实现·未注册清单） / `R-8-6`** | **承**：两读口 + 两动作口属「功能需求」⇒ 须注册；行为验收**只许 DB 直造 + 读库** |
| **`data-layer.spec` v0.17 §28** | **同批姊妹册**：其 §28.1–§28.10 = **五条裁定逐字 + 状态机 / 载体 / 留痕 / 迁移内容契约（`0026`/`0027`）**正文；**本册只承载 route 侧** |
| **`ledger.spec` `R3` / `R5` / §14.1（33 码）** | **只读引用**（风险面 / 错误码闭集）—— **本单未改其一字** |


## §26 ★★ v2.11 · 批 9 第 1 片（P9①）契约冻结：**后台可配置面** —— 四大角色文案覆盖层（中/越）读写口 + 实时生效机制 + P9 配置写口复用（形态 B · 键级寻址 · 注册点不动）+ 权限键映射 + 真生效四段判据 + 后台页契约与四语文案面（**v2.11 新增 · 本节只追加 · 依据 = Zang `§5.217` D 派单（`docs/seafood.master-plan.md:1440`）+ Kevin 三答（同文件 `:1424-1426`）+ `R-9-6` / `R-9-8`（同文件 `:1429-1430`）；键面 / 库面正文 = 姊妹册 `data-layer.spec` v0.18 §29；键面机制正文 = 本册 §17 / §18 / §19 / §20 / §21**）
> **★ 标题口径（诚实登记）**：本标题（及 §26.2 小节标题）的「（中/越）」= **`R-9-8` 原口径**；经 **`R-9-8` 范围更正**（§26.12）= **四语**（`zh` / `en` / `hk` / `vn`）⇒ **以 §26.12 为准**（守「只追加 · 删除列 = 0」⇒ 不改标题文本）。

> **★ 本节硬约束（写死 · 五条）**：**(i)** **不得发明** 路径 / 状态码 / 权限键 / 决定字段名 / 请求体字段名 / 数值 / 四语文案值（一律「候选」「待裁」或 `NOT_MEASURED`）；**(ii)** **不得新造第二套写入面** —— P9 配置写**一律复用** `POST /api/admin/settings`（姊妹册 §21.2 `AG2`）；**(iii)** **只有「配置改」才新增注册点**，且**必须逐字登记**增量（`R-8-14` 型锚口径）；**(iv)** **六类禁漏**（§26.6）**用户可见文案**一律不得命中；**(v)** **只追加**（本节插于本册末行 `---` 之前；顶部只新增 1 个状态块）。
> **★ 本节与姊妹册同批给同一组变体，不择一**（择一 = Zang/Kevin 裁定）。

### 26.0 本节性质（与 §17–§25 的关系，先说清）

§17–§18 = `app_config` 写口准入 + 载体键名约定；§19 = 8②（费率 / 权重）；§20 = 8③（保证金）；§21 = `app_config` 键级寻址线格式（含 `R-8-17` 更正块）。**本节 = 同一机制的「P9 扩展面」**：① **角色文案覆盖层读写口 + 实时生效机制 + 注册点增量**；② **P9 配置写口复用声明**（形态 B · `ops:` · 注册点不动）；③ **权限键映射**；④ **真生效四段判据**（含 ①③④ 段，② 段见姊妹册 §29.6）；⑤ **后台页契约 + 四语文案面 + 六类禁漏**。**`§17`–`§25` 表体与正文一字未动**。

### 26.1 现取锚（本单开工时点 · 逐条给 `文件:行` / 命令）

| # | 项 | 锚 / 命令 | 现取读数（逐字） |
|--:|---|---|---|
| 1 | **配置写口** | `backend-ts/src/index.ts:1157` / `:1158` / `:1162` | `app.post('/api/admin/settings', …)` / 闸 `requireAdmin(req, res, 'manage_settings')` / `ops:` 键 = `resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings')`（**第 4 实参现取仍写死 `'system_settings'`** ⇒ `O-3` 归 8③b 实现单；本片**不改**） |
| 2 | **配置读口** | `backend-ts/src/index.ts:1155` | `app.get('/api/admin/settings', …)`（闸 `manage_settings`） |
| 3 | **形态 A/B 判别 + `AV1`–`AV5` + `ops:` 派生** | 本册 §21 + 姊妹册 §24 | 见姊妹册 §29.4（本节**逐字承**，不重抄） |
| 4 | **`reason` 稳定常量集** | `backend-ts/src/database.ts:84-91` | `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` / `SETTING_TYPE_INVALID` / `SETTING_VALUE_NOT_OBJECT`（**零新增**） |
| 5 | **权限键（唯一真源 · 应恰 11 键）** | `backend-ts/src/database.ts:11-23` `ALL_ADMIN_PERMISSIONS` | `dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · **`manage_settings`** · `review_tasks` ⇒ **恰 11 键** ✅ |
| 6 | **注册点（锚定口径）** | `grep -nE "^app\.(get\|post\|put\|patch\|delete)\(" backend-ts/src/index.ts`（**排除注释行**） | `get 31 / post 41 / put 0 / patch 1 / delete 2` = **75** ✅（裸字面 **76**；差 1 = `:790` 块注释行，承 `C-10` 教训） |
| 7 | **i18n 框架与语言码** | `frontend/src/i18n.js:7-10` / `frontend/src/utils.js:47` | 四语 `zh/en/hk/vn`；`SUPPORTED_LANGS = ['zh','en','hk','vn']`；**越南语码 = `vn`**（**不是 `vi`**）；`fallbackLng: 'zh'` |
| 8 | **四语顶层命名空间数** | `python3 -c json.load`（各 `frontend/src/locales/{zh,en,hk,vn}.json`） | 各 **108** 个顶层键（**四册相等**）✅ |
| 9 | **角色名键现值（★ 现取证实 / 推翻）** | `grep -oE "悬赏家\|工人\|店家\|顾客\|Poster\|Worker\|Seller\|Buyer" frontend/src/locales/*.json` | **无四角色专用名称键**：`悬赏家` / `店家` / `顾客` / `Poster` **全 0**；`工人`（`zh.json` 1 处）系 `"acceptOk":"已选定打工人"` **子串**；`Buyer` / `Seller`（`en.json:746-747` `thBuyer` / `thSeller`）为**商品统计表头**、`colOwner`（`:920`）为商品卖方（**非 P9 四角色**）⇒ **盘点件「角色名键不存在」= 证实** ✅ |
| 10 | **`content_translation` 适用面** | 姊妹册 `data-layer.spec` §19 / `0021:27` | = **UGC**（`job` / `listing` / `user.bio` / `currency.name`；`lang ∈ {en,vn,hk}`，**`zh` 是源语言永不入表**）⇒ **角色名非 UGC，不能复用** |
| 11 | **既有 `admin*` 命名空间先例** | `frontend/src/locales/zh.json` | `admin_panel` / `adminNav` / `adminLayout` / `adminCommon` / `adminTasks` / `adminRewards` / `adminPermissions` / `adminPoints` / `adminShards` / `adminSettings` / `adminUsers` / `adminFeeRate` / `adminWeightMatrix` / `adminCurrencyReview` / `adminListingReview` / `adminArbitrationReview`（**不得自拟新风格**） |

### 26.2 角色文案覆盖层（中/越）：读写口契约 + **实时生效机制** + 注册点增量 + 前端页数（三变体 · **不得自选**）

> **需求锚（逐字）**：§1 L12 / §7.1 L130「**修改后前端实时生效**」；**Kevin 拍板**（`§5.217` A `:1424`）「在 i18n 之上叠一层『后台可编辑覆盖层』（DB 存覆盖值 + 实时生效；**不改四语文件风格**）」；`R-9-8`（`:1430`）「`route-layer.spec §19.5` 需加**勘误块**（『角色名可经覆盖层改』为 i18n 纪律的**唯一例外**）」；**★ 覆盖层本次只启用**两类**（`R-9-10` 扩展 · `R-9-8` 范围更正）：**(甲) 四角色名（四语 `zh`/`en`/`hk`/`vn`）**；**(乙) 站点标语（四语）** —— 一律「**文案键 × 四语**」，**无「部分语言」特例**；详 §26.11 / §26.12**（`§5.217` C-3 `:1438` 原口径「仅角色名 zh/vn」已作废）。
> **★ i18n 优先级（写死 · 三变体共用）**：**覆盖值 > locale 文件**；某语言无覆盖 ⇒ **回落 locale 基值**；**绝不空串**（承 `route-layer.spec` §10.1「读侧载荷恒有值、永不空串」同旨）。
> **★ 失败回滚（写死 · 三变体共用）**：**写失败** ⇒ `400` + **R107 单形状**（§15）+ `reason` 稳定常量 ⇒ **不变更、不静默**（`AG4`）；**读取失败** ⇒ **fail-closed 到 locale 基值**（`source='locale'`）。

**变体 Ⅰ —— 覆盖层 = `app_config` 合法键（候选 `role_names`）· 公开读口新增**

| 项 | 取值 / 代价 |
|---|---|
| **载体** | 姊妹册 §29.3 变体 Ⅰ（`app_config` 键 `role_names` · 零迁移） |
| **写口** | `POST /api/admin/settings`（**形态 B 信封** `{"key":"role_names","value":{…}}`；闸 `manage_settings`；`ops:<uid>:setting:role_names`）—— **注册点 +0** |
| **★ 实时生效机制** | **新增公开读口** `GET /api/role-names`（候选路径 · **待裁**）⇒ **注册点 +1（75 → 76）**；前端在**应用初始化** + **语言切换**时取该读口，与 i18n resources **合并（覆盖值优先）** ⇒ **改动后下次取数即新值**（**不本地持久缓存**；或读口响应带 `updated_at` 供失效判据）。**失败** ⇒ 回落 locale |
| **与 i18n 优先级** | 覆盖值 > locale（**逐字需求**） |
| **注册点增量** | **写口 +0**；**读口 +1**（`75 → 76`）⇒ **须逐字登记**（`R-8-14` 锚口径） |
| **前端页数** | **1 页**（后台「角色文案」页）+ **0 页**（用户面 = 既有渲染点接覆盖值，不新增页面） |
| **代价（归纳）** | ✅ 零迁移 · 与 8① 单一真源一致；❗ 读口新增 ⇒ 注册点 +1 · **公开读口**须定义缓存 / 失效；❗ 键名与读口路径**待裁** |

**变体 Ⅱ —— 覆盖层 = 新表（`role_name_override`）· 专用读口**

| 项 | 取值 / 代价 |
|---|---|
| **载体** | 姊妹册 §29.3 变体 Ⅱ（新表 · **需新迁移 + 需 Zang 授权 apply**） |
| **写口** | **★ 不得新开业务写路由**（否则破 `AG2`）⇒ 仍**复用** `POST /api/admin/settings`（**注册点 +0**）**或**另裁专用写口（**若非裁自开 ⇒ 即判负**） |
| **★ 实时生效机制** | **新增专用读口** `GET /api/role-names`（候选）⇒ **注册点 +1（75 → 76）**；前端取数 / 合并 / 失效口径同 Ⅰ |
| **与 i18n 优先级** | 覆盖值 > locale |
| **注册点增量** | 写口 +0（若复用）/ 读口 **+1** |
| **前端页数** | **1 页** |
| **代价（归纳）** | ✅ 表结构语义清晰；❗ **需新迁移 + 授权 apply**；❗ **引入第二套配置载体**（与 `app_config` 单一真源分叉）；❗ `DL75` 三件套 / `DL156` 豁免须重新登记 |

**变体 Ⅲ —— 复用 `content_translation` / 纯静态 locale（发版）⇒ 逐条判「不采纳」**：Ⅲ-a 复用 `content_translation`（**口径不符**：UGC 译文 · `zh` 永不入表 · 无 `entity_type` 面）；Ⅲ-b 纯静态 locale + 发版（**违「实时生效」**）。**理由逐字见姊妹册 §29.3。**

**★ 变体小结（不择一）**：**Ⅰ / Ⅱ 均可满足「DB 存覆盖值 + 实时生效 + 不改四语文件」**；差在**载体**（键值 vs 新表 · 零迁移 vs 需迁移）与**读口注册点**（两者均 +1，若 Ⅰ/Ⅱ 均需新公开读口）。**★ 若某案**复用**既有公开读口（如 `GET /api/home`）承载覆盖值 ⇒ **注册点 +0**，代价 = **耦合既有端点契约**（登记为第三条子案 · 待裁）。**择一 = Zang/Kevin。**

**★ i18n 基键（不写文案值 · 只给契约）**：四角色需**新增 i18n 基键**（承载覆盖层基值）——**命名空间候选** = **`roleNames`**（键 = `poster` / `worker` / `seller` / `buyer`，**四语必须逐键齐**；`zh` / `en` / `hk` / `vn` 各 4 键）；**文案「值」= 产品 / 文案决策 ⇒ 本单不写**（承 `§19.5` 先例）。**★ 覆盖层启用四语（角色名 = 四语 · `R-9-8` 更正：原写 zh/vn 已作废）；四语键集必须相等，缺语 ⇒ fail-closed 回落 locale**。**★ `R-9-10` 扩展**：**站点标语（四语）亦入覆盖层** —— 基键 = 既有 `siteTitle`（**拆键后仅品牌名**）/ 新 `siteSlogan` / 既有 `slogan`（四语齐）；命名空间承 `admin*` 先例（候选 `adminSiteText`）；详 §26.11 / §26.12。

### 26.3 P9 配置写口契约（**复用 · 注册点不动**）

| 项 | 冻结值 |
|---|---|
| **唯一写口** | `POST /api/admin/settings`（**复用** · **不新造第二套写入面** · 姊妹册 §21.2 `AG2`） |
| **请求形态** | **形态 B 信封** `{"key":"<合法键名>","value":{…}}`（P9 所有新增键**一律**走形态 B；形态 A 行为**逐字不变**） |
| **键级寻址** | `ops:<admin_uid>:setting:<目标键名>`（`<目标键名>` = 解出的目标键；**必先过 `AV1`**；**不得泄漏未校验串**） |
| **校验叠加** | `AV1` → `AV2` → `AV3` → `AV4` → `AV5`（**层序写死 · 短路** · 姊妹册 §24.2） |
| **错误面** | `400 LEDGER_AMOUNT_INVALID` + `reason` 稳定常量（**闭集 33 不增不减 · 零新增常量**）；**R107 单形状**（§15） |
| **注册点** | **75 → 75（本片配置写口零新增）** ✅ |
| **权限键** | `manage_settings`（写口 / 读口同键） |
| **不参与项** | **费率 / 权重不进 `app_config`**（真源 = `commission_policy` · 本册 §19 / 姊妹册 §21.1 表注释逐字）；P9 的 **6 层权重配比** 走**既有** `POST /api/admin/commission_policy`（闸 `manage_settings` · 本册 §19.2）|

### 26.4 权限键映射（**11 键闭集内选 · `R-8-1` 零新增 / 零删除**）

> 现取（逐字 · §26.1-5）：`ALL_ADMIN_PERMISSIONS` = **恰 11 键**（见 §26.1-5）。

| 本片权限面 | → 既有键 | 锚 / 理由 |
|---|---|---|
| 配置键写口（`POST /api/admin/settings`） | **`manage_settings`** | `index.ts:1158`（§26.1-1） |
| 配置键读口（`GET /api/admin/settings`） | **`manage_settings`** | `index.ts:1155` |
| 角色文案覆盖层**写口** | **`manage_settings`** | 同写口（§26.3） |
| 角色文案覆盖层**公开读口**（用户面） | **无闸（公开读）** | 角色名 = UI 文案，须无鉴权取用；**与写口分离** |
| 后台页（角色文案页 / 数值配置页） | **`manage_settings`**（+ `dashboard_access` 进面板） | 承 §19.3 先例 |
| 6 层权重配比（`POST /api/admin/commission_policy`） | **`manage_settings`** | 承 §19.3（§26.1 现取） |

> **★ `R-8-1` 履约**：**零新增键 / 零删除键**（11 键逐字不动）。**无「找不到合适键」⇒ 无需停报**；若后续确遇无合适键 ⇒ **停报 Zang**（**严禁新增** · 本片**未触发**）。

### 26.5 「真生效」四段判据（①后台写 → ②库内落值 → ③业务读口取数 → ④行为随之 · **每段自带判负**）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**不得只验「后台能存」**（「`POST` 返回 200」= **零证据**）。**②段（库面）正文本册同批见姊妹册 §29.6**；**①③④ 段正文如下**；**取证一律事务内 + `ROLLBACK`**（承 `R-8-15` / `R-8-18`）。

| 段 | 读数内容（必给） | 现取锚 / 口径 | 判负形态（必带） |
|---|---|---|---|
| **① 改键（后台写）** | 写口路径 / 方法 / 闸 / 请求体（**形态 B 逐字**：`{"key":"<目标键名>","value":{…}}`）/ `ops:` 键 / 响应（status + `data` 键集） | `index.ts:1157` / `:1158` / `:1162`（§26.1-1） | 缺闸 / 闸降级 ⇒ 判负；**未过 `AV1`–`AV5`**（未知键被静默吸收 / 类型不符回落默认值）⇒ 判负；**形态 A 行为出现任何差异** ⇒ 判负 |
| **② 库内落值** | **表 `public.app_config` + 列 `key` / `value` / `updated_by` / `time_updated`**；**改动前 / 改动后两读数** | 见姊妹册 §29.6（本单已给真库只读读数）；写落点 = `saveSystemSettings` | 写成功但库值未变 / 无该行 ⇒ 判负 |
| **★③ 业务读口取数** | **业务侧取数点的逐字锚（`文件:行`）+ 读数**：**角色文案** ⇒ 覆盖层公开读口（候选 `GET /api/role-names`，`文件:行` 待实现单）；**数值键** ⇒ 对应业务读口（如签到路由 / 铸造路由取 `batt_policy` / `checkin_policy`，`文件:行` 待 P9②–⑤ 实现单） | 候选读口 + P9 各片业务读口 | **业务读口取到的仍是 locale 基值 / 兜底常量** ⇒ 判负（「库内有新值但业务不读」）；**只给后台读口（HTTP）当业务读口** ⇒ 判负 |
| **★④ 行为随之** | **同一可直接观察的业务量**；**改动前 / 改动后两读数**：（角色文案）前端渲染的四角色文案 `locale 基值 → 覆盖值`；（数值键）对应业务量（如签到到账 batt / 铸造消耗 batt） | 前端渲染点 + P9 各片业务量 | **改动后该业务量不变** ⇒ 判负；**只给改动后单读数** ⇒ 判负 |

- **（b）机读总判据（承 §20.4(c) 六条 · 本册不改其条文）**：① 四段齐全；② ②段必给**表 + 列 + 该行取值**；③ ③段必给**业务侧 `文件:行`**；④ ④段必给**改动前 / 改动后两读数且同一业务量**；⑤ **每段各带判负形态**；⑥ **负对照（把任一段读数改成常量 ⇒ 该门必须转红；不转红 = 假门）**。
- **（c）执行面（写死 · 与 §19.4(e) / §20.4(d) 同口径）**：**实跑只许 DB 直造 + 读库**（直改 / 直造 `app_config` 键行 + `SELECT` 业务读口取数）；**不得**为验收新增 HTTP 路由、**不得**以任何后台读口承载验收读数。**★ 本单不实跑**（规范单 · 零代码）⇒ 判据**已写死、未实跑**（§26.7）。

### 26.6 后台页契约 + 四语文案面 + **禁工程口径泄漏六类**

**（a）后台页数据契约（写死）**：P9① 后台**新增页**（**角色文案页**：字段 = 四角色 × `zh` / `vn` 覆盖值 + 「保存」；**★ `R-9-10` 站点标语页**（候选命名空间 `adminSiteText`）：字段 = 三键 `{siteTitle, siteSlogan, slogan}` × 四语 + 「保存」；数据源 = 覆盖层写口 / 读口）；**数值配置** ⇒ **复用**既有 `adminSettings` 页承载（**+0 页**）**或**另开 1 页（**+1**）—— **两案代价**：复用 ⇒ 页数最小、与既有 settings 同源；另开 ⇒ 语义清晰、页数 +1。**总前端页数 = 2 页（角色文案 + 站点标语 · 复用数值）或 3 页（数值另开）**。

**（b）四语命名空间（只给契约 · 不写文案值）**：
- **后台页命名空间（候选 · 承既有 `admin*` 先例 · 不得自拟新风格）**：**`adminRoleNames`**（角色文案页）+ **复用 `adminSettings`**（数值配置 · 若复用页）；若另开数值页 ⇒ 候选 **`adminEconomyConfig`**（词根取自 P9 域词 `batt` / `checkin` / `invite` —— **须 Zang 确认词根**）。
- **用户可见角色名基键命名空间（候选）**：**`roleNames`**（键 = `poster` / `worker` / `seller` / `buyer`；**四语必须逐键齐**；缺任一语 ⇒ 判负）。
- **★ `R-9-10` 站点标语面（候选 · 承 `admin*` 先例）**：后台页命名空间候选 **`adminSiteText`**（站点标语页 · 承载 `siteTitle` / `siteSlogan` / `slogan` 四语覆盖值）；**用户面基键** = 既有 `siteTitle`（**拆键后仅品牌名**）/ **新增 `siteSlogan`** / 既有 `slogan`（**四语齐**）。**覆盖层可改 i18n 键 = 显式三键 `{siteTitle, siteSlogan, slogan}` × 四语**（**禁任意键** ⇒ 姊妹册 §29.12(d)）。**文案「值」= 产品 / 文案决策 ⇒ 本单不写**。
- **★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写**（登记 §26.8 `J-1`）。

**（c）★ 禁工程口径泄漏六类（写死 · 可判负）**：**用户可见文案**（`t(...)` 的**值**面，含 `adminRoleNames*` / `roleNames*` / `adminSettings*` 新增键）**不得**出现：① 本册 / 姊妹册**章节号 / 条号**；② **HTTP 状态码**；③ **接口路径 / 方法**；④ **内部批次名 / 单号**；⑤ **机读码 / 裸 i18n 键**；⑥ **表名 / 列名 / 函数名**（如 `app_config` / `role_names` / `AV1` / `saveSystemSettings`）。
- **判负形态（写死）**：对四语 locale 的新增键值做**正则扫描**（命中六类任一模 = **判负**）；**负对照** = 人为把一条文案改成 `"角色名（§26.2）"` ⇒ **扫描必须转红**（**不转红 = 假门**）。**登记 = §26.8 `J-2`**。

### 26.7 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **覆盖层三变体的实跑**（HTTP 读写 + 前端实时生效两读数） | **本单为规范单、零代码** ⇒ 四段 + 每段判负**已给**；**HTTP / 前端读数 = `NOT_MEASURED`**（归 P9① 实现单 + 质检单） |
| 2 | **P9 配置键写入后的实际响应体 / `ops:` 键形态** | **未实现** ⇒ **无读数**（冻结值，非实测值） |
| 3 | **公开读口路径（`GET /api/role-names`）与注册点增量** | **待裁**（变体择一 / 复用既有读口 ⇒ +0）；**本单不发明路径** ⇒ 未测 |
| 4 | **四语文案「值」** | **产品 / 文案决策 ⇒ 本单不写**；无值可测 |
| 5 | **四角色 i18n 基键现值** | 现取 = **不存在**（§26.1-9）⇒ **无对象可测**（新增由实现单 / 文案单落） |
| 6 | **覆盖层（含站点标语 `site_text_overrides`）的实跑 + `document.title` 实时生效两读数** | **规范单 · 零代码**（`R-9-10`⑥）⇒ `NOT_MEASURED`（归 P9① 实现单 + 质检单） |
| 7 | **`index.html:8` 改中性占位后的实测回退标题** | **未改代码**（规范单）⇒ 无读数（`R-9-10`④ · 方案 = §26.11④） |

### 26.8 待办登记（交「P9① 实现单 / 文案单 / 质检单」· 本册不实现）

| 条目 | 待办 | 依据 |
|---|---|---|
| **`J-1`** | **四语文案「值」**（角色名基键 4×4 + 后台页文案） | §26.6(a)(b)；承 §19.5 / §20 先例 |
| **`J-2`** | **六类禁漏扫描门落地**（四语 locale 新增键值正则 + 负对照） | §26.6(c) |
| **`J-3`** | **覆盖层读口路径 + 注册点增量**（变体择一后定：新公开读口 `+1` / 复用既有 `+0`） | §26.2；`R-8-14` |
| **`J-4`** | **`O-3` 闭合**（`index.ts:1162` 写死的 `'system_settings'` ⇒ 改为按解出的目标键派生） | §26.1-1；姊妹册 §24.3 |
| **`J-5`** | **i18n 勘误块**（`§19.5` 加注「角色名可经覆盖层改 = i18n 纪律的**唯一例外**」） | `R-9-8`（`:1430`） |
| **`J-6`** ★（`R-9-10`⑤） | **测试断言随动订正**：`frontend/src/test/unit/theme-shell-isomorphism.test.jsx:261-276` 的「`siteTitle` 为硬编码站名」+ `toBe('Seafood 海鲜市场｜加密人自己的「闲鱼」')` + `html` 的 `<title>` 断言 ⇒ **订正期望值**（拆键后 `siteTitle` = 品牌名 / `index.html` = 中性占位）；**不得删断言** | `R-9-10`⑤；§26.11⑤ |
| **`J-7`** ★（`R-9-10`⑥） | **`document.title` 接覆盖层**：`App.jsx:124-130` 的 `document.title = t('siteTitle')` 须改为「**覆盖值 > locale**」取数（并覆盖 `siteSlogan` / `slogan` 若入 `title` / 页面展示） | `R-9-10`⑥；§26.11⑥ |
| **`J-8`** ★（`R-9-10`④） | **`index.html:8` 静态 `<title>` 改中性占位 + JS 立即覆盖** | `R-9-10`④；§26.11④ |
| **`J-9`** ★（`R-9-10`③） | **覆盖层显式白名单判负门**（禁任意 i18n 键 · 三键闭集 · 四语闭集） | `R-9-10`③；姊妹册 §29.12(d) |
| **`J-10`** ★（`R-9-8` 更正④） | **四语键集相等门 + 缺语 fail-closed**：四角色名新键四语齐（`zh`/`en`/`hk`/`vn`）；缺任一语 ⇒ 回落 locale + **机读 reason**；**零 CJK 纪律**（`en`/`vn`） | `R-9-8` 更正④；§26.12④ |
| **`J-11`** ★（`R-9-11`④） | **门不得误判**：「`vn` 含拉丁字母」≠「未翻译」；`vn` 与 `en` 逐字相同 = **合法、非缺陷**（零 CJK 纪律仍满足） | `R-9-11`④；§26.12⑨ |

### 26.9 指纹自证（**本册不内嵌自身 md5，防自指**）

- **改前（v2.10）** = **`wc -l` = 5993**（换行符数）/ **逻辑行 = 5994**（末行 `---` 无换行）/ **1238266 B** / sha256 **`a42da95e0a9bfbcaa2a77f0db635c73796ff7f9c763475a41e0b7861ca1e006c`**（开工现取 · **= 派单对锚逐字相符** ✅）。
- **改前快照 = `docs/versions/route-layer.spec.v2.10.md`**（**开工前既存、本单未动**；**旧快照 30 件一字未动**）。
- **改后（v2.11）** = **`docs/versions/route-layer.spec.v2.11.md`**（**与本册逐字节相同**，`cmp` ⇒ **退出码 0**；命名依本册约定「快照取 **新版本号** + 改后正文」）。
- **只追加自证**：**§26 插于本册末行 `---` 之前**（**末行无尾换行** ⇒ 插行 0 删除行）；**顶部新增 1 个状态块（3 行 + 空行）**（⇒ 其后全部行号 +4）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**；`difflib` 独立复核 **0 replace / 0 delete**。

### 26.10 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法（**旧文一字未动**） |
|---|---|
| **§17 / §18（`app_config` 写口准入 / 载体键名）** | **承**：P9 配置写**复用**同写口（§26.3）；**该两节表体一字未动** |
| **§19.3 / §19.5（权限键映射 / 后台页六类禁漏）** | **复用**：§26.4 逐类承；§26.6(c) 逐类承；**`§19.5` 正文一字未动**（`R-9-8` 勘误块 = §26.8 `J-5`，**新增加注**，不重写） |
| **§20（8③ 保证金）/ §21（键级寻址）** | **承**：形态 B / `ops:` / `reason` 常量逐字复用；**表体一字未动** |
| **§25（v2.10 · 注册点 71 → 75）** | **承**：P9① **配置写口零新增** ⇒ **注册点仍 75**；**`§25` 正文一字未动** |
| **`data-layer.spec` v0.18 §29** | **同批姊妹册**：其 §29.2–§29.5 = **P9 数值项配置键全表 / 角色文案覆盖层数据层侧 / 8① 机制衔接 / 小数位契约**正文；**本册只承载 route 侧** |
| **`R-9-6` / `R-9-8`** | **依据（只读引用）**：`docs/seafood.master-plan.md:1429-1430` |
| **`§10.1` / `§10.2`（UGC 翻译线）** | **只读引用**：角色名 / 站点标语**非 UGC** ⇒ **不触 `content_translation`**（§26.1-10） |

### 26.11 ★ `R-9-10` 追加登记（覆盖层范围扩展 = 角色名（`zh`/`vn`）+ 站点标语（四语）· **只追加 · 不改本节以上任何已写内容**）

> **裁定锚**：Zang `R-9-10`（口径追加 · 只追加、不得改写已落内容）。**本节 = 该裁定的 route 侧落位**（数据层侧见姊妹册 §29.12）。

**（a）范围扩展**：覆盖层（§26.2 变体 Ⅰ/Ⅱ 承载）**对象 = 两类** —— **(甲) 四角色名（四语 · `R-9-8` 更正：原写 zh/vn 已作废 ⇒ 见 §26.12）**；**(乙) 站点标语（四语）**；**本次只启用**以上两类（**不得**扩为「任意 i18n 键」）；**一律「文案键 × 四语」，无「部分语言」特例。**

**（b）★ 现取（逐字 · 本单亲读 · route / 前端面）**

| 项 | 现取读数（逐字） | 锚 |
|---|---|---|
| `siteTitle`（复合串 = 品牌名｜标语） | `zh` = `Seafood 海鲜市场｜加密人自己的「闲鱼」` / `en` = `Seafood｜The crypto crowd's own flea market` / `hk` = `Seafood 海鮮市場｜幣圈人的跳蚤市場` / `vn` = `Seafood｜Chợ đồ cũ của dân crypto` | `frontend/src/locales/{zh,en,hk,vn}.json` |
| `slogan`（既有独立键 · 四语齐） | `zh` = `财富如海，智者善游，来这里做一条真正的锦鲤。`（余三语见姊妹册 §29.12(b)） | 同上 |
| **`document.title` 唯一运行时写入点** | `:130` `document.title = t('siteTitle')`（`:120-121` 注释「**浏览器标签标题（document.title）的唯一运行时写入点**；单一真源是 locale 文件里的 siteTitle」） | `frontend/src/App.jsx:124-130` |
| **静态回退标题（硬编码）** | `:8` `<title>Seafood 海鲜市场｜加密人自己的「闲鱼」</title>`（`:7` 注释「**回退标题**：仅用于 i18n 启动前 / 无 JS / 爬虫抓取；真源是 `src/locales/*.json` 的 `siteTitle`，运行时由 `App.jsx` 的 `DocumentTitle` 按语言覆盖」） | `frontend/index.html:8` |
| **测试断言（现取 · 待订正）** | `:261` `it('四语 locale 文件可解析、键集合相同、siteTitle 为硬编码站名', …)` + `:266` `expect(tables[0].siteTitle).toBe('Seafood 海鲜市场｜加密人自己的「闲鱼」')` + `:274` `expect(html).toContain('<title>Seafood 海鲜市场｜加密人自己的「闲鱼」</title>')` + `:276` `expect(app).toContain("document.title = t('siteTitle')")` | `frontend/src/test/unit/theme-shell-isomorphism.test.jsx:261-276` |

**（c）★ 实时生效机制须覆盖 `document.title` + 新标语键（写死 · `R-9-10`⑥）**：§26.2 的「前端取覆盖值 → 合并（覆盖值 > locale）」**必须**作用到 **`App.jsx:124-130` 的 `document.title` 写入点**（**改后 `document.title` = 覆盖层 `siteTitle` 值**；`siteSlogan` / `slogan` 若参与页面展示 / 标题，**一并接覆盖层**）。**判负**：覆盖层改了 `siteTitle` 而 **`document.title` 仍显示 locale 基值** ⇒ 判负（「库内有新值但运行时未接入」）；**只改页面展示、未改 `document.title`** ⇒ 判负。

**（d）已知边界 + 方案（`R-9-10`④）**：`frontend/index.html:8` 的静态 `<title>` 是**硬编码**（**非覆盖层真源** · 无 JS / 爬虫抓取时可见）⇒ **登记已知边界**；**方案 = 「改中性占位、由 JS 立即覆盖」**（占位候选 = `Seafood`；运行时由 `document.title` 写入点按「**覆盖值 > locale**」立即覆盖）。

**（e）测试连带（`R-9-10`⑤ · 期望订正 · 不得删断言）**：`theme-shell-isomorphism.test.jsx:261-276` 现取断言 **「`siteTitle` 为硬编码站名」** 及 `toBe('Seafood 海鲜市场｜加密人自己的「闲鱼」')` **必须随动订正**（拆键后 `siteTitle` 仅品牌名 + `index.html` 改中性占位后 `<title>` 断言字符串随动）⇒ **订正期望值、不得删断言**（登记 = §26.8 `J-6`）。

**（f）显式白名单（`R-9-10`③）**：覆盖层可改 i18n 键 = **显式三键 `{siteTitle, siteSlogan, slogan}` × 语言闭集 `{zh,en,hk,vn}`**（覆盖站点标语）；**禁**「任意 i18n 键皆可改」⇒ 判负（姊妹册 §29.12(d)）。

**（g）注册点 / 前端页数增量（承 §26.2）**：覆盖层**读口**（承载两类）**注册点增量** 同 §26.2（新公开读口 **+1** ⇒ `75 → 76`；复用既有读口 **+0**）；**写口复用 `POST /api/admin/settings` ⇒ +0**；**前端页数** 见 §26.6(a)（角色文案页 + 站点标语页 + 数值复用/另开）。

### 26.12 ★ `R-9-8` 范围**更正** + `R-9-11` `vn` **定案**（Kevin 2026-10-03 · **覆盖前条「角色名 zh/vn」与「`vn` 占位」的说法 · 以本条为准 · 只追加、不改本节以上已落内容**）

> **裁定锚**：Zang `R-9-8` 范围更正 + `R-9-11` 定案（Kevin 2026-10-03）。**route 侧落位**（数据层侧见姊妹册 §29.13）。**★ 原口径「四角色名 = `zh`/`vn`」与「`vn` 暂以英文占位」= 均作废。**

| # | 更正 / 定案（写死） | 锚 |
|--:|---|---|
| ① | **四角色名 = 四语（`zh` / `en` / `hk` / `vn`）**，**不是 `zh`/`vn`**；与 `R-9-10` `slogan` 四语一致 ⇒ **覆盖层一律「文案键 × 四语」，无「部分语言」特例** | 本条；§26.11(a) |
| ② | **四角色名在当前 locale 里「根本没有键」**（碎片 = `adminShards.thBuyer`/`thSeller` · `jobs.acceptOk` · `dashPage.roleAdmin`/`roleReviewer`/`roleStaff` · `adminCommon.colRole` · **语义不同 ⇒ 不得复用**）⇒ **四角色名 = 新增键**（命名空间候选 `roleNames` 四语齐）；覆盖层覆盖的是**新键** | 本单现取；§26.1-9 |
| ③ | **四语初值（定稿）**：`悬赏家` = `悬赏家` / `Poster` / `懸賞家` / `Poster`；`工人` = `工人` / `Worker` / `工人` / `Worker`；`店家` = `店家` / `Seller` / `店家` / `Seller`；`顾客` = `顾客` / `Buyer` / `顧客` / `Buyer` | 本条；`R-9-11`③ |
| ④ | **四语键集必须相等**；**缺语 ⇒ fail-closed 回落 locale 文件 + 机读 reason**（不得空串） | 本条；§26.2 优先级 / 失败回滚 |
| ⑤ | **入册键显式白名单**（**严禁**「任意 i18n 键皆可改」）—— 同 §26.11(f) | 本条；§26.11(f) |
| ⑥ | **实时生效须覆盖 `document.title`（`App.jsx:130`）与新键**；`index.html:8` 静态 `<title>` = 已知边界（中性占位 + JS 覆盖） | 本条；§26.11(c)(d) |
| ⑦ | **测试连带**：`theme-shell-isomorphism.test.jsx:261-276`「`siteTitle` 为硬编码站名」断言**须期望订正、不得删断言** | 本条；§26.8 `J-6` |
| ⑧ | **★ `vn` 文案 = 英文（`Poster`/`Worker`/`Seller`/`Buyer`）= 正式口径**（**撤销**前条「`vn` 占位」的说法）；**spec 与实现不得把 `vn` 文案当作「未定 / 缺口」** | `R-9-11`① ② |
| ⑨ | **`vn` 与 `en` 在同批角色名上逐字相同 = 合法、非缺陷** ⇒ **门 / 判据不得把「`vn` 含拉丁字母」误判为「未翻译」**（零 CJK 纪律仍满足）；**四语键集相等校验保留**（四语均有值 ⇒ 不触发 fail-closed）；**将来单改 `vn`（或任一语）走覆盖层，不影响其它语** | `R-9-11`④⑤⑥ |

> **★ route 侧含义（写死）**：i18n **新命名空间候选 `roleNames`**（四角色 × 四语 · 键集相等 · 缺语 fail-closed）；覆盖层（§26.2 变体 Ⅰ/Ⅱ）承载 `role_names` + `site_text_overrides`（**均四语**），并**接 `document.title` 与页面渲染**；**注册点** 见 §26.11(g)。

## §27 v2.12 ★★ 追补落册（P9①）：Kevin 术语更正（`R-9-12`：`Seller`/`Buyer` → **`Vendor`**/**`Customer`**）+ 我裁三个待裁项（`R-9-13`：载体取变体 Ⅰ · 公开读口 `GET /api/role-names` 注册点 `75 → 76` · 四项默认值）+ 更正块 + 术语统一待办登记 + 待办收口（**v2.12 新增 · 本节只追加 · 插在本册末行 `---` 之前 · 依据 = Zang `§5.222`（`docs/seafood.master-plan.md:1419-1443`）；route 侧正文 = 本册 §26；键面 / 库面正文 = `data-layer.spec` v0.19 §30**）

> **★ 标题口径（诚实登记）**：本标题（及 §26 / §26.2 标题）的「（中/越）」= `R-9-8` 原口径；经 `R-9-8` 范围更正 = **四语**（`zh`/`en`/`hk`/`vn`）⇒ **以四语为准**；**不改 §26 标题文本**（守「只追加 · 删除列 = 0」）。
> **本节硬约束（写死 · 四条）**：**(i)** **只追加**（本节插于本册末行 `---` 之前；顶部只新增 1 个状态块 = 3 行）；**(ii)** **★ 旧行一字不改** —— §26.2 / §26.6 / §26.7 / §26.8 / §26.11 / §26.12 既有行**逐字保留**，本节以**更正块**覆盖读法；**(iii)** **逐字照录** —— `R-9-12` / `R-9-13` 正文逐字照录 `master-plan §5.222` B/C，**不得改写**；**(iv)** **不得发明** 路径 / 数值 / 文案值。

### 27.0 本节性质（与 §26 的关系，先说清）

§26 = P9① 契约冻结（v2.11：覆盖层三变体 · 实时生效机制 · 配置写口复用 · 权限键 · 真生效四段 · 后台页 + 六类禁漏 · `R-9-10` / `R-9-8` 更正 / `R-9-11` 定案）。**本节 = 该冻结的「追补落册」**：① Kevin 术语更正（`R-9-12`）；② 我裁三个待裁项（`R-9-13`）；③ **更正块**（覆盖 §26.12 / §26.2 / §26.6 / §26.7 的旧读法 · 旧行一字不改）；④ **待办收口**；⑤ **术语统一待办登记**（另单）。**§26 表体与正文一字未动**（守「只追加 · 删除列 = 0」）。

### 27.1 ★ `R-9-12` 术语更正（逐字照录 · `master-plan §5.222` B · `:1423-1433`）

> **Kevin 更正（逐字 · `§5.222` A · `:1421`）**：「在角色定义中，不再使用 Seller 和 Buyer 这两个单词，而是使用 **Vendor 和 Customer**。」

**（a）逐字照录（`§5.222` B）**：

- **店家 = `Vendor`**（原 `Seller`）· **顾客 = `Customer`**（原 `Buyer`）；**悬赏家 `Poster` / 工人 `Worker` 不变**。
- **因 `vn` 沿用英文（`R-9-11`）⇒ `vn` 两列同改**。
- ⇒ **覆盖 §5.221 的 en/vn 两列**（**旧行保留**，本条**加注覆盖**，符合只追加纪律）。**四语初值定稿 v2**：

| 角色 | zh | en | hk | vn |
|---|---|---|---|---|
| 悬赏家 | 悬赏家 | Poster | 懸賞家 | Poster |
| 工人 | 工人 | Worker | 工人 | Worker |
| 店家 | 店家 | **Vendor** | 店家 | **Vendor** |
| 顾客 | 顾客 | **Customer** | 顧客 | **Customer** |

- **★ 连带登记（不擅自扩面）**：既有英文文案里含 `Seller`/`Buyer` 的键（现取：`adminShards.thSeller`/`thBuyer`（en Seller/Buyer）· `adminListingReview.colOwner='Seller'` · `listings.priceRoleNote='The seller sets the listed price…'` · `listings.ordersNote='…where you are the buyer…'` · `listings.refundNote='Only the seller can issue a refund…'`）⇒ **本次不改**（**不属「角色定义」面**），登记为**术语统一待办（另单，不阻塞）**。

**（b）route 侧落位（写死）**：

| 项 | 现行读法（依 `R-9-12`） | §26 旧行（**一字不改**） |
|---|---|---|
| `roleNames` 命名空间（§26.2 / §26.6(b)）`seller` 键 | `zh` 店家 / `en` **`Vendor`** / `hk` 店家 / `vn` **`Vendor`** | §26.12 表 ③ 原写 `en`/`vn` = `Seller` ⇒ **由本节更正块覆盖** |
| `roleNames` 命名空间 `buyer` 键 | `zh` 顾客 / `en` **`Customer`** / `hk` 顧客 / `vn` **`Customer`** | §26.12 表 ③ 原写 `en`/`vn` = `Buyer` ⇒ **由本节更正块覆盖** |
| `poster` / `worker` 键 | 不变（`Poster` / `Worker`） | 无 |
| **键名**（`poster`/`worker`/`seller`/`buyer`） | **不变**（i18n 键名 = 结构标识；`R-9-12` 只改**展示文案**） | 无 |
| **站点标语三键**（`siteTitle` / `siteSlogan` / `slogan`） | **不受术语更正影响** | 无 |

### 27.2 ★ `R-9-13` 三项裁定（逐字照录 · `master-plan §5.222` C · `:1435-1439`）

**（c）逐字照录（`§5.222` C）**：

1. **载体 = 变体 Ⅰ**（`app_config` 键 `role_names` + `site_text_overrides`）。**理由**：① **零迁移**（承 `R-8-4/R-8-5`「可配置一律走 `app_config`」）；② **不破 `AG2` 单一真源**（唯一写口 = `POST /api/admin/settings` 形态 B；`grep` 单点判据仍成立）；③ **白名单显式**（`APP_CONFIG_LEGAL_KEYS` 2 → 9）；④ **免费继承** `AV1–AV5` / `ops:<uid>:setting:<key>` / reason 稳定常量 / `DL76` 触发器。
   ⇒ **变体 Ⅱ（新表 `role_name_override`）不采纳**（需新迁移 + **引入第二套配置载体**、与单一真源分叉）；**变体 Ⅲ（复用 `content_translation` / 静态 locale 发版）不采纳**（口径不符 / 违「实时生效」）。
2. **读口 = 新增公开读口**（`GET /api/role-names` **候选路径**，**无鉴权** —— 角色名 = 全站 UI 文案）：**注册点 75 → 76 逐字登记**。⇒ **不采纳第三条子案**（复用 `GET /api/home` 承载）：会把文案面塞进**已冻结的首页键集** ⇒ 耦合更深、回归面更大。**读口须带 `updated_at`**（供增量/失效判据）；前端**不本地持久缓存**；**读取失败 ⇒ fail-closed 回落 locale 基值**（`source='locale'`）。
3. **四项默认值（我裁，均标「一句话可改」）**：`storageDecimals` = **4**（星级 0–5 保留 4 位；前端无小数展示）；`streakDay7RewardBatt` = **60**（第 1–6 天 30 batt / 第 7 天 60）；**`siteSlogan` 四语初值** = zh「加密人自己的「闲鱼」」/ en「The crypto crowd's own flea market」/ hk「幣圈人的跳蚤市場」/ vn「Chợ đồ cũ của dân crypto」（= 现 `siteTitle` 后半段**逐字**，我已现取）；**`siteTitle` 拆键后** = zh「Seafood 海鲜市场」/ en「Seafood」/ hk「Seafood 海鮮市場」/ vn「Seafood」。

**（d）route 侧落位（写死 · 逐条）**：

| 裁定 | route 侧落位 | 与 §26 既有行关系 |
|---|---|---|
| **载体 = 变体 Ⅰ** | 写口 = `POST /api/admin/settings`（**形态 B 信封**；闸 `manage_settings`；`ops:<uid>:setting:<目标键名>`）⇒ **注册点 +0**；**变体 Ⅱ 不采纳**（不引入第二套配置载体 / 不另开写路由以免破 `AG2`） | §26.2「三变体 · **不择一**」⇒ **由本条收口为 Ⅰ**（§26.2 行体一字未动） |
| **读口 = `GET /api/role-names`（无鉴权 · 公开读）· 注册点 `75 → 76` 逐字登记** | **现取注册点 = `75`**（`get 31 / post 41 / put 0 / patch 1 / delete 2` · 锚定口径，排除注释行）；本读口新增后 ⇒ **`get 31 → 32` ⇒ 总数 `75 → 76`**；读口**须带 `updated_at`**；前端**不本地持久缓存**；**读取失败 ⇒ fail-closed 回落 locale 基值**（`source='locale'`） | §26.2「（候选路径 · **待裁**）」/ §26.7-3「**待裁**」⇒ **由本条裁准**（见 §27.3 更正块 `C3`/`C5`） |
| **`storageDecimals` = 4 / `streakDay7RewardBatt` = 60** | **数据层侧登记**（姊妹册 §30.4 `W1`/`W2`）；本册**不重抄**键面条文 | §26 行体一字未动 |
| **`siteSlogan` 四语 / `siteTitle` 拆键后** | §26.11(b) 的「拆段值待文案单」⇒ **已定**（四语初值逐字 · 见本表 §27.2(c)-3）；`siteTitle` 拆键后 = zh「Seafood 海鲜市场」/ en「Seafood」/ hk「Seafood 海鮮市場」/ vn「Seafood」 | §26.11 行体一字未动（见 §27.4 `W4`） |

### 27.3 ★ 更正块（append-only · 覆盖 §26.12 / §26.2 / §26.6 / §26.7 的读法 · **旧行一字不改**）

> **★ 用法（写死）**：本表 = **现行读法唯一入口**；左列 = 被覆盖的旧行（**原文逐字保留在原处**），右列 = **以本表为准**的读法。**不删、不改任何旧行**（守「只追加 · 删除列 = 0」）。

| # | 被覆盖处（旧行 · 原文逐字保留） | 旧读法（留痕） | **★ 现行读法（以本表为准）** |
|--:|---|---|---|
| C1 | **§26.12 表 ③ 行**（`:6196`） | `店家` = 店家 / `Seller` / 店家 / `Seller`；`顾客` = 顾客 / `Buyer` / 顧客 / `Buyer` | `店家` = 店家 / **`Vendor`** / 店家 / **`Vendor`**；`顾客` = 顾客 / **`Customer`** / 顧客 / **`Customer`**（依 `R-9-12`） |
| C2 | **§26.12 表 ⑧ 行**（`:6201`）「`vn` 文案 = 英文（`Poster`/`Worker`/`Seller`/`Buyer`）」 | `vn` = `Poster`/`Worker`/**`Seller`**/**`Buyer`** | `vn` = `Poster`/`Worker`/**`Vendor`**/**`Customer`**（依 `R-9-12`；`vn` 仍 = 英文 = **正式口径**） |
| C3 | **§26.2 变体 Ⅰ「（候选路径 · 待裁）」（`:6036`）** + 「❗ 键名与读口路径**待裁**」（`:6040`） | 读口路径 **待裁** | **读口 = `GET /api/role-names`（无鉴权）· 注册点 `75 → 76`**（依 `R-9-13`-2） |
| C4 | **§26.6(b) 用户面基键「键 = `poster`/`worker`/`seller`/`buyer`」（`:6108`）** | 键名不变 | 键名**不变**；其 en/vn 文案 ⇒ `Vendor`/`Customer`（依 `R-9-12`） |
| C5 | **§26.7-3「公开读口路径（`GET /api/role-names`）与注册点增量 · 待裁」（`:6121`）** | 待裁 | **已裁**（`R-9-13`-2）：`GET /api/role-names`（无鉴权）· 注册点 `75 → 76` |

### 27.4 ★ 待办收口（旧行一字不改）

| # | 原待办（旧行 · 逐字保留 · 落点） | **定案（依 `R-9-13` · 均「一句话可改」）** |
|--:|---|---|
| W1 | 覆盖层**读口路径 + 注册点增量**「待裁」（§26.2 `:6036` / `:6040`；§26.7-3 `:6121`；§26.8 `J-3` `:6133`） | **已裁**：`GET /api/role-names`（无鉴权）· 注册点 `75 → 76`（依 `R-9-13`-2） |
| W2 | `storageDecimals` = `TODO: Kevin 定值` | **`4`**（**数据层侧登记** = 姊妹册 §30.4 `W1`；本册不重抄） |
| W3 | `streakDay7RewardBatt` = `TODO: Kevin 定值` | **`60`**（数据层侧 = 姊妹册 §30.4 `W2`） |
| W4 | `siteSlogan` / `siteTitle` 拆段值 = 「待文案单」（§26.11(b) `:6172`；§26.6(b) `:6109`） | **已定**（四语初值逐字 · 见 §27.2） |
| W5 | §26.8 `J-3`（覆盖层读口路径 + 注册点增量） | **收口**（= `W1`） |

### 27.5 ★ 术语统一待办登记（另单 · 不阻塞 · 逐键现值 + `文件:行`）

> **★ 声明（写死）**：下列键**含 `Seller`/`Buyer`**（英文口径），但**不属「角色定义」面** ⇒ **本次不改**（依 `R-9-12` 连带登记）；登记为**另单**（不阻塞 P9①）。**现取 = `frontend/src/locales/en.json`（`json.load` 逐键 + 行号 · 本单亲读）**。

| # | 键（route / 前端面命名空间） | 现值（`en` · 逐字） | `文件:行` |
|--:|---|---|---|
| T1 | `adminShards.thSeller` | `Seller` | `frontend/src/locales/en.json:747` |
| T2 | `adminShards.thBuyer` | `Buyer` | `frontend/src/locales/en.json:746` |
| T3 | `adminListingReview.colOwner` | `Seller` | `frontend/src/locales/en.json:920` |
| T4 | `listings.priceRoleNote` | `The seller sets the listed price; the platform does not change it for you.` | `frontend/src/locales/en.json:138` |
| T5 | `listings.ordersNote` | `Only orders where you are the buyer and payment is complete are shown here.` | `frontend/src/locales/en.json:150` |
| T6 | `listings.refundNote` | `Only the seller can issue a refund; enter the order id.` | `frontend/src/locales/en.json:158` |

- **★ 命名空间精确说明（防误伤）**：`colOwner` **同键两处** —— `adminListingReview.colOwner` = `Seller`（`:920` · **本表 `T3`**）与 `adminCurrencyReview.colOwner` = `Creator`（`:891` · **不含 `Seller`/`Buyer` ⇒ 不在本表**）。**不得**因同键而误改后者。
- **四语齐（同键四语均在 · `zh`/`en`/`hk`/`vn`）**：`thSeller` = 卖方 / `Seller` / 賣方 / `Người bán`（四语行号均 `:747`）；`thBuyer` = 买方 / `Buyer` / 買方 / `Người mua`（均 `:746`）；`adminListingReview.colOwner` = 发布人 / `Seller` / 發佈人 / `Người đăng`（均 `:920`）；`listings.priceRoleNote` / `ordersNote` / `refundNote` = 各自四语（行号 = 各语 `:138` / `:150` / `:158`）。**以上均属商品买卖方统计 / 口语口径，非 P9 四角色标签**（§26.12② 同旨）。

### 27.6 `NOT_MEASURED`（逐项 · 禁填 0 / 空）

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | `R-9-12` / `R-9-13` 的 HTTP 实跑（含 `GET /api/role-names` 注册点生效 · 读数 `75 → 76`） | **本单为规范单、零代码**；读口**未实现** ⇒ HTTP 读数 = `NOT_MEASURED`（归 P9① 实现单 + 质检单） |
| 2 | 覆盖层（`role_names` + `site_text_overrides`）写入后的响应体 / 前端实时生效两读数（含 `Vendor`/`Customer`） | **未实现** ⇒ 无读数 |
| 3 | 术语统一待办六个键的**批量改** | **另单、不阻塞** ⇒ 本单**未改**（`en.json` 逐字现值已登记 = §27.5） |

### 27.7 指纹自证（**本册不内嵌自身 md5，防自指**）

- **改前（v2.11）** = **`wc -l` = 6205**（换行符数）/ **逻辑行 = 6206**（末行 `---` 无换行）/ **1273466 B** / sha256 **`5b2f31b1ee9e21b461872920f36bf5930784f9ce24c621f14d1e10e8bfff1027`**（开工现取 · **= 派单对锚逐字相符** ✅）。
- **改前快照 = `docs/versions/route-layer.spec.v2.11.md`**（**开工前既存、本单未动**；**旧快照 31 件一字未动**）。
- **改后（v2.12）** = **`docs/versions/route-layer.spec.v2.12.md`**（**与本册逐字节相同**，`cmp` ⇒ **退出码 0**；命名依本册约定「快照取 **新版本号** + 改后正文」）。
- **只追加自证**：**§27 插于本册末行 `---` 之前**（**末行无尾换行** ⇒ 插行 0 删除行）；**顶部新增 1 个状态块（3 行 + 空行）**（⇒ 其后全部行号 +4）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**；`difflib` 独立复核 **0 replace / 0 delete**。

### 27.8 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法（**旧文一字未动**） |
|---|---|
| **§26.2（三变体 · 不择一 · 读口路径待裁）** | **★ 收口**：`R-9-13`-1 裁准 **变体 Ⅰ**；`R-9-13`-2 裁准读口 = `GET /api/role-names`（无鉴权）· 注册点 `75 → 76`（§26.2 行体一字未动） |
| **§26.6(b)（`roleNames` 命名空间 / 站点标语三键）** | **承 + 更正**：键名不变；`seller`/`buyer` 的 en/vn 文案 ⇒ `Vendor`/`Customer`（§27.3 `C4`） |
| **§26.7（`NOT_MEASURED`）** | **★ 收口**：其 3 项（读口路径 + 注册点增量）由 `R-9-13`-2 定；本轮**未实跑**（§27.6） |
| **§26.8（待办 `J-1`–`J-11`）** | **★ 收口**：`J-3`（读口路径 + 注册点增量）⇒ 已裁（§27.4 `W5`）；其余条目不涉 |
| **§26.11 / §26.12（`R-9-10` / `R-9-8` 更正 / `R-9-11` 定案）** | **承 + 更正**：四语范围 / 新增键 / 白名单 / 键集相等 / fail-closed / `document.title` 实时生效 **不变**；**仅 en/vn 两列**由 `R-9-12` 更正（§27.1 / §27.3 `C1`/`C2`） |
| **§25（v2.10 · 注册点 `71 → 75`）** | **承**：本片读口新增 ⇒ **注册点 `75 → 76`**（§27.2）；`§25` 正文一字未动 |
| **`data-layer.spec` v0.19 §30** | **同批姊妹册**：其 §30 = 本裁定的键面 / 库面落位（键值 / 白名单 / 待办收口）；**本册只承载 route 侧** |

## §28 ★★ v2.13 · 批 9 第 2 片（P9②）契约冻结：**batt 电量 + 签到 / 补签** —— 读口 / 动作口清单（预命名 + 逐口形态）+ 权限键映射（11 键内选）+ **注册点 `76 → N` 逐 verb 预登记** + 错误码（**既有闭集优先 · 零新增**）+ 错误形状 **R107** + 真生效四段判据（①③④ 段）+ 后台页契约与四语文案面 + 禁工程口径泄漏六类（**v2.13 新增 · 本节只追加 · 插在本册末行 `---` 之前 · 依据 = `docs/requirements/p9-four-role-economy.md` §4 逐字 + §7；已裁 `R-9-3` / `R-9-5` / `R-9-6`（`docs/seafood.master-plan.md:1815` / `:1817` / `:1789`）；键面 / 库面 / 值域 / 闸落点正文 = 姊妹册 `data-layer.spec` v0.20 §31；键面机制正文 = 本册 §17 / §18 / §21**）

> **★ 本节硬约束（写死 · 五条）**：**(i)** **不得发明** 路径 / 状态码 / 权限键 / 字段名 / 数值（一律「候选」「待裁」或 `NOT_MEASURED`）；**(ii)** **不得新造第二套写入面** —— P9② 配置写**一律复用** `POST /api/admin/settings`（本册 §21.2 `AG2` / 姊妹册 §24）；**(iii)** **只有「新面（读 / 动作口）」才新增注册点，且必须逐 verb 登记增量**（`R-8-14` 型锚口径）；**(iv)** **六类禁漏**（§28.6）**用户可见文案**一律不得命中；**(v)** **只追加**（本节插于本册末行 `---` 之前；顶部只新增 1 个状态块）。

### 28.0 本节性质（与 §17–§27 的关系，先说清）

§17–§18 = `app_config` 写口准入 + 载体键名；§19 = 8②；§20 = 8③；§21 = `app_config` 键级寻址线格式；§22–§25 = 8④ / 8⑤；§26–§27 = P9①（后台可配置面）。**本节 = P9②（batt 电量 + 签到 / 补签）的 route 侧契约**：① **读 / 动作口清单**（预命名 + 逐口形态）；② **权限键映射**（11 键闭集内选）；③ **注册点 `76 → N` 逐 verb 预登记**；④ **错误码**（既有闭集优先、零新增）+ **错误形状 R107**；⑤ **真生效四段判据**（①③④ 段 · ② 段见姊妹册 §31.6）；⑥ **后台页契约 + 四语文案面 + 六类禁漏**；⑦ **三变体（不择一）**；⑧ **判据分级 + 未测项**；⑨ **与 P9① / 8① 衔接**。**`§17`–`§27` 表体与正文一字未动。**

### 28.1 现取锚（本单开工时点 · 逐条给 `文件:行` / 命令）

| # | 项 | 锚 / 命令 | 现取读数（逐字） |
|--:|---|---|---|
| 1 | 上游对锚 | `git log --oneline -1` | **`a2a2d7c`**（= P9① 质检 PASS + 上线 + 生产终验 ✅） |
| 2 | 本册开工版本 / 规模 | `sed -n '3p' docs/route-layer.spec.md` / `wc -l` / `wc -c` / `md5 -q` / `shasum -a 256` | **v2.12 · `wc -l` = 6329（换行符数）/ 逻辑行 6330 / 末行 `---` 无尾换行**（详 §28.9） |
| 3 | **注册点（锚定口径 · 排除注释行）** | `grep -nE "^app\.(get\|post\|put\|patch\|delete)\(" backend-ts/src/index.ts` | **76**（`get 32 / post 41 / put 0 / patch 1 / delete 2`）—— P9① 已 `75 → 76`（`GET /api/role-names`，`index.ts:1161`）✅ |
| 4 | **配置写口** | `backend-ts/src/index.ts:1171` / `:1172` | `app.post('/api/admin/settings', …)` / 闸 `requireAdmin(req, res, 'manage_settings')`（**P9② 复用 · 注册点 +0**） |
| 5 | **配置读口** | `backend-ts/src/index.ts:1155`（一带） | `app.get('/api/admin/settings', …)`（闸 `manage_settings`） |
| 6 | **权限键（唯一真源 · 应恰 11）** | `sed -n '15,27p' backend-ts/src/database.ts` | `dashboard_access` · `manage_tasks` · `publish_tasks` · `manage_rewards` · `publish_prizes` · `read_users` · `manage_users` · `manage_points` · `manage_permissions` · **`manage_settings`** · `review_tasks` ⇒ **恰 11 键** ✅ |
| 7 | **`reason` 稳定常量集** | `backend-ts/src/database.ts:84-91`（`SETTINGS_WRITE_REASONS`） | `SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST` / `SETTING_TYPE_INVALID` / `SETTING_VALUE_NOT_OBJECT`（**零新增**） |
| 8 | **错误码闭集（33）** | `sed -n '853,891p' docs/ledger.spec.md` | **恰 33 码**；**本节零新增码** |
| 9 | **R107 统一错误形状** | `docs/ledger.spec.md:912`（`R107`）/ `:1136`（§14.4 `details` 形状表） | `{ "error": { "code", "message", "i18n_key", "details" } }`；`details` 只放非敏感上下文（**禁** SQL / 约束名 / 堆栈 / 表名 / 连接串） |
| 10 | **★ 承接任务的两个口（P9② 闸标的）** | `backend-ts/src/index.ts:1877` / `:1899` | `POST /api/job/:jobId/apply`（闸 `requireActor` · `workerUid` = token 侧 actor）/ `POST /api/job/:jobId/accept`（闸 `requireActor` · 雇主）；**两口均已有 · 本节只登记「加闸不改口」（注册点 +0）** |
| 11 | **★ P9② 现有面核查** | `grep -rin "batt\|checkin\|签到\|电量" backend-ts/src/index.ts` | **命中 = 0**（除 `app_config` 键面在 `database.ts`）⇒ **batt / 签到 / 补签 = 零路由 / 零读口 / 零动作口**（本单补的正是这一面） |
| 12 | **用户鉴权闸（用户面）** | `backend-ts/src/index.ts:1878`（`requireActor` 家族） | 用户动作口闸 = `requireActor`（登录用户本人；**非** `requireAdmin`）；**权限键面 = 「无 admin 键」**（§28.4） |
| 13 | **i18n 语言码 / 命名空间先例** | `frontend/src/locales/{zh,en,hk,vn}.json`（P9① 现取）/ 本册 §26.1-11 | 四语 `zh/en/hk/vn`；既有 `admin*` 命名空间（`adminSettings` / `adminRoleNames` …）**不得自拟新风格** |

### 28.2 ★★ 读口 / 动作口清单（**预命名 = 候选 · 逐口形态**）

> **口径（写死）**：**路径 = 候选**（依既有 REST 族名 / 资源词可复算）；**阄前须 Zang 批准路径**（承 `R-8-1`「找不到合适键 ⇒ 停下报裁、严禁硬造」同旨）；**逐口形态** = 闸 / 幂等键 / `data` 键集 / 幂等重放 / 错误面。**★ 「用户面」与「后台面」分离**：用户面闸 = `requireActor`（无 admin 键）；后台配置面复用既有口（§28.3）。

**(a) 读口（候选 2 口）**

| # | 路径（候选） | 方法 | 闸 | `data` 键集（候选） | 幂等 | 备注 |
|--:|---|---|---|---|---|---|
| **R1** | `/api/batt` | `GET` | `requireActor`（用户本人） | `batt` / `capBatt` / `floorBatt` / `acceptThresholdBatt` / `canAccept`（**派生布尔** · §28.7⑦） / `updated_at` | 读口不带键（`DL97`） | 取数源 = 姊妹册 §31.2(c) 草案 ① `batt_account` + `batt_policy`（**fail-closed 到常量**） |
| **R2** | `/api/checkin` | `GET` | `requireActor` | `streakDay` / `streakCapDays` / `checkedInToday`（**派生布尔**） / `canMakeup`（**派生布尔**） / `makeupCostUsd` / `updated_at` | 读口不带键 | 取数源 = 草案 ③`checkin_log` + ④`checkin_makeup_log` + `checkin_policy` |

**(b) 动作口（候选 2 口）**

| # | 路径（候选） | 方法 | 闸 | 幂等键（候选） | `data` 键集（候选） | 备注 |
|--:|---|---|---|---|---|---|
| **A1** | `/api/checkin` | `POST` | `requireActor` | `biz:checkin:<uid>:<checkin_day>`（**候选**；**日界待裁** ⇒ `<checkin_day>` 口径随 §31.4(e)） | `checkedIn` / `streakDay` / `rewardBatt` / `batt` | 幂等重放 ⇒ `200 { idempotent_replay: true, … }`（`DL98`/`R106`） |
| **A2** | `/api/checkin/makeup` | `POST` | `requireActor` | `biz:checkin:makeup:<uid>:<target_day>`（**候选**；**前缀 `biz:` vs `ops:` = `PENDING_ZANG`** · §31.4(d)） | `restoredStreakDay` / `costUsd` / `txid`（账本腿回执） | **有资金腿**（补签 100 `$` → `uid = −1`）；**掉 kind 未裁 ⇒ 不得实现**（§31.1 `PENDING_ZANG`） |

**（c）逐口形态口径（共用 · 写死）**

| 项 | 冻结值 |
|---|---|
| **鉴权** | 用户面 4 口全闸 `requireActor`（**用户本人**；`uid` 取自 token，**不得由客户端声明** —— 承 `0023:66` 手法） |
| **写入面** | **动作口 = 业务写入面**（写 `batt_account` / `checkin_log` / `checkin_makeup_log`）；**不是** `app_config` 写口（`app_config` **禁存余额** · 姊妹册 §31.9） |
| **配置面** | `batt_policy` / `checkin_policy` 的写**仍走** `POST /api/admin/settings`（形态 B · 闸 `manage_settings` · **注册点 +0**） |
| **幂等** | 写口必带键（`DL97`）；同键同指纹 ⇒ `200` 重放（`R106` 前端当成功）；同键异指纹 ⇒ `409 LEDGER_IDEMPOTENCY_CONFLICT`（`R52`） |
| **响应包装** | 成功 = `sendSuccess(res, data, message, 200)`（承现盘形态）；失败 = **R107 单形状**（§28.5） |
| **错误面** | **既有闭集优先、零新增**（§28.5）；**若确无合适码 ⇒ 标 `PENDING_ZANG`**（不得自造） |

> **★★ ★ Zang 裁定（`R-9-19`）· 4 新口逐字定案（2026-10-03）**
> **依据（逐字）**：`docs/seafood.master-plan.md` **§5.230 B** `R-9-19`：**变体 = Ⅰ（双表 · 4 张）** … ⇒ **注册点 `76 → 80`**（**4 新口**：`GET /api/batt` · `GET /api/checkin` · `POST /api/checkin` · `POST /api/checkin/makeup`）。
> **① 定案 4 口（写死 · 覆盖 §28.2 的「候选」字样）**：
> | # | 路径（**定案**） | 方法 | 闸 | 幂等键（**定案**） | `data` 键集 |
> |--:|---|---|---|---|---|
> | **R1** | **`/api/batt`** | `GET` | `requireActor`（用户本人） | 读口不带键（`DL97`） | `batt` / `capBatt` / `floorBatt` / `acceptThresholdBatt` / `canAccept` / `updated_at` |
> | **R2** | **`/api/checkin`** | `GET` | `requireActor` | 读口不带键 | `streakDay` / `streakCapDays` / `checkedInToday` / `canMakeup` / `makeupCostUsd` / `updated_at` |
> | **A1** | **`/api/checkin`** | `POST` | `requireActor` | **`biz:checkin:<uid>:<checkin_day>`**（日界 = **UTC 自然日** · `R-9-15`） | `checkedIn` / `streakDay` / `rewardBatt` / `batt` |
> | **A2** | **`/api/checkin/makeup`** | `POST` | `requireActor` | **`biz:checkin:makeup:<uid>:<target_day>`**（前缀 **`biz:` 定案** · `R-9-16`） | `restoredStreakDay` / `costUsd` / `txid` |
> **② 归属（写死）**：4 口**全闸 `requireActor`**（用户本人 · `uid` 取自 token，**不得由客户端声明**）；**配置写**仍走 `POST /api/admin/settings`（**+0**）。**§28.2 原候选表一字未改**，本块 = 就地定案读法。
> **③ A2 资金腿**：补签 100 `$` → `uid = −1`（**不真 burn** · `R-9-14`）；kind = **`checkin_makeup_fee`**（§31.1 的 `0028` 内容契约）。

### 28.3 P9② 配置写口契约（**复用 · 注册点不动**）

| 项 | 冻结值 |
|---|---|
| **唯一写口** | `POST /api/admin/settings`（**复用** · **不新造第二套写入面** · 本册 §21.2 `AG2` / 姊妹册 §24） |
| **请求形态** | **形态 B 信封** `{"key":"<合法键名>","value":{…}}`（`batt_policy` / `checkin_policy` **一律**走形态 B；形态 A 行为**逐字不变**） |
| **键级寻址** | `ops:<admin_uid>:setting:<目标键名>`（**必先过 `AV1`**；**不得泄漏未校验串**） |
| **校验叠加** | `AV1` → `AV2` → `AV3` → `AV4` → `AV5`（**层序写死 · 短路** · 姊妹册 §24.2） |
| **错误面** | `400 LEDGER_AMOUNT_INVALID` + `reason` 稳定常量（**闭集 33 不增不减 · 零新增常量**）；**R107 单形状** |
| **注册点** | **76 → 76（P9② 配置写口零新增）** ✅ |
| **权限键** | `manage_settings`（写口 / 读口同键） |
| **白名单** | `APP_CONFIG_LEGAL_KEYS` **已 9 键**（含 `batt_policy` / `checkin_policy`）⇒ **本节不再扩键**（`N = 9` 不变） |

### 28.4 权限键映射（**11 键闭集内选 · `R-8-1` 零新增 / 零删除**）

| 本片权限面 | → 既有键 | 锚 / 理由 |
|---|---|---|
| **用户面读口 R1/R2**（`GET /api/batt` / `GET /api/checkin`） | **无 admin 键**（用户本人 · `requireActor`） | 用户自己的电量 / 签到状态 ⇒ 登录即可读；**与后台面分离** |
| **用户面动作口 A1/A2**（签到 / 补签） | **无 admin 键**（用户本人 · `requireActor`） | 用户自己的动作；**与后台面分离** |
| **配置键写口**（`batt_policy` / `checkin_policy`） | **`manage_settings`** | `index.ts:1172`（写口同键 · §28.3） |
| **配置键读口**（`GET /api/admin/settings`） | **`manage_settings`** | `index.ts:1155`（读面同键） |
| **后台页（数值配置页）** | **`manage_settings`**（+ `dashboard_access` 进面板） | 承本册 §19.3 / §26.4 先例 |
| **★ 承接闸（`apply` / `accept`）** | **不改闸**（沿用既有 `requireActor`） | P9② **只在 SQL 内加电量闸**（姊妹册 §31.3(c)），**不动路由闸 / 不动权限键** ⇒ **零权限键变化** ✅ |

> **★ `R-8-1` 履约**：**零新增键 / 零删除键**（11 键逐字不动）；**无「找不到合适键」情形 ⇒ 无需停报**。**★ 备用**：若后续某面确无合适键 ⇒ 按 `R-8-1` **停报 Zang**（**严禁新增** · 本片**未触发**）。

> **★★ ★ Zang 裁定（落位确认）· 权限键映射（2026-10-03）**
> **口径（写死 · 承 §28.4 原表 · `R-8-1` 零新增 / 零删除）**：4 新口**零授权键新增** —— 用户面 R1/R2/A1/A2 **全闸 `requireActor`（无 admin 键）**；配置写 / 读（`batt_policy` / `checkin_policy`）仍落 **`manage_settings`**；后台页（数值配置）落 **`manage_settings`**（+ `dashboard_access` 进面板）；**承接闸（`apply` / `accept`）＝ 不改闸**（只在 SQL 内加电量闸 · 姊妹册 §31.3(c)）⇒ **11 键逐字不动 · 零增删**。**§28.4 原表体一字未改**。

### 28.5 ★ 注册点 `76 → N` 逐 verb 预登记（**写死 · 可判负**）+ 错误码 / 错误形状

**(a) ★ 注册点逐 verb 预登记**

| verb | 路径（候选） | 现取 | 应然（预登记） | 增量 |
|---|---|---|---|---|
| `GET` | `/api/batt`（R1） | — | +1 | 读口 |
| `GET` | `/api/checkin`（R2） | — | +1 | 读口 |
| `POST` | `/api/checkin`（A1） | — | +1 | 动作口 |
| `POST` | `/api/checkin/makeup`（A2） | — | +1 | 动作口（**有资金腿**） |
| **合计** | | **76**（`get 32 / post 41 / put 0 / patch 1 / delete 2`） | **76 → 80**（`get 34 / post 43`） | **+4** |

> **★ 注册点数的**变体**（详 §28.8）**：**变体 Ⅱ（折一读口）⇒ `76 → 79`**；**变体 Ⅲ（复用既有读口）⇒ `76 → 78`**。**⇒ 应然值随变体择一（`PENDING_ZANG`）。** 判负：**新增了口而注册点未逐字登记** / **登记数与 `grep` 实测数不符** ⇒ 判负（`R-8-14` 锚口径）。

**(b) ★ 错误码（**既有闭集优先、零新增** · 逐情形借码 + `reason` 稳定常量）**

| # | 情形 | HTTP | 借码（候选 · 既有 33 闭集） | `details.reason`（候选 · **稳定常量**） | 判负 |
|--:|---|---|---|---|---|
| E1 | **承接时电量 < 阈值（`apply` / `accept`）** | `409` | 「非法状态转移」族（候选 `LEDGER_CURRENCY_INVALID_TRANSITION` · `#11` `409` · 承 8⑤ 状态冲突借码手法） | 候选 `BATT_BELOW_ACCEPT_THRESHOLD` | 用 `400`（请求不合法）误导 ⇒ 判负（应为状态冲突 `409`） |
| E2 | **今日已签到（重复）** | `409` | 同上族 | 候选 `CHECKIN_ALREADY_DONE` | 静默吞掉重复 ⇒ 判负（`AG4` 同旨） |
| E3 | **同键异指纹** | `409` | `LEDGER_IDEMPOTENCY_CONFLICT`（`#4` · **既有**） | — | 返回 `200` ⇒ 判负 |
| E4 | **补签超每日上限（≥ `makeupDailyLimit`）** | `409` | E1 同族 | 候选 `CHECKIN_MAKEUP_DAILY_LIMIT` | — |
| E5 | **补签 `$` 余额不足** | `409` | `LEDGER_INSUFFICIENT_BALANCE`（`#1` · **既有**） | — | 返回 `400` ⇒ 判负（`R105` 逐字：余额不足 = `409`） |
| E6 | **缺幂等键** | `400` | `LEDGER_IDEMPOTENCY_KEY_REQUIRED`（`#5` · **既有**） | — | — |
| E7 | **键形状非法（前缀 / `#` / 控制字符）** | `400` | `LEDGER_IDEMPOTENCY_KEY_INVALID`（`#6` · **既有**） | `PREFIX_REQUIRED` / `RESERVED_SEPARATOR` / `CONTROL_CHARACTER`（**既有**） | — |
| E8 | **未登录** | `401` | 既有鉴权面（`requireActor`） | — | — |
| E9 | **DB `CHECK (batt BETWEEN 0 AND 100)` 被触发** | **`400`（必须转译）** | 既有 `LEDGER_AMOUNT_INVALID`（`#17` · `400`） | 候选 `BATT_OUT_OF_RANGE` | **裸 `500`** ⇒ 判负（承 `AV5` 容器转译纪律） |

> **★ 零新增码（写死）**：上表**全部借既有 33 码**；**新 `reason` 常量 = 「挂在既有 `code` 下的语义域」**（非新码，承 `AV4` 手法 · 本册 §21 / 姊妹册 §24.4 先例）。**★ 若某情形确无合适既有码 ⇒ 标 `PENDING_ZANG`**（**不得自造码** · 本片**暂未触发**；E1/E2/E4 的借码族与 `reason` 常量名 = 候选，**须 Zang 确认**）。

**(c) ★ 错误形状 = R107（逐字承）**：`{ "error": { "code": "<LEDGER_…>", "message": "<中文文案>", "i18n_key": "ledger.err.<CODE>", "details": { "reason": "<稳定常量>", … } } }`（`ledger.spec:912` `R107` + `:1136` §14.4）。
- **`details` 只放非敏感上下文**（`uid` / `threshold` / `got` / `day` 等）；**禁** SQL / 约束名 / 堆栈 / 表名 / 连接串（`R107` 逐字）。
- **判负**：`details` 出现 `batt_account` / `checkin_log` 等**表名** / 出现 SQL / 出现 `23514` 裸码 ⇒ **判负**（既是 `R107` 违例，也是**六类禁漏 ⑥**）。

> **★★ ★ Zang 裁定（`R-9-19`）· 注册点 `76 → 80` 逐 verb 定案（2026-10-03）**
> **依据（逐字）**：§5.230 B `R-9-19`：变体 Ⅰ ⇒ **注册点 `76 → 80`**（4 新口）。
> **① 逐 verb 定案（覆盖 §28.5(a) 的「应然（预登记）」列）**：
> | verb | 路径（**定案**） | 现取 | 应然（**定案**） | 增量 |
> |---|---|---|---|---|
> | `GET` | `/api/batt`（R1） | — | +1 | 读口 |
> | `GET` | `/api/checkin`（R2） | — | +1 | 读口 |
> | `POST` | `/api/checkin`（A1） | — | +1 | 动作口 |
> | `POST` | `/api/checkin/makeup`（A2） | — | +1 | 动作口（**有资金腿**） |
> | **合计** | | **76**（`get 32 / post 41 / put 0 / patch 1 / delete 2`） | **76 → 80**（`get 34 / post 43 / put 0 / patch 1 / delete 2`） | **+4** |
> **② 变体定案（覆盖 §28.5(a) 尾注 + §28.8 的「不择一」）**：**取变体 Ⅰ ⇒ `76 → 80`（定案）**；**变体 Ⅱ（折一读口）⇒ `79` 不采纳**；**变体 Ⅲ（复用既有读口）⇒ `78` 不采纳**（`R-9-19`）。**§28.5(a) 原表体一字未改**，本块 = 就地定案读法。
> **③ 判负（承 `R-8-14`）**：新增了口而注册点未逐字登记 / 登记数与 `grep` 实测不符 ⇒ 判负。

### 28.6 ★★ 「真生效」四段判据（①③④ 段 · **每段自带判负 · 不得只验「后台能存」**）

> **裁定锚（逐字 · P6 的 AC 原文）**：「**配置改动必须被业务层真实读取生效、非只在后台显示**」。**不得只验「后台能存」**（「`POST` 返回 200」= **零证据**）。**②段（库面）正文本册同批见姊妹册 §31.6**；**①③④ 段正文如下**；**取证一律事务内 + `ROLLBACK`**（承 `R-8-15` / `R-8-18`）。

| 段 | 读数内容（必给） | 现取锚 / 口径 | 判负形态（必带） |
|---|---|---|---|
| **① 改键（后台写）** | 写口路径 / 方法 / 闸 / 请求体（**形态 B 逐字**：`{"key":"batt_policy"\|"checkin_policy","value":{…}}`）/ `ops:` 键 / 响应（status + `data` 键集） | `index.ts:1171` / `:1172`（§28.1-4） | 缺闸 / 闸降级 ⇒ 判负；**未过 `AV1`–`AV5`**（未知键被静默吸收 / 类型不符回落默认值）⇒ 判负 |
| **② 库内落值** | **表 `public.app_config` + 列 `key`/`value`/`updated_by`/`time_updated`**；**改动前 / 改动后两读数** | 见姊妹册 §31.6（**数据层侧**）；写落点 = `saveSystemSettings` | 写成功但库值未变 ⇒ 判负（本册不重抄） |
| **★③ 业务读口取数** | **业务侧取数点的逐字锚（`文件:行`）+ 读数**：**配置键** ⇒ **业务读口**（R1/R2 的取数源 = `batt_account` + `batt_policy`（`batt_policy` 读点））**取值变了**；**或** 承接动作 `/api/job/:jobId/apply` 取 `acceptThresholdBatt` 的 `文件:行` | 候选读口 + 承接口（`文件:行` 待 P9② 实现单） | **业务读口取到的仍是兜底常量** ⇒ 判负（「库内有新值但业务不读」）；**只给后台读口（HTTP）当业务读口** ⇒ 判负 |
| **★④ 行为随之** | **同一可直接观察的业务量**；**改动前 / 改动后两读数**：把 `batt_policy.acceptThresholdBatt` 改大（如 9 → 50）⇒ **同一 `batt = 20` 的 worker 改动前可 `apply`（`200`）⇄ 改动后不可（`409`）**；把 `checkin_policy.baseRewardBatt` 改（30 → 40）⇒ **签到到账 batt 由 30 变 40** | 承接口 + 签到口 | **改动后该业务量不变** ⇒ 判负；**只给改动后单读数** ⇒ 判负 |

- **（b）机读总判据（承本册 §20.4(c) 六条 · 不改其条文）**：① 四段齐全；② ②段必给**表 + 列 + 该行取值**；③ ③段必给**业务侧 `文件:行`**；④ ④段必给**改动前 / 改动后两读数且同一业务量**；⑤ **每段各带判负形态**；⑥ **负对照（把任一段读数改成常量 ⇒ 该门必须转红；不转红 = 假门）**。
- **（c）执行面（写死 · 与 §19.4(e) / §20.4(d) / §26.5(c) 同口径）**：**实跑只许 DB 直造 + 读库**（直改 `app_config` 键行 + 直造 `batt_account` 行 + `SELECT` / 调业务口取数）；**不得**为验收新增 HTTP 路由、**不得**以任何后台读口承载验收读数。**★ 本单不实跑**（规范单 · 零代码）⇒ 判据**已写死、未实跑**（§28.10）。

> **★★ ★ Zang 裁定（落位确认）· 真生效四段判据（2026-10-03）**
> **口径（写死 · 承 §28.6 原表 · 每段自带判负）**：四段 = ① 改键（后台写 `POST /api/admin/settings` · 形态 B）→ ② 库内落值（`public.app_config` · 姊妹册 §31.6）→ ③ 业务读口取数（R1/R2 取数源 = `batt_account` + `batt_policy`；或承接口取 `acceptThresholdBatt` 的 `文件:行`）→ ④ 行为随之（改 `acceptThresholdBatt` 9 → 50 ⇒ 同一 `batt = 20` 的 worker `apply` 前 `200` ⇄ 后 `409`；改 `baseRewardBatt` 30 → 40 ⇒ 签到到账 batt 30 → 40）。**取证一律事务内 + `ROLLBACK`**（承 `R-8-15` / `R-8-18`）。**每段各带判负 + 负对照**（任一段读数改成常量 ⇒ 该门必须转红）。**本单不实跑**（规范单 · 零代码）⇒ 判据**已写死、未实跑**（§28.9）。**§28.6 原表体一字未改**。

### 28.7 后台页契约 + 四语文案面 + **禁工程口径泄漏六类** + 派生布尔

**（a）后台页数据契约（写死）**：P9② **新增 0 页**（**复用**既有 `adminSettings` 页承载 `batt_policy` / `checkin_policy` 的数值配置 —— **+0 页**）**或**另开 1 页（**+1** · 候选命名空间 `adminEconomyConfig`，词根取自 P9 域词 `batt` / `checkin`）—— **两案代价**：复用 ⇒ 页数最小、与既有 settings 同源；另开 ⇒ 语义清晰、页数 +1。**用户面 = 「电量卡」+「签到区」**（**既有渲染点接覆盖值 / 新取数**），**不新增独立页面**。

**（b）四语命名空间（只给契约 · 不写文案值）**：
- **后台页命名空间（候选 · 承既有 `admin*` 先例 · 不得自拟新风格）**：**复用 `adminSettings`**（数值配置 · 若复用页）；若另开 ⇒ 候选 **`adminEconomyConfig`**。
- **用户可见文案命名空间（候选）**：**`battCard`**（电量卡：名称 / 单位 `%` / 区间提示 / 「不足不可承接」提示）+ **`checkinPanel`**（签到区：签到按钮 / 连续天数 / 断签提示 / 补签按钮 / 补签费用提示）。
- **★ 文案「值」= 产品 / 文案决策 ⇒ 本单不写**（登记 §28.10 `J-1`）。
- **★ 单位口径**：需求 §4.1.1 逐字「**展示单位 %**」⇒ 用户面电量**以 `%` 展示**（`batt` 数值 `0..100` 直接作百分比）；**`$` 展示同理**（`cid=1` `decimals=0`）。

**（c）★ 禁工程口径泄漏六类（写死 · 可判负）**：**用户可见文案**（`t(...)` 的**值**面，含 `battCard*` / `checkinPanel*` / `adminSettings*` 新增键）**不得**出现：① 本册 / 姊妹册**章节号 / 条号**；② **HTTP 状态码**；③ **接口路径 / 方法**；④ **内部批次名 / 单号**；⑤ **机读码 / 裸 i18n 键**；⑥ **表名 / 列名 / 函数名**（如 `batt_account` / `checkin_log` / `acceptThresholdBatt` / `AV1` / `saveSystemSettings`）。
- **判负形态（写死）**：对四语 locale 的新增键值做**正则扫描**（命中六类任一模 = **判负**）；**负对照** = 人为把一条文案改成 `"电量不足（§31.3）"` ⇒ **扫描必须转红**（**不转红 = 假门**）。**登记 = §28.10 `J-2`**。

**（d）★ 派生布尔（`canAccept` / `checkedInToday` / `canMakeup`）**：三布尔**不落库** ⇒ **每次由读口即时重算**（取数源 = `batt` + 政策 / `checkin_log` + `checkin_policy`）；**若将来缓存 ⇒ 必须随源变更重算，否则标 `stale`**（**禁**用陈旧布尔在前端放行承接 / 重复签到）—— 承姊妹册 §31.6⑦。

> **★★ ★ Zang 裁定（落位确认）· 后台页契约 + 四语命名空间（2026-10-03）**
> **① 后台页契约（写死 · 承 §28.7(a) 两案）**：P9② 新增后台页 = **复用 `adminSettings`（+0 页）或另开 1 页（候选命名空间 `adminEconomyConfig` · +1）** —— **两案代价已给、择一未裁**（登记 §28.9-6 / §28.10 `J-1`）。**用户面 = 「电量卡」+「签到区」**（既有渲染点接覆盖值 / 新取数 · **不新增独立页面**）。
> **② 四语命名空间（写死 · 只给契约 · 不写文案值）**：后台页 = 复用 `adminSettings`（若另开 ⇒ 候选 `adminEconomyConfig`）；**用户可见文案命名空间（候选）= `battCard`**（电量卡：名称 / 单位 `%` / 区间提示 / 不足不可承接提示）+ **`checkinPanel`**（签到区：签到按钮 / 连续天数 / 断签提示 / 补签按钮 / 补签费用提示）；四语 = **`zh/en/hk/vn`**（承 P9① 现取）。**文案「值」= 产品 / 文案决策 ⇒ 本单不写**（§28.10 `J-1`）。
> **③ 禁漏六类（写死 · 承 §28.7(c)）**：用户可见文案（含 `battCard*` / `checkinPanel*` / `adminSettings*` 新增键）**不得**命中六类（章节号 / HTTP 码 / 路径方法 / 批次单号 / 机读码裸键 / 表名列名函数名）；**判负** = 四语 locale 新增键值正则扫描命中 + **负对照**（人为把一条文案改成 `"电量不足（§31.3）"` ⇒ 扫描必须转红；不转红 = 假门）。**§28.7 原表体一字未改**。

### 28.8 ★★ 三变体（**不择一**）+ 每案代价（**读 / 动作口**）

**变体 Ⅰ —— 独立双读口（`GET /api/batt` + `GET /api/checkin`）+ 双动作口**

| 项 | 取值 / 代价 |
|---|---|
| 读 / 动作口 | 2 读 + 2 动作 ⇒ **注册点 `76 → 80`**（§28.5(a)） |
| 写口 | 配置写复用 `POST /api/admin/settings`（**+0**） |
| 前端页数 | 后台 **0 或 1 页**（复用 / 另开）+ 用户面 0 页（既有渲染点接） |
| 代价（归纳） | ✅ **语义最清晰**（电量与签到各自独立口）；✅ 与 P9①「公开读口 +1」形态一致；❗ **注册点 +4**（最多） |

**变体 Ⅱ —— 折一读口（`GET /api/batt` 含签到状态）+ 双动作口**

| 项 | 取值 / 代价 |
|---|---|
| 读 / 动作口 | 1 读 + 2 动作 ⇒ **注册点 `76 → 79`** |
| 代价（归纳） | ✅ 注册点少 1；❗ **`data` 键集变宽**（电量 + 签到混在一口）⇒ 契约耦合；❗ 前端一次取数（少一次往返） |

**变体 Ⅲ —— 复用既有读口（如 `GET /api/home`）承载电量 / 签到读 + 双动作口**

| 项 | 取值 / 代价 |
|---|---|
| 读 / 动作口 | 0 新读口 + 2 动作 ⇒ **注册点 `76 → 78`** |
| 代价（归纳） | ✅ 注册点最少（+2）；❗ **耦合既有首页键集**（`route-layer.spec` §10.1「读侧载荷恒有值」面回归风险）⇒ 契约面变大、回归面变大（承 §26.2 变体小结「复用既有读口 ⇒ 耦合既有端点契约」同旨） |

> **★ 变体小结（不择一）**：**Ⅰ / Ⅱ / Ⅲ 均可满足需求**；差在**口数（注册点 +4/+3/+2）**与**契约耦合度**。**择一 = Zang/Kevin**（承 `§5.217` D「给 2–3 变体 + 每案代价，不得自选」）。

> **★★ ★ Zang 裁定（`R-9-19`）· 变体 Ⅰ 采纳 · Ⅱ/Ⅲ 不采纳（2026-10-03）**
> **依据（逐字）**：§5.230 B `R-9-19`：**变体 = Ⅰ（双表 · 4 张）** ⇒ 注册点 `76 → 80` … **Ⅲ 判「不采纳」**。
> **① 定案（覆盖 §28.8 的「三变体不择一」）**：**取变体 Ⅰ（独立双读口 `GET /api/batt` + `GET /api/checkin` + 双动作口 `POST /api/checkin` + `POST /api/checkin/makeup`）⇒ 注册点 `76 → 80`**；**变体 Ⅱ（折一读口 ⇒ 79）明写「不采纳」**；**变体 Ⅲ（复用既有读口 ⇒ 78）明写「不采纳」**。**§28.8 原三变体表体一字未改**，本块 = 就地定案读法。
> **② 理由（转引 `R-9-19`）**：① 审计强度（batt 消耗 9 = 核心经济动作 ⇒ 逐笔凭证）② 与 `ledger_entry` 形态同构便于对账 ③ Ⅲ 违 `R-9-6` 等四条。
> **③ 连带（写死）**：P9② **新增后台页 0 或 1 页**（复用 / 另开 `adminEconomyConfig` · §28.7）；**用户面 0 页**（既有渲染点接）。

### 28.9 判据分级 + `NOT_MEASURED`（**镜像级 ≠ 真链级** · 禁填 0 / 空）

**(a) 判据分级（写死）**

| 级别 | 定义 | 本节覆盖 |
|---|---|---|
| **镜像级** | 只验「路由能注册 / 配置能存 / `curl` 返回 200」= **弱证据** | 不单独作为通过判据 |
| **真链级** | ①后台写 → ②库内落值 → ③业务读口取数 → ④行为随之（四段全跑 + 每段判负 + 负对照） | **归 P9② 实现单 + 质检单**（本单**只写判据、未跑**） |
| **类级覆盖** | 对**同族**（同类读 / 动作口 · 同类闸 · 同类错误面）一次性给判据，**显式标级别** | §28.5(b)（错误码借码 = 类级）/ §28.6（四段 = 类级） |

**(b) `NOT_MEASURED`（逐项 · 禁填 0 / 空 / 占位）**

| # | 未测项 | 原因（**不得**填 0 / 空 / 占位） |
|--:|---|---|
| 1 | **4 口（或 3 口）的 HTTP 实跑**（含四段 + 两读数 + 负对照） | **本单为规范单、零代码** ⇒ 口未实现 ⇒ **HTTP 读数 = `NOT_MEASURED`**（归 P9② 实现单 + 质检单） |
| 2 | **注册点应然值（`76 → 80/79/78`）** | **随变体择一**（§28.8 · `PENDING_ZANG`）⇒ **未裁 ⇒ 未落**；现取 = **76**（§28.1-3，已现取自证） |
| 3 | **路径名（`/api/batt` / `/api/checkin` / `/api/checkin/makeup`）** | **候选**（§28.2）⇒ **未批准 ⇒ 未测**（本节不发明路径） |
| 4 | **借用错误码（E1/E2/E4）与 `reason` 稳定常量名** | **候选**（§28.5(b)）⇒ **须 Zang 确认 ⇒ 未定 ⇒ 未测** |
| 5 | **四语文案「值」** | **产品 / 文案决策 ⇒ 本单不写**；无值可测 |
| 6 | **后台页数（复用 `adminSettings` vs 另开 `adminEconomyConfig`）** | **两案代价已给**（§28.7(a)）⇒ **择一未裁 ⇒ 未落** |
| 7 | **「承接闸」的路由层表现（`409` ⇄ 去闸 `200`）** | **规范单零代码**；闸落点在 **SQL 内**（姊妹册 §31.3(c)）⇒ **HTTP 读数 = `NOT_MEASURED`**（判据已写死 = §28.6④） |

### 28.10 待办登记（交「P9② 实现单 / 文案单 / 质检单」· 本册不实现）+ 指纹自证

**(a) 待办登记**

| 条目 | 待办 | 依据 |
|---|---|---|
| **`J-1`** | **四语文案「值」**（`battCard` / `checkinPanel` 用户面 + 后台页文案） | §28.7(b)；承 §19.5 / §26.6 先例 |
| **`J-2`** | **六类禁漏扫描门落地**（四语 locale 新增键值正则 + 负对照） | §28.7(c) |
| **`J-3`** | **读 / 动作口路径 + 注册点增量**（变体择一后定：`+4` / `+3` / `+2`） | §28.2 / §28.8；`R-8-14` |
| **`J-4`** | **借码 + `reason` 稳定常量确认**（E1/E2/E4 族；**零新增码**） | §28.5(b) |
| **`J-5`** | **承接闸落地**（`applyToJob` / `acceptJobApplication` 两处 **SQL 内**加电量闸 + 去闸负对照） | 姊妹册 §31.3(c)；`C2` 教训 |
| **`J-6`** | **新表建表 + apply**（姊妹册 §31.2(c) 草案 ①–④；**apply 由 Zang 执行**） | 姊妹册 §31.2 |
| **`J-7`** | **`C-3` 择一落地**（补签 `$` 腿 kind：复用 vs 扩容） | 姊妹册 §31.1（`PENDING_ZANG`） |
| **`J-8`** | **日界口径落地**（UTC / CST / 用户时区择一） | 姊妹册 §31.4(e)（`PENDING_ZANG`） |
| **`J-9`** | **四段真生效判据落地**（①③④ 段 + 每段判负 + 负对照） | §28.6 |

**(b) 指纹自证（本册不内嵌自身 md5，防自指）**

- **改前（v2.12）** = **`wc -l` = 6329（换行符数）/ 逻辑行 = 6330（末行 `---` 无换行）/ md5 与 sha256 见 §28 完工 delta 件**（开工 `wc -l` / `shasum` 现取）。
- **改前快照 = `docs/versions/route-layer.spec.v2.12.md`**（**开工前既存、本单未动**；**旧快照 32 件一字未动**）。
- **改后（v2.13）** = **`docs/versions/route-layer.spec.v2.13.md`**（**与本册逐字节相同**，`cmp` ⇒ **退出码 0**；命名依本册约定「快照取 **新版本号** + 改后正文」）。
- **只追加自证**：**§28 插于本册末行 `---` 之前**（**末行无尾换行** ⇒ 插行 0 删除行）；**顶部新增 1 个状态块（3 行 + 空行）**（⇒ 其后全部行号 +4）；`git diff --numstat docs/route-layer.spec.md` 删除列 = **0**；`difflib` 独立复核 **0 replace / 0 delete**。

### 28.11 与既有条文的引用关系（**写死 · 不重写旧文**）

| 既有条文 | 本节的读法（**旧文一字未动**） |
|---|---|
| **§17 / §18（`app_config` 写口准入 / 载体键名）** | **承**：P9② 配置写**复用**同写口（§28.3）；**该两节表体一字未动** |
| **§19.3 / §19.5（权限键映射 / 后台页六类禁漏）** | **复用**：§28.4 逐类承；§28.7(c) 逐类承 |
| **§21（键级寻址）** | **承**：形态 B / `ops:` / `reason` 常量逐字复用；**表体一字未动** |
| **§26（v2.11 · P9①）** | **承**：P9① 的公开读口 +1（`75 → 76`）为本节**基线 76**；**`§26` 正文一字未动** |
| **§27（v2.12 · P9① 追补）** | **承**：注册点 `75 → 76`（§28.1-3）；**`§27` 正文一字未动** |
| **`data-layer.spec` v0.20 §31** | **同批姊妹册**：其 §31 = 键面 / 库面 / 值域 / **闸落点** / 补签幂等键 / 日界候选 正文；**本册只承载 route 侧**（读写口 / 权限 / 注册点 / 错误面 / 真生效 / 后台页） |
| **`R-9-6` / `R-9-3` / `R-9-5`** | **依据（只读引用）**：`docs/seafood.master-plan.md:1789` / `:1815` / `:1817` |
| **`ledger.spec` `R107` / `R105` / `R106` / `DL97` / `DL98`** | **只读引用**：错误形状 / HTTP 语义 / 重放即成功 / 写口带键 / 重放语义 —— 逐条承（§28.5 / §28.6） |

---