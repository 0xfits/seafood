# route-layer.spec **v1.0 → v1.1** 折入 delta（Jing · Specifier · 制度员）

> 单元：**Unit Jing-V1.1（规格折入 · 登录必须验签 + ethers 依赖 + 登录端点口径 + 收尾项 + 行号刷新）**｜日期：2026-09-30（CST）｜前身 = **v1.0**
> 本件 = **逐条 delta → 依据锚点 → 改动点**（派单要求的交付面之一）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准** —— 本单**逐处标依据**（**Zang §5.105 / §5.106**），**无一处与之冲突**（**无 `待 Zang 复核` 项**）。
> **只追加式**：非追加改动 = **就地刷新 1 处**（**§9.E · E9 的锚点行号** `:1200-1202` ⇒ **`:1206-1208`**，**旧写法逐字留痕**）；**其余全部为追加**。

---

## §D0 指纹自证（交付时现取 · 三口径 + `cmp`）

| 项 | 文件 | 行数 | 字节 | md5 |
|---|---|---:|---:|---|
| **改前（v1.0）** | `docs/route-layer.spec.md` | **1849** | **417626** | **`c68f525340e2c9e0b2fdb1277a56acb6`** |
| **改后（v1.1）** | `docs/route-layer.spec.md` | **2037** | **448834** | **`3f0aef0e49aa6c2fff0380045888209a`** |
| **快照** | `docs/versions/route-layer.spec.v1.1.md` | **2037** | **448834** | **`3f0aef0e49aa6c2fff0380045888209a`** |

**自证命令（逐字 · 退出码一律管道外取；本机无 `timeout`）**：

```
cp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.1.md && cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.1.md; echo "CMP_EXIT=$?"
md5 -q docs/route-layer.spec.md; md5 -q docs/versions/route-layer.spec.v1.1.md; wc -l -c docs/route-layer.spec.md
wc -l docs/versions/route-layer.spec.v1.0.md
```

**读数**：`CMP_EXIT=0`（**快照与本册逐字节相同**）；两 md5 逐位相同 = `3f0aef0e49aa6c2fff0380045888209a`；`2037 448834`；**v1.0 快照仍 `1849` 行**（**十个既有快照 v0.1–v1.0 一字未动**）。
**新节落点（`grep -n` 现取）**：`§1.12`（v1.0 旧节）= `:456`；**`§1.13` = `:489`**；**`§3.6` = `:775`**；**`§3.7` = `:807`**；**`§8.13` = `:1897`**；`§9.E` = `:2024`；`§9.B` = `:1991`。**§1.12 v1.1 追加块**紧随 §1.12 正文之后（同节内追加）。
**新编号出现次数（`grep -c` 现取 · **含交叉引用**）**：`7-47` = **7** / `7-48` = **6** / `E10` = **11** / `B14` = **7**（**判据 = 追加表 / §9.E / §9.B 内各 1 行**）。
**★ 纪律**：本册**不内嵌自身 md5**（防自指），指纹**只在本件**；**v0.1–v1.0 快照未动**。

---

