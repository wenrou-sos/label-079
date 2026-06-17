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

export function getRoleText(role: string): string {
  const roleMap: Record<string, string> = {
    ELDERLY: '老人',
    STAFF: '服务人员',
    ADMIN: '管理员'
  }
  return roleMap[role] || role
}
