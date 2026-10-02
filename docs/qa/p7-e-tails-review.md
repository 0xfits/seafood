# 小尾巴批 + β · 独立终审质检（Neng）· 被检面钉 `e5d7bb7`

> 作者：**Neng**（独立质检）· 仓库 = `/Users/kevin/bistro/seafood` · 被检代码面 = **`e5d7bb7`**（本地未推；其后 `d07112d` 仅改 `docs/seafood.master-plan.md` +23 行，**零代码面**，见 §6.1）
> 被检报告（**只读，从 main 工作区读取；不采信其结论，逐条重取**）：`docs/audit/p7-e-tails.md`（307 行）+ `docs/audit/p7-e-tails-beta.md`（363 行）
> 本单**只写** `docs/qa/**` + `frontend/.p7eqa-artifacts/**`；**未 `git add/commit/push`**；**未改被检代码**（变异只在**仓外副本**内且**复原**）；未 `npm install`；未碰/未打印 `.env*`；未 `pkill -f`/`killall`；未启停 5787/5788。
> 读数一律「命令 → 退出码 → 原文摘录」，**逐条重取**。

---

## §0 元信息

### §0.1 开工态（逐字）
```
$ git status --porcelain
（空 —— 工作区干净）
$ git branch --show-current
main
$ git rev-parse HEAD
d07112df5529a004e36e79f81adfd9ffdf0af72a
$ git show --stat d07112d | tail -4
    docs: beta 收口验收 + 我认账行号转抄（C-3）+ R-7E-6 登记 + 派终审质检 + §5.175/v0.175
 docs/seafood.master-plan.md | 23 +++++++++++++++++++++++
 1 file changed, 23 insertions(+)
```
⇒ 被检代码面 = **`e5d7bb7`**；main 工作区 HEAD = `d07112d`（**仅文档**）。本单所有硬门/变异**在 `e5d7bb7` 的仓外副本内复跑**。

### §0.2 固定副本（仓外，零仓内污染）
```
$ git worktree add --detach "$SCRATCH/qa7e" e5d7bb7
Preparing worktree (detached HEAD e5d7bb7)
HEAD is now at e5d7bb7 fix(fe): 小尾巴批-beta …
$ git -C "$SCRATCH/qa7e" rev-parse HEAD
e5d7bb73ed5b3116911c6aa7ad52f1a15fe79439
$ ln -s /Users/kevin/bistro/seafood/frontend/node_modules "$SCRATCH/qa7e/frontend/node_modules"
$ ls -la frontend/node_modules | head -1
lrwxr-xr-x  1 kevin staff 49 Oct  2 21:22 frontend/node_modules -> /Users/kevin/bistro/seafood/frontend/node_modules
```
`SCRATCH = /Users/kevin/.hermes/profiles/zang/cache/scratch`。仓内**零临时件**。

---

## §1 L1 硬门独立复跑（副本内）

**方法**：退出码**管道外捕获**（`out=$(cmd 2>&1); ec=$?`），原文落 `frontend/.p7eqa-artifacts/`。

| 项 | 命令 | EXIT | 读数（原文摘录） |
|---|---|---|---|
| build | `npm run build` | **0** | `✓ 1783 modules transformed` / `✓ built in 1.57s` |
| 单测 | `npm run test:unit` | **0** | `Test Files  31 passed (31)` / `Tests  276 passed (276)` |

**七门**（副本内）：

