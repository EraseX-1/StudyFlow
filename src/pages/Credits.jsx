import { useState } from 'react'
import { Check, Compass, Copy, Code, Crown, Lightbulb, Mail, MessageCircle, Palette, Server, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from '../ui'

const EMAIL = 'studiosxreton@gmail.com'
const CATS = [
  ['Product Concept', Lightbulb], ['UI/UX Design', Palette], ['Frontend Development', Code],
  ['Backend & Infrastructure', Server], ['Testing & Quality Assurance', ShieldCheck],
  ['Product Direction', Compass], ['Community & Suggestions', MessageCircle],
]
const CREDITS = [['Development', 'Xreton Studios'], ['Design Idea', 'Chunk Studios'], ['Product', 'StudyFlow']]
const go = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
const delay = i => ({ animationDelay: `${i * 70}ms` })

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    try {
      const a = document.createElement('textarea')
      a.value = text; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok
    } catch { return false }
  }
}

export default function Credits() {
  const [copied, setCopied] = useState(false)
  async function copy() {
    if (await copyText(EMAIL)) { setCopied(true); toast('Email address copied.'); setTimeout(() => setCopied(false), 2000) }
    else toast('Could not copy. Select the address and copy it manually.', 'error')
  }
  return (
    <div className="flex flex-col gap-8">
      <section className="hero hero-anim rise flex flex-col items-center gap-3 px-5 py-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-ink/5 px-3 py-1 text-xs font-bold"><Sparkles size={14} className="text-accent" />Team &amp; Credits</span>
        <h1 className="mx-auto text-3xl md:text-4xl">Meet the People Behind StudyFlow</h1>
        <p className="max-w-md text-ink/80">Built with creativity, collaboration and a shared vision to make studying simpler and smarter.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {[['leadership', 'Leadership'], ['credits', 'Credits'], ['contributions', 'Contributions'], ['contact', 'Contact']].map(([id, t]) => <button key={id} className="btn-quiet" onClick={() => go(id)}>{t}</button>)}
        </div>
      </section>

      <section id="leadership" className="flex scroll-mt-16 flex-col gap-3">
        <h2>Leadership</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <article className="person rise md:col-span-3" style={delay(1)}>
            <span className="grad-bg mb-4 grid size-11 place-items-center rounded-xl text-white"><Crown size={22} /></span>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Founder</p>
            <p className="mt-1 text-3xl font-bold">Novi Chunk</p>
          </article>
          <article className="person rise md:col-span-2" style={delay(2)}>
            <span className="mb-4 grid size-11 place-items-center rounded-xl border border-ink/15 bg-ink/5 text-accent"><Sparkles size={22} /></span>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Co-Founder</p>
            <p className="mt-1 text-2xl font-bold">Erase</p>
          </article>
        </div>
      </section>

      <section id="credits" className="flex scroll-mt-16 flex-col gap-3">
        <h2>Project &amp; Development Credits</h2>
        <div className="card divide-y divide-ink/10 p-0">
          {CREDITS.map(([k, v], i) => (
            <div key={k} className="rise flex items-center justify-between gap-3 px-4 py-3" style={delay(i)}>
              <span className="text-sm text-ink/70">{k}</span><span className="font-bold">{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="contributions" className="flex scroll-mt-16 flex-col gap-3">
        <h2>Contribution Categories</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATS.map(([t, Icon], i) => (
            <div key={t} className="card rise flex items-center gap-3 p-3 transition hover:-translate-y-px" style={delay(i)}>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand"><Icon size={18} /></span>
              <span className="flex-1 text-sm font-semibold">{t}</span>
              <span className="rounded-full border border-ink/15 px-2 py-0.5 text-xs text-ink/70">Coming Soon</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink/70">Names appear here once contributors and their contributions are confirmed.</p>
      </section>

      <section id="contact" className="glow card flex scroll-mt-16 flex-col gap-3 p-5">
        <span className="grad-bg grid size-11 place-items-center rounded-xl text-white"><Mail size={22} /></span>
        <h2>For Any Bugs or Suggestions Contact</h2>
        <p className="text-sm text-ink/80">Found a bug, or have an idea that would make StudyFlow better? Send it to this address.</p>
        <p className="break-all rounded-lg border border-ink/15 bg-ink/5 px-3 py-2 font-bold">{EMAIL}</p>
        <button className="btn w-full sm:w-fit" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy Email'}</button>
      </section>

      <section className="hero rise px-5 py-8 text-center">
        <p className="grad-text text-2xl font-bold">Made for students. Built for better learning.</p>
        <p className="mt-2 text-ink/80">Thank you for being part of the StudyFlow journey.</p>
      </section>
    </div>
  )
}
