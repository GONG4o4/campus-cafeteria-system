import SalesStats from '../components/SalesStats'

export default function StaffDailySummary() {
  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Sales statistics</h1>
          <p>See daily, weekly, monthly and yearly sales, trends and top orders.</p>
        </div>
      </div>

      <SalesStats />
    </main>
  )
}
