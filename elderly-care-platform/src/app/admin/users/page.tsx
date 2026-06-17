'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { adminApi } from '@/lib/api'
import { UserRole } from '@/types'
import { getRoleText, formatDateTime } from '@/lib/utils'

interface User {
  id: number
  phone: string
  name: string
  role: UserRole
  avatar?: string
  idCard?: string
  birthday?: string
  address?: string
  subsidyLevel: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface UserFormData {
  name: string
  phone: string
  password: string
  role: UserRole
  subsidyLevel: number
  idCard: string
  birthday: string
  address: string
}

interface GetUsersParams {
  page: number
  pageSize: number
  role?: string
  keyword?: string
}

interface CreateUserData {
  name: string
  phone: string
  password: string
  role: UserRole
  idCard?: string
  birthday?: string
  address?: string
  subsidyLevel?: number
}

interface UpdateUserData {
  name: string
  phone: string
  role: UserRole
  idCard?: string
  birthday?: string
  address?: string
  password?: string
  subsidyLevel?: number
}

interface ApiError {
  message: string
}

const initialFormData: UserFormData = {
  name: '',
  phone: '',
  password: '',
  role: UserRole.ELDERLY,
  subsidyLevel: 0,
  idCard: '',
  birthday: '',
  address: ''
}

export default function AdminUsersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [keyword, setKeyword] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)

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

  const loadUsers = useCallback(async () => {
    startTransition(() => {
      setUsersLoading(true)
    })
    try {
      const params: GetUsersParams = { page, pageSize }
      if (roleFilter) params.role = roleFilter
      if (keyword) params.keyword = keyword

      const result = await adminApi.getUsers(params)
      startTransition(() => {
        setUsers((result as { data: User[] }).data || [])
        setTotal((result as { total: number }).total || 0)
      })
    } catch (error) {
      console.error('加载用户列表失败:', error)
      alert((error as ApiError).message || '加载用户列表失败')
    } finally {
      startTransition(() => {
        setUsersLoading(false)
      })
    }
  }, [page, pageSize, roleFilter, keyword])

  useEffect(() => {
    if (user && user.role === UserRole.ADMIN) {
      loadUsers()
    }
  }, [loadUsers, user])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadUsers()
  }

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role)
    setPage(1)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = '姓名不能为空'
    } else if (formData.name.length < 2) {
      errors.name = '姓名至少2个字符'
    }

    if (!formData.phone.trim()) {
      errors.phone = '手机号不能为空'
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      errors.phone = '手机号格式不正确'
    }

    if (showCreateModal && !formData.password) {
      errors.password = '密码不能为空'
    } else if (formData.password && formData.password.length < 6) {
      errors.password = '密码长度至少6位'
    }

    if (formData.idCard && !/(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(formData.idCard)) {
      errors.idCard = '身份证号格式不正确'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateUser = async () => {
    if (!validateForm()) return

    try {
      const data: CreateUserData = {
        name: formData.name,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        idCard: formData.idCard || undefined,
        birthday: formData.birthday || undefined,
        address: formData.address || undefined
      }

      if (formData.role === UserRole.ELDERLY) {
        data.subsidyLevel = formData.subsidyLevel
      }

      await adminApi.createUser(data)
      alert('创建用户成功')
      setShowCreateModal(false)
      setFormData(initialFormData)
      setFormErrors({})
      loadUsers()
    } catch (error) {
      console.error('创建用户失败:', error)
      alert((error as ApiError).message || '创建用户失败')
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      phone: user.phone,
      password: '',
      role: user.role,
      subsidyLevel: user.subsidyLevel,
      idCard: user.idCard || '',
      birthday: user.birthday ? user.birthday.split('T')[0] : '',
      address: user.address || ''
    })
    setFormErrors({})
    setShowEditModal(true)
  }

  const handleUpdateUser = async () => {
    if (!editingUser || !validateForm()) return

    try {
      const data: UpdateUserData = {
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        idCard: formData.idCard || undefined,
        birthday: formData.birthday || undefined,
        address: formData.address || undefined
      }

      if (formData.password) {
        data.password = formData.password
      }

      if (formData.role === UserRole.ELDERLY) {
        data.subsidyLevel = formData.subsidyLevel
      }

      await adminApi.updateUser(editingUser.id, data)
      alert('更新用户成功')
      setShowEditModal(false)
      setEditingUser(null)
      setFormData(initialFormData)
      setFormErrors({})
      loadUsers()
    } catch (error) {
      console.error('更新用户失败:', error)
      alert((error as ApiError).message || '更新用户失败')
    }
  }

  const handleToggleStatus = (targetUser: User) => {
    if (user && targetUser.id === user.id) {
      alert('不能操作自己的账号')
      return
    }
    setDeletingUserId(targetUser.id)
    setShowDeleteConfirm(true)
  }

  const confirmToggleStatus = async () => {
    if (!deletingUserId) return

    try {
      await adminApi.deleteUser(deletingUserId)
      alert('操作成功')
      setShowDeleteConfirm(false)
      setDeletingUserId(null)
      loadUsers()
    } catch (error) {
      console.error('操作失败:', error)
      alert((error as ApiError).message || '操作失败')
    }
  }

  const getSubsidyLevelText = (level: number) => {
    const texts: Record<number, string> = {
      0: '无补贴',
      1: '普通补贴 (30%)',
      2: '重点补贴 (50%)',
      3: '特困补贴 (80%)'
    }
    return texts[level] || `等级${level}`
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading || !user || user.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-800 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {!sidebarCollapsed && <h1 className="text-xl font-bold">管理后台</h1>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="flex-1 py-4">
          <Link
            href="/admin/users"
            className="flex items-center gap-3 px-4 py-3 bg-orange-500 text-white"
          >
            <span className="text-xl">👥</span>
            {!sidebarCollapsed && <span>用户管理</span>}
          </Link>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left"
          >
            <span className="text-xl">📋</span>
            {!sidebarCollapsed && <span>订单管理</span>}
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left"
          >
            <span className="text-xl">📅</span>
            {!sidebarCollapsed && <span>排班管理</span>}
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left"
          >
            <span className="text-xl">✅</span>
            {!sidebarCollapsed && <span>质控管理</span>}
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left"
          >
            <span className="text-xl">📊</span>
            {!sidebarCollapsed && <span>数据统计</span>}
          </button>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="text-xl">🏠</span>
            {!sidebarCollapsed && <span>返回首页</span>}
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">用户管理</h2>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">欢迎，{user.name}（管理员）</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="搜索姓名或手机号"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent w-64"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  搜索
                </button>
              </form>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRoleFilterChange('')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    roleFilter === ''
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => handleRoleFilterChange(UserRole.ELDERLY)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    roleFilter === UserRole.ELDERLY
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  老人
                </button>
                <button
                  onClick={() => handleRoleFilterChange(UserRole.STAFF)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    roleFilter === UserRole.STAFF
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  服务人员
                </button>
                <button
                  onClick={() => handleRoleFilterChange(UserRole.ADMIN)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    roleFilter === UserRole.ADMIN
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  管理员
                </button>
              </div>

              <button
                onClick={() => {
                  setFormData(initialFormData)
                  setFormErrors({})
                  setShowCreateModal(true)
                }}
                className="ml-auto px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <span>+</span>
                新增用户
              </button>
            </div>

            <div className="text-sm text-gray-500">
              共 {total} 条记录，当前第 {page} / {totalPages || 1} 页
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {usersLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                暂无用户数据
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">姓名</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">手机号</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">角色</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">补贴等级</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">创建时间</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{u.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.phone}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              u.role === UserRole.ADMIN
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === UserRole.STAFF
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {getRoleText(u.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {u.role === UserRole.ELDERLY ? getSubsidyLevelText(u.subsidyLevel) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              u.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {u.isActive ? '正常' : '已禁用'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(u.createdAt)}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditUser(u)}
                                className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`px-3 py-1 rounded transition-colors ${
                                  u.isActive
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {u.isActive ? '禁用' : '启用'}
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
        </div>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">新增用户</h3>
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
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入姓名"
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  手机号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入手机号"
                />
                {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入密码（至少6位）"
                />
                {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  角色 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value={UserRole.ELDERLY}>老人</option>
                  <option value={UserRole.STAFF}>服务人员</option>
                  <option value={UserRole.ADMIN}>管理员</option>
                </select>
              </div>
              {formData.role === UserRole.ELDERLY && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">补贴等级</label>
                  <select
                    value={formData.subsidyLevel}
                    onChange={(e) => setFormData({ ...formData, subsidyLevel: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value={0}>无补贴</option>
                    <option value={1}>普通补贴 (30%)</option>
                    <option value={2}>重点补贴 (50%)</option>
                    <option value={3}>特困补贴 (80%)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身份证号</label>
                <input
                  type="text"
                  value={formData.idCard}
                  onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.idCard ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入身份证号"
                />
                {formErrors.idCard && <p className="text-red-500 text-xs mt-1">{formErrors.idCard}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生日</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="请输入地址"
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
                onClick={handleCreateUser}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
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
              <h3 className="text-lg font-bold text-gray-800">编辑用户</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入姓名"
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  手机号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入手机号"
                />
                {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="留空则不修改密码"
                />
                {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  角色 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value={UserRole.ELDERLY}>老人</option>
                  <option value={UserRole.STAFF}>服务人员</option>
                  <option value={UserRole.ADMIN}>管理员</option>
                </select>
              </div>
              {formData.role === UserRole.ELDERLY && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">补贴等级</label>
                  <select
                    value={formData.subsidyLevel}
                    onChange={(e) => setFormData({ ...formData, subsidyLevel: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value={0}>无补贴</option>
                    <option value={1}>普通补贴 (30%)</option>
                    <option value={2}>重点补贴 (50%)</option>
                    <option value={3}>特困补贴 (80%)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身份证号</label>
                <input
                  type="text"
                  value={formData.idCard}
                  onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    formErrors.idCard ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入身份证号"
                />
                {formErrors.idCard && <p className="text-red-500 text-xs mt-1">{formErrors.idCard}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生日</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="请输入地址"
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
                onClick={handleUpdateUser}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
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
              <h3 className="text-lg font-bold text-gray-800">确认操作</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600">
                确定要{users.find(u => u.id === deletingUserId)?.isActive ? '禁用' : '启用'}该用户吗？
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {users.find(u => u.id === deletingUserId)?.isActive
                  ? '禁用后该用户将无法登录系统。'
                  : '启用后该用户将恢复登录权限。'}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingUserId(null)
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmToggleStatus}
                className={`px-6 py-2 text-white rounded-lg transition-colors ${
                  users.find(u => u.id === deletingUserId)?.isActive
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
