const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8742',
  'http://127.0.0.1:4173',
  'https://amplify-hub-six.vercel.app',
]

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '')
}

export function parseAllowedOrigins(value?: string | null) {
  const origins = value
    ? value.split(',').map(normalizeOrigin).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS
  return new Set(origins)
}

export function getAllowedOrigin(
  origin: string | null,
  allowedOrigins: Set<string>,
) {
  const normalizedOrigin = origin ? normalizeOrigin(origin) : ''
  return allowedOrigins.has(normalizedOrigin) ? normalizedOrigin : null
}

export function buildCorsHeaders(
  origin: string | null,
  allowedOrigins: Set<string>,
) {
  const allowedOrigin = getAllowedOrigin(origin, allowedOrigins)
  return {
    ...(allowedOrigin
      ? { 'Access-Control-Allow-Origin': allowedOrigin }
      : {}),
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
