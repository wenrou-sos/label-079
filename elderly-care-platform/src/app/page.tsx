'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { serviceApi } from '@/lib/api'
import { ServiceCategory } from '@/types'
import { getServiceCategoryText } from '@/lib/utils'
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
