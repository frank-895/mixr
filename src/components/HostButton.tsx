type Navigate = (path: string, params?: Record<string, string>) => void

export function HostButton({
  navigate,
  label = 'HOST A GAME',
  icon = 'videogame_asset',
  className = 'brutal-btn brutal-btn--pink',
  onClick,
  disabled = false,
}: {
  navigate: Navigate
  label?: string
  icon?: string
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick ?? (() => navigate('/host'))}
      disabled={disabled}
    >
      <span>{label}</span>
      <span className="material-symbols-outlined" aria-hidden="true">
        {icon}
      </span>
    </button>
  )
}
