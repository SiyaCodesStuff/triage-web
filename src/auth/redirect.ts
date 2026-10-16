export function safeDestination(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return '/tickets';
  const path = value.split(/[?#]/)[0];
  if (path === '/login' || path === '/register') return '/tickets';
  return value;
}

export function redirectToLogin() {
  const destination = safeDestination(
    window.location.pathname + window.location.search + window.location.hash,
  );
  if (window.location.pathname !== '/login')
    window.location.assign(
      `/login?returnTo=${encodeURIComponent(destination)}`,
    );
}
