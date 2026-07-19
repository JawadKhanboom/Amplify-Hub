export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8742',
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

export function buildCorsHeaders(origin: string | null, allowedOrigins: Set<string>) {
  const normalizedOrigin = origin ? normalizeOrigin(origin) : ''
  return {
    ...(allowedOrigins.has(normalizedOrigin)
      ? { 'Access-Control-Allow-Origin': normalizedOrigin }
      : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
