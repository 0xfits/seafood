# route-layer.spec **v0.9 → v1.0** 折入 delta（Jing · Specifier · 制度员）

> 单元：**Unit Jing-V1.0（规格折入）**｜日期：2026-09-30（CST）｜前身 = **v0.9**
> 本件 = **逐条 delta → 依据锚点 → 改动点**（派单要求的交付面之一）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准** —— 本单**逐处标依据**，**无一处与之冲突**；**唯一口径差 = 常量行号**（§D3-② / §D9）。
> **只追加式**：非追加改动 = **就地更新 1 处**（§5.1「商品持有读口」行加注归类更正，**旧文逐字保留**）+ **数值旧占位由 §4.9「取代关系」条承接（旧文未改）**。

---

## §D0 指纹自证（交付时现取 · 三口径 + `cmp`）

| 项 | 文件 | 行数 | 字节 | md5 |
|---|---|---:|---:|---|
| **改前（v0.9）** | `docs/route-layer.spec.md` | **1554** | — | **`8558aa84eb0812fa4f4fb6be34270959`** |
| **改后（v1.0）** | `docs/route-layer.spec.md` | **1849** | **417626** | **`c68f525340e2c9e0b2fdb1277a56acb6`** |
| **快照** | `docs/versions/route-layer.spec.v1.0.md` | 1849 | 417626 | **`c68f525340e2c9e0b2fdb1277a56acb6`** |

**自证命令（逐字 · 退出码一律管道外取；本机无 `timeout`）**：

```
cp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.0.md && cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.0.md; echo "CMP_EXIT=$?"
md5 -q docs/route-layer.spec.md; md5 -q docs/versions/route-layer.spec.v1.0.md; wc -l -c docs/route-layer.spec.md
grep -n '^### 1.12 \|^### 2.5 \|^### 3.5 \|^### 4.9 \|^### 4.10 \|^### 4.11 \|^### 5.6 \|^### 8.12 ' docs/route-layer.spec.md
```

**读数**：`CMP_EXIT=0`（**快照与本册逐字节相同**）；两 md5 逐位相同 = `c68f525340e2c9e0b2fdb1277a56acb6`；`1849 417626`。
**新节落点（`grep -n` 现取）**：`§1.12` = `:444` / `§2.5` = `:563` / `§3.5` = `:687` / `§4.9` = `:1089` / `§4.10` = `:1107` / `§4.11` = `:1131` / `§5.6` = `:1243` / `§8.12` = `:1717`。
**新编号出现次数（`grep -c` 现取）**：`7-43` = 3 / `7-44` = 1 / `7-45` = 2 / `7-46` = 3 / `E9` = 7（**含交叉引用**；**判据 = 追加表内各 1 行**）。
**★ 纪律**：本册**不内嵌自身 md5**（防自指），指纹**只在本件**；**v0.1–v0.9 九个既有快照一字未动**。

---

## §D1 delta ① —— §4.5 补幂等键硬规则（**服务端已确定性派生键的面，前端不得自造键**）

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.96④**（采信 4b-i 分歧裁定，逐字：「该面已有服务端确定性派生键，前端自造 `cli:<uuid>` 会把重试变第二行」⇒「要求 Jing v1.0 在 §4.5 补『服务端已确定性派生键的面，前端不得自造键』」）+ **Zang §5.100**（4c-ii-a「幂等键逐面声明」守住该裁定） |
| **逐面实测锚点** | 发布 = 前端供 `cli:`（服务端 **fail-loud**，`backend-ts/src/job-funds-service.ts:84`〔**本册现取**；`resolveJobCreateKeyRequired`〕）；申请 = **服务端派生**（`src/job-service.ts:180`〔**本册现取**：`['apply', jobId, workerUid]`〕）；提交 = **服务端派生**（`:133`〔**本册现取**：`['submit', identifier, workerUid]`〕）；接受 = **无键面**（`migrations/0014_job_flow.sql:102`）；审核 = **事件根键派生**（`migrations/0013_job.sql:592`〔**本册现取**：`v_key := 'biz:job:settle:' \|\| v_job_id::text;`〕/ `:589`）；纯读面不传键 |
| **改动点** | **§4.5 新增「v1.0 追加块」**（**上表 14 行 + v0.6 / v0.9 追加块一字未改**）：规则 + **11 行逐面表**（J1–J6 / P1 / P2 / P4 / M1 / M2 / 纯读面）+ 「前端零自造键」自证 + **与 §2.4 S10 的关系**（本规则是 S10 的上位规则）+ **判负**（派生面自造键 ⇒ 复核不通过） |
| **落点** | **§4.5 v1.0 追加块**；逐面落点表 = **§2.5**；登记 = **§7-43** |
| **`NOT_MEASURED`** | 前端运行读数 = 转引 `docs/audit/p4-b4c-ii-a-jobs-profile.md` §2（`create_key` 只出现在发布面 1 处；`job-api.js:61-79`）⇒ **本册未跑前端** |

