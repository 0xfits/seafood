# P6 · I18N-LIT-B2 — 主线三页（任务 / 奖励 / 我的）文案四语化 + 小标接线 + 旧链收口（批 B2）

> 单元：Unit I18N-LIT-B2（Kong，实现单）。**真源**：`docs/audit/p6-i18n-literal-recon.md` 表④ B2（132 条，7 文件）。
> 口径：条数取自该 recon（`run_tag=20261001T113240Z-bb0e4ed`）；**recon 行号 = 改前行号**；盘面行号经**既有提交（sunset 单）位移**后**按文本比对**（见 §5 D8）。
> 硬边界遵守：只写 `frontend/src/**`（B2 范围：Task/Reward/Profile + `task/TaskCard` + `reward/RewardCard` + `ClaimRewardModal` + `ActiveTaskModal`）、`frontend/src/locales/*.json`（四文件同步）、`frontend/src/test/unit/**`、`frontend/scripts/p4z-i18nb2-cjk.mjs`、本文件；**未动** `pages/{jobs,listings,market}/**`、`components/i18n/TranslatingBadge.jsx`、`i18n-content.js`（只读引用）、B1/B3/B4/B5 文件、`backend-ts/**`、`migrations/**`、`vercel.json`、spec、`docs/seafood.master-plan.md`、`.env*`、既有 audit 件；**未** `git add/commit/push`、**未** `npm install`、**未**启停服务、**未** `vercel`、**未** `pkill/killall`。

## §1 写集

| 文件 | 类别 | 改动 |
|---|---|---|
| `frontend/src/pages/TaskPage.jsx` | 页面 | 27 条 recon 存量 + 4 条漏检（分页 Tab）；旧三目链 ⇒ `pickLocalized`；本地 `getCurrentLang` ⇒ `utils.getLanguageFromUrl` |
| `frontend/src/pages/RewardPage.jsx` | 页面 | 37 条存量 + 4 条漏检（分页 Tab）；同上收口；详情页 title/note/brand 走 `pickLocalized` |
| `frontend/src/pages/ProfilePage.jsx` | 页面 | 37 条存量 + 4 条漏检（`注册时间:` / `钱包地址:` 标签、`个人简介` 标题、`碎片` 单位） |
| `frontend/src/components/task/TaskCard.jsx` | 卡片 | 7 条存量 + 1 条漏检（`人参与`）；接小标 |
| `frontend/src/components/reward/RewardCard.jsx` | 卡片 | 5 条存量 + 1 条漏检（`人已领取`）；接小标 |
| `frontend/src/components/ClaimRewardModal.jsx` | 弹窗 | 盘面 4 条（recon 9 条中 5 条已不存在，见 §2.4） |
| `frontend/src/components/ActiveTaskModal.jsx` | 弹窗 | 4 条（1 条复用既有键 `sessionExpired`，3 条新键） |
| `frontend/src/locales/{zh,en,hk,vn}.json` | 资源 | 新增 **96 键 × 4 语 = 384 值**（四文件同步） |
| `frontend/src/test/unit/i18n-batch-b2.test.jsx` | 测试 | **新增 7 用例** |
| `frontend/src/test/unit/i18n-content-wiring.test.jsx` | 测试 | LEGACY 名单更新（Task/Reward ⇒ WIRED，断言**加强**，见 §5 D7） |
| `frontend/scripts/p4z-i18nb2-cjk.mjs` | 脚本 | 本批类级 CJK 断言（同形于 B1 脚本） |
| `docs/audit/p6-i18n-batch-b2.md` | 报告 | 本文件 |

## §2 条数对账（recon 132 条 ⇒ 盘面 135 字面量）

三列：**已处理 / 判定不改（含理由）/ 漏检补充**；另列 recon 中**已消失**一项（非本批对象）。

| 文件 | recon 条数 | 盘面字面量条数 | 已处理 | 判定不改 | 漏检补充 | 已消失(recon 有/盘面无) |
|---|---|---|---|---|---|---|
| `pages/TaskPage.jsx` | 27 | 31 | 27 | 0 | 4 | 0 |
| `pages/RewardPage.jsx` | 43 | 41 | 37 | 0 | 4 | 6 |
| `pages/ProfilePage.jsx` | 37 | 41 | 37 | 0 | 4 | 0 |
| `components/task/TaskCard.jsx` | 7 | 8 | 7 | 0 | 1 | 0 |
| `components/reward/RewardCard.jsx` | 5 | 6 | 5 | 0 | 1 | 0 |
| `components/ClaimRewardModal.jsx` | 9 | 4 | 4 | 0 | 0 | 5 |
| `components/ActiveTaskModal.jsx` | 4 | 4 | 4 | 0 | 0 | 0 |
| **合计** | **132** | **135** | **121** | **0** | **14** | **11** |

