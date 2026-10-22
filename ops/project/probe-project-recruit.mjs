/**
 * 项目页【招工】模态框 + 改 slug 自愈探针（Kevin 2026-10-22③）
 *
 * 判据（逐条对齐派单验证项）：
 *   ① 两个入口都在：操作区【编辑项目】旁有【招工】（文案 = zh `project.entryRecruit`），
 *      点开招工框后 `[data-sf-edit]` **恰 6 个**（headcount / minDays / batt / interval / cid / amount），
 *      且框内零项目面字段（title / description / slug / status）；【编辑项目】框反向零招工字段；
 *      招工框提交只带**变化**字段（改人数 ⇒ 载荷恰 `{headcount}`）；
 *   ② **改 slug 自愈**：【编辑项目】里把地址改成 `haixian` 保存 ⇒ URL 变 `/haixian`（不是停在 `/sui`
 *      落 404）、页面按新地址重拉并正常渲染（项目头在、`not-found-page` 不在）、保存后**旧地址零新读**；
 *   ③ 几何两档（390 / 1536）：页面与招工面板 `scrollWidth - clientWidth = 0` + 零 pageerror。
 *
 * 手法（同 `ops/project/probe-project-avatar.mjs` 体例）：
 *   · 静态服务 = `context.route` 把 `http://sf.local/**` 映射到磁盘 `dist`（零 dev server）；
 *   · 登录态 = localStorage 种子（addInitScript）；API 全在 `context.route` 内自截（零后端、零库写）；
 *   · 禁动画 + 稳态采样；只读不写仓内源码。
 *
 * 用法：QA_DIST=<dist> node ops/project/probe-project-recruit.mjs [out.json]
 *   退出码 0 = 全部判据为真；1 = 任一为假（明细见输出 JSON）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const DIST = process.env.QA_DIST || path.join(REPO, 'frontend/dist')
const OUT = process.argv[2] || path.join(REPO, 'ops/project/readings/probe-project-recruit.json')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://sf.local'
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

const OWNER_UID = 970213
const OTHER_UID = 555001
/** 招工框字段名（顺序 = DOM 顺序；= 派单 6 键）。 */
const RECRUIT_FIELDS = ['headcount', 'minDays', 'batt', 'interval', 'cid', 'amount']
const PROJECT_FIELDS = ['title', 'description', 'slug', 'status']

const viewOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单，按批结算。',
  status: 'recruiting',
  headcount: 3,
  hired_count: 1,
  recruit_min_account_days: 7,
  wage_batt_per_claim: 30,
  wage_cid: null,
  wage_currency_amount: null,
  wage_interval_hours: 4,
  owner_uid: OWNER_UID,
  avatar_url: null,
  campaigns: [],
  ...patch,
})

const ok = (data) => ({ success: true, data })

