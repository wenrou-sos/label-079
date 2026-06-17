import "dotenv/config"
import { PrismaClient, ReminderType } from "../src/generated/prisma"
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('检查并初始化健康档案和提醒规则数据...')

  const elderlyUserId = 3

  const existingProfile = await prisma.healthProfile.findUnique({
    where: { userId: elderlyUserId }
  })

  if (!existingProfile) {
    console.log('为张大爷创建健康档案...')
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 4)

    await prisma.healthProfile.create({
      data: {
        userId: elderlyUserId,
        chronicDiseases: '高血压,糖尿病',
        allergies: '青霉素过敏',
        medications: '氨氯地平,二甲双胍,阿司匹林肠溶片',
        bloodType: 'A型',
        height: 170,
        weight: 68,
        lastCheckupDate: threeMonthsAgo
      }
    })
    console.log('健康档案创建成功！')
  } else {
    console.log('健康档案已存在')
  }

  const existingRules = await prisma.reminderRule.count()

  if (existingRules === 0) {
    console.log('创建默认提醒规则模板...')

    const rules = [
      {
        name: '日常用药提醒',
        type: ReminderType.MEDICATION,
        description: '根据老人用药信息，早中晚提醒服药',
        condition: 'check=medication',
        template: '您好，该吃药了！当前用药：{{medications}}。请按时服药，注意用药安全。',
        priority: 10
      },
      {
        name: '复诊提醒（超过90天）',
        type: ReminderType.FOLLOW_UP,
        description: '距离上次复诊超过90天时提醒老人复查',
        condition: 'check=lastCheckup;days=90',
        template: '距离上次复诊已超过{{days}}天（上次复诊：{{lastDate}}），建议您尽快预约复诊检查。可以预约陪诊服务，让专业人员陪同就医。',
        priority: 8
      },
      {
        name: '冬季保暖提醒',
        type: ReminderType.WEATHER,
        description: '每年11月至次年2月提醒老人注意保暖',
        condition: 'check=season;months=11,12,1,2;seasonName=冬季',
        template: '{{season}}来临，天气寒冷，请注意保暖添衣！外出时记得穿厚衣服，戴好帽子和手套。建议减少外出，可以选择送餐上门服务。',
        priority: 5
      },
      {
        name: '春季过敏提醒',
        type: ReminderType.WEATHER,
        description: '3-4月提醒过敏防护',
        condition: 'check=season;months=3,4;seasonName=春季',
        template: '{{season}}天气多变，早晚温差大，请注意适时增减衣物。花粉较多，有过敏史的老人请注意防护。',
        priority: 5
      },
      {
        name: '夏季防暑提醒',
        type: ReminderType.WEATHER,
        description: '7-8月提醒防暑降温',
        condition: 'check=season;months=7,8;seasonName=夏季',
        template: '{{season}}高温天气，请注意防暑！尽量避免中午外出，保持室内通风。如需外出，请做好防晒措施。',
        priority: 5
      },
      {
        name: '秋季润燥提醒',
        type: ReminderType.WEATHER,
        description: '9-10月提醒补水润燥',
        condition: 'check=season;months=9,10;seasonName=秋季',
        template: '{{season}}天气转凉，请注意添衣保暖。气候干燥，请注意多补充水分，适当增加润肺食物。',
        priority: 5
      },
      {
        name: '个性化服务推荐',
        type: ReminderType.SERVICE_RECOMMENDATION,
        description: '根据老人近期服务记录推荐合适服务',
        condition: 'check=orderHistory;months=3',
        template: '您近期有{{orderCount}}次服务记录，根据您的服务偏好为您推荐合适的服务套餐，祝您生活愉快！',
        priority: 3
      }
    ]

    for (const rule of rules) {
      await prisma.reminderRule.create({ data: rule })
    }

    console.log(`成功创建 ${rules.length} 条默认提醒规则模板！`)
  } else {
    console.log(`已存在 ${existingRules} 条提醒规则模板`)
  }

  console.log('\n数据初始化完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
