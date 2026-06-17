'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { adminApi, orderApi } from '@/lib/api'
import { UserRole } from '@/types'
import { formatDateTime } from '@/lib/utils'

interface Staff {
  id: number
  name: string
  phone: string
}

interface Elderly {
  id: number
  name: string
  phone: string
}

interface Service {
  id: number
  name: string
}

interface Order {
  id: number
  orderNo: string
  elderly: Elderly
  service: Service
  staff?: Staff
}

interface QualityCheck {
  id: number
  orderId: number
  adminId: number
  staffId: number
  checkType: string
  result: string
  score: number | null
  remark: string | null
  checkedAt: string | null
  createdAt: string
  updatedAt: string
  order: Order
  admin: { id: number; name: string }
  staff: Staff
}

interface QualityCheckFormData {
  orderId: string
  checkType: string
  result: string
  score: string
  remark: string
}

const menuItems = [
  { key: 'dashboard', label: '数据概览', href: '/admin', icon: '📊' },
  { key: 'users', label: '用户管理', href: '/admin/users', icon: '👥' },
  { key: 'orders', label: '工单管理', href: '/admin/orders', icon: '📋' },
  { key: 'schedules', label: '排班管理', href: '/admin/schedules', icon: '📅' },
  { key: 'quality-checks', label: '质量抽查', href: '/admin/quality-checks', icon: '🔍' },
]

const checkTypeOptions = [
  { value: 'PHONE_CALL', label: '电话回访' },
  { value: 'HOME_VISIT', label: '上门抽查' },
  { value: 'QUESTIONNAIRE', label: '问卷调查' },
]

const resultOptions = [
  { value: 'EXCELLENT', label: '优秀', color: 'bg-green-100 text-green-800' },
  { value: 'GOOD', label: '良好', color: 'bg-blue-100 text-blue-800' },
  { value: 'AVERAGE', label: '一般', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'UNQUALIFIED', label: '不合格', color: 'bg-red-100 text-red-800' },
]

const initialFormData: QualityCheckFormData = {
  orderId: '',
  checkType: '',
  result: '',
  score: '',
  remark: '',
}

