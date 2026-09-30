import { useEffect, useRef } from 'react'
import { objectProp, functionProp } from '../../utils/propTypes'

function ConfirmDialog({ options, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.querySelector('button')?.focus()
    return () => previous?.focus()
  }, [])
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose(false)
    }
    if (event.key === 'Tab') {
      const buttons = dialogRef.current.querySelectorAll('button')
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault()
        buttons[1].focus()
      } else if (!event.shiftKey && document.activeElement === buttons[1]) {
        event.preventDefault()
        buttons[0].focus()
      }
    }
  }
  return (
    <div className="cancel-modal-overlay">
      <div
        ref={dialogRef}
        className="cancel-modal confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        onKeyDown={onKeyDown}
      >
        <div className="cancel-modal-header">
          <h2 id="confirmation-title">{options.title}</h2>
        </div>
        <p className="confirmation-text">{options.message}</p>
        <div className="cancel-modal-actions">
          <button type="button" className="secondary-button" onClick={() => onClose(false)}>
            취소
          </button>
          <button type="button" className="primary-button" onClick={() => onClose(true)}>
            {options.confirmLabel || '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
ConfirmDialog.propTypes = { options: objectProp, onClose: functionProp }
export default ConfirmDialog
