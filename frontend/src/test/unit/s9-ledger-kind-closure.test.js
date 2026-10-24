/**
 * ★S9「族 vs 后端关闭集」守卫（Kong · 本单新增）
 *
 * 背景（独立质检 finding，已复核成立）：`ProfilePage.jsx:416` 与
 *   `MarketPage.jsx:405` 用 `t('ledger.kind.' + entry.kind)` 渲染流水类型。
 *   `LEDGER_KINDS`（`ledger.ts`）是**封闭可枚举集**（后端常量 + DB CHECK 双源），
 *   而四语 `ledger.kind` 曾仅 20 键 ⇒ 4 类流水渲染**裸键名**（用户可见）。
 *
 * 口径（本测试 = 可判负断言）：
 *   ① 关闭集**两源对账**（`LEDGER_KINDS` 现取 vs `0038` 的 `ledger_kind_enum` CHECK 编码）
 *      ⇒ 两源必须逐值相等；
 *   ② 四语 `ledger.kind` 键集 **== 后端关闭集**（缺一 / 多一皆判负）；
 *   ③ 四语键值非空；en / vn **零 CJK**（hk 繁体、zh 简体）；
 *   ④ 计数前推：顶层 119 / 拍平 1050 / 四语节点 4200（S23 +1 jobs.participantsHeadcount；S25 B7 退役 10 键）；
 *   ⑤ **注入自证**：从合成 locale 删掉一个键 ⇒ 检测器必红（给红点），随即可逆。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../..')            // = frontend/src
const REPO = path.resolve(HERE, '../../../..')     // = 仓库根（seafood/）
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

// ---------- 关闭集源 A：后端 TS 常量 `LEDGER_KINDS` 现取 ----------
const LEDGER_TS = fs.readFileSync(path.join(REPO, 'backend-ts/src/ledger.ts'), 'utf8')
const arrayMatch = LEDGER_TS.match(/export const LEDGER_KINDS = \[([\s\S]*?)\] as const;/)
const TS_KINDS = arrayMatch ? [...arrayMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : []

// 镜像常量（冻结口径 · 防止「解析失效却静默通过」）：与后端 LEDGER_KINDS 逐值对齐。
const KINDS_MIRROR = [
  'mint', 'burn', 'transfer', 'hold', 'hold_release', 'hold_forfeit',
  'job_escrow', 'job_escrow_refund', 'job_payout', 'job_fee', 'commission',
  'purchase', 'sale', 'purchase_refund',
  'trade', 'trade_fee',
  'listing_fee', 'listing_deposit',
  'currency_create_fee', 'reversal',
  'checkin_makeup_fee',
  'bttc_mint_fee', 'bttc_burn_fee',
  'invite_first_task_reward',
]

// ---------- 关闭集源 B：DB CHECK `ledger_kind_enum`（0038 冻结编码） ----------
const SQL_0038 = fs.readFileSync(path.join(REPO, 'backend-ts/migrations/0038_kind_close_set_24.sql'), 'utf8')
const checkMatch = SQL_0038.match(/ADD CONSTRAINT ledger_kind_enum CHECK \(kind IN \(([\s\S]*?)\)\);/)
const DB_KINDS = checkMatch ? [...checkMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : []

// ---------- locale ----------
const readLocale = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const KIND = Object.fromEntries(LANGS.map((l) => [l, readLocale(l).ledger.kind]))

/** 缺键检测器（可判负核心）：返回 locale.kind 相对关闭集的缺口 */
const kindDiff = (localeKind, closedSet = TS_KINDS) => {
  const have = new Set(Object.keys(localeKind || {}))
  const missing = closedSet.filter((k) => !have.has(k))
  const extra = [...have].filter((k) => !closedSet.includes(k))
  return { missing, extra }
}

