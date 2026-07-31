export type CoachMessage = {
  role: string
  content: string
}

export const OUT_OF_SCOPE_REPLY =
  "I'm AmplifyHub's cold-calling coach, so I can only help with cold calling, handling objections, sales conversations, sales mindset, and SDR career development."

export const COACH_SCOPE_POLICY = [
  'Stay within AmplifyHub coaching topics: cold calling, prospecting, objections,',
  'openers, sales conversations, appointment setting, follow-up, sales mindset,',
  'and SDR career development.',
  'If a request is unrelated, do not answer it, even partially.',
  `Reply with exactly: "${OUT_OF_SCOPE_REPLY}"`,
  'If a request mixes related and unrelated topics, answer only the related part',
  'and briefly state that you cannot help with the unrelated part.',
].join(' ')

const COACH_TOPIC_PATTERN =
  /\b(?:cold[-\s]?call(?:ing|s)?|sales|sell(?:ing)?|sdr|bdr|account executive|prospect(?:ing|s)?|lead(?:s|ing)?|objection(?:s)?|opener|opening|pitch|discovery|gatekeeper|script|voicemail|book(?:ing)?|appointment(?:s)?|meeting(?:s)?|outreach|follow[-\s]?up|qualif(?:y|ying|ication)|clos(?:e|ing)|conversion|pipeline|crm|quota|roleplay|phone call|sales call|tone|pacing|confidence|rejection|mindset|motivation|nervous|anxiety|fear|career|interview|resume|cv|linkedin|sales email)\b/i

const SIMPLE_GREETING_PATTERN =
  /^(?:hi|hello|hey|thanks|thank you|good (?:morning|afternoon|evening))[.!?\s]*$/i

const CONTEXTUAL_FOLLOW_UP_PATTERN =
  /^(?:(?:what|how|why) (?:about )?(?:that|this|it)|(?:can|could|would) you (?:explain|clarify|expand on) (?:that|this|it)|what should i (?:say|do)(?: next| instead)?|how should i (?:respond|reply|handle that)|tell me more|give me (?:another|an) example|(?:another|one more) example|what do you mean)[.!?\s]*$/i

/**
 * Applies a deterministic first-line scope check to Ask Coach conversations.
 * Other modes accept short roleplay utterances that cannot be classified by
 * keywords, so their boundary is enforced by COACH_SCOPE_POLICY instead.
 */
export function isConversationInCoachScope(
  mode: string | undefined,
  messages: CoachMessage[],
): boolean {
  if (mode !== 'ask') return true

  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter(Boolean)

  if (userMessages.length === 0) return false

  const latestMessage = userMessages[userMessages.length - 1]
  if (SIMPLE_GREETING_PATTERN.test(latestMessage)) return true

  if (COACH_TOPIC_PATTERN.test(latestMessage)) return true

  // Permit only genuinely context-dependent follow-ups after an in-scope turn.
  // A later unrelated request must still be refused even when earlier messages
  // discussed cold calling.
  const priorConversation = userMessages.slice(0, -1).join(' ')
  return COACH_TOPIC_PATTERN.test(priorConversation) &&
    CONTEXTUAL_FOLLOW_UP_PATTERN.test(latestMessage)
}
