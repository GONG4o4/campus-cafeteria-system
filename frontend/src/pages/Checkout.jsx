import { useRef, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Feedback'
import { formatMoney } from '../utils/orders'
import { getSubtotal } from '../utils/cart'
import { placeOrder } from '../checkoutApi'

export default function Checkout({
  cart,
  checkoutItems,
  total,
  onNavigate,
  onOrderPlaced,
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

    const token = localStorage.getItem('token')
    const selections = checkoutItems.map((item) => ({ ...item }))
    const selectedMeals = selections.map((selection) => {
      const meal = cart.find((item) => item.menu_item_id === selection.menu_item_id)

      return {
        menu_item_id: selection.menu_item_id,
        name: meal.name,
        quantity: selection.quantity,
      }
    })

    try {
      const result = await placeOrder(selections)
      const confirmedOrder = { ...result, items: selectedMeals }
      onOrderPlaced(confirmedOrder, selections, token)
    } catch (requestError) {
      setError(requestError.message || 'Unable to place your order.')
      setOrderStatusUnknown(Boolean(requestError.orderStatusUnknown))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <main className="student-page">
      <div className="page-intro">
        <div>
            <h1>Checkout</h1>
            <p>Check your meals, then place your order.</p>
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
            Your final total and queue number will be confirmed by the cafeteria.
          </p>

          <div className="checkout-actions">
            <Button
              onClick={handlePlaceOrder}
              disabled={loading || orderStatusUnknown}
            >
              {loading ? 'Placing order...' : 'Place order'}
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