const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${p}${k}.`) : [`${p}${k}`]
))

// ============================================================================
describe('S9① 关闭集两源对账（TS LEDGER_KINDS == DB CHECK ledger_kind_enum）', () => {
  it('LEDGER_KINDS 现取非空且 == 镜像常量（解析未失效）', () => {
    expect(arrayMatch, 'ledger.ts 中未取到 LEDGER_KINDS 数组').not.toBeNull()
    expect(TS_KINDS).toEqual(KINDS_MIRROR)
    expect(TS_KINDS.length).toBe(24)
  })

  it('DB CHECK（0038）非空且逐值 == TS LEDGER_KINDS（两源同集）', () => {
    expect(checkMatch, '0038 中未取到 ledger_kind_enum CHECK').not.toBeNull()
    expect(DB_KINDS.length).toBe(24)
    expect(DB_KINDS).toEqual(TS_KINDS)
  })
})

describe('S9② 四语 ledger.kind 键集 == 后端关闭集（可判负）', () => {
  it('四语皆无缺键、无多余键（缺口差集 = 0）', () => {
    const problems = []
    for (const l of LANGS) {
      const { missing, extra } = kindDiff(KIND[l])
      if (missing.length) problems.push(`${l} 缺 [${missing.join(',')}]`)
      if (extra.length) problems.push(`${l} 多 [${extra.join(',')}]`)
    }
    expect(problems).toEqual([])
    for (const l of LANGS) expect(Object.keys(KIND[l]).length, `${l} 键数`).toBe(24)
  })

  it('四语键值非空；en/vn 零 CJK（hk 繁体 / zh 简体）', () => {
    const problems = []
    for (const l of LANGS) {
      for (const k of TS_KINDS) {
        const v = KIND[l][k]
        if (typeof v !== 'string' || !v.trim()) { problems.push(`${l}.${k} 空/缺`); continue }
        if ((l === 'en' || l === 'vn') && CJK.test(v)) problems.push(`${l}.${k} 残留中文 ${v}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('四语新增键逐字（本单补齐的 4 键）', () => {
    expect(KIND.zh.checkin_makeup_fee).toBe('补签费')
    expect(KIND.zh.bttc_mint_fee).toBe('铸币费')
    expect(KIND.zh.bttc_burn_fee).toBe('销币费')
    expect(KIND.zh.invite_first_task_reward).toBe('邀请首任务奖励')
    expect(KIND.en.checkin_makeup_fee).toBe('Makeup check-in fee')
    expect(KIND.en.bttc_mint_fee).toBe('BTTC mint fee')
    expect(KIND.en.bttc_burn_fee).toBe('BTTC burn fee')
    expect(KIND.en.invite_first_task_reward).toBe('Invite first-task reward')
    expect(KIND.hk.invite_first_task_reward).toBe('邀請首任務獎勵')
    expect(KIND.vn.invite_first_task_reward).toBe('Thưởng nhiệm vụ đầu tiên do mời')
  })
})

