'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { packageTemplateApi, serviceApi, packageApi } from '@/lib/api'
import {
  UserRole,
  ServiceCategory,
  PackageCycleType,
  type PackageTemplate,
  type Service
} from '@/types'
import {
  getCycleTypeText,
  getServiceCategoryText,
  parseWeekdaySchedule,
  getWeekdayText
} from '@/lib/utils'

const cycleTypes = Object.values(PackageCycleType)
const weekdays = [0, 1, 2, 3, 4, 5, 6]

export default function PackageTemplatesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<PackageTemplate[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PackageTemplate | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serviceId: 0,
    cycleType: PackageCycleType.WEEKLY,
    cycleDays: 7,
    totalServices: 12,
    timeOfDay: '09:00',
    weekdaySchedule: '1,3,5',
    address: '',
    basePrice: 0,
    discountRate: 100,
    isActive: true
  })

  useEffect(() => {
    if (loading) return
    if (!user || user.role !== UserRole.ADMIN) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== UserRole.ADMIN) return

    const fetchData = async () => {
      try {
        setTemplatesLoading(true)
        const [templatesData, servicesData] = await Promise.all([
          packageTemplateApi.getList(),
          serviceApi.getList()
        ])
        setTemplates(templatesData as PackageTemplate[])
        setServices(servicesData as Service[])

        try {
          const pending = await packageApi.getPendingOrders()
          setPendingCount((pending as any).total || 0)
        } catch (e) {
          setPendingCount(0)
        }
      } catch (err) {
        setError('获取套餐模板失败')
      } finally {
        setTemplatesLoading(false)
      }
    }

    fetchData()
  }, [user])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      serviceId: services[0]?.id || 0,
      cycleType: PackageCycleType.WEEKLY,
      cycleDays: 7,
      totalServices: 12,
      timeOfDay: '09:00',
      weekdaySchedule: '1,3,5',
      address: '',
      basePrice: 0,
      discountRate: 100,
      isActive: true
    })
    setEditingTemplate(null)
    setShowForm(false)
  }

  const handleEdit = (tpl: PackageTemplate) => {
    setEditingTemplate(tpl)
    setFormData({
      name: tpl.name,
      description: tpl.description || '',
      serviceId: tpl.serviceId,
      cycleType: tpl.cycleType as PackageCycleType,
      cycleDays: tpl.cycleDays || 7,
      totalServices: tpl.totalServices,
      timeOfDay: tpl.timeOfDay || '09:00',
      weekdaySchedule: tpl.weekdaySchedule || '',
      address: tpl.address || '',
      basePrice: tpl.basePrice,
      discountRate: tpl.discountRate,
      isActive: tpl.isActive
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload: any = { ...formData }
      if (payload.cycleType !== PackageCycleType.CUSTOM) {
        delete payload.cycleDays
      }

      if (editingTemplate) {
        await packageTemplateApi.update(editingTemplate.id, payload)
      } else {
        await packageTemplateApi.create(payload)
      }

      const data = await packageTemplateApi.getList()
      setTemplates(data as PackageTemplate[])
      resetForm()
    } catch (err) {
      setError(editingTemplate ? '更新模板失败' : '创建模板失败')
    }
  }

  const handleToggleActive = async (tpl: PackageTemplate) => {
    try {
      await packageTemplateApi.update(tpl.id, { isActive: !tpl.isActive })
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, isActive: !t.isActive } : t))
    } catch (err) {
      setError('更新模板状态失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此套餐模板吗？')) return
    try {
      await packageTemplateApi.delete(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setError('删除模板失败')
    }
  }

  const handleGenerateOrders = async () => {
    if (!confirm('确定要生成未来7天的套餐订单吗？')) return
    try {
      const result = await packageApi.generateOrders()
      alert(`成功生成 ${(result as any).createdCount} 条订单`)
      const pending = await packageApi.getPendingOrders()
      setPendingCount((pending as any).total || 0)
    } catch (err) {
      setError('生成订单失败')
    }
  }

  const toggleWeekday = (day: number) => {
    const current = parseWeekdaySchedule(formData.weekdaySchedule)
    let next: number[]
    if (current.includes(day)) {
      next = current.filter(d => d !== day)
    } else {
      next = [...current, day].sort()
    }
    setFormData(prev => ({ ...prev, weekdaySchedule: next.join(',') }))
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
            <li>
              <button onClick={() => router.push('/admin')} className="w-full flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <span className="mr-3 text-lg">📊</span><span>数据概览</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push('/admin/users')} className="w-full flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <span className="mr-3 text-lg">👥</span><span>用户管理</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push('/admin/orders')} className="w-full flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <span className="mr-3 text-lg">📋</span><span>工单管理</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push('/admin/schedules')} className="w-full flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <span className="mr-3 text-lg">📅</span><span>排班管理</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push('/admin/quality-checks')} className="w-full flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <span className="mr-3 text-lg">🔍</span><span>质量抽查</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push('/admin/reminder-rules')} className="w-full flex items-center px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <span className="mr-3 text-lg">🔔</span><span>提醒规则</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push('/admin/package-templates')} className="w-full flex items-center px-4 py-3 rounded-lg bg-blue-50 text-blue-600 font-medium transition-colors">
                <span className="mr-3 text-lg">📦</span><span>套餐管理</span>
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">套餐模板管理</h2>
              <p className="text-sm text-gray-500 mt-1">配置定期服务套餐模板</p>
            </div>
            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <button
                  onClick={handleGenerateOrders}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                >
                  🔄 生成未来7天订单
                  <span className="bg-white text-green-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                </button>
              )}
              <button
                onClick={() => { resetForm(); setShowForm(true) }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + 新建套餐模板
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {showForm && (
            <div className="mb-8 bg-white rounded-xl p-6 shadow-sm border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {editingTemplate ? '编辑套餐模板' : '新建套餐模板'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">套餐名称</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="如：每周一三五保洁套餐"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">关联服务</label>
                    <select
                      value={formData.serviceId}
                      onChange={e => setFormData(prev => ({ ...prev, serviceId: parseInt(e.target.value, 10) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value={0}>请选择服务</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {getServiceCategoryText(s.category)} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="套餐描述"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">周期类型</label>
                    <select
                      value={formData.cycleType}
                      onChange={e => setFormData(prev => ({ ...prev, cycleType: e.target.value as PackageCycleType }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {cycleTypes.map(t => (
                        <option key={t} value={t}>{getCycleTypeText(t)}</option>
                      ))}
                    </select>
                  </div>
                  {formData.cycleType === PackageCycleType.CUSTOM && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">间隔天数</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.cycleDays}
                        onChange={e => setFormData(prev => ({ ...prev, cycleDays: parseInt(e.target.value, 10) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  {formData.cycleType !== PackageCycleType.CUSTOM && <div />}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">总服务次数</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.totalServices}
                      onChange={e => setFormData(prev => ({ ...prev, totalServices: parseInt(e.target.value, 10) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">服务时间</label>
                    <input
                      type="time"
                      value={formData.timeOfDay}
                      onChange={e => setFormData(prev => ({ ...prev, timeOfDay: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {(formData.cycleType === PackageCycleType.WEEKLY) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">服务日期（每周）</label>
                    <div className="flex gap-2 flex-wrap">
                      {weekdays.map(day => {
                        const selected = parseWeekdaySchedule(formData.weekdaySchedule).includes(day)
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleWeekday(day)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              selected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {getWeekdayText(day)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">套餐价格（元）</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={formData.basePrice}
                      onChange={e => setFormData(prev => ({ ...prev, basePrice: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">折扣率（1-100）</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.discountRate}
                      onChange={e => setFormData(prev => ({ ...prev, discountRate: parseInt(e.target.value, 10) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="100表示原价，85表示85折"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">默认服务地址（可选）</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="不填则由用户下单时填写"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">立即启用此模板</label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingTemplate ? '保存修改' : '创建模板'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          )}

          {templatesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl">
              <p className="text-gray-400 text-lg mb-4">暂无套餐模板</p>
              <button
                onClick={() => { resetForm(); setShowForm(true) }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建第一个模板
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(tpl => {
                const svc = services.find(s => s.id === tpl.serviceId)
                return (
                  <div
                    key={tpl.id}
                    className={`bg-white rounded-xl p-5 shadow-sm border ${
                      tpl.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">{tpl.name}</h3>
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                          tpl.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {tpl.isActive ? '已启用' : '已禁用'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-orange-600">¥{tpl.basePrice}</div>
                        {tpl.discountRate < 100 && (
                          <div className="text-xs text-gray-400">{tpl.discountRate}折</div>
                        )}
                      </div>
                    </div>

                    {tpl.description && (
                      <p className="text-sm text-gray-500 mb-3">{tpl.description}</p>
                    )}

                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">关联服务</span>
                        <span>
                          {svc ? getServiceCategoryText(svc.category) + ' - ' + svc.name : '未知服务'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">周期</span>
                        <span>{getCycleTypeText(tpl.cycleType)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">服务次数</span>
                        <span>共 {tpl.totalServices} 次</span>
                      </div>
                      {tpl.timeOfDay && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">服务时间</span>
                          <span>{tpl.timeOfDay}</span>
                        </div>
                      )}
                      {tpl.cycleType === PackageCycleType.WEEKLY && tpl.weekdaySchedule && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">每周</span>
                          <span>
                            {parseWeekdaySchedule(tpl.weekdaySchedule)
                              .map(d => getWeekdayText(d))
                              .join('、')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(tpl)}
                        className="flex-1 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleToggleActive(tpl)}
                        className={`flex-1 px-3 py-2 rounded-lg transition-colors text-sm ${
                          tpl.isActive
                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {tpl.isActive ? '禁用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleDelete(tpl.id)}
                        className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
