export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  ELDERLY = 'ELDERLY',
}

export enum ServiceCategory {
  MEAL = 'MEAL',
  BATH = 'BATH',
  CLEANING = 'CLEANING',
  MEDICAL = 'MEDICAL',
  COMPANION = 'COMPANION',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export enum MealType {
  DELIVERY = 'DELIVERY',
  CANTEEN = 'CANTEEN',
}

export enum BathType {
  HOME_BATH = 'HOME_BATH',
}

export enum CleaningType {
  HOUSEKEEPING = 'HOUSEKEEPING',
  LAUNDRY = 'LAUNDRY',
}

export enum MedicalType {
  ACCOMPANY = 'ACCOMPANY',
  PICKUP_MEDICINE = 'PICKUP_MEDICINE',
}

export enum CompanionType {
  CHAT = 'CHAT',
  WALK = 'WALK',
}

export interface User {
  id: number
  phone: string
  name: string
  role: UserRole
  avatar?: string | null
  idCard?: string | null
  birthday?: string | null
  address?: string | null
  healthInfo?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  subsidyLevel: number
  createdAt: string
  updatedAt: string
}

export interface Service {
  id: number
  name: string
  category: ServiceCategory
  description: string
  price: number
  duration: number
  unit: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: number
  orderNo: string
  elderlyId: number
  staffId?: number | null
  serviceId: number
  service?: Service
  scheduledTime: string
  actualStartTime?: string | null
  actualEndTime?: string | null
  status: OrderStatus
  totalAmount: number
  subsidyAmount: number
  personalAmount: number
  address?: string | null
  checkInLatitude?: number | null
  checkInLongitude?: number | null
  checkOutLatitude?: number | null
  checkOutLongitude?: number | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Review {
  id: number
  orderId: number
  elderlyId: number
  staffId: number
  rating: number
  comment?: string | null
  createdAt: string
}
