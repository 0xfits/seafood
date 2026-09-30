# P4-B4b-i · 前端兼容性同步（Kong）

- **run tag**：`b4b-20260930T203125+0800`（`backend-ts/.p4-artifacts/B4B_RUN_TAG.txt`）
- **权威清单**：`docs/route-layer.spec.md` **v0.9**（1554 行）**§2.4 `S1`–`S10`** + **§9.B `B1`–`B13`**；逐条口径源另取 §1.3 / §2.2 / §3.1 / §3.3 / §3.4 / §4.5 / §5.1–§5.5。
- **边界**：只写 `frontend/**` + 本报告 + `backend-ts/.p4-artifacts/**`。**未动** `backend-ts/src/**`（只读引用）、`migrations/**`、任何 spec。**无 UX/布局改造**（只做兼容性同步；所有删除均扣在 §2.4 S5「页面只读化」上）。
- **口径**：标「实测」的读数 = 本机真实执行，可 `grep` 到（§5.7 ⑦）；凡未跑 = `NOT_MEASURED`（**不填 0/空**，见 §6）。

---

## §0 基线读数（改动前 = 判负基准）

| 项 | 命令（退出码**不取自管道**） | 基线退出码 | 读数 |
|---|---|--:|---|
| build | `cd frontend && npm run build` | **0** | 1756 modules transformed / `✓ built in 1.54s` / `dist/assets/index-DrJRFa44.js 423.04 kB` |
| 单测 | `cd frontend && npx vitest run src/test/unit` | **0** | Test Files **9 passed** / Tests **61 passed** |
| lint | `cd frontend && npx eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0` | **2** | **前置缺陷**：`ESLint couldn't find a configuration file`；`ls -a \| grep -i eslint` = 空 ⇒ `frontend/` 无 eslint 配置 ⇒ **本单 lint 读数不可用**（§6-1） |
| 产物 JWT 面 | `grep -c 'eyJ' -r frontend/dist/` | 1（无匹配） | 每文件 **0** |

**基线环境事实（实测，影响探针口径）**：`lsof -nP -iTCP:5787 -sTCP:LISTEN` ⇒ **PID 91805 已在监听（他会话的 vite，IPv6 `[::1]:5787`）** ⇒ 本单**不碰该进程**，自起在 **5797**；`lsof -nP -iTCP:5788` ⇒ **无监听**（后端当时未起）⇒ 必验②需自起后端（只读面 `GET /api/home`）。

---

## §1 清单落盘（先落盘、后动码 · §2.4 `S1`–`S10` / §9.B `B1`–`B13`）

