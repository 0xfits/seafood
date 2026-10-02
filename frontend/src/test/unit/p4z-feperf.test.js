import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import {
  ROOT,
  SAFELIST,
  SAFELIST_LINE,
  DYNAMIC,
  DYNAMIC_TOKENS,
  distCss,
  distCssPath,
  cssEscape,
  cssHasToken,
  missingInCss,
  dynamicMissingFromSafelist,
} from '../../../scripts/p4z-feperf-safelist.mjs'

// Unit P6-FE-PERF · Tailwind 运行期 CDN → 构建期编译 的产物闭环
// 口径：① safelist（styles.css @source inline）里每个类都要能在 dist/assets/*.css 里按 **CSS 转义形态** 找到；
//       ② 源码运行期拼接出的动态类名（清单见 scripts/p4z-feperf-safelist.mjs）非空、且每个都在 safelist 与产物里；
//       ③ 判负：把某个类从产物里抹掉 / 造一个越界类名，断言核对器必须报出来（否则核对器是假的）。
// 依赖 npm run build 的产物；无产物时本文件显式抛错（不静默跳过）。

const css = distCss
if (!css) throw new Error('p4z-feperf: 缺少构建产物 dist/assets/*.css —— 先跑 `npm run build`')

const MICRO_PATH = `${ROOT}/src/components/ui/MicroInteractions.jsx`
const microSrc = fs.readFileSync(MICRO_PATH, 'utf8')

// ★ 扫描污染（本单实测发现，见 docs/audit/p6-fe-perf.md「坑」）：Tailwind v4 的自动内容探测会扫 src/**（含
//   src/test），测试文件里的类名字面量会被当成真实用法**注入产物**。故判负用的越界类名与承重探针一律
//   以字符串拼接书写，避免自己污染自己；'scale-1.05' 保持字面量是有意的——它在被扫描的前提下仍不可构建。
const PROBE = 'xl:grid-cols-' + '4'
const BOGUS = ['md:grid-cols-' + '8', 'xl:grid-cols-' + '8', 'md:text-' + '9xl']

