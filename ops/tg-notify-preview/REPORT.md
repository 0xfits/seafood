# 窄质检报告 · Telegram 通知带预览（首 6 显示宽单位）+ confirm 形状闸 `reason = SHAPE_INVALID`

- 仓：`/Users/kevin/bistro/seafood` · 角色 = **Neng（窄质检）**：不修码、不碰 `docs/**`（只读）、**未 commit**、**未 push**。
- 被检提交：后端 `a280afe`（`buildMessagePreview` / `buildMessageNotificationText` / `SendMessageOutcome.body` / 形状 `reason`）、模板字面对齐 `e18716d`、四语文案 `c804ef1`、规范 `14f1ec6` / `d34bfdf`（非本单读面，仅登记存在）。
- 开工 HEAD = 收口 HEAD = **`e18716d`**（验收期间无漂移；`git rev-parse HEAD` 现取两次一致）。
- 环境：dev 后端 `localhost:5788`（PID 24583 / 监听 24597，`/api/health.schema_version` = **0048**）；前端 vite `localhost:5787`（构建 + vitest 离线跑）；哑配置在 `backend-ts/.env.local`。
- 工作树：只多出未跟踪目录 `ops/tg-notify-preview/`；`git status --porcelain -- docs/` = **0 行**（docs 一字未动）。

## 结论速览

| AC | 项 | 判定 | 读数文件 |
|---|---|---|---|
| AC-1 | 出站文本真链取证（真 import + fetch 捕获 + 自写向量 + 变异体判负） | **PASS**（38/38 checks） | `readings/ac1-outbound-text.json` |
| AC-2 | confirm 形状闸 400 + `reason=SHAPE_INVALID`；查无 8 位码 404 且 `reason ≠ SHAPE_INVALID`；免鉴权 401 | **PASS**（8/8 checks） | `readings/ac2-shape-reason.json` |
| AC-3 | 回归（webhook→confirm→status→unbind→库回 null；冷却闸；门套） | **PASS**（8/8 checks + 5/5 门套） | `readings/ac3-regression.json` · `gates/` |
| AC-4 | 前端四语 `telegram.desc` + `/profile/settings` 登录态 Telegram 卡 | **PASS**（4 语 ×3 + grep + 浏览器） | `readings/ac4-frontend.json` |
| — | 副作用与具名披露 | 3 条合成 tg id / 3 行 `bind_request`（具名）· 账号终态 `tg_user_id=null` | `readings/side-effects.json` |
| — | 未读到 / `NOT_MEASURED` | 7 条（含 1 条环境性 FAIL 保留） | `readings/not-measured.json` |

---

## AC-1 出站文本真链取证（`readings/ac1-outbound-text.json`）

探针：`probes/probe-ac1-realchain.ts`
跑法：`cd backend-ts && npx ts-node --transpile-only --project tsconfig.scripts.probe.json /Users/kevin/bistro/seafood/ops/tg-notify-preview/probes/probe-ac1-realchain.ts <out.json>`

真链口径（**不得重写截断逻辑** ⇒ 本探针真 `require` 被测模块）：

- `require('backend-ts/src/messages-service')` —— 真模块、真导出（`buildMessagePreview` / `buildMessageNotificationText` / `notifyMessageCounterpart`）。
- `globalThis.fetch` 被 stub ⇒ **捕获真实发送路径的 payload**（3 次真链调用：正常正文 / 全空白正文 / 长标题）。
- `db.readQuery` 仅**读面**被路由：`app_config`（站点名）走**真库读**；对端绑定行返回**合成** chat_id + 标题（具名披露见副作用节）。SQL 全量记录在读数 `sql_seen`（**3 次真链 × 2 条同形 SQL = 6 次执行**：`conversation×users×listing` 取对端 `tg_user_id`/标题 + `app_config` 取站点名 ⇒ 与改动前**同形**，正文由调用处传入、**无新增查询**）。

