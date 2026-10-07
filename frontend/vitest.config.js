import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // S44-R1：`src/test/e2e/**` 是 Playwright spec（playwright.config.js 的 testDir 指向它），
    //   文本为 jinli 遗留；vitest 默认 include 的 `*.spec.js` 会误收集 ⇒ 从收集面排除（保留文件）。
    exclude: [...configDefaults.exclude, 'src/test/e2e/**']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  }
})
