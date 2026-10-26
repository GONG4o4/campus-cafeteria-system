export const orderFilters = [
  { id: 'all', label: 'All orders' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export const orderStatuses = {
  pending: {
    label: 'Pending',
    step: 0,
    message: 'Your order is waiting to be prepared.',
  },
  preparing: {
    label: 'Preparing',
    step: 1,  
    message: 'The kitchen is preparing your order.',
  },
  ready: {
    label: 'Ready for pickup',
    step: 2,
    message: 'Your order is ready. Bring your queue number to the counter.',
  },
  picked_up: {
    label: 'Completed',
    step: 3,
    message: 'Your order has been picked up.',
  },
  cancelled: { label: 'Cancelled', message: 'This order was cancelled.' },
}

export function filterOrders(orders, filter) {
  return orders.filter((order) => {
    if (filter === 'active')
      return ['pending', 'preparing', 'ready'].includes(order.status)
    if (filter === 'completed') return order.status === 'picked_up'
    if (filter === 'cancelled') return order.status === 'cancelled'
    return true
  })
}

export const formatMoney = (amount) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)

export const formatOrderDate = (date) =>
  new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(date))


  export function getOrderTotal(items) {
  return items.reduce(
    (total, item) => total + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  )
}