import { useEffect, useState } from 'react'
import { Activity, Archive, ChevronDown, CircleAlert, Database, ExternalLink, FlaskConical, LockKeyhole, LogOut, RefreshCw, Server, ShieldCheck, Wrench } from 'lucide-react'

type Status = 'active' | 'attention' | 'onboarding' | 'error'
type Instance = {
  slug: string; schoolName: string; subdomain: string; status: Status; statusReason: string
  activeBoards7d: number; activities7d: number; lastActivity: string | null; maintenance?: boolean
  backup?: { status: string; at?: string; message?: string }; version?: string
}
type Snapshot = {
  instances: Instance[]
  kpis: { instances: number; activeBoards7d: number; activities7d: number }
  platform: { versions: { version: string; count: number }[]; lastBackup: string | null; certificateExpiresAt: string | null }
}

const STATUS: Record<Status, string> = { active: 'Aktiv', attention: 'Auffälligkeit', onboarding: 'Onboarding läuft', error: 'Fehler' }
const fmt = (date: string | null) => date ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : 'Noch keine'

export function OperatorAdmin() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [loginRequired, setLoginRequired] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [openActions, setOpenActions] = useState('')
  const [log, setLog] = useState<{ school: string; text: string } | null>(null)

  async function load() {
    const response = await fetch('/api/operator/overview')
    if (response.status === 401) { setLoginRequired(true); return }
    if (response.status === 404) { setError('Das Betreiber-Cockpit ist in dieser Installation nicht aktiviert.'); return }
    if (!response.ok) { setError('Die Plattformdaten konnten nicht geladen werden.'); return }
    setData(await response.json()); setLoginRequired(false); setError('')
  }
  useEffect(() => { void load() }, [])

  async function login(event: React.FormEvent) {
    event.preventDefault(); setError('')
    const response = await fetch('/api/operator/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (!response.ok) { setError('Operator-Passwort falsch.'); return }
    setPassword(''); await load()
  }
  async function action(slug: string, name: 'backup' | 'maintenance' | 'logs' | 'dev-link', maintenance?: boolean) {
    setBusy(`${slug}:${name}`); setOpenActions('')
    const response = await fetch(`/api/operator/instances/${encodeURIComponent(slug)}/${name}`, {
      method: name === 'logs' ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: name === 'maintenance' ? JSON.stringify({ enabled: !maintenance }) : undefined,
    })
    if (name === 'dev-link' && response.ok) {
      const { url } = await response.json() as { url: string }
      window.open(url, '_blank', 'noopener')
    } else if (name === 'logs' && response.ok) setLog({ school: slug, text: (await response.json()).log })
    else if (!response.ok) setError(((await response.json().catch(() => null))?.error) || 'Aktion fehlgeschlagen.')
    await load(); setBusy('')
  }
  async function logout() { await fetch('/api/operator/logout', { method: 'POST' }); setData(null); setLoginRequired(true) }

  if (loginRequired) return <main className="operator-login"><form onSubmit={login} className="operator-login-card"><div className="operator-mark"><ShieldCheck /></div><p className="operator-eyebrow">Raumboard · Betreiber</p><h1>Internes Admin</h1><p>Nur für den Hosting-Operator. Schul-Accounts und Lehrkraft-PINs gelten hier nicht.</p><label>Operator-Passwort<input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="operator-error">{error}</p>}<button type="submit"><LockKeyhole /> Sicher anmelden</button></form></main>

  return <main className="operator-admin">
    <header className="operator-head"><div><p className="operator-eyebrow">Raumboard · Betreiber</p><h1>Guten Morgen, Marcel.</h1><p>Alle Schulen und die Plattform auf einen Blick.</p></div><div className="operator-head-actions"><button onClick={() => void load()} aria-label="Aktualisieren"><RefreshCw /></button><button onClick={() => void logout()}><LogOut /> Abmelden</button></div></header>
    {error && <div className="operator-banner"><CircleAlert /> {error}</div>}
    {data && <>
      <section className="operator-kpis" aria-label="Kennzahlen"><article><span><Server /> Instanzen</span><strong>{data.kpis.instances}</strong><small>gehostete Schulen</small></article><article><span><Database /> Aktive Boards</span><strong>{data.kpis.activeBoards7d}</strong><small>in den letzten 7 Tagen</small></article><article><span><Activity /> Aktivitäten</span><strong>{data.kpis.activities7d}</strong><small>in den letzten 7 Tagen</small></article></section>
      <section className="operator-section"><div className="operator-title"><div><p className="operator-eyebrow">Kunden & Instanzen</p><h2>Schulen</h2></div><span>{data.instances.length} Instanzen</span></div>
        <div className="operator-table-wrap"><table><thead><tr><th>Schule</th><th>Status</th><th>Nutzung · 7 Tage</th><th>Letzte Aktivität</th><th>Backup</th><th><span className="sr-only">Aktionen</span></th></tr></thead><tbody>{data.instances.map((item) => <tr key={item.slug}><td><strong>{item.schoolName}</strong><a href={`https://${item.subdomain}`} target="_blank">{item.subdomain} <ExternalLink /></a></td><td><span className={`operator-status ${item.status}`}><i />{STATUS[item.status]}</span><small>{item.maintenance ? 'Wartungsmodus' : item.statusReason}</small></td><td><strong>{item.activeBoards7d} Boards</strong><small>{item.activities7d} Aktivitäten</small></td><td>{fmt(item.lastActivity)}</td><td><strong>{item.backup?.status === 'failed' ? 'Fehlgeschlagen' : item.backup?.at ? 'Erfolgreich' : 'Ausstehend'}</strong><small>{item.backup?.at ? fmt(item.backup.at) : 'Kein Lauf erfasst'}</small></td><td className="operator-actions"><button onClick={() => setOpenActions(openActions === item.slug ? '' : item.slug)}>Aktionen <ChevronDown /></button>{openActions === item.slug && <div className="operator-menu"><a href={`https://${item.subdomain}`} target="_blank"><ExternalLink /> Instanz öffnen</a><button disabled={!!busy} onClick={() => void action(item.slug, 'dev-link')}><FlaskConical /> Dev-Ansicht öffnen</button><button disabled={!!busy} onClick={() => void action(item.slug, 'backup')}><Archive /> Backup jetzt</button><button disabled={!!busy} onClick={() => void action(item.slug, 'logs')}><Activity /> Backup-Logs</button><button disabled={!!busy} onClick={() => void action(item.slug, 'maintenance', item.maintenance)}><Wrench /> {item.maintenance ? 'Wartung beenden' : 'Wartungsmodus'}</button></div>}</td></tr>)}</tbody></table>{data.instances.length === 0 && <div className="operator-empty">Noch keine gehosteten Instanzen registriert.</div>}</div>
      </section>
      <section className="operator-platform"><div className="operator-title"><div><p className="operator-eyebrow">Infrastruktur</p><h2>Plattform</h2></div><span className="operator-status active"><i /> Systeme erreichbar</span></div><div className="operator-platform-grid"><article><span>Aktueller Rollout</span><strong>{data.platform.versions[0]?.version || '–'}</strong><small>{data.platform.versions.map((item) => `${item.count}× ${item.version}`).join(' · ') || 'Keine Instanzen'}</small></article><article><span>Letzter Backup-Lauf</span><strong>{fmt(data.platform.lastBackup)}</strong><small>über alle Instanzen</small></article><article><span>Zertifikate</span><strong>{data.platform.certificateExpiresAt ? fmt(data.platform.certificateExpiresAt).split(',')[0] : 'Automatisch'}</strong><small>{data.platform.certificateExpiresAt ? 'nächster Ablauf' : 'Caddy verwaltet TLS'}</small></article></div></section>
    </>}
    {log && <div className="operator-modal" onClick={() => setLog(null)}><div onClick={(event) => event.stopPropagation()}><button className="operator-modal-close" onClick={() => setLog(null)}>Schließen</button><p className="operator-eyebrow">Backup-Protokoll</p><h2>{log.school}</h2><pre>{log.text}</pre></div></div>}
  </main>
}
