import OrderCard from '../components/orders/OrderCard'
import OrderFilters from '../components/orders/OrderFilters'
import { useOrderHistory } from '../hooks/useOrderHistory'
import Button from '../components/ui/Button'
import { Alert, Loading } from '../components/ui/Feedback'
import './OrderHistory.css'

export default function OrderHistory() {
  const {
    activeFilter,
    setActiveFilter,
    visibleOrders,
    filters,
    loading,
    error,
    lastUpdated,
    refreshOrders,
    loadDetails,
    detailStates,
  } = useOrderHistory()

  const selectedFilter = filters.find(
    (filter) => filter.id === activeFilter,
  )
  let updatedTime = ''

  if (lastUpdated) {
    updatedTime = lastUpdated.toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila',
    })
  }

  return (
    <main className="order-history" id="order-history">
      <div className="page-intro">
        <div>
          <h1>Order history</h1>
          <p>View your orders and pickup status.</p>
        </div>
        <Button variant="secondary" onClick={refreshOrders} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh orders'}
        </Button>
      </div>

      {error && (
        <Alert error>
          {error} Use Refresh orders to retry.
        </Alert>
      )}

      {loading && <Loading>Loading your orders...</Loading>}

      {lastUpdated && (
        <p className="orders-updated">
          Last updated: {updatedTime}. Refresh to check the latest status.
        </p>
      )}

      {!loading && !error && (
        <>
          <OrderFilters
            filters={filters}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          <div className="orders-list-heading">
            <h2>{selectedFilter?.label ?? 'Orders'}</h2>
            <p role="status" aria-live="polite">
              {visibleOrders.length}{' '}
              {visibleOrders.length === 1 ? 'order' : 'orders'}
            </p>
          </div>

          {visibleOrders.length > 0 ? (
            <div className="orders-list">
              {visibleOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onLoadDetails={() => loadDetails(order.id)}
                  detailState={detailStates[order.id]}
                />
              ))}
            </div>
          ) : (
            <div className="orders-empty">
              <h2>
                No {activeFilter === 'all' ? '' : `${activeFilter} `}orders yet
              </h2>
              <p>
                {activeFilter === 'all'
                  ? 'Your orders will appear here once you place one.'
                  : 'Orders with this status will appear here.'}
              </p>
              {activeFilter !== 'all' && (
                <Button
                  variant="secondary"
                  onClick={() => setActiveFilter('all')}
                >
                  See all orders
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}