import { useEffect, useState } from 'react'
import { apiRequest } from '../requestApi'

function formatDateTime(value) {
  if (!value) return ''

  return new Date(value).toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(value) {
  if (!value) return ''

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Shows the customer a notice when they have no-show penalties.
// - Red: ordering is paused (active restriction).
// - Yellow: warning, they have some no-shows but can still order.
// Shows nothing for guests, staff, or customers with a clean record.
export default function PenaltyNotice() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let cancelled = false

    let user

    try {
      user = JSON.parse(localStorage.getItem('user'))
    } catch {
      user = null
    }

    // Only logged-in customers have a penalty status.
    if (!localStorage.getItem('token') || user?.role !== 'student') {
      return
    }

    apiRequest('/orders/penalty-status')
      .then((data) => {
        if (!cancelled) setStatus(data)
      })
      .catch(() => {
        // If it fails, just show nothing. Checkout still blocks restricted accounts.
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!status) {
    return null
  }

  const restriction = status.active_restriction
  const count = status.recent_no_show_count

  if (!restriction && count === 0) {
    return null
  }

  // Only the no-shows that still count toward the limit.
  const recentHistory = status.history.filter((item) => item.counts_toward_policy)

  return (
    <section
      className={restriction ? 'penalty-notice penalty-notice--restricted' : 'penalty-notice'}
      role={restriction ? 'alert' : 'status'}
      aria-labelledby="penalty-notice-title"
    >
      <span className="penalty-notice-icon" aria-hidden="true">
        {restriction ? '⛔' : '⚠️'}
      </span>

      <div>
        {restriction ? (
          <>
            <h2 id="penalty-notice-title">Ordering is paused on your account</h2>
            <p>
              You can't place new orders until <strong>{formatDateTime(restriction.ends_at)}</strong> because
              {' '}{count} {count === 1 ? 'order was' : 'orders were'} not picked up in the last
              {' '}{status.offense_window_days} days. You can still browse the menu.
            </p>
          </>
        ) : (
          <>
            <h2 id="penalty-notice-title">Please pick up your orders on time</h2>
            <p>
              You have <strong>{count} of {status.offense_threshold}</strong> allowed no-shows in the
              last {status.offense_window_days} days. If you reach {status.offense_threshold}, ordering
              will be paused for {status.restriction_days} days.
            </p>
          </>
        )}

        {recentHistory.length > 0 && (
          <details className="penalty-notice-details">
            <summary>See uncollected orders</summary>
            <ul>
              {recentHistory.map((item) => (
                <li key={item.no_show_id}>
                  Queue #{item.queue_number} on {formatDate(item.order_date)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
