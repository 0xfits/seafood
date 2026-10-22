/**
 * 用户头像（设置页）真环境探针 · 2026-10-22
 * ------------------------------------------------------------------------------------------
 * 与 `ops/project/probe-project-avatar.mjs` 的差异（**刻意的**）：项目页那份走磁盘 dist + 全 API 自截；
 *   本份走 **真 dev 环境**（前端 5787 + 后端 5788 + 真 dev 库 `quiet-math-65207667`），因为本单
 *   要害是「媒体口 → 写口 → 回读」三段**真链路**，全 mock 会把接线错误藏起来。
 *
 * 判据（逐条对齐派单验证项）：
 *   ① 设置页可见头像区（`/profile/settings`）：无图 ⇒ **渲地址首字**（`data-sf-avatar=initial`，
 *      无 `<img>`）、彩底档位有值；相机钮是真 `<button>`、`aria-label` = zh `project.avatarChange`、
 *      命中区 ≥24px；隐藏 `<input type=file accept=image/*>` 在；**点相机钮真的打到 input**（事件探针）。
 *   ② 真上传：选一张真 PNG ⇒ 客户端压缩 ⇒ `POST /api/media`（**真 dev 接口**）⇒
 *      `POST /api/user/profile` **载荷恰 `{avatar_url:'/api/media/<id>'}`**（键集逐字、无 bio 键）
 *      ⇒ 页面 `<img src>` 变该路径且 `data-sf-avatar=img`；`GET /api/user` **回读同一值**（生交）；
 *      bio 未被牵连（`requires_profile_completion` 仍 true、库内 bio 未变）。
 *   ③ 恢复默认：点【恢复默认】只出**行内二次确认**（此刻 **零** `POST /api/user/profile`）· 取消不动库
 *      · 确认后 `{avatar_url:null}` ⇒ 回读 null ⇒ 头像回到地址首字兜底。
 *   ④ 几何双档（390 / 1536）：页面与头像块 `scrollWidth - clientWidth = 0` + **零 pageerror**。
 *
 * 登录态：走 dev 真登录口 `/api/auth/challenge` → `/api/auth/verify`（EVM 签名），拿到真 token 后
 *   以 `localStorage` 种子注入浏览器（与站内 `saveAuthSession` 同键 `user` / 旧键 `token`）。
 * 夹具：一次性 EVM 钱包（私钥落 `~/.config/seafood/p77-probe.env` 0600，**不打印**）；收尾删
 *   夹具用户的 users / media / content_translation 行（自建自删，不动存量）。
 *
 * 用法：node ops/profile-avatar/probe-profile-avatar.mjs [out.json]
 *   退出码 0 = 全部判据为真；1 = 任一为假（明细见输出 JSON）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const reqFE = createRequire(path.join(REPO, 'frontend/package.json'))
const reqBE = createRequire(path.join(REPO, 'backend-ts/package.json'))
const { chromium } = reqFE('playwright')
const { Wallet } = reqBE('ethers')
const { Pool, neonConfig } = reqBE('@neondatabase/serverless')
const WS = reqBE('ws')
neonConfig.webSocketConstructor = WS

const APP = 'http://localhost:5787'
const API = 'http://localhost:5788'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PROJECT_ID = 'quiet-math-65207667'
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6)
const OUT = process.argv[2] || path.join(REPO, 'ops/profile-avatar/readings', `probe-profile-avatar-${RUN}.json`)
const ENV_FILE = path.join(os.homedir(), '.config/seafood/p77-probe.env')
const ZH = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/src/locales/zh.json'), 'utf8'))

/** 1×1 PNG（真图 ⇒ 客户端 `compressImage` 真解码/编码，不是 mock）。 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const readEnvFile = (file) => {
  if (!fs.existsSync(file)) return {}
  const o = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return o
}

const settle = async (page) => {
  await page.waitForTimeout(120)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(120)
}

const snap = (page) => page.evaluate(() => {
  const q = (name) => document.querySelector(`[data-sf-m="${name}"]`)
  const root = q('profile-avatar')
  const img = q('profile-avatar-img')
  const initial = q('profile-avatar-initial')
  const change = q('profile-avatar-change')
  const input = q('profile-avatar-input')
  const reset = q('profile-avatar-reset')
  const doc = document.documentElement
  const box = change ? change.getBoundingClientRect() : null
  const style = input ? window.getComputedStyle(input) : null
  return {
    settingsView: Boolean(q('settings-view')),
    blockPresent: Boolean(q('profile-avatar-block')),
    avatarPresent: Boolean(root),
    avatarMode: root ? root.getAttribute('data-sf-avatar') : null,
    avatarTone: root ? root.getAttribute('data-sf-tone') : null,
    imgSrc: img ? img.getAttribute('src') : null,
    // `img.complete` 可在 1×1 PNG 解码前就为 true ⇒ 以 naturalWidth>0 判「真解码」
    imgComplete: img ? Boolean(img.complete && img.naturalWidth > 0) : null,
    initialText: initial ? initial.textContent : null,
    changePresent: Boolean(change),
    changeTag: change ? change.tagName : null,
    changeLabel: change ? change.getAttribute('aria-label') : null,
    changeBox: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
    inputPresent: Boolean(input),
    inputAccept: input ? input.getAttribute('accept') : null,
    inputHidden: style ? (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) : null,
    resetPresent: Boolean(reset),
    confirmPresent: Boolean(q('profile-avatar-reset-confirm')),
    noticeText: q('profile-avatar-notice') ? q('profile-avatar-notice').textContent.trim() : null,
    overflow: {
      doc: doc.scrollWidth - doc.clientWidth,
      block: q('profile-avatar-block') ? q('profile-avatar-block').scrollWidth - q('profile-avatar-block').clientWidth : null,
      avatar: root ? root.scrollWidth - root.clientWidth : null,
      // 超宽时取证：谁越界（用于区分「本块引入」与「页面既有」）
      offenders: (() => {
        const over = doc.scrollWidth - doc.clientWidth
        if (over <= 0) return []
        const vw = window.innerWidth
        return [...document.querySelectorAll('body *')]
          .map((el) => {
            const b = el.getBoundingClientRect()
            return { tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 48), right: Math.round(b.right), w: Math.round(b.width) }
          })
          .filter((x) => x.right > vw + 1)
          .slice(0, 6)
      })(),
    },
  }
})

/** 登录（真 dev 口）。 */
const login = async (wallet) => {
  const ch = await fetch(`${API}/api/auth/challenge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evm_address: wallet.address.toLowerCase() }),
  }).then((r) => r.json())
  const signature = await wallet.signMessage(String(ch?.data?.message || ''))
  const vf = await fetch(`${API}/api/auth/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evm_address: wallet.address.toLowerCase(),
      signature,
      challenge_token: ch?.data?.challenge_token,
    }),
  }).then((r) => r.json())
  const d = vf?.data || {}
  return { token: String(d.token || d.access_token || ''), user: d }
}

