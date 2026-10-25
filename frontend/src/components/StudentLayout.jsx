import './StudentLayout.css'

const links = [
  { id: 'menu', label: 'Menu', path: '/home' },
  { id: 'cart', label: 'Cart', path: '/cart' },
  { id: 'orders', label: 'Orders', path: '/orders' },
]

export default function StudentLayout({
  activePage,
  cartCount,
  onNavigate,
  children,
}) {
  return (
    <div className="student-shell">
      <aside className="student-sidebar">
        <div className="student-sidebar-top">
          <a
            className="student-brand"
            href="/home"
            onClick={(event) => {
              event.preventDefault()
              onNavigate('menu')
            }}
          >
            Campus<strong>Cafeteria</strong>
          </a>
          <button
            className="student-logout"
            type="button"
            onClick={() => onNavigate('login')}
          >
            Sign out
          </button>
        </div>
        <nav className="student-nav" aria-label="Student ordering">
          {links.map((link) => (
            <a
              key={link.id}
              className="student-nav-link"
              href={link.path}
              aria-current={activePage === link.id ? 'page' : undefined}
              aria-label={
                link.id === 'cart'
                  ? `Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault()
                onNavigate(link.id)
              }}
            >
              <span>{link.label}</span>
              {link.id === 'cart' && cartCount > 0 && (
                <span className="student-cart-count" aria-hidden="true">
                  {cartCount}
                </span>
              )}
            </a>
          ))}
        </nav>
      </aside>
      <main className="student-main">{children}</main>
    </div>
  )
}
