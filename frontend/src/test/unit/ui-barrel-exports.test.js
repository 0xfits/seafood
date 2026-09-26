/**
 * UI barrel 重导出守卫测试
 *
 * 背景：frontend/src/components/ui/index.js 曾用
 *   `export { default as Container } from '../layout/Container'`
 * 这种写法重导出 12 个【只有具名导出、没有 default 导出】的模块。
 * 浏览器原生 ESM 在链接期就会抛
 *   `Uncaught SyntaxError: The requested module '...' does not provide an export named 'default'`
 * 从而让整个 barrel 模块作废、所有依赖它的页面白屏 —— 而 vite build / vitest（vite-node 宽松处理）
 * 却能通过，所以 CI 全绿也漏掉了这个 bug。
 *
 * 本测试用两条独立防线盯住这类回归：
 *  1) 静态一致性：解析 barrel 的每条 `export {...} from '<src>'`，逐个名字回到源模块核对
 *     它确实导出了该名字（`default as X` 要求源模块真的有 default 导出）。
 *  2) 运行时存在性：真正 import 一次 barrel，断言每个导出值 !== undefined。
 *
 * 通过 UI_BARREL_FILE 环境变量可以把同一套断言逻辑指向另一个 barrel 文件（用于对照组回归验证）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.resolve(HERE, '../../components/ui')
const BARREL_FILE = process.env.UI_BARREL_FILE
  ? path.resolve(process.env.UI_BARREL_FILE)
  : path.join(UI_DIR, 'index.js')

/** barrel 应当暴露的名字全集（与源模块真实具名导出一致） */
const EXPECTED_EXPORTS = [
  // 基础
  'Button',
  'Card', 'CardHeader', 'CardTitle', 'CardContent',
  'Badge', 'badgeVariants',
  // 布局
  'Container', 'Grid',
  // 加载（历史名 Loading -> LoadingSpinner）
  'LoadingSpinner', 'LoadingPage', 'LoadingCard',
  // 动画
  'FadeIn', 'SlideUp', 'StaggerContainer',
  // 响应式
  'ResponsiveGrid', 'ResponsiveContainer',
  // 标签页
  'Tabs', 'TabsList', 'TabsTrigger', 'TabsContent',
  // 弹层
  'Modal', 'ModalHeader', 'ModalTitle', 'ModalContent', 'ModalFooter',
  // Toast
  'ToastProvider', 'useToast',
  // 表单
  'Form', 'FormField', 'Input', 'Textarea', 'Select', 'Checkbox', 'RadioGroup',
  // 数据展示
  'Table', 'TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell',
  'DataTable', 'StatCard', 'Progress', 'Skeleton',
  // 高级
  'SearchBox', 'Dropdown', 'DatePicker', 'FilterPanel', 'Pagination',
  // 微交互
  'HoverCard', 'RippleButton', 'MagneticButton', 'Typewriter', 'Counter',
  'GradientText', 'GlowingBorder', 'Parallax', 'RevealOnScroll',
  // 性能
  'VirtualList', 'LazyImage', 'DebouncedInput', 'ThrottledButton',
  'InfiniteScroll', 'MemoizedComponent', 'PerformanceMonitor', 'LazyComponent',
  // 错误处理
  'ErrorBoundary', 'ErrorFallback', 'NetworkErrorHandler', 'useErrorHandler',
  'ErrorToast', 'NotFoundPage', 'LoadingFallback',
  // dashJ
  'DashJ',
]

/** 全站各页面/组件实际从 barrel 取用的名字（一个都不能少） */
const CONSUMED_EXPORTS = [
  'Button', 'Card', 'CardHeader', 'CardTitle', 'CardContent',
  'Badge', 'Modal', 'ModalHeader', 'ModalTitle', 'Form',
]

/** 不含任何 default 导出的模块，绝不允许被 `default as` 重导出 */
const MODULES_WITHOUT_DEFAULT = [
  './Button', './Card', './Badge', '../layout/Container', '../layout/Grid',
  './Loading', './Motion', './Responsive', './Tabs', './Modal', './Toast',
  './Form', './DataDisplay', './Advanced', './MicroInteractions',
  './Performance', './ErrorHandling',
]

