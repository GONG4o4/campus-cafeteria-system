export default function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`app-button app-button--${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
