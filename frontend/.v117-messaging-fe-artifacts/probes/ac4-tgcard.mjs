// AC-4 · ProfilePage「Telegram 通知」卡三态浏览器读数（Kong · 2026-10-12）
// ============================================================================
// Neng 的独立质检把 AC-4 的**浏览器面**标了 `NOT_MEASURED` ⇒ 本探针补该面读数。
//
// 两相（同前端 5792；后端 5793 两相之间由外部重启，唯一差别 = Telegram env 是否配置）：
//   PHASE=a：后端**无** `TELEGRAM_BOT_TOKEN` ⇒ 卡应落**降级态**（503 TG_NOT_CONFIGURED 判据）。
//   PHASE=b：后端**有**（dev 假）token/secret/bot ⇒ 未绑定态 → 点「绑定」取真 code（HMAC 令牌，
//            **不入库**）→ 卡内 `codeSteps` 插值渲染 → 经**真 webhook**（带 secret 头）消费 code
//            ⇒ 库内落 `tg_user_id`（本相唯一 DB 写）→ 已绑定态 → 二次确认解绑 ⇒ 回未绑定态
//            （`users.tg_user_id` 归零 = 净零，读数里附起止两次 API status 现取）。
//
// 断言面（不改产品代码 / 不改判据，只取数）：
//   ① 三态 + 二次确认态的 `data-sf-tg-state` 与状态行文案（取四语真值 json 逐字比对）；
//   ② 六个钩子的**在场与可见性**（`tg-bind-card`/`-status`/`-code`/`-steps`/`-action`/`tg-unbind-action`）；
//   ③ `codeSteps` 插值：渲染面必须同时含真 code 与 bot username（`{{bot}}`/`{{code}}` 均被替换）；
//   ④ **隐私红线**：渲染面（卡 + 整页 innerText）**不出现** `tg_user_id` 值；`bind/status` 响应键集
//      不含 `tg_user_id`；
//   ⑤ 降级**不冒泡**：整页不出现裸键名 `TG_NOT_CONFIGURED`、无 pageerror、无 toast 报错；
//   ⑥ 两档宽度：390 / 1440。
//
// 用法：
//   PHASE=a node ac4-tgcard.mjs
//   PHASE=b TG_SECRET=… TG_BOT=… TG_ID=… node ac4-tgcard.mjs
//   （TG_SECRET 只用于签名 webhook 请求头，**不落读数文件**）
import { launch, openPage, isVisible, countOf, waitQuiet, ARTDIR, BASE, TOKENS } from './lib.mjs'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'

const PHASE = String(process.env.PHASE || 'a').toLowerCase()
const TG_SECRET = String(process.env.TG_SECRET || '')
const TG_BOT = String(process.env.TG_BOT || '')
const TG_ID = String(process.env.TG_ID || '770000123')
const BACKEND = 'http://127.0.0.1:5793'
const UID = 7
const OUT = `${ARTDIR}/readings/ac4-tgcard-three-states.json`
const HOOKS = ['tg-bind-card', 'tg-bind-status', 'tg-bind-code', 'tg-bind-steps', 'tg-bind-action', 'tg-unbind-action']
const CARD = '[data-sf-m="tg-bind-card"]'
const stateSel = (h) => `[data-sf-m="${h}"]`

const L = {}
for (const l of ['zh', 'en']) L[l] = JSON.parse(readFileSync(`${ARTDIR}/../src/locales/${l}.json`, 'utf8'))

