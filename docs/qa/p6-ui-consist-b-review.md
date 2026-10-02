# P6-UI-CONSIST-B（9284fc1）· 独立质检报告（Neng）

- 被检 revision：`9284fc1e84b26643e9f3db9a13cc3d4d77c9e578`（`9284fc1`，分支 `main`，**未推送**）
- 质检方：**Neng**（独立，只读被检件；全部读数在**固定副本**上取）
- 日期：2026-10-02（CST）｜仓库：`/Users/kevin/bistro/seafood`
- 探针：**全部为本人自建**（`probe.mjs` / `probe2.mjs` / `probe3.mjs` / `pxprobe.mjs` / `pxcal.mjs`），**不使用**作者 `frontend/scripts/p4z-uiconsistb-shape.mjs`
- 原始读数落盘：`backend-ts/.p6bqa-artifacts/`（`.json`/`.txt`，非 `.log`）

---

## 判定

> ### **可用**
>
> 硬门全过（build 0 / 单测 26 files 238 passed / 四脚本 exit 0）；改前→改后**逐类 computed 形状差**在 13 个可渲染类上**独立复现且方向一致**（去切角 / 去硬位移阴影 / 圆角收敛到 8px）；尺子经**变异判负**自证有灵敏度后**复原回绿**；线上产物与本地 `9284fc1` 构建**逐字节相同**（sha256 相等）；两档几何同构 diffs=0；三宽度 × 两档 36 组全部断言 `innerWidth` 通过、横向溢出 0。
>
> 未发现**功能或视觉缺陷**。作者报告有 **3 处自述与实测不符**（§6），其中 2 处是**低估了自己的交付**（ui 基础件其实生效了），1 处是**口径计数错误**。均不构成判负，但需在册。

---

## §0 开工对锚 + 固定副本证据

### 0.1 开工锚（T0 = 2026-10-02 14:37 CST）

```
$ git log --oneline -3
9284fc1 feat(ui): 第二批形状收敛 B 成套（…）+ 238 例全绿 + 主题层零漂移（未推送）
23159c0 docs: Kevin 确认生产域名变更（口径定档 ssseafood.vercel.app）…
7464c04 chore: 小尾巴收尾…

$ git status --porcelain
(空 —— T0 主工作区干净)
$ git rev-parse HEAD   → 9284fc1e84b26643e9f3db9a13cc3d4d77c9e578
$ git rev-parse 9284fc1^ → 23159c037bf956b04cffeff3b3d8bf3d7d2dddc0
```

**T0 之后主工作区被实现方改动（非我）**：14:5x 复查 `git status --porcelain` 显示
` M backend-ts/src/database.ts / backend-ts/src/index.ts / docs/route-layer.spec.md / frontend/src/pages/{ProfilePage,ShardPage,market/MarketPage}.jsx`，另有他方 `?? .p6jing-artifacts/ backend-ts/.p7a-artifacts/ backend-ts/scripts/p7a-0*.ts frontend/src/ledger-api.js`。
⇒ 本报告的**全部读数一律在固定副本上取**，主工作区的后续漂移与本单无关（也证明「在活工作区上证伪」会得到不自洽的读数）。

### 0.2 固定副本（worktree）

```
$ git worktree add --detach <scratch>/qa-uiconsistb      9284fc1
$ git worktree add --detach <scratch>/qa-uiconsistb-pre  9284fc1^
$ git worktree add --detach <scratch>/qa-negctrl         9284fc1     # 判负实验专用
$ ln -s /Users/kevin/bistro/seafood/frontend/node_modules <各 worktree>/frontend/node_modules
```
（`scratch = /Users/kevin/.hermes/profiles/zang/cache/scratch/`）

### 0.3 逐文件 blob 相等（`git hash-object` 副本文件 vs `git rev-parse 9284fc1:<path>`）