算术：`132 = 121（现盘面存量）+ 11（已消失）`；`135 = 121 + 14`（漏检）。**135 条全部已处理**，无「不改」项。

### 2.1 已处理（135 条）

逐条落点与键见 §3；按页汇总：TaskPage 31（27 复用同页/通用键 + 4 Tab）、RewardPage 41、ProfilePage 41、TaskCard 8、RewardCard 6、ClaimRewardModal 4、ActiveTaskModal 4。

**复用既有键（recon ②-a 口径，13 条落点）**：`CanClaim`（`可兑换`，RewardPage 状态/统计/Tab 三处）、`cancel`（×2）、`pleaseLogin`（×5）、`pendingVerification`（×2）、`sessionExpired`（×1）、`giftStatusLimited`（×1）。
**承接 B1 新键（同值复用）**：`common.ongoing`(进行中) / `common.ended`(已结束) / `common.joinNow`(立即参与) / `common.redeemed`(已兑换) / `common.outOfStock`(库存不足)。

### 2.2 判定不改（**0 条**）

理由：recon B2 清单**无 (c) 类**（表④ B2 行：`(c) 不译 = 0`）。盘面亦无「品牌/代码符号类」CJK 需豁免的词条；`dashJ`（品牌 token）按其原串 `dashJ不足` 整体入键（`rewardCard.insufficient`），未拆、未译品牌部分。

### 2.3 漏检补充（14 条，逐条）

recon §6 自曝「多行 JSX 文本节点 / `{{}}` 混排可能漏计」在本批**实测成立**：

| # | 位置（盘面） | 原文 | 处置 / 键 |
|---|---|---|---|
| 1-4 | `TaskPage.jsx` L276–279 | `可参与 (N)`、`待领取 (N)`、`已完成 (N)`、`待验证 (N)` 分页 Tab | `common.available` / `common.pending` / `common.completed` / `pendingVerification` |
| 5-8 | `RewardPage.jsx` L312–315 | `可兑换 (N)`、`限量版 (N)`、`高价值 (N)`、`已兑换 (N)` 分页 Tab | `CanClaim` / `rewardPage.limitedEdition` / `rewardPage.highValue` / `common.redeemed` |
| 9 | `ProfilePage.jsx` L271 | `注册时间: `（与表达式混排的标签） | `profilePage.registeredAt` |
| 10 | `ProfilePage.jsx` L275 | `钱包地址: `（同上） | `profilePage.walletAddress` |
| 11 | `ProfilePage.jsx` L284 | `个人简介`（标题文本节点后紧跟 `<TranslatingBadge/>`） | `profilePage.bio` |
| 12 | `ProfilePage.jsx` L450 | `碎片`（`{h.volume} 碎片` 混排） | `common.shardUnit` |
| 13 | `TaskCard.jsx` L124 | `人参与`（`{n} 人参与` 混排） | `common.participantsUnit` |
| 14 | `RewardCard.jsx` L138 | `人已领取`（`{n} 人已领取` 混排） | `common.claimedUnit` |

### 2.4 recon 清单中「已消失」的 11 条（非本批对象，已核实）

盘面已无这些字面量（**实测**：`grep -e 成功领取 -e 领取中 -e 待管理员审核 -e 请先登录 <三文件>` ⇒ 0 命中，`GREP_EXIT=1`）。成因：B2 之外**既有提交**已删对应代码（claim 端点退役 ⇒ 删调用 + 删 UI 分支）。

| 文件 | recon 条 | 原文 |
|---|---|---|
| `RewardPage.jsx` | 6 | `请先登录`（第 2 处）、`奖励领取成功，获得 ${…} 积分`、`领取失败: ${…}`、`领取中...`、`领取奖励`（详情页按钮）、`待管理员审核` |
| `ClaimRewardModal.jsx` | 5 | `请先登录`×2、`成功领取 ${pts} points`、`领取失败`、`领取` |

