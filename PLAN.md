# PLAN – Issue #4

## Ziel

Lernboard-Namen bleiben in der Lernräume-Ansicht vollständig innerhalb ihrer Karte.
Direkt nach jedem sichtbaren `/` darf der Browser ohne Änderung von Text, Kopie oder zugänglichem Namen umbrechen.
Mehrzeilige Namen und Platzpunkte lassen Karte und gemeinsame Grid-Zeile gemäß Referenz-Mockup V2 mitwachsen.

## QA-Nacharbeit

- [x] Ausgangslage, bestehende Nacharbeits-Commits und verbindliches Mockup analysieren.
- [x] Abweichung reproduziert: Bei der maximalen UI-Skalierung ist `1.05rem` für den langen Namen in der 286-px-Karte knapp zu groß.
- [x] Namensschrift in breiten Lernräume-Karten leicht reduzieren, ohne schmale Karten oder andere Tile-Texte zu verändern.
- [x] Automatisierte Tests für unveränderte Namen mit und ohne `/` ausführen.
- [x] Lint und Typecheck/Build ausführen.
- [x] Breite und schmale Lernräume-Ansicht anhand der Kartenmaße und ausgelieferten CSS-Regeln prüfen.
- [x] Laufende Vorschau mit geleasten Ports registrieren.
- [x] Nacharbeit als Conventional Commit committen.
