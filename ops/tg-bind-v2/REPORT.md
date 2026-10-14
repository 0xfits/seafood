# tg-bind-v2 独立质检报告（Neng / 独立验收）

- 仓：/Users/kevin/bistro/seafood · 派单 HEAD=b7733de（被检：后端 6714401 / 前端 b7733de）
- ⚠️ HEAD 漂移登记：验收进行中 HEAD 被并行方推进至 936fc81（纯 docs 规范登记提交，非本单所为；被检代码提交未变，dev 栈未重启不受影响）
- 环境：dev backend :5788（/api/health schema=0048）、dev frontend :5787（同仓 vite 热更）
- 哑配置态：TELEGRAM_BOT_TOKEN=dev-dummy-token-not-real ⇒ webhook 已配置（secret 校验生效）但 bot 真发消息必失败 ⇒ **环境性，记录不判负**；TELEGRAM_WEBHOOK_SECRET/TELEGRAM_BOT_USERNAME 取自 backend-ts/.env.local（不落对话）
- 读库：仅只读 SELECT（@neondatabase/serverless HTTP；零 INSERT/UPDATE/DELETE/DDL）
- 纪律：不修码 / 不碰 docs/** / 不 commit / 不 push ✅（工作树仅新增未跟踪 ops/tg-bind-v2/）

## 结果总表：7/7 PASS

| AC | 内容 | 判定 | 读数文件 |
|----|------|------|----------|
| AC-1 | webhook 短码签发 + 冷却闸 + 401×2 | **PASS** (9/9 checks) | readings/ac1-webhook.json |
| AC-2 | confirm 往返 + 重放 CONSUMED + 错码 404 + 解绑零残留 | **PASS** (part1 9/9 + finish 8/8) | readings/ac2-confirm.json |
| AC-2b | EXPIRED 分支补测（自然过期 600s） | **PASS** | readings/ac2b-expired.json |
| AC-3 | 抢绑闸 TG_TARGET_ACCOUNT_TAKEN | **PASS** (5/5 checks) | readings/ac3-takeover.json |
| AC-4 | 扫码面板浏览器闭环（CDP 真实输入） | **PASS** (8/8 checks) | readings/ac4-panel.json |
| AC-5 | 门套复跑（fe build / vitest 54 files·519 tests / be build） | **PASS** | readings/ac5-gates.json |
| AC-6 | 四语 8 键渲染为译文、无裸键名 | **PASS** (4 locales all_pass) | readings/ac6-i18n.json |
| AC-7 | 归因冒烟（订单钮 / 侧栏 / 收藏 toggle） | **PASS** (5/5 checks) | readings/ac7-smoke.json |

## 关键读数（实测值）

- **AC-1**：无 secret / 错 secret ⇒ 401 TG_WEBHOOK_UNAUTHORIZED；正确 secret + `/start`（合成 tg_user_id=990001234）⇒ 200 {}，telegram_bind_request 落行：code 8 位、exp−iat=600s、consumed_at 空；60 秒内同 id 再发 ⇒ 恒 200 但**不落第二行**（行数 1→2 后冷却重发仍 2）；响应无 tg_user_id。
- **AC-2**（uid 971214，challenge→EIP-191 签名→verify，载荷嵌 data）：confirm ⇒ 200 {tg_linked:true, tg_linked_at}（响应无 tg_user_id）；bind/status ⇒ tg_linked=true 且全响应体无 `tg_user_id` 字样（仅 tg_linked/tg_linked_at 两键）；重放同码 ⇒ **400 TG_CODE_INVALID reason=CONSUMED**；随机错码（形状合法）⇒ **404 LEDGER_REF_NOT_FOUND / code_not_found**（sendRefNotFound 不泄差异）；解绑 ⇒ 200 {tg_linked:false} ⇒ status false ⇒ **users.tg_user_id 回 null（只读验）**。
- **AC-2b EXPIRED**：签发行自然越过 600s（req_id 1，exp 07:09:16Z）后 confirm ⇒ **400 TG_CODE_INVALID reason=EXPIRED**，行保持未消费（不可再消费，见已知代价）；零改库、零等待作弊。
- **AC-3**：产品注册路径新建第二钱包账户（uid **971215**）⇒ 同一合成 tg_user_id 新短码 ⇒ confirm ⇒ **409 TG_TARGET_ACCOUNT_TAKEN**（i18n_key tg.err.TG_TARGET_ACCOUNT_TAKEN）⇒ 第二账户 status tg_linked=false、users.tg_user_id=null；该 409 不消费短码 ⇒ 已由 971214 走产品路径重绑(200)+解绑(200)收口。
- **AC-4**（/usr/bin/python3 + CDP 真实输入事件，无 JS click，waitForSelector 稳定态）：/profile/settings 未绑态 → 真实点击 `tg-bind-action` → `tg-bind-qr` 面板在场：**QR 为真 SVG**（namespaceURI=svg，148×148）、`tg-bind-open` href **逐字** = `https://t.me/seafood_dev_bot`、短码输入框（placeholder 在场）+ 确认钮在场；旧长码路径在 `<details>` 折叠内（summary「你的绑定码」，tg-bind-code/steps/action 三钩子齐）→ Input.insertText 真实输入新短码（A7****L2）→ 真实点击 `tg-bind-confirm` ⇒ data-sf-tg-state=**bound**（notice「绑定成功」）→ UI 两段式解绑 ⇒ 回 **unbound**。截图 3 张。
- **AC-5**：fe build exit 0（built in 1.68s）；vitest **54 files / 519 tests 全过**（≥54/≥519 门槛正好达标）；be build exit 0（tsc）。p7b 门不归本单，未跑。
- **AC-6**：/en|/hk|/vn + 默认 zh 四路 /profile/settings：qrOpen/qrHint/codeInputPlaceholder/confirmBind 渲染文本与 locales JSON **逐字相等**、无裸键名；错码触发 notice 渲染 = 各语 codeNotFound 译文（zh「短码不存在，请确认后重试」/ en「Code not found. …」/ hk / vn）。8 键（含 codeExpired/codeConsumed/accountTaken）四语 JSON 全在场为真译文。截图 4 张。
- **AC-7**：首页 `header-orders` 订单钮在场可点（hitInside）；/profile 侧栏 `profile-nav`（trades/settings 分组）在场；/item/1 收藏 toggle `fav-toggle` 真实点击 data-sf-fav 0→1→0（toggled+restored）。零回归读数。

## 夹具披露

- 合成 tg_user_id：**990001234**（唯一使用；未用 990001235 一族，全链 5 行短码均属它）。
- 测试账户：sf14qa 质检账户 **uid 971214**（私钥 ~/.config/seafood/sf14qa-test-account.env 0600）；第二账户 = 验收期随机新钱包 **uid 971215**（私钥 scratch/tgqa/account2.env 0600）。两账户最终均未绑定（tg_user_id=null）。
- uid 971214 经历 2 轮完整绑+解绑（confirm API 一轮、浏览器面板一轮；另含 code2 收口重绑）均走产品 HTTP 路径。
- 收藏 toggle 在 /item/1 上开+关（已复原，产品路径）。
- EXPIRED 分支：用 req_id 1 的**自然过期**行实测，非 NOT_MEASURED，无改库。

## 已知代价（登记，不判负）

1. telegram_bind_request 留存 5 行（req_id 1–5，均属 990001234）：4 行已 consumed + 1 行自然过期未消费（EXPIRED 探针证据，exp<now 不可再消费）。表本身是请求审计面 ⇒ 全部行「无存活未消费」。
2. 哑 token ⇒ webhook 内 bot 回复发送失败（`sendTelegramReply` 后台化，不影响 200 响应与签发）＝环境性，原样保留。
3. confirm 每分钟 10 次占位限速未压测（AC 未要求；触发面仅记录存在于路由 3392）。
4. 冷却闸 60s 语义 = 「不落第二行」（webhook 恒 200，bot 侧回复频繁提示）——已按此实测。

## 复现命令

```bash
# AC-1/2/3/2b：node 脚本链（脚本内含 webhook POST + 只读 SELECT + EIP-191 登录，私钥只读不入输出）
node /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/chain1.mjs   # AC-1
node /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/chain2.mjs   # AC-2 part1
node /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/chain3.mjs   # AC-3
node /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/chain4.mjs   # AC-2 finish（解绑+users null+行快照）
node /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/chain5.mjs   # AC-2b EXPIRED（需等行自然过期）
# AC-4/AC-7：/usr/bin/python3 + CDP（真实输入事件、稳定态等待）
/usr/bin/python3 /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/probe-ac4.py
/usr/bin/python3 /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/probe-ac7b.py
# AC-6：四语面板 + 错码错误渲染
/usr/bin/python3 /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/probe-ac6.py
# AC-5：
cd frontend && npm run build && npx vitest run src/test/unit --reporter=basic && cd ../backend-ts && npm run build
# 只读库探针：
node /Users/kevin/.hermes/profiles/zang/cache/scratch/tgqa/tgdb.mjs "SELECT req_id, code, tg_user_id, iat, exp, consumed_at FROM telegram_bind_request WHERE tg_user_id=990001234 ORDER BY iat"
```

## 产物清单

- readings/：ac1-webhook.json · ac2-confirm.json · ac2b-expired.json · ac3-takeover.json · ac4-panel.json · ac5-gates.json · ac6-i18n.json · ac7-smoke.json（8 件）
- shots/：ac4-panel.png · ac4-bound.png · ac4-unbound.png · ac6-zh-panel.png · ac6-en-panel.png · ac6-hk-panel.png · ac6-vn-panel.png（**7 张**）
- gates/：fe-build.log · vitest.log · be-build.log