| # | 项 | 真源锚点 | 行动（本单实际） | 验收判据 | 状态 |
|--:|---|---|---|---|---|
| **B1** | `ops:` 4 写口补幂等键（S1） | §2.4 S1；`admin/SystemSettings.jsx:85`、`admin/PermissionsManagement.jsx:133`/`:176`、`admin/UsersManagement.jsx:103` | 四写口补 `body.create_key = adminOpsKey(...)`（**`ops:` 前缀**） | 无键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`；带键 ⇒ 过闸 | **已落码**（键形状实测合规，§4-5）；`400` 侧 `NOT_MEASURED`（§6-2） |
| **B2** | `R107` 401/403 形状（S2） | §2.4 S2；`auth.js:105` | `auth.js` 新增 `extractApiErrorMessage`/`apiErrorMessage`；`fetchApiJson` 改走之（**读 `error.code/message/details.reason`**，按 `i18n_key` 四语解析） | 401/403 文案不再出现 `[object Object]` | **已落码 + 单测**（§4-2，新增 401 用例断言 `not.toContain('[object Object]')`） |
| **B3** | 四语 locale（S3） | §2.4 S3；`locales/{zh,en,hk,vn}.json` | 各加 **2 键** `auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`（**嵌套对象** = i18next 默认 `keySeparator:'.'` 下的正典形态，`t('auth.err.AUTH_FORBIDDEN')` 可解析） | 四文件各 2 键、键名逐字一致 | **已落码**（实测 4 文件 `:72`/`:73` 同名同数，§4-4） |
| **B4** | `DELETE /api/order` 入参改 query（S4） | §2.4 S4；`ShardPage.jsx:328-332`；§7-5 | 全撤调用**删 body + 删 Content-Type**，只留 `method:'DELETE'`（后端只读 `req.query`） | 全撤 `200` + `hold_release ×2` | **已落码**（`ShardPage.jsx:343-350`）；`hold_release ×2` = 后端资金面 ⇒ `NOT_MEASURED`（§6-3） |
| **B5** | `410` 面 UI 分支下线（只读化）（S5） | §2.4 S5；`RewardPage.jsx:196,217`；`admin/TasksManagement.jsx:130,140,177`；`admin/RewardsManagement.jsx:154,164,201`；`admin/SystemSettings.jsx:123` | 删写按钮/写分支（**不整页删**） | 上述面**前端零调用** | **已落码**；`grep` 实测：这些路径的命中**只剩注释**（§4-6） |
| **B6** | 单测断言同步（S6） | §2.4 S6；`test/unit/auth.test.js:75` | 旧断言（`{success:false,message}` = 批 2 前形状）**保留为 legacy 用例**并新增两条 `R107` 用例（401 对象面 / 410 `sunset` 面） | 单测**全绿** | **已落码**：9 文件 **63** 通过（基线 61 ⇒ +2） |
| **B7** | 键集冻结（S7） | §2.4 S7；§2 母约束 F1 | 落码期间**不消费任何新增响应键**：`grep -rn idempotent_replay src/` ⇒ **0 命中**（唯一允许的新增键亦未消费） | 23 文件 × 键集对拍 | **部分**：定点核查 ✓；**全量逐键对拍 `NOT_MEASURED`**（§6-4） |
| **B8** | `/api/user` 新形状迁移（S8） | §2.4 S8；`auth.js:142`、`Header.jsx:71` | **未做**：迁移目标 `GET /api/user/points` **尚未注册**（`grep -n "user/points" backend-ts/src/index.ts` = **0 命中**）⇒ §5.4 第 3 阶段前置未满足 | 两处消费点键集与新端点一致 | **前置未满足**（§6-5） |
| **B9** | 「依赖旧 `400`」回归核（S9） | §2.4 S9；§7-27；`DashboardPage.jsx:223-236` | 全量扫（grep + 通读 `DashboardPage.jsx:223-236`） | 无按 `400` 文案/状态分支的依赖 | **实测无依赖**（§5-2） |
| **B10** | 2a 写口补 `create_key`（条件触发）（S10） | §2.4 S10；`ActiveTaskModal.jsx:50-59`；真源 `src/job-service.ts:133` | **不改**（条件未触发；见 §6-8 口径分歧登记） | 现行为 = 设计内幂等 | **已按权威清单执行**（依据逐字见 §6-8） |
| **B11** | `POST /api/order` 补 `create_key`（`S-b3e-1`） | §9.B B11；`p4-b3e-market-funds.md:31,64`；`ShardPage.jsx:176` | 补 `create_key`（`cli:<uuid>`），**且同一次操作重试复用同一个键** | 补键 ⇒ `200`；重试同键 | **已落码**（`ShardPage.jsx:161,181-192`）；键语义实测见 §4-5；`200+hold×2` `NOT_MEASURED`（§6-3） |
| **B12** | `DELETE /api/order` body 式全撤（`S-b3e-2`） | §9.B B12；`p4-b3e-market-funds.md:31`；§2.4 S4 | 与 B4 同一件事（两锚点） | 同 B4 | **已落码**（同 B4） |
| **B13** | `POST /api/order` 成功面键集已变（`S-b3e-3`） | §9.B B13；`p4-b3e-market-funds.md:31,159` | 登记 + 核前端消费点 | **逐键对拍**（不得以「风险低」结案） | **已登记 + 定点核**（§5-1） |

**§2.4 `S1`–`S10` 对照**：S1→B1；S2→B2；S3→B3；S4→B4/B12；S5→B5；S6→B6；S7→B7；S8→B8；S9→B9；S10→B10。**S1/S2/S3 三条 v0.1 未列项**（§2.4 表注）均已落码。

**母单追加项对照**：①「先落盘清单」= 本节 + 本报告骨架先写（`docs/audit/p4-b4b-frontend-sync.md` 首版即含本表）；②`R107` = B2；③幂等键 = B1/B11（**ActiveTaskModal 面见 §6-8**）；④已弃用面 = §3；⑤成功面键集分别适配 = §5；⑥四语 = B3；⑦两条行为 delta = §5-2。

---

## §2 逐项施工与证据（`文件:行号`）

### B2/S2 — `R107` 形状（`frontend/src/auth.js`）

| 位置 | 内容 |
|---|---|
| `auth.js:108-110` | `errorCodeOf(payload)`（`R107` 码的机读入口） |
| `auth.js:112-123` | `extractApiErrorMessage`：**对象面**取 `error.message` → 回退 `error.code` → `details.reason` 附括号；**字符串面**保持旧 `sendError` 形状（该形状仍活着：例 `index.ts:830` `sendError(res,400,'Invalid bID')`）；裸状态码兜底 `请求失败 (<status>)` |
| `auth.js:126-141` | `resolveI18nMessage`：按 `error.i18n_key` 解析四语（**动态 `import('./i18n')`** —— 只在错误路径求值，避免把 `i18n.js` 拖进 `auth.js` 的静态图而与既有 `vi.mock('react-i18next')` 用例打架）；不可用 ⇒ **回落服务端 `message`**（绝不回落 `[object Object]`） |
| `auth.js:143-145` | `apiErrorMessage`（可单测总入口） |
| `auth.js:147-155` | `fetchApiJson` 错误分支改 `throw new Error(await apiErrorMessage(...))` |

**判负对照**：旧行 `const message = payload?.message || payload?.error || ...` 在 `R107` 下 `payload.error` 是对象 ⇒ `String(对象)` = `[object Object]`；新实现对此有专门负例断言（`test/unit/auth.test.js:81-101`）。

### B3/S3 — 四语 locale（实测：每文件 2 键、键名逐字一致）

| 文件 | 行 | 键 |
|---|---|---|
| `locales/zh.json` | `:70-75`（键在 `:72`/`:73`） | `auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN` |
| `locales/en.json` | 同上 | 同键名 |
| `locales/hk.json` | 同上 | 同键名 |
| `locales/vn.json` | 同上 | 同键名 |

### B1/S1 — `ops:` 强校验四写口

| 文件:行 | 写口 | 键（实测串，见 §4-5） |
|---|---|---|
| `admin/SystemSettings.jsx:96` | `POST /api/admin/settings` | `ops:<admin_uid>:setting:system_settings` |
| `admin/PermissionsManagement.jsx:146` | `POST /api/admin/permissions/save` | `ops:<admin_uid>:permission_save:<id\|new>` |
| `admin/PermissionsManagement.jsx:188` | `POST /api/admin/permissions/delete` | `ops:<admin_uid>:permission_delete:<id>` |
| `admin/UsersManagement.jsx:113` | `POST /api/admin/user/update` | `ops:<admin_uid>:user_update:<target_uid>` |

- 载具 = 新增 `frontend/src/idempotency.js`（`adminOpsKey`），**形态与服务端 `canonicalAdminOpsKey` 逐字同形**（真源 `backend-ts/src/admin-service.ts:43-44` = `` `${prefix}${actorUid}:${action}:${businessId}` ``；实测 `ops_key_matches_canonical_shape: true`，§4-5）。
- 服务端只校验「有键 + `ops:` 前缀 + 无 `#` + 无控制字符 + ≤200」（`admin-service.ts:59-85`）⇒ 本键**确定性**（同一操作 ⇒ 同一键）⇒ 重试不引入新语义，符合 §4.5 加注「请求侧强校验、不落库」。

