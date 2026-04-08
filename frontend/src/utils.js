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
 * 从URL获取当前语言
 * @param {string} pathname - URL路径
 * @returns {string} 语言代码
 */
export const getLanguageFromUrl = (pathname) => {
  const lang = pathname.split('/')[1]
  const supportedLanguages = ['en', 'hk', 'vn']
  
  if (supportedLanguages.includes(lang)) {
    return lang
  }
  
  return 'zh' // 默认返回中文
}

/**
 * 构建带语言前缀的URL
 * @param {string} path - 基础路径
 * @param {string} lang - 语言代码
 * @returns {string} 带语言前缀的URL
 */
export const buildUrlWithLang = (path, lang) => {
  if (lang === 'zh') {
    return path.startsWith('/') ? path : `/${path}`
  }
  
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `/${lang}/${cleanPath}`
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
