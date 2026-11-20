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
- [x] Tests, Lint und Build ausführen
- [x] App mit lebendigen Daten starten, registrieren und Endpunkte prüfen
- [x] Änderungen committen

## Verifikation

- `node --import tsx --test server/room-visibility.test.ts` – 3/3 bestanden
- `node --import tsx --test server/access.test.ts` – 10/10 bestanden
- `npm test` – 73/73 bestanden
- `npm run lint` – ohne Befund
- `npm run build` – TypeScript-Projektbuild und Vite-Produktionsbuild erfolgreich
- HTTP-Smoke gegen Port 3666 – Startseite, PIN-Freischaltung und API-State mit 15 Räumen sowie einem geschlossenen `open-only`-Raum erfolgreich
