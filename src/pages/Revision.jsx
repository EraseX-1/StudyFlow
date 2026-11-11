import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { ask, toast } from '../ui'
import { ymd } from '../lib'

export default function Revision({ profile }) {
  const [tasks, setTasks] = useState(null)
  const [choices, setChoices] = useState([])
  const [pick, setPick] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [r, s, c] = await Promise.all([
      supabase.from('my_revisions').select('*').order('due_date'),
      supabase.from('subjects').select('id,name').in('code', profile.subject_codes),
      supabase.from('my_chapters').select('id,subject_id,number,title').eq('status', 'completed'),
    ])
    const bad = [r, s, c].find(x => x.error)
    if (bad) return setErr(bad.error.message)
    setTasks(r.data)
    const name = Object.fromEntries(s.data.map(x => [x.id, x.name]))
    const waiting = new Set(r.data.filter(t => !t.done_at).map(t => t.chapter_id))
    const list = c.data.filter(x => name[x.subject_id] && !waiting.has(x.id)).map(x => ({ id: x.id, label: `${name[x.subject_id]} · Chapter ${x.number}: ${x.title}` }))
    setChoices(list); setPick(p => (list.some(x => x.id === p) ? p : list[0]?.id ?? ''))
  }
  useEffect(() => { load() }, [profile])

  async function run(fn) { setBusy(true); setErr(''); const { error } = await fn(); if (error) setErr(error.message); await load(); setBusy(false) }
  const schedule = () => { const t = new Date(); t.setDate(t.getDate() + 1); run(() => supabase.rpc('schedule_revision', { p_chapter: pick, p_due: ymd(t) })) }
  const finish = t => run(() => supabase.rpc('complete_revision', { p_task: t.id }))
  const remove = async t => (await ask('Remove this revision from your list?')) && run(() => supabase.from('revision_tasks').delete().eq('id', t.id))

  const today = ymd(new Date())
  const waiting = tasks?.filter(t => !t.done_at) ?? []
  const due = waiting.filter(t => t.due_date <= today)
  const later = waiting.filter(t => t.due_date > today)
  const Row = ({ t, isDue }) => (
    <li className="card flex flex-wrap items-center gap-2">
      <span className="flex-1">{t.subject_name} · Chapter {t.chapter_number}: {t.chapter_title}<br /><span className="text-sm text-ink/70">Revision {t.attempt} · {isDue ? (t.due_date < today ? 'overdue, was due ' : 'due ') : 'on '}{t.due_date}</span></span>
      {isDue && <button className="btn" disabled={busy} onClick={() => finish(t)}>Mark revised</button>}
      <button className="btn-quiet" disabled={busy} onClick={() => remove(t)}>Remove</button>
    </li>
  )
  return (
    <section className="flex flex-col gap-3">
      <h1>Revision</h1>
      <p className="text-sm text-ink/70">Revise finished chapters again so you remember them. After each revision, the next one is set for 3, 7, 14, then 30 days later. Revision never changes a chapter's completed status.</p>
      {err && <p role="alert" className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-700 dark:text-rose-300">{err}</p>}
      <div className="card flex flex-col gap-2">
        <h2 className="font-bold">Schedule a revision</h2>
        {choices.length === 0 ? <p className="text-sm">Complete a chapter first. Completed chapters appear here.</p> : <>
          <select className="input" value={pick} onChange={e => setPick(e.target.value)} aria-label="Chapter">{choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <button className="btn" disabled={busy || !pick} onClick={schedule}>Revise tomorrow</button>
        </>}
      </div>
      <h2 className="font-bold">Due now ({due.length})</h2>
      {tasks && due.length === 0 && <p className="text-sm text-ink/70">Nothing due. Nice and clear.</p>}
      <ul className="flex flex-col gap-2">{due.map(t => <Row key={t.id} t={t} isDue />)}</ul>
      <h2 className="font-bold">Coming up ({later.length})</h2>
      <ul className="flex flex-col gap-2">{later.map(t => <Row key={t.id} t={t} />)}</ul>
      <p className="text-sm text-ink/70">Revisions finished so far: {tasks?.filter(t => t.done_at).length ?? 0}</p>
    </section>
  )
}
