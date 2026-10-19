/**
 * BATCH-1019-3 · 数据面读数（只读）
 *   ① /api/prize/all 的 bID 集合 vs DB listing.status='listed' 集合（逐项相等）
 *   ② 分页第 2 页（skip=36）真后端返回 0 行（dev listed=9 < 36）
 *   ③ /api/home 的 prizes 全为 listed、响应键集不变
 *   ④ draft 商品详情（/api/prize/22、/api/prize/1）仍可读、行键 46
 *   ⑤ /api/currencies 2 行；/api/media/999 → 404
 * 输出：ops/batch-1019-3/qa/readings/api-db.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'backend-ts/package.json'))
const { neon } = require('@neondatabase/serverless')
const OUT_DIR = path.join(REPO, 'ops/batch-1019-3/qa/readings')
fs.mkdirSync(OUT_DIR, { recursive: true })

const API = 'http://localhost:5788'
const env = Object.fromEntries(
  fs.readFileSync(path.join(REPO, 'backend-ts/.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }),
)
const sql = neon(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL)

const getJson = async (p) => {
  const res = await fetch(API + p)
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-json */ }
  return { path: p, status: res.status, json, bytes: text.length }
}

const run = async () => {
  const out = { at: new Date().toISOString(), api: API }

  const proj = await sql`SELECT current_setting('neon.project_id') AS project_id, current_setting('neon.branch_id') AS branch_id`
  out.db_identity = proj[0]

  const rows = await sql`SELECT listing_id, status, title FROM public.listing ORDER BY listing_id`
  const byStatus = {}
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1
  const listedIds = rows.filter((r) => r.status === 'listed').map((r) => Number(r.listing_id))
  const nonListedIds = rows.filter((r) => r.status !== 'listed').map((r) => Number(r.listing_id))
  out.db = {
    total: rows.length,
    by_status: byStatus,
    listed_ids: listedIds,
    non_listed_ids_sample: nonListedIds.slice(0, 10),
    non_listed_count: nonListedIds.length,
  }

  const all = await getJson('/api/prize/all?skip=0&limit=36')
  const allRows = (all.json && all.json.data) || []
  const apiIds = allRows.map((r) => Number(r.bID))
  out.prize_all = {
    status: all.status,
    success: all.json && all.json.success,
    count: apiIds.length,
    bIDs: apiIds,
    row_key_count: allRows[0] ? Object.keys(allRows[0]).length : 0,
    set_equals_listed: apiIds.length === listedIds.length
      && apiIds.every((id) => listedIds.includes(id))
      && listedIds.every((id) => apiIds.includes(id)),
    missing_from_api: listedIds.filter((id) => !apiIds.includes(id)),
    extra_in_api: apiIds.filter((id) => !listedIds.includes(id)),
    draft_or_delisted_leaked: apiIds.filter((id) => nonListedIds.includes(id)),
  }

  const page2 = await getJson('/api/prize/all?skip=36&limit=36')
  out.prize_all_page2 = {
    status: page2.status,
    count: ((page2.json && page2.json.data) || []).length,
    bIDs: ((page2.json && page2.json.data) || []).map((r) => r.bID),
  }

  const pageOverlap = await getJson('/api/prize/all?skip=8&limit=36')
  out.prize_all_skip8 = {
    count: ((pageOverlap.json && pageOverlap.json.data) || []).length,
    bIDs: ((pageOverlap.json && pageOverlap.json.data) || []).map((r) => r.bID),
  }

  const home = await getJson('/api/home?task_limit=6&prize_limit=20')
  const payload = (home.json && home.json.data) || {}
  const homePrizes = payload.prizes || []
  out.home = {
    status: home.status,
    success: home.json && home.json.success,
    payload_keys: Object.keys(payload).sort(),
    expected_keys: ['claimed_prize_ids', 'is_authenticated', 'prizes', 'tasks', 'user_points'],
    key_set_unchanged: JSON.stringify(Object.keys(payload).sort())
      === JSON.stringify(['claimed_prize_ids', 'is_authenticated', 'prizes', 'tasks', 'user_points']),
    prizes_count: homePrizes.length,
    prizes_bIDs: homePrizes.map((p) => Number(p.bID)),
    prizes_all_listed: homePrizes.every((p) => listedIds.includes(Number(p.bID))),
    tasks_count: (payload.tasks || []).length,
    is_authenticated: payload.is_authenticated,
    user_points: payload.user_points,
  }

  const detail = {}
  for (const id of [1, 22, 76]) {
    const d = await getJson(`/api/prize/${id}`)
    const dd = (d.json && d.json.data) || {}
    const dbRow = rows.find((r) => Number(r.listing_id) === id)
    detail[id] = {
      db_status: dbRow ? dbRow.status : null,
      status: d.status,
      success: d.json && d.json.success,
      readable: !!(d.json && d.json.success && dd && dd.bID != null),
      row_key_count: Object.keys(dd).length,
      has_status_field: 'status' in dd,
    }
  }
  out.detail = detail

  const cur = await getJson('/api/currencies')
  out.currencies = {
    status: cur.status,
    rows: (cur.json && cur.json.data) || [],
    count: ((cur.json && cur.json.data) || []).length,
  }

  const media = await getJson('/api/media/999')
  out.media_999 = { status: media.status, body_head: JSON.stringify(media.json).slice(0, 160) }

  fs.writeFileSync(path.join(OUT_DIR, 'api-db.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({
    project: out.db_identity.project_id,
    db_total: out.db.total,
    by_status: out.db.by_status,
    api_count: out.prize_all.count,
    set_equals: out.prize_all.set_equals_listed,
    leaked: out.prize_all.draft_or_delisted_leaked,
    page2: out.prize_all_page2.count,
    home_keys: out.home.payload_keys,
    home_prizes_all_listed: out.home.prizes_all_listed,
    detail: out.detail,
    currencies: out.currencies.count,
    media999: out.media_999.status,
  }, null, 2))
}

run().catch((e) => { console.error('READ-FAILED', e); process.exit(1) })
