# /wage 探针 · 在职零加入契约订正（2026-10-23）

- 探针：`ops/wage/front/probe-wage.mjs`（改动仅判据；业务代码零改）
- 读数：`ops/wage/front/readings/probe-wage-20261023.json`
- 结果：**144 项必判全绿**，`pageErrors = 0`（此前 4 红：3 条判据早于契约变更 + 1 条本地化正则过期）

## 判据订正（旧 → 新）

| 旧判据 | 旧期望（已过期） | 新判据 | 新期望（实测） |
| --- | --- | --- | --- |
| `list.otherJoinDisabled` | 别人的卡【加入】**置灰** | `list.otherNoJoinWhenHired` + `list.pageWideZeroJoinWhenHired` | 在职 ⇒ 整页 **0** 枚 `data-sf-action="join"`（不是置灰，是不渲染） |
| `list.otherHintOneAtATime` | 卡内提示行 = 「同时只能在一个项目打工」 | `list.noOneAtATimeWhenHired` | 在职 ⇒ 卡内无该提示 **且** 页头 `wage-one-at-a-time` 不在场 |
| `joinedCard.otherCardsJoinOnly` | 别处卡各 1 枚【加入】 | `joinedCard.noOtherJoinButtonsWhenHired` | 别处卡 `joinCount=0`，且不与 claim 混排 |
| 新增（正向面） | — | `list.joinCountWhenFree` / `list.oneAtATimeWhenFree` | 无人在职 ⇒ 整页 join 计数 **8**（招募中 8 张，101..107 + 110；107 已招满 ⇒ 钮在但 disabled），页头提示文案 = `wage.oneAtATime` |
| `guest.wageVisible` | 正则 `/batt\s*30/`（中文 locale 永不命中） | 按 `wage.wageLine` 套参比对 | 「工资：每 4 小时 + 30 电量」命中 |

## 实读取数（摘）

- 在职臂：`wageGate = { joinCount: 0, claimCount: 1, oneAtATimePresent: false }`；101 卡 `claimCount=1 / joinCount=0`、徽标 1 枚、黄边 + 淡黄叠加齐。
- 未在职臂（把 101 的 `my_role` 抹成 `none` 重载）：`wageGate = { joinCount: 8, claimCount: 0, oneAtATimePresent: true, oneAtATimeText: "同时只能在一个项目打工" }`。
- 已招满卡（107）：【加入】在但 disabled + 卡内提示「已招满」（`list.fullCardDisabledWithHint` 仍绿）。

## 备注
- 判据只按「整页计数」取（不按卡白名单），任一张卡漏网即红；判据数不减（144 项，含新增 3 项）。
- 未放宽任何阈值：置灰 → 零渲染是**契约加严**（旧语义已随 2026-10-22「加入/切换入口统一搬到项目页」退场）。
