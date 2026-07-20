import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_BODY_BYTES = 2048

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8742',
  'https://amplify-hub-six.vercel.app',
]

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '')
}

function parseAllowedOrigins(value?: string | null) {
  const origins = value
    ? value.split(',').map(normalizeOrigin).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS
  return new Set(origins)
}

function buildCorsHeaders(origin: string | null, allowedOrigins: Set<string>) {
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

function jsonResponse(body: Record<string, unknown>, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'))
  const cors = buildCorsHeaders(origin, allowedOrigins)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, cors)
  }

  // Enforce body size limit
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Request too large.' }, 413, cors)
  }

  // Authenticate: extract user from JWT (never accept user ID from the browser)
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required.' }, 401, cors)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Create a client with the user's token to verify identity
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return jsonResponse({ error: 'Invalid or expired session.' }, 401, cors)
  }

  // Parse and validate body
  let body: Record<string, unknown>
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Request too large.' }, 413, cors)
    }
    body = JSON.parse(text)
  } catch {
    return jsonResponse({ error: 'Invalid JSON.' }, 400, cors)
  }

  if (!body || typeof body !== 'object' || body.confirmation !== 'DELETE') {
    return jsonResponse({ error: 'Send {"confirmation":"DELETE"} to proceed.' }, 400, cors)
  }

  // Delete the user via Admin API (cascades handle all user data)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteError) {
    return jsonResponse({ error: 'Account deletion failed. Please try again or contact support.' }, 502, cors)
  }

  return jsonResponse({ ok: true }, 200, cors)
})