/** 单臂会话：自截 API + 磁盘 dist 静态服务；返回该臂的 STATE（调用记录 / 视图行）。 */
const makeArm = async (browser, { viewerUid, view }) => {
  const STATE = { view, patch: [], reads: [], calls: [] }
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ uid }) => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify({ uID: uid, uid, token: `probe-${uid}`, bio: 'probe', name: 'Probe' }))
    localStorage.setItem('token', `probe-${uid}`)
  }, { uid: viewerUid })

  await context.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (u.origin !== ORIGIN) return route.fulfill({ status: 404, body: '' })
    if (u.pathname.startsWith('/api/')) {
      const method = req.method()
      let body = null
      try { body = req.postData() ? JSON.parse(req.postData()) : null } catch { body = null }
      STATE.calls.push({ method, path: u.pathname })
      if (u.pathname === '/api/user') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ uID: viewerUid })) })
      if (u.pathname === '/api/currencies') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC', name: 'Bit' }])) })
      if (u.pathname === '/api/project/11' && method === 'PATCH') {
        STATE.patch.push(body)
        Object.assign(STATE.view, body || {})
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(STATE.view)) })
      }
      // 读口：`GET /api/project/:ref`（ref = 当前 slug / 数字 id / snowflake 三形态原样透传）
      if (/^\/api\/project\/[^/]+$/.test(u.pathname) && method === 'GET') {
        const ref = decodeURIComponent(u.pathname.split('/').pop())
        STATE.reads.push(ref)
        const hit = ref === 'sui' || ref === String(STATE.view.slug) || ref === '11' || ref === '70011'
        if (!hit) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }) })
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(STATE.view)) })
      }
      if (u.pathname === '/api/batt') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(ok({ batt: 70, capBatt: 100, floorBatt: 0, acceptThresholdBatt: 50, canAccept: true, bttc: { balance: '0', status: 'listed', canMint: false, canBurn: false, usdBalance: '0', policy: { mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1 } } })),
        })
      }
      if (u.pathname === '/api/messages/unread-count') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ unread_total: 0 })) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(null)) })
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || !path.extname(file)) file = path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' },
      body: fs.readFileSync(file),
    })
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)))
  return { context, page, STATE, pageErrors }
}

const settle = async (page) => {
  await page.waitForTimeout(120)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(120)
}

