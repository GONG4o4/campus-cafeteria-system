import Button from '../components/ui/Button'

export default function StaffDailySummary({ onNavigate }) {
  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Daily summary</h1>
          <p>A place to check how the cafeteria did today.</p>
        </div>
      </div>
      <div className="student-empty">
        <h2>The daily summary is not available yet</h2>
        <p>Daily order totals will appear here once the summary is ready.</p>
        <Button variant="secondary" onClick={() => onNavigate('staff-dashboard')}>
          Back to dashboard
        </Button>
      </div>
    </main>
  )
}
