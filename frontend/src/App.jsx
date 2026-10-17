import { useEffect, useState } from 'react'
import Login from './pages/login.jsx'
import Register from './pages/register.jsx'

function App() {
  const [page, setPage] = useState(
    window.location.pathname === '/register' ? 'register' : 'login',
  )

  useEffect(() => {
    const handlePopState = () => {
      setPage(window.location.pathname === '/register' ? 'register' : 'login')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPage) => {
    const path = nextPage === 'register' ? '/register' : '/login'
    window.history.pushState({}, '', path)
    setPage(nextPage)
  }

  return page === 'register' ? (
    <Register onNavigate={navigate} />
  ) : (
    <Login onNavigate={navigate} />
  )
}

export default App
