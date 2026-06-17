import "dotenv/config"
import { PrismaClient, ServiceCategory } from "../src/generated/prisma"
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('检查并补充缺失的服务数据...')

  const services = await prisma.service.findMany({ select: { id: true, name: true, category: true } })
  console.log(`当前有 ${services.length} 个服务`)
  services.forEach(s => console.log(`  ${s.id}. ${s.name} (${s.category})`))

  const names = services.map(s => s.name)

  if (!names.includes('上门助浴')) {
    console.log('\n添加: 上门助浴')
    await prisma.service.create({
      data: {
        name: '上门助浴',
        category: ServiceCategory.BATH,
        description: '专业护理人员上门协助洗浴，保障安全',
        basePrice: 80,
        duration: 60,
        unit: '次',
        bathConfig: { create: { bathType: 'HOME_BATH' } }
      }
    })
  }

  if (!names.includes('居家保洁')) {
    console.log('添加: 居家保洁')
    await prisma.service.create({
      data: {
        name: '居家保洁',
        category: ServiceCategory.CLEANING,
        description: '专业保洁人员上门打扫卫生',
        basePrice: 30,
        duration: 60,
        unit: '小时',
        cleaningConfig: { create: { cleaningType: 'HOUSEKEEPING' } }
      }
    })
  }

  if (!names.includes('洗衣服务')) {
    console.log('添加: 洗衣服务')
    await prisma.service.create({
      data: {
        name: '洗衣服务',
        category: ServiceCategory.CLEANING,
        description: '上门取送，清洗熨烫后送回',
        basePrice: 25,
        duration: 120,
        unit: '次',
        cleaningConfig: { create: { cleaningType: 'LAUNDRY' } }
      }
    })
  }

  if (!names.includes('陪诊服务')) {
    console.log('添加: 陪诊服务')
    await prisma.service.create({
      data: {
        name: '陪诊服务',
        category: ServiceCategory.MEDICAL,
        description: '陪同就医，协助挂号取药',
        basePrice: 50,
        duration: 180,
        unit: '次',
        medicalConfig: { create: { medicalType: 'ACCOMPANY' } }
      }
    })
  }

  if (!names.includes('代取药')) {
    console.log('添加: 代取药')
    await prisma.service.create({
      data: {
        name: '代取药',
        category: ServiceCategory.MEDICAL,
        description: '代为到医院或药店取药送上门',
        basePrice: 30,
        duration: 60,
        unit: '次',
        medicalConfig: { create: { medicalType: 'PICKUP_MEDICINE' } }
      }
    })
  }

  if (!names.includes('陪伴聊天')) {
    console.log('添加: 陪伴聊天')
    await prisma.service.create({
      data: {
        name: '陪伴聊天',
        category: ServiceCategory.COMPANION,
        description: '上门陪伴聊天解闷，读书读报',
        basePrice: 25,
        duration: 60,
        unit: '小时',
        companionConfig: { create: { companionType: 'CHAT' } }
      }
    })
  }

  if (!names.includes('陪同散步')) {
    console.log('添加: 陪同散步')
    await prisma.service.create({
      data: {
        name: '陪同散步',
        category: ServiceCategory.COMPANION,
        description: '陪同户外散步活动',
        basePrice: 25,
        duration: 60,
        unit: '小时',
        companionConfig: { create: { companionType: 'WALK' } }
      }
    })
  }

  const finalServices = await prisma.service.findMany({ orderBy: [{ id: 'asc' }] })
  console.log(`\n最终有 ${finalServices.length} 个服务`)
  finalServices.forEach(s => console.log(`  ${s.id}. ${s.name} (${s.category}) ¥${s.basePrice}/${s.unit}`))

  console.log('\n完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
