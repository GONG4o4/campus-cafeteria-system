import { useEffect, useState } from 'react'
import MenuCard, { MenuCardSkeleton } from '../components/menu/MenuCard'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import { getBestSellerIds } from '../menuApi'
import MealImage from '../components/menu/MealImage'
import { formatMoney } from '../utils/orders'

export default function Menu({ onAdd }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  // Empty until the backend answers, so no badge shows while loading.
  const [bestSellerIds, setBestSellerIds] = useState([])

  const search = searchTerm.trim().toLowerCase()
  const filteredItems = items
    .filter((item) => item.name.toLowerCase().includes(search))
    .filter((item) => availabilityFilter === 'all' || item.is_available === true)

  // Top picks = featured meals first, then best sellers. Only meals that
  // can be ordered right now, and each meal only once.
  const topPicks = []

  for (const item of items) {
    if (item.is_featured === true && item.is_available === true) {
      topPicks.push(item)
    }
  }

  for (const id of bestSellerIds) {
    const item = items.find((meal) => meal.menu_item_id === id)

    if (item && item.is_available === true && !topPicks.includes(item)) {
      topPicks.push(item)
    }
  }

  const shownPicks = topPicks.slice(0, 8)

  // First load = nothing to show yet. Later refreshes keep the current cards on screen.
  const firstLoad = loading && items.length === 0

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

  // Best sellers load separately from the menu. If this request fails,
  // the menu still works and simply shows no badges.
  useEffect(() => {
    const controller = new AbortController()

    getBestSellerIds(controller.signal)
      .then((ids) => {
        if (!controller.signal.aborted) {
          setBestSellerIds(ids)
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          console.error('Best sellers failed to load:', requestError.message)
          setBestSellerIds([])
        }
      })

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

      {!error && !search && shownPicks.length > 0 && (
        <section className="top-picks" aria-labelledby="top-picks-heading">
          <div className="top-picks-heading">
            <h2 id="top-picks-heading">Top picks for you</h2>
            <p>Featured meals and this month's best sellers.</p>
          </div>

          <ul className="top-picks-list">
            {shownPicks.map((item) => (
              <li key={item.menu_item_id} className="top-pick">
                <MealImage src={item.image_url || ''} alt={`Photo of ${item.name}`} />
                <span className="top-pick-tag">
                  {item.is_featured === true ? '♥ Featured' : '★ Best Seller'}
                </span>
                <h3>{item.name}</h3>
                <div className="top-pick-footer">
                  <strong>{formatMoney(item.price)}</strong>
                  <Button onClick={() => handleAddItem(item)} aria-label={`Add ${item.name} to cart`}>
                    Add
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {firstLoad && (
        <>
          <Loading>Loading the menu...</Loading>
          <div className="menu-grid" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((number) => (
              <MenuCardSkeleton key={number} />
            ))}
          </div>
        </>
      )}

      {loading && !firstLoad && <Loading>Refreshing the menu...</Loading>}

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

      {!firstLoad && !error && items.length > 0 && filteredItems.length === 0 && (
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

      {!firstLoad && !error && filteredItems.length > 0 && (
        <div className="menu-grid">
          {filteredItems.map((item) => (
            <MenuCard
              key={item.menu_item_id}
              item={item}
              onAdd={handleAddItem}
              isBestSeller={bestSellerIds.includes(item.menu_item_id)}
            />
          ))}
        </div>
      )}
    </main>
  )
}