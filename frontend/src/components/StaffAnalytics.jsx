import { useEffect, useState } from 'react'
import Button from './ui/Button'
import { Alert, Loading } from './ui/Feedback'
import { getStaffAnalytics } from '../analyticsApi'

const statusLabels = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  return new Date(value + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatHour(hour) {
  const suffix = hour < 12 ? 'AM' : 'PM'
  let shown = hour % 12

  if (shown === 0) {
    shown = 12
  }

  return `${shown}:00 ${suffix}`
}

function getPercent(count, highest) {
  if (highest === 0) {
    return 0
  }

  return Math.round((count / highest) * 100)
}

export default function StaffAnalytics({ today, refreshKey }) {
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const datesAreValid = startDate !== '' && endDate !== '' && startDate <= endDate

  useEffect(() => {
    if (!datesAreValid) {
      return
    }

    const controller = new AbortController()

    async function loadReport() {
      setLoading(true)
      setError('')

      try {
        const data = await getStaffAnalytics(startDate, endDate, controller.signal)
        setReport(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load analytics.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadReport()

    return () => controller.abort()
  }, [startDate, endDate, datesAreValid, refreshKey])

  function showToday() {
    setStartDate(today)
    setEndDate(today)
  }

  let periodText = ''

  if (report) {
    if (report.period.startDate === report.period.endDate) {
      periodText = formatDate(report.period.startDate)
    } else {
      periodText =
        formatDate(report.period.startDate) + ' to ' + formatDate(report.period.endDate)
    }
  }

  let highestStatus = 0
  let highestHour = 0

  if (report) {
    for (const item of report.ordersByStatus) {
      if (item.count > highestStatus) highestStatus = item.count
    }

    for (const item of report.ordersByHour) {
      if (item.count > highestHour) highestHour = item.count
    }
  }

  return (
    <section aria-labelledby="staff-analytics-heading">
      <h2 id="staff-analytics-heading">Sales insights</h2>

      <div className="analytics-filters">
        <div className="analytics-field">
          <label htmlFor="analytics-start">Start date</label>
          <input
            id="analytics-start"
            type="date"
            value={startDate}
            max={today}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="analytics-field">
          <label htmlFor="analytics-end">End date</label>
          <input
            id="analytics-end"
            type="date"
            value={endDate}
            max={today}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>

        <Button variant="secondary" onClick={showToday}>
          Today
        </Button>
      </div>

      {!datesAreValid && (
        <Alert error>Choose a start date that is on or before the end date.</Alert>
      )}

      {datesAreValid && error && <Alert error>{error}</Alert>}

      {datesAreValid && !error && loading && !report && (
        <Loading>Loading sales insights...</Loading>
      )}

      {datesAreValid && !error && report && (
        <>
          <p className="analytics-period">
            Showing: <strong>{periodText}</strong>
            {loading && <span> (updating...)</span>}
          </p>

          <div className="analytics-cards">
            <article className="staff-count">
              <h3>Order value</h3>
              <p className="staff-count-value">{formatPeso(report.summary.orderValue)}</p>
              <p>Non-cancelled orders</p>
            </article>

            <article className="staff-count">
              <h3>Total orders</h3>
              <p className="staff-count-value">{report.summary.totalOrders}</p>
              <p>All orders placed</p>
            </article>

            <article className="staff-count">
              <h3>Cancelled orders</h3>
              <p className="staff-count-value">{report.summary.cancelledOrders}</p>
              <p>Not counted in order value</p>
            </article>

            <article className="staff-count">
              <h3>Average order value</h3>
              <p className="staff-count-value">{formatPeso(report.summary.averageOrderValue)}</p>
              <p>Per non-cancelled order</p>
            </article>
          </div>

          {report.summary.totalOrders === 0 ? (
            <div className="student-empty">
              <h3>No orders for this period</h3>
              <p>Try picking another date to see sales insights.</p>
            </div>
          ) : (
            <div className="analytics-panels">
              <article className="analytics-panel">
                <h3>Top 5 most ordered dishes</h3>

                {report.topDishes.length === 0 ? (
                  <p className="analytics-note">No dishes from non-cancelled orders.</p>
                ) : (
                  <ol className="analytics-dishes">
                    {report.topDishes.map((dish) => (
                      <li key={dish.menuItemId}>
                        <span className="analytics-dish-name">{dish.name}</span>
                        <span className="analytics-dish-info">
                          {dish.totalQuantity} ordered · {dish.orderCount} orders ·{' '}
                          {formatPeso(dish.orderValue)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </article>

              <article className="analytics-panel">
                <h3>Orders by status</h3>

                {report.ordersByStatus.map((item) => (
                  <div className="analytics-bar-row" key={item.status}>
                    <span className="analytics-bar-label">{statusLabels[item.status]}</span>
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar"
                        style={{ width: getPercent(item.count, highestStatus) + '%' }}
                      />
                    </div>
                    <span className="analytics-bar-count">{item.count}</span>
                  </div>
                ))}
              </article>

              <article className="analytics-panel">
                <h3>Orders by hour</h3>

                {report.ordersByHour.map((item) => (
                  <div className="analytics-bar-row" key={item.hour}>
                    <span className="analytics-bar-label">{formatHour(item.hour)}</span>
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar"
                        style={{ width: getPercent(item.count, highestHour) + '%' }}
                      />
                    </div>
                    <span className="analytics-bar-count">{item.count}</span>
                  </div>
                ))}

                <p className="analytics-note">Times are in Philippine time.</p>
              </article>
            </div>
          )}
        </>
      )}
    </section>
  )
}
