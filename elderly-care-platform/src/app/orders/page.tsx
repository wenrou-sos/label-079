'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { orderApi } from '@/lib/api'
import { OrderStatus, UserRole } from '@/types'
import { getStatusText, getServiceCategoryText, formatDateTime } from '@/lib/utils'
import Link from 'next/link'

interface Order {
  id: number
  orderNo: string
  status: OrderStatus
  totalAmount: number
  subsidyAmount: number
  personalAmount: number
  scheduledTime: string
  address: string
  createdAt: string
  elderly: { name: string; phone: string; address: string }
  staff?: { name: string; phone: string }
  service: {
    id: number
    name: string
    category: string
    basePrice: number
    duration: number
    unit: string
  }
  review?: any
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700'
}

const serviceIcons: Record<string, string> = {
  MEAL: '🍱',
  BATH: '🛁',
  CLEANING: '🧹',
  MEDICAL: '💊',
  COMPANION: '👨‍👩‍👧'
}

export default function OrdersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      loadOrders()
    }
  }, [user, selectedStatus])

  const loadOrders = async () => {
    try {
      setOrdersLoading(true)
      const data: any = await orderApi.getList({
        status: selectedStatus || undefined,
        pageSize: 50
      })
      setOrders(data.data || data)
    } catch (error) {
      console.error('加载订单列表失败:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  const statusTabs = [
    { key: null, label: '全部' },
    { key: OrderStatus.PENDING, label: '待接单' },
    { key: OrderStatus.ACCEPTED, label: '已接单' },
    { key: OrderStatus.IN_PROGRESS, label: '服务中' },
    { key: OrderStatus.COMPLETED, label: '已完成' }
  ]

  const handleAccept = async (orderId: number) => {
    if (!confirm('确定要接单吗？')) return
    try {
      await orderApi.accept(orderId)
      alert('接单成功')
      loadOrders()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleCheckIn = async (orderId: number) => {
    if (!confirm('确定要开始服务吗？')) return
    try {
      await orderApi.checkIn(orderId, 39.9, 116.4)
      alert('打卡成功，开始服务')
      loadOrders()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleCheckOut = async (orderId: number) => {
    if (!confirm('确定要结束服务吗？')) return
    try {
      await orderApi.checkOut(orderId, 39.9, 116.4)
      alert('服务结束')
      loadOrders()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleComplete = async (orderId: number) => {
    if (!confirm('确认服务完成并支付？')) return
    try {
      await orderApi.complete(orderId)
      alert('确认成功，已完成支付')
      loadOrders()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleCancel = async (orderId: number) => {
    const reason = prompt('请输入取消原因：')
    if (reason === null) return
    try {
      await orderApi.cancel(orderId, reason)
      alert('订单已取消')
      loadOrders()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleReview = async (orderId: number) => {
    const ratingStr = prompt('请评分（1-5分）：', '5')
    if (!ratingStr) return
    const rating = parseInt(ratingStr, 10)
    if (rating < 1 || rating > 5) {
      alert('评分必须在1-5之间')
      return
    }
    const comment = prompt('请输入评价内容（可选）：') || undefined
    try {
      await orderApi.review(orderId, rating, comment)
      alert('评价成功')
      loadOrders()
    } catch (error: any) {
      alert(error.message)
    }
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">我的订单</h1>
        </div>
      </div>

      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.key || 'all'}
              onClick={() => setSelectedStatus(tab.key as OrderStatus | null)}
              className={`flex-shrink-0 px-6 py-4 font-medium border-b-2 transition-colors ${
                selectedStatus === tab.key
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {ordersLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-6xl">📭</span>
            <p className="text-gray-500 mt-4">暂无订单</p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
            >
              去预约服务
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{serviceIcons[order.service.category] || '📋'}</span>
                      <div>
                        <h3 className="font-bold text-gray-800">{order.service.name}</h3>
                        <p className="text-sm text-gray-500">{getServiceCategoryText(order.service.category)}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                      {getStatusText(order.status)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>📅 预约时间：{formatDateTime(order.scheduledTime)}</p>
                    <p>📍 服务地址：{order.address}</p>
                    {order.staff && (
                      <p>👤 服务人员：{order.staff.name} ({order.staff.phone})</p>
                    )}
                    {user.role === UserRole.STAFF && (
                      <p>👴 服务对象：{order.elderly.name} ({order.elderly.phone})</p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-500">订单金额：</span>
                      <span className="text-lg font-bold text-orange-500">¥{order.totalAmount}</span>
                      {order.subsidyAmount > 0 && (
                        <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          补贴¥{order.subsidyAmount}，自付¥{order.personalAmount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">订单号：{order.orderNo}</p>
                  </div>

                  <div className="mt-4 flex gap-2 flex-wrap">
                    {user.role === UserRole.STAFF && order.status === OrderStatus.PENDING && (
                      <button
                        onClick={() => handleAccept(order.id)}
                        className="flex-1 py-2 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors"
                      >
                        接单
                      </button>
                    )}

                    {user.role === UserRole.STAFF && order.status === OrderStatus.ACCEPTED && (
                      <button
                        onClick={() => handleCheckIn(order.id)}
                        className="flex-1 py-2 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors"
                      >
                        开始服务
                      </button>
                    )}

                    {user.role === UserRole.STAFF && order.status === OrderStatus.IN_PROGRESS && (
                      <button
                        onClick={() => handleCheckOut(order.id)}
                        className="flex-1 py-2 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors"
                      >
                        结束服务
                      </button>
                    )}

                    {user.role === UserRole.ELDERLY && order.status === OrderStatus.COMPLETED && !order.review && (
                      <button
                        onClick={() => handleComplete(order.id)}
                        className="flex-1 py-2 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors"
                      >
                        确认完成
                      </button>
                    )}

                    {user.role === UserRole.ELDERLY && order.status === OrderStatus.COMPLETED && !order.review && (
                      <button
                        onClick={() => handleReview(order.id)}
                        className="flex-1 py-2 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors"
                      >
                        评价
                      </button>
                    )}

                    {(order.status === OrderStatus.PENDING || order.status === OrderStatus.ACCEPTED) && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        className="px-4 py-2 bg-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-300 transition-colors"
                      >
                        取消
                      </button>
                    )}

                    <Link
                      href={`/orders/${order.id}`}
                      className="px-4 py-2 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      详情
                    </Link>
                  </div>

                  {order.review && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-xl">
                      <p className="text-sm">
                        <span className="text-yellow-500">{'⭐'.repeat(order.review.rating)}</span>
                        {order.review.comment && (
                          <span className="text-gray-600 ml-2">{order.review.comment}</span>
                        )}
                      </p>
                    </div>
                  )}
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
            className="flex flex-col items-center text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs mt-1">首页</span>
          </button>
          <button
            onClick={() => router.push('/orders')}
            className="flex flex-col items-center text-orange-500"
          >
            <span className="text-2xl">📋</span>
            <span className="text-xs mt-1 font-medium">订单</span>
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
