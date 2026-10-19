// AC4 · wants 数据面真库往返（dev 库 · 只写 1 行 favorite 且必须回收）
// ============================================================================
// 步骤：① listing_favorite 计数（前）② 插 1 行（listed 商品 + 既有 uid，ON CONFLICT DO NOTHING）
//       ③ `/api/prize/all` 行键 47 + 该行 wants=1 ④ `/api/prize/:bID` 仍 46 键（wants 不进详情）
//       ⑤ DELETE 回收 ⑥ 计数（后）+ 该行 wants=0
// 自证：每份读数都打 `neon.project_id`（必须是 dev = quiet-math-65207667），不符即中止且不写库。
// 运行：node ops/card-rows/qa/db-wants-roundtrip.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const require = createRequire(path.join(REPO, 'backend-ts/package.json'))
const { neon } = require('@neondatabase/serverless')

const API = 'http://localhost:5788'
const OUT = path.join(HERE, 'readings/db-wants.json')
const EXPECT_PROJECT = 'quiet-math-65207667' // dev

const env = fs.readFileSync(path.join(REPO, 'backend-ts/.env.local'), 'utf8')
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '')
const sql = neon(url)

const TARGET_LISTING = 13 // listed（dev 现取 status='listed'）
const TARGET_UID = 1      // users 现取存在

const steps = []
const rec = (id, ok, actual, expected, note) => { steps.push({ id, ok: !!ok, actual, expected, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`, JSON.stringify(actual)) }
const apiJson = async (p) => {
  const r = await fetch(API + p + (p.includes('?') ? '&' : '?') + '_ts=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } })
  return { status: r.status, body: await r.json().catch(() => null), cacheControl: r.headers.get('cache-control') }
}

let inserted = false
const main = async () => {
  const pid = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid
  if (pid !== EXPECT_PROJECT) throw new Error(`拒绝写库：project_id=${pid} ≠ dev ${EXPECT_PROJECT}`)

  const target = await sql`SELECT listing_id, status FROM public.listing WHERE listing_id = ${TARGET_LISTING}`
  if (!target.length || target[0].status !== 'listed') throw new Error('目标商品不在 listed 态')
  const uidOk = await sql`SELECT uid FROM public.users WHERE uid = ${TARGET_UID}`
  if (!uidOk.length) throw new Error('目标 uid 不存在')

  const before = (await sql`SELECT count(*)::int AS n FROM public.listing_favorite`)[0].n
  const beforeApi = await apiJson('/api/prize/all?limit=50')
  const beforeRow = (beforeApi.body?.data || []).find((r) => Number(r.bID) === TARGET_LISTING)
  rec('before.count', true, { project_id: pid, favorite_rows: before, apiRowCount: (beforeApi.body?.data || []).length, rowKeys: beforeRow ? Object.keys(beforeRow).length : null, wants: beforeRow?.wants, cacheControl: beforeApi.cacheControl }, '基线（表 0 行 · 行键 47 · wants 0）')

  try {
    const ins = await sql`INSERT INTO public.listing_favorite (fav_uid, listing_id) VALUES (${TARGET_UID}, ${TARGET_LISTING}) ON CONFLICT (fav_uid, listing_id) DO NOTHING RETURNING fav_id`
    inserted = ins.length > 0
    const afterIns = (await sql`SELECT count(*)::int AS n FROM public.listing_favorite`)[0].n
    rec('insert', inserted, { insertedRows: ins.length, fav_id: ins[0] ? String(ins[0].fav_id) : null, favorite_rows: afterIns }, '插 1 行（ON CONFLICT DO NOTHING）')

    const feed = await apiJson('/api/prize/all?limit=50')
    const row = (feed.body?.data || []).find((r) => Number(r.bID) === TARGET_LISTING)
    const keys = row ? Object.keys(row).sort() : []
    rec('feed.rowKeys=47', keys.length === 47, { keys: keys.length, hasWants: keys.includes('wants') }, 47)
    rec('feed.wants=1', Number(row?.wants) === 1, { bID: row?.bID, wants: row?.wants, type: typeof row?.wants }, 1)
    const distinctKeySets = new Set((feed.body?.data || []).map((r) => Object.keys(r).sort().join(',')))
    rec('feed.allRowsSameShape', distinctKeySets.size === 1, { distinctShapeCount: distinctKeySets.size, rows: (feed.body?.data || []).length }, 1)

    const detail = await apiJson(`/api/prize/${TARGET_LISTING}`)
    const dkeys = Object.keys(detail.body?.data || {})
    rec('detail.rowKeys=46', dkeys.length === 46, { keys: dkeys.length, hasWants: dkeys.includes('wants'), bID: detail.body?.data?.bID }, 46)
    const detail1 = await apiJson('/api/prize/1')
    rec('detail1.rowKeys=46', Object.keys(detail1.body?.data || {}).length === 46, { keys: Object.keys(detail1.body?.data || {}).length, hasWants: 'wants' in (detail1.body?.data || {}) }, 46)
  } finally {
    // 回收（无论中间成败都必须跑）
    const del = await sql`DELETE FROM public.listing_favorite WHERE fav_uid = ${TARGET_UID} AND listing_id = ${TARGET_LISTING} RETURNING fav_id`
    const after = (await sql`SELECT count(*)::int AS n FROM public.listing_favorite`)[0].n
    const feed2 = await apiJson('/api/prize/all?limit=50')
    const row2 = (feed2.body?.data || []).find((r) => Number(r.bID) === TARGET_LISTING)
    rec('cleanup.deleted', del.length === (inserted ? 1 : 0), { deletedRows: del.length, favorite_rows_after: after }, inserted ? 1 : 0)
    rec('cleanup.wants=0', Number(row2?.wants) === 0, { bID: row2?.bID, wants: row2?.wants, rowKeys: row2 ? Object.keys(row2).length : null }, 0)
    rec('cleanup.zeroRows', after === 0, { favorite_rows: after }, 0)
  }

  const ok = steps.every((s) => s.ok)
  fs.writeFileSync(OUT, JSON.stringify({ finished: new Date().toISOString(), project_id: pid, target: { listing_id: TARGET_LISTING, uid: TARGET_UID }, steps, ok }, null, 2))
  console.log('SUMMARY', JSON.stringify({ ok, steps: steps.length, failed: steps.filter((s) => !s.ok).map((s) => s.id) }))
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('ERROR', e)
  fs.writeFileSync(OUT, JSON.stringify({ error: String(e && e.stack || e), steps }, null, 2))
  process.exit(2)
})