## §D1 delta ① —— ★★ 新硬规则：**登录必须验签**（EIP-191 `personal_sign`）

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.106**（派单 delta ①）；**实现 / 取证** = `docs/audit/p5-sig-verify.md`（单号 **SIG-VERIFY** · 角色 Kong · **164 行** · run tag `b5sv-20260930T231433`） |
| **规则（写死 · 逐字入册）** | 「`POST /api/auth/verify` **必须**对签发时给出的**原文消息**做 **EIP-191 `personal_sign`** 恢复地址、与声明地址**大小写不敏感**比对；不匹配 / 签名非法 ⇒ **`401`**」 |
| **四条判据（硬）** | ① 真签名 `200` ② 垃圾签名 `0xdeadbeef` `401` ③ 他人签名（地址不匹配）`401` ④ 重放（同 challenge 二次）`401` |
| **两层关系（写死 · 不得互推）** | **token 层见 P4-SEC（兜底密钥已移除）· 签名层见 P5-SIG-VERIFY（本单）**；token 层通过 **≠** 签名层通过（修前正是「token 层通过、签名层空缺」⇒ **完整身份冒充**） |
| **本册现取锚点**（`backend-ts/src/`） | `auth.ts:2`（`import { verifyMessage } from 'ethers'`）｜`:52`（`AuthChallengeRecord.message`）｜`:110`（`buildWalletSignMessage`）｜**`:141`**（`startWalletAuthChallenge`；`message` 构造 `:156`、落 Map `:158-163`）｜**`:182`**（`consumeWalletAuthChallenge`；record get `:210`）｜**`:221`**（`verifyMessage(challengeRecord.message, signature)`）｜**`:223`**（`Invalid wallet signature`）｜`:226`（`toLowerCase()` 比对）｜**`:227`**（`Signature does not match the claimed address`）｜**`:230`**（`delete` 消费 nonce）；`index.ts:354`（路由）｜`:379`（`sendError(res, 401, …)` 出口） |
| **改动点** | **§3.6 新增**（规则 3 条 + **四条判据表** + **两层关系** + **顺序即语义** + **零新增面** + **判负 4 条** + `NOT_MEASURED` + 前身关系）；**§7 追加 7-48**（前端四语覆盖）；**§9.B · B14**（收尾项）；**§8.13.2-52/53**（NOT_MEASURED） |
| **口径（写死）** | **零新错误码 / 零新 `reason` / 零新 `kind` / 零 SQL 改动** —— 两条新文案走**既有** `sendError` 出口，与邻近 `auth` 面 401（`auth.ts:192` / `:206` / `:212`）**同形同层**；**「顺序即语义」**：验签（`:221`）**先于**消费（`:230`）⇒ 坏签名**不消费** challenge |
| **落点** | **§3.6**（`docs/route-layer.spec.md:775`） |
| **`NOT_MEASURED`** | 四条判据的 HTTP 面 = **转引**审计件 §4（本册零 HTTP 调用）；「过期 challenge ⇒ `401`」= **`NOT_MEASURED`**（审计件 §5.7/§6） |

---

## §D2 delta ② —— 依赖入册：`ethers@^6.17.0`

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.106**（派单 delta ②）；真源 = `docs/audit/p5-sig-verify.md §3` |
| **本册现取锚点** | `backend-ts/package.json:17`（逐字 `"ethers": "^6.17.0",`） |
| **转引读数** | 实版 `6.17.0`（`node_modules/ethers/package.json`）；`npm install ethers` ⇒ `added 9 packages`；`package-lock.json` **`+98 / −0`**（传递依赖 8 包**非显式安装**） |
| **部署约束（写死）** | **部署必须带 lockfile**（`package-lock.json` 随 `package.json` 同批提交） |
| **★ 债务归属（防混同）** | 本条 = **服务端包**；**与「前端 Tailwind CDN」那条债务不是同一件事**（该条**不在本册登记面内** ⇒ 本册不引其锚点、不合并；**`grep 'Tailwind' docs/route-layer.spec.md` = 0 行**，本册现取） |
| **改动点** | **§1.13 新增**（7 行登记表 + 判负 3 条 + `NOT_MEASURED`） |
| **判负** | ① 自造 secp256k1 恢复 / 用 `crypto` 近似（`sha3-256` ≠ Keccak-256）⇒ 复核不通过；② 部署不带 lockfile ⇒ 复核不通过；③ 与 Tailwind CDN 债务并案 ⇒ 复核不通过 |
| **落点** | **§1.13**（`:489`） |
| **`NOT_MEASURED`** | 安装面读数（`added 9 packages` / lockfile 计数）= **转引**（本册未安装任何包） |

---

