import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import {
  generatePackageNo,
  calculateSubsidy,
  generateServiceSchedule
} from '@/lib/utils'
import { z } from 'zod'
import { UserRole, PackageStatus, OrderStatus } from '@/generated/prisma'

const createPackageSchema = z.object({
  templateId: z.number().int().positive('套餐模板ID不能为空'),
  startDate: z.string().min(1, '开始日期不能为空'),
  address: z.string().min(1, '服务地址不能为空'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timeOfDay: z.string().optional(),
  weekdaySchedule: z.string().optional(),
  remark: z.string().optional()
})

const pauseSchema = z.object({
  reason: z.string().min(1, '暂停原因不能为空')
})

const renewSchema = z.object({
  startDate: z.string().optional(),
  address: z.string().optional(),
  timeOfDay: z.string().optional(),
  weekdaySchedule: z.string().optional(),
  remark: z.string().optional()
})

export async function GET(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ELDERLY, UserRole.ADMIN])(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户未认证' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as PackageStatus | null
  const elderlyId = searchParams.get('elderlyId')
    ? parseInt(searchParams.get('elderlyId') || '0', 10)
    : null
  const withServices = searchParams.get('withServices') === 'true'

  try {
    const whereClause: any = {}

    if (currentUser.role === UserRole.ELDERLY) {
      whereClause.elderlyId = currentUser.userId
    } else if (elderlyId) {
      whereClause.elderlyId = elderlyId
    }

    if (status) {
      whereClause.status = status
    }

    const packages = await prisma.packageOrder.findMany({
      where: whereClause,
      include: {
        elderly: {
          select: { id: true, name: true, phone: true, address: true }
        },
        template: {
          include: {
            service: true
          }
        },
        services: withServices
          ? {
              orderBy: { scheduledTime: 'asc' },
              include: {
                order: {
                  include: {
                    staff: { select: { id: true, name: true, phone: true } },
                    statusLogs: { orderBy: { createdAt: 'desc' }, take: 1 }
                  }
                }
              }
            }
          : false,
        _count: {
          select: { services: true }
        }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(packages)
  } catch (error) {
    console.error('获取套餐列表错误:', error)
    return NextResponse.json(
      { error: '获取套餐列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ELDERLY])(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户未认证' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = createPackageSchema.parse(body)

    const template = await prisma.packageTemplate.findUnique({
      where: { id: validated.templateId },
      include: { service: true }
    })

    if (!template || !template.isActive) {
      return NextResponse.json(
        { error: '套餐模板不存在或已下架' },
        { status: 404 }
      )
    }

    const elderly = await prisma.user.findUnique({
      where: { id: currentUser.userId }
    })

    if (!elderly) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const subsidyConfig = await prisma.subsidyConfig.findUnique({
      where: { level: elderly.subsidyLevel }
    })

    const startDate = new Date(validated.startDate)
    const cycleDays = template.cycleType === 'CUSTOM'
      ? template.cycleDays
      : null
    const weekdaySchedule = validated.weekdaySchedule || template.weekdaySchedule
    const timeOfDay = validated.timeOfDay || template.timeOfDay

    const endDate = new Date(startDate)
    if (template.cycleType === 'DAILY') {
      endDate.setDate(endDate.getDate() + template.totalServices)
    } else if (template.cycleType === 'MONTHLY') {
      endDate.setMonth(endDate.getMonth() + Math.ceil(template.totalServices / 2))
    } else if (template.cycleType === 'CUSTOM' && cycleDays) {
      endDate.setDate(endDate.getDate() + template.totalServices * cycleDays)
    } else {
      endDate.setDate(endDate.getDate() + template.totalServices * 7)
    }

    const totalAmount = template.basePrice.toNumber()
    const subsidyPercentage = subsidyConfig?.percentage.toNumber() || 0
    const maxSubsidy = subsidyConfig?.maxAmount.toNumber() || 0
    const subsidyAmount = calculateSubsidy(totalAmount, subsidyPercentage, maxSubsidy)
    const personalAmount = totalAmount - subsidyAmount

    const packageNo = generatePackageNo()

    const scheduleDates = generateServiceSchedule(
      startDate,
      endDate,
      template.cycleType,
      cycleDays,
      weekdaySchedule,
      timeOfDay,
      template.totalServices
    )

    const packageOrder = await prisma.packageOrder.create({
      data: {
        packageNo,
        elderlyId: currentUser.userId,
        templateId: template.id,
        status: PackageStatus.ACTIVE,
        startDate,
        endDate,
        totalServices: scheduleDates.length,
        usedServices: 0,
        remainingServices: scheduleDates.length,
        totalAmount,
        subsidyAmount,
        personalAmount,
        address: validated.address,
        latitude: validated.latitude,
        longitude: validated.longitude,
        cycleType: template.cycleType,
        cycleDays,
        weekdaySchedule,
        timeOfDay,
        remark: validated.remark,
        services: {
          create: scheduleDates.map((date, index) => ({
            serviceIndex: index,
            scheduledTime: date,
            status: PackageStatus.ACTIVE
          }))
        }
      },
      include: {
        template: { include: { service: true } },
        services: { orderBy: { scheduledTime: 'asc' } }
      }
    })

    return NextResponse.json(packageOrder)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('创建套餐订单错误:', error)
    return NextResponse.json(
      { error: '创建套餐订单失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ELDERLY, UserRole.ADMIN])(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户未认证' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = parseInt(searchParams.get('id') || '0', 10)
  const action = searchParams.get('action')

  if (!id) {
    return NextResponse.json({ error: '套餐ID不能为空' }, { status: 400 })
  }

  try {
    const pkg = await prisma.packageOrder.findUnique({
      where: { id },
      include: { template: { include: { service: true } }, services: true }
    })

    if (!pkg) {
      return NextResponse.json({ error: '套餐不存在' }, { status: 404 })
    }

    if (currentUser.role === UserRole.ELDERLY && pkg.elderlyId !== currentUser.userId) {
      return NextResponse.json({ error: '无权操作此套餐' }, { status: 403 })
    }

    switch (action) {
      case 'pause':
        return await handlePause(id, currentUser, request)
      case 'resume':
        return await handleResume(id, currentUser)
      case 'cancel':
        return await handleCancel(id, currentUser, request)
      case 'renew':
        return await handleRenew(id, currentUser, request)
      default:
        return NextResponse.json({ error: '无效的操作' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('套餐操作错误:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}

async function handlePause(id: number, currentUser: any, request: NextRequest) {
  const body = await request.json()
  const validated = pauseSchema.parse(body)

  const pkg = await prisma.packageOrder.findUnique({ where: { id } })
  if (!pkg) {
    return NextResponse.json({ error: '套餐不存在' }, { status: 404 })
  }
  if (pkg.status !== PackageStatus.ACTIVE) {
    return NextResponse.json({ error: '只有进行中的套餐才能暂停' }, { status: 400 })
  }

  await prisma.packageService.updateMany({
    where: {
      packageOrderId: id,
      status: PackageStatus.ACTIVE,
      scheduledTime: { gte: new Date() }
    },
    data: { status: PackageStatus.PAUSED }
  })

  const updated = await prisma.packageOrder.update({
    where: { id },
    data: {
      status: PackageStatus.PAUSED,
      pausedAt: new Date(),
      pauseReason: validated.reason
    },
    include: {
      template: { include: { service: true } },
      services: { orderBy: { scheduledTime: 'asc' } }
    }
  })

  return NextResponse.json(updated)
}

async function handleResume(id: number, currentUser: any) {
  const pkg = await prisma.packageOrder.findUnique({ where: { id } })
  if (!pkg) {
    return NextResponse.json({ error: '套餐不存在' }, { status: 404 })
  }
  if (pkg.status !== PackageStatus.PAUSED) {
    return NextResponse.json({ error: '只有暂停的套餐才能恢复' }, { status: 400 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const pastServices = await prisma.packageService.findMany({
    where: {
      packageOrderId: id,
      status: PackageStatus.PAUSED,
      scheduledTime: { lt: today }
    }
  })

  if (pastServices.length > 0) {
    const pastIds = pastServices.map(s => s.id)
    await prisma.packageService.updateMany({
      where: { id: { in: pastIds } },
      data: { status: PackageStatus.CANCELLED }
    })

    await prisma.packageOrder.update({
      where: { id },
      data: {
        usedServices: { increment: pastIds.length },
        remainingServices: { decrement: pastIds.length }
      }
    })
  }

  await prisma.packageService.updateMany({
    where: {
      packageOrderId: id,
      status: PackageStatus.PAUSED,
      scheduledTime: { gte: today }
    },
    data: { status: PackageStatus.ACTIVE }
  })

  const updated = await prisma.packageOrder.update({
    where: { id },
    data: {
      status: PackageStatus.ACTIVE,
      pausedAt: null,
      pauseReason: null
    },
    include: {
      template: { include: { service: true } },
      services: { orderBy: { scheduledTime: 'asc' } }
    }
  })

  return NextResponse.json(updated)
}

async function handleCancel(id: number, currentUser: any, request: NextRequest) {
  const body = await request.json()
  const { reason } = body

  const pkg = await prisma.packageOrder.findUnique({ where: { id } })
  if (!pkg) {
    return NextResponse.json({ error: '套餐不存在' }, { status: 404 })
  }
  if (pkg.status === PackageStatus.COMPLETED || pkg.status === PackageStatus.CANCELLED) {
    return NextResponse.json({ error: '此套餐无法取消' }, { status: 400 })
  }

  await prisma.packageService.updateMany({
    where: {
      packageOrderId: id,
      status: { in: [PackageStatus.ACTIVE, PackageStatus.PAUSED] }
    },
    data: { status: PackageStatus.CANCELLED }
  })

  const updated = await prisma.packageOrder.update({
    where: { id },
    data: {
      status: PackageStatus.CANCELLED,
      remark: reason
    },
    include: {
      template: { include: { service: true } },
      services: { orderBy: { scheduledTime: 'asc' } }
    }
  })

  return NextResponse.json(updated)
}

async function handleRenew(id: number, currentUser: any, request: NextRequest) {
  const body = await request.json()
  const validated = renewSchema.parse(body)

  const pkg = await prisma.packageOrder.findUnique({
    where: { id },
    include: { template: true }
  })
  if (!pkg) {
    return NextResponse.json({ error: '套餐不存在' }, { status: 404 })
  }

  const elderly = await prisma.user.findUnique({
    where: { id: currentUser.role === UserRole.ADMIN ? pkg.elderlyId : currentUser.userId }
  })
  if (!elderly) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  }

  const subsidyConfig = await prisma.subsidyConfig.findUnique({
    where: { level: elderly.subsidyLevel }
  })

  const startDate = validated.startDate
    ? new Date(validated.startDate)
    : new Date(pkg.endDate)
  const endDate = new Date(startDate)
  const cycleDays = pkg.cycleType === 'CUSTOM' ? pkg.cycleDays : null
  const weekdaySchedule = validated.weekdaySchedule || pkg.weekdaySchedule
  const timeOfDay = validated.timeOfDay || pkg.timeOfDay
  const address = validated.address || pkg.address

  if (pkg.cycleType === 'DAILY') {
    endDate.setDate(endDate.getDate() + pkg.totalServices)
  } else if (pkg.cycleType === 'MONTHLY') {
    endDate.setMonth(endDate.getMonth() + Math.ceil(pkg.totalServices / 2))
  } else if (pkg.cycleType === 'CUSTOM' && cycleDays) {
    endDate.setDate(endDate.getDate() + pkg.totalServices * cycleDays)
  } else {
    endDate.setDate(endDate.getDate() + pkg.totalServices * 7)
  }

  const totalAmount = pkg.template.basePrice.toNumber()
  const subsidyPercentage = subsidyConfig?.percentage.toNumber() || 0
  const maxSubsidy = subsidyConfig?.maxAmount.toNumber() || 0
  const subsidyAmount = calculateSubsidy(totalAmount, subsidyPercentage, maxSubsidy)
  const personalAmount = totalAmount - subsidyAmount

  const packageNo = generatePackageNo()

  const scheduleDates = generateServiceSchedule(
    startDate,
    endDate,
    pkg.cycleType,
    cycleDays,
    weekdaySchedule,
    timeOfDay,
    pkg.totalServices
  )

  const newPackage = await prisma.packageOrder.create({
    data: {
      packageNo,
      elderlyId: pkg.elderlyId,
      templateId: pkg.templateId,
      status: PackageStatus.ACTIVE,
      startDate,
      endDate,
      totalServices: scheduleDates.length,
      usedServices: 0,
      remainingServices: scheduleDates.length,
      totalAmount,
      subsidyAmount,
      personalAmount,
      address,
      latitude: pkg.latitude,
      longitude: pkg.longitude,
      cycleType: pkg.cycleType,
      cycleDays,
      weekdaySchedule,
      timeOfDay,
      renewedFromId: id,
      remark: validated.remark,
      services: {
        create: scheduleDates.map((date, index) => ({
          serviceIndex: index,
          scheduledTime: date,
          status: PackageStatus.ACTIVE
        }))
      }
    },
    include: {
      template: { include: { service: true } },
      services: { orderBy: { scheduledTime: 'asc' } }
    }
  })

  return NextResponse.json(newPackage)
}
