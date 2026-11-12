import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarCheck, Flame, RotateCcw, StickyNote, Timer } from 'lucide-react'
import { supabase } from '../supabase'
import { ymd } from '../lib'

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const pickContinue = (mine, subs) => {
  const byPos = (a, b) => a.position - b.position
  const c = mine.filter(x => x.status === 'in_progress').sort(byPos)[0] ?? mine.filter(x => x.status === 'not_started' && x.unlocked).sort(byPos)[0]
  return c && { ...c, subject: subs.find(s => s.id === c.subject_id)?.name }
}

function Ring({ pct, size = 96, stroke = 9, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink/15" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="stroke-brand transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="absolute text-center font-bold leading-tight">{children}</span>
    </div>
  )
}

export default function Dashboard({ profile }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const today = ymd(new Date())
      const from = new Date(); from.setDate(from.getDate() - 60); from.setHours(0, 0, 0, 0)
      const [subs, ch, ses, ex, rev, tk] = await Promise.all([
        supabase.from('subjects').select('id,name').in('code', profile.subject_codes).order('name'),
        supabase.from('my_chapters').select('id,subject_id,section,number,title,status,unlocked,position'),
        supabase.from('study_sessions').select('started_at,seconds,subject_id,session_type').gte('started_at', from.toISOString()),
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
      const todays = ses.data.filter(s => ymd(new Date(s.started_at)) === today)
      const next = ex.data.find(e => !e.subject_code || profile.subject_codes.includes(e.subject_code))
      const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
      setD({
        total: mine.length, done: mine.filter(c => c.status === 'completed').length, doing: mine.filter(c => c.status === 'in_progress').length,
        bySubject, streak, todayMin: Math.floor(todays.reduce((a, s) => a + s.seconds, 0) / 60), todayCount: todays.length,
        due: rev.count ?? 0, tasks: tk.data, cont: pickContinue(mine, subs.data),
        recent: ses.data.slice().sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 5).map(x => ({ ...x, subject: subs.data.find(y => y.id === x.subject_id)?.name })),
        next: next && { title: next.title, date: next.exam_date, days: Math.round((new Date(next.exam_date + 'T00:00:00') - midnight) / 864e5) },
      })
    })()
  }, [profile])

  if (err) return <p role="alert" className="rounded-xl border border-ink/30 bg-ink/10 p-3 text-sm">{err}</p>
  if (!d) return <div className="flex flex-col gap-3"><div className="skeleton h-36" /><div className="skeleton h-20" /><div className="skeleton h-28" /></div>

  const pct = d.total ? Math.round((d.done / d.total) * 100) : 0
  const tasksDone = d.tasks.filter(t => t.status === 'done').length
  const Q = [['/timer', Timer, 'Start timer'], ['/planner', CalendarCheck, 'Plan a task'], ['/revision', RotateCcw, d.due ? `Revision (${d.due} due)` : 'Revision'], ['/notes', StickyNote, 'Write a note']]
  return (
    <div className="flex flex-col gap-4">
      <section className="hero glow flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · 2026–27</p>
          <h1>{greet()}, {profile.full_name?.split(' ')[0] || 'student'}</h1>
          <p className="text-sm text-ink/75">{d.todayMin > 0 ? `You have studied ${d.todayMin} min today. Nice.` : 'Ready when you are. Pick a chapter and start a session.'}</p>
        </div>
        <Ring pct={pct} size={104}><span className="text-2xl">{pct}%</span><br /><span className="text-[11px] font-semibold text-ink/70">syllabus</span></Ring>
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Today">
        {[['Studied today', `${d.todayMin} min`], ['Sessions today', d.todayCount], ['Chapters done', `${d.done}/${d.total}`], ['Tasks done today', `${tasksDone}/${d.tasks.length}`]].map(([l, v]) => (
          <div key={l} className="card p-3"><p className="text-xs text-ink/70">{l}</p><p className="text-xl font-bold">{v}</p></div>
        ))}
        <div className="card col-span-2 flex items-center gap-3 p-3 md:col-span-4"><Flame className="text-brand" size={22} /><p className="text-sm"><b>{d.streak}</b> day streak · {d.doing} chapter{d.doing === 1 ? '' : 's'} in progress · rest days are fine</p></div>
      </section>

      {d.next && (
        <Link to="/exams" className="card card-tap flex items-center gap-4 border-brand/40">
          <p className="grad-text text-5xl font-bold tabular-nums">{d.next.days}</p>
          <div className="flex-1"><p className="text-xs font-bold uppercase tracking-widest text-accent">{d.next.days === 0 ? 'Exam day' : 'days to your next exam'}</p><p className="font-bold">{d.next.title}</p><p className="text-sm text-ink/70">{new Date(d.next.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
          <ArrowRight size={18} />
        </Link>
      )}

      <section className="flex flex-col gap-2">
        <h2>Today’s tasks</h2>
        {d.tasks.length === 0 ? <div className="card text-sm text-ink/70">Nothing planned for today. <Link to="/planner" className="font-bold text-accent underline">Plan a task</Link></div> : d.tasks.map(t => (
          <div key={t.id} className="card flex items-center gap-3 p-3">
            <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${t.status === 'done' ? 'grad-bg border-transparent' : 'border-ink/30'}`}>{t.status === 'done' ? '✓' : ''}</span>
            <span className={`flex-1 text-sm ${t.status === 'done' ? 'text-ink/60 line-through' : ''}`}>Chapter {t.chapters?.number}: {t.chapters?.title}<br /><span className="text-xs text-ink/70">{t.task_type.replace('_', ' ')} · {t.est_minutes} min</span></span>
          </div>
        ))}
      </section>

      {d.cont && (
        <Link to="/syllabus" className="card card-tap flex items-center gap-3 border-brand/40">
          <span className="grad-bg grid size-10 shrink-0 place-items-center rounded-xl"><BookOpen size={20} /></span>
          <span className="flex-1"><span className="text-xs font-bold uppercase tracking-widest text-accent">Continue studying</span><br /><span className="font-bold">Chapter {d.cont.number}: {d.cont.title}</span><br /><span className="text-sm text-ink/70">{d.cont.subject}{d.cont.section ? ` · ${d.cont.section}` : ''} · {d.cont.status === 'in_progress' ? 'In progress' : 'Not started'}</span></span>
          <ArrowRight size={18} />
        </Link>
      )}

      <section className="flex flex-col gap-2">
        <h2>Subjects</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {d.bySubject.map(s => {
            const p = s.total ? Math.round((s.done / s.total) * 100) : 0
            return (
              <Link key={s.id} to="/syllabus" className="card card-tap flex flex-col items-start gap-2 p-3">
                <Ring pct={p} size={56} stroke={6}><span className="text-xs">{s.total ? `${p}%` : '–'}</span></Ring>
                <p className="text-sm font-bold leading-tight">{s.name}</p>
                <p className="text-xs text-ink/70">{s.total ? `${s.done} of ${s.total} chapters · ${s.total - s.done} left` : 'Awaiting chapter list'}</p>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          {Q.map(([to, Icon, label]) => <Link key={to} to={to} className="card card-tap flex min-h-16 items-center gap-3 p-3"><span className="grad-bg grid size-9 shrink-0 place-items-center rounded-lg"><Icon size={18} /></span><span className="text-sm font-bold">{label}</span></Link>)}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Recent activity</h2>
        <div className="card flex flex-col gap-1.5">
          {d.recent.length === 0 ? <p className="text-sm text-ink/70">No study sessions yet. Start the timer to log your first one.</p> : d.recent.map(x => <p key={x.started_at} className="text-sm">{new Date(x.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {x.subject} · {x.session_type?.replace('_', ' ')} · {Math.round(x.seconds / 60)} min</p>)}
        </div>
      </section>
    </div>
  )
}
