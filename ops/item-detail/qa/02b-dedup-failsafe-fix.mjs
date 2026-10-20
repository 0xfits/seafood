/**
 * 质检脚本 02b · 修正臂：「缺字段 ⇒ 按 on」判据订正后复跑（AC2 补）
 * ---------------------------------------------------------------------------
 * ★ 订正说明（判据修正、非产品修正）：02 该臂的基线选错 —— 该商品对 uid A **当天尚未有日志行**，
 *   因此「第一次 GET +1」是 on 分支的**正确**行为（新访客落行并自增），却按「两次 GET 差 0」判负。
 *   正确判据 = 第一次 +1（新访客）且**第二次 +0**（同日同访客已见）且日志恰 1 行。
 *   为免上一臂残留日志污染，本臂改用**当天无日志行**的夹具 137（BNS）。
 */
import fs from 'node:fs'
import {
  dbIdentity, save, http, ensureAccounts, dbRow, viewLogCount, setDedupConfig, dedupConfig,
} from './lib.mjs'

const fx = JSON.parse(fs.readFileSync('/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa/fixtures.json', 'utf8'))
const ID = fx.ids.BNS
const out = { listing: ID, arms: [] }
const num = (v) => Number(v)
const views = async () => num((await dbRow(ID)).view_count)

const main = async () => {
  out.db = await dbIdentity()
  out.config_before = await dedupConfig()
  const { A } = await ensureAccounts()

  const run = async (label, value) => {
    out.config_set = await setDedupConfig(value)
    out.config_read = await dedupConfig()
    const v0 = await views(); const l0 = await viewLogCount(ID)
    const r1 = await http('GET', `/api/prize/${ID}`, { token: A.token })
    const v1 = await views()
    const r2 = await http('GET', `/api/prize/${ID}`, { token: A.token })
    const v2 = await views()
    const l2 = await viewLogCount(ID)
    const rec = {
      arm: label, config: value, statuses: [r1.status, r2.status],
      views: [v0, v1, v2], deltas: [v1 - v0, v2 - v1],
      log_rows: [l0, l2], log_delta: l2 - l0,
      pass: (v1 - v0 === 1) && (v2 - v1 === 0) && (l2 - l0 === 1),
    }
    out.arms.push(rec)
    console.log('·', label, JSON.stringify(rec))
    return rec
  }

  // 缺字段形态（键名换成 other）⇒ fail-safe 按 on
  await run('缺字段 {"other":"on"} ⇒ 按 on（首访 +1 / 复读 +0 / 日志 1 行）', { other: 'on' })
  // 缺行形态（整行删除 ⇒ 服务层 fail-safe on；测完立刻插回）
  const { sql } = await import('./lib.mjs')
  await sql`DELETE FROM public.app_config WHERE key = 'detail_view_dedup'`
  out.row_absent_read = await dedupConfig()
  out.row_absent_config_row_count = (await sql`SELECT count(*)::int AS n FROM public.app_config WHERE key = 'detail_view_dedup'`)[0].n
  // 该商品对 A 今日已有 1 行 ⇒ 缺行形态下必须 +0（仍在去重）
  {
    const v0 = await views()
    await http('GET', `/api/prize/${ID}`, { token: A.token })
    const v1 = await views()
    const rec = { arm: '缺行 ⇒ 按 on（已有当日日志 ⇒ 不涨）', views: [v0, v1], delta: v1 - v0, pass: v1 - v0 === 0 }
    out.arms.push(rec); console.log('·', rec.arm, JSON.stringify(rec))
  }
  // 复原：插回 off 行
  await sql`INSERT INTO public.app_config (key, value, updated_by)
            VALUES ('detail_view_dedup', '{"dedup":"off"}'::jsonb, 0)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  out.config_restored = await dedupConfig()

  out.all_pass = out.arms.every((a) => a.pass)
  out.file = save('02b-dedup-failsafe-fix', out)
  console.log('READING:', out.file, 'ALL_PASS', out.all_pass, 'RESTORED', JSON.stringify(out.config_restored))
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
