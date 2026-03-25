import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Clock, Users, Trophy, Star } from 'lucide-react'
import { cn } from '../../utils'

const TaskCard = ({ 
  task, 
  onAction, 
  showStatus = true,
  compact = false 
}) => {
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
    
    if (diff <= 0) return '已结束'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days > 30) return '限时'
    if (days > 7) return `${Math.floor(days / 7)}周`
    if (days > 1) return `${days}天`
    return '即将结束'
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
            </CardTitle>
          </div>
          
          {task.points && (
            <div className="text-right ml-4">
              <div className="text-2xl font-bold text-yellow-600">
                {task.points}
              </div>
              <div className="text-xs text-gray-500">积分</div>
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
            <span>{task.participants || 0} 人参与</span>
          </div>
          
          <Button 
            variant={task.status === 'active' ? 'primary' : 'inactive'}
            size={compact ? 'sm' : 'md'}
            onClick={() => onAction?.(task)}
            disabled={task.status !== 'active'}
          >
            {task.actionText || (task.status === 'active' ? '立即参与' : '不可用')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { TaskCard }
