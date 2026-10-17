# P9 · 无状态滑动续期（sliding session + absolute cap）· 实现与验收

- 单据：auth 生命周期 P9（Kevin 2026-10-17 裁定「变体 1」）
- 范围：`backend-ts/src/auth.ts`、`backend-ts/src/index.ts`、新增 `backend-ts/scripts/p9-auth-renewal-gate.ts`、本目录
- **未动** `frontend/**`（另一代理在改）、**未 commit / 未 push**、**零迁移 / 零新表 / 零库写 / 零新路由**

## 0. 一句话结论

token 增 `iat`（本次签发）+ `sst`（会话起点），`exp = min(iat+3d, sst+7d)`；鉴权成功且 `now >= iat+1h`
时把新 token 挂响应头 `X-Session-Token`（`sst` 原样回传 ⇒ 7 天上限不被续期推后）；闲置 3 天由 `exp` 承载、
绝对 7 天由 `sst` 承载，**零新路由、零库写**。离线门 35/35、真实 HTTP 往返 13/13、`tsc --noEmit` exit 0、
`p7b-03` 37/37（注册点常量 **107 未动**）。

## 1. 实现清单（改完的现盘行号）

### `backend-ts/src/auth.ts`

| 位置 | 内容 |
|---|---|
| `:36-62` | 常量：`AUTH_SESSION_IDLE_MINUTES` 缺省 **4320**、`AUTH_SESSION_ABSOLUTE_MINUTES` 缺省 **10080**（写法与既有 `ACCESS_TOKEN_EXPIRE_MINUTES` 同风格）；`SESSION_RENEW_GRANULARITY_SECONDS = 3600`；导出只读 `SESSION_IDLE_SECONDS` / `SESSION_ABSOLUTE_SECONDS` / `SESSION_POLICY`（供门脚本复算，**不参与任何判定分支**）。**`ACCESS_TOKEN_EXPIRE_MINUTES` 保留**（旧 token 的 `iat` 反推只认它） |
| `:48-53` | 新增告警：`IDLE` 或 `ABSOLUTE` ≤ 续期粒度时 `console.warn('sliding renewal unreachable')`（不拦启动；见 §6 脚枪） |
| `:78-100` | `SessionTokenInput`（`sessionStartedAt?`）/ `SessionTokenPayload`（`+ iat` / `+ sessionStartedAt`）拆成输入/输出两型 |
| `:272-291` | `createSessionToken({uID, evm, sessionStartedAt?})`：签 `{sub, evm, iat, sst, exp}`，`sst = sessionStartedAt ?? now`（**上钳到 now**，未来值不得把绝对上限后推），`exp = min(iat+IDLE, sst+ABSOLUTE)` |
| `:296-307` | `shouldRenewSession({issuedAt, sessionStartedAt, now})`：纯函数，`now >= iat+3600 && now < sst+ABSOLUTE*60`；坏输入 ⇒ `false`（fail-closed） |
| `:309-340` | `verifySessionToken` 返回 `+ iat / + sessionStartedAt`；旧 token 无 `iat` ⇒ `iat = exp - ACCESS_TOKEN_EXPIRE_MINUTES*60`、无 `sst` ⇒ `sst = iat`；**验签 / 过期 / uID 校验逐字未改** |

### `backend-ts/src/index.ts`

| 位置 | 内容 |
|---|---|
| `:130` | `app.use(cors({ exposedHeaders: ['X-Session-Token'] }))` |
| `:235-239` | `ActorContext.session` 增 `iat` / `sessionStartedAt`（`:297` 的 `let session` 同步改用该类型） |
| `:353-364` | 新增 `maybeIssueRenewedSession(res, session)`：判据 + 签发 + `Cache-Control: private, no-store`（**单一签发源**） |
| `:367-380` | `requireActor` 成功出口调用它（**52 处 `requireActor` 调用点共用**） |
| `:921-926` | `/api/home` 的直连 `resolveActor` 面同口径调用（理由见 §4） |

## 2. 验收逐条读数

