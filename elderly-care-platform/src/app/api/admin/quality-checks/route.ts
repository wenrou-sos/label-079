import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { UserRole } from '@/generated/prisma'
import { z } from 'zod'

const createQualityCheckSchema = z.object({
  orderId: z.number().int().positive('订单ID不能为空'),
  checkType: z.string().min(1, '检查类型不能为空'),
  result: z.string().min(1, '检查结果不能为空'),
  score: z.number().int().min(0).max(100).optional(),
  remark: z.string().optional()
})

const updateQualityCheckSchema = z.object({
  checkType: z.string().optional(),
  result: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  remark: z.string().optional(),
  checkedAt: z.string().optional()
})

export async function GET(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN, UserRole.STAFF])(request)
  if (authError) return authError

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json(
      { error: '用户未认证' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const staffId = searchParams.get('staffId')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

  try {
    const whereClause: any = {}

    if (currentUser.role === UserRole.STAFF) {
      whereClause.staffId = currentUser.userId
    } else if (staffId) {
      whereClause.staffId = parseInt(staffId, 10)
    }

    const qualityChecks = await prisma.qualityCheck.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            elderly: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            },
            service: true
          }
        },
        admin: {
          select: {
            id: true,
            name: true
          }
        },
        staff: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize
    })

    const total = await prisma.qualityCheck.count({ where: whereClause })

    return NextResponse.json({
      data: qualityChecks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    })
  } catch (error) {
    console.error('获取质量抽查列表错误:', error)
    return NextResponse.json(
      { error: '获取质量抽查列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
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
    const validated = createQualityCheckSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id: validated.orderId }
    })

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    const existingCheck = await prisma.qualityCheck.findUnique({
      where: { orderId: validated.orderId }
    })

    if (existingCheck) {
      return NextResponse.json(
        { error: '该订单已存在质量抽查记录' },
        { status: 400 }
      )
    }

    const qualityCheck = await prisma.qualityCheck.create({
      data: {
        orderId: validated.orderId,
        adminId: currentUser.userId,
        staffId: order.staffId!,
        checkType: validated.checkType,
        result: validated.result,
        score: validated.score,
        remark: validated.remark,
        checkedAt: new Date()
      }
    })

    return NextResponse.json(qualityCheck)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('创建质量抽查错误:', error)
    return NextResponse.json(
      { error: '创建质量抽查失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: '质量抽查ID不能为空' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const validated = updateQualityCheckSchema.parse(body)

    const qualityCheck = await prisma.qualityCheck.update({
      where: { id: parseInt(id, 10) },
      data: {
        checkType: validated.checkType,
        result: validated.result,
        score: validated.score,
        remark: validated.remark,
        checkedAt: validated.checkedAt ? new Date(validated.checkedAt) : undefined
      }
    })

    return NextResponse.json(qualityCheck)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('更新质量抽查错误:', error)
    return NextResponse.json(
      { error: '更新质量抽查失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: '质量抽查ID不能为空' },
      { status: 400 }
    )
  }

  try {
    await prisma.qualityCheck.delete({
      where: { id: parseInt(id, 10) }
    })

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除质量抽查错误:', error)
    return NextResponse.json(
      { error: '删除质量抽查失败' },
      { status: 500 }
    )
  }
}