| # | 门 | EXIT | 关键读数（原文摘录） |
|---|---|---|---|
| ① | `p4z-i18nviol-global.mjs` | **0** | `类级作用域 = 63 个源文件` / `形态命中 = 0 处；属性位排除（key= 属性，非文案位）= 1 处；显式豁免（死分支，登记）= 0/0 处` / `类级残余（活体）= 0 条` / `总判：PASS（… locale=2980 / source=37）` |
| ② | `p6-tr2-i18n-locales.mjs` | **0** | `zh: top=103 flat=745`（四语同）/ `键集相等：PASS（四文件拍平键数取值集合 = {745}）` / `四语齐备=PASS；四语互异取值数=4/4` / `总判：PASS` |
| ③ | `p4z-miscfix-links.mjs` | **0** | `残留 = 1`（已登记）/ `未登记残留 = 0` / `总判：PASS（残留全部已登记）` |
| ④ | `p4z-feperf-safelist.mjs` | **0** | `VERDICT=PASS`（**先 build 再跑**，依赖 `dist/`） |
| ⑤ | `p7a-03-errmessage-gate.mjs` | **0** | `总判：PASS（未登记命中 0 必须 = 0；扫描文件 77 / 受体 6 / 命中 0 / 基线 0）` |
| ⑥ | `p7b-errfallback-gate.mjs` | **0** | `总判：PASS（判负 0 必须 = 0；… D 节点=132 需护栏=0 已本地化=132 / G 键不可用=0/132 / E 样本=17）` |
| ⑦ | `p7c-errmsg-machinecode-gate.mjs` | **0** | `【真链】真 import src/auth.js#apiErrorMessage + 真 i18n 实例（esbuild 临时 ESM 载入；不再镜像重写链逻辑）` / `作用域读数：… 链路体制 = 真链；… 机读码向量节点 = 16；反例向量节点 = 16` / `总判：PASS（… 链=真链 / A=PASS / B 含机读码值=0 / C 兜底键=4 / D 类级违例=0/16 / F 反例违例=0/16 / G 机读码出现次数=0/36 违例=0 / E 样本=19）` |

⇒ **build EXIT 0 / 单测 31 files 276 passed / 七门全 PASS（EXIT 全 0）**，与两报告 §4/§9 逐字一致。p7c `链路体制 = 真链` ✅。A 段读数：`MACHINE_CODE_TOKEN_RE = true` / `containsMachineCode = true` / `extractApiErrorMessage 内 containsMachineCode( 调用数 = 4（要求 ≥ 1）`。

产物：`20261002-212301_L1_<门名>.txt`（7 份）。

---

## §2 ★ L2 真链门「真回放」独立坐实（两处不同变异）

副本内 `src/auth.js` 基线哈希：`shasum -a 256 = d1928ea50baac687c276ffac7927554b7a73e5cd925340bc6203ce06b828413d`（= `e5d7bb7` blob `cd1a72c1…`）。

### L2-a 变异 ①：reason 判据回**旧口径**（`:187`）
```diff
-      const suffix = reason && !containsMachineCode(reason) ? ` (${reason})` : ''
+      const suffix = reason ? ` (${reason})` : ''
```
```
$ node scripts/p7c-errmsg-machinecode-gate.mjs          # 副本内，变异后
EXIT=1
  【真链】真 `import` `src/auth.js#apiErrorMessage` + 真 `i18n` 实例（…）
  ★ 机读码出现次数合计 = 20（必须 = 0）/ 节点 36；违例向量-语 = 20（必须 = 0）
  ! G 用户可见串含机读码：③ stateConflict() · reason=LISTING_STATE_INVALID（`listing-service.ts:55`）⇒ 不得附加后缀 · zh ⇒ "Business state transition rejected (LISTING_STATE_INVALID)"（机读码出现 1 次；谓词判定含机读码；产出含后缀/码 LISTING_STATE_INVALID；应 = "Business state transition rejected"，实际 "Business state transition rejected (LISTING_STATE_INVALID)"）
  （JOB_STATE_INVALID / JOB_APPLICATION_STATE_INVALID / CURRENCY_STATE_INVALID / STATEMENT_TIMEOUT 各 4 语同形）
