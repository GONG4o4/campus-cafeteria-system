const API_BASE_URL = 'http://localhost:3000/api/admin'

async function adminRequest(path, method = 'GET', body) {
  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please log in as a super admin.')
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options)
  } catch {
    throw new Error('Unable to connect to the backend. Make sure it is running.')
  }

  let data

  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    if (data && typeof data.message === 'string') {
      throw new Error(data.message)
    }

    throw new Error(`The request failed (HTTP ${response.status}).`)
  }

  return data
}

export function getUsers(search) {
  return adminRequest(`/users?search=${encodeURIComponent(search || '')}`)
}

export function createStaffAccount(staff) {
  return adminRequest('/staff', 'POST', staff)
}

export function updateUserRole(userId, role, currentPassword) {
  return adminRequest(`/users/${userId}/role`, 'PATCH', {
    role,
    current_password: currentPassword,
  })
}

export function updateUserStatus(userId, isActive, currentPassword) {
  return adminRequest(`/users/${userId}/status`, 'PATCH', {
    is_active: isActive,
    current_password: currentPassword,
  })
}

export function getReports() {
  return adminRequest('/reports')
}

export function getAuditLogs() {
  return adminRequest('/audit-logs?limit=100')
}

export function getSettings() {
  return adminRequest('/settings')
}

export function saveSettings(settings) {
  return adminRequest('/settings', 'PUT', settings)
}

export const roleLabels = {
  student: 'Student',
  cafeteria_staff: 'Cafeteria staff',
  super_admin: 'Super admin',
}