### B11/S-b3e-1 — `POST /api/order` 的 `create_key`（`pages/ShardPage.jsx`）

| 位置 | 内容 |
|---|---|
| `ShardPage.jsx:11` | `import { createIdempotencyKeyTracker } from '../idempotency'` |
| `ShardPage.jsx:158-161` | `const idempotencyRef = useRef(createIdempotencyKeyTracker('cli'))` |
| `ShardPage.jsx:181-192` | `const payload = {bID,side,price,volume}`；`const createKey = idempotencyRef.current.keyFor(JSON.stringify(payload))`；`body: JSON.stringify({ ...payload, create_key: createKey })`；**成功后 `reset()`** |

**「同一次操作重试 ⇒ 同一个键」的实测**（§4-5）：`retry_same_key:true`；`changed_content_new_key:true`（用户改了内容 = 新实体 ⇒ 新键，符合 §4.5 v0.6「契约 2 异标识 ⇒ 落新行」）；`reset_gives_new_key:true`（上一单成功后下一次 = 新实体）。若不如此，重试会变成第二笔订单 —— 正是本项要防的。

### B4/B12/S4 — `DELETE /api/order` 改 query（`pages/ShardPage.jsx:343-350`）

- 旧（原 `:328-332`）：`headers:{...getAuthHeaders(user),'Content-Type':'application/json'}, body: JSON.stringify({})` ⇒ **已删**。
- 新：`fetchApiJson('/api/order', { method:'DELETE', headers: getAuthHeaders(user) })`。
- 后端真源（只读引用）：`backend-ts/src/index.ts:777`「入参一律走 query、不得读 body」+ `:787` `query: (req.query || {})`；响应 `cancelled` 键**保留**（`ShardPage.jsx:351` 仍读 `res?.cancelled`；后端 `market-service.ts:423-430` 仍返回）。
- 未被本项触及：单撤 `DELETE /api/order/${oID}`（`ShardPage.jsx:326-331`，无 body，形状未变）。

