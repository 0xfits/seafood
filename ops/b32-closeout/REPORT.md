# B32 落地回写（D+A 已上线）· 文档面收口

- **仓** = `/Users/kevin/bistro/seafood`（`main`）
- **基线 commit** = `7dc2533`（生产验证单）
- **本单性质** = **纯文档回写**（只写 `docs/**` + 本目录 `ops/b32-closeout/**`）
- **代码改动** = **零**（`backend-ts/**` / `frontend/**` / `vercel.json` 全未触碰）
- **push** = **未做**（本地 commit）

---

## 1. 改了什么

| 文件 | 改动 | numstat（新增 / 删除） |
|---|---|---|
| `docs/OPEN-ITEMS.md` | ① B 段 `B32` 原行**之后**新增一行 `B32 ✅（D+A · 2026-10-17 已落地）`（状态改写 + 口径差异 + 未演练 + 安全待办 + chat_id 限制 + 证据链）；② 顶部新增 `★ v2.39` 块（`①`–`⑧` 八条） | `3 0` |
| `docs/route-layer.spec.md` | §46.4 末尾**追加一段粗体续段**（告警面 v1 → **v2**；零新路由 / 零新错误码 / 响应与鉴权未变 / 旁路静默降级 / 判负第 8 条仍有效） | `2 0` |

**纪律**：旧字面**逐字保留**（`B32` 原行整行未改、§46.4 原 v1 条目与 `D1` 补注整段未改）；`git diff --numstat` **删除列 = 0**。

**为什么不改原行**：本仓口径 = 「`git diff --numstat` 删除列 = 0」⇒ 修改任何既有行都会产生 1 行删除；承 `B3` / `B4` / `B14` 等先例，**状态改写一律以「原行之后的新行」承接**（原行只作历史，不作现状）。

---

## 2. 回写的事实（来源 = 已 push 的四笔）

| 事实 | 依据 |
|---|---|
| 实现：`notifyOps` / `pingHeartbeat` / `redactSensitive` / `buildDriftAlertText`；`index.ts` 既有 `opsReconHandler` 三态接线 | `b8a076e`（`backend-ts/src/ops-alert.ts` 225 行 + `index.ts` +34 行） |
| 修 QC 坐实项（心跳 URL 的 UUID 入日志） | `df12b31`（脱敏表新增 UUID 形状、排在「长 hex」之前；`catch` 只打错误类名）+ `ops/recon-alert/qa/readings/AC5-tg-token-echo.json` |
| 独立质检（Neng 7 AC）：**最终 `PASS`**，**修前 `53/54` → 修后 `54/54`**；AC7 群组 `chat_id` 限制登记 | `53a8d1d` + `ops/recon-alert/qa/verdict.json` + `ops/recon-alert/qa/readings/AC7-known-limit.json` |
| 生产验证：env 双配（`OPS_ALERT_UID=100` / `RECON_HEARTBEAT_URL` 均 Production · Encrypted）；`vercel crons run /api/ops/recon/ledger` ⇒ **`200` + `logs` 空**（无 `[recon]` drift 日志、无 `[ops-alert] heartbeat ping failed` ⇒ 心跳送达）；`/fail` 与恢复成功位各 **`200 OK`** | `7dc2533` → `ops/recon-alert/prod-verify/REPORT.json` |
| 收件人 = `OPS_ALERT_UID`（非敏感）⇒ 服务端现查 `users.tg_user_id`；**不是** `OPS_ALERT_TG_CHAT_ID` | `backend-ts/src/ops-alert.ts:15-17` / `:133` / `:145-164` |
| 心跳 = `RECON_HEARTBEAT_URL`；参数建议值（period `24h` / grace ≥`75min` / threshold `1`）**属 check 侧配置**，**代码只认 URL** | `grep -nE '24h\|grace\|threshold' backend-ts/src/ops-alert.ts` = **0 命中**（本单现取）⇒ 建议值落 `ops/recon-alert/REPORT.md:266-267` 与本表 `B32` 原行，**不写成「代码默认值」** |
| healthchecks.io 免费档 `Hobbyist` = **20 checks** | 现取 `healthchecks.io/pricing`（`Supporter` 与 `Hobbyist` 限额相同；首页「Monitor 20 cron jobs for free」） |
| 零新路由 = **107** | 本单现取 `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` = **107**；`p7b-03:150` 常量 `regs === 107` 未动 |
| 零新错误码 = `LEDGER_*` **33** 码闭集 | 承 `docs/route-layer.spec.md`：8259 / 8341 / 8662 三处「33 码不动」；`ops-alert.ts` 无新增码 |
| `chatId <= 0` ⇒ 群组（`-100…`）发不了；现口径不受影响（`tg_user_id` 来自 webhook `message.from.id`） | `ops-alert.ts:164` + `ops/recon-alert/qa/readings/AC7-known-limit.json`（`AC7-1..AC7-7` 全 `pass`） |

