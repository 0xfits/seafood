# P6 · I18N-LIT-RECON — 硬编码中文 UI 文案取证 + 分批修复方案

> 单元：Unit I18N-LIT-RECON（Kong，只读取证）。**本单不改任何代码**；本文件是唯一写入物。
> 扫描脚本：`/Users/kevin/.hermes/profiles/zang/cache/scratch/i18n_lit_recon.py`（绝对路径，只读）
> 产物：`p6-i18n-lit-recon.20261001T113240Z-bb0e4ed.json` · `p6-i18n-lit-recon.20261001T113240Z-bb0e4ed.tsv`

## §0 口径与元信息（先说口径，再报数）

| 项 | 值 |
|---|---|
| repo / git | `/Users/kevin/bistro/seafood` @ `bb0e4ed` |
| run_tag | `20261001T113240Z-bb0e4ed` |
| 生成时间(UTC) | 2026-10-01T11:33:58Z |
| 扫描范围 | `frontend/src/**` 下 `.js/.jsx/.ts/.tsx`，**排除** `locales/**` |
| 扫描文件数 | 93 |
| locale 键集 | top {'zh': 75, 'hk': 75, 'en': 75, 'vn': 75} / flat {'zh': 177, 'hk': 177, 'en': 177, 'vn': 177}；**四文件键集相等 = True** |

**「含中文的字符串字面量」两种口径（本报告同时给）**

- 口径 A（**不含注释与测试**）＝ 需修复集：**652 条**（cls1 JSX 文本 278 + cls2 属性值 25 + cls3 JS 字符串 349）
- 口径 B（**含注释、不含测试**）：1229 条（口径 A + cls4 注释/console 577）
- 口径 C（**含注释与测试**）：1493 条（口径 B + 测试夹具 264）
- **CJK 定义**：仅计 CJK 统一表意文字（`U+4E00–9FFF`、`U+3400–4DBF`、`U+F900–FAFF`）。**纯 CJK 标点（如 `、`）或全角符号不计**；因此「含中文的字符串字面量」＝ 至少含 1 个表意文字的字面量。
- 去重口径：同一 `文件+行号+类别+原文` 只计 1 条；同一行多个不同字面量分别计。
- 类别 ④ 中 **console.\* 调用含中文的条数为 0**（实测）；余下 577 条全部为注释。

## 表① 总清单（逐文件 · 行号 · 文本）

按批次排序；`class` 列：①=JSX 文本节点 ②=属性值(placeholder/title/aria-label/alt/label/name) ③=JS 字符串 ④=注释/console（**不计入需修复集**，仅报数）。

### ①-0 汇总（口径 A/B/C）

| 文件 | c1 JSX文本 | c2 属性 | c3 JS字符串 | **需修复(1+2+3)** | c4 注释/console | 文件合计 |
|---|---|---|---|---|---|---|
| `frontend/src/components/Header.jsx` | 1 | 4 | 2 | **7** | 22 | 29 |
| `frontend/src/pages/HomePage.jsx` | 14 | 0 | 14 | **28** | 0 | 28 |
| `frontend/src/components/Footer.jsx` | 0 | 0 | 8 | **8** | 9 | 17 |
| `frontend/src/App.jsx` | 1 | 0 | 0 | **1** | 30 | 31 |
| `frontend/src/shell/AppShell.jsx` | 0 | 0 | 0 | **0** | 4 | 4 |
| `frontend/src/shell/BottomTabBar.jsx` | 0 | 0 | 0 | **0** | 3 | 3 |
| `frontend/src/shell/nav.js` | 0 | 0 | 0 | **0** | 10 | 10 |
| `frontend/src/shell/breakpoints.js` | 0 | 0 | 0 | **0** | 7 | 7 |
| `frontend/src/pages/TaskPage.jsx` | 14 | 0 | 13 | **27** | 1 | 28 |
| `frontend/src/pages/RewardPage.jsx` | 22 | 0 | 21 | **43** | 9 | 52 |
| `frontend/src/pages/ProfilePage.jsx` | 27 | 1 | 9 | **37** | 25 | 62 |
| `frontend/src/components/task/TaskCard.jsx` | 0 | 0 | 7 | **7** | 1 | 8 |
| `frontend/src/components/reward/RewardCard.jsx` | 2 | 0 | 3 | **5** | 2 | 7 |
| `frontend/src/components/ClaimRewardModal.jsx` | 1 | 0 | 8 | **9** | 0 | 9 |
| `frontend/src/components/ActiveTaskModal.jsx` | 0 | 0 | 4 | **4** | 7 | 11 |
| `frontend/src/components/LoginModal.jsx` | 2 | 2 | 1 | **5** | 0 | 5 |
| `frontend/src/pages/AuthPage.jsx` | 12 | 1 | 10 | **23** | 0 | 23 |
| `frontend/src/components/auth/WalletAuthPanel.jsx` | 2 | 0 | 22 | **24** | 0 | 24 |
| `frontend/src/auth.js` | 0 | 0 | 3 | **3** | 7 | 10 |
| `frontend/src/pages/ShardPage.jsx` | 0 | 0 | 0 | **0** | 12 | 12 |
| `frontend/src/pages/jobs/PublishJobPage.jsx` | 0 | 0 | 0 | **0** | 10 | 10 |
| `frontend/src/pages/jobs/JobDetailPage.jsx` | 0 | 0 | 0 | **0** | 9 | 9 |
| `frontend/src/pages/jobs/JobReviewPage.jsx` | 0 | 0 | 0 | **0** | 15 | 15 |
| `frontend/src/pages/listings/ListingsPage.jsx` | 0 | 0 | 0 | **0** | 18 | 18 |
| `frontend/src/pages/listings/ListingDetailPage.jsx` | 0 | 0 | 0 | **0** | 12 | 12 |
| `frontend/src/pages/listings/PublishListingPage.jsx` | 0 | 0 | 0 | **0** | 9 | 9 |
| `frontend/src/pages/market/MarketPage.jsx` | 0 | 0 | 0 | **0** | 30 | 30 |
| `frontend/src/components/layout/AdminLayout.jsx` | 4 | 0 | 18 | **22** | 7 | 29 |
| `frontend/src/pages/DashboardPage.jsx` | 18 | 5 | 43 | **66** | 0 | 66 |
| `frontend/src/pages/admin/PermissionsManagement.jsx` | 11 | 3 | 27 | **41** | 5 | 46 |
| `frontend/src/pages/admin/PointsManagement.jsx` | 19 | 3 | 25 | **47** | 0 | 47 |
| `frontend/src/pages/admin/RewardsManagement.jsx` | 22 | 1 | 21 | **44** | 6 | 50 |
| `frontend/src/pages/admin/ShardsManagement.jsx` | 23 | 0 | 1 | **24** | 0 | 24 |
| `frontend/src/pages/admin/SystemSettings.jsx` | 17 | 0 | 12 | **29** | 14 | 43 |
| `frontend/src/pages/admin/TasksManagement.jsx` | 9 | 1 | 11 | **21** | 8 | 29 |
| `frontend/src/pages/admin/UsersManagement.jsx` | 15 | 1 | 23 | **39** | 3 | 42 |
| `frontend/src/components/ui/Advanced.jsx` | 5 | 2 | 0 | **7** | 0 | 7 |
| `frontend/src/components/ui/DashJ.jsx` | 0 | 1 | 0 | **1** | 3 | 4 |
| `frontend/src/components/ui/DataDisplay.jsx` | 1 | 0 | 1 | **2** | 0 | 2 |
| `frontend/src/components/ui/ErrorHandling.jsx` | 13 | 0 | 12 | **25** | 13 | 38 |
| `frontend/src/components/ui/Loading.jsx` | 0 | 0 | 1 | **1** | 0 | 1 |
| `frontend/src/components/ui/Performance.jsx` | 3 | 0 | 1 | **4** | 17 | 21 |
| `frontend/src/theme/tokens.js` | 0 | 0 | 23 | **23** | 20 | 43 |
| `frontend/src/pages/ThemePreviewPage.jsx` | 20 | 0 | 5 | **25** | 7 | 32 |
| `frontend/src/components/i18n/TranslatingBadge.jsx` | 0 | 0 | 0 | **0** | 8 | 8 |
| `frontend/src/components/ui/Button.jsx` | 0 | 0 | 0 | **0** | 2 | 2 |
| `frontend/src/components/ui/HoverMenu.jsx` | 0 | 0 | 0 | **0** | 1 | 1 |
| `frontend/src/components/ui/MicroInteractions.jsx` | 0 | 0 | 0 | **0** | 11 | 11 |
| `frontend/src/components/ui/Modal.jsx` | 0 | 0 | 0 | **0** | 4 | 4 |
| `frontend/src/components/ui/Responsive.jsx` | 0 | 0 | 0 | **0** | 2 | 2 |
| `frontend/src/components/ui/Toast.jsx` | 0 | 0 | 0 | **0** | 3 | 3 |
| `frontend/src/components/ui/index.js` | 0 | 0 | 0 | **0** | 13 | 13 |
| `frontend/src/i18n-content.js` | 0 | 0 | 0 | **0** | 22 | 22 |
| `frontend/src/i18n.js` | 0 | 0 | 0 | **0** | 3 | 3 |
| `frontend/src/idempotency.js` | 0 | 0 | 0 | **0** | 15 | 15 |
| `frontend/src/main.jsx` | 0 | 0 | 0 | **0** | 5 | 5 |
| `frontend/src/pages/jobs/job-api.js` | 0 | 0 | 0 | **0** | 35 | 35 |
| `frontend/src/pages/listings/listing-api.js` | 0 | 0 | 0 | **0** | 37 | 37 |
| `frontend/src/pages/market/market-api.js` | 0 | 0 | 0 | **0** | 31 | 31 |
| `frontend/src/theme/ThemeProvider.jsx` | 0 | 0 | 0 | **0** | 6 | 6 |
| `frontend/src/utils.js` | 0 | 0 | 0 | **0** | 24 | 24 |
| **合计** | **278** | **25** | **349** | **577** | **1229** | **2458** |

### ①-1 需修复明细（class ①②③，逐行）

#### B1 — 首屏 · 全局骨架（用户最先看到）

- `frontend/src/components/Header.jsx` — 7 条
  - `L119` [③JS字符串] `碎片市场`
  - `L121` [③JS字符串] `管理面板`
  - `L196` [②alt] `中文`
  - `L210` [②alt] `粵語`
  - `L248` [①JSX文本] `社区积分`
  - `L367` [②alt] `中文`
  - `L387` [②alt] `粵語`
- `frontend/src/pages/HomePage.jsx` — 28 条
  - `L55` [③JS字符串] `进行中`
  - `L55` [③JS字符串] `已结束`
  - `L58` [③JS字符串] `立即参与`
  - `L84` [③JS字符串] `已兑换`
  - `L84` [③JS字符串] `可兑换`
  - `L84` [③JS字符串] `库存不足`
  - `L159` [③JS字符串] `加载首页失败: ${error.message}`
  - `L180` [③JS字符串] `请先登录`
  - `L186` [③JS字符串] `这个奖励你已经兑换过了`
  - `L191` [③JS字符串] `当前奖励库存不足`
  - `L196` [③JS字符串] `积分不足`
  - `L200` [③JS字符串] `奖品兑换入口即将上线，请先前往奖励中心查看详情`
  - `L208` [①JSX文本] `正在加载精彩内容...`
  - `L219` [①JSX文本] `欢迎来到 Jinli Club`
  - `L220` [①JSX文本] `参与任务，赚取`
  - `L221` [①JSX文本] `，兑换精彩奖励`
  - `L226` [③JS字符串] `继续任务`
  - `L226` [③JS字符串] `立即注册`
  - `L230` [①JSX文本] `查看奖励`
  - `L240` [①JSX文本] `热门任务`
  - `L241` [①JSX文本] `参与任务赚取`
  - `L244` [①JSX文本] `查看全部`
  - `L261` [①JSX文本] `暂无可用任务`
  - `L272` [①JSX文本] `精选奖励`
  - `L273` [①JSX文本] `用`
  - `L273` [①JSX文本] `兑换精彩礼品`
  - `L276` [①JSX文本] `查看全部`
  - `L298` [①JSX文本] `暂无可用奖励`
