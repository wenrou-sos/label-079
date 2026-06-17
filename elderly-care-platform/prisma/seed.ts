import "dotenv/config"
import { PrismaClient, ServiceCategory, UserRole } from "../src/generated/prisma"
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL 未设置')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

async function main() {
  console.log('开始初始化数据...')

  const existingAdmin = await prisma.user.findUnique({
    where: { phone: '13800000000' }
  })

  if (!existingAdmin) {
    console.log('创建管理员账号...')
    await prisma.user.create({
      data: {
        phone: '13800000000',
        name: '系统管理员',
        password: await hashPassword('123456'),
        role: UserRole.ADMIN
      }
    })
  }

  const existingStaff = await prisma.user.findUnique({
    where: { phone: '13800000001' }
  })

  if (!existingStaff) {
    console.log('创建服务人员账号...')
    await prisma.user.create({
      data: {
        phone: '13800000001',
        name: '李护工',
        password: await hashPassword('123456'),
        role: UserRole.STAFF
      }
    })
  }

  const existingElderly = await prisma.user.findUnique({
    where: { phone: '13800000002' }
  })

  if (!existingElderly) {
    console.log('创建老人账号...')
    await prisma.user.create({
      data: {
        phone: '13800000002',
        name: '张大爷',
        password: await hashPassword('123456'),
        role: UserRole.ELDERLY,
        subsidyLevel: 2,
        address: '阳光社区1号楼1单元101室',
        birthday: new Date('1945-03-15'),
        emergencyContact: '张小明',
        emergencyPhone: '13900000001'
      }
    })
  }

  const serviceCount = await prisma.service.count()

  if (serviceCount === 0) {
    console.log('创建服务数据...')

    const mealDelivery = await prisma.service.create({
      data: {
        name: '送餐上门',
        category: ServiceCategory.MEAL,
        description: '营养均衡的营养餐，配送到家',
        basePrice: 20,
        duration: 30,
        unit: '份',
        mealConfig: {
          create: {
            mealType: 'DELIVERY',
            deliveryFee: 5
          }
        }
      },
      include: { mealConfig: true }
    })

    const mealCanteen = await prisma.service.create({
      data: {
        name: '社区食堂用餐',
        category: ServiceCategory.MEAL,
        description: '到社区食堂享用营养套餐',
        basePrice: 15,
        duration: 60,
        unit: '次',
        mealConfig: {
          create: {
            mealType: 'CANTEEN'
          }
        }
      },
      include: { mealConfig: true }
    })

    const bathHome = await prisma.service.create({
      data: {
        name: '上门助浴',
        category: ServiceCategory.BATH,
        description: '专业护理人员上门协助洗浴，保障安全',
        basePrice: 80,
        duration: 60,
        unit: '次',
        bathConfig: {
          create: {
            bathType: 'HOME_BATH'
          }
        }
      },
      include: { bathConfig: true }
    })

    const cleaningHousekeeping = await prisma.service.create({
      data: {
        name: '居家保洁',
        category: ServiceCategory.CLEANING,
        description: '专业保洁人员上门打扫卫生',
        basePrice: 30,
        duration: 60,
        unit: '小时',
        cleaningConfig: {
          create: {
            cleaningType: 'HOUSEKEEPING'
          }
        }
      },
      include: { cleaningConfig: true }
    })

    const cleaningLaundry = await prisma.service.create({
      data: {
        name: '洗衣服务',
        category: ServiceCategory.CLEANING,
        description: '上门取送，清洗熨烫后送回',
        basePrice: 25,
        duration: 120,
        unit: '次',
        cleaningConfig: {
          create: {
            cleaningType: 'LAUNDRY'
          }
        }
      },
      include: { cleaningConfig: true }
    })

    const medicalAccompany = await prisma.service.create({
      data: {
        name: '陪诊服务',
        category: ServiceCategory.MEDICAL,
        description: '陪同就医，协助挂号取药',
        basePrice: 50,
        duration: 180,
        unit: '次',
        medicalConfig: {
          create: {
            medicalType: 'ACCOMPANY'
          }
        }
      },
      include: { medicalConfig: true }
    })

    const medicalMedicine = await prisma.service.create({
      data: {
        name: '代取药',
        category: ServiceCategory.MEDICAL,
        description: '代为到医院或药店取药送上门',
        basePrice: 30,
        duration: 60,
        unit: '次',
        medicalConfig: {
          create: {
            medicalType: 'PICKUP_MEDICINE'
          }
        }
      },
      include: { medicalConfig: true }
    })

    const companionChat = await prisma.service.create({
      data: {
        name: '陪伴聊天',
        category: ServiceCategory.COMPANION,
        description: '上门陪伴聊天解闷，读书读报',
        basePrice: 25,
        duration: 60,
        unit: '小时',
        companionConfig: {
          create: {
            companionType: 'CHAT'
          }
        }
      },
      include: { companionConfig: true }
    })

    const companionWalk = await prisma.service.create({
      data: {
        name: '陪同散步',
        category: ServiceCategory.COMPANION,
        description: '陪同户外散步活动',
        basePrice: 25,
        duration: 60,
        unit: '小时',
        companionConfig: {
          create: {
            companionType: 'WALK'
          }
        }
      },
      include: { companionConfig: true }
    })

    console.log('创建了9项服务')
  }

  const subsidyCount = await prisma.subsidyConfig.count()

  if (subsidyCount === 0) {
    console.log('创建补贴等级配置...')

    await prisma.subsidyConfig.createMany({
      data: [
        { level: 0, name: '无补贴', percentage: 0, maxAmount: 0 },
        { level: 1, name: '低保补贴', percentage: 30, maxAmount: 100 },
        { level: 2, name: '特困补贴', percentage: 50, maxAmount: 200 },
        { level: 3, name: '特困失能补贴', percentage: 80, maxAmount: 500 }
      ]
    })
  }

  console.log('数据初始化完成！')
  console.log('')
  console.log('测试账号：')
  console.log('管理员：13800000000 / 123456')
  console.log('服务人员：13800000001 / 123456')
  console.log('老人：13800000002 / 123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
