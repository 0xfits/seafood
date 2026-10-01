import React from 'react'
import { X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from './ui'
import WalletAuthPanel from './auth/WalletAuthPanel'
import { fetchAdminAccess } from '../admin-utils'

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  if (!isOpen) return null

  const redirectTarget = {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
  }

  const handleAuthSuccess = async (session) => {
    onSuccess?.(session)
    onClose?.()

    if (session?.requires_profile_completion) {
      navigate('/register', { state: { from: redirectTarget } })
      return
    }

    const access = await fetchAdminAccess(session).catch(() => null)
    if (access?.can_access_admin) {
      navigate(access.preferred_admin_path || '/dashboard', { replace: true })
    }
  }

  const goToRegister = () => {
    onClose?.()
    navigate('/register', { state: { from: redirectTarget } })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-login-title"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md border border-blue-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label={t('loginModal.closeLabel')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <WalletAuthPanel
            mode="login"
            title={t('loginModal.title')}
            description={t('loginModal.description')}
            onSuccess={handleAuthSuccess}
          />

          <div className="mt-6 border-t border-gray-100 pt-4 text-center text-sm text-gray-600">
            {t('loginModal.firstTime')}
            <button
              type="button"
              onClick={goToRegister}
              className="ml-2 font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              {t('loginModal.goBind')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginModal
