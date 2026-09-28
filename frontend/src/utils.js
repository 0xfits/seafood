// 工具函数集合

import { clsx } from 'clsx'
import { clearAuthSession, getStoredUser, saveAuthSession } from './auth'

/**
 * Tailwind CSS 类名合并工具
 * @param {...string} classNames - 要合并的类名
 * @returns {string} 合并后的类名字符串
 */
export const cn = (...classNames) => {
  return clsx(classNames)
}

/**
 * 格式化EVM地址，显示前6位和后4位
 * @param {string} address - EVM地址
 * @returns {string} 格式化后的地址
 */
export const formatEvmAddress = (address) => {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * 验证EVM地址格式
 * @param {string} address - 要验证的地址
 * @returns {boolean} 地址是否有效
 */
export const isValidEvmAddress = (address) => {
  // 简单验证，实际应用中应该使用web3.js或ethers.js进行更严格的验证
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * 支持的语言代码（唯一白名单，顺序即语言菜单顺序）
 * @type {string[]}
 */
export const SUPPORTED_LANGS = ['zh', 'en', 'hk', 'vn']

/**
 * 从URL获取当前语言（只识别首位语言段，其余位置的语言词是普通路径）
 * @param {string} pathname - URL路径
 * @returns {string} 语言代码，无语言前缀时返回 'zh'
 */
export const getLanguageFromUrl = (pathname) => {
  const lang = (pathname || '/').split('/')[1]

  return SUPPORTED_LANGS.includes(lang) ? lang : 'zh'
}

/**
 * 剥离路径中所有前导语言段
 * @param {string} pathname - URL路径
 * @returns {string} 剩余路径，形如 '' 或 '/reward'
 */
export const stripLangPrefix = (pathname) => {
  const parts = (pathname || '/').split('/')
  let index = 1

  while (index < parts.length && SUPPORTED_LANGS.includes(parts[index])) {
    index += 1
  }

  const rest = parts.slice(index).join('/')

  return rest ? `/${rest}` : ''
}

/**
 * 按目标语言重建路径：先剥离所有语言前缀，再按目标语言加前缀
 * @param {string} pathname - 当前URL路径
 * @param {string} targetLang - 目标语言代码
 * @returns {string} 带目标语言前缀的路径；剩余路径为空时不带尾斜杠
 */
export const buildLangPath = (pathname, targetLang) => {
  const rest = stripLangPrefix(pathname).replace(/\/+$/, '')

  if (targetLang === 'zh') {
    return rest || '/'
  }

  return `/${targetLang}${rest}`
}

/**
 * 折叠路径中的重复斜杠（URL 规范化的组成部分：/vn//reward → /vn/reward、//hk → /hk）
 * @param {string} pathname - URL路径
 * @returns {string} 折叠后的路径
 */
const collapseSlashes = (pathname) => {
  return (pathname || '/').replace(/\/{2,}/g, '/')
}

/**
 * 计算URL的规范路径，用于判定「该不该重定向」
 * 口径：折叠重复斜杠 → 剥离/重建语言前缀 → 去尾斜杠（根路径 '/' 除外）
 * @param {string} pathname - URL路径
 * @returns {string} 规范路径
 */
export const canonicalLangPath = (pathname) => {
  const collapsed = collapseSlashes(pathname)

  return buildLangPath(collapsed, getLanguageFromUrl(collapsed))
}

/**
 * 格式化日期
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} format - 格式化模板
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(d.getTime())) return ''
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 显示成功通知
 * @param {string} message - 通知消息
 */
export const showSuccessToast = (message) => {
  // 使用react-hot-toast的toast.success
  import('react-hot-toast').then(({ toast }) => {
    toast.success(message)
  })
}

/**
 * 显示错误通知
 * @param {string} message - 通知消息
 */
export const showErrorToast = (message) => {
  // 使用react-hot-toast的toast.error
  import('react-hot-toast').then(({ toast }) => {
    toast.error(message)
  })
}

/**
 * 从localStorage获取用户信息
 * @returns {Object|null} 用户信息对象或null
 */
export const getUserFromStorage = () => {
  try {
    return getStoredUser()
  } catch (error) {
    console.error('Error getting user from storage:', error)
    return null
  }
}

/**
 * 将用户信息保存到localStorage
 * @param {Object} user - 用户信息对象
 */
export const saveUserToStorage = (user) => {
  try {
    saveAuthSession(user)
  } catch (error) {
    console.error('Error saving user to storage:', error)
  }
}

/**
 * 从localStorage移除用户信息
 */
export const removeUserFromStorage = () => {
  try {
    clearAuthSession()
  } catch (error) {
    console.error('Error removing user from storage:', error)
  }
}

/**
 * 检查用户是否已登录
 * @returns {boolean} 用户是否已登录
 */
export const isLoggedIn = () => {
  const user = getUserFromStorage()
  return !!user && !!user.token
}

/**
 * 检查用户是否为管理员
 * @returns {boolean} 用户是否为管理员
 */
export const isAdmin = () => {
  const user = getUserFromStorage()
  return Boolean(user?.is_admin || user?.role === 'admin')
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
export const throttle = (func, limit) => {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
