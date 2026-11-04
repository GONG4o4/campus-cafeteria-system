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

export default function LandingPage({ onNavigate }) {
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
          <a
            href="/login"
            onClick={(event) => handleLinkClick(event, 'login')}
          >
            Log in
          </a>
        </nav>

        <a
          className="landing-pill"
          href="/register"
          onClick={(event) => handleLinkClick(event, 'register')}
        >
          Sign up <span aria-hidden="true">→</span>
        </a>
      </header>

      <main id="landing-main">
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
                <a
                  className="landing-button landing-button--outline"
                  href="/register"
                  onClick={(event) => handleLinkClick(event, 'register')}
                >
                  Create account
                </a>
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
          className="landing-container landing-section"
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

        <section
          className="landing-container landing-section"
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

        <section className="landing-container landing-offer">
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

        <section className="landing-container" aria-label="Queu features">
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

        <section className="landing-container">
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
            {footerLinks.map((link) => (
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
