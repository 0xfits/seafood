/**
 * 质检脚本 02 · 去重开关双态（AC2）
 * ---------------------------------------------------------------------------
 * 开关值经 `app_config` 单行写（committed）+ 每步还原读数；跑完强制复原为 {"dedup":"off"}。
 * 计数读数一律取 **库内 view_count**（不用 HTTP 响应，避免「测量本身计数」污染）。
 */
import fs from 'node:fs'
import {
  dbIdentity, tableCounts, save, http, ensureAccounts, dbRow, viewLogCount,
  dedupConfig, setDedupConfig,
} from './lib.mjs'

const fx = JSON.parse(fs.readFileSync('/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa/fixtures.json', 'utf8'))
const HOST = fx.ids.HW    // 专用于本臂（当前 views 已被 01 脚本之外的读数影响 ⇒ 只用增量）
const ALT = fx.ids.MW
const out = { api: 'http://localhost:5788', listing_hw: HOST, listing_mw: ALT, arms: [] }
const num = (v) => Number(v)

const views = async (id) => num((await dbRow(id)).view_count)
const logs = async (id) => viewLogCount(id)

const arm = async (name, fn) => {
  const r = await fn()
  out.arms.push({ arm: name, ...r })
  console.log('·', name, JSON.stringify(r).slice(0, 400))
  return r
}