---

## §D2 delta ② —— 错误体口径约束（**D1''**）

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.102**（逐字：「**真缺口 D1''（已实测）**：驱动**恒不搬运 `DETAIL`/`constraint`** ⇒ `409` 体带 `details.detail_unavailable='driver_did_not_carry_detail'`（**12/12**）⇒ **我裁定：规格不得依赖 `detail`，API 用项目级 `reason`；交 Jing v1.0 写入**」） |
| **真源** | `docs/audit/p4-err-fidelity.md`（**218 行**；**本册转引、未连库**） |
| **改动点** | **§3.5 新增**（7 条）：① 规格**不得依赖** `DETAIL`/`constraint`；② API **一律项目级 `reason`**（+ `code` / `field` / `ref_type` / `ref_id`）；③ `detail_unavailable` = **合法登记项非错误**；④ **与 §3.3-2 同立场**（`R107` 已禁 SQL/约束名/堆栈进对外 `details`）；⑤ **判负**；⑥ `NOT_MEASURED` 边界（无 access log，§3.4 / §7-24）；⑦ **与 D1 的区别**（D1 已作废，见 §4.11.2） |
| **落点** | **§3.5**（`docs/route-layer.spec.md:687`）；登记 = **§7-44** |

---

## §D3 delta ③ —— A1（后台调分）落定

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.101**（A1-LEDGER-IMPL 验收通过：**15/15 两轮** + `Σ(cid=1)` **差额恰等** + **幂等重投零分录**；`requireAdmin` 未动且**先于金额校验**；**零新造码**） |
| **改动点** | **§4.10 新增**（12 行落定表 + 差异登记 + 形状偏离登记 + 与 §4.8 关系 + `NOT_MEASURED`） |
| **口径（写死）** | `POST /api/admin/points/adjust` = **有符号 `amount`**（`> 0` ⇒ `op='mint'` + `platform=true`；`< 0` ⇒ `op='entries'` + **单腿 `kind='burn'`**）；上限 **±100000**（绝对值）；`requireAdmin` **先于**金额校验；幂等键 = **`ops:` 系**；`uID<0` / 库无此用户 ⇒ **400 `LEDGER_RESERVED_UID`**；**注册点不变（仍 65）** |
| **本册现取锚点**（`src/index.ts`） | 路由 `:1191`｜`requireAdmin` `:1192`｜`uID<0` ⇒ `LEDGER_RESERVED_UID` `:1207-1213`｜`amount===0` ⇒ `NOT_A_POSITIVE_INTEGER` `:1217-1223`｜越限 ⇒ `OVER_MAX_SINGLE_AMOUNT` `:1225-1231`｜`ops:` 键 `:1234-1237`｜指纹 `:1240-1242`｜`adjustPoints` 调用 `:1244`｜幽灵 uid ⇒ `LEDGER_RESERVED_UID` `:1246-1254`｜`op` 响应标签 `:1256`｜成功面 **8 键** `:1257-1267`；常量 `ADMIN_POINTS_ADJUST_MAX_PER_CALL = 100000` `:1182` |
| **转引（本册未复现）** | **leg 形状** = `0020:156` 的 op 白名单**无 `burn`** ⇒ 负向取 `op='entries'` + 单腿 `kind='burn'`（**Zang §5.101 亲核 `:963` / `:975` / `:977` / `:989`**） |
| **★ 口径差（标 `待 Zang 复核`）** | ① 常量行号 **本册现取 `:1182`** vs **Zang §5.97 记 `:1180`**（差 2 行）；② 路由行号 本册现取 `:1191` vs v0.1 `:1066` / 批 2 末态 `:995`（行号漂移，§1.12「五分」口径） |
| **★ 新登记（本册现取 · 判负项）** | `:1200-1202` 的**入参不完整**分支 = `sendError(res, 400, '参数不完整')` ⇒ **非 `R107` 形状**（与 §3.3-1 冲突）⇒ **§9.E · E9**（收口项） |
| **落点** | **§4.10**（`:1107`）；登记 = **§7-45**；收口 = **§9.E · E9** |
| **`NOT_MEASURED`** | A1 的 15/15 / `Σ(cid=1)` 差额 / 幂等重投 ⇒ **转引 Zang §5.101**（§8.12.2-46） |

