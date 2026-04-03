import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { Button, Card, CardContent } from '../components/ui'
import { ResponsiveContainer } from '../components/ui/Responsive'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 模拟登录API调用
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        // 保存用户信息到localStorage
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('token', data.token)
        
        toast.success('登录成功！')
        
        // 根据用户权限跳转
        if (data.user.is_admin || data.user.role === 'admin' || 
            data.user.EVM?.toLowerCase() === '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'.toLowerCase()) {
          navigate('/dashboard')
        } else {
          navigate('/')
        }
      } else {
        toast.error(data.error || '登录失败')
      }
    } catch (error) {
      console.error('Login error:', error)
      // 如果API不存在，使用模拟登录
      if (email === 'admin@jinli.com' && password === 'admin123') {
        const mockUser = {
          uID: 1,
          EVM: '0x59f9f640d15ebb053c94a816232cf8ce91b209b0',
          email: 'admin@jinli.com',
          is_admin: true,
          token: 'mock-token-' + Date.now()
        }
        localStorage.setItem('user', JSON.stringify(mockUser))
        localStorage.setItem('token', mockUser.token)
        toast.success('登录成功！')
        navigate('/dashboard')
      } else {
        toast.error('登录失败，请检查账号密码')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ResponsiveContainer>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-yellow-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              登录到 Jinli Club
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              管理员登录面板
            </p>
          </div>

          <Card>
            <CardContent className="p-8">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    邮箱地址
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="admin@jinli.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    密码
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? '登录中...' : '登录'}
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  测试账号: admin@jinli.com / admin123
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveContainer>
  )
}

export default Login
