import { useEffect, useRef, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Feedback'
import { formatMoney } from '../utils/orders'
import { getSubtotal } from '../utils/cart'
import { createCheckoutSession } from '../checkoutApi'
import { getNoShowPolicy } from '../noShowPolicyApi'
import { canPlaceOrder } from '../utils/noShowPolicy'
import NoShowNotice from '../components/checkout/NoShowNotice'

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
  const [acknowledged, setAcknowledged] = useState(false)
  const [policy, setPolicy] = useState(null)
  const [policyLoading, setPolicyLoading] = useState(true)

  // Load the real policy numbers so the warning matches the backend rules.
  // If it fails, the notice shows general wording instead.
  useEffect(() => {
    const controller = new AbortController()

    getNoShowPolicy(controller.signal)
      .then((data) => setPolicy(data))
      .catch(() => {
        if (!controller.signal.aborted) {
          setPolicy(null)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPolicyLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  const orderAllowed = canPlaceOrder({
    acknowledged,
    loading,
    orderStatusUnknown,
    itemCount: checkoutItems.length,
  })

  async function handlePlaceOrder() {
    if (submitting.current || !orderAllowed) {
      return
    }

    submitting.current = true
    setLoading(true)
    setError('')

    try {
      const result = await createCheckoutSession(checkoutItems, acknowledged)
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
                  <span>{selection.quantity} × {item.name}</span>
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

          <NoShowNotice
            policy={policy}
            loading={policyLoading}
            acknowledged={acknowledged}
            onAcknowledge={setAcknowledged}
            disabled={loading}
          />

          <div className="checkout-actions">
            <Button
              onClick={handlePlaceOrder}
              disabled={!orderAllowed}
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