# 商品分类批次（`item-type`）独立质检报告

- **仓**：`/Users/kevin/bistro/seafood` · 分支 `main` · 工作树 `1eecbb7`（前端）＋ `acfaa0b`（后端 + 迁移 0053）；两者**均未 push**（`origin/main..HEAD` = 2 条）
- **契约**：`design §26.12` / `route §49.11` / `data §40.8`（`ops/item-type/SPEC-NOTE.md` 为转引底本）
- **环境**：dev 库 `neon.project_id=quiet-math-65207667`（`schema_version=0053`、`schema_migration` 52 行、`listing` 14 列）；后端 `localhost:5788`、前端 `localhost:5787`、H5 预览 `5800`
- **方法**：真钱包登录（`ethers.Wallet.createRandom()` → `POST /api/auth/challenge` → `signMessage` → `POST /api/auth/verify`，token 239 字符）＋ 真写 dev 库（自建夹具，收口全删）＋ 真浏览器（系统 Chrome / Playwright，1536 与 390 两档真站）
- **纪律**：未改产品代码 / 文档 / 他人读数；**未 commit、未 push**（`git status` 仅 `?? ops/item-type/qa/`）

## 0. 结论

**verdict = PASS**（6 条 AC + 回收，逐条独立读数；0 条 failed）。逐条机读件见 `verdict.json`，原始读数在 `readings/`，门套日志在 `logs/`。

| # | AC | 结论 | 关键读数 | 证据文件 |
|---|---|---|---|---|
| 1 | 写口边界 | **PASS** | 12 例全绿：三值 200 且落库逐字一致；`''`/`'   '`/`'digital'`/`'Bogus'` 全 **400** `LEDGER_AMOUNT_INVALID` + `reason=NOT_IN_CLOSED_SET` + `allowed` 三值；缺省/`null` ⇒ 库内 `NULL`；`PATCH`/编辑口带 `item_type` ⇒ 库值不变 | `readings/ac1-ac2-write-read-port.json` |
| 2 | 读口键数 | **PASS** | feed 行键 **48**（含 `item_type`）、详情 `data` 键 **47**；15 行逐行与 DB 对拍 **mismatch 0** | 同上 |
| 3 | 全链 E2E（卡面标签） | **PASS** | 1536 真页：`[data-sf-m="reward-card-ship-tag"]` 在场、为 `.row1-wrap-title` **第一个子元素/第一个节点**、文本 `包邮`、bg `rgb(255,230,15)`、color `rgb(32,32,32)`、12px / 700、圆角 2px；行高 **48**、卡高 **392**；`Digital`/`PhysicalBuyerShip`/`NULL` 三臂无标签；全 feed 标签数 = **1**；零 pageerror | `readings/ac3-ac4-ac6-browser.json` |
| 4 | 发布页 2+2 | **PASS** | 未选分类 ⇒ **0** 个 `/api` 请求 + 组高亮（`data-sf-miss=1` + `sf-item-choice-miss` + `aria-invalid=true` + 「请求参数错误」）；实物未选运费 ⇒ **0** 请求 + 运费组高亮；数字档运费组**不在 DOM**、切回实物时选择被清空；正控臂合法提交 ⇒ 2 请求（POST + PATCH） | 同上（`ac4` 段） |
| 5 | 门套 | **PASS** | build **exit 0**（`✓ built in 1.84s`，`index-DKwYoDGj.js` / `index-DNTm1wEg.css`）；`test:unit` **63 文件 / 631 例 / 0 failed**；backend `tsc --noEmit` **exit 0**；`p7b-03` **37/37、failed=0、registration_points=110** | `logs/frontend-gates.log`、`logs/backend-gates.log`、`backend-ts/.p7b-artifacts/p7b-03-offline-gates-20261019T223853Zw4i7.json` |
| 6 | 回归 | **PASS** | `/api/currencies` 200 / **2 行**（`1 $`、`399 BTTC`）；`/api/media/999` **404** `LEDGER_REF_NOT_FOUND`；`/api/prize/1` 200 `success=true` 零 error（47 键）；390×844 首页 `scrollWidth−clientWidth = 0`、卡 18、标签 1、底栏 5 格 | `readings/ac6-regression-http.json`、`readings/ac3-ac4-ac6-browser.json` |
| R | 自建数据回收 | **PASS** | 10 件夹具（77–86，含转 listed）删除；`listing 36 → 26`；`listing_order/conversation/message/ledger_entry/favorite/review_log` **前后同值**；`content_translation 402 → 354`（−48，夹具翻译行）；`trg_listing_no_delete` 事务内 `D` → 事务后 `O`；删后逐 id 引用面 **全 0** | `readings/cleanup-purge.json`、`readings/db-post-cleanup.json` |

