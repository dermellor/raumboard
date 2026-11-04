/** Splits after slashes while preserving every character of the stored name. */
export function slashSegments(name: string): string[] {
  return name.match(/[^/]*\/?/g)?.filter(Boolean) ?? []
}
