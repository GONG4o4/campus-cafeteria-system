import { useCallback, useEffect, useRef, useState } from 'react'
import { filterOrders, orderFilters } from '../utils/orders'
import { getOrders } from '../ordersApi'

export function useOrderHistory() {
  const [orders, setOrders] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [detailStates, setDetailStates] = useState({})
  const requests = useRef(new Set())

  const refreshOrders = useCallback(async () => {
    requests.current.forEach((request) => {
      request.abort()
    })
    requests.current.clear()
    const controller = new AbortController()
    requests.current.add(controller)
    setLoading(true)
    setError('')
    setDetailStates({})

    try {
      const data = await getOrders(null, controller.signal)
      if (controller.signal.aborted) {
        return
      }

      setOrders(data)
      setLastUpdated(new Date())
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError.message || 'Unable to connect to the backend.')
      }
    } finally {
      requests.current.delete(controller)
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refreshOrders()
    const pendingRequests = requests.current
    return () => {
      pendingRequests.forEach((request) => {
        request.abort()
      })
    }
  }, [refreshOrders])

  async function loadDetails(id) {
    const controller = new AbortController()
    requests.current.add(controller)
    setDetailStates((states) => ({ ...states, [id]: { loading: true } }))
    try {
      const order = await getOrders(id, controller.signal)
      if (controller.signal.aborted) {
        return
      }

      setOrders((current) => {
        return current.map((item) => {
          if (item.id === id) {
            return order
          }

          return item
        })
      })
      setDetailStates((states) => ({ ...states, [id]: {} }))
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setDetailStates((states) => ({
          ...states,
          [id]: { error: requestError.message || 'Unable to connect to the backend.' },
        }))
      }
    } finally {
      requests.current.delete(controller)
    }
  }

  return {
    loading,
    error,
    lastUpdated,
    refreshOrders,
    loadDetails,
    detailStates,
    activeFilter,
    setActiveFilter,
    visibleOrders: filterOrders(orders, activeFilter),
    filters: orderFilters.map((filter) => ({
      ...filter,
      count: filterOrders(orders, filter.id).length,
    })),
  }
}
