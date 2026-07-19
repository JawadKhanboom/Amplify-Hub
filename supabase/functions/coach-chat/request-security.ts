export const MAX_BODY_BYTES = 64 * 1024

const CHAT_MAX_MESSAGES = 20
const CHAT_MAX_TOTAL_CHARS = 20_000
const FEEDBACK_MAX_MESSAGES = 80
const FEEDBACK_MAX_TOTAL_CHARS = 50_000
const MAX_MESSAGE_CHARS = 2_000
const MIN_FEEDBACK_USER_TURNS = 4
const ALLOWED_MODES = new Set(['roleplay', 'live', 'objections', 'script', 'voice', 'review', 'ask'])
const ALLOWED_STYLES = new Set(['friendly', 'professional', 'tough-coach'])
const ALLOWED_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'adaptive'])
const ALLOWED_FEEDBACK_DETAILS = new Set(['brief', 'detailed', 'comprehensive'])

export class HttpError extends Error {
  status: number
  code: string
  retryAfter?: number

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

type Catalog = { personas: Iterable<string>; scenarios: Iterable<string> }

function validatePrefs(value: unknown, catalog: Catalog) {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_PREFS', 'Preferences must be an object.')
  }

  const prefs = value as Record<string, unknown>
  const personas = new Set(catalog.personas)
  const scenarios = new Set(catalog.scenarios)
  if (prefs.difficulty !== undefined && !ALLOWED_DIFFICULTIES.has(String(prefs.difficulty))) {
    throw new HttpError(400, 'INVALID_PREFS', 'Invalid difficulty.')
  }
  if (prefs.style !== undefined && !ALLOWED_STYLES.has(String(prefs.style))) {
    throw new HttpError(400, 'INVALID_PREFS', 'Invalid coaching style.')
  }
  if (prefs.feedbackDetail !== undefined && !ALLOWED_FEEDBACK_DETAILS.has(String(prefs.feedbackDetail))) {
    throw new HttpError(400, 'INVALID_PREFS', 'Invalid feedback detail.')
  }
  if (prefs.persona !== undefined && !personas.has(String(prefs.persona))) {
    throw new HttpError(400, 'INVALID_PREFS', 'Invalid persona.')
  }
  if (prefs.scenario !== undefined && !scenarios.has(String(prefs.scenario))) {
    throw new HttpError(400, 'INVALID_PREFS', 'Invalid scenario.')
  }
  for (const key of ['language', 'goal']) {
    const item = prefs[key]
    const max = key === 'goal' ? 500 : 40
    if (item !== undefined && (typeof item !== 'string' || item.length > max)) {
      throw new HttpError(400, 'INVALID_PREFS', `Invalid ${key}.`)
    }
  }
  return prefs
}

function validateMessages(value: unknown, action: 'chat' | 'feedback') {
  if (!Array.isArray(value)) throw new HttpError(400, 'INVALID_MESSAGES', 'Messages must be an array.')
  const maxMessages = action === 'feedback' ? FEEDBACK_MAX_MESSAGES : CHAT_MAX_MESSAGES
  const maxTotal = action === 'feedback' ? FEEDBACK_MAX_TOTAL_CHARS : CHAT_MAX_TOTAL_CHARS
  if (value.length < 1 || value.length > maxMessages) {
    throw new HttpError(400, 'INVALID_MESSAGES', `Message count must be between 1 and ${maxMessages}.`)
  }

  let totalChars = 0
  let userTurns = 0
  const messages = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'INVALID_MESSAGES', 'Each message must be an object.')
    }
    const message = item as Record<string, unknown>
    if (message.role !== 'user' && message.role !== 'coach') {
      throw new HttpError(400, 'INVALID_MESSAGES', 'Message role must be user or coach.')
    }
    if (typeof message.content !== 'string' || !message.content.trim() || message.content.length > MAX_MESSAGE_CHARS) {
      throw new HttpError(400, 'INVALID_MESSAGES', `Each message must contain 1-${MAX_MESSAGE_CHARS} characters.`)
    }
    totalChars += message.content.length
    if (message.role === 'user') userTurns += 1
    return { role: message.role, content: message.content }
  })

  if (totalChars > maxTotal) throw new HttpError(400, 'INVALID_MESSAGES', 'Conversation is too long.')
  if (action === 'feedback' && userTurns < MIN_FEEDBACK_USER_TURNS) {
    throw new HttpError(400, 'INSUFFICIENT_FEEDBACK_TURNS', `Feedback requires ${MIN_FEEDBACK_USER_TURNS} user turns.`)
  }
  return messages
}

export function validateRequest(value: unknown, catalog: Catalog) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.')
  }
  const body = value as Record<string, unknown>
  const action: 'chat' | 'feedback' = body.action === 'feedback' ? 'feedback' : 'chat'
  if (body.action !== undefined && body.action !== 'feedback') {
    throw new HttpError(400, 'INVALID_ACTION', 'Invalid action.')
  }
  if (action === 'chat' && (typeof body.mode !== 'string' || !ALLOWED_MODES.has(body.mode))) {
    throw new HttpError(400, 'INVALID_MODE', 'Invalid coach mode.')
  }
  return {
    action,
    mode: action === 'chat' ? body.mode as string : undefined,
    prefs: validatePrefs(body.prefs, catalog),
    messages: validateMessages(body.messages, action),
  }
}
