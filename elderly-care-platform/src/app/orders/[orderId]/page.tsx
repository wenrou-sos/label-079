'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { orderApi } from '@/lib/api'
import { OrderStatus, UserRole } from '@/types'
import { getStatusText, getServiceCategoryText, formatDateTime } from '@/lib/utils'

interface OrderDetail {
  id: number
  orderNo: string
  status: OrderStatus
  totalAmount: number
  subsidyAmount: number
  personalAmount: number
  scheduledTime: string
  actualStartTime?: string
  actualEndTime?: string
  checkInLatitude?: number
  checkInLongitude?: number
  checkOutLatitude?: number
  checkOutLongitude?: number
  address: string
  latitude?: number
  longitude?: number
  remark?: string
  cancelReason?: string
  createdAt: string
  updatedAt: string
  elderly: {
    id: number
    name: string
    phone: string
    address: string
    healthInfo?: string
    emergencyContact?: string
    emergencyPhone?: string
  }
  staff?: {
    id: number
    name: string
    phone: string
    avatar?: string
  }
  service: {
    id: number
    category: string
    name: string
    description: string
    basePrice: number
    duration: number
    unit: string
  }
  statusLogs: Array<{
    id: number
    status: OrderStatus
    remark?: string
    createdAt: string
    operator: {
      id: number
      name: string
      role: UserRole
    }
  }>
  payments: Array<{
    id: number
    amount: number
    subsidyAmount: number
    personalAmount: number
    status: string
    paidAt?: string
  }>
  review?: {
    id: number
    rating: number
    comment?: string
    createdAt: string
    reviewer: {
      id: number
      name: string
    }
  }
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

const statusTimelineIcons: Record<string, string> = {
  PENDING: '📝',
  ACCEPTED: '✅',
  IN_PROGRESS: '🚀',
  COMPLETED: '🎉',
  CANCELLED: '❌'
}

export default function OrderDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const orderId = parseInt(params.orderId as string, 10)

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [, startTransition] = useTransition()

