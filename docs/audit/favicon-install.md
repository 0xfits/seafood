# 站点 favicon 安装（前端面）· R-9-46 · Kong 交件

- 仓库：`/Users/kevin/bistro/seafood`（**未 commit / 未 push / 未 `git add`**）
- 角色：Kong（前端品牌资产安装单）
- 锚点：开工 `git status` 于 main · HEAD `462203f` 对齐；收尾 `git status --short` 仅见本单三处（见 §⑤）
- 方案：Kevin 明选 **A = ① 忠实方案**（`favicon.svg` 逐字入库 + `<link>` 指 SVG + `favicon-32.png`/`apple-touch-icon.png` 栅格化 + 清旧引用）；**非** ②PNG 主链、**不做** svgo
- ★ **换件事实登记**：本单进行中 Kevin 换件（2026-10-03）——
  - **旧件**：`icon_d94d02.svg` · **336,432 B** · sha256 `cc10313ec3bd177aae28cd43e4e6e25480f83e157def4f418724fdae39a93d3b` · 774 `<path>` · 三色（`#fbd016`/`#fbce19`/`#090401`）· 做旧 grunge 纹理
  - **新件（唯一真源）**：`icon_77c2a5.svg` · **7,808 B** · sha256 `4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9` · **1** `<path>` + `<rect class="cls-1" width="128" height="128"/>` · 两色（底 `#fde815` / 形 `#090401`）· 无做旧纹理
  - 全文所有 sha256/字节断言 **已改用新件口径**；旧件已整体替换、仓库无旧件资产残留（§⑤-C/D）

---

## ① 资产入库（逐字，零重绘）

源件（新件，唯一真源）：`/Users/kevin/.hermes/profiles/zang/cache/scratch/favicon_in/icon_77c2a5.svg`
目标：`frontend/public/brand/favicon.svg`

| 断言 | 读数 | 判定 |
|---|---|---|
| `sha256` | `4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9` | ✅ = 交件口径 |
| 字节 | `7808` | ✅ = 7,808 |
| `cmp` 与源件 | `cmp: SAME` | ✅ 逐字一致（零重绘）|

现取命令读数：
```
frontend/public/brand/favicon.svg  bytes=7808  sha256=4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9
cmp <源件> frontend/public/brand/favicon.svg  ⇒  SAME
```

---

## ② 栅格化派生（非重绘）

因 IM 自带 SVG 渲染器对本件失败（`vector graphics nested too deeply 'cls-1'`）且**无** rsvg delegate ⇒ 用 macOS WebKit 渲染器 `qlmanage` 作高分辨率矢量栅格化基（**1024×1024**，对 128 viewBox = 8× ≈ density 768，**≥384** 达标），再经 Lanczos 下采样到目标尺寸；黄底**不透明**（`-background '#fde815' -alpha remove -alpha off`，输出 `PNG24`）。**未重绘、未改路径**。

栅格基读数：`geom=1024x1024` · `TL=srgba(253,232,21,1)`（=`#fde815` 不透明）· `C=srgba(9,4,1,1)`（=`#090401`）

| 文件 | 尺寸读数 | 字节 | sha256 | PNG 色彩类型 | Alpha |
|---|---|---|---|---|---|
| `frontend/public/brand/apple-touch-icon.png` | `180x180` | `9171` | `610535734c67ad46559008180e369b5d4239da330f2485cbd46338bd73ca683e` | `colortype=2`（RGB）| **无**（无 alpha / 无 tRNS）|
| `frontend/public/brand/favicon-32.png` | `32x32` | `1191` | `1448a817a27265537bf9d8dedd92fd4faf77604bd68babf066ef24bf8805d4b4` | `colortype=2`（RGB）| **无**（无 alpha / 无 tRNS）|

现取读数：
```
apple-touch-icon.png  geom=180x180 type=TrueColor alpha=Undefined depth=8  TL=srgb(253,232,21)  C=srgb(4,0,1)
favicon-32.png        geom=32x32   type=Palette  alpha=Undefined depth=8  TL=srgb(253,232,21)  C=srgb(22,16,2)
```
- **边缘无锯齿复核**：两 PNG 由 1024px 矢量基 + Lanczos 下采样产出；`favicon-32.png` 含 **170** 个不同颜色（黄↔黑之间存在抗锯齿过渡色阶），非硬边跳变 ⇒ 边缘平滑。

