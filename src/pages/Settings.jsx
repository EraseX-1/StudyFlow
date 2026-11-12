import { useState } from 'react'
import { Download, Monitor, Moon, Sun } from 'lucide-react'
import { supabase } from '../supabase'
import { ask, toast } from '../ui'
import { getTheme, setTheme } from '../theme'
import Setup from './Setup'

const TABLES = ['profiles', 'chapter_progress', 'chapter_unlock_overrides', 'study_sessions', 'study_tasks', 'revision_tasks', 'study_notes', 'exam_events']
const THEMES = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'Device', Monitor]]

export default function Settings({ user, profile, onSaved }) {
  const [theme, setT] = useState(getTheme())
  const [busy, setBusy] = useState(false)
  const [word, setWord] = useState('')

  async function exportData() {
    setBusy(true)
    const out = { exported_at: new Date().toISOString(), email: user.email }
    for (const t of TABLES) {
      let q = supabase.from(t).select('*')
      if (t === 'exam_events') q = q.eq('user_id', user.id)
      const { data, error } = await q
      if (error) { setBusy(false); return toast(`Could not read ${t}: ${error.message}`, 'error') }
      out[t] = data
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `studyflow-data-${new Date().toISOString().slice(0, 10)}.json` }).click()
    URL.revokeObjectURL(url); setBusy(false); toast('Your data was downloaded.')
  }
  async function resetPassword() {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin })
    error ? toast(error.message, 'error') : toast('Password reset email sent.')
  }
  async function deleteAccount() {
    if (!(await ask('This permanently deletes your account and all your study data. It cannot be undone.', 'Delete forever'))) return
    setBusy(true)
    const { error } = await supabase.functions.invoke('delete-account')
    if (error) { setBusy(false); return toast('Could not delete the account. The delete-account function may not be deployed yet. See README.md.', 'error') }
    await supabase.auth.signOut(); toast('Your account was deleted.')
  }

  return (
    <section className="flex flex-col gap-4">
      <h1>Settings</h1>
      <Setup user={user} initial={profile} onDone={onSaved} />
      <div className="card flex flex-col gap-3">
        <h2>Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(([v, t, Icon]) => <button key={v} aria-pressed={theme === v} className={`btn-quiet min-h-11 ${theme === v ? 'grad-bg !border-transparent' : ''}`} onClick={() => { setTheme(v); setT(v) }}><Icon size={16} />{t}</button>)}
        </div>
      </div>
      <div className="card flex flex-col gap-3">
        <h2>Account</h2>
        <p className="text-sm">{user.email} · <span className={user.email_confirmed_at ? 'text-accent' : 'text-ink/80'}>{user.email_confirmed_at ? 'Email verified' : 'Email not verified'}</span></p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-quiet" onClick={resetPassword}>Send password reset email</button>
          <button className="btn-quiet" onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </div>
      <div className="card flex flex-col gap-3">
        <h2>Your data</h2>
        <p className="text-sm text-ink/70">Download everything StudyFlow stores about you as a JSON file. Your notes and sessions are private to your account.</p>
        <button className="btn-quiet w-fit" disabled={busy} onClick={exportData}><Download size={16} />Download my data</button>
      </div>
      <div className="card flex flex-col gap-3 border-ink/40">
        <h2>Delete account</h2>
        <p className="text-sm text-ink/70">This removes your account and all of your progress, sessions, tasks, notes and revisions for good. Type DELETE to enable the button.</p>
        <input className="input" aria-label="Type DELETE to confirm" value={word} onChange={e => setWord(e.target.value)} placeholder="DELETE" autoComplete="off" />
        <button className="btn-quiet w-fit border-ink/40 text-ink" disabled={busy || word !== 'DELETE'} onClick={deleteAccount}>Delete my account</button>
      </div>
    </section>
  )
}