### B5/S5 — `410` 面只读化（逐文件）

| 文件 | 处置 | 关键行 |
|---|---|---|
| `pages/RewardPage.jsx` | 删 `handleRedeem`（原 `:196` `/api/shard/redeem`）+ `handleOpenChest`（原 `:217` `/api/chest/:bID/open`）+ 两段 UI 分支（宝箱按钮 / 「兑换奖品 (1000 碎片)」按钮）+ 状态 `openingChestId`；`renderRewardActions` → 占位 `() => null`（三处调用点 `:416`/`:441`/`:466` 不动 ⇒ **无 UX 改造**） | `:193-199` |
| `admin/TasksManagement.jsx` | 删 `saveTask`（含 `admin/task/update`+`admin/task/create`）与 `deleteTask`（`admin/task/delete`）；删「添加任务」「编辑」「删除」「保存任务」四个按钮；`isReadonlyModal = true`；页头文案改只读 | `:100-108`、`:123`、`:151`、`:244`、`:112-116` |
| `admin/RewardsManagement.jsx` | 删 `admin/prize/update|create`（saveReward 内）与 `admin/prize/delete`（deleteReward 内）两条调用与其 toast；删「发布奖品」「编辑」「删除」「保存奖品」四个按钮；页头文案改只读 | `:153-154`、`:184-185`、`:213`、`:251`、`:440`、`:204-205` |
| `admin/SystemSettings.jsx` | 删 `resetSettings`（`admin/settings/reset`）与「重置」按钮；页头文案改口径 | `:115-119`、`:143`、`:136-138` |

**判负读数（B5 判据 = 前端零调用）**：`grep -rn "shard/redeem|chest/.*open|admin/task/|admin/prize/|settings/reset|auth/register|auth/login|assets/init" frontend/src` ⇒ 命中**全部为注释**，唯一代码面命中在 `test/unit/auth.test.js`（`/api/auth/register` = §2.3 **明文登记的测试专用**命中）⇒ **业务代码零调用**（§4-6）。

---

## §3 已弃用面逐页处置（母单必做④ · §1.3 / §5.1 / §5.5）

**前端侧需清零的 `410`/待删面 = 11 条端点**（逐条下）；§5.1 台账记「13 面」—— 差额为两个**读口过渡面**（`GET /api/shard`、`/api/shard/transfer`，现为 `200` 空态非 `410`）与 `auth/login`（§5.1 记「待批 4 改 410」）。**口径差异登记，本单不裁定**。