## 1. AC1 · 写口边界（`POST /api/listing`）

真登录：`challenge 200 → verify 200`，`uid=971224`，`evm=0x887915dc…a67fc`，`token_len=239`。

| 用例 | 发送 | http | code / details | 库内 `item_type` |
|---|---|---|---|---|
| `Digital` | `item_type:"Digital"` | 200 | — | `Digital` ✅ |
| `PhysicalFreeShip` | `PhysicalFreeShip` | 200 | — | `PhysicalFreeShip` ✅ |
| `PhysicalBuyerShip` | `PhysicalBuyerShip` | 200 | — | `PhysicalBuyerShip` ✅ |
| 缺省 | 字段不传 | 200 | — | `NULL` ✅ |
| 显式 null | `item_type:null` | 200 | — | `NULL` ✅ |
| 空串 | `""` | **400** | `LEDGER_AMOUNT_INVALID` / `{field:"listing.item_type", reason:"NOT_IN_CLOSED_SET", provided:"", allowed:[3]}` | 未写入（0 行）✅ |
| 空白串 | `"   "` | **400** | 同上（`provided:""`，实现先 trim） | 未写入 ✅ |
| 小写 | `"digital"` | **400** | 同上（`provided:"digital"`） | 未写入 ✅ |
| 闭集外 | `"Bogus"` | **400** | 同上（`provided:"Bogus"`） | 未写入 ✅ |
| PATCH 带类型 | `{to_status:"listed", item_type:"PhysicalBuyerShip"}` | 200 | — | 仍 `Digital`（状态已 listed）✅ |
| PATCH 只带类型 | `{item_type:"PhysicalFreeShip"}` | 400（缺 `to_status`） | `LEDGER_AMOUNT_INVALID` | 仍 `Digital` ✅ |
| 编辑口带类型 | `POST /api/listing/:id {item_type:"PhysicalBuyerShip"}` | 200 | — | 仍 `Digital` ✅ |

**说明**：`SPEC-NOTE §5.1 第 1 项` 曾登记「落盘把空串当未填（⇒ null）」的差额 —— **现盘已不成立**：`normalizeItemType` 先 `trim` 再闭集判定，空串/空白串落 400，与 AC 契约一致，本项结案。

## 2. AC2 · 读口键数

| 口 | http | 行键数 | 含 `item_type` | 与 DB 一致 |
|---|---|---|---|---|
| `GET /api/prize/all?limit=200` | 200 | **48** | 是 | 15 行逐行对拍 **0 不一致**（`Digital 2 / PhysicalFreeShip 1 / PhysicalBuyerShip 1 / NULL 11`） |
| `GET /api/prize/82`（`data`） | 200 | **47** | 是（值 `Digital`） | 库内 `Digital` ✅ |

## 3. AC3 · 全链 E2E（真发布 → listed → 首页真页 1536）

流程：真登录 → `POST /api/listing`（标题 `IT-TYPE-QA-20261019223806-ship`，`item_type=PhysicalFreeShip`）→ `PATCH to_status=listed` → 打开 `http://localhost:5787/`（1536×1000，预置真会话，light 主题）。

