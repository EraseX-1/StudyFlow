import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { supabase } from '../supabase'
import { ymd } from '../lib'

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export default function Dashboard({ profile }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const today = ymd(new Date())
      const from = new Date(); from.setDate(from.getDate() - 60); from.setHours(0, 0, 0, 0)
      const [subs, ch, ses, ex, rev, tk] = await Promise.all([
        supabase.from('subjects').select('id,name').in('code', profile.subject_codes).order('name'),
        supabase.from('my_chapters').select('subject_id,status'),
        supabase.from('study_sessions').select('started_at,seconds').gte('started_at', from.toISOString()),
        supabase.from('exam_events').select('*').gte('exam_date', today).order('exam_date'),
        supabase.from('revision_tasks').select('id', { count: 'exact', head: true }).is('done_at', null).lte('due_date', today),
        supabase.from('study_tasks').select('id,task_type,est_minutes,status,start_time,chapters(number,title)').eq('planned_date', today).neq('status', 'cancelled').order('start_time', { nullsFirst: false }),
      ])
      const bad = [subs, ch, ses, ex, rev, tk].find(r => r.error)
      if (bad) return setErr(bad.error.message)

      const ids = new Set(subs.data.map(s => s.id))
      const mine = ch.data.filter(c => ids.has(c.subject_id))
      const bySubject = subs.data.map(s => {
        const list = mine.filter(c => c.subject_id === s.id)
        return { ...s, total: list.length, done: list.filter(c => c.status === 'completed').length }
      })
      const days = new Set(ses.data.map(s => ymd(new Date(s.started_at))))
      let streak = 0; const day = new Date()
      if (!days.has(ymd(day))) day.setDate(day.getDate() - 1)
      while (days.has(ymd(day))) { streak++; day.setDate(day.getDate() - 1) }
      const todayMin = Math.floor(ses.data.filter(s => ymd(new Date(s.started_at)) === today).reduce((a, s) => a + s.seconds, 0) / 60)
      const next = ex.data.find(e => !e.subject_code || profile.subject_codes.includes(e.subject_code))
      const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
      setD({
        total: mine.length, done: mine.filter(c => c.status === 'completed').length,
        doing: mine.filter(c => c.status === 'in_progress').length,
        bySubject, streak, todayMin, due: rev.count ?? 0, tasks: tk.data,
        next: next && { title: next.title, days: Math.round((new Date(next.exam_date + 'T00:00:00') - midnight) / 864e5) },
      })
    })()
  }, [profile])

  if (err) return <p role="alert" className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-700 dark:text-rose-300">{err}</p>
  if (!d) return <div className="flex flex-col gap-3"><div className="skeleton h-6 w-40" /><div className="grid grid-cols-2 gap-2"><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /></div></div>
  const Stat = ({ label, value }) => <div><p className="text-xs text-ink/70">{label}</p><p className="text-xl font-bold">{value}</p></div>
  return (
    <section className="flex flex-col gap-3">
      <div className="hero flex flex-col gap-1"><h1>{greet()}, {profile.full_name?.split(' ')[0] || 'student'}</h1>
      <p className="text-sm text-ink/70">{d.todayMin > 0 ? `You have studied ${d.todayMin} min today. Nice.` : 'Ready when you are. Pick a chapter and start a session.'} · Session 2026–27</p></div>
      {d.total === 0 && <div className="card"><p className="font-bold">No chapters in your syllabus yet.</p><p className="text-sm">Chapter lists are added to the database first. See “Adding the syllabus” in README.md.</p></div>}
      <div className="card grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <Stat label="Chapters completed" value={`${d.done} of ${d.total}`} />
        <Stat label="In progress" value={d.doing} />
        <Stat label="Studied today" value={`${d.todayMin} min`} />
        <Stat label="Study streak (rest days are fine)" value={<span className="inline-flex items-center gap-1"><Flame size={18} className="text-amber-500" />{d.streak}</span>} />
      </div>
      {d.next && <div className="card"><p className="text-sm">Next exam: {d.next.title}</p><p className="text-xl font-bold">{d.next.days === 0 ? 'Today' : `${d.next.days} days to go`}</p></div>}
      {d.due > 0 && <Link to="/revision" className="card card-tap font-bold underline">{d.due} revision{d.due > 1 ? 's' : ''} due now</Link>}
      <div className="card flex flex-col gap-3">
        <h2 className="font-bold">Progress by subject</h2>
        {d.bySubject.map(s => (
          <div key={s.id}>
            <p className="text-sm">{s.name}: {s.done} of {s.total} chapters</p>
            <div className="mt-1 h-2 rounded bg-ink/10"><div className="bar grad-bg h-2 rounded-full transition-[width] duration-500" style={{ width: s.total ? `${(s.done / s.total) * 100}%` : 0 }} /></div>
          </div>
        ))}
      </div>
      <div className="card flex flex-col gap-2">
        <h2>Today’s tasks</h2>
        {d.tasks.length === 0 ? <p className="text-sm text-ink/70">Nothing planned for today. <Link to="/planner" className="underline">Open the planner</Link></p> : d.tasks.map(t => <p key={t.id} className="text-sm">{t.status === 'done' ? '✓ ' : ''}Chapter {t.chapters?.number}: {t.chapters?.title} · {t.est_minutes} min</p>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/timer" className="btn">Start studying</Link>
        <Link to="/syllabus" className="btn-quiet">View syllabus</Link>
        <Link to="/revision" className="btn-quiet">Revision</Link>
      </div>
    </section>
  )
}
