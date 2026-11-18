import { useEffect, useState } from 'react'
import Login from './pages/login.jsx'
import Register from './pages/register.jsx'
import OrderHistory from './pages/OrderHistory.jsx'
import Menu from './pages/Menu.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import LandingPage from './pages/LandingPage.jsx'
import OrderConfirmation from './pages/OrderConfirmation.jsx'
import PaymentSuccess from './pages/PaymentSuccess.jsx'
import PaymentCancelled from './pages/PaymentCancelled.jsx'
import CafeteriaLayout from './components/CafeteriaLayout.jsx'
import StaffNavigation from './components/StaffNavigation.jsx'
import StaffDashboard from './pages/StaffDashboard.jsx'
import StaffOrderQueue from './pages/StaffOrderQueue.jsx'
import StaffMenu from './pages/StaffMenu.jsx'
import StaffDailySummary from './pages/StaffDailySummary.jsx'

import AdminNavigation from './components/AdminNavigation.jsx'
import AdminOverview from './pages/AdminOverview.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminStaff from './pages/AdminStaff.jsx'
import AdminReports from './pages/AdminReports.jsx'
import AdminSettings from './pages/AdminSettings.jsx'
import AdminAuditLogs from './pages/AdminAuditLogs.jsx'

import { useCart } from './hooks/useCart'
import { getSessionUser } from './authApi.js'
import './App.css'
import './student.css'
import './pages/StaffDashboard.css'
import './pages/AdminDashboard.css' 

const protectedPaths = ['/home', '/cart', '/checkout', '/orders', '/payment/success', '/payment/cancelled', '/admin', '/staff']

function isConfirmationPath(path) {
  return /^\/order-confirmation\/[1-9]\d*$/.test(path)
}

function needsAuthentication(path) {
  return protectedPaths.includes(path) || isConfirmationPath(path) || isStaffPath(path) || isAdminPath(path)
}

function isStaffPath(path) {
  return path === '/staff' || path.startsWith('/staff/')
}

function isAdminPath(path) {
  return path === '/admin' || path.startsWith('/admin/')
}

function getAllowedPage(page, user) {
  if (page.startsWith('staff-') && user?.role !== 'cafeteria_staff') {
    return 'menu'
  }
  if (page.startsWith('admin-') && user?.role !== 'admin') {
    return 'menu'
  }

  if (
    user?.role === 'cafeteria_staff' &&
    ['menu', 'cart', 'checkout', 'orders', 'confirmation', 'payment-success', 'payment-cancelled'].includes(page)
  ) {
    return 'staff-dashboard'
  }

  if (
    user?.role === 'admin' &&
    ['menu', 'cart', 'checkout', 'orders', 'confirmation', 'payment-success', 'payment-cancelled'].includes(page)
  ) {
    return 'admin-overview'
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

  if (isAdminPath(path)) {
    return pages[path] || 'admin-overview'
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
  '/payment/success': 'payment-success',
  '/payment/cancelled': 'payment-cancelled',
  '/staff': 'staff-dashboard',
  '/staff/dashboard': 'staff-dashboard',
  '/staff/orders': 'staff-orders',
  '/staff/menu': 'staff-menu',
  '/staff/summary': 'staff-summary',
  '/admin': 'admin-overview',
  '/admin/users': 'admin-users',
  '/admin/staff': 'admin-staff',
  '/admin/reports': 'admin-reports',
  '/admin/settings': 'admin-settings',
  '/admin/logs': 'admin-logs',
}

const paths = {
  landing: '/',
  login: '/login',
  register: '/register',
  orders: '/orders',
  menu: '/menu',
  cart: '/cart',
  checkout: '/checkout',
  'payment-success': '/payment/success',
  'payment-cancelled': '/payment/cancelled',
  'staff-dashboard': '/staff',
  'staff-orders': '/staff/orders',
  'staff-menu': '/staff/menu',
  'staff-summary': '/staff/summary',
  'admin-overview': '/admin',
  'admin-users': '/admin/users',
  'admin-staff': '/admin/staff',
  'admin-reports': '/admin/reports',
  'admin-settings': '/admin/settings',
  'admin-logs': '/admin/logs',
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

  const [sessionUser, setSessionUser] = useState(null)
  const [sessionError, setSessionError] = useState('')

  const [page, setPage] = useState(() => {
    const path = window.location.pathname

    if (path === '/') return 'landing'
    if (path === '/menu') return 'menu'
    if (path === '/register') return 'register'
    
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
    if (!needsAuthentication(window.location.pathname)) return

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

        if (cancelled) return

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
        if (cancelled) return

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
      if (user?.role === 'cafeteria_staff') nextPage = 'staff-dashboard'
      else if (user?.role === 'admin') nextPage = 'admin-overview'
      else nextPage = 'menu'
    }

    const needsLogin = ['cart', 'checkout', 'orders', 'payment-success', 'payment-cancelled'].includes(nextPage) || nextPage.startsWith('staff-') || nextPage.startsWith('admin-')

    if (needsLogin && !localStorage.getItem('token')) {
      nextPage = 'login'
    }

    nextPage = getAllowedPage(nextPage, user)

    if (nextPage === 'login') {
      clearCart()
      setSessionUser(null)
      setSessionError('')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }

    setPage(nextPage)

    window.history.pushState({}, '', paths[nextPage] || '/login')
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

  if (page === 'register') return <Register onNavigate={handleNavigate} />
  if (page === 'landing') return <LandingPage onNavigate={handleNavigate} />

  if (page.startsWith('admin-') && sessionUser?.role === 'admin') {
    return (
      <AdminNavigation page={page} onNavigate={handleNavigate}>
        {page === 'admin-overview' && <AdminOverview onNavigate={handleNavigate} />}
        {page === 'admin-users' && <AdminUsers />}
        {page === 'admin-staff' && <AdminStaff />}
        {page === 'admin-reports' && <AdminReports />}
        {page === 'admin-settings' && <AdminSettings />}
        {page === 'admin-logs' && <AdminAuditLogs />}
      </AdminNavigation>
    )
  }

  // Staff Pages
  if (page.startsWith('staff-') && sessionUser?.role === 'cafeteria_staff') {
    return (
      <StaffNavigation page={page} onNavigate={handleNavigate}>
        {page === 'staff-dashboard' && <StaffDashboard onNavigate={handleNavigate} />}
        {page === 'staff-orders' && <StaffOrderQueue />}
        {page === 'staff-menu' && <StaffMenu />}
        {page === 'staff-summary' && <StaffDailySummary onNavigate={handleNavigate} />}
      </StaffNavigation>
    )
  }

  const isStudentPage = [
    'menu', 'cart', 'checkout', 'orders', 'confirmation', 'payment-success', 'payment-cancelled',
  ].includes(page)

  if (!isStudentPage) {
    return <Login onNavigate={handleNavigate} sessionError={sessionError} />
  }

  const confirmationId = Number(window.location.pathname.split('/').pop())

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

      {page === 'confirmation' && (
        <OrderConfirmation
          key={confirmationId}
          orderId={confirmationId}
          onNavigate={handleNavigate}
        />
      )}

      {page === 'payment-success' && (
        <PaymentSuccess onNavigate={handleNavigate} />
      )}

      {page === 'payment-cancelled' && (
        <PaymentCancelled onNavigate={handleNavigate} />
      )}
    </CafeteriaLayout>
  )
}

export default App