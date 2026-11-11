import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { BookOpen, CalendarCheck, GraduationCap, Info, LayoutDashboard, LogOut, Monitor, Moon, MoreHorizontal, RotateCcw, Settings, StickyNote, Sun, Timer as TimerIcon } from 'lucide-react'
import { supabase, configured } from './supabase'
import { getTheme, setTheme } from './theme'
import { UiHost } from './ui'
import Auth, { NewPassword } from './pages/Auth'
import Setup from './pages/Setup'
import Tracker from './pages/Tracker'
import Timer from './pages/Timer'
import Exams from './pages/Exams'
import Credits from './pages/Credits'
import Dashboard from './pages/Dashboard'
import Revision from './pages/Revision'
import Notes from './pages/Notes'
import Planner from './pages/Planner'

const NEXT = { light: 'dark', dark: 'system', system: 'light' }
const ICON = { light: Sun, dark: Moon, system: Monitor }
function ThemeToggle() {
  const [t, setT] = useState(getTheme())
  const Icon = ICON[t]
  return <button className="btn-quiet" aria-label={`Theme: ${t}. Press to change.`} title={`Theme: ${t}`} onClick={() => { setTheme(NEXT[t]); setT(NEXT[t]) }}><Icon size={16} /></button>
}

const Logo = () => <span className="flex items-center gap-2 font-bold"><span className="grid size-7 place-items-center rounded-lg grad-bg text-sm text-white">S</span>StudyFlow</span>

const Page = ({ children }) => <main className="mx-auto max-w-md p-4">{children}</main>

const HOME = ['/', 'Home', LayoutDashboard, true], SYL = ['/syllabus', 'Syllabus', BookOpen], PLAN = ['/planner', 'Planner', CalendarCheck], TIME = ['/timer', 'Timer', TimerIcon]
const REV = ['/revision', 'Revision', RotateCcw], NOTE = ['/notes', 'Notes', StickyNote], EXAM = ['/exams', 'Exams', GraduationCap], SET = ['/settings', 'Settings', Settings], CRED = ['/credits', 'Credits', Info]
const GROUPS = [['Study', [HOME, SYL, PLAN, TIME]], ['Review', [REV, NOTE, EXAM]], ['Account', [SET, CRED]]]
const TABS = [HOME, SYL, TIME, PLAN]
const MORE = [REV, NOTE, EXAM, SET, CRED]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [recovery, setRecovery] = useState(false)
  const [more, setMore] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setProfile(undefined)
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data ?? null))
  }, [session?.user?.id])

  useEffect(() => { setMore(false) }, [pathname])
  useEffect(() => { const k = e => e.key === 'Escape' && setMore(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])

  if (!configured) return <Page><h1>StudyFlow is not connected yet</h1><p className="mt-2">Add your Supabase URL and anon key to a <code>.env</code> file, then restart. Steps are in README.md.</p></Page>
  if (session === undefined) return <Page><div className="skeleton mt-8 h-40" /></Page>
  if (recovery && session) return <Page><NewPassword onDone={() => setRecovery(false)} /></Page>
  if (!session) return <Page><Auth /></Page>
  if (profile === undefined) return <Page><div className="skeleton mt-8 h-40" /></Page>
  if (!profile?.onboarded) return <Page><Setup user={session.user} onDone={setProfile} /></Page>

  const signOut = () => supabase.auth.signOut()
  const side = ({ isActive }) => `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold ${isActive ? 'bg-brand/15 text-ink shadow-[inset_3px_0_0_var(--brand)]' : 'text-ink/75 hover:bg-ink/5'}`
  const tab = ({ isActive }) => `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors duration-200 before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:bg-brand before:transition-transform before:duration-200 ${isActive ? 'text-brand before:scale-x-100' : 'text-ink/70 before:scale-x-0'}`
  const sheet = ({ isActive }) => `flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-semibold ${isActive ? 'bg-ink/10' : ''}`
  return (
    <>
      <UiHost />
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col gap-4 border-r border-ink/10 bg-surface p-3 md:flex">
        <div className="px-2 text-lg"><Logo /></div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {GROUPS.map(([title, items]) => (
            <div key={title}>
              <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-ink/55">{title}</p>
              {items.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} className={side}><Icon size={18} />{label}</NavLink>)}
            </div>
          ))}
        </nav>
        <div className="flex gap-2"><ThemeToggle /><button className="btn-quiet flex-1" onClick={signOut}><LogOut size={16} />Log out</button></div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/10 bg-surface px-4 py-2 md:hidden">
        <Logo /><ThemeToggle />
      </header>

      <div className="md:pl-56">
        <main key={pathname} className="page mx-auto w-full max-w-3xl px-4 py-4 pb-24 md:py-6 md:pb-8">
          <Routes>
            <Route path="/" element={<Dashboard profile={profile} />} />
            <Route path="/syllabus" element={<Tracker profile={profile} />} />
            <Route path="/timer" element={<Timer profile={profile} />} />
            <Route path="/revision" element={<Revision profile={profile} />} />
            <Route path="/notes" element={<Notes profile={profile} />} />
            <Route path="/planner" element={<Planner profile={profile} />} />
            <Route path="/exams" element={<Exams profile={profile} />} />
            <Route path="/settings" element={<Setup user={session.user} initial={profile} onDone={setProfile} />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </main>
        <footer className="mx-auto hidden max-w-3xl px-4 pb-6 text-xs text-ink/60 md:block">
          StudyFlow · Track Your Progress. Master Your Syllabus. · <NavLink to="/credits" className="underline">Credits</NavLink>
        </footer>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-ink/10 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} className={tab}><Icon size={20} />{label}</NavLink>)}
        <button className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink/70" onClick={() => setMore(true)} aria-haspopup="dialog"><MoreHorizontal size={20} />More</button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMore(false)}>
          <div className="overlay-in absolute inset-0 bg-black/40" />
          <div role="dialog" aria-label="More" className="sheet-in absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-xl bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]" onClick={e => e.stopPropagation()}>
            {MORE.map(([to, label, Icon]) => <NavLink key={to} to={to} className={sheet}><Icon size={20} />{label}</NavLink>)}
            <button className="flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-semibold" onClick={signOut}><LogOut size={20} />Log out</button>
          </div>
        </div>
      )}
    </>
  )
}
