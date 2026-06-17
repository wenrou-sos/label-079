import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const authResult = await authMiddleware()(request)
  if (authResult) return authResult

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 })
  }

  try {
    const profile = await prisma.healthProfile.findUnique({
      where: { userId: currentUser.userId }
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('获取健康档案失败:', error)
    return NextResponse.json({ error: '获取健康档案失败' }, { status: 500 })
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
    const body = await request.json()
    const { chronicDiseases, allergies, medications, bloodType, height, weight, lastCheckupDate } = body

    const profile = await prisma.healthProfile.upsert({
      where: { userId: currentUser.userId },
      update: {
        ...(chronicDiseases !== undefined && { chronicDiseases }),
        ...(allergies !== undefined && { allergies }),
        ...(medications !== undefined && { medications }),
        ...(bloodType !== undefined && { bloodType }),
        ...(height !== undefined && { height }),
        ...(weight !== undefined && { weight }),
        ...(lastCheckupDate !== undefined && { lastCheckupDate: lastCheckupDate ? new Date(lastCheckupDate) : null })
      },
      create: {
        userId: currentUser.userId,
        chronicDiseases: chronicDiseases || null,
        allergies: allergies || null,
        medications: medications || null,
        bloodType: bloodType || null,
        height: height || null,
        weight: weight || null,
        lastCheckupDate: lastCheckupDate ? new Date(lastCheckupDate) : null
      }
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('更新健康档案失败:', error)
    return NextResponse.json({ error: '更新健康档案失败' }, { status: 500 })
  }
}
