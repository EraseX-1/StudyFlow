import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { ask, toast } from '../ui'
import { ymd } from '../lib'

const TYPES = { learning: 'Learning', practice: 'Practice', mock_test: 'Mock test' }
const WEIGHT = { easy: 1, medium: 2, hard: 3, very_hard: 4 }
const DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard', very_hard: 'Very hard' }
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d) }
const endTime = (start, mins) => { const [h, m] = start.split(':').map(Number); const t = h * 60 + m + mins; return t >= 1440 ? null : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }

export default function Planner({ profile }) {
  const today = ymd(new Date())
  const [tasks, setTasks] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [chapters, setChapters] = useState([])
  const [revs, setRevs] = useState([])
  const [exams, setExams] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ chapter: '', type: 'learning', date: addDays(today, 1), start: '', mins: 60 })

  async function load() {
    const [t, s, c, r, e] = await Promise.all([
      supabase.from('study_tasks').select('*').order('planned_date').order('start_time', { nullsFirst: false }),
      supabase.from('subjects').select('id,name,code').in('code', profile.subject_codes),
      supabase.from('my_chapters').select('id,subject_id,section,number,title,difficulty,status,unlocked,position'),
      supabase.from('my_revisions').select('id,due_date,chapter_number,chapter_title,subject_name').is('done_at', null),
      supabase.from('exam_events').select('subject_code,exam_date').is('user_id', null).gte('exam_date', today),
    ])
    const bad = [t, s, c, r, e].find(x => x.error)
    if (bad) return setErr(bad.error.message)
    const ids = new Set(s.data.map(x => x.id))
    const mine = c.data.filter(x => ids.has(x.subject_id) && x.unlocked).sort((a, b) => a.position - b.position)
    setSubjects(s.data); setTasks(t.data); setRevs(r.data); setExams(e.data); setChapters(mine)
    setF(p => ({ ...p, chapter: mine.some(x => x.id === p.chapter) ? p.chapter : mine[0]?.id ?? '' }))
  }
  useEffect(() => { load() }, [profile])

  const friendly = e => (e.code === '23505' ? 'That task is already planned for that day.' : e.message)
  async function run(fn, ok) {
    setBusy(true); setErr(''); setMsg('')
    const { error, data } = await fn()
    if (error) setErr(friendly(error)); else if (ok) setMsg(ok(data))
    await load(); setBusy(false)
  }
  const add = (chapter, type, date, start, mins) => run(() => supabase.from('study_tasks').insert({
    chapter_id: chapter, task_type: type, planned_date: date, est_minutes: Number(mins),
    start_time: start || null, end_time: start ? endTime(start, Number(mins)) : null }), () => 'Task added.')
  const patch = (t, p, ok) => run(() => supabase.from('study_tasks').update(p).eq('id', t.id), () => ok)
  const done = t => patch(t, { status: 'done', done_at: new Date().toISOString() }, 'Marked done.')
  const postpone = t => patch(t, { planned_date: addDays(t.planned_date < today ? today : t.planned_date, 1), start_time: null, end_time: null }, 'Moved to the next day.')
  const cancel = async t => (await ask('Cancel this task? It stays in your history.')) && patch(t, { status: 'cancelled' }, 'Task cancelled.')
  const fixMissed = () => run(() => supabase.rpc('reschedule_missed'), n => `${n} missed task${n === 1 ? '' : 's'} moved to days with room.`)

  const subj = id => subjects.find(s => s.id === id)
  const chap = id => chapters.find(c => c.id === id)
  const label = c => c ? `${subj(c.subject_id)?.name} · ${c.section ? c.section + ' · ' : ''}Chapter ${c.number}: ${c.title}` : 'Chapter'
  const planned = tasks?.filter(t => t.status === 'planned') ?? []
  const missed = planned.filter(t => t.planned_date < today)
  const plannedIds = new Set(planned.map(t => t.chapter_id))

  const sug = chapters.filter(c => c.status !== 'completed' && !plannedIds.has(c.id)).map(c => {
    const ex = exams.filter(e => e.subject_code === subj(c.subject_id)?.code).map(e => e.exam_date).sort()[0]
    const days = ex ? Math.round((new Date(ex + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5) : null
    const urgency = days === null ? 1 : days < 30 ? 3 : days < 60 ? 2 : 1
    return { c, days, score: WEIGHT[c.difficulty] * 10 + urgency + (c.status === 'in_progress' ? 5 : 0) - c.position / 1000 }
  }).sort((a, b) => b.score - a.score)
  const top = [], per = {}
  for (const x of sug) if (top.length < 5 && (per[x.c.subject_id] ?? 0) < 2) { top.push(x); per[x.c.subject_id] = (per[x.c.subject_id] ?? 0) + 1 }

  const dates = [...new Set([...planned.map(t => t.planned_date), ...revs.map(r => r.due_date)])].sort()
  const hist = (tasks ?? []).filter(t => t.status === 'done').slice(-10).reverse()
  return (
    <section className="flex flex-col gap-3">
      <h1>Planner</h1>
      <p className="text-sm text-ink/70">Plan study tasks for chapters you have unlocked. A day holds at most 6 hours. Revisions due appear here too and are managed on the Revision page.</p>
      {err && <p role="alert" className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-700 dark:text-rose-300">{err}</p>}
      {msg && <p role="status" className="rounded-lg bg-emerald-500/15 p-3 text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
      {missed.length > 0 && <div className="card flex flex-wrap items-center gap-2"><span className="flex-1">{missed.length} task{missed.length > 1 ? 's' : ''} from earlier days not done. No problem.</span><button className="btn" disabled={busy} onClick={fixMissed}>Spread them over coming days</button></div>}
      {tasks && chapters.length === 0 && <div className="card"><p className="font-bold">No unlocked chapters to plan yet.</p><p className="text-sm">Open the Syllabus, and chapters will appear here once they are unlocked.</p></div>}
      {top.length > 0 && <div className="card flex flex-col gap-2">
        <h2 className="font-bold">Suggested next</h2>
        {top.map(({ c, days }) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-sm">{label(c)}<br /><span className="text-ink/70">{DIFF[c.difficulty]}{c.status === 'in_progress' ? ' · in progress' : ''}{days !== null ? ` · exam in ${days} days` : ''}</span></span>
            <button className="btn-quiet" disabled={busy} onClick={() => add(c.id, 'learning', addDays(today, 1), '', 60)}>Plan tomorrow</button>
          </div>
        ))}
      </div>}
      {chapters.length > 0 && <div className="card flex flex-col gap-2">
        <h2 className="font-bold">Add a task</h2>
        <select className="input" aria-label="Chapter" value={f.chapter} onChange={e => setF({ ...f, chapter: e.target.value })}>{chapters.map(c => <option key={c.id} value={c.id}>{label(c)}</option>)}</select>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" aria-label="Task type" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Object.entries(TYPES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          <select className="input" aria-label="Minutes" value={f.mins} onChange={e => setF({ ...f, mins: e.target.value })}>{[30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}</select>
          <input className="input" type="date" aria-label="Date" min={today} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
          <input className="input" type="time" aria-label="Start time (optional)" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} />
        </div>
        <button className="btn" disabled={busy || !f.chapter || !f.date} onClick={() => add(f.chapter, f.type, f.date, f.start, f.mins)}>Add task</button>
      </div>}
      {tasks && dates.length === 0 && chapters.length > 0 && <p className="text-sm text-ink/70">Nothing planned yet. Add your first task above.</p>}
      {dates.map(d => (
        <div key={d} className="flex flex-col gap-2">
          <h2 className="font-bold">{new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}{d < today && ' · earlier'}{d === today && ' · today'}</h2>
          {planned.filter(t => t.planned_date === d).map(t => (
            <div key={t.id} className="card flex flex-wrap items-center gap-2">
              <span className="flex-1">{label(chap(t.chapter_id))}<br /><span className="text-sm text-ink/70">{TYPES[t.task_type]} · {t.est_minutes} min{t.start_time && ` · ${t.start_time.slice(0, 5)}${t.end_time ? '–' + t.end_time.slice(0, 5) : ''}`}</span></span>
              <button className="btn" disabled={busy} onClick={() => done(t)}>Done</button>
              <button className="btn-quiet" disabled={busy} onClick={() => postpone(t)}>Next day</button>
              <button className="btn-quiet" disabled={busy} onClick={() => cancel(t)}>Cancel</button>
            </div>
          ))}
          {revs.filter(r => r.due_date === d).map(r => <div key={r.id} className="card text-sm">Revision due: {r.subject_name} · Chapter {r.chapter_number}: {r.chapter_title}</div>)}
        </div>
      ))}
      {hist.length > 0 && <><h2 className="font-bold">Recently done</h2><ul className="flex flex-col gap-1 text-sm">{hist.map(t => <li key={t.id}>{label(chap(t.chapter_id))} · {TYPES[t.task_type]} · {t.est_minutes} min</li>)}</ul></>}
    </section>
  )
}
