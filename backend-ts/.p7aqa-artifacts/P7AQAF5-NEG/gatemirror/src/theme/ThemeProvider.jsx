import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_THEME, THEME_ATTR, THEME_ATTR_VALUES, THEME_ORDER, THEME_STORAGE_KEY } from './tokens'

// 主题 = 日档（day「码头大牌」）/ 夜档（night「夜市行情板」）。
// 存储与 DOM 属性沿用既有口径（localStorage['theme'] = 'light'|'dark'、<html data-theme>），
// 因此 styles.css 里既有的 [data-theme="dark"] 规则、main.jsx 的启动读值、Header 既有开关全部继续有效。
const attrToTheme = (attr) => (attr === THEME_ATTR_VALUES.night ? 'night' : 'day')

export const readInitialTheme = () => {
  if (typeof document === 'undefined') return DEFAULT_THEME
  const fromAttr = document.documentElement?.getAttribute?.(THEME_ATTR)
  if (fromAttr) return attrToTheme(fromAttr)
  try {
    const stored = window.localStorage?.getItem(THEME_STORAGE_KEY)
    if (stored) return attrToTheme(stored)
  } catch (error) {
    /* localStorage 不可用（隐私模式）时退回默认档 */
  }
  return DEFAULT_THEME
}

export const applyTheme = (theme) => {
  const attr = THEME_ATTR_VALUES[theme] || THEME_ATTR_VALUES[DEFAULT_THEME]
  document.documentElement.setAttribute(THEME_ATTR, attr)
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, attr)
  } catch (error) {
    /* 忽略写入失败：本次会话内主题仍生效 */
  }
  return attr
}

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  isNight: false,
  setTheme: () => {},
  toggleTheme: () => {},
})

// 注意：Provider 只提供上下文，**不额外产生任何 DOM 节点**（同构前提之一）。
export const ThemeProvider = ({ children, initialTheme }) => {
  const [theme, setThemeState] = useState(() => initialTheme || readInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next) => {
    if (!THEME_ORDER.includes(next)) return
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'day' ? 'night' : 'day'))
  }, [])

  const value = useMemo(
    () => ({ theme, isNight: theme === 'night', setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

export { ThemeContext }
