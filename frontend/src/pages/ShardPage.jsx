// ============================================================================
// ShardPage → 交易所线（P4-B4c-ii-b / Kong）—— 薄壳：路由与导航不动，页面体整体换新
// ============================================================================
// 四项确认 ④ · 本文件旧实现的 sunset 面调用**逐条处置**（旧行号 = 改动前）：
//   · `:316` `fetchApiJson('/api/shard')`                  ⇒ **删除**（§5.2「碎片读口 ①」= 保留路径 + 恒空态 +
//        `deprecated:true`；spec 逐字「**禁止**新代码再调 `/api/shard`」。迁移目标 `GET /api/user/points`
//        **未注册** ⇒ 不迁、登记）
//   · `:318` `fetchApiJson('/api/shard/transfer')`         ⇒ **删除**（同族读口，恒空态 + `deprecated`）
//   · `:43-44` `/api/market/${bID}/orderbook|trades`       ⇒ **删除**（`:bID` 语义已改为 `base_cid`；旧「碎片/奖品 bID」口径错）
//   · `:186` `POST /api/order` body `{bID,side,price,volume}` ⇒ **删除**（缺 `create_key` 必 400；且 `bID` 旧口径）
//   · `:329` 单撤（`DELETE /api/order/:oID`）与 `:346` 全撤（旧 body 式 ⇒ §2.4 S4）
//        ⇒ **按已注册口径重做**：单撤 `DELETE /api/order/:oID`、全撤 `DELETE /api/order`（**query only**、不发 body）
// 现页面 = `./market/MarketPage.jsx`：行情/订单簿/成交流水（公开只读）+ 挂单/撤单/我的挂单 + 「账本流水」空态
//   （账本流水读口未注册 ⇒ 只有空态、不自造 —— 四项确认 ②）。
import MarketPage from './market/MarketPage'

export default MarketPage
