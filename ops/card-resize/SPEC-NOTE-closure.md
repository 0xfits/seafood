# SPEC-NOTE · 商品卡改版收口（closures）—— master §5.429 + design §26.10 + 版本行 v0.346

- **仓**：`/Users/kevin/bistro/seafood` · **角色**：Jing（只写 `docs/**` + 本件）
- **落笔时点**：2026-10-19 · **HEAD** = `133ed34`（生产终验证据笔；`origin/main = 937b861`，编制时点 ahead 1）· **本笔不 push**
- **正典位置**：`docs/seafood.master-plan.md` **§5.429 + 版本行 v0.346** · `docs/design/design-system.spec.md` **§26.10**（v1.25 契约的实现面回写、**不升版** · **★ 编号勘误：派单写「26.8」，而 §26.8 / §26.9 已被 v1.25 占用 ⇒ 现取顺延 §26.10**，承 v1.24 `T121` 先例）

## 0. 一句话

商品卡改版（Kevin 四条 + 掩码二轮再简短）**四段闭环收口**：实现 `d37a813` → 独立质检 `937b861`（**171 判据 0 红**）→ push `12a94de..937b861`（3 提交 · **迁移先行** schema 0051→0052）→ 生产终验 `133ed34` **PASS**（7 卡恒 412 · 图 240×223 cover 含真实上传图 · 卖家栏 48 + `0x**` 掩码 · gift/徽章 0 · 零异常）；本笔 = Jing 收口回写，**零代码、纯追加删行 0、不 push**。

## 1. 文件面（本笔只改这 3 件）

| # | 文件 | 动作 | numstat（现取） |
|---|---|---|---|
| 1 | `docs/seafood.master-plan.md` | 前插 **§5.429**（§5.428 之前 · 倒序前插）+ 版本表新行 **v0.346** | `19 0` |
| 2 | `docs/design/design-system.spec.md` | 文末新节 **§26.10**（26.10.1–26.10.4 · §26.0–§26.9 一字未改） | `36 0` |
| 3 | `ops/card-resize/SPEC-NOTE-closure.md` | 新建（本件） | 新增文件 |

`frontend/**` / `backend-ts/**` / `docs/route-layer.spec.md` / `docs/data-layer.spec.md` / `docs/OPEN-ITEMS.md` / `docs/design/style-preview.html` **零改动**；收尾时 `git status` 除本 3 件外应无改动。

## 2. 四段闭环（commit 链现取）

| 段 | commit | 内容 |
|---|---|---|
| 契约 | `c31f8ae` | design v1.25 §26（`T122`）+ master §5.428 / v0.345 + OPEN-ITEMS v2.46 `B40`/`B41` + route §41.3 勘误 + data-layer §40.7（6 文件 `+193 −0`） |
| 实现 | `d37a813` | **35 文件 `+1,922 −182`**（测试 16 文件 = 新增 `reward-card-resize.test.jsx` 212 行 + 既有改锚 15 文件） |
| 质检 | `937b861` | verdict = `ops/card-resize/qa/verdict.json`（head `d37a813`）· **171 判据 FAILED=0** · 六 AC 全 PASS |
| 上线 | push `12a94de..937b861` | 3 提交（`c31f8ae` + `d37a813` + `937b861`）· **迁移先行**：`0052_users_avatar_url.sql` 生产先 apply（schema **0051→0052**）再 push |
| 终验 | `133ed34` | 证据笔（push 后独立提交、只含 `ops/card-resize/prod-verify/**` 6 文件 `+266 −0`、不触发部署；承 `0d8d15f` 体例） |

## 3. 掩码终态（写死 · 二轮再简短）

`maskWalletAddress(evm) = evm.length >= 8 ? evm.slice(0,4) + '**' + evm.slice(-2) : evm`（`backend-ts/src/messages-service.ts:607` 现取）＝ **`0x` + 前 2 位 + `**` + 末 2 位**、恰 **8 字符**（例 `0x12**cd`；长度不足 8 兜底原样返回）。**作废链（旧字面全部逐字保留）**：route §41.3「前 6 + `…` + 后 4」→ 6 星定式「`0x1234******abcd`」→ **终态 `0x12**cd`**；design §26.0 / §26.1d / §26.4 / **§26.7 #6** 旧字面同批作废（§26.10.1 状态改写式收口）；§26.7 #6 判负实质不变（明文 EVM 全量即判负）。适用面：详情卖家名与 feed `seller.nickname` 同源共用。

## 4. 质检读数（`937b861` · 171 判据 0 红）