---

## §D4 delta ④ —— 数值定值

| 项 | 值 | 真源（**本册现取**） |
|---|---:|---|
| 建币费 `currency_create_fee` | **10,000** | `backend-ts/src/currency-service.ts:142`（`CURRENCY_CREATE_FEE_FLOOR = 10000`） |
| 上市费 `listing_fee` | **10,000** | `backend-ts/src/currency-service.ts:143`（`CURRENCY_LIST_FEE_FLOOR = 10000`） |
| 上市保证金 `listing_deposit` | **50,000** | `backend-ts/src/currency-service.ts:144`（`CURRENCY_LIST_DEPOSIT_FLOOR = 50000`） |
| A1 单笔上限 | **100,000**（绝对值） | `backend-ts/src/index.ts:1182`（`ADMIN_POINTS_ADJUST_MAX_PER_CALL = 100000`） |

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.95③**（Kevin 授权定值：「以 1% 佣金下 10 万酬金 ⇒ 1000 手续费」为锚；「**从占位改成定值 + 留在可配置位置**」）+ **§5.101**（A1 上限） |
| **标注（写死）** | 逐条标「**Kevin 2026-09-30 定值**，**起始值、可配置**」（`currency-service.ts:142-144` 三行注释**本册现取**逐字含该字样） |
| **改动点** | **§4.9 新增**（4 行定值表 + **取代关系** + 精确行号订正 + 低限语义不变 + 判负 + `NOT_MEASURED` + 真源交叉核对） |
| **★ 取代关系（旧写法留痕）** | 取代 **§4.4-11 / §4.4-12**（原「`currency-service.ts:140-142` = **1000/1000/1000**、逐条 `TODO: Kevin 定值`」）与 **§4.7.3 B10**（商品面占位 `1000`）；**§7-23 机制面（服务端取数 + 下限校验）不变**。**本册为守「只追加」未改旧文** ⇒ **读者若只读 §4.4-11/12 会看到已失效的 `1000`**（**刻意留痕**；判据取 §4.9） |
| **★ 精确行号订正** | 真名 = `CURRENCY_CREATE_FEE_FLOOR` / `CURRENCY_LIST_FEE_FLOOR` / `CURRENCY_LIST_DEPOSIT_FLOOR`，行号 = **`:142 / :143 / :144`**（旧写 `:140-142` = 批 3a 时点读数，已漂移） |
| **落点** | **§4.9**（`:1089`）；登记 = **§7-45 + §7 补注块 ⑭** |
| **`NOT_MEASURED`** | 边界 9/9（`9999→400` / `10000→200` / `49999→400` / `50000→200`）⇒ **转引 Zang §5.96**（NUM-1 验收），**本册未复跑**（§8.12.2-47） |

---

