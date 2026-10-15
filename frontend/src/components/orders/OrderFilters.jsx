export default function OrderFilters({
  filters,
  activeFilter,
  onFilterChange,
}) {
  return (
    <div className="order-filters" role="group" aria-label="Filter orders">
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          aria-pressed={activeFilter === filter.id}
          onClick={() => onFilterChange(filter.id)}
        >
          {filter.label} <span>{filter.count}</span>
        </button>
      ))}
    </div>
  )
}
