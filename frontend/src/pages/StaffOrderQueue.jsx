
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
  cancelled: 'Cancelled',
}

function formatMoney(amount) {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function StaffOrderQueue({ onNavigate }) {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const updating = useRef(false)

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
    loadOrders(controller.signal)

    return () => controller.abort()
  }, [loadOrders])

  async function handleStatusUpdate(order) {
    const next = nextStatus[order.status]

    if (!next || updating.current) return

    updating.current = true
    setUpdatingId(order.order_id)
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
          {visibleOrders.map((order) => (
            <article className="staff-queue-card" key={order.order_id}>
              <div className="staff-queue-card-header">
                <div>
                  <h2>Queue #{order.queue_number}</h2>
                  <p>Order #{order.order_id}</p>
                  <p>
                    {order.order_date}
                    {order.ordered_at && ` · ${order.ordered_at.slice(11, 16)}`}
                  </p>
                </div>

                <span className={`staff-queue-status status-${order.status}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </div>

              <div className="staff-queue-items">
                {order.items.map((item, index) => (
                  <div key={`${item.menu_item_id}-${index}`}>
                    <span>{item.quantity} × {item.name}</span>
                    <strong>{formatMoney(item.subtotal)}</strong>
                  </div>
                ))}
              </div>

              <div className="staff-queue-card-footer">
                <div>
                  <span>Order total</span>
                  <strong>{formatMoney(order.total_amount)}</strong>
                </div>

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
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
