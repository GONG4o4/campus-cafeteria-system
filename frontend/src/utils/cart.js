export function getSubtotal(item) {
  const priceInCents = Math.round(Number(item.price) * 100)
  const subtotalInCents = priceInCents * item.quantity

  return subtotalInCents / 100
}

export function getCartTotal(cart) {
  let totalInCents = 0

  for (const item of cart) {
    totalInCents += Math.round(getSubtotal(item) * 100)
  }

  return totalInCents / 100
}

export function getCheckoutItems(cart) {
  return cart.map((item) => ({
    menu_item_id: item.menu_item_id,
    quantity: item.quantity,
  }))
}
