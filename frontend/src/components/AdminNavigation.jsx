import Button from './ui/Button'

const adminLinks = [
  { page: 'admin-overview', path: '/admin', label: 'Overview' },
  { page: 'admin-users', path: '/admin/users', label: 'User management' },
  { page: 'admin-staff', path: '/admin/staff', label: 'Staff management' },
  { page: 'admin-reports', path: '/admin/reports', label: 'Reports' },
  { page: 'admin-audit', path: '/admin/audit-logs', label: 'Audit logs' },
  { page: 'admin-settings', path: '/admin/settings', label: 'System settings' },
  { page: 'admin-menu', path: '/admin/menu', label: 'Menu management' },
  { page: 'admin-staff-dashboard', path: '/admin/staff-dashboard', label: 'Staff dashboard' },
]

export default function AdminNavigation({ page, onNavigate, children }) {
  function handleLink(event, nextPage) {
    event.preventDefault()
    onNavigate(nextPage)
  }

  return (
    <div className="cafeteria-layout staff-layout">
      <aside className="cafeteria-sidebar">
        <a
          className="cafeteria-brand"
          href="/admin"
          onClick={(event) => handleLink(event, 'admin-overview')}
        >
          Que<span>u</span>
        </a>
        <p className="staff-sidebar-label">Super admin</p>
        <nav aria-label="Super admin navigation">
          {adminLinks.map((link) => (
            <a
              key={link.page}
              className="sidebar-link"
              href={link.path}
              aria-current={page === link.page ? 'page' : undefined}
              onClick={(event) => handleLink(event, link.page)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Button
          className="cafeteria-logout"
          variant="secondary"
          onClick={() => onNavigate('login')}
        >
          Log out
        </Button>
      </aside>
      {children}
    </div>
  )
}
