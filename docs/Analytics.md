# Nutzungsstatistik (OpenPanel)

Raumboard misst seine eigene Nutzung serverseitig über eine
[OpenPanel](https://openpanel.dev)-Instanz des Betreibers
(`analytics.12signals.com`, eigenes Projekt „raumboard", getrennt von allen
anderen Daten dort).

## Grundsätze

- **Nur serverseitig.** Events entstehen im Node/Hono-Backend über die
  OpenPanel-HTTP-API (`server/analytics.ts`). Kein Browser-SDK, kein Cookie,
  keine IP-Adresse im Frontend oder in den Events.
- **Datenminimierung.** Ein Event trägt nur: Tenant-Slug, Board-Pseudonym
  (gekürzter Hash des Gerätetokens), Lernort-ID (Raum-ID), Zeitstempel und
  Zähler/Erfolg-Misserfolg. Niemals Namen — nicht einmal Vorname + Initial —
  und keine E-Mail-Adressen; beim `admin_login` wird nur die Rolle getrackt.
- **Fire-and-forget.** Jeder Send ist asynchron; Buchungen und Board-Betrieb
  warten nie auf Analytics. Fehler werden geloggt, nie geworfen.
- **Demo-Boards werden nie getrackt** (Werfbeispiel pro Besucher, keine Schule).
- **Opt-out pro Schule.** Steht in der `config`-Tabelle der Schule der Schlüssel
  `analytics_opt_out` auf `1`, sendet das Backend für diesen Tenant keine
  Events — serverseitig erzwungen, nicht clientseitig.
- Ohne `RAUMBOARD_OPENPANEL_KEY` im Instance-Profile ist das Tracking komplett aus.

## Events

| Event | Auslöser | Properties |
| --- | --- | --- |
| `app_open` | `/api/state` mit freigeschaltetem Gerät (Board-Token vorhanden); pro Board-Pseudonym auf 30 Minuten dedupliziert | `tenant`, `board` (Pseudonym) |
| `booking` | erfolgreiche `POST /api/book` | `tenant`, `room` (Lernort-ID) |
| `return` | `POST /api/unbook` (Storno/Rückkehr) | `tenant`, `room` (Lernort-ID) |
| `pin_unlock_failed` | fehlgeschlagene `POST /api/pin` bzw. `POST /api/teacher/verify` | `tenant`, `gate` (`board` / `verwaltung`) |
| `admin_login` | erfolgreiche `POST /api/login` | `tenant`, `role` (`owner` / `admin`) |

`profileId` ist der Tenant-Slug, damit das Dashboard pro Schule gruppieren
kann, ohne dass ein personenbezogenes Merkmal nötig wäre.

## Konfiguration

- `RAUMBOARD_OPENPANEL_URL` — Instanz-URL (Default
  `https://analytics.12signals.com`)
- `RAUMBOARD_OPENPANEL_KEY` — API-Key des raumboard-Projekts (im Instance-Profile
  außerhalb des Repos). Ohne Key: kein Tracking.
- Opt-out pro Schule: `config`-Tabelle, Schlüssel `analytics_opt_out`, Wert `1`
  (z. B. per CLI/SQLite setzen).

Abgedeckt durch [`server/analytics.test.ts`](../server/analytics.test.ts):
Events je Aktion, Dedupe, Opt-out, und dass ein scheiternder OpenPanel-Request
die API nie blockiert oder bricht.
