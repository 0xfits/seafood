// S39 · B12 阶段三 —— S22 守卫面现取读数（只读，不改盘）
// 与 src/test/unit/s22-decor-cleanup.test.js 同口径的独立复算，用于「前后不变」对照。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const STYLES = path.resolve(HERE, '..', 'src', 'styles.css')
const CSS = fs.readFileSync(STYLES, 'utf8')
const svgClipUrls = [...CSS.matchAll(/url\(#clip-path[^)]*\)/gi)]
const focusRingRules = [...CSS.matchAll(/:focus\s*\{[^}]*box-shadow\s*:\s*0 0 0\s+[0-9]+px/gi)]
const zeroRing = [...CSS.matchAll(/0 0 0 [0-9]+px/g)]
const pinned = ['.badge-gift::before', '#section_gift .point-badge', '.badge::after'].map((sel) => {
  const idx = CSS.indexOf(sel)
  if (idx < 0) return { sel, present: false }
  const body = CSS.slice(idx, CSS.indexOf('}', idx)).replace(/\s+/g, '')
  return { sel, present: true, firstIdx: idx, hasNonePair: body.includes('-webkit-clip-path:none;clip-path:none') }
})
const kf = [...CSS.matchAll(/@keyframes\s+([A-Za-z_][\w-]*)/g)].map((m) => m[1])
console.log(JSON.stringify({
  impl: 's39-guard-readings', styles: path.relative(path.resolve(HERE, '..'), STYLES),
  svgClipUrls: svgClipUrls.length, focusRingRules: focusRingRules.length, zeroRing: zeroRing.length,
  pinned, keyframes: kf, keyframesCount: kf.length,
  decorativePolygon: [...CSS.matchAll(/clip-path\s*:\s*polygon\s*\([^;]*\)/gi)].length,
}, null, 1))
