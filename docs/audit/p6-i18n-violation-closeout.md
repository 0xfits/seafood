# P6 · I18N-VIOL-CLOSEOUT —— 全量清「工程口语」进用户文案

**范围**：`/shard`（= `pages/market/MarketPage.jsx`）、`/listing`（`pages/listings/ListingsPage.jsx`）、
`/listing/:id`（`pages/listings/ListingDetailPage.jsx`）三条线上把**实现细节**展示给用户的文案；
按「类级断言必须跑在**全量面**」的纪律，扩到 `frontend/src/locales/{zh,hk,en,vn}.json` 的**全部值** +
`src/pages|components|shell` 的**全部源文件**。

## 0. AC 读数（自跑，逐条给口径与退出码）

| AC | 命令 | 读数 | 判 |
|---|---|---|---|
| ① | `npm run build`（cwd=`frontend`） | `✓ built in 1.41s`；`echo $?` = **0** | PASS |
| ② | `npm run test:unit` | `Test Files 21 passed (21)` / `Tests 189 passed (189)`（基线 184 ⇒ **+5**） | PASS（≥184） |
| ③ | `node scripts/p6-tr2-i18n-locales.mjs` | 四语 `top=102 / flat=678`；键集相等 PASS；**总判 PASS**；`TR2_EXIT=0` | PASS（键集/键名未变） |
| ④ | `node scripts/p4z-i18nviol-global.mjs` | **locale 作用域节点数 = 2712**（678 键 × 4 语）裸命中 **0**；源面（63 文件 / 37 文案节点）裸命中 **0**；子面③ 硬编码中文文案字面量 32 个，命中 **0**；`EXIT=0` | PASS（命中 = 0） |
| ⑤ | 本文件 §2 逐条 before/after 对照表 | 34 键 × 4 语 | PASS |

## 1. 根因与纪律修正（写进本单的类级口径）

- **根因**：B4b 的类级断言只扫「本批写集」⇒ `frontend/src/locales/*.json` 的**全量语料从未被扫过**。
  于是 `GET /api/…`×5 + `POST /api/…`×2、`403`、`400`、`base_cid`、`listing.stock` 这些实现细节
  **由源头收进 locale 并被翻成英/繁/越** —— 不是漏译，是收录口径错。
- **纪律**：本单脚本的作用域 = **全量 locale 四文件 + 全量页面源文件**，并**打印作用域命中的节点数**
  （`locale=2712` / `source=37` / 硬编码文案字面量 = 32）；命中 0 或节点数明显偏少 ⇒ 断言无效。
  豁免**逐条列名 + 理由**（见 §3.2），不设通配。

## 2. 逐条 before/after 对照表（键名 / 四语改前 / 四语改后 / 出现页面）

口径：`改前` 取自 `git show HEAD:frontend/src/locales/<lang>.json`（只读）；`改后` 为工作区现值。
**只改值、不改键名与键集**（四文件 `top=102 / flat=678` 不变）。

