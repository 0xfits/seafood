# SPEC-NOTE-prodverify — 币种下拉两单 · 生产终验收口（Jing · 2026-10-19）

单：发布商品页 + 发布任务页「币种编号」改下拉（master-plan §5.418 / §5.419）。本件 = 生产终验证据登记（短件）；台账 = master-plan §5.420。

## 上线
- push `521fbb0..c62ac45`（6 提交：`e0a6ee3` docs / `7b597ec` 商品页 / `1d9b415` 任务页 / `9041097` 任务页探针 / `9087c51` docs / `c62ac45` 双单独立质检）；`171b6df` = 生产终验证据入库（push 之后提交，不触发部署）。

## 同版证明
- 生产 HTML 引 `assets/index-BREoUqs6.js` + `assets/index-DnoMyxQu.css`；与本地 HEAD(`c62ac45`) 构建 sha256 逐字同：js `7f03960e0da7a1eb…` / css `5eb062edac683032…` ⇒ 生产所跑即本单代码。

## 生产读数
- bundle marker：`item-select-cid`=1 · `jobs-select-cid`=1 · `/api/currencies`=1；旧钩子 `item-input-cid` / `jobs-input-cid` = 0 / 0。
- `GET /api/currencies`（无 Authorization）⇒ 200 · `success:true` · 2 行（`cid=1` `$ 平台积分` / `cid=4` `BTTC battcoin`），行键集恰 `{cid,name,symbol}`。
- 哨兵：`schema_version=0049`（本单零迁移，不变）· `task/all=3` · `prize/all=4`（与台账已登记漂移一致）。
- 浏览器探针（`--host-resolver-rules` 绕本机 DNS 劫持）：`/`、`/item/new`、`/task/new`、`/item/1` 四页 `#root` 非空、零 pageerror、零 console error；游客态两发布页正确落「请先登录」闸（表单登录后才渲染 ⇒ 游客态钩子计数 0 属预期，不是缺陷）。

## 质检
- 商品页 8/8 PASS：`ops/item-cid-select/qa/verdict.json`。
- 任务页 8/8 PASS：`ops/item-cid-select/qa-job/verdict.json`。

## ★ 坑与纪律
- **BTTC 的 cid 生产 = 4、dev = 21**（各库行集 / cid 不同）⇒ cid 字面量不是不变量：测试断言、文档写死、默认值选择一律现查现库。

## 收口结论
- **实现 / 规范 / 质检 / 生产 四段全闭环，无遗留**：实现 = `7b597ec` + `1d9b415`（后端零改动、注册点 108 不变）；规范 = route v2.37 §47 + v2.38 §47.8、design §15.2 勘误、master-plan §5.418–§5.420；质检 = 双单 8/8 PASS；生产 = 同版 sha256 逐字 + marker 1/1 旧钩子 0/0 + 读口 200 rows=2 三键 + 四页零异常 + 哨兵零位移。
- `docs/OPEN-ITEMS.md` 检索 `币种|cid` 无本单挂账（§5.418 H / §5.419 G 双现取零命中）⇒ 不动。
- 证据目录：`ops/item-cid-select/readings/prod-verify/`（`SUMMARY.txt` / `prod-probe-result.json` / `prod-currencies.json` / `prod-health.json` / `prod-index.html` / `prod-index-BREoUqs6.js` / `prod-index-DnoMyxQu.css` / 同版哈希）。
