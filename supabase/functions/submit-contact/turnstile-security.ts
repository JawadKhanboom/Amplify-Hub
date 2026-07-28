const DEFAULT_ALLOWED_HOSTNAMES = ['amplify-hub-six.vercel.app']
const EXPECTED_ACTION = 'contact'

export function parseAllowedHostnames(value?: string | null) {
  return new Set(
    (value ? value.split(',') : DEFAULT_ALLOWED_HOSTNAMES)
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function validateTurnstileResult(
  result: unknown,
  allowedHostnames: Set<string>,
) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return false
  }

  const value = result as Record<string, unknown>
  return value.success === true
    && value.action === EXPECTED_ACTION
    && typeof value.hostname === 'string'
    && allowedHostnames.has(value.hostname.toLowerCase())
}
