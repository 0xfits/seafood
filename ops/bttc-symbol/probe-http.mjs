// dev 活体 HTTP 探针（真 token · 本机 HMAC 签发 · 零写库路径）
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const req = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json')
const { neon } = req('@neondatabase/serverless')
const dotenv = req('dotenv')
const REPO = '/Users/kevin/bistro/seafood'
const BASE = process.env.BASE || 'http://127.0.0.1:5788'
const p = dotenv.parse(fs.readFileSync(path.join(REPO, 'backend-ts/.env.local')))
const sql = neon(p.DATABASE_URL_UNPOOLED || p.POSTGRES_URL_NON_POOLING || p.DATABASE_URL)
const sign = (payload, secret) => {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const u = `${h}.${b}`
  return `${u}.${crypto.createHmac('sha256', secret).update(u).digest('base64url')}`
}
const tok = (uid) => sign({ sub: String(uid), evm: '', exp: Math.floor(Date.now() / 1000) + 600 }, p.SECRET_KEY)
const out = { base: BASE }
const get = async (url, token) => {
  const r = await fetch(BASE + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const body = await r.json().catch(() => null)
  return { http: r.status, body }
}
const post = async (url, token, payload) => {
  const r = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  })
  const body = await r.json().catch(() => null)
  return { http: r.status, body }
}
;(async () => {
  const pid = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid
  const holders = await sql`SELECT a.uid::text AS uid, a.balance::text AS bal FROM public.account AS a
     WHERE a.cid = (SELECT cid FROM public.currency WHERE is_platform_coin = true) ORDER BY a.uid`
  const zeroBatt = await sql`SELECT u.uid::int AS uid FROM public.users AS u
     LEFT JOIN public.batt_account AS b ON b.uid = u.uid
     WHERE COALESCE(b.batt, 0) = 0 ORDER BY u.uid LIMIT 1`
  out.project_id = pid
  out.holders = holders
  out.zero_batt_uid = zeroBatt[0]?.uid ?? null
  const uid = Number(holders[0]?.uid)
  const token = tok(uid)

  out.health = await get('/api/health')
  out.batt = await get('/api/batt', token)
  out.balances = await get('/api/user/balances', token)
  out.balances_unauth = await get('/api/user/balances')
  const z = Number(out.zero_batt_uid)
  const zToken = tok(z)
  out.mint_no_key = await post('/api/bttc/mint', zToken, {})
  out.mint_bad_key = await post('/api/bttc/mint', zToken, { idempotency_key: 'biz:bttc:mint:1' })
  out.burn_no_key = await post('/api/bttc/burn', zToken, {})
  out.burn_bad_key = await post('/api/bttc/burn', zToken, { idempotency_key: 'cli:not-a-uuid' })
  out.mint_insufficient = await post('/api/bttc/mint', zToken, { idempotency_key: `cli:${crypto.randomUUID()}` })
  out.burn_insufficient = await post('/api/bttc/burn', zToken, { idempotency_key: `cli:${crypto.randomUUID()}` })
  const cur = await sql`SELECT cid::text AS cid, symbol, name, is_platform_coin FROM public.currency WHERE is_platform_coin = true`
  out.db_platform_row = cur
  console.log(JSON.stringify(out, (k, v) => (k === 'db_version' ? undefined : v), 1))
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
