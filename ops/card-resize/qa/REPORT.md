# QA REPORT · 商品卡改版独立质检（card-resize）

- **质检方** = Zang（独立质检）· **日期** = 2026-10-19 · **基线 HEAD** = `d37a813`（工作树干净，未 push）
- **被检** = 商品卡改版（恒高 412 / 240 通栏 cover / 移除徽章·领取行·limited·礼物图标 / 卖家栏 48 + 掩码 + 信用胶囊 / feed 行键 45→46 / 迁移 0052 / i18n sellerCredit 4 键）
- **结论** = **PASS**（本地全部 AC 通过，`aggregate.json` 171 条判据 0 红）。生产腿为「未 push 旧版预期态」，push 后须复跑（见 §4）。
- **证据** = 本目录 `readings/`（9 份 JSON）＋ `shots/`（5 图）＋ `logs/`（4 份门套日志）；探针 4 件同目录。

---

## 1. AC1 卡高恒 412（关键）— PASS

方法：dev 真页（5787+5788）1440 与 1536 两档，`context.route` 拦 `/api/prize/all` 内存注入四种内容组合（**零写库**）：A 有图（真 dev 媒体 `/api/media/8`）· B 无图（`media_urls=[]` ⇒ 机械鱼占位）· C 长标题恰 60 字 · D 无描述（description 四语全空）。

| 档 | 卡 | cardH | innerH | 图高 | 图宽=卡内宽 | 卖家栏高 |
|---|---|---|---|---|---|---|
| 1440 | A/B/C/D | 412×4 | 412×4 | 240×4 | ✓（207.33） | 48×4 |
| 1536 | A/B/C/D | 412×4 | 412×4 | 240×4 | ✓（223.33） | 48×4 |

- 图 `object-fit:cover`、真解码（`naturalWidth>0`）；B 无图组合照常 412（占位图同规格）。
- 真实 feed（dev 9 卡）与 390 档（9 卡）同样全 412。
- 组合语义抽查：C 标题实长 60；D 卡无 `.sf-reward-desc`。

## 2. AC2 移除项计数 0 — PASS

全部视图（fixture 两档 / 真 feed / 390）：`svg.lucide-gift` = 0（网格级与逐卡）；「库存不足 / 可兑换 / 已兑换 / 人已领取」全文计数 = 0；稀有度光斑 `.blur-xl` 每卡恰 1 个在场（非全卡重做）。

## 3. AC3 卖家栏与信用档 — PASS

- **高 48 / 通栏**：真 feed 逐卡 48、宽 = 卡内宽。
- **掩码**：逐卡匹配 `^0x[0-9a-f]{2}\*\*[0-9a-f]{2}$`、恰 8 字符；对 feed 全部卖家以 DB `evm` 按 `maskWalletAddress` 单源重算逐一致，且**不含完整地址**（例：970213 `0x59f9f640…09b0` ⇒ `0x59**b0`）。
- **占位头像**：`avatar=null` ⇒ 灰底 `rgb(238,240,242)`（=`#EEF0F2`）+ 掩码首字符 `'0'`、无 `<img>`。
- **信用档端到端**：插行前 9 卡全「新卖家」(new)。插 1 行 `stars=5` 评分（ratee=970213 / rater=970101 / target=listing 76 / `customer_to_vendor`）后：API `bID76.seller.credit='excellent'`、其余卖家仍 `new`；真页 bID76 卡胶囊 = 「卖家信用优秀」、其余 8 卡 = 「新卖家」。
- **回收**：评分行 0 → 1 → 0（按 `idempotency_key='qa:card-resize-20261019:excellent'` 复核 0 残留）；`trg_rating_append_only` `tgenabled` 全程 = `O`。

## 4. AC4 数据面 — PASS（dev）；生产 = PRE-PUSH 旧版预期态

**dev（5788）**：`/api/prize/all` 9 行、行键恰 **46**、每行 `seller={uid,nickname,avatar,credit}` 四键；`/api/prize/1` 顶层 **46** 且 `seller.credit` 在场。

