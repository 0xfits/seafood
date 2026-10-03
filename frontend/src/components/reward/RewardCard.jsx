import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Gift, Clock, Star, Crown } from 'lucide-react'
import { cn } from '../../utils'
import { contentStatus } from '../../i18n-content'
import TranslatingBadge from '../i18n/TranslatingBadge'

const RewardCard = ({
  reward,
  onClaim,
  userPoints = 0,
  showStatus = true,
  compact = false
}) => {
  const { t } = useTranslation()

  const getStatusVariant = (status) => {
    switch (status) {
      case 'available': return 'success'
      case 'claimed': return 'inactive'
      case 'locked': return 'warning'
      case 'expired': return 'inactive'
      default: return 'default'
    }
  }

  const getRarityIcon = (rarity) => {
    switch (rarity) {
      case 'legendary': return <Crown className="w-4 h-4 text-yellow-500" />
      case 'epic': return <Star className="w-4 h-4 text-purple-500" />
      case 'rare': return <Star className="w-4 h-4 text-blue-500" />
      default: return <Gift className="w-4 h-4 text-gray-500" />
    }
  }

  const canClaim = reward.status === 'available' && userPoints >= reward.points_required

  return (
    <Card
      variant={reward.variant || 'primary'}
      hover="glow"
      className={cn(
        'relative overflow-hidden',
        compact && 'p-4',
        reward.rarity === 'legendary' && 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100',
        reward.rarity === 'epic' && 'border-purple-400 bg-gradient-to-br from-purple-50 to-purple-100'
      )}
    >
      {/* 稀有度光效 */}
      {reward.rarity && (
        <div className={cn(
          'absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 blur-xl',
          reward.rarity === 'legendary' && 'bg-yellow-400',
          reward.rarity === 'epic' && 'bg-purple-400',
          reward.rarity === 'rare' && 'bg-blue-400'
        )} />
      )}

      <CardHeader className={cn(compact && 'pb-2')}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getRarityIcon(reward.rarity)}
              <Badge variant={getStatusVariant(reward.status)} size="sm">
                {reward.statusText}
              </Badge>
              {reward.limited && (
                <Badge variant="warning" size="sm">
                  {t('rewardCard.limited')}
                </Badge>
              )}
            </div>

            <CardTitle className={cn(
              'text-gray-900 line-clamp-2',
              compact && 'text-base'
            )}>
              {reward.title}
              {/* 「翻译中」小标（TR-2）：`i18n_status ∈ {pending, partial}` 且非 zh 档才渲染 */}
              <TranslatingBadge status={contentStatus(reward)} />
            </CardTitle>
          </div>

          {reward.points_required && (
            <div className="text-right ml-4">
              <div className="text-2xl font-bold text-yellow-600">
                {reward.points_required}
              </div>
                <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn(compact && 'pt-0')}>
        {reward.image && (
          <div className="mb-4 relative">
            <img
              src={reward.image}
              alt={reward.title}
              className="w-full h-32 object-cover rounded-lg"
            />
            {reward.discount && (
              <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                -{reward.discount}%
              </div>
            )}
          </div>
        )}

        {reward.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {reward.description}
          </p>
        )}

        {reward.brand && (
          <div className="flex items-center gap-2 mb-4">
            {reward.brand.logo && (
              <img
                src={reward.brand.logo}
                alt={reward.brand.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            <span className="text-sm text-gray-500">{reward.brand.name}</span>
          </div>
        )}

        {/* 剩余时间 */}
        {reward.time_end && reward.status === 'available' && (
          <div className="flex items-center gap-1 text-sm text-orange-600 mb-3">
            <Clock className="w-4 h-4" />
            <span>{t('rewardCard.timeLimited')}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Gift className="w-4 h-4" />
            <span>{reward.claimed || 0} {t('common.claimedUnit')}</span>
            {reward.total && (
              <span>/ {reward.total}</span>
            )}
          </div>

          <Button
            variant={canClaim ? 'success' : 'inactive'}
            size={compact ? 'sm' : 'md'}
            onClick={() => onClaim?.(reward)}
            disabled={!canClaim}
          >
            {!canClaim && userPoints < reward.points_required
              ? t('rewardCard.insufficient')
              : reward.status === 'claimed'
              ? t('common.claimed')
              : t('rewardCard.claimNow')
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { RewardCard }
