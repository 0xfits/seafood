/**
 * Neng 独立质检腿 · vitest 配置（**不改被检仓 `frontend/**`**：配置与用例都落在 `ops/**`）
 *
 * 目的：§22.9 `AC-4`（无 Router 回落 · **两向判负**）在仓内**无既有覆盖** ——
 *   `i18n-batch-b2.test.jsx:154/158/170` 虽在无 `MemoryRouter` 下裸渲染 `RewardCard`，
 *   但只断言「翻译中小标」的在场性，**从未断言 `a` 计数 / 不抛错** ⇒ 该 AC 需要质检方自建腿。
 *
 * 用法：
 *   cd /Users/kevin/bistro/seafood/frontend \
 *     && npx vitest run --config ../ops/ui-card-ref-20261017/qa/neng-ac4-vitest.config.mjs
 * （root = `frontend/`（沿用仓内 `node_modules` 与 `src/test/setup.js`）；用例文件在 `ops/**`，
 *   用 `root`-相对绝对路径 `/src/...` 引入被测模块 ⇒ 与仓内用例**同一解析口径**。）
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const FE = '/Users/kevin/bistro/seafood/frontend'

export default defineConfig({
  root: FE,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.join(FE, 'src/test/setup.js')],
    include: ['/Users/kevin/bistro/seafood/ops/ui-card-ref-20261017/qa/neng-ac4.test.jsx'],
  },
})
