// Neng 质检探针专用 vitest 配置（不落 frontend/，只读引用其 setup）
// · root = frontend（保证 react / @testing-library 从 frontend/node_modules 解析）
// · 探针文件在 ops/bttc-mint-shortfall/qa/ ⇒ 其裸导入（react/vitest/...）超出 node 解析面，
//   故显式 alias 到 frontend/node_modules（只读、不改仓）。
// 运行：cd frontend && npx vitest run --config /Users/kevin/bistro/seafood/ops/bttc-mint-shortfall/qa/vitest.qa.config.mjs
const FE = '/Users/kevin/bistro/seafood/frontend'
const M = (p) => `${FE}/node_modules/${p}`

const alias = [
  [/^react$/, M('react')],
  [/^react-dom$/, M('react-dom')],
  [/^react-dom\/client$/, M('react-dom/client')],
  [/^react-router-dom$/, M('react-router-dom')],
  [/^react-i18next$/, M('react-i18next')],
  [/^i18next$/, M('i18next')],
  [/^@testing-library\/react$/, M('@testing-library/react')],
  [/^vitest$/, M('vitest')],
].map(([find, replacement]) => ({ find, replacement }))

export default {
  root: FE,
  resolve: { alias, dedupe: ['react', 'react-dom'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [`${FE}/src/test/setup.js`],
    include: ['../ops/bttc-mint-shortfall/qa/*.test.jsx'],
    exclude: ['**/node_modules/**'],
  },
}
