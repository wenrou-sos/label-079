import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authMiddleware, getCurrentUser } from '@/lib/middleware'
import { ReminderType, ServiceCategory } from '@/generated/prisma'

function parseCondition(condition: string): Record<string, string> {
  const result: Record<string, string> = {}
  condition.split(';').forEach(part => {
    const [key, ...valueParts] = part.split('=')
    if (key && valueParts.length > 0) {
      result[key.trim()] = valueParts.join('=').trim()
    }
  })
  return result
}

async function generateMedicationReminders(userId: number) {
  const profile = await prisma.healthProfile.findUnique({ where: { userId } })
  if (!profile || !profile.medications) return []

  const medications = profile.medications.split(',').map(m => m.trim()).filter(Boolean)
  if (medications.length === 0) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.reminder.findMany({
    where: {
      userId,
      type: ReminderType.MEDICATION,
      triggeredAt: { gte: today }
    }
  })

  const reminders: any[] = []
  const now = new Date()
  const hour = now.getHours()

  const timeSlots = [
    { label: '早上', hours: [6, 7, 8] },
    { label: '中午', hours: [11, 12, 13] },
    { label: '晚上', hours: [18, 19, 20] }
  ]

  for (const slot of timeSlots) {
    if (!slot.hours.includes(hour)) continue

    const slotKey = `${slot.label}_medication`
    const alreadyExists = existing.some(r => r.content.includes(slot.label))

    if (!alreadyExists) {
      reminders.push({
        userId,
        type: ReminderType.MEDICATION,
        title: '用药提醒',
        content: `${slot.label}好，该吃药了！当前用药：${medications.join('、')}。请按时服药，注意用药安全。`
      })
    }
  }

  return reminders
}

async function generateFollowUpReminders(userId: number) {
  const profile = await prisma.healthProfile.findUnique({ where: { userId } })
  if (!profile || !profile.lastCheckupDate) return []

  const lastCheckup = new Date(profile.lastCheckupDate)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - lastCheckup.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 90) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.reminder.findFirst({
    where: {
      userId,
      type: ReminderType.FOLLOW_UP,
      triggeredAt: { gte: today }
    }
  })

  if (existing) return []

  const months = Math.floor(diffDays / 30)
  return [{
    userId,
    type: ReminderType.FOLLOW_UP,
    title: '复诊提醒',
    content: `距离上次复诊已超过${months}个月（上次复诊：${lastCheckup.toLocaleDateString('zh-CN')}），建议您尽快预约复诊检查。可以预约陪诊服务，让专业人员陪同就医。`
  }]
}

async function generateWeatherReminders(userId: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.reminder.findFirst({
    where: {
      userId,
      type: ReminderType.WEATHER,
      triggeredAt: { gte: today }
    }
  })

  if (existing) return []

  const month = new Date().getMonth() + 1
  let weatherContent = ''

  if (month >= 11 || month <= 2) {
    weatherContent = '天气寒冷，请注意保暖添衣！外出时记得穿厚衣服，戴好帽子和手套。建议减少外出，可以选择送餐上门服务。'
  } else if (month >= 3 && month <= 4) {
    weatherContent = '春季天气多变，早晚温差大，请注意适时增减衣物。花粉较多，有过敏史的老人请注意防护。'
  } else if (month >= 5 && month <= 6) {
    weatherContent = '天气逐渐炎热，请注意防暑降温！多喝水，避免长时间户外活动。建议选择清凉时段外出散步。'
  } else if (month >= 7 && month <= 8) {
    weatherContent = '高温天气，请注意防暑！尽量避免中午外出，保持室内通风。如需外出，请做好防晒措施。'
  } else {
    weatherContent = '秋季天气转凉，请注意添衣保暖。气候干燥，请注意多补充水分，适当增加润肺食物。'
  }

  if (!weatherContent) return []

  return [{
    userId,
    type: ReminderType.WEATHER,
    title: '天气关怀提醒',
    content: weatherContent
  }]
}

async function generateServiceRecommendations(userId: number) {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const recentOrders = await prisma.order.findMany({
    where: {
      elderlyId: userId,
      createdAt: { gte: threeMonthsAgo }
    },
    include: { service: true },
    orderBy: [{ createdAt: 'desc' }]
  })

  if (recentOrders.length === 0) return []

  const categoryCount: Record<string, number> = {}
  recentOrders.forEach(order => {
    const cat = order.service.category
    categoryCount[cat] = (categoryCount[cat] || 0) + 1
  })

  const topCategories = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([cat]) => cat)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.reminder.findFirst({
    where: {
      userId,
      type: ReminderType.SERVICE_RECOMMENDATION,
      triggeredAt: { gte: today }
    }
  })

  if (existing) return []

  const categoryNames: Record<string, string> = {
    MEAL: '助餐',
    BATH: '助浴',
    CLEANING: '助洁',
    MEDICAL: '助医',
    COMPANION: '陪护'
  }

  const recommendedCategories = topCategories.map(c => categoryNames[c] || c)

  const profile = await prisma.healthProfile.findUnique({ where: { userId } })
  let healthSuggestion = ''
  if (profile?.chronicDiseases) {
    const diseases = profile.chronicDiseases.split(',').map(d => d.trim()).filter(Boolean)
    if (diseases.length > 0) {
      healthSuggestion = `根据您的健康档案（${diseases.join('、')}），建议定期使用助医服务。`
    }
  }

  const content = `根据您近期的服务偏好，为您推荐${recommendedCategories.join('、')}类服务。${healthSuggestion}`.trim()

  return [{
    userId,
    type: ReminderType.SERVICE_RECOMMENDATION,
    title: '服务推荐',
    content
  }]
}

