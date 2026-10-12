# v1.15 §19 · `/item/:id` 详情页 UI 改造（变体 A）· 证据链

**提交面**：`frontend/src/pages/item/ItemDetailPage.jsx` · `frontend/src/pages/item/item.css` ·
`frontend/src/shell/BottomTabBar.jsx` · `frontend/src/styles.css`（+ 本目录）。
**基线 commit**：`fa6a953`（本目录读数全部相对它；`git diff` 只含上述 4 个文件）。

> ⚠️ **入库机制说明（如实登记）**：本目录被仓内 `.gitignore:342` 的通用规则 `**/.*-artifacts/`
> 命中（`git check-ignore -v` 实测命中）。它是仓内 `frontend/` 下的**既有命名约定**
> （同形已跟踪目录 = `frontend/.p7cqa-artifacts/` `.p7dqa-artifacts/` `.p7eqa-artifacts/`）。
> 为满足「证据随提交入库」，本目录以 `git add -f` 入库（与上述三个同类已跟踪目录同机制）。

## 采数树与端口（受控实例，未碰 5787/5788/5800/5555/5191）

| 读数 | 采数时树 | 实例 |
|---|---|---|
| `sig.*` `sig2.*` `widths.*` `ac6.*` `dn.*` `final.*` | 上一轮（**R-F 之前**、最后两处 CSS 编辑之后） | 5792 AFTER / 5793 BEFORE（worktree `kong-wt-a111b45`，**已由 Zang 回收**） |
| `final-rf.*` `footer-occl.*` `footer-occl-ctf.*` | **本单最终树**（含 R-F） | 5792 AFTER（`vite-controlled-5792.config.mjs`，隔离 `cacheDir`） |
| `baseline-unit.*` `final-unit.*` `final-build.*` | 基线 = `fa6a953`（`git stash` 后）／最终树 | 本机 `npm run build` / `npm run test:unit` |

`sig2.out.txt` 为空、`sig2.err.txt` 记 `browserContext.close: Target page, context or browser has been closed`
（第二轮签名复跑时浏览器被关闭）⇒ **该次复跑未产出读数，如实登记**；签名主读数以 `sig.*` 为准。

## 门套（本单最终树，逐字）

- `frontend && npm run build` ⇒ **exit 0**（`final-build.out.txt`）。
- `npm run test:unit` ⇒ **51 files / 494 tests / 0 failed，exit 0**（`final-unit.out.txt`）；
  自取基线（同机、`fa6a953`）= **51 files / 494 tests / 0 failed，exit 0**（`baseline-unit.out.txt`）
  ⇒ **差 = 0（逐项相同：文件数 51 = 51，例数 494 = 494，失败 0 = 0）**。
- i18n 节点数 = **4180 = 1045 × 4**（`final-unit.out.txt` 内 `[I18N-VIOL]` 行，逐字）。
- 产物自证：`dist/assets/index-DX7K7ysY.js` 含 `重复点击不会重复扣款`（R-F 真进产物）。

## R-F（本单新增）· `item.buyNote` 保留渲染

- 落点 = `.sf-item-meta-group` 内、`priceServerNote` 与 `refundStockNote` 之间，`.sf-item-meta` 同形一行。
- **locale 四语键一字不动**（本单未触碰任何 `src/locales/*.json`；四语计数 122 / 1045 / 4180 不变）。
- 渲染自证（`final-rf.json` → `ac1.<w>.texts`）：三个宽度均**新增且仅新增**该键文案：
  - `320`：`购买金额由平台结算…` 之后 = `购买金额以平台结算为准；重复点击不会重复扣款。` `退款只退还款项…`
  - `390` / `1440` 同。
- 节点数差（= +1 行 `p`，三档一致，强一致自证）：`ac6` 320 `70 → 71` · 390 `70 → 71` · 1440 `112 → 113`（日/夜同增）。

## R-E · 页脚底部内边距（Kong 自取读数；**结论含一处与裁定前提不符，如实登记**）

`footer-occl.out.txt`（最终树，原口径）与 `footer-occl-ctf.out.txt`（R-E 反事实对照）：

| 宽度 | R-E | `footCoveredPx`（**footer 盒 ∩ 固定操作栏 盒**） | footer 内最后可见叶子 bottom | `lastLeafCovered` | 叶 ∩ 操作栏带 |
|---|---|---|---|---|---|
| 320 | 在 / 去 | **61 / 61** | 708 / 768 | **false / true** | **0 / 29px** |
| 390 | 在 / 去 | **61 / 61** | 708 / 768 | **false / true** | **0 / 29px** |
| 767 | 在 / 去 | **61 / 61** | 708 / 768 | **false / true** | **0 / 29px** |
| 1440 | 在 / 去 | 0 / 0 | 767.5 / 767.5 | true / true | — |

**⚠️ 与裁定前提不符之处（不粉饰）**：裁定前提写「实测读数要证明 320/390 档 **`footCoveredPx` 61 → 0**」。
本单实测 **`footCoveredPx` 恒 = 61（R-E 在/去都一样）**。原因 = 该量是**盒交叠**
（`footer.getBoundingClientRect()` ∩ `actionbar.getBoundingClientRect()`），而页脚是文档末元素、
滚到底时其**盒底恒落视口底 800**；加 `padding-bottom` 只把盒内**内容**上推、不改变盒底
⇒ **该量对 padding 不敏感，不能作 R-E 的判据**（它是"操作栏高 = 61px"的同义反复，不是遮挡量）。
R-E 的实际效果由**内容级**读数证明：页脚内最后可见叶子 bottom **768 → 708**、
`lastLeafCovered` **true → false**、叶与操作栏带交叠 **29px → 0px**（320/390/767 三档一致）；
R-E 中性化 = 给 `.sf-region-foot` 打 inline `padding-bottom:0`（shell.css 对该元素**无任何 padding 声明**
⇒ 0 即无 R-E 的基线，实测 computed 值 60px → 0px 可验）。
1440 档 computed `padding-bottom = 0px`（R-E 正确地**不**命中 >767 档）。**接受与否由 Zang/Neng 依上面真读数裁定。**

## 其余既有读数（上一轮采，随本提交一并留证）

- `sig.*` —— AC-3 签名对拍（AFTER vs BEFORE worktree vs 反事实）。
- `widths.*` —— 320/390/768/1024/1440 五档几何（含 `overflowX` 零横向溢出硬门）。
- `ac6.*` / `final.*` / `final-rf.*` —— AC-6 日/夜（`same:true` 三档）· AC-1 渲染面白名单 · R-B 胶囊 999px ·
  NC1/NC2/NC3 判负自证 · R-C 长描述压测。`final-rf.*` = 最终树复采（R-F 已在）。
- `dn.out.txt` —— 日/夜差异元素清单（差异 = Header 主题钮图标 `moon` vs `sun`，属预期）。
- `probes/*.mjs` —— 可重跑探针（`AFTER=5792`；`measure-sig` / `measure-ac6` 另需 `BEFORE=5793`
  的父版 worktree，本单未重建 ⇒ 这两支**不可单独重跑**，其余均可）。
