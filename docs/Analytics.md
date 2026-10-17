# Nutzungsstatistik (serverseitige Events)

Raumboard misst seine eigene Nutzung über serverseitige Events: Das Node-Backend
POSTet sie an einen konfigurierbaren HTTP-Endpoint (`server/analytics.ts`). Der
Core kennt die Events, nicht das Auswertungswerkzeug — jede Instanz entscheidet
in ihrem Instance-Profile, ob und wohin getrackt wird. Ohne `RAUMBOARD_EVENTS_URL`
ist das Tracking komplett aus; das ist der Default, mit dem ein Self-Hoster ohne
Konfiguration auskommt.

## Grundsätze

- **Nur serverseitig.** Events entstehen im Node/Hono-Backend und werden per
  HTTP-POST gesendet. Kein Browser-SDK, kein Cookie, keine IP-Adresse im
  Frontend oder in den Events.
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

## Events

| Event | Auslöser | Properties |
| --- | --- | --- |
| `app_open` | `/api/state` mit freigeschaltetem Gerät (Board-Token vorhanden); pro Board-Pseudonym auf 30 Minuten dedupliziert | `tenant`, `board` (Pseudonym) |
| `booking` | erfolgreiche `POST /api/book` | `tenant`, `room` (Lernort-ID) |
| `return` | `POST /api/unbook` (Storno/Rückkehr) | `tenant`, `room` (Lernort-ID) |
| `pin_unlock_failed` | fehlgeschlagene `POST /api/pin` bzw. `POST /api/teacher/verify` | `tenant`, `gate` (`board` / `verwaltung`) |
| `admin_login` | erfolgreiche `POST /api/login` | `tenant`, `role` (`owner` / `admin`) |

## Konfiguration

- `RAUMBOARD_EVENTS_URL` — komplette URL des Endpoints, an den gepostet wird.
  Ohne sie: kein Tracking (Default).
- `RAUMBOARD_EVENTS_FORMAT` — Body-Form: `plain` (Default) sendet
  `{ name, tenant, properties }`; `openpanel` wickelt das in die Ingestion-Envelope
  `{ type: 'track', payload: { name, profileId, properties } }` einer
  [OpenPanel](https://openpanel.dev)-Instanz (der Tenant-Slug wird zum
  `profileId`, was das Dashboard pro Schule gruppieren lässt, ohne dass ein
  personenbezogenes Merkmal nötig wäre).
- `RAUMBOARD_EVENTS_HEADERS` — zusätzliche Request-Header als JSON-Objekt, für
  Endpoints, die per Header authentifizieren. Ungültiges JSON schaltet das
  Tracking mit Warnung aus, statt halb konfiguriert zu senden.
- Opt-out pro Schule: `config`-Tabelle, Schlüssel `analytics_opt_out`, Wert `1`
  (z. B. per CLI/SQLite setzen).

### Rezept: OpenPanel (self-hosted)

```
RAUMBOARD_EVENTS_URL=https://<instanz>/api/track
RAUMBOARD_EVENTS_FORMAT=openpanel
RAUMBOARD_EVENTS_HEADERS={"Origin":"https://www.raumboard.de","openpanel-client-id":"<projekt-uuid>"}
```

Die Client-ID ist eine UUID aus den Projekteinstellungen, kein Secret; die
Ingestion prüft genau diesen `Origin`-Header, sofern die Instanz keinen
separaten Ingestion-Secret pro Projekt vergibt.

Abgedeckt durch [`server/analytics.test.ts`](../server/analytics.test.ts):
Events je Aktion, Dedupe, Opt-out, und dass ein scheiternder Event-Request
die API nie blockiert oder bricht.