---

## 3. 未演练项（**显式登记 · 文档不得写成「已告警验证通过」**）

1. **站内 Telegram `notifyOps` 未做真实演练** —— 触发它需 `ok=false`（真漂移）或 handler 抛错，两者都会**在生产制造假故障**。处置建议（二选一，均未执行）：
   - 留待**首次真漂移自然验证**；
   - 另立**受控演练单**：临时把 `KNOWN_SUPPLY_OFFSET`（`backend-ts/src/ops-recon.ts:67`）的 `cid=1` 改错 → 部署 → 触发 → 回滚（**两次部署**）。
2. **healthchecks 侧是否启用 Telegram 集成 = 用户侧配置**（本机不可读，**不冒充已配**）。
3. 已演练、且 PASS 的**只有心跳面**（`/fail` + 恢复成功位各 `200 OK`）。

⇒ 落册用词边界：`docs/OPEN-ITEMS.md` v2.39 `④` 与 `B32 ✅` 行、`docs/route-layer.spec.md` §46.4 续段均写明「**不得写成「已告警验证通过」**」，§46.4 判负第 8 条**保留有效、无豁免**。

---

## 4. 安全待办（凭据轮换）

- `RECON_HEARTBEAT_URL`（**UUID 即凭据**）**曾以明文出现在会话中一次** ⇒ 建议 healthchecks 侧 **Reset ping URL 轮换**。
- 轮换后三步：① 更新 `~/.config/seafood/recon-heartbeat.env`（`600`）；② 重配 Vercel env `RECON_HEARTBEAT_URL`（Production · Encrypted）；③ 重新部署。
- 仓内**不落**该值（本目录与两册均只写变量名，不含 URL / UUID）。

---

## 5. 已知限制（本单不改码）

- `notifyOps` 判据 `chatId <= 0` ⇒ **Telegram 群组（`chat_id = -100…`）发不了**；现口径（`OPS_ALERT_UID` → `tg_user_id`）不会触发该判据。
- 将来若要发群：判据改 `chatId !== 0`（群组 id 为负是合法值）；**属另单**。

---

## 6. 自证（现取 · 读数落 `readings/numstat.txt`）

- `git diff --numstat` ⇒ `docs/OPEN-ITEMS.md 3 0` · `docs/route-layer.spec.md 2 0` ⇒ **删除列 = 0**。
- 旧字面仍在：`grep -c '本单只登记 · 不实现' docs/OPEN-ITEMS.md` = **3**（原行 1 + 顶部 v2.39 块引用 1 + 新行引用 1）；`grep -c '前置未定 ⇒ 不动工'` = **3**（同三处）；`grep -n '^| \*\*B32'` = **2 行**（原行 `:74` + 新行 `:75`，原行整行未改）；`grep -c '^### 46\.' docs/route-layer.spec.md` = **8**（46.0–46.7，与改前同，未新开节）。
- 不新开 `## §` / `###`：§46.4 续段为**粗体段落**（行首 `**`），顶部 v2.39 为**引用块**。
- 代码零改动：`git show --stat` 只含 `docs/**` + `ops/b32-closeout/**`。

## 7. 明确没做的事

- 未 push（按要求）。
- 未改代码、未改 `vercel.json`、未动 env。
- 未建 `docs/versions/route-layer.spec.v2.39.md` 快照（版本收口单另办）。
- 未做站内告警真实演练、未轮换心跳 URL（均为待办，已登记）。
