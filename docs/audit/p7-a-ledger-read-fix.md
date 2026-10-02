# 批 7-A · 收口四报告（`p7-a-ledger-read-fix`）

> 角色 = **Kong**（Builder） · 轮次 = **批 7-A 第四单（收口四）**
> 仓库 = `/Users/kevin/bistro/seafood` · 分支 = `main`
> 开工锚 = 本地提交 **`09362ad`**（语境给定；已 commit、未 push）
> 本报告**分段落盘**（先骨架、后逐节回填），不以一次性写入收尾。
> 硬口径：身份表一律 `users`（绝不裸 `user`）；SQL 显式 `public.`；未做项写原因、禁填 0/空；转引不得冒充实测。

---

## §0 开工态与未回退声明

**开工态（逐字）**：`git log --oneline -1` → `09362ad feat(api): 批 7-A 账本读口 /api/user/ledger（…）`；`git status --porcelain` → **空**（工作区干净）。

**★ 执行期间 HEAD 位移（诚实登记）**：本单执行中，HEAD 由 `09362ad` 前进到 **`2999636`**
（`docs: 批 7-A 质检一轮截断交回（有条件可用 + 两条真发现）+ 四条裁定（…）+ §5.161/v0.161（仍不推送）`）。
- **非本单所为**：本单全程**未执行** `git add` / `git commit` / `git push`（硬口径 ④）。
- **位移内容**：`git show --stat 2999636` ⇒ **1 file changed, 35 insertions(+)**，仅 `docs/seafood.master-plan.md`；
  `git show --name-only 2999636 | grep -E '^frontend/src|^backend-ts/scripts'` ⇒ **零命中**（不触碰本单任何写件）。
- ⇒ 本单的「开工态」内容**未变**：下表 `@09362ad` 与 `@HEAD` 两列**逐字相等**，即位移前后被改文件的原样完全相同。

**(a) 未回退声明 · 开工 sha ↔ 现取 sha（逐件）**

| 件 | `@09362ad`（= `@HEAD`）sha256 | 现取 worktree sha256 | 结论 |
|---|---|---|---|
| `frontend/src/ledger-api.js` | `ae692c3cc7b8079a7805ad4fadcbad214bc752807e7bfb0e134798338dc9bef3` | `c83573a0469192b9dcf497f94819eaf246ba615c1030eb65924ec37e4ebf142f` | 本单**改**（R-1；成功路径逐字未变） |
| `frontend/src/auth.js` | `f855426074c385257354e1a828a5703162ccecc18870d9856451bfbc12981d19` | `6200e64d72da6637bd7ed5d9b99f554fe384406126c3a6755bd9804d62bd5973` | 本单**改 1 处**（仅 `noCredentialError` 私有 → 具名导出） |
| `frontend/src/pages/ProfilePage.jsx` | `4dc7d82a06af4acce0738b24aa4bade1054de49b6b6f12ee76666998494d673f` | `884e03d8f23c839947a3d414e12904cf18b9860f92103eb8353a3cfe8a71a075` | 本单**改 1 处**（R-2 登录闸） |
| `backend-ts/scripts/p7a-01-http.ts` | `76182a3c825248888eb01fe210c67959ba0838c320bc79df7c8bee614ff1c3b7` | `368f8cd50e3c3ba534ba2951741b1b5bd96c11148729312b45c8e279297fd493` | 本单**改 1 处**（R-3① 读数袋类型） |
| `frontend/src/test/unit/ledger-flow-behavior.test.jsx` | `7780c51842d261572152bc0b7a22b2cabaf47f374f82b16481c4dbfc49896640` | `a63d228897167d76a6dfc4e48ccff312cf3e4cdeb3cdcf326e998279159a6fd2` | 本单**改 2 处**（替身对齐 + 新用例 ⑦；既有 5 例判据一字未动，见 §2-C） |
| `frontend/src/test/unit/listing-market.test.jsx` | `2792ecc0a1eeb38d13f4bd83afbfe26ce060639223bd6d980a2b454339c34eb8` | `1d6991bb0638ded3f97189866bdd22c565b6cc498a92cade348e95d3f9d25cf8` | 本单**改 1 处**（替身对齐；既有判据一字未动） |