| # | 面 | 端点 | 现状 | 前端处置（`文件:行号`） | 依据 |
|--:|---|---|---|---|---|
| 1 | 碎片写口① | `POST /api/shard/redeem` | `410`+`R107`+`sunset` | **删调用 + 删 UI 分支**：`RewardPage.jsx:193-199`（原 `:196`/`:250-258`） | §5.1 该行「删除该按钮/分支」；§9.B B5 |
| 2 | 宝箱写口 | `POST /api/chest/:bID/open` | `410`+`R107`+`sunset` | **删调用 + 删 UI 分支**：`RewardPage.jsx:193-199`（原 `:217`/`:232-247`） | 同上 |
| 3-5 | 后台发布招工 ×3 | `POST /api/admin/task/{create,update,delete}` | `410`（**已撤守卫**） | **页面只读化**：`admin/TasksManagement.jsx:100-108,123,151,244` | §5.1「页面只读化（删三个写按钮）」 |
| 6-8 | 后台发布商品 ×3 | `POST /api/admin/prize/{create,update,delete}` | `410` | **页面只读化**：`admin/RewardsManagement.jsx:153-154,184-185,213,251,440` | §5.1（C3 ① 终审「整体删除」） |
| 9 | 一键重置设置 | `POST /api/admin/settings/reset` | `410` | **删按钮 + 删调用**：`admin/SystemSettings.jsx:115-119,143` | §5.1（C3 ②「删除」） |
| 10 | 资产初始化 | `POST /api/admin/assets/init` | `410` | **前端 0 处**（原本无消费） | §5.1 该行「0 处」 |
| 11 | 注册残件 | `POST /api/auth/register` | `410`（形状待批 4 对齐） | **仅测试**：断言已按 `R107` 形状同步（`test/unit/auth.test.js:68-124`） | §2.3 登记 = §2.4 S6 |
| 12 | 登录别名 | `POST /api/auth/login` | 转发 verify（待批 4） | **前端 0 命中**（实测） | §5.1 该行「0 处」 |
| 13 | 碎片读口① | `GET /api/shard` | `200` 空数组 + 顶层 `deprecated:true` | **保留调用、不迁**：`ProfilePage.jsx:92`、`RewardPage.jsx:58`、`ShardPage.jsx:316` + 就地登记注释 `ShardPage.jsx:312-315` | §5.1 该行明写「保留路径 + 保持空态；**读口不返回错**」 |
| 14 | 碎片读口② | `GET /api/shard/transfer` | `200` 空数组 + `deprecated` | **保留调用、不迁**：`ShardPage.jsx:318` | 同上 |
| 15 | `ShardPage` 整页 | 混合面 | — | **不删页**（`App.jsx:70` 路由 `shard` 在册；「市场/交易」tab 消费的是**活口** `/api/market/:bID/{orderbook,trades}`、`POST /api/order`、`DELETE /api/order/:oID`）⇒ 只做 B4/B11/B12 同步 | §5.1 仅把**碎片读/写口**列为弃用面，未列市场面 |

**读口① ②为何不迁（可复核）**：§5.1 的迁移目标 = `GET /api/user/points` / `GET /api/user/ledger?kind=transfer`；实测 `grep -n "user/points\|user/ledger" backend-ts/src/index.ts` = **0 命中** ⇒ 端点**不存在** ⇒ 迁移会立刻 404（比现状更坏）⇒ §5.1 的迁移前置（§5.4 第 3 阶段「规范读口已上线」）**未满足**，本单**按现状保留**并登记（就地点在 `ShardPage.jsx:312-315`）。

**§5.5 `sunset` 值面**：13 面的 `details.sunset` **属后端响应体**（§5.5 硬化 5「本册不改任何代码（`410` 面的响应体修改属实现方，归批 4 = §9 施工清单 E 栏）」）⇒ **本单只登记、不改**（E3 面）。本单现取读数：`backend-ts/src/index.ts:911` 的 `ADMIN_SETTINGS_RESET_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）'` ⇒ **含「未决」字样** ⇒ §5.5 判据 ② **不成立**（E3 的判负项，转交后端/E 栏实现方；本单**无写权**）。

---

## §4 必验读数（实测 · 退出码不取自管道）

