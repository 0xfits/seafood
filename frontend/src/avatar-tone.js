// ============================================================================
// 头像兜底（首字 + 彩底档位）· 唯一真源（纯函数：零 React / 零网络，单测直打）
// ----------------------------------------------------------------------------
// 三处共用同一份实现（不复制）：
//   · 首页热门任务卡 `components/campaign/HomeCampaignCard.jsx`（tone）
//   · 项目页头头像 `pages/project/ProjectAvatar.jsx`（initial）
//   · /wage 项目卡头 `pages/wage/WagePage.jsx`（tone + initial）
// `home-campaign.js` 只做 re-export（既有 import 面不变，行为逐字不变）。
//
// 口径：
//   · 档位 N = 名字逐字符码点和 % 10 + 1 ⇒ `--sf-thumb-N` 渐变（`theme/tokens.js` 既有十档，
//     **零新色值**：日/夜两档各自成立）；同一名字恒同一档（稳定、跨端一致、对任意语言均匀）；
//   · 首字 = 名字首个**码点**（`Array.from` ⇒ 代理对/emoji 不被截半个字符）；空名 ⇒ '?'。
// ============================================================================

/** 头像兜底渐变档数 = `--sf-thumb-1 … --sf-thumb-10`（theme/tokens.js 既有键）。 */
export const AVATAR_TONE_COUNT = 10

const textOf = (value) => String(value ?? '').trim()

/**
 * 项目名 ⇒ 头像兜底档位（1..10）。逐字符码点和：稳定、跨端一致、对任意语言字符都分布均匀。
 * 空名 ⇒ 恒 1（渲染层对空项目名本就回落占位符）。
 */
export const avatarToneOf = (projectTitle) => {
  const raw = textOf(projectTitle)
  if (!raw) return 1
  let sum = 0
  for (let i = 0; i < raw.length; i += 1) sum += raw.charCodeAt(i)
  return (sum % AVATAR_TONE_COUNT) + 1
}

/** 项目名 ⇒ 头像首字（首个码点；空名 ⇒ '?'）。 */
export const avatarInitialOf = (projectTitle) => Array.from(textOf(projectTitle))[0] || '?'
