import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils.js'

// dashJ 符号组件 —— ★ 用途变更（R-9-93）· 当前**无产品引用**
//   · 本义：类似美元符号与字母 S 的关系 —— J 字母加横划线。
//   · 变更：平台积分符号统一改用与后端 `currency.cid=1.symbol` 同源的 `$`；全仓 6 处产品使用点（Header 1 ·
//     TaskCard 1 · RewardCard 1 · HomePage 3）已移除本组件
//     ⇒ **当前无任何产品面引用**（仅保留本文件与 `ui/index.js` 的 barrel 导出）。
//   · 今后定位：仅用于「上市的积分」这一种积分符号，**不再代表平台积分**。
const DashJ = ({ 
  size = 'md', 
  className = '',
  showText = false,
  amount = null 
}) => {
  const { t } = useTranslation()
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl'
  }

  // dashJ 符号 - J 字母 + 横划线
  // P6-I18N-LIT-B5：`title` 里的品牌 token `dashJ` 不译，中文部分（原「社区积分」）走 locale
  const symbol = (
    <span 
      className={cn(
        'inline-flex items-center font-bold text-yellow-600 dark:text-yellow-400',
        sizeClasses[size],
        className
      )}
      title={t('uiCommon.dashJPoints')}
    >
      <span className="relative">
        <span className="font-serif">J</span>
        <span className="absolute top-1/2 left-0 w-full h-0.5 bg-current transform -translate-y-1/2"></span>
      </span>
    </span>
  )

  if (showText && amount !== null) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <span className="text-gray-900 dark:text-white font-medium">
          {amount.toLocaleString()}
        </span>
        {symbol}
      </span>
    )
  }

  return symbol
}

export default DashJ