```
**复原** ⇒ `shasum` 回 `d1928ea5…`，门 `EXIT=0`，`机读码出现次数合计 = 0 / 节点 36`、`总判：PASS`。⇒ 与报告 §1.3【B】逐字一致（G 命中 20）。

### L2-b 变异 ②（**另一处**逻辑改动，与旧口径无关）：`resolveI18nMessage` **① 链顺序颠倒**（`② 服务端原文` 提到 `① 真键命中` 之前）
```diff
-  // ① 真键命中
-  const hit = i18nKey ? fromI18n(i18nKey) : undefined
-  if (hit) return hit
-
-  // ② 服务端原文（nullish 合并 …）
-  if (isUsableText(fallback, i18nKey)) return fallback
+  // ★ 变异(b)：② 服务端原文提前（① 链顺序颠倒）
+  if (isUsableText(fallback, i18nKey)) return fallback
+  // ① 真键命中
+  const hit = i18nKey ? fromI18n(i18nKey) : undefined
+  if (hit) return hit
```
```
$ node scripts/p7c-errmsg-machinecode-gate.mjs          # 副本内，变异后
EXIT=1
  ★ 反例面违例 = 4 / 节点 16（必须 = 0）
  ! F 反例面被误判为机读码（O-1 边界回归）：O-1′ · 503 真体（i18n_key 已本地化 ledger.err.LEDGER_TX_TIMEOUT）⇒ ① 让位（真文案） · zh ⇒ "系统繁忙，请稍后重试 (too_many_connections)"（应 = 该语真文案 "系统繁忙，请稍后重试。"（① 让位），实际 "系统繁忙，请稍后重试 (too_many_connections)"）
  （hk/en/vn 同形）
  总判：FAIL（判负 4 必须 = 0；链=真链 / … F 反例违例=4/16 / …）
```
**复原** ⇒ 哈希回 `d1928ea5…`，门 `EXIT=0`、`总判：PASS`。

### L2-b2 变异 ③（附加，第三处独立改动）：`containsMachineCode` **恒 false**
```
$ node scripts/p7c-errmsg-machinecode-gate.mjs
EXIT=1
总判：FAIL（判负 33 必须 = 0；链=真链 / … D 类级违例=4/16 / … G 机读码出现次数=24/36 违例=24 …）
```
**复原** ⇒ `EXIT=0`、`总判：PASS`。

**结论（核心）**：**三处互不相同的 `auth.js` 逻辑改动（reason 判据 / ① 链顺序 / 谓词本体）各自使门必红，且复原即回绿** ⇒ 门**确实是真回放 `src/auth.js#apiErrorMessage`**，**不是**只回放自己的镜像。**「真链」结论 HOLDS，无阻断。**

产物：`L2a_p7c_reason-old-caliber.txt` / `L2b_p7c_chain-order-reversed.txt` / `L2b2_p7c_predicate-false.txt`。

---

## §3 ★ L3 类级现取门「真现取」独立坐实（注入**新形态**）

在副本内**从未被任一报告触碰**的 `src/shell/AppShell.jsx`（类级作用域 63 文件之一）**新注入**一处 F2 模板串形态（`${row.status}`）：
```
$ node scripts/p4z-i18nviol-global.mjs   # 副本内，注入前
EXIT=0   形态命中 = 0 处；… 显式豁免（死分支，登记）= 0/0 处   类级残余（活体）= 0 条
$ node scripts/p4z-i18nviol-global.mjs   # 副本内，注入后
EXIT=1
  形态命中 = 1 处；属性位排除（key= 属性，非文案位）= 1 处；显式豁免（死分支，登记）= 0/0 处
  类级残余（活体）= 1 条（必须 = 0）
  ? src/shell/AppShell.jsx:28 :: [F2 `${<obj>.<field>}`] "${row.status}"
```
**复原** ⇒ `EXIT=0`、`形态命中 = 0 处`、`类级残余（活体）= 0 条`。

**结论**：注入一处**全新形态/全新文件** ⇒ 门 `EXIT≠0` 且**类级残余 > 0** ⇒ 该门是**现取扫描**（去注释后逐文件、逐行正则匹配 `pages/**`+`components/**`+`shell/**` 共 63 文件），**非静态登记**。HOLDS。

