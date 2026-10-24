import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Feedback'
import { formatMoney } from '../utils/orders'
import { getSubtotal } from '../utils/cart'

export default function Checkout({ cart, checkoutItems, total, onNavigate }) {
  return (
    <main className="student-page">
      <div className="page-intro">
        <div>
          <h1>Checkout review</h1>
          <p>Check the meals selected in your cart.</p>
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

          <Alert>
            Your cart is ready for review. Order submission is not available yet,
            and no order has been placed.
          </Alert>

          <Button variant="secondary" onClick={() => onNavigate('cart')}>
            Back to cart
          </Button>
        </>
      )}
    </main>
  )
}
