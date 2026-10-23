# 项目页金库区探针 · 读数报告

- 探针：`ops/project/probe-project-vault.mjs`（读 `frontend/dist`，`context.route` 静态服务 + localStorage 登录种子，API 全桩，零后端 / 零库写）
- 读数：`ops/project/readings/probe-project-vault.json`
- 结果：**69 项必判全绿**，`pageErrors = 0`，两档横向溢出 0（2026-10-23，HEAD `27d7256` + 本单改动）

## 实测读数（摘）

夹具读口 `vault[] = [{cid:4, symbol:BTTC, balance:"1000"}, {cid:7, symbol:USDT, balance:"25.5"}]`

| 臂 | 读数 |
| --- | --- |
| 登录臂 | 区在、`data-sf-authed="1"`、标题「项目金库」；行数 2 = `vault[]` 行数；`data-sf-cid` 顺序 `4,7`；余额行逐字对齐 locale：`BTTC 余额 1000` / `USDT 余额 25.5`；每行 1 输入 + 1【充值】（`data-sf-action="vault-recharge"`），初值空、钮可用 |
| 充值成功桩 | 填 `250` 点【充值】⇒ 恰 1 次 `POST /api/project/11/vault/recharge`，载荷 **恰 `{cid:4, amount:"250"}`**（amount 原样字符串）⇒ 内联 ok「已充值 250 BTTC，金库余额 1250」⇒ 静默重拉 ⇒ 行刷新为 `BTTC 余额 1250`，另一行不动，输入清空，err 三钩为空 |
| 本地前置闸（空金额） | **0 次请求**；内联 err「充值金额须大于 0，且不超过该币种精度」，`data-sf-err-code="PROJECT_VAULT_AMOUNT_INVALID"`，`data-sf-err-status=""`；余额不变 |
| 400 余额不足 | 内联 err「充值失败：你的可用余额不足，无法充值（HTTP 400）」；`data-sf-err-code/reason = VAULT_RECHARGE_INSUFFICIENT`、`data-sf-err-status="400"`；**不重拉**（读口次数 before=after）、无 ok 提示、余额仍 1000 |
| 400 币种闸 | `data-sf-err-code="PROJECT_VAULT_CID_INVALID"`、`status="400"`，文案走 `vaultErrCidInvalid` 映射 |
| 空金库 ∧ 有次币腿（`wage_cid=4` / amount=20） | 合成 1 行 `cid=4`「BTTC 余额 0」，充值输入 + 钮在场 |
| 空金库 ∧ 无次币腿（`wage_cid=null` / amount=0） | 整区不渲染（`project-vault` 0 个），页面其余正常 |
| 客态（独立 context、无种子） | 区在、`data-sf-authed="0"`、余额行照常 2 行可见；**0 输入、0 充值钮**、0 写请求 |
| 几何 390 / 1536 | 溢出 0 / 0；区左右 10–376.9（390）/ 20–1420（1536）；行右沿 361.9 / 1405；输入右沿 286.9 / 1330；行高两档一致 78.8px |

## 口径备注
- 余额文案**逐字**取 `project.vaultLine` 渲染结果（`{{symbol}} 余额 {{balance}}`）——前端零换算，`balance` 直接用读口/写口返回的十进制串。
- 充值写口载荷闭集 `{cid:number, amount:string}` 用 `JSON.stringify` 全等判；`amount` 必须是字符串（不静默转数字）。
- 失败臂只认「内联 + 三机读码 + 不重拉」，不看服务端 message 文案（后端 message 不进 UI）。
- 每个失败臂前复位夹具 `STATE.view = baseView()`：上一臂成功桩会就地改内存余额，不复位会把失败臂基线污染成 1250。
