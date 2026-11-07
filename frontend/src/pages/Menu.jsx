import { useEffect, useState } from 'react'
import MenuCard from '../components/menu/MenuCard'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'

export default function Menu({ onAdd }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')

  const search = searchTerm.trim().toLowerCase()
  const filteredItems = items
    .filter((item) => item.name.toLowerCase().includes(search))
    .filter((item) => availabilityFilter === 'all' || item.is_available === true)

  function handleAddItem(item) {
    if (item.is_available !== true) return
    onAdd(item)
    setMessage(`${item.name} added to your cart.`)
  }

  function handleRetry() {
    setMessage('')
    setReload((current) => current + 1)
  }

  useEffect(() => {
    function refreshMenu() {
      setReload((current) => current + 1)
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        refreshMenu()
      }
    }

    function handleStorage(event) {
      if (event.key === 'menu-updated-at') {
        refreshMenu()
      }
    }

    window.addEventListener('focus', refreshMenu)
    window.addEventListener('menu-updated', refreshMenu)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', refreshMenu)
      window.removeEventListener('menu-updated', refreshMenu)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadMenu() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('http://localhost:3000/api/menu', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Unable to load the menu. Please try again.')
        }

        const data = await response.json()

        if (!Array.isArray(data)) {
          throw new Error('The menu service returned an invalid menu list.')
        }

        if (!controller.signal.aborted) {
          setItems(data)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof TypeError
              ? 'Unable to connect to the backend. Make sure it is running.'
              : requestError.message || 'Unable to load the menu.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }
    loadMenu()
    return () => controller.abort()
  }, [reload])

  return (
    <main className="student-page">
      <div className="page-intro">
        <div>
          <h1>Menu</h1>
          <p>Choose your meals and add them to your cart.</p>
        </div>
        <Button variant="secondary" disabled={loading} onClick={handleRetry}>
          Refresh menu
        </Button>
      </div>

      {message && <Alert>{message}</Alert>}

      {!error && items.length > 0 && (
        <div className="menu-search">
          <label htmlFor="menu-search-input">Search meals</label>
          <input
            id="menu-search-input"
            type="search"
            placeholder="Type a meal name"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      )}

      {!error && items.length > 0 && (
        <div className="menu-filter" role="group" aria-label="Filter by availability">
          <button
            type="button"
            aria-pressed={availabilityFilter === 'all'}
            onClick={() => setAvailabilityFilter('all')}
          >
            All meals
          </button>
          <button
            type="button"
            aria-pressed={availabilityFilter === 'available'}
            onClick={() => setAvailabilityFilter('available')}
          >
            Available only
          </button>
        </div>
      )}

      {loading && <Loading>Loading the menu...</Loading>}

      {!loading && error && (
        <Alert error>
          <p>{error}</p>
          <Button variant="secondary" onClick={handleRetry}>
            Try again
          </Button>
        </Alert>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="student-empty">
          <h2>No meals yet</h2>
          <p>Check back when the cafeteria updates the menu.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && filteredItems.length === 0 && (
        <div className="student-empty">
          <h2>No meals found</h2>
          <p>
            {search
              ? 'No meals match your search. Try a different term or clear the search.'
              : 'There are currently no available meals. Try switching to "All meals".'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
            {search && (
              <Button variant="secondary" onClick={() => setSearchTerm('')}>
                Clear search
              </Button>
            )}
            {availabilityFilter === 'available' && (
              <Button variant="secondary" onClick={() => setAvailabilityFilter('all')}>
                Show all meals
              </Button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <div className="menu-grid">
          {filteredItems.map((item) => (
            <MenuCard
              key={item.menu_item_id}
              item={item}
              onAdd={handleAddItem}
            />
          ))}
        </div>
      )}
    </main>
  )
}