| 组 | 断言 | 结果 |
|---|---|---|
| a | 现取 §41.7「模板 = …」行做**括号配对抽取**（非手抄），占位符代入后与实现**逐字一致** | PASS（行 `docs/route-layer.spec.md:8187`，模板 sha256 见读数） |
| a | 无预览 ⇒ 与**旧字面**（`git show a280afe^:backend-ts/src/messages-service.ts` 现取）逐字一致（原形零位移） | PASS |
| b | 自写向量 17 条（汉字 3/4 · 拉丁 6/7 · 中英混合两向 · 国旗区域指示符 · ZWJ 家庭簇 · 全角标点 · 首尾空白 · 空串/全空白/数字/null） | PASS 17/17 |
| b | emoji 簇完整性：无孤立代理半体、不以 ZWJ 结尾 | PASS |
| b | 不变量（探针**自建独立尺子**，不复用被测实现）：输出（去 `…`）显示宽 ≤ 6 | PASS |
| c | 英文半段逐字未变（` / You have a new message, open <site>/messages`）；预览恰 1 次；英文半段恰 1 次 | PASS |
| e | 真链 fetch 捕获：URL = `bot***/sendMessage`、`chat_id` = 合成 `tg_user_id`、`text` 与 §41.7 模板逐字一致、无「：」引出预览的作废形态 | PASS |
| e | 全空白正文真链 ⇒ **整句逐字回原形、无「」预览段** | PASS |
| e | 长标题（> 12 字）⇒ 掩码标题（首 12 字 + `…`）后紧接预览，且不含完整标题 | PASS |
| d | 负向 M1 / M1b / M2（见下） | PASS |

真链实测出站文本（读数 `real_chain.payload`）：

```
海鲜市场：你有新消息（来自会话：Probe-List）「你好吗…」，打开 https://0xseafood.com/messages 查看 / You have a new message, open https://0xseafood.com/messages
```

### d. 负向（变异体 ⇒ 必红 · 证明尺子灵敏）

变异体位置（披露）：`/Users/kevin/bistro/seafood/ops/tg-notify-preview/probes/mutants-msg-preview.ts`
—— **本地手写的等价副本**（`backend-ts/**` 一字未改），只改一处：

- **M1 `mutantPreviewTrunc7`**：预算 6 → **7** 显示宽单位。同一套自写向量下**判红 3 条**（`b4` 拉丁 7、`b6` 中英混合、`b8` 国旗+拉丁），真实现同套向量 **0 条红**。
- **M1b 边界差分**：`abcdefgh`（8 单位）⇒ 真实现 `abcdef…` / M1 `abcdefg…` —— 两者**必不同**（切在 6 vs 7 单位的差分点）。
- **M2 `mutantNotificationAlwaysPreview`**：空预览也照插「」⇒ 真实现回原形 / M2 输出含 `「」`，判红。

---

## AC-2 形状闸（`readings/ac2-shape-reason.json`）

| 入参 | 鉴权 | HTTP | `error.code` | `details.reason` |
|---|---|---|---|---|
| `1234567`（7 位） | 无 | **401** | — | — |
| `1234567`（7 位） | 有 | **400** | `TG_CODE_INVALID` | **`SHAPE_INVALID`** |
| `123456789`（9 位） | 有 | **400** | `TG_CODE_INVALID` | **`SHAPE_INVALID`** |
| `AB123456`（含字母） | 有 | **400** | `TG_CODE_INVALID` | **`SHAPE_INVALID`** |
| `1234 5678`（含空格） | 有 | **400** | `TG_CODE_INVALID` | **`SHAPE_INVALID`** |
| webhook 签发的**合法 8 位数字码**（含 0/1） | 有 | **200** | — | 不落形状分支（`tg_linked=true`） |
| `91919191`（库内 `count=0` 的 8 位码） | 有 | **404** | `LEDGER_REF_NOT_FOUND` | `code_not_found`（**≠ `SHAPE_INVALID`**） |

- 401 免鉴权面、4 种非法形状、合法码不误杀、查无码 404 与形状 400 **不同名** —— 全部 8/8 PASS。
- 对照要点：形状分支 reason = `SHAPE_INVALID` 与查无分支（`LEDGER_REF_NOT_FOUND` + `reason=code_not_found`）**不同名不同码**，防同名回归成立。

## AC-3 回归（`readings/ac3-regression.json` · 门套 `gates/`）

