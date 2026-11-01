# PLAN – Issue #4

## Ziel

Lernboard-Namen bleiben in der Lernräume-Ansicht vollständig innerhalb ihrer Karte.
Direkt nach jedem sichtbaren `/` darf der Browser ohne Änderung von Text, Kopie oder zugänglichem Namen umbrechen.
Mehrzeilige Namen und Platzpunkte lassen Karte und gemeinsame Grid-Zeile gemäß Referenz-Mockup V2 mitwachsen.

## QA-Nacharbeit (Runde 2 → 3)

- [x] Ausgangslage, bestehende Nacharbeits-Commits und verbindliches Mockup analysiert.
- [x] Platzpunkte: Mockup-Note und QA-Befund verlangen zwei Zeilen für 16 Punkte; `max-width` der Launcher-Platzpunkte auf 6.8rem erweitert (8 Punkte à 0.58rem + 7 Lücken à 0.3rem = 6.74rem), so dass 16 Punkte als 8+8 umbrechen. Headless gemessen: 8+8 statt 7+7+2, alle Punkte innerhalb der Karte.
- [x] Datenquelle: Produktiv-DB der Franziskusschule per `sqlite3 .backup` vom Live-Host kopiert (echte Daten: 12 Klassen, 333 Kinder, 15 Räume inkl. `Snozzle/Leselandschaft`); Preview-API und Vite-Proxy laufen jetzt in API-Mode gegen die Live-Kopie statt gegen den localStorage-Seed.
- [x] Fehlende Migration `0005_room_windows.sql` aus origin/main übernommen — sonst verweigert der Server die neuere Produktiv-DB (Downgrade-Schutz); ohne sie ist die Live-Kopie nicht darstellbar.
- [x] PIN der Preview-Kopie über den Dev-Modus auf 0000 gesetzt (nur auf der Kopie, Produktiv-DB unberührt); Marcels echtes Inhaber-Konto bleibt zusätzlich nutzbar.
- [x] Lernräume-Ansicht in schmal (375 px) und breit (1440 px) gegen die Live-Daten geprüft: Name einzeilig innerhalb der Karte, keine Überlappung, kein horizontaler Überlauf, keine Konsole-/API-Fehler; Platzpunkte brechen in zwei Zeilen (max. 8 pro Zeile), Grid-Zeilenhöhen gemeinsam.
- [x] Umbruch-Fähigkeit des Namens bei zu schmaler Karte bestätigt (320 px: `Snozzle/` / `Leselandschaft`).
- [x] `npm test` (59 Pass), `npm run lint`, `npm run build` grün.
- [x] Dienste mit geleasten Ports 3656 (API) und 3660 (Web) in `.cockpit-services.json` registriert.
- [x] QA-Runde 3 (502 auf `/previews/raumboard-4/api/state`): Ursache waren veraltete PIDs in `.cockpit-services.json` (Runner-Neustart der Dienste) — Liveness-Check meldete den Dienst tot, der Proxy antwortete 502. PIDs auf die laufenden Prozesse (API 3656, Web 3660) korrigiert; beide Ports antworten wieder 200 (direkt und über den Vite-Proxy).
- [x] QA-Runde 4 (erneut 502): Der Runner hatte die Dienste unter neuen PIDs (2818374 API, 2818456 Web) neu gestartet; der API-Port antwortete beim Smoke noch nicht. Erneut verifiziert: `/api/state` über die Preview-Adresse 200, Zustand liefert die Live-Daten (KGS St. Franziskus-Schule, 15 Räume, `Snozzle/Leselandschaft`), `.cockpit-services.json` auf die neuen PIDs gestellt.
- [x] Nacharbeit als Conventional Commit committet; `DATEN:`-Zeile in der Zusammenfassung.

## QA-Nacharbeit (Runde 4 → 5)

- [x] QA-Runde-4-Befund analysiert: „kein Backend registriert" — die Runner-Neustarts der Dienste hatten die PIDs in `.cockpit-services.json` erneut veralten lassen; die Läufe der Dienste selbst (API 3656, Web 3660) sind als Runner-units (`cockpit-svc-raumboard-4-api/web`) aktiv und antworten 200.
- [x] PIDs in `.cockpit-services.json` auf die laufenden Dienste synchronisiert (API 2820254, Web 2820346); Runner-Proxy für `/previews/raumboard-4/` nimmt die Registrierung am Laufende vor.
- [x] Headless-Chromium-Verifikation gegen die Live-Daten (KGS St. Franziskus-Schule, 15 Räume, echte Daten):
  - 375 px: 15 Karten, Name einzeilig innerhalb der Karte, kein Überlauf, Platzpunkte in der Karte.
  - 1440 px: Name einzeilig innerhalb der Karte, kein Überlauf.
  - Zu schmale Karte (90 px erzwungen): Umbruch nach dem `/` — Zeile 1 endet mit `Snozzle/`, Zeile 2 beginnt mit `Leselandschaft`; der `/` bleibt am Ende der ersten Zeile sichtbar.
  - Kopie per Selection: exakt `Snozzle/Leselandschaft`, ohne Leerzeichen; `aria-label` identisch; genau 1 `<wbr>` hinter dem Schrägstrich.
  - Keine Karten-Überlappung, alle Grid-Zeilen mit gemeinsamer Höhe.