> 注：该文件 `blob` 复原后 = `1a35acebbe7b2292c33fe15231544a5f1c6de4bc` == `git rev-parse e5d7bb7:frontend/src/shell/AppShell.jsx`（§8）。

产物：`L3_i18nviol_injected-F2-AppShell.txt`。

---

## §4 L4 四语与兜底独立核

### §4.1 递归拍平四语 JSON
```
zh: 745   hk: 745   en: 745   vn: 745
四语键集是否完全相等: True      取值集合: [745]
```
⇒ **`flat = 745` 四语相等** ✅（与门② `{745}` 二重印证）。

### §4.2 `orders.statusLabel.*`（5）+ `orders.sideLabel.*`（3）= **8 键 × 4 语**逐条审
| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `orders.statusLabel.open` | 挂单中 | 掛單中 | Open | Đang mở |
| `orders.statusLabel.partial` | 部分成交 | 部分成交 | Partially filled | Khớp một phần |
| `orders.statusLabel.filled` | 已成交 | 已成交 | Filled | Đã khớp |
| `orders.statusLabel.cancelled` | 已撤销 | 已撤銷 | Cancelled | Đã huỷ |
| `orders.statusLabel.unknown` | 其他状态 | 其他狀態 | Unknown | Không rõ |
| `orders.sideLabel.buy` | 买入 | 買入 | Buy | Mua |
| `orders.sideLabel.sell` | 卖出 | 賣出 | Sell | Bán |
| `orders.sideLabel.unknown` | 其他方向 | 其他方向 | Unknown side | Không rõ chiều |

- **真文案**（非 stub、四语互异）✅；**en/vn 零 CJK**（脚本判定 `en-CJK=False vn-CJK=False` × 8）✅；**hk 用繁體**（`掛單中 / 已撤銷 / 其他狀態 / 買入 / 賣出`）✅。

### §4.3 ★ 兜底实测：**未知枚举驱动两页真渲染**（副本内 jsdom，四语逐语）
`sunset-value`（ListingDetail `status`）/ `status=sunset-value` + `side=moon`（Market）:
```
[L4·ListingDetail·zh] visible="商品编号 #5 · 其他状态"   raw_shown=false
[L4·ListingDetail·hk] visible="商品編號 #5 · 其他狀態"   raw_shown=false
[L4·ListingDetail·en] visible="Listing #5 · Unknown"     raw_shown=false
[L4·ListingDetail·vn] visible="Mã hàng hoá #5 · Không rõ" raw_shown=false
[L4·Market·zh] meta="5/0 · 其他状态" title="#9 · 其他方向"
[L4·Market·hk] meta="5/0 · 其他狀態" title="#9 · 其他方向"
[L4·Market·en] meta="5/0 · Unknown" title="#9 · Unknown side"
[L4·Market·vn] meta="5/0 · Không rõ" title="#9 · Không rõ chiều"
```
⇒ 用户可见串**恒为该语 `unknown` 文案**，**未知枚举绝不裸渲**（`raw_shown=false` × 4）。原值仅留排查属性位（`data-sf-status` / `title`）。

### §4.4 缺省 / 空串口径未变
```
[L4·缺省·ListingDetail·zh] visible="商品编号 #5 · -"      ⇒ 缺省维持 `-`
[L4·缺省·Market·zh] meta="5/0 · " title="#9 · "           ⇒ 缺省维持空串
```
（探针 11 用例全绿：`Test Files  2 passed (2)` / `Tests  11 passed (11)`。）

产物：`L4_flatten.json` / `L4L5_probes-four-lang-default-jobdetail.txt`。

---

## §5 L5 死分支删除的回归风险

