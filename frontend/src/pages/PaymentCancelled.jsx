import Button from '../components/ui/Button'

export default function PaymentCancelled({ onNavigate }) {
  return (
    <main className="student-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        <h1 style={{ color: '#ac080c', marginBottom: '16px' }}>Payment Cancelled</h1>
        <p style={{ fontSize: '16px', color: '#686868', marginBottom: '24px' }}>
          Your payment was not completed. Your order has not been sent to the cafeteria kitchen, and you have not been charged.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button onClick={() => onNavigate('orders')}>View Order History</Button>
          <Button variant="secondary" onClick={() => onNavigate('menu')}>Back to Menu</Button>
        </div>
      </div>
    </main>
  )
}