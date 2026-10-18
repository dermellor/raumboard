# PLAN – Internes Admin

## Ziel

Internes Operator-Cockpit für die gehostete Raumboard-Plattform bereitstellen.
Alle Schulen, Zustände und 7-Tage-Nutzungsmetriken ohne SSH/DB-Zugriff sichtbar machen.
Operator-Aktionen und Plattformzustand sicher hinter einem separaten Operator-Login anbieten.

## Akzeptanzkriterien

- [x] Operator-geschützte Admin-Route listet Subdomain, Schulname und Status aller gehosteten Instanzen.
- [x] Status umfasst aktiv, Auffälligkeit, Onboarding läuft und Fehler.
- [x] Je Instanz sind aktive Boards, Aktivitäten der letzten 7 Tage und letzte Aktivität sichtbar.
- [x] KPI-Zeile zeigt Instanzen, aktive Boards und Aktivitäten im 7-Tage-Fenster.
- [x] Instanz öffnen, Backup auslösen, Backup-Logs öffnen und Wartungsmodus schalten sind verfügbar.
- [x] Plattform-Panel zeigt Rollout-Verteilung, letzten Backup-Lauf und Zertifikats-Ablauf.
- [x] Self-Host ohne Operator-Konfiguration kann das Cockpit nicht aufrufen.
- [x] Oberfläche folgt dem freigegebenen cremefarbenen, runden Raumboard-Mockup mit ui-rounded.

## Todos

- [x] Instanz-Registry mit Slug, Schulname, Status und Onboarding-Zustand.
- [x] Gecachte 7-Tage-Aggregation aktiver Boards und Aktivitäten je Schul-DB.
- [x] Backup-Status und Zertifikats-Ablauf aus Betriebsdateien/Proxy-Informationen.
- [x] Operator-Auth-Gate und Admin-API/-Route, getrennt von Schul-PINs und Schul-Accounts.
- [x] KPI-Zeile, Instanzen-Tabelle, Status-Badges, Aktionen und Plattform-Panel.
- [x] Tests für Auth-Gate, Metrik-Aggregation und Status-Ableitung.

## Verifikation

- [x] `npm test` – 52 Tests bestanden.
- [x] `npm run build` – TypeScript-Projektbuild und Vite-Produktionsbuild erfolgreich.
- [x] `npm run lint` – ohne Befunde.
- [x] `bash -n deploy/backup.sh deploy/deploy.sh` und `node --check scripts/update-operator-status.mjs` – Betriebs-Skripte syntaktisch gültig.
- [x] Vorschau auf Port 3650 mit Operator-Login, fünf Statusvarianten, KPI-Aggregation, Logs und Wartungsmodus geprüft.
- [x] Produktionsroute `/operator` über den Hono-Server sowie 401 ohne Operator-Cookie geprüft.
