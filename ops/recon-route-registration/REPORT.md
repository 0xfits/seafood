# 对账口 route 侧补登记 · `GET /api/ops/recon/ledger`（v2.36 §46）

- 仓：`/Users/kevin/bistro/seafood`（分支 `main`，开工基线 **HEAD `9611a58`**；**收笔时 HEAD 已前推至 `1ba0b5b`** = 并行入库的生产终验单，**非本单**）
- 性质：**纯文档补登记**。实现**先行已上线**（`a201cb3` / `3423a4b` / 质检 `9611a58`），本单只补**契约面**。
- 写入面：`docs/route-layer.spec.md`（**+153 / −0**：顶部 v2.36 状态块 + 新 **§46**）+ `docs/OPEN-ITEMS.md`（**+1 / −0**：顶部 v2.37 块 / `D1` 待裁）+ 本证据目录。
- **硬约束自证**：`git diff --numstat` 删除行 **= 0**（`readings/numstat.txt` §2 `deleted_lines_total=0`）；`backend-ts/**` / `frontend/**` / `vercel.json` **零改动**；**库面零连接**（读数全部转引 `ops/recon-cron/**` 已落盘产物）；**未 push**。
- 取证时间：**2026-10-17 11:1x CST**（读数见 `readings/numstat.txt`，命令逐条可复跑）

---

## 0. 结论先行

| 项 | 结果 |
|---|---|
| 新口 | **`GET /api/ops/recon/ledger`**（注册行 `backend-ts/src/index.ts:3242`；handler `:3210-3240`） |
| 归类 | **运维口**（无 `actor` · 前端 0 调用 · 唯一调用方 = `vercel.json` cron + 值班人 curl） |
| 鉴权 | `CRON_SECRET` 未配 ⇒ **503 fail-loud**；`Bearer` / `x-cron-secret` 不符 ⇒ **401**（`AUTH_UNAUTHORIZED`）；密钥**等值比较、不回显、不日志** |
| 方法 | **仅 GET**；同路径 `POST` ⇒ **404**（实测，reading `E2_post_not_registered`） |
| 回执 | 既有 `sendSuccess` ⇒ `{success, message, data:{ok, checks[3], checked_at, duration_ms}}`；**零新错误码**（503/401 均既有形态） |
| 只读 | 三条单语句 `SELECT`（`readQuery` 只读池）⇒ 零写库 / 零迁移 / 零新表 / 零新列 |
| 判定口径 | 守恒式 `total_supply == Σmint + Σburn`（burn 存负 delta · `p9-s4-bttc.md` `KI2`）+ 供应量 **`diff === 基线常量`**（`{'1':'2000000','21':'1'}`、未登记 cid ⇒ 0）⇒ **无容差 / 非不等式 / 禁 `>=`**；后两条严格 **0 行** |
| cron | `vercel.json` `crons` 现 **2 条**：`0 18 * * *`（backfill，未动）+ **`30 18 * * *`**（本口）；Hobby = **100 条/项目** · 每天 1 次 · **±59 min 非准点** |
| 注册点 | **107**（get 47 / post 56 / put 0 / delete 3 / patch 1）；门 `AC10-2` = `regs === 107`（`scripts/p7b-03-offline-gates.ts:150`） |
| 待裁 | **`D1`**（漂移仍 `200` ⇒ 面板不红）已登 `docs/OPEN-ITEMS.md` 顶部 v2.37 块 |

---

## 1. 写入面（逐文件）

| # | 文件 | 动作 | 规模 |
|---|---|---|---|
| 1 | `docs/route-layer.spec.md` | 顶部插 **v2.36 状态块**（状态行 / 修订入口 / 要点 ①–⑤）+ 文末追加 **§46**（46.0–46.7） | **+153 / −0** |
| 2 | `docs/OPEN-ITEMS.md` | 顶部（preamble 末位 · `---` 之前）追加 **`★ v2.37 / D1 待裁追加`** 块 | **+1 / −0** |
| 3 | `ops/recon-route-registration/REPORT.md` | 本件 | 新建 |
| 4 | `ops/recon-route-registration/readings/numstat.txt` | 读数（numstat / 锚点 / 注册点 / 门常量 / cron / 行号 / 工作树） | 新建 |
| 5 | `ops/recon-route-registration/readings/prod-recon-nokey.json` | **逐字节转引** `ops/recon-cron/readings/prod-recon-nokey.json`（生产无密钥 `401` body；转引时该件为工作区**未入库稿**，其后由并行单 `1ba0b5b` 入库 ⇒ 现已在册，本副本保留以**自带证据**） | 新建（内容 = 转引） |

---

## 2. 位置自证（**与任务书写法的偏差已在此显式登记**）

- 任务书写作「最新在上倒序；新版本行前插在真表第一行之上、新 §号前插在当前最大 § 之上」。**本册实测体例 = 升序追加**：状态块按版本升序排列（v0.8 `:3` → … → v2.34 `:373` → **v2.35 `:383`**），节号升序（… §44 `:8388` → §45 `:8549`），且 §45.4 逐字自证「**§45 紧接 §44 文末**（前值最大节号 = §44 · 本节 = §45，**无跳号**）」。
- ⇒ 本单**按实测体例落位**：**v2.36 状态块紧随 v2.35 块的 ④ 行之后**（`:389`，其后仍是 v2.19 历史块）；**§46 紧接 §45 文末**（`:8646`，无跳号）。
- **未按任务书字面「前插」的理由**：任务书自身要求「**绝不破坏 `^### 5.NNN` / 倒序结构；宁缺不破**」。在本册把 §46 插到 §45 **之前**会直接打乱升序结构、并让 §45.4 的「无跳号」自证变成假陈述 ⇒ 取「**不破坏结构**」优先。
- 判定：**版本 / 节号锚点各恰 1 命中**（`readings/numstat.txt` §3：`v2.36_status_hits=1` / `section46_hits=1` / `v2.37_openitems_hits=1`）。

