# 海鲜市场 · 多币种账本口径冻结裁定书

> **文档状态（最新）**：**v0.15**（2026-10-03；**本次 = 「P9⑤ C3 规范回写：`kind` 关闭集 23 → 24（末位追加 `invite_first_task_reward`，平台账户出账腿 +1）＋ `R101` 的 `−1` `debit` 首开（仅 1 项）＋ `R103` 就地修订（区分「运维提取（留白不变）」⇄「需求规定的发放（`R-9-66`）」）」** —— **只增不改 · 追加式**、**R1–R109 编号与条文一字未动、§14.1 仍 33 码、章节编号未重排**、旧写法**不静默重写**：① **§5.1 kind 表末位追加 `invite_first_task_reward`**（**只增不改序**；**`kind` 关闭集 23 → 24**；迁移 **`0038_kind_close_set_24.sql`**：`ledger_kind_enum` CHECK **24 值** + `ledger_kind_ok`（**`p_frozen_settle` 第二支一字不动**）+ `ledger_assert_platform_mutation`（`−1` `debit` 首开））；**三列登记** = **减方** `uid = −1` `balance −(perLeg×N)` ／ **增方** 完成首任务者本人 + 直接上级（`referral.parent_uid`）各 `+firstTaskUsd` ／ **净增发 = 0**；② **`R101`（§13.3）就地增补**：`−1` 的 **`credit` 8 值逐字不变**、**`debit` 首开且仅 1 项 `invite_first_task_reward`**；③ **★ `R103`（§13.3）就地修订**：**「平台运维提取」留白保持不变**（`platform_withdraw` **仍未批**、后台**不得**提供提取按钮）⇄ **「需求 §6.2② 明文授权的发放」= 系统内转移**（`R-9-66` ⇒ 经 `R101` `−1` debit 白名单放行）；④ **§14.3 错误表就地增行**（`invite_first_task_reward` 白名单内**放行**；白名单外 `−1` debit 仍 `LEDGER_RESERVED_UID` / `400`）；⑤ **§15 #3 就地加注**（**本项与 `invite_first_task_reward` 无关**）；⑥ **§18 变更记录 + §19.18 登记**（`R-9-64`/`R-9-65`/`R-9-66` 逐条 + 快照 / delta）。**范围** = **只写本册 + 改后快照 `docs/versions/ledger.spec.v0.15.md` + delta 件 `docs/audit/ledger-v0.15-delta.md`**（Jing · Unit **JING-SPEC-P9-5C3**）。**★ 头注留痕（诚实登记）**：紧邻其下的 **v0.14** 行仍带「文档状态（最新）」字样 —— 本册受「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束，**未改写该行** ⇒ **以文件最上方的本行（v0.15）为现行版**。
> **文档状态（最新）**：**v0.14**（2026-10-03；**本次 = 「P9② 连带回写：`kind` 关闭集 20 → 21（追加 `checkin_makeup_fee`）＋ `−1` 增方白名单追加」** —— **只增不改 · 追加式**、**R1–R109 编号与条文一字未动、§14.1 仍 33 码、章节编号未重排**、旧写法**不静默重写**：① **`R-9-14` 就地加注（`§5.1`）**：C-3 = **方案 ② 扩容 +1**，新 kind **`checkin_makeup_fee`**（**`kind` 关闭集 20 → 21**）；迁移 **`0028_kind_close_set_21.sql`**（**CHECK 重建、非 enum**，手法逐字照 `0003_kind_close_set_20.sql`）；**不真 burn**（`R-9-3`）；三列登记（**减方** 用户 `balance −100` ／ **增方** `uid = −1` `balance +100` ／ **净增发 = 0**）；② **`R-9-14` 就地加注（`§13.3 R101`）**：**`−1` 增方（credit）白名单追加 `checkin_makeup_fee`**（现取 `ledger.spec:845` + `0019:63`）；**DB / 代码落地归 P9② 实现单**（`0028` + `ledger.ts` `PLATFORM_KIND_WHITELIST['-1'].credit`）。**范围** = **只写本册 + 改后快照 `docs/versions/ledger.spec.v0.14.md` + delta 件 `docs/audit/ledger-v0.14-delta.md`**（Jing · Unit **JING-SPEC-P9-2L**）。**★ 头注留痕（诚实登记）**：紧邻其下的 **v0.13** 行仍带「文档状态」字样 —— 本册受「只追加 / `git diff --numstat` 删除列 = 0」硬口径约束，**未改写该行** ⇒ **以文件最上方的本行（v0.14）为现行版**。**★ 既有缺口登记（只登记 · 不补）**：本册**快照链断档** —— `docs/versions/ledger.spec.v0.13.md` **不存在**（现取：`docs/versions/` 下有 `ledger.spec.v0.1.md … v0.12.md` 共 **12** 件、**无 `v0.13`**；`docs/audit/` 下**从无** `ledger-*-delta.md`）⇒ 本次 `ledger.spec.v0.14.md`（快照）+ `ledger-v0.14-delta.md`（delta）为**断档后首个**；**只登记、不补历史快照**（不补 `v0.13`、不改 `v0.1–v0.12`）。
> **文档状态**：**v0.13** · 已完成（19 章 + 目录 + 规则总索引，共 **109 条规则 R1–R109**）〔**v0.13**：**`listing_deposit` 白名单回写**（R101/§17 索引/§18/§19.17）—— 由 **Zang §5.81** 勘误驱动（`listing_deposit` = **上市即消耗 → 贷 `uid = −1`**；DB 侧 `0019` **已落盘并已应用**〔本册收尾现取：文件在盘 + `/health` ⇒ `schema_version=0019`〕，归属 FIX-A）；**R1–R109 编号与条文一律不动、§14.1 仍 33 码、章节未重排**；**v0.12**：**R79 就地扩写并拍板**（加锁全序含业务行）＋ **新增 R109**（业务编排函数的原子性与幂等口径）⇒ 由 **108 条 → 109 条**；v0.11 旧写法：共 108 条规则 R1–R108〕。待 Kevin 拍板项集中于 §15（其中 R31 上市保证金性质已于 v0.2 裁定，见 §19.0；`listing_deposit_forfeit` 已删除一事已于 v0.3（P1c）裁定，见 §19.8），未实测边界见 §16。〔**v0.5 仅修正 §14.3 的 `cid`/`uid` 参数分类口径枚举**（消除一处歧义 + 记入变更记录），**未新增/重排章节、未增删规则、未新增错误码**〕〔**v0.6 四项小修**（`toCid` 现状翻转 · 读路径超 `bigint` 逃逸缺陷裁定与要求 · 两条「非确定性判据」登记 · `reason` 名对齐），**同样未新增/重排章节、未增删规则、未新增错误码**；四项逐条见 §19.10〕〔**v0.7 四项小修**（§16 #12 修后逃逸扫描读数回填 · §14.3 (B)「数字」口径更正 · 「只准按 `code` 分支」纪律与三处 `reason` 名分歧登记 · 「错误码命名整理」工作项登记），**未新增/重排章节、未增删规则（R1–R108 不动）、未新增错误码**；四项逐条见 §19.11〕〔**v0.9 三项小修**（① 冻结映射与现实对齐：三条扩展 `403 ⇒ input` / `423 ⇒ integrity` / `null ⇒ defect` ＋ **`200` 改判单列 `benign_outcomes`（不参与 bucket 校验）**；② 「双向映射全量往返闭合断言」立为**规范要求**并进回归套件固定项；③ 登记**反向映射缺 `LD0nn` 分支（33 码全未归类）**这一 **P1 遗留缺陷**与 **`0009` 修复状态 / 修前修后读数**＋「响应层必须用 `err.httpStatus`、不得用 `err.status`」硬规则），**未新增/重排章节、未增删规则（R1–R108 不动）、未新增错误码（§14.1 仍 33 码）**；三项逐条见 §19.13〕〔**v0.10 六项小修**（① **回校 `docs/seafood.master-plan.md` §5.23 正文**（**现已落盘**：master-plan **v0.27** / HEAD `541dffd`）⇒ v0.9 的「未能核到 §5.23 正文」标记**作废**（逐条对齐见 **§19.14.A**）；② 写死「**`200` ⇒ `benign`**」的**精确口径**（**`bucket` 字段保持 `input` 不变**、**不参与 `bucket↔状态类` 校验**、`httpStatusOf` 对良性码返 **`200`**、**`0009` 不得再改**）；③ `W = 0` **双档口径**（**写入档** `400` ／ **运行档** `500` 兜底 —— **不同档位、两条规则、不冲突**）；④ **幂等指纹范围 = business 字段、不含派生量**（政策改版后同键重算 ⇒ **走重放**，**是正确行为**）；⑤ 绑定协议改为**守卫强制**的「**已有下级者不得再被绑上级**」（替换「调用方纪律」式措辞）；⑥ 登记 P2 佣金层 **M1–M9 全过**与其关键读数），**未新增/重排章节、未增删规则（R1–R108 仍 108 条）、未新增错误码（§14.1 仍 33 码）**；六项逐条见 **§19.14**〕
> **本版修订（v0.12 · Zang「C1 终审落位：`R79` 扩写并拍板 ＋ 新增 `R109`」）**：**两项已全部落位（逐条见 §19.16）**；**本版 md5 / 行数 / 字节数见交付报告**（本册历版同例）。**版本与快照**：改前 = **v0.11**（md5 `115b6e8dc36e0f6e2e29ce855cc014d5`，1918 行 / 417398 字节；**本册开工时 `read_file` + `md5` 现取**），改前快照 = `docs/versions/ledger.spec.v0.11.md`（**本版新建**，本册以 `cmp` 自证与改前主体**逐字节相同**）。**裁定来源** = Zang 对 P3 数据层规范评审的 **C1（业务表 ↔ 账本事件的原子性）终审**（`docs/seafood.master-plan.md` **§5.32** C1 的四条附加硬约束 + C8；**C1 采纳「新增业务编排函数」提案**，两阶段形态被否）。两项：**① `R79` 就地扩写并拍板**（落位 = §10.1 全序块 + §10.3 R79 行 + **§7.2 v0.12 就地落位块** + §15 #6 + §17 索引 R79）：**加锁全序（最终口径）= 业务行（若该事务涉及，按主键升序） → `currency`（`cid` 升序） → `account`（`uid` 升序）**；**禁止**「先锁 `account` 再锁业务行」这类反向写法（会与全序成环 ⇒ 死锁）；**业务编排函数（`job_post_event` 等）必须在调 `ledger_post_event` 之前持有业务行锁**；**`lockAccounts(sortedUids, cid)` 由「建议」升为强制** —— **服务层唯一允许的加锁入口**、**只接受已排序数组**；状态栏 **待拍板 → 已拍板（Zang · C1 终审，2026-09-28）**，**v0.11 旧写法（只管 `currency → account`、未涵盖业务行）在每一处同地保留**（不静默重写）。**② 新增 `R109`**（落位 = §7.3 末行；**R1–R108 编号与条文一律不动、只增不重排**）：**业务编排函数的原子性与幂等口径** —— ① **业务行 + 分录必须落在同一事务**（由编排函数保证；**函数内禁止任何 DDL**；编排函数**只由迁移创建**）；② **幂等重放语义必须与 `R51`/`R52` 一致**（同键同指纹 ⇒ `200` 重放，**不**重写业务行）；③ **必须把 `ref_id` 落账本引用列**；④ **业务级幂等另需业务表侧键 `create_key`**（见 `docs/data-layer.spec.md`）。**并登记一条已知债（可选项，低优先；见 §19.16.B）**：`C5`（业务状态机非法转移）借用了 `LEDGER_CURRENCY_INVALID_TRANSITION`(409) ⇒ 存在「**码名语义窄化**」；将来若启用专用码（如 `LD034`），**必须一次到位**（**正向 + 反向映射 + bucket**，不得只加正向）。**§14.1 仍 33 码（不新增错误码）**；**章节编号未重排**（§19 追加为 **§19.16**）；**R79 未换号、R1–R108 未重排**。
> **本版修订（v0.13 · Zang「§5.81 勘误落位：`listing_deposit` 白名单回写」）**：**本版只做一处白名单回写 + 变更记录，不扩大范围**；**R1–R109 编号与条文一律不动、§14.1 仍 33 码、章节编号未重排**（内容一律向后追加为 **§19.17**）。**裁定来源** = `docs/seafood.master-plan.md` **§5.81**（`:1390-1399`，**Zang 自我勘误：§5.80 对 route-layer §7-3 的批准作废**）。**更正内容**：**R101（§13.3）的 `−1` 增方白名单追加 `listing_deposit`** —— 本册 §3.1 **R31**（`:287`）与 §13.2 的 `−1` 行（`:827`）**自 v0.2（P1a）起就写死**「`listing_deposit` = **消耗**、转入 `uid = −1`、计入平台收入」，而 **R101 正文只列三项**（`trade_fee`/`listing_fee`/`currency_create_fee`）⇒ **册内自相矛盾**，本次**只补 R101 这一格**（旧写法「三项」保留留痕）。**DB 侧落点** = `0019` 迁移（**★ FIX-A 已落盘，本册收尾现取核实**：`migrations/0019_listing_deposit_platform_credit.sql`（167 行）在盘、`/health` 自报 `schema_version=0019`、`ledger.ts` 的 `HOLD_KINDS`（`:178`）已移除 `listing_deposit`；照 `0008` 先例做**加法式**扩展；**kind 关闭集仍 20**）；**代码侧真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 漏删）。**改前快照** = `docs/versions/ledger.spec.v0.12.md`（md5 `8ffb5fd5b711731ea65c317f18ec0f0d`，2010 行 / 450638 字节，**本版新建**，以 `cmp` 自证与改前主体逐字节相同）。**本册未连库、未跑迁移、未改代码**（只读）；逐条见 **§19.17**。
> **本版修订（v0.11 · Zang「`0012` 幂等重放前置闸落位 · 四项」）**：**四项已全部落位（逐条见 §19.15）**；**本版 md5 / 行数 / 字节数见交付报告**（本册历版同例）。⚠️ **版本号说明（留痕）**：本单来件写作「v0.9 → **v0.10**」，但改前 **v0.10 已由 `f78714f`（§19.14 六项小修）占位并已入册** ⇒ 依本册「版本号只增不复用」纪律，本项落为 **v0.11**，改前快照相应为 `docs/versions/ledger.spec.v0.10.md`（md5 `a2a6a6a4d26b800e7a60df5b57479f5c`，1838 行 / 384935 字节；**v0.9 快照 `ff317dfbcad5cd6a0c4691c52a138542` 已存在、本版逐字未动**）。四项：① **R51 新增子句**（前置闸 = 重放**快路径**，不取代 `ON CONFLICT` 探针的并发权威性；R51 禁「先 SELECT 再 INSERT」的立法意图不变）⇒ §6.2 R51 ＋ **§6.2 v0.11 就地落位块 (1)** ＋ §17 索引 R51；② **§7.1 第 454 行顺序明文更正** 为「信封校验 → 加锁(C4) → **只读重放前置闸(C4.5)** → 余额/冻结闸(C5/R80) → ON CONFLICT 首条分录探针 → 分录 → 余额更新」（**旧址以「v0.10 旧写法」保留在同处**）＋ **同处 v0.11 就地更正块**；③ **R52① 标明重放保证项**（`idempotent_replay` / `txid` / 账上结果）**＋ `extra` 属诊断信息、非契约字段**（重放 `{}` 合规、**早于 `0012`**、**不开 `0013`**）⇒ §6.2 R52 ＋ **§6.2 v0.11 就地落位块 (2)** ＋ §17 索引 R52；④ **§19.15 登记 `0012` 的实现事实与证据**（checksum / 函数体前后指纹 / 五个位置读数 / `ON CONFLICT` 探针仍在闸之后 / 与 `0005` 差分**只有两处纯插入**）**＋ 两条已知盲区**（**登记、非缺陷、不修**）。**R1–R108 仍 108 条（不增不删）、§14.1 仍 33 码、章节编号未重排、无新增错误码**；裁定来源 = `docs/seafood.master-plan.md` **§5.25** ／ **D17** ／ **§5.27**。
> **本版修订（v0.9 · Zang「三项小修 · 冻结映射与经济现实对齐 · 往返闭合断言 · 缺陷登记」）**：**本版三项都是小修，不扩大范围**；**§14.1 仍 33 码、§17 仍 R1–R108（108 条）、章节编号未重排**（§14.3 就地增补、§16 就地追加两行、§18 加一行、新章节一律向后追加为 **§19.13**）。🔴 **v0.10 更正（下列诚实标记已作废）**：**§5.23 正文已于 v0.10 核对**（`docs/seafood.master-plan.md` 现为 **v0.27**、HEAD `541dffd`，§5.23 在盘且含「反向映射 33 码全未归类」定性 / `0009` 修复 / **bucket 扩展四条裁定** / **`200` 改判** / **反转探针不做** / **响应层必须用 `err.httpStatus`**）⇒ 本块当时的「未能核到 / 按转述落位」免责**作废**，**逐条对齐见 §19.14.A**。**原 v0.9 文字（保留留痕）**：**裁定来源（诚实标注）**：Zang 裁定，本单转述自 `docs/seafood.master-plan.md` **§5.23**；⚠️ **本册未能核到 §5.23 正文** —— 全仓 `grep -rn '5\.23' docs/` **无命中**，`docs/seafood.master-plan.md`（737 行）**现存末节为 §5.22**（「`0007`/`0008` 验收 + 新缺陷：错误码反向映射缺 LD031–LD033」）⇒ 本册按**转述的裁定值**落位（**不自行推导**），并自核了裁定的**事实前提**（§14.1 全表状态类、`backend-ts/src/ledger-errors.ts`、`migrations/0009`、`.p2c-artifacts/*.json`）；若 §5.23 正文与本册写法有出入，**以 §5.23 正文为准并回改本册**。① **冻结映射与现实对齐（事一 · 本版核心）**：v0.4 冻结的 `bucket ↔ 状态类` 映射只有四条（`input ⇒ 400 类` / `integrity ⇒ 400 \| 404 \| 409` / `retryable \| infra ⇒ 503` / `defect ⇒ 500`），而 §14.1 的 33 码里**另有四个状态类**落在冻结面**之外**：**`403`**（#15 `LEDGER_UNAUTHORIZED_MINT` / #16 `LEDGER_HOLD_NOT_ALLOWED` ⇒ DB `LD014` / `LD015`）、**`423`**（#9 `LEDGER_CURRENCY_FROZEN` ⇒ `LD009`）、**`200`**（#3 `LEDGER_IDEMPOTENCY_REPLAY` ⇒ `LD006`，R106 明定**不是错误**）、**`null`**（#33 `LEDGER_RECONCILE_MISMATCH` ⇒ `LD032`，本表登记为 `—` = **脚本退出码语义**，§11 R88）⇒ **修正原因写死：原表不完整（只覆盖 4 个状态类），不是现实违规**；裁定 = **接受三条扩展**（`403 ⇒ input` / `423 ⇒ integrity` / `null ⇒ defect` ⇒ HTTP 层 `status ?? 500`）＋ **`200` 改判为单列一类 `benign_outcomes`（良性结果，**不是**错误类，**不参与 bucket 校验**）**（理由：`LD006` = 幂等重放是**良性结果**，硬塞 `input` 桶的「调用方输入有问题」语义不对）；**原则：让冻结集与现实对齐，而不是让现实去迎合一张不完整的表** ⇒ 落位 **§14.3 v0.9 增补块 (A)**（含扩展表 + 改判理由 + `500 类只来自 defect` 与新增三条「只可能来自」判据 + 「扩展只加格、不加码」纪律）。② **双向映射全量往返闭合断言（事二 · 规范要求）**：**凡双向映射（名↔码 / 状态码↔ HTTP / 枚举↔字符串 / 代码↔规范）必须交付「全量往返闭合断言」**（`f(g(x)) == x` 对**每一元素** ＋ 桶一致性），**且必须进回归套件固定项**；**单向自证不算闭合**（由来：P1「关闭集 33 码已闭合」只自证了**正向 33 条**，**从未自证反向也有 33 条** ⇒ 反向表**一条 `LD0nn` 分支都没有**时照样「通过」）；已交付资产 = `backend-ts/scripts/p2c-00-code-roundtrip.ts`（33 码全量往返闭合测试，`--assert` 模式）⇒ 落位 **§14.3 v0.9 增补块 (B)** ＋ §19.13.B。③ **缺陷登记与已修状态（事三）**：**反向映射缺 `LD0nn` 分支 ⇒ 33 个自有码（`LD001`..`LD033`）全部落 ELSE 兜底**（`LEDGER_TRANSACTION_REQUIRED` / `defect` / `unclassified_db_error`；**落桶侥幸没错，但码名与 `reason` 全被错配**）—— 定性 **P1 遗留缺陷**（被 `0007` 的佣金守恒断言**第一次真正抛 `LD032`** 才暴露；长期掩盖原因 = 这些码多为 `defect` 类，**调用方输入触发不了**）；**已由 `0009` 修复**（checksum（sha256 前 12 位）`6688e2ce35c6`；**函数体 = `0005` 版逐字节保留 + 恰 60 行 `LD001..LD033` 分支** —— 本册自核：前缀 10 行 ＋ 新增中间段 **60** 行 ＋ 后缀 98 行 = 0009 函数 **168** 行、`WHEN 'LD0nn'` 分支 **33** 条）；**修前 / 修后读数与 `--assert` 结论逐字进册**（修前 run `MUJNM9EO`：`roundtrip_mismatches = 32` / `bucket_violations = 54` / `null_status_defect = 27` / `stale_unclassified_reason = 33`；修后 run `MUJO2B19`：四项**全 0**、`closed_set 33 / 33`；`--assert` exit **0**（**转引**实现方报告，**本册未实跑** —— 不连库））；同处登记 **TS 侧 `LEDGER_ERROR_TABLE` / `LEDGER_SQLSTATE_TO_CODE` 本来就 33/33 齐全（缺口只在 DB 侧）** 与新增的 `LEDGER_ERROR_BUCKETS` / `httpStatusOf(code) = status ?? 500`；并立**一条给未来接 HTTP 的硬规则**：**响应层必须用 `err.httpStatus`，不得用 `err.status`** —— 后者 `null` 是 **§11 R88 脚本退出码**语义、**故意保留**、**不是缺陷** ⇒ 落位 **§14.3 v0.9 增补块 (C)** ＋ §16 **#14 / #15** ＋ §19.13.C。**改前快照：`docs/versions/ledger.spec.v0.8.md`（md5 `5fc164c3b1284103e69a23d749cedce0`，1658 行 / 323594 字节，与本版改前主体**逐字节相同** —— 本册以 `cmp` 自证）**；本版 md5 / 行数 / 字节数见交付报告。
> **本版修订（v0.8 · Zang「P2 裁定落位 · 四处就地增补」）**：本版**只做四处就地增补**，权威口径 = `docs/seafood.master-plan.md` **§5.20 的 16 项裁定**（**照它落位、不自行推导**），四处对应 **#2 / #3+#5+#16 / #4 / #6**。① **R45（§5.2）**：「若 10 级权重之和不足 100%，差额留在佣金池」与 **D13（按已有层级权重比例再分配）互斥** ⇒ **§5.20 #2 裁定：D13 胜**；**v0.7 原文保留并标「已由 D13 取代」**（留痕，不删），落位 = **§5.2 v0.8 块**。② **§14.1 #32**：把费率真源写成 `app_config` 的措辞**就地更正为「`commission_policy.fee_rate_bp` 是唯一真源」**（§5.20 #3）；并按 **#5 / #16** 明确**政策写入时的守卫失败类一律 `400`**（`input` 桶），**#32 自身仍为 `500` 缺陷类**（语义收紧为「已越过写入守卫」的配置/改库异常）⇒ 落位 = **§14.1 #32 就地更正 + §14.1 v0.8 增补块**。③ **§7.2 #8**：**不建 `commission_payout` 表**（单语句形态下 `ledger_post_event` 不能写业务表，§5.20 #4）⇒ 该格「+ 对应 `commission_payout` 行」**作废**（原文划线留痕）；**审计真源 = `ledger_entry`**；`commission` 分录的 **`ref_id` = 同一 `job_id`**。④ **R21（§2.2）加范围限定**：R21 管的是**账本表**（`account.uid` / `ledger_entry.uid` 含**合成负值**）⇒ **不建 FK**；**业务表可以 FK 到 `users(uid)`**（§5.20 #6）⇒ 落位 = **R21 正文 + §17 索引 R21/R45 + §15 #8 指针**。**R1–R108 仍 108 条（不增不删）**；**§14.1 仍 33 码**；**章节编号未重排、未新增章节**（本版内容一律追加为 **§19.12**，依「新增一律向后追加」纪律）。**改前快照：`docs/versions/ledger.spec.v0.7.md`（md5 `5a196a343bc3ab9b160f5717f6ac632f`，1597 行 / 308426 字节，与本版改前主体逐字节相同）**；本版 md5 / 行数 / 字节数见交付报告。
> **本版修订（v0.7 · Zang「四项小修 · 读数回填 + 口径更正 + 纪律与登记」）**：**本版四项都是小修，不扩大范围**。① **回填 §16 #12（事一）**：**修后逃逸扫描读数已存在** —— 真源 `backend-ts/.p1f-artifacts/p1o-00-escape-sweep-after-MUJJ2PHX.json`（run `MUJJ2PHX`）/ 修前终版 `p1o-00-escape-sweep-before-MUJJBPT2.json`（run `MUJJBPT2`），**本册 `read_file` 自核两文件后逐字落位（非转抄）**：修后 `raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0` / `expectation_mismatches = 0` / `valid_shape_false_reject = 0`；**604 格**（实跑 590 + 纪律跳过 14）；`ledger_entry` **166 → 166**（一行未写）；修前为 **33 格**（`22003` ×30 / `22P02` ×2 / `23503` ×1）、`unmapped` 33、`expectation_mismatches` 154。同处登记**「按类修」的方法论事实**（枚举 **17 个**入口点、**闸位全部前移到碰 PG 之前**、**唯一共用闸 `toAmount`**、修前基线由**同一份终版脚本**产出：**临时 checkout HEAD → 跑 → 还原并核 md5**，本册自核 `backend-ts/src/ledger.ts` md5 `9456b5cb72a3a42dd3de26069429ee67`）⇒ 落位 **§14.3 v0.6 增补块 (A) ⑤⑥** ＋ **§16 #12**（**#12 自此不再读作「未核对」**）。② **更正 §14.3 (B) 的「数字」口径（事二 · Zang 裁定）**：原文括号里的「数字」**不符实现且不应改** ⇒ **JSON number 形式的 `cid` / `uid`（含 `0` 与负数）是合法形状**（**数字是 JSON 里标识符的自然表示，不是类型错误**）⇒ 走**存在性判定** ⇒ **`404 LEDGER_CURRENCY_NOT_FOUND`**；只有**非十进制字符串**与**非数字类型（对象 / 布尔 / 数组）**才 `NOT_STRING` / `400`（附裁定理由 + v0.6 旧写法留痕）⇒ 落位 **§14.3 v0.6 增补块 (B) 就地更正**。③ **立「只准按 `code` 分支」规则 + 登记三处 `reason` 名分歧（事三）**：**调用方只准按 `code` 分支，不得按 `reason` 分支**（`reason` 是诊断信息、**不是契约**），同处登记三处已知名分歧（① DB `ledger_int_amount` 超长标识符 `OVER_MAX_SINGLE_AMOUNT` ↔ TS `OUT_OF_BIGINT_RANGE`；② `parseUserAmount('1e5')` TS `NOT_DECIMAL_STRING` ↔ DB `EXPONENT_NOT_ALLOWED`；③ 历史项 TS `BAD_TYPE` → `MISSING`，**已修**，留痕）—— 每处**同码、同 status，仅名不同**，**裁定维持现状** ⇒ 落位 **§14.3 v0.7 增补块 (A)/(B)** ＋ §19.11.B。④ **登记工作项「错误码命名整理」（事四）**：**排在 P2/P3 边界一次做完**，**不在本册执行**；四条清单（① 标识符形状错误借用 `LEDGER_AMOUNT_INVALID`；② DB `ledger_int_amount` 对标识符套用金额长度帽 ⇒ `reason` 名错位；③ TS `BAD_TYPE` 拆分（已修）；④ 事三的三处名分歧），**根因一句话：关闭集词汇是「金额中心」的，却被长期用于标识符** ⇒ 落位 **§14.3 v0.7 增补块 (C)** ＋ §19.11.C。**规则总数不变（R1–R108，108 条）**；**章节编号未重排、未新增错误码**（§19.11 按「新增一律向后追加」纪律追加；§14.3 / §16 / §18 / §19.10.E 只就地增补）。**改前快照：`docs/versions/ledger.spec.v0.6.md`（md5 `5aeed3cba7a01bf6638b678fec314d11`，1491 行 / 280206 字节，与本版改前主体**逐字节相同**）**；本版 md5 / 行数 / 字节数见交付报告。
> **本版修订（v0.6 · Zang「四项小修登记」）**：**本版四项都是小修，不扩大范围**。① **`toCid` 现状翻转（事一）**：§19.9.F 第 6 条 v0.5 时点写的「TS 侧仍为 `400 LEDGER_AMOUNT_NOT_POSITIVE`、**待收敛回 `404`**」**已过时** —— **现已收敛完毕**：`backend-ts/src/ledger.ts` 的 `toCid` 已回退为 `LEDGER_CURRENCY_NOT_FOUND` / **`404`** / `details = { cid }`，与 DB 侧 `ledger_cid_arg` **逐字一致**（**本册 `read_file` 自核代码**，非转抄）；三段并列读数（均 run-tagged）：`p1n-tocid-shape-before.json`（run `I0AUQ`）/ `p1n-tocid-shape-after.json`（run `I5JZU`）/ `p1n-tocid-shape-revert-IE4VH.json`（run `IE4VH`），TS/DB 对拍表见 §19.9.F 第 6 条 **v0.6 更正块**。**v0.4→v0.5 的历史叙述一字不改，只翻转「现状」那一句。** ② **新登记的逃逸缺陷（事二）**：读路径 `getCurrency('99999999999999999999999')` ⇒ **未映射的原始 PG SQLSTATE `22003` 逃到调用方**（`status = undefined` / `mapped = false`）—— 属本项目硬口径（§14.1 的 **33 码关闭集** + `bucket ↔ 状态类` 映射：**不得出现无法归类的错误 / 未映射的原始 SQLSTATE**）的**回归**，是当年在**写路径**灭过的 **D-02 那一类**、**读路径漏网**。**Zang 裁定**：**超 `bigint` ⇒ `400 LEDGER_AMOUNT_INVALID` + `details.reason = OUT_OF_BIGINT_RANGE`**（**与写路径同族，不新增码**）；**`cid <= 0` 与负数仍 ⇒ `404`**（v0.5 裁定不变）。**要求**：**按类修**（枚举**所有**接收外部 `cid` / `uid` / 金额入参的**入口点**，在**碰 PG 之前**设闸，**不得**只补被发现的那一个点）＋**新增「逃逸扫描」取证脚本**（矩阵 = 入口点 × 输入形状；断言 `raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0`；**run-tagged 输出、永不得写固定文件名**）⇒ 规范要求落位于 **§14.3 v0.6 增补块 (A)**，**只写裁定与要求、不转抄实现方读数**；修后读数待回填见 **§16 #12**。③ **登记两道「不是确定性判据」的读数（事三）**：`p1f-acceptance.md` §7.3 的子探针 `lock_timeout_lockwait_raw_55P03_when_no_handler` **跳运行不稳定**（一轮 `false`（run `H262V`）/ 一轮 `true`（run `I5XPD`））；`chain` 用例**终局码有两个合法值**（`LD025` 末次等锁先撞 3s `lock_timeout` / `LD026` 10s 自证预算先耗尽）⇒ **断言只针对「等待有界」，不得把不稳定的子探针写成硬断言、不得钉死某个码**（规范效力见 §14.3 v0.6 增补块 (C)，完整登记见 §19.10.C）。④ **`reason` 名对齐（事四）**：TS 侧 `cid` **缺失**的 reason 由 `BAD_TYPE` **对齐为 `MISSING`**（DB 侧同场景即 `MISSING`）；**非字符串类型用 `NOT_STRING`**；两侧都是 `400 LEDGER_AMOUNT_INVALID`，**状态类不变**（见 §14.3 v0.6 增补块 (B) / §19.10.D）。**规则总数不变（R1–R108，108 条）**；**章节编号未重排、未新增错误码**（§19.10 按「新增一律向后追加」纪律追加，§14.3 / §16 / §18 / §19.9.F 只就地增补）。**改前快照：`docs/versions/ledger.spec.v0.5.md`（md5 `8c53263e874276a7c8206c7d227c1a4b`，1395 行 / 254774 字节，与本版改前主体逐字节相同）**；本版 md5 / 行数 / 字节数见交付报告。
> **本版修订（v0.5 · Zang「§14.3 参数分类口径枚举修正 + 歧义事故留痕」）**：**只修一处歧义**。v0.4 的 §14.3 已裁定「形状非法 = 参数校验失败 = `400`；形状合法但不存在 = `404`」，但该表**未枚举 `cid <= 0`（与负数）算哪一类** ⇒ 下游据未枚举处读成「`cid<=0` = 形状非法 ⇒ `400`」⇒ Zang 据此发单要求把 TS 侧 `toCid` 由 `404` 改成 `400`（实现侧已改，`src/ledger.ts` 现抛 `400 LEDGER_AMOUNT_NOT_POSITIVE`）—— **而 DB 侧 `ledger_cid_arg` 一直是 `LD007 / LEDGER_CURRENCY_NOT_FOUND / 404`**（`p1n-tocid-shape-before.json` / `-after.json` 两轮一字未变）⇒ **改之前两侧本来就一致，是这一改动人为造出了一处两侧不一致**。**Zang 重新裁定**：**`cid <= 0` 与负数 = 形状合法但不存在 ⇒ `404`**（依据：`currency.cid` 是**正整数序列**，非正值构造上不存在）。本版落位三处：① **§14.3 就地枚举三类**（形状非法 ⇒ `400 LEDGER_AMOUNT_INVALID` + `details.reason` + `details.field`；形状合法但不存在 ⇒ `404`；`cid<=0`/负数 ⇒ 归 404 类），并说明 **`LEDGER_AMOUNT_INVALID` 是历史码名、被兼用作「参数形状非法」码、靠 `details.field` 区分字段、不新增错误码（§14.1 的 33 个关闭集不动）**；② 同处附 **实测对拍表**（真源 `backend-ts/.p1f-artifacts/p1n-tocid-shape-before.json` / `-after.json`，run `I0AUQ` / `I5JZU`；未在真源中找到的用例标「未核对」，不补造读数）；③ **§18 变更记录记入本次歧义事故**（留痕，非苛责）+ §19.9.F 第 6 条留痕反转。**规则总数不变（R1–R108，108 条）**；**章节编号未重排**（v0.5 不新增章节）。**改前快照：`docs/versions/ledger.spec.v0.4.md`（md5 `6dddb6e7c88abbe86f615d739a031b74`，1358 行 / 238701 字节，与本版改前主体逐字节相同）**；本版 md5 / 行数 / 字节数见交付报告。
> **本版修订（v0.4 · Zang P1e/P1i/F3 收口 + P1g 改名）**：P1e 独立质检**判定不通过** ⇒ 修三缺陷 ⇒ 复验（F1 14/14、F2 52 例闭集全绿、F3 六项真机读数、`tsc --noEmit` 0 error、`ledger-smoke` 29/0、`ledger-smoke-db` 11/0）。本版就地落位**九类契约项**并追加 §19.9。**改前快照：`docs/versions/ledger.spec.v0.3.md`（md5 `6b0a852ce73c748f4db178a52c7dceb8`，1129 行 / 175122 字节）**；本版 md5 / 行数 / 字节数见交付报告。九类落位：① **键字符集收紧**（R49/R50/R51/R52：禁 `#`（`RESERVED_SEPARATOR`）与控制字符（`CONTROL_CHARACTER`），校验顺序固定 `TOO_LONG→PREFIX_REQUIRED→RESERVED_SEPARATOR→CONTROL_CHARACTER`，**作用于每一个 `idempotency_key` 位置**含 `entries[].idempotency_key`）；② **重放语义改写**（新增列 `ledger_entry.event_root_key` + 索引 `idx_ledger_event_root_key` + 守卫 `ledger_event_root_guard`；按**事件根键精确归属**，**不再用字符串前缀「键族」匹配**）；③ **R60**（TS `RETRYABLE_SQLSTATES` 必须含 `LD027`；DB 层 **0 次重试**、`retry_owner=caller`）；④ **金额二选一**（R70/R71/R72：`amount` 与 `amount_units` 同时出现 ⇒ 400 `AMBIGUOUS_AMOUNT`；指数形式 ⇒ 400 `EXPONENT_NOT_ALLOWED`；单笔上限**两条路径都过闸**）；⑤ **R82 超时口径改写**（删除「函数内 `set_config(statement_timeout,…)` 生效」这一**实测无效**的声明，改为**函数内自证预算**：预算 10s、每次等锁前把 `lock_timeout` 压到 `min(3000, 剩余预算)`、越界 ⇒ `LD026 reason=statement_budget_exhausted`）；⑥ **§11 判据 8 键族口径**（改按 `event_root_key` 归组，历史行回退 `split_part(idempotency_key,'#',1)`，两种口径均应归零）；⑦ **§14 系列**（`LD025←55P03` / `LD026←预算耗尽·基础设施类` / `LD027←40001·40P01`；`08P01` 归 500 `protocol_violation`；**分类器 bucket↔状态类纪律冻结**；`cid`/`uid` **形状非法 = 400**（§14.3 旧写 404 **是错的**）；登记五类新 reason 枚举）；⑧ **§19.5**（一个业务事件 = 一条 `SELECT ledger_post_event($1::jsonb)`，**自带隐式事务** ⇒ 应用层不再需要 `BEGIN…COMMIT`）；⑨ **改名（D11）**（身份表由 migration `0006` 从旧表名 `user` 改名 **`public.users`**，关联对象全部改名、**列名未动**（`uid` 为 `bigint`）；活文档引用已同步）。**所有改写一律留痕**：旧口径以「v0.3 旧写法 / v0.2 旧写法 / v0.1 旧写法」形式保留在同处，不做静默重写；**规则总数不变（R1–R108，108 条）**，章节编号未重排（P1f/P1g 内容一律追加为 §19.9）。
> **本版修订（v0.3 · Zang P1c 收口）**：按 Zang 对 P1c 实现（Kong）的裁定与实测取证就地更正三处（改前快照：`docs/versions/ledger.spec.v0.2.md`，md5 `1a63a2f4e84ec199b463c536c3911cda`，1071 行 / 156707 字节）：① **kind 关闭集 21 → 20**（删 `listing_deposit_forfeit`；Zang 裁定：保证金在上市时即消耗、强制下架无可罚没标的物；DB 侧落点 `backend-ts/migrations/0003_kind_close_set_20.sql`）；② **非 PG 错误归类**（无 `code` 的裸 `Error`：连接池取连接超时/过载 → `503 LEDGER_TX_TIMEOUT` + `details.reason = 'pool_connection_timeout'`；驱动/OS 级连接错误 → `503` + `reason = 'driver_connection_error'`；**不得**再兜底改写为 `500 LEDGER_TRANSACTION_REQUIRED`）；③ **事实更正**：本库 `ledger_entry.kind` 为 **`text` + CHECK 约束**（约束名恰为 `ledger_kind_enum`），**不是** PostgreSQL enum 类型 ⇒ 删 kind 的手段是 `DROP CONSTRAINT` + `ADD CONSTRAINT`（**约束替换**），**不是** `ALTER TYPE`。并追加 §19.8「裁定与事实更正（Zang · P1c 收口）」。**所有改写一律留痕**：旧口径以「v0.2 旧写法 / v0.1 旧写法」形式保留在同处，不做静默重写；章节编号未重排（P1c 内容一律追加为 §19.8）。
> **本版修订（v0.2 · Zang P1a 收口）**：按 Zang 对 P1a 实现挖出的口径冲突所作的三项裁定（① 上市保证金 = 消耗不可退；② §11 判据 8 正式形状；③ §14 错误码借用映射 + R107 `details` 形状表）就地更正，并新增 §19「已裁定口径登记」。**所有改写一律留痕**：旧口径以「v0.1 旧写法」形式保留在同处，不做静默重写。
> **权威性**：本文件是「海鲜市场」金融内核（账本 / 币种 / 余额 / 幂等 / 对账）的**唯一权威口径**。
> 与 `docs/seafood.master-plan.md` §3.1（领域模型草案，明确标注「正式口径由 Jing 落 spec」）冲突时，**以本文件为准**。
> **制定者**：Jing（制度员） | **裁定者**：Kevin | **落库实现**：Kong | **质检**：Neng
> **冻结日期**：2026-09-27（CST）

---

## 目录

- [§0 元信息、适用范围与阅读约定](#0-元信息适用范围与阅读约定)
- [§1 术语与记账符号冻结](#1-术语与记账符号冻结)
- [§2 三张核心表数据契约](#2-三张核心表数据契约)
- [§3 币种语义与生命周期状态机](#3-币种语义与生命周期状态机)
- [§4 余额语义：balance / frozen 与三态记账](#4-余额语义balance--frozen-与三态记账)
- [§5 ledger_entry.kind 全量枚举与借贷双方](#5-ledger_entrykind-全量枚举与借贷双方)
- [§6 幂等键规则](#6-幂等键规则)
- [§7 事务边界](#7-事务边界)
- [§8 金额表示与 decimals](#8-金额表示与-decimals)
- [§9 append-only 不可变约束](#9-append-only-不可变约束)
- [§10 并发规则与负余额禁令](#10-并发规则与负余额禁令)
- [§11 对账判据与判负能力](#11-对账判据与判负能力)
- [§12 索引清单](#12-索引清单)
- [§13 平台账户建模](#13-平台账户建模)
- [§14 统一错误码清单](#14-统一错误码清单)
- [§15 待 Kevin 拍板清单](#15-待-kevin-拍板清单)
- [§16 未能核实 / 未实测诚实清单](#16-未能核实--未实测诚实清单)
- [§17 规则总索引 R1..Rn](#17-规则总索引-r1rn)
- [§18 变更记录](#18-变更记录)
- [§19 已裁定口径登记（Zang · P1a 收口）](#19-已裁定口径登记zang--p1a-收口)

---

## §0 元信息、适用范围与阅读约定

### 0.1 本册覆盖什么

本册覆盖 P1「账本内核」的全部数据契约与规则：`currency` / `account` / `ledger_entry` 三张核心表、币种语义、余额语义、分录分类、幂等、事务边界、金额表示、不可变性、并发、对账、索引、平台账户、错误码。

### 0.2 本册**不**覆盖什么（避免被当成本册遗漏）

| 不覆盖项 | 归属 |
|---|---|
| 订单状态机（job / listing / market_order 的生命周期流转） | P3/P4/P5 各自的 spec |
| 返佣权重矩阵的具体数值与账龄分档 | P2 spec（本册只冻结「佣金池如何流入 / 流出」的账务部分） |
| 邀请关系绑定（`referral_edge` / `referral_closure`） | P2 spec |
| 用户表 / 身份 / 登录与会话 | P0 身份 spec（本册只引用 `uID`）〔**v0.4 注**：业务身份表已由 migration `0006` 从 `public.user` 改名为 **`public.users`**（关联对象 `users_pk` / `users_evm_uniq` / `idx_users_evm_lower` / `users_uid_seq` 一并改名；**列名未动**，`uid` 为 `bigint`）。建表语句由 `backend-ts/migrations/0002_user_identity.sql` 提供〕 |
| 前端展示、i18n 文案、符号渲染 | P7 视觉 spec |
| 后台运营面板的字段与权限 | P6 spec |

### 0.3 阅读约定

1. **每条规则一个编号**，格式固定为：`编号 | 口径 | 落点建议 | 连带影响`。
2. **状态列**只有两种取值：
   - **【已冻结】** = 来自 Kevin 已拍板的 D1–D8 与术语冻结表，**不得自行改动**；
   - **【待拍板】** = 本册给出的建议值，标「一句话可改」，Kevin 一句话即可推翻。
3. **落点建议**给出的是「表 / 字段 / 约束 / 索引 / 函数名 / 文件路径」级别的锚点，不是实现代码。本册不写 TypeScript 实现。
4. 出现 `⚠️ 仲裁` 标记 = 上层口径之间存在冲突或缺口，本册已给出建议裁决与理由。
5. 本册所有金额示例均以**最小单位整数**书写（见 §8），不使用小数点。

### 0.4 与已冻结口径的继承关系

| 冻结项 | 本册的承接位置 |
|---|---|
| D1（保留 Express + Vercel，访问层升级为支持交互式事务的连接池） | §7 事务边界、§10 并发、§16 未实测 #2/#3 |
| D6（酬金 1%–5% 全额进佣金池，平台不抽成） | §5 kind `job_fee`/`commission`、§13 佣金池账户 |
| D7 —— **手续费消耗不可退** ✅ 承继；**保证金「冻结可退」❌ 已于 v0.2 被 Kevin 原文推翻** | §4 三态记账、§5 `listing_deposit` / ~~`listing_deposit_forfeit`~~（**v0.3 已删**，见 §19.8.B）/ `trade_fee`；保证金性质的更正见 §3.1 R31（v0.2）与 §19.0 |
| 术语冻结（`$` = 系统币、自建单位、招工、打工、商品、交易所） | §1 |

---

## §1 术语与记账符号冻结

### 1.1 账务术语表（本册专用，与 master-plan §2 的界面术语并存）

| 术语 | 定义 |
|---|---|
| **主体（owner）** | 账户的持有人。真实用户 = `uID > 0`；平台主体 = `uID = 0`；平台内部账户 = 保留负区间（见 §13）。 |
| **账户（account）** | 主体在**某个币种**上的余额容器，唯一键 `(uID, cID)`。 |
| **分录（ledger_entry）** | 一次余额变动的**不可变**记录行。一笔业务 = 1..N 条分录，且必须落在同一事务内。 |
| **减方（debit side）** | 本次变动中**余额减少**的一方。 |
| **增方（credit side）** | 本次变动中**余额增加**的一方。 |
| **托管（escrow）** | 招工场景：雇主把酬金从「可用」移入「冻结」，尚未支付给打工人。 |
| **冻结（hold）** | `balance → frozen` 的同账户搬运，钱仍属于本人。 |
| **解冻（release）** | `frozen → balance` 的同账户搬运。 |
| **罚没（forfeit）** | `frozen → 平台罚没账户`，钱离开本人且不返还。 |
| **冲正（reversal）** | 对已落盘分录的纠错方式：追加一条**等额反向**分录，永不修改/删除原分录。 |
| **净增发（net issuance）** | 本次操作后，全系统该币种的总量增加（`mint`）或减少（`burn`）。 |

### 1.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R1** | 本账本**不使用**「借方 / 贷方」会计术语，一律用**减方 / 增方**，避免与用户视角的「进出账」混淆。所有 kind 说明表必须用减方/增方列。 | 本册 §5 表格列名；代码注释与 API 文档 | 前端「账单」页的进出方向直接由 `delta` 正负号决定，不引用借贷方向 | 待拍板（命名，一句话可改） |
| **R2** | `$` 为平台基础积分 / 系统币，唯一符号 = 字母 `S` + 竖划线，`currency.owner_uid = 0`，`cid = 1`（库内列名为 R22 规定的 snake_case；对外的 `uID` / `cID` 是 API 层命名）。 | `currency` 表冻结行；前端 `CurrencyGlyph` | 所有手续费、保证金、交易所成交费一律以 `$` 计价 | 已冻结（术语表）+ cid=1 为待拍板 |
| **R3** | 「社区积分 / 自建单位」= `currency.owner_uid > 0` 的币种，符号由创建者自定义（如 `dashJ`），**不是**系统币的别名。 | `currency.owner_uid` 语义 | 后台文案、交易所币对命名、`CurrencyGlyph` 泛化 | 已冻结 |
| **R4** | 「招工 / 打工」是**唯一**触发平台手续费与 10 级返佣的场景；其他任何 kind 都不得产生 `job_fee` / `commission`。 | §5 kind 表；佣金池的唯一入账来源 = `job_fee` | 分佣逻辑只在 `job_payout` 事务内出现，交易所与商品模块不得调用它 | 已冻结（D6）+ 术语表 |
| **R5** | 账务层所有时间戳统一 `timestamptz`，由 DB `NOW()` 生成，**不接受**客户端传入时间作为记账依据。 | `time_created` / `time_updated` 默认值 | 「账龄分档」（P2 权重）以 `commission_payout.time_created` 为准 | 待拍板（一句话可改） |

---

## §2 三张核心表数据契约

### 2.1 DDL 片段（**是 DDL 口径，不是实现**；落点为 P0 版本化 migration）

> ⚠️ 本册只给 DDL 形状与约束。实际落盘路径建议 `backend-ts/migrations/0001_ledger_core.sql`（P0 需先建 migration 目录与版本表，见 §16 未实测 #1）。

```sql
CREATE TABLE currency (
  cid            bigint      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  symbol         text        NOT NULL,
  name           text        NOT NULL,
  icon_url       text        NOT NULL DEFAULT '',
  owner_uid      bigint      NOT NULL DEFAULT 0,
  decimals       smallint    NOT NULL DEFAULT 0,
  total_supply   bigint      NOT NULL DEFAULT 0,
  supply_cap     bigint,
  status         text        NOT NULL DEFAULT 'draft',
  deposit_amount bigint      NOT NULL DEFAULT 0,
  deposit_cid    bigint      NOT NULL DEFAULT 1,
  listed_at      timestamptz,
  time_created   timestamptz NOT NULL DEFAULT now(),
  time_updated   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT currency_symbol_uniq   UNIQUE (symbol),
  CONSTRAINT currency_symbol_fmt    CHECK (symbol ~ '^[^[:space:]]{1,16}$'),
  CONSTRAINT currency_decimals_rng  CHECK (decimals BETWEEN 0 AND 18),
  CONSTRAINT currency_supply_guard  CHECK (
      total_supply >= 0
      AND (supply_cap IS NULL OR (supply_cap >= 0 AND total_supply <= supply_cap))
  ),
  CONSTRAINT currency_status_enum   CHECK (status IN ('draft','listed','frozen','delisted')),
  CONSTRAINT currency_deposit_guard CHECK (deposit_amount >= 0),
  CONSTRAINT currency_listed_at     CHECK (status = 'draft' OR listed_at IS NOT NULL)
);

CREATE TABLE account (
  uid          bigint      NOT NULL,
  cid          bigint      NOT NULL REFERENCES currency(cid),
  balance      bigint      NOT NULL DEFAULT 0,
  frozen       bigint      NOT NULL DEFAULT 0,
  version      bigint      NOT NULL DEFAULT 0,
  time_created timestamptz NOT NULL DEFAULT now(),
  time_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_pk        PRIMARY KEY (uid, cid),
  CONSTRAINT account_bal_guard CHECK (balance >= 0),
  CONSTRAINT account_frz_guard CHECK (frozen  >= 0)
);

CREATE TABLE ledger_entry (
  txid                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid                 bigint      NOT NULL,
  cid                 bigint      NOT NULL REFERENCES currency(cid),
  delta               bigint      NOT NULL DEFAULT 0,
  frozen_delta        bigint      NOT NULL DEFAULT 0,
  balance_after       bigint      NOT NULL,
  frozen_after        bigint      NOT NULL,
  kind                text        NOT NULL,
  ref_type            text,
  ref_id              bigint,
  idempotency_key     text        NOT NULL,
  request_fingerprint text,
  event_root_key      text,        -- v0.4 新增（P1f F1②）：事件根键归属列；0005 之前写入的行本列为 NULL
  reversal_of_txid    bigint      REFERENCES ledger_entry(txid),
  memo                text        NOT NULL DEFAULT '',
  time_created        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_move_guard    CHECK (delta <> 0 OR frozen_delta <> 0),
  CONSTRAINT ledger_after_guard   CHECK (balance_after >= 0 AND frozen_after >= 0),
  CONSTRAINT ledger_ref_pair      CHECK ((ref_type IS NULL) = (ref_id IS NULL)),
  CONSTRAINT ledger_idem_uniq     UNIQUE (idempotency_key),
  CONSTRAINT ledger_event_root_guard CHECK (        -- v0.4 新增（P1f F1②）结构性守卫
      event_root_key IS NULL OR event_root_key = split_part(idempotency_key, '#'::text, 1)),
  CONSTRAINT ledger_reversal_guard CHECK ((kind = 'reversal') = (reversal_of_txid IS NOT NULL)),
  CONSTRAINT ledger_kind_enum     CHECK (kind IN (
      'mint','burn','transfer','hold','hold_release','hold_forfeit',
      'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
      'purchase','sale','purchase_refund',
      'trade','trade_fee',
      'listing_fee','listing_deposit',
      -- v0.2 更正：移除 'listing_deposit_refund'（保证金改为消耗不可退，不存在退还 kind，见 §3.1 R31 / §19.0）
      -- v0.3 更正：移除 'listing_deposit_forfeit'（P1c 裁定：保证金上市时即消耗 ⇒ 强制下架无可罚没标的物，见 §5.1 #21 / §19.8.B）
      'currency_create_fee','reversal'
  )),
  CONSTRAINT ledger_ref_type_enum CHECK (ref_type IS NULL OR ref_type IN (
      'job','listing','listing_order','market_order','market_trade','currency','commission_payout','system'
  ))
);

CREATE UNIQUE INDEX ledger_reversal_of_uniq
  ON ledger_entry (reversal_of_txid) WHERE reversal_of_txid IS NOT NULL;

-- v0.4 新增（P1f F1②）：事件根键归属列索引（重放判定走本列精确等值 ⇒ 索引可用）
CREATE INDEX idx_ledger_event_root_key ON ledger_entry (event_root_key);
```

> ⚠️ **v0.3 事实更正（实测取证，非提案）**：上列 `ledger_kind_enum` **不是 PostgreSQL enum 类型**，而是 `ledger_entry.kind`（`text`）上的 **CHECK 约束**。本库实测：`information_schema.columns` 中 `ledger_entry.kind` 为 `data_type = 'text'` / `udt_name = 'text'`；`pg_constraint` 中 `ledger_kind_enum` 的 `contype = 'c'`（CHECK）、`def` 形如 `kind = ANY (ARRAY[...])`；`pg_type` 中**无** `typname LIKE '%ledger_kind%'` 的行。⇒ **删 kind 的手段 = 约束替换**（`ALTER TABLE ledger_entry DROP CONSTRAINT ledger_kind_enum;` + `ADD CONSTRAINT ledger_kind_enum CHECK (...)`），**不是** `ALTER TYPE`（PostgreSQL 本就不支持删 enum 值；且本库无该类型可改）。实作见 `backend-ts/migrations/0003_kind_close_set_20.sql`；裁定登记见 §19.8.A。
> 📌 **v0.2 旧写法（留痕，仅措辞）**：本册 v0.2 及以前对 `ledger_kind_enum` 的引用**未显式声明「它是 CHECK 约束而非类型」**，约束名里的 `_enum` 易被读作「同名 enum 类型」。经逐字核查，本册正文**没有**把它直述为「enum 类型」的句子（§2.2 R17 / §15 #16 早已明写「**不使用** PostgreSQL `ENUM` 类型」，与实测一致）——故本次是**补明确标注 + 补「删 kind 的操作手段」**，不是推翻 v0.2。凡以「enum 类型」描述 `ledger_kind_enum` 之处，**一律以本块为准**。
> ✅ **v0.3 值集 = 20 个，与 `0003_kind_close_set_20.sql` 逐字一致**：`mint` / `burn` / `transfer` / `hold` / `hold_release` / `hold_forfeit` / `job_escrow` / `job_escrow_refund` / `job_payout` / `job_fee` / `commission` / `purchase` / `sale` / `purchase_refund` / `trade` / `trade_fee` / `listing_fee` / `listing_deposit` / `currency_create_fee` / `reversal`。

> 🆕 **v0.4 增补（P1f F1②，实测落地于 `backend-ts/migrations/0005_ledger_event_root_key.sql`）——`ledger_entry.event_root_key`（事件根键归属列）**：
> ① **列**：`event_root_key text`（可空）。函数在**每一条**分录上写入其事件根键（事件内派生分录与其根键共用一值）；`0005` 之前写入的行本列为 **NULL**（历史数据，清理由后续单负责）。
> ② **索引**：`idx_ledger_event_root_key ON ledger_entry (event_root_key)` —— 重放判定由「字符串前缀算术」改为「本列精确等值」后，才**首次**有了可用索引（v0.3 旧写法：`left(idempotency_key, length($1)+1) = $1 || '#'`，**无索引可用且语义错误**）。
> ③ **守卫 CHECK**：`ledger_event_root_guard CHECK (event_root_key IS NULL OR event_root_key = split_part(idempotency_key, '#'::text, 1))` —— 归属列必须等于「按派生规则 `<key>#<i>` 从键反解出的根键」，杜绝将来写入错误的归属（历史行 NULL 通过）。
> ④ **查询口径（冻结）**：**归属列优先，历史行按 `idempotency_key` 精确等值兜底** —— `WHERE event_root_key = $1 OR (event_root_key IS NULL AND idempotency_key = $1)`。**禁止**再用任何形式的前缀/`LIKE`/`left()` 家族匹配（那正是 F1 缺陷的根因，见 R52 v0.4 块）。
> ⑤ 结构守卫的**反例读数**：`wrong_root_rows = 0`、`guard_constraint = 1`（F1 用例 §5）。

### 2.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R6** | `currency.cid` = `bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`。用 **BY DEFAULT**（不是 ALWAYS），因为 `$` 必须能被显式插入为 `cid = 1`。 | `currency.cid` | `$` 的种子行由 migration 显式插入；不得依赖「先插用户币种再补 $」的顺序 | 待拍板（一句话可改） |
| **R7** | `currency.symbol` **全局唯一**（`UNIQUE`），格式 `^[^\s]{1,16}$`（1–16 个非空白字符），比较**区分大小写**（`dashJ` ≠ `dashj`）。 | `currency_symbol_uniq` / `currency_symbol_fmt` | 币种选择器、URL（`/market?c=dashJ`）、前端 `CurrencyGlyph` 都依赖唯一符号 | 待拍板（可改：改为大小写不敏感用 `UNIQUE (lower(symbol))`） |
| **R8** | `currency.decimals` = `smallint NOT NULL DEFAULT 0`，取值 `0..18`。`decimals` **只用于展示与输入换算**，绝不参与存储（见 §8）。 | `currency_decimals_rng` | 前端输入框小数位校验、`lib` 层的字符串↔最小单位转换函数 | 待拍板（上限 18 可改） |
| **R9** | `currency.total_supply` = **已铸总量**（由 `mint`/`burn` 在**同一事务内**维护的计数器），`>= 0`；`supply_cap` = 供给上限，`NULL` 表示**无限供给**。$ 的 `supply_cap = NULL`（平台可无限铸）；用户自建单位创建时**必须**指定 `supply_cap`（不得为 NULL）。 | `currency_supply_guard`；`mint` 分支内的原子 `UPDATE currency SET total_supply = total_supply + n` | `total_supply` 与分录是**双写**关系，必须同事务；对账脚本需同时校验 `total_supply == sum(mint) - sum(burn)`（见 §11 判据 4） | 待拍板（用户币必须设上限这一点一句话可改） |
| **R10** | `currency.status` 四态字符串枚举：`draft / listed / frozen / delisted`；`listed_at` 在首次进入 `listed` 时写入，之后**不再清空**（`status = 'draft'` 时可为 NULL）。`deposit_amount`（$ 最小单位整数）与 `deposit_cid`（当前恒 `= 1`）记录**上市保证金口径**（实际冻结发生在用户账户 `frozen`，见 §5/§13）。 | `currency_status_enum` / `currency_listed_at` / `deposit_amount` | 后台「币种管理」页的状态列直接读 `status`；交易所只允许 `listed` 币种挂单 | 待拍板（状态名可在 P5 前改，但要一次改完） |
| **R11** | `account` 主键 = `(uid, cid)` 复合主键，**不设单独自增 id**。`uid` `bigint NOT NULL`（真实用户 `> 0`，平台主体 `= 0`，平台内部账户取负值，见 §13）。 | `account_pk` | 所有余额读写都必须带 `(uid, cid)` 两参数，路由层不得只按 `uid` 查 | 待拍板（uid 用 bigint 而非 legacy `integer`，见 §16 未实测 #6） |
| **R12** | `account.balance`（可用）与 `account.frozen`（冻结）都是 `bigint NOT NULL DEFAULT 0`，且**必须** `CHECK >= 0`。二者**不是**互斥字段，同一账户可同时有余额和冻结额。 | `account_bal_guard` / `account_frz_guard` | 这是「负余额禁令」的最后一道 DB 兜底（见 §10 R80）；应用层必须先校验再扣，不得依赖报错当流程 | 已冻结（D7 保证金=冻结 $ 可退） |
| **R13** | `account.version` = `bigint NOT NULL DEFAULT 0`，乐观锁版本号。**只有**加分录的事务才能推进它；`UPDATE account SET ..., version = version + 1`。 | `account.version` | 提供除 `FOR UPDATE` 之外的第二条互斥手段；用于「无长事务」的轻量写路径（如单账户铸币） | 待拍板（可用可不用，一句话可改） |
| **R14** | `ledger_entry` **没有** `time_updated`，也不允许出现任何「更新」语义字段（`status` / `is_deleted` / `voided` 一律禁止）。冲正通过 `reversal_of_txid` 表达，不通过状态位。 | `ledger_entry` 字段集 | 前端账单页不得靠「状态」隐藏行，只能用 `reversal` 分录成对展示 | 已冻结（append-only 铁律） |
| **R15** | `ledger_entry` 同时持有 **`delta`（可用余额变动）** 与 **`frozen_delta`（冻结余额变动）** 两个金额列，允许其中任一为 0，但**不允许同时为 0**。 | `ledger_move_guard`；§4 三态记账 | ⚠️ 仲裁：master-plan §3.1 草案只写了 `delta` + `balance_after`。若只保留单一 delta，则「卖家挂单冻结的钱直接付给买家」这类变动无法在不经手可用余额的前提下记账（会凭空让卖家可用余额先涨后跌，产生假流水）。故本册**扩展为双列**。 | 待拍板（**这是本册最重要的扩展**，一句话可改） |
| **R16** | `ledger_entry.balance_after` 与 `frozen_after` = 该笔分录落账后该账户的**可用/冻结余额快照**，`NOT NULL` 且 `>= 0`。(uID, cID, txid) 降序取最新一行必须等于 `account` 当前值（见 §11 判据 2）。 | `ledger_after_guard`；流水分页查询 | 快照让「任意历史时点余额」可在 O(1) 读取；对账脚本用最新快照做快速比对、用全量 sum 做权威比对 | 待拍板（`frozen_after` 为新增列） |
| **R17** | `kind` 用 **`text` + `CHECK (... IN (...))`** 表达，**不使用** PostgreSQL `ENUM` 类型。新增 kind = 一次可审计的 migration（改 CHECK 约束），不接受应用层动态 kind。 | `ledger_kind_enum` | 后台不得提供「自定义分录类型」；每加一个 kind 必须同时在本册 §5 登记减方/增方与是否净增发 | 待拍板（可改：用 `ledger_kind` 字典表 + FK，但会丢失「改 kind 必须走 migration」的强制力） |
| **R18** | `ref_type` 与 `ref_id` **成对出现或成对为 NULL**（`CHECK ((ref_type IS NULL) = (ref_id IS NULL))`）；`ref_type` 取值受 `ledger_ref_type_enum` 白名单约束。严禁把「订单号」塞进 `memo` 代替 `ref_id`。 | `ledger_ref_pair` / `ledger_ref_type_enum` | 业务单据页的「相关流水」入口由 `(ref_type, ref_id)` 索引支撑（见 §12 R95） | 待拍板（白名单取值可增可改） |
| **R19** | `idempotency_key` `text NOT NULL` + `UNIQUE`；`request_fingerprint` `text NULL`（存放请求体指纹，用于区分「同键同请求」与「同键不同请求」）。`memo` `NOT NULL DEFAULT ''` 供人读，**不参与任何逻辑判断**。 | `ledger_idem_uniq` | 幂等语义见 §6；`UNIQUE` 是「防重复扣款」的最终屏障 | 已冻结（master-plan §3.1「幂等：所有写接口必须带 idempotency_key」） |
| **R20** | 冲正用 `reversal_of_txid`（自引用 FK）表达，且加**部分唯一索引** `UNIQUE (reversal_of_txid) WHERE NOT NULL` ⇒ 一条分录**最多只能被冲正一次**。冲正分录自身不得再被冲正（应用层 + §9 trigger 校验）。 | `ledger_reversal_of_uniq`；kind `reversal` | 纠错流程 = 追加 + 反转，绝不 UPDATE；对账脚本必须能把「原分录 + 冲正分录」配对，净额为 0 | 待拍板（一句话可改） |
| **R21** | **不**对 `account.uid` / `ledger_entry.uid` 建 FK 到 legacy `"users"` 表：实测 `"users".uid` 在 v0.1 实测时是 **`text`** 列，而 `asset`/`shard` 用 `integer`，类型已经分叉〔**v0.4 更正（D11 落位）**：身份表已由 migration `0006_user_to_users.sql` 改名为 **`public.users`**（关联对象 `users_pk` / `users_evm_uniq` / `idx_users_evm_lower` / `users_uid_seq` 一并改名）；**列名未动**，且该列现为 **`bigint`** —— v0.1 所说的 `text`/`integer` 类型分叉**已由 `backend-ts/migrations/0002_user_identity.sql` 消除**，故「类型收敛」不再是待办〕。建议新增轻量表 `ledger_owner(uid bigint PRIMARY KEY, owner_type text, name text, time_created timestamptz)`（`owner_type IN ('user','platform')`）承载 FK，并把平台负 uid 登记在内。 | `ledger_owner`（可选第 4 张辅助表）；P0 用户表规范 | ⚠️ 连带：`"users".uid` 从 `text` 收敛为 `bigint`〔**v0.4**：该收敛已由 `0002_user_identity.sql` 完成〕会牵动 50 条路由里所有 `"uID"` 比较（`src/database.ts` 现有多处 `BTRIM("uID")::int`）；这一步属于 P0 身份 spec，不在本册范围。**〔v0.8 范围限定（§5.20 #6 裁定）**：本条**只管账本表**（`account` / `ledger_entry`）—— 它们的 `uid` 含**合成负值**（平台账户 `0 / −1 / −2 / −3`，见 §13），故**不建** FK 到 `users`；**业务表不受本条约束、可以 FK 到 `users(uid)`**（例：P2 的 `referral.child_uid` / `parent_uid`，见 `docs/commission.spec.md` v0.2 §2）。⇒ 本条标题应读作「**账本表**不对 `users(uid)` 建 FK」】** | 待拍板（可改：先不建 FK，仅保留应用层校验） |
| **R22** | 三张新表**统一 snake_case 无引号**列名（`uid` / `cid` / `balance` / `frozen` / `delta` / `time_created`）；对外 API(JSON) 仍用 camelCase（`uID` / `cID`），映射在路由层完成。 | 三张表的列名 | ⚠️ 与 legacy 表（`"uID"` / `"bID"` / `"sID"` 带引号驼峰）风格不一致；混用两套风格时必须**在 SQL 里始终给 legacy 列加双引号**。选 snake_case 的理由：带引号驼峰在 TS 模板字符串与第三方工具里极易漏引号而导致 `column "uid" does not exist` 型事故 | 待拍板（一句话可改回 `"uID"` 风格） |

---

## §3 币种语义与生命周期状态机

### 3.1 `$` 与「用户自建单位」的差异矩阵（**本册核心口径**）

| 维度 | `$`（系统币） | 用户自建单位（如 `dashJ`） |
|---|---|---|
| 判定方式 | `owner_uid = 0`（且 `cid = 1`） | `owner_uid > 0` |
| 谁可 `mint` | **仅平台**（后端受信任路径 / 管理员角色，`uid = 0` 主体） | **仅该币种的 `owner_uid`**，且只能铸造到自己的账户 |
| 供给上限 | `supply_cap = NULL`（无限，平台可无限铸） | **必须有 `supply_cap`**（创建时必填，> 0） |
| `decimals` | 建议 `0`（整数积分） | 创建者自定，`0..18` |
| 可否下架 | **不可**（`status` 恒为 `listed`，不允许 `frozen`/`delisted`） | 可 `draft / listed / frozen / delisted` |
| 计价角色 | 一切手续费、保证金、成交费的**唯一**计价与扣除币种 | 只能作为商品/招工的**标价单位**、交易所的 base 币 |
| 谁能改元数据 | 平台（后台） | 创建者（`name` / `icon_url`）；`symbol` / `decimals` / `supply_cap` **创建后不可改** |

### 3.2 状态机

```text
draft ──上市(缴上市费+缴保证金·消耗)──▶ listed ──合规冻结──▶ frozen ──解冻──▶ listed
                                       │                          │
                                       └──────下架(保证金不退)──────┴──▶ delisted(终态)
draft ──放弃/下架──▶ delisted(终态)
```

允许的转移（**除此之外一律拒绝**）：

| from → to | 触发 | 必须同事务做的账务动作 |
|---|---|---|
| `draft → listed` | 创建者提交上市 | `currency_create_fee`（若适用）+ `listing_fee` + `listing_deposit`（**消耗**：`$` 从创建者 `balance` 扣，记 `delta` 负数并转入 `uid = −1`）〔v0.1 旧写法：`listing_deposit`（冻结）〕 |
| `listed → frozen` | 平台合规冻结 | 无账务动作（**不**动 user 余额；已挂单需另行撤销，见 R28） |
| `frozen → listed` | 平台解冻 | 无账务动作 |
| `listed / frozen → delisted` | 下架（创建者申请或平台强制） | 正常下架：**无账务动作**（保证金已在上市时消耗，**不退**）〔v0.1 旧写法：`listing_deposit_refund`（解冻退回）—— 该 kind 已于 v0.2 删除，见 §5.1〕；**强制下架亦无账务动作**（保证金已消耗 ⇒ 不存在可罚没的标的物）〔**v0.3 更正**：原此处为「强制下架：`listing_deposit_forfeit`（⚠️ 保证金已改消耗 ⇒ 该 kind 的标的物待澄清，见 R31 v0.2 留白）」—— 该 kind 已于 v0.3（P1c）删除，见 §5.1 #21 / §19.8.B〕 |
| `draft → delisted` | 放弃创建 | 无 |

### 3.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R23** | `mint` 的授权判定 = 「`currency.owner_uid` 与操作用户 `uid` 相等，**或** `owner_uid = 0` 且调用方是平台受信任路径」。自建单位铸造**只能铸造到 owner 自己的账户**（不允许 owner 直接铸给他人）。 | `mint` 服务函数的授权分支；错误码 `LEDGER_UNAUTHORIZED_MINT` | owner 想让别人拿到币，必须走 `transfer`（留转移流水），杜绝「铸给他人」把发行记录搅浑 | 待拍板（一句话可改） |
| **R24** | `mint` 必须校验 `supply_cap`：`total_supply + n <= supply_cap`，超限拒绝（`LEDGER_SUPPLY_CAP_EXCEEDED`）。`$` 因 `supply_cap IS NULL` 天然不受限。 | `currency_supply_guard` + 事务内 `SELECT ... FOR UPDATE` 锁 `currency` 行 | 铸造是**双写**（`currency.total_supply` + `account.balance` + 分录），必须在同一事务内；并发铸造靠 `currency` 行锁串行 | 待拍板（一句话可改） |
| **R25** | `burn` **只有持有人本人**可发起，只能销毁自己 `balance` 中的币（不能销毁 `frozen` 里的）。`$` 的 `burn` 仅平台可发起。 | `burn` 服务函数；`ledger_move_guard` | 烧币会减少 `currency.total_supply`；`total_supply` 与 `sum(mint) - sum(burn)` 的对账判据（§11 判据 4）必须仍成立 | 待拍板（一句话可改） |
| **R26** | **`$` 的状态恒为 `listed`**：migration 种子行写死，且服务层禁止把 `cid = 1` 改为 `frozen` / `delisted`。 | `currency` 种子行；R28 的操作矩阵白名单 | 平台不会因为误操作把整个计价体系冻结 | 待拍板（一句话可改） |
| **R27** | 状态转移**只允许** §3.2 表中列出的 5 条；其余组合（含 `delisted → *`、`listed → draft`）一律返回 `LEDGER_CURRENCY_INVALID_TRANSITION`。转移必须落 `currency.status` + `time_updated`。 | 服务层状态机校验函数（建议名 `assertCurrencyTransition(from, to)`） | 后台面板的状态下拉**不得**直接写 `status`，必须走状态机接口 | 待拍板（一句话可改） |
| **R28** | 「状态 × 操作」矩阵（**逐格判定，不允许实现自选**）：<br>`mint`（owner 铸币）：`draft`✅ `listed`✅ `frozen`❌ `delisted`❌<br>`transfer`（用户间转账）：`draft`✅ `listed`✅ `frozen`✅ `delisted`✅（存量持仓永远可转）<br>`hold` / 交易所挂单：`draft`❌ `listed`✅ `frozen`❌ `delisted`❌<br>商品标价：`draft`❌ `listed`✅ `frozen`❌ `delisted`❌<br>招工酬金计价：`draft`❌ `listed`✅ `frozen`❌ `delisted`❌<br>✅ **已裁定（Zang · P1a 收口，登记见 §19.3）**：本矩阵**只定义了 5 个操作**（`mint` / `transfer` / `hold` / 商品标价 / 招工酬金计价），**未覆盖 `hold_release` 与结算类**。裁定：**`hold_release` 四态全可**（`draft`/`listed`/`frozen`/`delisted` 均可；依据 §7.2 #14「下架必须撤销挂单并解冻」——否则撤单会卡死在 `delisted` 币种上）；**结算类（`job_payout` / `purchase` / `sale` / `trade` / `hold_forfeit` 等）与 `hold` 同档 —— 仅 `listed`**。 | 服务层 `assertCurrencyOperable(cid, op)`；错误码 `LEDGER_CURRENCY_NOT_LISTED` / `LEDGER_CURRENCY_FROZEN` / `LEDGER_CURRENCY_DELISTED` | 前端币种选择器必须按此矩阵过滤可选项，不得展示不可用币种 | 待拍板（**四态 × 五操作矩阵允许调整，但必须整表一次定性**） |
| **R29** | `frozen` 是**平台合规冻结**（涉诈/违规调查），**不是**用户可自行触发的操作；解冻同样只能平台发起。冻结/解冻**不产生任何账务分录**（不动 balance/frozen，用户钱仍在），但**必须**写一条 `app_config` 之外的审计记录（建议 `currency_status_log` 或在后台操作日志表）。 | `currency.status`；后台操作日志表（P6 spec 定字段，本册只要求「必须留痕」） | 用户侧余额页面在币种 `frozen` 时应显示「该单位已暂停交易」而非隐藏余额 | 待拍板（一句话可改） |
| **R30** | `delisted` 是**终态**：不可复活，如要恢复必须**新建币种**（新 `cid`，新 `symbol` 也不行，因为 `symbol` 仍被旧行占用）。因此下架时**必须**同时处理该币种的未成交挂单（全部撤销 + 解冻）。 | 状态机校验 + 下架事务（见 §7 R62） | 下架事务必须扫 `market_order` 中该 `cid` 的活跃挂单；数量级大时需分批，但**每批仍是独立事务**，不允许跨批冻结资金 | 待拍板（一句话可改） |
| **R31** | 「上市收费」拆成两笔**性质不同**的动作，且都必须在下架时口径明确：<br>① `listing_deposit` = **消耗** `deposit_amount` 的 `$`（**不可退** ⇒ 记 `delta` 负数，转入平台手续费归集账户 `uid = −1`，即**计入平台收入**）；<br>② `listing_fee` / `currency_create_fee` = **消耗** `$`（不可退 ⇒ 记 `delta` 负数，转入 `uid = −1`）。<br>✅ **v0.2 更正（依据 Kevin 原文）**：Kevin 原文「用户自定义的社区积分如需上市，需要**消耗**一定的积分作为保证金」⇒ **保证金是消耗、计入平台收入；不存在可退保证金；`listing_deposit_refund` 这个 kind 不存在**（kind 关闭集 22 → 21，见 §5.1）。<br>📌 **v0.1 旧写法（留痕，不删）**：`listing_deposit` = *冻结* `deposit_amount` 的 `$`（「D7：可退 ⇒ 记 `frozen_delta`」）；下架时以 `listing_deposit_refund`（解冻退回）；平台「上市相关收入」由 `listing_fee` / `currency_create_fee` 承载、**不含**在冻的 `listing_deposit`。→ 该写法与 Kevin 原文冲突，**作废**。<br>⚠️ **D6/D7 仲裁（v0.2 版）**：D6「上市保证金计入平台收入」✅ 成立；D7 中「保证金冻结可退」的部分 ❌ 被 Kevin 原文推翻（D7 的「手续费消耗不可退」部分不受影响）。 | `currency.deposit_amount`；kind `listing_deposit` / `listing_fee` / `currency_create_fee`〔**v0.3 更正**：原列含 `listing_deposit_forfeit`，该 kind 已于 v0.3（P1c）删除，见 §5.1 #21 / §19.8.B〕 | 后台「平台收入」报表口径 = `sum(trade_fee) + sum(listing_fee) + sum(currency_create_fee) + sum(listing_deposit)`（**v0.2 新增 `listing_deposit`**，v0.1 明确「不含」，现因消耗入 `−1` 而计入）〔**v0.3 更正**：原此处为「+ `sum(listing_deposit_forfeit)`（标的物待澄清）」—— 该 kind 已于 v0.3（P1c）删除，故**平台收入口径不含它**，见 §5.1 #21 / §19.8.B〕 | 已裁定（Zang · P1a 收口；v0.1「待拍板」作废） |

---

## §4 余额语义：balance / frozen 与三态记账

### 4.1 两个余额字段的语义

| 字段 | 语义 | 谁能减少它 | 是否属于本人 |
|---|---|---|---|
| `account.balance` | **可用余额**：立即可花、可转、可被任何 kind 扣减 | 任何以本人为减方的分录 | 是 |
| `account.frozen` | **冻结余额**：已按某个业务事件锁定，**所有权仍属本人**，但只能按该业务的方向流出（解冻回可用 / 支付给对方 / 被罚没） | 只能由 `hold_release` / 支付类 kind / `hold_forfeit` 减少 | 是（平台上「在冻总额」不是平台资产） |

**恒等式（每个 `(uid, cid)` 独立成立）**：
```
account.balance = Σ ledger_entry.delta
account.frozen  = Σ ledger_entry.frozen_delta
account.balance + account.frozen = 该账户的净资产
```

### 4.2 三态记账规则表

| 动作 | 减方 | 增方 | `delta` | `frozen_delta` | 净增发 |
|---|---|---|---|---|---|
| **冻结** `hold` | 本人 `balance` | 本人 `frozen` | `−n` | `+n` | 0 |
| **解冻** `hold_release` | 本人 `frozen` | 本人 `balance` | `+n` | `−n` | 0 |
| **罚没** `hold_forfeit` | 本人 `frozen`（或 `balance`） | 平台罚没账户 `uid = −3` 的 `balance` | `−n`（罚可用）或 `0` | `−n`（罚冻结） | 0 |

`hold` / `hold_release` 的**减方与增方是同一个主体**，因此**必须写成两条分录**（一条 `delta` 负、一条 `delta` 正），不能只写一条「net 0」的行 —— 否则流水分页会看不到资金去向。

### 4.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R32** | 一切扣款（转账、购买、手续费、保证金、成交费）**只能从 `balance` 扣**；`frozen` 永不作为自动扣款来源。 | 服务层 `debitAvailable()` 唯一入口 | 所有「余额不足」判定只看 `balance`，不看 `balance + frozen`；错误文案要明确区分「可用不足」与「冻结中」 | 已冻结（D7：手续费消耗不可退）〔v0.1 旧写法：「D7 保证金冻结可退」—— 保证金性质已于 v0.2 更正，见 R31〕 |
| **R33** | `frozen` 的**流动方向白名单**：只能流向 ① 同账户 `balance`（`hold_release`）、② 同账户外的合法受款方（`job_payout` 给打工人 / `purchase`/`trade` 给卖方 / `hold_forfeit` 给罚没账户 `uid = −3`，见 §4.2）〔**v0.3 更正**：原列 `listing_deposit_forfeit` 给罚没账户 —— 该 kind 已于 v0.3（P1c）删除，改列实际存在的 `hold_forfeit`，见 §5.1 #21 / §19.8.B〕。任何「frozen → 无关第三方」的路径都属于实现缺陷。 | 服务层冻结出账函数（建议名 `releaseOrSettleFrozen()`）；§5 kind 表的减方列 | 前台「冻结中」的资产必须能在账单里逐笔落到具体业务单（`ref_type`/`ref_id`） | 待拍板（一句话可改） |
| **R34** | 冻结与解冻**必须成对记账**且都为**同事务**：`hold` 的分录与其 `hold_release`（或结算流出）之间不要求同一事务，但**每一次单边变动都必须是完整的会计事件**（一次 hold = 2 条分录，一次 release = 2 条分录）。 | §7 R57 冻结事务 | 「冻结总额」在任何中间态都必须能由流水解释，禁止出现单边分录 | 待拍板（一句话可改） |
| **R35** | **禁止隐式解冻**：当用户可用余额不足时，系统**不得**自动动用 `frozen` 补足（例如「余额不够，自动解冻挂单的钱来付款」）。要动用冻结资金必须是显式的业务动作（撤单/解冻接口）。 | 扣款路径校验；错误码 `LEDGER_INSUFFICIENT_BALANCE` | 前端下单页在可用不足时只能提示，不能提供「用冻结余额支付」的隐式行为 | 待拍板（**这是一条用户可感知的口径**，一句话可改） |
| **R36** | `account.frozen` 只是**聚合投影**，冻结的「归属」真源在业务表（挂单未成交量、招工托管额）〔v0.1 旧写法含 `currency.deposit_amount`（上市保证金）—— 保证金自 v0.2 起为消耗、不进 `frozen`，故不再是冻结归属来源〕。因此**任何解冻都必须由业务表证明对应冻结仍存在**，且本次解冻额 `<=` 业务表记录的在冻额。 | 业务表 ↔ `account.frozen` 的双向对账（§11 判据 5） | ⚠️ 本册**不**新增 `frozen_breakdown` 表（会引入「聚合 + 明细」双真源）；改为「业务表为归属真源，frozen 为投影」 | 待拍板（**本册第三条重要设计裁决**） |
| **R37** | 用户**不能**手动冻结自己的余额；`hold` 只能由业务事件触发（挂单、招工托管）〔v0.1 旧写法含「上市保证金」—— v0.2 起保证金为消耗，不走 `hold`〕。平台合规冻结走 §3 R29（`currency.status`），**不**冻结用户账户余额。 | `hold` 服务函数仅内部可调（不给路由直接暴露）；错误码 `LEDGER_HOLD_NOT_ALLOWED` | 不存在「用户冻结自己余额」的 UI；风控只冻结币种状态 | 待拍板（一句话可改） |
| **R38** | `hold_forfeit` 的**减方可以是 `balance` 或 `frozen`**（由业务决定），但去向**恒为平台罚没账户 `uid = −3`**，且**必须**在 `memo` 写明罚没原因码。罚没**不销毁**（`burn` 才销毁），因为罚没要可审计、可申诉、可退还。 | kind `hold_forfeit`；`account(−3, cid)` | 后台必须有「罚没记录 + 退还」入口；退还 = 反向 `hold_forfeit`（或 `transfer` 从 `−3` 账户转回） | 待拍板（一句话可改） |
| **R39** | 冻结**不计息**、**不产生手续费**、**不跨币种**：`hold` / `hold_release` 的 `(uid, cid)` 必须完全相同（同一账户同一币种），禁止出现「冻结 A 币、解冻 B 币」。 | `hold`/`hold_release` 服务函数参数校验；错误码 `LEDGER_CURRENCY_MISMATCH` | 交易对撮合要锁定的是 base 与 quote **两个**账户，要发**两组** hold 分录，不是一个跨币种动作 | 待拍板（一句话可改） |

---

## §5 ledger_entry.kind 全量枚举与借贷双方

### 5.1 `kind` 全量枚举（**20 个**，**关闭集**）　〔**v0.3 更正**：`listing_deposit_forfeit` 已于 **P1c（v0.3）删除**（kind 关闭集 **21 → 20**），见 §19.8.B；v0.2 旧写法：21 个 —— `listing_deposit_refund` 已于 v0.2 删除，见 R31；v0.1 旧写法：22 个〕

`−` 表示减方（余额减少），`+` 表示增方（余额增加）。`delta` 列指可用余额变动，`frozen` 列指冻结余额变动。

> ⚠️ **行号沿用 v0.1 编号（1..22）以留痕**：其中 **#20 `listing_deposit_refund` 已于 v0.2 作废**、**#21 `listing_deposit_forfeit` 已于 v0.3（P1c）作废删除**，故现存 kind = **20 个**（#1–#19、#22）—— 即 **#20 与 #21 双双作废**（表体保留两行删除留痕，不再计入关闭集）。下游引用 kind 时请用 **kind 名**，不要用行号。

| # | `kind` | 业务场景 | 减方（`delta`/`frozen` 变动） | 增方（`delta`/`frozen` 变动） | 净增发 | 典型 `ref_type` |
|---|---|---|---|---|---|---|
| 1 | `mint` | 铸币 | 系统（无对手方） | owner 本人 `balance +n` | **`+n`** | `currency` |
| 2 | `burn` | 销毁 | 本人 `balance −n` | 系统（无对手方） | **`−n`** | `currency` |
| 3 | `transfer` | 用户间普通转账 | A `balance −n` | B `balance +n` | 0 | `system` |
| 4 | `hold` | 冻结（挂单/托管统一入口）　〔v0.1 旧写法含「保证金」；v0.2 起保证金为**消耗**，不走 `hold`，见 R31〕 | 本人 `balance −n` | 本人 `frozen +n` | 0 | `market_order` / `job` / `currency` |
| 5 | `hold_release` | 解冻 | 本人 `frozen −n` | 本人 `balance +n` | 0 | 同上 |
| 6 | `hold_forfeit` | 罚没 | 本人 `balance −n` **或** `frozen −n` | `uid −3` 罚没账户 `balance +n` | 0 | `currency` / `market_order` |
| 7 | `job_escrow` | 招工托管 | 雇主 `balance −n` | 雇主 `frozen +n` | 0 | `job` |
| 8 | `job_escrow_refund` | 招工流单/拒单退回 | 雇主 `frozen −n` | 雇主 `balance +n` | 0 | `job` |
| 9 | `job_payout` | 酬金支付 | 雇主 `frozen −net` | 打工人 `balance +net` | 0 | `job` |
| 10 | `job_fee` | 酬金手续费（进佣金池） | 雇主 `frozen −fee` | `uid −2` 佣金池 `balance +fee` | 0 | `job` |
| 11 | `commission` | 10 级返佣发放 | `uid −2` 佣金池 `balance −x` | 各受益用户 `balance +x` | 0 | `commission_payout` |
| 12 | `purchase` | 商品购买（买家侧） | 买家 `balance −n` | （与 `sale` 成对） | 0 | `listing_order` |
| 13 | `sale` | 商品成交（卖家侧） | （与 `purchase` 成对） | 卖家 `balance +n` | 0 | `listing_order` |
| 14 | `purchase_refund` | 商品退款 | 卖家 `balance −n` | 买家 `balance +n` | 0 | `listing_order` |
| 15 | `trade` | 交易所成交（同一 `ref` 下 4 条分录） | 买方 `−quote` / 卖方 `−base` | 卖方 `+quote` / 买方 `+base` | 0 | `market_trade` |
| 16 | `trade_fee` | 交易所成交费（消耗 `$`，不可退） | 承担方 `balance −f` | `uid −1` 手续费归集 `balance +f` | 0 | `market_trade` |
| 17 | `listing_fee` | 上市费（消耗 `$`，不可退） | 创建者 `balance −f` | `uid −1` `balance +f` | 0 | `currency` |
| 18 | `currency_create_fee` | 创建自建单位费（消耗 `$`） | 创建者 `balance −f` | `uid −1` `balance +f` | 0 | `currency` |
| 19 | `listing_deposit` | **上市保证金消耗（不可退）**：`$` 从创建者 `balance` 扣、进平台手续费归集账户 `uid = −1`　〔v0.1 旧写法：上市保证金冻结（可退）—— 减方 创建者 `balance −d`、增方 创建者 `frozen +d`〕 | 创建者 `balance −d` | `uid −1` `balance +d` | 0 | `currency` |
| ~~20~~ | ~~`listing_deposit_refund`~~ | **已作废删除（v0.2）**：保证金改为消耗不可退 ⇒ **不存在退还动作，不存在该 kind**　〔v0.1 旧写法：保证金退还 —— 创建者 `frozen −d` → 创建者 `balance +d`〕 | — | — | — | — |
| ~~21~~ | ~~`listing_deposit_forfeit`~~ | **已作废删除（v0.3 · P1c 裁定）**：保证金**在上市时即消耗**（`listing_deposit` 已转入平台收入 `uid = −1`），**强制下架时不存在可罚没的标的物** ⇒ 该 kind 删除。将来若要做「强制下架罚款」，那是**新语义、新 kind**，须单独裁定并登记后再启用。　〔v0.2 旧写法：标「待澄清」，kind 保留在关闭集内、不删；v0.1 旧写法：保证金罚没 —— 创建者 `frozen −d` → `uid −3` `balance +d`〕 | — | — | — | — |
| 22 | `reversal` | 冲正（纠错唯一手段） | 与被冲正分录**完全相反** | 同左 | 仅当冲正 `mint`/`burn` 时非 0 | 同原分录 |
| **新增** | `checkin_makeup_fee` | **补签费（消耗 `$`，不可退）**：`$` 从用户 `balance` 扣、进平台手续费归集账户 `uid = −1`（金额 = `checkin_policy.makeupCostUsd`，默认 `100`；补签事件）　〔**v0.14 新增**（Zang 裁定 `R-9-14`：`kind` 关闭集 **20 → 21**）；迁移 `0028_kind_close_set_21.sql`；详见下方 §5.1 v0.14 就地加注块〕 | 用户 `balance −100` | `uid −1` `balance +100` | 0 | （待 P9② 实现单定） |
| **新增** | `invite_first_task_reward` | **邀请奖励 · 首任务腿（平台收入账户出账）**：完成首个平台任务 ⇒ **邀请双方发放 `10$` 积分**（需求 §6.2②）—— 由平台收入账户 `uid = −1` **出账**、**本人 + 直接上级各 `+firstTaskUsd`**（**无上级只发本人**）〔**v0.15 新增**（Zang 终审 `R-9-65` / `R-9-66`：`kind` 关闭集 **23 → 24**）；迁移 `0038_kind_close_set_24.sql`；详见下方 §5.1 v0.15 就地加注块〕 | `uid = −1` `balance −(perLeg×N)` | 本人 + 直接上级（`referral.parent_uid`）各 `balance +firstTaskUsd` | 0 | （待 P9⑤ 实现单定；触发面 = 首任务结算） |

> **`trade` 的 4 条分录**：买方付 `quote` 收 `base`、卖方付 `base` 收 `quote`。按币种分组后每币种 `Σdelta = 0`〔v0.2 更正：货款从 `frozen` 出时正式形状为 `Σ(delta + frozen_delta) = 0`，见 §11 判据 8 与 §19.2〕。已冻结的挂单资金从 `frozen` 出，未冻结部分从 `balance` 出（`frozen_delta` 与 `delta` 按实际来源分配）。

> **★★ ★ v0.14 就地加注（Zang 裁定 `R-9-14` · P9② 连带）—— `kind` 关闭集 20 → 21（追加 `checkin_makeup_fee`）（2026-10-03）**
> **依据（逐字）**：`docs/seafood.master-plan.md` **§5.230 B** `R-9-14`（`:1428`）+ `docs/data-layer.spec.md` **v0.21 §31.1**（`R-9-14` 就地定案块 · `C3-1`／`C3-2`）。**裁定**：C-3 = **方案 ② 扩容 +1** —— 新 kind **`checkin_makeup_fee`**（**`kind` 关闭集 20 → 21**）；迁移 **`0028_kind_close_set_21.sql`**（**CHECK 重建、非 enum**，手法逐字照 `0003_kind_close_set_20.sql`）；**不真 burn**（`R-9-3`）。
> **① 落位（承 `R40`）**：上行 **追加 1 行**（`| **新增** | checkin_makeup_fee | …`）；**只增不改序、不得改旧行** —— 本 §5.1 标题行（「**20 个**」）、§5.1 行号注记（「现存 kind = **20 个**（#1–#19、#22）」）与 `R40` 正文（「上表 **20 个** `kind` 是关闭集」）**均为 v0.13 旧写法、保留留痕**，**以本块为准** ⇒ **现行 `kind` 关闭集 = 21 个**（`#1–#19` ／ `#22` ／ `checkin_makeup_fee`）。
> **② 三列登记（承 `R40`「同步在本册 §5.1 登记减方/增方/净增发三列」· 逐字承 `docs/data-layer.spec.md` v0.21 §31.1(d)）**：**前 20 值逐字** = `0003:61-66` ／ `0001:76-82` ／ `ledger.ts:153-160`（三处一致之现存集）；**第 21 值** = `checkin_makeup_fee`。**减方** = 用户 `balance −100`（`$` · `cid = 1`）；**增方** = `uid = −1` `balance +100`（**平台收入 · 不真 burn**）；**净增发 = 0**（零净写）。
> **③ DB 侧落点** = 迁移 **`0028_kind_close_set_21.sql`**（`DROP CONSTRAINT ledger_kind_enum` + `ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (… 21 值 …))`；**`ledger_entry.kind` 为 `text`、白名单为 CHECK 约束、非 enum 类型** ⇒ 手段 = 约束替换，见 §2.1 v0.3 事实更正块 ／ §19.8.A）；**本册不改 `src/`、不建迁移文件**（文件由 Kong 建、apply 由 Zang 执行）。
> **④ 影响面（逐字承 `docs/data-layer.spec.md` v0.21 §31.1(e)）**：**§14.1 错误码闭集 33 不动**（非法 kind 仍报既有 `LEDGER_UNKNOWN_KIND` ／ `400`）；既有门零回归；既有账本行零影响。
> **★★ ★ v0.15 就地加注（Zang 终审 `R-9-65` / `R-9-66` · P9⑤ C3）—— `kind` 关闭集 23 → 24（末位追加 `invite_first_task_reward`）（2026-10-03）**
> **依据（逐字）**：`docs/seafood.master-plan.md` **§5.269 C**（`R-9-66` 终审）+ `docs/commission.spec.md` v0.4 §19.5⑦ / §19.11 `R-9-57`（首任务 10$ 两腿 = 完成首任务者本人 + 其直接上级 `parent_uid` 各 10$；无上级 ⇒ 只发本人、平台不吞）。**裁定**：新增 kind **`invite_first_task_reward`**（**`kind` 关闭集 23 → 24**，**末位追加、不改既有次序**）；**资金来源 = `uid = −1` 平台收入账户出账**（`R-9-65`；★ **首次给 `−1` 开 `debit`**，见 §13.3 v0.15 块）；**幂等键 = `biz:invite:firsttask:<worker_uid>`**；**无上级只发本人**。
> **① 落位（承 `R40`）**：上行 **追加 1 行**（`| **新增** | invite_first_task_reward | …`）；**只增不改序、不得改旧行** —— 本 §5.1 标题行（「**20 个**」）、行号注记与 `R40` 正文（「上表 **20 个** `kind`」）、v0.14 加注块（「现行 `kind` 关闭集 = 21 个」）**均为旧写法、保留留痕**，**以本块为准** ⇒ **现行 `kind` 关闭集 = 24 个**（前 23 值逐字不动 + 末位 `invite_first_task_reward`）。
> **② 三处编码（逐字现取 · 三处同集）**：① **DB CHECK** `ledger_kind_enum` = **24 值**（迁移 `0038_kind_close_set_24.sql`：`DROP CONSTRAINT` + `ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (… 24 值 …))`，**CHECK 重建、非 enum**，手法逐字沿 `0003` / `0028` / `0032`）；② **DB `ledger_kind_ok`**（`CREATE OR REPLACE`，**末位追加 1 值**；**`p_frozen_settle` 第二支一字不动**）；③ **TS `LEDGER_KINDS`**（`backend-ts/src/ledger.ts:168-178`，**23 → 24**、末位 `'invite_first_task_reward'`）。
> **③ 三列登记（承 `R40`「同步登记减方/增方/净增发三列」）**：**减方** = `uid = −1` `balance −(perLeg×N)`（`$` · `cid = 1`；`perLeg` = 每腿 `firstTaskUsd`、`N ∈ {1,2}`）；**增方** = 完成首任务者**本人** + **直接上级**（`referral.parent_uid`）各 `balance +firstTaskUsd`（**无上级 ⇒ 仅本人 1 人**、平台不吞）；**净增发 = 0**（平台账户 → 用户的**系统内转移**，零净写）。
> **④ DB 侧落点** = 迁移 **`0038_kind_close_set_24.sql`**（**CHECK 重建** + `CREATE OR REPLACE ledger_kind_ok` + `CREATE OR REPLACE ledger_assert_platform_mutation`（`−1` `debit` 首开）+ 自检；**本册不改 `src/`、不建迁移文件** —— 文件由 Kong 建、apply 由 Zang 执行；**现取状态 = 文件在盘、未 apply**）。
> **⑤ 影响面**：**§14.1 错误码闭集 33 不动**（非法 kind 仍报既有 `LEDGER_UNKNOWN_KIND` / `400`）；既有门零回归；既有账本行零影响（**只增 kind 值**）。

### 5.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R40** | 上表 **20 个** `kind` 是**关闭集**〔**v0.3（P1c）**：删 `listing_deposit_forfeit`（DB 侧落点为 `backend-ts/migrations/0003_kind_close_set_20.sql`，见 §19.8.B）；v0.2 旧写法为 21 个（删 `listing_deposit_refund`，见 R31）；v0.1 旧写法为 22 个〕。**删除 kind 的手段 = 约束替换**：`DROP CONSTRAINT ledger_kind_enum` + `ADD CONSTRAINT ledger_kind_enum CHECK (...)`，并**先断言无行在用**（否则中止）——**不可**用 `ALTER TYPE`（本库 `ledger_entry.kind` 为 `text`，白名单是 **CHECK 约束** `ledger_kind_enum`，**非** enum 类型，见 §2.1 v0.3 事实更正块 / §19.8.A）。删 kind 同样走 migration 并回写 §5.1。新增/删除 kind 必须走 migration（改 `ledger_kind_enum`）**并**同步在本册 §5.1 登记「减方/增方/净增发」三列，两者缺一不可。 | `ledger_kind_enum`（**CHECK 约束，非 enum 类型** —— v0.3 按实测更正）；本册 §5.1 | 后台不得提供「自定义分录类型」；任何绕过 CHECK 的写法（如把业务码写进 `memo`）属实现缺陷 | 已冻结（append-only + 可审计要求） |
| **R41** | **配对不变式**：一笔业务事件（同 `ref_type` + `ref_id` + 同一次提交）产生的全部分录必须满足<br>`Σ delta = 0` 且 `Σ frozen_delta = 0`，<br>**唯一例外**是含 `mint` / `burn` 的事件，此时差额恰好等于净增发额。〔⚠️ **v0.2 更正（留痕）**：上句中的 `Σ delta = 0` 且 `Σ frozen_delta = 0` 是**字面式**，与 §4.2「一次 hold 产生 `delta = −n`、`frozen_delta = +n`」自相矛盾（两个字面式不可能同时为 0）；**正式形状 = `Σ(delta + frozen_delta) = 0`**，理由与 SQL 见 §11 判据 8，登记见 §19.2。原文保留以留痕，不再作为实现依据〕 | 服务层在提交前对分录集合做不变式断言（建议名 `assertBalanced(entries)`）；§11 判据 3 在库层复核 | 这是「凭空造币 / 吞钱」类缺陷最有效的拦截点；任何净额不为 0 又不含 mint/burn 的提交必须在**写库前**被拒 | 待拍板（一句话可改） |
| **R42** | **禁止单边分录**：除 `mint` / `burn`（对手方为「系统」）外，任何余额变动都必须同时写出减方与增方分录，**不得**只写一条带 `memo` 说明的行。 | 服务层 `assertBalanced`；`ledger_move_guard` | `hold` / `hold_release` 的减增双方是同一主体，因此必然是 **2 条**分录（见 §4.2） | 待拍板（一句话可改） |
| **R43** | 交易所挂单冻结**复用 `hold`**（`ref_type = 'market_order'`），**不**新增 `market_hold` kind；商品/招工各自的冻结入口也统一为 `hold` 家族〔v0.1 旧写法含「保证金」—— v0.2 起保证金为消耗，不走 `hold`〕。招工托管因语义特殊**例外**，使用 `job_escrow` / `job_escrow_refund` 专用 kind。 | `hold` + `ref_type` 组合；`job_escrow*` | 避免 kind 随业务模块线性膨胀；代价是「冻结原因」必须靠 `ref_type` 读取，账单页做「冻结原因」文案时要 join 业务表 | 待拍板（可改为「每个业务模块各用自己的 hold kind」，一句话可改） |
| **R44** | 招工结算的**金额恒等式**：`酬金 = net + fee`，其中 `fee = round_half_up(酬金 × 费率)`（整数运算，见 §8 R68），`net = 酬金 − fee`（**用减法求净额，杜绝残差**）。费率取自后台可配区间 `1%–5%`（D6）。 | `job_payout` + `job_fee` 分录；`app_config` 中的费率键〔**v0.8**：P2 起费率真源 = `commission_policy.fee_rate_bp`（该键不再参与计费），见 §14.1 #32 v0.8 块〕 | 若 `fee = 0`（小额酬金四舍五入为 0），仍必须写 `job_fee` 分录吗？**不写**，直接 `job_payout = 酬金`，且不触发 `commission`（避免 0 额佣金污染流水） | 已冻结（D6）+ `fee=0` 处理为待拍板 |
| **R45** | `commission` **只能从佣金池 `uid = −2` 流出**；且对同一 `job` 事件：`Σ commission.amount == job_fee`（**全额分配，平台不抽成**，D6）。若 10 级权重之和不足 100%，差额留在佣金池（累计余额），**不**退回平台账户。 ⛔ **【v0.8 就地增补（§5.20 #2 裁定）：本句已由 D13 取代 —— 差额不再留池，改为「按已有层级权重的比例再分配」，见下方 §5.2 v0.8 块与 `docs/commission.spec.md` v0.2 §7；原文保留以留痕】** | 佣金池账户 `−2`；~~`commission_payout` 表~~〔**v0.8**：**不建该表**，见 §7.2 #8 与下方 v0.8 块〕 | 后台报表需展示「佣金池累计未分配余额」；权重矩阵改动只影响**新**事件（历史 `commission_payout` 不变，P2 AC）〔**v0.8**：D13 胜后「未分配余额」**不再累积** —— 池子在同一事件内进出相抵 ⇒ 正常稳态为 `0`；审计改读 `ledger_entry`（`commission_payout` 表不存在）；P2 侧机读判据见 `docs/commission.spec.md` v0.2 §11 M3〕 | 已冻结（D6） |
| **R46** | 冲正 `reversal` 分录的 `delta`/`frozen_delta` 必须与被冲正分录**逐列取反**；若被冲正的是 `mint` / `burn`，还**必须**在同一事务内把 `currency.total_supply` 反向调整相同数额。 | kind `reversal` + `reversal_of_txid`；`currency.total_supply` | 对账判据 4（`total_supply == Σmint − Σburn`）在存在冲正时仍必须成立 —— 因此 `total_supply` 的变化也要能被 `reversal` 分录推出 | 待拍板（一句话可改） |
| **R47** | `trade_fee` 的**承担方 = taker（吃单方）**；若撮合引擎无法区分 taker/maker（如批量清算），则买卖双方各承担 `round_half_up(f × 50%)`，差额补给 taker 侧以便总额守恒。费率的计价与扣除币种**恒为 `$`**。 | `trade_fee` 分录；`app_config` 成交费率键 | 手续费**消耗**（`delta` 负、进 `−1` 账户），**不是**冻结 ⇒ 撤单不退还（D7） | 已冻结（D7 不可退）+ taker 归属待拍板 |

> 🆕 **v0.8 就地落位（§5.2 R45，§5.20 #2 / #4）—— 上表 R45 的「差额留池」句已作废（原文划线上留痕）**：
> ① **裁定（#2）：D13 胜。** 正式口径 = **「10 级权重之和不足 100%」与「链上不足 `levels` 层」两种「分不完」，一律按已有层级权重比例再分配** ⇒ 分配分母取 **`W = Σ 已有层级的 weights_bp`**（**不是**固定 `10000`），故对同一 `job` 事件 **`Σ commission.amount == job_fee` 恒成立、逐分不差**（D6「全额分配、平台不抽成」得以成立）。自洽性依据（裁定原文）：用户口径「1–5% 全额进佣金池分 10 级」+ 判据 M3「`−2` 净额 = 0」。
> ② **连带读数（本册侧）**：佣金池 `uid = −2` 在**每个结算事件内进出相抵 ⇒ 事件净额 = 0、不留存**；§11 判据 6（佣金池守恒：`balance == Σ入 − Σ出`）仍成立，且平台佣金账户的正常稳态余额为 `0`。**唯一例外**是无邀请人的事件 —— 该情形下手续费**仍收**但**入 `−1`（平台收入）、不入 `−2`**（§5.20 #11）⇒ 仍不产生 `−2` 沉淀；P2 侧口径与判据见 `docs/commission.spec.md` v0.2 §8 / §11 M3-C。
> ③ **审计真源（#4）**：**不建 `commission_payout` 表**（单语句 `SELECT ledger_post_event($1::jsonb)` 形态下函数**不能**写业务表）⇒ 审计真源 = **`ledger_entry`**（`kind = 'commission'` + `ref_type = 'commission_payout'` + **`ref_id` = 同一 `job_id`**，索引见 §12 的 `idx_ledger_kind_time`）。R45 与 §7.2 #8 中一切「写 `commission_payout` 行」的表述**作废**（原文划线上留痕）。
> ④ **范围**：权重矩阵数值、算式实现、判据 M1/M3 的机读形式一律以 `docs/commission.spec.md` v0.2 为准（本册只冻结「佣金池如何流入 / 流出」的账务部分，见 §0.2）。


---

## §6 幂等键规则

### 6.1 幂等键的构成

| 类别 | 谁生成 | 前缀 | 模板（示例） |
|---|---|---|---|
| 业务派生（服务端） | 后端服务层，**确定性派生**（同一业务事实永远得到同一键） | `biz:` | `biz:job_payout:<job_id>:<uid>:<kind>` |
| 分佣（服务端） | 分佣器，按 (事件, 受益人, 层级) 派生 | `cm:` | `cm:<job_fee_idempotency_key>:<level>:<beneficiary_uid>` |
| 客户端提供 | 前端生成的 UUID，经 `Idempotency-Key` 请求头传入 | `cli:` | `cli:<uuid-v4>` |
| 平台运维 | 后台操作，带操作人 | `ops:` | `ops:<admin_uid>:<action>:<business_id>` |

### 6.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R48** | 幂等键作用域 = **全局唯一**（`UNIQUE (idempotency_key)`），**不是** `(uid, scope, key)` 复合作用域。理由：① 全局唯一让「重放检测」只需一次索引探测，不依赖调用方自报 uid；② 同一业务事实若被两个 uid 视角各生成一次键，per-uid 作用域会**同时扣两笔**（这正是要防的）。 | `ledger_idem_uniq` | 键必须带命名空间前缀（R49）以避免不同模块撞键；禁止使用纯自增数字或可变字段拼键 | 待拍板（**本册第四条重要裁决**，可改为 `(uid, key)` 复合唯一，但需同步改所有 dedupe 查询） |
| **R49** | 键前缀（`biz:` / `cm:` / `cli:` / `ops:`）是**强制**的，`CHECK (idempotency_key ~ '^(biz|cm|cli|ops):')`（可作为 P1 加强约束）。前缀之外的键一律拒绝（`LEDGER_IDEMPOTENCY_KEY_INVALID`）。 | 建议约束 `ledger_idem_prefix_fmt`（P1 加强项） | 后台按前缀统计「客户端重放率 vs 内部分佣重跑率」；`cli:` 键可单独限流 | 待拍板（一句话可改） |
| **R50** | 键**必须由业务事实确定性派生**，**禁止**使用 `randomUUID()` 直接当键（那只能防网络重试，防不住「用户连点两次提交」）。派生输入只允许**不可变标识**：业务单 id、uid、kind、层级、档位；**禁止**把时间戳、金额、状态等可变字段放进键。 | 各服务的事件构造函数 | 金额不能进键 ⇒ 「同单改价重发」会被判为同键不同指纹（R52 → 409），而不是双扣；这是**故意**的行为 | 待拍板（一句话可改） |
| **R51** | 幂等协议（**并发安全**，顺序固定）：① 事务内先执行带 `ON CONFLICT (idempotency_key) DO NOTHING` 的首条分录插入；② 返回 0 行 ⇒ **立即 ROLLBACK 整个事务**（账户更新一并撤销）；③ 另起**只读**查询按该键取回既有 `txid` 与结果快照；④ 按 R52 返回。**严禁**「先 SELECT 查在不在，再 INSERT」—— 该写法在并发下必然双扣。<br>✅ **已裁定（Zang · P1a 收口，登记见 §19.5）**：本条只规定了**首条**分录的键，未规定同事件其余分录的键，而 R48 要求键**全局唯一**。裁定：**第 1 条分录用调用方原始键（它就是幂等探针本身）；第 i 条（i ≥ 2）用确定性派生键 `<key>#<i>`**（同一键空间、前缀不变、可确定性重放）。<br>🆕 **v0.11 增补（Zang · §5.25 / D17 收口）**：只读重放前置闸 = **重放快路径**；**不得**表述为「取代 `ON CONFLICT` 探针」；R51 禁「先 SELECT 再 INSERT」的**立法意图不变**。**（本条子句的完整条文见下方 §6.2 v0.11 块；实现事实与证据见 §19.15）** | 服务层统一入口（建议名 `withIdempotency()`）；每次事务的首条插入 | 这一条是 P1 验收 AC「同一 `idempotency_key` 重复提交只生效一次」的实现口径；质检必须做**并发**（≥2 连接同时提交同键）验证，单线程串行重试测不出缺陷 | 已冻结（master-plan §3.1 幂等要求）+ 协议细节待拍板 |
| **R52** | 重复提交的返回语义：<br>① 同键 **且** `request_fingerprint` 相同 ⇒ `200 OK`，`{ idempotent_replay: true, txid, ...既有结果 }`，**不**重复扣款、**不**再写任何分录；<br>② 同键**但** `request_fingerprint` 不同 ⇒ `409 LEDGER_IDEMPOTENCY_CONFLICT`，**不**执行、**不**改动任何数据；<br>③ 没有任何幂等键的写请求 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`（写接口必须带键，读接口不要求）。<br>✅ **已裁定（Zang · P1a 收口，登记见 §19.6）**：既然 `request_fingerprint` 可为 `NULL`（R53），则 **② 只在「传了指纹且指纹不同」时成立**：**未传指纹时同键一律按重放（①）处理，不返回 `409`**。**但路由层写路径必须强制传指纹**（P3/P4 落实）—— 否则「同单改价重发」不会被 409 拦住，R50 的故意行为失效；传指纹是**路由层的强制项**，不是服务层的判断项。 | 统一响应包装层 | 前端收到 `idempotent_replay: true` 必须**当作成功**处理（刷新余额并展示业务结果），不得弹「重复提交」错误；收到 409 才提示「请求内容已变更」 | 待拍板（**可改为「同键不同指纹直接覆盖」吗？不可以 —— 本册明确定为 409**） |
> 🆕 **v0.11 就地落位（§6.2 R52①，Zang · `docs/seafood.master-plan.md` §5.25 / D17 收口）——「① 的保证项」与「`extra` 非契约字段」**（**上表 R52 条文一字未改**，本条为就地增补）：
> - **① 的保证项（契约，写死）**：`200` 重放返回里**保证项 = `idempotent_replay` ＋ `txid` ＋ 账上结果（分录与余额快照）** —— 即原条文 ③ 的「另起**只读**查询取回的既有 `txid` 与结果快照」，且**与首次落账逐字一致**（分录快照 `entries`、余额快照 `accounts`）。⇒ 客户端凭这三项即可**区分「已成功」与「余额不足 / 未执行」** —— 这正是 ① 的立法目的，也是 `0012` 要修的那个症状（见 §7.1 v0.11 就地更正块）。
> - **`extra` 属诊断信息、非契约字段**：首次落账 `extra = {symbol, entries}`、**重放时 `extra = {}` 合规**。**调用方不得据 `extra` 判成败或做分支**（同一条纪律：**只准按 `code` 分支，不得按 `reason` / 诊断字段分支**，见 §14.3 v0.7 增补块 (A)）。⚠️ 注意 `entries` 在 `extra` 里出现**不改变**上条保证项 —— 保证项的「分录快照」是**返回体的账上结果**，**不是** `extra.symbol` / `extra.entries` 这两个诊断键。
> - **依据（两条，均本册自核）**：① ① 原文的「`...既有结果`」是**开放省略号** —— 其枚举里**本就没有 `extra`**：**本册全文检索，`extra` 在 `docs/ledger.spec.md` 中出现 `0` 次** ⇒ 不存在「本册承诺过 `extra`」这回事（与 §5.25 的「全册检索 = 0 命中」同结论）；② 该行为**早于 `0012`** —— `0005` 与 `0012` 的 **C7 段（`C7 幂等重放` → `C8 `）逐字节相同**，sha256 `453a2e7781743866e861d28fb7c24cc8ac9bdf43ad67c224f2384afc88b530a7`（两份同值；**本册自核**），且独立质检**装回 `0005` 走非闸重放路径得到同形状 `extra = {}`** ⇒ **不是 `0012` 引入的回归**。
> - **裁定：不因它开 `0013`** —— 旨同 §5.25 所引 **D39**：「**让冻结集与现实对齐，而不是让现实去迎合一张不完整的表**」（与 v0.9 冻结映射扩展同一条原则）。**证据见 §19.15.A。**
| **R53** | `request_fingerprint` = 对**规范化请求体**（键排序、去除空白、剔除 `Idempotency-Key` 与时间戳字段本身）取 `sha256` 十六进制。由接收请求的**路由层**计算并透传给服务层，服务层不得自行改写。 | 路由层中间件（建议名 `fingerprintRequest()`） | 指纹**不参与**唯一约束（只做冲突判定），因此可以 `NULL`（如内部 `ops:` 事件可不带指纹，此时视为「同键即重放」） | 待拍板（一句话可改） |
| **R54** | 幂等键**不设 TTL、不在任何清理任务里删除**（它就是流水唯一键，而流水 append-only）。所有**内部/异步**事件同样必须带键：分佣器（`cm:`）、对账修正（`ops:`）、定时任务（`biz:<task>:<run_key>`）—— 防的是「cron 重跑双发佣金」这类事故，而不是网络重试。 | `idempotency_key` 列；定时任务传入 `run_key` | 键空间随流水行数线性增长，无需额外清理；若将来需要「客户端键有效期」策略，只能在**接受请求时**拒绝过老的 `cli:` 键（`time_created` 已可用），不得事后删除 | 待拍板（一句话可改） |

> 🆕 **v0.4 就地落位（§6.2 R48–R52，P1f F1① + P1i 覆盖面）——键字符集收紧与重放精确归属**（**上表条文一字未改**，本条为就地更正）：
>
> **（1）R48/R49 —— 键字符集闸（两道，缺一不可）**：键除「前缀强制」外还必须过两道闸，**校验顺序固定为 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`**，TS（`src/ledger.ts:normalizeIdempotencyKey`）与 DB（`0005` 的 `ledger_post_event` C0 段）**同序同码** —— 同一非法键在两侧必须得到**逐字相同**的 `code` / `reason`：
> ① **`#` 禁止**（`400 LEDGER_IDEMPOTENCY_KEY_INVALID` + `reason = 'RESERVED_SEPARATOR'`，DETAIL 带 `value = key[0..40)` 与 `note`）：`#` 是**内部派生键** `<key>#<i>`（R51/§19.5）的分隔符；禁掉它使「调用方键集合 `K`」与「内部派生键集合 `D = { k||'#'||i | k ∈ K, i ≥ 2 }`」**按构造互斥**，且派生函数在合法键域上**单射**（两个派生键相等 ⇒ 首个 `#` 位置相同 ⇒ 根键相同且序号相同）。
> ② **控制字符禁止**（`reason = 'CONTROL_CHARACTER'`）：C0（` `–``）与 DEL（``），与 DB 侧 `v_key ~ '[[:cntrl:]]'` **同集**；TS 侧常量 `CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/`。
> 〔**v0.3 旧写法（留痕，作废）**：R49 只写「前缀强制」，**对「键里允许出现什么字符」无任何约束** —— 这正是 F1（幂等派生键碰撞）的根因。〕
>
> **（2）R49 覆盖面 —— 该规则作用于每一个 `idempotency_key` 位置**：**包括 `entries[].idempotency_key`**（若调用方给出该字段）。逐条键**不是** DB 契约字段（函数自行派生、其值被忽略），故对逐条键**只做硬约束**（禁 `#` / 禁控制字符 / 必须是 JSON 字符串，`reason` 同上并带 `field = 'entries[i].idempotency_key'`），**不引入前缀或长度等事件级规则** ⇒ 对既有调用方零影响（TS 侧 `entryToPayload` 从不发该字段）。**修前实测**：`entries[]` 处的 `#` 被**静默忽略** ⇒ 7 种 op 形状（`mint` / `transfer` / `hold` / `hold_release` / `settle` / `entries` / `entries(entry-level #)`）里最后一种是「静默接受」而非 400；修后 `hash_key_rejection_all_400 = true`、`hash_key_rejection_ok_shapes = []`（无一漏网）。
>
> **（3）R50 —— 派生键空间**：第 1 条分录用**调用方原始键**（它就是幂等探针本身），第 `i` 条（`i ≥ 2`）用**确定性派生键 `<key>#<i>`**（前缀不变、可推导、可重放）。R49 的 `#` 禁令保证调用方无法构造出与任何派生键相等的键 ⇒ F1 的**两个方向**（①「他人事件的派生键被当成自己的重放结果」；②「先落 `#` 键再落正常键」）都由这一条闸 + 归属列**双重**封死。
>
> **（4）R51/R52 —— 重放语义改写（F1②，本版最要紧的一处）**：**重放/冲突判定不再用字符串前缀「键族」匹配**，改为**按事件根键精确归属**：
> ```sql
> -- v0.4（修后）
> SELECT ... FROM ledger_entry
>  WHERE event_root_key = $1
>     OR (event_root_key IS NULL AND idempotency_key = $1)   -- 历史行：键精确等值兜底
>  ORDER BY txid ASC;
> -- v0.3 旧写法（修前，**作废**）：字符串前缀算术，正是 F1 根因
> -- WHERE idempotency_key = $1
> --    OR left(idempotency_key, length($1) + 1) = $1 || '#'
> ```
> 旧写法会把他**人事件**的派生行（`<别人根键>#<i>`）当成自己的重放结果返回 → 「静默丢弃却报成功」（方向①）/「误判 409」（方向②）。
> **根行归属校验**：幂等探针命中的行必须就是「键 = 根键」的**根行**且其归属等于本键，否则一律 `409 LEDGER_IDEMPOTENCY_CONFLICT` + `reason = 'KEY_OWNED_BY_ANOTHER_EVENT_ROOT'`（**绝不冒充重放**）；指纹取自**事件自己的根行**（派生行的 `request_fingerprint` 恒为 NULL ⇒ 不可能再把指纹校验短路）。
> **派生分录撞唯一约束 = 实现缺陷** ⇒ DB 抛 `LD024` / `LEDGER_TRANSACTION_REQUIRED`（`500`，R108 必告警）/ `reason = 'derived_key_collision'`，**不得伪装成 409「幂等冲突」**（实测判据：`bogus_409_LD003 = false`、`loud_defect_LD024 = true`、`root_row_written = 0`（无半成品））。新协议下该分支**不可达**（C0 已禁调用方键含 `#`），它是对历史脏数据与将来回归的**守卫**（legacy 撞键实测：`LD024` 响亮缺陷，非伪 409）。
> **R52 的三种返回语义不变**（①同键同指纹 ⇒ 200 重放 / ②同键异指纹 ⇒ 409 / ③无键 ⇒ 400），改的只是**判定依据**（归属列而非前缀算术）。
>
> **（5）v0.4 实测读数（F1 修后，`p1f-01 --assert`）**：14/14 全绿；方向① B 用 A 的派生键 ⇒ `LD005 / reason=RESERVED_SEPARATOR`（**400 拒收**，不再静默丢弃却报成功）；方向② 先 `…#2` 再落正常键 ⇒ `LD005` 400 + `legit_event = ok, replay=false, entries=2`；同键重放 ⇒ `replay=true`、`same_txid_as_first=true`、不重复扣账。
>
> 🆕 **v0.10 就地落位（事四 · 幂等指纹的覆盖范围 · Zang 裁定 —— 实现方的设计选择获确认）**
> **结论（写死）：`request_fingerprint` 的覆盖范围 = 事件的 business 字段集合，不含任何金额派生量。** P2 结算事件的 business 字段 = `job_id` / `employer`（雇主 uid）/ `worker`（打工人 uid）/ `cid` / `gross`；**派生量（`fee` / `net` / `x_L` / `W` / `M` / 派生键）一律不进指纹**。
> **理由（裁定要旨）**：幂等键与指纹的语义是「**同一个业务请求**」；`fee` / `x_L` 是**由政策与图派生出来的量**，不是请求内容。**若把派生量纳入指纹，政策改版后同一个业务请求会被判成两个不同请求** ⇒ 退化成 `409` 或双发 ⇒ **反而破坏 D12「不追溯」**（同一 `job_id` 的验收只能有一条结算事实）。
> **⇒ 「政策改版后重算同一个键」的正确行为（不是缺陷）**：指纹只覆盖 business 字段 ⇒ 改版后重算得到的指纹**不变** ⇒ 走**重放分支**（按**原事件**返回既有 `txid` 与结果快照），**不产生 `409`、不双发、不改历史行**。**禁止**把该行为读作「指纹失效」或「老政策被沿用」 —— 政策只作用于**新事件**（D12）。**这是正确行为，不是缺陷。**
> **与本条的接口**：R52 ② 的「同键异指纹 ⇒ 409」仍成立，但**触发面被本条收窄为「business 字段变了」**（如 `job_id` 相同而 `gross` / `worker` / `cid` 变了）；**只要 business 字段一字未变**，无论政策怎样改版，**一律 ① 重放**。R53 的「规范化请求体」按本条解释 = **规范化后的 business 字段集合**（键排序、去空白、剔除 `Idempotency-Key` 与时间戳）；⚠️ **R53 的「剔除时间戳」与「剔除派生量」是两件事，两条都要执行**。同源登记：`docs/commission.spec.md` v0.3 §5.5 / §10.3 的 **CR87**。

> 🆕 **v0.11 就地落位（§6.2 R51，Zang · `docs/seafood.master-plan.md` §5.25 / D17 收口）——「只读重放前置闸 = R51 的重放快路径，不是 `ON CONFLICT` 探针的替代物」**（**R51 条文一字未改**，本条为就地增补的子句全文）：
> **（1）R51 新增子句（本版唯一新增的规则子句，语义与立法意图均不变）**：`ledger_post_event` 内那道**只读重放前置闸**（`0012` 新增；按 `event_root_key = v_key` 走已有索引 `idx_ledger_event_root_key` 查一次：**命中且指纹同（或调用方未传指纹 ⇒ 按 §19.6 一律重放）⇒ 立即按 R52① 返回**；**指纹异 ⇒ 立即 `409 LD003`**；**命中即返、零写入、完全不跑余额/冻结校验**）**是本条协议的重放快路径**（C4 加锁之后、C5 余额闸之前 —— 顺序明文见 §7.1 v0.11 就地更正块）。
> ⇒ **不得**把本闸表述为「**取代** `ON CONFLICT (idempotency_key) DO NOTHING` 探针」：**并发两个「全新」事件的权威性仍由 `ON CONFLICT` 承担** —— 两个**全新**事件同键并发时两者都还没落账 ⇒ **都会 miss 本闸**，此时仍靠唯一约束 `ledger_idem_uniq`：**恰一个落账**（返回 1 行），**另一个返 0 行 ⇒ 走本条 ②③④ 重放**（实测 13/13：`landed 1 / replay 1 / error 0`、败者得胜者 `txid`、托管恰扣一次，见 §19.15.A）。
> **本条禁「先 SELECT 查在不在、再 INSERT」的立法意图不变**：该禁令针对**写入决策**（用一次 SELECT 的结果决定是否/如何写入 ⇒ 并发下必然双扣）；本闸**命中即返、零写入**，miss 时**不基于任何 SELECT 结果做写入决定** ⇒ **不属于**被禁的那种写法。**禁止**用行锁 / `SERIALIZABLE` / 「先查后插」去**替换**唯一约束或 `ON CONFLICT` 探针。
> **（2）与本条 ①②③④ 的关系**：`ON CONFLICT` 探针**仍是写入侧的唯一权威**（① 的语义不变：**它就是**「首条分录插入即探针」，写**调用方原始键**）；本闸只在它之前**多一条只读短路**，使「键已在库」的重试**不必先过余额/冻结闸**。⇒ **两者是「快路径 ＋ 权威兜底」的两级结构，不是二选一**。**依据**：独立质检的字节级修前/修后 A/B（删两处插入 ⇒ 逐字等于 `0005` ⇒ `LD002` 复现；`0012` 下 ⇒ `200` 重放）与真并发用例（**见 §19.15.A**）；裁定原文见 master-plan **§5.25 / D17**。

---

## §7 事务边界

### 7.1 连接层口径（承接 D1）

- 现有实现：`backend-ts/src/database.ts:81` 使用 `neon(databaseUrl)`，即 **HTTP 单语句驱动**；`backend-ts/src/simple-test.ts:8` 同上。
- D1 已冻结：保留 Express + Vercel，但**必须换成支持交互式事务的连接池**。
- `.env.local` 中同时存在 `DATABASE_URL`（带 `channel_binding=require`，走 Neon pooler）与 `DATABASE_URL_UNPOOLED`（直连）。本册对两条串的用途作出裁定（见 R56）。
- 🆕 **v0.4（P1e/P1i，写路径形态已定）**：账本写路径现为**一条语句** —— `SELECT ledger_post_event($1::jsonb)`（PL/pgSQL 单函数，DB 侧 `0004` 定义、`0005` 覆盖），**一条语句自带隐式事务**，函数内部依次完成「**信封校验 → 加锁(C4) → 只读重放前置闸(C4.5) → 余额/冻结闸(C5/R80) → ON CONFLICT 首条分录探针 → 分录 → 余额更新**」。〔🔴 **v0.11 更正（Zang · §5.25 / D17）**：本行顺序明文**已更正** —— **v0.10 旧写法**见紧随其后的 **v0.11 就地更正块**（**旧址留痕、不静默重写**）；证据与位置读数见 **§19.15.A**〕⇒ 应用层**不再需要也不得**自己发 `BEGIN…COMMIT` 去包裹一个账本事件（D1 的「交互式事务」要求由该语句的原子性承接）；多语句事务只适用于**非账本**写路径。
> 🆕 **v0.11 就地更正（§7.1 写路径阶段序，Zang · `docs/seafood.master-plan.md` §5.25 / D17；旧址留痕、不静默重写）**：
> - **v0.10 旧写法（保留留痕）**：「函数内部依次完成「信封校验 → **幂等占位** → 按全序加锁 → 分录 → 余额/冻结更新 → 配对不变式」」。
> - **为什么必须改（与 R51 的冲突是事实、不是文风）**：该句把「幂等占位」写在加锁**之前**、且**通篇没有**「只读重放前置闸」这一阶段 ⇒ 与本册 **R51「顺序固定」**及 `0012` 落盘后的**真实次序冲突**。**实测成因（非推断）**：`ledger_post_event` 内 `pos_c4_account_lock 26825 < pos_c5_balance_section 27572 < pos_r80_balance_gate 29468 < pos_on_conflict_probe 31476` ⇒ **余额/冻结闸跑在 R51 的幂等占位之前** ⇒ 托管花光后**同键同载荷**重试得到 **`LD002 LEDGER_INSUFFICIENT_FROZEN`（409）** 而**不是** R52① 的 **`200 + idempotent_replay:true`** ⇒ 客户端超时后**无法区分「已成功」与「余额不足」**（R52① 被破坏）。症状与成因的区分见 §5.25。
> - **现顺序（写死 · 七个阶段）**：`信封校验 → 加锁(C4) → 只读重放前置闸(C4.5) → 余额/冻结闸(C5/R80) → ON CONFLICT 首条分录探针 → 分录 → 余额更新`。**后态位置（已验）**：`pos_c4_account_lock 26917 < pos_pre_gate 27698 < pos_c5_balance_section 30721 < pos_r80_balance_gate 32617 < pos_on_conflict_probe 34625` ⇒ `order_ok_gate_after_lock_before_balance = true`、`on_conflict_still_after_gate = true`（读数字段名与出处见 §19.15.A）。
> - **相对旧写的三处差异（逐条）**：① **「幂等占位」不再笼统写在加锁之前** —— 它被**拆成两级**：**只读重放前置闸（C4.5，命中即返）在前**、**`ON CONFLICT` 首条分录探针在余额/冻结闸之后**；**并发两个全新事件的权威性仍归 `ON CONFLICT`**（见 §6.2 v0.11 就地落位块 / R51 子句）；② 「**按全序加锁**」明确为 **C4 账户加锁**（加锁全序口径仍见 §10.1 **R81**，本行不重复）；③ 「**配对不变式**」**不再作为本行的执行阶段列出** —— 它是贯穿各段的**校验语义**（本体 = **R41**，正式判据形状 `Σ(delta + frozen_delta) = 0` 见 **§11 判据 8** / §19.2）；`0012` 对 **C5–C8 一字未动**（本册自核：与 `0005` 的函数体差分**只有两处纯插入** —— 本册行级差分重建自证「删掉两处插入 ⇒ 逐字等于 `0005` 的 `prosrc`」）。
> - **本条与 R51 的关系（防误读）**：顺序明文只描述**执行阶段**；**「先 SELECT 查在不在、再 INSERT」仍是禁止的**（R51 子句，本版未放松）—— 前置闸**命中即返、零写入**，不是被禁的那种写法。

### 7.2 必须落在**同一个交互式事务**内的操作清单（逐条，不可合并、不可拆分）

| # | 业务操作 | 必须在同一事务内的读写 | 锁对象 | 不允许拆分的理由 |
|---|---|---|---|---|
| 1 | 用户间转账 | 读双方 `account` → 校验余额 → 写 2 条 `transfer` 分录 → 更新 2 个 `account` | 两个 `account` 行 | 单边可见 = 凭空吞钱或造钱 |
| 2 | 铸币 `mint` | 锁 `currency` → 校验 `supply_cap` → `UPDATE currency.total_supply` → 写分录 → 更新 `account` | `currency` 行 + `account` 行 | `total_supply` 与余额是双写关系 |
| 3 | 销毁 `burn` | 校验持有人 → 写分录 → 更新 `account` → 递减 `total_supply` | `account` + `currency` | 同上 |
| 4 | 冻结 `hold` / 解冻 `hold_release` | 读 `account` → 校验（冻结时校验 `balance`，解冻时校验 `frozen`）→ 写 **2 条**分录 → 更新 `account` 两列 | `account` 行 | 单边分录 = 冻结额与流水不一致 |
| 5 | 罚没 `hold_forfeit` | 校验在冻归属（业务表）→ 写 2 条分录 → 更新本人 `account` 与罚没账户 `−3` | 本人 + `−3` 的 `account` 行 | 跨账户搬运 |
| 6 | 招工发布（托管） | 写 `job` 行 → 写 `job_escrow` 的 2 条分录 → 更新雇主 `account` | 雇主 `account` | 招工单存在但钱没冻住 ⇒ 结算时无钱可付 |
| 7 | 招工流单/拒单退回 | 写 `job_escrow_refund` 2 条分录 → 更新雇主 `account` → 改 `job` 状态 | 雇主 `account` | 退款与状态必须一致 |
| 8 | **招工验收结算**（最重事务） | 改 `job` 状态 → `job_payout` 2 条分录 + `job_fee` 2 条分录 → 更新雇主 `account`（`frozen` 减少）与打工人 `account`（`balance` 增加）与佣金池 `−2` → 查 10 级祖先链 → 写最多 10 组 `commission` 分录〔**v0.8 就地增补（§5.20 #4 裁定）**：**不建 `commission_payout` 表** ⇒ 原「+ 对应 `commission_payout` 行」**作废**（划线留痕）；**审计真源 = `ledger_entry`**；`commission` 分录的 `ref_id` = **同一 `job_id`**（`ref_type` 仍为 `commission_payout`）〕 → 更新各受益人 `account` 与佣金池 `−2` | 雇主 + 打工人 + 佣金池 + 最多 10 个受益人 `account` 行（**按 uid 升序加锁**） | 这是 P1 最关键的事务：任何中间失败都会造成「酬金已付、佣金未发」或「佣金已发、酬金未付」 |
| 9 | 商品下单 | 减库存 → `purchase` + `sale` 分录 → 更新买家/卖家 `account` → 写 `listing_order` | 买家 + 卖家 `account` + `listing` 行（库存） | 超卖与无货付款 |
| 10 | 商品退款 | `purchase_refund` 分录 → 更新双方 `account` → 改 `listing_order` 状态 + 回滚库存决策（回库或销毁，由 P4 spec 定） | 双方 `account` + `listing` | 退款与库存不一致 |
| 11 | **交易所撮合成交** | 锁活跃 `market_order` 行（`FOR UPDATE`，与下单同序）→ 计算成交量 → 更新 `market_order.volume_filled` / `status` → 写 `market_trade` 行 → 写 `trade` 分录（4 条）→ `trade_fee` 分录（2 条）→ 更新买卖双方 `account`（含 `frozen` 释放）→ 追加 `candle` 聚合 | 买卖双方 `account` + `market_order` 行 + `candle` 行 | 撮合是「读后写」，且价格与成交量必须一次定死 |
| 12 | 挂单 / 撤单 | 写 `market_order` 行 + `hold`/`hold_release` 2 条分录 + 更新 `account` | `account` + `market_order` | 挂单存在但未冻结 = 可超卖 |
| 13 | 币种上市 | 改 `currency.status`/`listed_at` → `listing_fee` / `currency_create_fee` 分录 → `listing_deposit` 分录（**消耗**：`$` 从创建者 `balance` 扣、入 `uid = −1`）→ 更新创建者 `account`　〔v0.1 旧写法：`listing_deposit` **2 条冻结分录**，增方为创建者本人 `frozen`〕 | 创建者 `account` + `currency` 行 | 状态已上市但保证金没收〔v0.1 旧写法：「状态已上市但保证金没冻住」〕 |
| 14 | 币种下架 | 改 `currency.status` → **无账务动作**（保证金上市时已消耗、**不退**；**强制下架亦无账务动作** —— 不存在可罚没的标的物）〔**v0.3 更正**：删原括号内「或 `_forfeit`」—— `listing_deposit_forfeit` 已于 v0.3（P1c）删除，见 §5.1 #21 / §19.8.B；v0.1 旧写法：`listing_deposit_refund`（或 `_forfeit`）分录〕 → 撤销该币种全部活跃挂单（`hold_release` + `market_order` 状态） | 创建者 `account` + `currency` + 该币种活跃 `market_order` | 终态不可复活，下架必须一次做干净 |
| 15 | 冲正 | 校验原分录未被冲正 → 写 `reversal` 分录（逐列取反）→ 更新 `account` → （若冲正 mint/burn）反向调整 `total_supply` | 相关 `account` + `currency` | 冲正本身也是会计事件 |

> 🆕 **v0.12 就地落位（§7.2「锁对象」全序，Zang · C1 终审，2026-09-28）—— 业务行锁在 `currency` / `account` **之前**，且**由业务编排函数持有**（**上表 15 行原文一字未改**；全序本体见 §10.1 与 **R79**，本条只把它落到本表逐行）**：
> - **锁顺序（与 §10.1 / R79 同一口径，三级）**：**① 业务行（按主键升序；仅当本事务涉及业务行） → ② `currency` 行（`cid` 升序） → ③ `account` 行（`uid` 升序）**。**禁止**「先锁 `account` 再锁业务行」这类反向写法 —— 它与全序**成环 ⇒ 死锁**。
> - **编排函数强制项**：**业务编排函数（`job_post_event` 等）必须在调 `ledger_post_event` 之前持有业务行锁** —— 业务行锁是这类事务的**第一把锁**；`ledger_post_event` 只负责 `currency` / `account` 两级（**函数体不改**，见 **R109**）。
> - **本表逐行的「锁对象」列读法（v0.12 明确，不改动表内文字）**：涉及业务行的行 = **#5**（`hold_forfeit` 校验在冻归属需读业务表，**只读**）、**#6 / #7**（`job` 行）、**#8**（`job` 行）、**#9 / #10**（`listing` / `listing_order`）、**#11 / #12**（`market_order`）、**#14**（该币种活跃 `market_order`）；其余行（**#1–#4 / #13 / #15**）**不涉业务行** ⇒ 全序退化为 `currency → account`（与 v0.11 旧写法逐字相同）。
> - **`lockAccounts(sortedUids, cid)`**：服务层**唯一允许的加锁入口**、**只接受已排序数组**（原为「落点建议」，v0.12 **升为强制**）。
> - **两条既有条文与本次扩写的关系（防误读）**：本表 **#8** 的「**按 uid 升序**加锁」（`account` **级内**顺序）与 **#11** 的「与下单**同序**」（`market_order` 级内顺序）**都仍然有效** —— 它们只描述**同一级内部**的顺序，**不与**本块的三级全序冲突。

### 7.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R55** | **唯一允许**执行写操作的驱动 = 支持交互式事务的连接池（`@neondatabase/serverless` 的 `Pool` over WebSocket，或 `pg`）。**禁止**用 `neon()` HTTP 驱动执行任何余额写操作（含转账、冻结、结算、撮合）。 | 替换 `src/database.ts:81` 的 `neon()`；新增 `src/db/pool.ts`（建议名）；`simple-test.ts:8` 若保留仅限只读 | 全后端「零事务」现状（D1 已指出）必须在 P0 结束前清除；`tsc --noEmit` 之外还要有一条**运行时**断言：写接口在无事务上下文时抛 `LEDGER_TRANSACTION_REQUIRED` | 已冻结（D1） |
| **R56** | 事务连接串使用 **`DATABASE_URL_UNPOOLED`（直连）**；只读单语句查询可用 `DATABASE_URL`（pooler）。理由：Neon 的 pooler 是 PgBouncer transaction 模式，会话级特性（prepared statement 缓存、`SET`、advisory lock 的会话语义）不可靠，而本册事务里要用 `pg_advisory_xact_lock`（R62 撮合串行化）。 | `.env.local` 已有的两条串；`src/db/pool.ts` 的 `transactionUrl` / `readUrl` 两个导出 | ⚠️ 连带：直连的连接数上限低于 pooler，Vercel serverless 并发高时需自设 `max` 并接受排队；此条**未实测**（§16 #3） | 待拍板（可改为「全走 pooler」，但需先实测 advisory lock 可用性） |
| **R57** | **事务粒度 = 一个业务事件一个事务**。禁止在一个事务里合并两个不相关的业务事件（例如「转账 + 顺手发一笔佣金」）；也禁止把一个业务事件拆成两个事务。 | 服务层每个事件一个 `withTransaction()` | 事务越大锁越多、越易死锁；事务越小越容易出现「扣了钱没落流水」。本清单是该权衡的唯一裁定 | 待拍板（一句话可改） |
| **R58** | **严禁**「先扣钱、后落流水」的异步形态：不得把分录写入、`account` 更新、`total_supply` 调整放到队列/定时任务/第二个事务里。若业务需要异步（如分佣计算量大），异步部分只能是**同一事务内的同步计算**，或做成**幂等可重放**的独立事件（带 `cm:` 键）且**明确标注为最终一致**（当前口径：分佣是**强一致同事务**，见 R57 #8）。 | 服务层；队列使用规范 | 若将来因性能把分佣改为异步，必须同时改本册 §7.2 #8 与 §11 判据 6，并新增「分佣待发放」状态；**不得**悄悄改 | 待拍板（一句话可改，但改动必须回写本册） |
| **R59** | 事务内**禁止任何外部 IO**：HTTP 请求、邮件、链上交互、日志外发、S3 上传、`fetch` 到第三方。这些动作只能在**提交成功后**执行；若提交失败则不得执行。 | 服务层 lint 规约 + code review 检查项 | 通知类副作用的失败**不得**回滚账务事务（账务已提交 ⇒ 通知走重试队列） | 待拍板（一句话可改） |
| **R60** | 死锁 / 序列化失败重试：最多 **3 次**，指数退避（如 50ms / 200ms / 800ms），仍失败返回 `503 LEDGER_DEADLOCK_RETRY_EXHAUSTED`。重试**必须**复用同一幂等键（否则重试会双扣）。 | 事务包装器（建议名 `withTransaction({ retry: 3 })`） | 重试只对 `40001` / `40P01` 生效；业务错误（余额不足等）**绝不**重试 | 待拍板（次数与退避可改） |
| **R61** | 隔离级别 = **`READ COMMITTED`**（Neon 默认）+ 显式行锁。**不**使用 `SERIALIZABLE`（代价高、Neon 上重试成本大）。 | 连接池配置；`SELECT ... FOR UPDATE` | READ COMMITTED 下「读-校验-写」必须靠 `FOR UPDATE` 串行化，否则会出现「双花」（两个事务都读到余额 100 各自扣 100） | 待拍板（一句话可改） |
| **R62** | **撮合必须串行化**：同一 `(base_cid, quote_cid)` 币对的撮合在同一时刻只允许一个写者。手段优先级：① `pg_advisory_xact_lock(hash(币对))`；② 币对级别的「撮合队列单写者」进程模型。**禁止**依赖「先查后插」的乐观做法。 | 撮合服务；`pg_advisory_xact_lock` | 会话级 advisory lock 在 PgBouncer transaction 模式下行为需实测（§16 #3）；若不可用则改用「币对行锁」（在 `currency` 或专门的 `market_pair` 行上加 `FOR UPDATE`） | 待拍板（一句话可改） |
| **R63** | **禁止跨事务的「检查-使用」**：所有余额校验必须在**扣款所在的那个事务内**、且在取得 `FOR UPDATE` 行锁**之后**执行。禁止在路由层先查一次余额「预校验」再进事务扣款（预校验只能用于前端提示，不得作为正确性依据）。 | 服务层；前端预校验仅作 UX | 前端可以显示「余额不足」，但后端仍必须独立校验并返回 `LEDGER_INSUFFICIENT_BALANCE` | 待拍板（一句话可改） |
| **R64** | 事务**不得长**：单事务内涉及的分录条数上限建议 **≤ 32 条**、涉及账户数上限建议 **≤ 16 个**（招工结算 10 级佣金 = 10 受益 + 3 主体 = 13，安全余量内）。超限的操作（如下架批量撤单）必须**分批，每批一个事务**，且每批自身必须完整（不得跨批冻结资金）。 | 服务层批次上限常量；下架/清退任务 | 分批意味着「下架不原子」，因此下架必须先置 `status = delisted`（阻止新挂单）再分批清挂单 —— 顺序不可颠倒 | 待拍板（上限值可改） |
| **R65** | **「扣了钱没落流水」是最高优先级缺陷**：任何 `UPDATE account` 必须与对应 `ledger_entry` 插入在同一事务内，且 §9 的 DB 层 trigger 会**主动拒绝**没有对应流水的 `account` 变更。质检必须有一条用例专门构造该场景（在事务里只更新 `account` 不写分录 ⇒ 必须报错回滚）。 | §9 `account_guard` trigger；P1 质检用例 | 这条 trigger 是本册唯一能**在 DB 层**拦住「账实不符」的手段（应用层保证不了），必须实现，不得以「性能」为由跳过 | 待拍板（但**强烈建议保留**） |
| **R109** | **业务编排函数（`job_post_event` / `listing_post_event` / `market_post_event` 等）的原子性与幂等口径**（🆕 **v0.12 新增**；裁定来源 = Zang · **C1 终审** —— `docs/seafood.master-plan.md` **§5.32** C1 的四条附加硬约束 + **C8**）：<br>**① 原子性（同一事务）**：**业务行与账本分录必须落在同一事务**，由编排函数保证 —— 编排函数是**一条语句**（`SELECT <biz>_post_event($1::jsonb)`；函数内依次「**锁业务行** → 派生分录 → 调 `ledger_post_event` → 回写引用列」），**一条语句自带隐式事务**（§7.1 v0.4 块）；**禁止**把业务行与账本事件写成两个事务（两阶段形态已被 C1 否决，见 §19.16.A）；<br>**② 函数内禁止任何 DDL**：编排函数**只由迁移创建**，**函数体内不得出现任何 DDL**（`CREATE` / `ALTER` / `DROP` / `TRUNCATE` 等一律禁止）；<br>**③ 幂等必须与 R51/R52 一致**：每次调用**必须**带幂等键；**同键同指纹 ⇒ `200` 重放（R52①）且**不重写业务行**（业务行的账本引用列、`ledger_event_keys` 均**不得追加**）**；同键异指纹 ⇒ `409`（R52②）；无键 ⇒ `400`（R52③）；<br>**④ 必须把 `ref_id` 落到账本引用列**：事件必须写 `ref_type` / `ref_id`（= 业务主键，如 `job_id`），编排函数**必须回写业务行的账本引用列**（`escrow_txid` / `settle_txid` / `pay_txid` / `ledger_event_keys`）；<br>**⑤ 业务级幂等另需业务表侧键 `create_key`**：**`create_key text NOT NULL UNIQUE`**（创建键）—— 账本侧幂等（`ledger_idem_uniq`）只保证**分录**不双写，**不保证业务行**不双写；`create_key` 口径与 R51/R52 指纹一致（指针：`docs/data-layer.spec.md` 的 **C8** / 三件套；**本册不改那册**）。<br>**不变项**：`ledger_post_event` **函数体不改**；**R51 的并发权威性（`ON CONFLICT` 探针）不变**、**R51 禁「先 SELECT 再 INSERT」不变**、**R52 三种返回语义不变**（本条只把口径接到业务行上） | 编排函数（**由迁移创建**：`0013` / `0014` / …）；业务表三件套 `create_key` / `ledger_event_keys` / `time_created`·`time_updated` | 若拆成两个事务 ⇒ 出现「**已托管、业务行未落**」或反之的**可见中间态**（这正是 C1 否决两阶段形态的理由）；业务行双写会污染判据 1/3/8 的业务侧真源 | **已拍板（Zang · C1 终审，2026-09-28）** |

> 🆕 **v0.12 就地落位块（§7.3 **R109**，Zang · C1 终审，2026-09-28）—— **R109 正文 = 上表末行**（**编号只追加 Rn+1、R1–R108 一字未动**；本块只放**接口**与**未执行项**，**不重复条文** ⇒ 防「同一规则两处正文」的双真源）**：
>
> - **与既有条款的接口**：本条**不修改** R51 / R52 / R57 / R58 / R59 / R65 的任何要求；R57（一个业务事件一个事务）与 R65（「扣了钱没落流水」是最高优先级缺陷）在本条下**同时覆盖业务行**；§7.2 v0.12 块给出本条①的**锁序**前置条件。
> - **未随本册执行**：编排函数本体（`0013` 起）属**实现侧**；`create_key` 的列契约与业务表三件套由 `docs/data-layer.spec.md` 定义（**本册只发指针、不改那册**）。

> 🆕 **v0.4 就地落位（§7.3 R60，P1f F3④ / §11 S8）——`LD027` 必须进 TS 的可重试集合**（**上表 R60 条文一字未改**）：
> ① **TS 侧**：`RETRYABLE_SQLSTATES` **必须**含 `'LD027'` —— DB 层自 `0005` 起把 `40001` / `40P01` **归一后抛 `LD027`**（裸 `40P01` 不再逃出函数）；**不同步这一项 = 死锁不再被重试 = R60 形同失效**（行为回归）。`'40001'` / `'40P01'` **保留**：它们是**函数之外**（只读路径、非账本语句）仍可能逃出的原始码。修后：`new Set(['40001', '40P01', 'LD027'])`；修前：`new Set(['40001', '40P01'])`。
> ② **DB 层 `0` 次重试，重试主权显式归调用方**：`LD027` 的 DETAIL **固定**含 `retries_performed = 0` / `retry_owner = 'caller'` / `retryable = true`（外加 `reason` = `'deadlock_detected' | 'serialization_failure'` 与 `pg_code`）。⇒ 「谁重试」有唯一答案：**调用方**（同键重试，安全）。
> ③ **行为读数（非仅代码）**：公开 API 路径实测捕获到**内部**错误确为 `LD027`（`captured_first_error_is_LD027 = true`）、`retry_actually_reissued = true`（`distinct_fn_statements_observed = 3`，第 3 条 = 同键重发）、最终 `api_ok = true`；`no_double_debit = true`（A `−100` / B `+100`，`findByKey` 返回 2 行、debit 恰 1）。**若 TS 未同步 `'LD027'`，该路径会在第一次 `LD027` 时直接抛 503**，不会出现第 3 条同键语句 —— `retry_actually_reissued` 就是「R60 未被错误面归类改动打断」的机读证据。
> ④ **R60 的「最多 3 次 / 指数退避 50·200·800ms」口径不变**（`retries < 3`）。

---

## §8 金额表示与 decimals

### 8.1 表示法总则

**一切金额在库内、在服务层、在 API 传输层，都是「该币种最小单位的整数」；小数点只存在于 UI 输入框与展示层。**

示例（`$` 的 `decimals = 0`）：`100` 表示 100 个 `$`。
示例（某自建单位 `decimals = 2`）：`12345` 表示 123.45 个该单位。

| 层 | 表示 | 示例 |
|---|---|---|
| DB 列 | `bigint`（最小单位整数） | `100000` |
| 服务层 | JS `BigInt` 或十进制字符串 | `100000n` |
| API JSON | **十进制字符串**（`"100000"`），不是 number | `{"amount":"100000"}` |
| UI 展示 | 按 `decimals` 插入小数点 | `decimals=2` → `"1000.00"` |

### 8.2 换算公式（**唯一**允许的实现方式，全整数运算）

```
展示 → 存储（decimals = d，输入形如 "123.45"）：
  units = 整数部分 * 10^d + 小数部分右侧补零至 d 位

存储 → 展示：
  整数部分 = units / 10^d（整数除法）
  小数部分 = units % 10^d，左侧补零至 d 位
```

### 8.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R66** | 金额列**一律 `bigint`**（最小单位整数）。`delta` / `frozen_delta` / `balance` / `frozen` / `total_supply` / `supply_cap` / `deposit_amount` / `balance_after` / `frozen_after` 全部 `bigint`。 | 三张表的金额列 | 与 legacy `asset.points integer`（单币种、int4）的差异必须在 P1 迁移时说明：int4 上限 21 亿，`bigint` 上限 9.22×10^18 | 待拍板（可改：用 `numeric(38,0)`，代价是驱动需按字符串解析且索引更大） |
| **R67** | **禁止**出现 `real` / `double precision` / `float` / `numeric(p,s)` 且 `s <> 0` 的金额列。DDL 评审必须逐列确认类型（P0 migration 审阅项）。 | migration 评审清单；可选 DB 断言：查 `information_schema.columns` 中金额列的数据类型 | 前端**禁止**用 `Number()` / `parseFloat()` 参与金额运算（`Number.MAX_SAFE_INTEGER = 9.007×10^15`，超过即静默丢精度）；前端只做**字符串**拼接与展示 | 已冻结（「禁止浮点」为硬要求） |
| **R68** | **取整规则（全整数运算，禁浮点）**：<br>`fee = floor_half_up(numerator, denominator) = (a * b + denominator / 2) / denominator`（整数除法，仅适用于正数，本项目金额恒为非负 ⇒ 安全）；<br>费率以**基点整数**存 `app_config`〔**v0.8**：P2 起真源改为 `commission_policy.fee_rate_bp`，见 §14.1 #32 v0.8 块〕（`100` = 1%，`500` = 5%，分母 `10000`）；<br>**净额一律用减法求**：`net = gross − fee`（**绝不**用另一个乘法/取整去算净额，避免出现 `net + fee ≠ gross`）。 | 金额工具函数（建议名 `mulDivHalfUp(a, b, den)`）；`app_config` 费率键 | 这条保证 `job_payout + job_fee = 酬金` 恒成立（R44），也是 §11 判据 3 能通过的前提 | 已冻结（D6 费率）+ 取整方向待拍板 |
| **R69** | `decimals` **只用于**：① 用户输入解析；② 展示格式化；③ 交易所价格/数量的显示位数。**禁止**用它做任何存储层计算、参与比较、或作为除法因子出现在 SQL 里。 | `currency.decimals` 的使用点白名单 | SQL 中出现的所有金额运算必须已是整数，`decimals` 不出现在 SQL；后端若需要「按人类可读单位排序」应在应用层换算 | 待拍板（一句话可改） |
| **R70** | **驱动与序列化口径**：DB 驱动返回的 `bigint` 必须按**字符串**或 `BigInt` 处理，**禁止**转 `Number`；API 出参的金额字段必须是**十进制字符串**（`"100000"`），入参同样接受字符串。`JSON.stringify` 对 `BigInt` 会抛错，因此**出参前统一转字符串**。 | 驱动配置（`pg` 的 `types` 解析）+ 响应包装层；建议在架构层增加「金额字段名单」自动转换 | 前端 `api` 层也不得 `Number()` 化金额；余额展示直接用字符串做千分位切分 | 待拍板（可改：用 `Number` 并在金额上限内 —— **本册不建议**） |
| **R71** | **溢出与上限口径**：单笔金额上限由 `app_config` 配置（建议 `1e15` 最小单位，远低于 `bigint` 上限）；`a * b` 类乘法中间量可能超出 `bigint`，**中间量必须用 `numeric`**（Postgres 任意精度）或在应用层用 `BigInt` 乘法。`currency_supply_guard` 已保证 `total_supply <= supply_cap`，`supply_cap` 也不得超过 `app_config` 的全局上限。 | `app_config` 上限键；SQL 中的 `::numeric` 中间量 | 「无限」是相对概念：`$` 的 `supply_cap = NULL`，但仍受单笔上限与 `bigint` 上限约束 | 待拍板（上限值可改） |
| **R72** | 金额**入参校验**（进入服务层之前）：① 必须是字符串或整数，**不接受** `1.5` 这类浮点 JSON number（会被拒，而不是被四舍五入）；② 必须 `> 0`（除 `delta` 内部取负）；③ 小数位不得超过该币种 `decimals`（超过 ⇒ `LEDGER_DECIMALS_OVERFLOW`）；④ 不得超过单笔上限。 | 路由层 DTO 校验（建议名 `parseAmount(str, decimal)`） | 「超过 decimals 的小数」**直接拒绝**而非静默截断，避免出现「用户输入 1.005，系统扣 1.00」的争议 | 待拍板（一句话可改） |

> 🆕 **v0.4 就地落位（§8.3 R70 / R71 / R72，P1f §D2 + M31 / M43）——「金额字段恰一个」**（**上表三条条文一字未改**）：
>
> **（1）口径（冻结）**：`amount`（**R72 用户十进制字符串**）与 `amount_units`（**R66 最小单位整数串**）**二选一**，**恰一个**：
> ① **两个同时出现** ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason = 'AMBIGUOUS_AMOUNT'`（DETAIL 含 `field` / `provided = 'amount,amount_units'` / `note`）；**绝不静默挑一个**；
> ② **单给 `amount`** ⇒ `ledger_parse_user_amount`：锚定白名单 `^[0-9]+(\.[0-9]*)?$` + **显式封死指数形式** ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason = 'EXPONENT_NOT_ALLOWED'`（合法字母表只有 `[0-9.]`，故出现 `e` / `E` 必为指数/非法记法 ⇒ 专属 reason）；
> ③ **单给 `amount_units`** ⇒ `ledger_int_amount` + 真范围闸（`numeric` 查界后再转型，杜绝 19 位但超 `bigint` max 的 `22003` 逃逸）+ **R71 单笔上限**；
> ④ **缺失 / 非字符串** ⇒ `400`（`reason = 'MISSING'` / `'NOT_STRING'`，逐格保留 `0004` 口径）。
>
> **（2）修前缺陷（M31 / M43，根因）**：`0004` 的 `ledger_payload_amount` 把 `amount_units` 放在**优先级首位**、命中即 `RETURN` ⇒ 同一 payload 里的 `amount` **一个字都不校验**。于是 `{amount_units:'1', amount:'1000000000000001'}`（超 R66/R71 单笔上限）与 `{amount_units:'1', amount:'1e5'}`（指数形式）**都被静默接受 `200`**（修前读数：`sqlstate: null` / `ts_code: null` / `status: null` / `outcome: "accepted_200"`）。修后四例全 400：`amount_over_cap_rejected_400` / `amount_over_cap_amount_only_400` / `amount_exponent_rejected_400` / `amount_exponent_amount_only_400` **全 `true`**。
>
> **（3）R71 的两条路径都必须过闸（S12-同类漏闸的封堵）**：单给 `amount_units` 与单给 `amount` **各自独立**过 `ledger_max_single_amount()`（= `1000000000000000`，即 `1e15`，与 TS 侧 `MAX_SINGLE_AMOUNT = 1_000_000_000_000_000n` **同值**）；超限 `reason = 'OVER_MAX_SINGLE_AMOUNT'`。
>
> **（4）「对外 API 零破坏」的逐字旁证**：TS 侧 `amountToPayload` 是**三元表达式**，**恒只产生 `amount` 或 `amount_units` 之一**（调用点 `postEvent` 为 `if (input.amount !== undefined) Object.assign(payload, amountToPayload(input.amount));`）⇒ `AMBIGUOUS_AMOUNT` 闸**不会打到 TS 自己的写路径**。
>
> **（5）一处读数提示（防误读，§11 S11）**：`M31b_amount_only_over_cap` 的 DETAIL `value` 是 `"100000000000000100"`，即 R72 语义下**换算后的最小单位**（入参十进制 `1000000000000001` × 10²），**不是**入参原值 —— 引用该值时不得读成「入参」。
>
> **（6）R70 补充（身份字段形状）**：`uid` / `cid` / `ref_id` 等身份字段**只接受 JSON 字符串**（R70 口径：入参一律文本）；传 JSON number 不再被静默转换，而是 `400 LEDGER_AMOUNT_INVALID` + `reason = 'NOT_STRING'`（`provided_type` 带原始 `jsonb_typeof`）。`memo` 同理只接受字符串（对象/数组/数字 ⇒ `NOT_STRING`）；`platform` 只接受 JSON boolean 或 `'true'` / `'false'`（其余 ⇒ `reason = 'NOT_BOOLEAN'`）。

---

## §9 append-only 不可变约束

### 9.1 三层防线（缺一层不算达标）

| 层 | 手段 | 强度 |
|---|---|---|
| ① 权限 | `REVOKE UPDATE, DELETE, TRUNCATE ON ledger_entry FROM <app_role>` | **弱** —— Neon 连接串的默认角色通常是库 owner，`REVOKE` 对 owner **无效**。仅作纵深防御 |
| ② 触发器 | `BEFORE UPDATE OR DELETE ON ledger_entry` → `RAISE EXCEPTION` | **强** —— owner 也拦得住，是**主手段** |
| ③ 应用 | 服务层不提供任何 UPDATE/DELETE 流水的代码路径；纠错只走 `reversal` | 流程约束 |

### 9.2 DDL 片段

```sql
-- ① 流水不可变
CREATE OR REPLACE FUNCTION ledger_entry_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entry is append-only: % forbidden (txid=%)',
        TG_OP, COALESCE(OLD.txid, 0);
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entry_append_only
BEFORE UPDATE OR DELETE ON ledger_entry
FOR EACH ROW EXECUTE FUNCTION ledger_entry_append_only();

-- ② 账户余额必须与「最新分录快照」逐列相等（拦住「扣了钱没落流水」）
CREATE OR REPLACE FUNCTION account_guard() RETURNS trigger AS $$
DECLARE last_bal bigint; last_frz bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'account rows are not deletable (uid=%, cid=%)', OLD.uid, OLD.cid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.balance <> 0 OR NEW.frozen <> 0 THEN
      RAISE EXCEPTION 'new account must start at 0/0 (uid=%, cid=%)', NEW.uid, NEW.cid;
    END IF;
    RETURN NEW;
  END IF;

  SELECT balance_after, frozen_after INTO last_bal, last_frz
    FROM ledger_entry
   WHERE uid = NEW.uid AND cid = NEW.cid
   ORDER BY txid DESC LIMIT 1;

  IF last_bal IS NULL THEN
    RAISE EXCEPTION 'account update without any ledger_entry (uid=%, cid=%)', NEW.uid, NEW.cid;
  END IF;

  IF NEW.balance <> last_bal OR NEW.frozen <> last_frz THEN
    RAISE EXCEPTION
      'account(%/%) != latest ledger snapshot(%/%) for uid=% cid=%',
      NEW.balance, NEW.frozen, last_bal, last_frz, NEW.uid, NEW.cid;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_account_guard
BEFORE INSERT OR UPDATE OR DELETE ON account
FOR EACH ROW EXECUTE FUNCTION account_guard();
```

### 9.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R73** | `ledger_entry` **不可变性以触发器为强制手段**（不是以权限为强制手段）。任何「为了修数据方便」而临时禁用该 trigger 的操作都视为违规变更，必须在变更记录里显式登记原因与时长。 | `trg_ledger_entry_append_only`；变更记录 §18 | 若发现某次 migration 需要更新流水 ⇒ 说明设计有缺口，应当**新增 kind** 而不是改历史 | 已冻结（append-only 铁律） |
| **R74** | **写入顺序固定为「先插 `ledger_entry`，后更新 `account`」**，且 `account` 的 `balance` / `frozen` 必须**逐列等于**该账户最新分录的 `balance_after` / `frozen_after`。次序颠倒会被 `trg_account_guard` 拒绝。 | `trg_account_guard`；服务层写入辅助函数顺序 | 触发器检查的是**同事务可见**的最新分录（同事务内自己插入的行可见 ⇒ 校验有效）；这也是 §7 R65 的实现落点 | 待拍板（**本册第五条重要裁决**；可改为「用流水重算触发校验」，代价更高） |
| **R75** | **开户必须 0/0**：`account` 首次 `INSERT` 时 `balance = 0 AND frozen = 0`，初始余额只能由随后的 `mint` / `transfer` 分录产生。**禁止** `DELETE FROM account`（余额为 0 也不允许；需要「关户」用状态字段而非删行 —— 该字段属 P0 用户表范围）。 | `trg_account_guard` 的 INSERT / DELETE 分支 | 杜绝「直接 INSERT 一个 balance = 1000 的账户」这条凭空造币路径 | 待拍板（一句话可改） |
| **R76** | **纠错唯一路径 = `reversal` 冲正**：① 必须写清原因码（`memo`）；② 一条分录最多被冲正一次（R20 部分唯一索引）；③ **冲正分录本身不得再被冲正**（应用层 + 可选 trigger 校验）；④ 冲正需具备操作人身份（后台 `ops:` 键 + `admin_uid`）。**禁止**任何「直接改一条流水」的纠错方式。 | kind `reversal`；后台「账务纠错」页（P6） | 冲正会同时反转 `account` 与（若涉及）`total_supply`；对账脚本必须把「原分录 + 冲正分录」配对成净 0 | 待拍板（一句话可改） |
| **R77** | **禁止破坏性 migration**：对 `ledger_entry` 不得 `TRUNCATE`、不得批量 `UPDATE`、不得 `DROP COLUMN`（加列可，删列须走「先停用→下一版加 CHECK 拒绝写入→再删」三段式）。`TRUNCATE` 权限必须从应用角色回收。 | migration 审查清单；`REVOKE TRUNCATE` | 若确需重建表（如分区化），必须走「新表 + 双写 + 回填 + 校验和 + 切换」流程，且切换前后必须做全量对账（§11） | 待拍板（一句话可改） |
| **R78** | **不可变性取证口径**（每次涉及流水的 migration/运维后必做）：① 记录 `ledger_entry` 行数、`max(txid)`、`sum(delta)` 按 `cid` 分组的三元指纹；② 抽样 ≥ 100 个账户，验证「快照链」自洽（每行 `balance_after` = 上一行 `balance_after` + 本行 `delta`）；③ 前后指纹不一致 ⇒ 判为违规写入并**立即停止后续操作**。 | 运维脚本（建议名 `scripts/ledger-fingerprint.ts`）；P1 交付物 | 「行数不变」不等于「内容未变」，必须同时取 `sum` 指纹；取证结论必须落盘留痕 | 待拍板（一句话可改） |

---

## §10 并发规则与负余额禁令

### 10.1 加锁全序（**防死锁的唯一口径**）

任何事务若需要锁多个对象，必须按以下**固定升序**加锁，禁止按业务自然顺序加锁（**v0.12 起：全序含业务行，且业务行在最前** —— 见紧随其后的 v0.12 就地更正块）：

> 🆕 **v0.12 就地更正（Zang · C1 终审，2026-09-28）—— 加锁全序 = 业务行 → `currency` → `account`**（旧址留痕、**不静默重写**；裁定原文见 §19.16.A）：
>
> ```
> ① 业务表行         —— 按业务主键升序（job_id / order_id / oid）；**仅当本事务涉及业务行时**
> ② currency 行      —— 按 cid 升序
> ③ account 行       —— 按 uid 升序，同一 uid 再按 cid 升序
> ```
> - **禁止**「先锁 `account` 再锁业务行」这类反向写法 —— 它与上面的顺序**成环 ⇒ 死锁**。
> - **编排函数强制项**：**业务编排函数（`job_post_event` 等）必须在调 `ledger_post_event` 之前持有业务行锁**（业务行锁是这些事务的**第一把锁**；理由与落位见 §7.2 v0.12 块 / §7.3 **R109**）。
> - **`lockAccounts(sortedUids, cid)` 由「建议」升为强制**（原为落点建议）：服务层加锁**只允许**经此函数 —— **唯一允许的加锁入口**，且**只接受已排序数组**。
> - **示例（v0.12 补充）**：招工发布（§7.2 #6）先锁该 `job` 行（按 `job_id` 升序）⇒ 再锁 `currency` 行 ⇒ 最后按 `lockAccounts` 锁雇主 `account`；招工验收结算（§7.2 #8）同序（业务行第一把锁，`−2 → 12 → 80 → …` 的相对顺序不变）。
>
> 📌 **v0.11 旧写法（保留留痕，只覆盖 `currency → account`、**未涵盖业务行**；业务行在旧写法里排最后 ⇒ 与「编排函数先锁业务行」的写法成环，已作废）**：
>
> ```
> ① currency 行      —— 按 cid 升序
> ② account 行       —— 按 uid 升序，同一 uid 再按 cid 升序
> ③ 业务表行         —— 按业务主键升序（job_id / oid / order_id）
> ```

**示例**：招工结算涉及 雇主(uid=80)、打工人(uid=12)、佣金池(−2)、10 个受益人 ⇒ 锁顺序必须是 `−2 → 12 → 80 → ...`（数值升序），而不是「先锁雇主再锁打工人」。

### 10.2 并发场景与对策

| 场景 | 风险 | 对策 |
|---|---|---|
| 同一账户并发扣款 | 双花（两笔都读到 100，各扣 100） | `SELECT ... FOR UPDATE` 串行化 + 事务内再校验 |
| 同一账户并发解冻 | `frozen` 变负 | 同上；`account_frz_guard` 兜底 |
| 并发 `mint` 同一币种 | 突破 `supply_cap` | 锁 `currency` 行后校验；`currency_supply_guard` 兜底 |
| 并发提交同一幂等键 | 双扣 | `ledger_idem_uniq` 唯一约束 + R51 协议 |
| 撤单 与 撮合成交 争抢同一挂单 | 双重释放冻结（一单卖两次） | `market_order` 行 `FOR UPDATE` + 事务内复查 `status` 仍为 `open` |
| 并发发佣金（定时重跑） | 佣金双发 | `cm:` 幂等键（R54） |
| 并发创建同名币种 | 两个 `dashJ` | `currency_symbol_uniq` 唯一约束 |

### 10.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R79** | **加锁全序强制**（§10.1）。**全序（最终口径，v0.12 扩写）= 业务行（若该事务涉及，按主键升序） → `currency`（`cid` 升序） → `account`（`uid` 升序）**。任何事务在取第二把锁之前必须先确认它是全序中的后位；**禁止**「先锁 `account` 再锁业务行」这类反向写法（与上面的顺序**成环 ⇒ 死锁**）；违反全序的写法（如按「用户传入顺序」遍历扣款）必须重写。<br>**强制项 ①（v0.12 起）**：**业务编排函数（`job_post_event` 等）必须在调 `ledger_post_event` 之前持有业务行锁**（业务行锁 = 这类事务的**第一把锁**；与本条配套的规则 = **R109**）。<br>**强制项 ②（v0.12 起，原为「建议」）**：服务层锁辅助函数 **`lockAccounts(sortedUids, cid)` 是唯一允许的加锁入口**，且**只接受已排序数组**。<br>✅ **已拍板（Zang · C1 终审，2026-09-28）** —— 裁定逐字、理由与逐处落位见 **§19.16.A**。<br>📌 **v0.11 旧写法（保留留痕，只覆盖 `currency → account`、**未涵盖业务行**；当时状态 = 待拍板）**：「**加锁全序强制**（§10.1）。任何事务在取第二把锁之前必须先确认它是全序中的后位；违反全序的写法（如按「用户传入顺序」遍历扣款）必须重写。」；落点建议原文：「服务层锁辅助函数（建议名 `lockAccounts(sortedUids, cid)`），**只接受已排序数组**」；连带影响原文：「10 级佣金结算涉及最多 13 个账户，是死锁高发点；`lockAccounts` 是唯一允许的加锁入口」；状态原文：「待拍板（**本册第六条重要裁决**，一句话可改）」 | 服务层锁辅助函数 **`lockAccounts(sortedUids, cid)`**（**唯一强制入口**），**只接受已排序数组** | 10 级佣金结算涉及最多 13 个账户，是死锁高发点；**业务行锁为第一把锁** ⇒ 编排函数须在调 `ledger_post_event` 前持有它（R109） | **已拍板（Zang · C1 终审，2026-09-28）**〔v0.11 旧状态：待拍板（本册第六条重要裁决，一句话可改）；**旧状态与旧口径同地留痕、不静默重写**〕 |
| **R80** | **负余额禁令**：`CHECK (balance >= 0)` / `CHECK (frozen >= 0)` / `CHECK (balance_after >= 0)` / `CHECK (frozen_after >= 0)` 是**DB 层兜底**；应用层**必须**在此之前显式校验并返回业务错误码。**不允许**把「靠 CHECK 报错」当作正常流程（会污染日志、暴露 `500`）。 | `account_bal_guard` / `account_frz_guard` / `ledger_after_guard` | 一旦 CHECK 被触发，错误码统一为 `LEDGER_NEGATIVE_BALANCE_GUARD`（`500`），并且**必须**记入告警（说明代码里有漏判） | 已冻结（P1 AC：负余额必须不可能出现） |
| **R81** | **加锁策略（v0.2 已裁定）**：**写路径一律使用 `SELECT ... FOR UPDATE`**（行锁），**不做** `account.version` 乐观锁分支（即不实现 `UPDATE ... WHERE uid=$1 AND cid=$2 AND version=$3` 这条轻量路径）。`account.version` 列**保留**、仍按 R13 在每笔加分录事务里 `+1`，**仅作审计/诊断**，不作为互斥手段。<br>✅ **已裁定（Zang · P1a 收口，登记见 §19.4）**。<br>📌 **v0.1 旧写法（留痕）**：乐观锁 `account.version` 用于「单账户、单分录、无跨账户搬运」的轻量写路径（`mint` / `burn` / `hold` / `hold_release`），跨账户搬运（转账/结算/撮合）才用 `FOR UPDATE`。→ 作废。 | `account.version`（**仅审计**）；服务层**单一**写路径（行锁） | 因为只剩一套机制，不存在「乐观锁事务与行锁事务互相看不见」的假安全感；`version` 的跳跃/回退**不得**作为业务判断依据 | 已裁定（Zang · P1a 收口；v0.1「待拍板」作废） |
| **R82** | **锁等待与语句超时**：必须设置 `lock_timeout`（建议 3s）与 `statement_timeout`（建议 10s），超时分别映射为 `503 LEDGER_LOCK_TIMEOUT` / `503 LEDGER_TX_TIMEOUT`。**禁止**不设超时（会拖垮连接池、连带打挂整个 API）。〔**v0.3（P1c）补充**：**非 PG / 驱动级连接错误**（无 SQLSTATE，如 WS 连接池取连接超时 / 过载、`ECONNREFUSED`）同样映射 `503 LEDGER_TX_TIMEOUT` + `details.reason = 'pool_connection_timeout' \| 'driver_connection_error'`，**不得**兜底为 `500 LEDGER_TRANSACTION_REQUIRED`；借用映射见 §14.3，`details` 形状见 §14.4，触发条件见 §14.1 #27，登记见 §19.8.C〕 | 事务包装器 `SET LOCAL lock_timeout` / `statement_timeout` | 这两条超时是 Vercel serverless 下的**必配项**：函数超时前若未释放连接，后续请求会排队 | 待拍板（时长可改） |
| **R83** | 并发 `mint` / `burn` / 状态变更**必须先锁 `currency` 行**（`SELECT ... FOR UPDATE`），再动 `account`，顺序不可颠倒（否则与 R79 全序冲突）。〔**v0.12 指针**：R79 全序现为「**业务行 → `currency` → `account`**」；本条**与之一致**（`currency` 仍先于 `account`），**无需改动**；若该事务涉及业务行，业务行锁在 `currency` **之前**〕 | §7.2 #2/#3/#13/#14 事务 | 币种状态变更（上市/下架/冻结）与铸造共用同一把行锁 ⇒ 天然互斥 | 待拍板（一句话可改） |
| **R84** | 挂单的「撤销」与「成交」必须争抢同一把 `market_order` 行锁，且锁后**必须复查** `status` 与 `volume_filled`（不能信任锁前读到的值）。 | §7.2 #11/#12 事务 | 「一单卖两次」这类缺陷只会在并发下出现，单线程测试**测不出来** ⇒ 质检必须写并发用例（§11 R93） | 待拍板（一句话可改） |
| **R85** | **并发验收清单（P1 AC 直引）**：① 同一账户 100 并发转账后**总额守恒**；② 同一幂等键 100 并发提交**只生效一次**；③ 并发扣款不会出现负余额（余额 100，100 笔各扣 1 ⇒ 恰好 100 笔成功）；④ 并发 `mint` 不超 `supply_cap`；⑤ 死锁重试生效（人为制造反向加锁顺序 ⇒ 观察到 `40P01` 并最终成功或明确报错）。 | P1 质检用例集；Neng 执行 | 只跑串行用例不算通过；每条都要求「人为注入偏差后能报错」的判负能力（§11 R92/R93 同法） | 已冻结（P1 AC）+ 条目 ③④⑤ 为待拍板补充 |
| **R86** | **禁止用应用层/外部分布式锁替代 DB 事务与行锁**（Redis 锁、进程内 mutex、「单实例部署所以不会并发」的假设）。所有正确性保证必须落在「DB 事务 + 行锁 + 唯一约束 + CHECK」四件套上；分布式锁只能作为**性能优化**（减少冲突重试），不得作为**正确性依据**。 | 架构规约；code review 检查项 | Vercel serverless 天然多实例，「单实例假设」必然失效 | 待拍板（但**强烈建议冻结**） |

> 🆕 **v0.4 就地改写（§10.3 R82，P1f F3① / §11 S5 + S6 + S12）——超时口径改写为「函数内自证预算」**（**上表 R82 条文一字未改**；本块为就地更正，与条文冲突时以本块为准）：
>
> **（1）删除的旧声明（留痕）**：~~「函数内 `set_config('statement_timeout', <10s>, true)` 给本条语句设上界，超时映射 `503 LEDGER_TX_TIMEOUT`」~~ —— **实测对「它自己那条语句」完全无效**（同语句 `set_config` 后跑慢语句**不被取消**；机制隔离实验：同语句 `set_config(1500,true)` + `pg_sleep(4)` = 4311ms 未被取消、`is_local=false` 同样 4193ms 未被取消；而对照「**独立语句** `SET statement_timeout=1500` 后再跑」在 1705ms 被取消并返回 `57014`）。⇒ v0.4 **作废该假声明**（**本册 v0.3 正文并无该句，它出现在实现侧 `0004` 的 C1 段与 `docs/seafood.master-plan.md` D-03 行**；本版在 spec 中**新增显式否证行**）。
>
> **（2）v0.4 口径（函数内自证预算，实测有效）**：
> · `ledger_stmt_budget_ms() = 10000`（单条语句 = 一个业务事件的**自证总预算**，与 R82 的 10s 建议同值）；
> · `ledger_lock_timeout_ms() = 3000`（单次等锁上限，与 R82 的 3s 建议同值）；
> · `ledger_arm_lock_timeout(deadline, label)`：**每次等锁前**把 `lock_timeout` 压到 **`min(3000, 剩余预算)`**（`lock_timeout` 是**逐次获取**生效的，实测有效）；剩余 ≤ 0 时**不尝试等锁**，直接报 `LD026`；
> · `ledger_check_budget(deadline, stage)`：**取锁前后 / 关键阶段间**查 deadline，越界即报 `LD026`；
> · `LD026` = SQLSTATE **`LD026`** / MESSAGE `LEDGER_TX_TIMEOUT` / **`503`** / DETAIL `{ reason: 'statement_budget_exhausted', budget_ms: 10000, remaining_ms, stage, retryable: true }`。
> **钳位实测（`budget_clamp`）**：deadline = `now()+1s` ⇒ `lock_timeout = 999ms`；`+1.5s` ⇒ `1499ms`；`+60s` ⇒ **`3s`**（被 3s 常量封顶）；`NULL` ⇒ **`3s`**；`now()−1s`（逾期）⇒ 抛 `LD026`。三个分支各有独立读数。
>
> **（3）上限的**尺度**（S12，必须原样写入，不得美化）**：R82 的 10s 是**语句级**上限，**不是端到端上限**。
> · **实测（两轮同一场景「6 持锁者 × 单键」）**：落盘原始读数 `p1f03-f3-readings.json`（`total_wait_chain`，run tag `H262V`）—— DB 侧单语句 `max_db_elapsed_ms = **10142**`（39 次 `pg_stat_activity` 取样），客户端总耗时 `measured_total_wait_ms = **11283**`，其中 `client_overhead_ms = **1141**`；`p1f-acceptance.md §7.5` 引用的**更早一轮**（run `GT4OR`）为 `10106` / `10897` / `791`。⇒ **「端到端 ≤10s」未验证、也未实现**（客户端/连接开销另计 +0.8~1.3s）。
> · 对照：**修前**同场景实测 `15583ms`；**旧宣称最坏值 `48000ms`**（= 「16 账户 × 3s」的乘法推算；出处为 `docs/seafood.master-plan.md` D-03 行，**非本册**）。⇒ 累计等待的**乘法效应**确已被预算钳住（`clamped_to_le_10s = true`），但**机读上限 10s 应理解为语句级**（登记为 §16 #6）。
> · 两轮的另一处差异：终局码（`LD026 reason=statement_budget_exhausted` vs `LD025 reason=lock_timeout`）—— 二者都是 `503` 类且 `rows_written_0 = true`，**终局码口径未统一**，见 §19.9.F。
>
> **（4）§E 单一 EXCEPTION 处理器接不住 `57014`（S6，必须原样写入）**：`statement_timeout` **绕过** plpgsql 的 `EXCEPTION` 处理器 —— `stmt_timeout_catchable_by_plpgsql = **false**`（逃逸矩阵 5 组对照 A1/A2/B1/B2/B3 + 附测 B4/B5 一致）；`lock_timeout` 则**可**接住（`lock_timeout_catchable_by_plpgsql = **true**`，B2 组观测到内层捕获 `55P03` 后改抛 `ZZ999`）。⇒ **`LD026` 的唯一产生源是预算助手**（`ledger_arm_lock_timeout` / `ledger_check_budget`），**不得**写成「§E 处理器接住 `57014` 再转码」；`57014` 只能由 **§C 分类器**机读归类（`bucket = 'retryable'` → `LEDGER_TX_TIMEOUT`，TS 侧 503）。
>
> **（5）池化路径的已知边界**：pooler 端点**拒绝** `options` 启动参数（`08P01` `unsupported startup parameter in options`）⇒ 连接级 `statement_timeout` 在**池化路径不可用**；连接级超时只在**直连**端点可用（`options=-c statement_timeout=10000`，实测 `SHOW = 10000ms` 且按预期取消）。⇒ **池化路径一律依赖本节的自证预算**（登记为 §16 #8）。

---

## §11 对账判据与判负能力

### 11.1 判据清单（9 条，全部为**必须能判负**的断言）

| # | 判据 | 口径 | SQL 形状（示意） |
|---|---|---|---|
| 1 | **账户级守恒** | 每个 `(uid, cid)`：`balance == Σ delta` 且 `frozen == Σ frozen_delta` | `SELECT a.uid,a.cid,a.balance,a.frozen,COALESCE(s.d,0),COALESCE(s.f,0) FROM account a LEFT JOIN (SELECT uid,cid,SUM(delta) d,SUM(frozen_delta) f FROM ledger_entry GROUP BY uid,cid) s USING (uid,cid) WHERE a.balance<>COALESCE(s.d,0) OR a.frozen<>COALESCE(s.f,0)` |
| 2 | **快照一致性** | 每个 `(uid, cid)` 的最新分录快照 == `account` 当前值 | `... JOIN LATERAL (SELECT balance_after,frozen_after FROM ledger_entry l WHERE l.uid=a.uid AND l.cid=a.cid ORDER BY txid DESC LIMIT 1) l ON true WHERE a.balance<>l.balance_after OR a.frozen<>l.frozen_after` |
| 3 | **全局总量守恒** | 按 `cid`：`Σ account.balance == Σ delta(全表) == Σmint − Σburn` | `SELECT cid, SUM(balance) FROM account GROUP BY cid` 与 `SELECT cid, SUM(delta) FROM ledger_entry GROUP BY cid` 逐行相等 |
| 4 | **币种发行量** | `currency.total_supply == Σ(mint.delta) − Σ(burn 的绝对额) + Σ(冲正对 mint/burn 的净调整)` | 三个聚合按 `cid` 比对 |
| 5 | **冻结归属守恒** | 每个 `(uid, cid)`：`account.frozen == Σ(业务表在冻额)`（挂单未成交量 + 招工托管额 + …）〔v0.1 旧写法含「+ 上市保证金」—— 保证金自 v0.2 起为消耗、不进 `frozen`，不在本判据内〕 | **待 P3/P4/P5 业务表落地后补 SQL**；本册只冻结「必须存在这条判据」 |
| 6 | **佣金池守恒** | `account(−2, cid).balance == Σ(job_fee 入池额) − Σ(commission 出池额)` | `SELECT balance FROM account WHERE uid=-2 AND cid=$1` 对比两组聚合 |
| 7 | **平台收入守恒** | `account(−1, cid).balance == Σ(trade_fee) + Σ(listing_fee) + Σ(currency_create_fee) + Σ(listing_deposit)`〔v0.2 新增 `listing_deposit`；v0.1 旧写法不含（当时保证金是冻结、不计收入）〕；罚没账户 `−3`：`balance == Σ(hold_forfeit) − Σ(退还)`〔**v0.3 更正**：删 `+ Σ(listing_deposit_forfeit)` —— 该 kind 已于 v0.3（P1c）删除，见 §5.1 #21 / §19.8.B〕 | 按 `uid = −1` / `uid = −3` 分别比对 |
| 8 | **事件配对不变式（v0.2 更正正式形状）** | 每个业务事件（`ref_type` + `ref_id` + 同一提交）内 **`Σ(delta + frozen_delta) == 0`**，**除非**该事件含 `mint` / `burn`（此时差额恰好等于净增发额）。<br>**为什么 v0.1 的字面式不成立**：§4.2 三态记账规定「一次 `hold` 必然产生 `delta = −n`、`frozen_delta = +n`」（同账户两条分录，见 R34 / R42），于是该事件内 `Σ delta = −n ≠ 0` 且 `Σ frozen_delta = +n ≠ 0` —— **两个字面式在任何一次冻结/解冻事件上都不可能同时为 0**，与 §4.2 自相矛盾。同一形式化错误也出现在 R41 与 §5.1 `trade` 注（v0.2 已就 R41/`trade` 加指针与更正）。<br>正确形状：账户净资产 = `balance + frozen`（§4.1 恒等式），故「同一事件不造钱、不吞钱」的等价表述是把两个余额维度**相加**：`Σ(delta + frozen_delta) = 0`。`hold` / `hold_release` 的 `+n − n` 自动归零；`frozen → 对方 balance` 的结算类与 `hold_forfeit` 也自动归零。<br>📌 **v0.1 旧写法（留痕，作废）**：`Σ delta == 0` **且** `Σ frozen_delta == 0`。 | `SELECT ref_type, ref_id, SUM(delta + frozen_delta) FROM ledger_entry WHERE ref_type IS NOT NULL GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0`（含 `mint` / `burn` 的事件按净增发额豁免） |
| 9 | **平台账户非负** | 所有 `uid <= 0` 的账户也必须满足 `balance >= 0 AND frozen >= 0`（平台账户不得透支；池子空了就是登记口径出错） | 复用判据 1 的命中集，额外过滤 `uid <= 0` |

> 🆕 **v0.4 就地落位（§11.1 判据 8，P1f F1② / §11 S4 + F1 修后取证）——判据 8 的**键族**归组口径改写**（判据 8 的公式本体不变，改的是「按什么把分录归成一个事件」）：
> ① **旧口径（v0.3，作废）**：键族靠 `split_part(idempotency_key, '#', 1)`（纯**字符串前缀算术**）归组 —— 在「调用方键可含 `#`」的前提下它**必然**把他人的派生行算进自己的事件（F1 缺陷）。
> ② **v0.4 正式口径（归属列优先）**：按 **`event_root_key`** 归组；**历史行**（`event_root_key IS NULL`，`0005` 之前写入）**回退** `split_part(idempotency_key,'#',1)`：
> ```sql
> SELECT event_root_key, count(*), sum(delta), sum(frozen_delta)
>   FROM ledger_entry
>  GROUP BY COALESCE(event_root_key, split_part(idempotency_key, '#'::text, 1))
> HAVING ...;                       -- 口径①：归属列优先 + 历史行回退
> ```
> ③ **两种口径都必须归零**（判据 8 的键族形状）：口径①（归属列优先，历史行回退 `split_part`）与口径②（**纯键前缀算术，无视归属列** = 历史行口径）**均须 0 行**。实测（F1 修后）：`judgement8_bykey_mixed_rows = 0`、`judgement8_bykey_prefixonly_rows = 0`、`judgement8_byref_rows = 0`。
> ④ **判据 8 的 ref 形状**（按 `ref_type` + `ref_id` 分组 `Σ(delta + frozen_delta) ≠ 0`）与判据 1 一并维持：`judgement1_rows = 0`（写入测试数据后复读仍 0 行）。

### 11.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R87** | **上表 9 条判据全部必须实现**，缺一条即视为对账功能未交付。判据 5 因依赖业务表，允许在 P1 阶段实现为「占位 + 显式标注未启用」，但**必须在 P3 首个业务模块落地时补齐**（否则挂单冻结会静默漂移）。 | 建议路径 `backend-ts/scripts/reconcile-ledger.ts`；P1 交付物 | 判据 5 是最容易被漏掉的一条（它跨越账本与业务表），验收时必须显式确认「已启用 / 未启用 + 未启用的原因」 | 已冻结（P1 AC：对账脚本）+ 判据 5 补齐时点为待拍板 |
| **R88** | **脚本退出码与输出契约**：`0` = 全部判据通过；`1` = 存在不一致（差异清单已输出）；`2` = 脚本自身错误（连不上库、SQL 报错）。输出**必须**同时具备：① 机读 JSON（写盘 `reconcile-<date>.json`）；② 人类可读摘要（stdout，含命中行数与首 N 条差异明细，含 `uid/cid/期望值/实际值/差值`）。 | `reconcile-ledger.ts`；CI/定时任务 | 「打印一行 OK 就退出」不算交付；差异明细必须能定位到具体账户 | 待拍板（退出码约定可改，但必须固定且写进文档） |
| **R89** | **判负能力（本册对 P1 AC 的直接承接）**：判据必须被证明「能判负」——做法为**注入-还原演练**，对**每一条**判据至少一个注入用例，且**每条注入都必须能被对应判据报出**：<br>判据 1 ← 插入一条 `ledger_entry`（`delta=+1`、不更新 `account`）<br>判据 2 ← 把某 `account.balance` 手动 +1<br>判据 3 ← 同判据 1<br>判据 4 ← `UPDATE currency SET total_supply = total_supply + 1`<br>判据 6/7 ← 手动改 `account(−1/−2)` 的 `balance`<br>判据 8 ← 插入一条**单边**分录（只写减方、不写增方）<br>判据 9 ← 把 `account(-1).balance` 改成负数（应被 `CHECK` 拒 ⇒ 该步验证的是 CHECK，判据 9 用「跳过」记通过） | P1 质检用例；Neng 执行 | 演练必须记录：**注入前指纹 → 注入 → 脚本必须红（贴出差异行）→ 还原 → 脚本必须绿 → 指纹回到基线**。缺「还原后回绿」这一步的演练不算完成 | 已冻结（P1 AC：对账脚本在人为注入脏数据时能报错） |
| **R90** | **注入方式优先序**：首选「**插入孤儿分录**」（不更新 `account`）与「**改 `currency.total_supply`**」——这两类不受 `trg_account_guard` 拦截，注入干净、还原干净。**不把「`ALTER TABLE ... DISABLE TRIGGER`」作为首选**；若某个判据只能用禁 trigger 才能注入，必须在报告里显式说明理由，并保证演练结束后 trigger **已恢复**（`pg_trigger.tgenabled = 'O'` 取证）。 | 质检演练脚本；取证命令 `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='account'::regclass` | 「禁用 trigger 后忘了恢复」是这类演练的典型事故，必须取证；顺带可验证「直接 `UPDATE ledger_entry` 会被 trigger 拒」这条 append-only 断言 | 待拍板（**强烈建议按此口径**） |
| **R91** | **对账脚本禁止自动改数**（no auto-fix）。发现不一致时只能：① 报警 + 落盘差异清单；② 由人工决策后走 `reversal` 冲正（`ops:` 幂等键 + 操作人留痕）。**禁止**任何「差异自动补齐」的代码路径（那是掩盖缺陷）。 | `reconcile-ledger.ts` 只读连接；纠错走独立后台接口 | 脚本应使用**只读连接**运行，从连接层面杜绝误写 | 待拍板（一句话可改） |
| **R92** | **运行频率与留痕**：① 上线前必须跑一次全量并归档；② 每日定时跑一次（P1 起即可用 cron / 后台按钮触发）；③ 任何涉及流水的 migration / 运维操作**前后各跑一次**（并入 §9 R78 的取证流程）。归档保留期与流水一致（不设 TTL）。 | 定时任务 + `reconcile-<date>.json` 归档 | 对账日志本身必须落盘到**不受 `ledger_entry` 清理影响**的位置 | 待拍板（频率可改） |
| **R93** | **判负能力同样适用于并发与幂等用例**（不止对账）：§10 R85 的五条并发用例、§6 R51 的幂等协议，都必须各有「能让它变红的对照」——例如把 `FOR UPDATE` 去掉后并发用例必须出现负余额或总额不守恒；把 `ON CONFLICT DO NOTHING` 改成「先查后插」后同键并发必须双扣。**没有对照的绿色用例视为装饰**。 | P1 质检报告结构：每条用例 = 用例 + 对照实验 + 两次读数 | 报告的「通过」必须附「对照实验时的红」的证据，否则不予采信 | 待拍板（**强烈建议按此口径**） |

---

## §12 索引清单

### 12.1 索引清单（**必建**，共 **12** 个〔v0.4 新增 1 个：`idx_ledger_event_root_key`，见 §19.9.A/S4〕）

| 表 | 索引名 | 定义 | 服务的查询 |
|---|---|---|---|
| `account` | `account_pk` | `PRIMARY KEY (uid, cid)` | 点查账户、行锁 `FOR UPDATE` |
| `account` | `idx_account_cid_balance` | `(cid, balance DESC)` | 币种持仓排行、按币种汇总总量（判据 3） |
| `account` | `idx_account_frozen` | `(cid, uid) WHERE frozen > 0` | 「在冻账户」扫描（判据 5，避免全表） |
| `currency` | `currency_symbol_uniq` | `UNIQUE (symbol)` | 符号查币、防重名（R7） |
| `currency` | `idx_currency_owner` | `(owner_uid)` | 「我创建的币」列表、owner 铸币授权判定（R23） |
| `currency` | `idx_currency_status` | `(status) WHERE status <> 'delisted'` | 交易所/商品选择器只列可用币种（R28） |
| `ledger_entry` | `ledger_entry_pkey` | `PRIMARY KEY (txid)` | 单条取证、冲正自引用 FK |
| `ledger_entry` | `ledger_idem_uniq` | `UNIQUE (idempotency_key)` | **幂等探测**（R51，最高频写路径） |
| `ledger_entry` | `idx_ledger_event_root_key` | `(event_root_key)`〔**v0.4 新增（P1f F1②）**，见 §19.9.A/S4〕 | **重放判定**（按事件根键**精确归属**；R51/R52）〔v0.3 旧口径：重放靠 `left(idempotency_key, …)` 字符串前缀算术 ⇒ **无索引可用**〕 |
| `ledger_entry` | `idx_ledger_uid_cid_txid` | `(uid, cid, txid DESC)` | 流水分页、余额快照链、判据 1/2（**最重要的读索引**） |
| `ledger_entry` | `idx_ledger_ref` | `(ref_type, ref_id)` | 业务单据页「相关流水」 |
| `ledger_entry` | `idx_ledger_kind_time` | `(kind, time_created DESC)` | 佣金池/平台收入对账（判据 6/7）、按类型统计 |

**可选（大表优化，P5 后再评估）**：`ledger_entry` 上的 `time_created` 用 **BRIN** 索引（append-only 表天然按时间聚簇，BRIN 体积极小），用于「全表按时间窗扫描」。

### 12.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R94** | §12.1 的 11 个索引为**必建**；其中 `ledger_idem_uniq` 与 `idx_ledger_uid_cid_txid` 是**性能关键路径**，缺失会导致幂等探测退化为全表扫描、流水分页退化为排序。 | migration 中显式 `CREATE INDEX`；P1 验收项 | 索引必须在**建表同一 migration** 内创建（不要留到「以后再加」，实测中这类「以后」不会发生） | 待拍板（清单可增，不可减） |
| **R95** | **流水分页必须用 keyset 分页**：`WHERE uid=$1 AND cid=$2 AND txid < $last_txid ORDER BY txid DESC LIMIT n`。**禁止** `OFFSET`（大偏移会退化为 O(offset) 扫描，且翻页期间有新流水时会重复/漏项）。 | 账单接口；前端 `before_txid` 游标 | 响应体必须回传 `next_before_txid`（或 `null` 表示到底），前端不得自行算页码 | 待拍板（一句话可改） |
| **R96** | `ledger_entry` 是**热写表**，二级索引数量上限建议 **≤ 6 个**（v0.4 起 **当前 6 个** = 原 5 个 + `idx_ledger_event_root_key`，见 §12.1 / §19.9.A）。新增索引必须说明「为什么现有索引不能覆盖」，并评估写放大。 | migration 审查清单 | 若将来必须高并发写入，优先考虑按 `time_created` 分区，**不是**继续加索引 | 待拍板（上限可改） |
| **R97** | **对账查询的执行口径**：① 判据 1/2 的聚合必须能走 `idx_ledger_uid_cid_txid`（按 `(uid, cid)` 分组，**禁止** `GROUP BY (uid, cid)` 全表后再 join 的小学生写法 —— 大表会 OOM）；② 大表场景按 `cid` 分批、每批按 `txid` 区间切片；③ 判据 2 用 `LATERAL ... ORDER BY txid DESC LIMIT 1` 已是最优形状。 | `reconcile-ledger.ts` 的查询写法 | ⚠️ 与 §11 R87 判据 1 的示意 SQL 有张力：示意版适合小表打样，**生产版必须走游标分批**（同一判据、两种形状，验收时以生产版为准） | 待拍板（**本册第七条重要裁决**） |

---

## §13 平台账户建模

### 13.1 裁决：**用保留 uid，不用独立账户表**

**理由**：账本的全部不变量（`Σ delta == balance`、append-only、对账判据）都建立在「所有余额都在 `account` 里」这一前提上。若给平台另开一张 `platform_account` 表，就会出现**第二套账**，判据 1/3/7 全部失效。因此平台只能用**保留 uid** 走同一张 `account` 表。

### 13.2 保留 uid 区间（**写死，不可分配**）

| uid | 名称 | 用途 | 资金来源 | 资金去向 |
|---|---|---|---|---|
| `0` | 平台主体 | `$` 的 `owner_uid`；铸币源；平台系统身份 | `mint` | `mint` 到用户、平台运维转账 |
| `−1` | **手续费归集账户** | **平台收入**：`trade_fee` + `listing_fee` + `currency_create_fee` + **`listing_deposit`（v0.2 新增：上市保证金已改为消耗，直接入本账户）** | 上述四 kind 的增方〔v0.1 旧写法：「上述三 kind」〕 | 平台运维提取（需独立 kind，**当前 kind 集未含，见 §15 待拍板**） |
| `−2` | **佣金池** | 招工手续费的唯一入口，只能经 `commission` 流出 | `job_fee` 的增方 | `commission` 的减方；未分配余额累计留存 |
| `−3` | **罚没账户** | `hold_forfeit`〔**v0.3 更正**：删 `+ listing_deposit_forfeit`（该 kind 已于 v0.3（P1c）删除，见 §5.1 #21 / §19.8.B）；v0.2 旧写法：`hold_forfeit` + `listing_deposit_forfeit`〕 | 上述 kind 的增方〔v0.3：原「两 kind」→ 现仅一 kind〕 | 退还（反向 `hold_forfeit`，或**以 `transfer` 出账 —— 全平台仅本账户允许**，见 R101 已裁定）/ 提取 |
| `−4` … `−99` | **预留** | 后续池子（如争议保证金、活动池） | — | — |
| `−100` 及以下 | **禁止使用** | — | — | — |

真实用户 uid **恒为正整数**（legacy `"users".uid` 由自增分配〔**v0.4 更正（D11）**：身份表已由 `0006` 改名 `users`，列名为 `uid`（`bigint`，自增从 1 起）〕，见 §16 未实测 #6）。

**不设「保证金池」账户（v0.2 口径）**：上市保证金是**消耗**：在上市事务内直接从创建者 `balance` 扣、转入平台手续费归集账户 `uid = −1`（kind `listing_deposit`），**既不设保证金池、也不再表现为用户账户的 `frozen`**。<br>📌 **v0.1 旧写法（留痕）**：D7 已冻结保证金是**冻结的可退资金**，故它表现为用户自己账户的 `frozen`，不搬到平台账户（R36：业务表是在冻归属真源）。→ 已按 Kevin 原文更正，见 §3.1 R31。

### 13.3 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R98** | 保留 uid 区间 = `0` 与 `−1 … −99`；**真实用户 uid 必须 `> 0`**。任何创建 uid ≤ 0 用户的路径都必须被拒绝（`LEDGER_RESERVED_UID`）。 | `ledger_owner.owner_type`；用户注册路径校验 | 与 legacy `"users".uid` 的自增分配兼容（自增从 1 起）〔**v0.4 更正（D11）**：表名 `users`（`0006`）、列名 `uid`〕 | 待拍板（区间可改，语义不可改） |
| **R99** | 平台账户的 `account` 行必须由 **migration 种子**创建（`balance = 0, frozen = 0`，满足 R75 的开户 0/0 约束），**不得**依赖运行期懒创建（懒创建会与 `account_guard` 的 INSERT 分支交互出竞态）。 | migration 种子 SQL：为每个保留 uid × 每个已存在币种开户 | 新增币种时必须同步为保留 uid 开户 —— 这条要落成一个**统一的开户函数**（建议名 `ensureAccount(uid, cid)`），避免遗漏 | 待拍板（一句话可改） |
| **R100** | **用户请求不得命中平台账户**：路由/服务层必须校验「调用方 uid 与请求涉及的 uid」均 `> 0`（除平台受信任路径外）。例如 `/transfer` 不允许 `to_uid = −2`。 | 路由层守卫（建议名 `assertUserUid()`）；错误码 `LEDGER_RESERVED_UID` | 这是防止「用户把手续费池当收款人」这类经济漏洞的第一道闸；**必须**有专门的负向用例（尝试向好 `−1` 转账 ⇒ 必须 4xx） | 待拍板（**强烈建议冻结**） |
| **R101** | 平台账户的**允许 kind 白名单**：`−1` 只接受 `trade_fee` / `listing_fee` / `currency_create_fee`（增方）与运维提取（待定 kind）；`−2` 只接受 `job_fee`（增）与 `commission`（减）；`−3` 只接受 `hold_forfeit`（增）与退还〔**v0.3 更正**：删 `listing_deposit_forfeit` —— 该 kind 已于 v0.3（P1c）删除，见 §5.1 #21 / §19.8.B；v0.2 旧写法：`hold_forfeit` / `listing_deposit_forfeit`〕（另见下款已裁定例外：**仅 `−3` 允许以 `transfer` 出账**）。**禁止**对平台账户使用 `transfer` / `hold` / `purchase`。<br>✅ **已裁定（Zang · P1a 收口，登记见 §19.1）**：**仅 `uid = −3`（罚没池）允许以 `transfer` 出账**（对应 R38 的「罚没退还」），其余平台账户（`0` / `−1` / `−2` / `−4…`）的白名单**从严**、`transfer` 一律禁止；本裁定**不放宽任何其他格**（`hold` / `purchase` 对全部平台账户仍禁止）。<br>**🔴 v0.13 就地更正（Zang §5.81 勘误落位）**：**`−1` 的增方白名单追加 `listing_deposit`** —— 原文只列 `trade_fee` / `listing_fee` / `currency_create_fee`（**漏列**）；依据 = 「上市保证金 = **消耗**、转入 `uid = −1`、**计入平台收入**」（§3.1 **R31** `:287` / §3.2 转移表 `:269` / §13.2 的 `−1` 行 `:827` / §11 判据 7 `:754` **自 v0.2 起已如此登记**）⇒ 本次**只加此一格、其它格一律不动、旧写法（三项）保留留痕**；**DB 侧落点** = **`0019` 迁移**（**★ FIX-A 已落盘并已应用：`migrations/0019_listing_deposit_platform_credit.sql` 在盘 + `/health` ⇒ `schema_version=0019`**，照 `0008_platform_revenue_job_fee.sql` 先例做**加法式**扩展）；**kind 关闭集仍 20**（R40 不动）；详见 §19.17。 | 服务层白名单校验（建议名 `assertPlatformAccountMutation()`） | 平台账户只读展示为主，任何写都必须能对应到一个明确 kind，便于判据 6/7 复算 | 待拍板（一句话可改） |
| **R102** | 平台账户**不得透支**（`balance >= 0` 同样适用，判据 9）：若某笔 `commission` 需要从 `−2` 支出而池子不足 ⇒ 说明整个事务的中止逻辑有缺陷，必须回滚整笔业务，**不得**让池子变负、也**不得**跳过该笔佣金。 | `account_bal_guard` + 判据 9；§7.2 #8 事务 | 「佣金池不足」在正常情况下不可能发生（`job_fee` 与 `commission` 同事务、金额相等），若发生即为缺陷告警 | 待拍板（**强烈建议冻结**） |
| **R103** | 「平台运维提取」（把 `−1` 的钱转出平台）**当前 kind 集不覆盖**：现有 **20 个** kind（**v0.3（P1c）**：删 `listing_deposit_forfeit`，见 §19.8.B；v0.2 旧写法：21 个；v0.1 旧写法：22 个，其中 `listing_deposit_refund` 已于 v0.2 删除）里没有任何一个表示「平台账户 → 外部/运维」。因此：① 在补 kind 之前，平台收入账户**只进不出**；② 补 kind 的建议名为 `platform_withdraw`（减方 `−1`，增方 `uid = 0` 或指定主体），并在 §5.1 登记后再启用。 | kind 集的后续扩展；§15 待拍板第 4 条 | ⚠️ 这是本册主动暴露的**口径缺口**（不是遗漏，是刻意留白）：在没有 `platform_withdraw` 之前，后台**不得**提供「提取平台收入」按钮，否则会绕过账本 | 待拍板（**需 Kevin 拍板是否需要提取动作**） |

> **★★ ★ v0.14 就地加注（Zang 裁定 `R-9-14` · P9② 连带）—— `−1` 增方（credit）白名单追加 `checkin_makeup_fee`（2026-10-03）**
> **依据（逐字）**：`docs/seafood.master-plan.md` **§5.230 B** `R-9-14`（`:1428`）+ `docs/data-layer.spec.md` **v0.21 §31.1(d)(b)**。**裁定**：`R101` 的 **`−1` 增方（credit）白名单追加 `checkin_makeup_fee`**（手法逐字照 v0.13 对 `listing_deposit` 的**加法式**扩展 + `0019_listing_deposit_platform_credit.sql`）。
> **① 现取位置（逐字 · 本册在册格）**：**`§13.3 R101`** = `docs/ledger.spec.md:845` —— 该行 `−1` 增方格现列 **`trade_fee` ／ `listing_fee` ／ `currency_create_fee`**（原文三项）+ v0.13 就地更正**追加 `listing_deposit`**（同行 🔴 v0.13 块）；本块 = **就地再追加 1 个 kind `checkin_makeup_fee`**（**旧文一行不改** · 只增不改序）。
> **② DB 侧现取（逐字 · 本册亲读）**：`backend-ts/migrations/0019_listing_deposit_platform_credit.sql:63` = `-1 credit IN ('trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit')`；`backend-ts/src/ledger.ts:550` = `'-1': { credit: ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit'], debit: [] }` ⇒ **裁定后两处同轮追加 `checkin_makeup_fee`**（由 `0028` 迁移 ／ P9② 实现单落地）。
> **③ 定案（写死）**：`−1` 增方（credit）白名单（现行） = `trade_fee` ／ `listing_fee` ／ `currency_create_fee` ／ `listing_deposit` ／ **`checkin_makeup_fee`**；**其余格一律不动**（`0` ／ `−2` ／ `−3` 白名单与「**仅 `−3` 允许 `transfer` 出账**」等**全部保持 v0.13 口径**）。
> **④ DB ／ 代码落地归 P9② 实现单**：`0028_kind_close_set_21.sql` + `ledger.ts` `PLATFORM_KIND_WHITELIST['-1'].credit`（§31.1(d)(b)）；**本册不改 `src/`**。
> **★★ ★ v0.15 就地加注（Zang 终审 `R-9-65` / `R-9-66` · P9⑤ C3）—— `R101` 的 `−1` `debit` 首开（仅 1 项）＋ `R103` 就地修订（2026-10-03）**
> **依据（逐字）**：需求 `docs/requirements/p9-four-role-economy.md` **§6.2②**（「新用户完成首个平台任务后，邀请双方发放 `10$` 积分」）+ `docs/seafood.master-plan.md` **§5.269 C**（`R-9-66` 终审）+ `docs/commission.spec.md` v0.4 §19.11 `R-9-57`。
> **① `R101` 就地增补**：**`−1` 的 `credit` 白名单 8 值逐字不变**（`trade_fee` / `listing_fee` / `currency_create_fee` / `job_fee` / `listing_deposit` / `checkin_makeup_fee` / `bttc_mint_fee` / `bttc_burn_fee`）；**`−1` 的 `debit` 白名单首开、且仅 1 项 = `invite_first_task_reward`**（★★ **首次给平台收入账户开 `debit`** —— **不是**「开放 `−1` debit」；白名单外 `−1` debit 仍必拒）。`−2` / `−3` / `0` 各格与「**仅 `−3` 允许 `transfer` 出账**」**全部保持 v0.13/v0.14 口径不动**。
> **② `R103` 就地修订（分层区分）**：**「平台运维提取」= 把 `−1` 的钱转出系统**（建议 kind `platform_withdraw`）—— **本格留白保持不变**：`platform_withdraw` **仍未批**、后台**不得**提供「提取平台收入」按钮、`§15 #3` ★★★ **仍待 Kevin 拍板**。**★ 与另一件分层区分**：**「运维提取」= 转出系统**（`platform_withdraw`）⇄ **「需求规定的发放」= 系统内转移**（`invite_first_task_reward`，**需求 §6.2② 明文授权** ⇒ 经 `R101` 的 `−1` debit 白名单**放行**）—— **二者不同层级**，`invite_first_task_reward` **不触碰本格留白**（`§15 #3` 与之**无关**）。
> **③ 判负必须带**：白名单外 `−1` debit（如未批的 `platform_withdraw`）仍必红（`code = LEDGER_RESERVED_UID` / `400`）；白名单内 `invite_first_task_reward` **放行**（不触发该守卫）。★ **Jing 现取说明**：`reason` 诊断值按方向取 —— 代码 `debit` 支当前抛 `PLATFORM_DEBIT_FORBIDDEN`（`ledger.ts:597` / `0038`）；`reason` **非契约**（§14.3 v0.7 (A)「**只准按 `code` 分支，不得按 `reason` 分支**」）⇒ **本册判负口径 = `code`**（`LEDGER_RESERVED_UID`）。
> **④ 显式登记（★ 一句话可改）**：本项触碰 `§15 #3` 的 ★★★ 留白（平台账户出账），故**显式登记**并标「**一句话可改**」—— 备选 = **退回 Poster**（`uid = employer`）/ 改由 Poster 出账（即首任务 10$ 不由平台发放）；**不阻塞**（因需求 §6.2② 已**明文授权**）。**批准留痕** = Zang 终审 `R-9-66`。
> **⑤ 落地边界**：**DB / TS 落地归 P9⑤ 实现单**（`0038_kind_close_set_24.sql` + `ledger.ts` `PLATFORM_KIND_WHITELIST['-1'].debit`）；**本册不改 `src/`**（只读）。详见 **§19.18**。

---

## §14 统一错误码清单

### 14.1 错误码全表

命名规范：`LEDGER_<AREA>_<REASON>`，`AREA ∈ {BALANCE, CURRENCY, IDEM, TX, AMOUNT, GUARD, PLATFORM, RECON}`。

| # | 错误码 | HTTP | 触发条件 | 中文文案建议（zh） |
|---|---|---|---|---|
| 1 | `LEDGER_INSUFFICIENT_BALANCE` | `409` | 可用余额不足（`balance < 扣款额`） | 可用余额不足 |
| 2 | `LEDGER_INSUFFICIENT_FROZEN` | `409` | 解冻/结算额超过 `frozen` | 冻结余额不足 |
| 3 | `LEDGER_IDEMPOTENCY_REPLAY` | `200` | 同键同指纹重复提交（**不是错误**，`idempotent_replay: true`） | （无提示，按成功处理） |
| 4 | `LEDGER_IDEMPOTENCY_CONFLICT` | `409` | 同键但请求指纹不同 | 该请求与先前的请求内容不一致 |
| 5 | `LEDGER_IDEMPOTENCY_KEY_REQUIRED` | `400` | 写请求缺少幂等键 | 请求缺少幂等标识 |
| 6 | `LEDGER_IDEMPOTENCY_KEY_INVALID` | `400` | 键不符合前缀规范 | 请求标识格式不合法 |
| 7 | `LEDGER_CURRENCY_NOT_FOUND` | `404` | `cid` 不存在 | 该单位不存在 |
| 8 | `LEDGER_CURRENCY_NOT_LISTED` | `409` | 币种状态不允许该操作（§3 R28 矩阵） | 该单位尚未上市，暂不可交易 |
| 9 | `LEDGER_CURRENCY_FROZEN` | `423` | 币种被合规冻结 | 该单位已暂停交易 |
| 10 | `LEDGER_CURRENCY_DELISTED` | `409` | 币种已下架 | 该单位已下架 |
| 11 | `LEDGER_CURRENCY_INVALID_TRANSITION` | `409` | 非法状态转移（§3.2 白名单外） | 状态不允许此变更 |
| 12 | `LEDGER_CURRENCY_SYMBOL_TAKEN` | `409` | `symbol` 唯一约束冲突 | 该符号已被占用 |
| 13 | `LEDGER_CURRENCY_MISMATCH` | `400` | 跨币种动作（如冻结 A 解冻 B） | 币种不一致 |
| 14 | `LEDGER_SUPPLY_CAP_EXCEEDED` | `409` | 铸造超过 `supply_cap` | 已达该单位发行上限 |
| 15 | `LEDGER_UNAUTHORIZED_MINT` | `403` | 非 owner / 非平台发起铸币 | 你没有发行该单位的权限 |
| 16 | `LEDGER_HOLD_NOT_ALLOWED` | `403` | 试图手动冻结余额 | 不支持手动冻结 |
| 17 | `LEDGER_AMOUNT_INVALID` | `400` | 金额非正整数/非字符串/超上限 | 金额格式不正确 |
| 18 | `LEDGER_AMOUNT_NOT_POSITIVE` | `400` | 金额 ≤ 0 | 金额必须大于 0 |
| 19 | `LEDGER_DECIMALS_OVERFLOW` | `400` | 小数位超过币种 `decimals` | 该单位最多支持 N 位小数 |
| 20 | `LEDGER_SELF_TRANSFER` | `400` | 转给自己 | 不能转给自己 |
| 21 | `LEDGER_ACCOUNT_NOT_FOUND` | `404` | 账户不存在（未开户） | 账户不存在 |
| 22 | `LEDGER_RESERVED_UID` | `400` | 请求命中平台保留 uid（§13 R100/R98） | 目标账户无效 |
| 23 | `LEDGER_REF_NOT_FOUND` | `404` | `ref_type`/`ref_id` 指向的业务单不存在 | 关联单据不存在 |
| 24 | `LEDGER_UNKNOWN_KIND` | `400` | 传入 kind 不在 §5.1 白名单内 | 不支持的账务类型 |
| 25 | `LEDGER_TRANSACTION_REQUIRED` | `500` | 写路径未在事务上下文中执行（§7 R55）〔**v0.4 扩写**：DB 侧 `LD024` 的**唯一**码；另承接 `08P01`（启动协议参数错误 = 我方连接配置缺陷 ⇒ `reason = 'protocol_violation'`）与「派生分录撞唯一约束」（`reason = 'derived_key_collision'`）两类**实现缺陷**（R108 必告警）；见 §14.3 附 / §19.9.A〕 | 服务暂不可用，请稍后重试 |
| 26 | `LEDGER_LOCK_TIMEOUT` | `503` | `lock_timeout` 触发〔**v0.4 落位**：DB 侧 `55P03` ⇒ **`LD025`**，DETAIL `{ reason: 'lock_timeout', pg_code: '55P03', lock_timeout_ms, retryable: true }`；`lock_timeout` 由 §11.2 R82 的预算助手压到 `min(3s, 剩余)`〕 | 系统繁忙，请稍后重试 |
| 27 | `LEDGER_TX_TIMEOUT` | `503` | `statement_timeout` 触发，**或连接池获取连接超时 / 过载**〔v0.3 扩写〕；无 SQLSTATE 的**驱动级 / 非 PG 错误**亦借用本码（`details.reason` 区分）〔**v0.4 扩写**：`LD026` 的**唯一**产生源 = **函数内自证预算耗尽**（`reason = 'statement_budget_exhausted'`，见 §11.2 R82）；**基础设施类**（`53000` 系列 / `57xxx`（除 `57014`）/ `58xxx` / `08xxx`（**除 `08P01`**）/ `XXxxx` / `25006` / `3D000`）亦归本码 + 各自 `reason`（见 §14.3 附）；**会话级 `statement_timeout` 触发的 `57014`**（`reason = 'statement_timeout_or_cancel'`）**不可能在函数内被转码为 `LD026`** —— `statement_timeout` 绕过 plpgsql `EXCEPTION`，见 §19.9.B/S6〕 | 系统繁忙，请稍后重试 |
| 28 | `LEDGER_DEADLOCK_RETRY_EXHAUSTED` | `503` | 死锁/序列化失败重试 3 次仍失败〔**v0.4 落位**：DB 侧 `40001` / `40P01` ⇒ **`LD027`**，DETAIL 固定 `{ reason: 'deadlock_detected' \| 'serialization_failure', pg_code, retries_performed: 0, retry_owner: 'caller', retryable: true }`；**DB 层 0 次重试，重试归调用方** ⇒ TS `RETRYABLE_SQLSTATES` **必须**含 `'LD027'`（R60）〕 | 系统繁忙，请稍后重试 |
| 29 | `LEDGER_NEGATIVE_BALANCE_GUARD` | `500` | DB `CHECK` 被触发（**实现缺陷告警**） | 服务异常，请联系客服 |
| 30 | `LEDGER_APPEND_ONLY_VIOLATION` | `500` | DB trigger 拒绝 UPDATE/DELETE（**实现缺陷告警**） | 服务异常，请联系客服 |
| 31 | `LEDGER_ACCOUNT_GUARD_VIOLATION` | `500` | 账户余额与最新分录不符（**实现缺陷告警**） | 服务异常，请联系客服 |
| 32 | `LEDGER_FEE_RATE_INVALID` | `500` | **费率真源 = `commission_policy.fee_rate_bp`**（**v0.8 就地更正，§5.20 #3**）；触发条件收紧为「**已越过政策写入守卫**仍不合规」（例：库里被人工写入非法费率、非整数基点、政策行缺失且无默认政策）〔v0.7 旧写法（留痕、作废）：`app_config` 费率不在 1%–5%（D6）或非整数基点 —— P2 起 `app_config` 费率键**不再参与计费**（键保留不删）〕 | 服务配置异常 |
| 33 | `LEDGER_RECONCILE_MISMATCH` | — | 对账脚本发现不一致（脚本 `exit 1`，非 API 错误码） | — |

> 🆕 **v0.8 就地落位（§14.1 #32；§5.20 #3 / #5 / #16）**：
> ① **费率真源 = `commission_policy.fee_rate_bp`（唯一）**（§5.20 #3）；`app_config` 的费率键**在 P2 起不再参与计费**（键保留、不做删除）；本册其余把「费率」落点写作 `app_config` 的处（§5.2 R44 落点、§8.3 R68 的费率基点）**一并改读 `commission_policy.fee_rate_bp`**（各自就地注记）；⚠️ 仅**费率**受影响 —— **金额上限键**（R71 / §15 #18 的 `app_config` 单笔上限）**不受本条影响**。
> ② **政策写入时的守卫失败类一律 `400`**（`input` 桶，§5.20 #5 / #16）：`Σweights_bp > 10000`、`Σweights_bp = 0`、**前 `M` 层权重不得全零**、`levels` / `weights_bp` 形状非法。**不得**改用 `500` —— 那会打破「`500` 只来自 `defect` 桶」这条**已机读验证**的封闭性判据（改它要动 `0005` 的判序 = 越界）。DB 侧落点 `23514` ⇒ 既有分类器归 `input` ⇒ 同码同 status（`LEDGER_AMOUNT_INVALID` / `400`）。
> ③ **#32 自身仍是 `500`（缺陷类）**，语义按 ① 收紧为「**越过写入守卫**的费率异常」 ⇒ **R108 告警不变**、**关闭集仍 33 码**、**本格编号不变**。P2 侧的借码映射（含 `reason` 取值）见 `docs/commission.spec.md` v0.2 §13。
>
> 🆕 **v0.10 就地落位（事三 · `W = 0` 双档口径 · Zang 裁定；同源登记见 `docs/commission.spec.md` v0.3 §7.3 / §13.2 #10 与 #10-R / §14.2 #2）**：
> ① **两条规则在两个档位 —— 不是一条规则的两个说法，更不是「口径张力」**：
> &nbsp;&nbsp;&nbsp;&nbsp;• **写入档（可达）**：政策**写入时**拒绝 `Σweights_bp = 0` 与 `weights_bp[1] = 0`（可静态判定式 = 「前 `M` 层不得全零」，见 v0.8 块 ② 与裁定 **#5 / #16**）⇒ **`400`（`input` 桶）**。
> &nbsp;&nbsp;&nbsp;&nbsp;• **运行档（不可达的防御性兜底）**：若因**不变式被破坏**（人工改库 / 迁移缺陷）而**真的走到** `W = 0` 分支 ⇒ 落 **`500` defect**（借 **#32 `LEDGER_FEE_RATE_INVALID`** + `details.reason = 'POLICY_WEIGHTS_ALL_ZERO'`，**R108 必告警**）—— **因为「到达即意味不变式被破坏」**。
> ② **「不可达」是写入档的产物，不是运行档的假设**：正常路径下运行档**永不触发**（已落库政策恒满足 `W > 0`）；**未触发 ≠ 可删** —— 它是「不变式被破坏」的最后一层可见性（R108 的告警面），**必须保留**。
> ③ **纪律**：本处与 `commission.spec` v0.3 的对应条目措辞必须一致；**§14.1 仍 33 码、R1–R108 仍 108 条**（本条**不新增码、不动规则编号**）。

### 14.2 规则

| 编号 | 口径 | 落点建议 | 连带影响 | 状态 |
|---|---|---|---|---|
| **R104** | 错误码有**唯一来源**：`backend-ts/src/ledger/errors.ts`（建议名，常量表 + 中文文案 + i18n key）。**禁止**在业务代码里手写中文字符串或裸 `new Error('...')`；所有账本错误必须由该表的构造函数抛出。 | `errors.ts` 常量表；i18n key 命名 `ledger.err.<CODE>` | D4 已冻结「先只做 zh，保留 i18n 框架」⇒ 本期文案直接写中文，但 key 必须先建好，后续加语种不改代码 | 已冻结（D4）+ 落点待拍板 |
| **R105** | **HTTP 语义映射**：`400` = 请求不合法（格式/参数）；`403` = 权限不足；`404` = 目标不存在；`409` = 状态冲突/业务拒绝（余额不足、币种状态、幂等冲突）；`423` = 资源被锁定（合规冻结）；`500` = **实现缺陷**（约束/触发器被触发、事务缺失）；`503` = 暂时不可用（重试可能成功）。**禁止**把「余额不足」返回 `400`（那是状态冲突，不是请求格式错误），也**禁止**把实现缺陷返回 `200` 或 `409`。 | `errors.ts` 的 code → status 映射 | 前端可据此统一处理：`409` 显示业务提示，`503` 自动重试，`500` 报警不提示细节 | 待拍板（一句话可改） |
| **R106** | **幂等重放不是错误**：`LEDGER_IDEMPOTENCY_REPLAY` 必须以 `200` + `idempotent_replay: true` 返回，前端按成功处理。它虽然在错误码表里登记（便于日志检索与统计），但**不得**进入错误分支。 | 响应包装层 | 「用户连点两次，第二次弹错误」是这类项目最常见的体验缺陷；本册明确禁止 | 待拍板（**建议冻结**） |
| **R107** | **统一错误响应结构**：`{ "error": { "code": "LEDGER_XXX", "message": "中文文案", "i18n_key": "ledger.err.LEDGER_XXX", "details": { ... } } }`。`details` 只允许放**非敏感**上下文（涉及的 `cid`、`symbol`、期望值/实际值），**禁止**放 SQL、约束名、堆栈、表名、连接串。 | 响应包装层中间件 | 前后端契约唯一；`details` 的形状按 code 固定并在本册登记 —— **已于 v0.2 补齐：见 §14.4**（P1a 曾暂存于 `backend-ts/src/ledger.ts` 文件头） | 待拍板（结构可改，但必须唯一） |
| **R108** | `500` 类错误（#29 / #30 / #31 / #32）**必须触发告警**（日志 `error` 级 + 计数指标 + 可选通知），因为它们**只**代表代码缺陷，不可能是用户输入造成。告警信息必须含「哪个不变量被破坏」与「涉及的 `uid`/`cid`/`txid`」，便于直接定位。 | 日志/监控；`details` 中的诊断上下文（仅入日志，不入响应体） | 这四条错误一旦在生产出现，应当立即触发一次全量对账（§11 R92 ③） | 待拍板（**建议冻结**） |
### 14.3 参数非法 / 守卫情形的错误码映射（**P1a 借用方案 + v0.3 扩充，已裁定**）

> **背景（留痕）**：§14.1 的 33 个错误码里**没有**「uid / cid 格式非法」「`ref_type`/`ref_id` 不成对」「冲正守卫」「平台账户 kind 白名单」这类**入参形态非法**的专用码。P1 实现（Kong · P1a）采用**借用法**：复用语义最接近的既有错误码，并用 `details.reason` 区分具体情形。**Zang 已裁定采纳借用方案**（不新增错误码，避免与 R104 的「唯一来源 + i18n key 契约」打架），现正式登记于此，后续一律按 R105 的 HTTP 语义映射执行。

| 情形 | 借用错误码 | HTTP status | `details.reason` | 说明 |
|---|---|---|---|---|
| ~~`uid` 参数格式非法（非整数 / 超 `bigint` 范围）~~ ⛔ **v0.4 裁定：本格旧写法作废（`404` 是错的）** | ~~`LEDGER_ACCOUNT_NOT_FOUND`~~ | ~~`404`~~ | — | 📌 **v0.3 旧写法（留痕，已作废）**：「uid 无法解析 ⇒ 视同该账户不存在，不向调用方泄露参数形态」。**v0.4 更正：形状非法 = 参数校验失败 = `400`**（见下两行） |
| 🆕 **v0.4 更正**：`uid` **形状非法**（非整数 / 非字符串 / 超 `bigint` 范围） | `LEDGER_AMOUNT_INVALID` | **`400`** | `NOT_STRING` / `NOT_DECIMAL_INTEGER` / `OUT_OF_BIGINT_RANGE` / `MISSING` | 「参数的**形状**」与「目标**是否存在**」是两件事：混成 `404` 会让调用方把「写错了参数」当成「账户不存在」去重试 / 触发补开户逻辑。形状闸在 `ledger_strict_text` + `ledger_int_amount`（DB）与 `toAmount`（TS）内，**先于**任何存在性查询 |
| ~~`cid` 参数格式非法~~ ⛔ **v0.4 裁定：同 uid，`404` 作废** | ~~`LEDGER_CURRENCY_NOT_FOUND`~~ | ~~`404`~~ | — | **v0.4 更正**：`cid` **形状非法** ⇒ `400 LEDGER_AMOUNT_INVALID` + 同上 `reason`（`cid` 维度）；旧写法已作废〔**🆕 v0.5 枚举（本格歧义已消除）**：本格 v0.4 写法**只说了「形状非法 ⇒ 400」，未说 `cid <= 0` 算哪一类**，故被下游读成「`cid<=0` = 形状非法 ⇒ `400`」⇒ **见下方 §14.3 v0.5 枚举块**：`cid` 形状非法**仅指**①非十进制整数②空③超 `bigint`④缺失；**`cid <= 0` 与负数不属于本格，归下一行 ⇒ `404`**〕 |
| `uid` / `cid` **形状合法但目标不存在**（未开户 / 无此币 **／ 🆕 v0.5 枚举：`cid <= 0` 与负数**） | `LEDGER_ACCOUNT_NOT_FOUND` / `LEDGER_CURRENCY_NOT_FOUND` | **`404`** | — | **这才是 `404` 的正确用途**（R105：`404` = 目标不存在，**不是**参数格式错误）。〔**🆕 v0.5 枚举（Zang 重新裁定）**：**`cid <= 0` 与负数归本行 ⇒ `404 LEDGER_CURRENCY_NOT_FOUND`，不是 `400`** —— 依据：`currency.cid` 是**正整数序列**（`bigint IDENTITY`，见 §2.1），**非正值构造上不存在**，只能落「形状合法但不存在」；**实测** DB 侧 `ledger_cid_arg('0')` / `('-5')` = `LD007 / LEDGER_CURRENCY_NOT_FOUND / 404`。**禁止**读成「`cid<=0` = 形状非法 ⇒ `400`」（**v0.5 修正的正是这处歧义；事故链条见 §18 v0.5 行**）〕 |
| 金额类非法（非数字串 / 非法字符 / 超上限） | `LEDGER_AMOUNT_INVALID` | `400` | — | 金额是**入参格式**问题 ⇒ `400`（R105）；金额 ≤ 0 仍归 `LEDGER_AMOUNT_NOT_POSITIVE` |
| `ref_type` / `ref_id` 不成对（违反 R18） | `LEDGER_AMOUNT_INVALID` | `400` | `REF_PAIR_MISMATCH` | 无专用码；借 400 类 + 前缀化 `reason` 区分 |
| `reversal_of_txid` 与 `kind` 不匹配（违反 R20 / 约束 `ledger_reversal_guard`） | `LEDGER_AMOUNT_INVALID` | `400` | `REVERSAL_GUARD` | 同上；注意它是**请求形状**错误，不是 `500` 实现缺陷 |
| 违反 R101 平台账户 kind 白名单（对平台账户发起出账类 `kind`） | `LEDGER_RESERVED_UID` | `400` | `PLATFORM_DEBIT_FORBIDDEN` | 平台账户「不可作为该动作的主体」⇒ 归入 uid 违规维度 |
| 违反 R103 平台账户只进不出（`−1` 等账户出账 / `platform_withdraw` 未获批） | `LEDGER_RESERVED_UID` | `400` | `PLATFORM_CREDIT_KIND_FORBIDDEN` | 同上；`platform_withdraw` 获批并登记后本格作废 |
| 🆕 **v0.15**：**`invite_first_task_reward` 在 `R101` 的 `−1` `debit` 白名单内 ⇒ 放行**（首开、唯一一项）；**白名单外 `−1` debit**（含未批的 `platform_withdraw`）**仍拒** | `LEDGER_RESERVED_UID` | `400` | `PLATFORM_CREDIT_KIND_FORBIDDEN`〔★ Jing 现取：代码 `debit` 支当前抛 `PLATFORM_DEBIT_FORBIDDEN`（`ledger.ts:597` / `0038`）；`reason` **非契约**（§14.3 v0.7 (A)「只准按 `code` 分支」）⇒ **判负口径 = `code`**〕 | `R-9-65` / `R-9-66`：`−1` `debit` 白名单首开**仅 1 项**；`invite_first_task_reward` **在名单内 ⇒ 不触发本行**；本行**不改**上两行的 `R101` / `R103` 口径（`R103` 留白不变） |
| **驱动级 / 非 PG 错误（无 SQLSTATE）**：连接池获取连接超时 / 过载、`ECONNREFUSED` 等驱动或 OS 级连接错误〔**v0.3 新增**〕 | `LEDGER_TX_TIMEOUT` | `503` | `pool_connection_timeout` / `driver_connection_error` | 这类错误**不是**实现缺陷（可重试）⇒ 归 `503`，**不得**兜底成 `500 LEDGER_TRANSACTION_REQUIRED`（v0.2 及以前实现曾如此归类）。与 §11.2 R82、§14.1 #27 互引；`details` 形状见 §14.4；裁定见 §19.8.C |

**§14.3 就地枚举（v0.5 · Zang 重新裁定）· `cid` / `uid` 参数分类口径 —— 消除 v0.4 的歧义（三类互斥且穷尽）**

> **为什么要有本块（歧义事故留痕，非苛责）**：v0.4 已裁定「**形状非法 = 参数校验失败 = `400`**；**形状合法但不存在 = `404`**」并写入上表，但**没有枚举「`cid <= 0`（与负数）算哪一类」**。下游据该未枚举处读成「`cid<=0` = 形状非法 ⇒ `400`」⇒ Zang 据此发单要求实现方把 TS 侧 `toCid` 由 `404` 改成 `400`（实现侧已改）—— **而 DB 侧 `ledger_cid_arg` 一直是 `LD007 / LEDGER_CURRENCY_NOT_FOUND / 404`**，即**改之前两侧本来就一致，是这一改动人为造出了一处两侧不一致**。Zang 已重新裁定，本块枚举修正；**事故本身记入 §18 变更记录 v0.5 行**。

| # | 情形（**枚举，无遗漏**） | 判定 | HTTP | 错误码 | `details` |
|---|---|---|---|---|---|
| **①** | **形状非法**：**非十进制整数**（如 `'abc'` / `'1.5'` / `'1e5'` / `' 1'`）／ **空**（`''` 空串）／ **超 `bigint`**（`< -9223372036854775808` 或 `> 9223372036854775807`）／ **缺失**（字段未传） | **参数校验失败** | **`400`** | `LEDGER_AMOUNT_INVALID` | `{ field, value?, reason }`；`reason ∈ { NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING }`；**`field = 'cid'` 或 `'uid'`**（区分是哪个参数字段） |
| **②** | **形状合法但该行不存在**（十进制整数、在 `bigint` 内，但库中无该行） | 目标不存在 | **`404`** | `LEDGER_CURRENCY_NOT_FOUND`（`cid`）／ `LEDGER_ACCOUNT_NOT_FOUND`（`uid`） | 见 §14.4（币种类统一形状 `{ cid, symbol, status }`） |
| **③** | **`cid <= 0` 与负数**（`'0'` / `'-5'` / `'-9223372036854775808'`）—— **归 ②，不归 ①** | 形状**合法**（是十进制整数、在 `bigint` 内）＋ 该行**不存在** ⇒ 目标不存在 | **`404`** | **`LEDGER_CURRENCY_NOT_FOUND`** | 同 ② |

- **③ 的依据（Zang 裁定原文）**：`currency.cid` 是**正整数序列**（`bigint GENERATED BY DEFAULT AS IDENTITY`，见 §2.1）⇒ **非正值构造上不存在**，故非正值只能落「**形状合法但不存在 ⇒ `404`**」，**不可能**落「形状非法」。⇒ 判定顺序固定为「**先形状闸（①）→ 后存在性（②③）**」；形状闸**只**做四项判定（十进制整数 / 非空 / `bigint` 范围内 / 非缺失），**不做「`> 0`」判定**。
- **`LEDGER_AMOUNT_INVALID` 是历史码名，本册不新增错误码**：该码字面语义是「金额格式不正确」，自 v0.4 起被**兼用**作「**参数形状非法**」码（`cid` / `uid` / 金额 / `ref_type`·`ref_id` / 冲正守卫等入参形态问题皆借它）⇒ 靠 **`details.field` 区分是哪个参数字段**、靠 `details.reason` 区分具体形态。**§14.1 的 33 个错误码关闭集不动**（沿用 v0.4 借用方案与 R104「唯一来源 + i18n key」纪律）；**禁止**为「`cid <= 0`」新增任何码 —— 它已有码（`LEDGER_CURRENCY_NOT_FOUND`，`404` 类）。
- **`uid` 侧同口径、无例外**：`uid` 形状非法 ⇒ `400 LEDGER_AMOUNT_INVALID` + `details.field = 'uid'`；形状合法但不存在 ⇒ `404 LEDGER_ACCOUNT_NOT_FOUND`。**保留区间 uid（`0` 与 `−1 … −99`）的 `LEDGER_RESERVED_UID`（`400`）是 R98 的「业务拒绝」守卫，与形状闸正交**（它判的是「该主体不得做该动作」，见上表已有两行 `PLATFORM_*_FORBIDDEN`），**不得**与 ① / ②③ 混为一类。

**§14.3 v0.5 实测对拍表**（真源：`backend-ts/.p1f-artifacts/p1n-tocid-shape-before.json`（run `I0AUQ`，2026-09-27T07:29:44Z）/ `p1n-tocid-shape-after.json`（run `I5JZU`，2026-09-27T07:33:49Z）；**逐条自核，凡真源中找不到的用例一律标「未核对」，不补造读数**）：

| 用例 | 通道 | 实测（逐字） | 归类 | 真源出处 |
|---|---|---|---|---|
| `ledger_cid_arg('0')` | **DB** | `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / **`404`** / DETAIL `{"cid":"0"}` | **③ ⇒ `404`** | `db_cases.B1`（before / after **两轮一致**） |
| `ledger_cid_arg('-5')` | **DB** | `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / **`404`** / DETAIL `{"cid":"-5"}` | **③ ⇒ `404`** | `db_cases.B2`（两轮一致） |
| `ledger_cid_arg('abc')` | **DB** | `LD016` / `LEDGER_AMOUNT_INVALID` / **`400`** / DETAIL `{"field":"cid","value":"abc","reason":"NOT_DECIMAL_INTEGER"}` | ① ⇒ `400` | `db_cases.B3`（两轮一致） |
| `ledger_cid_arg('')`（空串） | **DB** | — | ① ⇒ 期望 `400` + `reason = NOT_DECIMAL_INTEGER` | **未核对**：两轮真源 `db_cases`（`B1`–`B7` 逐条核过）**均无该用例** |
| `ledger_cid_arg('999999999999')`（形状合法·该币不存在） | **DB** | — | ② ⇒ 期望 `404`（应为 `LD007`） | **未核对**：两轮真源 `db_cases` **无该用例** |
| `ledger_int_amount('abc','cid')`（形状闸原语） | **DB** | `LD016` / `LEDGER_AMOUNT_INVALID` / `400` / `reason = NOT_DECIMAL_INTEGER` | ① ⇒ `400` | `db_cases.B4`（两轮一致） |
| `ledger_parse_user_amount('0',2,'cid','93')` | **DB** | `LD017` / `LEDGER_AMOUNT_NOT_POSITIVE` / `400` / DETAIL `{"field":"cid","value":"0"}` | **非本表口径**：这是「**金额**」原语（R72 的 `> 0` 业务判定），**不是** `cid` 参数分类的判定依据（**这是本次误读的关键落点**，见下行） | `db_cases.B5`（两轮一致） |
| `getCurrency(0)` / `getCurrency('0')` / `getCurrency('-5')` / `getCurrency('-9223372036854775808')` / `transfer({cid:'0',…})` | **TS（修前）** | `LEDGER_CURRENCY_NOT_FOUND` / **`404`** / DETAIL `{cid}` | ③ ⇒ `404` ✔ **与 DB 侧一致** | `ts_cases.A1 / A2 / A3 / A4 / A8`（before，run `I0AUQ`） |
| 同上 5 例 | **TS（修后 · v0.5 当时现状 —— ⚠️ 已过时）** | `LEDGER_AMOUNT_NOT_POSITIVE` / **`400`** / DETAIL `{field:'cid', value}` | ✖ **与 v0.5 裁定不符**（③ 应为 `404`）⇒ **待实现方收敛回 `404`**；修后 TS 对齐的是上格的 **DB 金额原语 `ledger_parse_user_amount`（`LD017`/`400`）**，而非 `cid` 参数原语 `ledger_cid_arg`（`LD007`/`404`） | `ts_cases.A1 / A2 / A3 / A4 / A8`（after，run `I5JZU`） |
| `getCurrency('999999999999')` | **TS** | 不抛，返回 `null`（`no_throw` / `returned_cid = null`） | ② ⇒ 形状合法、存在性另查（**本调用未抛**） | `ts_cases.A7`（两轮一致） |
| `transfer({cid:'999999999999',…})` | **TS** | `LEDGER_CURRENCY_NOT_FOUND` / **`404`** / DETAIL `{cid:"999999999999"}` | ② ⇒ `404` | `ts_cases.A10`（两轮一致） |
| `getCurrency('abc')` / `transfer({cid:'abc',…})` | **TS** | `LEDGER_AMOUNT_INVALID` / **`400`** / `reason = NOT_DECIMAL_INTEGER` / `field = 'cid'` | ① ⇒ `400` ✔ **与 DB `B3` 同码 / 同 status / 同 reason** | `ts_cases.A5 / A9`（两轮一致） |
| `ledger_entry` 行数（返修期间不写账本的自证） | **DB** | before `0` / after `74`；`wrote_nothing = true` | 环境旁证（非本表口径） | `rows_touched`（两轮） |

> 🆕 **v0.6 注（本表两处现状已翻转，原文保留）**：① 上表 **「TS（修后 · v0.5 当时现状）」** 行 = **v0.5 时点的读数，已过时** —— **现状 = `LEDGER_CURRENCY_NOT_FOUND` / `404` / `details = { cid }`**（**已收敛回 `404`**，与 DB 侧 `ledger_cid_arg` 逐字一致）；第三段读数 `backend-ts/.p1f-artifacts/p1n-tocid-shape-revert-IE4VH.json`（run `IE4VH`）证实，**本册另 `read_file` 自核 `backend-ts/src/ledger.ts` 的 `toCid` 代码**。② 本表 `db_cases.B5` 行给出的「修后 TS 对齐的是 DB **金额**原语」这一归因**仍成立**（那是 v0.5 改动当时的成因），而**现状已偏离该归因**（回退到 `cid` 参数原语口径）—— 见 §19.9.F 第 6 条 **v0.6 更正块** 的现况 TS/DB 对拍表。
> **对拍结论（可机读）**：**① 类两侧一致**（TS `A5`/`A9` ↔ DB `B3`：同码 `LEDGER_AMOUNT_INVALID`、同 `400`、同 `reason = NOT_DECIMAL_INTEGER`）；**③ 类在 DB 侧恒为 `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / `404`**（`ledger_cid_arg('0')` / `('-5')` 两轮读数**一字未变**），**修前 TS 侧亦为 `404` ⇒ 两侧本来就一致**；**修后 TS 侧成了 `400 LEDGER_AMOUNT_NOT_POSITIVE` ⇒ 这就是本次事故人为造出的不一致**，按本块 ③ 的裁定**应收敛回 `404`**。**本册只登记口径，不改代码**（§0.2 分工；残留登记见 §19.9.F 第 6 条的 v0.5 留痕）。

> ⚠️ **两条纪律**：① 借用**不改变** §14.1 各码自身的触发条件 —— 上表只在「§14.1 无覆盖」的情形下使用；② `details.reason` 的取值是**机器可读枚举**，必须进 R104 的常量表，**不得**写中文自由文本（R107：`details` 只放非敏感上下文）。

**§14.3 附（v0.4 新增）· DB 侧自定义 SQLSTATE（`LDxxx`）↔ §14.1 码 的映射**（P1f F3②/F3③，§11 S7 + S10；**不新增错误码** —— §14.1 的 33 个关闭集不动）。自 `0005` 起账本函数把 SQLSTATE **统一映射后再抛**（不再原样逃出）：

| 原始 SQLSTATE / 情形 | DB 抛出的 SQLSTATE | MESSAGE（= §14.1 码名） | HTTP | DETAIL（机读） |
|---|---|---|---|---|
| `55P03`（lock_timeout 触发） | **`LD025`** | `LEDGER_LOCK_TIMEOUT` | `503` | `{ reason: 'lock_timeout', pg_code: '55P03', lock_timeout_ms, retryable: true }`（`raw_55P03_escaped = false`） |
| **预算耗尽**（`ledger_arm_lock_timeout` / `ledger_check_budget` 越界） | **`LD026`** | `LEDGER_TX_TIMEOUT` | `503` | `{ reason: 'statement_budget_exhausted', budget_ms: 10000, remaining_ms, stage, retryable: true }` |
| **基础设施类**：`53000` 系列 / `57xxx`（除 `57014`）/ `58xxx` / `08xxx`（**除 `08P01`**）/ `XXxxx` / `25006` / `3D000` | 各自 | `LEDGER_TX_TIMEOUT` | `503` | `{ reason: 'too_many_connections' \| 'out_of_memory' \| 'disk_full' \| 'admin_shutdown' \| 'crash_shutdown' \| 'cannot_connect_now' \| 'io_error' \| 'read_only_transaction' \| 'database_unavailable' \| 'insufficient_resources' \| 'operator_intervention' \| 'system_error' \| 'connection_error' \| 'internal_error', … }` |
| `40001` / `40P01` | **`LD027`** | `LEDGER_DEADLOCK_RETRY_EXHAUSTED` | `503` | `{ reason: 'serialization_failure' \| 'deadlock_detected', pg_code, retries_performed: 0, retry_owner: 'caller', retryable: true }`（`raw_40P01_escaped = false`） |
| `57014`（会话级 `statement_timeout` / cancel） | 各自 | `LEDGER_TX_TIMEOUT` | `503` | `{ reason: 'statement_timeout_or_cancel', pg_code: '57014' }`（由 **§C 分类器**归类；**不可能**由函数内处理器转码，见 §19.9.B） |
| **`08P01`**（启动协议参数错误 = 我方连接配置缺陷，**不是**瞬时故障） | 各自 | **`LEDGER_TRANSACTION_REQUIRED`** | **`500`** | `{ cause, reason: 'protocol_violation', error_name: 'ProtocolViolation', pg_code: '08P01' }` ⇒ **刻意排除在 infra 之外**（R108 告警） |
| 其余未归类 SQLSTATE | 各自 | `LEDGER_TRANSACTION_REQUIRED` | `500` | `{ cause, reason: 'unclassified_db_error', … }` |

**分类器 bucket ↔ §14.1 状态类纪律（v0.4 **冻结为可机读判据**）** —— DB 侧 `ledger_error_for_sqlstate(state, constraint)` 是**全定义域**（**永不返回 NULL**，40 个 SQLSTATE 抽样 `never_null = true`），其 `bucket` 与 HTTP 状态类**一一对应且封闭**：`input ⇒ 400 类`；`integrity ⇒ 400 \| 404 \| 409（**绝不 500**）`；`retryable ⇒ 503`；`infra ⇒ 503`；`defect ⇒ 500`。⇒ **「500 类码只可能来自 `bucket = 'defect'`」是一条可机读判据**（质检脚本据此对拍：`classifier_500_outside_defect_bucket = []`、`violations = []`；40 个 SQLSTATE 逐个对拍）。
📌 **v0.3 旧写法（留痕，已更正）**：修前口径把 `integrity` **一律钉成 `400`**，与 §14.1 冻结的 `404` / `409`（如 `LEDGER_IDEMPOTENCY_CONFLICT = 409`）**冲突** ⇒ 该探针公式曾误报红；v0.4 按本段重写（只改**判据公式**，未放宽任何一条对**产品行为**的断言）。
📌 **`23514` 的分桶细则（v0.4 明确）**：三条余额/冻结节界守卫（`account_bal_guard` / `account_frz_guard` / `ledger_after_guard`）映射 `LEDGER_NEGATIVE_BALANCE_GUARD`（`500`）⇒ 归 **`defect`**（能走到这层 CHECK 说明函数内 R80 前置判定漏了 = 实现缺陷，R108 告警）；`currency_supply_guard` ⇒ **`integrity`**（`LEDGER_SUPPLY_CAP_EXCEEDED` `409`）；`ledger_kind_enum` ⇒ **`input`**（`LEDGER_UNKNOWN_KIND` `400`）；其余 `23514` ⇒ `input` / `LEDGER_AMOUNT_INVALID`。

**§14.3 v0.9 增补（Zang 裁定）· 冻结映射与现实对齐（三条扩展 + `benign_outcomes` 单列一类）· 「双向映射全量往返闭合断言」规范要求 · 反向映射 P1 遗留缺陷登记与 `0009` 修复状态**（逐条登记见 §19.13；**不新增错误码** —— §14.1 的 **33 码关闭集**不动；**不动 R1–R108**）。

> **（A）冻结映射与现实对齐 —— 三条扩展 ＋ `benign_outcomes` 一类（本版核心 · 修正原因必须一并读）**
> **① 缺陷（冻结集与现实不对齐 —— 是原表不完整，不是现实违规）**：本小节 **S1（v0.4 冻结）** 只覆盖四个状态类，而 **§14.1 的 33 码里有四个状态类落在冻结面之外**：
> | 状态类 | §14.1 落点 | DB 侧 SQLSTATE | 本册 `read_file` 自核读数（真源 = §14.1 全表 + `backend-ts/src/ledger-errors.ts` 逐条 `status`） |
> |---|---|---|---|
> | `403` | #15 `LEDGER_UNAUTHORIZED_MINT` / #16 `LEDGER_HOLD_NOT_ALLOWED` | `LD014` / `LD015` | `403 ×2` |
> | `423` | #9 `LEDGER_CURRENCY_FROZEN` | `LD009` | `423 ×1` |
> | `200` | #3 `LEDGER_IDEMPOTENCY_REPLAY`（**R106 明定不是错误**） | `LD006` | `200 ×1` |
> | `null`（本表登记为 `—` = **脚本退出码语义**，§11 R88） | #33 `LEDGER_RECONCILE_MISMATCH` | `LD032` | `null ×1` |
> （全部 33 码的状态类分布，本册自核：`400 ×9` / `403 ×2` / `404 ×3` / `409 ×8` / `423 ×1` / `200 ×1` / `500 ×5` / `503 ×3` / `null ×1` = **33**）
> **② 修正原因（写死，防止被读成「实现违规」）**：**原表不完整 —— 冻结的四个桶只覆盖了 4 个状态类，而现实的状态集是 7 个状态类 ＋ 1 个 `null`**。⇒ 任何分桶都必然「超出冻结面」；把它们判成违规，等于**让现实去迎合一张不完整的表**。**本册原则：让冻结集与现实对齐。**（本条**不是**放宽任何一条对产品行为的断言 —— §14.1 的码、状态、触发条件**一字未改**。）
> **③ Zang 裁定值（冻结 · 就地扩展 = 四条 → 五条 ＋ 单列一类）**：
>
> | bucket（v0.9 扩展后） | 覆盖的状态类 | 现实落点（DB / §14.1） | 判据 |
> |---|---|---|---|
> | `input` | `400` **＋ `403`（v0.9 扩展）** | 400 类 9 码（`LD016` 等）· **`LD014` / `LD015` = `403`** | 权限不足 = **调用方身份不对**（非完整性、非状态冲突） |
> | `integrity` | `400 \| 404 \| 409`（绝不 500）**＋ `423`（v0.9 扩展）** | `LD007` / `LD020` / `LD022` = 404 等 · **`LD009` = `423`** | 资源被锁定 = 合规冻结；R105 把「币种状态」归 `409` 语义族 |
> | `retryable` \| `infra` | `503` | `LD025` / `LD026` / `LD027` | **不变** |
> | `defect` | `500` **＋ `null`（v0.9 扩展）** | 5 码 `500` · **`LD032` = `null`** | `null` 是**脚本退出码**语义（§11 R88）⇒ **HTTP 层一律 `status ?? 500`** 兜底 ⇒ 归 `defect`（R108 必告警） |
> | **`benign_outcomes`（v0.9 **单列一类**；**不是错误类**）** | **`200`** | **`LD006` = `LEDGER_IDEMPOTENCY_REPLAY`** | **良性结果（幂等重放）**：`idempotent_replay: true`，**按成功处理** |
>
> **④ `200` 为什么改判为 `benign_outcomes`（而不是 `input`）**：`LD006 = LEDGER_IDEMPOTENCY_REPLAY` 是 `200` —— 它是**良性结果**（同键同指纹重复提交，契约要求的正常返回，R106 明定「**不是错误**」）。把良性结果塞进 `input` 桶（`input` 的语义 = 「**调用方输入有问题**」）**语义不对**。⇒ **单列 `benign_outcomes`**，与四个错误桶**并列但不同族**。
> **⑤ `benign_outcomes` 不参与 bucket 校验**：校验器（含往返闭合脚本）对 `200` 类码**只做「必须落 `benign_outcomes`」判定，不做四桶公式判定**；`benign_outcomes` **不得**被当成第 6 个错误桶使用（**它不出错**）。
> **⑥ 判据集（v0.9 就地扩展，原四条判据一字未改）**：① **`500` 类码只可能来自 `bucket = 'defect'`**（v0.4 原判据，**不变**）；② 🆕 **`200` 类码只可能来自 `benign_outcomes`**；③ 🆕 **`403` / `423` / `null` 分别只可能来自 `input` / `integrity` / `defect`**；④ 🆕 `benign_outcomes` **不得**出现在错误桶、错误桶**不得**收 `200` 类码。
> **⑦ 纪律（防把扩展读宽）**：扩展**只加格、不加码、不改桶语义** —— `input` 仍 = 「调用方可触发」、`integrity` 仍 = 「完整性 / 状态冲突 / 目标不存在」、`retryable` / `infra` 仍 = 瞬时故障可重试、`defect` 仍 = 实现缺陷（**R108 告警口径不变**）。
> 📌 **v0.4 旧写法（留痕；本次**只做扩展**，原文一字未删、未改）**：本小节 S1 段（`input ⇒ 400 类`；`integrity ⇒ 400 \| 404 \| 409（绝不 500）`；`retryable ⇒ 503`；`infra ⇒ 503`；`defect ⇒ 500`）**仍然有效**，v0.9 只是**补上它没覆盖的四个状态类**。
>
> **（B）「双向映射全量往返闭合断言」= 规范要求（**单向自证不算闭合**）**
> **① 要求（冻结 · 对所有双向映射生效）**：**凡双向映射 —— 名↔码（`ledger_sqlstate_of` ↔ `ledger_error_for_sqlstate`）、状态码↔HTTP、枚举↔字符串、代码↔规范 —— 必须交付「全量往返闭合断言」**：对**每一个**元素断言 **`f(g(x)) == x`**（**两个方向都走通、回到自身**），**并附一致性断言**（桶 / 状态类满足本小节 (A) 的扩展映射；TS 侧桶与 DB 侧桶逐条对拍）。
> **② 必须进回归套件固定项**：该断言**不得只当一次性探针**，必须落为**回归套件固定项** —— 凡改动错误码表 / 分类器 / 状态映射 / 枚举字符串，**都必须重跑并附 run-tagged 读数**（固定文件名会被后一轮静默覆盖 ⇒ 见本小节 v0.6 增补块 (A)④c 同一取证纪律）。
> **③ 「单向自证不算闭合」（本条的由来 · 诚实口径）**：P1 的「关闭集 33 码已闭合」自证过的只是「**正向映射有 33 条**」（名 → SQLSTATE，`ledger_sqlstate_of`），**从未自证反向映射也有 33 条**（SQLSTATE → 名，`ledger_error_for_sqlstate`）⇒ 反向表**一条 `LD0nn` 分支都没有**时，这条「闭合」声明**照样通过**。**审计只做了单向，就以为闭合了** —— 这正是 (C) 那个 P1 遗留缺陷能存活到今天的原因。⇒ **今后任何「闭合」声明必须附往返读数；只有正向读数者，一律读作「未闭合」。**
> **④ 已交付的资产（本册自核存在）**：`backend-ts/scripts/p2c-00-code-roundtrip.ts`（**33 码全量往返闭合测试**：对每个 `name` 断言 `ledger_error_for_sqlstate(ledger_sqlstate_of(name)).code == name` ＋ 桶一致性；`--assert` 模式；输出 run-tagged）⇒ 四轮读数与结论见 (C)③④ / §16 **#14** / §19.13.B。
>
> **（C）登记：反向映射缺 `LD0nn` 分支（33 码全未归类）= P1 遗留缺陷 · `0009` 已修 · 一条给未来接 HTTP 的硬规则**
> **① 缺陷（P1 遗留，被 P2 第一次真正抛 `LD032` 才暴露）**：DB 侧 `ledger_error_for_sqlstate(state, constraint)` 的反向映射表**一条 `LD0nn` 分支都没有** ⇒ **33 个自有码（`LD001`..`LD033`）全部落 ELSE 兜底**：`{ code: LEDGER_TRANSACTION_REQUIRED, bucket: defect, reason: unclassified_db_error }`。**落桶侥幸没错**（`defect ⇒ 500` 类），**但码名与 `reason` 全被错配** —— 调用方看到「事务必需 / 无法归类」，而实际可能是「对账不符」（`LD032`）。**定性 = P1 遗留缺陷（双向映射未闭合）**。**长期未被发现的原因**：这些码**多为 `defect` 类，调用方输入触发不了**；直到 `0007` 的佣金守恒断言（`trg_ledger_entry_commission_conservation`）**第一次真正抛 `LD032`** 才露出来。
> **② 已修（`0009`；本册只读核文件，不连库）**：`backend-ts/migrations/0009_ledger_error_reverse_map_complete.sql`（`wc -l` = **310** 行 / **23808** 字节；**checksum（sha256 前 12 位）= `6688e2ce35c6`**，即 §5.22 所指 `6688e2ce35c67d5b…`；本册另计 md5 = `d8e31785f505073f5bca243fc2a96c3f`）。手法 = **`CREATE OR REPLACE FUNCTION`**（**不改 `0005` 文件**）：**函数体 = `0005` 版逐字节保留 ＋ 恰 60 行 `LD001..LD033` 分支** —— 本册自核（函数体逐行对拍：公共前缀 **10** 行 ＋ **新增中间段 60 行** ＋ 公共后缀 **98** 行 = `0009` 函数 **168** 行；`WHEN 'LD0nn'` 分支 **33** 条）⇒ 附 `COMMENT ON FUNCTION` 与迁移内 `DO` 自检（**不通过则整个迁移回滚、不写版本行**）。**闭集仍 33，未新增任何错误码。**
> **③ 修前 / 修后读数（本册 `read_file` 自核 `.p2c-artifacts/*.json` 后逐字落位，非转抄；均 run-tagged）**：
>
> | 项 | 修前（run `MUJNM9EO`，`phase = before`，2026-09-27T10:06:55Z） | 修后（run `MUJO2B19`，`phase = after`，2026-09-27T10:19:25Z） |
> |---|---|---|
> | `roundtrip_mismatches` | **32**（共 33 码 ⇒ **33 码里 32 码往返失败**；唯一「对上」的 `LD024` 是**撞名**，非真闭合） | **0** |
> | `unknown_codes` | 0 | **0** |
> | `bucket_violations` | **54**（子项 `frozen_map_violations` 非空） | **0**（`bucket_not_in_closed_set` / `frozen_map_violations` / `extension_slot_violations` / `db_js_bucket_mismatch` / `retryable_flag_mismatch` **五子项全空**） |
> | `null_status_defect` | **27** | **0** |
> | `stale_unclassified_reason` | **33**（= 33 码全带 `unclassified_db_error`） | **0** |
> | `closed_set_size_ts` / `closed_set_size_db` | 33 / 33 | 33 / 33 |
> | `bucket_map_extension_used` | 5 | 5 |
> | `literal_readings`（`LD031` / `LD032` / `LD033`） | 三码**均** `LEDGER_TRANSACTION_REQUIRED` / `defect` / `unclassified_db_error`（**错配的实证**） | `LEDGER_FEE_RATE_INVALID` / **`LEDGER_RECONCILE_MISMATCH`** / `LEDGER_CURRENCY_SYMBOL_TAKEN`（桶 `defect` / `defect` / `integrity`） |
> | `stray_domain_probe`（域外输入 `LD000` / `LD034` / `LD999` …） | 落 ELSE 兜底（正确） | **同前，仍落 ELSE 兜底**（分支用严格正则锚定 ⇒ 域外不误判） |
>
> **④ `--assert` 结论**：`--phase after --assert` **退出码 `0`**（`assertions_failed = []`，四项硬判据 `roundtrip_mismatches = 0` / `unknown_codes = 0` / `bucket_violations = 0` 全绿）。⚠️ **诚实边界**：**本册未实跑该脚本**（本册纪律：**不连库**）—— 该 exit 码与读数**转引**实现方交付报告 `backend-ts/.p2c-artifacts/p2c-report-MUJNPUO4.md` §3.2（其同轮 run `MUJNPUO4` 读数与本册自核的 `MUJO2B19` **逐项一致**，含 `httpStatusOf_probe = { LD031: 500, LD032: 500, LD033: 409 }`）。
> **⑤ TS 侧现状（本来就齐 · 缺口只在 DB 侧）**：TS 侧 **`LEDGER_ERROR_TABLE`**（`backend-ts/src/ledger-errors.ts`）与 **`LEDGER_SQLSTATE_TO_CODE`**（`backend-ts/src/ledger.ts`）**本来就 33/33 齐全**（本册自核：两表键集**逐字相同**、各 **33** 条）⇒ **缺口只存在于 DB 侧的反向映射**（SQLSTATE → 名）。本轮 TS 侧另新增 **`LEDGER_ERROR_BUCKETS`**（**33** 键，键集与 `LEDGER_ERROR_TABLE` 相同）与 **`httpStatusOf(code) = LEDGER_ERROR_TABLE[code].status ?? 500`**（响应层兜底函数）。
> **⑥ 🔒 硬规则（给未来接 HTTP 的响应层，写死）**：**响应层必须用 `err.httpStatus`，不得用 `err.status`。** 理由：`LEDGER_RECONCILE_MISMATCH` 在 `LEDGER_ERROR_TABLE` 里登记为 `status: null`，而 **`null` 是 §11 R88 的脚本退出码语义**（对账脚本 `exit 1`，**不映射 HTTP**）—— 它**故意保留**（表内不动），**不是缺陷**；但**同一个码现在会被 HTTP 路径见到**（`0007` 的佣金守恒断言抛 `LD032`）⇒ 若响应层直接透传 `null`，会得到「状态码缺失」的响应（实测形态 `status = undefined`、前端无法按 `5xx` 报警）⇒ **一律走 `httpStatusOf()` / `err.httpStatus`**（`defect` 类兜底 `500`，R105 / R108）。
> **⑦ 未随本册执行（登记 · 另行发单）**：`0009` 的桶分支与 `p2c-00-code-roundtrip.ts` 的扩展档位**当前都把 `200` 标为 `input`**（注释即为 v0.9 之前的「最小扩展」口径）；按 (A) **`200` 今起归 `benign_outcomes` 且不参与 bucket 校验** ⇒ **代码侧（分类器桶分支 ＋ 脚本扩展表 ＋ `LEDGER_ERROR_BUCKETS` 的注释格）须同步为「`200` ⇒ `benign_outcomes`、跳过四桶公式」**。本册**只写规范**（本册纪律：**只允许改 `docs/**`**）⇒ 见 **§16 #15** 与 **§19.13.C**。

**新登记的 `reason` 枚举（五类，均进 R104 常量表）**：

| 类 | `reason` 取值（逐字；来源 = `0005` §C 分类器 + 函数内各闸 + TS 分类器） |
|---|---|
| **键类**（`400 LEDGER_IDEMPOTENCY_KEY_INVALID` / `_REQUIRED`） | `TOO_LONG` / `PREFIX_REQUIRED` / `RESERVED_SEPARATOR` / `CONTROL_CHARACTER` / `NOT_STRING`（TS 侧另有 `EMPTY`；`entries[]` 逐条键的 `reason` 同集并带 `field = 'entries[i].idempotency_key'`） |
| **金额类**（`400 LEDGER_AMOUNT_INVALID`） | `MISSING` / `NOT_STRING` / `NOT_DECIMAL_STRING` / `NOT_DECIMAL_INTEGER` / `EXPONENT_NOT_ALLOWED` / `OVER_MAX_SINGLE_AMOUNT` / `OUT_OF_BIGINT_RANGE` / `AMBIGUOUS_AMOUNT` / `REF_PAIR_MISMATCH` / `REVERSAL_GUARD` / `CHECK_VIOLATION` / `FK_VIOLATION` / `MISSING_REQUIRED_FIELD` / `NUMERIC_VALUE_OUT_OF_RANGE` / `INVALID_TEXT_REPRESENTATION` / `STRING_DATA_TOO_LONG` / `INVALID_DATETIME` / `MALFORMED_INPUT_VALUE` / `CARDINALITY_VIOLATION` / `EXCLUSION_VIOLATION` / `UNIQUE_KEY_FAMILY_COLLISION` |
| **事务类**（`503`） | `lock_timeout` / `deadlock_detected` / `serialization_failure` / `statement_timeout_or_cancel` / **`statement_budget_exhausted`（v0.4 新增）** |
| **基础设施类**（`503`） | `too_many_connections` / `out_of_memory` / `disk_full` / `admin_shutdown` / `crash_shutdown` / `cannot_connect_now` / `io_error` / `read_only_transaction` / `database_unavailable` / `insufficient_resources` / `operator_intervention` / `system_error` / `connection_error` / `internal_error`（TS 侧另有 `pool_connection_timeout` / `driver_connection_error`，见 v0.3 本表上方行） |
| **缺陷类**（`500`，R108 必须告警） | `protocol_violation` / **`derived_key_collision`（v0.4 新增）** / `negative_balance_guard` / `unclassified_db_error` / `unclassified_db_raise` / `unclassified_pg_error` / `unclassified_non_pg_error` / `unclassified_driver_error` / `unmapped_ledger_error_code` |

（其余 `supply_cap_guard` / `kind_enum_guard` / `KEY_OWNED_BY_ANOTHER_EVENT_ROOT` / `UNKNOWN_OP` / `BAD_TYPE` / `BOTH_ZERO` / `SLOT_MISSING` / `HOLD_PAIR_REQUIRED` / `EVENT_NOT_BALANCED` / `EVENT_SUM_OUT_OF_RANGE` / `BALANCE_OUT_OF_RANGE` / `TOO_MANY_ENTRIES` / `TOO_MANY_ACCOUNTS` / `BUSINESS_REF_REQUIRED` / `NOT_A_NON_EMPTY_ARRAY` / `NOT_BOOLEAN` / `NOT_IN_WHITELIST` / `NOT_IN_FROZEN_SETTLE_WHITELIST` / `PLATFORM_*_FORBIDDEN` 系列 / `FORFEIT_MUST_GO_TO_-3` / `MINT_TO_POOL` / `business_frozen_cap` 为 §14.3 既有业务类 `reason`，本次新增/改动**不含**它们。）

**§14.3 v0.6 增补（Zang 裁定 + 规范要求）· 读路径「超 `bigint`」逃逸缺陷 · `details.reason` 名对齐 · 两条「不是确定性判据」的读数**（逐条登记见 §19.10；**不新增错误码** —— §14.1 的 **33 码关闭集**不动）

> **（A）读路径「超 `bigint`」逃逸缺陷 —— 定性 / 裁定 / 要求（事二）**
> **① 缺陷（Zang 亲跑复现）**：读路径上，一个**未映射的原始 PG SQLSTATE 逃到了调用方**：
> `getCurrency('99999999999999999999999')` ⇒ `code = 22003`、`status = undefined`、`mapped = false`、
> `message = value "99999999999999999999999" is out of range for type bigint`。
> **② 定性**：这是本项目**硬口径**的**回归** —— 硬口径 = 「**§14.1 的 33 码关闭集**」＋「§14.3 附表的 **`bucket ↔ 状态类` 映射**」，其要求是**不得出现无法归类的错误、不得出现未映射的原始 SQLSTATE**（未归类者只能落 §14.3 附表的「其余未归类 SQLSTATE」兜底并带 `reason`，**不得**原样逃出）。该缺陷属当年在**写路径**已灭掉的 **D-02 那一类**，**读路径漏网**。
> **③ Zang 裁定（口径，冻结）**：**超 `bigint`（`> 9223372036854775807` 或 `< -9223372036854775808`）⇒ `400 LEDGER_AMOUNT_INVALID` + `details.reason = OUT_OF_BIGINT_RANGE`** —— **与写路径同族（同码、同 reason），不新增错误码**；**`cid <= 0` 与负数仍 ⇒ `404`**（见本小节 v0.5 枚举块 ③，本次裁定**不变**）。⇒ 读路径与写路径**同一分类**：**形状非法（含超 `bigint`）⇒ `400`；形状合法但不存在 ⇒ `404`**。
> **④ Zang 要求（规范；实现侧必须满足 —— 本册只写裁定与要求，不转抄实现方读数）**
> **a. 按类修，不按点修**：枚举**所有**接收外部 `cid` / `uid` / 金额入参的**入口点**（读接口与写接口都要枚举），在**碰 PG 之前**设形状闸；**禁止**只给被发现的那一个入口点打补丁。
> **b. 新增「逃逸扫描」取证脚本**：矩阵 = **入口点 × 输入形状**（覆盖 `cid` / `uid` / 金额），逐格断言三条**硬判据**：`raw_sqlstate_escapes = 0`、`unmapped = 0`、`missing_status = 0`。
> **c. 该脚本的输出必须 run-tagged、永不得写固定文件名**（固定文件名会被后一轮静默覆盖 ⇒ 读数不可回溯；与 §19.9.F 第 1 条同一取证纪律）。
> **d. 修后读数回填**：修后读数**已存在** ⇒ 见 **§16 #12**（**v0.7 已回填**，该行**自此不再读作「未核对」**）。
>
> **⑤ 回填：修前 / 修后读数（v0.7；本册 `read_file` 自核 `p1o-00-escape-sweep-*.json` 后逐字落位，非转抄）**
>
> | 判据 | 修前（run `MUJJBPT2`） | 修后（run `MUJJ2PHX`） |
> |---|---|---|
> | `raw_sqlstate_escapes` | **33**（`22003` ×30 / `22P02` ×2 / `23503` ×1） | **0** |
> | `unmapped`（`code` ∉ 33 码关闭集） | **33** | **0** |
> | `missing_status` | 0 | **0** |
> | `expectation_mismatches` | **154**（首轮修前 run `MUJIUD5J` = 161） | **0** |
> | `valid_shape_false_reject` | 0 | **0** |
> | 另：`ld_sqlstate_leaked` / `unexpected_500` | 0 / 0 | 0 / 0 |
> | `ledger_entry` 行数（不写账本行自证） | 240 → 240 | **166 → 166**（一行未写） |
> | 矩阵规模 | **604 格**（实跑 590 + 纪律跳过 14） | 同 |
>
> - **真源（run-tagged，均在 `backend-ts/.p1f-artifacts/`）**：修后 `p1o-00-escape-sweep-after-MUJJ2PHX.json`（run `MUJJ2PHX`）；修前终版 `p1o-00-escape-sweep-before-MUJJBPT2.json`（run `MUJJBPT2`）；修前首轮 `p1o-00-escape-sweep-before-MUJIUD5J.json`（run `MUJIUD5J`，同类读数）。修后文件 `failures = []` / `escape_cells = []` / `mismatch_cells = []`，`verdicts` 六项全 `true` ⇒ **④b 的三条硬判据（`raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0`）在本矩阵内已归零**。
> - **修前 33 格分型（`escape_cells` 逐格自核）**：`22003` **×30**（3 种形状 = `bigint_max_plus_1` / 23 位 `over_bigint_far` / `bigint` 类型越界 `bigint_type_over`，**全部落在标识符字段** `cid` / `uid` / `before_txid` 上）；`22P02` **×2**（`E-R3_limit` 的 `NaN` / `'abc'`）；`23503` **×1**（`E-W7_getOrCreateAccount(cid = 9223372036854775807)` 的外键 `account_cid_fkey`）。逐入口点分布：`E-R3` 9 / `E-W7` 7 / `E-R2` 6 / `E-R1` 3 / `E-W8` 3 / `E-W9` 3 / `E-R3_limit` 2 = **33**。
> - **残留登记（未核对）**：修前终版轮 `ledger_entry` 的**绝对读数 = 240**、修后轮 = 166，**两者绝对差值的成因本册未核对**；轮内「前后相等 ⇒ 未写账本行」成立（`wrote_no_ledger_rows = true`，两轮一致）。
>
> **⑥ 登记「按类修」的方法论事实（可对撞取证；v0.7 自核两扫描文件与 `backend-ts/.p1f-artifacts/p1o-00-acceptance.md`）**
> **a. 枚举 17 个入口点**：扫描文件 `entrypoints` 长度 = **17**（读 `E-R1`–`E-R6` ＋ 写 / 原语 `E-W1`–`E-W11`），**凡接收外部 `cid` / `uid` / 金额者全部在列**（正合 ④a 的「枚举所有入口点」）；
> **b. 闸位全部前移到「碰 PG 之前」**：形状闸 = **唯一共用的 `toAmount`**（`toCid` / `toUid` / `assertUserUid` / `entryToPayload` / `normalizeRef` / `amountToPayload` 全部经它）⇒ **一处收敛 11 个入口点，而非逐点打补丁**（正合 ④a 的「禁止只补被发现的那一个点」）；
> **c. 修前基线由同一份终版脚本产出（临时 checkout → 跑 → 还原并核 md5）**：修前轮 = **临时 `git checkout` 还原到 HEAD（修前代码）→ 跑同一脚本、同一组用例 → 跑完还原修复版并核对 `md5`**；本册自核 `md5 backend-ts/src/ledger.ts` = `9456b5cb72a3a42dd3de26069429ee67`，与报告所述还原后 md5 **一致** ⇒ **修前 / 修后两轮读数由同一脚本、同一组用例、同一环境产出，可直接对撞**；
> **d. 脚本落盘文件名带 `phase` ＋ run tag、不写固定文件名** ⇒ ④c 的取证纪律在实现侧成立。

> **（B）`details.reason` 名对齐（事四）** —— `cid` **缺失**（`undefined` / 未传）在 **TS 侧的 reason 现为 `BAD_TYPE`**，而 **DB 侧同场景为 `MISSING`** ⇒ **裁定：TS 侧对齐为 `MISSING`**（与 DB 逐字一致）。**两侧都是 `400`、错误码同为 `LEDGER_AMOUNT_INVALID`** ⇒ **状态类不变，只是 reason 名对齐**。reason 取值集合仍为本小节 v0.5 枚举块 ① 的四值 `{ NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING }`（**不新增 / 不删除 reason**；`BAD_TYPE` 仍是 §14.3 既有业务类 reason 之一，仅**不再用于本格**）。
>
> **🆕 v0.7 就地更正（事二 · Zang 裁定）·「数字」不是类型错误**：上段原文括号里的「**数字**」**不符实现且不应改** ⇒ **更正为**：**JSON number 形式的 `cid` / `uid`（含 `0` 与负数）是合法形状**（**数字是 JSON 里标识符的自然表示，不是类型错误**）⇒ 走**存在性判定** ⇒ **`404 LEDGER_CURRENCY_NOT_FOUND`**（`cid`）／ **`404 LEDGER_ACCOUNT_NOT_FOUND`**（`uid`）；**只有「非十进制字符串」与「非数字类型（对象 / 布尔 / 数组）」才 `NOT_STRING` / `400`**（错误码仍 `LEDGER_AMOUNT_INVALID`）。
> **裁定理由（Zang）**：① `Amount = bigint ｜ number ｜ string` 是**既有契约**（§8.1 表示法）；把 number 判成「类型错误」等于把**合法形状**读成 `400`，**与本小节 v0.5 枚举块 ③ 直接冲突**（`cid = 0` 必须落 `404` 类）。② **实测两轮一致（本册自核扫描文件）**：JSON **number** `0` 形式的 `cid` 在 `E-R1_getCurrency` / `E-R2_getAccount` / `E-R3_listEntries` / `E-W1_transfer` / `E-W2_mint` / `E-W3_freeze` / `E-W4_unfreeze` / `E-W5_settleFrozen` / `E-W6_postEvent` / `E-W7_getOrCreateAccount` 上**全部** = `LEDGER_CURRENCY_NOT_FOUND` / **`404`**（修前 run `MUJJBPT2` 与修后 run `MUJJ2PHX` **两轮相同**）⇒ 数字走的是**存在性判定**，**不是**形状拒绝。③「数字形状合法」**只覆盖十进制整数 / 可安全表示者**：**非安全整数**（如 `1e23`）仍 `400 LEDGER_AMOUNT_INVALID` + `reason = NOT_INTEGER_OR_UNSAFE`（同上两轮一致）。④ `uid = 0`（JSON number）走 `400 LEDGER_RESERVED_UID` 属 **R98 业务守卫**，与形状闸**正交**（本小节 v0.5 枚举块末条已明写），**不得**与本格混为一类。
> 📌 **v0.6 旧写法（留痕，仅括号内「数字」一项被更正；其余（缺失 ⇒ `MISSING`、对象 / 布尔 ⇒ `NOT_STRING`、状态类不变）一律不变）**：原文为「**非字符串类型**（数字 / 对象 / 布尔等）一律用 **`NOT_STRING`**」。

> **（C）两条「不是确定性判据」的读数（事三；完整登记见 §19.10.C）**
> **① 子探针跳运行不稳定**：`p1f-acceptance.md` §7.3 的子探针 `lock_timeout_lockwait_raw_55P03_when_no_handler` **跳运行不稳定**（一轮 `false` / 一轮 `true`）⇒ **不得当确定性判据**，**禁止**把它写成硬断言。**稳定可用**的替代只有这一对：`lock_timeout_catchable_by_plpgsql = true`、`statement_timeout_bypasses_plpgsql_handler = true`（两轮一致）。
> **② `chain` 用例终局码有两个合法值**：**`LD025`**（末次等锁先撞 3s `lock_timeout`）或 **`LD026`**（10s 自证预算先耗尽）⇒ **断言只针对「等待有界」**：机读判据用落盘字段 `terminal_code_legal_set = ["LD025","LD026"]` / `terminal_code_in_legal_set` / `wait_bounded` / `clamped_to_le_10s`，**不得钉死某个码**（**禁止** `terminal_sqlstate === 'LD025'` 这类硬钉断言 —— 下一次运行会随机变红）。

**§14.3 v0.7 增补（Zang 裁定）· 「只准按 `code` 分支」纪律 · 三处已知 `reason` 名分歧 · 「错误码命名整理」工作项**（逐条登记见 §19.11；**不新增错误码** —— §14.1 的 **33 码关闭集**不动；**不动 R1–R108**）

> **（A）新规则（措辞可机读）· 调用方只准按 `code` 分支，不得按 `reason` 分支**
> - **条款**：**唯一定义对外契约的字段是错误码 `code`（＋ HTTP status，见 R105）。`details.reason` 是诊断信息，不是契约。** 任何调用方（前端 / 路由 / 服务层 / 测试 / 验收脚本 / 对拍脚本）**只准**按 `code` 分支（必要时再叠 status）；**禁止**以 `details.reason` 的字符串作为**行为分支条件**（`reason` 允许的用途 = 日志 / 指标 / 诊断 / 报告）。
> - **机读判据（供质检脚本对拍）**：`contract_field = "code"`；`reason_is_contract = false`；`reason_branching_allowed = false`；`reason_usage_allowed = ["log","metric","diagnostic","report"]`；`same_code_reason_may_differ_across_layers = true`（**「同码、同 status、仅 `reason` 名不同」是允许且已登记的现状** —— 见 (B)）。
> - **违反 / 合规样例**：✖ `if (err.details.reason === 'OUT_OF_BIGINT_RANGE') …`；✔ `if (err.code === 'LEDGER_AMOUNT_INVALID' && err.status === 400) …`。
> - **与既有条款的关系**：**不新增错误码、不改 R104 / R105 / R107 的任何要求** —— R104 仍要求 `reason` 进常量表（**枚举须机读**），本条款只约束**谁能当分支条件**；R107 仍要求 `details` 只放非敏感上下文。**已登记的 `reason` 名分歧不构成契约破坏**（这正是立本条款的原因）。
> - **编号纪律**：本条款**不发新 R 编号**（R1–R108 保持不动；依 §18 修订纪律 ②，编号只能追加 Rn+1 且须 Zang 发单）⇒ 规范效力以本块为准，登记见 §19.11.B。

> **（B）三处已知 `reason` 名分歧（登记；每条均为「同码、同 status，仅名不同」）**
> | # | 场景 | 一侧（TS） | 另一侧（DB） | 同码 / 同 status | 裁定 |
> |---|---|---|---|---|---|
> | **1** | DB `ledger_int_amount` / `ledger_cid_arg` 对**超长标识符**（23 位 `'9'×23`） | `LEDGER_AMOUNT_INVALID` + `reason = OUT_OF_BIGINT_RANGE`（`400`） | `LD016`（`LEDGER_AMOUNT_INVALID`）+ `reason = OVER_MAX_SINGLE_AMOUNT`（`400`；**`0005` 先查「长度 > 19」**再查真范围） | ✅ 同码 `LEDGER_AMOUNT_INVALID` / 同 `400` | **维持现状** |
> | **2** | `parseUserAmount('1e5')` | `reason = NOT_DECIMAL_STRING` | `reason = EXPONENT_NOT_ALLOWED` | ✅ 同码 / 同 `400` | **维持现状**（该函数**不在写路径上**：写路径的 `amount` 字符串直交 DB） |
> | **3** | **历史项（已修，仅作留痕）**：TS `cid` 缺失 | v0.6 前 = `BAD_TYPE` | 同场景 = `MISSING` | ✅ 同码 / 同 `400` | **已按 v0.6 裁定对齐为 `MISSING`**（v0.7 事二另更正 (B) 括号里的「数字」：数字**不是**形状错误 ⇒ 不走 `400`） |
> - **裁定：全部维持现状。** 理由：① 第 1 条两侧名对齐**须改动 `0005` 的判定顺序**（先长度、后范围）⇒ **动 DB 判序求名对齐，不值**（并入工作项 (C) ②，**P2/P3 边界一次做完**）；② 第 2 条同码同 status，且 **`parseUserAmount` 不在写路径上** ⇒ **不影响任何契约**（依 (A)：`reason` 非契约），**不改**；③ 第 3 条已修完，**留痕即可**。
> - **机读读法**：`known_reason_name_divergences = 3`，逐条 `same_code = true` / `same_http_status = true` / `reason_only = true`。

> **（C）工作项登记 · 「错误码命名整理」（不在本册执行）**
> - **性质与排期**：**工作项，本册只登记、不执行**（§0.2 分工）。**排在 P2/P3 边界一次做完**；**禁止**零散顺手改 —— 命名整理牵动 `0005` 判序、关闭集语义与两侧对照，必须**一次收敛、一次取证**。
> - **四条清单**：① **标识符形状错误借用 `LEDGER_AMOUNT_INVALID`**（`cid` / `uid` / `ref_type`·`ref_id` / 冲正守卫等**参数形状**问题都借这个**金额中心**的码名，靠 `details.field` 区分字段）；② **DB `ledger_int_amount` 对标识符套用金额长度帽 ⇒ `reason` 名错位**（23 位标识符给 `OVER_MAX_SINGLE_AMOUNT`，到 `bigint` 上限 +1 才给 `OUT_OF_BIGINT_RANGE` —— `0005` 判序所致）；③ **TS `BAD_TYPE` 拆分（已修）** ⇒ 拆成 `MISSING` / `NOT_STRING`（v0.6 裁定）；④ **(B) 的三处 `reason` 名分歧**（第 1、2 条待本工作项一次收敛）。
> - **根因（一句话）**：**关闭集的词汇是「金额中心」的，却被长期用于标识符。**
> - **做本工作项时必须守住的既有纪律**：**本册的关闭集口径不变**（§14.1 的 **33 码**）；若整理结论指向「新增 / 改名错误码」，**须 Zang 单独发单**并按 §18 修订纪律 ② 只追加 Rn+1；**`code` 是契约、`reason` 不是**（本块 (A)）；**R104 / R105 / R107 不动**。
> - **登记**：§19.11.C。

**§14.3 v0.10 增补（Zang 裁定）· 「`200` ⇒ `benign`」的精确口径（**写死**，避免后续歧义）· §5.23 的「反转探针不做」裁定登记**（逐条登记见 §19.14；**不新增错误码** —— §14.1 的 **33 码关闭集**不动；**不动 R1–R108**）

> **（D）「`200` ⇒ `benign`」的精确口径（**写死** —— 四条都是本版核心，逐字执行）**
> ① **`bucket` 字段保持 `input` 不变**：`LD006 = LEDGER_IDEMPOTENCY_REPLAY` **仍是 `input` 起源的良性结果**。**改的只是「校验」**：**状态码为 `200` 的码不参与 `bucket ↔ 状态类` 校验**、**单列一类**（校验类名 `benign_outcomes`）。⇒ **不要求改任何桶取值**：`0009` 的 `LD006` 桶分支 = `input`、`p2c-00-code-roundtrip.ts` 扩展表 `'200': 'input'`、`LEDGER_ERROR_BUCKETS['LEDGER_IDEMPOTENCY_REPLAY'] = 'input'` **三处都保持 `input`**（**v0.9 曾写「同步为 `200 ⇒ benign_outcomes`」—— 该指令由本块作废**，见 §16 #15 的 v0.10 更正）。
> ② **`0009` 不得再改**（**已应用**；改它会造成「**撒谎态**」—— **本仓库有前例被明令禁止**）。⇒ 这是**校验侧**的事，**不是映射侧**的事：**册内口径 = 映射（`0009` / `LEDGER_ERROR_BUCKETS` 的桶取值）一字不动，校验（往返脚本与任何桶一致性断言）跳过 `200` 类**。
> ③ **良性码的 HTTP 语义**：`httpStatusOf` 对**良性码**（`200` 类）**返 `200`**（**不是** `500` 兜底）。依据：`LEDGER_ERROR_TABLE['LEDGER_IDEMPOTENCY_REPLAY'].status = 200`（**不是** `null`）⇒ `httpStatusOf(code) = status ?? 500` 天然返回 `200`；**兜底 `500` 只对 `status === null` / 缺失者生效**（例：`LD032`）⇒ **禁止**把良性码纳入 `?? 500` 的兜底面（那会把「成功重放」报成服务异常）。R106 的「按成功处理」由此在 HTTP 层闭合。
> ④ **判据集更新（v0.9 (A)⑥ 的 ④ 条原话由本条替换）**：**`200` 类码的桶值必须 = `input`**（映射侧），**且校验器必须把 `200` 类从四桶公式判定中排除**、按 `benign_outcomes` 单列（校验侧）。**两条同时成立才算达标**；**只满足其一（如把桶值改成 `benign_outcomes`）即为违反本块**。
> ⑤ **代码侧的工作区实况（本册 v0.10 收尾 `git diff` 读到 · 未提交 · 本册未实跑）**：实现方**已在工作区**按本条口径同步了两处 —— `src/ledger-errors.ts` 新增 `LEDGER_BENIGN_CODES` / `isBenignLedgerCode()` / `BENIGN_HTTP_STATUS = 200`（注释明写「改桶 = 改已应用迁移的语义 = 撒谎态」）、`httpStatusOf` 对良性码恒返 `200`；`scripts/p2c-00-code-roundtrip.ts` 把 `'200': 'input'` 从**扩展表**移入 **`benign_outcomes` 豁免**（`bucket_class_validated: false`），并**断言良性码的 DB 桶 / JS 桶仍是 `input`**。⇒ **与 ① ② ③ 逐点一致**（桶保持 `input` ✓ / 只改校验 ✓ / 良性码返 `200` ✓；**`0009` 未动** ✓）。本册**不改代码、未实跑其断言**；该同步**未提交**。详见 §19.14.B。

> **（E）§5.23 的「反转探针不做」裁定（登记，不产生实现）**
> **裁定**：**反转探针（§8.1）不要求做。** 依据（§5.23 原文）：正 / 反两向已由「**同一份终版脚本** + 迁移状态指纹（修前 `0009 = ABSENT` 红 / 修后 `0009` 绿）+ 修前 `32/33` 对照修后 `0`」覆盖；**再反转一次函数体只是重证修前态，边际价值低，不值得再花一轮**。⇒ **禁止**把「未做反转探针」列为 §14.3 v0.9 (C) 的缺口或待办；**往返闭合断言的达标条件 = 正向读数 + 迁移指纹 + 修前 / 修后对照**（§14.3 v0.9 增补块 (B) 不变）。

### 14.4 `details` 形状表（**R107 要求的登记表，v0.2 补齐**）

> **背景（留痕）**：R107 明确「`details` 的形状按 code 固定并在本册登记（**P1 实现时补一张 `details` 形状表**）」。P1a 实现时（该轮禁改 `docs/**`）把该表**暂写在 `backend-ts/src/ledger.ts` 的文件头注释里**；**v0.2 正式回写于本节**，此后以本节为准（代码注释与本表必须一致，不一致以本表为准并回改注释）。

| 错误码 | `details` 固定形状 | 备注 |
|---|---|---|
| `LEDGER_INSUFFICIENT_BALANCE` | `{ uid, cid, required, available }` | 金额字段按 R70 用十进制字符串 |
| `LEDGER_INSUFFICIENT_FROZEN` | `{ uid, cid, required, available, reason? }` | `reason = 'business_frozen_cap'`（R36：业务表在冻额不足） |
| `LEDGER_IDEMPOTENCY_CONFLICT` | `{ idempotency_key, expected?, actual? }` | `expected` / `actual` = 请求指纹（R53） |
| `LEDGER_CURRENCY_*`（`NOT_FOUND` / `NOT_LISTED` / `FROZEN` / `DELISTED` / `INVALID_TRANSITION` / `MISMATCH` 等） | `{ cid, symbol, status }` | 币种类统一形状 |
| `LEDGER_SUPPLY_CAP_EXCEEDED` | `{ cid, symbol, total_supply, supply_cap, requested }` | |
| `LEDGER_UNAUTHORIZED_MINT` | `{ cid, owner_uid, actor_uid, platform }` | |
| `LEDGER_AMOUNT_*`（`AMOUNT_INVALID` / `AMOUNT_NOT_POSITIVE` / `SELF_TRANSFER` 等） | `{ field, value?, reason? }` | `reason` 枚举与 §14.3 共用 |
| `LEDGER_DECIMALS_OVERFLOW` | `{ cid, field, decimals, provided }` | |
| `LEDGER_RESERVED_UID` | `{ field, uid, reason? }` | `reason` 取值见 §14.3 |
| `LEDGER_UNKNOWN_KIND` | `{ kind }` | |
| `LEDGER_HOLD_NOT_ALLOWED` | `{ uid, cid, reason }` | |
| `LEDGER_NEGATIVE_BALANCE_GUARD` / `LEDGER_ACCOUNT_GUARD_VIOLATION` / `LEDGER_APPEND_ONLY_VIOLATION` | `{ constraint? }` | **`500` 类**：`details` 仅入日志（R108）；响应体**不得**含约束名 / 表名 / SQL / 堆栈（R107 禁止项） |
| `LEDGER_TX_TIMEOUT` | `{ reason: 'pool_connection_timeout' \| 'driver_connection_error' }`〔**v0.3 新增单列**〕<br>🆕 **v0.4 补两形状**：① **预算耗尽（`LD026`）**：`{ reason: 'statement_budget_exhausted', budget_ms: 10000, remaining_ms, stage, retryable: true }`（`stage` 形如 `'lock:wakeup'` / `'unit_probe'` / 关键阶段名）；② **基础设施类**：`{ reason: 'too_many_connections' \| 'disk_full' \| … \| 'read_only_transaction' \| 'database_unavailable' \| 'connection_error' \| 'internal_error', pg_code, retryable: true, source: 'pg_infra_class' }`（TS 侧；DB 侧同 `reason` 不带 `source`）。 | `reason` 枚举见 §14.3 附（本版登记五类）；`pool_connection_timeout` = 连接池取连接超时 / 过载（**WS 连接池拿不到连接时抛的是无 `code` 的裸 `Error`**，**不得**再兜底改写成 `LEDGER_TRANSACTION_REQUIRED` / `500`）；`driver_connection_error` = 驱动 / OS 级连接错误（如 `ECONNREFUSED`）。**纯会话级 `statement_timeout`（`57014`）触发时**仍**省略**本字段（即 `{}` —— 它走 SQLSTATE 表分支，不走 `infraSqlstateReason`）。见 §14.1 #27 / §11.2 R82 / §19.8.C / §19.9.A |
| `LEDGER_TRANSACTION_REQUIRED` | `{ cause, reason: 'unclassified_non_pg_error' \| 'unclassified_driver_error' \| 'unclassified_pg_error', error_name, error_code? \| pg_code? }`〔**v0.3 新增单列**〕 | **不得只留 `cause = 'non_pg_error'`**（v0.3 更正：`cause` 只是归类标签，`reason` 才是机器可读枚举，须进 R104 常量表）；`error_name` = 原始 `Error.name`；`error_code` = 非 PG 错误自身的 `code`，`pg_code` = PG SQLSTATE，按实际来源二选一。本码为 `500` 类 ⇒ `details` 仅入日志（R108），响应体不得含 SQL / 约束名 / 堆栈（R107） |
| 🆕 `LEDGER_LOCK_TIMEOUT` | `{ reason: 'lock_timeout', pg_code: '55P03', lock_timeout_ms, retryable: true }`〔**v0.4 新增单列**〕 | DB 侧 `LD025`。`lock_timeout_ms` = 本次等锁的**实际**上限（已被预算助手压到 `min(3000, 剩余)`）。见 §14.1 #26 / §14.3 附 |
| 🆕 `LEDGER_DEADLOCK_RETRY_EXHAUSTED` | `{ reason: 'deadlock_detected' \| 'serialization_failure', pg_code, retries_performed: 0, retry_owner: 'caller', retryable: true }`〔**v0.4 新增单列**〕 | DB 侧 `LD027`。`retries_performed = 0` / `retry_owner = 'caller'` 是 **R60 重试主权**的机读证据（DB 不重试，调用方重试）。见 §7.3 R60 |
| 其余码（`IDEMPOTENCY_KEY_REQUIRED` / `_INVALID` / `FEE_RATE_INVALID` / `REF_NOT_FOUND` / `ACCOUNT_NOT_FOUND` / `CURRENCY_SYMBOL_TAKEN`） | `{}` 或省略 | 无附加上下文〔**v0.4**：`LEDGER_LOCK_TIMEOUT` / `LEDGER_DEADLOCK_RETRY_EXHAUSTED` 亦已自本行移出、各自单列于上（v0.3 旧写法：两码均在本行）〕 |

---

## §15 待 Kevin 拍板清单

本册共给出 **109 条规则（R1–R109）**，其中绝大多数条目属于「本册建议值」，状态列标为【待拍板】并注「一句话可改」。下表把需要 Kevin **明确表态**的条目集中列出；★ 标记的三条**必须在 P1 开工前拍板**（它们会改变表结构或资金口径，事后改动会牵连已落盘流水）。〔**v0.12**：由 **108 条（R1–R108）→ 109 条（R1–R109）**；**下表 #6（R79）已由 Zang 按 C1 终审拍板** ⇒ 本清单**实剩 19 条**（20 行 − 已裁定 1 行）〕

| # | 条目 | 本册建议值 | 一句话可改的替代方案 | 影响面 | 优先级 |
|---|---|---|---|---|---|
| 1 | **R15 分录双字段** | `ledger_entry` 同时有 `delta`（可用变动）与 `frozen_delta`（冻结变动） | 改回单一 `delta`（master-plan 草案写法）—— 代价：冻结资金直接支付给对方时无法记账，必须伪造「先解冻再付款」两步 | 表结构 + 全部 kind + 对账判据 1/2/8 | ★★★ |
| 2 | ~~**R31 保证金性质（D6 vs D7 冲突）**~~ ✅ **已于 v0.2 裁定** | **保证金 = 消耗（不可退），计入平台收入**（依据 Kevin 原文「用户自定义的社区积分如需上市，需要消耗一定的积分作为保证金」）；`listing_deposit_refund` 删除（kind 关闭集 22 → 21 →〔**P1c（v0.3）**〕**20**：`listing_deposit_forfeit` 已于 v0.3 删除，见 §19.8.B） | ~~「本册建议值：保证金=冻结可退」~~ **作废** —— Kevin 已按「消耗不可退」拍板（原表内「一句话可改的替代方案」被采纳） | 币种状态机 + 平台收入报表 + kind 集（22 → 21，〔P1c〕→ **20**） | 已裁定（Zang · P1a 收口，见 §19.0；kind 关闭集后续于 v0.3 收至 **20**，见 §19.8.B） |
| 3 | **R103 平台收入能否提取** | 当前 kind 集**不覆盖**提取动作；在补 `platform_withdraw` 之前平台收入账户只进不出 | 明确「不需要提取」（则永久保持只进不出，无需新 kind）；或批准新增 `platform_withdraw` kind | kind 集 + 后台按钮 + §13 R101 白名单 | ★★★ |
| 4 | **R48 幂等键作用域** | 全局唯一 `UNIQUE (idempotency_key)` + 强制前缀 | 改为 `UNIQUE (uid, idempotency_key)` —— 代价：所有 dedupe 查询都要带 uid，且平台账户事件需单独处理 | 唯一约束 + 幂等协议 + 索引 | ★★ |
| 5 | **R74 写入顺序 + account 守卫触发器** | 「先插分录、后更新 account」，并用 `trg_account_guard` 在 DB 层校验余额 == 最新分录快照 | 去掉触发器，仅靠应用层 —— 代价：本册唯一能在 DB 层拦住「扣了钱没落流水」的手段消失 | DDL + 每笔写入的语句顺序 | ★★ |
| 6 | ~~**R79 加锁全序**~~ ✅ **已于 v0.12 拍板（Zang · C1 终审）** | **全序 = 业务行（按主键升序） → `currency`（`cid` 升序） → `account`（`uid` 升序）**；**禁止**先锁 `account` 再锁业务行；**编排函数必须在调 `ledger_post_event` 前持有业务行锁**；**`lockAccounts(sortedUids, cid)` 由「建议」升为强制**（唯一加锁入口、只接受已排序数组）。📌 **v0.11 旧写法（保留留痕）**：本册建议值 =「currency(cid 升序) → account(uid 升序) → 业务行(主键升序)」（**未涵盖「业务行在 currency 之前」**） | ~~允许按业务自然顺序加锁并接受偶发死锁 + 重试 —— 代价：10 级佣金结算的死锁率显著上升~~（**已否：反向写法与全序成环 ⇒ 死锁**） | 全部多账户事务 | 已拍板（Zang · C1 终审，2026-09-28；见 §10.1 v0.12 块 / §19.16.A） |
| 7 | **R22 新表列名风格** | snake_case 无引号（`uid` / `cid` / `delta`） | 沿用 legacy 带引号驼峰（`"uID"` / `"cID"`） | 三张表 + 所有 SQL + 驱动映射 | ★ |
| 8 | **R21 `ledger_owner` 辅助表 & legacy `"users".uid` 类型**〔**v0.4 更正（D11）**：表已由 `0006` 改名 `users`〕 | 新增 `ledger_owner(uid, owner_type, name)` 承载 FK；legacy `"users".uid` 收敛为 `bigint`〔**v0.4**：该收敛**已由 `0002_user_identity.sql` 完成**（列现为 `bigint`），不再是 P0 待办〕 | 不建 FK、不做类型收敛（仅应用层校验）—— 代价：保留 text/int 类型分叉〔**v0.4**：该「代价」已部分消失 —— 类型分叉已消除，仅剩「不建 FK」一项〕 | 表数（3→4）+ 50 条路由 | ★★ |〔**v0.8 指针**：本项的「不建 FK」**只适用账本表**；**业务表可以 FK 到 `users(uid)`**（§5.20 #6 裁定，见 §2.2 R21 的范围限定），故 `ledger_owner` 辅助表**不是**业务表建 FK 的前置条件〕
| 9 | **R56 事务连接串** | 事务走 `DATABASE_URL_UNPOOLED`（直连），只读走 pooled | 全部走 pooler —— 需先实测 advisory lock 可用性 | 连接层配置 + 并发上限 | ★ |
| 10 | **R2 `$` 的 `cid`** | 固定 `cid = 1`（migration 显式插入） | 用其他固定值或不用固定值（则需额外唯一索引定位 $） | 种子数据 + 所有 `deposit_cid` | ★ |
| 11 | **R8/R9 `$` 的 decimals 与用户币上限** | `$` 的 `decimals = 0`（整数积分）；用户币创建时**必须**指定 `supply_cap` | `$` 用 `decimals = 2`（1% 手续费在小额下更精确）；允许用户币不设上限 | 金额换算 + 手续费取整 + 前端输入 | ★★ |
| 12 | **R68 取整方向** | 四舍五入（half-up），净额用减法求 | 手续费**向下取整**（对用户更友好）—— 注意净额仍必须用减法 | 手续费金额 + 佣金池余额 | ★ |
| 13 | **R47 成交费承担方** | taker（吃单方）；无法区分时买卖各半 | 全部由卖方承担 / 全部由买方承担 | 交易所账单文案 + 撮合逻辑 | ★ |
| 14 | **R36 不建 `frozen_breakdown` 表** | `account.frozen` 为聚合投影，归属真源在业务表；对账判据 5 兜底 | 新增冻结明细表（双真源风险，需额外一致性守卫） | 表数 + 判据 5 写法 | ★★ |
| 15 | **R43 `hold` 复用 vs 专用 kind** | 交易所挂单复用 `hold` + `ref_type`；仅招工托管用 `job_escrow` 专用 kind | 每个业务模块各用自己的 hold kind —— 代价：kind 集随模块膨胀 | kind 集 + 账单「冻结原因」文案 | ★ |
| 16 | **R17 kind 用 text + CHECK** | text + CHECK 约束（新增 kind 必须走 migration） | 用 PG `ENUM` 类型 / 字典表 + FK | DDL + migration 流程 | ★ |
| 17 | ~~**R13 `account.version` 乐观锁**~~ ✅ **已于 v0.2 裁定** | **保留 `version` 列**（仍按 R13 每笔加分录事务 `+1`，**仅作审计**）；**写路径一律 `SELECT ... FOR UPDATE`**，不做乐观锁分支 | ~~全部用 `FOR UPDATE`，删除 `version` 列~~ —— 最终口径：**用 `FOR UPDATE` 但保留 `version` 列**（见 §19.4） | account 表 + 写路径 | 已裁定（Zang · P1a 收口） |
| 18 | **R71 单笔金额上限** | `app_config` 配置，建议 `1e15` 最小单位 | 其他上限值 | 入参校验 | ★ |
| 19 | **R82 锁/语句超时** | `lock_timeout = 3s` / `statement_timeout = 10s`〔**v0.4 口径已改写**：见 §11.2 R82 v0.4 块 / §19.9.B —— 上限是**函数内自证预算**（语句级 10s、`min(3s,剩余)`），**不是**端到端 10s〕 | 其他时长 | serverless 稳定性 | ★ |
| 20 | **R97 对账查询的生产版形状** | 按 `cid` 分批 + `txid` 区间切片的游标版（示意 SQL 仅用于小表演示） | 全表聚合（小数据量下可接受，大数据量会 OOM） | 对账脚本实现 | ★ |

> **🆕 v0.15 就地加注（`§15 #3` · Zang 终审 `R-9-66`）**：**本项（「`R103` 平台收入能否提取」= 平台运维提取 / `platform_withdraw`）与 `invite_first_task_reward` 无关。** 后者 = 需求 **§6.2② 明文授权**的**发放**（**系统内转移**：`−1` → 用户），已由 `R101` 的 `−1` `debit` 白名单**放行**、**不触碰本格留白**；本项（**转出系统**）**仍未批**（Kevin ★★★ 待拍板）⇒ 后台**不得**提供「提取平台收入」按钮。详见 §13.3 v0.15 块 + §19.18。

---

## §16 未能核实 / 未实测诚实清单

> 本节是本册的**诚实边界**。以下 **15** 项（v0.1 原始 5 项 + **v0.4 新增 6 项** + **v0.6 新增 2 项** + **v0.9 新增 2 项**）未被实测或未能核实，**不得**在 P1 验收时当作已通过。v0.4 新增的 #6–#11 来自 P1e/P1i/F3 的实测与未验证面（出处：`backend-ts/.p1f-artifacts/p1f-acceptance.md` §7 / §10、`p1f03-f3-readings.json`）。〔**🆕 v0.7**：**#12 已回填**（修后逃逸扫描读数已取得并逐字落位，见该行）⇒ 本行起**不再读作「未核对」**〕〔**🆕 v0.9**：新增 **#14 / #15**（② 往返闭合测试的读数与覆盖面边界、③ `benign_outcomes` 改判后的**代码侧待同步项**）；**未增删**其它行，**#12 / #13 一字未动**〕

| # | 未实测 / 未核实项 | 具体到什么程度 | 后果与建议 |
|---|---|---|---|
| **1** | **本册全部 DDL 与触发器语法未在真实 Neon 上执行过** | 目标库为**全新空库**（`public` schema 0 张表），P0 的版本化 migration **尚未建立**（仓库内不存在 `migrations/` 目录与 schema 版本表）。因此下列写法均**仅经纸面审阅**：① `bigint GENERATED BY DEFAULT AS IDENTITY` + 显式插入 `cid = 1`；② `RAISE EXCEPTION '...%...' , TG_OP, ...` 的占位符与参数个数匹配；③ `currency_symbol_fmt` 里 `~ '^[^[:space:]]{1,16}$'` 的转义；④ `CREATE UNIQUE INDEX ... WHERE ...` 与 `CONSTRAINT` 混用；⑤ 自引用 FK `reversal_of_txid REFERENCES ledger_entry(txid)` 与 `GENERATED ALWAYS` 主键的兼容性。 | 建库后**第一件事**是在空库跑一遍 migration 并 `psql \d+` 复核约束是否真的落地；未跑之前，本册 DDL 只能视为口径而非事实 |
| **2** | **`trg_account_guard` 的核心假设未实测** | 该触发器依赖「同一事务内先插入的 `ledger_entry` 对后续 `account` 更新**可见**」。这在 PostgreSQL 里应当成立（同事务可见自己的未提交写入），但**未在 Neon 上实跑验证**。若该假设不成立，R74 这条 DB 层守卫会直接失效（要么误报、要么形同虚设）。 | 建库后必须做一次最小验证：单事务内「插一条分录 + 更新 account」应通过；「只更新 account 不插分录」应被拒；顺序颠倒应被拒。三条用例缺一不可 |
| **3** | **D1 的访问层升级未实测（本册最大的工程不确定项）** | `.env.local` 确有 `DATABASE_URL`（pooler，带 `channel_binding=require`）与 `DATABASE_URL_UNPOOLED`（直连）两条串，但以下均**未实测**：① `@neondatabase/serverless@0.6.0` 的 `Pool` over WebSocket 能否提供交互式事务（该版本较旧，可能需升级）；② `pg` 驱动 + Neon 直连串的 `channel_binding=require` 是否被当前 `pg` 版本支持；③ `pg_advisory_xact_lock` 经 Neon pooler（PgBouncer transaction 模式）是否可用（R62 撮合串行化依赖它）；④ 直连的连接数上限与 Vercel serverless 并发是否匹配。 | R55/R56/R61/R62 四条规则的可实现性都挂在这一项上。**建议 P0 的第一步就是写一个最小的「事务连通性探针」**（起事务 → 两条写 → 回滚 → 再读），把①②③④逐个打勾或打叉，再决定 D1 的最终形态 |
| **4** | **全部并发与判负用例未跑** | §10 R85 的五条并发用例（100 并发转账守恒、同键并发只生效一次、并发不产生负余额、并发 mint 不超上限、死锁重试生效）、§11 R93 的对照组实验、§11 R89 的注入-还原演练，**一条都没执行**。对账脚本本身也**不存在**（`backend-ts/scripts/` 目录不存在）。 | 这些正是 P1 的验收 AC，本册只提供「判据与判负方法」，**不构成验收证据**。P1 验收时必须由 Neng 独立执行并附读数 |
| **5** | **legacy → 新模型的映射未逐条核实；且 D3 的措辞与代码现状不符** | 已实测：`src/index.ts` 共 **50 条路由**（`grep` 计数）；`src/database.ts` 中 `CREATE TABLE` 只覆盖 **9 张表**（`app_config` / `permission_group` / `prize` / `prize_item` / `task_progress` / `market_order` / `market_trade` / `shard_transfer` / `shard`）—— **`"users"`、`asset`、`task` 三张表的建表语句在仓库里根本不存在**〔**v0.4 更正（D11）**：`users` 的建表语句**现由 `backend-ts/migrations/0002_user_identity.sql` 提供** ⇒ 该项**不再是缺口**；`asset` / `task` 仍未核实〕（`ensureSupportSchema` 只做 `ALTER TABLE IF EXISTS`，对空库是空操作），这是**空库 P0 的现存缺口**。另外 `src/auth.ts` 的登录流程只返回 `{ evm }`，`uID` 由 `"users"` 表的自增逻辑分配（见 `src/database.ts:410` 的 `MAX(...)+rn`），因此 **D3 所称「uID 沿用现有 EVM 派生逻辑」与代码现状不一致**。最后：legacy `"users".uid` 在 v0.1 实测时是 **`text`** 列〔**v0.4 更正**：表已改名 `users`；该列现为 **`bigint`**（`0002` 已收敛），类型分叉不再是现状〕，而 `asset` / `shard` / `prize_item` 的 `"uID"` 是 **`integer`**，**类型已经分叉**；本册对 50 条路由与新表的逐条映射**未做**。 | 需 Kevin 拍板两件事：① `"users"` / `asset` / `task` 的建表语句由谁在 P0 补（属身份 spec；`users` 已由 `0002_user_identity.sql` 提供 ⇒ 只剩 `asset` / `task`）；② D3 的措辞是否改订为「uID 由 `"users"` 表自增分配，登录凭 EVM 签名」 |
| **6** | **「端到端 ≤10s」未验证、也未实现** —— 预算钳的是**单条语句** | 两轮同场景实测：**DB 侧单语句 10142ms / 10106ms**；**客户端总耗时 11283ms / 10897ms**，差值为客户端/连接开销 **1141ms / 791ms**（≈ +0.8~1.3s）。⇒ 「端到端 10s 上限」**不存在**（`clamped_to_le_10s = true` 指的是**语句级**）。 | **不得**在验收/对外文案里写「端到端 ≤10s」。机读上限只到语句级（见 §11.2 R82 v0.4 块 (3) / §19.9.B） |
| **7** | **`57014` 的「DB 内转码」路径不存在** | `statement_timeout` **绕过** plpgsql `EXCEPTION` 处理器（逃逸矩阵 5 组对照 A1/A2/B1/B2/B3 + 附测 B4/B5：`stmt_timeout_catchable_by_plpgsql = false`、`statement_timeout_bypasses_plpgsql_handler = true`、`raw_57014_escaped = true`、`final_detail_raw = null`）；`lock_timeout` **则可以被接住**（`lock_timeout_catchable_by_plpgsql = true`，内层捕获 `55P03` 后改抛）。 | ⇒ **`LD026` 的唯一产生源是预算助手**（§11.2 R82）；`57014` 只能由 §C 分类器归类为 `LEDGER_TX_TIMEOUT` / `503`。**禁止**把它写成「§E 处理器接住 `57014` 再转码」（v0.4 已就地否证） |
| **8** | **池化路径的连接级 `statement_timeout` 不可用** | pooler 端点**拒绝** `options` 启动参数（`08P01` `unsupported startup parameter in options`，实测）；连接级超时只在**直连**端点可用（`options=-c statement_timeout=10000`，`SHOW = 10000ms` 且按预期取消）。本轮所有预算探测均走非池化 / 直连语义。 | 池化路径**只能**依赖函数内自证预算；「池化下与直连语义等价」**未验证**。另：`xact` 级 `set_config(..., true)` 对自身语句无效已登记为坑，**未探究**其它 GUC 注入方式 |
| **9** | **持锁链累计等待只在「单账户 / 单键 / 6 持锁者」规模验证** | 构造为 6 个持锁者按 `spacing_ms = 2600` 串行占用同一账户行、调用方串行重试同一键。**更高并发、多账户交叉、跨 `currency` 的累计等待未取读数**。 | 不得把「6 持锁链钳到语句级 10s」外推为「任意规模的累计等待上界」 |
| **10** | **判据归零与分类器「永不 NULL」的覆盖面有限** | §11 判据 1 / 判据 8（键族两口径）归零是在**当轮测试数据**上取得（`judgement1_rows = 0`、`judgement8_bykey_mixed_rows = 0`、`judgement8_bykey_prefixonly_rows = 0`）；`ledger_error_for_sqlstate` 的「全定义域永不 NULL」只在 **40 个 SQLSTATE 抽样**上验证（`never_null = true`），**非全定义域穷举**；死锁路径的 `pg_stat_database.deadlocks` 是全库口径、取样时未有其它并发写负载（未做长时窗漂移校正）。 | 验收时不得读作「全定义域已证明」 |
| **11** | **改名（D11）相关：端到端 HTTP 复测未做；`user` 保留字陷阱**未被消除**** | ① `seafood-api`（5788）是**面板托管常驻进程**，本单**禁止重启** ⇒ 它跑的仍是**改名前的已加载代码**；`/api/user`、`/api/user/profile`、`/api/user/asset/:uID` 走 HTTP 的路径**未在改名后的进程里实测**（`ledger-smoke` 的 29 条走**直接 import**，已实测）。② 改名**未消除** `user` 保留字行为：改后 `SELECT count(*) FROM user` **依旧**静默返回 `current_user` 的 1 行；消除的是**事故类别**（正确表名 `users` 不再是保留字 ⇒ 写错时无同名表可被「碰对」，`42P01` 立现）。③ `ensureSupportSchema()` 的既存失配（用 legacy 列名 `"uID"` / `"EVM"`，并引用本库**不存在**的 `asset` 表）**仍存在**，与改名无关（pre-existing）。 | **不得**对外表述为「保留字陷阱已消除」；**不得**读作「改名后端到端已验证」 |
| **12** | **「修后逃逸扫描」读数**（v0.6 新增；**🆕 v0.7 已回填 ⇒ 本行起不再读作「未核对」**） | 逃逸扫描脚本**已存在**（`backend-ts/scripts/p1o-00-escape-sweep.ts`；矩阵 = **入口点 × 输入形状**，**run-tagged 落盘、不写固定文件名**）。**修后读数（run `MUJJ2PHX`，真源 `backend-ts/.p1f-artifacts/p1o-00-escape-sweep-after-MUJJ2PHX.json`；本册自核）**：`raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0` / `expectation_mismatches = 0` / `valid_shape_false_reject = 0`；**604 格**（实跑 590 + 纪律跳过 14）；`ledger_entry` **166 → 166**（一行未写）。**修前（run `MUJJBPT2`）**：**33 格**逃逸（`22003` ×30 / `22P02` ×2 / `23503` ×1）、`unmapped` 33、`expectation_mismatches` 154。**剩余诚实边界**：该读数**只覆盖脚本矩阵内的形状**（矩阵 = **17 个入口点 × 输入形状**；本册自核：通用输入形状 **17 个**（`valid` / `not_decimal_integer` / `empty_string` / `non_string_object` / `non_string_boolean` / `undefined` / `zero` / `negative` / `bigint_min` / `bigint_max` / `bigint_max_plus_1` / `over_bigint_far`（23 位）/ `bigint_type_over` / `scientific_1e5` / `padded_spaces` / `number_zero`（JSON number `0`）/ `number_unsafe`（`1e23`））—— 另有 `limit`、幂等键等**字段专属形状**）；**矩阵外的新输入形状未穷举**（实现方自述：纯读入口点未套 blanket 归一化 ⇒ 新形状仍可能原样逃出，**由本扫描脚本作回归闸门**，新形状须入矩阵后再跑、读数同样 run-tagged）；三处已知 `reason` 名分歧见 §14.3 v0.7 增补块 (B)。 | **不得**把本行读成「任意输入的逃逸都已清零」。**在本扫描矩阵内**，修后三条硬判据已归零（属**已实测**，不再是「未核对」）；矩阵外形状的回归保障 = 该脚本（**固定文件名会被静默覆盖 ⇒ 一律 run-tagged**，见 §14.3 v0.6 增补块 (A)④c）。完整读数表与「按类修」方法论见 **§19.11.A**。 |
| **13** | **两条「不是确定性判据」的读数**（v0.6 新增） | ① `p1f-acceptance.md` §7.3 的子探针 `lock_timeout_lockwait_raw_55P03_when_no_handler` **跳运行不稳定**：`.p1f-artifacts/p1f03-f3-readings.json`（run `H262V`）= **`false`** ↔ `.p1f-artifacts/p1f03-f3-readings-I5XPD.json`（run `I5XPD`）= **`true`**；② `chain` 用例（6 持锁链）**终局码有两个合法值**：`LD025`（末次等锁先撞 3s `lock_timeout`）或 `LD026`（10s 自证预算先耗尽），同两轮各命中一个（`H262V` ⇒ `LD026`；`I5XPD` ⇒ `LD025`）。二者均**不是**确定性判据（规范效力见 §14.3 v0.6 增补块 (C)；登记见 §19.10.C）。 | **禁止**把 ① 写成硬断言；**禁止**把 ② 钉死成某一个码 —— `chain` 只允许断言「等待有界」（`terminal_code_legal_set` / `terminal_code_in_legal_set` / `wait_bounded` / `clamped_to_le_10s`，逐字见 §19.10.C）。 |
| **14** | **「33 码全量往返闭合测试」读数**（v0.9 新增） | 脚本**已存在**（`backend-ts/scripts/p2c-00-code-roundtrip.ts`，`--assert` 模式、**输出 run-tagged**）；修前 run `MUJNM9EO`：`roundtrip_mismatches = 32`（共 33 码）/ `bucket_violations = 54` / `null_status_defect = 27` / `stale_unclassified_reason = 33`；修后 run `MUJO2B19`：**四项全 0**（五个子项全空）、`closed_set_size_ts = 33` / `closed_set_size_db = 33`、`httpStatusOf_probe = { LD031: 500, LD032: 500, LD033: 409 }`（**本册 `read_file` 自核 `.p2c-artifacts/*.json`**）。修后 `--assert` **exit 0** / `assertions_failed = []` **属转引**（`p2c-report-MUJNPUO4.md` §3.2）—— **本册未实跑该脚本**（本册纪律：**不连库**）。**覆盖面边界**：该脚本覆盖「33 码 × 往返 ↔ 桶一致性 ↔ TS/DB 桶对拍」，**不覆盖**「矩阵外输入形状的原始 SQLSTATE 逃逸」（后者见 **#12** 的逃逸扫描矩阵）。 | **不得**把本行读成「任何映射都已闭合」：它**只证 33 码这一对映射集**，且**修后读数未由本册亲测**（转引）。今后凡声称「双映射已闭合」，**必须附往返读数**（§14.3 v0.9 增补块 (B)）—— **只有正向读数者，一律读作「未闭合」**。完整读数表见 **§14.3 v0.9 增补块 (C)③④** 与 **§19.13.C**。 |
| **15** | **`benign_outcomes` 改判后的「代码侧待同步项」**（v0.9 新增 · **本轮未整改**） | §14.3 v0.9 (A) **把 `200` 判归单列一类 `benign_outcomes`、不参与 bucket 校验**；而**当前代码侧仍按 v0.9 之前的「最小扩展」把 `200` 标为 `input`**（本册自核三处：`migrations/0009` 的 `LD006` 桶分支 = `input`；`scripts/p2c-00-code-roundtrip.ts` 扩展表 `'200': 'input'`；`src/ledger-errors.ts` 的 `LEDGER_ERROR_BUCKETS` 里 `LEDGER_IDEMPOTENCY_REPLAY: 'input'` 及其注释）⇒ **规范（本册）与代码（三处）之间存在一处已登记的表述差异**（**不是**实现违规 —— 该口径是 v0.9 才改判的）。 | **不得**读成「本册未生效」或「实现违规」：**本册只写规范**（纪律：**只允许改 `docs/**`**）⇒ 代码侧须**另行发单**同步为「`200` ⇒ `benign_outcomes`、跳过四桶公式」。**同步前**，往返脚本对 `200` 的桶判定**不得当作规范判据**（以本册 §14.3 v0.9 (A) 为准）。见 §19.13.C 的「未随本册执行」项。 🔴 **v0.10 更正（本行的「待同步项」已收敛 —— 不再是「改桶取值」）**：§14.3 v0.10 (D) 写死「**`bucket` 字段保持 `input` 不变**，**只改校验**」⇒ ① **三处代码里的 `input` 取值全部正确、不要求改**（v0.9 的「同步为 `200 ⇒ benign_outcomes`」指令**作废**）；② **`0009` 不得再改**（已应用；改它会造成「撒谎态」）；③ 仍需另行发单的**只剩校验侧**：往返脚本 / 任何桶一致性断言**跳过 `200` 类**（另按 `benign_outcomes` 单列），以及 `LEDGER_ERROR_BUCKETS` 的**注释**措辞 ⇒ 见 §14.3 v0.10 (D) / §19.14.B。 |
|  | **（v0.4 附）未纳入的裁定留白** | `platform_withdraw`（R103 / §15 #3）、R15 分录双字段（§15 #1）、「强制下架罚款」若要做须新定 kind（§19.8.B）—— 三项**本次未动**。 | 与 §19.9.E 的「未纳入」清单一致 |

---

## §17 规则总索引 R1..Rn

本册共 **109 条规则**，编号连续覆盖 **R1–R109**，无缺号。〔**v0.12**：由 **R1–R108（108 条）→ R1–R109（109 条）** —— **只追加 `R109`、`R79` 就地扩写未换号**；v0.11 旧写法：「本册共 108 条规则，编号连续覆盖 R1–R108，无缺号。」〕

**§1 术语与记账符号冻结**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R1 | 本账本不使用「借方 / 贷方」会计术语，一律用减方 / 增方，避免与用户视角的「进出账」混淆。所有 kind 说明表必须用减方/增方列。 | 待拍板（命名，一句话可改） |
| R2 | `$` 为平台基础积分 / 系统币，唯一符号 = 字母 `S` + 竖划线，`currency.owner_uid = 0`，`cid = 1`（库内列名为 R22 规定的 s… | 已冻结（术语表）+ cid=1 为待拍板 |
| R3 | 「社区积分 / 自建单位」= `currency.owner_uid > 0` 的币种，符号由创建者自定义（如 `dashJ`），不是系统币的别名。 | 已冻结 |
| R4 | 「招工 / 打工」是唯一触发平台手续费与 10 级返佣的场景；其他任何 kind 都不得产生 `job_fee` / `commission`。 | 已冻结（D6）+ 术语表 |
| R5 | 账务层所有时间戳统一 `timestamptz`，由 DB `NOW()` 生成，不接受客户端传入时间作为记账依据。 | 待拍板（一句话可改） |

**§2 三张核心表数据契约**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R6 | `currency.cid` = `bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`。用 BY DEFAULT（不是 A… | 待拍板（一句话可改） |
| R7 | `currency.symbol` 全局唯一（`UNIQUE`），格式 `^[^\s]{1,16}$`（1–16 个非空白字符），比较区分大小写（`dashJ` ≠ `dash… | 待拍板（可改：改为大小写不敏感用 `UNIQUE (lower(symbol))`） |
| R8 | `currency.decimals` = `smallint NOT NULL DEFAULT 0`，取值 `0..18`。`decimals` 只用于展示与输入换算，绝不参… | 待拍板（上限 18 可改） |
| R9 | `currency.total_supply` = 已铸总量（由 `mint`/`burn` 在同一事务内维护的计数器），`>= 0`；`supply_cap` = 供给上限，… | 待拍板（用户币必须设上限这一点一句话可改） |
| R10 | `currency.status` 四态字符串枚举：`draft / listed / frozen / delisted`；`listed_at` 在首次进入 `listed… | 待拍板（状态名可在 P5 前改，但要一次改完） |
| R11 | `account` 主键 = `(uid, cid)` 复合主键，不设单独自增 id。`uid` `bigint NOT NULL`（真实用户 `> 0`，平台主体 `= 0`… | 待拍板（uid 用 bigint 而非 legacy `integer`，见 §16 未实测 #6） |
| R12 | `account.balance`（可用）与 `account.frozen`（冻结）都是 `bigint NOT NULL DEFAULT 0`，且必须 `CHECK >= … | 已冻结（D7 保证金=冻结 $ 可退） |
| R13 | `account.version` = `bigint NOT NULL DEFAULT 0`，乐观锁版本号。只有加分录的事务才能推进它；`UPDATE account SET… | 待拍板（可用可不用，一句话可改） |
| R14 | `ledger_entry` 没有 `time_updated`，也不允许出现任何「更新」语义字段（`status` / `is_deleted` / `voided` 一律禁… | 已冻结（append-only 铁律） |
| R15 | `ledger_entry` 同时持有 `delta`（可用余额变动） 与 `frozen_delta`（冻结余额变动） 两个金额列，允许其中任一为 0，但不允许同时为 0。 | 待拍板（这是本册最重要的扩展，一句话可改） |
| R16 | `ledger_entry.balance_after` 与 `frozen_after` = 该笔分录落账后该账户的可用/冻结余额快照，`NOT NULL` 且 `>= 0`… | 待拍板（`frozen_after` 为新增列） |
| R17 | `kind` 用 `text` + `CHECK (... IN (...))` 表达，不使用 PostgreSQL `ENUM` 类型。新增 kind = 一次可审计的 mi… | 待拍板（可改：用 `ledger_kind` 字典表 + FK，但会丢失「改 kind 必须走 migration」的强制力） |
| R18 | `ref_type` 与 `ref_id` 成对出现或成对为 NULL（`CHECK ((ref_type IS NULL) = (ref_id IS NULL))`）；`re… | 待拍板（白名单取值可增可改） |
| R19 | `idempotency_key` `text NOT NULL` + `UNIQUE`；`request_fingerprint` `text NULL`（存放请求体指纹，用… | 已冻结（master-plan §3.1「幂等：所有写接口必须带 idempotency_key」） |
| R20 | 冲正用 `reversal_of_txid`（自引用 FK）表达，且加部分唯一索引 `UNIQUE (reversal_of_txid) WHERE NOT NULL` ⇒ 一… | 待拍板（一句话可改） |
| R21 | 不对 `account.uid` / `ledger_entry.uid` 建 FK 到 legacy `"users"` 表：实测 `"users".uid` 是 `text…〔**v0.4 更正（D11）**：表名 `users`（`0006`）；列 `uid` 现为 `bigint`，见 §2.2 R21 正文〕〔**v0.8 范围限定**：只管**账本表**；**业务表可以 FK 到 `users(uid)`**（§5.20 #6，见 §2.2 R21 正文）〕 | 待拍板（可改：先不建 FK，仅保留应用层校验） |
| R22 | 三张新表统一 snake_case 无引号列名（`uid` / `cid` / `balance` / `frozen` / `delta` / `time_created`）… | 待拍板（一句话可改回 `"uID"` 风格） |

**§3 币种语义与生命周期状态机**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R23 | `mint` 的授权判定 = 「`currency.owner_uid` 与操作用户 `uid` 相等，或 `owner_uid = 0` 且调用方是平台受信任路径」。自建单位… | 待拍板（一句话可改） |
| R24 | `mint` 必须校验 `supply_cap`：`total_supply + n <= supply_cap`，超限拒绝（`LEDGER_SUPPLY_CAP_EXCEED… | 待拍板（一句话可改） |
| R25 | `burn` 只有持有人本人可发起，只能销毁自己 `balance` 中的币（不能销毁 `frozen` 里的）。`$` 的 `burn` 仅平台可发起。 | 待拍板（一句话可改） |
| R26 | `$` 的状态恒为 `listed`：migration 种子行写死，且服务层禁止把 `cid = 1` 改为 `frozen` / `delisted`。 | 待拍板（一句话可改） |
| R27 | 状态转移只允许 §3.2 表中列出的 5 条；其余组合（含 `delisted → *`、`listed → draft`）一律返回 `LEDGER_CURRENCY_INVA… | 待拍板（一句话可改） |
| R28 | 「状态 × 操作」矩阵（逐格判定，不允许实现自选）： `mint`（owner 铸币）：`draft`✅ `listed`✅ `frozen`❌ `delisted`❌ `tr… | 待拍板〔v0.2 补格：`hold_release` 四态全可、结算类与 `hold` 同档，见 §19.3〕 |
| R29 | `frozen` 是平台合规冻结（涉诈/违规调查），不是用户可自行触发的操作；解冻同样只能平台发起。冻结/解冻不产生任何账务分录（不动 balance/frozen，用户钱仍在… | 待拍板（一句话可改） |
| R30 | `delisted` 是终态：不可复活，如要恢复必须新建币种（新 `cid`，新 `symbol` 也不行，因为 `symbol` 仍被旧行占用）。因此下架时必须同时处理该币种… | 待拍板（一句话可改） |
| R31 | 〔**v0.2 已更正（见 §19.0）**：`listing_deposit` = 消耗不可退、入 `uid = −1`；`listing_deposit_refund` 已删除。**v0.3（P1c）补**：`listing_deposit_forfeit` 亦已删除、平台收入口径不含它，见 §19.8.B〕「上市收费」拆成两笔性质不同的动作，且都必须在下架时口径明确： ① `listing_deposit` = 冻结 `deposit_amount` 的 `$`（D7：可退 ⇒ … | 已裁定（Zang：保证金 = 消耗不可退） |

**§4 余额语义：balance / frozen 与三态记账**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R32 | 一切扣款（转账、购买、手续费、保证金、成交费）只能从 `balance` 扣；`frozen` 永不作为自动扣款来源。 | 已冻结（D7：手续费消耗不可退）〔保证金性质见 R31 v0.2〕 |
| R33 | `frozen` 的流动方向白名单：只能流向 ① 同账户 `balance`（`hold_release`）、② 同账户外的合法受款方（`job_payout` 给打工人 / … | 待拍板（一句话可改）〔v0.3（P1c）：白名单中删 `listing_deposit_forfeit`、改列 `hold_forfeit`，见 §4.3 R33 正文 / §19.8.B〕 |
| R34 | 冻结与解冻必须成对记账且都为同事务：`hold` 的分录与其 `hold_release`（或结算流出）之间不要求同一事务，但每一次单边变动都必须是完整的会计事件（一次 hol… | 待拍板（一句话可改） |
| R35 | 禁止隐式解冻：当用户可用余额不足时，系统不得自动动用 `frozen` 补足（例如「余额不够，自动解冻挂单的钱来付款」）。要动用冻结资金必须是显式的业务动作（撤单/解冻接口）。 | 待拍板（这是一条用户可感知的口径，一句话可改） |
| R36 | `account.frozen` 只是聚合投影，冻结的「归属」真源在业务表（挂单未成交量、招工托管额，v0.2 去 deposit_amount）。因此任何解冻都必须由… | 待拍板（本册第三条重要设计裁决） |
| R37 | 用户不能手动冻结自己的余额；`hold` 只能由业务事件触发（挂单、招工托管；v0.2 去「上市保证金」）。平台合规冻结走 §3 R29（`currency.status`），不冻结用户账户余… | 待拍板（一句话可改） |
| R38 | `hold_forfeit` 的减方可以是 `balance` 或 `frozen`（由业务决定），但去向恒为平台罚没账户 `uid = −3`，且必须在 `memo` 写明罚… | 待拍板（一句话可改） |
| R39 | 冻结不计息、不产生手续费、不跨币种：`hold` / `hold_release` 的 `(uid, cid)` 必须完全相同（同一账户同一币种），禁止出现「冻结 A 币、解冻… | 待拍板（一句话可改） |

**§5 ledger_entry.kind 全量枚举与借贷双方**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R40 | 上表 **20 个** `kind` 是关闭集〔**v0.3（P1c）：删 `listing_deposit_forfeit`**（落点 `backend-ts/migrations/0003_kind_close_set_20.sql`，见 §19.8.B）；v0.2 旧写法：21 个（删 `listing_deposit_refund`）〕。新增/删除 kind 必须走 migration（改 `ledger_kind_enum`）并同步在本册 §5.1 登记「减方/增方/净… | 已冻结（append-only + 可审计要求） |
| R41 | 配对不变式：一笔业务事件（同 `ref_type` + `ref_id` + 同一次提交）产生的全部分录必须满足 `Σ delta = 0` 且 `Σ frozen_delta… | 待拍板（一句话可改） |
| R42 | 禁止单边分录：除 `mint` / `burn`（对手方为「系统」）外，任何余额变动都必须同时写出减方与增方分录，不得只写一条带 `memo` 说明的行。 | 待拍板（一句话可改） |
| R43 | 交易所挂单冻结复用 `hold`（`ref_type = 'market_order'`），不新增 `market_hold` kind；商品/招工/保证金各自的冻结入口也统一… | 待拍板（可改为「每个业务模块各用自己的 hold kind」，一句话可改） |
| R44 | 招工结算的金额恒等式：`酬金 = net + fee`，其中 `fee = round_half_up(酬金 × 费率)`（整数运算，见 §8 R68），`net = 酬金 −… | 已冻结（D6）+ `fee=0` 处理为待拍板 |
| R45 | `commission` 只能从佣金池 `uid = −2` 流出；且对同一 `job` 事件：`Σ commission.amount == job_fee`（全额分配，平台… | 已冻结（D6）+ **v0.8 就地增补**（差额**不再留池**、由 **D13** 取代；**不建** `commission_payout` 表、`ref_id` = 同一 `job_id`，见 §5.2 v0.8 块） |
| R46 | 冲正 `reversal` 分录的 `delta`/`frozen_delta` 必须与被冲正分录逐列取反；若被冲正的是 `mint` / `burn`，还必须在同一事务内把 … | 待拍板（一句话可改） |
| R47 | `trade_fee` 的承担方 = taker（吃单方）；若撮合引擎无法区分 taker/maker（如批量清算），则买卖双方各承担 `round_half_up(f × 5… | 已冻结（D7 不可退）+ taker 归属待拍板 |

**§6 幂等键规则**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R48 | 幂等键作用域 = 全局唯一（`UNIQUE (idempotency_key)`），不是 `(uid, scope, key)` 复合作用域。理由：① 全局唯一让「重放检测」只… | 待拍板（本册第四条重要裁决，可改为 `(uid, key)` 复合唯一，但需同步改所有 dedupe 查询） |
| R49 | 键前缀（`biz:` / `cm:` / `cli:` / `ops:`）是强制的，`CHECK (idempotency_key ~ '^(biz | 待拍板（一句话可改）〔**v0.4**：键字符集收紧 —— 禁 `#`（`RESERVED_SEPARATOR`）/ 禁 C0·DEL（`CONTROL_CHARACTER`）；顺序固定 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`，且作用于**每一个** `idempotency_key` 位置（含 `entries[].idempotency_key`），TS 与 DB 同序同码，见 §6.2 v0.4 块 / §19.9.A〕 |
| R50 | 键必须由业务事实确定性派生，禁止使用 `randomUUID()` 直接当键（那只能防网络重试，防不住「用户连点两次提交」）。派生输入只允许不可变标识：业务单 id、uid、k… | 待拍板（一句话可改） |
| R51 | 幂等协议（并发安全，顺序固定）：① 事务内先执行带 `ON CONFLICT (idempotency_key) DO NOTHING` 的首条分录插入；② 返回 0 行 ⇒ … | 已冻结（master-plan §3.1 幂等要求）+ 协议细节待拍板〔v0.2 裁定：首条用原始键、第 i 条用 `<key>#<i>`，见 §19.5〕〔**v0.4**：实现为**单语句** `SELECT ledger_post_event($1::jsonb)`（**自带隐式事务**，应用层不再 `BEGIN…COMMIT`）；重放判定改按 `event_root_key` **精确归属**；派生分录撞唯一约束 ⇒ `LD024 reason=derived_key_collision`（**不得伪装 409**），见 §19.5 补注 / §19.9.A〕〔**v0.11**：加上「只读重放前置闸（`0012`）= 本条的重放**快路径**，不取代 `ON CONFLICT` 探针的**并发权威性**；`ON CONFLICT` 仍是写入侧的唯一权威」，见 §6.2 v0.11 块 / §19.15.A〕 |
| R52 | 重复提交的返回语义： ① 同键 且 `request_fingerprint` 相同 ⇒ `200 OK`，`{ idempotent_replay: true, txid, … | 待拍板〔v0.2 裁定：未传指纹 = 按重放（不 409）；路由层写路径强制传指纹，见 §19.6〕〔**v0.4**：重放/冲突判定**不再用字符串前缀「键族」匹配**，改为按事件根键精确归属（历史行按键精确等值兜底）；根行归属不符 ⇒ `409 + reason=KEY_OWNED_BY_ANOTHER_EVENT_ROOT`（绝不冒充重放），见 §6.2 v0.4 块 / §19.9.A〕〔**v0.11**：① 的**保证项**写死 = `idempotent_replay` / `txid` / 账上结果（分录与余额快照）；**`extra` 属诊断信息、非契约字段**（重放 `{}` 合规、早于 `0012`、**不开 `0013`**），见 §6.2 v0.11 块 / §19.15.A〕 |
| R53 | `request_fingerprint` = 对规范化请求体（键排序、去除空白、剔除 `Idempotency-Key` 与时间戳字段本身）取 `sha256` 十六进制。由… | 待拍板（一句话可改） |
| R54 | 幂等键不设 TTL、不在任何清理任务里删除（它就是流水唯一键，而流水 append-only）。所有内部/异步事件同样必须带键：分佣器（`cm:`）、对账修正（`ops:`）、… | 待拍板（一句话可改） |

**§7 事务边界**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R55 | 唯一允许执行写操作的驱动 = 支持交互式事务的连接池（`@neondatabase/serverless` 的 `Pool` over WebSocket，或 `pg`）。禁止… | 已冻结（D1） |
| R56 | 事务连接串使用 `DATABASE_URL_UNPOOLED`（直连）；只读单语句查询可用 `DATABASE_URL`（pooler）。理由：Neon 的 pooler 是 … | 待拍板（可改为「全走 pooler」，但需先实测 advisory lock 可用性） |
| R57 | 事务粒度 = 一个业务事件一个事务。禁止在一个事务里合并两个不相关的业务事件（例如「转账 + 顺手发一笔佣金」）；也禁止把一个业务事件拆成两个事务。 | 待拍板（一句话可改） |
| R58 | 严禁「先扣钱、后落流水」的异步形态：不得把分录写入、`account` 更新、`total_supply` 调整放到队列/定时任务/第二个事务里。若业务需要异步（如分佣计算量大… | 待拍板（一句话可改，但改动必须回写本册） |
| R59 | 事务内禁止任何外部 IO：HTTP 请求、邮件、链上交互、日志外发、S3 上传、`fetch` 到第三方。这些动作只能在提交成功后执行；若提交失败则不得执行。 | 待拍板（一句话可改） |
| R60 | 死锁 / 序列化失败重试：最多 3 次，指数退避（如 50ms / 200ms / 800ms），仍失败返回 `503 LEDGER_DEADLOCK_RETRY_EXHAUS… | 待拍板（次数与退避可改）〔**v0.4**：TS `RETRYABLE_SQLSTATES` **必须**含 `'LD027'`（DB 自 `0005` 起把 `40001`/`40P01` 归一后抛 `LD027`；不同步 = 死锁不再重试 = R60 形同失效）；**DB 层 0 次重试**、DETAIL `retries_performed=0 / retry_owner=caller`，见 §7.3 v0.4 块 / §19.9.A〕 |
| R61 | 隔离级别 = `READ COMMITTED`（Neon 默认）+ 显式行锁。不使用 `SERIALIZABLE`（代价高、Neon 上重试成本大）。 | 待拍板（一句话可改） |
| R62 | 撮合必须串行化：同一 `(base_cid, quote_cid)` 币对的撮合在同一时刻只允许一个写者。手段优先级：① `pg_advisory_xact_lock(hash… | 待拍板（一句话可改） |
| R63 | 禁止跨事务的「检查-使用」：所有余额校验必须在扣款所在的那个事务内、且在取得 `FOR UPDATE` 行锁之后执行。禁止在路由层先查一次余额「预校验」再进事务扣款（预校验只能… | 待拍板（一句话可改） |
| R64 | 事务不得长：单事务内涉及的分录条数上限建议 ≤ 32 条、涉及账户数上限建议 ≤ 16 个（招工结算 10 级佣金 = 10 受益 + 3 主体 = 13，安全余量内）。超限的… | 待拍板（上限值可改） |
| R65 | 「扣了钱没落流水」是最高优先级缺陷：任何 `UPDATE account` 必须与对应 `ledger_entry` 插入在同一事务内，且 §9 的 DB 层 trigger … | 待拍板（但强烈建议保留） |
| R109 | **业务编排函数的原子性与幂等口径（🆕 v0.12 新增）**：① 业务行 + 分录**必须**同一事务（由编排函数保证；**函数内禁任何 DDL**、编排函数**只由迁移创建**）；② 幂等**必须**与 `R51`/`R52` 一致（同键同指纹 ⇒ `200` 重放、**不**重写业务行；异指纹 ⇒ `409`；无键 ⇒ `400`）；③ **必须**把 `ref_id` 落账本引用列（并回写业务行的引用列）；④ 业务级幂等另需业务表侧键 **`create_key`**（指针 `docs/data-layer.spec.md` C8）。**不变项**：`ledger_post_event` 函数体不改、R51/R52 语义不变 | **已拍板（Zang · C1 终审，2026-09-28）** |

**§8 金额表示与 decimals**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R66 | 金额列一律 `bigint`（最小单位整数）。`delta` / `frozen_delta` / `balance` / `frozen` / `total_supply` … | 待拍板（可改：用 `numeric(38,0)`，代价是驱动需按字符串解析且索引更大） |
| R67 | 禁止出现 `real` / `double precision` / `float` / `numeric(p,s)` 且 `s <> 0` 的金额列。DDL 评审必须逐列确认… | 已冻结（「禁止浮点」为硬要求） |
| R68 | 取整规则（全整数运算，禁浮点）： `fee = floor_half_up(numerator, denominator) = (a * b + denominator / 2… | 已冻结（D6 费率）+ 取整方向待拍板 |
| R69 | `decimals` 只用于：① 用户输入解析；② 展示格式化；③ 交易所价格/数量的显示位数。禁止用它做任何存储层计算、参与比较、或作为除法因子出现在 SQL 里。 | 待拍板（一句话可改） |
| R70 | 驱动与序列化口径：DB 驱动返回的 `bigint` 必须按字符串或 `BigInt` 处理，禁止转 `Number`；API 出参的金额字段必须是十进制字符串（`"10000… | 待拍板（可改：用 `Number` 并在金额上限内 —— 本册不建议）〔**v0.4**：payload 的金额字段**恰一个**（见 R72 v0.4 块）；身份字段（`uid`/`cid`/`ref_id`）与 `memo` 只接受 JSON 字符串 ⇒ 非字符串 `400 + reason=NOT_STRING`〕 |
| R71 | 溢出与上限口径：单笔金额上限由 `app_config` 配置（建议 `1e15` 最小单位，远低于 `bigint` 上限）；`a * b` 类乘法中间量可能超出 `bigi… | 待拍板（上限值可改） |
| R72 | 金额入参校验（进入服务层之前）：① 必须是字符串或整数，不接受 `1.5` 这类浮点 JSON number（会被拒，而不是被四舍五入）；② 必须 `> 0`（除 `delta… | 待拍板（一句话可改）〔**v0.4**：`amount`（用户十进制）与 `amount_units`（最小单位）**二选一** —— 同时出现 ⇒ `400 AMBIGUOUS_AMOUNT`（**绝不静默挑一个**）；`amount` 单给时**显式封死指数形式** ⇒ `400 EXPONENT_NOT_ALLOWED`；单笔上限**两条路径都过闸**，见 §8.3 v0.4 块 / §19.9.A〕 |

**§9 append-only 不可变约束**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R73 | `ledger_entry` 不可变性以触发器为强制手段（不是以权限为强制手段）。任何「为了修数据方便」而临时禁用该 trigger 的操作都视为违规变更，必须在变更记录里显式… | 已冻结（append-only 铁律） |
| R74 | 写入顺序固定为「先插 `ledger_entry`，后更新 `account`」，且 `account` 的 `balance` / `frozen` 必须逐列等于该账户最新分… | 待拍板（本册第五条重要裁决；可改为「用流水重算触发校验」，代价更高） |
| R75 | 开户必须 0/0：`account` 首次 `INSERT` 时 `balance = 0 AND frozen = 0`，初始余额只能由随后的 `mint` / `trans… | 待拍板（一句话可改） |
| R76 | 纠错唯一路径 = `reversal` 冲正：① 必须写清原因码（`memo`）；② 一条分录最多被冲正一次（R20 部分唯一索引）；③ 冲正分录本身不得再被冲正（应用层 + … | 待拍板（一句话可改） |
| R77 | 禁止破坏性 migration：对 `ledger_entry` 不得 `TRUNCATE`、不得批量 `UPDATE`、不得 `DROP COLUMN`（加列可，删列须走「先… | 待拍板（一句话可改） |
| R78 | 不可变性取证口径（每次涉及流水的 migration/运维后必做）：① 记录 `ledger_entry` 行数、`max(txid)`、`sum(delta)` 按 `cid… | 待拍板（一句话可改） |

**§10 并发规则与负余额禁令**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R79 | 加锁全序强制（§10.1）。**🆕 v0.12 扩写并拍板**：全序 = **业务行（若该事务涉及，按主键升序） → `currency`（`cid` 升序） → `account`（`uid` 升序）**；**禁止**「先锁 `account` 再锁业务行」（成环 ⇒ 死锁）；**编排函数（`job_post_event` 等）必须在调 `ledger_post_event` 前持有业务行锁**；**`lockAccounts(sortedUids, cid)` 由「建议」升为强制**（唯一允许的加锁入口、只接受已排序数组） | **已拍板（Zang · C1 终审，2026-09-28）**〔📌 **v0.11 旧写法（原文照录）**：「加锁全序强制（§10.1）。任何事务在取第二把锁之前必须先确认它是全序中的后位；违反全序的写法（如按「用户传入顺序」遍历扣款）必须重写。」／状态：「待拍板（本册第六条重要裁决，一句话可改）」。⚠️ **旧口径只管 `currency → account`、**未涵盖业务行** ⇒ 完整旧写法同地留痕见 §10.1 v0.12 块 / §10.3 R79 行 / §19.16.A**〕 |
| R80 | 负余额禁令：`CHECK (balance >= 0)` / `CHECK (frozen >= 0)` / `CHECK (balance_after >= 0)` / `C… | 已冻结（P1 AC：负余额必须不可能出现） |
| R81 | 乐观锁 `account.version` 的使用边界：只在「单账户、单分录、无跨账户搬运」的轻量写路径使用（如 `mint` / `burn` / `hold` / `hol… | 已裁定（Zang · v0.2：全部 `FOR UPDATE`，`version` 列保留仅作审计，见 §19.4） |
| R82 | 锁等待与语句超时：必须设置 `lock_timeout`（建议 3s）与 `statement_timeout`（建议 10s），超时分别映射为 `503 LEDGER_LOC… | 待拍板（时长可改）〔v0.3（P1c）：驱动级 / 非 PG 连接错误借用 `503 LEDGER_TX_TIMEOUT` + `details.reason`，见 §14.1 #27 / §14.3 / §14.4 / §19.8.C〕〔**v0.4 口径改写**：删除「函数内 `set_config(statement_timeout,…)` 生效」这一**实测无效**的声明 ⇒ 改为**函数内自证预算**（预算 10s、等锁前 `lock_timeout := min(3000, 剩余)`、越界 ⇒ `LD026 reason=statement_budget_exhausted`）；`57014` **不可能**由函数内处理器转码（`statement_timeout` 绕过 plpgsql `EXCEPTION`）；上限是**语句级**、**不是**端到端 —— 见 §11.2 R82 v0.4 块 / §19.9.B / §16 #6 #7〕 |
| R83 | 并发 `mint` / `burn` / 状态变更必须先锁 `currency` 行（`SELECT ... FOR UPDATE`），再动 `account`，顺序不可颠倒（… | 待拍板（一句话可改） |
| R84 | 挂单的「撤销」与「成交」必须争抢同一把 `market_order` 行锁，且锁后必须复查 `status` 与 `volume_filled`（不能信任锁前读到的值）。 | 待拍板（一句话可改） |
| R85 | 并发验收清单（P1 AC 直引）：① 同一账户 100 并发转账后总额守恒；② 同一幂等键 100 并发提交只生效一次；③ 并发扣款不会出现负余额（余额 100，100 笔各扣… | 已冻结（P1 AC）+ 条目 ③④⑤ 为待拍板补充 |
| R86 | 禁止用应用层/外部分布式锁替代 DB 事务与行锁（Redis 锁、进程内 mutex、「单实例部署所以不会并发」的假设）。所有正确性保证必须落在「DB 事务 + 行锁 + 唯一… | 待拍板（但强烈建议冻结） |

**§11 对账判据与判负能力**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R87 | 上表 9 条判据全部必须实现，缺一条即视为对账功能未交付。判据 5 因依赖业务表，允许在 P1 阶段实现为「占位 + 显式标注未启用」，但必须在 P3 首个业务模块落地时补齐（… | 已冻结（P1 AC：对账脚本）+ 判据 5 补齐时点为待拍板 |
| R88 | 脚本退出码与输出契约：`0` = 全部判据通过；`1` = 存在不一致（差异清单已输出）；`2` = 脚本自身错误（连不上库、SQL 报错）。输出必须同时具备：① 机读 JSO… | 待拍板（退出码约定可改，但必须固定且写进文档） |
| R89 | 判负能力（本册对 P1 AC 的直接承接）：判据必须被证明「能判负」——做法为注入-还原演练，对每一条判据至少一个注入用例，且每条注入都必须能被对应判据报出： 判据 1 ← 插… | 已冻结（P1 AC：对账脚本在人为注入脏数据时能报错） |
| R90 | 注入方式优先序：首选「插入孤儿分录」（不更新 `account`）与「改 `currency.total_supply`」——这两类不受 `trg_account_guard`… | 待拍板（强烈建议按此口径） |
| R91 | 对账脚本禁止自动改数（no auto-fix）。发现不一致时只能：① 报警 + 落盘差异清单；② 由人工决策后走 `reversal` 冲正（`ops:` 幂等键 + 操作人留… | 待拍板（一句话可改） |
| R92 | 运行频率与留痕：① 上线前必须跑一次全量并归档；② 每日定时跑一次（P1 起即可用 cron / 后台按钮触发）；③ 任何涉及流水的 migration / 运维操作前后各跑一… | 待拍板（频率可改） |
| R93 | 判负能力同样适用于并发与幂等用例（不止对账）：§10 R85 的五条并发用例、§6 R51 的幂等协议，都必须各有「能让它变红的对照」——例如把 `FOR UPDATE` 去掉… | 待拍板（强烈建议按此口径） |

**§12 索引清单**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R94 | §12.1 的 11 个索引为必建；其中 `ledger_idem_uniq` 与 `idx_ledger_uid_cid_txid` 是性能关键路径，缺失会导致幂等探测退化为… | 待拍板（清单可增，不可减） |
| R95 | 流水分页必须用 keyset 分页：`WHERE uid=$1 AND cid=$2 AND txid < $last_txid ORDER BY txid DESC LIMI… | 待拍板（一句话可改） |
| R96 | `ledger_entry` 是热写表，二级索引数量上限建议 ≤ 6 个（v0.4 起 **当前 6 个** = 原 5 个 + `idx_ledger_event_root_key`）。新增索引必须说明「为什么现有索引不能覆盖」，并评估写放大。 | 待拍板（上限可改）〔**v0.4**：本次新增 `idx_ledger_event_root_key` 已用尽上限，理由 = 「重放判定改按 `event_root_key` 精确等值，原前缀算术无索引可用」，见 §12.1 / §19.9.A〕 |
| R97 | 对账查询的执行口径：① 判据 1/2 的聚合必须能走 `idx_ledger_uid_cid_txid`（按 `(uid, cid)` 分组，禁止 `GROUP BY (uid… | 待拍板（本册第七条重要裁决） |

**§13 平台账户建模**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R98 | 保留 uid 区间 = `0` 与 `−1 … −99`；真实用户 uid 必须 `> 0`。任何创建 uid ≤ 0 用户的路径都必须被拒绝（`LEDGER_RESERVED… | 待拍板（区间可改，语义不可改） |
| R99 | 平台账户的 `account` 行必须由 migration 种子创建（`balance = 0, frozen = 0`，满足 R75 的开户 0/0 约束），不得依赖运行期… | 待拍板（一句话可改） |
| R100 | 用户请求不得命中平台账户：路由/服务层必须校验「调用方 uid 与请求涉及的 uid」均 `> 0`（除平台受信任路径外）。例如 `/transfer` 不允许 `to_uid… | 待拍板（强烈建议冻结） |
| R101 | 平台账户的允许 kind 白名单：`−1` 只接受 `trade_fee` / `listing_fee` / `currency_create_fee`（增方）与运维提取（待… | 待拍板〔v0.2 裁定：仅 uid `−3`（罚没池）允许以 `transfer` 出账，其余平台账户从严，见 §19.1；v0.3（P1c）：`−3` 白名单删 `listing_deposit_forfeit`，见 §19.8.B〕；**v0.13：`−1` 增方白名单追加 `listing_deposit`**（Zang §5.81 勘误；DB 侧 `0019` **已落盘并已应用** · FIX-A），见 §19.17 |
| R102 | 平台账户不得透支（`balance >= 0` 同样适用，判据 9）：若某笔 `commission` 需要从 `−2` 支出而池子不足 ⇒ 说明整个事务的中止逻辑有缺陷，必须… | 待拍板（强烈建议冻结） |
| R103 | 「平台运维提取」（把 `−1` 的钱转出平台）当前 kind 集不覆盖：现有 **20 个** kind（v0.3（P1c）删 `listing_deposit_forfeit`，见 §19.8.B；v0.1 旧写法：22 个） 里没有任何一个表示「平台账户 → 外部/运维」。因此：① 在补 kind 之前… | 待拍板（需 Kevin 拍板是否需要提取动作） |

**§14 统一错误码清单**

| 编号 | 口径摘要 | 状态 |
|---|---|---|
| R104 | 错误码有唯一来源：`backend-ts/src/ledger/errors.ts`（建议名，常量表 + 中文文案 + i18n key）。禁止在业务代码里手写中文字符串或裸 … | 已冻结（D4）+ 落点待拍板 |
| R105 | HTTP 语义映射：`400` = 请求不合法（格式/参数）；`403` = 权限不足；`404` = 目标不存在；`409` = 状态冲突/业务拒绝（余额不足、币种状态、幂等… | 待拍板（一句话可改） |
| R106 | 幂等重放不是错误：`LEDGER_IDEMPOTENCY_REPLAY` 必须以 `200` + `idempotent_replay: true` 返回，前端按成功处理。它虽… | 待拍板（建议冻结） |
| R107 | 统一错误响应结构：`{ "error": { "code": "LEDGER_XXX", "message": "中文文案", "i18n_key": "ledger.err.… | 待拍板（结构可改，但必须唯一） |
| R108 | `500` 类错误（#29 / #30 / #31 / #32）必须触发告警（日志 `error` 级 + 计数指标 + 可选通知），因为它们只代表代码缺陷，不可能是用户输入造… | 待拍板（建议冻结） |

> **🆕 v0.15 索引注（`kind` 23 → 24 · Zang 终审 `R-9-65`/`R-9-66`）**：本索引 **§5 的 `R40` 行**（「上表 **20 个** `kind` 是关闭集」）、**§13 的 `R101` / `R103` 行**均为**旧写法、保留留痕** —— **现行 `kind` 关闭集 = 24**（末位追加 `invite_first_task_reward`；**`R40` 行不改、以 §5.1 v0.15 加注块为准**）；**`R101`**：`−1` `credit` 8 值不变、**`debit` 首开仅 1 项 `invite_first_task_reward`**；**`R103`**：**运维提取留白不变**（与「需求 §6.2② 明文授权的发放」**不同层级**）。详见 §5.1 / §13.3 v0.15 块 + §19.18。

---

## §18 变更记录

| 版本 | 日期 | 变更 | 变更人 |
|---|---|---|---|
| v0.1 | 2026-09-27 | 首版骨架落盘（章节目录 + §0–§18 占位），随即逐节填充：§0 范围与阅读约定、§1 术语、§2 三表契约（含 DDL）、§3 币种状态机、§4 三态记账、§5 kind 全量枚举（22 个）、§6 幂等、§7 事务边界（15 类操作）、§8 金额表示、§9 append-only 与 DB 守卫、§10 并发、§11 对账判据（9 条）+ 判负能力、§12 索引（11 个）、§13 平台账户（保留 uid）、§14 错误码（33 个）、§15 待拍板（20 条）、§16 未实测（5 条）、§17 规则总索引（R1–R108）。 | Jing |
| v0.2 | 2026-09-27 | **Zang「P1a 收口」版**（快照：`docs/versions/ledger.spec.v0.1.md`，md5 `ef7a9a2633d36b2db0d2b43705372df6`，962 行 / 131972 字节；本版 md5 / 行数 / 字节数见交付报告）。落位：① 上市保证金「冻结可退」→「**消耗不可退**」（依据 Kevin 原文；`listing_deposit_refund` 删除、kind 关闭集 22 → 21；留痕见 §3.1 R31 / §3.2 / §5.1 / §5.2 / §2.1 DDL / §4.3 / §7.2 / §11 / §13 / §15 #2），总述见 §19.0；② §11 判据 8 正式形状改为 `Σ(delta + frozen_delta) = 0`，并写明字面式为何不成立（同源更正 R41 与 §5.1 `trade` 注），见 §19.2；③ §14 新增 §14.3（错误码借用映射表）与 §14.4（R107 要求的 `details` 形状表，自 `backend-ts/src/ledger.ts` 文件头**只读**回写）。另登记 5 条已裁定口径于 §19：R101×R38 的 `−3` `transfer` 例外、R28 补 `hold_release`/结算类、R51 幂等派生键 `<key>#<i>`、R81 全部 `FOR UPDATE`、R52② 指纹策略。**规则总数不变（R1–R108，108 条）**。〔**v0.3 后续（留痕）**：本行「kind 关闭集 **22 → 21**」为该版当时口径；v0.3（P1c）再删 `listing_deposit_forfeit` ⇒ 关闭集 **21 → 20**，见下行 v0.3 与 §19.8〕 | Jing |
| v0.3 | 2026-09-27 | **Zang「P1c 收口」版**（改前快照：`docs/versions/ledger.spec.v0.2.md`，md5 `1a63a2f4e84ec199b463c536c3911cda`，1071 行 / 156707 字节；本版 md5 / 行数 / 字节数见交付报告）。落位：① **kind 关闭集 21 → 20**（删 `listing_deposit_forfeit`，Zang 裁定见 §19.8.B；DB 落点 `backend-ts/migrations/0003_kind_close_set_20.sql`；留痕见 §5.1 标题/行号说明/#21 行、§5.2 R40、§2.1 DDL、§3.2 转移表、§3.1 R31、§4.3 R33、§7.2 #14、§11 判据 7、§13.2 `−3` 行、§13.3 R101/R103、§15 #2、§17 索引）；② **非 PG 错误归类**（§14.1 #27 触发条件扩写、§14.3 新增「驱动级 / 非 PG 错误」行、§14.4 为 `LEDGER_TX_TIMEOUT` 与 `LEDGER_TRANSACTION_REQUIRED` 各单列 `details` 形状、§11.2 R82 互引；Zang 裁定见 §19.8.C）；③ **事实更正**：`ledger_kind_enum` 是 `kind`（`text`）上的 **CHECK 约束**、**非** enum 类型（§2.1 加实测取证块；删 kind 手段 = `DROP CONSTRAINT` + `ADD CONSTRAINT`，见 §19.8.A）。**规则总数不变（R1–R108，108 条）**；章节编号未重排（P1c 内容一律向后追加为 §19.8）。 | Jing |
| v0.4 | 2026-09-27 | **Zang「P1e/P1i/F3 收口 + P1g 改名」版**（改前快照：`docs/versions/ledger.spec.v0.3.md`，md5 `6b0a852ce73c748f4db178a52c7dceb8`，1129 行 / 175122 字节；本版 md5 / 行数 / 字节数见交付报告）。背景：P1e 独立质检**判定不通过**（3 条真缺陷）⇒ 修三缺陷 ⇒ 复验通过。落位（§11 S1–S12 逐条 + P1g §8/§9）：① **键字符集收紧**（§6.2 v0.4 块：禁 `#` / 控制字符、顺序固定、覆盖每一个 `idempotency_key` 位置；§17 R49）；② **重放语义改写**（§2.1 增列 `event_root_key` + 索引 + 守卫 CHECK、§12.1 索引 11→12、§6.2 R51/R52）；③ **R60 + `LD027`**（§7.3 v0.4 块、§14.1 #28、§17 R60）；④ **金额二选一 / 指数形式**（§8.3 v0.4 块、§17 R70/R72）；⑤ **R82 口径改写**（§10.3 v0.4 块：自证预算替代失效的 `set_config`、`57014` 不可由处理器接住、上限为语句级）；⑥ **§11 判据 8 键族口径**（§11.1 v0.4 块：改按 `event_root_key` 归组、历史行回退 `split_part`、两口径均归零）；⑦ **§14 系列**（§14.1 #25–#28扩写、§14.3 `uid`/`cid` 形状非法 **404→400** 更正 + 新增 §14.3 附（`LD025/026/027` 映射、bucket 纪律冻结、五类 reason 枚举）、§14.4 三条单列形状）；⑧ **§19.5 补注**（单语句 `SELECT ledger_post_event` = 隐式事务，应用层不再 `BEGIN…COMMIT`）；⑨ **改名（D11）落位**（§0.2、§13.2、§13.3 R98、§15 #8、§16 #5 与 §17 R21：旧写法 `user.uID` → `users.uid`；建表语句现由 `migrations/0002_user_identity.sql` 提供）；⑩ **§16 未实测补 6 项**（#6–#11：端到端 10s 未实现、`57014` 转码路径不存在、池化连接级超时不可用、持锁链规模有限、判据归零覆盖面有限、改名端到端未复测 + 保留字陷阱未消除）。并新增 **§19.9**（P1f 收口登记 A–F，含「**发现的不一致**」6 条）。**规则总数不变（R1–R108，108 条）**；章节编号未重排（P1f/P1g 内容一律追加为 §19.9）。 | Jing |
| v0.5 | 2026-09-27 | **Zang「§14.3 参数分类口径枚举修正 + 歧义事故留痕」版**（改前快照：`docs/versions/ledger.spec.v0.4.md`，md5 `6dddb6e7c88abbe86f615d739a031b74`，1358 行 / 238701 字节；本版 md5 / 行数 / 字节数见交付报告）。**本版只修一处歧义，不扩大范围**。**歧义事故（留痕，非苛责）**：v0.4 的 §14.3 表已裁定「形状非法 = 参数校验失败 = `400`；形状合法但不存在 = `404`」，但**该表未枚举 `cid <= 0`（与负数）算哪一类** ⇒ 下游据该未枚举处读成「`cid<=0` = 形状非法 ⇒ `400`」⇒ **Zang 据此发单要求实现方把 TS 侧 `toCid` 由 `404` 改成 `400`**（实现侧已按单改动，`backend-ts/src/ledger.ts` 的 `toCid` 现抛 `400 LEDGER_AMOUNT_NOT_POSITIVE`）—— **而 DB 侧 `ledger_cid_arg('0')` / `('-5')` 一直是 `LD007 / LEDGER_CURRENCY_NOT_FOUND / 404`**（`backend-ts/.p1f-artifacts/p1n-tocid-shape-before.json` run `I0AUQ` 与 `-after.json` run `I5JZU` **两轮读数一字未变**）⇒ **改之前两侧本来就一致；不是既有缺陷，而是这一改动人为造出了一处两侧不一致**（另一层根因：TS 修后对齐的是 **DB 金额原语** `ledger_parse_user_amount`（`LD017` / `400`），而非 **`cid` 参数原语** `ledger_cid_arg`（`LD007` / `404`））。**Zang 重新裁定**：**`cid <= 0` 与负数 = 形状合法但不存在 ⇒ `404`**（依据：`currency.cid` 是**正整数序列**，非正值构造上不存在）。**落位（三处）**：① **§14.3 就地新增「v0.5 枚举」块**（三类互斥且穷尽：**① 形状非法**（非十进制整数 / 空 / 超 `bigint` / 缺失）⇒ `400 LEDGER_AMOUNT_INVALID` + `details.reason ∈ { NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING }` + `details.field`；**② 形状合法但该行不存在** ⇒ `404`（`LEDGER_CURRENCY_NOT_FOUND` / `LEDGER_ACCOUNT_NOT_FOUND`）；**③ `cid <= 0` 与负数归 ②** ⇒ `404`，**不是 `400`**），并写明 **`LEDGER_AMOUNT_INVALID` 是历史码名、被兼用作「参数形状非法」码、靠 `details.field` 区分字段、不新增错误码（§14.1 的 33 个关闭集不动）**、判定顺序「先形状闸后存在性」、形状闸**不做 `> 0` 判定**、`uid` 侧同口径（保留区间 uid 的 `LEDGER_RESERVED_UID` 是 R98 业务守卫、与形状闸正交）；同表两行（`cid` 留痕行 + 「形状合法但目标不存在」行）**就地改写并互指本块，原歧义归零**。② **同处附「§14.3 v0.5 实测对拍表」**（真源 `p1n-tocid-shape-before.json` / `-after.json` 逐条自核：`ledger_cid_arg('0')`/`('-5')` = `LD007`/`404`；`('abc')` = `LD016`/`400`/`reason=NOT_DECIMAL_INTEGER`；TS 修前 `404` ↔ 修后 `400 NOT_POSITIVE`；`getCurrency('999999999999')` 不抛、`transfer` 同参 `404`；**真源中不存在的用例（`''`、DB 侧 `'999999999999'`）标「未核对」，不补造读数**）。③ **§19.9.F 第 6 条追加 v0.5 留痕**（v0.4 的「TS 待收敛到 `400`」已被重新裁定**反转** ⇒ 现应为「TS 收敛回 `404`」；原文保留不重写）。**规则总数不变（R1–R108，108 条）**；**章节编号未重排**（本版**不新增章节、不新增错误码**）。 | Jing |
| v0.6 | 2026-09-27 | **Zang「四项小修登记」版**（改前快照：`docs/versions/ledger.spec.v0.5.md`，md5 `8c53263e874276a7c8206c7d227c1a4b`，1395 行 / 254774 字节；本版 md5 / 行数 / 字节数见交付报告）。**四项都是小修，不扩大范围**。① **`toCid` 现状翻转（事一）**：v0.5 时点写的「现状 = `400 LEDGER_AMOUNT_NOT_POSITIVE`、**待收敛回 `404`**」**已过时** ⇒ **现为「已收敛回 `404`」**：`backend-ts/src/ledger.ts` 的 `toCid` = **`LEDGER_CURRENCY_NOT_FOUND` / `404` / `details = { cid }`**，与 DB 侧 `ledger_cid_arg` **逐字一致**（**本册 `read_file` 自核代码**，非转抄）；三段并列读数 `p1n-tocid-shape-before.json`（run `I0AUQ`）/ `p1n-tocid-shape-after.json`（run `I5JZU`）/ `p1n-tocid-shape-revert-IE4VH.json`（run `IE4VH`）+ **TS/DB 对拍表**就地附于 §19.9.F 第 6 条 **v0.6 更正块**；**v0.4→v0.5 的历史叙述一字不改**（只把「现状」那一句标为已过时并翻转）。② **新登记读路径超 `bigint` 逃逸缺陷与裁定（事二）**：`getCurrency('99999999999999999999999')` ⇒ **未映射的原始 PG SQLSTATE `22003` 逃到调用方**（`status = undefined` / `mapped = false`）= 本项目**硬口径**（§14.1 的 **33 码关闭集** + `bucket ↔ 状态类` 映射：不得出现无法归类的错误 / 未映射原始 SQLSTATE）的**回归**，属**写路径已灭、读路径漏网**的 **D-02 那一类**；**裁定**：超 `bigint` ⇒ **`400 LEDGER_AMOUNT_INVALID` + `reason = OUT_OF_BIGINT_RANGE`**（与写路径同族，**不新增码**），`cid <= 0` / 负数仍 ⇒ `404`；**要求**：**按类修**（枚举**所有**接收外部 `cid` / `uid` / 金额的入口点，**碰 PG 前设闸**）＋ **新增「逃逸扫描」取证脚本**（矩阵 = 入口点 × 输入形状；断言 `raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0`；**run-tagged、永不写固定文件名**）；**只写裁定与要求、不转抄实现方读数** ⇒ 落位 §14.3 **v0.6 增补块 (A)** + §16 **#12**（修后读数待回填）。③ **登记两道「不是确定性判据」的读数（事三）**：`p1f-acceptance.md` §7.3 子探针 `lock_timeout_lockwait_raw_55P03_when_no_handler` **跳运行不稳定**（`false` / `true` 各一轮）、`chain` 用例**终局码两个合法值**（`LD025` / `LD026`）⇒ **断言只针对「等待有界」，不得当硬判据、不得钉死某个码** ⇒ 落位 §14.3 **v0.6 增补块 (C)** + §16 **#13** + §19.10.C。④ **`reason` 名对齐（事四）**：TS 侧 `cid` **缺失**由 `BAD_TYPE` **对齐为 `MISSING`**（DB 侧同场景 = `MISSING`）、**非字符串类型用 `NOT_STRING`**，两侧皆 `400` `LEDGER_AMOUNT_INVALID`、**状态类不变** ⇒ 落位 §14.3 **v0.6 增补块 (B)** + §19.10.D。**规则总数不变（R1–R108，108 条）**；**章节编号未重排、未新增错误码**（§19.10 按「新增一律向后追加」纪律追加；§14.3 / §16 / §18 / §19.9.F 只就地增补）。 | Jing |
| v0.7 | 2026-09-27 | **Zang「四项小修 · 读数回填 + 口径更正 + 纪律与登记」版**（改前快照：`docs/versions/ledger.spec.v0.6.md`，md5 `5aeed3cba7a01bf6638b678fec314d11`，1491 行 / 280206 字节；本版 md5 / 行数 / 字节数见交付报告）。**四项都是小修，不扩大范围**。① **回填 §16 #12（事一）**：修后逃逸扫描读数（真源 `p1o-00-escape-sweep-after-MUJJ2PHX.json` run `MUJJ2PHX`；修前终版 `p1o-00-escape-sweep-before-MUJJBPT2.json` run `MUJJBPT2`；**本册自核**）：修后 `raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0` / `expectation_mismatches = 0` / `valid_shape_false_reject = 0`、**604 格**（590 实跑 + 14 纪律跳过）、`ledger_entry` **166 → 166**（一行未写）；修前 **33 格**（`22003` ×30 / `22P02` ×2 / `23503` ×1）、`unmapped` 33、`expectation_mismatches` 154。同处登记**「按类修」方法论事实**：**17 个入口点**枚举、**闸位全部前移碰 PG 之前**、**唯一共用形状闸 `toAmount`**、修前基线由**同一份终版脚本**产出（**临时 checkout HEAD → 跑 → 还原并核 md5**；本册自核 `backend-ts/src/ledger.ts` md5 `9456b5cb72a3a42dd3de26069429ee67`）。落位：§14.3 v0.6 增补块 (A) **⑤⑥ 回填块** + §16 **#12**。② **更正 §14.3 (B) 的「数字」口径（事二 · Zang 裁定）**：「非字符串类型（**数字** / 对象 / 布尔等）用 `NOT_STRING`」**括号里的「数字」不符实现且不应改** ⇒ 更正为 **JSON number 形式的 `cid` / `uid`（含 `0` 与负数）是合法形状**（**数字是 JSON 里标识符的自然表示，不是类型错误**）⇒ 存在性判定 ⇒ **`404 LEDGER_CURRENCY_NOT_FOUND`**；只有**非十进制字符串**与**非数字类型（对象 / 布尔 / 数组）**才 `NOT_STRING` / `400`（附四条裁定理由 + v0.6 旧写法留痕）。落位：§14.3 v0.6 增补块 (B) **就地更正 + 留痕**。③ **立「只准按 `code` 分支」规则 + 登记三处 `reason` 名分歧（事三）**：**调用方只准按 `code` 分支，不得按 `reason` 分支**（`reason` 是诊断信息、**不是契约**；机读判据 `contract_field = "code"` / `reason_is_contract = false` / `reason_branching_allowed = false` / `same_code_reason_may_differ_across_layers = true`）；三处名分歧（① DB `ledger_int_amount` 超长标识符 `OVER_MAX_SINGLE_AMOUNT` ↔ TS `OUT_OF_BIGINT_RANGE`；② `parseUserAmount('1e5')` TS `NOT_DECIMAL_STRING` ↔ DB `EXPONENT_NOT_ALLOWED`；③ 历史项 TS `BAD_TYPE` → `MISSING`（**已修**，留痕））每条**同码、同 status，仅名不同**，**裁定维持现状**（第 1 条要对齐须动 `0005` 判序 ⇒ 不值）。落位：§14.3 **v0.7 增补块 (A)/(B)** + §19.11.B。④ **登记工作项「错误码命名整理」（事四）**：**P2/P3 边界一次做完**，**不在本册执行**；四条清单（① 标识符形状错误借用 `LEDGER_AMOUNT_INVALID`；② DB `ledger_int_amount` 对标识符套用金额长度帽 ⇒ `reason` 名错位；③ TS `BAD_TYPE` 拆分（已修）；④ 事三的三处名分歧），**根因一句话：关闭集词汇是「金额中心」的，却被长期用于标识符**。落位：§14.3 **v0.7 增补块 (C)** + §19.11.C。**规则总数不变（R1–R108，108 条）**；**章节编号未重排、未新增错误码**（§19.11 按「新增一律向后追加」纪律追加；§14.3 / §16 / §18 / §19.10.E 只就地增补）。 | Jing |
| v0.8 | 2026-09-27 | **Zang「P2 裁定落位 · 四处就地增补」版**（改前快照：`docs/versions/ledger.spec.v0.7.md`，md5 `5a196a343bc3ab9b160f5717f6ac632f`，1597 行 / 308426 字节；本版 md5 / 行数 / 字节数见交付报告）。来源 = `docs/seafood.master-plan.md` **§5.20 的 16 项裁定**（本版只落其中与本册直接相关的四处）。① **R45（§5.2）**：「差额留在佣金池」**已由 D13 取代**（#2；差额改为「按已有层级权重比例再分配」）—— **v0.7 原文保留并标「已由 D13 取代」**，落位 = R45 三格就地注记 + **§5.2 v0.8 块**（含 `−2` 事件净额 0、审计真源改 `ledger_entry`、无邀请人例外指向 P2 侧）；§17 索引 R45 同步。② **§14.1 #32**：费率真源 `app_config` ⇒ **`commission_policy.fee_rate_bp`（唯一真源）**（#3），并按 #5/#16 明确**政策写入守卫失败类一律 `400`**、**#32 自身仍 `500`**（缺陷类，语义收紧）—— 落位 = #32 行就地更正（v0.7 旧写法留痕）+ **§14.1 v0.8 增补块**；R44 / R68 的费率落点就地注记（**仅费率键**改真源，金额上限键不受影响）。③ **§7.2 #8**：**不建 `commission_payout` 表**、**`ref_id` = 同一 `job_id`**、审计真源 = `ledger_entry`（#4）—— 落位 = 该格就地更正（原文划线留痕）。④ **R21（§2.2）加范围限定**：本条只管**账本表**，**业务表可以 FK 到 `users(uid)`**（#6）—— 落位 = R21 正文 + §17 索引 R21 + §15 #8 指针。**R1–R108 仍 108 条（不增不删）**；**§14.1 仍 33 码**；**章节编号未重排、未新增章节**（四处逐条登记见 **§19.12**）。 | Jing |
| v0.9 | 2026-09-27 | **Zang「三项小修 · 冻结映射与现实对齐 · 往返闭合断言 · 反向映射缺陷登记」版**（改前快照：`docs/versions/ledger.spec.v0.8.md`，md5 `5fc164c3b1284103e69a23d749cedce0`，1658 行 / 323594 字节，与本版改前主体**逐字节相同**（本册以 `cmp` 自证）；本版 md5 / 行数 / 字节数见交付报告）。**三项都是小修，不扩大范围**；裁定来源 = Zang（本单转述自 `docs/seafood.master-plan.md` **§5.23**；🔴 **v0.10 更正：§5.23 正文已核对（master-plan v0.27 / HEAD `541dffd`）⇒ 下面这段「未能核到」的诚实标记作废**，逐条对齐见 §19.14.A；**原 v0.9 文字留痕如下**：⚠️ **本册未能核到 §5.23 正文** —— 全仓 `grep -rn '5\.23' docs/` 无命中、master-plan（737 行）**现存末节为 §5.22** ⇒ 按**转述的裁定值**落位并自核事实前提，**不自行推导**）。① **冻结映射与现实对齐（事一 · 核心）**：v0.4 冻结的 `bucket ↔ 状态类` 只有四条（`input ⇒ 400 类` / `integrity ⇒ 400 \| 404 \| 409` / `retryable \| infra ⇒ 503` / `defect ⇒ 500`），而 §14.1 的 33 码里**另有四个状态类**落在冻结面外（`403` ×2 = `LD014`/`LD015`、`423` ×1 = `LD009`、`200` ×1 = `LD006`、`null` ×1 = `LD032`；本册自核全表分布 400×9 / 403×2 / 404×3 / 409×8 / 423×1 / 200×1 / 500×5 / 503×3 / null×1 = 33）⇒ **修正原因写死：原表不完整（只覆盖 4 个状态类），不是现实违规**；裁定 = **接受三条扩展**（`403 ⇒ input` / `423 ⇒ integrity` / `null ⇒ defect`（HTTP 层 `status ?? 500`））＋ **`200` 改判为单列一类 `benign_outcomes`（良性结果、**不是**错误类、**不参与 bucket 校验**；理由 = `LD006` 幂等重放硬塞 `input` 桶语义不对）**，并新增「`200` 类只可能来自 `benign_outcomes`」「`403`/`423`/`null` 分别只可能来自 `input`/`integrity`/`defect`」两条判据；**原则 = 让冻结集与现实对齐**。落位 = **§14.3 v0.9 增补块 (A)**（含扩展表 / 改判理由 / 留痕「v0.4 原文只做扩展、一字未删」）。② **「双向映射全量往返闭合断言」立为规范要求（事二）**：凡双向映射（名↔码 / 状态码↔HTTP / 枚举↔字符串 / 代码↔规范）**必须交付全量往返闭合断言**（`f(g(x)) == x` 对每一元素 ＋ 桶一致性）**且必须进回归套件固定项**；**单向自证不算闭合**（P1 只自证了正向 33 条，**从未自证反向也有 33 条**）；已验证资产 = `backend-ts/scripts/p2c-00-code-roundtrip.ts`（修后四项归零、`--assert` exit 0）。落位 = **§14.3 v0.9 增补块 (B)** ＋ §19.13.B。③ **登记反向映射 P1 遗留缺陷与 `0009` 修复状态（事三）**：**反向映射缺 `LD0nn` 分支 ⇒ 33 码全未归类**（全部落 `LEDGER_TRANSACTION_REQUIRED`/`defect`/`unclassified_db_error`；**落桶侥幸没错、码名与 `reason` 全错配**；被 `0007` 的佣金守恒断言第一次真正抛 `LD032` 才暴露）⇒ 定性 **P1 遗留缺陷**，已由 **`0009`**（checksum（sha256 前 12 位）`6688e2ce35c6`；**函数体 = `0005` 版逐字节保留 ＋ 恰 60 行 `LD001..LD033` 分支** —— 本册自核前缀 10 ＋ 新增 60 ＋ 后缀 98 = 函数 168 行、分支 33 条）修复；**修前 / 修后读数逐字进册**（修前 run `MUJNM9EO`：`roundtrip_mismatches = 32` / `bucket_violations = 54` / `null_status_defect = 27` / `stale_unclassified_reason = 33`；修后 run `MUJO2B19`：四项**全 0**、`closed_set 33/33`；`--assert` exit **0** **属转引**（本册**未实跑** —— 不连库））；同处登记 **TS 侧 `LEDGER_ERROR_TABLE` / `LEDGER_SQLSTATE_TO_CODE` 本来就 33/33 齐全（缺口只在 DB 侧）** ＋ 新增 `LEDGER_ERROR_BUCKETS` / `httpStatusOf(status ?? 500)`；并立**硬规则：响应层必须用 `err.httpStatus`、不得用 `err.status`**（后者 `null` = §11 R88 脚本退出码语义、**故意保留**、**不是缺陷**）。落位 = **§14.3 v0.9 增补块 (C)** ＋ **§16 #14 / #15** ＋ §19.13.C。**R1–R108 仍 108 条（不增不删）**；**§14.1 仍 33 码**；**章节编号未重排、未新增章节**（本版内容一律追加为 **§19.13**，依「新增一律向后追加」纪律）。 | Jing |
| v0.10 | 2026-09-27 | **Zang「六项小修 · §5.23 回校 + 三条口径写死 + 验收登记」版**（改前快照：`docs/versions/ledger.spec.v0.9.md`，md5 `ff317dfbcad5cd6a0c4691c52a138542`，1776 行 / 360686 字节，与本版改前主体**逐字节相同**（本册以 `cmp` 自证）；本版 md5 / 行数 / 字节数见交付报告）。**六项都是小修，不扩大范围**。① **回校 §5.23 正文（事一）**：`docs/seafood.master-plan.md` 的 **§5.23 已在盘**（master-plan **v0.27** / HEAD `541dffd`，本册 `read_file` 逐字核过）⇒ v0.9 的「**未能核到 §5.23 正文 / 按转述落位**」标记**一律作废**（四处就地加更正标记：文件头 v0.9 修订块、§18 v0.9 行、§19.13 抬头、§19.13 末条），**逐条对齐见 §19.14.A**（六项：反向映射 33 码全未归类定性 / `0009` 修复 / bucket 扩展**四条**裁定 / `200` 改判 / **反转探针不做** / **响应层必须用 `err.httpStatus`**）—— 其中 **「反转探针不做」是 v0.9 的漏落项**，本版补登于 **§14.3 v0.10 增补块 (E)**；其余五项 v0.9 已按转述落对，**无须回改**（逐条结论见 §19.14.A 的「对齐结论」列）。② **「`200` ⇒ `benign`」精确口径写死（事二）**：**`bucket` 保持 `input`**、**不参与 `bucket↔状态类` 校验（单列校验类 `benign_outcomes`）**、**`httpStatusOf` 对良性码返 `200`（非 `500` 兜底）**、**`0009` 不得再改**（**校验侧之事、非映射侧**）⇒ **§14.3 v0.10 增补块 (D)** ＋ **§16 #15 就地更正**（v0.9 的「同步为 `200 ⇒ benign_outcomes`」指令作废）。③ **`W = 0` 双档口径（事三）**：**写入档（可达）** `400`（`input` 桶，对齐裁定 #5 / #16）／ **运行档（不可达的防御性兜底）** `500` defect（借 **#32 `LEDGER_FEE_RATE_INVALID`** + `reason = POLICY_WEIGHTS_ALL_ZERO`，**R108 必告警**）—— **因为到达即意味不变式被破坏**；**二者在不同档位、不冲突**，**删除「张力 / 未裁决」措辞** ⇒ **§14.1 v0.10 就地落位块**（同源登记见 `docs/commission.spec.md` v0.3 §7.3 / §13.2 #10 与 #10-R / §14.2 #2）。④ **幂等指纹覆盖范围（事四）**：**指纹 = business 字段集合（`job_id` / employer / worker / `cid` / `gross`），不含派生量（`fee` / `x_L` / `W` / `M` / 派生键）**；**政策改版后重算同键 ⇒ 走重放、按原事件返回**，**是正确行为、不是缺陷**（理由：把派生量入指纹会把同一业务请求判成不同请求 ⇒ 破坏 D12 不追溯） ⇒ **§6.2 v0.10 就地落位块**（同源：`commission.spec` v0.3 CR87）。⑤ **绑定协议（事五）**：写成**守卫强制、不可违反的协议** —— 「**已有下级（是别人的 `parent`）的人，不得再被绑上级**」，**替换「须由深到浅绑定」这类调用方纪律措辞**；已派 **`0010`** 实现 ⇒ **该迁移已在盘并已取得判负读数**（checksum12 `73e7ac8b6fd4`，见 `docs/commission.spec.md` v0.3 **§18.2B**）⇒ 该协议属 **P2 侧规范**，本册**只作指针**（正文落在 `docs/commission.spec.md` v0.3 §3.3 ④′ / CR16 / CR86；本册**不重复立条**、不动 R1–R108）。⑥ **登记 P2 佣金层验收读数（事六）**：M1–M9 已实现并**全部通过**（`--assert` **exit 0** / `reds: []`，**转引** `f618e00` 提交信息与 `.p2d-artifacts/p2d-00-m-criteria-20260927T103933Z.json` 的 `11_summary.reds = []`；**本册未实跑** —— 不连库）；特别登记 **M1 判负第 ③ 例**（**保平衡的 Σ 篡改**：出池少 1 / 受益人少收 1 **也被拦落 `LD032`**）⇒ 证明守恒断言**不能靠「双分录总数仍为 0」蒙过去** ⇒ **§19.14.C**。**R1–R108 仍 108 条（不增不删）**；**§14.1 仍 33 码**；**章节编号未重排、未新增章节**（本版内容一律追加为 **§19.14**，依「新增一律向后追加」纪律）。 | Jing |
| v0.11 | 2026-09-27 | **Zang「`0012` 幂等重放前置闸落位 · 四项」版**（改前快照：`docs/versions/ledger.spec.v0.10.md`，md5 `a2a6a6a4d26b800e7a60df5b57479f5c`，1838 行 / 384935 字节，与本版改前主体**逐字节相同**（本册以 `cmp` 自证）；本版 md5 / 行数 / 字节数见交付报告）。**本版四项都是就地增补/更正 + 登记，不扩大范围**；裁定来源 = `docs/seafood.master-plan.md` **§5.25**（幂等前置闸 = R51 的「快路径」）／ **D17** ／ **§5.27**（`0012` 独立质检：验收通过 + §C 两条已知盲区）。**① R51 新增子句**：`ledger_post_event` 的**只读重放前置闸**（`0012` 新增，按 `event_root_key = v_key` 走 `idx_ledger_event_root_key`，**命中即返、零写入**）**是 R51 的重放快路径**，**不得**表述为「**取代** `ON CONFLICT (idempotency_key) DO NOTHING` 探针」——**并发两个全新事件的权威性仍由 `ON CONFLICT` 承担**（两者都可能 miss 本闸 ⇒ 靠 `ledger_idem_uniq`：恰一个落账、另一个返 0 行 ⇒ 走 R51 ②③④），**R51 禁「先 SELECT 查在不在、再 INSERT」的立法意图不变**（该禁令针对**写入决策**；本闸 miss 时不做任何基于 SELECT 的写入决定）⇒ 落位 = §6.2 **R51 行就地注记 + v0.11 就地落位块 (1)** + §17 索引 R51。**② §7.1 第 454 行顺序明文更正（旧址留痕，不静默重写）**：`v0.10 旧写法`「信封校验 → **幂等占位** → 按全序加锁 → 分录 → 余额/冻结更新 → 配对不变式」**保留在同处**，现写死为「**信封校验 → 加锁(C4) → 只读重放前置闸(C4.5) → 余额/冻结闸(C5/R80) → ON CONFLICT 首条分录探针 → 分录 → 余额更新**」——**修前实测成因**（`pos_c4_account_lock 26825 < pos_c5_balance_section 27572 < pos_r80_balance_gate 29468 < pos_on_conflict_probe 31476` ⇒ 余额闸跑在幂等占位之前）⇒ 托管花光后同键同载荷重试得 `LD002`（409）而非 R52① 的 200 重放；**后态** `26917 < 27698 < 30721 < 32617 < 34625`。**相对旧写的三处差异**：①「幂等占位」拆两级（前置闸在前、`ON CONFLICT` 探针在余额闸后）；②「按全序加锁」明确为 C4 账户加锁（全序仍见 §10.1 R81）；③「配对不变式」不再作为执行阶段列出（本体 = R41，判据形状见 §11 判据 8）。⇒ 落位 = **§7.1 第 454 行 + 同处 v0.11 就地更正块**。**③ R52① 保证项 + `extra` 非契约（Zang · §5.25）**：① 的**保证项 = `idempotent_replay` / `txid` / 账上结果（分录与余额快照）**（与首次落账逐字一致 ⇒ 客户端可区分「已成功」与「余额不足/未执行」）；**`extra` 属诊断信息、非契约字段**，首写 `{symbol, entries}`、**重放 `{}` 合规**，调用方**不得**据以判成败或分支（同「只准按 `code` 分支」纪律）。**依据两条（本册自核）**：① ① 原文的「`...既有结果`」是**开放省略号**，其枚举里**本就没有 `extra`** —— **全文检索 `extra` 出现 `0` 次**；② 该行为**早于 `0012`** —— `0005` 与 `0012` 的 **C7 段逐字节相同**（sha256 `453a2e7781743866e861d28fb7c24cc8ac9bdf43ad67c224f2384afc88b530a7`），装回 `0005` 走**非闸**重放路径得到**同形状** `extra = {}` ⇒ **不是 `0012` 引入的回归** ⇒ **不因它开 `0013`**（旨同 §5.25 所引 **D39**）。⇒ 落位 = §6.2 **R52 行就地注记 + v0.11 就地落位块 (2)** + §17 索引 R52。**④ 登记 `0012` 实现事实与证据 + 两条已知盲区（非缺陷）**：checksum `2a64483f944f16e3364be822e5ff61e0b95afa0168f937ce5aac6671b561dcbe`（= 盘上 sha256，**本册自核**；库侧一致属转引）；函数体 before `42449 / 0cf1bb98ee3a30da55b1620c309d5541`（= `0005`）→ after `45598 / d94dd902697dfe60aba409d808c6d63a`（**本册以 `AS $tag$…$tag$` 抽 `prosrc` 独立复算，逐字段等于 `p2x-01-migration-dry-run-P2XFIN01.json` 的 `fn_before` / `fn_after_in_tx`**；⚠️ 同处更正术语：该两数是**字符数**，UTF-8 字节数为 `46732` / `51429`）；五个位置读数与 `on_conflict_still_after_gate = true`（`34625 > 27698`）；与 `0005` 差分 = **恰两处纯插入（3 行 DECLARE + 68 行 C4.5 闸 = 71 行，0 删 0 改）**，删掉后**逐字等于 `0005` 的 `prosrc`**（本册重建自证），**C5–C8 一字未动**；行为/判负/并发读数按**转引**登记（交付方 `p2x-02` 13/13、独立质检 14/14 与 18/18、字节级 A/B：删两处插入 ⇒ `LD002` 复现 / `0012` 下 ⇒ 200 重放；`migrate` 判负 exit 4）。**两条已知盲区（登记、非缺陷、裁定不修）**：① §C 行为探针 `v_r2 := ledger_post_event(v_evt)` **未受保护** ⇒ 闸被破坏时先抛裸 `LD002`/`LD006`、**诊断明细丢失**（**fail-closed 成立**）；② §C 结构断言是**子串匹配** ⇒ 语义改坏但逐字保留 `t.event_root_key = v_key` 的改写**逃过全部结构断言**（实测 V5）。两条**留待下次真正 `CREATE OR REPLACE ledger_post_event` 时一并包住**。⇒ 落位 = **§19.15.A / §19.15.B / §19.15.C**。**R1–R108 仍 108 条（不增不删）**；**§14.1 仍 33 码**；**章节编号未重排、未新增章节**（本版内容一律追加为 **§19.15**，依「新增一律向后追加」纪律）。 | Jing |
| v0.12 | 2026-09-28 | **Zang「C1 终审落位：`R79` 扩写并拍板 ＋ 新增 `R109`」版**（改前快照：`docs/versions/ledger.spec.v0.11.md`，md5 `115b6e8dc36e0f6e2e29ce855cc014d5`，1918 行 / 417398 字节，与本版改前主体**逐字节相同**（本册以 `cmp` 自证）；本版 md5 / 行数 / 字节数见交付报告）。**本版两项 = 一处就地扩写并拍板 ＋ 一条规则新增，不扩大范围**；裁定来源 = `docs/seafood.master-plan.md` **§5.32**（P3 数据层规范 v0.1 终审 · **C1 四条附加硬约束** + **C8**）。① **`R79` 就地扩写并拍板**：加锁全序最终口径 = **业务行（若该事务涉及，按主键升序） → `currency`（`cid` 升序） → `account`（`uid` 升序）**；**禁止**「先锁 `account` 再锁业务行」（与全序成环 ⇒ 死锁）；**业务编排函数（`job_post_event` 等）必须在调 `ledger_post_event` 之前持有业务行锁**；**`lockAccounts(sortedUids, cid)` 由「建议」升为强制**（**唯一允许的加锁入口**、**只接受已排序数组**）；状态栏 **待拍板 → 已拍板（Zang · C1 终审，2026-09-28）**。落位 = §10.1 全序块（**v0.11 旧写法同地保留**）＋ §10.3 R79 行（**v0.11 旧写法同地保留**）＋ **§7.2 v0.12 就地落位块** ＋ §15 #6（**v0.11 旧写法同地保留**）＋ §17 索引 R79。② **新增 `R109`**（**R1–R108 编号与条文一字未动、只增不重排**）：**业务编排函数的原子性与幂等口径** —— ① 业务行 + 分录**必须**同一事务（编排函数保证、**函数内禁任何 DDL**）；② 幂等**必须**与 `R51`/`R52` 一致（同键同指纹 ⇒ `200` 重放、**不**重写业务行）；③ **必须**落 `ref_id` 到账本引用列；④ 业务级幂等另需业务表侧键 **`create_key`**（指针：`docs/data-layer.spec.md` C8/DL75）。落位 = §7.3 末行 ＋ §17 索引 R109。③ **（可选）已知债登记**：`C5` 借 `LEDGER_CURRENCY_INVALID_TRANSITION`(409) 做**业务**状态机非法转移 ⇒ 「**码名语义窄化**」；将来若启用专用码**必须一次到位**（正向 + 反向映射 + bucket）⇒ §19.16.B。**§14.1 仍 33 码（不新增错误码）**；**章节编号未重排**（只追加 §19.16）；逐条登记见 **§19.16**。 | Jing |
| v0.13 | 2026-09-30 | **Zang「§5.81 勘误落位：`listing_deposit` 白名单回写」版**（改前快照：`docs/versions/ledger.spec.v0.12.md`，md5 `8ffb5fd5b711731ea65c317f18ec0f0d`，2010 行 / 450638 字节，**本版新建**，以 `cmp` 自证与改前主体逐字节相同；本版 md5 / 行数 / 字节数见交付报告）。**本版只做一处白名单回写 + 变更记录，不扩大范围**；裁定来源 = `docs/seafood.master-plan.md` **§5.81**（`:1390-1399`，**Zang 自我勘误：§5.80 对 route-layer.spec §7-3 的批准作废** —— 逐字依据 = 本册 `:79`/`:12`/`:13`/`:191` + `docs/data-layer.spec.md:454/530/533` + `src/ledger.ts:148-150` + `migrations/0003:5-8`）。**更正内容**：**R101（§13.3）的 `−1` 增方白名单追加 `listing_deposit`**（原文只列 `trade_fee`/`listing_fee`/`currency_create_fee` ⇒ **漏列**；而 §3.1 R31 `:287` / §3.2 `:269` / §13.2 `:827` / §11 判据 7 `:754` **自 v0.2 起已按「消耗入 `−1`」登记** ⇒ **册内自相矛盾**）；**只加一格、旧写法保留留痕、其它格一律不动**。落位 = **R101 正文** ＋ **§17 索引 R101** ＋ **§18 本行** ＋ **§19.17**（含 A 已正确条文清单 / B 唯一回写点 / C FIX-A 归属与「`0019` 待落盘」的诚实边界 / D 落位索引）。**DB 侧落点** = `0019` 迁移（**★ FIX-A 已落盘，本册收尾现取核实**：`migrations/0019_listing_deposit_platform_credit.sql`（167 行）在盘、`/health` 自报 `schema_version=0019`、`HOLD_KINDS`（`:178`）已移除该项；照 `0008` 先例做加法式扩展）；**代码侧真根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` 误含 `listing_deposit`（P1c 漏删）。**R1–R109 编号与条文一律不动（本次不新增、不重排任何规则）**；**§14.1 仍 33 码**；**章节编号未重排**（v0.13 内容一律追加为 **§19.17**）。**未连库、未启停服务、未跑迁移/探针、未改代码**（`backend-ts/**` 只读）。 | Jing |
| v0.15 | 2026-10-03 | **Zang「P9⑤ C3 规范回写：`kind` 23 → 24（末位追加 `invite_first_task_reward`）＋ `−1` debit 白名单首开（仅 1 项）＋ `R103` 就地修订（区分『运维提取』⇄『需求规定的发放』）」版**（改前快照：`docs/versions/ledger.spec.v0.14.md`，md5 `2d071b5ee70efff27351493f133f3c11`，2044 行 / 467967 字节，以 `cmp` 自证与改前主体逐字节相同；本版快照 = `docs/versions/ledger.spec.v0.15.md`，delta = `docs/audit/ledger-v0.15-delta.md`）。**本版只做 kind 面 + 白名单 + `R103` 三条口径的回写，不扩大范围**；裁定来源 = `docs/seafood.master-plan.md` **§5.269 B/C**（`R-9-64` / `R-9-65` / `R-9-66`）+ `docs/commission.spec.md` v0.4 §19。落位：① **§5.1**（表末位追加 1 行 `invite_first_task_reward` + v0.15 加注块：24 值 / 三处编码 / 三列登记 / DB 落点 `0038`）；② **§13.3**（v0.15 块：`R101` `−1` `debit` 首开仅 1 项、`credit` 8 值不变；`R103` 就地修订「运维提取留白不变」⇄「需求规定的发放放行」，二者不同层级）；③ **§14.3**（错误表增 1 行）；④ **§15 #3**（加注「本项与 `invite_first_task_reward` 无关」）；⑤ **§17 索引注**（`R40`/`R101`/`R103` 旧写法留痕 · 以 §5.1/§13.3 v0.15 块为准）；⑥ **§19.18**（登记 · 含 `R-9-64` 播种源更正口径）。**R1–R109 编号与条文一律不动（本次不新增、不重排任何规则）**；**§14.1 仍 33 码**；**章节编号未重排**（v0.15 内容一律追加为 **§19.18**）。**未连库、未启停服务、未跑迁移/探针、未改代码**（`backend-ts/**` 只读）。 | Jing |

**本册待 Kevin 拍板的三条 ★★★（P1 开工前必须表态）**：R15 分录双字段、~~R31 保证金性质（D6/D7 冲突仲裁）~~（**已于 v0.2 裁定：消耗不可退**，见 §19.0）、R103 平台收入能否提取。其余 **16** 条已集中列于 §15（其中 #17 乐观锁亦已于 v0.2 裁定，见 §19.4；**#6 R79 加锁全序已于 v0.12 拍板** —— 依 Zang · C1 终审，见 §19.16.A），均为「一句话可改」。〔**v0.12 留痕**：v0.11 旧写法为「其余 **17** 条已集中列于 §15（其中 #17 乐观锁亦已于 v0.2 裁定，见 §19.4）」；#6 拍板后由 17 → **16**〕

**修订纪律**：本册是权威口径文件，任何改动必须 ① 先按 `docs/versions/ledger.spec.v0.1.md` 形式整份快照当前版本，再改主文件；② 追加/删除规则编号**只能追加 Rn+1，不得复用已发布编号**（编号被下游 brief、验收清单、代码注释引用）；③ 版本号与正文「共 N 条规则」的声明必须同步（§15 与 §17 各有一处计数）；④ **章节编号不得重排**：§0–§18 是 v0.1 的既有编号（R73 等条文按号引用「§18 变更记录」），**新增章节一律追加为 §19、§20…**（本册 §19 即按此追加）。

---

## §19 已裁定口径登记（Zang · P1a 收口）

> **本节性质**：P1a 实现（Kong）逐条比对 `docs/ledger.spec.md`（v0.1 / 962 行 / R1–R108）后挖出 **3 处 spec 自身的错误 / 缺漏**，Zang 已裁定。**三项裁定**已就地改写正文（每一处都留痕，见下表落位）；**另 5 条已裁定口径**只登记在此，**不改动上游规则原文**（R101 / R28 / R51 / R52 / R81 条文原样保留，仅追加「见 §19.x」指针）。
> **效力**：本节与上游条文冲突时，**以本节为准**（本节是 Zang 对 v0.1 的最终收口口径）。
> **v0.3 追加（Zang · P1c 收口）**：新增 **§19.8**（kind 关闭集 21 → 20、非 PG 错误归类、以及「`ledger_kind_enum` 是 CHECK 约束、不是 enum 类型」的事实更正）。**节标题与 §19.0–§19.7 编号沿用 v0.2、不重排**（锚点与下游引用不得断裂），P1c 内容一律向后追加为 §19.8。
> **体例（编号顺序即被引用顺序，未重排）**：`19.0` = 裁定一（保证金消耗不可退）、`19.1` = 登记 1（R101×R38）、`19.2` = 裁定二（判据 8 正式形状）、`19.3`–`19.6` = 登记 2–5、`19.7` = 落位索引。**裁定三**（§14 错误码借用表 + `details` 形状表）就地落在 §14.3 / §14.4，其登记见 §19.7。
> **v0.4 追加（Zang · P1f 收口）**：新增 **§19.9**（键字符集 / 重放精确归属 / R60 / 金额 / R82 预算口径 / 判据 8 键族 / §14 系列 / §19.5 单语句 / P1g 改名 的登记 + 落位索引 + **§19.9.F 发现的不一致**）。**节标题与 §19.0–§19.8 编号沿用 v0.2 / v0.3、不重排**（锚点与下游引用不得断裂），P1f/P1g 内容一律向后追加为 §19.9。
> **v0.5 追加（Zang · §14.3 参数分类口径枚举修正）**：**不新增 §19 小节**（本版只修 §14.3 一处歧义 + 记入 §18 变更记录）；§19 内**仅 §19.9.F 第 6 条**追加一条 v0.5 更正留痕（v0.4 当时要求的「TS 侧 `toCid` 收敛到 `400`」已随 Zang 重新裁定**反转为「收敛回 `404`」**，见 §14.3 v0.5 枚举块 ③ 与 §18 v0.5 行）。**§19.0–§19.9 的编号与节标题沿用不改、不重排**。
> **v0.6 追加（Zang · 四项小修登记）**：新增 **§19.10**（`toCid` 现状翻转的登记与索引、读路径超 `bigint` 逃逸缺陷、两条「不是确定性判据」的读数、`reason` 名对齐）。**§19.0–§19.9 的编号与节标题沿用不改、不重排**（v0.6 依「新增一律向后追加」纪律追加 §19.10）。
> **v0.8 追加（Zang · P2 裁定落位）**：新增 **§19.12**（四处就地增补的登记与逐处落位索引：R45 由 D13 取代 / §14.1 #32 费率真源更正 / §7.2 #8 不建 `commission_payout` 表且 `ref_id` = 同一 `job_id` / R21 加范围限定）。**§19.0–§19.11 的编号与节标题沿用不改、不重排**（v0.8 依「新增一律向后追加」纪律追加 §19.12）。
> **v0.12 追加（Zang · C1 终审落位）**：新增 **§19.16**（**`R79` 扩写并拍板**的裁定逐字与逐处落位索引 ＋ **新增 `R109`**（业务编排函数的原子性与幂等口径）＋ （可选）已知债登记 ＋ 交付纪律自检）。**§19.0–§19.15 的编号与节标题沿用不改、不重排**（v0.12 依「新增一律向后追加」纪律追加 §19.16）。

### 19.0 裁定一（最要紧）：上市保证金 = **消耗（不可退）**

- **依据**：Kevin 原文「用户自定义的社区积分如需上市，**需要消耗一定的积分作为保证金**」。
- **v0.1 旧写法（错，留痕）**：`listing_deposit` = **冻结**（可退）⇒ 记 `frozen_delta`；下架时 `listing_deposit_refund`（解冻退回）；平台「上市相关收入」**不含**在冻的 `listing_deposit`（「D6 vs D7」仲裁为「平时只冻结、违约才 `listing_deposit_forfeit`」）。
- **v0.2 新写法（对）**：`listing_deposit` = **消耗** —— `$` 从创建者 `balance` 扣（`delta` 负数），转入平台手续费归集账户 `uid = −1`，**计入平台收入**；**不可退**；**不存在可退保证金，`listing_deposit_refund` 这个 kind 不存在**（kind 关闭集 **22 → 21**）。
- **落位**：§3.1 R31（正文重写 + 旧写法留痕）、§3.2（状态机图 + 转移表两行）、§5.1（`hold` 行 / `listing_deposit` 行 / `listing_deposit_refund` 行标作废 / `trade` 注）、§5.2 R40（22→21）、§2.1 DDL（`ledger_kind_enum` 删该值）、§4.3 R32/R36/R37、§7.2 #13/#14、§11 判据 5/7、§13.2（`−1` 收入口径）、§13「不设保证金池」段、§15 #2、§0.4。
- **⚠️ 遗留（不在本次裁定范围，需上游澄清 / 实现侧同步）**：~~① `listing_deposit_forfeit` 在「保证金已于上市时消耗」之后是否仍有标的物（§5.1 #21 已标「待澄清」，kind **暂不删**）~~ ✅ **已于 v0.3（Zang · P1c 收口）裁定：删除该 kind**（保证金上市时即消耗 ⇒ 强制下架无可罚没标的物；详见 §19.8.B）。此处保留 v0.2 原文字以留痕，**该条已不再是遗留项**；② `backend-ts/migrations/0001_ledger_core.sql` 与 `backend-ts/src/ledger.ts` 中的旧枚举值需在实现侧同步（**本册不改代码**，见 §0.2 分工）。

### 19.1 裁定（登记）：R101（平台账户禁 `transfer`）vs R38（罚没退还）

- **口径**：**仅 uid `−3`（罚没池）允许以 `transfer` 出账**（承载 R38 的「罚没退还」）；**其余平台账户白名单从严** —— `transfer` / `hold` / `purchase` 一律禁止。**不放宽任何其他格**。
- **为什么冲突**：R38 明写「退还 = 反向 `hold_forfeit`，**或 `transfer` 从 `−3` 账户转回**」，而 R101 把 `transfer` 对所有平台账户一刀禁止 ⇒ 罚没退还**无合法出口**（也不能用 `hold_release` 表达 —— 罚没账户没有 `frozen`）。以「最小放行」消解：只开 `−3` 的 `transfer` 出账。
- **落位**：§13.3 R101（追加登记）、§13.2 `−3` 行；§17 索引 R101。

### 19.2 裁定二：§11 判据 8 的正式形状

- **口径**：正式形状 = **`Σ(delta + frozen_delta) = 0`**（每个业务事件内，按 `ref_type` + `ref_id` + 同一提交分组）；**含 `mint` / `burn` 的事件例外**，此时差额恰好等于净增发额。
- **为什么 v0.1 的字面式不成立**（留给后人，勿重新踩坑）：v0.1 写「`Σ delta = 0` **且** `Σ frozen_delta = 0`」。而 §4.2 三态记账规定**一次 `hold` 必然产生 `delta = −n` 与 `frozen_delta = +n`**（同账户两条分录，R34/R42）⇒ 该事件内 `Σ delta = −n ≠ 0`、`Σ frozen_delta = +n ≠ 0`，**两个字面式不可能同时为 0**，与 §4.2 直接自相矛盾。由于账户净资产 = `balance + frozen`（§4.1 恒等式），「同一事件不造钱、不吞钱」的正确表述是把两个余额维度**相加**：`hold` / `hold_release` 的 `+n − n` 自动归零，`frozen → 对方 balance` 的结算类与 `hold_forfeit` 同样归零。
- **同源错误一并加指针**：§5.2 R41（原文保留 + 更正指针）、§5.1 `trade` 注。
- **落位**：§11.1 判据 8（重写 + 修正 SQL）、§5.2 R41、§5.1 `trade` 注。

### 19.3 裁定（登记）：R28「币种状态 × 操作」矩阵只定义了 5 个操作

- **口径**：**`hold_release` 四态全可**（`draft` / `listed` / `frozen` / `delisted` 均可）；**结算类**（`job_payout` / `purchase` / `sale` / `trade` / `hold_forfeit` 等）**与 `hold` 同档 —— 仅 `listed`**。
- **为什么**：矩阵漏掉 `hold_release` 与结算类；若按「未定义即拒绝」实现，则 `frozen` / `delisted` 币种上的挂单**无法撤销**（§7.2 #14 与 R30 要求下架必须撤销全部活跃挂单并解冻）⇒ 撤单卡死、用户资金永久冻结。解冻是**收回自有资金**，不构成新交易，不应受上市状态限制。
- **落位**：§3.3 R28（追加登记）；§17 索引 R28。

### 19.4 裁定（登记）：R81 加锁策略最终口径 = **全部 `SELECT ... FOR UPDATE`**

- **口径**：写路径**一律**行锁（`SELECT ... FOR UPDATE`）；**不做** `account.version` 乐观锁分支；`account.version` 列**保留**、仍按 R13 每笔加分录事务 `+1`，**仅作审计/诊断**，不得作为互斥手段或业务判断依据。
- **为什么**：两套机制混用时，乐观锁事务与行锁事务**互相看不见对方** ⇒ 假安全感；P1a 实现已按「全部 `FOR UPDATE`」落地，spec §15 #17 亦明示「可改」。
- **落位**：§10.3 R81（重写 + 留痕）、§15 #17、§17 索引 R81。

### 19.5 裁定（登记）：R51 / R48 同事件多分录的幂等键

- **口径**：**第 1 条分录用调用方原始键**（它就是幂等探针本身）；**第 i 条（i ≥ 2）用确定性派生键 `<key>#<i>`**（同一键空间、前缀不变、可推导、可重放）。
- **为什么**：R51 只规定「**首条**分录带 `ON CONFLICT (idempotency_key) DO NOTHING`」，未规定同事件其余分录的键；而 R48 要求 `idempotency_key` **全局唯一** ⇒ 一次事件写 N 条分录必然撞唯一约束（首条之外的键无定义）。派生键同时满足唯一性（R48）与「同一业务事实 ⇒ 同一键族」的可重放性（R50）。
- **落位**：§6.2 R51（追加登记）；§17 索引 R51。
- 🆕 **v0.4 补注（P1e/P1i 实现形态，S4 + §19.5 口径改写）**：**一个业务事件 = 一条 `SELECT ledger_post_event($1::jsonb)`** —— 上述「第 1 条用原始键 / 第 `i` 条用 `<key>#<i>`」现由**该函数内部**实现。**一条语句自带隐式事务**（`0004` 定义、`0005` 覆盖）⇒ **不再需要应用层的 `BEGIN…COMMIT`**，也不再存在「应用层先 SELECT 再 INSERT」的空间。
- 🆕 **v0.4 补注（重放归属）**：**「键族」不再靠 `split_part(idempotency_key,'#',1)` 这种字符串前缀算术判定**（它就是 F1 缺陷的根因），改为 **`ledger_entry.event_root_key` 精确归属**；历史行（`event_root_key IS NULL`）按 `idempotency_key` **精确等值**兜底。⇒ §19.5 里「同一键族」一语，v0.4 起一律以「**同一 `event_root_key`**」为准。
- 🆕 **v0.4 补注（键的字符集，本裁定的前提）**：派生键 `<key>#<i>` 只有在**调用方键禁止含 `#`** 时才是单射；该禁令已于 v0.4 落为 R49 的字符集闸（见 §6.2 v0.4 块）。**派生分录撞唯一约束 = 实现缺陷** ⇒ `LD024` / `LEDGER_TRANSACTION_REQUIRED`（`500`）/ `reason = 'derived_key_collision'`，**不得**伪装成 `409`「幂等冲突」。

### 19.6 裁定（登记）：R52② 指纹策略 + 路由层强制项

- **口径**：**未传 `requestFingerprint` 时，同键一律按重放（①，`200 idempotent_replay`）处理，不返回 `409`**；② 仅在「**传了指纹且指纹不同**」时成立。**但路由层写路径必须强制传指纹**（P3/P4 落实）—— 传指纹是**路由层的强制项**，不是服务层的判断项。
- **为什么**：R53 明确「指纹**可以 `NULL`**（内部 `ops:` 事件可不带）」，v0.1 未定义「同为 NULL 算相同还是不同」；同时 R50 说明「金额不进键 ⇒ 同单改价重发应被 409 拦住」——该行为**完全依赖指纹存在**。不强制传指纹，防重复扣款的最后一环形同虚设。
- **落位**：§6.2 R52（追加登记）；§17 索引 R52。

### 19.7 本次裁定的落位索引（供下游 brief / 验收清单与代码注释对号）

| 裁定 | 顺位说明 | 正文落位（逐处） |
|---|---|---|
| **裁定一**：上市保证金 = 消耗（不可退） | spec 错、代码对 | §0.4、§2.1 DDL、§3.1 R31、§3.2（图 + 转移表）、§4.3 R32 / R36 / R37、§5.1（#4 / #19 / #20 / `trade` 注）、§5.2 R40 / R43、§7.2 #13 / #14、§11 判据 5 / 7、§13.2（`−1`）、§13 保证金池段、§15 #2、§17 索引（R32 / R36 / R37 / R40 / R103） |
| **裁定二**：§11 判据 8 正式形状 = `Σ(delta + frozen_delta) = 0` | spec 与 §4.2 自相矛盾 | §11.1 判据 8（含修正 SQL）、§5.2 R41、§5.1 `trade` 注 |
| **裁定三**：§14 补借用映射表 + R107 `details` 形状表 | 采纳实现方借用方案 | **新增** §14.3、§14.4；R107 落点已回指 §14.4 |
| 登记 1：R101 × R38（仅 `−3` 可 `transfer` 出账） | 登记（不改上游条文） | §19.1、§13.3 R101、§13.2 `−3` 行、§17 索引 R101 |
| 登记 2：R28 补 `hold_release` / 结算类 | 登记 | §19.3、§3.3 R28、§17 索引 R28 |
| 登记 3：R51 / R48 幂等派生键 `<key>#<i>` | 登记 | §19.5、§6.2 R51、§17 索引 R51 |
| 登记 4：R81 全部 `FOR UPDATE` | 登记（采纳实现现状） | §19.4、§10.3 R81、§15 #17、§17 索引 R81 |
| 登记 5：R52② 指纹策略（未传指纹 = 重放；路由层强制传） | 登记 | §19.6、§6.2 R52、§17 索引 R52 |

> ▶ **P1c 收口（v0.3）的落位索引见 §19.8.D**；§19.7 本表仅覆盖 P1a 收口（不重排、不合并）。

**未纳入本次裁定（留待后续）**：~~`listing_deposit_forfeit` 的标的物（见 §19.0 遗留①）~~ ✅ **已于 v0.3（Zang · P1c 收口）裁定：删除该 kind（详见 §19.8.B）—— 自本「未纳入」清单移除、改列为已裁定**、`platform_withdraw`（R103 / §15 #3）、R15 分录双字段（§15 #1）、P0 migration 与 DDL 实测（§16 #1/#2/#3）。

### 19.8 裁定与事实更正（Zang · P1c 收口，v0.3）

> **本节性质**：P1c 实现（Kong）在 v0.2 基础上落地三件事，并对一处 schema 事实做了实测取证。Zang 已裁定。**本节与上游条文冲突时以本节为准**；§19.0–§19.7 为 P1a 收口、编号不重排，P1c 内容全部追加于此。

#### 19.8.A 事实更正（取证）：`ledger_kind_enum` 是 **CHECK 约束**，**不是** enum 类型

- **口径**：本库 `ledger_entry.kind` 是 **`text`** 列；其白名单是一个 **CHECK 约束**，约束名恰为 `ledger_kind_enum`（名字里带 `_enum`，但**不是** PostgreSQL enum 类型）。§2.1 DDL 现按此加注（见该节 v0.3 事实更正块）。
- **实测取证（P1c，真库）**：
  - `information_schema.columns` → `ledger_entry.kind`：`data_type = 'text'`、`udt_name = 'text'`；
  - `pg_constraint` → `ledger_kind_enum`：`contype = 'c'`（CHECK），`def` 形如 `kind = ANY (ARRAY[...])`；
  - `pg_type` → **不存在** `typname LIKE '%ledger_kind%'` 的行。
- **直接后果（必须按此实现）**：**删 kind = 约束替换** —— `ALTER TABLE ledger_entry DROP CONSTRAINT ledger_kind_enum;` + `ALTER TABLE ledger_entry ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (...));`，且**先断言无行在用**（否则中止；禁止借改约束静默改写历史流水语义）。**不可**用 `ALTER TYPE`：本库无该类型可改；且 PostgreSQL 本就不支持从 enum 类型里删值 —— 派单文字里的 `ALTER TYPE ... RENAME` 方案在本库**不可执行**。实作见 `backend-ts/migrations/0003_kind_close_set_20.sql`。
- **留痕（改的是措辞，不是判断）**：v0.2 及以前本册对 `ledger_kind_enum` 的引用**未显式声明「它是 CHECK 约束而非类型」**，约束名里的 `_enum` 易被读成「同名 enum 类型」。经逐字核查：本册正文**没有**把 `ledger_kind_enum` 直述为「enum 类型」的句子（§2.2 R17 与 §15 #16 早已明写「**不使用** PostgreSQL `ENUM` 类型」，与实测一致）；v0.3 的改动是**补明确标注 + 补「删 kind 的操作手段」**，**不是**推翻 v0.2。§2.1 与 §5.2 R40 已按实测加注。

#### 19.8.B 裁定：kind 关闭集 **21 → 20**（删 `listing_deposit_forfeit`）

- **依据**：保证金**在上市时即消耗**（`listing_deposit` 已转入平台收入 `uid = −1`，见 §3.1 R31）⇒ **强制下架时不存在可罚没的标的物**，该 kind 无业务场景。
- **口径**：**`listing_deposit_forfeit` 删除**（kind 关闭集 **21 → 20**）；**强制下架与正常下架均为无账务动作**（§3.2 转移表已改）。
- **将来若要做「强制下架罚款」**：那是**新语义、新 kind**，须单独裁定后按 §5.1 登记「减方/增方/净增发」再启用；**不得**复活 `listing_deposit_forfeit` 这个已删名（已发布编号不复用）。
- **DB 侧落点**：`backend-ts/migrations/0003_kind_close_set_20.sql` —— 前置断言（若仍有行在用被删值则 `RAISE EXCEPTION` 中止）→ `DROP CONSTRAINT` + `ADD CONSTRAINT`（20 个值）→ 收尾断言（恰好 1 个 `ledger_kind_enum` CHECK）。该 migration 已在真库生效，值集与 §2.1 DDL / §5.1 现存集**逐字一致**。

#### 19.8.C 裁定：非 PG 错误归类（`500` 兜底 → `503` + `details.reason`）

> **背景（留痕）**：事务包装器在「拿不到连接」与「SQL 执行失败」两条路径上共用过一个兜底分支。P1c 之前，**WS 连接池取不到连接时抛的是无 `code` 的裸 `Error`**，被兜底改写成 `LEDGER_TRANSACTION_REQUIRED`（`500`）。而 R105 把 `500` 定义为**实现缺陷**（并触发 R108 告警），但连接池超时 / 驱动级连接失败是**可重试**的「暂时不可用」⇒ **归类错误**（用户看到「服务异常」，缺陷告警被污染）。P1c 已修正。

- **C1（连接池获取连接超时 / 过载）**：归 **`503 LEDGER_TX_TIMEOUT`** + `details.reason = 'pool_connection_timeout'`；**不得**再兜底为 `500 LEDGER_TRANSACTION_REQUIRED`。
- **C2（驱动 / OS 级连接错误，如 `ECONNREFUSED`）**：归 **`503 LEDGER_TX_TIMEOUT`** + `details.reason = 'driver_connection_error'`。
- **C3（归类纪律）**：`LEDGER_TRANSACTION_REQUIRED`（`500`）**只**保留其字面语义 —— 「写路径未在事务上下文中执行」（§7 R55，实现缺陷）；任何**无 SQLSTATE** 的连接 / 驱动错误**不得**归入该码。若确实无法细分，用 `details.cause` + `details.reason = 'unclassified_non_pg_error' | 'unclassified_driver_error' | 'unclassified_pg_error'`（配 `error_name`，及 `error_code` 或 `pg_code`）**如实标注「未归类」**，而不是伪装成某个有语义的码；**不得只留 `cause = 'non_pg_error'`**。
- **落位**：§14.1 #27（触发条件扩写）、§14.3（新增「驱动级 / 非 PG 错误」借用行）、§14.4（`LEDGER_TX_TIMEOUT` 与 `LEDGER_TRANSACTION_REQUIRED` 各单列 `details` 形状）、§11.2 R82（加补充句并互引）。

#### 19.8.D P1c 落位索引（供下游 brief / 验收清单与代码注释对号）

| 裁定 / 更正 | 正文落位（逐处） |
|---|---|
| **A**：`ledger_kind_enum` = CHECK 约束（非 enum 类型）；删 kind 用 `DROP` / `ADD CONSTRAINT` | §2.1（DDL 值集 + 实测取证块）、§2.2 R17（口径早已一致，未改）、§5.2 R40、§19.8.A |
| **B**：kind 关闭集 21 → 20（删 `listing_deposit_forfeit`） | §5.1（标题 / 行号说明 / #21 行）、§5.2 R40、§2.1 DDL、§3.2 转移表、§3.1 R31、§4.3 R33、§7.2 #14、§11 判据 7、§13.2 `−3` 行、§13.3 R101 / R103、§15 #2、§17 索引（R31 / R33 / R40 / R101 / R103）、§19.0 遗留①、§19 结尾「未纳入」 |
| **C**：非 PG 错误归类（`503` + `reason`） | §14.1 #27、§14.3（新增行）、§14.4（两行单列）、§11.2 R82、§17 索引 R82 |

**本次实测取证（P1c，真库）**：
1. `ledger_entry.kind` 的 `data_type = 'text'`；`ledger_kind_enum` 的 `contype = 'c'`；`pg_type` 中无同名类型（见 19.8.A）。
2. 旁证：`0003` migration 在真库执行成功 —— 该文件自身以 `pg_constraint`（`contype = 'c'`）断言约束存在性、并在替换后断言恰好 1 个 `ledger_kind_enum` CHECK ⇒ 该约束可被 `DROP` / `ADD` 替换，且替换后无行在用被删值。
3. 真库测试数据已清理：删 308 条流水 / 27 个账户 / 8 个自建币；现仅剩平台账户（`0` / `−1` / `−2` / `−3`，均 `0/0`）与 `cid = 1` 的 `$`；`schema_migration` 登记 `0001` / `0002` / `0003`。

**未纳入本次裁定（v0.3 新增留白）**：`platform_withdraw`（R103 / §15 #3）、R15 分录双字段（§15 #1）、P0 migration 与 DDL 实测（§16 #1/#2/#3），以及「强制下架罚款」若将来要做须新定 kind（见 19.8.B）。---

### 19.9 P1f 收口登记（Zang · P1e/P1i/F3 + P1g 改名，v0.4）

> **本节性质**：**P1e 独立质检判定不通过**（3 条真缺陷：①【高】幂等派生键碰撞 ⇒ 无关业务事件被静默丢弃却报成功；②【中高】未映射 SQLSTATE 面成立 ⇒ 调用方可构造 `500`；③【中】`LD025/026/027` 三条 `503` 投影全为死代码 + 函数内 `set_config(statement_timeout,…)` 实测**无效**）⇒ **修三缺陷** ⇒ **复验通过**（F1 14/14；F2 52 例闭集全绿且 `unmapped_escape = 0` / `status_500 = 0` / `not_in_closed_set = 0`；F3 六项真机读数全取；`tsc --noEmit` 0 error；`ledger-smoke` 29/0；`ledger-smoke-db` 11/0）。本节登记 v0.4 的**契约变化**与落位索引，并单列 **§19.9.F 发现的不一致**。
> **效力**：本节与上游条文冲突时**以本节为准**。§19.0–§19.8 编号不重排，P1f/P1g 内容全部追加于此。
> **规则总数不变（R1–R108，108 条）**；本版**不新增任何错误码**（§14.1 的 33 个关闭集不动）。
> **真源（本节所有读数与逐字值的出处）**：`backend-ts/.p1f-artifacts/p1f-acceptance.md`（§3 TS 四处改动逐字 diff / §4 `§D2` 四条款 / §7 F3 读数 / §10 未验证面 / §11 S1–S12 清单）、`backend-ts/.p1f-artifacts/p1f03-f3-readings.json`（F3 原始读数）、`backend-ts/.p1g-artifacts/p1g-acceptance.md`（§4/§8/§9）与 `impact-inventory.md`、`backend-ts/migrations/0005_ledger_event_root_key.sql`（1407 行）、`0006_user_to_users.sql`、`backend-ts/src/ledger.ts`、`ledger-errors.ts`。**未从真源读到的一律标「未验证/无法核对」，不补看起来合理的值。**

#### 19.9.A §11 S1–S12 逐条落位表（P1f）

| S# | 应写成（v0.4 口径） | 正文落位 | 说明 / 旧写法留痕 |
| - | - | - | - |
| S1 | bucket 纪律冻结为**可机读**：`input ⇒ 400 类` / `integrity ⇒ 400 \| 404 \| 409（绝不 500）` / `retryable \| infra ⇒ 503` / `defect ⇒ 500`；追加判据「**500 类码只可能来自 `defect` 桶**」 | §14.3 附、§19.9.C | 修前口径把 `integrity` 一律钉成 400，与 §14.1 的 `404/409` 冲突（探针公式过严而误报红） |
| S2 | 400 `LEDGER_AMOUNT_INVALID` + `reason = 'AMBIGUOUS_AMOUNT'`（两字段同时出现） | §8.3 R72 v0.4 块 | 修前被**静默接受 200**（M31） |
| S3 | 400 + `reason = 'EXPONENT_NOT_ALLOWED'`（`amount:'1e5'`） | §8.3 R72 v0.4 块 | 修前被静默接受 200（M43） |
| S4 | 列 `event_root_key` + 索引 `idx_ledger_event_root_key` + 守卫 `ledger_event_root_guard`；查询口径 = **归属列优先、历史行键精确等值兜底** | §2.1 v0.4 块、§12.1、§6.2 v0.4 块 | v0.3 无此列/守卫/索引 |
| S5 | 预算助手语义：`10000` / `3000` / `min(3s, 剩余)` / 逾期 ⇒ `LD026 reason=statement_budget_exhausted` | §11.2 R82 v0.4 块、§19.9.B | 修前「假上限」（`set_config` 无效） |
| S6 | **新增（显式否证）**：`statement_timeout` **绕过** plpgsql 处理器；`57014` 原样逃出；只有 `lock_timeout` 可接 | §11.2 R82 v0.4 块 (4)、§16 #7、§19.9.B | v0.3 隐含「§E 单一处理器接住一切」 |
| S7 | `LD025 = LEDGER_LOCK_TIMEOUT(503)` / `LD026 = LEDGER_TX_TIMEOUT(503)` / `LD027 = LEDGER_DEADLOCK_RETRY_EXHAUSTED(503)` | §14.1 #26/#27/#28、§14.3 附 | 三条投影修前全是死代码，`55P03/40P01/57014` 原样逃出 |
| S8 | R60 追加 `LD027`（TS `RETRYABLE_SQLSTATES` **必须**含）；`40001/40P01` 保留为函数外原始码 | §7.3 R60 v0.4 块、§14.1 #28 | 不同步 = 死锁不再重试 = R60 形同失效 |
| S9 | 键字符集闸：禁 `#`（`RESERVED_SEPARATOR`）/ 禁 C0·DEL（`CONTROL_CHARACTER`），与 DB `v_key ~ '[[:cntrl:]]'` **同集**；作用于**每一个** `idempotency_key` 位置 | §6.2 R49 v0.4 块 | v0.3 只写前缀要求 |
| S10 | 基础设施类 ⇒ `LEDGER_TX_TIMEOUT` **503**；**显式排除** `08P01`（⇒ `500` 缺陷告警）与 `57014`（移交 SQLSTATE 表分支） | §14.1 #27、§14.3 附 | 修前 infra SQLSTATE 全落 `500` 兜底 |
| S11 | `M31b_amount_only_over_cap` 的 DETAIL `value` = R72 语义下**换算后的最小单位**（`"100000000000000100"`），**不是**入参原值 | §8.3 R72 v0.4 块 (5) | 防误读 |
| S12 | 「最坏等待」声明改为**语句级**预算上限 `10000ms`（实测 DB 侧 `10142ms` / 客户端 `11283ms`，端到端另计） | §11.2 R82 v0.4 块 (3)、§16 #6、§19.9.B | 旧宣称最坏 `48000ms`（出处 `docs/seafood.master-plan.md` D-03 行，非本册） |

#### 19.9.B 两条**必须原样写入、不得美化**的诚实口径

**（B1）预算钳的是「语句级」≤10s，端到端**不是****
- 机读上限 = **单条语句**（= 一个业务事件）`ledger_stmt_budget_ms() = 10000ms`。
- **实测（不得改写为「端到端 ≤10s」）**：落盘原始读数 `p1f03-f3-readings.json` → `total_wait_chain`（run tag `H262V`，6 持锁者 / 单键 `ops:p1k:H262V:chain6`，`spacing_ms = 2600`）：**DB 侧单语句 `max_db_elapsed_ms = 10142`**（39 次 `pg_stat_activity` 取样；`last_row.db_elapsed_ms = 10141.602`）、**客户端总耗时 `measured_total_wait_ms = 11283`**、`client_overhead_ms = 1141`、`clamped_to_le_10s = true`、`rows_written_0 = true`。
- `p1f-acceptance.md §7.5` 引用的是**更早一轮**（run `GT4OR`）读数：DB 侧 `10106` / 客户端 `10897` / 开销 `791`。**两轮都 > 10s 的端到端**，差值全部来自客户端 / 连接开销（**+0.8~1.3s**），不是等待被累加。
- 对照：**修前**同场景 `15583ms`；**旧宣称最坏 `48000ms`**。⇒ **累计等待的乘法效应确已被预算钳住**，但「可机读上限 10s」**应理解为语句级而非端到端级**；「端到端 ≤10s」**未验证、也未实现**（§16 #6）。

**（B2）`57014` 不可能在函数内转码；`LD026` 的唯一产生源是预算助手**
- `statement_timeout` **绕过** plpgsql 的 `EXCEPTION` 处理器：`stmt_timeout_catchable_by_plpgsql = **false**`、`statement_timeout_bypasses_plpgsql_handler = true`（逃逸矩阵 5 组对照 A1/A2/B1/B2/B3 + 附测 B4/B5 一致）；真拿到 `57014` 的旁证（独立语句先 `SET statement_timeout='600ms'`、`SHOW` 回读确认后再调函数）：`final_sqlstate = 57014`、`final_detail_raw = null`（**未被 §E 处理器接住**）、`raw_57014_escaped = true`、`rows_written_0 = true`。
- `lock_timeout` 则**可以**被接住：`lock_timeout_catchable_by_plpgsql = **true**`（B2 组内层捕获 `55P03` 后改抛 `ZZ999`）；B4 组（`lock_timeout` + 无 handler + 等锁）实测**未观测到 `55P03`**（见 §19.9.F 第 2 条）。
- ⇒ **`LD026` 的唯一产生源 = 函数内自证预算**（`ledger_arm_lock_timeout` / `ledger_check_budget`，预算耗尽 `reason = 'statement_budget_exhausted'`：实测 `remaining_ms = -1001` / `-1` 两个读数，`stage = 'unit_probe'` / `'lock:wakeup'`）。
- ⇒ **禁止**把本册写成「§E 处理器接住 `57014` 再转码为 `LD026`」；`57014` 只能由 **§C 分类器**归类（`bucket = 'retryable'` → `LEDGER_TX_TIMEOUT`；TS 侧 `503`，DETAIL 不带 `reason`（即 `{}`），因为它走 SQLSTATE 表分支而**不是** `infraSqlstateReason`）。
- 另注（同源事实）：`set_config('statement_timeout', N, true)` 对**它自己那条语句无效**（同语句 `set_config(1500,true)` + `pg_sleep(4)` = 4311ms 未被取消；`is_local=false` 亦 4193ms 未被取消；对照「独立语句 `SET`」在 1705ms 被取消）⇒ 对「一条语句 = 一个业务事件」的形态，**唯一**引擎无关且实测有效的语句级约束就是本节的自证预算。

#### 19.9.C §14 系列落位（不新增码 + bucket 纪律冻结 + reason 枚举登记）

- **不新增错误码**：`LD025/LD026/LD027` **不是**新码 —— 它们是 DB 侧自定义 SQLSTATE，MESSAGE 分别是既有的 `LEDGER_LOCK_TIMEOUT` / `LEDGER_TX_TIMEOUT` / `LEDGER_DEADLOCK_RETRY_EXHAUSTED`（§14.1 #26/#27/#28）。TS 侧 `LEDGER_SQLSTATE_TO_CODE` 三条映射与 DB 侧**同码**（`LD025→LOCK_TIMEOUT` / `LD026→TX_TIMEOUT` / `LD027→DEADLOCK_RETRY_EXHAUSTED`）。
- **映射表 + bucket 纪律 + 五类 reason 枚举**：就地落在 **§14.3 附（v0.4 新增）**，`details` 形状就地落在 **§14.4**（`LEDGER_LOCK_TIMEOUT` / `LEDGER_DEADLOCK_RETRY_EXHAUSTED` 各自**单列**；`LEDGER_TX_TIMEOUT` 补「预算耗尽」与「基础设施类」两形状）。
- **`08P01` 归 `500 protocol_violation`**：DB §C 分类器与 TS `normalizeLedgerError` **两侧一致**（DETAIL `{ cause: '08P01', reason: 'protocol_violation', error_name: 'ProtocolViolation', pg_code: '08P01' }`；`bucket = 'defect'`）⇒ 它是**我方连接配置缺陷**（如向 pooler 传 `options=`，实测被拒），**不是**瞬时故障，**刻意排除在 infra 之外**。
- **§14.3 裁定（形状非法 vs 不存在）**：`cid` / `uid` **形状非法 = 参数校验失败 = `400`**（`LEDGER_AMOUNT_INVALID` + `reason = 'NOT_STRING' | 'NOT_DECIMAL_INTEGER' | 'OUT_OF_BIGINT_RANGE' | 'MISSING'`）；**形状合法但目标不存在 = `404`**（`LEDGER_ACCOUNT_NOT_FOUND` / `LEDGER_CURRENCY_NOT_FOUND`）。§14.3 原写「uid/cid 格式非法 ⇒ `404`」**是错的**，已就地标作废（留痕）。残留偏差见 §19.9.F 第 6 条。〔**🆕 v0.5 枚举补充（留痕）**：本条 v0.4 口径**未枚举 `cid <= 0`（与负数）** ⇒ **v0.5 就地枚举为三类，`cid <= 0` 与负数归「形状合法但不存在 ⇒ `404`」**（依据：`currency.cid` 是正整数序列）；详见 §14.3 **v0.5 枚举块** ③ 与 §18 **v0.5 行**。本条 v0.4 原文字保留。〕
- **分类器实现纪律**：`ledger_error_for_sqlstate(state, constraint)` 必须**全定义域、永不返回 NULL**（任何未登记 SQLSTATE 落 `defect` + `LEDGER_TRANSACTION_REQUIRED` + `unclassified_db_error`）；`bucket` 与 `retryable` 由 bucket 派生（`retryable = bucket IN ('retryable','infra')`）。

#### 19.9.D 改名（D11）落位（P1g）

- **事实**：身份表已由 `backend-ts/migrations/0006_user_to_users.sql` 从 `public."user"` 改名为 **`public.users`**；关联对象**全部改名**：约束 `users_pk` / `users_evm_uniq` / `users_evm_fmt` / `users_uid_positive` / `users_*_not_null`×6、独立索引 `idx_users_evm_lower`、identity 序列 `users_uid_seq`；**列名一个未动**（`uid bigint IDENTITY` / `evm` / `bio` / `is_admin` / `time_reg` / `time_login_last`）。
- **不做的事（诚实边界）**：本迁移**未触碰** `neon_auth."user"`（Neon Auth 自有表，本库有 4 条 FK 指向**它**，与 D11 无关）；**未消除** `user` 保留字行为（改后 `SELECT count(*) FROM user` **依旧**静默返回 `current_user` 的 1 行）—— 消除的是**事故类别**（正确表名 `users` **不是**保留字；写错时无同名表可被「碰对」，`42P01` 立现）。**不得**表述为「陷阱已消除」（§16 #11）。
- **活文档引用已同步（本册 6 行）**：§2.2 **R21**（`:216`）、§13.2 「真实用户 uid 恒为正整数」（`:667`）、§13.3 **R98** 附注（`:675`）、§15 决策表 **#8**（`:789`）、§16 **未实测 #5**（`:815`，并注明 `users` 建表语句**现由 `backend-ts/migrations/0002_user_identity.sql` 提供**）、§17 索引 **R21**（`:852`）。⇒ `"user"."uID"` 一律改为 **`"users".uid`**；同时更正「该列现为 `bigint`、v0.1 实测的 `text`/`integer` 类型分叉**已由 `0002` 消除**」。
- **未由本轮改动（按授权范围）**：`docs/seafood.master-plan.md` 的改名同步**不在本轮授权范围**（派单只授权本册 + 版本快照 + QA 读数）⇒ 本轮**未动该文件**；事实是该文件**已由另一写者在同一时间窗内更新**（`master-plan v0.18`，`mtime 2026-09-27 15:18:46`：`§5.7` **硬1 作废、新增硬1′**（「业务身份表 = `public.users`；一律写 `users` 不写 `user`；不得描述为『陷阱已消除』」）、新增 `§5.14`（D11 执行完毕 / `0006` / checksum `4aa19b148700`）与两条既有缺陷记录）。`docs/versions/ledger.spec.v0.1.md` / `v0.2.md`（各 6 行）与 `docs/qa/p0-acceptance.md`（4 行）/ `p1-ledger-concurrency.md`（1 行）按**版本快照 / 取证读数**纪律**只加注不改写**（各加 1 行注记，原读数逐字节保留）。详见 §19.9.F 第 5 条与交付报告。

#### 19.9.E 落位索引（逐处对号）

| 项 | 正文落位（逐处） |
| - | - |
| 键字符集收紧（S9） | §6.2 v0.4 块 (1)(2)、§17 R49、§14.3 附（键类 reason） |
| 重放精确归属（S4 / F1②） | §2.1 v0.4 块 (1)–(5)（含 DDL 列/索引/守卫）、§12.1（清单 11→12、R96 注）、§6.2 v0.4 块 (3)(4)、§11.1 判据 8 v0.4 块、§17 R51/R52、§19.5 补注 |
| `LD024 derived_key_collision`（缺陷，非 409） | §6.2 v0.4 块 (4)、§14.1 #25、§14.3 附（缺陷类 reason）、§19.5 补注 |
| R60 + `LD027`（S8） | §7.3 v0.4 块 (1)–(4)、§14.1 #28、§14.4 单列、§17 R60 |
| 金额二选一 / 指数形式（S2 S3 S11） | §8.3 v0.4 块 (1)–(6)、§17 R70/R72、§14.3 附（金额类 reason） |
| R82 预算口径改写（S5 S6 S12） | §10.3 v0.4 块 (1)–(5)、§14.1 #26/#27、§14.3 附（事务/基础设施类 reason）、§15 #19、§17 R82、§16 #6/#7/#8 |
| 判据 8 键族归组（S1 相邻） | §11.1 判据 8 v0.4 块 (1)–(4)、§16 #10 |
| §14 系列（S1 S7 S10 + 裁定） | §14.1 #25–#28（扩写）、§14.3（uid/cid 形状行更正 + **新增 §14.3 附**）、§14.4（三条单列/补形状） |
| §19.5 单语句 = 隐式事务 | §7.1 v0.4 bullet、§19.5 三条补注、§17 R51 |
| 改名（D11） | §0.2 注、§13.2、§13.3 R98、§15 #8、§16 #5/#11、§17 R21、§19.9.D |
| 诚实边界补 6 项 | §16 #6–#11（表头 5 → 11） |

#### 19.9.F 发现的不一致（按 Zang 要求单列；真源之间矛盾时**以代码与实测读数为准**）

1. **`p1f-acceptance.md §7` 的引数与它自己声称的原始读数文件不是同一轮**。报告 §7 声称读数出自 `p1f03-f3-readings.json`（「1311 行，34,438 字节」，运行窗 `06:56:10Z → 06:57:56Z`，run tag `GT4OR`）；**现盘文件**为 1311 行 / **34,475 字节** / mtime `2026-09-27 15:04:52 CST`，其 `run = H262V`、`total_wait_chain.key = ops:p1k:H262V:chain6`、`db_side_sampled_wait_ms.last_row.qs = 2026-09-27 07:04:31Z`（≈15:04 CST）⇒ **该文件已被 07:04Z 的一轮覆盖**。逐项差异（报告 §7 ↔ 现盘 json）：chain6 客户端总等待 `10897` ↔ **`11283`**；DB 侧 `10106` ↔ **`10142`**；客户端开销 `791` ↔ **`1141`**；终局码 `LD025 / LEDGER_LOCK_TIMEOUT（lock_timeout_ms = 0）` ↔ **`LD026 / LEDGER_TX_TIMEOUT（reason = statement_budget_exhausted, stage = 'lock:wakeup', remaining_ms = -1）`**；`55P03` 第一次/重试用时 `3208 / 264` ↔ **`3244 / 207`**；死锁等锁 `839`（直调）/ `921`（API）↔ **`163` / `1146`**；死锁 API 耗时 `4068` ↔ **`4265`**；`57014` 用时 `869` ↔ **`790`**。**口径建议（本版采用）**：以**落盘 json 为原始读数**、报告文本视为**更早一轮**；两轮**结论方向一致**（`clamped_to_le_10s = true`、`rows_written_0 = true`、不双扣），故 S12/B1 的**量级**结论不受影响，但**终局码**与**端到端数值**应以后续轮的 json 为准（本版 §11.2 R82 v0.4 块已按「两轮并列 + 标注差异」写，未擅自二选一）。**待 Zang 裁定是否需要统一为一轮。**
2. **报告 §7.3 的一条判据行与落盘读数相反**：报告写 `lock_timeout_lockwait_raw_55P03_when_no_handler = true`；现盘 json 的 `escape_isolation_57014.verdicts.lock_timeout_lockwait_raw_55P03_when_no_handler = **false**`（B4 组 `sqlstate_seen = None`、`caught = False`）⇒ **该格未被读数支持**。本版 §19.9.B 只引用被两侧一致的判据（`stmt_timeout_catchable_by_plpgsql = false`、`lock_timeout_catchable_by_plpgsql = true`、`statement_timeout_bypasses_plpgsql_handler = true`），并如实标注 B4 组的反例。
3. **派单所述 `0005_ledger_event_root_key.sql` = 1288 行；实测 1407 行**（`wc -l`）。本册按 **1407 行**登记（§19.9 真源行）。
4. **派单所述「旧声明：函数内 `set_config(statement_timeout,10000)` 生效」在 `docs/ledger.spec.md` v0.3 正文中并不存在**（v0.3 全文 `grep set_config` = 0 命中）。该声明实际出现在 **`docs/seafood.master-plan.md:243`（裁定 B）与 `:209`（D-03 行）**、**`docs/qa/p1e-db-function.md:33/37/83/91`**，以及实现侧 `0004` 的 C1 段注释里。⇒ 本版在 spec 中**新增一条显式否证行**（§11.2 R82 v0.4 块 (1)），**「删除」在 spec 层面无事可删**；另注：v0.3 正文的 R82 只写了「必须设置 `lock_timeout` / `statement_timeout`」这句**未被推翻**的主张（真正被推翻的是「函数内 `set_config` 能给出语句上界」的机制）。
5. **派单 §D 的 6 个 spec 行号逐条复核全部命中，无偏移**（`:216` / `:667` / `:675` / `:789` / `:815` / `:852`）—— 已全部改为 `"users".uid`（活引用归零）。`grep -rn '"user"' docs/` 实测：**本轮开工时 = 6 文件 26 行**（`master-plan` 3 / 本册 6 / `v0.2` 6 / `v0.1` 6 / `qa/p1-ledger-concurrency` 1 / `qa/p0-acceptance` 4 —— 与派单所载**逐字一致**）；**本轮收工时 = 7 文件 33 行**：本册 6 → **5**（该 5 处全在 §19.9 内，是**改名留痕的历史叙述**（旧表名 / `neon_auth` 同名表 / 硬1 原文引用），**不是活引用**）；`master-plan` 3 → **5**（**由同一时间窗内另一写者的 `master-plan v0.18` 改动所致，mtime `15:18:46`，本轮未触碰该文件**）；`v0.1` / `v0.2` / `qa/*` 行数**不变**（只加 1 行注记，原读数逐字节保留）。⇒ 结论：**本册 6 处活引用全部改为 `users`**；`master-plan` 的改名同步由 `v0.18` 自行完成（`§5.7` 硬1 作废 → 新增硬1′），本轮未改该文件（授权范围外）。
6. **§14.3 裁定「`cid` 形状非法 ⇒ `400`」在 TS 侧有一处残留偏差**：`src/ledger.ts:toCid` 对 `cid <= 0` 抛 `LEDGER_CURRENCY_NOT_FOUND`（`404`），**未**走 `400` 形状闸（DB 侧 `ledger_strict_text` + `ledger_int_amount` 已是 `400 LEDGER_AMOUNT_INVALID`）。同理 `toUid` 对 `< -99` 抛 `LEDGER_RESERVED_UID`（`400`，**与裁定相容**）。⇒ **按裁定，TS 侧 `toCid` 这一处待实现方收敛**（本册只登记口径，不改代码）。〔**🆕 v0.5 更正（留痕）**：本条当时的「收敛方向」**已随 Zang 重新裁定反转** —— v0.4 把 `cid <= 0` 读成「形状非法 ⇒ `400`」，故当时要求 TS 侧由 `404` 收敛到 `400`；**实测 DB 侧 `ledger_cid_arg('0')` / `('-5')` 恒为 `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / `404`**（`p1n-tocid-shape-before.json` run `I0AUQ` 与 `-after.json` run `I5JZU` **两轮一字未变**）⇒ **改前两侧本来就一致**，收敛到 `400` 反而**人为造出了一处不一致**。Zang 已重新裁定：**`cid <= 0` 与负数 = 形状合法但不存在 ⇒ `404`**（`currency.cid` 是正整数序列，非正值构造上不存在；详见 §14.3 **v0.5 枚举块** ③ 与 §18 **v0.5 行**）⇒ **本条的待办应读作「TS 侧 `toCid` 收敛回 `404 LEDGER_CURRENCY_NOT_FOUND`」**；〔**v0.5 当时现状 —— ⚠️ 已过时（v0.6 已翻转，见本条下方 v0.6 更正块）**〕`src/ledger.ts` 的 `toCid` 为 `400 LEDGER_AMOUNT_NOT_POSITIVE`（`p1n-tocid-shape-after.json` `ts_cases.A1/A2/A3/A4/A8` 实测），该现状与 v0.5 裁定不符、待实现方收敛 ⇒ **现状已翻转为「已收敛回 `404`」**（`backend-ts/src/ledger.ts` 的 `toCid` 现为 `LEDGER_CURRENCY_NOT_FOUND` / `404` / `details = { cid }`，与 DB 侧 `ledger_cid_arg` **逐字一致**；**本册 `read_file` 自核代码**；三段并列读数与 TS/DB 对拍表见本条 **v0.6 更正块**）。本条原文字保留以留痕，不作静默重写。〕
7. **（口径提示，非矛盾）** 两处「读数的语义」容易被误读，已在正文显式标注：① `M31b_amount_only_over_cap` 的 DETAIL `value = "100000000000000100"` 是**换算后的最小单位**（§8.3 R72 v0.4 块 (5)）；② `p1f-acceptance.md §7.7` 的测试数据分区（uid `944xxx` / symbol `P1K…` / 键 `ops:p1k:*`）与 json 的实际 run tag（`H262V`，而报告 §7.7 写 `GT4OR`）**不同** —— 同属第 1 条的「两轮混记」。

**§19.9.F 第 6 条 v0.6 更正块 —— 现状翻转：`toCid` 已收敛回 `404`（事一）**

> **改写范围**：**只翻转「现状」那一句**；**v0.4→v0.5 的历史叙述（含 v0.5 当时现状「TS 侧 = `400 LEDGER_AMOUNT_NOT_POSITIVE`、待收敛回 `404`」）一字不改**，仅在原句处标注为**已过时**（见上条 item 6 正文）。**原文保留、不静默重写**（本册一贯纪律）。
>
> **现状（v0.6 · 已核）**：`backend-ts/src/ledger.ts` 的 `toCid` 为 ——
> `const c = toAmount(cid, 'cid');` / `if (c <= 0n) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: c.toString() });` / `return c;`
> ⇒ **`LEDGER_CURRENCY_NOT_FOUND` / `404` / `details = { cid }`**，与 DB 侧 `ledger_cid_arg` 的 `ledger_raise('LEDGER_CURRENCY_NOT_FOUND', {"cid": v_c::text})` **逐字一致**。（**本册自行 `read_file` 核过代码**，**不是**转抄实现方报告 —— 本仓库刚出过「转抄过期状态」的事。）
>
> **三段并列读数（真源、均 run-tagged；文件名逐字）**
>
> | 段 | 文件（`backend-ts/.p1f-artifacts/`） | run | 起始时刻（UTC） | TS 侧 `cid ∈ { 0, '0', '-5', '-9223372036854775808' }` 读数 |
> |---|---|---|---|---|
> | **修前** | `p1n-tocid-shape-before.json` | `I0AUQ` | 2026-09-27T07:29:44Z | `LEDGER_CURRENCY_NOT_FOUND` / **`404`** / `{ cid }`（`ts_cases.A1` / `A2` / `A3` / `A4` / `A8`）⇒ ✔ 与 DB 侧一致 |
> | **修后（人工造出的不一致）** | `p1n-tocid-shape-after.json` | `I5JZU` | 2026-09-27T07:33:49Z | `LEDGER_AMOUNT_NOT_POSITIVE` / **`400`** / `{ field:'cid', value }`（同 5 例）⇒ ✖ 与 v0.5 裁定不符 |
> | **回退（＝现状）** | `p1n-tocid-shape-revert-IE4VH.json` | `IE4VH` | 2026-09-27T07:40:30Z | **`LEDGER_CURRENCY_NOT_FOUND` / `404` / `{ cid }`**（`A1` / `A2` / `A3` / `A4` / `A8` / `A14`）⇒ ✔ **已收敛回 `404`，与 DB 侧逐字一致** |
>
> **TS/DB 对拍表（以现状 = run `IE4VH` 一轮为准；DB 列 = 同轮 `db_cases` / `db_path_cases`）**
>
> | 用例 | TS（`p1n-tocid-shape-revert-IE4VH.json`） | DB（同轮） | 判定 |
> |---|---|---|---|
> | `cid = 0`（JSON number） | `LEDGER_CURRENCY_NOT_FOUND` / `404` / `{ cid: "0" }`（`A1`） | `ledger_cid_arg('0')` = `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / `404` / `{ cid: "0" }`（`B1`）；`ledger_post_event` 同（`P1`） | ✅ **逐字一致** |
> | `cid = '0'`（string） | 同上（`A2`） | 同上（`B1`） | ✅ 一致 |
> | `cid = '-5'` | `404` / `{ cid: "-5" }`（`A3` / `A14`） | `ledger_cid_arg('-5')` = `LD007` / `404` / `{ cid: "-5" }`（`B2`）；`P2` 同 | ✅ 一致 |
> | `cid = '-9223372036854775808'`（`bigint` 下界） | `404` / `{ cid: "-9223372036854775808" }`（`A4`） | `ledger_cid_arg(...)` = `LD007` / `404` / 同（`B10`） | ✅ 一致 |
> | `cid = 'abc'`（形状非法 · 控制组） | `LEDGER_AMOUNT_INVALID` / `400` / `reason = NOT_DECIMAL_INTEGER`（`A5` / `A9`） | `LD016` / `400` / `NOT_DECIMAL_INTEGER`（`B3` / `B4`；`P3` 同） | ✅ **同码 / 同 status / 同 reason** |
> | `cid = ''`（空串 ⇒ 形状非法） | `400` / `NOT_DECIMAL_INTEGER`（`A11` / `A12`） | `LD016` / `400` / `NOT_DECIMAL_INTEGER`（`B8`；`P4` 同） | ✅ 一致 |
> | `cid = 缺失` | `400` / `LEDGER_AMOUNT_INVALID` / `reason` = **`BAD_TYPE`**（`A13`） | `LD016` / `400` / `reason` = **`MISSING`**（`P6`） | ⚠️ **仅 reason 名不同** ⇒ v0.6 裁定 **TS 对齐为 `MISSING`**（见 §14.3 v0.6 增补块 (B) / §19.10.D） |
> | `cid = '999999999999'`（形状合法 · 该行不存在） | 读接口 `getCurrency` **不抛、返回 `null`**（`A7`；`getCurrency('93')` 同，`A6`） | 闸放行返回原值（`B9`）；写路径 `ledger_post_event` = `LD007` / `404`（`P5`） | ✅ 语义一致（读接口「没有就 `null`」、写接口「没有就 `404`」） |
>
> **结论（可机读 · 供下游对号）**：**① `cid <= 0` / 负数的两侧一致性已恢复**（TS = DB = `404 LEDGER_CURRENCY_NOT_FOUND` + `details = { cid }`；对拍表 ✅ 五行，`B1` / `B2` / `B10` / `P1` / `P2` 亦与该口径同）；**② `cid` 形状非法两侧同码同 status 同 reason**（✅ 两行）；**③ 唯一残留差异 = `cid` 缺失的 reason 名**（TS `BAD_TYPE` ↔ DB `MISSING`），已由 v0.6 裁定对齐（**只改 reason 名，状态类不动**）；**④ 本表未出现的用例一律标「未核对」，不补造读数** —— 特别注意：**TS 侧「超 `bigint`」用例在 `IE4VH` 一轮中不存在**（该轮 `ts_cases.A1`–`A14` 无此形状），而读路径超 `bigint` 的逃逸缺陷正是 §14.3 **v0.6 增补块 (A)** 那一项，**该轮未覆盖**。

**未纳入本次裁定（v0.4 新增留白）**：`platform_withdraw`（R103 / §15 #3）、R15 分录双字段（§15 #1）、「强制下架罚款」若要做须新定 kind（§19.8.B）、以及 **`docs/seafood.master-plan.md` 的改名同步**（§19.9.F 第 5 条）与 **TS `toCid` 的形状闸收敛**（§19.9.F 第 6 条）—— 后两项是**已识别、未执行**的待办，非本册遗漏。〔**🆕 v0.6 更正**（只翻转现状，原文保留）：其中 **TS `toCid` 的收敛已执行完毕** ⇒ 该项**不再**是待办（现状 = **已收敛回 `404`**，与 DB 侧 `ledger_cid_arg` 逐字一致，见 §19.9.F 第 6 条 **v0.6 更正块** 与 §19.10.A）；**`docs/seafood.master-plan.md` 的改名同步仍为已识别、未执行**。〕



### 19.10 v0.6 登记（Zang · 四项小修）

> **性质**：本节只登记 v0.6 的**四项小修**（**不新增错误码、不改动 R1–R108、不重排章节编号**）。§14.3 / §16 / §18 / §19.9.F 的**就地增补**是正文，本节是**登记与落位索引**。v0.6 依「**新增一律向后追加**」纪律追加为 **§19.10**（§19.0–§19.9 的编号与节标题不改）。

#### 19.10.A `toCid` 现状翻转：**已收敛回 `404`**（事一）

- **v0.5 时点（留痕，已过时）**：§19.9.F 第 6 条 v0.5 留痕写「TS 侧 `toCid` 为 `400 LEDGER_AMOUNT_NOT_POSITIVE`、**待收敛回 `404`**」。
- **现状（v0.6 · 已核）**：`backend-ts/src/ledger.ts` 的 `toCid` = **`LEDGER_CURRENCY_NOT_FOUND` / `404` / `details = { cid }`**（**本册 `read_file` 自核代码，非转抄**）⇒ **与 DB 侧 `ledger_cid_arg` 逐字一致**，收敛结束。
- **证据（三段并列读数 + TS/DB 对拍表）**：见 **§19.9.F 第 6 条 v0.6 更正块**（三段文件名逐字：`p1n-tocid-shape-before.json`（run `I0AUQ`）/ `p1n-tocid-shape-after.json`（run `I5JZU`）/ `p1n-tocid-shape-revert-IE4VH.json`（run `IE4VH`）；对拍表以 `IE4VH` 一轮为准，TS 与 DB 两侧逐格并列）；§14.3 v0.5 实测对拍表已就地标注「该行现状已在 v0.6 翻转」。**v0.4→v0.5 的历史叙述一字不改。**

#### 19.10.B 读路径「超 `bigint`」逃逸缺陷（事二）—— 裁定与要求

- **裁定与规范要求**：全部落位于 **§14.3 v0.6 增补块 (A)** —— **超 `bigint` ⇒ `400 LEDGER_AMOUNT_INVALID` + `details.reason = OUT_OF_BIGINT_RANGE`**（**与写路径同族，不新增码**）；**`cid <= 0` / 负数仍 ⇒ `404`**；**按类修**（枚举**所有**接收外部 `cid` / `uid` / 金额的**入口点**，**碰 PG 之前**设形状闸）；**新增「逃逸扫描」取证脚本**（矩阵 = 入口点 × 输入形状；三条硬判据 `raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0`；**run-tagged 输出、永不得写固定文件名**）。
- **性质**：本项目**硬口径**（§14.1 的 **33 码关闭集** ＋ `bucket ↔ 状态类` 映射：**不得出现无法归类的错误 / 未映射的原始 SQLSTATE**）的**回归**；属**写路径已灭、读路径漏网**的 **D-02 那一类**。
- **证据口径**：本册**只写裁定与要求，不转抄实现方的读数**；复现读数（`code = 22003` / `status = undefined` / `mapped = false`，message = `value "99999999999999999999999" is out of range for type bigint`）由 **Zang 亲跑**提供。**修后读数待回填** ⇒ **§16 #12**（现标**未核对**）。

#### 19.10.C 两条「不是确定性判据」的读数（事三）

1. **子探针跳运行不稳定**：`p1f-acceptance.md` §7.3 的子探针 `lock_timeout_lockwait_raw_55P03_when_no_handler` —— 一轮 **`false`**（`.p1f-artifacts/p1f03-f3-readings.json`，run `H262V`）、一轮 **`true`**（`.p1f-artifacts/p1f03-f3-readings-I5XPD.json`，run `I5XPD`）⇒ **不得当确定性判据**（**禁止**写成硬断言）。**稳定可用**的替代只有这一对（两轮一致）：`lock_timeout_catchable_by_plpgsql = true`、`statement_timeout_bypasses_plpgsql_handler = true`（且 `stmt_timeout_catchable_by_plpgsql = false`）。
2. **`chain` 用例（6 持锁链）终局码有两个合法值**：**`LD025`**（末次等锁先撞 3s `lock_timeout`）或 **`LD026`**（10s 自证预算先耗尽）—— 两轮各命中一个（`H262V` ⇒ `terminal_sqlstate = LD026`；`I5XPD` ⇒ `LD025`）⇒ **断言只针对「等待有界」**：机读判据用落盘字段 `terminal_code_legal_set = ["LD025","LD026"]` / `terminal_code_in_legal_set` / `wait_bounded` / `clamped_to_le_10s`，**不得钉死某个码**（**禁止** `terminal_sqlstate === 'LD025'` 这类硬钉断言 —— 下一次运行会随机变红）。

#### 19.10.D `details.reason` 名对齐（事四）

- **裁定**：TS 侧 `cid` **缺失**（`undefined` / 未传）的 reason 由 **`BAD_TYPE`** **对齐为 `MISSING`**（DB 侧同场景 = `MISSING`）；**非字符串类型**（数字 / 对象 / 布尔等）用 **`NOT_STRING`**。**两侧都是 `400 LEDGER_AMOUNT_INVALID` ⇒ 状态类不变**，只是 **reason 名对齐**。
- **现状（本册自核，供实现侧对号）**：`backend-ts/src/ledger.ts` 的 `toAmount` 现为 `throw new LedgerError('LEDGER_AMOUNT_INVALID', { field, reason: 'BAD_TYPE' })` —— **同一分支同时覆盖「缺失」与「非字符串类型」两种情形** ⇒ 待实现侧按本裁定**拆成两格**（`MISSING` / `NOT_STRING`）。
- **枚举影响**：§14.3 的 reason 枚举**不新增 / 不删除** —— `MISSING` 与 `NOT_STRING` 本来就在 v0.5 枚举块 ① 的四值集合内；`BAD_TYPE` 仍是 §14.3 既有业务类 reason 之一，仅**不再用于本格**。

#### 19.10.E v0.6 落位索引（逐处对号）

| 项 | 正文落点 | 登记 / 索引 |
|---|---|---|
| ① `toCid` 现状翻转（已收敛回 `404`）+ 三段并列读数 + TS/DB 对拍表 | §19.9.F 第 6 条正文（「现状」那句标为已过时并翻转）＋ **§19.9.F 第 6 条 v0.6 更正块** ＋ §14.3 v0.5 实测对拍表就地注记 | §19.10.A；§18 v0.6 行 ① |
| ② 读路径超 `bigint` 逃逸缺陷：裁定 + 按类修 + 逃逸扫描脚本要求 + 三条断言 | **§14.3 v0.6 增补块 (A)**（规范要求）＋ §16 **#12**（修后读数待回填） | §19.10.B；§18 v0.6 行 ② |
| ③ 两条「不是确定性判据」的读数（子探针不稳定 / `chain` 两合法码） | **§14.3 v0.6 增补块 (C)** ＋ §16 **#13** | §19.10.C；§18 v0.6 行 ③ |
| ④ `reason` 名对齐（`MISSING` / `NOT_STRING`） | **§14.3 v0.6 增补块 (B)** ＋ §19.9.F 第 6 条 v0.6 更正块对拍表中「`cid = 缺失`」行 | §19.10.D；§18 v0.6 行 ④ |

- **未执行（已识别，非本册遗漏）**：② 的**按类修**与**逃逸扫描脚本**、④ 的 **reason 名拆分** **均由实现侧执行**；本册只登记**裁定与要求**（§0.2 分工）。**这两项在实现侧落地并有 run-tagged 读数之前，一律读作「未验证」**（§16 #12）。〔**🆕 v0.7 更正（只翻转现状，原文保留）**：② 的**按类修**与**逃逸扫描脚本**已在实现侧落地并取得 **run-tagged** 读数 ⇒ **§16 #12 已回填**，该项**不再**读作「未验证」；④ 的 **reason 名拆分**亦已落地（`MISSING` / `NOT_STRING`，见 §14.3 v0.6 增补块 (B) 的 **v0.7 就地更正**）；完整读数与方法论见 **§19.11.A**。〕

### 19.11 v0.7 登记（Zang · 四项小修）

> **性质**：本节只登记 v0.7 的**四项小修**（**不新增错误码、不动 R1–R108、不重排章节编号**）。§14.3 / §16 / §18 / §19.10.E 的**就地增补**是正文，本节是**登记与落位索引**。v0.7 依「**新增一律向后追加**」纪律追加为 **§19.11**（§19.0–§19.10 的编号与节标题不改）。

#### 19.11.A 回填 §16 #12：修后逃逸扫描读数 + 「按类修」方法论事实（事一）

- **真源（run-tagged，均在 `backend-ts/.p1f-artifacts/`；本册 `read_file` 自核后逐字落位，非转抄）**：修后 `p1o-00-escape-sweep-after-MUJJ2PHX.json`（run `MUJJ2PHX`，2026-09-27T07:59:36Z → 08:02:55Z）；修前（终版）`p1o-00-escape-sweep-before-MUJJBPT2.json`（run `MUJJBPT2`，08:06:36Z → 08:11:05Z）；修前首轮 `p1o-00-escape-sweep-before-MUJIUD5J.json`（run `MUJIUD5J`，07:53:07Z → 07:57:55Z，读数同类）。

| 判据 | 修前（run `MUJJBPT2`） | 修后（run `MUJJ2PHX`） |
|---|---|---|
| `raw_sqlstate_escapes` | **33** | **0** |
| `unmapped`（`code` ∉ 33 码关闭集） | **33** | **0** |
| `missing_status` | 0 | **0** |
| `expectation_mismatches` | **154**（首轮 `MUJIUD5J` = 161） | **0** |
| `valid_shape_false_reject` | 0 | **0** |
| 另：`ld_sqlstate_leaked` / `unexpected_500` | 0 / 0 | 0 / 0 |
| 矩阵规模 | **604 格**（实跑 590 + 纪律跳过 14） | 同 |
| `ledger_entry` 行数（不写账本行自证） | 240 → 240（`wrote_no_ledger_rows = true`） | **166 → 166**（同行内字段亦为 `true`） |

- **修前 33 格分型（`escape_cells` 逐格自核）**：`22003` **×30**（3 种形状 = `bigint_max_plus_1` / 23 位 `over_bigint_far` / `bigint` 类型越界 `bigint_type_over`，**全部落在标识符字段** `cid` / `uid` / `before_txid` 上）；`22P02` **×2**（`E-R3_limit` 的 `NaN` / `'abc'`）；`23503` **×1**（`E-W7_getOrCreateAccount(cid = 9223372036854775807)` 的外键 `account_cid_fkey`）。按入口点分布：`E-R3` 9 / `E-W7` 7 / `E-R2` 6 / `E-R1` 3 / `E-W8` 3 / `E-W9` 3 / `E-R3_limit` 2 = **33**。
- **修后**：`failures = []` / `escape_cells = []` / `mismatch_cells = []`；`verdicts` 六项全 `true` ⇒ 三条硬判据（`raw_sqlstate_escapes` / `unmapped` / `missing_status` = 0）**在本矩阵内已归零**。
- **残留登记（未核对）**：修前终版轮 `ledger_entry` 的**绝对读数 = 240**、修后轮 = 166，**两者绝对差值的成因本册未核对**（轮内「前后相等 ⇒ 未写账本行」两轮均成立）。
- **「按类修」方法论事实（可对撞取证）**：
  1. **枚举 17 个入口点**（`entrypoints` 数组长度 = 17：读 `E-R1`–`E-R6` ＋ 写 / 原语 `E-W1`–`E-W11`），**凡接收外部 `cid` / `uid` / 金额者全部在列**；
  2. **闸位全部前移到「碰 PG 之前」**，形状闸 = **唯一共用的 `toAmount`**（`toCid` / `toUid` / `assertUserUid` / `entryToPayload` / `normalizeRef` / `amountToPayload` 全部经它）⇒ **一处收敛 11 个入口点，不是逐点打补丁**；
  3. **修前基线由同一份终版脚本产出（临时 checkout → 跑 → 还原并核 md5）**：修前轮 = 临时 `git checkout` 还原到 HEAD（修前代码）→ 跑**同一脚本、同一组用例** → 跑完**还原修复版并核对 `md5`**；本册自核 `md5 backend-ts/src/ledger.ts` = `9456b5cb72a3a42dd3de26069429ee67`，与报告所述还原后 md5 **一致** ⇒ 修前 / 修后两轮**同一脚本、同一组用例、同一环境**，可直接对撞；
  4. 脚本落盘文件名带 **`phase` ＋ run tag**、**不写固定文件名**（取证纪律在实现侧成立）。

#### 19.11.B 「只准按 `code` 分支」规则 + 「数字」口径更正 + 三处 `reason` 名分歧（事二 / 事三）

- **新规则（规范效力 = §14.3 v0.7 增补块 (A)）**：**调用方只准按 `code` 分支，不得按 `reason` 分支** —— `reason` 是**诊断信息**，**不是契约**；机读判据 `contract_field = "code"` / `reason_is_contract = false` / `reason_branching_allowed = false` / `reason_usage_allowed = ["log","metric","diagnostic","report"]` / `same_code_reason_may_differ_across_layers = true`；违反样例 `if (err.details.reason === 'OUT_OF_BIGINT_RANGE') …`（禁止）。**未发新 R 编号**（R1–R108 不动）。
- **事二 ·「数字」口径更正**：**JSON number 形式的 `cid` / `uid`（含 `0` 与负数）是合法形状**（**数字是 JSON 里标识符的自然表示，不是类型错误**）⇒ 走**存在性判定** ⇒ **`404 LEDGER_CURRENCY_NOT_FOUND`**（`cid`）/ **`404 LEDGER_ACCOUNT_NOT_FOUND`**（`uid`）；**只有「非十进制字符串」与「非数字类型（对象 / 布尔 / 数组）」才 `NOT_STRING` / `400`**。
  - **裁定理由（Zang）**：① `Amount = bigint ｜ number ｜ string` 是既有契约，判 number 为类型错误会把**合法形状**读成 `400`，**与 §14.3 v0.5 枚举块 ③（`cid = 0` ⇒ `404`）直接冲突**；② **实测两轮一致**（本册自核）：JSON **number** `0` 的 `cid` 在 `E-R1` / `E-R2` / `E-R3` / `E-W1` / `E-W2` / `E-W3` / `E-W4` / `E-W5` / `E-W6` / `E-W7` 上**全部** `404 LEDGER_CURRENCY_NOT_FOUND`（run `MUJJBPT2` 与 `MUJJ2PHX` 相同）；③ **非安全整数**（如 `1e23`）仍 `400 LEDGER_AMOUNT_INVALID` + `reason = NOT_INTEGER_OR_UNSAFE`（两轮一致）⇒「数字形状合法」只覆盖十进制整数 / 可安全表示者。
- **三处 `reason` 名分歧（每条**同码、同 status，仅名不同**；裁定**维持现状**）**：正文见 **§14.3 v0.7 增补块 (B)** 表。本册自核的 DB 侧旁证（扫描文件 `db_side` 键逐字）：`ledger_int_amount('9223372036854775808','cid')` = `LD016` + `reason = OUT_OF_BIGINT_RANGE`；`ledger_int_amount('99999999999999999999999','cid')` 与 `ledger_cid_arg('99999999999999999999999')` = `LD016` + `reason = OVER_MAX_SINGLE_AMOUNT`；`ledger_cid_arg('0')` = `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / `404`。**第 2 条（TS `NOT_DECIMAL_STRING` ↔ DB `EXPONENT_NOT_ALLOWED`）的真源 = `p1o-00-acceptance.md` §8.3** —— 该场景**不在扫描文件的 `db_side` 键内**，故本册**只登记出处、不附自核结论**（不补造读数）。
- **读法（可机读）**：`known_reason_name_divergences = 3` / `reason_only = true` / `same_code = true` / `same_http_status = true`。

#### 19.11.C 工作项「错误码命名整理」（事四，不在本册执行）

- **登记**：**排期 = P2/P3 边界一次做完**；本册**只登记、不执行**（§0.2 分工）。四条清单与根因一句话见 **§14.3 v0.7 增补块 (C)**：① 标识符形状错误借用 `LEDGER_AMOUNT_INVALID`；② DB `ledger_int_amount` 对标识符套用金额长度帽 ⇒ `reason` 名错位；③ TS `BAD_TYPE` 拆分（**已修**）；④ 事三的三处 `reason` 名分歧。**根因：关闭集词汇是「金额中心」的，却被长期用于标识符。**
- **边界**：若整理结论指向**新增 / 改名错误码**，**须 Zang 单独发单**（§14.1 的 **33 码**关闭集与编号纪律见 §18 修订纪律 ②）；**`code` 是契约、`reason` 不是**（§14.3 v0.7 增补块 (A)）。

#### 19.11.D v0.7 落位索引（逐处对号）

| 项 | 正文落点 | 登记 / 索引 |
|---|---|---|
| ① 回填 §16 #12（修后读数 ＋ 按类修方法论） | §14.3 v0.6 增补块 (A) **⑤⑥（v0.7 回填）** ＋ §16 **#12**（就地改写，编号与条目数不变） | §19.11.A；§18 v0.7 行 ① |
| ② §14.3 (B)「数字」口径更正 | **§14.3 v0.6 增补块 (B)** 就地更正 ＋ **v0.6 旧写法留痕** | §19.11.B；§18 v0.7 行 ② |
| ③ 「只准按 `code` 分支」规则 ＋ 三处 `reason` 名分歧登记 | **§14.3 v0.7 增补块 (A) / (B)** | §19.11.B；§18 v0.7 行 ③ |
| ④ 工作项「错误码命名整理」（P2/P3 边界） | **§14.3 v0.7 增补块 (C)** | §19.11.C；§18 v0.7 行 ④ |

- **未执行（已识别，非本册遗漏）**：④ 的**工作项本身**、②/③ 中涉及 **DB `0005` 判序**与 **TS 码名**的改动**均不在本册执行**；本册只登记**裁定 / 纪律 / 登记项**（§0.2 分工）。

---

### 19.12 v0.8 登记（Zang · P2 裁定落位 · 四处就地增补）

> **性质**：本节只**登记** v0.8 的四处就地增补（**不新增错误码、不动 R1–R108、不重排章节编号、不新增章节**）。§2.2 R21 / §5.2 R45 / §7.2 #8 / §14.1 #32 的**就地增补**是正文，本节是**登记与落位索引**。v0.8 依「**新增一律向后追加**」纪律追加为 **§19.12**（§19.0–§19.11 的编号与节标题不改）。
> **裁定来源**：`docs/seafood.master-plan.md` **§5.20**（P2 spec 交回的 16 项待裁 —— Zang 逐条裁定，2026-09-27）；本版对应其中 **#2（R45 vs D13）**、**#3 + #5 + #16（费率真源 / 守卫失败类）**、**#4（`commission_payout` / `ref_id`）**、**#6（R21 适用范围）**。**照裁定落位，未自行推导。**

#### 19.12.A R45 已由 D13 取代（§5.20 #2）

- **裁定值**：**D13 胜**（依据：用户口径「1–5% 全额进佣金池分 10 级」+ 判据 M3「`−2` 净额 0」自洽）。
- **落位**：R45 三格就地注记（末句标「已由 D13 取代」；落点格标「不建 `commission_payout` 表」；连带影响格注记「未分配余额不再累积、审计改读 `ledger_entry`」）＋ **§5.2 v0.8 块**（完整口径：分母 `W = Σ 已有层级 weights_bp`、`Σ commission == job_fee` 恒成立、`−2` 事件净额 0 且不留存、无邀请人例外指向 P2 侧）；§17 索引 R45 行同步。
- **留痕**：**v0.7 原文一字未删**（标「已由 D13 取代」+ 划线），符合本册「所有改写一律留痕」纪律。
- **未执行（不在本册）**：权重矩阵数值、算式实现、判据 M1/M3 的机读形式 ⇒ 归 `docs/commission.spec.md` v0.2（§0.2 分工）。

#### 19.12.B §14.1 #32 费率真源更正 + 守卫失败类（§5.20 #3 / #5 / #16）

- **裁定值**：**`commission_policy.fee_rate_bp` 是费率唯一真源**（#3）；**守卫失败类一律 `400`**（`Σweights_bp > 0` 且前 `M` 层不得全零在**政策写入时就拒**，#5 / #16）；**`#32` 仍为 `500` 缺陷类**（语义收紧为「已越过写入守卫」）。
- **落位**：§14.1 #32 行就地更正（v0.7 旧写法列入本格括号留痕）＋ **§14.1 v0.8 增补块**（① 真源与「仅费率键受影响」的边界 ② 写入守卫 `400` 的口径与不得改 `500` 的理由 ③ #32 语义收紧 + 关闭集仍 33 码）；R44 落点格、R68 费率基点句就地注记。
- **未执行（不在本册）**：P2 侧的借码映射与 `reason` 枚举 ⇒ 归 `docs/commission.spec.md` v0.2 §13（**不新增错误码，仍走借码映射**）。

#### 19.12.C §7.2 #8 不建 `commission_payout` 表、`ref_id` = 同一 `job_id`（§5.20 #4）

- **裁定值**：**不建该表**（单语句形态下 `ledger_post_event` 不能写业务表）；**审计真源 = `ledger_entry`**；**`ref_id` = 同一 `job_id`**。
- **落位**：§7.2 #8 的「必须在同一事务内的读写」格就地更正（原文「+ 对应 `commission_payout` 行」划线留痕）＋ §5.2 v0.8 块 ③ 同口径说明；R45 落点格与 §17 索引同步。
- **未执行（不在本册）**：`0007` 迁移与 TS 层实现、`ref_type = 'commission_payout'` 的分录装配 ⇒ 归 Kong（`docs/commission.spec.md` v0.2 §5）。

#### 19.12.D R21 加范围限定（§5.20 #6）

- **裁定值**：**R21 的适用范围 = 账本表**（`account` / `ledger_entry`，其 `uid` 含**合成负值**，不能 FK 到 `users`）；**业务表可以 FK 到 `users(uid)`**。
- **落位**：§2.2 R21 正文末追加范围限定（并给出「本条标题应读作『**账本表**不对 `users(uid)` 建 FK』」的读法）＋ §17 索引 R21 行指针 ＋ §15 #8（`ledger_owner` 辅助表）指针。
- **留痕**：R21 原文（含 v0.1 实测与 v0.4 更正）一字未删。
- **未执行（不在本册）**：P2 两张新表（`referral` / `commission_policy`）的 FK 取舍 ⇒ 归 `docs/commission.spec.md` v0.2 §2（其中 `created_by` 的 FK 已由 §5.20 #9 裁定**去掉**、`referral` 的两列 FK **保留**）。

#### 19.12.E v0.8 落位索引（逐处对号）

| 项 | 正文落点 | 登记 / 索引 |
|---|---|---|
| ① R45 由 D13 取代 | **§5.2 R45 三格就地注记** ＋ **§5.2 v0.8 块** ＋ §17 索引 R45 | §19.12.A |
| ② §14.1 #32 费率真源 + 守卫 `400` | **§14.1 #32 行就地更正** ＋ **§14.1 v0.8 增补块** ＋ R44 / R68 落点注记 | §19.12.B |
| ③ §7.2 #8 不建 `commission_payout` 表、`ref_id` = `job_id` | **§7.2 #8 就地更正**（原文划线留痕） | §19.12.C |
| ④ R21 范围限定 | **§2.2 R21 正文** ＋ §17 索引 R21 ＋ §15 #8 指针 | §19.12.D |

- **交付纪律自检（本版）**：① 四处**全部为就地增补**，未重排任何章节编号、未新增章节（只追加 §19.12）；② **R1–R108 = 108 条不变**、**§14.1 = 33 码不变**；③ 每一处都**同时**保留 v0.7 原文（标「已由 D13 取代」或划线留痕），无静默重写；④ **未连库、未启停服务、未改 `backend-ts/**` / `frontend/**` / `migrations/**`、未 commit / 未 push**。
- **未执行（已识别，非本册遗漏）**：本册的四处增补**不产生任何实现**；`0007` 迁移、TS 层装配、判据脚本均由 P2 派单序列（`R3-P2b` Kong → Neng 质检 → Zang 验收）执行（§0.2 分工）。

---

### 19.13 v0.9 登记（Zang · 三项小修：冻结映射与现实对齐 · 双向映射往返闭合断言 · 反向映射 P1 遗留缺陷登记）

> **性质**：本节只**登记** v0.9 的三项小修（**不新增错误码、不动 R1–R108、不重排章节编号、不新增章节编号**）。§14.3 的 **v0.9 增补块 (A)(B)(C)** 是**正文**，本节是**登记与落位索引**；§16 就地追加 **#14 / #15** 两行，§18 加 **v0.9** 一行。v0.9 依「**新增一律向后追加**」纪律追加为 **§19.13**（§19.0–§19.12 的编号与节标题不改）。
> **裁定来源（诚实标注）**：Zang 裁定 —— 本单**转述自** `docs/seafood.master-plan.md` **§5.23**。🔴 **v0.10 更正：§5.23 正文已核对**（`docs/seafood.master-plan.md` 现为 **v0.27**、HEAD `541dffd`，本册 v0.10 `read_file` 逐字核过该节）⇒ 下面这段「未能核到」的诚实标记**作废**、v0.9 的「按转述落位」免责**不再成立**，逐条对齐见 **§19.14.A**；**原 v0.9 文字留痕如下**：⚠️ **本册未能核到 §5.23 正文**：全仓 `grep -rn '5\.23' docs/` **零命中**，`docs/seafood.master-plan.md`（**737 行**，本册 `wc -l` 自核）**现存末节为 §5.22**（「`0007`/`0008` 验收 + 一个新缺陷：错误码反向映射缺 LD031–LD033」）；master-plan 变更记录（v0.26 行）亦止于 §5.22。⇒ 本册**按转述的裁定值落位、不自行推导**，并**自核了裁定的事实前提**（§14.1 全表状态类分布、`backend-ts/src/ledger-errors.ts`、`backend-ts/src/ledger.ts`、`backend-ts/migrations/0009_*.sql`、`backend-ts/.p2c-artifacts/*.json` —— 逐项见 §14.3 v0.9 (A)(C)）。**若 §5.23 正文与本册写法有出入，以 §5.23 正文为准并回改本册。**
> **§5.22 与本册的关系（留痕 · 避免误读）**：`0009` 迁移与 `p2c-00-code-roundtrip.ts` 文件头自称的权威口径是 **§5.22**；其记录的「最小扩展」把 **`200 ⇒ input`**（原文：「`200 ⇒ input`（幂等重放 = 调用方重复提交；R106 保证它**不进错误分支**）」）。本册 v0.9 按 **§5.23** 的改判把 **`200` 归 `benign_outcomes`（不是错误类、不参与 bucket 校验）** ⇒ 二者**不是矛盾**（都承认 `200` 不是错误路径），是**分类标签的改判**；代码侧待同步项见 **§19.13.C 的「未随本册执行」** 与 **§16 #15**。

#### 19.13.A 冻结映射与现实对齐（三条扩展 ＋ `benign_outcomes` 单列一类）

- **裁定值（逐条）**：① **`403 ⇒ input`**（`LD014` `LEDGER_UNAUTHORIZED_MINT` / `LD015` `LEDGER_HOLD_NOT_ALLOWED`；权限不足 = **调用方身份不对**）；② **`423 ⇒ integrity`**（`LD009` `LEDGER_CURRENCY_FROZEN`；资源被锁定 = 合规冻结，R105 把「币种状态」归 `409` 语义族）；③ **`null ⇒ defect`**（`LD032` `LEDGER_RECONCILE_MISMATCH`；**HTTP 层一律 `status ?? 500`** 兜底，R108 必告警）；④ **`200` 改判为单列一类 `benign_outcomes`**（`LD006` `LEDGER_IDEMPOTENCY_REPLAY`）—— **良性结果、不是错误类、不参与 bucket 校验**（理由：硬塞 `input` 桶的「调用方输入有问题」语义不对）。
- **修正原因（本册核心口径 · 写死）**：**原冻结表不完整 —— 它只覆盖了 4 个状态类（400 / 404·409 / 503 / 500），而 §14.1 的现实状态集是 7 个状态类 ＋ 1 个 `null`** ⇒ 任何分桶都必然「超出冻结面」。**本册原则：让冻结集与现实对齐，而不是让现实去迎合一张不完整的表。**（定性**不是**「现实违规」；§14.1 的**码 / 状态 / 触发条件一字未改**。）
- **落位**：**§14.3 v0.9 增补块 (A)** —— ① 四个超冻结面状态类的落点表（含本册自核读数 `403×2` / `423×1` / `200×1` / `null×1` 与全表分布 `400×9 / 403×2 / 404×3 / 409×8 / 423×1 / 200×1 / 500×5 / 503×3 / null×1 = 33`）；② 修正原因；③ **扩展后的映射表**（四条 → 五条 ＋ 单列一类）；④ `200` 改判理由；⑤ 「`benign_outcomes` 不参与 bucket 校验」；⑥ **判据集扩展**（原「`500` 类码只可能来自 `defect`」不变 ＋ 🆕「`200` 类码只可能来自 `benign_outcomes`」＋ 🆕「`403` / `423` / `null` 分别只可能来自 `input` / `integrity` / `defect`」）；⑦ 「扩展只加格、不加码、不改桶语义」纪律。
- **留痕**：**v0.4 冻结原文（S1 段）一字未删、未改**，同处标「仍然有效，v0.9 只是补上它没覆盖的四个状态类」。
- **未随本册执行**：代码侧三处对 `200` 的标注（`0009` 桶分支 / 往返脚本扩展表 / `LEDGER_ERROR_BUCKETS`）仍是 `input` ⇒ **另行发单同步**（见 §16 #15）。

#### 19.13.B 「双向映射全量往返闭合断言」＝ 规范要求（单向自证不算闭合）

- **要求（冻结）**：**凡双向映射 —— 名↔码（`ledger_sqlstate_of` ↔ `ledger_error_for_sqlstate`）、状态码↔HTTP、枚举↔字符串、代码↔规范 —— 必须交付「全量往返闭合断言」**：对**每一个**元素断言 **`f(g(x)) == x`**（两个方向都走通、回到自身）＋ **一致性断言**（桶 / 状态类满足 §14.3 v0.9 (A) 的扩展映射；TS 侧桶与 DB 侧桶逐条对拍）。
- **必须进回归套件固定项**：**不得只当一次性探针**；凡改错误码表 / 分类器 / 状态映射 / 枚举字符串，**必须重跑并附 run-tagged 读数**（固定文件名会被静默覆盖 ⇒ 同 §14.3 v0.6 增补块 (A)④c 的取证纪律）。
- **「单向自证不算闭合」（由来 · 诚实口径）**：P1 的「关闭集 33 码已闭合」**只自证了正向 33 条**（名 → SQLSTATE），**从未自证反向也有 33 条**（SQLSTATE → 名）⇒ 反向表**一条 `LD0nn` 分支都没有**时，这条「闭合」声明**照样通过**。**审计只做了单向，就以为闭合了** —— 这正是 §19.13.C 那个 P1 遗留缺陷能存活的原因。⇒ **今后凡声称「闭合」，必须附往返读数；只有正向读数者，一律读作「未闭合」。**
- **已验证资产**：`backend-ts/scripts/p2c-00-code-roundtrip.ts`（**33 码全量往返闭合测试**，`--assert` 模式）—— 修后**四项硬判据归零**、`--assert` **exit 0**、`closed_set = 33 / 33`；完整前 / 后读数表见 §19.13.C。
- **落位**：**§14.3 v0.9 增补块 (B)** ＋ §16 **#14**。

#### 19.13.C 反向映射缺 `LD0nn` 分支（33 码全未归类）＝ P1 遗留缺陷 · `0009` 修复状态 · 硬规则

- **缺陷（登记 · P1 遗留）**：DB 侧 `ledger_error_for_sqlstate(state, constraint)` 的**反向映射表一条 `LD0nn` 分支都没有** ⇒ **33 个自有码（`LD001`..`LD033`）全部落 ELSE 兜底**（`{ LEDGER_TRANSACTION_REQUIRED, bucket: defect, reason: unclassified_db_error }`）。**落桶侥幸没错**（`defect ⇒ 500` 类），**但码名与 `reason` 全被错配**（调用方看到「事务必需 / 无法归类」，而实际可能是「对账不符」`LD032`）。**长期掩盖原因**：这些码**多为 `defect` 类，调用方输入触发不了** ⇒ 直到 `0007` 的佣金守恒断言（`trg_ledger_entry_commission_conservation`）**人类第一次真正抛 `LD032`** 才暴露。
- **修复（`0009`）**：`backend-ts/migrations/0009_ledger_error_reverse_map_complete.sql`（`wc -l` = **310** 行 / **23808** 字节；**checksum（sha256 前 12 位）= `6688e2ce35c6`** = §5.22 所指 `6688e2ce35c67d5b…`；本册另计 md5 = `d8e31785f505073f5bca243fc2a96c3f`）。手法 = **`CREATE OR REPLACE FUNCTION`**（**不改 `0005` 文件**）：**函数体 = `0005` 版逐字节保留 ＋ 恰 60 行 `LD001..LD033` 分支**（本册自核：公共前缀 **10** 行 ＋ 新增中间段 **60** 行 ＋ 公共后缀 **98** 行 = 函数 **168** 行；`WHEN 'LD0nn'` 分支 **33** 条）＋ `COMMENT ON FUNCTION` ＋ 迁移内 `DO` 自检（不通过则整迁移回滚、不写版本行）。
- **修前 / 修后读数（本册 `read_file` 自核 `.p2c-artifacts/*.json`，非转抄）**：

  | 项 | 修前 run `MUJNM9EO`（`before`，2026-09-27T10:06:55Z） | 修后 run `MUJO2B19`（`after`，2026-09-27T10:19:25Z） |
  |---|---|---|
  | `roundtrip_mismatches` | **32**（共 33 码） | **0** |
  | `unknown_codes` | 0 | **0** |
  | `bucket_violations` | **54** | **0**（五子项全空） |
  | `null_status_defect` | **27** | **0** |
  | `stale_unclassified_reason` | **33** | **0** |
  | `closed_set_size_ts` / `_db` | 33 / 33 | 33 / 33 |
  | `bucket_map_extension_used` | 5 | 5 |
  | `literal_readings`（`LD031`/`LD032`/`LD033`） | 三码均 `LEDGER_TRANSACTION_REQUIRED` / `defect` / `unclassified_db_error` | `LEDGER_FEE_RATE_INVALID` / `LEDGER_RECONCILE_MISMATCH` / `LEDGER_CURRENCY_SYMBOL_TAKEN`（`defect` / `defect` / `integrity`） |

  （同轮的 `MUJNPUO4` 读数与上表 `after` 列**逐项一致**，含 `httpStatusOf_probe = { LD031: 500, LD032: 500, LD033: 409 }`。）
- **`--assert` 结论**：`--phase after --assert` **退出码 `0`**（`assertions_failed = []`）。**诚实边界**：**本册未实跑该脚本**（本册纪律：**不连库**）⇒ 该结论**转引** `backend-ts/.p2c-artifacts/p2c-report-MUJNPUO4.md` §3.2。
- **TS 侧现状（本来就齐 · 缺口只在 DB 侧）**：`LEDGER_ERROR_TABLE`（`src/ledger-errors.ts`）与 `LEDGER_SQLSTATE_TO_CODE`（`src/ledger.ts`）**本来就 33/33 齐全**（本册自核：两表键集逐字相同、各 **33** 条）；本轮另新增 **`LEDGER_ERROR_BUCKETS`**（33 键）与 **`httpStatusOf(code) = LEDGER_ERROR_TABLE[code].status ?? 500`**。
- **🔒 硬规则（给未来接 HTTP 的响应层）**：**必须用 `err.httpStatus`，不得用 `err.status`。** `err.status` 的 `null` 是 **§11 R88 脚本退出码**语义（对账脚本 `exit 1`，**不映射 HTTP**），**故意保留**（表内不动）、**不是缺陷**；但 `LD032` 会被 HTTP 路径见到（`0007` 佣金守恒断言）⇒ 直接透传 `null` 会得到「状态码缺失」的响应（实测形态 `status = undefined`）⇒ **一律走 `httpStatusOf()` / `err.httpStatus`**（`defect` 兜底 `500`）。
- **未随本册执行（已识别，非本册遗漏）**：① **`200` ⇒ `benign_outcomes` 的代码侧同步**（三处：`0009` 桶分支 / `p2c-00-code-roundtrip.ts` 扩展表 / `LEDGER_ERROR_BUCKETS` 注释与取值）⇒ 须**另行发单**（本册纪律：**只允许改 `docs/**`**）；② `0009` 之后若再改分类器/码表，**往返闭合断言必须重跑**（§19.13.B）。

#### 19.13.D v0.9 落位索引（逐处对号）

| 项 | 正文落点 | 登记 / 索引 |
|---|---|---|
| ① 冻结映射与现实对齐（三条扩展 ＋ `benign_outcomes`） | **§14.3 v0.9 增补块 (A)**（含留痕） | §19.13.A · §16 #15 |
| ② 「双向映射全量往返闭合断言」规范要求 | **§14.3 v0.9 增补块 (B)** | §19.13.B · §16 #14 |
| ③ 反向映射 P1 遗留缺陷 ＋ `0009` 修复状态 ＋ 读数 ＋ `err.httpStatus` 硬规则 | **§14.3 v0.9 增补块 (C)** | §19.13.C · §16 #14 / #15 |

- **交付纪律自检（本版）**：① 三项**全部为就地增补**，未重排任何章节编号（§14.3 / §16 / §18 就地增补），新增内容只追加 **§19.13**（依「新增一律向后追加」纪律）；② **R1–R108 = 108 条不变**、**§14.1 = 33 码不变**（本册重数自核）；③ 每一处都**保留旧原文**（§14.3 S1 段标「仍然有效、只做扩展」，§16 #12 / #13 一字未动），无静默重写；④ **未连库、未启停服务、未跑任何脚本、未 `commit` / `push`**；⑤ **只改 `docs/**`**（新增 `docs/versions/ledger.spec.v0.8.md` 快照 + 就地修改 `docs/ledger.spec.md`），**未触 `backend-ts/**` / `frontend/**` / `migrations/**`**。
- **未执行（已识别，非本册遗漏）**：本册三项增补**不产生任何实现** —— 代码侧（分类器桶分支 / TS 桶表 / 往返脚本扩展档位）的同步、以及任何规范化命名的实作，均须**另行发单**（§0.2 分工）；🔴 **v0.10 更正**：**该项已在 v0.10 完成**（§5.23 正文已核、逐条对齐见 §19.14.A）⇒ 原 v0.9 的这句 ~~**master-plan §5.23 正文的核对**亦不在本册（本册已标「未核对」）~~ **作废**。**v0.10 仍未执行**（本册仍只写规范）：② 的**校验侧**同步（往返脚本 / 桶一致性断言对 `200` 类**跳过四桶公式**、另按 `benign_outcomes` 单列）与 `LEDGER_ERROR_BUCKETS` 的**注释**措辞，均须**另行发单**（**`0009` 不得再改**；**`bucket` 字段保持 `input`** ⇒ **不要求改任何桶取值**）。


---

### 19.14 v0.10 登记（Zang · §5.23 回校 + 「`200` ⇒ `benign`」精确口径 + `W = 0` 双档 + 指纹范围 + 绑定守卫 + P2 佣金层验收读数）

> **性质**：本节只**登记** v0.10 的六项小修（**不新增错误码、不动 R1–R108、不重排章节编号、不新增章节编号**）。§14.1 / §14.3 / §6.2 的 **v0.10 就地落位块**是**正文**，本节是**登记与落位索引**；§16 就地更正 **#15**，§18 加 **v0.10** 一行。v0.10 依「**新增一律向后追加**」纪律追加为 **§19.14**（§19.0–§19.13 的编号与节标题不改）。
> **裁定来源（诚实标注 · 与 v0.9 相反）**：Zang 裁定，本单转述自 `docs/seafood.master-plan.md` **§5.23** —— **该 §5.23 正文本版已核对**（master-plan **v0.27**，HEAD `541dffd`；本册 v0.10 `read_file` 逐字读该节：含「更正我两个错陈述」表、「裁定 bucket 扩展」四条表、「反转探针不做」段、「响应层必须用 `err.httpStatus`」段）⇒ **v0.9 的「未能核到 §5.23 正文」标记一律作废**（四处已就地加更正标记）。**若 §5.23 后续再改，以到场时的正文为准并回改本册。**

#### 19.14.A §5.23 逐条对齐表（v0.9 落位 vs §5.23 原文）

| §5.23 的项 | §5.23 原文要点（本册 v0.10 `read_file` 自核） | 本册落位 | 对齐结论 |
|---|---|---|---|
| **① 缺陷定性 + 两个错陈述更正** | 修前 `roundtrip_mismatches = 32/33`（唯一「通过」的是名碰撞）、`stale_unclassified_reason = 33` ⇒ **该函数根本没有 `LD0nn` 分支、33 个自有码全部未归类**；并更正两个错陈述（🔴「缺最后三码」错；🟠「TS 缺三码」错 —— TS 本就 33/33，**缺口只在 DB**） | §14.3 v0.9 增补块 (C)①③⑤ / §16 #14 / §19.13.C | ✅ **一致**（v0.9 已按此落位，**无须回改**） |
| **② `0009` 修复与验收** | `schema_version = 0009`；往返测试 `--assert` **exit 0 / `assertions_failed=[]`**；抽查 8 码（含三个新补码）**全部落到真实码名与正确桶** ⇒ **整表修好，不是点修** | §14.3 v0.9 (C)②④ / §19.13.C | ✅ **一致**（读数口径相同；本册仍标「**转引、未实跑**」） |
| **③ bucket 扩展四条裁定** | `403 ⇒ input` ✅ ／ `423 ⇒ integrity` ✅ ／ `null ⇒ defect` ✅ ／ **`200 ⇒ input` ❌ 改判**（`200` **不是错误类、不参与 bucket 校验** ⇒ 单列 `benign_outcomes`）；并**要求 Jing 把三条扩展 + `benign_outcomes` 一类写进冻结映射表** | §14.3 v0.9 (A)（表 **4 行**）＋ **v0.10 (D)**（把改判口径**写死**：`bucket` 保持 `input`、只改校验、`httpStatusOf` 返 `200`、`0009` 不得再改） | ✅ **一致且已收紧**（v0.9 的「改判为单列一类」曾被读成「要改桶取值」⇒ v0.10 明确 = **校验侧之事**） |
| **④ `200` 改判的依据** | `LD006 = LEDGER_IDEMPOTENCY_REPLAY` 就是 200 —— 它是**良性结果**，硬塞进 `input` 桶的「调用方输入有问题」语义不对 | §14.3 v0.9 (A)④ ＋ **v0.10 (D)①** | ✅ **一致** |
| **⑤ 反转探针不做** | **裁定：反转探针（§8.1）不要求做。** 正 / 反两向已由「**同一份终版脚本** + 迁移状态指纹（修前 `0009 = ABSENT` 红 / 修后 `0009` 绿）+ 修前 `32/33` 对照修后 `0`」覆盖；再反转一次函数体只是**重证修前态**，边际价值低 | **§14.3 v0.10 增补块 (E)**（**v0.9 漏落，本版补登**） | 🆕 **v0.10 补齐** |
| **⑥ 响应层硬规则** | `src/index.ts` 至今**没有账本路由** ⇒ 本单兜底落在 `ledger-errors.ts` 的 `httpStatusOf()`；**将来接线必须用 `err.httpStatus`，不得用 `err.status`**（后者 `null` 是 §11 R88 **脚本退出码**语义、**故意保留**、**不是缺陷**） | §14.3 v0.9 (C)⑥ / §16 #15 / §19.13.C | ✅ **一致**（并与 v0.10 (D)③「良性码返 `200`」互补：`?? 500` **只对 `null` 生效**） |

**对齐结论（一句话）**：v0.9 依**转述**落的六项中，**① ② ③ ④ ⑥ 与 §5.23 原文逐条一致**（**无出入、无回改**），**⑤ 是 v0.9 的漏落项**，已在 v0.10 补登于 **§14.3 v0.10 增补块 (E)**。⇒ **§5.23 与本册 v0.10 之间已无未对齐项。**

#### 19.14.B 「`200` ⇒ `benign`」精确口径（登记要点 + 代码侧边界）

- **映射侧不动**：`bucket` 字段 = **`input`**（`LD006` 仍是 **input 起源的良性结果**）；**`0009`（已应用）不得再改** —— 改它会造成「**撒谎态**」（**本仓库有前例被明令禁止**）；`LEDGER_ERROR_BUCKETS` 的取值与 `p2c-00-code-roundtrip.ts` 扩展表的 `'200': 'input'` **保持不动**（本册自核三处现状已于 v0.9 登记在 §16 #15）。
- **校验侧改**：状态码 `200` 的码**不参与 `bucket ↔ 状态类` 校验**，**单列一类 `benign_outcomes`**（**校验类**，**不是**第 6 个错误桶）。
- **HTTP 语义**：`httpStatusOf` 对**良性码返 `200`**；`500` 兜底**只**对 `status === null` / 缺失者生效（`LD032` 属此列）。
- **未随本册执行（另行发单）**：① 往返脚本 / 任何桶一致性断言**跳过 `200` 类**并把 `benign_outcomes` 单列；② `LEDGER_ERROR_BUCKETS` 的**注释**措辞同步。**不要求改任何桶取值**（v0.9 的相反指令已作废）。
- **代码侧的就地同步（工作区实况 · 未提交 · 本册未实跑）**：本册 v0.10 收尾时以 `git diff` 读到实现方**已在工作区**按本口径改了两处 —— `src/ledger-errors.ts` 新增 **`LEDGER_BENIGN_CODES`** / **`isBenignLedgerCode()`** / **`BENIGN_HTTP_STATUS = 200`**（注释明写「**改桶 = 改已应用迁移的语义 = 撒谎态**」）且 `httpStatusOf` 对良性码恒返 **`200`**；`scripts/p2c-00-code-roundtrip.ts` 把 `'200': 'input'` 从**扩展表**移入 **`benign_outcomes` 豁免**（`bucket_class_validated: false`），并**断言良性码的 DB 桶 / JS 桶仍是 `input`**（防「为了让校验变绿去改桶」）。⇒ **与 ① / ② / ③ 逐点一致**（桶保持 `input` ✓ / 只改校验 ✓ / 良性码返 `200` ✓；**`0009` 未动** ✓）。⚠️ 该同步**未提交**、**本册未实跑其断言、未连库**。

#### 19.14.C P2 佣金层验收读数登记（M1–M9 · **只登记结论与出处，不搬大表**）

- **结论**：**M1–M9 已实现并全部通过** —— 脚本 `backend-ts/scripts/p2d-00-commission-m-criteria.ts`；**`--assert` exit 0 / `reds: []`**。
- **出处（诚实标注）**：① **exit 0**：**转引** `f618e00` 的提交信息（「M1–M9 机读判据 `--assert` exit 0 / `reds: []`」）；② **`reds: []`**：**本册自核** `backend-ts/.p2d-artifacts/p2d-00-m-criteria-20260927T103933Z.json` 的 `11_summary`（`reds: []`、`red_count: 0`、`case_reds` 六个用例全空）与同轮报告 `p2d-REPORT-20260927T103933Z.md`（「红线数：**0** ⇒ 全绿」）。**本册未实跑该脚本**（本册纪律：**不连库**）。
- **★ 特别登记 —— M1 判负的第 ③ 例**：**保平衡的 Σ 篡改（出池少 1 / 受益人少收 1）也被拦落 `LD032`**（`reason = COMMISSION_SPLIT_SUM_MISMATCH`：`pool_in = 100` / `commission_out = 99`）。⇒ **它证明守恒断言不能靠「双分录总数仍为 0」蒙过去** —— 出池少 1、受益人少收 1 时**分录仍逐对平衡**（`Σ(delta + frozen_delta) = 0` 照样成立），**只有池子守恒断言**能抓住它。三例 tamper 读数：① 第 1 层 `+1` ⇒ `LD016` / `EVENT_NOT_BALANCED`；② 删掉第 1 层整对 ⇒ `LD032` / `COMMISSION_SPLIT_SUM_MISMATCH`（`pool_in = 100`、`commission_out = 54`）；③ **保平衡的 Σ 篡改** ⇒ `LD032` / `COMMISSION_SPLIT_SUM_MISMATCH`（`pool_in = 100`、`commission_out = 99`）。三例均**不落账**（`rows_landed = 0`）。
- **其余关键读数（逐条 · 出处 = 同轮 JSON / 报告，本册自核）**：**短链重归一** —— 用例 `c2`（`chain_depth = 3`）`x = {4615, 3077, 2308}`、**`W = 6500`**（= 已有三层权重之和，**不是 10000**），`pool_in = commission_out = 10000`；**零额不报错且无佣金分录** —— 用例 `c4`（`gross = 30 < 50` ⇒ `fee = 0`）`entries = 2`（`{K, K#2}`）、`commission_rows = 0`、无 `job_fee` 分录、`worker_got = 30`；**平局更深者得** —— 用例 `c7`（`P = 1`、`w = {2500,2500}`）`x = {0, 1}`（第 2 层独得 `+1`，第 1 层 `x = 0` 不建分录）；**8 并发同键不双发** —— `5_m6_concurrency`：`concurrency = 8`、`replay_count = 7`、`root_rows = 1`、`rows_total = 24`（未翻倍）、`commission_rows = 20`、`worker_paid_once = true`（重放响应共用同一 `txid = 3666`）；**政策改版后历史行指纹不变** —— `7_m7_no_retroactive`（双向：历史不变 + 同键重放零新增 + 新事件按新政策；`step4_replay_same_payload.ok = true` / `step4b_replanned_under_new_policy.ok = true`）；**M3-C** —— 用例 `c3`（`chain_depth = 0`）：`minus2_net = 0`、`minus1_net = +1`、`commission_rows = 0`、`fee_credit_uid = -1`。
- **仍属边界（不得读作已验）**：① `exit 0` **属转引**（本册未实跑）；② 读数为**当轮测试数据上的读数**（run `20260927T103933Z`），**不得**外推为「任意规模 / 任意形状」；③ M9 的 2-环判负落在 JSON 的 `9_m9_graph_invariants.bind_cycle_negative`（`2a_bind_A_to_B_ok.ok = true` / `2b_bind_B_to_A_MUST_REJECT.ok = false` —— **录制字段原值，本册不代为解释为红 / 绿**，以脚本自身判定 `reds: []` 为准）；**直插对照**另见同轮报告「判负对照」段（`cycles = 100` / `bad_depth = 2`，**事务内 `ROLLBACK` 复原**）。完整读数见 `docs/commission.spec.md` v0.3 §18。

---

### 19.15 v0.11 登记（Zang · `0012` 幂等重放前置闸落位 + §C 两条已知盲区）

> **性质**：本节只**登记** v0.11 的四项（**不新增错误码、不动 R1–R108、不重排章节编号、不新增章节编号**）。**本节是登记与落位索引；正文在 §6.2（R51 / R52 两个 v0.11 就地落位块）与 §7.1（写路径阶段序句——**v0.9 / v0.10 版在第 454 行，本版在 §6.2 增补两处后下移至第 466 行**，**引用请以内容为准、不以行号为准** ＋ 紧随其后的 v0.11 就地更正块）。** 裁定来源 = `docs/seafood.master-plan.md` **§5.25**（幂等前置闸 = R51 的「快路径」）＋ **D17** ＋ **§5.27**（`0012` 独立质检：验收通过 + §C 两条已知盲区）。依「**新增一律向后追加**」纪律追加为 **§19.15**（§19.0–§19.14 的编号与节标题不改）。**本版 md5 / 行数 / 字节数见交付报告。**

#### 19.15.A `0012` 的实现事实与证据

- **迁移文件**：`backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql`；**checksum = `2a64483f944f16e3364be822e5ff61e0b95afa0168f937ce5aac6671b561dcbe`**（= 盘上文件 **sha256**；**本册自核**：`shasum -a 256` 逐字相同）。⚠️ **本册不连库** ⇒ 「`schema_migration.checksum` 字段值与之一致（盘 == 库三向一致）」属**转引**（来源：§5.25「已应用 · `checksum = 2a64483f944f16e3…` = 盘上文件 sha256」；§5.27「盘==库三向一致、12 个文件全部 MATCH、`migrate.ts` 跑两次均 `EXIT=0` / 12–12 skipped、无 checksum drift」）。
- **改动面**：**只 `CREATE OR REPLACE` 一个函数** —— 不改 `0004` / `0005` 文件、不改表结构、**不新增任何错误码**（§14.1 仍 33 码）。
- **函数体指纹（`ledger_post_event` · before → after）**：**before** = `42449` / md5 **`0cf1bb98ee3a30da55b1620c309d5541`**（= `0005` 版；**与 P1 期登记逐字同** ⇒ 自 P1 以来函数体未漂移）→ **after** = `45598` / md5 **`d94dd902697dfe60aba409d808c6d63a`**。
  - **本册自核方式（非转抄）**：按函数声明的 `AS $tag$ … $tag$` 抽出 `prosrc`，对 `0005` / `0012` 两份文件**独立复算 `fnFingerprint` 的全部字段**（`prosrc_len` / `prosrc_md5` / `pre_gate_present` / 四个 `pos_*` / 三个布尔 / `on_conflict_probe_present`），结果**逐字段等于** `backend-ts/.p2x-artifacts/p2x-01-migration-dry-run-P2XFIN01.json` 的 `fn_before` 与 `fn_after_in_tx`（`schema_version` / `idx_ledger_event_root_key_rows` 两项属**库侧字段**，本册未连库 ⇒ 取该 JSON 的 `0011` / `1`）。
  - ⚠️ **术语更正（登记，不修改任何已发布读数）**：上述 `42449` / `45598` 是**字符数**（UTF-16 码元数，JS `String.length`），**不是字节数** —— 同一文本的 **UTF-8 字节数**为 **`46732` / `51429`**（**本册自核**）。**`md5` 是权威指纹**（对同一文本逐字一致）；**权威口径自 v0.11 起读作「字符数」**（`p2x-lib.ts` 的字段名 `prosrc_len` 直取 `src.length`，同族命名 `sql_bytes` / `prosrc_len` 皆同此）。**下游引用 `42449` / `45598` 时不得再标 `B`。**
- **四个位置读数（前后对照；字段名 = `p2x-lib.ts` 的 `fnFingerprint`）**：

| 标记（needle） | before（`0005`） | after（`0012`） |
|---|---|---|
| `pos_c4_account_lock`（`account:for-update`） | `26825` | `26917` |
| `pos_pre_gate`（`0012-REPLAY-PRE-GATE-BEGIN`） | **`-1`（不存在）** | `27698` |
| `pos_c5_balance_section`（`C5 推演 + 前置判定`） | `27572` | `30721` |
| `pos_r80_balance_gate`（`R80：库内先判`） | `29468` | `32617` |
| `pos_on_conflict_probe`（`ON CONFLICT (idempotency_key) DO NOTHING`） | `31476` | `34625` |

  - **修前（缺陷坐实）**：`26825 < 27572 < 29468 < 31476`、`pre_gate_present = false` ⇒ **余额/冻结闸（C5/R80）跑在 R51 的幂等占位之前，且没有任何重放前置闸**；`order_ok_gate_after_lock_before_balance = false`。
  - **修后（顺序成立）**：`26917 < 27698 < 30721 < 32617 < 34625` ⇒ **闸在 C4 加锁之后、C5 余额闸之前**；`order_ok_gate_after_lock_before_balance = true`、`on_conflict_still_after_gate = true`、`pre_gate_present = true`、`on_conflict_probe_present = true`、`idx_ledger_event_root_key_rows = 1`。
  - **本册自核**：上表 10 个读数在上述 JSON 与**本册独立复算**中**逐字相同**；**读数的原始产出方** = 实现方探针 `scripts/p2x-01-migration-dry-run.ts`（run `P2XFIN01`，`fn_after_in_tx` 在**同一事务内、执行之后**读 —— 该脚本注释载明「等 `ROLLBACK` 之后再读会读到旧函数体」这一假绿缺陷）。
- **`ON CONFLICT` 首条分录探针：原地保留，且仍在闸之后**：`on_conflict_probe_present = true`（前后皆真）；`on_conflict_still_after_gate = true`（`34625 > 27698`）；探针**写法未改** —— 仍写**调用方原始键**（`v_entries->0->>idempotency_key`；迁移 §C 的自检亦断言「探针不得被挪到闸之前」「不得不再写入调用方原始键」）。⇒ **R51 的并发权威性未被取代**，三处口径一致（§6.2 v0.11 就地落位块 / R51 子句、§7.1 v0.11 就地更正块、本项）。
- **与 `0005` 的函数体差分 = 两处纯插入（本册自核）**：对两份 `prosrc` 做**行级差分**（`difflib.SequenceMatcher`，`autojunk=False`）⇒ **非 `equal` 的 opcode 恰两条 `insert`**：① DECLARE 段 **3 行**（`-- 0012：重放前置闸…` 注释 ＋ 两个变量：`v_gate_fp` 等）；② **68 行**的整段 **C4.5 闸** —— **合计插入 71 行、删除 0 行、替换 0 行**。**重建自证**：把这两处插入从 `0012` 的 `prosrc` 删掉 ⇒ **逐字等于 `0005` 的 `prosrc`**（本册行级重建 = `True`）。**C5–C8 一字未动**：`0005` 与 `0012` 的 **C7 段**（`C7 幂等重放` → `C8 `）**逐字节相同**，sha256 **`453a2e7781743866e861d28fb7c24cc8ac9bdf43ad67c224f2384afc88b530a7`**（两份同值；**本册自核**）。
- **闸体只读性（转引 §5.27）**：闸体在 **C4 加锁之后**执行、**命中即返**；对闸体（**2901** 字符 / 剥注释 **1535** 字符）做**写与加锁 token 扫描 = `[]`**。
- **行为读数（转引 §5.25 / §5.27；本册未连库、未实跑任何脚本）**：① **头号已修** —— 托管恰花光后同键重试 ⇒ **`200 + idempotent_replay:true`** ＋ **同 `txid`** ＋ 键下行数不变（**零写入**）＋ `entries_sha256` / `accounts_sha256` 与首写**逐字相同**（§5.27：18/18）；② **同键异指纹** ⇒ `409 LD003`、零写入、且不污染后续重放；③ **全新键**余额/冻结不足 ⇒ 仍 `LD002` / `LD001`、零残留（**R63 未破**）；④ **真并发**：§5.25 的交付方探针 `p2x-02`（胜者先提交、不等败者）**13/13** ⇒ `landed 1 / replay 1 / error 0`、败者得胜者 `txid`、托管恰扣一次；§5.27 的**独立质检自写探针**（自造夹具、不复用交付方 uid/键）**14/14** ⇒ 胜者 200ms 落账、败者在行锁上阻塞后 `200 + 同 txid`；分阶段竞态 B 阻塞 936ms（§5.27：1024ms）后同样 `200` 重放；⑤ 🔴 **关键新证据 —— 字节级修前/修后 A/B**：把两处插入从现役 `prosrc` 删掉后**逐字等于 git 里 `0005` 的函数体**（sha256 `9da1fe3cc135…`；文件体与 live `prosrc` 双向验证），在**回滚事务**里装载该实现跑同形状 ⇒ **`LD002 LEDGER_INSUFFICIENT_FROZEN`（缺陷复现）**；`0012` 下同形状 ⇒ **`200` 重放** ⇒ **修复真实有效**，并补上「新探针无 before 相位」的缺口；⑥ **判负能力为真**（§5.25 + §5.27）：闸整段挪到余额闸之后 ⇒ `migrate` **exit 4 FAILED**（文件自带行为探针判负 `LD002`）；只删闸的 `END` 标记行（**函数行为逐字不变**）⇒ FAILED `P0001`（结构性断言）；还原 ⇒ md5 逐字回到 `5b97c96b…`；重跑 ⇒ applied；§C 的 **7 个变体全部真的 RAISE**（V0 无假阳性）、**16 次运行零 `22P02`**；⑦ **没碰别人钱**：`cid = 1`（7 行、`sum = 8400`、md5 `2abde15ad1ae7e2d301a982493cbf925`）与平台 `0/-1/-2/-3`（29 行、`sum = 46`）前后逐字相同；`git diff --numstat HEAD~1` 对 `0001`–`0012` 全 0（§5.27）。
- **独立质检结论（转引 §5.27）**：**验收通过（PASS）**，run tag `20260927T131927Z`；原始读数在 `backend-ts/.p2qa2-artifacts/p2qa2-*-20260927T131927Z*`，报告 `docs/qa/p2-0012-replay-order.md`（**由并行的另一单撰写，本册未读、未改**）。
- **`extra` 早于 `0012` 的独立证实**：§5.27 载明「① `extra` 早于 `0012`（`0005` 与 `0012` 的 C7 段 **byte-identical**，sha256 `453a2e7781743866…`）；② 装回 `0005` 走非闸重放路径得到同形状 `extra = {}`」—— 其中**第 ① 条与本册自核的 C7 sha256 逐字相同**；第 ② 条属**转引**（本册不连库）。⇒ 支撑 §6.2 R52 v0.11 块的「`extra` 非契约字段、**不因它开 `0013`**」。

#### 19.15.B 两条已知盲区登记（**登记、非缺陷**；Zang 已裁定**不修**）

> **性质与读法纪律**：本条登记的是「**`0012` §C 迁移期自检块（apply-time `DO $chk$`）的两条已知盲区**」—— **不是缺陷（defect）**，**不构成本册任何契约的未满足**，**不因它们开 `0013`**。**不得**把本条读作「`0012` 有缺陷」或「验收未过」：独立质检结论是 **验收通过（PASS）**（§19.15.A）。两条都**留待下次真正 `CREATE OR REPLACE ledger_post_event` 时一并包住**（届时顺手做，**不单独起版**）。

| # | 盲区（事实） | 影响面（写死） | 为什么**不**是缺陷 |
|---|---|---|---|
| ① | §C 行为探针里 `v_r2 := ledger_post_event(v_evt)` **未受保护**（未包在独立 `BEGIN…EXCEPTION` 子事务里）⇒ **恰恰在「闸被破坏」这一最需要诊断的场景**，它先抛**裸 `LD002` / `LD006`**，**把累积的 `v_bad` 明细吃掉** | **仅影响诊断信息**：迁移仍然**失败并回滚整文件**（exit 4）⇒ **fail-closed 成立**；丢失的是「**为什么**红」的明细，**不是**「红／绿」判定 | **契约级保证是行为，不是报错文案** —— 行为已由**字节级 A/B ＋ 头号/反向/并发**三类用例独立证实（§19.15.A）；盲区只在**最坏时刻的可读性** |
| ② | §C 的结构性位置/只读断言是**子串匹配**（`position(needle IN v_src) > 0`）⇒ 「**语义改坏、但逐字保留** `t.event_root_key = v_key`」的改写**逃过全部结构性断言**（**实测 V5**：struc 段 `raised = false`） | **仅影响「结构断言的覆盖力」**：该情形下**行为探针仍会抓住**（只是如 ① 所述报错信息不够诊断） | 「**以文本匹配做结构断言**」是这一方法的**固有属性**（不是本迁移写错）；且 **`0012` 已被 checksum 锁住**（改它 = 撒谎态、本仓库有前例被明令禁止） |

- **裁定（Zang · §5.27，四条依据照录要点）**：① `0012` **已应用**且被 `checksum` 锁住；② **契约级保证是行为**，而行为已被**字节级 A/B ＋ 头号/反向/并发**三类用例独立证实；③ §C 自检是**迁移期防回归**的纵深防御，其盲区是**方法固有属性**，且同一块里的**行为探针**仍抓得住 V5 类（只是报错信息不够诊断）；④ 为「**改善报错信息**」抬一次 `schema_version` = **成本无契约价值**。⇒ **留待下次真正 `CREATE OR REPLACE ledger_post_event` 时，把 `v_r2` 用独立 `BEGIN…EXCEPTION` 包住**（**不在本册、不在本单执行**）。

#### 19.15.C 落位索引与交付纪律自检

| 项 | 落位 | 性质 |
|---|---|---|
| **R51 新增子句**（前置闸 = 重放快路径，不取代 `ON CONFLICT` 的并发权威性） | §6.2 **R51 行就地注记** ＋ **§6.2 v0.11 就地落位块 (1)** ＋ §17 索引 R51 | 正文（就地增补；**R51 原文一字未改**） |
| **§7.1 写路径阶段序句更正**（改前 v0.9 / v0.10 版**第 454 行**） | **§7.1 该句（本版第 466 行）** ＋ **紧随其后的 v0.11 就地更正块**（**旧址「v0.10 旧写法」留痕**） | 正文（**旧址留痕、不静默重写**） |
| **R52① 保证项 + `extra` 非契约字段** | §6.2 **R52 行就地注记** ＋ **§6.2 v0.11 就地落位块 (2)** ＋ §17 索引 R52 | 正文（就地增补；**R52 原文一字未改**） |
| **`0012` 实现事实与证据** | **§19.15.A** | 登记 |
| **两条已知盲区** | **§19.15.B** | 登记（**非缺陷、不修**） |
| **版本与快照** | 文件头 `**v0.11**` ＋ **v0.11 修订块** ＋ §18 变更记录 **v0.11** 行；改前快照 `docs/versions/ledger.spec.v0.10.md` | 记账 |

- ⚠️ **行号漂移登记（纪律）**：本册正文与既有登记多处按**行号**引用（如「§7.1 第 454 行」「§6.2 R51 / R52」「§14.1 #32」）。**行号随章节增删漂移**：本版在 §6.2 增补两处后，§7.1 的写路径阶段序句由 **454 行 → 466 行**（R51 行 `405 → 406`、R52 行 `406 → 407`）。⇒ **一切引用以「内容 / 规则号 / 节号」为准，不以行号为准**；下游 brief、验收清单与代码注释**不得**把行号当稳定标识（本册 v0.4 起已把 R 编号当稳定标识，本项只是把同一条纪律显式写到行号上）。
- **开工读数（原始）**：`git log --oneline -1` = **`c8163c8 master-plan v0.30: §5.26 登记四项待立项（标题单质检挖出，Kevin 未表态 ⇒ 不动）`**；`git status --porcelain` 于开工时 = `?? backend-ts/.p2qa2-artifacts/` 与 `?? docs/qa/title-i18n.md`（**并行其它单的产物，本册未触**）；`docs/ledger.spec.md` **无未提交改动**（改前主体 == HEAD）。
- **交付纪律自检（本版）**：① 四项**全部为就地增补/更正 ＋ 登记**，**未重排任何章节编号**（§6.2 / §7.1 / §17 / §18 就地增补），新增内容只追加 **§19.15**（依「新增一律向后追加」纪律）；② **R1–R108 = 108 条不变**、**§14.1 = 33 码不变**、**§19.1–§19.14 的编号与节标题未改**；③ 每一处改写都**保留旧原文**（§7.1 标「v0.10 旧写法」；R51 / R52 原文一字未动；§18 旧行全留）⇒ **无静默重写**；④ **未连库、未启停服务、未跑任何迁移或探针、未 `commit` / `push`**；⑤ **只改 `docs/**`**（就地修改 `docs/ledger.spec.md` ＋ 新增快照 `docs/versions/ledger.spec.v0.10.md`），**未触 `backend-ts/**` / `frontend/**` / `docs/seafood.master-plan.md` / 既有 `docs/versions/*` / `docs/qa/**`**；⑥ 全程**无 `pkill -f` / `killall`**、**未用 `timeout` / `gtimeout`**（本机无）、**退出码一律直接取自命令本身**（不取自管道之后）；⑦ **先落骨架再回填**（骨架一轮 ＋ 逐条回填两轮，无一次性大写入）。
- ⚠️ **版本号与快照口径（重要留痕）**：本单**来件写作「v0.9 → v0.10」**，但**改前 v0.10 已由 `f78714f`（§19.14 六项小修）占位并已入册**，且 `docs/versions/ledger.spec.v0.9.md` 已存在（md5 `ff317dfbcad5cd6a0c4691c52a138542`）⇒ 依本册「**版本号只增不复用**」（§18 修订纪律②的编号纪律之同源）与「**章节编号不得重排**」：本项落为 **v0.11**，**改前快照取 `docs/versions/ledger.spec.v0.10.md`**（md5 `a2a6a6a4d26b800e7a60df5b57479f5c`，**1838 行 / 384935 字节**，与改前主体**逐字节相同** —— 本册以 `cmp` 自证）。**`docs/versions/ledger.spec.v0.9.md` 逐字未动**（本册核 md5 未变）。⇒ **本版不覆盖、不改写任何已发布版本号**（若将来确要改 v0.10 的内容，须按新版本号另立）。
- **未执行（已识别，非本册遗漏）**：① 本册**不产生任何实现** —— 代码侧（探针 / 断言 / `0013`）**无须改动**；② §19.15.B 两条盲区的**收口**留待下次真正 `CREATE OR REPLACE ledger_post_event`；③ 本册**不发布** `docs/qa/**` 的质检报告（并行另一单）；④ `pos_*` / 指纹的**库侧**复算（`schema_version`、`schema_migration.checksum` 字段值）**本册未做**（纪律：不连库）⇒ 一律按**转引**登记。

### 19.16 v0.12 登记（Zang · C1 终审：`R79` 扩写并拍板 ＋ 新增 `R109`）

> **性质**：本节只**登记** v0.12 的两项（**一处就地扩写并拍板 ＋ 一条规则新增**）＋（可选）一条**已知债**。**本节是登记与落位索引；正文在 §10.1（全序块）/ §10.3（**R79** 行 / R83 指针）/ §7.2（锁对象全序块）/ §7.3（**R109** 新增条）/ §15（#6 与计数）/ §17（索引 R79 / R109）**。裁定来源 = **Zang 对 P3 数据层规范评审 C1 的终审** —— `docs/seafood.master-plan.md` **§5.32** 的 C1 行（四条附加硬约束）＋ C8，并照该节「下一步」条目执行：「`ledger.spec` 需新增 **`R79` 扩展条款**（加锁全序含业务行）并**拍板 `R79`** ⇒ 出 **v0.12**（含快照 + 留痕）」。**编号纪律**：本版**不重排**任何既有编号 —— **R79 不换号**（就地扩写 ＋ 旧写法同地留痕）、**R1–R108 条文一字未动**、新规则**只追加 Rn+1 = `R109`**；§19 依「**新增一律向后追加**」纪律追加为 **§19.16**（§19.0–§19.15 的编号与节标题不改）。**本版不改任何错误码**（§14.1 仍 **33 码**）。**本版 md5 / 行数 / 字节数见交付报告。**

#### 19.16.A `R79` 扩写并拍板 —— 裁定逐字与逐处落位

> **裁定（Zang · C1 终审，2026-09-28；与 `docs/seafood.master-plan.md` §5.32 C1 的附加硬约束 ①/② 同源）逐字**：
> - **加锁全序（最终口径）＝ 业务行（若该事务涉及，按主键升序） → `currency`（`cid` 升序） → `account`（`uid` 升序）**；
> - **禁止**「先锁 `account` 再锁业务行」这类**反向写法**（会与上面的顺序**成环 ⇒ 死锁**）；
> - **业务编排函数（`job_post_event` 等）必须在调 `ledger_post_event` 之前持有业务行锁**；
> - 落点（原为「建议」）**采纳为强制**：服务层锁辅助函数 **`lockAccounts(sortedUids, cid)` 是唯一允许的加锁入口**，且**只接受已排序数组**；
> - **状态栏**由「待拍板」改为「**已拍板（Zang · C1 终审，2026-09-28）**」；**旧写法以「v0.11 旧写法」保留同处**（**不得静默重写**）。
>
> **为什么必须改（事实，不是文风）**：v0.11 的全序只列了 `currency → account → 业务表行`，**业务行排最后**；而 C1 采纳的**业务编排函数**在**同一条语句内先锁业务行**（函数体第一步）⇒ 若同一事务既有「编排函数先锁业务行」的写法、又有「先锁 `account`」的写法，两条路径**互相反向 ⇒ 成环 ⇒ 死锁**。⇒ 全序必须**含业务行、且把它放在最前**，并对**所有编排函数统一**（master-plan §5.32：「**且全部编排函数统一**」）。
>
> **与既有条文的关系（「不改」的清单，防误读）**：① **R83**（`mint` / `burn` / 状态变更先锁 `currency` 再动 `account`）**不变** —— 新全序里 `currency` 仍在 `account` 之前（若涉业务行，业务行锁在 `currency` **之前**）；② **§7.2 #8** 的「**按 uid 升序**加锁」与 **#11** 的「与下单**同序**」**不变** —— 它们是**级内**顺序；③ **R81**（写路径一律 `SELECT ... FOR UPDATE`）**不变**；④ **R51 / R52**（幂等与重放语义）**不变**，**`ledger_post_event` 函数体不改**。

| 项 | 落位 | 性质 |
|---|---|---|
| 加锁全序（含业务行、业务行最前）＋ 反向写法禁令（成环 ⇒ 死锁）＋ 编排函数先持业务行锁 ＋ `lockAccounts` 升为强制 | **§10.1 全序块**（旧址以「**v0.11 旧写法**」同地保留） | 正文（就地更正 ＋ 留痕） |
| **R79** 条文扩写 ＋ 状态改「**已拍板（Zang · C1 终审，2026-09-28）**」＋ **v0.11 旧写法四处原文**（条文 / 落点建议 / 连带影响 / 状态）同地保留 | **§10.3 R79 行** | 正文（就地扩写 ＋ 留痕；**不换号**） |
| 15 行事务清单的「锁对象」全序落到逐行（含「**哪些行涉业务行**」的读法）＋ `lockAccounts` 强制 ＋ 级内顺序不冲突说明 | **§7.2 v0.12 就地落位块**（**表内 15 行原文一字未改**） | 正文（就地增补） |
| §15 #6 标记为已拍板（**旧建议值留痕 ＋ 替代方案划线**）；§15 抬头计数 108 → 109、**实剩 19 条**；§15 末段「其余 17 条」→「其余 **16** 条」（旧写法留痕） | **§15**（清单表 #6 ＋ 抬头 ＋ 末段） | 正文（就地更正 ＋ 留痕） |
| 索引：R79 摘要与状态改写（**旧写法指针同地保留**） | **§17 §10 块 R79 行** | 正文（就地增补） |
| （副带一致性）**R83** 加「v0.12 指针」：新全序与之一致、**无需改动** | **§10.3 R83 行** | 正文（就地注记，条文一字未改） |

**裁定逐字与落位索引的对照表（上表）**：本表即「**同一版内全部改完**」的自证 —— 受影响处 = §10.1 / §10.3（R79 ＋ R83）/ §7.2 / §15 / §17 / §18 / §19，**一次落齐、不分批**（依据 = 本册 §18 修订纪律与 master-plan §5.32「下一步」条目）。

#### 19.16.B 新增 `R109`（业务编排函数的原子性与幂等口径）与已知债登记

> **① 新规则（正文 = §7.3 末行 R109；`R1–R108` 不动、只增不重排）**：裁定来源 = master-plan **§5.32** 的 **C1 四条附加硬约束**（② 编排函数**只由迁移创建**、函数体内**禁任何 DDL**；③ 每次调用**必须带幂等键**并把 **`ref_id` 落账本引用列**；④ **幂等重放语义必须与 `R51`/`R52` 一致**）＋ **C8**（业务级幂等键 `create_key`）。R109 的四点口径逐字见 §7.3 的 v0.12 新增条：**① 业务行 + 分录必须同一事务（函数内禁任何 DDL、编排函数只由迁移创建）；② 幂等必须与 R51/R52 一致（同键同指纹 ⇒ `200` 重放、**不**重写业务行；异指纹 ⇒ `409`；无键 ⇒ `400`）；③ 必须把 `ref_id` 落账本引用列（并回写业务行的引用列）；④ 业务级幂等另需业务表侧键 `create_key`**。
> **② 指针（本册不改那册）**：`create_key` 的列契约、业务表三件套（`create_key` / `ledger_event_keys` / `time_created`·`time_updated`）由 **`docs/data-layer.spec.md`** 定义（C8 裁定 / DL75 三件套 / DL102「两次写必须由同一条语句完成」）。⇒ **本册只发指针**；两册措辞若不一致，**以本册 R109 的口径为准并回报**（本册是账本域的权威口径文件；那册的 v0.2 由**另一单**并行回写）。
> **③ 与既有条款的接口**：R109 **不修改** R51 / R52 / R57 / R58 / R59 / R65 的任何要求；**R57**（一个业务事件一个事务）与 **R65**（「扣了钱没落流水」是最高优先级缺陷）在 R109 下**同时覆盖业务行**；**§7.2 v0.12 块**给出 R109① 的**锁序前置条件**（业务行锁 = 第一把锁）。
> **④ 不变项**：**`ledger_post_event` 函数体不改**；**R51 的并发权威性（`ON CONFLICT` 探针）不变**；**R52 三种返回语义不变**；**本轮不新增错误码**（§14.1 仍 33 码）。

**已知债登记（本节附 · 低优先，**本版只登记、不执行**；来源 = master-plan §5.32 C5 的「附加」）**

| # | 已知债（事实） | 影响面（写死） | 将来若启用专用码的**硬要求** |
|---|---|---|---|
| **D1** | **`C5` 裁定借用了 `LEDGER_CURRENCY_INVALID_TRANSITION`(409) 做「业务」状态机非法转移**（`details.field = 'job.status'` / `reason = 'JOB_STATE_INVALID'`；裁定全文见 master-plan **§5.32 C5**） | **「码名语义窄化」**：该码在 §14.1 里本是**币种**状态机的非法转移码，被**业务**状态机复用 ⇒ **读码名者会误判来源域**。⚠️ **不是**契约破坏 —— 调用方**只准按 `code` 分支**（§14.3 v0.7 增补块 (A)：`code` 是契约、`reason` 不是），借码本身也是本项目**既有机制**（先例见 **D2**） | **必须一次到位**：若将来启用专用码（如 `LD034` / `LEDGER_JOB_INVALID_TRANSITION`），**必须同时**交付 **① 正向映射（码名 ↔ `LD0nn`）＋ ② 反向映射（`LD0nn` → 码名 / bucket / 状态类）＋ ③ bucket 归属**，**不得只加正向**。依据 = **§14.3 v0.9 增补块 (B)** 的「**双向映射全量往返闭合断言**」规范要求（`f(g(x)) == x` 对**每一元素** ＋ 桶一致性，且**必须进回归套件固定项**；**单向自证不算闭合**）；且新增码须**另由 Zang 发单**并按 §18 修订纪律 ② 走「关闭集扩展」的完整流程（规范 ＋ 迁移 ＋ 码/桶闭环） |
| **D2** | 同族**既有**先例（**非本版新债**，此处只作指针）：v0.9 的 bucket 扩展四条（`403 ⇒ input` / `423 ⇒ integrity` / `null ⇒ defect` / `200 ⇒ benign_outcomes`）、`08P01 ⇒ 500 protocol_violation`、`23514 ⇒ defect` 等**借码 / 借桶**用法 | 借码是既定机制 ⇒ C5「可用」的**依据**（master-plan §5.32 C5：「借码是本项目**既有机制** ⇒ 可用」） | 同上：**借码可用，但专用码一旦启用必须闭环**（正向 ＋ 反向 ＋ bucket）—— 否则「**33 码关闭集**」的双向闭合断言会被打破 |

> **读法纪律（防误读）**：D1 **不是缺陷**、**不构成本册任何契约的未满足**、**不因它开新迁移 / 新版本**；它是**给未来一次机会点的备注**（「要么一直借，要么一次换到位」）。形态与 §19.15.B（「登记、非缺陷」）一致。**本版不新增错误码**（§14.1 仍 33 码）、**不动 R1–R109 任何条文**。

#### 19.16.C 落位索引与交付纪律自检

| 项 | 落位 | 性质 |
|---|---|---|
| **R79 扩写并拍板**（全序含业务行 ＋ 禁反向写法 ＋ 编排函数先持业务行锁 ＋ `lockAccounts` 强制） | §10.1（**v0.11 旧写法同地保留**）＋ §10.3 R79（**旧写法四处原文同地保留**）＋ §7.2 v0.12 块 ＋ §15 #6（**旧建议值保留并划线**）＋ §17 R79（**旧写法指针**） | 正文（就地扩写/更正 ＋ 留痕） |
| **新增 R109**（业务编排函数的原子性与幂等口径） | §7.3 v0.12 新增条（表末行 R109）＋ §17 §7 块 R109 行 | 正文（**只追加 Rn+1**） |
| （副带一致性）R83 指针（新全序与之一致、无需改动） | §10.3 R83 | 正文（就地注记，**条文一字未改**） |
| 计数同步（**108 → 109**；`R1–R108` → `R1–R109`；§15 实剩 **19** 条 / 末段 17 → **16**） | 文件头「文档状态」行 ＋ §15 抬头 ＋ §15 末段 ＋ §17 抬头 | 记账（**每处均保留 v0.11 旧写法**） |
| 版本与快照 | 文件头 `**v0.12**` ＋ **v0.12 修订块** ＋ §18 变更记录 **v0.12** 行；改前快照 `docs/versions/ledger.spec.v0.11.md`（**本版新建**；md5 `115b6e8dc36e0f6e2e29ce855cc014d5` / sha256 `473b87fe17f5f845da995ea6a1d8b4215008cb994f348779d0f173c3e16eea23` / **1918 行** / **417398 字节**；`cmp` 与改前主体**逐字节相同**） | 记账 |
| 已知债（`C5` 借码 ⇒ 码名语义窄化） | **§19.16.B 附表（D1 / D2）** | 登记（**非缺陷、本版不执行**） |

- ⚠️ **行号漂移登记（纪律，重申）**：本册正文多处按**行号**引用（历史体例）。本版在 §10.1 / §10.3 / §7.2 / §7.3 / §15 / §17 / §18 / §19 增补后，**其后所有行号均发生漂移** ⇒ **一切引用以「内容 / 规则号 / 节号」为准，不以行号为准**（下游 brief、验收清单与代码注释**不得**把行号当稳定标识；本册 v0.4 起已把 **R 编号**当稳定标识，§19.15.C 已把同一条纪律显式写到行号上）。
- **开工读数（原始，现取不转抄）**：`git log --oneline -1` = **`37c368d master-plan v0.37: 5.32 P3 数据层规范 v0.1 终审（C1-C9 九项裁定）+ 5.33 两条库级发现`**；`docs/ledger.spec.md` 开工时 **md5 `115b6e8dc36e0f6e2e29ce855cc014d5`**、**1918 行 / 417398 字节**、`git diff --numstat HEAD -- docs/ledger.spec.md` **无输出**（改前主体 == HEAD，**无未提交改动**）；`git status --porcelain` 于开工时已含**并行其它单的产物**（`M backend-ts/src/database.ts`、`?? docs/data-layer.spec.md`、`?? docs/versions/data-layer.spec.v0.1.md`、`?? backend-ts/.p3s1-artifacts/*`、`?? backend-ts/scripts/p3s1b-00-catalog-state.ts`、`?? docs/audit/p3-step1b-ddl-removal.md`、`?? docs/qa/*`）—— **本册一律未触**。⚠️ **并发提交留痕（本册工作期间）**：HEAD 在**本册开工之后**由并行另一单前移 —— **`37c368d`（开工读数，已入册）→ `375c5b8`（P3 Step 1b：摘掉第二条运行时 DDL 路径 `ensureLegacyTableNames`；只改 `backend-ts/**` 与新增 `backend-ts/.p3s1-artifacts/*`、`backend-ts/scripts/p3s1b-01-*.ts`，**未触 `docs/ledger.spec.md`**）**。**本册改前基线未受影响**：`git show HEAD:docs/ledger.spec.md | md5` = **`115b6e8dc36e0f6e2e29ce855cc014d5`**（= 开工读数，**逐字相同**）⇒ 本版 diff 干净可读：`git diff --stat HEAD -- docs/ledger.spec.md` = **1 file changed / 106 insertions(+) / 14 deletions(-)**，即 **16 处改动**（全部为就地扩写/更正或就地增补/登记，**无一处静默重写**）。
- **交付纪律自检（本版）**：① 两项**均为就地扩写/新增 ＋ 登记**，**未重排任何章节编号**（§10.1 / §10.3 / §7.2 / §7.3 / §15 / §17 / §18 就地增补），新增内容只追加 **§19.16**（依「新增一律向后追加」纪律）；② **R1–R108 条文一字未动、R79 不换号**，规则总数 **108 → 109**（**只追加 `R109`**）；**§14.1 = 33 码不变、未新增错误码**；③ 每一处改写都**保留旧原文**（§10.1 标「v0.11 旧写法」；§10.3 R79 四处原文照录；§15 #6 旧建议值保留并划线、末段 17→16 附旧写法；§17 R79 附旧写法指针；计数处均附旧写法）⇒ **无静默重写**；④ **未连库、未启停面板服务、未跑迁移/探针、未 `commit` / `push`**；⑤ **只写两个文件** —— 就地修改 `docs/ledger.spec.md` ＋ 新增快照 `docs/versions/ledger.spec.v0.11.md`（**该快照此前不存在，本版新建；已有 `v0.1`–`v0.10` 快照一字未动、未覆盖任何已存在文件**）；**未触** `docs/data-layer.spec.md`（另一单正在改它）/ `docs/commission.spec.md` / `backend-ts/**` / `frontend/**` / `migrations/**` / `docs/seafood.master-plan.md`（**只读**）/ `docs/audit/**`（只读）/ `docs/qa/**`；⑥ 全程**无 `pkill -f` / `killall`**、**未用 `timeout` / `gtimeout`**（本机无）、**退出码一律直接取自命令本身**（不取自管道之后）；⑦ **先落骨架再回填**（骨架一轮 = 文件头 ＋ §18 行 ＋ §19 抬头 ＋ §19.16 三小节骨架；回填两轮 = §10/§7.2/§7.3 ／ §15/§17/§19.16），**无一次性大写入**。
- **未执行（已识别，非本册遗漏）**：① 本册**不产生任何实现** —— **编排函数本体**（`0013` / `0014` …，含「**先锁业务行**」的第一句）属**实现侧**（Kong）；② `lockAccounts` 的**唯一入口**是**服务层规约**，本册只发口径、**不含代码**；③ `create_key` / 业务表三件套的列契约在 **`docs/data-layer.spec.md`**（**并行另一单**），本册**只发指针、不改那册**；④ 本册**不发布**任何 `docs/qa/**` 报告（他方产物）；⑤ **行号漂移**（本块首条）**已知且接受**；⑥ 本册**未实跑**任何并发/死锁探针 ⇒ 「新全序消除成环」**属口径裁定，不是实测读数**（若将来要取证，须由质检另立探针并 run-tagged 落盘）。

### 19.17 v0.13 登记（Zang · §5.81 勘误落位：`listing_deposit` 白名单回写）

**背景（裁定来源）**：`docs/seafood.master-plan.md` **§5.81**（`:1390-1399`）—— **Zang 的自我勘误：§5.80 对 route-layer.spec §7-3 的批准作废**。**铁证** = 本册 `:79`（D7 行）「保证金『冻结可退』**❌ 已于 v0.2 被 Kevin 原文推翻**」+ `:12`/`:13`/`:191`（消耗不可退 / 无退还 kind / 删 `_forfeit`）+ **`docs/data-layer.spec.md:454/530/533`（`DL67`/`DL88`/`DL91`【已冻结】）** + **代码与迁移注释**：`backend-ts/src/ledger.ts:148-150` 与 `migrations/0003_kind_close_set_20.sql:5-8`（逐字「保证金在**上市时即消耗**……**进平台收入 `uid=-1`**」）。**根因** = `backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**（P1c 删 `listing_deposit_forfeit` 时**漏删**它）⇒ 代码里「同一 kind 两种口径并存」。

**A. 本册**原有**条文已经是对的（本次**不动**）**：本册自 **v0.2（P1a）** 起把「`listing_deposit` = **消耗**（`$` 从创建者 `balance` 扣、转入 `uid = −1`），**不可退**、**不存在 `listing_deposit_refund`**」写死并留痕：§3.1 **R31**（`:287`）、§5.1 **#19 行**（`:360`，减方列 = 创建者 `balance −d`、增方列 = `uid −1` `balance +d`）、§3.2 转移表（`:269`）、§13.2 `−1` 行（`:827`）、§11 判据 7（`:754`）、§13.3 **R103**（`:846`）、**§0.4**（`:79`）。⇒ **这些行与 §5.81 的最终裁定一致，v0.13 一字不动。**

**B. 真正需要回写的 = R101（§13.3）的 `−1` 增方白名单**：**R101 正文原只列三项** —— `trade_fee` / `listing_fee` / `currency_create_fee`（增方）⇒ **漏了 `listing_deposit`**，而 §13.2 的 `−1` 收入口径（`:827`）**自 v0.2 起已含它** ⇒ **册内自相矛盾**。**v0.13 就地更正 = 把 `listing_deposit` 追加进 R101 的 `−1` 增方白名单**（**只加一格；不删、不改、不重排任何其它格；旧写法「三项」在同处保留留痕**）。落位：**R101 正文**（§13.3）＋ **§17 索引 R101**（就地注记）＋ **§18 变更记录**（追加 v0.13 行）＋ **本 §19.17**；**未动** §5.1 / §3.1 R31 / §3.2 / §13.2 / §11 判据 7（**已正确**）。

**C. 代码侧与 DB 侧（★ 归属 FIX-A，**非本册**；本册**不连库、不跑迁移、不改代码**）**：
- **真根因（逐字）**：`backend-ts/src/ledger.ts:174-175` 的 `HOLD_KINDS` **误含 `listing_deposit`**；而 `−1` 的 credit 白名单（`ledger.ts:541` 一带）**不含**它 ⇒ 若按「消耗入 `−1`」实现，`assertPlatformAccountMutation` 会抛 `LEDGER_RESERVED_UID`（`ledger.ts:548-558`）。这正是 route-layer.spec **v0.1 §7-3 如实揪出**、而 **v0.2 采信了错的一侧**的那处矛盾。
- **Zang §5.81 授权 FIX-A（两件）**：① `backend-ts/src/ledger.ts` **一处手术** —— 从 `HOLD_KINDS` **移除 `listing_deposit`**（**最小 diff、逐行留痕**；「冻结」口径本为护 P3 内核，本次是**已定案缺陷**故显式解冻一单）；② **新增 `0019` 迁移** —— **加法式**扩展 DB 侧 `−1` credit 白名单把 `listing_deposit` 纳入（**照 `0008_platform_revenue_job_fee.sql` 先例**；`migrations/0003` 的 **kind 关闭集仍 20、不动**）。
- **落盘现状（★ 本册收尾现取核实 = 已落盘）**：`migrations/0019_listing_deposit_platform_credit.sql`（167 行）**在盘**；`ledger.ts` 的 `PLATFORM_KIND_WHITELIST['-1'].credit` **已含 `listing_deposit`**、`HOLD_KINDS`（`:178`）**已为 4 项**；`GET /health` 自报 **`schema_version=0019`**（`2026-09-29T17:44:45Z`）⇒ **迁移已应用**。**⚠️ 写作中途翻转留痕**：本 §19.17 初稿按「`0019` 无文件 / 待落盘」写（依据 = 开工时 `ls`），收尾以「`ls` + `grep HOLD_KINDS` + `GET /health`」三读数翻转为「已落盘」—— **以收尾读数为准**，正文各处均已就地更正。**仍未取到（禁当 0/空）**：FIX-A 报告 `docs/audit/p4-b3a-fix-ledger-whitelist.md` 的 **§2–§7 为「待回写」占位**（其 §5 的正向/负对照逐条读数、`tsc` 读数、注册表 17→18 的具体行**本册未取**）；`b3afix-01-verify.json` **未由本册解析**。**落地后须回填**：`0019` checksum / 白名单前后指纹 / kind 关闭集仍 20 的复算 / `HOLD_KINDS` diff 指纹。**注**：DB 侧真身已在 **v0.13 生效前**应用（本册**不声称**「本册改动引起」—— `0019` 由 **FIX-A** 单内应用）。
- **诚实边界**：本册**未连库、未启停服务、未跑迁移或探针、未用 `execute_code`/`git add|commit|push`/`pkill -f`/`killall`**；全部结论来自**只读** `read_file`/`grep`/`sed`/`ls`。

**D. 落位索引（供下游 brief / 验收清单与代码注释对号）**：R101 正文（§13.3）/ §17 索引 R101 / §18 变更记录（v0.13 行）/ §19.17（本小节，含 A–D 四段）。**未动的行**（明确声明）：§5.1（`:334-371`）、§3.1 R31（`:287`）、§3.2 转移表（`:269-272`）、§13.2 `−1` 行（`:827`）、§11 判据 7（`:754`）、§0.4（`:79`）。**编号纪律**：**R1–R109 编号与条文一律不动**（本次**不新增、不重排任何规则**）；**§14.1 仍 33 码**；**章节编号未重排**（v0.13 内容一律追加为 **§19.17**）。**与 `route-layer.spec` 的对接**：该册 **v0.3** 的 §4.1 / §4.2 C2 / §4.3 / §4.4-7 / §7-3 与本册本次口径**一致**（两册同一裁定来源 = Zang §5.81）。
### 19.18 v0.15 登记（Zang · P9⑤ C3 规范回写：`kind` 23 → 24 + `−1` debit 首开 + `R103` 就地修订）

> **性质**：本节 = Zang 终审 `R-9-64` / `R-9-65` / `R-9-66` 的**逐条落册**（裁定源 = `docs/seafood.master-plan.md` **§5.269 B/C** + `docs/commission.spec.md` v0.4 §19）。★ **本节只登记口径与落点**；**实现归 P9⑤ 实现单**（规范方不写实现代码）。**只追加 · 不重排章节**。

**A. `R-9-64`（更正）—— `0037` 的播种源 = `0011:81-145`（非 `0007:317-354`）**：`ledger_assert_commission_conservation` 已被 **`0011`（P2 独立质检修复单 · F3）** 以 `CREATE OR REPLACE` 改写过（含「**事件闭合**（`v_closed` / `event_closed`）」判据）⇒ **`0037_commission_conservation_m0.sql` 的播种源 = `0011:81-145` 逐字**、仅新增 `M = 0` 豁免分支。**铁证（Zang 现取复核坐实）**：`grep -c v_closed` ⇒ **`0011` = 5 ⇄ `0007` = 0**。**⚠️ 若照 `0007:317-354` 抽源** ⇒ 会把 `0011` 的 F3 修复**静默回退** ⇒ 在 `SET CONSTRAINTS … IMMEDIATE` **会话中途假报 `LD032`**（`LEDGER_RECONCILE_MISMATCH`）。**凡本册/姊妹册引「`0037` 自 `0007` 抽源 / 函数体 = `0007:317-354`」处，一律就地更正为 `0011:81-145`**（原行保留留痕）。姊妹册同步点 = `commission.spec` v0.5 §19.6 冲突③块 / `data-layer.spec` v0.27 §34.1 块 + §34.9。

**B. `R-9-65`（落位）—— 首任务 `10$` 两腿 + kind `invite_first_task_reward`（23 → 24）**：**① §6.2② 首任务 `10$` 两腿**：**资金来源 = `uid = −1`（平台收入账户）出账**；**kind = 新增 `invite_first_task_reward`**（**23 → 24**，**末位追加、不改既有次序**）；**幂等键 `biz:invite:firsttask:<worker_uid>`**；**无上级只发本人**；**本人 + 直接上级（`referral.parent_uid`）各 `+firstTaskUsd`**（`firstTaskUsd` 默认 `10`）。**② kind 面（三处编码）**：**`LEDGER_KINDS` 23 → 24**（`ledger.ts` 数组末位 `'invite_first_task_reward'`）；DB 侧 `0038_kind_close_set_24.sql`（`ledger_kind_enum` CHECK **24 值** + `ledger_kind_ok` `CREATE OR REPLACE`（**`p_frozen_settle` 第二支一字不动**）+ `ledger_assert_platform_mutation` `−1` `debit`）。**③ 错误码闭集 33 不动**。

**C. ★ `R-9-66`（我最新终审 · 必须完整落册）—— 准 `−1` debit 首开，但严格限定**：
- **(a) 白名单仅 `invite_first_task_reward` 一项**（**不是**开放 `−1` debit）。
- **(b) `R103` 的「平台运维提取」留白保持不变**（`platform_withdraw` **仍未批**；后台**不得**提供提取按钮）。
- **(c) 判负必须带**：白名单外 `−1` debit 仍必红（`code = LEDGER_RESERVED_UID` / `400`；Zang 原话 `reason = PLATFORM_CREDIT_KIND_FORBIDDEN`，Jing 现取代码 `debit` 支为 `PLATFORM_DEBIT_FORBIDDEN` —— `reason` **非契约**（§14.3 v0.7 (A)）⇒ **判负口径 = `code`**）。
- **(d) 依据** = 需求 **§6.2② 明文授权**（「新用户完成首个平台任务后，邀请双方发放 `10$` 积分」）⇒ 属「**需求规定的发放**」（**系统内转移**），**与 `R103` 所规的「运维提取」（转出系统）不同层级**。
- **(e) 显式登记 + 标「一句话可改」**：备选 = 退回 Poster（`uid = employer`）/ 改由 Poster 出账；**不阻塞**（需求 §6.2② 已明文授权）。

**D. 落位索引（供下游 brief / 验收清单与代码注释对号）**：§5.1（表末位 1 行 + v0.15 加注块）/ §13.3（v0.15 块）/ §14.3（增 1 行）/ §15 #3（加注）/ §17 索引注（`R40`/`R101`/`R103`）/ §18（v0.15 行）/ §19.18（本节）。**未动的行**（明确声明）：R1–R109 编号与条文、§14.1 的 33 码、章节编号。**编号纪律**：**R1–R109 一律不动**（本次**不新增、不重排任何规则**）；**§14.1 仍 33 码**；**章节编号未重排**（本册内容一律追加为 **§19.18**）。**与姊妹册对接**：`commission.spec` v0.5 §19.12 / `data-layer.spec` v0.27 §34.9 / `route-layer.spec` v2.20 §31.11（同批 · 同一裁定源）。

**E. 诚实边界（未测项 · 禁填 0 / 空）**：① `0038` 的 `R-9-24` 真跑自证 + 四项读数 **未跑** —— 归 P9⑤ 实现单（`0038` 现取 **文件在盘、未 apply**）；② 两个新方法（`grantSignupInviteBatt` / `settleInviteFirstTaskReward`）**未真跑** —— 归实现单；③ 首任务腿**未接线**到结算路径（`reviewJobSubmission` / `dispatchJobEvent`）—— ★ 实现方处置正确：`0038` 未 apply 时接线会让每次结算触发必失败写入（= 静默推进）⇒ 只留可调用入口。**本册未连库、未启停服务、未跑迁移/探针、未改代码**（`backend-ts/**` 只读）。

