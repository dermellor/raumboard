#!/bin/bash
# Baut aus docs/AVV-Vorlage.md + docs/TOM.md ein unterschriftsreifes PDF
# (AVV, TOM als Anlage 1). Entfernt die einleitenden Hinweis-Blöcke (Blockquotes)
# und setzt die Vertragsfelder beider Parteien ein.
#
# Usage:
#   scripts/build-avv-pdf.sh                      # leere Vorlage, Platzhalter bleiben
#   scripts/build-avv-pdf.sh <schule-slug>        # personalisiert
#   scripts/build-avv-pdf.sh <schule-slug> out.pdf
#
# Werte je Schule:  ~/.config/raumboard/avv/<slug>.env   ($AVV_DIR verschiebt das
# Verzeichnis, $AVV_PARTEIEN zeigt direkt auf eine Datei). Bewusst NICHT im Repo:
# Privatadresse des Auftragnehmers und Daten der Schule. Plain KEY=value, verbatim
# gelesen, also keine Tilde und keine Shell-Expansion. Erwartete Keys:
#
#   AVV_AN_NAME          Auftragnehmer, juristisch korrekter Name
#   AVV_AN_ANSCHRIFT     Auftragnehmer, Anschrift einzeilig
#   AVV_AN_KONTAKT       Auftragnehmer, Kontakt für Datenschutzvorfälle
#   AVV_SCHULE_NAME      Schule, offizieller Name
#   AVV_SCHULE_ANSCHRIFT Schule, Anschrift einzeilig
#   AVV_SCHULE_LEITUNG   Schulleitung, Name
#   AVV_SUB_1 … AVV_SUB_9  Unterauftragnehmer, je "Name | Leistung | Ort"
#
# Fehlt ein Key, bleibt sein Platzhalter im PDF stehen und es gibt eine Warnung:
# ein unvollständiges PDF ist beim Gegenlesen sichtbar, ein stilles Standardwert
# nicht. Ohne AVV_SUB_* bleibt die Beispieltabelle der Vorlage stehen.
#
# Rückwärtskompatibel: docs/.avv-anschrift.txt gilt weiter als AVV_AN_ANSCHRIFT,
# ebenso $AVV_ANSCHRIFT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="${1:-}"
AVV_DIR="${AVV_DIR:-$HOME/.config/raumboard/avv}"

case "$SLUG" in
  '') OUT="${2:-$ROOT/docs/Raumboard-AVV.pdf}" ;;
  *[!A-Za-z0-9._-]*) echo "Ungültiger Slug: $SLUG" >&2; exit 1 ;;
  *) OUT="${2:-$ROOT/docs/Raumboard-AVV-$SLUG.pdf}" ;;
esac

command -v pandoc >/dev/null || { echo "pandoc fehlt (brew install pandoc)"; exit 1; }
command -v xelatex >/dev/null || { echo "xelatex fehlt (z. B. brew install --cask mactex-no-gui)"; exit 1; }

PARTEIEN="${AVV_PARTEIEN:-}"
if [ -z "$PARTEIEN" ] && [ -n "$SLUG" ]; then
  PARTEIEN="$AVV_DIR/$SLUG.env"
  [ -f "$PARTEIEN" ] || { echo "Keine Werte für '$SLUG': $PARTEIEN fehlt" >&2; exit 1; }
fi
if [ -n "$PARTEIEN" ]; then
  [ -f "$PARTEIEN" ] || { echo "Datei fehlt: $PARTEIEN" >&2; exit 1; }
  # Gleiches Format und derselbe Parser wie die Instanz-Profile.
  source "$ROOT/scripts/instance.sh"
  raumboard_load_env_file "$PARTEIEN"
fi

# Legacy-Quelle für die Anschrift des Auftragnehmers.
if [ -z "${AVV_AN_ANSCHRIFT:-}" ]; then
  if [ -n "${AVV_ANSCHRIFT:-}" ]; then
    AVV_AN_ANSCHRIFT="$AVV_ANSCHRIFT"
  elif [ -f "$ROOT/docs/.avv-anschrift.txt" ]; then
    AVV_AN_ANSCHRIFT="$(tr -d '\n' < "$ROOT/docs/.avv-anschrift.txt")"
  fi
  export AVV_AN_ANSCHRIFT="${AVV_AN_ANSCHRIFT:-}"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

python3 - "$ROOT" "$TMP/combined.md" <<'PY'
import os, re, sys, pathlib
root, outmd = sys.argv[1], sys.argv[2]
avv = pathlib.Path(root, "docs/AVV-Vorlage.md").read_text()
tom = pathlib.Path(root, "docs/TOM.md").read_text()
fehlend = []