| 键名 | 出现页面（src/pages · src/components 内） | zh 改前 ⇒ 改后 | hk 改前 ⇒ 改后 | en 改前 ⇒ 改后 | vn 改前 ⇒ 改后 |
|---|---|---|---|---|---|
| `jobs.cidNote` | PublishJobPage.jsx:80 | 「币种编号：社区积分 $ = 1（币种读口尚未注册，暂手填）」<br>⇒ 币种编号：社区积分 $ 填 1 | 「幣種編號：社區積分 $ = 1（幣種讀口尚未註冊，暫手填）」<br>⇒ 幣種編號：社區積分 $ 填 1 | 「Currency id: community points $ = 1 (currency read endpoint is not registered yet - enter manually).」<br>⇒ Currency id: enter 1 for community points ($). | 「Mã tiền tệ: điểm cộng đồng $ = 1 (endpoint đọc tiền tệ chưa đăng ký - nhập tay).」<br>⇒ Mã tiền tệ: nhập 1 cho điểm cộng đồng ($). |
| `jobs.acceptNote` | JobDetailPage.jsx:199 | 「接受申请需填申请编号（「按招工列申请者」读口尚未注册，暂手填）；非雇主返回 403。」<br>⇒ 接受申请需填写申请编号；申请列表暂未开放，请手动填写。只有雇主可以接受申请。 | 「接受申請需填申請編號（「按招工列申請者」讀口尚未註冊，暫手填）；非僱主返回 403。」<br>⇒ 接受申請需填寫申請編號；申請列表暫未開放，請手動填寫。只有僱主可以接受申請。 | 「Enter the application id (the per-job applicant list endpoint is not registered yet - enter manually); non-employers get 403.」<br>⇒ Enter the application id to accept it; the applicant list is not open yet, so type the id in manually. Only the employer can accept an application. | 「Nhập mã đơn ứng tuyển (endpoint liệt kê người ứng tuyển theo việc chưa đăng ký - nhập tay); người không phải chủ việc nhận 403.」<br>⇒ Cần nhập mã đơn ứng tuyển để chấp nhận; danh sách ứng viên chưa mở nên hãy nhập tay. Chỉ chủ việc mới chấp nhận được đơn. |
| `jobs.submitNote` | JobDetailPage.jsx:157 | 「提交面 = 既有已注册路径 /api/task-progress/:identifier/submit（幂等键由服务端派生）。」<br>⇒ 提交后进入待审核状态；重复提交不会重复计酬。 | 「提交面 = 既有已註冊路徑 /api/task-progress/:identifier/submit（冪等鍵由服務端派生）。」<br>⇒ 提交後會進入待審核狀態；重複提交唔會重複計酬。 | 「Submission uses the existing registered path /api/task-progress/:identifier/submit (idempotency key derived server-side).」<br>⇒ After you submit, the work goes into review; submitting again does not count or pay twice. | 「Nộp bài dùng đường dẫn đã đăng ký /api/task-progress/:identifier/submit (khóa idempotency do máy chủ sinh).」<br>⇒ Sau khi nộp, bài sẽ vào trạng thái chờ duyệt; nộp lại không bị tính hay trả thù lao hai lần. |
| `jobs.publishNote` | PublishJobPage.jsx:126 | 「发布即把酬金从可用余额转入托管（job_escrow×2）；审核通过才发放。」<br>⇒ 发布后酬金会从可用余额转入托管，任务审核通过后才发放。 | 「發佈即把酬金由可用餘額轉入托管（job_escrow×2）；審核通過才發放。」<br>⇒ 發佈後酬金會由可用餘額轉入托管，任務審核通過後才發放。 | 「Posting moves the reward from available balance into escrow (job_escrow x2); payout happens on approval.」<br>⇒ Posting moves the reward from your available balance into escrow; it is paid out after the work is approved. | 「Đăng việc sẽ chuyển thù lao từ số dư khả dụng sang ký quỹ (job_escrow x2); chỉ trả khi được duyệt.」<br>⇒ Sau khi đăng, thù lao được chuyển từ số dư khả dụng sang ký quỹ và chỉ được trả khi bài được duyệt. |
| `jobs.reviewNote` | JobReviewPage.jsx:163 | 「队列 = 待审核提交；「通过」= 发放酬金并原子结算，「驳回」= 退回托管。」<br>⇒ 这里显示待审核的交付物：通过即发放酬金，驳回则退回托管。 | 「隊列 = 待審核提交；「通過」= 發放酬金並原子結算，「駁回」= 退回托管。」<br>⇒ 呢度顯示待審核嘅交付物：通過即發放酬金，駁回就會退回托管。 | 「Queue = pending submissions; Approve pays out atomically, Reject refunds the escrow.」<br>⇒ Pending submissions appear here: approving pays the reward, rejecting returns the escrow. | 「Hàng chờ = bài nộp chờ duyệt; Duyệt = trả thù lao theo giao dịch nguyên tử, Từ chối = hoàn ký quỹ.」<br>⇒ Đây là các bài chờ duyệt: duyệt thì trả thù lao, từ chối thì hoàn lại ký quỹ. |
| `listings.listNote` | ListingsPage.jsx:96 | 「读面 = GET /api/prize/all（已注册；读侧已换源 listing 表：bID=listing_id、name=title、points=price）。」<br>⇒ 以下为在售商品，点开可查看详情与库存。 | 「讀面 = GET /api/prize/all（已註冊；讀側已換源 listing 表：bID=listing_id、name=title、points=price）。」<br>⇒ 以下為在售商品，撳入去可以睇詳情同庫存。 | 「Read face = GET /api/prize/all (registered; source already switched to the listing table: bID=listing_id, name=title, points=price).」<br>⇒ The items currently on sale are listed below; open one to see its details and stock. | 「Mặt đọc = GET /api/prize/all (đã đăng ký; nguồn đọc đã đổi sang bảng listing: bID=listing_id, name=title, points=price).」<br>⇒ Dưới đây là các mặt hàng đang bán; mở một mục để xem chi tiết và tồn kho. |
| `listings.publishNote` | PublishListingPage.jsx:143 | 「上架 = POST /api/listing（直 DML、无分录）→ PATCH 状态迁移 draft→listed（只有 listed 可被购买）。」<br>⇒ 上架后商品先是草稿状态，上架成功后买家才能购买。 | 「上架 = POST /api/listing（直 DML、無分錄）→ PATCH 狀態遷移 draft→listed（只有 listed 可被購買）。」<br>⇒ 上架後商品先是草稿狀態，上架成功之後買家先可以購買。 | 「Listing = POST /api/listing (direct DML, no ledger entries) then PATCH status draft->listed (only listed can be bought).」<br>⇒ A new listing starts as a draft; buyers can purchase it only after it is published. | 「Đăng bán = POST /api/listing (DML trực tiếp, không bút toán) → PATCH chuyển trạng thái draft→listed (chỉ listed mới mua được).」<br>⇒ Hàng mới đăng ở trạng thái nháp; người mua chỉ mua được sau khi đăng bán thành công. |
| `listings.priceServerNote` | ListingDetailPage.jsx:138 | 「购买金额一律服务端取数：前端不传价、不传对手方。」<br>⇒ 购买金额由平台统一结算，无需填写价格或收款方。 | 「購買金額一律伺服器取數：前端不傳價、不傳對手方。」<br>⇒ 購買金額由平台統一結算，唔需要填價格或收款方。 | 「Purchase amounts are always resolved server-side: the client sends neither price nor counterparty.」<br>⇒ The amount charged is settled by the platform; you do not need to enter a price or a recipient. | 「Số tiền mua luôn do máy chủ lấy: phía trước không gửi giá, không gửi đối tác.」<br>⇒ Số tiền mua do nền tảng quyết toán; bạn không cần nhập giá hay bên nhận tiền. |
| `listings.priceRoleNote` | PublishListingPage.jsx:90 | 「标价 = 供给侧自主出价（A 类：客户端出价、路由层零计算）。」<br>⇒ 标价由卖方自行填写，平台不会代改价格。 | 「標價 = 供給側自主出價（A 類：客戶端出價、路由層零計算）。」<br>⇒ 標價由賣方自行填寫，平台唔會代改價格。 | 「The price is a supply-side ask (class A: client-quoted, zero computation in the route layer).」<br>⇒ The seller sets the listed price; the platform does not change it for you. | 「Giá là mức chào của bên cung (loại A: khách hàng chào, tầng định tuyến không tính toán).」<br>⇒ Người bán tự đặt giá niêm yết; nền tảng không sửa giá thay bạn. |
| `listings.stockNote` | PublishListingPage.jsx:144 | 「退款不回滚库存（既有单点裁定，本次已实测确认）。」<br>⇒ 退款时只退还款项，库存不会自动恢复。 | 「退款不回滾庫存（既有單點裁定，本次已實測確認）。」<br>⇒ 退款時只退還款項，庫存唔會自動恢復。 | 「Refunds do not roll the stock back (existing single-point ruling, re-measured here).」<br>⇒ A refund returns the money only; stock is not restored automatically. | 「Hoàn tiền không hoàn lại tồn kho (phán quyết một điểm đã có, đã đo lại lần này).」<br>⇒ Khi hoàn tiền chỉ trả lại tiền; tồn kho không tự động được cộng lại. |
| `listings.cidNote` | PublishListingPage.jsx:122 | 「币种编号手填（币种读口未注册）；社区积分 $ = 1。」<br>⇒ 币种编号请手动填写；社区积分 $ 填 1。 | 「幣種編號手填（幣種讀口未註冊）；社群積分 $ = 1。」<br>⇒ 幣種編號請手動填寫；社區積分 $ 填 1。 | 「Currency id is typed by hand (no currency read face is registered); community points $ = 1.」<br>⇒ Enter the currency id manually; use 1 for community points ($). | 「Mã tiền tệ nhập tay (chưa đăng ký mặt đọc tiền tệ); điểm cộng đồng $ = 1.」<br>⇒ Nhập mã tiền tệ bằng tay; dùng 1 cho điểm cộng đồng ($). |
| `listings.ordersNote` | ListingsPage.jsx:147 | 「读面 = GET /api/prize-item（listing_order，买家轴，status=paid）。」<br>⇒ 这里只显示你作为买家、已经付款的订单。 | 「讀面 = GET /api/prize-item（listing_order，買家軸，status=paid）。」<br>⇒ 呢度只顯示你作為買家、已經付款嘅訂單。 | 「Read face = GET /api/prize-item (listing_order, buyer axis, status=paid).」<br>⇒ Only orders where you are the buyer and payment is complete are shown here. | 「Mặt đọc = GET /api/prize-item (listing_order, trục người mua, status=paid).」<br>⇒ Ở đây chỉ hiển thị các đơn bạn là người mua và đã thanh toán. |
| `listings.buyNote` | ListingDetailPage.jsx:117 | 「购买 = POST /api/listing/:listingId/buy；幂等键由前端提供（缺键服务端 400）。」<br>⇒ 购买金额以平台结算为准；重复点击不会重复扣款。 | 「購買 = POST /api/listing/:listingId/buy；冪等鍵由前端提供（缺鍵伺服器 400）。」<br>⇒ 購買金額以平台結算為準；重複撳唔會重複扣款。 | 「Buy = POST /api/listing/:listingId/buy; the idempotency key is supplied by the client (missing key => 400).」<br>⇒ The amount is settled by the platform; tapping again will not charge you twice. | 「Mua = POST /api/listing/:listingId/buy; khoá idempotency do phía trước cung cấp (thiếu khoá ⇒ 400).」<br>⇒ Số tiền do nền tảng quyết toán; bấm lại sẽ không bị trừ tiền hai lần. |
| `listings.refundNote` | ListingsPage.jsx:172 | 「退款发起人仅卖方（非卖方 403）；按卖家列订单的读口未注册 ⇒ 请手填订单号。」<br>⇒ 只有卖家可以发起退款，请填写订单号。 | 「退款發起人僅賣方（非賣方 403）；按賣方列訂單的讀口未註冊 ⇒ 請手填訂單號。」<br>⇒ 只有賣家可以發起退款，請填寫訂單號。 | 「Only the seller may refund (non-seller => 403); no seller-axis order read face is registered, so type the order id.」<br>⇒ Only the seller can issue a refund; enter the order id. | 「Chỉ người bán được hoàn tiền (không phải người bán ⇒ 403); chưa có mặt đọc đơn theo người bán nên nhập mã đơn.」<br>⇒ Chỉ người bán mới có thể hoàn tiền; hãy nhập mã đơn hàng. |
| `listings.refundStockNote` | ListingDetailPage.jsx:139 / ListingsPage.jsx:173 | 「退款只退钱、不回滚 listing.stock。」<br>⇒ 退款只退还款项，商品库存不会恢复。 | 「退款只退錢、不回滾 listing.stock。」<br>⇒ 退款只退還款項，商品庫存唔會恢復。 | 「A refund returns money only; listing.stock is not rolled back.」<br>⇒ A refund returns the money only; the item's stock is not restored. | 「Hoàn tiền chỉ trả tiền, không hoàn lại listing.stock.」<br>⇒ Hoàn tiền chỉ trả lại tiền; tồn kho của mặt hàng không được cộng lại. |
| `listings.listed` | ListingsPage.jsx:127（fallback）+ PublishListingPage.jsx:65 | （未改）已上架 | （未改）已上架 | 「listed」<br>⇒ Listed | （未改）đã lên sàn |
| `market.note` | MarketPage.jsx:176 | 「行情/盘口/成交流水为公开只读面；挂单与撤单需登录。计价币 quote_cid 服务端恒 1。」<br>⇒ 行情、盘口与成交流水对所有人公开；挂单与撤单需要登录。所有价格以平台积分 $ 计价。 | 「行情／盤口／成交流水為公開只讀面；掛單與撤單需登入。計價幣 quote_cid 伺服器恆 1。」<br>⇒ 行情、盤口同成交流水對所有人公開；掛單同撤單需要登入。所有價格以平台積分 $ 計價。 | 「Quotes, order book and trades are public read faces; placing and cancelling orders require sign-in. The quote currency is always cid 1 server-side.」<br>⇒ Quotes, the order book and trades are visible to everyone; placing or cancelling an order requires sign-in. All prices are quoted in platform points ($). | 「Giá, sổ lệnh và giao dịch là mặt đọc công khai; đặt và huỷ lệnh cần đăng nhập. quote_cid luôn là 1 ở máy chủ.」<br>⇒ Giá, sổ lệnh và giao dịch ai cũng xem được; đặt hoặc huỷ lệnh cần đăng nhập. Mọi mức giá đều tính bằng điểm nền tảng ($). |
| `market.bookEmpty` | MarketPage.jsx:68/81/266 | 「暂无盘口（填 base_cid 后读取；base_cid=1 与「quote 恒 1」互斥 ⇒ 恒空）」<br>⇒ 暂无盘口数据。请先选择要查询的币种；以 $ 计价的币对不展示盘口。 | 「暫無盤口（填 base_cid 後讀取；base_cid=1 與「quote 恆 1」互斥 ⇒ 恆空）」<br>⇒ 暫無盤口資料。請先揀要查詢嘅幣種；以 $ 計價嘅幣對唔會顯示盤口。 | 「No book yet (fill base_cid to read; base_cid=1 contradicts the fixed quote cid, so it stays empty)」<br>⇒ No order book yet. Choose the currency you want to view first; pairs priced in $ have no order book. | 「Chưa có sổ lệnh (nhập base_cid để đọc; base_cid=1 mâu thuẫn với quote cố định nên luôn rỗng)」<br>⇒ Chưa có sổ lệnh. Hãy chọn loại tiền muốn xem trước; cặp tính bằng $ không hiển thị sổ lệnh. |
| `market.pairDegenerate` | MarketPage.jsx:62 | 「币对退化：平台计价币（#1）不能与自身成对，该请求已跳过。」<br>⇒ 这个币对无效，已跳过：平台计价币不能与自身组成币对。 | 「幣對退化：平台計價幣（#1）唔可以同自己成對，嗰個請求已經跳過。」<br>⇒ 呢個幣對無效，已經跳過：平台計價幣唔可以同自己組成幣對。 | 「Degenerate pair: the platform quote currency (#1) cannot be paired against itself, so the request was skipped.」<br>⇒ That pair is invalid and was skipped: the platform pricing currency cannot be paired with itself. | 「Cặp tiền suy biến: đồng định giá nền tảng (#1) không thể ghép cặp với chính nó, yêu cầu đã được bỏ qua.」<br>⇒ Cặp tiền này không hợp lệ nên đã bỏ qua: đồng định giá của nền tảng không thể ghép với chính nó. |
| `market.bookNote` | MarketPage.jsx:276 | 「读面 = GET /api/market/:base_cid/orderbook（已注册）。」<br>⇒ 盘口是公开行情，会随挂单实时更新。 | 「讀面 = GET /api/market/:base_cid/orderbook（已註冊）。」<br>⇒ 盤口係公開行情，會跟掛單實時更新。 | 「Read face = GET /api/market/:base_cid/orderbook (registered).」<br>⇒ The order book is public market data and updates as orders are placed. | 「Mặt đọc = GET /api/market/:base_cid/orderbook (đã đăng ký).」<br>⇒ Sổ lệnh là dữ liệu công khai và cập nhật theo lệnh đặt. |
| `market.tradesNote` | MarketPage.jsx:290 | 「读面 = GET /api/market/:base_cid/trades（已注册、只读）。」<br>⇒ 成交记录公开可查，仅供查看。 | 「讀面 = GET /api/market/:base_cid/trades（已註冊、只讀）。」<br>⇒ 成交紀錄公開可以查，只供查看。 | 「Read face = GET /api/market/:base_cid/trades (registered, read-only).」<br>⇒ Trades are public and read-only. | 「Mặt đọc = GET /api/market/:base_cid/trades (đã đăng ký, chỉ đọc).」<br>⇒ Giao dịch công khai, chỉ để xem. |
| `market.mineNote` | MarketPage.jsx:331 | 「读面 = GET /api/order；撤单只释放剩余在冻额，手续费不退。」<br>⇒ 这里显示你当前的挂单；撤单只退回还没成交部分的冻结资金，手续费不退。 | 「讀面 = GET /api/order；撤單只釋放剩餘在凍額，手續費不退。」<br>⇒ 呢度顯示你目前嘅掛單；撤單只退還未成交部分嘅凍結資金，手續費唔退。 | 「Read face = GET /api/order; cancelling releases only the remaining frozen amount, fees are not refunded.」<br>⇒ Your open orders appear here; cancelling returns only the funds still frozen for the unfilled part, and fees are not refunded. | 「Mặt đọc = GET /api/order; huỷ lệnh chỉ giải phóng phần còn đóng băng, phí không hoàn.」<br>⇒ Đây là các lệnh đang mở của bạn; huỷ lệnh chỉ hoàn phần tiền còn đóng băng cho phần chưa khớp, phí không được hoàn. |
| `market.placeNote` | MarketPage.jsx:258 | 「挂单 = POST /api/order；买单冻结 amount×price 的 $，卖单冻结 base 币 amount。」<br>⇒ 挂单后资金会被冻结：买单冻结「价格 × 数量」的 $，卖单冻结对应数量的卖出币种。 | 「掛單 = POST /api/order；買單凍結 amount×price 的 $，賣單凍結 base 幣 amount。」<br>⇒ 掛單後資金會被凍結：買單凍結「價格 × 數量」嘅 $，賣單凍結對應數量嘅賣出幣種。 | 「Place = POST /api/order; a buy freezes amount x price of $, a sell freezes amount of the base currency.」<br>⇒ Placing an order freezes funds: a buy order freezes price x amount in $, a sell order freezes that amount of the currency you are selling. | 「Đặt = POST /api/order; lệnh mua đóng băng amount×price của $, lệnh bán đóng băng amount của tiền cơ sở.」<br>⇒ Sau khi đặt lệnh, tiền sẽ bị đóng băng: lệnh mua đóng băng giá x số lượng bằng $, lệnh bán đóng băng số lượng tương ứng của loại tiền bạn bán. |
| `market.baseNote` | MarketPage.jsx:116/219 | 「手填 base_cid（币种读口未注册，不能 = 1）」<br>⇒ 填写要交易的币种编号（不能用平台计价单位 $） | 「手填 base_cid（幣種讀口未註冊，不能 = 1）」<br>⇒ 填寫要交易嘅幣種編號（唔可以用平台計價單位 $） | 「Type base_cid by hand (no currency read face is registered; must not be 1)」<br>⇒ Enter the currency id you want to trade (cannot be the platform pricing unit $) | 「Nhập tay base_cid (chưa đăng ký mặt đọc tiền tệ; không được bằng 1)」<br>⇒ Nhập mã tiền tệ muốn giao dịch (không được là đơn vị định giá $) |
| `market.quoteNote` | **无调用点**（locale 存量面） | 「报价币 = $（cid=1）」<br>⇒ 计价单位：$ | 「報價幣 = $（cid=1）」<br>⇒ 計價單位：$ | 「Quote currency = $ (cid=1)」<br>⇒ Pricing unit: $ | 「Tiền định giá = $ (cid=1)」<br>⇒ Đơn vị định giá: $ |
| `ledger.balanceNote` | ProfilePage.jsx:354 | 「读数 = /api/user/asset/:uID（已注册读口）。」<br>⇒ 余额以平台账户资产为准。 | 「讀數 = /api/user/asset/:uID（已註冊讀口）。」<br>⇒ 餘額以平台帳戶資產為準。 | 「Read from /api/user/asset/:uID (registered endpoint).」<br>⇒ The balance shown reflects the assets in your platform account. | 「Đọc từ /api/user/asset/:uID (endpoint đã đăng ký).」<br>⇒ Số dư hiển thị theo tài sản trong tài khoản nền tảng của bạn. |
| `ledger.flowEmpty` | MarketPage.jsx:337 / ProfilePage.jsx:358 | 「账本流水读口尚未注册，暂不展示（已登记）。」<br>⇒ 账本流水暂未开放，敬请期待。 | 「賬本流水讀口尚未註冊，暫不展示（已登記）。」<br>⇒ 賬本流水暫未開放，敬請期待。 | 「The ledger statement endpoint is not registered yet, so nothing is shown (logged).」<br>⇒ The statement is not available yet - coming soon. | 「Endpoint sao kê sổ cái chưa đăng ký nên chưa hiển thị (đã ghi nhận).」<br>⇒ Sổ cái giao dịch chưa mở, vui lòng chờ. |
| `uiError.serverErrorStatus` | components/ui/ErrorHandling.jsx:237 | 「服务器错误 ({{status}})」<br>⇒ 服务暂时不可用，请稍后重试。 | 「伺服器錯誤 ({{status}})」<br>⇒ 服務暫時無法使用，請稍後再試。 | 「Server error ({{status}})」<br>⇒ The service is temporarily unavailable, please try again later. | 「Lỗi máy chủ ({{status}})」<br>⇒ Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau. |
| `dashPage.noReviewPermissionBody` | DashboardPage.jsx:423 | 「如需处理提交审核，请让管理员把你加入具备 `review_tasks` 的权限组。」<br>⇒ 如需处理提交审核，请联系管理员为你开通审核权限。 | 「如需處理提交審核，請讓管理員把你加入具備 `review_tasks` 的權限組。」<br>⇒ 如需處理提交審核，請聯絡管理員為你開通審核權限。 | 「To handle submissions, ask an administrator to add you to a permission group that has `review_tasks`.」<br>⇒ To handle submissions, ask an administrator to grant you review permission. | 「Để xử lý bài gửi, hãy nhờ quản trị viên thêm bạn vào nhóm quyền có `review_tasks`.」<br>⇒ Để xử lý bài gửi, hãy nhờ quản trị viên cấp quyền duyệt cho bạn. |
| `adminPermissions.tipNoManagePermission` | PermissionsManagement.jsx:280/289 | 「当前账号没有 manage_permissions 权限」<br>⇒ 当前账号没有管理权限组的权限 | 「目前帳號沒有 manage_permissions 權限」<br>⇒ 目前帳號冇管理權限組嘅權限 | 「This account lacks the manage_permissions permission」<br>⇒ This account cannot manage permission groups | 「Tài khoản hiện tại không có quyền manage_permissions」<br>⇒ Tài khoản hiện tại không có quyền quản lý nhóm quyền |
| `adminPoints.tipNoManagePermission` | PointsManagement.jsx:311/321 | 「当前账号没有 manage_points 权限」<br>⇒ 当前账号没有管理积分的权限 | 「目前帳號沒有 manage_points 權限」<br>⇒ 目前帳號冇管理積分嘅權限 | 「This account lacks the manage_points permission」<br>⇒ This account cannot manage points | 「Tài khoản hiện tại không có quyền manage_points」<br>⇒ Tài khoản hiện tại không có quyền quản lý điểm |
| `adminUsers.tipNoManageUsers` | UsersManagement.jsx:296 | 「当前账号没有 manage_users 权限」<br>⇒ 当前账号没有管理用户的权限 | 「目前帳號沒有 manage_users 權限」<br>⇒ 目前帳號冇管理用戶嘅權限 | 「This account lacks the manage_users permission」<br>⇒ This account cannot manage users | 「Tài khoản hiện tại không có quyền manage_users」<br>⇒ Tài khoản hiện tại không có quyền quản lý người dùng |
| `adminUsers.tipNoManagePoints` | UsersManagement.jsx:306 | 「当前账号没有 manage_points 权限」<br>⇒ 当前账号没有管理积分的权限 | 「目前帳號沒有 manage_points 權限」<br>⇒ 目前帳號冇管理積分嘅權限 | 「This account lacks the manage_points permission」<br>⇒ This account cannot manage points | 「Tài khoản hiện tại không có quyền manage_points」<br>⇒ Tài khoản hiện tại không có quyền quản lý điểm |
| `adminShards.noPermission` | ShardsManagement.jsx:94 | 「权限不足，需要 `manage_rewards` 或 `publish_prizes` 权限」<br>⇒ 权限不足：需要管理奖励或发布奖品的权限 | 「權限不足，需要 `manage_rewards` 或 `publish_prizes` 權限」<br>⇒ 權限不足：需要管理獎勵或發佈獎品嘅權限 | 「Insufficient permissions: the manage_rewards or publish_prizes permission is required」<br>⇒ Insufficient permissions: you need permission to manage rewards or publish prizes | 「Không đủ quyền: cần quyền `manage_rewards` hoặc `publish_prizes`」<br>⇒ Không đủ quyền: cần quyền quản lý phần thưởng hoặc đăng giải thưởng |

