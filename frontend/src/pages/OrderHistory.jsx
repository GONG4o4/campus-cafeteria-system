import OrderCard from '../components/orders/OrderCard'
import OrderFilters from '../components/orders/OrderFilters'
import { mockOrders } from '../data/mockOrders'
import { useOrderHistory } from '../hooks/useOrderHistory'
import './OrderHistory.css'

export default function OrderHistory({ orders = mockOrders }) {
  const { activeFilter, setActiveFilter, visibleOrders, filters } =
    useOrderHistory(orders)

  return (
    <div className="cafeteria-layout">
      <aside className="cafeteria-sidebar">
        <a className="cafeteria-brand" href="#order-history">
          <span>
            Campus<strong>Cafeteria</strong>
          </span>
        </a>
        <nav aria-label="Cafeteria">
          <a className="sidebar-link" href="#order-history" aria-current="page">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" />
              <path d="M9 8h6M9 12h6" />
            </svg>
            Order history
          </a>
        </nav>
      </aside>
      <main className="order-history" id="order-history">
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
          Showing sample orders.
        </footer>
      </main>
    </div>
  )
}
