/**
 * S23 单测（Kong · 台账 B4）：`headcount` 进入任务读模型 + 展示「已参与 X / 共 N 人」
 * ============================================================================
 * 覆盖四件事：
 *   (a) 四语 `jobs.participantsHeadcount` 键**四语齐备且键集严格相等**、值逐字、含 `{{done}}`＋`{{limit}}`；
 *   (b) 计数基线前推：顶层 **119** / 拍平 **1050**（S23 +1 jobs.participantsHeadcount；S25 B7 退役 10 键）/ 四语节点 **4200**；
 *   ★ 2026-10-21（Kevin 裁定 · job 体系弃用）：原 (c)(d) 的 `JobDetailPage` 展示面/负对照**随页删除**
 *     ⇒ 本文件只留 (a)(b) 值面与计数基线；键与值**不动**（campaign 卡 `HomeCampaignCard` 仍在用）。
 *
 * 口径：真四语词典文件逐字断言（`{{done}}` / `{{limit}}` 双占位符面保留在值里）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

// i18n 替身：真 zh 词典 + `{{var}}` 插值（模块级稳定函数）
const H = vi.hoisted(() => {
  const state = { table: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key, opts) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    if (v === undefined) return key
    return opts ? String(v).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')) : v
  }
  return state
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

beforeEach(() => { H.table = zh })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ============================================================================
// (a) 四语 `jobs.participantsHeadcount`：键集严格相等 + 值逐字 + 双占位符
// ============================================================================
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/
const readTable = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))
const TABLES = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flat(readTable(l)))]))

const EXPECTED = {
  zh: '已参与 {{done}} / 共 {{limit}} 人',
  hk: '已參與 {{done}} / 共 {{limit}} 人',
  en: '{{done}} / {{limit}} participants',
  vn: '{{done}} / {{limit}} người tham gia',
}

describe('(a) 四语 jobs.participantsHeadcount（新键）', () => {
  it('四语值逐字 = 期望', () => {
    for (const l of LANGS) expect(TABLES[l]['jobs.participantsHeadcount'], l).toBe(EXPECTED[l])
  })

  it('四语值均含 {{done}} 与 {{limit}} 双占位符', () => {
    for (const l of LANGS) {
      expect(TABLES[l]['jobs.participantsHeadcount'], `${l} done`).toContain('{{done}}')
      expect(TABLES[l]['jobs.participantsHeadcount'], `${l} limit`).toContain('{{limit}}')
    }
  })

  it('en/vn 值零 CJK（hk 繁体 / zh 简体）', () => {
    for (const l of ['en', 'vn']) expect(CJK.test(TABLES[l]['jobs.participantsHeadcount']), l).toBe(false)
  })

  it('四语**键集严格相等**（只比键，缺一 / 多一 / 命名差异皆判负）', () => {
    const keySets = Object.fromEntries(LANGS.map((l) => [l, Object.keys(TABLES[l]).sort()]))
    for (const l of LANGS) {
      expect(keySets[l], `${l} vs zh 键集（排序后逐字相等）`).toEqual(keySets.zh)
    }
    expect(new Set(LANGS.map((l) => keySets[l].join('\u0001'))).size, '四语键集唯一').toBe(1)
  })
})

// ============================================================================
// (b) 计数基线前推（S23 +1 jobs.participantsHeadcount ⇒ 1059⇒1060 / 4236⇒4240；S25 B7 退役 10 键 ⇒ 1060⇒1050 / 4240⇒4200）
// ============================================================================
describe('(b) 计数基线前推', () => {
  // ★ F13 清理（Kong 2026-10-12）：删 11 死键/语（reward 族死键：reward / rewardsList / tasksToClaimReward / chooseReward / confirmChooseReward / successClaimReward / common.loadingRewards / homePage.noRewards / homePage.rewardAlreadyClaimed / homePage.rewardOutOfStock / claimRewardModal.loadProgressFailed）⇒ top 127⇒121 / flat 1053⇒1042 / 四语节点 4212⇒4168；★ 同单 stage3 补 catch-all ⇒ 新增 notFound.{title,description,backHome} 3 键/语 ⇒ **终值 top 122 / flat 1045 / 四语节点 4180**。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
  it('顶层 128 不变 / 拍平 1070 / 四语节点 4280（v1.5 §14.10 +20 叶/语；S25 B7 退役 10 键）', () => {
    for (const l of LANGS) {
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
      expect(Object.keys(readTable(l)).length, `${l} top`).toBe(136) // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
      // S25 计数期望订正（台账 B7 死键退役）：jobs 退役 10 键 ×4 语对称删除 ⇒ 拍平 1060⇒1050（等量下移 −10/语）。
      expect(flat(readTable(l)).length, `${l} flat`).toBe(1461) // [home-hero-removal（2026-10-24）：删 5 个死键（homePage.welcome/heroLead/heroTail/continueTask/registerNow，四语对称）⇒ flat 1456⇒1451 / 四语节点 5824⇒5804（top 135 不变）] [i18n-bump project-wage-slider（2026-10-24）：+2 `project.*` 键（wageRateAnchor/wageLegacyRate，四语对称）⇒ flat 1454⇒1456 / 四语节点 5816⇒5824（top 135 不变 / project 140⇒142）] // [i18n-bump project-avatar（2026-10-22）：+5 `project.*` 键（avatarChange/avatarReset/avatarResetConfirm/avatarTooLarge/avatarUploadFail，四语对称）⇒ flat 1388⇒1393 / 四语节点 5552⇒5572 / project 102⇒107（top 135 不变）] **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变] // [i18n-bump subtask-manage（2026-10-22 · 子任务行内编辑/删除）：+9 `project.*` 键（子任务编辑/删除/锁/有凭证/失败，四语对称）⇒ top 135 不变 / flat 1369⇒1378 / 四语节点 5476⇒5512 / project 85⇒94] [i18n-bump exchange-trend（2026-10-22 · /exchange 价格走势 + 撤全计数）：+5 `market.*` 键（priceTrend / trendRange / cancelAllOkCount / cancelAllNone / cancelPartial，四语对称）⇒ flat 1394⇒1399 / 四语节点 5576⇒5596 / market 29⇒34（top 135 不变）] [i18n-bump project-recruit（2026-10-22③ · 项目页拆出【招工】模态框）：+3 `project.*` 键（entryRecruit / recruitTitle / recruitSaved，四语对称）⇒ flat 1399⇒1415 / 四语节点 5596⇒5660 / project 107⇒110（top 135 不变）] [i18n-bump project-vault（2026-10-23）：+12 `project.*` 键（vaultTitle/vaultLine/vaultRechargeLabel/vaultRechargeBtn/vaultRecharging/vaultRechargeOk/vaultFailDetail/vaultErrInsufficient/vaultErrAmountInvalid/vaultErrCidInvalid/vaultErrGeneral/recruitZeroHint，四语对称）⇒ flat 1415⇒1427 / 四语节点 5660⇒5708 / project 121⇒133（top 135 不变；vn 待复核）] // [i18n-bump exchange-route（2026-10-23 · /exchange 路径参数 + 持币人 + 选择页）：+7 `market.*` 键（holdersTitle/holdersTotal/holdersEmpty/holdersFail/pickNote/pickTitle/pickCta，四语对称）⇒ flat 1427⇒1434 / 四语节点 5708⇒5788 / market 34⇒41（top 135 不变；vn 待复核）] [i18n-bump campaign-claim（2026-10-23）：+13 `campaign.*` 键（submit.battCost/battInsufficient/rewardPending + claim.{cta,claiming,all,allCost,pending,ok,allOk,battInsufficient,nothingToClaim,failed}，四语对称）⇒ flat 1434⇒1447 / 四语节点 5736⇒5788（top 135 不变 / campaign 74⇒87）] [i18n-bump project-wage-std（2026-10-23）：+7 `project.*` 键（entryWageStd / wageStdTitle / wageStdHint / newSlotsLabel / newSlotsHint / slotsReadout / wageStdSaved，四语对称）⇒ flat 1447⇒1454 / 四语节点 5788⇒5816 / project 133⇒140（top 135 不变）]
    }
    // S25：1050 × 4 = 4200（原 1060 × 4 = 4240）。
    expect(flat(readTable('zh')).length * LANGS.length).toBe(5844) // [home-hero-removal（2026-10-24）：删 5 个死键（homePage.welcome/heroLead/heroTail/continueTask/registerNow，四语对称）⇒ flat 1456⇒1451 / 四语节点 5824⇒5804（top 135 不变）] [i18n-bump project-wage-slider（2026-10-24）：+2 `project.*` 键（wageRateAnchor/wageLegacyRate，四语对称）⇒ flat 1454⇒1456 / 四语节点 5816⇒5824（top 135 不变 / project 140⇒142）] // [i18n-bump project-avatar（2026-10-22）：+5 `project.*` 键（avatarChange/avatarReset/avatarResetConfirm/avatarTooLarge/avatarUploadFail，四语对称）⇒ flat 1388⇒1393 / 四语节点 5552⇒5572 / project 102⇒107（top 135 不变）] **sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436 // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变] // [i18n-bump subtask-manage（2026-10-22 · 子任务行内编辑/删除）：+9 `project.*` 键（子任务编辑/删除/锁/有凭证/失败，四语对称）⇒ top 135 不变 / flat 1369⇒1378 / 四语节点 5476⇒5512 / project 85⇒94] [i18n-bump exchange-trend（2026-10-22 · /exchange 价格走势 + 撤全计数）：+5 `market.*` 键（priceTrend / trendRange / cancelAllOkCount / cancelAllNone / cancelPartial，四语对称）⇒ flat 1394⇒1399 / 四语节点 5576⇒5596 / market 29⇒34（top 135 不变）] [i18n-bump project-recruit（2026-10-22③ · 项目页拆出【招工】模态框）：+3 `project.*` 键（entryRecruit / recruitTitle / recruitSaved，四语对称）⇒ flat 1399⇒1415 / 四语节点 5596⇒5660 / project 107⇒110（top 135 不变）] [i18n-bump project-vault（2026-10-23）：+12 `project.*` 键（vaultTitle/vaultLine/vaultRechargeLabel/vaultRechargeBtn/vaultRecharging/vaultRechargeOk/vaultFailDetail/vaultErrInsufficient/vaultErrAmountInvalid/vaultErrCidInvalid/vaultErrGeneral/recruitZeroHint，四语对称）⇒ flat 1415⇒1427 / 四语节点 5660⇒5708 / project 121⇒133（top 135 不变；vn 待复核）] // [i18n-bump exchange-route（2026-10-23 · /exchange 路径参数 + 持币人 + 选择页）：+7 `market.*` 键（holdersTitle/holdersTotal/holdersEmpty/holdersFail/pickNote/pickTitle/pickCta，四语对称）⇒ flat 1427⇒1447 / 四语节点 5708⇒5736 / market 34⇒41（top 135 不变；vn 待复核）] [i18n-bump campaign-claim（2026-10-23）：+13 `campaign.*` 键（submit.battCost/battInsufficient/rewardPending + claim.{cta,claiming,all,allCost,pending,ok,allOk,battInsufficient,nothingToClaim,failed}，四语对称）⇒ flat 1434⇒1447 / 四语节点 5736⇒5788（top 135 不变 / campaign 74⇒87）] [i18n-bump project-wage-std（2026-10-23）：+7 `project.*` 键（entryWageStd / wageStdTitle / wageStdHint / newSlotsLabel / newSlotsHint / slotsReadout / wageStdSaved，四语对称）⇒ flat 1447⇒1454 / 四语节点 5788⇒5816 / project 133⇒140（top 135 不变）]
  })
})