有 33 个键四语**全部**改写；`listings.listed` 仅 en 档改写（`listed` ⇒ `Listed`，原样枚举值不得进可见文案），
zh/hk/vn 三档原值本就合规（`已上架 / 已上架 / đã lên sàn`），按「只改需要改的」原则未动。

## 3. 断言脚本与豁免登记（`frontend/scripts/p4z-i18nviol-global.mjs`，只读）

### 3.1 作用域与裸命中读数（脚本原样打印）

```
① 全量 locale 面：作用域命中节点数 = 2712（键 678 × 语 4） 裸命中 = 0
① 键集读数：四文件拍平键数取值集合 = {678}（应单值）
① en/vn 残留中文（豁免外）= 0
② 全量页面源文件面：扫描文件数 = 63；提取用户可见文案节点数 = 37（JSX 文本节点 + 可见属性串） 裸命中 = 0
   注释行登记（本可命中，不计命中）= 204 条   —— 理由：注释非用户可见面（逐条给 文件:行）
   代码位登记（真实接口调用，不计命中）= 67 条 —— 理由：代码位非文案（逐条给 文件:行）
   子面③ 硬编码中文文案字面量 = 32 个；命中工程口径 = 0
总判：PASS（locale 裸命中 0 + 源面裸命中 0）
```

