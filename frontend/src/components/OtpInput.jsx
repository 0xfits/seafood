import React, { useCallback, useMemo, useRef } from 'react'

/**
 * 苹果验证码式 6 格数字输入（Kevin 2026-10-24【我的邀请】需求）
 * ============================================================================
 * 形态：`length` 个**单字符**格子（默认 6），只收数字。
 * 行为（逐条对应需求，不增不减）：
 *   ① 只收数字 —— 非数字字符在写入前被剥离（含 IME / 全角输入）；
 *   ② 自动前进 —— 在格子 i 输入 1 位 ⇒ 焦点跳到 i+1（最后一格不越界）；
 *   ③ 自动回退 —— 空格子按 `Backspace` ⇒ 焦点回 i-1 并删该格；有值则只删本格；
 *   ④ 粘贴整串 —— 任一格 `paste` 把数字串从**当前格**起逐格填满（超长截断）；
 *   ⑤ 移动端数字键盘 —— `inputMode="numeric"` + `pattern="[0-9]*"`（iOS/Android 拉数字盘）；
 *   ⑥ 无障碍 —— 整组 `role="group"` + `aria-label`（可见 label 由调用方渲染）+
 *      每格独立 `aria-label`（「第 n 位」）+ 只读/禁用经 `disabled` 透传。
 * 受控：值一律由 `value`（数字串）单一真源驱动，组件内部**不存第二份**状态
 *   （避免「粘贴 / 退格 / 受控回写」三路各写一份导致的漂移）。
 * 钩子（探针）：每格 `data-sf-m={`${hookPrefix}-cell-${i}`}`。
 * ============================================================================
 */
const ONLY_DIGITS = /[^0-9]/g

const digitsOf = (raw) => String(raw ?? '').replace(ONLY_DIGITS, '')

const OtpInput = ({
  value = '',
  onChange,
  length = 6,
  disabled = false,
  label = '',
  hookPrefix = 'invite-otp',
  ariaDescribedBy,
}) => {
  const refs = useRef([])
  const cells = useMemo(() => {
    const chars = digitsOf(value).slice(0, length).split('')
    return Array.from({ length }, (_, i) => chars[i] ?? '')
  }, [value, length])

  const focusCell = useCallback((index) => {
    const target = refs.current[Math.max(0, Math.min(length - 1, index))]
    if (target && typeof target.focus === 'function') {
      target.focus()
      // 光标置于末尾（单字符格：选中比位移更稳，兼容 iOS）
      if (typeof target.setSelectionRange === 'function') {
        try { target.setSelectionRange(1, 1) } catch { /* 某些环境不支持：忽略 */ }
      }
    }
  }, [length])

  /** 从 `start` 起写入数字串（粘贴 / 多字符输入的共用落点） */
  const writeFrom = useCallback((start, raw) => {
    const incoming = digitsOf(raw)
    if (!incoming) return
    const current = digitsOf(value).slice(0, length).split('')
    for (let k = 0; k < incoming.length && start + k < length; k += 1) {
      current[start + k] = incoming[k]
    }
    const next = current.join('').slice(0, length)
    onChange?.(next)
    focusCell(Math.min(length - 1, start + incoming.length))
  }, [value, length, onChange, focusCell])

  const handleChange = (index) => (event) => {
    const raw = event?.target?.value ?? ''
    const incoming = digitsOf(raw)
    if (!incoming) {
      // 用户清空了本格（例如用软键盘删除）
      const current = digitsOf(value).slice(0, length).split('')
      current[index] = ''
      onChange?.(current.join(''))
      return
    }
    if (incoming.length > 1) {
      writeFrom(index, incoming)
      return
    }
    writeFrom(index, incoming)
  }

  const handleKeyDown = (index) => (event) => {
    const key = event?.key
    if (key === 'Backspace') {
      if (cells[index]) return // 有值：交给 onChange 删本格
      event.preventDefault()
      const current = digitsOf(value).slice(0, length).split('')
      if (current[index - 1] !== undefined) current[index - 1] = ''
      onChange?.(current.join(''))
      focusCell(index - 1)
      return
    }
    if (key === 'Delete') {
      const current = digitsOf(value).slice(0, length).split('')
      current[index] = ''
      onChange?.(current.join(''))
      return
    }
    if (key === 'ArrowLeft') { event.preventDefault(); focusCell(index - 1); return }
    if (key === 'ArrowRight') { event.preventDefault(); focusCell(index + 1); return }
    if (key === 'Home') { event.preventDefault(); focusCell(0); return }
    if (key === 'End') { event.preventDefault(); focusCell(length - 1) }
  }

  const handlePaste = (index) => (event) => {
    const text = event?.clipboardData?.getData?.('text')
      ?? event?.clipboardData?.getData?.('text/plain')
      ?? ''
    if (!digitsOf(text)) return // 非数字粘贴：不拦（交给默认行为，后续被过滤）
    event.preventDefault()
    writeFrom(index, text)
  }

  return (
    <div
      className="sf-otp"
      data-sf-m={hookPrefix}
      role="group"
      aria-label={label}
      aria-describedby={ariaDescribedBy}
    >
      {cells.map((char, index) => (
        <input
          // 索引即身份（格子数量恒定、顺序恒定 ⇒ 无重排风险）
          key={index}
          ref={(el) => { refs.current[index] = el }}
          className="sf-otp-cell"
          data-sf-m={`${hookPrefix}-cell-${index}`}
          data-sf-cell={index}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={1}
          value={char}
          disabled={disabled}
          aria-label={`${label} ${index + 1}`}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste(index)}
          onFocus={(event) => {
            if (typeof event?.target?.select === 'function') event.target.select()
          }}
        />
      ))}
    </div>
  )
}

export default OtpInput
