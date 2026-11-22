import { getPickupReminderLines, getPickupConfirmationLines } from '../../utils/pickup'

// compact = false: full reminder on the checkout page.
// compact = true: short reminder after the order is confirmed.
export default function PickupReminder({ compact = false, queueNumber }) {
  if (compact) {
    return (
      <section className="pickup-reminder pickup-reminder--compact" aria-label="Pickup reminder">
        <h2>
          Pickup reminder
        </h2>
        <ul>
          {getPickupConfirmationLines(queueNumber).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="pickup-reminder" aria-labelledby="pickup-reminder-title">
      <h2 id="pickup-reminder-title">
        Pickup and queue reminder
      </h2>
      <dl>
        {getPickupReminderLines().map((line) => (
          <div key={line.title}>
            <dt>{line.title}</dt>
            <dd>{line.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