const resolvable = (base) => [
  base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`,
  path.join(base, 'index.js'), path.join(base, 'index.jsx'),
].find((p) => fs.existsSync(p) && fs.statSync(p).isFile())

function resolveSource(spec, fromFile) {
  return resolvable(path.resolve(path.dirname(fromFile), spec))
}

/** 收集一个模块文件的导出（名字集合 + 是否有 default），可递归穿透 barrel */
function collectExports(file, depth = 0) {
  const src = fs.readFileSync(file, 'utf8')
  const names = new Set()
  let hasDefault = /(^|\n)\s*export\s+default\b/.test(src)

  // `export { A, B as C } from '<spec>'` 与本地 `export { A, B }`
  for (const m of src.matchAll(/(^|\n)\s*export\s*\{([\s\S]*?)\}\s*(from\s*['"]([^'"]+)['"])?/g)) {
    const [, , body, , spec] = m
    for (const raw of body.split(',')) {
      const part = raw.trim()
      if (!part) continue
      const asMatch = part.match(/^([\w$]+)\s+as\s+([\w$]+)$/)
      const local = asMatch ? asMatch[1] : part
      const exported = asMatch ? asMatch[2] : part
      if (local === 'default') hasDefault = true
      if (spec) {
        // 重导出：本地名字须存在于来源模块
        if (depth < 4) {
          const dep = resolveSource(spec, file)
          if (dep) {
            const depExports = collectExports(dep, depth + 1)
            const ok = local === 'default' ? depExports.hasDefault : depExports.names.has(local)
            if (!ok) names.add(`\u0000MISSING:${exported}<-${spec}:${local}`)
          }
        }
      }
      names.add(exported)
    }
  }

  // `export const/let/var/function/class X`
  for (const m of src.matchAll(/(^|\n)\s*export\s+(?:const|let|var|function|class)\s+([\w$]+)/g)) {
    names.add(m[2])
    if (m[0].includes('function') || m[0].includes('class')) { /* 具名导出 */ }
  }

  // `export * from '<spec>'`
  for (const m of src.matchAll(/(^|\n)\s*export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    if (depth >= 4) continue
    const dep = resolveSource(m[2], file)
    if (dep) {
      const depExports = collectExports(dep, depth + 1)
      depExports.names.forEach((n) => names.add(n))
      if (depExports.hasDefault) hasDefault = true
    }
  }

  return { names, hasDefault }
}

/** barrel 里每条 `export {...} from '<spec>'` 的原始记录 */
function parseBarrelReexports(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = []
  for (const m of src.matchAll(/(^|\n)\s*export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    out.push({ spec: m[3], names: m[2].split(',').map((s) => s.trim()).filter(Boolean) })
  }
  return out
}

/** 同一目录下所有 .js barrel 的懒加载映射（由 Vite 解析，无需硬编码受控文件名） */
const BARREL_MODULES = import.meta.glob('../../components/ui/*.js')

async function loadBarrel() {
  const key = Object.keys(BARREL_MODULES).find(
    (k) => path.resolve(HERE, k) === BARREL_FILE,
  )
  if (!key) {
    throw new Error(`未在 import.meta.glob 中找到 ${BARREL_FILE}`)
  }
  return BARREL_MODULES[key]()
}

describe('ui barrel 重导出守卫', () => {
  it('barrel 文件存在', () => {
    expect(fs.existsSync(BARREL_FILE), `barrel 不存在: ${BARREL_FILE}`).toBe(true)
  })

  it('每条重导出的名字都能在源模块里找到（禁止 default as 不提供 default 的模块）', () => {
    const problems = []
    for (const { spec, names } of parseBarrelReexports(BARREL_FILE)) {
      const dep = resolveSource(spec, BARREL_FILE)
      if (!dep) { problems.push(`无法解析来源模块 ${spec}`); continue }
      const depExports = collectExports(dep)
      for (const raw of names) {
        const asMatch = raw.match(/^([\w$]+)\s+as\s+([\w$]+)$/)
        const local = asMatch ? asMatch[1] : raw
        const exported = asMatch ? asMatch[2] : raw
        if (local === 'default') {
          if (!depExports.hasDefault) {
            problems.push(`'${spec}' 没有 default 导出，却被重导出为 '${exported}' ← 会导致浏览器 ESM 链接期 SyntaxError`)
          }
        } else if (!depExports.names.has(local)) {
          problems.push(`'${spec}' 没有名为 '${local}' 的导出（barrel 却想导出 '${exported}'）`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('明确列出"无 default 导出"的模块，且它们没有被 default as 重导出', () => {
    const offenders = []
    for (const spec of MODULES_WITHOUT_DEFAULT) {
      const dep = resolvable(path.resolve(path.dirname(BARREL_FILE), spec))
      if (!dep) continue
      const { hasDefault } = collectExports(dep)
      if (hasDefault) offenders.push(`${spec} 现在有 default 导出了（请更新本清单）`)
    }
    const defaultAsSpecs = parseBarrelReexports(BARREL_FILE)
      .filter(({ names }) => names.some((n) => /^default\s+as\s+/.test(n.trim())))
      .map(({ spec }) => spec)
    for (const spec of defaultAsSpecs) {
      const dep = resolveSource(spec, BARREL_FILE)
      if (!dep) continue
      const { hasDefault } = collectExports(dep)
      if (!hasDefault) offenders.push(`barrel 对 ${spec} 使用了 'default as'，但该模块没有 default 导出`)
    }
    expect(offenders).toEqual([])
  })

  it('运行时：barrel 真实 import 后每个导出值 !== undefined', async () => {
    const mod = await loadBarrel()
    const missing = EXPECTED_EXPORTS.filter((name) => mod[name] === undefined)
    expect(missing, `以下导出为 undefined: ${missing.join(', ')}`).toEqual([])
  })

  it('运行时：页面实际用到的 10 个名字全部可用（非 undefined，函数/组件）', async () => {
    const mod = await loadBarrel()
    const broken = CONSUMED_EXPORTS.filter((name) => mod[name] === undefined)
    expect(broken, `页面依赖的导出缺失: ${broken.join(', ')}`).toEqual([])
  })
})
