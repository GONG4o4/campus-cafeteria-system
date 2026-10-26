function formatMeal(meal) {
  return {
    id: meal.menu_item_id,
    name: meal.name,
    description: meal.description ?? '',
    price: Number(meal.price),
    available: Boolean(meal.is_available),
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

  if (!Array.isArray(data)) {
    throw new Error('The menu service returned an invalid menu list.')
  }

  return data.map(formatMeal)
}