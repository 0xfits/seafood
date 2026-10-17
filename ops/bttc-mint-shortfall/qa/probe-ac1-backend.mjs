// AC1 · 后端契约活体探针（只读 · 零写库）
// 目的：对活体 dev 后端（默认 http://127.0.0.1:5788）取一次真响应，核对
//   ① data.bttc.usdBalance 在场且 typeof === 'string'
//   ② 外层 6 键（batt/capBatt/floorBatt/acceptThresholdBatt/canAccept/updated_at）原样在场
//   ③ bttc 子对象键集 = 11（改前 10 + usdBalance）
//   ④ 零新查询（源码面核对，见 AC1-source.json）
// 鉴权：用 backend-ts/.env.local 的 SECRET_KEY 本地 HMAC 签发一次性 session token（纯计算，不写库）。
//   不调用 /api/auth/*（避免任何服务端写入）。
// 用法：node ops/bttc-mint-shortfall/qa/probe-ac1-backend.mjs [uid...]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const BASE = process.env.BTTC_QA_BASE || 'http://127.0.0.1:5788'

const readSecret = () => {
  const p = path.join(REPO, 'backend-ts/.env.local')
  const txt = fs.readFileSync(p, 'utf8')
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*SECRET_KEY\s*=\s*(.+?)\s*$/)
    if (m) return m[1].replace(/^["']|["']$/g, '')
  }
  throw new Error('SECRET_KEY not found in backend-ts/.env.local')
}

const sign = (payload, secret) => {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const unsigned = `${h}.${p}`
  const s = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url')
  return `${unsigned}.${s}`
}

const OUTER_KEYS = ['batt', 'capBatt', 'floorBatt', 'acceptThresholdBatt', 'canAccept', 'updated_at']

const main = async () => {
  const secret = readSecret()
  const uids = (process.argv.slice(2).map(Number).filter(Boolean))
  const candidates = uids.length ? uids : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const attempts = []
  let ok = null
  for (const uid of candidates) {
    const exp = Math.floor(Date.now() / 1000) + 600
    const token = sign({ sub: String(uid), evm: '', exp }, secret)
    const res = await fetch(`${BASE}/api/batt`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json().catch(() => null)
    attempts.push({ uid, http: res.status, code: body?.error?.code ?? null })
    if (res.status === 200 && body?.data?.bttc) { ok = { uid, body }; break }
  }

  if (!ok) {
    console.log(JSON.stringify({
      status: 'ENV_LIMITED',
      base: BASE,
      reason: 'no reachable authenticated session over candidate uids (token minted locally, no DB writes)',
      attempts,
    }, null, 2))
    process.exit(2)
  }

  const data = ok.body.data
  const bttc = data.bttc
  const outer = Object.keys(data)
  const bttcKeys = Object.keys(bttc)
  const checks = {
    usdBalance_present: Object.prototype.hasOwnProperty.call(bttc, 'usdBalance'),
    usdBalance_typeof: typeof bttc.usdBalance,
    usdBalance_value: bttc.usdBalance,
    usdBalance_is_string: typeof bttc.usdBalance === 'string',
    outer_keys: outer,
    outer_six_intact: OUTER_KEYS.every((k) => outer.includes(k)) && outer.filter((k) => k !== 'bttc').length === 6,
    outer_non_bttc_count: outer.filter((k) => k !== 'bttc').length,
    bttc_keys: bttcKeys,
    bttc_key_count: bttcKeys.length,
    bttc_key_count_ok_10_to_11: bttcKeys.length === 11,
    canMint: bttc.canMint,
    policy: bttc.policy,
    batt: data.batt,
  }
  const pass = checks.usdBalance_is_string && checks.outer_six_intact && checks.bttc_key_count_ok_10_to_11
  console.log(JSON.stringify({
    status: pass ? 'PASS' : 'FAIL',
    base: BASE,
    uid: ok.uid,
    checks,
    raw_batt_response: ok.body,
    attempts,
  }, null, 2))
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.log(JSON.stringify({ status: 'ENV_LIMITED', error: String(e?.message || e) })); process.exit(2) })
