import { describe, expect, it } from 'vitest'

import {
  buildLangPath,
  canonicalLangPath,
  getLanguageFromUrl,
  stripLangPrefix,
  SUPPORTED_LANGS,
} from '../../utils'

// 覆盖面：语言根、双语言前缀、zh 前缀、子路径、尾斜杠、无语言前缀的管理/登录路径
const ROUTED_PATHS = [
  '/',
  '/vn',
  '/hk',
  '/hk/vn',
  '/en/en',
  '/zh',
  '/zh/reward',
  '/reward',
  '/vn/reward',
  '/vn/reward/',
  '/dashboard',
  '/dashboard/users',
]

const LANGUAGE_CASES = [
  'zh',
  'vn',
  'hk',
  'hk',
  'en',
  'zh',
  'zh',
  'zh',
  'vn',
  'vn',
  'zh',
  'zh',
]

const STRIP_CASES = [
  '',
  '',
  '',
  '',
  '',
  '',
  '/reward',
  '/reward',
  '/reward',
  '/reward/',
  '/dashboard',
  '/dashboard/users',
]

const CANONICAL_CASES = [
  '/',
  '/vn',
  '/hk',
  '/hk',
  '/en',
  '/',
  '/reward',
  '/reward',
  '/vn/reward',
  '/vn/reward',
  '/dashboard',
  '/dashboard/users',
]

describe('语言前缀工具（utils 单一真源）', () => {
  it('SUPPORTED_LANGS 是含 zh 的四语白名单', () => {
    expect(SUPPORTED_LANGS).toEqual(['zh', 'en', 'hk', 'vn'])
  })
})

describe('getLanguageFromUrl', () => {
  it('只识别首位语言段，含 zh，其余默认 zh', () => {
    expect(ROUTED_PATHS.map(getLanguageFromUrl)).toEqual(LANGUAGE_CASES)
  })

  it('语言词出现在非首位时不当作语言前缀', () => {
    expect(getLanguageFromUrl('/reward/en')).toBe('zh')
    expect(getLanguageFromUrl('/dashboard/vn')).toBe('zh')
    expect(getLanguageFromUrl('/topics/hk')).toBe('zh')
  })

  it('空值回退到 zh', () => {
    expect(getLanguageFromUrl('')).toBe('zh')
    expect(getLanguageFromUrl(undefined)).toBe('zh')
  })
})

describe('stripLangPrefix', () => {
  it('剥离所有前导语言段，返回剩余路径', () => {
    expect(ROUTED_PATHS.map(stripLangPrefix)).toEqual(STRIP_CASES)
  })

  it('多个语言段会被一次剥掉', () => {
    expect(stripLangPrefix('/hk/vn/reward')).toBe('/reward')
    expect(stripLangPrefix('/en/en')).toBe('')
  })
})