**未回退声明（逐字）**：`09362ad` 已验收内容 —— ① 四语 locale 21 键（flat 704 / 四语严格相等）、② 陈旧断言改写、③ `ledger-flow-behavior.test.jsx` 5 例行为用例、④ 四条硬门 + 四脚本全绿、⑤ 四个门脚本的 `process.exit → process.exitCode`、⑥ `ledger.flowEmpty` 四语真语义 + 1 处等义改锚 —— **均未回退、未重写**。本单未触碰 `docs/route-layer.spec.md` 等任何 `docs/*.spec.md`、`migrations/**`、`docs/seafood.master-plan.md`、`docs/audit/**` 既有件（含本单新增件外的全部）、`docs/qa/**`。

**本单只做**：R-1 / R-2 / R-3① / R-4①+R-4② 五处代码改动 + 硬门重跑 + 三件判负自证 + 本报告（R-3②③ 与既有债只登记）。

## §1 四条裁定逐字落点（R-1 / R-2 / R-3 / R-4）

| 裁定 | 逐字要求 | 落点（现取） | 落点读数 / 证据 |
|---|---|---|---|
| **R-1 a** | `ledger-api.js` 错误分支**改为复用 `apiErrorMessage`** | `frontend/src/ledger-api.js:**49**` = `throw new Error(await apiErrorMessage(payload, response.status))` | 与 `auth.js:194`（`fetchApiJson`）**同一表达式同链**；判负 §4.1 |
| **R-1 b** | 补 `getAuthToken` 前置（无 token ⇒ 本地化「未找到登录凭证」，**不打请求**） | `ledger-api.js:**34-38**` = `const token = getAuthToken(user); if (!token) { throw await noCredentialError() }`（import 在 `:23`） | 与 `auth.js:234-237`（`fetchCurrentUser`）**同构**；判负 §4.2 |
| **R-1 c** | **选路径②**（不动共用件 `fetchApiJson` 的契约） | `auth.js` 的 `fetchApiJson` 现取**零语义改动**（唯一动作为私有 helper 具名导出，见下） | `git diff frontend/src/auth.js` = `7/2`：**全部**为注释 + `const → export const noCredentialError`（`auth.js:230`） |
| **R-1 d** | **登记**「两套取数入口并存」⇒ 待 P6/P7 统一时合并 | `ledger-api.js:9-12`（模块头「登记（收口四 R-1）」）+ 本报告 §5.4 | 登记项入 §5.4 表 |
| **R-2** | `ProfilePage` 账本面**按 `isAuthenticated` 设闸**（与 `MarketPage` 对齐）⇒ 未登录不发请求 | `frontend/src/pages/ProfilePage.jsx:**116-119**`：`if (!isAuthenticated) { setLedger({ rows: [], next: null, message: t('pleaseLogin') }); return }` | 与 `market/MarketPage.jsx:118-121` 同形；用例 ⑦（`ledger-flow-behavior.test.jsx`）；**该闸的判别力自曝见 §4.4 / §7.2** |
| **R-3①** | 修本单新增探针 `p7a-01-http.ts` 的 9 条 `TS18046`，使 `tsc -p tsconfig.scripts.json` **对该文件零新增错** | `backend-ts/scripts/p7a-01-http.ts:**88-94**`：新增 `type Reading = Record<string, any>` 单点类型（+ 原因注释），`const R: Reading = {}` | **前后错数对照**：该文件 **9 → 0**；全量 **86 → 77**；`diff` 证明「只减不增」（§3 G2） |
| **R-3②** | 其余 22 文件 / 77 条属**既有债** ⇒ **只登记不改** | 本报告 §5.3（逐文件 + 错误码分布） | 未改任何其它 `scripts/**`（numstat 仅 1 件） |
| **R-3③** | **纪律**（新增/改动脚本必须过 `tsc -p tsconfig.scripts.json`，**新增零错**）写进 spec 由 **Jing 下轮落**；本单**只登记** | 本报告 §5.3 末（给出可直接落 spec 的条文原文） | 本单**未触碰**任何 `docs/*.spec.md` |
| **R-4①** | 新增**类级断言脚本**（`frontend/scripts/`，带 p7a 前缀）；既有存量命中**逐条登记**；硬口径 = 「本单新增面零命中」+ 存量清单落盘 | 新增 `frontend/scripts/p7a-03-errmessage-gate.mjs`（基线 3 条 + 出口本体豁免 1 条） | 门读数：扫描 77 文件 / 受体 6 / 命中 3（全部已登记）/ 未登记 **0** → `PASS`（exit 0）；判负 §4.3 |
| **R-4②** | **单测判负**：401 / 503 抛出的 message 必须是 `apiErrorMessage` 链产出（四语文案）而非 `AUTH_UNAUTHORIZED` 原文；自带可注入 fetch + **真 locale 查表** | 新增 `frontend/src/test/unit/p7a-ledger-error-i18n.test.js`（6 例：401-R107 / 401-旧串面 / 503+reason / 无 token 零请求 / 裸 500 兜底 / 成功路径回归锚） | 判负自证 §4.1（旧写法 ⇒ ① ② ③ ⑤ **4 例红**） |

