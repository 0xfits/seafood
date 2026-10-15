# 浏览器层判负自证 + 修复验证读数（Zang，2026-10-15 15:3x–15:4x CST）

## 方法（质检可复放）

静态服两条（`python3 -m http.server`，无任何代理/缓存层）：

- 旧（坏）产物：`python3 -m http.server 5790 --directory /tmp/sf-probe-build`（诊断期留存的 HEAD=c7ba7d4 原样产物；若 /tmp 已清，可用 `git show c7ba7d4:frontend/vite.config.js` 置回后 `npm run build` 重生，index-Cl6qtH3z.js sha256=84c596d5… 可对账）
- 新（修）产物：`python3 -m http.server 5791 --directory frontend/dist`

浏览器探针（CDP，两态同法同尺）：

1. `Page.addScriptToEvaluateOnNewDocument` 注入 `window.__errs=[]` + `window.addEventListener('error', …)` 捕获未捕获异常
2. 打开首页，等待 3s
3. 读 `#root` 子节点数、`data-sf-m` 锚、`window.__errs`

## 旧产物（:5790）—— 判负自证，尺子必须红：**红 ✓**

```json
{"title":"🐴 Seafood","rootChildren":0,"rootHTML":"","errs":["TypeError: Cannot read properties of undefined (reading 'forwardRef')\n    at http://localhost:5790/assets/vendor-CaaXybtR.js:12:14971"],"vendorScript":0}
```

- `#root` 空（React 未挂载）= 生产白屏同态
- 错误与生产逐字同型同文件同行（生产读数 `@https://0xseafood.com/assets/vendor-CaaXybtR.js:12`，见 ../zang-diagnosis/diagnosis.md）

## 新产物（:5791）—— 同尺转绿：**绿 ✓**

```json
{"title":"🐴 Seafood 海鲜市场｜加密人自己的「闲鱼」","rootChildren":2,"hasHeader":true,"firstDataSfM":"header-orders","bodyTextSample":"加载首页失败: 请求失败 (404)\nSeafood 海鲜市场\n社区任务\n市场\n订单\n语言\n注册\n登录\n欢迎来到 Jinli Club\n\n参与任务，赚取$，兑换","errs":[]}
```

- `#root` 2 个子节点、`header-orders` 锚在、App 全文案渲染、`__errs` 空
- 「加载首页失败: 请求失败 (404)」= 静态服无 `/api` 后端所致的**应用层优雅降级**，非本缺陷（对照：旧态是**整页零渲染**）；生产有后端不受此影响
