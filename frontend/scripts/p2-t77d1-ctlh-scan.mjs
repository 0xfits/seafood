#!/usr/bin/env node
/**
 * T77（P2）/ D1 · `var(--sf-*-ctl-h)` **消费者全扫**（390 档 ≥44 判据）+ 两档逐元素快照/对照
 *
 * 背景（本单要修的缺陷）：
 *   `listings.css` / `market.css` / `jobs.css` 尾部的 ≤767 覆盖只把 `--sf-*-ctl-h: 44px`
 *   挂在**主列根**（`.sf-listings` / `.sf-mkt` / `.sf-jobs`）上；而侧栏
 *   （`.sf-layout > .sf-layout-side > .sf-listings-panel / .sf-mkt-panel`）**不在该子树内**
 *   ⇒ 侧栏里的 `min-height: var(--sf-*-ctl-h)` 取空值 ⇒ 回退 `auto`（渲染 37.5px）。
 *
 * 检测口径（**动态**，不依赖类名清单 —— 不只看被点名的控件）：
 *   在页面里预先插一个空的 <style id="__probe">，抓全部元素的引用（window.__els，索引稳定）；
 *   逐个把 `--sf-l-ctl-h` / `--sf-k-ctl-h` / `--sf-j-ctl-h` 用 `*{ V: 111px !important }` 灌成哨兵值，
 *   再读每个元素的 computed `min-height` / `height`：**值随之变化的元素 = 该变量的消费者**
 *   （`!important` 覆盖「元素自身的 34px 声明」与「继承值」，故两类来源都能命中）。
 *   消费者一律按其**真实档位**（未灌哨兵时）的 getBoundingClientRect 判 ≥44。
 *
 * 用法：
 *   node scripts/p2-t77d1-ctlh-scan.mjs <tag> [baseURL]        # 采一轮（tag = before / after …）
 *   node scripts/p2-t77d1-ctlh-scan.mjs compare <tagA> <tagB>  # 两轮对照（逐元素几何/字号 + 消费者逐元素改前→改后）
 *   「改前」两轮的取法（真实渲染，非模拟）：`git restore --source=<commit> --worktree -- <文件>` 后采一轮，再恢复
 * 输出：$P2_T77D1_OUT（默认 <scratch>/p2-t77d1）下的 <tag>.json；stdout 给出逐元素读数。
 * 退出码：0 = 全 PASS；1 = 有 FAIL（390 档消费者渲染 <44）；2 = 运行异常。
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ARGV = process.argv.slice(2)
const MODE = ['compare', 'attrib'].includes(ARGV[0]) ? ARGV[0] : 'scan'
const TAG = MODE === 'scan' ? (ARGV[0] || 'run') : MODE
const BASE = (MODE === 'compare' || MODE === 'attrib' ? ARGV[3] : ARGV[1]) || 'http://localhost:5787'
const OUT = process.env.P2_T77D1_OUT || path.join(os.homedir(), '.hermes/profiles/zang/cache/scratch/p2-t77d1')
fs.mkdirSync(OUT, { recursive: true })
const SRC_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src')

const PAGES = ['/listing', '/exchange', '/task/new', '/task/1'] // 前 3 个 = 本单必扫；/task/1（详情页侧栏另有 .sf-jobs-status 消费者）为同根因加固面
const WIDTHS = [390, 1440]
const VARS = ['--sf-l-ctl-h', '--sf-k-ctl-h', '--sf-j-ctl-h']
const SENTINEL = 111 // 哨兵高（≠34/≠44 ⇒ 任何真实变化都可见）
// Zang 裁定：T79 最小字号是全站规则，以下元素在 1440 档允许「字号提升」例外（其余必须逐值相等）
const ALLOWED_1440 = [
  { path: '/listing', cls: 'sf-listings-price-unit' },
  { path: '/listing', cls: 'sf-listings-tag' },
  { path: '/task/new', cls: 'sf-jobs-tag' },
  { path: '/task/*', cls: 'sf-jobs-tag' }, // /task/:id（详情页同一 micro 类）
]

const resolveExecutable = () => {
  if (process.env.P2_T77D1_CHROME) return process.env.P2_T77D1_CHROME
  const roots = [path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright')]
  const cands = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const d of fs.readdirSync(root)) {
      for (const rel of [['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'], ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'], ['chrome-linux', 'chrome-headless-shell']]) {
        const p = path.join(root, d, rel[0], rel[1])
        if (fs.existsSync(p)) cands.push(p)
      }
    }
  }
  return cands.sort().pop()
}

/* ---------------- page-side --helpers- ---------------- */
const H_CREATE_PROBE = () => {
  if (!document.getElementById('__probe')) {
    const s = document.createElement('style')
    s.id = '__probe'
    document.head.appendChild(s)
  }
  window.__els = Array.from(document.querySelectorAll('*'))
  return window.__els.length
}
const H_METRICS = () => window.__els.map((el) => {
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  return { mh: cs.minHeight, ch: cs.height, fs: cs.fontSize, w: +r.width.toFixed(2), h: +r.height.toFixed(2), x: +r.x.toFixed(2), y: +r.y.toFixed(2) }
})
const H_CONTEXT = () => window.__els.map((el) => ({
  inLayout: !!el.closest('.sf-layout'),
  inMain: !!el.closest('.sf-layout-main'),
  inSide: !!el.closest('.sf-layout-side'),
}))
const H_SNAPSHOT = () => {
  const counts = new Map()
  const items = []
  for (const el of document.querySelectorAll('*')) {
    const cls = (el.getAttribute('class') || '').trim()
    const base = el.tagName.toLowerCase() + (cls ? '.' + cls.split(/\s+/).join('.') : '')
    const n = (counts.get(base) || 0) + 1
    counts.set(base, n)
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    items.push({
      k: `${base}#${n}`, tag: el.tagName, cls,
      x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      fs: cs.fontSize, mh: cs.minHeight, ch: cs.height, d: cs.display, vis: cs.visibility,
    })
  }
  return { url: location.pathname, innerWidth: window.innerWidth, count: items.length, items }
}

