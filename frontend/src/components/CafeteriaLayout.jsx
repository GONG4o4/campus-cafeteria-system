import Button from './ui/Button'

export default function CafeteriaLayout({
  page,
  itemCount,
  onNavigate,
  children,
  authenticated = true,
}) {
  const links = [
    { page: 'landing', path: '/', label: 'Home' },
    { page: 'menu', label: 'Menu' },
    { page: 'cart', label: `Cart (${itemCount})` },
    { page: 'orders', label: 'Order history' },
  ]

  function handleLinkClick(event, nextPage) {
    event.preventDefault()
    onNavigate(nextPage)
  }

  return (
    <div className="cafeteria-layout">
      <aside className="cafeteria-sidebar">
        <a
          className="cafeteria-brand"
          href="/menu"
          onClick={(event) => handleLinkClick(event, 'menu')}
        >
          Que<span>u</span>
        </a>

        <nav aria-label="Cafeteria">
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
                {link.label}
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
