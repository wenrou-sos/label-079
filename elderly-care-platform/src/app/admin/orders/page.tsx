'use client'

import { useState, useEffect, useCallback, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { orderApi } from '@/lib/api'
import { OrderStatus, UserRole, ServiceCategory } from '@/types'
import { getStatusText, getServiceCategoryText, formatDateTime } from '@/lib/utils'

interface OrderStatusLog {
  id: number
  orderId: number
  status: OrderStatus
  operatorId: number
  remark?: string
  createdAt: string
  operator: {
    id: number
    name: string
    role: UserRole
  }
}

interface Review {
  id: number
  orderId: number
  reviewerId: number
  revieweeId: number
  rating: number
  comment?: string
  images?: string
  createdAt: string
  reviewer: {
    id: number
    name: string
  }
}

interface Order {
  id: number
  orderNo: string
  elderlyId: number
  staffId?: number
  serviceId: number
  status: OrderStatus
  scheduledTime: string
  actualStartTime?: string
  actualEndTime?: string
  checkInLatitude?: number
  checkInLongitude?: number
  checkOutLatitude?: number
  checkOutLongitude?: number
  totalAmount: number
  subsidyAmount: number
  personalAmount: number
  address: string
  latitude?: number
  longitude?: number
  remark?: string
  cancelReason?: string
  createdAt: string
  updatedAt: string
  elderly: {
    id: number
    name: string
    phone: string
    address: string
  }
  staff?: {
    id: number
    name: string
    phone: string
    avatar?: string
  }
  service: {
    id: number
    category: ServiceCategory
    name: string
    description: string
    basePrice: number
    duration: number
    unit: string
  }
  statusLogs: OrderStatusLog[]
  review?: Review
}

interface GetOrdersParams {
  status?: string
  category?: string
  startDate?: string
  endDate?: string
  keyword?: string
  page: number
  pageSize: number
}

const menuItems = [
  { key: 'dashboard', label: '数据概览', href: '/admin', icon: '📊' },
  { key: 'users', label: '用户管理', href: '/admin/users', icon: '👥' },
  { key: 'orders', label: '工单管理', href: '/admin/orders', icon: '📋' },
  { key: 'schedules', label: '排班管理', href: '/admin/schedules', icon: '📅' },
  { key: 'quality-checks', label: '质量抽查', href: '/admin/quality-checks', icon: '🔍' },
]

const statusFilterOptions = [
  { value: '', label: '全部' },
  { value: OrderStatus.PENDING, label: '待接单' },
  { value: OrderStatus.ACCEPTED, label: '已接单' },
  { value: OrderStatus.IN_PROGRESS, label: '服务中' },
  { value: OrderStatus.COMPLETED, label: '已完成' },
  { value: OrderStatus.CANCELLED, label: '已取消' },
]

const categoryFilterOptions = [
  { value: '', label: '全部' },
  { value: ServiceCategory.MEAL, label: '助餐服务' },
  { value: ServiceCategory.BATH, label: '助浴服务' },
  { value: ServiceCategory.CLEANING, label: '助洁服务' },
  { value: ServiceCategory.MEDICAL, label: '助医服务' },
  { value: ServiceCategory.COMPANION, label: '陪护服务' },
]

type SortField = 'orderNo' | 'scheduledTime' | 'totalAmount' | 'createdAt'
type SortOrder = 'asc' | 'desc'

export default function AdminOrdersPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [ordersLoading, setOrdersLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [keyword, setKeyword] = useState<string>('')

  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }
    if (!loading && user && user.role !== UserRole.ADMIN) {
      router.push('/')
    }
  }, [loading, user, router])

  const loadOrders = useCallback(async () => {
    startTransition(() => {
      setOrdersLoading(true)
    })
    try {
      const params: GetOrdersParams = { page, pageSize }
      if (statusFilter) params.status = statusFilter
      if (categoryFilter) params.category = categoryFilter
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (keyword) params.keyword = keyword

      const result = await orderApi.getList(params) as { data: Order[]; total: number }
      startTransition(() => {
        setOrders(result.data || [])
        setTotal(result.total || 0)
      })
    } catch (error) {
      console.error('加载订单列表失败:', error)
      alert((error as Error).message || '加载订单列表失败')
    } finally {
      startTransition(() => {
        setOrdersLoading(false)
      })
    }
  }, [page, pageSize, statusFilter, categoryFilter, startDate, endDate, keyword])

  useEffect(() => {
    if (user && user.role === UserRole.ADMIN) {
      loadOrders()
    }
  }, [loadOrders, user])

  const sortedOrders = useMemo(() => {
    const sorted = [...orders]
    sorted.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'orderNo':
          comparison = a.orderNo.localeCompare(b.orderNo)
          break
        case 'scheduledTime':
          comparison = new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
          break
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount
          break
        case 'createdAt':
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [orders, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadOrders()
  }

  const handleFilterChange = () => {
    setPage(1)
    loadOrders()
  }

  const handleResetFilters = () => {
    setStatusFilter('')
    setCategoryFilter('')
    setStartDate('')
    setEndDate('')
    setKeyword('')
    setPage(1)
  }

  const handleViewDetail = async (orderId: number) => {
    setDetailLoading(true)
    try {
      const detail = await orderApi.getDetail(orderId) as Order
      setSelectedOrder(detail)
      setShowDetailModal(true)
    } catch (error) {
      console.error('获取订单详情失败:', error)
      alert((error as Error).message || '获取订单详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCancelOrder = (orderId: number) => {
    setCancelingOrderId(orderId)
    setCancelReason('')
    setShowCancelModal(true)
  }

  const confirmCancelOrder = async () => {
    if (!cancelingOrderId) return

    if (!cancelReason.trim()) {
      alert('请输入取消原因')
      return
    }

    setCancelLoading(true)
    try {
      await orderApi.cancel(cancelingOrderId, cancelReason)
      alert('订单取消成功')
      setShowCancelModal(false)
      setCancelingOrderId(null)
      setCancelReason('')
      loadOrders()
    } catch (error) {
      console.error('取消订单失败:', error)
      alert((error as Error).message || '取消订单失败')
    } finally {
      setCancelLoading(false)
    }
  }

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [OrderStatus.ACCEPTED]: 'bg-blue-100 text-blue-800',
      [OrderStatus.IN_PROGRESS]: 'bg-purple-100 text-purple-800',
      [OrderStatus.COMPLETED]: 'bg-green-100 text-green-800',
      [OrderStatus.CANCELLED]: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusTimelineIcon = (status: OrderStatus) => {
    const icons: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: '⏳',
      [OrderStatus.ACCEPTED]: '✅',
      [OrderStatus.IN_PROGRESS]: '🏃',
      [OrderStatus.COMPLETED]: '🎉',
      [OrderStatus.CANCELLED]: '❌',
    }
    return icons[status] || '📝'
  }

  const canCancelOrder = (order: Order) => {
    return order.status !== OrderStatus.IN_PROGRESS && order.status !== OrderStatus.COMPLETED
  }

  const formatCurrency = (value: number) => {
    return `¥${value.toFixed(2)}`
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  const totalPages = Math.ceil(total / pageSize)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const handleMenuClick = (href: string) => {
    router.push(href)
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
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg flex flex-col transition-all duration-300`}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          {!sidebarCollapsed && (
            <>
              <div>
                <h1 className="text-xl font-bold text-blue-600">养老服务平台</h1>
                <p className="text-sm text-gray-500 mt-1">管理后台</p>
              </div>
            </>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.key}>
                <button
                  onClick={() => handleMenuClick(item.href)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                    item.key === 'orders'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
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
            {!sidebarCollapsed && <span>退出登录</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">工单管理</h2>
            <p className="text-sm text-gray-500 mt-1">
              {new Date().toLocaleDateString('zh-CN')} · 欢迎回来，{user.name}
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
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">订单状态</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-36"
                  >
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">服务分类</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-36"
                  >
                    {categoryFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">开始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">结束日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex flex-col flex-1 min-w-[200px]">
                  <label className="text-sm font-medium text-gray-700 mb-1">关键词搜索</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="订单号/用户姓名/手机号"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      搜索
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleFilterChange}
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    筛选
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    重置
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-4 text-sm text-gray-500">
              共 {total} 条记录，当前第 {page} / {totalPages || 1} 页
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {ordersLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : sortedOrders.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg mb-2">暂无订单数据</p>
                <p className="text-sm">请尝试调整筛选条件</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('orderNo')}
                        >
                          <div className="flex items-center gap-1">
                            订单号
                            <span className="text-gray-400">{renderSortIcon('orderNo')}</span>
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">服务名称</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">服务分类</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">老人姓名</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">服务人员</th>
                        <th
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('scheduledTime')}
                        >
                          <div className="flex items-center gap-1">
                            预约时间
                            <span className="text-gray-400">{renderSortIcon('scheduledTime')}</span>
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
                        <th
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort('totalAmount')}
                        >
                          <div className="flex items-center gap-1">
                            金额
                            <span className="text-gray-400">{renderSortIcon('totalAmount')}</span>
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{order.orderNo}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{order.service.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {getServiceCategoryText(order.service.category)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div>
                              <p className="font-medium">{order.elderly.name}</p>
                              <p className="text-gray-500 text-xs">{order.elderly.phone}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.staff ? (
                              <div>
                                <p className="font-medium text-gray-900">{order.staff.name}</p>
                                <p className="text-gray-500 text-xs">{order.staff.phone}</p>
                              </div>
                            ) : (
                              <span className="text-gray-400">待分配</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateTime(order.scheduledTime)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              {getStatusText(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {formatCurrency(order.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleViewDetail(order.id)}
                                className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                查看详情
                              </button>
                              {canCancelOrder(order) && (
                                <button
                                  onClick={() => handleCancelOrder(order.id)}
                                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  取消订单
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      显示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        首页
                      </button>
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        上一页
                      </button>
                      <span className="px-4 py-1 text-gray-700 font-medium bg-gray-50 rounded">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        下一页
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        末页
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">订单详情</h3>
                <p className="text-sm text-gray-500 mt-1">订单号：{selectedOrder.orderNo}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedOrder(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-20 flex-shrink-0">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 p-6">
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-800 border-b pb-2">基本信息</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">订单号：</span>
                        <span className="font-mono text-gray-900">{selectedOrder.orderNo}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">状态：</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                          {getStatusText(selectedOrder.status)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">服务名称：</span>
                        <span className="text-gray-900">{selectedOrder.service.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">服务分类：</span>
                        <span className="text-gray-900">{getServiceCategoryText(selectedOrder.service.category)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">服务时长：</span>
                        <span className="text-gray-900">{selectedOrder.service.duration} {selectedOrder.service.unit}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">预约时间：</span>
                        <span className="text-gray-900">{formatDateTime(selectedOrder.scheduledTime)}</span>
                      </div>
                      {selectedOrder.actualStartTime && (
                        <div>
                          <span className="text-gray-500">实际开始：</span>
                          <span className="text-gray-900">{formatDateTime(selectedOrder.actualStartTime)}</span>
                        </div>
                      )}
                      {selectedOrder.actualEndTime && (
                        <div>
                          <span className="text-gray-500">实际结束：</span>
                          <span className="text-gray-900">{formatDateTime(selectedOrder.actualEndTime)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-800 border-b pb-2">人员信息</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">老人姓名：</span>
                        <span className="text-gray-900 font-medium">{selectedOrder.elderly.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">联系电话：</span>
                        <span className="text-gray-900">{selectedOrder.elderly.phone}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">服务地址：</span>
                        <span className="text-gray-900">{selectedOrder.address}</span>
                      </div>
                      {selectedOrder.staff && (
                        <>
                          <div>
                            <span className="text-gray-500">服务人员：</span>
                            <span className="text-gray-900 font-medium">{selectedOrder.staff.name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">联系电话：</span>
                            <span className="text-gray-900">{selectedOrder.staff.phone}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-800 border-b pb-2 mb-4">价格明细</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">服务基础价格</span>
                        <span className="text-gray-900">{formatCurrency(selectedOrder.service.basePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">总金额</span>
                        <span className="text-gray-900 font-medium">{formatCurrency(selectedOrder.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>补贴金额</span>
                        <span className="font-medium">- {formatCurrency(selectedOrder.subsidyAmount)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-3 flex justify-between">
                        <span className="font-medium text-gray-800">个人支付</span>
                        <span className="font-bold text-lg text-red-600">{formatCurrency(selectedOrder.personalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {(selectedOrder.checkInLatitude || selectedOrder.checkOutLatitude) && (
                  <div className="mb-8">
                    <h4 className="text-sm font-semibold text-gray-800 border-b pb-2 mb-4">打卡信息</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedOrder.checkInLatitude && (
                        <div className="bg-green-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">📍 打卡签到</p>
                          <p className="text-xs text-gray-600">
                            纬度：{selectedOrder.checkInLatitude?.toFixed(6)}
                          </p>
                          <p className="text-xs text-gray-600">
                            经度：{selectedOrder.checkInLongitude?.toFixed(6)}
                          </p>
                        </div>
                      )}
                      {selectedOrder.checkOutLatitude && (
                        <div className="bg-orange-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-orange-800 mb-2">📍 打卡签退</p>
                          <p className="text-xs text-gray-600">
                            纬度：{selectedOrder.checkOutLatitude?.toFixed(6)}
                          </p>
                          <p className="text-xs text-gray-600">
                            经度：{selectedOrder.checkOutLongitude?.toFixed(6)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-800 border-b pb-2 mb-4">状态流转</h4>
                  <div className="relative">
                    {selectedOrder.statusLogs.map((log, index) => (
                      <div key={log.id} className="flex gap-4 pb-6 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                            {getStatusTimelineIcon(log.status)}
                          </div>
                          {index < selectedOrder.statusLogs.length - 1 && (
                            <div className="w-0.5 flex-1 bg-gray-200 mt-1"></div>
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                              {getStatusText(log.status)}
                            </span>
                            <span className="text-xs text-gray-500">
                              操作人：{log.operator.name}
                            </span>
                          </div>
                          {log.remark && (
                            <p className="text-sm text-gray-600 mb-1">{log.remark}</p>
                          )}
                          <p className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.review && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 border-b pb-2 mb-4">评价信息</h4>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-500 text-lg">
                          {'⭐'.repeat(selectedOrder.review.rating)}
                        </span>
                        <span className="text-sm font-medium text-gray-800">
                          {selectedOrder.review.rating} 分
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">
                          评价人：{selectedOrder.review.reviewer.name}
                        </span>
                      </div>
                      {selectedOrder.review.comment && (
                        <p className="text-sm text-gray-600">{selectedOrder.review.comment}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {formatDateTime(selectedOrder.review.createdAt)}
                      </p>
                    </div>
                  </div>
                )}

                {selectedOrder.remark && (
                  <div className="mt-8">
                    <h4 className="text-sm font-semibold text-gray-800 border-b pb-2 mb-2">备注信息</h4>
                    <p className="text-sm text-gray-600">{selectedOrder.remark}</p>
                  </div>
                )}

                {selectedOrder.cancelReason && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-800 border-b pb-2 mb-2">取消原因</h4>
                    <p className="text-sm text-red-600">{selectedOrder.cancelReason}</p>
                  </div>
                )}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              {selectedOrder && canCancelOrder(selectedOrder) && (
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    handleCancelOrder(selectedOrder.id)
                  }}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  取消订单
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedOrder(null)
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">取消订单</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">确定要取消该订单吗？</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  取消原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="请输入取消原因"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelingOrderId(null)
                  setCancelReason('')
                }}
                disabled={cancelLoading}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmCancelOrder}
                disabled={cancelLoading}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {cancelLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                确认取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