⇒ **未为这批文本造键**（造了就是死键）。

## §3 键表（新增 96 键 × 4 语；zh 值逐字取自 recon 原文/表③-1 初稿）

读法：`node scripts/p6-tr2-i18n-locales.mjs`（键集）+ `frontend/src/test/unit/i18n-batch-b2.test.jsx`（新增键齐备断言）。命名空间相对 recon 草案的调整见 §5 D2。

**`common.*`（跨页复用，承接 B1 命名空间）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `common.loadingTasks` | 正在加载任务... | 載入緊任務... | Loading tasks... | Đang tải nhiệm vụ... |
| `common.loadingRewards` | 正在加载奖励... | 載入緊獎勵... | Loading rewards... | Đang tải phần thưởng... |
| `common.loadingUser` | 正在加载用户信息... | 載入緊用戶資料... | Loading your profile... | Đang tải hồ sơ... |
| `common.save` | 保存 | 儲存 | Save | Lưu |
| `common.edit` | 编辑 | 編輯 | Edit | Chỉnh sửa |
| `common.unknown` | 未知 | 未知 | Unknown | Không rõ |
| `common.notSet` | 未设置 | 未設定 | Not set | Chưa đặt |
| `common.admin` | 管理员 | 管理員 | Admin | Quản trị viên |
| `common.points` | 积分 | 積分 | Points | Điểm |
| `common.available` | 可参与 | 可參加 | Available | Có thể tham gia |
| `common.pending` | 待领取 | 待領取 | To claim | Chờ nhận |
| `common.completed` | 已完成 | 已完成 | Completed | Đã xong |
| `common.underReview` | 审核中 | 審核緊 | Under review | Đang duyệt |
| `common.claimed` | 已领取 | 已領取 | Claimed | Đã nhận |
| `common.claimable` | 可领取 | 可領取 | Claimable | Có thể nhận |
| `common.claimReward` | 领取奖励 | 領取獎勵 | Claim reward | Nhận thưởng |
| `common.notEnoughPoints` | 积分不足 | 積分不足 | Not enough points | Không đủ điểm |
| `common.goTrade` | 去交易 | 去交易 | Trade | Giao dịch |
| `common.unavailable` | 不可用 | 不可用 | Unavailable | Không khả dụng |
| `common.participantsUnit` | 人参与 | 人參與 | participants | người tham gia |
| `common.claimedUnit` | 人已领取 | 人已領取 | claimed | người đã nhận |
| `common.shardUnit` | 碎片 | 碎片 | shards | mảnh |

**`taskPage.*`（任务页）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `taskPage.requestFailed` | 请求失败 ({{status}}) | 請求失敗 ({{status}}) | Request failed ({{status}}) | Yêu cầu thất bại ({{status}}) |
| `taskPage.title` | 任务中心 | 任務中心 | Task Center | Trung tâm nhiệm vụ |
| `taskPage.subtitle` | 参与任务，赚取积分，解锁精彩奖励 | 參與任務，賺取積分，解鎖精彩獎勵 | Complete tasks, earn points, unlock rewards | Tham gia nhiệm vụ, kiếm điểm, mở khoá phần thưởng |
| `taskPage.continueTask` | 继续任务 | 繼續任務 | Continue task | Tiếp tục nhiệm vụ |
| `taskPage.emptyAvailable` | 暂无可用任务 | 暫無可參加任務 | No tasks available | Chưa có nhiệm vụ |
| `taskPage.emptyAvailableHint` | 请稍后再来查看 | 請遲啲再嚟睇 | Please check back later | Vui lòng quay lại sau |
| `taskPage.emptyPending` | 暂无待领取任务 | 暫無待領取任務 | No tasks to claim | Chưa có nhiệm vụ chờ nhận |
| `taskPage.emptyPendingHint` | 完成任务并通过审核后可在此领取奖励 | 完成任務並通過審核後可喺度領取獎勵 | Complete tasks and pass review to claim rewards here | Hoàn thành nhiệm vụ và qua duyệt để nhận thưởng tại đây |
| `taskPage.emptyCompleted` | 暂无已完成任务 | 暫無已完成任務 | No completed tasks | Chưa có nhiệm vụ đã xong |
| `taskPage.emptyCompletedHint` | 开始参与任务赚取积分吧 | 開始參與任務賺取積分啦 | Join tasks to start earning points | Tham gia nhiệm vụ để bắt đầu kiếm điểm |
| `taskPage.emptyVerification` | 暂无待验证任务 | 暫無待驗證任務 | No tasks awaiting review | Chưa có nhiệm vụ chờ duyệt |
| `taskPage.emptyVerificationHint` | 提交的任务审核过程中会显示在这里 | 提交嘅任務喺審核過程中會顯示喺度 | Submitted tasks appear here while under review | Nhiệm vụ đã gửi sẽ hiển thị ở đây trong khi chờ duyệt |

