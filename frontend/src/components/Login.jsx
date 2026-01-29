import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import Web3 from 'web3'
import toast from 'react-hot-toast'

const Login = () => {
  const { t } = useTranslation()
  const [web3, setWeb3] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentAccount, setCurrentAccount] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // 初始化Web3
  useEffect(() => {
    // 检查是否有MetaMask或其他钱包扩展
    if (window.ethereum) {
      try {
        // 创建Web3实例
        const newWeb3 = new Web3(window.ethereum)
        setWeb3(newWeb3)
        
        // 检查是否已连接
        window.ethereum.request({ method: 'eth_accounts' })
          .then(accounts => {
            if (accounts.length > 0) {
              setIsConnected(true)
              setCurrentAccount(accounts[0])
            }
          })
          .catch(err => {
            console.error('Error checking accounts:', err)
          })
        
        // 监听账户变化
        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            setIsConnected(true)
            setCurrentAccount(accounts[0])
          } else {
            setIsConnected(false)
            setCurrentAccount(null)
          }
        })
        
        // 监听网络变化
        window.ethereum.on('chainChanged', () => {
          window.location.reload()
        })
      } catch (error) {
        console.error('Error initializing Web3:', error)
        toast.error(t('error') + ': ' + error.message)
      }
    } else {
      toast.error(t('error') + ': ' + '请安装MetaMask或OKX钱包扩展')
    }
  }, [t])

  // 连接钱包
  const connectWallet = async () => {
    if (!web3) {
      toast.error(t('error') + ': ' + 'Web3未初始化')
      return
    }
    
    setLoading(true)
    try {
      // 请求连接钱包
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })
      
      if (accounts && accounts.length > 0) {
        setIsConnected(true)
        setCurrentAccount(accounts[0])
        toast.success(t('success') + ': ' + '钱包连接成功')
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      toast.error(t('error') + ': ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 生成随机消息用于签名
  const generateSignMessage = () => {
    const timestamp = new Date().getTime()
    const nonce = Math.floor(Math.random() * 1000000)
    return `欢迎登录Jinli社区\n\n为了验证您是此钱包的所有者，请签名以下消息：\n\n时间戳: ${timestamp}\n随机数: ${nonce}\n\n此签名仅用于身份验证，不会产生任何费用。`
  }

  // 签名登录
  const signIn = async () => {
    if (!web3 || !currentAccount) {
      toast.error(t('error') + ': ' + '请先连接钱包')
      return
    }
    
    setLoading(true)
    try {
      // 生成签名消息
      const message = generateSignMessage()
      
      // 规范化并校验地址
      const addr = (currentAccount || '').trim()
      if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
        toast.error(t('error') + ': ' + '钱包地址格式不正确')
        return
      }
      
      // 调试日志：便于定位问题（不会影响生产）
      console.log('Login payload:', { evm_address: addr })
      
      // 请求签名
      const signature = await web3.eth.personal.sign(message, addr, '')
      
      // 发送签名到后端验证（按后端规范字段）
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evm_address: addr.toLowerCase(),
          signature
          // message 当前后端未校验，可不传
        })
      })
      
      // 解析响应
      const rawText = await response.text()
      let data
      try {
        data = JSON.parse(rawText)
      } catch (e) {
        data = null
      }
      
      if (response.ok && data && data.success) {
        // 存储用户信息到localStorage（token 字段用于后续鉴权）
        localStorage.setItem('user', JSON.stringify({
          uID: data.uID,
          EVM: data.EVM,
          token: data.access_token
        }))
        
        toast.success(t('success') + ': ' + '登录成功')
        
        // 重定向到首页或之前的页面
        const from = location.state?.from?.pathname || '/'
        navigate(from)
      } else {
        // 提取错误详情
        const errMsg = (data && (data.error || data.detail || data.message)) || rawText || `HTTP ${response.status}`
        console.error('Login failed:', { status: response.status, body: rawText })
        toast.error(t('error') + ': ' + (typeof errMsg === 'string' ? errMsg : '登录失败'))
      }
    } catch (error) {
      console.error('Error signing in:', error)
      toast.error(t('error') + ': ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 断开连接
  const disconnectWallet = () => {
    setIsConnected(false)
    setCurrentAccount(null)
    toast.success(t('success') + ': ' + '钱包已断开连接')
  }

  // 获取当前语言
  const getCurrentLang = () => {
    const pathParts = location.pathname.split('/')
    if (pathParts.length > 1 && ['en', 'hk', 'vn'].includes(pathParts[1])) {
      return pathParts[1]
    }
    return 'zh'
  }

  // 构建带语言前缀的路径
  const buildPath = (path) => {
    const currentLang = getCurrentLang()
    if (currentLang === 'zh') {
      return path === '' ? '/' : `/${path}`
    }
    return `/${currentLang}/${path}`
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 导航栏 */}
      <header className="bg-bg-primary border-b border-border-color">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <a href={buildPath('')} className="text-xl font-bold text-primary">
                {t('siteTitle')}
              </a>
            </div>
          </div>
        </div>
      </header>
      
      {/* 主要内容 */}
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md card p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">{t('login')}</h1>
            <p className="text-text-secondary">{t('welcome')}</p>
          </div>
          
          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={loading}
              className="w-full btn btn-proceed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                <i className="w-5 h-5"></i>
              )}
              <span>{t('login')}</span>
            </button>
          ) : (
            <div className="space-y-6">
              <div className="card p-4">
                <p className="text-sm text-text-secondary mb-2">{t('evmAddress')}:</p>
                <p className="text-sm font-mono break-all">
                  {currentAccount ? `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}` : ''}
                </p>
                <div className="text-right mt-2">
                  <button
                    onClick={disconnectWallet}
                    className="text-sm text-error hover:underline"
                  >
                    {t('logout')}
                  </button>
                </div>
              </div>
              
              <button
                onClick={signIn}
                disabled={loading}
                className="w-full btn btn-proceed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <i className="w-5 h-5"></i>
                )}
                <span>{t('confirm')}</span>
              </button>
            </div>
          )}
          
          <div className="mt-8 text-center text-sm text-text-secondary">
            <p>{getCurrentLang() === 'zh' && '点击登录表示您同意我们的服务条款和隐私政策。'}</p>
            <p>{getCurrentLang() === 'en' && 'By clicking login, you agree to our terms of service and privacy policy.'}</p>
            <p>{getCurrentLang() === 'hk' && '點擊登錄表示您同意我們的服務條款和私隱政策。'}</p>
            <p>{getCurrentLang() === 'vn' && 'Bằng cách nhấn đăng nhập, bạn đồng ý với điều khoản dịch vụ và chính sách bảo mật của chúng tôi.'}</p>
          </div>
        </div>
      </main>
      
      {/* 页脚 */}
      <footer className="bg-bg-secondary border-t border-border-color py-4">
        <div className="container mx-auto px-4 text-center text-sm text-text-secondary">
          {t('copyright')}
        </div>
      </footer>
    </div>
  )
}

export default Login