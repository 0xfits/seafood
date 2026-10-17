# 登记单收口记录 · BTTC 明文口径登记 + `bttc.usdBalance` 契约增量

- **性质**：`docs/**` 登记单（零代码 / 零迁移 / 零 HTTP / 零套件）
- **作者角色**：Jing（Specifier）派单执行 · 由 Zang 补齐本报告并提交（子代理在最后一轮 `write_file` 前耗尽工具轮次，报告未落盘 ⇒ 内容与读数由 Zang 依盘面现取复核后补写）
- **基线**：开工 `2da49e0`；收口时 HEAD 已含并行两笔（`eebe883` 实现单 / `49abbd4` 评估单），本单只写 `docs/**` 与 `ops/bttc-plaintext-registration/**`

## 一、改动清单（纯追加，删除行 = 0）

| 文件 | numstat（+ / −） | 内容 |
|---|---|---|
| `docs/OPEN-ITEMS.md` | **3 / 0** | 顶部 `v2.35 追加` 块 + 表内 **`B30`** 行 |
| `docs/route-layer.spec.md` | **106 / 0** | 状态块 **v2.35** + 正文 **§45**（§45.0–§45.3） |

复核命令与输出见 `readings/numstat-and-anchors.txt`。

## 二、`B30` 登记要点（逐条与 Kevin 口径一致）

1. **现状四落点**：`account.balance`（uid + cid=BTTC）/ `currency.total_supply`（symbol='BTTC'）/ `app_config.value`（key=`mint_burn_policy` 五键 JSON）/ `ledger_entry.delta`（append-only）。
2. **全链零字段级加密**：`grep -rnE 'encrypt|AES|pgcrypto|kms' backend-ts/src` = 0 命中。
3. **不可只加密 BTTC 的归因**：余额挂通用 `account(uid,cid)`、与 `$`（cid=1）共用同一读写路径 ⇒ 字段级加密打穿三条不变量（`total_supply == Σmint + Σburn`（burn 存负 delta，符号约定见 `docs/audit/p9-s4-bttc.md` KI2 勘误）/ `ledger_entry` 配对不变式 / `account ↔ ledger_entry` 逐户对账），并使库内 `SUM` 与索引在密文上失效。
4. **现有对冲**：`ledger_entry` append-only + `total_supply` 双写 + 审计台。
5. **缺口**：对账未定时化（`vercel.json` `crons` 仅 1 条）—— 关联评估单 `49abbd4`。
6. **解禁条件**：BTTC 一旦承诺「可提取 / 可兑换 / 上链」⇒ 本临时口径失效，须升级为「隔离（独立表 / 独立 DB 角色）」或「字段加密」。
7. **待确认**：托管侧 at-rest 加密属供应商口径，仓内无证据，不作背书。

## 三、`§45` 契约增量（与实现单 `eebe883` 逐字对齐）

- **A**：`GET /api/batt` → `data.bttc.usdBalance`（字符串，来源 `getBttcState` 既有返回字段；零新查询 / 零新表 / 零新列）。外层 `data` 6 键冻结未动；`bttc` 子对象 **10 → 11 键**。
- **B**：四语文案面新增 `bttcPanel.mintNeedBatt` / `bttcPanel.mintNeedUsd`（铸造缺额提示，纯展示，不参与金额决定）。键集基线前推：拍平 **1104 → 1106** / 四语节点 **4416 → 4424**（顶层 128 不变）。
- **C**：注册点 / 权限键 / 错误码 / 幂等键 **零变更**。

## 四、复核读数（Zang 现取）

- `git diff --numstat`：`docs/OPEN-ITEMS.md = 3 0` · `docs/route-layer.spec.md = 106 0` ⇒ 删除行合计 **0**。
- 锚点：`v2.35` 状态块 1 处（`:381`）· `## §45` 1 处（`:8540`）· `B30` 行 1 处（`:66`）；节号尾序 42/43/44/45 无跳号；占位符残留 0。
- 四语现取：`zh/en/hk/vn` 各 flat **1106** / top **128** / 四语节点 **4424**；四语键集差集 = 0（missing 0 / extra 0）。

## 五、未做与不做

- 未改任何代码、未新增路由、未改迁移、未写库、未 push。
- 未改 `docs/seafood.master-plan.md` 台账（收口节待实现单质检通过后与版本行一并前插，避免账实错位）。
