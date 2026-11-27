import { useEffect, useState } from 'react'
import MealImage from '../components/menu/MealImage'
import PenaltyNotice from '../components/PenaltyNotice'
import { formatMoney } from '../utils/orders'
import './LandingPage.css'

const heroPoints = [
  { icon: '🛒', text: 'Order ahead' },
  { icon: '🎟️', text: 'Get a queue number' },
  { icon: '🍽️', text: 'Pick up your meal' },
]

const benefits = [
  {
    number: '01',
    title: 'See what is available',
    text: 'Check the menu before heading to the cafeteria.',
  },
  {
    number: '02',
    title: 'Pick your meals',
    text: 'Add meals to your cart and check the total.',
  },
  {
    number: '03',
    title: 'Pick up with your number',
    text: 'Your queue number helps you find your meal at the counter.',
  },
]

const collections = [
  { icon: '🍛', title: 'Rice Meals', text: 'Filling plates for long class days.' },
  { icon: '🍔', title: 'Snacks', text: 'Quick bites between your classes.' },
  { icon: '🥤', title: 'Drinks', text: 'Something cold or hot for your break.' },
  { icon: '🍮', title: 'Desserts', text: 'A little something sweet after lunch.' },
]

const steps = [
  'Find something to eat',
  'Log in and order',
  'Get your queue number',
  'Pick up your food',
]

const features = [
  { icon: '🔍', title: 'Browse anytime', text: 'No account needed' },
  { icon: '✏️', title: 'Change your cart', text: 'Before you check out' },
  { icon: '🎟️', title: 'Queue number', text: 'For every confirmed order' },
  { icon: '📦', title: 'Order history', text: 'See your pickup status' },
]

const footerLinks = [
  { label: 'Home', page: 'landing', path: '/' },
  { label: 'Menu', page: 'menu', path: '/menu' },
  { label: 'Log in', page: 'login', path: '/login' },
  { label: 'Sign up', page: 'register', path: '/register' },
]

// Loads featured meals and best sellers for the "Top picks" section.
// The menu and best seller lists are public, so no login is needed.
function useTopPicks() {
  const [picks, setPicks] = useState([])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const menuResponse = await fetch('http://localhost:3000/api/menu', { signal: controller.signal })
        const menu = await menuResponse.json()

        let bestIds = []

        try {
          const bestResponse = await fetch('http://localhost:3000/api/menu/best-sellers', { signal: controller.signal })
          const best = await bestResponse.json()
          bestIds = best.items.map((item) => item.menu_item_id)
        } catch {
          bestIds = []
        }

        if (!Array.isArray(menu)) return

        const result = []

        for (const item of menu) {
          if (item.is_featured === true && item.is_available) {
            result.push({ ...item, tag: 'Featured' })
          }
        }

        for (const id of bestIds) {
          const item = menu.find((meal) => meal.menu_item_id === id)
          const alreadyAdded = result.some((meal) => meal.menu_item_id === id)

          if (item && item.is_available && !alreadyAdded) {
            result.push({ ...item, tag: 'Best Seller' })
          }
        }

        // Nothing featured or sold yet: show the first available meals.
        if (result.length === 0) {
          for (const item of menu) {
            if (item.is_available && result.length < 4) {
              result.push({ ...item, tag: 'On the menu' })
            }
          }
        }

        if (!controller.signal.aborted) {
          setPicks(result.slice(0, 4))
        }
      } catch {
        // The backend is not running: the section just stays hidden.
      }
    }

    load()
    return () => controller.abort()
  }, [])

  return picks
}

// Adds the "is-visible" class to .reveal elements when they scroll into view,
// which starts their fade-up animation (see LandingPage.css).
function useRevealOnScroll(watch) {
  useEffect(() => {
    const elements = document.querySelectorAll('.reveal:not(.is-visible)')

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.15 })

    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [watch])
}