| 项 | 判据 | 结果 | 证据 |
|---|---|---|---|
| **A** | `cd backend-ts && npx tsc --noEmit` | **PASS** · exit 0，日志 0 行（判定靠落盘日志 + 退出码，不用 zsh 的 `${PIPESTATUS[0]}`） | `logs/tsc-noemit.log` |
| **B** | 离线零 DB 门 ≥10 条断言 | **PASS** · **35/35**，`verdict=PASS`，exit 0 | `readings/p9-gate.json`、`logs/p9-gate.log` |
| **B 自证** | 尺子有分辨力（变异测试，两向） | M1「续期不保留 `sst`」⇒ **6 条红**（G3-2/G3-4/G4-1/G4-3/G6-2/G9-3）；M2「粒度 3600→1800」⇒ **4 条红**（G1-1/G3-4/G8-1/G10-2）；源码复原后 `sha256 = 2b4b1c0f…f64cbf` 与变异前逐字相同，门复跑 35/35 | `readings/mutation-M1-sst-reset.log`、`readings/mutation-M2-granularity.log` |
| **C** | 真实 HTTP 往返（dev 5788） | **PASS** · **13/13**，`verdict=PASS` | `readings/http-roundtrip.json`、`logs/http-roundtrip.log` |
| **C 基线** | 改前形态「无续期」 | **PASS**（`BASELINE_CONFIRMED_NO_RENEWAL`）：改前手签 `{sub,evm,exp}` 打 `GET /api/user` ⇒ 200 且**无** `X-Session-Token` | `readings/baseline-pre-change.json` |
| **D** | 证据落盘 | `ops/auth-renewal-20261017/`（REPORT + probe + readings + logs）；未 commit | 本文件 |
| 附 | 既有离线门未被顶红 | `p7b-03` **37/37 · 0 failed · red=[]**，`AC10-2 regs===107` 绿 | `logs/p7b-03-offline-gates.log` |

### B 的断言覆盖（对应派单 ①–⑩）

① `G1-2/1-3/1-4`（`iat`/`sst` 存在、`exp=min(iat+3d,sst+7d)`）；② `G2-2`（3 天整点 `Token expired`，`G2-1` 为 −1s 仍有效）；
③ `G3-1/3-2/3-3`（1h ⇒ `true`，新 `sst` 与旧相同、`iat=now`）；④ `G4-1/4-2/4-3`（`sst=6.99d` ⇒ 新 `exp=sst+7d`，余量 864s < 3d）；
⑤ `G5-1/5-2`（`sst+7d` 整点及之后 ⇒ `false`）；⑥ `G6-1`（旧 token 验签通过 + `sst` 回落 `iat`）+ `G6-2`（TTL=120min 的旧 token 可续期）；
⑦ `G7-1/7-2`（改签名 / 改载荷复用旧签名 ⇒ `Invalid token signature`）；⑧ `G8-1/8-2`（30min、59m59s ⇒ `false`；整 1h、1h1s ⇒ `true`）；
⑨ `G9-1/9-2/9-3`（`IDLE=5min`/`ABSOLUTE=10min` ⇒ 300s/600s，`exp` 随之改变）；⑩ `G10-1/10-2/10-3`（**反向臂**，见 §6-2）。
另加 `G3-4`（100 次连续小时级续期后 `sst` 恒定、`exp` 不越过 `sst+7d`）、`G11-*`（零新路由/零库面/接线）、`G12-1/12-2`（未来 `sst` 上钳、坏输入 fail-closed）。

### C 的 13 条（真实往返，dev 库只读：`neon.project_id=quiet-math-65207667`、`uid=1`）

`H1` token 形态 · `H2` 2h 前 token ⇒ 200 + 响应头（三段 JWT）· `H3` 新 token `sst` 不变、`iat≈now`、`exp=min(iat+259200, sst+604800)`
· `H4` 刚签发（iat=now）⇒ **不回头** · `H5` 续期 token 立即可用且 1h 内不重复下发 · `H6` `/api/home` 同口径 · `H7` 匿名 `/api/home` 无头
· `H8` 闲置 3 天 ⇒ 401 `AUTH_UNAUTHORIZED` · `H9` 篡改 ⇒ 401 `AUTH_UNAUTHORIZED`（**零新错误码**）
· `H10` `Access-Control-Expose-Headers: X-Session-Token`（预检 204，`cors` 库同样在预检回该头）· `H11` 绝对上限端到端夹紧（余 100s）
· `H12` 带新 token 的响应 `Cache-Control: private, no-store` · `H13` 匿名公共口（`/api/task/all`）带 token 也**不**续期、缓存仍 `public`

## 3. 断言 / 常量影响

- **`p7b-03` 注册点常量未动，且不得动**：`grep -cE '^app\.(get|post|put|delete|patch)\(' = 107`（get 47 / post 56 / put 0 / delete 3 / patch 1），
  续期走响应头 ⇒ 零新路由。`p7b-03` 复跑 37/37 绿（该脚本里的 `regs === 107` 与 `AC10-2` 均未改一字）。
- **`ACCESS_TOKEN_EXPIRE_MINUTES`（30）保留但语义降级**：新 token 的 TTL 由 IDLE/ABSOLUTE 决定，该 env **只**用于旧 token 的 `iat` 反推。
  ⇒ 生产上单独调它**不再延长登录时长**（要调就调 `AUTH_SESSION_IDLE_MINUTES`）。这一点若有人调 TTL 排障，会被"调了没变"误导，已在代码注释写明。
