import { Alert } from '../components/ui/Feedback'

export default function StaffDashboard({ onNavigate }) {
  const statuses = ['Pending', 'Preparing', 'Ready for pickup']
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
      description: 'Find the daily order summary here once it is available.',
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
          <p>Welcome back. Here is where you can check the cafeteria for the day.</p>
        </div>
      </div>

      <section aria-labelledby="staff-orders-heading">
        <h2 id="staff-orders-heading">Orders at a glance</h2>
        <div className="staff-counts">
          {statuses.map((status) => (
            <article className="staff-count" key={status}>
              <h3>{status}</h3>
              <p className="staff-count-value" aria-label="Count unavailable">—</p>
              <p>Waiting for live order updates</p>
            </article>
          ))}
        </div>
        <Alert>
          Live order counts are not available yet. These cards will show the
          counts once order updates are connected.
        </Alert>
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