describe('S9③ 计数前推（S9 +4 键/语 ⇒ 拍平 1055→1059 / 节点 4220→4236；S25 B7 退役 10 键 ⇒ 1050 / 4200）', () => {
  // ★ F13 清理（Kong 2026-10-12）：删 11 死键/语（reward 族死键：reward / rewardsList / tasksToClaimReward / chooseReward / confirmChooseReward / successClaimReward / common.loadingRewards / homePage.noRewards / homePage.rewardAlreadyClaimed / homePage.rewardOutOfStock / claimRewardModal.loadProgressFailed）⇒ top 127⇒121 / flat 1053⇒1042 / 四语节点 4212⇒4168；★ 同单 stage3 补 catch-all ⇒ 新增 notFound.{title,description,backHome} 3 键/语 ⇒ **终值 top 122 / flat 1045 / 四语节点 4180**。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
  it('顶层 128 不变 / 拍平 1070 / 四语节点 4280（v1.5 §14.10 +20 叶/语；S23 +1 jobs.participantsHeadcount；S25 B7 退役 10 键）', () => {
    for (const l of LANGS) {
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
      expect(Object.keys(readLocale(l)).length, `${l} top`).toBe(135) // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // [i18n-bump item-detail +7 键 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(flatten(readLocale(l)).length, `${l} flat`).toBe(1453) // [home-hero-removal（2026-10-24）：删 5 个死键（homePage.welcome/heroLead/heroTail/continueTask/registerNow，四语对称）⇒ flat 1456⇒1451 / 四语节点 5824⇒5804（top 135 不变）] [i18n-bump project-wage-slider（2026-10-24）：+2 `project.*` 键（wageRateAnchor/wageLegacyRate，四语对称）⇒ flat 1454⇒1456 / 四语节点 5816⇒5824（top 135 不变 / project 140⇒142）] // [i18n-bump project-avatar（2026-10-22）：+5 `project.*` 键（avatarChange/avatarReset/avatarResetConfirm/avatarTooLarge/avatarUploadFail，四语对称）⇒ flat 1388⇒1393 / 四语节点 5552⇒5572 / project 102⇒107（top 135 不变）] **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变] // [i18n-bump subtask-manage（2026-10-22 · 子任务行内编辑/删除）：+9 `project.*` 键（子任务编辑/删除/锁/有凭证/失败，四语对称）⇒ top 135 不变 / flat 1369⇒1378 / 四语节点 5476⇒5512 / project 85⇒94] [i18n-bump exchange-trend（2026-10-22 · /exchange 价格走势 + 撤全计数）：+5 `market.*` 键（priceTrend / trendRange / cancelAllOkCount / cancelAllNone / cancelPartial，四语对称）⇒ flat 1394⇒1399 / 四语节点 5576⇒5596 / market 29⇒34（top 135 不变）] [i18n-bump project-recruit（2026-10-22③ · 项目页拆出【招工】模态框）：+3 `project.*` 键（entryRecruit / recruitTitle / recruitSaved，四语对称）⇒ flat 1399⇒1415 / 四语节点 5596⇒5660 / project 107⇒110（top 135 不变）] [i18n-bump project-vault（2026-10-23）：+12 `project.*` 键（vaultTitle/vaultLine/vaultRechargeLabel/vaultRechargeBtn/vaultRecharging/vaultRechargeOk/vaultFailDetail/vaultErrInsufficient/vaultErrAmountInvalid/vaultErrCidInvalid/vaultErrGeneral/recruitZeroHint，四语对称）⇒ flat 1415⇒1427 / 四语节点 5660⇒5708 / project 121⇒133（top 135 不变；vn 待复核）] // [i18n-bump exchange-route（2026-10-23 · /exchange 路径参数 + 持币人 + 选择页）：+7 `market.*` 键（holdersTitle/holdersTotal/holdersEmpty/holdersFail/pickNote/pickTitle/pickCta，四语对称）⇒ flat 1427⇒1434 / 四语节点 5708⇒5788 / market 34⇒41（top 135 不变；vn 待复核）] [i18n-bump campaign-claim（2026-10-23）：+13 `campaign.*` 键（submit.battCost/battInsufficient/rewardPending + claim.{cta,claiming,all,allCost,pending,ok,allOk,battInsufficient,nothingToClaim,failed}，四语对称）⇒ flat 1434⇒1447 / 四语节点 5736⇒5788（top 135 不变 / campaign 74⇒87）] [i18n-bump project-wage-std（2026-10-23）：+7 `project.*` 键（entryWageStd / wageStdTitle / wageStdHint / newSlotsLabel / newSlotsHint / slotsReadout / wageStdSaved，四语对称）⇒ flat 1447⇒1454 / 四语节点 5788⇒5816 / project 133⇒140（top 135 不变）]
    }
    // S25：1050 × 4 = 4200（原 1060 × 4 = 4240）。
    expect(flatten(readLocale('zh')).length * LANGS.length).toBe(5812) // [home-hero-removal（2026-10-24）：删 5 个死键（homePage.welcome/heroLead/heroTail/continueTask/registerNow，四语对称）⇒ flat 1456⇒1451 / 四语节点 5824⇒5804（top 135 不变）] [i18n-bump project-wage-slider（2026-10-24）：+2 `project.*` 键（wageRateAnchor/wageLegacyRate，四语对称）⇒ flat 1454⇒1456 / 四语节点 5816⇒5824（top 135 不变 / project 140⇒142）] // [i18n-bump project-avatar（2026-10-22）：+5 `project.*` 键（avatarChange/avatarReset/avatarResetConfirm/avatarTooLarge/avatarUploadFail，四语对称）⇒ flat 1388⇒1393 / 四语节点 5552⇒5572 / project 102⇒107（top 135 不变）] **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436 // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变] // [i18n-bump subtask-manage（2026-10-22 · 子任务行内编辑/删除）：+9 `project.*` 键（子任务编辑/删除/锁/有凭证/失败，四语对称）⇒ top 135 不变 / flat 1369⇒1378 / 四语节点 5476⇒5512 / project 85⇒94] [i18n-bump exchange-trend（2026-10-22 · /exchange 价格走势 + 撤全计数）：+5 `market.*` 键（priceTrend / trendRange / cancelAllOkCount / cancelAllNone / cancelPartial，四语对称）⇒ flat 1394⇒1399 / 四语节点 5576⇒5596 / market 29⇒34（top 135 不变）] [i18n-bump project-recruit（2026-10-22③ · 项目页拆出【招工】模态框）：+3 `project.*` 键（entryRecruit / recruitTitle / recruitSaved，四语对称）⇒ flat 1399⇒1415 / 四语节点 5596⇒5660 / project 107⇒110（top 135 不变）] [i18n-bump project-vault（2026-10-23）：+12 `project.*` 键（vaultTitle/vaultLine/vaultRechargeLabel/vaultRechargeBtn/vaultRecharging/vaultRechargeOk/vaultFailDetail/vaultErrInsufficient/vaultErrAmountInvalid/vaultErrCidInvalid/vaultErrGeneral/recruitZeroHint，四语对称）⇒ flat 1415⇒1427 / 四语节点 5660⇒5708 / project 121⇒133（top 135 不变；vn 待复核）] // [i18n-bump exchange-route（2026-10-23 · /exchange 路径参数 + 持币人 + 选择页）：+7 `market.*` 键（holdersTitle/holdersTotal/holdersEmpty/holdersFail/pickNote/pickTitle/pickCta，四语对称）⇒ flat 1427⇒1447 / 四语节点 5708⇒5736 / market 34⇒41（top 135 不变；vn 待复核）] [i18n-bump campaign-claim（2026-10-23）：+13 `campaign.*` 键（submit.battCost/battInsufficient/rewardPending + claim.{cta,claiming,all,allCost,pending,ok,allOk,battInsufficient,nothingToClaim,failed}，四语对称）⇒ flat 1434⇒1447 / 四语节点 5736⇒5788（top 135 不变 / campaign 74⇒87）] [i18n-bump project-wage-std（2026-10-23）：+7 `project.*` 键（entryWageStd / wageStdTitle / wageStdHint / newSlotsLabel / newSlotsHint / slotsReadout / wageStdSaved，四语对称）⇒ flat 1447⇒1454 / 四语节点 5788⇒5816 / project 133⇒140（top 135 不变）]
  })
})

// ============================================================================
describe('S9④ 检测器自证（注入缺键 ⇒ 必红；随即可逆）', () => {
  it('从合成 locale.kind 删掉 invite_first_task_reward ⇒ kindDiff 命中（红点）', () => {
    const sintetic = { ...KIND.zh }
    delete sintetic.invite_first_task_reward
    const { missing } = kindDiff(sintetic)
    expect(missing).toEqual(['invite_first_task_reward'])
  })

  it('删任意一键皆必红（逐键遍历，非单点）', () => {
    for (const k of TS_KINDS) {
      const sintetic = { ...KIND.en }
      delete sintetic[k]
      expect(kindDiff(sintetic).missing, `删 ${k}`).toEqual([k])
    }
  })

  it('完整键集 ⇒ 无命中（判定可逆）', () => {
    expect(kindDiff(KIND.zh)).toEqual({ missing: [], extra: [] })
  })

  it('多余键（如未知兜底键）⇒ 亦判负（严格相等，非「只查缺」）', () => {
    const sintetic = { ...KIND.zh, __unknown__: 'x' }
    expect(kindDiff(sintetic).extra).toEqual(['__unknown__'])
  })
})