## §D5 delta ⑤ —— ★ 更正 `/api/prize-item` 的归类（**它不是 sunset 面**）

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.103④**（逐字：「**它纠正我误登记（`/api/prize-item` 非 sunset）**」）；同处追述：「**实测**该路径 `200`、数据源 = `listing_order`（`database.ts:1066`，`buyer_uid=me AND status='paid'`），且是**退款面 `order_id` 的唯一已注册来源**（`O_mine_buyer_axis`：`contains_my_order=true`）⇒ **保留路径 + 改语义**、**不移除**」；**Zang 自曝**「该标签是凭归类推的、未复现」 |
| **真源** | `docs/audit/p4-b4c-ii-b-listings-market.md` §2④（**4 文件 / 6 处**逐条处置表 + 「★ 与派单前提不符的实测登记」段）+ §5.1 `O_mine_buyer_axis`；**本册现取** = `index.ts:546` 注册行 + §1 `#16` / §5.1 行 / §5.4-1 三处原文 |
| **改动点（就地 + 留痕）** | **§5.1「商品持有读口」行的「本册最终处置」格加注**（**本册唯一非追加改动**）：本行位于「弃用面」处置表内 ⇒ 易被读成 sunset；**实测非 sunset** ⇒ 保留 + 改语义、不得退役 / `410` / 空态化；**旧读法原样保留（不删）** |
| **改动点（追加）** | **§5.6 新增**（6 条：保留路径 + 改语义 / 就地订正留痕 / 判负 / 与 `/api/shard` 系的区别 / 真源 / `NOT_MEASURED`） |
| **★ 其余出现处复核（逐处留痕）** | §1 `#16` 处置 = **【保留·正式化】**（已正确）；§1.4 F6（正式化，实测无 `deprecated`）；§2.1（`normalizePrizeItem` 6 键）；§2.2（前端 3 处消费）；§5.4-1（「正式化——已满足」）⇒ **口径已正确、无需改** |
| **落点** | **§5.6**（`:1243`）+ §5.1 行加注；登记 = 无新 §7 行（**归类更正**，非未决项） |
| **`NOT_MEASURED`** | 该路径运行时读数（`200` + `contains_my_order=true`）⇒ **转引 4c-ii-b §5.1**，**本册未复跑** |

---

## §D6 delta ⑥ —— 登记「缺表族」与批 5 + **D1'**

| 项 | 内容 |
|---|---|
| **依据** | **Zang §5.99④**（「`asset` 缺表族立为**批 5『缺表族清理』**：默认按 spec sunset 口径处理；**唯 `POST /api/auth/verify` 与 `POST /api/task-progress/claim/:jID` 两处需 Kevin 一句话** ⇒ 我给的默认值 = **不复活、按 sunset 处置**」）+ **§5.102**（**D1'** = 非 400 驱动错误应归 **`503`**、归批 6；**D1 已勘误作废**） |
| **7 张缺表** | `asset` / `task` / `task_progress` / `prize` / `prize_item` / `shard` / `shard_transfer`（迁移侧 20 真表 + `users`（`0006:75` RENAME）= 21 名字；差集真项 8、**7 项真缺**） |
| **★ 本册现取自证（一项）** | `grep -rniE 'create table[^;]*\basset\b' backend-ts/migrations/` ⇒ **0 行**；代码侧 `database.ts:861`（`getUserAsset`）/ `:889`（`upsertAsset`；`:895 UPDATE asset` / `:910 INSERT INTO asset`）⇒ 恒 `42P01`；**其余 6 表 = 转引 Zang §5.99**（§8.12.2-49） |
| **受影响的活路由（现取）** | `POST /api/auth/verify` **`:354`**（无 `cid=1` account 行时撞 `42P01` ⇒ **吞成 `401`**）；`POST /api/task-progress/claim/:jID` **`:635`** |
| **★ 本册现取补充** | 两条活路由**均有前端消费** ⇒ **退役前必须先改前端**：`frontend/src/auth.js:123`（登录主链）/ `frontend/src/components/ClaimRewardModal.jsx:49` / `frontend/src/pages/RewardPage.jsx:152`（§2.2 既有读数） |
| **D1'（写死）** | **非 400 传输类错误应归 `503`（不是 `500`）**、**归批 6**、**先补只读观测面**；结构事实 = `@neondatabase/serverless/index.js:1542-1544`（**Zang §5.102 亲核**；本册转引）；**D1（驱动丢码）已作废**（驱动不丢码；`uID=-1` 案现取 = `400 LEDGER_RESERVED_UID` 来自**路由前置闸** `index.ts:1207-1213`） |
| **改动点** | **§4.11 新增**（§4.11.1 缺表族 7 表 + 受影响的活路由 + 批 5 口径 + 前端影响；§4.11.2 D1' 6 行表 + 判负 + `NOT_MEASURED`） |
| **落点** | **§4.11**（`:1131`）；登记 = **§7-46** |
| **`NOT_MEASURED`** | 缺表族的库面差集复算（转引 §5.99）；D1' **结构性、未触发**（12/12 全走 400；本机无 `psql`） |

