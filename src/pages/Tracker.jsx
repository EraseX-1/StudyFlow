import { Fragment, useEffect, useState } from 'react'
import { CheckCircle2, Circle, Lock } from 'lucide-react'
import { supabase } from '../supabase'
import { ask, toast } from '../ui'

const DIFF = { easy: '●○○○ Easy', medium: '●●○○ Medium', hard: '●●●○ Hard', very_hard: '●●●● Very hard' }
const DIFF_CLS = Object.fromEntries(['easy', 'medium', 'hard', 'very_hard'].map(k => [k, 'border border-ink/25 text-ink']))

export default function Tracker({ profile }) {
  const [subjects, setSubjects] = useState([])
  const [active, setActive] = useState(null)
  const [chapters, setChapters] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [hideDone, setHideDone] = useState(false)

  useEffect(() => {
    supabase.from('subjects').select('*').in('code', profile.subject_codes).order('name').then(({ data, error }) => {
      if (error) return setErr(error.message)
      setSubjects(data); setActive(a => a ?? data[0]?.id ?? null)
    })
  }, [profile])

  const load = async () => {
    if (!active) return
    const { data, error } = await supabase.from('my_chapters').select('*').eq('subject_id', active).order('position')
    error ? setErr(error.message) : setChapters(data)
  }
  useEffect(() => { setChapters(null); load() }, [active])

  async function run(fn) {
    setBusy(true); setErr('')
    const { error } = await fn()
    if (error) setErr(error.message)
    await load(); setBusy(false)
    return !error
  }
  const update = (c, patch) => run(() => supabase.rpc('update_chapter', { p_chapter: c.id, p_status: patch.status ?? null, p_difficulty: patch.difficulty ?? null }))
  const complete = async c => (await ask(`Mark "${c.title}" as completed? The next chapter will unlock.`)) && (await update(c, { status: 'completed' })) && toast('Chapter completed. The next one is unlocked.')
  const skip = async c => (await ask(`Unlock "${c.title}" without finishing earlier chapters? Earlier chapters stay not completed, and this is recorded.`)) &&
    run(() => supabase.rpc('request_unlock', { p_chapter: c.id, p_reason: 'Already studied this chapter' }))

  const done = chapters?.filter(c => c.status === 'completed').length ?? 0
  const shown = chapters?.filter(c => (!q || c.title.toLowerCase().includes(q.toLowerCase())) && !(hideDone && c.status === 'completed'))
  return (
    <section className="flex flex-col gap-3">
      <h1>Your syllabus</h1>
      <p className="text-sm text-ink/70">Finish a chapter to unlock the next one in the same subject.</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {subjects.map(s => (
          <button key={s.id} role="tab" aria-selected={s.id === active} onClick={() => setActive(s.id)}
            className={`shrink-0 whitespace-nowrap rounded-lg transition-colors px-3 py-1.5 text-sm font-bold ${s.id === active ? 'grad-bg' : 'border border-ink/20 bg-surface'}`}>{s.name}</button>
        ))}
      </div>
      {err && <p role="alert" className="rounded-lg border border-ink/30 bg-ink/10 p-3 text-sm text-ink">{err}</p>}
      {chapters && chapters.length > 0 && (
        <div>
          <p className="text-sm font-bold">{done} of {chapters.length} chapters completed</p>
          <div className="mt-1 h-2 rounded bg-ink/10"><div className="bar grad-bg h-2 rounded-full transition-[width] duration-500" style={{ width: `${(done / chapters.length) * 100}%` }} /></div>
        </div>
      )}
      {chapters && chapters.length === 0 && (
        <div className="card">
          <p className="font-bold">Awaiting syllabus verification.</p>
          <p className="text-sm">This subject has no verified 2026–27 chapter list yet, so it is not counted as imported. Chapters can be added later using the import template in README.md.</p>
        </div>
      )}
      {chapters && chapters.length > 0 && <div className="flex flex-wrap items-center gap-3">
        <input className="input flex-1" type="search" placeholder="Search chapters" aria-label="Search chapters" value={q} onChange={e => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />Hide completed</label>
      </div>}
      {chapters?.some(c => !c.verified) && <p className="text-sm text-ink/80">This chapter list was supplied by the project owner and has not yet been checked against the official 2026–27 CBSE syllabus. Difficulty labels are estimates. Change any chapter to match your own experience.</p>}
      <ul className="flex flex-col gap-2">
        {shown?.map((c, i) => {
          const prev = chapters.filter(x => x.section === c.section && x.number < c.number).at(-1)
          return (
            <Fragment key={c.id}>
            {c.section && c.section !== shown[i - 1]?.section && <li className="mt-2 text-lg font-bold">{c.section}</li>}
            <li className={`card flex flex-col gap-2 ${c.status === 'completed' ? 'border-l-4 border-l-brand' : !c.unlocked ? 'border-dashed' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5" aria-hidden>{c.status === 'completed' ? <CheckCircle2 className="text-accent" /> : c.unlocked ? <Circle /> : <Lock className="text-ink/50" />}</span>
                <div className="flex-1">
                  <p className="font-bold">Chapter {c.number}: {c.title}</p>
                  <p className="text-sm text-ink/70">{[c.category, `about ${Math.round(c.est_minutes / 6) / 10} h (estimate)`, c.difficulty_changed && 'your difficulty'].filter(Boolean).join(' · ')}</p>
                  {!c.unlocked && <p className="text-sm text-ink/70">Locked. Finish {prev ? `Chapter ${prev.number}: ${prev.title}` : 'the earlier chapter'} first.</p>}
                  {c.status === 'in_progress' && <p className="text-sm text-ink/70">In progress</p>}
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${DIFF_CLS[c.difficulty]}`}>{DIFF[c.difficulty]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-9">
                {c.unlocked && c.status === 'not_started' && <button className="btn-quiet" disabled={busy} onClick={() => update(c, { status: 'in_progress' })}>Start chapter</button>}
                {c.unlocked && c.status !== 'completed' && <button className="btn" disabled={busy} onClick={() => complete(c)}>Mark completed</button>}
                {!c.unlocked && <button className="btn-quiet" disabled>Start chapter</button>}
                {!c.unlocked && <button className="btn-quiet" disabled={busy} onClick={() => skip(c)}>I already studied this</button>}
                <label className="ml-auto text-sm">Difficulty{' '}
                  <select className="rounded border border-ink/25 bg-surface p-1" value={c.difficulty} disabled={busy} onChange={e => update(c, { difficulty: e.target.value })}>
                    {Object.entries(DIFF).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              </div>
            </li>
            </Fragment>
          )
        })}
      </ul>
    </section>
  )
}
