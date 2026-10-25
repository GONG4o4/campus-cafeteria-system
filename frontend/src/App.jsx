
import { useEffect, useState } from 'react'
import Login from './pages/login.jsx'
import Register from './pages/register.jsx'
import OrderHistory from './pages/OrderHistory.jsx'
import Menu from './pages/Menu.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import LandingPage from './pages/LandingPage.jsx'
import CafeteriaLayout from './components/CafeteriaLayout.jsx'
import { useCart } from './hooks/useCart'
import { verifyToken } from './authApi.js'
import './App.css'
import './student.css'

const protectedPaths = ['/home', '/cart', '/checkout', '/orders']
const pages = {
  '/': 'landing',
  '/home': 'menu',
  '/menu': 'menu',
  '/cart': 'cart',
  '/checkout': 'checkout',
  '/orders': 'orders',
  '/register': 'register',
}

function App() {
  const {
    cart,
    addItem,
    changeQuantity,
    removeItem,
    clearCart,
    itemCount,
    total,
    checkoutItems,
  } = useCart()
  const [page, setPage] = useState(() => {
    const path = window.location.pathname

    if (path === '/') {
      return 'landing'
    }

    if (path === '/menu') {
      return 'menu'
    }

    if (path === '/register') {
      return 'register'
    }

    if (protectedPaths.includes(path) && localStorage.getItem('token')) {
      return 'checking'
    }

    return 'login'
  })

  const [checkingToken, setCheckingToken] = useState(
    protectedPaths.includes(window.location.pathname) &&
      Boolean(localStorage.getItem('token')),
  )

  useEffect(() => {
    if (!protectedPaths.includes(window.location.pathname)) {
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      localStorage.removeItem('user')
      window.history.replaceState({}, '', '/login')
      return
    }

    let cancelled = false

    async function checkToken() {
      try {
        const valid = await verifyToken(token)

        if (cancelled) {
          return
        }

        if (valid) {
          setPage(pages[window.location.pathname])
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setPage('login')
          window.history.replaceState({}, '', '/login')
        }
      } catch {
        if (cancelled) {
          return
        }
        setPage('login')
        window.history.replaceState({}, '', '/login')
      } finally {
        if (!cancelled) {
          setCheckingToken(false)
        }
      }
    }

    checkToken()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleBack() {
      const path = window.location.pathname
      if (protectedPaths.includes(path) && !localStorage.getItem('token')) {
        setPage('login')
        window.history.replaceState({}, '', '/login')
      } else {
        setPage(pages[path] || 'login')
      }
    }
    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [])

  const handleNavigate = (nextPage) => {
    if (nextPage === 'home') {
      nextPage = 'menu'
    }

    const needsLogin = ['cart', 'checkout', 'orders'].includes(nextPage)

    if (needsLogin && !localStorage.getItem('token')) {
      nextPage = 'login'
    }

    if (nextPage === 'login') {
      clearCart()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }

    setPage(nextPage)

    const paths = {
      landing: '/',
      login: '/login',
      register: '/register',
      home: '/home',
      orders: '/orders',
      menu: '/menu',
      cart: '/cart',
      checkout: '/checkout',
    }

    window.history.pushState({}, '', paths[nextPage] || '/login')
  }

  function handleAddToCart(item) {
    if (!localStorage.getItem('token')) {
      handleNavigate('login')
      return
    }

    addItem(item)
  }

  if (checkingToken) {
    return <main style={{ padding: '2rem' }}>Checking your session...</main>
  }

  if (page === 'register') {
    return <Register onNavigate={handleNavigate} />
  }

  if (page === 'landing') {
    return <LandingPage onNavigate={handleNavigate} />
  }

  const isStudentPage = ['menu', 'cart', 'checkout', 'orders'].includes(page)

  if (!isStudentPage) {
    return <Login onNavigate={handleNavigate} />
  }

  return (
    <CafeteriaLayout
      page={page}
      itemCount={itemCount}
      onNavigate={handleNavigate}
      authenticated={Boolean(localStorage.getItem('token'))}
    >
      {page === 'menu' && <Menu onAdd={handleAddToCart} />}
      {page === 'cart' && (
        <Cart
          cart={cart}
          total={total}
          onQuantityChange={changeQuantity}
          onRemove={removeItem}
          onClear={clearCart}
          onNavigate={handleNavigate}
        />
      )}
      {page === 'checkout' && (
        <Checkout
          cart={cart}
          checkoutItems={checkoutItems}
          total={total}
          onNavigate={handleNavigate}
        />
      )}
      {page === 'orders' && <OrderHistory />}
    </CafeteriaLayout>
  )
}

export default App
