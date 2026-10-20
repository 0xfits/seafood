/**
 * ★S8 locale 缺键类级守卫（Kong · 本单新增）
 *
 * 目的：把「**被引用的 i18n 键 ⊆ 四语 locale 键集**」写成**可判负断言**，防再犯
 *   （S7 现取到 `jobs.deliverable` 四语皆缺 ⇒ 页面渲染裸键名；类级缺口，点位清单必漏）。
 *
 * 口径（与 `s8_scan.py` 同源，逐字）：
 *   · 源面 = `frontend/src/**`，**排除**任何路径段为 `test` 的文件（不扫测试自身）。
 *   · 「被引用键」三类：
 *       ① 取键调用的**字面首参**：`t('k')` / `t("k")` / `t(`k`)`（无 `${}`）/ `i18n.t('k')` / `translate('k')`；
 *       ② **点号字面量**中首段 ∈ locale 顶层族者（覆盖 `KEY` 映射表值 / 三目字面量 / 常量数组）；
 *       ③ **模板键前缀**（`t(`prefix${var}`)`）—— 无法静态枚举后缀 ⇒ 仅断言「族非空」（四语各有 ≥1 键）。
 *   · 静态可判定（①+②）**必须**四语齐备；③ 单列「族非空」弱断言（不入静态通过面）。
 *
 * 自证（可判负）：`探针` 组的合成源注入一个不存在的键 ⇒ 检测器**必红**（给红点文本）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') // = frontend/src
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

// ---------- locale ----------
const readLocale = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))
const TABLES = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flatten(readLocale(l)))]))
const KEY_SETS = Object.fromEntries(LANGS.map((l) => [l, new Set(Object.keys(TABLES[l]))]))
const TOP = new Set(Object.keys(readLocale('zh')))

// ---------- 源码遍历（排除 test/） ----------
const walk = (dir, out = []) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules') continue
    const fp = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'test') continue
      walk(fp, out)
    } else if (ent.name.endsWith('.js') || ent.name.endsWith('.jsx')) {
      out.push(fp)
    }
  }
  return out
}

// ---------- 注释剔除（保留字符串与换行） ----------
const stripComments = (src) => {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i += 1 }
    } else if (c === '/' && src[i + 1] === '*') {
      out += '  '; i += 2
      while (i + 1 < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i += 1 }
      if (i + 1 < n) { out += '  '; i += 2 }
    } else if (c === "'" || c === '"' || c === '`') {
      const q = c; out += c; i += 1
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
        out += src[i]
        if (src[i] === q) { i += 1; break }
        i += 1
      }
    } else { out += c; i += 1 }
  }
  return out
}

const CALL_RE = /(?<![\w.])(?:i18n\.t|t|translate)\s*\(/g
const DOTTED_RE = /'([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)'|"([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)"/g

/** 从源码文本抽取引用：{ literals:[{key,line}], dotted:[], templates:[prefix] } */
const extractRefs = (rawSrc) => {
  const src = stripComments(rawSrc)
  const literals = []
  const templates = []
  CALL_RE.lastIndex = 0
  let m
  while ((m = CALL_RE.exec(src)) !== null) {
    let p = m.index + m[0].length
    while (p < src.length && /\s/.test(src[p])) p += 1
    const line = src.slice(0, m.index).split('\n').length
    const ch = src[p]
    if (ch === "'" || ch === '"') {
      let j = p + 1; let buf = ''
      while (j < src.length && src[j] !== ch && src[j] !== '\n') { buf += src[j]; j += 1 }
      if (src[j] === ch) literals.push({ key: buf, line })
    } else if (ch === '`') {
      let j = p + 1; let buf = ''; let dyn = false
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') { buf += src[j + 1] ?? ''; j += 2; continue }
        if (src[j] === '$' && src[j + 1] === '{') dyn = true
        buf += src[j]; j += 1
      }
      if (dyn) templates.push(buf.split('${')[0])
      else literals.push({ key: buf, line })
    }
    // 非字面量（变量 / 三目 / 映射查表）⇒ 静态不可判定，交由 ② 点号字面量扫描或弱断言覆盖
  }
  const dotted = []
  DOTTED_RE.lastIndex = 0
  let d
  while ((d = DOTTED_RE.exec(src)) !== null) {
    const key = d[1] || d[2]
    if (TOP.has(key.split('.', 1)[0])) {
      dotted.push({ key, line: src.slice(0, d.index).split('\n').length })
    }
  }
  return { literals, dotted, templates }
}

/** 计算「被引用的静态键 ∉ 四语 locale」清单 */
const computeMissing = (rawSrc) => {
  const { literals, dotted } = extractRefs(rawSrc)
  const refs = new Map() // key -> first line
  for (const { key, line } of [...literals, ...dotted]) if (!refs.has(key)) refs.set(key, line)
  const problems = []
  for (const [key, line] of refs) {
    const miss = LANGS.filter((l) => !KEY_SETS[l].has(key))
    if (miss.length) problems.push(`${key} 缺 [${miss.join(',')}] (L${line})`)
  }
  return problems
}

