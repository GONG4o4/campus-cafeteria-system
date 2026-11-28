// pickup is { type: 'asap' } or { type: 'scheduled', time: '10:30' }
export async function createCheckoutSession(items, acknowledgedNoShowPolicy, pickup = { type: 'asap' }) {
  if (acknowledgedNoShowPolicy !== true) {
    throw new Error('Please confirm the pickup and no-show policy before placing your order.')
  }

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
        acknowledge_no_show_policy: true,
        pickup,
      }),
    })
  } catch (cause) {
    const error = new Error(
      'Could not connect to the backend server. It may have crashed. Check the terminal.',
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
      'The order service returned an unreadable response. Check the terminal.',
      { cause },
    )
    error.orderStatusUnknown = true
    throw error
  }

  if (!response.ok) {
    const errorDetails = data?.details ? ` (${data.details})` : '';
    throw new Error((data?.message || 'Failed to initialize payment.') + errorDetails)
  }

  if (
    response.status !== 201 ||
    !Number.isInteger(data?.order_id) ||
    data.order_id < 1 ||
    typeof data?.checkout_url !== 'string' ||
    !data.checkout_url.startsWith('http')
  ) {
    const error = new Error(
      'Your checkout session could not be confirmed. Check order history before placing another order.',
    )
    error.orderStatusUnknown = true
    throw error
  }

  return data
}