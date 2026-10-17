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
  let path = value.split(/[?#]/)[0] ?? '';
  // Validate decoded path separators too, including nested encoding. Preserve
  // the original query/hash: their encoded values cannot change the origin.
  while (/%[0-9a-f]{2}/i.test(path)) {
    try {
      path = decodeURIComponent(path);
    } catch {
      return '/tickets';
    }
  }
  if (
    path.startsWith('//') ||
    path.includes('\\') ||
    [...path].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return '/tickets';
  const normalized = new URL(path, 'https://triage.invalid').pathname
    .replace(/\/+$/, '')
    .toLowerCase();
  if (
    normalized.startsWith('//') ||
    normalized === '/login' ||
    normalized === '/register'
  )
    return '/tickets';
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