- `frontend/src/components/Footer.jsx` — 8 条
  - `L8` [③JS字符串] `猫猫大使团｜不止一份报酬，更加一份经验。`
  - `L9` [③JS字符串] `猫猫大使团｜你的声音，值得被品牌听见。`
  - `L10` [③JS字符串] `你的代言，从猫猫大使团开始。`
  - `L31` [③JS字符串] `云朵计划｜播种童年梦想，浇灌美和希望。`
  - `L101` [③JS字符串] `本网站支持简体中文、英文、粤语和越南语。`
  - `L103` [③JS字符串] `本網站支持簡體中文、英文、粵語和越南語。`
  - `L111` [③JS字符串] `联系我们：contact@jinli.club`
  - `L113` [③JS字符串] `聯繫我們：contact@jinli.club`
- `frontend/src/App.jsx` — 1 条
  - `L182` [①JSX文本] `正在验证权限...`
- `frontend/src/shell/AppShell.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/shell/BottomTabBar.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/shell/nav.js`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/shell/breakpoints.js`：**0 条**（无硬编码中文 UI 字面量）

#### B2 — 主线三页 · 任务/奖励/我的 + 卡片与弹窗

- `frontend/src/pages/TaskPage.jsx` — 27 条
  - `L20` [③JS字符串] `请求失败 (${response.status})`
  - `L67` [③JS字符串] `进行中`
  - `L67` [③JS字符串] `已结束`
  - `L70` [③JS字符串] `立即参与`
  - `L133` [③JS字符串] `已完成`
  - `L134` [③JS字符串] `已领取`
  - `L143` [③JS字符串] `待领取`
  - `L144` [③JS字符串] `领取奖励`
  - `L153` [③JS字符串] `待验证`
  - `L154` [③JS字符串] `审核中`
  - `L173` [③JS字符串] `继续任务`
  - `L173` [③JS字符串] `立即参与`
  - `L213` [③JS字符串] `正在加载任务...`
  - `L230` [①JSX文本] `任务中心`
  - `L231` [①JSX文本] `参与任务，赚取积分，解锁精彩奖励`
  - `L248` [①JSX文本] `可参与`
  - `L254` [①JSX文本] `待领取`
  - `L260` [①JSX文本] `已完成`
  - `L266` [①JSX文本] `待验证`
  - `L298` [①JSX文本] `暂无可用任务`
  - `L299` [①JSX文本] `请稍后再来查看`
  - `L322` [①JSX文本] `暂无待领取任务`
  - `L323` [①JSX文本] `完成任务并通过审核后可在此领取奖励`
  - `L346` [①JSX文本] `暂无已完成任务`
  - `L347` [①JSX文本] `开始参与任务赚取积分吧`
  - `L370` [①JSX文本] `暂无待验证任务`
  - `L371` [①JSX文本] `提交的任务审核过程中会显示在这里`
- `frontend/src/pages/RewardPage.jsx` — 43 条
  - `L99` [③JS字符串] `已兑换`
  - `L99` [③JS字符串] `可兑换`
  - `L99` [③JS字符串] `库存不足`
  - `L147` [③JS字符串] `请先登录`
  - `L162` [③JS字符串] `奖励领取成功，获得 ${result?.reward_points || result?.points_claimed || 0} 积分`
  - `L165` [③JS字符串] `领取失败: ${error.message}`
  - `L173` [③JS字符串] `请先登录`
  - `L179` [③JS字符串] `该奖励已在你的礼品记录中`
  - `L184` [③JS字符串] `当前奖励库存不足`
  - `L189` [③JS字符串] `积分不足`
  - `L193` [③JS字符串] `奖品兑换入口暂未开放，请联系管理员准备具体库存后再兑换。`
  - `L207` [③JS字符串] `正在加载奖励...`
  - `L224` [①JSX文本] `← 返回奖励列表`
  - `L230` [①JSX文本] `任务奖励详情`
  - `L234` [①JSX文本] `任务信息`
  - `L235` [③JS字符串] `任务 #${taskProgress.tID}`
  - `L236` [③JS字符串] `暂无说明`
  - `L240` [①JSX文本] `完成进度`
  - `L249` [③JS字符串] `已领取`
  - `L249` [③JS字符串] `可领取`
  - `L249` [③JS字符串] `审核中`
  - `L249` [③JS字符串] `进行中`
  - `L255` [①JSX文本] `可获得积分`
  - `L257` [①JSX文本] `积分`
  - `L262` [①JSX文本] `已领取`
  - `L272` [③JS字符串] `领取中...`
  - `L272` [③JS字符串] `领取奖励`
  - `L272` [③JS字符串] `待管理员审核`
  - `L293` [①JSX文本] `奖励中心`
  - `L294` [①JSX文本] `用积分兑换精彩礼品和特权`
  - `L301` [①JSX文本] `我的积分`
  - `L317` [①JSX文本] `可兑换`
  - `L323` [①JSX文本] `已兑换`
  - `L329` [①JSX文本] `限量版`
  - `L335` [①JSX文本] `高价值`
  - `L367` [①JSX文本] `暂无可兑换奖励`
  - `L368` [①JSX文本] `完成任务赚取积分来解锁奖励`
  - `L392` [①JSX文本] `暂无限量版奖励`
  - `L393` [①JSX文本] `限时或限额奖励会在库存准备好后出现`
  - `L417` [①JSX文本] `暂无高价值奖励`
  - `L418` [①JSX文本] `高价值奖励会在库存准备好后开放兑换`
  - `L441` [①JSX文本] `暂无已兑换奖励`
  - `L442` [①JSX文本] `兑换记录会显示在这里`
- `frontend/src/pages/ProfilePage.jsx` — 37 条
  - `L76` [③JS字符串] `加载用户信息失败: `
  - `L154` [③JS字符串] `请至少填写 10 个字的个人简介`
  - `L164` [③JS字符串] `简介保存成功`
  - `L166` [③JS字符串] `保存失败: `
  - `L180` [③JS字符串] `正在加载用户信息...`
  - `L191` [①JSX文本] `请先登录`
  - `L192` [①JSX文本] `去登录`
  - `L207` [①JSX文本] `个人中心`
  - `L210` [①JSX文本] `管理你的账户信息和查看成就`
  - `L221` [①JSX文本] `基本信息`
  - `L228` [①JSX文本] `编辑`
  - `L238` [①JSX文本] `保存`
  - `L246` [①JSX文本] `取消`
  - `L262` [③JS字符串] `未知用户`
  - `L265` [①JSX文本] `管理员`
  - `L271` [③JS字符串] `未知`
  - `L275` [③JS字符串] `未设置`
  - `L294` [②placeholder] `介绍一下你自己...`
  - `L299` [③JS字符串] `这个人很懒，什么都没有留下...`
  - `L311` [①JSX文本] `我的资产`
  - `L319` [①JSX文本] `积分`
  - `L325` [①JSX文本] `待领取`
  - `L331` [①JSX文本] `已兑换奖励`
  - `L337` [①JSX文本] `最近更新`
  - `L367` [①JSX文本] `任务成就`
  - `L375` [①JSX文本] `总任务`
  - `L381` [①JSX文本] `已完成`
  - `L387` [①JSX文本] `进行中`
  - `L393` [①JSX文本] `总积分`
  - `L399` [①JSX文本] `成就徽章`
  - `L403` [①JSX文本] `新手`
  - `L409` [①JSX文本] `达人`
  - `L415` [①JSX文本] `专家`
  - `L421` [①JSX文本] `积分达人`
  - `L436` [①JSX文本] `碎片持仓`
  - `L437` [①JSX文本] `去交易`
  - `L444` [①JSX文本] `暂无持仓`
- `frontend/src/components/task/TaskCard.jsx` — 7 条
  - `L39` [③JS字符串] `已结束`
  - `L42` [③JS字符串] `限时`
  - `L43` [③JS字符串] `${Math.floor(days / 7)}周`
  - `L44` [③JS字符串] `${days}天`
  - `L45` [③JS字符串] `即将结束`
  - `L133` [③JS字符串] `立即参与`
  - `L133` [③JS字符串] `不可用`
- `frontend/src/components/reward/RewardCard.jsx` — 5 条
  - `L67` [①JSX文本] `限量`
  - `L131` [①JSX文本] `剩余时间有限`
  - `L151` [③JS字符串] `dashJ不足`
  - `L153` [③JS字符串] `已领取`
  - `L154` [③JS字符串] `立即领取`
- `frontend/src/components/ClaimRewardModal.jsx` — 9 条
  - `L29` [③JS字符串] `加载任务进度失败`
  - `L45` [③JS字符串] `请先登录`
  - `L57` [③JS字符串] `${t('success')}: 成功领取 ${pts} points`
  - `L64` [③JS字符串] `请先登录`
  - `L67` [③JS字符串] `领取失败`
  - `L88` [③JS字符串] `领取奖励`
  - `L114` [①JSX文本] `在水域的奇遇中收集宝石，完成探索后领取奖励。`
  - `L117` [③JS字符串] `领取`
  - `L118` [③JS字符串] `取消`
- `frontend/src/components/ActiveTaskModal.jsx` — 4 条
  - `L33` [③JS字符串] `未找到登录凭证，请重新登录`
  - `L42` [③JS字符串] `登录凭证格式错误，请重新登录`
  - `L63` [③JS字符串] `登录已过期，请重新登录`
  - `L76` [③JS字符串] `提交任务失败`

#### B3 — 登录 / 认证 / 钱包 + 工坊·商品·交易所三线核验

- `frontend/src/components/LoginModal.jsx` — 5 条
  - `L58` [②aria-label] `关闭登录窗口`
  - `L66` [②title] `连接钱包登录`
  - `L67` [③JS字符串] `通过一次签名验证完成登录。首次登录后可继续补全个人资料。`
  - `L71` [①JSX文本] `第一次使用 Jinli Club？`
  - `L77` [①JSX文本] `去完成首次绑定`
- `frontend/src/pages/AuthPage.jsx` — 23 条
  - `L64` [③JS字符串] `请至少填写 10 个字的个人简介`
  - `L72` [③JS字符串] `资料已保存`
  - `L75` [③JS字符串] `保存失败: ${error.message}`
  - `L103` [③JS字符串] `连接钱包继续探索`
  - `L103` [③JS字符串] `完成首次绑定并补全资料`
  - `L107` [③JS字符串] `使用现有钱包签名即可登录，完成后会返回你刚才访问的页面。`
  - `L108` [③JS字符串] `先验证钱包所有权，再补全个人简介，你的账号就可以正式启用。`
  - `L121` [①JSX文本] `补全个人简介`
  - `L122` [①JSX文本] `当前钱包已经验证成功。填写至少 10 个字的简介后，系统会把你带回刚才的页面。`
  - `L128` [③JS字符串] `未知地址`
  - `L132` [①JSX文本] `个人简介`
  - `L138` [②placeholder] `介绍一下你自己、擅长领域或者参与 Jinli Club 的原因。`
  - `L149` [③JS字符串] `正在保存...`
  - `L149` [③JS字符串] `保存并继续`
  - `L164` [①JSX文本] `说明`
  - `L165` [①JSX文本] `钱包登录只会请求一次离线签名，不会发起链上交易，也不会扣除 gas。`
  - `L171` [①JSX文本] `1. 连接一个 EVM 钱包。`
  - `L172` [①JSX文本] `2. 按提示完成签名验证。`
  - `L173` [①JSX文本] `3. 首次登录用户继续补全个人简介。`
  - `L177` [①JSX文本] `还没有完成首次绑定？`
  - `L179` [①JSX文本] `去注册`
  - `L184` [①JSX文本] `已经完成绑定？`
  - `L186` [①JSX文本] `返回登录`
