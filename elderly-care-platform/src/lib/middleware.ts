import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'
import { UserRole } from '@/generated/prisma'

export function authMiddleware(requiredRoles?: UserRole[]) {
  return async (request: NextRequest) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未提供认证令牌' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json(
        { error: '认证令牌无效或已过期' },
        { status: 401 }
      )
    }

    if (requiredRoles && !requiredRoles.includes(decoded.role)) {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      )
    }

    request.headers.set('x-user-id', decoded.userId.toString())
    request.headers.set('x-user-role', decoded.role)

    return null
  }
}

export function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role') as UserRole

  if (!userId || !role) return null

  return {
    userId: parseInt(userId, 10),
    role
  }
}
