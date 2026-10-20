
import { useEffect, useState } from 'react'
import Login from './pages/login.jsx'
import Register from './pages/register.jsx'
import { verifyToken } from './authApi.js'
import './App.css'

function App() {
  const [page, setPage] = useState(() => {
    const path = window.location.pathname

    if (path === '/register') return 'register'
    if (path === '/home') return 'checking'
    return 'login'
  })

  const [checkingToken, setCheckingToken] = useState(
    window.location.pathname === '/home'
  )

  useEffect(() => {
    if (window.location.pathname !== '/home') {
      setCheckingToken(false)
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      localStorage.removeItem('user')
      setPage('login')
      setCheckingToken(false)
      window.history.replaceState({}, '', '/login')
      return
    }

    let cancelled = false

    async function checkToken() {
      try {
        const valid = await verifyToken(token)

        if (cancelled) return

        if (valid) {
          setPage('home')
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setPage('login')
          window.history.replaceState({}, '', '/login')
        }
      } catch {
        if (cancelled) return
        setPage('login')
        window.history.replaceState({}, '', '/login')
      } finally {
        if (!cancelled) setCheckingToken(false)
      }
    }

    checkToken()

    return () => {
      cancelled = true
    }
  }, [])

  const handleNavigate = (nextPage) => {
    if (nextPage === 'home' && !localStorage.getItem('token')) {
      nextPage = 'login'
    }

    if (nextPage === 'login') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }

    setPage(nextPage)

    const paths = {
      login: '/login',
      register: '/register',
      home: '/home',
    }

    window.history.pushState({}, '', paths[nextPage] || '/login')
  }

  if (checkingToken) {
    return <main style={{ padding: '2rem' }}>Checking your session...</main>
  }

  return (
    <>
      {page === 'register' ? (
        <Register onNavigate={handleNavigate} />
      ) : page === 'home' ? (
        <main style={{ padding: '2rem' }}>
          <h1>Welcome to Queu!</h1>
          <p>You have successfully logged in.</p>
          <button onClick={() => handleNavigate('login')}>
            Log out
          </button>
        </main>
      ) : (
        <Login onNavigate={handleNavigate} />
      )}
    </>
  )
}

export default App