- `frontend/src/components/auth/WalletAuthPanel.jsx` — 24 条
  - `L11` [③JS字符串] `钱包签名登录`
  - `L12` [③JS字符串] `连接你的 EVM 钱包，并完成一次签名验证即可登录。`
  - `L13` [③JS字符串] `签名登录`
  - `L16` [③JS字符串] `首次绑定钱包`
  - `L17` [③JS字符串] `先验证钱包所有权，再继续补全资料。`
  - `L18` [③JS字符串] `连接并继续`
  - `L69` [③JS字符串] `未检测到 EVM 钱包扩展，请先安装 MetaMask 或 OKX Wallet`
  - `L78` [③JS字符串] `钱包未返回可用地址`
  - `L81` [③JS字符串] `钱包连接成功`
  - `L84` [③JS字符串] `钱包连接失败`
  - `L92` [③JS字符串] `请先连接钱包`
  - `L97` [③JS字符串] `当前浏览器未检测到可用钱包`
  - `L118` [③JS字符串] `钱包验证成功，继续补全资料`
  - `L118` [③JS字符串] `登录成功`
  - `L125` [③JS字符串] `签名验证失败`
  - `L156` [③JS字符串] `已连接钱包`
  - `L156` [③JS字符串] `尚未连接钱包`
  - `L159` [③JS字符串] `请连接一个 EVM 钱包地址`
  - `L161` [①JSX文本] `登录只会请求一次签名，不会发起链上交易，也不会消耗 gas。`
  - `L169` [①JSX文本] `当前环境未检测到 MetaMask 或 OKX Wallet。安装钱包扩展后刷新页面即可继续。`
  - `L183` [③JS字符串] `处理中...`
  - `L183` [③JS字符串] `切换钱包`
  - `L183` [③JS字符串] `连接钱包`
  - `L194` [③JS字符串] `签名验证中...`
- `frontend/src/auth.js` — 3 条
  - `L138` [③JS字符串] `请求失败 (${status})`
  - `L211` [③JS字符串] `未找到登录凭证`
  - `L222` [③JS字符串] `未找到登录凭证`
- `frontend/src/pages/ShardPage.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/pages/jobs/PublishJobPage.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/pages/jobs/JobDetailPage.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/pages/jobs/JobReviewPage.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/pages/listings/ListingsPage.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/pages/listings/ListingDetailPage.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/pages/listings/PublishListingPage.jsx`：**0 条**（无硬编码中文 UI 字面量）
- `frontend/src/pages/market/MarketPage.jsx`：**0 条**（无硬编码中文 UI 字面量）

#### B4 — 后台管理（登录后管理员面）

- `frontend/src/components/layout/AdminLayout.jsx` — 22 条
  - `L32` [③JS字符串] `仪表板`
  - `L35` [③JS字符串] `系统概览和统计`
  - `L38` [③JS字符串] `任务管理`
  - `L41` [③JS字符串] `创建和管理任务`
  - `L45` [③JS字符串] `奖品管理`
  - `L48` [③JS字符串] `创建和管理奖品`
  - `L52` [③JS字符串] `碎片管理`
  - `L55` [③JS字符串] `碎片持仓、挂单与成交`
  - `L59` [③JS字符串] `用户管理`
  - `L62` [③JS字符串] `管理用户账户`
  - `L66` [③JS字符串] `权限管理`
  - `L69` [③JS字符串] `管理用户权限`
  - `L73` [③JS字符串] `积分管理`
  - `L76` [③JS字符串] `调整用户积分`
  - `L80` [③JS字符串] `系统设置`
  - `L83` [③JS字符串] `系统配置`
  - `L132` [①JSX文本] `管理面板`
  - `L188` [①JSX文本] `退出登录`
  - `L200` [③JS字符串] `管理面板`
  - `L203` [③JS字符串] `系统管理`
  - `L208` [①JSX文本] `管理员`
  - `L209` [①JSX文本] `在线`
- `frontend/src/pages/DashboardPage.jsx` — 66 条
  - `L28` [③JS字符串] `未知`
  - `L30` [③JS字符串] `未知`
  - `L72` [③JS字符串] `任务管理`
  - `L73` [③JS字符串] `查看任务列表、维护任务状态和任务配置。`
  - `L79` [③JS字符串] `奖品管理`
  - `L80` [③JS字符串] `维护奖品、有效期、库存与流通状态。`
  - `L86` [③JS字符串] `用户管理`
  - `L87` [③JS字符串] `查看用户信息、权限状态和搜索结果。`
  - `L93` [③JS字符串] `权限管理`
  - `L94` [③JS字符串] `维护管理权限分组和审核角色。`
  - `L100` [③JS字符串] `积分管理`
  - `L101` [③JS字符串] `查看积分分布并执行积分调整。`
  - `L107` [③JS字符串] `系统设置`
  - `L108` [③JS字符串] `维护站点、注册和积分规则设置。`
  - `L131` [③JS字符串] `用户统计`
  - `L132` [③JS字符串] `任务统计`
  - `L133` [③JS字符串] `奖励统计`
  - `L134` [③JS字符串] `待审核数量`
  - `L135` [③JS字符串] `待审核列表`
  - `L138` [③JS字符串] `部分数据加载失败：${errors.join('、')}`
  - `L189` [③JS字符串] `加载管理面板失败: ${error.message}`
  - `L208` [③JS字符串] `登录状态已失效，请重新登录`
  - `L216` [③JS字符串] `确认通过这条提交并标记为已审核？`
  - `L216` [③JS字符串] `确认退回这条提交并要求用户重新提交？`
  - `L232` [③JS字符串] `任务已通过审核`
  - `L232` [③JS字符串] `任务已退回，等待用户重新提交`
  - `L236` [③JS字符串] `操作失败: ${error.message}`
  - `L247` [③JS字符串] `管理总览已刷新`
  - `L250` [③JS字符串] `刷新失败: ${error.message}`
  - `L258` [③JS字符串] `管理员`
  - `L258` [③JS字符串] `审核员`
  - `L258` [③JS字符串] `后台成员`
  - `L281` [③JS字符串] `正在加载管理总览...`
  - `L292` [①JSX文本] `权限不足`
  - `L293` [①JSX文本] `只有拥有后台权限的账号才能访问管理面板。`
  - `L294` [①JSX文本] `返回首页`
  - `L309` [①JSX文本] `管理总览`
  - `L310` [①JSX文本] `优先处理待审核事项，再进入各个管理模块。`
  - `L334` [①JSX文本] `总用户数`
  - `L344` [①JSX文本] `管理员数量`
  - `L354` [①JSX文本] `累计积分`
  - `L364` [①JSX文本] `任务类型`
  - `L374` [①JSX文本] `奖品数量`
  - `L384` [①JSX文本] `待审核提交`
  - `L395` [①JSX文本] `普通用户 Task Progress 审批`
  - `L405` [②placeholder] `搜索 Task Progress 任务、地址或提交内容...`
  - `L411` [③JS字符串] `刷新中...`
  - `L411` [③JS字符串] `刷新`
  - `L420` [①JSX文本] `当前账号没有审核权限`
  - `L435` [③JS字符串] `收起列表`
  - `L435` [③JS字符串] `查看全部`
  - `L451` [③JS字符串] `任务 #${task.tID}`
  - `L459` [①JSX文本] `提交用户:`
  - `L463` [①JSX文本] `提交内容:`
  - `L463` [③JS字符串] `无`
  - `L477` [②aria-label] `通过审核`
  - `L478` [②title] `通过审核`
  - `L480` [①JSX文本] `通过`
  - `L488` [②aria-label] `退回重提`
  - `L489` [②title] `退回重提`
  - `L491` [①JSX文本] `退回`
  - `L506` [③JS字符串] `当前筛选条件下没有结果`
  - `L506` [③JS字符串] `当前没有待审核提交`
  - `L509` [③JS字符串] `换一个关键词试试，或点击刷新重新获取最新数据。`
  - `L509` [③JS字符串] `审核队列为空，管理入口可直接用于日常维护。`
  - `L523` [①JSX文本] `管理入口`
- `frontend/src/pages/admin/PermissionsManagement.jsx` — 41 条
  - `L47` [③JS字符串] `未登录`
  - `L52` [③JS字符串] `当前账号没有后台访问权限`
  - `L64` [③JS字符串] `加载权限数据失败: ${error.message}`
  - `L112` [③JS字符串] `登录状态已失效，请重新登录`
  - `L123` [③JS字符串] `权限组名称不能为空`
  - `L128` [③JS字符串] `至少填写一个权限标识`
  - `L150` [③JS字符串] `权限组已更新`
  - `L150` [③JS字符串] `权限组已创建`
  - `L157` [③JS字符串] `保存权限组失败: ${error.message}`
  - `L171` [③JS字符串] `登录状态已失效，请重新登录`
  - `L176` [③JS字符串] `确认删除权限组“${group.name}”？`
  - `L191` [③JS字符串] `权限组已删除`
  - `L195` [③JS字符串] `删除权限组失败: ${error.message}`
  - `L205` [①JSX文本] `权限管理`
  - `L208` [③JS字符串] ` 当前账号为只读模式。`
  - `L214` [③JS字符串] `刷新中...`
  - `L214` [③JS字符串] `刷新`
  - `L217` [①JSX文本] `添加权限组`
  - `L226` [①JSX文本] `加载中...`
  - `L239` [①JSX文本] `只读`
  - `L243` [①JSX文本] `可编辑`
  - `L246` [③JS字符串] `暂无描述`
  - `L267` [①JSX文本] `暂无分配成员`
  - `L278` [③JS字符串] `当前账号没有 manage_permissions 权限`
  - `L278` [③JS字符串] `系统权限组不可编辑`
  - `L278` [③JS字符串] `编辑权限组`
  - `L287` [③JS字符串] `当前账号没有 manage_permissions 权限`
  - `L287` [③JS字符串] `系统权限组不可删除`
  - `L287` [③JS字符串] `删除权限组`
  - `L301` [③JS字符串] `编辑权限组`
  - `L301` [③JS字符串] `添加权限组`
  - `L305` [①JSX文本] `名称`
  - `L311` [②placeholder] `例如：内容审核组`
  - `L315` [①JSX文本] `描述`
  - `L321` [②placeholder] `说明这组权限负责什么。`
  - `L325` [①JSX文本] `权限标识`
  - `L331` [②placeholder] `逗号分隔，例如：review_tasks, publish_prizes`
  - `L335` [①JSX文本] `分配成员`
  - `L354` [①JSX文本] `取消`
  - `L358` [③JS字符串] `保存中...`
  - `L358` [③JS字符串] `保存权限组`
