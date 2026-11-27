import { useState } from 'react'

// Shared layout for the login and sign up pages.
// Left side: brand panel with a food photo (hidden on phones).
// Right side: the form card.
const points = [
  'Browse the menu anytime',
  'Order ahead between classes',
  'Get a queue number and skip the line',
]

export default function AuthLayout({ onNavigate, title, subtitle, children }) {
  function goHome(event) {
    event.preventDefault()
    onNavigate('landing')
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-hidden="true">
        <a className="auth-showcase-brand" href="/" tabIndex={-1} onClick={goHome}>
          Que<span>u</span>
        </a>

        <div className="auth-showcase-photo">
          <img src="/image.png" alt="" width="480" height="640" />
        </div>

        <div className="auth-showcase-text">
          <h2>Good food. Less waiting.</h2>
          <ul>
            {points.map((point) => (
              <li key={point}>
                <span>✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <a className="auth-brand" href="/" onClick={goHome}>
            Que<span>u</span>
          </a>
          <p className="auth-caption">Campus Cafeteria</p>
          <h1>{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
        </div>
      </section>
    </main>
  )
}

// Password input with a Show / Hide button.
export function PasswordField({ id, label, value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}
