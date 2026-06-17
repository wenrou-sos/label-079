import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { ReminderType } from '@/generated/prisma'

export async function GET(request: NextRequest) {
  const authResult = await authMiddleware()(request)
  if (authResult) return authResult

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isRead = searchParams.get('isRead')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const where: any = { userId: currentUser.userId }

    if (type) where.type = type
    if (isRead !== null && isRead !== undefined) where.isRead = isRead === 'true'
    if (activeOnly) where.isActive = true

    const reminders = await prisma.reminder.findMany({
      where,
      orderBy: [{ triggeredAt: 'desc' }],
      include: { rule: { select: { id: true, name: true, type: true } } }
    })

    const unreadCount = await prisma.reminder.count({
      where: { userId: currentUser.userId, isRead: false, isActive: true }
    })

    return NextResponse.json({ reminders, unreadCount })
  } catch (error) {
    console.error('获取提醒列表失败:', error)
    return NextResponse.json({ error: '获取提醒列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authMiddleware()(request)
  if (authResult) return authResult

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, title, content, ruleId } = body

    if (!type || !title || !content) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId: currentUser.userId,
        ruleId: ruleId || null,
        type: type as ReminderType,
        title,
        content
      }
    })

    return NextResponse.json(reminder, { status: 201 })
  } catch (error) {
    console.error('创建提醒失败:', error)
    return NextResponse.json({ error: '创建提醒失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await authMiddleware()(request)
  if (authResult) return authResult

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const body = await request.json()

    if (action === 'read') {
      const { id } = body
      if (!id) {
        return NextResponse.json({ error: '缺少提醒ID' }, { status: 400 })
      }

      const reminder = await prisma.reminder.update({
        where: { id, userId: currentUser.userId },
        data: { isRead: true, readAt: new Date() }
      })

      return NextResponse.json(reminder)
    }

    if (action === 'readAll') {
      await prisma.reminder.updateMany({
        where: { userId: currentUser.userId, isRead: false },
        data: { isRead: true, readAt: new Date() }
      })

      return NextResponse.json({ message: '全部标记已读' })
    }

    if (action === 'dismiss') {
      const { id } = body
      if (!id) {
        return NextResponse.json({ error: '缺少提醒ID' }, { status: 400 })
      }

      const reminder = await prisma.reminder.update({
        where: { id, userId: currentUser.userId },
        data: { isActive: false }
      })

      return NextResponse.json(reminder)
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('更新提醒失败:', error)
    return NextResponse.json({ error: '更新提醒失败' }, { status: 500 })
  }
}