## §2 改动清单（`git diff --numstat` / 新增件 / 逐处留痕）

**A. 已跟踪文件（`git diff --numstat`，制表 = 增/删/路径）**

```
6   1   backend-ts/scripts/p7a-01-http.ts                     ← R-3①（读数袋类型 + 原因注释）
7   2   frontend/src/auth.js                                 ← R-1（noCredentialError 私有 → 具名导出 + 注释）
19  3   frontend/src/ledger-api.js                           ← R-1（错误面 + 登录前置 + 模块头登记）
6   0   frontend/src/pages/ProfilePage.jsx                   ← R-2（登录闸 + 原因注释）
29  6   frontend/src/test/unit/ledger-flow-behavior.test.jsx ← 替身对齐 + 新用例 ⑦（既有 5 例判据未动）
11  4   frontend/src/test/unit/listing-market.test.jsx       ← 替身对齐（既有判据未动）
```

**B. 未跟踪新增件（`git status`）**：`frontend/scripts/p7a-03-errmessage-gate.mjs`（R-4① 类级门）、
`frontend/src/test/unit/p7a-ledger-error-i18n.test.js`（R-4② 判负单测）、`docs/audit/p7-a-ledger-read-fix.md`（本报告）、
`backend-ts/.p7a-artifacts/P7A-GATES-002/`（本单硬门读数）、`backend-ts/.p4-artifacts/p6tr1a-20261002T071703Z/`（离线门副产物，脚本自产）。

**C. 两处测试替身改动（逐处留痕 · 非判据放宽）**

| # | 位置 | 旧 | 新 | 为什么 |
|---|---|---|---|---|
| 1 | `ledger-flow-behavior.test.jsx:44-56` | `vi.mock('../../auth', () => ({ fetchApiJson, fetchCurrentUser, getAuthHeaders, updateMyProfile }))` | `vi.mock('../../auth', async (importOriginal) => ({ ...(await importOriginal()), fetchApiJson, fetchCurrentUser, getAuthHeaders, updateMyProfile }))` | 工厂式替身**漏键**会把新的真前置打成 `TypeError: getAuthToken is not a function`，页面 catch 吞掉 ⇒ 用例假红/假绿。改为「真模块 + 只桩网络面」= 替身面与真模块**同构**。既有 5 例的**判据一字未动**。 |
| 2 | `listing-market.test.jsx:32-43` | `vi.mock('../../auth', () => ({ fetchApiJson, getAuthHeaders }))` | 同上形（`importOriginal` 展开） | **同一类缺陷的第二处**：本单首跑 `npm run test:unit` **实红**（`1 failed / 249 passed`；`listing-market.test.jsx` 的「账本流水」用例 `AssertionError: expected 0 to be greater than 0` = 账本请求数 0），根因逐字 = 该文件替身同样缺 `getAuthToken` ⇒ 真前置抛 `TypeError` ⇒ 页面 catch 掉 ⇒ 零请求。已同形修好（§5.5 登记为类级教训）。 |
| 3 | `ledger-flow-behavior.test.jsx:221-234` | —（新增） | 用例 ⑦：未登录 ⇒ 账本读口**零请求** + `pleaseLogin` 本地文案 + 账本面板不渲染 | R-2 的用户可见行为锚；**该例的判别力边界见 §4.4**（诚实声明，不冒充实测）。 |

**D. 非追加改动 / 回退声明**：**回退已完成部分 = 0 处**。本单未触碰 `migrations/**`、任何 `docs/*.spec.md`、`docs/seafood.master-plan.md`、`docs/audit/**` 既有件、`docs/qa/**`；未 `git add/commit/push`（HEAD 位移 `2999636` 非本单所为，见 §0）；未 `npm install`；未碰 `.env*`；**未改后端 `src/**` 一行**（`git diff --stat -- backend-ts/src` = 空）。

## §3 硬门读数（退出码在管道外捕获）

