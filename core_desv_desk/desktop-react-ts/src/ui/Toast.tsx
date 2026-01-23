import { useMemo } from 'react'
import '@/styles.css'

export default function Toast() {
  const msg = useMemo(() => {
    const q = new URLSearchParams(location.hash.split('?')[1] || '')
    return q.get('msg') || 'Hecho'
  }, [])

  return (
    <div className="toast-wrap">
      <div className="toast-card">
        <div className="toast-title">FrEDie</div>
        <div className="toast-msg">{msg}</div>
      </div>
    </div>
  )
}
