import Button from './ui/Button'

// Customer layout.
// Computer / tablet: maroon sidebar on the left.
// Phone: small top bar + a tab bar fixed to the bottom of the screen.
export default function CafeteriaLayout({
  page,
  itemCount,
  onNavigate,
  children,
  authenticated = true,
}) {
  const links = [
    { page: 'landing', path: '/', label: 'Home', icon: '🏠' },
    { page: 'menu', label: 'Menu', icon: '🍽️' },
    { page: 'cart', label: 'Cart', icon: '🛒', count: itemCount },
    { page: 'orders', label: 'Orders', longLabel: 'Order history', icon: '🧾' },
    { page: 'feedback', label: 'Feedback', longLabel: 'Feedback', icon: '💬' },
  ]

  function handleLinkClick(event, nextPage) {
    event.preventDefault()
    onNavigate(nextPage)
  }

  return (
    <div className="cafeteria-layout customer-layout">
      <aside className="cafeteria-sidebar">
        <a
          className="cafeteria-brand"
          href="/menu"
          onClick={(event) => handleLinkClick(event, 'menu')}
        >
          Que<span>u</span>
        </a>

        <nav className="customer-nav" aria-label="Cafeteria">
          {links.map((link) => {
            let isActive = page === link.page

            if (page === 'checkout' && link.page === 'cart') {
              isActive = true
            }

            return (
              <a
                key={link.page}
                className="sidebar-link"
                href={link.path || `/${link.page}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => handleLinkClick(event, link.page)}
              >
                <span className="sidebar-icon" aria-hidden="true">{link.icon}</span>
                <span className="sidebar-label">
                  <span className="sidebar-label-long">{link.longLabel || link.label}</span>
                  <span className="sidebar-label-short">{link.label}</span>
                </span>
                {link.count > 0 && (
                  <span className="sidebar-count" aria-label={`${link.count} items`}>
                    {link.count}
                  </span>
                )}
              </a>
            )
          })}
        </nav>

        <Button
          className="cafeteria-logout"
          variant="secondary"
          onClick={() => onNavigate('login')}
        >
          {authenticated ? 'Log out' : 'Log in'}
        </Button>
      </aside>
      {children}
    </div>
  )
}
