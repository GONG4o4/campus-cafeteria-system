import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import { getMyFeedback, sendFeedback } from '../requestApi'
import './Feedback.css'

const types = [
  { key: 'feedback', label: 'Give feedback', hint: 'Tell us what you liked or what we can do better.' },
  { key: 'report', label: 'Report a problem', hint: 'Wrong order, missing item, payment issue, or anything else.' },
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

export default function Feedback() {
  const [type, setType] = useState('feedback')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [orderId, setOrderId] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false

    getMyFeedback()
      .then((data) => {
        if (!cancelled) {
          setHistory(data)
          setHistoryError('')
        }
      })
      .catch((requestError) => {
        if (!cancelled) setHistoryError(requestError.message)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  async function handleSubmit(event) {
    event.preventDefault()
    if (sending) return

    setError('')
    setSuccess('')

    if (!subject.trim() || !message.trim()) {
      setError('Please enter a subject and a message.')
      return
    }

    if (orderId.trim() && !/^[1-9]\d*$/.test(orderId.trim())) {
      setError('The order number should only contain digits.')
      return
    }

    setSending(true)

    try {
      const result = await sendFeedback({
        type,
        subject: subject.trim(),
        message: message.trim(),
        rating: type === 'feedback' && rating > 0 ? rating : null,
        order_id: orderId.trim() ? Number(orderId.trim()) : null,
      })

      setSuccess(result.message)
      setSubject('')
      setMessage('')
      setRating(0)
      setOrderId('')
      setReload(reload + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const selectedType = types.find((item) => item.key === type)

  return (
    <main className="student-page">
      <div className="page-intro">
        <div>
          <h1>Feedback and reports</h1>
          <p>Help us improve the cafeteria, or let us know if something went wrong.</p>
        </div>
      </div>

      <div className="feedback-layout">
        <section className="feedback-form-card" aria-labelledby="feedback-form-heading">
          <h2 id="feedback-form-heading" className="sr-only">Send feedback</h2>

          <div className="feedback-type" role="group" aria-label="What do you want to send?">
            {types.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={type === item.key}
                onClick={() => setType(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="feedback-hint">{selectedType.hint}</p>

          {success && <Alert>{success}</Alert>}
          {error && <Alert error>{error}</Alert>}

          <form className="feedback-form" onSubmit={handleSubmit}>
            {type === 'feedback' && (
              <fieldset className="feedback-rating">
                <legend>How was your experience? (optional)</legend>
                <div>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={star <= rating ? 'feedback-star feedback-star--on' : 'feedback-star'}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      aria-pressed={rating === star}
                      onClick={() => setRating(rating === star ? 0 : star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="feedback-field">
              <label htmlFor="feedback-subject">Subject</label>
              <input
                id="feedback-subject"
                value={subject}
                maxLength={120}
                placeholder={type === 'report' ? 'Example: My order was missing a drink' : 'Example: Great adobo today!'}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div className="feedback-field">
              <label htmlFor="feedback-order">Order number (optional)</label>
              <input
                id="feedback-order"
                inputMode="numeric"
                value={orderId}
                placeholder="Found in your order history"
                onChange={(event) => setOrderId(event.target.value)}
              />
            </div>

            <div className="feedback-field">
              <label htmlFor="feedback-message">Message</label>
              <textarea
                id="feedback-message"
                rows={5}
                maxLength={2000}
                value={message}
                placeholder="Tell us more..."
                onChange={(event) => setMessage(event.target.value)}
              />
              <span className="feedback-count">{message.length}/2000</span>
            </div>

            <Button type="submit" disabled={sending}>
              {sending ? 'Sending...' : type === 'report' ? 'Send report' : 'Send feedback'}
            </Button>
          </form>
        </section>

        <section className="feedback-history" aria-labelledby="feedback-history-heading">
          <h2 id="feedback-history-heading">What you sent</h2>

          {historyLoading && <Loading>Loading...</Loading>}
          {historyError && <Alert error>{historyError}</Alert>}

          {!historyLoading && !historyError && history.length === 0 && (
            <p className="feedback-empty">You have not sent any feedback yet.</p>
          )}

          <ul className="feedback-list">
            {history.map((item) => (
              <li key={item.feedback_id} className="feedback-item">
                <div className="feedback-item-top">
                  <span className={item.type === 'report' ? 'feedback-tag feedback-tag--report' : 'feedback-tag'}>
                    {item.type === 'report' ? 'Report' : 'Feedback'}
                  </span>
                  <span className={item.status === 'resolved' ? 'feedback-status feedback-status--done' : 'feedback-status'}>
                    {item.status === 'resolved' ? 'Resolved' : 'Received'}
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
                  {formatDate(item.created_at)}
                  {item.order_id ? ` · Order #${item.order_id}` : ''}
                </small>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
