/**
 * I18N-VIOL-CLOSEOUT · 全量清工程口语进用户文案（类级断言 + 改写保真）
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 作用域 = **全量面**：`src/locales/{zh,hk,en,vn}.json` **全部值** + `src/pages|components|shell`
 *      **全部源文件**的用户可见文案面 —— 不是「本单写集」（B4b 只扫写集 ⇒ 652 集语料里的
 *      `GET /api/…`×5 + `POST /api/…`×2 + `403/400` + `base_cid` + `listing.stock` 从未被扫过）。
 *   ② 逐例**打印作用域命中节点数**（命中 0 或明显偏少 ⇒ 用例作废，不得当「零违例」）。
 *   ③ 键名与键集不变（四文件拍平键数单值；P6-MISC-FIX ① 授权新增 5 键 678⇒683；
 *      批 7-A 授权新增 21 键 = `ledger.flowMore` + `ledger.kind.*`（LEDGER_KINDS 20 个全覆盖）683⇒704）；只改值。
 *   ④ 保真底线：改写不得丢「已下线 / 需要权限 / 手续费不退」等真信息 —— 逐条正例断言。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT = path.resolve(SRC, '..')
const LANGS = ['zh', 'hk', 'en', 'vn']
const readTable = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))
const flatTables = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flat(readTable(l)))]))
const KEYS = Object.keys(flatTables.zh)

/** 工程口径黑名单（与 `scripts/p4z-i18nviol-global.mjs` 同口径） */
const BLACKLIST = [
  [/§/, '章节号'],
  [/\b(GET|POST|PUT|PATCH|DELETE)\s+\//, 'HTTP 动词+路径'],
  [/\/api\//, '接口路径'],
  [/\b(400|401|402|403|404|405|409|410|422|429|500|502|503|504)\b/, 'HTTP 状态码'],
  [/\b(base_cid|quote_cid|listing\.stock|listing_order|job_escrow)\b/, 'DB 表/列名'],
  [/幂等|冪等|idempotenc/, '幂等键实现'],
  [/读面|讀面|读口|讀口|写口|寫口|未注册|未註冊|已注册|已註冊/, '口径黑话'],
  [/服务端|伺服器端|伺服器取數|伺服器恆|前端提供|前端不/, '服务端/前端口径'],
  [/买家轴|買家軸|status=|\buID\b|\bbID\b/, '轴/字段口径'],
]

/** 本单改写集（键名；值已四语同步改写） */
const REWRITTEN = [
  'jobs.cidNote', 'jobs.acceptNote', 'jobs.submitNote', 'jobs.publishNote', 'jobs.reviewNote',
  'listings.listNote', 'listings.publishNote', 'listings.priceServerNote', 'listings.priceRoleNote',
  'listings.stockNote', 'listings.cidNote', 'listings.ordersNote', 'listings.buyNote',
  'listings.refundNote', 'listings.refundStockNote', 'listings.listed',
  'market.note', 'market.bookEmpty', 'market.pairDegenerate', 'market.bookNote', 'market.tradesNote',
  'market.mineNote', 'market.placeNote', 'market.baseNote', 'market.quoteNote',
  'ledger.balanceNote', 'ledger.flowEmpty', 'uiError.serverErrorStatus',
  'dashPage.noReviewPermissionBody', 'adminPermissions.tipNoManagePermission',
  'adminPoints.tipNoManagePermission', 'adminUsers.tipNoManageUsers', 'adminUsers.tipNoManagePoints',
  'adminShards.noPermission',
]

describe('I18N-VIOL-CLOSEOUT · 全量面类级断言（工程口径进用户文案）', () => {
  it('① 全量 locale 面：四文件**全部值**逐条扫 → 工程口径命中 = 0（打印作用域节点数）', () => {
    const scope = KEYS.length * LANGS.length
    const hits = []
    for (const k of KEYS) {
      for (const l of LANGS) {
        const v = flatTables[l][k]
        if (typeof v !== 'string') continue
        for (const [re, name] of BLACKLIST) if (re.test(v)) hits.push(`${l}.${k} [${name}] ${v}`)
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[I18N-VIOL] 全量 locale 作用域命中节点数 = ${scope}（键 ${KEYS.length} × 语 ${LANGS.length}）；命中 = ${hits.length}`)
    expect(scope).toBeGreaterThanOrEqual(2700) // 作用域不得「异常小」⇒ 断言有效
    expect(hits).toEqual([])
  })

  it('② 全量源文件面 + 硬编码文案面：类级断言脚本退出码 = 0（含注释行/代码位单列登记）', () => {
    const script = path.join(ROOT, 'scripts/p4z-i18nviol-global.mjs')
    const out = execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' })
    // eslint-disable-next-line no-console
    console.log(out.split('\n').filter((l) => /作用域命中节点数|裸命中|子面③|总判/.test(l)).join('\n'))
    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
    // P9② 计数期望订正（逐字登记）：新增顶层 `battCard`(4) + `checkinPanel`(5) ⇒ 拍平 944⇒953 ⇒ locale 节点 = 953 × 4 = **3812**（原 944 × 4 = 3776）⇒ 本断言前推 3776 ⇒ 3812（**未删断言**）
    expect(out).toContain('作用域命中节点数 = 4000') // **期望订正（P9④ BTTC）**：拍平键 988⇒1000 ⇒ 节点 3952⇒4000
    expect(out).toContain('② 全量页面源文件面')
    expect(out).toMatch(/locale 裸命中 0 \+ 源面裸命中 0/)
  })

  it('③ 改写集四语齐备且不再含工程口径（逐键逐语；en/hk/vn 不得残留中文）', () => {
    const CJK = /[\u3400-\u9fff]/
    const problems = []
    for (const k of REWRITTEN) {
      for (const l of LANGS) {
        const v = flatTables[l][k]
        if (typeof v !== 'string' || !v.trim()) { problems.push(`${l}.${k} 空/缺`); continue }
        for (const [re, name] of BLACKLIST) if (re.test(v)) problems.push(`${l}.${k} [${name}] ${v}`)
        if ((l === 'en' || l === 'vn') && CJK.test(v)) problems.push(`${l}.${k} 残留中文 ${v}`)
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[I18N-VIOL] 改写集 = ${REWRITTEN.length} 键 × 4 语 = ${REWRITTEN.length * 4} 个节点；问题 = ${problems.length}`)
    expect(REWRITTEN.length * LANGS.length).toBeGreaterThanOrEqual(120)
    expect(problems).toEqual([])
  })

  it('④ 保真底线：改写后仍保留「需权限 / 已下线 / 手续费不退 / 暂停开放」等真信息', () => {
    expect(flatTables.zh['jobs.acceptNote']).toContain('只有雇主')
    expect(flatTables.zh['listings.refundNote']).toContain('只有卖家')
    expect(flatTables.zh['listings.refundNote']).toContain('订单号')
    expect(flatTables.zh['market.mineNote']).toContain('手续费不退')
    // 批 7-A：`/api/user/ledger` 已注册 ⇒ 原「暂未开放」变成错误陈述 ⇒ 保真底线的锚随之**等义下移**
    expect(flatTables.zh['ledger.flowEmpty']).toMatch(/暂无账本流水|交易后/)
    expect(flatTables.zh['ledger.flowEmpty']).not.toMatch(/暂未开放|暫未開放/)
    expect(flatTables.zh['adminUsers.tipNoManageUsers']).toContain('权限')
    // 已下线语义：`claimRetiredNotice` 属**未改动**键，四语保留「已下线」
    expect(flatTables.zh.claimRetiredNotice).toContain('已下线')
    expect(flatTables.en.claimRetiredNotice).toMatch(/retired|no longer/i)
    // 原样枚举值不得再进可见文案（en 档 `listings.listed` 由 `listed` ⇒ `Listed`）
    expect(flatTables.en['listings.listed']).toBe('Listed')
  })

  it('⑤ 键名与键集不变：四文件拍平键数单值，且改写集键全部仍在', () => {
    const counts = new Set(LANGS.map((l) => Object.keys(flatTables[l]).length))
    // eslint-disable-next-line no-console
    console.log(`[I18N-VIOL] 四语拍平键数 = {${[...counts].join(', ')}}；顶层键 = ${Object.keys(readTable('zh')).length}`)
    expect(counts.size).toBe(1)
    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
    expect([...counts][0]).toBe(1000) // **期望订正（P9④ BTTC）**：+12 拍平键（988⇒1000）
    for (const k of REWRITTEN) for (const l of LANGS) expect(flatTables[l][k]).toBeTruthy()
  })
})