黑名单（逐条命名）：章节号 `§` / HTTP 动词+路径 / `/api/` / HTTP 状态码 `400·401·403·404·410·500…` /
DB 表列名 `base_cid·quote_cid·listing.stock·listing_order·job_escrow` / SQL 事务 `ON CONFLICT` 等 /
幂等键实现 / 口径黑话 `读面·读口·写口·未注册·已注册·换源·派生·直 DML·无分录` /
服务端口径 `服务端·伺服器端·前端提供·前端不` / 轴字段口径 `买家轴·status=·uID·bID` / 权限 token `manage_*·review_tasks·publish_prizes` /
原样枚举值 `listed·draft·paid…`。

### 3.2 显式豁免（逐条列名 + 理由；不设通配）

| 位置/键 | 豁免串 | 理由 |
|---|---|---|
| `chinese` / `cantonese` / `adminSettings.langZh` / `adminSettings.langHk` | 语言自称 | endonym（「简体中文」「粤语」「中文」「繁體中文」），四语设计如此 |
| `footer.catSlogan1/2/3` / `footer.cloudSlogan` | 粵語口号整串 | **既有、非本单写集**（产品口径，B4 批遗留），本单不动 |
| `adminPermissions.permissionsPlaceholder` | `review_tasks, publish_prizes` | 管理员**输入语法示例**：token 就是要输入的值，删则功能不可用（非「给用户看的说明口径」） |
| `components/ui/ErrorHandling.jsx:318` | `404` | 404 错误页装饰性大数字，业界通用视觉惯例；同屏已有本地化 `uiError.notFoundTitle/Body` |
| `pages/theme-preview-demo.js:39` | `$410/天` | 主题预览页 **mock 演示数据**（日薪金额字面），非 HTTP 状态码 |

