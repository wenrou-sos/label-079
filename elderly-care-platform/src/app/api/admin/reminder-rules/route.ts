import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { UserRole } from '@/generated/prisma'

export async function GET(request: NextRequest) {
  const authResult = await authMiddleware([UserRole.ADMIN])(request)
  if (authResult) return authResult

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (type) where.type = type
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

    const rules = await prisma.reminderRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { reminders: true } } }
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('获取提醒规则失败:', error)
    return NextResponse.json({ error: '获取提醒规则失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authMiddleware([UserRole.ADMIN])(request)
  if (authResult) return authResult

  try {
    const body = await request.json()
    const { name, type, description, condition, template, priority } = body

    if (!name || !type || !condition || !template) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const rule = await prisma.reminderRule.create({
      data: {
        name,
        type,
        description: description || null,
        condition,
        template,
        priority: priority || 0
      }
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('创建提醒规则失败:', error)
    return NextResponse.json({ error: '创建提醒规则失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await authMiddleware([UserRole.ADMIN])(request)
  if (authResult) return authResult

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少规则ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, type, description, condition, template, isActive, priority } = body

    const rule = await prisma.reminderRule.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(condition !== undefined && { condition }),
        ...(template !== undefined && { template }),
        ...(isActive !== undefined && { isActive }),
        ...(priority !== undefined && { priority })
      }
    })

    return NextResponse.json(rule)
  } catch (error) {
    console.error('更新提醒规则失败:', error)
    return NextResponse.json({ error: '更新提醒规则失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await authMiddleware([UserRole.ADMIN])(request)
  if (authResult) return authResult

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少规则ID' }, { status: 400 })
    }

    await prisma.reminderRule.delete({ where: { id: parseInt(id, 10) } })

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除提醒规则失败:', error)
    return NextResponse.json({ error: '删除提醒规则失败' }, { status: 500 })
  }
}
