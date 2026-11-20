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
- [x] QA-Nacharbeit: statische Cockpit-Vorschau in den API-Modus schalten (runtimeMode, `/previews/`-Pfad)
- [x] QA-Nacharbeit: PIN-Abfrage in der Abnahmevorschau sicherstellen
- [x] QA-Nacharbeit: Vorschau aus einer aktuellen Produktivdaten-Kopie statt Seed-Daten betreiben
- [x] Tests, Lint und Build erneut ausführen
- [x] App mit Live-Daten starten, registrieren und Endpunkte prüfen
- [x] Nacharbeit committen
- [x] Nacharbeit committen
- [x] QA-Nacharbeit 2: bekannte Lehrer-PIN nur auf der Vorschaukopie setzen (`scripts/set-preview-pin.ts`, PIN 1234) und in der Testanleitung dokumentieren
- [x] PIN-Freischaltung und Verwaltung-Token über die echte Vorschau-API verifizieren (200 auf /api/pin und /api/teacher/verify)

## Verifikation

- `node --import tsx --test server/runtime-mode.test.ts server/verwaltung-access.test.ts server/room-visibility.test.ts` – Preview-Modus-, PIN- und Sichtbarkeitsprüfungen bestanden
- `npm test` – 78/78 bestanden
- `npm run lint` – ohne Befund
- `npm run build` – Build erfolgreich; Bundle enthält die `/previews/`-Erkennung des API-Modus
- `curl http://127.0.0.1:3666/api/state` – Live-Kopie (KGS St. Franziskus-Schule), `deviceUnlocked: false`, `pinLength: 6`, kein Dev-Open-Bypass; falsche PIN und `reseed` werden mit 401 abgewiesen
- Preview-Daten – geschlossener `open-only`-Raum (Medialab) und geschlossener `always`-Raum (Rezeption) vorhanden; 6 Kinder mit echten Ortsangaben eingebucht
