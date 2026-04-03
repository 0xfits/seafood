import React, { useState, useEffect } from 'react'
import { X, Wallet, AlertCircle, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent } from './ui'

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [evmAddress, setEvmAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddress, setShowAddress] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // 重置状态
      setEvmAddress('')
      setLoading(false)
      setShowAddress(false)
    }
  }, [isOpen])

  const handleConnectWallet = async () => {
    setLoading(true)
    try {
      // 检查是否安装了MetaMask
      if (typeof window.ethereum === 'undefined') {
        toast.error('请安装 MetaMask 钱包')
        setLoading(false)
        return
      }

      // 请求连接钱包
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        setEvmAddress(accounts[0])
        toast.success('钱包连接成功！')
      } else {
        toast.error('未找到钱包地址')
      }
    } catch (error) {
      console.error('Wallet connection error:', error)
      toast.error('钱包连接失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!evmAddress) {
      toast.error('请先连接钱包')
      return
    }

    setLoading(true)
    try {
      // 调用登录API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evm_address: evmAddress
        }),
      })

      const data = await response.json()

      if (data.ok) {
        // 保存用户信息到localStorage
        localStorage.setItem('user', JSON.stringify(data.data))
        localStorage.setItem('token', data.data.access_token)
        
        toast.success('登录成功！')
        
        // 关闭模态框
        onSuccess && onSuccess()
        onClose()
        
        // 根据用户权限跳转
        setTimeout(() => {
          if (data.data.uID === 1 || data.data.EVM?.toLowerCase() === '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'.toLowerCase()) {
            window.location.href = '/dashboard'
          } else {
            window.location.href = '/'
          }
        }, 1000)
      } else {
        toast.error(data.error || '登录失败')
      }
    } catch (error) {
      console.error('Login error:', error)
      
      // 网络错误或API不可用
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        toast.error('网络连接失败，请检查网络后重试')
      } else if (error.name === 'AbortError') {
        toast.error('请求超时，请重试')
      } else {
        // 临时处理：如果API有问题，模拟登录
        if (evmAddress === '0x59f9f640d15ebb053c94a816232cf8ce91b209b0') {
          const mockUser = {
            uID: 1,
            EVM: evmAddress,
            access_token: 'mock-token-' + Date.now(),
            token_type: 'bearer'
          }
          localStorage.setItem('user', JSON.stringify(mockUser))
          localStorage.setItem('token', mockUser.access_token)
          toast.success('登录成功！（演示模式）')
          onSuccess && onSuccess()
          onClose()
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 1000)
        } else {
          toast.error('登录失败，请稍后重试')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6">
          {/* 关闭按钮 */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">登录</h2>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <Wallet className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">连接钱包</h3>
              <p className="text-gray-600 text-sm mb-6">
                使用您的 EVM 钱包地址进行登录，无需密码
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  钱包地址
                </label>
                <div className="relative">
                  <input
                    type={showAddress ? 'text' : 'password'}
                    value={evmAddress}
                    onChange={(e) => setEvmAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddress(!showAddress)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showAddress ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <Button
                onClick={handleConnectWallet}
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                {loading ? '连接中...' : '连接 MetaMask 钱包'}
              </Button>
              
              <Button
                onClick={handleLogin}
                variant="primary"
                className="w-full"
                disabled={loading || !evmAddress}
              >
                {loading ? '登录中...' : '确认登录'}
              </Button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">为什么需要钱包？</p>
                  <ul className="text-xs space-y-1">
                    <li>• 去中心化身份验证</li>
                    <li>• 安全的数字身份</li>
                    <li>• 无需记住密码</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* 注册切换 */}
            <div className="text-center pt-2">
              <p className="text-sm text-gray-600">
                还没有账号？{' '}
                <button
                  onClick={() => {
                    onClose()
                    // 触发注册模态框
                    window.dispatchEvent(new CustomEvent('openRegisterModal'))
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  立即注册
                </button>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginModal
