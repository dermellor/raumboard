# Anlage 1 — Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

> Beschreibt den **tatsächlichen** Stand der Raumboard-Instanz (gehosteter
> Betrieb). Bei Architekturänderungen fortschreiben. Kein Rechtsrat.
> Stand: Juli 2026.

## 0. Grundprinzip: Datenminimierung

Die wirksamste Maßnahme ist, sensible Daten gar nicht erst zu erheben. Raumboard
speichert pro Kind nur Vorname + Initial, Klasse, ein Emoji und den aktuellen
Lernort. Keine vollständigen Nachnamen, Geburtsdaten, Adressen, Kontaktdaten,
Noten oder Förderbedarfe. Der Excel/CSV-Import kürzt den Nachnamen bereits im
Browser der Schule; der volle Nachname erreicht den Server nie.

## 1. Vertraulichkeit

**Zugangskontrolle (Server):** Der virtuelle Server (Hetzner, Falkenstein/DE) ist
nur per SSH mit Schlüsselauthentifizierung erreichbar; Passwort-Login deaktiviert.
Zugriff ausschließlich durch den Betreiber.

**Zugangskontrolle (Anwendung):** Die Verwaltung ist durch Login (E-Mail +
Passwort) je Schule geschützt. Die Klassen-Boards sind durch eine Lehrkraft-PIN
gegen unbefugte Bedienung gesichert. Passwörter und PINs werden ausschließlich als
**scrypt-Hash** gespeichert, niemals im Klartext.

**Sitzungen:** Server-signierte, `httpOnly`-Cookies (Manipulation erkennbar),
Übertragung nur über HTTPS.

**Mandantentrennung:** Jede Schule liegt in einer **eigenen, physisch getrennten
Datenbankdatei** (eine SQLite-Datei pro Schule). Ein schulübergreifender
Datenzugriff ist technisch ausgeschlossen; die Zuordnung erfolgt über die
Subdomain der Schule.

**Transportverschlüsselung:** Ausschließlich HTTPS/TLS (Zertifikate via Let's
Encrypt, je Schul-Subdomain). Kein unverschlüsselter Zugriff.

## 2. Integrität

**Eingabekontrolle:** Buchungs- und Verwaltungsaktionen sind serverseitig
autorisiert (Board-PIN bzw. Admin-Login); Kapazitäts- und Klassenregeln werden in
Datenbank-Transaktionen geprüft.

**Übertragungskontrolle:** Datenübertragung nur verschlüsselt (s. o.).

## 3. Verfügbarkeit und Belastbarkeit

**Backup:** Nächtliche, konsistente Sicherung jeder Schul-Datenbank. Jede
Sicherung wird noch auf dem Server mit **AES-256 verschlüsselt (Verschlüsselung
at rest)**, bevor sie das System verlässt; die Ablage in einer EU-Region
(bunny.net Storage) enthält daher ausschließlich Chiffrat. Der Schlüssel liegt
allein auf dem Server (nicht beim Speicheranbieter). Aufbewahrung 14 Tage, danach
automatische Löschung.

**Wiederherstellbarkeit:** Rücksicherung aus dem jüngsten Backup möglich.

**Betrieb:** Dienst als überwachter Systemdienst mit automatischem Neustart.

## 4. Verfahren zur regelmäßigen Überprüfung

**Trennungskontrolle:** produktive Schuldaten und Testdaten (Demo-Mandant) sind
getrennt.

**Aktualität:** Betriebssystem- und Abhängigkeits-Updates werden eingespielt;
für den Excel-Import wird eine gepflegte Bibliotheksversion ohne bekannte
Sicherheitslücken verwendet.

**Auftragskontrolle:** Unterauftragnehmer (Hetzner, bunny.net) sind auf ein
gleichwertiges Schutzniveau verpflichtet; Verarbeitung innerhalb der EU/DE.

## 5. Löschung und Ansprechpartner

**Löschung einzelner Kinder:** Verlässt ein Kind die Schule oder eine Klasse, löscht
die Schule den Datensatz über die Verwaltung; die Löschung wirkt sofort auf die
Datenbank und wird mit der nächsten Sicherung in den Backups nachvollzogen.

**Löschung bei Vertragsende:** Datenbank und alle Backups der Schule werden binnen
30 Tagen unwiederbringlich gelöscht (auf Wunsch mit vorheriger Herausgabe als
CSV/JSON), die Löschung wird bestätigt.

**Ansprechpartner für Datenschutzvorfälle:** Marcel Mellor, mail@marcelmellor.com.
Meldung an die Schule unverzüglich, spätestens innerhalb von 24 Stunden nach
Kenntnis.
