# route-layer.spec v2.31 delta · JING-SPEC-A5-RT（2026-10-12）

> 单号 **JING-SPEC-A5-RT** · 作者角色 = Jing（Specifier · 制度员）· 依据 = Kevin 2026-10-12 逐字「直接 A+C」+ Zang 结构裁定 1–9（`docs/OPEN-ITEMS.md` `A5` 行，commit `3ae743e`）。姊妹册 = `data-layer.spec` **v0.32 §38**（库侧面）+ `design-system.spec` **v1.17 §20**（形态/键集）。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| 路由族定稿 `/api/messages/*` + `/api/telegram/*` | Zang 建议「建议族名」（按仓内命名惯例定稿） | §41.0 / §41.2 |
| 6 条 `/api/messages` 契约（开会话/列表/消息列表/发消息/读水位/未读总数） | Z1/Z2/Z7 + DL25 | §41.2 #1–#6 |
| 4 条 `/api/telegram` 契约（bind/start、unbind、bind/status、webhook） | Z4/Z5/Z8 | §41.2 #7–#10 |
| `F19` 读口扩展（`GET /api/prize/:bID` 增 `seller{uid,nickname,avatar}`） | Zang 结构 10 | §41.3 |
| authz 矩阵（登录/参与者/双方/secret + 零管理员旁路） | Z2/Z9 | §41.4 |
| 新错误码域 `MSG_*` 7 码 + `TG_*` 5 码（`LEDGER` 33 不动；借 `LEDGER_IDEMPOTENCY_*`） | 「错误码闭集现 = 33；新增码必须登记」+ AG1/AG3 借码体例 | §41.5 |
| 注册点 89 → 99（+10）+ `p7b-03 AC10-2` 前推 `regs === 99` | 注册点现取 89（§40.2 口径）+ 冻结面前推惯例 | §41.6 |
| 通知语义（webhook + `waitUntil`、双语一行不带内容、失败不回滚） | Z3 + crons 1 条天级（bot 轮询不可行） | §41.7 |
| 幂等契约（#4 = `cli:` 前端供键；#1 = 自然键服务端派生） | buy/publish 体例 + §4.5 选项 B | §41.8 |
| 降级口径（`503 TG_NOT_CONFIGURED`，非 500；站内信永不降级） | Z8 | §41.9 |
| v2.27 §37「X/推特接驳位预留」语义替代 = Telegram | 本单方向变更（v2.27 原文一字不动，历史留痕） | §41.0 术语替代 |

## §B 改前 / 改后自证（真读数）

| 项 | 改前 | 改后 |
|---|---|---|
| 行数 | 8062 | 8191（+129） |
| 字节 | 1,575,312 | 1,596,146（+20,834） |
| md5 | `781fc726609d9135793497b348c2ac37` | `52be34e75110bb5cff0c312aa22f1711` |
| `git diff --numstat` | — | `129 0`（**删除列 = 0** ✓；非追加改动 = 0 处） |
| 快照 `docs/versions/route-layer.spec.v2.31.md` | — | `cmp` = 0（逐字节相同）✓ |
| 改前快照对照 | `docs/versions/route-layer.spec.v2.30.md`（上轮镜像，未动） | — |

## §C 范围自证

- 本单改动文件 = **恰 2**：`docs/route-layer.spec.md` + 新建快照（+ 本 delta 件）。
- **未改** `frontend/**` / `backend-ts/**`（含 `index.ts` / `p7b-03-offline-gates.ts` —— `AC10-2` 前推**只登记、由实现单执行**）/ `vercel.json` / `docs/seafood.master-plan.md` / `docs/OPEN-ITEMS.md`；未跑任何门；未 `git add -A` · 未 commit · 未 push。
- **§1–§40 一字未动**（追加式自证 = 删除列 0；顶部 v2.31 状态块 = 纯插入）。
