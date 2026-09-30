import { useEffect, useRef, useState } from 'react'

export default function useConfirmation() {
  const [confirmation, setConfirmation] = useState(null)
  const pending = useRef(null)
  useEffect(
    () => () => {
      pending.current?.(false)
    },
    []
  )
  const requestConfirmation = (options) =>
    new Promise((resolve) => {
      pending.current?.(false)
      pending.current = resolve
      setConfirmation(options)
    })
  const closeConfirmation = (accepted) => {
    pending.current?.(accepted)
    pending.current = null
    setConfirmation(null)
  }
  return { confirmation, requestConfirmation, closeConfirmation }
}
