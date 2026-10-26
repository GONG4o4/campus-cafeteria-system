
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
import StaffNavigation from './components/StaffNavigation.jsx'
import StaffDashboard from './pages/StaffDashboard.jsx'
import StaffOrderQueue from './pages/StaffOrderQueue.jsx'
import StaffMenu from './pages/StaffMenu.jsx'
import StaffDailySummary from './pages/StaffDailySummary.jsx'
import { useCart } from './hooks/useCart'
import { getSessionUser } from './authApi.js'
import './App.css'
import './student.css'
import './pages/StaffDashboard.css'

const protectedPaths = ['/home', '/cart', '/checkout', '/orders']

function isConfirmationPath(path) {
  return /^\/order-confirmation\/[1-9]\d*$/.test(path)
}

function needsAuthentication(path) {
  return protectedPaths.includes(path) || isConfirmationPath(path) || isStaffPath(path)
}

function isStaffPath(path) {
  return path === '/staff' || path.startsWith('/staff/')
}

function getAllowedPage(page, user) {
  if (page.startsWith('staff-') && user?.role !== 'cafeteria_staff') {
    return 'menu'
  }

  if (
    user?.role === 'cafeteria_staff' &&
    ['menu', 'cart', 'checkout', 'orders', 'confirmation'].includes(page)
  ) {
    return 'staff-dashboard'
  }

  return page
}

function getPage(path) {
  if (isConfirmationPath(path)) {
    return 'confirmation'
  }

  if (isStaffPath(path)) {
    return pages[path] || 'staff-dashboard'
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
  '/staff': 'staff-dashboard',
  '/staff/dashboard': 'staff-dashboard',
  '/staff/orders': 'staff-orders',
  '/staff/menu': 'staff-menu',
  '/staff/summary': 'staff-summary',
}

const paths = {
  landing: '/',
  login: '/login',
  register: '/register',
  orders: '/orders',
  menu: '/menu',
  cart: '/cart',
  checkout: '/checkout',
  'staff-dashboard': '/staff',
  'staff-orders': '/staff/orders',
  'staff-menu': '/staff/menu',
  'staff-summary': '/staff/summary',
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
  const [sessionUser, setSessionUser] = useState(null)
  const [sessionError, setSessionError] = useState('')

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
        const user = await getSessionUser(token)

        if (cancelled) {
          return
        }

        if (user) {
          setSessionUser(user)
          const requestedPage = getPage(window.location.pathname)
          const allowedPage = getAllowedPage(requestedPage, user)
          setPage(allowedPage)

          if (allowedPage !== requestedPage) {
            window.history.replaceState({}, '', paths[allowedPage])
          }
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setPage('login')
          window.history.replaceState({}, '', '/login')
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        setSessionError(error.message || 'Unable to check your session.')
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
        setSessionUser(null)
        setPage('login')
        window.history.replaceState({}, '', '/login')
      } else {
        const requestedPage = getPage(path)
        const allowedPage = getAllowedPage(requestedPage, sessionUser)
        setPage(allowedPage)

        if (allowedPage !== requestedPage) {
          window.history.replaceState({}, '', paths[allowedPage])
        }
      }
    }

    window.addEventListener('popstate', handleBack)

    return () => window.removeEventListener('popstate', handleBack)
  }, [sessionUser])

  const handleNavigate = (nextPage, signedInUser) => {
    const user = signedInUser || sessionUser

    if (signedInUser) {
      setSessionUser(signedInUser)
      setSessionError('')
    }

    if (nextPage === 'home') {
      nextPage = user?.role === 'cafeteria_staff' ? 'staff-dashboard' : 'menu'
    }

    const needsLogin = ['cart', 'checkout', 'orders'].includes(nextPage) || nextPage.startsWith('staff-')

    if (needsLogin && !localStorage.getItem('token')) {
      nextPage = 'login'
    }

    nextPage = getAllowedPage(nextPage, user)

    if (nextPage === 'login') {
      clearCart()
      setConfirmedOrder(null)
      setSessionUser(null)
      setSessionError('')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }

    setPage(nextPage)

    window.history.pushState({}, '', paths[nextPage] || '/login')
    window.scrollTo(0, 0)
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

  if (page.startsWith('staff-') && sessionUser?.role === 'cafeteria_staff') {
    return (
      <StaffNavigation page={page} onNavigate={handleNavigate}>
        {page === 'staff-dashboard' && <StaffDashboard onNavigate={handleNavigate} />}
        {page === 'staff-orders' && <StaffOrderQueue onNavigate={handleNavigate} />}
        {page === 'staff-menu' && <StaffMenu />}
        {page === 'staff-summary' && <StaffDailySummary onNavigate={handleNavigate} />}
      </StaffNavigation>
    )
  }

  const isStudentPage = [
    'menu',
    'cart',
    'checkout',
    'orders',
    'confirmation',
  ].includes(page)

  if (!isStudentPage) {
    return <Login onNavigate={handleNavigate} sessionError={sessionError} />
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