## §D3 delta ③ —— 登录端点取余额口径（`getUserAsset ∥ emptyAsset`）

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.105**（派单 delta ③）；**实现 / 取证** = `docs/audit/p5-fix-login.md`（单号 **B5-FIX-LOGIN** · **159 行** · run tag `b5l-20260930T145112Z`） |
| **口径（写死）** | 取余额步骤 = **`(await DatabaseService.getUserAsset(uID)) ∥ DatabaseService.emptyAsset(uID)`**（`src/index.ts:364`）；**不得回退到写 `asset` 表**（该表**不存在且永不创建**，`data-layer.spec.md:166`）；**无 `account` 行的新钱包 ⇒ `200` + 空态 `0`**；**`42P01` 归零** |
| **本册现取锚点** | `index.ts:354`（路由）｜**`:364`**（`getUserAsset ∥ emptyAsset`）｜`:502`（同族先例：读端点 `GET /api/user/asset/:uID`，P4-B1-a 已收口）｜`database.ts:861`（`getUserAsset` 纯读 `account`）｜`:879`（`emptyAsset`）｜`:889`（`upsertAsset`；`:895` / `:910` 两条写 `asset` 的 SQL ⇒ **登录链已摘除调用**） |
| **改动点** | **§3.7 新增**（规则 4 条 + 同族先例 + **与 §4.11.1 缺表族的关系**〔**状态就地说明，§4.11.1 原文不改、留痕**〕+ 判负 3 条 + `NOT_MEASURED`）+ **§7 补注 ⑰** + **§9.E · E10**（`claim` 面残项） |
| **★ 状态就近说明** | **`POST /api/auth/verify` 不再落 `asset` 缺表族受影响面** ⇒ §4.11.1 该行「需 Kevin 一句话」**对 verify 已无对象**（读数以 §3.7 为准） |
| **落点** | **§3.7**（`:807`） |
| **`NOT_MEASURED`** | 改前 `401` ⇒ 改后 `200` / `points=0` / `42P01_in_body=false` = **转引**审计件 §3-①（本册未复跑） |

---

## §D4 delta ④ —— 收尾项登记：两条新 `401` 文案的**四语覆盖**

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.106**（派单 delta ④）；`docs/audit/p5-sig-verify.md §6`（该单硬边界**禁改 `frontend/**`** ⇒ 登记为后续回归核验项） |
| **真源** | `backend-ts/src/auth.ts:223`（`Invalid wallet signature`）/ `:227`（`Signature does not match the claimed address`） |
| **改动点** | **§9.B · B14**（新行：两条新 `401` 文案的四语覆盖）+ **§7-48**（登记行）+ **§8.13.2-56**（`NOT_MEASURED` 边界） |
| **判据（写死）** | `frontend/src/locales/{zh,en,hk,vn}.json` 各加 **2 键**、键名逐字一致、文案 = **本语种**提示（**不得**直接把英文串当四语）；**四语为一个单元** ⇒ **不得以「英文文案已可用」结案** |
| **★ 本册现取** | 两串在 `frontend/src` 全文 **0 命中**（`grep -rn` 现取）；`locales` 亦无对应键 ⇒ **当前 = 未覆盖**（**静态读数**） |
| **落点** | **§9.B · B14**（`:1991` 节内新行）；登记 = **§7-48** |
| **`NOT_MEASURED`** | 前端的**运行展示面**（这两条 `401` 是否弹出、弹什么文案）= **`NOT_MEASURED`** |

---

## §D5 delta ⑤ —— §9.E **E9 锚点刷新** + **新增 E10（`claim` 面 B5-2）**