| 文件 | 9284fc1 blob(sa1) | 副本 hash-object | 判定 | 副本 sha256 |
|---|---|---|---|---|
| `frontend/src/components/ui/Card.jsx` | `0da42549ae2159379b4304cc74d5b8836b801c32` | 同 | **EQ** | `b24b8a30ae5e3cf432ec14514d5dd9d24629b102920a2fdd45e9b503aeaab5d1` |
| `frontend/src/components/ui/Form.jsx` | `f9f5b4c0a56811652e5856f7ba54f57ff32d7951` | 同 | **EQ** | `3d693fd1dd6c0cefe0ee49fd9d256454d1448032e1e41411f9c059ff12cd8316` |
| `frontend/src/components/ui/Tabs.jsx` | `ded04c086743020ca2760c9edcc40d27a59c4abe` | 同 | **EQ** | `7673e2f9e2066d2d7e8cc5c3f340e37ff757820302338555699e84dc4a02fdea` |
| `frontend/src/pages/jobs/jobs.css` | `932ed0c4b591af17384f1cf988df41475927f067` | 同 | **EQ** | `a3f0cd10fe1c6848c04289b423f625819cab4203c37f6b12e6def1840020b1f9` |
| `frontend/src/pages/listings/listings.css` | `cdfe676d33e2be18eda15d2d77e8443b7e0a1a19` | 同 | **EQ** | `f94f80b3fdc04cee09c85f2f48ae183109f233f94955ba9c954ef9ca596f5008` |
| `frontend/src/pages/market/market.css` | `b2452d161c199217665ca0668299c38eeddc49e2` | 同 | **EQ** | `855e0ffdcf2257c8f7168f4e8670761e875f636f683e1e394c5a48c1007c608a` |
| `frontend/src/shell/shell.css` | `e8b99f64c8bcf6eb12e23594f707959286d056e2` | 同 | **EQ** | `6dba5456e73aebd1ec171d694b399e3841b50801a963695d9f464172a763543b` |
| `frontend/src/styles.css` | `55d26f96a4ad2ae7de12b9977aa74ec255ef5751` | 同 | **EQ** | `c89a699e4f5c1cf6dad3776c2408f70db9a8625b5211083dceb322ee3d30a9c6` |
| `frontend/scripts/p4z-uiconsistb-shape.mjs` | `3dfafbed6538552ca9252c7a5c09e16cb0814586` | 同 | **EQ** | `58a439812b5d7e3e035315f6726fff7003223d3c9a5377b255810377c047a362` |

⇒ 9/9 **逐文件相等**；副本 == `9284fc1` 落盘内容。

### 0.4 主工作区零污染声明

本单**未改任何被检文件**；我的写入仅两处：
1. `backend-ts/.p6bqa-artifacts/**`（本单读数产物，新增）
2. `docs/qa/p6-ui-consist-b-review.md`（本报告，新增；`docs/qa/` 既有件一字未动）

未 `git add/commit/push`；未 `npm install`；未碰 `.env*`；未改 `docs/audit/**`、`docs/seafood.master-plan.md`、`docs/*.spec.md`；未用 `pkill -f` / `killall`。
自起实例仅用 **5793 / 5794 / 5795 / 5796 / 5797 / 5798 / 5799**（作者用 5792，我一律避让）；收工时 `lsof -nP -iTCP:5792-5799 -sTCP:LISTEN` = **空**。

---

## §1 判定表

