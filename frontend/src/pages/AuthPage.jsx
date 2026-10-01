import React, { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

import { Button, Card, CardContent } from '../components/ui'
import WalletAuthPanel from '../components/auth/WalletAuthPanel'
import { FadeIn, SlideUp } from '../components/ui/Motion'
import { ResponsiveContainer } from '../components/ui/Responsive'
import { updateMyProfile } from '../auth'
import { useAuth } from '../auth-context'

const FALLBACK_PATHS = {
  login: '/',
  register: '/profile',
}

const normalizeRedirectTarget = (target, fallbackPath) => {
  if (!target || typeof target !== 'object' || !target.pathname) {
    return fallbackPath
  }

  if (target.pathname === '/login' || target.pathname === '/register') {
    return fallbackPath
  }

  return target
}

const AuthPage = ({ mode = 'login' }) => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, isProfileComplete, updateSession } = useAuth()
  const [bio, setBio] = useState(user?.bio || '')
  const [saving, setSaving] = useState(false)

  const redirectTarget = useMemo(
    () => normalizeRedirectTarget(location.state?.from, FALLBACK_PATHS[mode] || '/'),
    [location.state, mode],
  )

  useEffect(() => {
    setBio(user?.bio || '')
  }, [user?.bio])

  const handleAuthSuccess = async (session) => {
    if (session?.requires_profile_completion) {
      navigate('/register', {
        replace: true,
        state: { from: redirectTarget },
      })
      return
    }

    if (mode === 'register') {
      return
    }

    navigate(redirectTarget, { replace: true })
  }

  const handleProfileSubmit = async () => {
    const nextBio = bio.trim()
    if (nextBio.length < 10) {
      toast.error(t('authPage.bioTooShort'))
      return
    }

    setSaving(true)
    try {
      const updatedUser = await updateMyProfile({ bio: nextBio }, user)
      updateSession(updatedUser)
      toast.success(t('authPage.bioSaved'))
      navigate(redirectTarget, { replace: true })
    } catch (error) {
      toast.error(t('authPage.saveFailed', { message: error.message }))
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'login' && isAuthenticated && !isProfileComplete) {
    return <Navigate to="/register" replace state={{ from: redirectTarget }} />
  }

  if (mode === 'login' && isAuthenticated && isProfileComplete) {
    return <Navigate to={redirectTarget} replace />
  }

  if (mode === 'register' && isAuthenticated && isProfileComplete) {
    return <Navigate to={redirectTarget} replace />
  }

  return (
    <ResponsiveContainer>
      <div className="mx-auto max-w-3xl py-10">
        <FadeIn>
          <section className="rounded-3xl bg-gradient-to-r from-yellow-50 via-white to-blue-50 p-8 shadow-sm ring-1 ring-gray-100">
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-600">
                Jinli Club
              </p>
              <h1 className="mt-4 text-3xl font-bold text-gray-900">
                {mode === 'login' ? t('authPage.titleLogin') : t('authPage.titleRegister')}
              </h1>
              <p className="mt-3 text-base text-gray-600">
                {mode === 'login'
                  ? t('authPage.subLogin')
                  : t('authPage.subRegister')}
              </p>
            </div>
          </section>
        </FadeIn>

        <SlideUp delay={180}>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <Card className="border border-blue-100 shadow-lg shadow-blue-50/60">
              <CardContent className="p-6 md:p-8">
                {mode === 'register' && isAuthenticated ? (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900">{t('authPage.completeBio')}</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {t('authPage.completeBioHint')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {t('walletAuth.stateConnected')}：{user?.EVM || t('authPage.unknownAddress')}
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-gray-700">{t('authPage.bio')}</span>
                      <textarea
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        rows={5}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        placeholder={t('authPage.bioPlaceholder')}
                      />
                    </label>

                    <Button
                      type="button"
                      variant="proceed"
                      className="w-full"
                      disabled={saving}
                      onClick={handleProfileSubmit}
                    >
                      {saving ? t('authPage.saving') : t('authPage.saveAndContinue')}
                    </Button>
                  </div>
                ) : (
                  <WalletAuthPanel
                    mode={mode}
                    onSuccess={handleAuthSuccess}
                  />
                )}
              </CardContent>
            </Card>

            <Card variant="secondary" className="border border-gray-100">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{t('authPage.note')}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {t('authPage.noteBody')}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/80 p-4 text-sm leading-6 text-gray-600 ring-1 ring-gray-100">
                  <p>{t('authPage.step1')}</p>
                  <p>{t('authPage.step2')}</p>
                  <p>{t('authPage.step3')}</p>
                </div>

                {mode === 'login' ? (
                  <p className="text-sm text-gray-600">
                    {t('authPage.notBoundYet')}
                    <Link to="/register" state={{ from: redirectTarget }} className="ml-2 font-medium text-blue-600 hover:text-blue-700">
                      {t('authPage.goRegister')}
                    </Link>
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    {t('authPage.alreadyBound')}
                    <Link to="/login" state={{ from: redirectTarget }} className="ml-2 font-medium text-blue-600 hover:text-blue-700">
                      {t('authPage.backToLogin')}
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </SlideUp>
      </div>
    </ResponsiveContainer>
  )
}

export default AuthPage
