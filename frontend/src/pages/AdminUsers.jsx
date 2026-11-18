import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import { getUsers, roleLabels, updateUserRole, updateUserStatus } from '../adminApi'
import './StaffMenu.css'
import './AdminDashboard.css'

export default function AdminUsers({ currentUserId }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [newRoles, setNewRoles] = useState({})

  // The change waiting for password confirmation.
  const [pending, setPending] = useState(null)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadUsers(text) {
    setLoading(true)
    setError('')

    try {
      const data = await getUsers(text)
      setUsers(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    getUsers('')
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    loadUsers(search)
  }

  function askRoleChange(user) {
    const role = newRoles[user.user_id] || user.role

    if (role === user.role) {
      setError('Choose a different role first.')
      return
    }

    setMessage('')
    setError('')
    setPassword('')
    setPending({
      user,
      type: 'role',
      value: role,
      text: `Change ${user.email} from ${roleLabels[user.role] || user.role} to ${roleLabels[role]}?`,
    })
  }

  function askStatusChange(user) {
    setMessage('')
    setError('')
    setPassword('')
    setPending({
      user,
      type: 'status',
      value: !user.is_active,
      text: `${user.is_active ? 'Deactivate' : 'Activate'} the account for ${user.email}?`,
    })
  }

  async function confirmChange(event) {
    event.preventDefault()

    if (!password) {
      setError('Enter your password to confirm.')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (pending.type === 'role') {
        await updateUserRole(pending.user.user_id, pending.value, password)
      } else {
        await updateUserStatus(pending.user.user_id, pending.value, password)
      }

      setMessage('User updated.')
      setPending(null)
      setPassword('')
      await loadUsers(search)
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
          <h1>User management</h1>
          <p>Search users, change their role, or turn their account on and off.</p>
        </div>
      </div>

      <form className="admin-search" onSubmit={handleSearch}>
        <label htmlFor="admin-user-search">Search by name or email</label>
        <div>
          <input
            id="admin-user-search"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="secondary">Search</Button>
        </div>
      </form>

      {error && <Alert error>{error}</Alert>}
      {message && <Alert>{message}</Alert>}

      {pending && (
        <section className="meal-form-panel" aria-labelledby="confirm-heading">
          <h2 id="confirm-heading">Confirm change</h2>
          <p>{pending.text}</p>
          <form className="meal-form" onSubmit={confirmChange}>
            <fieldset disabled={saving}>
              <div className="meal-form-field">
                <label htmlFor="confirm-password">Your password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="staff-menu-actions">
                <Button type="submit">{saving ? 'Saving...' : 'Confirm'}</Button>
                <Button variant="secondary" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      {loading ? (
        <Loading>Loading users...</Loading>
      ) : (
        <div className="staff-menu-table-wrap">
          <table className="staff-menu-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isMe = user.user_id === currentUserId

                return (
                  <tr key={user.user_id}>
                    <th scope="row">
                      {user.fname} {user.lname} {isMe && '(you)'}
                      <p>{user.email}</p>
                    </th>
                    <td>
                      <select
                        aria-label={`Role for ${user.email}`}
                        value={newRoles[user.user_id] || user.role}
                        disabled={isMe}
                        onChange={(event) =>
                          setNewRoles({ ...newRoles, [user.user_id]: event.target.value })
                        }
                      >
                        {Object.keys(roleLabels).map((role) => (
                          <option key={role} value={role}>{roleLabels[role]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={user.is_active ? 'admin-badge' : 'admin-badge admin-badge--off'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {isMe ? (
                        <span className="staff-menu-note">You cannot change your own account.</span>
                      ) : (
                        <div className="staff-menu-actions">
                          <Button variant="secondary" onClick={() => askRoleChange(user)}>
                            Save role
                          </Button>
                          <Button variant="secondary" onClick={() => askStatusChange(user)}>
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {users.length === 0 && <p className="staff-menu-note admin-empty">No users found.</p>}
        </div>
      )}
    </main>
  )
}
