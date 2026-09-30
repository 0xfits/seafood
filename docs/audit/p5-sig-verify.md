# P5-SIG-VERIFY — `POST /api/auth/verify` 服务端 EVM 签名验签（EIP-191 `personal_sign`）

> 单号 = **SIG-VERIFY** · 角色 = **Kong（实现方）** · 裁定 = **Zang §5.105** · 日期 = 2026-09-30 CST
> run tag = **b5sv-20260930T231433** · 产物 = `backend-ts/.p4-artifacts/b5sv-20260930T231433/`
> 探针 = `backend-ts/scripts/p4z-b5sv-01-http.ts`（**真 HTTP + 真库**；改前/改后**同脚本同口径**）
> 不变量 = `backend-ts/scripts/p4z-b5sv-02-invariants.ts`（**只读** SELECT）
> 骨架先行落盘、逐段回写。前置 = `docs/audit/p5-fix-login.md`（B5-FIX-LOGIN，**同一端点**上一单）。
> **行号口径**：本文所有 `文件:行号` 均为**改后现盘现取**（`grep -n` / `git diff -U0`），**非**转抄派单或前作。

## §0 结论摘要（一句话）

**`consumeWalletAuthChallenge` 在修前从不看 `signature` 就 `return`**（旧 `src/auth.ts:208-213`）⇒ 任意地址 + 任意垃圾签名即可换到**真 JWT**（完整身份冒充）；现改为对**签发时给出的那份原文消息**做 **EIP-191 `personal_sign` 恢复**并与声明地址**大小写不敏感**比对，不匹配 / 签名非法一律 **`401`**。真 HTTP 实测：垃圾签名 `0xdeadbeef` **改前 `200`（`success:true` + 真 token）→ 改后 `401`**，他人签名 **改前 `200` → 改后 `401`**，真签名仍 **`200`**、大小写变体仍 **`200`**、重放仍 **`401`**；`tsc --noEmit` = 0、**注册点 65 不变**、`migrations/**` 零改、**`Δledger_entry` = 0、`Σ(cid=1)` 不变**、新钱包登录仍 `200`。

## §1 真根因（`文件:行号`，现取）

```
[UI] WalletAuthPanel.jsx
  ↓ POST /api/auth/challenge      src/index.ts:345  app.post('/api/auth/challenge')
  │     └ startWalletAuthChallenge  src/auth.ts:141
  │           · nonce = randomBytes(16)                                     :151
  │           · activeAuthChallenges.set(nonce,{evm,issuedAt,expiresAt})    :158-163
  │           · message = buildWalletSignMessage(...)                       :156（纯函数 :110）
  │           · challenge_token = signToken({typ:'auth_challenge',evm,nonce,iat,expires_at,exp})  :165
  ↓ POST /api/auth/verify         src/index.ts:354  app.post('/api/auth/verify')
        :356 consumeWalletAuthChallenge()                  （auth.ts:182–234 现盘）
              · 解 challenge_token（HMAC 验签）               :195
              · 地址比对（challenge 记录 vs 请求体自述）        :206
              · nonce 单次消费 + 过期检查（读 challenge 记录）   :210-213
              · 【★真根因★】旧 src/auth.ts:208-213（`git diff -U0` 证）:
                    :208      activeAuthChallenges.delete(nonce);
                    :209-210  // Historical parity with the final Python backend:
                              // the deleted implementation temporarily bypassed signature verification.
                    :211-213  return { evm: normalizedAddress };
                    删掉的正是 `:209-210` 那两行旁路注释（`-209,2 +231,0`）
                ⇒ `payload.signature` 被**读取、被 `trim`**，随后**从不参与任何判断**
        :365 createSessionToken({uID, evm})   ⇒ **签发真 JWT**（HS256 + SECRET_KEY）
        :379 catch ⇒ sendError(res, 401, error.message)
```

**为何是「完整身份冒充」而非「仅登录态伪造」**：`verify` 的 `evm` 全程取自 **challenge_token 里的 `evm` 与请求体自述地址**，与 `signature` **无任何绑定** ⇒ 任何人拿**任意**地址（含已被他人占用的地址）走一遍 challenge→verify 即得该地址的会话 token。