往返（uid **971214** · 合成 tg id 见副作用节）：`confirm` ⇒ **200 `tg_linked=true`** → `status` ⇒ `tg_linked=true` 且响应**不含 `tg_user_id` 数值**（隐私读面）→ `bind_request.consumed_at` 已落 → `unbind` ⇒ **200** → `status` ⇒ `tg_linked=false` → **只读库** `users` 行：`tg_user_id = null` 且 `tg_linked_at = null` ✅（8/8 checks）。

- 已消费码重放：**400** + `TG_CODE_INVALID` + `details.reason = CONSUMED`（读数 `consumed_code_replay`；与形状闸 `SHAPE_INVALID`、查无 `code_not_found` 三者**互不同名**，对照观察、不计判定）。
- 冷却闸：同 id 二次 `/start` ⇒ **200 / 200**，`telegram_bind_request` 行数 **1 / 1**（不落第二行）。
- 门套（`gates/exitcodes.txt`）：

| 门 | 命令 | exit | 读数 |
|---|---|---|---|
| 前端构建 | `cd frontend && npm run build` | **0** | `gates/fe-build.log` |
| 前端单测 | `npx vitest run src/test/unit --reporter=basic` | **0** | `Test Files 54 passed (54)` / `Tests 519 passed (519)` —— 不少于 54 files / 519 tests ✅ |
| 后端构建 | `cd backend-ts && npm run build` | **0** | `gates/be-build.log` |
| 离线单测 ① | `npx ts-node --transpile-only scripts/test-msg-preview-offline.ts` | **0** | `ALL PASS (10 groups)` |
| 离线单测 ② | `npx ts-node --transpile-only scripts/test-tg-bind-v2-offline.ts` | **0** | `ALL PASS (13 groups)` |

## AC-4 前端（`readings/ac4-frontend.json`）

四语 `telegram.desc`（逐字现取）：zh `…（含消息开头摘要）` / hk `…（含訊息開頭摘要）` / en `…(includes a preview of the message opening)` / vn `…(kèm trích đoạn đầu tin nhắn)` —— 均含新串 ✅；旧串四形（`不包含消息内容` / `不包含消息內容` / `content not included` / `không kèm nội dung`）**全仓计数 = 0** ✅。

浏览器（CDP · `/usr/bin/python3` 路径 + 条件等待 Telegram 节点出现，**无固定 ms 等待**；登录态经 `localStorage.user/token` 注入 —— token 落 scratch 文件未打印）：

- `GET http://localhost:5787/profile/settings` ⇒ 渲染出 **「Telegram 通知」卡**，正文 = zh `telegram.desc` 逐字（`含消息开头摘要`），DOM 内 `Telegram` 出现 3 次，截图 `shots/ac4-profile-settings.png`。
- 卡内状态面显示「加载中...」（status 异步面）—— 非本单读面。

## 副作用与具名披露（`readings/side-effects.json`）

- **合成 chat_id / tg_user_id：`990001401`（AC-2 合法码）、`990001402`（冷却闸）、`990001403`（AC-3 往返）**，全部经 `POST /api/telegram/webhook`（带 secret 头）签发。
- `telegram_bind_request` **新增 3 行**（`req_id` 逐条见读数；表总行数 **20**，`max(req_id)=20`），逐行含 `code` 掩码 / `digit_count=8` / `exp−iat=600s` / `consumed_at` 终态。
- 账号 **971214** 终态：`tg_user_id = null`、`tg_linked_at = null`（AC-3 末次 unbind 后现取）。
- 库访问：**只有 `SELECT`**（`@neondatabase/serverless` 标签模板）；一切写走产品 HTTP；无 DDL。
- 合成行在 `readings/ac1-outbound-text.json → synthetic_fixture`（合成标题 `Probe-List` / 合成长标题 / 合成 `conversation_id=900001`）：通知真链的**对端行**由探针 stub 提供（非真实会话），站点名走真库读。

## 环境性 FAIL（原样保留 + 归因）

| 项 | 读数 | 归因 |
|---|---|---|
| 真发 Telegram（哑 token `getMe`） | `404 {"ok":false,"error_code":404,"description":"Not Found"}` | **环境**（`backend-ts/.env.local` 哑配置）⇒ **不判负**；AC-1 真链取证以 fetch stub 捕获出站 payload 达成 |

## 未读到 / `NOT_MEASURED`

见 `readings/not-measured.json`（7 条，逐条归因）；本轮**无空读数**（四个 AC 读数件均有内容）。