  const loadOrderDetail = useCallback(async () => {
    try {
      setDetailLoading(true)
      const data = await orderApi.getDetail(orderId) as OrderDetail
      setOrder(data)
    } catch (error) {
      console.error('加载订单详情失败:', error)
      alert('加载订单详情失败')
    } finally {
      setDetailLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user && orderId) {
      startTransition(() => {
        loadOrderDetail()
      })
    }
  }, [user, orderId, loadOrderDetail, startTransition])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  const handleAccept = async () => {
    if (!confirm('确定要接单吗？')) return
    try {
      await orderApi.accept(orderId)
      alert('接单成功')
      loadOrderDetail()
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleCheckIn = async () => {
    if (!confirm('确定要开始服务吗？')) return
    try {
      await orderApi.checkIn(orderId, 39.9, 116.4)
      alert('打卡成功，开始服务')
      loadOrderDetail()
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleCheckOut = async () => {
    if (!confirm('确定要结束服务吗？')) return
    try {
      await orderApi.checkOut(orderId, 39.9, 116.4)
      alert('服务结束')
      loadOrderDetail()
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleComplete = async () => {
    if (!confirm('确认服务完成并支付？')) return
    try {
      await orderApi.complete(orderId)
      alert('确认成功，已完成支付')
      loadOrderDetail()
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleCancel = async () => {
    const reason = prompt('请输入取消原因：')
    if (reason === null) return
    try {
      await orderApi.cancel(orderId, reason)
      alert('订单已取消')
      loadOrderDetail()
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleReview = async () => {
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
      loadOrderDetail()
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败')
    }
  }

  if (detailLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <span className="text-6xl">📭</span>
        <p className="text-gray-500 mt-4">订单不存在</p>
        <button
          onClick={() => router.back()}
          className="mt-6 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
        >
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">订单详情</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{serviceIcons[order.service.category] || '📋'}</span>
                <div>
                  <h2 className="font-bold text-gray-800 text-lg">{order.service.name}</h2>
                  <p className="text-sm text-gray-500">{getServiceCategoryText(order.service.category)}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                {getStatusText(order.status)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>订单号：{order.orderNo}</span>
              <span>创建时间：{formatDateTime(order.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>📅</span> 服务信息
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-gray-400 w-24 flex-shrink-0">预约时间</span>
                <span className="text-gray-700">{formatDateTime(order.scheduledTime)}</span>
              </div>
              {order.actualStartTime && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">开始时间</span>
                  <span className="text-gray-700">{formatDateTime(order.actualStartTime)}</span>
                </div>
              )}
              {order.actualEndTime && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">结束时间</span>
                  <span className="text-gray-700">{formatDateTime(order.actualEndTime)}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-gray-400 w-24 flex-shrink-0">服务地址</span>
                <span className="text-gray-700">{order.address}</span>
              </div>
              {order.checkInLatitude && order.checkInLongitude && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">打卡位置</span>
                  <span className="text-gray-700">
                    开始：{order.checkInLatitude.toFixed(4)}, {order.checkInLongitude.toFixed(4)}
                  </span>
                </div>
              )}
              {order.checkOutLatitude && order.checkOutLongitude && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0"></span>
                  <span className="text-gray-700">
                    结束：{order.checkOutLatitude.toFixed(4)}, {order.checkOutLongitude.toFixed(4)}
                  </span>
                </div>
              )}
              {order.remark && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">备注</span>
                  <span className="text-gray-700">{order.remark}</span>
                </div>
              )}
              {order.cancelReason && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">取消原因</span>
                  <span className="text-red-600">{order.cancelReason}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>💰</span> 价格明细
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">服务总价</span>
                <span className="text-gray-700">¥{order.totalAmount}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">补贴金额</span>
                <span className="text-green-600">-¥{order.subsidyAmount}</span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-gray-700 font-medium">个人支付</span>
                <span className="text-xl font-bold text-orange-500">¥{order.personalAmount}</span>
              </div>
              {order.payments.length > 0 && (
                <div className="mt-3 p-3 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <span>✅</span>
                    <span>已支付 · {formatDateTime(order.payments[0].paidAt!)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>👴</span> 老人信息
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-20">姓名</span>
                <span className="text-gray-700">{order.elderly.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-20">电话</span>
                <span className="text-gray-700">{order.elderly.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 w-20">住址</span>
                <span className="text-gray-700">{order.elderly.address}</span>
              </div>
              {order.elderly.healthInfo && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-20">健康信息</span>
                  <span className="text-gray-700">{order.elderly.healthInfo}</span>
                </div>
              )}
              {order.elderly.emergencyContact && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-20">紧急联系人</span>
                  <span className="text-gray-700">
                    {order.elderly.emergencyContact} ({order.elderly.emergencyPhone})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {order.staff && (
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>👷</span> 服务人员信息
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-20">姓名</span>
                  <span className="text-gray-700">{order.staff.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-20">电话</span>
                  <span className="text-gray-700">{order.staff.phone}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>📊</span> 状态流转
            </h3>
            <div className="relative">
              {order.statusLogs.map((log, index) => (
                <div key={log.id} className="relative pl-8 pb-6 last:pb-0">
                  {index < order.statusLogs.length - 1 && (
                    <div className="absolute left-3 top-6 w-0.5 h-full bg-gray-200"></div>
                  )}
                  <div className="absolute left-0 top-0 w-6 h-6 bg-white border-2 border-orange-500 rounded-full flex items-center justify-center text-xs">
                    {statusTimelineIcons[log.status] || '📍'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{getStatusText(log.status)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[log.status]}`}>
                        {getStatusText(log.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDateTime(log.createdAt)} · {log.operator.name}
                    </p>
                    {log.remark && (
                      <p className="text-sm text-gray-600 mt-1">{log.remark}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {order.review && (
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>⭐</span> 评价信息
              </h3>
              <div className="bg-yellow-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-500 text-lg">
                    {'⭐'.repeat(order.review.rating)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {order.review.reviewer.name} · {formatDateTime(order.review.createdAt)}
                  </span>
                </div>
                {order.review.comment && (
                  <p className="text-gray-700">{order.review.comment}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-md mx-auto flex gap-2">
          {user.role === UserRole.STAFF && order.status === OrderStatus.PENDING && (
            <button
              onClick={handleAccept}
              className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors"
            >
              接单
            </button>
          )}

          {user.role === UserRole.STAFF && order.status === OrderStatus.ACCEPTED && (
            <button
              onClick={handleCheckIn}
              className="flex-1 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors"
            >
              打卡开始
            </button>
          )}

          {user.role === UserRole.STAFF && order.status === OrderStatus.IN_PROGRESS && (
            <button
              onClick={handleCheckOut}
              className="flex-1 py-3 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors"
            >
              打卡结束
            </button>
          )}

          {user.role === UserRole.ELDERLY && order.status === OrderStatus.COMPLETED && !order.review && (
            <>
              {order.payments.length === 0 && (
                <button
                  onClick={handleComplete}
                  className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors"
                >
                  确认完成
                </button>
              )}
              <button
                onClick={handleReview}
                className="flex-1 py-3 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors"
              >
                评价
              </button>
            </>
          )}

          {(order.status === OrderStatus.PENDING || order.status === OrderStatus.ACCEPTED) && (
            <button
              onClick={handleCancel}
              className="flex-1 py-3 bg-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-300 transition-colors"
            >
              取消订单
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