> 口径：每条命令都写成 `cmd > 文件 2>&1; echo EXIT=$?`（**不用 `| tail` 取码**）；产物落 `backend-ts/.p7a-artifacts/P7A-GATES-002/`。

| 门 | 命令 | 退出码 | 读数 |
|---|---|---|---|
| **G1 tsc（后端）** | `npx tsc --noEmit`（`backend-ts/`） | **0** | `error TS` 计数 **0**（`tsc-backend.txt`） |
| **G2 tsc（scripts）** | `npx tsc -p tsconfig.scripts.json --noEmit` | **2**（**既有债**，非本单门；本单判据 =「该文件新增零错」） | **前后对照**：全量 `86 → 77`；`p7a-01-http.ts` `9 → 0`；`diff <(sort before) <(sort after)` ⇒ **只有 9 行删除、零新增行** ⇒「本单新增零错」成立。余 **22 文件 / 77 条** = 既有债，只登记（§5.3） |
| **G3 离线** | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | `SUMMARY total=126 passed=126 failed=0`（**126/126 不降**） |
| **G4 build** | `npm run build`（`frontend/`） | **0** | `✓ built in 1.61s` |
| **G5 test:unit** | `npm run test:unit` | **0** | `Test Files 28 passed (28)` / `Tests 250 passed (250)`（**≥243 不掉**；= 243 + 本单新增 6 + 1 = 250） |
| **G6 脚本①** | `node scripts/p4z-i18nviol-global.mjs` | **0** | `总判：PASS（locale 裸命中 0 + 源面裸命中 0；作用域节点数 locale=2816 / source=37）` |
| **G7 脚本②** | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | `总判：PASS` |
| **G8 脚本③** | `node scripts/p4z-miscfix-links.mjs` | **0** | `总判：PASS（残留全部已登记）` |
| **G9 脚本④** | `node scripts/p4z-feperf-safelist.mjs` | **0** | `VERDICT=PASS` |
| **G10 新门（R-4①）** | `node scripts/p7a-03-errmessage-gate.mjs` | **0** | `总判：PASS（未登记命中 0 必须 = 0；扫描文件 77 / 受体 6 / 命中 3 / 基线 3）` |

**进程/端口口径（本单零启实例）**：本单**未启动任何服务实例**（无需：本单不动后端、不跑 HTTP 探针）⇒ 无「按精确 PID 收尾」动作。现取端口读数：
`lsof -nP -iTCP:5793-5799 -sTCP:LISTEN` ⇒ **仅 5793 有监听**，`COMMAND=node PID=17864`，命令行逐字 =
`…/profiles/zang/cache/scratch/qa-p7a-09362ad/backend-ts/node_modules/.bin/ts-node --transpile-only .p7aqa-artifacts/scripts/qa-serve-sn…`（启动时刻 `Fri Oct 2 15:16:25 2026`）
⇒ **非本单进程**（并行**质检方**的仓外镜像实例，见 `2999636` 交回的「派 收口四∥质检续跑」），**未触碰**（未 kill、未干扰）；5794–5799 **空**。
5787 **空**；5788 = 既有 dev（`PID 65096`，`Oct 2 10:02` 启动，他单）⇒ **未启停**。全程**未用** `pkill -f` / `killall`。

## §4 判负自证（三件实跑 + 一件「不区分」声明）

### §4.1 判负 A（R-4② 单测可判负）：错误分支改回**旧写法** ⇒ 4 例必红

- 变异（主工作区**就地**变异 + `cp` 备份 + sha 存证；前端单测必须落在真工作区 —— 需真 `node_modules` 与真 i18n 实例，仓外镜像不成立）：
  `throw new Error(await apiErrorMessage(payload, response.status))` → `throw new Error(String(payload?.error?.message || payload?.message || \`HTTP ${response.status}\`))`
  变异前 sha = `c83573a0…`，变异后 sha = `329ddb89…`（备份 `scratch/p7a-r4/ledger-api.PRISTINE.js`）。
- 跑 `npx vitest run src/test/unit/p7a-ledger-error-i18n.test.js` ⇒ **`EXIT=1`，`Tests 4 failed | 2 passed (6)`**（红）：
  - ① `AssertionError: expected 'AUTH_UNAUTHORIZED' to be '登录凭证无效或已过期，请重新登录。'`
  - ② `AssertionError: expected 'Invalid wallet signature' to be '钱包签名无效，请重新签名后再登录。'`
  - ③ `AssertionError: expected 'Ledger statement timed out' to include '(STATEMENT_TIMEOUT)'`
  - ⑤ `AssertionError: expected 'HTTP 500' to be '请求失败 (500)'`
  ⇒ **正逐字复现本地质检采到的缺陷**（用户看到的是服务端原文），即该例钉的正是 R-1 的判据轴。