**同一观察点的对照（说明本单没顺手砸坏已有防线）**：`challenge_token` 的 HMAC 验签（`:195`）、`nonce` 单次消费（`:210`+`:230`）、`exp` 过期（`verifySignedToken`）、`typ` 校验、地址比对（`:206`）**全部在改前就已生效**（§4 的 AC4/R1/R2/R3 改前即 `401`）。本单只补「内容验签」这一格。

## §2 改前 / 改后（逐条 · 精确 diff）

**唯一代码改动 = `backend-ts/src/auth.ts`（`git diff --numstat` = `24 / 3`）**；`src/index.ts` **未动**、`src/database.ts` **未动**（`git status --porcelain -- src` 仅一行 `M backend-ts/src/auth.ts`）。

**① import（`:2`，+1）**
```ts
 import crypto from 'crypto';
+import { verifyMessage } from 'ethers';
```
**② challenge 记录多存原文（接口 `:48-52`，`+message` 落 `:52`；构造 `:156`/`:158-163`/`:176`）**
```ts
 interface AuthChallengeRecord {
   evm: string;
   issuedAt: number;
   expiresAt: number;
+  message: string;          // SIG-VERIFY：与 challenge 同存「签发时给出的这一份原文」
 }
```
`startWalletAuthChallenge` 由 `activeAuthChallenges.set(nonce,{evm,issuedAt,expiresAt})` 改为先 `const message = buildWalletSignMessage(...)`（`:156`）再 `set(...,{evm,issuedAt,expiresAt,message})`（`:158-163`），返回体的 `message`（`:176`）由**重算**改为**同一变量**（同值；见 §5.2 的「同存 vs 重算」自曝）。

**③ 核心：`consumeWalletAuthChallenge` 加验签（现盘 `:215-230`；`git diff -U0` = `@@ -206,0 +215,15 @@` + `@@ -209,2 +231,0 @@`）**
```diff
   const challengeRecord = activeAuthChallenges.get(nonce);
   if (!challengeRecord || challengeRecord.evm !== challengeAddress || challengeRecord.expiresAt !== expiresAt) {
     throw new Error('Challenge has been consumed or expired');
   }
-  activeAuthChallenges.delete(nonce);
-
-  // Historical parity with the final Python backend:
-  // the deleted implementation temporarily bypassed signature verification.
+
+  // SIG-VERIFY（HIGH 安全修复）：对签发时给出的那份原文做 EIP-191 personal_sign 恢复，
+  // 并与声明地址做大小写不敏感比对。修前此处直接 return ⇒ 垃圾签名也能换真 JWT。
+  // 语义保持：比对通过才 delete（消费 nonce）；比对失败不消费。
+  let recoveredAddress: string;
+  try {
+    recoveredAddress = verifyMessage(challengeRecord.message, signature);
+  } catch {
+    throw new Error('Invalid wallet signature');
+  }
+  if (recoveredAddress.toLowerCase() !== challengeAddress) {
+    throw new Error('Signature does not match the claimed address');
+  }
+
+  activeAuthChallenges.delete(nonce);
+
   return {
     evm: normalizedAddress,
   };
```
- **错误体不新造**：两条 `throw new Error('…')` 由既有 `src/index.ts:379 catch ⇒ sendError(res, 401, error.message)` 转成既有 `401` 体 `{success:false, message, error}`（`sendError` 定义 `index.ts:74-78`），与邻近消息（`'Challenge address mismatch'`、`'Challenge has been consumed or expired'`、`'evm_address, signature and challenge_token required'`）**同形同层** ⇒ **零新错误码 / 零新 reason / 零新 kind**。
- **顺序即语义（有意为之）**：验签在 `delete` **之前**（现盘 `:221` 验签 / `:230` 消费）⇒ 坏签名**不消费** challenge（合法用户一次误签不会打掉自己的 nonce）；**单次消费语义不变**（成功路径仍 `delete`）。实测自证见 §4 AC-S1。
- **未删任何函数**；`pruneAuthChallenges` / `buildWalletSignMessage` / `signToken` / `verifySignedToken` / `isAdminAddress` 一律未动（`git diff -U0` 仅 6 个 hunk，见上）。

## §3 依赖决策（严格：先查仓库、确无才装、且只许一包）

