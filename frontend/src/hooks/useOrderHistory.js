import { useState } from 'react'
import { filterOrders, orderFilters } from '../utils/orders'

export function useOrderHistory(orders) {
  const [activeFilter, setActiveFilter] = useState('all')

  return {
    activeFilter,
    setActiveFilter,
    visibleOrders: filterOrders(orders, activeFilter),
    filters: orderFilters.map((filter) => ({
      ...filter,
      count: filterOrders(orders, filter.id).length,
    })),
  }
}
