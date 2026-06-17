import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from './prisma'
import { UserRole } from '@/generated/prisma'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key'
const JWT_EXPIRES_IN = '7d'

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: number, role: UserRole): string {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

export function verifyToken(token: string): { userId: number; role: UserRole } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: UserRole }
    return decoded
  } catch {
    return null
  }
}

export async function authenticateUser(phone: string, password: string) {
  const user = await prisma.user.findUnique({ where: { phone } })
  if (!user) return null

  const isPasswordValid = await comparePassword(password, user.password)
  if (!isPasswordValid) return null

  if (!user.isActive) return null

  const token = generateToken(user.id, user.role)
  return { user, token }
}
