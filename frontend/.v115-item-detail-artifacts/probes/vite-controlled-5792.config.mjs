// 受控实例配置（Kong 收尾单 · 5792）：只改 cacheDir 与 port，其余继承仓内 vite.config.js。
// 目的 = 不与被主 dev 实例（5787）共用的 node_modules/.vite 抢写（见 seafood-platform 技能采数口径 ④）。
// 本文件在仓外 ⇒ 用绝对路径 import vite（否则 ERR_MODULE_NOT_FOUND）。
import { defineConfig, mergeConfig } from '/Users/kevin/bistro/seafood/frontend/node_modules/vite/dist/node/index.js'
import base from '/Users/kevin/bistro/seafood/frontend/vite.config.js'

export default mergeConfig(
  base,
  defineConfig({
    root: '/Users/kevin/bistro/seafood/frontend',
    cacheDir: '/Users/kevin/.hermes/profiles/zang/cache/scratch/vite-cache-5792',
    server: { port: 5792, strictPort: true },
  }),
)
