import { useEffect, useState } from 'react'
import { Alert } from '../components/ui/Feedback'
import { getReports } from '../adminApi'
import { formatMoney } from '../utils/orders'
import './AdminDashboard.css'

export default function AdminOverview({ onNavigate }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    getReports()
      .then((data) => {
        if (!cancelled) setReport(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  let cards = []

  if (report) {
    cards = [
      { label: 'Total users', value: report.users.total_users },
      { label: 'Students', value: report.users.students },
      { label: 'Cafeteria staff', value: report.users.staff },
      { label: 'Total orders', value: report.orders.total_orders },
      { label: 'Sales (excluding cancelled)', value: formatMoney(report.orders.total_sales) },
      { label: 'Completed sales', value: formatMoney(report.orders.completed_sales) },
    ]
  }

  const tasks = [
    { page: 'admin-users', path: '/admin/users', title: 'User management', text: 'Search users, change roles, and activate or deactivate accounts.' },
    { page: 'admin-staff', path: '/admin/staff', title: 'Staff management', text: 'Create new cafeteria staff accounts.' },
    { page: 'admin-audit', path: '/admin/audit-logs', title: 'Audit logs', text: 'Review important administrative actions.' },
  ]

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Super admin overview</h1>
          <p>A quick look at accounts, orders, and sales across the system.</p>
        </div>
      </div>

      {error && <Alert error>{error}</Alert>}

      <section aria-labelledby="admin-overview-heading">
        <h2 id="admin-overview-heading">System at a glance</h2>
        {!report && !error && <p className="app-loading">Loading...</p>}
        <div className="admin-cards">
          {cards.map((card) => (
            <article className="staff-count" key={card.label}>
              <h3>{card.label}</h3>
              <p className="staff-count-value">{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="admin-tasks-heading">
        <h2 id="admin-tasks-heading">What do you need to do?</h2>
        <div className="staff-tasks">
          {tasks.map((task) => (
            <article className="staff-task" key={task.page}>
              <h3>{task.title}</h3>
              <p>{task.text}</p>
              <a
                className="app-button app-button--secondary"
                href={task.path}
                onClick={(event) => {
                  event.preventDefault()
                  onNavigate(task.page)
                }}
              >
                Open
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
