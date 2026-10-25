import './LandingPage.css'

const benefits = [
  {
    number: '01',
    title: 'See what is available',
    description:
      'Check the menu before heading to the cafeteria and decide what you feel like eating.',
  },
  {
    number: '02',
    title: 'Pick your meals',
    description:
      'Add meals to your cart, change the quantities, and check the total before you continue.',
  },
  {
    number: '03',
    title: 'Pick up with your number',
    description:
      'Once an order is confirmed, its queue number helps you identify your meal at the counter.',
  },
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
              Menu
            </a>
            <a
              href="/login"
              onClick={(event) => handleLinkClick(event, 'login')}
            >
              Log in
            </a>
            <a
              className="app-button landing-button"
              href="/register"
              onClick={(event) => handleLinkClick(event, 'register')}
            >
              Sign up
            </a>
          </nav>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-content">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow">Welcome to Queu</p>
              <h1 id="landing-title">
                Hungry<br />
                <span>between classes?</span>
              </h1>
              <p className="landing-description">
                Take a look at the cafeteria menu and find something for your
                next break. Pick your meals and check your cart before you
                head over.
              </p>

              <div className="landing-actions">
                <a
                  className="app-button landing-button"
                  href="/menu"
                  onClick={(event) => handleLinkClick(event, 'menu')}
                >
                  View menu <span aria-hidden="true">→</span>
                </a>
                <a
                  className="app-button app-button--secondary landing-button"
                  href="/register"
                  onClick={(event) => handleLinkClick(event, 'register')}
                >
                  Create account
                </a>
              </div>
              <p className="landing-small-note">
                Just looking? You can browse the menu without an account.
              </p>
            </div>

            <figure className="landing-visual">
              <img
                src="/image.png"
                alt="Rice topped with burger patties and mushroom gravy"
                width="600"
                height="480"
              />
              <figcaption>Fresh Meals, Happy Students</figcaption>
            </figure>
          </div>
        </section>

        <section
          className="landing-benefits landing-container"
          aria-labelledby="benefits-title"
        >
          <div className="landing-section-intro">
            <p className="landing-eyebrow">Why use Queu?</p>
            <h2 id="benefits-title">Know what you want before you get there.</h2>
            <p>Check the menu and plan your lunch whenever you have a moment.</p>
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
              <p className="landing-eyebrow">How it works</p>
              <h2 id="workflow-title">From picking a meal to picking it up.</h2>
              <p>Here is how pre-ordering will work.</p>
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
              We are still getting online orders and pickup updates ready.
              You can browse meals and build your cart in the meantime.
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
          <p>A student project for our campus cafeteria.</p>
        </div>
      </footer>
    </div>
  )
}