const main = async () => {
  out.db = await dbIdentity()
  out.config_before = await dedupConfig()
  out.counts_before = await tableCounts()

  const { A, B } = await ensureAccounts()
  out.accounts = { A: A.uid, B: B.uid }

  // ================= 臂 1：{"dedup":"on"} =================
  const w1 = await setDedupConfig({ dedup: 'on' })
  out.config_set_on = w1
  await arm('on · 同 uid 连续 2 次', async () => {
    const v0 = await views(HOST); const l0 = await logs(HOST)
    const r1 = await http('GET', `/api/prize/${HOST}`, { token: A.token })
    const v1 = await views(HOST)
    const r2 = await http('GET', `/api/prize/${HOST}`, { token: A.token })
    const v2 = await views(HOST)
    const l2 = await logs(HOST)
    return {
      views: [v0, v1, v2], view_delta_total: v2 - v0,
      resp_views: [r1.json?.data?.views, r2.json?.data?.views],
      statuses: [r1.status, r2.status],
      log_rows_before: l0, log_rows_after: l2, log_delta: l2 - l0,
      pass: v2 - v0 === 1 && l2 - l0 === 1,
    }
  })

  await arm('on · 异 uid（B）', async () => {
    const v0 = await views(HOST); const l0 = await logs(HOST)
    const r = await http('GET', `/api/prize/${HOST}`, { token: B.token })
    const v1 = await views(HOST); const l1 = await logs(HOST)
    return {
      status: r.status, views: [v0, v1], view_delta: v1 - v0,
      log_delta: l1 - l0, pass: v1 - v0 === 1 && l1 - l0 === 1,
    }
  })

  await arm('on · 异 x-sf-viewer 头（同头两次 + 换头一次）', async () => {
    const v0 = await views(HOST); const l0 = await logs(HOST)
    const h1 = 'qa-anon-11111111'
    const a1 = await http('GET', `/api/prize/${HOST}`, { headers: { 'x-sf-viewer': h1 } })
    const v1 = await views(HOST)
    const a2 = await http('GET', `/api/prize/${HOST}`, { headers: { 'x-sf-viewer': h1 } })
    const v2 = await views(HOST)
    const h2 = 'qa-anon-22222222'
    const a3 = await http('GET', `/api/prize/${HOST}`, { headers: { 'x-sf-viewer': h2 } })
    const v3 = await views(HOST)
    const l3 = await logs(HOST)
    return {
      statuses: [a1.status, a2.status, a3.status],
      views: [v0, v1, v2, v3], deltas: [v1 - v0, v2 - v1, v3 - v2],
      log_rows: l3, log_delta: l3 - l0,
      rows: await (async () => {
        const { sql } = await import('./lib.mjs')
        return sql`SELECT viewer_key, view_day, count(*)::int AS n FROM public.listing_view_log
                    WHERE listing_id = ${HOST} GROUP BY viewer_key, view_day ORDER BY viewer_key`
      })(),
      pass: v1 - v0 === 1 && v2 - v1 === 0 && v3 - v2 === 1,
    }
  })

  await arm('on · 匿名无头无 cookie（发 cookie，同访客复读不涨）', async () => {
    const v0 = await views(HOST); const l0 = await logs(HOST)
    const r1 = await http('GET', `/api/prize/${HOST}`)
    const v1 = await views(HOST)
    const setCookie = r1.headers['set-cookie'] || ''
    const m = /sf_viewer=([^;]+)/.exec(setCookie)
    const cacheControl = r1.headers['cache-control'] || ''
    const r2 = m ? await http('GET', `/api/prize/${HOST}`, { headers: { cookie: `sf_viewer=${m[1]}` } }) : null
    const v2 = await views(HOST)
    const l2 = await logs(HOST)
    return {
      statuses: [r1.status, r2?.status ?? null],
      set_cookie_present: Boolean(m), cache_control_after_mint: cacheControl,
      views: [v0, v1, v2], view_delta: v2 - v0, log_delta: l2 - l0,
      pass: Boolean(m) && v1 - v0 === 1 && v2 - v1 === 0,
    }
  })

  await arm('on · 404 不写日志不计数', async () => {
    const l0 = await viewLogCount()
    const r = await http('GET', '/api/prize/99999999', { token: A.token })
    const l1 = await viewLogCount()
    return { status: r.status, log_total: [l0, l1], log_delta: l1 - l0, pass: r.status === 404 && l1 === l0 }
  })

  // ================= 臂 2：{"dedup":"off"} =================
  const w2 = await setDedupConfig({ dedup: 'off' })
  out.config_set_off = w2
  await arm('off · 同 uid 连刷 3 次必涨', async () => {
    const v0 = await views(ALT); const l0 = await logs(ALT)
    const rs = []
    for (let i = 0; i < 3; i += 1) rs.push(await http('GET', `/api/prize/${ALT}`, { token: A.token }))
    const v1 = await views(ALT); const l1 = await logs(ALT)
    return {
      statuses: rs.map((r) => r.status), resp_views: rs.map((r) => r.json?.data?.views),
      views: [v0, v1], view_delta: v1 - v0, log_delta: l1 - l0,
      pass: v1 - v0 === 3 && l1 - l0 === 0,
    }
  })

  // ================= 臂 3：非法值 fail-safe =================
  const w3 = await setDedupConfig({ dedup: 'banana' })
  out.config_set_invalid = w3
  await arm('非法值 "banana" ⇒ 按 on（同 uid 二次不涨）', async () => {
    const v0 = await views(HOST)
    const r1 = await http('GET', `/api/prize/${HOST}`, { token: A.token })
    const v1 = await views(HOST)
    const r2 = await http('GET', `/api/prize/${HOST}`, { token: A.token })
    const v2 = await views(HOST)
    const l2 = await logs(HOST)
    return {
      statuses: [r1.status, r2.status], views: [v0, v1, v2], view_delta: v2 - v0,
      log_rows_total_for_listing: l2, pass: v2 - v0 === 0,
    }
  })

  // 缺字段 / 缺行 形态（同族 fail-safe）：字段名换成别的键
  const w4 = await setDedupConfig({ other: 'on' })
  out.config_set_missing_field = w4
  await arm('缺字段 {"other":"on"} ⇒ 按 on', async () => {
    const v0 = await views(ALT)
    await http('GET', `/api/prize/${ALT}`, { token: A.token })
    await http('GET', `/api/prize/${ALT}`, { token: A.token })
    const v2 = await views(ALT)
    return { views: [v0, v2], view_delta: v2 - v0, pass: v2 - v0 === 0 }
  })

  // ================= 复原 =================
  const restored = await setDedupConfig({ dedup: 'off' })
  out.config_restored = restored
  out.restore_verify = (await dedupConfig())
  await arm('复原后复读：off ⇒ 连刷涨（行为回到现状）', async () => {
    const v0 = await views(ALT)
    await http('GET', `/api/prize/${ALT}`, { token: A.token })
    await http('GET', `/api/prize/${ALT}`, { token: A.token })
    const v2 = await views(ALT)
    return { views: [v0, v2], view_delta: v2 - v0, pass: v2 - v0 === 2 }
  })

  out.counts_after = await tableCounts()
  out.all_pass = out.arms.every((a) => a.pass === true)
  out.file = save('02-dedup-toggle-ac2', out)
  console.log('READING:', out.file)
  console.log('ALL_PASS', out.all_pass, 'RESTORED', JSON.stringify(out.restore_verify))
}

main().catch(async (e) => {
  console.error('FATAL', e)
  try {
    const { setDedupConfig: restore } = await import('./lib.mjs')
    console.log('RESTORE_ON_ERROR', JSON.stringify(await restore({ dedup: 'off' })))
  } catch (e2) { console.error('restore failed', e2) }
  process.exit(1)
})
