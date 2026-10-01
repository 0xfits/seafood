# P6 · TR-FIX 收口（5 条陈旧期望 + hk 正向断言 + zh 档不显示小标）

单位：TR-FIX。口径：本机 macOS 15.7.4；退出码均直接取自命令（不经管道）。预算内完成，无 DDL/DML、无 `.env*` 读取、无 `pkill/killall`、未 `git add/commit/push`。

## 块 1 · 后端（`p4z-tr1a-01-offline-tests.ts`）

背景（实测既定事实，未重新论证）：TR-1b 后 `TARGET_LANGS = ['en','vn','hk']`；hk 走 OpenCC 确定性转换（缓存 `engine='opencc'`，不走 LLM、不付费）。由此 5 条期望过期（非行为退化）。

| 用例 | 原期望 | 改为 | 依据 |
|---|---|---|---|
| G3 | cache=2 | **3** | 每段文本现缓存 en/vn/hk 三条 |
| G7 | 二次运行 cache=2 | **3**（仍幂等） | 同上 |
| H3 | cache=2 | **3** | 同上 |
| H6 | 失败 cache=0 | **1** | LLM 失败只关 en/vn；hk 确定性转换照写 1 条（行为正确） |
| E5 | `MemStore(1)`+cap=3 | **`MemStore(0)`**+cap=3 | `used + projected == cap ⇒ 放行`；projected = 1×3 = 3 |

**新增 hk 维度正向断言（证明未削弱）**：

- `G3-hk`：stub 路径 hk 缓存行 `engine='opencc'`、内容为繁体 `招聘服務員`。
- `H3-hk`：deepseek 路径同上。
- `H6`（改期望同时加严）：唯一缓存行 = hk/opencc（把「失败不写缓存」精确化为「不写 LLM 缓存，hk 仍写」）。
- `HK1..HK5`（独立用例组，deepseek 正常路径）：
  - HK1 `job|hk1|title|hk` 落库、`status='ready'`、`text` 为繁体；
  - HK2 `text === '招聘服務員'`（招聘服务员 ⇒ 繁体）；
  - HK3 出参 `r.texts/statuses.title.hk` 齐备；
  - HK4 hk 缓存行 `engine='opencc'`；
  - HK5 `fetch.calls===1` 且 `TRANSLATE_TARGETS=['en','vn']`（无 hk）⇒ hk 零 LLM 调用、零付费。

### 读数

- `cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` ⇒ **EXIT=0**，
  `SUMMARY total=87 passed=87 failed=0`
  产物：`backend-ts/.p4-artifacts/p6tr1a-20261001T014708Z/offline-tests.json`（run-tagged，未覆盖旧产物）。
- `npx tsc --noEmit` ⇒ **EXIT=0**，输出 **0 行**。
- `backend-ts/src/**` 未改（红线保持）；未发现真缺陷，无需停下报告。

## 块 2 · 前端（zh 档不显示「翻译中」小标）

落点（最小改动）：`components/i18n/TranslatingBadge.jsx` — 读 `useTranslation().i18n`，经
`normalizeLang(resolvedLanguage || language)` 归一；归一为 `zh`（源语言档，含未知/缺省语言码）⇒ 直接 `return null`。
`en/hk/vn` 档行为不变（仍按 `i18n_status ∈ {pending, partial}` 渲染）。未改任何页面文件、未改 `isTranslating` 契约。

### 新增用例（`frontend/src/test/unit/i18n-content-wiring.test.jsx`）

1. `zh` 档 + `i18n_status='partial'` ⇒ **无小标**；
2. `en` 档 + `pending` ⇒ **有小标**；
3. `en` 档 + `ready` ⇒ 无小标。
另：既有「zh 档 页面接线」用例由「小标=1」翻正为「=0」（行为收口后的一致性）。

### 读数

- `cd frontend && npm run test:unit` ⇒ **EXIT=0**，`Test Files 13 passed (13)`，`Tests 126 passed (126)`，failed=0（基线 123，现 126，未削）。
- `npm run build` ⇒ **EXIT=0**（`✓ built in 1.71s`）。
- `node scripts/p6-tr2-i18n-locales.mjs` ⇒ **EXIT=0**，四语顶层键 75 / 拍平键路径 177 逐文件相等，总判 `PASS`（未新增 i18n 键）。
- `frontend` 未碰 `backend-ts/**`（红线保持）。

## 改动文件

- `backend-ts/scripts/p4z-tr1a-01-offline-tests.ts`（5 期望 + hk 断言）
- `frontend/src/components/i18n/TranslatingBadge.jsx`（非 zh 档 gate）
- `frontend/src/test/unit/i18n-content-wiring.test.jsx`（3 新例 + 1 例翻正 + 可变语言 mock）
- `docs/audit/p6-trfix.md`（本文件）

未改：`backend-ts/src/**`、`migrations/**`、`scripts/p4z-tr1b-*.ts`、其他页面、locale 文件、`.env*`。