**① 可见行为未变**：`JobDetailPage.jsx:242` 现为常量占位 `<div className="sf-jobs-meta">{'—'}</div>`；原为 `{item.job_status || item.status || '—'}`。
- 独立核后端契约（**现取**）：`fetchMyApplications`（`job-api.js:44`）⇒ `GET /api/task-progress`；`index.ts:833/839` ⇒ `listTaskProgressByUser`；
- `database.ts:1432-1458` SELECT 列集 = `jID / tID / uID / info_input / time_created / time_submitted / time_checked / time_claimed / points_claimed` —— **不含 `status`/`job_status`**；
- `normalizeTaskProgress`（`database.ts:652-662`）输出键集**同集**；`TaskProgressRecord`（`:364-374`）**同集** ⇒ **两字段恒 `undefined`** ⇒ 原表达式恒求值 `'—'`。
- ⇒ **替成常量 `'—'` 对真实回包零可见差异**。真渲染坐实：`[L5] row(no status) ⇒ .sf-jobs-meta textContent="—"  title="#42"`；对照 `row(带 status='applied') ⇒ "—"`（现码**不再引用**不存在字段）。
- **同页既有口径**：`JobDetailPage.jsx:95`（`pay`）与 `:100`（`jobNote || '—'`）均以 `'—'` 作空态占位 ⇒ 常量占位**沿用同页既有口径** ✅。

**② 门内无陈旧豁免**：`p4z-i18nviol-global.mjs:230` 现取 = `const EXEMPT_ENUM_SITES = new Map()`（**零条目**）；门读数 `显式豁免（死分支，登记）= 0/0 处` ✅。

**③ 不再引用不存在字段**：`grep -n "job_status\|item.status"` 仅命中 `:236/:238` —— **均在该处 `{/* … */}` 注释块内**（说明文字），**非活体代码**；活体 `:242` 为常量。`文件:行 = frontend/src/pages/jobs/JobDetailPage.jsx:242`。

**结论**：死分支删除**无回归风险**。HOLDS。

---

## §6 L6 两报告复核 + R-7E-5 / R-7E-6 独立判定

### §6.1 骨架/占位与行数
```
$ wc -l docs/audit/p7-e-tails.md docs/audit/p7-e-tails-beta.md
  307 docs/audit/p7-e-tails.md
  363 docs/audit/p7-e-tails-beta.md
$ grep -c $'\x5f\x5f' docs/audit/p7-e-tails.md      → 0
$ grep -c $'\x5f\x5f' docs/audit/p7-e-tails-beta.md → 0
```
⇒ 行数 **307 / 363**、占位 **0 / 0** ✅。`d07112d` 仅动 `docs/seafood.master-plan.md`（+23）⇒ 被检面确实钉在 `e5d7bb7` ✅。

### §6.2 各抽 5 条读数逐字对拍（盘面现取）

**`p7-e-tails.md`（alpha）**
| # | 报告断言 | 现取读数 | 判 |
|---|---|---|---|
| A1 | §2.2 `0015_listing.sql:137` `listing_status_enum` | `137:  CONSTRAINT listing_status_enum      CHECK (status IN ('draft','listed','delisted','frozen')),` | ✅ 逐字 |
| A2 | §2.2 `:124` `status … DEFAULT 'draft'` | `124:   status             text        NOT NULL DEFAULT 'draft',` | ✅ |
| A3 | §2.3 `listings.statusLabel.*` 四语表 | `zh{draft:草稿,listed:已上架,delisted:已下架,frozen:已冻结,unknown:其他状态}` / en{…Draft/On sale/Removed/Suspended/Unknown} / vn{…Bản nháp/Đang bán/Đã gỡ bán/Đã tạm khóa/Không rõ} | ✅ 逐字 |
| A4 | §3.1 en/vn 8 处 CJK（键集相同） | `en: 8 → [chinese, cantonese, footer.catSlogan1-3, footer.cloudSlogan, adminSettings.langZh, adminSettings.langHk]`；`vn` 同集 | ✅ |
| A5 | §1.1 升级前注释「纯 node 门」 | `git show 5284f16:…p7c-errmsg-machinecode-gate.mjs` 第 35 行含 `本脚本此前是**纯 node 门**…` | ✅ |
| A6 | §4 单测 268（该 rev） | 该 rev 下为 268；`e5d7bb7` 下 276（β 新增 8 键/探针） | 语境一致 ✅ |

