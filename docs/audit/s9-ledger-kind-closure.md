# S9 · `ledger.kind.*` 缺键补齐 + 守卫（Kong）

- 单号：S9（独立质检 Neng 的 finding，Zang 已复核成立）
- 开工基线：`git log --oneline -1` = **`9f5b2aa`**（S8 locale 缺键类级扫面）
- 仓库：`/Users/kevin/bistro/seafood`　**未 commit / 未 push**
- 硬口径遵守：不 `npm install`；未碰 `.env*`（除经应用自身 `dotenv` 载入连接串，见 §1 口径）；未起/占端口；未 `pkill/killall`；未启停 5787/5788。

---

## 0. 结论（一句话）

`LEDGER_KINDS`（TS 常量，24 值）与 DB `ledger_kind_enum` CHECK（24 值）**两源逐值相等**；
四语 `ledger.kind` 由 **20 键 ⇒ 24 键**，**缺键差集 = 0**（两源对账 + 逐处清单见 §1）；
新增「族 vs 后端关闭集」守卫测试（含注入必红自证）；全量 vitest **零新增失败**（7 failed 与基线同）；`build` RC=0；两 i18n 脚本 RC=0。

---

## 1. 两源对账 + 缺键逐处清单

### 1.1 口径（现取，非采信工单）

| 源 | 取法 | 读数 |
|---|---|---|
| **A · TS 常量** | `fs` 现读 `backend-ts/src/ledger.ts` 的 `export const LEDGER_KINDS = [...] as const` | **24 值**，末位 `invite_first_task_reward` |
| **B · DB CHECK** | **活库现取**：`pg_constraint` + `pg_get_constraintdef()` 读 `public.ledger_entry` 的 `ledger_kind_enum`（`contype='c'`；列型 `information_schema.columns.udt_name='text'`） | **24 值** |
| **locale** | 四语 `src/locales/{zh,en,hk,vn}.json` → `ledger.kind` 键集 | **各 20 键（改前）** |

- **A == B**：逐值相等（`true`）。两源同集，无漂移。
- DB 取数口径：本机**无本地 PG 服务**（无监听 / 无 unix socket / 无 `psql`），硬口径禁起服务；故经**应用自身**连接层（`src/env.ts` + `dotenv` 载入 `.env.local` → Neon pooler）执行**只读单语句** `SELECT pg_get_constraintdef(...)`；**未读取 / 未打印任何 `.env` 内容**。DB CHECK 现取 = 24 值（见 §1.3 捕获原文）。
- 交叉源：`0038_kind_close_set_24.sql` 内 `ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (...))` 逐值 == A（同一关闭集的迁移编码）。

### 1.2 缺键逐处清单（locale 键集 相对 关闭集的差集）

**改前（四语皆同）缺 4 键**（非差集里的其余 20 键齐备）：

| # | 缺键 | 语义 | 出处（关闭集成员，曾无 locale 键） |
|---|---|---|---|
| 1 | `checkin_makeup_fee` | 补签费 | `LEDGER_KINDS[21]`（P9② `R-9-14` 扩容 +1） |
| 2 | `bttc_mint_fee` | 铸币费 | `LEDGER_KINDS[22]`（P9④ `R-9-36` 扩容 +2） |
| 3 | `bttc_burn_fee` | 销币费 | `LEDGER_KINDS[23]` |
| 4 | `invite_first_task_reward` | 邀请首任务奖励 | `LEDGER_KINDS[24]`（P9⑤ `R-9-65` 扩容 +1） |

> 复核结论：**恰 4 处**，工单所报 4 键**逐字成立**，无第 5 处；亦无「多键」（locale 无越集键）。
> 差集 = 0（改后）：`zh/en/hk/vn` 各 `keys=24, missing=[]`。

### 1.3 DB CHECK 现取原文（原文截断留证）