| # | 判据 | 判词 | 关键读数 |
|---|---|---|---|
| L1-a | `npm run build`（固定副本 `qa-uiconsistb`） | **PASS** | exit **0**；`✓ built in 1.67s`；产物 `dist/assets/index-mRq3HT-x.css` **124,953 B** |
| L1-a' | `npm run build`（固定副本 `qa-uiconsistb-pre` = 改前） | **PASS** | exit **0**；`index-y6PsZmmc.css` **124,962 B** |
| L1-b | `npm run test:unit` 例数不减 | **PASS** | **26 files / 238 passed**（与作者自报逐值相同，**未减少**） |
| L1-c | 四脚本退出码（管道外取） | **PASS** | `p6-tr2-i18n-locales`=0 / `p4z-i18nviol-global`=0 / `p4z-feperf-safelist`=0 / `p4z-miscfix-links`=0 |
| L2-a | `.sf-card` 改前→改后 | **PASS** | 日 `13px + rgb(3,4,2) 3px 3px 0 0` → **`8px` + `none`**；夜 `2px` → **`8px`** |
| L2-b | `.sf-panel` | **PASS** | 日 `13px + 3px 3px 0` → **`8px + none`**；夜 `2px` → **`8px`** |
| L2-c | `.sf-listings-card` | **PASS**（mock 公开读口后实测） | 日 `13px + 3px 3px 0` → **`8px + none`**；夜 `2px` → **`8px`** |
| L2-d | `.sf-listings-item` | **NOT_MEASURED** | 需登录态读口 `/api/prize-item`；见 §5 |
| L2-e | `.sf-mkt-panel` | **PASS** | 日 `13px + 3px 3px 0` → **`8px + none`**；夜 `2px` → **`8px`** |
| L2-f | `.sf-listings-input` | **PASS** | 日 `11px + rgb(3,4,2) 2px 2px 0 0` → **`8px + none`**；夜 `2px` → **`8px`** |
| L2-g | `.sf-mkt-input` | **PASS** | 日 `11px + 2px 2px 0` → **`8px + none`**；夜 `2px` → **`8px`** |
| L2-h | `.sf-mkt-select` | **PASS** | 日 `11px + 2px 2px 0` → **`8px + none`**；夜 `2px` → **`8px`** |
| L2-i | `.sf-box` | **PASS** | 日 `11px + 2px 2px 0` → **`8px + none`**；夜 `2px` → **`8px`** |
| L2-j | `.sf-chip` 「999px → 8px」 | **PASS（复现）** | 日 **`999px` → `8px`**；夜 `2px` → `8px`（18 样本） |
| L2-k | `.sf-tag` | **PASS** | 日 `5px` → `8px`；夜 `2px` → `8px` |
| L2-l | `.sf-price`「夜档 0px → 8px」 | **PASS（复现）** | 夜 **`0px` → `8px`**；日 `8px` → `8px`（两档同值） |
| L2-m | `.sf-tabbar` | **PASS（未变，如实登记）** | `0px` → `0px`；上描边 `1px` 未变 ⇒ **本类未被收敛**（见 §6.3） |
| L2-n | `.sf-tab` | **PASS** | **`0px` → `8px`**（48 样本，两档同值） |
| L2-o | `.btn-proceed` 切角去除 | **PASS（复现）** | `clip=polygon(10px 0px, calc(100% - 10px) 0px, …)` → **`none`**；`r 0px` → **`9px`**（日/夜同值） |
| L2-p | `.btn-md` 切角去除 | **PASS（带限定）** | 旧语义实例：`clip=polygon(…) → none`、`r 0px → 9px`；**同选择器另有 A 系实例改前已是 `clip:none/r:8px`**（作者表述为「`.btn-md` 全体」属过度概括，见 §6.2） |
| L2-q | `.sf-listings-panel` / `-empty` / `-tag` / `-price`（补测） | **PASS** | 13/2px → 8px；`-tag` `5px/2px` → `8px`；`-price` 夜 `0px` → `8px` |
| L2-r | `.sf-listings-grid`（容器，非目标） | **PASS（未变）** | `0px`，前后一致（布局不动） |
| L3 | 主题同构（切档 rect 逐值相等） | **PASS** | 我自建采样 **keys=92 / diffs=0**（改后）；**改前同样 keys=92 / diffs=0** |
| L4 | 尺子灵敏度（变异判负） | **PASS** | 变异后 `.sf-card` 读出 **`13px`**、`.btn-proceed/.btn-md` 读出 **`clip=polygon(…)`**；复原后**回绿**且 sha256 前后相等（§3） |
| L5 | 线上 vs 本地 | **PASS（逐字节）** | prod `index-mRq3HT-x.css` = 本地 `9284fc1` dist = **sha256 `209aa959a70ebe24ddbf50f0acca789b0c3facdc4e19eef2a6cfc61f8114e28e`**，124,953 B |
| L6-① | ui 基础件是否生效 | **PASS（**与作者自述相反**）** | `ui/Card`：`12px/2px border/shadow-sm` → **`8px/1px border/none`**；`ui/Tabs` trigger：**`6px` → `8px`** + 去 `shadow-sm` |
| L6-② | `input[class~="px-3"]` 0 命中 | **PASS（0 命中，已证边界）** | 10 页 × 两档 × 两宽度 = **B=0 / A=0**；`ui/Form` 全仓**无生产 import** ⇒ 见 §5 |
| L6-③ | 1.5px→1px 像素级差异 | **PASS（已实测：Chrome 上为 0）** | DPR 2/3 标定：`1.5px` 与 `1px` **渲染同为 1 CSS px**；`.sf-card` 暗游程 前后均 2 设备 px（§6.5） |
| L6-④ | hover / focus / active 态 | **PASS（6 项已测）** | `.btn-proceed/:hover/:active`、`.btn-md/:hover`、`.sf-chip:hover`、`.sf-box:hover`、`.sf-listings-input:focus`、`.sf-mkt-input:focus` 全为 `clip=none / radius 收敛值`；`.sf-tab:hover` `NOT_MEASURED`（§5） |
| L6-⑤ | `/task` 页 | **部分不符** | `.sf-tabbar`×1 / `.sf-tab`×4 **在 `/task` 上确有渲染**；作者称「四类 0 命中」不成立（§6.4） |
| L6-⑥ | 残留 `clip-path: polygon` 清单/条数 | **PASS（条数须修正）** | 源码 **4 行 = 3 条规则**（`.badge-gift::before` / `#section_gift .point-badge` / `.badge::after`）；产物（prod 与本地一致）**3 处**，非派单方所述 1 处（§6.1） |
| L7 | 三宽度 × 两档 + `innerWidth` 断言 | **PASS** | 6 页 × 2 档 × {390×844, 1280×900, 1600×900} = **36/36 断言通过**；横向溢出 **0** |

**PASS 30 / NOT_MEASURED 1（另 §5 逐项登记 5 条）/ 无 FAIL。**

---

## §2 改前 → 改后 逐类 computed 读数（自建探针）

口径：离线静态服务 `dist`，外部源一律 abort，`viewport 1280×900`，`deviceScaleFactor=1`，`reducedMotion:'reduce'` + 注入 `animation/transition:none`（保证确定性；不触碰形状属性），`data-theme` 与 `localStorage['theme']` **逐次断言**（本批 12/12 一致）。
列：`radius | box-shadow | clip-path | border-top`（改前 → 改后）。原始全量：`L2-shape-diff-table.txt`（244 行）。