| # | 项 | 命令 | 退出码 | 读数 |
|--:|---|---|--:|---|
| 1 | **build（红线）** | `cd frontend && npm run build` | **0** | 1756 modules / `✓ built in 1.53s` / `dist/assets/index-CykTcdA6.js 419.95 kB`（基线 423.04 kB；`rm -rf dist` 后重建） |
| 2 | 单测 | `cd frontend && npx vitest run src/test/unit` | **0** | Test Files **9 passed** / Tests **63 passed**（基线 61 ⇒ +2 新例） |
| 3 | lint | `cd frontend && npx eslint …` | **2** | **前置缺陷**（无配置文件）；**基线同码** ⇒ 非本单引入；本单不新增配置（超边界） |
| 4 | 产物 JWT 面 | `grep -c 'eyJ' -r frontend/dist/` | 1 | **每个文件 0**（`grep -c` 逐文件输出 0；退出 1 = 无匹配）⇒ 与判据「产物内 **0**」一致 |
| 5 | 幂等键语义探针 | `node .p4-artifacts/<run>/probe-idempotency-keys.mjs` | **0** | `new_key_sample.key="cli:1a0f2587345-8192a2e1"`（`has_allowed_prefix:true`/`has_reserved_separator:false`/`has_control_char:false`）；`ops_key_sample.key="ops:7:setting:system_settings"`、`ops_key_matches_canonical_shape:true`；`sanitize_reserved_separator:"ops:1:permission_save:a-b"`；`retry_same_key:true`；`changed_content_new_key:true`；`reset_gives_new_key:true` |
| 6 | 开发服务器 + 后端连通（必验②） | `node .p4-artifacts/<run>/probe-dev-proxy.mjs` | **0** | `backend_direct_api_home` = **200**（`waited_ms:29756`，日志 `TypeScript backend running on port 5788`）；`vite_dev_server_root` = **200**（`waited_ms:31`，`VITE v5.4.20 ready`）；`vite_proxy_api_home` = **200**（`bytes:9248`，体首 `{"success":true,"message":"OK","data":{"tasks":[{"tID":2,…`）；重跑（修探针后）：三步全 200 + `orphans_killed_sigkill: []`、children `signal:"SIGTERM"` |
| 7 | 前端零调用（B5 判据） | `grep -rn "shard/redeem\|chest/.*open\|admin/task/\|admin/prize/\|settings/reset\|auth/register\|auth/login\|assets/init" frontend/src` | 0（有命中，均注释） | 业务代码 **0 条调用**；唯一代码面命中 = `test/unit/auth.test.js`（§2.3 登记的测试专用） |
| 8 | `S7/B7` 新增键未消费 | `grep -rn "idempotent_replay" frontend/src` | 1 | **0 命中**（连唯一允许的新增顶层键亦未消费） |
| 9 | 前端消费面文件数 | `grep -rl "/api/" frontend/src \| wc -l` | 0 | **24** = 既有 **23**（与 §2.2 一致）+ **本单新增** `src/idempotency.js`（命中为注释中的 `/api/order`） |
| 10 | A5 新面（15 键）前端消费 | `grep -rn "/api/job\|/api/listing\|referral\|user/points\|user/ledger" frontend/src` | 0 | **2 命中，均为本单登记的注释**（`ShardPage.jsx:313-314`）⇒ **新面（`/api/job/*` 15 键 / 旧路径 11/9 键）前端零消费** ⇒ 不存在「一套假设吃两个面」的风险（母单必做⑤ **结构消解**） |

**必验② 收尾自证**：跑完即停 —— `lsof -nP -iTCP:5788 -sTCP:LISTEN` / `-iTCP:5797` 均 **无监听**（退出 1）；`ps` 复查无本单所起 `ts-node`/`vite` 残留。**全程未用 `pkill`/`killall`/`timeout`**（限时由 `node` 子进程自管 + `AbortController`）。

---

## §5 键集登记与行为 delta 复核

### 5.1 B13/`S-b3e-3` —— `POST /api/order` 成功面键集（**逐键对拍、不以「风险低」结案**）

- 前端消费点（唯一）：`ShardPage.jsx:186-192` —— `await fetchApiJson('/api/order', {…})` 的返回值**未被赋给任何变量** ⇒ **读取键数 = 0**（随后只 `reset()` + `toast.success('挂单成功')`）。
- 同族核对：`DELETE /api/order` 成功面（全撤）前端只读 **1 键** `cancelled`（`ShardPage.jsx:351`），后端显式保留（`market-service.ts:423`）；`DELETE /api/order/:oID`（单撤）前端**不读任何键**（`ShardPage.jsx:326-331`）。
- ⇒ **前端对 `POST /api/order` 的成功面键集（旧 `MarketOrderRecord` 12 键族 vs 新 view 键集）零依赖** ⇒ 键集变更**不构成前端回归面**（= 逐键对拍结论，非「风险低」推断）。**未测**：新 view 键集逐键清单（属后端 3e 报告 §3 `p4-b3e-market-funds.md:159`，本单无写权/无实测）⇒ `NOT_MEASURED`（§6-6）。
- 读口对比数字（同一对拍口径）：`GET /api/market/:bID/orderbook` 前端读 **3 键**（`side/price/volume`，`ShardPage.jsx:19-20`）；`GET /api/market/:bID/trades` 读 **4 键**（`trID/price/volume/time_created`，`ShardPage.jsx:109-113`）—— 两面**形状未变**（本单未动）。

