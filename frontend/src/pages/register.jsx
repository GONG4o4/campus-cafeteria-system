import { useRef, useState } from 'react'
import { isValidEmail, submitAuthRequest } from '../authApi.js'
import './login.css'

function Register({ onNavigate }) {
  const [fname, setFname] = useState('')
  const [lname, setLname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting.current) return

    setError('')
    setMessage('')

   if (!fname.trim() || !lname.trim()) {
  setError('Please enter your first and last name.')
  return
}

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Please complete all fields.')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    submitting.current = true
    setLoading(true)
    try {
      const result = await submitAuthRequest(
        '/api/auth/register', 
  {
    fname: fname.trim(),
    lname: lname.trim(),
    email: email.trim(),
    password,
  },
        'Account created successfully.',
      )
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message || 'Unable to register right now. Please try again.')
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
          onNavigate('landing')
        }}>
          Que<span>u</span>
        </a>
        <p className="account-caption">Campus cafeteria system</p>
        <h1>Create your account</h1>
        <p className="page-copy">Join the campus community and get started.</p>

        <form className="account-form" onSubmit={handleSubmit}>
          
<div className="form-field">
  <label htmlFor="register-fname">First name</label>
  <input
    id="register-fname"
    type="text"
    autoComplete="given-name"
    placeholder="Your first name"
    value={fname}
    onChange={(event) => setFname(event.target.value)}
    required
  />
</div>

<div className="form-field">
  <label htmlFor="register-lname">Last name</label>
  <input
    id="register-lname"
    type="text"
    autoComplete="family-name"
    placeholder="Your last name"
    value={lname}
    onChange={(event) => setLname(event.target.value)}
    required
  />
</div>


          <div className="form-field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="email@wmsu.edu.ph"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="register-confirm-password">Confirm password</label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter your password again"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <div className="form-feedback" aria-live="polite">
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="form-notice" role="status">{message}</p>}
          </div>

          <button className="submit-button" type="submit" disabled={loading}>
            {loading && <span className="loading-mark" aria-hidden="true" />}
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="other-account">
          Already have an account?{' '}
          <a href="/login" onClick={(event) => {
            event.preventDefault()
            onNavigate('login')
          }}>
            Sign in
          </a>
        </p>
      </section>
    </main>
  )
}

export default Register
