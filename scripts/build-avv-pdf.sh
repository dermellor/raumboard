#!/bin/bash
# Baut aus docs/AVV-Vorlage.md + docs/TOM.md ein unterschriftsreifes PDF
# (AVV, TOM als Anlage). Entfernt die einleitenden Hinweis-Blöcke (Blockquotes)
# und setzt die Anschrift des Auftragnehmers ein.
#
# Anschrift-Quelle (Reihenfolge): $AVV_ANSCHRIFT  →  docs/.avv-anschrift.txt
# Beides liegt bewusst NICHT im Repo (Privatadresse). Ohne Anschrift bleibt der
# Platzhalter stehen und es gibt eine Warnung.
#
# Usage: scripts/build-avv-pdf.sh [ausgabe.pdf]   (Default: ~/Downloads/Raumboard-AVV.pdf)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HOME/Downloads/Raumboard-AVV.pdf}"

command -v pandoc >/dev/null || { echo "pandoc fehlt (brew install pandoc)"; exit 1; }
command -v xelatex >/dev/null || { echo "xelatex fehlt (z. B. brew install --cask mactex-no-gui)"; exit 1; }

ADDR="${AVV_ANSCHRIFT:-}"
if [ -z "$ADDR" ] && [ -f "$ROOT/docs/.avv-anschrift.txt" ]; then
  ADDR="$(tr -d '\n' < "$ROOT/docs/.avv-anschrift.txt")"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

python3 - "$ROOT" "$ADDR" "$TMP/combined.md" <<'PY'
import sys, pathlib
root, addr, outmd = sys.argv[1], sys.argv[2], sys.argv[3]
avv = pathlib.Path(root, "docs/AVV-Vorlage.md").read_text()
tom = pathlib.Path(root, "docs/TOM.md").read_text()

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

avv = strip_leading_notes(avv)
tom = strip_leading_notes(tom)

if addr:
    avv = avv.replace("«ANSCHRIFT_AUFTRAGNEHMER»", addr)
else:
    sys.stderr.write("WARN: keine Anschrift (AVV_ANSCHRIFT / docs/.avv-anschrift.txt) — Platzhalter bleibt.\n")

avv = avv.replace("# Auftragsverarbeitungsvertrag (AVV) — Vorlage",
                  "# Auftragsverarbeitungsvertrag (AVV)")

pathlib.Path(outmd).write_text(avv.rstrip() + "\n\n\\newpage\n\n" + tom)
PY

pandoc "$TMP/combined.md" --pdf-engine=xelatex \
  -V geometry:margin=2.5cm -V fontsize=11pt -V lang=de -V colorlinks=true \
  -o "$OUT"
echo "PDF erstellt: $OUT"
