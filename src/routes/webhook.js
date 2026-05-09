const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { classifyMessage } = require('../services/classifier');
const { getDraftedReply } = require('../services/claudeService');
const { calculateConfidence, determineAction } = require('../utils/confidence');

const router = express.Router();

// Valid sources the platform accepts
const VALID_SOURCES = ['whatsapp', 'booking_com', 'airbnb', 'instagram', 'direct'];

/**
 * POST /webhook/message
 * Accepts a raw guest message from any hospitality channel,
 * normalizes it, classifies the query type, gets a Claude-drafted reply,
 * scores confidence, and returns a structured JSON response.
 */
router.post('/message', async (req, res) => {
  // Guard against empty or non-JSON body
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }

  const { source, guest_name, message, timestamp, booking_ref, property_id } = req.body;

  // --- Required field validation ---
  const missingFields = [];
  if (!source) missingFields.push('source');
  if (!guest_name) missingFields.push('guest_name');
  if (!message) missingFields.push('message');
  if (!timestamp) missingFields.push('timestamp');
  if (!property_id) missingFields.push('property_id');

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      missing: missingFields
    });
  }

  // --- Source validation ---
  if (!VALID_SOURCES.includes(source)) {
    return res.status(400).json({
      error: `Invalid source "${source}"`,
      valid_sources: VALID_SOURCES
    });
  }

  // --- Type validation ---
  if (typeof guest_name !== 'string' || guest_name.trim() === '') {
    return res.status(400).json({ error: 'guest_name must be a non-empty string' });
  }

  if (typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message must be a non-empty string' });
  }

  // Validate timestamp is a parseable ISO date
  if (isNaN(Date.parse(timestamp))) {
    return res.status(400).json({ error: 'timestamp must be a valid ISO 8601 date string' });
  }

  // --- Normalize into unified schema ---
  const normalizedMessage = {
    message_id: uuidv4(),
    source,
    guest_name: guest_name.trim(),
    message_text: message.trim(),
    timestamp,
    booking_ref: booking_ref || null,
    property_id,
    query_type: classifyMessage(message)
  };

  // --- Get drafted reply from Claude ---
  try {
    const drafted_reply = await getDraftedReply(normalizedMessage);

    // --- Calculate confidence score and action ---
    const confidence_score = calculateConfidence(normalizedMessage);
    const action = determineAction(confidence_score, normalizedMessage.query_type);

    // --- Return final structured response ---
    return res.status(200).json({
      message_id: normalizedMessage.message_id,
      query_type: normalizedMessage.query_type,
      drafted_reply,
      confidence_score,
      action
    });
  } catch (err) {
    // Claude API key missing
    if (err.message && err.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(500).json({
        error: 'Server configuration error: API key not set'
      });
    }

    // Claude API returned an error response
    if (err.response) {
      const status = err.response.status;
      const detail = err.response.data?.error?.message || 'Unknown API error';

      if (status === 401) {
        return res.status(502).json({ error: 'Claude API authentication failed — check API key' });
      }
      if (status === 429) {
        return res.status(502).json({ error: 'Claude API rate limit exceeded — try again shortly' });
      }
      if (status >= 500) {
        return res.status(502).json({ error: 'Claude API is temporarily unavailable', detail });
      }

      return res.status(502).json({ error: 'Claude API error', detail });
    }

    // Network / timeout error
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      return res.status(502).json({ error: 'Could not reach Claude API — network error', code: err.code });
    }

    // Unexpected error
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

module.exports = router;
