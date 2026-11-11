import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const bus = new EventTarget()
export const toast = (text, kind = 'ok') => bus.dispatchEvent(new CustomEvent('toast', { detail: { text, kind, id: Math.random() } }))
export const ask = (text, confirmLabel = 'Confirm') => new Promise(resolve => bus.dispatchEvent(new CustomEvent('ask', { detail: { text, confirmLabel, resolve } })))

export function UiHost() {
  const [toasts, setToasts] = useState([])
  const [dlg, setDlg] = useState(null)
  useEffect(() => {
    const onToast = e => {
      const t = e.detail
      setToasts(l => [...l.slice(-2), t])
      setTimeout(() => setToasts(l => l.map(x => (x.id === t.id ? { ...x, leaving: true } : x))), 3500)
      setTimeout(() => setToasts(l => l.filter(x => x.id !== t.id)), 3750)
    }
    const onAsk = e => setDlg(e.detail)
    bus.addEventListener('toast', onToast); bus.addEventListener('ask', onAsk)
    return () => { bus.removeEventListener('toast', onToast); bus.removeEventListener('ask', onAsk) }
  }, [])
  useEffect(() => {
    if (!dlg) return
    const k = e => { if (e.key === 'Escape') { dlg.resolve(false); setDlg(null) } }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [dlg])
  const close = v => { dlg.resolve(v); setDlg(null) }
  return (
    <>
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-lg ${t.leaving ? 'toast-out' : 'toast-in'}`}>
            {t.kind === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} className="text-emerald-400" />}{t.text}
          </div>
        ))}
      </div>
      {dlg && (
        <div className="overlay-in fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => close(false)}>
          <div role="alertdialog" aria-modal="true" aria-label={dlg.text} className="card dialog-in flex w-full max-w-sm flex-col gap-4" onClick={e => e.stopPropagation()}>
            <p className="font-semibold">{dlg.text}</p>
            <div className="flex justify-end gap-2">
              <button className="btn-quiet" onClick={() => close(false)}>Cancel</button>
              <button className="btn" autoFocus onClick={() => close(true)}>{dlg.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
