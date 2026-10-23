/**
 * 项目页三个管理模态框探针（Kevin 2026-10-22③ 拆框；★ 2026-10-23 三框三分后改判据）
 * —— 文件名沿用 `probe-project-recruit`（readings 路径连续），覆盖面已扩到三框。
 *
 * 判据（逐条对齐派单验证项）：
 *   ① 操作区四入口都在：【编辑项目】/【招工】/【设定工资标准】/【发布活动】（文案取 zh 真值），
 *      初始三框皆不在；普通用户四入口一律零渲染、零写口；
 *   ② 【编辑项目】框字段集**恰 3**（title / description / slug）—— **零 status**（系统派生）；
 *   ③ 【招工】框字段集**恰 2**（newSlots / minDays），名额**预填留空**，读数行给
 *      「当前已招 X · 新增 Y ⇒ 目标 X+Y」；已招 1 + 新增 2 ⇒ 提交载荷**恰 `{headcount: 3}`**（增量换算）；
 *      新增留空 ⇒ 载荷**零 `headcount` 键**（名额不变）；
 *   ④ 【设定工资标准】框钩子集 = 4 个载荷字段（batt / interval / cid / amount）+ 滑块卡三钩
 *      （interval-range / wage-rate-anchor / wage-legacy-rate），标题 + 提示行声明
 *      「新老成员一视同仁」；拖间隔滑块到档位 12 ⇒ 载荷恰两键
 *      `{wage_batt_per_claim:'12', wage_interval_hours:12}`（batt 只读派生 = 间隔 × ⚡1）；
 *   ⑤ 几何两档（390 / 1536）：页面与在场面板 `scrollWidth - clientWidth = 0`；零 pageerror。
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
/** 三框字段名（顺序 = DOM 顺序）。 */
const PROJECT_FIELDS = ['title', 'description', 'slug']
const RECRUIT_FIELDS = ['newSlots', 'minDays']
const WAGE_FIELDS = ['interval-range', 'interval', 'batt', 'wage-legacy-rate', 'wage-rate-anchor', 'cid', 'amount']
/** ★ 2026-10-24 单轨联动：档位吸附 + batt 只读派生（改判据用「拖滑块」而非改 batt 文本）。 */
const WAGE_INTERVAL_GEAR = '12'

const viewOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单，按批结算。',
  status: 'recruiting',
  headcount: 2,
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
  const panelOf = (kind) => q(`${kind}-panel`)
  const slots = q('slots') || document.querySelector('[data-sf-edit-hint="slots"]')
  const root = document.querySelector('.sf-project-page')
  const doc = document.documentElement
  const overflowOf = (el) => (el ? el.scrollWidth - el.clientWidth : null)
  const openPanel = panelOf('project-edit') || panelOf('project-recruit') || panelOf('project-wage-std')
  return {
    path: window.location.pathname,
    slugAttr: root ? root.getAttribute('data-sf-slug') : null,
    title: q('project-title') ? q('project-title').textContent : null,
    notFound: Boolean(q('not-found-page')),
    entries: {
      edit: Boolean(q('project-entry-edit')),
      recruit: Boolean(q('project-entry-recruit')),
      wage: Boolean(q('project-entry-wage')),
      campaign: Boolean(q('project-entry-campaign')),
    },
    labels: {
      edit: q('project-entry-edit') ? q('project-entry-edit').textContent.trim() : null,
      recruit: q('project-entry-recruit') ? q('project-entry-recruit').textContent.trim() : null,
      wage: q('project-entry-wage') ? q('project-entry-wage').textContent.trim() : null,
    },
    titles: {
      edit: q('project-edit-title') ? q('project-edit-title').textContent : null,
      recruit: q('project-recruit-title') ? q('project-recruit-title').textContent : null,
      wage: q('project-wage-std-title') ? q('project-wage-std-title').textContent : null,
    },
    hints: {
      wageStd: document.querySelector('[data-sf-edit-hint="wageStd"]') ? document.querySelector('[data-sf-edit-hint="wageStd"]').textContent : null,
      newSlots: document.querySelector('[data-sf-edit-hint="newSlots"]') ? document.querySelector('[data-sf-edit-hint="newSlots"]').textContent : null,
    },
    open: {
      edit: Boolean(panelOf('project-edit')),
      recruit: Boolean(panelOf('project-recruit')),
      wage: Boolean(panelOf('project-wage-std')),
    },
    fieldNames: {
      edit: fieldNamesIn('[data-sf-m="project-edit-form"]'),
      recruit: fieldNamesIn('[data-sf-m="project-recruit-form"]'),
      wage: fieldNamesIn('[data-sf-m="project-wage-std-form"]'),
    },
    value: {
      newSlots: document.querySelector('[data-sf-edit="newSlots"]') ? document.querySelector('[data-sf-edit="newSlots"]').value : null,
      batt: document.querySelector('[data-sf-edit="batt"]') ? document.querySelector('[data-sf-edit="batt"]').value : null,
      interval: document.querySelector('[data-sf-edit="interval"]') ? document.querySelector('[data-sf-edit="interval"]').value : null,
      range: document.querySelector('[data-sf-edit="interval-range"]') ? document.querySelector('[data-sf-edit="interval-range"]').value : null,
    },
    wageCard: {
      battReadOnly: document.querySelector('[data-sf-edit="batt"]') ? document.querySelector('[data-sf-edit="batt"]').readOnly : null,
      rangeType: document.querySelector('[data-sf-edit="interval-range"]') ? document.querySelector('[data-sf-edit="interval-range"]').type : null,
      anchor: document.querySelector('[data-sf-edit="wage-rate-anchor"]') ? document.querySelector('[data-sf-edit="wage-rate-anchor"]').textContent : null,
      legacy: document.querySelector('[data-sf-edit="wage-legacy-rate"]') ? document.querySelector('[data-sf-edit="wage-legacy-rate"]').textContent : null,
    },
    slots: slots ? {
      hired: slots.getAttribute('data-sf-hired'),
      add: slots.getAttribute('data-sf-add'),
      target: slots.getAttribute('data-sf-target'),
      text: slots.textContent.trim(),
    } : null,
    headcountLine: q('project-headcount') ? q('project-headcount').textContent.trim() : null,
    noticeText: q('project-form-notice') ? q('project-form-notice').textContent.trim() : null,
    overflow: {
      doc: doc.scrollWidth - doc.clientWidth,
      page: overflowOf(root),
      panel: overflowOf(openPanel),
    },
  }
})

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const out = {
    probe: 'ops/project/probe-project-recruit.mjs',
    scope: '三框（编辑项目 / 招工增量 / 设定工资标准）',
    startedAt: new Date().toISOString(),
    dist: DIST,
    fixtures: { project: 'sui（hired 1 / headcount 2）', auth: 'localStorage seed', writes: 'zero（全在 context.route 内截）' },
    states: {}, assertions: {}, pageErrors: {},
  }

  // ======================= 臂 1 · owner：四入口 + 三框字段集 =======================
  const owner = await makeArm(browser, { viewerUid: OWNER_UID, view: viewOf() })
  await owner.page.goto(`${ORIGIN}/sui`, { waitUntil: 'load' })
  await settle(owner.page)
  const before = await snap(owner.page)
  out.states.owner_before = before
  out.assertions.entries = {
    pageRendered: before.title === '海鲜打包' && before.notFound === false,
    editEntryPresent: before.entries.edit === true,
    recruitEntryPresent: before.entries.recruit === true,
    wageEntryPresent: before.entries.wage === true,
    campaignEntryPresent: before.entries.campaign === true,
    labelsI18n: before.labels.edit === ZH.wage.editTitle
      && before.labels.recruit === ZH.project.entryRecruit
      && before.labels.wage === ZH.project.entryWageStd,
    noModalInitially: before.open.edit === false && before.open.recruit === false && before.open.wage === false,
    noOverflow1536: before.overflow.doc === 0 && before.overflow.page === 0,
  }

  // ---- ① 【编辑项目】：字段集恰 3、零 status
  await owner.page.click('[data-sf-m="project-entry-edit"]')
  await settle(owner.page)
  const edit = await snap(owner.page)
  out.states.edit_open = edit
  out.assertions.editFieldSet = {
    modalOpen: edit.open.edit === true && edit.open.recruit === false && edit.open.wage === false,
    titleI18n: edit.titles.edit === ZH.wage.editTitle,
    exactlyThreeProjectFields: JSON.stringify(edit.fieldNames.edit) === JSON.stringify(PROJECT_FIELDS),
    zeroStatusField: !edit.fieldNames.edit.includes('status'),
    _editFieldNames: edit.fieldNames.edit,
    noOverflow: edit.overflow.doc === 0 && edit.overflow.page === 0 && edit.overflow.panel === 0,
  }
  await owner.page.keyboard.press('Escape')
  await settle(owner.page)

  // ---- ② 【招工】：字段集恰 2 + 增量读数 + 已招 1 + 新增 2 ⇒ headcount 3
  await owner.page.click('[data-sf-m="project-entry-recruit"]')
  await settle(owner.page)
  const recruit = await snap(owner.page)
  out.states.recruit_open = recruit
  out.assertions.recruitForm = {
    modalOpen: recruit.open.recruit === true && recruit.open.edit === false && recruit.open.wage === false,
    titleI18n: recruit.titles.recruit === ZH.project.recruitTitle,
    exactlyTwoFields: JSON.stringify(recruit.fieldNames.recruit) === JSON.stringify(RECRUIT_FIELDS),
    noProjectOrWageFields: ['title', 'description', 'slug', 'status', 'batt', 'interval', 'cid', 'amount']
      .every((name) => !recruit.fieldNames.recruit.includes(name)),
    newSlotsEmptyPrefill: recruit.value.newSlots === '',
    readoutInitial: Boolean(recruit.slots)
      && recruit.slots.hired === '1' && recruit.slots.add === '' && recruit.slots.target === '2',
    readoutTextI18n: Boolean(recruit.slots) && recruit.slots.text === ZH.project.slotsReadout
      .replace('{{hired}}', '1').replace('{{add}}', '—').replace('{{target}}', '2'),
    noOverflow: recruit.overflow.doc === 0 && recruit.overflow.page === 0 && recruit.overflow.panel === 0,
  }

  await owner.page.fill('[data-sf-edit="newSlots"]', '2')
  const recruitFilled = await snap(owner.page)
  out.states.recruit_filled = recruitFilled
  out.assertions.recruitReadoutLive = {
    addIs2: recruitFilled.slots.add === '2',
    targetIs3: recruitFilled.slots.target === '3',
    textI18n: recruitFilled.slots.text === ZH.project.slotsReadout
      .replace('{{hired}}', '1').replace('{{add}}', '2').replace('{{target}}', '3'),
  }

  await owner.page.click('[data-sf-m="project-recruit-save"]')
  await settle(owner.page)
  const afterRecruit = await snap(owner.page)
  out.states.recruit_saved = afterRecruit
  out.states.recruit_patch_payload = owner.STATE.patch
  const recruitPatch = owner.STATE.patch[0] || null
  out.assertions.recruitSubmit = {
    patchCalledOnce: owner.STATE.patch.length === 1,
    payloadExactHeadcount3: Boolean(recruitPatch) && JSON.stringify(recruitPatch) === JSON.stringify({ headcount: 3 }),
    modalClosed: afterRecruit.open.recruit === false,
    okNotice: afterRecruit.noticeText === ZH.project.recruitSaved,
    headcountLineUpdated: afterRecruit.headcountLine === ZH.project.headcountLine
      .replace('{{hired}}', '1').replace('{{total}}', '3'),
    _headcountLine: afterRecruit.headcountLine,
  }

  // ---- ③ 【招工】新增留空 ⇒ 零 headcount 键（只带天数）
  await owner.page.click('[data-sf-m="project-entry-recruit"]')
  await settle(owner.page)
  await owner.page.selectOption('[data-sf-edit="minDays"]', '30')
  await owner.page.click('[data-sf-m="project-recruit-save"]')
  await settle(owner.page)
  const blankAddPatch = owner.STATE.patch[owner.STATE.patch.length - 1] || null
  out.states.recruit_blank_add_payload = blankAddPatch
  out.assertions.recruitBlankAdd = {
    payloadHasNoHeadcount: Boolean(blankAddPatch) && !Object.prototype.hasOwnProperty.call(blankAddPatch, 'headcount'),
    payloadExactDays: Boolean(blankAddPatch) && JSON.stringify(blankAddPatch) === JSON.stringify({ recruit_min_account_days: 30 }),
  }

  // ---- ④ 【设定工资标准】：字段集恰 4 + 一视同仁文案 + 改 batt 载荷只带该键
  await owner.page.click('[data-sf-m="project-entry-wage"]')
  await settle(owner.page)
  const wage = await snap(owner.page)
  out.states.wage_open = wage
  out.assertions.wageForm = {
    modalOpen: wage.open.wage === true && wage.open.edit === false && wage.open.recruit === false,
    titleI18n: wage.titles.wage === ZH.project.wageStdTitle,
    hooksExact: JSON.stringify(wage.fieldNames.wage) === JSON.stringify(WAGE_FIELDS),
    noProjectOrRecruitFields: ['title', 'description', 'slug', 'status', 'newSlots', 'minDays']
      .every((name) => !wage.fieldNames.wage.includes(name)),
    battReadOnly: wage.wageCard.battReadOnly === true,
    sliderPresent: wage.wageCard.rangeType === 'range',
    // 夹具是历史速率行（30 / 4h ⇒ ⚡7.5/h）⇒ 开框即显提示行，X 保留精度（不是取整的 8）
    legacyHintI18n: wage.wageCard.legacy === ZH.project.wageLegacyRate.replace('{{rate}}', '7.5'),
    anchorI18n: wage.wageCard.anchor === ZH.project.wageRateAnchor,
    hintMentionsAllMembers: Boolean(wage.hints.wageStd) && wage.hints.wageStd === ZH.project.wageStdHint
      && wage.hints.wageStd.includes('新老成员') && wage.hints.wageStd.includes('一视同仁'),
    _wageFieldNames: wage.fieldNames.wage,
    noOverflow: wage.overflow.doc === 0 && wage.overflow.page === 0 && wage.overflow.panel === 0,
  }

  // 拖滑块到档位 12（原生 setter + input 事件，绕开 React 的 value tracker）⇒ batt 派生 12
  await owner.page.evaluate((gear) => {
    const el = document.querySelector('[data-sf-edit="interval-range"]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, gear)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, WAGE_INTERVAL_GEAR)
  await settle(owner.page)
  const wageDragged = await snap(owner.page)
  out.states.wage_dragged = { value: wageDragged.value, card: wageDragged.wageCard }
  out.assertions.wageSlider = {
    rangeIsRange: wageDragged.wageCard.rangeType === 'range',
    battReadOnly: wageDragged.wageCard.battReadOnly === true,
    intervalSnapped: wageDragged.value.interval === WAGE_INTERVAL_GEAR,
    battDerived: wageDragged.value.batt === WAGE_INTERVAL_GEAR,
    anchorI18n: wageDragged.wageCard.anchor === ZH.project.wageRateAnchor,
    // 用户接管间隔后「历史速率」提示**退场**（读数已转 ⚡1/h 口径，留着会同屏自相矛盾）
    legacyHintCleared: wageDragged.wageCard.legacy === null,
  }
  await owner.page.click('[data-sf-m="project-wage-std-save"]')
  await settle(owner.page)
  const afterWage = await snap(owner.page)
  out.states.wage_saved = afterWage
  const wagePatch = owner.STATE.patch[owner.STATE.patch.length - 1] || null
  out.states.wage_patch_payload = wagePatch
  out.assertions.wageSubmit = {
    payloadExactTwoKeys: Boolean(wagePatch) && JSON.stringify(wagePatch) === JSON.stringify({
      wage_batt_per_claim: WAGE_INTERVAL_GEAR, wage_interval_hours: Number(WAGE_INTERVAL_GEAR),
    }),
    modalClosed: afterWage.open.wage === false,
    okNotice: afterWage.noticeText === ZH.project.wageStdSaved,
    noOverflow: afterWage.overflow.doc === 0 && afterWage.overflow.page === 0,
  }

  // ======================= 臂 2 · 两档几何（工资标准框在场）+ 零 pageerror =======================
  await owner.page.click('[data-sf-m="project-entry-wage"]')
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
    modalOpen390: geom.w390.open.wage,
    entries390: geom.w390.entries,
  }
  out.assertions.geometry = {
    noOverflow390: geom.w390.overflow.doc === 0 && geom.w390.overflow.page === 0 && geom.w390.overflow.panel === 0,
    noOverflow1536: geom.w1536.overflow.doc === 0 && geom.w1536.overflow.page === 0 && geom.w1536.overflow.panel === 0,
    allFourEntriesAt390: geom.w390.entries.edit === true && geom.w390.entries.recruit === true
      && geom.w390.entries.wage === true && geom.w390.entries.campaign === true,
  }
  out.pageErrors.owner = owner.pageErrors
  await owner.context.close()

  // ======================= 臂 3 · 普通用户：四入口零渲染、零写口 =======================
  const other = await makeArm(browser, { viewerUid: OTHER_UID, view: viewOf({ owner_uid: 99 }) })
  await other.page.goto(`${ORIGIN}/sui`, { waitUntil: 'load' })
  await settle(other.page)
  const guest = await snap(other.page)
  out.states.other_viewer = guest
  out.assertions.otherViewer = {
    pageRendered: guest.title === '海鲜打包' && guest.notFound === false,
    noEditEntry: guest.entries.edit === false,
    noRecruitEntry: guest.entries.recruit === false,
    noWageEntry: guest.entries.wage === false,
    zeroWrites: other.STATE.patch.length === 0,
    everyModalClosed: guest.open.edit === false && guest.open.recruit === false && guest.open.wage === false,
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
  console.log(`[probe-manage-modals] ${out.summary.passed}/${out.summary.assertions} passed · pageErrors=${out.summary.pageErrors} ⇒ ${out.summary.ok ? 'OK' : 'FAIL'}`)
  if (failed.length) console.log(`[probe-manage-modals] failed: ${failed.join(', ')}`)
  console.log(`[probe-manage-modals] written: ${OUT}`)
  process.exit(out.summary.ok ? 0 : 1)
}

main().catch((error) => {
  console.error('[probe-manage-modals] crashed:', error)
  process.exit(1)
})
