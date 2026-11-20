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
- [x] Tests, Lint und Build ausführen
- [x] Laufende Vorschau registrieren und Kernpfade prüfen
- [x] Änderungen committen

## Verifikation

- ✅ `node --import tsx --test server/access.test.ts server/room-permissions.test.ts` – 13 Tests bestanden
- ✅ `npm test` – 73 Tests bestanden
- ✅ `npm run lint` – ohne Befund
- ✅ `npm run build` – TypeScript-Projektbuild und Vite-Build erfolgreich
- ✅ `curl -sS -o /dev/null -w 'direct=%{http_code}\\n' -H 'Host: dev.raumboard.de' http://127.0.0.1:3659/api/state && curl -sS -o /dev/null -w 'proxy=%{http_code}\\n' http://127.0.0.1:3661/api/state` – API direkt und über den Vorschau-Proxy mit HTTP 200 erreichbar
- ❌ `node --import tsx --test server/access.test.ts server/room-permissions.test.ts` – initial wegen fehlender lokaler Abhängigkeiten abgebrochen; mit `npm ci` behoben
