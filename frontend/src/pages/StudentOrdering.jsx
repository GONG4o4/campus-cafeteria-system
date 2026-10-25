import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../authApi.js'
import { formatMoney, getOrderTotal } from '../utils/orders'
import './StudentOrdering.css'

function PageHeading({ eyebrow, title, description }) {
  return (
    <header className="student-page-heading">
      {eyebrow && <p className="student-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="student-page-description">{description}</p>}
    </header>
  )
}

function OrderSummary({ items, total }) {
  return (
    <div className="demo-order-summary">
      {items.map((item) => (
        <div className="demo-summary-row" key={item.id}>
          <span>
            {item.quantity} × {item.name}
          </span>
          <strong>{formatMoney(item.price * item.quantity)}</strong>
        </div>
      ))}
      <div className="demo-summary-total">
        <span>Total</span>
        <strong>{formatMoney(total)}</strong>
      </div>
    </div>
  )
}

function DemoNotice() {
  return (
    <p className="demo-notice" role="note">
      Demo only. Orders are not sent to the cafeteria or saved after you leave
      this session.
    </p>
  )
}

export default function StudentOrdering({
  page,
  cart,
  setCart,
  onNavigate,
  onPlaceOrder,
  lastOrder,
}) {
  const [menuItems, setMenuItems] = useState([])
  const [menuStatus, setMenuStatus] = useState('idle')
  const [menuError, setMenuError] = useState('')
  const [menuReloadKey, setMenuReloadKey] = useState(0)

  useEffect(() => {
    if (page !== 'menu') return undefined

    const controller = new AbortController()

    async function loadMenu() {
      setMenuStatus('loading')
      setMenuError('')

      try {
        const response = await fetch(`${API_BASE_URL}/api/menu`, {
          signal: controller.signal,
        })
        let body

        try {
          body = await response.json()
        } catch {
          throw new Error('The menu service returned an unreadable response.')
        }

        if (!response.ok) {
          throw new Error(
            body?.message || `Unable to load the menu (HTTP ${response.status}).`,
          )
        }

        if (!Array.isArray(body)) {
          throw new Error('The menu service returned an invalid menu.')
        }

        setMenuItems(body)
        setMenuStatus('loaded')
      } catch (error) {
        if (error.name === 'AbortError') return
        setMenuError(
          error.message ||
            'Unable to load the menu. Check that the backend is running and try again.',
        )
        setMenuStatus('error')
      }
    }

    loadMenu()

    return () => controller.abort()
  }, [page, menuReloadKey])

  const cartItems = Object.values(cart)
  const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0)
  const total = cartItems.reduce(
    (amount, item) => amount + item.price * item.quantity,
    0,
  )

  const updateQuantity = (item, change) => {
    setCart((currentCart) => {
      const quantity = (currentCart[item.id]?.quantity || 0) + change
      const nextCart = { ...currentCart }

      if (quantity <= 0) {
        delete nextCart[item.id]
      } else {
        nextCart[item.id] = { ...item, quantity }
      }

      return nextCart
    })
  }

  if (page === 'menu') {
    const availableItems = menuItems.filter((item) => item.is_available)

    return (
      <div className="student-content ordering-page">
        <PageHeading
          eyebrow="Campus cafeteria"
          title="Today’s menu"
          description="Choose a meal and add it to your cart."
        />
        <DemoNotice />
        {menuStatus === 'loading' && (
          <p className="ordering-state" role="status">
            Loading the menu…
          </p>
        )}
        {menuStatus === 'error' && (
          <div className="ordering-state ordering-error" role="alert">
            <p>{menuError}</p>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setMenuReloadKey((key) => key + 1)}
            >
              Try again
            </button>
          </div>
        )}
        {menuStatus === 'loaded' && availableItems.length === 0 && (
          <div className="ordering-state">
            <h2>No meals are available right now</h2>
            <p>Please check back later.</p>
          </div>
        )}
        {menuStatus === 'loaded' && availableItems.length > 0 && (
          <div className="menu-grid">
            {availableItems.map((item) => (
              <article className="menu-card" key={item.menu_item_id}>
                <div className="menu-card-copy">
                  <h2>{item.name}</h2>
                  {item.description && <p>{item.description}</p>}
                </div>
                <div className="menu-card-footer">
                  <strong>{formatMoney(Number(item.price))}</strong>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() =>
                      updateQuantity(
                        {
                          id: item.menu_item_id,
                          name: item.name,
                          price: Number(item.price),
                        },
                        1,
                      )
                    }
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="menu-cart-bar">
          <span>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
            {formatMoney(total)}
          </span>
          <button
            className="button button-primary"
            type="button"
            disabled={itemCount === 0}
            onClick={() => onNavigate('cart')}
          >
            View cart
          </button>
        </div>
      </div>
    )
  }

  if (page === 'cart') {
    return (
      <div className="student-content ordering-page">
        <PageHeading
          title="Your cart"
          description="Check your items before continuing to checkout."
        />
        <DemoNotice />
        {cartItems.length === 0 ? (
          <div className="ordering-state">
            <h2>Your cart is empty</h2>
            <p>Add something from the menu to get started.</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => onNavigate('menu')}
            >
              Browse menu
            </button>
          </div>
        ) : (
          <div className="cart-panel">
            <ul className="cart-items">
              {cartItems.map((item) => (
                <li className="cart-item" key={item.id}>
                  <div className="cart-item-copy">
                    <h2>{item.name}</h2>
                    <p>{formatMoney(item.price)} each</p>
                  </div>
                  <div
                    className="quantity-control"
                    role="group"
                    aria-label={`${item.name} quantity`}
                  >
                    <button
                      className="quantity-button"
                      type="button"
                      aria-label={`Remove one ${item.name}`}
                      onClick={() => updateQuantity(item, -1)}
                    >
                      −
                    </button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button
                      className="quantity-button"
                      type="button"
                      aria-label={`Add one ${item.name}`}
                      onClick={() => updateQuantity(item, 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong className="cart-item-total">
                    {formatMoney(item.price * item.quantity)}
                  </strong>
                </li>
              ))}
            </ul>
            <div className="cart-total">
              <span>Order total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <div className="ordering-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onNavigate('menu')}
              >
                Back to menu
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => onNavigate('checkout')}
              >
                Continue to checkout
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (page === 'checkout') {
    return (
      <div className="student-content ordering-page">
        <PageHeading
          title="Review your order"
          description="This frontend demo does not submit a real cafeteria order."
        />
        <DemoNotice />
        {cartItems.length === 0 ? (
          <div className="ordering-state">
            <h2>There’s nothing to check out</h2>
            <p>Your cart is empty.</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => onNavigate('menu')}
            >
              Browse menu
            </button>
          </div>
        ) : (
          <div className="checkout-panel">
            <h2>Pickup and payment</h2>
            <p className="checkout-detail">
              Payment: pay at the counter
              <br />
              Pickup: cafeteria counter
            </p>
            <OrderSummary items={cartItems} total={total} />
            <div className="ordering-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onNavigate('cart')}
              >
                Back to cart
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => onPlaceOrder(cartItems)}
              >
                Place demo order
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (page === 'confirmation') {
    return (
      <div className="student-content ordering-page">
        <PageHeading
          eyebrow="Demo confirmation"
          title={lastOrder ? 'Demo order placed' : 'No demo order to show'}
          description={
            lastOrder
              ? 'This confirmation is for this session only; the cafeteria has not received an order.'
              : 'Complete checkout to see a demo confirmation.'
          }
        />
        <DemoNotice />
        {lastOrder ? (
          <section className="confirmation-panel" aria-label="Demo order details">
            <div className="confirmation-reference">
              <span>Demo queue number</span>
              <strong>{lastOrder.queueNumber}</strong>
            </div>
            <OrderSummary
              items={lastOrder.items}
              total={getOrderTotal(lastOrder)}
            />
            <button
              className="button button-primary"
              type="button"
              onClick={() => onNavigate('orders')}
            >
              View order history
            </button>
          </section>
        ) : (
          <button
            className="button button-primary"
            type="button"
            onClick={() => onNavigate('menu')}
          >
            Browse menu
          </button>
        )}
      </div>
    )
  }

  return null
}