- **零新增错误码 / 零新响应键**：401 仍 `AUTH_UNAUTHORIZED`、403 仍 `AUTH_FORBIDDEN`；成功载荷一字未增（新 token 只在头里）。
- **对既有门脚本无顶红**：`scripts/p4z-sec-01-verify.ts` 等用 `createSessionToken({uID, evm})` 的探针，因 `sessionStartedAt?` 是可选参数、
  其本地类型字面量 `(p: {uID, evm}) => string` 仍可赋值 ⇒ 零改动可用。注意 `tsconfig.json` 的 `include` 只有 `src/**` ⇒
  **`scripts/**` 不在 `tsc --noEmit` 覆盖内**（`p9` 门与探针靠 `ts-node --transpile-only` 实跑做证据，不靠类型检查）。
- 本轮**未新增**任何前端断言（未动 `frontend/**`）；`X-Session-Token` 的消费端由前端代理接。

## 4. 派单要求我核实的三个问题（结论 + 依据）

### 4.1 `requireActor` 是不是全部鉴权路由的唯一入口？`resolveActor` 的另一处（原 `:885`）怎么办？

- `requireActor` 调用点 **52 处**（`grep -c 'await requireActor(' = 52`），`resolveActor` 直连点 **2 处**：`requireActor` 内部（现 `:369`）与 **`GET /api/home`（现 `:919`）**。
- **需要同口径处置，已改**：`/api/home` 是**公开只读面**——带 token 时它验签并加载 actor（`is_authenticated=true`），失败则降级匿名、绝不打 401。
  按裁定「活性 = 任一带 token 的鉴权请求验签通过且用户存在」，它就是活性；且**前台首页确实打这个口** ⇒ 不续期的话，
  「只在首页刷新的用户」会因 3 天闲置被踢。安全面零风险：该分支随后恒走 `setPrivateNoStore` + `Vary: Authorization`（匿名分支才 `setPublicCache`），
  实测 `H6`（带头）/`H7`（匿名无头）双向成立。
- 唯一**不**需要处置的是 401/403 分支：`sendAuthError` 之后直接 return，续期头不会被挂到错误响应上（`H8`/`H9` 读数为 `renewed=absent`）。

### 4.2 `app.use(cors())` 要不要 `exposedHeaders`？

- **实测**：同源生产 / 本地 vite 代理 `/api` 都**不需要** expose（浏览器默认可读同源头）；但 `cors()` 无配置时，
  跨源响应**不会**带 `Access-Control-Expose-Headers` ⇒ 跨源调用方读不到 `X-Session-Token`（会被 CORS 过滤成 null，静默失效而非报错 —— 属"看起来接了其实没接到"的坑）。
- **结论：加上**（`:130`），零成本、零行为变更：同源路径完全不受影响，跨源路径从「读不到」变「读得到」。实测 `H10`：
  实际响应 `Access-Control-Expose-Headers: X-Session-Token`；`OPTIONS` 预检 204（`cors` 库在预检也回该头）。
- 顺带加固：带新 token 的响应显式 `Cache-Control: private, no-store`（`H12`）——否则共享缓存理论上可能把一个用户的新 token 发给另一个用户；
  匿名公共口不受影响（`H13` 仍 `public, s-maxage=30`）。

### 4.3 零库写 / 零迁移

`auth.ts` 无任何 SQL / `DatabaseService` 引用（门 `G11-3 matches=0`）；`index.ts` 只在既有响应上加头，无库调用；无迁移文件、无表变更。

## 5. 环境性说明（不隐藏）

- 为让 dev 实例吃到新码，用面板重启 `seafood-api`（pid `99378 → 22792 → 25268`），复跑 `/api/health` 200（`schema_version=0049`）。**实例留在运行态**，未 kill。
- 探针只读 dev 库一条 `SELECT uid, evm FROM users ORDER BY uid LIMIT 1`；并打印 `neon.project_id` 自证是 dev（`quiet-math-65207667`），**未触碰生产**。
- 本单**未 commit / 未 push / 未 stage**（避免与并行前端代理争 git index）。收口时注意：
  `ops/auth-renewal-20261017/logs/*.log` 与 `readings/*.log` 被仓根 `.gitignore`（`logs`、`*.log`）命中 ⇒ **必须 `git add -f`**，
  否则 `git status` 连未跟踪都不显示它们（已实测 `git check-ignore -v` 命中 `.gitignore:243`）。

## 6. 对裁定口径的复核（发现 3 处需要你知道的事实，均附读数，未擅自改口径）

### 6.1 ★「旧 token 仍可续期」在**现网默认配置**下只在 30 分钟内成立 —— 过渡期会有一次硬踢