- 复原：`cp` 回填 ⇒ sha 回 `c83573a0469192b9dcf497f94819eaf246ba615c1030eb65924ec37e4ebf142f`，`cmp` ⇒ **逐字相等**；复跑 ⇒ **`EXIT=0` / `Tests 6 passed (6)`**（绿）。

### §4.2 判负 B（R-1 b 登录前置可判负）：删 `getAuthToken` 前置 ⇒ 用例 ④ 红

- 变异：删掉 `ledger-api.js:33-38` 的整个前置块；跑同一文件 ⇒ **`EXIT=1`，`Tests 1 failed | 5 passed (6)`**：
  `AssertionError: expected undefined to be '未找到登录凭证'` —— 逐字含义 = 无前置时**请求真的发了出去且成功**，promise **resolve**（`.catch(e=>e)` 拿到的是回包，`.message` 为 `undefined`），与「零请求 + 本地化报错」相反。
- 复原：`cmp` 逐字相等、sha 回 `c83573a0…`；复跑 ⇒ **6/6 绿**。

### §4.3 判负 C（R-4① 类级门可判负）：仓外镜像注入 1 处真违例 ⇒ 门必响

- 镜像：`scratch/p7a-r4/gatemirror/`（`cp -R frontend/src`；**零仓内污染**，门脚本支持 `srcRoot` 参数即为此）。
- 注入（写入镜像的 `pages/HomePage.jsx` 尾部）：`const data = await response.json()` + `if (!data.success) throw new Error(data.message)`。
- 判负：`node scripts/p7a-03-errmessage-gate.mjs <mirror>/src` ⇒ **`EXIT=1`**：
  `命中 = 6（豁免 2）`、`! pages/HomePage.jsx:310 [未登记]`、`总判：FAIL（未登记命中 1；扫描文件 77 / 受体 7 / 命中 4 / 基线 3）`。
- 复原（去掉注入）⇒ **`EXIT=0`**、`总判：PASS（… 受体 6 / 命中 3 / 基线 3）`；镜像 `HomePage.jsx` 与仓内 `cmp` **逐字相等**；**仓内门复跑 `EXIT=0`**。

### §4.4 「不区分」声明（诚实边界 · 不冒充实测）

用例 ⑦（R-2 登录闸）**不区分** `ProfilePage.loadLedger` 里那行 `if (!isAuthenticated)` 的有无：
`ProfilePage` 的 `loadUserInfo` 在 `!isAuthenticated` 时**先早退**（`:54-58`），且账本面板仅在 `user` 在场时渲染、`loadLedger(null)` 只在已登录分支里被调用
⇒ **未登录路径本就零请求**。⑦ 钉的是**用户可见口径**（零请求 / `pleaseLogin` 本地提示 / 不出现服务端错误串 / 面板不渲染），
新增的闸与 `MarketPage` **同形**、封的是**直接调用与登出竞态窗**（`isAuthenticated` 翻假而 `user` 尚未清空的那一帧）。
⇒ 本项**未提供变异判负**（不编一个「改了就红」的读数）；如需强判负，需把闸改到被无条件调用的 effect 上 —— 那会改动 `ProfilePage` 的取数时机，超出本单授权面。

## §5 既有债登记（只登记、不改）

### §5.1 类级门基线：3 条存量命中（R-4① · 逐条登记、本单未改）

| # | 位置 | 形态（命中行逐字） | 登记理由 |
|---|---|---|---|
| 1 | `frontend/src/pages/TaskPage.jsx:25` | `throw new Error(data?.message \|\| fallback)` | 页面**模块级** `fetchJson`（`:20-26`，**2 处**调用点共用：`:78 / :97`）自造错误串，未过 `apiErrorMessage` ⇒ 401/503 同样是服务端原文 |
| 2 | `frontend/src/components/ActiveTaskModal.jsx:77` | `toast.error(t('error') + ': ' + (data.message \|\| t('activeTaskModal.submitFailed')))` | `response.json()` 原文**直拼**用户文案（`:70` 受体） |
| 3 | `frontend/src/components/ClaimRewardModal.jsx:25` | `toast.error(t('error') + ': ' + ((data && (data.error \|\| data.message)) \|\| t('claimRewardModal.loadProgressFailed')))` | 同上 + `data.error` 可能是**对象**（`[object Object]` 面） |