| 判据 | 读数 |
|---|---|
| 标签在场（该卡） | ✅ `[data-sf-m="reward-card-ship-tag"]` |
| 位置 | ✅ `h3.firstElementChild === 标签`（且 `h3.firstChild` 即标签）、标签 rect.x **303** < 标题文字 rect.x **334.5** |
| 文本 | ✅ `包邮` |
| 背景 / 字色 | ✅ `rgb(255, 230, 15)` / `rgb(32, 32, 32)` |
| 字号 / 字重 | ✅ `12px` / `700` |
| 附加盒读数（登记项） | 圆角 `2px`、高 `16px`、`line-height 16px`、padding `0 4px`、`margin-right 4px`、`inline-block`、`nowrap` |
| 行高 / 卡高 | ✅ `row1.offsetHeight = 48`、卡 `offsetHeight = 392` |
| 另外三臂 | ✅ `Digital` / `PhysicalBuyerShip` / `NULL` 三卡均**无标签**，且行高 48 / 卡高 392 |
| 全局 | 全 feed 标签数 **1**（只有 `PhysicalFreeShip` 臂），18 卡无 pageerror |
| 390 档旁证 | 标签仍 1、文本 `包邮`、卡 392 / 行 48、零横向溢出 |

## 4. AC4 · 发布页 2+2 控件

真登录态打开 `/item/new`，先填 `title` / `price`（避免原生 `required` 抢先拦截，让闸落在分类/运费上），再逐臂点「发布闲置」，并统计点击窗口内的 `/api` 请求（`page.on('request')`）：

| 臂 | 状态 | `/api` 请求数 | 高亮 / 提示 |
|---|---|---|---|
| A 未选分类 | 点提交 | **0** | `item-select-type`：`data-sf-miss="1"`、class `sf-item-choice-miss`、`aria-invalid="true"`、页内文案「请求参数错误」 |
| B 实物 + 未选运费 | 点提交 | **0** | `item-select-ship` 同形高亮（组已渲染） |
| C 联动 | 切数字 | — | `item-select-ship` **不在 DOM**（非 `display:none`） |
| C 回切 | 打印 → 实物 | — | 运费组重现且选项被清空（`checked=null`，无 stale 值） |
| D 正控（尺子灵敏度） | 数字 + 必填齐 ⇒ 真提交 | **2**（`POST /api/listing` → `PATCH /api/listing/<id>`） | 证明零请求读数不是计数器失效；该行（id 86）已回收 |

## 5. AC5 · 门套

| 门 | 读数 | 判据 |
|---|---|---|
| `npm run build` | `✓ built in 1.84s`、`BUILD_EXIT=0` | exit 0 ✅ |
| `npm run test:unit` | `Test Files 63 passed (63)`、`Tests 631 passed (631)`、`TEST_EXIT=0` | ≥63 文件 / 631 例 ✅ |
| backend `npx tsc --noEmit` | `TSC_EXIT=0` | 零错 ✅ |
| `p7b-03-offline-gates` | `total 37 / passed 37 / failed 0`，`AC10-2 reading="registration_points=110"` | failed=0 且 110（111 判负）✅ |

`npm run lint` 未跑：仓内无 ESLint 配置（`git ls-files '*eslint*'` 空、`package.json` 无 `eslintConfig`），恒 exit 2 属存量，本单不据此判负。

## 6. AC6 · 回归

| 项 | 读数 | 结论 |
|---|---|---|
| `GET /api/currencies` | 200、**2 行**、行键 `cid/name/symbol`、值 `1 $` / `399 BTTC` | ✅ |
| `GET /api/media/999` | **404** `LEDGER_REF_NOT_FOUND`（`reason=media_not_found`） | ✅ |
| `GET /api/prize/1` | 200、`success=true`、无 `error`、47 键、`item_type=null` | ✅ 零异常 |
| 390×844 首页 | `overflow_x=0`、`body_overflow_x=0`、卡 18、标签 1、底栏 5 格、零 pageerror | ✅ 零溢出 |

## 7. 自建数据回收（含「转 listed」）

| 表 | 删前 | 删后 | 差 |
|---|---|---|---|
| `listing` | 36 | **26** | −10（= 基线 26） |
| `listing_order` | 18 | 18 | 0 |
| `conversation` | 1 | 1 | 0 |
| `message` | 7 | 7 | 0 |
| `ledger_entry` | 509 | 509 | 0 |
| `listing_favorite` | 0 | 0 | 0 |
| `listing_review_log` | 0 | 0 | 0 |
| `content_translation` | 402 | 354 | −48（10 件夹具的 pending 翻译行，同事务删） |
| `media` | 2 | 2 | 0 |

