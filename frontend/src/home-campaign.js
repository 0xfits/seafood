// ============================================================================
// 首页「热门任务」视图模型（纯函数层：零 React / 零网络，单测直打）
// ----------------------------------------------------------------------------
// 口径（Kevin 2026-10-21 派单 · 前端半）：
//   · 版块恒 **5 张等宽卡**：真数据优先、mock 补足 —— 「第一轮」task 为**主卡**，
//     不在首位 ⇒ 排到第一；真数据 >1 条时优先真卡、mock 补足 5；空数据 ⇒ 5 张全 mock（版块不塌）。
//   · 主卡识别 = `title` 去首尾空白后逐字等于 `MAIN_TASK_TITLE`（'第一轮'）。
//   · mock 卡 = **静态常量**（假项目名 / 假活动名 / 头像 = 项目名首字彩色兜底），
//     不带 `campaign_id` ⇒ 渲染层据此**不渲染链接**（仅展示不可点）。
//   · 项目头像两形态：`project_avatar_url` 在场 ⇒ 圆形图；缺席 ⇒ 项目名首字 +
//     `--sf-thumb-N` 渐变兜底（N = 项目名 hash，1..10；**零新色值**：十档全部为既有主题 token，
//     日/夜两档各自成立）。
// ============================================================================

/** 版块卡位（排满一行）。 */
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
 * mock 补位卡（**静态常量**，仅展示不可点 ⇒ 一律不带 `campaign_id`）。
 * 状态/进度/奖励字段与真卡同形 ⇒ 两类卡共用同一渲染路径，版块在空数据态也不塌。
 * ★ 池内 5 张：常规形态下真数据 ≥1 ⇒ 最多只需补 4 张（派单「4 个假 task」）；
 *   空数据 ⇒ 5 张全用（派单「空 ⇒ 5 张全 mock」）—— 同一常量池同时满足两臂。
 */
export const MOCK_HOME_CAMPAIGN_CARDS = [
  {
    taskId: null, campaignId: null, title: '每日签到打卡', status: 'active',
    joinedCount: 128, joinedTarget: 500,
    rewardPrimary: '12', rewardSecondaryAmount: '50', rewardSecondaryCid: '2',
    campaignTitle: '新赛季社区任务', projectTitle: '星链楼市', projectSlug: '', projectAvatarUrl: '',
  },
  {
    taskId: null, campaignId: null, title: '邀请 3 位好友注册', status: 'active',
    joinedCount: 89, joinedTarget: 200,
    rewardPrimary: '30', rewardSecondaryAmount: null, rewardSecondaryCid: null,
    campaignTitle: '邀新有好礼', projectTitle: '喵喵矿场', projectSlug: '', projectAvatarUrl: '',
  },
  {
    taskId: null, campaignId: null, title: '完成首笔质押', status: 'active',
    joinedCount: 241, joinedTarget: 1000,
    rewardPrimary: '88', rewardSecondaryAmount: '200', rewardSecondaryCid: '3',
    campaignTitle: '质押挑战赛', projectTitle: '深海流动性', projectSlug: '', projectAvatarUrl: '',
  },
  {
    taskId: null, campaignId: null, title: '晒单分享赢奖励', status: 'ended',
    joinedCount: 512, joinedTarget: 512,
    rewardPrimary: '6', rewardSecondaryAmount: null, rewardSecondaryCid: null,
    campaignTitle: '上周回顾', projectTitle: '云上集市', projectSlug: '', projectAvatarUrl: '',
  },
  {
    taskId: null, campaignId: null, title: '回答新手问卷', status: 'active',
    joinedCount: 73, joinedTarget: 150,
    rewardPrimary: '4', rewardSecondaryAmount: '20', rewardSecondaryCid: '2',
    campaignTitle: '新人引导季', projectTitle: '贝壳学院', projectSlug: '', projectAvatarUrl: '',
  },
]

/**
 * 读口行集 ⇒ 版块 5 张卡（**唯一装配点**）：
 *   ① 真行归一；② `第一轮` 不在首位 ⇒ 旋转到第一（其余真行相对顺序不变）；
 *   ③ 真行最多取 5；④ 剩余卡位由静态 mock 依序补齐（真数据 >5 ⇒ 零 mock）。
 * 返回行恒带 `isMock` / `isMain` 两个渲染旗标。
 */
export const buildHomeCampaignCards = (rows) => {
  const real = (Array.isArray(rows) ? rows : []).map(normalizeHomeCampaignRow)
  const mainIndex = real.findIndex((row) => row.title === MAIN_TASK_TITLE)
  // 「不在首位 ⇒ 排到第一」= 抽出主卡前置，**其余真卡的相对顺序不变**（不做整体旋转）
  const ordered = mainIndex > 0
    ? [real[mainIndex], ...real.filter((_, index) => index !== mainIndex)]
    : real
  const picked = ordered
    .slice(0, HOME_CAMPAIGN_CARD_SLOTS)
    .map((row) => ({ ...row, isMock: false, isMain: row.title === MAIN_TASK_TITLE }))
  const fill = MOCK_HOME_CAMPAIGN_CARDS
    .slice(0, Math.max(0, HOME_CAMPAIGN_CARD_SLOTS - picked.length))
    .map((row) => ({ ...row, isMock: true, isMain: false }))
  return [...picked, ...fill]
}
