# 窄质检报告 · tg-bind-v2 短码 = 纯数字 8 位（Kevin 2026-10-14 二次裁定）

- 仓：`/Users/kevin/bistro/seafood` · 角色 = **Neng（窄质检）**：不修码、不碰 `docs/**`、不 commit、**不 push** ✅（工作树仅多出未跟踪目录 `ops/tg-bind-v2-num8/`；`git status --porcelain -- docs/` = 0 行）
- 被检变更集：后端 `625571e`（`SHORT_BIND_CODE_ALPHABET='0123456789'` / `SHORT_BIND_CODE_LENGTH=8` / 形状闸 `^[0-9]{8}$` / `crypto.randomInt(0,10)` 消偏置）、前端 `a8ba21e`（四语文案 + 示例码 12345678 + `inputMode="numeric"`）、规范 `0ae5968`（**非本单读面**，仅登记存在）
- 开工 HEAD = 收口 HEAD = **`625571e`**（验收期间无漂移；未被并行方代推，`origin/main..HEAD` 无新增）
- 环境：dev 后端 `localhost:5788`（`/api/health` schema=**0048**）；前端 vite `localhost:5787`（同工作区热更）；哑 env 三行在 `backend-ts/.env.local` ⇒ webhook = 已配置态
- 夹具：uid **971214**（私钥 `~/.config/seafood/sf14qa-test-account.env` 0600，只读进进程，**未打印**；challenge→EIP-191 签名→verify ⇒ verify 200、token_len=193、uID=971214）
- 库读授权（窄）：仅 `SELECT`（`@neondatabase/serverless` 标签模板）；**一切写走产品 HTTP**（webhook / confirm / unbind）

## 结论速览：6/6 PASS（+1 项承重补测 PASS）

| AC | 项 | 判定 | 读数文件 |
|---|---|---|---|
| AC-1 | 码形态 = `^[0-9]{8}$` + `exp−iat=600s` + `consumed_at` 空（12 个合成 id） | **PASS**（9/9 checks） | `readings/ac1-code-shape.json` |
| AC-2 | 形状闸：7/9 位、含字母、含空格 ⇒ 400；含 0/1 真码不落 400 | **PASS**（11/11 checks，第 2 轮重取） | `readings/ac2-shape-gate.json` |
| AC-2c | **承重补测**：以 `0` 开头的合法 8 位码（前导零）往返 | **PASS**（6/6 checks） | `readings/ac2c-leading-zero.json` |
| AC-3 | confirm → status(true/无 tg_user_id) → unbind → status(false) → 库回 null | **PASS**（11/11 checks） | `readings/ac3-roundtrip.json` |
| AC-4 | 前端 `inputmode=numeric` + 四语文案逐字 + QR 面板（CDP 真点击） | **PASS**（zh/en/hk/vn 各 11/11 checks） | `readings/ac4-frontend.json` |
| AC-5 | 60s 冷却闸未回归（同 id 二次 `/start` 恒 200 且不落第二行） | **PASS**（3/3 checks） | `readings/ac5-cooldown.json` |
| AC-6 | 门套（fe build / vitest / be build / 离线单测 / 产物串） | **PASS**（10/10 checks） | `readings/ac6-gates.json` |
| — | 副作用与终态披露 | 零残留（uid 971214 `tg_user_id=null`） | `readings/side-effects.json` |

## AC-1 码形态（12 个合成 id，全部经 webhook 签发）

- 合成 id = **990001300–990001311**（12 个）⇒ `POST /api/telegram/webhook`（header `x-telegram-bot-api-secret-token`，body `text=/start` + `from.id`）**12/12 返回 200 `{}`**。
- 只读 `telegram_bind_request`：每 id **恰 1 行**（req_id 6–17），逐码核：
  - `^[0-9]{8}$` **12/12 true**；长度 **12/12 = 8**；**含字母 0/12**（旧 32 字符集实现不可能出现此读数）；
  - `exp − iat = 600s` **12/12**；`consumed_at` 签发时 **12/12 = null**。
