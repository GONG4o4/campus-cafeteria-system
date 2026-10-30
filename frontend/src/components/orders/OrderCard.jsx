import Button from '../ui/Button'
import {
  formatMoney,
  formatOrderDate,
  orderStatuses,
} from '../../utils/orders'

const steps = ['Pending', 'Preparing', 'Ready', 'Picked up']

export default function OrderCard({
  order,
  onLoadDetails,
  detailState = {},
  onCancel,
  cancelling = false
}) {
  const status = orderStatuses[order.status]
  const itemCount = order.items.reduce(
    (count, item) => count + item.quantity,
    0,
  )

  function handleDetailsToggle(event) {
    if (event.currentTarget.open) {
      onLoadDetails()
    }
  }

  return (
    <article
      className={`order-card order-card--${order.status}`}
      aria-labelledby={`title-${order.id}`}
    >
      <div className="order-card-heading">
        <div>
          <h2 id={`title-${order.id}`}>{order.reference}</h2>
          <time dateTime={order.createdAt}>
            {formatOrderDate(order.createdAt)}
          </time>
        </div>
        <span className={`order-status order-status--${order.status}`}>
          {status.label}
        </span>
      </div>
      <div className="order-card-overview">
        <div className="queue-number">
          <span>Queue no.</span>
          <strong>{order.queueNumber}</strong>
        </div>
        <div className="order-summary">
          <p>{order.items.map((item) => item.name).join(', ')}</p>
          <span>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="order-total">
          <span>Total amount</span>
          <strong>{formatMoney(order.total)}</strong>
        </div>
      </div>
      <details className="order-details" onToggle={handleDetailsToggle}>
        <summary>
          View order details{' '}
          <span aria-hidden="true" className="details-chevron">
            ⌄
          </span>
        </summary>
        <div className="order-details-content">
          {detailState.loading && (
            <p role="status">Loading order details...</p>
          )}

          {!detailState.loading && detailState.error && (
            <div className="orders-error" role="alert">
              <p>{detailState.error}</p>
              <button className="orders-refresh" onClick={onLoadDetails}>
                Try again
              </button>
            </div>
          )}

          {!detailState.loading && !detailState.error && (
            <>
              <p className="tracking-message">{status.message}</p>
              {order.status !== 'cancelled' && (
                <ol className="order-progress" aria-label="Order progress">
                  {steps.map((step, index) => {
                    let stepDescription = ', upcoming'

                    if (index < status.step) {
                      stepDescription = ', complete'
                    } else if (index === status.step) {
                      stepDescription = ', current step'
                    }

                    return (
                      <li
                        key={step}
                        className={index <= status.step ? 'step-reached' : ''}
                        aria-current={index === status.step ? 'step' : undefined}
                      >
                        <span aria-hidden="true">
                          {index < status.step ? '✓' : index + 1}
                        </span>
                        {step}
                        <span className="sr-only">
                          {stepDescription}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
              <ul className="order-items" aria-label="Ordered items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      <span className="item-quantity">{item.quantity}×</span>{' '}
                      {item.name}
                    </span>
                    <strong>{formatMoney(item.subtotal)}</strong>
                  </li>
                ))}
              </ul>
              <div className="details-total">
                <span>Total</span>
                <strong>{formatMoney(order.total)}</strong>
              </div>
            </>
          )}
        </div>
      </details>
      {order.status === 'pending' && (
  <div className="order-cancel-actions">
    <Button
      variant="secondary"
      onClick={onCancel}
      disabled={cancelling}
    >
      {cancelling ? 'Cancelling...' : 'Cancel order'}
    </Button>
  </div>
)}
    </article>
  )
}
