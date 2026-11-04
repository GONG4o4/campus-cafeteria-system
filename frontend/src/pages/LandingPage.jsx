import './LandingPage.css'

const benefits = [
  {
    number: '01',
    title: 'See what is available',
    description: 'Check the menu before heading to the cafeteria.',
  },
  {
    number: '02',
    title: 'Pick your meals',
    description: 'Add meals to your cart and check the total.',
  },
  {
    number: '03',
    title: 'Pick up with your number',
    description: 'Your queue number helps you find your meal at the counter.',
  },
]

const collections = [
  { icon: '🍛', title: 'Rice Meals', text: 'Filling plates for long class days.' },
  { icon: '🍔', title: 'Snacks', text: 'Quick bites between your classes.' },
  { icon: '🥤', title: 'Drinks', text: 'Something cold or hot for your break.' },
  { icon: '🍮', title: 'Desserts', text: 'A little something sweet after lunch.' },
]

const steps = [
  {
    title: 'Find something to eat',
    text: 'Take a look at the menu and choose your meals.',
  },
  {
    title: 'Log in and order',
    text: 'Sign in, check your cart, and confirm your order.',
  },
  {
    title: 'Get your queue number',
    text: 'Keep the number given after your order is confirmed.',
  },
  {
    title: 'Pick up your food',
    text: 'Head to the counter with your number when your meal is ready.',
  },
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

      <header className="landing-container landing-header">
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
          className="landing-brand"
          href="/"
          aria-label="Queu home"
          onClick={(event) => handleLinkClick(event, 'landing')}
        >
          Que<span>u</span>
        </a>

        <a
          className="landing-pill"
          href="/register"
          onClick={(event) => handleLinkClick(event, 'register')}
        >
          Sign up <span aria-hidden="true">→</span>
        </a>
      </header>

      <main id="landing-main">
        <section className="landing-container" aria-labelledby="landing-title">
          <div className="landing-hero-top">
            <h1 id="landing-title">
              <span>Hungry</span>
              <span className="landing-title-soft">between</span>
              <span className="landing-title-italic">classes?</span>
            </h1>

            <div className="landing-hero-copy">
              <p>
                Take a look at the cafeteria menu and find something for your
                next break. Pick your meals and check your cart before you
                head over.
              </p>
              <a
                className="landing-pill"
                href="/menu"
                onClick={(event) => handleLinkClick(event, 'menu')}
              >
                View menu <span aria-hidden="true">→</span>
              </a>
              <small>Just looking? You can browse without an account.</small>
            </div>
          </div>

          <div className="landing-hero-panel">
            <div className="landing-chips">
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

            <img
              src="/image.png"
              alt="Rice topped with burger patties and mushroom gravy"
              width="480"
              height="640"
            />

            <div className="landing-hero-note">
              <strong>Fresh Meals, Happy Students</strong>
              <p>Order first, then pick up with your queue number.</p>
              <a
                href="/register"
                onClick={(event) => handleLinkClick(event, 'register')}
              >
                Create account →
              </a>
            </div>
          </div>
        </section>

        <section
          className="landing-container landing-section"
          aria-labelledby="benefits-title"
        >
          <div className="landing-benefits">
            <div className="landing-benefits-intro">
              <h2 id="benefits-title">
                Know What You Want <em>Before You Get There</em>
              </h2>
              <p>Check the menu and plan your lunch whenever you have a moment.</p>
            </div>

            <div className="landing-benefit-list">
              {benefits.map((benefit) => (
                <article key={benefit.number}>
                  <span aria-hidden="true">{benefit.number}</span>
                  <div>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="landing-container landing-section"
          aria-labelledby="collections-title"
        >
          <h2 className="landing-heading" id="collections-title">
            Discover Meals <em>For Every Break</em>
          </h2>

          <div className="landing-collections">
            {collections.map((collection) => (
              <a
                className="landing-collection"
                key={collection.title}
                href="/menu"
                onClick={(event) => handleLinkClick(event, 'menu')}
              >
                <h3>{collection.title}</h3>
                <span className="landing-collection-icon" aria-hidden="true">
                  {collection.icon}
                </span>
                <p>{collection.text}</p>
                <span className="landing-collection-arrow" aria-hidden="true">
                  →
                </span>
              </a>
            ))}
          </div>
        </section>

        <section
          className="landing-container landing-section"
          aria-labelledby="workflow-title"
        >
          <h2 className="landing-heading" id="workflow-title">
            From Picking a Meal <em>To Picking It Up</em>
          </h2>

          <ol className="landing-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span aria-hidden="true">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-container landing-section">
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

      <footer className="landing-container landing-footer">
        <a
          className="landing-brand"
          href="/"
          onClick={(event) => handleLinkClick(event, 'landing')}
        >
          Que<span>u</span>
        </a>
        <p>Campus Cafeteria Pre-order System</p>
        <p>A student project for our campus cafeteria.</p>
      </footer>
    </div>
  )
}