---

## ③ `frontend/index.html` 接线

**第 5 行**（旧）：`    <link rel="icon" type="image/svg+xml" href="/vite.svg" />`
**替换为第 5–9 行**（三条 `<link>` + 注释；旧 `/vite.svg` 引用已清除）：

```html
    <!-- 站点图标 · 真源：frontend/public/brand/favicon.svg · sha256 4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9 · R-9-46
         （旧引用 /vite.svg 指向不存在的 frontend/public/vite.svg，已清除） -->
    <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png" />
```

`git diff -- frontend/index.html`：
```
-    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
+    <!-- 站点图标 · 真源：frontend/public/brand/favicon.svg · sha256 4dc72e77… · R-9-46
+         （旧引用 /vite.svg 指向不存在的 frontend/public/vite.svg，已清除） -->
+    <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
+    <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
+    <link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png" />
```
- 注释含：真源路径 + sha256 + `R-9-46`。旧 `/vite.svg` **可执行引用**已清除（第 6 行仅存「已清除」说明性注释文字）。

---

## ④ 现取连带断言核验（C-1 纪律）

**扫描 A — p8 门禁脚本**：`backend-ts/scripts/p8-s1..p8-s9*.ts`（现取 28 个文件）
```
grep -rn -E 'index\.html|vite\.svg|rel="icon"|apple-touch|/brand/' backend-ts/scripts/p8-s*.ts
⇒ NO_HIT_p8_scripts（空读数）
```
**判定**：p8 脚本**无**任何对 `frontend/index.html`（行数/字符串/`<link>`/`vite.svg`）的断言 ⇒ 无需前推。

**扫描 B — 前端测试**：`frontend/src/test/**`
```
grep -rn -E 'index\.html|vite\.svg|apple-touch|/brand/|favicon' frontend/src/test/
⇒ 2 处命中（均读 index.html，均不涉 favicon 行/vite.svg）：
  frontend/src/test/unit/p4z-feperf.test.js:118-128
  frontend/src/test/unit/theme-shell-isomorphism.test.jsx:276-277
```
逐处给出处与兼容判定：
1. `frontend/src/test/unit/p4z-feperf.test.js:118` — 读 `index.html`，**剥除注释后**断言无 `cdn.tailwindcss.com`、无 `/<script[^>]*tailwind/i`、无 `/<link[^>]*tailwind/i`。本单新增三条 `<link>` 均不含 `tailwind` ⇒ **兼容，未删断言，无需改**。
2. `frontend/src/test/unit/theme-shell-isomorphism.test.jsx:276` — 读 `index.html`，断言 `expect(html).toContain('<title>Seafood</title>')`。`<title>` 未动 ⇒ **兼容，未删断言，无需改**。

**现取强证据（实跑）**：`npx vitest run p4z-feperf.test.js theme-shell-isomorphism.test.jsx` ⇒ **Test Files 2 passed · Tests 26 passed**。
**结论**：现取**无**针对 favicon 行 / `vite.svg` 的断言；两条现存 `index.html` 断言与本变更**兼容**（无前推改动；且本单硬口径禁改 `frontend/src/**`）。

---

## ⑤ 构建 + 受控实例读口

**构建**：`npm run build`（`vite v5.4.20`）⇒ `✓ built in 1.74s`，`dist/index.html 5.30 kB`。
`dist/brand/` 三件在场：
```
dist/brand/favicon.svg        bytes=7808  sha256=4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9  cmp<SAME>
dist/brand/favicon-32.png     bytes=1191  sha256=1448a817a27265537bf9d8dedd92fd4faf77604bd68babf066ef24bf8805d4b4
dist/brand/apple-touch-icon.png bytes=9171 sha256=610535734c67ad46559008180e369b5d4239da330f2485cbd46338bd73ca683e
```
`dist/index.html` 第 7–9 行为三条 `/brand/*` 引用，第 5–6 行为 R-9-46 注释 ⇒ **引用一致**。

**受控实例**：`vite preview` 因内建 SPA 回退会把 `/vite.svg` 兜底成 `200 text/html`（非真 404）⇒ 改用**严格静态服务**（`python3 -m http.server`，对缺失文件真 404，`.svg→image/svg+xml`、`.png→image/png`）服务于 `dist/`，**端口 5796（独占监听：`lsof` 仅见 `Python 1381 … 127.0.0.1:5796`）**，逐条读数：

| 路径 | `%{http_code} %{content_type} %{size_download}` | 判定 |
|---|---|---|
| `/brand/favicon.svg` | `200 image/svg+xml 7808` | ✅ 200 · image/svg+xml · 7808 |
| `/brand/favicon-32.png` | `200 image/png 1191` | ✅ 200 |
| `/brand/apple-touch-icon.png` | `200 image/png 9171` | ✅ 200 |
| `/vite.svg` | `404 text/html;charset=utf-8 335` | ✅ **404**（旧引用已清）|

下载物身份对拍：
```
/brand/favicon.svg          下载 bytes=7808  sha256=4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9  cmp<源件> SAME  ← 逐字一致
/brand/favicon-32.png       下载 sha256=1448a817… == brand/favicon-32.png sha256  ✅
/brand/apple-touch-icon.png 下载 sha256=61053573… == brand/apple-touch-icon.png sha256  ✅
```

**收尾**：精确 PID `kill -TERM` 逐一收口本单全部实例——vite-preview(5796) `98344`/`98728` · python-5797 `99007` · python-5796 `1381` ⇒
```
lsof -nP -iTCP:5796 -sTCP:LISTEN      ⇒ 5796 EMPTY（本单监听者全部回收）
lsof -nP -iTCP:5797 -sTCP:LISTEN      ⇒ node 99827 `*:5797`（= 兄弟 agent 后端 `ts-node src/index.ts`，非本单进程，未动）
lsof -nP -iTCP:5787-5788 -sTCP:LISTEN ⇒ 仍为他人进程（30475/65096），未动
```

**残留扫描（全仓，本单换件强制项）**：
```
A. find . -type f -size 336432c（excl node_modules/.git）  ⇒ NO_FILE_OF_336432（旧件资产零残留）
B. grep -rn 'cc10313e…'                                    ⇒ 仅命中 docs/seafood.master-plan.md:1439 / :5349
   （= master-plan 里旧件口径的**历史规范记录**；该文件在本单禁止触碰清单内，未改）
C. find . -name 'favicon.svg' -o -name 'vite.svg'          ⇒ 仅 frontend/public/brand/favicon.svg + frontend/dist/brand/favicon.svg（皆新件 7808）；无 vite.svg
D. frontend/public/brand/ = favicon.svg(7808) · favicon-32.png(1191) · apple-touch-icon.png(9171) · logo.svg
```

**改动面（`git status --short`，未 `git add`）**：
```
 M frontend/index.html
?? frontend/public/brand/apple-touch-icon.png
?? frontend/public/brand/favicon-32.png
?? frontend/public/brand/favicon.svg
?? docs/audit/favicon-install.md
```

---

## ⑥ 未测项逐项原因

| 未测项 | 原因（非 0/空）|
|---|---|
| 生产/Vercel 线上的 favicon 读口 | 本单不部署、不 push（用户可见面，验收后统一提）⇒ 未对生产域名取样 |
| 浏览器标签页**视觉**渲染（Chrome/Safari 真屏显示）| 无浏览器渲染断言工具纳入本单；已用「字节 + HTTP + PNG 色彩类型 + 抗锯齿色阶」等价取证，未做像素级视觉比对 |
| `vite preview` 下 `/vite.svg ⇒ 404` | `vite preview` 内建 SPA 回退把未知路径兜底为 `200 index.html`，**无法**产出真 404 ⇒ 改用严格静态服务（5797）取证；此为工具语义差异，已如实登记 |
| `apple-touch-icon.png` 在真 iOS 主屏的显示效果 | 无 iOS 真机/模拟器接入本单；仅验证文件尺寸 180×180、不透明、200 读口 |
| svgo / 透明底 / PNG 主链方案 | Kevin 明选 A（忠实方案），明确**不做** svgo、不用透明底、不切 PNG 主链 ⇒ 主动不测 |
| `frontend/src/test/**` 其余测试全量回归 | 本单禁改 `frontend/src/**`；仅跑与 `index.html` 直接相关的 2 个文件（26 用例全绿），未跑全量套件 |
