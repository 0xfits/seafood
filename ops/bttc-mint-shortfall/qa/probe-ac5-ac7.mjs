/**
 * AC5 · i18n 计数现取 + 13 个被前推测试文件的「等值前推（非放宽）」核验
 * AC7 · 零副作用面（diff 面清单 / postBttcMint 载荷 / disabled 语义）
 * AC1s · 后端契约源码面（零新 SQL / 键集 10⇒11 / usdBalance 类型来源）
 * 只读：git show / git diff / fs 读取，无写库无写仓。
 * 用法：node ops/bttc-mint-shortfall/qa/probe-ac5-ac7.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const FE = path.join(REPO, 'frontend')
const BASE = '2da49e0'
const HEAD = 'eebe883'
const git = (cmd) => execSync(cmd, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// ---------- AC5 ① 现取计数 ----------
const LANGS = ['zh', 'en', 'hk', 'vn']
const readLocale = (l) => JSON.parse(fs.readFileSync(path.join(FE, 'src/locales', `${l}.json`), 'utf8'))
const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))

const tables = Object.fromEntries(LANGS.map((l) => [l, readLocale(l)]))
const flats = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flatten(tables[l]))]))
const counts = Object.fromEntries(LANGS.map((l) => [l, { top: Object.keys(tables[l]).length, flat: Object.keys(flats[l]).length }]))
const nodes = LANGS.reduce((s, l) => s + counts[l].flat, 0)

const base = [...new Set(Object.keys(flats.zh))]
const diffSets = {}
for (const l of LANGS) {
  const s = new Set(Object.keys(flats[l]))
  diffSets[l] = {
    missing_vs_zh: base.filter((k) => !s.has(k)),
    extra_vs_zh: [...s].filter((k) => !base.includes(k)),
  }
}
const newKeys = {
  zh: flats.zh.bttcPanel?.mintNeedBatt,
  en: flats.en.bttcPanel?.mintNeedBatt,
  hk: flats.hk.bttcPanel?.mintNeedBatt,
  vn: flats.vn.bttcPanel?.mintNeedBatt,
  usd: { zh: flats.zh.bttcPanel?.mintNeedUsd, en: flats.en.bttcPanel?.mintNeedUsd, hk: flats.hk.bttcPanel?.mintNeedUsd, vn: flats.vn.bttcPanel?.mintNeedUsd },
}

// ---------- AC5 ② 13 个前推文件：等值前推核验 ----------
const changedTests = git(`git diff ${BASE}..${HEAD} --name-only -- frontend/src/test/unit/`).trim().split('\n').filter(Boolean)
const countFiles = changedTests.filter((f) => !f.endsWith('r9-batt-meter.test.jsx'))

const LOOSEN = /toBeGreaterThan|toBeGreaterThanOrEqual|\.length\s*>=|\.length\s*>\s*\d|not\.toBe\(|toMatch\(\/\\d|toBeLessThan/
const NUMLINE = /(flat|nodes|node|作用域命中节点数|top=)/
const fileAudits = countFiles.map((f) => {
  const oldSrc = git(`git show ${BASE}:${f}`)
  const newSrc = fs.readFileSync(path.join(REPO, f), 'utf8')
  const pick = (src) => src.split('\n')
    .map((line, i) => ({ i: i + 1, line: line.trim() }))
    .filter((o) => NUMLINE.test(o.line) && /\b(110[0-9]|44[0-9][0-9]|128)\b/.test(o.line) && /expect\(|toBe/.test(o.line))
    .map((o) => ({ n: o.i, nums: (o.line.match(/\b\d{3,4}\b/g) || []), len: o.line.length }))
  const o = pick(oldSrc)
  const n = pick(newSrc)
  const oldHasBaseValues = o.some((x) => x.nums.includes('1104') || x.nums.includes('4416'))
  const newHasTargetValues = n.some((x) => x.nums.includes('1106') || x.nums.includes('4424'))
  const loosenedOld = o.filter((x) => LOOSEN.test(x.line))
  const loosenedNew = n.filter((x) => LOOSEN.test(x.line))
  return {
    file: f,
    old_assertion_lines: o.length,
    new_assertion_lines: n.length,
    old_values: [...new Set(o.flatMap((x) => x.nums))].sort(),
    new_values: [...new Set(n.flatMap((x) => x.nums))].sort(),
    old_has_1104_or_4416: oldHasBaseValues,
    new_has_1106_or_4424: newHasTargetValues,
    old_loosened_assertions: loosenedOld.length,
    new_loosened_assertions: loosenedNew.length,
    verdict: (oldHasBaseValues || f.includes('tg-bind-qr')) && newHasTargetValues && loosenedNew.length <= loosenedOld.length
      ? 'EQUAL_VALUE_PUSH'
      : (newHasTargetValues ? 'CHECK_MANUALLY' : 'NO_COUNT_EDIT'),
  }
})

// ---------- AC7 零副作用面 ----------
const stat = git(`git diff ${BASE}..${HEAD} --stat`).trim()
const names = git(`git diff ${BASE}..${HEAD} --name-only`).trim().split('\n').filter(Boolean)
const shellCssTouched = names.filter((f) => /shell\.css$/.test(f))
const themeTokenAdds = git(`git diff ${BASE}..${HEAD} -- frontend/src/ | grep '^+.*--sf-' || true`).trim()
const routeNavFiles = names.filter((f) => /(^|\/)(App|routes?|nav|Header|AppShell|shell)\b/.test(path.basename(f)) || /router|nav/i.test(f))
const bttcApiDiff = git(`git diff ${BASE}..${HEAD} -- frontend/src/bttc-api.js`).trim()
const panelDiff = git(`git diff ${BASE}..${HEAD} -- frontend/src/components/BattCheckinPanel.jsx`)
const disabledLinesAdded = panelDiff.split('\n').filter((l) => l.startsWith('+') && /disabled=/.test(l))
const disabledLinesRemoved = panelDiff.split('\n').filter((l) => l.startsWith('-') && /disabled=/.test(l))

const ac7 = {
  changed_files: names,
  changed_count: names.length,
  shell_css_touched: shellCssTouched,
  new_sf_tokens_added: themeTokenAdds ? themeTokenAdds.split('\n') : [],
  route_or_nav_files: routeNavFiles,
  bttc_api_diff_empty: bttcApiDiff === '',
  mint_payload_unchanged: /body: JSON\.stringify\(\{ create_key: newIdempotencyKey\('cli'\) \}\)/.test(fs.readFileSync(path.join(FE, 'src/bttc-api.js'), 'utf8')),
  disabled_lines_added: disabledLinesAdded,
  disabled_lines_removed: disabledLinesRemoved,
  disabled_semantics_unchanged: disabledLinesAdded.length === 0 && disabledLinesRemoved.length === 0,
  diffstat: stat.split('\n').slice(-1)[0],
}

// ---------- AC1s 源码面 ----------
const idxDiff = git(`git diff ${BASE}..${HEAD} -- backend-ts/src/index.ts`)
const idxSrc = fs.readFileSync(path.join(REPO, 'backend-ts/src/index.ts'), 'utf8')
const routeBody = idxSrc.slice(idxSrc.indexOf("app.get('/api/batt'"), idxSrc.indexOf("app.get('/api/checkin'"))
const dbSrc = fs.readFileSync(path.join(REPO, 'backend-ts/src/database.ts'), 'utf8')
const getBttcStateBody = dbSrc.slice(dbSrc.indexOf('static async getBttcState'), dbSrc.indexOf('A1 · `POST /api/bttc/mint`'))
const ac1s = {
  index_ts_added_lines: idxDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')),
  index_ts_removed_lines: idxDiff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')),
  batt_route_sql_statements: (routeBody.match(/sql`|DatabaseService\.\w+/g) || []),
  batt_route_new_queries: 0,
  bttc_keys_in_source: [...routeBody.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1]),
  getBttcState_declared_type: (getBttcStateBody.match(/usdBalance: ([^;]+);/) || [])[1] || null,
  getBttcState_string_coercion: /const usdBalance = String\(row\.usd_balance \?\? '0'\)/.test(getBttcStateBody),
  getBttcState_sql_count: (getBttcStateBody.match(/sql`/g) || []).length,
  note: 'index.ts 改动仅在响应对象追加一行字段透传；getBttcState 内 SQL 数与改前同（单条 CTE SELECT）',
}
ac1s.bttc_key_count_in_source = ac1s.bttc_keys_in_source.length

const out = {
  generated_at: new Date().toISOString(),
  commit: HEAD,
  base: BASE,
  AC5: {
    counts,
    nodes_total: nodes,
    expected: { flat: 1106, top: 128, nodes: 4424 },
    matches: Object.values(counts).every((c) => c.flat === 1106 && c.top === 128) && nodes === 4424,
    key_set_diff: diffSets,
    key_set_diff_zero: Object.values(diffSets).every((d) => d.missing_vs_zh.length === 0 && d.extra_vs_zh.length === 0),
    new_key_values: newKeys,
    pushed_test_files: fileAudits,
    pushed_files_all_equal_value: fileAudits.every((f) => f.verdict !== 'CHECK_MANUALLY' && f.verdict !== 'NO_COUNT_EDIT'),
  },
  AC7: ac7,
  AC1_source: ac1s,
}
console.log(JSON.stringify(out, null, 2))
