import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, Badge } from '../../components/ui'
import { RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchApiJson } from '../../admin-utils'

// ============================================================================
// 后台「任务管理」（`/dashboard/tasks`）· **campaign 口径只读列表**
// ----------------------------------------------------------------------------
// 选型（job 体系下线收尾 · 2026-10-21）：**不删面板，改走 campaign 读口** ——
//   · 旧数据面 `GET /api/task/all`（悬赏全表）已随 job 后端删除 ⇒ 再调只会 404（错请求）；
//   · 现「任务」唯一实体 = campaign task，公开读口 `GET /api/campaign/all`
//     （`CampaignView[]`：仅 `active` 活动，行内嵌套 `tasks[]`）—— 与 `/campaign` 列表页同一读口；
//   · 已知边界（**不粉饰**）：该读口只给 active 活动下的任务、无分页、无「全状态」视图，
//     且**没有** admin 专属全量任务读口 ⇒ 本面板**不给任务总数**，只逐活动列清单；
//   · 写口（`POST /api/admin/task/{create,update,delete}`）早已 410 ⇒ 面板自始只读（无新增/编辑/删除）。
// 行键（后端 `normalizeTaskRow` 逐字）：`task_id / title / description / status / reward_amount_primary / ...`。
// ============================================================================

const CAMPAIGN_LIST_URL = '/api/campaign/all'

/** `CampaignView[]` ⇒ 渲染分组（只留有任务的 active 活动） */
const toCampaignGroups = (campaigns) => (Array.isArray(campaigns) ? campaigns : [])
  .map((campaign) => ({
    campaignId: campaign?.campaign_id ?? campaign?.campaignId ?? null,
    campaignTitle: campaign?.title || '',
    tasks: (Array.isArray(campaign?.tasks) ? campaign.tasks : []).map((task) => ({
      taskId: task?.task_id ?? task?.taskId ?? null,
      title: task?.title || '',
      description: task?.description || '',
      points: task?.reward_amount_primary ?? 0,
      isOpen: task?.status === 'active',
    })),
  }))
  .filter((group) => group.tasks.length > 0)

const TasksManagement = () => {
  const { t } = useTranslation()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadTasks = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      setGroups(toCampaignGroups(await fetchApiJson(CAMPAIGN_LIST_URL)))
    } catch (error) {
      console.error('Error loading campaign tasks:', error)
      toast.error(t('adminTasks.loadFailed', { message: error.message }))
      setGroups([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  return (
    <div className="space-y-6" data-sf-m="admin-tasks">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.tasks')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('adminTasks.readOnlyNotice')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadTasks({ silent: true })} disabled={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">{t('adminCommon.loading')}</div>
      ) : groups.length === 0 ? (
        <Card variant="inactive">
          <CardContent className="text-center py-8 text-gray-600" data-sf-m="admin-tasks-empty">
            {t('campaign.tasksEmpty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={`campaign-${group.campaignId}`} className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">
                {t('campaign.listTitle')} · {group.campaignTitle}
              </h3>
              <div className="grid gap-4">
                {group.tasks.map((task) => (
                  <Card key={`task-${task.taskId}`} data-sf-task={task.taskId}>
                    <CardContent className="p-4">
                      <h4 className="font-semibold">{task.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {task.description || t('adminCommon.noDescription')}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="primary">{t('adminCommon.pointsValue', { value: task.points })}</Badge>
                        <Badge variant={task.isOpen ? 'success' : 'warning'}>
                          {task.isOpen ? t('adminTasks.stateOpen') : t('adminTasks.stateClosed')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default TasksManagement
