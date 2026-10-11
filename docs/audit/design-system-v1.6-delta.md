# design-system.spec v1.6 delta（小补丁单 · Zang 裁定⑦ · 2026-10-11）

> **性质**：**只追加 / 就地更正并留痕**（`git diff --numstat docs/design/design-system.spec.md` ⇒ **`239  0`**，**删除列 = 0**）。**未动 `frontend/**`、未动 `ctrl/**`、未启停任何服务**。姊妹册 = `docs/route-layer.spec.md` v2.27（**本单确认无需同步**，见 D4）。

## D0 元信息（开工 / 完工现取）

- **开工版本 = v1.5**：行 `1,204` / 字节 `188,613` / md5 `23957167410322920fed75c8c57124b1`。
- **完工版本 = v1.6**：行 `1,213` / 字节 `196,445` / md5 `51475b46117d6dc4f986408cf6b6de43` / sha256 `112b5ae511cf5e0f419753b9e207d244db92a33c1fcc39b18251c741a25dc157`。
- **字节增量 = +7,832**；**行增量 = +9**。
- `git diff --numstat`：**`241  0`**（**删除列 = 0** ⇒ 满足「只追加」硬口径；全部就地更正均落在 v1.5 新增的 §14 区块内 / 顶部与 §12 新增行内，相对 HEAD 仍计为新增行）。
- 快照：`docs/versions/design-system.spec.v1.5.md`（**本单新建**，`cmp=0` = 开工时点正文逐字节副本；md5 `23957167410322920fed75c8c57124b1`，与 v1.5 delta 的「完工版本 = v1.5」md5 逐字一致 = 互证）。

## D1 逐条 delta（输入 → 落点）

| # | 输入（依据锚点） | 改动点 |
|--:|---|---|
| ① | **Zang 裁定⑦**：底栏①文案 = Kevin 指定「海鲜市场」；实现 `labelKey:'home'` ⇒ `t('home')`（唯一消费点 = `nav.js:15`）现值 = 首页/Home/首頁/Trang chủ ⇒ 不满足指定文案 | **`home` 值变更**：zh「海鲜市场」/ en「Seafood Market」/ hk「海鮮市場」/ vn「Chợ hải sản」 |
| ② | i18n「值变更键」由 1 键（`shard`）补为 2 键（`shard` + `home`） | 顶部现行版块 + §12 v1.6 行 + §14 节目注 + §14.0 裁定⑦留痕 + §14.4（★ 补注：`home` 值变更非路由变更，底栏目标集不变）+ §14.5（新增行 32 + ★ 现取结论）+ §14.6 第 14 行 + §14.7「四语键集逐文件相同」行 + §14.10 B（标题就地更正「改 1 值」⇒「改 2 值」+ 新增 `home` 行）+ §14.10 尾计数注 |
| ③ | 值变更 = +0 键 ⇒ 计数不变 | §14.10 尾：顶层 `119⇒128` / 拍平 `1050⇒1070` / 四语节点 `4200⇒4280` **逐字不变** |
| ④ | nav 文案断言影响（现取，不猜） | §14.5 第 32 行 + ★ 现取结论块 |

## D2 关键现取结论（`home` 值变更的断言影响）

- **「凡断言 nav 文案为「首页」的用例」= 现取为「无」**。
- 命令：`grep -rn "首页" frontend/src/test --include='*.js' --include='*.jsx'` ⇒ **命中 5 行、全为注释**：`listing-market.test.jsx:234` · `lang-path-redirect.test.jsx:218` · `i18n-content-wiring.test.jsx:235` · `ledger-flow-behavior.test.jsx:88,148`（**无一条断言底栏①文案**）。
- `home` 键消费点现取：**唯一 = `frontend/src/shell/nav.js:15`**（`labelKey:'home'`；非测试面）。
- 旁证：唯一 locale-文案类断言 = `theme-shell-isomorphism.test.jsx:266-267`（`siteTitle` = `Seafood 海鲜市场`）**与本键无关**；`:106-107` 断言的是 **key 集字面**（`'home'` 为 key、非文案）⇒ **不受值变更影响**（其改锚只源于 `T80` 键集变更）。
- ⇒ `home` 值变更 **不挂任何测试、无需改锚**；`home` 值由 Kong 落地 `frontend/src/locales/*.json`。

## D3 承载位置（新增 / 就地更正）

- 顶部「★ 现行版 = v1.6」块：**插在 v1.5 现行版行之后**（新增）。
- §12 变更记录 v1.6 行：**插在 v1.5 行之后**（新增）。
- §14 节目注「★ v1.6 补登」：**插在「本节目性质」行之前**（新增）。
- §14.0 裁定⑦ bullet（新增）；§14.5 第 32 行 + ★ 结论块（新增）；§14.10 B 新增 `home` 行（新增）。
- §14.10 B 标题 / §14.6 第 14 行 / §14.7 行 / §14.10 尾：**就地更正 + 原文逐字留痕**。

## D4 route-layer.spec 同步判定（结论：无需同步）

- `route-layer.spec.md` v2.27 §37 只承载**页面路由登记**（`/messages` 等路径），**不含任何「底栏①文案」（`home` 值）**。
- 现取：`grep -nE "底栏第|首页文案|'home'|\"home\"" docs/route-layer.spec.md` ⇒ 命中均为**权限 / `siteTitle` / 首页分流**语境，**无「底栏①文案」条目**。
- ⇒ **`home` 值变更不改变任何路由 ⇒ `docs/route-layer.spec.md` 无需同步**（与 v1.5 的 `shard` 值变更一致：值变更不落 route 册）。

## D5 纪律自检

① **只追加 / 删除列 = 0** ✅（numstat `239 0`）｜② **未动 `frontend/**` / `ctrl/**`** ✅｜③ **未启停任何服务**（**未 `pm2 restart`**）✅｜④ **未 `git add -A` / 未 commit / 未 push** ✅｜⑤ **未发明项**（`home` 四语值 = Zang 裁定⑦ 指定；未发明路径/数值）✅｜⑥ **未测项 = `NOT_MEASURED` + 原因** ✅。
