import { createClient } from '@supabase/supabase-js'
import {
  ContactRequestError,
  MAX_BODY_BYTES,
  validateContactRequest,
} from './request-security.ts'
import {
  buildCorsHeaders,
  getAllowedOrigin,
  parseAllowedOrigins,
} from './cors-security.ts'
import {
  parseAllowedHostnames,
  validateTurnstileResult,
} from './turnstile-security.ts'

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'))
const allowedHostnames = parseAllowedHostnames(
  Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES'),
)

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = buildCorsHeaders(origin, allowedOrigins)
  const respond = (
    body: Record<string, unknown>,
    status = 200,
    extraHeaders: Record<string, string> = {},
  ) => jsonResponse(body, status, { ...corsHeaders, ...extraHeaders })

  if (!getAllowedOrigin(origin, allowedOrigins)) {
    return respond(
      { error: 'Origin is not allowed.', code: 'ORIGIN_NOT_ALLOWED' },
      403,
    )
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respond(
      { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
      405,
      { Allow: 'POST, OPTIONS' },
    )
  }

  const declaredLength = Number(req.headers.get('Content-Length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return respond(
      { error: 'Request body is too large.', code: 'PAYLOAD_TOO_LARGE' },
      413,
    )
  }

  try {
    const rawBody = await req.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      throw new ContactRequestError(
        413,
        'PAYLOAD_TOO_LARGE',
        'Request body is too large.',
      )
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      throw new ContactRequestError(
        400,
        'INVALID_JSON',
        'Request body must be valid JSON.',
      )
    }

    const contact = validateContactRequest(parsedBody)

    // Keep the existing honeypot behavior: bots receive a plausible success
    // response, while no Turnstile request or database insert is performed.
    if (contact.isBot) {
      return respond({ ok: true }, 201)
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
    if (!turnstileSecret) {
      console.error('submit-contact: TURNSTILE_SECRET_KEY is not configured')
      return respond(
        {
          error: 'Contact form is temporarily unavailable.',
          code: 'CONTACT_UNAVAILABLE',
        },
        503,
      )
    }

    const verifyBody = new URLSearchParams({
      secret: turnstileSecret,
      response: contact.turnstileToken,
    })
    const turnstileResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody,
      signal: AbortSignal.timeout(8_000),
    })
    const turnstileResult: unknown = await turnstileResponse.json()

    if (
      !turnstileResponse.ok
      || !validateTurnstileResult(turnstileResult, allowedHostnames)
    ) {
      console.warn('submit-contact: Turnstile verification rejected')
      return respond(
        {
          error: 'Security verification failed. Please try again.',
          code: 'TURNSTILE_REJECTED',
        },
        400,
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('submit-contact: Supabase server credentials are unavailable')
      return respond(
        {
          error: 'Contact form is temporarily unavailable.',
          code: 'CONTACT_UNAVAILABLE',
        },
        503,
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const contactRow = {
      name: contact.name,
      email: contact.email,
      subject: contact.subject,
      message: contact.message,
    }
    let { error: insertError } = await adminClient
      .from('contact_messages')
      .insert(contactRow)

    // Zero-downtime rollout bridge: before the lockdown migration is applied,
    // production still grants INSERT only to anon/authenticated and explicitly
    // denies service_role. Once the migration runs, the primary insert above
    // succeeds and this least-privilege fallback becomes unreachable.
    if (insertError?.code === '42501') {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (anonKey) {
        const transitionalClient = createClient(supabaseUrl, anonKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
        const fallbackResult = await transitionalClient
          .from('contact_messages')
          .insert(contactRow)
        insertError = fallbackResult.error
      }
    }

    if (insertError) {
      if (insertError.code === '23514') {
        return respond(
          {
            error: 'Too many messages were sent recently. Please wait before trying again.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': '3600' },
        )
      }

      console.error(
        'submit-contact: database insert failed',
        insertError.code ?? 'unknown',
      )
      return respond(
        {
          error: 'Contact form is temporarily unavailable.',
          code: 'CONTACT_UNAVAILABLE',
        },
        503,
      )
    }

    return respond({ ok: true }, 201)
  } catch (error: unknown) {
    if (error instanceof ContactRequestError) {
      return respond({ error: error.message, code: error.code }, error.status)
    }

    console.error(
      'submit-contact: unexpected failure',
      error instanceof Error ? error.name : 'unknown',
    )
    return respond(
      {
        error: 'Contact form is temporarily unavailable.',
        code: 'CONTACT_UNAVAILABLE',
      },
      503,
    )
  }
})
