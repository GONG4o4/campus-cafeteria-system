import { useEffect, useState } from 'react'
import { Alert, Loading } from '../components/ui/Feedback'
import { getAuditLogs } from '../adminApi'
import './StaffMenu.css'
import './AdminDashboard.css'

const actionLabels = {
  create_initial_super_admin: 'Initial super admin created',
  create_staff_account: 'Staff account created',
  change_role: 'Role changed',
  activate_account: 'Account activated',
  deactivate_account: 'Account deactivated',
  update_settings: 'Settings updated',
}

function describe(log) {
  const details = log.details || {}

  if (log.action === 'change_role') {
    return `${details.email}: ${details.from} → ${details.to}`
  }

  if (log.action === 'update_settings') {
    return Object.keys(details)
      .map((key) => `${key} = ${details[key]}`)
      .join(', ')
  }

  return details.email || ''
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    getAuditLogs()
      .then((data) => {
        if (!cancelled) setLogs(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Audit logs</h1>
          <p>The latest 100 administrative actions, newest first.</p>
        </div>
      </div>

      {error && <Alert error>{error}</Alert>}
      {!logs && !error && <Loading>Loading audit logs...</Loading>}

      {logs && (
        <div className="staff-menu-table-wrap">
          <table className="staff-menu-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.audit_log_id}>
                  <td>{log.created_at.replace('T', ' ')}</td>
                  <td>{log.actor_email || 'Setup script'}</td>
                  <td>{actionLabels[log.action] || log.action}</td>
                  <td>{describe(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="staff-menu-note admin-empty">No actions recorded yet.</p>}
        </div>
      )}
    </main>
  )
}
