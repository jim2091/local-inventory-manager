import { useEffect } from 'react'

function Toast({ message, onClose, duration = 2800 }) {
  useEffect(() => {
    if (!message) {
      return undefined
    }

    const timeoutId = setTimeout(onClose, duration)

    return () => clearTimeout(timeoutId)
  }, [message, onClose, duration])

  if (!message) {
    return null
  }

  return (
    <div className="app-toast success" role="status" aria-live="polite">
      <span aria-hidden="true">✓</span>
      <span>{message}</span>
    </div>
  )
}

export default Toast
