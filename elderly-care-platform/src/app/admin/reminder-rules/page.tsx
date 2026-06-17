'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { reminderRuleApi } from '@/lib/api'
import { UserRole, ReminderType, type ReminderRule } from '@/types'
import { getReminderTypeText, getReminderTypeIcon } from '@/lib/utils'

const reminderTypes = Object.values(ReminderType)

const conditionExamples: Record<string, string> = {
  MEDICATION: 'check=medication',
  FOLLOW_UP: 'check=lastCheckup;days=90',
  WEATHER: 'check=season;months=11,12,1,2;seasonName=冬季',
  SERVICE_RECOMMENDATION: 'check=orderHistory;months=3',
  GENERAL: 'check=always'
}

const templateExamples: Record<string, string> = {
  MEDICATION: '您好，该吃药了！当前用药：{{medications}}',
  FOLLOW_UP: '距离上次复诊已超过{{days}}天（上次复诊：{{lastDate}}），建议尽快预约复诊。',
  WEATHER: '{{season}}来临，请注意保暖添衣！',
  SERVICE_RECOMMENDATION: '您近期有{{orderCount}}次服务记录，为您推荐相关服务套餐。',
  GENERAL: '温馨提醒：注意身体健康！'
}

export default function ReminderRulesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: ReminderType.MEDICATION,
    description: '',
    condition: '',
    template: '',
    priority: 0,
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

    const fetchRules = async () => {
      try {
        setRulesLoading(true)
        const data = await reminderRuleApi.getList()
        setRules(data as ReminderRule[])
      } catch (err) {
        setError('获取提醒规则失败')
      } finally {
        setRulesLoading(false)
      }
    }

    fetchRules()
  }, [user])

  const resetForm = () => {
    setFormData({
      name: '',
      type: ReminderType.MEDICATION,
      description: '',
      condition: conditionExamples[ReminderType.MEDICATION],
      template: templateExamples[ReminderType.MEDICATION],
      priority: 0,
      isActive: true
    })
    setEditingRule(null)
    setShowForm(false)
  }

  const handleTypeChange = (type: ReminderType) => {
    setFormData(prev => ({
      ...prev,
      type,
      condition: conditionExamples[type],
      template: templateExamples[type]
    }))
  }

  const handleEdit = (rule: ReminderRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      type: rule.type as ReminderType,
      description: rule.description || '',
      condition: rule.condition,
      template: rule.template,
      priority: rule.priority,
      isActive: rule.isActive
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingRule) {
        await reminderRuleApi.update(editingRule.id, formData)
      } else {
        await reminderRuleApi.create(formData)
      }

      const data = await reminderRuleApi.getList()
      setRules(data as ReminderRule[])
      resetForm()
    } catch (err) {
      setError(editingRule ? '更新规则失败' : '创建规则失败')
    }
  }

  const handleToggleActive = async (rule: ReminderRule) => {
    try {
      await reminderRuleApi.update(rule.id, { isActive: !rule.isActive })
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
    } catch (err) {
      setError('更新规则状态失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此规则吗？')) return

    try {
      await reminderRuleApi.delete(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      setError('删除规则失败')
    }
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
              <button onClick={() => router.push('/admin/reminder-rules')} className="w-full flex items-center px-4 py-3 rounded-lg bg-blue-50 text-blue-600 font-medium transition-colors">
                <span className="mr-3 text-lg">🔔</span><span>提醒规则</span>
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">提醒规则模板</h2>
              <p className="text-sm text-gray-500 mt-1">配置关怀提醒的生成规则</p>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + 新建规则
            </button>
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
                {editingRule ? '编辑规则' : '新建规则'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="如：用药提醒规则"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">提醒类型</label>
                    <select
                      value={formData.type}
                      onChange={e => handleTypeChange(e.target.value as ReminderType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {reminderTypes.map(type => (
                        <option key={type} value={type}>
                          {getReminderTypeIcon(type)} {getReminderTypeText(type)}
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
                    placeholder="规则描述"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    触发条件
                    <span className="text-xs text-gray-400 ml-2">格式：key=value;key=value</span>
                  </label>
                  <input
                    type="text"
                    value={formData.condition}
                    onChange={e => setFormData(prev => ({ ...prev, condition: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="check=medication"
                    required
                  />
                  <div className="mt-1 text-xs text-gray-400">
                    {formData.type === 'MEDICATION' && '检查老人是否有用药信息：check=medication'}
                    {formData.type === 'FOLLOW_UP' && '检查上次复诊天数：check=lastCheckup;days=90'}
                    {formData.type === 'WEATHER' && '按月份触发：check=season;months=11,12,1,2;seasonName=冬季'}
                    {formData.type === 'SERVICE_RECOMMENDATION' && '检查近期订单数：check=orderHistory;months=3'}
                    {formData.type === 'GENERAL' && '总是触发：check=always'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    提醒模板
                    <span className="text-xs text-gray-400 ml-2">{'支持 {{变量}} 替换'}</span>
                  </label>
                  <textarea
                    value={formData.template}
                    onChange={e => setFormData(prev => ({ ...prev, template: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="提醒内容模板"
                    required
                  />
                  <div className="mt-1 text-xs text-gray-400">
                    {formData.type === 'MEDICATION' && <span>{'可用变量：{{medications}}'}</span>}
                    {formData.type === 'FOLLOW_UP' && <span>{'可用变量：{{days}}、{{lastDate}}'}</span>}
                    {formData.type === 'WEATHER' && <span>{'可用变量：{{season}}'}</span>}
                    {formData.type === 'SERVICE_RECOMMENDATION' && <span>{'可用变量：{{orderCount}}'}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={e => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">启用规则</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingRule ? '保存修改' : '创建规则'}
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

          {rulesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : rules.length > 0 ? (
            <div className="space-y-4">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className={`bg-white rounded-xl p-6 shadow-sm border ${
                    rule.isActive ? 'border-gray-100' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl">{getReminderTypeIcon(rule.type)}</span>
                        <h3 className="text-lg font-semibold text-gray-800">{rule.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          rule.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {rule.isActive ? '已启用' : '已禁用'}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          {getReminderTypeText(rule.type)}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-gray-500 mb-2">{rule.description}</p>
                      )}
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="text-gray-500">触发条件：</span>
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{rule.condition}</code>
                        </p>
                        <p className="text-sm">
                          <span className="text-gray-500">提醒模板：</span>
                          <span className="text-gray-700">{rule.template}</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          优先级：{rule.priority} · 已触发 {(rule._count?.reminders || 0)} 次
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          rule.isActive
                            ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {rule.isActive ? '禁用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleEdit(rule)}
                        className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <span className="text-6xl">🔔</span>
              <p className="text-gray-500 mt-4">暂无提醒规则</p>
              <p className="text-gray-400 text-sm mt-2">点击"新建规则"创建第一个提醒规则模板</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
