
const API_BASE_URL = 'http://localhost:3000'

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

const getResponseMessage = (body, fallback) => {
  if (body && typeof body.message === 'string' && body.message.trim()) {
    return body.message
  }

  if (body && typeof body.error === 'string' && body.error.trim()) {
    return body.error
  }

  return fallback
}

export async function submitAuthRequest(endpoint, payload, mockMessage) {
  let response

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error(
      'Unable to connect to the authentication service. Make sure the backend is running.'
    )
  }

  let responseBody

  try {
    responseBody = await response.json()
  } catch {
    throw new Error('The authentication service returned an unreadable response.')
  }

  if (!response.ok) {
    throw new Error(
      getResponseMessage(
        responseBody,
        `The request failed (HTTP ${response.status}). Please try again.`
      )
    )
  }

  return {
    ...responseBody,
    message: getResponseMessage(responseBody, mockMessage || 'Success'),
  }
}

export async function getSessionUser(token) {
  let response

  try {
    response = await fetch(`${API_BASE_URL}/api/test/protected`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error('Unable to connect to the backend.')
  }

  if (response.status === 401 || response.status === 403) {
    return null
  }

  if (!response.ok) {
    throw new Error('Unable to check your session. Please try signing in again.')
  }

  let data

  try {
    data = await response.json()
  } catch {
    throw new Error('The authentication service returned an unreadable session.')
  }

  if (
    !Number.isInteger(data?.user?.user_id) ||
    data.user.user_id < 1 ||
    typeof data.user.role !== 'string'
  ) {
    throw new Error('The authentication service returned an incomplete session.')
  }

  return data.user
}