- `frontend/src/pages/admin/PointsManagement.jsx` — 47 条
  - `L10` [③JS字符串] `从未更新`
  - `L12` [③JS字符串] `从未更新`
  - `L56` [③JS字符串] `未登录`
  - `L61` [③JS字符串] `当前账号没有后台访问权限`
  - `L75` [③JS字符串] `加载用户积分失败: ${error.message}`
  - `L90` [③JS字符串] `请填写完整的调整信息`
  - `L96` [③JS字符串] `请输入有效的积分数额`
  - `L107` [③JS字符串] `登录状态已失效，请重新登录`
  - `L145` [③JS字符串] `成功为用户 #${selectedUser.uID}${adjustType === 'add' ? '增加' : '减少'} ${amount} 积分`
  - `L153` [③JS字符串] `积分调整失败: ${error.message}`
  - `L172` [①JSX文本] `总用户数`
  - `L184` [①JSX文本] `总积分`
  - `L196` [①JSX文本] `平均积分`
  - `L208` [①JSX文本] `零积分用户`
  - `L219` [①JSX文本] `用户积分管理`
  - `L222` [③JS字符串] `你可以执行积分调整。`
  - `L222` [③JS字符串] `当前账号为只读模式。`
  - `L230` [②placeholder] `搜索用户地址或ID...`
  - `L238` [③JS字符串] `刷新中...`
  - `L238` [③JS字符串] `刷新数据`
  - `L246` [①JSX文本] `加载中...`
  - `L254` [①JSX文本] `用户ID`
  - `L257` [①JSX文本] `钱包地址`
  - `L260` [①JSX文本] `当前积分`
  - `L263` [①JSX文本] `最后更新`
  - `L266` [①JSX文本] `角色`
  - `L269` [①JSX文本] `操作`
  - `L290` [①JSX文本] `积分`
  - `L298` [③JS字符串] `管理员`
  - `L298` [③JS字符串] `普通用户`
  - `L309` [③JS字符串] `增加积分`
  - `L309` [③JS字符串] `当前账号没有 manage_points 权限`
  - `L319` [③JS字符串] `减少积分`
  - `L319` [③JS字符串] `当前账号没有 manage_points 权限`
  - `L334` [①JSX文本] `没有找到匹配的用户`
  - `L342` [③JS字符串] `${adjustType === 'add' ? '增加' : '减少'}积分`
  - `L347` [①JSX文本] `操作用户:`
  - `L350` [①JSX文本] `钱包地址:`
  - `L356` [①JSX文本] `当前积分:`
  - `L364` [③JS字符串] `增加`
  - `L364` [③JS字符串] `减少`
  - `L371` [②placeholder] `请输入积分数额`
  - `L377` [①JSX文本] `调整原因`
  - `L383` [②placeholder] `请输入调整原因...`
  - `L394` [①JSX文本] `取消`
  - `L402` [③JS字符串] `处理中...`
  - `L402` [③JS字符串] `确认${adjustType === 'add' ? '增加' : '减少'}`
- `frontend/src/pages/admin/RewardsManagement.jsx` — 44 条
  - `L60` [③JS字符串] `加载奖品失败: ${error.message}`
  - `L121` [③JS字符串] `登录状态已失效，请重新登录`
  - `L126` [③JS字符串] `奖品名称和符号不能为空`
  - `L131` [③JS字符串] `请设置奖品有效期截止时间`
  - `L161` [③JS字符串] `保存奖品失败: ${error.message}`
  - `L175` [③JS字符串] `登录状态已失效，请重新登录`
  - `L179` [③JS字符串] `确认删除奖品“${reward.name}”？如果已有库存或领取记录，将不会允许删除。`
  - `L188` [③JS字符串] `删除奖品失败: ${error.message}`
  - `L202` [①JSX文本] `奖品管理`
  - `L211` [③JS字符串] `刷新中...`
  - `L211` [③JS字符串] `刷新`
  - `L218` [①JSX文本] `加载中...`
  - `L226` [③JS字符串] `奖品 #${reward.bID}`
  - `L227` [③JS字符串] `暂无描述`
  - `L239` [③JS字符串] `流通中 ${Math.ceil((reward.circulation_seconds || 0) / 86400)} 天`
  - `L241` [③JS字符串] `清算中 ${Math.ceil((reward.liquidation_seconds || 0) / 86400)} 天`
  - `L242` [③JS字符串] `已过期`
  - `L248` [②title] `查看详情`
  - `L263` [③JS字符串] `发布奖品`
  - `L263` [③JS字符串] `编辑奖品`
  - `L263` [③JS字符串] `奖品详情`
  - `L269` [①JSX文本] `符号`
  - `L279` [①JSX文本] `名称`
  - `L290` [①JSX文本] `描述`
  - `L300` [①JSX文本] `图片 URL`
  - `L311` [①JSX文本] `兑换积分`
  - `L322` [①JSX文本] `保底积分值`
  - `L333` [③JS字符串] `当前配置将把单片最低成交价锁定为 ${minimumShardPrice} J；低于该价格的订单不会成交。`
  - `L334` [③JS字符串] `奖品有效期需超过 30 天，才可设置市场保底积分值。`
  - `L340` [①JSX文本] `奖品总量`
  - `L350` [①JSX文本] `保底单片价：`
  - `L353` [③JS字符串] `未启用`
  - `L359` [①JSX文本] `有效开始时间`
  - `L369` [①JSX文本] `有效截止时间`
  - `L393` [①JSX文本] `最多免费碎片：`
  - `L403` [①JSX文本] `已兑换`
  - `L407` [①JSX文本] `已兑现`
  - `L411` [①JSX文本] `可流通碎片上限`
  - `L415` [①JSX文本] `保底积分值`
  - `L419` [①JSX文本] `已送出免费碎片`
  - `L423` [①JSX文本] `剩余免费碎片`
  - `L427` [①JSX文本] `剩余流通空间`
  - `L431` [①JSX文本] `保底单片价`
  - `L437` [①JSX文本] `关闭`
- `frontend/src/pages/admin/ShardsManagement.jsx` — 24 条
  - `L51` [③JS字符串] `加载失败: ${error.message}`
  - `L85` [①JSX文本] `加载中...`
  - `L100` [①JSX文本] `奖品:`
  - `L118` [①JSX文本] `碎片管理`
  - `L120` [①JSX文本] `刷新`
  - `L127` [①JSX文本] `持仓总览`
  - `L128` [①JSX文本] `挂单管理`
  - `L129` [①JSX文本] `成交记录`
  - `L135` [①JSX文本] `用户个人持仓可通过`
  - `L136` [①JSX文本] `查询（需认证）。暂无管理员聚合接口，各用户持仓请通过奖品维度订单簿和成交记录推断。`
  - `L142` [①JSX文本] `奖品`
  - `L144` [①JSX文本] `库存奖品数`
  - `L169` [①JSX文本] `暂无挂单`
  - `L174` [①JSX文本] `价格`
  - `L175` [①JSX文本] `剩余量`
  - `L195` [①JSX文本] `暂无挂单`
  - `L200` [①JSX文本] `价格`
  - `L201` [①JSX文本] `剩余量`
  - `L224` [①JSX文本] `暂无成交记录`
  - `L229` [①JSX文本] `价格`
  - `L230` [①JSX文本] `数量`
  - `L231` [①JSX文本] `买方`
  - `L232` [①JSX文本] `卖方`
  - `L233` [①JSX文本] `时间`
- `frontend/src/pages/admin/SystemSettings.jsx` — 29 条
  - `L10` [③JS字符串] `去中心化社区奖励平台`
  - `L38` [③JS字符串] `未登录`
  - `L43` [③JS字符串] `当前账号没有后台访问权限`
  - `L59` [③JS字符串] `加载系统设置失败: ${error.message}`
  - `L74` [③JS字符串] `登录状态已失效，请重新登录`
  - `L106` [③JS字符串] `设置已保存`
  - `L109` [③JS字符串] `保存失败: ${error.message}`
  - `L135` [①JSX文本] `系统设置`
  - `L139` [③JS字符串] ` 当前账号为只读模式。`
  - `L146` [③JS字符串] `保存中...`
  - `L146` [③JS字符串] `保存设置`
  - `L154` [①JSX文本] `加载中...`
  - `L159` [③JS字符串] `存在未保存修改。`
  - `L159` [③JS字符串] `当前内容与已保存设置一致。`
  - `L167` [①JSX文本] `基本设置`
  - `L173` [①JSX文本] `网站描述`
  - `L182` [①JSX文本] `默认语言`
  - `L188` [①JSX文本] `中文`
  - `L190` [①JSX文本] `繁體中文`
  - `L201` [①JSX文本] `系统设置`
  - `L208` [①JSX文本] `维护模式`
  - `L209` [①JSX文本] `启用后用户无法访问网站`
  - `L220` [①JSX文本] `允许注册`
  - `L221` [①JSX文本] `新用户可以注册账号`
  - `L232` [①JSX文本] `邮件通知`
  - `L233` [①JSX文本] `发送系统邮件通知`
  - `L249` [①JSX文本] `积分设置`
  - `L255` [①JSX文本] `默认任务积分`
  - `L264` [①JSX文本] `每日最大任务数`
- `frontend/src/pages/admin/TasksManagement.jsx` — 21 条
  - `L18` [③JS字符串] `未设置`
  - `L20` [③JS字符串] `未设置`
  - `L56` [③JS字符串] `加载任务失败: ${error.message}`
  - `L112` [①JSX文本] `任务管理`
  - `L121` [③JS字符串] `刷新中...`
  - `L121` [③JS字符串] `刷新`
  - `L128` [①JSX文本] `加载中...`
  - `L137` [③JS字符串] `暂无描述`
  - `L141` [③JS字符串] `开启`
  - `L141` [③JS字符串] `关闭`
  - `L148` [②title] `查看详情`
  - `L163` [③JS字符串] `添加任务`
  - `L163` [③JS字符串] `编辑任务`
  - `L163` [③JS字符串] `任务详情`
  - `L168` [①JSX文本] `标题`
  - `L178` [①JSX文本] `描述`
  - `L199` [①JSX文本] `积分`
  - `L211` [①JSX文本] `主链接`
  - `L221` [①JSX文本] `备用链接`
  - `L237` [①JSX文本] `任务开启`
  - `L241` [①JSX文本] `关闭`
- `frontend/src/pages/admin/UsersManagement.jsx` — 39 条
  - `L11` [③JS字符串] `未知`
  - `L13` [③JS字符串] `未知`
  - `L52` [③JS字符串] `未登录`
  - `L57` [③JS字符串] `当前账号没有后台访问权限`
  - `L66` [③JS字符串] `加载用户数据失败: ${error.message}`
  - `L88` [③JS字符串] `登录状态已失效，请重新登录`
  - `L96` [③JS字符串] `确认将用户 #${user.uID} 提升为管理员？`
  - `L97` [③JS字符串] `确认撤销用户 #${user.uID} 的管理员权限？`
  - `L130` [③JS字符串] `管理员权限已授予`
  - `L130` [③JS字符串] `管理员权限已撤销`
  - `L133` [③JS字符串] `更新用户失败: ${error.message}`
  - `L146` [①JSX文本] `总用户数`
  - `L158` [①JSX文本] `管理员`
  - `L170` [①JSX文本] `有资产记录`
  - `L182` [①JSX文本] `总积分`
  - `L193` [①JSX文本] `用户管理`
  - `L196` [③JS字符串] `你可以调整管理员权限。`
  - `L196` [③JS字符串] `当前账号为只读模式，可查看用户但不能修改管理员权限。`
  - `L204` [②placeholder] `搜索用户ID、地址或简介...`
  - `L216` [③JS字符串] `刷新中...`
  - `L216` [③JS字符串] `刷新数据`
  - `L224` [①JSX文本] `加载中...`
  - `L232` [①JSX文本] `用户ID`
  - `L235` [①JSX文本] `钱包地址`
  - `L238` [①JSX文本] `简介`
  - `L241` [①JSX文本] `积分`
  - `L244` [①JSX文本] `角色`
  - `L247` [①JSX文本] `注册时间`
  - `L250` [①JSX文本] `最近登录`
  - `L253` [①JSX文本] `操作`
  - `L270` [③JS字符串] `暂无简介`
  - `L277` [③JS字符串] `管理员`
  - `L277` [③JS字符串] `普通用户`
  - `L294` [③JS字符串] `当前账号没有 manage_users 权限`
  - `L294` [③JS字符串] `撤销管理员权限`
  - `L294` [③JS字符串] `授予管理员权限`
  - `L304` [③JS字符串] `前往积分管理`
  - `L304` [③JS字符串] `当前账号没有 manage_points 权限`
  - `L319` [①JSX文本] `没有找到匹配的用户`

