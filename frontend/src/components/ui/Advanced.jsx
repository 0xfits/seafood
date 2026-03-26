import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Calendar, Filter } from 'lucide-react'
import { cn } from '../../utils'

const SearchBox = ({ 
  placeholder = '搜索...', 
  value, 
  onChange, 
  onClear,
  className,
  disabled = false 
}) => {
  const [focused, setFocused] = useState(false)
  
  return (
    <div className={cn(
      'relative flex items-center',
      focused && 'ring-2 ring-yellow-500 ring-offset-2 rounded-lg',
      className
    )}>
      <Search className="w-5 h-5 text-gray-400 absolute left-3" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className={cn(
          'w-full pl-10 pr-10 py-2 border-2 rounded-lg',
          'focus:outline-none focus:border-transparent',
          'transition-colors duration-200',
          'border-gray-300',
          disabled && 'bg-gray-100 cursor-not-allowed'
        )}
      />
      {value && (
        <button
          onClick={() => {
            onClear?.()
            onChange('')
          }}
          className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

const Dropdown = ({ 
  trigger, 
  children, 
  placement = 'bottom-right',
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const placementClasses = {
    'bottom-right': 'top-full left-0 mt-2',
    'bottom-left': 'top-full right-0 mt-2',
    'top-right': 'bottom-full left-0 mb-2',
    'top-left': 'bottom-full right-0 mb-2'
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 bg-white border-2 border-gray-200 rounded-lg shadow-lg',
            'min-w-48 py-2',
            placementClasses[placement],
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

const DatePicker = ({ 
  value, 
  onChange, 
  placeholder = '选择日期',
  disabled = false,
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dateRef = useRef(null)
  
  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('zh-CN')
  }
  
  const handleDateChange = (e) => {
    onChange(e.target.value)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-2 rounded-lg cursor-pointer',
          'border-gray-300 hover:border-gray-400',
          'transition-colors duration-200',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-50',
          className
        )}
      >
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="flex-1">
          {value ? formatDate(value) : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-2">
          <input
            ref={dateRef}
            type="date"
            value={value}
            onChange={handleDateChange}
            className="border-2 border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-yellow-500"
          />
        </div>
      )}
    </div>
  )
}

const FilterPanel = ({ 
  filters, 
  activeFilters, 
  onFilterChange, 
  onClearAll,
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const getFilterCount = () => {
    return Object.values(activeFilters).filter(value => 
      value !== undefined && value !== '' && value !== null
    ).length
  }

  return (
    <div className={cn('border-2 border-gray-200 rounded-lg', className)}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-900">筛选</span>
          {getFilterCount() > 0 && (
            <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
              {getFilterCount()}
            </span>
          )}
        </div>
        <ChevronDown 
          className={cn(
            'w-4 h-4 text-gray-600 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )} 
        />
      </div>
      
      {isExpanded && (
        <div className="border-t-2 border-gray-200 p-4 space-y-4">
          {filters.map((filter) => (
            <div key={filter.key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {filter.label}
              </label>
              {filter.type === 'select' ? (
                <select
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => onFilterChange(filter.key, e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-yellow-500"
                >
                  <option value="">{filter.placeholder}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : filter.type === 'date' ? (
                <DatePicker
                  value={activeFilters[filter.key]}
                  onChange={(value) => onFilterChange(filter.key, value)}
                  placeholder={filter.placeholder}
                />
              ) : (
                <input
                  type="text"
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => onFilterChange(filter.key, e.target.value)}
                  placeholder={filter.placeholder}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              )}
            </div>
          ))}
          
          <div className="flex justify-end gap-2 pt-4 border-t-2 border-gray-200">
            <button
              onClick={() => onClearAll?.()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              清除筛选
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              应用筛选
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  showPageNumbers = true,
  className 
}) => {
  const pages = []
  const maxVisiblePages = 5
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          'px-3 py-2 border-2 rounded-lg transition-colors',
          'border-gray-300 hover:border-gray-400',
          currentPage === 1 && 'opacity-50 cursor-not-allowed'
        )}
      >
        上一页
      </button>
      
      {showPageNumbers && pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={cn(
            'px-3 py-2 border-2 rounded-lg transition-colors',
            'border-gray-300 hover:border-gray-400',
            currentPage === page 
              ? 'bg-yellow-500 text-white border-yellow-500' 
              : 'hover:border-gray-400'
          )}
        >
          {page}
        </button>
      ))}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          'px-3 py-2 border-2 rounded-lg transition-colors',
          'border-gray-300 hover:border-gray-400',
          currentPage === totalPages && 'opacity-50 cursor-not-allowed'
        )}
      >
        下一页
      </button>
    </div>
  )
}

export {
  SearchBox,
  Dropdown,
  DatePicker,
  FilterPanel,
  Pagination
}
