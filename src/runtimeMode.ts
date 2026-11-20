export function shouldUseApiStore(
  serverInjected: boolean,
  buildFlag: string | undefined,
  pathname: string,
): boolean {
  return serverInjected || buildFlag === 'true' || pathname.startsWith('/previews/')
}
