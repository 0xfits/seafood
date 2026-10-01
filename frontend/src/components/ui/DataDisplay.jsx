import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react'
import { cn } from '../../utils'

const Table = ({ 
  children, 
  className,
  striped = false,
  hover = true 
}) => (
  <div className="overflow-x-auto">
    <table
      className={cn(
        'w-full border-collapse',
        striped && 'divide-y divide-gray-200',
        hover && 'hover:divide-gray-300',
        className
      )}
    >
      {children}
    </table>
  </div>
)

const TableHeader = ({ children, className }) => (
  <thead className={cn('bg-gray-50', className)}>
    {children}
  </thead>
)

const TableBody = ({ children, className }) => (
  <tbody className={cn('bg-white divide-y divide-gray-200', className)}>
    {children}
  </tbody>
)

const TableRow = ({ children, className, hover: rowHover = true }) => (
  <tr
    className={cn(
      'transition-colors duration-150',
      rowHover && 'hover:bg-gray-50',
      className
    )}
  >
    {children}
  </tr>
)

const TableHead = ({ children, className, sortable = false, onSort, sortDirection }) => (
  <th
    className={cn(
      'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
      sortable && 'cursor-pointer hover:bg-gray-100 transition-colors',
      className
    )}
    onClick={sortable ? onSort : undefined}
  >
    <div className="flex items-center gap-2">
      {children}
      {sortable && (
        <div className="flex flex-col">
          <ChevronUp 
            className={cn(
              'w-3 h-3',
              sortDirection === 'asc' ? 'text-gray-700' : 'text-gray-400'
            )} 
          />
          <ChevronDown 
            className={cn(
              'w-3 h-3 -mt-1',
              sortDirection === 'desc' ? 'text-gray-700' : 'text-gray-400'
            )} 
          />
        </div>
      )}
    </div>
  </th>
)

const TableCell = ({ children, className }) => (
  <td className={cn('px-6 py-4 whitespace-nowrap text-sm text-gray-900', className)}>
    {children}
  </td>
)

const DataTable = ({ 
  data, 
  columns, 
  loading = false,
  emptyMessage,
  className 
}) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {/* P6-I18N-LIT-B5：空态文案走 locale（调用方显式传入优先） */}
        {emptyMessage ?? t('noData')}
      </div>
    )
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              sortable={column.sortable}
              onSort={column.onSort}
              sortDirection={column.sortDirection}
            >
              {column.title}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((column) => (
              <TableCell key={column.key}>
                {column.render ? column.render(row[column.key], row) : row[column.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const StatCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'increase',
  icon,
  variant = 'default',
  className 
}) => {
  const variantClasses = {
    default: 'bg-white border-gray-200',
    primary: 'bg-yellow-50 border-yellow-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200'
  }

  const changeColorClasses = {
    increase: 'text-green-600',
    decrease: 'text-red-600',
    neutral: 'text-gray-600'
  }

  return (
    <div className={cn(
      'border-2 rounded-xl p-6 transition-all duration-200 hover:shadow-lg',
      variantClasses[variant],
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <div className={cn(
              'flex items-center gap-1 text-sm mt-2',
              changeColorClasses[changeType]
            )}>
              <ChevronUp className={cn(
                'w-4 h-4',
                changeType === 'decrease' && 'rotate-180'
              )} />
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-gray-100 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

const Progress = ({ 
  value, 
  max = 100, 
  size = 'md',
  color = 'primary',
  showLabel = true,
  className 
}) => {
  const { t } = useTranslation()
  const percentage = Math.min((value / max) * 100, 100)
  
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6'
  }

  const colorClasses = {
    primary: 'bg-yellow-500',
    success: 'bg-green-500',
    warning: 'bg-orange-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{t('uiCommon.progress')}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn(
        'w-full bg-gray-200 rounded-full overflow-hidden',
        sizeClasses[size]
      )}>
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            colorClasses[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

const Skeleton = ({ 
  lines = 3, 
  className,
  lineHeight = 'h-4' 
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, index) => (
      <div
        key={index}
        className={cn(
          'bg-gray-200 rounded animate-pulse',
          lineHeight,
          index === lines - 1 && 'w-3/4'
        )}
      />
    ))}
  </div>
)

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  DataTable,
  StatCard,
  Progress,
  Skeleton
}