const setProbe = (page, css) => page.evaluate((c) => { document.getElementById('__probe').textContent = c }, css)

/** 一轮采集：对每个 width × page 抓快照 + 消费者检测 */
const collect = async (page, width, out) => {
  for (const p of PAGES) {
    const rec = { page: p, width, consumers: [], snapshot: null, error: null }
    try {
      await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(2600)
      if ((await page.evaluate(() => window.innerWidth)) !== width) {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2400)
      }
      rec.innerWidth = await page.evaluate(() => window.innerWidth)
      rec.finalUrl = await page.evaluate(() => location.pathname)

      // ★ 顺序：先插空的 #__probe 并抓引用（window.__els），再抓快照 —— 两次 querySelectorAll('*')
      //   枚举顺序/长度完全一致（其间零 DOM 变动）⇒ items[i] 与 __els[i] 严格同元素。
      rec.nodes = await page.evaluate(H_CREATE_PROBE)
      rec.snapshot = await page.evaluate(H_SNAPSHOT)
      const ctx = await page.evaluate(H_CONTEXT)
      const base = await page.evaluate(H_METRICS)
      const hits = new Map() // index -> [{v, ...}]
      for (const v of VARS) {
        await setProbe(page, `*{${v}:${SENTINEL}px !important}`)
        const now = await page.evaluate(H_METRICS)
        await setProbe(page, '')
        for (let i = 0; i < base.length; i += 1) {
          // 判据只用 **computed min-height 变化**：min-height 的计算值不受布局影响（`auto` 恒为 `auto`），
          // 只有该元素**自身**声明了 `min-height: var(V)` 才会变。用 height 变化判会把「后代变高 ⇒ 祖先变高」
          // 的布局级联误判为消费者（已实测到该假阳性），故不用。
          if (now[i].mh !== base[i].mh) {
            if (!hits.has(i)) hits.set(i, [])
            hits.get(i).push({ v, mh: `${base[i].mh}→${now[i].mh}` })
          }
        }
      }
      rec.consumers = [...hits.entries()].map(([i, vars]) => {
        const el = base[i]
        const it = rec.snapshot.items[i] || {}
        if (it.tag === 'STYLE') rec.probeSelf = true
        return {
          tag: it.tag || '', cls: it.cls || '', vars, inLayout: ctx[i].inLayout, inMain: ctx[i].inMain, inSide: ctx[i].inSide,
          w: el.w, h: el.h, mh: el.mh, ch: el.ch, fs: el.fs,
          rendered: el.w > 0 && el.h > 0,
          geo: `${el.w}×${el.h}`,
        }
      })
    } catch (e) {
      rec.error = String((e && e.message) || e)
    }
    out.push(rec)
  }
}

/* ---------------- 静态完备性护栏 ---------------- */
/** 动态检测只认 `min-height` 变化 ⇒ 必须先证明全仓没有 `height: var(--sf-*-ctl-h)` 这种消费者
 *  （否则会出现「检测不到的高度消费者」）。返回命中清单（必须为空）。 */