- **含 0 或 1 的码 = 7/12**（掩码样例：`29****57` / `56****51` / `96****35` / `71****48` / `81****50` / `60****93` / `00****97`）——含 `0` 与含 `1` 均已取到，其中 `00****97` 为**前导零**码。
- 表基线 5 行 → 本轮后 17 行 ⇒ **新增 12 行，无重复签发、无越额**。

## AC-2 形状闸（400 分支逐形取证）

| 入参 | HTTP | error.code | details.reason | i18n_key |
|---|---|---|---|---|
| `1234567`（7 位） | 400 | TG_CODE_INVALID | NOT_FOUND | tg.err.TG_CODE_INVALID |
| `123456789`（9 位） | 400 | TG_CODE_INVALID | NOT_FOUND | tg.err.TG_CODE_INVALID |
| `AB123456`（含字母） | 400 | TG_CODE_INVALID | NOT_FOUND | tg.err.TG_CODE_INVALID |
| `1234 5678`（含空格） | 400 | TG_CODE_INVALID | NOT_FOUND | tg.err.TG_CODE_INVALID |

- 4/4 落**形状分支**（`400 + TG_CODE_INVALID`；`reason ≠ RATE_LIMITED` ⇒ 不是限速分支）；且 **4/4 ≠ 404** ⇒ 与「查无码」的 `sendRefNotFound`（404 `LEDGER_REF_NOT_FOUND` / `code_not_found`）**不同分支**，闸真的在查库之前拦下了。
- **含 0/1 的真码（AC-1 取得的 `29****57`）⇒ 200 `tg_linked:true`** —— 不落 400，证明 `0`/`1` 已合法（旧口径会先把它们当非法字符剔除）。
- **AC-2c 补测**：前导零码 `00****97` ⇒ confirm **200 `tg_linked:true`**（前导零没有被数字强转吃掉）⇒ status true 且响应无 `tg_user_id` ⇒ unbind 200 false ⇒ 库 `users.tg_user_id` 回 `null`、行 `consumed_at` 已置。6/6 checks PASS。

## AC-3 往返（uid 971214）

`confirm(56****51)` ⇒ **200 `{tg_linked:true, tg_linked_at}`**（响应体内**无** `tg_user_id`）⇒ `GET bind/status` ⇒ **200 `tg_linked=true`（含 `tg_linked_at`）且全响应无 `tg_user_id` 字样** ⇒ 只读库 `users.tg_user_id = '990001304'` ⇒ `POST unbind` ⇒ **200 `{tg_linked:false}`** ⇒ `status` ⇒ **false / `tg_linked_at:null`** ⇒ 只读库 `users.tg_user_id = null`、`tg_linked_at = null`；消费行 `consumed_at` 已置。11/11 checks PASS。

## AC-4 前端（/usr/bin/python3 + CDP，真实鼠标事件、selector 轮询等待、**无固定 ms 等待**）

- 登录态由 localStorage 注入（`user.token` / `token`）；每语导航 `/profile/settings`（zh 无前缀 / en / hk / vn），等 `[data-sf-m="tg-bind-card"]` 且 state 脱离 `loading` ⇒ 真点 `[data-sf-m="tg-bind-action"]`（先 `scrollIntoView`、dispatch 前现取 rect）⇒ 等 `[data-sf-m="tg-bind-qr"]` 出现（等待耗时 0.43–0.65s）。

