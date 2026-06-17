const API_BASE_URL = '/api'

interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { requireAuth = true, headers, ...restOptions } = options

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers
  }

  if (requireAuth) {
    const token = localStorage.getItem('token')
    if (token) {
      (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: requestHeaders,
    ...restOptions
  })

  const data = await response.json()

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    throw new Error(data.error || '请求失败')
  }

  return data
}

export const authApi = {
  login: (phone: string, password: string) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
      requireAuth: false
    }),
  register: (data: any) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      requireAuth: false
    })
}

export const userApi = {
  getProfile: () => apiRequest('/user/me'),
  updateProfile: (data: any) =>
    apiRequest('/user/me', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
}

export const serviceApi = {
  getList: (category?: string) =>
    apiRequest(`/services${category ? `?category=${category}` : ''}`, {
      requireAuth: false
    }),
  getById: (id: number) =>
    apiRequest(`/services?id=${id}`, {
      requireAuth: false
    }),
  create: (data: any) =>
    apiRequest('/services', {
      method: 'POST',
      body: JSON.stringify(data)
    })
}

export const orderApi = {
  getList: (params?: { status?: string; category?: string; startDate?: string; endDate?: string; keyword?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams()
    if (params?.status) query.append('status', params.status)
    if (params?.category) query.append('category', params.category)
    if (params?.startDate) query.append('startDate', params.startDate)
    if (params?.endDate) query.append('endDate', params.endDate)
    if (params?.keyword) query.append('keyword', params.keyword)
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    return apiRequest(`/orders${query.toString() ? `?${query.toString()}` : ''}`)
  },
  getDetail: (orderId: number) => apiRequest(`/orders/${orderId}`),
  create: (data: any) =>
    apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  accept: (orderId: number) =>
    apiRequest(`/orders/${orderId}?action=accept`, {
      method: 'PUT'
    }),
  checkIn: (orderId: number, latitude: number, longitude: number) =>
    apiRequest(`/orders/${orderId}?action=checkin`, {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude })
    }),
  checkOut: (orderId: number, latitude: number, longitude: number) =>
    apiRequest(`/orders/${orderId}?action=checkout`, {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude })
    }),
  complete: (orderId: number) =>
    apiRequest(`/orders/${orderId}?action=complete`, {
      method: 'PUT'
    }),
  cancel: (orderId: number, reason?: string) =>
    apiRequest(`/orders/${orderId}?action=cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    }),
  review: (orderId: number, rating: number, comment?: string, images?: string) =>
    apiRequest(`/orders/${orderId}?action=review`, {
      method: 'PUT',
      body: JSON.stringify({ rating, comment, images })
    })
}

export const adminApi = {
  getUsers: (params?: { role?: string; page?: number; pageSize?: number; keyword?: string }) => {
    const query = new URLSearchParams()
    if (params?.role) query.append('role', params.role)
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    if (params?.keyword) query.append('keyword', params.keyword)
    return apiRequest(`/admin/users${query.toString() ? `?${query.toString()}` : ''}`)
  },
  createUser: (data: any) =>
    apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateUser: (id: number, data: any) =>
    apiRequest(`/admin/users?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteUser: (id: number) =>
    apiRequest(`/admin/users?id=${id}`, {
      method: 'DELETE'
    }),
  getSchedules: (params?: { staffId?: number; date?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams()
    if (params?.staffId) query.append('staffId', params.staffId.toString())
    if (params?.date) query.append('date', params.date)
    if (params?.startDate) query.append('startDate', params.startDate)
    if (params?.endDate) query.append('endDate', params.endDate)
    return apiRequest(`/admin/schedules${query.toString() ? `?${query.toString()}` : ''}`)
  },
  createSchedule: (data: any) =>
    apiRequest('/admin/schedules', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateSchedule: (id: number, data: any) =>
    apiRequest(`/admin/schedules?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteSchedule: (id: number) =>
    apiRequest(`/admin/schedules?id=${id}`, {
      method: 'DELETE'
    }),
  getQualityChecks: (params?: { staffId?: number; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams()
    if (params?.staffId) query.append('staffId', params.staffId.toString())
    if (params?.page) query.append('page', params.page.toString())
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString())
    return apiRequest(`/admin/quality-checks${query.toString() ? `?${query.toString()}` : ''}`)
  },
  createQualityCheck: (data: any) =>
    apiRequest('/admin/quality-checks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateQualityCheck: (id: number, data: any) =>
    apiRequest(`/admin/quality-checks?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteQualityCheck: (id: number) =>
    apiRequest(`/admin/quality-checks?id=${id}`, {
      method: 'DELETE'
    }),
  getStats: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams()
    if (params?.startDate) query.append('startDate', params.startDate)
    if (params?.endDate) query.append('endDate', params.endDate)
    return apiRequest(`/admin/stats${query.toString() ? `?${query.toString()}` : ''}`)
  }
}