**`p7-e-tails-beta.md`（beta）**
| # | 报告断言 | 现取读数 | 判 |
|---|---|---|---|
| B1 | §1.1 `listing_status_enum:137` | 同上 A1 | ✅ |
| B2 | §1.2 `0016_market.sql:130` side / `:144` status | `130:  CONSTRAINT market_order_side_enum         CHECK (side IN ('buy','sell')),` / `144:  CONSTRAINT market_order_status_enum       CHECK (status IN ('open','partial','filled','cancelled')),` | ✅ 逐字 |
| B3 | §7.2 `:135` 是注释行 | `135:   -- §6.4：\`price bigint >0\`` | ✅ 逐字 |
| B4 | §2 `orders.*` 8 键 ×4 | 见 §4.2（逐字一致） | ✅ |
| B5 | §5 flat 737⇒745 / top 102⇒103 / 节点 2948⇒2980 | `flat={745}`（门②）/ `top=103`（四语）/ `locale=2980`（门①） | ✅ |
| B6 | §5 断言订正 **9 删 / 9 增** | 四个被改测试文件（**不含**新增件）`-U0`：`del=9 add=9` | ✅ 见下方口径注 |

> **口径注（B6）**：若按 `22b20c5→e5d7bb7` 全目录 diff（含**已提交**的新增件 `p7e-tails-beta.test.jsx` +182），`add=191`；但 beta 写作时该新增件**未跟踪**（`??`），`git diff` 天然不计 ⇒ 其 `add=9` 读数**在其语境下成立**。**报告未删断言**（9 增全为字面量订正）**HOLDS**。
- `git diff --stat 22b20c5 e5d7bb7 -- frontend/src/locales/` = 四文件各 **+14**（8 键 + 结构行）✅ 与 §0.2 一致。

### §6.3 ★ R-7E-5 独立判定：`localizeFields` 是否把枚举送入翻译 —— **HOLDS（纯读；白名单不含枚举）**
**(A) 本体纯读**（`frontend/src/i18n-content.js`）：
```js
// :37  pickLocalized —— obj[<key><suffix>] || obj[key]，无副作用
export const pickLocalized = (obj, key, lang) => {
  if (!obj || typeof obj !== 'object') return undefined
  const suffix = langSuffix(normalizeLang(lang))
  if (!suffix) return obj[key]
  const localized = obj[`${key}${suffix}`]
  return localized || obj[key]
}
// :51  localizeFields —— 只做本地拷贝赋值，**不调用任何翻译 API**
export const localizeFields = (obj, keys, lang) => {
  if (!obj || typeof obj !== 'object') return obj
  const suffix = langSuffix(normalizeLang(lang))
  if (!suffix) return obj
  const next = { ...obj }
  for (const key of keys) {
    if (next[`${key}${suffix}`] === undefined && next[key] === undefined) continue
    next[key] = pickLocalized(next, key, lang)
  }
  return next
}
```
⇒ **纯读**：只回显已存在的 `*_<lang>` 列；**不发起任何翻译**。调用面（`frontend/src`，非 test）**唯一 1 处** = `src/pages/market/MarketPage.jsx:211`（keys 含 `side`/`status`）。✅
**(B) 真管线白名单不含任何枚举**（现取）：
```
translate-service.ts:912-917  WHITELIST = { job:{title,description}, listing:{title,description}, user:{bio}, currency:{name} }
translate-service.ts:1134-1139 TRANSLATABLE_SPECS = 同域（job/listing/user/currency）
index.ts 写侧登记：:94 listing(title/description) / :582 user(bio) / :1610 currency(name) / :1697 job(title/description)
```
⇒ **`status`/`side`/`job_status`/`listing.status` 全落在白名单之外**，现网**不会**被登记/翻译。**排除点 = `translate-service.ts:912-917` + `:1134-1139`**。✅ HOLDS。