const snap = (page) => page.evaluate(() => {
  const q = (name) => document.querySelector(`[data-sf-m="${name}"]`)
  const fieldNamesIn = (formSel) => [...document.querySelectorAll(`${formSel} [data-sf-edit]`)]
    .map((el) => el.getAttribute('data-sf-edit'))
  const recruitPanel = q('project-recruit-panel')
  const editPanel = q('project-edit-panel')
  const root = document.querySelector('.sf-project-page')
  const doc = document.documentElement
  const entry = (name) => q(name)
  return {
    path: window.location.pathname,
    slugAttr: root ? root.getAttribute('data-sf-slug') : null,
    title: q('project-title') ? q('project-title').textContent : null,
    notFound: Boolean(q('not-found-page')),
    entries: {
      edit: Boolean(entry('project-entry-edit')),
      recruit: Boolean(entry('project-entry-recruit')),
      campaign: Boolean(entry('project-entry-campaign')),
    },
    recruitLabel: entry('project-entry-recruit') ? entry('project-entry-recruit').textContent.trim() : null,
    recruitTitle: q('project-recruit-title') ? q('project-recruit-title').textContent : null,
    recruitFieldNames: fieldNamesIn('[data-sf-m="project-recruit-form"]'),
    editFieldNames: fieldNamesIn('[data-sf-m="project-edit-form"]'),
    recruitOpen: Boolean(recruitPanel),
    editOpen: Boolean(editPanel),
    headcount: document.querySelector('[data-sf-edit="headcount"]') ? document.querySelector('[data-sf-edit="headcount"]').value : null,
    noticeText: q('project-form-notice') ? q('project-form-notice').textContent.trim() : null,
    overflow: {
      doc: doc.scrollWidth - doc.clientWidth,
      page: root ? root.scrollWidth - root.clientWidth : null,
      recruitPanel: recruitPanel ? recruitPanel.scrollWidth - recruitPanel.clientWidth : null,
    },
  }
})

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/project/probe-project-recruit.mjs',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { project: 'sui ⇒ haixian（PATCH slug）', auth: 'localStorage seed', writes: 'zero（全在 context.route 内截）' },
    states: {}, assertions: {}, pageErrors: {},
  }

  // ======================= 臂 1 · owner：两入口 + 招工框字段集 + 载荷只带变化 =======================
  const owner = await makeArm(browser, { viewerUid: OWNER_UID, view: viewOf() })
  await owner.page.goto(`${ORIGIN}/sui`, { waitUntil: 'load' })
  await settle(owner.page)
  const before = await snap(owner.page)
  out.states['owner_before'] = before
  out.assertions.twoEntries = {
    pageRendered: before.title === '海鲜打包' && before.notFound === false,
    editEntryPresent: before.entries.edit === true,
    recruitEntryPresent: before.entries.recruit === true,
    campaignEntryPresent: before.entries.campaign === true,
    recruitLabelI18n: before.recruitLabel === ZH.project.entryRecruit,
    noModalInitially: before.recruitOpen === false && before.editOpen === false,
    noOverflow1536: before.overflow.doc === 0 && before.overflow.page === 0,
  }

  // 招工框：字段集恰 6、零项目面字段
  await owner.page.click('[data-sf-m="project-entry-recruit"]')
  await settle(owner.page)
  const recruit = await snap(owner.page)
  out.states['recruit_open'] = recruit
  out.assertions.recruitFieldSet = {
    modalOpen: recruit.recruitOpen === true && recruit.editOpen === false,
    titleI18n: recruit.recruitTitle === ZH.project.recruitTitle,
    exactlySixFields: JSON.stringify(recruit.recruitFieldNames) === JSON.stringify(RECRUIT_FIELDS),
    _recruitFieldNames: recruit.recruitFieldNames,
    noProjectFields: PROJECT_FIELDS.every((name) => !recruit.recruitFieldNames.includes(name)),
    prefillHeadcount: recruit.headcount === '3',
    noOverflow: recruit.overflow.doc === 0 && recruit.overflow.page === 0 && recruit.overflow.recruitPanel === 0,
  }

  // 只改人数 ⇒ 载荷恰 {headcount}
  await owner.page.fill('[data-sf-edit="headcount"]', '5')
  await owner.page.click('[data-sf-m="project-recruit-save"]')
  await settle(owner.page)
  const afterRecruit = await snap(owner.page)
  out.states['recruit_saved'] = afterRecruit
  out.states['recruit_patch_payload'] = owner.STATE.patch
  const recruitPatch = owner.STATE.patch[0] || null
  out.assertions.recruitSubmit = {
    patchCalledOnce: owner.STATE.patch.length === 1,
    payloadExactHeadcount: Boolean(recruitPatch) && JSON.stringify(recruitPatch) === JSON.stringify({ headcount: 5 }),
    modalClosed: afterRecruit.recruitOpen === false,
    okNotice: afterRecruit.noticeText === ZH.project.recruitSaved,
    headcountLineUpdated: afterRecruit.noticeText !== null,
  }

  // 【编辑项目】框：反向零招工字段
  await owner.page.click('[data-sf-m="project-entry-edit"]')
  await settle(owner.page)
  const edit = await snap(owner.page)
  out.states['edit_open'] = edit
  out.assertions.editFieldSet = {
    modalOpen: edit.editOpen === true && edit.recruitOpen === false,
    exactlyFourProjectFields: JSON.stringify(edit.editFieldNames) === JSON.stringify(PROJECT_FIELDS),
    noRecruitFields: RECRUIT_FIELDS.every((name) => !edit.editFieldNames.includes(name)),
  }

  // ======================= 臂 2 · 改 slug ⇒ 自动跳新地址、旧地址零新读 =======================
  const readsBeforeSlug = owner.STATE.reads.length
  await owner.page.fill('[data-sf-edit="slug"]', 'haixian')
  await owner.page.click('[data-sf-m="project-edit-save"]')
  await owner.page.waitForFunction(() => window.location.pathname === '/haixian', { timeout: 8000 }).catch(() => {})
  await settle(owner.page)
  const afterSlug = await snap(owner.page)
  out.states['slug_saved'] = afterSlug
  out.states['slug_reads'] = owner.STATE.reads
  out.states['slug_patch_payload'] = owner.STATE.patch
  const slugPatch = owner.STATE.patch[owner.STATE.patch.length - 1] || null
  const readsAfterPatch = owner.STATE.reads.slice(readsBeforeSlug)
  out.assertions.slugSelfHeal = {
    patchPayloadSlugOnly: Boolean(slugPatch) && JSON.stringify(slugPatch) === JSON.stringify({ slug: 'haixian' }),
    urlBecameNewSlug: afterSlug.path === '/haixian',
    pageStillRendered: afterSlug.notFound === false && afterSlug.title === '海鲜打包',
    slugAttrUpdated: afterSlug.slugAttr === 'haixian',
    refetchedNewSlug: readsAfterPatch.includes('haixian'),
    noReadOfOldSlugAfterSave: !readsAfterPatch.includes('sui'),
    editModalClosed: afterSlug.editOpen === false,
    okNotice: afterSlug.noticeText === ZH.wage.editSaved,
  }

  // ======================= 臂 3 · 两档几何（招工框在场上采样）+ 零 pageerror =======================
  await owner.page.click('[data-sf-m="project-entry-recruit"]')
  await settle(owner.page)
  const geom = {}
  for (const width of [390, 1536]) {
    await owner.page.setViewportSize({ width, height: 900 })
    await settle(owner.page)
    geom[`w${width}`] = await snap(owner.page)
  }
  out.states.geometry = {
    w390: geom.w390.overflow,
    w1536: geom.w1536.overflow,
    modalOpen390: geom.w390.recruitOpen,
    entries390: geom.w390.entries,
  }
  out.assertions.geometry = {
    noOverflow390: geom.w390.overflow.doc === 0 && geom.w390.overflow.page === 0 && geom.w390.overflow.recruitPanel === 0,
    noOverflow1536: geom.w1536.overflow.doc === 0 && geom.w1536.overflow.page === 0 && geom.w1536.overflow.recruitPanel === 0,
    allThreeEntriesAt390: geom.w390.entries.edit === true && geom.w390.entries.recruit === true && geom.w390.entries.campaign === true,
  }
  out.pageErrors.owner = owner.pageErrors
  await owner.context.close()

  // ======================= 臂 4 · 普通用户：两入口都零渲染、零写口 =======================
  const other = await makeArm(browser, { viewerUid: OTHER_UID, view: viewOf({ owner_uid: 99 }) })
  await other.page.goto(`${ORIGIN}/sui`, { waitUntil: 'load' })
  await settle(other.page)
  const guest = await snap(other.page)
  out.states['other_viewer'] = guest
  out.assertions.otherViewer = {
    pageRendered: guest.title === '海鲜打包' && guest.notFound === false,
    noEditEntry: guest.entries.edit === false,
    noRecruitEntry: guest.entries.recruit === false,
    zeroWrites: other.STATE.patch.length === 0,
    noOverflow: guest.overflow.doc === 0 && guest.overflow.page === 0,
  }
  out.pageErrors.other = other.pageErrors
  await other.context.close()

  await browser.close()

  // ======================= 汇总 =======================
  const flat = {}
  for (const [group, row] of Object.entries(out.assertions)) {
    for (const [name, value] of Object.entries(row)) {
      if (name.startsWith('_')) continue
      flat[`${group}.${name}`] = value === true
    }
  }
  const failed = Object.entries(flat).filter(([, v]) => !v).map(([k]) => k)
  out.summary = {
    assertions: Object.keys(flat).length,
    passed: Object.keys(flat).length - failed.length,
    failed,
    pageErrors: Object.values(out.pageErrors).flat().length,
    ok: failed.length === 0 && Object.values(out.pageErrors).flat().length === 0,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`[probe-recruit] ${out.summary.passed}/${out.summary.assertions} passed · pageErrors=${out.summary.pageErrors} ⇒ ${out.summary.ok ? 'OK' : 'FAIL'}`)
  if (failed.length) console.log(`[probe-recruit] failed: ${failed.join(', ')}`)
  console.log(`[probe-recruit] written: ${OUT}`)
  process.exit(out.summary.ok ? 0 : 1)
}

main().catch((error) => {
  console.error('[probe-recruit] crashed:', error)
  process.exit(1)
})
