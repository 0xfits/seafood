// 响应式断点单一真源（web 横屏 / 手机竖屏两套骨架）。
//
// 口径说明（不是从 style-preview.html 提取的色值/形状值，属断点层自定义，如实登记）：
// - 手机档上界 767px：比选页的手机壳宽度 377px（docs/design/style-preview.html:74 `.device{width:377px}`）
//   落在该档内，是「竖屏一列 + 底部 tab」的判据。
// - 宽屏档下界 1024px：比选页的多栏骨架 max-width 1440px / 侧栏 320px / 四列信息流
//   （style-preview.html:85,112,114,115）在 ≥1024px 才排得下。
// 两档之间（768–1023px）走「宽屏同一套 DOM，栅格降为 2 列」的过渡，不新增骨架。
export const BREAKPOINTS = {
  phonePortraitMax: 767,
  wideMin: 1024,
}

export const MEDIA_QUERIES = {
  phonePortrait: `(max-width: ${BREAKPOINTS.phonePortraitMax}px)`,
  wide: `(min-width: ${BREAKPOINTS.wideMin}px)`,
}

export const cssPx = (n) => `${n}px`
