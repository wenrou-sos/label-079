'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { adminApi } from '@/lib/api'
import { UserRole, ServiceCategory } from '@/types'
import { formatDate, getServiceCategoryText } from '@/lib/utils'

interface StatsOverview {
  totalUsers: number
  totalElderly: number
  totalStaff: number
  totalServices: number
  totalOrders: number
  pendingOrders: number
  acceptedOrders: number
  inProgressOrders: number
  completedOrders: number
  cancelledOrders: number
  totalAmount: number
  totalSubsidy: number
  totalPersonal: number
  averageRating: number
  qualityCheckCount: number
}

interface ServiceRankItem {
  serviceId: number
  serviceName: string
  category: ServiceCategory
  count: number
}

interface StaffRankItem {
  staff: {
    id: number
    name: string
    phone: string
  }
  count: number
}

interface StatsData {
  overview: StatsOverview
  serviceRank: ServiceRankItem[]
  staffRank: StaffRankItem[]
}

const menuItems = [
  { key: 'dashboard', label: '数据概览', href: '/admin', icon: '📊' },
  { key: 'users', label: '用户管理', href: '/admin/users', icon: '👥' },
  { key: 'orders', label: '工单管理', href: '/admin/orders', icon: '📋' },
  { key: 'schedules', label: '排班管理', href: '/admin/schedules', icon: '📅' },
  { key: 'quality-checks', label: '质量抽查', href: '/admin/quality-checks', icon: '🔍' },
  { key: 'reminder-rules', label: '提醒规则', href: '/admin/reminder-rules', icon: '🔔' },
]

const quickActions = [
  { key: 'users', label: '用户管理', href: '/admin/users', icon: '👥', color: 'bg-blue-500' },
  { key: 'orders', label: '订单管理', href: '/admin/orders', icon: '📋', color: 'bg-green-500' },
  { key: 'schedules', label: '排班管理', href: '/admin/schedules', icon: '📅', color: 'bg-purple-500' },
  { key: 'quality-checks', label: '质量抽查', href: '/admin/quality-checks', icon: '🔍', color: 'bg-orange-500' },
  { key: 'reminder-rules', label: '提醒规则', href: '/admin/reminder-rules', icon: '🔔', color: 'bg-pink-500' },
]

export default function AdminDashboardPage() {
  const { user, logout, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/login')
      return
    }

    if (user.role !== UserRole.ADMIN) {
      router.push('/login')
      return
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== UserRole.ADMIN) return

    const fetchStats = async () => {
      try {
        setStatsLoading(true)
        const data = await adminApi.getStats()
        setStats(data as StatsData)
      } catch (err) {
        const error = err as Error
        setError(error.message || '获取统计数据失败')
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [user])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const handleMenuClick = (href: string) => {
    router.push(href)
  }

  const formatCurrency = (value: number) => {
    return `¥${value.toFixed(2)}`
  }

  const formatRating = (value: number) => {
    return value ? value.toFixed(1) : '0.0'
  }

  if (loading || !user || user.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">养老服务平台</h1>
          <p className="text-sm text-gray-500 mt-1">管理后台</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.key}>
                <button
                  onClick={() => handleMenuClick(item.href)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                    item.key === 'dashboard'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <span className="mr-3 text-lg">🚪</span>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">数据概览</h2>
            <p className="text-sm text-gray-500 mt-1">
              {formatDate(new Date())} · 欢迎回来，{user.name}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">管理员</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
              {user.name.charAt(0)}
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {statsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : stats ? (
            <>
              <section className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">核心指标</h3>
                <div className="grid grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">总用户数</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.overview.totalUsers}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                        👥
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">老人数</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.overview.totalElderly}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
                        👴
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">服务人员数</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.overview.totalStaff}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                        👷
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">服务数</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.overview.totalServices}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl">
                        🛠️
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">订单统计</h3>
                <div className="grid grid-cols-5 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">总订单数</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{stats.overview.totalOrders}</p>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">待接单</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.overview.pendingOrders}</p>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">进行中</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">
                      {stats.overview.acceptedOrders + stats.overview.inProgressOrders}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">已完成</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">{stats.overview.completedOrders}</p>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">已取消</p>
                    <p className="text-2xl font-bold text-gray-500 mt-2">{stats.overview.cancelledOrders}</p>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">财务与评价</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">总金额</p>
                        <p className="text-2xl font-bold text-green-600 mt-2">
                          {formatCurrency(stats.overview.totalAmount)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                        💰
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">总补贴</p>
                        <p className="text-2xl font-bold text-blue-600 mt-2">
                          {formatCurrency(stats.overview.totalSubsidy)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                        🏛️
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">平均评分</p>
                        <p className="text-2xl font-bold text-yellow-600 mt-2">
                          ⭐ {formatRating(stats.overview.averageRating)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">
                        ⭐
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">服务使用排行榜</h3>
                    <div className="space-y-3">
                      {stats.serviceRank.length > 0 ? (
                        stats.serviceRank.map((item, index) => (
                          <div
                            key={item.serviceId}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                                  index === 0
                                    ? 'bg-yellow-500'
                                    : index === 1
                                    ? 'bg-gray-400'
                                    : index === 2
                                    ? 'bg-orange-400'
                                    : 'bg-gray-300'
                                }`}
                              >
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{item.serviceName}</p>
                                <p className="text-xs text-gray-500">
                                  {getServiceCategoryText(item.category)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-blue-600">{item.count}</p>
                              <p className="text-xs text-gray-500">次</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">暂无数据</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">服务人员业绩排行榜</h3>
                    <div className="space-y-3">
                      {stats.staffRank.length > 0 ? (
                        stats.staffRank.map((item, index) => (
                          <div
                            key={item.staff.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                                  index === 0
                                    ? 'bg-yellow-500'
                                    : index === 1
                                    ? 'bg-gray-400'
                                    : index === 2
                                    ? 'bg-orange-400'
                                    : 'bg-gray-300'
                                }`}
                              >
                                {index + 1}
                              </div>
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                                {item.staff.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{item.staff.name}</p>
                                <p className="text-xs text-gray-500">{item.staff.phone}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">{item.count}</p>
                              <p className="text-xs text-gray-500">单</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">暂无数据</div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">快捷操作</h3>
                <div className="grid grid-cols-5 gap-6">
                  {quickActions.map((action) => (
                    <button
                      key={action.key}
                      onClick={() => handleMenuClick(action.href)}
                      className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-left group"
                    >
                      <div
                        className={`w-14 h-14 rounded-xl ${action.color} flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform`}
                      >
                        {action.icon}
                      </div>
                      <p className="font-semibold text-gray-800">{action.label}</p>
                      <p className="text-sm text-gray-500 mt-1">点击进入管理</p>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