| 项 | 内容 |
|---|---|
| **依据** | 派单 delta ⑤；`docs/audit/p5-fix-login.md §4` 表 #2/#3；**Zang §5.105 + §5.99④** |
| **E9（就地刷新 · **本册唯一非追加改动**）** | A1 入参不完整分支：**v1.0 现取 `:1200-1202` ⇒ v1.1 现取 `:1206-1208`**（路由 `:1197`；**`sed -n '1197,1215p'` 现读**：`if (!uID \|\| Number.isNaN(amount) \|\| !reason) return sendError(res, 400, '参数不完整')`）⇒ **非 `R107` 形状**。**旧读数 `:1200-1202` 在行内留痕不删** |
| **E10（新增行）** | `POST /api/task-progress/claim/:jID`（路由 **`src/index.ts:641`**；两处调用 **`:665`** / **`:676`**）的 `getUserAsset ∥ upsertAsset` 回退 + 首领取 `upsertAsset(rewardPoints)`（**B5-2**）：**默认口径 = 退役**（`410` + `sunset`；前端停止调用并在原入口显「已下线」）；**Kevin 一句话可改** ⇒ 改「保留」则按 **§3.7 同族收口**（`emptyAsset`；**不得**写 `asset` 表）。前置 = 前端先停调用（`ClaimRewardModal.jsx:49` / `RewardPage.jsx:152`） |
| **改动点** | **§9.E · E9**（行内锚点刷新 + 交叉引 `§7-45` / 补注 ⑱）+ **§9.E · E10**（新行）；**§7-47**（登记行）；**§7 补注 ⑰/⑱** |
| **落点** | **§9.E**（`:2024` 节内） |
| **`NOT_MEASURED`** | E10 的 HTTP 面（本单**未跑该端点**）；E9 的「该分支是否可被前端触发」= **`NOT_MEASURED`**（§8.12.2 / §8.13.2-58） |

---

## §D6 delta ⑥ —— 行号刷新（§1.12 状态列复核 + `auth.ts` 漂移）

| 项 | v1.0 记载（**历史留痕**） | **v1.1 现取（以现盘为准）** |
|---|---|---|
| 注册点 | 65 | **65**（`grep -cE '^app\.(get\|post\|put\|delete\|patch)\('`）**不变 ✓** |
| `src/index.ts` 行数 | 1645 | **1651**（**+6 = P5-FIX-LOGIN 的 `+7/−1`**，落 `:359-364`） |
| `src/auth.ts` 行数 | （未记） | **261**（**+21 = P5-SIG-VERIFY 的 `+24/−3`**；改前 **240**，**推断**：261 − 24 + 3） |
| `POST /api/auth/verify` | `:354` | **`:354`**（**唯一不漂移的端点**；本单改动全在其后） |
| 招工六条（`/job` `/apply` `/accept` `/submit` `/review` `/cancel`） | `:1359` `:1375` `:1397` `:1422` `:1450` `:1474` | **`:1365` `:1381` `:1403` `:1428` `:1456` `:1480`**（**逐条 +6**） |
| 商品五条（`/listing` / `:listingId` POST·PATCH / `/buy` / `/refund`） | `:1492` `:1518` `:1545` `:1569` `:1590` | **`:1498` `:1524` `:1551` `:1575` `:1596`**（**逐条 +6**） |
| `POST /api/admin/commission_policy` | `:1610` | **`:1616`** |
| `POST /api/tasklist/:jID/verify` | `:1109` | **`:1115`** |
| `POST /api/currency` / `/api/currency/:cid/list` | `:1282` / `:1301` | **`:1288` / `:1307`** |
| `POST /api/admin/points/adjust` / `/api/admin/assets/init` | `:1191` / `:1173` | **`:1197` / `:1179`** |
| `POST /api/task-progress/claim/:jID` | `:635` | **`:641`** |
| `GET /api/prize-item` / `GET /api/shard` | `:546` / `:687` | **`:552` / `:693`** |
| **`auth.ts` 锚点（新增面）** | （v1.0 无） | `:2` / `:52` / `:60` / `:110` / **`:141`** / `:156` / `:158-163` / `:165` / **`:182`** / `:210` / **`:221`** / `:223` / `:226` / `:227` / `:230` / `:237`（**本册现取**） |

