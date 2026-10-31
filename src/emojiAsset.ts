/** Resolves bundled emoji below Vite's configured base path. */
export function emojiAssetUrl(baseUrl: string, hex: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${base}emoji/${hex}.svg`
}