async function generateRuleBasedReminders(userId: number) {
  const rules = await prisma.reminderRule.findMany({ where: { isActive: true } })

  const reminders: any[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const rule of rules) {
    const existing = await prisma.reminder.findFirst({
      where: {
        userId,
        ruleId: rule.id,
        triggeredAt: { gte: today }
      }
    })

    if (existing) continue

    const condition = parseCondition(rule.condition)
    let shouldTrigger = false
    let renderedContent = rule.template

    if (rule.type === ReminderType.MEDICATION && condition.check === 'medication') {
      const profile = await prisma.healthProfile.findUnique({ where: { userId } })
      if (profile?.medications) {
        shouldTrigger = true
        renderedContent = renderedContent.replace('{{medications}}', profile.medications)
      }
    } else if (rule.type === ReminderType.FOLLOW_UP && condition.check === 'lastCheckup') {
      const profile = await prisma.healthProfile.findUnique({ where: { userId } })
      if (profile?.lastCheckupDate) {
        const daysSince = Math.floor((Date.now() - new Date(profile.lastCheckupDate).getTime()) / (1000 * 60 * 60 * 24))
        const threshold = parseInt(condition.days || '90', 10)
        if (daysSince >= threshold) {
          shouldTrigger = true
          renderedContent = renderedContent
            .replace('{{days}}', String(daysSince))
            .replace('{{lastDate}}', new Date(profile.lastCheckupDate).toLocaleDateString('zh-CN'))
        }
      }
    } else if (rule.type === ReminderType.WEATHER && condition.check === 'season') {
      const month = new Date().getMonth() + 1
      const seasons = condition.months?.split(',').map(Number) || []
      if (seasons.includes(month)) {
        shouldTrigger = true
        renderedContent = renderedContent.replace('{{season}}', condition.seasonName || '当前季节')
      }
    } else if (rule.type === ReminderType.SERVICE_RECOMMENDATION && condition.check === 'orderHistory') {
      const months = parseInt(condition.months || '3', 10)
      const since = new Date()
      since.setMonth(since.getMonth() - months)
      const orderCount = await prisma.order.count({
        where: { elderlyId: userId, createdAt: { gte: since } }
      })
      if (orderCount > 0) {
        shouldTrigger = true
        renderedContent = renderedContent.replace('{{orderCount}}', String(orderCount))
      }
    }

    if (shouldTrigger) {
      reminders.push({
        userId,
        ruleId: rule.id,
        type: rule.type,
        title: rule.name,
        content: renderedContent
      })
    }
  }

  return reminders
}

export async function POST(request: NextRequest) {
  const authResult = await authMiddleware()(request)
  if (authResult) return authResult

  const currentUser = getCurrentUser(request)
  if (!currentUser) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 })
  }

  try {
    const allReminders: any[] = []

    const medicationReminders = await generateMedicationReminders(currentUser.userId)
    allReminders.push(...medicationReminders)

    const followUpReminders = await generateFollowUpReminders(currentUser.userId)
    allReminders.push(...followUpReminders)

    const weatherReminders = await generateWeatherReminders(currentUser.userId)
    allReminders.push(...weatherReminders)

    const serviceReminders = await generateServiceRecommendations(currentUser.userId)
    allReminders.push(...serviceReminders)

    const ruleReminders = await generateRuleBasedReminders(currentUser.userId)
    allReminders.push(...ruleReminders)

    const created: any[] = []
    for (const reminderData of allReminders) {
      const reminder = await prisma.reminder.create({ data: reminderData })
      created.push(reminder)
    }

    const allUserReminders = await prisma.reminder.findMany({
      where: { userId: currentUser.userId, isActive: true },
      orderBy: [{ triggeredAt: 'desc' }],
      include: { rule: { select: { id: true, name: true, type: true } } }
    })

    const unreadCount = allUserReminders.filter(r => !r.isRead).length

    return NextResponse.json({ generated: created.length, reminders: allUserReminders, unreadCount })
  } catch (error) {
    console.error('生成提醒失败:', error)
    return NextResponse.json({ error: '生成提醒失败' }, { status: 500 })
  }
}