| 类 | 页面 / 档 | 改前 | 改后 |
|---|---|---|---|
| `.sf-card` | /theme-preview 日 | `13px` \| `rgb(3,4,2) 3px 3px 0px 0px` \| `none` \| `1px solid rgb(3,4,2)` | **`8px` \| `none`** \| `none` \| 同 |
| `.sf-card` | /theme-preview 夜 | `2px` \| `none` \| `none` | **`8px`** \| `none` \| `none` |
| `.sf-panel` | /theme-preview 日/夜 | `13px`·`2px` \| `3px 3px 0`·`none` | **`8px`** \| `none` |
| `.sf-listings-card` | /listing（mock）日/夜 | `13px`·`2px` \| `3px 3px 0`·`none` | **`8px`** \| `none` |
| `.sf-listings-panel` | /listing 日/夜 | `13px`·`2px` \| `3px 3px 0`·`none` | **`8px`** \| `none` |
| `.sf-listings-empty` | /listing 日/夜 | `13px`·`2px` \| `none` | **`8px`** \| `none` |
| `.sf-listings-input` | /listing 日 | `11px` \| `rgb(3,4,2) 2px 2px 0px 0px` | **`8px` \| `none`** |
| `.sf-listings-input` | /listing 夜 | `2px` \| `none` | **`8px`** \| `none` |
| `.sf-listings-price` | /listing（mock）日·夜 | `8px`·**`0px`** \| `none` | **`8px`·`8px`** \| `none` |
| `.sf-listings-tag` | /listing（mock）日·夜 | `5px`·`2px` \| `none` | **`8px`·`8px`** \| `none` |
| `.sf-mkt-panel` | /shard 日/夜 | `13px`·`2px` \| `3px 3px 0`·`none` | **`8px`** \| `none` |
| `.sf-mkt-input` | /shard 日/夜 | `11px`·`2px` \| `2px 2px 0`·`none` | **`8px`** \| `none` |
| `.sf-mkt-select` | /shard 日/夜 | `11px`·`2px` \| `2px 2px 0`·`none` | **`8px`** \| `none` |
| `.sf-box` | /theme-preview 日/夜 | `11px`·`2px` \| `2px 2px 0`·`none` | **`8px`** \| `none` |
| `.sf-chip` | /theme-preview 日 | **`999px`** \| `none` \| `1px solid rgb(3,4,2)` | **`8px`** \| `none` \| 同 |
| `.sf-chip` | /theme-preview 夜 | `2px` | **`8px`** |
| `.sf-tag` | /theme-preview 日·夜 | `5px`·`2px` | **`8px`·`8px`** |
| `.sf-price` | /theme-preview 日·夜 | `8px`·**`0px`** | **`8px`·`8px`** |
| `.sf-tab` | 6 页 日/夜 | **`0px`** \| `none` | **`8px`** \| `none` |
| `.sf-tabbar` | 6 页 日/夜 | `0px` \| 上描边 `1px` | **`0px`（未变）** \| 上描边 `1px` |
| `.btn-proceed` | / ·/login 日/夜 | **`clip=polygon(10px 0px, calc(100% - 10px) 0px, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0px calc(100% - 10px), 0px 10px)`** \| `r=0px` | **`clip=none`** \| **`r=9px`** |
| `.btn-md` | / ·/login 日/夜 | 旧语义实例同上（另一 A 系实例改前已 `clip=none/r=8px`） | **`clip=none` / `r=9px`** |
| `.sf-mkt-item`·`.sf-jobs-item`·`.sf-listings-item`·`.sf-jobs-tag`·`.btn-sm`·`.btn-inactive` | — | 两版均 **0 命中**（未渲染） | 同 —— 见 §5 |

**DOM 节点数**：改前 / 改后 逐 (页×档) 的命中计数**逐值相同**（未新增/删除节点）。

---

## §3 判负自证（L4）——「尺子有灵敏度」先证后报

**为什么必须做**：§2 的 `diffs=0`（同构）与「未变」读数，若探针本身失灵会与「真的一致」无法区分。

**实验**（独立 worktree `qa-negctrl` = `9284fc1`，只变异，不动被检件）：
```css
/* frontend/src/shell/shell.css  .sf-card */
- border-radius: var(--sf-st-radius-btna);
+ border-radius: 13px;                       /* NEGCTRL */
/* frontend/src/styles.css  .btn 基类 */
- border-radius: 9px;  -webkit-clip-path: none;  clip-path: none;
+ border-radius: 0;    -webkit-clip-path: polygon(10px 0px, …);  clip-path: polygon(10px 0px, …);  /* NEGCTRL */
```
1. `npm run build` → **exit 0**，产物 `index-BXGjlJdL.css`（125.03 kB）。
2. 同一探针（`probe.mjs`）跑变异 dist：
   - `.sf-card` → **`radius=13px`** ⟵ **改前旧值被报出**
   - `.btn-proceed` / `.btn-md` → **`clip=polygon(10px 0px, calc(100% - 10px) 0px, …)`** ⟵ **被报出**
   - 未被变异的 `.sf-chip` / `.sf-price` / `.sf-tab` 仍读 `8px`（**局部性正确**，不是整表噪声）
