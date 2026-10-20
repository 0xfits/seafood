/**
 * 详情页改版批次 · 独立质检（Zang）公共库
 * ---------------------------------------------------------------------------
 * · 库 = dev（backend-ts/.env.local 的 DATABASE_URL；**显式解析 env 文件、不吃 process.env**，
 *   避免同会话 source 过生产串导致探针写错库 —— 技能已知坑）。
 * · 每份读数都带 `db.project_id` 自证连的是 dev，不是生产。
 * · HTTP = 本地 dev 实例（5788，IPv6 *）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

export const REPO = '/Users/kevin/bistro/seafood'
export const BACKEND = path.join(REPO, 'backend-ts')
export const QA_DIR = path.join(REPO, 'ops/item-detail/qa')
export const OUT_DIR = path.join(QA_DIR, 'readings')
export const SCRATCH = '/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa'
export const API = process.env.QA_API || 'http://localhost:5788'
export const EXPECTED_PROJECT = 'quiet-math-65207667'

const req = createRequire(path.join(BACKEND, 'package.json'))
const { neon } = req('@neondatabase/serverless')
const ethers = req('ethers')

const envMap = (() => {
  const text = fs.readFileSync(path.join(BACKEND, '.env.local'), 'utf8')
  const out = {}
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
})()

export const DEV_URL = envMap.DATABASE_URL_UNPOOLED || envMap.DATABASE_URL
if (!DEV_URL) throw new Error('dev DATABASE_URL not found in backend-ts/.env.local')
export const sql = neon(DEV_URL)

export const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6)
export const runName = (base) => `${base}-${RUN}.json`

export const save = (name, obj) => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, runName(name))
  const payload = { run: RUN, name, at: new Date().toISOString(), ...obj }
  fs.writeFileSync(file, JSON.stringify(payload, null, 2))
  return file
}

export const dbIdentity = async () => {
  const r = await sql`SELECT current_setting('neon.project_id', true) AS project_id,
                             current_setting('neon.branch_id', true) AS branch_id,
                             current_database() AS database`
  const v = r[0] || {}
  if (v.project_id !== EXPECTED_PROJECT) {
    throw new Error(`DB identity mismatch: expected dev ${EXPECTED_PROJECT}, got ${JSON.stringify(v)}`)
  }
  return v
}

// ---- HTTP -------------------------------------------------------------------
export const http = async (method, urlPath, { token, body, headers } = {}) => {
  const res = await fetch(API + urlPath, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  let json = null
  const text = await res.text()
  try { json = text ? JSON.parse(text) : null } catch { json = { _raw: text.slice(0, 400) } }
  return { status: res.status, json, headers: Object.fromEntries(res.headers.entries()), body: text }
}

// ---- 账户（真钱包 EIP-191 签名登录） ------------------------------------------
export const accountFile = path.join(SCRATCH, 'accounts.json')
export const loadAccounts = () => {
  try { return JSON.parse(fs.readFileSync(accountFile, 'utf8')) } catch { return null }
}
export const saveAccounts = (obj) => {
  fs.mkdirSync(SCRATCH, { recursive: true })
  fs.writeFileSync(accountFile, JSON.stringify(obj, null, 2), { mode: 0o600 })
}

export const loginWallet = async (privateKey) => {
  const wallet = new ethers.Wallet(privateKey)
  const evm = wallet.address.toLowerCase()
  const ch = await http('POST', '/api/auth/challenge', { body: { evm_address: evm } })
  if (ch.status !== 200) throw new Error(`challenge failed ${ch.status} ${ch.body.slice(0, 200)}`)
  const signature = await wallet.signMessage(ch.json.data.message)
  const vr = await http('POST', '/api/auth/verify', {
    body: { evm_address: evm, signature, challenge_token: ch.json.data.challenge_token },
  })
  if (vr.status !== 200) throw new Error(`verify failed ${vr.status} ${vr.body.slice(0, 300)}`)
  return { evm, uid: vr.json.data.uID, token: vr.json.data.token, user: vr.json.data }
}

/** 造/取两个真钱包账户（私钥只落 scratch、600、不入仓） */
export const ensureAccounts = async () => {
  let a = loadAccounts()
  if (!a) {
    a = {
      A: { privateKey: ethers.Wallet.createRandom().privateKey },
      B: { privateKey: ethers.Wallet.createRandom().privateKey },
    }
  }
  const A = await loginWallet(a.A.privateKey)
  const B = await loginWallet(a.B.privateKey)
  saveAccounts({ A: { privateKey: a.A.privateKey, uid: A.uid, evm: A.evm }, B: { privateKey: a.B.privateKey, uid: B.uid, evm: B.evm } })
  return { A, B }
}