#### B5 — 组件库 + 开发/比选预览页

- `frontend/src/components/ui/Advanced.jsx` — 7 条
  - `L6` [②placeholder] `搜索...`
  - `L105` [②placeholder] `选择日期`
  - `L179` [①JSX文本] `筛选`
  - `L236` [①JSX文本] `清除筛选`
  - `L242` [①JSX文本] `应用筛选`
  - `L283` [①JSX文本] `上一页`
  - `L311` [①JSX文本] `下一页`
- `frontend/src/components/ui/DashJ.jsx` — 1 条
  - `L30` [②title] `dashJ 社区积分`
- `frontend/src/components/ui/DataDisplay.jsx` — 2 条
  - `L90` [③JS字符串] `暂无数据`
  - `L228` [①JSX文本] `进度`
- `frontend/src/components/ui/ErrorHandling.jsx` — 25 条
  - `L77` [①JSX文本] `出现了一些问题`
  - `L81` [①JSX文本] `应用程序遇到了意外错误。我们已经记录了这个问题，请稍后再试。`
  - `L90` [①JSX文本] `重试`
  - `L98` [①JSX文本] `返回首页`
  - `L110` [③JS字符串] `隐藏`
  - `L110` [③JS字符串] `显示`
  - `L116` [①JSX文本] `错误信息:`
  - `L124` [①JSX文本] `组件堆栈:`
  - `L178` [①JSX文本] `网络连接异常`
  - `L182` [①JSX文本] `请检查您的网络连接，然后重试。`
  - `L211` [③JS字符串] `发生未知错误`
  - `L218` [③JS字符串] `请求参数错误`
  - `L221` [③JS字符串] `未授权访问`
  - `L224` [③JS字符串] `权限不足`
  - `L227` [③JS字符串] `请求的资源不存在`
  - `L230` [③JS字符串] `服务器内部错误`
  - `L233` [③JS字符串] `服务器错误 (${status})`
  - `L237` [③JS字符串] `网络连接失败`
  - `L240` [③JS字符串] `发生未知错误`
  - `L283` [①JSX文本] `错误`
  - `L287` [①JSX文本] `详细信息`
  - `L312` [①JSX文本] `页面未找到`
  - `L316` [①JSX文本] `您访问的页面不存在或已被移动。`
  - `L324` [①JSX文本] `返回首页`
  - `L333` [③JS字符串] `加载中...`
- `frontend/src/components/ui/Loading.jsx` — 1 条
  - `L74` [③JS字符串] `加载中...`
- `frontend/src/components/ui/Performance.jsx` — 4 条
  - `L131` [①JSX文本] `加载失败`
  - `L227` [③JS字符串] `请稍候...`
  - `L279` [①JSX文本] `没有更多数据了`
  - `L343` [①JSX文本] `加载中...`
- `frontend/src/theme/tokens.js` — 23 条
  - `L437` [③JS字符串] `夜档数字等宽字体 font-family`
  - `L437` [③JS字符串] `style-preview.html:193（基础层未指定，继承 body 字族）`
  - `L437` [③JS字符串] `字体度量改变文本推进宽度 ⇒ 会改 getBoundingClientRect，与「主题同构」硬判据冲突；本单收敛为 STRUCT.num-font=inherit，登记为延期项（需单独量测单元）。`
  - `L438` [③JS字符串] `style-preview.html:88（基础层 .02em）`
  - `L438` [③JS字符串] `字距改文本宽度 ⇒ 同上，收敛为基础层 .02em。`
  - `L439` [③JS字符串] `数字字号（价牌 21/26px、酬金 24/30px、水印 46/52px）`
  - `L439` [③JS字符串] `font-size 直接改高度/宽度 ⇒ 收敛为 STRUCT 常量（取日档值）。`
  - `L440` [③JS字符串] `描边宽度（1.5px/2px vs 1px）、border-left 4px`
  - `L440` [③JS字符串] `border-width 计入 border-box 尺寸 ⇒ 收敛为 STRUCT.stroke-w* 常量。`
  - `L441` [③JS字符串] `价牌 padding / 手机端发布按钮 padding`
  - `L441` [③JS字符串] `style-preview.html:297(无),327`
  - `L441` [③JS字符串] `padding 改盒尺寸 ⇒ 收敛为基础层常量。`
  - `L442` [③JS字符串] `信息流列数与间距（4 列/16px vs 3 列/13px；手机 2 列/9px vs 1 列/8px）`
  - `L442` [③JS字符串] `栅格列数属断点层（本单要求横竖屏也不得按主题变）⇒ 收敛为 STRUCT.feed-cols*。`
  - `L443` [③JS字符串] `手机卡 flex-direction:row（夜档横排卡）`
  - `L443` [③JS字符串] `style-preview.html:329 仅夜档有`
  - `L443` [③JS字符串] `改盒子排布 ⇒ 同构硬约束下不得按主题分支；登记为延期项。`
  - `L444` [③JS字符串] `.price align-self:flex-start（日档）`
  - `L444` [③JS字符串] `改对齐与盒宽 ⇒ 收敛为基础层同一对齐。`
  - `L445` [③JS字符串] `opacity 差（如 meta .72 ⇒ 1）`
  - `L445` [③JS字符串] `opacity 不改几何（可入主题层），但本单统一用显式色值表达，避免与既有 Tailwind 透明的 opacity 叠乘。`
  - `L446` [③JS字符串] `手机壳宽度 377px / 演示框缩放`
  - `L446` [③JS字符串] `比选页自带的展示用量具，非产品 token。`
- `frontend/src/pages/ThemePreviewPage.jsx` — 25 条
  - `L90` [①JSX文本] `主题 token + 横竖屏骨架 · 可交互预览（P4-B4c-i 地基）`
  - `L91` [①JSX文本] `当前档：`
  - `L98` [①JSX文本] `日档 · 码头大牌`
  - `L99` [①JSX文本] `夜档 · 夜市行情板`
  - `L115` [①JSX文本] `搜 鲜活皮皮虾 / 大黄鱼 / 码头夜班招工 / 兑换 dashJ —— 四语切换与主题切换都不改这一行的高度`
  - `L118` [③JS字符串] `招工`
  - `L118` [③JS字符串] `商品`
  - `L118` [③JS字符串] `积分交易所`
  - `L118` [③JS字符串] `终身返佣`
  - `L118` [③JS字符串] `全部`
  - `L133` [①JSX文本] `/ 斤`
  - `L135` [①JSX文本] `沈家门码头 · 手工开壳 · 当日捕`
  - `L143` [①JSX文本] `招工精选 · 今日上新`
  - `L144` [①JSX文本] `码头分拣夜班（沈家门）`
  - `L144` [①JSX文本] `$320/天`
  - `L146` [①JSX文本] `远洋船务搬运（舟山）`
  - `L146` [①JSX文本] `$410/天`
  - `L148` [①JSX文本] `冷库分装白班（宁波）`
  - `L148` [①JSX文本] `$280/天`
  - `L151` [①JSX文本] `积分行情`
  - `L154` [①JSX文本] `终身多级返佣 · 十级`
  - `L159` [①JSX文本] `现行生效值（读 window.getComputedStyle，用于证明「主题确实换了值」）`
  - `L166` [①JSX文本] `日档（变体 A）`
  - `L166` [①JSX文本] `夜档（变体 B）`
  - `L166` [①JSX文本] `同值?`

### ①-2 类别 ④（注释/console，不计入需修复集）逐文件计数

| 文件 | ④ 条数 | 其中 console |
|---|---|---|
| `frontend/src/App.jsx` | 30 | 0 |
| `frontend/src/auth.js` | 7 | 0 |
| `frontend/src/components/ActiveTaskModal.jsx` | 7 | 0 |
| `frontend/src/components/Footer.jsx` | 9 | 0 |
| `frontend/src/components/Header.jsx` | 22 | 0 |
| `frontend/src/components/i18n/TranslatingBadge.jsx` | 8 | 0 |
| `frontend/src/components/layout/AdminLayout.jsx` | 7 | 0 |
| `frontend/src/components/reward/RewardCard.jsx` | 2 | 0 |
| `frontend/src/components/task/TaskCard.jsx` | 1 | 0 |
| `frontend/src/components/ui/Button.jsx` | 2 | 0 |
| `frontend/src/components/ui/DashJ.jsx` | 3 | 0 |
| `frontend/src/components/ui/ErrorHandling.jsx` | 13 | 0 |
| `frontend/src/components/ui/HoverMenu.jsx` | 1 | 0 |
| `frontend/src/components/ui/MicroInteractions.jsx` | 11 | 0 |
| `frontend/src/components/ui/Modal.jsx` | 4 | 0 |
| `frontend/src/components/ui/Performance.jsx` | 17 | 0 |
| `frontend/src/components/ui/Responsive.jsx` | 2 | 0 |
| `frontend/src/components/ui/Toast.jsx` | 3 | 0 |
| `frontend/src/components/ui/index.js` | 13 | 0 |
| `frontend/src/i18n-content.js` | 22 | 0 |
| `frontend/src/i18n.js` | 3 | 0 |
| `frontend/src/idempotency.js` | 15 | 0 |
| `frontend/src/main.jsx` | 5 | 0 |
| `frontend/src/pages/ProfilePage.jsx` | 25 | 0 |
| `frontend/src/pages/RewardPage.jsx` | 9 | 0 |
| `frontend/src/pages/ShardPage.jsx` | 12 | 0 |
| `frontend/src/pages/TaskPage.jsx` | 1 | 0 |
| `frontend/src/pages/ThemePreviewPage.jsx` | 7 | 0 |
| `frontend/src/pages/admin/PermissionsManagement.jsx` | 5 | 0 |
| `frontend/src/pages/admin/RewardsManagement.jsx` | 6 | 0 |
| `frontend/src/pages/admin/SystemSettings.jsx` | 14 | 0 |
| `frontend/src/pages/admin/TasksManagement.jsx` | 8 | 0 |
| `frontend/src/pages/admin/UsersManagement.jsx` | 3 | 0 |
| `frontend/src/pages/jobs/JobDetailPage.jsx` | 9 | 0 |
| `frontend/src/pages/jobs/JobReviewPage.jsx` | 15 | 0 |
| `frontend/src/pages/jobs/PublishJobPage.jsx` | 10 | 0 |
| `frontend/src/pages/jobs/job-api.js` | 35 | 0 |
| `frontend/src/pages/listings/ListingDetailPage.jsx` | 12 | 0 |
| `frontend/src/pages/listings/ListingsPage.jsx` | 18 | 0 |
| `frontend/src/pages/listings/PublishListingPage.jsx` | 9 | 0 |
| `frontend/src/pages/listings/listing-api.js` | 37 | 0 |
| `frontend/src/pages/market/MarketPage.jsx` | 30 | 0 |
| `frontend/src/pages/market/market-api.js` | 31 | 0 |
| `frontend/src/shell/AppShell.jsx` | 4 | 0 |
| `frontend/src/shell/BottomTabBar.jsx` | 3 | 0 |
| `frontend/src/shell/breakpoints.js` | 7 | 0 |
| `frontend/src/shell/nav.js` | 10 | 0 |
| `frontend/src/theme/ThemeProvider.jsx` | 6 | 0 |
| `frontend/src/theme/tokens.js` | 20 | 0 |
| `frontend/src/utils.js` | 24 | 0 |
| **合计** | **577** | **0** |

