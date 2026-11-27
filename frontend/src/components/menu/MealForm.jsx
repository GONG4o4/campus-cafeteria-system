import { useState } from 'react'
import Button from '../ui/Button'
import { Alert } from '../ui/Feedback'
import MealImage from './MealImage'
import { categories, getMealErrors, isValidImageUrl } from '../../utils/menu'
import { uploadMealPhoto } from '../../menuApi'

export default function MealForm({ meal, onSave, onCancel, saving, error, blocked }) {
  const [name, setName] = useState(meal?.name || '')
  const [description, setDescription] = useState(meal?.description || '')
  const [price, setPrice] = useState(meal ? String(meal.price) : '')
  const [available, setAvailable] = useState(meal?.available ?? true)
  const [imageUrl, setImageUrl] = useState(meal?.imageUrl || '')
  const [category, setCategory] = useState(meal?.category || 'rice_meals')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [errors, setErrors] = useState({})

  // Only preview links that look valid, so we don't request half-typed URLs.
  let previewUrl = ''

  if (isValidImageUrl(imageUrl.trim())) {
    previewUrl = imageUrl.trim()
  }

  async function handlePhotoChange(event) {
    const file = event.target.files[0]

    // Clear the input so choosing the same file again still works.
    event.target.value = ''

    if (!file) {
      return
    }

    setUploadError('')
    setUploading(true)

    try {
      const link = await uploadMealPhoto(file)
      setImageUrl(link)
    } catch (requestError) {
      setUploadError(requestError.message)
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (saving || blocked || uploading) {
      return
    }

    const values = { name, description, price, available, imageUrl, category }
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

          <div className="meal-form-field">
            <label htmlFor="meal-category">Category</label>
            <select
              id="meal-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="meal-form-field">
            <span className="meal-form-label">Photo (optional)</span>
            <div className="meal-photo-upload">
              <label className="app-button app-button--secondary meal-photo-button">
                {uploading ? 'Uploading...' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={handlePhotoChange}
                />
              </label>
              <span className="meal-form-help">JPG, PNG or WebP, up to 2 MB.</span>
            </div>
            {uploadError && <p role="alert">{uploadError}</p>}
          </div>

          <div className="meal-form-field">
            <label htmlFor="meal-image-url">Or paste an image link (optional)</label>
            <input
              id="meal-image-url"
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/chicken-adobo.jpg"
              maxLength={500}
              aria-invalid={Boolean(errors.imageUrl)}
              aria-describedby={errors.imageUrl ? 'meal-image-url-error meal-image-url-help' : 'meal-image-url-help'}
            />
            <span id="meal-image-url-help" className="meal-form-help">
              Uploading a photo fills in this link for you. Leave it blank to show a placeholder.
            </span>
            {errors.imageUrl && <p id="meal-image-url-error" role="alert">{errors.imageUrl}</p>}
            <div className="meal-image-preview">
              <MealImage src={previewUrl} alt={`Preview of ${name.trim() || 'the meal'}`} />
            </div>
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
            <Button type="submit" disabled={saving || blocked || uploading}>
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
