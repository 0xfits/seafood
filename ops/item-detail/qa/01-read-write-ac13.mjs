/**
 * 质检脚本 01 · 写口 + 读口键数 + 自增（AC1 · AC3）
 * ---------------------------------------------------------------------------
 * 全走真实 HTTP（真钱包签名登录 + 真写口），夹具自建、收口由 04-cleanup 删。
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  API, SCRATCH, dbIdentity, tableCounts, save, http, ensureAccounts,
  createFixtureListing, fixtureListings, dbRow, viewLogCount, FIXTURE_TAG,
} from './lib.mjs'

const out = { api: API, steps: [] }
const step = (name, data) => { out.steps.push({ name, ...data }); console.log('·', name, JSON.stringify(data).slice(0, 300)) }

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const uploadMedia = async (token) => {
  const r = await http('POST', '/api/media', {
    token,
    body: { content_type: 'image/png', data_base64: PNG_1PX.toString('base64') },
  })
  return r
}

const main = async () => {
  out.db = await dbIdentity()
  out.counts_before = await tableCounts()
  step('db + counts before', { db: out.db, counts: out.counts_before })

  const { A, B } = await ensureAccounts()
  out.accounts = { A: { uid: A.uid, evm: A.evm }, B: { uid: B.uid, evm: B.evm } }

  // ---- 媒体（2 张，供 Web 缩略图列 / 箭头） ---------------------------------
  const m1 = await uploadMedia(A.token)
  const m2 = await uploadMedia(A.token)
  out.media = { m1: { status: m1.status, data: m1.json?.data }, m2: { status: m2.status, data: m2.json?.data } }
  const url1 = m1.json?.data?.url
  const url2 = m2.json?.data?.url
  const mediaUrls = [url1, url2].filter(Boolean)

  // ---- 四值成色各 1 件（实物） ---------------------------------------------
  const spec = [
    { label: 'BNS', itemType: 'PhysicalFreeShip', itemCondition: 'BrandNewSealed', price: 128, mediaUrls },
    { label: 'LN', itemType: 'PhysicalBuyerShip', itemCondition: 'LikeNew', price: 96, mediaUrls: url1 ? [url1] : [] },
    { label: 'MW', itemType: 'PhysicalFreeShip', itemCondition: 'MinorWear', price: 61, mediaUrls: [] },
    { label: 'HW', itemType: 'PhysicalFreeShip', itemCondition: 'HeavyWear', price: 12, mediaUrls: [] },
    { label: 'DIG', itemType: 'DigitalAutoDeliver', price: 33, mediaUrls: [] },
  ]
  const created = {}
  for (const s of spec) {
    const r = await createFixtureListing(A.token, s)
    created[s.label] = {
      status: r.status,
      listing_id: r.json?.data?.listing_id ?? r.json?.data?.bID ?? null,
      item_condition: r.json?.data?.item_condition ?? null,
      item_type: r.json?.data?.item_type ?? null,
      err: r.status === 200 ? null : { code: r.json?.error?.code ?? r.json?.code, message: r.json?.message },
    }
    if (r.status === 200) {
      const id = created[s.label].listing_id
      const row = await dbRow(id)
      created[s.label].db_item_condition = row?.item_condition
      created[s.label].db_item_type = row?.item_type
      created[s.label].verbatim_ok = row?.item_condition === s.itemCondition
    }
  }
  out.created = created
  step('create 4 physical conditions + digital', created)

  // ---- 负控：数字商品带成色 ⇒ 400 ITEM_CONDITION_NOT_APPLICABLE ------------
  const digCond = await createFixtureListing(A.token, {
    label: 'DIGBAD', itemType: 'DigitalAutoDeliver', itemCondition: 'LikeNew',
  })
  out.negative = {
    digital_with_condition: {
      status: digCond.status,
      code: digCond.json?.error?.code ?? digCond.json?.code ?? null,
      reason: digCond.json?.error?.details?.reason ?? digCond.json?.details?.reason ?? null,
      message: digCond.json?.message ?? null,
    },
  }

  // ---- 负控：非法成色值 ⇒ 400 ----------------------------------------------
  const badVal = await createFixtureListing(A.token, {
    label: 'BADVAL', itemType: 'PhysicalFreeShip', itemCondition: 'banana',
  })
  out.negative.invalid_condition = {
    status: badVal.status,
    code: badVal.json?.error?.code ?? badVal.json?.code ?? null,
    reason: badVal.json?.error?.details?.reason ?? badVal.json?.details?.reason ?? null,
  }

  // ---- 负控：未分类带成色 ⇒ 400（同族） ------------------------------------
  const noType = await createFixtureListing(A.token, { label: 'NOTYPE', itemCondition: 'LikeNew' })
  out.negative.no_type_with_condition = {
    status: noType.status,
    code: noType.json?.error?.code ?? noType.json?.code ?? null,
    reason: noType.json?.error?.details?.reason ?? noType.json?.details?.reason ?? null,
  }

  // ---- PATCH 支改成色 ------------------------------------------------------
  const lnId = created.LN.listing_id
  const prePatch = await dbRow(lnId)
  const patch = await http('PATCH', `/api/listing/${lnId}`, {
    token: A.token, body: { item_condition: 'HeavyWear' },
  })
  const postPatch = await dbRow(lnId)
  out.patch_condition = {
    listing_id: lnId,
    status: patch.status,
    body_condition: patch.json?.data?.item_condition ?? null,
    db_before: prePatch?.item_condition,
    db_after: postPatch?.item_condition,
    changed: prePatch?.item_condition !== postPatch?.item_condition && postPatch?.item_condition === 'HeavyWear',
  }

  // ---- 读口键数 ------------------------------------------------------------
  const detailId = created.BNS.listing_id
  const det = await http('GET', `/api/prize/${detailId}`)
  const dataKeys = Object.keys(det.json?.data ?? {}).sort()
  out.detail_keys = {
    status: det.status,
    count: dataKeys.length,
    keys: dataKeys,
    has_wants: dataKeys.includes('wants'),
    has_views: dataKeys.includes('views'),
    has_condition: dataKeys.includes('condition'),
    views_value: det.json?.data?.views,
    wants_value: det.json?.data?.wants,
    condition_value: det.json?.data?.condition,
  }

  const feed = await http('GET', '/api/prize/all?skip=0&limit=36')
  const feedRows = Array.isArray(feed.json?.data) ? feed.json.data : []
  const feedKeySets = [...new Set(feedRows.map((r) => Object.keys(r).sort().join(',')))]
  out.feed_keys = {
    status: feed.status,
    rows: feedRows.length,
    distinct_key_counts: [...new Set(feedRows.map((r) => Object.keys(r).length))],
    distinct_key_sets: feedKeySets.length,
    my_row_keys: (() => { const r = feedRows.find((x) => String(x.bID ?? x.listing_id) === String(detailId)); return r ? Object.keys(r).length : null })(),
    has_views: feedRows.some((r) => 'views' in r),
    has_condition: feedRows.some((r) => 'condition' in r),
    has_item_condition: feedRows.some((r) => 'item_condition' in r),
  }

  const mine = await http('GET', '/api/listing/mine?skip=0&limit=50', { token: A.token })
  const mineRows = Array.isArray(mine.json?.data) ? mine.json.data : []
  const mineRow = mineRows.find((r) => String(r.listing_id ?? r.bID) === String(detailId)) || mineRows[0]
  out.mine_keys = {
    status: mine.status,
    rows: mineRows.length,
    key_count: mineRow ? Object.keys(mineRow).length : null,
    keys: mineRow ? Object.keys(mineRow).sort() : null,
    has_condition: mineRow ? 'condition' in mineRow : null,
    condition_values: mineRows.map((r) => ({ id: r.listing_id ?? r.bID, condition: r.condition ?? null })),
  }

  // ---- 自增：连续 3 次 GET -------------------------------------------------
  const incrId = created.MW.listing_id
  const seq = []
  for (let i = 0; i < 3; i += 1) {
    const r = await http('GET', `/api/prize/${incrId}`)
    seq.push({ i: i + 1, status: r.status, views: r.json?.data?.views, wants: r.json?.data?.wants })
  }
  const dbAfter = await dbRow(incrId)
  out.views_increment = {
    listing_id: incrId,
    seq,
    db_view_count: dbAfter?.view_count,
    deltas: seq.slice(1).map((s, i) => s.views - seq[i].views),
  }

  // ---- 404 不计数、不写日志 ------------------------------------------------
  const logBefore = await viewLogCount()
  const logForMissBefore = await viewLogCount(99999999)
  const miss1 = await http('GET', '/api/prize/99999999')
  const miss2 = await http('GET', '/api/prize/99999999')
  const logAfter = await viewLogCount()
  const logForMissAfter = await viewLogCount(99999999)
  out.miss_404 = {
    statuses: [miss1.status, miss2.status],
    codes: [miss1.json?.error?.code ?? miss1.json?.code, miss2.json?.error?.code ?? miss2.json?.code],
    log_total_before: logBefore, log_total_after: logAfter,
    log_for_miss_before: logForMissBefore, log_for_miss_after: logForMissAfter,
    log_delta: logAfter - logBefore,
  }

  // ---- 详情/mine 成色同步可见 ----------------------------------------------
  const detPatch = await http('GET', `/api/prize/${lnId}`)
  const mine2 = await http('GET', '/api/listing/mine?skip=0&limit=50', { token: A.token })
  const mine2Row = (mine2.json?.data || []).find((r) => String(r.listing_id ?? r.bID) === String(lnId))
  out.condition_visibility = {
    detail_condition: detPatch.json?.data?.condition ?? null,
    mine_condition: mine2Row?.condition ?? null,
    db_condition: (await dbRow(lnId))?.item_condition ?? null,
  }

  out.fixtures = await fixtureListings()
  out.counts_after = await tableCounts()
  out.accounts_full = { A: { uid: A.uid }, B: { uid: B.uid } }

  // 供后续脚本复用
  fs.mkdirSync(SCRATCH, { recursive: true })
  fs.writeFileSync(path.join(SCRATCH, 'fixtures.json'), JSON.stringify({
    run: FIXTURE_TAG, ids: Object.fromEntries(Object.entries(created).map(([k, v]) => [k, v.listing_id])),
    media: [url1, url2].filter(Boolean).map((u, i) => ({ url: u, data: (i === 0 ? m1 : m2).json?.data })),
    accounts: { A: { uid: A.uid }, B: { uid: B.uid } },
  }, null, 2))

  out.file = save('01-read-write-ac13', out)
  console.log('READING:', out.file)
  console.log(JSON.stringify({
    detail_keys: out.detail_keys.count, feed_keys: out.feed_keys.distinct_key_counts,
    mine_keys: out.mine_keys.key_count, views_seq: seq.map((s) => s.views),
    miss_404: out.miss_404.statuses, patch: out.patch_condition.changed,
  }))
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
