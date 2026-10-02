import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  AUTH_CHANGE_EVENT,
  clearAuthSession,
  fetchCurrentUser,
  getAuthToken,
  getStoredUser,
  hasCompletedProfile,
  isAuthenticatedUser,
  mergeAuthSession,
  saveAuthSession,
} from './auth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser())

  useEffect(() => {
    const syncSession = () => {
      setUser(getStoredUser())
    }

    window.addEventListener(AUTH_CHANGE_EVENT, syncSession)
    window.addEventListener('storage', syncSession)

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncSession)
      window.removeEventListener('storage', syncSession)
    }
  }, [])

  const setSession = (nextUser) => {
    const saved = saveAuthSession(nextUser)
    setUser(saved)
    return saved
  }

  const updateSession = (patch) => {
    const saved = mergeAuthSession(patch)
    setUser(saved)
    return saved
  }

  const refreshUser = async () => {
    const current = getStoredUser()
    if (!current) return null

    const nextUser = await fetchCurrentUser(current)
    return setSession({
      ...current,
      ...nextUser,
      token: getAuthToken(current),
    })
  }

  const logout = () => {
    clearAuthSession()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token: getAuthToken(user),
        isAuthenticated: isAuthenticatedUser(user),
        isProfileComplete: hasCompletedProfile(user),
        setSession,
        updateSession,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