**`rewardPage.*`（奖励页）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `rewardPage.title` | 奖励中心 | 獎勵中心 | Reward Center | Trung tâm phần thưởng |
| `rewardPage.subtitle` | 用积分兑换精彩礼品和特权 | 用積分兌換精彩禮品同特權 | Redeem points for gifts and perks | Đổi điểm lấy quà tặng và đặc quyền |
| `rewardPage.myPoints` | 我的积分 | 我嘅積分 | My points | Điểm của tôi |
| `rewardPage.limitedEdition` | 限量版 | 限量版 | Limited edition | Bản giới hạn |
| `rewardPage.highValue` | 高价值 | 高價值 | High value | Giá trị cao |
| `rewardPage.alreadyInGiftRecord` | 该奖励已在你的礼品记录中 | 呢個獎勵已經喺你嘅禮品記錄度 | This reward is already in your gift record | Phần thưởng này đã có trong hồ sơ quà tặng của bạn |
| `rewardPage.rewardOutOfStock` | 当前奖励库存不足 | 當前獎勵庫存不足 | This reward is out of stock | Phần thưởng này đã hết hàng |
| `rewardPage.redeemNotOpen` | 奖品兑换入口暂未开放，请联系管理员准备具体库存后再兑换。 | 獎品兌換入口暫未開放，請聯絡管理員準備具體庫存後再兌換。 | Redemption is not open yet; please contact an admin to prepare stock first. | Cổng đổi thưởng chưa mở, vui lòng liên hệ quản trị viên để chuẩn bị hàng. |
| `rewardPage.backToList` | ← 返回奖励列表 | ← 返回獎勵列表 | ← Back to rewards | ← Quay lại danh sách phần thưởng |
| `rewardPage.detailTitle` | 任务奖励详情 | 任務獎勵詳情 | Task reward details | Chi tiết thưởng nhiệm vụ |
| `rewardPage.taskInfo` | 任务信息 | 任務資訊 | Task info | Thông tin nhiệm vụ |
| `rewardPage.taskNumber` | 任务 #{{id}} | 任務 #{{id}} | Task #{{id}} | Nhiệm vụ #{{id}} |
| `rewardPage.noNote` | 暂无说明 | 暫無說明 | No description | Chưa có mô tả |
| `rewardPage.progress` | 完成进度 | 完成進度 | Progress | Tiến độ |
| `rewardPage.pointsAvailable` | 可获得积分 | 可獲得積分 | Points available | Điểm có thể nhận |
| `rewardPage.emptyAvailable` | 暂无可兑换奖励 | 暫無可兌換獎勵 | No rewards to redeem | Chưa có phần thưởng để đổi |
| `rewardPage.emptyAvailableHint` | 完成任务赚取积分来解锁奖励 | 完成任務賺取積分嚟解鎖獎勵 | Complete tasks to earn points and unlock rewards | Hoàn thành nhiệm vụ để kiếm điểm và mở khoá phần thưởng |
| `rewardPage.emptyLimited` | 暂无限量版奖励 | 暫無限量版獎勵 | No limited-edition rewards | Chưa có phần thưởng giới hạn |
| `rewardPage.emptyLimitedHint` | 限时或限额奖励会在库存准备好后出现 | 限時或限額獎勵會喺庫存準備好後出現 | Time-limited or capped rewards appear once stock is ready | Phần thưởng giới hạn thời gian sẽ xuất hiện khi có hàng |
| `rewardPage.emptyHighValue` | 暂无高价值奖励 | 暫無高價值獎勵 | No high-value rewards | Chưa có phần thưởng giá trị cao |
| `rewardPage.emptyHighValueHint` | 高价值奖励会在库存准备好后开放兑换 | 高價值獎勵會喺庫存準備好後開放兌換 | High-value rewards open for redemption once stock is ready | Phần thưởng giá trị cao sẽ mở đổi khi có hàng |
| `rewardPage.emptyClaimed` | 暂无已兑换奖励 | 暫無已兌換獎勵 | No redeemed rewards | Chưa có phần thưởng đã đổi |
| `rewardPage.emptyClaimedHint` | 兑换记录会显示在这里 | 兌換記錄會顯示喺度 | Redemption history will appear here | Lịch sử đổi thưởng sẽ hiển thị ở đây |

**`profilePage.*`（我的）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `profilePage.title` | 个人中心 | 個人中心 | Profile | Hồ sơ cá nhân |
| `profilePage.subtitle` | 管理你的账户信息和查看成就 | 管理你嘅帳戶資料同查看成就 | Manage your account and view achievements | Quản lý tài khoản và xem thành tích |
| `profilePage.loadFailed` | 加载用户信息失败: {{message}} | 載入用戶資料失敗: {{message}} | Failed to load user info: {{message}} | Tải thông tin người dùng thất bại: {{message}} |
| `profilePage.bioTooShort` | 请至少填写 10 个字的个人简介 | 請至少填寫 10 個字嘅個人簡介 | Please write at least 10 characters for your bio | Vui lòng nhập ít nhất 10 ký tự cho tiểu sử |
| `profilePage.bioSaved` | 简介保存成功 | 簡介儲存成功 | Bio saved | Đã lưu tiểu sử |
| `profilePage.saveFailed` | 保存失败: {{message}} | 儲存失敗: {{message}} | Save failed: {{message}} | Lưu thất bại: {{message}} |
| `profilePage.goLogin` | 去登录 | 去登入 | Sign in | Đăng nhập |
| `profilePage.basicInfo` | 基本信息 | 基本資料 | Basic info | Thông tin cơ bản |
| `profilePage.unknownUser` | 未知用户 | 未知用戶 | Unknown user | Người dùng không rõ |
| `profilePage.walletAddress` | 钱包地址 | 錢包地址 | Wallet address | Địa chỉ ví |
| `profilePage.registeredAt` | 注册时间 | 註冊時間 | Registered | Đã đăng ký |
| `profilePage.bio` | 个人简介 | 個人簡介 | Bio | Tiểu sử |
| `profilePage.bioPlaceholder` | 介绍一下你自己... | 介紹一下你自己... | Introduce yourself... | Giới thiệu về bạn... |
| `profilePage.bioEmpty` | 这个人很懒，什么都没有留下... | 呢個人好懶，乜都冇留低... | This person left nothing here... | Người này chưa để lại gì... |
| `profilePage.myAssets` | 我的资产 | 我嘅資產 | My assets | Tài sản của tôi |
| `profilePage.redeemedRewards` | 已兑换奖励 | 已兌換獎勵 | Redeemed rewards | Phần thưởng đã đổi |
| `profilePage.lastUpdate` | 最近更新 | 最近更新 | Last updated | Cập nhật gần nhất |
| `profilePage.taskAchievements` | 任务成就 | 任務成就 | Task achievements | Thành tích nhiệm vụ |
| `profilePage.totalTasks` | 总任务 | 總任務 | Total tasks | Tổng nhiệm vụ |
| `profilePage.totalPoints` | 总积分 | 總積分 | Total points | Tổng điểm |
| `profilePage.achievements` | 成就徽章 | 成就徽章 | Achievement badges | Huy hiệu thành tích |
| `profilePage.badgeNovice` | 新手 | 新手 | Novice | Tân thủ |
| `profilePage.badgeExpert` | 达人 | 達人 | Expert | Chuyên gia |
| `profilePage.badgeMaster` | 专家 | 專家 | Master | Bậc thầy |
| `profilePage.badgePointsPro` | 积分达人 | 積分達人 | Points pro | Cao thủ điểm |
| `profilePage.shardHoldings` | 碎片持仓 | 碎片持倉 | Shard holdings | Nắm giữ mảnh |
| `profilePage.noHoldings` | 暂无持仓 | 暫無持倉 | No holdings | Chưa có nắm giữ |

**`taskCard.*`（任务卡）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `taskCard.weeks` | {{n}}周 | {{n}}週 | {{n}} weeks | {{n}} tuần |
| `taskCard.days` | {{n}}天 | {{n}}天 | {{n}} days | {{n}} ngày |
| `taskCard.endingSoon` | 即将结束 | 即將結束 | Ending soon | Sắp kết thúc |

