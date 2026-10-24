/**
 * ★货币文案顺序 + 排版守卫（Kevin 2026-10-24 定稿 · design §40 `T139-a`）
 *
 * 一条口径、无例外：**顺序恒为「单位 + 数量」，且单位与数量之间一律无空格连写**。
 *   · 单位 = 币种符号 / 币种代码 / `J` 价单位 / `⚡️` batt 单位 / 积分名；
 *   · 数量 = `{{amount}} {{price}} {{balance}} {{bonus}} {{batt}} {{total}}`；
 *   · 目标渲染：`已领到 ⚡️30 与 ₿20`、`＋₿20`、`增加 $100`、`锁定为 J12`。
 *   · 反例（本单修掉的坏形）：`{{amount}} {{symbol}}`（渲染 `20 BTTC`）、`{{price}} J`、`{{amount}} 积分`、
 *     `{{symbol}} {{amount}}`（符号 + 空格 + 数量）、`⚡️ {{batt}}`（emoji 后多一个空格）。
 *   · **非货币量不受此约束**：`{{hours}} 小时` / `{{n}} 项` / `{{visible}} 条` 仍是「数量 + 量词」，保留原空格。
 *
 * 本测试四道：
 *   ① 全量遍历四语：命中任一货币坏形即失败（报错带 lang / key / 完整值 / 命中形）；
 *   ② 排版专项：符号/emoji 与数量零空白连写；非货币量词仍保留空格（防过度整改）；
 *   ③ 反向锁定已改的 9 个键 × 4 语逐字等于预期值，防回退；
 *   ④ 检测器自证：正向注入必红、正例不得误判（防守卫空转）。
 *
 * 白名单（`WHITELIST`）：仅豁免**非货币**的「数量 + 量词」，每条必须写明理由，且自检三条：
 *   键在四语都存在 / 理由非空 / 该键确实仍命中非货币计数形（防僵死）。货币坏形恒不可豁免。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LOCALES = path.resolve(HERE, '../../locales')
const LANGS = ['zh', 'en', 'hk', 'vn']

const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf8'))

/** 拍平成 `dot.path -> string`（叶子仅字符串；数组不参与本口径）。 */
const flatten = (node, prefix = '', out = {}) => {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  } else if (typeof node === 'string') {
    out[prefix] = node
  }
  return out
}

const TABLES = Object.fromEntries(LANGS.map((l) => [l, flatten(readLocale(l))]))

// ---------- 坏形清单（顺序即优先级） ----------
const MONEY_QTY = 'amount|price|balance|bonus|batt|total'
const EMOJI = '\u26A1\uFE0F?'

const BAD_PATTERNS = [
  // ⓐ 数量在前、单位占位符在后：`{{amount}} {{symbol}}` / `{{amount}} ${{symbol}}`
  { id: 'qty-then-symbol', re: new RegExp(`\\{\\{(?:${MONEY_QTY})\\}\\}\\s*\\{?\\{?symbol\\}?\\}?`, 'i') },
  // ⓑ 单位占位符与数量之间**有空白**：`{{symbol}} {{amount}}`
  { id: 'symbol-space-qty', re: new RegExp(`\\{\\{symbol\\}\\}\\s+\\{\\{(?:${MONEY_QTY})\\}\\}`, 'i') },
  // ⓒ 字面符号 / 字母单位与数量之间有空白：`$ {{amount}}` / `J {{price}}` / `₿ {{amount}}` / `BTTC {{amount}}`
  { id: 'literal-symbol-space-qty', re: new RegExp(`(?:\\$|₿|J|USD|USDT|BTTC|BTC|ETH|CNY|HKD|VND)\\s+\\{\\{(?:${MONEY_QTY})\\}\\}`, 'i') },
  // ⓓ emoji 单位 `⚡️` 后有空白：`⚡️ {{batt}}`
  { id: 'emoji-space-qty', re: new RegExp(`${EMOJI}\\s+\\{\\{batt\\}\\}`) },
  // ⓔ 数量在前、`J` 在后：`{{price}} J`
  { id: 'qty-then-J', re: new RegExp(`\\{\\{(?:${MONEY_QTY})\\}\\}\\s*J\\b`) },
  // ⓕ 数量在前、积分名在后（简体 / 繁体）
  { id: 'qty-then-points-cn', re: /\{\{(?:amount|balance|total)\}\}\s*(?:积分|積分)/ },
  // ⓖ 数量在前、积分名在后（en / vn）
  { id: 'qty-then-points-latin', re: /\{\{(?:amount|balance|total)\}\}\s*(?:points|point|điểm|diem)/i },
  // ⓗ 数量在前、符号 / 币种代码在后：`{{amount}} ₿` / `{{amount}} $` / `{{amount}} BTTC`
  {
    id: 'qty-then-ticker',
    re: new RegExp(`\\{\\{(?:${MONEY_QTY})\\}\\}\\s*(?:\\$|₿|USD\\b|USDT\\b|BTTC\\b|BTC\\b|ETH\\b|CNY\\b|HKD\\b|VND\\b)`, 'i'),
  },
]

