/**
 * P6-I18N-LIT-B4a · 后台管理面前半（`adminNav` / `adminLayout` / `adminCommon` / `dashPage` /
 *                `adminTasks` / `adminRewards`）四语化验收
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 走**真实** i18n 实例（`import '../../i18n'`）+ `i18n.changeLanguage('en')`，**不 mock** `react-i18next`；
 *      后台三文件均只读 `i18n.t`（无路由语前缀派生）⇒ `changeLanguage` 即真「en 档」；
 *   ② 数据面只 mock `../../admin-utils`（权限/取数口）；组件树其余全真；
 *   ③ 反证 = 简体原文在 en 档渲染期不得出现（逐条 `queryByText` 断言）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: true, permissions: [], can_access_admin: true })),
  fetchApiJson: vi.fn(async (url) => {
    // ★ job 下线后「任务管理」面板走 campaign 读口（旧 `/api/task/all` 已删）
    if (String(url).includes('/api/campaign/all')) {
      return [{
        campaign_id: 501,
        title: 'Autumn drive',
        status: 'active',
        tasks: [{ task_id: 55, title: 'Task A', description: '', status: 'active', reward_amount_primary: '10' }],
      }]
    }
    // `/api/prize/all`：name/description 留空 ⇒ 走「#ID / 无描述」兜底键
    return [{ bID: 7, name: '', description: '', points: 10, total_quantity: 3, stores_count: 5, claims_count: 2, lifecycle_status: 'expired' }]
  }),
  getAuthHeaders: vi.fn(() => ({})),
  getStoredUser: vi.fn(() => ({ uID: 1, EVM: '0xabcdef1234567890' })),
  hasAdminPermission: vi.fn(() => true),
}))

import AdminLayout from '../../components/layout/AdminLayout'
import TasksManagement from '../../pages/admin/TasksManagement'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']

afterEach(() => { cleanup() })

describe('P6-I18N-LIT-B4a · en 档渲染英文（后台面两个页面；rewards 页 2026-10-22 下架）', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  it('AdminLayout（侧边栏 + 顶栏 + 账号区）：导航/面板名/角色/在线 全走英文', async () => {
    render(<MemoryRouter initialEntries={['/']}><AdminLayout /></MemoryRouter>)

    // 侧边栏 8 条导航（`adminNav.*`）
    for (const label of [
      'Dashboard', 'Task Management', 'Shard Management',
      'User Management', 'Permission Management', 'Points Management', 'System Settings',
    ]) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
    // 面板名（`adminLayout.panelTitle`，侧栏标题 + 顶栏标题两处）
    expect(screen.getAllByText('Admin Panel').length).toBeGreaterThanOrEqual(2)
    // 账号区
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Log out')).toBeInTheDocument()
    // 反证：简体原文不出现
    expect(screen.queryByText('管理面板')).toBeNull()
    expect(screen.queryByText('仪表板')).toBeNull()
    expect(screen.queryByText('在线')).toBeNull()
  })

  it('TasksManagement（en 档）：页头 / 只读告示 / 刷新 / 兜底描述 / 积分 / 开关态 全走英文', async () => {
    render(<TasksManagement />)

    expect(await screen.findByText('Task Management')).toBeInTheDocument()
    expect(screen.getByText(/read-only mode/)).toBeInTheDocument()
    expect(screen.getByText('Refresh')).toBeInTheDocument()
    expect(await screen.findByText('Task A')).toBeInTheDocument()
    // `note` 为空 ⇒ 兜底键 `adminCommon.noDescription`
    expect(screen.getByText('No description')).toBeInTheDocument()
    // `adminCommon.pointsValue` = '{{value}} points'
    expect(screen.getByText('10 points')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.queryByText('暂无描述')).toBeNull()
    expect(screen.queryByText('刷新')).toBeNull()
    expect(screen.queryByText('任务管理')).toBeNull()
  })

})

describe('P6-I18N-LIT-B4a · 四语 locale 键集（6 命名空间 144 键 + 逐文件相等）', () => {
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()
  // 本批新增命名空间 → 键数（逐命名空间硬断言，防「键名写错但四语同步错」）
  const NEW_NS = { adminNav: 30, adminLayout: 5, adminCommon: 28, dashPage: 58, adminTasks: 14, adminRewards: 42 } // **期望订正（批 8② 费率+权重矩阵）**：`adminNav` 16⇒20（+4 键：`feeRate` / `weightMatrix` 两条菜单项 + 两条路由面文案）；**批 8④ 再订正**：`adminNav` 20⇒22（+2 键：`currencyReview` / `currencyReviewDesc`）；**P9① 再订正**：`adminNav` 26⇒28（+2 键：`siteText` / `siteTextDesc`，⇔ 后台「站点文案」菜单；沿 `R-8-22`）
  const NEW_KEY_TOTAL = Object.values(NEW_NS).reduce((a, b) => a + b, 0)
  // B4a 交付时合计 = 144；B4b（后台剩余面）给既有 `adminCommon` 追加 19 键 ⇒ 现值 163。
  // 保留 144 作为 B4a 历史口径锚点（防「顺手改大期望值」掩盖键名事故）。
  const B4A_ADDED = 144
  const B4B_ADDED_TO_ADMINCOMMON = 19
  // **期望订正（批 8② 费率+权重矩阵）**：8② 给既有 `adminNav` 追加 4 键（不新开命名空间到本清单，费率/权重矩阵另计为顶层 `adminFeeRate`/`adminWeightMatrix`）⇒ 单列 delta，不改 B4a 历史锚点。
  const B8S2_ADDED_TO_ADMINNAV = 4
  // **期望订正（批 8④ 自建单位审核）**：给既有 `adminNav` 追加 2 键（`currencyReview` / `currencyReviewDesc`）
  //   ⇒ 单列 delta，不改 B4a 历史锚点（新命名空间 `adminCurrencyReview` 另计为顶层，不属本清单）。
  const B8S4_ADDED_TO_ADMINNAV = 2
  // **期望订正（批 8⑤ 商品合规审核 + 招工仲裁）**：给既有 `adminNav` 追加 4 键（`listingReview` / `listingReviewDesc` / `arbitrationReview` / `arbitrationReviewDesc`）
  //   ⇒ 单列 delta，不改 B4a 历史锚点（新命名空间 `adminListingReview` / `adminArbitrationReview` 另计为顶层，不属本清单）。
  const B8S5_ADDED_TO_ADMINNAV = 4
  // **期望订正（P9① 站点文案覆盖层）**：给既有 `adminNav` 追加 2 键（`siteText` / `siteTextDesc`，⇔ 后台「站点文案」菜单）
  //   ⇒ 单列 delta（沿 `R-8-22`），不改 B4a 历史锚点（新命名空间 `roleNames` / `siteSlogan` / `adminRoleNames` / `adminSiteText` 另计为顶层）。
  const B9S1_ADDED_TO_ADMINNAV = 2
  // **期望订正（8⑥ 审计台）**：给既有 `adminNav` 追加 2 键（`auditConsole` / `auditConsoleDesc`，⇔ 后台「审计台」菜单 · `R-9-75`）；新命名空间 `auditConsole`（33 键）另计为顶层。
  const B8S6_ADDED_TO_ADMINNAV = 2

  it('新增键四语齐备、非空串；四文件拍平键集逐文件相等', () => {
    const tables = {}
    const sets = {}
    const counts = {}
    for (const lang of LANGS) {
      tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
      sets[lang] = keyPaths(tables[lang])
      counts[lang] = { top: Object.keys(tables[lang]).length, flat: sets[lang].length }
    }
    console.info('[B4a] locale 键数读数', JSON.stringify(counts))
    console.info('[B4a] 本批新增键数', NEW_KEY_TOTAL)

    // ③ 键集相等：四文件拍平键数取值集合 = {643}（B4b 后），且与 zh 逐项对拍
    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)
    expect(new Set(LANGS.map((l) => counts[l].flat)).size).toBe(1)
    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
    // S25 计数期望订正（台账 B7 死键退役）：四语对称删 10 键 ⇒ 拍平 1060⇒1050（等量下移 = −10/语）。
    // v1.5 §14 delta①（2026-10-11 收尾单 · Zang 裁定⑧）曾另立新键 'me'：top 128⇒129 / flat 1070⇒1071 / 节点 4280⇒4284；[留痕] 本单（2026-10-11 · Kevin 口径）全站统一 profile 值 = 我的/Me/我的/Tôi 并删 'me' ⇒ 计数回落 top 129⇒128 / flat 1071⇒1070 / 节点 4284⇒4280。
  // ★ A5 收口（design-system.spec v1.17 §20.7 #1 / §20.8 前推 · Kong 2026-10-12）：站内信 + Telegram 四语 **+35/-2**（同补同删）⇒ 顶层 122⇒**125** / 拍平 1045⇒**1078** / 四语节点 4180⇒**4312**（1078×4）。★ 顶层读数 = **125（非 §20.8 算式所写 123）**：新键含**两处新顶层错误域** `msg.err.<CODE>`(7) + `tg.err.<CODE>`(5) （route v2.31 §41.5 冻结键名 = 后端 `error.i18n_key` 字面，前端必须按名解析）⇒ 新顶层 = `telegram` + `msg` + `tg` = **+3**；规范算式「顶层 122+1」漏计 `msg`/`tg` 两域（拍平/节点算式与实测一致）。已随本单上报（规范自相矛盾项）。
    expect(counts.zh).toEqual({ top: 135, flat: 1447 }) // [i18n-bump project-avatar（2026-10-22）：+5 `project.*` 键（avatarChange/avatarReset/avatarResetConfirm/avatarTooLarge/avatarUploadFail，四语对称）⇒ flat 1388⇒1393 / 四语节点 5552⇒5572 / project 102⇒107（top 135 不变）] [i18n-bump project-publish（2026-10-21 · 步 2 三入口表单）：+28 `project.*` 键（四语对称）⇒ top 135 不变 / flat 1327⇒1369 / 四语节点 5308⇒5476 / project 50⇒78] // **期望订正（S9 ledger.kind 缺键补齐）**：S8 +1 jobs.deliverable ⇒ 1055；S9 +4 ledger.kind 键/语 ⇒ 拍平 1055⇒1059（前订正 S7：1044⇒1054）；**S25 再订正** 1059⇒1050（B7 退役 10 键）；**sf14 前推（2026-10-14 单）**：+3 顶层（header/profileNav/activitiesPage）+14 键（profileNav 空态 4 + item.favorite 5）⇒ top 125⇒128 / flat 1078⇒1095；**sf19-msgpanel**：`+1` 键（`messagesPage.close`）⇒ flat `1103⇒1104` / 四语节点 `4412⇒4416`；**sf-bttc-shortfall**：+2 键（`bttcPanel.mintNeedBatt`/`mintNeedUsd`）⇒ flat 1104⇒1109 / 四语节点 4416⇒4436；**media-upload-B（阶段 B 写侧）**：+3 item 键（imagesLabel/imageRemove/imageUploadFail）⇒ flat 1106⇒1109 / 四语节点 4424⇒4436（top 128 不变） ；**media-size-1mb（2026-10-19）**：+1 键（`item.imageTooLarge`）⇒ flat 1109⇒1110 / 四语节点 4436⇒4440（top 128 不变 / item 52⇒53） // 卡片改版（2026-10-19）：+1 顶层 `sellerCredit` ×4 键/语 ⇒ top 128⇒129 / flat 1110⇒1114 / 节点 4440⇒4456 // 卡片行结构重定义（2026-10-19）：+1 键（rewardCard.wants，四语对称）⇒ flat 1114⇒1115 / 四语节点 4456⇒4460（top 129 不变） // item-type（2026-10-20）：+5 键（`itemType` 4 + `item.freeShipping` 1，四语对称）⇒ top 129⇒130 / flat 1115⇒1120 / 四语节点 4460⇒4480 // 0054 数字商品拆分（2026-10-20）：+2 键（`itemType.autoDeliver`/`itemType.manualDeliver`，四语对称）⇒ flat 1120⇒1122 / 四语节点 4480⇒4488（top 130 不变） // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键) ⇒ top 131⇒132 / flat 1140⇒1169] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1369 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变] // [i18n-bump subtask-manage（2026-10-22 · 子任务行内编辑/删除）：+9 `project.*` 键（子任务编辑/删除/锁/有凭证/失败，四语对称）⇒ top 135 不变 / flat 1369⇒1378 / 四语节点 5476⇒5512 / project 85⇒94] [i18n-bump exchange-trend（2026-10-22 · /exchange 价格走势 + 撤全计数）：+5 `market.*` 键（priceTrend / trendRange / cancelAllOkCount / cancelAllNone / cancelPartial，四语对称）⇒ flat 1394⇒1399 / 四语节点 5576⇒5596 / market 29⇒34（top 135 不变）] [i18n-bump project-recruit（2026-10-22③ · 项目页拆出【招工】模态框）：+3 `project.*` 键（entryRecruit / recruitTitle / recruitSaved，四语对称）⇒ flat 1399⇒1415 / 四语节点 5596⇒5660 / project 107⇒110（top 135 不变）] [i18n-bump project-vault（2026-10-23）：+12 `project.*` 键（vaultTitle/vaultLine/vaultRechargeLabel/vaultRechargeBtn/vaultRecharging/vaultRechargeOk/vaultFailDetail/vaultErrInsufficient/vaultErrAmountInvalid/vaultErrCidInvalid/vaultErrGeneral/recruitZeroHint，四语对称）⇒ flat 1415⇒1427 / 四语节点 5660⇒5708 / project 121⇒133（top 135 不变；vn 待复核）] [i18n-bump campaign-claim（2026-10-23）：+13 `campaign.*` 键（submit.battCost/battInsufficient/rewardPending + claim.{cta,claiming,all,allCost,pending,ok,allOk,battInsufficient,nothingToClaim,failed}，四语对称）⇒ flat 1434⇒1447 / 四语节点 5736⇒5788（top 135 不变 / campaign 74⇒87）]
    expect(NEW_KEY_TOTAL).toBe(B4A_ADDED + B4B_ADDED_TO_ADMINCOMMON + B8S2_ADDED_TO_ADMINNAV + B8S4_ADDED_TO_ADMINNAV + B8S5_ADDED_TO_ADMINNAV + B9S1_ADDED_TO_ADMINNAV + B8S6_ADDED_TO_ADMINNAV)

    // 本批 6 命名空间：键数逐一对齐 + 四语取值齐备非空
    for (const [ns, size] of Object.entries(NEW_NS)) {
      expect(sets.zh).not.toContain(ns)
      for (const lang of LANGS) {
        const table = tables[lang][ns]
        expect(typeof table).toBe('object')
        expect(Object.keys(table).sort()).toEqual(Object.keys(tables.zh[ns]).sort())
        expect(Object.keys(table).length).toBe(size)
        for (const value of Object.values(table)) {
          expect(typeof value).toBe('string')
          expect(value.trim().length).toBeGreaterThan(0)
        }
      }
    }
    // 抽查：en / vn 不得残留 CJK 表意文字（hk 为繁体中文，`儀表板` 等本就用 CJK ⇒ 不在断言内）
    const CJK = /[\u4E00-\u9FFF]/
    for (const ns of ['adminNav', 'adminLayout', 'adminCommon', 'dashPage', 'adminTasks', 'adminRewards']) {
      for (const [k, v] of Object.entries(tables.en[ns])) expect(CJK.test(v), `en.${ns}.${k}`).toBe(false)
      for (const [k, v] of Object.entries(tables.vn[ns])) expect(CJK.test(v), `vn.${ns}.${k}`).toBe(false)
    }
    // hk 必须是繁体（不得是简体原文）：抽查 3 条简体/繁体异形
    expect(tables.hk.adminNav.dashboard).toBe('儀表板')
    expect(tables.hk.adminLayout.systemAdmin).toBe('系統管理')
    expect(tables.hk.adminRewards.expired).toBe('已過期')
  })

  it('zh 词典取值与本批改写前的原文逐字一致（既有 zh 断言/截图基线不受影响）', () => {
    const zh = JSON.parse(fs.readFileSync(path.join(SRC, 'locales/zh.json'), 'utf8'))
    expect(zh.adminNav.tasks).toBe('任务管理')
    expect(zh.adminLayout.panelTitle).toBe('管理面板')
    expect(zh.adminCommon.pointsValue).toBe('{{value}} 积分')
    expect(zh.dashPage.pendingTitle).toBe('普通用户 Task Progress 审批')
    expect(zh.dashPage.verifyApproved).toBe('任务已通过审核')
    expect(zh.adminTasks.stateClosed).toBe('关闭')
    expect(zh.adminRewards.expired).toBe('已过期')
    expect(zh.adminRewards.floorPriceLabel).toBe('保底单片价：')
  })
})
