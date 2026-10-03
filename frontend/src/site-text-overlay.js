// ============================================================================
// P9①（`route-layer.spec` v2.12 §27.2 · `data-layer.spec` v0.19 §30.2）：
//   角色文案 + 站点标语 **覆盖层** 的前端取数 / 合并（覆盖值优先）。
// ----------------------------------------------------------------------------
// · 读口 = 公开 `GET /api/role-names`（**无鉴权**）；响应带 `updated_at`；
//   前端在**应用初始化** + **语言切换**时取覆盖层，与 i18n resources **合并（覆盖值优先）**。
// · **不本地持久缓存**（只在内存 i18n resources 内合并）；**读取失败 ⇒ fail-closed 回落 locale 基值**
//   （**绝不空串**）。
// ============================================================================
import { fetchApiJson } from './auth'

/** 四语闭集（与后端 `OVERLAY_LANGS` 同序）。 */
export const OVERLAY_LANGS = ['zh', 'en', 'hk', 'vn']
/** 四角色键（与后端 `ROLE_NAME_FIELDS` 同序）。 */
export const ROLE_NAME_KEYS = ['poster', 'worker', 'seller', 'buyer']
/** 站点标语三键（与后端 `SITE_TEXT_FIELDS` 同序）。 */
export const SITE_TEXT_KEYS = ['siteTitle', 'siteSlogan', 'slogan']

const textOf = (value) => (typeof value === 'string' && value.trim().length > 0 ? value : null)

/**
 * 取覆盖层（公开读口 · 无鉴权）。失败（网络 / 非 2xx / 形状非法）⇒ **`null`** ⇒ 调用方回落 locale 基值。
 * @returns {Promise<{role_names?: object|null, site_text_overrides?: object|null, updated_at?: string|null}|null>}
 */
export const fetchSiteTextOverlay = async () => {
  if (typeof fetch !== 'function') return null
  try {
    const data = await fetchApiJson('/api/role-names')
    return data && typeof data === 'object' ? data : null
  } catch (error) {
    // fail-closed：读不到覆盖层 ⇒ 回落 locale 基值（绝不空串 / 绝不安卓默认覆盖）。
    return null
  }
}

/**
 * 覆盖层 → 按语言的 i18n 补丁（**覆盖值优先**）。
 * 空串 / 缺语 / 非法形状一律**不入补丁** ⇒ 该键保留 locale 基值（缺语 fail-closed）。
 */
export const buildOverlayPatch = (overlay) => {
  const patch = {}
  if (!overlay || typeof overlay !== 'object') return patch
  const roleNames = overlay.role_names
  const siteText = overlay.site_text_overrides
  for (const lang of OVERLAY_LANGS) {
    const entry = {}
    if (roleNames && typeof roleNames === 'object') {
      const bucket = {}
      for (const role of ROLE_NAME_KEYS) {
        const text = textOf(roleNames[role] && roleNames[role][lang])
        if (text) bucket[role] = text
      }
      if (Object.keys(bucket).length) entry.roleNames = bucket
    }
    if (siteText && typeof siteText === 'object') {
      for (const key of SITE_TEXT_KEYS) {
        const text = textOf(siteText[key] && siteText[key][lang])
        if (text) entry[key] = text
      }
    }
    if (Object.keys(entry).length) patch[lang] = entry
  }
  return patch
}

/**
 * 把覆盖层补丁合并进 i18n resources（`deep=true, overwrite=true` ⇒ 覆盖值 > locale）。
 * **不落任何本地持久缓存**。返回被合并的语言数。
 */
export const applySiteTextOverlay = (i18nInstance, overlay) => {
  const patch = buildOverlayPatch(overlay)
  if (!i18nInstance || typeof i18nInstance.addResourceBundle !== 'function') return 0
  let applied = 0
  for (const [lang, resources] of Object.entries(patch)) {
    i18nInstance.addResourceBundle(lang, 'translation', resources, true, true)
    applied += 1
  }
  return applied
}

/**
 * `document.title` 组合（品牌｜标语）—— 与原「品牌名｜标语」复合串观感一致。
 * 标语缺 / 空 ⇒ 仅品牌名（绝不产出前导分隔符或空串）。
 */
export const composeDocumentTitle = (brand, slogan) => {
  const safeBrand = textOf(brand) || ''
  const safeSlogan = textOf(slogan)
  return safeSlogan ? `${safeBrand}｜${safeSlogan}` : safeBrand
}