### §6.4 ★ R-7E-6 独立判定：`MarketPage:211` keys 含 `side`/`status` 是否**真无行为风险** —— **HOLDS（当前零行为风险；隐患真实存在）**
现取行为探针（esbuild 打包 `i18n-content.js`，真实回包行 `{order_id,side,status,price,amount}`）：
```
zh => side: sell | status: filled | 与原行逐字相同: true
hk => side: sell | status: filled | 与原行逐字相同: true
en => side: sell | status: filled | 与原行逐字相同: true
vn => side: sell | status: filled | 与原行逐字相同: true
若后端扩域(带 status_en/side_en, en): {"order_id":9,"side":"Sell","status":"Filled","status_en":"Filled","side_en":"Sell"}
```
- 因后端**不产出** `side_<lang>`/`status_<lang>`（§6.3(B)），`pickLocalized` 对两枚举**恒回落原值** ⇒ `localizeFields` 对真实行是 **no-op（四语全部 `与原行逐字相同: true`）** ⇒ **当前零行为变化**。
- **隐患坐实**：一旦后端扩域写入 `status_en`，`localizeFields` 会把枚举换成译文标签（`status:'Filled'`），继而 `MarketPage.jsx:360-365` 的 `MARKET_ORDER_STATUS_KEYS.includes('Filled')` 为假 ⇒ 落 `orders.statusLabel.unknown`（**退化为「其他状态」，非裸渲、无泄漏**）。⇒ **报告「登记为下一批必修项、当前不改」的判定成立**。HOLDS（当前无风险）。

---

## §7 L7 未验证清单 + verdict

### §7.1 未验证项（逐项原因，**禁填 0 或空**）
1. **浏览器端 5787/5788 真机** —— 本单**禁启停**；所有页面行为以副本内 jsdom **真渲染**（`@testing-library/react`）覆盖，**无真机截图/交互读数**。
2. **真库连接** —— 只读源码/迁移；`market_order` / `listing` / `job_application` 的**实际行分布**未连库验证，取值域以 `CHECK` 白名单为准（`0015_listing.sql:137` / `0016_market.sql:130,144`）。
3. **`npm run test:components` / `test:e2e` / `test:performance` / `test:accessibility` / `lint` / `type-check`** —— **不在本单 AC**，**未跑**。
4. **后端翻译写侧端到端**（真把待译行写库、产出 `*_<lang>`）—— R-7E-5 仅**只读源码**核验白名单，未跑真库写路径。
5. **前端 dist 部署/线上 grep** —— 本单**不 push**（推送即上线）⇒ 未做线上产物验证。
6. **p7c 真链对 `esbuild` 的依赖** —— 仅在**本环境**（`esbuild@0.21.5` 在场）坐实；缺 `esbuild` 的环境会打印 `【镜像级】` 并**判负**（未在该负环境实测）。
7. **`localizeFields` 未来的调用面** —— 现取 `frontend/src`（非 test）唯一 1 处；未来/未跟踪分支未穷举。

### §7.2 verdict —— **PASS（独立复核全部 HOLDS；零阻断）**
- **L1**：build 0 / 单测 31 files 276 passed / **七门全 0**（含 p7c `链路体制 = 真链`）。
- **L2（核心）**：**三处互异 `auth.js` 逻辑变异各自使门必红、复原回绿** ⇒ 门**真回放 `src/auth.js`**，非镜像。**未推翻「真链」（非阻断）。**
- **L3**：注入**全新形态/全新文件** ⇒ 门 `EXIT≠0` 且类级残余 > 0 ⇒ 门为**现取扫描**。
- **L4**：`flat=745` 四语相等；8 键 ×4 语真文案、en/vn 零 CJK、hk 繁體；未知枚举四语逐语**本地化兜底、不裸渲**；缺省口径未变（`-` / 空）。
- **L5**：死分支删除**零可见回归**（真实回包恒 `'—'`）、门内**零陈旧豁免**、活体不再引用不存在字段。
- **L6**：两报告行数/占位达标、抽样读数逐字对拍**全中**；**R-7E-5 HOLDS**（`localizeFields` 纯读 + 白名单不含枚举）；**R-7E-6 HOLDS**（当前零行为风险，隐患真实且已登记）。

