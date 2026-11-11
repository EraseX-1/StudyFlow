const KEY = 'studyflow-theme'
export const getTheme = () => { try { return localStorage.getItem(KEY) || 'dark' } catch { return 'system' } }
export function applyTheme(t = getTheme()) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
export function setTheme(t) { try { localStorage.setItem(KEY, t) } catch { /* private mode */ } applyTheme(t) }
