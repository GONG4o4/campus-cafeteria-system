export async function getStaffAnalytics(startDate, endDate, signal) {
  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please log in as cafeteria staff.')
  }

  const url =
    'http://localhost:3000/api/staff/analytics' +
    `?startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}`

  let response

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error
    }

    throw new Error('Unable to connect to the backend. Make sure it is running.', {
      cause: error,
    })
  }

  let data

  try {
    data = await response.json()
  } catch {
    throw new Error('The analytics service returned an unreadable response.')
  }

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load analytics.')
  }

  if (
    !data ||
    !data.period ||
    !data.summary ||
    !Array.isArray(data.ordersByStatus) ||
    !Array.isArray(data.topDishes) ||
    !Array.isArray(data.ordersByHour)
  ) {
    throw new Error('The analytics service returned incomplete data.')
  }

  return data
}
