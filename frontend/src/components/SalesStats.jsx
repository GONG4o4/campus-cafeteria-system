import { useEffect, useState } from 'react'
import Button from './ui/Button'
import { Alert, Loading } from './ui/Feedback'
import { getSalesStats } from '../requestApi'
import { formatMoney } from '../utils/orders'
import './SalesStats.css'

const periods = [
  { key: 'day', label: 'Daily', current: 'Today', previous: 'yesterday' },
  { key: 'week', label: 'Weekly', current: 'This week', previous: 'last week' },
  { key: 'month', label: 'Monthly', current: 'This month', previous: 'last month' },
  { key: 'year', label: 'Yearly', current: 'This year', previous: 'last year' },
]

// "2026-11-28" -> short label for the chart, based on the period.
function getBarLabel(startDate, period) {
  const date = new Date(`${startDate}T00:00:00`)

  if (period === 'year') return String(date.getFullYear())
  if (period === 'month') return date.toLocaleDateString('en-PH', { month: 'short' })

  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// Full label for the tooltip and screen readers.
function getFullLabel(startDate, period) {
  const date = new Date(`${startDate}T00:00:00`)

  if (period === 'year') return String(date.getFullYear())
  if (period === 'month') return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  if (period === 'week') return `Week of ${date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`

  return date.toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

// Percent change compared with the previous period.
function getChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? { text: 'New', up: true } : { text: 'No change', up: null }
  }

  const percent = Math.round(((current - previous) / previous) * 100)

  if (percent === 0) return { text: 'No change', up: null }

  return { text: `${percent > 0 ? '+' : ''}${percent}%`, up: percent > 0 }
}

function ChangeTag({ current, previous, periodInfo }) {
  const change = getChange(current, previous)
  let className = 'stats-change'

  if (change.up === true) className += ' stats-change--up'
  if (change.up === false) className += ' stats-change--down'

  return (
    <p className={className}>
      <strong>{change.up === true ? '▲ ' : ''}{change.up === false ? '▼ ' : ''}{change.text}</strong>
      {' '}vs {periodInfo.previous}
    </p>
  )
}

export default function SalesStats() {
  const [period, setPeriod] = useState('day')
  const [metric, setMetric] = useState('sales')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setLoading(true)
      setError('')

      try {
        const data = await getSalesStats(period)
        if (!cancelled) setStats(data)
      } catch (requestError) {
        if (!cancelled) setError(requestError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [period, reload])

  const periodInfo = periods.find((item) => item.key === period)

  // Tallest bar = 100%. Use 1 so an all-zero chart does not divide by zero.
  let highest = 1

  if (stats) {
    for (const row of stats.trend) {
      if (row[metric] > highest) highest = row[metric]
    }
  }

  return (
    <section className="sales-stats" aria-labelledby="sales-stats-heading">
      <div className="stats-toolbar">
        <h2 id="sales-stats-heading">Statistics and trends</h2>

        <div className="stats-tabs" role="group" aria-label="Choose a period">
          {periods.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={period === item.key}
              onClick={() => setPeriod(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert error>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => setReload(reload + 1)}>
            Try again
          </Button>
        </Alert>
      )}

      {!stats && loading && <Loading>Loading statistics...</Loading>}

      {stats && (
        <div className={loading ? 'stats-body stats-body--loading' : 'stats-body'}>
          <div className="stats-cards">
            <article className="stats-card">
              <h3>{periodInfo.current}: sales</h3>
              <p className="stats-value">{formatMoney(stats.current.sales)}</p>
              <ChangeTag current={stats.current.sales} previous={stats.previous.sales} periodInfo={periodInfo} />
            </article>

            <article className="stats-card">
              <h3>{periodInfo.current}: orders</h3>
              <p className="stats-value">{stats.current.orders}</p>
              <ChangeTag current={stats.current.orders} previous={stats.previous.orders} periodInfo={periodInfo} />
            </article>

            <article className="stats-card">
              <h3>Picked up</h3>
              <p className="stats-value">{stats.current.completed}</p>
              <p className="stats-change">of {stats.current.orders} orders</p>
            </article>

            <article className="stats-card">
              <h3>Average order</h3>
              <p className="stats-value">{formatMoney(stats.current.average)}</p>
              <p className="stats-change">per order</p>
            </article>
          </div>

          <div className="stats-panels">
            <article className="stats-panel">
              <div className="stats-panel-heading">
                <h3>Trend</h3>
                <div className="stats-metric" role="group" aria-label="Chart shows">
                  <button
                    type="button"
                    aria-pressed={metric === 'sales'}
                    onClick={() => setMetric('sales')}
                  >
                    Sales
                  </button>
                  <button
                    type="button"
                    aria-pressed={metric === 'orders'}
                    onClick={() => setMetric('orders')}
                  >
                    Orders
                  </button>
                </div>
              </div>

              <div className="stats-chart-scroll">
                <ol className="stats-chart" aria-label={`${metric === 'sales' ? 'Sales' : 'Orders'} trend`}>
                  {stats.trend.map((row, index) => {
                    const value = row[metric]
                    const height = Math.max((value / highest) * 100, value > 0 ? 3 : 0)
                    const isCurrent = index === stats.trend.length - 1
                    const shownValue = metric === 'sales' ? formatMoney(value) : `${value} orders`

                    return (
                      <li key={row.start_date} title={`${getFullLabel(row.start_date, period)}: ${shownValue}`}>
                        <span className="sr-only">{getFullLabel(row.start_date, period)}: {shownValue}</span>
                        <div className="stats-bar-track" aria-hidden="true">
                          <div
                            className={isCurrent ? 'stats-bar stats-bar--current' : 'stats-bar'}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="stats-bar-label" aria-hidden="true">
                          {getBarLabel(row.start_date, period)}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </article>

            <article className="stats-panel">
              <h3>Top orders: {periodInfo.current.toLowerCase()}</h3>

              {stats.top_items.length === 0 && (
                <p className="stats-empty">No meals sold yet in this period.</p>
              )}

              {stats.top_items.length > 0 && (
                <ol className="stats-top-list">
                  {stats.top_items.map((item, index) => (
                    <li key={item.menu_item_id}>
                      <span className="stats-rank">{index + 1}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.quantity} sold</span>
                      </div>
                      <span className="stats-top-sales">{formatMoney(item.sales)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          </div>
        </div>
      )}
    </section>
  )
}
