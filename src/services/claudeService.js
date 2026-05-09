/**
 * claudeService.js
 * Sends a normalized guest message + property context to the Claude API
 * and returns a drafted reply string.
 */

const axios = require('axios');

// Claude model as specified in the brief
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Mock property context injected into every prompt
const PROPERTY_CONTEXT = `
Property: Villa B1, Assagao, North Goa
Bedrooms: 3 | Max guests: 6 | Private pool: Yes
Check-in: 2pm | Check-out: 11am
Base rate: INR 18,000 per night (up to 4 guests)
Extra guest: INR 2,000 per night per person
WiFi password: Nistula@2024
Caretaker: Available 8am to 10pm
Chef on call: Yes, pre-booking required
Availability April 20-24: Available
Cancellation: Free up to 7 days before check-in
`.trim();

/**
 * Builds the system prompt that sets Claude's role and tone.
 */
function buildSystemPrompt() {
  return `You are a warm, professional guest relations assistant for Nistula, a luxury villa hospitality company in Goa, India.
Your job is to draft replies to guest messages on behalf of the Nistula team.
Always be helpful, polite, and concise. Use the guest's first name. Keep replies under 120 words.
Only use information from the property context provided — do not invent details.
If you cannot answer from the context, say the team will follow up shortly.`;
}

/**
 * Builds the user prompt combining property context, query type, and guest message.
 *
 * @param {object} normalizedMessage - The unified message schema object
 * @returns {string}
 */
function buildUserPrompt(normalizedMessage) {
  const { guest_name, message_text, query_type, source, booking_ref } = normalizedMessage;

  return `PROPERTY CONTEXT:
${PROPERTY_CONTEXT}

GUEST DETAILS:
- Name: ${guest_name}
- Channel: ${source}
- Booking reference: ${booking_ref || 'Not provided'}
- Query type: ${query_type}

GUEST MESSAGE:
"${message_text}"

Please draft a reply to this guest message.`;
}

/**
 * Calls the Claude API and returns the drafted reply text.
 *
 * @param {object} normalizedMessage - The unified message schema object
 * @returns {Promise<string>} - The drafted reply from Claude
 */
async function getDraftedReply(normalizedMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }

  const requestBody = {
    model: CLAUDE_MODEL,
    max_tokens: 300,
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(normalizedMessage)
      }
    ]
  };

  const response = await axios.post(CLAUDE_API_URL, requestBody, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  });

  // Extract the text content from Claude's response
  const drafted_reply = response.data.content[0].text;
  return drafted_reply;
}

module.exports = { getDraftedReply };
