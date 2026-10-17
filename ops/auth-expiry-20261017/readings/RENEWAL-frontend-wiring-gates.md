# 滑动续期 · 前端接线（S1 续 · 2026-10-17）· 门套与自证读数

本单范围：**只改** `frontend/src/auth.js` 的 `fetchApiJson` 成功分支 + `replaceAuthToken` 竞态保护；
新增 `frontend/src/test/unit/s1-session-renewal.test.js`。**未 commit、未 push**（推 = 上线，另行放行）。

## 1 门套（本机现取，非沿用册内基线）

| 项 | 改前基线 | 改后 | 判据 | 结论 |
|---|---|---|---|---|
| `npm run test:unit` · Test Files | 56 passed | **57 passed** | ≥56 且只增不减 | PASS |
| `npm run test:unit` · Tests | 544 passed | **554 passed** | ≥544 且只增不减 | PASS |
| `npm run test:unit` · failed | 0 | **0** | =0 | PASS |
| `npm run build` | — | **exit 0**（`✓ built in 1.85s`） | =0 | PASS |

日志（原样落盘，未手改）：
- `baseline-testunit-unit-before.log`＝改前 `npm run test:unit`（56 / 544）
- `testunit-after.log`＝改后 `npm run test:unit`（57 / 554）
- `build-after.log`＝改后 `npm run build`
- `targeted-renewal-tests.log`＝两文件定向跑（`s1-session-renewal` 10 例 + `s1-session-expiry` 17 例 = 27 passed）

> shell 注：本机 zsh 下 `${PIPESTATUS[0]}` 常空，故门套一律**落盘后读日志里的 `Test Files N passed` / `Tests M passed`** 判过没过，不拿退出码单独承重。
>
> 日志里 `failed` 字样共 8 处，全部是既有用例的 stderr 噪音 `Home aggregate endpoint failed, falling back to legacy requests: Error: HOME_UNREGISTERED` —— **改前基线同数（8）**，非本单引入；本单新增的 `catch` 护栏日志 `Failed to apply renewed session token` 命中 **0** 次（即该兜底在全部用例中从未触发）。

## 2 新增用例（10 例，覆盖派单 A 的 5 条 + 5 条加固）

| # | 用例 | 断言要点 |
|---|---|---|
| ① | 成功响应带 `X-Session-Token` | 存储 `token` / `access_token` / legacy `token` 键三处同步换新；`AUTH_CHANGE_EVENT` **恰好 1 次**；返回值仍是 `payload.data`；`headers.get` 真被调用 |
| ② | 不带头 | 存储快照逐键相等、零事件 |
| ②b | 响应对象连 `headers` 都没有（旧 mock 形态） | 不抛、存储不变 |
| ③ | 头 = `''` / `'   '` / `'\t\n '` / `12345` / `true` / `{}` | 一律不写、不抛 |
| ④ | 新 token `exp` **更早** | 不覆盖（存储不变、零事件）；直接调 `replaceAuthToken` 亦返回 `null` |
| ④b | `exp` 相同 | 不覆盖（幂等，不重复派发事件） |
| ④c | 现有 token 解不出 `exp`（`'legacy-token'`） | 新 token 优先写入 |
| ⑤ | 401 且（异常地）带头 | 既有 401 语义不变（`status` / `code` / 清两键）；token **未被续回去**；`headers.get` **零调用** |
| ⑥ | 403 且带头 | `headers.get` 零调用、会话与 token 原封不动 |
| ⑦ | 未登录时带头 | 不凭空造会话（存储仍空） |

## 3 产物自证（C 项）

见 `artifact-selfproof.log`：`frontend/dist/assets/index-Dn7dGQcz.js`
`grep -c -i 'x-session-token'` = **1**（≥1，PASS）；CSS = 0（该逻辑只在 JS）；负控 `vendor-react-*.js` = 0。
压缩后命中上下文（读头 → `trim()` 闸 → 写入调用 → `catch` 护栏）：

```
…(o=(i=a.headers)==null?void 0:i.get)==null?void 0:o.call(i,"x-session-token");typeof l=="string"&&l.trim()&&Qn(l)}catch(l){console.warn("Failed to apply renewed session token:",l)}return n.data},
```

## 4 实现口径（三处，逐条对应派单硬约束）

1. **只在成功分支**：读点位于 `if (!response.ok || !payload?.success) { … throw }` **之后** ⇒ 401/403/503 走不到（用例 ⑤⑥ 用 `headers.get` 零调用自证）。
2. **竞态保护放在 `replaceAuthToken` 内部**（唯一写入口 ⇒ 多标签/并发共用一处判据，不在 fetch 层再造第二套）：
   `currentExp !== null && nextExp !== null && nextExp <= currentExp ⇒ return null`（不写、不派发事件）；
   任一侧解不出 `exp` ⇒ 新 token 优先。
3. **空 / 非字符串 / 空白头**：`typeof renewed === 'string' && renewed.trim()` 双闸 + 外层 `try/catch`（续期是加法，绝不改变成功响应的返回值与既有错误路径的抛错形态）。

未改：后端、`SessionExpiredNotice`、401 语义、locale 键集、item 页面、`replaceAuthToken` 的字段集（`normalizeAuthUser` 原样保留、不清任何其它字段）。
