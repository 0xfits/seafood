import React, { useState } from 'react'
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Upload, 
  Settings,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react'

// 新的 UI 组件
import { Container, Grid } from '../components/layout'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { 
  Modal, 
  ModalHeader, 
  ModalTitle, 
  ModalContent, 
  ModalFooter 
} from '../components/ui/Modal'
import { 
  Form, 
  FormField, 
  Input, 
  Textarea, 
  Select, 
  Checkbox, 
  RadioGroup 
} from '../components/ui/Form'
import { 
  DataTable, 
  StatCard, 
  Progress, 
  Skeleton 
} from '../components/ui/DataDisplay'
import { 
  SearchBox, 
  Dropdown, 
  DatePicker, 
  FilterPanel, 
  Pagination 
} from '../components/ui/Advanced'
import { FadeIn, SlideUp, StaggerContainer } from '../components/ui/Motion'
import { ResponsiveContainer, ResponsiveGrid } from '../components/ui/Responsive'

const DemoPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    bio: '',
    newsletter: false
  })
  const [activeFilters, setActiveFilters] = useState({})

  // 模拟表格数据
  const tableData = [
    { id: 1, name: '张三', email: 'zhangsan@example.com', role: '管理员', status: '活跃', joinDate: '2024-01-15' },
    { id: 2, name: '李四', email: 'lisi@example.com', role: '用户', status: '活跃', joinDate: '2024-01-20' },
    { id: 3, name: '王五', email: 'wangwu@example.com', role: '用户', status: '待审核', joinDate: '2024-02-01' },
    { id: 4, name: '赵六', email: 'zhaoliu@example.com', role: '管理员', status: '活跃', joinDate: '2024-02-10' },
    { id: 5, name: '钱七', email: 'qianqi@example.com', role: '用户', status: '禁用', joinDate: '2024-02-15' }
  ]

  // 表格列配置
  const tableColumns = [
    {
      key: 'name',
      title: '姓名',
      sortable: true
    },
    {
      key: 'email',
      title: '邮箱'
    },
    {
      key: 'role',
      title: '角色',
      render: (value) => (
        <Badge variant={value === '管理员' ? 'warning' : 'primary'} size="sm">
          {value}
        </Badge>
      )
    },
    {
      key: 'status',
      title: '状态',
      render: (value) => {
        const statusConfig = {
          '活跃': { variant: 'success', color: 'text-green-600' },
          '待审核': { variant: 'warning', color: 'text-yellow-600' },
          '禁用': { variant: 'inactive', color: 'text-gray-600' }
        }
        const config = statusConfig[value] || statusConfig['活跃']
        return (
          <Badge variant={config.variant} size="sm">
            {value}
          </Badge>
        )
      }
    },
    {
      key: 'joinDate',
      title: '加入时间'
    }
  ]

  // 筛选配置
  const filterConfig = [
    {
      key: 'role',
      label: '角色',
      type: 'select',
      placeholder: '选择角色',
      options: [
        { value: '管理员', label: '管理员' },
        { value: '用户', label: '用户' }
      ]
    },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      placeholder: '选择状态',
      options: [
        { value: '活跃', label: '活跃' },
        { value: '待审核', label: '待审核' },
        { value: '禁用', label: '禁用' }
      ]
    },
    {
      key: 'dateRange',
      label: '日期范围',
      type: 'date',
      placeholder: '选择日期'
    }
  ]

  const handleFormSubmit = (e) => {
    e.preventDefault()
    console.log('表单提交:', formData)
    // 这里可以添加表单提交逻辑
  }

  const handleFilterChange = (key, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleClearFilters = () => {
    setActiveFilters({})
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8">
        {/* 页面标题 */}
        <FadeIn>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              UI 组件演示
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              展示所有新增的交互组件和功能
            </p>
          </div>
        </FadeIn>

        {/* 统计卡片 */}
        <SlideUp delay={200}>
          <ResponsiveGrid sm={2} md={4} gap={6}>
            <StatCard
              title="总用户数"
              value="1,234"
              change={12.5}
              changeType="increase"
              icon={<User className="w-6 h-6 text-blue-600" />}
              variant="info"
            />
            <StatCard
              title="活跃用户"
              value="856"
              change={8.2}
              changeType="increase"
              icon={<CheckCircle className="w-6 h-6 text-green-600" />}
              variant="success"
            />
            <StatCard
              title="待审核"
              value="23"
              change={-5.1}
              changeType="decrease"
              icon={<AlertCircle className="w-6 h-6 text-yellow-600" />}
              variant="warning"
            />
            <StatCard
              title="本月新增"
              value="156"
              change={15.3}
              changeType="increase"
              icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
              variant="primary"
            />
          </ResponsiveGrid>
        </SlideUp>

        {/* 搜索和筛选 */}
        <SlideUp delay={400}>
          <Card>
            <CardHeader>
              <CardTitle>搜索和筛选</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <SearchBox
                    placeholder="搜索用户..."
                    value={searchValue}
                    onChange={setSearchValue}
                    onClear={() => setSearchValue('')}
                  />
                </div>
                <DatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  placeholder="选择日期"
                />
                <Dropdown
                  trigger={
                    <Button variant="secondary" className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      操作
                    </Button>
                  }
                >
                  <button className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors">
                    导出数据
                  </button>
                  <button className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors">
                    导入数据
                  </button>
                  <hr className="my-2" />
                  <button className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors">
                    删除选中
                  </button>
                </Dropdown>
              </div>
              
              <FilterPanel
                filters={filterConfig}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </CardContent>
          </Card>
        </SlideUp>

        {/* 数据表格 */}
        <SlideUp delay={600}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>用户管理</CardTitle>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    导入
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </Button>
                  <Button 
                    variant="success" 
                    size="sm"
                    onClick={() => setIsModalOpen(true)}
                  >
                    添加用户
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={tableData}
                columns={tableColumns}
                loading={false}
                emptyMessage="暂无用户数据"
              />
              
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={10}
                  onPageChange={setCurrentPage}
                  showPageNumbers={true}
                />
              </div>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 表单演示 */}
        <SlideUp delay={800}>
          <Card>
            <CardHeader>
              <CardTitle>表单组件演示</CardTitle>
            </CardHeader>
            <CardContent>
              <Form onSubmit={handleFormSubmit} className="space-y-6">
                <ResponsiveGrid sm={1} md={2} gap={6}>
                  <FormField
                    label="姓名"
                    required
                    description="请输入您的真实姓名"
                  >
                    <Input
                      placeholder="请输入姓名"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      leftIcon={<User className="w-4 h-4" />}
                    />
                  </FormField>
                  
                  <FormField
                    label="邮箱"
                    required
                    description="请输入有效的邮箱地址"
                  >
                    <Input
                      type="email"
                      placeholder="请输入邮箱"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      leftIcon={<Mail className="w-4 h-4" />}
                    />
                  </FormField>
                </ResponsiveGrid>
                
                <FormField label="角色">
                  <Select
                    value={formData.role}
                    onChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                    placeholder="选择角色"
                    options={[
                      { value: 'admin', label: '管理员' },
                      { value: 'user', label: '普通用户' },
                      { value: 'guest', label: '访客' }
                    ]}
                  />
                </FormField>
                
                <FormField label="个人简介">
                  <Textarea
                    placeholder="请输入个人简介..."
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    rows={4}
                  />
                </FormField>
                
                <FormField label="性别">
                  <RadioGroup
                    name="gender"
                    value={formData.gender}
                    onChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                    options={[
                      { value: 'male', label: '男' },
                      { value: 'female', label: '女' },
                      { value: 'other', label: '其他' }
                    ]}
                  />
                </FormField>
                
                <FormField>
                  <Checkbox
                    label="订阅新闻通讯"
                    checked={formData.newsletter}
                    onChange={(e) => setFormData(prev => ({ ...prev, newsletter: e.target.checked }))}
                  />
                </FormField>
                
                <div className="flex gap-4">
                  <Button type="submit" variant="primary">
                    提交表单
                  </Button>
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={() => setFormData({
                      name: '',
                      email: '',
                      role: '',
                      bio: '',
                      newsletter: false
                    })}
                  >
                    重置
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 进度条和加载状态 */}
        <SlideUp delay={1000}>
          <Card>
            <CardHeader>
              <CardTitle>进度和加载状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">进度条</h3>
                <div className="space-y-4">
                  <Progress value={25} color="primary" />
                  <Progress value={50} color="success" />
                  <Progress value={75} color="warning" />
                  <Progress value={90} color="error" />
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-4">骨架屏</h3>
                <div className="space-y-4">
                  <Skeleton lines={3} />
                  <Skeleton lines={5} />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton lines={4} />
                    <Skeleton lines={4} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideUp>

        {/* 添加用户模态框 */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          size="lg"
        >
          <ModalHeader>
            <ModalTitle>添加新用户</ModalTitle>
          </ModalHeader>
          <ModalContent>
            <Form className="space-y-4">
              <FormField label="姓名" required>
                <Input placeholder="请输入姓名" />
              </FormField>
              <FormField label="邮箱" required>
                <Input type="email" placeholder="请输入邮箱" />
              </FormField>
              <FormField label="密码" required>
                <Input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </FormField>
              <FormField label="角色">
                <Select placeholder="选择角色" options={[
                  { value: 'admin', label: '管理员' },
                  { value: 'user', label: '普通用户' }
                ]} />
              </FormField>
            </Form>
          </ModalContent>
          <ModalFooter>
            <Button 
              variant="secondary" 
              onClick={() => setIsModalOpen(false)}
            >
              取消
            </Button>
            <Button 
              variant="primary"
              onClick={() => setIsModalOpen(false)}
            >
              添加用户
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </ResponsiveContainer>
  )
}

export default DemoPage