> 说明：类别 ④ 含中文的注释共 577 条、文件 50 个——这些是**设计说明/登记**，属开发者文档而非用户可见文案，**不进入修复集**。

### ①-3 测试夹具（class ⑤）

| 测试文件 | 条数 | c1/c2/c3/c4 |
|---|---|---|
| `frontend/src/test/accessibility/Accessibility.test.jsx` | 1 | 0/0/0/1 |
| `frontend/src/test/e2e/basic.spec.js` | 10 | 0/0/10/0 |
| `frontend/src/test/setup.js` | 2 | 0/0/0/2 |
| `frontend/src/test/unit/auth.test.js` | 12 | 0/0/6/6 |
| `frontend/src/test/unit/dashboard-page.test.jsx` | 9 | 0/0/9/0 |
| `frontend/src/test/unit/home-page.test.jsx` | 13 | 0/0/13/0 |
| `frontend/src/test/unit/i18n-content-wiring.test.jsx` | 53 | 0/0/38/15 |
| `frontend/src/test/unit/lang-path-redirect.test.jsx` | 16 | 0/0/11/5 |
| `frontend/src/test/unit/lang-path.test.js` | 18 | 0/0/17/1 |
| `frontend/src/test/unit/listing-market.test.jsx` | 27 | 0/0/22/5 |
| `frontend/src/test/unit/theme-shell-isomorphism.test.jsx` | 36 | 0/0/22/14 |
| `frontend/src/test/unit/theme-tokens.test.js` | 29 | 0/0/23/6 |
| `frontend/src/test/unit/ui-barrel-exports.test.js` | 38 | 0/0/15/23 |
| **合计** | **264** | 0/0/186/78 |

> 测试夹具**不计入需修复集**（断言用中文 mock 是测试可读性选择；其中 78 条为注释）。

## 表② 用户可见分类

判定法：把 class ①②③ 的字面量原文与四语键集（zh/hk/en/vn 各 flat 177 键）的 **zh 值**逐字比对。命中 ⇒（a）；未命中且非「不应国际化」⇒（b）；其余 ⇒（c）。

### ②-a 「已有键但代码没用」——改代码即可（**最便宜的一档**）

命中 **19 个不同文本 / 49 条出现**：

| 原文（zh 值） | 已有键 | 出现处（file:line） |
|---|---|---|
| `上一页` | `prev` | `components/ui/Advanced.jsx:283` |
| `下一页` | `next` | `components/ui/Advanced.jsx:311` |
| `价格` | `market.price` | `pages/admin/ShardsManagement.jsx:174`、`pages/admin/ShardsManagement.jsx:200`、`pages/admin/ShardsManagement.jsx:229` |
| `任务统计` | `tasksStats` | `pages/DashboardPage.jsx:132` |
| `刷新` | `jobs.refresh`, `listings.refresh`, `market.refresh` | `pages/DashboardPage.jsx:411`、`pages/admin/PermissionsManagement.jsx:214`、`pages/admin/RewardsManagement.jsx:211`、`pages/admin/ShardsManagement.jsx:120`、`pages/admin/TasksManagement.jsx:121` |
| `加载中...` | `loading` | `components/ui/ErrorHandling.jsx:333`、`components/ui/Loading.jsx:74`、`components/ui/Performance.jsx:343`、`pages/admin/PermissionsManagement.jsx:226`、`pages/admin/PointsManagement.jsx:246`、`pages/admin/RewardsManagement.jsx:218`、`pages/admin/ShardsManagement.jsx:85`、`pages/admin/SystemSettings.jsx:154`、`pages/admin/TasksManagement.jsx:128`、`pages/admin/UsersManagement.jsx:224` |
| `取消` | `cancel` | `components/ClaimRewardModal.jsx:118`、`pages/ProfilePage.jsx:246`、`pages/admin/PermissionsManagement.jsx:354`、`pages/admin/PointsManagement.jsx:394` |
| `可兑换` | `CanClaim` | `pages/HomePage.jsx:84`、`pages/RewardPage.jsx:99`、`pages/RewardPage.jsx:317` |
| `待验证` | `pendingVerification` | `pages/TaskPage.jsx:153`、`pages/TaskPage.jsx:266` |
| `数量` | `listings.quantity`, `market.amount` | `pages/admin/ShardsManagement.jsx:230` |
| `暂无挂单` | `market.mineEmpty` | `pages/admin/ShardsManagement.jsx:169`、`pages/admin/ShardsManagement.jsx:195` |
| `暂无数据` | `noData` | `components/ui/DataDisplay.jsx:90` |
| `查看详情` | `viewDetails` | `pages/admin/RewardsManagement.jsx:248`、`pages/admin/TasksManagement.jsx:148` |
| `登录已过期，请重新登录` | `sessionExpired` | `components/ActiveTaskModal.jsx:63` |
| `碎片市场` | `shard` | `components/Header.jsx:119` |
| `管理面板` | `admin_panel` | `components/Header.jsx:121`、`components/layout/AdminLayout.jsx:132`、`components/layout/AdminLayout.jsx:200` |
| `请先登录` | `pleaseLogin` | `components/ClaimRewardModal.jsx:45`、`components/ClaimRewardModal.jsx:64`、`pages/HomePage.jsx:180`、`pages/ProfilePage.jsx:191`、`pages/RewardPage.jsx:147`、`pages/RewardPage.jsx:173` |
| `错误` | `error` | `components/ui/ErrorHandling.jsx:283` |
| `限时` | `giftStatusLimited` | `components/task/TaskCard.jsx:42` |

### ②-b 「需新增键」

- 条数：**545 条**（去重后 **432 个不同文本**）
- 四语初稿见 **表③**（共享词条全量给四语；页面专有长文案见 表③-2 命名规则 + 表①-1 原文）
- 无插值纯文本占多数；含 `${}` 插值的需先拆成 `key` + `{{var}}`（i18next 语法），已在下表标注

### ②-c 「不应国际化」

