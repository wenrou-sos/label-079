import "dotenv/config"
import { PrismaClient, ServiceCategory, PackageCycleType } from "../src/generated/prisma"
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL 未设置')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('开始初始化套餐模板数据...')

  const existingCount = await prisma.packageTemplate.count()

  if (existingCount > 0) {
    console.log(`已有 ${existingCount} 条套餐模板，跳过初始化`)
    return
  }

  const services = await prisma.service.findMany()
  const serviceMap = new Map(services.map(s => [s.category + '-' + s.name, s.id]))

  const getServiceId = (category: ServiceCategory, name: string): number => {
    const id = serviceMap.get(category + '-' + name)
    if (!id) throw new Error(`服务未找到: ${category} - ${name}`)
    return id
  }

  await prisma.packageTemplate.createMany({
    data: [
      {
        name: '每周一三五保洁套餐',
        description: '每周一、三、五上门保洁2小时，连续4周共12次',
        serviceId: getServiceId(ServiceCategory.CLEANING, '居家保洁'),
        cycleType: PackageCycleType.WEEKLY,
        totalServices: 12,
        timeOfDay: '09:00',
        weekdaySchedule: '1,3,5',
        basePrice: 288,
        discountRate: 80
      },
      {
        name: '每周二四营养餐配送',
        description: '每周二、周四午餐送餐上门，一个月共8次',
        serviceId: getServiceId(ServiceCategory.MEAL, '送餐上门'),
        cycleType: PackageCycleType.WEEKLY,
        totalServices: 8,
        timeOfDay: '11:30',
        weekdaySchedule: '2,4',
        basePrice: 180,
        discountRate: 90
      },
      {
        name: '每日营养餐月卡',
        description: '每日送餐上门（30天），营养均衡省心省力',
        serviceId: getServiceId(ServiceCategory.MEAL, '送餐上门'),
        cycleType: PackageCycleType.DAILY,
        totalServices: 30,
        timeOfDay: '11:30',
        basePrice: 600,
        discountRate: 85
      },
      {
        name: '每月助浴关爱套餐',
        description: '每月2次上门助浴服务，专业护理安全保障',
        serviceId: getServiceId(ServiceCategory.BATH, '上门助浴'),
        cycleType: PackageCycleType.MONTHLY,
        totalServices: 2,
        timeOfDay: '14:00',
        weekdaySchedule: '3',
        basePrice: 144,
        discountRate: 90
      },
      {
        name: '每周陪聊散步套餐',
        description: '每周六、周日上门陪聊或陪同散步，共8次',
        serviceId: getServiceId(ServiceCategory.COMPANION, '陪伴聊天'),
        cycleType: PackageCycleType.WEEKLY,
        totalServices: 8,
        timeOfDay: '15:00',
        weekdaySchedule: '6,0',
        basePrice: 170,
        discountRate: 85
      },
      {
        name: '每月陪诊套餐',
        description: '每月1次陪诊服务 + 1次代取药，健康无忧',
        serviceId: getServiceId(ServiceCategory.MEDICAL, '陪诊服务'),
        cycleType: PackageCycleType.MONTHLY,
        totalServices: 2,
        timeOfDay: '08:30',
        basePrice: 72,
        discountRate: 90
      }
    ]
  })

  const templates = await prisma.packageTemplate.findMany()
  console.log(`成功初始化 ${templates.length} 条套餐模板`)
  templates.forEach(t => {
    console.log(`  [${t.id}] ${t.name} - ${t.cycleType} - ¥${t.basePrice} (${t.discountRate}折)`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