describe('buildLangPath', () => {
  it('裁定口径给出的五个样例', () => {
    expect(buildLangPath('/vn', 'hk')).toBe('/hk')
    expect(buildLangPath('/vn/reward', 'hk')).toBe('/hk/reward')
    expect(buildLangPath('/hk', 'zh')).toBe('/')
    expect(buildLangPath('/', 'vn')).toBe('/vn')
    expect(buildLangPath('/reward', 'en')).toBe('/en/reward')
  })

  it('先剥离再按目标语言重建，不产生双重前缀与尾斜杠', () => {
    expect(buildLangPath('/hk/vn', 'hk')).toBe('/hk')
    expect(buildLangPath('/en/en', 'vn')).toBe('/vn')
    expect(buildLangPath('/vn/reward/', 'hk')).toBe('/hk/reward')
    expect(buildLangPath('/zh/reward', 'vn')).toBe('/vn/reward')
    expect(buildLangPath('/vn', 'zh')).toBe('/')
    expect(buildLangPath('/hk', 'hk')).toBe('/hk')
  })

  it('语言根不带尾斜杠', () => {
    expect(buildLangPath('/hk/', 'hk')).toBe('/hk')
    expect(buildLangPath('/en/', 'en')).toBe('/en')
    expect(buildLangPath('/', 'zh')).toBe('/')
  })

  it('每个路径 × 每个目标语言的重建结果', () => {
    const expected = {
      '/': { zh: '/', en: '/en', hk: '/hk', vn: '/vn' },
      '/vn': { zh: '/', en: '/en', hk: '/hk', vn: '/vn' },
      '/hk': { zh: '/', en: '/en', hk: '/hk', vn: '/vn' },
      '/hk/vn': { zh: '/', en: '/en', hk: '/hk', vn: '/vn' },
      '/en/en': { zh: '/', en: '/en', hk: '/hk', vn: '/vn' },
      '/zh': { zh: '/', en: '/en', hk: '/hk', vn: '/vn' },
      '/zh/reward': { zh: '/reward', en: '/en/reward', hk: '/hk/reward', vn: '/vn/reward' },
      '/reward': { zh: '/reward', en: '/en/reward', hk: '/hk/reward', vn: '/vn/reward' },
      '/vn/reward': { zh: '/reward', en: '/en/reward', hk: '/hk/reward', vn: '/vn/reward' },
      '/vn/reward/': { zh: '/reward', en: '/en/reward', hk: '/hk/reward', vn: '/vn/reward' },
      '/dashboard': { zh: '/dashboard', en: '/en/dashboard', hk: '/hk/dashboard', vn: '/vn/dashboard' },
      '/dashboard/users': {
        zh: '/dashboard/users',
        en: '/en/dashboard/users',
        hk: '/hk/dashboard/users',
        vn: '/vn/dashboard/users',
      },
    }

    Object.entries(expected).forEach(([pathname, byLang]) => {
      Object.entries(byLang).forEach(([lang, result]) => {
        expect(buildLangPath(pathname, lang), `${pathname} -> ${lang}`).toBe(result)
      })
    })
  })
})

describe('canonicalLangPath', () => {
  it('返回规范路径用于判定是否重定向', () => {
    expect(ROUTED_PATHS.map(canonicalLangPath)).toEqual(CANONICAL_CASES)
  })

  it('裁定口径给出的六个样例', () => {
    expect(canonicalLangPath('/hk/vn')).toBe('/hk')
    expect(canonicalLangPath('/en/en')).toBe('/en')
    expect(canonicalLangPath('/zh/reward')).toBe('/reward')
    expect(canonicalLangPath('/zh')).toBe('/')
    expect(canonicalLangPath('/en/')).toBe('/en')
    expect(canonicalLangPath('/vn/reward/')).toBe('/vn/reward')
  })

  it('是幂等的，避免重定向死循环', () => {
    ROUTED_PATHS.concat(['/en/', '/hk/vn/reward', '/zh/', '/vn//']).forEach((pathname) => {
      const once = canonicalLangPath(pathname)
      expect(canonicalLangPath(once), `${pathname} -> ${once}`).toBe(once)
    })
  })

  it('无语言前缀的路由不会被加前缀', () => {
    expect(canonicalLangPath('/dashboard')).toBe('/dashboard')
    expect(canonicalLangPath('/dashboard/users')).toBe('/dashboard/users')
    expect(canonicalLangPath('/login')).toBe('/login')
    expect(canonicalLangPath('/register')).toBe('/register')
  })

  it('折叠重复斜杠（中段多余斜杠也要自愈，否则规范化后与自身相等而不触发重定向）', () => {
    expect(canonicalLangPath('/vn//reward')).toBe('/vn/reward')
    expect(canonicalLangPath('//hk')).toBe('/hk')
    expect(canonicalLangPath('//')).toBe('/')
    expect(canonicalLangPath('/hk//vn')).toBe('/hk')
    expect(canonicalLangPath('/vn//reward//')).toBe('/vn/reward')
    expect(canonicalLangPath('//dashboard//users')).toBe('/dashboard/users')
  })

  it('折叠后的结果仍幂等', () => {
    ['/vn//reward', '//hk', '//', '/hk//vn', '/vn//reward//'].forEach((pathname) => {
      const once = canonicalLangPath(pathname)
      expect(canonicalLangPath(once), `${pathname} -> ${once}`).toBe(once)
    })
  })
})