```
CHECK ((kind = ANY (ARRAY['mint', 'burn', 'transfer', 'hold', 'hold_release', 'hold_forfeit',
 'job_escrow', 'job_escrow_refund', 'job_payout', 'job_fee', 'commission', 'purchase', 'sale',
 'purchase_refund', 'trade', 'trade_fee', 'listing_fee', 'listing_deposit', 'currency_create_fee',
 'reversal', 'checkin_makeup_fee', 'bttc_mint_fee', 'bttc_burn_fee', 'invite_first_task_reward']::text[])))
```
（`contype='c'`；`udt_name='text'`；计数 = **24**）

---

## 2. 四语补齐（逐字 · en/vn 零 CJK）

新增 4 键（**只追加于 `reversal` 之后**，不改既有 20 键次序）：

| key | zh | en | hk | vn |
|---|---|---|---|---|
| `checkin_makeup_fee` | 补签费 | Makeup check-in fee | 補簽費 | Phí điểm danh bù |
| `bttc_mint_fee` | 铸币费 | BTTC mint fee | 鑄幣費 | Phí đúc BTTC |
| `bttc_burn_fee` | 销币费 | BTTC burn fee | 銷幣費 | Phí đốt BTTC |
| `invite_first_task_reward` | 邀请首任务奖励 | Invite first-task reward | 邀請首任務獎勵 | Thưởng nhiệm vụ đầu tiên do mời |

- 口径：**en / vn 零 CJK = true**（逐键 `CJK.test()` 现取）；hk 繁体、zh 简体；四语皆非占位/非空。
- 文案依据：`补签`（既有 `checkinPanel.makeupButton` = 补签/補簽）、`BTTC`（既有 `bttcPanel.title` = BTTC 代币 / BTTC Token，用户面词表既有）；`mint`/`burn` 既有文案为 铸币/销毁（`ledger.kind.mint/burn`），新键为**费腿**故取「…费」。

---

## 3. 守卫测试（族 vs 后端关闭集）+ 注入自证

新增文件：`frontend/src/test/unit/s9-ledger-kind-closure.test.js`（10 tests · 全绿）

- **S9① 两源对账**：`TS_KINDS`（现读 `ledger.ts`）== `KINDS_MIRROR`（镜像常量，防「解析失效却静默通过」）== `DB_KINDS`（现读 `0038` CHECK 编码）；并列断言 `length==24`。
- **S9② 族 == 关闭集（可判负）**：四语 `ledger.kind` 键集与关闭集**双向**求差（缺 / 多皆判负）⇒ 差集 `[]`；键值非空；en/vn 零 CJK；新增 4 键逐字断言。
- **S9③ 计数前推**：顶层 119 / 拍平 **1059** / 四语节点 **4236**。
- **S9④ 注入自证（可判负核心）**：
  - 合成 locale 删 `invite_first_task_reward` ⇒ `kindDiff().missing == ['invite_first_task_reward']`（红点）；
  - **逐键遍历**（删 24 键之一皆必红）；
  - 完整键集 ⇒ 无命中（可逆）；
  - 注入多余键（`__unknown__`）⇒ `extra` 命中（**严格相等**，非「只查缺」）。

**★ 真件注入自证（非仅合成源）**：从 `src/locales/zh.json` **删掉** `checkin_makeup_fee` ⇒ 跑本守卫 **6 failed / 4 passed**，红点文本：

```
AssertionError: expected [ 'zh 缺 [checkin_makeup_fee]' ] to deeply equal []
 ❯ s9-ledger-kind-closure.test.js > S9② … 四语皆无缺键、无多余键（缺口差集 = 0）
```
随即**精确复原**：`src/locales/zh.json` md5 复原前后一致（`c500bcc5d12f1200b3b9d4825a35be7c`）。

> **`.unknown` 兜底（可选）决策 = 不加**：本守卫已把「族 == 关闭集」写成**双向严格相等**断言，未来新增 kind 而未补 locale ⇒ CI 必红（构建期即拦截）；且 DB `kind` 为封闭 CHECK + TS 关闭集双重约束，运行时 kind ⊆ 24 ⇒ 兜底收益近零。若加 `ledger.kind.unknown` 反而会使「键集 == 关闭集」不成立（须为守卫开白名单），引入例外。故**不改** `ProfilePage.jsx` / `MarketPage.jsx`（保持文件面最小）。

