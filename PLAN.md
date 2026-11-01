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

## Offen (für Marcel / Review)

- [ ] Finale visuelle Abnahme durch Marcel.
- [ ] Hinweis zur Abweichung: Das Mockup rendert die 16 Platzpunkte mit seinen eigenen Maßen (root 16 px) tatsächlich als 7+7+2; seine Note und der QA-Befund verlangen zwei Zeilen. Umgesetzt sind zwei Zeilen (8+8) gemäß Note/QA; dokumentiert in Commit und Zusammenfassung.
