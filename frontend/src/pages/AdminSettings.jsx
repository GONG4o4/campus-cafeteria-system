import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import { getSettings, saveSettings } from '../adminApi'
import './StaffMenu.css'
import './AdminDashboard.css'

export default function AdminSettings() {
  const [allowRegistration, setAllowRegistration] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    getSettings()
      .then((data) => {
        if (!cancelled) setAllowRegistration(data.allow_registration !== false)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      await saveSettings({ allow_registration: allowRegistration })
      setMessage('Settings saved.')
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
          <h1>System settings</h1>
          <p>Only settings that the backend supports are shown here.</p>
        </div>
      </div>

      {error && <Alert error>{error}</Alert>}
      {message && <Alert>{message}</Alert>}
      {allowRegistration === null && !error && <Loading>Loading settings...</Loading>}

      {allowRegistration !== null && (
        <section className="meal-form-panel admin-form" aria-labelledby="settings-heading">
          <h2 id="settings-heading">Accounts</h2>
          <form className="meal-form" onSubmit={handleSubmit}>
            <fieldset disabled={saving}>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={allowRegistration}
                  onChange={(event) => setAllowRegistration(event.target.checked)}
                />
                Allow new students to register
              </label>
              <p className="staff-menu-note">
                When this is off, the register page will refuse new accounts.
                Existing users can still sign in.
              </p>
              <Button type="submit">{saving ? 'Saving...' : 'Save settings'}</Button>
            </fieldset>
          </form>
        </section>
      )}
    </main>
  )
}
