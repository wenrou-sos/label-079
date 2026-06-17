import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import {
  generateOrderNo,
  calculateSubsidy
} from '@/lib/utils'
import {
  UserRole,
  PackageStatus,
  OrderStatus
} from '@/generated/prisma'

export async function POST(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  try {
    let packageServiceIds: number[] | undefined
    try {
      const body = await request.json()
      packageServiceIds = (body as { packageServiceIds?: number[] }).packageServiceIds
    } catch {
      packageServiceIds = undefined
    }

    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    const sevenDaysLater = new Date(today)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    sevenDaysLater.setHours(23, 59, 59, 999)

    const whereClause: any = {
      status: PackageStatus.ACTIVE,
      scheduledTime: {
        gte: startOfDay,
        lte: sevenDaysLater
      },
      orderId: null
    }

    if (packageServiceIds && packageServiceIds.length > 0) {
      whereClause.id = { in: packageServiceIds }
    }

    const pendingServices = await prisma.packageService.findMany({
      where: whereClause,
      include: {
        packageOrder: {
          include: {
            elderly: true,
            template: {
              include: {
                service: {
                  include: {
                    mealConfig: true,
                    bathConfig: true,
                    cleaningConfig: true,
                    medicalConfig: true,
                    companionConfig: true
                  }
                }
              }
            }
          }
        }
      }
    })

    let createdCount = 0
    const results: any[] = []

    for (const pkgService of pendingServices) {
      const { packageOrder } = pkgService

      if (packageOrder.status !== PackageStatus.ACTIVE) continue

      const elderly = packageOrder.elderly
      const service = packageOrder.template.service

      const subsidyConfig = await prisma.subsidyConfig.findUnique({
        where: { level: elderly.subsidyLevel }
      })

      let totalAmount = service.basePrice.toNumber()
      if (service.mealConfig?.deliveryFee) {
        totalAmount += service.mealConfig.deliveryFee.toNumber()
      }

      const subsidyPercentage = subsidyConfig?.percentage.toNumber() || 0
      const maxSubsidy = subsidyConfig?.maxAmount.toNumber() || 0
      const subsidyAmount = calculateSubsidy(totalAmount, subsidyPercentage, maxSubsidy)
      const personalAmount = totalAmount - subsidyAmount

      const orderNo = generateOrderNo()

      try {
        const order = await prisma.order.create({
          data: {
            orderNo,
            elderlyId: elderly.id,
            serviceId: service.id,
            packageServiceId: pkgService.id,
            status: OrderStatus.PENDING,
            scheduledTime: pkgService.scheduledTime,
            totalAmount,
            subsidyAmount,
            personalAmount,
            address: packageOrder.address,
            latitude: packageOrder.latitude,
            longitude: packageOrder.longitude,
            remark: `套餐订单 #${packageOrder.packageNo}`
          }
        })

        await prisma.orderStatusLog.create({
          data: {
            orderId: order.id,
            status: OrderStatus.PENDING,
            operatorId: elderly.id,
            remark: '套餐自动生成订单'
          }
        })

        createdCount++
        results.push({
          packageServiceId: pkgService.id,
          orderId: order.id,
          orderNo,
          scheduledTime: pkgService.scheduledTime,
          success: true
        })
      } catch (error) {
        console.error(`生成套餐服务订单失败 packageServiceId=${pkgService.id}:`, error)
        results.push({
          packageServiceId: pkgService.id,
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        })
      }
    }

    return NextResponse.json({
      message: `成功生成 ${createdCount} 条订单`,
      totalProcessed: pendingServices.length,
      createdCount,
      results
    })
  } catch (error) {
    console.error('生成套餐订单错误:', error)
    return NextResponse.json(
      { error: '生成套餐订单失败' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const authError = await authMiddleware([UserRole.ADMIN])(request)
  if (authError) return authError

  try {
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)

    const sevenDaysLater = new Date(today)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    sevenDaysLater.setHours(23, 59, 59, 999)

    const pendingServices = await prisma.packageService.findMany({
      where: {
        status: PackageStatus.ACTIVE,
        scheduledTime: {
          gte: startOfDay,
          lte: sevenDaysLater
        },
        orderId: null
      },
      include: {
        packageOrder: {
          include: {
            elderly: { select: { id: true, name: true, phone: true } },
            template: {
              include: {
                service: { select: { id: true, name: true, category: true } }
              }
            }
          }
        }
      },
      orderBy: { scheduledTime: 'asc' }
    })

    return NextResponse.json({
      total: pendingServices.length,
      data: pendingServices
    })
  } catch (error) {
    console.error('获取待生成订单错误:', error)
    return NextResponse.json(
      { error: '获取待生成订单失败' },
      { status: 500 }
    )
  }
}
