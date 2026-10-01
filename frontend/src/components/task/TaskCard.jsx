import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Clock, Users, Trophy, Star } from 'lucide-react'
import { cn } from '../../utils'
import DashJ from '../ui/DashJ'
import { contentStatus } from '../../i18n-content'
import TranslatingBadge from '../i18n/TranslatingBadge'

const TaskCard = ({
  task,
  onAction,
  showStatus = true,
  compact = false
}) => {
  const { t } = useTranslation()

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success'
      case 'pending': return 'warning'
      case 'expired': return 'inactive'
      default: return 'default'
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'join': return <Users className="w-4 h-4" />
      case 'trade': return <Trophy className="w-4 h-4" />
      case 'vote': return <Star className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getTimeRemaining = (endTime) => {
    if (!endTime) return null
    const now = new Date()
    const end = new Date(endTime)
    const diff = end - now

    if (diff <= 0) return t('common.ended')

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days > 30) return t('giftStatusLimited')
    if (days > 7) return t('taskCard.weeks', { n: Math.floor(days / 7) })
    if (days > 1) return t('taskCard.days', { n: days })
    return t('taskCard.endingSoon')
  }

  return (
    <Card
      variant={task.variant || 'default'}
      hover="lift"
      className={cn(
        'relative overflow-hidden',
        compact && 'p-4'
      )}
    >
      {/* 任务状态指示条 */}
      {showStatus && task.status && (
        <div className={cn(
          'absolute top-0 left-0 right-0 h-1',
          task.status === 'active' && 'bg-green-400',
          task.status === 'pending' && 'bg-yellow-400',
          task.status === 'expired' && 'bg-gray-300'
        )} />
      )}

      <CardHeader className={cn(compact && 'pb-2')}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getTypeIcon(task.type)}
              <Badge variant={getStatusVariant(task.status)} size="sm">
                {task.statusText}
              </Badge>
              {task.timeRemaining && (
                <Badge variant="inactive" size="sm">
                  {getTimeRemaining(task.time_end)}
                </Badge>
              )}
            </div>

            <CardTitle className={cn(
              'text-gray-900 line-clamp-2',
              compact && 'text-base'
            )}>
              {task.title}
              {/* 「翻译中」小标（TR-2）：`i18n_status ∈ {pending, partial}` 且非 zh 档才渲染 */}
              <TranslatingBadge status={contentStatus(task)} />
            </CardTitle>
          </div>

          {task.points && (
            <div className="text-right ml-4">
              <div className="text-2xl font-bold text-yellow-600">
                {task.points}
              </div>
              <DashJ size="sm" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn(compact && 'pt-0')}>
        {task.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {task.description}
          </p>
        )}

        {task.brand && (
          <div className="flex items-center gap-2 mb-4">
            {task.brand.logo && (
              <img
                src={task.brand.logo}
                alt={task.brand.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            <span className="text-sm text-gray-500">{task.brand.name}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="w-4 h-4" />
            <span>{task.participants || 0} {t('common.participantsUnit')}</span>
          </div>

          <Button
            variant={task.status === 'active' ? 'primary' : 'inactive'}
            size={compact ? 'sm' : 'md'}
            onClick={() => onAction?.(task)}
            disabled={task.status !== 'active'}
          >
            {task.actionText || (task.status === 'active' ? t('common.joinNow') : t('common.unavailable'))}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { TaskCard }
