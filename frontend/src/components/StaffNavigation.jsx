import Button from './ui/Button'

export default function StaffNavigation({ page, onNavigate, children }) {
  const links = [
    { page: 'staff-dashboard', path: '/staff', label: 'Dashboard' },
    { page: 'staff-orders', path: '/staff/orders', label: 'Order queue' },
    { page: 'staff-menu', path: '/staff/menu', label: 'Menu management' },
    { page: 'staff-summary', path: '/staff/summary', label: 'Daily summary' },
  ]

  function handleLink(event, nextPage) {
    event.preventDefault()
    onNavigate(nextPage)
  }

  return (
    <div className="cafeteria-layout staff-layout">
      <aside className="cafeteria-sidebar">
        <a
          className="cafeteria-brand"
          href="/staff"
          onClick={(event) => handleLink(event, 'staff-dashboard')}
        >
          Que<span>u</span>
        </a>
        <p className="staff-sidebar-label">Cafeteria staff</p>
        <nav aria-label="Staff navigation">
          {links.map((link) => (
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