| 步骤 | 实测读数 |
|---|---|
| ① 先查仓库已有依赖 | `package.json` dependencies = `@neondatabase/serverless` / `@vercel/node` / `cors` / `dotenv` / `express` / `helmet` / `ws` —— **无 `ethers` / `viem` / `web3` / `secp256k1` / `ethereumjs-*`** |
| ② 查 node_modules（含嵌套，`maxdepth 3`） | `-iname "*secp*" / "*noble*" / "ethers" / "ethereum*"` ⇒ **0 命中** |
| ③ 结论 | **确无**可用恢复原语；Node 内置 `crypto` 既无 `secp256k1` **公钥恢复**，其 `sha3-256` **也不等于** Keccak-256 ⇒ **不可自造** |
| ④ 安装 | `npm install ethers` ⇒ **`added 9 packages in 24s`**、`exit 0`；**未装任何其它包** |
| ⑤ 确切版本 | `node_modules/ethers/package.json` ⇒ **`"version": "6.17.0"`**；`package.json:17` ⇒ **`"ethers": "^6.17.0"`** |
| ⑥ lockfile 变化 | `backend-ts/package-lock.json` **+98 / −0**（新增 `ethers 6.17.0`、`@noble/curves 1.2.0`、`@noble/hashes 1.3.2`、`@adraffy/ens-normalize 1.11.1`、`aes-js 4.0.0-beta.5`、`ethers/node_modules/ws 8.21.0`、`ethers/node_modules/@types/node 22.7.5`、`undici-types 6.19.8`）；`package.json` **+1 / −0** |
| ⑦ 用法 | 只用**一个**顶层 API：`import { verifyMessage } from 'ethers'` ⇒ `verifyMessage(message, signature)` 返回**校验和地址**（恢复失败抛异常）。`grep -c verifyMessage src/auth.ts` = **2**（import `:2` + 调用 `:221`） |

> 传递依赖（`@noble/*` 等 8 个）由 npm 依 `ethers` 自身 `dependencies` 自动带入 —— **非本单显式安装**；未新增任何直接依赖之外的**包名**。

## §4 逐项验收读数（硬 AC ①–⑩ · 全部实测）

**口径**：`p4z-b5sv-01-http.ts` 在**同一台服务**上先后跑 `pre`（改前**活的**旧进程 —— `dev` 脚本是 `ts-node src/index.ts`，**无 watch**，改源码不触发重载）与 `post`（面板 `POST /api/restart {"sid":"seafood-api"}` 一次，重启后**先等** `/health` = `200`）。私钥由探针 `Wallet.createRandom()` **进程内新造**，产物只落**地址**（公开标识）与 **sha256 前 12 位指纹**。
**总体**：`pre` = **9/11 PASS，`PRE_EXIT=1`（预期）**（`failed_ids:["AC2","AC3"]`）；`post` = **11/11 PASS，`POST_EXIT=0`**。

| # | 判据 | 改前（pre）**实测** | 改后（post）**实测** | 结论 |
|---|---|---|---|---|
| ① | **真签名 ⇒ 200** | `200` / `success:true` / `token_present:true` | `200` / `success:true` / `token_present:true` | **PASS** |
| ② | **垃圾签名 `0xdeadbeef` ⇒ 401**（核心回归判据） | **`200`** `{success:true,message:"OK",token_issued:true}` ⇒ **真 JWT 已签发** | **`401`** `{success:false,message:"Invalid wallet signature",token_issued:false}` | **PASS（200→401）** |
| ③ | **他人签名（B 私钥签 A 的 challenge）⇒ 401** | **`200`** `message:"OK"` | **`401`** `message:"Signature does not match the claimed address"` | **PASS（200→401）** |
| ④ | 重放（同 challenge 二次）⇒ 401 | `401` `"Challenge has been consumed or expired"` | `401` `"Challenge has been consumed or expired"` | **PASS（保持）** |
| ⑤ | 同地址大小写（校验和变体）⇒ 200 | `200`（lower 申领 / checksum `0x1cBaf854…B86e0` 提交） | `200`（`0x720c66011B1fa2fa5189Fc2cf806AA76Ca26B94b` + `token_present:true`） | **PASS（不误杀）** |
| ⑥ | `tsc --noEmit` = 0 | — | **`TSC_EXIT=0`** | **PASS** |
| ⑦ | 注册点 65 | `65` | **`65`**（`grep -cE '^app\.(get\|post\|put\|patch\|delete)\(' src/index.ts`） | **PASS（不变）** |
| ⑧ | 已落 `410` 面 6/6 | `6/6` | **`6/6`** —— `admin/task/{create,update,delete}` + `admin/prize/{create,update,delete}` **逐条 `410`** | **PASS** |
| ⑨ | `Δledger_entry` = 0、`Σ(cid=1)` 不变 | 基线：`ledger_entry=267`、`Σ=1989693` | `ledger_entry=267`（**Δ=0**）、`Σ=1989693`（**Δ=0**）、`asset` 表 `asset_absent=true` | **PASS** |
| ⑩ | 新钱包登录仍 200 | `200` | **`200`** + `uID=970210` / `points=0` / `requires_profile_completion=true` / `token_type=bearer`（§5.1 冒烟） | **PASS** |

