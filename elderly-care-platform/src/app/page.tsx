'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { serviceApi, reminderApi, orderApi, healthProfileApi } from '@/lib/api'
import { ServiceCategory, ReminderType, type Reminder } from '@/types'
import type { HealthProfile } from '@/types'
import { getServiceCategoryText, getReminderTypeIcon, getReminderTypeColor, getReminderTypeText } from '@/lib/utils'
import Link from 'next/link'

interface Service {
  id: number
  category: ServiceCategory
  name: string
  description: string
  basePrice: number
  duration: number
  unit: string
  mealConfig?: any
  bathConfig?: any
  cleaningConfig?: any
  medicalConfig?: any
  companionConfig?: any
}

const serviceIcons: Record<string, string> = {
  MEAL: '🍱',
  BATH: '🛁',
  CLEANING: '🧹',
  MEDICAL: '💊',
  COMPANION: '👨‍👩‍👧'
}

const categoryColors: Record<string, string> = {
  MEAL: 'from-orange-400 to-red-400',
  BATH: 'from-blue-400 to-cyan-400',
  CLEANING: 'from-green-400 to-emerald-400',
  MEDICAL: 'from-purple-400 to-pink-400',
  COMPANION: 'from-yellow-400 to-orange-400'
}

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null)
  const [servicesLoading, setServicesLoading] = useState(true)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [expandedReminder, setExpandedReminder] = useState<number | null>(null)
  const [recommendedPackages, setRecommendedPackages] = useState<any[]>([])
  const [packagesLoading, setPackagesLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    const loadServices = async () => {
      try {
        const data: any = await serviceApi.getList(selectedCategory || undefined)
        setServices(data)
      } catch (error) {
        console.error('加载服务列表失败:', error)
      } finally {
        setServicesLoading(false)
      }
    }

    loadServices()
  }, [selectedCategory])

  useEffect(() => {
    if (!user || user.role !== 'ELDERLY') {
      setRemindersLoading(false)
      return
    }

    const loadReminders = async () => {
      try {
        await reminderApi.generate()
        const data: any = await reminderApi.getList()
        setReminders(data.reminders || [])
        setUnreadCount(data.unreadCount || 0)
      } catch (error) {
        console.error('加载提醒失败:', error)
      } finally {
        setRemindersLoading(false)
      }
    }

    loadReminders()
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'ELDERLY' || services.length === 0) {
      setPackagesLoading(false)
      return
    }

    const loadRecommendations = async () => {
      try {
        setPackagesLoading(true)

        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

        const ordersPromise = orderApi.getList({
          startDate: threeMonthsAgo.toISOString().split('T')[0]
        }).catch(() => ({ data: [] }))
        const healthPromise = healthProfileApi.get().catch(() => null) as Promise<HealthProfile | null>
        const [ordersData, healthProfile] = await Promise.all([ordersPromise, healthPromise])

        const recentOrders = (ordersData as any).data || []
        const orderCount = recentOrders.length

        const categoryCount: Record<string, number> = {}
        recentOrders.forEach((order: any) => {
          if (order.service?.category) {
            const cat = order.service.category
            categoryCount[cat] = (categoryCount[cat] || 0) + 1
          }
        })

        const sortedCategories = Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .map(([cat]) => cat)

        let age: number | null = null
        if (user.birthday) {
          const birth = new Date(user.birthday)
          const now = new Date()
          age = now.getFullYear() - birth.getFullYear()
          if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) {
            age--
          }
        }

        const hasChronicDisease = healthProfile?.chronicDiseases && 
          healthProfile.chronicDiseases.trim().length > 0
        const needsFollowUp = healthProfile?.lastCheckupDate && 
          (new Date().getTime() - new Date(healthProfile.lastCheckupDate).getTime()) > 90 * 24 * 60 * 60 * 1000
        const isElderly = age !== null && age >= 75

        const packages: any[] = []
        const addedPackageIds = new Set<string>()

        const addPackage = (pkg: any) => {
          if (!addedPackageIds.has(pkg.id)) {
            addedPackageIds.add(pkg.id)
            packages.push(pkg)
          }
        }

        if (sortedCategories.includes(ServiceCategory.MEAL)) {
          const mealServices = services.filter(s => s.category === ServiceCategory.MEAL)
          if (mealServices.length > 0) {
            const mealCount = categoryCount[ServiceCategory.MEAL] || 0
            addPackage({
              id: 'meal-weekly',
              name: '营养助餐周套餐',
              icon: '🍱',
              color: 'from-orange-400 to-red-400',
              description: '一周营养配餐，每日送餐上门',
              originalPrice: mealServices.reduce((sum, s) => sum + Number(s.basePrice), 0) * 7,
              discountPrice: Math.round(mealServices.reduce((sum, s) => sum + Number(s.basePrice), 0) * 7 * 0.85),
              services: mealServices.slice(0, 2),
              tag: '热销',
              reason: orderCount > 0 
                ? `根据您近3个月${mealCount}次助餐服务偏好推荐`
                : '营养助餐，每日配送'
            })
          }
        }

        if (sortedCategories.includes(ServiceCategory.CLEANING)) {
          const cleaningServices = services.filter(s => s.category === ServiceCategory.CLEANING)
          if (cleaningServices.length > 0) {
            const cleaningCount = categoryCount[ServiceCategory.CLEANING] || 0
            addPackage({
              id: 'cleaning-monthly',
              name: '居家保洁月套餐',
              icon: '🧹',
              color: 'from-green-400 to-emerald-400',
              description: '每月4次居家保洁 + 2次洗衣服务',
              originalPrice: 4 * 30 + 2 * 25,
              discountPrice: Math.round((4 * 30 + 2 * 25) * 0.8),
              services: cleaningServices,
              tag: '超值',
              reason: `根据您近3个月${cleaningCount}次保洁服务偏好推荐`
            })
          }
        }

        if (sortedCategories.includes(ServiceCategory.COMPANION)) {
          const companionServices = services.filter(s => s.category === ServiceCategory.COMPANION)
          if (companionServices.length > 0) {
            const companionCount = categoryCount[ServiceCategory.COMPANION] || 0
            addPackage({
              id: 'companion-care',
              name: '陪伴关怀套餐',
              icon: '👨‍👩‍👧',
              color: 'from-yellow-400 to-orange-400',
              description: '每周2次陪伴聊天 + 1次陪同散步',
              originalPrice: 8 * 25 + 4 * 25,
              discountPrice: Math.round((8 * 25 + 4 * 25) * 0.85),
              services: companionServices,
              tag: '关怀',
              reason: `根据您近3个月${companionCount}次陪护服务偏好推荐`
            })
          }
        }

        if (sortedCategories.includes(ServiceCategory.MEDICAL)) {
          const medicalServices = services.filter(s => s.category === ServiceCategory.MEDICAL)
          if (medicalServices.length > 0) {
            const medicalCount = categoryCount[ServiceCategory.MEDICAL] || 0
            addPackage({
              id: 'medical-care',
              name: '助医护理套餐',
              icon: '�',
              color: 'from-purple-400 to-pink-400',
              description: '每月2次陪诊 + 2次代取药服务',
              originalPrice: 2 * 50 + 2 * 30,
              discountPrice: Math.round((2 * 50 + 2 * 30) * 0.85),
              services: medicalServices,
              tag: '健康',
              reason: `根据您近3个月${medicalCount}次助医服务偏好推荐`
            })
          }
        }

        if (sortedCategories.includes(ServiceCategory.BATH)) {
          const bathServices = services.filter(s => s.category === ServiceCategory.BATH)
          if (bathServices.length > 0) {
            const bathCount = categoryCount[ServiceCategory.BATH] || 0
            addPackage({
              id: 'bath-care',
              name: '助浴护理套餐',
              icon: '🛁',
              color: 'from-blue-400 to-cyan-400',
              description: '每月2次上门助浴，专业护理安全保障',
              originalPrice: 2 * 80,
              discountPrice: Math.round(2 * 80 * 0.9),
              services: bathServices,
              tag: '关爱',
              reason: `根据您近3个月${bathCount}次助浴服务偏好推荐`
            })
          }
        }

        if (packages.length < 3 && (hasChronicDisease || needsFollowUp)) {
          const medicalServices = services.filter(s => s.category === ServiceCategory.MEDICAL)
          if (medicalServices.length > 0 && !addedPackageIds.has('medical-health')) {
            const reasons: string[] = []
            if (hasChronicDisease) reasons.push('慢性病管理')
            if (needsFollowUp) reasons.push('复诊提醒')
            addPackage({
              id: 'medical-health',
              name: '健康管理套餐',
              icon: '🏥',
              color: 'from-purple-400 to-pink-400',
              description: '每月2次陪诊服务 + 2次代取药，专人陪同就医',
              originalPrice: 2 * 50 + 2 * 30,
              discountPrice: Math.round((2 * 50 + 2 * 30) * 0.8),
              services: medicalServices,
              tag: '专属',
              reason: `为您的健康定制：${reasons.join('、')}`
            })
          }
        }

        if (packages.length < 3 && isElderly) {
          const bathServices = services.filter(s => s.category === ServiceCategory.BATH)
          const companionServices = services.filter(s => s.category === ServiceCategory.COMPANION)
          if (bathServices.length > 0 && !addedPackageIds.has('elderly-care')) {
            addPackage({
              id: 'elderly-care',
              name: '高龄关爱套餐',
              icon: '🛁',
              color: 'from-blue-400 to-cyan-400',
              description: '每月2次上门助浴 + 4次陪同散步',
              originalPrice: 2 * 80 + 4 * 25,
              discountPrice: Math.round((2 * 80 + 4 * 25) * 0.85),
              services: [...bathServices, ...companionServices.slice(0, 1)],
              tag: '关爱',
              reason: `为${age}岁高龄长辈定制，助浴陪护更安心`
            })
          }
        }

        if (packages.length < 3 && hasChronicDisease) {
          const companionServices = services.filter(s => s.category === ServiceCategory.COMPANION)
          if (companionServices.length > 0 && !addedPackageIds.has('companion-health')) {
            addPackage({
              id: 'companion-health',
              name: '健康关怀套餐',
              icon: '👨‍👩‍👧',
              color: 'from-yellow-400 to-orange-400',
              description: '每周2次陪同散步，促进身心健康',
              originalPrice: 8 * 25,
              discountPrice: Math.round(8 * 25 * 0.85),
              services: companionServices,
              tag: '推荐',
              reason: '适度运动有益健康，陪您一起散步'
            })
          }
        }

        if (packages.length < 3) {
          const mealServices = services.filter(s => s.category === ServiceCategory.MEAL)
          if (mealServices.length > 0 && !addedPackageIds.has('meal-weekly')) {
            addPackage({
              id: 'meal-weekly',
              name: '营养助餐周套餐',
              icon: '🍱',
              color: 'from-orange-400 to-red-400',
              description: '一周营养配餐，每日送餐上门',
              originalPrice: mealServices.reduce((sum, s) => sum + Number(s.basePrice), 0) * 7,
              discountPrice: Math.round(mealServices.reduce((sum, s) => sum + Number(s.basePrice), 0) * 7 * 0.85),
              services: mealServices.slice(0, 2),
              tag: '热销',
              reason: '营养均衡，送货上门，省心省力'
            })
          }
        }

        setRecommendedPackages(packages.slice(0, 3))
      } catch (error) {
        console.error('加载推荐套餐失败:', error)
      } finally {
        setPackagesLoading(false)
      }
    }

    loadRecommendations()
  }, [user, services])

  const handleMarkRead = async (id: number) => {
    try {
      await reminderApi.markRead(id)
      setReminders(prev => prev.map(r => r.id === id ? { ...r, isRead: true, readAt: new Date().toISOString() } : r))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await reminderApi.markAllRead()
      setReminders(prev => prev.map(r => ({ ...r, isRead: true, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch (error) {
      console.error('标记全部已读失败:', error)
    }
  }

  const handleDismiss = async (id: number) => {
    try {
      await reminderApi.dismiss(id)
      setReminders(prev => prev.filter(r => r.id !== id))
      setUnreadCount(prev => {
        const dismissed = reminders.find(r => r.id === id)
        return dismissed && !dismissed.isRead ? prev - 1 : prev
      })
    } catch (error) {
      console.error('关闭提醒失败:', error)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  const categories = Object.values(ServiceCategory)

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">您好，{user.name}</h1>
            <p className="text-orange-100 mt-1">今天想要什么服务呢？</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/orders')}
              className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
            >
              <span className="text-2xl">📋</span>
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <span className="text-xl">👤</span>
            </button>
          </div>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎫</span>
            <div>
              <p className="text-sm text-orange-100">当前补贴等级</p>
              <p className="text-lg font-bold">
                {user.subsidyLevel === 0 && '无补贴'}
                {user.subsidyLevel === 1 && '普通补贴 (30%)'}
                {user.subsidyLevel === 2 && '重点补贴 (50%)'}
                {user.subsidyLevel === 3 && '特困补贴 (80%)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">服务分类</h2>
          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                selectedCategory === null
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <span className="text-2xl mb-1">🏠</span>
              <span className="text-xs font-medium">全部</span>
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                  selectedCategory === category
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span className="text-2xl mb-1">{serviceIcons[category]}</span>
                <span className="text-xs font-medium">{getServiceCategoryText(category).replace('服务', '')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {user.role === 'ELDERLY' && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💝</span>
                  <h2 className="text-lg font-bold text-gray-800">关怀提醒</h2>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                  >
                    全部已读
                  </button>
                )}
              </div>
            </div>

            {remindersLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
              </div>
            ) : reminders.length > 0 ? (
              <div className="px-4 pb-4 space-y-3">
                {reminders.slice(0, 5).map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`rounded-xl border transition-all ${
                      reminder.isRead
                        ? 'bg-gray-50 border-gray-100'
                        : 'bg-white border-orange-200 shadow-sm'
                    }`}
                  >
                    <div
                      className="p-3 cursor-pointer"
                      onClick={() => {
                        if (!reminder.isRead) handleMarkRead(reminder.id)
                        setExpandedReminder(expandedReminder === reminder.id ? null : reminder.id)
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getReminderTypeColor(reminder.type)} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-lg">{getReminderTypeIcon(reminder.type)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-sm font-bold ${reminder.isRead ? 'text-gray-500' : 'text-gray-800'}`}>
                              {reminder.title}
                            </h3>
                            {!reminder.isRead && (
                              <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 ${reminder.isRead ? 'text-gray-400' : 'text-gray-600'} line-clamp-2`}>
                            {reminder.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {getReminderTypeText(reminder.type)}
                            </span>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">
                              {new Date(reminder.triggeredAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDismiss(reminder.id)
                          }}
                          className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {expandedReminder === reminder.id && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {reminder.content}
                        </p>
                        {(reminder.type === ReminderType.MEDICATION || reminder.type === ReminderType.FOLLOW_UP) && (
                          <Link
                            href="/orders/create?serviceId=6"
                            className="inline-block mt-3 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                          >
                            预约陪诊服务
                          </Link>
                        )}
                        {reminder.type === ReminderType.SERVICE_RECOMMENDATION && (
                          <Link
                            href="/"
                            className="inline-block mt-3 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                          >
                            查看服务
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {reminders.length > 5 && (
                  <div className="text-center">
                    <button className="text-sm text-orange-500 hover:text-orange-600 font-medium">
                      查看更多提醒
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 pb-4">
                <div className="text-center py-6">
                  <span className="text-4xl">🌤️</span>
                  <p className="text-gray-400 text-sm mt-2">今天没有新提醒</p>
                  <p className="text-gray-300 text-xs mt-1">祝您一天愉快！</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {user.role === 'ELDERLY' && recommendedPackages.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎁</span>
                <h2 className="text-lg font-bold text-gray-800">为您推荐套餐</h2>
              </div>
              <p className="text-xs text-gray-400 mt-1">根据您的服务偏好和健康档案智能推荐</p>
            </div>

            {packagesLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <div className="px-4 pb-4 space-y-3">
                {recommendedPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="relative rounded-xl border-2 border-orange-100 overflow-hidden hover:border-orange-300 transition-colors"
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${pkg.color}`}></div>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-2xl">{pkg.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-800">{pkg.name}</h3>
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full">
                              {pkg.tag}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                          <p className="text-xs text-gray-400 mt-1">💡 {pkg.reason}</p>
                          <div className="flex items-end gap-2 mt-3">
                            <span className="text-xl font-bold text-orange-500">
                              ¥{pkg.discountPrice}
                            </span>
                            <span className="text-sm text-gray-400 line-through mb-0.5">
                              ¥{pkg.originalPrice}
                            </span>
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-xs font-medium rounded">
                              省¥{pkg.originalPrice - pkg.discountPrice}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-400">包含服务：</span>
                          <div className="flex flex-wrap gap-1">
                            {pkg.services?.map((s: Service) => (
                              <span key={s.id} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/orders/create?serviceId=${pkg.services?.[0]?.id || 1}&packageId=${pkg.id}`}
                            className="flex-1 py-2.5 bg-orange-500 text-white font-medium rounded-lg text-center text-sm hover:bg-orange-600 transition-colors"
                          >
                            立即预约套餐
                          </Link>
                          <button className="px-4 py-2.5 bg-orange-50 text-orange-500 font-medium rounded-lg text-sm hover:bg-orange-100 transition-colors">
                            详情
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            {selectedCategory ? getServiceCategoryText(selectedCategory) : '全部服务'}
          </h2>
          <span className="text-sm text-gray-500">{services.length} 项服务</span>
        </div>

        {servicesLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className={`h-2 bg-gradient-to-r ${categoryColors[service.category]}`}></div>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${categoryColors[service.category]} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-3xl">{serviceIcons[service.category]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-bold text-gray-800">{service.name}</h3>
                        <div className="text-right">
                          <p className="text-xl font-bold text-orange-500">
                            ¥{service.basePrice}
                            <span className="text-sm font-normal text-gray-500">/{service.unit}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-gray-400">
                          ⏱️ {service.duration}分钟
                        </span>
                        {service.mealConfig?.deliveryFee !== undefined && (
                          <span className="text-xs text-gray-400">
                            🚚 配送费¥{service.mealConfig.deliveryFee}
                          </span>
                        )}
                      </div>

                      {service.mealConfig && (
                        <div className="mt-3 p-3 bg-orange-50 rounded-xl">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">今日菜单：</span>
                            {service.mealConfig.menu}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex gap-3">
                        <Link
                          href={`/orders/create?serviceId=${service.id}`}
                          className="flex-1 py-3 bg-orange-500 text-white font-medium rounded-xl text-center hover:bg-orange-600 transition-colors"
                        >
                          立即预约
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => router.push('/')}
            className="flex flex-col items-center text-orange-500"
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs mt-1 font-medium">首页</span>
          </button>
          <button
            onClick={() => router.push('/orders')}
            className="flex flex-col items-center text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">📋</span>
            <span className="text-xs mt-1">订单</span>
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">👤</span>
            <span className="text-xs mt-1">我的</span>
          </button>
        </div>
      </div>
    </div>
  )
}
