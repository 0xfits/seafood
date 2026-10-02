import React, { useState } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { cn } from '../../utils'

const Form = ({ children, className, onSubmit, ...props }) => (
  <form
    className={cn('space-y-4', className)}
    onSubmit={onSubmit}
    {...props}
  >
    {children}
  </form>
)

const FormField = ({ 
  label, 
  error, 
  required = false, 
  description,
  children,
  className 
}) => (
  <div className={cn('space-y-2', className)}>
    {label && (
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {description && (
      <p className="text-sm text-gray-500">{description}</p>
    )}
    {error && (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    )}
  </div>
)

const Input = ({ 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  error,
  disabled = false,
  leftIcon,
  rightIcon,
  className,
  ...props 
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type
  
  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          {leftIcon}
        </div>
      )}
      
      <input
        type={inputType}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 border rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent',
          'transition-colors duration-200',
          leftIcon && 'pl-10',
          (rightIcon || isPassword) && 'pr-10',
          error ? 'border-red-300' : 'border-gray-300',
          disabled && 'bg-gray-100 cursor-not-allowed',
          className
        )}
        {...props}
      />
      
      {(rightIcon || isPassword) && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : (
            rightIcon
          )}
        </div>
      )}
    </div>
  )
}

const Textarea = ({ 
  placeholder, 
  value, 
  onChange, 
  error,
  disabled = false,
  rows = 4,
  className,
  ...props 
}) => (
  <textarea
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    disabled={disabled}
    rows={rows}
    className={cn(
      'w-full px-3 py-2 border rounded-lg resize-none',
      'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent',
      'transition-colors duration-200',
      error ? 'border-red-300' : 'border-gray-300',
      disabled && 'bg-gray-100 cursor-not-allowed',
      className
    )}
    {...props}
  />
)

const Select = ({ 
  options, 
  value, 
  onChange, 
  placeholder,
  error,
  disabled = false,
  className,
  ...props 
}) => (
  <select
    value={value}
    onChange={onChange}
    disabled={disabled}
    className={cn(
      'w-full px-3 py-2 border rounded-lg',
      'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent',
      'transition-colors duration-200',
      error ? 'border-red-300' : 'border-gray-300',
      disabled && 'bg-gray-100 cursor-not-allowed',
      className
    )}
    {...props}
  >
    {placeholder && (
      <option value="" disabled>
        {placeholder}
      </option>
    )}
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
)

const Checkbox = ({ 
  label, 
  checked, 
  onChange, 
  disabled = false,
  error,
  className,
  ...props 
}) => (
  <label className={cn(
    'flex items-center gap-2 cursor-pointer',
    disabled && 'cursor-not-allowed opacity-50',
    className
  )}>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'w-4 h-4 text-yellow-600 border-2 rounded',
        'focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2',
        error ? 'border-red-300' : 'border-gray-300',
        'disabled:cursor-not-allowed'
      )}
      {...props}
    />
    {label && (
      <span className="text-sm text-gray-700">{label}</span>
    )}
  </label>
)

const RadioGroup = ({ 
  options, 
  value, 
  onChange, 
  error,
  disabled = false,
  className,
  ...props 
}) => (
  <div className={cn('space-y-2', className)}>
    {options.map((option) => (
      <label
        key={option.value}
        className={cn(
          'flex items-center gap-2 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <input
          type="radio"
          name={props.name}
          value={option.value}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          disabled={disabled}
          className={cn(
            'w-4 h-4 text-yellow-600 border-2',
            'focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2',
            error ? 'border-red-300' : 'border-gray-300'
          )}
        />
        <span className="text-sm text-gray-700">{option.label}</span>
      </label>
    ))}
  </div>
)

export {
  Form,
  FormField,
  Input,
  Textarea,
  Select,
  Checkbox,
  RadioGroup
}