**生产（`--host-resolver-rules=MAP 0xseafood.com 76.76.21.21` + `--resolve`）现刻读数**：
- `/api/prize/all`：7 行、行键 **45**、无 `seller` 键；`/api/prize/1`：顶层 46、`seller` 存在但**无 `credit`**（昵称仍旧省略号掩码 `0x59f9…09b0`）。
- 生产首页 7 卡**旧形态**：高 `[374,374,412,412,412,432,374]`、gift 图标 14 个（旧卡每卡 2 处）。
- 归因：`git log origin/main..HEAD` = 2（`d37a813`/`c31f8ae` 未 push，fetch 现核）⇒ 生产前后端均旧版；而生产库 `schema_migration` 顶已 = **0052**（迁移已 apply、代码未上 —— 正是「先 apply 后 push」纪律位）。生产 UI 探针**零未捕获异常**、渲染正常（旧版非白屏）。
- ⇒ 派单 AC4 中「生产 seller.credit 在场 / 首页卡高 412 / 卖家栏在」三条**此刻结构上不可达**，属 **push 后生产终验项**；本 QA 如实留证、不判产品缺陷。**push 后必须复跑** `probe-card-qa.mjs` 的 prod 段（可单独跑）。

## 5. AC5 门套 — PASS

| 门 | 判据 | 实测 |
|---|---|---|
| `frontend build` | exit 0 | `✓ built in 1.87s`，`BUILD_EXIT=0` |
| `test:unit` | ≥62 文件 / ≥598 例 | **62 files / 598 tests** 全过，`TEST_EXIT=0` |
| `backend-ts tsc` | exit 0 | `TSC_EXIT=0`，无 `error TS` |
| `p7b-03` | 37/37 | `total 37 / passed 37 / failed 0`（含 AC10-2） |
| 注册点 | regs=110 | `index.ts` 行首零缩进独立复算 = **110** |
| `schema_migration` 顶 | dev 与生产各一读 = 0052 | dev `quiet-math-65207667`=0052；生产 `sweet-pond-28934105`=0052（`neon.project_id` 自证） |

## 6. AC6 回归 — PASS

- `/api/currencies` = 恰 2 行（`$` / `BTTC`）；`/api/media/999` = **404**。
- `/item/1` 详情页：渲染（`#root` 非空）＋ **零未捕获异常**。
- 390×844 首页：`scrollWidth − clientWidth = 0`（零横向溢出），9 卡全 412。

---

## 7. 纪律与留痕

- **零产品代码 / docs 改动**；不 commit 不 push；未动实现方读数（`ops/card-resize/{SPEC-NOTE.md,probe-card-geometry.mjs,readings,shots,logs}` 原样）。
- **写库披露（仅 1 笔，已回收）**：dev 库 `rating` 插 1 行（§3），前后计数 0→1→0、触发器恒 `O`；卡片四组合夹具走 `context.route` 内存拦截，**零写库**；dev feed 真数据未改动。
- **判据修正留痕（两态自证）**：
  1. mediaW/sellerW 参照：首版拿卡外宽当「卡内宽」恒红（差恒 2px = Card 1px 边框 ×2）⇒ 修正为 `.sf-reward-inner` `clientWidth` 并补 `computed border` 自洽断言（卡宽−边框=内宽）。旧尺对任何实现恒红 = 无效尺；修正后 16 假红 → 0。
  2. 信用档夹具卖家选点：首次 ratee=970101 的 12 行 listing 全非 `listed` ⇒ feed 无其行（`listBrands` 只列 listed）不可观测；改 ratee=970213（feed bID76 卖家）。页面取卡弃子串匹配改 `/\/item\/76$/` 精确正则。首次失败运行**零残留**（已核 count=0、trigger=O）。

## 8. 证据索引

- 探针：`probe-db-reads.mjs`（dev/prod 只读自证）· `probe-card-qa.mjs`（主浏览器探针）· `probe-credit-tier.mjs`（信用档端到端+回收）· `aggregate.mjs`（171 条判据聚合）
- 读数：`readings/{dev-prize-all,dev-prize-1,prod-prize-all,prod-prize-1,db-dev,db-prod,probe-card-qa,credit-tier,aggregate}.json`
- 截图：`shots/{fixture-w1440,fixture-w1536,realfeed-w1440,realfeed-w390,prod-w1440}.png`
- 日志：`logs/{build,test-unit,backend-tsc,p7b-03}.log`（判读只认落盘 `*_EXIT` 与 `Test Files/Tests` 行）