---

## §D7 delta ⑦ —— 前端接线映射表（新节）

| 项 | 内容 |
|---|---|
| **依据** | 派单 delta ⑦；**真源 = `docs/audit/p4-b4c-ii-a-jobs-profile.md`（171 行）+ `docs/audit/p4-b4c-ii-b-listings-market.md`（230 行）+ `frontend/src/pages/{jobs,listings,market}/**`**（**本册现取目录清单**：`jobs/` 5 / `listings/` 5 / `market/` 3 文件） |
| **改动点** | **§2.5 新增**：**四条线** —— ① 招工线（9 行，`task/new` / `task/:jobId` / `task/review` / 列表）；② 商品线（7 行，`listing/new` / `listing` / `listing/:listingId`）；③ 交易所线（6 行，`/shard` 薄壳）；④ 「我的」（5 行，`profile` / `home`） —— 每行 = **页面（路由）↔ 路径 ↔ 后端行号（v1.0 现取）↔ 前端落点（转引）↔ 幂等键口径** |
| **判据（写死）** | ① 每条路径必须在「已注册 65 行路径表」内（§1.12）—— 现值**仅 `/api/user/ledger` 与 `/api/user/points` 未注册**（两报告自证前端为零请求空态）；② 服务端派生面（申请/提交/审核/退款/单撤/全撤）前端**不传键**；③ `/api/prize-item` **不得当 sunset 处置**；④ `/api/shard` 系**确为 sunset** ⇒ 前端调用须全移除 |
| **落点** | **§2.5**（`:563`） |
| **`NOT_MEASURED`** | **前端运行读数全部 = 转引**（本册未跑前端；§8.12.2-44） |

---

## §D8 delta ⑧ —— §1 端点处置表 / §1.8 状态列与注册点现取复核

| 项 | v0.9 记载（**历史留痕**） | **v1.0 现取（以现盘为准）** |
|---|---|---|
| 注册点 | 53 → 65 | **65**（`grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts`）**不变 ✓** |
| `src/index.ts` 行数 | 1575 | **1645**（`wc -l`） |
| `POST /api/job` | `:1289` | **`:1359`** |
| `/apply` · `/accept` · `/submit` · `/review` · `/cancel` | `:1305` / `:1327` / `:1352` / `:1380` / `:1404` | **`:1375` / `:1397` / `:1422` / `:1450` / `:1474`** |
| `POST /api/listing` · `POST\|PATCH /api/listing/:listingId` | `:1422` / `:1448` / `:1475` | **`:1492` / `:1518` / `:1545`** |
| `/api/listing/:listingId/buy` · `/api/listing-orders/:orderId/refund` | `:1499` / `:1520` | **`:1569` / `:1590`** |
| `POST /api/admin/commission_policy` | `:1540` | **`:1610`** |
| `POST /api/tasklist/:jID/verify` | `:1061` | **`:1109`** |
| `POST /api/currency` · `/api/currency/:cid/list` | `:1160`/`:1166` · `:1179`/`:1185` | **`:1282` / `:1301`** |
| `POST /api/admin/points/adjust` · `/api/admin/assets/init` | `:1066`/`:995` · `:1056`/`:985` | **`:1191` / `:1173`** |

- **改动点**：**§1.12 新增**（19 行对照表 + 口径升「五分」+ 留痕声明 + §1 处置列复核 + §1.8 状态列复核）。
- **结论**：**§1 处置列 = 无订正**（注册与路径面与现盘一致）；**§1.8 状态列 = 无订正**（「已注册（批 4a）」11 行 + 1 附注成立，注册点 65）；**只登记行号漂移**。
- **落点**：**§1.12**（`:444`）。
- **`NOT_MEASURED`**：**HTTP 响应码面未复跑**（本册零 HTTP 调用）⇒ §8.12.2-45 / -51。