---

## 3. 内容落位对照（任务要求 → 正文节位）

| 任务要求 | 落位 |
|---|---|
| 新口 = 运维口 / 非常规用户面（无 actor） | §46 头部「归类（写死）」+ §46.1 表 `actor` 行 |
| 鉴权：未配 ⇒ 503 / 不符 ⇒ 401 / 等值比较 / 不回显不日志 | §46.1（逐项表）+ §46.1(b) 状态矩阵（`A1` / `B1`–`B3` / `C1`–`C2` / `E1`–`E2`）+ 判负 #6 #7 |
| 方法：**仅 GET**（同路径 POST ⇒ 404，已实测） | §46.1 `方法集` 行 + 状态矩阵 `E2` + 判负 #5 |
| 回执 = 既有 `sendSuccess` 键集 + **零新错误码** | §46.1「回执（`data` 层 / 外层包装 / 错误码面）」 |
| 只读：三条单语句 SELECT / 零写库零迁移零新表 | §46.1「只读性」+ §46.0 表 + 判负 #9 |
| 判定口径：守恒式（burn 负 delta · `KI2`）/ `diff === 基线` / 常量表 / 未登记 cid ⇒ 0 / 禁 `>=` | §46.2(a)(b)(c) + 判负 #1 #2 #3 |
| 后两条 = 严格 0 行 | §46.2(d) |
| 基线出处 `B25` / 生产现取逐位相同 / cid21 惰性 | §46.2(c) |
| 漂移仍 200 · 一条 `console.error` · **不得写「已告警」** · 残余风险 = `D1` 待裁 | §46.4（**全节**）+ OPEN-ITEMS v2.37 块 + 判负 #8 |
| cron 2 条 + Hobby（100 条/项目 · 每天 1 次 · ±59 min 非准点）⇒ 不得称「准时」 | §46.3(a)(b)(c) + 判负 #10 #11 |
| 注册点 107（get 47 / post 56 / put 0 / delete 3 / patch 1）+ 门同批前推 | §46.5 + `readings/numstat.txt` §4–§5 |
| OPEN-ITEMS 顶部小块：`D1` 待裁 + 两选项 + 首次生产回执待次日窗口 | OPEN-ITEMS 顶部 v2.37 块 |
| 纯追加 / 删除行 = 0 | §46.7 + `readings/numstat.txt` §1–§2 |

---

## 4. 事实核对（本单现取，非转引）

| 事实 | 现取命令 | 读数 |
|---|---|---|
| 注册点 107 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **107** |
| 逐 verb | 同上按 verb 分别计 | get **47** / post **56** / put **0** / delete **3** / patch **1** |
| 注册行 | `grep -n "app.get('/api/ops/recon/ledger'" backend-ts/src/index.ts` | `:3242` |
| 门常量 | `grep -n "AC10-2" backend-ts/scripts/p7b-03-offline-gates.ts` | `:150` `regs === 107` |
| cron 2 条 | `grep -n '"path"\|"schedule"' vercel.json` | `:36-37` `0 18 * * *` / `:40-41` `30 18 * * *` |
| 文件规模 | `wc -l` | `src/index.ts` **3545** / `src/ops-recon.ts` **247** |

**转引（不重跑 · 已在正文标来源）**：探针 **14 臂 / 23 断言全 `true`**（`ops/recon-cron/readings/probe-recon-auth.json`）；质检 9 AC（`AC1`–`AC8` = PASS · `AC9` = REGISTERED）+ `drift` 4 条 + `env_limited` 3 条（`ops/recon-cron/qa/verdict.json`）；生产对拍 `cid=1 diff=2000000`（逐位相同）/ `cid=21` 0 行（同件 `zang_acceptance`）；生产无密钥 `401`（`readings/prod-recon-nokey.json`，逐字节转引；原件已随并行单 `1ba0b5b` 入库）。

---

## 5. 未做项（显式登记，不冒充已做）

1. **`docs/versions/route-layer.spec.v2.36.md` 未建** —— 快照重制归版本收口单（承 §45.4 同族处置）。
2. **首次生产回执未取** —— 待次日 **UTC 18:30 窗口**后现取（Hobby 触发落在小时窗口内、**非准点**（`±59 min`））；`ENV_LIMITED`：legacy `builds`+`routes` 形态下「cron 是否真注册并触发」离线不可证。
3. **`D3` 的生产侧口径复核未做** —— 检查①只聚合 `mint`/`burn`（20 kind）的自洽性仅 dev 实测；正文 §46.2(e) 已登记为「建议」。
4. **`D1` 未裁** —— 两选项（保持 200 + 接外部告警 / 改 500 让平台标红）交 Kevin，本册不预判。

---

## 6. 未破结构自证

- `grep -c '^## ' docs/route-layer.spec.md` = **50**（改前 49 + §46 = **50**，无重复、无缺失）。
- 节序尾 = §43 / §44 / §45 / **§46**（升序，无跳号）；标题层级 `^## ` / `^### ` / `^#### ` 未被破坏。
- `docs/OPEN-ITEMS.md` 结构未变：新块落在 preamble **末位**（v2.36 块之后、`---` 之前），`## A`–`## F` 六个节头**位置与内容未动**。
