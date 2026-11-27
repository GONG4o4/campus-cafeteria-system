import { useState } from 'react'

// Shows a meal photo with its own loading placeholder and fallback.
// If one image fails, only this box shows the fallback; the rest of the menu is not affected.
export default function MealImage({ src, alt, small = false }) {
  const [loadedSrc, setLoadedSrc] = useState('')
  const [failedSrc, setFailedSrc] = useState('')

  // Work out the status from the current src, so a new link starts loading again.
  let status = 'loading'

  if (!src) {
    status = 'missing'
  } else if (failedSrc === src) {
    status = 'failed'
  } else if (loadedSrc === src) {
    status = 'loaded'
  }

  let boxClass = 'meal-image'

  if (small) {
    boxClass += ' meal-image--small'
  }

  if (status === 'loading') {
    boxClass += ' meal-image--loading'
  }

  let placeholderText = 'No photo yet'

  if (status === 'loading') {
    placeholderText = 'Loading photo...'
  } else if (status === 'failed') {
    placeholderText = 'Photo unavailable'
  }

  return (
    <div className={boxClass}>
      {status !== 'loaded' && (
        <div className="meal-image-placeholder" aria-hidden="true">
          <span className="meal-image-icon">🍽️</span>
          {!small && <span>{placeholderText}</span>}
        </div>
      )}

      {src && status !== 'failed' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={status === 'loaded' ? 'meal-image-photo meal-image-photo--loaded' : 'meal-image-photo'}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      )}
    </div>
  )
}