**既有 401 面（不得削弱 · 改后实测保持）**：`R1` 缺 `challenge_token` ⇒ `401 "evm_address, signature and challenge_token required"`；`R2` 垃圾 `challenge_token` ⇒ `401 "Invalid token signature"`；`R3` 声明地址与 challenge 不符 ⇒ `401 "Challenge address mismatch"`。

**AC-S1（非硬 AC，自证顺序语义）**：AC3 那次**失败**的 challenge，改前再用**正确**签名投 ⇒ `401`（已被垃圾/他人签名**误消费**）；改后同场景 ⇒ **`200`**（失败**不消费**）。⇒ 证明「先验签、后消费」的落点正确。

### §4.1 零改面自证（边界）

| 项 | 读数 |
|---|---|
| `migrations/**` | `git status --porcelain -- migrations` ⇒ **0 行**（**未建表**） |
| `src/**` | `git status --porcelain -- src` ⇒ **仅 `M backend-ts/src/auth.ts`**（`index.ts`/`database.ts`/`ledger.ts`/`ledger-errors.ts`/`commission.ts`/`currency-service.ts` 全未动） |
| 受改文件全量 | `M backend-ts/package-lock.json` / `M backend-ts/package.json` / `M backend-ts/src/auth.ts` ⇒ **恰好三件** |
| 旧旁路注释 | `grep -c 'bypassed signature verification' src/auth.ts` ⇒ **0**（已删，不再误导读码者） |
| 产物泄漏 | `grep -ro 'eyJ[A-Za-z0-9_-]*' .p4-artifacts/b5sv-20260930T231433` ⇒ **0**；`grep -roE '0x[0-9a-fA-F]{64}'`（私钥形态）⇒ **0** |
| 端口/进程 | 仅面板 `POST /api/restart {"sid":"seafood-api"}` **一次**；**无** `pkill`/`killall`；无常驻 server；重启后**先等** `/health` = `200`（`schema_version=0020`） |
| 收尾服务态 | `GET /health` = **`200`**；面板 `/api/status` ⇒ `sid=seafood-api state=running port=5788 running=true error=null` |

## §5 探针自曝 / 边界自证 / 口径