---

## §8 收尾

### §8.1 逐文件 blob 对拍（副本：被变异文件 == `e5d7bb7`）
```
$ git hash-object frontend/src/auth.js            → cd1a72c171e81389e92ca32e6e26dd85761d0e12
$ git rev-parse e5d7bb7:frontend/src/auth.js      → cd1a72c171e81389e92ca32e6e26dd85761d0e12   MATCH
$ git hash-object frontend/src/shell/AppShell.jsx → 1a35acebbe7b2292c33fe15231544a5f1c6de4bc
$ git rev-parse e5d7bb7:frontend/src/shell/AppShell.jsx → 1a35acebbe7b2292c33fe15231544a5f1c6de4bc MATCH
$ git -C "$SCRATCH/qa7e" diff --stat e5d7bb7 -- .   # 全量被跟踪文件对拍 ⇒ 空（零差异）
$ git -C "$SCRATCH/qa7e" status --porcelain
?? frontend/qa7e-lf-driver.mjs
?? frontend/node_modules
?? frontend/src/test/unit/qa7e-jobdetail.probe.test.jsx
?? frontend/src/test/unit/qa7e-render.probe.test.jsx
```
⇒ 副本内**所有被跟踪文件逐字节复原**；仅剩**未跟踪探针/软链**（变异全部复原，零残留）。

### §8.2 首尾 `git status`（主工作区）
```
首（开工）：git status --porcelain ⇒ （空）                    # §0.1
尾（收尾）：git status --porcelain ⇒
?? docs/qa/p7-e-tails-review.md
?? frontend/.p7eqa-artifacts/                                  # 本单产物
```
⇒ 主工作区**未改任何被检代码 / 无仓内临时污染**；`HEAD` 未动（`d07112d`）。**未 `git add/commit/push`。**

### §8.3 端口
```
$ lsof -nP -iTCP:5796-5799 -sTCP:LISTEN
（空 —— exit=1）
```

### §8.4 worktree remove
```
$ git worktree remove --force /Users/kevin/.hermes/profiles/zang/cache/scratch/qa7e
removed OK
$ git worktree list
/Users/kevin/bistro/seafood   d07112d [main]
（… 其余为历史 QA 副本，与本次无关 …）
```
（本单**无需**起后端实例。)

---

## §9 本单产物清单

- 报告：`docs/qa/p7-e-tails-review.md`（本件；连续双下划线占位符计数 = 0）。
- 产物（`frontend/.p7eqa-artifacts/`，run-tagged，`.json`/`.txt`，**无 `.log`**）：
  `20261002-212301_L1_p4z-i18nviol-global.txt`、`20261002-212301_L1_p6-tr2-i18n-locales.txt`、`20261002-212301_L1_p4z-miscfix-links.txt`、`20261002-212301_L1_p4z-feperf-safelist.txt`、`20261002-212301_L1_p7a-03-errmessage-gate.txt`、`20261002-212301_L1_p7b-errfallback-gate.txt`、`20261002-212301_L1_p7c-errmsg-machinecode-gate.txt`、`L1_blob-verify.txt`、`L2a_p7c_reason-old-caliber.txt`、`L2b_p7c_chain-order-reversed.txt`、`L2b2_p7c_predicate-false.txt`、`L3_i18nviol_injected-F2-AppShell.txt`、`L4_flatten.json`、`L4L5_probes-four-lang-default-jobdetail.txt`、`L6_R7E-6_localizeFields_probe.txt`。
