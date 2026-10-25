import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import { orderStatuses, formatMoney, formatOrderDate } from '../utils/orders'
import { getOrders } from '../ordersApi'
import './OrderConfirmation.css'

export default function OrderConfirmation({ order = null, orderId, onNavigate }) {
  const [receipt, setReceipt] = useState(order)
  const [loading, setLoading] = useState(!order)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOrder() {
      setLoading(true)
      setError('')

      try {
        const savedOrder = await getOrders(orderId, controller.signal)

        if (!controller.signal.aborted) {
          setReceipt(savedOrder)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message || 'Unable to load your order details.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadOrder()
    return () => controller.abort()
  }, [orderId, reload])

  const queueNumber = receipt?.queue_number ?? receipt?.queueNumber
  const orderReference = receipt?.reference || `#${receipt?.order_id}`
  const statusInfo = orderStatuses[receipt?.status]
  const items = receipt?.items || []
  const totalAmount = receipt?.total_amount ?? receipt?.total
  let displayDate = ''
  const timestamp = receipt?.createdAt || receipt?.ordered_at

  if (timestamp && !Number.isNaN(new Date(timestamp).getTime())) {
    displayDate = formatOrderDate(timestamp)
  } else if (receipt?.order_date) {
    let dateValue = receipt.order_date

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      dateValue += 'T00:00:00+08:00'
    }

    const date = new Date(dateValue)

    if (!Number.isNaN(date.getTime())) {
      displayDate = new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      }).format(date)
    }
  }

  return (
    <main className="student-page order-confirmation">
      <h1>Order Confirmation</h1>

      {loading && (
        <Loading>
          {receipt ? 'Updating order details...' : 'Loading your order...'}
        </Loading>
      )}

      {error && (
        <Alert error>
          <p>
            {receipt && 'Your order was placed, but we could not refresh its details. '}
            {error}
          </p>
          <Button
            variant="secondary"
            onClick={() => setReload(reload + 1)}
            disabled={loading}
          >
            Refresh details
          </Button>
        </Alert>
      )}

      {receipt && (
        <>
          <p role="status">Your order was placed. Keep your queue number for pickup.</p>
          <section className="confirmation-queue" aria-label="Your queue number">
            <p>Your Queue Number</p>
            <strong>#{queueNumber}</strong>
          </section>
          <p>Order Reference: {orderReference}</p>
          <p>Order Status: {statusInfo?.label || 'Status unavailable'}</p>
          <p>{statusInfo?.message || 'No status update available.'}</p>

          <h2>Ordered Items</h2>
          {items.length > 0 ? (
            <ul>
              {items.map((item) => (
                <li key={item.menu_item_id || item.id}>
                  {item.name} — Quantity: {item.quantity}
                </li>
              ))}
            </ul>
          ) : (
            <p>No item details available.</p>
          )}

          <h2>Total Amount: {formatMoney(totalAmount)}</h2>
          {displayDate && <p>Order Date: {displayDate}</p>}
        </>
      )}

      <div className="confirmation-actions">
        <Button onClick={() => onNavigate('menu')}>
          Back to Menu
        </Button>
        <Button variant="secondary" onClick={() => onNavigate('orders')}>
          View Order History
        </Button>
      </div>
    </main>
  )
}
