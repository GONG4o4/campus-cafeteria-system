// Builds the no-show warning shown at checkout.
// The numbers come from the backend (GET /api/orders/no-show-policy),
// so the text always matches the rules the backend enforces.
// If the policy could not be loaded, a general version without numbers is used.

function plural(count, word) {
  if (count === 1) {
    return `${count} ${word}`
  }

  return `${count} ${word}s`
}

function isWholeNumber(value) {
  return Number.isInteger(value) && value >= 0
}

export function isValidPolicy(policy) {
  return Boolean(
    policy &&
      isWholeNumber(policy.pickup_window_minutes) &&
      isWholeNumber(policy.grace_period_minutes) &&
      isWholeNumber(policy.offense_threshold) &&
      isWholeNumber(policy.offense_window_days) &&
      isWholeNumber(policy.restriction_days),
  )
}

export function getNoShowPolicyLines(policy) {
  const lines = [
    'Once you place your order, cafeteria staff will start preparing it for you.',
  ]

  if (isValidPolicy(policy)) {
    lines.push(
      `Please collect it within ${plural(policy.pickup_window_minutes, 'minute')} after its status changes to Ready.`,
    )
    lines.push(
      `If it is still not collected ${plural(policy.grace_period_minutes, 'minute')} after that, staff may record it as a no-show.`,
    )
    lines.push(
      `${plural(policy.offense_threshold, 'no-show')} within ${plural(policy.offense_window_days, 'day')} will stop you from placing new orders for ${plural(policy.restriction_days, 'day')}.`,
    )
  } else {
    lines.push('Please collect it within the cafeteria pickup window after its status changes to Ready.')
    lines.push(
      'Orders that are not collected may be recorded as a no-show and can lead to a temporary ordering restriction.',
    )
  }

  lines.push('You will not be charged any extra fee for a no-show.')

  return lines
}

// Place Order is only allowed when the box is ticked and nothing else blocks it.
export function canPlaceOrder({ acknowledged, loading, orderStatusUnknown, itemCount }) {
  return acknowledged === true && !loading && !orderStatusUnknown && itemCount > 0
}