const staticGuard = () => {
  const hits = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (!['node_modules', 'test', '__mocks__'].includes(e.name)) walk(p); continue }
      if (!/\.(css|jsx|js)$/.test(e.name)) continue
      const txt = fs.readFileSync(p, 'utf8')
      for (const m of txt.matchAll(/[^-]height:\s*var\((--sf-[lkj]-ctl-h)\)/g)) hits.push(`${path.relative(SRC_ROOT, p)}: height: var(${m[1]})`)
    }
  }
  walk(SRC_ROOT)
  return hits
}

/* ---------------- 主流程 ---------------- */
const main = async () => {
  if (MODE === 'compare') return compareMode()
  if (MODE === 'attrib') return attribMode()

  const guard = staticGuard()
  console.log(`静态完备性护栏 · src/ 内 \`height: var(--sf-*-ctl-h)\` 消费者数 = ${guard.length}（必须 = 0，否则 min-height 判据不完整）${guard.length ? '\n  ⚠ ' + guard.join('\n  ⚠ ') : ''}`)

  const exe = resolveExecutable()
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const out = []
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await collect(page, width, out)
    await ctx.close()
  }
  await browser.close()

  const file = path.join(OUT, `${TAG}.json`)
  fs.writeFileSync(file, JSON.stringify({ tag: TAG, base: BASE, at: new Date().toISOString(), runs: out }, null, 2))

  let fails = 0
  if (guard.length) { console.log('FAIL · 静态完备性护栏：存在 height 消费者，min-height 判据不完整'); fails += guard.length }
  for (const width of WIDTHS) {
    console.log(`\n===== ${TAG} · ${width} 档 =====`)
    for (const rec of out.filter((r) => r.width === width)) {
      if (rec.error) { console.log(`${rec.page} [ERROR] ${rec.error}`); fails += 1; continue }
      const cons = rec.consumers.filter((c) => c.rendered)
      const bad = cons.filter((c) => c.h < 44)
      const hidden = rec.consumers.filter((c) => !c.rendered)
      console.log(`-- ${rec.page} (final=${rec.finalUrl} innerWidth=${rec.innerWidth} nodes=${rec.nodes}) 消费者 ${cons.length} 个（渲染）/ 未渲染 ${hidden.length} 个：`)
      for (const c of cons) {
        const mark = c.h >= 44 ? 'OK ' : (width === 390 ? 'BAD' : 'D34')
        console.log(`   [${mark}] var=${c.vars.map((x) => x.v).join('+')} side=${c.inSide ? 'Y' : 'n'} main=${c.inMain ? 'Y' : 'n'} ${c.geo} min-height=${c.mh} → ${c.cls}`)
      }
      for (const c of hidden) console.log(`   [-- ] 未渲染（0×0）var=${c.vars.map((x) => x.v).join('+')} ${c.geo} → ${c.cls}`)
      if (width === 390) {
        console.log(`   ⇒ 390 判据：消费者渲染 <44 的元素数 = ${bad.length}（必须 = 0）`)
        fails += bad.length
      } else {
        console.log(`   ⇒ 1440 档：D34 = 桌面 A 口径 34px（T77 只作用于 ≤767，故此处不判 ≥44）；消费者渲染 <44 的元素数 = ${bad.length}（预期 = 该档全部消费者）`)
      }
    }
  }
  console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} · tag=${TAG} · 快照 → ${file}`)
  process.exit(fails === 0 ? 0 : 1)
}

const load = (tag) => {
  const f = path.join(OUT, `${tag}.json`)
  if (!fs.existsSync(f)) throw new Error(`缺快照 ${f}`)
  return JSON.parse(fs.readFileSync(f, 'utf8'))
}

const compareMode = async () => {
  const a = load(ARGV[1])
  const b = load(ARGV[2])
  let fails = 0
  for (const ra of a.runs) {
    const rb = b.runs.find((r) => r.width === ra.width && r.page === ra.page)
    if (!rb) { console.log(`[MISSING] ${a.tag} ${ra.width} ${ra.page}`); fails += 1; continue }
    console.log(`\n===== ${ra.width} 档 ${ra.page} · ${a.tag} → ${b.tag} =====`)
    // ① 消费者读数对拍（**按 DOM 顺序逐位配对**：两轮同一页面、同一元素集，
    //    用 (tag|cls|var) 当键会在「同类元素多处出现」时错配 —— 例如侧栏 78×44 的 .sf-mkt-btn 与
    //    主列 52×44 的 .sf-mkt-btn 同类。故按采集顺序（= querySelectorAll('*') 顺序）配对。）
    const key = (c) => `${c.tag}|${c.cls}|${c.vars.map((x) => x.v).join('+')}`
    const sameLen = ra.consumers.length === rb.consumers.length
    if (!sameLen) console.log(`   ⚠ 消费者数不等（${ra.consumers.length} vs ${rb.consumers.length}）⇒ 降级为键匹配`)
    for (let i = 0; i < ra.consumers.length; i += 1) {
      const ca = ra.consumers[i]
      const cb = sameLen ? rb.consumers[i] : rb.consumers.find((c) => key(c) === key(ca))
      if (!cb) { console.log(`   [消失] ${ca.geo} ${ca.cls}`); continue }
      const mark = ca.h !== cb.h || ca.mh !== cb.mh ? 'CHANGED' : 'same   '
      console.log(`   ${mark} var=${ca.vars.map((x) => x.v).join('+')} side=${ca.inSide ? 'Y' : 'n'} 改前 ${ca.w}×${ca.h} min-height=${ca.mh} → 改后 ${cb.w}×${cb.h} min-height=${cb.mh} → ${ca.cls}${cb.rendered && cb.h < 44 ? '  ← 仍 <44' : ''}`)
      if (ra.width === 390 && cb.rendered && cb.h < 44) fails += 1
    }
    if (!sameLen) for (const cb of rb.consumers) if (!ra.consumers.find((c) => key(c) === key(cb))) console.log(`   [仅改后有] ${cb.geo} ${cb.cls}`)
    // ② 全元素几何对拍
    const itemsB = new Map(rb.snapshot.items.map((i) => [i.k, i]))
    const diffs = []
    for (const ia of ra.snapshot.items) {
      const ib = itemsB.get(ia.k)
      if (!ib) continue
      const geoA = `${ia.x},${ia.y},${ia.w},${ia.h}`, geoB = `${ib.x},${ib.y},${ib.w},${ib.h}`
      if (geoA !== geoB || ia.fs !== ib.fs) diffs.push({ k: ia.k, cls: ia.cls, geoA, geoB, fsA: ia.fs, fsB: ib.fs })
    }
    const extraB = rb.snapshot.items.length - ra.snapshot.items.length
    console.log(`   全元素几何/字号对拍：元素数 ${ra.snapshot.items.length} → ${rb.snapshot.items.length}（净增 ${extraB}）· 有差异元素 ${diffs.length} 个`)
    for (const d of diffs.slice(0, 60)) {
      const allowed = ra.width !== 390 && ALLOWED_1440.some((a2) => (a2.path === ra.page || (a2.path === '/task/*' && ra.page.startsWith('/task/'))) && d.cls.split(/\s+/).includes(a2.cls))
      console.log(`     ${ra.width === 1440 ? (allowed ? '[例外(允许)]' : '[★不相等]') : '[diff]'} ${d.k} rect ${d.geoA} → ${d.geoB} fs ${d.fsA} → ${d.fsB}`)
      if (ra.width === 1440 && !allowed) fails += 1
    }
    if (diffs.length > 60) console.log(`     …（另有 ${diffs.length - 60} 个，见 JSON）`)
  }
  console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} · compare ${ARGV[1]} → ${ARGV[2]}`)
  process.exit(fails === 0 ? 0 : 1)
}