| 位置 | 文本 | 理由 |
|---|---|---|
| `components/Footer.jsx:8` | `猫猫大使团｜不止一份报酬，更加一份经验。` | 品牌项目名 + 中文 slogan（猫猫大使团/云朵计划），与 `siteTitle` 同类品牌文案，建议保留原文 |
| `components/Footer.jsx:9` | `猫猫大使团｜你的声音，值得被品牌听见。` | 品牌项目名 + 中文 slogan（猫猫大使团/云朵计划），与 `siteTitle` 同类品牌文案，建议保留原文 |
| `components/Footer.jsx:10` | `你的代言，从猫猫大使团开始。` | 品牌项目名 + 中文 slogan（猫猫大使团/云朵计划），与 `siteTitle` 同类品牌文案，建议保留原文 |
| `components/Footer.jsx:31` | `云朵计划｜播种童年梦想，浇灌美和希望。` | 品牌项目名 + 中文 slogan（猫猫大使团/云朵计划），与 `siteTitle` 同类品牌文案，建议保留原文 |
| `components/Footer.jsx:111` | `联系我们：contact@jinli.club` | 联系邮箱为品牌常量；标签「联系我们：」需 i18n，邮箱本体不译（拆分处理） |
| `components/Footer.jsx:113` | `聯繫我們：contact@jinli.club` | 联系邮箱为品牌常量；标签「联系我们：」需 i18n，邮箱本体不译（拆分处理） |
| `components/Header.jsx:196` | `中文` | 语言自称（中文/粵語）——语言名以本语言书写、不随界面语言变；**但这是产品决策点**：亦可复用已有键 `chinese`(`简体中文`)/`cantonese`(`粤语`) 并统一措辞（若采纳则归入 ②-a，改代码即可、零新增键） |
| `components/Header.jsx:210` | `粵語` | 语言自称（中文/粵語）——语言名以本语言书写、不随界面语言变；**但这是产品决策点**：亦可复用已有键 `chinese`(`简体中文`)/`cantonese`(`粤语`) 并统一措辞（若采纳则归入 ②-a，改代码即可、零新增键） |
| `components/Header.jsx:367` | `中文` | 语言自称（中文/粵語）——语言名以本语言书写、不随界面语言变；**但这是产品决策点**：亦可复用已有键 `chinese`(`简体中文`)/`cantonese`(`粤语`) 并统一措辞（若采纳则归入 ②-a，改代码即可、零新增键） |
| `components/Header.jsx:387` | `粵語` | 语言自称（中文/粵語）——语言名以本语言书写、不随界面语言变；**但这是产品决策点**：亦可复用已有键 `chinese`(`简体中文`)/`cantonese`(`粤语`) 并统一措辞（若采纳则归入 ②-a，改代码即可、零新增键） |
| `pages/ThemePreviewPage.jsx:90` | `主题 token + 横竖屏骨架 · 可交互预览（P4-B4c-i 地基）` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:91` | `当前档：` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:98` | `日档 · 码头大牌` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:99` | `夜档 · 夜市行情板` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:115` | `搜 鲜活皮皮虾 / 大黄鱼 / 码头夜班招工 / 兑换 dashJ —— 四语切换与主题切换都不改这一行的高度` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:118` | `全部` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:118` | `商品` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:118` | `招工` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:118` | `积分交易所` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:118` | `终身返佣` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:133` | `/ 斤` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:135` | `沈家门码头 · 手工开壳 · 当日捕` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:143` | `招工精选 · 今日上新` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:144` | `$320/天` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:144` | `码头分拣夜班（沈家门）` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:146` | `$410/天` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:146` | `远洋船务搬运（舟山）` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:148` | `$280/天` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:148` | `冷库分装白班（宁波）` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:151` | `积分行情` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:154` | `终身多级返佣 · 十级` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:159` | `现行生效值（读 window.getComputedStyle，用于证明「主题确实换了值」）` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:166` | `同值?` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:166` | `夜档（变体 B）` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `pages/ThemePreviewPage.jsx:166` | `日档（变体 A）` | 开发/比选预览页（P4-B4c-i 地基）的**演示数据**与自述，非产品发布面 |
| `theme/tokens.js:437` | `style-preview.html:193（基础层未指定，继承 body 字族）` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:437` | `夜档数字等宽字体 font-family` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:437` | `字体度量改变文本推进宽度 ⇒ 会改 getBoundingClientRect，与「主题同构」硬判据冲突；本单收敛为 STRUCT.num-font=inherit，登记为延期项（需单独量测单元）。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:438` | `style-preview.html:88（基础层 .02em）` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:438` | `字距改文本宽度 ⇒ 同上，收敛为基础层 .02em。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:439` | `font-size 直接改高度/宽度 ⇒ 收敛为 STRUCT 常量（取日档值）。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:439` | `数字字号（价牌 21/26px、酬金 24/30px、水印 46/52px）` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:440` | `border-width 计入 border-box 尺寸 ⇒ 收敛为 STRUCT.stroke-w* 常量。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:440` | `描边宽度（1.5px/2px vs 1px）、border-left 4px` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:441` | `padding 改盒尺寸 ⇒ 收敛为基础层常量。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:441` | `style-preview.html:297(无),327` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:441` | `价牌 padding / 手机端发布按钮 padding` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:442` | `信息流列数与间距（4 列/16px vs 3 列/13px；手机 2 列/9px vs 1 列/8px）` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:442` | `栅格列数属断点层（本单要求横竖屏也不得按主题变）⇒ 收敛为 STRUCT.feed-cols*。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:443` | `style-preview.html:329 仅夜档有` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:443` | `手机卡 flex-direction:row（夜档横排卡）` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:443` | `改盒子排布 ⇒ 同构硬约束下不得按主题分支；登记为延期项。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:444` | `.price align-self:flex-start（日档）` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:444` | `改对齐与盒宽 ⇒ 收敛为基础层同一对齐。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:445` | `opacity 不改几何（可入主题层），但本单统一用显式色值表达，避免与既有 Tailwind 透明的 opacity 叠乘。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:445` | `opacity 差（如 meta .72 ⇒ 1）` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:446` | `手机壳宽度 377px / 演示框缩放` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |
| `theme/tokens.js:446` | `比选页自带的展示用量具，非产品 token。` | 主题 token 对照表**数据**（开发比选用量具），非产品面文案 |

**部分豁免（混合串，需拆）**：
- `components/reward/RewardCard.jsx:151` — 品牌 token `dashJ` 不译，中文部分（社区积分/不足）属 ②-b
- `components/ui/DashJ.jsx:30` — 品牌 token `dashJ` 不译，中文部分（社区积分/不足）属 ②-b
- 非 CJK 的品牌/代码/单位符号（不在本扫描口径内，单独列出）：`$`（积分符号）、`dashJ`、`Jinli Club`、`EVM`、`MetaMask`、`OKX Wallet`、`gas`、`Task Progress`、`manage_points/manage_users/manage_permissions/review_tasks/publish_prizes`、`contact@jinli.club`、`review_tasks, publish_prizes` —— **一律不国际化**（品牌名/权限标识/接口名/邮箱）。

### ② 三类占比

| 类 | 条数 | 占需修复集 |
|---|---|---|
| (a) 已有键未用 | 49 | 7.5% |
| (b) 需新增键 | 545 | 83.6% |
| (c) 不应国际化 | 58 | 8.9% |
| **合计** | **652** | 100% |

## 表③ 需新增键清单（含四语初稿）

### ③-1 共享词条（跨页复用，**给全四语初稿**，共 76 键）

建议命名空间：`common.*`（跨页复用语汇）/ `page.*`（页面标题与副标题）/ `task.*`·`reward.*`·`auth.*`·`nav.*`（业务域）。**新增键必须四语齐备**（四文件键集必须继续相等——现状 flat 177 全等）。

| 建议键 | zh | hk | en | vn |
|---|---|---|---|---|
| `common.loading` | 加载中... | 載入緊... | Loading... | Đang tải... |
| `common.loadingTasks` | 正在加载任务... | 載入緊任務... | Loading tasks... | Đang tải nhiệm vụ... |
| `common.loadingRewards` | 正在加载奖励... | 載入緊獎勵... | Loading rewards... | Đang tải phần thưởng... |
| `common.loadingUser` | 正在加载用户信息... | 載入緊用戶資料... | Loading your profile... | Đang tải hồ sơ... |
| `common.loadingAdmin` | 正在加载管理总览... | 載入緊管理總覽... | Loading admin overview... | Đang tải tổng quan quản trị... |
| `common.saving` | 保存中... | 儲存緊... | Saving... | Đang lưu... |
| `common.submitting` | 提交中... | 提交緊... | Submitting... | Đang gửi... |
| `common.processing` | 处理中... | 處理緊... | Processing... | Đang xử lý... |
| `common.refreshing` | 刷新中... | 重新載入緊... | Refreshing... | Đang làm mới... |
| `common.retry` | 重试 | 重試 | Retry | Thử lại |
| `common.backHome` | 返回首页 | 返回首頁 | Back to home | Về trang chủ |
| `common.viewAll` | 查看全部 | 查看全部 | View all | Xem tất cả |
| `common.save` | 保存 | 儲存 | Save | Lưu |
| `common.close` | 关闭 | 關閉 | Close | Đóng |
| `common.edit` | 编辑 | 編輯 | Edit | Chỉnh sửa |
| `common.delete` | 删除 | 刪除 | Delete | Xoá |
| `common.continue` | 继续 | 繼續 | Continue | Tiếp tục |
| `common.unknown` | 未知 | 未知 | Unknown | Không rõ |
| `common.notSet` | 未设置 | 未設定 | Not set | Chưa đặt |
| `common.none` | 无 | 無 | None | Không có |
| `common.admin` | 管理员 | 管理員 | Admin | Quản trị viên |
| `common.user` | 普通用户 | 普通用戶 | User | Người dùng |
| `common.notLoggedIn` | 未登录 | 未登入 | Not signed in | Chưa đăng nhập |
| `common.sessionExpired` | 登录状态已失效，请重新登录 | 登入狀態已失效，請重新登入 | Session expired, please sign in again | Phiên đã hết hạn, vui lòng đăng nhập lại |
| `common.noPermission` | 当前账号没有后台访问权限 | 當前帳號沒有後台存取權限 | This account has no admin access | Tài khoản này không có quyền quản trị |
| `common.walletAddress` | 钱包地址 | 錢包地址 | Wallet address | Địa chỉ ví |
| `common.points` | 积分 | 積分 | Points | Điểm |
| `common.role` | 角色 | 角色 | Role | Vai trò |
| `common.actions` | 操作 | 操作 | Actions | Thao tác |
| `common.status` | 状态 | 狀態 | Status | Trạng thái |
| `common.title` | 标题 | 標題 | Title | Tiêu đề |
| `common.name` | 名称 | 名稱 | Name | Tên |
| `common.description` | 描述 | 描述 | Description | Mô tả |
| `common.time` | 时间 | 時間 | Time | Thời gian |
| `common.userId` | 用户ID | 用戶ID | User ID | ID người dùng |
| `common.lastUpdate` | 最后更新 | 最後更新 | Last updated | Cập nhật lần cuối |
| `common.noDescription` | 暂无描述 | 暫無描述 | No description | Chưa có mô tả |
| `common.notFoundUser` | 没有找到匹配的用户 | 搵唔到符合嘅用戶 | No matching users | Không tìm thấy người dùng |
| `common.copyDone` | 已复制 | 已複製 | Copied | Đã sao chép |
| `page.task.title` | 任务中心 | 任務中心 | Task Center | Trung tâm nhiệm vụ |
| `page.task.subtitle` | 参与任务，赚取积分，解锁精彩奖励 | 參與任務，賺取積分，解鎖精彩獎勵 | Complete tasks, earn points, unlock rewards | Tham gia nhiệm vụ, kiếm điểm, mở khoá phần thưởng |
| `page.reward.title` | 奖励中心 | 獎勵中心 | Reward Center | Trung tâm phần thưởng |
| `page.reward.subtitle` | 用积分兑换精彩礼品和特权 | 用積分兌換精彩禮品同特權 | Redeem points for gifts and perks | Đổi điểm lấy quà tặng và đặc quyền |
| `page.profile.title` | 个人中心 | 個人中心 | Profile | Hồ sơ cá nhân |
| `page.profile.subtitle` | 管理你的账户信息和查看成就 | 管理你嘅帳戶資料同查看成就 | Manage your account and view achievements | Quản lý tài khoản và xem thành tích |
| `home.welcome` | 欢迎来到 Jinli Club | 歡迎嚟到 Jinli Club | Welcome to Jinli Club | Chào mừng đến Jinli Club |
| `home.hotTasks` | 热门任务 | 熱門任務 | Hot tasks | Nhiệm vụ nổi bật |
| `home.featuredRewards` | 精选奖励 | 精選獎勵 | Featured rewards | Phần thưởng nổi bật |
| `home.noTasks` | 暂无可用任务 | 暫無可參加任務 | No tasks available | Chưa có nhiệm vụ |
| `home.noRewards` | 暂无可用奖励 | 暫無可兌換獎勵 | No rewards available | Chưa có phần thưởng |
| `home.browseRewards` | 查看奖励 | 查看獎勵 | Browse rewards | Xem phần thưởng |
| `task.available` | 可参与 | 可參加 | Available | Có thể tham gia |
| `task.pending` | 待领取 | 待領取 | To claim | Chờ nhận |
| `task.completed` | 已完成 | 已完成 | Completed | Đã xong |
| `task.ongoing` | 进行中 | 進行中 | Ongoing | Đang diễn ra |
| `task.ended` | 已结束 | 已結束 | Ended | Đã kết thúc |
| `task.joinNow` | 立即参与 | 即刻參加 | Join now | Tham gia ngay |
| `task.claimReward` | 领取奖励 | 領取獎勵 | Claim reward | Nhận thưởng |
| `task.claiming` | 领取中... | 領取緊... | Claiming... | Đang nhận... |
| `task.emptyAvailable` | 暂无可用任务 | 暫無可參加任務 | No tasks available | Chưa có nhiệm vụ |
| `reward.redeemable` | 可兑换 | 可兌換 | Redeemable | Có thể đổi |
| `reward.redeemed` | 已兑换 | 已兌換 | Redeemed | Đã đổi |
| `reward.outOfStock` | 库存不足 | 庫存不足 | Out of stock | Hết hàng |
| `reward.myPoints` | 我的积分 | 我嘅積分 | My points | Điểm của tôi |
| `reward.claimed` | 已领取 | 已領取 | Claimed | Đã nhận |
| `reward.claimable` | 可领取 | 可領取 | Claimable | Có thể nhận |
| `reward.limited` | 限量 | 限量 | Limited | Số lượng giới hạn |
| `auth.connectWallet` | 连接钱包 | 連接錢包 | Connect wallet | Kết nối ví |
| `auth.signIn` | 签名登录 | 簽名登入 | Sign in | Đăng nhập bằng chữ ký |
| `auth.connectAndContinue` | 连接并继续 | 連接並繼續 | Connect and continue | Kết nối và tiếp tục |
| `auth.loginSuccess` | 登录成功 | 登入成功 | Signed in | Đăng nhập thành công |
| `auth.signatureFailed` | 签名验证失败 | 簽名驗證失敗 | Signature verification failed | Xác minh chữ ký thất bại |
| `auth.connectFirst` | 请先连接钱包 | 請先連接錢包 | Please connect a wallet first | Vui lòng kết nối ví trước |
| `auth.noWallet` | 当前浏览器未检测到可用钱包 | 當前瀏覽器未偵測到可用錢包 | No wallet detected in this browser | Trình duyệt này không có ví |
| `nav.shard` | 碎片市场 | 碎片市場 | Shard Market | Chợ mảnh ghép |
| `nav.adminPanel` | 管理面板 | 管理面板 | Admin Panel | Bảng quản trị |

### ③-2 页面专有长文案（数量 + 命名规则 + 原文位置）

- 表③-1 已覆盖 **76** 个共享文本；剩余 **约 356 个不同文本**（去重口径）为**单页专有**长文案/提示/错误串。
- 命名规则：`<域>.<页>.<元素>`，例：`reward.detail.title`「任务奖励详情」、`admin.points.summary.avg`「平均积分」、`jobs.*` 已有命名可对照。
- 含插值的先拆键，例：`admin.points.adjustOk` = `已成功为用户 #{{uid}}{{delta}} {{amount}} 积分`（zh 原串：`成功为用户 #${selectedUser.uID}${adjustType === 'add' ? '增加' : '减少'} ${amount} 积分`）。
- 逐条 zh 原文与行号见 **表①-1**（同一份数据，可直接派单）。
- hk 可先经 `opencc s2t` 机械转繁后再人工/模型校润（本报告 ③-1 的 hk 初稿即按此风格给出）；**en/vn 必须经翻译产出，不能机械生成**。