// ---------------------------------------------------------------- 页内取数
async function waitCard(page, { attempts = 3, timeoutMs = 30000 } = {}) {
  let n = 0
  let state = '(absent)'
  for (let i = 1; i <= attempts; i += 1) {
    n = i
    // 稳健等待：卡**在场**且 `data-sf-tg-state` **已定**（≠ 'loading'）—— 不再在 loading 时抢读/重载
    // （首跑实证：loading 期抢读会与在飞的 `bind/status` 取数竞态 ⇒ 读到 attr 与文案不同步的伪影）。
    await page.waitForFunction((s) => {
      const el = document.querySelector(s)
      const st = el && el.getAttribute('data-sf-tg-state')
      return Boolean(st && st !== 'loading')
    }, CARD, { timeout: timeoutMs, polling: 150 }).catch(() => {})
    state = await page.evaluate((s) => {
      const el = document.querySelector(s)
      return el ? String(el.getAttribute('data-sf-tg-state')) : '(absent)'
    }, CARD)
    if (state !== 'loading' && state !== '(absent)') break
    if (i < attempts) await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  }
  await waitQuiet(page, { quietMs: 400, timeoutMs: 8000 })
  return { state, attempts: n }
}

async function readCard(page, label, extra = {}) {
  const hooks = {}
  for (const h of HOOKS) {
    hooks[h] = {
      count: await countOf(page, stateSel(h)),
      visible: await isVisible(page, stateSel(h)),
      text: (await page.locator(stateSel(h)).first().textContent().catch(() => null))?.trim()?.slice(0, 240) ?? null,
    }
  }
  const probe = await page.evaluate(([cardSel, tgId]) => {
    const card = document.querySelector(cardSel)
    const text = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : null)
    const r = card ? card.getBoundingClientRect() : null
    return {
      cardState: card ? String(card.getAttribute('data-sf-tg-state')) : '(absent)',
      cardText: text(card),
      cardRect: r ? { y: Math.round(r.y), h: Math.round(r.height) } : null,
      bodyText: text(document.body),
      rawKeyLeak: (document.body.innerText || '').includes('TG_NOT_CONFIGURED'),
      toastCount: document.querySelectorAll('[role="status"], .go2072408551').length,
      alertMentionsTg: Array.from(document.querySelectorAll('[role="alert"]')).some((e) => (e.innerText || '').includes('Telegram')),
      noTgUserIdInCard: !(text(card) || '').includes(tgId),
      noTgUserIdInPage: !(text(document.body) || '').includes(tgId),
    }
  }, [CARD, TG_ID])
  return {
    label,
    ...probe,
    hooks,
    ...extra,
    networkFailures: (extra.consoleErrors || []).filter((m) => /Failed to load resource/.test(m)),
  }
}

