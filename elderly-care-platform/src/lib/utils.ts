export function generateOrderNo(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  
  return `ORD${year}${month}${day}${hours}${minutes}${seconds}${random}`
}

export function calculateSubsidy(
  totalAmount: number,
  subsidyPercentage: number,
  maxSubsidy: number
): number {
  const calculatedSubsidy = totalAmount * (subsidyPercentage / 100)
  return Math.min(calculatedSubsidy, maxSubsidy)
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: '待接单',
    ACCEPTED: '已接单',
    IN_PROGRESS: '服务中',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  }
  return statusMap[status] || status
}

export function getServiceCategoryText(category: string): string {
  const categoryMap: Record<string, string> = {
    MEAL: '助餐服务',
    BATH: '助浴服务',
    CLEANING: '助洁服务',
    MEDICAL: '助医服务',
    COMPANION: '陪护服务'
  }
  return categoryMap[category] || category
}

export function getReminderTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    MEDICATION: '用药提醒',
    FOLLOW_UP: '复诊提醒',
    WEATHER: '天气关怀',
    SERVICE_RECOMMENDATION: '服务推荐',
    GENERAL: '温馨提醒'
  }
  return typeMap[type] || type
}

export function getReminderTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    MEDICATION: '💊',
    FOLLOW_UP: '🏥',
    WEATHER: '🌤️',
    SERVICE_RECOMMENDATION: '⭐',
    GENERAL: '💌'
  }
  return iconMap[type] || '🔔'
}

export function getReminderTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    MEDICATION: 'from-red-400 to-pink-400',
    FOLLOW_UP: 'from-purple-400 to-indigo-400',
    WEATHER: 'from-blue-400 to-cyan-400',
    SERVICE_RECOMMENDATION: 'from-yellow-400 to-orange-400',
    GENERAL: 'from-green-400 to-emerald-400'
  }
  return colorMap[type] || 'from-gray-400 to-gray-500'
}

export function getRoleText(role: string): string {
  const roleMap: Record<string, string> = {
    ELDERLY: '老人',
    STAFF: '服务人员',
    ADMIN: '管理员'
  }
  return roleMap[role] || role
}

export function generatePackageNo(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `PKG${year}${month}${day}${hours}${minutes}${seconds}${random}`
}

export function getCycleTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    DAILY: '每日',
    WEEKLY: '每周',
    MONTHLY: '每月',
    CUSTOM: '自定义'
  }
  return typeMap[type] || type
}

export function getPackageStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: '进行中',
    PAUSED: '已暂停',
    COMPLETED: '已完成',
    EXPIRED: '已过期',
    CANCELLED: '已取消'
  }
  return statusMap[status] || status
}

export function getPackageStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PAUSED: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-gray-100 text-gray-700',
    EXPIRED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500'
  }
  return colorMap[status] || 'bg-gray-100 text-gray-700'
}

export function parseWeekdaySchedule(schedule: string | null | undefined): number[] {
  if (!schedule) return []
  return schedule.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
}

export function generateWeekdaySchedule(weekdays: number[]): string {
  return weekdays.filter(n => n >= 0 && n <= 6).join(',')
}

export function getWeekdayText(day: number): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[day] || ''
}

export function generateServiceSchedule(
  startDate: Date,
  endDate: Date,
  cycleType: string,
  cycleDays: number | null | undefined,
  weekdaySchedule: string | null | undefined,
  timeOfDay: string | null | undefined,
  totalServices: number
): Date[] {
  const schedule: Date[] = []
  const currentDate = new Date(startDate)
  const weekdays = parseWeekdaySchedule(weekdaySchedule)
  const [hourStr, minuteStr] = (timeOfDay || '09:00').split(':')
  const hour = parseInt(hourStr, 10) || 9
  const minute = parseInt(minuteStr, 10) || 0

  currentDate.setHours(hour, minute, 0, 0)

  if (cycleType === 'DAILY') {
    while (schedule.length < totalServices && currentDate <= endDate) {
      schedule.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
  } else if (cycleType === 'WEEKLY' || weekdays.length > 0) {
    const days = weekdays.length > 0 ? weekdays : [1, 3, 5]
    let maxIterations = 365 * 3
    while (schedule.length < totalServices && currentDate <= endDate && maxIterations > 0) {
      if (days.includes(currentDate.getDay())) {
        schedule.push(new Date(currentDate))
      }
      currentDate.setDate(currentDate.getDate() + 1)
      maxIterations--
    }
  } else if (cycleType === 'MONTHLY') {
    const dayOfMonth = currentDate.getDate()
    while (schedule.length < totalServices && currentDate <= endDate) {
      schedule.push(new Date(currentDate))
      currentDate.setMonth(currentDate.getMonth() + 1)
      currentDate.setDate(Math.min(dayOfMonth, new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()))
    }
  } else if (cycleType === 'CUSTOM' && cycleDays && cycleDays > 0) {
    while (schedule.length < totalServices && currentDate <= endDate) {
      schedule.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + cycleDays)
    }
  }

  return schedule.slice(0, totalServices)
}
