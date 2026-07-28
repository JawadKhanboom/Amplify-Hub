export const MAX_BODY_BYTES = 16 * 1024
export const MAX_TURNSTILE_TOKEN_LENGTH = 2048

export class ContactRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ContactRequestError'
    this.status = status
    this.code = code
  }
}

export interface ContactPayload {
  isBot: boolean
  name: string
  email: string
  subject: string
  message: string
  turnstileToken: string
}

function invalid(message: string): never {
  throw new ContactRequestError(400, 'INVALID_CONTACT_REQUEST', message)
}

function getString(
  body: Record<string, unknown>,
  key: string,
  maximum: number,
) {
  const value = body[key]
  if (typeof value !== 'string' || value.length > maximum) {
    invalid('Contact form fields are invalid.')
  }
  return value.trim()
}

export function validateContactRequest(body: unknown): ContactPayload {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalid('Contact form fields are invalid.')
  }

  const values = body as Record<string, unknown>
  const website = getString(values, 'website', 200)
  if (website) {
    return {
      isBot: true,
      name: '',
      email: '',
      subject: '',
      message: '',
      turnstileToken: '',
    }
  }

  const name = getString(values, 'name', 120)
  const email = getString(values, 'email', 254).toLowerCase()
  const subject = getString(values, 'subject', 200)
  const message = getString(values, 'message', 4000)
  const turnstileToken = getString(
    values,
    'turnstileToken',
    MAX_TURNSTILE_TOKEN_LENGTH,
  )

  if (!name || message.length < 10) {
    invalid('Contact form fields are invalid.')
  }
  if (
    email.length < 3
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    invalid('Contact form fields are invalid.')
  }
  if (!turnstileToken) {
    throw new ContactRequestError(
      400,
      'TURNSTILE_REQUIRED',
      'Security verification is required.',
    )
  }

  return {
    isBot: false,
    name,
    email,
    subject,
    message,
    turnstileToken,
  }
}
