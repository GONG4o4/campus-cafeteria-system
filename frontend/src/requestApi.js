// Small helper for logged-in requests to the backend.
// Sends the saved token and turns error responses into readable messages.
const API_URL = 'http://localhost:3000/api'

export async function apiRequest(path, method = 'GET', body) {
  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please log in first.')
  }

  const options = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  }

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(API_URL + path, options)
  } catch {
    throw new Error('Unable to connect to the backend. Make sure it is running.')
  }

  let data

  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (response.status === 401) {
    throw new Error('Your session has expired. Please log in again.')
  }

  if (!response.ok) {
    throw new Error(data?.message || `The request failed (HTTP ${response.status}).`)
  }

  return data
}

// ---- Sales statistics ----
export function getSalesStats(period) {
  return apiRequest(`/staff/stats?period=${period}`)
}

// ---- Feedback and reports ----
export function sendFeedback(feedback) {
  return apiRequest('/feedback', 'POST', feedback)
}

export function getMyFeedback() {
  return apiRequest('/feedback/mine')
}

export function getAllFeedback(type, status) {
  return apiRequest(`/feedback?type=${type}&status=${status}`)
}

export function setFeedbackStatus(id, status) {
  return apiRequest(`/feedback/${id}/status`, 'PATCH', { status })
}

// ---- Featured meals ----
export function setMealFeatured(id, isFeatured) {
  return apiRequest(`/menu/${id}/featured`, 'PATCH', { is_featured: isFeatured })
}
