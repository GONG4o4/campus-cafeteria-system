const USE_MOCK_AUTH = true
const MOCK_DELAY_MS = 700

export const API_BASE_URL = 'http://localhost:3000'
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

export async function verifyToken(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/test/protected`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.ok
  } catch {
    throw new Error('Unable to connect to the backend.')
  }
}