import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../supabase'

const Msg = ({ m }) => m && <p role="alert" className={`rounded-lg p-3 text-sm ${m.ok ? 'bg-emerald-500/150/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/150/15 text-rose-700 dark:text-rose-300'}`}>{m.text}</p>
const strong = p => p.length >= 8 && /\d/.test(p) && /[a-zA-Z]/.test(p)
const PW_RULE = 'Password needs 8+ characters with letters and numbers.'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '', terms: false })
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function submit(e) {
    e.preventDefault(); setMsg(null)
    if (mode === 'signup') {
      if (f.name.trim().length < 2) return setMsg({ text: 'Enter your full name.' })
      if (!strong(f.pw)) return setMsg({ text: PW_RULE })
      if (f.pw !== f.pw2) return setMsg({ text: 'Passwords do not match.' })
      if (!f.terms) return setMsg({ text: 'Please accept the terms and privacy notice.' })
    }
    setBusy(true)
    let error, ok
    if (mode === 'login') ({ error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.pw }))
    else if (mode === 'signup') {
      ({ error } = await supabase.auth.signUp({ email: f.email, password: f.pw, options: { data: { full_name: f.name.trim() } } }))
      ok = 'Check your email and click the verification link, then log in.'
    } else {
      ({ error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin }))
      ok = 'If that email has an account, a reset link is on its way.'
    }
    setBusy(false)
    setMsg(error ? { text: error.message } : ok ? { ok: true, text: ok } : null)
  }

  const title = { login: 'Log in', signup: 'Create your account', reset: 'Reset your password' }[mode]
  return (
    <form onSubmit={submit} className="card glow mt-8 flex flex-col gap-3">
      <h1>{title}</h1>
      <p className="text-sm text-ink/70">Track Your Progress. Master Your Syllabus.</p>
      {mode === 'signup' && <label>Full name<input className="input" value={f.name} onChange={set('name')} autoComplete="name" /></label>}
      <label>Email<input className="input" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
      {mode !== 'reset' && (
        <label>Password
          <span className="flex gap-2">
            <input className="input" type={show ? 'text' : 'password'} required value={f.pw} onChange={set('pw')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            <button type="button" className="btn-quiet" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>
      )}
      {mode === 'signup' && <>
        <label>Confirm password<input className="input" type={show ? 'text' : 'password'} value={f.pw2} onChange={set('pw2')} autoComplete="new-password" /></label>
        <p className="text-sm text-ink/70">{PW_RULE}</p>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.terms} onChange={set('terms')} />I accept the terms and privacy notice. My study data stays private to my account.</label>
      </>}
      <Msg m={msg} />
      <button className="btn" disabled={busy}>{busy ? 'Please wait…' : title}</button>
      <div className="flex flex-wrap gap-x-4 text-sm underline">
        {mode !== 'login' && <button type="button" onClick={() => { setMode('login'); setMsg(null) }}>I have an account</button>}
        {mode !== 'signup' && <button type="button" onClick={() => { setMode('signup'); setMsg(null) }}>Create an account</button>}
        {mode === 'login' && <button type="button" onClick={() => { setMode('reset'); setMsg(null) }}>Forgot password?</button>}
      </div>
    </form>
  )
}

export function NewPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState(null)
  async function submit(e) {
    e.preventDefault()
    if (!strong(pw)) return setMsg({ text: PW_RULE })
    const { error } = await supabase.auth.updateUser({ password: pw })
    error ? setMsg({ text: error.message }) : onDone()
  }
  return (
    <form onSubmit={submit} className="card glow mt-8 flex flex-col gap-3">
      <h1>Set a new password</h1>
      <label>New password<input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></label>
      <Msg m={msg} />
      <button className="btn">Save new password</button>
    </form>
  )
}
