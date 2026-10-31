# PLAN – Issue #4

## Ziel

Lernboard-Namen bleiben in der Lernräume-Ansicht vollständig innerhalb ihrer Karte.
Direkt nach jedem sichtbaren `/` darf der Browser ohne Änderung von Text, Kopie oder zugänglichem Namen umbrechen.
Mehrzeilige Namen und Platzpunkte lassen Karte und gemeinsame Grid-Zeile gemäß Referenz-Mockup V2 mitwachsen.

## QA-Nacharbeit

- [x] Breite Lernräume-Ansicht: Karten so breit halten, dass `Snozzle/Leselandschaft` bei 1440 px einzeilig bleibt.
- [x] Schmale Lernräume-Ansicht: optionalen Umbruch nach `/` sowie vollständige Namen und Platzpunkte beibehalten.
- [x] Mehrere, führende, folgende und benachbarte `/` automatisiert auf verlustfreie Umbruchstellen prüfen.
- [x] Emoji-Assets unter dem konfigurierten Vite-Basispfad statt root-absolut laden.
- [x] Gebauten Preview-Pfad sowie sichtbare Emoji-Ressourcen ohne 404 prüfen.
- [x] Tests, Lint, Typecheck/Build und Browser-Layoutprüfung ausführen.
- [x] Nacharbeit als Conventional Commit committen.
