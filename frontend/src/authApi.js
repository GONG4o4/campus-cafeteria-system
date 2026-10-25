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
  if (USE_MOCK_AUTH) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
    return { message: mockMessage }
  }

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Unable to connect to the authentication service. Please try again later.')
  }

  let responseText
  try {
    responseText = await response.text()
  } catch {
    throw new Error('The authentication service returned an unreadable response.')
  }
  let responseBody = null
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }
  }

  if (!response.ok) {
    throw new Error(
      getResponseMessage(
        responseBody,
        `The request failed (HTTP ${response.status}). Please try again.`,
      ),
    )
  }

  return {
    message: getResponseMessage(responseBody, 'The request completed successfully.'),
  }
}
