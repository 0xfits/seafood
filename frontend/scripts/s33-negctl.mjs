// S33 判负辅助：打印某 styles.css 状态下「可删」是否包含给定选择器，并列出注名后的消费判定。
import { execFileSync } from 'node:child_process'
const [script, css, ...sels] = process.argv.slice(2)
const fs = await import('node:fs')
if (css && css !== '-') fs.copyFileSync(css, script.replace(/scripts\/[^/]+$/, 'src/styles.css'))
const out = execFileSync('node', [script, '--json'], { maxBuffer: 1e8 }).toString()
const j = JSON.parse(out)
const canDel = j.zero.filter((z) => z.state === '可删').map((z) => ({ sel: z.selector, line: z.line }))
const consumed = j.zero.filter((z) => z.state === '保留-有消费').map((z) => z.selector)
const report = { stateCounts: j.counts.stateCounts, canDeleteCount: canDel.length, consumedCount: consumed.length, consults: {} }
for (const s of sels) report.consults[s] = { inCanDelete: canDel.some((z) => z.sel === s), inConsumed: consumed.includes(s) }
console.log(JSON.stringify(report, null, 1))
if (sels.length === 0) console.log('可删前 8:', canDel.slice(0, 8).map((z) => z.sel).join(', '))
