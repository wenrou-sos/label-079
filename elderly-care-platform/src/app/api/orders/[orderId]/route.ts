import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { OrderStatus, UserRole } from '@/generated/prisma'
import { z } from 'zod'

const checkInSchema = z.object({
  latitude: z.number(),
  longitude: z.number()
})

const checkOutSchema = z.object({
  latitude: z.number(),
  longitude: z.number()
})

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5, '评分必须在1-5之间'),
  comment: z.string().optional(),
  images: z.string().optional()
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const authError = await authMiddleware()(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json(
      { error: '用户未认证' },
      { status: 401 }
    )
  }

  const params = await context.params
  const orderId = parseInt(params.orderId, 10)

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        elderly: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            healthInfo: true,
            emergencyContact: true,
            emergencyPhone: true
          }
        },
        staff: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatar: true
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
            createdAt: 'asc'
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
        payments: true,
        review: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    if (
      currentUser.role === UserRole.ELDERLY && order.elderlyId !== currentUser.userId ||
      currentUser.role === UserRole.STAFF && order.staffId !== currentUser.userId
    ) {
      return NextResponse.json(
        { error: '无权访问此订单' },
        { status: 403 }
      )
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('获取订单详情错误:', error)
    return NextResponse.json(
      { error: '获取订单详情失败' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const authError = await authMiddleware()(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json(
      { error: '用户未认证' },
      { status: 401 }
    )
  }

  const params = await context.params
  const orderId = parseInt(params.orderId, 10)
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        service: true
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    switch (action) {
      case 'accept':
        return await handleAccept(orderId, currentUser.userId)
      case 'checkin':
        return await handleCheckIn(orderId, currentUser, request)
      case 'checkout':
        return await handleCheckOut(orderId, currentUser, request)
      case 'complete':
        return await handleComplete(orderId, currentUser)
      case 'cancel':
        return await handleCancel(orderId, currentUser, request)
      case 'review':
        return await handleReview(orderId, currentUser, request)
      default:
        return NextResponse.json(
          { error: '无效的操作' },
          { status: 400 }
        )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('订单操作错误:', error)
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    )
  }
}

async function handleAccept(orderId: number, staffId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  
  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }
  
  if (order.status !== OrderStatus.PENDING) {
    return NextResponse.json({ error: '订单状态不允许接单' }, { status: 400 })
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      staffId,
      status: OrderStatus.ACCEPTED
    }
  })

  await prisma.orderStatusLog.create({
    data: {
      orderId,
      status: OrderStatus.ACCEPTED,
      operatorId: staffId,
      remark: '服务人员已接单'
    }
  })

  return NextResponse.json(updatedOrder)
}

async function handleCheckIn(orderId: number, currentUser: any, request: NextRequest) {
  const body = await request.json()
  const validated = checkInSchema.parse(body)

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  
  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }
  
  if (order.staffId !== currentUser.userId) {
    return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
  }
  
  if (order.status !== OrderStatus.ACCEPTED) {
    return NextResponse.json({ error: '订单状态不允许打卡' }, { status: 400 })
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.IN_PROGRESS,
      actualStartTime: new Date(),
      checkInLatitude: validated.latitude,
      checkInLongitude: validated.longitude
    }
  })

  await prisma.orderStatusLog.create({
    data: {
      orderId,
      status: OrderStatus.IN_PROGRESS,
      operatorId: currentUser.userId,
      remark: '服务人员已打卡，开始服务'
    }
  })

  return NextResponse.json(updatedOrder)
}

async function handleCheckOut(orderId: number, currentUser: any, request: NextRequest) {
  const body = await request.json()
  const validated = checkOutSchema.parse(body)

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  
  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }
  
  if (order.staffId !== currentUser.userId) {
    return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
  }
  
  if (order.status !== OrderStatus.IN_PROGRESS) {
    return NextResponse.json({ error: '订单状态不允许结束服务' }, { status: 400 })
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.COMPLETED,
      actualEndTime: new Date(),
      checkOutLatitude: validated.latitude,
      checkOutLongitude: validated.longitude
    }
  })

  await prisma.orderStatusLog.create({
    data: {
      orderId,
      status: OrderStatus.COMPLETED,
      operatorId: currentUser.userId,
      remark: '服务完成，等待确认'
    }
  })

  return NextResponse.json(updatedOrder)
}

async function handleComplete(orderId: number, currentUser: any) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  
  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }
  
  if (order.elderlyId !== currentUser.userId) {
    return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
  }
  
  if (order.status !== OrderStatus.COMPLETED) {
    return NextResponse.json({ error: '订单状态不允许确认' }, { status: 400 })
  }

  await prisma.payment.create({
    data: {
      orderId,
      amount: order.totalAmount,
      subsidyAmount: order.subsidyAmount,
      personalAmount: order.personalAmount,
      status: 'PAID',
      paidAt: new Date()
    }
  })

  return NextResponse.json({ message: '订单确认完成，支付成功' })
}

async function handleCancel(orderId: number, currentUser: any, request: NextRequest) {
  const body = await request.json()
  const { reason } = body

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  
  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }
  
  if (
    order.elderlyId !== currentUser.userId &&
    currentUser.role !== UserRole.ADMIN
  ) {
    return NextResponse.json({ error: '无权取消此订单' }, { status: 403 })
  }
  
  if (
    order.status === OrderStatus.IN_PROGRESS ||
    order.status === OrderStatus.COMPLETED
  ) {
    return NextResponse.json({ error: '订单状态不允许取消' }, { status: 400 })
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      cancelReason: reason
    }
  })

  await prisma.orderStatusLog.create({
    data: {
      orderId,
      status: OrderStatus.CANCELLED,
      operatorId: currentUser.userId,
      remark: reason || '订单已取消'
    }
  })

  return NextResponse.json(updatedOrder)
}

async function handleReview(orderId: number, currentUser: any, request: NextRequest) {
  const body = await request.json()
  const validated = reviewSchema.parse(body)

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  
  if (!order) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 })
  }
  
  if (order.elderlyId !== currentUser.userId) {
    return NextResponse.json({ error: '无权评价此订单' }, { status: 403 })
  }
  
  if (order.status !== OrderStatus.COMPLETED) {
    return NextResponse.json({ error: '订单状态不允许评价' }, { status: 400 })
  }

  const existingReview = await prisma.review.findUnique({
    where: { orderId }
  })

  if (existingReview) {
    return NextResponse.json({ error: '此订单已评价' }, { status: 400 })
  }

  const review = await prisma.review.create({
    data: {
      orderId,
      reviewerId: currentUser.userId,
      revieweeId: order.staffId!,
      rating: validated.rating,
      comment: validated.comment,
      images: validated.images
    }
  })

  return NextResponse.json(review)
}
