/**
 * API 配置文件
 * 所有 API 请求的基础配置
 */

// API 基础 URL
// 开发环境使用本地，生产环境使用 Vercel 部署的地址
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.jinlibenli.com'

// API 端点
export const API_ENDPOINTS = {
  // 认证
  AUTH: {
    LOGIN: '/api/auth/login',
  },
  
  // 用户
  USER: {
    GET_CURRENT: '/api/user',
    GET_ASSET: '/api/user/asset',
    GET_ALL: '/api/user/all',
  },
  
  // 任务
  TASK: {
    GET_ALL: '/api/task/all',
    GET_DETAIL: (tID) => `/api/task/${tID}`,
  },
  
  // 任务参与
  JOURNEY: {
    GET_ALL: '/api/journey',
    SUBMIT: (jID) => `/api/journey/${jID}/submit`,
    VERIFY: (jID) => `/api/journey/${jID}/verify`,
    PENDING: '/api/journey/pending-verification',
  },
  
  // 品牌/礼品
  BRAND: {
    GET_ALL: '/api/brand/all',
    GET_DETAIL: (bID) => `/api/brand/${bID}`,
  },
  
  GIFT: {
    GET_ALL: '/api/gift/all',
    CLAIM: '/api/gift/claim',
  },
}

/**
 * 发送 API 请求的通用函数
 * @param {string} endpoint - API 端点
 * @param {Object} options - fetch 选项
 * @returns {Promise} 响应数据
 */
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`
  
  // 获取 token
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const token = user?.token
  
  // 默认 headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.message || '请求失败')
    }
    
    return data
  } catch (error) {
    console.error('API 请求错误:', error)
    throw error
  }
}

// 便捷的 API 方法
export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { 
    method: 'POST', 
    body: JSON.stringify(body) 
  }),
  put: (endpoint, body) => apiRequest(endpoint, { 
    method: 'PUT', 
    body: JSON.stringify(body) 
  }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
}
