import { useRef, useState } from 'react'

const photos = [
  {
    src: '/image.png',
    alt: 'Rice topped with burger patties and mushroom gravy',
  },
  {
    src: '/image copy.png',
    alt: 'Burger patties with fried egg, rice, and fries',
  },
  {
    src: '/image copy 2.png',
    alt: 'Burger patties with mushroom gravy, rice, and vegetables',
  },
  {
    src: '/image copy 3.png',
    alt: 'A plate of burger patties, mixed vegetables, and rice',
  },
]

export default function MealCarousel() {
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const swipeStart = useRef(null)

  function showNextPhoto() {
    setCurrentPhoto((previous) => (previous + 1) % photos.length)
  }

  function showPreviousPhoto() {
    setCurrentPhoto((previous) => {
      return (previous - 1 + photos.length) % photos.length
    })
  }

  function handlePointerDown(event) {
    if (!event.isPrimary || event.button !== 0) {
      return
    }

    swipeStart.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerUp(event) {
    if (!swipeStart.current) {
      return
    }

    const distanceX = event.clientX - swipeStart.current.x
    const distanceY = event.clientY - swipeStart.current.y
    swipeStart.current = null

    if (Math.abs(distanceX) < 50 || Math.abs(distanceX) <= Math.abs(distanceY)) {
      return
    }

    if (distanceX < 0) {
      showNextPhoto()
    } else {
      showPreviousPhoto()
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      showNextPhoto()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      showPreviousPhoto()
    }
  }

  return (
    <figure
      className="landing-visual"
      role="region"
      aria-roledescription="carousel"
      aria-label="Meal photos"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="meal-carousel-frame">
        <div
          className="meal-carousel-viewport"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeStart.current = null
          }}
        >
          <div
            className="meal-carousel-track"
            style={{ transform: `translateX(-${currentPhoto * 100}%)` }}
          >
            {photos.map((photo, index) => (
              <div
                className="meal-carousel-slide"
                key={photo.src}
                aria-hidden={index !== currentPhoto}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  width="600"
                  height="480"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          className="meal-carousel-arrow meal-carousel-arrow--previous"
          type="button"
          aria-label="Previous photo"
          onClick={showPreviousPhoto}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          className="meal-carousel-arrow meal-carousel-arrow--next"
          type="button"
          aria-label="Next photo"
          onClick={showNextPhoto}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="meal-carousel-dots" role="group" aria-label="Choose a photo">
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            className="meal-carousel-dot"
            type="button"
            aria-label={`Show photo ${index + 1}`}
            aria-current={index === currentPhoto ? 'true' : undefined}
            onClick={() => setCurrentPhoto(index)}
          />
        ))}
      </div>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Photo {currentPhoto + 1} of {photos.length}
      </span>
      <figcaption>
        <span className="landing-visual-dot" aria-hidden="true" />
        Made for everyday campus life
      </figcaption>
    </figure>
  )
}
