// 商品/评价卡片的**占位图**常量。
// 历史（P6-MISC-FIX ⑤）：原引用 `/placeholder.jpg`（仓库无该资源 ⇒ dev 回 text/html / prod 404）
//   改为内联 SVG data-URI（不发请求、任何环境不会 404）。
// 媒体单前端阶段 A（2026-10-19）：占位资产定稿 = 机械鱼插画 WebP（320×320，12,616 B，
//   sha256 df33258e…74ec，Kevin 拍板 320px q25 档）⇒ 改走 Vite 静态资产 import（同 images/*.svg 体例）。
import placeholderItemWebp from '../images/placeholder-item.webp'

export const PLACEHOLDER_IMAGE = placeholderItemWebp

export default PLACEHOLDER_IMAGE