/** 逐条断言（判据取自 §20.5 钩子 + §20.2 三态 + §20.9 AC-4；不改产品代码）。 */
function checkRecord(rec, lang, expectState) {
  const f = []
  const tag = `AC4 ${rec.label}`
  const T = L[lang].telegram
  if (rec.cardState !== expectState) f.push(`${tag}: data-sf-tg-state=${rec.cardState}（应 ${expectState}）`)
  const statusText = rec.hooks['tg-bind-status'].text || ''
  const expectedStatus = expectState === 'notConfigured' ? T.notConfigured
    : expectState === 'bound' ? T.bound
      : T.notBound // unbound 与 code 两态的状态行同为「未绑定」（code 态另有 codeLabel/steps 两行）
  if (rec.hooks['tg-bind-status'].count !== 1 || !rec.hooks['tg-bind-status'].visible) f.push(`${tag}: tg-bind-status 未在场/不可见`)
  if (statusText !== expectedStatus) f.push(`${tag}: 状态行文案="${statusText}"（应 "${expectedStatus}"）`)
  // 钩子在场矩阵（按态）
  const want = {
    notConfigured: { 'tg-bind-action': false, 'tg-unbind-action': false, 'tg-bind-code': false, 'tg-bind-steps': false },
    unbound: { 'tg-bind-action': true, 'tg-unbind-action': false, 'tg-bind-code': false, 'tg-bind-steps': false },
    code: { 'tg-bind-action': true, 'tg-unbind-action': false, 'tg-bind-code': true, 'tg-bind-steps': true },
    bound: { 'tg-bind-action': false, 'tg-unbind-action': true, 'tg-bind-code': false, 'tg-bind-steps': false },
  }[expectState] || {}
  for (const [h, should] of Object.entries(want)) {
    const present = rec.hooks[h].count > 0 && rec.hooks[h].visible
    if (should !== present) f.push(`${tag}: ${h} 在场/可见=${present}（应 ${should}）`)
  }
  // 隐私 + 不冒泡
  if (!rec.noTgUserIdInCard) f.push(`${tag}【判负·隐私】: 卡内出现 tg_user_id 值 ${TG_ID}`)
  if (!rec.noTgUserIdInPage) f.push(`${tag}【判负·隐私】: 整页出现 tg_user_id 值 ${TG_ID}`)
  if (rec.rawKeyLeak) f.push(`${tag}【判负·降级冒泡】: 整页出现裸键名 TG_NOT_CONFIGURED`)
  if ((rec.pageErrors || []).length > 0) f.push(`${tag}【判负】: pageerror ${JSON.stringify(rec.pageErrors)}`)
  // ★ 只把**应用侧** console.error 当判负；浏览器对 5xx 响应的 `Failed to load resource:` 属网络层
  //   记录（降级路径本就会产生），单列 `networkFailures` 留痕、不进判负。
  const appConsole = (rec.consoleErrors || []).filter((m) => !/Failed to load resource/.test(m))
  if (appConsole.length > 0) f.push(`${tag}: 应用侧 console.error ${JSON.stringify(appConsole.slice(0, 3))}`)
  // code 插值
  if (expectState === 'code') {
    const code = String(rec.issuedCode || '')
    const steps = rec.hooks['tg-bind-steps'].text || ''
    const shown = rec.hooks['tg-bind-code'].text || ''
    if (!code) f.push(`${tag}: 未取到 code（POST bind/start 失败？）`)
    if (shown !== code) f.push(`${tag}: tg-bind-code 文本="${shown}" 与签发 code 不一致`)
    if (code && !steps.includes(code)) f.push(`${tag}: codeSteps 未插值 {{code}}`)
    if (TG_BOT && !steps.includes(TG_BOT)) f.push(`${tag}: codeSteps 未插值 {{bot}}（应含 ${TG_BOT}）`)
    if (steps.includes('{{')) f.push(`${tag}: codeSteps 残留未替换占位符：${steps}`)
    if (!(rec.cardText || '').includes(T.codeLabel)) f.push(`${tag}: 卡内未见 codeLabel 文案「${T.codeLabel}」`)
    if (!steps) f.push(`${tag}: codeSteps 空`)
  }
  return f
}

// ---------------------------------------------------------------- API 直取（只读）
const api = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(BACKEND + path, {
    method,
    headers: { Authorization: `Bearer ${TOKENS[String(UID)]}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await res.text()
  let json = null
  try { json = JSON.parse(txt) } catch { /* 非 JSON */ }
  return { status: res.status, json, keys: json && typeof json === 'object' ? Object.keys(json) : [] }
}

const webhook = async (code) => {
  const res = await fetch(`${BACKEND}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': TG_SECRET },
    body: JSON.stringify({ update_id: 1, message: { message_id: 1, from: { id: Number(TG_ID), is_bot: false }, chat: { id: Number(TG_ID) }, text: `/start ${code}` } }),
  })
  return { status: res.status, body: await res.text() }
}