---

## 4. 计数前推（逐条登记订正既有计数断言 · 非删断言）

`ledger.kind` +4 键/语 ⇒ **顶层 119 不变 / 拍平 1055→1059 / 四语节点 4220→4236**。
逐文件订正（**改值 + 补 S9 出处注**，断言一条未删）：

| 文件 | 订正处 |
|---|---|
| `test/unit/s8-locale-key-coverage.test.js` | `181/184/186`：flat 1055→1059、nodes 4220→4236 + 标题补 S9 |
| `test/unit/s7-submissions-panel.test.jsx` | `18/295/296/299/301` |
| `test/unit/s5-publish-headcount.test.jsx` | `81/84/86` |
| `test/unit/i18n-batch-b4a.test.jsx` | `145` |
| `test/unit/i18n-batch-b4b.test.jsx` | `256/321` |
| `test/unit/i18n-batch-b5.test.jsx` | `215/256` |
| `test/unit/r9-93-points-symbol.test.jsx` | `185/191/192` |
| `test/unit/r9-96-dashj-copy.test.jsx` | `119/125/126/129/130` |
| `test/unit/i18n-violation-closeout.test.jsx` | `10`（陈旧注释 20→24）/`81/126` |

脚本读数（现取）：
- `p6-tr2-i18n-locales.mjs`：`zh/en/hk/vn: top=119 flat=1059`；键集相等 PASS。
- `p4z-i18nviol-global.mjs`：`作用域命中节点数 = 4236（键 1059 × 语 4）`。

---

## 5. 自证读数（逐条）

| # | 判据 | 读数 |
|---|---|---|
| ① | 缺键差集 = 0（两源对账）+ 逐处清单 | A==B（24）；四语 `missing=[] extra=[]`；见 §1.2 |
| ② | 四语键逐字（en/vn 零 CJK） | §2；en/vn CJK=false |
| ③ | 守卫绿 + 注入必红 | 新测试 10 passed；删键 ⇒ 6 failed（红点 `zh 缺 [checkin_makeup_fee]`），md5 复原 |
| ④ | `npx vitest run` 全量 | 基线 `4 failed files / 7 failed | 429 passed (436)`；**改后 `4 failed files / 7 failed | 439 passed (446)`** ⇒ **失败集逐条相同，零新增**（+10 = 本单新测试） |
| ⑤ | `npm run build` | **RC=0**（`✓ built in 1.70s`） |
| ⑥ | 两 i18n 脚本 | `p4z-i18nviol-global.mjs` RC=**0**（总判 PASS）；`p6-tr2-i18n-locales.mjs` RC=**0**（总判 PASS） |
| ⑦ | 计数前后 | 前 1055/4220 ⇒ 后 **1059/4236**（§4） |

基线 7 项失败文件（与本单无关，逐条相同）：`Accessibility.test.jsx` / `Card.test.jsx`（×5 用例）/ `e2e/basic.spec.js` / `performance/VirtualList.test.jsx`。

---

## 6. 改动文件面

- **改**：`frontend/src/locales/{zh,en,hk,vn}.json`（各 +4 `ledger.kind` 键）
- **增**：`frontend/src/test/unit/s9-ledger-kind-closure.test.js`
- **改**：`frontend/src/test/unit/{s8-locale-key-coverage.test.js, s7-submissions-panel.test.jsx, s5-publish-headcount.test.jsx, i18n-batch-b4a.test.jsx, i18n-batch-b4b.test.jsx, i18n-batch-b5.test.jsx, r9-93-points-symbol.test.jsx, r9-96-dashj-copy.test.jsx, i18n-violation-closeout.test.jsx}`（计数前推 + S9 出注）
- **增**：本报告 `docs/audit/s9-ledger-kind-closure.md`
- **未改**：`backend-ts/**`、`docs/*.spec.md`、`migrations/**`、`ProfilePage.jsx`、`MarketPage.jsx`、两 i18n 脚本（均未触碰）。
