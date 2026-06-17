'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { serviceApi, orderApi } from '@/lib/api'
import { calculateSubsidy, getServiceCategoryText } from '@/lib/utils'
import { ServiceCategory } from '@/types'

interface Service {
  id: number
  category: ServiceCategory
  name: string
  description: string
  basePrice: number
  duration: number
  unit: string
  mealConfig?: {
    deliveryFee: number
    menu?: string
  }
}

interface SubsidyConfig {
  percentage: number
  max: number
}

const subsidyConfigs: Record<number, SubsidyConfig> = {
  0: { percentage: 0, max: 0 },
  1: { percentage: 30, max: 100 },
  2: { percentage: 50, max: 200 },
  3: { percentage: 80, max: 500 }
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

function CreateOrderContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const serviceId = searchParams.get('serviceId')

  const [service, setService] = useState<Service | null>(null)
  const [serviceLoading, setServiceLoading] = useState(true)
  const [scheduledTime, setScheduledTime] = useState('')
  const [address, setAddress] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }

    if (serviceId) {
      loadService()
    }
  }, [serviceId, loading, user, router])

  const loadService = async () => {
    try {
      setServiceLoading(true)
      const data = await serviceApi.getById(parseInt(serviceId!)) as Service
      setService(data)
      if (data && user?.address) {
        setAddress(user.address)
      }
    } catch (error: any) {
      alert(error.message)
      router.push('/')
    } finally {
      setServiceLoading(false)
    }
  }

  const totalAmount = service ? service.basePrice * quantity : 0
  const subsidyConfig = user ? subsidyConfigs[user.subsidyLevel] : subsidyConfigs[0]
  const subsidyAmount = calculateSubsidy(totalAmount, subsidyConfig.percentage, subsidyConfig.max)
  const personalAmount = totalAmount - subsidyAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!service || !scheduledTime) {
      alert('请填写完整信息')
      return
    }

    try {
      setSubmitting(true)
      const order = await orderApi.create({
        serviceId: service.id,
        scheduledTime,
        address,
        quantity,
        notes
      }) as { id: number }
      alert('下单成功')
      router.push(`/orders/${order.id}`)
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || serviceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">服务不存在</div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold text-gray-900">确认订单</h1>
      </div>

      <div className={`bg-gradient-to-r ${categoryColors[service.category]} rounded-xl p-4 mb-6 text-white`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{serviceIcons[service.category]}</span>
          <div>
            <h2 className="font-bold text-lg">{service.name}</h2>
            <p className="text-sm opacity-90">{getServiceCategoryText(service.category)}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            服务时长
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              -
            </button>
            <span className="text-xl font-semibold">{quantity} {service.unit}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              +
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">预计服务时长 {service.duration * quantity} 分钟</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            预约时间 <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            服务地址 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="请输入服务地址"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            备注
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="请输入特殊需求或备注（可选）"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">费用明细</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">服务单价</span>
            <span className="text-gray-900">¥{service.basePrice}/{service.unit}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">数量</span>
            <span className="text-gray-900">{quantity} {service.unit}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">服务总价</span>
            <span className="text-gray-900">¥{totalAmount.toFixed(2)}</span>
          </div>
          {service.mealConfig && service.mealConfig.deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">配送费</span>
              <span className="text-gray-900">¥{service.mealConfig.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
            <span className="text-gray-600">政府补贴</span>
            <span className="text-green-600 font-semibold">-¥{subsidyAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span className="text-gray-900">个人支付</span>
            <span className="text-red-600">¥{personalAmount.toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-500">
            补贴等级：{user?.subsidyLevel === 0 ? '无' : `等级${user?.subsidyLevel}（${subsidyConfig.percentage}%，最高¥${subsidyConfig.max}）`}
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '提交中...' : `确认下单 ¥${personalAmount.toFixed(2)}`}
        </button>
      </form>
    </div>
  )
}

export default function CreateOrderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="text-gray-500">加载中...</div></div>}>
      <CreateOrderContent />
    </Suspense>
  )
}
