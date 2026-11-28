import { useEffect, useState } from 'react'
import { getPickupSlots } from '../../requestApi'

// Lets the customer choose ASAP or a pickup time later today.
// pickup = { type: 'asap' } or { type: 'scheduled', time: '10:30' }
// The backend checks the time again, so this list is only a helper.
export default function PickupChoice({ pickup, onChange, disabled }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await getPickupSlots()
        if (!cancelled) setData(result)
      } catch (requestError) {
        if (!cancelled) setError(requestError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [reload])

  const openSlots = data ? data.slots.filter((slot) => !slot.full) : []
  const selectedSlot = data && pickup.type === 'scheduled'
    ? data.slots.find((slot) => slot.time === pickup.time)
    : null

  function chooseScheduled() {
    // Pick the first open time so the order can be placed right away.
    onChange({ type: 'scheduled', time: openSlots.length > 0 ? openSlots[0].time : '' })
  }

  function formatHours() {
    if (!data) return ''

    const toLabel = (value) => {
      const [hour, minute] = value.split(':').map(Number)
      const suffix = hour >= 12 ? 'PM' : 'AM'
      return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')} ${suffix}`
    }

    return `${toLabel(data.open_time)} to ${toLabel(data.close_time)}`
  }

  return (
    <section className="pickup-choice" aria-labelledby="pickup-choice-title">
      <h2 id="pickup-choice-title">When will you pick up?</h2>

      <div className="pickup-choice-options" role="radiogroup" aria-label="Pickup time">
        <label className={pickup.type === 'asap' ? 'pickup-option pickup-option--selected' : 'pickup-option'}>
          <input
            type="radio"
            name="pickup-type"
            checked={pickup.type === 'asap'}
            disabled={disabled}
            onChange={() => onChange({ type: 'asap' })}
          />
          <span>
            <strong>ASAP</strong>
            <small>Join the queue now and pick up when your order is Ready.</small>
          </span>
        </label>

        <label className={pickup.type === 'scheduled' ? 'pickup-option pickup-option--selected' : 'pickup-option'}>
          <input
            type="radio"
            name="pickup-type"
            checked={pickup.type === 'scheduled'}
            disabled={disabled || loading || openSlots.length === 0}
            onChange={chooseScheduled}
          />
          <span>
            <strong>Schedule for later today</strong>
            <small>Order during class and pick up at the time you choose.</small>
          </span>
        </label>
      </div>

      {loading && <p className="pickup-choice-note">Loading pickup times...</p>}

      {error && (
        <p className="pickup-choice-note pickup-choice-note--error">
          {error}{' '}
          <button type="button" className="pickup-choice-link" onClick={() => setReload(reload + 1)}>
            Try again
          </button>
        </p>
      )}

      {!loading && !error && openSlots.length === 0 && (
        <p className="pickup-choice-note">
          Scheduled pickup is not available for the rest of today (cafeteria hours: {formatHours()}).
          You can still order ASAP.
        </p>
      )}

      {pickup.type === 'scheduled' && data && openSlots.length > 0 && (
        <div className="pickup-choice-time">
          <label htmlFor="pickup-time">Pickup time today</label>
          <select
            id="pickup-time"
            value={pickup.time}
            disabled={disabled}
            onChange={(event) => onChange({ type: 'scheduled', time: event.target.value })}
          >
            {data.slots.map((slot) => (
              <option key={slot.time} value={slot.time} disabled={slot.full}>
                {slot.label}{slot.full ? ' (full)' : ` (${slot.remaining} left)`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pickup-choice-link"
            disabled={disabled}
            onClick={() => setReload(reload + 1)}
          >
            Refresh times
          </button>
        </div>
      )}

      <p className="pickup-choice-summary" aria-live="polite">
        {pickup.type === 'asap' && (
          <>Pickup: <strong>ASAP</strong>, as soon as your order is Ready.</>
        )}
        {pickup.type === 'scheduled' && selectedSlot && (
          <>
            Pickup: <strong>Today at {selectedSlot.label}</strong>. This is your requested
            collection time; we will prepare your order before then. Please still check that
            it shows Ready when you arrive.
          </>
        )}
      </p>
    </section>
  )
}