// ---------- 非货币「数量 + 量词」（白名单机制的适用面，非本口径整改对象） ----------
const NON_CURRENCY_COUNT = [
  /\{\{(?:hours|n|count|visible|matched|hired|total|x|days)\}\}\s*(?:小时|小時|项|項|条|條|次|天|h|hours?|items?|giờ|mục|lần)/i,
]

/** 白名单：显式豁免的**非货币**计数串。key ⇒ 理由（必须一句话说清「为什么不是货币」）。 */
const WHITELIST = {
  'wage.wageLine': '{{hours}} 是工资间隔小时数（时间量 + 时间量词「小时」），非货币单位',
  'campaign.claim.allOk': '{{n}} 是领取笔数（`项` 为条目量词），同串的货币 `${{amount}}` 已是单位在前',
  'dashPage.queueSummary': '{{visible}}/{{matched}}/{{total}} 是待审列表条数（`条` 为条目量词），非货币',
}

const moneyHits = () => {
  const hits = []
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(TABLES[lang])) {
      for (const p of BAD_PATTERNS) {
        const m = value.match(p.re)
        if (m) hits.push({ lang, key, value, pattern: p.id, matched: m[0] })
      }
    }
  }
  return hits
}

const countHits = (key) => NON_CURRENCY_COUNT.some((re) => re.test(TABLES.zh[key] || ''))

