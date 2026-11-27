import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import { getAllFeedback, setFeedbackStatus } from '../requestApi'
import './Feedback.css'
import '../components/SalesStats.css'

const typeFilters = [
  { key: '', label: 'All' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'report', label: 'Reports' },
]

const statusFilters = [
  { key: '', label: 'Any status' },
  { key: 'new', label: 'New' },
  { key: 'resolved', label: 'Resolved' },
]

function formatDate(value) {
  if (!value) return ''

  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Used by both cafeteria staff and the super admin.
export default function FeedbackInbox() {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('new')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await getAllFeedback(type, status)
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
  }, [type, status, reload])

  async function handleStatus(item, nextStatus) {
    setUpdatingId(item.feedback_id)
    setError('')

    try {
      await setFeedbackStatus(item.feedback_id, nextStatus)
      setReload(reload + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Feedback and reports</h1>
          <p>Read what customers say and follow up on reported problems.</p>
        </div>
        <Button variant="secondary" disabled={loading} onClick={() => setReload(reload + 1)}>
          Refresh
        </Button>
      </div>

      {data && (
        <div className="admin-cards feedback-summary">
          <article className="staff-count">
            <h3>New messages</h3>
            <p className="staff-count-value">{data.summary.new_count}</p>
          </article>
          <article className="staff-count">
            <h3>Open problem reports</h3>
            <p className="staff-count-value">{data.summary.open_reports}</p>
          </article>
          <article className="staff-count">
            <h3>Average rating</h3>
            <p className="staff-count-value">
              {data.summary.average_rating === null ? '-' : `${data.summary.average_rating} ★`}
            </p>
          </article>
        </div>
      )}

      <div className="feedback-filters">
        <div className="stats-tabs" role="group" aria-label="Filter by type">
          {typeFilters.map((item) => (
            <button
              key={item.key || 'all'}
              type="button"
              aria-pressed={type === item.key}
              onClick={() => setType(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="feedback-status-filter">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusFilters.map((item) => (
              <option key={item.key || 'any'} value={item.key}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <Alert error>{error}</Alert>}
      {loading && !data && <Loading>Loading feedback...</Loading>}

      {data && data.items.length === 0 && (
        <div className="student-empty">
          <h2>Nothing here</h2>
          <p>No feedback matches these filters.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <ul className="feedback-list feedback-list--inbox">
          {data.items.map((item) => (
            <li key={item.feedback_id} className="feedback-item">
              <div className="feedback-item-top">
                <span className={item.type === 'report' ? 'feedback-tag feedback-tag--report' : 'feedback-tag'}>
                  {item.type === 'report' ? 'Report' : 'Feedback'}
                </span>
                <span className={item.status === 'resolved' ? 'feedback-status feedback-status--done' : 'feedback-status'}>
                  {item.status === 'resolved' ? 'Resolved' : 'New'}
                </span>
              </div>
              <h3>{item.subject}</h3>
              {item.rating && (
                <p className="feedback-stars" aria-label={`${item.rating} out of 5 stars`}>
                  {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                </p>
              )}
              <p>{item.message}</p>
              <small>
                {item.fname} {item.lname} ({item.email}) · {formatDate(item.created_at)}
                {item.order_id ? ` · Order #${item.order_id}` : ''}
              </small>
              <div className="feedback-item-actions">
                {item.status === 'new' ? (
                  <Button
                    disabled={updatingId === item.feedback_id}
                    onClick={() => handleStatus(item, 'resolved')}
                  >
                    {updatingId === item.feedback_id ? 'Saving...' : 'Mark resolved'}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={updatingId === item.feedback_id}
                    onClick={() => handleStatus(item, 'new')}
                  >
                    {updatingId === item.feedback_id ? 'Saving...' : 'Reopen'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
