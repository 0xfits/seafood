/**
 * H5 390 回归对拍（步 2 · Web 两栏只许 ≥768 生效）
 * 用法：node probe-front-compare.mjs <baseline.json> <current.json> <out.json>
 *   baseline = 改前形态（git 74fd56f 构建，QA_DIST 指向该 dist）的探针读数
 *   current  = 本批改动后的探针读数
 * 判据：cases.h5_390 子树逐键深比 ⇒ 差异集为空（H5 行为零变化）；
 *   同时落 baseline 的 web1536 verdict（改前必须红 = 尺子灵敏度自证）。
 *   views 数值随夹具访问序列走、两跑同序 ⇒ 可比；任何 diff 都会逐键列出路径与两侧值。
 */
import fs from 'node:fs'
import path from 'node:path'

const [baselinePath, currentPath, outPath] = process.argv.slice(2)
const deepDiff = (a, b, prefix = '', acc = []) => {
  if (JSON.stringify(a) === JSON.stringify(b)) return acc
  const bothObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v)
  if (bothObj(a) && bothObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) deepDiff(a?.[k], b?.[k], `${prefix}.${k}`, acc)
  } else {
    acc.push({ path: prefix, baseline: a, current: b })
  }
  return acc
}

const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const cur = JSON.parse(fs.readFileSync(currentPath, 'utf8'))
const diffs = deepDiff(base.cases.h5_390, cur.cases.h5_390, 'cases.h5_390')
const out = {
  generatedAt: new Date().toISOString(),
  baseline: { dist: base.dist, source: baselinePath },
  current: { dist: cur.dist, source: currentPath },
  h5_390_diffCount: diffs.length,
  h5_390_diffs: diffs,
  // 尺子灵敏度：改前形态 web1536 臂必须非绿（存在 false/null 判据）
  baseline_web1536_verdict: base.verdict.web1536,
  baseline_sensitivity_red: base.verdict.web1536 != null
    && Object.values(base.verdict.web1536).some((v) => v !== true),
  verdict: { h5_390_regression_zero_change: diffs.length === 0 },
}
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(`h5_390 diffCount: ${diffs.length}`)
console.log(`baseline web1536 red (sensitivity): ${out.baseline_sensitivity_red}`)
console.log(`verdict: ${JSON.stringify(out.verdict)}`)
if (diffs.length) console.log(JSON.stringify(diffs, null, 2).slice(0, 4000))