## 表④ 分批派单方案（按「用户最先看到」排序，5 批）

| 批次 | 主题 | 文件数 | 条数 | 其中 (a)已有键 | (b)需新键 | (c)不译 | 是否需新键 |
|---|---|---|---|---|---|---|---|
| **B1** | 首屏 · 全局骨架（用户最先看到） | 8 | **44** | 4 | 30 | 10 | **需** |
| **B2** | 主线三页 · 任务/奖励/我的 + 卡片与弹窗 | 7 | **132** | 13 | 119 | 0 | **需** |
| **B3** | 登录 / 认证 / 钱包 + 工坊·商品·交易所三线核验 | 12 | **55** | 0 | 55 | 0 | **需** |
| **B4** | 后台管理（登录后管理员面） | 9 | **333** | 25 | 308 | 0 | **需** |
| **B5** | 组件库 + 开发/比选预览页 | 8 | **88** | 7 | 33 | 48 | **需** |
| — | **合计** | | **652** | 49 | 545 | 58 | |

### B1 — 首屏 · 全局骨架（用户最先看到）（44 条）
- `components/Header.jsx` — 7 条
- `pages/HomePage.jsx` — 28 条
- `components/Footer.jsx` — 8 条
- `App.jsx` — 1 条
- `shell/AppShell.jsx` — 0 条
- `shell/BottomTabBar.jsx` — 0 条
- `shell/nav.js` — 0 条
- `shell/breakpoints.js` — 0 条

### B2 — 主线三页 · 任务/奖励/我的 + 卡片与弹窗（132 条）
- `pages/TaskPage.jsx` — 27 条
- `pages/RewardPage.jsx` — 43 条
- `pages/ProfilePage.jsx` — 37 条
- `components/task/TaskCard.jsx` — 7 条
- `components/reward/RewardCard.jsx` — 5 条
- `components/ClaimRewardModal.jsx` — 9 条
- `components/ActiveTaskModal.jsx` — 4 条

### B3 — 登录 / 认证 / 钱包 + 工坊·商品·交易所三线核验（55 条）
- `components/LoginModal.jsx` — 5 条
- `pages/AuthPage.jsx` — 23 条
- `components/auth/WalletAuthPanel.jsx` — 24 条
- `auth.js` — 3 条
- `pages/ShardPage.jsx` — 0 条
- `pages/jobs/PublishJobPage.jsx` — 0 条
- `pages/jobs/JobDetailPage.jsx` — 0 条
- `pages/jobs/JobReviewPage.jsx` — 0 条
- `pages/listings/ListingsPage.jsx` — 0 条
- `pages/listings/ListingDetailPage.jsx` — 0 条
- `pages/listings/PublishListingPage.jsx` — 0 条
- `pages/market/MarketPage.jsx` — 0 条

### B4 — 后台管理（登录后管理员面）（333 条）
- `components/layout/AdminLayout.jsx` — 22 条
- `pages/DashboardPage.jsx` — 66 条
- `pages/admin/PermissionsManagement.jsx` — 41 条
- `pages/admin/PointsManagement.jsx` — 47 条
- `pages/admin/RewardsManagement.jsx` — 44 条
- `pages/admin/ShardsManagement.jsx` — 24 条
- `pages/admin/SystemSettings.jsx` — 29 条
- `pages/admin/TasksManagement.jsx` — 21 条
- `pages/admin/UsersManagement.jsx` — 39 条

### B5 — 组件库 + 开发/比选预览页（88 条）
- `components/ui/Advanced.jsx` — 7 条
- `components/ui/DashJ.jsx` — 1 条
- `components/ui/DataDisplay.jsx` — 2 条
- `components/ui/ErrorHandling.jsx` — 25 条
- `components/ui/Loading.jsx` — 1 条
- `components/ui/Performance.jsx` — 4 条
- `theme/tokens.js` — 23 条
- `pages/ThemePreviewPage.jsx` — 25 条

**排序理由**：B1 = 打开站点即见（Header/首页/页脚）；B2 = 底部 Tab 直达的三条主线；B3 = 登录墙后的第一屏 + 工坊/商品/交易所三线**核验位**（这三线已 0 条，仅需回归核验）；B4 = 需管理员权限才可见；B5 = 组件库（无独立路由，随宿主页生效）+ 开发预览页（非产品面）。

**批次内建议顺序**：先做 ②-a（改代码，零新增键、零翻译），再做 ②-b（新键 + 四语）；每批收尾跑一次四语键集相等断言（现有测试已覆盖该断言）。

## §5 ④ 核实：`TaskPage.jsx` / `RewardPage.jsx` 的「翻译中」小标 = **未接**

**结论：两页均未接「翻译中」小标（`TranslatingBadge`）。**

| 页 | `TranslatingBadge` | `contentStatus` | 内容本地化取值方式 | 结论 |
|---|---|---|---|---|
| `frontend/src/pages/TaskPage.jsx` | **无 import / 无渲染** | **无 import** | 旧式三目链 `task.title_en ?? task.title`（L52–63） | **未接** |
| `frontend/src/pages/RewardPage.jsx` | **无 import / 无渲染** | **无 import** | 旧式三目链 `reward.name_en ?? reward.name`（L79–90） | **未接** |

**对照：已接的 6 个文件**（读法 = `import TranslatingBadge` + `import { contentStatus / pickLocalized } from i18n-content` + 渲染 `<TranslatingBadge status={contentStatus(x)} />`）：

| 文件 | import | 渲染点 |
|---|---|---|
| `frontend/src/pages/ProfilePage.jsx` | L13 / L14 | `L286` |
| `frontend/src/pages/jobs/JobReviewPage.jsx` | L6 / L7 | `L135` |
| `frontend/src/pages/jobs/JobDetailPage.jsx` | L6 / L7 | `L125` |
| `frontend/src/pages/market/MarketPage.jsx` | L6 / L7 | `L318` |
| `frontend/src/pages/listings/ListingsPage.jsx` | L6 / L7 | `L119` |
| `frontend/src/pages/listings/ListingDetailPage.jsx` | L6 / L7 | `L76` |

**判定依据**：全仓 `grep TranslatingBadge|contentStatus|pickLocalized` 命中 6 个渲染页 + 组件本体 `components/i18n/TranslatingBadge.jsx` + 测试；`TaskPage.jsx` / `RewardPage.jsx` **零命中**。

**两页确实渲染 UGC**（所以「未接」是实缺口，不是无对象）：`TaskPage.jsx` L52–63 渲染 `task.title_*` / `task.note_*`；`RewardPage.jsx` L79–90 渲染 `reward.name_*` / `reward.description_*`（均非 `t()`，走 `??` 三目链）。同仓测试 `frontend/src/test/unit/i18n-content-wiring.test.jsx:245-254` 已把这两处登记为「存量：三目链里用的是 `??`、不经 `i18n-content`，下单单点收口」——与本单实测一致。

**注意区分两件事**：①「内容本地化」（这两页**有**，走 `??` 链）；②「翻译中小标」（这两页**没有**）。用户抱怨的「切语言只有菜单变」主要是 **UI 字面量不走 locale**（本单表①/②），与 ② 是两条独立缺口。

## §6 NOT_MEASURED（未测项 —— **禁填 0/空**）

- **运行时渲染结果未测**：本单为**静态扫描**，「切到 en/hk/vn 后仍显示简体中文」**只对已由真浏览器验收的 2 个样本有实测证据**（`TaskPage.jsx:230`「任务中心」、`RewardPage.jsx:293`「奖励中心」）；其余 650 条为**静态存在性推断**，未逐条在浏览器里切语言复核。
- **多行 / 嵌套 JSX 文本节点的漏检未测**：扫描用 `>`…`<` 片段匹配，若 JSX 文本节点跨多行、或内含 `{{}}` 表达式混排（如 `参与任务，赚取{points}，兑换精彩奖励`），可能漏计或计数偏差；**未逐文件人工复核**。
- **模板字面量内的插值拆分影响未测**：含 `${}` 的串（如 `成功为用户 #${selectedUser.uID}...`）在 i18next 下需改写为 `{{var}}`，改写后是否与现有渲染路径兼容**未验证**（需改代码后才能测）。
- **`ThemePreviewPage` 是否对外发布未测**：若该路由在生产可达，(c) 中该页条目应改判为 (b)。**未查路由表/未在 prod 实测**。
- **`Header.jsx` 语言切换 alt 的最终文案未定**：`中文`/`粵語` 与已有键 `chinese`(`简体中文`)/`cantonese`(`粤语`) **措辞不一致**，是复用键（改文案）还是新增键，**需产品决定**，未测。
- **en/hk/vn 四语初稿的翻译质量未评测**：表③-1 为**初稿**，未经母语者/术语表校验，**未做回译核验**。
- **后端返回的 UGC 是否已全部具备 `_en/_hk/_vn` 未测**（属翻译线 TR-* 范围，本单不覆盖）。
- **`.js`/`.jsx` 之外的模板/HTML/CSS 内的中文未测**：`index.html`、`styles.css` 的 `content:` 文案、`public/**` **不在本扫描范围**。

## §7 自曝（本次取证的局限与可能的错判）

1. **扫描方式是自建启发式解析器，不是 AST**：仓内无 `@babel/parser`/`acorn`（`search_files` 零命中，`node_modules` 未见），故用字符级状态机剥离注释/字符串 + 正则抓 JSX 文本与属性。**会有漏检与少量错判**，尤其多行 JSX 文本、三元内嵌 JSX 字符串。
2. **`cls3` 里混入了少量非 UI 串**：`theme/tokens.js` L437–446 的 23 条是**主题对照表的说明数据**，被归入 ②-c 而非误报为待修。同类判断还有 `ThemePreviewPage` 的演示数据——**这是我的判断，非机器规则，可能被产品推翻**。
3. **`main_console = 0` 是实测但也可能是漏检**：规则要求 `console.` 紧邻字面量；若存在 `const msg='加载失败'; console.log(msg)` 这类间接写法，会计入 cls3 而非 console，**未交叉核验**。
4. **（c）名单含品牌判断，需产品确认**：Footer 的「猫猫大使团/云朵计划」中文 slogan 我判为品牌文案不译 —— **这是产品决定，不是技术事实**。
5. **批次划分是按「文件」粒度的建议**：同一文件（如 `ProfilePage.jsx` 37 条）未再拆子批；实际派单可按 ②-a/②-b 两轮切分。
6. **本单未改任何代码**（硬边界）；表②/③/④ 是**方案**，未经实现与回归验证。
7. **数字口径可复现**：`run_tag=20261001T113240Z-bb0e4ed`，脚本 + JSON + TSV 三件套已落在 scratch，可直接重跑对账。

---

_报告生成：Unit I18N-LIT-RECON（Kong, read-only）。源数据 run_tag `20261001T113240Z-bb0e4ed`，git `bb0e4ed`。_