describe('T139-a 货币文案：单位在前、数量在后、单位与数量连写无空格', () => {
  it('四语全量：无「数量+单位」坏形，也无「单位+空格+数量」坏形', () => {
    const hits = moneyHits()
    const detail = hits
      .map((h) => `[${h.lang}] ${h.key} 命中「${h.pattern}」(${h.matched})\n     值：${h.value}`)
      .join('\n')
    expect(hits, `发现 ${hits.length} 处货币排版违规：\n${detail}`).toEqual([])
  })

  it('检测器自证：正向注入必被检出（8 类坏形），正例不得误判', () => {
    const samples = [
      ['已领到 {{batt}} 与 {{amount}} {{symbol}}', 'qty-then-symbol'],
      ['已领到 ⚡️{{batt}} 与 {{symbol}} {{amount}}', 'symbol-space-qty'],
      ['成功为用户 #{{id}} 增加 $ {{amount}}', 'literal-symbol-space-qty'],
      ['已领到 ⚡️ {{batt}}', 'emoji-space-qty'],
      ['锁定价 {{price}} J', 'qty-then-J'],
      ['增加 {{amount}} 积分', 'qty-then-points-cn'],
      ['Added {{amount}} points', 'qty-then-points-latin'],
      ['到账 {{amount}} ₿', 'qty-then-ticker'],
      ['到账 {{amount}} BTTC', 'qty-then-ticker'],
    ]
    for (const [text, expected] of samples) {
      const hit = BAD_PATTERNS.find((p) => p.re.test(text))
      expect(hit && hit.id, `注入串未被检出：${text}`).toBe(expected)
    }
    // 正例（单位在前 + 连写）：一条都不许命中
    const good = [
      '已领到 ⚡️{{batt}} 与 {{symbol}}{{amount}}',
      '已领到 ⚡️30 与 ₿20',
      '成功为用户 #{{id}} 增加 ${{amount}}',
      '成功为用户 #7 增加 $100',
      '锁定为 J{{price}}',
      '每 {{hours}} 小时 + ⚡️{{batt}}',
      'Claimed ${{amount}}',
    ]
    for (const text of good) {
      expect(BAD_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id), `正例被误判：${text}`).toEqual([])
    }
  })

  it('排版专项：货币单位与数量零空白；非货币量词仍保留空格（防过度整改）', () => {
    const tightSymbol = /\{\{symbol\}\}\{\{(?:amount|price|balance|bonus|batt|total)\}\}/
    const anySymbolWithQty = new RegExp(`\\{\\{symbol\\}\\}\\s*\\{\\{(?:${MONEY_QTY})\\}\\}`)
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(TABLES[lang])) {
        if (anySymbolWithQty.test(value)) {
          expect(tightSymbol.test(value), `[${lang}] ${key} 符号与数量之间有多余空白：${value}`).toBe(true)
        }
        // emoji 单位同样连写
        if (new RegExp(`${EMOJI}\\s*\\{\\{batt\\}\\}`).test(value)) {
          expect(new RegExp(`${EMOJI}\\{\\{batt\\}\\}`).test(value), `[${lang}] ${key} ⚡️ 后不得有空格：${value}`).toBe(true)
        }
      }
    }
    // 反方向：非货币量词必须仍是「数量 + 空格 + 量词」（证明整改只动了货币）
    expect(TABLES.zh['wage.wageLine']).toMatch(/\{\{hours\}\}\s+小时/)
    expect(TABLES.en['wage.wageLine']).toMatch(/\{\{hours\}\}h/)
    expect(TABLES.zh['campaign.claim.allOk']).toMatch(/\{\{n\}\}\s+项/)
  })

  it('反向锁定：本单已改的 10 键 × 4 语逐字等于预期', () => {
    const EXPECTED = {
      'wage.claimed': {
        zh: '已领到 ⚡️{{batt}}',
        en: 'Claimed ⚡️{{batt}}',
        hk: '已領到 ⚡️{{batt}}',
        vn: 'Đã nhận ⚡️{{batt}}',
      },
      'wage.claimedWithCurrency': {
        zh: '已领到 ⚡️{{batt}} 与 {{symbol}}{{amount}}',
        en: 'Claimed ⚡️{{batt}} and {{symbol}}{{amount}}',
        hk: '已領到 ⚡️{{batt}} 與 {{symbol}}{{amount}}',
        vn: 'Đã nhận ⚡️{{batt}} và {{symbol}}{{amount}}',
      },
      'wage.wageLine': {
        zh: '💰：每 {{hours}} 小时 + ⚡️{{batt}}',
        en: '💰: + ⚡️{{batt}} every {{hours}}h',
        hk: '💰：每 {{hours}} 小時 + ⚡️{{batt}}',
        vn: '💰: + ⚡️{{batt}} mỗi {{hours}} giờ',
      },
      'wage.wageExtra': {
        zh: '＋{{symbol}}{{amount}}',
        en: ' + {{symbol}}{{amount}}',
        hk: '＋{{symbol}}{{amount}}',
        vn: ' + {{symbol}}{{amount}}',
      },
      'campaign.rewardSecondary': {
        zh: '+{{symbol}}{{amount}}',
        en: '+{{symbol}}{{amount}}',
        hk: '+{{symbol}}{{amount}}',
        vn: '+{{symbol}}{{amount}}',
      },
      'project.vaultRechargeOk': {
        zh: '已充值 {{symbol}}{{amount}}，金库余额 {{symbol}}{{balance}}',
        en: 'Topped up {{symbol}}{{amount}}; vault balance {{symbol}}{{balance}}',
        hk: '已充值 {{symbol}}{{amount}}，金庫餘額 {{symbol}}{{balance}}',
        vn: 'Đã nạp {{symbol}}{{amount}}; số dư kho: {{symbol}}{{balance}}',
      },
      'project.vaultLine': {
        zh: '余额 {{symbol}}{{balance}}',
        en: 'Balance {{symbol}}{{balance}}',
        hk: '餘額 {{symbol}}{{balance}}',
        vn: 'Số dư {{symbol}}{{balance}}',
      },
      'adminPoints.adjustSuccessAdd': {
        zh: '成功为用户 #{{id}} 增加 ${{amount}}',
        en: 'Added ${{amount}} to user #{{id}}',
        hk: '成功為用戶 #{{id}} 增加 ${{amount}}',
        vn: 'Đã thêm ${{amount}} cho người dùng #{{id}}',
      },
      'adminPoints.adjustSuccessSubtract': {
        zh: '成功为用户 #{{id}} 减少 ${{amount}}',
        en: 'Removed ${{amount}} from user #{{id}}',
        hk: '成功為用戶 #{{id}} 減少 ${{amount}}',
        vn: 'Đã trừ ${{amount}} của người dùng #{{id}}',
      },
      'adminRewards.floorPriceHint': {
        zh: '当前配置将把单片最低成交价锁定为 J{{price}}；低于该价格的订单不会成交。',
        en: 'This configuration locks the minimum trading price per shard at J{{price}}; orders below that price will not be filled.',
        hk: '當前設定將把單片最低成交價鎖定為 J{{price}}；低於該價格的訂單不會成交。',
        vn: 'Cấu hình hiện tại khóa giá khớp tối thiểu mỗi mảnh ở J{{price}}; lệnh thấp hơn mức đó sẽ không khớp.',
      },
    }
    const failures = []
    for (const [key, perLang] of Object.entries(EXPECTED)) {
      expect(Object.keys(perLang).sort(), `${key} 预期表须覆盖四语`).toEqual(LANGS.slice().sort())
      for (const lang of LANGS) {
        const actual = TABLES[lang][key]
        if (actual !== perLang[lang]) failures.push(`[${lang}] ${key}\n  期望：${perLang[lang]}\n  实取：${actual}`)
      }
    }
    expect(failures, `已改键被回退：\n${failures.join('\n')}`).toEqual([])
  })

  it('积分调整 Toast：单位 `$` 前置且与数量连写（`${{amount}}`），不得回退「{{amount}} 积分」', () => {
    // Kevin 2026-10-24 裁定：`adminPoints.adjustSuccess*` 的单位是货币符号 `$`（不是「积分」），且与数量连写。
    for (const key of ['adminPoints.adjustSuccessAdd', 'adminPoints.adjustSuccessSubtract']) {
      for (const lang of LANGS) {
        const v = TABLES[lang][key]
        expect(v, `[${lang}] ${key} 缺「\${{amount}}」连写`).toContain('${{amount}}')
        expect(v, `[${lang}] ${key} 出现「$ + 空格 + 数量」`).not.toMatch(/\$\s+\{\{amount\}\}/)
        expect(v, `[${lang}] ${key} 出现「{{amount}} + 空格 + $」`).not.toMatch(/\{\{amount\}\}\s*\$/)
        for (const p of BAD_PATTERNS) {
          expect(p.re.test(v), `[${lang}] ${key} 命中坏形「${p.id}」：${v}`).toBe(false)
        }
      }
    }
  })

  it('白名单机制：每条豁免键存在四语、理由非空、且确实只落在非货币计数形上', () => {
    for (const [key, reason] of Object.entries(WHITELIST)) {
      expect(typeof reason === 'string' && reason.trim().length > 0, `白名单 ${key} 缺理由`).toBe(true)
      for (const lang of LANGS) {
        expect(typeof TABLES[lang][key], `白名单键 ${key} 在 ${lang} 不存在`).toBe('string')
      }
      // 防僵死：豁免必须仍命中「非货币计数形」，否则该条目应被删除
      expect(countHits(key), `白名单 ${key} 已不再命中非货币计数形 ⇒ 请删除该豁免`).toBe(true)
      // 豁免键本身不得带货币坏形
      for (const lang of LANGS) {
        for (const p of BAD_PATTERNS) {
          expect(p.re.test(TABLES[lang][key]), `白名单 ${key} 在 ${lang} 命中货币坏形「${p.id}」`).toBe(false)
        }
      }
    }
  })

  it('白名单不可隐藏货币坏形：豁免键一旦注入货币坏形仍判负', () => {
    for (const key of Object.keys(WHITELIST)) {
      for (const lang of LANGS) {
        for (const injected of ['{{amount}} {{symbol}}', '{{symbol}} {{amount}}']) {
          const text = `${TABLES[lang][key]} ${injected}`
          const ids = BAD_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id)
          const expected = injected === '{{amount}} {{symbol}}' ? 'qty-then-symbol' : 'symbol-space-qty'
          expect(ids, `[${lang}] ${key} 注入「${injected}」未被检出 ⇒ 豁免越界`).toContain(expected)
        }
      }
    }
  })
})
