import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { UserRole } from '@/generated/prisma'
import { z } from 'zod'

const createScheduleSchema = z.object({
  staffId: z.number().int().positive('服务人员ID不能为空'),
  date: z.string().min(1, '日期不能为空'),
  startTime: z.string().min(1, '开始时间不能为空'),
  endTime: z.string().min(1, '结束时间不能为空'),
  isAvailable: z.boolean().default(true)
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
  const date = searchParams.get('date')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  try {
    const whereClause: any = {}

    if (currentUser.role === UserRole.STAFF) {
      whereClause.staffId = currentUser.userId
    } else if (staffId) {
      whereClause.staffId = parseInt(staffId, 10)
    }

    if (date) {
      const d = new Date(date)
      const nextDay = new Date(d)
      nextDay.setDate(nextDay.getDate() + 1)
      whereClause.date = {
        gte: d,
        lt: nextDay
      }
    } else if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
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
        }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('获取排班列表错误:', error)
    return NextResponse.json(
      { error: '获取排班列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const validated = createScheduleSchema.parse(body)

    const staff = await prisma.user.findUnique({
      where: { id: validated.staffId }
    })

    if (!staff || staff.role !== UserRole.STAFF) {
      return NextResponse.json(
        { error: '服务人员不存在' },
        { status: 404 }
      )
    }

    const schedule = await prisma.schedule.create({
      data: {
        staffId: validated.staffId,
        date: new Date(validated.date),
        startTime: new Date(validated.startTime),
        endTime: new Date(validated.endTime),
        isAvailable: validated.isAvailable
      }
    })

    return NextResponse.json(schedule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('创建排班错误:', error)
    return NextResponse.json(
      { error: '创建排班失败' },
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
      { error: '排班ID不能为空' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const { date, startTime, endTime, isAvailable } = body

    const schedule = await prisma.schedule.update({
      where: { id: parseInt(id, 10) },
      data: {
        date: date ? new Date(date) : undefined,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        isAvailable
      }
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('更新排班错误:', error)
    return NextResponse.json(
      { error: '更新排班失败' },
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
      { error: '排班ID不能为空' },
      { status: 400 }
    )
  }

  try {
    await prisma.schedule.delete({
      where: { id: parseInt(id, 10) }
    })

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除排班错误:', error)
    return NextResponse.json(
      { error: '删除排班失败' },
      { status: 500 }
    )
  }
}
