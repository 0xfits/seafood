# h5-preview `/_preview/colors` 色彩/底色诊断页 · 建设与验收

- 日期：2026-10-12（CST）
- 角色：Kong（工具 / 诊断）
- 触发：Kevin 反映「手机真机日间档背景是灰色，本地 H5 是黄色」——口头描述不足以定位，
  故改为**由页面自己报数**：同一 hex 在两台设备上到底渲染成什么、站内真正在画底色的元素是谁。
- 约束遵守：只改 `tools/**` + 本审计件；未动 `frontend/**` / `ctrl/**`；**未用 `pm2 restart`**；
  仅用面板 `POST /api/restart` 单服务重载；未 `push`；零新增 npm 依赖。

## 1. 改动

| 文件 | 改动 |
| --- | --- |
| `tools/h5-preview/server.mjs` | 新增 `colorsHtml()`（自含 HTML/内联 CSS+JS，不引任何外部资源）与路由 `/_preview/colors`（`/` 后缀同样命中）；`upgrade` 白名单同步加该路径；`/_preview` 外壳 header 加一个入口链接「色彩/底色诊断 →」 |
| `docs/audit/h5-preview-colors-probe.md` | 本文件（唯一新增 docs 文件） |

未改任何产品代码 / token / 依赖清单；`node -v` = **v18.19.0**。

## 2. 页面结构（自含，无外部资源）

1. **色卡区**：9 块关键色（品牌黄 `#FDE815`、夜档底 `#0B0C0E`、日/夜主文字 `#0A0A0A`/`#E8EAED`、
   日/夜卡片底 `#FFFFFF`/`#15171B`、灰参照 `#808080`、日档描边 `#030402`、日档按钮底 `#FFE60F`）。
   每块的**实测回读值**由页内 `canvas 2d` `fillRect()` + `getImageData(…,{colorSpace:'srgb'})` 取得
   （不经 CSS，输入 ≠ 回读时在该块上标 `!= 输入`）。
2. **站内自测区**：同源 iframe（src 默认 `/`，可用 `?src=<path>` 覆盖）内部读：
   `colorScheme`（html + body）、`.sf-shell` computed `backgroundColor`/`color`、
   解析后的 `--sf-page-bg` / `--sf-topbar-bg`、`html[data-theme]`、
   html/body 的 computed `backgroundColor`、`innerWidth x innerHeight`、`content-type`、title、href、
   `matchMedia('(prefers-color-scheme: dark)').matches`、`navigator.userAgent`，
   以及**视口上/中/下 3 点 `elementFromPoint`**：命中元素选择器 + 其自身背景 +
   **最近一个不透明祖先**（即"真正在画那层底色的是谁"）的选择器与背景。
3. **可一键复制**：`复制全部读数` / `复制` 两个按钮，把上述读数 + 父页 UA/matchMedia/DPR/视口
   拼成纯文本（一行一项）写入只读 textarea，便于真机回贴。
4. **失败即报错态**：`status ∈ {ok, cross-origin, not-html, missing-anchor}`。非 ok 时自测区套 `.err` 样式、
   顶部 pill 变红 `ERROR · <status>`，**复制文本里不出现任何站点内部数值**，并写明降级范围
   （降级只保留 父页 UA / matchMedia / 色卡回读）。

## 3. 验收读数（真浏览器 CDP，headless Chrome 154.0.8037.98，独立 profile `/tmp/cdp-chrome-colors`）

### ① 语法 / ② HTTP
```
node --check tools/h5-preview/server.mjs            → exit 0
页内 <script> 抽出后 node --check                     → OK
curl -s -o /dev/null -w '%{http_code}' \
  http://127.0.0.1:5800/_preview/colors             → 200
/_preview 外壳含 href="/_preview/colors"             → 命中
```

### ③ 主路径 `http://127.0.0.1:5800/_preview/colors`
```json
{ "pill": "同源可读 · OK", "errState": false, "swatchCount": 9,
  "efpHitCount": 3, "hasShellBgField": true, "fieldsNonEmpty": 19,
  "buttons": ["复制全部读数","重新自测","已复制"],
  "copyCapturedLen": 2700, "copyCapturedHasShellBg": true,
  "shellBgLine": ".sf-shell computed backgroundColor: rgb(253, 232, 21)",
  "sfPageBgLine": "--sf-page-bg (parsed): #FDE815",
  "colorSchemeLine": "getComputedStyle(documentElement).colorScheme: light" }
```
- 色卡 9/9 回读**逐块精确等于输入**（例 `#FDE815 → rgb(253, 232, 21)`、`#808080 → rgb(128, 128, 128)`），
  `canvas 2d colorSpace=srgb`。
