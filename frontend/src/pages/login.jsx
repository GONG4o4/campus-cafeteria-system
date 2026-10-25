import { useRef, useState } from 'react'
import { isValidEmail, submitAuthRequest } from '../authApi.js'
import './login.css'

function Login({ onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting.current) return

    setError('')
    setMessage('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    submitting.current = true
    setLoading(true)

    try {
     const result = await submitAuthRequest(
  '/api/auth/login',
  { email: email.trim(), password },
  'Login successful',
)

if (!result.token) {
  throw new Error('Login succeeded, but no authentication token was returned.')
}

localStorage.setItem('token', result.token)
localStorage.setItem('user', JSON.stringify(result.user))

setMessage('Login successful')
onNavigate('home')
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in right now. Please try again.')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <main className="account-page">
      <section className="account-panel">
        <a className="brand" href="/" onClick={(event) => {
          event.preventDefault()
          onNavigate('login')
        }}>
          Que<span>u</span>
        </a>
        <p className="account-caption">Campus cafeteria system</p>
        <h1>Welcome back</h1>

        <form className="account-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div className="form-feedback" aria-live="polite">
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="form-notice" role="status">{message}</p>}
          </div>

          <button className="submit-button" type="submit" disabled={loading}>
            {loading && <span className="loading-mark" aria-hidden="true" />}
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="other-account">
          New to Queu?{' '}
          <a href="/register" onClick={(event) => {
            event.preventDefault()
            onNavigate('register')
          }}>
            Create an account
          </a>
        </p>
      </section>
    </main>
  )
}

export default Login