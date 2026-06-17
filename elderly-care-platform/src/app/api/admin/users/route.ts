import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { hashPassword } from '@/lib/auth'
import { UserRole } from '@/generated/prisma'
import { z } from 'zod'

const createUserSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  name: z.string().min(2, '姓名至少2个字符'),
  password: z.string().min(6, '密码长度至少6位'),
  role: z.enum([UserRole.ELDERLY, UserRole.STAFF, UserRole.ADMIN]),
  idCard: z.string().optional(),
  birthday: z.string().optional(),
  address: z.string().optional(),
  healthInfo: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  subsidyLevel: z.number().int().min(0).max(3).default(0)
})

export async function GET(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role') as UserRole | null
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const keyword = searchParams.get('keyword')

  try {
    const whereClause: any = {}

    if (role) {
      whereClause.role = role
    }

    if (keyword) {
      whereClause.OR = [
        { name: { contains: keyword } },
        { phone: { contains: keyword } }
      ]
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        familyMembers: true,
        _count: {
          select: {
            ordersAsElderly: true,
            ordersAsStaff: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    })

    const usersWithoutPassword = users.map(({ password, ...user }) => user)

    const total = await prisma.user.count({ where: whereClause })

    return NextResponse.json({
      data: usersWithoutPassword,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    })
  } catch (error) {
    console.error('获取用户列表错误:', error)
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const validated = createUserSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { phone: validated.phone }
    })
    if (existingUser) {
      return NextResponse.json(
        { error: '该手机号已注册' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(validated.password)

    const user = await prisma.user.create({
      data: {
        phone: validated.phone,
        name: validated.name,
        password: hashedPassword,
        role: validated.role,
        idCard: validated.idCard,
        birthday: validated.birthday ? new Date(validated.birthday) : undefined,
        address: validated.address,
        healthInfo: validated.healthInfo,
        emergencyContact: validated.emergencyContact,
        emergencyPhone: validated.emergencyPhone,
        subsidyLevel: validated.role === UserRole.ELDERLY ? validated.subsidyLevel : 0
      }
    })

    const { password, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('创建用户错误:', error)
    return NextResponse.json(
      { error: '创建用户失败' },
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
      { error: '用户ID不能为空' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const { password, ...updateData } = body

    const data: any = { ...updateData }

    if (password) {
      data.password = await hashPassword(password)
    }

    if (updateData.birthday) {
      data.birthday = new Date(updateData.birthday)
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data
    })

    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('更新用户错误:', error)
    return NextResponse.json(
      { error: '更新用户失败' },
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
      { error: '用户ID不能为空' },
      { status: 400 }
    )
  }

  const currentUser = getCurrentUser(request)
  if (currentUser && currentUser.userId === parseInt(id, 10)) {
    return NextResponse.json(
      { error: '不能删除自己' },
      { status: 400 }
    )
  }

  try {
    await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: { isActive: false }
    })

    return NextResponse.json({ message: '用户已禁用' })
  } catch (error) {
    console.error('禁用用户错误:', error)
    return NextResponse.json(
      { error: '禁用用户失败' },
      { status: 500 }
    )
  }
}
