# Issue #2 — App via OpenPanel tracken

Ziel: serverseitiges, datenminimiertes OpenPanel-Tracking im Hono-Backend
(analytics.12signals.com, eigenes Projekt „raumboard"). Fire-and-forget,
Opt-out pro Tenant, keine Namen/IPs.

## Todos

- [x] Serverseitigen Tracking-Client `server/analytics.ts` (POST an OpenPanel-API, Fire-and-forget, Fehler nur ins Log)
- [x] Opt-out pro Tenant: `config`-Schlüssel `analytics_opt_out`, im Client ausgewertet
- [x] Events anbinden in `server/index.ts`:
  - [x] `app_open` (Board-State-Abruf mit freigeschaltetem Gerät, Pseudonym aus Board-Token, 30-min-Dedupe)
  - [x] `booking` (Lernort), `return` (Storno, mit Lernort)
  - [x] `pin_unlock_failed` (PIN-Gate Board + Verwaltung)
  - [x] `admin_login`
- [x] Properties fixieren: nur Tenant-Slug, Board-Pseudonym, Lernort-Slug, Zähler — keine Namen, keine IPs, Demo-Boards werden nie getrackt
- [x] `.env.example`: `RAUMBOARD_OPENPANEL_URL` / `RAUMBOARD_OPENPANEL_CLIENT_ID` /
      `RAUMBOARD_OPENPANEL_ORIGIN` (Ingestion authentifiziert über Client-ID + Origin-Header,
      die Instanz vergibt keinen separaten Ingestion-Secret — mit Marcel geklärt)
- [x] Tests `server/analytics.test.ts` (Events, Dedupe, Opt-out, Fetch-Fehler wirft nicht)
- [x] Doku: `docs/Analytics.md` (Events + Opt-out), TOM-Baustein „Nutzungsstatistik", AGENTS.md-Abschnitt
- [ ] OpenPanel-Projekt „raumboard" auf analytics.12signals.com anlegen (Operator-Handgriff, außerhalb des Repos — API-Key landet im Instance-Profile)
- [x] Verifikation gegen lokalen OpenPanel-Mock (Port 3650): alle 5 Events kommen an
      (`app_open` mit Dedupe, `booking`, `return` mit Raum, `pin_unlock_failed`
      mit Gate, `admin_login` mit Rolle); Opt-out-School erzeugt keine Events;
      Properties enthalten nur Tenant/Board-Hash/Raum-ID/Zähler.
- [x] OpenPanel-Projekt „raumboard" auf analytics.12signals.com angelegt
      (Marcel; Client-ID liegt in .env, nicht im Repo)
- [x] Verifikation gegen die echte Instanz: alle 5 Events der Test-School
      „verifikation“ wurden von der Ingestion mit HTTP 200 akzeptiert (falsche
      Client-ID/Origin/Secret werden mit 400 abgelehnt, getestet). Die
      Darstellung im Dashboard ist Marcelns Review (REST-Reporting-API ist auf
      der Self-Hosted-Instanz session-geschützt, nicht per API-Key abfragbar).

Offen bleiben die beiden Operator-Punkte: Projekt auf der Instanz anlegen und
Dashboard-Verifikation — beides braucht Credentials außerhalb dieses Repos
(instance profile), nicht Code.
