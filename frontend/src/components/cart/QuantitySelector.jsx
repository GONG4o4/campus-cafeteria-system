import Button from '../ui/Button'

export default function QuantitySelector({ name, quantity, onChange }) {
  return (
    <div
      className="quantity-selector"
      role="group"
      aria-label={`Quantity for ${name}`}
    >
      <Button
        variant="secondary"
        aria-label={`Decrease ${name} quantity`}
        disabled={quantity <= 1}
        onClick={() => onChange(quantity - 1)}
      >
        −
      </Button>
      <input
        type="number"
        min="1"
        step="1"
        aria-label={`${name} quantity`}
        value={quantity}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <Button
        variant="secondary"
        aria-label={`Increase ${name} quantity`}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </Button>
    </div>
  )
}
