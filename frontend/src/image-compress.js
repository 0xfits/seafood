// ============================================================================
// 客户端图片压缩（单一真源 · 发布页与项目头像共用）
// ----------------------------------------------------------------------------
// 口径（Kevin 2026-10-19 起沿用，2026-10-22 抽成共享模块）：
//   · canvas 长边 ≤1280；
//   · 优先 WebP q0.82（浏览器不支持 WebP ⇒ 静默回落 PNG 会被下面探测捕获 ⇒ 整张改走 JPEG q0.85）；
//   · 编码后**必须 ≤1MiB = 1,048,576 bytes**（与后端 MEDIA_MAX_BYTES / 迁移 0051 的 size_bytes CHECK
//     三层同口径）⇒ 超限按「质量档 → 边长档」逐级降级重编码，**全部档位仍超 ⇒ 返回 `null`**
//     （由调用方拒收并提示，绝不把超大 payload 送上传口）。
//
// ★ 本文件是**唯一实现**：`pages/item/PublishItemPage`（商品图片 ≤4 张）与
//   `pages/project/ProjectAvatar`（项目头像单张）都 import 这里的 `compressImage`，
//   禁在页面里复制一份（两份实现会漂成两套体积口径）。
// ============================================================================

/** 编码后体积硬顶（1MiB，与后端 MEDIA_MAX_BYTES 同值）。 */
export const MAX_IMAGE_BYTES = 1 * 1024 * 1024
/** 初档 = WebP q0.82，其后逐级降质。 */
export const QUALITY_LADDER = [0.82, 0.72, 0.62, 0.5]
/** WebP 不可用时的 JPEG 档（首档 q0.85，其后同质量档）。 */
export const JPEG_QUALITY_LADDER = [0.85, 0.72, 0.62, 0.5]
/** 降质仍超 ⇒ 再逐级缩长边（与质量档交叉试，命中即收）。 */
export const EDGE_LADDER = [1280, 1120, 960, 832]

/** base64 文本 ⇒ 解码后字节数（不含 `data:` 前缀；按 RFC 4648 padding 精确折算，无需 atob）。 */
export const base64ByteLength = (dataBase64) => {
  if (!dataBase64) return 0
  const padding = dataBase64.endsWith('==') ? 2 : dataBase64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((dataBase64.length * 3) / 4) - padding)
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('read failed'))
  reader.readAsDataURL(file)
})

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('decode failed'))
  image.src = src
})

/**
 * 单张压缩 ⇒ `{ contentType, dataBase64, preview }`（`preview` = 压缩后的 data URL，可直接做缩略图）。
 * 体积硬顶：编码字节数必须 ≤`MAX_IMAGE_BYTES`；超限逐级降级重编码（质量档 × 4 边长档交叉），
 * 命中即收；**全部档位仍超 ⇒ 返回 `null`**（由调用方拒收该张并提示）。
 */
export const compressImage = async (file) => {
  const raw = await readFileAsDataUrl(file)
  const image = await loadImageElement(raw)
  const width = image.naturalWidth || image.width || 0
  const height = image.naturalHeight || image.height || 0
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas unavailable')
  // 优先 WebP；浏览器不支持时 `toDataURL('image/webp')` 会静默回落 PNG ⇒ 首个编码结果一探即知，
  // 命中非 WebP 则整张改走 JPEG（q0.85 起档），后续档位都以实际 mime 为准。
  let contentType = 'image/webp'
  for (const edge of EDGE_LADDER) {
    const scale = width && height ? Math.min(1, edge / Math.max(width, height)) : 1
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const qualityLadder = () => (contentType === 'image/webp' ? QUALITY_LADDER : JPEG_QUALITY_LADDER)
    let qualityIndex = 0
    while (qualityIndex < qualityLadder().length) {
      const dataUrl = canvas.toDataURL(contentType, qualityLadder()[qualityIndex])
      if (contentType === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
        contentType = 'image/jpeg'
        continue // 质量档换表、下标归 0（mime 只切一次：切后本分支不再成立）
      }
      const comma = dataUrl.indexOf(',')
      if (comma < 0) throw new Error('encode failed')
      const dataBase64 = dataUrl.slice(comma + 1)
      if (base64ByteLength(dataBase64) <= MAX_IMAGE_BYTES) {
        return { contentType, dataBase64, preview: dataUrl }
      }
      qualityIndex += 1
    }
  }
  return null
}

export default compressImage