3. 复原（`git checkout --`）+ 重新 build：
   - 源码 sha256 **前后相等**：`shell.css = 6dba5456…543b`、`styles.css = c89a699e…a9c6`（= §0.3 表中值）
   - 产物回绿：`index-mRq3HT-x.css`，sha256 = `209aa959…e28e`，**与原始 after dist、与 prod 三方相等**。

**附带发现（写入式读数纪律）**：变异 `.btn` 基类 `border-radius` 后，`.btn-proceed`/`.btn-md` 半径仍读 `9px` —— 因 `styles.css:185` 有更高优先级的 `.btn.btn-md { border-radius: 9px; }`。这不是缺陷，而是说明**逐选择器判据不能只看基类**（本报告 §2 的 `.btn-md` 行因此保留「另一 A 系实例」标注）。

---

## §4 线上 vs 本地（L5）

```
$ curl --resolve ssseafood.vercel.app:443:76.76.21.21 -sS -o prod.css \
    -w "http=%{http_code} size=%{size_download}\n" \
    https://ssseafood.vercel.app/assets/index-mRq3HT-x.css
http=200 size=124953
```
（本机默认解析到假 IP `198.18.16.176` ⇒ 必须 `--resolve`；派单方的提醒被独立复核为真。）

| 产物 | 字节 | sha256 |
|---|---|---|
| prod `ssseafood.vercel.app/assets/index-mRq3HT-x.css` | 124,953 | `209aa959a70ebe24ddbf50f0acca789b0c3facdc4e19eef2a6cfc61f8114e28e` |
| 本地 `9284fc1` 固定副本 `dist/assets/index-mRq3HT-x.css` | 124,953 | **同** `209aa959…e28e` |
| 本地 `9284fc1^` 固定副本 `dist/assets/index-y6PsZmmc.css`（改前对照） | 124,962 | `73ff8c649698e70669dd1a277b244466206c8f4cc81f31feb943c30f73d5ec56` |

**⇒ 逐字节相同**：线上产物 **∈ 本 revision**，且线上已是改后形态。（派单方转述的三条 CSS 特征我逐条独立复核为真：）

```
.sf-listings-card{…;border:var(--sf-st-stroke-w-thin) solid var(--sf-card-border);border-radius:var(--sf-st-radius-btna);box-shadow:none;-webkit-clip-path:none;clip-path:none;…}
.btn{clip-path:none;box-shadow:none;background-image:none;border-radius:9px;…}
.sf-tab{…;border-radius:var(--sf-st-radius-btna);box-shadow:none;-webkit-clip-path:none;clip-path:none}
```

**离线 vs 线上的边界**：本节只对齐**CSS 产物字节**。线上的 `getBoundingClientRect` / 截图读数**我未在线上取**（本单不驱动生产站交互）⇒ 见 §5-⑥。

---

## §5 未验证清单（逐项给「为什么没测 / 测到哪停」）

