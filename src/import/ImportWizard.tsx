import { FileUp, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Modal } from '../components'
import { importKids } from '../store'
import { useBoard } from '../useBoard'
import { detectHeaderRow, FIELD_LABELS, guessMapping, parseFile, prepareKids, sliceTable } from './parse'
import type { FieldKey, Mapping } from './parse'

const FIELDS: FieldKey[] = ['firstName', 'lastName', 'fullName', 'klass', 'symbol']
const PREVIEW_LIMIT = 60

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const state = useBoard()
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [matrix, setMatrix] = useState<string[][] | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<Mapping>({})
  const table = useMemo(() => (matrix ? sliceTable(matrix, headerRow) : null), [matrix, headerRow])
  const [targetKlass, setTargetKlass] = useState('')
  const [newKlass, setNewKlass] = useState('')
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ added: number; klassesCreated: string[] } | null>(null)

  const usedSymbols = useMemo(() => new Set(state.kids.map((k) => k.symbol)), [state.kids])
  const prepared = useMemo(
    () => (table ? prepareKids(table, mapping, usedSymbols) : []),
    [table, mapping, usedSymbols],
  )
  const validCount = prepared.filter((p) => p.issues.length === 0).length
  const hasKlassColumn = mapping.klass !== undefined
  const effectiveTarget = newKlass.trim() || targetKlass || null

  async function onFile(file: File) {
    setError(null)
    setDone(null)
    try {
      const m = await parseFile(file)
      if (m.length === 0) return setError('Die Datei enthält keine lesbaren Zeilen.')
      const hr = detectHeaderRow(m)
      setFileName(file.name)
      setMatrix(m)
      setHeaderRow(hr)
      setMapping(guessMapping(sliceTable(m, hr).headers))
    } catch {
      setError('Datei konnte nicht gelesen werden. Ist es eine Excel- oder CSV-Datei?')
    }
  }

  function changeHeaderRow(n: number) {
    setHeaderRow(n)
    if (matrix) setMapping(guessMapping(sliceTable(matrix, n).headers))
  }

  function setField(field: FieldKey, col: number | undefined) {
    setMapping((m) => {
      const next = { ...m }
      if (col === undefined) delete next[field]
      else next[field] = col
      return next
    })
  }

  async function runImport() {
    setBusy(true)
    setError(null)
    const entries = prepared
      .filter((p) => p.issues.length === 0)
      .map((p) => ({ name: p.name, symbol: p.symbol, klass: p.klassName }))
    const result = await importKids(entries, hasKlassColumn ? null : effectiveTarget, mode)
    setBusy(false)
    if (result.ok) setDone({ added: result.added, klassesCreated: result.klassesCreated })
    else setError(result.reason)
  }

  const canImport =
    validCount > 0 && (hasKlassColumn || !!effectiveTarget) && !busy

  return (
    <Modal title="Kinder importieren" onClose={onClose} wide={!!table && !done}>
      {done ? (
        <div>
          <p>
            <strong>{done.added}</strong> Kinder importiert
            {done.klassesCreated.length > 0 && (
              <> · neue Klassen: {done.klassesCreated.join(', ')}</>
            )}
            .
          </p>
          <button className="pin-submit" onClick={onClose}>
            Fertig
          </button>
        </div>
      ) : !table ? (
        <div>
          <p>Laden Sie eine Excel- (.xlsx) oder CSV-Datei mit den Namen der Kinder hoch.</p>
          <div
            className="dropzone"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) void onFile(f)
            }}
          >
            <Upload />
            <span>Datei hierher ziehen oder klicken zum Auswählen</span>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
            }}
          />
          <p className="count">
            Der volle Nachname bleibt auf Ihrem Gerät: nur Vorname und der erste Buchstabe des
            Nachnamens werden gespeichert.
          </p>
          {error && <p className="form-error">{error}</p>}
        </div>
      ) : (
        <div className="import-config">
          <p className="count">
            <FileUp /> {fileName} · {table.rows.length} Datenzeilen
          </p>

          {matrix && matrix.length > 1 && (
            <div className="field">
              <label htmlFor="imp-header">Kopfzeile</label>
              <select
                id="imp-header"
                value={headerRow}
                onChange={(e) => changeHeaderRow(Number(e.target.value))}
              >
                {matrix.slice(0, 12).map((row, i) => (
                  <option key={i} value={i}>
                    Zeile {i + 1}: {row.filter(Boolean).join(' | ').slice(0, 50) || '(leer)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <h3>Spalten zuordnen</h3>
          <table className="map-table">
            <tbody>
              {FIELDS.map((field) => (
                <tr key={field}>
                  <td>{FIELD_LABELS[field]}</td>
                  <td>
                    <select
                      value={mapping[field] ?? ''}
                      onChange={(e) =>
                        setField(field, e.target.value === '' ? undefined : Number(e.target.value))
                      }
                    >
                      <option value="">— nicht vorhanden —</option>
                      {table.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Spalte ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!hasKlassColumn && (
            <div className="field">
              <label htmlFor="imp-klass">Ziel-Klasse</label>
              <select
                id="imp-klass"
                value={targetKlass}
                onChange={(e) => {
                  setTargetKlass(e.target.value)
                  setNewKlass('')
                }}
              >
                <option value="">— wählen —</option>
                {state.klasses.map((c) => (
                  <option key={c.id} value={c.name}>
                    Klasse {c.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="oder neue Klasse"
                value={newKlass}
                onChange={(e) => {
                  setNewKlass(e.target.value)
                  if (e.target.value) setTargetKlass('')
                }}
              />
            </div>
          )}

          <div className="field">
            <label>Modus</label>
            <label className="radio">
              <input
                type="radio"
                checked={mode === 'append'}
                onChange={() => setMode('append')}
              />{' '}
              hinzufügen
            </label>
            <label className="radio">
              <input
                type="radio"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />{' '}
              Klasse(n) vorher leeren
            </label>
          </div>

          <h3>Vorschau ({validCount} Kinder)</h3>
          <div className="preview-scroll">
            <table className="preview-table">
              <tbody>
                {prepared.slice(0, PREVIEW_LIMIT).map((p) => (
                  <tr key={p.rowIndex} className={p.issues.length ? 'bad' : undefined}>
                    <td className="pv-emoji">{p.symbol}</td>
                    <td>{p.name || <em>{p.issues.join(', ')}</em>}</td>
                    <td className="pv-klass">{p.klassName ?? effectiveTarget ?? '?'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {prepared.length > PREVIEW_LIMIT && (
              <p className="count">und {prepared.length - PREVIEW_LIMIT} weitere …</p>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}
          <div className="import-actions">
            <button onClick={() => setMatrix(null)}>zurück</button>
            <button className="pin-submit" disabled={!canImport} onClick={() => void runImport()}>
              {validCount} Kinder importieren
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