### 5.2 B9 / C1 / C2 —— 两条行为 delta 的回归核（**全量扫凭证**）

| 项 | 结论（实测） | 凭证 |
|---|---|---|
| C1 非数字 `:jID` `400 → 404` | **前端无依赖** | ①`DashboardPage.jsx:223-236`（verify 的**唯一**真实调用点）成功走 `fetchApiJson`、失败一律 `toast.error('操作失败: ' + error.message)`（`:236`）⇒ **无按状态码/文案分支**；②`jID` 来自面板队列数据（`application_id`，数字）；③`grep -rn "Invalid jID\|invalid jID\|status === 400\|status == 400\|=== 400" frontend/src` ⇒ **0 命中** |
| C2 撤除 bespoke `400`（admin 提交不进面板队列） | **前端不可达** | 同上 grep **0 命中**；`grep -rn "application_already_exists\|job_application" frontend/src` ⇒ **0 命中**（无文案/码依赖） |
| 覆盖面自曝 | 我的 grep 模式是**我自选**的（旧 `400` 文案 + 状态码字面量 + 两个业务码）⇒ 不是「任何 400 依赖都必然命中」的完备判定 | §6-7 |

**成功面键集「按面分别适配」（母单必做⑤）**：本单实测前端对 **A5（`/api/job/:jobId/review`，15 键）** 与**旧路径（`/api/tasklist/:jID/verify`，11/9 键）** **均零消费**（§4-9：`/api/job` = 0 命中；verify 只读 `success` 布尔面，`DashboardPage.jsx:229-232` 不读 `data` 键）⇒ 不存在「一套假设吃两个面」的实际风险面（**结论 = 零消费**，非推断「应该没事」）。

### 5.3 四语 locale 的**消费**（S3 的延伸验证）

- 键由 `auth.js:126-141` 经 `i18n_key`（`auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`，真源 `backend-ts/src/job-service.ts:21-33` `ledgerErrorBody` 的 `i18n_key = ${domain}.err.${code}`、`domain='auth'`）解析；`t('auth.err.X')` 在 **i18next 默认 `keySeparator:'.'`**（`src/i18n.js:19-42` 未改 keySeparator）下按嵌套解析 ⇒ 四语生效。
- 401/403 文案面**实测已不退化**：`test/unit/auth.test.js:81-101` 断言 `not.toContain('[object Object]')` 且消息非空（vitest 通过）。

---

## §6 `NOT_MEASURED` + 探针自曝 + 口径分歧（禁填 0/空）

**NOT_MEASURED（未测项，禁止当 0/空使用）**

