# 项目页加入 / 切换三态探针 · 读数报告

- 探针：`ops/project/probe-project-join.mjs`（读 `frontend/dist`，`context.route` 静态服务 + localStorage 登录种子，API 全桩，零后端 / 零库写）
- 读数：`ops/project/readings/probe-project-join.json`
- 结果：**74 项必判全绿**，`pageErrors = 0`，两档 `scrollWidth - clientWidth = 0`（2026-10-23，HEAD `27d7256` + 本单改动）

## 实测读数（摘）

| 臂 | 读数 |
| --- | --- |
| 未在职（`my_role=none`） | `project-entry-join`「加入此项目」，`data-sf-action="join"`，disabled=false；入口区恰好 1 枚；无切换 / 已在职 / 确认行 |
| 点【加入此项目】 | 恰 1 次 `POST /api/project/11/apply`，载荷 **`{}`**（无 `switch` 键）⇒ 内联 ok「已加入「海鲜打包」」⇒ 重拉 ⇒ 入口翻【已在职】 |
| 在职于他项目（`my_current_project_id=12`） | `project-entry-switch`「切换到此项目」，`data-sf-action="switch"`；入口区恰好 1 枚 |
| 点【切换到此项目】 | 行内展开 `project-entry-switch-confirm` + `project-entry-switch-cancel`（恰 2 枚），文案 = 「当前在职「冷库分拣」，切换后将离开该项目，领取间隔从此刻重新计算」；**apply 请求 0 次** |
| 点【取消】 | 回到切换态，**仍 0 次写请求**，确认文案消失 |
| 点【确认切换】 | 恰 1 次 `POST /api/project/11/apply`，载荷 **恰 `{"switch":true}`** ⇒ 内联 ok（`project.switchedOk`）⇒ 重拉 ⇒ 【已在职】；确认行收起 |
| 已在职（`my_role=hired`） | `project-entry-hired`「已在职」disabled=true，入口区恰好 1 枚，零写请求 |
| 409 满员失败 | 内联 err「加入失败：该项目已招满（HTTP 409）」，**不重拉**（读口次数不变）、不翻态、无 ok 提示 |
| 客态（独立 context、无种子） | `project-join` 整区不渲染、入口 0 枚、零写请求 |
| 几何 390 / 1536 | 溢出 0 / 0；确认行展开态溢出 0 / 0；入口钮高两档均 40px（`.sf-project-btn`），确认行 390 档不出视口（右沿 111 ≤ 390） |

## 口径备注
- 三态**互斥**由「整区入口计数 = 1」判（确认行展开 = 2，含取消），不靠「谁先命中」。
- 切换确认行是纯本地状态：从点开到取消 `writes.length === 0`；确认后才 1 次写。
- 载荷闭集用 `JSON.stringify` 全等判（`{}` / `{"switch":true}`），夹带任何额外键即红。
- 入口钮高度取实测 40px 并只判「两档一致」（本页按钮设计值即 40px，不套 /wage 的 44px 触控阈值）。
