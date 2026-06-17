'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { adminApi } from '@/lib/api'
import { UserRole } from '@/types'
import { formatDate, formatDateTime } from '@/lib/utils'

interface Staff {
  id: number
  name: string
  phone: string
}

interface Schedule {
  id: number
  staffId: number
  date: string
  startTime: string
  endTime: string
  isAvailable: boolean
  orderId: number | null
  createdAt: string
  updatedAt: string
  staff: Staff
  order?: {
    id: number
    orderNo: string
    elderly: {
      id: number
      name: string
      phone: string
    }
    service: {
      id: number
      name: string
    }
  } | null
}

type ViewMode = 'calendar' | 'list'

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const menuItems = [
  { key: 'dashboard', label: '数据概览', icon: '📊', href: '/admin' },
  { key: 'users', label: '用户管理', icon: '👥', href: '/admin/users' },
  { key: 'schedules', label: '排班管理', icon: '📅', href: '/admin/schedules' },
  { key: 'orders', label: '订单管理', icon: '📋', href: '/admin/orders' },
  { key: 'quality', label: '品质检查', icon: '✅', href: '/admin/quality-checks' },
  { key: 'services', label: '服务管理', icon: '🏥', href: '/admin/services' },
]

export default function SchedulesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [schedulesLoading, setSchedulesLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [formData, setFormData] = useState({
    staffId: '',
    date: '',
    startTime: '',
    endTime: '',
    isAvailable: true
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const loadStaffList = useCallback(async () => {
    try {
      const data = await adminApi.getUsers({ role: UserRole.STAFF, pageSize: 100 }) as { data?: Staff[] } | Staff[]
      startTransition(() => {
        setStaffList(Array.isArray(data) ? data : (data.data || []))
      })
    } catch (error) {
      console.error('加载服务人员列表失败:', error)
    }
  }, [])

  const loadSchedules = useCallback(async () => {
    try {
      startTransition(() => {
        setSchedulesLoading(true)
      })
      const params: { staffId?: number; startDate?: string; endDate?: string; date?: string } = {}

      if (selectedStaffId !== '') {
        params.staffId = selectedStaffId as number
      }

      if (selectedDate) {
        params.date = selectedDate
      } else if (viewMode === 'calendar') {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        params.startDate = formatDate(firstDay)
        params.endDate = formatDate(lastDay)
      }

      const data = await adminApi.getSchedules(params) as Schedule[]
      startTransition(() => {
        setSchedules(data || [])
      })
    } catch (error) {
      console.error('加载排班列表失败:', error)
    } finally {
      startTransition(() => {
        setSchedulesLoading(false)
      })
    }
  }, [selectedStaffId, selectedDate, viewMode, currentMonth])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && user.role !== UserRole.ADMIN) {
      router.push('/')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user && user.role === UserRole.ADMIN) {
      loadStaffList()
    }
  }, [user, loadStaffList])

  useEffect(() => {
    if (user && user.role === UserRole.ADMIN) {
      loadSchedules()
    }
  }, [user, loadSchedules])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: Array<{ date: Date | null; isCurrentMonth: boolean }> = []

    for (let i = 0; i < startingDay; i++) {
      const prevMonthDay = new Date(year, month, -startingDay + i + 1)
      days.push({ date: prevMonthDay, isCurrentMonth: false })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDay = new Date(year, month + 1, i)
      days.push({ date: nextMonthDay, isCurrentMonth: false })
    }

    return days
  }

  const getSchedulesForDate = (date: Date) => {
    const dateStr = formatDate(date)
    return schedules.filter(s => formatDate(new Date(s.date)) === dateStr)
  }

  const formatTime = (dateTime: string) => {
    const d = new Date(dateTime)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate('')
  }

  const openCreateModal = () => {
    setEditingSchedule(null)
    setFormData({
      staffId: '',
      date: formatDate(new Date()),
      startTime: '09:00',
      endTime: '18:00',
      isAvailable: true
    })
    setFormErrors({})
    setShowModal(true)
  }

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setFormData({
      staffId: schedule.staffId.toString(),
      date: formatDate(new Date(schedule.date)),
      startTime: formatTime(schedule.startTime),
      endTime: formatTime(schedule.endTime),
      isAvailable: schedule.isAvailable
    })
    setFormErrors({})
    setShowModal(true)
  }

  const handleDelete = async (schedule: Schedule) => {
    if (!confirm(`确定要删除 ${schedule.staff.name} 的排班吗？`)) return
    try {
      await adminApi.deleteSchedule(schedule.id)
      alert('删除成功')
      loadSchedules()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除失败'
      alert(errorMessage)
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.staffId) errors.staffId = '请选择服务人员'
    if (!formData.date) errors.date = '请选择日期'
    if (!formData.startTime) errors.startTime = '请选择开始时间'
    if (!formData.endTime) errors.endTime = '请选择结束时间'
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      errors.endTime = '结束时间必须晚于开始时间'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      const dateTimeStr = formData.date
      const startDateTime = `${dateTimeStr}T${formData.startTime}:00`
      const endDateTime = `${dateTimeStr}T${formData.endTime}:00`

      const submitData = {
        staffId: parseInt(formData.staffId, 10),
        date: dateTimeStr,
        startTime: startDateTime,
        endTime: endDateTime,
        isAvailable: formData.isAvailable
      }

      if (editingSchedule) {
        await adminApi.updateSchedule(editingSchedule.id, submitData)
        alert('更新成功')
      } else {
        await adminApi.createSchedule(submitData)
        alert('创建成功')
      }

      setShowModal(false)
      loadSchedules()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '操作失败'
      alert(errorMessage)
    }
  }

  const clearFilters = () => {
    setSelectedStaffId('')
    setSelectedDate('')
  }

  if (loading || !user || user.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const calendarDays = getDaysInMonth(currentMonth)
  const isToday = (date: Date) => formatDate(date) === formatDate(new Date())

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-800 text-white transition-all duration-300 flex flex-col fixed h-full z-20`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-xl">
              🏥
            </div>
            {sidebarOpen && <span className="font-bold text-lg">养老平台</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                item.key === 'schedules'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center font-bold">
              {user.name.charAt(0)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.name}</p>
                <p className="text-xs text-slate-400">管理员</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">排班管理</h1>
              <p className="text-sm text-gray-500 mt-1">管理服务人员的工作排班</p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-sm"
            >
              <span className="text-lg">+</span>
              新增排班
            </button>
          </div>
        </header>

        <div className="p-6">
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">服务人员：</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                >
                  <option value="">全部</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">日期：</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadSchedules}
                  className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium"
                >
                  🔍 查询
                </button>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  🔄 重置
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-5 py-2 rounded-lg font-medium transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📅 日历视图
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-5 py-2 rounded-lg font-medium transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📋 列表视图
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'calendar' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrevMonth}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-lg"
                  >
                    ◀
                  </button>
                  <h2 className="text-xl font-bold text-gray-800 min-w-[160px] text-center">
                    {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                  </h2>
                  <button
                    onClick={handleNextMonth}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-lg"
                  >
                    ▶
                  </button>
                  <button
                    onClick={handleToday}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium text-sm ml-2"
                  >
                    今天
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-600">可排班</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <span className="text-gray-600">不可用</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <span className="text-gray-600">已有订单</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-7">
                {weekDays.map((day, index) => (
                  <div
                    key={day}
                    className={`p-4 text-center font-semibold text-sm border-b border-gray-100 ${
                      index === 0 || index === 6 ? 'text-red-500' : 'text-gray-600'
                    }`}
                  >
                    周{day}
                  </div>
                ))}

                {calendarDays.map((dayInfo, index) => {
                  if (!dayInfo.date) return <div key={index} className="border-b border-r border-gray-50 bg-gray-50 min-h-[120px]"></div>

                  const daySchedules = getSchedulesForDate(dayInfo.date)
                  const today = isToday(dayInfo.date)

                  return (
                    <div
                      key={index}
                      className={`border-b border-r border-gray-100 min-h-[120px] p-2 ${
                        !dayInfo.isCurrentMonth ? 'bg-gray-50' : 'bg-white hover:bg-blue-50/50'
                      } transition-colors`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                            today
                              ? 'bg-blue-600 text-white'
                              : !dayInfo.isCurrentMonth
                              ? 'text-gray-400'
                              : dayInfo.date.getDay() === 0 || dayInfo.date.getDay() === 6
                              ? 'text-red-500'
                              : 'text-gray-700'
                          }`}
                        >
                          {dayInfo.date.getDate()}
                        </span>
                        {daySchedules.length > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {daySchedules.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {daySchedules.slice(0, 3).map((schedule) => (
                          <div
                            key={schedule.id}
                            onClick={() => openEditModal(schedule)}
                            className={`text-xs p-1.5 rounded-lg cursor-pointer truncate transition-all hover:opacity-80 ${
                              schedule.orderId
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                : schedule.isAvailable
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-red-100 text-red-700 border border-red-200'
                            }`}
                            title={`${schedule.staff.name} ${formatTime(schedule.startTime)}-${formatTime(schedule.endTime)}`}
                          >
                            <span className="font-medium">{schedule.staff.name}</span>
                            <span className="mx-1">·</span>
                            <span>{formatTime(schedule.startTime)}-{formatTime(schedule.endTime)}</span>
                          </div>
                        ))}
                        {daySchedules.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            还有 {daySchedules.length - 3} 条...
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800">排班列表</h2>
                  <span className="text-sm text-gray-500">共 {schedules.length} 条记录</span>
                </div>
              </div>

              {schedulesLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-6xl">📭</span>
                  <p className="text-gray-500 mt-4">暂无排班数据</p>
                  <button
                    onClick={openCreateModal}
                    className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    新增排班
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">服务人员</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">日期</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">时间段</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">关联订单</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">创建时间</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {schedules.map((schedule) => (
                        <tr key={schedule.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                                {schedule.staff.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{schedule.staff.name}</p>
                                <p className="text-xs text-gray-500">{schedule.staff.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {formatDate(new Date(schedule.date))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {schedule.orderId ? (
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                已被预约
                              </span>
                            ) : schedule.isAvailable ? (
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                可预约
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                不可用
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {schedule.order ? (
                              <div>
                                <p className="text-gray-700 font-medium">{schedule.order.orderNo}</p>
                                <p className="text-xs text-gray-500">
                                  {schedule.order.elderly.name} · {schedule.order.service.name}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(schedule.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => openEditModal(schedule)}
                              className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDelete(schedule)}
                              className="text-red-600 hover:text-red-800 font-medium transition-colors"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingSchedule ? '编辑排班' : '新增排班'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  服务人员 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
                    formErrors.staffId ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择服务人员</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.phone})
                    </option>
                  ))}
                </select>
                {formErrors.staffId && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.staffId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
                    formErrors.date ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {formErrors.date && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.date}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    开始时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
                      formErrors.startTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.startTime && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.startTime}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    结束时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
                      formErrors.endTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.endTime && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.endTime}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">排班状态</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="radio"
                      name="isAvailable"
                      checked={formData.isAvailable}
                      onChange={() => setFormData({ ...formData, isAvailable: true })}
                      className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium">
                      ✅ 可预约
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="radio"
                      name="isAvailable"
                      checked={!formData.isAvailable}
                      onChange={() => setFormData({ ...formData, isAvailable: false })}
                      className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                      ❌ 不可用
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                  {editingSchedule ? '保存修改' : '创建排班'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