- **改动点**：**§1.12 v1.1 追加块**（22 行对照表 + `auth.ts` 锚点行 + 口径升「**六分**」 + 留痕声明 + §1.8 状态列口径不变声明）。
- **结论**：**§1 处置列 = 无订正**；**§1.8 状态列 = 无订正**（注册点 65、「已注册（批 4a）」11 行 + 1 附注）；**只登记行号漂移**。
- **口径**：**行号口径「五分」⇒「六分」**（v0.1 live / 批 2 末态 / 批 3a 末态 / 批 3b 末态 / v1.0 现取 / **v1.1 现取**）。
- **落点**：**§1.12 v1.1 追加块**（紧随 `:456` 节正文）。

---

## §D7 delta ⑦ —— 不变项复核（四项 · 全部现取）

| 不变项 | 现取读数 | 真源 |
|---|---|---|
| **注册点** | **65** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts`（现取） |
| **已落 `410` 面** | **6/6** | `src/index.ts:1025`/`:1029`/`:1033`（`admin/task/{create,update,delete}`）+ `:1037`/`:1044`/`:1051`（`admin/prize/{create,update,delete}`）（**本册现取**） |
| **`Σ(cid=1)` / `ledger_entry`** | **1,989,693** / **267**（**Δ=0**） | **转引** `docs/audit/p5-sig-verify.md §4 ⑨`（**本册零库连接**；同单佐证 `asset_absent=true`） |
| **kind 关闭集** | **20** | `backend-ts/src/ledger.ts:153-160`（`LEDGER_KINDS`；本册现取 `grep -o "'[a-z_]*'" \| wc -l` = **20**）；`migrations/0003_kind_close_set_20.sql:65-66` |

- **落点**：**§1.12 v1.1 追加块**「不变项复核」表。
- **`NOT_MEASURED`**：`Σ(cid=1)` 的**库面自测** = 未做（零库连接）。

---

## §D8 口径差 / 自曝 / `NOT_MEASURED` 汇总（编号承 v1.0 的 41–51）

| # | 项 | 口径 |
|--:|---|---|
| 52 | **四条判据的 HTTP 面** | **转引** `p5-sig-verify.md §4`（本册零 HTTP 调用） |
| 53 | **过期 challenge ⇒ `401`** | **`NOT_MEASURED`**（需 ≥300s 或改未授权常量；由未改动的 `exp` 检查覆盖） |
| 54 | **§3.7 的 HTTP 面**（`401→200` / `points=0`） | **转引** `p5-fix-login.md §3-①` |
| 55 | **安装面**（`added 9 packages` / lockfile `+98/−0` / 实版 `6.17.0`） | **转引** `p5-sig-verify.md §3 ④–⑥`（本册未安装任何包） |
| 56 | **两条新 `401` 在前端的展示 / 四语覆盖** | 静态读数 = 本册现取（**0 命中**）；**运行展示面 = `NOT_MEASURED`** |
| 57 | **`Σ(cid=1)` / `ledger_entry` 库面现值** | **转引** `p5-sig-verify.md §4 ⑨` |
| 58 | **全册 HTTP 响应码面** | **未复跑**（v1.1 只复核行号 / 计数） |
| 59 | **E10（`claim` 面）的 HTTP 与前端调用面** | **未跑**（去向待 Kevin 一句话，7-47） |
| 60 | **「`:1206-1208`」的取得方式** | **`sed -n '1197,1215p'` 现读**（**非**由旧行号加偏移推得） |
| 61 | **`auth.ts` 改前 240 行** | **推断**（261 − 24 + 3，依据审计件 §2 的 `git diff --numstat = 24 / 3`）；**本册不持有改前盘** |
| 62 | **§1.12 「+6」的归因** | **推断**（单点 `+7/−1`）—— 但**逐条行号本身是 `grep` 现取** |
| 63 | **两条新 `401` 是否并入 §3.4 `R107` 统一面** | **本册不裁**（**不发明裁定**，不为它新立 §9.E 行） |
| 64 | **响应体形状** | 取**代码面**（`index.ts:379` 出口）为判据；**实读 = `NOT_MEASURED`**（#52） |
| 65 | **先骸架后回填** | 各新增节**一次成文、无占位态**（无 `待回填` 字样） |

**★ 本单 `待 Zang 复核` 项 = 0**（v1.0 的 #41 常量行号差**不在本单范围**，本单未触碰 §4.9/§4.10 正文）。

---

## §D9 交付物清单

| 类型 | 路径 | 状态 |
|---|---|---|
| 规格（就地升版） | `docs/route-layer.spec.md`（**v1.1** / **2037 行** / **448834 B** / md5 `3f0aef0e49aa6c2fff0380045888209a`） | ✅ |
| 快照 | `docs/versions/route-layer.spec.v1.1.md`（**同额同指纹**，`cmp` = **0**） | ✅ |
| 审计件（本件） | `docs/audit/route-layer-v1.1-delta.md` | ✅ |

**新增节一览（4 节）**：**§1.13**（依赖登记 · `:489`）/ **§3.6**（登录必须验签 · `:775`）/ **§3.7**（登录取余额口径 · `:807`）/ **§8.13**（v1.1 增补 · `:1897`）。
**追加块一览（4 处）**：**§1.12 v1.1 追加块**（行号 + 不变项）/ **§7 v1.1 追加表**（7-47 / 7-48）+ 补注 ⑰–⑲ / **§9.B · B14** / **§9.E · E10**。
**就地刷新 = 1 处**：**§9.E · E9** 的锚点行号（**旧读数留痕**）。

---

## §D10 边界自证（本单**没做**什么）

- **只写三个文件**：`docs/route-layer.spec.md`（就地升 **v1.1**）、`docs/versions/route-layer.spec.v1.1.md`（快照 · `cmp` 逐字节相同）、本件。
- **禁项确认**：**未** `git add/commit/push`（**未跑任何 git 写命令**；`git status --porcelain` 仅只读查看）；**未**写库 / **零库连接**；**未**启停任何服务或进程（**未 kill 任何 PID**、**未**用 `pkill -f` / `killall`）；**未** `npm install`；**未**用 `execute_code`；**未**用 `timeout`（本机无）；**未**用 heredoc / 巨型内联 payload（`terminal` 每次 ≤3 条命令）。
- **未触碰**：`docs/ledger.spec.md`、`docs/data-layer.spec.md`（**两册无需改** —— 四条 delta 全落**路由 / 鉴权 / 前端收尾**面，**无 `DL*` / `R*` 变更**）、**`docs/versions/route-layer.spec.v0.1–v1.0.md`（十个既有快照一字未动 —— v1.0 快照仍 `1849` 行 / md5 `c68f525340e2c9e0b2fdb1277a56acb6`）**、`docs/seafood.master-plan.md`、其它 `docs/audit/*`（含 `p5-sig-verify.md` / `p5-fix-login.md`，**只读**）、`docs/qa/*`、`backend-ts/**`（**只读**：`grep`/`grep -c`/`wc -l`/`sed -n`）、`frontend/**`（**只读检索**）。
- **非追加改动 = 1 处**（§9.E · E9 锚点刷新，**旧读数逐字留痕**）；**其余全部为追加**。
- **纪律自检（§5.7 硬口径 ①–⑧ + 本单纪律）**：① 带引号断言加引号 ✅｜② 退出码不取管道后 ✅｜③ 本机无 `timeout` ✅｜④ 读数异常先怀疑自己 ✅（#60–#62 登记）｜⑤ 先骸架后回填 ✅｜⑥ 报数带口径 ✅（行数 / 字节 / md5 + 非追加 1 / 追加 4 节 + 4 追加块）｜⑦ 凡「实测」可 `grep` 到 ✅｜⑧ **立案 / 标签前必须自己复现一次** ✅（kind 20 / `410` 6/6 / `ethers` 行 / 两条 401 文案前端命中数 / `upsertAsset` 全部调用点 —— **五项本册亲跑**）；**并守与裁定冲突 ⇒ 以 Zang 为准 + 标依据 ✅**（本单逐处标 §5.105 / §5.106，**无冲突、无待裁项**）。