| 语 | `inputmode` 属性 | `inputMode` IDL | placeholder（= locales 逐字） | qrHint（= locales 逐字） |
|---|---|---|---|---|
| zh | `numeric` | `numeric` | 输入 bot 给你的短码，如 **12345678** | …把 bot 回复给你的 **8 位纯数字短码**填在下面 |
| en | `numeric` | `numeric` | Enter the code from the bot, e.g. **12345678** | …enter the **8-digit numeric code** the bot replies with below |
| hk | `numeric` | `numeric` | 輸入 bot 給你的短碼，如 **12345678** | …把 bot 回覆給你的 **8 位純數字短碼**填在下面 |
| vn | `numeric` | `numeric` | Nhập mã từ bot, ví dụ **12345678** | …nhập mã **8 chữ số** bot trả lời vào ô bên dưới |

- 每语 11/11：面板在场、QR 为真 `svg`（ns=`http://www.w3.org/2000/svg`）、placeholder 与 locales **逐字相等**、qrHint 与 locales **逐字相等**、示例码 = `12345678`、旧示例 `AB12CD` 已不在、无 `6-8` 旧口径残留、`tg-bind-open` href = `https://t.me/<bot>`（**无 `?start=` 载荷**）、旧长码路径 `<details>` 仍在（次入口未丢）。
- 截图 4 张：`shots/ac4-<lang>-panel.png`。
- 探针自身修正留痕：首轮「点击不生效」= 探针缺陷（页面异步内容位移导致点击坐标过期），**已加 `scrollIntoView` + 点击后 selector 复核 + 最多 3 次重试**，非产品缺陷（同轮 zh 复现同样症状，而 diag 加滚动后即通过）。

## AC-5 冷却闸未回归

同 id（990001300）在首签后**立即**再发 `/start` ⇒ **恒 200 `{}`**，`telegram_bind_request` 行数 **1 → 1**（req_id 恒为 6、iat 未变）⇒ 「不落第二行」语义保持。3/3 checks PASS。

## AC-6 门套（逐条捕获退出码，日志落 `gates/`）

| 门 | 命令 | 退出码 | 读数 |
|---|---|---|---|
| 前端 build | `cd frontend && npm run build` | **0** | `✓ built in 1.80s`（index-BT1oA0ZX.js 444.31 kB） |
| 前端单测 | `cd frontend && npx vitest run src/test/unit --reporter=basic` | **0** | **54 files / 519 tests passed / 0 failed**（≥54、≥519 门槛达标，零减少） |
| 后端 build | `cd backend-ts && npm run build` | **0** | `> tsc` |
| 离线单测 | `cd backend-ts && npx ts-node --transpile-only scripts/test-tg-bind-v2-offline.ts` | **0** | **10 组全 PASS**（`ALL PASS (10 groups)`） |
| 产物自证 | `frontend/dist/assets/index-*.js` | — | 含 `8-digit numeric code` / `12345678`；**不含** `AB12CD` |

## 环境性 FAIL（原样保留 + 归因，未手改 PASS）

1. **AC-2 第 1 轮第 1 发（7 位）返回 503** `LEDGER_TX_TIMEOUT` / `details.reason=driver_connection_error`（i18n_key `ledger.err.LEDGER_TX_TIMEOUT`）⇒ 发生在 `requireActor` 阶段，**Neon 冷连接**，根本没触到形状闸。原读数**保留**在 `ac2-shape-gate.json` 的 `invalid_inputs_attempt1` + `attempt1_infra_failures`，第 2 轮重取（`invalid_inputs_attempt2_at`）后 4/4 = 400 形状分支。属环境性，不判负。
2. **哑 token ⇒ bot 真回复必失败**（`TELEGRAM_BOT_TOKEN=dev-dummy-token-not-real`；`sendTelegramReply` 后台化，webhook 仍恒 200、签发正常）——环境性，记录不判负。
3. 另一并行会话占用 `127.0.0.1:9222`（其 Chrome）；本探针改用 **9333** + `--remote-allow-origins=*` 独立实例，**未触碰他人浏览器**，收工已按 PID 关闭。

## 副作用与披露（表 = 审计面；行保留 = 已知代价，禁改库）

