import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { ask, toast } from '../ui'

export default function Notes({ profile }) {
  const [notes, setNotes] = useState([])
  const [chapters, setChapters] = useState([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const ver = useRef(0)

  useEffect(() => {
    supabase.from('study_notes').select('*').order('updated_at', { ascending: false }).then(({ data, error }) => error ? setErr(error.message) : setNotes(data))
    supabase.from('chapters').select('id,number,title,subjects(name,code)').order('number').then(({ data }) =>
      setChapters((data ?? []).filter(c => profile.subject_codes.includes(c.subjects?.code))))
  }, [profile])

  useEffect(() => {
    if (!dirty || !sel) return
    setStatus('Saving…')
    const v = ver.current
    const h = setTimeout(async () => {
      const { error } = await supabase.from('study_notes').update({ title: sel.title, body: sel.body, chapter_id: sel.chapter_id || null, updated_at: new Date().toISOString() }).eq('id', sel.id)
      if (error) return setStatus('Could not save: ' + error.message)
      if (ver.current === v) { setStatus('Saved'); setDirty(false) }
      setNotes(n => n.map(x => (x.id === sel.id ? { ...x, ...sel } : x)))
    }, 800)
    return () => clearTimeout(h)
  }, [sel, dirty])

  const edit = patch => { ver.current++; setSel(s => ({ ...s, ...patch })); setDirty(true) }
  const open = n => dirty ? setStatus('Wait for the note to finish saving.') : (setSel(n), setStatus(''))
  async function add() {
    if (dirty) return setStatus('Wait for the note to finish saving.')
    const { data, error } = await supabase.from('study_notes').insert({}).select().single()
    if (error) return setErr(error.message)
    setNotes(n => [data, ...n]); setSel(data); setStatus('')
  }
  async function remove() {
    if (!(await ask('Delete this note? This cannot be undone.'))) return
    const { error } = await supabase.from('study_notes').delete().eq('id', sel.id)
    if (error) return setErr(error.message)
    setNotes(n => n.filter(x => x.id !== sel.id)); setSel(null); setDirty(false)
  }
  const shown = notes.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="flex flex-col gap-3">
      <h1>Notes</h1>
      <p className="text-sm text-ink/70">Private notes, saved automatically. Link a note to a chapter if you like.</p>
      {err && <p role="alert" className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-700 dark:text-rose-300">{err}</p>}
      <div className="flex gap-2">
        <input className="input" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} aria-label="Search notes" />
        <button className="btn" onClick={add}><Plus size={18} />New note</button>
      </div>
      {sel && (
        <div className="card flex flex-col gap-2">
          <input className="input" placeholder="Title" maxLength={120} value={sel.title} onChange={e => edit({ title: e.target.value })} aria-label="Title" />
          <select className="input" value={sel.chapter_id ?? ''} onChange={e => edit({ chapter_id: e.target.value || null })} aria-label="Linked chapter">
            <option value="">General note (no chapter)</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.subjects.name} · Chapter {c.number}: {c.title}</option>)}
          </select>
          <textarea className="input min-h-48" maxLength={20000} value={sel.body} onChange={e => edit({ body: e.target.value })} aria-label="Note text" />
          <div className="flex items-center gap-2"><span className="flex-1 text-sm" role="status">{status}</span>
            <button className="btn-quiet" onClick={remove}><Trash2 size={16} />Delete</button></div>
        </div>
      )}
      {notes.length === 0 && <p className="text-sm text-ink/70">No notes yet. Press “New note” to write your first one.</p>}
      <ul className="flex flex-col gap-2">
        {shown.map(n => (
          <li key={n.id}><button className="card card-tap w-full text-left" onClick={() => open(n)}>
            <span className="font-bold">{n.title || 'Untitled note'}</span><br />
            <span className="text-sm text-ink/70">Edited {new Date(n.updated_at).toLocaleDateString('en-IN')}</span>
          </button></li>
        ))}
      </ul>
    </section>
  )
}
