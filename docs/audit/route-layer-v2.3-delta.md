# 批 8 首轮冻结「补正单」· `docs/route-layer.spec.md` **v2.2 → v2.3** · 差异说明（DELTA）

- **单号 / 角色**：**JING-SPEC-B8-1R**（批 8 首轮冻结的**补正单**）· **Jing（Specifier · 制度员）**
- **依据（逐条）**：**Zang §5.180 C 三条裁定**（`R-8-7` / `R-8-8` / `R-8-9`，逐字）+ **独立质检单 `docs/qa/p8-spec-v22-v010-review.md`**（`D-1` / `O-3` / `D-2` / `D-3` / `D-4` + `§6` 的切片编号不一致）+ **派单硬口径**
- **交付面（本单）**：① `docs/route-layer.spec.md`（**就地升 v2.3**）；② 快照 `docs/versions/route-layer.spec.v2.3.md`（**`cmp` = 0**）；③ 本 delta 件。**★ 同批姊妹册**：`docs/data-layer.spec.md` **v0.11（§22）** + 快照 `docs/versions/data-layer.spec.v0.11.md` + `docs/audit/data-layer-v0.11-delta.md`。
- **红线自证**：**未碰**任何代码（`backend-ts/**` / `frontend/**` **只读引用**）、`migrations/**`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**`（**既有件**）、`docs/design/**`、`ledger.spec.md` / `commission.spec`（**只读引用 §14.3 的借用码授权**）；**零 `git add/commit/push`**；**未 `npm install`**；**未碰 / 未打印 `.env*`**；**未用 `pkill -f` / `killall`**；**未启停 5787 / 5788**；**零库连接 / 零 HTTP / 零套件**。

---

## §D0 只追加自证（机器判据 · 本单完工时点现取）

### D0.1 两册正文 `git diff --numstat`（删除列必须 = 0）

```
$ git diff --numstat docs/route-layer.spec.md docs/data-layer.spec.md
223     0       docs/route-layer.spec.md
114     0       docs/data-layer.spec.md
```

⇒ **本册删除列 = `0`**（**223 增 / 0 删**）；姊妹册同理（`114 / 0`）。

### D0.2 `difflib.SequenceMatcher` 逐行 opcode 普查（只允许 `equal` + `insert`）

| 文件 | 改前行 → 改后行 | opcodes | `replace` | `delete` | 删除行数 | 判定 |
|---|---|---|---|---|---|---|
| `docs/route-layer.spec.md` | **4030 → 4253** | `['equal','insert'] × 6`（**6 个插入块** = 顶部 v2.3 状态块 / §7 追加行 / 补注块 / §8.1 行 / §8.25 / §18） | **0** | **0** | **0** | **PASS** |
| `docs/data-layer.spec.md` | **1174 → 1288** | `['equal','insert'] × 2`（v0.11 头注 / §22） | **0** | **0** | **0** | **PASS** |

- **复核口径**：`autojunk=False`；输入 = `git show 664401a:<path>` 的**行序列**与工作树行序列（`splitlines(keepends=True)`）；`equal` 行数 = **4030 / 1174**（= 旧文件全部行数）⇒ **旧行零丢失**。

### D0.3 改后快照 ↔ 正文（`cmp` 必须 = 0）

```
$ cmp docs/versions/route-layer.spec.v2.3.md docs/route-layer.spec.md   # 退出码 0（IDENTICAL）
$ cmp docs/versions/data-layer.spec.v0.11.md docs/data-layer.spec.md    # 退出码 0（IDENTICAL）
```

### D0.4 指纹（本单完工时点 · 现取）

| 件 | 行数 | 字节 | md5 | sha256（前 24 位） |
|---|---:|---:|---|---|
| `docs/route-layer.spec.md`（= 快照 `v2.3.md`） | **4253** | **910180** | **`8965216101d970173a5311a41a5dd688`** | `c214fa3bd687494b16f500bb` |
| `docs/data-layer.spec.md`（= 快照 `v0.11.md`） | **1288** | **331129** | **`5227775f12ef747cf55001c421814340`** | `05f0dd36c238619ace2dbfd3` |
| **改前** route（v2.2） | 4030 | 866484 | `55123bd0520d619621d5a66afab3e77b` | — |
| **改前** data（v0.10） | 1174 | 309965 | `614a39ec40e8a874945a97456e1d1bef` | — |

### D0.5 旧快照零改动（逐一现取）

```
$ git diff --name-status HEAD -- docs/versions/     # 输出 = 空（0 行）
$ git status --porcelain docs/versions/             # 仅两件 ??（本单新建）
?? docs/versions/data-layer.spec.v0.11.md
?? docs/versions/route-layer.spec.v2.3.md
$ git ls-tree HEAD docs/versions/ | grep -c "route-layer.spec.v"   # 22
$ git ls-tree HEAD docs/versions/ | grep -c "data-layer.spec.v"    # 10
```

- **route 旧快照 = 22 个**（`v0.1`…`v2.2`）⇒ **与派单所述「route 应已 22 个」逐数相符** ✅；**本单新建 = `v2.3.md`**（工作树总数 23）。
- **data-layer 旧快照 = 10 个**（`v0.1`…`v0.10`）⇒ **★ 与派单所述「data-layer 应已 9 个」不符**：**现取 = 10**（`v0.10.md` 系批 8 首轮随 v0.10 正文同批新建，见 `data-layer.spec` §21.7 的「改后（v0.10）」）；**本单以现取为准、不做任何删除**（**本单新建 = `v0.11.md`**，工作树总数 11）。**登记为派单数与现取的差异，不静默。**
- `git diff --name-status HEAD -- docs/versions/` **输出 = 空** ⇒ **旧快照一字未动** ✅。

---

## §D1 逐条 delta → 依据 → 落点 → 行锚

| # | delta | 依据 | 落点（本册 v2.3 · 行锚为**完工时点**现取） |
|--:|---|---|---|
| ① | **`R-8-7` 落位**（8⑦ 读口 = `manage_points`；`read_users` 已排除；独立键跨批） | **Zang §5.180 C · `R-8-7`** | **§18.2** + **新增 `§7` 行 `7-65`** + **补注块 ㉝** + 顶部 v2.3 状态块 |
| ② | **`R-8-8` 落位**（8④⑤ = 确认 `review_tasks` + takedown 附带条件） | **Zang §5.180 C · `R-8-8`** | **§18.3** + **`7-66`** + **补注块 ㉞** |
| ③ | **`R-8-9` 落位**（键名批准 / 入册时机 / 8①·8② 不得先行写入 / 数值待 Kevin） | **Zang §5.180 C · `R-8-9`** | **§18.4** + **`7-67`** + **补注块 ㉟** |
| ④ | **★ 勘误块 `D-1`**（三处错引锚的逐字更正） | 质检单 **`D-1`**（其 `§3.3` / `§8`） | **§18.5** |
| ⑤ | **★ 新纪律「引用纪律」+ 可判负形态** | 质检单 **`D-1`** 的制度化 | **§18.6** + **`7-68`** |
| ⑥ | **★ 借码映射入册（`AG1` / `AG3`）** | 派单 ④；授权锚 = `ledger.spec` **§14.3** | **§18.7**（姊妹册 v0.11 §22.2 同批入册） |
| ⑦ | **切片编号对齐 + `O-3` / `D-2` / `D-3` / `D-4` 登记** | 质检单 `§6`（切片标签不一致）+ `O-3` + `D-2`/`D-3`/`D-4` + 派单 ⑤ | **§18.8** + 本件 **§D4 / §D5 / §D8** |
| ⑧ | **变更记录 / 快照 / delta 件** | 派单硬口径 | **§8.1 v2.3 行** + **§8.25** + `docs/versions/route-layer.spec.v2.3.md` + 本件 |

---

## §D2 三条裁定的逐字对拍（裁定值 ↔ 落点值）

| 裁定 | 裁定原文（Zang §5.180 C 逐字） | 本册落点（值） | 一致性 |
|---|---|---|---|
| **`R-8-7`** | 「✅ **复用 `manage_points`**。**理由**：审计台内容 = **积分调账审计（`0023`）+ 退款审计（`0024`）**，正是 `manage_points` 的**动作面**；「**能调账者才看调账审计**」= 最小权限一致（且两条动作路由本就以 `manage_points` 为闸）。**独立「只读审计」键 ⇒ 跨批登记**（需 4 处同批改）。**不选 `read_users`**（读人域，与资金审计面不符）。」 | **§18.2**：读口 = `manage_points`；**`read_users`【已排除】**；**独立键 = 跨批（4 处同批改，4 个锚逐条给出）** | **✅ 一致** |
| **`R-8-8`** | 「✅ **确认临时复用 `review_tasks`**：两片本质均为**审核/审批**面（④ 自建单位审批、⑤ 合规审核/下架）；**若 ⑤ 的 takedown 后续落成独立动作面 ⇒ 再报我裁**。独立键（`manage_currency` 等）⇒ 跨批。」 | **§18.3**：确认 `review_tasks` + **补入「⑤ takedown 后续成独立动作面 ⇒ 再报 Zang 裁」** + 独立键跨批 | **✅ 一致**（**本单新增的那一句已落位**） |
| **`R-8-9`** | 「✅ **键名批准 `listing_deposit_policy`**（顶层 `snake_case` / `value` = jsonb object / 字段 `camelCase`，风格与 `system_settings` 一致）；**由 Jing 在 8③ 冻结时正式入 `AK1` 清单**（**★ 8①/8② 实现单不得先行写入该键**）。**数值仍待 Kevin**（实现期兜底常量标 `TODO: Kevin 定值`；**下限校验机制先落地**）。」 | **§18.4**：键名批准 + 风格四条合规核对 + **入册时机 = 8③ 冻结时（本单不入册）** + **8①/8② 禁写令** + **数值待 Kevin**；**现取清单仍 = 恰 1 键** | **✅ 一致**（**且未越权入册**） |

> **★ 一处「裁定理由句」的既知偏差（不改裁定、不属本册缺陷）**：`R-8-7` 理由括号内写「（且两条动作路由本就以 `manage_points` 为闸）」—— 质检单 §6.1 现取：退款路由成立、**A1 后台调分路由无键**（`requireAdmin` 无键面，本册 **`§7-52` 逐字登记**）⇒ **只对其中一条成立**。**本单只登记该事实、不改裁定字句、不改 §7-52**（**供 Zang 判断理由句是否需改字**）。

---

## §D3 `D-1` 勘误（逐条 · 现取证据）

| 项 | 现取读数 | 命令 |
|---|---|---|
| `:3042` 是否空行 | **空行**（逐字输出为空） | `sed -n '3042p' docs/route-layer.spec.md` |
| `§12.1.1` 节头 | **`:3080`** | `sed -n '3080p' …` ⇒ `#### 12.1.1 权限闸候选：11 键逐键（**现取调用面**）+ 「无键」口径 ⇒ 选**唯一**` |
| 真实内容行 | **`:3096`**（单行 · **非空**；`:3097` = **空行**） | `sed -n '3096p' …`（**逐字原文见本册 §18.5(d)**） |
| 三处错引的命中行 | **恰好三处 = `:1798` / `:3922` / `:4030`** | `grep -n '§12.1.1:3042' docs/route-layer.spec.md` |
| 引号内文案是否逐字 | **否** —— 原文为 **①②③④ 四段枚举**（① 新迁移 → ② 真源常量加键 → ③ 前端兜底加键 → ④ `0022` apply-time 自检同批改），**原文无「新权限键须 4 处同批改」这一句** | 同 `:3096` 现取 |
| 实质结论 | **不变**（4 处同批改的语义与枚举一致）⇒ **属引证卫生缺陷、非条文错误** | — |
| 处置 | **不改三处旧行**（删除列 = 0）⇒ **勘误块 §18.5 承载**；**今后引该内容一律写 `§12.1.1:3096` 且逐字** | 本册 §18.5 / §18.6 |

> **行号漂移提示**：`:1798` / `:3922` / `:4030` 是**改前（v2.2）**的行锚；**改后（v2.3）**因三处插入块分别落在其**之前 / 之间 / 之后**，行号已变（**内容与文本一字未改**）。**凡按行号复核者请以 v2.2 快照 `docs/versions/route-layer.spec.v2.2.md` 为准**（这正是本单新立「引用纪律」要求**声明真源版本**的原因）。

---

## §D4 `O-3` 登记（`ops:` 幂等键必须按 key 派生 · 不得写死常量）

**现取（对 `HEAD` = `664401a`）**：

```
$ git show HEAD:backend-ts/src/index.ts | sed -n '1147p'
  const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings');
```

- **问题（逐条）**：① `'system_settings'` 是**写死字面量** ⇒ 新增第二个合法键（如 §18.4 的 `listing_deposit_policy`）时，其 `ops:` 键**仍落在同一命名空间**（`ops:<admin_uid>:setting:system_settings`）⇒ **跨键的幂等键会互相遮蔽**（同 admin 同一天内先写 A 键、再写 B 键，若两次请求体指纹相同，可能被判为「重放」而非新键写入）。
- **规范面缺口（现取）**：`§17.3` / `AR2` / `AG1`–`AG4` 均**未覆盖**「跨键幂等键须按目标键分化」这一面 —— **`AG2` 只约束「写语句落点」、不约束「键名字面」**。
- **正确口径（登记 · 写死）**：**`ops:` 键的目标键段必须按请求体面向的 `app_config` 目标键派生**（即 `resolveAdminOpsKey(req, uid, 'setting', <目标键名>)`，**不得**传常量字面量）；**单键请求 ⇒ 目标键唯一**；**多键请求 ⇒ 须在实现单里写死「按哪个键派生或一请求一键」的规则**（**不得**留空）。
- **待办归属**：**交「接该面的实现单」**（本册只登记，**不实现**）；与 `data-layer.spec` v0.11 **§22.5** 的同条登记**同物**。
- **判负形态（建议 · 可机读）**：**类级扫描** `grep -n "resolveAdminOpsKey(" backend-ts/src/index.ts` ⇒ 其**第 4 参不得为字符串字面量**（除既有唯一键 `system_settings` 的历史行外，新增写口必须传变量）；**新写口传字面量 ⇒ 判负**。
- **未测**：该面**未实现** ⇒ 键形态实测 = **`NOT_MEASURED`**（本册 §18.9 与姊妹册 §22.6 同款；**不得填示例值冒充实测**）。

---

## §D5 `D-2` / `D-3` / `D-4` 登记（**预防性不变量标注** —— **不得当「已证违规」**）

| 条目 | 现取事实（真源） | **标注（写死）** | 不作什么 |
|---|---|---|---|
| **`D-2`** | **`AG2`（越权面 ⇒ 拒）无现取静默吸收点** —— `git grep -nE 'INSERT\|UPDATE\|DELETE … public\.app_config' … -- backend-ts/src/` 现取 = **恰 1 处**（`database.ts:2887`）；`resetSystemSettings`（`:2899`）**只是 `saveSystemSettings` 的包装**、**不是第二条写路径** | **★ 预防性不变量（类级约束 / 防回归；现取无违反）** | **不得**当成「已证违规」、**不得**据此开缺陷单 |
| **`D-3`** | **`AG3`①（`value` 裸标量 ⇒ DB `23514`）经唯一写口不可达** —— `database.ts:2880` 恒以 `{...current, ...input}` 构造对象 ⇒ `JSON.stringify(object)` **永不产出裸标量**；而 DB CHECK（`0017:77`）与 apply-time 自检（`0017:323-324`）**真实存在** | **★ 预防性不变量（DB 层兜底 / 防直连 / 防未来写路径）** | **不得**据此判「现实现有缺陷」 |
| **`D-4`** | **`AG4`（不得静默放行）= 元规则**，其三条判据与 **`AG1` 的判负用例同点**（`AG1` 判据 = HTTP 400 + `unknown_keys` 非空 + 合法字段不得落库） | **★ 元规则（判负用例与 `AG1` 合并；非独立缺口）** | **不得**当成「第四条独立缺口」 |

> **★ 共同口径（写死）**：三者**均为「防回归的类级约束」**，各有**可复算真源**（`D-2` 的写语句 1 处 / `D-3` 的 CHECK + 自检 / `D-4` 的判负用例）⇒ **保留为条目、但不计入「现取缺口数」**；**任何汇总里把它们写成「已发现的静默吸收点」= 错报**。

---

## §D6 「引用纪律」可判负形态（本册 §18.6(b) 的逐条对应）

| # | 断言 | 判负条件 | 本单状态 |
|--:|---|---|---|
| ① | 抽取本册全部 `文件:行` 引用 | 抽取集为空 ⇒ **门无效**（须显式声明「无此类引用」） | 本单**执行了抽取**（沿用质检单 §7.1 的口径：`*.ts\|js\|jsx\|sql\|md\|json\|mjs\|cjs : <line>` 与 `00NN:<line>`） |
| ② | 逐条现取（**须声明真源版本：`HEAD` blob 或工作树**） | 任一引用行 = 空行 / 不存在 ⇒ **判负** | 本单**全部新增引用行锚已现取**（§18.1 六项 + `ledger.spec:875/914/937/942/982` + `HEAD:index.ts:1147`）；**唯一命中缺陷 = `D-1`（在 v2.2 既有行，已由 §18.5 勘误）** |
| ③ | 引号内文本与真源「去 `**` + 去首尾空白」后逐字比对 | 任一不等 ⇒ **判负** | 本单新增引号文本**逐字取自现取**（§18.5(d) 的 `:3096` 逐字块） |
| ④ | 负对照（行号 +1 / 改一字 ⇒ 门必须转红） | 不转红 ⇒ **门是假门** | **未执行**（本单只立纪律、**未实现门**）⇒ **登记 `NOT_MEASURED`**（§18.9-6） |

---

## §D7 借码映射逐条（`AG1` / `AG3`）

| 条目 | 码 | 状态类 | `details.reason` | 授权锚（只读引用 `ledger.spec.md` · 现取） |
|---|---|---|---|---|
| `AG1` 未知键 | `LEDGER_AMOUNT_INVALID` | `400` | **`SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST`**（+ `unknown_keys` 逐键） | `:914`（§14.3 标题「**P1a 借用方案**…已裁定」）/ `:942`（逐字「**`LEDGER_AMOUNT_INVALID` 是历史码名，本册不新增错误码**……被**兼用**作「**参数形状非法**」码」）/ `:937`（① 形状非法 ⇒ 参数校验失败 ⇒ `400 LEDGER_AMOUNT_INVALID`）/ `:875`（§14.1 #17） |
| `AG3`② 类型不符 | `LEDGER_AMOUNT_INVALID` | `400` | `SETTING_TYPE_INVALID` | 同上 |
| `AG3`① 裸标量 ⇒ `23514` | `LEDGER_AMOUNT_INVALID` | `400` | **不发明第三个常量**（在 §14.3 既有 `reason` 词表内由实现单选定） | 同上 + `:982`（逐字「其余 `23514` ⇒ `input` / `LEDGER_AMOUNT_INVALID`」） |
| **驳回** | ~~`LEDGER_UNKNOWN_KIND`~~ | — | — | §14.3 附（逐字：「`ledger_kind_enum` ⇒ **`input`**（`LEDGER_UNKNOWN_KIND` `400`）」）⇒ 语义 = **账务 kind 闭集**，与 `app_config` 键面**无关** |
| **闭集** | **33 码不动** | — | — | `ledger.spec` §14.1（**33 个错误码关闭集不增不减**） |

> **不破映射核对**：`400` 属 `input` 桶（`ledger.spec` 的 `bucket ↔ 状态类` 冻结映射：`input ⇒ 400 类`）⇒ **一致**、**不破「`500` 只来自 `defect`」的封闭性**。

---

## §D8 切片编号对齐逐条（**以 Zang §5.179 C 定稿为准**）

| 本册 v2.2 旧标法（**未改**） | 定稿 | 说明 |
|---|---|---|
| 8 ① `app_config` 管理 | **8①** | 同物 |
| 8 ② 费率配置 **+** 8 ③ 返佣权重矩阵 | **8②**（合为一片） | 同一 `commission_policy` 写口 + 同一后台页 |
| 8 ④ 自建单位审核 | **8④** | `R-8-8`：闸 = `review_tasks` |
| 8 ⑤ 合规审核 | **8⑤** | `R-8-8` 的 takedown 附带条件适用本片 |
| 8 ⑥ 用户与权限 | **—（不成片）** | `R-8-6`：降为 `R-7E-6` + 权限闸复用 |
| 8 ⑦ 资产与流水审计台 | **8⑥** | `R-8-7`：读口键 = `manage_points` |
| 8 ⑧ ＝ 8 ⑤ 保证金规则（同物） | **8③** | **`R-8-9` 的「8③ 冻结时入 `AK1`」= 本片** |

- **旧标法一字未改**（守「删除列 = 0」）；**读法以本册 §18.8(a) 的对照表为准**。
- **质检单 §6 指出的不一致已闭合**：`R-8-9` 的「**8③**」在册内**可直接定位**（= 定稿 8③ = 上市保证金）。

---

## §D9 未测项（`NOT_MEASURED` · 逐项给原因 · **禁填 0 / 空**）

见本册 **§18.9**（**六项**）—— 摘要：① 8⑦ 读口实现面未实现；② `manage_points` 现库覆盖面无库读数；③ `AG1`/`AG3` 判负未实跑；④ 行锚在实现单落盘后须重锚（`HEAD` blob ≠ 工作树）；⑤ `review_tasks` 消费面行号为**转引**；⑥「引用纪律」的判负门**未实现 / 未跑（含第 ④ 条负对照）**。**本 delta 件无新增未测项。**

---

## §D10 复算命令（逐条可直接现取）

```bash
cd /Users/kevin/bistro/seafood
git diff --numstat docs/route-layer.spec.md docs/data-layer.spec.md
cmp docs/versions/route-layer.spec.v2.3.md docs/route-layer.spec.md
cmp docs/versions/data-layer.spec.v0.11.md docs/data-layer.spec.md
git diff --name-status HEAD -- docs/versions/          # 空
git status --porcelain docs/versions/                  # 仅两件 ??
git ls-tree HEAD docs/versions/ | awk '{print $4}' | grep -c 'route-layer.spec.v'   # 22
git ls-tree HEAD docs/versions/ | awk '{print $4}' | grep -c 'data-layer.spec.v'    # 10
sed -n '3042p;3080p;3096p' docs/versions/route-layer.spec.v2.2.md                   # D-1 现取（对 v2.2 快照）
grep -n '§12.1.1:3042' docs/versions/route-layer.spec.v2.2.md                       # 1798 / 3922 / 4030
git show HEAD:backend-ts/src/index.ts | sed -n '1147p'                               # O-3 现取
sed -n '875p;914p;937p;942p;982p' docs/ledger.spec.md                                # 借码授权锚
grep -c 'AK1' docs/data-layer.spec.md                                                # 4（清单条目仅 1 处 = :1100）
wc -l -c docs/route-layer.spec.md docs/data-layer.spec.md
```

---

**收尾自证**：本件为**本单新建**（`docs/audit/` **既有件零改动**）；本单**未改任何被检物之外的件**；**未 `git add/commit/push`**。占位符计数（连续两条下划线）`grep -c '_[_]' docs/audit/route-layer-v2.3-delta.md` = **0**（该计数命令自身即本行）。
