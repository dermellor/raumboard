# PLAN – Issue #4

## Ziel

Lernboard-Namen bleiben in der Lernräume-Ansicht vollständig innerhalb ihrer Karte.
Direkt nach jedem sichtbaren `/` darf der Browser ohne Änderung von Text, Kopie oder zugänglichem Namen umbrechen.
Mehrzeilige Namen und Platzpunkte lassen Karte und gemeinsame Grid-Zeile gemäß Referenz-Mockup V2 mitwachsen.

## Akzeptanzkriterien

- [x] In jeder Darstellung eines Lernboard-Namens in der Lernräume-Ansicht ist direkt nach jedem `/` eine optionale Umbruchstelle vorhanden.
- [x] `Snozzle/Leselandschaft` bricht in einer zu schmalen Lernraum-Karte als `Snozzle/` und `Leselandschaft` auf zwei Zeilen um.
- [x] Der `/` bleibt am Ende der ersten Zeile sichtbar; Darstellung, Kopieren und zugänglicher Name bleiben exakt unverändert.
- [x] Bei ausreichender Kartenbreite bleibt `Snozzle/Leselandschaft` einzeilig.
- [x] Namen und Platzpunkte bleiben bei relevanten Kartenbreiten vollständig innerhalb der Karte.
- [x] Kurze Namen und Namen ohne `/` bleiben unverändert.
- [x] Platzpunkte können unabhängig vom Namen mehrzeilig umbrechen.
- [x] Mehrzeilige Inhalte lassen Karten und gemeinsame Grid-Zeile ohne Überlagerung mitwachsen.
- [x] Die Lernräume-Ansicht entspricht dem Referenz-Mockup V2.

## Todos

- [x] Optionale, in Kopie und Accessibility-Text unsichtbare Umbruchstellen nach `/` ergänzen.
- [x] Automatisierte Tests für zugrunde liegenden Namen sowie Namen mit und ohne `/` ergänzen.
- [x] Kurzen Namen, Namen ohne `/` und `Snozzle/Leselandschaft` in schmaler und breiter Karte prüfen.
- [x] Zweizeiligen Namen mit zweizeiligen Platzpunkten und Höhenangleichung der Grid-Zeile prüfen.
- [x] Lernräume-Ansicht im Browser auf Überlauf, Überdeckung und Mockup-Übereinstimmung prüfen.