// ============================================================================
describe('S8① 被引用静态键 ⊆ 四语 locale 键集（可判负）', () => {
  const files = walk(SRC)

  it('源面非空（探针：确认扫到工程文件，含已知面 pages/jobs/JobDetailPage.jsx）', () => {
    expect(files.length).toBeGreaterThan(80)
    const rel = files.map((f) => path.relative(SRC, f))
    expect(rel).toContain('pages/jobs/JobDetailPage.jsx')
    expect(rel.some((r) => r.startsWith('test'))).toBe(false)
  })

  it('逐文件：字面取键 + 点号字面量键 ∈ 四语（en/hk/vn/zh 全含）', () => {
    const violations = []
    for (const fp of files) {
      const problems = computeMissing(fs.readFileSync(fp, 'utf8'))
      for (const p of problems) violations.push(`${path.relative(SRC, fp)}: ${p}`)
    }
    expect(violations).toEqual([])
  })

  it('模板键前缀族非空（四语各有 ≥1 键；弱断言，不枚举后缀）', () => {
    const prefixes = new Set()
    for (const fp of files) {
      for (const pre of extractRefs(fs.readFileSync(fp, 'utf8')).templates) prefixes.add(pre)
    }
    const problems = []
    for (const pre of prefixes) {
      for (const l of LANGS) {
        if (![...KEY_SETS[l]].some((k) => k.startsWith(pre))) problems.push(`'${pre}' 在 ${l} 无任何键`)
      }
    }
    expect(problems).toEqual([])
  })
})

// ============================================================================
describe('S8① 首个缺键 jobs.deliverable 四语齐备', () => {
  it('四语存在、非空、en/vn 零 CJK', () => {
    const problems = []
    for (const l of LANGS) {
      const v = TABLES[l]['jobs.deliverable']
      if (typeof v !== 'string' || !v.trim()) { problems.push(`${l} 空/缺`); continue }
      if ((l === 'en' || l === 'vn') && CJK.test(v)) problems.push(`${l} 残留中文 ${v}`)
    }
    expect(problems).toEqual([])
    expect(TABLES.en['jobs.deliverable']).toBe('Deliverable')
    expect(TABLES.vn['jobs.deliverable']).toBe('Sản phẩm bàn giao')
  })

  // ★ F13 清理（Kong 2026-10-12）：删 11 死键/语（reward 族死键：reward / rewardsList / tasksToClaimReward / chooseReward / confirmChooseReward / successClaimReward / common.loadingRewards / homePage.noRewards / homePage.rewardAlreadyClaimed / homePage.rewardOutOfStock / claimRewardModal.loadProgressFailed）⇒ top 127⇒121 / flat 1053⇒1042 / 四语节点 4212⇒4168；★ 同单 stage3 补 catch-all ⇒ 新增 notFound.{title,description,backHome} 3 键/语 ⇒ **终值 top 122 / flat 1045 / 四语节点 4180**。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
  it('键计数：顶层 128 / 拍平 1070 / 四语节点 4280（v1.5 §14.10 +20 叶/语；S9 +4 ledger.kind 键/语；S23 +1 jobs.participantsHeadcount；S25 B7 退役 10 键）', () => {
    for (const l of LANGS) {
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
      expect(Object.keys(readLocale(l)).length, `${l} top`).toBe(133) // 步 2（prediction 交互 + 四类提交面板，2026-10-20）：+13 叶/语（`campaign.prediction.cta/pickOne/payout` 3 + `campaign.submit.{removeImage,imageMax,snapshotHint,snapshotInvalid,snapshotValid,needLink,linkInvalid,needAddr,needAnswer,chooseOption}` 10）⇒ flat 1223⇒1236 / 四语节点 4892⇒4944（top 133 不变） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(Object.keys(TABLES[l]).length, `${l} flat`).toBe(1239) // **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
    }
    // S25：1050 × 4 = 4200（原 1060 × 4 = 4240）。
    expect(Object.keys(TABLES.zh).length * LANGS.length).toBe(4956) // **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436 // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
  })
})

// ============================================================================
describe('S8② 检测器自证（注入不存在键 ⇒ 必红）', () => {
  it('合成源含 t(\'s8.__injected_missing__\') ⇒ computeMissing 命中', () => {
    const injected = "const a = t('s8.__injected_missing__')\n"
    const problems = computeMissing(injected)
    expect(problems.length).toBe(1)
    expect(problems[0]).toContain('s8.__injected_missing__')
    expect(problems[0]).toContain('缺 [zh,en,hk,vn]')
  })

  it('同一合成源剔除注入键 ⇒ 无命中（判定可逆）', () => {
    expect(computeMissing("const a = t('jobs.deliverable')\n")).toEqual([])
  })
})
