// ============================================================================
// 商品 id → 站内链接段（统一构造器，route-layer.spec §49.16 · data §40.12 · 2026-10-20）
//
// 口径（写死）：
//   · **规范形** = 读口加性键 `item_code`（7 位码，`char(7)`）⇒ 页面地址 `/item/<itemCode>`；
//   · 码**缺失**（旧读口 / 收藏行这类不含该键的面 / 旧夹具）⇒ **回落数字 `listing_id`（或 `bID`）**，
//     旧数字链接仍可打开（服务端 `GET /api/prize/:ref` 双形态：纯数字按 id、其余按码）；
//   · 两者都无 ⇒ `null`（调用方据此不渲染链接，**绝不拼 `/item/null`**）。
//
// ★ 只在「生成链接 / 展示」处使用；**写口与业务口（收藏 / 会话 / 购买 / 编辑 PATCH）一律用数字
//   `listing_id`** —— 那些后端口只认数字（只有 `GET /api/prize/:ref` 是双形态）。
// ============================================================================

/** `item_code` 优先、缺失回落数字 id 的链接段（string / null）。 */
export const itemLinkId = (row) => {
  const code = row && row.item_code != null ? String(row.item_code).trim() : ''
  if (code) return code
  const id = row ? (row.listing_id ?? row.bID ?? row.id ?? null) : null
  return id == null || id === '' ? null : String(id)
}

/** 数字 `listing_id`（写口 / 业务口专用；取不到回落 `bID`，再不行 `null`）。 */
export const itemNumericId = (row) => {
  const id = row ? (row.listing_id ?? row.bID ?? null) : null
  return id == null || id === '' ? null : String(id)
}
