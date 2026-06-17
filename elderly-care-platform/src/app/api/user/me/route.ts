import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'

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

  try {
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: {
        familyMembers: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    const { password, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('获取用户信息错误:', error)
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const authError = await authMiddleware()(request)
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
    const { name, avatar, address, birthday, healthInfo, emergencyContact, emergencyPhone } = body

    const user = await prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        name,
        avatar,
        address,
        birthday: birthday ? new Date(birthday) : undefined,
        healthInfo,
        emergencyContact,
        emergencyPhone
      }
    })

    const { password, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('更新用户信息错误:', error)
    return NextResponse.json(
      { error: '更新用户信息失败' },
      { status: 500 }
    )
  }
}