⇒ 存量修复**不在本单**（R-4① 明令「不要求一次清完」）；本单硬口径 = 「**未登记命中 0**」，现取读数 = `未登记命中 0 / 命中 3（全部登记）`。

### §5.2 「原始响应包受体」全量清点（6 个）—— 门的判别力读数

| 受体 | 位置 | `.message` 命中 | 说明 |
|---|---|---|---|
| `payload` | `src/auth.js:191` | 2 处（`:149 / :181`） | **出口本体豁免**：链实现按定义必须读原始包 |
| `payload` | `src/ledger-api.js:46` | **0** | **本单面**：修好后原始包只用于 `payload.success / data / next_before_txid` + 交给 `apiErrorMessage` ⇒ 零命中 |
| `data` | `src/components/Header.jsx:73` | **0** | 只读 `data.success / data.data.points` ⇒ **零命中**（证明本门不是「凡 `response.json()` 就报」的滥扫） |
| `data` | `src/pages/TaskPage.jsx:21` | 1 处（§5.1 #1） | 存量 |
| `data` | `src/components/ActiveTaskModal.jsx:70` | 1 处（§5.1 #2） | 存量 |
| `data` | `src/components/ClaimRewardModal.jsx:21` | 1 处（§5.1 #3） | 存量 |

### §5.3 `tsc -p tsconfig.scripts.json` 既有债：**22 文件 / 77 条**（R-3② · 只登记不改）

**错误码分布（现取）**：`TS2339×21 · TS18046×16 · TS2322×15 · TS2352×11 · TS2345×4 · TS2367×2 · TS18047×2 · TS2724×1 · TS2559×1 · TS2551×1 · TS2363×1 · TS2362×1 · TS2353×1`（Σ=77）

**逐文件计数（现取，`grep -oE '^scripts/[^(]+' … | sort | uniq -c | sort -rn`）**：

```
24  scripts/p4z-audjk-01-probe.ts          4  scripts/p4z-05-keys-b1c.ts        1  scripts/qa-p1e-05-neon-ab.ts
11  scripts/p4z-b2ahttp-03-e2e.ts         3  scripts/p4z-b2c-02-probe.ts      1  scripts/qa-p1b-01-setup.ts
 6  scripts/p4z-08-keys-b1d.ts            3  scripts/p4z-b2b-01-patch.ts      1  scripts/p4z-d1p-04-sweep-negative-arm.ts
 4  scripts/qa-p1e-01-concurrency.ts      3  scripts/p4z-a1li-01-e2e.ts       1  scripts/p4z-b3c-02-e2e.ts
                                          3  scripts/p4z-a1cap-01-e2e.ts     1  scripts/p4z-03-keys.ts
                                          2  scripts/p4z-d1p-01-classifier-unit.ts   1  scripts/p3w-00-fold-narrow-verify.ts
                                          2  scripts/p4z-b2b-02-listing.ts   1  scripts/p3s1-00-db-state.ts
                                          2  scripts/p4z-b2a-01-fixture.ts   1  scripts/p3l-00-post.ts
                                                                           1  scripts/p2x-00-idempotency-replay-order.ts
                                                                           1  scripts/p1f-02-f2-malformed.ts
```

**门本体缺口（发现二的结构性原因）**：`backend-ts/tsconfig.json` 的 `include` 只有 `src/**` ⇒ **`npm run build`（`tsc`）根本不看 `scripts/**`**；脚本面唯一可用的类型门是 `tsc -p tsconfig.scripts.json`，而它此前从不进任何硬门 ⇒ 本单新增探针 9 条 `TS18046` 才得以「悄悄入库」。

**R-3③ 提议条文（可直接落 spec · 由 **Jing** 下轮落，本单**只登记**）**：

```text
· 新增/改动脚本的 TypeScript 纪律
  ① 脚本面的类型门**单列**：`npx tsc -p tsconfig.scripts.json --noEmit`
     （`backend-ts/tsconfig.json#include = ["src/**"]` ⇒ `npm run build` 不覆盖 `scripts/**`）。
  ② 判据 = **本单新增/改动的脚本文件「新增错数 = 0」**，**不得**写成「全量零错」：
     存量错数（现取基线 22 文件 / 77 条）只登记、不要求一次清完；数量变化必须给**前后对照读数**。
  ③ 与既有「等量下移 + 原因注释 + 留痕」同源：必须放宽类型时（如 `Record<string, any>`），
     在该处写「原因 + 影响面 + 取代代价」，并在交付报告登记。
