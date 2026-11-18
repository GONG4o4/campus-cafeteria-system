import { useEffect, useRef, useState } from 'react'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import MealForm from '../components/menu/MealForm'
import MealImage from '../components/menu/MealImage'
import { deleteMeal, getMenu, notifyMenuChanged, saveMeal } from '../menuApi'
import { formatMoney } from '../utils/orders'
import './StaffMenu.css'

export default function StaffMenu() {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingMeal, setEditingMeal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')
  const [saveStatusUnknown, setSaveStatusUnknown] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadMenu() {
      setLoading(true)
      setError('')

      try {
        const data = await getMenu(controller.signal)

        if (!controller.signal.aborted) {
          setMeals(data)
          setSaveStatusUnknown(false)
          setSaveError('')
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

  function openForm(meal = null) {
    setEditingMeal(meal)
    setSaveError('')
    setMessage('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingMeal(null)

    if (!saveStatusUnknown) {
      setSaveError('')
    }
  }

  async function handleSave(values, meal, changingAvailability = false) {
    if (submitting.current || saveStatusUnknown) {
      return
    }

    submitting.current = true
    setSaving(true)
    setSavingId(meal?.id ?? null)
    setSaveError('')
    setMessage('')

    try {
      const savedMeal = await saveMeal(values, meal?.id)

      setMeals((currentMeals) => {
        if (!meal) {
          return [...currentMeals, savedMeal]
        }

        return currentMeals.map((currentMeal) =>
          currentMeal.id === savedMeal.id ? savedMeal : currentMeal,
        )
      })

      if (changingAvailability) {
        setMessage(`${savedMeal.name} is now ${savedMeal.available ? 'available' : 'unavailable'}.`)
      } else {
        setMessage(`${savedMeal.name} ${meal ? 'updated' : 'added to the menu'}.`)
        closeForm()
      }

      notifyMenuChanged()
    } catch (requestError) {
      setSaveError(requestError.message || 'Unable to save the meal.')
      setSaveStatusUnknown(Boolean(requestError.saveStatusUnknown))
    } finally {
      submitting.current = false
      setSaving(false)
      setSavingId(null)
    }
  }

  async function handleDelete(meal) {
    if (submitting.current || saveStatusUnknown) {
      return
    }

    if (!window.confirm(`Delete ${meal.name} from the menu? This cannot be undone.`)) {
      return
    }

    submitting.current = true
    setDeletingId(meal.id)
    setSaveError('')
    setMessage('')

    try {
      await deleteMeal(meal.id)

      setMeals((currentMeals) =>
        currentMeals.filter((currentMeal) => currentMeal.id !== meal.id),
      )
      setMessage(`${meal.name} was deleted from the menu.`)
      notifyMenuChanged()
    } catch (requestError) {
      setSaveError(requestError.message || 'Unable to delete the meal.')
      setSaveStatusUnknown(Boolean(requestError.saveStatusUnknown))
    } finally {
      submitting.current = false
      setDeletingId(null)
    }
  }

  // busy = a save or delete is still running, so other buttons wait for it
  const busy = saving || deletingId !== null
  const controlsDisabled = busy || loading || saveStatusUnknown

  return (
    <main className="student-page staff-page">
      <div className="page-intro">
        <div>
          <h1>Menu management</h1>
          <p>Add meals, update prices, and choose what students can order.</p>
        </div>
        <div className="staff-menu-actions">
          <Button
            variant="secondary"
            disabled={loading || busy}
            onClick={() => setReload(reload + 1)}
          >
            Refresh menu
          </Button>
          <Button disabled={controlsDisabled || showForm} onClick={() => openForm()}>
            Add a meal
          </Button>
        </div>
      </div>

      {message && <Alert>{message}</Alert>}
      {!showForm && saveError && <Alert error>{saveError}</Alert>}

      {showForm && (
        <MealForm
          key={editingMeal?.id ?? 'new'}
          meal={editingMeal}
          onSave={(values) => handleSave(values, editingMeal)}
          onCancel={closeForm}
          saving={saving}
          error={saveError}
          blocked={saveStatusUnknown || loading}
        />
      )}

      {loading && <Loading>Loading the menu...</Loading>}

      {!loading && error && (
        <Alert error>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => setReload(reload + 1)}>
            Try again
          </Button>
        </Alert>
      )}

      {!loading && !error && meals.length === 0 && (
        <div className="student-empty">
          <h2>No meals on the menu yet</h2>
          <p>Add your first meal so students can see what is available.</p>
        </div>
      )}

      {!loading && !error && meals.length > 0 && (
        <>
          <p className="staff-menu-note">
            Mark a meal unavailable when it is sold out. Past orders will stay in order history.
          </p>
          <div className="staff-menu-table-wrap" tabIndex={0} role="region" aria-label="Meal list">
            <table className="staff-menu-table">
              <caption className="sr-only">Current cafeteria meals</caption>
              <thead>
                <tr>
                  <th scope="col">Meal</th>
                  <th scope="col">Price</th>
                  <th scope="col">Availability</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((meal) => (
                  <tr key={meal.id}>
                    <th scope="row">
                      <div className="staff-meal-cell">
                        <MealImage src={meal.imageUrl} alt={`Photo of ${meal.name}`} small />
                        <div>
                          <span>{meal.name}</span>
                          <p>{meal.description || 'No description added.'}</p>
                        </div>
                      </div>
                    </th>
                    <td className="staff-meal-price">{formatMoney(meal.price)}</td>
                    <td>
                      <span className={meal.available ? 'meal-availability' : 'staff-unavailable'}>
                        {meal.available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <div className="staff-menu-actions">
                        <Button
                          variant="secondary"
                          disabled={controlsDisabled || showForm}
                          aria-label={`Edit ${meal.name}`}
                          onClick={() => openForm(meal)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={controlsDisabled || showForm}
                          aria-label={`Mark ${meal.name} ${meal.available ? 'unavailable' : 'available'}`}
                          onClick={() => handleSave({ ...meal, available: !meal.available }, meal, true)}
                        >
                          {saving && savingId === meal.id
                            ? 'Saving...'
                            : `Mark ${meal.available ? 'unavailable' : 'available'}`}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={controlsDisabled || showForm}
                          aria-label={`Delete ${meal.name}`}
                          onClick={() => handleDelete(meal)}
                        >
                          {deletingId === meal.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
