import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui'
import { requestAuthChallenge, verifyAuthChallenge } from '../../auth'
import { useAuth } from '../../auth-context'
import { cn, formatEvmAddress } from '../../utils'

// P6-I18N-LIT-B3：改为**四语键**（渲染处经 `t()` 求值），文案本体在 `locales/*.json` 的 `walletAuth.*`。
const COPY = {
  login: {
    title: 'walletAuth.loginTitle',
    description: 'walletAuth.loginDesc',
    actionLabel: 'walletAuth.loginAction',
  },
  register: {
    title: 'walletAuth.registerTitle',
    description: 'walletAuth.registerDesc',
    actionLabel: 'walletAuth.registerAction',
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
  const { t } = useTranslation()
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
      toast.error(t('walletAuth.noExtension'))
      return
    }

    setLoading(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const nextAddress = accounts?.[0] || ''
      if (!nextAddress) {
        throw new Error(t('walletAuth.noAddress'))
      }
      setWalletAddress(nextAddress)
      toast.success(t('walletAuth.connected'))
    } catch (error) {
      console.error('Wallet connection failed:', error)
      toast.error(error.message || t('walletAuth.connectFailed'))
    } finally {
      setLoading(false)
    }
  }

  const authenticate = async () => {
    if (!walletAddress) {
      toast.error(t('walletAuth.connectFirst'))
      return
    }

    if (!hasWallet || typeof window.ethereum === 'undefined') {
      toast.error(t('walletAuth.noWalletInBrowser'))
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
      toast.success(mode === 'register' ? t('walletAuth.verifiedContinue') : t('walletAuth.loginSuccess'))

      if (onSuccess) {
        await onSuccess(savedSession)
      }
    } catch (error) {
      console.error('Wallet authentication failed:', error)
      toast.error(error.message || t('walletAuth.signatureFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('space-y-6', className)} data-sf-m="auth-wallet-panel">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          <Wallet className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-gray-900">
          {title || t(copy.title)}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {description || t(copy.description)}
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
              {walletAddress ? t('walletAuth.stateConnected') : t('walletAuth.stateDisconnected')}
            </div>
            <div className="mt-1 break-all font-mono text-sm text-gray-600">
              {walletAddress ? formatEvmAddress(walletAddress) : t('walletAuth.connectPrompt')}
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              {t('walletAuth.signNote')}
            </p>
          </div>
        </div>
      </div>

      {!hasWallet && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('walletAuth.noWalletNotice')}
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
          {loading ? t('walletAuth.processing') : walletAddress ? t('walletAuth.switchWallet') : t('walletAuth.connectWallet')}
        </Button>

        <Button
          type="button"
          variant="proceed"
          className="w-full"
          disabled={loading || !walletAddress || !hasWallet}
          onClick={authenticate}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          {loading ? t('walletAuth.verifying') : actionLabel || t(copy.actionLabel)}
        </Button>
      </div>
    </div>
  )
}

export default WalletAuthPanel