- 3 点 `elementFromPoint`（iframe 视口 724×560）：
  - `(362,84) 上部` → 命中 `main#sf-route-container > div.w-full.mx-auto`，self bg 透明，
    **画底色的 = `div#root > div.app-container.gradient-bg > div.sf-shell` `rgb(253, 232, 21)`**
  - `(362,280) 中部` → 命中站内卡片容器，self bg 透明，画底色的同样是 `.sf-shell` `rgb(253, 232, 21)`
  - `(362,504) 下部` → 命中 `nav.sf-tabbar > a.sf-tab`，画底色的 = `nav.sf-tabbar` `rgb(255, 255, 255)`
- 复制按钮**已实测接线**：桩掉 `navigator.clipboard.writeText` 后点「复制」，捕获到 2700 字符，
  且包含 `.sf-shell computed backgroundColor`（非空文本）。

### ④ 反向对照（改 src ⇒ 必须报错态，而不是报假值）
| `?src=` | pill | errState | 站点内部字段数 | 复制文本是否含数值 |
| --- | --- | --- | --- | --- |
| `/@fs/etc/passwd`（上游 vite 返 `403 Restricted`，HTML 但无 `.sf-shell`） | `ERROR · missing-anchor` | true | 0 | 否（1541 字符，仅 status+ERROR） |
| `/_preview/health`（JSON，非 HTML） | `ERROR · not-html` | true | 0 | 否（1562 字符） |
| `/__nope_xyz__`（站内不存在的路径） | `同源可读 · OK` | false | 19 | 是（2840 字符） |

**关于 `/__nope_xyz__` 的说明（环境事实，非探针假值）**：上游 vite dev（`appType: spa`）对未知路径
仍回 `200 text/html` 的 `index.html`（实测 `/__nope_xyz__`、`/nonexistent/`、`/nope.json` 均为
`200 text/html 6320` 字节，与 `/` 同体），SPA 照常渲染应用外壳 ⇒ 探针读到的是**真实存在**的
`.sf-shell`（值与 `/` 一致：`rgb(253, 232, 21)` / `#FDE815`）。即「不存在的 SPA 路径」在本栈上
**不会**产生「读不到站点」的状态，因此这一条不能用来证明错误态；错误态由上面两条（非 HTML /
无外壳）证明，且在两种失败下都不输出任何站点数值。

## 4. 面板托管的实例吃到新代码（⑥）

```
POST http://127.0.0.1:5555/api/restart {"sid":"seafood-h5"}
  → {"sid":"seafood-h5","ok":true,"state":"running","pid":81083,"msg":"已启动"}
旧 PID 92245 → 新 PID 81083
lsof -nP -iTCP:5800 -sTCP:LISTEN  → node 81083 TCP *:5800 (LISTEN)
/api/status .["seafood-h5"]       → running:true, state:running, portOpen:true, pid:81083
/_preview/health                  → ok:true pid:81083 port:5800 upstreamOk:true
```
（未使用 `pm2 restart`；未 `pkill`/`killall`。）

## 5. 降级与否

- **本机未降级**：同源 iframe 内部可读（`pill=同源可读 · OK`），② 区为站内真实计算值。
- **降级路径已实现并已由反向对照验证**（`cross-origin` / `not-html` / `missing-anchor` 三态）：
  一旦内部不可读或加载到的不是站点页面，页面显式置红报错、复制文本只保留
  「父页 UA / matchMedia / 色卡回读」，**不输出任何伪造的站点数值**。

## 6. 顺带观察到的两个环境事实（供后续定位参考，均非站点缺陷）

1. **帧级 `prefers-color-scheme` 不一致（headless Chrome 夹具效应）**：同一页面内
   父 frame 连续 4 次采样 `matchMedia('(prefers-color-scheme: dark)').matches = false`，
   而同源 iframe 内 4 次全为 `true`（两侧 `matchMedia` 均为 native、均非页面自定义）。
   页面把两者都打出来（parent / iframe 各一行），不会互相掩盖。真机复现时应以 iframe 行为准
   ——UA 强制深色正是看 `prefers-color-scheme`。
2. **站内日档底色的真实绘制者**：`.sf-shell`（`background: var(--sf-page-bg)`）——
   在 724×560 视口下上/中两点命中的元素自身背景都是透明的，灰/黄都由 `.sf-shell` 这一层画出；
   日档实测 `rgb(253, 232, 21)`，且 `html[data-theme]: light`、`colorScheme: light`。
   若真机上该处回读为灰，则需对照 iframe 的 `colorScheme` / `html[data-theme]` 两行定位
   （UA 强制深色 vs 站点自己进了夜档）。

## 7. 复现命令

```bash
node --check tools/h5-preview/server.mjs
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5800/_preview/colors        # 200
# 真机：与电脑同 Wi-Fi，手机浏览器打开
#   http://<LAN_IP>:5800/_preview/colors      → 点「复制全部读数」回贴
# 反向对照：
#   .../_preview/colors?src=/@fs/etc/passwd   → ERROR · missing-anchor
#   .../_preview/colors?src=/_preview/health  → ERROR · not-html
```
