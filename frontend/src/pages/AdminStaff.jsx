import { useState } from 'react'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Feedback'
import { createStaffAccount } from '../adminApi'
import { isValidEmail } from '../authApi'
import './StaffMenu.css'
import './AdminDashboard.css'

export default function AdminStaff() {
  const [fname, setFname] = useState('')
  const [lname, setLname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!fname.trim() || !lname.trim()) {
      setError('Enter the first and last name.')
      return
    }

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }

    if (password.length < 8 || password.length > 72) {
      setError('Password must be 8 to 72 characters.')
      return
    }

    setSaving(true)

    try {
      const result = await createStaffAccount({
        fname: fname.trim(),
        lname: lname.trim(),
        email: email.trim(),
        password,
      })

      setMessage(`Staff account created for ${result.user.email}.`)
      setFname('')
      setLname('')
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Staff management</h1>
          <p>Create an account for a new cafeteria staff member.</p>
        </div>
      </div>

      <section className="meal-form-panel admin-form" aria-labelledby="staff-form-heading">
        <h2 id="staff-form-heading">New cafeteria staff account</h2>
        <p>Give the staff member their password privately. They can sign in right away.</p>

        {error && <Alert error>{error}</Alert>}
        {message && <Alert>{message}</Alert>}

        <form className="meal-form" onSubmit={handleSubmit} noValidate>
          <fieldset disabled={saving}>
            <div className="meal-form-field">
              <label htmlFor="staff-fname">First name</label>
              <input id="staff-fname" value={fname} maxLength={100} onChange={(e) => setFname(e.target.value)} />
            </div>
            <div className="meal-form-field">
              <label htmlFor="staff-lname">Last name</label>
              <input id="staff-lname" value={lname} maxLength={100} onChange={(e) => setLname(e.target.value)} />
            </div>
            <div className="meal-form-field">
              <label htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" value={email} maxLength={100} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="meal-form-field">
              <label htmlFor="staff-password">Temporary password</label>
              <input
                id="staff-password"
                type="password"
                autoComplete="new-password"
                value={password}
                maxLength={72}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit">{saving ? 'Creating...' : 'Create staff account'}</Button>
          </fieldset>
        </form>
      </section>
    </main>
  )
}