**`rewardCard.*`（奖励卡）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `rewardCard.limited` | 限量 | 限量 | Limited | Số lượng giới hạn |
| `rewardCard.timeLimited` | 剩余时间有限 | 剩餘時間有限 | Limited time left | Thời gian có hạn |
| `rewardCard.insufficient` | dashJ不足 | dashJ不足 | Not enough dashJ | Không đủ dashJ |
| `rewardCard.claimNow` | 立即领取 | 即刻領取 | Claim now | Nhận ngay |

**`claimRewardModal.*`（领取弹窗）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `claimRewardModal.loadProgressFailed` | 加载任务进度失败 | 載入任務進度失敗 | Failed to load task progress | Tải tiến độ nhiệm vụ thất bại |
| `claimRewardModal.lore` | 在水域的奇遇中收集宝石，完成探索后领取奖励。 | 喺水域嘅奇遇中收集寶石，完成探索後領取獎勵。 | Collect gems on your water adventures, then claim your reward. | Thu thập ngọc trong chuyến phiêu lưu dưới nước rồi nhận thưởng. |

**`activeTaskModal.*`（参与弹窗）**

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `activeTaskModal.noCredential` | 未找到登录凭证，请重新登录 | 搵唔到登入憑證，請重新登入 | No sign-in credential found, please sign in again | Không tìm thấy thông tin đăng nhập, vui lòng đăng nhập lại |
| `activeTaskModal.badCredential` | 登录凭证格式错误，请重新登录 | 登入憑證格式錯誤，請重新登入 | Invalid sign-in credential format, please sign in again | Định dạng thông tin đăng nhập sai, vui lòng đăng nhập lại |
| `activeTaskModal.submitFailed` | 提交任务失败 | 提交任務失敗 | Failed to submit the task | Gửi nhiệm vụ thất bại |

**插值**：仅两处，且均走 `t(key, { var })`（非拼接）：`taskPage.requestFailed` `{{status}}`、`rewardPage.taskNumber` `{{id}}`、`profilePage.loadFailed` `{{message}}`、`profilePage.saveFailed` `{{message}}`、`taskCard.weeks`/`taskCard.days` `{{n}}`（**刻意不用 `count`** —— i18next 的 `count` 会触发复数后缀查找，本批不需要复数形）。

## §4 AC 读数（本机自跑；退出码均直取命令，未取自管道之后）

| AC | 命令 | 读数 | 判定 |
|---|---|---|---|
| ① build | `npm run build`（日志 `~/.hermes/profiles/zang/cache/scratch/b2-build.log`） | `BUILD_EXIT=0`；`✓ built in 1.47s`，`dist/assets/index-C7A_c4J3.js 497.10 kB` | **PASS** |
| ② 单测 | `npm run test:unit`（日志 `…/b2-test.log`） | `UNIT_EXIT=0`；`Test Files 15 passed (15)` / `Tests 136 passed (136)`（B1 基线 129 passed / 14 files ⇒ **+7 用例、未掉**） | **PASS** |
| ③ 四语键集 + 小标守卫 | `node scripts/p6-tr2-i18n-locales.mjs`（日志 `…/b2-tr2.log`） | `TR2_EXIT=0`；`键集相等：PASS（取值集合 = {307}）`；`i18n.translating` 四语齐备（zh 翻译中 / en Translating / hk 翻譯中 / vn Đang dịch）；**新接文件守卫=PASS**；`总判：PASS` | **PASS** |
| ④ 类级 CJK | `node scripts/p4z-i18nb2-cjk.mjs`（日志 `…/b2-cjk.log`） | `CJK_EXIT=0`；7 文件**用户可见面 CJK 字面量命中 = 0**（改前 = 125 行）；注释内保留中文 = 66 行（§6）；`总判：PASS` | **PASS** |

