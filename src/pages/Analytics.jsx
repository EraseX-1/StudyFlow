import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../supabase'
import { ymd } from '../lib'

const LIME = '#C6F432'
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid rgb(128 128 128 / .35)', borderRadius: 8, color: 'var(--ink)' }, cursor: { fill: 'rgb(128 128 128 / .12)' } }
const ax = { tick: { fill: 'currentColor', fontSize: 12 }, stroke: 'currentColor', strokeOpacity: 0.3 }
const fmt = m => `${Math.floor(m / 60)} h ${m % 60} min`

const Chart = ({ title, note, empty, children }) => (
  <div className="card flex flex-col gap-2">
    <h2>{title}</h2>
    <p className="text-sm text-ink/70">{note}</p>
    {empty ? <p className="rounded-lg bg-ink/5 p-4 text-sm text-ink/70">{empty}</p> : <div className="h-56 w-full text-ink/80"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
  </div>
)

export default function Analytics({ profile }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    (async () => {
      const from = new Date(); from.setDate(from.getDate() - 89); from.setHours(0, 0, 0, 0)
      const [subs, ses, ch, rev, tk] = await Promise.all([
        supabase.from('subjects').select('id,name').in('code', profile.subject_codes),
        supabase.from('study_sessions').select('started_at,seconds,subject_id').gte('started_at', from.toISOString()),
        supabase.from('my_chapters').select('subject_id,status'),
        supabase.from('revision_tasks').select('done_at'),
        supabase.from('study_tasks').select('planned_date,est_minutes').neq('status', 'cancelled').gte('planned_date', ymd(from)),
      ])
      const bad = [subs, ses, ch, rev, tk].find(r => r.error)
      if (bad) return setErr(bad.error.message)

      const perDay = {}
      ses.data.forEach(s => { const k = ymd(new Date(s.started_at)); perDay[k] = (perDay[k] ?? 0) + s.seconds / 60 })
      const planned = {}
      tk.data.forEach(t => { planned[t.planned_date] = (planned[t.planned_date] ?? 0) + t.est_minutes })
      const days = Array.from({ length: 14 }, (_, i) => {
        const x = new Date(); x.setDate(x.getDate() - (13 - i))
        const k = ymd(x)
        return { day: x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), Studied: Math.round(perDay[k] ?? 0), Planned: planned[k] ?? 0, k }
      })
      const sum = n => Math.round(Object.entries(perDay).filter(([k]) => k >= ymd(new Date(Date.now() - (n - 1) * 864e5))).reduce((a, [, v]) => a + v, 0))
      const ids = new Set(subs.data.map(s => s.id))
      const bySubject = subs.data.map(s => {
        const list = ch.data.filter(c => c.subject_id === s.id)
        return {
          name: s.name, Minutes: Math.round(ses.data.filter(x => x.subject_id === s.id).reduce((a, x) => a + x.seconds / 60, 0)),
          Percent: list.length ? Math.round((list.filter(c => c.status === 'completed').length / list.length) * 100) : null, total: list.length,
        }
      })
      setD({
        days, bySubject, week: sum(7), month: sum(30), all: sum(90), count: ses.data.length,
        studiedDays: days.filter(x => x.Studied > 0).length,
        revDone: rev.data.filter(r => r.done_at).length, revOpen: rev.data.filter(r => !r.done_at).length,
      })
    })()
  }, [profile])

  if (err) return <p role="alert" className="rounded-lg border border-ink/30 bg-ink/10 p-3 text-sm text-ink">{err}</p>
  if (!d) return <div className="flex flex-col gap-3"><div className="skeleton h-6 w-40" /><div className="skeleton h-56" /><div className="skeleton h-56" /></div>
  const subjTime = d.bySubject.filter(s => s.Minutes > 0)
  const subjDone = d.bySubject.filter(s => s.Percent !== null)
  return (
    <section className="flex flex-col gap-3">
      <h1>Analytics</h1>
      <p className="text-sm text-ink/70">Every number here is calculated from your saved sessions, tasks, revisions and chapter progress.</p>
      <div className="card grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        {[['Last 7 days', fmt(d.week)], ['Last 30 days', fmt(d.month)], ['Last 90 days', fmt(d.all)], ['Days studied (last 14)', `${d.studiedDays} of 14`]].map(([l, v]) => <div key={l}><p className="text-xs text-ink/70">{l}</p><p className="text-xl font-bold">{v}</p></div>)}
      </div>
      <Chart title="Planned vs studied, last 14 days" note="The faded bar is the time you planned in the Planner. The lime bar is the time you actually recorded with the timer." empty={d.count === 0 && d.days.every(x => !x.Planned) ? 'No sessions or planned tasks yet. Start the timer or plan a task to see this chart.' : null}>
        <BarChart data={d.days} margin={{ left: -16, right: 4 }}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} /><XAxis dataKey="day" interval="preserveStartEnd" {...ax} /><YAxis unit="m" allowDecimals={false} {...ax} /><Tooltip {...tip} /><Legend /><Bar dataKey="Planned" fill="currentColor" fillOpacity={0.4} radius={[4, 4, 0, 0]} /><Bar dataKey="Studied" fill={LIME} radius={[4, 4, 0, 0]} /></BarChart>
      </Chart>
      <Chart title="Time by subject, last 90 days" note="Minutes of recorded study time for each of your subjects." empty={subjTime.length === 0 ? 'No recorded study time yet.' : null}>
        <BarChart data={subjTime} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} horizontal={false} /><XAxis type="number" unit="m" allowDecimals={false} {...ax} /><YAxis type="category" dataKey="name" width={96} {...ax} /><Tooltip {...tip} /><Bar dataKey="Minutes" fill={LIME} radius={[0, 4, 4, 0]} /></BarChart>
      </Chart>
      <Chart title="Syllabus completed by subject" note="Completed chapters as a percentage of each subject's chapters. Subjects with no chapter list yet are not shown." empty={subjDone.length === 0 ? 'No chapters are available yet.' : null}>
        <BarChart data={subjDone} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" {...ax} /><YAxis type="category" dataKey="name" width={96} {...ax} /><Tooltip {...tip} formatter={(v, n, p) => [`${v}% of ${p.payload.total} chapters`, 'Completed']} /><Bar dataKey="Percent" fill={LIME} radius={[0, 4, 4, 0]} /></BarChart>
      </Chart>
      <div className="card"><h2>Revision</h2><p className="mt-2 text-sm">{d.revDone} revision{d.revDone === 1 ? '' : 's'} finished, {d.revOpen} still waiting.</p></div>
    </section>
  )
}
