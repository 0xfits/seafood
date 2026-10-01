// P6-MISC-FIX ⑤：商品/评价卡片的**占位图内联**常量。
// 真因（现取）：引用 `/placeholder.jpg` 但仓库 `frontend/public/` 下**无任何 placeholder 资源**
//   ⇒ dev（vite，SPA 回落）对图片请求回 `text/html`（实测 content-type=text/html, len=4816）
//   ⇒ `<img>` 解码失败（naturalWidth=0）；prod（nginx/vercel 无回落）则为 404。
// 修法：不再发请求，直接内联 data-URI（任何环境都不会 404）。
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">'
  + '<rect width="400" height="300" fill="#e5e7eb"/>'
  + '<circle cx="140" cy="104" r="20" fill="#cbd5e1"/>'
  + '<path d="M40 248l86-86 62 62 52-44 120 68z" fill="#cbd5e1"/></svg>'

export const PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(SVG)}`

export default PLACEHOLDER_IMAGE