```

### §5.4 「两套取数入口并存」登记（R-1 d）

| 入口 | 语义 | 现状 | 处置 |
|---|---|---|---|
| `auth.fetchApiJson` | 只回 `payload.data`；错误面走 `apiErrorMessage` | 全站主入口 | **本单未改其契约**（R-1 选路径②） |
| `ledger-api.fetchMyLedger` | 直读原始响应（需顶层 `next_before_txid`）；错误/登录面**逐字对齐** `fetchApiJson` | 批 7-A 新增 | **登记** ⇒ 待 P6/P7 统一取数入口时合并（合并方式：给 `fetchApiJson` 加「保留顶层键」的选项，届时本层可删） |
| `pages/TaskPage.jsx` `fetchJson`（模块级） | 同上「只回 `data`」但**错误面绕过链** | 存量（§5.1 #1） | 登记，随 P6/P7 统一 |

### §5.5 类级教训登记：工厂式 `vi.mock` 漏键（本单实红采到）

`vi.mock('<path>', () => ({ …手写键集… }))` 会**静默漏掉**真模块的新导出；消费者新增具名导入后替身侧得到 `undefined` ⇒ 调用即 `TypeError`，
而页面普遍 `catch (e) { setState({ message: String(e?.message) }) }` ⇒ **错误被吞成「取数失败」**，表现为「请求数 0」这类**指向产生者、不指向替身**的假红（本单 `listing-market.test.jsx` 首跑即此形）。
⇒ 规约：替身用 `async (importOriginal) => ({ ...(await importOriginal()), <只桩要桩的键> })`，并显式声明「其余真值来自 `importOriginal`」。本单已按此修 `ledger-flow-behavior.test.jsx` + `listing-market.test.jsx` 两处（§2-C）。

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因（逐字） |
|---|---|---|
| `p7a-01-http.ts` / `p7a-02-negctl.ts` **HTTP 探针重跑** | `NOT_MEASURED` | 本单**不动后端**、不动读口行为（`git diff --stat -- backend-ts/src` = 空）⇒ 探针判据面无变化；且跑探针需起实例（5793 已被**并行质检方**占用）。R-3① 只要求**类型面**零新增错 ⇒ **不给读数**（不填 0）。 |
| `tsc -p tsconfig.scripts.json` **全量零错** | **未做**（授权外） | 22 文件 / 77 条既有债；R-3② 明令「只登记不改」；本单判据 = 本单新增/改动面零错（§3 G2）。 |
| 「两套取数入口」合并 | **未做** | R-1 d 明令**登记**、待 P6/P7 统一时合并（§5.4）。 |
| R-3③ 纪律**入 spec** | **未做**（授权外） | 由 **Jing** 下轮落；本单未触碰任何 `docs/*.spec.md`（硬口径 ③）。条文已备于 §5.3。 |
| §5.1 三条存量命中的**修复** | **未做** | R-4① 明令「不要求一次清完」；本单只登记 + 门判「未登记命中 0」。 |
| 前端 `npm run type-check`（`tsc --noEmit`） | **N-A（不可测）** | **本单现取复验**：`ls frontend/tsconfig*.json` ⇒ `No such file or directory` ⇒ 该脚本**无 tsconfig 可依**。非「跑失败」，是「**无可测对象**」。 |
| 浏览器级 E2E（Playwright `test:e2e`） | `NOT_MEASURED` | 本单硬门口径不含 e2e（需 dev server + 浏览器 + 登录态）；**未跑**，故**不给读数**。 |
| 真实 401/503 服务端响应体的**联测复验** | `NOT_MEASURED` | 本单未跑 HTTP 探针（见上行）；单测替身的 `R107` 形状逐字照抄上一轮实测（`error_keys=[code,message,i18n_key,details]`），**是替身读数、非联测读数**。 |
| 门的**形态覆盖边界** | **未覆盖（登记）** | `p7a-03` 只判「原始包 `.message` 直用」；`X.error` 裸读 / `X.error.code` 作「**残余发现**」打印（现取命中 **0**）；硬编码英文/服务端串当展示文案**不在本门**（另有 `p4z-i18nviol-global.mjs` 覆盖源侧文案面）。 |
| `MarketPage` 登录闸 | **已具备（非未做）** | `market/MarketPage.jsx:118-121` 本就有闸；R-2 是**统一口径**（把 `ProfilePage` 对齐过去），非新增要求。 |

## §7 自曝

1. **首跑 `test:unit` 实红（1 failed / 249 passed）**：`listing-market.test.jsx` 的替身同样缺 `getAuthToken` ⇒ 真前置抛 `TypeError` ⇒ 被页面 catch 吞掉 ⇒ 该用例的「账本读口确有请求」断言得 0。**这是我改动的直接副作用**，已同形修好并复跑全绿（28 files / 250 passed）；教训入 §5.5。**未**把这条红藏起来。
2. **用例 ⑦ 判别力边界（不夸大）**：⑦ **不区分** `ProfilePage.loadLedger` 新增闸的有无（理由见 §4.4）；它钉的是用户可见口径。**未**为它编造变异判负。
3. **`type Reading = Record<string, any>`（R-3①）是一次「放宽」**：把 `unknown` 放宽到 `any` 换 9 处零改。代价逐字：若日后有人把 `R` 当**类型真源**用，本处 `any` 会放过错误。已在该处注释写明「探针内的动态读数登记、无下游类型面」。**不称其为「零代价」**。
4. **`apiErrorMessage` 链的「服务端原文回退」是有意的**：未登记 `i18n_key` 且无映射键时，链**保留服务端原文**（如 `auth.test.js` B14③ 的 `database is unreachable`）—— 本单不对该行为做任何改动，故「四语文案」的真实边界是「*有* `i18n_key` / *有* 映射键」；判负单测 ③（503）正是**无** `i18n_key` 的情形 ⇒ 只断言「同链产出 + 保留 `details.reason` + 非 code 原文」，**不**断言四语。
5. **本单未验证「gate 在别人并发改写 `src/**` 时的稳定性」**：`p7a-03` 基线键含**整行原文** ⇒ 那 3 行被他人重排/改写时会**判红**（fail-closed，是设计选择），但**未**实测该场景；判红时输出会给出可直接粘贴的新键。
6. **端口现场的归属判断**：5793 的 `PID 17864` 判为「并行质检方」，依据 = 命令行落在 `scratch/qa-p7a-09362ad/`（**非** `bistro/seafood`）且有 `.p7aqa-artifacts/` 路径。这是**命令行证据推断**，非与对方核对过的确认；本单**未触碰**该进程。

---

### 附：本单产物路径（原始输出**无 `.log` 后缀**）

- 硬门读数：`backend-ts/.p7a-artifacts/P7A-GATES-002/`
  （`tsc-backend.txt` / `tsc-scripts-before.txt` / `tsc-scripts-after.txt` / `offline.txt` / `build.txt` / `test-unit.txt` / `gate-p4z-i18nviol-global.txt` / `gate-p6-tr2-i18n-locales.txt` / `gate-p4z-miscfix-links.txt` / `gate-p4z-feperf-safelist.txt` / `gate-p7a-03-errmessage-gate.txt`）
- 离线门副产物（脚本自产）：`backend-ts/.p4-artifacts/p6tr1a-20261002T071703Z/offline-tests.json`
- 判负自证工作区（**仓外**）：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p7a-r4/`
  （`negctl-sha.txt` / `negctl-test-RED.txt` / `negctl-test-GREEN.txt` / `negctl-login-RED.txt` / `negctl-login-GREEN.txt` / `gate-negctl-RED.txt` / `gate-negctl-GREEN.txt` / `gatemirror/` / `ledger-api.PRISTINE.js` / `ledger-api.PRISTINE2.js`）
- 代码/文档交付：`frontend/src/ledger-api.js`、`frontend/src/auth.js`、`frontend/src/pages/ProfilePage.jsx`、`backend-ts/scripts/p7a-01-http.ts`、`frontend/scripts/p7a-03-errmessage-gate.mjs`、`frontend/src/test/unit/p7a-ledger-error-i18n.test.js`、`frontend/src/test/unit/ledger-flow-behavior.test.jsx`、`frontend/src/test/unit/listing-market.test.jsx`、`docs/audit/p7-a-ledger-read-fix.md`
- **库侧残留**：本单**零 DB 写**（未跑任何 SQL / 未建表 / 未插行）⇒ 无 uid ≥900000 测试数据、无残留（探针未运行）。
