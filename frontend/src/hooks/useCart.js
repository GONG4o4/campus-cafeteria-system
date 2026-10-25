import { useState } from 'react'
import { getCartTotal, getCheckoutItems } from '../utils/cart'

export function useCart() {
  const [cart, setCart] = useState([])

  function addItem(item) {
    if (!item.is_available) {
      return
    }

    setCart((previous) => {
      const existing = previous.find((entry) => {
        return entry.menu_item_id === item.menu_item_id
      })

      if (existing) {
        return previous.map((entry) => {
          if (entry.menu_item_id === item.menu_item_id) {
            return { ...entry, quantity: entry.quantity + 1 }
          }

          return entry
        })
      }

      return [...previous, { ...item, quantity: 1 }]
    })
  }

  function changeQuantity(id, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return
    }

    setCart((previous) => {
      return previous.map((item) => {
        if (item.menu_item_id === id) {
          return { ...item, quantity }
        }

        return item
      })
    })
  }

  function removeItem(id) {
    setCart((previous) => {
      return previous.filter((item) => item.menu_item_id !== id)
    })
  }

  function clearCart() {
    setCart([])
  }

  return {
    cart,
    addItem,
    changeQuantity,
    removeItem,
    clearCart,
    itemCount: cart.reduce((count, item) => count + item.quantity, 0),
    total: getCartTotal(cart),
    checkoutItems: getCheckoutItems(cart),
  }
}
