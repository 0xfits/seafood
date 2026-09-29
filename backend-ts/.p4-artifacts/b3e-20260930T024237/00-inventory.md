# P4-B3e 交易所资金编排 — 本片「事件与端点清单」（**落盘先行**，动代码前）

- run tag = `b3e-20260930T024237` · 绝对路径 = `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3e-20260930T024237/`
- 权威 = `docs/route-layer.spec.md` v0.6 §4.2 M1/M2/M3（`:544/545/546`）+ §4.3 资金四栏 + §4.5 幂等键总表；`docs/data-layer.spec.md` v0.7 DL85/DL87/DL90 + DL68(v0.6 加注)/DL64/DL141-144

## 1 事件（= 编排函数 op，**恰好 3 个**）

| # | 事件 | op | 事件 kind（§4.1 关闭集内） | 事件根键（函数派生，§4.5） | 服务层 verb（本片） |
|---|---|---|---|---|---|
| M1 | 挂单 | `order` | `hold` ×2（同 uid 同 cid） | **create_key 即根键**（`cli:<uuid>`） | `placeMarketOrder` |
| M2 | 撤单 | `cancel` | `hold_release` ×2 | `biz:market:cancel:<order_id>` | `cancelMarketOrder` / `cancelAllMarketOrders` |
| M3 | 成交 | `trade` | `trade` ×4（+ `trade_fee` ×2 当 `fee>0`） | `biz:market:trade:<taker_order_id>:<fill_no>` | `matchMarketOrders` |

**不在本片**：`commission`（十级返佣）= §4.2/§4.3 交易所行**均无要求** ⇒ 不做不假设；第 7 条分录「价差改善释放」= DL85 v0.6 加注 + §12.2-13 **明文待裁** ⇒ 不实现。

## 2 端点（**先现取**前端实际消费路径）：`grep -rho "/api/[a-z0-9/_:.-]*" frontend/src` ⇒ 命中 `/api/order` ×3、`/api/order/` ×1、`/api/market/`（读口 orderbook/trades）

| # | 路径 | 方法 | 前端消费读数 | 处置 | 注册点 |
|---|---|---|---|---|---|
| 1 | `/api/order` | **POST** | `frontend/src/pages/ShardPage.jsx:176`（body `{bID,side,price,volume}`） | **改接** → `placeMarketOrder`（M1） | 既有 `src/index.ts:731`（**不新增**） |
| 2 | `/api/order/:oID` | **DELETE** | `ShardPage.jsx:314` | **改接** → `cancelMarketOrder`（M2） | 既有 `:763` |
| 3 | `/api/order` | **DELETE** | `ShardPage.jsx:328`（body 式全撤） | **改语义** → 全撤 = 逐单 `op='cancel'`（**入参走 query、不读 body**，§1 #27/§7-5） | 既有 `:750` |
| 4 | `/api/market/order` | POST | **前端零调用** | §1.1「新命名」⇒ **服务层已交付、路由随批 4**（§1.8 待补行） | 不注册 |
| 5 | `/api/market/order/:orderId` | DELETE | **前端零调用** | 同上 | 不注册 |
| 6 | `/api/market/trade`（撮合入参） | POST | **前端零调用**（触发者 = 撮合服务） | §4.2 M3「撮合服务调用」⇒ **只交付服务层**，路由随批 4 | 不注册 |

**注册点基线 = 53**（`grep -cE '^app\.(get|post|put|delete|patch)\(' src/index.ts`，片前/片后各取一次，报告 §5 报数）。

## 3 本片必须兑现的两条非代码面义务

1. **DL68 币对级串行化**（v0.6 加注：**义务不在 DB 层** ⇒「登记为 P5 路由层 / 撮合服务的必须交付项」）⇒ 本片在**唯一写语句**外层 CTE 取 `pg_advisory_xact_lock(base_cid::int4, quote_cid::int4)`；**并发面实测**（同币对两笔并发成交 ⇒ 串行、无超额成交）。
2. **§1.8 待补行**（v0.6 三方分工：Kong 收尾报「认领 N / 未认领 M」）⇒ 本片新增「已实现·未注册」= **3 条**（`placeMarketOrder`→`POST /api/market/order`、`cancelMarketOrder`→`DELETE /api/market/order/:orderId`、`matchMarketOrders`→撮合入参路径）⇒ 全部**未认领**（路由随批 4）⇒ 表格式待补行见报告末节。

## 4 边界（本片**不做**）

- 不写 `migrations/**`、不写任何 spec、不写 `src/ledger.ts` / `src/ledger-errors.ts` / `src/commission.ts` / `frontend/**`、不改 `.env.local`、不 `git add/commit/push`、不删任何数据行。
- 不新增 kind、不改任何白名单、不新增编排函数（唯一资金写路径 = 既有 `public.market_post_event`）。
- `quote_cid` 恒 `1`（DL64）；`price` 只允许「买单限价」（DL85 ⇒ 不实现第 7 条分录）。