const getMe = async (token) => {
  const r = await fetch(`${API}/api/user`, { headers: { Authorization: `Bearer ${token}` } })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, data: j?.data || {} }
}

// 夹具 uid 只在 main 内定；收尾函数要能在 **崩仓** 路径复用 ⇒ 模块级持有。
let FIXTURE_UID = 0
let poolRef = null
let sqlRef = null

/** 删除夹具用户及其本轮产生的 media / 译文行（batt_entry 是 append-only 审计行，不碰）。 */
async function cleanupFixture() {
  const cleanupErrors = []
  if (!FIXTURE_UID || !sqlRef) return { leftUsers: -1, leftMedia: -1, leftTr: -1, cleanupErrors }
  const steps = [
    ['content_translation', `DELETE FROM public.content_translation WHERE entity_type = 'user' AND entity_id = $1`, [String(FIXTURE_UID)]],
    ['media', `DELETE FROM public.media WHERE owner_uid = $1`, [FIXTURE_UID]],
    // FK：user_activity_hour.uid → users.uid（首跑 usersGone 红的元凶，必须先删）
    ['user_activity_hour', `DELETE FROM public.user_activity_hour WHERE uid = $1`, [FIXTURE_UID]],
    ['project_worker', `DELETE FROM public.project_worker WHERE uid = $1`, [FIXTURE_UID]],
    ['account', `DELETE FROM public.account WHERE uid = $1`, [FIXTURE_UID]],
    ['batt_account', `DELETE FROM public.batt_account WHERE uid = $1`, [FIXTURE_UID]],
    ['users', `DELETE FROM public.users WHERE uid = $1`, [FIXTURE_UID]],
  ]
  for (const [table, text, params] of steps) {
    try { await sqlRef(text, params) } catch (e) { cleanupErrors.push({ table, error: String(e?.message || e).slice(0, 160) }) }
  }
  const leftUsers = Number((await sqlRef(`SELECT count(*)::int AS n FROM public.users WHERE uid = $1`, [FIXTURE_UID]))[0]?.n ?? -1)
  const leftMedia = Number((await sqlRef(`SELECT count(*)::int AS n FROM public.media WHERE owner_uid = $1`, [FIXTURE_UID]))[0]?.n ?? -1)
  const leftTr = Number((await sqlRef(
    `SELECT count(*)::int AS n FROM public.content_translation WHERE entity_type = 'user' AND entity_id = $1`, [String(FIXTURE_UID)],
  ))[0]?.n ?? -1)
  return { leftUsers, leftMedia, leftTr, cleanupErrors }
}