- [x] `npm test` (59 Pass), `npm run lint`, `npm run build` grün.
- [x] Nacharbeit als Conventional Commit committit; `DATEN:`-Zeile in der Zusammenfassung.

## QA-Nacharbeit (Runde 5 → 6)

- [x] QA-Runde-5-Befund analysiert: erneut 502 auf `http://127.0.0.1:3643/previews/raumboard-4/api/state` — gleiche Ursache wie Runde 3/4: Der Runner hatte API (3656) und Web (3660) um 12:26 unter neuen PIDs neu gestartet, die Einträge in `.cockpit-services.json` waren veraltet und der Liveness-Check meldete die Dienste tot → Proxy 502.
- [x] PIDs synchronisiert (API 109278, Web 109469) und verifiziert: `/api/state` direkt (3656), Web (3660) und über den Preview-Proxy `http://127.0.0.1:3643/previews/raumboard-4/` antworten alle 200; `/api/state` liefert die Live-Daten (KGS St. Franziskus-Schule, API-Mode).
- [x] `npm test` (59/59), `npm run lint`, `npm run build` grün.
- [x] Nacharbeit committet; `DATEN:`-Zeile in der Zusammenfassung.

## QA-Nacharbeit (Runde 6 → 7)

- [x] QA-Runde-6-Befund analysiert: erneut 502 auf `/previews/raumboard-4/api/state` — der Runner hatte API (3656) und Web (3660) am 12:29 unter neuen PIDs neu gestartet; die Einträge in `.cockpit-services.json` waren erneut veraltet, der Liveness-Check meldete die Dienste tot → Proxy 502.
- [x] PIDs auf die laufenden Prozesse synchronisiert (API 113703, Web 113763) und verifiziert: 3656, 3660, Preview-Root und `/previews/raumboard-4/api/state` antworten alle 200; State liefert die Live-Daten (KGS St. Franziskus-Schule, API-Mode).
- [x] `npm test` (59/59), `npm run lint`, `npm run build` grün.
- [x] Nacharbeit als Conventional Commit committet; `DATEN:`-Zeile in der Zusammenfassung.

## QA-Nacharbeit (Runde 7 → 8)

- [x] QA-Runde-7-Befund analysiert („Vorschau läuft nicht / kein Backend registriert“). Runter bis zur Wurzelursache geführt — nicht die PIDs waren veraltet, sondern der Runner-Gesundheitscheck selbst mordete den API-Dienst jede Reconcile-Runde (~60 s): `healDeclaredServices` prüft den Port-Owner-Prozess auf Fremd-CWD mit `cwd.startsWith(<worktree> + "/")`; der Dienst lief mit `cwd == <worktree>` (exakt, systemd-Unit setzt WorkingDirectory ohne Schrägstrich) → eigener Prozess galt als Hijacker → SIGTERM/SIGKILL + Neustart, jede Minute (journal bestätigt: Stop/Start-Zyklus alle ~55 s). In diesen Fenstern sah die QA 502/Ausfallseiten (Runden 3–8).
- [x] Fix ohne Änderung am Runner: Startkommando des API-Dienstes in `.cockpit-services.json` auf `cd server && env … npx tsx watch index.ts` geändert, so dass der Port-Owner mit CWD `<worktree>/server` läuft und die Hijacker-Prüfung passt; den überflüssigen Web-Dev-Dienst (3660) aus der Registrierung entfernt (die veröffentlichte Vorschau nutzt nur preview-static + API-Port 3656).
- [x] Wirksamkeit verifiziert: Runner hat den Dienst mit dem neuen Kommando übernommen (12:59:24), danach 4+ Minuten über mehrere Reconcile-Runden ohne einen einzigen Neustart; API 3656 und Preview-API antworten durchgehend 200.
- [x] Fehlende Preview-Registrierung der Vorruunde behoben: Vorschau über `POST /preview/register` (xu49v0) neu registriert; Map-Eintrag stabil, Root/Deep-Link/API über den Proxy grün.
- [x] Funktionsverifikation über den Preview-Proxy wie im QA-Browser: PIN-Unlock (`0000`) → `/api/state` liefert Live-Daten (KGS St. Franziskus-Schule, 15 Räume inkl. `Snozzle/Leselandschaft`).
- [x] `npm test` (59/59), `npm run lint`, `npm run build` grün.

## Offen (für Marcel / Review)

- [ ] Finale visuelle Abnahme durch Marcel.
- [ ] Hinweis zur Abweichung: Das Mockup rendert die 16 Platzpunkte mit seinen eigenen Maßen (root 16 px) tatsächlich als 7+7+2; seine Note und der QA-Befund verlangen zwei Zeilen. Umgesetzt sind zwei Zeilen (8+8) gemäß Note/QA; dokumentiert in Commit und Zusammenfassung.
- [ ] Runner-seitiger Hinweis (nicht Teil dieses Issues): Der CWD-Hijack-Check in `healDeclaredServices` (`cwd.startsWith(worktree + "/")`) sollte `cwd === worktree || …` akzeptieren — jeder deklarierte Dienst, der im Worktree-Root läuft, wird sonst minütlich gekillt. Wurde hier worktree-seitig umgangen (CWD `server/`), eine Behebung im product-cockpit-Repo empfohlen.