派单 ⑥ 要求「旧形态 token（无 iat/sst）仍验签通过且可续期」。机制上成立（`G6-2`：TTL=120min 的旧 token 在 1h 处 `shouldRenew=true`、`sst` 回落其 `iat`），
但**现盘默认 `ACCESS_TOKEN_EXPIRE_MINUTES=30`**（`.env.local` 未覆盖）⇒ 旧 token 的 `iat = exp-30min`，而续期要求 `now >= iat+1h`，
**这比它自己的 `exp` 还晚 30 分钟** ⇒ 旧 token 在能被续期之前就已过期。
- 影响：部署后**已登录用户最多 30 分钟内会被要求重新登录一次**，之后拿到的是 3 天滑动 / 7 天绝对的新 token。属一次性过渡代价。
- 三条可选处置（**我未自行施加**，需你裁）：
  1. **接受一次性踢**（现实现，零风险、语义最干净）——推荐；
  2. 部署时临时把 `ACCESS_TOKEN_EXPIRE_MINUTES` 提到 ≥60 并重新部署（旧 token 反而能续期）——但它同时让"过期旧 token"活得更久，且改 env 需一次部署；
  3. 对无 `iat` 的 token 用 `iat = now` 兜底（首次活动即续期）——**会**把存量会话的绝对上限从"首次活动"起算，等于给老会话一个新 7 天窗口；
     我没采纳（等于绕过 `sst` 语义，且让"绝对上限"对存量不可审计）。

### 6.2 配置脚枪：`IDLE ≤ 1h` 时续期在结构上永不触发

`G10-3` 读数：`AUTH_SESSION_IDLE_MINUTES=5` ⇒ id `300s` < 粒度 `3600s`，token 在 `iat+299s` 有效、`iat+301s` 已 `Token expired`
⇒ **续期分支不可达**（用户感觉"被硬踢"，而日志里没有任何异常）。已在 `auth.ts:48` 加启动告警（只 warn、不拦启动），
并在报告登记：**`AUTH_SESSION_IDLE_MINUTES` 必须 > 60**（同理 `AUTH_SESSION_ABSOLUTE_MINUTES` > 60）。

### 6.3 安全面复核（未发现漏洞，两处加固已落地）

- 防伪造：`sst`/`iat` 在 HMAC 载荷内 ⇒ 客户端不能自选会话起点把 7 天往后推（`G7-2` 改载荷 ⇒ 签名错）。
- 会话起点只从**已验证** token 取，且 `createSessionToken` 对 `sessionStartedAt` 做**上钳到 now**（`G12-1`：传未来值 ⇒ `sst=now`）。
- 偷 token 的窗口：续期不会让旧 token 提前失效（无状态、无吊销表）⇒ 攻击者持窃得 token 可持续续期，**上界 = `sst+7d`**，且每次都要打到真接口
  ⇒ 与裁定一致（绝对上限就是为这个场景设的）。若要"续期即吊销旧 token"必须引入服务端存储 —— 与"零库写"冲突，属另一单。
- 响应缓存：见 §4.2（`private, no-store`）。
- 不变式：`exp` 永不超过 `sst+ABSOLUTE`（`G3-4` 100 次续期、`G4-3`/`H11` 端到端）。

## 7. 复跑命令（逐条可复核）

```bash
# A 类型检查（exit 0；判定看落盘日志，不用 zsh 的 ${PIPESTATUS[0]}）
cd backend-ts && npx tsc --noEmit > ../ops/auth-renewal-20261017/logs/tsc-noemit.log 2>&1; echo $?

# B 离线零 DB 门（35 条）
cd backend-ts && npx ts-node --transpile-only scripts/p9-auth-renewal-gate.ts

# 既有离线门（注册点常量未动）
cd backend-ts && npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts

# C 真实 HTTP 往返（需 dev 后端 5788；面板重启 seafood-api 让新码生效）
cd backend-ts && env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u POSTGRES_URL -u POSTGRES_URL_NON_POOLING \
  TS_NODE_PROJECT=$PWD/tsconfig.json TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","target":"ES2020","rootDir":"/Users/kevin/bistro/seafood"}' \
  npx ts-node --transpile-only ../ops/auth-renewal-20261017/probe/http-roundtrip.ts
```

## 8. 未做 / 留给收口

- 未 commit / 未 push / 未 stage（Zang 统一收口）；`push = 上线`，本单**不含**生产终验（需另跑：线上 `X-Session-Token` 头 + 前端消费端）。
- 生产 env 未配任何 `AUTH_SESSION_*`（缺省即裁定值 3d/7d；要改才配，配完需重新部署）。
- 前端消费端（读头 + 落盘 + 覆盖旧 token）由前端代理完成，本单只保证后端"下发且可读"。
- 台账回写（`docs/seafood.master-plan.md` §5.x + 版本表）按仓内纪律属收口动作，本单未写。
