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
      {err && <p role="alert" className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-700 dark:text-rose-300">{err}</p>}
      {next && <div className="card"><p className="text-sm">Next exam: {next.title}</p><p className="text-3xl font-bold">{days(next) === 0 ? 'Today' : `${days(next)} days to go`}</p></div>}
      {rows && upcoming.length === 0 && <p>No upcoming exams for your subjects.</p>}
      <ul className="flex flex-col gap-2">
        {(rows ?? []).map(e => (
          <li key={e.id} className="card">
            <p className="font-bold">{e.title}{e.subject_code && ` (${e.subject_code})`} · {days(e) >= 0 ? 'Upcoming' : 'Completed'}</p>
            <p className="text-sm">{new Date(e.exam_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{e.starts_at && `, ${e.starts_at.slice(0, 5)}${e.ends_at ? '–' + e.ends_at.slice(0, 5) : ''}`}</p>
            {!e.verified && <p className="text-sm text-amber-700 dark:text-amber-300">This date is not confirmed in the official date sheet yet. Check it on cbse.gov.in.</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
