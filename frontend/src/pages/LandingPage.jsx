import MealCarousel from '../components/landing/MealCarousel'
import './LandingPage.css'

const benefits = [
  {
    number: '01',
    title: 'Browse before your break',
    description: 'Explore the cafeteria menu and see which meals are available before deciding what to eat.',
  },
  {
    number: '02',
    title: 'Plan your next meal',
    description: 'Build your cart and review your selections. The pre-order flow is designed to fit around your classes.',
  },
  {
    number: '03',
    title: 'Know when to collect',
    description: 'The ordering flow uses a queue number to identify your order when it is ready for collection.',
  },
]

const steps = [
  { title: 'Browse the menu', text: 'Find a meal from the available cafeteria options.' },
  { title: 'Log in and order', text: 'Sign in, choose your meals, and review your order.' },
  { title: 'Receive a queue number', text: 'A confirmed pre-order is assigned a pickup number.' },
  { title: 'Collect when ready', text: 'Use your queue number to collect at the cafeteria.' },
]

export default function LandingPage({ onNavigate }) {
  function handleLinkClick(event, page) {
    // Keep normal browser behavior for opening a link in another tab.
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

      <header className="landing-header">
        <div className="landing-container landing-header-content">
          <a
            className="landing-brand"
            href="/"
            aria-label="Queu home"
            onClick={(event) => handleLinkClick(event, 'landing')}
          >
            Que<span>u</span>
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
              Browse Menu
            </a>
            <a
              href="/login"
              onClick={(event) => handleLinkClick(event, 'login')}
            >
              Log In
            </a>
            <a
              className="app-button landing-button"
              href="/register"
              onClick={(event) => handleLinkClick(event, 'register')}
            >
              Register
            </a>
          </nav>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-content">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow">YOUR CAMPUS. YOUR CAFETERIA.</p>
              <h1 id="landing-title">
                A good meal.<br />
                A better <span>campus break.</span>
              </h1>
              <p className="landing-description">
                Meet Queu, your campus cafeteria pre-order system. Explore meals,
                plan your order, and make a little more room in your day.
              </p>

              <div className="landing-actions">
                <a
                  className="app-button landing-button"
                  href="/menu"
                  onClick={(event) => handleLinkClick(event, 'menu')}
                >
                  Browse Menu <span aria-hidden="true">→</span>
                </a>
                <a
                  className="app-button app-button--secondary landing-button"
                  href="/register"
                  onClick={(event) => handleLinkClick(event, 'register')}
                >
                  Get Started
                </a>
              </div>
              <p className="landing-small-note">
                Browse freely. Sign in when you are ready to order.
              </p>
            </div>

            <MealCarousel />
          </div>
        </section>

        <section
          className="landing-benefits landing-container"
          aria-labelledby="benefits-title"
        >
          <div className="landing-section-intro">
            <p className="landing-eyebrow">A LITTLE LESS HASSLE</p>
            <h2 id="benefits-title">Your next meal, a little easier.</h2>
            <p>A simple way to connect your class schedule with your cafeteria plans.</p>
          </div>

          <div className="landing-benefit-grid">
            {benefits.map((benefit) => (
              <article className="landing-benefit-card" key={benefit.number}>
                <span className="landing-card-number" aria-hidden="true">
                  {benefit.number}
                </span>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-workflow" aria-labelledby="workflow-title">
          <div className="landing-container">
            <div className="landing-section-intro">
              <p className="landing-eyebrow">HOW IT WORKS</p>
              <h2 id="workflow-title">From your next class to your next meal.</h2>
              <p>The planned pre-order journey, in four simple steps.</p>
            </div>

            <ol className="landing-steps">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="landing-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>

            <p className="landing-workflow-note">
              Pre-order submission and live pickup tracking are still being
              connected. You can browse the menu and create an account now.
            </p>
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
              Que<span>u</span>
            </a>
            <p>Campus Cafeteria Pre-order System</p>
          </div>
          <p>A campus project, built around student life.</p>
        </div>
      </footer>
    </div>
  )
}
