export function isOperatorPath(pathname: string, baseUrl: string): boolean {
  const basePath = baseUrl.replace(/\/$/, '')
  return pathname === `${basePath}/operator`
}
