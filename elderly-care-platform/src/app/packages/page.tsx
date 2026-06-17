'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  packageApi,
  packageTemplateApi,
  serviceApi,
  userApi
} from '@/lib/api'
import {
  UserRole,
  PackageCycleType,
  PackageStatus,
  type PackageTemplate,
  type PackageOrder,
  type PackageService,
  type Service
} from '@/types'
import {
  getCycleTypeText,
  getPackageStatusText,
  getPackageStatusColor,
  getServiceCategoryText,
  parseWeekdaySchedule,
  getWeekdayText,
  formatDate,
  formatDateTime
} from '@/lib/utils'

const weekdays = [0, 1, 2, 3, 4, 5, 6]

export default function PackagesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'buy' | 'my'>('my')
  const [templates, setTemplates] = useState<PackageTemplate[]>([])
  const [myPackages, setMyPackages] = useState<PackageOrder[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [userProfile, setUserProfile] = useState<{ address?: string | null } | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [loadingMyPackages, setLoadingMyPackages] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showBuyForm, setShowBuyForm] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<PackageTemplate | null>(null)
  const [buyFormData, setBuyFormData] = useState({
    startDate: formatDate(new Date(Date.now() + 86400000)),
    address: '',
    timeOfDay: '09:00',
    weekdaySchedule: '1,3,5',
    remark: ''
  })

  const [showRenewForm, setShowRenewForm] = useState(false)
  const [renewingPackage, setRenewingPackage] = useState<PackageOrder | null>(null)
  const [renewFormData, setRenewFormData] = useState({
    startDate: '',
    address: '',
    timeOfDay: '',
    weekdaySchedule: '',
    remark: ''
  })

  const [showPauseForm, setShowPauseForm] = useState(false)
  const [pausingPackage, setPausingPackage] = useState<PackageOrder | null>(null)
  const [pauseReason, setPauseReason] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user.role !== UserRole.ELDERLY && user.role !== UserRole.ADMIN) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      if (tab === 'buy') {
        try {
          setLoadingTemplates(true)
          const [tplData, svcData, profileData] = await Promise.all([
            packageTemplateApi.getList({ isActive: 'true' }),
            serviceApi.getList(),
            userApi.getProfile().catch(() => null)
          ])
          setTemplates(tplData as PackageTemplate[])
          setServices(svcData as Service[])
          const profile = profileData as any
          setUserProfile(profile)
          if (profile?.address) {
            setBuyFormData(prev => ({ ...prev, address: profile.address || '' }))
          }
        } catch (err) {
          setError('获取套餐模板失败')
        } finally {
          setLoadingTemplates(false)
        }
      } else {
        try {
          setLoadingMyPackages(true)
          const params: any = { withServices: true }
          if (user.role === UserRole.ADMIN) {
            // 管理员可以看全部
          }
          const pkgs = await packageApi.getList(params)
          setMyPackages(pkgs as PackageOrder[])
        } catch (err) {
          setError('获取我的套餐失败')
        } finally {
          setLoadingMyPackages(false)
        }
      }
    }

    fetchData()
  }, [user, tab])

  const refreshMyPackages = async () => {
    try {
      const pkgs = await packageApi.getList({ withServices: true })
      setMyPackages(pkgs as PackageOrder[])
    } catch (err) {
      console.error(err)
    }
  }

  const handleBuy = (tpl: PackageTemplate) => {
    setSelectedTemplate(tpl)
    setBuyFormData(prev => ({
      ...prev,
      timeOfDay: tpl.timeOfDay || prev.timeOfDay,
      weekdaySchedule: tpl.weekdaySchedule || prev.weekdaySchedule,
      address: tpl.address || userProfile?.address || prev.address,
      startDate: formatDate(new Date(Date.now() + 86400000))
    }))
    setShowBuyForm(true)
  }

  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return

    try {
      await packageApi.create({
        templateId: selectedTemplate.id,
        startDate: buyFormData.startDate,
        address: buyFormData.address,
        timeOfDay: buyFormData.timeOfDay,
        weekdaySchedule: buyFormData.weekdaySchedule,
        remark: buyFormData.remark
      })

      setShowBuyForm(false)
      setSelectedTemplate(null)
      setSuccessMsg('套餐购买成功！')
      setTimeout(() => setSuccessMsg(''), 3000)
      setTab('my')
    } catch (err) {
      setError('购买失败，请重试')
    }
  }

  const handlePause = (pkg: PackageOrder) => {
    setPausingPackage(pkg)
    setPauseReason('')
    setShowPauseForm(true)
  }

  const handlePauseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pausingPackage) return
    try {
      await packageApi.pause(pausingPackage.id, pauseReason)
      setShowPauseForm(false)
      setPausingPackage(null)
      setSuccessMsg('套餐已暂停')
      setTimeout(() => setSuccessMsg(''), 3000)
      refreshMyPackages()
    } catch (err) {
      setError('暂停失败')
    }
  }

  const handleResume = async (pkg: PackageOrder) => {
    if (!confirm('确定要恢复此套餐吗？')) return
    try {
      await packageApi.resume(pkg.id)
      setSuccessMsg('套餐已恢复')
      setTimeout(() => setSuccessMsg(''), 3000)
      refreshMyPackages()
    } catch (err) {
      setError('恢复失败')
    }
  }

  const handleCancel = async (pkg: PackageOrder) => {
    const reason = prompt('请输入取消原因：')
    if (reason === null) return
    try {
      await packageApi.cancel(pkg.id, reason || undefined)
      setSuccessMsg('套餐已取消')
      setTimeout(() => setSuccessMsg(''), 3000)
      refreshMyPackages()
    } catch (err) {
      setError('取消失败')
    }
  }

  const handleRenew = (pkg: PackageOrder) => {
    setRenewingPackage(pkg)
    setRenewFormData({
      startDate: formatDate(new Date()),
      address: pkg.address,
      timeOfDay: pkg.timeOfDay || '09:00',
      weekdaySchedule: pkg.weekdaySchedule || '',
      remark: ''
    })
    setShowRenewForm(true)
  }

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renewingPackage) return
    try {
      await packageApi.renew(renewingPackage.id, renewFormData)
      setShowRenewForm(false)
      setRenewingPackage(null)
      setSuccessMsg('续订成功！')
      setTimeout(() => setSuccessMsg(''), 3000)
      refreshMyPackages()
    } catch (err) {
      setError('续订失败')
    }
  }

  const toggleWeekday = (schedule: 'buy' | 'renew', day: number) => {
    if (schedule === 'buy') {
      const current = parseWeekdaySchedule(buyFormData.weekdaySchedule)
      const next = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort()
      setBuyFormData(prev => ({ ...prev, weekdaySchedule: next.join(',') }))
    } else {
      const current = parseWeekdaySchedule(renewFormData.weekdaySchedule)
      const next = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort()
      setRenewFormData(prev => ({ ...prev, weekdaySchedule: next.join(',') }))
    }
  }

  const goToOrder = (orderId: number) => {
    router.push(`/orders/${orderId}`)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-6 text-white">
        <div className="flex items-center mb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">我的套餐</h1>
        </div>
        <div className="flex bg-white/20 rounded-xl p-1">
          <button
            onClick={() => setTab('my')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
              tab === 'my' ? 'bg-white text-orange-600' : 'text-white'
            }`}
          >
            我的套餐
          </button>
          <button
            onClick={() => setTab('buy')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
              tab === 'buy' ? 'bg-white text-orange-600' : 'text-white'
            }`}
          >
            购买套餐
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            {successMsg}
          </div>
        )}

        {tab === 'my' ? (
          <div>
            {loadingMyPackages ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
              </div>
            ) : myPackages.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg mb-4">暂无套餐</p>
                <button
                  onClick={() => setTab('buy')}
                  className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium"
                >
                  去购买套餐
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myPackages.map(pkg => (
                  <div
                    key={pkg.id}
                    className="bg-white rounded-xl overflow-hidden shadow-sm"
                  >
                    <div className="h-1.5 bg-gradient-to-r from-orange-400 to-red-400"></div>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-800">
                              {pkg.template?.name || '套餐服务'}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPackageStatusColor(pkg.status)}`}>
                              {getPackageStatusText(pkg.status)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{pkg.packageNo}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-orange-600">¥{pkg.totalAmount}</div>
                          <div className="text-xs text-gray-400">
                            个人支付 ¥{pkg.personalAmount}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-500">服务进度</span>
                          <span className="font-medium text-gray-800">
                            {pkg.usedServices} / {pkg.totalServices} 次
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-400 to-red-400 transition-all"
                            style={{ width: `${(pkg.usedServices / pkg.totalServices) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-4">
                        <div>
                          <span className="text-gray-400">周期：</span>
                          {getCycleTypeText(pkg.cycleType)}
                        </div>
                        <div>
                          <span className="text-gray-400">剩余：</span>
                          <span className="text-orange-600 font-medium">{pkg.remainingServices}次</span>
                        </div>
                        <div>
                          <span className="text-gray-400">开始：</span>
                          {formatDate(pkg.startDate)}
                        </div>
                        <div>
                          <span className="text-gray-400">到期：</span>
                          {formatDate(pkg.endDate)}
                        </div>
                      </div>

                      {pkg.cycleType === PackageCycleType.WEEKLY && pkg.weekdaySchedule && (
                        <div className="text-sm text-gray-600 mb-4">
                          <span className="text-gray-400">每周：</span>
                          {parseWeekdaySchedule(pkg.weekdaySchedule).map(d => getWeekdayText(d)).join('、')}
                          {pkg.timeOfDay && ` · ${pkg.timeOfDay}`}
                        </div>
                      )}

                      {pkg.services && pkg.services.length > 0 && (
                        <div className="border-t border-gray-100 pt-3 mb-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">服务记录</div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {pkg.services.map((svc: PackageService) => (
                              <div
                                key={svc.id}
                                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                              >
                                <div>
                                  <div className="text-sm text-gray-700">
                                    第 {svc.serviceIndex + 1} 次 · {formatDateTime(svc.scheduledTime)}
                                  </div>
                                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${getPackageStatusColor(svc.status)}`}>
                                    {svc.status === PackageStatus.COMPLETED ? '已完成' :
                                      svc.status === PackageStatus.CANCELLED ? '已取消' :
                                        svc.status === PackageStatus.PAUSED ? '已暂停' : '待服务'}
                                  </span>
                                </div>
                                {svc.orderId && (
                                  <button
                                    onClick={() => goToOrder(svc.orderId!)}
                                    className="text-xs text-orange-600 hover:text-orange-700"
                                  >
                                    查看订单 →
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {pkg.status === PackageStatus.ACTIVE && (
                          <>
                            <button
                              onClick={() => handlePause(pkg)}
                              className="flex-1 py-2.5 bg-yellow-50 text-yellow-700 rounded-xl font-medium hover:bg-yellow-100"
                            >
                              暂停服务
                            </button>
                            <button
                              onClick={() => handleCancel(pkg)}
                              className="flex-1 py-2.5 bg-gray-50 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                            >
                              取消套餐
                            </button>
                          </>
                        )}
                        {pkg.status === PackageStatus.PAUSED && (
                          <button
                            onClick={() => handleResume(pkg)}
                            className="flex-1 py-2.5 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100"
                          >
                            恢复服务
                          </button>
                        )}
                        {(pkg.status === PackageStatus.ACTIVE ||
                          pkg.status === PackageStatus.COMPLETED ||
                          pkg.status === PackageStatus.EXPIRED) && (
                          <button
                            onClick={() => handleRenew(pkg)}
                            className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600"
                          >
                            {pkg.status === PackageStatus.COMPLETED || pkg.status === PackageStatus.EXPIRED
                              ? '立即续订' : '提前续订'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {loadingTemplates ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg">暂无可购买套餐</p>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map(tpl => {
                  const svc = services.find(s => s.id === tpl.serviceId)
                  return (
                    <div
                      key={tpl.id}
                      className="bg-white rounded-xl overflow-hidden shadow-sm"
                    >
                      <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-400"></div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-gray-800 text-lg">{tpl.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {svc ? getServiceCategoryText(svc.category) + ' · ' + svc.name : '定期服务'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-orange-600">¥{tpl.basePrice}</div>
                            {tpl.discountRate < 100 && (
                              <div className="text-xs text-gray-400 line-through">
                                原价 ¥{Math.round(tpl.basePrice * 100 / tpl.discountRate)}
                              </div>
                            )}
                          </div>
                        </div>

                        {tpl.description && (
                          <p className="text-sm text-gray-600 mb-3">{tpl.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-4">
                          <div>
                            <span className="text-gray-400">周期：</span>
                            {getCycleTypeText(tpl.cycleType)}
                          </div>
                          <div>
                            <span className="text-gray-400">次数：</span>
                            共 {tpl.totalServices} 次
                          </div>
                          {tpl.timeOfDay && (
                            <div>
                              <span className="text-gray-400">时间：</span>
                              {tpl.timeOfDay}
                            </div>
                          )}
                          {tpl.cycleType === PackageCycleType.WEEKLY && tpl.weekdaySchedule && (
                            <div>
                              <span className="text-gray-400">日期：</span>
                              {parseWeekdaySchedule(tpl.weekdaySchedule).map(d => getWeekdayText(d)).join('、')}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleBuy(tpl)}
                          className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-sm hover:shadow-md transition-shadow"
                        >
                          立即购买
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showBuyForm && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="w-full max-w-lg bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-lg text-gray-800">购买套餐</h3>
              <button onClick={() => setShowBuyForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={handleBuySubmit} className="p-5 space-y-4">
              <div className="p-3 bg-orange-50 rounded-xl">
                <div className="font-bold text-orange-700">{selectedTemplate.name}</div>
                <div className="text-sm text-orange-600 mt-1">¥{selectedTemplate.basePrice} · 共{selectedTemplate.totalServices}次</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">服务开始日期</label>
                <input
                  type="date"
                  value={buyFormData.startDate}
                  min={formatDate(new Date(Date.now() + 86400000))}
                  onChange={e => setBuyFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">服务地址</label>
                <input
                  type="text"
                  value={buyFormData.address}
                  onChange={e => setBuyFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="请输入服务地址"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">服务时间</label>
                <input
                  type="time"
                  value={buyFormData.timeOfDay}
                  onChange={e => setBuyFormData(prev => ({ ...prev, timeOfDay: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              {selectedTemplate.cycleType === PackageCycleType.WEEKLY && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">服务日期（每周）</label>
                  <div className="flex gap-2 flex-wrap">
                    {weekdays.map(day => {
                      const selected = parseWeekdaySchedule(buyFormData.weekdaySchedule).includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWeekday('buy', day)}
                          className={`w-11 h-11 rounded-full font-medium transition-colors ${
                            selected
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {getWeekdayText(day).replace('周', '')}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">备注（可选）</label>
                <input
                  type="text"
                  value={buyFormData.remark}
                  onChange={e => setBuyFormData(prev => ({ ...prev, remark: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="特殊要求等"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold"
                >
                  确认购买
                </button>
                <button
                  type="button"
                  onClick={() => setShowBuyForm(false)}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPauseForm && pausingPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-800">暂停套餐</h3>
              <button onClick={() => setShowPauseForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={handlePauseSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">暂停原因</label>
                <input
                  type="text"
                  value={pauseReason}
                  onChange={e => setPauseReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="请输入暂停原因"
                  required
                />
              </div>
              <p className="text-sm text-gray-500">
                暂停期间未完成的服务将被跳过，恢复后从未来日期继续服务。
              </p>
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-yellow-500 text-white rounded-xl font-bold"
                >
                  确认暂停
                </button>
                <button
                  type="button"
                  onClick={() => setShowPauseForm(false)}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRenewForm && renewingPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="w-full max-w-lg bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-lg text-gray-800">续订套餐</h3>
              <button onClick={() => setShowRenewForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={handleRenewSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <div className="font-bold text-green-700">续订：{renewingPackage.template?.name}</div>
                <div className="text-sm text-green-600 mt-1">
                  ¥{renewingPackage.totalAmount} · 共{renewingPackage.totalServices}次
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">续费开始日期</label>
                <input
                  type="date"
                  value={renewFormData.startDate}
                  min={formatDate(new Date())}
                  onChange={e => setRenewFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">服务地址</label>
                <input
                  type="text"
                  value={renewFormData.address}
                  onChange={e => setRenewFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">服务时间</label>
                <input
                  type="time"
                  value={renewFormData.timeOfDay}
                  onChange={e => setRenewFormData(prev => ({ ...prev, timeOfDay: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              {renewingPackage.cycleType === PackageCycleType.WEEKLY && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">服务日期（每周）</label>
                  <div className="flex gap-2 flex-wrap">
                    {weekdays.map(day => {
                      const selected = parseWeekdaySchedule(renewFormData.weekdaySchedule).includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWeekday('renew', day)}
                          className={`w-11 h-11 rounded-full font-medium transition-colors ${
                            selected
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {getWeekdayText(day).replace('周', '')}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold"
                >
                  确认续订
                </button>
                <button
                  type="button"
                  onClick={() => setShowRenewForm(false)}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-around">
        <button
          onClick={() => router.push('/')}
          className="flex flex-col items-center py-2 px-4 text-gray-500"
        >
          <span className="text-2xl">🏠</span>
          <span className="text-xs mt-1">首页</span>
        </button>
        <button
          onClick={() => router.push('/orders')}
          className="flex flex-col items-center py-2 px-4 text-gray-500"
        >
          <span className="text-2xl">📋</span>
          <span className="text-xs mt-1">订单</span>
        </button>
        <button
          className="flex flex-col items-center py-2 px-4 text-orange-600"
        >
          <span className="text-2xl">📦</span>
          <span className="text-xs mt-1 font-medium">套餐</span>
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="flex flex-col items-center py-2 px-4 text-gray-500"
        >
          <span className="text-2xl">👤</span>
          <span className="text-xs mt-1">我的</span>
        </button>
      </div>
    </div>
  )
}
