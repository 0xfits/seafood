# 海鲜市场 (seafood) · H5 预览服务

一个**零依赖**的 Node 服务（纯 ESM，Node **18** 可跑），把 vite dev 上的全站页面
「原样」暴露到 `0.0.0.0:5800`，并提供 `/_preview` 的 **H5 预览外壳**：
设备宽度预设 + 手机框 iframe + 路由快捷项 + 与 iframe 双向同步的地址栏 +
上游健康指示 + 局域网真机地址。

> 为什么需要它：前端是全站双档响应式（`src/shell/AppShell.jsx` = 顶栏 → 内容 → 页脚 → `<BottomTabBar/>`，
> 两档同一套 DOM）；底部 tabbar 仅在 `@media (max-width:767px)` 内 `display:grid`
> （`src/shell/shell.css`）。**在一个宽度 390px 的 iframe 里就会真实进入 H5 骨架**（不是模拟）。
> 而 vite dev 只绑 IPv6 `[::1]:5787`（本机实测，`127.0.0.1:5787` 拒连）⇒ 手机在局域网根本连不上。
> 本服务绑 `0.0.0.0` 并做透明反代，桌面浏览器看 H5、真手机也能打开同一份页面。

---

## 端口 / 进程

| 项 | 值 |
| --- | --- |
| 监听 | `0.0.0.0:5800`（`H5_BIND` / `H5_PORT` 可覆盖） |
| 预留端口 | 只有 `5173` / `5174`，本服务**不占** |
| 上游（vite dev） | `http://[::1]:5787`（`H5_UPSTREAM` 可覆盖） |
| 预览外壳 | `http://localhost:5800/_preview` |
| 健康检查 | `http://localhost:5800/_preview/health`（JSON） |

## 启动 / 停止

```bash
# 启动（后台）
cd /Users/kevin/bistro/seafood
nohup node tools/h5-preview/server.mjs > ~/.hermes/profiles/zang/cache/scratch/h5-preview.log 2>&1 &
echo $!            # ← 记录精确 PID

# 查看
lsof -nP -iTCP:5800 -sTCP:LISTEN

# 停止（只按精确 PID，禁止 pkill -f / killall）
kill -TERM <PID>
```

**前置**：vite dev 必须已在运行（`lsof -nP -iTCP:5787 -sTCP:LISTEN` 应看到 `[::1]:5787`）。
没有的话在 **ctrl 面板**里启动 **『海鲜市场 前端』(5787)**。上游没起时本服务**不会崩**：
`/_preview` 仍能打开并给出指引，反代请求返**友好 502 HTML**。

## 与 ctrl 面板的关系

本服务**尚未**登记进 ctrl 面板。待登记为 **sid `seafood-h5`**（端口 5800），
由面板统一启停。登记前请用手动命令启停，**不要**用 `pm2 restart bistro-ctrl` / `startAll`。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `H5_PORT` | `5800` | 监听端口 |
| `H5_BIND` | `0.0.0.0` | 监听地址 |
| `H5_UPSTREAM` | `http://[::1]:5787` | 上游 vite dev 地址，如 `http://127.0.0.1:5787` |

> 默认上游**启动时探测**：`::1` 优先，失败退 `127.0.0.1`；运行中 `ECONNREFUSED` 会重探。

## 反代口径（重要）

- **所有路径**透传上游，含 `/api`（vite 内部再代理到 `127.0.0.1:5788`）、静态资源与
  **WebSocket upgrade**（HMR 可用）。
- 反代时把请求的 **`Host` 改写成上游 authority**（`localhost:5787`）—— 否则 vite 的
  `server.allowedHosts` 检查会对**局域网 IP** 请求返 **403**；同时带上
  `x-forwarded-host` / `x-forwarded-proto`，并**剥除 hop-by-hop 头**。
- 上游未运行时，反代请求返 **502 友好 HTML**（不崩、不挂）。

## 预览口径（逐字）

> **iframe 宽度 = 真实断点，等同手机竖屏布局；但底部安全区 / 地址栏伸缩 / 键盘弹出仍需真机。**

即：预设 `≤767px`（320/375/390/414）会真实命中 H5 骨架（`.sf-tabbar` 计算 `display:grid`），
`768×1024` 命中桌面档（`display:none`）。但 `env(safe-area-inset-*)`、移动端地址栏自动伸缩、
软键盘弹起引起的视口变化 —— **这些只在真机上才成立，iframe 覆盖不到**，请用上面「真机访问」地址在手机上复核。

## 目录

```
tools/h5-preview/
├── server.mjs   # 零依赖服务：反代 + /_preview 外壳 + /_preview/health
└── README.md
```
