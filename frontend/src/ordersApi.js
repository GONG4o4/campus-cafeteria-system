
function formatOrder(order) {
  let createdAt = order.ordered_at

  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(createdAt)) {
    createdAt += '+08:00'
  }

  return {
    id: order.order_id,
    reference: `Order #${order.order_id}`,
    queueNumber: order.queue_number,
    status: order.status,
    total: Number(order.total_amount),

    createdAt,
    items: order.items.map((item) => ({
      id: item.order_item_id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
    })),
  }
}

export async function getOrders(id, signal) {
  const token = localStorage.getItem('token')
  let url = 'http://localhost:3000/api/orders'

  if (id) {
    url += `/${id}`
  }
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

    throw new Error(
      'Unable to connect to the backend. Make sure it is running.',
      { cause: error },
    )
  }

  if (response.status === 401) {
    throw new Error('Your session has expired. Please sign in again.')
  }

  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    if (response.status === 404) {
      throw new Error('Order history is not available on the backend yet.')
    }

    throw new Error('The order service returned an unexpected response. Please try again.')
  }

  let data

  try {
    data = await response.json()
  } catch (error) {
    throw new Error('The order service returned an unreadable response.', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load orders. Please try again.')
  }

  if (id) {
    if (!data || !Array.isArray(data.items)) {
      throw new Error('The order service returned incomplete order details.')
    }

    return formatOrder(data)
  }

  if (!Array.isArray(data) || data.some((order) => !order || !Array.isArray(order.items))) {
    throw new Error('The order service returned an invalid order list.')
  }

  return data.map(formatOrder)
}
