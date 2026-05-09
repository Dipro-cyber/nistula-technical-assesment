/**
 * confidence.js
 * Calculates a confidence score (0.0 to 1.0) for an AI-drafted reply
 * and determines the appropriate action to take.
 *
 * SCORING LOGIC:
 * Start at 1.0
 * -0.15 if query_type is 'complaint'         (high-stakes, needs human review)
 * -0.10 if message contains uncertain words  (ambiguous intent reduces confidence)
 * -0.10 if booking_ref is missing or null    (unverified guest, less context)
 * -0.05 if source is 'instagram' or 'airbnb' (informal channels, less structured)
 * Floor at 0.0, rounded to 2 decimal places
 *
 * ACTION THRESHOLDS:
 * > 0.85  → auto_send    (high confidence, safe to send without review)
 * 0.60–0.85 → agent_review (moderate confidence, human should check)
 * < 0.60  → escalate     (low confidence or complaint, needs human handling)
 * complaint → always escalate regardless of score
 */

// Words that signal the guest is uncertain — reduces confidence
const UNCERTAIN_WORDS = ['maybe', 'not sure', 'unclear', 'perhaps', 'i think'];

/**
 * Calculates the confidence score for a drafted reply.
 *
 * @param {object} normalizedMessage - The unified message schema object
 * @param {string} normalizedMessage.query_type
 * @param {string} normalizedMessage.message_text
 * @param {string|null} normalizedMessage.booking_ref
 * @param {string} normalizedMessage.source
 * @returns {number} - Score between 0.0 and 1.0
 */
function calculateConfidence(normalizedMessage) {
  const { query_type, message_text, booking_ref, source } = normalizedMessage;

  let score = 1.0;

  // Complaints are high-stakes — always reduce confidence significantly
  if (query_type === 'complaint') {
    score -= 0.15;
  }

  // Uncertain language in the message means the intent is ambiguous
  const lowerText = (message_text || '').toLowerCase();
  const hasUncertainty = UNCERTAIN_WORDS.some((word) => lowerText.includes(word));
  if (hasUncertainty) {
    score -= 0.10;
  }

  // Missing booking ref means we can't verify the guest
  if (!booking_ref) {
    score -= 0.10;
  }

  // Informal channels tend to have less structured messages
  if (source === 'instagram' || source === 'airbnb') {
    score -= 0.05;
  }

  // Clamp to [0.0, 1.0] and round to 2 decimal places
  return Math.round(Math.max(0.0, Math.min(1.0, score)) * 100) / 100;
}

/**
 * Determines the action to take based on confidence score and query type.
 * Complaints always escalate regardless of score.
 *
 * @param {number} score - Confidence score (0.0 to 1.0)
 * @param {string} query_type
 * @returns {string} - 'auto_send' | 'agent_review' | 'escalate'
 */
function determineAction(score, query_type) {
  if (query_type === 'complaint' || score < 0.60) {
    return 'escalate';
  }
  if (score <= 0.85) {
    return 'agent_review';
  }
  return 'auto_send';
}

module.exports = { calculateConfidence, determineAction };
