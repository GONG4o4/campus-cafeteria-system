import { getMealErrors } from './utils/menu.js'

function isValidMeal(meal) {
  return (
    Number.isInteger(meal?.menu_item_id) &&
    meal.menu_item_id > 0 &&
    typeof meal.name === 'string' &&
    (meal.description == null || typeof meal.description === 'string') &&
    meal.price != null &&
    Number.isFinite(Number(meal.price)) &&
    Number(meal.price) >= 0 &&
    typeof meal.is_available === 'boolean' &&
    (meal.image_url == null || typeof meal.image_url === 'string')
  )
}

function formatMeal(meal) {
  return {
    id: meal.menu_item_id,
    name: meal.name,
    description: meal.description ?? '',
    price: Number(meal.price),
    available: Boolean(meal.is_available),
    imageUrl: meal.image_url ?? '',
  }
}

export async function getMenu(signal) {
  let response

  try {
    response = await fetch('http://localhost:3000/api/menu', { signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error

    throw new Error(
      'Unable to connect to the backend. Make sure it is running.',
      { cause: error },
    )
  }

  let data

  try {
    data = await response.json()
  } catch (error) {
    throw new Error('The menu service returned an unreadable response.', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load the menu. Please try again.')
  }

  if (!Array.isArray(data) || data.some((meal) => !isValidMeal(meal))) {
    throw new Error('The menu service returned an invalid menu list.')
  }

  return data.map(formatMeal)
}

export async function saveMeal(meal, id) {
  const errors = getMealErrors(meal)

  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0])
  }

  if (id != null && (!Number.isInteger(id) || id < 1)) {
    throw new Error('This meal has an invalid ID. Refresh the menu and try again.')
  }

  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please sign in before changing the menu.')
  }

  let url = 'http://localhost:3000/api/menu'

  if (id != null) {
    url += `/${id}`
  }

  let response

  try {
    response = await fetch(url, {
      method: id == null ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: meal.name.trim(),
        description: meal.description?.trim() || null,
        price: String(meal.price).trim(),
        is_available: meal.available,
        image_url: meal.imageUrl?.trim() || null,
      }),
    })
  } catch (cause) {
    const error = new Error(
      'We could not confirm whether the meal was saved. Refresh the menu and check it before trying again.',
      { cause },
    )
    error.saveStatusUnknown = true
    throw error
  }

  if (response.status === 401) {
    throw new Error('Your session has expired. Please sign in again.')
  }

  if (response.status === 403) {
    throw new Error('Only cafeteria staff can change the menu.')
  }

  let data

  try {
    data = await response.json()
  } catch (cause) {
    const error = new Error(
      'The menu service returned an unreadable response. Refresh the menu before trying again.',
      { cause },
    )
    error.saveStatusUnknown = true
    throw error
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to save the meal. Please try again.')
  }

  if (
    response.status !== (id == null ? 201 : 200) ||
    !isValidMeal(data?.item) ||
    (id != null && data.item.menu_item_id !== id)
  ) {
    const error = new Error(
      'The saved meal could not be confirmed. Refresh the menu before trying again.',
    )
    error.saveStatusUnknown = true
    throw error
  }

  return formatMeal(data.item)
}

export async function deleteMeal(id) {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('This meal has an invalid ID. Refresh the menu and try again.')
  }

  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please sign in before changing the menu.')
  }

  let response

  try {
    response = await fetch(`http://localhost:3000/api/menu/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (cause) {
    const error = new Error(
      'We could not confirm whether the meal was deleted. Refresh the menu and check it before trying again.',
      { cause },
    )
    error.saveStatusUnknown = true
    throw error
  }

  if (response.status === 401) {
    throw new Error('Your session has expired. Please sign in again.')
  }

  if (response.status === 403) {
    throw new Error('Only cafeteria staff can change the menu.')
  }

  if (response.status === 409) {
    throw new Error(
      'This meal is part of past orders, so it cannot be deleted. Mark it unavailable instead.',
    )
  }

  let data

  try {
    data = await response.json()
  } catch (cause) {
    const error = new Error(
      'The menu service returned an unreadable response. Refresh the menu before trying again.',
      { cause },
    )
    error.saveStatusUnknown = true
    throw error
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to delete the meal. Please try again.')
  }

  if (data?.item?.menu_item_id !== id) {
    const error = new Error(
      'The deleted meal could not be confirmed. Refresh the menu before trying again.',
    )
    error.saveStatusUnknown = true
    throw error
  }

  return id
}

export function notifyMenuChanged() {
  window.dispatchEvent(new Event('menu-updated'))

  try {
    localStorage.setItem('menu-updated-at', String(Date.now()))
  } catch {
    return
  }
}
