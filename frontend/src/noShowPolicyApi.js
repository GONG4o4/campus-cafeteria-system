export async function getNoShowPolicy(signal) {
  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please log in to view the pickup policy.')
  }

  const response = await fetch('http://localhost:3000/api/orders/no-show-policy', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })

  let data

  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load the pickup policy.')
  }

  return data
}
