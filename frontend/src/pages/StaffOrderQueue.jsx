import { useCallback, useEffect, useRef, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import './StaffOrderQueue.css'

const filters = [
  { value: 'all', label: 'All orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
]

const nextStatus = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'picked_up',
}

const statusLabels = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  picked_up: 'Picked up',
  no_show: 'No-show',
  cancelled: 'Cancelled',
}

function formatMoney(amount) {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// "2026-11-22T14:05:00" -> "14:05"
function formatTime(text) {
  return text ? text.slice(11, 16) : ''
}

// "2026-11-22T14:05:00" -> "2026-11-22 · 14:05"
function formatDateTime(text) {
  return text ? `${text.slice(0, 10)} · ${text.slice(11, 16)}` : ''
}

// Only cafeteria staff can record a no-show. Super admins can view this
// page but the backend refuses their no-show requests, so hide the button.
function getUserRole() {
  try {
    return JSON.parse(localStorage.getItem('user'))?.role || ''
  } catch {
    return ''
  }
}

export default function StaffOrderQueue() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  // The order whose "Mark as No-Show" confirmation box is open.
  const [confirmNoShowId, setConfirmNoShowId] = useState(null)
  const updating = useRef(false)
  const isStaff = getUserRole() === 'cafeteria_staff'

  const loadOrders = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('Please log in as cafeteria staff.')
      }

      const response = await fetch('http://localhost:3000/api/staff/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load orders.')
      }

      if (!Array.isArray(data)) {
        throw new Error('Invalid order data received.')
      }

      if (!signal?.aborted) {
        setOrders(data)
      }
    } catch (requestError) {
      if (!signal?.aborted) {
        setError(requestError.message || 'Unable to connect to the backend.')
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const timeoutId = setTimeout(() => {
      loadOrders(controller.signal)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [loadOrders])

  async function handleStatusUpdate(order) {
    const next = nextStatus[order.status]

    if (!next || updating.current) return

    updating.current = true
    setUpdatingId(order.order_id)
    setConfirmNoShowId(null)
    setError('')
    setMessage('')

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `http://localhost:3000/api/staff/orders/${order.order_id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: next }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update order status.')
      }

      setMessage(`Order #${order.order_id} updated successfully.`)
      await loadOrders()
    } catch (requestError) {
      setError(requestError.message || 'Unable to update order status.')
    } finally {
      updating.current = false
      setUpdatingId(null)
    }
  }

  async function handleMarkNoShow(order) {
    // The ref blocks a second click before React re-renders the button.
    if (updating.current) return

    updating.current = true
    setUpdatingId(order.order_id)
    setError('')
    setMessage('')

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `http://localhost:3000/api/staff/orders/${order.order_id}/no-show`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      let data

      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to mark this order as a no-show.')
      }

      setConfirmNoShowId(null)
      setMessage(`Queue #${order.queue_number}: ${data.message}`)
      await loadOrders()
    } catch (requestError) {
      setError(requestError.message || 'Unable to mark this order as a no-show.')
    } finally {
      updating.current = false
      setUpdatingId(null)
    }
  }

  const visibleOrders = orders.filter(
    (order) => filter === 'all' || order.status === filter
  )

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Order queue</h1>
          <p>Manage incoming student orders and food preparation.</p>
        </div>

        <Button variant="secondary" onClick={() => loadOrders()} disabled={loading || updatingId !== null}>
          Refresh orders
        </Button>
      </div>

      {message && <Alert>{message}</Alert>}

      {error && (
        <Alert error>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => loadOrders()}>
            Try again
          </Button>
        </Alert>
      )}

      <div className="staff-queue-filters">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? 'active' : ''}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label} ({item.value === 'all'
              ? orders.length
              : orders.filter((order) => order.status === item.value).length})
          </button>
        ))}
      </div>

      {loading && <Loading>Loading cafeteria orders...</Loading>}

      {!loading && !error && visibleOrders.length === 0 && (
        <div className="student-empty">
          <h2>No orders found</h2>
          <p>Orders matching this status will appear here.</p>
        </div>
      )}

      {!loading && !error && (
        <div className="staff-queue-list">
          {visibleOrders.map((order) => {
            const awaitingPickup = order.status === 'ready'
            const overdue = awaitingPickup && order.can_mark_no_show
            const confirming = confirmNoShowId === order.order_id

            let cardClass = 'staff-queue-card'

            if (overdue) {
              cardClass += ' staff-queue-card--overdue'
            } else if (awaitingPickup) {
              cardClass += ' staff-queue-card--awaiting'
            }

            return (
              <article className={cardClass} key={order.order_id}>
                <div className="staff-queue-card-header">
                  <div>
                    <h2>Queue #{order.queue_number}</h2>
                    <p>Order #{order.order_id}</p>
                    <p>
                      {order.order_date}
                      {order.ordered_at && ` · ${formatTime(order.ordered_at)}`}
                    </p>
                  </div>

                  <span className={`staff-queue-status status-${order.status}`}>
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>

                {awaitingPickup && order.pickup_deadline && (
                  <div className={overdue ? 'staff-pickup-info staff-pickup-info--overdue' : 'staff-pickup-info'}>
                    {overdue ? (
                      <>
                        <strong>Not collected</strong>
                        <span>
                          Pickup deadline was {formatTime(order.pickup_deadline)}. The grace period
                          ended at {formatTime(order.no_show_after)}.
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>Awaiting pickup</strong>
                        <span>
                          Collect by {formatTime(order.pickup_deadline)}. Can be marked as a
                          no-show after {formatTime(order.no_show_after)}.
                        </span>
                      </>
                    )}
                  </div>
                )}

                {order.status === 'no_show' && (
                  <div className="staff-penalty-info">
                    <strong>Missed pickup recorded</strong>
                    {order.no_show_recorded_at && (
                      <span>Recorded {formatDateTime(order.no_show_recorded_at)}</span>
                    )}
                    {order.no_show_policy_result === 'restricted' && (
                      <span>
                        Customer is restricted from ordering
                        {order.restriction_ends_at && ` until ${formatDateTime(order.restriction_ends_at)}`}.
                      </span>
                    )}
                    {order.no_show_policy_result === 'warning' && (
                      <span>
                        Customer received a warning
                        {order.no_show_offense_count && order.no_show_offense_threshold &&
                          ` (${order.no_show_offense_count} of ${order.no_show_offense_threshold} missed pickups before a restriction)`}.
                      </span>
                    )}
                  </div>
                )}

                <div className="staff-queue-items">
                  {order.items.map((item, index) => (
                    <div key={`${item.menu_item_id}-${index}`}>
                      <span>{item.quantity} × {item.name}</span>
                      <strong>{formatMoney(item.subtotal)}</strong>
                    </div>
                  ))}
                </div>

                {confirming ? (
                  <div className="staff-no-show-confirm" role="alertdialog" aria-labelledby={`no-show-title-${order.order_id}`}>
                    <strong id={`no-show-title-${order.order_id}`}>
                      Mark Queue #{order.queue_number} as a no-show?
                    </strong>
                    <p>
                      This records a missed pickup for the customer and may restrict their
                      ordering. It cannot be undone from this page.
                    </p>
                    <div className="staff-no-show-actions">
                      <Button
                        onClick={() => handleMarkNoShow(order)}
                        disabled={updatingId !== null}
                      >
                        {updatingId === order.order_id ? 'Recording...' : 'Yes, mark as no-show'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmNoShowId(null)}
                        disabled={updatingId !== null}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="staff-queue-card-footer">
                    <div>
                      <span>Order total</span>
                      <strong>{formatMoney(order.total_amount)}</strong>
                    </div>

                    <div className="staff-queue-actions">
                      {isStaff && overdue && (
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmNoShowId(order.order_id)}
                          disabled={updatingId !== null}
                        >
                          Mark as No-Show
                        </Button>
                      )}

                      {nextStatus[order.status] ? (
                        <Button
                          onClick={() => handleStatusUpdate(order)}
                          disabled={updatingId !== null}
                        >
                          {updatingId === order.order_id
                            ? 'Updating...'
                            : `Mark as ${statusLabels[nextStatus[order.status]]}`}
                        </Button>
                      ) : (
                        <span className="staff-queue-finished">
                          No further action
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