**② 新增用例**（`src/test/unit/i18n-batch-b2.test.jsx`，7 条；走**真实** i18n 实例 + 真路由语言前缀，不 mock `react-i18next`）：
1. `TaskPage`（`/en/task`）：`Task Center` / 副标题 / `Available (1)` / `To claim (0)` / `Pending Verification (0)` / 卡片 `title_en`+`note_en` / `Join now`；`任务中心`、`任务原文` **不出现**；
2. `RewardPage`（`/en/reward`）：`Reward Center` / 副标题 / `My points` / `Limited edition` / `High value` / `Claim Now (1)`；`name_en`（标题**与**品牌行**两处**）与 `description_en` 渲染；`奖励中心`、`奖励原文` 不出现；
3. `ProfilePage`（`/en/profile`）：`Profile` / 副标题 / `Basic info` / `Bio` / `bio_en` / `My assets` / `Redeemed rewards` / `Task achievements` / `Total tasks` / `Achievement badges` / `Shard holdings` / `No holdings`；`个人中心`、`中文简介` 不出现；
4. **小标**（`TaskCard`/`RewardCard`）：en 档 `pending`/`partial` ⇒ 渲染（`[data-sf-m="i18n-translating"]` 命中）；`ready`/缺省 ⇒ 不渲染；
5. **小标 zh 档**：`i18n_status:"pending"` ⇒ **不渲染**（源语言档）；
6. `pickLocalized`：空串 ⇒ 回落原文（`??` 反例断言 `''`）、缺字段 ⇒ 回落、zh 档 ⇒ 无后缀字段；
7. 四语 locale：新增 96 键**四语齐备且非空串**、四文件拍平键集 `toEqual` 逐文件相等。

**③ 盘面键数（口径：顶层键 / 拍平键路径）**：改前四文件各 `top=79 / flat=211`（B1 后盘面），改后各 **`top=86 / flat=307`**（+7 顶层命名空间 = 7×1，+96 拍平键）；四文件**逐文件相等**。

## §5 偏差登记（相对 recon；盘面为准）

| # | 偏差 | 说明 |
|---|---|---|
| **D1** | recon 11 条已不存在 | 见 §2.4。recon 取证早于既有 sunset 提交，claim 相关字面量已被删 ⇒ 本批 `已处理` 基数 = 121（非 132）。**未造死键**。 |
| **D2** | **键命名空间** | 草案 `task.*` / `reward.*` / `page.*` **与既有顶层字符串键同名**（`task`=社区任务、`reward`=社区奖励、`page`=页）⇒ i18next 下 `task.available` 这类路径**解析不了**。改用未占用命名空间：`taskPage.*` / `rewardPage.*` / `profilePage.*` / `taskCard.*` / `rewardCard.*` / `claimRewardModal.*` / `activeTaskModal.*`，跨页复用语汇落 **`common.*`（承接 B1 同一命名空间）**；**取值逐字保留**（只换前缀）。同 B1 偏差 D2 的同一病根。 |
| **D3** | `可兑换` 复用 `CanClaim` 的语义偏差 | recon ②-a 指定 `可兑换 ⇒ CanClaim`（B1 亦同键复用）。但盘面 `CanClaim` 的 **en/hk/vn 值是 `Claim Now` / `立即領取` / `Nhận ngay`**（语义是「立即领取」，不是「可兑换」）⇒ en/hk/vn 档该 3 处落点（RewardPage 状态/统计/Tab）读数因此偏。**属既有数据问题**；本批**未改该键值**（改它会动 B1 已验收的 HomePage 面）⇒ 登记待产品裁决。 |
| **D4** | 注释内亦不得出现 `_en ??` | 既有 `i18n-content-wiring.test.jsx` 的静态断言按**全文正则**扫（不剥注释），而我写的「原旧式三目链 `_en ?? base` 已删」注释会**误报**（首轮实测 `expected [ '_en ??' ] to be null`）⇒ 注释改写为「`_en` 配 `??` 兜底」。**这是注入口径的坑，登记备查**。 |
| **D5** | `taskPage.requestFailed` 的 `t` 来源 | `fetchJson` 在**模块作用域**（无 hook 上下文）⇒ `t` 改为第三参由调用点传入；缺 `t` 时兜底为非 CJK 的 `HTTP <status>`（不留中文兜底串）。 |
| **D6** | 顺带修掉 2 处**未被 recon 计入**的内容本地化缺口（非 UI 字面量，故不并入漏检 14 条） | ① `TaskPage.enrichTask.description` 原直取 `task.note` ⇒ en 档卡片描述回显中文；改 `pickLocalized(task,'note',lang)`。② `RewardPage` 归一化里 `brand.name` 原直取 `reward.name` ⇒ en 档**品牌行**回显中文（由用例 2 的 `getAllByText('English reward')` 钉住）。同页详情页 `title`/`note` 亦收口。 |
| **D7** | 既有测试名单更新 | `src/test/unit/i18n-content-wiring.test.jsx`：TaskPage / RewardPage **移出 LEGACY、转入 WIRED**（WIRED 断言更强：`??` 命中=0 **且**必须经 `i18n-content`），`HomePage.jsx` 仍留 LEGACY（B1 面 12 处，本批不碰）。属**加强**，非削弱。同源脚本 `scripts/p6-tr2-i18n-locales.mjs` 的 `LEGACY` 读数列表**固化为静态文本**（本单写集不含该脚本 ⇒ 未改），改后其对 Task/Reward 打印 `??命中=0（登记）`——**读数陈旧但总判 PASS**（该段不参与判定）。 |
| **D8** | 行号位移 | 盘面行号 ≠ recon 行号（既有提交位移，如 RewardPage `L99→L98`、`L207→L184`、`L436→L376`）⇒ 对账**按文本**比对，不按行号。 |
| **D9** | Tab 文案切分 | Tab 由 `可参与 (N)` 改为 `{t('taskPage.available')} (N)`（键 + 字面括号 + 数字），与空态/统计标签**共用同一键**（少 4 个键）；**切分后布局未量测**（见 §7）。 |