def strip_leading_notes(md):
    """Entfernt führende Blockquote-Hinweise direkt nach der H1-Überschrift."""
    lines = md.splitlines()
    out, i = [], 0
    while i < len(lines) and not lines[i].startswith("# "):
        out.append(lines[i]); i += 1
    if i < len(lines):
        out.append(lines[i]); i += 1  # die H1 selbst
    while i < len(lines) and (lines[i].strip() == "" or lines[i].lstrip().startswith(">")):
        i += 1
    return "\n".join(out + [""] + lines[i:])

def füllen(md, ersetzungen):
    for platzhalter, key in ersetzungen:
        wert = os.environ.get(key, "").strip()
        if wert:
            md = md.replace(platzhalter, wert, 1)
        elif platzhalter in md:
            fehlend.append(key)
    return md

avv = strip_leading_notes(avv)
tom = strip_leading_notes(tom)

# Reihenfolge zählt: "[Name der Schule]" enthält "[Name]".
avv = füllen(avv, [
    ("[Name der Schule]",        "AVV_SCHULE_NAME"),
    ("[Anschrift]",              "AVV_SCHULE_ANSCHRIFT"),
    ("[Name]",                   "AVV_SCHULE_LEITUNG"),
    ("«AUFTRAGNEHMER_NAME»",     "AVV_AN_NAME"),
    ("«AUFTRAGNEHMER_ANSCHRIFT»","AVV_AN_ANSCHRIFT"),
    # Ziff. 7 nennt Name und Kontakt erneut.
    ("«AUFTRAGNEHMER_NAME»",     "AVV_AN_NAME"),
    ("«AUFTRAGNEHMER_KONTAKT»",  "AVV_AN_KONTAKT"),
])
tom = füllen(tom, [
    ("«BETREIBER_NAME»",    "AVV_AN_NAME"),
    ("«BETREIBER_KONTAKT»", "AVV_AN_KONTAKT"),
])

# Unterauftragnehmer: Beispieltabelle samt Hinweiszeile durch die echten Zeilen
# ersetzen. Ohne AVV_SUB_* bleibt die Vorlagentabelle stehen.
subs = []
for i in range(1, 10):
    zeile = os.environ.get(f"AVV_SUB_{i}", "").strip()
    if zeile:
        spalten = [s.strip() for s in zeile.split("|")]
        if len(spalten) != 3:
            sys.exit(f"AVV_SUB_{i} braucht 'Name | Leistung | Ort', hat {len(spalten)} Felder")
        subs.append(spalten)
if subs:
    tabelle = ["| Unterauftragnehmer | Leistung | Ort der Verarbeitung |", "| --- | --- | --- |"]
    tabelle += ["| " + " | ".join(s) + " |" for s in subs]
    neu = re.subn(
        r"\*Beispielhaftes gehostetes Setup[^\n]*\n\n\| Unterauftragnehmer \|.*?\n\n",
        "\n".join(tabelle) + "\n\n", avv, flags=re.S)
    if neu[1] != 1:
        sys.exit("Unterauftragnehmer-Tabelle in docs/AVV-Vorlage.md nicht gefunden")
    avv = neu[0]
else:
    fehlend.append("AVV_SUB_1 … (Beispieltabelle bleibt stehen)")

avv = avv.replace("# Auftragsverarbeitungsvertrag (AVV) — Vorlage",
                  "# Auftragsverarbeitungsvertrag (AVV)")
# Im gedruckten Vertrag ist die Anlage eine Anlage, keine Datei im Repo.
avv = avv.replace("**Anlage 1 (TOM.md)**", "**Anlage 1**")
avv = avv.replace("siehe `TOM.md`", "beigefügt")
tom = tom.replace("# Anlage 1 — Technische und organisatorische Maßnahmen",
                  "# Anlage 1: Technische und organisatorische Maßnahmen")

if fehlend:
    sys.stderr.write("WARN: Platzhalter bleiben stehen, weil Werte fehlen:\n  "
                     + "\n  ".join(dict.fromkeys(fehlend)) + "\n")

pathlib.Path(outmd).write_text(avv.rstrip() + "\n\n\\newpage\n\n" + tom)
PY

pandoc "$TMP/combined.md" --pdf-engine=xelatex \
  -V geometry:margin=2.5cm -V fontsize=11pt -V lang=de -V colorlinks=true \
  -o "$OUT"
echo "PDF erstellt: $OUT"
