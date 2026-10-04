#!/usr/bin/env node
// S30 诊断：复刻 s25 脚本的 dynFragments 提取，逐个「不确定」名报出触发片段 + 片段出处行
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, 'src')

const CLASS_CTX_RE = /(?:className|class|\bid)\s*=\s*|(?:\bcn|\bclsx|\bclassnames|\bcx)\s*\(|classList\s*\.\s*(?:add|remove|toggle|contains)\s*\(|querySelector(?:All)?\s*\(\s*['"`]?\.?|getElementById\s*\(/g
const LIT_RE = /'([^'\\\n]*)'|"([^"\\\n]*)"|`((?:[^`\\]|\\.)*)`/g
const CLASS_TOKEN_RE = /^[A-Za-z_][\w-]*$/
const tokenize = (text) => text.split(/[\s"'`{}()[\].,;:=>$#+*!?&|~/\\]+/).filter((t) => CLASS_TOKEN_RE.test(t) && t.length >= 2)
const MAP_RE = /(?:const|let|var)\s+[A-Za-z_]\w*(?:[Cc]lass|[Vv]ariant|[Ss]ize|[Tt]heme|[Ss]tyle)[A-Za-z_]*\s*=\s*\{/g

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const fp = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name === 'test') continue; walk(fp, out) }
    else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(fp)
  }
  return out
}
const codeFiles = walk(SRC).filter((f) => f !== path.join(SRC, 'styles.css'))
const dynSites = []   // {frag, file, line, sp}
for (const fp of codeFiles) {
  const src = fs.readFileSync(fp, 'utf8')
  const blobs = []
  for (const m of src.matchAll(CLASS_CTX_RE)) {
    const start = m.index + m[0].length
    blobs.push([start, src.slice(start, start + 200)])
  }
  for (const m of src.matchAll(MAP_RE)) {
    const start = m.index + m[0].length - 1; let d = 0; let i = start
    for (; i < src.length; i++) { if (src[i] === '{') d += 1; else if (src[i] === '}') { d -= 1; if (d === 0) { i += 1; break } } }
    blobs.push([start, src.slice(start, i)])
  }
  for (const [start, s] of blobs) {
    if (!s.includes('${')) continue
    for (const sp of s.split('${')) {
      for (const t of tokenize(sp)) {
        const idx = src.indexOf(sp)
        const line = idx >= 0 ? src.slice(0, idx).split('\n').length : -1
        dynSites.push({ frag: t, file: path.relative(ROOT, fp), line, ctx: sp.replace(/\n/g, '⏎').slice(0, 80) })
      }
    }
  }
}
const targets = process.argv.slice(2)
const isDynamicWith = (name) => {
  const hits = []
  for (const f of dynSites) {
    const stem = f.frag.replace(/-$/, '')
    if (stem.length < 3) continue
    if (name === stem) continue
    if (name.startsWith(stem) || stem.startsWith(name)) hits.push(f)
  }
  return hits
}
for (const t of targets) {
  const hits = isDynamicWith(t)
  console.log(`\n### ${t}  → ${hits.length ? 'DYN' : 'STATIC'}`)
  const seen = new Set()
  for (const h of hits) {
    const k = h.file + ':' + h.line + ':' + h.ctx
    if (seen.has(k)) continue; seen.add(k)
    console.log(`   frag="${h.frag}"  ${h.file}:${h.line}  ctx=…${h.ctx}…`)
  }
}
