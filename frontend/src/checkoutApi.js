export async function placeOrder(items) {
  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please log in before placing your order.')
  }

  let response

  try {
    response = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
        })),
      }),
    })
  } catch (cause) {
    const error = new Error(
      'We could not confirm whether your order was placed. Check order history before trying again.',
      { cause },
    )
    error.orderStatusUnknown = true
    throw error
  }

  if (response.status === 401) {
    throw new Error('Your session has expired. Please log in again.')
  }

  let data

  try {
    data = await response.json()
  } catch (cause) {
    const error = new Error(
      'The order service returned an unreadable response. Check order history before trying again.',
      { cause },
    )
    error.orderStatusUnknown = true
    throw error
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to place your order. Please try again.')
  }

  if (
    response.status !== 201 ||
    !Number.isInteger(data?.order_id) ||
    data.order_id < 1 ||
    !Number.isInteger(data.queue_number) ||
    data.queue_number < 1 ||
    data.total_amount == null ||
    !Number.isFinite(Number(data.total_amount)) ||
    Number(data.total_amount) < 0 ||
    typeof data.status !== 'string'
  ) {
    const error = new Error(
      'Your order could not be confirmed. Check order history before placing another order.',
    )
    error.orderStatusUnknown = true
    throw error
  }

  return data
}