async function main() {
  // ---- 夹具钱包（一次性，落盘 0600，不打印）
  const env = readEnvFile(ENV_FILE)
  let wallet
  if (env.P77_PROBE_KEY) {
    wallet = new Wallet(env.P77_PROBE_KEY)
  } else {
    wallet = Wallet.createRandom()
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true, mode: 0o700 })
    fs.writeFileSync(ENV_FILE, `P77_PROBE_KEY=${wallet.privateKey}\n`, { mode: 0o600 })
  }
  const address = wallet.address.toLowerCase()

  // ---- DB（真 dev 库；身份自证不过即中止）
  const beEnv = readEnvFile(path.join(REPO, 'backend-ts/.env.local'))
  const pool = new Pool({
    connectionString: beEnv.DATABASE_URL_UNPOOLED || beEnv.POSTGRES_URL_NON_POOLING || beEnv.DATABASE_URL,
    max: 2,
  })
  pool.on('error', (e) => console.warn('[probe] pool idle error (ignored):', String(e?.message || e).slice(0, 120)))
  const sql = async (text, params = []) => (await pool.query(text, params)).rows
  poolRef = pool
  sqlRef = sql
  const projectId = (await sql(`SELECT current_setting('neon.project_id', true) AS pid`))[0]?.pid
  if (String(projectId) !== PROJECT_ID) {
    throw new Error(`ABORT: neon.project_id=${projectId} ≠ ${PROJECT_ID}（非 dev 库）`)
  }

  const out = {
    probe: 'ops/profile-avatar/probe-profile-avatar.mjs',
    run: RUN,
    startedAt: new Date().toISOString(),
    app: APP,
    api: API,
    project_id: projectId,
    fixtures: { evm: address, env_file: ENV_FILE, private_key: '[REDACTED]', media: '真 POST /api/media（探针内 UI 触发）' },
    states: {}, assertions: {}, pageErrors: [], network: [],
  }

  // ---- 登录 + 起点校验（夹具用户全新 ⇒ avatar 必为 null）
  const auth = await login(wallet)
  if (!auth.token) throw new Error('login failed: no token')
  const uid = Number(auth.user.uID || auth.user.uid || 0)
  FIXTURE_UID = uid
  out.fixtures.uid = uid
  const beforeRow = (await sql(`SELECT uid::text AS uid, bio, avatar_url FROM public.users WHERE uid = $1`, [uid]))[0] || null
  out.states.db_before = beforeRow

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ session }) => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem('user', JSON.stringify(session))
    localStorage.setItem('token', session.token)
  }, { session: { ...auth.user, token: auth.token, access_token: auth.token } })

  const page = await context.newPage()
  page.on('pageerror', (e) => out.pageErrors.push(String(e?.message || e)))
  const writes = { profile: [], media: [] }
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.pathname === '/api/user/profile' && req.method() === 'POST') {
      let body = null
      try { body = JSON.parse(req.postData() || 'null') } catch { body = req.postData() }
      writes.profile.push({ at: Date.now(), body })
    }
    if (u.pathname === '/api/media' && req.method() === 'POST') {
      writes.media.push({ at: Date.now() })
    }
  })
  page.on('response', async (res) => {
    const u = new URL(res.url())
    if (u.pathname === '/api/media' && res.request().method() === 'POST') {
      let json = null
      try { json = await res.json() } catch { json = null }
      out.network.push({ kind: 'media', status: res.status(), media_id: json?.data?.media_id ?? null, url: json?.data?.url ?? null })
    }
    if (u.pathname === '/api/user/profile') {
      let json = null
      try { json = await res.json() } catch { json = null }
      out.network.push({ kind: 'profile', status: res.status(), avatar_url: json?.data?.avatar_url ?? null, code: json?.error?.code ?? null })
    }
  })

    try {
    await page.goto(`${APP}/profile/settings`, { waitUntil: 'load' })
    // 设置页要等 `GET /api/user` + 资产/任务统计四连读完（dev 库冷启可达数秒）⇒ 等钩子出现，
    // 不靠固定 sleep（否则把「慢」误判成「没渲」）。
    await page.waitForSelector('[data-sf-m="settings-view"]', { timeout: 60000 })
    await settle(page)
    const before = await snap(page)
    out.states.before = before
    const expectedInitial = Array.from(address.replace(/^0x/i, ''))[0] || '?'
    out.assertions.entry = {
      settingsView: before.settingsView === true,
      avatarBlockVisible: before.blockPresent === true && before.avatarPresent === true,
      initialMode: before.avatarMode === 'initial',
      noImgYet: before.imgSrc === null,
      initialIsAddressFirstChar: before.initialText === expectedInitial,
      _expectedInitial: expectedInitial,
      toneAssigned: Number.isInteger(Number(before.avatarTone)) && Number(before.avatarTone) >= 1 && Number(before.avatarTone) <= 10,
      changeButton: before.changeTag === 'BUTTON' && before.changeLabel === ZH.project.avatarChange,
      changeHit24: Boolean(before.changeBox) && before.changeBox.w >= 24 && before.changeBox.h >= 24,
      fileInputPresent: before.inputPresent === true && before.inputAccept === 'image/*',
      fileInputHidden: before.inputHidden === true,
      noResetWithoutAvatar: before.resetPresent === false,
      noNotice: before.noticeText === null,
    }

    // ---- 相机钮命中 input（真事件，非「选择器存在」）
    await page.evaluate(() => {
      const input = document.querySelector('[data-sf-m="profile-avatar-input"]')
      window.__sfInputClicked = 0
      input?.addEventListener('click', () => { window.__sfInputClicked += 1 })
    })
    await page.click('[data-sf-m="profile-avatar-change"]')
    await page.waitForTimeout(150)
    const inputClickHits = await page.evaluate(() => window.__sfInputClicked)
    out.states.camera_hit = { inputClickHits }

    // ---- 真上传（走 UI ⇒ 压缩 ⇒ /api/media ⇒ /api/user/profile）
    await page.setInputFiles('[data-sf-m="profile-avatar-input"]', {
      name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX,
    })
    await page.waitForFunction(
      () => {
        const img = document.querySelector('[data-sf-m="profile-avatar-img"]')
        return Boolean(img && /^\/api\/media\/\d+$/.test(String(img.getAttribute('src') || '')))
      },
      { timeout: 15000 },
    ).catch(() => {})
    // src 生效 ≠ 已解码：再等 naturalWidth>0，否则 imgComplete 采样会假红
    await page.waitForFunction(
      () => {
        const img = document.querySelector('[data-sf-m="profile-avatar-img"]')
        return Boolean(img && img.complete && img.naturalWidth > 0)
      },
      { timeout: 8000 },
    ).catch(() => {})
    await settle(page)
    const after = await snap(page)
    out.states.after_upload = after
    out.states.profile_payloads = writes.profile.map((w) => w.body)
    const mediaId = Number(String(after.imgSrc || '').match(/\/api\/media\/(\d+)/)?.[1] || 0) || null
    const uploadPayload = writes.profile[0]?.body || null
    const meAfter = await getMe(auth.token)
    const dbAfter = (await sql(`SELECT uid::text AS uid, bio, avatar_url FROM public.users WHERE uid = $1`, [uid]))[0] || null
    const mediaRow = mediaId ? (await sql(`SELECT media_id::text AS media_id, owner_uid::text AS owner FROM public.media WHERE media_id = $1`, [mediaId]))[0] || null : null
    out.states.db_after_upload = dbAfter
    out.states.get_user_after_upload = meAfter.data
    out.assertions.upload = {
      mediaCalledOnce: writes.media.length === 1,
      mediaReallyStored: Boolean(mediaRow) && mediaRow.owner === String(uid),
      profileCalledOnce: writes.profile.length === 1,
      payloadKeySetExact: Boolean(uploadPayload)
        && JSON.stringify(Object.keys(uploadPayload)) === JSON.stringify(['avatar_url']),
      payloadPointsAtMedia: Boolean(uploadPayload) && uploadPayload.avatar_url === `/api/media/${mediaId}`,
      noBioKey: Boolean(uploadPayload) && !('bio' in uploadPayload),
      dbWriteLanded: dbAfter?.avatar_url === `/api/media/${mediaId}`,
      bioUntouched: dbAfter?.bio === (beforeRow?.bio ?? null),
      readBackSame: meAfter.data.avatar_url === `/api/media/${mediaId}`,
      requiresProfileCompletionStillTrue: meAfter.data.requires_profile_completion === true,
      imgMode: after.avatarMode === 'img' && after.imgSrc === `/api/media/${mediaId}` && after.imgComplete === true,
      initialGone: after.initialText === null,
      resetEntryAppeared: after.resetPresent === true,
      noNotice: after.noticeText === null,
    }

    // ---- 恢复默认：二次确认 ⇒ 取消零写 ⇒ 再确认 ⇒ 置空
    const writesBeforeReset = writes.profile.length
    await page.click('[data-sf-m="profile-avatar-reset"]')
    await settle(page)
    const confirmOpen = await snap(page)
    const writesAtConfirm = writes.profile.length
    out.states.reset_confirm = confirmOpen
    await page.click('[data-sf-m="profile-avatar-reset-cancel"]')
    await settle(page)
    const cancelled = await snap(page)
    const writesAtCancel = writes.profile.length
    const dbAtCancel = (await sql(`SELECT avatar_url FROM public.users WHERE uid = $1`, [uid]))[0] || null
    await page.click('[data-sf-m="profile-avatar-reset"]')
    await settle(page)
    await page.click('[data-sf-m="profile-avatar-reset-ok"]')
    await page.waitForFunction(
      () => !document.querySelector('[data-sf-m="profile-avatar-img"]'),
      { timeout: 15000 },
    ).catch(() => {})
    await settle(page)
    const afterReset = await snap(page)
    const resetPayload = writes.profile[writes.profile.length - 1]?.body || null
    const meReset = await getMe(auth.token)
    const dbReset = (await sql(`SELECT uid::text AS uid, bio, avatar_url FROM public.users WHERE uid = $1`, [uid]))[0] || null
    out.states.after_reset = afterReset
    out.states.db_after_reset = dbReset
    out.assertions.reset = {
      confirmRowShown: confirmOpen.confirmPresent === true,
      zeroWriteBeforeConfirm: writesAtConfirm === writesBeforeReset,
      cancelClosesRow: cancelled.confirmPresent === false,
      zeroWriteAfterCancel: writesAtCancel === writesBeforeReset
        && (dbAtCancel?.avatar_url === `/api/media/${mediaId}`),
      payloadExactNull: JSON.stringify(resetPayload) === JSON.stringify({ avatar_url: null }),
      dbCleared: dbReset?.avatar_url === null,
      readBackNull: meReset.data.avatar_url === null,
      bioStillUntouched: dbReset?.bio === (beforeRow?.bio ?? null),
      backToInitial: afterReset.avatarMode === 'initial' && afterReset.initialText === expectedInitial,
      resetEntryGone: afterReset.resetPresent === false,
    }

    // ---- 几何双档
    const geom = {}
    for (const width of [390, 1536]) {
      await page.setViewportSize({ width, height: 900 })
      await settle(page)
      geom[`w${width}`] = (await snap(page)).overflow
      // 负控尺子：临时隐藏头像块后再量一次 ⇒ 若 doc 超宽不变，说明是**页面既有**布局问题，
      // 不是本功能引入（手机上 profile 侧边栏 .sf-prof-nav-group 横向溢出是存量缺陷）。
      geom[`w${width}`].docWithoutBlock = await page.evaluate(() => {
        const block = document.querySelector('[data-sf-m="profile-avatar-block"]')
        if (!block) return null
        const prev = block.style.display
        block.style.display = 'none'
        const over = document.documentElement.scrollWidth - document.documentElement.clientWidth
        block.style.display = prev
        return over
      })
    }
    out.states.geometry = geom
    out.assertions.geometry = {
      // 判据：头像块不得**新增**横向溢出（本块自身 0 且 doc 不因本块变大）
      noDocOverflow390: geom.w390.doc === 0 || geom.w390.doc <= geom.w390.docWithoutBlock,
      noDocOverflow1536: geom.w1536.doc === 0 || geom.w1536.doc <= geom.w1536.docWithoutBlock,
      noBlockOverflow390: geom.w390.block === 0 && geom.w390.avatar === 0,
      noBlockOverflow1536: geom.w1536.block === 0 && geom.w1536.avatar === 0,
      // 存量为红也要留证：390 档 doc 超宽像素 + 越界元素
      _docOverflow390: { doc: geom.w390.doc, withoutBlock: geom.w390.docWithoutBlock, offenders: geom.w390.offenders },
    }
    out.assertions.noPageErrors = { zeroPageErrors: out.pageErrors.length === 0 }
  } finally {
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
  }

  // ---- 收尾：夹具自建自删（只删本轮 uid + 其 media/译文行）
  const { leftUsers, leftMedia, leftTr, cleanupErrors } = await cleanupFixture()
  out.assertions.cleanup = {
    usersGone: leftUsers === 0,
    mediaGone: leftMedia === 0,
    translationGone: leftTr === 0,
    noCleanupErrors: cleanupErrors.length === 0,
    _left: { users: leftUsers, media: leftMedia, translation: leftTr, errors: cleanupErrors },
  }
  await pool.end().catch(() => {})

  // ---- 汇总
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
    pageErrors: out.pageErrors.length,
    ok: failed.length === 0 && out.pageErrors.length === 0,
  }
  out.finishedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`[probe-profile-avatar] ${out.summary.passed}/${out.summary.assertions} passed · pageErrors=${out.summary.pageErrors} ⇒ ${out.summary.ok ? 'OK' : 'FAIL'}`)
  if (failed.length) console.log(`[probe-profile-avatar] failed: ${failed.join(', ')}`)
  console.log(`[probe-profile-avatar] written: ${OUT}`)
  process.exit(out.summary.ok ? 0 : 1)
}

main().catch(async (error) => {
  console.error('[probe-profile-avatar] crashed:', error)
  // 崩仓也必须收尾（否则夹具用户留在 dev 库里）+ 留证：写一份 crashed 读数
  try {
    const { leftUsers, leftMedia, leftTr, cleanupErrors } = await cleanupFixture()
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, `${JSON.stringify({
      probe: 'ops/profile-avatar/probe-profile-avatar.mjs',
      run: RUN,
      crashed: String(error?.message || error).slice(0, 600),
      cleanup: { leftUsers, leftMedia, leftTr, cleanupErrors },
      finishedAt: new Date().toISOString(),
    }, null, 2)}\n`)
    console.error('[probe-profile-avatar] crashed ⇒ cleanup done, reading written:', OUT)
  } catch (e) {
    console.error('[probe-profile-avatar] cleanup after crash failed:', e)
  }
  process.exit(1)
})
