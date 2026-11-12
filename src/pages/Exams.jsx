import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Exams({ profile }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.from('exam_events').select('*').order('exam_date').then(({ data, error }) =>
      error ? setErr(error.message) : setRows(data.filter(e => !e.subject_code || profile.subject_codes.includes(e.subject_code))))
  }, [profile])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = e => Math.round((new Date(e.exam_date + 'T00:00:00') - today) / 864e5)
  const upcoming = rows?.filter(e => days(e) >= 0) ?? []
  const next = upcoming[0]
  return (
    <section className="flex flex-col gap-3">
      <h1>Board exams</h1>
      <p className="text-sm text-ink/70">CBSE Class 10 main exams, 2027, for your subjects. Check cbse.gov.in if the board revises its date sheet.</p>
      {err && <p role="alert" className="rounded-lg border border-ink/30 bg-ink/10 p-3 text-sm text-ink">{err}</p>}
      {next && <div className="hero glow flex items-center gap-4"><p className="grad-text text-6xl font-bold tabular-nums">{days(next)}</p><div><p className="text-xs font-bold uppercase tracking-widest text-accent">{days(next) === 0 ? 'Exam day' : 'days to go'}</p><p className="text-lg font-bold">{next.title}</p></div></div>}
      {rows && upcoming.length === 0 && <p>No upcoming exams for your subjects.</p>}
      <ul className="flex flex-col gap-2">
        {(rows ?? []).map(e => (
          <li key={e.id} className={`card ${days(e) < 0 ? 'opacity-60' : ''}`}>
            <p className="font-bold">{e.title}{e.subject_code && ` (${e.subject_code})`} · {days(e) >= 0 ? 'Upcoming' : 'Completed'}</p>
            <p className="text-sm">{new Date(e.exam_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{e.starts_at && `, ${e.starts_at.slice(0, 5)}${e.ends_at ? '–' + e.ends_at.slice(0, 5) : ''}`}</p>
            {!e.verified && <p className="text-sm text-ink/80">This date is not confirmed in the official date sheet yet. Check it on cbse.gov.in.</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