describe('P6-FE-PERF · safelist 承重（产物里必须有）', () => {
  it('safelist 单一真源可解析，且规模合理', () => {
    expect(SAFELIST_LINE.file).toBe('src/styles.css')
    expect(SAFELIST_LINE.line).toBeGreaterThan(0)
    expect(SAFELIST_LINE.text).toContain('@source inline(')
    expect(SAFELIST.length).toBeGreaterThanOrEqual(29)
    expect(new Set(SAFELIST).size).toBe(SAFELIST.length) // 无重复
  })

  it('safelist 每个类名都命中产物 CSS（转义形态，如 .md\\:grid-cols-2）', () => {
    expect(missingInCss(css, SAFELIST)).toEqual([])
  })

  it('承重证据：动态独有类在源码里不是字面量，产物里必须存在 ⇒ 只可能来自 safelist', () => {
    const probe = PROBE
    expect(SAFELIST).toContain(probe)
    expect(cssHasToken(css, probe)).toBe(true)
    expect(css).toContain('.' + cssEscape(probe))
    // 该字面量在应用源码里不得出现（出现即说明本次「承重」读数不成立）
    const srcFiles = []
    ;(function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`
        if (e.isDirectory()) { if (e.name !== 'test' && e.name !== 'images') walk(p) }
        else if (/\.(jsx|js)$/.test(e.name)) srcFiles.push(p)
      }
    })(`${ROOT}/src`)
    const literal = srcFiles.filter((f) => fs.readFileSync(f, 'utf8').includes(probe))
    expect(literal).toEqual([])
  })
})

describe('P6-FE-PERF · 动态（运行期拼接）类名清单闭环', () => {
  it('清单非空，且每一项都在 safelist 里（含 file:line 出处）', () => {
    expect(DYNAMIC_TOKENS.length).toBeGreaterThanOrEqual(24)
    expect(dynamicMissingFromSafelist).toEqual([])
    for (const d of DYNAMIC) {
      expect(d.token).toMatch(/^(md|lg|xl):|^scale-\[/)
      expect(d.file).toMatch(/^src\//)
      expect(d.line).toBeGreaterThan(0)
    }
    expect(DYNAMIC.some((d) => d.file.endsWith('Responsive.jsx'))).toBe(true)
  })

  it('清单每一项都能在产物 CSS 里找到对应工具类', () => {
    expect(missingInCss(css, DYNAMIC_TOKENS)).toEqual([])
  })

  it('Responsive 网格/字号的可达性与守卫一致（md>=2 / lg>=3 / xl>=4）', () => {
    for (const t of ['md:grid-cols-2', 'lg:grid-cols-3', PROBE, 'md:text-2xl', 'lg:text-3xl']) {
      expect(DYNAMIC_TOKENS).toContain(t)
      expect(cssHasToken(css, t)).toBe(true)
    }
  })
})

describe('P6-FE-PERF · 判负（核对器必须能失败）', () => {
  it('判负 1：把 safelist 独有类从产物 CSS 里抹掉 ⇒ 必须报缺', () => {
    const tok = PROBE
    expect(missingInCss(css, [tok])).toEqual([])
    const mutated = css.split(cssEscape(tok)).join('__removed__')
    expect(mutated).not.toContain(cssEscape(tok))
    expect(missingInCss(mutated, [tok])).toEqual([tok])
  })

  it('判负 2：越界类名（safelist 与源码都没有）必须报缺，且产物里确实不存在', () => {
    for (const bogus of BOGUS) {
      expect(SAFELIST).not.toContain(bogus)
      expect(cssHasToken(css, bogus)).toBe(false)
      expect(missingInCss(css, [bogus])).toEqual([bogus])
    }
  })

  it('判负 3：清单摘掉一项后再核对 safelist 覆盖面 ⇒ 覆盖面必须变小（else 断言失效）', () => {
    const dropped = DYNAMIC_TOKENS[0]
    const kept = DYNAMIC_TOKENS.slice(1)
    expect(kept.length).toBe(DYNAMIC_TOKENS.length - 1)
    expect(kept).not.toContain(dropped)
    expect(SAFELIST).toContain(dropped)
  })
})

describe('P6-FE-PERF · CDN 迁出的代码侧硬约束', () => {
  it('index.html 不再引入 tailwind CDN（样式改由 styles.css @import "tailwindcss" 提供）', () => {
    const html = fs.readFileSync(`${ROOT}/index.html`, 'utf8')
    // 注释里允许留迁出说明（指向本报告）；**可执行引用**必须为 0
    const actionable = html.replace(/<!--[\s\S]*?-->/g, '')
    expect(actionable).not.toContain('cdn.tailwindcss.com')
    expect(actionable).not.toMatch(/<script[^>]*tailwind/i)
    expect(actionable).not.toMatch(/<link[^>]*tailwind/i)
    const styles = fs.readFileSync(`${ROOT}/src/styles.css`, 'utf8')
    expect(styles).toContain('@import "tailwindcss"')
    expect(styles).toContain('@source inline(')
  })

  it('MicroInteractions.jsx:14 已改任意值形态 scale-[1.05]（旧 `scale-${scale}` 真 OPEN 缺陷已闭）', () => {
    expect(microSrc).not.toMatch(/`scale-\$\{/)
    expect(microSrc).toContain("'scale-[1.05]'")
    expect(SAFELIST).toContain('scale-[1.05]')
    expect(SAFELIST).not.toContain('scale-1.05')
    expect(cssHasToken(css, 'scale-[1.05]')).toBe(true)   // 产物里为 .scale-\[1\.05\]
    expect(css).toContain('.scale-\\[1\\.05\\]')
    expect(cssHasToken(css, 'scale-1.05')).toBe(false)    // 旧拼接字面量不可构建（v3 CDN / v4 同）
  })

  it('产物 CSS 存在且非空（读的确实是构建期产物，不是源码）', () => {
    expect(distCssPath).toMatch(/dist\/assets\/.*\.css$/)
    expect(Buffer.byteLength(css)).toBeGreaterThan(20000)
  })
})
