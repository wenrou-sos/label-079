import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware } from '@/lib/middleware'
import { OrderStatus, UserRole } from '@/generated/prisma'

export async function GET(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    const orderDateFilter: any = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

    const totalUsers = await prisma.user.count()
    const totalElderly = await prisma.user.count({ where: { role: UserRole.ELDERLY } })
    const totalStaff = await prisma.user.count({ where: { role: UserRole.STAFF } })
    const totalServices = await prisma.service.count({ where: { isActive: true } })
    const totalOrders = await prisma.order.count({ where: orderDateFilter })

    const pendingOrders = await prisma.order.count({
      where: { ...orderDateFilter, status: OrderStatus.PENDING }
    })
    const acceptedOrders = await prisma.order.count({
      where: { ...orderDateFilter, status: OrderStatus.ACCEPTED }
    })
    const inProgressOrders = await prisma.order.count({
      where: { ...orderDateFilter, status: OrderStatus.IN_PROGRESS }
    })
    const completedOrders = await prisma.order.count({
      where: { ...orderDateFilter, status: OrderStatus.COMPLETED }
    })
    const cancelledOrders = await prisma.order.count({
      where: { ...orderDateFilter, status: OrderStatus.CANCELLED }
    })

    const totalAmountResult = await prisma.payment.aggregate({
      where: {
        status: 'PAID',
        ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter })
      },
      _sum: {
        amount: true,
        subsidyAmount: true,
        personalAmount: true
      }
    })

    const averageRatingResult = await prisma.review.aggregate({
      where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
      _avg: {
        rating: true
      }
    })

    const qualityCheckCount = await prisma.qualityCheck.count({
      where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
    })

    const serviceStats = await prisma.order.groupBy({
      by: ['serviceId'],
      where: orderDateFilter as any,
      _count: true,
      orderBy: {
        _count: {
          serviceId: 'desc'
        }
      },
      take: 5
    })

    const serviceDetails = await Promise.all(
      serviceStats.map(async (stat) => {
        const service = await prisma.service.findUnique({
          where: { id: stat.serviceId }
        })
        return {
          serviceId: stat.serviceId,
          serviceName: service?.name,
          category: service?.category,
          count: stat._count
        }
      })
    )

    const staffStats = await prisma.order.groupBy({
      by: ['staffId'],
      where: {
        ...orderDateFilter,
        staffId: { not: null }
      } as any,
      _count: true,
      orderBy: {
        _count: {
          staffId: 'desc'
        }
      },
      take: 5
    })

    const staffDetails = await Promise.all(
      staffStats.map(async (stat) => {
        const staff = await prisma.user.findUnique({
          where: { id: stat.staffId! },
          select: { id: true, name: true, phone: true }
        })
        return {
          staff,
          count: stat._count
        }
      })
    )

    return NextResponse.json({
      overview: {
        totalUsers,
        totalElderly,
        totalStaff,
        totalServices,
        totalOrders,
        pendingOrders,
        acceptedOrders,
        inProgressOrders,
        completedOrders,
        cancelledOrders,
        totalAmount: totalAmountResult._sum.amount?.toNumber() || 0,
        totalSubsidy: totalAmountResult._sum.subsidyAmount?.toNumber() || 0,
        totalPersonal: totalAmountResult._sum.personalAmount?.toNumber() || 0,
        averageRating: averageRatingResult._avg.rating || 0,
        qualityCheckCount
      },
      serviceRank: serviceDetails,
      staffRank: staffDetails
    })
  } catch (error) {
    console.error('获取统计数据错误:', error)
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}
