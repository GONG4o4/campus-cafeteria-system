// Pickup guidance shown at checkout and after an order is confirmed.
// The pickup location is kept in ONE place so it is easy to change.
// There is no configured location in the system yet, so this is the
// approved general wording. Update it here if the cafeteria gives a
// more exact spot (for example a counter number).
export const PICKUP_LOCATION = 'the campus cafeteria pickup counter'

// Full version, shown on the checkout page above the Place Order button.
export function getPickupReminderLines() {
  return [
    {
      title: 'Where to pick up',
      text: `Collect your order at ${PICKUP_LOCATION}.`,
    },
    {
      title: 'One shared queue',
      text: 'Your order joins the same queue as every other customer. You get your queue number only after your order and payment are confirmed.',
    },
    {
      title: 'When to collect',
      text: 'Wait until your order status shows Ready, then bring your queue number to the counter.',
    },
    {
      title: 'Already near the cafeteria?',
      text: 'You can still order here as normal. Being close to the cafeteria does not change your place in the queue.',
    },
    {
      title: 'Collect on time',
      text: 'Orders that are not collected may be recorded as a no-show. See the pickup and no-show policy below.',
    },
  ]
}

// "Today at 10:30 AM" for a scheduled order, "ASAP" otherwise.
// scheduledAt comes from the backend already in Asia/Manila time
// ("2026-11-28T10:30:00"), so only the hour and minute are read.
// This way the browser's own time zone cannot change the shown time.
export function getPickupLabel(pickupType, scheduledAt) {
  if (pickupType !== 'scheduled' || typeof scheduledAt !== 'string') {
    return 'ASAP'
  }

  const time = scheduledAt.slice(11, 16)
  const [hour, minute] = time.split(':').map(Number)

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return 'Scheduled'
  }

  const suffix = hour >= 12 ? 'PM' : 'AM'
  const shownHour = hour % 12 === 0 ? 12 : hour % 12

  return `Today at ${shownHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

// Short version, shown after the backend has confirmed the order.
// The queue number always comes from the backend, never from the browser.
export function getPickupConfirmationLines(queueNumber) {
  let showNumber = 'your queue number'

  if (Number.isInteger(queueNumber) && queueNumber > 0) {
    showNumber = `queue number #${queueNumber}`
  }

  return [
    `Pick up at ${PICKUP_LOCATION}.`,
    `Wait until your order status shows Ready, then show ${showNumber} at the counter.`,
    'Orders that are not collected may be recorded as a no-show.',
  ]
}
