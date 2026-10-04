/**
 * I18N-VIOL-CLOSEOUT · 全量清工程口语进用户文案（类级断言 + 改写保真）
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 作用域 = **全量面**：`src/locales/{zh,hk,en,vn}.json` **全部值** + `src/pages|components|shell`
 *      **全部源文件**的用户可见文案面 —— 不是「本单写集」（B4b 只扫写集 ⇒ 652 集语料里的
 *      `GET /api/…`×5 + `POST /api/…`×2 + `403/400` + `base_cid` + `listing.stock` 从未被扫过）。
 *   ② 逐例**打印作用域命中节点数**（命中 0 或明显偏少 ⇒ 用例作废，不得当「零违例」）。
 *   ③ 键名与键集不变（四文件拍平键数单值；P6-MISC-FIX ① 授权新增 5 键 678⇒683；
 *      批 7-A 授权新增 21 键 = `ledger.flowMore` + `ledger.kind.*`（LEDGER_KINDS 当时 20 个全覆盖）683⇒704）；只改值。
 *      【S9 订正】`ledger.kind.*` 现行 = **LEDGER_KINDS 24 个全覆盖**（S9 补齐 4 键：checkin_makeup_fee / bttc_mint_fee / bttc_burn_fee / invite_first_task_reward）。
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
  // S25（台账 B7 死键退役）：`jobs.acceptNote` 已随四语对称删除退役（产品面零引用）⇒ 自本改写集移出；改写集 33⇒32 键。
  // S28-②：退役键「不得回归」的存在性负断言见本文件 ⑥（10 键 × 4 语 = 40 节点）；S25 的「移除并留痕」升为被强制执行的不变式。
  'jobs.cidNote', 'jobs.submitNote', 'jobs.publishNote', 'jobs.reviewNote',
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
    // S25 计数期望订正（台账 B7 死键退役）：`jobs` 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050 ⇒ 节点 4240⇒4200（等量下移 −10/语）。
    expect(out).toContain('作用域命中节点数 = 4200') // **期望订正（S9 ledger.kind 缺键补齐）**：S8 ⇒ 1055/4220；S9 +4 ledger.kind 键/语 ⇒ 拍平 1055⇒1059 ⇒ 节点 4220⇒4236（前订正 S7：1044⇒1054 ⇒ 4176⇒4216）；**S25 再订正** 1059⇒1050 ⇒ 4200（B7 退役 10 键）
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
    // S25（B7）：`jobs.acceptNote` 已退役（四语对称删除）⇒ 该「只有雇主」保真锚失去守护对象，移除并留痕，**非削弱**：
    //   同族真信息锚（权限/已下线/手续费不退）仍在下方逐条断言（listings.refundNote / market.mineNote / claimRetiredNotice）。
    // S28-②：`jobs.acceptNote` 的退役**不得回归**由本文件 ⑥ 承接（10 键 × 4 语存在性负断言）—— 加严，非削弱。
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
    // S25 计数期望订正（台账 B7 死键退役）：四语对称删 10 键 ⇒ 拍平 1060⇒1050（等量下移 = −10/语）。
    expect([...counts][0]).toBe(1050) // **期望订正（S9 ledger.kind 缺键补齐）**：S8 ⇒ 1055；S9 +4 ledger.kind 键/语 ⇒ 拍平 1055⇒1059（前订正 S7：1044⇒1054）；**S25 再订正** 1059⇒1050（B7 退役 10 键）
    for (const k of REWRITTEN) for (const l of LANGS) expect(flatTables[l][k]).toBeTruthy()
  })

  /**
   * S28-②（Zang 裁）：「退役键不得回归」存在性负断言（**加严**）。
   *
   * 背景：S25-B7 四语对称退役 10 个死键（`jobs.apply/applyOk/accept/acceptNote/acceptOk/applicationId/`
   *   `submitNeedApply/applyPrompt/applyWaiting/pick`）。S25 在本文件两处（改写集清单 / ④ 保真底线）只做
   *   「**移除并留痕**」——即把状态写成散文「已删除」；一旦有人把退役键加回任一 locale，**无任何断言拦截**。
   *   本单把「已删除」**升为「不得复发」**：10 键 × 4 语 = 40 节点，逐节点断言键不存在（存在即红）。
   *
   * 去重（Zang「不重复建两份」）：等价断言 S25 曾建于 `r9-90-participate-surface.test.jsx §⑥`
   *   （10 键 × 4 语 `hasOwnProperty`=false）⇒ 已**合并归口**至本处（r9-90 §⑥ 的重复移除，见报告 §2）。
   *   叠加渲染面硬编旧值反面护栏（`r9-90-participate-surface.test.jsx` S28-①）后，退役 10 键的守卫 = 键面 + 渲染面双向。
   */
  it('⑥ 退役键不得回归：S25-B7 退役 10 键 × 4 语一律不存在（存在即红）', () => {
    // S25-B7 退役清单（S25 删除前的 `jobs.*`；出处 `git show 815c138^:frontend/src/locales/*.json`）
    const RETIRED_JOBS_KEYS = [
      'apply', 'applyOk', 'accept', 'acceptNote', 'acceptOk',
      'applicationId', 'submitNeedApply', 'applyPrompt', 'applyWaiting', 'pick',
    ]
    const present = []
    for (const k of RETIRED_JOBS_KEYS) {
      for (const l of LANGS) {
        const full = `jobs.${k}`
        const has = Object.prototype.hasOwnProperty.call(flatTables[l], full)
        if (has) present.push(`${l}.${full} = ${JSON.stringify(flatTables[l][full])}`)
        expect(has, `${l}.${full} 已退役（S25-B7），不得回归`).toBe(false)
        expect(flatTables[l][full], `${l}.${full} 取值应为 undefined`).toBeUndefined()
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[I18N-VIOL] 退役键不得回归：${RETIRED_JOBS_KEYS.length} 键 × ${LANGS.length} 语 = ${RETIRED_JOBS_KEYS.length * LANGS.length} 节点；回归命中 = ${present.length}`)
    // 覆盖面自证：必须恰为 10 键 × 4 语 = 40 节点（防清单被误缩 ⇒ 断言空转）
    expect(RETIRED_JOBS_KEYS.length).toBe(10)
    expect(RETIRED_JOBS_KEYS.length * LANGS.length).toBe(40)
    expect(present).toEqual([])
  })
})
