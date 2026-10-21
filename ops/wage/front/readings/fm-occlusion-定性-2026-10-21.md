# wage 探针 390「sf-fm 拦截」定性读数（2026-10-21）

## 结论

**定性 = 探针问题（不是 390 真机 UX 重叠，也不是 padding-bottom 类缺陷）。修复 = 探针侧，产品码零改动。**

1. **390 档（父派单的前提）实测不成立**：`nav.sf-fm` 在 ≤767 断点 `display:none`（shell.css 唯一 767 块），
   390×844（含 isMobile/hasTouch 手机形）下 `fmRect` 全零、**每张卡主按钮（加入/领工资）与编辑钮相交数 = 0**，
   横向溢出 0、页底 padding-bottom 已有 26px。390 结构上不可能被 sf-fm 拦截。
2. **真实拦截发生在 1536×960（探针主档）**：TimeoutError 在 probe-wage.mjs 的 E4b（修前 line 794）——
   点**最后一张卡（110）的卡头【编辑】钮**（非父派单猜的「joined 卡【领工资】」；110 是 owner 臂卡、
   编辑钮在卡头右侧）。实测 `sf-fm` = fixed · top:45% · 右缘 16px · 72px 宽 ⇒ 矩形 x[1448,1520] y[192,672]；
   卡【编辑】钮 x≈1455–1501，105/110 两张卡在**任何滚动位**都被盖住（文档仅 ~74px 可滚，
   「scrollIntoViewIfNeeded 后再点」无解；主行动钮 x≈1239–1293 **恒不相交**）。逐值读数 =
   `wage-fm-overlap-measure.json`（1536/390 × scroll0/scrollBottom/E4 复刻/SIVI 全矩阵）。
3. **该相交不判产品缺陷的依据**：Kevin 2026-10-11 已裁「T85 桌面 gutter 整体撤除」（曾为「fm ∩ 正文 = 0」
   给 `.sf-route-container` 加过 140px 右内边距，撤除后**悬浮菜单与正文相交 = 已知接受、只登记不当 FAIL**；
   留痕 = frontend/src/styles.css「T85 桌面 gutter 已按 Kevin 口径撤除」注释块）。若要为**可交互元素**
   恢复避让（gutter / 移钮），是口径变更，须 Kevin 另裁——本单只登记。

## 修复（全部探针侧）

- `ops/wage/front/probe-wage.mjs`：
  - 新增 `clickCardControl()`：目标中心未被 sf-fm 盖住 ⇒ **Playwright 普通点击**（全量 actionability 检查）；
    被盖住（T85 已知接受）⇒ 页内 `Element.click()`（React onClick 照常触发；等价键盘激活路径；
    **非 force**——force 的鼠标坐标会落在浮层上、反而点不中）；逐条登记 `states.fm_click_registry`。
  - 仅 ⑦ E4 臂的 7 处卡内控件点击改走该 helper（E1/E2/倒计时/客态臂原样：实测不遮）。
  - 夹具修正（修 mock，非产品修正）：行 104 币对 `1/0` → `null/null`——`wage_cid=1` 撞 validateEdit 的
    「Number(cid)===1 ⇒ errCurrencyInvalid」，保存在校验段即中断 ⇒ PATCH 恒 0、E4c 三判据假红
    （E4c 是首个提交该行的臂）。断言一字未动。
- `ops/task-bounty/probe-project-form.mjs`：复跑 exit 0（20/20 绿）后，把 console 里 5 条 `net::ERR_FAILED`
  **显式定性为 mock 拦截设计**——全部来自外链字体/样式 CDN（Google Fonts / cdnjs font-awesome /
  jsDelivr SmileySans），被探针离线口径按设计 abort（hostname ≠ sf.local ⇒ route.abort，requestfailed
  逐条对上）⇒ verdict 加 `console.onlyAbortedExternalCdnErrors` 加严断言（其余 console error 仍判负），
  留痕 `consoleErrorsAttribution`（21 判据全绿）。

## 门套与复跑

- `probe-wage.mjs` 复跑 = **exit 0 · pass=true · 124/124 判据**（修前 116 必红 3 + 崩溃；判据零删减，
  E4 8 条全绿）⇒ `probe-result.json`；修前崩溃证据 = `probe-fm-intercept-prefix.log`。
- `probe-project-form.mjs` 复跑 = **exit 0 · 21/21** ⇒ `../../task-bounty/readings/probe-project-form-result.json`。
- 页面 console 的 ERR_FAILED（两探针同源）= 上述外链 CDN abort，已定性忽略；pageerror 两探针均 0。
- test:unit / build 读数见同目录 `unit-fm-occlusion.log` / `build-fm-occlusion.log`。

## 遗留（不属本单、供 Kevin 裁量）

- 1536 档卡【编辑】钮（105/110 两卡）被悬浮菜单永久遮挡：键盘可达（Tab+Enter），指针不可达。
  平台口径是「相交=已知接受」；若要改，属 T85 口径重开（gutter / 编辑钮换位 / fm 让位），另立单。
