# PLAN – Issue #5

## Ziel
Räume dürfen endgültig nur mit einem aktiven Verwaltungskonto gelöscht werden.
Lehrkraft-PIN-Sitzungen behalten alle übrigen Funktionen der Raumverwaltung.
Die Oberfläche zeigt die Löschaktion ausschließlich bei angemeldetem Konto.

## Offene Punkte

- [x] DELETE-Endpunkt mit Lehrkraft- und Konto-Autorisierung absichern
- [x] Löschaktion anhand des aktiven Kontos ein- oder ausblenden
- [x] Zugriffstests für PIN-only, admin und owner sowie UI-Sichtbarkeit ergänzen
- [x] Rücksetzen eingebuchter Kinder beim Löschen absichern
- [x] Statischen Cockpit-Preview-Build zuverlässig mit dem API-Store verbinden
- [x] Owner- und Admin-Anmeldung in der Demo-Oberfläche eindeutig auswählbar machen
- [x] Browser-unabhängige Tests für Preview-Modus und beide Demo-Rollen ergänzen
- [x] Lösch-Journey mit PIN-Bestätigung und Kind-Rücksetzung erneut prüfen
- [x] Tests, Lint und Build ausführen
- [x] Laufende Vorschau registrieren und Kernpfade prüfen
- [x] Merge `origin/main` semantisch auflösen (roomsHeading-Stand + Löschschutz in `server/access.test.ts` vereint, Commit df0fccb)
- [x] Änderungen committen

## Verifikation (nach Merge-Sync)

- ✅ `npx tsx --test server/access.test.ts` – 12 Tests bestanden (kombinierte Version mit roomsHeading- und Löschschutz-Tests)
- ✅ `npm test` – 90 Tests bestanden
- ✅ `npm run lint` – ohne Befund
- ✅ `npm run build -- --base=/previews/raumboard-5/` – Build erfolgreich
- ✅ `curl` gegen Preview-API – PIN-only-Löschung 401 („admin required“), Admin-Löschung 200

## Verifikation

- ✅ `node --import tsx --test server/runtime-mode.test.ts server/demo.test.ts server/access.test.ts server/room-permissions.test.ts` – 26 gezielte Preview-, Zugriffs-, Demo- und UI-Berechtigungstests bestanden
- ✅ `npm test` – 77 Tests bestanden
- ✅ `npm run lint` – ohne Befund
- ✅ `npm run build -- --base=/previews/raumboard-5/` – TypeScript-Projektbuild und Vite-Produktionsbuild unter dem Preview-Basispfad erfolgreich
- ✅ `curl` gegen `/api/state`, `/api/pin`, `/api/login`, `/api/teacher/verify`, `/api/book` und `DELETE /api/rooms/bibliothek` – PIN-only mit 401 abgewiesen; Admin-Löschung erfolgreich; eingebuchtes Kind anschließend mit `currentRoomId: null`
- ✅ `curl` gegen `/api/logout`, `/api/login` und `/api/state` – separates Owner-Konto erfolgreich als Rolle `owner` angemeldet
