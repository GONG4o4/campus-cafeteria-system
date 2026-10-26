import { useEffect, useState } from 'react'
import Login from './pages/login.jsx'
import Register from './pages/register.jsx'
import OrderHistory from './pages/OrderHistory.jsx'
import StudentOrdering from './pages/StudentOrdering.jsx'
import StudentLayout from './components/StudentLayout.jsx'
import { mockOrders } from './data/mockOrders'
import { verifyToken } from './authApi.js'
import './App.css'

const paths = {
  login: '/login',
  register: '/register',
  menu: '/home',
  cart: '/cart',
  checkout: '/checkout',
  confirmation: '/confirmation',
  orders: '/orders',
}

function pageFromPath(path) {
  if (path === '/register') return 'register'
  if (path === '/cart') return 'cart'
  if (path === '/checkout') return 'checkout'
  if (path === '/confirmation') return 'confirmation'
  if (path === '/orders') return 'orders'
  if (path === '/home' || path === '/menu') return 'menu'
  return 'login'
}

function App() {
  const [page, setPage] = useState(() => {
    const initialPage = pageFromPath(window.location.pathname)
    const needsSession = !['login', 'register'].includes(initialPage)
    if (needsSession && !localStorage.getItem('token')) return 'login'
    return needsSession ? 'checking' : initialPage
  })
  const [checkingToken, setCheckingToken] = useState(
    !['login', 'register'].includes(pageFromPath(window.location.pathname)) &&
      Boolean(localStorage.getItem('token')),
  )
  const [cart, setCart] = useState({})
  const [demoOrders, setDemoOrders] = useState([])
  const [lastOrder, setLastOrder] = useState(null)

  useEffect(() => {
    const initialPage = pageFromPath(window.location.pathname)

    if (initialPage === 'login' || initialPage === 'register') {
      return undefined
    }

    const token = localStorage.getItem('token')

    if (!token) {
      localStorage.removeItem('user')
      window.history.replaceState({}, '', paths.login)
      return undefined
    }
 
    let cancelled = false

    async function checkToken() {
      try {
        const valid = await verifyToken(token)

        if (cancelled) return

        if (valid) {
          setPage(initialPage)
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setPage('login')
          window.history.replaceState({}, '', paths.login)
        }
      } catch {
        if (cancelled) return
        setPage('login')
        window.history.replaceState({}, '', paths.login)
      } finally {
        if (!cancelled) setCheckingToken(false)
      }
    }

    checkToken()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const nextPage = pageFromPath(window.location.pathname)
      const protectedPage = !['login', 'register'].includes(nextPage)

      if (protectedPage && !localStorage.getItem('token')) {
        window.history.replaceState({}, '', paths.login)
        setPage('login')
        return
      }

      setPage(nextPage)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleNavigate = (nextPage) => {
    let destination = nextPage

    if (
      !['login', 'register'].includes(destination) &&
      !localStorage.getItem('token')
    ) {
      destination = 'login'
    }

    if (destination === 'login') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setCart({})
      setDemoOrders([])
      setLastOrder(null)
    }

    setPage(destination)
    window.history.pushState(
      {},
      '',
      paths[destination] || paths.login,
    )
  }

  const handlePlaceOrder = (items) => {
    const orderNumber = demoOrders.length + 1
    const order = {
      id: `demo-${Date.now()}`,
      reference: `DEMO-${String(orderNumber).padStart(4, '0')}`,
      queueNumber: String(orderNumber + 14).padStart(3, '0'),
      status: 'pending',
      createdAt: new Date().toISOString(),
      items: items.map((item) => ({ ...item })),
    }

    setDemoOrders((currentOrders) => [order, ...currentOrders])
    setLastOrder(order)
    setCart({})
    handleNavigate('confirmation')
  }

  if (checkingToken) {
    return (
      <main className="app-loading" role="status">
        Checking your session…
      </main>
    )
  }

  if (page === 'register') return <Register onNavigate={handleNavigate} />
  if (page === 'login') return <Login onNavigate={handleNavigate} />

  return (
    <StudentLayout
      activePage={page}
      cartCount={Object.values(cart).reduce(
        (count, item) => count + item.quantity,
        0,
      )}
      onNavigate={handleNavigate}
    >
      {page === 'orders' ? (
        <OrderHistory orders={[...demoOrders, ...mockOrders]} />
      ) : (
        <StudentOrdering
          page={page}
          cart={cart}
          setCart={setCart}
          onNavigate={handleNavigate}
          onPlaceOrder={handlePlaceOrder}
          lastOrder={lastOrder}
        />
      )}
    </StudentLayout>
  )
}

export default App