1. **`npm run lint` 的可用性** —— `frontend/` 无 eslint 配置（实测退出码 2，基线同码）⇒ **本单的 lint 读数不存在**（不是「lint 通过」）。修复属另一单（新增配置文件超出本单边界）。
2. **B1 的负例读数**「四写口不带键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`」—— 需管理员 token + 真库执行；本单只证**请求侧已带合规 `ops:` 键**（另：**撤销**该键是否真会 400 属后端既有事实，真源 `admin-service.ts:63-72`，本单未复跑）。
3. **B4/B11 的资金侧判据**（「全撤 `200` + `hold_release ×2`」/「补键后 `200` + `hold ×2`」）—— 需真资金执行（写库）⇒ **未跑**；本单只证**请求形状**（query 化 / `cli:` 键已带）。
4. **B7/S7 的「23 文件 × 键集全量对拍」** —— 本单只做**消费点定点核查**（§5.1/§5.2），未逐文件逐键对拍。
5. **B8 `/api/user` 新形状迁移** —— 前置未满足（`/api/user/points` 未注册）⇒ **未做**；`auth.js:142`/`Header.jsx:71` 保持旧面。
6. **B13 的新 view 键集逐键清单** —— 属后端 3e 面（`p4-b3e-market-funds.md:159`），本单**未实测**；前端零依赖已实测（§5.1）。
7. **C1/C2 全量扫的完备性** —— 见我自选 grep 模式的局限（§5.2 末行）：**不排除**存在其他形态的旧 `400` 依赖（如 `error.message.includes('Invalid')`、按中文 toast 文案判断等模式族）⇒ 覆盖**部分**。
8. **B10/S10 的「条件触发」判定** —— 依赖「前端是否需要同实体重复提交且内容已变」这一**产品意愿**；本单按现状（不需要）执行，产品若改判 ⇒ 需补 `cli:` 键（单点可改）。

**探针自曝（§5.7 ④ 读数异常先怀疑自己的探针）**

- **A. 首次探针的收尾有缺陷（真实缺陷，非读数问题）**：首跑用 `child.kill()` 打 `npx` **wrapper**，真正的 `node …/ts-node src/index.ts`（PID **2536**，监听 5788）与 `node …/vite --port 5797`（PID **2537**）被 init 收养（`PPID=1`）而存活。**处置**：按 **精确 PID** `kill 2536 2537`（**未用** `pkill`/`killall`）⇒ 复查两端口均无监听；并把探针改为 `detached:true` + `process.kill(-pid)` 打**进程组**。重跑读数 = `orphans_killed_sigkill: []`、children `signal:"SIGTERM"` ⇒ **无残留**。
- **B. 幂等键探针走了 fallback 分支**：`crypto.randomUUID` 在 **node 18.19** 不可用 ⇒ 读数中的样例键形如 `cli:1a0f2587345-8192a2e1`（`Date.now()+Math.random` 分支），**不是** uuid-v4；浏览器（安全上下文，含 `localhost`）走 `crypto.randomUUID` 分支。两者**都**满足 §4.5 的前缀/分隔符/控制字符判据（探针逐项打过）⇒ 键形态结论不受影响，但**样例字面**不可当作 uuid 证据。
- **C. 既有 5787 会话（PID 91805）被我识别为「他会话」并全程绕开**（自起 5797）——若该进程其实属本单的前序会话，则本单的「不常驻」判定仍成立（我未起 5787）。
- **D. 「23 文件」口径**：改动后 `grep -rl "/api/" frontend/src` = **24** = 既有 23 + 新增 `src/idempotency.js`（该文件命中 `/api/` 仅因注释里写了 `/api/order`）⇒ **不是**新增消费面。

**口径分歧登记（母单 vs 权威清单 · 待复核）**

- 母单必做③逐字要求「**至少**：`components/ActiveTaskModal.jsx:50` 的提交」补幂等键；**权威清单** §2.4 **S10** 与 §9.B **B10** 同为「**条件触发**」且 §9.B B10 的验收判据逐字 = 「条件未触发 ⇒ 现行为 = 设计内幂等（`200 idempotent_replay:true`）」；§4.5 v0.6 追加块「契约 3」判据 = **「有自然标识 ⇒ 派生；无自然键 ⇒ fail-loud」**，而 2a 提交的派生键 = `cli:p4b2a:submit:<identifier>:<worker_uid>:<hash>`（真源 `src/job-service.ts:133`）**已含实体自然标识**。
- **执行选择**：按权威清单**不改** `ActiveTaskModal.jsx:50-59`（保持 `body:{info_input}`）。**理由（判负级）**：该面**已有**服务端确定性派生键 ⇒ 重试本来就是 replay；若前端自造 `cli:<uuid>`，**同一操作的重试会因新键而落第二行 `job_submission`** —— 正是母单③想防的「变成新实体」。
- **证据（实测）**：`grep -rn "create_key\|createKey\|idempoten" frontend/src` ⇒ 现命中**全部为本单新增的 S1/B11 面**（`ShardPage.jsx` + 三个 admin 页 + `idempotency.js`），`ActiveTaskModal.jsx`/`ClaimRewardModal.jsx` **0 命中**（与 §2.4 S10 的「应用代码面 0 命中」现状一致）。
- **待办**：若 Kevin/Zang 仍要求 ActiveTaskModal 带键，须**同时**裁定「键的稳定性载体」（表单内容指纹）并接受「内容变更 ⇒ `409`」的既有契约（§4.5 v0.6 契约 2）—— 一句话即可落（单点改动：`ActiveTaskModal.jsx:50-59` + 复用 `idempotency.js`）。

**未越界自证**：`git status --porcelain` 的改动集合 = `frontend/**` + `docs/audit/p4-b4b-frontend-sync.md` + `backend-ts/.p4-artifacts/**`（无 `backend-ts/src/**`、无 `migrations/**`、无 spec、无 `docs/seafood.master-plan.md`、无 `.env.local`）；**未执行** `git add/commit/push`、`npm install`、`execute_code`；**未起常驻 server**。
