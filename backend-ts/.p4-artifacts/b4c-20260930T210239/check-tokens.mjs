// 一次性自检：把 tokens.js 的每个 PROV 键回读到 docs/design/style-preview.html 对应行。
// 口径：needle 必须出现在该行（去空白、忽略大小写）；第三元素 = 该行必须「不含」的片段。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/Users/kevin/bistro/seafood'
const src = fs.readFileSync(path.join(ROOT, 'docs/design/style-preview.html'), 'utf8').split('\n')
const mod = await import(path.join(ROOT, 'frontend/src/theme/tokens.js'))

const norm = (s) => s.replace(/\s+/g, '').toLowerCase()
const at = (n) => (n >= 1 && n <= src.length ? src[n - 1] : null)

const fail = []
function check(label, prov, valuesOf) {
  for (const [key, slot] of Object.entries(prov)) {
    for (const which of ['d', 'n']) {
      const e = slot[which]
      if (!e) { fail.push(`${label}:${key}: 缺 ${which} 证据`); continue }
      const [ln, needle, mustNot] = e
      const raw = at(ln)
      if (raw === null) { fail.push(`${label}:${key}.${which}: 行号越界 ${ln}`); continue }
      const t = norm(raw)
      if (!t.includes(norm(needle))) fail.push(`${label}:${key}.${which}: L${ln} 不含 \`${needle}\``)
      if (mustNot && t.includes(norm(mustNot))) fail.push(`${label}:${key}.${which}: L${ln} 不该含 \`${mustNot}\``)
      if (typeof valuesOf(key, which) !== 'string') fail.push(`${label}:${key}: 值表缺档`)
    }
  }
}

const tk = mod.TOKEN_KEYS
const dk = Object.keys(mod.THEME_TOKENS.day)
const nk = Object.keys(mod.THEME_TOKENS.night)
const pk = Object.keys(mod.PROV)
const sorted = (a) => JSON.stringify([...a].sort())
const keysets_equal = sorted(dk) === sorted(nk) && sorted(pk) === sorted(tk)

const report = {
  source_html_lines: src.length,
  token_keys: tk.length,
  day_keys: dk.length,
  night_keys: nk.length,
  prov_keys: pk.length,
  keysets_equal,
  key_order_identical: JSON.stringify(dk) === JSON.stringify(nk),
  struct_keys: Object.keys(mod.STRUCT).length,
  struct_prov_keys: Object.keys(mod.STRUCT_PROV).length,
  structural_has_no_color: Object.values(mod.STRUCT).every((v) => !/#|rgba?\(/.test(v)),
  equal_in_both_themes: tk.filter((k) => mod.THEME_TOKENS.day[k] === mod.THEME_TOKENS.night[k]),
  values_changed: tk.filter((k) => mod.THEME_TOKENS.day[k] !== mod.THEME_TOKENS.night[k]).length,
}

check('PROV', mod.PROV, (k, w) => (w === 'd' ? mod.THEME_TOKENS.day[k] : mod.THEME_TOKENS.night[k]))
check('STRUCT_PROV', mod.STRUCT_PROV, (k) => mod.STRUCT[k])

report.failures = fail
report.fail_count = fail.length
console.log(JSON.stringify(report, null, 2))
process.exitCode = fail.length ? 1 : 0