## 4. 残余发现（本单**不改**，须另单收口；不静默放水）

1. **`pages/listings/ListingsPage.jsx:127`** —— `String(row.status ?? t('listings.listed'))` 把**数据里的**状态枚举
   原样渲染（`draft` / `listed`）。它不是文案字面（是后端口径的数据），且现有键集内**没有** `draft` 等标签键可映射；
   本单「键名与键集不得变」⇒ 不得新增键，**另单收口**（建议：加状态标签键组或走 `i18n-content` 多语列）。
2. **`market.quoteNote`** 无任何调用点（仅存量 locale 面）—— 已按全量面口径改写完毕，是否下线该键由后续单决定。
3. **`hk` 与 `zh` 的口径**：hk 档为繁体（`已上架` 等既有键沿用），本单未改 hk 档中 zh/hk 同形的既有键。

## 5. 写集与边界声明（§5.7）

- **写**：`frontend/src/locales/{zh,hk,en,vn}.json`（四文件同步、只改值）、
  `frontend/scripts/p4z-i18nviol-global.mjs`（新增）、
  `frontend/src/test/unit/i18n-violation-closeout.test.jsx`（新增）、本文件。
- **未写**：`backend-ts/**`、`migrations/**`、`vercel.json`、spec、`docs/seafood.master-plan.md`、`.env*`、
  既有 audit 件、`pages/{jobs,listings,market}/**`（**本单在这些页面里没有任何硬编码违规串** ⇒ 一行未动）。
- **命令**：`npm run build` / `npm run test:unit` / `node scripts/p6-tr2-i18n-locales.mjs` /
  `node scripts/p4z-i18nviol-global.mjs`；退出码均**直接取自命令本身**（不经管道）。未执行 `git add/commit/push`、
  `npm install`、任何服务启停、`vercel`、`pkill/killall`。
- **读数口径**：`作用域命中节点数` 为脚本实跑打印值（locale 2712 = 678 键 × 4 语；源面 37 = JSX 文本节点 + 可见属性串；
  硬编码文案字面量 32）；`NOT_MEASURED` 项：本单无（每条读数均有命令与退出码）。