// ---------------------------------------------------------------- 单档走查
async function walkWidth(browser, width, out, fails) {
  const lang = 'zh'
  const key = `${lang}@${width}`
  const { context, page } = await openPage(browser, { width, uID: UID })
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(String(m.text()).slice(0, 200)) })
  try {
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded', timeout: 30000 })

    if (PHASE === 'a') {
      const w = await waitCard(page)
      const rec = await readCard(page, `notConfigured ${key}`, { renderAttempts: w.attempts, pageErrors, consoleErrors })
      out.states.notConfigured = out.states.notConfigured || {}
      out.states.notConfigured[key] = rec
      fails.push(...checkRecord(rec, lang, 'notConfigured'))
      return
    }

    // ---- PHASE B：未绑定 → code → （webhook 消费）已绑定 → 二次确认 → 解绑回未绑定
    const w1 = await waitCard(page)
    const sApi1 = await api('/api/telegram/bind/status')
    const recUnbound = await readCard(page, `unbound ${key}`, { renderAttempts: w1.attempts, statusApi: sApi1, pageErrors, consoleErrors })
    out.states.unbound = out.states.unbound || {}
    out.states.unbound[key] = recUnbound
    fails.push(...checkRecord(recUnbound, lang, 'unbound'))

    // 点「绑定 Telegram」⇒ 取真 code（**有界重试 ≤2**：首跑实证单击偶发未生效（引信未挂/重渲染），
    //   断言语义不变，仅在卡仍处非 code 态时补一次点击）
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const st0 = await page.evaluate((s) => document.querySelector(s)?.getAttribute('data-sf-tg-state'), CARD)
      if (st0 === 'code') break
      await page.locator(stateSel('tg-bind-action')).first().click().catch(() => {})
      await waitQuiet(page, { quietMs: 350, timeoutMs: 8000 })
      await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('data-sf-tg-state') === 'code', CARD, { timeout: 20000, polling: 150 }).catch(() => {})
      await waitQuiet(page, { quietMs: 350, timeoutMs: 8000 })
    }
    const issuedCode = (await page.locator(stateSel('tg-bind-code')).first().textContent().catch(() => null))?.trim() || null
    const recCode = await readCard(page, `code ${key}`, { issuedCode, pageErrors, consoleErrors })
    out.states.code = out.states.code || {}
    out.states.code[key] = recCode
    fails.push(...checkRecord(recCode, lang, 'code'))

    // 真 webhook 消费 code（消费后才可能落 tg_user_id；**本相唯一 DB 写**）
    const wh = issuedCode ? await webhook(issuedCode) : { status: 0, body: 'NO_CODE' }
    const sApiBoundExpect = await api('/api/telegram/bind/status')

    // 站内确认（一次状态读，无轮询）⇒ 转已绑定态
    await page.locator(stateSel('tg-bind-action')).first().click().catch(() => {})
    let boundBy = 'confirm-click'
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('data-sf-tg-state') === 'bound', CARD, { timeout: 12000, polling: 150 }).catch(() => {})
    let st = await page.evaluate((s) => document.querySelector(s)?.getAttribute('data-sf-tg-state'), CARD)
    if (st !== 'bound') {
      boundBy = 'reload-fallback'
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await waitCard(page)
    }
    const recBound = await readCard(page, `bound ${key}`, {
      renderAttempts: 1, boundBy, webhook: wh, statusApiAfterWebhook: sApiBoundExpect, pageErrors, consoleErrors,
    })
    out.states.bound = out.states.bound || {}
    out.states.bound[key] = recBound
    fails.push(...checkRecord(recBound, lang, 'bound'))

    // 二次确认（内联，不弹窗）：点解绑 ⇒ 出现确认按钮；再点 ⇒ 真解绑（净零）
    const ubBtn = page.locator(stateSel('tg-unbind-action')).first()
    await ubBtn.click().catch(() => {})
    await waitQuiet(page, { quietMs: 300, timeoutMs: 8000 })
    const recConfirm = await readCard(page, `unbindConfirming ${key}`, { pageErrors, consoleErrors })
    out.states.unbindConfirming = out.states.unbindConfirming || {}
    out.states.unbindConfirming[key] = recConfirm
    if (!recConfirm.hooks['tg-unbind-action'].visible) fails.push(`AC4 unbindConfirming ${key}: 二次确认按钮不可见`)

    await page.locator(stateSel('tg-unbind-action')).first().click().catch(() => {})
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('data-sf-tg-state') === 'unbound', CARD, { timeout: 15000, polling: 150 }).catch(() => {})
    const sApiAfter = await api('/api/telegram/bind/status')
    const recAfter = await readCard(page, `unboundAfterUnbind ${key}`, { statusApiAfterUnbind: sApiAfter, pageErrors, consoleErrors })
    out.states.unboundAfterUnbind = out.states.unboundAfterUnbind || {}
    out.states.unboundAfterUnbind[key] = recAfter
    if (sApiAfter.status !== 200 || sApiAfter.json?.data?.tg_linked !== false) {
      fails.push(`AC4 unboundAfterUnbind ${key}【净零】: status API 未回到 tg_linked=false（${JSON.stringify(sApiAfter)}）`)
    }
    if (sApiAfter.keys.includes('tg_user_id')) fails.push(`AC4 unboundAfterUnbind ${key}【判负·隐私】: bind/status 响应含 tg_user_id 键`)
  } catch (e) {
    fails.push(`AC4 ${key}: 走查异常 ${String(e?.message || e)}`)
  } finally {
    await context.close()
  }
}

