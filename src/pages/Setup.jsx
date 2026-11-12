import { useState } from 'react'
import { supabase } from '../supabase'

const Choice = ({ label, value, onChange, options }) => (
  <fieldset className="flex flex-col gap-1">
    <legend className="font-bold">{label}</legend>
    {options.map(([v, t]) => (
      <label key={v} className="flex items-center gap-2"><input type="radio" checked={value === v} onChange={() => onChange(v)} />{t}</label>
    ))}
  </fieldset>
)

export default function Setup({ user, initial, onDone }) {
  const codes = initial?.subject_codes ?? []
  const [name, setName] = useState(initial?.full_name ?? user.user_metadata?.full_name ?? '')
  const [maths, setMaths] = useState(codes.includes('241') ? '241' : '041')
  const [english, setEnglish] = useState(codes.includes('101') ? '101' : '184')
  const [ai, setAi] = useState(codes.includes('417'))
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault(); setBusy(true); setErr('')
    const row = { id: user.id, full_name: name.trim(), onboarded: true, subject_codes: [maths, '086', '087', english, '002', ...(ai ? ['417'] : [])] }
    const { error } = await supabase.from('profiles').upsert(row)
    setBusy(false)
    error ? setErr(error.message) : (onDone(row), setSaved(true))
  }

  return (
    <form onSubmit={save} className="card glow mt-8 flex flex-col gap-4">
      <h1>{initial ? 'Your subjects' : 'Set up your subjects'}</h1>
      <p className="text-sm text-ink/70">Only the subjects you pick appear in your tracker and exam list.</p>
      <label>Your name<input className="input" value={name} onChange={e => setName(e.target.value)} required /></label>
      <Choice label="Mathematics" value={maths} onChange={setMaths} options={[['041', 'Standard'], ['241', 'Basic']]} />
      <Choice label="English" value={english} onChange={setEnglish} options={[['184', 'Language and Literature'], ['101', 'Communicative']]} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={ai} onChange={e => setAi(e.target.checked)} />I am taking Artificial Intelligence (417)</label>
      <p className="text-sm">Science, Social Science and Hindi Course A are included for everyone.</p>
      {saved && initial && <p role="status" className="text-sm text-accent">Saved. Your progress is kept.</p>}
      {err && <p role="alert" className="rounded-lg border border-ink/30 bg-ink/10 p-3 text-sm text-ink">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Start using StudyFlow'}</button>
    </form>
  )
}
