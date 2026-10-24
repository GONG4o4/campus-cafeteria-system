
function formatOrder(order) {
  return {
    id: order.order_id,
    reference: `Order #${order.order_id}`,
    queueNumber: order.queue_number,
    status: order.status,
    total: Number(order.total_amount),

    createdAt: `${order.ordered_at}+08:00`,
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
  if (!response.ok) {
    const body = await response.json()
    throw new Error(body.message || 'Unable to load orders. Please try again.')
  }

  const data = await response.json()

  if (id) {
    return formatOrder(data)
  }

  return data.map(formatOrder)
}
