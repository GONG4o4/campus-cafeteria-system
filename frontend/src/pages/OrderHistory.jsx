import OrderCard from '../components/orders/OrderCard'
import OrderFilters from '../components/orders/OrderFilters'
import { mockOrders } from '../data/mockOrders'
import { useOrderHistory } from '../hooks/useOrderHistory'
import './OrderHistory.css'

export default function OrderHistory({ orders = mockOrders }) {
  const { activeFilter, setActiveFilter, visibleOrders, filters } =
    useOrderHistory(orders)

  return (
    <section className="order-history" id="order-history">
      <div className="page-intro">
        <h1>Order history</h1>
        <p>View your orders and pickup status.</p>
      </div>
      <OrderFilters
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      <div className="orders-list-heading">
        <h2>{filters.find((filter) => filter.id === activeFilter).label}</h2>
        <p role="status" aria-live="polite">
          {visibleOrders.length}{' '}
          {visibleOrders.length === 1 ? 'order' : 'orders'}
        </p>
      </div>
      {visibleOrders.length > 0 ? (
        <div className="orders-list">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
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
            <button type="button" onClick={() => setActiveFilter('all')}>
              See all orders
            </button>
          )}
        </div>
      )}
      <footer className="orders-footer">
        Sample orders and orders placed in this demo session.
      </footer>
    </section>
  )
}
