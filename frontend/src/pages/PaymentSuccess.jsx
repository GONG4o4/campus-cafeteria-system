import { useEffect, useState, useRef } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import { getOrders, verifyPayment } from '../ordersApi'
import { formatMoney } from '../utils/orders'
import PickupReminder from '../components/checkout/PickupReminder'
import { getPickupLabel } from '../utils/pickup'

export default function PaymentSuccess({ onNavigate }) {
  const queryParams = new URLSearchParams(window.location.search)
  const orderId = queryParams.get('order_id')

  const [status, setStatus] = useState(() => (orderId ? 'checking' : 'error'))
  const [order, setOrder] = useState(null)
  const [errorMsg, setErrorMsg] = useState(() => (orderId ? '' : 'No order ID was provided.'))
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    if (!orderId) {
      return
    }

    let attempts = 0
    const maxAttempts = 15
    let timeoutId

    async function checkPayment() {
      if (!isMounted.current) return

      try {
        // Ask HitPay (through our backend) if the payment went through.
        // If this fails we still keep polling, since the webhook may finish it.
        try {
          await verifyPayment(orderId)
        } catch (verifyError) {
          console.error(verifyError)
        }

        const data = await getOrders(orderId)
        
        if (!isMounted.current) return

        if (data.paymentStatus === 'paid') {
          setOrder(data)
          setStatus('paid')
          return
        }

        attempts += 1
        if (attempts >= maxAttempts) {
          setOrder(data)
          setStatus('timeout')
          return
        }

        timeoutId = setTimeout(checkPayment, 2000)
      } catch (error) {
        if (isMounted.current) {
          setStatus('error')
          setErrorMsg(error.message || 'Unable to verify payment status.')
        }
      }
    }

    checkPayment()

    return () => {
      isMounted.current = false
      clearTimeout(timeoutId)
    }
  }, [orderId])

  return (
    <main className="student-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      {status === 'checking' && (
        <div style={{ textAlign: 'center' }}>
          <Loading>Confirming your payment...</Loading>
          <p style={{ color: '#686868', marginTop: '12px' }}>Please wait while we verify this with HitPay.</p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <Alert error>{errorMsg}</Alert>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <Button onClick={() => onNavigate('orders')}>Check Order History</Button>
            <Button variant="secondary" onClick={() => onNavigate('menu')}>Back to Menu</Button>
          </div>
        </div>
      )}

      {status === 'timeout' && (
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h1>Payment Processing</h1>
          <p style={{ color: '#686868', marginBottom: '20px' }}>
            Your payment is taking a bit longer than usual to confirm. 
            If you completed the payment, it will appear in your order history shortly.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Button onClick={() => onNavigate('orders')}>Check Order History</Button>
            <Button variant="secondary" onClick={() => onNavigate('menu')}>Back to Menu</Button>
          </div>
        </div>
      )}

      {status === 'paid' && order && (
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ color: '#547409', marginBottom: '16px' }}>Payment Successful!</h1>
          <p style={{ fontSize: '18px', marginBottom: '24px' }}>
            Your order has been confirmed and sent to the kitchen.
          </p>
          
          <div style={{ padding: '24px', backgroundColor: '#f8f2e5', border: '1px solid #e4e4e4', borderRadius: '8px', marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Your Queue Number</h2>
            <strong style={{ display: 'block', fontSize: '48px', color: '#ac080c' }}>
              {order.queueNumber}
            </strong>
          </div>

          <p>Total Paid: <strong>{formatMoney(order.total)}</strong></p>
          <p>Pickup: <strong>{getPickupLabel(order.pickupType, order.scheduledPickupAt)}</strong></p>

          <PickupReminder compact queueNumber={order.queueNumber} />

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '24px' }}>
            <Button onClick={() => onNavigate('orders')}>View Order</Button>
            <Button variant="secondary" onClick={() => onNavigate('menu')}>Back to Menu</Button>
          </div>
        </div>
      )}
    </main>
  )
}