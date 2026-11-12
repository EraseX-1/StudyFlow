import { useEffect, useState } from 'react'
import { Pause, Play, Square, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { ask, toast } from '../ui'

const KEY = 'studyflow-timer'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const fmt = s => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')

export default function Timer({ profile }) {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [type, setType] = useState('learning')
  const [chapters, setChapters] = useState([])
  const [t, setT] = useState(read)
  const [now, setNow] = useState(Date.now())
  const [sessions, setSessions] = useState([])
  const [msg, setMsg] = useState('')

  const save = v => { setT(v); v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY) }
  const refresh = async () => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('study_sessions').select('*').gte('started_at', d.toISOString()).order('started_at', { ascending: false })
    setSessions(data ?? [])
  }
  useEffect(() => {
    supabase.from('subjects').select('id,name').in('code', profile.subject_codes).order('name')
      .then(({ data }) => { setSubjects(data ?? []); setSubjectId(s => s || t?.subjectId || data?.[0]?.id || '') })
    refresh()
  }, [])
  useEffect(() => {
    const sid = t?.subjectId ?? subjectId
    if (!sid) return setChapters([])
    supabase.from('my_chapters').select('id,number,title,section,unlocked').eq('subject_id', sid).order('position').then(({ data }) => {
      const list = (data ?? []).filter(c => c.unlocked); setChapters(list); setChapterId(c => (list.some(x => x.id === c) ? c : ''))
    })
  }, [subjectId, t?.subjectId])
  useEffect(() => { const sync = e => e.key === KEY && setT(read()); addEventListener('storage', sync); return () => removeEventListener('storage', sync) }, [])
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  const elapsed = t ? Math.floor((t.acc + (t.since ? now - t.since : 0)) / 1000) : 0
  const name = id => subjects.find(s => s.id === id)?.name ?? 'Subject'
  const start = () => { setMsg(''); save({ id: crypto.randomUUID(), subjectId, chapterId: chapterId || null, type, startedAt: new Date().toISOString(), acc: 0, since: Date.now() }) }
  const pause = () => save({ ...t, acc: t.acc + Date.now() - t.since, since: null })
  const resume = () => save({ ...t, since: Date.now() })

  async function stop() {
    const frozen = t.since ? { ...t, acc: t.acc + Date.now() - t.since, since: null } : t
    save(frozen)
    const seconds = Math.floor(frozen.acc / 1000)
    if (seconds < 60) return setMsg('Sessions under one minute are not saved. Resume, or reset to discard.')
    const { error } = await supabase.from('study_sessions').insert({ id: frozen.id, subject_id: frozen.subjectId, started_at: frozen.startedAt, seconds, chapter_id: frozen.chapterId ?? null, session_type: frozen.type ?? 'learning' })
    if (error?.code === 'P0001') return setMsg(error.message + ' Use Reset to discard this session.')
    if (error && error.code !== '23505') return setMsg('Could not save yet. Your time is kept on this device. Check your connection and press Stop again.')
    save(null); setMsg('Session saved.'); toast('Session saved. Nice work.'); refresh()
  }
  async function remove(s) {
    if (!(await ask(`Delete this ${Math.round(s.seconds / 60)} minute session?`))) return
    await supabase.from('study_sessions').delete().eq('id', s.id); refresh()
  }
  const total = sessions.reduce((a, s) => a + s.seconds, 0)

  return (
    <section className="flex flex-col gap-3">
      <h1>Study timer</h1>
      <p className="text-sm text-ink/70">Pick a subject, start the timer, and press Stop when you finish. Your time survives a page refresh.</p>
      <div className="card flex flex-col items-center gap-3">
        <select className="input" value={t?.subjectId ?? subjectId} disabled={!!t} onChange={e => setSubjectId(e.target.value)} aria-label="Subject">
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input" value={t ? t.chapterId ?? '' : chapterId} disabled={!!t} onChange={e => setChapterId(e.target.value)} aria-label="Chapter">
          <option value="">No specific chapter</option>
          {chapters.map(c => <option key={c.id} value={c.id}>{c.section ? c.section + ' · ' : ''}Chapter {c.number}: {c.title}</option>)}
        </select>
        <select className="input" value={t ? t.type ?? 'learning' : type} disabled={!!t} onChange={e => setType(e.target.value)} aria-label="Session type">
          <option value="learning">Learning</option><option value="practice">Practice</option><option value="revision">Revision</option><option value="mock_test">Mock test</option>
        </select>
        <div className={`grid size-52 place-items-center rounded-full border-4 transition-colors duration-300 ${t?.since ? 'border-brand glow' : 'border-ink/15'}`}><p className="text-4xl font-bold tabular-nums">{fmt(elapsed)}</p></div>
        <div className="flex flex-wrap justify-center gap-2">
          {!t && <button className="btn min-h-12 px-8 text-base" disabled={!subjectId} onClick={start}><Play size={18} />Start</button>}
          {t?.since && <button className="btn-quiet" onClick={pause}><Pause size={16} />Pause</button>}
          {t && !t.since && <button className="btn-quiet" onClick={resume}><Play size={16} />Resume</button>}
          {t && <button className="btn min-h-12 px-6 text-base" onClick={stop}><Square size={16} />Stop and save</button>}
          {t && <button className="btn-quiet" onClick={async () => (await ask('Discard this session?')) && save(null)}>Reset</button>}
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </div>
      <h2 className="font-bold">Today: {Math.floor(total / 60)} min studied</h2>
      {sessions.length === 0 && <p className="text-sm text-ink/70">No sessions saved today yet.</p>}
      <ul className="flex flex-col gap-2">
        {sessions.map(s => (
          <li key={s.id} className="card flex items-center gap-2">
            <span className="flex-1">{name(s.subject_id)} · {s.session_type.replace('_', ' ')} · {Math.round(s.seconds / 60)} min</span>
            <button className="btn-quiet" onClick={() => remove(s)} aria-label="Delete session"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