- 删前引用面（仅针对 10 件夹具）：`listing_order/conversation/favorite/review_log/ledger_entry` **全 0** ⇒ 无阻断；`content_translation` 48 行一并在事务内清除。
- 删法（仓内既有先例）：单事务 `DISABLE TRIGGER trg_listing_no_delete` → `DELETE … RETURNING` → `ENABLE TRIGGER`；**事务内读到 `D`、事务后读到 `O`**（`trigger_restored=true`）。
- 删后逐 id 复核：`listing / content_translation / listing_review_log / listing_order / conversation / listing_favorite` **全部 0 命中**；`leftover_rows=0`；feed 复读 9 行、`IT-TYPE-QA-` 前缀行 **0**、`item_type` 全 `null`。
- 披露 ①：事务内 `DELETE content_translation` 无 `RETURNING` ⇒ 该步返回行数读作 0，实际删除行数取**前后计数差 48**。
- 披露 ②：QA 登录钱包账户 `uid=971224`（`0x8879…a67fc`）留在 `users`（`batt_account`/`batt_entry` 引用、登录即建），**不删**。

## 8. 观察 / 披露（均不判负）

1. **`vertical-align` 偏离**：落盘 `.sf-reward-ship-tag{vertical-align: baseline}`，`design §26.12.1` 写 `middle`。该属性既不在判负清单（#15–#19）也不在读数登记项内 ⇒ 登记不判负；实测标签 y=1780 / 标题文字 y=1778（2px 基线差），**未抬行**（行高 48 / 卡高 392 均成立）。
2. **标签实测宽 27px**（`12px × 2 汉字 = 19.2` + padding 8）；`SPEC-NOTE §5` 的「≈32px」是估算值，非契约数。
3. **AC2 探针取值瑕疵**：`readings/ac1-ac2-write-read-port.json` 的 `created_in_feed[].title` 为 `null`，因 feed 行的标题键是 **`name`**（探针按 `title` 取）；`in_feed=true` / `item_type` 两列不受影响，属探针取值瑕疵，不是接口缺陷。
4. **基线读数落盘缺口（诚实登记）**：改动前的库面基线（`listing` 26 行 / `item_type` 全 `NULL` / `schema 0053`）由 `db-probe.mjs` 首跑取得，但当时 `tee` 目标目录尚不存在 ⇒ 该次 JSON **未落盘**（控制台读数仍在）。等价终态读数 = `readings/db-post-cleanup.json`（26 行 / 全 `NULL` / 0053 / 引用面同值），删前计数 = `readings/cleanup-purge.json` 的 `counts_before`。
5. **探针重跑代价（已回收）**：为取「零网络」正控与联动读数，浏览器探针跑 3 轮，共产生 4 件 `publish-door` 夹具（83–86），与 6 件 AC1/AC3 夹具一并删除（共 10 件）。

## 9. 本单产出文件（全部新增，未入库）

```
ops/item-type/qa/
├── REPORT.md                     # 本文件
├── verdict.json                  # 机读判决（逐条 AC + 回收）
├── qa-api.mjs                    # AC1 + AC2 探针（真登录 + 真写 + 只读对拍）
├── qa-browser.mjs                # AC3 + AC4 + AC6(390) 探针（真浏览器）
├── qa-ac6.mjs                    # AC6 HTTP 面探针
├── db-probe.mjs                  # 只读库面快照
├── cleanup.mjs                   # 自建夹具回收（单事务 DISABLE→DELETE→ENABLE）
├── readings/
│   ├── ac1-ac2-write-read-port.json
│   ├── ac3-ac4-ac6-browser.json
│   ├── ac6-regression-http.json
│   ├── cleanup-purge.json
│   ├── created-listings.json
│   └── db-post-cleanup.json
└── logs/
    ├── frontend-gates.log
    ├── backend-gates.log
    └── browser-run.log
```

**未做 / 边界**：未 commit、未 push（push = 上线）；未改 `frontend/**`、`backend-ts/**`、`docs/**`；未重跑他人门脚本的断言、未删任何失败项。
