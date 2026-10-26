
import { useEffect, useState } from 'react'
import Login from './pages/login.jsx'
import Register from './pages/register.jsx'
import OrderHistory from './pages/OrderHistory.jsx'
import Menu from './pages/Menu.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import LandingPage from './pages/LandingPage.jsx'
import OrderConfirmation from './pages/OrderConfirmation.jsx'
import CafeteriaLayout from './components/CafeteriaLayout.jsx'
import { useCart } from './hooks/useCart'
import { verifyToken } from './authApi.js'
import './App.css'
import './student.css'

const protectedPaths = ['/home', '/cart', '/checkout', '/orders']

function isConfirmationPath(path) {
  return /^\/order-confirmation\/[1-9]\d*$/.test(path)
}

function needsAuthentication(path) {
  return protectedPaths.includes(path) || isConfirmationPath(path)
}

function getPage(path) {
  if (isConfirmationPath(path)) {
    return 'confirmation'
  }

  return pages[path] || 'login'
}

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
    removeOrderedItems,
    itemCount,
    total,
    checkoutItems,
  } = useCart()

  const [confirmedOrder, setConfirmedOrder] = useState(null)

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

    if (needsAuthentication(path) && localStorage.getItem('token')) {
      return 'checking'
    }

    return 'login'
  })

  const [checkingToken, setCheckingToken] = useState(
    needsAuthentication(window.location.pathname) &&
      Boolean(localStorage.getItem('token')),
  )

  useEffect(() => {
    if (!needsAuthentication(window.location.pathname)) {
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
          setPage(getPage(window.location.pathname))
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

      if (needsAuthentication(path) && !localStorage.getItem('token')) {
        setPage('login')
        window.history.replaceState({}, '', '/login')
      } else {
        setPage(getPage(path))
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
      setConfirmedOrder(null)
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

  function handleOrderPlaced(order, selections, token) {
    if (!token || token !== localStorage.getItem('token')) {
      return
    }

    setConfirmedOrder(order)
    removeOrderedItems(selections)
    setPage('confirmation')
    window.history.pushState({}, '', `/order-confirmation/${order.order_id}`)
    window.scrollTo(0, 0)
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

  const isStudentPage = [
    'menu',
    'cart',
    'checkout',
    'orders',
    'confirmation',
  ].includes(page)

  if (!isStudentPage) {
    return <Login onNavigate={handleNavigate} />
  }

  const confirmationId = Number(window.location.pathname.split('/').pop())
  let receipt = null

  if (confirmedOrder?.order_id === confirmationId) {
    receipt = confirmedOrder
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
          onOrderPlaced={handleOrderPlaced}
        />
      )}

      {page === 'orders' && <OrderHistory />}

      {page === 'confirmation' && (
        <OrderConfirmation
          key={confirmationId}
          order={receipt}
          orderId={confirmationId}
          onNavigate={handleNavigate}
        />
      )}
    </CafeteriaLayout>
  )
}

export default App
