import Button from '../ui/Button'
import { formatMoney } from '../../utils/orders'

export default function MenuCard({ item, onAdd }) {
  let cardClass = 'menu-card'

  if (!item.is_available) {
    cardClass += ' menu-card--unavailable'
  }

  return (
    <article className={cardClass}>
      <span className="meal-availability">
        {item.is_available ? 'Available' : 'Unavailable'}
      </span>
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