// ---- 夹具标记 ----------------------------------------------------------------
export const FIXTURE_TAG = 'QAID50' // 描述首行前缀 = 本批夹具唯一标记
export const fixtureDescription = (label) => `${FIXTURE_TAG}-${label}-${RUN}\n质检夹具 ${label}（独立质检自建，收口即删）`

export const createFixtureListing = async (token, { label, price = 88, stock = 2, itemType, itemCondition, mediaUrls }) => {
  const body = {
    cid: 1,
    price,
    stock,
    description: fixtureDescription(label),
    create_key: `cli:${randomUUID()}`,
  }
  if (itemType !== undefined) body.item_type = itemType
  if (itemCondition !== undefined) body.item_condition = itemCondition
  if (mediaUrls !== undefined) body.media_urls = mediaUrls
  const r = await http('POST', '/api/listing', { token, body })
  return r
}

// ---- 库读数 ------------------------------------------------------------------
export const tableCounts = async () => {
  const r = await sql`
    SELECT
      (SELECT count(*) FROM public.listing)::int            AS listing,
      (SELECT count(*) FROM public.listing_favorite)::int   AS listing_favorite,
      (SELECT count(*) FROM public.listing_view_log)::int   AS listing_view_log`
  return r[0]
}

export const fixtureListings = async () => {
  const rows = await sql`
    SELECT listing_id, seller_uid, status, item_type, item_condition, view_count,
           split_part(description, E'\n', 1) AS title, media_urls
      FROM public.listing
     WHERE split_part(description, E'\n', 1) LIKE ${FIXTURE_TAG + '-%'}
     ORDER BY listing_id`
  return rows
}

export const dbRow = async (listingId) => {
  const rows = await sql`
    SELECT listing_id, seller_uid, cid, price, stock, status, item_type, item_condition, view_count,
           description, media_urls
      FROM public.listing WHERE listing_id = ${listingId}`
  return rows[0] || null
}

export const viewLogCount = async (listingId) => {
  const r = listingId === undefined
    ? await sql`SELECT count(*)::int AS n FROM public.listing_view_log`
    : await sql`SELECT count(*)::int AS n FROM public.listing_view_log WHERE listing_id = ${listingId}`
  return r[0].n
}

export const dedupConfig = async () => {
  const r = await sql`SELECT value FROM public.app_config WHERE key = 'detail_view_dedup'`
  return r[0] ? r[0].value : null
}

export const setDedupConfig = async (valueObj) => {
  // 单语句写（对象包裹满足 0017 容器 CHECK）；写入前后各读一次由调用方记录
  const r = await sql`
    UPDATE public.app_config SET value = ${JSON.stringify(valueObj)}::jsonb
     WHERE key = 'detail_view_dedup'
    RETURNING value`
  return r[0] ? r[0].value : null
}

export const triggerStates = async () => {
  const rows = await sql`
    SELECT tgname, tgenabled FROM pg_trigger
     WHERE tgrelid = 'public.listing'::regclass AND NOT tgisinternal
     ORDER BY tgname`
  return rows
}
