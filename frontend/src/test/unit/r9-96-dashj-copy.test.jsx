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

// ★ F13 清理（Kong 2026-10-12）：删 11 死键/语（reward 族死键：reward / rewardsList / tasksToClaimReward / chooseReward / confirmChooseReward / successClaimReward / common.loadingRewards / homePage.noRewards / homePage.rewardAlreadyClaimed / homePage.rewardOutOfStock / claimRewardModal.loadProgressFailed）⇒ top 127⇒121 / flat 1053⇒1042 / 四语节点 4212⇒4168；★ 同单 stage3 补 catch-all ⇒ 新增 notFound.{title,description,backHome} 3 键/语 ⇒ **终值 top 122 / flat 1045 / 四语节点 4180**。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
describe('⑤ 计数（v1.5 §14.10：top 128 / flat 1070 / 四语节点 4280；S23：top 119 / flat 1050 / 四语节点 4200；S25：B7 退役 10 键）', () => {
  it('四语 top / flat / 合计', () => {
    let nodes = 0
    for (const l of LANGS) {
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
      expect(Object.keys(TABLES[l]).length, `${l} top`).toBe(133) // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
      const f = flat(TABLES[l]).length
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(f, `${l} flat`).toBe(1239) // **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
      nodes += f
    }
    // S25：1050 × 4 = 4200（原 1060 × 4 = 4240）。
    expect(nodes, '四语节点合计').toBe(4956) // **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436 // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532]
  })
})
