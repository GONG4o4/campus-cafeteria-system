import { getNoShowPolicyLines } from '../../utils/noShowPolicy'

export default function NoShowNotice({ policy, loading, acknowledged, onAcknowledge, disabled }) {
  const lines = getNoShowPolicyLines(policy)

  return (
    <section className="no-show-notice" aria-labelledby="no-show-notice-title">
      <h2 id="no-show-notice-title">Pickup and no-show policy</h2>

      {loading ? (
        <p className="no-show-notice__loading">Loading the pickup policy...</p>
      ) : (
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <label className="no-show-notice__check">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledge(event.target.checked)}
          disabled={disabled || loading}
        />
        <span>
          I understand that I must collect my order, and that uncollected orders
          may lead to a temporary ordering restriction.
        </span>
      </label>
    </section>
  )
}
