import Button from '../components/ui/Button'

export default function StaffOrderQueue({ onNavigate }) {
  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Order queue</h1>
          <p>Keep track of incoming orders and meals ready for pickup.</p>
        </div>
      </div>
      <div className="student-empty">
        <h2>Order updates are not available yet</h2>
        <p>
          We cannot show incoming orders here yet. Please use your cafeteria's
          current order list for now.
        </p>
        <Button variant="secondary" onClick={() => onNavigate('staff-dashboard')}>
          Back to dashboard
        </Button>
      </div>
    </main>
  )
}