| # | 项 | 状态 | 为什么没测 / 测到哪停 |
|---|---|---|---|
| ① | `.sf-listings-item` computed | **NOT_MEASURED** | 该行由 `GET /api/prize-item` 渲染，**需登录态**（`buyer_uid = me`）。我未持有可用登录态，也未注入伪造鉴权（避免「静默匿名」假读数）。**测到哪停**：其所在文件 `listings.css` 的兄弟规则已实测（`.sf-listings-card/-panel/-empty/-price/-tag` 全部收敛）；该规则在产物里为 `border-radius:var(--sf-st-radius-btna);box-shadow:none;clip-path:none`。 |
| ② | `.sf-mkt-item` / `.sf-jobs-item` computed | **NOT_MEASURED** | 分别需 `GET /api/order`（`owner_uid=actor`，需 token）与招工列表数据。同上：其文件 `market.css` / `jobs.css` 的兄弟类已实测收敛。 |
| ③ | `ui/Form` 的 `Input/Textarea/Select`（`input[class~="px-3"]` 等） | **NOT_MEASURED（0 命中已证到边界）** | **已证**：10 页 × 日/夜 × {1280,1440} = **改前 0 / 改后 0 命中**。**原因已定位**：`ui/Form.jsx` 在 `src/**` 里**没有任何生产 import**（唯一引用是 `src/test/accessibility/Accessibility.test.jsx:4` 经 barrel `components/ui/index.js` 导入）⇒ 该族**在本站页面结构上不可达**，不是探针没找到。**测到哪停**：不再寻找「能渲染它的页面」，因为不存在（除非新增页面）。 |
| ④ | `/task` 与 `/reward` 上的 ui 基础件 | 已测（推翻作者自述） | 见 §6.4 —— 我已在两页取到 computed。 |
| ⑤ | `.sf-tab` 的 **hover 态** | **NOT_MEASURED** | 我的交互态探针跑在 1280×900；`.sf-tabbar { display: none }`（宽屏隐藏、DOM 保留）⇒ `locator.hover()` 3 s 超时。**测到哪停**：`.sf-tab` 的**静置态**已在 6 页 × 日/夜 × 48 样本取到（`0px → 8px`）；未在 390 档补 hover（时间预算内未做）。 |
| ⑥ | 线上（prod）的 rect / 截图 | **NOT_MEASURED** | 本单只对齐 prod 的 **CSS 字节**（§4）；未在生产站驱动浏览器取几何/像素（不在本单授权范围，且生产站有真实后端数据、环境与离线不同构）。 |
| ⑦ | 作者 18+18 张截图的**像素内容** | **NOT_MEASURED** | 文件**存在性已核**：`scratch/p6-uiconsist-b/{after,before}/shots/` 各 **18 张**，命名与报告 §3⑥ 逐条一致。内容我**未做视觉判读**（本会话工作方式为文本优先），也未做像素 diff。**测到哪停**：我改用了**可判负的 computed + 像素游程**判据（§2/§3/§6.5）替代「看图」。 |
| ⑧ | 作者报告的 `p4z-uiconsist-narrow.mjs` / `p4z-uiconsist-probe.mjs` 读数 | 未采信、未复跑 | 这两支是**作者自建探针**，复跑它们得到的是「作者的尺子」；我用自建探针替代（更独立）。其退出码不在本单四脚本硬门内。 |
| ⑨ | `.sf-jobs-*` 全族（`jobs.css`） | **NOT_MEASURED** | `/task`、`/task/new` 两页在未登录态只渲染骨架（`domTotal` 174/120，`.sf-jobs-*` 0 命中）。**测到哪停**：改前/改后**同页命中计数逐值相同**（未新增/删除节点），且该族在产物中的形状声明与已实测族一致。 |

**禁止填 0/空的项**：以上 9 条均给出「停在哪 / 为什么」，无一项以 0 或空白充当结论。

---

## §6 我方（派单方）判据的错误与修正

> 口径：与作者/派单方报告不一致处，**原样登记 + 给读数**，不擅自二选一。

### 6.1 派单方：「prod CSS 里 `clip-path:polygon` = 1 处」——**计数错，实为 3 处**

```
$ grep -o "clip-path:polygon" prod.css | wc -l            → 3
$ grep -o -- "-webkit-clip-path:polygon" prod.css | wc -l → 0
片段：clip-path:polygon(100% 0,0 0,100% 100%)
      clip-path:polygon(100% 0,0 0,100% 100%)
      clip-path:polygon(0 0,100% 100%,0 100%)
```
源码 **4 行**（`styles.css:669` `-webkit-…`、`:670` `clip-path:…`、`:1050`、`:1602`）= **3 条规则**（前两行是同一规则的 `-webkit-`/标准对，压缩后被合并为 1 处标准声明）。
**「源码 4 处 → 产物 1 处」不成立；正确是「源码 4 行（3 条规则）→ 产物 3 处」**，三条分别是 `.badge-gift::before`（礼品绶带）、`#section_gift .point-badge`（三角角标）、`.badge::after`（徽章缺角）——与作者 §5.1 的清单**一致**。
另：改前产物为 **5 处**（多出 `.btn` 切角 ×2），差 = 2 = 本单收掉的切角数。（`-webkit-clip-path:polygon` 改前 1 处、改后 0 处。）

### 6.2 作者 §3④：`.btn-md`「改前 `clip=polygon` / `r=0px`」——**过度概括**

同一选择器上**存在两类实例**（我逐实例读数）：
- 旧语义 `… btn btn-md btn-proceed`：`clip=polygon(…)`、`r=0px` → **`clip=none / r=9px`** ✅
- A 系 `… btn btn-md`（Button.jsx 新族）：**改前已是 `clip=none / r=8px`**，改后**不变**。

⇒ 作者那条结论对「旧语义钮」成立，对「`.btn-md` 全体」不成立。**方向与我一致，只是作用域写宽了**。（另注：`styles.css:185` 有 `.btn.btn-md { border-radius: 9px }` 的更高优先级规则，故其实例半径改前亦为 9px，不是 0px。）

### 6.3 `.sf-tabbar` 本身**未被收敛**（作者列进施工面但读数未变）

作者 §1.4 把 `.sf-tabbar` 列为「旧形状：1px 上描边（**直角、无形状语言**）」施工面之一，§6 结论称「四类…的形状语言已收敛」。
实测：`.sf-tabbar` `border-radius` 改前 = 改后 = **`0px`**，`border-top` 改前 = 改后 = **`1px`**（6 页 × 2 档）。
源码 `shell.css:63-68` 里 `.sf-tabbar` 只有 `display:none / background / border-top / box-shadow:none`，**无 `border-radius`**。
⇒ 真实收敛发生在 **`.sf-tab` 子项**（`0px → 8px`）与 `ui/Tabs` 的 trigger（`6px → 8px`）；**「Tab 栏」作为容器保持直角**。这与「全宽容器加圆角无意义」的设计直觉一致，**不判缺陷**，但作者 §3④ 表里确实**没有 tabbar 行** ⇒ 应显式登记为「列而未动」，而不是归入「已收敛」。

