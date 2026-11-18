import { useEffect, useState } from 'react'
import { Alert, Loading } from '../components/ui/Feedback'
import { getReports } from '../adminApi'
import { formatMoney } from '../utils/orders'
import './StaffMenu.css'
import './AdminDashboard.css'

const statusLabels = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
}

export default function AdminReports() {
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

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Reports</h1>
          <p>System-wide order and sales numbers.</p>
        </div>
      </div>

      {error && <Alert error>{error}</Alert>}
      {!report && !error && <Loading>Loading reports...</Loading>}

      {report && (
        <>
          <section aria-labelledby="orders-status-heading">
            <h2 id="orders-status-heading">Orders by status</h2>
            <div className="admin-cards">
              {Object.keys(statusLabels).map((key) => (
                <article className="staff-count" key={key}>
                  <h3>{statusLabels[key]}</h3>
                  <p className="staff-count-value">{report.orders[key]}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="sales-heading">
            <h2 id="sales-heading">Sales</h2>
            <div className="admin-cards">
              <article className="staff-count">
                <h3>All orders (excluding cancelled)</h3>
                <p className="staff-count-value">{formatMoney(report.orders.total_sales)}</p>
              </article>
              <article className="staff-count">
                <h3>Completed (picked up)</h3>
                <p className="staff-count-value">{formatMoney(report.orders.completed_sales)}</p>
              </article>
              <article className="staff-count">
                <h3>Inactive accounts</h3>
                <p className="staff-count-value">{report.users.inactive_users}</p>
              </article>
            </div>
          </section>

          <section aria-labelledby="daily-heading">
            <h2 id="daily-heading">Last 7 days</h2>
            <div className="staff-menu-table-wrap">
              <table className="staff-menu-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Orders</th>
                    <th scope="col">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily_sales.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{day.orders}</td>
                      <td>{formatMoney(day.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.daily_sales.length === 0 && (
                <p className="staff-menu-note admin-empty">No orders in the last 7 days.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="top-heading">
            <h2 id="top-heading">Top meals</h2>
            <div className="staff-menu-table-wrap">
              <table className="staff-menu-table">
                <thead>
                  <tr>
                    <th scope="col">Meal</th>
                    <th scope="col">Quantity sold</th>
                    <th scope="col">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {report.top_items.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.top_items.length === 0 && (
                <p className="staff-menu-note admin-empty">No meals sold yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
