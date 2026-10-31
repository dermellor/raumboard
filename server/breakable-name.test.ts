import assert from 'node:assert/strict'
import test from 'node:test'
import { slashSegments } from '../src/breakableName'
import { emojiAssetUrl } from '../src/emojiAsset'

function renderedText(name: string): string {
  return slashSegments(name).join('')
}

test('a slash creates a segment boundary directly after the visible slash', () => {
  const name = 'Snozzle/Leselandschaft'

  assert.deepEqual(slashSegments(name), ['Snozzle/', 'Leselandschaft'])
  assert.equal(renderedText(name), name)
})

test('every slash creates a segment without changing the underlying name', () => {
  const name = 'Nord/Ost/Atelier'

  assert.deepEqual(slashSegments(name), ['Nord/', 'Ost/', 'Atelier'])
  assert.equal(renderedText(name), name)
})


test('short, empty and slash-free names render exactly as before', () => {
  for (const name of ['', 'Garten', 'Bibliothek']) {
    assert.deepEqual(slashSegments(name), name ? [name] : [])
    assert.equal(renderedText(name), name)
  }
})

test('leading, trailing and adjacent slashes preserve every character', () => {
  for (const name of ['/Nord', 'Nord/', 'Nord//Ost']) {
    assert.equal(renderedText(name), name)
    assert.equal(slashSegments(name).filter((segment) => segment.endsWith('/')).length, (name.match(/\//g) ?? []).length)
  }
})

test('emoji assets stay below Vite base paths', () => {
  assert.equal(emojiAssetUrl('/', '1F6CB'), '/emoji/1F6CB.svg')
  assert.equal(
    emojiAssetUrl('/previews/raumboard-4/', '1F6CB'),
    '/previews/raumboard-4/emoji/1F6CB.svg',
  )
  assert.equal(
    emojiAssetUrl('/previews/raumboard-4', '1F4DA'),
    '/previews/raumboard-4/emoji/1F4DA.svg',
  )
})