1. **★ 我的探针有一处字段名错（§5.7③ 先怀疑自己的探针）**：`p4z-b5sv-01-http.ts` 读 `body.data.uid`，而真源字段名是 **`uID`**（`sendSuccess({...user, …})` 走 `normalizeUser` 的键集）⇒ 产物 `http-*.json` 里 `verify_A.uid` **为 `undefined`（JSON 序列化时被丢弃，表现为该键缺失）**，**不是**「服务端没返回用户 id」。**已用独立 `node -e` 冒烟现取更正**：`data_keys=["uID","EVM","bio","is_admin","time_reg","time_login_last","points","requires_profile_completion","token","access_token","token_type"]`、`uID=970210`、`points=0`、`token_len=193`。**硬 AC ①/⑩ 的判据（HTTP 状态码 + `token_present`）不依赖该字段名**，故结论不受影响；错误读法如实登记、**不回填覆盖**。
2. **`message`「同存」vs「重算」**（§2②）：`buildWalletSignMessage` 是**纯函数**，重算与同存在**当前代码**下**逐字节等价** —— 实测把服务端返回的 `message` **原样**喂给 `signMessage`，改前改后**都验得过** ⇒ 验签侧取到的原文与签发侧返回的原文一致（这也是 AC①/⑤ 能 `200` 的前提）。选择**同存**是为了让「模板一旦漂移、在途 challenge 的签名静默全废」这一隐性回归**结构性不可达**；代价仅是记录多一个 string 字段（内存 Map，`pruneAuthChallenges` 已管过期回收）。
3. **`points: 0` 而非 `42P01`**：新钱包 verify 返回 `200` + `points=0` + `requires_profile_completion=true` ⇒ **B5-FIX-LOGIN 未被本单打回**（登录链**未**再触 `asset` 表；`asset_absent=true` 佐证）。
4. **`Δusers_total = 29 → 31`（+2，非账本）**：`pre`/`post` 各有一个 `Wallet.createRandom()` 新地址走通 verify ⇒ `findOrCreateUserByEvm`（`database.ts:831`）建 `users` 行。这是**登录端点的既有侧效应**（B5-FIX-LOGIN 报告已登记同一现象），**不产生 `ledger_entry`**（实测 Δ=0）。**本单未新增**该行为。
5. **`account_rows_cid1` 基线为 `NOT_MEASURED`**（见 §6），改后读数 `16`。
6. **口径**：所有读数落在 `probe-pre.log` / `probe-post.log` / `http-pre.json` / `http-post.json` / `invariants*.json`，可用 `grep` 复核；退出码**直接取**、**未经管道**（`PRE_EXIT=1` / `POST_EXIT=0` / `TSC_EXIT=0` / `INV_POST_EXIT=0`）。`pre` 的 `exit 1` 与 `post` 的 `exit 0` 之差 = AC2/AC3 两行由 FAIL 转 PASS，**这正是本单的核心回归判据**。
7. **未做的分支出证（诚实边界）**：未构造「过期 challenge」用例（需 ≥300s 等待，或改 `AUTH_CHALLENGE_EXPIRE_SECONDS` —— 属未授权改动）；该分支由既有 `verifySignedToken` 的 `exp` 检查覆盖，**本单未改动它**，故不在本单取证范围（§6 登记）。
8. **★ 收尾观测到一次瞬时 `/health` = `503`（已知风险，如实登记）**：收尾复核时 `GET /health` 曾返回 **`503`**（该端点在 DB 探针失败时按 `index.ts:321-327` 降级为 `503 {ok:false,db_version:"unknown"}`），**随即第 1 次重试即恢复 `200`**（`schema_version=0020`）。判定为 **Neon 抖动**而非本单缺陷或进程自退，依据：① 面板 `/api/status` 全程 `state=running`/`portOpen=true`/`error=null`，且 **`pid=53395` 与重启时同一**（**未发生**自退或面板重拉）；② 抖动期同一批 DB 探针中 `account_rows_cid1` 另一条也报过 `Error connecting to database: fetch failed`（§6 基线相）；③ 本单 diff **不触任何 DB 连接/健康检查代码**。**未**做第二次面板重启（抖动非进程故障，重启不可解决且徒增风险）。


## §6 NOT_MEASURED

| 项 | 状态 | 原因 |
|---|---|---|
| `account_rows_cid1` 的**基线（改前）**值 | **`NOT_MEASURED`** | 基线相该条 SELECT 命中 Neon 抖动：`{"label":"account_rows_cid1","ok":false,"error":"Error connecting to database: fetch failed"}`（**已知风险**；同批其余 4 条同期成功）⇒ **不填 0、不填空、不拿改后值冒充改前值**。改后值 = `16`；本单 diff **结构性不触 `account` 表**（`auth.ts` 无任何 `account` 读写），另有 `Σ(cid=1)` 与 `ledger_entry` 两项 **Δ=0** 佐证账本未动。 |
| 「过期 challenge ⇒ `401`」专项 | **`NOT_MEASURED`** | 见 §5.7（需 ≥300s 或改未授权常量）。 |
| 前端对两条新 `401` 文案的展示依赖 | **`NOT_MEASURED`** | 本单硬边界**禁改 `frontend/**`**；仅登记为后续回归核验项（对照 `route-layer.spec §7-27` 的同族先例）。 |
