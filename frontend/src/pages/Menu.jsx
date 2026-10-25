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

  function handleAddItem(item) {
    onAdd(item)
    setMessage(`${item.name} added to your cart.`)
  }

  function handleRetry() {
    setReload(reload + 1)
  }

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

        if (!controller.signal.aborted) {
          setItems(data)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message || 'Unable to load the menu.')
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
      </div>

      {message && <Alert>{message}</Alert>}

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

      {!loading && !error && items.length > 0 && (
        <div className="menu-grid">
          {items.map((item) => (
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
