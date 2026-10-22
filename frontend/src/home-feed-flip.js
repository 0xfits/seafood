// ============================================================================
// 首页商品网格的 FLIP 位移动画（2026-10-22 · 切换【推荐】/【新发】时表现「位置变化」）
// ----------------------------------------------------------------------------
// 口径：
//   · **FLIP**：切换前记录每张卡的第一帧矩形（`captureFeedCardRects`）→ 重排 →
//     逐卡 invert（先平移到旧位置）+ play（下一帧回到 0，带 transition）；
//   · 时长 **≤ 300ms**（`FLIP_DURATION_MS = 260`），缓动与既有动效同族；
//   · **只动 transform**：不碰 `height` / `padding` / 网格模板 ⇒ 卡高恒 392、栅格行高不变；
//   · `prefers-reduced-motion: reduce` ⇒ **瞬时降级**：零 transition、零 transform、
//     零动画属性（不做「0ms 动画」这种伪降级）；
//   · 用完即清（`transition` / `transform` / `willChange` 全部还原）——动画不得成为常驻内联样式。
//
// 节点身份：FLIP 以 **DOM 节点对象** 作键（不是 bID / href）—— React 用稳定 key 重排时
// 复用同一批节点，因此「同一节点的新旧矩形」天然配对，不依赖任何额外 data 属性。
// ============================================================================

/** 动画时长（ms）。上限口径 300ms ⇒ 260 给清理留余量。 */
export const FLIP_DURATION_MS = 260
/** 缓动（与站内既有位移动效同族：先快后缓）。 */
export const FLIP_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)'
/** 位移阈值（px）：亚像素抖动不算「位置变化」，避免无意义动画。 */
const FLIP_MIN_DELTA_PX = 0.5

const mediaWindow = (win) => (win && typeof win.matchMedia === 'function' ? win : null)

/**
 * 用户是否要求减弱动效。
 * @param {Window|null} win
 * @returns {boolean}
 */
export const prefersReducedMotion = (win = typeof window === 'undefined' ? null : window) => {
  const target = mediaWindow(win)
  if (!target) return false
  try {
    return Boolean(target.matchMedia('(prefers-reduced-motion: reduce)')?.matches)
  } catch {
    return false
  }
}

/**
 * 记录容器内每个子节点的「第一帧」位置（FLIP 的 F）。
 * @param {Element|null} container
 * @returns {Map<Element, {x:number,y:number}>}
 */
export const captureFeedCardRects = (container) => {
  const rects = new Map()
  if (!container || typeof container.children === 'undefined') return rects
  for (const node of container.children) {
    const rect = node.getBoundingClientRect()
    rects.set(node, { x: rect.left, y: rect.top })
  }
  return rects
}

/**
 * 播放 FLIP（invert + play）。返回**被动画的节点数组**（降级 / 无位移 ⇒ 空数组）。
 * @param {Element|null} container 网格容器
 * @param {Map<Element, {x:number,y:number}>|null} before `captureFeedCardRects` 的结果
 * @param {{duration?: number, reduced?: boolean, win?: Window}} [options]
 * @returns {Element[]}
 */
export const playFeedFlip = (container, before, options = {}) => {
  const animated = []
  if (!container || !before || before.size === 0) return animated
  if (typeof container.children === 'undefined') return animated

  const win = options.win ?? (typeof window === 'undefined' ? null : window)
  const reduced = options.reduced ?? prefersReducedMotion(win)
  // ★ 降级：瞬时完成 —— 不写 transition / transform（探针与单测都断言「零动画属性」）
  if (reduced) return animated

  const duration = Number.isFinite(options.duration) ? options.duration : FLIP_DURATION_MS
  const moves = []
  for (const node of container.children) {
    const prev = before.get(node)
    if (!prev) continue // 新节点（append 进来的行）不参与本次位移
    const now = node.getBoundingClientRect()
    const dx = prev.x - now.left
    const dy = prev.y - now.top
    if (Math.abs(dx) < FLIP_MIN_DELTA_PX && Math.abs(dy) < FLIP_MIN_DELTA_PX) continue
    moves.push({ node, dx, dy })
  }
  if (moves.length === 0) return animated

  container.setAttribute('data-sf-flip', 'running')

  for (const { node, dx, dy } of moves) {
    node.style.transition = 'none'
    node.style.transform = `translate(${dx}px, ${dy}px)`
    node.style.willChange = 'transform'
    node.setAttribute('data-sf-flip-move', '1')
    animated.push(node)
  }

  // 强制一次回流：让「invert 帧」先落，下一帧再改 transform 才会产生动画（否则被合并 ⇒ 瞬移）
  void container.getBoundingClientRect()

  const raf = typeof win?.requestAnimationFrame === 'function'
    ? win.requestAnimationFrame.bind(win)
    : (cb) => setTimeout(cb, 0)
  const later = typeof win?.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout

  raf(() => {
    for (const { node } of moves) {
      node.style.transition = `transform ${duration}ms ${FLIP_EASING}`
      node.style.transform = ''
    }
    later(() => {
      for (const { node } of moves) {
        node.style.transition = ''
        node.style.willChange = ''
        node.removeAttribute('data-sf-flip-move')
      }
      container.removeAttribute('data-sf-flip')
    }, duration + 60)
  })

  return animated
}
