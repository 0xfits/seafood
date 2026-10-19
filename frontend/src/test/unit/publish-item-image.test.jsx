/**
 * 商品发布页 · 商品图片（媒体单前端阶段 B · 写侧）
 *
 * 契约（逐条判负）：
 *   ① 渲染出隐藏 `input[type=file][data-sf-m="item-image-input"]`（accept=image/* · multiple）
 *      与可见添加按钮 `[data-sf-m="item-image-add"]`（点按钮 ⇒ 触发 input.click）；
 *   ② 选 2 张 ⇒ 两个缩略图（`item-image-thumb-0/1`），点 `item-image-remove-0` ⇒ 剩 1 张（重编号）；
 *   ③ 任一张上传失败 ⇒ `state.phase = 'error'` 且文案含 `item.imageUploadFail` + 服务端 message，
 *      **publishListing 一次都不调**（失败即取消，绝不产生半截商品）；
 *   ④ 全部上传成功 ⇒ `publishListing` 载荷 `mediaUrls` = 上传返回的 url（顺序一致）；
 *      另测 item-api 把 `mediaUrls` 映射为**线缆键** `media_urls`（真实模块 + fetch 替身）；
 *   ⑤ 无图 ⇒ 照常发布，`mediaUrls = []`。
 *
 * 替身设计：
 *   · `item-api` 走 `importOriginal + 只桩四个面`（fetchCurrencies / publishListing / setListingStatus /
 *     uploadMedia）⇒ 指纹与幂等 tracker 仍跑真代码；
 *   · `t` 返回键名本身 ⇒ 「文案走 i18n 键」顺带被钉住；
 *   · 本地压缩依赖浏览器 API（FileReader / Image / canvas）：本文件用确定性假体替换 ——
 *     FileReader 立即给 data URL、Image 报 1600×900（⇒ 长边 1280 的缩放分支被真实走过）、
 *     canvas.toDataURL 返回 WebP data URL。
 */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const stableT = (key) => key

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: { language: 'zh', resolvedLanguage: 'zh', changeLanguage: vi.fn() },
  }),
}))

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('../../pages/item/item-api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchCurrencies: vi.fn(),
    publishListing: vi.fn(),
    setListingStatus: vi.fn(),
    uploadMedia: vi.fn(),
  }
})

import { useAuth } from '../../auth-context'
import {
  fetchCurrencies,
  publishListing,
  setListingStatus,
  uploadMedia,
} from '../../pages/item/item-api'
import PublishItemPage from '../../pages/item/PublishItemPage'

// ---- 浏览器 API 假体（确定性，不依赖 jsdom canvas 包） ------------------------
class FakeFileReader {
  readAsDataURL(file) {
    this.result = `data:${file.type};base64,QUJD`
    setTimeout(() => { if (this.onload) this.onload() }, 0)
  }
}

class FakeImage {
  constructor() {
    this.naturalWidth = 1600
    this.naturalHeight = 900
  }

  set src(value) {
    this._src = value
    setTimeout(() => { if (this.onload) this.onload() }, 0)
  }

  get src() {
    return this._src
  }
}

let toDataUrlSpy

/** 默认编码结果（WebP 3 字节 / JPEG 3 字节）——逐测例可被 mockImplementation 覆盖，beforeEach 归位。 */
const defaultToDataUrl = (type) => `data:${type === 'image/webp' ? 'image/webp' : 'image/jpeg'};base64,QUJD`

/** 超 1MiB 的编码结果：base64 长 1,398,104 ⇒ 解码 1,048,578 bytes（比硬顶多 2 字节）。 */
const HUGE_BASE64_LENGTH = 4 * 349526
const hugeWebp = () => `data:image/webp;base64,${'A'.repeat(HUGE_BASE64_LENGTH)}`

beforeAll(() => {
  vi.stubGlobal('FileReader', FakeFileReader)
  vi.stubGlobal('Image', FakeImage)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() })
  toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(defaultToDataUrl)
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const renderPage = () => render(
  <MemoryRouter initialEntries={['/item/new']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <PublishItemPage />
  </MemoryRouter>
)

const fileInput = (container) => container.querySelector('[data-sf-m="item-image-input"]')
const addButton = (container) => container.querySelector('[data-sf-m="item-image-add"]')
const thumbs = (container) => Array.from(container.querySelectorAll('[data-sf-m^="item-image-thumb-"]'))
const status = (container) => container.querySelector('[data-sf-m="item-status"]')

const imageFile = (name) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })

/** jsdom 的 `input.files` 只读 ⇒ 先描述符覆盖再派发 change。 */
const pickFiles = (container, files) => {
  const input = fileInput(container)
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

const fillRequired = (container) => {
  fireEvent.change(container.querySelector('[data-sf-m="item-input-title"]'), { target: { value: '测试商品' } })
  fireEvent.change(container.querySelector('[data-sf-m="item-input-price"]'), { target: { value: '7' } })
}

const submit = (container) => fireEvent.click(container.querySelector('[data-sf-m="item-primary"]'))

describe('发布商品页 · 商品图片（选图 / 压缩 / 上传 / 失败即取消）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toDataUrlSpy.mockImplementation(defaultToDataUrl) // 上一条测例可能改过编码结果 ⇒ 每条归位
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    fetchCurrencies.mockResolvedValue([])
    publishListing.mockResolvedValue({})
    setListingStatus.mockResolvedValue({})
  })

  // ---------------- ① 形态：input / add 钩子在位 ----------------
  it('① 渲染文件 input（accept=image/* · multiple）与可见添加按钮，按钮触发 input.click', async () => {
    const { container } = renderPage()

    const input = fileInput(container)
    expect(input).not.toBeNull()
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('type')).toBe('file')
    expect(input.getAttribute('accept')).toBe('image/*')
    expect(input.hasAttribute('multiple')).toBe(true)

    const add = addButton(container)
    expect(add).not.toBeNull()
    expect(add.tagName).toBe('BUTTON')
    expect(add.hasAttribute('disabled')).toBe(false)
    // 可见按钮 = 触发器：点它 ⇒ 原生 input 被点开
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})
    fireEvent.click(add)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  // ---------------- ② 选 2 张 ⇒ 两缩略图；移除生效 ----------------
  it('② 选 2 张 ⇒ 两个缩略图（长边压缩到 1280）；移除第 1 张 ⇒ 剩 1 张', async () => {
    const { container } = renderPage()
    toDataUrlSpy.mockClear()

    pickFiles(container, [imageFile('a.png'), imageFile('b.png')])

    await waitFor(() => expect(thumbs(container).length).toBe(2))
    expect(container.querySelector('[data-sf-m="item-image-thumb-0"]')).not.toBeNull()
    expect(container.querySelector('[data-sf-m="item-image-thumb-1"]')).not.toBeNull()
    // 图片预览 = 压缩后的 data URL（<img> 真挂上）
    expect(thumbs(container).every((node) => node.querySelector('img')?.getAttribute('src')?.startsWith('data:image/'))).toBe(true)
    // 压缩口径：优先 WebP q0.82（假体 1600×900 ⇒ canvas 长边 1280×720）
    expect(toDataUrlSpy).toHaveBeenCalledWith('image/webp', 0.82)

    fireEvent.click(container.querySelector('[data-sf-m="item-image-remove-0"]'))
    await waitFor(() => expect(thumbs(container).length).toBe(1))
    expect(container.querySelector('[data-sf-m="item-image-remove-1"]')).toBeNull()
    // 移除后重编号 ⇒ 唯一残留缩略图 = index 0
    expect(container.querySelector('[data-sf-m="item-image-thumb-0"]')).not.toBeNull()
  })

  // ---------------- ③ 上传失败 ⇒ error 态 + publishListing 未调 ----------------
  it('③ 上传失败 ⇒ 取消发布：error 态（item.imageUploadFail + 服务端 message），publishListing 零调用', async () => {
    uploadMedia.mockRejectedValueOnce(new Error('413 MEDIA_TOO_LARGE'))
    const { container } = renderPage()

    pickFiles(container, [imageFile('a.png'), imageFile('b.png')])
    await waitFor(() => expect(thumbs(container).length).toBe(2))

    fillRequired(container)
    submit(container)

    await waitFor(() => expect(status(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(status(container).textContent).toContain('item.imageUploadFail')
    expect(status(container).textContent).toContain('413 MEDIA_TOO_LARGE')
    // 逐张顺序上传：第一张就失败 ⇒ 不再上传第二张、更不发布
    expect(uploadMedia).toHaveBeenCalledTimes(1)
    expect(publishListing).not.toHaveBeenCalled()
    expect(setListingStatus).not.toHaveBeenCalled()
    // 逐张上传的载荷 = { content_type, data_base64 }（登录闸由 item-api 带 user）
    expect(uploadMedia.mock.calls[0][1]).toEqual({ content_type: 'image/webp', data_base64: 'QUJD' })
    expect(uploadMedia.mock.calls[0][0]).toEqual({ uID: 7, token: 'test' })
  })

  // ---------------- ④ 成功 ⇒ mediaUrls = 两 url ----------------
  it('④ 两张都上传成功 ⇒ publishListing 载荷 mediaUrls = 两个 url（顺序一致）', async () => {
    uploadMedia
      .mockResolvedValueOnce({ url: '/api/media/11', media_id: 11 })
      .mockResolvedValueOnce({ url: '/api/media/12', media_id: 12 })
    const { container } = renderPage()

    pickFiles(container, [imageFile('a.png'), imageFile('b.png')])
    await waitFor(() => expect(thumbs(container).length).toBe(2))

    fillRequired(container)
    submit(container)

    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    const payload = publishListing.mock.calls[0][0]
    expect(payload.mediaUrls).toEqual(['/api/media/11', '/api/media/12'])
    expect(payload.title).toBe('测试商品')
    expect(payload.price).toBe('7')
    expect(uploadMedia).toHaveBeenCalledTimes(2)
    // 发布成功（无 id 回包 ⇒ 停在 ok 态、不跳转）
    await waitFor(() => expect(status(container).getAttribute('data-sf-phase')).toBe('ok'))
  })

  // ---------------- ④b item-api 线缆键 = media_urls ----------------
  it('④b item-api 把 `mediaUrls` 映射为线缆键 `media_urls`（真实模块 + fetch 替身）', async () => {
    const { publishListing: realPublishListing } = await vi.importActual('../../pages/item/item-api')
    const response = {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {} }),
      headers: { get: () => null },
    }
    const previousFetch = globalThis.fetch
    const fetchSpy = vi.fn(async () => response)
    globalThis.fetch = fetchSpy
    try {
      await realPublishListing({
        cid: 1,
        price: '7',
        stock: '1',
        title: 't',
        description: 'd',
        mediaUrls: ['/api/media/11', '/api/media/12'],
        createKey: 'cli:test-key',
        user: null,
      })
    } finally {
      globalThis.fetch = previousFetch
    }
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/listing')
    const body = JSON.parse(options.body)
    expect(body.media_urls).toEqual(['/api/media/11', '/api/media/12'])
  })

  // ---------------- ⑤ 无图 ⇒ mediaUrls = [] 照常发布 ----------------
  it('⑤ 未选图 ⇒ 照常发布，载荷 mediaUrls = []，且不调 uploadMedia', async () => {
    const { container } = renderPage()

    expect(thumbs(container).length).toBe(0)
    fillRequired(container)
    submit(container)

    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(publishListing.mock.calls[0][0].mediaUrls).toEqual([])
    expect(uploadMedia).not.toHaveBeenCalled()
    await waitFor(() => expect(status(container).getAttribute('data-sf-phase')).toBe('ok'))
  })
})

