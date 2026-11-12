import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { ask, toast } from '../ui'
import { ymd } from '../lib'

const DOT = { task: 'bg-brand', revision: 'border-2 border-brand', exam: 'bg-ink', session: 'border-2 border-ink' }
const LABEL = { task: 'Study task', revision: 'Revision', exam: 'Exam or deadline', session: 'Study session' }
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Calendar({ profile }) {
  const now = new Date()
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [sel, setSel] = useState(ymd(now))
  const [subj, setSubj] = useState('')
  const [data, setData] = useState(null)
  const [title, setTitle] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const start = ymd(month), end = ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    const [s, t, r, e, ses] = await Promise.all([
      supabase.from('subjects').select('id,name,code').in('code', profile.subject_codes).order('name'),
      supabase.from('study_tasks').select('id,planned_date,status,task_type,est_minutes,chapters(number,title,subject_id)').gte('planned_date', start).lte('planned_date', end).neq('status', 'cancelled'),
      supabase.from('my_revisions').select('id,due_date,done_at,chapter_number,chapter_title,subject_name').gte('due_date', start).lte('due_date', end),
      supabase.from('exam_events').select('id,user_id,subject_code,title,exam_date').gte('exam_date', start).lte('exam_date', end),
      supabase.from('study_sessions').select('id,started_at,seconds,subject_id,session_type').gte('started_at', month.toISOString()).lt('started_at', next.toISOString()),
    ])
    const bad = [s, t, r, e, ses].find(x => x.error)
    if (bad) return setErr(bad.error.message)
    setErr(''); setData({ subs: s.data, t: t.data, r: r.data, e: e.data, ses: ses.data })
  }
  useEffect(() => { setData(null); load() }, [month, profile])

  const by = useMemo(() => {
    const out = {}
    if (!data) return out
    const sc = data.subs.find(x => x.id === subj)
    const add = (date, ev) => (out[date] ??= []).push(ev)
    data.t.forEach(x => (!subj || x.chapters?.subject_id === subj) && add(x.planned_date, { id: 't' + x.id, kind: 'task', done: x.status === 'done', text: `Chapter ${x.chapters?.number}: ${x.chapters?.title}`, sub: `${x.task_type.replace('_', ' ')} · ${x.est_minutes} min` }))
    data.r.forEach(x => (!sc || x.subject_name === sc.name) && add(x.due_date, { id: 'r' + x.id, kind: 'revision', done: !!x.done_at, text: `Chapter ${x.chapter_number}: ${x.chapter_title}`, sub: x.subject_name }))
    data.e.filter(x => !x.subject_code || profile.subject_codes.includes(x.subject_code)).forEach(x => (!sc || !x.subject_code || x.subject_code === sc.code) && add(x.exam_date, { id: 'e' + x.id, kind: 'exam', text: x.title, sub: x.user_id ? 'Personal deadline' : 'Board exam', mine: x.user_id ? x.id : null }))
    data.ses.forEach(x => (!subj || x.subject_id === subj) && add(ymd(new Date(x.started_at)), { id: 's' + x.id, kind: 'session', text: `${data.subs.find(y => y.id === x.subject_id)?.name ?? 'Study'} · ${Math.round(x.seconds / 60)} min`, sub: x.session_type.replace('_', ' ') }))
    return out
  }, [data, subj, profile])

  async function addEvent() {
    if (!title.trim()) return
    const { error } = await supabase.from('exam_events').insert({ user_id: profile.id, title: title.trim().slice(0, 120), exam_date: sel })
    if (error) return toast(error.message, 'error')
    setTitle(''); toast('Deadline added.'); load()
  }
  async function removeEvent(id) {
    if (!(await ask('Delete this personal deadline?', 'Delete'))) return
    const { error } = await supabase.from('exam_events').delete().eq('id', id)
    if (error) return toast(error.message, 'error')
    toast('Deadline deleted.'); load()
  }

  const y = month.getFullYear(), m = month.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  const cells = [...Array(lead).fill(null), ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => ymd(new Date(y, m, i + 1)))]
  const today = ymd(now)
  const shift = n => setMonth(new Date(y, m + n, 1))
  const list = by[sel] ?? []
  return (
    <section className="flex flex-col gap-3">
      <h1>Calendar</h1>
      <p className="text-sm text-ink/70">Study tasks, revisions, exams and sessions in one place. Tap a day to see its details.</p>
      {err && <p role="alert" className="rounded-lg border border-ink/30 bg-ink/10 p-3 text-sm text-ink">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-quiet" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
        <h2 className="flex-1 justify-center">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
        <button className="btn-quiet" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        <button className="btn-quiet" onClick={() => { setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSel(today) }}>Today</button>
      </div>
      <select className="input" aria-label="Filter by subject" value={subj} onChange={e => setSubj(e.target.value)}>
        <option value="">All subjects</option>{data?.subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="card p-2">
        <div className="grid grid-cols-7 text-center text-xs font-bold text-ink/70">{WEEK.map(w => <span key={w} className="py-1">{w}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((k, i) => k === null ? <span key={'b' + i} /> : (
            <button key={k} aria-label={`${k}, ${(by[k] ?? []).length} items`} aria-pressed={k === sel} onClick={() => setSel(k)}
              className={`flex aspect-square min-h-10 flex-col items-center justify-start gap-0.5 rounded-lg p-1 text-sm font-semibold transition-colors ${k === sel ? 'grad-bg' : 'hover:bg-ink/10'} ${k === today && k !== sel ? 'ring-1 ring-accent' : ''}`}>
              {Number(k.slice(8))}
              <span className="flex gap-0.5">{[...new Set((by[k] ?? []).map(e => e.kind))].map(kind => <i key={kind} className={`size-1.5 rounded-full ${DOT[kind]}`} />)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">{Object.entries(LABEL).map(([k, t]) => <span key={k} className="flex items-center gap-1"><i className={`size-2 rounded-full ${DOT[k]}`} />{t}</span>)}</div>
      <div className="card flex flex-col gap-2">
        <h2>{new Date(sel + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {!data && <div className="skeleton h-10" />}
        {data && list.length === 0 && <p className="text-sm text-ink/70">Nothing on this day.</p>}
        {list.map(e => (
          <div key={e.id} className="flex items-center gap-2 text-sm">
            <i className={`size-2.5 shrink-0 rounded-full ${DOT[e.kind]} ${e.done ? 'opacity-40' : ''}`} />
            <span className={`flex-1 ${e.done ? 'text-ink/60 line-through' : ''}`}>{e.text}<br /><span className="text-xs text-ink/70">{LABEL[e.kind]} · {e.sub}{e.done ? ' · done' : ''}</span></span>
            {e.mine && <button className="btn-quiet" aria-label="Delete deadline" onClick={() => removeEvent(e.mine)}><Trash2 size={14} /></button>}
          </div>
        ))}
        <div className="flex gap-2 border-t border-ink/10 pt-3">
          <input className="input" placeholder="Add a personal deadline" aria-label="Personal deadline title" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEvent()} />
          <button className="btn" disabled={!title.trim()} onClick={addEvent}>Add</button>
        </div>
      </div>
    </section>
  )
}
