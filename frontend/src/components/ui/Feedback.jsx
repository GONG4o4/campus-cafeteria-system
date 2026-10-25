export function Alert({ children, error = false }) {
  return (
    <div
      className={`app-alert ${error ? 'app-alert--error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}

export function Loading({ children = 'Loading...' }) {
  return (
    <p className="app-loading" role="status">
      {children}
    </p>
  )
}
