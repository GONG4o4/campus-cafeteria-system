import { useState } from 'react'
import Button from '../ui/Button'
import { Alert } from '../ui/Feedback'
import { getMealErrors } from '../../utils/menu'

export default function MealForm({ meal, onSave, onCancel, saving, error, blocked }) {
  const [name, setName] = useState(meal?.name || '')
  const [description, setDescription] = useState(meal?.description || '')
  const [price, setPrice] = useState(meal ? String(meal.price) : '')
  const [available, setAvailable] = useState(meal?.available ?? true)
  const [errors, setErrors] = useState({})

  function handleSubmit(event) {
    event.preventDefault()

    if (saving || blocked) {
      return
    }

    const values = { name, description, price, available }
    const validationErrors = getMealErrors(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    onSave(values)
  }

  return (
    <section className="meal-form-panel" aria-labelledby="meal-form-heading">
      <h2 id="meal-form-heading">{meal ? 'Edit meal' : 'Add a meal'}</h2>
      <p>Enter the meal details students will see on the menu.</p>
      {error && <Alert error>{error}</Alert>}

      <form className="meal-form" onSubmit={handleSubmit} noValidate>
        <fieldset disabled={saving}>
          <div className="meal-form-field">
            <label htmlFor="meal-name">Meal name</label>
            <input
              id="meal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              autoFocus
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'meal-name-error' : undefined}
            />
            {errors.name && <p id="meal-name-error" role="alert">{errors.name}</p>}
          </div>

          <div className="meal-form-field">
            <label htmlFor="meal-description">Description (optional)</label>
            <textarea
              id="meal-description"
              value={description}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="meal-form-field">
            <label htmlFor="meal-price">Price (₱)</label>
            <input
              id="meal-price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
              required
              aria-invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? 'meal-price-error' : undefined}
            />
            {errors.price && <p id="meal-price-error" role="alert">{errors.price}</p>}
          </div>

          <label className="meal-available-field">
            <input
              type="checkbox"
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
            />
            Available for students to order
          </label>

          <div className="staff-menu-actions">
            <Button type="submit" disabled={saving || blocked}>
              {saving ? 'Saving...' : 'Save meal'}
            </Button>
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