// ============================================================================
// 单张图片硬顶 1MiB（Kevin 2026-10-19）：客户端压缩后 >1,048,576 bytes ⇒
//   ① 逐级降级重编码（质量档 [0.82,0.72,0.62,0.5] × 边长档 [1280,1120,960,832]），命中即收；
//   ② 全档位仍超 ⇒ 该张拒收（`item.imageTooLarge` 提示、不入列；其余已选图片不受影响）；
//   ③ 正常小图路径不变（首档 WebP q0.82、一次编码即收、提示位不出现）。
// 口径同后端 `MEDIA_MAX_BYTES` 与迁移 0051 的 `size_bytes <= 1048576`。
// ============================================================================
describe('发布商品页 · 单张图片 1MiB 硬顶（降级重编 / 拒收）', () => {
  const notice = (container) => container.querySelector('[data-sf-m="item-image-notice"]')

  beforeEach(() => {
    vi.clearAllMocks()
    toDataUrlSpy.mockImplementation(defaultToDataUrl)
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    fetchCurrencies.mockResolvedValue([])
    publishListing.mockResolvedValue({})
    setListingStatus.mockResolvedValue({})
  })

  it('① 首档编码超 1MiB ⇒ 降级重编码直至 ≤1MiB，该张仍入列（不提示）', async () => {
    // 序列：q0.82 ⇒ 1,048,578 bytes（超 2 字节）；q0.72 ⇒ 3 bytes（命中即收）
    toDataUrlSpy
      .mockImplementationOnce(() => hugeWebp())
      .mockImplementation(() => defaultToDataUrl('image/webp'))
    const { container } = renderPage()

    pickFiles(container, [imageFile('big.png')])
    await waitFor(() => expect(thumbs(container).length).toBe(1))

    // 降级链：先降质量（0.82 ⇒ 0.72），未动边长（仍在 1280 档）
    expect(toDataUrlSpy.mock.calls.map(([, q]) => q)).toEqual([0.82, 0.72])
    // 入列的是「命中档」的编码结果（3 bytes ⇒ base64 长 4）
    const src = thumbs(container)[0].querySelector('img').getAttribute('src')
    expect(src).toBe('data:image/webp;base64,QUJD')
    expect(notice(container)).toBeNull()
  })

  it('② 全档位仍超 1MiB ⇒ 该张拒收：提示 item.imageTooLarge、不入列、不调上传；随后选小图照常入列', async () => {
    toDataUrlSpy.mockImplementation(() => hugeWebp())
    const { container } = renderPage()

    pickFiles(container, [imageFile('huge.png')])
    // 4 边长档 × 4 质量档 = 16 次编码后放弃
    await waitFor(() => expect(toDataUrlSpy).toHaveBeenCalledTimes(16))
    // 编码档位交叉穷举（逐档逐值，防「漏档直接拒收」）
    expect(toDataUrlSpy.mock.calls.map(([, q]) => q)).toEqual(Array.from({ length: 4 }, () => [0.82, 0.72, 0.62, 0.5]).flat())

    expect(thumbs(container).length).toBe(0)
    const tip = notice(container)
    expect(tip).not.toBeNull()
    expect(tip.textContent).toBe('item.imageTooLarge')
    expect(tip.getAttribute('role')).toBe('alert')
    // 拒收不动发布链：无图照常发布，uploadMedia 零调用
    fillRequired(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(publishListing.mock.calls[0][0].mediaUrls).toEqual([])
    expect(uploadMedia).not.toHaveBeenCalled()

    // 同一页面随后选一张正常小图 ⇒ 入列；提示清空（其余已选图片 / 后续选择不受影响）
    toDataUrlSpy.mockImplementation(defaultToDataUrl)
    toDataUrlSpy.mockClear()
    pickFiles(container, [imageFile('ok.png')])
    await waitFor(() => expect(thumbs(container).length).toBe(1))
    expect(notice(container)).toBeNull()
    expect(toDataUrlSpy.mock.calls).toEqual([['image/webp', 0.82]])
  })

  it('③ 正常小图：首档 WebP q0.82 一次编码即收，不入降级链、无提示', async () => {
    const { container } = renderPage()

    pickFiles(container, [imageFile('a.png')])
    await waitFor(() => expect(thumbs(container).length).toBe(1))

    expect(toDataUrlSpy.mock.calls).toEqual([['image/webp', 0.82]])
    expect(notice(container)).toBeNull()

    uploadMedia.mockResolvedValueOnce({ url: '/api/media/21' })
    fillRequired(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(uploadMedia.mock.calls[0][1]).toEqual({ content_type: 'image/webp', data_base64: 'QUJD' })
    expect(publishListing.mock.calls[0][0].mediaUrls).toEqual(['/api/media/21'])
  })
})
