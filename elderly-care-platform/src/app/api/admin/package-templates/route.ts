import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { z } from 'zod'
import { UserRole, PackageCycleType } from '@/generated/prisma'

const createTemplateSchema = z.object({
  name: z.string().min(1, '套餐名称不能为空'),
  description: z.string().optional(),
  serviceId: z.number().int().positive('服务ID不能为空'),
  cycleType: z.nativeEnum(PackageCycleType),
  cycleDays: z.number().int().positive().optional(),
  totalServices: z.number().int().positive('服务次数不能为空'),
  timeOfDay: z.string().optional(),
  weekdaySchedule: z.string().optional(),
  address: z.string().optional(),
  basePrice: z.number().positive('套餐价格不能为空'),
  discountRate: z.number().min(1).max(100).default(100),
  isActive: z.boolean().default(true)
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  serviceId: z.number().int().positive().optional(),
  cycleType: z.nativeEnum(PackageCycleType).optional(),
  cycleDays: z.number().int().positive().optional(),
  totalServices: z.number().int().positive().optional(),
  timeOfDay: z.string().optional(),
  weekdaySchedule: z.string().optional(),
  address: z.string().optional(),
  basePrice: z.number().positive().optional(),
  discountRate: z.number().min(1).max(100).optional(),
  isActive: z.boolean().optional()
})

export async function GET(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN, UserRole.ELDERLY])(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const isActive = searchParams.get('isActive')
  const category = searchParams.get('category')
  const keyword = searchParams.get('keyword')

  try {
    const whereClause: any = {}

    if (isActive !== null) {
      whereClause.isActive = isActive === 'true'
    }

    if (category) {
      whereClause.service = {
        category
      }
    }

    if (keyword) {
      whereClause.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } }
      ]
    }

    const templates = await prisma.packageTemplate.findMany({
      where: whereClause,
      include: {
        service: {
          include: {
            mealConfig: true,
            bathConfig: true,
            cleaningConfig: true,
            medicalConfig: true,
            companionConfig: true
          }
        },
        _count: {
          select: { packageOrders: true }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('获取套餐模板列表错误:', error)
    return NextResponse.json(
      { error: '获取套餐模板列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const validated = createTemplateSchema.parse(body)

    const service = await prisma.service.findUnique({
      where: { id: validated.serviceId }
    })

    if (!service) {
      return NextResponse.json(
        { error: '关联服务不存在' },
        { status: 404 }
      )
    }

    const template = await prisma.packageTemplate.create({
      data: {
        name: validated.name,
        description: validated.description,
        serviceId: validated.serviceId,
        cycleType: validated.cycleType,
        cycleDays: validated.cycleDays,
        totalServices: validated.totalServices,
        timeOfDay: validated.timeOfDay,
        weekdaySchedule: validated.weekdaySchedule,
        address: validated.address,
        basePrice: validated.basePrice,
        discountRate: validated.discountRate,
        isActive: validated.isActive
      },
      include: {
        service: true
      }
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('创建套餐模板错误:', error)
    return NextResponse.json(
      { error: '创建套餐模板失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = parseInt(searchParams.get('id') || '0', 10)

  if (!id) {
    return NextResponse.json(
      { error: '套餐模板ID不能为空' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const validated = updateTemplateSchema.parse(body)

    const existing = await prisma.packageTemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: '套餐模板不存在' },
        { status: 404 }
      )
    }

    const template = await prisma.packageTemplate.update({
      where: { id },
      data: validated,
      include: {
        service: true
      }
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('更新套餐模板错误:', error)
    return NextResponse.json(
      { error: '更新套餐模板失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = parseInt(searchParams.get('id') || '0', 10)

  if (!id) {
    return NextResponse.json(
      { error: '套餐模板ID不能为空' },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.packageTemplate.findUnique({
      where: { id },
      include: { _count: { select: { packageOrders: true } } }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '套餐模板不存在' },
        { status: 404 }
      )
    }

    if (existing._count.packageOrders > 0) {
      return NextResponse.json(
        { error: '该模板已有套餐订单，无法删除' },
        { status: 400 }
      )
    }

    await prisma.packageTemplate.delete({ where: { id } })

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除套餐模板错误:', error)
    return NextResponse.json(
      { error: '删除套餐模板失败' },
      { status: 500 }
    )
  }
}
