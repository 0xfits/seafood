# design-system.spec v1.17 delta · JING-SPEC-A5-DES（2026-10-12）

> 单号 **JING-SPEC-A5-DES** · 作者角色 = Jing（Specifier · 制度员）· 依据 = Kevin 2026-10-12 逐字「直接 A+C」（站内信最小闭环 + Telegram bot 绑定/通知一步到位，不走分期；`D2`/`D4` 不在本单 = `F17`）+ Zang 结构裁定 1–9（`docs/OPEN-ITEMS.md` `A5` 行，commit `3ae743e`）。姊妹册 = `route-layer.spec` **v2.31 §41** + `data-layer.spec` **v0.32 §38**。

## §A 依据锚点 → 改动点（逐条）

| delta | 依据锚点 | 改动点 |
|---|---|---|
| `Q1` 已裁 = 站内信 + Telegram bot 并行（route v2.27 §37「X/推特接驳位」语义作废 ⇒ Telegram 非 X） | Kevin「直接 A+C」 | §19.11 就地注（原行一字未动）+ §12 v1.17 行 |
| 底部操作栏**第 3 格「聊一聊」激活**（§19.5 挂点 N = 0 → 1） | Zang 结构 2（卖家本人不渲染）+ §19.5 挂点表 | `T100` + §19.5 就地注 + §20.3 三态判据表 |
| `/messages` 占位页转真页（列表/详情/输入三态） | Kevin A（站内信最小闭环） | `T101` + §20.4 钩子面 |
| Settings 绑定/解绑面（ProfilePage Telegram 卡三态 + code 步骤 + 降级卡 + 隐私不显 ID） | Zang 结构 4/5/8 | `T102` + §20.5 |
| 未读角标（底栏第 4 格 + 桌面悬浮菜单消息项；挂载/发送后/进入后三时点、无轮询、99+） | Kevin C + Zang 结构 3 | `T103` + §20.6 |
| i18n **+35 / −2** ⇒ 顶层 `123` / 拍平 `1078` / 四语节点 `4312`；12 文件计数断言前推 | 键集基线 122/1045/4180（现取） | §20.7 / §20.8（算式可复核） |
| 零新主题 token / 零 STRUCT 增项（页面局部 `--sf-l-*`） | `T98` 溯源硬门体例 | §20.2/§20.4 |
| 教训 `N43`（预留槽位激活须同步回收占位键/钩子） | 本轮 `messages-x-placeholder` + `xPlaceholder`/`xNote` 删除实践 | §20.10 |

## §B 改前 / 改后自证（真读数）

| 项 | 改前 | 改后 |
|---|---|---|
| 行数 | 1923 | 2078（+155） |
| 字节 | 422,501 | 450,138（+27,637） |
| md5 | `0400a3d9bbcc38b22cae0190b658c8ee` | `f0d8e248b791330bf1e45ba5cdfba084` |
| `git diff --numstat` | — | `155 0`（**删除列 = 0** ✓；§19.5/§19.11 就地注 = 纯插入行，原地正文一字未动） |
| 快照 `docs/versions/design-system.spec.v1.17.md` | — | `cmp` = 0（逐字节相同）✓ |
| 改前快照对照 | `docs/versions/design-system.spec.v1.16.md`（上轮镜像，未动） | — |

## §C 范围自证

- 本单改动文件 = **恰 2**：`docs/design/design-system.spec.md` + 新建快照（+ 本 delta 件）。
- **未动** `frontend/**` / `backend-ts/**` / `tools/**` / `ctrl/**` / `style-preview.html`（**零新真源块** ⇒ 零新 token 自洽）/ `docs/seafood.master-plan.md` / `docs/OPEN-ITEMS.md`；未启停任何服务；未跑任何门；未 `git add -A` · 未 commit · 未 push。
- 全仓未改代码证明（三册合并）：`git diff --name-only` = 恰 3 个 docs 文件；non-docs modified = **0**。