---

## §D9 口径差 / 自曝 / `NOT_MEASURED` 汇总

| # | 项 | 口径 |
|--:|---|---|
| 41 | **常量行号差 +2** | 本册现取 `index.ts:1182` vs **Zang §5.97 记 `:1180`** ⇒ **以现盘为准**、标 `待 Zang 复核` |
| 42 | **`op` 同名不同层** | `:1256` 的 `op` = **响应标签**（`mint`/`burn`）；**账本 op 在 `adjustPoints` 内**（负向 = `entries` + 单腿 `kind='burn'`）⇒ **不得**据 `:1256` 读成「账本用 `burn`」 |
| 43 | **A1 入参不完整分支非 `R107`** | `:1200-1202` = `sendError(400,'参数不完整')` ⇒ **登记 §9.E · E9**，**本册不改码** |
| 44 | **§4.4-11/12 与 §4.7.3 B10 的 `1000` 旧文未改** | **刻意留痕**（守「只追加」）；**判据取 §4.9**（取代关系条） |
| 45 | **`grep -c` / `grep -n` 同模式** | 注册点两条命令**同模式**、口径一致；**未用管道后 `$?`** |
| 46 | **`sed` 区间均为现取** | §4.9 = `sed -n '142,144p'`；§4.10 = `sed -n '1180,1294p'` ⇒ **非转引** |
| 44–51 | **`NOT_MEASURED`（8 条）** | ①前端运行读数 ②13 个 `410` 响应码面 ③A1 15/15 + `Σ(cid=1)` + leg 形状 ④数值边界 9/9 ⑤D1'（未触发）⑥缺表族其余 6 表的库面复算 ⑦前端 `auth/verify`/`claim` 消费全量扫 ⑧各面响应体 —— **一律转引、未复跑**（§8.12.2） |

**唯一标注 `待 Zang 复核` 项 = #41**（常量行号，**不影响任何判据**）。

---

## §D10 边界自证（本单**没做**什么）

- **只写三个文件**：`docs/route-layer.spec.md`（就地升 **v1.0**）、`docs/versions/route-layer.spec.v1.0.md`（快照 · `cmp` 逐字节相同）、本件。
- **禁项确认**：**未** `git add/commit/push`（**未跑任何 git 命令**）；**未**写库 / **零库连接**；**未**启停任何服务或进程（**未 kill 任何 PID**、**未**用 `pkill -f` / `killall`）；**未** `npm install`；**未**用 `execute_code`；**未**用 `timeout`（本机无）。
- **未触碰**：`docs/ledger.spec.md`、`docs/data-layer.spec.md`（**两册无需改** —— 四条 delta 全落在路由 / 编排 / 前端面，**无 `DL*` / `R*` 变更**）、`docs/versions/route-layer.spec.v0.1–v0.9.md`（**九个既有快照一字未动**）、`docs/seafood.master-plan.md`、其它 `docs/audit/*`（含 `p4-b4c-ii-a/b` 两件 **只读**）、`docs/qa/*`、`backend-ts/**`（**只读**：`grep` / `grep -c` / `wc` / `sed -n`）、`frontend/**`（**只读目录清单**）。
- **非追加改动 = 1 处**（§5.1 归类加注，**旧文逐字保留**）；**其余全部为追加**。
- **纪律自检**：① 带引号断言加引号 ✅｜② 退出码不取管道后 ✅｜③ 本机无 `timeout` ✅｜④ 读数异常先怀疑自己 ✅（#41/#42 登记为口径差）｜⑤ 先骸架后回填 ✅（各节一次成文、无占位态）｜⑥ 报数带口径 ✅（行数 / 字节 / md5 + 就地 1 处 / 追加 N 处）｜⑦ 凡「实测」可 `grep` 到 ✅｜⑧ **立案 / 标签前必须自己复现一次** ✅（数值三常量 / A1 六处守卫 / `asset` 缺表 0 行 / 注册点 65 / `prize-item` 非 sunset —— **五项均为本册现取**）｜⑨ 只追加 ✅｜⑩ 不改代码 / 不启停 / 不写库 ✅。
