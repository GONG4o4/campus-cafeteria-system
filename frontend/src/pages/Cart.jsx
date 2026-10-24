import Button from '../components/ui/Button'
import QuantitySelector from '../components/cart/QuantitySelector'
import { formatMoney } from '../utils/orders'
import { getSubtotal } from '../utils/cart'

export default function Cart({
  cart,
  total,
  onQuantityChange,
  onRemove,
  onClear,
  onNavigate,
}) {
  return (
    <main className="student-page">
      <div className="page-intro">
        <div>
          <h1>Your cart</h1>
          <p>Review your meals and adjust quantities before checkout.</p>
        </div>

        {cart.length > 0 && (
          <Button variant="secondary" onClick={onClear}>
            Clear cart
          </Button>
        )}
      </div>
      {cart.length === 0 ? (
        <div className="student-empty">
          <h2>Your cart is empty</h2>
          <p>Add a meal from the menu to get started.</p>
          <Button onClick={() => onNavigate('menu')}>
            Browse menu
          </Button>
        </div>
      ) : (
        <>
          <ul className="cart-list" aria-label="Cart items">
            {cart.map((item) => (
              <li className="cart-row" key={item.menu_item_id}>
                <div className="cart-meal">
                  <h2>{item.name}</h2>
                  <p>{formatMoney(item.price)} each</p>
                </div>

                <QuantitySelector
                  name={item.name}
                  quantity={item.quantity}
                  onChange={(quantity) => {
                    onQuantityChange(item.menu_item_id, quantity)
                  }}
                />

                <strong className="cart-subtotal">
                  {formatMoney(getSubtotal(item))}
                </strong>

                <Button
                  variant="text"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemove(item.menu_item_id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="cart-summary">
            <div>
              <span>Estimated total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <p>
              Prices and availability will be checked when your order is submitted.
            </p>
            <Button onClick={() => onNavigate('checkout')}>
              Continue to checkout
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
