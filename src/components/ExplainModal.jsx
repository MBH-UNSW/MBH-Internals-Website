import { useEffect } from 'react'
import { Explainer } from './Explainers.jsx'

export default function ExplainModal({ id, onClose, onNav }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!id) return null
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">✕</button>
        <Explainer id={id} onNav={onNav} />
      </div>
    </div>
  )
}
