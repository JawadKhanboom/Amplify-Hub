const RESEND_API_URL = 'https://api.resend.com/emails'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ContactNotificationConfig {
  apiKey: string
  from: string
  to: string[]
}

export interface ContactNotificationMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
}

export interface ContactNotificationResult {
  ok: boolean
  status: number
}

type EnvironmentReader = (name: string) => string | undefined
type Fetcher = typeof fetch

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeSubject(value: string) {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function getContactNotificationConfig(
  readEnvironment: EnvironmentReader,
): ContactNotificationConfig | null {
  const apiKey = readEnvironment('RESEND_API_KEY')?.trim()
  const from = readEnvironment('CONTACT_NOTIFICATION_FROM')?.trim()
  const recipients = readEnvironment('CONTACT_NOTIFICATION_TO')
    ?.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  if (!apiKey || !from || !recipients?.length) {
    return null
  }
  if (!apiKey.startsWith('re_') || recipients.some((email) => !EMAIL_PATTERN.test(email))) {
    return null
  }

  return { apiKey, from, to: recipients }
}

export function buildContactNotification(
  contact: ContactNotificationMessage,
) {
  const submittedSubject = normalizeSubject(contact.subject) || 'General enquiry'
  const notificationSubject =
    `New AmplifyHub contact: ${submittedSubject}`.slice(0, 240)
  const text = [
    'A new message was submitted through AmplifyHub.',
    '',
    `Name: ${contact.name}`,
    `Email: ${contact.email}`,
    `Subject: ${submittedSubject}`,
    '',
    contact.message,
    '',
    `Message ID: ${contact.id}`,
  ].join('\n')
  const html = `
    <h1>New AmplifyHub contact message</h1>
    <p><strong>Name:</strong> ${escapeHtml(contact.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(contact.email)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(submittedSubject)}</p>
    <hr>
    <p style="white-space:pre-wrap">${escapeHtml(contact.message)}</p>
    <hr>
    <p><small>Message ID: ${escapeHtml(contact.id)}</small></p>
  `.trim()

  return {
    subject: notificationSubject,
    text,
    html,
  }
}

export async function sendContactNotification(
  config: ContactNotificationConfig,
  contact: ContactNotificationMessage,
  fetcher: Fetcher = fetch,
): Promise<ContactNotificationResult> {
  const notification = buildContactNotification(contact)
  const response = await fetcher(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `contact-notification/${contact.id}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: config.to,
      reply_to: contact.email,
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
    }),
    signal: AbortSignal.timeout(5_000),
  })

  return {
    ok: response.ok,
    status: response.status,
  }
}
