import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { generateOrderNo, calculateSubsidy } from '@/lib/utils'
import { z } from 'zod'
import { OrderStatus, UserRole, ServiceCategory } from '@/generated/prisma'

const createOrderSchema = z.object({
  serviceId: z.number().int().positive('服务ID不能为空'),
  scheduledTime: z.string().min(1, '预约时间不能为空'),
  address: z.string().min(1, '服务地址不能为空'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  remark: z.string().optional()
})

export async function GET(request: NextRequest) {
  const authError = await authMiddleware()(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json(
      { error: '用户未认证' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as OrderStatus | null
  const category = searchParams.get('category') as ServiceCategory | null
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const keyword = searchParams.get('keyword')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)

  try {
    const whereClause: any = {}

    if (currentUser.role === UserRole.ELDERLY) {
      whereClause.elderlyId = currentUser.userId
    } else if (currentUser.role === UserRole.STAFF) {
      whereClause.staffId = currentUser.userId
    }

    if (status) {
      whereClause.status = status
    }

    if (category) {
      whereClause.service = {
        category
      }
    }

    if (startDate || endDate) {
      whereClause.scheduledTime = {}
      if (startDate) {
        whereClause.scheduledTime.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        whereClause.scheduledTime.lte = end
      }
    }

    if (keyword) {
      whereClause.OR = [
        {
          orderNo: {
            contains: keyword,
            mode: 'insensitive'
          }
        },
        {
          elderly: {
            name: {
              contains: keyword,
              mode: 'insensitive'
            }
          }
        },
        {
          elderly: {
            phone: {
              contains: keyword
            }
          }
        }
      ]
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        elderly: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true
          }
        },
        staff: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        service: {
          include: {
            mealConfig: true,
            bathConfig: true,
            cleaningConfig: true,
            medicalConfig: true,
            companionConfig: true
          }
        },
        statusLogs: {
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            operator: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        },
        review: true
      },
      orderBy: [
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize
    })

    const total = await prisma.order.count({ where: whereClause })

    return NextResponse.json({
      data: orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    })
  } catch (error) {
    console.error('获取订单列表错误:', error)
    return NextResponse.json(
      { error: '获取订单列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ELDERLY])(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json(
      { error: '用户未认证' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const validated = createOrderSchema.parse(body)

    const service = await prisma.service.findUnique({
      where: { id: validated.serviceId },
      include: {
        mealConfig: true
      }
    })

    if (!service || !service.isActive) {
      return NextResponse.json(
        { error: '服务不存在或已下架' },
        { status: 404 }
      )
    }

    const elderly = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: {
        familyMembers: true
      }
    })

    if (!elderly) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    const subsidyConfig = await prisma.subsidyConfig.findUnique({
      where: { level: elderly.subsidyLevel }
    })

    let totalAmount = service.basePrice.toNumber()
    if (service.mealConfig?.deliveryFee) {
      totalAmount += service.mealConfig.deliveryFee.toNumber()
    }

    const subsidyPercentage = subsidyConfig?.percentage.toNumber() || 0
    const maxSubsidy = subsidyConfig?.maxAmount.toNumber() || 0
    const subsidyAmount = calculateSubsidy(totalAmount, subsidyPercentage, maxSubsidy)
    const personalAmount = totalAmount - subsidyAmount

    const orderNo = generateOrderNo()

    const order = await prisma.order.create({
      data: {
        orderNo,
        elderlyId: currentUser.userId,
        serviceId: validated.serviceId,
        scheduledTime: new Date(validated.scheduledTime),
        totalAmount,
        subsidyAmount,
        personalAmount,
        address: validated.address,
        latitude: validated.latitude,
        longitude: validated.longitude,
        remark: validated.remark
      }
    })

    await prisma.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PENDING,
        operatorId: currentUser.userId,
        remark: '订单已创建'
      }
    })

    const orderWithDetails = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        elderly: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        service: true,
        statusLogs: true
      }
    })

    return NextResponse.json(orderWithDetails)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('创建订单错误:', error)
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 }
    )
  }
}
