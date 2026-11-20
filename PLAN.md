# PLAN – Anzeige geschlossener Räume pro Raum

Jeder Raum erhält eine dauerhaft gespeicherte Anzeigeoption für die Kinder-Tafeln.
Geschlossene Räume können wahlweise weiterhin als „heute geschlossen“ erscheinen oder verborgen bleiben.
Verwaltung, direkte Raumansichten, Buchungen und unabhängige Zeitfilter bleiben unverändert.

## Offene Punkte

- [x] Datenmodell und SQLite-Migration mit rückwärtskompatiblem Standard ergänzen
- [x] API-Serialisierung und Raum-Mutationen um die Anzeigeoption erweitern
- [x] Auswahlfeld in der bestehenden Raumverwaltung ergänzen
- [x] Gemeinsame Sichtbarkeitslogik für Startseite und Raumauswahl extrahieren
- [x] API-, Persistenz- und UI-/Logiktests für Standardwert und beide Varianten ergänzen
- [x] QA-Nacharbeit: PIN-Abfrage in der Abnahmevorschau sicherstellen
- [x] QA-Nacharbeit: Vorschau aus einer aktuellen Produktivdaten-Kopie statt Seed-Daten betreiben
- [x] Tests, Lint und Build erneut ausführen
- [x] App mit Live-Daten starten, registrieren und Endpunkte prüfen
- [x] Nacharbeit committen

## Verifikation

- `node --import tsx --test server/verwaltung-access.test.ts` – 2/2 bestanden
- `npm test` – 75/75 bestanden
- `npm run lint` – ohne Befund
- `npm run build` – TypeScript-Projektbuild und Vite-Produktionsbuild erfolgreich
- `curl http://127.0.0.1:3673/` und `curl http://127.0.0.1:3673/api/state` – App-Shell erreichbar; Live-Instanz gesperrt, PIN-Gate-Metadaten vorhanden, kein Dev-Open-Bypass
- Live-Datenbankkopie – Integritätsprüfung erfolgreich, sechs Migrationen angewendet, ein geschlossener Raum als `open-only` für die Abnahme vorbereitet
