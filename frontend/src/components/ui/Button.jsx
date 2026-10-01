import React from 'react'
import { cn } from '../../utils'

// variant → CSS class（来自 styles.css 的 .btn-* 系列，含切角与宝石光泽）
// P6-BTN-IMPL：本表只留「类名」，Tailwind 的 bg-*/text-* 盖色类一律删除
// （原来它们与 styles.css 里的 background-color/color 声明构成双源；层叠顺序一变就改色）。
//   primary / secondary ⇒ 变体 A″（日档）/ A′（夜档）：.btn-a（主）/ .btn-a-alt（次），
//   由 --sf-btna-* / --sf-btnalt-* 主题 token + --sf-st-* 结构常量驱动
//   （真源 docs/design/style-preview.html 938–982 行）。
//   其余 7 个变体沿用既有 .btn-* 类（本体已在 styles.css 单点定义背景色）。
const variantClass = {
  primary:   'btn-a',
  secondary: 'btn-a-alt',
  proceed:   'btn-proceed',
  success:   'btn-success',
  warning:   'btn-warning',
  inactive:  'btn-inactive',
  outline:   'btn-outline',
  ghost:     'btn-ghost',
  info:      'btn-info',
}

const sizeClass = {
  sm: 'btn-sm px-3 py-1.5 text-sm',
  md: 'btn-md px-4 py-2 text-base',
  lg: 'btn-lg px-8 py-3 text-lg',
}

const Button = React.forwardRef(({
  as: Component = 'button',
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  ...props
}, ref) => {
  return (
    <Component
      className={cn(
        'btn',
        variantClass[variant] ?? variantClass.primary,
        sizeClass[size] ?? sizeClass.md,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      ref={ref}
      disabled={Component === 'button' ? disabled : undefined}
      aria-disabled={disabled || undefined}
      {...props}
    >
      {children}
    </Component>
  )
})

Button.displayName = 'Button'

export { Button }