### 6.4 作者 §5.5 / §5.6 的两条「NOT_MEASURED / 无变化」——**实测均不成立（且是低估交付）**

作者原话（§5.5）：
> 「`ui/Card` 的 computed 读数改前 = 改后 = `radius 0px / border 0px / shadow 0 4px 6px -1px,…` ⇒ **该改动在页面上无实测变化**」
> 「`ui/Tabs` 的 `button[class~="px-3"][class~="py-1.5"]` 在实测四页**均 0 命中** ⇒ 这两族 `NOT_MEASURED`（页面未渲染到）」

我用**类签名选择器 + 全 DOM 普查**（10 页 × 日/夜 × {1280, 1440}）实测：

**`ui/Card`（`div.rounded-lg.border.p-6`，`Card.jsx` 输出；`AuthPage.jsx:6` 经 barrel 真实 import）**

| | 改前（B） | 改后（A） |
|---|---|---|
| 命中总数 | `div[class~="rounded-xl"]` = **64**、`[class~="border-2"]` = **64** | **0**、**0** |
| `radius` / `border` / `shadow` | `12px` / `2px solid rgb(229,231,235)` / `rgba(0,0,0,0.05) 0px 1px 2px 0px` | **`8px` / `1px solid …` / `none`** |
| 渲染页面（命中数） | `/login` 2、`/register` 2、`/` 2、`/task` 5、`/reward` 5 | 同 |

**`ui/Tabs` 的 `TabsTrigger`（`button.rounded-lg.px-3.py-1.5`）**：改前/改后各 **32 命中**（`/task` 4 + `/reward` 4，× 日/夜 × 2 宽度 × 2 页）。读数：**`radius 6px → 8px`**；选中态 `shadow rgba(0,0,0,0.05) 0 1px 2px 0px → none`。

⇒ **结论**：`ui/Card` 与 `ui/Tabs` 的改动**在页面上确实生效且可测**。作者 §5.5 的「无实测变化」被推翻（其 `radius 0px / border 0px` 读数与真实渲染元素不符，疑为选择器打到了别的节点，如 `[class~="border-gray-200"]` 这类只给颜色不给宽度的类）。
**处置**：这是**低估**而非多报 —— 按派单方口径「不判负，原样登记 + 给读数」。

### 6.5 作者 §5.6：「描边宽 1.5px → 1px 的可见差 `NOT_MEASURED`」——**已补测，Chrome 上差值为 0**

我先做**尺子标定**（孤立页面，`border: Npx solid #000`，`deviceScaleFactor=2` 与 `3`）：

| 声明 `border-width` | `getComputedStyle().borderTopWidth` | DPR=2 暗游程 | DPR=3 暗游程 |
|---|---|---|---|
| `0.5px` | `1px` | 2 设备 px | 3 设备 px |
| `1px` | `1px` | 2 设备 px | 3 设备 px |
| **`1.5px`** | **`1px`** | **2 设备 px** | **3 设备 px** |
| `2px` | `2px` | 4 设备 px | 6 设备 px |
| `3px` | `3px` | 6 设备 px | 9 设备 px |

⇒ 该 Chrome **把 border-width 吸附到整数 CSS px**（DPR 无关）。因此：

- 源码/产物层的改动是**真的**：`shell.css` 改前 `border: var(--sf-st-stroke-w)`（token = `1.5px`）→ 改后 `var(--sf-st-stroke-w-thin)`（`1px`）—— 我用 `grep` 在**两份 dist** 上逐条核过（`--sf-st-stroke-w:1.5px` 两版都在，只是不再被 `.sf-card` 消费）。
- **像素级差异 = 0**（Chrome，DPR 1/2/3）：`.sf-card` 左侧描边暗游程 **改前 2 设备 px、改后 2 设备 px**（`clip` 稳定帧；RGB 序列 `…253,232,21 | 3,4,2, 3,4,2 | 255,255,255…` 前后逐字节相同）。
- **残留意义**：在**不吸附小数 border** 的引擎（部分 Firefox/WebKit 版本）或打印/PDF 栅格化路径上，1.5px 与 1px 会有可见差；本单的 1.5→1 在 Chrome 上是**清账**而非**视觉变更**。**登记为已测（Chrome 上 0），跨引擎 = NOT_MEASURED**。

### 6.6 作者 §3⑤「切档 rect diffs = 0（keys=116）」