/** 跨语插值抽查（en@390 · 只到 code 态，不消费 ⇒ 零 DB 写）。 */
async function walkEnCode(browser, out, fails) {
  const { context, page } = await openPage(browser, { width: 390, uID: UID })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)))
  try {
    await page.goto(`${BASE}/en/profile`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitCard(page)
    await page.locator(stateSel('tg-bind-action')).first().click().catch(() => {})
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('data-sf-tg-state') === 'code', CARD, { timeout: 20000, polling: 150 }).catch(() => {})
    await waitQuiet(page, { quietMs: 350, timeoutMs: 8000 })
    const issuedCode = (await page.locator(stateSel('tg-bind-code')).first().textContent().catch(() => null))?.trim() || null
    const rec = await readCard(page, 'code en@390', { issuedCode, pageErrors })
    out.states.code = out.states.code || {}
    out.states.code['en@390'] = rec
    fails.push(...checkRecord(rec, 'en', 'code'))
  } catch (e) {
    fails.push(`AC4 en@390: 走查异常 ${String(e?.message || e)}`)
  } finally {
    await context.close()
  }
}

// ---------------------------------------------------------------- run
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {
  ac: 'AC-4', spec: 'design-system.spec v1.18 §20.2 T102 / §20.5 钩子 / §20.9 AC-4', states: {},
}
out.revision = 'kong-run3-2026-10-12'
out.method = '稳健等待（waitForSelector tg-bind-card + data-sf-tg-state != loading，落 loading/absent ⇒ 有界重载 ≤3）+ DOM quiet 窗；两相：PHASE=a 后端无 TG env（降级），PHASE=b 后端有 dev 假 TG env（未绑定/code/已绑定/解绑）'
out.tgUserIdUsed = PHASE === 'b' ? TG_ID : out.tgUserIdUsed
out.botUsername = PHASE === 'b' ? TG_BOT : out.botUsername
out.widths = [390, 1440]
out.lang = 'zh（另附 en@390 code 插值抽查）'
out.phases = out.phases || {}
out.phases[PHASE] = { ranAt: new Date().toISOString(), backend: BACKEND, tgEnvConfigured: PHASE === 'b' }

const fails = []
const browser = await launch()
try {
  for (const width of [390, 1440]) await walkWidth(browser, width, out, fails)
  if (PHASE === 'b') await walkEnCode(browser, out, fails)
} finally {
  await browser.close()
}

out.phases[PHASE].fails = fails
out.phaseFails = out.phaseFails || {}
out.phaseFails[PHASE] = fails
const allFails = Object.values(out.phaseFails).flat()
out.fails = allFails
out.verdict = allFails.length === 0 ? 'PASS' : 'FAIL'
writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log(JSON.stringify({ phase: PHASE, verdict: out.verdict, fails, states: Object.fromEntries(Object.entries(out.states).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, { state: vv.cardState, status: vv.hooks['tg-bind-status'].text, hooks: Object.fromEntries(HOOKS.map((h) => [h, vv.hooks[h].count > 0 && vv.hooks[h].visible])) }]))])) }, null, 1))
