# 综合排序 v1 · 独立质检报告

> 聚合声明：verdict/REPORT 由 **Zang 依盘上读数手工聚合**（Neng 撞迭代上限未写收尾件）；断言未改、失败项未删、环境性项原样保留。

## 结论

**6/6 AC PASS**。综合排序按冻结公式 `score = 0.8×recency + 0.2×rating` 生效，旧缺陷（`ORDER BY listing_id` 升序导致新发布永不可见）修复被父版/现版对照坐实。

| AC | 判定 | 关键读数 |
|---|---|---|
| AC1 首条=最新 + 确定性 | PASS | `/api/home` 修前 `[1..8]` → 修后 `[76,71,24,23,22,21,20,19]`；两次请求逐位相同 |
| AC2 公式对拍 | PASS | 独立 SQL oracle 26 行 score/全序与 API 逐位相等；响应 45 键无 `score` |
| AC3 评分臂 | PASS | 插 5 星 ⇒ score **+0.08**（偏差 1.4e-17），卖家 12 件整体上移、其余不变；append-only 直删被拒（自证），回收后顺序回基线 |
| AC4 分页 | PASS | skip0/8 与 skip8/8 交集 ∅、并集 16；limit=1 = 首位 76 |
| AC5 门套 | PASS | build 0 / 60 文件 577 例 / tsc 0 / p7b 37/37 regs=110（干净 worktree） |
| AC6 不回归 | PASS | 详情行 **46 键**（含既有 seller，派单 45 为笔误）/ currencies 2 行 / media 999 = 404 / 390 档首卡 VPN→/item/76 |

## 三栏

**① 与自报差异**：实现方读数全部可复现；唯一口径更正 = 详情行键数 45→**46**（F19 `seller` 既有）。

**② 未证项**：无。

**③ 环境噪声**：并行会话的分页 WIP 曾令 dev 前端白屏（`useRef is not defined`，随后由分页单自行修复），质检判据改到 `0fe454a` 干净 worktree 取；5788 当时仍跑排序版代码（未含 `status='listed'` 过滤）。
