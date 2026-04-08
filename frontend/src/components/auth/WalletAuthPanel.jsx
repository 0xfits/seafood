import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../ui'
import { requestAuthChallenge, verifyAuthChallenge } from '../../auth'
import { useAuth } from '../../auth-context'
import { cn, formatEvmAddress } from '../../utils'

const COPY = {
  login: {
    title: '钱包签名登录',
    description: '连接你的 EVM 钱包，并完成一次签名验证即可登录。',
    actionLabel: '签名登录',
  },
  register: {
    title: '首次绑定钱包',
    description: '先验证钱包所有权，再继续补全资料。',
    actionLabel: '连接并继续',
  },
}

const WalletAuthPanel = ({
  mode = 'login',
  title,
  description,
  actionLabel,
  className,
  onSuccess,
}) => {
  const { setSession } = useAuth()
  const [walletAddress, setWalletAddress] = useState('')
  const [hasWallet, setHasWallet] = useState(typeof window !== 'undefined' && typeof window.ethereum !== 'undefined')
  const [loading, setLoading] = useState(false)

  const copy = COPY[mode] || COPY.login

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
      setHasWallet(false)
      return undefined
    }

    const ethereum = window.ethereum
    setHasWallet(true)

    const syncAccounts = async () => {
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' })
        setWalletAddress(accounts?.[0] || '')
      } catch (error) {
        console.warn('Failed to inspect connected wallet accounts:', error)
      }
    }

    const handleAccountsChanged = (accounts) => {
      setWalletAddress(accounts?.[0] || '')
    }

    syncAccounts()
    ethereum.on?.('accountsChanged', handleAccountsChanged)

    return () => {
      ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [])

  const connectWallet = async () => {
    if (!hasWallet || typeof window.ethereum === 'undefined') {
      toast.error('未检测到 EVM 钱包扩展，请先安装 MetaMask 或 OKX Wallet')
      return
    }

    setLoading(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const nextAddress = accounts?.[0] || ''
      if (!nextAddress) {
        throw new Error('钱包未返回可用地址')
      }
      setWalletAddress(nextAddress)
      toast.success('钱包连接成功')
    } catch (error) {
      console.error('Wallet connection failed:', error)
      toast.error(error.message || '钱包连接失败')
    } finally {
      setLoading(false)
    }
  }

  const authenticate = async () => {
    if (!walletAddress) {
      toast.error('请先连接钱包')
      return
    }

    if (!hasWallet || typeof window.ethereum === 'undefined') {
      toast.error('当前浏览器未检测到可用钱包')
      return
    }

    setLoading(true)
    try {
      const selectedAddress = walletAddress.trim()
      const normalizedAddress = selectedAddress.toLowerCase()
      const challenge = await requestAuthChallenge(normalizedAddress)
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [challenge.message, selectedAddress],
      })

      const session = await verifyAuthChallenge({
        evmAddress: normalizedAddress,
        challengeToken: challenge.challenge_token,
        signature,
      })

      const savedSession = setSession(session)
      toast.success(mode === 'register' ? '钱包验证成功，继续补全资料' : '登录成功')

      if (onSuccess) {
        await onSuccess(savedSession)
      }
    } catch (error) {
      console.error('Wallet authentication failed:', error)
      toast.error(error.message || '签名验证失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          <Wallet className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-gray-900">
          {title || copy.title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {description || copy.description}
        </p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-blue-600">
            {walletAddress ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-800">
              {walletAddress ? '已连接钱包' : '尚未连接钱包'}
            </div>
            <div className="mt-1 break-all font-mono text-sm text-gray-600">
              {walletAddress ? formatEvmAddress(walletAddress) : '请连接一个 EVM 钱包地址'}
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              登录只会请求一次签名，不会发起链上交易，也不会消耗 gas。
            </p>
          </div>
        </div>
      </div>

      {!hasWallet && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前环境未检测到 MetaMask 或 OKX Wallet。安装钱包扩展后刷新页面即可继续。
        </div>
      )}

      <div className="space-y-3">
        <Button
          type="button"
          variant={walletAddress ? 'outline' : 'primary'}
          className="w-full"
          disabled={loading}
          onClick={connectWallet}
        >
          <Wallet className="mr-2 h-4 w-4" />
          {loading ? '处理中...' : walletAddress ? '切换钱包' : '连接钱包'}
        </Button>

        <Button
          type="button"
          variant="proceed"
          className="w-full"
          disabled={loading || !walletAddress || !hasWallet}
          onClick={authenticate}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          {loading ? '签名验证中...' : actionLabel || copy.actionLabel}
        </Button>
      </div>
    </div>
  )
}

export default WalletAuthPanel
