import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware } from '@/lib/middleware'
import { ServiceCategory, UserRole } from '@/generated/prisma'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') as ServiceCategory | null
  const id = searchParams.get('id')

  try {
    if (id) {
      const service = await prisma.service.findUnique({
        where: { id: parseInt(id, 10), isActive: true },
        include: {
          mealConfig: true,
          bathConfig: true,
          cleaningConfig: true,
          medicalConfig: true,
          companionConfig: true
        }
      })

      if (!service) {
        return NextResponse.json(
          { error: '服务不存在' },
          { status: 404 }
        )
      }

      return NextResponse.json(service)
    }

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        ...(category && { category })
      },
      include: {
        mealConfig: true,
        bathConfig: true,
        cleaningConfig: true,
        medicalConfig: true,
        companionConfig: true
      },
      orderBy: {
        category: 'asc',
        id: 'asc'
      }
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('获取服务列表错误:', error)
    return NextResponse.json(
      { error: '获取服务列表失败' },
      { status: 500 }
    )
  }
}

const createServiceSchema = z.object({
  category: z.enum([ServiceCategory.MEAL, ServiceCategory.BATH, ServiceCategory.CLEANING, ServiceCategory.MEDICAL, ServiceCategory.COMPANION]),
  name: z.string().min(2, '服务名称至少2个字符'),
  description: z.string().min(1, '服务描述不能为空'),
  basePrice: z.number().min(0, '价格不能为负数'),
  duration: z.number().min(1, '时长至少1分钟'),
  unit: z.string().min(1, '单位不能为空'),
  config: z.record(z.string(), z.any()).optional()
})

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const validated = createServiceSchema.parse(body)

    const { config, ...serviceData } = validated

    const service = await prisma.service.create({
      data: serviceData
    })

    if (config) {
      const configWithServiceId = { ...config, serviceId: service.id }
      switch (serviceData.category) {
        case ServiceCategory.MEAL:
          await prisma.mealServiceConfig.create({
            data: configWithServiceId as any
          })
          break
        case ServiceCategory.BATH:
          await prisma.bathServiceConfig.create({
            data: configWithServiceId as any
          })
          break
        case ServiceCategory.CLEANING:
          await prisma.cleaningServiceConfig.create({
            data: configWithServiceId as any
          })
          break
        case ServiceCategory.MEDICAL:
          await prisma.medicalServiceConfig.create({
            data: configWithServiceId as any
          })
          break
        case ServiceCategory.COMPANION:
          await prisma.companionServiceConfig.create({
            data: configWithServiceId as any
          })
          break
      }
    }

    const serviceWithConfig = await prisma.service.findUnique({
      where: { id: service.id },
      include: {
        mealConfig: true,
        bathConfig: true,
        cleaningConfig: true,
        medicalConfig: true,
        companionConfig: true
      }
    })

    return NextResponse.json(serviceWithConfig)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('创建服务错误:', error)
    return NextResponse.json(
      { error: '创建服务失败' },
      { status: 500 }
    )
  }
}
