'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { userApi } from '@/lib/api'
import { UserRole } from '@/types'
import { getRoleText, formatDate } from '@/lib/utils'

interface FamilyMember {
  id: number
  name: string
  phone: string
  relation: string
  isPrimary: boolean
}

interface UserProfile {
  id: number
  phone: string
  name: string
  role: UserRole
  avatar?: string
  birthday?: string
  address?: string
  healthInfo?: string
  emergencyContact?: string
  emergencyPhone?: string
  subsidyLevel: number
  familyMembers: FamilyMember[]
}

const subsidyLevelText: Record<number, string> = {
  0: '无补贴',
  1: '普通补贴 (30%)',
  2: '重点补贴 (50%)',
  3: '特困补贴 (80%)'
}

const menuItems = [
  { icon: '📋', label: '我的订单', path: '/orders' },
  { icon: '⭐', label: '我的评价', path: '/reviews' },
  { icon: '🔐', label: '修改密码', path: '/change-password' },
  { icon: '🚪', label: '退出登录', action: 'logout' }
]

export default function ProfilePage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true)
      const data = await userApi.getProfile() as UserProfile
      setProfile(data)
    } catch (error) {
      console.error('加载用户信息失败:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadProfile()
    }
  }, [user, loadProfile])

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout()
      router.push('/login')
    }
  }

  const handleMenuClick = (item: typeof menuItems[0]) => {
    if (item.action === 'logout') {
      handleLogout()
    } else if (item.path) {
      router.push(item.path)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  const displayProfile = profile || user

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 pb-12">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl overflow-hidden relative">
            {displayProfile.avatar ? (
              <Image
                src={displayProfile.avatar}
                alt={displayProfile.name}
                fill
                className="rounded-full object-cover"
              />
            ) : (
              '👤'
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{displayProfile.name}</h1>
            <p className="text-orange-100 mt-1">{displayProfile.phone}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-sm">
              {getRoleText(displayProfile.role)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎫</span>
            <div className="flex-1">
              <p className="text-sm text-gray-500">当前补贴等级</p>
              <p className="text-lg font-bold text-orange-500">
                {subsidyLevelText[displayProfile.subsidyLevel] || '无补贴'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">基本信息</h2>
          {profileLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-2">
                  <span>🎂</span> 生日
                </span>
                <span className="text-gray-800">
                  {displayProfile.birthday ? formatDate(displayProfile.birthday) : '未填写'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-2">
                  <span>📍</span> 地址
                </span>
                <span className="text-gray-800 text-right max-w-[60%]">
                  {displayProfile.address || '未填写'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-2">
                  <span>❤️</span> 健康信息
                </span>
                <span className="text-gray-800 text-right max-w-[60%]">
                  {displayProfile.healthInfo || '未填写'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-2">
                  <span>📞</span> 紧急联系人
                </span>
                <span className="text-gray-800 text-right max-w-[60%]">
                  {displayProfile.emergencyContact && displayProfile.emergencyPhone
                    ? `${displayProfile.emergencyContact} (${displayProfile.emergencyPhone})`
                    : '未填写'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {displayProfile.role === UserRole.ELDERLY && profile?.familyMembers && profile.familyMembers.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4">家属信息</h2>
            <div className="space-y-3">
              {profile.familyMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                      👨‍👩‍👧
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {member.name}
                        {member.isPrimary && (
                          <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                            主要联系人
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{member.relation}</p>
                    </div>
                  </div>
                  <span className="text-orange-500 font-medium">{member.phone}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={() => handleMenuClick(item)}
              className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-gray-800 font-medium">{item.label}</span>
              </div>
              <span className="text-gray-400">{'>'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => router.push('/')}
            className="flex flex-col items-center text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs mt-1">首页</span>
          </button>
          <button
            onClick={() => router.push('/orders')}
            className="flex flex-col items-center text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">📋</span>
            <span className="text-xs mt-1">订单</span>
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center text-orange-500"
          >
            <span className="text-2xl">👤</span>
            <span className="text-xs mt-1 font-medium">我的</span>
          </button>
        </div>
      </div>
    </div>
  )
}
