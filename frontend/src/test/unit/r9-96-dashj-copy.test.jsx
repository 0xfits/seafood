/**
 * R-9-96 单测（本单新增）· 平台积分单位 `dashJ` **用户可见文案漏网三处**收口
 *
 * 背景：R-9-93 只改了 `DashJ` 组件 6 处使用点 + `common.communityPoints`；
 *       生产终验扫 bundle 后仍见 3 处用户可见 `dashJ` 文案 ⇒ 本单补齐。
 *
 * 断言（逐条对应本单必做项）：
 *   ① `rewardCard.insufficient` 四语值 ⇒ 积分不足 / 積分不足 / Not enough points / Không đủ điểm
 *      （★ 注：brief 写作 `reward.insufficient`，实测键路径为 **`rewardCard.insufficient`**（locales 第 420 行，
 *       由 `components/reward/RewardCard.jsx:157` 消费）；按「只改值、不改键名」处置。）
 *   ② `uiCommon.dashJPoints` 四语值 ⇒ 积分 / 積分 / Points / Điểm（★ **键名 `dashJPoints` 不改**）
 *   ③ `pages/theme-preview-demo.js` 的 `SEARCH_DEMO`：「兑换 dashJ」⇒「兑换 积分」
 *   ④ 双口径扫面：locale 值面 + 产品源面（components/** + pages/** + shell/**）`dashJ` **用户可见类 = 0**
 *   ⑤ 计数（S5① 后：top 119 / flat 1044 / 四语节点 4176）
 *
 * ★ 残留登记（本单**禁改面**内，勿动）：`pages/ThemePreviewPage.jsx:175` 的 `DASHJ / $`
 *   （全大写、与 `SEAFOOD / $` 成对的行情 ticker 演示值）。敏感口径（`dashJ` 小写单位名）不命中；
 *   其所在页由 `pages/theme-preview-demo.js` 头注释判定为 ②-c「演示数据·非发布面文案」。
 *   该行不在本单允许改面内 ⇒ 仅登记，未改，交父单裁决是否另开单。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const TABLES = { zh, en, hk, vn }
const CJK = /[\u3400-\u9fff]/
const DASHJ_I = /dashj/i

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]
))

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p)
  }
  return out
}

describe('① rewardCard.insufficient 四语新值 + 四语互异 + en/vn 无 CJK', () => {
  it('逐键读数', () => {
    expect(zh.rewardCard.insufficient).toBe('积分不足')
    expect(hk.rewardCard.insufficient).toBe('積分不足')
    expect(en.rewardCard.insufficient).toBe('Not enough points')
    expect(vn.rewardCard.insufficient).toBe('Không đủ điểm')
    expect(CJK.test(en.rewardCard.insufficient)).toBe(false)
    expect(CJK.test(vn.rewardCard.insufficient)).toBe(false)
    const set = new Set(LANGS.map((l) => TABLES[l].rewardCard.insufficient))
    expect(set.size, '四语值须互异').toBe(4)
  })
})

describe('② uiCommon.dashJPoints 四语新值（★ 键名 `dashJPoints` 不改）', () => {
  it('逐键读数 + 键名在场 + 四语互异 + en/vn 无 CJK', () => {
    for (const l of LANGS) {
      expect(Object.prototype.hasOwnProperty.call(TABLES[l].uiCommon, 'dashJPoints'),
        `${l}.uiCommon.dashJPoints 键名不得改名`).toBe(true)
    }
    expect(zh.uiCommon.dashJPoints).toBe('积分')
    expect(hk.uiCommon.dashJPoints).toBe('積分')
    expect(en.uiCommon.dashJPoints).toBe('Points')
    expect(vn.uiCommon.dashJPoints).toBe('Điểm')
    expect(CJK.test(en.uiCommon.dashJPoints)).toBe(false)
    expect(CJK.test(vn.uiCommon.dashJPoints)).toBe(false)
    const set = new Set(LANGS.map((l) => TABLES[l].uiCommon.dashJPoints))
    expect(set.size, '四语值须互异').toBe(4)
  })

  it('消费点仍在场：components/ui/DashJ.jsx 仍取 `uiCommon.dashJPoints`', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/ui/DashJ.jsx'), 'utf8')
    expect(src).toContain("t('uiCommon.dashJPoints')")
  })
})

describe('③ SEARCH_DEMO：`dashJ` 清零，改「兑换 积分」', () => {
  it('theme-preview-demo.js 的 SEARCH_DEMO 无 dashJ、含「兑换 积分」', () => {
    const src = fs.readFileSync(path.join(SRC, 'pages/theme-preview-demo.js'), 'utf8')
    expect(DASHJ_I.test(src), 'theme-preview-demo.js 不得再出现 dashJ/dashj').toBe(false)
    expect(src).toContain('兑换 积分')
    expect(src).toContain('四语切换与主题切换都不改这一行的高度')
  })
})

describe('④ 双口径扫面：用户可见 `dashJ` 文案 = 0', () => {
  it('locale 值面：四语全库**任一字符串值**均不含 `dashj`（不敏感）', () => {
    const bad = []
    for (const l of LANGS) {
      const scan = (o, p = '') => {
        if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => scan(v, `${p}${k}.`))
        else if (typeof o === 'string' && DASHJ_I.test(o)) bad.push(`${l}:${p}=${JSON.stringify(o)}`)
      }
      scan(TABLES[l])
    }
    expect(bad, `locale 值面残留 dashJ：${bad.join(' | ')}`).toEqual([])
  })

  it('产品源面（components/** + pages/** + shell/**）：case-sensitive `dashJ` 零命中（仅白名单保留）', () => {
    const ALLOWED = new Set(['components/ui/DashJ.jsx', 'components/ui/index.js'])
    const files = ['components', 'pages', 'shell']
      .flatMap((d) => (fs.existsSync(path.join(SRC, d)) ? walk(path.join(SRC, d)) : []))
    const hits = files.map((f) => path.relative(SRC, f))
      .filter((rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').includes('dashJ'))
    expect(hits.filter((rel) => !ALLOWED.has(rel)), '产品源面不应用户可见 `dashJ`').toEqual([])
    expect(hits).toContain('components/ui/DashJ.jsx')
    expect(hits).toContain('components/ui/index.js')
  })
})

describe('⑤ 计数（S23：top 119 / flat 1060 / 四语节点 4240）', () => {
  it('四语 top / flat / 合计', () => {
    let nodes = 0
    for (const l of LANGS) {
      expect(Object.keys(TABLES[l]).length, `${l} top`).toBe(119)
      const f = flat(TABLES[l]).length
      // **期望订正（S9 ledger.kind 缺键补齐）**：S8 +1 jobs.deliverable ⇒ 1055；S9 +4 ledger.kind 键/语 ⇒ 拍平 1055⇒1059（前订正 S7：1044⇒1054）
      expect(f, `${l} flat`).toBe(1060)
      nodes += f
    }
    // **期望订正（S9）**：1059 × 4 = 4236（S8：1055 × 4 = 4220；原 1054 × 4 = 4216）
    expect(nodes, '四语节点合计').toBe(4240)
  })
})
