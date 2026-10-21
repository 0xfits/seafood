// ============================================================================
// 首页「热门任务」视图模型（纯函数层：零 React / 零网络，单测直打）
// ----------------------------------------------------------------------------
// 口径（Kevin 2026-10-21 派单 · 前端半 · **纯真数据**）：
//   · 版块卡 = **读口行的一一映射**，最多 5 张；「第一轮」task 为**主卡**，
//     不在首位 ⇒ 排到第一。**零 mock / 零补位**：<5 行就 <5 张卡，0 行 ⇒ `[]`
//     （渲染层走空态，版块不再造卡）。
//   · 可见性 = 与 `/campaign` 列表（`GET /api/campaign/all` 的嵌套 task 面）
//     **同一谓词**：`task.status === 'active'` ∧ 所属活动 active（活动面由读口保证）。
//     守卫收在 `isCampaignListedTask`（唯一真源，campaign-util 导出），首页与活动卡
//     共用它 ⇒ 两处看到的是同一批任务，不会出现「首页有、/campaign 没有」的行。
//   · 主卡识别 = `title` 去首尾空白后逐字等于 `MAIN_TASK_TITLE`（'第一轮'）。
//   · 项目头像两形态：`project_avatar_url` 在场 ⇒ 圆形图；缺席 ⇒ 项目名首字 +
//     `--sf-thumb-N` 渐变兜底（N = 项目名 hash，1..10；**零新色值**：十档全部为既有主题 token，
//     日/夜两档各自成立）。
// ============================================================================
import { isCampaignListedTask } from './pages/campaign/campaign-util'

/** 版块卡位上限（一行最多 5 张；**不是**补位目标 —— 数据不足不补）。 */
export const HOME_CAMPAIGN_CARD_SLOTS = 5
/** 主卡标题（逐字匹配，trim 后比较）。 */
export const MAIN_TASK_TITLE = '第一轮'
/** 头像兜底渐变档数 = `--sf-thumb-1 … --sf-thumb-10`（theme/tokens.js 既有键）。 */
export const HOME_AVATAR_TONE_COUNT = 10

const textOf = (value) => {
  const raw = String(value ?? '').trim()
  return raw
}

/**
 * 项目名 ⇒ 头像兜底档位（1..10）。逐字符码点和：稳定、跨端一致、对任意语言字符都分布均匀。
 * 空名 ⇒ 恒 1（渲染层对空项目名本就回落占位符）。
 */
export const avatarToneOf = (projectTitle) => {
  const raw = textOf(projectTitle)
  if (!raw) return 1
  let sum = 0
  for (let i = 0; i < raw.length; i += 1) sum += raw.charCodeAt(i)
  return (sum % HOME_AVATAR_TONE_COUNT) + 1
}

/**
 * 读口行 ⇒ 卡片视图模型（缺字段给空值兜底；渲染层按空值**整行不渲染**，不渲染残行）。
 * 数字字段统一走 Number（坏值 ⇒ 0 / null），金额保持字符串原样（防大数精度丢失，同 balances-api）。
 */
export const normalizeHomeCampaignRow = (row) => ({
  taskId: row?.task_id ?? null,
  campaignId: row?.campaign_id ?? null,
  title: textOf(row?.title),
  status: textOf(row?.status),
  joinedCount: Number(row?.joined_count ?? 0) || 0,
  joinedTarget: row?.joined_target ?? null,
  rewardPrimary: row?.reward_amount_primary ?? null,
  rewardSecondaryAmount: row?.reward_amount_secondary ?? null,
  rewardSecondaryCid: row?.reward_cid_secondary ?? null,
  campaignTitle: textOf(row?.campaign_title),
  projectTitle: textOf(row?.project_title),
  projectSlug: textOf(row?.project_slug),
  projectAvatarUrl: textOf(row?.project_avatar_url),
})

/**
 * 读口行集 ⇒ 首页卡片（**纯映射，唯一装配点**）：
 *   ① 逐行归一，丢可见性外的行（`isCampaignListedTask`，与 `/campaign` 同一谓词）；
 *   ② `第一轮` 不在首位 ⇒ 前置到第一（其余行的相对顺序不变）；
 *   ③ 最多取 `HOME_CAMPAIGN_CARD_SLOTS` 张。
 * 无数据 ⇒ `[]`（**绝不造卡**；渲染层显示空态）。返回行恒带 `isMain` 渲染旗标。
 */
export const buildHomeCampaignCards = (rows) => {
  const listed = (Array.isArray(rows) ? rows : [])
    .map(normalizeHomeCampaignRow)
    .filter((row) => isCampaignListedTask(row.status))
  const mainIndex = listed.findIndex((row) => row.title === MAIN_TASK_TITLE)
  // 「不在首位 ⇒ 排到第一」= 抽出主卡前置，**其余卡的相对顺序不变**（不做整体旋转）
  const ordered = mainIndex > 0
    ? [listed[mainIndex], ...listed.filter((_, index) => index !== mainIndex)]
    : listed
  return ordered
    .slice(0, HOME_CAMPAIGN_CARD_SLOTS)
    .map((row) => ({ ...row, isMain: row.title === MAIN_TASK_TITLE }))
}