export default function QualityChecksPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [staffIdFilter, setStaffIdFilter] = useState<string>('')
  const [checkTypeFilter, setCheckTypeFilter] = useState<string>('')
  const [listLoading, setListLoading] = useState(false)

  const [staffList, setStaffList] = useState<Staff[]>([])
  const [orderList, setOrderList] = useState<Order[]>([])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCheck, setEditingCheck] = useState<QualityCheck | null>(null)
  const [formData, setFormData] = useState<QualityCheckFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadStaffList = useCallback(async () => {
    try {
      const result = await adminApi.getUsers({ role: UserRole.STAFF, pageSize: 100 })
      const data = (result as { data: Staff[] }).data || []
      setStaffList(data)
    } catch (error) {
      console.error('加载服务人员列表失败:', error)
    }
  }, [])

  const loadOrderList = useCallback(async () => {
    try {
      const result = await orderApi.getList({ pageSize: 100 })
      const data = (result as { data: Order[] }).data || []
      setOrderList(data)
    } catch (error) {
      console.error('加载订单列表失败:', error)
    }
  }, [])

  const loadQualityChecks = useCallback(async () => {
    setListLoading(true)
    try {
      const params: { staffId?: number; page: number; pageSize: number } = {
        page,
        pageSize,
      }
      if (staffIdFilter) {
        params.staffId = parseInt(staffIdFilter, 10)
      }

      const result = (await adminApi.getQualityChecks(params)) as {
        data: QualityCheck[]
        total: number
      }

      let filteredData = result.data || []
      if (checkTypeFilter) {
        filteredData = filteredData.filter((item) => item.checkType === checkTypeFilter)
      }

      setQualityChecks(filteredData)
      setTotal(result.total || 0)
    } catch (error) {
      console.error('加载质量抽查列表失败:', error)
      alert('加载质量抽查列表失败')
    } finally {
      setListLoading(false)
    }
  }, [page, pageSize, staffIdFilter, checkTypeFilter])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }
    if (!loading && user && user.role !== UserRole.ADMIN) {
      router.push('/')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user && user.role === UserRole.ADMIN) {
      loadStaffList()
      loadOrderList()
    }
  }, [user, loadStaffList, loadOrderList])

  useEffect(() => {
    if (user && user.role === UserRole.ADMIN) {
      loadQualityChecks()
    }
  }, [loadQualityChecks, user])

  const handleStaffFilterChange = (staffId: string) => {
    setStaffIdFilter(staffId)
    setPage(1)
  }

  const handleCheckTypeFilterChange = (checkType: string) => {
    setCheckTypeFilter(checkType)
    setPage(1)
  }

  const getCheckTypeText = (type: string) => {
    const option = checkTypeOptions.find((o) => o.value === type)
    return option ? option.label : type
  }

  const getResultText = (result: string) => {
    const option = resultOptions.find((o) => o.value === result)
    return option ? option.label : result
  }

  const getResultColor = (result: string) => {
    const option = resultOptions.find((o) => o.value === result)
    return option ? option.color : 'bg-gray-100 text-gray-800'
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.orderId) {
      errors.orderId = '请选择订单'
    }
    if (!formData.checkType) {
      errors.checkType = '请选择检查类型'
    }
    if (!formData.result) {
      errors.result = '请选择检查结果'
    }
    if (formData.score) {
      const score = parseInt(formData.score, 10)
      if (isNaN(score) || score < 0 || score > 100) {
        errors.score = '评分必须在0-100之间'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    try {
      const data = {
        orderId: parseInt(formData.orderId, 10),
        checkType: formData.checkType,
        result: formData.result,
        score: formData.score ? parseInt(formData.score, 10) : undefined,
        remark: formData.remark || undefined,
      }

      await adminApi.createQualityCheck(data)
      alert('创建质量抽查成功')
      setShowCreateModal(false)
      setFormData(initialFormData)
      setFormErrors({})
      loadQualityChecks()
    } catch (error) {
      console.error('创建质量抽查失败:', error)
      alert((error as Error).message || '创建质量抽查失败')
    }
  }

  const handleEdit = (check: QualityCheck) => {
    setEditingCheck(check)
    setFormData({
      orderId: check.orderId.toString(),
      checkType: check.checkType,
      result: check.result,
      score: check.score?.toString() || '',
      remark: check.remark || '',
    })
    setFormErrors({})
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!editingCheck || !validateForm()) return

    try {
      const data = {
        checkType: formData.checkType,
        result: formData.result,
        score: formData.score ? parseInt(formData.score, 10) : undefined,
        remark: formData.remark || undefined,
      }

      await adminApi.updateQualityCheck(editingCheck.id, data)
      alert('更新质量抽查成功')
      setShowEditModal(false)
      setEditingCheck(null)
      setFormData(initialFormData)
      setFormErrors({})
      loadQualityChecks()
    } catch (error) {
      console.error('更新质量抽查失败:', error)
      alert((error as Error).message || '更新质量抽查失败')
    }
  }

  const handleDeleteClick = (id: number) => {
    setDeletingId(id)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return

    try {
      await adminApi.deleteQualityCheck(deletingId)
      alert('删除成功')
      setShowDeleteConfirm(false)
      setDeletingId(null)
      loadQualityChecks()
    } catch (error) {
      console.error('删除失败:', error)
      alert((error as Error).message || '删除失败')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const handleMenuClick = (href: string) => {
    router.push(href)
  }

  const totalPages = Math.ceil(total / pageSize)

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
                    item.key === 'quality-checks'
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
            <h2 className="text-2xl font-semibold text-gray-800">质量抽查</h2>
            <p className="text-sm text-gray-500 mt-1">管理服务质量抽查记录</p>
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
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">服务人员：</label>
                <select
                  value={staffIdFilter}
                  onChange={(e) => handleStaffFilterChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="text-sm font-medium text-gray-700">检查类型：</label>
                <select
                  value={checkTypeFilter}
                  onChange={(e) => handleCheckTypeFilterChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部</option>
                  {checkTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setFormData(initialFormData)
                  setFormErrors({})
                  setShowCreateModal(true)
                }}
                className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <span>+</span>
                新增抽查
              </button>
            </div>

            <div className="text-sm text-gray-500">
              共 {total} 条记录，当前第 {page} / {totalPages || 1} 页
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {listLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : qualityChecks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">暂无质量抽查记录</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">订单号</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">服务名称</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">老人</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">服务人员</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">检查类型</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">检查结果</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">评分</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">检查时间</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {qualityChecks.map((check) => (
                        <tr key={check.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{check.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <Link
                              href={`/orders/${check.orderId}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                              target="_blank"
                            >
                              {check.order.orderNo}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{check.order.service.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{check.order.elderly.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{check.staff.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{getCheckTypeText(check.checkType)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getResultColor(
                                check.result
                              )}`}
                            >
                              {getResultText(check.result)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {check.score !== null ? check.score : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {check.checkedAt ? formatDateTime(check.checkedAt) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <Link
                                href={`/orders/${check.orderId}`}
                                className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                target="_blank"
                              >
                                详情
                              </Link>
                              <button
                                onClick={() => handleEdit(check)}
                                className="px-3 py-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleDeleteClick(check.id)}
                                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                删除
                              </button>
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
                      <span className="px-3 py-1 text-gray-600">
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">新增质量抽查</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  订单 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.orderId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择订单</option>
                  {orderList.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNo} - {order.elderly.name} - {order.service.name}
                    </option>
                  ))}
                </select>
                {formErrors.orderId && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.orderId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  检查类型 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.checkType}
                  onChange={(e) => setFormData({ ...formData, checkType: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.checkType ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择检查类型</option>
                  {checkTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.checkType && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.checkType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  检查结果 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.result}
                  onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.result ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择检查结果</option>
                  {resultOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.result && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.result}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">评分</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.score}
                  onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.score ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0-100"
                />
                {formErrors.score && <p className="text-red-500 text-xs mt-1">{formErrors.score}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="请输入备注信息"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">编辑质量抽查</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">订单</label>
                <input
                  type="text"
                  value={editingCheck?.order.orderNo || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  检查类型 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.checkType}
                  onChange={(e) => setFormData({ ...formData, checkType: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.checkType ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择检查类型</option>
                  {checkTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.checkType && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.checkType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  检查结果 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.result}
                  onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.result ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择检查结果</option>
                  {resultOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.result && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.result}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">评分</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.score}
                  onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.score ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0-100"
                />
                {formErrors.score && <p className="text-red-500 text-xs mt-1">{formErrors.score}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="请输入备注信息"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpdate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">确认删除</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600">确定要删除该质量抽查记录吗？</p>
              <p className="text-sm text-gray-500 mt-2">删除后无法恢复，请谨慎操作。</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingId(null)
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
