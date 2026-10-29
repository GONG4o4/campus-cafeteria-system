
import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Feedback'

const statuses = [
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready for pickup' },
]

function getTodayInManila() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const date = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  )

  return `${date.year}-${date.month}-${date.day}`
}

export default function StaffDashboard({ onNavigate }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async (signal) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('Please log in as cafeteria staff.')
      }

      const response = await fetch(
        'http://localhost:3000/api/staff/orders',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load orders.')
      }

      if (!Array.isArray(data)) {
        throw new Error('Invalid order data received.')
      }

      if (!signal?.aborted) {
        setOrders(data)
        setError('')
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err.message || 'Unable to connect to the backend.')
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

    const interval = setInterval(() => {
      loadOrders(controller.signal)
    }, 10000)

    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [loadOrders])

  const today = getTodayInManila()

  const todaysOrders = orders.filter(
    (order) => order.order_date === today
  )

  const tasks = [
    {
      title: 'Order queue',
      description: 'Check incoming orders and see what needs preparing.',
      page: 'staff-orders',
      path: '/staff/orders',
      label: 'Open order queue',
    },
    {
      title: 'Menu management',
      description: 'Check the meals, prices, and availability on your menu.',
      page: 'staff-menu',
      path: '/staff/menu',
      label: 'View menu',
    },
    {
      title: 'Daily summary',
      description: 'View the cafeteria daily summary.',
      page: 'staff-summary',
      path: '/staff/summary',
      label: 'View daily summary',
    },
  ]

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Staff dashboard</h1>
          <p>
            Welcome back. Here is where you can check
            the cafeteria for the day.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => loadOrders()}
        >
          Refresh dashboard
        </Button>
      </div>

      <section aria-labelledby="staff-orders-heading">
        <h2 id="staff-orders-heading">Orders at a glance</h2>

        <div className="staff-counts">
          {statuses.map((status) => {
            const count = todaysOrders.filter(
              (order) => order.status === status.key
            ).length

            return (
              <article className="staff-count" key={status.key}>
                <h3>{status.label}</h3>

                <p className="staff-count-value">
                  {loading ? '...' : count}
                </p>

                <p>Orders today</p>
              </article>
            )
          })}
        </div>

        {error ? (
          <Alert error>{error}</Alert>
        ) : (
          <Alert>
            Showing cafeteria orders for {today}.
            Counts refresh automatically every 10 seconds.
          </Alert>
        )}
      </section>

      <section aria-labelledby="staff-tasks-heading">
        <h2 id="staff-tasks-heading">What do you need to do?</h2>

        <div className="staff-tasks">
          {tasks.map((task) => (
            <article className="staff-task" key={task.page}>
              <h3>{task.title}</h3>
              <p>{task.description}</p>

              <a
                className="app-button app-button--secondary"
                href={task.path}
                onClick={(event) => {
                  event.preventDefault()
                  onNavigate(task.page)
                }}
              >
                {task.label}
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
