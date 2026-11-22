import Button from '../ui/Button'
import MealImage from './MealImage'
import { formatMoney } from '../../utils/orders'

export default function MenuCard({ item, onAdd, isBestSeller = false }) {
  let cardClass = 'menu-card'

  if (!item.is_available) {
    cardClass += ' menu-card--unavailable'
  }

  return (
    <article className={cardClass}>
      <MealImage src={item.image_url || ''} alt={`Photo of ${item.name}`} />
      <div className="menu-card-tags">
        <span className="meal-availability">
          {item.is_available ? 'Available' : 'Unavailable'}
        </span>
        {isBestSeller && (
          <span className="best-seller-badge">
            <span aria-hidden="true">★</span>
            Best Seller
          </span>
        )}
      </div>
      <h2>{item.name}</h2>
      <p>{item.description || 'No description available.'}</p>

      <div className="menu-card-footer">
        <strong>{formatMoney(item.price)}</strong>
        <Button
          disabled={!item.is_available}
          onClick={() => onAdd(item)}
        >
          {item.is_available ? 'Add to cart' : 'Unavailable'}
        </Button>
      </div>
    </article>
  )
}

// Grey placeholder card shown while the menu is loading for the first time.
export function MenuCardSkeleton() {
  return (
    <div className="menu-card menu-card-skeleton" aria-hidden="true">
      <div className="skeleton-block skeleton-image" />
      <div className="skeleton-block skeleton-badge" />
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-block skeleton-text" />
      <div className="skeleton-block skeleton-text skeleton-text--short" />
      <div className="skeleton-block skeleton-button" />
    </div>
  )
}
