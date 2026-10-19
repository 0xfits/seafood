// QA probe (batch-1019-2 / AC5): dev fixture currency cleanup — READ-ONLY.
// 连接串从 backend-ts/.env.local 经 dotenv.parse 显式构造（禁吃 process.env）；全部语句为 SELECT。
// 自证：current_setting('neon.project_id') 必须写进读数且 = quiet-math-65207667（dev 库）。
import { createRequire } from 'node:module'
import fs from 'node:fs'

const REPO = '/Users/kevin/bistro/seafood'
const OUT = `${REPO}/ops/batch-1019-2/qa/readings/ac5-db-cleanup.json`
const EXPECT_PROJECT = 'quiet-math-65207667'
const EXPECT_FIXTURE_CIDS = [4, 10, 16, 21, 29, 31, 32, 35, 36].sort((a, b) => a - b)

const require = createRequire(`${REPO}/backend-ts/package.json`)
const { neon } = require('@neondatabase/serverless')
const dotenv = require('dotenv')

const parsed = dotenv.parse(fs.readFileSync(`${REPO}/backend-ts/.env.local`, 'utf8'))
const url = parsed.DATABASE_URL_UNPOOLED || parsed.POSTGRES_URL_NON_POOLING || parsed.DATABASE_URL
if (!url) throw new Error('no DATABASE_URL* in backend-ts/.env.local (dotenv.parse)')
// defensive: key NAMES only（值永不打印）
const processEnvLeakKeys = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING']
  .filter((k) => typeof process.env[k] === 'string' && process.env[k].length > 0)

const sql = neon(url)
const result = {
  generatedAt: new Date().toISOString(),
  connSource: 'backend-ts/.env.local via dotenv.parse (explicit构造, 未吃 process.env)',
  processEnvLeakKeys,
  statements: 'all SELECT (read-only)',
}

const ident = await sql`SELECT current_setting('neon.project_id', true) AS project_id, current_setting('neon.branch_id', true) AS branch_id, current_database() AS db_name`
result.identity = ident[0]

const curRows = await sql`SELECT cid::int AS cid, symbol, name, status, listed_at FROM currency ORDER BY cid::int`
result.currencyRowCount = curRows.length
result.currencyAll = curRows
const listed = curRows.filter((r) => r.status === 'listed')
const delisted = curRows.filter((r) => r.status === 'delisted')
result.listed = listed
result.delisted = delisted

const logRows = await sql`SELECT log_id::int AS log_id, cid::int AS cid, from_status, to_status, actor_uid::int AS actor_uid, memo, time_created FROM currency_status_log ORDER BY log_id::int`
result.statusLogCount = logRows.length
result.statusLogAll = logRows
const last9 = logRows.slice(-9)
result.last9 = last9

const last9Cids = [...new Set(last9.map((r) => Number(r.cid)))].sort((a, b) => a - b)
const delistedCids = delisted.map((r) => Number(r.cid)).sort((a, b) => a - b)
const correspondence = last9Cids.map((cid) => {
  const row = curRows.find((r) => Number(r.cid) === cid)
  return { cid, symbol: row ? row.symbol : null, currencyStatus: row ? row.status : null }
})
result.correspondence = correspondence

result.checks = {
  project_id_is_dev_quiet_math: result.identity.project_id === EXPECT_PROJECT,
  listed_count_is_2: listed.length === 2,
  listed_rows_are_usd_bttc:
    listed.length === 2 &&
    listed.some((r) => r.symbol === '$' && Number(r.cid) === 1) &&
    listed.some((r) => r.symbol === 'BTTC' && Number(r.cid) === 399),
  status_log_count_is_16: logRows.length === 16,
  last9_all_to_status_delisted: last9.every((r) => r.to_status === 'delisted'),
  last9_all_memo_dev_cleanup: last9.every((r) => (r.memo || '').includes('dev cleanup')),
  correspondence_9_of_9: last9Cids.length === 9 && correspondence.every((c) => c.currencyStatus === 'delisted'),
}
result.observations = {
  last9_distinct_cids: last9Cids,
  last9_cids_equal_expected_fixtures: JSON.stringify(last9Cids) === JSON.stringify(EXPECT_FIXTURE_CIDS),
  currency_delisted_cid_set: delistedCids,
  delisted_set_equals_audit_set: JSON.stringify(delistedCids) === JSON.stringify(last9Cids),
  currencyRowCount: curRows.length,
}
result.verdict = Object.values(result.checks).every((v) => v === true)

fs.mkdirSync(`${REPO}/ops/batch-1019-2/qa/readings`, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log('project_id =', result.identity.project_id, '| branch =', result.identity.branch_id, '| db =', result.identity.db_name)
console.log('processEnvLeakKeys =', JSON.stringify(processEnvLeakKeys))
console.log('checks =', JSON.stringify(result.checks, null, 1))
console.log('observations =', JSON.stringify(result.observations))
console.log('verdict =', result.verdict)
console.log('WROTE:', OUT)