| 臂 | 读数 |
|---|---|
| AC1 恒高 | 四组合夹具（有图 / 无图⇒占位 / 长标题 60 字 / 无描述）× 1440/1536 共 8 读数**卡高恒 412**（图高恒 240、宽 = 卡内宽；真实 feed 9 卡 + 390 档 9 卡同 412） |
| AC2 移除项 0 | `.lucide-gift` = 0 ·「库存不足/可兑换/已兑换/人已领取」全文 = 0 · 稀有度光斑每卡恰 1 在场 |
| AC3 卖家栏/掩码/信用 | 卖家栏恒 48 · 掩码 8 字符、对 feed 全部卖家以 DB `evm` 单源重算逐一致 · avatar=null ⇒ 灰底 `rgb(238,240,242)` + 掩码首字符、无 `<img>` · **插 1 行 5 星（ratee=970213，bID76 卖家）⇒ API credit=excellent + 页面「卖家信用优秀」、其余 8 卡仍「新卖家」** |
| AC4 数据面 | dev `/api/prize/all` 行键恰 46、每行 `seller{uid,nickname,avatar,credit}` · `/api/prize/1` 顶层 46 且 `seller.credit` 在场；生产腿 push 前**旧版预期态**（行键 45 / gift=14）＝非缺陷，终验复跑 |
| AC5 门套 | build 0 · `test:unit` **62 文件 / 598 例** · `tsc` 0 · `p7b-03` **37/37** `regs=110` · 双库 schema 顶 `0052` |
| AC6 回归 | currencies 2 行 · `/api/media/999` 404 · 390 档零横向溢出 · `/item/1` 零未捕获异常 |
| 自纠 ×2 | ① 尺参照改 `.sf-reward-inner` clientWidth（卡内宽；卡外宽旧尺因 1px 边框差恒 2px ⇒ **16 假红→0 红**）② 信用档夹具 ratee 970101→970213（前者无 listed 行不可观测） |
| 回收 | rating before 0 / during 1 / after **0**（`idempotency_key` 复核）· append-only 触发器前中后 `'O'` · 夹具 = route 内存拦截零写库 |

## 5. 生产终验读数（`133ed34` · 证据 `ops/card-resize/prod-verify/`）

- **同版 sha256 逐字**：js `14eb3c5dab5279b8…`（`index-DXq98gqt.js` **497,271 B**）/ css `df93ff44c0bcd0a3…`（`index-DiTWfu5R.css` **125,431 B**）。
- **真浏览器 1536 档**：**7 卡**（生产 `listed` 全量 = 4 旧 + 3 新）· 卡高 **412 ×7** · 图 **240×223 ×7** cover（`naturalWidth`：320 占位 ×5 / **960、612 真实上传图 ×2**）· 卖家栏 **48 ×7** · 掩码 `0x59**b0` / `0xf7**da` / `0xb8**27` / `0x9a**2b` 全命中 · 信用标签全「新卖家」· gift=0 / 徽章=0 / pageerror=0 / console error=0。

## 6. 诚实边界

- **信用四档生产仅「new」可见**：生产 `rating` **0 行** ⇒ 「优秀 / 良好 / 一般」三档生产不可见，只在 dev 插行取证（插 5 星 ⇒ excellent、回收零残留）；三档生产可见性待真实评分出现后自然可验，不造假数据。
- **头像全占位**：生产 `avatar_url` 全 null；`0052` 列已建但写入口不存在（`B41` 待立单）。
- **死键未删**：`rewardCard.limited` / `common.claimedUnit` 已死未删（`B40` 另立单）。
- 挂账不变：`B37` / `B38` / `B39` / `B40` / `B41`。

## 7. 两处落地差（如实登记 · 非缺陷）

1. **6 列规则 = `styles.css` 字面（非 token）** —— 属 §25.11.3 既有落地差（`feed-cols-xl` 未入 `STRUCT`），商品卡不改列数面 ⇒ 只指针、不重复登记。
2. **卡内宽实测 223** —— 223 = 卡内宽（§26.0 网格锚 ≈225 − 卡体 1px 边框 ×2），两者相容；**252 为 Kevin 测量近似、非判负**（§26.0 / §5.428 C）；QA 首版 16 条假红已自纠（见 §4）。

## 8. 本笔性质 / 未做

- 零代码、零迁移落盘、零服务启停；两册 `git diff --numstat` 删除列 = **0**（19/0 + 36/0）+ 本件新建；**commit 只 add 本笔 3 件；不 push**（生产已在 `937b861` 终验态；`133ed34` 与本笔均未 push）。
- 未做：`B40` 死键清理、`B41` 头像上传能力（均挂账另立单）；信用胶囊色值维持「不锁」（现取 Tailwind 阶已登记 §26.10.2）。
