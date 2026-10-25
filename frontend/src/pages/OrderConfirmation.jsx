import Button from '../components/ui/Button'
import { orderStatuses, formatMoney, formatOrderDate } from '../utils/orders'
import './OrderConfirmation.css'
export default function OrderConfirmation({ order, onNavigate, preview = false }) {
if (!order) {
  return (
    <main>
      <h1>No order found</h1>
        <p>There is no order information available to display.</p>
    </main>
  )
}

const queueNumber = order.queue_number ?? order.queueNumber

const orderReference = order.reference ?? (
  order.order_id != null ? `#${order.order_id}` : 'Not available'
)

const statusInfo = orderStatuses[order.status]

const items = Array.isArray(order.items) ? order.items : []

const totalAmount = order.total_amount ?? order.total

const orderDate = order.createdAt ?? order.ordered_at ?? order.order_date
return (
    <main className="student-page order-confirmation">
      <h1>{preview ? 'Order Preview' : 'Order Confirmation'}</h1>
      <section className="confirmation-queue">
        <p>Your Queue Number</p>
      <strong>{queueNumber != null ? `#${queueNumber}` : 'Not available'}</strong>
      </section>
        <p>Order Reference: {orderReference}</p>
        <p>Order Status: {statusInfo?.label ?? 'Status unavailable'}</p>
        <p>{statusInfo?.message ?? 'No status update available.'}</p>
      <h2>Ordered Items</h2>

      {items.length > 0 ? (
        <ul>
            {items.map((item, index) => (
                <li key={item.menu_item_id ?? item.id ?? index}>
                    {item.name ?? 'Unnamed item'} — Quantity: {item.quantity ?? 'N/A'}
                </li>
            ))}
        </ul>
        ) : (
        <p>No item details available.</p>
    )}
    <h2>Total Amount: {totalAmount != null ? formatMoney(totalAmount) : 'Not available'}</h2>
    {orderDate && !Number.isNaN(new Date(orderDate).getTime()) && (
        <p>Order Date: {formatOrderDate(orderDate)}</p>
    )}
    <div>
        <Button onClick={() => onNavigate('menu')}>Back to Menu</Button>
        <Button variant="secondary" onClick={() => onNavigate('orders')}>View Order History</Button>
    </div>
    </main>
  )
}
