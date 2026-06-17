import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { UserRole } from '@/generated/prisma'

const registerSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  name: z.string().min(2, '姓名至少2个字符'),
  password: z.string().min(6, '密码长度至少6位'),
  role: z.enum([UserRole.ELDERLY, UserRole.STAFF]),
  idCard: z.string().optional(),
  birthday: z.string().optional(),
  address: z.string().optional(),
  healthInfo: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { phone: validated.phone }
    })
    if (existingUser) {
      return NextResponse.json(
        { error: '该手机号已注册' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(validated.password)

    const user = await prisma.user.create({
      data: {
        phone: validated.phone,
        name: validated.name,
        password: hashedPassword,
        role: validated.role,
        idCard: validated.idCard,
        birthday: validated.birthday ? new Date(validated.birthday) : undefined,
        address: validated.address,
        healthInfo: validated.healthInfo,
        emergencyContact: validated.emergencyContact,
        emergencyPhone: validated.emergencyPhone,
        subsidyLevel: validated.role === UserRole.ELDERLY ? 1 : 0
      }
    })

    const { password, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      message: '注册成功'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('注册错误:', error)
    return NextResponse.json(
      { error: '注册失败' },
      { status: 500 }
    )
  }
}
