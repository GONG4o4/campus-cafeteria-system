import { useRef, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Feedback'
import { formatMoney } from '../utils/orders'
import { getSubtotal } from '../utils/cart'
import { createCheckoutSession } from '../checkoutApi'

export default function Checkout({
  cart,
  checkoutItems,
  total,
  onNavigate,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orderStatusUnknown, setOrderStatusUnknown] = useState(false)
  const submitting = useRef(false)

  async function handlePlaceOrder() {
    if (submitting.current || checkoutItems.length === 0 || orderStatusUnknown) {
      return
    }

    submitting.current = true
    setLoading(true)
    setError('')

    try {
      const result = await createCheckoutSession(checkoutItems)
      window.location.href = result.checkout_url
    } catch (requestError) {
      setError(requestError.message || 'Unable to place your order.')
      setOrderStatusUnknown(Boolean(requestError.orderStatusUnknown))
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <main className="student-page">
      <div className="page-intro">
        <div>
            <h1>Checkout</h1>
            <p>Check your meals, then continue to payment.</p>
        </div>
      </div>

      {checkoutItems.length === 0 ? (
        <div className="student-empty">
          <h2>Your cart is empty</h2>
          <p>Select meals before continuing to checkout.</p>
          <Button onClick={() => onNavigate('menu')}>
            Browse menu
          </Button>
        </div>
      ) : (
        <>
          <ul className="checkout-list" aria-label="Checkout items">
            {checkoutItems.map((selection) => {
              const item = cart.find((meal) => {
                return meal.menu_item_id === selection.menu_item_id
              })

              return (
                <li key={selection.menu_item_id}>
                  <span>{selection.quantity} Ã— {item.name}</span>
                  <strong>{formatMoney(getSubtotal(item))}</strong>
                </li>
              )
            })}
          </ul>
          <div className="cart-summary">
            <div>
              <span>Estimated total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>

          {error && <Alert error>{error}</Alert>}

          <p className="checkout-note">
            You will be redirected to HitPay to complete your payment securely. 
            Your final total and queue number will be confirmed after the payment is verified.
          </p>

          <div className="checkout-actions">
            <Button
              onClick={handlePlaceOrder}
              disabled={loading || orderStatusUnknown}
            >
              {loading ? 'Redirecting to payment...' : 'Continue to payment'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onNavigate('cart')}
              disabled={loading}
            >
              Back to cart
            </Button>
            {orderStatusUnknown && (
              <Button variant="secondary" onClick={() => onNavigate('orders')}>
                Check order history
              </Button>
            )}
          </div>
        </>
      )}
    </main>
  )
}