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

  if (typeof meal.available !== 'boolean') {
    errors.available = 'Choose whether the meal is available.'
  }

  return errors
}
