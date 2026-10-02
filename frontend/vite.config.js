import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 从模块 id 取 npm 包名（含 scope）。
 * 口径：只对 node_modules 下的模块生效；包名 = scope/name 或 name。
 */
const pkgOf = (id) => {
  const m = String(id).split('node_modules/').pop()
  const parts = m.split('/')
  return m.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * P6-FE-PERF 分包表（不动业务逻辑，只做 chunk 切分）。
 * 顺序即优先级；未命中任何一组的 node_modules 模块落入 `vendor`。
 */
const VENDOR_GROUPS = [
  ['vendor-react', /^(react|react-dom|scheduler)$/],
  ['vendor-router', /^(react-router|react-router-dom|@remix-run)$/],
  ['vendor-i18n', /^(i18next|react-i18next|i18next-browser-languagedetector)$/],
  ['vendor-calendar', /^@fullcalendar$/],
  ['vendor-ui', /^(lucide-react|@headlessui|react-hot-toast|clsx|goober|react-window)$/],
  [
    'vendor-web3-crypto',
    /^(@noble|@scure|@ethereumjs|ethereum-cryptography|@adraffy|micro-eth-signer|isomorphic-ws|ws)$/,
  ],
  [
    'vendor-web3',
    /^(web3|web3-core|web3-eth|web3-utils|web3-providers-http|web3-providers-ws|web3-validator|web3-types|web3-errors|web3-net|web3-eth-accounts|web3-eth-contract|web3-eth-abi|web3-eth-personal|web3-rpc-methods|web3-rpc-providers|ethers|viem|abitype|@ethersproject)$/,
  ],
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5787,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5788',
        changeOrigin: true,
        ws: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!String(id).includes('node_modules')) return undefined
          const pkg = pkgOf(id)
          for (const [name, re] of VENDOR_GROUPS) {
            if (re.test(pkg)) return name
          }
          return 'vendor'
        },
      },
    },
  },
})
