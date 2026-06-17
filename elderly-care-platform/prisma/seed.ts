import { PrismaClient, ServiceCategory, MealType, BathType, CleaningType, MedicalType, CompanionType, UserRole } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { hashPassword } from '@/lib/auth'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('开始初始化数据...')

  const existingAdmin = await prisma.user.findUnique({
    where: { phone: '13800000000' }
  })

  if (!existingAdmin) {
    const hashedPassword = await hashPassword('123456')
    await prisma.user.create({
      data: {
        phone: '13800000000',
        name: '系统管理员',
        password: hashedPassword,
        role: UserRole.ADMIN
      }
    })
    console.log('创建管理员账号: 13800000000 / 123456')
  }

  const existingStaff = await prisma.user.findUnique({
    where: { phone: '13800000001' }
  })

  if (!existingStaff) {
    const hashedPassword = await hashPassword('123456')
    await prisma.user.create({
      data: {
        phone: '13800000001',
        name: '李服务',
        password: hashedPassword,
        role: UserRole.STAFF,
        address: '北京市朝阳区'
      }
    })
    console.log('创建服务人员账号: 13800000001 / 123456')
  }

  const existingElderly = await prisma.user.findUnique({
    where: { phone: '13800000002' }
  })

  if (!existingElderly) {
    const hashedPassword = await hashPassword('123456')
    await prisma.user.create({
      data: {
        phone: '13800000002',
        name: '王大爷',
        password: hashedPassword,
        role: UserRole.ELDERLY,
        birthday: new Date('1950-01-15'),
        address: '北京市朝阳区幸福小区1号楼101室',
        healthInfo: '高血压，需按时服药',
        emergencyContact: '小王',
        emergencyPhone: '13900000001',
        subsidyLevel: 2
      }
    })
    console.log('创建老人账号: 13800000002 / 123456')
  }

  const subsidyConfigs = [
    { level: 0, name: '无补贴', percentage: 0, maxAmount: 0 },
    { level: 1, name: '普通补贴', percentage: 30, maxAmount: 100 },
    { level: 2, name: '重点补贴', percentage: 50, maxAmount: 200 },
    { level: 3, name: '特困补贴', percentage: 80, maxAmount: 500 }
  ]

  for (const config of subsidyConfigs) {
    const existing = await prisma.subsidyConfig.findUnique({
      where: { level: config.level }
    })
    if (!existing) {
      await prisma.subsidyConfig.create({ data: config })
      console.log(`创建补贴等级: ${config.name}`)
    }
  }

  const existingServices = await prisma.service.findMany()
  if (existingServices.length === 0) {
    const services = [
      {
        category: ServiceCategory.MEAL,
        name: '送餐上门',
        description: '营养配餐，专人送餐上门',
        basePrice: 25,
        duration: 30,
        unit: '次',
        mealConfig: {
          mealType: MealType.DELIVERY,
          menu: '两荤一素一汤',
          deliveryFee: 5
        }
      },
      {
        category: ServiceCategory.MEAL,
        name: '社区食堂用餐',
        description: '到社区食堂用餐，营养健康',
        basePrice: 15,
        duration: 60,
        unit: '次',
        mealConfig: {
          mealType: MealType.CANTEEN,
          menu: '两荤一素一汤'
        }
      },
      {
        category: ServiceCategory.BATH,
        name: '上门助浴',
        description: '专业护理人员上门助浴服务',
        basePrice: 120,
        duration: 90,
        unit: '次',
        bathConfig: {
          bathType: BathType.HOME_BATH,
          equipment: '专业洗浴床、防滑垫、测温仪'
        }
      },
      {
        category: ServiceCategory.CLEANING,
        name: '家庭保洁',
        description: '家居清洁，打扫卫生',
        basePrice: 50,
        duration: 120,
        unit: '次',
        cleaningConfig: {
          cleaningType: CleaningType.HOUSEKEEPING,
          scope: '卧室、客厅、厨房、卫生间'
        }
      },
      {
        category: ServiceCategory.CLEANING,
        name: '洗衣服务',
        description: '衣物清洗、晾晒、整理',
        basePrice: 30,
        duration: 60,
        unit: '次',
        cleaningConfig: {
          cleaningType: CleaningType.LAUNDRY,
          scope: '普通衣物清洗、熨烫'
        }
      },
      {
        category: ServiceCategory.MEDICAL,
        name: '陪诊服务',
        description: '陪同就医，代办手续',
        basePrice: 150,
        duration: 240,
        unit: '次',
        medicalConfig: {
          medicalType: MedicalType.ACCOMPANY
        }
      },
      {
        category: ServiceCategory.MEDICAL,
        name: '代取药品',
        description: '代为取药、送药上门',
        basePrice: 30,
        duration: 60,
        unit: '次',
        medicalConfig: {
          medicalType: MedicalType.PICKUP_MEDICINE
        }
      },
      {
        category: ServiceCategory.COMPANION,
        name: '聊天陪伴',
        description: '上门聊天、解闷陪伴',
        basePrice: 40,
        duration: 60,
        unit: '小时',
        companionConfig: {
          companionType: CompanionType.CHAT
        }
      },
      {
        category: ServiceCategory.COMPANION,
        name: '散步陪同',
        description: '陪同散步、户外活动',
        basePrice: 50,
        duration: 60,
        unit: '小时',
        companionConfig: {
          companionType: CompanionType.WALK,
          location: '社区公园、周边步道'
        }
      }
    ]

    for (const service of services) {
      const { mealConfig, bathConfig, cleaningConfig, medicalConfig, companionConfig, ...serviceData } = service
      
      const createdService = await prisma.service.create({
        data: serviceData
      })

      if (mealConfig) {
        await prisma.mealServiceConfig.create({
          data: {
            ...mealConfig,
            serviceId: createdService.id
          }
        })
      }
      if (bathConfig) {
        await prisma.bathServiceConfig.create({
          data: {
            ...bathConfig,
            serviceId: createdService.id
          }
        })
      }
      if (cleaningConfig) {
        await prisma.cleaningServiceConfig.create({
          data: {
            ...cleaningConfig,
            serviceId: createdService.id
          }
        })
      }
      if (medicalConfig) {
        await prisma.medicalServiceConfig.create({
          data: {
            ...medicalConfig,
            serviceId: createdService.id
          }
        })
      }
      if (companionConfig) {
        await prisma.companionServiceConfig.create({
          data: {
            ...companionConfig,
            serviceId: createdService.id
          }
        })
      }

      console.log(`创建服务: ${service.name}`)
    }
  }

  console.log('数据初始化完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