- 合成 Telegram id：**990001300–990001311**（12 个，全部经 webhook 产品路径签发，**未用任何 SQL 造行**）。
- 新增 `public.telegram_bind_request` 行：**req_id 6–17（12 行）**，其中 **3 行已 `consumed_at`**（AC-2 验收 `29****57`、AC-3 `56****51`、AC-2c `00****97`）、**9 行未消费**（将在 `exp = iat+600s` 自然过期；表基线 5 行 → 17 行）。
- `users` 侧：uid 971214 在每轮绑/解后**已复原 `tg_user_id = null` / `tg_linked_at = null`**（3 轮绑 + 3 轮解，全部走产品 HTTP）；全库 `tg_user_id IS NOT NULL` 的账号 = 空（无遗留抢绑）。
- 前端 4 次 `bind/start`（每语一次）走 **v1 长码**路径（无状态、**不落库**）⇒ 零行、零残留。
- 全程零 `INSERT/UPDATE/DELETE/DDL`；未改任何文件、未 commit、未 push。

## 观察（非缺陷，不在本单修）

1. **`backend-ts/migrations/0048_telegram_bind_request.sql` 的 `COMMENT` 冻结文本仍写**「8 位短码（大写字母 + 数字、剔除易混 0/O/1/I）」与列注释口径 —— 该文件 checksum 已被 `migrate.ts` 冻结（改动即 `ABORT` 退 3），因此**只能由 docs 侧勘误承接**，不能也不应在迁移里原位改。登记备查，不判负。
2. **形状 400 与「查无」404 的取数易混**：形状分支的 `details.reason` 也写作 `NOT_FOUND`（与「查无」语义重名），二者靠 `HTTP status` + `i18n_key`（`400 tg.err.TG_CODE_INVALID` vs `404 ledger.err.LEDGER_REF_NOT_FOUND`）区分 ⇒ 后续质检判据必须按组合读，只读 reason 会误判。
3. `confirm` 限速为**单进程内存滑窗**（10 次/分/账号，占位值）；本轮未压测（AC 未要求），仅登记触发点存在（`src/index.ts:3392`）。
4. 前端输入框保留 `autoCapitalize="characters"`（对纯数字恒等、无害）；`trim()` 归一仍在提交前执行。

## 复现命令

```bash
# AC-1 / AC-5（webhook 签发 + 只读取码 + 冷却复核）
node ops/tg-bind-v2-num8/probes/be-probe.mjs phase1
# AC-2 / AC-3（形状闸 + 往返；phase2b 为 AC-2 形状闸重取）
node ops/tg-bind-v2-num8/probes/be-probe.mjs phase2 phase3
node ops/tg-bind-v2-num8/probes/be-probe.mjs phase2b
# AC-2c（前导零承重补测）
node ops/tg-bind-v2-num8/probes/ac2c-leading-zero.mjs
# AC-6（门套，逐条退出码落 gates/exitcodes.txt）
bash ops/tg-bind-v2-num8/probes/run-gates.sh && /usr/bin/python3 ops/tg-bind-v2-num8/probes/gates-summary.py
# 副作用/终态（只读）
node ops/tg-bind-v2-num8/probes/final-state.mjs
# AC-4（先起独立 Chrome：--headless=new --remote-debugging-port=9333 --remote-allow-origins='*'）
node /Users/kevin/.hermes/profiles/zang/cache/scratch/num8-login.mjs   # 取 token 落 scratch（不打印）
/usr/bin/python3 /Users/kevin/.hermes/profiles/zang/cache/scratch/num8-ac4.py 9333
```

## 交付边界

- 只读库 + 产品 HTTP 写；零 `docs/**` 触碰；零 commit / 零 push；HEAD 全程 `625571e`。
- 读数 JSON 7 件（AC-1/2/2c/3/4/5/6）+ `side-effects.json` + 门套日志 4 件 + 截图 4 张，全部落 `ops/tg-bind-v2-num8/`（`ops/` 不被 gitignore、已被 `.vercelignore` 覆盖）。