/** T79 归因（1440 档）：把 T79 的 4 处字号提升**只在测量期回退**（不改文件），验明
 *  「与 P2 前基线（fe01a58）不相等」的元素集是否**恰好等于**「T79 字号所动到的元素集」。
 *  集合相等 ⇒ 1440 档不存在 T79 之外的第二条原因（没有第二个变更在动桌面几何）。
 *  用法：node scripts/p2-t77d1-ctlh-scan.mjs attrib <基线tag> <改后tag>   （默认 fe01a58 after）
 *  退出码：0 = 集合相等（或差集只含未渲染的纯字号差异）；1 = 有无法归因的元素（须人工看）。 */
const T79_REVERT = [
  ':root{--sf-st-tab-font-size:10.5px}',
  '.sf-tab,.sf-tab-ic{font-size:10.5px}',
  '.sf-listings-price-unit{font-size:11px}',
  '.sf-listings-tag{font-size:11px}',
  '.sf-jobs-tag{font-size:11px}',
].join('')
const norm = (o) => JSON.stringify([o.k, o.rect, o.fs])
const attribMode = async () => {
  const tagBase = ARGV[1] || 'fe01a58'
  const tagAfter = ARGV[2] || 'after'
  const base = load(tagBase), aft = load(tagAfter)
  const exe = resolveExecutable()
  const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const live = []
  for (const p of PAGES) {
    const rec = { page: p, error: null, set: [] }
    try {
      await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(2600)
      await page.evaluate(H_CREATE_PROBE)
      const cur = await page.evaluate(H_METRICS)
      const snap = await page.evaluate(H_SNAPSHOT)
      await setProbe(page, T79_REVERT)
      const rev = await page.evaluate(H_METRICS)
      await setProbe(page, '')
      for (let i = 0; i < cur.length; i += 1) {
        const A = cur[i], B = rev[i], it = snap.items[i] || {}
        if (A.w !== B.w || A.h !== B.h || A.x !== B.x || A.y !== B.y || A.fs !== B.fs) {
          rec.set.push({ k: it.k, tag: it.tag, cls: it.cls, curRect: `${A.w}×${A.h}@${A.x},${A.y}`, curFs: A.fs, revRect: `${B.w}×${B.h}@${B.x},${B.y}`, revFs: B.fs })
        }
      }
    } catch (e) { rec.error = String((e && e.message) || e) }
    live.push(rec)
  }
  await browser.close()

  console.log(`===== 1440 档 T79 归因：基线 ${tagBase} → ${tagAfter} 的不相等集 vs 回退 T79 字号后的变化集 =====`)
  let unexplained = 0
  for (const r of live) {
    const ra = base.runs.find((x) => x.width === 1440 && x.page === r.page)
    const rb = aft.runs.find((x) => x.width === 1440 && x.page === r.page)
    const baselineSet = []
    const itemsB = new Map(rb.snapshot.items.map((i) => [i.k, i]))
    for (const ia of ra.snapshot.items) {
      const ib = itemsB.get(ia.k)
      if (!ib) continue
      if (`${ia.x},${ia.y},${ia.w},${ia.h}` !== `${ib.x},${ib.y},${ib.w},${ib.h}` || ia.fs !== ib.fs) {
        baselineSet.push({ k: ia.k, tag: ia.tag, cls: ia.cls, baseRect: `${ia.w}×${ia.h}@${ia.x},${ia.y}`, baseFs: ia.fs, curRect: `${ib.w}×${ib.h}@${ib.x},${ib.y}`, curFs: ib.fs })
      }
    }
    // 逐元素身份（k = tag.class#n，两轮同一 DOM ⇒ 可跨轮比对）比集合，不比 rect（rect 含各自态的级联位移）
    const keysBase = new Set(baselineSet.map((x) => x.k))
    const keysLive = new Set(r.set.map((x) => x.k))
    const onlyBase = baselineSet.filter((x) => !keysLive.has(x.k))
    const onlyLive = r.set.filter((x) => !keysBase.has(x.k))
    console.log(`-- ${r.page}：基线不相等 ${baselineSet.length} 个 · 回退 T79 后变化 ${r.set.length} 个 · 仅基线有 ${onlyBase.length} · 仅归因实验有 ${onlyLive.length}`)
    for (const o of onlyBase) {
      const zero = /^0×0@/.test(o.baseRect)
      console.log(`   ${zero ? '[纯字号(未渲染)]' : '[★无法归因]'} ${o.k} rect ${o.baseRect}→${o.curRect} fs ${o.baseFs}→${o.curFs}`)
      if (!zero) unexplained += 1
    }
    for (const o of onlyLive) console.log(`   [仅归因实验有] ${o.k} rect ${o.curRect}→${o.revRect} fs ${o.curFs}→${o.revFs}`)
    // 附：本次归因实验中「字号确实变了」的元素（= T79 直接作用面，非级联）
    const fsChanged = r.set.filter((x) => x.curFs !== x.revFs)
    console.log(`   其中字号本身改变者（T79 直接作用面）${fsChanged.length} 个：${[...new Set(fsChanged.map((x) => `${x.cls || x.tag} ${x.curFs}→${x.revFs}`))].join(' | ')}`)
  }
  console.log(`\n${unexplained === 0 ? 'PASS' : `FAIL(${unexplained})`} · 1440 档 T79 之外的不可归因元素数 = ${unexplained}`)
  process.exit(unexplained === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL', e && e.stack ? e.stack : e); process.exitCode = 2 })
