// Menu categories. Keep in sync with backend/routes/menu.js and migration 007.
export const categories = [
  { value: 'rice_meals', label: 'Rice Meals' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'desserts', label: 'Desserts' },
]

export function getCategoryLabel(value) {
  const category = categories.find((item) => item.value === value)
  return category ? category.label : 'Rice Meals'
}

// Checks that the text is a full http:// or https:// link (max 500 characters).
export function isValidImageUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 500) {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getMealErrors(meal) {
  const errors = {}
  const name = typeof meal.name === 'string' ? meal.name.trim() : ''

  if (!name) {
    errors.name = 'Enter a meal name.'
  } else if (name.length > 100) {
    errors.name = 'Keep the meal name to 100 characters or fewer.'
  }

  if (meal.description != null && typeof meal.description !== 'string') {
    errors.description = 'Enter a description using text.'
  }

  if (
    !['string', 'number'].includes(typeof meal.price) ||
    !/^\d{1,8}(\.\d{1,2})?$/.test(String(meal.price).trim())
  ) {
    errors.price = 'Enter a price from 0 to 99,999,999.99, using up to two decimal places.'
  }

  if (meal.category != null && !categories.some((item) => item.value === meal.category)) {
    errors.category = 'Choose a category.'
  }

  if (typeof meal.available !== 'boolean') {
    errors.available = 'Choose whether the meal is available.'
  }

  // The image is optional, so only check it when something was typed.
  if (meal.imageUrl != null && typeof meal.imageUrl !== 'string') {
    errors.imageUrl = 'Enter the image link as text.'
  } else if (meal.imageUrl?.trim() && !isValidImageUrl(meal.imageUrl.trim())) {
    errors.imageUrl = 'Enter a full image link that starts with http:// or https:// (500 characters max).'
  }

  return errors
}
