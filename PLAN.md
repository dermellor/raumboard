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
- [x] Vorschau mit reproduzierbaren Owner- und Admin-Zugängen ausstatten
- [x] Demo- und Zugriffstests für beide Rollen und Kind-Rücksetzung ergänzen
- [x] Tests, Lint und Build ausführen
- [x] Laufende Vorschau registrieren und Kernpfade prüfen
- [x] Änderungen committen

## Verifikation

- ✅ `node --import tsx --test server/demo.test.ts server/access.test.ts server/room-permissions.test.ts` – 23 gezielte Zugriffs-, Demo- und UI-Berechtigungstests bestanden
- ✅ `npm test` – 74 Tests bestanden
- ✅ `npm run lint` – ohne Befund
- ✅ `npm run build` – TypeScript-Projektbuild und Vite-Produktionsbuild erfolgreich
- ✅ `curl` gegen `/api/pin`, `/api/login`, `/api/teacher/verify`, `/api/book`, `DELETE /api/rooms/bibliothek` und `/api/state` – Admin-Löschung erfolgreich; eingebuchtes Kind anschließend mit `currentRoomId: null`
- ✅ `curl` gegen `/api/logout`, `/api/login` und `/api/state` – separates Owner-Konto erfolgreich als Rolle `owner` angemeldet