## §6 保留的中文注释逐行位置（66 行；**不计入命中**，逐条列出）

剥注释后 CJK 字面量 = 0；以下行**只有注释**含中文（recon 口径 ④：注释不计入需修复集）：

- `pages/TaskPage.jsx`（7 行）：L17, L18, L46, L47, L221, L222, L223
- `pages/RewardPage.jsx`（18 行）：L23, L49, L50, L51, L70, L71, L77, L131, L132, L133, L134, L161, L162, L163, L164, L165, L166, L202
- `pages/ProfilePage.jsx`（26 行）：L6, L15, L27, L28, L29, L47, L85, L99, L100, L101, L106, L149, L170, L176, L204, L216, L254, L281, L285, L298, L307, L344, L345, L363, L397, L431
- `components/task/TaskCard.jsx`（2 行）：L62, L92
- `components/reward/RewardCard.jsx`（3 行）：L53, L83, L134
- `components/ClaimRewardModal.jsx`（3 行）：L34, L35, L36
- `components/ActiveTaskModal.jsx`（7 行）：L14, L21, L31, L38, L62, L73, L86

## §7 NOT_MEASURED（未测项 —— 不填 0/空）

- **真浏览器四语验收未做**：本批证据 = `npm run build`（0）+ jsdom 单测（en/zh 档渲染断言）+ 静态脚本；**未**在真浏览器逐页切 en/hk/vn 复核 Task/Reward/Profile（AC 只要求 build + 单测 + 脚本）。
- **hk/vn 译文质量未评测**：hk 按 recon 的 s2t 风格产出、en/vn 为翻译产出，**无母语者/术语表回译核验**。
- **布局回归未测（D9）**：Tab 文案由 `可参与 (N)` 改为键 + 数字拼接，en 档更长（如 `Pending Verification (0)`）⇒ **4 列 Tab 条是否挤压/换行未在真机量测**；同理空态英文短句换行未量测。
- **`CanClaim`（D3）语义偏差未获产品裁决**：en/hk/vn 档 RewardPage 3 处落点仍是「立即领取」语义。
- **未跑 e2e / 未起 dev 服务**：无浏览器冒烟读数（硬边界禁启停服务）。
- **静态扫描的固有盲区未复测**：recon §6 已登记「多行 JSX 文本节点漏检」「模板字面量内插值拆分兼容性」；本批的 14 条漏检即该盲区的**实测实例**，但**是否仍有残留漏检未证明**（脚本口径 = 剥注释后 CJK 表意文字，纯标点/全角符号不计）。
- **`docs/audit/p6-i18n-literal-recon.md` 未更新**：本批只落实现与读数，未回写 recon 总表（recon 属既有 audit 件，硬边界禁写）。

---
_本报告由 Unit I18N-LIT-B2（Kong）产出；真源 recon `run_tag=20261001T113240Z-bb0e4ed`。§4 四条命令 + 本文件 §3 键表可复跑对账。_
