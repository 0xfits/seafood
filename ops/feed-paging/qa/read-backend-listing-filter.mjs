/**
 * FEED-PAGING-v1 · 后端「只列可展示商品」读数（dev，只读）
 *   · DB 层：listing 按 status 计数 + 非 listed 的 bID 清单（真源 = DB）
 *   · HTTP 层：/api/prize/all（分页两口）+ /api/home（prize_limit 8 / 16）逐行 bID
 *   · 判据：HTTP 返回的 bID 集合 ⊆ DB listed 集合；且与非 listed 集合交集 = 0
 * 用法：cd backend-ts && node ../ops/feed-paging/qa/read-backend-listing-filter.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'backend-ts/package.json'))
const { neon } = require('@neondatabase/serverless')
require('dotenv').config({ path: path.join(REPO, 'backend-ts/.env.local') })

const OUT = path.join(REPO, 'ops/feed-paging/qa/readings/backend-listing-filter.json')
const API = 'http://localhost:5788'

const getJson = async (p) => {
  const res = await fetch(API + p)
  const json = await res.json()
  return { status: res.status, success: json.success === true, rows: Array.isArray(json.data) ? json.data : [], raw: json.data }
}

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)

const pid = await sql`SELECT current_setting('neon.project_id', true) AS pid`
const byStatus = await sql`SELECT status, count(*)::int AS n FROM public.listing GROUP BY status ORDER BY n DESC`
const listed = (await sql`SELECT listing_id FROM public.listing WHERE status = 'listed' ORDER BY listing_id`).map((r) => Number(r.listing_id))
const notListed = (await sql`SELECT listing_id, status FROM public.listing WHERE status <> 'listed' ORDER BY listing_id`)

const page0 = await getJson('/api/prize/all?skip=0&limit=36')
const page1 = await getJson('/api/prize/all?skip=36&limit=36')
const home8 = await getJson('/api/home?task_limit=6&prize_limit=8')
const home16 = await getJson('/api/home?task_limit=6&prize_limit=16')

const ids0 = page0.rows.map((r) => Number(r.bID))
const ids1 = page1.rows.map((r) => Number(r.bID))
const home8Ids = (home8.raw?.prizes || []).map((r) => Number(r.bID))
const home16Ids = (home16.raw?.prizes || []).map((r) => Number(r.bID))
const notListedIds = notListed.map((r) => Number(r.listing_id))

const leaks = {
  prize_all_p0: ids0.filter((id) => notListedIds.includes(id)),
  prize_all_p1: ids1.filter((id) => notListedIds.includes(id)),
  home_prize_limit8: home8Ids.filter((id) => notListedIds.includes(id)),
  home_prize_limit16: home16Ids.filter((id) => notListedIds.includes(id)),
}

const out = {
  at: new Date().toISOString(),
  env: { neon_project_id: pid[0]?.pid, api: API },
  db: {
    by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    total: byStatus.reduce((n, r) => n + r.n, 0),
    listed_ids: listed,
    not_listed: notListed.map((r) => ({ bID: Number(r.listing_id), status: r.status })),
  },
  http: {
    'GET /api/prize/all?skip=0&limit=36': { status: page0.status, success: page0.success, count: ids0.length, bIDs: ids0 },
    'GET /api/prize/all?skip=36&limit=36': { status: page1.status, success: page1.success, count: ids1.length, bIDs: ids1 },
    'GET /api/home?task_limit=6&prize_limit=8': { status: home8.status, count: home8Ids.length, bIDs: home8Ids },
    'GET /api/home?task_limit=6&prize_limit=16': { status: home16.status, count: home16Ids.length, bIDs: home16Ids },
  },
  non_listed_leaks: leaks,
  checks: {
    prize_all_equals_db_listed: JSON.stringify([...ids0].sort((a, b) => a - b)) === JSON.stringify([...listed].sort((a, b) => a - b)),
    prize_all_second_page_empty: ids1.length === 0,
    home_prizes_all_listed: home8Ids.every((id) => listed.includes(id)) && home16Ids.every((id) => listed.includes(id)),
    zero_non_listed_leak: Object.values(leaks).every((v) => v.length === 0),
  },
}
out.all_pass = Object.values(out.checks).every(Boolean)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
console.log(JSON.stringify({ checks: out.checks, all_pass: out.all_pass, db: out.db.by_status, http: out.http }, null, 2))
console.log('READING=' + OUT)
