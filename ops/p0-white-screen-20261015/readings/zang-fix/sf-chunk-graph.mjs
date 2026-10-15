// Chunk dependency graph analyzer for vite dist output.
// Usage: node sf-chunk-graph.mjs <distDir>
// Exit 0 = acyclic, 1 = cycle found, 2 = usage/IO error.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) { console.error('usage: node sf-chunk-graph.mjs <distDir>'); process.exit(2) }
let files
try {
  files = readdirSync(join(dir, 'assets')).filter((f) => f.endsWith('.js')).sort()
} catch (e) { console.error('bad dist dir:', e.message); process.exit(2) }

const edges = {}
const info = {}
for (const f of files) {
  const s = readFileSync(join(dir, 'assets', f), 'utf8')
  const key = f.replace(/\.js$/, '')
  const deps = new Set()
  for (const m of s.matchAll(/from"\.\/([^"]+)"/g)) deps.add(m[1].replace(/\.js$/, ''))
  for (const m of s.matchAll(/import"\.\/([^"]+)"/g)) deps.add(m[1].replace(/\.js$/, ''))
  edges[key] = [...deps].sort()
  info[key] = {
    bytes: s.length,
    reactQrCode_marker_viewBoxSize: s.includes('viewBoxSize'),
    propTypes_marker: s.includes('prop-types'),
    interop_helper_marker: s.includes('__esModule&&Object.prototype.hasOwnProperty.call'),
    forwardRef: s.includes('forwardRef'),
  }
}
console.log('== chunk import edges ==')
for (const [f, deps] of Object.entries(edges)) {
  console.log(f, deps.length ? '-> ' + deps.join(', ') : '(no chunk deps)')
  for (const d of deps) if (!(d in edges)) console.log('  !! MISSING CHUNK TARGET:', d)
}
console.log('== module markers ==')
for (const [f, i] of Object.entries(info)) console.log(' ', f, JSON.stringify(i))

const WHITE = 0, GRAY = 1, BLACK = 2
const color = {}
const stack = []
const cycles = []
function dfs(u) {
  color[u] = GRAY
  stack.push(u)
  for (const v of edges[u] || []) {
    if (!(v in edges)) continue
    const c = color[v] ?? WHITE
    if (c === GRAY) cycles.push([...stack.slice(stack.indexOf(v)), v].join(' -> '))
    else if (c === WHITE) dfs(v)
  }
  stack.pop()
  color[u] = BLACK
}
for (const f of Object.keys(edges)) if ((color[f] ?? WHITE) === WHITE) dfs(f)
if (cycles.length) {
  console.log('== CYCLES FOUND ==')
  for (const c of cycles) console.log('  CYCLE:', c)
  process.exit(1)
}
console.log('== ACYCLIC: chunk dependency graph has no cycles ==')
process.exit(0)