我自建采样集（16 必需类 + 14 家族补采样，6 页 × 日/夜）得 **keys = 92 / diffs = 0**（改后），**改前同样 keys = 92 / diffs = 0**。
⇒ 结论同向；键数不同（采样集不同，非矛盾）。「改前也应为 0」已独立验证 —— 但**单凭这一点不能证明探针有效**，故 §3 的变异判负才是本项成立的前提。

---

## §7 run-tagged 产物清单（`backend-ts/.p6bqa-artifacts/`）

| 文件 | 内容 |
|---|---|
| `L1-build-after.txt` / `L1-build-before.txt` | 两版 `vite build` 全输出（exit 0；CSS 124,953 B / 124,962 B） |
| `L1-testunit-after.txt` | `vitest run src/test/unit` 全输出（26 files / 238 passed） |
| `L1-script-{p6-tr2-i18n-locales,p4z-i18nviol-global,p4z-feperf-safelist,p4z-miscfix-links}.txt` | 四脚本 stdout + 总判行（各自 pipe 外取码） |
| `L2-shape-before.json` / `L2-shape-after.json` | 改前/改后逐类 computed + rect 原样 JSON（6 页 × 2 档） |
| `L2-shape-diff-table.txt` | §2 的 244 行逐实例对照表 |
| `L2-feedmock-before.json` / `L2-feedmock-after.json` | mock `/api/prize/all` 后 `.sf-listings-{card,price,tag}` 真渲染读数 |
| `L3-theme-iso.txt` | 切档 rect 对照（改前/改后均 keys=92 diffs=0） |
| `L4-negctrl-shape.json` / `L4-negctrl-build.txt` | **变异判负**：变异后 dist 的读数（13px / polygon 被抓出） |
| `L4-negctrl-restore-build.txt` | 复原后重建（产物 hash 回到 `index-mRq3HT-x.css`） |
| `L5-prod-css-index-mRq3HT-x.css` | prod 拉取的产物存档（sha256 与本地相等） |
| `L6-census-before.json` / `L6-census-after.json` | 全 DOM 形状普查（10 页 × 日/夜 × {1280,1440}：`clipPath!=none` 计数、`boxShadow!=none` 清单、类签名命中） |
| `L6-census-summary.txt` | 上述普查的人读汇总 |
| `L6-uibase-before-after.txt` | **§6.4**：ui Card / ui Tabs / ui Input 三族 改前 vs 改后 |
| `L6-states-after.json` | hover / focus / active 态读数（8 类 × 12 页档） |
| `L6-px-before.json` / `L6-px-after.json` | §6.5 描边像素游程（含稳定帧标记） |
| `L6-px-calibration.json` / `L6-px-calibration-dpr3.json` | 尺子标定（0.5/1/1.5/2/3 px，DPR 2 与 3） |
| `L7-widths-after.json` | 6 页 × 2 档 × 3 宽度 的 `innerWidth` / 横向溢出 |

探针源码（scratch，非仓内）：`/Users/kevin/.hermes/profiles/zang/cache/scratch/qa-probe/{probe,probe2,probe3,pxprobe,pxcal}.mjs`。

---

## §8 结论与理由（逐条）

**verdict = 可用**

1. **硬门全过且未注水**：`build` 两版均 exit 0；单测 **26 files / 238 passed**（与作者自报逐值相同，未减少、未放宽）；四脚本 pipe 外取码全 **0**。
2. **改动是真的、方向一致、范围可控**：13 个可渲染目标类上，改前→改后的 `border-radius / box-shadow / clip-path` 三个通道独立复现（含派单方点名的 `.sf-chip 999px→8px`、`.sf-price 夜 0px→8px`、`.btn* clip polygon→none / r 0→9px` 三条，全部**复现**）。
3. **读数有灵敏度**：变异判负实验里探针**必然报出**旧值（`13px` / `polygon(…)`），复原后逐字节回绿（sha256 三方相等，含 prod）。
4. **线上 = 本地**：prod CSS 与 `9284fc1` 构建产物 **sha256 逐字节相同** ⇒ 线上确实是改后形态，且改进域与 revision 一致。
5. **无副作用**：DOM 节点数前后逐值相同；布局 rect 改前改后相同（mock 数据下逐实例比对）；两档几何同构 diffs=0；三宽度 36/36 `innerWidth` 断言通过、横向溢出 0。
6. **无判负项**：唯一需要跟进的 3 处是**报告表述与计数**（§6.1 计数错、§6.2 作用域写宽、§6.3 列而未动），以及**2 处作者低估**（§6.4 ui 基础件其实生效）。均为**文档层**问题，不影响产物。

**未达「完全无条件可用」的两点保留**（不改变 verdict，但需在册）：
- 生产站的**交互态与几何**未在线取（§5-⑥）；本报告的线上结论只到 **CSS 字节层**。
- `backend-ts/.p7a-artifacts/` 等并发写者正在改同一仓 —— 任何「以活工作区为准」的复核都可能得到不自洽读数；本报告全部读数**只认固定副本**。