export default function LandingPage({ onNavigate, user = null, itemCount = 0 }) {
  const topPicks = useTopPicks()
  // Run again when Top picks appear, so that new section also animates.
  useRevealOnScroll(topPicks.length)

  const loggedIn = Boolean(user)
  const isStaff = user?.role === 'cafeteria_staff' || user?.role === 'super_admin' || user?.role === 'admin'

  function handleLinkClick(event, page) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return
    }

    event.preventDefault()
    onNavigate(page)
  }

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#landing-main">
        Skip to content
      </a>

      <div className="landing-topbar">
        <div className="landing-container">
          <span>Campus Cafeteria Pre-order System</span>
          <span>Browse the menu without an account</span>
        </div>
      </div>

      <header className="landing-container landing-header">
        <a
          className="landing-brand"
          href="/"
          aria-label="Queu home"
          onClick={(event) => handleLinkClick(event, 'landing')}
        >
          Queu
          <small>Campus Cafeteria</small>
        </a>

        <nav className="landing-nav" aria-label="Main navigation">
          <a
            href="/"
            aria-current="page"
            onClick={(event) => handleLinkClick(event, 'landing')}
          >
            Home
          </a>
          <a
            href="/menu"
            onClick={(event) => handleLinkClick(event, 'menu')}
          >
            Menu
          </a>
          {loggedIn && !isStaff && (
            <>
              <a href="/orders" onClick={(event) => handleLinkClick(event, 'orders')}>
                My orders
              </a>
              <a href="/feedback" onClick={(event) => handleLinkClick(event, 'feedback')}>
                Feedback
              </a>
            </>
          )}
          {loggedIn && isStaff && (
            <a href="/staff" onClick={(event) => handleLinkClick(event, 'home')}>
              Dashboard
            </a>
          )}
          {!loggedIn && (
            <a
              href="/login"
              onClick={(event) => handleLinkClick(event, 'login')}
            >
              Log in
            </a>
          )}
        </nav>

        {!loggedIn && (
          <a
            className="landing-pill"
            href="/register"
            onClick={(event) => handleLinkClick(event, 'register')}
          >
            Sign up <span aria-hidden="true">→</span>
          </a>
        )}

        {loggedIn && (
          <div className="landing-user">
            <span className="landing-user-name">
              Hi, <strong>{user.fname || 'there'}</strong>
            </span>
            {!isStaff && (
              <a
                className="landing-cart"
                href="/cart"
                onClick={(event) => handleLinkClick(event, 'cart')}
              >
                <span aria-hidden="true">🛒</span> Cart
                {itemCount > 0 && <span className="landing-cart-count">{itemCount}</span>}
              </a>
            )}
            <button
              type="button"
              className="landing-logout"
              onClick={() => onNavigate('login')}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main id="landing-main">
        {loggedIn && !isStaff && (
          <div className="landing-container landing-penalty">
            <PenaltyNotice />
          </div>
        )}

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-content">
            <div>
              <p className="landing-eyebrow">Good food | Less waiting</p>
              <h1 id="landing-title">
                <span>Hungry</span>
                <span className="landing-title-soft">between</span>
                <span className="landing-title-script">classes?</span>
              </h1>
              <p className="landing-description">
                Take a look at the cafeteria menu and find something for your
                next break. Pick your meals and check your cart before you
                head over.
              </p>

              <div className="landing-actions">
                <a
                  className="landing-pill"
                  href="/menu"
                  onClick={(event) => handleLinkClick(event, 'menu')}
                >
                  View menu <span aria-hidden="true">→</span>
                </a>
                {loggedIn ? (
                  <a
                    className="landing-button landing-button--outline"
                    href={isStaff ? '/staff' : '/orders'}
                    onClick={(event) => handleLinkClick(event, isStaff ? 'home' : 'orders')}
                  >
                    {isStaff ? 'Go to dashboard' : 'My orders'}
                  </a>
                ) : (
                  <a
                    className="landing-button landing-button--outline"
                    href="/register"
                    onClick={(event) => handleLinkClick(event, 'register')}
                  >
                    Create account
                  </a>
                )}
              </div>

              <ul className="landing-hero-points">
                {heroPoints.map((point) => (
                  <li key={point.text}>
                    <span aria-hidden="true">{point.icon}</span>
                    {point.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="landing-plate">
              <img
                src="/image.png"
                alt="Rice topped with burger patties and mushroom gravy"
                width="480"
                height="640"
              />
              <p className="landing-plate-badge">
                <strong>Fresh</strong> Meals, Happy Students
              </p>
            </div>
          </div>
        </section>

        <section
          className="landing-container landing-section reveal"
          aria-labelledby="benefits-title"
        >
          <div className="landing-benefits">
            <div>
              <h2 id="benefits-title">
                Know What You Want <em>Before You Get There</em>
              </h2>
              <p>Check the menu and plan your lunch whenever you have a moment.</p>
            </div>

            <ul>
              {benefits.map((benefit) => (
                <li key={benefit.number}>
                  <span aria-hidden="true">{benefit.number}</span>
                  <div>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {topPicks.length > 0 && (
          <section
            className="landing-container landing-section reveal"
            aria-labelledby="picks-title"
          >
            <p className="landing-eyebrow landing-center">Featured products</p>
            <div className="landing-section-title">
              <h2 id="picks-title">Top Picks</h2>
              <a
                href="/menu"
                onClick={(event) => handleLinkClick(event, 'menu')}
              >
                See all meals →
              </a>
            </div>

            <div className="landing-picks">
              {topPicks.map((item, index) => (
                <a
                  key={item.menu_item_id}
                  className="landing-pick"
                  href="/menu"
                  style={{ transitionDelay: `${index * 0.08}s` }}
                  onClick={(event) => handleLinkClick(event, 'menu')}
                >
                  <MealImage src={item.image_url || ''} alt={`Photo of ${item.name}`} />
                  <span className="landing-pick-tag">
                    {item.tag === 'Featured' && '♥ '}
                    {item.tag === 'Best Seller' && '★ '}
                    {item.tag}
                  </span>
                  <h3>{item.name}</h3>
                  <strong>{formatMoney(item.price)}</strong>
                </a>
              ))}
            </div>
          </section>
        )}

        <section
          className="landing-container landing-section reveal"
          aria-labelledby="collections-title"
        >
          <p className="landing-eyebrow landing-center">From our cafeteria</p>
          <div className="landing-section-title">
            <h2 id="collections-title">Discover Our Meals</h2>
            <a
              href="/menu"
              onClick={(event) => handleLinkClick(event, 'menu')}
            >
              View full menu →
            </a>
          </div>

          <div className="landing-collections">
            {collections.map((collection) => (
              <a
                className="landing-collection"
                key={collection.title}
                href="/menu"
                onClick={(event) => handleLinkClick(event, 'menu')}
              >
                <span className="landing-collection-icon" aria-hidden="true">
                  {collection.icon}
                </span>
                <h3>{collection.title}</h3>
                <p>{collection.text}</p>
                <span className="landing-collection-arrow" aria-hidden="true">
                  →
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="landing-container landing-offer reveal">
          <div className="landing-offer-banner">
            <div>
              <p>Order ahead</p>
              <h2>Order First</h2>
              <h3>Then pick up with your number</h3>
              <a
                className="landing-pill landing-pill--cream"
                href="/menu"
                onClick={(event) => handleLinkClick(event, 'menu')}
              >
                Order now <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="landing-ticket">
              <span>Your queue number</span>
              <strong>#12</strong>
              <span>Sample ticket</span>
            </div>
          </div>

          <div className="landing-steps-card">
            <h2>How It Works</h2>
            <ol>
              {steps.map((step, index) => (
                <li key={step}>
                  <span aria-hidden="true">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <a
              className="landing-button"
              href="/menu"
              onClick={(event) => handleLinkClick(event, 'menu')}
            >
              Start ordering
            </a>
          </div>
        </section>

        <section className="landing-container reveal" aria-label="Queu features">
          <ul className="landing-features">
            {features.map((feature) => (
              <li key={feature.title}>
                <span aria-hidden="true">{feature.icon}</span>
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-container reveal">
          <div className="landing-banner">
            <h2>
              Good Food. <em>Less Waiting.</em>
            </h2>
            <a
              className="landing-pill landing-pill--cream"
              href="/menu"
              onClick={(event) => handleLinkClick(event, 'menu')}
            >
              Browse the menu <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-content">
          <div>
            <a
              className="landing-brand"
              href="/"
              onClick={(event) => handleLinkClick(event, 'landing')}
            >
              Queu
              <small>Campus Cafeteria</small>
            </a>
            <p>A student project for our campus cafeteria.</p>
          </div>

          <div>
            <h3>Quick links</h3>
            {footerLinks.filter((link) => !loggedIn || (link.page !== 'login' && link.page !== 'register')).map((link) => (
              <a
                key={link.path}
                href={link.path}
                onClick={(event) => handleLinkClick(event, link.page)}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div>
            <h3>Our menu</h3>
            {collections.map((collection) => (
              <a
                key={collection.title}
                href="/menu"
                onClick={(event) => handleLinkClick(event, 'menu')}
              >
                {collection.title}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
